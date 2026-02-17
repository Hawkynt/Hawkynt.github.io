;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});
  const { readU8, readU32BE, readString, formatSize } = F;

  // =========================================================================
  // ADF constants
  // =========================================================================

  const ADF_SIZE = 901120; // 80 cylinders x 2 heads x 11 sectors x 512 bytes
  const SECTOR_SIZE = 512;
  const SECTORS_PER_TRACK = 11;
  const TRACKS = 160; // 80 cylinders x 2 heads
  const TOTAL_SECTORS = TRACKS * SECTORS_PER_TRACK; // 1760
  const ROOT_BLOCK = 880; // middle of disk

  // Block types
  const T_HEADER = 2;
  const T_DATA = 8;
  const T_LIST = 16;

  // Secondary types
  const ST_ROOT = 1;
  const ST_DIR = 2;
  const ST_FILE = -3;

  // Protection bits (active-low)
  const PROT_DELETE = 0x01;
  const PROT_EXECUTE = 0x02;
  const PROT_WRITE = 0x04;
  const PROT_READ = 0x08;
  const PROT_ARCHIVE = 0x10;
  const PROT_PURE = 0x20;
  const PROT_SCRIPT = 0x40;
  const PROT_HOLD = 0x80;

  function blockOffset(block) {
    return block * SECTOR_SIZE;
  }

  function readAmigaDate(bytes, offset) {
    // Amiga date: 3 longs — days since 1978-01-01, minutes, ticks (1/50 sec)
    const days = readU32BE(bytes, offset);
    const mins = readU32BE(bytes, offset + 4);
    const ticks = readU32BE(bytes, offset + 8);
    const ms = ((days * 86400) + (mins * 60) + Math.floor(ticks / 50)) * 1000;
    // Amiga epoch: 1978-01-01
    const epoch = new Date(1978, 0, 1).getTime();
    return new Date(epoch + ms);
  }

  function readAmigaString(bytes, offset) {
    // Amiga stores strings as: 1 byte length, then chars
    const len = readU8(bytes, offset);
    if (len === 0 || len > 30) return '';
    return readString(bytes, offset + 1, len);
  }

  function formatProtection(bits) {
    const flags = [];
    // Active-low bits (inverted meaning: 0 = set)
    if (!(bits & PROT_READ)) flags.push('r');
    if (!(bits & PROT_WRITE)) flags.push('w');
    if (!(bits & PROT_EXECUTE)) flags.push('e');
    if (!(bits & PROT_DELETE)) flags.push('d');
    // Active-high bits
    if (bits & PROT_HOLD) flags.push('h');
    if (bits & PROT_SCRIPT) flags.push('s');
    if (bits & PROT_PURE) flags.push('p');
    if (bits & PROT_ARCHIVE) flags.push('a');
    return flags.length ? flags.join('') : '----';
  }

  function computeChecksum(bytes, offset) {
    let sum = 0;
    for (let i = 0; i < SECTOR_SIZE; i += 4)
      sum = ((sum + readU32BE(bytes, offset + i)) & 0xFFFFFFFF) >>> 0;
    return sum;
  }

  // =========================================================================
  // ADF Parser
  // =========================================================================

  function parseADF(bytes) {
    if (bytes.length < ADF_SIZE)
      return {
        format: 'adf', volumeName: '(truncated)', filesystem: 'Unknown',
        rootBlock: null, bitmap: null, directory: [],
        errors: ['File too small for standard ADF'],
      };

    // ---- Root block ----
    const rootOff = blockOffset(ROOT_BLOCK);
    const blockType = readU32BE(bytes, rootOff);
    const secType = readU32BE(bytes, rootOff + SECTOR_SIZE - 4);

    // Detect filesystem: check root block validity
    if (blockType !== T_HEADER)
      return {
        format: 'adf', volumeName: '(invalid root block)', filesystem: 'Unknown',
        rootBlock: null, bitmap: null, directory: [],
        errors: ['Root block type mismatch: expected ' + T_HEADER + ', got ' + blockType],
      };

    // Secondary type should be ST_ROOT (1)
    const secTypeI32 = secType | 0; // treat as signed
    const isRoot = secTypeI32 === ST_ROOT;

    // Determine filesystem type from root block
    // OFS: data blocks have checksum at offset 20; FFS: pure data blocks
    // Quick heuristic: check if first data block (if any) has valid OFS header
    const htSize = readU32BE(bytes, rootOff + 12); // hash table size
    const firstBmBlock = readU32BE(bytes, rootOff + SECTOR_SIZE - 196);

    // Check bitmap flag: 0xFFFFFFFF = valid, 0 = needs repair
    const bmFlag = readU32BE(bytes, rootOff + SECTOR_SIZE - 200);

    // Volume name at root block offset SECTOR_SIZE - 80
    const volumeName = readAmigaString(bytes, rootOff + SECTOR_SIZE - 80);

    // Dates
    const rootModified = readAmigaDate(bytes, rootOff + SECTOR_SIZE - 92);
    const diskCreated = readAmigaDate(bytes, rootOff + SECTOR_SIZE - 40);
    const rootCreated = readAmigaDate(bytes, rootOff + SECTOR_SIZE - 28);

    // Detect OFS vs FFS by examining the boot block
    const bootFlags = readU32BE(bytes, 0);
    // "DOS\0" = OFS, "DOS\1" = FFS, "DOS\2" = OFS intl, "DOS\3" = FFS intl
    const dosIdent = readString(bytes, 0, 3);
    const dosFlags = readU8(bytes, 3);
    let filesystem = 'Unknown';
    if (dosIdent === 'DOS') {
      if (dosFlags === 0) filesystem = 'OFS';
      else if (dosFlags === 1) filesystem = 'FFS';
      else if (dosFlags === 2) filesystem = 'OFS (International)';
      else if (dosFlags === 3) filesystem = 'FFS (International)';
      else if (dosFlags === 4) filesystem = 'OFS (Dir Cache)';
      else if (dosFlags === 5) filesystem = 'FFS (Dir Cache)';
      else filesystem = 'DOS/' + dosFlags;
    }

    // ---- Bitmap ----
    let freeBlocks = 0;
    let usedBlocks = 0;
    if (firstBmBlock > 0 && firstBmBlock < TOTAL_SECTORS) {
      const bmOff = blockOffset(firstBmBlock);
      if (bmOff + SECTOR_SIZE <= bytes.length) {
        // Bitmap block: first 4 bytes = checksum, then 127 longs (each bit = one block)
        for (let w = 1; w < 128; ++w) {
          const word = readU32BE(bytes, bmOff + w * 4);
          for (let bit = 0; bit < 32; ++bit) {
            if (freeBlocks + usedBlocks >= TOTAL_SECTORS) break;
            if ((word >>> bit) & 1)
              ++freeBlocks;
            else
              ++usedBlocks;
          }
        }
      }
    }

    // Correct for reserved blocks (boot blocks + root block)
    const bitmap = {
      freeBlocks,
      usedBlocks,
      totalBlocks: TOTAL_SECTORS,
    };

    // ---- Directory listing ----
    const directory = [];

    function readDirBlock(block, depth) {
      if (block < 2 || block >= TOTAL_SECTORS || depth > 20) return;
      const off = blockOffset(block);
      if (off + SECTOR_SIZE > bytes.length) return;

      const bType = readU32BE(bytes, off);
      if (bType !== T_HEADER) return;

      // Hash table: 72 entries at offset 24 (each a u32 block pointer, 0 = empty)
      const htOff = off + 24;
      for (let i = 0; i < 72; ++i) {
        let entryBlock = readU32BE(bytes, htOff + i * 4);
        const visited = new Set();
        while (entryBlock > 0 && entryBlock < TOTAL_SECTORS && !visited.has(entryBlock)) {
          visited.add(entryBlock);
          const eOff = blockOffset(entryBlock);
          if (eOff + SECTOR_SIZE > bytes.length) break;

          const eType = readU32BE(bytes, eOff);
          const eSecType = readU32BE(bytes, eOff + SECTOR_SIZE - 4);
          const eSecTypeI32 = eSecType | 0;

          const name = readAmigaString(bytes, eOff + SECTOR_SIZE - 80);
          const protection = readU32BE(bytes, eOff + SECTOR_SIZE - 192);
          const fileSize = readU32BE(bytes, eOff + SECTOR_SIZE - 188);
          const comment = readAmigaString(bytes, eOff + SECTOR_SIZE - 136);
          const modified = readAmigaDate(bytes, eOff + SECTOR_SIZE - 92);

          const isDir = eSecTypeI32 === ST_DIR;
          const isFile = eSecTypeI32 === ST_FILE;

          if (isDir || isFile)
            directory.push({
              name: name || '(unnamed)',
              type: isDir ? 'dir' : 'file',
              size: isFile ? fileSize : 0,
              protection: formatProtection(protection),
              date: modified,
              comment: comment || '',
              block: entryBlock,
            });

          // Hash chain: next entry in same hash slot
          entryBlock = readU32BE(bytes, eOff + SECTOR_SIZE - 16);
        }
      }
    }

    readDirBlock(ROOT_BLOCK, 0);

    // Sort directory: directories first, then files, both alphabetical
    directory.sort((a, b) => {
      if (a.type !== b.type)
        return a.type === 'dir' ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return {
      format: 'adf',
      volumeName: volumeName || '(unnamed)',
      filesystem,
      rootBlock: {
        created: rootCreated,
        modified: rootModified,
        diskCreated,
      },
      bitmap,
      directory,
      dosFlags,
      bmValid: bmFlag === 0xFFFFFFFF,
      errors: null,
    };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('adf', {
    name: 'Amiga Disk File',
    category: 'disk',
    extensions: ['adf'],
    detect(bytes) {
      if (bytes.length !== ADF_SIZE) return false;
      // Verify DOS magic at boot block
      const sig = readString(bytes, 0, 3);
      if (sig === 'DOS') return true;
      // Some ADF files lack the DOS header (unformatted or non-standard)
      // but still have valid root block
      const rootOff = blockOffset(ROOT_BLOCK);
      if (rootOff + SECTOR_SIZE <= bytes.length) {
        const blockType = readU32BE(bytes, rootOff);
        if (blockType === T_HEADER) return 70; // lower confidence without DOS sig
      }
      return false;
    },
    parse: parseADF,
  });

})();
