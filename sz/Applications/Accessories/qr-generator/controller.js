;(function() {
  'use strict';

  // =========================================================================
  // QR CODE ENCODER -- implemented from scratch
  // Supports versions 1-40, byte mode primary, numeric/alphanumeric detection
  // =========================================================================

  // ----- Constants & Tables -----

  const EC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };

  // Mode indicators
  const MODE_NUMERIC = 0b0001;
  const MODE_ALPHANUMERIC = 0b0010;
  const MODE_BYTE = 0b0100;

  // Alphanumeric character set
  const ALPHANUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  // Number of modules per side for each version (1-40)
  function getSize(version) {
    return 17 + version * 4;
  }

  // Character count indicator bit lengths by mode and version group
  // [numeric, alphanumeric, byte] for version groups [1-9, 10-26, 27-40]
  const CHAR_COUNT_BITS = [
    [10, 9, 8],   // versions 1-9
    [12, 11, 16], // versions 10-26
    [14, 13, 16]  // versions 27-40
  ];

  function getCharCountBits(version, mode) {
    const group = version <= 9 ? 0 : version <= 26 ? 1 : 2;
    if (mode === MODE_NUMERIC) return CHAR_COUNT_BITS[group][0];
    if (mode === MODE_ALPHANUMERIC) return CHAR_COUNT_BITS[group][1];
    return CHAR_COUNT_BITS[group][2]; // byte
  }

  // EC codewords and block structure per version and EC level
  // Format: [totalDataCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsInGroup1Block, numBlocksGroup2, dataCodewordsInGroup2Block]
  const EC_TABLE = [
    // Version 1
    [[19,7,1,19,0,0],[16,10,1,16,0,0],[13,13,1,13,0,0],[9,17,1,9,0,0]],
    // Version 2
    [[34,10,1,34,0,0],[28,16,1,28,0,0],[22,22,1,22,0,0],[16,28,1,16,0,0]],
    // Version 3
    [[55,15,1,55,0,0],[44,26,1,44,0,0],[34,18,2,17,0,0],[26,22,2,13,0,0]],
    // Version 4
    [[80,20,1,80,0,0],[64,18,2,32,0,0],[48,26,2,24,0,0],[36,16,4,9,0,0]],
    // Version 5
    [[108,26,1,108,0,0],[86,24,2,43,0,0],[62,18,2,15,2,16],[46,22,2,11,2,12]],
    // Version 6
    [[136,18,2,68,0,0],[108,16,4,27,0,0],[76,24,4,19,0,0],[60,28,4,15,0,0]],
    // Version 7
    [[156,20,2,78,0,0],[124,18,4,31,0,0],[88,18,2,14,4,15],[66,26,4,13,1,14]],
    // Version 8
    [[194,24,2,97,0,0],[154,22,2,38,2,39],[110,22,4,18,2,19],[86,26,4,14,2,15]],
    // Version 9
    [[232,30,2,116,0,0],[182,22,3,36,2,37],[132,20,4,16,4,17],[100,24,4,12,4,13]],
    // Version 10
    [[274,18,2,68,2,69],[216,26,4,43,1,44],[154,24,6,19,2,20],[122,28,6,15,2,16]],
    // Version 11
    [[324,20,4,81,0,0],[254,30,1,50,4,51],[180,28,4,22,4,23],[140,24,3,12,8,13]],
    // Version 12
    [[370,24,2,92,2,93],[290,22,6,36,2,37],[206,26,4,20,6,21],[158,28,7,14,4,15]],
    // Version 13
    [[428,26,4,107,0,0],[334,22,8,37,1,38],[244,24,8,20,4,21],[180,22,12,11,4,12]],
    // Version 14
    [[461,30,3,115,1,116],[365,24,4,40,5,41],[261,20,11,16,5,17],[197,24,11,12,5,13]],
    // Version 15
    [[523,22,5,87,1,88],[415,24,5,41,5,42],[295,30,5,24,7,25],[223,24,11,12,7,13]],
    // Version 16
    [[589,24,5,98,1,99],[453,28,7,45,3,46],[325,24,15,19,2,20],[253,30,3,15,13,16]],
    // Version 17
    [[647,28,1,107,5,108],[507,28,10,46,1,47],[367,28,1,22,15,23],[283,28,2,14,17,15]],
    // Version 18
    [[721,30,5,120,1,121],[563,26,9,43,4,44],[397,28,17,22,1,23],[313,28,2,14,19,15]],
    // Version 19
    [[795,28,3,113,4,114],[627,26,3,44,11,45],[445,26,17,21,4,22],[341,26,9,13,16,14]],
    // Version 20
    [[861,28,3,107,5,108],[669,26,3,41,13,42],[485,28,15,24,5,25],[385,28,15,15,10,16]],
    // Version 21
    [[932,28,4,116,4,117],[714,26,17,42,0,0],[512,30,17,22,6,23],[406,28,19,16,6,17]],
    // Version 22
    [[1006,28,2,111,7,112],[782,28,17,46,0,0],[568,24,7,24,16,25],[442,28,34,13,0,0]],
    // Version 23
    [[1094,30,4,121,5,122],[860,28,4,47,14,48],[614,30,11,24,14,25],[464,28,16,15,14,16]],
    // Version 24
    [[1174,30,6,117,4,118],[914,28,6,45,14,46],[664,30,11,24,16,25],[514,28,30,16,2,17]],
    // Version 25
    [[1276,26,8,106,4,107],[1000,28,8,47,13,48],[718,30,7,24,22,25],[538,28,22,15,13,16]],
    // Version 26
    [[1370,28,10,114,2,115],[1062,28,19,46,4,47],[754,28,28,22,6,23],[596,28,33,16,4,17]],
    // Version 27
    [[1468,30,8,122,4,123],[1128,28,22,45,3,46],[808,30,8,23,26,24],[628,28,12,15,28,16]],
    // Version 28
    [[1531,30,3,117,10,118],[1193,28,3,45,23,46],[871,30,4,24,31,25],[661,28,11,15,31,16]],
    // Version 29
    [[1631,30,7,116,7,117],[1267,28,21,45,7,46],[911,30,1,23,37,24],[701,28,19,15,26,16]],
    // Version 30
    [[1735,30,5,115,10,116],[1373,28,19,47,10,48],[985,30,15,24,25,25],[745,28,23,15,25,16]],
    // Version 31
    [[1843,30,13,115,3,116],[1455,28,2,46,29,47],[1033,30,42,24,1,25],[793,28,23,15,28,16]],
    // Version 32
    [[1955,30,17,115,0,0],[1541,28,10,46,23,47],[1115,30,10,24,35,25],[845,28,19,15,35,16]],
    // Version 33
    [[2071,30,17,115,1,116],[1631,28,14,46,21,47],[1171,30,29,24,19,25],[901,28,11,15,46,16]],
    // Version 34
    [[2191,30,13,115,6,116],[1725,28,14,46,23,47],[1231,30,44,24,7,25],[961,28,59,16,1,17]],
    // Version 35
    [[2306,30,12,121,7,122],[1812,28,12,47,26,48],[1286,30,39,24,14,25],[986,28,22,15,41,16]],
    // Version 36
    [[2434,30,6,121,14,122],[1914,28,6,47,34,48],[1354,30,46,24,10,25],[1054,28,2,15,64,16]],
    // Version 37
    [[2566,30,17,122,4,123],[1992,28,29,46,14,47],[1426,30,49,24,10,25],[1096,28,24,15,46,16]],
    // Version 38
    [[2702,30,4,122,18,123],[2102,28,13,46,32,47],[1502,30,48,24,14,25],[1142,28,42,15,32,16]],
    // Version 39
    [[2812,30,20,117,4,118],[2216,28,40,47,7,48],[1582,30,43,24,22,25],[1222,28,10,15,67,16]],
    // Version 40
    [[2956,30,19,118,6,119],[2334,28,18,47,31,48],[1666,30,34,24,34,25],[1276,28,20,15,61,16]]
  ];

  // Alignment pattern positions per version (center coordinates)
  const ALIGNMENT_POSITIONS = [
    [],             // v1 - no alignment
    [6,18],         // v2
    [6,22],         // v3
    [6,26],         // v4
    [6,30],         // v5
    [6,34],         // v6
    [6,22,38],      // v7
    [6,24,42],      // v8
    [6,26,46],      // v9
    [6,28,50],      // v10
    [6,30,54],      // v11
    [6,32,58],      // v12
    [6,34,62],      // v13
    [6,26,46,66],   // v14
    [6,26,48,70],   // v15
    [6,26,50,74],   // v16
    [6,30,54,78],   // v17
    [6,30,56,82],   // v18
    [6,30,58,86],   // v19
    [6,34,62,90],   // v20
    [6,28,50,72,94],    // v21
    [6,26,50,74,98],    // v22
    [6,30,54,78,102],   // v23
    [6,28,54,80,106],   // v24
    [6,32,58,84,110],   // v25
    [6,30,58,86,114],   // v26
    [6,34,62,90,118],   // v27
    [6,26,50,74,98,122],  // v28
    [6,30,54,78,102,126], // v29
    [6,26,52,78,104,130], // v30
    [6,30,56,82,108,134], // v31
    [6,34,60,86,112,138], // v32
    [6,30,58,86,114,142], // v33
    [6,34,62,90,118,146], // v34
    [6,30,54,78,102,126,150], // v35
    [6,24,50,76,102,128,154], // v36
    [6,28,54,80,106,132,158], // v37
    [6,32,58,84,110,136,162], // v38
    [6,26,54,82,110,138,166], // v39
    [6,30,58,86,114,142,170]  // v40
  ];

  // ----- GF(256) Arithmetic for Reed-Solomon -----

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);

  // Initialize log/antilog tables for GF(2^8) with primitive polynomial 0x11d
  ;(function initGF() {
    let x = 1;
    for (let i = 0; i < 255; ++i) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x >= 256)
        x ^= 0x11d; // primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1
    }
    // Extend exp table for easy modular lookups
    for (let i = 255; i < 512; ++i)
      GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // Generate Reed-Solomon generator polynomial of given degree
  function rsGeneratorPoly(degree) {
    let gen = new Uint8Array([1]);
    for (let i = 0; i < degree; ++i) {
      const newGen = new Uint8Array(gen.length + 1);
      const factor = GF_EXP[i];
      for (let j = 0; j < gen.length; ++j) {
        newGen[j] ^= gen[j];
        newGen[j + 1] ^= gfMul(gen[j], factor);
      }
      gen = newGen;
    }
    return gen;
  }

  // Compute RS error correction codewords for given data
  function rsEncode(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const result = new Uint8Array(ecCount);
    for (let i = 0; i < data.length; ++i) {
      const coef = data[i] ^ result[0];
      // Shift result left
      for (let j = 0; j < ecCount - 1; ++j)
        result[j] = result[j + 1];
      result[ecCount - 1] = 0;
      // XOR with generator
      for (let j = 0; j < ecCount; ++j)
        result[j] ^= gfMul(gen[j + 1], coef);
    }
    return result;
  }

  // ----- Data Encoding -----

  function isNumeric(str) {
    return /^\d+$/.test(str);
  }

  function isAlphanumeric(str) {
    for (let i = 0; i < str.length; ++i)
      if (ALPHANUM_CHARS.indexOf(str[i]) < 0) return false;
    return str.length > 0;
  }

  function chooseMode(data) {
    if (isNumeric(data)) return MODE_NUMERIC;
    if (isAlphanumeric(data)) return MODE_ALPHANUMERIC;
    return MODE_BYTE;
  }

  // Bit stream builder
  function BitStream() {
    const bits = [];
    return {
      push(value, length) {
        for (let i = length - 1; i >= 0; --i)
          bits.push((value >>> i) & 1);
      },
      getData() { return bits; },
      get length() { return bits.length; }
    };
  }

  function encodeNumeric(bs, data) {
    let i = 0;
    while (i < data.length) {
      if (i + 3 <= data.length) {
        bs.push(parseInt(data.substring(i, i + 3), 10), 10);
        i += 3;
      } else if (i + 2 <= data.length) {
        bs.push(parseInt(data.substring(i, i + 2), 10), 7);
        i += 2;
      } else {
        bs.push(parseInt(data[i], 10), 4);
        ++i;
      }
    }
  }

  function encodeAlphanumeric(bs, data) {
    const upper = data.toUpperCase();
    let i = 0;
    while (i < upper.length) {
      if (i + 2 <= upper.length) {
        const val = ALPHANUM_CHARS.indexOf(upper[i]) * 45 + ALPHANUM_CHARS.indexOf(upper[i + 1]);
        bs.push(val, 11);
        i += 2;
      } else {
        bs.push(ALPHANUM_CHARS.indexOf(upper[i]), 6);
        ++i;
      }
    }
  }

  function encodeByte(bs, data) {
    const bytes = new TextEncoder().encode(data);
    for (let i = 0; i < bytes.length; ++i)
      bs.push(bytes[i], 8);
  }

  function getDataLength(mode, data) {
    if (mode === MODE_BYTE) return new TextEncoder().encode(data).length;
    return data.length;
  }

  // Determine minimum version that fits data
  function chooseVersion(data, mode, ecLevel) {
    const dataLen = getDataLength(mode, data);
    for (let v = 1; v <= 40; ++v) {
      const ecIdx = EC_LEVELS[ecLevel];
      const totalData = EC_TABLE[v - 1][ecIdx][0];
      const totalBits = totalData * 8;
      const charCountBits = getCharCountBits(v, mode);
      // 4 bits mode + charCountBits + data bits + 4 bits terminator (max)
      let dataBits;
      if (mode === MODE_NUMERIC)
        dataBits = Math.floor(dataLen / 3) * 10 + (dataLen % 3 === 2 ? 7 : dataLen % 3 === 1 ? 4 : 0);
      else if (mode === MODE_ALPHANUMERIC)
        dataBits = Math.floor(dataLen / 2) * 11 + (dataLen % 2 === 1 ? 6 : 0);
      else
        dataBits = dataLen * 8;

      const needed = 4 + charCountBits + dataBits;
      if (needed <= totalBits)
        return v;
    }
    return -1; // data too large
  }

  function encodeData(data, mode, version, ecLevel) {
    const ecIdx = EC_LEVELS[ecLevel];
    const ecInfo = EC_TABLE[version - 1][ecIdx];
    const totalDataCodewords = ecInfo[0];
    const totalBits = totalDataCodewords * 8;
    const dataLen = getDataLength(mode, data);

    const bs = BitStream();

    // Mode indicator
    bs.push(mode, 4);

    // Character count
    bs.push(dataLen, getCharCountBits(version, mode));

    // Data
    if (mode === MODE_NUMERIC)
      encodeNumeric(bs, data);
    else if (mode === MODE_ALPHANUMERIC)
      encodeAlphanumeric(bs, data);
    else
      encodeByte(bs, data);

    // Terminator (up to 4 zeros)
    const termLen = Math.min(4, totalBits - bs.length);
    if (termLen > 0) bs.push(0, termLen);

    // Pad to byte boundary
    while (bs.length % 8 !== 0)
      bs.push(0, 1);

    // Pad codewords (0xEC, 0x11 alternating)
    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (bs.length < totalBits) {
      bs.push(padBytes[padIdx], 8);
      padIdx = (padIdx + 1) % 2;
    }

    // Convert bit stream to codewords
    const bits = bs.getData();
    const codewords = new Uint8Array(totalDataCodewords);
    for (let i = 0; i < totalDataCodewords; ++i) {
      let byte = 0;
      for (let b = 0; b < 8; ++b)
        byte = (byte << 1) | (bits[i * 8 + b] || 0);
      codewords[i] = byte;
    }

    return codewords;
  }

  // ----- Error Correction & Interleaving -----

  function generateEC(dataCodewords, version, ecLevel) {
    const ecIdx = EC_LEVELS[ecLevel];
    const ecInfo = EC_TABLE[version - 1][ecIdx];
    const ecPerBlock = ecInfo[1];
    const g1Blocks = ecInfo[2];
    const g1DataCw = ecInfo[3];
    const g2Blocks = ecInfo[4];
    const g2DataCw = ecInfo[5];

    const blocks = [];
    const ecBlocks = [];
    let offset = 0;

    // Group 1
    for (let i = 0; i < g1Blocks; ++i) {
      const block = dataCodewords.slice(offset, offset + g1DataCw);
      blocks.push(block);
      ecBlocks.push(rsEncode(block, ecPerBlock));
      offset += g1DataCw;
    }

    // Group 2
    for (let i = 0; i < g2Blocks; ++i) {
      const block = dataCodewords.slice(offset, offset + g2DataCw);
      blocks.push(block);
      ecBlocks.push(rsEncode(block, ecPerBlock));
      offset += g2DataCw;
    }

    // Interleave data codewords
    const result = [];
    const maxDataLen = Math.max(g1DataCw, g2DataCw);
    for (let i = 0; i < maxDataLen; ++i)
      for (const block of blocks)
        if (i < block.length) result.push(block[i]);

    // Interleave EC codewords
    for (let i = 0; i < ecPerBlock; ++i)
      for (const ecBlock of ecBlocks)
        if (i < ecBlock.length) result.push(ecBlock[i]);

    return new Uint8Array(result);
  }

  // ----- Matrix Construction -----

  function createMatrix(size) {
    const matrix = [];
    const reserved = [];
    for (let r = 0; r < size; ++r) {
      matrix.push(new Uint8Array(size));
      reserved.push(new Uint8Array(size)); // 1 = reserved (function pattern)
    }
    return { matrix, reserved, size };
  }

  function setModule(m, row, col, value) {
    if (row >= 0 && row < m.size && col >= 0 && col < m.size) {
      m.matrix[row][col] = value ? 1 : 0;
      m.reserved[row][col] = 1;
    }
  }

  // Place finder pattern at top-left corner (row, col)
  function placeFinderPattern(m, row, col) {
    for (let r = -1; r <= 7; ++r)
      for (let c = -1; c <= 7; ++c) {
        const mr = row + r, mc = col + c;
        if (mr < 0 || mr >= m.size || mc < 0 || mc >= m.size) continue;
        if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4))
          setModule(m, mr, mc, 1);
        else
          setModule(m, mr, mc, 0);
      }
  }

  // Place alignment pattern centered at (row, col)
  function placeAlignmentPattern(m, row, col) {
    for (let r = -2; r <= 2; ++r)
      for (let c = -2; c <= 2; ++c) {
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0))
          setModule(m, row + r, col + c, 1);
        else
          setModule(m, row + r, col + c, 0);
      }
  }

  function placeTimingPatterns(m) {
    for (let i = 8; i < m.size - 8; ++i) {
      // Horizontal timing
      if (!m.reserved[6][i]) setModule(m, 6, i, (i % 2 === 0) ? 1 : 0);
      // Vertical timing
      if (!m.reserved[i][6]) setModule(m, i, 6, (i % 2 === 0) ? 1 : 0);
    }
  }

  function placeFunctionPatterns(m, version) {
    const size = m.size;

    // Three finder patterns
    placeFinderPattern(m, 0, 0);           // top-left
    placeFinderPattern(m, size - 7, 0);    // bottom-left
    placeFinderPattern(m, 0, size - 7);    // top-right

    // Timing patterns
    placeTimingPatterns(m);

    // Dark module
    setModule(m, (4 * version) + 9, 8, 1);

    // Alignment patterns
    if (version >= 2) {
      const positions = ALIGNMENT_POSITIONS[version - 1];
      for (let i = 0; i < positions.length; ++i)
        for (let j = 0; j < positions.length; ++j) {
          const row = positions[i], col = positions[j];
          // Skip if overlapping with finder patterns
          if (m.reserved[row][col]) continue;
          placeAlignmentPattern(m, row, col);
        }
    }

    // Reserve format info areas (will be written later)
    for (let c = 0; c <= 8; ++c) {
      if (!m.reserved[8][c]) m.reserved[8][c] = 1;
    }
    for (let c = m.size - 8; c < m.size; ++c) {
      if (!m.reserved[8][c]) m.reserved[8][c] = 1;
    }
    for (let r = 0; r <= 8; ++r) {
      if (!m.reserved[r][8]) m.reserved[r][8] = 1;
    }
    for (let r = m.size - 7; r < m.size; ++r) {
      if (!m.reserved[r][8]) m.reserved[r][8] = 1;
    }

    // Reserve version info areas (version >= 7)
    if (version >= 7) {
      for (let r = 0; r < 6; ++r)
        for (let c = m.size - 11; c < m.size - 8; ++c) {
          if (!m.reserved[r][c]) m.reserved[r][c] = 1;
          if (!m.reserved[c][r]) m.reserved[c][r] = 1;
        }
    }
  }

  // Place data bits in zigzag pattern
  function placeDataBits(m, codewords) {
    const bits = [];
    for (let i = 0; i < codewords.length; ++i)
      for (let b = 7; b >= 0; --b)
        bits.push((codewords[i] >>> b) & 1);

    let bitIdx = 0;
    let col = m.size - 1;
    while (col >= 0) {
      if (col === 6) { --col; continue; } // skip timing column

      const isUpward = ((m.size - 1 - col) >> 1) % 2 === 0;

      for (let i = 0; i < m.size; ++i) {
        const row = isUpward ? m.size - 1 - i : i;
        // Right column of pair
        if (!m.reserved[row][col]) {
          m.matrix[row][col] = bitIdx < bits.length ? bits[bitIdx] : 0;
          ++bitIdx;
        }
        // Left column of pair
        if (col - 1 >= 0 && !m.reserved[row][col - 1]) {
          m.matrix[row][col - 1] = bitIdx < bits.length ? bits[bitIdx] : 0;
          ++bitIdx;
        }
      }

      col -= 2;
    }
  }

  // ----- Masking -----

  const MASK_FUNCTIONS = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
    (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0,
    (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0
  ];

  function applyMask(m, maskIdx) {
    const fn = MASK_FUNCTIONS[maskIdx];
    for (let r = 0; r < m.size; ++r)
      for (let c = 0; c < m.size; ++c)
        if (!m.reserved[r][c] && fn(r, c))
          m.matrix[r][c] ^= 1;
  }

  // ----- Format & Version Information -----

  const FORMAT_MASK = 0x5412;

  function encodeFormatInfo(ecLevel, maskPattern) {
    const ecBits = [1, 0, 3, 2][EC_LEVELS[ecLevel]]; // L=01, M=00, Q=11, H=10
    let data = (ecBits << 3) | maskPattern;
    let bits = data << 10;
    const gen = 0x537; // 10100110111
    for (let i = 14; i >= 10; --i)
      if (bits & (1 << i)) bits ^= gen << (i - 10);
    const result = ((data << 10) | bits) ^ FORMAT_MASK;
    return result;
  }

  function placeFormatInfo(m, formatBits) {
    const size = m.size;
    // Extract bits MSB-first: bits[0] = MSB (bit 14), bits[14] = LSB (bit 0)
    const bits = [];
    for (let i = 14; i >= 0; --i)
      bits.push((formatBits >>> i) & 1);

    // First copy — around top-left separator
    const hCols = [0, 1, 2, 3, 4, 5, 7, 8];
    for (let i = 0; i < 8; ++i)
      m.matrix[8][hCols[i]] = bits[i];
    const vRows = [8, 7, 5, 4, 3, 2, 1, 0];
    for (let i = 0; i < 8; ++i)
      m.matrix[vRows[i]][8] = bits[7 + i];

    // Second copy — bottom-left (column 8) and top-right (row 8)
    for (let i = 0; i < 7; ++i)
      m.matrix[size - 1 - i][8] = bits[i];
    for (let i = 7; i < 15; ++i)
      m.matrix[8][size - 15 + i] = bits[i];
  }

  function encodeVersionInfo(version) {
    let data = version;
    let bits = data << 12;
    const gen = 0x1F25;
    for (let i = 17; i >= 12; --i)
      if (bits & (1 << i)) bits ^= gen << (i - 12);
    return (data << 12) | bits;
  }

  function placeVersionInfo(m, version) {
    if (version < 7) return;
    const versionBits = encodeVersionInfo(version);
    for (let i = 0; i < 18; ++i) {
      const bit = (versionBits >>> i) & 1;
      const row = Math.floor(i / 3);
      const col = m.size - 11 + (i % 3);
      m.matrix[row][col] = bit;
      m.matrix[col][row] = bit;
    }
  }

  // ----- Penalty Score Calculation -----

  function computePenalty(m) {
    let penalty = 0;
    const size = m.size;

    // Rule 1
    for (let r = 0; r < size; ++r) {
      let count = 1;
      for (let c = 1; c < size; ++c) {
        if (m.matrix[r][c] === m.matrix[r][c - 1])
          ++count;
        else {
          if (count >= 5) penalty += count - 2;
          count = 1;
        }
      }
      if (count >= 5) penalty += count - 2;
    }
    for (let c = 0; c < size; ++c) {
      let count = 1;
      for (let r = 1; r < size; ++r) {
        if (m.matrix[r][c] === m.matrix[r - 1][c])
          ++count;
        else {
          if (count >= 5) penalty += count - 2;
          count = 1;
        }
      }
      if (count >= 5) penalty += count - 2;
    }

    // Rule 2
    for (let r = 0; r < size - 1; ++r)
      for (let c = 0; c < size - 1; ++c) {
        const v = m.matrix[r][c];
        if (v === m.matrix[r][c + 1] && v === m.matrix[r + 1][c] && v === m.matrix[r + 1][c + 1])
          penalty += 3;
      }

    // Rule 3
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; ++r)
      for (let c = 0; c <= size - 11; ++c) {
        let match1 = true, match2 = true;
        for (let i = 0; i < 11; ++i) {
          if (m.matrix[r][c + i] !== pat1[i]) match1 = false;
          if (m.matrix[r][c + i] !== pat2[i]) match2 = false;
        }
        if (match1) penalty += 40;
        if (match2) penalty += 40;
      }
    for (let c = 0; c < size; ++c)
      for (let r = 0; r <= size - 11; ++r) {
        let match1 = true, match2 = true;
        for (let i = 0; i < 11; ++i) {
          if (m.matrix[r + i][c] !== pat1[i]) match1 = false;
          if (m.matrix[r + i][c] !== pat2[i]) match2 = false;
        }
        if (match1) penalty += 40;
        if (match2) penalty += 40;
      }

    // Rule 4
    let dark = 0;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c)
        if (m.matrix[r][c]) ++dark;
    const total = size * size;
    const pct = (dark / total) * 100;
    const prev5 = Math.floor(pct / 5) * 5;
    const next5 = prev5 + 5;
    penalty += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

    return penalty;
  }

  // ----- Main Encode Function -----

  function generateQR(text, ecLevel, requestedVersion, encMode) {
    if (!text) return null;

    let mode;
    if (encMode === 'upper') {
      text = text.toUpperCase();
      mode = isNumeric(text) ? MODE_NUMERIC : isAlphanumeric(text) ? MODE_ALPHANUMERIC : MODE_BYTE;
    } else if (encMode === 'byte')
      mode = MODE_BYTE;
    else
      mode = chooseMode(text);
    let version = requestedVersion > 0
      ? requestedVersion
      : chooseVersion(text, mode, ecLevel);

    if (version < 0) return null;

    if (requestedVersion > 0) {
      const needed = chooseVersion(text, mode, ecLevel);
      if (needed < 0 || requestedVersion < needed)
        version = needed < 0 ? -1 : needed;
      if (version < 0) return null;
    }

    const size = getSize(version);
    const dataCodewords = encodeData(text, mode, version, ecLevel);
    const finalCodewords = generateEC(dataCodewords, version, ecLevel);

    let bestMask = 0;
    let bestPenalty = Infinity;
    let bestMatrix = null;

    for (let maskIdx = 0; maskIdx < 8; ++maskIdx) {
      const m = createMatrix(size);
      placeFunctionPatterns(m, version);
      placeDataBits(m, finalCodewords);
      applyMask(m, maskIdx);
      const formatBits = encodeFormatInfo(ecLevel, maskIdx);
      placeFormatInfo(m, formatBits);
      placeVersionInfo(m, version);
      const penalty = computePenalty(m);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMask = maskIdx;
        bestMatrix = m;
      }
    }

    return {
      matrix: bestMatrix.matrix,
      size,
      version,
      ecLevel,
      mode: mode === MODE_NUMERIC ? 'Numeric' : mode === MODE_ALPHANUMERIC ? 'Alphanumeric' : 'Byte',
      mask: bestMask
    };
  }

  // =========================================================================
  // UI LOGIC
  // =========================================================================

  // DOM references
  const inputType = document.getElementById('input-type');
  const dataInput = document.getElementById('data-input');
  const encodingMode = document.getElementById('encoding-mode');
  const ecLevelSel = document.getElementById('ec-level');
  const versionSel = document.getElementById('qr-version');
  const fgColor = document.getElementById('fg-color');
  const bgColor = document.getElementById('bg-color');
  const modStyle = document.getElementById('mod-style');
  const modSize = document.getElementById('mod-size');
  const quietZone = document.getElementById('quiet-zone');
  const canvas = document.getElementById('qr-canvas');
  const qrInfo = document.getElementById('qr-info');
  const logoFile = document.getElementById('logo-file');
  const btnLogo = document.getElementById('btn-logo');
  const btnLogoClear = document.getElementById('btn-logo-clear');
  const logoPreview = document.getElementById('logo-preview');
  const logoSizeSlider = document.getElementById('logo-size');

  let logoImage = null;
  let currentQR = null;

  // Populate version selector
  for (let v = 1; v <= 40; ++v) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = 'Version ' + v + ' (' + getSize(v) + 'x' + getSize(v) + ')';
    versionSel.appendChild(opt);
  }

  // ----- Input type switching -----
  const TYPE_MAP = {
    text: 'sec-text',
    url: 'sec-text',
    wifi: 'sec-wifi',
    vcard: 'sec-vcard',
    email: 'sec-email',
    phone: 'sec-phone'
  };

  function switchInputType() {
    const type = inputType.value;
    for (const sec of document.querySelectorAll('.type-section'))
      sec.classList.remove('active');
    document.getElementById(TYPE_MAP[type]).classList.add('active');
    if (type === 'url')
      dataInput.placeholder = 'https://example.com';
    else
      dataInput.placeholder = 'Enter text...';
    scheduleGenerate();
  }

  inputType.addEventListener('change', switchInputType);

  // Build content string from input type
  function buildContent() {
    const type = inputType.value;
    switch (type) {
      case 'text':
      case 'url':
        return dataInput.value;
      case 'wifi': {
        const ssid = document.getElementById('wifi-ssid').value;
        const pass = document.getElementById('wifi-pass').value;
        const enc = document.getElementById('wifi-enc').value;
        return 'WIFI:T:' + enc + ';S:' + escapeWifi(ssid) + ';P:' + escapeWifi(pass) + ';;';
      }
      case 'vcard': {
        const name = document.getElementById('vc-name').value;
        const phone = document.getElementById('vc-phone').value;
        const email = document.getElementById('vc-email').value;
        const addr = document.getElementById('vc-addr').value;
        let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
        if (name) vcard += 'FN:' + name + '\n';
        if (phone) vcard += 'TEL:' + phone + '\n';
        if (email) vcard += 'EMAIL:' + email + '\n';
        if (addr) vcard += 'ADR:' + addr + '\n';
        vcard += 'END:VCARD';
        return vcard;
      }
      case 'email': {
        const addr = document.getElementById('em-addr').value;
        const subj = document.getElementById('em-subj').value;
        const body = document.getElementById('em-body').value;
        let mailto = 'mailto:' + addr;
        const params = [];
        if (subj) params.push('subject=' + encodeURIComponent(subj));
        if (body) params.push('body=' + encodeURIComponent(body));
        if (params.length) mailto += '?' + params.join('&');
        return mailto;
      }
      case 'phone':
        return 'tel:' + document.getElementById('ph-num').value;
      default:
        return '';
    }
  }

  function escapeWifi(s) {
    return s.replace(/[\\;,:\"]/g, '\\$&');
  }

  // ----- Logo handling -----
  btnLogo.addEventListener('click', () => logoFile.click());

  logoFile.addEventListener('change', () => {
    const file = logoFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        logoImage = img;
        btnLogoClear.disabled = false;
        logoPreview.src = e.target.result;
        logoPreview.classList.add('has-logo');
        // Auto-switch to H error correction when logo is added
        if (ecLevelSel.value !== 'H')
          ecLevelSel.value = 'H';
        scheduleGenerate();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  btnLogoClear.addEventListener('click', () => {
    logoImage = null;
    logoFile.value = '';
    btnLogoClear.disabled = true;
    logoPreview.src = '';
    logoPreview.classList.remove('has-logo');
    scheduleGenerate();
  });

  // ----- QR Generation & Rendering -----

  let generateTimer = null;

  function scheduleGenerate() {
    if (generateTimer) clearTimeout(generateTimer);
    generateTimer = setTimeout(doGenerate, 80);
  }

  function doGenerate() {
    const content = buildContent();
    if (!content) {
      clearCanvas();
      qrInfo.textContent = 'Enter content to generate QR code';
      currentQR = null;
      return;
    }

    // Force highest EC level when a logo is present so overlay stays scannable
    const ecLevel = logoImage ? 'H' : ecLevelSel.value;
    const reqVersion = parseInt(versionSel.value, 10);
    const encMode = encodingMode.value;

    const qr = generateQR(content, ecLevel, reqVersion, encMode);
    if (!qr) {
      clearCanvas();
      qrInfo.textContent = 'Data too large for selected version/EC level';
      currentQR = null;
      return;
    }

    currentQR = qr;
    const ecNote = logoImage && ecLevelSel.value !== 'H' ? ' (forced H for logo)' : '';
    qrInfo.textContent = 'Version ' + qr.version + ' | ' + qr.size + 'x' + qr.size +
      ' | EC: ' + qr.ecLevel + ecNote + ' | Mode: ' + qr.mode + ' | Mask: ' + qr.mask;

    renderQR(qr);
  }

  function clearCanvas() {
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#999';
    ctx.font = '12px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No QR Code', 100, 100);
  }

  function renderQR(qr, targetCanvas, targetModSize) {
    const cvs = targetCanvas || canvas;
    const mSize = targetModSize || parseInt(modSize.value, 10) || 8;
    const quiet = parseInt(quietZone.value, 10) || 0;
    const fg = fgColor.value;
    const bg = bgColor.value;
    const style = modStyle.value;

    const totalSize = (qr.size + quiet * 2) * mSize;
    cvs.width = totalSize;
    cvs.height = totalSize;

    const ctx = cvs.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, totalSize, totalSize);

    ctx.fillStyle = fg;

    for (let r = 0; r < qr.size; ++r)
      for (let c = 0; c < qr.size; ++c) {
        if (!qr.matrix[r][c]) continue;
        const x = (c + quiet) * mSize;
        const y = (r + quiet) * mSize;
        drawModule(ctx, x, y, mSize, style, fg);
      }

    // Draw logo centered with white border; capped at ~20% of module area
    if (logoImage) {
      const MAX_LOGO_FRACTION = 0.20; // max 20% of QR code dimension
      const sliderPct = (parseInt(logoSizeSlider.value, 10) || 20) / 100;
      const logoPct = Math.min(sliderPct, MAX_LOGO_FRACTION);
      const logoW = Math.floor(totalSize * logoPct);
      const aspect = logoImage.naturalHeight / logoImage.naturalWidth;
      let logoH = Math.floor(logoW * aspect);
      // Also cap height to the same fraction
      if (logoH > totalSize * MAX_LOGO_FRACTION) {
        logoH = Math.floor(totalSize * MAX_LOGO_FRACTION);
      }
      const lx = Math.floor((totalSize - logoW) / 2);
      const ly = Math.floor((totalSize - logoH) / 2);
      const pad = Math.max(Math.floor(mSize * 1), 2);
      // White border behind the logo
      ctx.fillStyle = bg;
      ctx.fillRect(lx - pad, ly - pad, logoW + pad * 2, logoH + pad * 2);
      ctx.drawImage(logoImage, lx, ly, logoW, logoH);
    }
  }

  function drawModule(ctx, x, y, size, style, color) {
    ctx.fillStyle = color;
    switch (style) {
      case 'rounded': {
        const r = size * 0.3;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + size - r, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + r);
        ctx.lineTo(x + size, y + size - r);
        ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
        ctx.lineTo(x + r, y + size);
        ctx.quadraticCurveTo(x, y + size, x, y + size - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();
        break;
      }
      case 'dots': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const radius = size * 0.42;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'diamond': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(x + size, cy);
        ctx.lineTo(cx, y + size);
        ctx.lineTo(x, cy);
        ctx.closePath();
        ctx.fill();
        break;
      }
      default: // square
        ctx.fillRect(x, y, size, size);
    }
  }

  // ----- SVG Export -----

  function generateSVG(qr) {
    const mSize = parseInt(modSize.value, 10) || 8;
    const quiet = parseInt(quietZone.value, 10) || 0;
    const fg = fgColor.value;
    const bg = bgColor.value;
    const style = modStyle.value;
    const totalSize = (qr.size + quiet * 2) * mSize;

    let svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalSize + ' ' + totalSize + '" width="' + totalSize + '" height="' + totalSize + '">\n';
    svg += '  <rect width="' + totalSize + '" height="' + totalSize + '" fill="' + bg + '"/>\n';

    for (let r = 0; r < qr.size; ++r)
      for (let c = 0; c < qr.size; ++c) {
        if (!qr.matrix[r][c]) continue;
        const x = (c + quiet) * mSize;
        const y = (r + quiet) * mSize;
        svg += svgModule(x, y, mSize, style, fg);
      }

    // Embed logo into SVG if present
    if (logoImage) {
      const MAX_LOGO_FRACTION = 0.20;
      const sliderPct = (parseInt(logoSizeSlider.value, 10) || 20) / 100;
      const logoPct = Math.min(sliderPct, MAX_LOGO_FRACTION);
      const logoW = Math.floor(totalSize * logoPct);
      const aspect = logoImage.naturalHeight / logoImage.naturalWidth;
      let logoH = Math.floor(logoW * aspect);
      if (logoH > totalSize * MAX_LOGO_FRACTION)
        logoH = Math.floor(totalSize * MAX_LOGO_FRACTION);
      const lx = Math.floor((totalSize - logoW) / 2);
      const ly = Math.floor((totalSize - logoH) / 2);
      const pad = Math.max(Math.floor(mSize * 1), 2);
      // White border
      svg += '  <rect x="' + (lx - pad) + '" y="' + (ly - pad) + '" width="' + (logoW + pad * 2) + '" height="' + (logoH + pad * 2) + '" fill="' + bg + '"/>\n';
      // Encode logo as data-URI via a temp canvas
      const tmpC = document.createElement('canvas');
      tmpC.width = logoImage.naturalWidth;
      tmpC.height = logoImage.naturalHeight;
      tmpC.getContext('2d').drawImage(logoImage, 0, 0);
      const dataUri = tmpC.toDataURL('image/png');
      svg += '  <image x="' + lx + '" y="' + ly + '" width="' + logoW + '" height="' + logoH + '" href="' + dataUri + '"/>\n';
    }

    svg += '</svg>';
    return svg;
  }

  function svgModule(x, y, size, style, color) {
    switch (style) {
      case 'rounded': {
        const r = size * 0.3;
        return '  <rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" rx="' + r + '" fill="' + color + '"/>\n';
      }
      case 'dots': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const radius = size * 0.42;
        return '  <circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="' + color + '"/>\n';
      }
      case 'diamond': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        return '  <polygon points="' + cx + ',' + y + ' ' + (x + size) + ',' + cy + ' ' + cx + ',' + (y + size) + ' ' + x + ',' + cy + '" fill="' + color + '"/>\n';
      }
      default:
        return '  <rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" fill="' + color + '"/>\n';
    }
  }

  // ----- Export Functions -----

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function exportPNG(size) {
    if (!currentQR) return;
    const exportCanvas = document.createElement('canvas');
    const quiet = parseInt(quietZone.value, 10) || 0;
    const modPx = Math.floor(size / (currentQR.size + quiet * 2));
    renderQR(currentQR, exportCanvas, modPx);
    exportCanvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'qrcode-' + size + '.png');
    }, 'image/png');
  }

  function exportSVG() {
    if (!currentQR) return;
    const svg = generateSVG(currentQR);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(blob, 'qrcode.svg');
  }

  function copyToClipboard() {
    if (!currentQR) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      try {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
      } catch {
        // Clipboard API not available
      }
    }, 'image/png');
  }

  // ----- PNG dropdown -----
  const pngMenu = document.getElementById('png-menu');

  document.getElementById('btn-png').addEventListener('click', (e) => {
    e.stopPropagation();
    pngMenu.classList.toggle('open');
  });

  pngMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    const size = parseInt(item.dataset.size, 10);
    exportPNG(size);
    pngMenu.classList.remove('open');
  });

  document.addEventListener('click', () => pngMenu.classList.remove('open'));

  document.getElementById('btn-svg').addEventListener('click', exportSVG);
  document.getElementById('btn-copy').addEventListener('click', copyToClipboard);

  // ----- Wire up all inputs to regenerate -----

  const allInputs = [
    dataInput, encodingMode, ecLevelSel, versionSel, fgColor, bgColor, modStyle, modSize, quietZone, logoSizeSlider,
    document.getElementById('wifi-ssid'), document.getElementById('wifi-pass'), document.getElementById('wifi-enc'),
    document.getElementById('vc-name'), document.getElementById('vc-phone'), document.getElementById('vc-email'), document.getElementById('vc-addr'),
    document.getElementById('em-addr'), document.getElementById('em-subj'), document.getElementById('em-body'),
    document.getElementById('ph-num')
  ];

  for (const el of allInputs)
    el.addEventListener('input', scheduleGenerate);

  // Color inputs also fire 'change'
  fgColor.addEventListener('change', scheduleGenerate);
  bgColor.addEventListener('change', scheduleGenerate);
  encodingMode.addEventListener('change', scheduleGenerate);
  ecLevelSel.addEventListener('change', scheduleGenerate);
  versionSel.addEventListener('change', scheduleGenerate);
  modStyle.addEventListener('change', scheduleGenerate);

  // ----- Resize handling -----
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentQR) renderQR(currentQR);
    }, 50);
  });

  // ----- Init -----
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    clearCanvas();
    // Set default URL example
    dataInput.value = 'https://hawkynt.github.io/sz/';
    doGenerate();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    requestAnimationFrame(init);

  // ===== Menu system =====
  function handleMenuAction(action) {
    if (action === 'about')
      SZ.Dialog.show('dlg-about');
  }

  new SZ.MenuBar({ onAction: handleMenuAction });
  SZ.Dialog.wireAll();

})();
