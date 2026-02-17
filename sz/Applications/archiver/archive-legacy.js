;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32, crc32Hex,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        readU16BE, readU32BE,
        getFileName, getFileExtension, stripExtension, normalizeArchivePath,
        _tryDeflateDecompress, _tryLzmaDecompress, _tryBzip2Decompress,
        _tryLzssDecompress, _cipherDecompress,
        concatUint8Arrays } = A;
const { BitReader, buildHuffmanTable, decodeHuffman,
        buildHuffmanLookup, decodeHuffmanLookup } = A;
const { dosToDate, _decompressLZW } = A;

// FORMAT: SQX (read-only, limited)
// =======================================================================

class SqxFormat extends IArchiveFormat {
  static get id() { return 'sqx'; }
  static get displayName() { return 'SQX Archive'; }
  static get extensions() { return ['sqx']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 8) return false;
    const magic = new TextDecoder().decode(bytes.subarray(0, 7));
    return magic === 'XHDSQX\x1A' || magic.startsWith('XHDSQX');
  }

  async parse(bytes, _fileName, _password) {
    const entries = [];
    const handler = this;
    let off = 0;

    if (bytes.length < 8) return entries;

    const magic = new TextDecoder().decode(bytes.subarray(0, 7));
    if (!magic.startsWith('XHDSQX')) return entries;
    off = 8;

    while (off + 8 <= bytes.length) {
      const blockType = readU16LE(bytes, off);
      const blockFlags = readU16LE(bytes, off + 2);
      const blockSize = readU32LE(bytes, off + 4);

      if (blockSize < 8 || off + blockSize > bytes.length) break;

      if (blockType === 1 || blockType === 2) {
        const compSize = off + 12 < bytes.length ? readU32LE(bytes, off + 8) : 0;
        const origSize = off + 16 < bytes.length ? readU32LE(bytes, off + 12) : 0;
        const method = off + 17 < bytes.length ? bytes[off + 16] : 0xFF;

        let nameOff = off + 24;
        let nameEnd = nameOff;
        while (nameEnd < off + blockSize && bytes[nameEnd] !== 0) ++nameEnd;
        const name = new TextDecoder().decode(bytes.subarray(nameOff, nameEnd));
        const isDir = blockType === 2;

        let data = null;
        const dataStart = off + blockSize;
        if (!isDir && compSize > 0 && dataStart + compSize <= bytes.length) {
          const rawData = bytes.slice(dataStart, dataStart + compSize);
          if (method === 0)
            data = rawData;
          else if (method === 1)
            data = await _cipherDecompress('Huffman', 'huffman.js', rawData);
          else if (method === 2) {
            data = await _tryLzssDecompress(rawData);
            if (!data) data = await _tryDeflateDecompress(rawData);
          } else if (method === 3)
            data = await _tryBzip2Decompress(rawData);
        }

        entries.push(makeEntry(
          normalizeArchivePath(name || 'unknown'), origSize, compSize, null,
          data ? crc32Hex(data) : '', isDir, false, data, handler
        ));

        off += blockSize + compSize;
        continue;
      }

      off += blockSize;
    }
    return entries;
  }

  async build(_entries, _password, _options) { throw new Error('SQX creation not supported'); }
}

// FORMAT: ARC (SEA ARC)
// =======================================================================

class ArcFormat extends IArchiveFormat {
  static get id() { return 'arc'; }
  static get displayName() { return 'ARC Archive'; }
  static get extensions() { return ['arc']; }

  static detect(bytes, _fileName) {
    return bytes.length >= 3 && bytes[0] === 0x1A && bytes[1] >= 1 && bytes[1] <= 9;
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const entries = [];
    let off = 0;

    while (off + 2 < bytes.length && bytes[off] === 0x1A) {
      const method = bytes[off + 1];
      if (method === 0) break;
      off += 2;
      let nameEnd = off;
      while (nameEnd < off + 13 && nameEnd < bytes.length && bytes[nameEnd] !== 0) ++nameEnd;
      const name = new TextDecoder().decode(bytes.subarray(off, nameEnd));
      off += 13;
      if (off + 8 > bytes.length) break;
      const compressedSize = readU32LE(bytes, off); off += 4;
      const dosDate = readU16LE(bytes, off); off += 2;
      const dosTime = readU16LE(bytes, off); off += 2;
      const crc = readU16LE(bytes, off); off += 2;
      let originalSize = compressedSize;
      if (method >= 2 && off + 4 <= bytes.length) { originalSize = readU32LE(bytes, off); off += 4; }
      const modified = dosToDate(dosDate, dosTime);

      let data = null;
      if (off + compressedSize <= bytes.length) {
        const rawData = bytes.slice(off, off + compressedSize);
        if (method <= 2)
          data = rawData;
        else if (method === 3)
          data = this._decompressRLE(rawData);
        else if (method === 4)
          data = this._decompressSqueezed(rawData, originalSize);
        else if (method >= 5 && method <= 9)
          data = this._decompressArcLZW(rawData, method);
      }

      entries.push(makeEntry(name, originalSize, compressedSize, modified, crc.toString(16).toUpperCase().padStart(4, '0'), false, false, data, handler));
      off += compressedSize;
    }
    return entries;
  }

