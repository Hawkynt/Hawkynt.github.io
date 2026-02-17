;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});
  const { readU8, readU16LE, readString } = F;

  // =========================================================================
  // PETSCII -> ASCII conversion table (C64 screen codes / PETSCII)
  // =========================================================================

  const PETSCII_MAP = (() => {
    const map = new Array(256);
    for (let i = 0; i < 256; ++i)
      map[i] = (i >= 0x20 && i <= 0x7E) ? String.fromCharCode(i) : '.';

    // PETSCII uppercase letters are at 0xC1-0xDA (map to A-Z)
    for (let i = 0; i < 26; ++i)
      map[0xC1 + i] = String.fromCharCode(0x41 + i);

    // PETSCII lowercase at 0x41-0x5A display as uppercase on C64
    for (let i = 0; i < 26; ++i)
      map[0x41 + i] = String.fromCharCode(0x41 + i);

    // Common PETSCII special chars
    map[0xA0] = ' ';  // shifted space
    map[0x0D] = '\n';
    map[0x00] = ' ';
    return map;
  })();

  function petsciiToAscii(bytes, offset, length) {
    let s = '';
    for (let i = 0; i < length && offset + i < bytes.length; ++i) {
      const c = bytes[offset + i];
      if (c === 0xA0) break; // PETSCII padding
      s += PETSCII_MAP[c] || '.';
    }
    return s.trimEnd();
  }

  // =========================================================================
  // D64 format constants
  // =========================================================================

  // Sectors per track for standard 35-track layout
  const SECTORS_PER_TRACK_35 = [
    0,  // track 0 doesn't exist
    21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 1-17
    19, 19, 19, 19, 19, 19, 19,                                           // 18-24
    18, 18, 18, 18, 18, 18,                                               // 25-30
    17, 17, 17, 17, 17,                                                   // 31-35
  ];

  // Extended 40-track layout adds 5 more tracks with 17 sectors each
  const SECTORS_PER_TRACK_40 = [
    ...SECTORS_PER_TRACK_35,
    17, 17, 17, 17, 17, // 36-40
  ];

  const D64_FILE_TYPES = ['DEL', 'SEQ', 'PRG', 'USR', 'REL'];

  function getSectorOffset(track, sector, sectorsPerTrack) {
    if (track < 1 || track >= sectorsPerTrack.length)
      return -1;
    let offset = 0;
    for (let t = 1; t < track; ++t)
      offset += sectorsPerTrack[t] * 256;
    return offset + sector * 256;
  }

  function totalSectors(sectorsPerTrack) {
    let total = 0;
    for (let t = 1; t < sectorsPerTrack.length; ++t)
      total += sectorsPerTrack[t];
    return total;
  }

  // =========================================================================
  // D64 Parser
  // =========================================================================

  function parseD64(bytes) {
    const len = bytes.length;
    let numTracks, hasErrors;
    if (len === 174848) {
      numTracks = 35;
      hasErrors = false;
    } else if (len === 175531) {
      numTracks = 35;
      hasErrors = true;
    } else if (len === 196608) {
      numTracks = 40;
      hasErrors = false;
    } else if (len === 197376) {
      numTracks = 40;
      hasErrors = true;
    } else {
      // Attempt to detect based on closest match
      numTracks = len > 180000 ? 40 : 35;
      hasErrors = false;
    }

    const spt = numTracks === 40 ? SECTORS_PER_TRACK_40 : SECTORS_PER_TRACK_35;
    const total = totalSectors(spt);

    // ---- BAM (Block Availability Map) — Track 18, Sector 0 ----
    const bamOffset = getSectorOffset(18, 0, spt);
    if (bamOffset < 0 || bamOffset + 256 > len)
      return {
        format: 'd64', diskName: '(unreadable)', diskId: '', dosType: '',
        tracks: numTracks, bam: null, directory: [], hasErrors, totalBlocks: total,
        errors: ['BAM sector unreadable'],
      };

    const dirTrack = readU8(bytes, bamOffset + 0);
    const dirSector = readU8(bytes, bamOffset + 1);
    const dosVersion = readU8(bytes, bamOffset + 2);

    const diskName = petsciiToAscii(bytes, bamOffset + 0x90, 16);
    const diskId = petsciiToAscii(bytes, bamOffset + 0xA2, 2);
    const dosType = petsciiToAscii(bytes, bamOffset + 0xA5, 2);

    // Parse BAM entries: 4 bytes per track (1 byte free count + 3 bytes bitmap)
    const perTrack = [];
    let freeBlocks = 0;
    for (let t = 1; t <= Math.min(numTracks, 35); ++t) {
      const entryOff = bamOffset + 4 + (t - 1) * 4;
      const free = readU8(bytes, entryOff);
      const totalForTrack = spt[t];
      perTrack.push({ track: t, free, total: totalForTrack });
      if (t !== 18) // directory track doesn't count
        freeBlocks += free;
    }

    // For 40-track images, BAM entries for tracks 36-40 are in different locations
    // depending on the DOS version. Some store them at BAM offset 0xDD-0xF0
    if (numTracks === 40) {
      for (let t = 36; t <= 40; ++t) {
        // Dolphin DOS / Speed DOS store extra BAM at bamOffset + 0xAC + (t-36)*4
        const extraOff = bamOffset + 0xAC + (t - 36) * 4;
        let free = 0;
        if (extraOff + 4 <= len)
          free = readU8(bytes, extraOff);
        const totalForTrack = spt[t];
        perTrack.push({ track: t, free: Math.min(free, totalForTrack), total: totalForTrack });
        freeBlocks += Math.min(free, totalForTrack);
      }
    }

    const bam = { freeBlocks, totalBlocks: total, perTrack };

    // ---- Directory — starts at Track 18, Sector 1 ----
    const directory = [];
    let curTrack = dirTrack || 18;
    let curSector = dirSector || 1;
    const visited = new Set();

    while (curTrack !== 0) {
      const key = curTrack + ',' + curSector;
      if (visited.has(key)) break;
      visited.add(key);

      const secOff = getSectorOffset(curTrack, curSector, spt);
      if (secOff < 0 || secOff + 256 > len) break;

      // 8 directory entries per sector, 32 bytes each, starting at offset 0x00
      for (let e = 0; e < 8; ++e) {
        const entryOff = secOff + e * 32;
        const fileTypeByte = readU8(bytes, entryOff + 2);
        const typeIndex = fileTypeByte & 0x07;
        if (typeIndex === 0 && fileTypeByte === 0) continue; // empty entry (scratched)

        const locked = !!(fileTypeByte & 0x40);
        const closed = !!(fileTypeByte & 0x80);
        const splat = !closed;
        const typeName = D64_FILE_TYPES[typeIndex] || '???';

        const startTrack = readU8(bytes, entryOff + 3);
        const startSector = readU8(bytes, entryOff + 4);
        const name = petsciiToAscii(bytes, entryOff + 5, 16);
        const sizeBlocks = readU16LE(bytes, entryOff + 0x1E);
        const sizeBytes = sizeBlocks * 254; // 254 usable bytes per block

        if (name.length === 0 && sizeBlocks === 0 && startTrack === 0) continue;

        directory.push({
          name: name || '(empty)',
          type: typeName,
          sizeBlocks,
          sizeBytes,
          locked,
          closed,
          splat,
          startTrack,
          startSector,
        });
      }

      // Next directory sector linked at bytes 0-1
      curTrack = readU8(bytes, secOff + 0);
      curSector = readU8(bytes, secOff + 1);
    }

    return {
      format: 'd64',
      diskName,
      diskId,
      dosType,
      dosVersion,
      tracks: numTracks,
      bam,
      directory,
      hasErrors,
      totalBlocks: total,
      errors: null,
      readSector(track, sector) {
        const off = getSectorOffset(track, sector, spt);
        if (off < 0 || off + 256 > len) return null;
        return bytes.slice(off, off + 256);
      },
      extractFile(entry) {
        if (!entry || !entry.startTrack) return null;
        const chunks = [];
        let t = entry.startTrack;
        let s = entry.startSector;
        const seen = new Set();
        while (t !== 0) {
          const k = t + ',' + s;
          if (seen.has(k)) break;
          seen.add(k);
          const off = getSectorOffset(t, s, spt);
          if (off < 0 || off + 256 > len) break;
          const nextT = readU8(bytes, off);
          const nextS = readU8(bytes, off + 1);
          if (nextT === 0)
            // Last sector: nextS = number of bytes used in this sector
            chunks.push(bytes.slice(off + 2, off + 2 + (nextS > 0 ? nextS - 1 : 254)));
          else
            chunks.push(bytes.slice(off + 2, off + 256));
          t = nextT;
          s = nextS;
        }
        const totalLen = chunks.reduce((a, c) => a + c.length, 0);
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result;
      },
    };
  }

  // =========================================================================
  // D71 format stub (Commodore 1571 double-sided)
  // 349,696 bytes = 70 tracks (35 per side), 683 sectors per side
  // =========================================================================

  function parseD71(bytes) {
    // D71 is essentially two D64 images back-to-back with a shared BAM
    // For now, parse as single-sided D64 for the first side
    const result = parseD64(bytes);
    result.format = 'd71';
    return result;
  }

  // =========================================================================
  // D81 format stub (Commodore 1581 3.5" disk)
  // 819,200 bytes = 80 tracks x 40 sectors x 256 bytes
  // =========================================================================

  function parseD81(_bytes) {
    return {
      format: 'd81',
      diskName: '(D81 parsing not yet implemented)',
      diskId: '', dosType: '',
      tracks: 80, bam: null, directory: [],
      hasErrors: false, totalBlocks: 3200,
      errors: ['D81 format support pending'],
    };
  }

  // =========================================================================
  // T64 format stub (C64 tape image)
  // Variable size, header at offset 0: "C64 tape image file" or "C64S tape file"
  // =========================================================================

  function parseT64(_bytes) {
    return {
      format: 't64',
      diskName: '(T64 parsing not yet implemented)',
      diskId: '', dosType: '',
      tracks: 0, bam: null, directory: [],
      hasErrors: false, totalBlocks: 0,
      errors: ['T64 format support pending'],
    };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('d64', {
    name: 'C64 1541 Disk Image',
    category: 'disk',
    extensions: ['d64'],
    detect(bytes) {
      const len = bytes.length;
      // Standard D64 sizes
      if (len === 174848 || len === 175531 || len === 196608 || len === 197376)
        return true;
      return false;
    },
    parse: parseD64,
  });

  F.register('d71', {
    name: 'C64 1571 Disk Image',
    category: 'disk',
    extensions: ['d71'],
    detect(bytes) {
      return bytes.length === 349696 || bytes.length === 351062;
    },
    parse: parseD71,
  });

  F.register('d81', {
    name: 'C64 1581 Disk Image',
    category: 'disk',
    extensions: ['d81'],
    detect(bytes) {
      return bytes.length === 819200;
    },
    parse: parseD81,
  });

  F.register('t64', {
    name: 'C64 Tape Image',
    category: 'disk',
    extensions: ['t64'],
    detect(bytes) {
      if (bytes.length < 64) return false;
      const sig = readString(bytes, 0, 20);
      return sig.startsWith('C64') && sig.includes('tape');
    },
    parse: parseT64,
  });

})();
