;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readString, formatSize } = P;

  // =========================================================================
  // NES ROM (iNES format)
  // =========================================================================

  const NES_MAPPER_NAMES = {
    0: 'NROM', 1: 'MMC1 (SxROM)', 2: 'UxROM', 3: 'CNROM', 4: 'MMC3 (TxROM)',
    7: 'AxROM', 9: 'MMC2', 10: 'MMC4', 11: 'Color Dreams', 66: 'GxROM', 71: 'Camerica',
  };

  function parseNES(bytes) {
    const fields = [];
    if (bytes.length < 16)
      return { categories: [{ name: 'NES ROM', icon: 'info', fields }], images: [] };

    const prgSize = readU8(bytes, 4) * 16384;
    const chrSize = readU8(bytes, 5) * 8192;
    const flags6 = readU8(bytes, 6);
    const flags7 = readU8(bytes, 7);
    const prgRamSize = readU8(bytes, 8) || 1; // 0 means 8KB (1 unit)
    const flags9 = readU8(bytes, 9);

    const mapperLow = (flags6 >> 4) & 0x0F;
    const mapperHigh = (flags7 >> 4) & 0x0F;
    const mapper = (mapperHigh << 4) | mapperLow;

    const mirroring = (flags6 & 0x08) ? 'Four-screen' : (flags6 & 0x01) ? 'Vertical' : 'Horizontal';
    const hasBattery = !!(flags6 & 0x02);
    const hasTrainer = !!(flags6 & 0x04);
    const isNES2 = ((flags7 >> 2) & 0x03) === 2;
    const tvSystem = (flags9 & 0x01) ? 'PAL' : 'NTSC';

    fields.push({ key: 'nes.prg', label: 'PRG ROM Size', value: formatSize(prgSize) });
    fields.push({ key: 'nes.chr', label: 'CHR ROM Size', value: chrSize > 0 ? formatSize(chrSize) : 'None (CHR RAM)' });
    fields.push({ key: 'nes.mapper', label: 'Mapper Number', value: String(mapper) + (NES_MAPPER_NAMES[mapper] ? ' (' + NES_MAPPER_NAMES[mapper] + ')' : '') });
    fields.push({ key: 'nes.mirror', label: 'Mirroring', value: mirroring });
    fields.push({ key: 'nes.battery', label: 'Battery', value: hasBattery ? 'Yes' : 'No' });
    if (hasTrainer)
      fields.push({ key: 'nes.trainer', label: 'Trainer', value: 'Yes (512 bytes)' });
    fields.push({ key: 'nes.prgram', label: 'PRG RAM Size', value: formatSize(prgRamSize * 8192) });
    fields.push({ key: 'nes.nes2', label: 'NES 2.0', value: isNES2 ? 'Yes' : 'No' });
    fields.push({ key: 'nes.tv', label: 'TV System', value: tvSystem });

    const codeOffset = 16 + (hasTrainer ? 512 : 0);
    return {
      categories: [{ name: 'NES ROM', icon: 'info', fields }],
      images: [],
      disassembly: [{ archId: '6502', offset: codeOffset, count: 200 }],
    };
  }

  // =========================================================================
  // Game Boy ROM
  // =========================================================================

  const GB_CART_TYPES = {
    0x00: 'ROM', 0x01: 'MBC1', 0x02: 'MBC1+RAM', 0x03: 'MBC1+RAM+Battery',
    0x05: 'MBC2', 0x06: 'MBC2+Battery',
    0x0F: 'MBC3+Timer+Battery', 0x10: 'MBC3+Timer+RAM+Battery',
    0x11: 'MBC3', 0x12: 'MBC3+RAM', 0x13: 'MBC3+RAM+Battery',
    0x19: 'MBC5', 0x1A: 'MBC5+RAM', 0x1B: 'MBC5+RAM+Battery', 0x1C: 'MBC5+Rumble',
    0x20: 'MBC6', 0x22: 'MBC7+Sensor',
    0xFC: 'Pocket Camera', 0xFE: 'HuC3', 0xFF: 'HuC1+RAM+Battery',
  };

  const GB_ROM_SIZES = {
    0: 32768, 1: 65536, 2: 131072, 3: 262144, 4: 524288,
    5: 1048576, 6: 2097152, 7: 4194304, 8: 8388608,
  };

  const GB_RAM_SIZES = {
    0: 0, 1: 0, 2: 8192, 3: 32768, 4: 131072, 5: 65536,
  };

  function parseGB(bytes) {
    const fields = [];
    if (bytes.length < 0x150)
      return { categories: [{ name: 'Game Boy ROM', icon: 'info', fields }], images: [] };

    const cgbFlag = readU8(bytes, 0x143);
    const isCGB = cgbFlag === 0x80 || cgbFlag === 0xC0;
    const titleLen = isCGB ? 11 : 16;
    const title = readString(bytes, 0x134, titleLen).trim();

    const newLicensee = readString(bytes, 0x144, 2);
    const sgbFlag = readU8(bytes, 0x146);
    const cartType = readU8(bytes, 0x147);
    const romSizeCode = readU8(bytes, 0x148);
    const ramSizeCode = readU8(bytes, 0x149);
    const destination = readU8(bytes, 0x14A);
    const oldLicensee = readU8(bytes, 0x14B);
    const maskRomVersion = readU8(bytes, 0x14C);
    const headerChecksum = readU8(bytes, 0x14D);
    const globalChecksum = readU16BE(bytes, 0x14E);

    // Verify header checksum
    let computedChecksum = 0;
    for (let i = 0x134; i <= 0x14C; ++i)
      computedChecksum = (computedChecksum - readU8(bytes, i) - 1) & 0xFF;
    const checksumValid = computedChecksum === headerChecksum;

    fields.push({ key: 'gb.title', label: 'Title', value: title || '(none)' });

    let systemType = 'Game Boy';
    if (cgbFlag === 0xC0) systemType = 'Game Boy Color Only';
    else if (cgbFlag === 0x80) systemType = 'Game Boy Color Compatible';
    if (sgbFlag === 0x03) systemType += ' + SGB';
    fields.push({ key: 'gb.system', label: 'System', value: systemType });

    fields.push({ key: 'gb.cart', label: 'Cartridge Type', value: GB_CART_TYPES[cartType] || '0x' + cartType.toString(16).toUpperCase() });

    const romSize = GB_ROM_SIZES[romSizeCode];
    fields.push({ key: 'gb.rom', label: 'ROM Size', value: romSize ? formatSize(romSize) : 'Unknown (0x' + romSizeCode.toString(16) + ')' });

    const ramSize = GB_RAM_SIZES[ramSizeCode];
    fields.push({ key: 'gb.ram', label: 'RAM Size', value: ramSize > 0 ? formatSize(ramSize) : 'None' });

    fields.push({ key: 'gb.dest', label: 'Destination', value: destination === 0 ? 'Japan' : 'International' });

    if (oldLicensee === 0x33)
      fields.push({ key: 'gb.licensee', label: 'Licensee', value: newLicensee });
    else
      fields.push({ key: 'gb.licensee', label: 'Licensee Code', value: '0x' + oldLicensee.toString(16).toUpperCase() });

    fields.push({ key: 'gb.version', label: 'Mask ROM Version', value: String(maskRomVersion) });
    fields.push({ key: 'gb.hchk', label: 'Header Checksum', value: '0x' + headerChecksum.toString(16).toUpperCase() + (checksumValid ? ' (valid)' : ' (INVALID)') });
    fields.push({ key: 'gb.gchk', label: 'Global Checksum', value: '0x' + globalChecksum.toString(16).toUpperCase().padStart(4, '0') });

    return {
      categories: [{ name: 'Game Boy ROM', icon: 'info', fields }],
      images: [],
      disassembly: [{ archId: 'z80', offset: 0x150, count: 200, options: { gameboy: true } }],
    };
  }

  // =========================================================================
  // Sega Master System / Game Gear ROM
  // =========================================================================

  const SMS_REGION_NAMES = {
    3: 'SMS Japan', 4: 'SMS Export', 5: 'GG Japan', 6: 'GG Export', 7: 'GG International',
  };

  function parseSMS(bytes) {
    const fields = [];

    // Try standard header offsets: 0x7FF0, 0x3FF0, 0x1FF0
    const offsets = [0x7FF0, 0x3FF0, 0x1FF0];
    let headerBase = -1;
    for (const off of offsets) {
      if (off + 16 > bytes.length) continue;
      if (readString(bytes, off, 8) === 'TMR SEGA') {
        headerBase = off;
        break;
      }
    }

    if (headerBase < 0)
      return { categories: [{ name: 'SMS/GG ROM', icon: 'info', fields: [{ key: 'sms.err', label: 'Error', value: 'TMR SEGA header not found' }] }], images: [] };

    fields.push({ key: 'sms.header', label: 'Header Location', value: '0x' + headerBase.toString(16).toUpperCase() });

    const checksum = readU16LE(bytes, headerBase + 0x0A);
    fields.push({ key: 'sms.checksum', label: 'Checksum', value: '0x' + checksum.toString(16).toUpperCase().padStart(4, '0') });

    // Product code: 3 bytes BCD at +0x0C..+0x0E (low nibble of +0x0E is version)
    const pcLow = readU8(bytes, headerBase + 0x0C);
    const pcMid = readU8(bytes, headerBase + 0x0D);
    const pcHigh = readU8(bytes, headerBase + 0x0E);
    const version = pcHigh & 0x0F;
    const productCode = ((pcHigh >> 4) & 0x0F) * 10000 + ((pcMid >> 4) & 0x0F) * 1000 + (pcMid & 0x0F) * 100 + ((pcLow >> 4) & 0x0F) * 10 + (pcLow & 0x0F);
    fields.push({ key: 'sms.product', label: 'Product Code', value: String(productCode) });
    fields.push({ key: 'sms.version', label: 'Version', value: String(version) });

    const regionByte = readU8(bytes, headerBase + 0x0F);
    const regionCode = (regionByte >> 4) & 0x0F;
    fields.push({ key: 'sms.region', label: 'Region', value: SMS_REGION_NAMES[regionCode] || 'Unknown (' + regionCode + ')' });

    const romSizeNibble = regionByte & 0x0F;
    const smsRomSizes = {
      0x0A: '8 KB', 0x0B: '16 KB', 0x0C: '32 KB', 0x0D: '48 KB',
      0x0E: '64 KB', 0x0F: '128 KB', 0x00: '256 KB', 0x01: '512 KB', 0x02: '1 MB',
    };
    fields.push({ key: 'sms.romsize', label: 'ROM Size (header)', value: smsRomSizes[romSizeNibble] || 'Unknown (0x' + romSizeNibble.toString(16) + ')' });
    fields.push({ key: 'sms.filesize', label: 'File Size', value: formatSize(bytes.length) });

    return {
      categories: [{ name: 'SMS/GG ROM', icon: 'info', fields }],
      images: [],
      disassembly: [{ archId: 'z80', offset: 0, count: 200 }],
    };
  }

  // =========================================================================
  // Sega Genesis / Mega Drive ROM
  // =========================================================================

  function parseGenesis(bytes) {
    const fields = [];
    if (bytes.length < 0x200)
      return { categories: [{ name: 'Genesis ROM', icon: 'info', fields }], images: [] };

    const consoleName = readString(bytes, 0x100, 16).trim();
    const copyright = readString(bytes, 0x110, 16).trim();
    const domesticName = readString(bytes, 0x120, 48).trim();
    const overseasName = readString(bytes, 0x150, 48).trim();
    const serialNumber = readString(bytes, 0x180, 14).trim();
    const checksum = readU16BE(bytes, 0x18E);
    const ioSupport = readString(bytes, 0x190, 16).trim();
    const romStart = readU32BE(bytes, 0x1A0);
    const romEnd = readU32BE(bytes, 0x1A4);
    const regionCodes = readString(bytes, 0x1F0, 16).trim();

    fields.push({ key: 'gen.console', label: 'Console', value: consoleName || '(unknown)' });
    fields.push({ key: 'gen.copyright', label: 'Copyright', value: copyright || '(none)' });
    fields.push({ key: 'gen.domestic', label: 'Domestic Name', value: domesticName || '(none)' });
    fields.push({ key: 'gen.overseas', label: 'Overseas Name', value: overseasName || '(none)' });
    fields.push({ key: 'gen.serial', label: 'Serial Number', value: serialNumber || '(none)' });
    fields.push({ key: 'gen.checksum', label: 'Checksum', value: '0x' + checksum.toString(16).toUpperCase().padStart(4, '0') });
    if (ioSupport)
      fields.push({ key: 'gen.io', label: 'I/O Support', value: ioSupport });
    fields.push({ key: 'gen.romrange', label: 'ROM Range', value: '0x' + romStart.toString(16).toUpperCase() + ' - 0x' + romEnd.toString(16).toUpperCase() + ' (' + formatSize(romEnd - romStart + 1) + ')' });
    if (regionCodes)
      fields.push({ key: 'gen.region', label: 'Region Codes', value: regionCodes });

    // Entry point: 68000 reset vector at offset 4 (big-endian)
    let entryPoint = readU32BE(bytes, 4);
    if (entryPoint >= bytes.length)
      entryPoint = 0x200; // fallback to after header

    return {
      categories: [{ name: 'Genesis ROM', icon: 'info', fields }],
      images: [],
      disassembly: [{ archId: 'm68k', offset: Math.min(entryPoint, bytes.length - 1), count: 200 }],
    };
  }

  // =========================================================================
  // Super Nintendo (SNES) ROM
  // =========================================================================

  const SNES_COUNTRY_NAMES = {
    0x00: 'Japan', 0x01: 'USA', 0x02: 'Europe', 0x03: 'Sweden',
    0x04: 'Finland', 0x05: 'Denmark', 0x06: 'France', 0x07: 'Netherlands',
    0x08: 'Spain', 0x09: 'Germany', 0x0A: 'Italy', 0x0B: 'China',
    0x0C: 'Indonesia', 0x0D: 'South Korea', 0x0F: 'Canada',
    0x10: 'Brazil', 0x11: 'Australia',
  };

  function parseSNES(bytes) {
    const fields = [];
    if (bytes.length < 0x8000)
      return { categories: [{ name: 'SNES ROM', icon: 'info', fields }], images: [] };

    // Detect and skip SMC copier header (512 bytes if file size mod 1024 == 512)
    const smcOffset = (bytes.length % 1024 === 512) ? 512 : 0;
    if (smcOffset)
      fields.push({ key: 'snes.smc', label: 'SMC Header', value: 'Present (512 bytes, skipped)' });

    // Try LoROM (0x7FC0) and HiROM (0xFFC0) header locations
    const loromBase = smcOffset + 0x7FC0;
    const hiromBase = smcOffset + 0xFFC0;

    function validateHeader(base) {
      if (base + 0x20 > bytes.length) return false;
      const complement = readU16LE(bytes, base + 0x1C);
      const checksum = readU16LE(bytes, base + 0x1E);
      return ((complement + checksum) & 0xFFFF) === 0xFFFF;
    }

    let headerBase;
    let isHiROM;
    if (validateHeader(loromBase)) {
      headerBase = loromBase;
      isHiROM = false;
    } else if (validateHeader(hiromBase)) {
      headerBase = hiromBase;
      isHiROM = true;
    } else {
      // Fallback: try LoROM first
      headerBase = loromBase;
      isHiROM = false;
      if (headerBase + 0x20 > bytes.length)
        return { categories: [{ name: 'SNES ROM', icon: 'info', fields: [{ key: 'snes.err', label: 'Error', value: 'Could not locate valid SNES header' }] }], images: [] };
    }

    const title = readString(bytes, headerBase, 21).trim();
    const mapMode = readU8(bytes, headerBase + 0x15);
    const romType = readU8(bytes, headerBase + 0x16);
    const romSizeCode = readU8(bytes, headerBase + 0x17);
    const ramSizeCode = readU8(bytes, headerBase + 0x18);
    const country = readU8(bytes, headerBase + 0x19);
    const devId = readU8(bytes, headerBase + 0x1A);
    const version = readU8(bytes, headerBase + 0x1B);
    const complement = readU16LE(bytes, headerBase + 0x1C);
    const checksum = readU16LE(bytes, headerBase + 0x1E);

    const mapName = (mapMode & 0x01) ? 'HiROM' : 'LoROM';
    const speed = (mapMode & 0x10) ? 'FastROM' : 'SlowROM';

    fields.push({ key: 'snes.title', label: 'Title', value: title || '(none)' });
    fields.push({ key: 'snes.map', label: 'Map Mode', value: mapName + ' / ' + speed });
    fields.push({ key: 'snes.romtype', label: 'ROM Type', value: '0x' + romType.toString(16).toUpperCase() });

    const romSize = romSizeCode > 0 ? (1 << romSizeCode) * 1024 : 0;
    fields.push({ key: 'snes.romsize', label: 'ROM Size', value: romSize > 0 ? formatSize(romSize) : 'Unknown' });

    const ramSize = ramSizeCode > 0 ? (1 << ramSizeCode) * 1024 : 0;
    fields.push({ key: 'snes.ramsize', label: 'RAM Size', value: ramSize > 0 ? formatSize(ramSize) : 'None' });

    fields.push({ key: 'snes.country', label: 'Country', value: SNES_COUNTRY_NAMES[country] || 'Unknown (' + country + ')' });
    fields.push({ key: 'snes.dev', label: 'Developer ID', value: '0x' + devId.toString(16).toUpperCase() });
    fields.push({ key: 'snes.version', label: 'Version', value: '1.' + version });
    fields.push({ key: 'snes.checksum', label: 'Checksum', value: '0x' + checksum.toString(16).toUpperCase().padStart(4, '0') });
    fields.push({ key: 'snes.complement', label: 'Complement', value: '0x' + complement.toString(16).toUpperCase().padStart(4, '0') });

    const checksumValid = ((complement + checksum) & 0xFFFF) === 0xFFFF;
    fields.push({ key: 'snes.chkvalid', label: 'Checksum Valid', value: checksumValid ? 'Yes' : 'No' });

    // Reset vector: for LoROM at headerBase + 0x3C, for HiROM at 0xFFFC in CPU space
    // In the file: LoROM reset vector is at smcOffset + 0x7FFC, HiROM at smcOffset + 0xFFFC
    const resetVectorFileOffset = isHiROM ? smcOffset + 0xFFFC : smcOffset + 0x7FFC;
    let resetAddr = 0;
    if (resetVectorFileOffset + 2 <= bytes.length)
      resetAddr = readU16LE(bytes, resetVectorFileOffset);

    // Map CPU address to file offset
    let resetFileOffset;
    if (isHiROM)
      resetFileOffset = smcOffset + (resetAddr & 0x3FFFFF);
    else
      resetFileOffset = smcOffset + ((resetAddr & 0x7FFF) + ((resetAddr >> 1) & 0x3F8000));

    // Simplified LoROM mapping: bank < 0x80 => offset = (bank * 0x8000) + (addr & 0x7FFF)
    // For typical reset vectors in bank 0x00-0x7F, addr & 0x7FFF is sufficient for initial disassembly
    if (!isHiROM)
      resetFileOffset = smcOffset + (resetAddr & 0x7FFF);

    if (resetFileOffset >= bytes.length)
      resetFileOffset = smcOffset; // fallback

    fields.push({ key: 'snes.reset', label: 'Reset Vector', value: '0x' + resetAddr.toString(16).toUpperCase().padStart(4, '0') });

    return {
      categories: [{ name: 'SNES ROM', icon: 'info', fields }],
      images: [],
      disassembly: [{ archId: '65c816', offset: resetFileOffset, count: 200 }],
    };
  }

  // =========================================================================
  // Commodore 64 .prg
  // =========================================================================

  function parseC64PRG(bytes) {
    const fields = [];
    if (bytes.length < 2)
      return { categories: [{ name: 'C64 PRG', icon: 'info', fields }], images: [] };

    const loadAddr = readU16LE(bytes, 0);
    const progSize = bytes.length - 2;

    fields.push({ key: 'c64.load', label: 'Load Address', value: '$' + loadAddr.toString(16).toUpperCase().padStart(4, '0') });
    fields.push({ key: 'c64.size', label: 'Program Size', value: formatSize(progSize) });
    fields.push({ key: 'c64.end', label: 'End Address', value: '$' + ((loadAddr + progSize - 1) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0') });

    // Detect BASIC stub (starts with a pointer and line number)
    if (progSize >= 4) {
      const nextLine = readU16LE(bytes, 2);
      if (nextLine >= loadAddr && nextLine < loadAddr + progSize)
        fields.push({ key: 'c64.basic', label: 'BASIC Stub', value: 'Likely present (next line pointer: $' + nextLine.toString(16).toUpperCase().padStart(4, '0') + ')' });
    }

    return {
      categories: [{ name: 'C64 PRG', icon: 'info', fields }],
      images: [],
      disassembly: [{ archId: '6502', offset: 2, count: 200 }],
    };
  }

  // =========================================================================
  // Amiga Hunk Executable
  // =========================================================================

  const HUNK_NAMES = {
    0x3E9: 'HUNK_CODE', 0x3EA: 'HUNK_DATA', 0x3EB: 'HUNK_BSS',
    0x3EC: 'HUNK_RELOC32', 0x3F2: 'HUNK_END',
    0x3ED: 'HUNK_RELOC16', 0x3EE: 'HUNK_RELOC8',
    0x3EF: 'HUNK_EXT', 0x3F0: 'HUNK_SYMBOL', 0x3F1: 'HUNK_DEBUG',
    0x3F3: 'HUNK_HEADER', 0x3F4: 'HUNK_OVERLAY', 0x3F5: 'HUNK_BREAK',
  };

  function parseAmigaHunk(bytes) {
    const fields = [];
    if (bytes.length < 8)
      return { categories: [{ name: 'Amiga Hunk', icon: 'info', fields }], images: [] };

    const magic = readU32BE(bytes, 0);
    if (magic !== 0x000003F3)
      return { categories: [{ name: 'Amiga Hunk', icon: 'info', fields: [{ key: 'hunk.err', label: 'Error', value: 'Invalid HUNK_HEADER magic' }] }], images: [] };

    let pos = 4;

    // Skip resident library names (null-terminated string list ended by empty string = 0 longword)
    while (pos + 4 <= bytes.length) {
      const nameLen = readU32BE(bytes, pos);
      pos += 4;
      if (nameLen === 0) break;
      pos += nameLen * 4; // name length is in longwords
    }

    if (pos + 12 > bytes.length)
      return { categories: [{ name: 'Amiga Hunk', icon: 'info', fields: [{ key: 'hunk.err', label: 'Error', value: 'Truncated HUNK_HEADER' }] }], images: [] };

    const tableSize = readU32BE(bytes, pos); pos += 4;
    const firstHunk = readU32BE(bytes, pos); pos += 4;
    const lastHunk = readU32BE(bytes, pos); pos += 4;
    const numHunks = lastHunk - firstHunk + 1;

    fields.push({ key: 'hunk.count', label: 'Hunk Count', value: String(numHunks) });
    fields.push({ key: 'hunk.first', label: 'First Hunk', value: String(firstHunk) });
    fields.push({ key: 'hunk.last', label: 'Last Hunk', value: String(lastHunk) });

    // Read hunk size table
    const hunkSizes = [];
    for (let i = 0; i < numHunks && pos + 4 <= bytes.length; ++i) {
      const sizeWord = readU32BE(bytes, pos); pos += 4;
      // Upper 2 bits encode memory type: 0=any, 1=chip, 2=fast
      const memType = (sizeWord >> 30) & 0x03;
      const sizeLongs = sizeWord & 0x3FFFFFFF;
      hunkSizes.push({ sizeLongs, memType });
    }

    const hunkFields = [];
    let codeDataOffset = -1;
    let hunkIndex = 0;

    // Walk actual hunks after HUNK_HEADER
    while (pos + 4 <= bytes.length && hunkIndex < 100) {
      const hunkType = readU32BE(bytes, pos) & 0x3FFFFFFF;
      pos += 4;

      const typeName = HUNK_NAMES[hunkType] || '0x' + hunkType.toString(16).toUpperCase();

      if (hunkType === 0x3E9 || hunkType === 0x3EA) {
        // HUNK_CODE / HUNK_DATA: size in longwords, then data
        if (pos + 4 > bytes.length) break;
        const sizeLongs = readU32BE(bytes, pos); pos += 4;
        const sizeBytes = sizeLongs * 4;
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName + ' (' + formatSize(sizeBytes) + ')' });

        if (hunkType === 0x3E9 && codeDataOffset < 0)
          codeDataOffset = pos;

        pos += sizeBytes;
      } else if (hunkType === 0x3EB) {
        // HUNK_BSS: size in longwords, no data
        if (pos + 4 > bytes.length) break;
        const sizeLongs = readU32BE(bytes, pos); pos += 4;
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName + ' (' + formatSize(sizeLongs * 4) + ')' });
      } else if (hunkType === 0x3EC) {
        // HUNK_RELOC32: relocation tables terminated by count=0
        let relocCount = 0;
        while (pos + 4 <= bytes.length) {
          const count = readU32BE(bytes, pos); pos += 4;
          if (count === 0) break;
          pos += 4; // hunk number
          pos += count * 4; // offset list
          relocCount += count;
        }
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName + ' (' + relocCount + ' relocations)' });
      } else if (hunkType === 0x3F2) {
        // HUNK_END: marks end of one hunk block
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName });
      } else if (hunkType === 0x3F0) {
        // HUNK_SYMBOL: name(longwords)+value pairs, terminated by 0
        while (pos + 4 <= bytes.length) {
          const symLen = readU32BE(bytes, pos); pos += 4;
          if (symLen === 0) break;
          pos += symLen * 4 + 4; // name + value
        }
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName });
      } else if (hunkType === 0x3F1) {
        // HUNK_DEBUG: size in longwords, then data
        if (pos + 4 > bytes.length) break;
        const sizeLongs = readU32BE(bytes, pos); pos += 4;
        pos += sizeLongs * 4;
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName });
      } else {
        // Unknown hunk type -- stop to avoid corruption
        hunkFields.push({ key: 'hunk.h.' + hunkIndex, label: 'Hunk ' + hunkIndex, value: typeName + ' (unknown, stopped parsing)' });
        break;
      }

      ++hunkIndex;
    }

    const categories = [{ name: 'Amiga Hunk', icon: 'info', fields }];
    if (hunkFields.length > 0)
      categories.push({ name: 'Hunk Table (' + hunkFields.length + ')', icon: 'list', fields: hunkFields });

    return {
      categories,
      images: [],
      disassembly: codeDataOffset >= 0 ? [{ archId: 'm68k', offset: codeDataOffset, count: 200 }] : null,
    };
  }

  // =========================================================================
  // Register all retro parsers
  // =========================================================================

  P.registerParsers({
    nes: parseNES, gb: parseGB, sms: parseSMS,
    genesis: parseGenesis, snes: parseSNES,
    c64prg: parseC64PRG, amigahunk: parseAmigaHunk,
  });
})();