  _decompressRLE(data) {
    const output = [];
    let i = 0;
    while (i < data.length) {
      if (data[i] === 0x90) {
        ++i;
        if (i >= data.length) break;
        if (data[i] === 0) {
          output.push(0x90);
          ++i;
        } else {
          const count = data[i++];
          const prev = output.length > 0 ? output[output.length - 1] : 0;
          for (let j = 1; j < count; ++j) output.push(prev);
        }
      } else
        output.push(data[i++]);
    }
    return new Uint8Array(output);
  }

  _decompressSqueezed(data, origSize) {
    const unrle = this._decompressRLE(data);
    if (unrle.length < 4) return null;
    const nodeCount = readU16LE(unrle, 0);
    if (unrle.length < 2 + nodeCount * 4) return null;
    const nodes = [];
    let off = 2;
    for (let i = 0; i < nodeCount; ++i) {
      const left = readU16LE(unrle, off);
      const right = readU16LE(unrle, off + 2);
      nodes.push([left >= 0x8000 ? left - 0x10000 : left, right >= 0x8000 ? right - 0x10000 : right]);
      off += 4;
    }
    const br = new BitReader(unrle.subarray(off));
    const output = new Uint8Array(origSize);
    let outPos = 0;
    while (outPos < origSize) {
      let node = 0;
      while (node >= 0) {
        if (node >= nodes.length) return output.subarray(0, outPos);
        const bit = br.getBits(1);
        node = bit ? nodes[node][1] : nodes[node][0];
      }
      const ch = -(node + 1);
      if (ch === 256) break;
      output[outPos++] = ch;
    }
    return output;
  }

  _decompressArcLZW(data, method) {
    if (method === 5) return _decompressLZW(data, 12, false);
    if (method === 6 || method === 7 || method === 8) return _decompressLZW(data, 12, true);
    if (method === 9) return _decompressLZW(data, 13, false);
    return null;
  }

  async build(_entries, _password, _options) { throw new Error('ARC creation not supported'); }
}

// FORMAT: ZOO
// =======================================================================

class ZooFormat extends IArchiveFormat {
  static get id() { return 'zoo'; }
  static get displayName() { return 'ZOO Archive'; }
  static get extensions() { return ['zoo']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 34) return false;
    return bytes[20] === 0xDC && bytes[21] === 0xA7 && bytes[22] === 0xC4 && bytes[23] === 0xFD;
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const entries = [];
    let dirOffset = readU32LE(bytes, 24);

    while (dirOffset > 0 && dirOffset + 56 <= bytes.length) {
      const tag = readU32LE(bytes, dirOffset);
      if (tag !== 0xFDC4A7DC) break;
      const type = bytes[dirOffset + 4];
      const method = bytes[dirOffset + 5];
      const next = readU32LE(bytes, dirOffset + 6);
      const dataOff = readU32LE(bytes, dirOffset + 10);
      const dosDate = readU16LE(bytes, dirOffset + 14);
      const dosTime = readU16LE(bytes, dirOffset + 16);
      const crc = readU16LE(bytes, dirOffset + 18);
      const origSize = readU32LE(bytes, dirOffset + 20);
      const compSize = readU32LE(bytes, dirOffset + 24);
      const nameLen = bytes[dirOffset + 48] || 13;
      let name = '';
      for (let i = 0; i < nameLen && dirOffset + 49 + i < bytes.length; ++i) {
        if (bytes[dirOffset + 49 + i] === 0) break;
        name += String.fromCharCode(bytes[dirOffset + 49 + i]);
      }
      if (type !== 0 && name) {
        const modified = dosToDate(dosDate, dosTime);
        let data = null;
        if (dataOff + compSize <= bytes.length) {
          const rawData = bytes.slice(dataOff, dataOff + compSize);
          if (method === 0)
            data = rawData;
          else if (method === 1)
            data = _decompressLZW(rawData, 13, true);
          else if (method === 2)
            data = await _tryLzssDecompress(rawData);
        }
        entries.push(makeEntry(name, origSize, compSize, modified, crc.toString(16).toUpperCase().padStart(4, '0'), false, false, data, handler));
      }
      dirOffset = next;
      if (dirOffset === 0) break;
    }
    return entries;
  }

  async build(_entries, _password, _options) { throw new Error('ZOO creation not supported'); }
}

