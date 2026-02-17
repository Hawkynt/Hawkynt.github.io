;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        readU16BE, readU32BE,
        getFileName, getFileExtension, stripExtension, normalizeArchivePath,
        compressGzip, decompressGzip,
        _tryDeflateDecompress, _tryBzip2Decompress, _tryLzmaDecompress,
        _tryLzssDecompress, _cipherDecompress,
        concatUint8Arrays } = A;

function crc32Hex(bytes) {
  return computeCRC32(bytes).toString(16).toUpperCase().padStart(8, '0');
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
      { id: 'format', label: 'Format', type: 'select', options: [{ value: 'odc', label: 'POSIX.1 (odc)' }, { value: 'newc', label: 'SVR4 (newc)' }], default: 'newc' }
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
// Register all formats
// =======================================================================

IArchiveFormat.register(CpioFormat);
IArchiveFormat.register(IsoFormat);
IArchiveFormat.register(RpmFormat);
IArchiveFormat.register(DebFormat);
IArchiveFormat.register(ArFormat);
IArchiveFormat.register(SharFormat);
IArchiveFormat.register(WimFormat);
IArchiveFormat.register(XarFormat);
IArchiveFormat.register(MsiFormat);
IArchiveFormat.register(ChmFormat);
IArchiveFormat.register(NsisFormat);
IArchiveFormat.register(ParFormat);
IArchiveFormat.register(MarFormat);

})();
