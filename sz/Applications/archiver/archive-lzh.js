;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC16,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        getFileName, normalizeArchivePath,
        _compressLZHUF, _tryLzssDecompress, crc32Hex } = A;
const { BitReader, buildHuffmanTable, decodeHuffman,
        buildHuffmanLookup, decodeHuffmanLookup } = A;

// FORMAT: LZH / LHA
// =======================================================================

class LzhFormat extends IArchiveFormat {
  static get id() { return 'lzh'; }
  static get displayName() { return 'LZH/LHA Archive'; }
  static get extensions() { return ['lzh', 'lha']; }
  static get canCreate() { return true; }

  static getCreateOptions() {
    return [
      { id: 'method', label: 'Method', type: 'select', options: [
        { value: '-lh4-', label: 'LH4 - 4KB window (-lh4-)' },
        { value: '-lh5-', label: 'LH5 - 8KB window (-lh5-)' },
        { value: '-lh6-', label: 'LH6 - 32KB window (-lh6-)' },
        { value: '-lh7-', label: 'LH7 - 64KB window (-lh7-)' },
        { value: '-lh0-', label: 'Store (-lh0-)' }
      ], default: '-lh5-' }
    ];
  }

  static _compressLhx(data, methodStr) {
    const DICBIT_MAP = { '-lh4-': 12, '-lh5-': 13, '-lh6-': 15, '-lh7-': 16 };
    const DICBIT = DICBIT_MAP[methodStr] || 13;
    return _compressLZHUF(data, 510, 19, 3, DICBIT);
  }

  static detect(bytes, _fileName) {
    if (bytes.length < 7) return false;
    return bytes[2] === 0x2D && bytes[3] === 0x6C && bytes[4] === 0x68 && bytes[6] === 0x2D;
  }

  async parse(bytes, _fileName, _password) {
    const entries = [];
    const handler = this;
    let off = 0;

    while (off + 7 <= bytes.length) {
      const hdr = this._readLzhHeader(bytes, off);
      if (!hdr) break;
      const { methodStr, compSize, origSize, name, modified, isDir, dataStart, nextOff } = hdr;

      let data = null;
      if (!isDir && compSize > 0 && dataStart + compSize <= bytes.length) {
        const rawData = bytes.slice(dataStart, dataStart + compSize);
        if (methodStr === '-lh0-' || methodStr === '-lz4-')
          data = rawData;
        else if (methodStr === '-lh4-' || methodStr === '-lh5-' || methodStr === '-lh6-' || methodStr === '-lh7-') {
          try {
            data = this._decompressLhx(rawData, origSize, methodStr);
          } catch (_) {
            data = null;
          }
        } else if (methodStr === '-lzs-' || methodStr === '-lz5-')
          data = await _tryLzssDecompress(rawData);
      }

      entries.push(makeEntry(
        normalizeArchivePath(name || 'unknown'), origSize, compSize, modified,
        data ? crc32Hex(data) : '', isDir, false, data, handler
      ));
      off = nextOff;
    }
    return entries;
  }