// FORMAT: HA
// =======================================================================

class HaFormat extends IArchiveFormat {
  static get id() { return 'ha'; }
  static get displayName() { return 'HA Archive'; }
  static get extensions() { return ['ha']; }

  static detect(bytes, _fileName) {
    return bytes.length >= 4 && bytes[0] === 0x48 && bytes[1] === 0x41 && bytes[2] === 0x00;
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const entries = [];
    let off = 4;

    while (off + 22 <= bytes.length) {
      if (bytes[off] === 0xFF && bytes[off + 1] === 0xFF) break;
      const method = bytes[off] & 0x0F;
      const type = (bytes[off] >> 4) & 0x0F;
      off += 1;
      const compSize = readU32LE(bytes, off); off += 4;
      const origSize = readU32LE(bytes, off); off += 4;
      const crc = readU32LE(bytes, off); off += 4;
      const mtime = readU32LE(bytes, off); off += 4;
      let pathLen = 0;
      while (off + pathLen < bytes.length && bytes[off + pathLen] !== 0) ++pathLen;
      const path = new TextDecoder().decode(bytes.subarray(off, off + pathLen));
      off += pathLen + 1;
      let name = '';
      let nameLen = 0;
      while (off + nameLen < bytes.length && bytes[off + nameLen] !== 0) ++nameLen;
      name = new TextDecoder().decode(bytes.subarray(off, off + nameLen));
      off += nameLen + 1;
      const fullName = path ? path + '/' + name : name;
      const modified = new Date(mtime * 1000);
      const isDir = type === 0x0E;
      let data = null;
      if (!isDir && off + compSize <= bytes.length) {
        const rawData = bytes.slice(off, off + compSize);
        if (method === 0)
          data = rawData;
        else if (method === 1)
          data = this._decompressASC(rawData, origSize);
        else if (method === 2)
          data = await _cipherDecompress('Arithmetic Coding', 'arithmetic.js', rawData);
      }
      entries.push(makeEntry(fullName, origSize, compSize, modified, crc.toString(16).toUpperCase().padStart(8, '0'), isDir, false, data, handler));
      off += compSize;
    }
    return entries;
  }

  _decompressASC(data, origSize) {
    const NUM_SYMBOLS = 257;
    const EOF_SYMBOL = 256;
    const freq = new Uint16Array(NUM_SYMBOLS + 1);
    for (let i = 0; i <= NUM_SYMBOLS; ++i) freq[i] = i;
    let totalFreq = NUM_SYMBOLS;

    const output = new Uint8Array(origSize);
    let outPos = 0;

    const BITS = 16;
    const TOP = 1 << BITS;
    const HALF = TOP >>> 1;
    const QTR = HALF >>> 1;

    let lo = 0;
    let hi = TOP - 1;
    let value = 0;

    let bitPos = 0;
    function getBit() {
      if (bitPos >= data.length * 8) return 0;
      const byteIdx = bitPos >>> 3;
      const bitIdx = 7 - (bitPos & 7);
      ++bitPos;
      return (data[byteIdx] >>> bitIdx) & 1;
    }

    for (let i = 0; i < BITS; ++i)
      value = (value << 1) | getBit();

    while (outPos < origSize) {
      const range = hi - lo + 1;
      const scaled = Math.floor(((value - lo + 1) * totalFreq - 1) / range);

      let symbol = 0;
      let cumFreq = 0;
      for (symbol = 0; symbol < NUM_SYMBOLS; ++symbol) {
        if (cumFreq + (freq[symbol + 1] - freq[symbol]) > scaled) break;
        cumFreq += freq[symbol + 1] - freq[symbol];
      }
      if (symbol === EOF_SYMBOL) break;

      const symLo = cumFreq;
      const symHi = cumFreq + (freq[symbol + 1] - freq[symbol]);

      hi = lo + Math.floor(range * symHi / totalFreq) - 1;
      lo = lo + Math.floor(range * symLo / totalFreq);

      for (;;) {
        if (hi < HALF) {
          // do nothing
        } else if (lo >= HALF) {
          lo -= HALF;
          hi -= HALF;
          value -= HALF;
        } else if (lo >= QTR && hi < 3 * QTR) {
          lo -= QTR;
          hi -= QTR;
          value -= QTR;
        } else
          break;
        lo = lo << 1;
        hi = (hi << 1) | 1;
        value = (value << 1) | getBit();
        lo &= (TOP - 1);
        hi &= (TOP - 1);
        value &= (TOP - 1);
      }

      output[outPos++] = symbol;

      for (let i = symbol + 1; i <= NUM_SYMBOLS; ++i) ++freq[i];
      ++totalFreq;

      if (totalFreq >= 0x3FFF) {
        let cumul = 0;
        for (let i = 0; i <= NUM_SYMBOLS; ++i) {
          const f = freq[i] - cumul;
          cumul = freq[i];
          freq[i] = (i === 0) ? 0 : freq[i - 1] + Math.max(1, f >>> 1);
        }
        totalFreq = freq[NUM_SYMBOLS];
      }
    }
    return output;
  }

