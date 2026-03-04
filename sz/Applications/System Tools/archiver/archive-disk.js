;(function() {
'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry, computeCRC32,
        readU16LE, readU32LE, writeU16LE, writeU32LE,
        readU16BE, readU32BE,
        getFileName, getFileExtension, normalizeArchivePath,
        decompressGzip, _tryDeflateDecompress,
        _tryBzip2Decompress, _tryLzmaDecompress,
        _cipherDecompress } = A;

const { formatSize, dosToDate, crc32Hex } = A;

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

IArchiveFormat.register(DmgFormat);
IArchiveFormat.register(SquashFsFormat);
IArchiveFormat.register(CramFsFormat);
IArchiveFormat.register(UdfFormat);
IArchiveFormat.register(FatFormat);
IArchiveFormat.register(NtfsFormat);
IArchiveFormat.register(ExtFormat);
IArchiveFormat.register(HfsFormat);
IArchiveFormat.register(ApfsFormat);
IArchiveFormat.register(Qcow2Format);
IArchiveFormat.register(VhdFormat);
IArchiveFormat.register(VhdxFormat);
IArchiveFormat.register(VdiFormat);
IArchiveFormat.register(VmdkFormat);
IArchiveFormat.register(GptFormat);
IArchiveFormat.register(MbrFormat);

})();
