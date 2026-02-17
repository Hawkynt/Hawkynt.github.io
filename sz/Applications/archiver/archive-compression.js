;(function() { 'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32, crc32Hex,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        getFileName, getFileExtension, stripExtension,
        compressGzip, decompressGzip,
        _tryDeflateCompress, _tryDeflateDecompress,
        _tryLzmaCompress, _tryLzmaDecompress,
        _tryBzip2Compress, _tryBzip2Decompress,
        _tryZstdCompress, _tryZstdDecompress,
        _cipherCompress, _cipherDecompress,
        _decompressLZW } = A;

// FORMAT: GZIP
// =======================================================================

class GzipFormat extends IArchiveFormat {
  static get id() { return 'gzip'; }
  static get displayName() { return 'GZIP Archive'; }
  static get extensions() { return ['gz']; }
  static get canCreate() { return true; }

  static detect(bytes, fileName) {
    if (bytes.length < 2) return false;
    if (bytes[0] !== 0x1F || bytes[1] !== 0x8B) return false;
    const ext = getFileExtension(fileName || '');
    return ext !== 'tgz' && !fileName.toLowerCase().endsWith('.tar.gz');
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const decompressed = await decompressGzip(bytes);
    const innerName = stripExtension(getFileName(fileName || 'file.gz'));
    return [makeEntry(innerName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
  }

  async build(entries, _password, _options) {
    const entry = entries.find(e => !e.isDirectory);
    if (!entry || !entry._data) return new Uint8Array(0);
    const data = entry._data instanceof Uint8Array ? entry._data : null;
    if (!data) return new Uint8Array(0);
    return compressGzip(data);
  }
}

// FORMAT: BZIP2
// =======================================================================

class Bzip2Format extends IArchiveFormat {
  static get id() { return 'bzip2'; }
  static get displayName() { return 'BZIP2 Archive'; }
  static get extensions() { return ['bz2']; }
  static get canCreate() { return true; }

  static getCreateOptions() {
    return [
      { id: 'blockSize', label: 'Block size', type: 'select', options: [
        { value: '1', label: '1 (100 KB)' }, { value: '3', label: '3 (300 KB)' },
        { value: '6', label: '6 (600 KB)' }, { value: '9', label: '9 (900 KB)' }
      ], default: '9' }
    ];
  }

  static detect(bytes, fileName) {
    if (bytes.length < 3) return false;
    if (bytes[0] !== 0x42 || bytes[1] !== 0x5A || bytes[2] !== 0x68) return false;
    const lower = (fileName || '').toLowerCase();
    return !lower.endsWith('.tar.bz2') && !lower.endsWith('.tbz2');
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const baseName = stripExtension(getFileName(fileName || 'file.bz2'));
    try {
      const decompressed = await _tryBzip2Decompress(bytes);
      if (decompressed)
        return [makeEntry(baseName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
    } catch (_) { /* ignore */ }
    return [makeEntry(baseName, bytes.length, bytes.length, null, '', false, false, null, handler)];
  }

  async build(entries, _password, _options) {
    const entry = entries.find(e => !e.isDirectory);
    if (!entry || !entry._data) return new Uint8Array(0);
    const data = entry._data instanceof Uint8Array ? entry._data : null;
    if (!data) return new Uint8Array(0);
    const compressed = await _tryBzip2Compress(data);
    if (compressed) return compressed;
    return compressGzip(data);
  }
}

// FORMAT: XZ
// =======================================================================

class XzFormat extends IArchiveFormat {
  static get id() { return 'xz'; }
  static get displayName() { return 'XZ Archive'; }
  static get extensions() { return ['xz']; }
  static get canCreate() { return true; }

  static detect(bytes, fileName) {
    if (bytes.length < 6) return false;
    if (bytes[0] !== 0xFD || bytes[1] !== 0x37 || bytes[2] !== 0x7A || bytes[3] !== 0x58 || bytes[4] !== 0x5A || bytes[5] !== 0x00) return false;
    const lower = (fileName || '').toLowerCase();
    return !lower.endsWith('.tar.xz') && !lower.endsWith('.txz');
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const baseName = stripExtension(getFileName(fileName || 'file.xz'));
    try {
      // XZ/LZMA2 decompression via Cipher
      let decompressed = await _cipherDecompress('XZ/LZMA2', 'xz-lzma2.js', bytes);
      if (!decompressed)
        decompressed = await _tryLzmaDecompress(bytes);
      if (decompressed)
        return [makeEntry(baseName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
    } catch (_) { /* ignore */ }
    return [makeEntry(baseName, bytes.length, bytes.length, null, '', false, false, null, handler)];
  }

  async build(entries, _password, _options) {
    const entry = entries.find(e => !e.isDirectory);
    if (!entry || !entry._data) return new Uint8Array(0);
    const data = entry._data instanceof Uint8Array ? entry._data : null;
    if (!data) return new Uint8Array(0);
    // Try XZ/LZMA2 compression via Cipher
    let compressed = await _cipherCompress('XZ/LZMA2', 'xz-lzma2.js', data);
    if (compressed) return compressed;
    // Fallback to LZMA
    compressed = await _tryLzmaCompress(data);
    if (compressed) return compressed;
    return compressGzip(data);
  }
}

// FORMAT: ZStandard
// =======================================================================

class ZstdFormat extends IArchiveFormat {
  static get id() { return 'zstd'; }
  static get displayName() { return 'ZStandard Archive'; }
  static get extensions() { return ['zst']; }
  static get canCreate() { return true; }

  static getCreateOptions() {
    return [
      { id: 'level', label: 'Level', type: 'select', options: [
        { value: '1', label: '1 (Fastest)' }, { value: '3', label: '3 (Default)' },
        { value: '9', label: '9' }, { value: '19', label: '19 (Best)' }
      ], default: '3' }
    ];
  }

  static detect(bytes, fileName) {
    if (bytes.length < 4) return false;
    if (bytes[0] !== 0x28 || bytes[1] !== 0xB5 || bytes[2] !== 0x2F || bytes[3] !== 0xFD) return false;
    const lower = (fileName || '').toLowerCase();
    return !lower.endsWith('.tar.zst') && !lower.endsWith('.tzst');
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const baseName = stripExtension(getFileName(fileName || 'file.zst'));
    try {
      const decompressed = await _tryZstdDecompress(bytes);
      if (decompressed)
        return [makeEntry(baseName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
    } catch (_) { /* ignore */ }
    return [makeEntry(baseName, bytes.length, bytes.length, null, '', false, false, null, handler)];
  }

  async build(entries, _password, _options) {
    const entry = entries.find(e => !e.isDirectory);
    if (!entry || !entry._data) return new Uint8Array(0);
    const data = entry._data instanceof Uint8Array ? entry._data : null;
    if (!data) return new Uint8Array(0);
    const compressed = await _tryZstdCompress(data);
    if (compressed) return compressed;
    return compressGzip(data);
  }
}

// FORMAT: LZMA (standalone .lzma)
// =======================================================================

class LzmaFormat extends IArchiveFormat {
  static get id() { return 'lzma'; }
  static get displayName() { return 'LZMA Compressed'; }
  static get extensions() { return ['lzma']; }
  static get canCreate() { return true; }

  static detect(bytes, _fileName) {
    if (bytes.length < 13) return false;
    return bytes[0] === 0x5D && bytes[1] === 0x00 && bytes[2] === 0x00;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const baseName = stripExtension(getFileName(fileName || 'file.lzma'));
    try {
      const decompressed = await _tryLzmaDecompress(bytes);
      if (decompressed)
        return [makeEntry(baseName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
    } catch (_) { /* ignore */ }
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const uncompSize = Number(dv.getBigUint64(5, true));
    return [makeEntry(baseName, uncompSize >= 0 ? uncompSize : null, bytes.length, null, null, false, false, null, handler)];
  }

  async build(entries, _password, _options) {
    if (entries.length === 0) return new Uint8Array(0);
    const data = entries[0]._data instanceof Uint8Array ? entries[0]._data : new Uint8Array(await entries[0]._data());
    const compressed = await _tryLzmaCompress(data);
    if (compressed) return compressed;
    // Fallback: store with LZMA header
    const header = new Uint8Array(13);
    header[0] = 0x5D;
    const dv = new DataView(header.buffer);
    dv.setUint32(1, 65536, true);
    dv.setBigUint64(5, BigInt(data.length), true);
    const result = new Uint8Array(13 + data.length);
    result.set(header, 0);
    result.set(data, 13);
    return result;
  }
}

// FORMAT: LZIP (.lz)
// =======================================================================

class LzipFormat extends IArchiveFormat {
  static get id() { return 'lzip'; }
  static get displayName() { return 'LZIP Compressed'; }
  static get extensions() { return ['lz']; }
  static get canCreate() { return true; }

  static detect(bytes, _fileName) {
    return bytes.length >= 6 && bytes[0] === 0x4C && bytes[1] === 0x5A && bytes[2] === 0x49 && bytes[3] === 0x50;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const baseName = stripExtension(getFileName(fileName || 'file.lz'));
    if (bytes.length < 26) return [makeEntry(baseName, null, bytes.length, null, null, false, false, null, handler)];
    const footerView = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 20, 20);
    const dataSize = Number(footerView.getBigUint64(4, true));
    try {
      const ds = bytes[5];
      const dictSize = (1 << (ds & 0x1F));
      // Build standalone LZMA stream from LZIP payload
      const lzmaHeader = new Uint8Array(13);
      lzmaHeader[0] = 0x5D;
      const hv = new DataView(lzmaHeader.buffer);
      hv.setUint32(1, dictSize, true);
      hv.setBigUint64(5, BigInt(dataSize), true);
      const lzmaData = new Uint8Array(13 + (bytes.length - 26));
      lzmaData.set(lzmaHeader, 0);
      lzmaData.set(bytes.subarray(6, bytes.length - 20), 13);
      const decompressed = await _tryLzmaDecompress(lzmaData);
      if (decompressed)
        return [makeEntry(baseName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
    } catch (_) { /* ignore */ }
    return [makeEntry(baseName, dataSize, bytes.length, null, null, false, false, null, handler)];
  }

  async build(entries, _password, _options) {
    if (entries.length === 0) return new Uint8Array(0);
    const data = entries[0]._data instanceof Uint8Array ? entries[0]._data : new Uint8Array(await entries[0]._data());
    const compressed = await _tryLzmaCompress(data);
    if (compressed && compressed.length >= 13) {
      const lzmaPayload = compressed.subarray(13);
      const crc = computeCRC32(data);
      const memberSize = 6 + lzmaPayload.length + 20;
      const result = new Uint8Array(memberSize);
      result[0] = 0x4C; result[1] = 0x5A; result[2] = 0x49; result[3] = 0x50;
      result[4] = 1; result[5] = 23;
      result.set(lzmaPayload, 6);
      const rv = new DataView(result.buffer);
      rv.setUint32(6 + lzmaPayload.length, crc, true);
      rv.setBigUint64(6 + lzmaPayload.length + 4, BigInt(data.length), true);
      rv.setBigUint64(6 + lzmaPayload.length + 12, BigInt(memberSize), true);
      return result;
    }
    throw new Error('LZMA compression not available');
  }
}

// FORMAT: LZOP (.lzo)
// =======================================================================

class LzopFormat extends IArchiveFormat {
  static get id() { return 'lzop'; }
  static get displayName() { return 'LZOP Compressed'; }
  static get extensions() { return ['lzo']; }

  static detect(bytes, _fileName) {
    return bytes.length >= 9 && bytes[0] === 0x89 && bytes[1] === 0x4C && bytes[2] === 0x5A && bytes[3] === 0x4F;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const baseName = stripExtension(getFileName(fileName || 'file.lzo'));
    return [makeEntry(baseName, null, bytes.length, null, null, false, false, null, handler)];
  }

  async build(_entries, _password, _options) { throw new Error('LZOP creation not supported'); }
}

// FORMAT: Z / Unix Compress (read-only)
// =======================================================================

class ZCompressFormat extends IArchiveFormat {
  static get id() { return 'z'; }
  static get displayName() { return 'Unix Compress'; }
  static get extensions() { return ['z']; }

  static detect(bytes, _fileName) {
    if (bytes.length < 3) return false;
    return bytes[0] === 0x1F && bytes[1] === 0x9D;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    try {
      const decompressed = this._decompress(bytes);
      const innerName = stripExtension(getFileName(fileName || 'file.Z'));
      return [makeEntry(innerName, decompressed.length, bytes.length, null, crc32Hex(decompressed), false, false, decompressed, handler)];
    } catch (_) {
      return [makeEntry(stripExtension(getFileName(fileName || 'file.Z')), bytes.length, bytes.length, null, '', false, false, null, handler)];
    }
  }

  _decompress(bytes) {
    if (bytes.length < 3) throw new Error('Invalid Z file');
    const maxBits = bytes[2] & 0x1F;
    const blockMode = !!(bytes[2] & 0x80);
    const maxCode = (1 << maxBits) - 1;

    let bits = 9;
    let nextCode = blockMode ? 257 : 256;
    const table = new Array(maxCode + 1);
    for (let i = 0; i < 256; ++i) table[i] = [i];

    const output = [];
    let bitBuf = 0;
    let bitCount = 0;
    let bytePos = 3;
    let oldCode = -1;
    let finChar = 0;

    function readCode() {
      while (bitCount < bits) {
        if (bytePos >= bytes.length) return -1;
        bitBuf |= bytes[bytePos++] << bitCount;
        bitCount += 8;
      }
      const code = bitBuf & ((1 << bits) - 1);
      bitBuf >>>= bits;
      bitCount -= bits;
      return code;
    }

    while (true) {
      const code = readCode();
      if (code < 0) break;

      if (blockMode && code === 256) {
        for (let i = 257; i <= maxCode; ++i) table[i] = undefined;
        nextCode = 257;
        bits = 9;
        oldCode = -1;
        continue;
      }

      let entry;
      if (table[code] !== undefined)
        entry = table[code];
      else if (code === nextCode && oldCode >= 0)
        entry = [...table[oldCode], finChar];
      else
        break;

      for (let i = 0; i < entry.length; ++i) output.push(entry[i]);
      finChar = entry[0];

      if (oldCode >= 0 && nextCode <= maxCode) {
        table[nextCode] = [...table[oldCode], finChar];
        ++nextCode;
        if (nextCode > (1 << bits) && bits < maxBits)
          ++bits;
      }
      oldCode = code;
    }

    return new Uint8Array(output);
  }

  async build(_entries, _password, _options) { throw new Error('Z creation not supported'); }
}

A.GzipFormat = GzipFormat;
A.Bzip2Format = Bzip2Format;
A.XzFormat = XzFormat;
A.ZstdFormat = ZstdFormat;
A.LzmaFormat = LzmaFormat;
A.LzipFormat = LzipFormat;
A.LzopFormat = LzopFormat;
A.ZCompressFormat = ZCompressFormat;
IArchiveFormat.register(GzipFormat);
IArchiveFormat.register(Bzip2Format);
IArchiveFormat.register(XzFormat);
IArchiveFormat.register(ZstdFormat);
IArchiveFormat.register(LzmaFormat);
IArchiveFormat.register(LzipFormat);
IArchiveFormat.register(LzopFormat);
IArchiveFormat.register(ZCompressFormat);

})();