  async build(_entries, _password, _options) { throw new Error('HA creation not supported'); }
}

// FORMAT: ACE (read-only)
// =======================================================================

class AceFormat extends IArchiveFormat {
  static get id() { return 'ace'; }
  static get displayName() { return 'ACE Archive'; }
  static get extensions() { return ['ace']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 14) return false;
    return bytes[7] === 0x2A && bytes[8] === 0x2A && bytes[9] === 0x41 && bytes[10] === 0x43 && bytes[11] === 0x45 && bytes[12] === 0x2A && bytes[13] === 0x2A;
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const entries = [];
    const headerSize = readU16LE(bytes, 0);
    let off = 4 + headerSize;

    while (off + 4 < bytes.length) {
      const hdrCrc = readU16LE(bytes, off);
      const hdrSize = readU16LE(bytes, off + 2);
      if (hdrSize === 0 || off + 4 + hdrSize > bytes.length) break;
      const hdrType = bytes[off + 4];
      const hdrFlags = readU16LE(bytes, off + 5);

      if (hdrType === 1) {
        const compSize = readU32LE(bytes, off + 7);
        const origSize = readU32LE(bytes, off + 11);
        const method = bytes[off + 19];
        const qual = bytes[off + 20];
        const crc = readU32LE(bytes, off + 23);
        const nameLen = readU16LE(bytes, off + 31);
        const nameStart = off + 33;
        const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
        const isDir = (hdrFlags & 0x1000) !== 0;
        const dataStart = off + 4 + hdrSize;

        let data = null;
        if (!isDir && dataStart + compSize <= bytes.length) {
          const rawData = bytes.slice(dataStart, dataStart + compSize);
          if (method === 0)
            data = rawData;
          else {
            data = await _tryDeflateDecompress(rawData);
            if (!data) data = await _cipherDecompress('LZ77', 'lz77.js', rawData);
            if (!data) data = await _tryLzssDecompress(rawData);
          }
        }

        entries.push(makeEntry(normalizeArchivePath(name), origSize, compSize, null, crc.toString(16).toUpperCase().padStart(8, '0'), isDir, false, data, handler));
        off = dataStart + compSize;
      } else {
        off += 4 + hdrSize;
      }
    }
    return entries;
  }

  async build(_entries, _password, _options) { throw new Error('ACE creation not supported'); }
}

// FORMAT: StuffIt (.sit) (read-only)
// =======================================================================

class SitFormat extends IArchiveFormat {
  static get id() { return 'sit'; }
  static get displayName() { return 'StuffIt Archive'; }
  static get extensions() { return ['sit']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 14) return false;
    return (bytes[0] === 0x53 && bytes[1] === 0x49 && bytes[2] === 0x54 && bytes[3] === 0x21) ||
           (bytes[0] === 0x53 && bytes[1] === 0x74 && bytes[2] === 0x75 && bytes[3] === 0x66 && bytes[4] === 0x66);
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    return [makeEntry(getFileName(fileName || 'archive.sit'), bytes.length, bytes.length, null, null, false, false, null, handler)];
  }

  async build(_entries, _password, _options) { throw new Error('StuffIt creation not supported'); }
}

// =======================================================================
// FORMAT: StuffIt X (.sitx) (read-only)
// =======================================================================

class SitxFormat extends IArchiveFormat {
  static get id() { return 'sitx'; }
  static get displayName() { return 'StuffIt X Archive'; }
  static get extensions() { return ['sitx']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 8) return false;
    return bytes[0] === 0x53 && bytes[1] === 0x74 && bytes[2] === 0x75 && bytes[3] === 0x66 &&
           bytes[4] === 0x66 && bytes[5] === 0x49 && bytes[6] === 0x74;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    return [makeEntry(getFileName(fileName || 'archive.sitx'), bytes.length, bytes.length, null, null, false, false, null, handler)];
  }

  async build(_entries, _password, _options) { throw new Error('StuffIt X creation not supported'); }
}

