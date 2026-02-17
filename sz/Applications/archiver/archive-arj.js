;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        getFileName, normalizeArchivePath,
        _tryDeflateCompress, _tryDeflateDecompress,
        dosToDate, dateToDos, _compressLZHUF } = A;
const { BitReader, buildHuffmanTable, decodeHuffman } = A;
const { crc32Hex, buildHuffmanLookup, decodeHuffmanLookup } = A;

// =======================================================================
// FORMAT: ARJ
// =======================================================================

class ArjFormat extends IArchiveFormat {
  static get id() { return 'arj'; }
  static get displayName() { return 'ARJ Archive'; }
  static get extensions() { return ['arj']; }
  static get canCreate() { return true; }

  static getCreateOptions() {
    return [
      { id: 'method', label: 'Method', type: 'select', options: [
        { value: '4', label: 'Deflate' },
        { value: '3', label: 'Fast (method 3)' },
        { value: '1', label: 'Maximum (method 1)' },
        { value: '2', label: 'Stearns (method 2)' },
        { value: '0', label: 'Store' }
      ], default: '1' }
    ];
  }

  static _compressArjHuffman(data, method) {
    const DICBIT = method === 1 ? 15 : (method === 2 ? 14 : 13);
    return _compressLZHUF(data, 286, 19, 3, DICBIT);
  }

  static detect(bytes, _fileName) {
    if (bytes.length < 2) return false;
    return bytes[0] === 0x60 && bytes[1] === 0xEA;
  }

  async parse(bytes, _fileName, _password) {
    const entries = [];
    const handler = this;
    let off = 0;

    const archHeader = this._readHeader(bytes, off);
    if (!archHeader) return entries;
    off = archHeader.nextOff;

    while (off + 2 < bytes.length) {
      if (bytes[off] !== 0x60 || bytes[off + 1] !== 0xEA) break;
      const fileHeader = this._readHeader(bytes, off);
      if (!fileHeader || fileHeader.basicSize === 0) break;
      off = fileHeader.nextOff;

      const name = fileHeader.name;
      const isDir = fileHeader.fileType === 3;
      const compSize = fileHeader.compSize;
      const origSize = fileHeader.origSize;
      const method = fileHeader.method;

      let data = null;
      if (!isDir && compSize > 0 && off + compSize <= bytes.length) {
        const rawData = bytes.slice(off, off + compSize);
        if (method === 0)
          data = rawData;
        else if (method >= 1 && method <= 3) {
          try {
            data = this._decompressArjHuffman(rawData, origSize, method);
          } catch (_) {
            data = null;
          }
        } else if (method === 4) {
          try {
            data = await _tryDeflateDecompress(rawData);
          } catch (_) {
            data = null;
          }
        }
      }

      const mod = fileHeader.timestamp > 0 ? dosToDate((fileHeader.timestamp >>> 16) & 0xFFFF, fileHeader.timestamp & 0xFFFF) : null;
      entries.push(makeEntry(
        normalizeArchivePath(name), origSize, compSize, mod,
        data ? crc32Hex(data) : '', isDir, false, data, handler
      ));

      off += compSize;
    }
    return entries;
  }