  _readLzhHeader(bytes, off) {
    if (off + 7 > bytes.length) return null;

    const methodStr = new TextDecoder('ascii', { fatal: false }).decode(bytes.subarray(off + 2, off + 7));
    if (!methodStr.startsWith('-l')) return null;

    const b0 = bytes[off];
    const b1 = bytes[off + 1];
    const level = bytes[off + 20];

    if (level === 0) {
      const headerSize = b0;
      if (headerSize === 0) return null;
      const compSize = readU32LE(bytes, off + 7);
      const origSize = readU32LE(bytes, off + 11);
      const timestamp = readU32LE(bytes, off + 15);
      const nameLen = bytes[off + 21];
      const name = new TextDecoder().decode(bytes.subarray(off + 22, off + 22 + nameLen));
      const crcOff = off + 22 + nameLen;
      const dataStart = off + 2 + headerSize;
      const modified = timestamp > 0 ? new Date(timestamp * 1000) : null;
      const isDir = name.endsWith('/') || name.endsWith('\\');
      return { methodStr, compSize, origSize, name, modified, isDir, dataStart, nextOff: dataStart + compSize };
    }

    if (level === 1) {
      const headerSize = b0;
      if (headerSize === 0) return null;
      let compSize = readU32LE(bytes, off + 7);
      const origSize = readU32LE(bytes, off + 11);
      const timestamp = readU32LE(bytes, off + 15);
      const nameLen = bytes[off + 21];
      let name = new TextDecoder().decode(bytes.subarray(off + 22, off + 22 + nameLen));
      let extOff = off + 2 + headerSize;
      let dir = '';
      while (extOff + 2 <= bytes.length) {
        const extSize = readU16LE(bytes, extOff);
        if (extSize === 0) { extOff += 2; break; }
        if (extOff + extSize > bytes.length) break;
        const extType = bytes[extOff + 2];
        if (extType === 0x01)
          name = new TextDecoder().decode(bytes.subarray(extOff + 3, extOff + extSize));
        else if (extType === 0x02)
          dir = new TextDecoder().decode(bytes.subarray(extOff + 3, extOff + extSize)).replace(/\xFF/g, '/');
        compSize -= extSize;
        extOff += extSize;
      }
      if (dir && !name.startsWith(dir)) name = dir + name;
      const dataStart = extOff;
      const modified = timestamp > 0 ? new Date(timestamp * 1000) : null;
      const isDir = name.endsWith('/') || name.endsWith('\\');
      return { methodStr, compSize, origSize, name, modified, isDir, dataStart, nextOff: dataStart + compSize };
    }

    if (level === 2) {
      const totalHeaderSize = readU16LE(bytes, off);
      if (totalHeaderSize === 0) return null;
      const compSize = readU32LE(bytes, off + 7);
      const origSize = readU32LE(bytes, off + 11);
      const unixTime = readU32LE(bytes, off + 15);
      let name = '';
      let dir = '';
      let extOff = off + 24;
      while (extOff + 2 <= off + totalHeaderSize) {
        const extSize = readU16LE(bytes, extOff);
        if (extSize === 0) break;
        if (extOff + extSize > bytes.length) break;
        const extType = bytes[extOff + 2];
        if (extType === 0x01)
          name = new TextDecoder().decode(bytes.subarray(extOff + 3, extOff + extSize));
        else if (extType === 0x02)
          dir = new TextDecoder().decode(bytes.subarray(extOff + 3, extOff + extSize)).replace(/\xFF/g, '/');
        extOff += extSize;
      }
      if (!name) {
        const nameLen = bytes[off + 21];
        name = new TextDecoder().decode(bytes.subarray(off + 22, off + 22 + nameLen));
      }
      if (dir && !name.startsWith(dir)) name = dir + name;
      const dataStart = off + totalHeaderSize;
      const modified = unixTime > 0 ? new Date(unixTime * 1000) : null;
      const isDir = name.endsWith('/') || name.endsWith('\\');
      return { methodStr, compSize, origSize, name, modified, isDir, dataStart, nextOff: dataStart + compSize };
    }

    const headerSize = b0;
    if (headerSize === 0) return null;
    const compSize = readU32LE(bytes, off + 7);
    const origSize = readU32LE(bytes, off + 11);
    const nameLen = bytes[off + 21];
    const name = new TextDecoder().decode(bytes.subarray(off + 22, off + 22 + nameLen));
    const dataStart = off + 2 + headerSize;
    const isDir = name.endsWith('/') || name.endsWith('\\');
    return { methodStr, compSize, origSize, name, modified: null, isDir, dataStart, nextOff: dataStart + compSize };
  }

  _decompressLhx(compressed, origSize, methodStr) {
    const DICBIT_MAP = { '-lh4-': 12, '-lh5-': 13, '-lh6-': 15, '-lh7-': 16 };
    const DICBIT = DICBIT_MAP[methodStr] || 13;
    const DICSIZ = 1 << DICBIT;
    const THRESHOLD = 3;
    const NC = 510;
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
        return { lengths: new Uint8Array(nn), fixed: c };
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
          else if (pCode === 1) dist = 1;
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
    const defaultMethod = (options && options.method) || '-lh5-';
    const parts = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const raw = entry._data instanceof Uint8Array ? entry._data : null;
      if (!raw) continue;

      let compData = raw;
      let method = entry._options && entry._options.method != null ? entry._options.method : defaultMethod;
      if (method !== '-lh0-') {
        const compressed = LzhFormat._compressLhx(raw, method);
        if (compressed.length < raw.length)
          compData = compressed;
        else
          method = '-lh0-';
      }

      const crc = computeCRC16(raw);
      const nameBytes = new TextEncoder().encode(entry.name);
      const nameLen = Math.min(nameBytes.length, 255);
      const headerBaseSize = 22 + nameLen;

      const header = new Uint8Array(2 + headerBaseSize);
      header[0] = headerBaseSize;
      header[1] = 0;
      header[2] = 0x2D; header[3] = 0x6C; header[4] = 0x68;
      header[5] = method.charCodeAt(3);
      header[6] = 0x2D;

      writeU32LE(header, 7, compData.length);
      writeU32LE(header, 11, raw.length);
      const mtime = entry.modified ? Math.floor(entry.modified.getTime() / 1000) : 0;
      writeU32LE(header, 15, mtime);
      header[19] = 0x20;
      header[20] = 0;
      header[21] = nameLen;
      header.set(nameBytes.subarray(0, nameLen), 22);
      writeU16LE(header, 22 + nameLen, crc);

      let checksum = 0;
      for (let i = 2; i < header.length; ++i)
        checksum = (checksum + header[i]) & 0xFF;
      header[1] = checksum;

      parts.push(header);
      parts.push(compData);
    }

    parts.push(new Uint8Array([0]));

    let total = 0;
    for (const p of parts) total += p.length;
    const result = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { result.set(p, pos); pos += p.length; }
    return result;
  }
}

IArchiveFormat.register(LzhFormat);

})();
