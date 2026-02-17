;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32,
        getFileName, getFileExtension, stripExtension,
        compressGzip, decompressGzip,
        _tryBzip2Compress, _tryBzip2Decompress,
        _tryZstdCompress, _tryZstdDecompress,
        _tryLzmaCompress, _tryLzmaDecompress,
        _cipherCompress, _cipherDecompress } = A;

function normalizeArchivePath(name) {
  return name.replace(/\\/g, '/').replace(/^\/+/, '');
}

function crc32Hex(bytes) {
  return computeCRC32(bytes).toString(16).toUpperCase().padStart(8, '0');
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
// FORMAT: TAR.BZ2
// =======================================================================

class TarBz2Format extends IArchiveFormat {
  static get id() { return 'tarbz2'; }
  static get displayName() { return 'TAR.BZ2 Archive'; }
  static get extensions() { return ['tar.bz2', 'tbz2']; }
  static get canCreate() { return true; }

  static getCreateOptions() {
    return IArchiveFormat.findById('bzip2').getCreateOptions();
  }

  static detect(bytes, fileName) {
    if (bytes.length < 3) return false;
    if (bytes[0] !== 0x42 || bytes[1] !== 0x5A || bytes[2] !== 0x68) return false;
    const lower = (fileName || '').toLowerCase();
    return lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2');
  }

  async parse(bytes, fileName, password) {
    const Bzip2Format = IArchiveFormat.findById('bzip2');
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
    const Bzip2Format = IArchiveFormat.findById('bzip2');
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
    const XzFormat = IArchiveFormat.findById('xz');
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
    const XzFormat = IArchiveFormat.findById('xz');
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
    return IArchiveFormat.findById('zstd').getCreateOptions();
  }

  static detect(bytes, fileName) {
    if (bytes.length < 4) return false;
    if (bytes[0] !== 0x28 || bytes[1] !== 0xB5 || bytes[2] !== 0x2F || bytes[3] !== 0xFD) return false;
    const lower = (fileName || '').toLowerCase();
    return lower.endsWith('.tar.zst') || lower.endsWith('.tzst');
  }

  async parse(bytes, fileName, password) {
    const ZstdFormat = IArchiveFormat.findById('zstd');
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
    const ZstdFormat = IArchiveFormat.findById('zstd');
    const tarHandler = new TarFormat();
    const tarData = await tarHandler.build(entries, password, options);
    const zstHandler = new ZstdFormat();
    const wrappedEntries = [makeEntry('archive.tar', tarData.length, tarData.length, new Date(), '', false, false, tarData, zstHandler)];
    return zstHandler.build(wrappedEntries, password, options);
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
    const LzmaFormat = IArchiveFormat.findById('lzma');
    const lzmaEntries = await new LzmaFormat().parse(bytes, fileName, password);
    if (lzmaEntries.length && lzmaEntries[0]._data) {
      const entries = await new TarFormat().parse(lzmaEntries[0]._data, fileName, password);
      for (const e of entries) e._handler = handler;
      return entries;
    }
    return lzmaEntries;
  }

  async build(entries, password, options) {
    const LzmaFormat = IArchiveFormat.findById('lzma');
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
    const LzipFormat = IArchiveFormat.findById('lzip');
    const lzEntries = await new LzipFormat().parse(bytes, fileName, password);
    if (lzEntries.length && lzEntries[0]._data) {
      const entries = await new TarFormat().parse(lzEntries[0]._data, fileName, password);
      for (const e of entries) e._handler = handler;
      return entries;
    }
    return lzEntries;
  }

  async build(entries, password, options) {
    const LzipFormat = IArchiveFormat.findById('lzip');
    const tarData = await new TarFormat().build(entries, password, options);
    return new LzipFormat().build([makeEntry('a.tar', tarData.length, tarData.length, null, null, false, false, tarData, null)], null, options);
  }
}

// =======================================================================
// Registration
// =======================================================================

A.TarFormat = TarFormat;
IArchiveFormat.register(TarFormat);
IArchiveFormat.register(TarGzFormat);
IArchiveFormat.register(TarBz2Format);
IArchiveFormat.register(TarXzFormat);
IArchiveFormat.register(TarZstFormat);
IArchiveFormat.register(TarLzmaFormat);
IArchiveFormat.register(TarLzFormat);

})();
