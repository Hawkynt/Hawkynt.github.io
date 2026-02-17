;(function() { 'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        getFileName, normalizeArchivePath,
        _tryDeflateCompress, _tryDeflateDecompress,
        _tryLzmaCompress, _tryLzmaDecompress,
        _tryLzma2Compress, _tryLzma2Decompress,
        _tryBzip2Compress, _tryBzip2Decompress,
        _tryPpmdCompress,
        _cipherCompress, _cipherDecompress,
        concatUint8Arrays } = A;

function crc32Hex(bytes) {
  return computeCRC32(bytes).toString(16).toUpperCase().padStart(8, '0');
}

class SevenZipFormat extends IArchiveFormat {
  static get id() { return '7z'; }
  static get displayName() { return '7-Zip Archive'; }
  static get extensions() { return ['7z']; }
  static get canCreate() { return true; }
  static get supportsEncryption() { return true; }

  static getCreateOptions() {
    return [
      { id: 'method', label: 'Method', type: 'select', options: [
        { value: 'bzip2', label: 'BZip2' },
        { value: 'deflate', label: 'Deflate' },
        { value: 'lzma', label: 'LZMA' },
        { value: 'lzma2', label: 'LZMA2' },
        { value: 'ppmd', label: 'PPMd' },
        { value: 'store', label: 'Store' }
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
      return _tryLzma2Decompress(data);

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
    let usedCoder = 'copy'; // 'copy', 'lzma', 'lzma2', 'deflate', 'bzip2', 'ppmd'
    if (requestedMethod === 'lzma') {
      const compressed = await _tryLzmaCompress(combined);
      if (compressed && compressed.length < combined.length) {
        packedData = compressed;
        usedCoder = 'lzma';
      }
    } else if (requestedMethod === 'lzma2') {
      const compressed = await _tryLzma2Compress(combined);
      if (compressed && compressed.length < combined.length) {
        packedData = compressed;
        usedCoder = 'lzma2';
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
    } else if (coderType === 'lzma2') {
      parts.push(new Uint8Array([0x21, 0x21])); // 0x20|0x01 = has props + 1-byte ID; ID = 0x21
      parts.push(new Uint8Array([1, 16])); // 1 byte props; dict size byte = 16 (1 MB)
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

IArchiveFormat.register(SevenZipFormat);

})();
