;(function() {
'use strict';

const SZ = window.SZ || (window.SZ = {});
const A = SZ.Archiver || (SZ.Archiver = {});

// =======================================================================
// IArchiveFormat Base Class + Registry
// =======================================================================

class IArchiveFormat {
  static get id() { throw new Error('Not implemented'); }
  static get displayName() { throw new Error('Not implemented'); }
  static get extensions() { throw new Error('Not implemented'); }
  static get canCreate() { return false; }
  static get supportsEncryption() { return false; }
  static getCreateOptions() { return []; }
  static detect(_bytes, _fileName) { return false; }
  async parse(_bytes, _fileName, _password) { throw new Error('Not implemented'); }
  async build(_entries, _password, _options) { throw new Error('Not implemented'); }
}

IArchiveFormat.formats = [];

IArchiveFormat.register = function(FormatClass) {
  IArchiveFormat.formats.push(FormatClass);
};

IArchiveFormat.detectFormat = function(bytes, fileName) {
  for (const F of IArchiveFormat.formats)
    if (F.detect(bytes, fileName))
      return F;
  return null;
};

IArchiveFormat.findById = function(id) {
  return IArchiveFormat.formats.find(f => f.id === id) || null;
};

// =======================================================================
// ArchiveEntry model
// =======================================================================

function makeEntry(name, size, packed, modified, crc, isDirectory, encrypted, data, handler, options) {
  return { name, size, packed, modified, crc, isDirectory, encrypted, _data: data, _handler: handler, _options: options || null };
}

// =======================================================================
// Utilities
// =======================================================================

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatSize(n) {
  if (n == null || n < 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

function formatDate(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const pad = (v) => String(v).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function getFileExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.substring(dot + 1).toLowerCase() : '';
}

function stripExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.substring(0, dot) : name;
}

function getFileName(path) {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return slash >= 0 ? path.substring(slash + 1) : path;
}

function normalizeArchivePath(name) {
  return name.replace(/\\/g, '/').replace(/^\/+/, '');
}

// =======================================================================
// CRC-32 (IEEE polynomial)
// =======================================================================

const CRC32_TABLE = (function() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; ++i) {
    let c = i;
    for (let j = 0; j < 8; ++j)
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function computeCRC32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; ++i)
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function crc32Hex(bytes) {
  return computeCRC32(bytes).toString(16).toUpperCase().padStart(8, '0');
}

// =======================================================================
// CRC-16 (for LZH)
// =======================================================================

const CRC16_TABLE = (function() {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; ++i) {
    let c = i;
    for (let j = 0; j < 8; ++j)
      c = (c & 1) ? (0xA001 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function computeCRC16(bytes) {
  let crc = 0;
  for (let i = 0; i < bytes.length; ++i)
    crc = CRC16_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return crc & 0xFFFF;
}

// =======================================================================
// CompressionStream / DecompressionStream helpers
// =======================================================================

async function compressGzip(data) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function decompressGzip(data) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function compressDeflateRaw(data) {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function decompressDeflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

// =======================================================================
// Cipher Algorithm Loader (sibling project compression algorithms)
// =======================================================================

const _CIPHER_BASE = '../../../Cipher/';
const _cipherCache = {};
let _cipherFrameworkLoaded = false;

async function _loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function _loadCipherFramework() {
  if (_cipherFrameworkLoaded) return true;
  try {
    if (typeof AlgorithmFramework === 'undefined')
      await _loadScript(_CIPHER_BASE + 'AlgorithmFramework.js');
    if (typeof OpCodes === 'undefined')
      await _loadScript(_CIPHER_BASE + 'OpCodes.js');
    _cipherFrameworkLoaded = true;
    return true;
  } catch (_) {
    return false;
  }
}

async function _loadCipherAlgo(name, file) {
  if (_cipherCache[name]) return _cipherCache[name];
  try {
    if (!await _loadCipherFramework()) return null;
    await _loadScript(_CIPHER_BASE + 'algorithms/compression/' + file);
    const algo = AlgorithmFramework.Find(name);
    if (algo) {
      _cipherCache[name] = algo;
      return algo;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function _cipherProcess(algo, data, isInverse) {
  const inst = algo.CreateInstance(isInverse);
  inst.Feed(Array.from(data));
  const result = inst.Result();
  if (inst.Dispose) inst.Dispose();
  return new Uint8Array(result);
}

async function _cipherCompress(name, file, data) {
  const algo = await _loadCipherAlgo(name, file);
  if (!algo) return null;
  try { return _cipherProcess(algo, data, false); }
  catch (_) { return null; }
}

async function _cipherDecompress(name, file, data) {
  const algo = await _loadCipherAlgo(name, file);
  if (!algo) return null;
  try { return _cipherProcess(algo, data, true); }
  catch (_) { return null; }
}

// =======================================================================
// Compression helpers using Cipher algorithms
// =======================================================================

async function _tryDeflateCompress(raw) {
  try { return await compressDeflateRaw(raw); }
  catch (_) {
    const result = await _cipherCompress('DEFLATE', 'deflate.js', raw);
    return result;
  }
}

async function _tryDeflateDecompress(raw) {
  try { return await decompressDeflateRaw(raw); }
  catch (_) {
    return _cipherDecompress('DEFLATE', 'deflate.js', raw);
  }
}

async function _tryLzmaCompress(raw) {
  return _cipherCompress('LZMA', 'lzma.js', raw);
}

async function _tryLzmaDecompress(raw) {
  return _cipherDecompress('LZMA', 'lzma.js', raw);
}

async function _tryLzma2Compress(raw) {
  return _cipherCompress('XZ/LZMA2', 'xz-lzma2.js', raw);
}

async function _tryLzma2Decompress(raw) {
  return _cipherDecompress('XZ/LZMA2', 'xz-lzma2.js', raw);
}

async function _tryBzip2Compress(raw) {
  return _cipherCompress('BZIP2', 'bzip2.js', raw);
}

async function _tryBzip2Decompress(raw) {
  return _cipherDecompress('BZIP2', 'bzip2.js', raw);
}

async function _tryZstdCompress(raw) {
  return _cipherCompress('Zstandard', 'zstd.js', raw);
}

async function _tryZstdDecompress(raw) {
  return _cipherDecompress('Zstandard', 'zstd.js', raw);
}

async function _tryLzssCompress(raw) {
  return _cipherCompress('LZSS', 'lzss.js', raw);
}

async function _tryLzssDecompress(raw) {
  return _cipherDecompress('LZSS', 'lzss.js', raw);
}

async function _tryPpmdCompress(raw) {
  return _cipherCompress('PPMd (PPM with Dynamic Memory)', 'ppmd.js', raw);
}

async function _tryLzwDecompress(raw) {
  return _cipherDecompress('LZW (Lempel-Ziv-Welch)', 'lzw.js', raw);
}

async function _tryLzxDecompress(raw) {
  return _cipherDecompress('LZX', 'lzx.js', raw);
}

// =======================================================================
// Uint8Array concatenation
// =======================================================================

function concatUint8Arrays(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { result.set(a, off); off += a.length; }
  return result;
}

// =======================================================================
// LZW decompression (for .Z / compress format)
// =======================================================================

function _decompressLZW(data, maxBits, blockMode) {
  const CLEAR_CODE = 256;
  const output = [];
  let codeSize = 9;
  const dict = [];
  for (let i = 0; i < 256; ++i) dict.push([i]);
  if (blockMode) dict.push(null);
  let nextCode = blockMode ? CLEAR_CODE + 1 : 256;
  const maxCode = 1 << maxBits;

  let bitBuf = 0;
  let bitCount = 0;
  let inPos = 0;

  function getCode() {
    while (bitCount < codeSize) {
      if (inPos >= data.length) return -1;
      bitBuf |= data[inPos++] << bitCount;
      bitCount += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitCount -= codeSize;
    return code;
  }

  let prevEntry = null;
  for (;;) {
    const code = getCode();
    if (code === -1) break;
    if (blockMode && code === CLEAR_CODE) {
      dict.length = CLEAR_CODE + 1;
      nextCode = CLEAR_CODE + 1;
      codeSize = 9;
      prevEntry = null;
      continue;
    }
    let entry;
    if (code < dict.length && dict[code])
      entry = dict[code];
    else if (code === nextCode && prevEntry)
      entry = [...prevEntry, prevEntry[0]];
    else
      break;

    for (const b of entry) output.push(b);

    if (prevEntry && nextCode < maxCode) {
      dict[nextCode] = [...prevEntry, entry[0]];
      ++nextCode;
      if (nextCode >= (1 << codeSize) && codeSize < maxBits)
        ++codeSize;
    }
    prevEntry = entry;
  }
  return new Uint8Array(output);
}

// =======================================================================
// ZIP method compression helper
// =======================================================================

// Compresses data using a ZIP method number. Returns { method, data } where
// method may differ from requested if Cipher algorithm unavailable (falls back to Deflate or Store).
async function zipCompress(raw, method) {
  if (method === 0)
    return { method: 0, data: raw };

  if (method === 8 || method === 9) {
    const d = await _tryDeflateCompress(raw);
    return d ? { method: 8, data: d } : { method: 0, data: raw };
  }

  if (method === 14) {
    const result = await _tryLzmaCompress(raw);
    if (result && result.length < raw.length) return { method: 14, data: result };
    const d = await _tryDeflateCompress(raw);
    return d ? { method: 8, data: d } : { method: 0, data: raw };
  }

  if (method === 12) {
    const result = await _tryBzip2Compress(raw);
    if (result && result.length < raw.length) return { method: 12, data: result };
    const d = await _tryDeflateCompress(raw);
    return d ? { method: 8, data: d } : { method: 0, data: raw };
  }

  if (method === 93) {
    const result = await _tryZstdCompress(raw);
    if (result && result.length < raw.length) return { method: 93, data: result };
    const d = await _tryDeflateCompress(raw);
    return d ? { method: 8, data: d } : { method: 0, data: raw };
  }

  if (method === 98) {
    const result = await _tryPpmdCompress(raw);
    if (result && result.length < raw.length) return { method: 98, data: result };
    const d = await _tryDeflateCompress(raw);
    return d ? { method: 8, data: d } : { method: 0, data: raw };
  }

  // XZ and other methods: fall back to Deflate
  const d = await _tryDeflateCompress(raw);
  return d ? { method: 8, data: d } : { method: 0, data: raw };
}

// =======================================================================
// CDN script loader (kept for RAR only)
// =======================================================================

const _cdnCache = {};

async function loadCdnScript(urls) {
  const key = urls.join('|');
  if (_cdnCache[key] !== undefined) return _cdnCache[key];
  for (const url of urls) {
    try {
      await _loadScript(url);
      _cdnCache[key] = true;
      return true;
    } catch (_) {
      continue;
    }
  }
  _cdnCache[key] = false;
  return false;
}

// =======================================================================
// Little-endian read/write helpers
// =======================================================================

function readU16LE(buf, off) {
  return buf[off] | (buf[off + 1] << 8);
}

function readU32LE(buf, off) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

function writeU16LE(buf, off, val) {
  buf[off] = val & 0xFF;
  buf[off + 1] = (val >>> 8) & 0xFF;
}

function writeU32LE(buf, off, val) {
  buf[off] = val & 0xFF;
  buf[off + 1] = (val >>> 8) & 0xFF;
  buf[off + 2] = (val >>> 16) & 0xFF;
  buf[off + 3] = (val >>> 24) & 0xFF;
}

function readU16BE(buf, off) {
  return (buf[off] << 8) | buf[off + 1];
}

function readU32BE(buf, off) {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

// =======================================================================
// DOS date/time conversion
// =======================================================================

function dosToDate(dosDate, dosTime) {
  const day = dosDate & 0x1F;
  const month = ((dosDate >> 5) & 0x0F) - 1;
  const year = ((dosDate >> 9) & 0x7F) + 1980;
  const sec = (dosTime & 0x1F) * 2;
  const min = (dosTime >> 5) & 0x3F;
  const hour = (dosTime >> 11) & 0x1F;
  return new Date(year, month, day, hour, min, sec);
}

function dateToDos(date) {
  return {
    time: ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F),
    date: (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0x0F) << 5) | (date.getDate() & 0x1F)
  };
}

// Public API
A.IArchiveFormat = IArchiveFormat;
A.makeEntry = makeEntry;
A.escapeHtml = escapeHtml;
A.formatSize = formatSize;
A.formatDate = formatDate;
A.getFileExtension = getFileExtension;
A.stripExtension = stripExtension;
A.getFileName = getFileName;
A.normalizeArchivePath = normalizeArchivePath;
A.CRC32_TABLE = CRC32_TABLE;
A.computeCRC32 = computeCRC32;
A.crc32Hex = crc32Hex;
A.CRC16_TABLE = CRC16_TABLE;
A.computeCRC16 = computeCRC16;
A.compressGzip = compressGzip;
A.decompressGzip = decompressGzip;
A.compressDeflateRaw = compressDeflateRaw;
A.decompressDeflateRaw = decompressDeflateRaw;
A._loadScript = _loadScript;
A._cipherCompress = _cipherCompress;
A._cipherDecompress = _cipherDecompress;
A._tryDeflateCompress = _tryDeflateCompress;
A._tryDeflateDecompress = _tryDeflateDecompress;
A._tryLzmaCompress = _tryLzmaCompress;
A._tryLzmaDecompress = _tryLzmaDecompress;
A._tryLzma2Compress = _tryLzma2Compress;
A._tryLzma2Decompress = _tryLzma2Decompress;
A._tryBzip2Compress = _tryBzip2Compress;
A._tryBzip2Decompress = _tryBzip2Decompress;
A._tryZstdCompress = _tryZstdCompress;
A._tryZstdDecompress = _tryZstdDecompress;
A._tryLzssCompress = _tryLzssCompress;
A._tryLzssDecompress = _tryLzssDecompress;
A._tryPpmdCompress = _tryPpmdCompress;
A._tryLzwDecompress = _tryLzwDecompress;
A._tryLzxDecompress = _tryLzxDecompress;
A.concatUint8Arrays = concatUint8Arrays;
A._decompressLZW = _decompressLZW;
A.zipCompress = zipCompress;
A.loadCdnScript = loadCdnScript;
A.readU16LE = readU16LE;
A.readU32LE = readU32LE;
A.writeU16LE = writeU16LE;
A.writeU32LE = writeU32LE;
A.readU16BE = readU16BE;
A.readU32BE = readU32BE;
A.dosToDate = dosToDate;
A.dateToDos = dateToDos;

})();
