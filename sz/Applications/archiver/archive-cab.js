;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        getFileName, normalizeArchivePath,
        _tryDeflateCompress, _tryDeflateDecompress,
        _tryLzxDecompress, concatUint8Arrays,
        dosToDate, dateToDos,
        crc32Hex, decompressDeflateRaw } = A;
const { BitReader, buildHuffmanTable, decodeHuffman,
        buildHuffmanLookup, decodeHuffmanLookup } = A;

// FORMAT: CAB
// =======================================================================

class CabFormat extends IArchiveFormat {
  static get id() { return 'cab'; }
  static get displayName() { return 'Cabinet Archive'; }
  static get extensions() { return ['cab']; }
  static get canCreate() { return true; }

  static getCreateOptions() {
    return [
      { id: 'method', label: 'Method', type: 'select', options: [
        { value: '1', label: 'MS-ZIP (Deflate)' },
        { value: '0', label: 'Store' }
      ], default: '1' }
    ];
  }

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

  static _computeCabChecksum(data, cbData, cbUncomp) {
    let csum = 0;
    let i = 0;
    for (; i + 3 < data.length; i += 4)
      csum = (csum ^ (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24))) >>> 0;
    let rem = 0;
    if (i < data.length) rem |= data[i];
    if (i + 1 < data.length) rem |= data[i + 1] << 8;
    if (i + 2 < data.length) rem |= data[i + 2] << 16;
    csum = (csum ^ rem) >>> 0;
    csum = (csum ^ ((cbData & 0xFFFF) | ((cbUncomp & 0xFFFF) << 16))) >>> 0;
    return csum;
  }

  async build(entries, _password, options) {
    const method = parseInt((options && options.method) || '1', 10);
    const files = entries.filter(e => !e.isDirectory && e._data instanceof Uint8Array);
    if (files.length === 0) throw new Error('No files to add');

    let totalUncomp = 0;
    const fileInfos = [];
    for (const entry of files) {
      const raw = entry._data;
      const name = entry.name.replace(/\//g, '\\');
      const nameBytes = new TextEncoder().encode(name);
      fileInfos.push({ nameBytes, size: raw.length, offset: totalUncomp, data: raw, modified: entry.modified || new Date() });
      totalUncomp += raw.length;
    }

    const allData = new Uint8Array(totalUncomp);
    let off = 0;
    for (const fi of fileInfos) { allData.set(fi.data, off); off += fi.size; }

    const CAB_BLOCK = 32768;
    const dataBlocks = [];
    off = 0;
    while (off < allData.length) {
      const blockEnd = Math.min(off + CAB_BLOCK, allData.length);
      const blockData = allData.subarray(off, blockEnd);
      let compData;
      if (method === 1) {
        const deflated = await _tryDeflateCompress(blockData);
        compData = new Uint8Array(2 + deflated.length);
        compData[0] = 0x43; compData[1] = 0x4B;
        compData.set(deflated, 2);
      } else
        compData = blockData;
      dataBlocks.push({ compData, uncompSize: blockData.length });
      off = blockEnd;
    }

    if (dataBlocks.length === 0)
      dataBlocks.push({ compData: new Uint8Array(0), uncompSize: 0 });

    const headerSize = 36;
    const folderSize = 8;
    const fileEntriesSize = fileInfos.reduce((sum, fi) => sum + 16 + fi.nameBytes.length + 1, 0);
    const coffFiles = headerSize + folderSize;
    const coffData = coffFiles + fileEntriesSize;

    const cfDataParts = [];
    for (const block of dataBlocks) {
      const cfData = new Uint8Array(8 + block.compData.length);
      writeU16LE(cfData, 4, block.compData.length);
      writeU16LE(cfData, 6, block.uncompSize);
      cfData.set(block.compData, 8);
      writeU32LE(cfData, 0, CabFormat._computeCabChecksum(block.compData, block.compData.length, block.uncompSize));
      cfDataParts.push(cfData);
    }

    const dataSize = cfDataParts.reduce((sum, p) => sum + p.length, 0);
    const cabinetSize = coffData + dataSize;

    const header = new Uint8Array(headerSize);
    header[0] = 0x4D; header[1] = 0x53; header[2] = 0x43; header[3] = 0x46;
    writeU32LE(header, 8, cabinetSize);
    writeU32LE(header, 16, coffFiles);
    header[24] = 3; header[25] = 1;
    writeU16LE(header, 26, 1);
    writeU16LE(header, 28, files.length);

    const folder = new Uint8Array(folderSize);
    writeU32LE(folder, 0, coffData);
    writeU16LE(folder, 4, dataBlocks.length);
    writeU16LE(folder, 6, method);

    const cfFileParts = [];
    for (const fi of fileInfos) {
      const cfFile = new Uint8Array(16 + fi.nameBytes.length + 1);
      writeU32LE(cfFile, 0, fi.size);
      writeU32LE(cfFile, 4, fi.offset);
      writeU16LE(cfFile, 8, 0);
      const dosTime = dateToDos(fi.modified);
      writeU16LE(cfFile, 10, dosTime.date);
      writeU16LE(cfFile, 12, dosTime.time);
      writeU16LE(cfFile, 14, 0x20);
      cfFile.set(fi.nameBytes, 16);
      cfFileParts.push(cfFile);
    }

    const result = new Uint8Array(cabinetSize);
    let pos = 0;
    result.set(header, pos); pos += headerSize;
    result.set(folder, pos); pos += folderSize;
    for (const fp of cfFileParts) { result.set(fp, pos); pos += fp.length; }
    for (const dp of cfDataParts) { result.set(dp, pos); pos += dp.length; }
    return result;
  }
}

IArchiveFormat.register(CabFormat);

})();
