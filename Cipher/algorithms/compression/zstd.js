/*
 * Zstandard (Zstd) Codec — RFC 8878
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Genuinely interoperable implementation of the Zstandard frame format.
 *
 * Encoder: emits a fully standard-compliant frame using only Raw_Block and
 * RLE_Block (RFC 8878 Section 3.1.1.2.2). This is legal, spec-compliant
 * Zstandard output — the standard explicitly permits storing literal bytes
 * uncompressed inside a valid frame — and is read correctly by facebook/zstd,
 * the zstd CLI, and Node's zlib.zstdDecompressSync.
 *
 * Decoder: implements the full block/section grammar needed to read frames
 * produced by real Zstd encoders (Node's zlib.zstdCompressSync, the zstd
 * CLI, etc.), including:
 *  - Frame_Header parsing (descriptor, window descriptor, dictionary ID,
 *    frame content size)
 *  - Raw_Block, RLE_Block and Compressed_Block
 *  - Literals_Section: Raw, RLE, Huffman-Compressed (1 or 4 streams) and
 *    Treeless (reusing the previous block's Huffman tree) literal modes,
 *    including Huffman tree description decoding (direct 4-bit weights and
 *    FSE-compressed weights)
 *  - Sequences_Section: FSE-coded literals-length/match-length/offset codes
 *    with Predefined, RLE, FSE_Compressed and Repeat_Mode distribution
 *    tables, and the repeat-offset ("recent offsets") rules
 *  - Sequence execution (literal copy + back-reference copy)
 *
 * The entropy-coding primitives here are zstd-specific (matching RFC 8878's
 * exact bitstream and table-description formats): the FSE/Huffman modules
 * elsewhere in this repository (fse.js, huffman.js) use their own,
 * non-standard framing and are not wire-compatible with Zstandard's actual
 * bitstream layout, so they are not reused for the entropy stages here.
 *
 * All shift/mask/pack arithmetic uses OpCodes (Shl32/Shr32/And32/Or32/...);
 * a handful of bit-field extractions that can exceed 32 bits (large
 * literals-section headers) use plain arithmetic (multiply/divide/modulo)
 * instead, since JavaScript's native bitwise operators truncate to 32 bits.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== ZSTD CONSTANTS =====

  /** @type {uint32} */
  const ZSTD_MAGIC_NUMBER = 0xFD2FB528;
  /** @type {uint32} */
  const ZSTD_MAGIC_SKIPPABLE_START = 0x184D2A50;
  /** @type {uint32} */
  const ZSTD_MAGIC_SKIPPABLE_MASK = 0xFFFFFFF0;

  const BLOCK_TYPE_RAW = 0;
  const BLOCK_TYPE_RLE = 1;
  const BLOCK_TYPE_COMPRESSED = 2;
  const BLOCK_TYPE_RESERVED = 3;

  const MAX_BLOCK_SIZE = 128 * 1024; // 128 KB
  const MIN_WINDOW_LOG = 10;
  const MAX_WINDOW_LOG = 31;

  const HUF_MAX_BITS = 11;           // RFC 8878 4.2.1 "limits the maximum code length to 11 bits"
  const HUF_WEIGHTS_MAX_ACCLOG = 6;  // RFC 8878 4.2.1.2

  // Predefined literals length codes (RFC 8878 Appendix A.1 / 3.1.1.3.2.2.1)
  /** @type {int32[]} */
  const LL_DEFAULT_NORM = [
    4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1,
    -1, -1, -1, -1
  ];
  const LL_DEFAULT_ACCLOG = 6;

  // Predefined match length codes (RFC 8878 Appendix A.2 / 3.1.1.3.2.2.2)
  /** @type {int32[]} */
  const ML_DEFAULT_NORM = [
    1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1,
    -1, -1, -1, -1, -1
  ];
  const ML_DEFAULT_ACCLOG = 6;

  // Predefined offset codes (RFC 8878 Appendix A.3 / 3.1.1.3.2.2.3)
  /** @type {int32[]} */
  const OF_DEFAULT_NORM = [
    1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1
  ];
  const OF_DEFAULT_ACCLOG = 5;

  // Literals-length code -> {baseline, extra bits} (RFC 8878 Table 16)
  /** @type {int32[]} */
  const LL_BASELINE = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    16, 18, 20, 22, 24, 28, 32, 40, 48, 64, 128, 256, 512, 1024, 2048, 4096,
    8192, 16384, 32768, 65536
  ];
  /** @type {int32[]} */
  const LL_EXTRABITS = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16
  ];

  // Match-length code -> {baseline, extra bits} (RFC 8878 Table 17)
  /** @type {int32[]} */
  const ML_BASELINE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
    35, 37, 39, 41, 43, 47, 51, 59, 67, 83, 99, 131, 259, 515, 1027, 2051,
    4099, 8195, 16387, 32771, 65539
  ];
  /** @type {int32[]} */
  const ML_EXTRABITS = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16
  ];

  // Dictionary-ID and frame-content-size field widths by their 2-bit flags.
  /** @type {int32[]} */
  const DICT_ID_SIZES = [0, 1, 2, 4];
  /** @type {int32[]} */
  const FCS_FIELD_SIZES = [1, 2, 4, 8];

  /**
   * @param {int32} size - Number of entries
   * @param {int32} value - Initial value of every entry
   * @returns {int32[]} Plain array filled with value
   */
  function filledArray(size, value) {
    /** @type {int32[]} */
    const arr = new Array(size);
    arr.fill(value);
    return arr;
  }

  /**
   * Lower-case hexadecimal digits of a non-negative integer, as toString(16)
   * spells them.
   * @param {float64} value - Non-negative integer below 2^53
   * @returns {string} Hex digits without prefix or padding
   */
  function hexString(value) {
    if (value === 0) {
      return '0';
    }
    /** @type {string} */
    let text = '';
    /** @type {float64} */
    let rest = value;
    while (rest > 0) {
      /** @type {int32} */
      const digit = rest % 16;
      text = String.fromCharCode(digit < 10 ? 48 + digit : 87 + digit) + text;
      rest = Math.floor(rest / 16);
    }
    return text;
  }

  // ===== LOW-LEVEL BIT PRIMITIVES =====
  //
  // Zstd's FSE/Huffman bitstreams and its forward table-description bitstreams
  // both use the same "little-endian bit" convention: given an absolute bit
  // index i (bit 0 = LSB of the first byte in range), extracting n bits
  // starting at i yields a number where bit i has weight 1 and bit i+n-1 has
  // weight 2^(n-1). This one convention, applied either with an increasing
  // cursor (forward table descriptions) or a decreasing cursor (backward
  // Huffman/FSE streams), reproduces the exact semantics of libzstd's
  // BIT_addBits / BIT_lookBits and the forward NCount reader.

  /**
   * @param {float64} byteVal - Positive value
   * @returns {int32} 0-based index of its highest set bit
   */
  function highBitPos(byteVal) {
    // 0-based index of the highest set bit of a byte (byteVal must be > 0)
    /** @type {float64} */
    let v = byteVal;
    /** @type {int32} */
    let p = 0;
    while (v > 1) {
      v = Math.floor(v / 2);
      ++p;
    }
    return p;
  }

  /**
   * @param {uint8[]} bytes - Data
   * @param {float64} base - Byte offset of bit 0
   * @param {float64} absBit - Bit index relative to base
   * @returns {uint32} That bit (0 outside the data)
   */
  function bitAtAbs(bytes, base, absBit) {
    if (absBit < 0) {
      return 0;
    }
    /** @type {float64} */
    const byteOffset = Math.floor(absBit / 8);
    /** @type {float64} */
    const byteIdx = base + byteOffset;
    if (byteIdx < 0 || byteIdx >= bytes.length) {
      return 0;
    }
    /** @type {float64} */
    const bitIdx = absBit - byteOffset * 8; // 0..7
    return OpCodes.And32(OpCodes.Shr32(bytes[byteIdx], bitIdx), 1);
  }

  /**
   * @param {uint8[]} bytes - Data
   * @param {float64} base - Byte offset of bit 0
   * @param {float64} absBitStart - First bit index
   * @param {float64} n - Bit count
   * @returns {float64} Bits, least significant first
   */
  function getBitsLE(bytes, base, absBitStart, n) {
    /** @type {float64} */
    let result = 0;
    /** @type {float64} */
    let weight = 1;
    for (let i = 0; i < n; ++i) {
      if (bitAtAbs(bytes, base, absBitStart + i)) {
        result += weight;
      }
      weight *= 2;
    }
    return result;
  }

  // Forward bit cursor: used for FSE table descriptions (NCount) and Huffman
  // weight-table descriptions, which are read forward, byte-aligned start.
  class FwdBitCursor {
    /**
     * @param {uint8[]} bytes - Data
     * @param {float64} byteOffset - First byte
     */
    constructor(bytes, byteOffset) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {float64} */
      this.base = byteOffset;
      /** @type {float64} */
      this.pos = 0; // bits consumed, relative to base
    }

    /**
     * @param {float64} n - Bit count
     * @returns {float64} Next n bits, not consumed
     */
    peekBits(n) {
      return getBitsLE(this.bytes, this.base, this.pos, n);
    }

    /**
     * @param {float64} n - Bit count
     * @returns {float64} Next n bits
     */
    readBits(n) {
      /** @type {float64} */
      const v = this.peekBits(n);
      this.pos += n;
      return v;
    }

    /**
     * @returns {float64} Bytes consumed, rounded up
     */
    byteLength() {
      return Math.ceil(this.pos / 8);
    }
  }

  // Backward bit cursor: used for Huffman-coded streams and FSE-coded
  // bitstreams (sequences, Huffman weights), which are written forward but
  // read backward (RFC 8878 4.1 / 4.2).
  class BwdBitCursor {
    /**
     * @param {uint8[]} bytes - Data
     * @param {float64} start - First byte of the stream
     * @param {float64} end - End of the stream
     */
    constructor(bytes, start, end) {
      if (end <= start) {
        throw new Error('Zstd: empty bitstream');
      }
      /** @type {uint8} */
      const lastByte = bytes[end - 1];
      if (lastByte === 0) {
        throw new Error('Zstd: corrupt bitstream (missing end mark)');
      }
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {float64} */
      this.base = start;
      /** @type {float64} */
      this.cursor = (end - start - 1) * 8 + highBitPos(lastByte); // position of the sentinel '1' bit
    }

    /**
     * @param {float64} n - Bit count
     * @returns {float64} Next n bits, not consumed
     */
    peekBits(n) {
      return getBitsLE(this.bytes, this.base, this.cursor - n, n);
    }

    /**
     * @param {float64} n - Bit count
     * @returns {float64} Next n bits
     */
    readBits(n) {
      this.cursor -= n;
      return getBitsLE(this.bytes, this.base, this.cursor, n);
    }
  }

  // ===== FSE TABLE CONSTRUCTION (RFC 8878 4.1 / 4.1.1) =====

  /**
   * One FSE decoding state.
   */
  class FseEntry {
    /**
     * @param {int32} symbol - Decoded symbol
     * @param {int32} nbBits - Bits read for the next state
     * @param {int32} baseline - Next-state base
     */
    constructor(symbol, nbBits, baseline) {
      /** @type {int32} */
      this.symbol = symbol;
      /** @type {int32} */
      this.nbBits = nbBits;
      /** @type {int32} */
      this.baseline = baseline;
    }
  }

  /**
   * FSE decoding table (entries may keep holes for a malformed description,
   * exactly as before).
   */
  class FseDecodeTable {
    /**
     * @param {int32} accuracyLog - Table log
     * @param {FseEntry[]} entries - State table
     */
    constructor(accuracyLog, entries) {
      /** @type {int32} */
      this.accuracyLog = accuracyLog;
      /** @type {FseEntry[]} */
      this.entries = entries;
    }
  }

  /**
   * @param {int32[]} normCounts - Normalized count per symbol (-1 = low probability)
   * @param {int32} maxSymbolValue - Highest symbol
   * @param {int32} accuracyLog - Table log
   * @returns {FseDecodeTable} Decoding table
   */
  function buildFseTable(normCounts, maxSymbolValue, accuracyLog) {
    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, accuracyLog);
    /** @type {FseEntry[]} */
    const entries = new Array(tableSize);
    /** @type {int32[]} */
    const symbolNext = new Array(maxSymbolValue + 1);
    /** @type {int32} */
    let highThreshold = tableSize - 1;

    for (let s = 0; s <= maxSymbolValue; ++s) {
      if (normCounts[s] === -1) {
        entries[highThreshold] = new FseEntry(s, 0, 0);
        highThreshold--;
        symbolNext[s] = 1;
      } else {
        symbolNext[s] = normCounts[s];
      }
    }

    /** @type {int32} */
    const tableMask = tableSize - 1;
    /** @type {uint32} */
    const step = OpCodes.Add32(OpCodes.Add32(OpCodes.Shr32(tableSize, 1), OpCodes.Shr32(tableSize, 3)), 3);
    /** @type {int32} */
    let position = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      /** @type {int32} */
      const freq = normCounts[s] > 0 ? normCounts[s] : 0;
      for (let i = 0; i < freq; ++i) {
        entries[position] = new FseEntry(s, 0, 0);
        position = OpCodes.And32(position + step, tableMask);
        while (position > highThreshold) {
          position = OpCodes.And32(position + step, tableMask);
        }
      }
    }

    for (let u = 0; u < tableSize; ++u) {
      /** @type {int32} */
      const symbol = entries[u].symbol;
      /** @type {int32} */
      const nextState = symbolNext[symbol]++;
      /** @type {int32} */
      const nbBits = accuracyLog - highBitPos(nextState);
      entries[u].nbBits = nbBits;
      /** @type {int32} */
      const shifted = OpCodes.Shl32(nextState, nbBits);
      entries[u].baseline = shifted - tableSize;
    }

    return new FseDecodeTable(accuracyLog, entries);
  }

  // RLE distribution mode: a degenerate one-state table whose sole state
  // always resolves to `symbol` and never consumes bits.
  /**
   * @param {int32} symbol - The only symbol
   * @returns {FseDecodeTable} One-state table
   */
  function buildRleFseTable(symbol) {
    /** @type {FseEntry[]} */
    const entries = [];
    entries.push(new FseEntry(symbol, 0, 0));
    return new FseDecodeTable(0, entries);
  }

  /**
   * Parsed FSE table description.
   */
  class NCountResult {
    /**
     * @param {int32} accuracyLog - Table log
     * @param {int32[]} counts - Normalized count per symbol
     * @param {int32} maxSymbol - Highest symbol described
     */
    constructor(accuracyLog, counts, maxSymbol) {
      /** @type {int32} */
      this.accuracyLog = accuracyLog;
      /** @type {int32[]} */
      this.counts = counts;
      /** @type {int32} */
      this.maxSymbol = maxSymbol;
    }
  }

  // FSE table description (RFC 8878 4.1.1): reads Accuracy_Log then a
  // normalized-count list, forward, from a byte-aligned start.
  /**
   * @param {FwdBitCursor} cur - Forward cursor
   * @param {int32} maxSymbolValue - Highest symbol allowed
   * @returns {NCountResult} Table description
   */
  function readNCount(cur, maxSymbolValue) {
    /** @type {float64} */
    const logField = cur.readBits(4);
    /** @type {int32} */
    const accuracyLog = logField + 5;
    if (accuracyLog < 5 || accuracyLog > 15) {
      throw new Error('Zstd: invalid FSE accuracy log');
    }

    /** @type {int32} */
    let remaining = OpCodes.Shl32(1, accuracyLog) + 1;
    /** @type {int32} */
    let threshold = OpCodes.Shl32(1, accuracyLog);
    /** @type {int32} */
    let nbBits = accuracyLog + 1;
    /** @type {int32} */
    let charnum = 0;
    /** @type {boolean} */
    let previous0 = false;
    /** @type {int32} */
    const maxSV1 = maxSymbolValue + 1;
    /** @type {int32[]} */
    const counts = filledArray(maxSymbolValue + 1, 0);

    for (;;) {
      if (previous0) {
        /** @type {int32} */
        let n0 = charnum;
        for (;;) {
          /** @type {float64} */
          const v2 = cur.readBits(2);
          n0 += v2;
          if (v2 !== 3) {
            break;
          }
        }
        while (charnum < n0) {
          counts[charnum++] = 0;
        }
        if (charnum >= maxSV1) {
          break;
        }
        previous0 = false;
      }

      /** @type {int32} */
      const max = 2 * threshold - 1 - remaining;
      /** @type {float64} */
      const low = cur.peekBits(nbBits - 1);
      /** @type {int32} */
      let count = 0;
      if (low < max) {
        count = low;
        cur.readBits(nbBits - 1);
      } else {
        /** @type {float64} */
        const full = cur.peekBits(nbBits);
        count = full >= threshold ? full - max : full;
        cur.readBits(nbBits);
      }
      count -= 1;
      if (count >= 0) {
        remaining -= count;
      } else {
        remaining += count;
      }
      counts[charnum++] = count;
      previous0 = (count === 0);

      if (remaining < threshold) {
        if (remaining <= 1) {
          break;
        }
        while (remaining < threshold) {
          nbBits--;
          threshold = Math.floor(threshold / 2);
        }
      }
      if (charnum >= maxSV1) {
        break;
      }
    }

    if (remaining !== 1) {
      throw new Error('Zstd: corrupt FSE table description');
    }
    if (charnum > maxSV1) {
      throw new Error('Zstd: FSE table has too many symbols');
    }

    return new NCountResult(accuracyLog, counts, charnum - 1);
  }

  /**
   * Running FSE decoder state.
   */
  class FseState {
    /**
     * @param {float64} state - Initial state
     */
    constructor(state) {
      /** @type {float64} */
      this.state = state;
    }
  }

  // Decode a symbol stream from an interleaved 2-state generic FSE bitstream
  // (RFC 8878 4.2.1.2 — used only for FSE-compressed Huffman weight lists).
  // Mirrors libzstd's FSE_decompress_usingDTable_generic tail loop: keep
  // decoding+updating both states until the bitstream is exhausted (treating
  // any shortfall as zero-padding), then take one final symbol from each.
  // Mirrors libzstd's FSE_decodeSymbol: read the CURRENT state's symbol from
  // the table, then unconditionally consume nbBits and advance the state —
  // the read and the update are one inseparable step, every time (including
  // for the "final" symbol of each state; only whether we take ANOTHER step
  // afterwards is conditional on the bitstream being exhausted).
  /**
   * @param {BwdBitCursor} cur - Backward cursor
   * @param {FseDecodeTable} table - Decoding table
   * @param {FseState} s - State, advanced
   * @returns {int32} Decoded symbol
   */
  function fseDecodeSymbol(cur, table, s) {
    /** @type {FseEntry} */
    const info = table.entries[s.state];
    /** @type {float64} */
    let lowBits = 0;
    if (info.nbBits > 0) {
      lowBits = cur.readBits(info.nbBits);
    }
    s.state = info.baseline + lowBits;
    return info.symbol;
  }

  /**
   * @param {BwdBitCursor} cur - Backward cursor
   * @param {FseDecodeTable} table - Decoding table
   * @param {int32} maxCount - Most symbols to decode
   * @returns {int32[]} Decoded symbols
   */
  function decodeFseInterleaved2(cur, table, maxCount) {
    /** @type {float64} */
    const first = cur.readBits(table.accuracyLog);
    /** @type {FseState} */
    const s1 = new FseState(first);
    /** @type {float64} */
    const second = cur.readBits(table.accuracyLog);
    /** @type {FseState} */
    const s2 = new FseState(second);
    /** @type {int32[]} */
    const out = [];
    for (;;) {
      if (out.length >= maxCount) {
        break;
      }
      out.push(fseDecodeSymbol(cur, table, s1));
      if (cur.cursor < 0) {
        out.push(fseDecodeSymbol(cur, table, s2));
        break;
      }

      if (out.length >= maxCount) {
        break;
      }
      out.push(fseDecodeSymbol(cur, table, s2));
      if (cur.cursor < 0) {
        out.push(fseDecodeSymbol(cur, table, s1));
        break;
      }
    }
    return out;
  }

  // ===== HUFFMAN TABLE CONSTRUCTION (RFC 8878 4.2) =====

  /**
   * One Huffman decoding slot.
   */
  class HuffEntry {
    /**
     * @param {int32} symbol - Decoded symbol
     * @param {int32} nbBits - Code length
     */
    constructor(symbol, nbBits) {
      /** @type {int32} */
      this.symbol = symbol;
      /** @type {int32} */
      this.nbBits = nbBits;
    }
  }

  /**
   * Direct-lookup Huffman decoding table.
   */
  class HuffmanDecodeTable {
    /**
     * @param {int32} maxBits - Lookup width
     * @param {HuffEntry[]} table - Slot per maxBits-wide window
     */
    constructor(maxBits, table) {
      /** @type {int32} */
      this.maxBits = maxBits;
      /** @type {HuffEntry[]} */
      this.table = table;
    }
  }

  // Build a direct-lookup decode table from a weight list: table[window] =
  // {symbol, nbBits}, where `window` is the maxBits-wide value obtained by
  // peeking the next maxBits bits (RFC 8878 4.2.1.3 canonical assignment,
  // matching libzstd's HUF_fillDTableX1 cumulative-slot construction).
  /**
   * @param {int32[]} weights - Weight per symbol
   * @returns {HuffmanDecodeTable} Decoding table
   */
  function buildHuffmanTable(weights) {
    /** @type {int32} */
    const numSymbols = weights.length;

    // Max_Number_of_Bits (tree depth) is NOT the largest individual weight —
    // it is derived from the Kraft-equality weight total over the COMPLETE
    // weight list (including the implied last symbol, already resolved by
    // the caller): weightTotal = sum(2^(w-1)) over all symbols with w>0.
    // For a valid, complete canonical tree this is exactly 2^maxBits, so
    // maxBits is just its highest set bit position (no +1 here — that +1
    // only applies when summing a PARTIAL list that excludes one symbol,
    // as done while resolving the implied last weight in
    // readHuffmanTreeDescription).
    /** @type {float64} */
    let weightTotal = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (weights[i] > 0) {
        weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, weights[i]), 1);
      }
    }
    if (weightTotal === 0) {
      throw new Error('Zstd: invalid Huffman tree (no symbols)');
    }
    /** @type {int32} */
    const maxBits = highBitPos(weightTotal);
    if (maxBits > HUF_MAX_BITS) {
      throw new Error('Zstd: invalid Huffman tree (too deep)');
    }
    if (OpCodes.Shl32(1, maxBits) !== weightTotal) {
      throw new Error('Zstd: invalid Huffman tree (weights do not sum to a power of 2)');
    }

    /** @type {int32[]} */
    const rankCount = filledArray(maxBits + 1, 0);
    for (let i = 0; i < numSymbols; ++i) {
      rankCount[weights[i]]++;
    }

    /** @type {int32[]} */
    const rankStart = filledArray(maxBits + 2, 0);
    /** @type {int32} */
    let next = 0;
    for (let w = 0; w <= maxBits; ++w) {
      rankStart[w] = next;
      next += rankCount[w];
    }

    /** @type {int32[]} */
    const symbolsByRank = new Array(numSymbols);
    /** @type {int32[]} */
    const cursor = rankStart.slice();
    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const w = weights[sym];
      symbolsByRank[cursor[w]++] = sym;
    }

    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, maxBits);
    /** @type {HuffEntry[]} */
    const table = new Array(tableSize);
    /** @type {int32} */
    let symbolIdx = rankCount[0];
    /** @type {int32} */
    let pos = 0;
    for (let w = 1; w <= maxBits; ++w) {
      /** @type {int32} */
      const count = rankCount[w];
      /** @type {int32} */
      const length = OpCodes.Shl32(1, w - 1);
      /** @type {int32} */
      const nbBits = maxBits + 1 - w;
      for (let s = 0; s < count; ++s) {
        /** @type {int32} */
        const sym = symbolsByRank[symbolIdx + s];
        for (let k = 0; k < length; ++k) {
          table[pos + k] = new HuffEntry(sym, nbBits);
        }
        pos += length;
      }
      symbolIdx += count;
    }

    return new HuffmanDecodeTable(maxBits, table);
  }

  /**
   * Parsed Huffman tree description.
   */
  class TreeDescription {
    /**
     * @param {int32[]} weights - Weight per symbol
     * @param {float64} bytesUsed - Header bytes consumed
     */
    constructor(weights, bytesUsed) {
      /** @type {int32[]} */
      this.weights = weights;
      /** @type {float64} */
      this.bytesUsed = bytesUsed;
    }
  }

  // RFC 8878 4.2.1.3: the last symbol's weight is never transmitted, in
  // either representation. It is the one weight that completes the Kraft sum
  // to the next power of 2: with S = sum(2^(w-1)) over the transmitted
  // weights, Max_Number_of_Bits = highbit(S) + 1 and the missing term
  // 2^Max_Number_of_Bits - S must itself be a power of 2, 2^(lastWeight-1).
  /**
   * @param {int32[]} transmitted - Weights of every symbol but the last
   * @returns {int32[]} Complete weight list, the implied last weight appended
   */
  function appendImpliedLastWeight(transmitted) {
    /** @type {float64} */
    let weightTotal = 0;
    for (let i = 0; i < transmitted.length; ++i) {
      if (transmitted[i] > 0) {
        weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, transmitted[i]), 1);
      }
    }
    if (weightTotal === 0) {
      throw new Error('Zstd: corrupt Huffman weight stream');
    }
    /** @type {int32} */
    const tableLog = highBitPos(weightTotal) + 1;
    if (tableLog > HUF_MAX_BITS) {
      throw new Error('Zstd: invalid Huffman tree (too deep)');
    }
    /** @type {float64} */
    const rest = OpCodes.Shl32(1, tableLog) - weightTotal;
    if (OpCodes.Shl32(1, highBitPos(rest)) !== rest) {
      throw new Error('Zstd: corrupt Huffman weight stream (bad last weight)');
    }
    /** @type {int32[]} */
    const weights = transmitted.slice();
    weights.push(highBitPos(rest) + 1);
    return weights;
  }

  // RFC 8878 4.2.1.1 / 4.2.1.2: parse the Huffman_Tree_Description and return
  // the complete weight list (implied last weight included) plus the number
  // of header bytes consumed.
  /**
   * @param {uint8[]} bytes - Data
   * @param {float64} offset - Header byte position
   * @returns {TreeDescription} Weights and bytes used
   */
  function readHuffmanTreeDescription(bytes, offset) {
    /** @type {uint8} */
    const headerByte = bytes[offset];
    if (headerByte >= 128) {
      // Direct representation: Number_of_Symbols = headerByte - 127 weights,
      // 4 bits each, high nibble first; the symbol after them is implied.
      /** @type {int32} */
      const numSymbols = headerByte - 127;
      /** @type {int32[]} */
      const transmitted = new Array(numSymbols);
      for (let i = 0; i < numSymbols; ++i) {
        /** @type {uint8} */
        const b = bytes[offset + 1 + Math.floor(i / 2)];
        transmitted[i] = (i % 2 === 0) ? OpCodes.Shr32(b, 4) : OpCodes.And32(b, 0xF);
      }
      /** @type {int32} */
      const numBytes = Math.ceil(numSymbols / 2);
      return new TreeDescription(appendImpliedLastWeight(transmitted), 1 + numBytes);
    }

    /** @type {int32} */
    const fseSize = headerByte;
    /** @type {float64} */
    const fseBase = offset + 1;
    /** @type {FwdBitCursor} */
    const cur = new FwdBitCursor(bytes, fseBase);
    /** @type {NCountResult} */
    const nc = readNCount(cur, HUF_WEIGHTS_MAX_ACCLOG > 0 ? 255 : 255);
    /** @type {FseDecodeTable} */
    const table = buildFseTable(nc.counts, nc.maxSymbol, nc.accuracyLog);
    /** @type {float64} */
    const streamStart = fseBase + cur.byteLength();
    /** @type {float64} */
    const streamEnd = fseBase + fseSize;
    /** @type {BwdBitCursor} */
    const bwd = new BwdBitCursor(bytes, streamStart, streamEnd);
    /** @type {int32[]} */
    const decoded = decodeFseInterleaved2(bwd, table, 255);
    return new TreeDescription(appendImpliedLastWeight(decoded), 1 + fseSize);
  }

  // Decode exactly `count` symbols from a single Huffman-coded stream.
  /**
   * @param {uint8[]} bytes - Data
   * @param {float64} start - First byte of the stream
   * @param {float64} end - End of the stream
   * @param {HuffmanDecodeTable} huf - Decoding table
   * @param {float64} count - Symbols to decode
   * @returns {int32[]} Decoded symbols
   */
  function decodeHuffmanStream(bytes, start, end, huf, count) {
    /** @type {BwdBitCursor} */
    const cur = new BwdBitCursor(bytes, start, end);
    /** @type {int32[]} */
    const out = new Array(count);
    /** @type {int32} */
    const mask = huf.table.length - 1;
    for (let i = 0; i < count; ++i) {
      /** @type {float64} */
      const peeked = cur.peekBits(huf.maxBits);
      /** @type {uint32} */
      const window = OpCodes.And32(peeked, mask);
      /** @type {HuffEntry} */
      const entry = huf.table[window];
      out[i] = entry.symbol;
      cur.readBits(entry.nbBits);
    }
    return out;
  }


  // ===== ENCODER SUPPORT: BIT WRITER, FSE/HUFFMAN ENCODE, LZ77 MATCHER =====
  //
  // Builds genuine Compressed_Block output: an LZ77 hash-chain match finder
  // feeding FSE-coded sequences (Predefined_Mode tables only - RFC 8878
  // 3.1.1.3.2.1.1 Table 20, no table transmission needed) and a length-limited
  // Huffman code for the literals section (direct weight description only,
  // RFC 8878 4.2.1.1). All three encoders share the same trick: RFC 8878's
  // Huffman/FSE bitstreams are read *backward* (BwdBitCursor above, "first bit
  // added is last bit read"); the mirror-image encoding technique is to
  // process symbols in REVERSE output order, feeding each one's bits directly
  // (no separate reversal pass needed) into a plain forward-growing bit
  // writer - this exact call order/bit-layout combination was verified
  // independently (encode->our BwdBitCursor-based decode round trip) before
  // being wired in here.

  // Forward-growing ("low bit first") bit writer: bit 0 of the first value
  // written lands at absolute bit 0, later values are appended at increasing
  // bit positions - the mirror of getBitsLE's reading convention, matching
  // libzstd's BIT_addBits/BIT_flushBits (which RFC 8878's backward-reading
  // bitstreams are defined against). FSE state values and Huffman codes stay
  // small (well under 2^20), but the running accumulator can transiently need
  // more than 32 bits of headroom, so - like the "large literals-header"
  // fields noted above - this uses plain multiply/divide/modulo rather than
  // OpCodes' 32-bit-truncating shifts.
  class LowBitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {float64} */
      this.acc = 0;
      /** @type {int32} */
      this.bitPos = 0;
    }

    /**
     * @param {float64} value - Bits to append
     * @param {int32} nbBits - Bit count
     */
    addBits(value, nbBits) {
      if (nbBits === 0) {
        return;
      }
      this.acc += value * Math.pow(2, this.bitPos);
      this.bitPos += nbBits;
      while (this.bitPos >= 8) {
        this.bytes.push(this.acc % 256);
        this.acc = Math.floor(this.acc / 256);
        this.bitPos -= 8;
      }
    }

    /**
     * @returns {uint8[]} Bytes written, the partial last byte included
     */
    finish() {
      if (this.bitPos > 0) {
        this.bytes.push(this.acc % 256);
      }
      return this.bytes;
    }
  }

  /**
   * Per-symbol FSE encoding transform.
   */
  class SymbolTransform {
    /**
     * @param {float64} deltaNbBits - Bits-out delta
     * @param {float64} deltaFindState - State-table offset
     */
    constructor(deltaNbBits, deltaFindState) {
      /** @type {float64} */
      this.deltaNbBits = deltaNbBits;
      /** @type {float64} */
      this.deltaFindState = deltaFindState;
    }
  }

  /**
   * FSE encoding table.
   */
  class FseEncodeTable {
    /**
     * @param {int32} accuracyLog - Table log
     * @param {int32} tableSize - 2^accuracyLog
     * @param {int32[]} stateTable - Next state per slot
     * @param {SymbolTransform[]} symbolTT - Transform per symbol
     */
    constructor(accuracyLog, tableSize, stateTable, symbolTT) {
      /** @type {int32} */
      this.accuracyLog = accuracyLog;
      /** @type {int32} */
      this.tableSize = tableSize;
      /** @type {int32[]} */
      this.stateTable = stateTable;
      /** @type {SymbolTransform[]} */
      this.symbolTT = symbolTT;
    }
  }

  // ----- FSE encode table (mirrors libzstd's FSE_buildCTable: RFC 8878 4.1's
  // spread/position assignment run twice - once to place symbols, once to
  // derive the per-symbol (deltaNbBits, deltaFindState) transform used by
  // FSE_encodeSymbol) -----
  /**
   * @param {int32[]} normCounts - Normalized count per symbol
   * @param {int32} maxSymbolValue - Highest symbol
   * @param {int32} accuracyLog - Table log
   * @returns {FseEncodeTable} Encoding table
   */
  function buildFseEncodeTable(normCounts, maxSymbolValue, accuracyLog) {
    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, accuracyLog);
    /** @type {int32[]} */
    const spread = new Array(tableSize);
    /** @type {int32} */
    let highThreshold = tableSize - 1;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      if (normCounts[s] === -1) {
        spread[highThreshold] = s;
        highThreshold--;
      }
    }
    /** @type {int32} */
    const tableMask = tableSize - 1;
    /** @type {uint32} */
    const step = OpCodes.Add32(OpCodes.Add32(OpCodes.Shr32(tableSize, 1), OpCodes.Shr32(tableSize, 3)), 3);
    /** @type {int32} */
    let position = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      /** @type {int32} */
      const freq = normCounts[s] > 0 ? normCounts[s] : 0;
      for (let i = 0; i < freq; ++i) {
        spread[position] = s;
        position = OpCodes.And32(position + step, tableMask);
        while (position > highThreshold) {
          position = OpCodes.And32(position + step, tableMask);
        }
      }
    }

    /** @type {int32[]} */
    const cumul = filledArray(maxSymbolValue + 2, 0);
    /** @type {int32} */
    let total = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      cumul[s] = total;
      /** @type {int32} */
      const c = normCounts[s];
      total += (c === -1 || c === 1) ? 1 : (c > 0 ? c : 0);
    }
    cumul[maxSymbolValue + 1] = total;

    /** @type {int32[]} */
    const stateTable = new Array(tableSize);
    /** @type {int32[]} */
    const localCumul = cumul.slice();
    for (let u = 0; u < tableSize; ++u) {
      /** @type {int32} */
      const s = spread[u];
      stateTable[localCumul[s]++] = tableSize + u;
    }

    /** @type {SymbolTransform[]} */
    const symbolTT = new Array(maxSymbolValue + 1);
    for (let s = 0; s <= maxSymbolValue; ++s) {
      /** @type {int32} */
      const c = normCounts[s];
      if (c === 0) {
        /** @type {int32} */
        const shifted = OpCodes.Shl32(accuracyLog + 1, 16);
        symbolTT[s] = new SymbolTransform(shifted - tableSize, 0);
      } else if (c === -1 || c === 1) {
        /** @type {int32} */
        const shifted = OpCodes.Shl32(accuracyLog, 16);
        symbolTT[s] = new SymbolTransform(shifted - tableSize, cumul[s] - 1);
      } else {
        /** @type {int32} */
        const maxBitsOut = accuracyLog - highBitPos(c - 1);
        /** @type {int32} */
        const minStatePlus = OpCodes.Shl32(c, maxBitsOut);
        /** @type {int32} */
        const shifted = OpCodes.Shl32(maxBitsOut, 16);
        symbolTT[s] = new SymbolTransform(shifted - minStatePlus, cumul[s] - c);
      }
    }

    return new FseEncodeTable(accuracyLog, tableSize, stateTable, symbolTT);
  }

  // FSE_initCState2: seeds a state directly from the LAST symbol of a run
  // (no bits produced - this becomes the accuracyLog-bit value written by
  // the FINAL flush, which decode reads FIRST as its initial state).
  /**
   * @param {FseEncodeTable} ct - Encoding table
   * @param {int32} symbol - Last symbol of the run
   * @returns {int32} Initial state
   */
  function fseInitCState2(ct, symbol) {
    /** @type {SymbolTransform} */
    const tt = ct.symbolTT[symbol];
    /** @type {uint32} */
    const nbBitsOut = OpCodes.Shr32(tt.deltaNbBits + 32768, 16);
    /** @type {float64} */
    const shifted = OpCodes.Shl32(nbBitsOut, 16);
    /** @type {float64} */
    const value = shifted - tt.deltaNbBits;
    /** @type {float64} */
    const slot = OpCodes.Shr32(value, nbBitsOut);
    return ct.stateTable[slot + tt.deltaFindState];
  }

  // Predefined_Mode encode tables are fixed - build them once.
  /** @type {FseEncodeTable} */
  const LL_ENC_TABLE = buildFseEncodeTable(LL_DEFAULT_NORM, LL_DEFAULT_NORM.length - 1, LL_DEFAULT_ACCLOG);
  /** @type {FseEncodeTable} */
  const OF_ENC_TABLE = buildFseEncodeTable(OF_DEFAULT_NORM, OF_DEFAULT_NORM.length - 1, OF_DEFAULT_ACCLOG);
  /** @type {FseEncodeTable} */
  const ML_ENC_TABLE = buildFseEncodeTable(ML_DEFAULT_NORM, ML_DEFAULT_NORM.length - 1, ML_DEFAULT_ACCLOG);

  /**
   * Running FSE encoder state.
   */
  class EncoderState {
    constructor() {
      /** @type {int32} */
      this.value = 0;
    }
  }

  // FSE_encodeSymbol: transitions the running state backward through the
  // symbol stream, appending the bits this transition needs directly to
  // `writer` (call order == write order, see LowBitWriter comment above).
  /**
   * @param {LowBitWriter} writer - Output bits
   * @param {FseEncodeTable} ct - Encoding table
   * @param {EncoderState} statePtr - Running state, advanced
   * @param {int32} symbol - Symbol to encode
   */
  function fseEncodeSymbol(writer, ct, statePtr, symbol) {
    /** @type {SymbolTransform} */
    const tt = ct.symbolTT[symbol];
    /** @type {uint32} */
    const nbBitsOut = OpCodes.Shr32(statePtr.value + tt.deltaNbBits, 16);
    /** @type {uint32} */
    let lowBits = 0;
    if (nbBitsOut > 0) {
      /** @type {int32} */
      const span = OpCodes.Shl32(1, nbBitsOut);
      lowBits = OpCodes.And32(statePtr.value, span - 1);
    }
    writer.addBits(lowBits, nbBitsOut);
    /** @type {float64} */
    const slot = OpCodes.Shr32(statePtr.value, nbBitsOut);
    statePtr.value = ct.stateTable[slot + tt.deltaFindState];
  }

  /**
   * One sequence ready for FSE coding: codes plus their extra bits.
   */
  class ZstdSequence {
    /**
     * @param {LengthCodeInfo} ll - Literals-length code
     * @param {LengthCodeInfo} ml - Match-length code
     * @param {OffsetCodeInfo} of - Offset code
     */
    constructor(ll, ml, of) {
      /** @type {int32} */
      this.llCode = ll.code;
      /** @type {int32} */
      this.llExtraBits = ll.extraBits;
      /** @type {int32} */
      this.llExtraValue = ll.extraValue;
      /** @type {int32} */
      this.mlCode = ml.code;
      /** @type {int32} */
      this.mlExtraBits = ml.extraBits;
      /** @type {int32} */
      this.mlExtraValue = ml.extraValue;
      /** @type {int32} */
      this.ofCode = of.ofCode;
      /** @type {int32} */
      this.ofExtraBits = of.extraBits;
      /** @type {int32} */
      this.ofExtraValue = of.extraValue;
    }
  }

  // RFC 8878 3.1.1.3.2: FSE-encode one block's sequences using Predefined_Mode
  // tables for LL/OF/ML. Processes sequences from LAST to FIRST (FSE's "first
  // encoded = last decoded" property, verified independently against
  // _decodeSequencesSection's exact read order: init reads LL,OF,ML; per
  // sequence extra bits read OF,ML,LL; per-sequence state updates read
  // LL,ML,OF) so every call below is the deliberate mirror of a specific
  // decoder read, in reverse.
  /**
   * @param {ZstdSequence[]} seqs - Sequences
   * @returns {uint8[]} FSE bitstream
   */
  function encodeSequencesFSE(seqs) {
    /** @type {int32} */
    const n = seqs.length;
    /** @type {LowBitWriter} */
    const writer = new LowBitWriter();

    /** @type {EncoderState} */
    const stateLL = new EncoderState();
    /** @type {EncoderState} */
    const stateOF = new EncoderState();
    /** @type {EncoderState} */
    const stateML = new EncoderState();
    stateLL.value = fseInitCState2(LL_ENC_TABLE, seqs[n - 1].llCode);
    stateOF.value = fseInitCState2(OF_ENC_TABLE, seqs[n - 1].ofCode);
    stateML.value = fseInitCState2(ML_ENC_TABLE, seqs[n - 1].mlCode);

    for (let i = n - 1; i >= 0; --i) {
      /** @type {ZstdSequence} */
      const seq = seqs[i];
      if (i < n - 1) {
        fseEncodeSymbol(writer, OF_ENC_TABLE, stateOF, seq.ofCode);
        fseEncodeSymbol(writer, ML_ENC_TABLE, stateML, seq.mlCode);
        fseEncodeSymbol(writer, LL_ENC_TABLE, stateLL, seq.llCode);
      }
      writer.addBits(seq.llExtraValue, seq.llExtraBits);
      writer.addBits(seq.mlExtraValue, seq.mlExtraBits);
      writer.addBits(seq.ofExtraValue, seq.ofExtraBits);
    }

    writer.addBits(OpCodes.And32(stateML.value, ML_ENC_TABLE.tableSize - 1), ML_DEFAULT_ACCLOG);
    writer.addBits(OpCodes.And32(stateOF.value, OF_ENC_TABLE.tableSize - 1), OF_DEFAULT_ACCLOG);
    writer.addBits(OpCodes.And32(stateLL.value, LL_ENC_TABLE.tableSize - 1), LL_DEFAULT_ACCLOG);
    writer.addBits(1, 1); // end-mark sentinel bit (RFC 8878 4.1)
    /** @type {uint8[]} */
    const bytes = writer.finish();
    return bytes;
  }

  /**
   * Length code with its extra bits.
   */
  class LengthCodeInfo {
    /**
     * @param {int32} code - Code
     * @param {int32} extraBits - Extra-bit count
     * @param {int32} extraValue - Extra-bit value
     */
    constructor(code, extraBits, extraValue) {
      /** @type {int32} */
      this.code = code;
      /** @type {int32} */
      this.extraBits = extraBits;
      /** @type {int32} */
      this.extraValue = extraValue;
    }
  }

  // Find the LL/ML code covering `value` (baseline tables are monotonic and
  // gap-free, so the highest code whose baseline doesn't exceed value is it).
  /**
   * @param {int32[]} baselineTable - Baseline per code
   * @param {int32[]} extraBitsTable - Extra bits per code
   * @param {int32} value - Length
   * @returns {LengthCodeInfo} Covering code
   */
  function findLengthCode(baselineTable, extraBitsTable, value) {
    for (let code = baselineTable.length - 1; code >= 0; --code) {
      if (value >= baselineTable[code]) {
        return new LengthCodeInfo(code, extraBitsTable[code], value - baselineTable[code]);
      }
    }
    throw new Error('Zstd: value below minimum baseline');
  }

  /**
   * Offset code with its extra bits.
   */
  class OffsetCodeInfo {
    /**
     * @param {int32} ofCode - Offset code
     * @param {int32} extraBits - Extra-bit count
     * @param {int32} extraValue - Extra-bit value
     */
    constructor(ofCode, extraBits, extraValue) {
      /** @type {int32} */
      this.ofCode = ofCode;
      /** @type {int32} */
      this.extraBits = extraBits;
      /** @type {int32} */
      this.extraValue = extraValue;
    }
  }

  // RFC 8878 3.1.1.5 repeat-offset rules, run forward (as an encoder needs):
  // given the real match distance and whether this sequence's literals length
  // is zero (which shifts what "repeat offset 1" even means), choose the
  // cheapest legal Offset_Code and mutate the recent-offsets history exactly
  // as the decoder's inverse logic would. Verified independently against
  // _decodeSequencesSection's offset-resolution branch.
  /**
   * @param {int32[]} rep - Recent offsets, updated
   * @param {int32} realOffset - Match distance
   * @param {int32} literalsLength - Literals before the match
   * @returns {OffsetCodeInfo} Chosen offset code
   */
  function resolveSequenceOffset(rep, realOffset, literalsLength) {
    /** @type {boolean} */
    const ll0 = literalsLength === 0;
    /** @type {int32} */
    let ofCode = 0;
    /** @type {int32} */
    let extraBits = 0;
    /** @type {int32} */
    let extraValue = 0;
    if (ll0 && realOffset === rep[1]) {
      ofCode = 0;
    } else if (!ll0 && realOffset === rep[0]) {
      ofCode = 0;
    } else if (ll0 && realOffset === rep[2]) {
      ofCode = 1;
      extraBits = 1;
      extraValue = 0;
    } else if (!ll0 && realOffset === rep[1]) {
      ofCode = 1;
      extraBits = 1;
      extraValue = 0;
    } else if (ll0 && rep[0] > 1 && realOffset === rep[0] - 1) {
      ofCode = 1;
      extraBits = 1;
      extraValue = 1;
    } else if (!ll0 && realOffset === rep[2]) {
      ofCode = 1;
      extraBits = 1;
      extraValue = 1;
    } else {
      /** @type {int32} */
      const offsetValue = realOffset + 3;
      ofCode = highBitPos(offsetValue);
      extraBits = ofCode;
      /** @type {int32} */
      const base = OpCodes.Shl32(1, ofCode);
      extraValue = offsetValue - base;
    }

    if (ofCode >= 2) {
      rep[2] = rep[1];
      rep[1] = rep[0];
      rep[0] = realOffset;
    } else if (ofCode === 1) {
      /** @type {int32} */
      const selector = 1 + (ll0 ? 1 : 0) + extraValue;
      /** @type {int32} */
      let temp = 0;
      if (selector === 1) {
        temp = rep[1];
      } else if (selector === 3) {
        temp = rep[0] - 1;
      } else {
        temp = rep[2];
      }
      if (temp === 0) {
        temp = -1;
      }
      /** @type {int32} */
      const newRep2 = (selector === 1) ? rep[2] : rep[1];
      rep[2] = newRep2;
      rep[1] = rep[0];
      rep[0] = temp;
    } else if (ll0) {
      /** @type {int32} */
      const old1 = rep[1];
      rep[1] = rep[0];
      rep[0] = old1;
    }

    return new OffsetCodeInfo(ofCode, extraBits, extraValue);
  }

  // ----- Length-limited Huffman code construction (package-merge / "coin
  // collector's" algorithm, RFC 8878 4.2.1's Max_Number_of_Bits=11 constraint)
  // -----
  // Produces optimal code lengths bounded by maxLen; for n>=2 symbols the
  // result is always Kraft-complete (verified independently: every symbol is
  // covered and sum(2^-length) is exactly 1, even for pathological
  // Fibonacci-weighted inputs that would need depth >11 unbounded).
  //
  // Items are rows (weight, symbol list); every list is ordered by an
  // explicit stable insertion sort on weight, so equal weights keep their
  // order (packages ahead of the base items they were concatenated before),
  // exactly as the stable built-in sort did.
  /**
   * @param {float64[]} itemWeight - Weight per item, reordered in place
   * @param {int32[][]} itemSymbols - Symbols per item, reordered in place
   */
  function stableSortItemsByWeight(itemWeight, itemSymbols) {
    for (let i = 1; i < itemWeight.length; ++i) {
      /** @type {float64} */
      const w = itemWeight[i];
      /** @type {int32[]} */
      const syms = itemSymbols[i];
      /** @type {int32} */
      let j = i - 1;
      while (j >= 0 && itemWeight[j] > w) {
        itemWeight[j + 1] = itemWeight[j];
        itemSymbols[j + 1] = itemSymbols[j];
        --j;
      }
      itemWeight[j + 1] = w;
      itemSymbols[j + 1] = syms;
    }
  }

  /**
   * @param {int32[]} symbols - Symbols in input order
   * @param {float64[]} weights - Weight per entry of symbols
   * @param {int32} maxLen - Longest allowed code
   * @returns {int32[]} Code length per byte value (0 for symbols not listed)
   */
  function packageMergeLengths(symbols, weights, maxLen) {
    /** @type {int32} */
    const n = symbols.length;
    /** @type {int32[]} */
    const lengthCount = filledArray(256, 0);
    if (n === 1) {
      lengthCount[symbols[0]] = 1;
      return lengthCount;
    }

    /** @type {float64[]} */
    const baseWeight = [];
    /** @type {int32[][]} */
    const baseSymbols = [];
    for (let i = 0; i < n; ++i) {
      baseWeight.push(weights[i]);
      /** @type {int32[]} */
      const single = [symbols[i]];
      baseSymbols.push(single);
    }
    stableSortItemsByWeight(baseWeight, baseSymbols);

    /** @type {float64[]} */
    let prevWeight = baseWeight;
    /** @type {int32[][]} */
    let prevSymbols = baseSymbols;
    for (let level = 2; level <= maxLen; ++level) {
      /** @type {float64[]} */
      const nextWeight = [];
      /** @type {int32[][]} */
      const nextSymbols = [];
      for (let i = 0; i + 1 < prevWeight.length; i += 2) {
        nextWeight.push(prevWeight[i] + prevWeight[i + 1]);
        nextSymbols.push(prevSymbols[i].concat(prevSymbols[i + 1]));
      }
      for (let i = 0; i < baseWeight.length; ++i) {
        nextWeight.push(baseWeight[i]);
        nextSymbols.push(baseSymbols[i]);
      }
      stableSortItemsByWeight(nextWeight, nextSymbols);
      prevWeight = nextWeight;
      prevSymbols = nextSymbols;
    }

    /** @type {int32} */
    const selectedCount = Math.min(prevSymbols.length, 2 * (n - 1));
    for (let k = 0; k < selectedCount; ++k) {
      /** @type {int32[]} */
      const itemSyms = prevSymbols[k];
      for (let m = 0; m < itemSyms.length; ++m) {
        lengthCount[itemSyms[m]]++;
      }
    }
    return lengthCount;
  }

  /**
   * Huffman code word for encoding.
   */
  class HuffCode {
    /**
     * @param {float64} codeBits - Code value
     * @param {int32} nbBits - Code length
     */
    constructor(codeBits, nbBits) {
      /** @type {float64} */
      this.codeBits = codeBits;
      /** @type {int32} */
      this.nbBits = nbBits;
    }
  }

  // Huffman encode table: mirrors buildHuffmanTable's canonical assignment
  // (same rank/position bookkeeping) but records one {codeBits, nbBits} pair
  // per symbol instead of a flat decode-lookup array.
  /**
   * @param {int32[]} weights - Weight per symbol
   * @returns {HuffCode[]} Code per symbol
   */
  function buildHuffmanEncodeTable(weights) {
    /** @type {int32} */
    const numSymbols = weights.length;
    /** @type {float64} */
    let weightTotal = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (weights[i] > 0) {
        weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, weights[i]), 1);
      }
    }
    /** @type {int32} */
    const maxBits = highBitPos(weightTotal);
    /** @type {int32[]} */
    const rankCount = filledArray(maxBits + 1, 0);
    for (let i = 0; i < numSymbols; ++i) {
      rankCount[weights[i]]++;
    }
    /** @type {int32[]} */
    const rankStart = filledArray(maxBits + 2, 0);
    /** @type {int32} */
    let next = 0;
    for (let w = 0; w <= maxBits; ++w) {
      rankStart[w] = next;
      next += rankCount[w];
    }
    /** @type {int32[]} */
    const symbolsByRank = new Array(numSymbols);
    /** @type {int32[]} */
    const cursor = rankStart.slice();
    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const w = weights[sym];
      symbolsByRank[cursor[w]++] = sym;
    }
    /** @type {HuffCode[]} */
    const codes = new Array(numSymbols);
    /** @type {int32} */
    let symbolIdx = rankCount[0];
    /** @type {int32} */
    let pos = 0;
    for (let w = 1; w <= maxBits; ++w) {
      /** @type {int32} */
      const count = rankCount[w];
      /** @type {int32} */
      const length = OpCodes.Shl32(1, w - 1);
      /** @type {int32} */
      const nbBits = maxBits + 1 - w;
      for (let s = 0; s < count; ++s) {
        /** @type {int32} */
        const sym = symbolsByRank[symbolIdx + s];
        codes[sym] = new HuffCode(pos / length, nbBits);
        pos += length;
      }
      symbolIdx += count;
    }
    return codes;
  }

  /**
   * Literal Huffman code for one block.
   */
  class LiteralHuffman {
    /**
     * @param {int32} maxSymbolValue - Highest literal value
     * @param {int32[]} weights - Weight per literal value
     * @param {HuffCode[]} codes - Code per literal value
     */
    constructor(maxSymbolValue, weights, codes) {
      /** @type {int32} */
      this.maxSymbolValue = maxSymbolValue;
      /** @type {int32[]} */
      this.weights = weights;
      /** @type {HuffCode[]} */
      this.codes = codes;
    }
  }

  // Builds a length-limited Huffman code for one block's literal bytes.
  // Returns null when entropy coding isn't applicable (fewer than 2 distinct
  // byte values - RLE/raw already optimal) or, defensively, if the resulting
  // weights somehow fail the Kraft-completeness check (falls back to Raw
  // rather than ever emit a non-conformant tree description).
  /**
   * @param {uint8[]} literalBytes - Literals of the block
   * @returns {LiteralHuffman} Code, or null when not applicable
   */
  function buildLiteralHuffman(literalBytes) {
    /** @type {int32[]} */
    const counts = filledArray(256, 0);
    for (let i = 0; i < literalBytes.length; ++i) {
      counts[literalBytes[i]]++;
    }
    /** @type {int32} */
    let maxSymbolValue = -1;
    /** @type {int32[]} */
    const symbols = [];
    /** @type {float64[]} */
    const weights = [];
    for (let s = 0; s < 256; ++s) {
      if (counts[s] > 0) {
        symbols.push(s);
        weights.push(counts[s]);
        maxSymbolValue = s;
      }
    }
    if (symbols.length < 2) {
      return null;
    }

    /** @type {int32[]} */
    const lengthOf = packageMergeLengths(symbols, weights, HUF_MAX_BITS);
    /** @type {int32} */
    let maxLenUsed = 0;
    for (let k = 0; k < symbols.length; ++k) {
      /** @type {int32} */
      const len = lengthOf[symbols[k]];
      if (len > maxLenUsed) {
        maxLenUsed = len;
      }
    }

    /** @type {int32[]} */
    const outWeights = filledArray(maxSymbolValue + 1, 0);
    for (let k = 0; k < symbols.length; ++k) {
      outWeights[symbols[k]] = maxLenUsed + 1 - lengthOf[symbols[k]];
    }

    /** @type {float64} */
    let weightTotal = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      if (outWeights[s] > 0) {
        weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, outWeights[s]), 1);
      }
    }
    if (weightTotal !== OpCodes.Shl32(1, maxLenUsed)) {
      return null;
    }

    return new LiteralHuffman(maxSymbolValue, outWeights, buildHuffmanEncodeTable(outWeights));
  }

  // Single-stream Huffman literal bitstream: symbols in reverse output order,
  // appended directly (see LowBitWriter comment).
  /**
   * @param {uint8[]} literalBytes - Literals
   * @param {HuffCode[]} codes - Code per literal value
   * @returns {uint8[]} Huffman bitstream
   */
  function encodeHuffmanStream(literalBytes, codes) {
    /** @type {LowBitWriter} */
    const writer = new LowBitWriter();
    for (let i = literalBytes.length - 1; i >= 0; --i) {
      /** @type {HuffCode} */
      const c = codes[literalBytes[i]];
      writer.addBits(c.codeBits, c.nbBits);
    }
    writer.addBits(1, 1);
    /** @type {uint8[]} */
    const bytes = writer.finish();
    return bytes;
  }

  // RFC 8878 4.2.1.1 direct weight representation: Header_Byte = 127 +
  // Number_of_Symbols, then each transmitted weight as a 4-bit nibble (high
  // nibble first). The last symbol's weight is implied (4.2.1.3) and never
  // written, so Number_of_Symbols = weights.length - 1, which must be <= 128.
  // The weights must sum (as 2^(w-1)) to a power of 2 and end with a
  // non-zero weight, so the decoder re-derives exactly that last weight.
  /**
   * @param {int32[]} weights - Weight per symbol, last symbol included
   * @returns {uint8[]} Tree description
   */
  function writeHuffmanTreeDescriptionDirect(weights) {
    /** @type {int32} */
    const numSymbols = weights.length - 1;
    /** @type {uint8[]} */
    const bytes = [];
    bytes.push(OpCodes.And32(127 + numSymbols, 0xFF));
    for (let i = 0; i < numSymbols; i += 2) {
      /** @type {int32} */
      const hi = weights[i];
      /** @type {int32} */
      const lo = (i + 1 < numSymbols) ? weights[i + 1] : 0;
      bytes.push(OpCodes.Or32(OpCodes.Shl32(hi, 4), lo));
    }
    return bytes;
  }

  // Raw_Literals_Block / RLE_Literals_Block header (RFC 8878 3.1.1.3.1.1):
  // picks the smallest Size_Format that can hold regenSize.
  /**
   * @param {int32} blockType - 0 raw, 1 RLE
   * @param {int32} regenSize - Literal count
   * @returns {uint8[]} Literals section header
   */
  function buildRawOrRleLiteralsHeader(blockType, regenSize) {
    /** @type {uint8[]} */
    const header = [];
    if (regenSize <= 31) {
      header.push(OpCodes.Or32(blockType, OpCodes.Shl32(regenSize, 3)));
      return header;
    } else if (regenSize <= 4095) {
      header.push(OpCodes.Or32(OpCodes.Or32(blockType, OpCodes.Shl32(1, 2)), OpCodes.Shl32(OpCodes.And32(regenSize, 0xF), 4)));
      header.push(OpCodes.And32(Math.floor(regenSize / 16), 0xFF));
      return header;
    }
    header.push(OpCodes.Or32(OpCodes.Or32(blockType, OpCodes.Shl32(3, 2)), OpCodes.Shl32(OpCodes.And32(regenSize, 0xF), 4)));
    header.push(OpCodes.And32(Math.floor(regenSize / 16), 0xFF));
    header.push(OpCodes.And32(Math.floor(regenSize / 4096), 0xFF));
    return header;
  }

  // Builds the smallest legal Literals_Section for one block's literal bytes,
  // choosing among RLE / single-stream Huffman-Compressed / Raw. Huffman-
  // Compressed is only attempted when it's legal for this decoder's header
  // grammar: single-stream mode's 3-byte header caps BOTH regenSize and
  // compSize at 1023, and the direct tree-weight representation caps
  // the transmitted Number_of_Symbols (maxSymbolValue, since the weight of
  // symbol maxSymbolValue itself is implied) at 128 - outside those bounds this
  // falls back to Raw_Literals_Block, still leaving FSE-coded sequences to do
  // the compression work for that block.
  /**
   * @param {uint8[]} literalBytes - Literals of the block
   * @returns {uint8[]} Literals section
   */
  function buildLiteralsSection(literalBytes) {
    /** @type {int32} */
    const regenSize = literalBytes.length;

    /** @type {uint8[]} */
    let rleCandidate = null;
    if (regenSize > 1) {
      /** @type {boolean} */
      let allSame = true;
      for (let i = 1; i < regenSize; ++i) {
        if (literalBytes[i] !== literalBytes[0]) {
          allSame = false;
          break;
        }
      }
      if (allSame) {
        /** @type {uint8[]} */
        const rleByte = [literalBytes[0]];
        rleCandidate = buildRawOrRleLiteralsHeader(1, regenSize).concat(rleByte);
      }
    }

    /** @type {uint8[]} */
    const rawCandidate = buildRawOrRleLiteralsHeader(0, regenSize).concat(literalBytes);

    /** @type {uint8[]} */
    let hufCandidate = null;
    if (regenSize >= 2 && regenSize < 1024) {
      /** @type {LiteralHuffman} */
      const huf = buildLiteralHuffman(literalBytes);
      if (huf && huf.maxSymbolValue <= 128) {
        /** @type {uint8[]} */
        const treeDesc = writeHuffmanTreeDescriptionDirect(huf.weights);
        /** @type {uint8[]} */
        const stream = encodeHuffmanStream(literalBytes, huf.codes);
        /** @type {int32} */
        const compSize = treeDesc.length + stream.length;
        if (compSize < 1024) {
          /** @type {float64} */
          const raw24 = 2 + regenSize * 16 + compSize * 16384; // blockType=2 (Compressed), Size_Format=0
          /** @type {uint8[]} */
          const header = [];
          header.push(OpCodes.And32(raw24, 0xFF));
          header.push(OpCodes.And32(Math.floor(raw24 / 256), 0xFF));
          header.push(OpCodes.And32(Math.floor(raw24 / 65536), 0xFF));
          hufCandidate = header.concat(treeDesc).concat(stream);
        }
      }
    }

    /** @type {uint8[]} */
    let best = rawCandidate;
    if (rleCandidate && rleCandidate.length < best.length) {
      best = rleCandidate;
    }
    if (hufCandidate && hufCandidate.length < best.length) {
      best = hufCandidate;
    }
    return best;
  }

  // ===== LZ77 MATCH FINDING =====

  const MAX_MATCH_LEN = 100000;                          // stays under ML table's representable range
  const LZ_HASH_BITS = 16;
  const LZ_CHAIN_DEPTH = 64;
  const LITERAL_RUN_CAP = MAX_BLOCK_SIZE - MAX_MATCH_LEN; // forces a literal-only token before a single
                                                           // run could overflow a block's regen-size budget

  /**
   * Match chosen by the LZ77 matcher.
   */
  class LzMatch {
    /**
     * @param {int32} length - Match length
     * @param {int32} offset - Match distance
     */
    constructor(length, offset) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.offset = offset;
    }
  }

  // Hash-chain match finder (3-byte hash, matching Zstd's minimum match
  // length), modeled after crush.js's HashTable but sized for whole-file
  // (up to window-size) back-references rather than a fixed ring buffer,
  // since Zstd's Single_Segment framing lets matches reach any earlier
  // position in the same frame.
  class Lz77Matcher {
    /**
     * @param {uint8[]} data - Input
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      const hashSize = OpCodes.Shl32(1, LZ_HASH_BITS);
      /** @type {int32} */
      this.hashMask = hashSize - 1;
      /** @type {int32[]} */
      this.head = filledArray(hashSize, -1);
      /** @type {int32[]} */
      this.prev = filledArray(data.length, -1);
    }

    /**
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    _hash(pos) {
      /** @type {uint8[]} */
      const d = this.data;
      /** @type {uint32} */
      const h = OpCodes.Xor32(OpCodes.Shl32(d[pos], 9), OpCodes.Xor32(OpCodes.Shl32(d[pos + 1], 5), d[pos + 2]));
      return OpCodes.And32(h, this.hashMask);
    }

    /**
     * @param {int32} pos - Position to insert
     */
    insert(pos) {
      if (pos + 2 >= this.data.length) {
        return;
      }
      /** @type {int32} */
      const h = this._hash(pos);
      this.prev[pos] = this.head[h];
      this.head[h] = pos;
    }

    /**
     * @param {int32} pos - Current position
     * @param {int32} maxLen - Longest allowed match
     * @returns {LzMatch} Profitable match, or null
     */
    findMatch(pos, maxLen) {
      /** @type {uint8[]} */
      const d = this.data;
      if (pos + 2 >= d.length) {
        return null;
      }
      /** @type {int32} */
      const h = this._hash(pos);
      /** @type {int32} */
      let candidate = this.head[h];
      /** @type {int32} */
      let bestLen = 0;
      /** @type {int32} */
      let bestOffset = 0;
      /** @type {int32} */
      let chain = 0;
      while (candidate >= 0 && chain < LZ_CHAIN_DEPTH) {
        /** @type {int32} */
        let len = 0;
        while (len < maxLen && d[candidate + len] === d[pos + len]) {
          len++;
        }
        if (len > bestLen) {
          bestLen = len;
          bestOffset = pos - candidate;
          if (len >= maxLen) {
            break;
          }
        }
        candidate = this.prev[candidate];
        chain++;
      }
      if (bestLen < 3) {
        return null;
      }
      // Predefined OF table caps codes at 28 (OF_DEFAULT_NORM.length-1); reject
      // matches that would need a larger code (defensive bound, far beyond any
      // practical input size here).
      if (highBitPos(bestOffset + 3) > OF_DEFAULT_NORM.length - 1) {
        return null;
      }
      // Economic-viability check: a sequence costs a roughly-fixed overhead
      // (three FSE state transitions plus the offset's own extra bits, all
      // Predefined-Mode so there's no per-symbol table cost) regardless of
      // match length, while literal bytes cost ~8 bits each. Reject matches
      // whose length can't plausibly pay for their own encoding - otherwise
      // greedy matching on data with only sparse, distant accidental repeats
      // (e.g. a handful of 3-byte coincidences in otherwise-random bytes)
      // spends more bits than it saves. Purely a selection heuristic: it can
      // only make the matcher more conservative, never change how a chosen
      // match is encoded or decoded.
      /** @type {int32} */
      const minProfitable = Math.max(3, Math.ceil((18 + highBitPos(bestOffset + 3) + 1) / 8));
      if (bestLen < minProfitable) {
        return null;
      }
      return new LzMatch(bestLen, bestOffset);
    }
  }

  /**
   * Parsed token: a literal run optionally followed by a match.
   */
  class ZstdToken {
    /**
     * @param {int32} literalStart - First literal byte
     * @param {int32} literalLength - Literal count
     * @param {int32} matchLength - Match length (0 for a literal-only token)
     * @param {int32} offset - Match distance
     */
    constructor(literalStart, literalLength, matchLength, offset) {
      /** @type {int32} */
      this.literalStart = literalStart;
      /** @type {int32} */
      this.literalLength = literalLength;
      /** @type {int32} */
      this.matchLength = matchLength;
      /** @type {int32} */
      this.offset = offset;
    }
  }

  // Produces a flat token list {literalStart, literalLength, matchLength,
  // offset} spanning the whole input; matchLength===0 marks a literal-only
  // token (no match found, or a forced cut once a run reaches
  // LITERAL_RUN_CAP so no single token can ever overflow a block).
  /**
   * @param {uint8[]} data - Input
   * @returns {ZstdToken[]} Tokens
   */
  function tokenize(data) {
    /** @type {ZstdToken[]} */
    const tokens = [];
    /** @type {int32} */
    const n = data.length;
    if (n === 0) {
      return tokens;
    }
    /** @type {Lz77Matcher} */
    const matcher = new Lz77Matcher(data);
    /** @type {int32} */
    let literalStart = 0;
    /** @type {int32} */
    let pos = 0;
    while (pos < n) {
      /** @type {int32} */
      const remaining = n - pos;
      /** @type {LzMatch} */
      let match = null;
      if (remaining >= 3) {
        match = matcher.findMatch(pos, Math.min(MAX_MATCH_LEN, remaining));
      }
      if (match) {
        tokens.push(new ZstdToken(literalStart, pos - literalStart, match.length, match.offset));
        /** @type {int32} */
        const end = pos + match.length;
        for (let i = pos; i < end; ++i) {
          matcher.insert(i);
        }
        pos = end;
        literalStart = pos;
      } else {
        matcher.insert(pos);
        pos++;
        if (pos - literalStart >= LITERAL_RUN_CAP) {
          tokens.push(new ZstdToken(literalStart, pos - literalStart, 0, 0));
          literalStart = pos;
        }
      }
    }
    if (pos > literalStart) {
      tokens.push(new ZstdToken(literalStart, pos - literalStart, 0, 0));
    }
    return tokens;
  }

  // Groups tokens into blocks no larger than MAX_BLOCK_SIZE regen bytes,
  // never mixing literal-only tokens (matchLength===0, destined for an
  // nbSeq=0 block) with real-match tokens in the same group - each token's
  // own regen size is already bounded (LITERAL_RUN_CAP / MAX_MATCH_LEN), so
  // grouping never needs to split a token mid-way.
  /**
   * @param {ZstdToken[]} tokens - Tokens
   * @returns {ZstdToken[][]} Token groups, one per block
   */
  function groupTokensIntoBlocks(tokens) {
    /** @type {ZstdToken[][]} */
    const groups = [];
    /** @type {ZstdToken[]} */
    let cur = [];
    /** @type {int32} */
    let curSize = 0;
    // Only compared once the current group holds a token, i.e. after being set.
    /** @type {boolean} */
    let curIsLiteralOnly = false;
    for (let k = 0; k < tokens.length; ++k) {
      /** @type {ZstdToken} */
      const t = tokens[k];
      /** @type {boolean} */
      const isLiteralOnly = t.matchLength === 0;
      /** @type {int32} */
      const size = t.literalLength + t.matchLength;
      if (cur.length > 0 && (curIsLiteralOnly !== isLiteralOnly || curSize + size > MAX_BLOCK_SIZE)) {
        groups.push(cur);
        cur = [];
        curSize = 0;
      }
      cur.push(t);
      curSize += size;
      curIsLiteralOnly = isLiteralOnly;
    }
    if (cur.length > 0) {
      groups.push(cur);
    }
    return groups;
  }

  // Builds the Compressed_Block PAYLOAD (Literals_Section + Sequences_Section,
  // not including the 3-byte block header) for one group of tokens, using and
  // mutating a WORKING COPY of the recent-offsets so the caller can discard it
  // without side effects if Raw/RLE turns out smaller for this block.
  /**
   * @param {uint8[]} data - Input
   * @param {ZstdToken[]} tokens - Tokens of the block
   * @param {int32[]} repWorking - Recent offsets, updated
   * @returns {uint8[]} Compressed_Block payload
   */
  function buildCompressedBlockCandidate(data, tokens, repWorking) {
    /** @type {uint8[]} */
    const literalBytes = [];
    /** @type {ZstdToken[]} */
    const realSeqs = [];
    for (let k = 0; k < tokens.length; ++k) {
      /** @type {ZstdToken} */
      const t = tokens[k];
      for (let i = 0; i < t.literalLength; ++i) {
        literalBytes.push(data[t.literalStart + i]);
      }
      if (t.matchLength > 0) {
        realSeqs.push(t);
      }
    }

    /** @type {uint8[]} */
    const literalsSection = buildLiteralsSection(literalBytes);

    if (realSeqs.length === 0) {
      /** @type {uint8[]} */
      const noSequences = [0];
      return literalsSection.concat(noSequences); // Sequences_Section header byte 0 = nbSeq 0
    }

    /** @type {ZstdSequence[]} */
    const seqs = new Array(realSeqs.length);
    for (let i = 0; i < realSeqs.length; ++i) {
      /** @type {ZstdToken} */
      const t = realSeqs[i];
      /** @type {LengthCodeInfo} */
      const ll = findLengthCode(LL_BASELINE, LL_EXTRABITS, t.literalLength);
      /** @type {LengthCodeInfo} */
      const ml = findLengthCode(ML_BASELINE, ML_EXTRABITS, t.matchLength);
      /** @type {OffsetCodeInfo} */
      const of = resolveSequenceOffset(repWorking, t.offset, t.literalLength);
      seqs[i] = new ZstdSequence(ll, ml, of);
    }

    /** @type {int32} */
    const nbSeq = seqs.length;
    /** @type {uint8[]} */
    const nbSeqHeader = [];
    if (nbSeq < 128) {
      nbSeqHeader.push(nbSeq);
    } else if (nbSeq <= 32511) {
      nbSeqHeader.push(128 + Math.floor(nbSeq / 256));
      nbSeqHeader.push(OpCodes.And32(nbSeq, 0xFF));
    } else {
      /** @type {int32} */
      const v = nbSeq - 32512;
      nbSeqHeader.push(255);
      nbSeqHeader.push(OpCodes.And32(v, 0xFF));
      nbSeqHeader.push(Math.floor(v / 256));
    }

    /** @type {uint8[]} */
    const modesByte = [0]; // Predefined_Mode for LL, OF and ML (RFC 8878 3.1.1.3.2.1.1)
    /** @type {uint8[]} */
    const sequencesSection = nbSeqHeader.concat(modesByte).concat(encodeSequencesFSE(seqs));

    return literalsSection.concat(sequencesSection);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZstdCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zstandard";
      this.description = "Zstandard (Zstd), RFC 8878. Encoder performs genuine LZ77 compression: a hash-chain match finder produces sequences that are FSE-coded (Predefined_Mode distribution tables) with correct repeat-offset resolution, and literals are Huffman-coded (single-stream, direct tree-weight description) where the literals-section header grammar allows it; each block independently falls back to RLE or Raw when that would be smaller, or when Huffman/FSE isn't applicable (e.g. literal alphabets spanning byte values >=128, or literal counts >=1024, use Raw_Literals so FSE-coded sequences still carry the compression). Decoder reads full frames produced by real Zstd encoders, including Huffman-coded literals (raw/RLE/compressed/treeless) and FSE-coded sequences (predefined/RLE/FSE-compressed/repeat distribution tables) with repeat-offset resolution.";
      this.inventor = "Yann Collet";
      this.year = 2016;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + Entropy";
      this.securityStatus = null; // Not a security primitive
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 8878: Zstandard Compression and the 'application/zstd' Media Type", "https://www.rfc-editor.org/rfc/rfc8878"),
        new LinkItem("Official Zstd Repository", "https://github.com/facebook/zstd"),
        new LinkItem("Zstd Format Specification", "https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md"),
        new LinkItem("FSE Documentation", "https://github.com/Cyan4973/FiniteStateEntropy")
      ];

      this.references = [
        new LinkItem("Facebook Zstd", "https://github.com/facebook/zstd"),
        new LinkItem("RFC 8878 Full Text", "https://www.rfc-editor.org/rfc/rfc8878.txt"),
        new LinkItem("Finite State Entropy", "https://github.com/Cyan4973/FiniteStateEntropy"),
        new LinkItem("LZ4 (by same author)", "https://github.com/lz4/lz4")
      ];

      // Test vectors: the encoder emits Raw/RLE-only frames (byte-exact,
      // self-consistent), verified byte-for-byte against RFC 8878's frame and
      // block header layout. Round-trip-only cases exercise multi-block
      // splitting. Interoperability with real Zstd encoders/decoders
      // (Node's zlib.zstdCompressSync/zstdDecompressSync) is verified
      // separately, since TestCase vectors here must be self-contained.
      this.tests = [
        // Test 1: Simple uncompressed frame (Raw block)
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          // Raw block frame: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3) + Data(5)
          // Magic: 0xFD2FB528 (LE) = 28 B5 2F FD
          // Descriptor: 0x20 (Single_Segment=1, Content_Size_Flag=0)
          // Content Size: 5 (for "hello")
          // Block Header: Size=5 shifted 3 bits, OR Type=Raw shifted 1 bit, OR Last=1 = 0x29 = 29 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD200529000068656C6C6F"),
          "Self-consistent - Raw block, short input",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 2: RLE block frame
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAA"),
          // RLE block: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3) + RepeatedByte(1)
          // Content Size: 10 (ten 'A's)
          // Block Header: Size=10 shifted 3 bits, OR Type=RLE shifted 1 bit, OR Last=1 = 0x53 = 53 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD200A53000041"),
          "Self-consistent - RLE block, repeated byte",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 3: Empty frame
        new TestCase(
          [],
          // Empty frame: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3)
          // Content Size: 0
          // Block Header: Size=0 shifted 3 bits, OR Type=Raw shifted 1 bit, OR Last=1 = 0x01 = 01 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD2000010000"),
          "Self-consistent - Empty frame",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 4: >=256 bytes, exercises the 2-byte content-size-flag path and a
        // non-repetitive payload (raw block).
        new TestCase(
          (() => {
            let seed = 0x2468ACE0, a = [];
            for (let i = 0; i < 300; ++i) { seed = OpCodes.AndN(seed * 1103515245 + 12345, 0x7fffffff); a.push(OpCodes.AndN(seed, 0xFF)); }
            return a;
          })(),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 300 bytes pseudo-random (2-byte content size)",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 5: >MAX_BLOCK_SIZE (128 KiB), non-repetitive - exercises multi-block
        // splitting with the 4-byte content-size-flag path.
        new TestCase(
          (() => {
            const a = new Array(200000);
            for (let i = 0; i < 200000; ++i) a[i] = OpCodes.AndN(i * 37 + 11, 0xFF);
            return a;
          })(),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 200000 bytes pseudo-random, spans multiple blocks",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 6: >MAX_BLOCK_SIZE, fully repetitive - exercises multi-block RLE
        // splitting, where only the final block sets Last_Block.
        new TestCase(
          new Array(150000).fill(0x61),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 150000 repeated bytes, spans multiple RLE blocks",
          "https://www.rfc-editor.org/rfc/rfc8878"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ZstdInstance(this, isInverse);
    }
  }

  // ===== ZSTD DECOMPRESSION IMPLEMENTATION =====

  /**
   * Per-frame decode state: recent-offsets history, previous Huffman tree
   * (for Treeless_Literals_Block) and previous FSE tables (for Repeat_Mode)
   * all persist across blocks within a frame.
   */
  class ZstdFrameState {
    constructor() {
      /** @type {int32[]} */
      this.repOffsets = [1, 4, 8];
      /** @type {HuffmanDecodeTable} */
      this.huffTable = null;
      /** @type {FseDecodeTable} */
      this.llTable = null;
      /** @type {FseDecodeTable} */
      this.ofTable = null;
      /** @type {FseDecodeTable} */
      this.mlTable = null;
    }
  }

  /**
   * Decoded literals and where the literals section ended.
   */
  class LiteralsResult {
    /**
     * @param {uint8[]} literals - Literal bytes
     * @param {float64} contentEnd - First byte after the section
     */
    constructor(literals, contentEnd) {
      /** @type {uint8[]} */
      this.literals = literals;
      /** @type {float64} */
      this.contentEnd = contentEnd;
    }
  }

  /**
   * Read position inside the sequences-section table descriptions.
   */
  class TablePosition {
    /**
     * @param {float64} pos - First unread byte
     */
    constructor(pos) {
      /** @type {float64} */
      this.pos = pos;
    }
  }

  /**
   * One block encoding candidate.
   */
  class BlockCandidate {
    /**
     * @param {int32} type - Block type
     * @param {uint8[]} payload - Block payload
     * @param {int32} headerSize - Block_Size header field
     */
    constructor(type, payload, headerSize) {
      /** @type {int32} */
      this.type = type;
      /** @type {uint8[]} */
      this.payload = payload;
      /** @type {int32} */
      this.headerSize = headerSize;
    }
  }

  // Resolves one sequences-section distribution table (RFC 8878
  // 3.1.1.3.2.1): predefined, RLE, FSE-compressed or repeat mode; advances
  // tp past any table description it reads.
  /**
   * @param {uint8[]} bytes - Block data
   * @param {TablePosition} tp - Description position, advanced
   * @param {int32} mode - Compression mode
   * @param {int32[]} defNorm - Predefined distribution
   * @param {int32} defAccLog - Predefined accuracy log
   * @param {int32} maxSym - Highest symbol allowed
   * @param {FseDecodeTable} prevTable - Table of the previous block, or null
   * @returns {FseDecodeTable} Table to use
   */
  function resolveSequenceTable(bytes, tp, mode, defNorm, defAccLog, maxSym, prevTable) {
    if (mode === 0) {
      return buildFseTable(defNorm, defNorm.length - 1, defAccLog);
    }
    if (mode === 1) {
      /** @type {uint8} */
      const s = bytes[tp.pos];
      tp.pos += 1;
      return buildRleFseTable(s);
    }
    if (mode === 2) {
      /** @type {FwdBitCursor} */
      const cur = new FwdBitCursor(bytes, tp.pos);
      /** @type {NCountResult} */
      const nc = readNCount(cur, maxSym);
      tp.pos += cur.byteLength();
      return buildFseTable(nc.counts, nc.maxSymbol, nc.accuracyLog);
    }
    if (!prevTable) {
      throw new Error('Zstd: Repeat_Mode without a previous table');
    }
    return prevTable;
  }

  /**
 * Zstd cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZstdInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ZstdCompression} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decompress();
      } else {
        // Compression: even empty input should produce a valid frame
        return this._compress();
      }
    }

    // ===== DECOMPRESSION (Production Quality) =====

    /**
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress() {
      try {
        /** @type {BitReader} */
        const reader = new BitReader(this.inputBuffer);
        /** @type {uint8[]} */
        const result = [];

        // Read and validate magic number
        /** @type {uint32} */
        const magic = reader.readU32LE();

        if (magic === ZSTD_MAGIC_NUMBER) {
          // Standard Zstd frame
          /** @type {uint8[]} */
          const frame = this._decodeFrame(reader);
          for (let _i = 0; _i < frame.length; _i++) {
            result.push(frame[_i]);
          }
        } else if (OpCodes.And32(magic, ZSTD_MAGIC_SKIPPABLE_MASK) === ZSTD_MAGIC_SKIPPABLE_START) {
          // Skippable frame - read size and skip
          /** @type {uint32} */
          const frameSize = reader.readU32LE();
          reader.skipBytes(frameSize);
        } else {
          throw new Error('Invalid Zstd magic number: 0x' + hexString(magic));
        }

        this.inputBuffer = [];
        return result;
      } catch (e) {
        /** @type {Error} */
        const err = e;
        /** @type {string} */
        const text = err.message;
        this.inputBuffer = [];
        throw new Error('Zstd decompression failed: ' + text);
      }
    }

    /**
     * @param {BitReader} reader - Frame input
     * @returns {uint8[]} Frame content
     */
    _decodeFrame(reader) {
      // Read frame header descriptor
      /** @type {uint8} */
      const descriptor = reader.readU8();

      /** @type {uint32} */
      const frameContentSizeFlag = OpCodes.And32(OpCodes.Shr32(descriptor, 6), 3);
      /** @type {uint32} */
      const singleSegmentFlag = OpCodes.And32(OpCodes.Shr32(descriptor, 5), 1);
      /** @type {uint32} */
      const checksumFlag = OpCodes.And32(OpCodes.Shr32(descriptor, 2), 1);
      /** @type {uint32} */
      const dictIdFlag = OpCodes.And32(descriptor, 3);

      // Read window descriptor (if not single segment); the size itself is
      // not needed, the whole frame stays addressable.
      /** @type {float64} */
      let windowSize = 0;
      if (singleSegmentFlag === 0) {
        /** @type {uint8} */
        const windowDescriptor = reader.readU8();
        /** @type {uint32} */
        const exponent = OpCodes.Shr32(windowDescriptor, 3);
        /** @type {uint32} */
        const mantissa = OpCodes.And32(windowDescriptor, 7);
        /** @type {int32} */
        const windowLog = MIN_WINDOW_LOG + exponent;
        /** @type {float64} */
        const windowBase = OpCodes.Shl32(1, windowLog);
        /** @type {float64} */
        const windowStep = OpCodes.Shr32(windowBase, 3);
        windowSize = windowBase + windowStep * mantissa;
      }

      // Read dictionary ID if present
      if (dictIdFlag !== 0) {
        /** @type {int32} */
        const dictIdSize = DICT_ID_SIZES[dictIdFlag];
        reader.skipBytes(dictIdSize);
      }

      // Read frame content size if present
      /** @type {float64} */
      let frameContentSize = 0;
      if (singleSegmentFlag !== 0 || frameContentSizeFlag !== 0) {
        /** @type {int32} */
        let sizeBytes = 0;
        if (singleSegmentFlag !== 0) {
          // Single segment: size bytes determined by frameContentSizeFlag
          sizeBytes = frameContentSizeFlag === 0 ? 1 : FCS_FIELD_SIZES[frameContentSizeFlag];
        } else {
          // Multi-segment: size bytes from frameContentSizeFlag
          sizeBytes = FCS_FIELD_SIZES[frameContentSizeFlag];
        }

        if (sizeBytes === 1) {
          frameContentSize = reader.readU8();
        } else if (sizeBytes === 2) {
          /** @type {uint16} */
          const size16 = reader.readU16LE();
          frameContentSize = size16 + 256;
        } else if (sizeBytes === 4) {
          frameContentSize = reader.readU32LE();
        } else if (sizeBytes === 8) {
          /** @type {uint32} */
          const low = reader.readU32LE();
          /** @type {float64} */
          const high = reader.readU32LE();
          frameContentSize = low + high * 0x100000000;
        }
      }

      /** @type {ZstdFrameState} */
      const state = new ZstdFrameState();

      // Decode blocks
      /** @type {uint8[]} */
      const decoded = [];
      /** @type {boolean} */
      let lastBlock = false;

      while (!lastBlock) {
        /** @type {uint32} */
        const blockHeader = reader.readU24LE();
        lastBlock = OpCodes.And32(blockHeader, 1) !== 0;
        /** @type {uint32} */
        const blockType = OpCodes.And32(OpCodes.Shr32(blockHeader, 1), 3);
        /** @type {uint32} */
        const blockSize = OpCodes.Shr32(blockHeader, 3);

        if (blockSize > MAX_BLOCK_SIZE) {
          throw new Error('Block size ' + blockSize + ' exceeds maximum ' + MAX_BLOCK_SIZE);
        }

        // Every block type pushes its bytes directly onto `decoded`, which
        // spans the WHOLE frame: Compressed_Block back-references (matches)
        // must be able to reach into data decoded by earlier blocks in the
        // same frame (RFC 8878 3.1.1.3: "Previous decoded data, up to a
        // distance of Window_Size, or the beginning of the Frame"), so the
        // sequence executor is given the real, growing output buffer rather
        // than a fresh array per block.
        this._decodeBlock(reader, blockType, blockSize, state, decoded);
      }

      // Skip checksum if present
      if (checksumFlag !== 0) {
        reader.skipBytes(4);
      }

      return decoded;
    }

    /**
     * @param {BitReader} reader - Frame input
     * @param {uint32} blockType - Block type
     * @param {uint32} blockSize - Block_Size field
     * @param {ZstdFrameState} state - Frame state
     * @param {uint8[]} decoded - Frame output, appended to
     */
    _decodeBlock(reader, blockType, blockSize, state, decoded) {
      switch (blockType) {
        case BLOCK_TYPE_RAW: {
          // Raw uncompressed block
          /** @type {uint8[]} */
          const bytes = reader.readBytes(blockSize);
          for (let _i = 0; _i < bytes.length; ++_i) {
            decoded.push(bytes[_i]);
          }
          return;
        }

        case BLOCK_TYPE_RLE: {
          // RLE block - single byte repeated blockSize times
          /** @type {uint8} */
          const byte = reader.readU8();
          for (let _i = 0; _i < blockSize; ++_i) {
            decoded.push(byte);
          }
          return;
        }

        case BLOCK_TYPE_COMPRESSED:
          // Compressed block - full Zstd entropy decoding
          this._decodeCompressedBlock(reader, blockSize, state, decoded);
          return;

        case BLOCK_TYPE_RESERVED:
          throw new Error('Reserved block type encountered');

        default:
          throw new Error('Unknown block type: ' + blockType);
      }
    }

    // Full RFC 8878 3.1.1.3 Compressed_Block decode: Literals_Section +
    // Sequences_Section, combined via Sequence Execution (3.1.1.4).
    /**
     * @param {BitReader} reader - Frame input
     * @param {uint32} blockSize - Block_Size field
     * @param {ZstdFrameState} state - Frame state
     * @param {uint8[]} decoded - Frame output, appended to
     */
    _decodeCompressedBlock(reader, blockSize, state, decoded) {
      /** @type {uint8[]} */
      const bytes = reader.data;
      /** @type {float64} */
      const blockStart = reader.pos;
      /** @type {float64} */
      const blockEnd = blockStart + blockSize;

      /** @type {LiteralsResult} */
      const lit = this._decodeLiteralsSection(bytes, blockStart, blockEnd, state);
      /** @type {float64} */
      const seqSectionStart = lit.contentEnd;

      this._decodeSequencesSection(bytes, seqSectionStart, blockEnd, lit.literals, state, decoded);

      reader.pos = blockEnd;
    }

    // RFC 8878 3.1.1.3.1: Literals_Section_Header, [Huffman_Tree_Description],
    // [Jump_Table], Stream_1..4.
    /**
     * @param {uint8[]} bytes - Block data
     * @param {float64} pos - Section start
     * @param {float64} blockEnd - Block end
     * @param {ZstdFrameState} state - Frame state
     * @returns {LiteralsResult} Literals and section end
     */
    _decodeLiteralsSection(bytes, pos, blockEnd, state) {
      /** @type {uint8} */
      const b0 = bytes[pos];
      /** @type {float64} */
      const h0 = b0;
      /** @type {float64} */
      const h1 = bytes[pos + 1];
      /** @type {float64} */
      const h2 = bytes[pos + 2];
      /** @type {float64} */
      const h3 = bytes[pos + 3];
      /** @type {float64} */
      const h4 = bytes[pos + 4];
      /** @type {uint32} */
      const blockType = OpCodes.And32(b0, 3);
      /** @type {uint32} */
      const sizeFormat = OpCodes.And32(OpCodes.Shr32(b0, 2), 3);

      /** @type {float64} */
      let regenSize = 0;
      /** @type {float64} */
      let compSize = -1;
      /** @type {int32} */
      let headerBytes = 0;
      /** @type {int32} */
      let streamCount = 1;

      if (blockType === 0 || blockType === 1) {
        // Raw_Literals_Block / RLE_Literals_Block
        if (sizeFormat === 0 || sizeFormat === 2) {
          regenSize = Math.floor(b0 / 8);
          headerBytes = 1;
        } else if (sizeFormat === 1) {
          regenSize = Math.floor(b0 / 16) + h1 * 16;
          headerBytes = 2;
        } else {
          regenSize = Math.floor(b0 / 16) + h1 * 16 + h2 * 4096;
          headerBytes = 3;
        }
      } else {
        // Compressed_Literals_Block / Treeless_Literals_Block
        if (sizeFormat === 0 || sizeFormat === 1) {
          /** @type {float64} */
          const raw = h0 + h1 * 256 + h2 * 65536;
          regenSize = Math.floor(raw / 16) % 1024;
          compSize = Math.floor(raw / 16384) % 1024;
          headerBytes = 3;
          streamCount = sizeFormat === 0 ? 1 : 4;
        } else if (sizeFormat === 2) {
          /** @type {float64} */
          const raw = h0 + h1 * 256 + h2 * 65536 + h3 * 16777216;
          regenSize = Math.floor(raw / 16) % 16384;
          compSize = Math.floor(raw / 262144) % 16384;
          headerBytes = 4;
          streamCount = 4;
        } else {
          /** @type {float64} */
          const raw = h0 + h1 * 256 + h2 * 65536 + h3 * 16777216 + h4 * 4294967296;
          regenSize = Math.floor(raw / 16) % 262144;
          compSize = Math.floor(raw / 4194304) % 262144;
          headerBytes = 5;
          streamCount = 4;
        }
      }

      /** @type {float64} */
      let contentStart = pos + headerBytes;
      /** @type {uint8[]} */
      let literals = null;

      if (blockType === 0) {
        // Raw
        literals = bytes.slice(contentStart, contentStart + regenSize);
        return new LiteralsResult(literals, contentStart + regenSize);
      }
      if (blockType === 1) {
        // RLE
        literals = new Array(regenSize);
        literals.fill(bytes[contentStart]);
        return new LiteralsResult(literals, contentStart + 1);
      }

      // Compressed / Treeless
      /** @type {HuffmanDecodeTable} */
      let huf = null;
      if (blockType === 2) {
        /** @type {TreeDescription} */
        const desc = readHuffmanTreeDescription(bytes, contentStart);
        huf = buildHuffmanTable(desc.weights);
        state.huffTable = huf;
        contentStart += desc.bytesUsed;
      } else {
        if (!state.huffTable) {
          throw new Error('Zstd: Treeless_Literals_Block without a previous Huffman table');
        }
        huf = state.huffTable;
      }

      /** @type {float64} */
      const contentEnd = pos + headerBytes + compSize;

      if (streamCount === 1) {
        literals = decodeHuffmanStream(bytes, contentStart, contentEnd, huf, regenSize);
      } else {
        /** @type {float64} */
        const j0 = bytes[contentStart];
        /** @type {float64} */
        const j1 = bytes[contentStart + 1];
        /** @type {float64} */
        const j2 = bytes[contentStart + 2];
        /** @type {float64} */
        const j3 = bytes[contentStart + 3];
        /** @type {float64} */
        const j4 = bytes[contentStart + 4];
        /** @type {float64} */
        const j5 = bytes[contentStart + 5];
        /** @type {float64} */
        const s1 = j0 + j1 * 256;
        /** @type {float64} */
        const s2 = j2 + j3 * 256;
        /** @type {float64} */
        const s3 = j4 + j5 * 256;
        /** @type {float64} */
        const jumpTableEnd = contentStart + 6;
        // `totalStreamsSize` here is bytes AFTER the jump table (contentEnd -
        // jumpTableEnd), i.e. it already equals RFC 8878's
        // "Total_Streams_Size - 6" (Total_Streams_Size there includes the
        // 6-byte Jump_Table itself) — so no further "-6" is needed here.
        /** @type {float64} */
        const totalStreamsSize = contentEnd - jumpTableEnd;
        /** @type {float64} */
        const s4 = totalStreamsSize - s1 - s2 - s3;
        if (s4 < 0) {
          throw new Error('Zstd: corrupt literals Jump_Table');
        }

        /** @type {float64} */
        const perStream = Math.floor((regenSize + 3) / 4);
        /** @type {float64[]} */
        const sizes = [s1, s2, s3, s4];
        /** @type {float64[]} */
        const counts = [perStream, perStream, perStream, regenSize - perStream * 3];
        literals = [];
        /** @type {float64} */
        let sp = jumpTableEnd;
        for (let i = 0; i < 4; ++i) {
          /** @type {int32[]} */
          const part = decodeHuffmanStream(bytes, sp, sp + sizes[i], huf, counts[i]);
          for (let k = 0; k < part.length; ++k) {
            literals.push(part[k]);
          }
          sp += sizes[i];
        }
      }

      return new LiteralsResult(literals, contentEnd);
    }

    // RFC 8878 3.1.1.3.2 Sequences_Section + 3.1.1.4 Sequence Execution.
    // `decoded` is the FULL frame output accumulated so far (shared across
    // blocks) — matches are appended to it directly so back-references can
    // reach data decoded by earlier blocks in the same frame.
    /**
     * @param {uint8[]} bytes - Block data
     * @param {float64} pos - Section start
     * @param {float64} blockEnd - Block end
     * @param {uint8[]} literals - Literals of the block
     * @param {ZstdFrameState} state - Frame state
     * @param {uint8[]} decoded - Frame output, appended to
     */
    _decodeSequencesSection(bytes, pos, blockEnd, literals, state, decoded) {
      /** @type {uint8} */
      const byte0 = bytes[pos];
      /** @type {float64} */
      let nbSeq = 0;
      /** @type {int32} */
      let headerBytes = 0;
      if (byte0 === 0) {
        for (let _i = 0; _i < literals.length; ++_i) {
          decoded.push(literals[_i]);
        }
        return;
      } else if (byte0 < 128) {
        nbSeq = byte0;
        headerBytes = 1;
      } else if (byte0 < 255) {
        /** @type {float64} */
        const n0 = byte0;
        /** @type {float64} */
        const n1 = bytes[pos + 1];
        nbSeq = (n0 - 128) * 256 + n1;
        headerBytes = 2;
      } else {
        /** @type {float64} */
        const n1 = bytes[pos + 1];
        /** @type {float64} */
        const n2 = bytes[pos + 2];
        nbSeq = n1 + n2 * 256 + 0x7F00;
        headerBytes = 3;
      }

      /** @type {uint8} */
      const modesByte = bytes[pos + headerBytes];
      /** @type {uint32} */
      const llMode = OpCodes.And32(OpCodes.Shr32(modesByte, 6), 3);
      /** @type {uint32} */
      const ofMode = OpCodes.And32(OpCodes.Shr32(modesByte, 4), 3);
      /** @type {uint32} */
      const mlMode = OpCodes.And32(OpCodes.Shr32(modesByte, 2), 3);

      /** @type {TablePosition} */
      const tp = new TablePosition(pos + headerBytes + 1);

      /** @type {FseDecodeTable} */
      const llTable = resolveSequenceTable(bytes, tp, llMode, LL_DEFAULT_NORM, LL_DEFAULT_ACCLOG, 35, state.llTable);
      /** @type {FseDecodeTable} */
      const ofTable = resolveSequenceTable(bytes, tp, ofMode, OF_DEFAULT_NORM, OF_DEFAULT_ACCLOG, 31, state.ofTable);
      /** @type {FseDecodeTable} */
      const mlTable = resolveSequenceTable(bytes, tp, mlMode, ML_DEFAULT_NORM, ML_DEFAULT_ACCLOG, 52, state.mlTable);
      state.llTable = llTable;
      state.ofTable = ofTable;
      state.mlTable = mlTable;

      /** @type {BwdBitCursor} */
      const cur = new BwdBitCursor(bytes, tp.pos, blockEnd);
      /** @type {float64} */
      let stateLL = cur.readBits(llTable.accuracyLog);
      /** @type {float64} */
      let stateOF = cur.readBits(ofTable.accuracyLog);
      /** @type {float64} */
      let stateML = cur.readBits(mlTable.accuracyLog);

      /** @type {int32[]} */
      const rep = state.repOffsets;
      /** @type {uint8[]} */
      const output = decoded;
      /** @type {int32} */
      let litPos = 0;

      for (let i = 0; i < nbSeq; ++i) {
        /** @type {FseEntry} */
        const llEntry = llTable.entries[stateLL];
        /** @type {int32} */
        const llCode = llEntry.symbol;
        /** @type {FseEntry} */
        const ofEntry = ofTable.entries[stateOF];
        /** @type {int32} */
        const ofCode = ofEntry.symbol;
        /** @type {FseEntry} */
        const mlEntry = mlTable.entries[stateML];
        /** @type {int32} */
        const mlCode = mlEntry.symbol;

        // Resolve offset first (needs only the LL *code*, RFC 8878 3.1.1.3.2.1.2 / 3.1.1.5)
        /** @type {float64} */
        let offset = 0;
        if (ofCode >= 2) {
          /** @type {float64} */
          const extra = cur.readBits(ofCode);
          /** @type {float64} */
          const offsetValue = Math.pow(2, ofCode) + extra;
          offset = offsetValue - 3;
          rep[2] = rep[1];
          rep[1] = rep[0];
          rep[0] = offset;
        } else if (ofCode === 1) {
          /** @type {int32} */
          const ll0 = (llCode === 0) ? 1 : 0;
          /** @type {float64} */
          const extra = cur.readBits(1);
          /** @type {float64} */
          const selector = 1 + ll0 + extra;
          /** @type {float64} */
          let temp = 0;
          if (selector === 1) {
            temp = rep[1];
          } else if (selector === 3) {
            temp = rep[0] - 1;
          } else {
            temp = rep[2];
          }
          if (temp === 0) {
            temp = -1;
          }
          /** @type {float64} */
          const newRep2 = (selector === 1) ? rep[2] : rep[1];
          offset = temp;
          rep[2] = newRep2;
          rep[1] = rep[0];
          rep[0] = temp;
        } else {
          /** @type {boolean} */
          const ll0 = (llCode === 0);
          if (ll0) {
            offset = rep[1];
            rep[1] = rep[0];
            rep[0] = offset; // rep[2] unchanged
          } else {
            offset = rep[0]; // no change
          }
        }

        /** @type {int32} */
        const mlExtraBits = ML_EXTRABITS[mlCode];
        /** @type {float64} */
        let mlExtra = 0;
        if (mlExtraBits > 0) {
          mlExtra = cur.readBits(mlExtraBits);
        }
        /** @type {float64} */
        const matchLength = ML_BASELINE[mlCode] + mlExtra;

        /** @type {int32} */
        const llExtraBits = LL_EXTRABITS[llCode];
        /** @type {float64} */
        let llExtra = 0;
        if (llExtraBits > 0) {
          llExtra = cur.readBits(llExtraBits);
        }
        /** @type {float64} */
        const literalsLength = LL_BASELINE[llCode] + llExtra;

        for (let k = 0; k < literalsLength; ++k) {
          output.push(literals[litPos++]);
        }
        for (let k = 0; k < matchLength; ++k) {
          output.push(output[output.length - offset]);
        }

        if (i < nbSeq - 1) {
          /** @type {FseEntry} */
          const llNext = llTable.entries[stateLL];
          /** @type {float64} */
          let llNextBits = 0;
          if (llNext.nbBits > 0) {
            llNextBits = cur.readBits(llNext.nbBits);
          }
          stateLL = llNext.baseline + llNextBits;
          /** @type {FseEntry} */
          const mlNext = mlTable.entries[stateML];
          /** @type {float64} */
          let mlNextBits = 0;
          if (mlNext.nbBits > 0) {
            mlNextBits = cur.readBits(mlNext.nbBits);
          }
          stateML = mlNext.baseline + mlNextBits;
          /** @type {FseEntry} */
          const ofNext = ofTable.entries[stateOF];
          /** @type {float64} */
          let ofNextBits = 0;
          if (ofNext.nbBits > 0) {
            ofNextBits = cur.readBits(ofNext.nbBits);
          }
          stateOF = ofNext.baseline + ofNextBits;
        }
      }

      while (litPos < literals.length) {
        output.push(literals[litPos++]);
      }
    }

    // ===== COMPRESSION (RFC 8878-compliant Raw/RLE framing) =====

    /**
     * @returns {uint8[]} Zstd frame
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer.slice();
      /** @type {uint8[]} */
      const result = [];
      /** @type {int32} */
      const len = data.length;

      // Magic number (little-endian)
      /** @type {uint8[]} */
      const magicBytes = OpCodes.Unpack32LE(ZSTD_MAGIC_NUMBER);
      for (let _i = 0; _i < 4; ++_i) {
        result.push(magicBytes[_i]);
      }

      // Frame header descriptor + content size (Single_Segment_Flag=1).
      // The Content_Size_Flag (descriptor bits 7-6) MUST reflect how many size
      // bytes are actually written, per RFC 8878 §3.1.1.1.1 - decided up front
      // from the real data length, not patched in afterwards.
      /** @type {int32} */
      let sizeFlag = 0;
      /** @type {uint8[]} */
      let sizeBytes = null;
      if (len < 256) {
        sizeFlag = 0;
        sizeBytes = [len];
      } else if (len <= 256 + 0xFFFF) {
        sizeFlag = 1;
        /** @type {int32} */
        const v = len - 256;
        sizeBytes = [OpCodes.And32(v, 0xFF), OpCodes.And32(OpCodes.Shr32(v, 8), 0xFF)];
      } else if (len <= 0xFFFFFFFF) {
        sizeFlag = 2;
        sizeBytes = OpCodes.Unpack32LE(len);
      } else {
        sizeFlag = 3;
        /** @type {float64} */
        const high = Math.floor(len / 0x100000000);
        /** @type {float64} */
        const low = len - high * 0x100000000;
        sizeBytes = OpCodes.Unpack32LE(low).concat(OpCodes.Unpack32LE(high));
      }

      /** @type {uint32} */
      const descriptor = OpCodes.Or32(OpCodes.Shl32(sizeFlag, 6), 0x20); // Single_Segment=1
      result.push(descriptor);
      for (let _i = 0; _i < sizeBytes.length; _i++) {
        result.push(sizeBytes[_i]);
      }

      if (len === 0) {
        // Empty frame - just header + empty block
        /** @type {uint32} */
        const emptyHeader = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(0, 3), OpCodes.Shl32(BLOCK_TYPE_RAW, 1)), 1); // Last block, raw, size=0
        result.push(OpCodes.And32(emptyHeader, 0xFF));
        result.push(OpCodes.And32(OpCodes.Shr32(emptyHeader, 8), 0xFF));
        result.push(OpCodes.And32(OpCodes.Shr32(emptyHeader, 16), 0xFF));

        this.inputBuffer = [];
        return result;
      }

      // Split into blocks no larger than MAX_BLOCK_SIZE; only the final block
      // sets Last_Block. Each block independently picks the smallest of
      // Raw_Block, RLE_Block or a genuine Compressed_Block (LZ77 sequences,
      // FSE-coded via Predefined_Mode, with Huffman-coded literals where the
      // literals-section header grammar allows it - see buildLiteralsSection).
      // Recent-offsets (repOffsets) persist across blocks within the frame
      // exactly like the decoder's `state.repOffsets`, and are only committed
      // when a block is actually emitted as Compressed - a block that falls
      // back to Raw/RLE leaves them untouched, since the decoder never
      // applies sequence updates for those block types either.
      /** @type {ZstdToken[]} */
      const tokens = tokenize(data);
      /** @type {ZstdToken[][]} */
      const groups = groupTokensIntoBlocks(tokens);
      /** @type {int32[]} */
      const repOffsets = [1, 4, 8];

      /** @type {int32} */
      let cursor = 0;
      for (let gi = 0; gi < groups.length; ++gi) {
        /** @type {ZstdToken[]} */
        const groupTokens = groups[gi];
        /** @type {int32} */
        const isLast = (gi === groups.length - 1) ? 1 : 0;
        /** @type {int32} */
        let regenSize = 0;
        for (let ti = 0; ti < groupTokens.length; ++ti) {
          /** @type {ZstdToken} */
          const t = groupTokens[ti];
          regenSize += t.literalLength + t.matchLength;
        }
        /** @type {uint8[]} */
        const rawBytes = data.slice(cursor, cursor + regenSize);
        cursor += regenSize;

        /** @type {int32[]} */
        const repCandidate = repOffsets.slice();
        /** @type {uint8[]} */
        const compressedPayload = buildCompressedBlockCandidate(data, groupTokens, repCandidate);

        // Block_Size in the header means "regenerated size" for RLE but "payload
        // byte count" for Raw/Compressed (RFC 8878 3.1.1.2) - track both fields
        // per candidate rather than assuming they're the same.
        /** @type {BlockCandidate[]} */
        const candidates = [];
        candidates.push(new BlockCandidate(BLOCK_TYPE_RAW, rawBytes, rawBytes.length));
        candidates.push(new BlockCandidate(BLOCK_TYPE_COMPRESSED, compressedPayload, compressedPayload.length));
        if (this._isRepetitive(rawBytes) && rawBytes.length > 1) {
          /** @type {uint8[]} */
          const rleByte = [rawBytes[0]];
          candidates.push(new BlockCandidate(BLOCK_TYPE_RLE, rleByte, rawBytes.length));
        }

        /** @type {BlockCandidate} */
        let chosen = candidates[0];
        for (let ci = 1; ci < candidates.length; ++ci) {
          if (candidates[ci].payload.length < chosen.payload.length) {
            chosen = candidates[ci];
          }
        }

        if (chosen.type === BLOCK_TYPE_COMPRESSED) {
          repOffsets[0] = repCandidate[0];
          repOffsets[1] = repCandidate[1];
          repOffsets[2] = repCandidate[2];
        }

        /** @type {uint32} */
        const blockHeader = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(chosen.headerSize, 3), OpCodes.Shl32(chosen.type, 1)), isLast);
        result.push(OpCodes.And32(blockHeader, 0xFF));
        result.push(OpCodes.And32(OpCodes.Shr32(blockHeader, 8), 0xFF));
        result.push(OpCodes.And32(OpCodes.Shr32(blockHeader, 16), 0xFF));
        for (let _i = 0; _i < chosen.payload.length; ++_i) {
          result.push(chosen.payload[_i]);
        }
      }

      this.inputBuffer = [];
      return result;
    }

    /**
     * @param {uint8[]} data - Bytes to test
     * @returns {boolean} True when non-empty and all bytes are equal
     */
    _isRepetitive(data) {
      if (data.length === 0) {
        return false;
      }
      /** @type {uint8} */
      const first = data[0];
      for (let i = 1; i < data.length; ++i) {
        if (data[i] !== first) {
          return false;
        }
      }
      return true;
    }
  }

  // ===== BIT READER UTILITY =====

  class BitReader {
    /**
     * @param {uint8[]} data - Input bytes
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {float64} */
      this.pos = 0;
    }

    /**
     * @returns {uint8} Next byte
     */
    readU8() {
      if (this.pos >= this.data.length) {
        throw new Error('Unexpected end of data');
      }
      return this.data[this.pos++];
    }

    /**
     * @returns {uint16} Next little-endian 16-bit value
     */
    readU16LE() {
      /** @type {uint8} */
      const b0 = this.readU8();
      /** @type {uint8} */
      const b1 = this.readU8();
      return OpCodes.Pack16LE(b0, b1);
    }

    /**
     * @returns {uint32} Next little-endian 24-bit value
     */
    readU24LE() {
      /** @type {uint8} */
      const b0 = this.readU8();
      /** @type {uint8} */
      const b1 = this.readU8();
      /** @type {uint8} */
      const b2 = this.readU8();
      return OpCodes.Or32(OpCodes.Or32(b0, OpCodes.Shl32(b1, 8)), OpCodes.Shl32(b2, 16));
    }

    /**
     * @returns {uint32} Next little-endian 32-bit value
     */
    readU32LE() {
      /** @type {uint8} */
      const b0 = this.readU8();
      /** @type {uint8} */
      const b1 = this.readU8();
      /** @type {uint8} */
      const b2 = this.readU8();
      /** @type {uint8} */
      const b3 = this.readU8();
      return OpCodes.Pack32LE(b0, b1, b2, b3);
    }

    /**
     * @param {float64} count - Byte count
     * @returns {uint8[]} Next count bytes
     */
    readBytes(count) {
      if (this.pos + count > this.data.length) {
        throw new Error('Unexpected end of data');
      }
      /** @type {uint8[]} */
      const result = this.data.slice(this.pos, this.pos + count);
      this.pos += count;
      return result;
    }

    /**
     * @param {float64} count - Byte count
     */
    skipBytes(count) {
      if (this.pos + count > this.data.length) {
        throw new Error('Unexpected end of data');
      }
      this.pos += count;
    }

    /**
     * @returns {boolean} True while bytes remain
     */
    hasMore() {
      return this.pos < this.data.length;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZstdCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZstdCompression, ZstdInstance };
}));
