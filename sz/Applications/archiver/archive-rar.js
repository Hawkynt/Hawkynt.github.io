;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, readU16LE, readU32LE,
        getFileName, loadCdnScript, _loadScript,
        normalizeArchivePath, crc32Hex } = A;

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

IArchiveFormat.register(RarFormat);

})();
