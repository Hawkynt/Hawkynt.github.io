;(function() { 'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32, crc32Hex, CRC32_TABLE,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        getFileName, getFileExtension, stripExtension, normalizeArchivePath,
        compressDeflateRaw, decompressDeflateRaw, compressGzip,
        _tryDeflateCompress, _tryDeflateDecompress,
        _tryLzmaCompress, _tryLzmaDecompress,
        _tryBzip2Compress, _tryBzip2Decompress,
        _tryZstdCompress, _tryZstdDecompress,
        _tryPpmdCompress, _tryLzwDecompress,
        _cipherCompress, _cipherDecompress,
        concatUint8Arrays, zipCompress, dosToDate, dateToDos } = A;

const { BitReader, buildHuffmanTable, decodeHuffman, buildHuffmanLookup, decodeHuffmanLookup } = A;

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
        { value: '12', label: 'BZip2' },
        { value: '8', label: 'Deflate' },
        { value: '9', label: 'Deflate64' },
        { value: '14', label: 'LZMA' },
        { value: '98', label: 'PPMd' },
        { value: '0', label: 'Store' },
        { value: '95', label: 'XZ' },
        { value: '93', label: 'ZStandard' }
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

    const hasNonJsZipMethod = entries.some(e => {
      if (!e._options || e._options.method == null) return false;
      const m = parseInt(e._options.method, 10);
      return m !== 0 && m !== 8;
    });

    if ((method === 0 || method === 8) && !hasNonJsZipMethod) {
      const zip = new JSZip();
      for (const entry of entries) {
        if (entry.isDirectory)
          zip.folder(entry.name);
        else if (entry._data) {
          const em = entry._options && entry._options.method != null ? parseInt(entry._options.method, 10) : method;
          const compression = em === 0 ? 'STORE' : 'DEFLATE';
          zip.file(entry.name, entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry), { date: entry.modified || new Date(), compression, compressionOptions: { level } });
        }
      }
      return new Uint8Array(await zip.generateAsync({ type: 'arraybuffer' }));
    }

    return this._buildRawZip(entries, method);
  }

  async _buildRawZip(entries, defaultMethod) {
    const parts = [];
    const centralDir = [];
    let localOff = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const raw = entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry);
      if (!raw) continue;

      const entryMethod = entry._options && entry._options.method != null ? parseInt(entry._options.method, 10) : defaultMethod;
      const crc = computeCRC32(raw);
      const { method: compMethod, data: compressed } = await zipCompress(raw, entryMethod);

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

  async _buildAES256Encrypted(entries, password, defaultMethod, level) {
    const parts = [];
    const centralDir = [];
    let localOff = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const raw = entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry);
      if (!raw) continue;

      const entryMethod = entry._options && entry._options.method != null ? parseInt(entry._options.method, 10) : defaultMethod;
      const crc = computeCRC32(raw);
      const { method: actualMethod, data: compressed } = await zipCompress(raw, entryMethod);

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

  async _buildEncrypted(entries, password, defaultZipMethod, level) {
    const parts = [];
    const centralDir = [];
    let localOff = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const raw = entry._data instanceof Uint8Array ? entry._data : await this._resolveData(entry);
      if (!raw) continue;

      const entryMethod = entry._options && entry._options.method != null ? parseInt(entry._options.method, 10) : defaultZipMethod;
      const crc = computeCRC32(raw);
      const { method: compMethod, data: compressed } = await zipCompress(raw, entryMethod);

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
// Registration & Exports
// =======================================================================

A.ZipCrypto = ZipCrypto;
IArchiveFormat.register(ZipFormat);
IArchiveFormat.register(JarFormat);
IArchiveFormat.register(ApkFormat);
IArchiveFormat.register(EpubFormat);
IArchiveFormat.register(OoxmlFormat);
IArchiveFormat.register(OdfFormat);
IArchiveFormat.register(ZipxFormat);

})();