  _readHeader(bytes, off) {
    if (off + 4 > bytes.length) return null;
    if (bytes[off] !== 0x60 || bytes[off + 1] !== 0xEA) return null;

    const basicSize = readU16LE(bytes, off + 2);
    if (basicSize === 0) return { basicSize: 0, nextOff: off + 4 };
    if (off + 4 + basicSize > bytes.length) return null;

    const headerStart = off + 4;
    const firstSize = bytes[headerStart];
    const arjVer = bytes[headerStart + 1];
    const minVer = bytes[headerStart + 2];
    const hostOS = bytes[headerStart + 3];
    const flags = bytes[headerStart + 4];
    const method = bytes[headerStart + 5];
    const fileType = bytes[headerStart + 6];
    const timestamp = readU32LE(bytes, headerStart + 8);
    const compSize = readU32LE(bytes, headerStart + 12);
    const origSize = readU32LE(bytes, headerStart + 16);
    const crc = readU32LE(bytes, headerStart + 20);

    let nameStart = headerStart + firstSize;
    let nameEnd = nameStart;
    while (nameEnd < headerStart + basicSize && bytes[nameEnd] !== 0) ++nameEnd;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));

    let nextOff = off + 4 + basicSize + 4;
    while (nextOff + 2 <= bytes.length) {
      const extSize = readU16LE(bytes, nextOff);
      if (extSize === 0) { nextOff += 2; break; }
      nextOff += 2 + extSize + 4;
    }

    return { basicSize, name, method, fileType, compSize, origSize, timestamp, crc, nextOff };
  }

  _decompressArjHuffman(compressed, origSize, method) {
    const DICBIT = method === 1 ? 15 : (method === 2 ? 14 : 13);
    const DICSIZ = 1 << DICBIT;
    const THRESHOLD = 3;
    const NC = 286;
    const NT = 19;
    const NP = DICBIT + 1;

    const br = new BitReader(compressed);
    const output = new Uint8Array(origSize);
    let outPos = 0;
    const window = new Uint8Array(DICSIZ);
    let winPos = 0;

    function readPTLen(nn, nbit, special) {
      const n = br.getBits(nbit);
      if (n === 0) {
        const c = br.getBits(nbit);
        const lengths = new Uint8Array(nn);
        return { lengths, fixed: c };
      }
      const lengths = new Uint8Array(nn);
      let i = 0;
      while (i < n && i < nn) {
        let bitLen = br.getBits(3);
        if (bitLen === 7)
          while (br.getBits(1)) ++bitLen;
        lengths[i++] = bitLen;
        if (i === special) i += br.getBits(2);
      }
      return { lengths, fixed: -1 };
    }

    function readCLen(ptLengths, ptFixed) {
      const n = br.getBits(9);
      if (n === 0) {
        const c = br.getBits(9);
        return { lengths: new Uint8Array(NC), fixed: c };
      }
      const lengths = new Uint8Array(NC);
      const ptLookup = ptFixed >= 0 ? null : buildHuffmanLookup(ptLengths, NT);
      let i = 0;
      while (i < n && i < NC) {
        const c = ptFixed >= 0 ? ptFixed : decodeHuffmanLookup(br, ptLookup);
        if (c === 0) lengths[i++] = 0;
        else if (c === 1) { const rep = br.getBits(4) + 3; i += rep; }
        else if (c === 2) { const rep = br.getBits(9) + 20; i += rep; }
        else lengths[i++] = c - 2;
      }
      return { lengths, fixed: -1 };
    }

    while (outPos < origSize) {
      const blockSize = br.getBits(16);
      if (blockSize === 0) break;

      const pt = readPTLen(NT, 5, 3);
      const cl = readCLen(pt.lengths, pt.fixed);
      const pt2 = readPTLen(NP, DICBIT >= 14 ? 5 : 4, -1);

      const cLookup = cl.fixed >= 0 ? null : buildHuffmanLookup(cl.lengths, NC);
      const pLookup = pt2.fixed >= 0 ? null : buildHuffmanLookup(pt2.lengths, NP);

      for (let k = 0; k < blockSize && outPos < origSize; ++k) {
        const c = cl.fixed >= 0 ? cl.fixed : decodeHuffmanLookup(br, cLookup);
        if (c < 256) {
          output[outPos++] = c;
          window[winPos] = c;
          winPos = (winPos + 1) & (DICSIZ - 1);
        } else {
          const matchLen = c - 256 + THRESHOLD;
          const pCode = pt2.fixed >= 0 ? pt2.fixed : decodeHuffmanLookup(br, pLookup);
          let dist;
          if (pCode === 0) dist = 0;
          else if (pCode === 1) dist = (1 << 0) | br.getBits(0);
          else dist = ((1 << (pCode - 1)) | br.getBits(pCode - 1));
          let srcPos = (winPos - dist - 1 + DICSIZ) & (DICSIZ - 1);
          for (let i = 0; i < matchLen && outPos < origSize; ++i) {
            const ch = window[srcPos];
            output[outPos++] = ch;
            window[winPos] = ch;
            winPos = (winPos + 1) & (DICSIZ - 1);
            srcPos = (srcPos + 1) & (DICSIZ - 1);
          }
        }
      }
    }
    return output;
  }

  async build(entries, _password, options) {
    const defaultMethod = parseInt((options && options.method) || '0', 10);
    const parts = [];

    const archHdr = this._buildArjHeader('', 0, 0, 0, 0, 2, 0);
    parts.push(archHdr);

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const raw = entry._data instanceof Uint8Array ? entry._data : null;
      if (!raw) continue;

      const requestedMethod = parseInt(
        entry._options && entry._options.method != null ? entry._options.method : defaultMethod,
        10
      );

      let packed = raw;
      let method = 0;
      if (requestedMethod >= 1 && requestedMethod <= 3) {
        const compressed = ArjFormat._compressArjHuffman(raw, requestedMethod);
        if (compressed.length < raw.length) {
          packed = compressed;
          method = requestedMethod;
        }
      } else if (requestedMethod === 4) {
        const compressed = await _tryDeflateCompress(raw);
        if (compressed && compressed.length < raw.length) {
          packed = compressed;
          method = 4;
        }
      }

      const crc = computeCRC32(raw);
      const mtime = entry.modified || new Date();
      const dosTime = dateToDos(mtime);
      const timestamp = (dosTime.date << 16) | dosTime.time;
      const fileHdr = this._buildArjHeader(entry.name, packed.length, raw.length, timestamp, crc, 0, method);
      parts.push(fileHdr);
      parts.push(packed);
    }

    const eof = new Uint8Array(4);
    eof[0] = 0x60; eof[1] = 0xEA;
    writeU16LE(eof, 2, 0);
    parts.push(eof);

    let total = 0;
    for (const p of parts) total += p.length;
    const result = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { result.set(p, pos); pos += p.length; }
    return result;
  }

  _buildArjHeader(name, compSize, origSize, timestamp, crc, fileType, method) {
    const nameBytes = new TextEncoder().encode(name);
    const firstSize = 30;
    const basicSize = firstSize + nameBytes.length + 1 + 1;
    const parts = [];

    const magic = new Uint8Array(4);
    magic[0] = 0x60; magic[1] = 0xEA;
    writeU16LE(magic, 2, basicSize);
    parts.push(magic);

    const basic = new Uint8Array(basicSize);
    basic[0] = firstSize;
    basic[1] = 11;
    basic[2] = 1;
    basic[3] = 0;
    basic[4] = 0;
    basic[5] = method || 0;
    basic[6] = fileType;
    basic[7] = 0;
    writeU32LE(basic, 8, timestamp);
    writeU32LE(basic, 12, compSize);
    writeU32LE(basic, 16, origSize);
    writeU32LE(basic, 20, crc);
    writeU16LE(basic, 24, 0);
    writeU16LE(basic, 26, 0x0100);
    writeU16LE(basic, 28, 0);

    basic.set(nameBytes, firstSize);
    basic[firstSize + nameBytes.length] = 0;
    basic[firstSize + nameBytes.length + 1] = 0;

    const headerCrc = computeCRC32(basic);
    const crcBytes = new Uint8Array(4);
    writeU32LE(crcBytes, 0, headerCrc);
    parts.push(basic);
    parts.push(crcBytes);

    const extEnd = new Uint8Array(2);
    writeU16LE(extEnd, 0, 0);
    parts.push(extEnd);

    let total = 0;
    for (const p of parts) total += p.length;
    const result = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { result.set(p, off); off += p.length; }
    return result;
  }
}

IArchiveFormat.register(ArjFormat);

})();
