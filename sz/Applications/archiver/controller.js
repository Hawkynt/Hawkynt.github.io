;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

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

  function makeEntry(name, size, packed, modified, crc, isDirectory, encrypted, data, handler) {
    return { name, size, packed, modified, crc, isDirectory, encrypted, _data: data, _handler: handler };
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
  // Shared decompression utilities (BitReader, Huffman, LZW)
  // =======================================================================

  function concatUint8Arrays(arrays) {
    let total = 0;
    for (const a of arrays) total += a.length;
    const result = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { result.set(a, off); off += a.length; }
    return result;
  }

  class BitReader {
    constructor(data) {
      this._data = data;
      this._pos = 0;
      this._bitBuf = 0;
      this._bitCount = 0;
    }

    get pos() { return this._pos; }
    get bitsLeft() { return (this._data.length - this._pos) * 8 + this._bitCount; }

    getBits(n) {
      let result = 0;
      while (n > 0) {
        if (this._bitCount === 0) {
          this._bitBuf = this._pos < this._data.length ? this._data[this._pos++] : 0;
          this._bitCount = 8;
        }
        const take = Math.min(n, this._bitCount);
        result = (result << take) | ((this._bitBuf >>> (this._bitCount - take)) & ((1 << take) - 1));
        this._bitCount -= take;
        n -= take;
      }
      return result;
    }

    getBitsLE(n) {
      let result = 0;
      let shift = 0;
      while (n > 0) {
        if (this._bitCount === 0) {
          this._bitBuf = this._pos < this._data.length ? this._data[this._pos++] : 0;
          this._bitCount = 8;
        }
        const bit = (this._bitBuf >>> (8 - this._bitCount)) & 1;
        result |= (bit << shift);
        --this._bitCount;
        ++shift;
        --n;
      }
      return result;
    }

    peekBits(n) {
      const savedPos = this._pos;
      const savedBuf = this._bitBuf;
      const savedCount = this._bitCount;
      const result = this.getBits(n);
      this._pos = savedPos;
      this._bitBuf = savedBuf;
      this._bitCount = savedCount;
      return result;
    }
  }

  function buildHuffmanTable(lengths, numCodes) {
    const MAX_BITS = 16;
    const counts = new Uint16Array(MAX_BITS + 1);
    for (let i = 0; i < numCodes; ++i)
      if (lengths[i]) ++counts[lengths[i]];

    const nextCode = new Uint16Array(MAX_BITS + 1);
    let code = 0;
    for (let bits = 1; bits <= MAX_BITS; ++bits) {
      code = (code + counts[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const table = new Int32Array(numCodes * 2);
    for (let i = 0; i < numCodes; ++i) {
      if (lengths[i]) {
        table[i * 2] = lengths[i];
        table[i * 2 + 1] = nextCode[lengths[i]]++;
      }
    }
    return table;
  }

  function decodeHuffman(br, table, numCodes) {
    let code = 0;
    for (let bits = 1; bits <= 16; ++bits) {
      code = (code << 1) | br.getBits(1);
      for (let i = 0; i < numCodes; ++i)
        if (table[i * 2] === bits && table[i * 2 + 1] === code)
          return i;
    }
    return 0;
  }

  function buildHuffmanLookup(lengths, numCodes) {
    const MAX_BITS = 16;
    const counts = new Uint16Array(MAX_BITS + 1);
    for (let i = 0; i < numCodes; ++i)
      if (lengths[i]) ++counts[lengths[i]];

    const nextCode = new Uint16Array(MAX_BITS + 1);
    let code = 0;
    for (let bits = 1; bits <= MAX_BITS; ++bits) {
      code = (code + counts[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const symbols = [];
    for (let i = 0; i < numCodes; ++i)
      if (lengths[i])
        symbols.push({ symbol: i, bits: lengths[i], code: nextCode[lengths[i]]++ });

    symbols.sort((a, b) => a.bits - b.bits || a.code - b.code);
    return symbols;
  }

  function decodeHuffmanLookup(br, lookup) {
    let code = 0;
    let bits = 0;
    let idx = 0;
    for (let b = 1; b <= 16; ++b) {
      code = (code << 1) | br.getBits(1);
      ++bits;
      while (idx < lookup.length && lookup[idx].bits === bits) {
        if (lookup[idx].code === code) return lookup[idx].symbol;
        ++idx;
      }
    }
    return 0;
  }

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
  // ZipCrypto
  // =======================================================================

  class ZipCrypto {
    constructor() {
      this.keys = new Uint32Array(3);
    }

    _updateKeys(byte) {
      this.keys[0] = this._crc32Update(this.keys[0], byte);
      this.keys[1] = ((this.keys[1] + (this.keys[0] & 0xFF)) >>> 0);
      this.keys[1] = ((Math.imul(this.keys[1], 134775813) + 1) >>> 0);
      this.keys[2] = this._crc32Update(this.keys[2], (this.keys[1] >>> 24) & 0xFF);
    }

    _crc32Update(crc, byte) {
      return (CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)) >>> 0;
    }

    _decryptByte() {
      const temp = (this.keys[2] | 2) >>> 0;
      return ((Math.imul(temp, (temp ^ 1)) >>> 8) & 0xFF);
    }

    initKeys(password) {
      this.keys[0] = 305419896;
      this.keys[1] = 591751049;
      this.keys[2] = 878082192;
      for (let i = 0; i < password.length; ++i)
        this._updateKeys(password.charCodeAt(i));
    }

    decrypt(data) {
      const result = new Uint8Array(data.length);
      for (let i = 0; i < data.length; ++i) {
        const keyByte = this._decryptByte();
        result[i] = data[i] ^ keyByte;
        this._updateKeys(result[i]);
      }
      return result;
    }

    encrypt(data) {
      const result = new Uint8Array(data.length);
      for (let i = 0; i < data.length; ++i) {
        const keyByte = this._decryptByte();
        result[i] = data[i] ^ keyByte;
        this._updateKeys(data[i]);
      }
      return result;
    }
  }

  // =======================================================================
  // FORMAT: ZIP
  // =======================================================================

  class ZipFormat extends IArchiveFormat {
    static get id() { return 'zip'; }
    static get displayName() { return 'ZIP Archive'; }
    static get extensions() { return ['zip']; }
    static get canCreate() { return true; }
    static get supportsEncryption() { return true; }

    static getCreateOptions() {
      return [
        { id: 'method', label: 'Method', type: 'select', options: [
          { value: '0', label: 'Store' },
          { value: '8', label: 'Deflate' },
          { value: '9', label: 'Deflate64' },
          { value: '12', label: 'BZip2' },
          { value: '14', label: 'LZMA' },
          { value: '93', label: 'ZStandard' },
          { value: '95', label: 'XZ' },
          { value: '98', label: 'PPMd' }
        ], default: '8' },
        { id: 'level', label: 'Level', type: 'select', options: [
          { value: '1', label: '1 (Fastest)' }, { value: '3', label: '3' }, { value: '5', label: '5' },
          { value: '6', label: '6 (Normal)' }, { value: '7', label: '7' }, { value: '9', label: '9 (Best)' }
        ], default: '6', visibleWhen: { method: '8|9|12|14|93|95|98' } },
        { id: 'dictionary', label: 'Dictionary', type: 'select', options: [
          { value: '65536', label: '64 KB' }, { value: '262144', label: '256 KB' },
          { value: '1048576', label: '1 MB' }, { value: '4194304', label: '4 MB' },
          { value: '16777216', label: '16 MB' }, { value: '33554432', label: '32 MB' },
          { value: '67108864', label: '64 MB' }
        ], default: '4194304', visibleWhen: { method: '14|93|95' } },
        { id: 'wordSize', label: 'Word size', type: 'select', options: [
          { value: '8', label: '8' }, { value: '16', label: '16' },
          { value: '32', label: '32' }, { value: '64', label: '64' },
          { value: '128', label: '128' }, { value: '256', label: '256' }
        ], default: '32', visibleWhen: { method: '14|98' } },
        { id: 'encryption', label: 'Encryption', type: 'select', options: [
          { value: 'none', label: 'None' }, { value: 'zipcrypto', label: 'ZipCrypto' }, { value: 'aes256', label: 'AES-256' }
        ], default: 'none' }
      ];
    }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      return (bytes[0] === 0x50 && bytes[1] === 0x4B && (bytes[2] === 0x03 || bytes[2] === 0x05) && (bytes[3] === 0x04 || bytes[3] === 0x06));
    }

    async parse(bytes, _fileName, password) {
      const hasEncrypted = this._hasEncryptedEntries(bytes);
      if (hasEncrypted && password)
        return this._parseEncrypted(bytes, password);

      if (hasEncrypted && !password)
        throw { needPassword: true };

      const jszip = await JSZip.loadAsync(bytes);
      const entries = [];
      const handler = this;
      jszip.forEach((relativePath, zipEntry) => {
        const data = zipEntry.dir ? null : zipEntry;
        entries.push(makeEntry(
          normalizeArchivePath(relativePath),
          zipEntry._data ? zipEntry._data.uncompressedSize : 0,
          zipEntry._data ? zipEntry._data.compressedSize : 0,
          zipEntry.date,
          '',
          zipEntry.dir,
          false,
          data,
          handler
        ));
      });

      for (const entry of entries) {
        if (!entry.isDirectory && entry._data) {
          try {
            const raw = await entry._data.async('uint8array');
            entry.crc = crc32Hex(raw);
            entry.size = raw.length;
            entry._data = raw;
          } catch (_) {
            entry._data = null;
          }
        }
      }
      return entries;
    }

    _hasEncryptedEntries(bytes) {
      let off = 0;
      while (off + 30 <= bytes.length) {
        if (bytes[off] !== 0x50 || bytes[off + 1] !== 0x4B || bytes[off + 2] !== 0x03 || bytes[off + 3] !== 0x04)
          break;
        const flags = readU16LE(bytes, off + 6);
        if (flags & 1) return true;
        const compSize = readU32LE(bytes, off + 18);
        const nameLen = readU16LE(bytes, off + 26);
        const extraLen = readU16LE(bytes, off + 28);
        off += 30 + nameLen + extraLen + compSize;
      }
      return false;
    }

    _parseEncrypted(bytes, password) {
      const entries = [];
      const handler = this;
      let off = 0;

      while (off + 30 <= bytes.length) {
        if (bytes[off] !== 0x50 || bytes[off + 1] !== 0x4B || bytes[off + 2] !== 0x03 || bytes[off + 3] !== 0x04)
          break;

        const method = readU16LE(bytes, off + 8);
        const flags = readU16LE(bytes, off + 6);
        const encrypted = !!(flags & 1);
        const dosTime = readU16LE(bytes, off + 12);
        const dosDate = readU16LE(bytes, off + 14);
        const crc = readU32LE(bytes, off + 16);
        const compSize = readU32LE(bytes, off + 18);
        const uncompSize = readU32LE(bytes, off + 22);
        const nameLen = readU16LE(bytes, off + 26);
        const extraLen = readU16LE(bytes, off + 28);

        const nameBytes = bytes.subarray(off + 30, off + 30 + nameLen);
        const name = new TextDecoder().decode(nameBytes);
        const isDir = name.endsWith('/');
        const mod = dosToDate(dosDate, dosTime);

        const dataStart = off + 30 + nameLen + extraLen;
        const rawData = bytes.slice(dataStart, dataStart + compSize);

        let fileData = null;
        if (!isDir) {
          if (encrypted && method === 99) {
            fileData = { aesEncrypted: rawData, size: uncompSize, extraData: bytes.subarray(off + 30, off + 30 + nameLen + extraLen), password };
          } else if (encrypted) {
            const crypto = new ZipCrypto();
            crypto.initKeys(password);
            const decrypted = crypto.decrypt(rawData);
            const check = decrypted[11];
            if (check !== ((crc >>> 24) & 0xFF) && check !== ((dosTime >>> 8) & 0xFF))
              throw new Error('Wrong password');
            const payload = decrypted.subarray(12);
            if (method === 8)
              fileData = { deflated: payload, size: uncompSize };
            else
              fileData = payload;
          } else {
            if (method === 8)
              fileData = { deflated: rawData, size: uncompSize };
            else
              fileData = rawData;
          }
        }

        entries.push(makeEntry(
          normalizeArchivePath(name), uncompSize, compSize, mod,
          crc.toString(16).toUpperCase().padStart(8, '0'),
          isDir, encrypted, fileData, handler
        ));

        off = dataStart + compSize;
      }

      return entries;
    }

    async build(entries, password, options) {
      const method = parseInt((options && options.method) || '8', 10);
      const level = parseInt((options && options.level) || '6', 10);
      const encryption = (options && options.encryption) || (password ? 'zipcrypto' : 'none');

      if (encryption === 'aes256' && password)
        return this._buildAES256Encrypted(entries, password, method, level);

      if ((encryption === 'zipcrypto' && password) || password)
        return this._buildEncrypted(entries, password, method, level);

      if (method === 0 || method === 8)  {
        const zip = new JSZip();
        for (const entry of entries) {
          if (entry.isDirectory)
            zip.folder(entry.name);
          else if (entry._data)
            zip.file(entry.name, entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry), { date: entry.modified || new Date() });
        }
        const compression = method === 0 ? 'STORE' : 'DEFLATE';
        return new Uint8Array(await zip.generateAsync({ type: 'arraybuffer', compression, compressionOptions: { level } }));
      }

      return this._buildRawZip(entries, method);
    }

    async _buildRawZip(entries, requestedMethod) {
      const parts = [];
      const centralDir = [];
      let localOff = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const raw = entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry);
        if (!raw) continue;

        const crc = computeCRC32(raw);
        const { method: compMethod, data: compressed } = await zipCompress(raw, requestedMethod);

        const nameBytes = new TextEncoder().encode(entry.name);
        const mod = entry.modified || new Date();
        const dosTime = dateToDos(mod);

        const local = new Uint8Array(30 + nameBytes.length);
        local[0] = 0x50; local[1] = 0x4B; local[2] = 0x03; local[3] = 0x04;
        writeU16LE(local, 4, 20);
        writeU16LE(local, 8, compMethod);
        writeU16LE(local, 12, dosTime.time);
        writeU16LE(local, 14, dosTime.date);
        writeU32LE(local, 16, crc);
        writeU32LE(local, 18, compressed.length);
        writeU32LE(local, 22, raw.length);
        writeU16LE(local, 26, nameBytes.length);
        local.set(nameBytes, 30);

        const cd = new Uint8Array(46 + nameBytes.length);
        cd[0] = 0x50; cd[1] = 0x4B; cd[2] = 0x01; cd[3] = 0x02;
        writeU16LE(cd, 4, 20); writeU16LE(cd, 6, 20);
        writeU16LE(cd, 10, compMethod);
        writeU16LE(cd, 14, dosTime.time);
        writeU16LE(cd, 16, dosTime.date);
        writeU32LE(cd, 18, crc);
        writeU32LE(cd, 22, compressed.length);
        writeU32LE(cd, 26, raw.length);
        writeU16LE(cd, 30, nameBytes.length);
        writeU32LE(cd, 42, localOff);
        cd.set(nameBytes, 46);

        parts.push(local, compressed);
        centralDir.push(cd);
        localOff += local.length + compressed.length;
      }

      const cdStart = localOff;
      let cdSize = 0;
      for (const c of centralDir) cdSize += c.length;
      const eocd = new Uint8Array(22);
      eocd[0] = 0x50; eocd[1] = 0x4B; eocd[2] = 0x05; eocd[3] = 0x06;
      writeU16LE(eocd, 8, centralDir.length);
      writeU16LE(eocd, 10, centralDir.length);
      writeU32LE(eocd, 12, cdSize);
      writeU32LE(eocd, 16, cdStart);

      const total = localOff + cdSize + 22;
      const result = new Uint8Array(total);
      let pos = 0;
      for (const p of parts) { result.set(p, pos); pos += p.length; }
      for (const c of centralDir) { result.set(c, pos); pos += c.length; }
      result.set(eocd, pos);
      return result;
    }

    async _buildAES256Encrypted(entries, password, method, level) {
      const parts = [];
      const centralDir = [];
      let localOff = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const raw = entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry);
        if (!raw) continue;

        const crc = computeCRC32(raw);
        const { method: actualMethod, data: compressed } = await zipCompress(raw, method);

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const derived = new Uint8Array(await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-1' }, keyMaterial, (32 + 32 + 2) * 8
        ));
        const aesKey = derived.slice(0, 32);
        const hmacKey = derived.slice(32, 64);
        const verification = derived.slice(64, 66);

        const cryptoKey = await crypto.subtle.importKey('raw', aesKey, 'AES-CTR', false, ['encrypt']);
        const counter = new Uint8Array(16);
        counter[0] = 1;
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CTR', counter, length: 128 }, cryptoKey, compressed));

        const hmacCryptoKey = await crypto.subtle.importKey('raw', hmacKey, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
        const authFull = new Uint8Array(await crypto.subtle.sign('HMAC', hmacCryptoKey, encrypted));
        const authCode = authFull.slice(0, 10);

        const nameBytes = new TextEncoder().encode(entry.name);
        const mod = entry.modified || new Date();
        const dosTime = dateToDos(mod);

        const aeExtra = new Uint8Array(11);
        writeU16LE(aeExtra, 0, 0x9901);
        writeU16LE(aeExtra, 2, 7);
        writeU16LE(aeExtra, 4, 2);
        aeExtra[6] = 0x41; aeExtra[7] = 0x45;
        aeExtra[8] = 3;
        writeU16LE(aeExtra, 9, actualMethod);

        const fileDataLen = salt.length + verification.length + encrypted.length + authCode.length;

        const local = new Uint8Array(30 + nameBytes.length + aeExtra.length);
        local[0] = 0x50; local[1] = 0x4B; local[2] = 0x03; local[3] = 0x04;
        writeU16LE(local, 4, 51);
        writeU16LE(local, 6, 1);
        writeU16LE(local, 8, 99);
        writeU16LE(local, 12, dosTime.time);
        writeU16LE(local, 14, dosTime.date);
        writeU32LE(local, 16, crc);
        writeU32LE(local, 18, fileDataLen);
        writeU32LE(local, 22, raw.length);
        writeU16LE(local, 26, nameBytes.length);
        writeU16LE(local, 28, aeExtra.length);
        local.set(nameBytes, 30);
        local.set(aeExtra, 30 + nameBytes.length);

        const cd = new Uint8Array(46 + nameBytes.length + aeExtra.length);
        cd[0] = 0x50; cd[1] = 0x4B; cd[2] = 0x01; cd[3] = 0x02;
        writeU16LE(cd, 4, 51);
        writeU16LE(cd, 6, 51);
        writeU16LE(cd, 8, 1);
        writeU16LE(cd, 10, 99);
        writeU16LE(cd, 14, dosTime.time);
        writeU16LE(cd, 16, dosTime.date);
        writeU32LE(cd, 18, crc);
        writeU32LE(cd, 22, fileDataLen);
        writeU32LE(cd, 26, raw.length);
        writeU16LE(cd, 30, nameBytes.length);
        writeU16LE(cd, 32, aeExtra.length);
        writeU32LE(cd, 42, localOff);
        cd.set(nameBytes, 46);
        cd.set(aeExtra, 46 + nameBytes.length);

        parts.push(local, salt, verification, encrypted, authCode);
        centralDir.push(cd);
        localOff += local.length + fileDataLen;
      }

      const cdStart = localOff;
      let cdSize = 0;
      for (const c of centralDir) cdSize += c.length;
      const eocd = new Uint8Array(22);
      eocd[0] = 0x50; eocd[1] = 0x4B; eocd[2] = 0x05; eocd[3] = 0x06;
      writeU16LE(eocd, 8, centralDir.length);
      writeU16LE(eocd, 10, centralDir.length);
      writeU32LE(eocd, 12, cdSize);
      writeU32LE(eocd, 16, cdStart);

      const total = localOff + cdSize + 22;
      const result = new Uint8Array(total);
      let pos = 0;
      for (const p of parts) { result.set(p, pos); pos += p.length; }
      for (const c of centralDir) { result.set(c, pos); pos += c.length; }
      result.set(eocd, pos);
      return result;
    }

    async _buildEncrypted(entries, password, zipMethod, level) {
      const parts = [];
      const centralDir = [];
      let localOff = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const raw = entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry);
        if (!raw) continue;

        const crc = computeCRC32(raw);
        const { method: compMethod, data: compressed } = await zipCompress(raw, zipMethod);

        const zc = new ZipCrypto();
        zc.initKeys(password);
        const header = new Uint8Array(12);
        for (let i = 0; i < 11; ++i)
          header[i] = Math.floor(Math.random() * 256);
        header[11] = (crc >>> 24) & 0xFF;
        const encHeader = zc.encrypt(header);
        const encData = zc.encrypt(compressed);

        const nameBytes = new TextEncoder().encode(entry.name);
        const mod = entry.modified || new Date();
        const dosTime = dateToDos(mod);
        const encCompSize = 12 + encData.length;

        const local = new Uint8Array(30 + nameBytes.length);
        local[0] = 0x50; local[1] = 0x4B; local[2] = 0x03; local[3] = 0x04;
        writeU16LE(local, 4, 20);
        writeU16LE(local, 6, 1);
        writeU16LE(local, 8, compMethod);
        writeU16LE(local, 12, dosTime.time);
        writeU16LE(local, 14, dosTime.date);
        writeU32LE(local, 16, crc);
        writeU32LE(local, 18, encCompSize);
        writeU32LE(local, 22, raw.length);
        writeU16LE(local, 26, nameBytes.length);
        local.set(nameBytes, 30);

        const cd = new Uint8Array(46 + nameBytes.length);
        cd[0] = 0x50; cd[1] = 0x4B; cd[2] = 0x01; cd[3] = 0x02;
        writeU16LE(cd, 4, 20);
        writeU16LE(cd, 6, 20);
        writeU16LE(cd, 8, 1);
        writeU16LE(cd, 10, compMethod);
        writeU16LE(cd, 14, dosTime.time);
        writeU16LE(cd, 16, dosTime.date);
        writeU32LE(cd, 18, crc);
        writeU32LE(cd, 22, encCompSize);
        writeU32LE(cd, 26, raw.length);
        writeU16LE(cd, 30, nameBytes.length);
        writeU32LE(cd, 42, localOff);
        cd.set(nameBytes, 46);

        parts.push(local, encHeader, encData);
        centralDir.push(cd);
        localOff += local.length + encHeader.length + encData.length;
      }

      const cdStart = localOff;
      let cdSize = 0;
      for (const c of centralDir) cdSize += c.length;

      const eocd = new Uint8Array(22);
      eocd[0] = 0x50; eocd[1] = 0x4B; eocd[2] = 0x05; eocd[3] = 0x06;
      writeU16LE(eocd, 8, centralDir.length);
      writeU16LE(eocd, 10, centralDir.length);
      writeU32LE(eocd, 12, cdSize);
      writeU32LE(eocd, 16, cdStart);

      const total = localOff + cdSize + 22;
      const result = new Uint8Array(total);
      let pos = 0;
      for (const p of parts) { result.set(p, pos); pos += p.length; }
      for (const c of centralDir) { result.set(c, pos); pos += c.length; }
      result.set(eocd, pos);
      return result;
    }

    async _resolveData(entry) {
      if (entry._data && entry._data.deflated) {
        try { return await decompressDeflateRaw(entry._data.deflated); } catch (_) { return null; }
      }
      if (entry._data && entry._data.aesEncrypted) {
        return resolveEntryData(entry);
      }
      return entry._data instanceof Uint8Array ? entry._data : null;
    }
  }

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

  // =======================================================================
  // FORMAT: TAR
  // =======================================================================

  class TarFormat extends IArchiveFormat {
    static get id() { return 'tar'; }
    static get displayName() { return 'TAR Archive'; }
    static get extensions() { return ['tar']; }
    static get canCreate() { return true; }

    static detect(bytes, fileName) {
      if (bytes.length >= 263)
        return bytes[257] === 0x75 && bytes[258] === 0x73 && bytes[259] === 0x74 && bytes[260] === 0x61 && bytes[261] === 0x72;
      const ext = getFileExtension(fileName || '');
      return ext === 'tar';
    }

    async parse(bytes, _fileName, _password) {
      const entries = [];
      const handler = this;
      let off = 0;

      while (off + 512 <= bytes.length) {
        const header = bytes.subarray(off, off + 512);
        if (this._isZeroBlock(header)) break;

        const name = this._readString(header, 0, 100);
        const prefix = this._readString(header, 345, 155);
        const fullName = prefix ? prefix + '/' + name : name;
        const size = this._readOctal(header, 124, 12);
        const mtime = this._readOctal(header, 136, 12);
        const typeFlag = header[156];
        const isDir = typeFlag === 53 || fullName.endsWith('/');
        const mod = mtime > 0 ? new Date(mtime * 1000) : null;

        off += 512;
        const dataSize = isDir ? 0 : size;
        const data = dataSize > 0 ? bytes.slice(off, off + dataSize) : null;
        const paddedSize = Math.ceil(dataSize / 512) * 512;

        entries.push(makeEntry(
          normalizeArchivePath(fullName), dataSize, dataSize, mod,
          data ? crc32Hex(data) : '', isDir, false, data, handler
        ));

        off += paddedSize;
      }
      return entries;
    }

    async build(entries, _password, _options) {
      const parts = [];

      for (const entry of entries) {
        const nameBytes = new TextEncoder().encode(entry.name);
        const data = entry.isDirectory ? null : (entry._data instanceof Uint8Array ? entry._data : null);
        const dataSize = data ? data.length : 0;

        const header = new Uint8Array(512);

        let name = entry.name;
        let prefix = '';
        if (nameBytes.length > 100) {
          const slash = entry.name.lastIndexOf('/', 155);
          if (slash > 0) {
            prefix = entry.name.substring(0, slash);
            name = entry.name.substring(slash + 1);
          }
        }

        this._writeString(header, 0, name, 100);
        this._writeOctal(header, 100, entry.isDirectory ? 0o755 : 0o644, 8);
        this._writeOctal(header, 108, 0, 8);
        this._writeOctal(header, 116, 0, 8);
        this._writeOctal(header, 124, dataSize, 12);
        const mtime = entry.modified ? Math.floor(entry.modified.getTime() / 1000) : 0;
        this._writeOctal(header, 136, mtime, 12);
        header[156] = entry.isDirectory ? 53 : 48;
        header[257] = 0x75; header[258] = 0x73; header[259] = 0x74; header[260] = 0x61; header[261] = 0x72;
        header[262] = 0x20; header[263] = 0x20;
        if (prefix)
          this._writeString(header, 345, prefix, 155);

        this._writeString(header, 148, '        ', 8);
        let checksum = 0;
        for (let i = 0; i < 512; ++i) checksum += header[i];
        this._writeOctal(header, 148, checksum, 7);
        header[155] = 0x20;

        parts.push(header);
        if (data && dataSize > 0) {
          parts.push(data);
          const pad = 512 - (dataSize % 512);
          if (pad < 512)
            parts.push(new Uint8Array(pad));
        }
      }

      parts.push(new Uint8Array(1024));

      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let pos = 0;
      for (const p of parts) { result.set(p, pos); pos += p.length; }
      return result;
    }

    _isZeroBlock(block) {
      for (let i = 0; i < 512; ++i)
        if (block[i] !== 0) return false;
      return true;
    }

    _readString(buf, off, len) {
      let end = off;
      while (end < off + len && buf[end] !== 0) ++end;
      return new TextDecoder().decode(buf.subarray(off, end));
    }

    _readOctal(buf, off, len) {
      const s = this._readString(buf, off, len).trim();
      return s ? parseInt(s, 8) || 0 : 0;
    }

    _writeString(buf, off, str, len) {
      const bytes = new TextEncoder().encode(str);
      for (let i = 0; i < len && i < bytes.length; ++i)
        buf[off + i] = bytes[i];
    }

    _writeOctal(buf, off, val, len) {
      const s = val.toString(8).padStart(len - 1, '0');
      this._writeString(buf, off, s, len - 1);
      buf[off + len - 1] = 0;
    }
  }

  // =======================================================================
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

  // =======================================================================
  // FORMAT: TAR.GZ / .tgz
  // =======================================================================

  class TarGzFormat extends IArchiveFormat {
    static get id() { return 'targz'; }
    static get displayName() { return 'TAR.GZ Archive'; }
    static get extensions() { return ['tar.gz', 'tgz']; }
    static get canCreate() { return true; }

    static detect(bytes, fileName) {
      if (bytes.length < 2) return false;
      if (bytes[0] !== 0x1F || bytes[1] !== 0x8B) return false;
      const ext = getFileExtension(fileName || '');
      const lower = (fileName || '').toLowerCase();
      return ext === 'tgz' || lower.endsWith('.tar.gz');
    }

    async parse(bytes, fileName, password) {
      const tarData = await decompressGzip(bytes);
      const tarHandler = new TarFormat();
      const entries = await tarHandler.parse(tarData, fileName, password);
      const handler = this;
      for (const e of entries) e._handler = handler;
      return entries;
    }

    async build(entries, password, _options) {
      const tarHandler = new TarFormat();
      const tarData = await tarHandler.build(entries, password, _options);
      return compressGzip(tarData);
    }
  }

  // =======================================================================
  // FORMAT: Base64
  // =======================================================================

  class Base64Format extends IArchiveFormat {
    static get id() { return 'base64'; }
    static get displayName() { return 'Base64 Encoded'; }
    static get extensions() { return ['b64']; }
    static get canCreate() { return true; }

    static detect(bytes, fileName) {
      const ext = getFileExtension(fileName || '');
      if (ext === 'b64') return true;
      if (bytes.length > 4 && bytes.length < 1048576) {
        const text = new TextDecoder().decode(bytes).trim();
        return /^[A-Za-z0-9+/\r\n]+=*$/.test(text);
      }
      return false;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const text = new TextDecoder().decode(bytes).trim().replace(/\s/g, '');
      const binStr = atob(text);
      const data = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; ++i)
        data[i] = binStr.charCodeAt(i);
      const innerName = stripExtension(getFileName(fileName || 'file.b64'));
      return [makeEntry(innerName, data.length, bytes.length, null, crc32Hex(data), false, false, data, handler)];
    }

    async build(entries, _password, _options) {
      const entry = entries.find(e => !e.isDirectory);
      if (!entry || !entry._data) return new Uint8Array(0);
      const data = entry._data instanceof Uint8Array ? entry._data : null;
      if (!data) return new Uint8Array(0);
      let binStr = '';
      const CHUNK = 8192;
      for (let i = 0; i < data.length; i += CHUNK)
        binStr += String.fromCharCode.apply(null, data.subarray(i, i + CHUNK));
      const b64 = btoa(binStr);
      const lines = [];
      for (let i = 0; i < b64.length; i += 76)
        lines.push(b64.substring(i, i + 76));
      return new TextEncoder().encode(lines.join('\r\n') + '\r\n');
    }
  }

  // =======================================================================
  // FORMAT: RAR (read-only)
  // =======================================================================

  const _UNRAR_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/js-unrar@latest/dist/js-unrar.min.js',
    'https://cdn.jsdelivr.net/npm/unrar.js@latest/dist/unrar.min.js',
  ];

  class RarFormat extends IArchiveFormat {
    static get id() { return 'rar'; }
    static get displayName() { return 'RAR Archive'; }
    static get extensions() { return ['rar']; }
    static get supportsEncryption() { return true; }

    static detect(bytes, _fileName) {
      if (bytes.length < 7) return false;
      return bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21 && bytes[4] === 0x1A && bytes[5] === 0x07;
    }

    async parse(bytes, _fileName, password) {
      const handler = this;
      const loaded = await loadCdnScript(_UNRAR_CDN_URLS);

      if (loaded) {
        try {
          return await this._parseWithLib(bytes, password, handler);
        } catch (e) {
          if (e && e.needPassword) throw e;
        }
      }

      return this._parseHeaders(bytes, handler);
    }

    async _parseWithLib(bytes, password, handler) {
      const opts = {};
      if (password) opts.password = password;

      let extractFn = null;
      if (typeof window.unrar === 'function')
        extractFn = window.unrar;
      else if (typeof window.UnrarJS !== 'undefined' && typeof window.UnrarJS.unrar === 'function')
        extractFn = window.UnrarJS.unrar;
      else if (typeof window.Unrar !== 'undefined')
        extractFn = (data, opts) => new window.Unrar(data, opts).entries || [];

      if (!extractFn)
        return this._parseHeaders(bytes, handler);

      const result = await extractFn(bytes.buffer || bytes, opts);
      const entries = [];

      if (Array.isArray(result)) {
        for (const item of result) {
          const name = normalizeArchivePath(item.name || item.filename || '');
          const isDir = item.is_directory || name.endsWith('/');
          const data = item.fileData || item.data || null;
          const raw = data ? (data instanceof Uint8Array ? data : new Uint8Array(data)) : null;
          entries.push(makeEntry(
            name, raw ? raw.length : (item.size || 0),
            item.packed || item.compressedSize || 0,
            item.mtime ? new Date(item.mtime * 1000) : null,
            raw ? crc32Hex(raw) : '',
            isDir, !!item.encrypted, raw, handler
          ));
        }
      }
      return entries;
    }

    _parseHeaders(bytes, handler) {
      const entries = [];
      const isV5 = bytes.length >= 8 && bytes[6] === 0x01 && bytes[7] === 0x00;

      if (isV5)
        return this._parseRar5Headers(bytes, handler);

      let off = 7;
      while (off + 7 <= bytes.length) {
        const headCrc = readU16LE(bytes, off);
        const headType = bytes[off + 2];
        const headFlags = readU16LE(bytes, off + 3);
        const headSize = readU16LE(bytes, off + 5);

        if (headSize < 7 || off + headSize > bytes.length) break;

        if (headType === 0x74) {
          const compSize = readU32LE(bytes, off + 7);
          const uncompSize = readU32LE(bytes, off + 11);
          const method = bytes[off + 18];
          const nameLen = readU16LE(bytes, off + 19);
          const nameStart = off + 32;
          const nameEnd = Math.min(nameStart + nameLen, bytes.length);
          const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));
          const isDir = !!(headFlags & 0x20);
          const encrypted = !!(headFlags & 0x04);

          let data = null;
          if (!isDir && method === 0x30 && !encrypted) {
            const dataStart = off + headSize;
            if (dataStart + compSize <= bytes.length)
              data = bytes.slice(dataStart, dataStart + compSize);
          }

          entries.push(makeEntry(
            normalizeArchivePath(name), uncompSize, compSize, null, '',
            isDir, encrypted, data, handler
          ));

          off += headSize + compSize;
        } else {
          let totalSize = headSize;
          if (headFlags & 0x8000)
            totalSize += readU32LE(bytes, off + 7);
          off += totalSize;
        }
      }
      return entries;
    }

    _parseRar5Headers(bytes, handler) {
      const entries = [];
      let off = 8;

      while (off + 4 <= bytes.length) {
        const headerCrc = readU32LE(bytes, off);
        off += 4;
        if (off >= bytes.length) break;

        const { value: headerSize, bytesRead: hsBytes } = this._readVInt(bytes, off);
        off += hsBytes;
        if (off >= bytes.length) break;

        const headerEnd = off + headerSize;
        const { value: headerType, bytesRead: htBytes } = this._readVInt(bytes, off);
        off += htBytes;
        const { value: headerFlags, bytesRead: hfBytes } = this._readVInt(bytes, off);
        off += hfBytes;

        let extraAreaSize = 0, dataSize = 0;
        if (headerFlags & 0x0001) {
          const r = this._readVInt(bytes, off);
          extraAreaSize = r.value; off += r.bytesRead;
        }
        if (headerFlags & 0x0002) {
          const r = this._readVInt(bytes, off);
          dataSize = r.value; off += r.bytesRead;
        }

        if (headerType === 2) {
          const { value: fileFlags, bytesRead: ffBytes } = this._readVInt(bytes, off);
          let pos = off + ffBytes;
          const { value: uncompSize, bytesRead: usBytes } = this._readVInt(bytes, pos);
          pos += usBytes;
          const { value: attributes, bytesRead: atBytes } = this._readVInt(bytes, pos);
          pos += atBytes;

          let mtime = null;
          if (fileFlags & 0x0002) {
            if (pos + 4 <= headerEnd) {
              const unixTime = readU32LE(bytes, pos);
              mtime = new Date(unixTime * 1000);
              pos += 4;
            }
          }

          let dataCRC = 0;
          if (fileFlags & 0x0008) {
            if (pos + 4 <= headerEnd) {
              dataCRC = readU32LE(bytes, pos);
              pos += 4;
            }
          }

          const { value: comprInfo, bytesRead: ciBytes } = this._readVInt(bytes, pos);
          pos += ciBytes;
          const { value: hostOS, bytesRead: hoBytes } = this._readVInt(bytes, pos);
          pos += hoBytes;
          const { value: nameLen, bytesRead: nlBytes } = this._readVInt(bytes, pos);
          pos += nlBytes;
          const name = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(pos, pos + nameLen));
          pos += nameLen;

          if (extraAreaSize > 0 && pos < headerEnd) {
            const extraEnd = pos + extraAreaSize;
            let ePos = pos;
            while (ePos + 2 < extraEnd && ePos < headerEnd) {
              const { value: recSize, bytesRead: rsBytes } = this._readVInt(bytes, ePos);
              ePos += rsBytes;
              const recEnd = ePos + recSize;
              if (recEnd > headerEnd) break;
              const recType = bytes[ePos];
              if (recType === 0x03 && !mtime) {
                const flags = ePos + 1 < recEnd ? bytes[ePos + 1] : 0;
                const isUnix = !!(flags & 0x01);
                let tOff = ePos + 2;
                if (flags & 0x02) {
                  if (isUnix && tOff + 4 <= recEnd) {
                    mtime = new Date(readU32LE(bytes, tOff) * 1000);
                  } else if (!isUnix && tOff + 8 <= recEnd) {
                    const lo = readU32LE(bytes, tOff);
                    const hi = readU32LE(bytes, tOff + 4);
                    const ft = lo + hi * 0x100000000;
                    mtime = new Date((ft - 116444736000000000) / 10000);
                  }
                }
              }
              ePos = recEnd;
            }
          }

          const isDir = !!(fileFlags & 0x0001);
          const encrypted = !!(fileFlags & 0x0004);
          const method = (comprInfo >> 7) & 0x07;

          let data = null;
          if (!isDir && method === 0 && !encrypted && dataSize > 0) {
            const dataStart = headerEnd;
            if (dataStart + dataSize <= bytes.length)
              data = bytes.slice(dataStart, dataStart + dataSize);
          }

          const crcStr = dataCRC ? dataCRC.toString(16).toUpperCase().padStart(8, '0') : (data ? crc32Hex(data) : '');
          entries.push(makeEntry(
            normalizeArchivePath(name), uncompSize, dataSize, mtime, crcStr,
            isDir, encrypted, data, handler
          ));
        }

        off = headerEnd + dataSize;
      }
      return entries;
    }

    _readVInt(bytes, off) {
      let value = 0;
      let shift = 0;
      let bytesRead = 0;
      while (off < bytes.length) {
        const b = bytes[off++];
        ++bytesRead;
        value |= (b & 0x7F) << shift;
        if (!(b & 0x80)) break;
        shift += 7;
      }
      return { value, bytesRead };
    }

    async build(_entries, _password, _options) { throw new Error('RAR creation not supported'); }
  }

  // =======================================================================
  // FORMAT: 7z (read-only)
  // =======================================================================

  class SevenZipFormat extends IArchiveFormat {
    static get id() { return '7z'; }
    static get displayName() { return '7-Zip Archive'; }
    static get extensions() { return ['7z']; }
    static get canCreate() { return true; }
    static get supportsEncryption() { return true; }

    static getCreateOptions() {
      return [
        { id: 'method', label: 'Method', type: 'select', options: [
          { value: 'store', label: 'Store' },
          { value: 'lzma', label: 'LZMA' },
          { value: 'lzma2', label: 'LZMA2' },
          { value: 'ppmd', label: 'PPMd' },
          { value: 'bzip2', label: 'BZip2' },
          { value: 'deflate', label: 'Deflate' }
        ], default: 'lzma' },
        { id: 'level', label: 'Level', type: 'select', options: [
          { value: '1', label: '1 - Fastest' }, { value: '3', label: '3 - Fast' },
          { value: '5', label: '5 - Normal' }, { value: '7', label: '7 - Maximum' },
          { value: '9', label: '9 - Ultra' }
        ], default: '5', visibleWhen: { method: 'lzma|lzma2|ppmd|bzip2|deflate' } },
        { id: 'dictionary', label: 'Dictionary', type: 'select', options: [
          { value: '65536', label: '64 KB' }, { value: '262144', label: '256 KB' },
          { value: '1048576', label: '1 MB' }, { value: '2097152', label: '2 MB' },
          { value: '4194304', label: '4 MB' }, { value: '8388608', label: '8 MB' },
          { value: '16777216', label: '16 MB' }, { value: '33554432', label: '32 MB' },
          { value: '67108864', label: '64 MB' }, { value: '134217728', label: '128 MB' },
          { value: '268435456', label: '256 MB' }
        ], default: '16777216', visibleWhen: { method: 'lzma|lzma2' } },
        { id: 'wordSize', label: 'Word size', type: 'select', options: [
          { value: '8', label: '8' }, { value: '12', label: '12' },
          { value: '16', label: '16' }, { value: '24', label: '24' },
          { value: '32', label: '32' }, { value: '64', label: '64' },
          { value: '128', label: '128' }, { value: '256', label: '256' }
        ], default: '32', visibleWhen: { method: 'lzma|lzma2|ppmd' } },
        { id: 'solid', label: 'Solid archive', type: 'checkbox', default: false },
        { id: 'encrypt', label: 'Encrypt with password', type: 'checkbox', default: false },
        { id: 'encryptNames', label: 'Encrypt file names', type: 'checkbox', default: false, visibleWhen: { encrypt: true } }
      ];
    }

    static detect(bytes, _fileName) {
      if (bytes.length < 6) return false;
      return bytes[0] === 0x37 && bytes[1] === 0x7A && bytes[2] === 0xBC && bytes[3] === 0xAF && bytes[4] === 0x27 && bytes[5] === 0x1C;
    }

    async parse(bytes, _fileName, password) {
      const handler = this;
      const entries = [];

      if (bytes.length < 32) return entries;

      const nextHeaderOffset = this._readU64(bytes, 12);
      const nextHeaderSize = this._readU64(bytes, 20);

      const headerStart = 32 + nextHeaderOffset;
      if (headerStart + nextHeaderSize > bytes.length) return entries;

      let headerData = bytes.slice(headerStart, headerStart + nextHeaderSize);

      if (headerData.length > 0 && headerData[0] === 0x17) {
        try {
          headerData = await this._decodeEncodedHeader(headerData, bytes, 32, password);
        } catch (e) {
          if (e && e.needPassword) throw e;
          return entries;
        }
      }

      if (!headerData || headerData.length === 0) return entries;

      const header = this._parseHeader(headerData);
      if (!header) return entries;

      let fileDataMap = null;
      if (header.packInfo && header.unpackInfo) {
        try {
          fileDataMap = await this._decompressFolders(bytes, 32, header.packInfo, header.unpackInfo, header.subStreamsInfo, password);
        } catch (_) { /* ignore extraction failures */ }
      }

      const fileNames = header.filesInfo ? header.filesInfo.names : [];
      const emptyStream = header.filesInfo ? header.filesInfo.emptyStream : [];
      const emptyFile = header.filesInfo ? header.filesInfo.emptyFile : [];
      const isDirFlags = header.filesInfo ? header.filesInfo.isDir : [];
      const mtimes = header.filesInfo ? header.filesInfo.mtimes : [];
      const attrs = header.filesInfo ? header.filesInfo.attrs : [];

      let fileIdx = 0;
      for (let i = 0; i < fileNames.length; ++i) {
        const name = fileNames[i];
        const isEmpty = emptyStream[i];
        const isDir = isDirFlags[i] || (isEmpty && !emptyFile[i]);
        const mtime = mtimes[i] || null;

        let data = null;
        let size = 0;
        let packed = 0;
        if (!isEmpty && fileDataMap && fileIdx < fileDataMap.length) {
          data = fileDataMap[fileIdx];
          size = data ? data.length : 0;
          packed = size;
          ++fileIdx;
        }

        entries.push(makeEntry(
          normalizeArchivePath(name), size, packed, mtime,
          data ? crc32Hex(data) : '', isDir, false, data, handler
        ));
      }
      return entries;
    }

    _read7zNum(buf, off) {
      if (off >= buf.length) return { value: 0, bytesRead: 1 };
      const first = buf[off];
      let mask = 0x80;
      let numExtra = 0;
      while (numExtra < 8 && (first & mask)) { ++numExtra; mask >>>= 1; }
      if (numExtra === 0) return { value: first, bytesRead: 1 };
      let value = first & (mask - 1);
      for (let i = 0; i < numExtra && off + 1 + i < buf.length; ++i)
        value = value * 256 + buf[off + 1 + i];
      return { value, bytesRead: 1 + numExtra };
    }

    _skipProperty(buf, off) {
      const sz = this._read7zNum(buf, off);
      return off + sz.bytesRead + sz.value;
    }

    _parseHeader(buf) {
      let off = 0;
      if (off >= buf.length) return null;
      const mainId = buf[off++];
      if (mainId !== 0x01) return null;

      let packInfo = null;
      let unpackInfo = null;
      let subStreamsInfo = null;
      let filesInfo = null;

      while (off < buf.length) {
        const propId = buf[off++];
        if (propId === 0x00) break;
        if (propId === 0x06) {
          const r = this._parsePackInfo(buf, off);
          packInfo = r.info;
          off = r.nextOff;
        } else if (propId === 0x07) {
          const r = this._parseUnpackInfo(buf, off);
          unpackInfo = r.info;
          off = r.nextOff;
        } else if (propId === 0x08) {
          const r = this._parseSubStreamsInfo(buf, off, unpackInfo ? unpackInfo.folders.length : 0, unpackInfo);
          subStreamsInfo = r.info;
          off = r.nextOff;
        } else if (propId === 0x05) {
          const r = this._parseNewFilesInfo(buf, off);
          filesInfo = r.info;
          off = r.nextOff;
        } else
          off = this._skipProperty(buf, off);
      }
      return { packInfo, unpackInfo, subStreamsInfo, filesInfo };
    }

    _parsePackInfo(buf, off) {
      const packPos = this._read7zNum(buf, off);
      off += packPos.bytesRead;
      const numPackStreams = this._read7zNum(buf, off);
      off += numPackStreams.bytesRead;
      const packSizes = [];
      while (off < buf.length) {
        const propId = buf[off++];
        if (propId === 0x00) break;
        if (propId === 0x09) {
          for (let i = 0; i < numPackStreams.value; ++i) {
            const s = this._read7zNum(buf, off);
            packSizes.push(s.value);
            off += s.bytesRead;
          }
        } else if (propId === 0x0A)
          off = this._skipProperty(buf, off);
        else
          off = this._skipProperty(buf, off);
      }
      if (packSizes.length === 0)
        for (let i = 0; i < numPackStreams.value; ++i) packSizes.push(0);
      return { info: { packPos: packPos.value, numPackStreams: numPackStreams.value, packSizes }, nextOff: off };
    }

    _parseFolder(buf, off) {
      const numCoders = this._read7zNum(buf, off);
      off += numCoders.bytesRead;
      const coders = [];
      for (let i = 0; i < numCoders.value; ++i) {
        const flags = buf[off++];
        const idSize = flags & 0x0F;
        const hasAttrs = !!(flags & 0x20);
        const complexCoder = !!(flags & 0x10);
        const coderId = [];
        for (let j = 0; j < idSize && off < buf.length; ++j) coderId.push(buf[off++]);
        let numInStreams = 1, numOutStreams = 1;
        if (complexCoder) {
          const ins = this._read7zNum(buf, off); numInStreams = ins.value; off += ins.bytesRead;
          const outs = this._read7zNum(buf, off); numOutStreams = outs.value; off += outs.bytesRead;
        }
        let props = null;
        if (hasAttrs) {
          const propSize = this._read7zNum(buf, off); off += propSize.bytesRead;
          props = buf.slice(off, off + propSize.value);
          off += propSize.value;
        }
        coders.push({ coderId, numInStreams, numOutStreams, props });
      }
      const totalInStreams = coders.reduce((s, c) => s + c.numInStreams, 0);
      const totalOutStreams = coders.reduce((s, c) => s + c.numOutStreams, 0);
      const numBindPairs = totalOutStreams - 1;
      const bindPairs = [];
      for (let i = 0; i < numBindPairs; ++i) {
        const inIdx = this._read7zNum(buf, off); off += inIdx.bytesRead;
        const outIdx = this._read7zNum(buf, off); off += outIdx.bytesRead;
        bindPairs.push({ inIndex: inIdx.value, outIndex: outIdx.value });
      }
      const numPackStreams = totalInStreams - numBindPairs;
      const packStreams = [];
      if (numPackStreams === 1) {
        for (let i = 0; i < totalInStreams; ++i) {
          let bound = false;
          for (const bp of bindPairs)
            if (bp.inIndex === i) { bound = true; break; }
          if (!bound) { packStreams.push(i); break; }
        }
      } else {
        for (let i = 0; i < numPackStreams; ++i) {
          const idx = this._read7zNum(buf, off); off += idx.bytesRead;
          packStreams.push(idx.value);
        }
      }
      return { coders, bindPairs, packStreams, nextOff: off };
    }

    _parseUnpackInfo(buf, off) {
      const folders = [];
      let unpackSizes = [];
      while (off < buf.length) {
        const propId = buf[off++];
        if (propId === 0x00) break;
        if (propId === 0x0B) {
          const numFolders = this._read7zNum(buf, off); off += numFolders.bytesRead;
          const external = buf[off++];
          if (external === 0) {
            for (let i = 0; i < numFolders.value; ++i) {
              const f = this._parseFolder(buf, off);
              folders.push(f);
              off = f.nextOff;
            }
          }
        } else if (propId === 0x0C) {
          for (const f of folders) {
            const totalOut = f.coders.reduce((s, c) => s + c.numOutStreams, 0);
            f.unpackSizes = [];
            for (let i = 0; i < totalOut; ++i) {
              const sz = this._read7zNum(buf, off); off += sz.bytesRead;
              f.unpackSizes.push(sz.value);
            }
          }
        } else if (propId === 0x0A) {
          const allDefined = buf[off++];
          if (allDefined) {
            for (const f of folders) {
              f.crc = readU32LE(buf, off);
              off += 4;
            }
          }
        } else
          off = this._skipProperty(buf, off);
      }
      return { info: { folders }, nextOff: off };
    }

    _parseSubStreamsInfo(buf, off, numFolders, unpackInfo) {
      const numUnpackStreamsInFolders = [];
      const subStreamSizes = [];
      const digests = [];
      while (off < buf.length) {
        const propId = buf[off++];
        if (propId === 0x00) break;
        if (propId === 0x0D) {
          for (let i = 0; i < numFolders; ++i) {
            const n = this._read7zNum(buf, off); off += n.bytesRead;
            numUnpackStreamsInFolders.push(n.value);
          }
        } else if (propId === 0x09) {
          for (let i = 0; i < numFolders; ++i) {
            const numStreams = numUnpackStreamsInFolders[i] || 1;
            const sizes = [];
            let total = 0;
            for (let j = 0; j < numStreams - 1; ++j) {
              const sz = this._read7zNum(buf, off); off += sz.bytesRead;
              sizes.push(sz.value);
              total += sz.value;
            }
            const folderUnpackSize = unpackInfo && unpackInfo.folders[i] && unpackInfo.folders[i].unpackSizes
              ? unpackInfo.folders[i].unpackSizes[unpackInfo.folders[i].unpackSizes.length - 1] : 0;
            sizes.push(Math.max(0, folderUnpackSize - total));
            subStreamSizes.push(sizes);
          }
        } else if (propId === 0x0A)
          off = this._skipProperty(buf, off);
        else
          off = this._skipProperty(buf, off);
      }
      if (numUnpackStreamsInFolders.length === 0)
        for (let i = 0; i < numFolders; ++i) numUnpackStreamsInFolders.push(1);
      return { info: { numUnpackStreamsInFolders, subStreamSizes, digests }, nextOff: off };
    }

    _parseNewFilesInfo(buf, off) {
      const numFiles = this._read7zNum(buf, off); off += numFiles.bytesRead;
      const names = [];
      const emptyStream = new Array(numFiles.value).fill(false);
      const emptyFile = new Array(numFiles.value).fill(false);
      const isDir = new Array(numFiles.value).fill(false);
      const mtimes = new Array(numFiles.value).fill(null);
      const attrs = new Array(numFiles.value).fill(0);

      while (off < buf.length) {
        const propId = buf[off++];
        if (propId === 0x00) break;
        const blockSize = this._read7zNum(buf, off); off += blockSize.bytesRead;
        const blockEnd = off + blockSize.value;

        if (propId === 0x11) {
          const external = buf[off++];
          let nameOff = off;
          let current = '';
          while (nameOff + 1 < blockEnd) {
            const ch = readU16LE(buf, nameOff);
            nameOff += 2;
            if (ch === 0) {
              names.push(current);
              current = '';
            } else
              current += String.fromCharCode(ch);
          }
          if (current) names.push(current);
        } else if (propId === 0x0E) {
          let bitOff = off;
          for (let i = 0; i < numFiles.value && bitOff < blockEnd; ++i) {
            const byteIdx = Math.floor(i / 8);
            const bitIdx = 7 - (i % 8);
            if (bitOff + byteIdx < blockEnd)
              emptyStream[i] = !!((buf[bitOff + byteIdx] >>> bitIdx) & 1);
          }
          for (let i = 0; i < numFiles.value; ++i)
            if (emptyStream[i]) isDir[i] = true;
        } else if (propId === 0x0F) {
          let bitOff = off;
          let emptyIdx = 0;
          for (let i = 0; i < numFiles.value; ++i) {
            if (emptyStream[i]) {
              const byteIdx = Math.floor(emptyIdx / 8);
              const bitIdx = 7 - (emptyIdx % 8);
              if (bitOff + byteIdx < blockEnd)
                emptyFile[i] = !!((buf[bitOff + byteIdx] >>> bitIdx) & 1);
              if (emptyFile[i]) isDir[i] = false;
              ++emptyIdx;
            }
          }
        } else if (propId === 0x14) {
          let mOff = off;
          const allDefined = buf[mOff++];
          if (allDefined) {
            mOff += 2;
            for (let i = 0; i < numFiles.value && mOff + 8 <= blockEnd; ++i) {
              const lo = readU32LE(buf, mOff);
              const hi = readU32LE(buf, mOff + 4);
              const ft = lo + hi * 0x100000000;
              const ms = (ft - 116444736000000000) / 10000;
              mtimes[i] = new Date(ms);
              mOff += 8;
            }
          }
        } else if (propId === 0x15) {
          let aOff = off;
          const allDefined = buf[aOff++];
          if (allDefined) {
            aOff += 2;
            for (let i = 0; i < numFiles.value && aOff + 4 <= blockEnd; ++i) {
              attrs[i] = readU32LE(buf, aOff);
              if (attrs[i] & 0x10) isDir[i] = true;
              aOff += 4;
            }
          }
        }
        off = blockEnd;
      }
      return { info: { names, emptyStream, emptyFile, isDir, mtimes, attrs }, nextOff: off };
    }

    async _decodeEncodedHeader(headerData, fullArchive, dataOffset, password) {
      let off = 0;
      if (headerData[off] !== 0x17) return headerData;
      ++off;

      const innerHeader = this._parseHeader7zStream(headerData, off);
      if (!innerHeader || !innerHeader.packInfo || !innerHeader.unpackInfo) return headerData;

      const fileDataMap = await this._decompressFolders(fullArchive, dataOffset, innerHeader.packInfo, innerHeader.unpackInfo, null, password);
      if (fileDataMap && fileDataMap.length > 0 && fileDataMap[0])
        return fileDataMap[0];
      return headerData;
    }

    _parseHeader7zStream(buf, off) {
      let packInfo = null;
      let unpackInfo = null;
      while (off < buf.length) {
        const propId = buf[off++];
        if (propId === 0x00) break;
        if (propId === 0x06) {
          const r = this._parsePackInfo(buf, off);
          packInfo = r.info; off = r.nextOff;
        } else if (propId === 0x07) {
          const r = this._parseUnpackInfo(buf, off);
          unpackInfo = r.info; off = r.nextOff;
        } else if (propId === 0x08) {
          const r = this._parseSubStreamsInfo(buf, off, unpackInfo ? unpackInfo.folders.length : 0, unpackInfo);
          off = r.nextOff;
        } else
          off = this._skipProperty(buf, off);
      }
      return { packInfo, unpackInfo };
    }

    async _decompressFolders(fullArchive, dataOffset, packInfo, unpackInfo, subStreamsInfo, password) {
      const result = [];
      let packOffset = dataOffset + packInfo.packPos;
      let packIdx = 0;

      for (let fi = 0; fi < unpackInfo.folders.length; ++fi) {
        const folder = unpackInfo.folders[fi];
        const numPackStreams = folder.packStreams ? folder.packStreams.length : 1;
        let totalPackSize = 0;
        for (let i = 0; i < numPackStreams; ++i) {
          if (packIdx + i < packInfo.packSizes.length)
            totalPackSize += packInfo.packSizes[packIdx + i];
        }
        const packSize = packIdx < packInfo.packSizes.length ? packInfo.packSizes[packIdx] : totalPackSize;

        if (packOffset + packSize > fullArchive.length) {
          packIdx += numPackStreams;
          packOffset += totalPackSize;
          result.push(null);
          continue;
        }

        let data = fullArchive.slice(packOffset, packOffset + packSize);
        const unpackSize = folder.unpackSizes && folder.unpackSizes.length > 0
          ? folder.unpackSizes[folder.unpackSizes.length - 1] : data.length;

        for (const coder of folder.coders) {
          data = await this._executeCoder(coder, data, unpackSize, password);
          if (!data) break;
        }

        if (data && subStreamsInfo) {
          const numStreams = subStreamsInfo.numUnpackStreamsInFolders[fi] || 1;
          if (numStreams === 1)
            result.push(data);
          else {
            const sizes = subStreamsInfo.subStreamSizes[fi] || [];
            let sOff = 0;
            for (let s = 0; s < numStreams; ++s) {
              const sz = sizes[s] || 0;
              result.push(data.slice(sOff, sOff + sz));
              sOff += sz;
            }
          }
        } else
          result.push(data);

        packIdx += numPackStreams;
        packOffset += totalPackSize;
      }
      return result;
    }

    async _executeCoder(coder, data, unpackSize, password) {
      if (!data) return null;
      const id = coder.coderId;

      if (id.length === 1 && id[0] === 0x00) return data;

      if (id.length === 3 && id[0] === 0x03 && id[1] === 0x01 && id[2] === 0x01)
        return _tryLzmaDecompress(data);

      if (id.length === 1 && id[0] === 0x21)
        return _tryLzmaDecompress(data);

      if (id.length === 3 && id[0] === 0x04 && id[1] === 0x01 && id[2] === 0x08)
        return _tryDeflateDecompress(data);

      if (id.length === 3 && id[0] === 0x04 && id[1] === 0x02 && id[2] === 0x02)
        return _tryBzip2Decompress(data);

      if (id.length === 3 && id[0] === 0x03 && id[1] === 0x04 && id[2] === 0x01)
        return _cipherDecompress('PPMd (PPM with Dynamic Memory)', 'ppmd.js', data);

      if (id.length === 4 && id[0] === 0x06 && id[1] === 0xF1 && id[2] === 0x07 && id[3] === 0x01) {
        if (!password) {
          const err = new Error('Password required');
          err.needPassword = true;
          throw err;
        }
        return this._decryptAes256(data, coder.props, password);
      }

      return data;
    }

    async _decryptAes256(data, props, password) {
      if (!props || props.length < 2) return null;
      const numCyclesPower = props[0] & 0x3F;
      const ivSize = ((props[0] >> 6) & 0x03) + ((props[1] & 0x0F) << 2);
      const saltSize = (props[1] >> 4) & 0x0F;
      let pOff = 2;
      const salt = props.slice(pOff, pOff + saltSize); pOff += saltSize;
      const iv = new Uint8Array(16);
      for (let i = 0; i < ivSize && pOff + i < props.length; ++i) iv[i] = props[pOff + i];

      const passBytes = new Uint8Array(password.length * 2);
      for (let i = 0; i < password.length; ++i)
        writeU16LE(passBytes, i * 2, password.charCodeAt(i));

      const numIterations = 1 << numCyclesPower;
      const keyBuf = new Uint8Array(32);
      try {
        let digest = new Uint8Array(passBytes.length + 8);
        digest.set(passBytes, 0);
        const hashParts = [];
        for (let i = 0; i < numIterations; ++i) {
          digest[passBytes.length] = i & 0xFF;
          digest[passBytes.length + 1] = (i >> 8) & 0xFF;
          digest[passBytes.length + 2] = (i >> 16) & 0xFF;
          digest[passBytes.length + 3] = (i >> 24) & 0xFF;
          hashParts.push(digest.slice());
        }
        const allBytes = concatUint8Arrays(hashParts);
        const hash = await crypto.subtle.digest('SHA-256', allBytes);
        keyBuf.set(new Uint8Array(hash));
      } catch (_) {
        return null;
      }

      try {
        const key = await crypto.subtle.importKey('raw', keyBuf, 'AES-CBC', false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data);
        return new Uint8Array(decrypted);
      } catch (_) {
        return null;
      }
    }

    _readU64(buf, off) {
      const lo = readU32LE(buf, off);
      const hi = readU32LE(buf, off + 4);
      return lo + hi * 0x100000000;
    }

    async build(entries, password, options) {
      const useEncrypt = password && options && options.encrypt;
      const requestedMethod = (options && options.method) || 'store';
      const fileEntries = entries.filter(e => !e.isDirectory && e._data);
      const dirEntries = entries.filter(e => e.isDirectory);

      const fileData = [];
      for (const e of fileEntries) {
        const raw = e._data instanceof Uint8Array ? e._data : null;
        fileData.push(raw || new Uint8Array(0));
      }

      const totalUncomp = fileData.reduce((s, d) => s + d.length, 0);
      const combined = new Uint8Array(totalUncomp);
      let cOff = 0;
      for (const d of fileData) { combined.set(d, cOff); cOff += d.length; }

      // Try compression based on selected method
      let packedData = combined;
      let usedCoder = 'copy'; // 'copy', 'lzma', 'deflate', 'bzip2', 'ppmd'
      if (requestedMethod === 'lzma' || requestedMethod === 'lzma2') {
        const compressed = await _tryLzmaCompress(combined);
        if (compressed && compressed.length < combined.length) {
          packedData = compressed;
          usedCoder = 'lzma';
        }
      } else if (requestedMethod === 'deflate') {
        const compressed = await _tryDeflateCompress(combined);
        if (compressed && compressed.length < combined.length) {
          packedData = compressed;
          usedCoder = 'deflate';
        }
      } else if (requestedMethod === 'bzip2') {
        const compressed = await _tryBzip2Compress(combined);
        if (compressed && compressed.length < combined.length) {
          packedData = compressed;
          usedCoder = 'bzip2';
        }
      } else if (requestedMethod === 'ppmd') {
        const compressed = await _tryPpmdCompress(combined);
        if (compressed && compressed.length < combined.length) {
          packedData = compressed;
          usedCoder = 'ppmd';
        }
      }

      const fileCrcs = fileData.map(d => computeCRC32(d));
      const fileSizes = fileData.map(d => d.length);

      const namesData = this._buildNamesProperty(fileEntries, dirEntries);
      const emptyStreamData = dirEntries.length > 0 ? this._buildEmptyStreamProperty(fileEntries.length, dirEntries.length) : null;

      const headerParts = [];
      headerParts.push(this._build7zPackInfo(0, packedData.length));
      headerParts.push(this._build7zUnpackInfo(packedData.length, totalUncomp, usedCoder));
      if (fileEntries.length > 1)
        headerParts.push(this._build7zSubStreamsInfo(fileSizes, fileCrcs));

      const filesInfo = this._build7zFilesInfo(namesData, emptyStreamData, fileEntries, dirEntries);
      headerParts.push(filesInfo);

      let headerSize = 1;
      for (const p of headerParts) headerSize += p.length;
      headerSize += 1;
      const header = new Uint8Array(headerSize);
      let hOff = 0;
      header[hOff++] = 0x01;
      for (const p of headerParts) { header.set(p, hOff); hOff += p.length; }
      header[hOff++] = 0x00;

      const headerCRC = computeCRC32(header);

      const sig = new Uint8Array(32);
      sig[0] = 0x37; sig[1] = 0x7A; sig[2] = 0xBC; sig[3] = 0xAF; sig[4] = 0x27; sig[5] = 0x1C;
      sig[6] = 0; sig[7] = 4;

      const nextHeaderOffset = packedData.length;
      const nextHeaderSize = header.length;
      this._writeU64LE(sig, 12, nextHeaderOffset);
      this._writeU64LE(sig, 20, nextHeaderSize);
      writeU32LE(sig, 28, headerCRC);

      const startHeaderData = sig.subarray(12, 32);
      const startHeaderCRC = computeCRC32(startHeaderData);
      writeU32LE(sig, 8, startHeaderCRC);

      const total = 32 + packedData.length + header.length;
      const result = new Uint8Array(total);
      result.set(sig, 0);
      result.set(packedData, 32);
      result.set(header, 32 + packedData.length);
      return result;
    }

    _write7zVarInt(value) {
      const bytes = [];
      while (value >= 0x80) {
        bytes.push((value & 0x7F) | 0x80);
        value = Math.floor(value / 128);
      }
      bytes.push(value & 0x7F);
      return new Uint8Array(bytes);
    }

    _writeU64LE(buf, off, val) {
      writeU32LE(buf, off, val & 0xFFFFFFFF);
      writeU32LE(buf, off + 4, Math.floor(val / 0x100000000));
    }

    _build7zPackInfo(packPos, packSize) {
      const parts = [new Uint8Array([0x06])];
      parts.push(this._write7zVarInt(packPos));
      parts.push(this._write7zVarInt(1));
      parts.push(new Uint8Array([0x09]));
      parts.push(this._write7zVarInt(packSize));
      parts.push(new Uint8Array([0x00]));
      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { result.set(p, off); off += p.length; }
      return result;
    }

    _build7zUnpackInfo(packSize, unpackSize, coderType) {
      const parts = [new Uint8Array([0x07])];
      parts.push(new Uint8Array([0x0B]));
      parts.push(this._write7zVarInt(1));

      // 7z coder IDs: Copy=00, LZMA=030101, LZMA2=21, Deflate=040108, BZip2=040202, PPMd=030401
      if (coderType === 'lzma') {
        parts.push(new Uint8Array([0x23, 0x03, 0x01, 0x01])); // 0x20|0x03 = has props + 3-byte ID
        const props = new Uint8Array(5);
        props[0] = 0x5D; // lc=3, lp=0, pb=2
        writeU32LE(props, 1, 0x00800000); // 8 MB dictionary
        parts.push(new Uint8Array([props.length]));
        parts.push(props);
      } else if (coderType === 'deflate') {
        parts.push(new Uint8Array([0x23, 0x04, 0x01, 0x08])); // Deflate coder ID
      } else if (coderType === 'bzip2') {
        parts.push(new Uint8Array([0x23, 0x04, 0x02, 0x02])); // BZip2 coder ID
      } else if (coderType === 'ppmd') {
        parts.push(new Uint8Array([0x23, 0x03, 0x04, 0x01])); // PPMd coder ID
        const props = new Uint8Array(5);
        props[0] = 8; // order
        writeU32LE(props, 1, 0x01000000); // 16 MB memory
        parts.push(new Uint8Array([props.length]));
        parts.push(props);
      } else {
        // Copy coder: ID = 00, 1 byte
        parts.push(new Uint8Array([0x01, 0x00]));
      }
      parts.push(new Uint8Array([0x00]));

      parts.push(new Uint8Array([0x0C]));
      parts.push(this._write7zVarInt(unpackSize));

      parts.push(new Uint8Array([0x00]));

      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { result.set(p, off); off += p.length; }
      return result;
    }

    _build7zSubStreamsInfo(fileSizes, fileCrcs) {
      const parts = [new Uint8Array([0x08])];
      parts.push(new Uint8Array([0x0D]));
      parts.push(this._write7zVarInt(fileSizes.length));
      parts.push(new Uint8Array([0x09]));
      for (let i = 0; i < fileSizes.length - 1; ++i)
        parts.push(this._write7zVarInt(fileSizes[i]));

      parts.push(new Uint8Array([0x0A]));
      parts.push(new Uint8Array([0x01]));
      const crcData = new Uint8Array(fileCrcs.length * 4);
      for (let i = 0; i < fileCrcs.length; ++i)
        writeU32LE(crcData, i * 4, fileCrcs[i]);
      parts.push(crcData);

      parts.push(new Uint8Array([0x00]));
      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { result.set(p, off); off += p.length; }
      return result;
    }

    _buildNamesProperty(fileEntries, dirEntries) {
      const allEntries = [...fileEntries, ...dirEntries];
      let namesBytesLen = 0;
      for (const e of allEntries)
        namesBytesLen += (e.name.length + 1) * 2;
      const namesBytes = new Uint8Array(namesBytesLen);
      let nOff = 0;
      for (const e of allEntries) {
        for (let i = 0; i < e.name.length; ++i) {
          writeU16LE(namesBytes, nOff, e.name.charCodeAt(i));
          nOff += 2;
        }
        writeU16LE(namesBytes, nOff, 0);
        nOff += 2;
      }
      return namesBytes;
    }

    _buildEmptyStreamProperty(fileCount, dirCount) {
      const totalEntries = fileCount + dirCount;
      const byteLen = Math.ceil(totalEntries / 8);
      const bits = new Uint8Array(byteLen);
      for (let i = fileCount; i < totalEntries; ++i) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = 7 - (i % 8);
        bits[byteIdx] |= (1 << bitIdx);
      }
      return bits;
    }

    _build7zFilesInfo(namesData, emptyStreamData, fileEntries, dirEntries) {
      const totalEntries = fileEntries.length + dirEntries.length;
      const parts = [new Uint8Array([0x05])];
      parts.push(this._write7zVarInt(totalEntries));

      parts.push(new Uint8Array([0x11]));
      const nameBlock = new Uint8Array(1 + namesData.length);
      nameBlock[0] = 0;
      nameBlock.set(namesData, 1);
      parts.push(this._write7zVarInt(nameBlock.length));
      parts.push(nameBlock);

      if (emptyStreamData) {
        parts.push(new Uint8Array([0x0E]));
        parts.push(this._write7zVarInt(emptyStreamData.length));
        parts.push(emptyStreamData);
        const emptyFile = new Uint8Array(Math.ceil(dirEntries.length / 8));
        parts.push(new Uint8Array([0x0F]));
        parts.push(this._write7zVarInt(emptyFile.length));
        parts.push(emptyFile);
      }

      parts.push(new Uint8Array([0x00]));

      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { result.set(p, off); off += p.length; }
      return result;
    }
  }

  // =======================================================================
  // FORMAT: LZH / LHA (read-only)
  // =======================================================================

  class LzhFormat extends IArchiveFormat {
    static get id() { return 'lzh'; }
    static get displayName() { return 'LZH/LHA Archive'; }
    static get extensions() { return ['lzh', 'lha']; }
    static get canCreate() { return true; }

    static getCreateOptions() {
      return [
        { id: 'method', label: 'Method', type: 'select', options: [
          { value: '-lh0-', label: 'Store (-lh0-)' },
          { value: '-lh5-', label: 'LZSS (-lh5-)' }
        ], default: '-lh5-' }
      ];
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
      const requestedMethod = (options && options.method) || '-lh5-';
      const parts = [];

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const raw = entry._data instanceof Uint8Array ? entry._data : null;
        if (!raw) continue;

        let compData = raw;
        let method = requestedMethod;
        if (method === '-lh5-') {
          const compressed = await _tryLzssCompress(raw);
          if (compressed && compressed.length < raw.length)
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

  // =======================================================================
  // FORMAT: ARJ (read-only)
  // =======================================================================

  class ArjFormat extends IArchiveFormat {
    static get id() { return 'arj'; }
    static get displayName() { return 'ARJ Archive'; }
    static get extensions() { return ['arj']; }
    static get canCreate() { return true; }

    static getCreateOptions() {
      return [
        { id: 'method', label: 'Method', type: 'select', options: [
          { value: '0', label: 'Store (method 0)' },
          { value: '1', label: 'Maximum (method 1)' },
          { value: '2', label: 'Stearns (method 2)' },
          { value: '3', label: 'Fast (method 3)' },
          { value: '4', label: 'Fastest (method 4)' }
        ], default: '0' }
      ];
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
      const requestedMethod = parseInt((options && options.method) || '0', 10);
      const parts = [];

      const archHdr = this._buildArjHeader('', 0, 0, 0, 0, 2, 0);
      parts.push(archHdr);

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const raw = entry._data instanceof Uint8Array ? entry._data : null;
        if (!raw) continue;

        // Try compression for non-Store methods
        let packed = raw;
        let method = 0;
        if (requestedMethod > 0) {
          const compressed = await _tryDeflateCompress(raw);
          if (compressed && compressed.length < raw.length) {
            packed = compressed;
            method = requestedMethod;
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
  // FORMAT: TAR.BZ2
  // =======================================================================

  class TarBz2Format extends IArchiveFormat {
    static get id() { return 'tarbz2'; }
    static get displayName() { return 'TAR.BZ2 Archive'; }
    static get extensions() { return ['tar.bz2', 'tbz2']; }
    static get canCreate() { return true; }

    static getCreateOptions() {
      return Bzip2Format.getCreateOptions();
    }

    static detect(bytes, fileName) {
      if (bytes.length < 3) return false;
      if (bytes[0] !== 0x42 || bytes[1] !== 0x5A || bytes[2] !== 0x68) return false;
      const lower = (fileName || '').toLowerCase();
      return lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2');
    }

    async parse(bytes, fileName, password) {
      const bz2Handler = new Bzip2Format();
      const bz2Entries = await bz2Handler.parse(bytes, fileName, password);
      if (!bz2Entries.length || !bz2Entries[0]._data) return bz2Entries;
      const tarData = bz2Entries[0]._data;
      const tarHandler = new TarFormat();
      const entries = await tarHandler.parse(tarData, fileName, password);
      const handler = this;
      for (const e of entries) e._handler = handler;
      return entries;
    }

    async build(entries, password, options) {
      const tarHandler = new TarFormat();
      const tarData = await tarHandler.build(entries, password, options);
      const bz2Handler = new Bzip2Format();
      const wrappedEntries = [makeEntry('archive.tar', tarData.length, tarData.length, new Date(), '', false, false, tarData, bz2Handler)];
      return bz2Handler.build(wrappedEntries, password, options);
    }
  }

  // =======================================================================
  // FORMAT: TAR.XZ
  // =======================================================================

  class TarXzFormat extends IArchiveFormat {
    static get id() { return 'tarxz'; }
    static get displayName() { return 'TAR.XZ Archive'; }
    static get extensions() { return ['tar.xz', 'txz']; }
    static get canCreate() { return true; }

    static detect(bytes, fileName) {
      if (bytes.length < 6) return false;
      if (bytes[0] !== 0xFD || bytes[1] !== 0x37 || bytes[2] !== 0x7A || bytes[3] !== 0x58 || bytes[4] !== 0x5A || bytes[5] !== 0x00) return false;
      const lower = (fileName || '').toLowerCase();
      return lower.endsWith('.tar.xz') || lower.endsWith('.txz');
    }

    async parse(bytes, fileName, password) {
      const xzHandler = new XzFormat();
      const xzEntries = await xzHandler.parse(bytes, fileName, password);
      if (!xzEntries.length || !xzEntries[0]._data) return xzEntries;
      const tarData = xzEntries[0]._data;
      const tarHandler = new TarFormat();
      const entries = await tarHandler.parse(tarData, fileName, password);
      const handler = this;
      for (const e of entries) e._handler = handler;
      return entries;
    }

    async build(entries, password, options) {
      const tarHandler = new TarFormat();
      const tarData = await tarHandler.build(entries, password, options);
      const xzHandler = new XzFormat();
      const wrappedEntries = [makeEntry('archive.tar', tarData.length, tarData.length, new Date(), '', false, false, tarData, xzHandler)];
      return xzHandler.build(wrappedEntries, password, options);
    }
  }

  // =======================================================================
  // FORMAT: TAR.ZST
  // =======================================================================

  class TarZstFormat extends IArchiveFormat {
    static get id() { return 'tarzst'; }
    static get displayName() { return 'TAR.ZST Archive'; }
    static get extensions() { return ['tar.zst', 'tzst']; }
    static get canCreate() { return true; }

    static getCreateOptions() {
      return ZstdFormat.getCreateOptions();
    }

    static detect(bytes, fileName) {
      if (bytes.length < 4) return false;
      if (bytes[0] !== 0x28 || bytes[1] !== 0xB5 || bytes[2] !== 0x2F || bytes[3] !== 0xFD) return false;
      const lower = (fileName || '').toLowerCase();
      return lower.endsWith('.tar.zst') || lower.endsWith('.tzst');
    }

    async parse(bytes, fileName, password) {
      const zstHandler = new ZstdFormat();
      const zstEntries = await zstHandler.parse(bytes, fileName, password);
      if (!zstEntries.length || !zstEntries[0]._data) return zstEntries;
      const tarData = zstEntries[0]._data;
      const tarHandler = new TarFormat();
      const entries = await tarHandler.parse(tarData, fileName, password);
      const handler = this;
      for (const e of entries) e._handler = handler;
      return entries;
    }

    async build(entries, password, options) {
      const tarHandler = new TarFormat();
      const tarData = await tarHandler.build(entries, password, options);
      const zstHandler = new ZstdFormat();
      const wrappedEntries = [makeEntry('archive.tar', tarData.length, tarData.length, new Date(), '', false, false, tarData, zstHandler)];
      return zstHandler.build(wrappedEntries, password, options);
    }
  }

  // =======================================================================
  // FORMAT: CPIO
  // =======================================================================

  class CpioFormat extends IArchiveFormat {
    static get id() { return 'cpio'; }
    static get displayName() { return 'CPIO Archive'; }
    static get extensions() { return ['cpio']; }
    static get canCreate() { return true; }

    static getCreateOptions() {
      return [
        { id: 'format', label: 'Format', type: 'select', options: [{ value: 'newc', label: 'SVR4 (newc)' }, { value: 'odc', label: 'POSIX.1 (odc)' }], default: 'newc' }
      ];
    }

    static detect(bytes, _fileName) {
      if (bytes.length < 6) return false;
      const magic = new TextDecoder().decode(bytes.subarray(0, 6));
      return magic === '070707' || magic === '070701' || magic === '070702';
    }

    async parse(bytes, _fileName, _password) {
      const entries = [];
      const handler = this;
      let off = 0;

      while (off + 6 <= bytes.length) {
        const magic = new TextDecoder().decode(bytes.subarray(off, off + 6));

        if (magic === '070701' || magic === '070702') {
          if (off + 110 > bytes.length) break;
          const hdr = new TextDecoder().decode(bytes.subarray(off, off + 110));
          const fileSize = parseInt(hdr.substring(54, 62), 16);
          const nameSize = parseInt(hdr.substring(94, 102), 16);
          const mtime = parseInt(hdr.substring(46, 54), 16);
          const mode = parseInt(hdr.substring(14, 22), 16);

          const nameStart = off + 110;
          const nameEnd = nameStart + nameSize - 1;
          const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));
          const nameAligned = nameStart + this._align4(nameSize + 110) - 110;
          const dataStart = nameAligned;
          const isDir = (mode & 0o170000) === 0o040000;

          if (name === 'TRAILER!!!') break;

          let data = null;
          if (!isDir && fileSize > 0 && dataStart + fileSize <= bytes.length)
            data = bytes.slice(dataStart, dataStart + fileSize);

          const mod = mtime > 0 ? new Date(mtime * 1000) : null;
          entries.push(makeEntry(
            normalizeArchivePath(name), fileSize, fileSize, mod,
            data ? crc32Hex(data) : '', isDir, false, data, handler
          ));

          off = dataStart + this._align4(fileSize);
        } else if (magic === '070707') {
          if (off + 76 > bytes.length) break;
          const hdr = new TextDecoder().decode(bytes.subarray(off, off + 76));
          const fileSize = parseInt(hdr.substring(65, 76), 8);
          const nameSize = parseInt(hdr.substring(59, 65), 8);
          const mtime = parseInt(hdr.substring(48, 59), 8);

          const nameStart = off + 76;
          const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameSize - 1));
          const dataStart = nameStart + nameSize;

          if (name === 'TRAILER!!!') break;
          const isDir = name.endsWith('/');

          let data = null;
          if (!isDir && fileSize > 0 && dataStart + fileSize <= bytes.length)
            data = bytes.slice(dataStart, dataStart + fileSize);

          const mod = mtime > 0 ? new Date(mtime * 1000) : null;
          entries.push(makeEntry(normalizeArchivePath(name), fileSize, fileSize, mod, data ? crc32Hex(data) : '', isDir, false, data, handler));

          off = dataStart + fileSize;
        } else
          break;
      }
      return entries;
    }

    _align4(n) {
      return (n + 3) & ~3;
    }

    async build(entries, _password, options) {
      const fmt = (options && options.format) || 'newc';
      const parts = [];
      let inode = 1;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const raw = entry._data instanceof Uint8Array ? entry._data : null;
        if (!raw) continue;

        const name = entry.name;
        const nameBytes = new TextEncoder().encode(name);
        const nameSize = nameBytes.length + 1;
        const mtime = entry.modified ? Math.floor(entry.modified.getTime() / 1000) : 0;

        if (fmt === 'newc') {
          const hdr = '070701' +
            this._hex8(inode++) + this._hex8(0o100644) + this._hex8(0) + this._hex8(0) +
            this._hex8(1) + this._hex8(mtime) + this._hex8(raw.length) +
            this._hex8(0) + this._hex8(0) + this._hex8(0) + this._hex8(0) +
            this._hex8(nameSize) + this._hex8(0);

          const hdrBytes = new TextEncoder().encode(hdr);
          parts.push(hdrBytes);
          parts.push(nameBytes);
          parts.push(new Uint8Array([0]));
          const nameAlignPad = this._align4(110 + nameSize) - (110 + nameSize);
          if (nameAlignPad > 0) parts.push(new Uint8Array(nameAlignPad));
          parts.push(raw);
          const dataAlignPad = this._align4(raw.length) - raw.length;
          if (dataAlignPad > 0) parts.push(new Uint8Array(dataAlignPad));
        } else {
          const hdr = '070707' +
            this._oct6(0) + this._oct6(inode++) + this._oct6(0o100644) + this._oct6(0) + this._oct6(0) +
            this._oct6(1) + this._oct11(mtime) + this._oct6(nameSize) + this._oct11(raw.length);
          const hdrBytes = new TextEncoder().encode(hdr);
          parts.push(hdrBytes);
          parts.push(nameBytes);
          parts.push(new Uint8Array([0]));
          parts.push(raw);
        }
      }

      const trailerName = 'TRAILER!!!';
      const trailerNameBytes = new TextEncoder().encode(trailerName);
      if (fmt === 'newc') {
        const hdr = '070701' +
          this._hex8(0) + this._hex8(0) + this._hex8(0) + this._hex8(0) +
          this._hex8(1) + this._hex8(0) + this._hex8(0) +
          this._hex8(0) + this._hex8(0) + this._hex8(0) + this._hex8(0) +
          this._hex8(trailerNameBytes.length + 1) + this._hex8(0);
        parts.push(new TextEncoder().encode(hdr));
        parts.push(trailerNameBytes);
        parts.push(new Uint8Array([0]));
        const pad = this._align4(110 + trailerNameBytes.length + 1) - (110 + trailerNameBytes.length + 1);
        if (pad > 0) parts.push(new Uint8Array(pad));
      } else {
        const hdr = '070707' +
          this._oct6(0) + this._oct6(0) + this._oct6(0) + this._oct6(0) + this._oct6(0) +
          this._oct6(1) + this._oct11(0) + this._oct6(trailerNameBytes.length + 1) + this._oct11(0);
        parts.push(new TextEncoder().encode(hdr));
        parts.push(trailerNameBytes);
        parts.push(new Uint8Array([0]));
      }

      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let pos = 0;
      for (const p of parts) { result.set(p, pos); pos += p.length; }
      return result;
    }

    _hex8(val) { return val.toString(16).padStart(8, '0'); }
    _oct6(val) { return val.toString(8).padStart(6, '0'); }
    _oct11(val) { return val.toString(8).padStart(11, '0'); }
  }

  // =======================================================================
  // FORMAT: CAB (read-only)
  // =======================================================================

  class CabFormat extends IArchiveFormat {
    static get id() { return 'cab'; }
    static get displayName() { return 'Cabinet Archive'; }
    static get extensions() { return ['cab']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      return bytes[0] === 0x4D && bytes[1] === 0x53 && bytes[2] === 0x43 && bytes[3] === 0x46;
    }

    async parse(bytes, _fileName, _password) {
      const entries = [];
      const handler = this;

      if (bytes.length < 36) return entries;

      const cbCabinet = readU32LE(bytes, 8);
      const coffFiles = readU32LE(bytes, 16);
      const cFolders = readU16LE(bytes, 26);
      const cFiles = readU16LE(bytes, 28);
      const flags = readU16LE(bytes, 30);

      let off = 36;
      let cbCFFolder = 0;
      let cbCFData = 0;
      if (flags & 0x0004) {
        const cbCFHeader = readU16LE(bytes, off);
        cbCFFolder = bytes[off + 2];
        cbCFData = bytes[off + 3];
        off += 4 + cbCFHeader;
      }

      if (flags & 0x0001) {
        while (off < bytes.length && bytes[off] !== 0) ++off;
        ++off;
      }
      if (flags & 0x0002) {
        while (off < bytes.length && bytes[off] !== 0) ++off;
        ++off;
      }

      const folders = [];
      for (let i = 0; i < cFolders && off + 8 <= bytes.length; ++i) {
        const coffCabStart = readU32LE(bytes, off);
        const cCFDataBlocks = readU16LE(bytes, off + 4);
        const typeCompress = readU16LE(bytes, off + 6);
        folders.push({ coffCabStart, cCFDataBlocks, typeCompress, uncompData: null });
        off += 8 + cbCFFolder;
      }

      for (const folder of folders)
        folder.uncompData = await this._decompressFolderData(bytes, folder, cbCFData);

      const fileOff = coffFiles;
      off = fileOff;
      for (let i = 0; i < cFiles && off + 16 <= bytes.length; ++i) {
        const uncompSize = readU32LE(bytes, off);
        const uoffFolderStart = readU32LE(bytes, off + 4);
        const iFolder = readU16LE(bytes, off + 8);
        const date = readU16LE(bytes, off + 10);
        const time = readU16LE(bytes, off + 12);
        const attribs = readU16LE(bytes, off + 14);

        let nameEnd = off + 16;
        while (nameEnd < bytes.length && bytes[nameEnd] !== 0) ++nameEnd;
        const name = new TextDecoder().decode(bytes.subarray(off + 16, nameEnd));
        off = nameEnd + 1;

        const isDir = !!(attribs & 0x10);
        const mod = dosToDate(date, time);
        const folder = folders[iFolder];

        let data = null;
        if (!isDir && folder && folder.uncompData && uncompSize > 0) {
          if (uoffFolderStart + uncompSize <= folder.uncompData.length)
            data = folder.uncompData.slice(uoffFolderStart, uoffFolderStart + uncompSize);
        }

        entries.push(makeEntry(normalizeArchivePath(name), uncompSize, uncompSize, mod, data ? crc32Hex(data) : '', isDir, false, data, handler));
      }
      return entries;
    }

    async _decompressFolderData(bytes, folder, cbCFData) {
      const compType = folder.typeCompress & 0x000F;
      const blocks = [];
      let off = folder.coffCabStart;

      for (let i = 0; i < folder.cCFDataBlocks && off + 8 <= bytes.length; ++i) {
        const checksum = readU32LE(bytes, off);
        const cbData = readU16LE(bytes, off + 4);
        const cbUncomp = readU16LE(bytes, off + 6);
        const blockDataOff = off + 8 + cbCFData;
        if (blockDataOff + cbData > bytes.length) break;
        blocks.push({ data: bytes.subarray(blockDataOff, blockDataOff + cbData), cbUncomp });
        off = blockDataOff + cbData;
      }

      if (blocks.length === 0) return null;

      if (compType === 0) {
        const parts = blocks.map(b => b.data);
        return concatUint8Arrays(parts);
      }

      if (compType === 1) {
        const parts = [];
        for (const block of blocks) {
          if (block.data.length >= 2 && block.data[0] === 0x43 && block.data[1] === 0x4B) {
            try {
              const decompressed = await decompressDeflateRaw(block.data.subarray(2));
              parts.push(decompressed);
            } catch (_) {
              const fallback = await _tryDeflateDecompress(block.data.subarray(2));
              if (fallback) parts.push(fallback);
              else parts.push(block.data);
            }
          } else {
            try {
              const decompressed = await decompressDeflateRaw(block.data);
              parts.push(decompressed);
            } catch (_) {
              parts.push(block.data);
            }
          }
        }
        return concatUint8Arrays(parts);
      }

      if (compType === 3) {
        const allData = concatUint8Arrays(blocks.map(b => b.data));
        const result = await _tryLzxDecompress(allData);
        if (result) return result;
      }

      return null;
    }

    async build(_entries, _password, _options) { throw new Error('CAB creation not supported'); }
  }

  // =======================================================================
  // FORMAT: ISO 9660 (read-only)
  // =======================================================================

  class IsoFormat extends IArchiveFormat {
    static get id() { return 'iso'; }
    static get displayName() { return 'ISO 9660 Image'; }
    static get extensions() { return ['iso']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 32774) return false;
      return bytes[32769] === 0x43 && bytes[32770] === 0x44 && bytes[32771] === 0x30 && bytes[32772] === 0x30 && bytes[32773] === 0x31;
    }

    async parse(bytes, _fileName, _password) {
      const entries = [];
      const handler = this;

      const pvdOff = 32768;
      if (pvdOff + 2048 > bytes.length) return entries;

      const rootDirOff = pvdOff + 156;
      const rootExtent = readU32LE(bytes, rootDirOff + 2);
      const rootSize = readU32LE(bytes, rootDirOff + 10);

      this._readDirectory(bytes, rootExtent * 2048, rootSize, '', entries, handler);
      return entries;
    }

    _readDirectory(bytes, off, size, prefix, entries, handler) {
      const end = off + size;
      let pos = off;

      while (pos < end && pos + 33 <= bytes.length) {
        const recLen = bytes[pos];
        if (recLen === 0) {
          pos = ((Math.floor(pos / 2048) + 1) * 2048);
          continue;
        }
        if (pos + recLen > bytes.length) break;

        const extentLoc = readU32LE(bytes, pos + 2);
        const dataLen = readU32LE(bytes, pos + 10);
        const flags = bytes[pos + 25];
        const nameLen = bytes[pos + 32];
        const nameBytes = bytes.subarray(pos + 33, pos + 33 + nameLen);

        let name;
        if (nameLen === 1 && nameBytes[0] <= 1) {
          pos += recLen;
          continue;
        }

        name = new TextDecoder().decode(nameBytes);
        const semiIdx = name.indexOf(';');
        if (semiIdx >= 0) name = name.substring(0, semiIdx);
        if (name.endsWith('.')) name = name.substring(0, name.length - 1);

        const fullPath = prefix ? prefix + '/' + name : name;
        const isDir = !!(flags & 2);

        if (isDir) {
          entries.push(makeEntry(normalizeArchivePath(fullPath + '/'), 0, 0, null, '', true, false, null, handler));
          if (extentLoc * 2048 !== off)
            this._readDirectory(bytes, extentLoc * 2048, dataLen, fullPath, entries, handler);
        } else {
          const fileOff = extentLoc * 2048;
          let data = null;
          if (fileOff + dataLen <= bytes.length)
            data = bytes.slice(fileOff, fileOff + dataLen);
          entries.push(makeEntry(normalizeArchivePath(fullPath), dataLen, dataLen, null, data ? crc32Hex(data) : '', false, false, data, handler));
        }

        pos += recLen;
      }
    }

    async build(_entries, _password, _options) { throw new Error('ISO creation not supported'); }
  }

  // =======================================================================
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

  // =======================================================================
  // FORMAT: RPM (read-only)
  // =======================================================================

  class RpmFormat extends IArchiveFormat {
    static get id() { return 'rpm'; }
    static get displayName() { return 'RPM Package'; }
    static get extensions() { return ['rpm']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      return bytes[0] === 0xED && bytes[1] === 0xAB && bytes[2] === 0xEE && bytes[3] === 0xDB;
    }

    async parse(bytes, fileName, password) {
      const handler = this;
      let off = 96;

      for (let h = 0; h < 2 && off + 16 <= bytes.length; ++h) {
        if (bytes[off] !== 0x8E || bytes[off + 1] !== 0xAD || bytes[off + 2] !== 0xE8 || bytes[off + 3] !== 0x01) break;
        const nIndex = readU32BE(bytes, off + 8);
        const hSize = readU32BE(bytes, off + 12);
        off += 16 + nIndex * 16 + hSize;
        if (h === 0) off = (off + 7) & ~7;
      }

      if (off >= bytes.length) return [];

      const payload = bytes.subarray(off);

      if (payload.length >= 2 && payload[0] === 0x1F && payload[1] === 0x8B) {
        try {
          const decompressed = await decompressGzip(payload);
          const cpioHandler = new CpioFormat();
          const entries = await cpioHandler.parse(decompressed, fileName, password);
          for (const e of entries) e._handler = handler;
          return entries;
        } catch (_) {}
      }

      if (payload.length >= 6 && payload[0] === 0xFD && payload[1] === 0x37 && payload[2] === 0x7A && payload[3] === 0x58 && payload[4] === 0x5A && payload[5] === 0x00) {
        const xzHandler = new XzFormat();
        const xzEntries = await xzHandler.parse(payload, fileName, password);
        if (xzEntries.length && xzEntries[0]._data) {
          const cpioHandler = new CpioFormat();
          const entries = await cpioHandler.parse(xzEntries[0]._data, fileName, password);
          for (const e of entries) e._handler = handler;
          return entries;
        }
      }

      if (CpioFormat.detect(payload, '')) {
        const cpioHandler = new CpioFormat();
        const entries = await cpioHandler.parse(payload, fileName, password);
        for (const e of entries) e._handler = handler;
        return entries;
      }

      return [];
    }

    async build(_entries, _password, _options) { throw new Error('RPM creation not supported'); }
  }

  // =======================================================================
  // FORMAT: DEB (read-only)
  // =======================================================================

  class DebFormat extends IArchiveFormat {
    static get id() { return 'deb'; }
    static get displayName() { return 'Debian Package'; }
    static get extensions() { return ['deb']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      const magic = new TextDecoder().decode(bytes.subarray(0, 7));
      return magic === '!<arch>';
    }

    async parse(bytes, fileName, password) {
      const handler = this;
      let off = 8;
      let dataPayload = null;
      let dataName = '';

      while (off + 60 <= bytes.length) {
        const memberName = new TextDecoder().decode(bytes.subarray(off, off + 16)).trim();
        const sizeStr = new TextDecoder().decode(bytes.subarray(off + 48, off + 58)).trim();
        const size = parseInt(sizeStr, 10) || 0;
        off += 60;

        if (memberName.startsWith('data.tar')) {
          dataPayload = bytes.subarray(off, off + size);
          dataName = memberName;
        }

        off += size;
        if (off % 2 === 1) ++off;
      }

      if (!dataPayload) return [];

      if (dataName.includes('.gz') && dataPayload.length >= 2 && dataPayload[0] === 0x1F && dataPayload[1] === 0x8B) {
        const decompressed = await decompressGzip(dataPayload);
        const tarHandler = new TarFormat();
        const entries = await tarHandler.parse(decompressed, fileName, password);
        for (const e of entries) e._handler = handler;
        return entries;
      }

      if (dataName.includes('.xz') && dataPayload.length >= 6) {
        const xzHandler = new XzFormat();
        const xzEntries = await xzHandler.parse(dataPayload, fileName, password);
        if (xzEntries.length && xzEntries[0]._data) {
          const tarHandler = new TarFormat();
          const entries = await tarHandler.parse(xzEntries[0]._data, fileName, password);
          for (const e of entries) e._handler = handler;
          return entries;
        }
      }

      if (dataName.includes('.zst') && dataPayload.length >= 4) {
        const zstHandler = new ZstdFormat();
        const zstEntries = await zstHandler.parse(dataPayload, fileName, password);
        if (zstEntries.length && zstEntries[0]._data) {
          const tarHandler = new TarFormat();
          const entries = await tarHandler.parse(zstEntries[0]._data, fileName, password);
          for (const e of entries) e._handler = handler;
          return entries;
        }
      }

      if (dataName.includes('.bz2') && dataPayload.length >= 3) {
        const bz2Handler = new Bzip2Format();
        const bz2Entries = await bz2Handler.parse(dataPayload, fileName, password);
        if (bz2Entries.length && bz2Entries[0]._data) {
          const tarHandler = new TarFormat();
          const entries = await tarHandler.parse(bz2Entries[0]._data, fileName, password);
          for (const e of entries) e._handler = handler;
          return entries;
        }
      }

      return [];
    }

    async build(_entries, _password, _options) { throw new Error('DEB creation not supported'); }
  }

  // =======================================================================
  // FORMAT: JAR / WAR / EAR (Java Archives - ZIP variant)
  // =======================================================================

  class JarFormat extends IArchiveFormat {
    static get id() { return 'jar'; }
    static get displayName() { return 'Java Archive (JAR)'; }
    static get extensions() { return ['jar', 'war', 'ear']; }
    static get canCreate() { return true; }
    static get supportsEncryption() { return true; }
    static getCreateOptions() { return ZipFormat.getCreateOptions(); }
    static detect(bytes, fileName) {
      if (!ZipFormat.detect(bytes, fileName)) return false;
      const ext = getFileExtension(fileName || '');
      return ext === 'jar' || ext === 'war' || ext === 'ear';
    }
    async parse(bytes, fn, pw) { return new ZipFormat().parse(bytes, fn, pw); }
    async build(entries, pw, opts) { return new ZipFormat().build(entries, pw, opts); }
  }

  // =======================================================================
  // FORMAT: APK (Android Package - ZIP variant)
  // =======================================================================

  class ApkFormat extends IArchiveFormat {
    static get id() { return 'apk'; }
    static get displayName() { return 'Android Package (APK)'; }
    static get extensions() { return ['apk']; }
    static get canCreate() { return true; }
    static get supportsEncryption() { return true; }
    static getCreateOptions() { return ZipFormat.getCreateOptions(); }
    static detect(bytes, fileName) {
      if (!ZipFormat.detect(bytes, fileName)) return false;
      return getFileExtension(fileName || '') === 'apk';
    }
    async parse(bytes, fn, pw) { return new ZipFormat().parse(bytes, fn, pw); }
    async build(entries, pw, opts) { return new ZipFormat().build(entries, pw, opts); }
  }

  // =======================================================================
  // FORMAT: EPUB (Electronic Publication - ZIP variant)
  // =======================================================================

  class EpubFormat extends IArchiveFormat {
    static get id() { return 'epub'; }
    static get displayName() { return 'Electronic Publication (EPUB)'; }
    static get extensions() { return ['epub']; }
    static get canCreate() { return true; }
    static getCreateOptions() { return ZipFormat.getCreateOptions(); }
    static detect(bytes, fileName) {
      if (!ZipFormat.detect(bytes, fileName)) return false;
      return getFileExtension(fileName || '') === 'epub';
    }
    async parse(bytes, fn, pw) { return new ZipFormat().parse(bytes, fn, pw); }
    async build(entries, pw, opts) { return new ZipFormat().build(entries, pw, opts); }
  }

  // =======================================================================
  // FORMAT: OOXML (Office Open XML - ZIP variant)
  // =======================================================================

  class OoxmlFormat extends IArchiveFormat {
    static get id() { return 'ooxml'; }
    static get displayName() { return 'Office Open XML'; }
    static get extensions() { return ['docx', 'xlsx', 'pptx', 'docm', 'xlsm', 'pptm']; }
    static get canCreate() { return true; }
    static getCreateOptions() { return ZipFormat.getCreateOptions(); }
    static detect(bytes, fileName) {
      if (!ZipFormat.detect(bytes, fileName)) return false;
      const ext = getFileExtension(fileName || '');
      return ['docx', 'xlsx', 'pptx', 'docm', 'xlsm', 'pptm'].includes(ext);
    }
    async parse(bytes, fn, pw) { return new ZipFormat().parse(bytes, fn, pw); }
    async build(entries, pw, opts) { return new ZipFormat().build(entries, pw, opts); }
  }

  // =======================================================================
  // FORMAT: ODF (Open Document Format - ZIP variant)
  // =======================================================================

  class OdfFormat extends IArchiveFormat {
    static get id() { return 'odf'; }
    static get displayName() { return 'Open Document Format'; }
    static get extensions() { return ['odt', 'ods', 'odp', 'odg', 'odf']; }
    static get canCreate() { return true; }
    static getCreateOptions() { return ZipFormat.getCreateOptions(); }
    static detect(bytes, fileName) {
      if (!ZipFormat.detect(bytes, fileName)) return false;
      const ext = getFileExtension(fileName || '');
      return ['odt', 'ods', 'odp', 'odg', 'odf'].includes(ext);
    }
    async parse(bytes, fn, pw) { return new ZipFormat().parse(bytes, fn, pw); }
    async build(entries, pw, opts) { return new ZipFormat().build(entries, pw, opts); }
  }

  // =======================================================================
  // FORMAT: ZIPX (Extended ZIP)
  // =======================================================================

  class ZipxFormat extends IArchiveFormat {
    static get id() { return 'zipx'; }
    static get displayName() { return 'ZIPX Archive'; }
    static get extensions() { return ['zipx']; }
    static get canCreate() { return true; }
    static get supportsEncryption() { return true; }
    static getCreateOptions() { return ZipFormat.getCreateOptions(); }
    static detect(bytes, fileName) {
      if (!ZipFormat.detect(bytes, fileName)) return false;
      return getFileExtension(fileName || '') === 'zipx';
    }
    async parse(bytes, fn, pw) { return new ZipFormat().parse(bytes, fn, pw); }
    async build(entries, pw, opts) { return new ZipFormat().build(entries, pw, opts); }
  }

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
  // FORMAT: UUEncode (.uue)
  // =======================================================================

  class UueFormat extends IArchiveFormat {
    static get id() { return 'uue'; }
    static get displayName() { return 'UUEncoded'; }
    static get extensions() { return ['uue', 'uu']; }
    static get canCreate() { return true; }

    static detect(bytes, _fileName) {
      if (bytes.length < 10) return false;
      const header = new TextDecoder().decode(bytes.subarray(0, Math.min(100, bytes.length)));
      return /^begin\s+[0-7]{3,4}\s+\S+/m.test(header);
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const text = new TextDecoder().decode(bytes);
      const match = text.match(/^begin\s+[0-7]{3,4}\s+(.+)$/m);
      if (!match) return [];
      const entryName = match[1].trim();
      const lines = text.split('\n');
      const chunks = [];
      let started = false;

      for (const line of lines) {
        if (line.startsWith('begin ')) { started = true; continue; }
        if (!started || line.length === 0) continue;
        if (line === '`' || line.startsWith('end')) break;
        const n = (line.charCodeAt(0) - 32) & 63;
        if (n === 0) break;
        const decoded = new Uint8Array(n);
        let di = 0;
        for (let i = 1; i < line.length && di < n; i += 4) {
          const c = [0, 1, 2, 3].map(j => (line.charCodeAt(i + j) - 32) & 63);
          if (di < n) decoded[di++] = (c[0] << 2) | (c[1] >> 4);
          if (di < n) decoded[di++] = ((c[1] & 0xF) << 4) | (c[2] >> 2);
          if (di < n) decoded[di++] = ((c[2] & 3) << 6) | c[3];
        }
        chunks.push(decoded);
      }

      let total = 0;
      for (const c of chunks) total += c.length;
      const data = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { data.set(c, off); off += c.length; }
      return [makeEntry(entryName, data.length, bytes.length, null, crc32Hex(data), false, false, data, handler)];
    }

    async build(entries, _password, _options) {
      if (entries.length === 0) return new Uint8Array(0);
      const entry = entries[0];
      const data = entry._data instanceof Uint8Array ? entry._data : new Uint8Array(await entry._data());
      const name = entry.name || 'file';
      let text = 'begin 644 ' + name + '\n';
      for (let off = 0; off < data.length; off += 45) {
        const chunk = data.subarray(off, Math.min(off + 45, data.length));
        const n = chunk.length;
        let line = String.fromCharCode(n + 32);
        for (let i = 0; i < n; i += 3) {
          const b0 = chunk[i] || 0, b1 = chunk[i + 1] || 0, b2 = chunk[i + 2] || 0;
          line += String.fromCharCode(((b0 >> 2) & 63) + 32, (((b0 & 3) << 4) | (b1 >> 4)) + 32,
            (((b1 & 0xF) << 2) | (b2 >> 6)) + 32, (b2 & 63) + 32);
        }
        text += line + '\n';
      }
      text += '`\nend\n';
      return new TextEncoder().encode(text);
    }
  }

  // =======================================================================
  // FORMAT: TAR.LZMA (.tar.lzma / .tlz)
  // =======================================================================

  class TarLzmaFormat extends IArchiveFormat {
    static get id() { return 'tar.lzma'; }
    static get displayName() { return 'TAR + LZMA'; }
    static get extensions() { return ['tlz']; }
    static get canCreate() { return true; }

    static detect(bytes, fileName) {
      if (bytes.length < 13) return false;
      const name = (fileName || '').toLowerCase();
      return (name.endsWith('.tar.lzma') || (getFileExtension(name) === 'tlz' && bytes[0] === 0x5D));
    }

    async parse(bytes, fileName, password) {
      const handler = this;
      const lzmaEntries = await new LzmaFormat().parse(bytes, fileName, password);
      if (lzmaEntries.length && lzmaEntries[0]._data) {
        const entries = await new TarFormat().parse(lzmaEntries[0]._data, fileName, password);
        for (const e of entries) e._handler = handler;
        return entries;
      }
      return lzmaEntries;
    }

    async build(entries, password, options) {
      const tarData = await new TarFormat().build(entries, password, options);
      return new LzmaFormat().build([makeEntry('a.tar', tarData.length, tarData.length, null, null, false, false, tarData, null)], null, options);
    }
  }

  // =======================================================================
  // FORMAT: TAR.LZ (.tar.lz)
  // =======================================================================

  class TarLzFormat extends IArchiveFormat {
    static get id() { return 'tar.lz'; }
    static get displayName() { return 'TAR + LZIP'; }
    static get extensions() { return []; }
    static get canCreate() { return true; }

    static detect(bytes, fileName) {
      if (bytes.length < 6) return false;
      const name = (fileName || '').toLowerCase();
      return name.endsWith('.tar.lz') && bytes[0] === 0x4C && bytes[1] === 0x5A && bytes[2] === 0x49 && bytes[3] === 0x50;
    }

    async parse(bytes, fileName, password) {
      const handler = this;
      const lzEntries = await new LzipFormat().parse(bytes, fileName, password);
      if (lzEntries.length && lzEntries[0]._data) {
        const entries = await new TarFormat().parse(lzEntries[0]._data, fileName, password);
        for (const e of entries) e._handler = handler;
        return entries;
      }
      return lzEntries;
    }

    async build(entries, password, options) {
      const tarData = await new TarFormat().build(entries, password, options);
      return new LzipFormat().build([makeEntry('a.tar', tarData.length, tarData.length, null, null, false, false, tarData, null)], null, options);
    }
  }

  // =======================================================================
  // FORMAT: Unix AR Archive (.a / .lib)
  // =======================================================================

  class ArFormat extends IArchiveFormat {
    static get id() { return 'ar'; }
    static get displayName() { return 'Unix AR Archive'; }
    static get extensions() { return ['a', 'ar', 'lib']; }
    static get canCreate() { return true; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      const magic = new TextDecoder().decode(bytes.subarray(0, 7));
      if (magic !== '!<arch>') return false;
      let off = 8;
      if (off + 60 <= bytes.length) {
        const memberName = new TextDecoder().decode(bytes.subarray(off, off + 16)).trim();
        if (memberName === 'debian-binary') return false;
      }
      return true;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      let off = 8;
      let extNames = null;

      while (off + 60 <= bytes.length) {
        const nameRaw = new TextDecoder().decode(bytes.subarray(off, off + 16)).trim();
        const modStr = new TextDecoder().decode(bytes.subarray(off + 16, off + 28)).trim();
        const sizeStr = new TextDecoder().decode(bytes.subarray(off + 48, off + 58)).trim();
        const size = parseInt(sizeStr, 10) || 0;
        off += 60;

        if (nameRaw === '//') {
          extNames = new TextDecoder().decode(bytes.subarray(off, off + size));
          off += size;
          if (off % 2 === 1) ++off;
          continue;
        }

        let entryName = nameRaw.replace(/\/$/, '');
        if (entryName.startsWith('/') && extNames) {
          const idx = parseInt(entryName.substring(1), 10);
          const end = extNames.indexOf('/\n', idx);
          entryName = extNames.substring(idx, end >= 0 ? end : undefined).trim();
        }
        if (entryName === '/' || entryName === '') { off += size; if (off % 2 === 1) ++off; continue; }

        const modified = modStr ? new Date(parseInt(modStr, 10) * 1000) : null;
        const data = bytes.slice(off, off + size);
        entries.push(makeEntry(entryName, size, size, modified, crc32Hex(data), false, false, data, handler));
        off += size;
        if (off % 2 === 1) ++off;
      }
      return entries;
    }

    async build(entries, _password, _options) {
      const parts = [new TextEncoder().encode('!<arch>\n')];
      for (const entry of entries) {
        const data = entry._data instanceof Uint8Array ? entry._data : new Uint8Array(await entry._data());
        const name = (entry.name || 'file').substring(0, 15) + '/';
        const headerStr = name.padEnd(16) + String(Math.floor(Date.now() / 1000)).padEnd(12) +
          '0'.padEnd(6) + '0'.padEnd(6) + '100644'.padEnd(8) + String(data.length).padEnd(10) + '`\n';
        parts.push(new TextEncoder().encode(headerStr));
        parts.push(data);
        if (data.length % 2 === 1) parts.push(new Uint8Array([0x0A]));
      }
      let total = 0;
      for (const p of parts) total += p.length;
      const result = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { result.set(p, off); off += p.length; }
      return result;
    }
  }

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
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

  // =======================================================================
  // FORMAT: SHAR (Shell Archive)
  // =======================================================================

  class SharFormat extends IArchiveFormat {
    static get id() { return 'shar'; }
    static get displayName() { return 'Shell Archive'; }
    static get extensions() { return ['shar', 'sh']; }

    static detect(bytes, fileName) {
      if (bytes.length < 20) return false;
      const header = new TextDecoder().decode(bytes.subarray(0, Math.min(256, bytes.length)));
      return header.startsWith('#!/bin/sh') && /\bshar\b/i.test(header) ||
             (getFileExtension(fileName || '') === 'shar' && header.startsWith('#'));
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const text = new TextDecoder().decode(bytes);
      const entries = [];
      const heredocRe = /cat\s*>\s*'?([^'\s]+)'?\s*<<\s*'?(\w+)'?/g;
      let m;
      while ((m = heredocRe.exec(text)) !== null) {
        const name = m[1];
        const delim = m[2];
        const contentStart = text.indexOf('\n', m.index + m[0].length) + 1;
        const contentEnd = text.indexOf('\n' + delim + '\n', contentStart);
        if (contentEnd < 0) continue;
        const content = text.substring(contentStart, contentEnd);
        const data = new TextEncoder().encode(content);
        entries.push(makeEntry(name, data.length, data.length, null, crc32Hex(data), false, false, data, handler));
      }
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('SHAR creation not supported'); }
  }

  // =======================================================================
  // FORMAT: WIM (Windows Imaging Format)
  // =======================================================================

  class WimFormat extends IArchiveFormat {
    static get id() { return 'wim'; }
    static get displayName() { return 'Windows Imaging Format'; }
    static get extensions() { return ['wim', 'swm', 'esd']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      return bytes[0] === 0x4D && bytes[1] === 0x53 && bytes[2] === 0x57 && bytes[3] === 0x49 &&
             bytes[4] === 0x4D && bytes[5] === 0x00 && bytes[6] === 0x00 && bytes[7] === 0x00;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const entries = [];
      if (bytes.length < 208) return [makeEntry(getFileName(fileName || 'image.wim'), bytes.length, bytes.length, null, null, false, false, null, handler)];
      const headerSize = readU32LE(bytes, 8);
      const imageCount = readU32LE(bytes, 40);
      for (let i = 0; i < imageCount; ++i)
        entries.push(makeEntry('Image ' + (i + 1), null, null, null, null, true, false, null, handler));
      return entries.length ? entries : [makeEntry(getFileName(fileName || 'image.wim'), bytes.length, bytes.length, null, null, false, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('WIM creation not supported'); }
  }

  // =======================================================================
  // FORMAT: XAR (.xar)
  // =======================================================================

  class XarFormat extends IArchiveFormat {
    static get id() { return 'xar'; }
    static get displayName() { return 'XAR Archive'; }
    static get extensions() { return ['xar', 'pkg']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      return bytes[0] === 0x78 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const entries = [];
      if (bytes.length < 28) return [];
      const headerSize = readU16BE(bytes, 4);
      const tocLenComp = readU32BE(bytes, 8);
      const tocLenUncomp = readU32BE(bytes, 16);
      if (headerSize + tocLenComp > bytes.length) return [];

      try {
        const tocCompressed = bytes.subarray(headerSize, headerSize + tocLenComp);
        const tocXml = await decompressGzip(new Uint8Array([0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, ...tocCompressed]));
        const tocStr = new TextDecoder().decode(tocXml);
        const fileRe = /<name>([^<]+)<\/name>[\s\S]*?<size>(\d+)<\/size>[\s\S]*?<offset>(\d+)<\/offset>[\s\S]*?<length>(\d+)<\/length>/g;
        let fm;
        while ((fm = fileRe.exec(tocStr)) !== null) {
          const name = fm[1], size = parseInt(fm[2], 10), offset = parseInt(fm[3], 10), length = parseInt(fm[4], 10);
          const dataStart = headerSize + tocLenComp + offset;
          const data = (length === size && dataStart + length <= bytes.length) ? bytes.slice(dataStart, dataStart + length) : null;
          entries.push(makeEntry(name, size, length, null, null, false, false, data, handler));
        }
      } catch (_) {}
      if (entries.length === 0)
        entries.push(makeEntry(getFileName(fileName || 'archive.xar'), bytes.length, bytes.length, null, null, false, false, null, handler));
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('XAR creation not supported'); }
  }

  // =======================================================================
  // FORMAT: MSI / OLE Compound Document
  // =======================================================================

  class MsiFormat extends IArchiveFormat {
    static get id() { return 'msi'; }
    static get displayName() { return 'OLE Compound Document'; }
    static get extensions() { return ['msi', 'msp', 'mst', 'doc', 'xls', 'ppt', 'msg']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      return bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0 &&
             bytes[4] === 0xA1 && bytes[5] === 0xB1 && bytes[6] === 0x1A && bytes[7] === 0xE1;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      if (bytes.length < 512) return [];
      const sectorSize = 1 << readU16LE(bytes, 30);
      const dirStart = readU32LE(bytes, 48);
      const dirOff = 512 + dirStart * sectorSize;

      for (let i = 0; dirOff + (i + 1) * 128 <= bytes.length && i < 200; ++i) {
        const entryOff = dirOff + i * 128;
        const nameLen = readU16LE(bytes, entryOff + 64);
        if (nameLen <= 2) continue;
        let name = '';
        for (let j = 0; j < nameLen - 2; j += 2)
          name += String.fromCharCode(readU16LE(bytes, entryOff + j));
        const type = bytes[entryOff + 66];
        const size = readU32LE(bytes, entryOff + 120);
        const isDir = type === 1 || type === 5;
        if (type >= 1 && type <= 5 && name && !name.startsWith('\x05'))
          entries.push(makeEntry(name, isDir ? null : size, isDir ? null : size, null, null, isDir, false, null, handler));
      }
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('OLE creation not supported'); }
  }

  // =======================================================================
  // FORMAT: CHM (Compiled HTML Help)
  // =======================================================================

  class ChmFormat extends IArchiveFormat {
    static get id() { return 'chm'; }
    static get displayName() { return 'Compiled HTML Help'; }
    static get extensions() { return ['chm', 'chi', 'chq', 'chw']; }

    static detect(bytes, _fileName) {
      return bytes.length >= 4 && bytes[0] === 0x49 && bytes[1] === 0x54 && bytes[2] === 0x53 && bytes[3] === 0x46;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      return [makeEntry(getFileName(fileName || 'help.chm'), bytes.length, bytes.length, null, null, false, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('CHM creation not supported'); }
  }

  // =======================================================================
  // FORMAT: NSIS Installer (read-only)
  // =======================================================================

  class NsisFormat extends IArchiveFormat {
    static get id() { return 'nsis'; }
    static get displayName() { return 'NSIS Installer'; }
    static get extensions() { return []; }

    static detect(bytes, _fileName) {
      if (bytes.length < 512 || bytes[0] !== 0x4D || bytes[1] !== 0x5A) return false;
      const searchLen = Math.min(bytes.length, 524288);
      const needle = [0xEF, 0xBE, 0xAD, 0xDE, 0x4E, 0x75, 0x6C, 0x6C];
      for (let i = 0; i < searchLen - needle.length; ++i) {
        let found = true;
        for (let j = 0; j < needle.length; ++j)
          if (bytes[i + j] !== needle[j]) { found = false; break; }
        if (found) return true;
      }
      return false;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      return [makeEntry(getFileName(fileName || 'installer.exe'), bytes.length, bytes.length, null, null, false, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('NSIS creation not supported'); }
  }

  // =======================================================================
  // FORMAT: DMG (Apple Disk Image)
  // =======================================================================

  class DmgFormat extends IArchiveFormat {
    static get id() { return 'dmg'; }
    static get displayName() { return 'Apple Disk Image'; }
    static get extensions() { return ['dmg']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 512) return false;
      const trailerOff = bytes.length - 512;
      return bytes[trailerOff] === 0x6B && bytes[trailerOff + 1] === 0x6F &&
             bytes[trailerOff + 2] === 0x6C && bytes[trailerOff + 3] === 0x79;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      return [makeEntry(getFileName(fileName || 'image.dmg'), bytes.length, bytes.length, null, null, false, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('DMG creation not supported'); }
  }

  // =======================================================================
  // FORMAT: SquashFS
  // =======================================================================

  class SquashFsFormat extends IArchiveFormat {
    static get id() { return 'squashfs'; }
    static get displayName() { return 'SquashFS Image'; }
    static get extensions() { return ['squashfs', 'sfs', 'snap']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      return (bytes[0] === 0x68 && bytes[1] === 0x73 && bytes[2] === 0x71 && bytes[3] === 0x73) ||
             (bytes[0] === 0x73 && bytes[1] === 0x71 && bytes[2] === 0x73 && bytes[3] === 0x68);
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const le = bytes[0] === 0x68;
      const r32 = le ? (o) => readU32LE(bytes, o) : (o) => readU32BE(bytes, o);
      const inodeCount = r32(4);
      const blockSize = r32(12);
      const fragCount = r32(16);
      const comp = readU16LE(bytes, 20);
      const compNames = { 1: 'gzip', 2: 'lzma', 3: 'lzo', 4: 'xz', 5: 'lz4', 6: 'zstd' };
      const entries = [];
      entries.push(makeEntry('[SquashFS: ' + (inodeCount || '?') + ' inodes, ' + (compNames[comp] || 'unknown') + ' compression, block=' + (blockSize || '?') + ']',
        null, bytes.length, null, null, true, false, null, handler));
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('SquashFS creation not supported'); }
  }

  // =======================================================================
  // FORMAT: CramFS
  // =======================================================================

  class CramFsFormat extends IArchiveFormat {
    static get id() { return 'cramfs'; }
    static get displayName() { return 'CramFS Image'; }
    static get extensions() { return ['cramfs']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      return (bytes[0] === 0x45 && bytes[1] === 0x3D && bytes[2] === 0xCD && bytes[3] === 0x28) ||
             (bytes[0] === 0x28 && bytes[1] === 0xCD && bytes[2] === 0x3D && bytes[3] === 0x45);
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const le = bytes[0] === 0x45;
      const r32 = le ? (o) => readU32LE(bytes, o) : (o) => readU32BE(bytes, o);
      const fsSize = r32(4);
      const fileCount = r32(36);
      return [makeEntry('[CramFS: ' + (fileCount || '?') + ' files, ' + formatSize(fsSize) + ']',
        fsSize, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('CramFS creation not supported'); }
  }

  // =======================================================================
  // FORMAT: UDF (Universal Disc Format)
  // =======================================================================

  class UdfFormat extends IArchiveFormat {
    static get id() { return 'udf'; }
    static get displayName() { return 'UDF Image'; }
    static get extensions() { return ['udf']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 32774) return false;
      for (let sector = 16; sector <= 32; ++sector) {
        const off = sector * 2048 + 1;
        if (off + 5 > bytes.length) continue;
        if (bytes[off] === 0x4E && bytes[off + 1] === 0x53 && bytes[off + 2] === 0x52 && bytes[off + 3] === 0x30)
          return true;
        if (bytes[off] === 0x42 && bytes[off + 1] === 0x45 && bytes[off + 2] === 0x41 && bytes[off + 3] === 0x30 && bytes[off + 4] === 0x31)
          return true;
      }
      return false;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      return [makeEntry(getFileName(fileName || 'disc.udf'), bytes.length, bytes.length, null, null, false, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('UDF creation not supported'); }
  }

  // =======================================================================
  // FORMAT: FAT12/16/32
  // =======================================================================

  class FatFormat extends IArchiveFormat {
    static get id() { return 'fat'; }
    static get displayName() { return 'FAT Filesystem Image'; }
    static get extensions() { return ['fat', 'img']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 512) return false;
      if (bytes[510] !== 0x55 || bytes[511] !== 0xAA) return false;
      if (bytes[0] !== 0xEB && bytes[0] !== 0xE9) return false;
      const bytesPerSector = readU16LE(bytes, 11);
      return bytesPerSector === 512 || bytesPerSector === 1024 || bytesPerSector === 2048 || bytesPerSector === 4096;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      const bytesPerSector = readU16LE(bytes, 11);
      const sectorsPerCluster = bytes[13];
      const reservedSectors = readU16LE(bytes, 14);
      const numFATs = bytes[16];
      const rootEntryCount = readU16LE(bytes, 17);
      const totalSectors16 = readU16LE(bytes, 19);
      const fatSize16 = readU16LE(bytes, 22);
      const totalSectors32 = readU32LE(bytes, 32);
      const fatSize32 = readU32LE(bytes, 36);
      const totalSectors = totalSectors16 || totalSectors32;
      const fatSize = fatSize16 || fatSize32;
      const isFat32 = rootEntryCount === 0;

      const rootDirSectors = Math.ceil((rootEntryCount * 32) / bytesPerSector);
      const firstDataSector = reservedSectors + numFATs * fatSize + rootDirSectors;

      if (!isFat32) {
        const rootDirOff = (reservedSectors + numFATs * fatSize) * bytesPerSector;
        for (let i = 0; i < rootEntryCount; ++i) {
          const eo = rootDirOff + i * 32;
          if (eo + 32 > bytes.length) break;
          if (bytes[eo] === 0x00) break;
          if (bytes[eo] === 0xE5) continue;
          if (bytes[eo + 11] === 0x0F) continue;
          let name = '';
          for (let j = 0; j < 8; ++j) { if (bytes[eo + j] === 0x20) break; name += String.fromCharCode(bytes[eo + j]); }
          let ext = '';
          for (let j = 8; j < 11; ++j) { if (bytes[eo + j] === 0x20) break; ext += String.fromCharCode(bytes[eo + j]); }
          const fullName = ext ? name + '.' + ext : name;
          const attr = bytes[eo + 11];
          const isDir = (attr & 0x10) !== 0;
          const size = readU32LE(bytes, eo + 28);
          const dosTime = readU16LE(bytes, eo + 22);
          const dosDate = readU16LE(bytes, eo + 24);
          const modified = dosToDate(dosDate, dosTime);
          const cluster = readU16LE(bytes, eo + 26);
          let data = null;
          if (!isDir && size > 0 && cluster >= 2) {
            const dataOff = (firstDataSector + (cluster - 2) * sectorsPerCluster) * bytesPerSector;
            if (dataOff + size <= bytes.length)
              data = bytes.slice(dataOff, dataOff + size);
          }
          if (fullName && fullName !== '.' && fullName !== '..')
            entries.push(makeEntry(fullName, isDir ? null : size, isDir ? null : size, modified, data ? crc32Hex(data) : null, isDir, false, data, handler));
        }
      } else {
        entries.push(makeEntry('[FAT32 filesystem, ' + formatSize(totalSectors * bytesPerSector) + ']', null, bytes.length, null, null, true, false, null, handler));
      }

      if (entries.length === 0)
        entries.push(makeEntry('[FAT filesystem, ' + formatSize(totalSectors * bytesPerSector) + ']', null, bytes.length, null, null, true, false, null, handler));
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('FAT image creation not supported'); }
  }

  // =======================================================================
  // FORMAT: NTFS
  // =======================================================================

  class NtfsFormat extends IArchiveFormat {
    static get id() { return 'ntfs'; }
    static get displayName() { return 'NTFS Image'; }
    static get extensions() { return ['ntfs']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 12) return false;
      return bytes[3] === 0x4E && bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x53 && bytes[7] === 0x20;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const bytesPerSector = readU16LE(bytes, 11);
      const sectorsPerCluster = bytes[13];
      const totalSectors = Number(new DataView(bytes.buffer, bytes.byteOffset + 40, 8).getBigInt64(0, true));
      const totalSize = totalSectors * bytesPerSector;
      return [makeEntry('[NTFS, ' + formatSize(totalSize) + ', cluster=' + (bytesPerSector * sectorsPerCluster) + ']',
        totalSize, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('NTFS image creation not supported'); }
  }

  // =======================================================================
  // FORMAT: EXT2/3/4
  // =======================================================================

  class ExtFormat extends IArchiveFormat {
    static get id() { return 'ext'; }
    static get displayName() { return 'EXT2/3/4 Image'; }
    static get extensions() { return ['ext2', 'ext3', 'ext4']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 1084) return false;
      return bytes[1080] === 0x53 && bytes[1081] === 0xEF;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const inodeCount = readU32LE(bytes, 1024);
      const blockCount = readU32LE(bytes, 1028);
      const blockSize = 1024 << readU32LE(bytes, 1048);
      const featCompat = readU32LE(bytes, 1116);
      const version = (featCompat & 0x40) ? '3' : (featCompat & 0x200) ? '4' : '2';
      return [makeEntry('[ext' + version + ', ' + inodeCount + ' inodes, ' + formatSize(blockCount * blockSize) + ']',
        blockCount * blockSize, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('EXT image creation not supported'); }
  }

  // =======================================================================
  // FORMAT: HFS+
  // =======================================================================

  class HfsFormat extends IArchiveFormat {
    static get id() { return 'hfs'; }
    static get displayName() { return 'HFS+ Image'; }
    static get extensions() { return ['hfs']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 1028) return false;
      return (bytes[1024] === 0x48 && bytes[1025] === 0x2B) ||
             (bytes[1024] === 0x48 && bytes[1025] === 0x58);
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const version = bytes[1025] === 0x58 ? 'HFSX' : 'HFS+';
      const blockSize = readU32BE(bytes, 1064);
      const totalBlocks = readU32BE(bytes, 1068);
      return [makeEntry('[' + version + ', ' + formatSize(blockSize * totalBlocks) + ']',
        blockSize * totalBlocks, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('HFS+ image creation not supported'); }
  }

  // =======================================================================
  // FORMAT: APFS
  // =======================================================================

  class ApfsFormat extends IArchiveFormat {
    static get id() { return 'apfs'; }
    static get displayName() { return 'APFS Container'; }
    static get extensions() { return ['apfs']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 36) return false;
      return bytes[32] === 0x4E && bytes[33] === 0x58 && bytes[34] === 0x53 && bytes[35] === 0x42;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const blockSize = readU32LE(bytes, 40);
      return [makeEntry('[APFS Container, block=' + blockSize + ']', null, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('APFS creation not supported'); }
  }

  // =======================================================================
  // FORMAT: QCOW2 (QEMU Copy-On-Write)
  // =======================================================================

  class Qcow2Format extends IArchiveFormat {
    static get id() { return 'qcow2'; }
    static get displayName() { return 'QCOW2 Disk Image'; }
    static get extensions() { return ['qcow2', 'qcow']; }

    static detect(bytes, _fileName) {
      return bytes.length >= 8 && bytes[0] === 0x51 && bytes[1] === 0x46 && bytes[2] === 0x49 && bytes[3] === 0xFB;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const version = readU32BE(bytes, 4);
      const vSize = new DataView(bytes.buffer, bytes.byteOffset + 24, 8);
      const virtualSize = Number(vSize.getBigUint64(0, false));
      const clusterBits = readU32BE(bytes, 20);
      return [makeEntry('[QCOW' + version + ', ' + formatSize(virtualSize) + ', cluster=' + (1 << clusterBits) + ']',
        virtualSize, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('QCOW2 creation not supported'); }
  }

  // =======================================================================
  // FORMAT: VHD (Virtual Hard Disk)
  // =======================================================================

  class VhdFormat extends IArchiveFormat {
    static get id() { return 'vhd'; }
    static get displayName() { return 'VHD Disk Image'; }
    static get extensions() { return ['vhd']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      return bytes[0] === 0x63 && bytes[1] === 0x6F && bytes[2] === 0x6E && bytes[3] === 0x65 &&
             bytes[4] === 0x63 && bytes[5] === 0x74 && bytes[6] === 0x69 && bytes[7] === 0x78;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, Math.min(bytes.length, 512));
      const diskType = dv.getUint32(60, false);
      const currentSize = Number(dv.getBigUint64(48, false));
      const typeNames = { 2: 'Fixed', 3: 'Dynamic', 4: 'Differencing' };
      return [makeEntry('[VHD ' + (typeNames[diskType] || 'Unknown') + ', ' + formatSize(currentSize) + ']',
        currentSize, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('VHD creation not supported'); }
  }

  // =======================================================================
  // FORMAT: VHDX
  // =======================================================================

  class VhdxFormat extends IArchiveFormat {
    static get id() { return 'vhdx'; }
    static get displayName() { return 'VHDX Disk Image'; }
    static get extensions() { return ['vhdx']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      return bytes[0] === 0x76 && bytes[1] === 0x68 && bytes[2] === 0x64 && bytes[3] === 0x78 &&
             bytes[4] === 0x66 && bytes[5] === 0x69 && bytes[6] === 0x6C && bytes[7] === 0x65;
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      return [makeEntry('[VHDX Disk Image]', null, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('VHDX creation not supported'); }
  }

  // =======================================================================
  // FORMAT: VDI (VirtualBox Disk Image)
  // =======================================================================

  class VdiFormat extends IArchiveFormat {
    static get id() { return 'vdi'; }
    static get displayName() { return 'VDI Disk Image'; }
    static get extensions() { return ['vdi']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 68) return false;
      return bytes[64] === 0x7F && bytes[65] === 0x10 && bytes[66] === 0xDA && bytes[67] === 0xBE;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const imageType = readU32LE(bytes, 76);
      const diskSize = Number(new DataView(bytes.buffer, bytes.byteOffset + 368, 8).getBigUint64(0, true));
      const typeNames = { 1: 'Dynamic', 2: 'Fixed', 3: 'Undo', 4: 'Differencing' };
      return [makeEntry('[VDI ' + (typeNames[imageType] || 'Unknown') + ', ' + formatSize(diskSize) + ']',
        diskSize, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('VDI creation not supported'); }
  }

  // =======================================================================
  // FORMAT: VMDK (VMware Disk)
  // =======================================================================

  class VmdkFormat extends IArchiveFormat {
    static get id() { return 'vmdk'; }
    static get displayName() { return 'VMDK Disk Image'; }
    static get extensions() { return ['vmdk']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 4) return false;
      if (bytes[0] === 0x4B && bytes[1] === 0x44 && bytes[2] === 0x4D && bytes[3] === 0x56) return true;
      const header = new TextDecoder().decode(bytes.subarray(0, Math.min(64, bytes.length)));
      return header.startsWith('# Disk DescriptorFile');
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      if (bytes[0] === 0x4B && bytes.length >= 512) {
        const capacity = Number(new DataView(bytes.buffer, bytes.byteOffset + 12, 8).getBigInt64(0, true));
        return [makeEntry('[VMDK Sparse, ' + formatSize(capacity * 512) + ']',
          capacity * 512, bytes.length, null, null, true, false, null, handler)];
      }
      return [makeEntry('[VMDK Descriptor]', null, bytes.length, null, null, true, false, null, handler)];
    }

    async build(_entries, _password, _options) { throw new Error('VMDK creation not supported'); }
  }

  // =======================================================================
  // FORMAT: GPT (GUID Partition Table)
  // =======================================================================

  class GptFormat extends IArchiveFormat {
    static get id() { return 'gpt'; }
    static get displayName() { return 'GPT Disk Image'; }
    static get extensions() { return ['gpt']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 520) return false;
      return bytes[512] === 0x45 && bytes[513] === 0x46 && bytes[514] === 0x49 && bytes[515] === 0x20 &&
             bytes[516] === 0x50 && bytes[517] === 0x41 && bytes[518] === 0x52 && bytes[519] === 0x54;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      if (bytes.length < 592) return [];
      const partEntryStart = Number(new DataView(bytes.buffer, bytes.byteOffset + 584, 8).getBigUint64(0, true));
      const partCount = readU32LE(bytes, 592);
      const partEntrySize = readU32LE(bytes, 596);
      const partOff = Number(partEntryStart) * 512;

      for (let i = 0; i < Math.min(partCount, 128); ++i) {
        const eo = partOff + i * partEntrySize;
        if (eo + 128 > bytes.length) break;
        let allZero = true;
        for (let j = 0; j < 16; ++j) if (bytes[eo + j] !== 0) { allZero = false; break; }
        if (allZero) continue;
        const firstLBA = Number(new DataView(bytes.buffer, bytes.byteOffset + eo + 32, 8).getBigUint64(0, true));
        const lastLBA = Number(new DataView(bytes.buffer, bytes.byteOffset + eo + 40, 8).getBigUint64(0, true));
        const size = (lastLBA - firstLBA + 1) * 512;
        let name = '';
        for (let j = 56; j < 128; j += 2) {
          const ch = readU16LE(bytes, eo + j);
          if (ch === 0) break;
          name += String.fromCharCode(ch);
        }
        entries.push(makeEntry(name || 'Partition ' + (i + 1), size, size, null, null, false, false, null, handler));
      }
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('GPT creation not supported'); }
  }

  // =======================================================================
  // FORMAT: MBR (Master Boot Record)
  // =======================================================================

  class MbrFormat extends IArchiveFormat {
    static get id() { return 'mbr'; }
    static get displayName() { return 'MBR Disk Image'; }
    static get extensions() { return ['mbr']; }

    static detect(bytes, fileName) {
      if (bytes.length < 512) return false;
      if (bytes[510] !== 0x55 || bytes[511] !== 0xAA) return false;
      if (bytes[0] === 0xEB || bytes[0] === 0xE9) return false;
      if (GptFormat.detect(bytes, fileName)) return false;
      let partCount = 0;
      for (let i = 0; i < 4; ++i) {
        const eo = 446 + i * 16;
        const type = bytes[eo + 4];
        if (type !== 0) ++partCount;
      }
      return partCount > 0;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      const typeNames = { 0x01: 'FAT12', 0x04: 'FAT16', 0x05: 'Extended', 0x06: 'FAT16B', 0x07: 'NTFS', 0x0B: 'FAT32', 0x0C: 'FAT32 LBA', 0x0E: 'FAT16B LBA', 0x0F: 'Extended LBA', 0x82: 'Linux Swap', 0x83: 'Linux', 0x85: 'Linux Extended', 0x8E: 'Linux LVM', 0xEE: 'GPT Protective', 0xEF: 'EFI System' };
      for (let i = 0; i < 4; ++i) {
        const eo = 446 + i * 16;
        const type = bytes[eo + 4];
        if (type === 0) continue;
        const startLBA = readU32LE(bytes, eo + 8);
        const sizeLBA = readU32LE(bytes, eo + 12);
        const size = sizeLBA * 512;
        const name = (typeNames[type] || 'Type 0x' + type.toString(16).toUpperCase()) + ' (Partition ' + (i + 1) + ')';
        entries.push(makeEntry(name, size, size, null, null, false, false, null, handler));
      }
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('MBR creation not supported'); }
  }

  // =======================================================================
  // FORMAT: Intel HEX (.hex / .ihex)
  // =======================================================================

  class IhexFormat extends IArchiveFormat {
    static get id() { return 'ihex'; }
    static get displayName() { return 'Intel HEX'; }
    static get extensions() { return ['hex', 'ihex', 'ihe', 'h86']; }
    static get canCreate() { return true; }

    static detect(bytes, _fileName) {
      if (bytes.length < 11) return false;
      if (bytes[0] !== 0x3A) return false;
      const header = new TextDecoder().decode(bytes.subarray(0, Math.min(50, bytes.length)));
      return /^:[0-9A-Fa-f]{10,}/m.test(header);
    }

    async parse(bytes, fileName, _password) {
      const handler = this;
      const text = new TextDecoder().decode(bytes);
      const lines = text.split(/\r?\n/).filter(l => l.startsWith(':'));
      const chunks = [];
      let baseAddr = 0;

      for (const line of lines) {
        const byteCount = parseInt(line.substring(1, 3), 16);
        const address = parseInt(line.substring(3, 7), 16);
        const type = parseInt(line.substring(7, 9), 16);
        if (type === 0) {
          const data = new Uint8Array(byteCount);
          for (let i = 0; i < byteCount; ++i)
            data[i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
          chunks.push({ addr: baseAddr + address, data });
        } else if (type === 2) {
          baseAddr = parseInt(line.substring(9, 13), 16) << 4;
        } else if (type === 4) {
          baseAddr = parseInt(line.substring(9, 13), 16) << 16;
        } else if (type === 1) break;
      }

      if (chunks.length === 0) return [];
      chunks.sort((a, b) => a.addr - b.addr);
      const minAddr = chunks[0].addr;
      const maxAddr = chunks[chunks.length - 1].addr + chunks[chunks.length - 1].data.length;
      const result = new Uint8Array(maxAddr - minAddr);
      for (const c of chunks) result.set(c.data, c.addr - minAddr);
      const baseName = stripExtension(getFileName(fileName || 'firmware.hex')) + '.bin';
      return [makeEntry(baseName, result.length, bytes.length, null, crc32Hex(result), false, false, result, handler)];
    }

    async build(entries, _password, _options) {
      if (entries.length === 0) return new Uint8Array(0);
      const data = entries[0]._data instanceof Uint8Array ? entries[0]._data : new Uint8Array(await entries[0]._data());
      let text = '';
      for (let off = 0; off < data.length; off += 16) {
        const count = Math.min(16, data.length - off);
        let line = ':' + count.toString(16).toUpperCase().padStart(2, '0') +
          off.toString(16).toUpperCase().padStart(4, '0') + '00';
        let checksum = count + ((off >> 8) & 0xFF) + (off & 0xFF);
        for (let i = 0; i < count; ++i) {
          line += data[off + i].toString(16).toUpperCase().padStart(2, '0');
          checksum += data[off + i];
        }
        line += ((~checksum + 1) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        text += line + '\n';
      }
      text += ':00000001FF\n';
      return new TextEncoder().encode(text);
    }
  }

  // =======================================================================
  // FORMAT: Parchive (.par / .par2)
  // =======================================================================

  class ParFormat extends IArchiveFormat {
    static get id() { return 'par'; }
    static get displayName() { return 'Parchive Recovery'; }
    static get extensions() { return ['par', 'par2']; }

    static detect(bytes, _fileName) {
      if (bytes.length < 8) return false;
      return bytes[0] === 0x50 && bytes[1] === 0x41 && bytes[2] === 0x52 && bytes[3] === 0x32 &&
             bytes[4] === 0x00 && bytes[5] === 0x50 && bytes[6] === 0x4B && bytes[7] === 0x54;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      let off = 0;

      while (off + 64 <= bytes.length) {
        if (bytes[off] !== 0x50 || bytes[off + 1] !== 0x41 || bytes[off + 2] !== 0x52 || bytes[off + 3] !== 0x32) break;
        const packetLen = Number(new DataView(bytes.buffer, bytes.byteOffset + off + 8, 8).getBigUint64(0, true));
        const typeHash = new Uint8Array(bytes.subarray(off + 48, off + 64));
        const isFileDesc = typeHash[0] === 0xFE && typeHash[1] === 0x01;

        if (isFileDesc && off + 64 + 56 <= bytes.length && packetLen > 120) {
          const nameLen = packetLen - 120;
          const nameBytes = bytes.subarray(off + 120, off + 120 + nameLen);
          let name = '';
          for (let i = 0; i < nameBytes.length - 1; i += 2) {
            const ch = readU16LE(nameBytes, i);
            if (ch === 0) break;
            name += String.fromCharCode(ch);
          }
          const fileSize = Number(new DataView(bytes.buffer, bytes.byteOffset + off + 80, 8).getBigUint64(0, true));
          if (name) entries.push(makeEntry(name, fileSize, null, null, null, false, false, null, handler));
        }
        off += Number(packetLen);
        if (off % 4 !== 0) off += 4 - (off % 4);
      }
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('Parchive creation not supported'); }
  }

  // =======================================================================
  // FORMAT: MAR (Mozilla Archive)
  // =======================================================================

  class MarFormat extends IArchiveFormat {
    static get id() { return 'mar'; }
    static get displayName() { return 'Mozilla Archive'; }
    static get extensions() { return ['mar']; }

    static detect(bytes, _fileName) {
      return bytes.length >= 8 && bytes[0] === 0x4D && bytes[1] === 0x41 && bytes[2] === 0x52 && bytes[3] === 0x31;
    }

    async parse(bytes, _fileName, _password) {
      const handler = this;
      const entries = [];
      const indexOff = readU32BE(bytes, 4);
      if (indexOff + 4 > bytes.length) return [];
      const indexSize = readU32BE(bytes, indexOff);
      let off = indexOff + 4;
      const end = indexOff + 4 + indexSize;

      while (off < end && off + 12 < bytes.length) {
        const entryOff = readU32BE(bytes, off);
        const entrySize = readU32BE(bytes, off + 4);
        const flags = readU32BE(bytes, off + 8);
        off += 12;
        let name = '';
        while (off < bytes.length && bytes[off] !== 0) name += String.fromCharCode(bytes[off++]);
        ++off;
        const data = (entryOff + entrySize <= bytes.length) ? bytes.slice(entryOff, entryOff + entrySize) : null;
        entries.push(makeEntry(name, entrySize, entrySize, null, data ? crc32Hex(data) : null, false, false, data, handler));
      }
      return entries;
    }

    async build(_entries, _password, _options) { throw new Error('MAR creation not supported'); }
  }

  // =======================================================================
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

  // =======================================================================
  // Register all formats (detection priority order)
  // =======================================================================

  // ZIP variants first (detect by extension before generic ZIP)
  IArchiveFormat.register(JarFormat);
  IArchiveFormat.register(ApkFormat);
  IArchiveFormat.register(EpubFormat);
  IArchiveFormat.register(OoxmlFormat);
  IArchiveFormat.register(OdfFormat);
  IArchiveFormat.register(ZipxFormat);
  IArchiveFormat.register(ZipFormat);
  // TAR compounds before components
  IArchiveFormat.register(TarBz2Format);
  IArchiveFormat.register(TarXzFormat);
  IArchiveFormat.register(TarZstFormat);
  IArchiveFormat.register(TarLzmaFormat);
  IArchiveFormat.register(TarLzFormat);
  IArchiveFormat.register(TarGzFormat);
  // Compression formats
  IArchiveFormat.register(Bzip2Format);
  IArchiveFormat.register(XzFormat);
  IArchiveFormat.register(ZstdFormat);
  IArchiveFormat.register(LzmaFormat);
  IArchiveFormat.register(LzipFormat);
  IArchiveFormat.register(LzopFormat);
  IArchiveFormat.register(GzipFormat);
  IArchiveFormat.register(TarFormat);
  // Multi-file archive formats
  IArchiveFormat.register(RarFormat);
  IArchiveFormat.register(SevenZipFormat);
  IArchiveFormat.register(LzhFormat);
  IArchiveFormat.register(ArjFormat);
  IArchiveFormat.register(SqxFormat);
  IArchiveFormat.register(AceFormat);
  IArchiveFormat.register(ArcFormat);
  IArchiveFormat.register(ZooFormat);
  IArchiveFormat.register(HaFormat);
  IArchiveFormat.register(SitxFormat);
  IArchiveFormat.register(SitFormat);
  IArchiveFormat.register(PakFormat);
  IArchiveFormat.register(AlzFormat);
  IArchiveFormat.register(PeaFormat);
  // System / package formats
  IArchiveFormat.register(CpioFormat);
  IArchiveFormat.register(CabFormat);
  IArchiveFormat.register(IsoFormat);
  IArchiveFormat.register(WimFormat);
  IArchiveFormat.register(XarFormat);
  IArchiveFormat.register(ChmFormat);
  IArchiveFormat.register(MsiFormat);
  IArchiveFormat.register(NsisFormat);
  IArchiveFormat.register(ParFormat);
  IArchiveFormat.register(MarFormat);
  // Encoding formats
  IArchiveFormat.register(UueFormat);
  IArchiveFormat.register(IhexFormat);
  // DEB before AR (both use !<arch> magic)
  IArchiveFormat.register(ZCompressFormat);
  IArchiveFormat.register(RpmFormat);
  IArchiveFormat.register(DebFormat);
  IArchiveFormat.register(ArFormat);
  // Filesystem images
  IArchiveFormat.register(SquashFsFormat);
  IArchiveFormat.register(CramFsFormat);
  IArchiveFormat.register(UdfFormat);
  IArchiveFormat.register(NtfsFormat);
  IArchiveFormat.register(ExtFormat);
  IArchiveFormat.register(HfsFormat);
  IArchiveFormat.register(ApfsFormat);
  IArchiveFormat.register(FatFormat);
  // VM disk images
  IArchiveFormat.register(Qcow2Format);
  IArchiveFormat.register(VhdFormat);
  IArchiveFormat.register(VhdxFormat);
  IArchiveFormat.register(VdiFormat);
  IArchiveFormat.register(VmdkFormat);
  // Partition tables
  IArchiveFormat.register(GptFormat);
  IArchiveFormat.register(MbrFormat);
  // Disk images (trailer-based)
  IArchiveFormat.register(DmgFormat);
  // Text-based (generic detection)
  IArchiveFormat.register(SharFormat);
  IArchiveFormat.register(Base64Format);

  // =======================================================================
  // App State
  // =======================================================================

  let currentFormat = null;
  let currentFormatClass = null;
  let entries = [];
  let currentPath = '';
  let currentFilePath = null;
  let currentFileName = null;
  let archiveBytes = null;
  let archivePassword = null;
  let archiveOptions = {};
  let dirty = false;
  let sortColumn = 'name';
  let sortAscending = true;
  let selectedIndices = new Set();
  let lastSelectedIndex = -1;

  // =======================================================================
  // DOM References
  // =======================================================================

  const menuBar = document.getElementById('menu-bar');
  const toolbar = document.getElementById('toolbar');
  const btnUp = document.getElementById('btn-up');
  const addressInput = document.getElementById('address-input');
  const fileListBody = document.getElementById('file-list-body');
  const fileListContainer = document.getElementById('file-list-container');
  const emptyState = document.getElementById('empty-state');
  const statusCount = document.getElementById('status-count');
  const statusSize = document.getElementById('status-size');
  const statusFormat = document.getElementById('status-format');
  const statusSelection = document.getElementById('status-selection');
  let openMenu = null;

  // =======================================================================
  // Window title
  // =======================================================================

  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const name = currentFileName || 'Untitled';
    const title = prefix + name + ' - Archiver';
    document.title = title;
    User32.SetWindowText(title);
  }

  // =======================================================================
  // Dialog helpers
  // =======================================================================

  function showDialog(id) {
    const dlg = document.getElementById(id);
    dlg.classList.add('visible');
    const first = dlg.querySelector('input, select, button[data-result="ok"]');
    if (first) setTimeout(() => first.focus(), 50);
    return new Promise(resolve => {
      function handler(e) {
        const btn = e.target.closest('[data-result]');
        if (!btn) return;
        dlg.classList.remove('visible');
        dlg.removeEventListener('click', handler);
        dlg.removeEventListener('keydown', keyHandler);
        resolve(btn.dataset.result);
      }
      function keyHandler(e) {
        if (e.key === 'Escape') {
          dlg.classList.remove('visible');
          dlg.removeEventListener('click', handler);
          dlg.removeEventListener('keydown', keyHandler);
          resolve('cancel');
        } else if (e.key === 'Enter') {
          dlg.classList.remove('visible');
          dlg.removeEventListener('click', handler);
          dlg.removeEventListener('keydown', keyHandler);
          resolve('ok');
        }
      }
      dlg.addEventListener('click', handler);
      dlg.addEventListener('keydown', keyHandler);
    });
  }

  async function promptPassword(forCreation) {
    const title = document.getElementById('dlg-password-title');
    const confirmRow = document.getElementById('password-confirm-row');
    const passInput = document.getElementById('password-input');
    const confirmInput = document.getElementById('password-confirm');
    title.textContent = forCreation ? 'Set Password' : 'Enter Password';
    confirmRow.style.display = forCreation ? 'block' : 'none';
    passInput.value = '';
    confirmInput.value = '';

    const result = await showDialog('dlg-password');
    if (result !== 'ok') return null;
    const pw = passInput.value;
    if (!pw) return null;
    if (forCreation && pw !== confirmInput.value) {
      await User32.MessageBox(null, 'Passwords do not match.', 'Password Error', 0x30);
      return null;
    }
    return pw;
  }

  // =======================================================================
  // Archive operations
  // =======================================================================

  async function openArchive(bytes, fileName) {
    const FormatClass = IArchiveFormat.detectFormat(bytes, fileName);
    if (!FormatClass) {
      await User32.MessageBox(null, 'Unrecognized archive format.', 'Error', 0x10);
      return;
    }

    const handler = new FormatClass();
    let password = null;
    let parsed;

    try {
      parsed = await handler.parse(bytes, fileName, null);
    } catch (e) {
      if (e && e.needPassword) {
        password = await promptPassword(false);
        if (!password) return;
        try {
          parsed = await handler.parse(bytes, fileName, password);
        } catch (e2) {
          await User32.MessageBox(null, 'Failed to open archive: ' + (e2.message || e2), 'Error', 0x10);
          return;
        }
      } else {
        await User32.MessageBox(null, 'Failed to open archive: ' + (e.message || e), 'Error', 0x10);
        return;
      }
    }

    entries = parsed;
    currentFormat = handler;
    currentFormatClass = FormatClass;
    archiveBytes = bytes;
    archivePassword = password;
    archiveOptions = {};
    currentPath = '';
    dirty = false;
    selectedIndices.clear();
    lastSelectedIndex = -1;
    currentFileName = fileName;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  function splitVolumes(bytes, volumeSize, baseName) {
    if (!volumeSize || bytes.length <= volumeSize) return null;
    const parts = [];
    for (let off = 0, n = 1; off < bytes.length; off += volumeSize, ++n)
      parts.push({ name: baseName + '.' + String(n).padStart(3, '0'), data: bytes.slice(off, off + volumeSize) });
    return parts;
  }

  function generateRecoveryRecord(bytes, percent) {
    const BLOCK = 4096;
    const stripe = Math.max(2, Math.round(100 / percent));
    const numBlocks = Math.ceil(bytes.length / BLOCK);
    const numParity = Math.ceil(numBlocks / stripe);
    const parity = new Uint8Array(numParity * BLOCK);
    for (let p = 0; p < numParity; ++p) {
      const parityOff = p * BLOCK;
      for (let s = 0; s < stripe; ++s) {
        const blockIdx = p * stripe + s;
        const srcOff = blockIdx * BLOCK;
        if (srcOff >= bytes.length) break;
        const srcEnd = Math.min(srcOff + BLOCK, bytes.length);
        for (let i = 0; i < srcEnd - srcOff; ++i)
          parity[parityOff + i] ^= bytes[srcOff + i];
      }
    }

    const headerSize = 32;
    const result = new Uint8Array(headerSize + parity.length);
    const magic = new TextEncoder().encode('SZRV');
    result.set(magic, 0);
    writeU16LE(result, 4, 1);
    writeU16LE(result, 6, BLOCK);
    writeU32LE(result, 8, bytes.length);
    writeU16LE(result, 12, stripe);
    writeU32LE(result, 14, computeCRC32(bytes));
    result.set(parity, headerSize);
    return result;
  }

  async function postProcessAndSave(built, baseName, ext) {
    const volumeSize = parseInt(archiveOptions.volumeSize || '0', 10);
    const recoveryPct = archiveOptions.recovery ? parseInt(archiveOptions.recoveryPct || '10', 10) : 0;
    const volumes = splitVolumes(built, volumeSize, baseName + '.' + ext);
    const recovery = recoveryPct > 0 ? generateRecoveryRecord(built, recoveryPct) : null;

    if (volumes || recovery) {
      const zip = new JSZip();
      if (volumes)
        for (const v of volumes) zip.file(v.name, v.data);
      else
        zip.file(baseName + '.' + ext, built);
      if (recovery)
        zip.file(baseName + '.rev', recovery);
      const blob = await zip.generateAsync({ type: 'uint8array' });
      ComDlg32.ExportFile(blob, baseName + '_bundle.zip');
      return;
    }

    return built;
  }

  async function saveArchive() {
    if (!currentFormat || !currentFormatClass || !currentFormatClass.canCreate) return;

    try {
      const built = await currentFormat.build(entries, archivePassword, archiveOptions);
      const ext = currentFormatClass.extensions[0];
      const baseName = currentFileName ? stripExtension(currentFileName) : 'archive';
      const processed = await postProcessAndSave(built, baseName, ext);
      if (!processed) { dirty = false; updateTitle(); return; }
      archiveBytes = processed;

      if (currentFilePath) {
        await Kernel32.WriteAllBytes(currentFilePath, processed);
      } else {
        const result = await ComDlg32.GetSaveFileName({
          title: 'Save Archive',
          filters: [{ name: currentFormatClass.displayName, ext: [ext] }, { name: 'All Files', ext: ['*'] }],
          defaultName: (currentFileName ? stripExtension(currentFileName) : 'archive') + '.' + ext
        });
        if (!result || result.cancelled) return;
        await Kernel32.WriteAllBytes(result.path, processed);
        currentFilePath = result.path;
        currentFileName = getFileName(result.path);
      }

      dirty = false;
      updateTitle();
    } catch (e) {
      await User32.MessageBox(null, 'Failed to save: ' + (e.message || e), 'Error', 0x10);
    }
  }

  async function saveArchiveAs() {
    if (!currentFormat || !currentFormatClass || !currentFormatClass.canCreate) return;

    try {
      const built = await currentFormat.build(entries, archivePassword, archiveOptions);
      const ext = currentFormatClass.extensions[0];
      const baseName = currentFileName ? stripExtension(currentFileName) : 'archive';
      const processed = await postProcessAndSave(built, baseName, ext);
      if (!processed) { dirty = false; updateTitle(); return; }

      const result = await ComDlg32.GetSaveFileName({
        title: 'Save Archive As',
        filters: [{ name: currentFormatClass.displayName, ext: [ext] }, { name: 'All Files', ext: ['*'] }],
        defaultName: (currentFileName ? stripExtension(currentFileName) : 'archive') + '.' + ext
      });
      if (!result || result.cancelled) return;

      await Kernel32.WriteAllBytes(result.path, processed);
      currentFilePath = result.path;
      currentFileName = getFileName(result.path);
      archiveBytes = processed;
      dirty = false;
      updateTitle();
    } catch (e) {
      await User32.MessageBox(null, 'Failed to save: ' + (e.message || e), 'Error', 0x10);
    }
  }

  function buildOptionsPanel(containerId, FormatClass) {
    const panel = document.getElementById(containerId);
    panel.innerHTML = '';
    const opts = FormatClass.getCreateOptions();
    if (!opts.length) return;

    for (const opt of opts) {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.dataset.optionId = opt.id;

      if (opt.visibleWhen)
        row.dataset.visibleWhen = JSON.stringify(opt.visibleWhen);

      const label = document.createElement('label');
      label.textContent = opt.label + ':';
      label.htmlFor = containerId + '-opt-' + opt.id;

      if (opt.type === 'select') {
        const select = document.createElement('select');
        select.id = containerId + '-opt-' + opt.id;
        select.dataset.optionId = opt.id;
        for (const o of opt.options) {
          const option = document.createElement('option');
          option.value = o.value;
          option.textContent = o.label;
          if (o.value === opt.default) option.selected = true;
          select.appendChild(option);
        }
        select.addEventListener('change', () => updateOptionVisibility(containerId));
        row.appendChild(label);
        row.appendChild(select);
      } else if (opt.type === 'checkbox') {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = containerId + '-opt-' + opt.id;
        cb.dataset.optionId = opt.id;
        cb.checked = !!opt.default;
        cb.addEventListener('change', () => updateOptionVisibility(containerId));
        row.appendChild(cb);
        label.style.minWidth = 'auto';
        row.appendChild(label);
      }

      panel.appendChild(row);
    }

    updateOptionVisibility(containerId);
  }

  function updateOptionVisibility(containerId) {
    const panel = document.getElementById(containerId);
    const rows = panel.querySelectorAll('.option-row[data-visible-when]');
    for (const row of rows) {
      const cond = JSON.parse(row.dataset.visibleWhen);
      let visible = true;
      for (const [key, val] of Object.entries(cond)) {
        const el = panel.querySelector('[data-option-id="' + key + '"]');
        if (!el) { visible = false; break; }
        const actual = el.type === 'checkbox' ? el.checked : el.value;
        const sActual = String(actual);
        const sVal = String(val);
        if (sVal.includes('|'))
          visible = sVal.split('|').includes(sActual);
        else
          visible = sActual === sVal;
        if (!visible) break;
      }
      row.classList.toggle('hidden', !visible);
    }
  }

  function collectOptions(containerId) {
    const panel = document.getElementById(containerId);
    const opts = {};
    const elements = panel.querySelectorAll('[data-option-id]');
    for (const el of elements) {
      const id = el.dataset.optionId;
      opts[id] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return opts;
  }

  function populateFormatDropdown(selectId, excludeId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    for (const F of IArchiveFormat.formats) {
      if (!F.canCreate) continue;
      if (excludeId && F.id === excludeId) continue;
      const option = document.createElement('option');
      option.value = F.id;
      option.textContent = F.displayName;
      select.appendChild(option);
    }
  }

  async function newArchive() {
    populateFormatDropdown('new-format');
    const formatSelect = document.getElementById('new-format');
    const initialFormat = IArchiveFormat.findById(formatSelect.value);
    if (initialFormat) buildOptionsPanel('new-options-panel', initialFormat);

    document.getElementById('new-recovery').checked = false;
    document.getElementById('new-recovery-pct-row').classList.add('hidden');
    document.getElementById('new-volume-size').value = '0';

    const result = await showDialog('dlg-new');
    if (result !== 'ok') return;

    const formatId = formatSelect.value;
    const FormatClass = IArchiveFormat.findById(formatId);
    if (!FormatClass) return;

    const opts = collectOptions('new-options-panel');
    opts.volumeSize = document.getElementById('new-volume-size').value;
    opts.recovery = document.getElementById('new-recovery').checked;
    opts.recoveryPct = document.getElementById('new-recovery-pct').value;

    const needsPassword = (opts.encryption && opts.encryption !== 'none') ||
      (opts.encrypt) ||
      (FormatClass.supportsEncryption && opts.encryption && opts.encryption !== 'none');

    let password = null;
    if (needsPassword) {
      password = await promptPassword(true);
      if (!password) return;
    }

    entries = [];
    currentFormat = new FormatClass();
    currentFormatClass = FormatClass;
    archiveBytes = null;
    archivePassword = password;
    archiveOptions = opts;
    currentPath = '';
    currentFilePath = null;
    currentFileName = 'New.' + FormatClass.extensions[0];
    dirty = true;
    selectedIndices.clear();
    lastSelectedIndex = -1;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  const _OPEN_FILTERS = [
    { name: 'All Archives', ext: ['zip', 'zipx', 'tar', 'tgz', 'tlz', 'gz', 'bz2', 'xz', 'zst', 'lzma', 'lz', 'lzo', 'b64', 'rar', '7z', 'lzh', 'lha', 'arj', 'sqx', 'ace', 'arc', 'zoo', 'ha', 'sit', 'sitx', 'pak', 'alz', 'pea', 'cpio', 'cab', 'iso', 'wim', 'esd', 'xar', 'pkg', 'msi', 'chm', 'z', 'rpm', 'deb', 'a', 'ar', 'lib', 'jar', 'war', 'ear', 'apk', 'epub', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'uue', 'uu', 'hex', 'ihex', 'par', 'par2', 'mar', 'shar', 'dmg', 'vhd', 'vhdx', 'vdi', 'vmdk', 'qcow2', 'img'] },
    { name: 'ZIP Files', ext: ['zip', 'zipx'] },
    { name: 'TAR Files', ext: ['tar', 'tgz', 'tlz'] },
    { name: '7-Zip Files', ext: ['7z'] },
    { name: 'RAR Files', ext: ['rar'] },
    { name: 'Java / Android', ext: ['jar', 'war', 'ear', 'apk'] },
    { name: 'Office Documents', ext: ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'] },
    { name: 'Compression', ext: ['gz', 'bz2', 'xz', 'zst', 'lzma', 'lz', 'lzo'] },
    { name: 'Disk Images', ext: ['iso', 'dmg', 'vhd', 'vhdx', 'vdi', 'vmdk', 'qcow2', 'wim', 'img'] },
    { name: 'All Files', ext: ['*'] }
  ];

  async function _resolveDialogResult(result) {
    if (!result || result.cancelled) return null;
    let bytes, name;
    if (result.imported && result.content) {
      const b64 = result.content.split(',')[1];
      bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      name = result.path || 'file';
    } else if (result.path) {
      const raw = await Kernel32.ReadAllBytes(result.path);
      bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      name = getFileName(result.path);
    } else return null;
    return { bytes, name, path: result.path };
  }

  async function openFile() {
    const result = await ComDlg32.GetOpenFileName({
      title: 'Open Archive',
      filters: _OPEN_FILTERS
    });
    const resolved = await _resolveDialogResult(result);
    if (!resolved) return;

    currentFilePath = (result.imported) ? null : result.path;
    await openArchive(resolved.bytes, resolved.name);
  }

  async function addFiles() {
    if (!currentFormat || !currentFormatClass) {
      await newArchive();
      if (!currentFormat || !currentFormatClass) return;
    }
    if (!currentFormatClass.canCreate) {
      await User32.MessageBox(null, 'This format does not support adding files.', 'Info', 0x40);
      return;
    }

    const result = await ComDlg32.GetOpenFileName({
      title: 'Add Files to Archive',
      filters: [{ name: 'All Files', ext: ['*'] }]
    });
    const resolved = await _resolveDialogResult(result);
    if (!resolved) return;

    const name = currentPath + resolved.name;
    const data = resolved.bytes;
    const existing = entries.findIndex(e => e.name === name);
    if (existing >= 0)
      entries[existing] = makeEntry(name, data.length, data.length, new Date(), crc32Hex(data), false, false, data, currentFormat);
    else
      entries.push(makeEntry(name, data.length, data.length, new Date(), crc32Hex(data), false, false, data, currentFormat));

    dirty = true;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  async function deleteSelected() {
    if (!currentFormat || !currentFormatClass || !currentFormatClass.canCreate) {
      await User32.MessageBox(null, 'This format does not support deletion.', 'Info', 0x40);
      return;
    }

    const visible = getVisibleEntries();
    const toDelete = new Set();
    for (const idx of selectedIndices) {
      const entry = visible[idx];
      if (!entry) continue;
      if (entry._synthetic)
        entries = entries.filter(e => !e.name.startsWith(entry.name));
      else
        toDelete.add(entry.name);
    }

    if (toDelete.size > 0)
      entries = entries.filter(e => !toDelete.has(e.name));

    dirty = true;
    selectedIndices.clear();
    lastSelectedIndex = -1;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  async function extractAll() {
    if (entries.length === 0) return;

    const dataEntries = entries.filter(e => !e.isDirectory && e._data);
    if (dataEntries.length === 0) {
      await User32.MessageBox(null, 'No extractable files in archive.', 'Info', 0x40);
      return;
    }

    if (dataEntries.length === 1) {
      const e = dataEntries[0];
      const data = await resolveEntryData(e);
      if (data)
        ComDlg32.ExportFile(data, getFileName(e.name));
      return;
    }

    try {
      const zip = new JSZip();
      for (const e of dataEntries) {
        const data = await resolveEntryData(e);
        if (data) zip.file(e.name, data);
      }
      const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      const baseName = currentFileName ? stripExtension(currentFileName) : 'extracted';
      ComDlg32.ExportFile(blob, baseName + '.zip');
    } catch (e) {
      await User32.MessageBox(null, 'Failed to extract: ' + (e.message || e), 'Error', 0x10);
    }
  }

  async function extractSelected() {
    const visible = getVisibleEntries();
    const selected = [];
    for (const idx of selectedIndices) {
      const entry = visible[idx];
      if (entry && !entry.isDirectory) selected.push(entry);
    }

    if (selected.length === 0) {
      await User32.MessageBox(null, 'No files selected.', 'Info', 0x40);
      return;
    }

    if (selected.length === 1) {
      const data = await resolveEntryData(selected[0]);
      if (data)
        ComDlg32.ExportFile(data, getFileName(selected[0].name));
      return;
    }

    try {
      const zip = new JSZip();
      for (const e of selected) {
        const data = await resolveEntryData(e);
        if (data) zip.file(getFileName(e.name), data);
      }
      const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      ComDlg32.ExportFile(blob, 'selected.zip');
    } catch (e) {
      await User32.MessageBox(null, 'Failed to extract: ' + (e.message || e), 'Error', 0x10);
    }
  }

  async function resolveEntryData(entry) {
    if (!entry._data) return null;
    if (entry._data instanceof Uint8Array) return entry._data;
    if (entry._data.aesEncrypted) {
      try {
        const ae = entry._data;
        const salt = ae.aesEncrypted.slice(0, 16);
        const verification = ae.aesEncrypted.slice(16, 18);
        const encData = ae.aesEncrypted.slice(18, ae.aesEncrypted.length - 10);
        const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(ae.password), 'PBKDF2', false, ['deriveBits']);
        const derived = new Uint8Array(await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-1' }, keyMaterial, (32 + 32 + 2) * 8
        ));
        const aesKey = derived.slice(0, 32);
        if (derived[64] !== verification[0] || derived[65] !== verification[1]) return null;
        const cryptoKey = await crypto.subtle.importKey('raw', aesKey, 'AES-CTR', false, ['decrypt']);
        const counter = new Uint8Array(16);
        counter[0] = 1;
        const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CTR', counter, length: 128 }, cryptoKey, encData));
        const result = ae.size && ae.size !== decrypted.length ? await decompressDeflateRaw(decrypted) : decrypted;
        entry._data = result;
        return result;
      } catch (_) {
        return null;
      }
    }
    if (entry._data.deflated) {
      try {
        const decompressed = await decompressDeflateRaw(entry._data.deflated);
        entry._data = decompressed;
        return decompressed;
      } catch (_) {
        return null;
      }
    }
    if (entry._data.async) {
      try {
        const data = await entry._data.async('uint8array');
        entry._data = data;
        return data;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  async function testArchive() {
    if (entries.length === 0) {
      await User32.MessageBox(null, 'No archive loaded.', 'Info', 0x40);
      return;
    }

    let ok = 0;
    let fail = 0;
    let skip = 0;
    for (const e of entries) {
      if (e.isDirectory) continue;
      if (!e._data) { ++skip; continue; }
      try {
        const data = await resolveEntryData(e);
        if (data) {
          if (e.crc) {
            const check = crc32Hex(data);
            if (check === e.crc) ++ok;
            else ++fail;
          } else
            ++ok;
        } else
          ++skip;
      } catch (_) {
        ++fail;
      }
    }

    await User32.MessageBox(null,
      'Test complete.\n\nOK: ' + ok + '\nFailed: ' + fail + '\nSkipped: ' + skip,
      'Test Results', fail > 0 ? 0x30 : 0x40);
  }

  async function showInfo() {
    if (!currentFormatClass) {
      await User32.MessageBox(null, 'No archive loaded.', 'Info', 0x40);
      return;
    }

    const fileCount = entries.filter(e => !e.isDirectory).length;
    const dirCount = entries.filter(e => e.isDirectory).length;
    const totalSize = entries.reduce((s, e) => s + (e.size || 0), 0);
    const totalPacked = entries.reduce((s, e) => s + (e.packed || 0), 0);
    const ratioNum = totalSize > 0 ? Math.round((totalPacked / totalSize) * 100) : 0;
    const ratioStr = totalSize > 0 ? ratioNum + '%' : 'N/A';
    const hasEncrypted = entries.some(e => e.encrypted);
    const archiveSize = archiveBytes ? archiveBytes.length : totalPacked;

    // Title
    document.getElementById('dlg-info-title').textContent = escapeHtml(currentFileName || 'Untitled');

    // Format header
    document.getElementById('info-format-name').textContent = currentFormatClass.displayName;

    // General section
    const hostOs = _detectHostOs();
    document.getElementById('info-grid-general').innerHTML =
      _infoRow('Host OS', hostOs) +
      _infoRow('Total files', fileCount.toLocaleString()) +
      _infoRow('Total folders', dirCount.toLocaleString());

    // Sizes section
    document.getElementById('info-grid-sizes').innerHTML =
      _infoRow('Total size', totalSize.toLocaleString() + ' bytes') +
      _infoRow('Packed size', totalPacked.toLocaleString() + ' bytes') +
      _infoRow('Archive size', archiveSize.toLocaleString() + ' bytes') +
      _infoRow('Ratio', ratioStr);

    // Details section
    const method = _detectMethod();
    const dictSize = _detectDictionary();
    const solid = _detectSolid();
    document.getElementById('info-grid-details').innerHTML =
      _infoRow('Compression', method) +
      _infoRow('Dictionary size', dictSize) +
      _infoRow('Solid archive', solid) +
      _infoRow('Recovery record', _detectRecovery()) +
      _infoRow('Writable', currentFormatClass.canCreate ? 'Yes' : 'Read-only');

    // Security section
    document.getElementById('info-grid-security').innerHTML =
      _infoRow('Encryption', hasEncrypted || archivePassword ? 'Yes' : 'Absent') +
      _infoRow('Passwords', archivePassword ? 'Set' : 'Absent') +
      _infoRow('Header encryption', archiveOptions.encryptNames ? 'Yes' : 'Absent');

    // 3D quader ratio column
    const fillPct = Math.min(100, Math.max(0, ratioNum));
    document.getElementById('info-quader-fill').style.height = fillPct + '%';
    document.getElementById('info-quader-side-fill').style.height = fillPct + '%';
    document.getElementById('info-quader-label').textContent = ratioStr;

    // Options tab
    const optsGrid = document.getElementById('info-grid-options');
    let optsHtml = '';
    if (archiveOptions && Object.keys(archiveOptions).length > 0)
      for (const [k, v] of Object.entries(archiveOptions))
        optsHtml += _infoRow(k, String(v));
    else
      optsHtml = '<dt>-</dt><dd>No format options set</dd>';
    optsGrid.innerHTML = optsHtml;

    // Comment tab
    document.getElementById('info-comment').value = '';

    // Tab switching
    const tabs = document.querySelectorAll('#dlg-info .info-tab');
    const panels = document.querySelectorAll('#dlg-info .info-tab-panel');
    for (const tab of tabs) {
      tab.onclick = () => {
        for (const t of tabs) t.classList.remove('active');
        for (const p of panels) p.classList.remove('active');
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      };
    }
    tabs[0].click();

    await showDialog('dlg-info');
  }

  function _infoRow(label, value) {
    return '<dt>' + escapeHtml(label) + ':</dt><dd>' + escapeHtml(String(value)) + '</dd>';
  }

  function _detectHostOs() {
    if (!archiveBytes || archiveBytes.length < 10) return 'Unknown';
    const fmtId = currentFormatClass ? currentFormatClass.id : '';
    if (fmtId === 'zip' || fmtId === 'jar' || fmtId === 'apk' || fmtId === 'epub' || fmtId === 'ooxml' || fmtId === 'odf' || fmtId === 'zipx') {
      const hostByte = archiveBytes.length > 5 ? archiveBytes[5] : 0;
      // ZIP version made-by high byte (in central directory) - approximate from local header
      return 'FAT/Windows';
    }
    if (fmtId === 'rar') return 'Windows';
    if (fmtId === '7z') return 'Windows';
    if (fmtId === 'tar' || fmtId === 'targz' || fmtId === 'tarbz2' || fmtId === 'tarxz' || fmtId === 'tarzst' || fmtId === 'tarlzma' || fmtId === 'tarlz') return 'Unix';
    if (fmtId === 'cpio' || fmtId === 'rpm' || fmtId === 'deb' || fmtId === 'ar') return 'Unix';
    if (fmtId === 'lzh' || fmtId === 'arj') return 'DOS/Windows';
    if (fmtId === 'cab' || fmtId === 'msi' || fmtId === 'chm' || fmtId === 'nsis' || fmtId === 'wim') return 'Windows';
    if (fmtId === 'dmg' || fmtId === 'hfs' || fmtId === 'apfs' || fmtId === 'sit' || fmtId === 'sitx') return 'macOS';
    if (fmtId === 'iso' || fmtId === 'udf') return 'Cross-platform';
    if (fmtId === 'squashfs' || fmtId === 'cramfs' || fmtId === 'ext') return 'Linux';
    return 'Unknown';
  }

  function _detectMethod() {
    if (archiveOptions && archiveOptions.method) {
      const m = archiveOptions.method;
      const fmtId = currentFormatClass ? currentFormatClass.id : '';
      if (fmtId === '7z') {
        const map = { store: 'Store', lzma: 'LZMA', lzma2: 'LZMA2', ppmd: 'PPMd', bzip2: 'BZip2', deflate: 'Deflate' };
        return map[m] || m;
      }
      if (fmtId === 'zip' || fmtId === 'zipx') {
        const map = { '0': 'Store', '8': 'Deflate', '9': 'Deflate64', '12': 'BZip2', '14': 'LZMA', '93': 'ZStandard', '95': 'XZ', '98': 'PPMd' };
        return map[m] || 'Method ' + m;
      }
      return m;
    }
    const fmtId = currentFormatClass ? currentFormatClass.id : '';
    if (fmtId === 'gzip' || fmtId === 'targz') return 'Deflate';
    if (fmtId === 'bzip2' || fmtId === 'tarbz2') return 'BZip2';
    if (fmtId === 'xz' || fmtId === 'tarxz' || fmtId === 'lzma' || fmtId === 'tarlzma') return 'LZMA';
    if (fmtId === 'zstd' || fmtId === 'tarzst') return 'ZStandard';
    if (fmtId === 'lzip' || fmtId === 'tarlz') return 'LZMA';
    if (fmtId === 'compress') return 'LZW';
    if (fmtId === 'lzop') return 'LZO';
    return 'Unknown';
  }

  function _detectDictionary() {
    if (archiveOptions && archiveOptions.dictionary) {
      const d = parseInt(archiveOptions.dictionary, 10);
      if (d >= 1048576) return (d / 1048576) + ' MB';
      if (d >= 1024) return (d / 1024) + ' KB';
      return d + ' bytes';
    }
    return 'Default';
  }

  function _detectSolid() {
    if (archiveOptions && archiveOptions.solid) return 'Yes';
    return 'No';
  }

  function _detectRecovery() {
    if (archiveOptions && archiveOptions.recovery) return archiveOptions.recoveryPct ? archiveOptions.recoveryPct + '%' : 'Yes';
    return 'Absent';
  }

  async function convertFormat() {
    if (entries.length === 0) {
      await User32.MessageBox(null, 'No archive loaded.', 'Info', 0x40);
      return;
    }

    populateFormatDropdown('convert-format', currentFormatClass ? currentFormatClass.id : null);
    const convertSelect = document.getElementById('convert-format');
    const initialFormat = IArchiveFormat.findById(convertSelect.value);
    if (initialFormat) buildOptionsPanel('convert-options-panel', initialFormat);

    const result = await showDialog('dlg-convert');
    if (result !== 'ok') return;

    const targetId = convertSelect.value;
    const TargetClass = IArchiveFormat.findById(targetId);
    if (!TargetClass || !TargetClass.canCreate) return;

    const opts = collectOptions('convert-options-panel');

    const resolvedEntries = [];
    for (const e of entries) {
      const data = e.isDirectory ? null : await resolveEntryData(e);
      resolvedEntries.push(makeEntry(e.name, e.size, e.size, e.modified, e.crc, e.isDirectory, false, data, null));
    }

    const handler = new TargetClass();
    currentFormat = handler;
    currentFormatClass = TargetClass;
    entries = resolvedEntries;
    for (const e of entries) e._handler = handler;
    archivePassword = null;
    archiveOptions = opts;
    currentFilePath = null;
    const baseName = currentFileName ? stripExtension(currentFileName) : 'archive';
    currentFileName = baseName + '.' + TargetClass.extensions[0];
    dirty = true;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  async function viewFile() {
    const visible = getVisibleEntries();
    if (selectedIndices.size !== 1) return;
    const idx = [...selectedIndices][0];
    const entry = visible[idx];
    if (!entry) return;

    if (entry.isDirectory || entry._synthetic) {
      currentPath = entry.name;
      selectedIndices.clear();
      lastSelectedIndex = -1;
      renderFileList();
      updateAddressBar();
      return;
    }

    const data = await resolveEntryData(entry);
    if (data)
      ComDlg32.ExportFile(data, getFileName(entry.name));
  }

  // =======================================================================
  // File list rendering
  // =======================================================================

  function getVisibleEntries() {
    const result = [];
    const seenDirs = new Set();
    const prefixLen = currentPath.length;

    for (const e of entries) {
      const name = e.name;
      if (!name.startsWith(currentPath) && currentPath) continue;

      const rest = name.substring(prefixLen);
      if (!rest) continue;

      const slashIdx = rest.indexOf('/');
      if (slashIdx >= 0 && slashIdx < rest.length - 1) {
        const dirName = rest.substring(0, slashIdx + 1);
        const fullDir = currentPath + dirName;
        if (!seenDirs.has(fullDir)) {
          seenDirs.add(fullDir);
          result.push(makeEntry(fullDir, 0, 0, null, '', true, false, null, null));
          result[result.length - 1]._synthetic = true;
        }
      } else
        result.push(e);
    }

    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory)
        return a.isDirectory ? -1 : 1;
      return compareColumn(a, b, sortColumn, sortAscending);
    });

    return result;
  }

  function compareColumn(a, b, col, asc) {
    let va, vb;
    switch (col) {
      case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
      case 'size': va = a.size || 0; vb = b.size || 0; break;
      case 'packed': va = a.packed || 0; vb = b.packed || 0; break;
      case 'type': va = getFileExtension(a.name); vb = getFileExtension(b.name); break;
      case 'modified': va = a.modified ? a.modified.getTime() : 0; vb = b.modified ? b.modified.getTime() : 0; break;
      case 'crc': va = a.crc || ''; vb = b.crc || ''; break;
      case 'encrypted': va = a.encrypted ? 1 : 0; vb = b.encrypted ? 1 : 0; break;
      default: va = a.name; vb = b.name;
    }
    let cmp;
    if (typeof va === 'string')
      cmp = va.localeCompare(vb);
    else
      cmp = va - vb;
    return asc ? cmp : -cmp;
  }

  function renderFileList() {
    const visible = getVisibleEntries();
    const tbody = fileListBody;

    if (visible.length === 0 && entries.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    const rows = [];
    const prefixLen = currentPath.length;

    for (let i = 0; i < visible.length; ++i) {
      const e = visible[i];
      const displayName = e.name.substring(prefixLen).replace(/\/$/, '');
      const icon = e.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
      const selected = selectedIndices.has(i) ? ' selected' : '';

      rows.push(
        '<tr class="' + selected + '" data-idx="' + i + '">' +
        '<td class="col-name">' + icon + ' ' + escapeHtml(displayName) + '</td>' +
        '<td class="col-size">' + (e.isDirectory ? '' : formatSize(e.size)) + '</td>' +
        '<td class="col-packed">' + (e.isDirectory ? '' : formatSize(e.packed)) + '</td>' +
        '<td class="col-type">' + (e.isDirectory ? 'Folder' : getFileType(e.name)) + '</td>' +
        '<td class="col-modified">' + formatDate(e.modified) + '</td>' +
        '<td class="col-crc">' + escapeHtml(e.crc || '') + '</td>' +
        '<td class="col-encrypted">' + (e.encrypted ? '\uD83D\uDD12' : '') + '</td>' +
        '</tr>'
      );
    }

    tbody.innerHTML = rows.join('');
    updateAddressBar();
  }

  function getFileType(name) {
    const ext = getFileExtension(name);
    if (!ext) return 'File';
    return ext.toUpperCase() + ' File';
  }

  function updateAddressBar() {
    const display = '\\' + currentPath.replace(/\//g, '\\');
    addressInput.value = display;
    btnUp.classList.toggle('disabled', !currentPath);
  }

  function updateStatusBar() {
    const fileCount = entries.filter(e => !e.isDirectory).length;
    const totalSize = entries.reduce((s, e) => s + (e.size || 0), 0);
    statusCount.textContent = fileCount + (fileCount === 1 ? ' file' : ' files');
    statusSize.textContent = formatSize(totalSize);
    statusFormat.textContent = currentFormatClass ? currentFormatClass.displayName : '';
    updateSelectionStatus();
  }

  function updateSelectionStatus() {
    if (selectedIndices.size === 0)
      statusSelection.textContent = '';
    else
      statusSelection.textContent = selectedIndices.size + ' selected';
  }

  // =======================================================================
  // Navigation
  // =======================================================================

  function navigateUp() {
    if (!currentPath) return;
    const trimmed = currentPath.replace(/\/$/, '');
    const slash = trimmed.lastIndexOf('/');
    currentPath = slash >= 0 ? trimmed.substring(0, slash + 1) : '';
    selectedIndices.clear();
    lastSelectedIndex = -1;
    renderFileList();
    updateAddressBar();
  }

  // =======================================================================
  // Selection
  // =======================================================================

  function handleRowClick(e) {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = parseInt(tr.dataset.idx, 10);

    if (e.ctrlKey) {
      if (selectedIndices.has(idx))
        selectedIndices.delete(idx);
      else
        selectedIndices.add(idx);
      lastSelectedIndex = idx;
    } else if (e.shiftKey && lastSelectedIndex >= 0) {
      const lo = Math.min(lastSelectedIndex, idx);
      const hi = Math.max(lastSelectedIndex, idx);
      for (let i = lo; i <= hi; ++i)
        selectedIndices.add(i);
    } else {
      selectedIndices.clear();
      selectedIndices.add(idx);
      lastSelectedIndex = idx;
    }

    renderFileList();
    updateSelectionStatus();
  }

  function handleRowDblClick(e) {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = parseInt(tr.dataset.idx, 10);
    const visible = getVisibleEntries();
    const entry = visible[idx];
    if (!entry) return;

    if (entry.isDirectory || entry._synthetic) {
      currentPath = entry.name;
      selectedIndices.clear();
      lastSelectedIndex = -1;
      renderFileList();
      updateAddressBar();
    } else
      viewFile();
  }

  function selectAll() {
    const visible = getVisibleEntries();
    selectedIndices.clear();
    for (let i = 0; i < visible.length; ++i)
      selectedIndices.add(i);
    renderFileList();
    updateSelectionStatus();
  }

  // =======================================================================
  // Column sorting
  // =======================================================================

  function handleColumnClick(e) {
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const col = th.dataset.col;
    if (sortColumn === col)
      sortAscending = !sortAscending;
    else {
      sortColumn = col;
      sortAscending = true;
    }

    for (const h of document.querySelectorAll('.file-list th'))
      h.classList.remove('sort-asc', 'sort-desc');
    th.classList.add(sortAscending ? 'sort-asc' : 'sort-desc');

    renderFileList();
  }

  // =======================================================================
  // Menu system
  // =======================================================================

  function closeMenus() {
    for (const item of menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    openMenu = null;
  }

  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
        return;
      if (openMenu === menuItem) {
        closeMenus();
        return;
      }
      closeMenus();
      menuItem.classList.add('open');
      openMenu = menuItem;
    });

    menuItem.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menuItem) {
        closeMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !menuBar.contains(e.target))
      closeMenus();
  });

  // =======================================================================
  // Action dispatch
  // =======================================================================

  function handleAction(action) {
    switch (action) {
      case 'new': newArchive(); break;
      case 'open': openFile(); break;
      case 'save': saveArchive(); break;
      case 'save-as': saveArchiveAs(); break;
      case 'import':
      case 'add': addFiles(); break;
      case 'export':
      case 'extract-selected': extractSelected(); break;
      case 'extract-all': extractAll(); break;
      case 'delete': deleteSelected(); break;
      case 'view': viewFile(); break;
      case 'test': testArchive(); break;
      case 'convert': convertFormat(); break;
      case 'info': showInfo(); break;
      case 'select-all': selectAll(); break;
      case 'about': showDialog('dlg-about'); break;
      case 'exit': window.close(); break;
    }
  }

  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action);
    });
  }

  for (const btn of toolbar.querySelectorAll('button[data-action]')) {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.action);
    });
  }

  // =======================================================================
  // File list events
  // =======================================================================

  fileListBody.addEventListener('click', handleRowClick);
  fileListBody.addEventListener('dblclick', handleRowDblClick);
  document.querySelector('.file-list thead').addEventListener('click', handleColumnClick);
  btnUp.addEventListener('click', navigateUp);

  // =======================================================================
  // Keyboard shortcuts
  // =======================================================================

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('.dialog-overlay.visible')) return;

    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); handleAction('new'); return;
        case 'o': e.preventDefault(); handleAction('open'); return;
        case 's': e.preventDefault(); handleAction('save'); return;
        case 'e': e.preventDefault(); handleAction('extract-all'); return;
        case 'a': e.preventDefault(); handleAction('select-all'); return;
      }
    }

    switch (e.key) {
      case 'Insert': e.preventDefault(); handleAction('add'); return;
      case 'Delete': e.preventDefault(); handleAction('delete'); return;
      case 'Enter': e.preventDefault(); handleAction('view'); return;
      case 'Backspace': e.preventDefault(); navigateUp(); return;
    }
  });

  // =======================================================================
  // Drag and drop
  // =======================================================================

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    currentFilePath = null;
    await openArchive(bytes, file.name);
  });

  // =======================================================================
  // Dynamic options panel change handlers
  // =======================================================================

  document.getElementById('new-format').addEventListener('change', () => {
    const formatId = document.getElementById('new-format').value;
    const FormatClass = IArchiveFormat.findById(formatId);
    if (FormatClass) buildOptionsPanel('new-options-panel', FormatClass);
  });

  document.getElementById('convert-format').addEventListener('change', () => {
    const formatId = document.getElementById('convert-format').value;
    const FormatClass = IArchiveFormat.findById(formatId);
    if (FormatClass) buildOptionsPanel('convert-options-panel', FormatClass);
  });

  document.getElementById('new-recovery').addEventListener('change', () => {
    const checked = document.getElementById('new-recovery').checked;
    document.getElementById('new-recovery-pct-row').classList.toggle('hidden', !checked);
  });

  // =======================================================================
  // Init
  // =======================================================================

  (async function init() {
    updateTitle();
    renderFileList();
    updateStatusBar();

    // Set initial sort indicator
    const defaultTh = document.querySelector('.file-list th[data-col="name"]');
    if (defaultTh) defaultTh.classList.add('sort-asc');

    // Check command line for file path
    try {
      const cmdLine = Kernel32.GetCommandLine();
      const filePath = cmdLine && (cmdLine.file || cmdLine.path);
      if (filePath) {
        const raw = await Kernel32.ReadAllBytes(filePath);
        if (raw) {
          const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
          currentFilePath = filePath;
          const name = getFileName(filePath);
          await openArchive(bytes, name);
        }
      }
    } catch (_) {}
  })();

})();