// =======================================================================
// FORMAT: PAK (Quake PAK)
// =======================================================================

class PakFormat extends IArchiveFormat {
  static get id() { return 'pak'; }
  static get displayName() { return 'PAK Archive'; }
  static get extensions() { return ['pak']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 12) return false;
    return bytes[0] === 0x50 && bytes[1] === 0x41 && bytes[2] === 0x43 && bytes[3] === 0x4B;
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const entries = [];
    const dirOffset = readU32LE(bytes, 4);
    const dirSize = readU32LE(bytes, 8);
    const numEntries = Math.floor(dirSize / 64);

    for (let i = 0; i < numEntries; ++i) {
      const entryOff = dirOffset + i * 64;
      if (entryOff + 64 > bytes.length) break;
      let nameEnd = entryOff;
      while (nameEnd < entryOff + 56 && bytes[nameEnd] !== 0) ++nameEnd;
      const name = new TextDecoder().decode(bytes.subarray(entryOff, nameEnd));
      const fileOffset = readU32LE(bytes, entryOff + 56);
      const fileSize = readU32LE(bytes, entryOff + 60);
      const data = (fileOffset + fileSize <= bytes.length) ? bytes.slice(fileOffset, fileOffset + fileSize) : null;
      entries.push(makeEntry(normalizeArchivePath(name), fileSize, fileSize, null, data ? crc32Hex(data) : null, false, false, data, handler));
    }
    return entries;
  }

  async build(_entries, _password, _options) { throw new Error('PAK creation not supported'); }
}

// FORMAT: ALZ (ALZip)
// =======================================================================

class AlzFormat extends IArchiveFormat {
  static get id() { return 'alz'; }
  static get displayName() { return 'ALZ Archive'; }
  static get extensions() { return ['alz']; }

  static detect(bytes, _fileName) {
    return bytes.length >= 4 && bytes[0] === 0x41 && bytes[1] === 0x4C && bytes[2] === 0x5A && bytes[3] === 0x01;
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const entries = [];
    let off = 8;

    while (off + 12 < bytes.length) {
      const sig = readU32LE(bytes, off);
      if (sig === 0x015A4C42) {
        off += 4;
        const nameLen = readU16LE(bytes, off); off += 2;
        const attr = bytes[off]; off += 1;
        const dosTime = readU32LE(bytes, off); off += 4;
        const method = bytes[off]; off += 1;
        off += 1;
        const compSize = readU32LE(bytes, off); off += 4;
        const origSize = readU32LE(bytes, off); off += 4;
        const name = new TextDecoder().decode(bytes.subarray(off, off + nameLen)); off += nameLen;
        const isDir = (attr & 0x10) !== 0;
        const data = (method === 0 && !isDir && off + compSize <= bytes.length) ? bytes.slice(off, off + compSize) : null;
        entries.push(makeEntry(normalizeArchivePath(name), origSize, compSize, null, null, isDir, false, data, handler));
        off += compSize;
      } else if (sig === 0x025A4C43) {
        break;
      } else {
        ++off;
      }
    }
    return entries;
  }

  async build(_entries, _password, _options) { throw new Error('ALZ creation not supported'); }
}

// =======================================================================
// FORMAT: PEA
// =======================================================================

class PeaFormat extends IArchiveFormat {
  static get id() { return 'pea'; }
  static get displayName() { return 'PEA Archive'; }
  static get extensions() { return ['pea']; }

  static detect(bytes, _fileName) {
    return bytes.length >= 3 && bytes[0] === 0x50 && bytes[1] === 0x45 && bytes[2] === 0x41;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    return [makeEntry(getFileName(fileName || 'archive.pea'), bytes.length, bytes.length, null, null, false, false, null, handler)];
  }

  async build(_entries, _password, _options) { throw new Error('PEA creation not supported'); }
}

IArchiveFormat.register(SqxFormat);
IArchiveFormat.register(ArcFormat);
IArchiveFormat.register(ZooFormat);
IArchiveFormat.register(HaFormat);
IArchiveFormat.register(AceFormat);
IArchiveFormat.register(SitFormat);
IArchiveFormat.register(SitxFormat);
IArchiveFormat.register(PakFormat);
IArchiveFormat.register(AlzFormat);
IArchiveFormat.register(PeaFormat);

})();
