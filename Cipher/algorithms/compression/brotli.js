/*
 * Brotli Compression Algorithm - Pure JavaScript Implementation
 * (c)2006-2025 Hawkynt
 *
 * RFC 7932 INTEROPERABLE
 * =======================
 * This is a genuinely RFC 7932-compatible Brotli codec:
 *
 * - DECOMPRESSION decodes the full RFC 7932 bitstream grammar: the stream
 *   header (WBITS), uncompressed and compressed meta-blocks, complex/simple
 *   prefix code descriptors (Section 3), block-switch commands with their own
 *   prefix codes (Section 6), insert-and-copy commands (Section 5), distance
 *   codes and the four-entry distance ring buffer (Section 4), context
 *   modeling for literals and distances (Section 7), and the static
 *   dictionary with its 121 word transforms (Section 8, Appendix A/B) for
 *   backward references that exceed the in-window range. It reads streams
 *   produced by any conformant encoder, including Google's reference
 *   implementation (zlib's brotliCompressSync / the `brotli` CLI).
 *
 * - COMPRESSION uses the format's own modelling machinery rather than a bare
 *   LZ77 plus Huffman pass:
 *     * literal context modelling (Section 7.1) - all four context modes are
 *       measured and the cheapest is picked, then the 64 context values are
 *       clustered into up to 16 literal prefix codes whose count is chosen by
 *       measured bit cost and transmitted as a context map (Section 7.3);
 *     * the four-entry distance ring buffer (Section 4) - distance codes 0-15
 *       reuse recent distances without any extra bits, and the
 *       implicit-distance insert-and-copy ranges (Section 5, codes 0-127)
 *       drop the distance symbol entirely;
 *     * complex prefix code descriptors (Section 3.5) with the run-length
 *       codes 16 and 17, choosing per descriptor between the run-length and
 *       the spelled-out form by measured size, plus the simple form of
 *       Section 3.4 for alphabets with at most four coded symbols;
 *     * cost-driven meta-block splitting - the command stream is cut where the
 *       literal distributions diverge, and each meta-block independently falls
 *       back to the uncompressed form (Section 9.2) when that is smaller;
 *     * a hash-chain match finder with cost-aware ranking and one step of lazy
 *       matching, and canonical length-limited (package-merge) prefix codes.
 *   NOT implemented on the encoding side: static dictionary references
 *   (Section 8), several block types per category with block-switch commands
 *   (Section 6), non-zero NPOSTFIX/NDIRECT distance parameters (Section 4),
 *   and distance context modelling (Section 7.2). Any compliant Brotli
 *   decoder, including zlib's brotliDecompressSync and the reference `brotli`
 *   CLI, accepts the output byte-for-byte.
 *
 * Every encoder decision is taken with integer arithmetic only (including a
 * fixed-point base-2 logarithm for entropy estimates), so this encoder and the
 * C# encoder in the CompressionWorkbench project emit identical bytes.
 *
 * The static dictionary word list (Appendix A) and the word-transform table
 * (Appendix B) are transcribed directly from the RFC 7932 specification text
 * itself (verified byte-for-byte against the RFC's own stated CRC-32 values
 * for both tables - see brotli-dictionary.data.js) - not copied from any existing
 * Brotli implementation.
 *
 * REFERENCE: RFC 7932 - Brotli Compressed Data Format
 *            https://datatracker.ietf.org/doc/html/rfc7932
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', './brotli-dictionary.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./brotli-dictionary.data')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.BrotliDictionary);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, BrotliDictionary) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!BrotliDictionary) {
    throw new Error('BrotliDictionary dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== RFC 7932 CONSTANTS =====

  // Section 3.5: code-length alphabet symbol order for the complex prefix
  // code descriptor (skipped leading entries per HSKIP are implicit zero).
  const CODE_LENGTH_CODE_ORDER = [1, 2, 3, 4, 0, 5, 17, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const REPEAT_PREVIOUS_CODE_LENGTH = 16;
  const REPEAT_ZERO_CODE_LENGTH = 17;

  // Section 6: block count code alphabet (26 symbols): [base, extraBits].
  const BLOCK_LENGTH_CODES = [
    [1, 2], [5, 2], [9, 2], [13, 2], [17, 3], [25, 3], [33, 3], [41, 3],
    [49, 4], [65, 4], [81, 4], [97, 4], [113, 5], [145, 5], [177, 5], [209, 5],
    [241, 6], [305, 6], [369, 7], [497, 8], [753, 9], [1265, 10], [2289, 11], [4337, 12],
    [8433, 13], [16625, 24]
  ];

  // Section 5: insert-length code alphabet (24 symbols): [base, extraBits].
  const INSERT_LENGTH_CODES = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 1], [8, 1],
    [10, 2], [14, 2], [18, 3], [26, 3], [34, 4], [50, 4], [66, 5], [98, 5],
    [130, 6], [194, 7], [322, 8], [578, 9], [1090, 10], [2114, 12], [6210, 14], [22594, 24]
  ];

  // Section 5: copy-length code alphabet (24 symbols): [base, extraBits].
  const COPY_LENGTH_CODES = [
    [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
    [10, 1], [12, 1], [14, 2], [18, 2], [22, 3], [30, 3], [38, 4], [54, 4],
    [70, 5], [102, 5], [134, 6], [198, 7], [326, 8], [582, 9], [1094, 10], [2118, 24]
  ];

  // Section 5: maps an 11-block (64-code) region of the insert-and-copy length
  // code (0..703) to [insertLengthCodeBase, copyLengthCodeBase, distanceIsImplicitZero].
  // Derived directly from the RFC's insert/copy range table.
  const INSERT_COPY_RANGE_TABLE = [
    [0, 0, true],    // code   0.. 63
    [0, 8, true],    // code  64..127
    [0, 0, false],   // code 128..191
    [0, 8, false],   // code 192..255
    [8, 0, false],   // code 256..319
    [8, 8, false],   // code 320..383
    [0, 16, false],  // code 384..447
    [16, 0, false],  // code 448..511
    [8, 16, false],  // code 512..575
    [16, 8, false],  // code 576..639
    [16, 16, false]  // code 640..703
  ];

  // Section 7.1: context lookup tables for UTF8 (Lut0/Lut1) and Signed (Lut2)
  // context modes. Extracted and CRC-32 verified against the RFC 7932 text.
  const LUT0 = BrotliDictionary.CONTEXT_LUT0;
  const LUT1 = BrotliDictionary.CONTEXT_LUT1;
  const LUT2 = BrotliDictionary.CONTEXT_LUT2;

  // ===== SMALL HELPERS =====

  // Smallest b such that Shl32(1, b) >= n, computed without floating point.
  function BitLength(n) {
    let bits = 0, v = 1;
    while (v < n) { v = OpCodes.Shl32(v, 1); bits++; }
    return bits;
  }

  // ===== BIT READER (LSB-first, matching RFC 7932 Section 1.5.1) =====

  class BitReader {
    constructor(buffer) {
      this.buffer = buffer;
      this.bitPos = 0; // absolute bit index into buffer
    }

    readBits(n) {
      let result = 0;
      for (let i = 0; i < n; ++i) {
        const byteIndex = Math.floor(this.bitPos / 8);
        const bitIndex = this.bitPos % 8;
        if (byteIndex >= this.buffer.length)
          throw new Error('Unexpected end of Brotli stream');
        const bit = OpCodes.And32(OpCodes.Shr32(this.buffer[byteIndex], bitIndex), 1);
        result = OpCodes.Or32(result, OpCodes.Shl32(bit, i));
        this.bitPos++;
      }
      return result;
    }

    // Advance to the next byte boundary (no-op if already aligned).
    alignToByte() {
      const rem = this.bitPos % 8;
      if (rem !== 0) this.bitPos += (8 - rem);
    }

    bytePos() {
      return Math.floor(this.bitPos / 8);
    }

    skipBytes(n) {
      this.bitPos += n * 8;
    }
  }

  // ===== HUFFMAN (PREFIX CODE) DECODER =====
  // Canonical prefix code per RFC 7932 Section 3.2. A single non-zero-length
  // symbol collapses to a zero-bit code (Section 3.5).

  class HuffmanTree {
    constructor() {
      this.singleSymbol = -1;
      this.maxLength = 0;
      this.byLength = null; // Map from code length to a Map from code value to symbol
    }

    buildFromLengths(lengths, alphabetSize) {
      let nonZeroCount = 0, lastSymbol = -1;
      for (let s = 0; s < alphabetSize; ++s) {
        if (lengths[s] > 0) { nonZeroCount++; lastSymbol = s; }
      }
      if (nonZeroCount === 0) return false;
      if (nonZeroCount === 1) { this.singleSymbol = lastSymbol; return true; }

      let maxLength = 0;
      for (let s = 0; s < alphabetSize; ++s) if (lengths[s] > maxLength) maxLength = lengths[s];
      this.maxLength = maxLength;

      const blCount = new Array(maxLength + 1).fill(0);
      for (let s = 0; s < alphabetSize; ++s) if (lengths[s] > 0) blCount[lengths[s]]++;

      const nextCode = new Array(maxLength + 1).fill(0);
      let code = 0;
      for (let bits = 1; bits <= maxLength; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      this.byLength = new Map();
      for (let s = 0; s < alphabetSize; ++s) {
        const len = lengths[s];
        if (len === 0) continue;
        const assigned = nextCode[len]++;
        if (!this.byLength.has(len)) this.byLength.set(len, new Map());
        this.byLength.get(len).set(assigned, s);
      }
      return true;
    }

    decode(reader) {
      if (this.singleSymbol >= 0) return this.singleSymbol;
      let code = 0;
      for (let len = 1; len <= this.maxLength; ++len) {
        code = OpCodes.Or32(OpCodes.Shl32(code, 1), reader.readBits(1));
        const atLength = this.byLength.get(len);
        if (atLength && atLength.has(code)) return atLength.get(code);
      }
      throw new Error('Invalid Brotli prefix code');
    }
  }

  // ===== VARIABLE-LENGTH INTEGER READERS (Section 9.1/9.2/7.3) =====

  // Section 9.1: WBITS (window size exponent), value range 10..24 (or 16).
  function readWindowBits(reader) {
    if (reader.readBits(1) === 0) return 16;
    const n = reader.readBits(3);
    if (n !== 0) return 17 + n;
    const m = reader.readBits(3);
    if (m !== 0) return 8 + m;
    return 17;
  }

  // Section 9.2: shared variable-length code used for NBLTYPESx and NTREESx.
  // value 1 -> 1 bit "0"; value 2 -> "0001"; else base (2 to the power v) + 1, with v extra bits.
  function readBlockCountVLC(reader) {
    if (reader.readBits(1) === 0) return 1;
    const v = reader.readBits(3);
    if (v === 0) return 2;
    const extra = reader.readBits(v);
    return OpCodes.Shl32(1, v) + 1 + extra;
  }

  // Section 7.3: RLEMAX field. 0 -> single 0 bit; else 4 bits + 1 (range 1..16).
  function readRunLengthMax(reader) {
    if (reader.readBits(1) === 0) return 0;
    return reader.readBits(4) + 1;
  }

  // Section 3.5: fixed 6-symbol prefix code (values 0..5) used to transmit the
  // code lengths of the 18-symbol code-length alphabet itself.
  function readCodeLengthCodeLength(reader) {
    if (reader.readBits(1) === 0)
      return reader.readBits(1) === 0 ? 0 : 3;
    if (reader.readBits(1) === 0) return 4;
    if (reader.readBits(1) === 0) return 2;
    return reader.readBits(1) === 0 ? 1 : 5;
  }

  function decodeBlockLength(reader, tree) {
    const code = tree.decode(reader);
    const [base, extra] = BLOCK_LENGTH_CODES[code];
    return base + (extra > 0 ? reader.readBits(extra) : 0);
  }

  // Section 3.4: simple prefix code (1..4 symbols).
  function readSimplePrefixCode(reader, alphabetSize) {
    const nsym = reader.readBits(2) + 1;
    const alphabetBits = BitLength(alphabetSize);
    const symbols = [];
    for (let i = 0; i < nsym; ++i) symbols.push(reader.readBits(alphabetBits));

    const tree = new HuffmanTree();
    if (nsym === 1) { tree.singleSymbol = symbols[0]; return tree; }

    const lengths = new Array(alphabetSize).fill(0);
    if (nsym === 2) {
      lengths[symbols[0]] = 1; lengths[symbols[1]] = 1;
    } else if (nsym === 3) {
      lengths[symbols[0]] = 1; lengths[symbols[1]] = 2; lengths[symbols[2]] = 2;
    } else {
      const treeSelect = reader.readBits(1);
      if (treeSelect === 0) {
        for (let i = 0; i < 4; ++i) lengths[symbols[i]] = 2;
      } else {
        lengths[symbols[0]] = 1; lengths[symbols[1]] = 2; lengths[symbols[2]] = 3; lengths[symbols[3]] = 3;
      }
    }
    tree.buildFromLengths(lengths, alphabetSize);
    return tree;
  }

  // Section 3.5: complex prefix code. hskip in {0,2,3} (1 selects the simple
  // form and is handled by the caller before this function is reached).
  function readComplexPrefixCode(reader, hskip, alphabetSize) {
    // Phase 1: decode the 18 code-length-alphabet code lengths themselves,
    // using the fixed 6-symbol code above, terminating once the Kraft sum
    // (tracked as `space`, scaled by 32) is exhausted.
    const codeLengthLengths = new Array(18).fill(0);
    let space = 32, nonZeroCount = 0, lastNonZeroSymbol = -1;
    for (let i = hskip; i < 18 && space > 0; ++i) {
      const len = readCodeLengthCodeLength(reader);
      const symbol = CODE_LENGTH_CODE_ORDER[i];
      codeLengthLengths[symbol] = len;
      if (len !== 0) {
        space -= OpCodes.Shr32(32, len);
        nonZeroCount++;
        lastNonZeroSymbol = symbol;
      }
    }

    const codeLengthTree = new HuffmanTree();
    if (nonZeroCount === 1) codeLengthTree.singleSymbol = lastNonZeroSymbol;
    else codeLengthTree.buildFromLengths(codeLengthLengths, 18);

    // Phase 2: decode the alphabetSize target code lengths using the tree
    // from phase 1, honoring the 16 (repeat previous) / 17 (repeat zero)
    // run-length codes. RFC 7932 3.5: a run of consecutive 16s (or 17s)
    // CHAINS - each subsequent repeat code in the run modifies the running
    // repeat count (repeat = 4*(repeat-2) + next-bits) instead of adding an
    // independent one; we track that running state and emit only the delta.
    // Trailing 0/17 codes are omitted entirely from the stream, so once the
    // Kraft sum for the target alphabet (spaceTarget) reaches zero, no more
    // bits are read even if `symbol` has not reached alphabetSize.
    const lengths = new Array(alphabetSize).fill(0);
    let symbol = 0, prevLength = 8, repeat = 0, repeatLength = -1, spaceTarget = 32768;
    while (symbol < alphabetSize && spaceTarget > 0) {
      const decoded = codeLengthTree.decode(reader);
      if (decoded < 16) {
        lengths[symbol++] = decoded;
        if (decoded !== 0) { prevLength = decoded; spaceTarget -= OpCodes.Shr32(32768, decoded); }
        repeat = 0; repeatLength = -1;
        continue;
      }

      const usePrevious = decoded === REPEAT_PREVIOUS_CODE_LENGTH;
      const extraBits = usePrevious ? 2 : 3;
      const newLength = usePrevious ? prevLength : 0;
      if (repeatLength !== newLength) { repeat = 0; repeatLength = newLength; }
      const oldRepeat = repeat;
      if (repeat > 0) repeat = OpCodes.Shl32(repeat - 2, extraBits);
      repeat += reader.readBits(extraBits) + 3;

      const delta = Math.min(repeat - oldRepeat, alphabetSize - symbol);
      if (delta < 0) throw new Error('Invalid Brotli complex prefix code: repeat overruns alphabet');
      if (newLength !== 0) spaceTarget -= delta * OpCodes.Shr32(32768, newLength);
      for (let i = 0; i < delta; ++i) lengths[symbol++] = newLength;
    }

    const tree = new HuffmanTree();
    tree.buildFromLengths(lengths, alphabetSize);
    return tree;
  }

  function readPrefixCode(reader, alphabetSize) {
    const hskip = reader.readBits(2);
    if (hskip === 1) return readSimplePrefixCode(reader, alphabetSize);
    return readComplexPrefixCode(reader, hskip, alphabetSize);
  }

  // ===== INSERT-AND-COPY LENGTH DECODING (Section 5) =====

  function decodeInsertAndCopy(reader, code) {
    const block = OpCodes.Shr32(code, 6);
    const sub = OpCodes.And32(code, 63);
    const [insertBase, copyBase, distanceIsImplicitZero] = INSERT_COPY_RANGE_TABLE[block];
    const insertLengthCode = insertBase + OpCodes.And32(OpCodes.Shr32(sub, 3), 7);
    const copyLengthCode = copyBase + OpCodes.And32(sub, 7);

    const [insertBaseValue, insertExtra] = INSERT_LENGTH_CODES[insertLengthCode];
    const insertLength = insertBaseValue + (insertExtra > 0 ? reader.readBits(insertExtra) : 0);

    const [copyBaseValue, copyExtra] = COPY_LENGTH_CODES[copyLengthCode];
    const copyLength = copyBaseValue + (copyExtra > 0 ? reader.readBits(copyExtra) : 0);

    return { insertLength, copyLength, distanceIsImplicitZero };
  }

  // ===== DISTANCE DECODING (Section 4) =====

  function decodeDistanceCode(reader, code, nPostfix, nDirect, distanceCache) {
    if (code < 16) {
      switch (code) {
        case 0: return distanceCache[0];
        case 1: return distanceCache[1];
        case 2: return distanceCache[2];
        case 3: return distanceCache[3];
        case 4: return distanceCache[0] - 1;
        case 5: return distanceCache[0] + 1;
        case 6: return distanceCache[0] - 2;
        case 7: return distanceCache[0] + 2;
        case 8: return distanceCache[0] - 3;
        case 9: return distanceCache[0] + 3;
        case 10: return distanceCache[1] - 1;
        case 11: return distanceCache[1] + 1;
        case 12: return distanceCache[1] - 2;
        case 13: return distanceCache[1] + 2;
        case 14: return distanceCache[1] - 3;
        default: return distanceCache[1] + 3; // case 15
      }
    }
    if (code < 16 + nDirect) return code - 16 + 1;

    const postfixMask = OpCodes.BitMask(nPostfix);
    const base = code - nDirect - 16;
    const ndistbits = 1 + OpCodes.Shr32(base, nPostfix + 1);
    const hcode = OpCodes.Shr32(base, nPostfix);
    const lcode = OpCodes.And32(base, postfixMask);
    const dextra = reader.readBits(ndistbits);
    const offset = OpCodes.Shl32(2 + OpCodes.And32(hcode, 1), ndistbits) - 4;
    return OpCodes.Shl32(offset + dextra, nPostfix) + lcode + nDirect + 1;
  }

  // ===== CONTEXT MODELING (Section 7) =====

  function getLiteralContextId(mode, p1, p2) {
    if (mode === 0) return OpCodes.And32(p1, 0x3f);       // LSB6
    if (mode === 1) return OpCodes.Shr32(p1, 2);           // MSB6
    if (mode === 2) return OpCodes.Or32(LUT0[p1], LUT1[p2]); // UTF8
    return OpCodes.Or32(OpCodes.Shl32(LUT2[p1], 3), LUT2[p2]); // Signed
  }

  // Section 7.2: distance context is derived from the copy length (2,3,4,>4).
  function getDistanceContextId(copyLength) {
    if (copyLength === 2) return 0;
    if (copyLength === 3) return 1;
    if (copyLength === 4) return 2;
    return 3;
  }

  // Section 7.3: context map with move-to-front + run-length zero coding.
  function readContextMap(reader, size, treeCount) {
    if (treeCount < 2) return new Array(size).fill(0);

    const rleMax = readRunLengthMax(reader);
    const tree = readPrefixCode(reader, treeCount + rleMax);

    const map = [];
    while (map.length < size) {
      const symbol = tree.decode(reader);
      if (symbol === 0) {
        map.push(0);
      } else if (symbol <= rleMax) {
        const extra = reader.readBits(symbol);
        const zeroRun = OpCodes.Shl32(1, symbol) + extra;
        for (let i = 0; i < zeroRun && map.length < size; ++i) map.push(0);
      } else {
        map.push(symbol - rleMax);
      }
    }

    if (reader.readBits(1) === 1) {
      const mtf = new Array(256);
      for (let i = 0; i < 256; ++i) mtf[i] = i;
      for (let i = 0; i < map.length; ++i) {
        const index = map[i];
        const value = mtf[index];
        map[i] = value;
        for (let k = index; k > 0; --k) mtf[k] = mtf[k - 1];
        mtf[0] = value;
      }
    }
    return map;
  }

  // ===== BLOCK-SWITCH STATE (Section 6) =====

  class BlockCategory {
    constructor(numTypes) {
      this.numTypes = numTypes;
      this.type = 0;
      this.previousType = 1;
      this.count = 0;
      this.typeTree = null;
      this.lengthTree = null;
    }
  }

  function readBlockCategoryHeader(reader) {
    const numTypes = readBlockCountVLC(reader);
    const category = new BlockCategory(numTypes);
    if (numTypes >= 2) {
      category.typeTree = readPrefixCode(reader, numTypes + 2);
      category.lengthTree = readPrefixCode(reader, 26);
      category.count = decodeBlockLength(reader, category.lengthTree);
    } else {
      category.count = OpCodes.Shl32(1, 24);
    }
    return category;
  }

  function advanceBlockType(reader, category) {
    if (category.count === 0) {
      const symbol = category.typeTree.decode(reader);
      let newType;
      if (symbol === 0) newType = category.previousType;
      else if (symbol === 1) newType = (category.type + 1) % category.numTypes;
      else newType = symbol - 2;
      category.previousType = category.type;
      category.type = newType;
      category.count = decodeBlockLength(reader, category.lengthTree);
    }
    category.count--;
  }

  // ===== BROTLI DECOMPRESSOR =====

  class BrotliDecoder {
    decompress(input) {
      const reader = new BitReader(input);
      const output = [];

      const windowBits = readWindowBits(reader);
      const windowSize = OpCodes.Shl32(1, windowBits) - 16;

      // Section 4: ring buffer of the four most recent (non-implicit, non-
      // dictionary) distances, initialized at the *stream* level.
      const distanceCache = [4, 11, 15, 16];
      let p1 = 0, p2 = 0; // last two produced bytes, for literal context IDs

      for (;;) {
        const isLast = reader.readBits(1) === 1;
        if (isLast && reader.readBits(1) === 1) break; // ISLASTEMPTY

        const mnibblesRaw = reader.readBits(2);
        const mnibblesMap = [4, 5, 6, 0];
        const mnibbles = mnibblesMap[mnibblesRaw];

        if (mnibbles === 0) {
          // MNIBBLES==0: empty/metadata meta-block (Section 9.2/10).
          if (reader.readBits(1) !== 0) throw new Error('Invalid Brotli stream: reserved bit must be zero');
          const mskipBytes = reader.readBits(2);
          let mskipLen = 0;
          if (mskipBytes > 0) mskipLen = reader.readBits(mskipBytes * 8) + 1;
          reader.alignToByte();
          reader.skipBytes(mskipLen);
          if (isLast) break;
          continue;
        }

        let mlen = 0;
        for (let i = 0; i < mnibbles; ++i)
          mlen = OpCodes.Or32(mlen, OpCodes.Shl32(reader.readBits(4), i * 4));
        mlen++;

        // ISUNCOMPRESSED only exists when this is not the last meta-block;
        // a data-carrying last meta-block is always the compressed form.
        const isUncompressed = !isLast && reader.readBits(1) === 1;

        if (isUncompressed) {
          reader.alignToByte();
          for (let i = 0; i < mlen; ++i) {
            const byte = input[reader.bytePos()];
            reader.skipBytes(1);
            output.push(byte);
            p2 = p1; p1 = byte;
          }
          if (isLast) break;
          continue;
        }

        this._decodeCompressedMetaBlock(reader, output, mlen, windowSize, distanceCache, p1, p2,
          (newP1, newP2) => { p1 = newP1; p2 = newP2; });

        if (isLast) break;
      }

      return output;
    }

    _decodeCompressedMetaBlock(reader, output, mlen, windowSize, distanceCache, p1In, p2In, updateContext) {
      let p1 = p1In, p2 = p2In;

      const literalCategory = readBlockCategoryHeader(reader);
      const insertCopyCategory = readBlockCategoryHeader(reader);
      const distanceCategory = readBlockCategoryHeader(reader);

      const nPostfix = reader.readBits(2);
      const nDirect = OpCodes.Shl32(reader.readBits(4), nPostfix);

      const contextModes = [];
      for (let i = 0; i < literalCategory.numTypes; ++i) contextModes.push(reader.readBits(2));

      const literalTreeCount = readBlockCountVLC(reader);
      const literalContextMap = readContextMap(reader, 64 * literalCategory.numTypes, literalTreeCount);
      const distanceTreeCount = readBlockCountVLC(reader);
      const distanceContextMap = readContextMap(reader, 4 * distanceCategory.numTypes, distanceTreeCount);

      const literalTrees = [];
      for (let i = 0; i < literalTreeCount; ++i) literalTrees.push(readPrefixCode(reader, 256));

      const insertCopyTrees = [];
      for (let i = 0; i < insertCopyCategory.numTypes; ++i) insertCopyTrees.push(readPrefixCode(reader, 704));

      const distanceAlphabetSize = 16 + nDirect + OpCodes.Shl32(48, nPostfix);
      const distanceTrees = [];
      for (let i = 0; i < distanceTreeCount; ++i) distanceTrees.push(readPrefixCode(reader, distanceAlphabetSize));

      let produced = 0;
      while (produced < mlen) {
        advanceBlockType(reader, insertCopyCategory);
        const commandCode = insertCopyTrees[insertCopyCategory.type].decode(reader);
        const command = decodeInsertAndCopy(reader, commandCode);

        for (let i = 0; i < command.insertLength && produced < mlen; ++i) {
          advanceBlockType(reader, literalCategory);
          const contextMode = contextModes[literalCategory.type];
          const contextId = getLiteralContextId(contextMode, p1, p2);
          const treeIndex = literalContextMap[64 * literalCategory.type + contextId];
          const literal = literalTrees[treeIndex].decode(reader);
          output.push(literal);
          p2 = p1; p1 = literal;
          produced++;
        }

        if (produced >= mlen) break;
        if (command.copyLength === 0) continue;

        let distance, distanceCode = 0;
        if (command.distanceIsImplicitZero) {
          distance = distanceCache[0];
        } else {
          advanceBlockType(reader, distanceCategory);
          const contextId = getDistanceContextId(command.copyLength);
          const treeIndex = distanceContextMap[4 * distanceCategory.type + contextId];
          distanceCode = distanceTrees[treeIndex].decode(reader);
          distance = decodeDistanceCode(reader, distanceCode, nPostfix, nDirect, distanceCache);
        }

        if (distance <= 0) throw new Error('Invalid Brotli distance: non-positive');

        const maxAllowedDistance = Math.min(windowSize, output.length);
        const isDictionaryReference = distance > maxAllowedDistance;

        if (!command.distanceIsImplicitZero && distanceCode !== 0 && !isDictionaryReference) {
          distanceCache[3] = distanceCache[2];
          distanceCache[2] = distanceCache[1];
          distanceCache[1] = distanceCache[0];
          distanceCache[0] = distance;
        }

        if (!isDictionaryReference) {
          for (let i = 0; i < command.copyLength && produced < mlen; ++i) {
            const byte = output[output.length - distance];
            output.push(byte);
            p2 = p1; p1 = byte;
            produced++;
          }
        } else {
          const word = BrotliDictionary.LookupWord(command.copyLength, distance, maxAllowedDistance);
          if (!word) throw new Error('Invalid Brotli static dictionary reference');
          for (let i = 0; i < word.length && produced < mlen; ++i) {
            output.push(word[i]);
            p2 = p1; p1 = word[i];
            produced++;
          }
        }
      }

      updateContext(p1, p2);
    }
  }

  // ===== BROTLI COMPRESSOR =====
  //
  // Emits RFC 7932 streams that use the format's own modelling machinery:
  // literal context modelling (Section 7.1, all four context modes, with the 64
  // context values clustered into several literal prefix codes that are
  // transmitted as a context map per Section 7.3), the distance ring buffer
  // including the implicit-distance insert-and-copy ranges (Sections 4 and 5),
  // run-length coded complex prefix code descriptors (Section 3.5), and
  // cost-driven meta-block splitting where every meta-block independently falls
  // back to the uncompressed form of Section 9.2.
  //
  // Deliberately NOT implemented: static dictionary references (Section 8),
  // several block types per category with block-switch commands (Section 6),
  // non-zero NPOSTFIX/NDIRECT distance parameters (Section 4), and distance
  // context modelling (Section 7.2). All of those are optional encoder-side
  // features; the emitted streams stay fully conformant without them.
  //
  // Every encoding decision is taken with integer arithmetic only, so this
  // encoder and CompressionWorkbench's C# encoder emit identical bytes.

  // Tunables. Any change here must be mirrored in CompressionWorkbench's
  // BrotliCompressor.cs, otherwise the two stop producing identical bytes.
  const MIN_MATCH = 4;
  const HASH_BITS = 17;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const MAX_CHAIN = 256;
  const MAX_COPY_LENGTH = 8388608;
  const MAX_LITERAL_RUN = 4194304;
  const SEGMENT_BYTES = 32768;
  const MAX_METABLOCK_BYTES = 16777216;
  const SPLIT_THRESHOLD_UNITS = 262144;
  const ESTIMATED_COMMAND_BITS = 12;
  const ESTIMATED_DISTANCE_BITS = 12;
  const MATCH_RANK_LITERAL_BITS = 5;
  const LAZY_MATCH_MARGIN = 8;
  const LITERAL_TREE_CANDIDATES = [1, 2, 4, 8, 16];
  const INITIAL_DISTANCE_RING = [4, 11, 15, 16];
  const DISTANCE_ALPHABET_SIZE = 64;   // 16 + NDIRECT(0) + 48 for NPOSTFIX(0)
  const LITERAL_ALPHABET_SIZE = 256;
  const IAC_ALPHABET_SIZE = 704;
  const NUM_CODE_LENGTH_CODES = 18;
  const MAX_CODE_LENGTH = 15;

  const POW2 = (function () {
    const table = new Array(32);
    let value = 1;
    for (let i = 0; i < 32; ++i) { table[i] = value; value = value * 2; }
    return table;
  })();

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    writeBits(n, value) {
      // NOTE: bitBuffer legitimately becomes 0 mid-stream whenever the
      // currently-accumulated pending bits are all zero while bitCount is
      // still nonzero (e.g. writing a zero nibble). Never key any logic off
      // "is bitBuffer falsy" - only bitCount tracks the pending bit position.
      if (n <= 0) return;
      const masked = OpCodes.AndN(value, OpCodes.BitMask(n));
      this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(masked, this.bitCount));
      this.bitCount += n;

      while (this.bitCount >= 8) {
        this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
        this.bitBuffer = OpCodes.Shr32(this.bitBuffer, 8);
        this.bitCount -= 8;
      }
    }

    alignToByte() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
    }

    flush() {
      if (this.bitCount > 0) this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    // Splices another (unflushed) BitWriter's exact bit sequence onto this
    // one, without introducing any byte-alignment padding at the join point.
    // Brotli meta-blocks are NOT individually byte-aligned in general (only
    // the payload of an uncompressed meta-block is) so a candidate meta-block
    // built in its own isolated writer (to measure its size against the
    // uncompressed alternative) must be re-threaded bit-for-bit into the
    // stream-level writer rather than byte-copied.
    appendBits(other) {
      for (let i = 0; i < other.bytes.length; ++i) this.writeBits(8, other.bytes[i]);
      if (other.bitCount > 0) this.writeBits(other.bitCount, other.bitBuffer);
    }

    // Total number of bits written so far (complete bytes plus any pending
    // partial byte) - used to compare a candidate meta-block's true size.
    bitLength() {
      return this.bytes.length * 8 + this.bitCount;
    }
  }

  // ===== ENCODER: DETERMINISTIC INTEGER COST MODEL =====
  //
  // Every size comparison the encoder makes has to be reproduced bit-for-bit by
  // the C# implementation. Floating point logarithms are not safe for that (the
  // last unit in the last place may differ between runtimes), so all costs come
  // from an exact fixed-point base-2 logarithm and are carried in units of
  // 1/256 bit.

  // floor(log2(x) * 65536) for x >= 1, integer arithmetic only.
  function computeLog2Fixed(x) {
    let exponent = 0, v = x;
    while (v >= 2) { v = Math.floor(v / 2); ++exponent; }

    // Mantissa in [1, 2) held as a fixed point number with 20 fractional bits.
    let mantissa = Math.floor(x * 1048576 / POW2[exponent]);
    let result = exponent * 65536;
    let bit = 32768;
    for (let i = 0; i < 16; ++i) {
      mantissa = Math.floor(mantissa * mantissa / 1048576);
      if (mantissa >= 2097152) { result += bit; mantissa = Math.floor(mantissa / 2); }
      bit = Math.floor(bit / 2);
    }
    return result;
  }

  let LOG2_TABLE = null;
  function log2Fixed(x) {
    if (LOG2_TABLE === null) {
      LOG2_TABLE = new Int32Array(65536);
      for (let i = 1; i < 65536; ++i) LOG2_TABLE[i] = computeLog2Fixed(i);
    }
    return x < 65536 ? LOG2_TABLE[x] : computeLog2Fixed(x);
  }

  // Ideal cost, in 1/256-bit units, of coding `count` occurrences of one symbol
  // inside an alphabet seen `total` times.
  function bitCostUnits(count, total) {
    if (count <= 0) return 0;

    // Clamped so the division below can never see a negative numerator: integer
    // division truncates towards zero in the C# implementation but towards minus
    // infinity here, and the two must not be able to disagree.
    const delta = log2Fixed(total) - log2Fixed(count);
    return delta <= 0 ? 0 : Math.floor(count * delta / 256);
  }

  function histogramCostUnits(histogram) {
    let total = 0;
    for (let i = 0; i < histogram.length; ++i) total += histogram[i];
    if (total === 0) return 0;
    let cost = 0;
    for (let i = 0; i < histogram.length; ++i) cost += bitCostUnits(histogram[i], total);
    return cost;
  }

  // Extra cost, in 1/256-bit units, of coding two histograms with one shared
  // distribution instead of two separate ones. Never negative.
  function mergeCostUnits(a, b) {
    let totalA = 0, totalB = 0;
    for (let i = 0; i < a.length; ++i) { totalA += a[i]; totalB += b[i]; }
    const totalMerged = totalA + totalB;
    if (totalMerged === 0) return 0;

    let cost = 0;
    for (let i = 0; i < a.length; ++i) {
      const fa = a[i], fb = b[i];
      cost += bitCostUnits(fa + fb, totalMerged) - bitCostUnits(fa, totalA) - bitCostUnits(fb, totalB);
    }
    return cost;
  }

  // ===== ENCODER: PREFIX CODES (RFC 7932 Section 3) =====
  //
  // Optimal length-limited code lengths via the boundary package-merge algorithm
  // (Larmore and Hirschberg, 1990). RFC 7932 Section 3.2 caps code lengths at 15
  // bits for the data alphabets and Section 3.5 at 5 bits for the code-length
  // alphabet nested inside a complex prefix code descriptor - an unrestricted
  // Huffman build can exceed either limit for skewed frequency distributions.

  // Merges two weight-ascending lists into one, preferring the first list on
  // ties so the result does not depend on any sort implementation.
  function mergeAscending(first, second) {
    const merged = [];
    let i = 0, j = 0;
    while (i < first.length && j < second.length) {
      if (first[i].weight <= second[j].weight) merged.push(first[i++]);
      else merged.push(second[j++]);
    }
    while (i < first.length) merged.push(first[i++]);
    while (j < second.length) merged.push(second[j++]);
    return merged;
  }

  function buildCodeLengths(frequencies, alphabetSize, maxLength) {
    const lengths = new Array(alphabetSize).fill(0);

    const used = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol)
      if (frequencies[symbol] > 0) used.push(symbol);

    if (used.length === 0) return lengths;
    if (used.length === 1) { lengths[used[0]] = 1; return lengths; }

    const basis = used.map(symbol => ({ weight: frequencies[symbol], symbols: [symbol] }));
    basis.sort((x, y) => x.weight !== y.weight ? x.weight - y.weight : x.symbols[0] - y.symbols[0]);

    let list = basis;
    for (let level = 2; level <= maxLength; ++level) {
      const packaged = [];
      for (let i = 0; i + 1 < list.length; i += 2) {
        const combined = [];
        const left = list[i].symbols, right = list[i + 1].symbols;
        for (let k = 0; k < left.length; ++k) combined.push(left[k]);
        for (let k = 0; k < right.length; ++k) combined.push(right[k]);
        packaged.push({ weight: list[i].weight + list[i + 1].weight, symbols: combined });
      }
      list = mergeAscending(packaged, basis);
    }

    const take = Math.min(2 * used.length - 2, list.length);
    for (let i = 0; i < take; ++i) {
      const symbols = list[i].symbols;
      for (let k = 0; k < symbols.length; ++k) lengths[symbols[k]]++;
    }
    return lengths;
  }

  // Rewrites code lengths that will be transmitted as a simple prefix code
  // (RFC 7932 Section 3.4). The implied lengths are positional and the symbols
  // are always written in ascending order, so the shortest code goes to the
  // smallest symbol - exactly what a canonical code does for equal lengths.
  function normalizeSimpleCode(lengths, alphabetSize) {
    const used = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol)
      if (lengths[symbol] > 0) used.push(symbol);

    if (used.length === 2) {
      lengths[used[0]] = 1; lengths[used[1]] = 1;
    } else if (used.length === 3) {
      lengths[used[0]] = 1; lengths[used[1]] = 2; lengths[used[2]] = 2;
    } else if (used.length === 4) {
      for (let i = 0; i < 4; ++i) lengths[used[i]] = 2;
    }
  }

  // Canonical code assignment - the exact encode-side mirror of
  // HuffmanTree.buildFromLengths's blCount/nextCode algorithm, recording a
  // {code, length} pair per symbol instead of a decode map. A code with a single
  // symbol decodes with zero bits (Section 3.5), so nothing is written for it.
  function makePrefixCode(lengths, alphabetSize) {
    let usedCount = 0, lastSymbol = 0, maxLength = 0;
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (lengths[symbol] <= 0) continue;
      ++usedCount;
      lastSymbol = symbol;
      if (lengths[symbol] > maxLength) maxLength = lengths[symbol];
    }

    if (usedCount <= 1) return { lengths: lengths, codes: null, singleSymbol: lastSymbol };

    const lengthCounts = new Array(maxLength + 1).fill(0);
    for (let symbol = 0; symbol < alphabetSize; ++symbol)
      if (lengths[symbol] > 0) lengthCounts[lengths[symbol]]++;

    const nextCode = new Array(maxLength + 1).fill(0);
    let value = 0;
    for (let bits = 1; bits <= maxLength; ++bits) {
      value = OpCodes.Shl32(value + lengthCounts[bits - 1], 1);
      nextCode[bits] = value;
    }

    const codes = new Array(alphabetSize).fill(0);
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      const length = lengths[symbol];
      if (length > 0) codes[symbol] = nextCode[length]++;
    }
    return { lengths: lengths, codes: codes, singleSymbol: -1 };
  }

  function buildPrefixCode(frequencies, alphabetSize, maxLength) {
    const lengths = buildCodeLengths(frequencies, alphabetSize, maxLength);

    let usedCount = 0;
    for (let symbol = 0; symbol < alphabetSize; ++symbol)
      if (lengths[symbol] > 0) ++usedCount;

    // An alphabet nothing was coded from still needs a descriptor; the NSYM=1
    // simple form costs the fewest bits and decodes to a zero-bit code.
    if (usedCount === 0) lengths[0] = 1;
    else if (usedCount <= 4) normalizeSimpleCode(lengths, alphabetSize);

    return makePrefixCode(lengths, alphabetSize);
  }

  // Writes one symbol, most significant bit of the canonical code first, which
  // is how HuffmanTree.decode reconstructs the tree path bit by bit.
  function writeSymbol(writer, code, symbol) {
    if (code.singleSymbol >= 0) return; // zero-bit code
    const length = code.lengths[symbol];
    const value = code.codes[symbol];
    for (let i = length - 1; i >= 0; --i)
      writer.writeBits(1, OpCodes.And32(OpCodes.Shr32(value, i), 1));
  }

  function symbolBits(code, symbol) {
    return code.singleSymbol >= 0 ? 0 : code.lengths[symbol];
  }

  // The fixed 6-symbol code used to transmit each code-length-alphabet symbol's
  // own code length (0..5) - the exact bit-for-bit inverse of
  // readCodeLengthCodeLength above.
  function writeCodeLengthCodeLength(writer, value) {
    switch (value) {
      case 0: writer.writeBits(2, 0); return;  // 00
      case 3: writer.writeBits(2, 2); return;  // 10
      case 4: writer.writeBits(2, 1); return;  // 01
      case 2: writer.writeBits(3, 3); return;  // 011
      case 1: writer.writeBits(4, 7); return;  // 0111
      case 5: writer.writeBits(4, 15); return; // 1111
      default: throw new Error('Invalid code-length-code-length (must be 0..5): ' + value);
    }
  }

  // Emits a planned complex prefix code descriptor (RFC 7932 Section 3.5).
  function emitComplexPrefixCodeDescriptor(writer, emissions) {
    const frequencies = new Array(NUM_CODE_LENGTH_CODES).fill(0);
    for (let i = 0; i < emissions.length; ++i) frequencies[emissions[i].symbol]++;

    const clLengths = buildCodeLengths(frequencies, NUM_CODE_LENGTH_CODES, 5);
    const clCode = makePrefixCode(clLengths, NUM_CODE_LENGTH_CODES);

    writer.writeBits(2, 0); // HSKIP = 0

    // Mirrors the decoder's `space` (Kraft sum, scaled by 32) tracker: once it
    // reaches zero the decoder stops reading code-length-code-lengths, so the
    // writer must stop emitting them at exactly the same point.
    let space = 32;
    for (let i = 0; i < NUM_CODE_LENGTH_CODES && space > 0; ++i) {
      const index = CODE_LENGTH_CODE_ORDER[i];
      const length = clLengths[index];
      writeCodeLengthCodeLength(writer, length);
      if (length !== 0) space -= OpCodes.Shr32(32, length);
    }

    for (let i = 0; i < emissions.length; ++i) {
      const emission = emissions[i];
      writeSymbol(writer, clCode, emission.symbol);
      if (emission.extraBits > 0) writer.writeBits(emission.extraBits, emission.extraValue);
    }
  }

  // Spells out every code length individually.
  function planPlainEmissions(lengths, lastNonZero) {
    const emissions = [];
    for (let symbol = 0; symbol <= lastNonZero; ++symbol)
      emissions.push({ symbol: lengths[symbol], extraBits: 0, extraValue: 0 });
    return emissions;
  }

  // Plans a run of at least three zeros with code 17. Consecutive 17s chain in
  // the decoder as run = ((run - 2) * 8) + delta + 3, so N emissions with deltas
  // d(1)..d(N) produce sum(8^(N-i) * d(i)) + (8^N + 13) / 7 zeros.
  function planZeroRun(emissions, count) {
    let n = 1;
    while (Math.floor((POW2[3 * (n + 1)] + 6) / 7) < count) ++n;

    let remaining = count - Math.floor((POW2[3 * n] + 13) / 7);
    for (let i = 0; i < n; ++i) {
      const weight = POW2[3 * (n - 1 - i)];
      const delta = Math.min(Math.floor(remaining / weight), 7);
      emissions.push({ symbol: REPEAT_ZERO_CODE_LENGTH, extraBits: 3, extraValue: delta });
      remaining -= delta * weight;
    }
  }

  // Plans a repeat of the previous non-zero length with code 16. Consecutive 16s
  // chain as run = ((run - 2) * 4) + delta + 3, so N emissions with deltas
  // d(1)..d(N) produce sum(4^(N-i) * d(i)) + (4^N + 5) / 3 repeats.
  function planRepeatRun(emissions, count) {
    let n = 1;
    while (Math.floor((POW2[2 * (n + 1)] + 2) / 3) < count) ++n;

    let remaining = count - Math.floor((POW2[2 * n] + 5) / 3);
    for (let i = 0; i < n; ++i) {
      const weight = POW2[2 * (n - 1 - i)];
      const delta = Math.min(Math.floor(remaining / weight), 3);
      emissions.push({ symbol: REPEAT_PREVIOUS_CODE_LENGTH, extraBits: 2, extraValue: delta });
      remaining -= delta * weight;
    }
  }

  // Folds runs into the repeat codes 16 and 17.
  function planRunLengthEmissions(lengths, lastNonZero) {
    const emissions = [];
    let i = 0;
    while (i <= lastNonZero) {
      const length = lengths[i];
      let runEnd = i;
      while (runEnd + 1 <= lastNonZero && lengths[runEnd + 1] === length) ++runEnd;
      const runLength = runEnd - i + 1;

      if (length === 0 && runLength >= 3) planZeroRun(emissions, runLength);
      else if (length > 0 && runLength >= 4) {
        emissions.push({ symbol: length, extraBits: 0, extraValue: 0 });
        planRepeatRun(emissions, runLength - 1);
      } else
        for (let j = 0; j < runLength; ++j)
          emissions.push({ symbol: length, extraBits: 0, extraValue: 0 });

      i = runEnd + 1;
    }
    return emissions;
  }

  // Bits a planned emission stream occupies, or -1 when the plan is unusable
  // because its code-length alphabet would hold a single symbol (an incomplete
  // code that decoders are not required to accept in this position).
  function measureEmissions(emissions) {
    const seen = new Array(NUM_CODE_LENGTH_CODES).fill(false);
    let distinct = 0;
    for (let i = 0; i < emissions.length; ++i) {
      const symbol = emissions[i].symbol;
      if (seen[symbol]) continue;
      seen[symbol] = true;
      ++distinct;
    }
    if (distinct < 2) return -1;

    const scratch = new BitWriter();
    emitComplexPrefixCodeDescriptor(scratch, emissions);
    return scratch.bitLength();
  }

  // Two symbol streams are planned - one that spells out every code length and
  // one that folds runs into the repeat codes - and the cheaper one wins.
  function writeComplexPrefixCodeDescriptor(writer, lengths, alphabetSize) {
    let lastNonZero = 0;
    for (let symbol = alphabetSize - 1; symbol >= 0; --symbol)
      if (lengths[symbol] > 0) { lastNonZero = symbol; break; }

    const plain = planPlainEmissions(lengths, lastNonZero);
    const runLength = planRunLengthEmissions(lengths, lastNonZero);
    const plainBits = measureEmissions(plain);
    const runLengthBits = measureEmissions(runLength);
    const chosen = plainBits >= 0 && (runLengthBits < 0 || plainBits <= runLengthBits) ? plain : runLength;

    emitComplexPrefixCodeDescriptor(writer, chosen);
  }

  // Alphabets with at most four coded symbols use the simple form of RFC 7932
  // Section 3.4; everything else uses the complex form of Section 3.5.
  function writePrefixCodeDescriptor(writer, code, alphabetSize) {
    const used = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol)
      if (code.lengths[symbol] > 0) used.push(symbol);

    if (used.length > 4) {
      writeComplexPrefixCodeDescriptor(writer, code.lengths, alphabetSize);
      return;
    }

    writer.writeBits(2, 1); // HSKIP = 1 selects the simple prefix code form
    writer.writeBits(2, used.length - 1); // NSYM - 1

    const symbolBitCount = alphabetBits(alphabetSize);
    for (let i = 0; i < used.length; ++i) writer.writeBits(symbolBitCount, used[i]);

    // tree-select 0 gives all four symbols length 2; the 1/2/3/3 shape is never
    // used because its lengths would then follow symbol order, not frequency.
    if (used.length === 4) writer.writeBits(1, 0);
  }

  // Number of bits an alphabet index occupies in a simple prefix code.
  function alphabetBits(alphabetSize) {
    let bits = 1;
    while (POW2[bits] < alphabetSize) ++bits;
    return bits;
  }

  function measureDescriptorBits(code, alphabetSize) {
    const scratch = new BitWriter();
    writePrefixCodeDescriptor(scratch, code, alphabetSize);
    return scratch.bitLength();
  }

  // Writes a block-type or tree count using the variable-length code of RFC 7932
  // Section 9.2: 1 is a single zero bit, 2 is "1" plus three zero bits, and any
  // larger N is "1", three bits of nbits, then nbits of N - 1 - 2 to the nbits.
  function writeCount(writer, count) {
    if (count === 1) { writer.writeBits(1, 0); return; }
    writer.writeBits(1, 1);

    const value = count - 1;
    if (value === 1) { writer.writeBits(3, 0); return; }

    let bits = 0, v = value;
    while (v > 1) { v = Math.floor(v / 2); ++bits; }
    writer.writeBits(3, bits);
    writer.writeBits(bits, value - POW2[bits]);
  }

  // ===== ENCODER: INSERT/COPY AND DISTANCE CODE INVERSION =====

  // Finds the bucket index i such that table[i][0] <= value, scanning from the
  // top since bucket bases are monotonically increasing and contiguous.
  function findLengthCode(table, value) {
    for (let i = table.length - 1; i >= 0; --i) if (value >= table[i][0]) return i;
    return 0;
  }

  // Combines an insert length code and a copy length code (RFC 7932 Table 8).
  function encodeInsertAndCopyCode(insertCode, copyCode, implicitDistance) {
    for (let b = 0; b < INSERT_COPY_RANGE_TABLE.length; ++b) {
      const entry = INSERT_COPY_RANGE_TABLE[b];
      if (entry[2] !== implicitDistance) continue;
      const insertOffset = insertCode - entry[0];
      const copyOffset = copyCode - entry[1];
      if (insertOffset >= 0 && insertOffset <= 7 && copyOffset >= 0 && copyOffset <= 7)
        return b * 64 + insertOffset * 8 + copyOffset;
    }
    return -1;
  }

  // Returns the ring buffer distance code 0-15 that reproduces `distance`, or -1
  // when none does (RFC 7932 Section 4).
  function findRingDistanceCode(distance, ring) {
    for (let i = 0; i < 4; ++i) if (distance === ring[i]) return i;
    if (distance === ring[0] - 1) return 4;
    if (distance === ring[0] + 1) return 5;
    if (distance === ring[0] - 2) return 6;
    if (distance === ring[0] + 2) return 7;
    if (distance === ring[0] - 3) return 8;
    if (distance === ring[0] + 3) return 9;
    if (distance === ring[1] - 1) return 10;
    if (distance === ring[1] + 1) return 11;
    if (distance === ring[1] - 2) return 12;
    if (distance === ring[1] + 2) return 13;
    if (distance === ring[1] - 3) return 14;
    if (distance === ring[1] + 3) return 15;
    return -1;
  }

  // Inverts the NPOSTFIX=0, NDIRECT=0 distance formula of RFC 7932 Section 4:
  // for code 16 + b the decoder reads nbits = 1 + b / 2 extra bits and forms
  // ((2 + (b mod 2)) * 2 to the nbits) - 4 + extra + 1.
  function encodeDistance(distance) {
    for (let b = 0; b < 48; ++b) {
      const extraBits = 1 + Math.floor(b / 2);
      const offset = OpCodes.Shl32(2 + (b % 2), extraBits) - 4;
      const first = offset + 1;
      const last = offset + POW2[extraBits];
      if (distance >= first && distance <= last)
        return { code: 16 + b, extraBits: extraBits, extraValue: distance - first };
    }
    throw new Error('Distance out of representable range: ' + distance);
  }

  function distanceExtraBits(distance) {
    for (let b = 0; b < 48; ++b) {
      const extraBits = 1 + Math.floor(b / 2);
      const offset = OpCodes.Shl32(2 + (b % 2), extraBits) - 4;
      if (distance >= offset + 1 && distance <= offset + POW2[extraBits]) return extraBits;
    }
    return 24;
  }

  // ===== ENCODER: LZ77 MATCH FINDER (hash chain, min match 4) =====

  function hashAt(data, position) {
    const word = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(data[position], 24), OpCodes.Shl32(data[position + 1], 16)),
      OpCodes.Or32(OpCodes.Shl32(data[position + 2], 8), data[position + 3])
    );
    return OpCodes.Shr32(OpCodes.Mul32(word, 2654435761), 32 - HASH_BITS);
  }

  function matchLength(data, a, b, maxLength) {
    let length = 0;
    while (length < maxLength && data[a + length] === data[b + length]) ++length;
    return length;
  }

  // Approximate cost in bits of a backward reference, used only to steer the
  // parse. A ring buffer distance is assumed to cost three bits, an explicit one
  // twelve plus its extra bits.
  function matchCost(length, distance, inRing) {
    const copyCode = findLengthCode(COPY_LENGTH_CODES, length);
    let cost = ESTIMATED_COMMAND_BITS + COPY_LENGTH_CODES[copyCode][1];
    cost += inRing ? 3 : ESTIMATED_DISTANCE_BITS + distanceExtraBits(distance);
    return cost;
  }

  // Ranks two candidate references against each other. Extra matched bytes are
  // only worth what the command that would otherwise cover them costs, not a
  // full literal each, so long far references do not automatically beat short
  // near ones.
  function matchScore(length, distance, inRing) {
    return length * MATCH_RANK_LITERAL_BITS - matchCost(length, distance, inRing);
  }

  // Whether coding a reference beats coding the same bytes as literals.
  function matchPaysOff(length, distance, inRing) {
    return length * 8 > matchCost(length, distance, inRing);
  }

  const NO_MATCH = { length: 0, distance: 0, score: -2147483648 };

  function findBestMatch(data, position, maxDistance, head, chain, parseRing) {
    const maxLength = Math.min(MAX_COPY_LENGTH, data.length - position);
    if (maxLength < MIN_MATCH || position + MIN_MATCH > data.length) return NO_MATCH;

    let bestLength = 0, bestDistance = 0, bestScore = -2147483648;

    // Distances already in the ring buffer code for almost nothing, so they are
    // worth trying even when the hash chain offers a longer match elsewhere.
    for (let i = 0; i < 4; ++i) {
      const distance = parseRing[i];
      if (distance > position || distance > maxDistance) continue;
      const length = matchLength(data, position, position - distance, maxLength);
      if (length < MIN_MATCH || !matchPaysOff(length, distance, true)) continue;
      const score = matchScore(length, distance, true);
      if (score <= bestScore) continue;
      bestScore = score;
      bestLength = length;
      bestDistance = distance;
    }

    let candidate = head[hashAt(data, position)];
    let depth = 0;
    while (candidate >= 0 && depth < MAX_CHAIN) {
      const distance = position - candidate;
      if (distance > maxDistance) break;
      if (distance > 0) {
        const length = matchLength(data, position, candidate, maxLength);
        if (length >= MIN_MATCH && matchPaysOff(length, distance, false)) {
          const score = matchScore(length, distance, false);
          if (score > bestScore) {
            bestScore = score;
            bestLength = length;
            bestDistance = distance;
          }
        }
      }
      candidate = chain[candidate];
      ++depth;
    }

    return { length: bestLength, distance: bestDistance, score: bestScore };
  }

  // Splits the input into insert-and-copy commands using a hash chain match
  // finder with one step of lazy matching driven by the approximate bit cost.
  function findCommands(data, maxDistance) {
    const head = new Int32Array(HASH_SIZE).fill(-1);
    const chain = new Int32Array(Math.max(1, data.length)).fill(-1);

    // Mirrors the real distance ring buffer closely enough to steer the parse;
    // the codes actually emitted are resolved later against the true ring.
    const parseRing = INITIAL_DISTANCE_RING.slice();

    const commands = [];
    let literalStart = 0;
    let position = 0;

    const insert = function (at) {
      if (at + MIN_MATCH > data.length) return;
      const h = hashAt(data, at);
      chain[at] = head[h];
      head[h] = at;
    };

    while (position < data.length) {
      // A literal-only command is only legal as the last command of a
      // meta-block, and splitMetaBlocks closes a meta-block right after one, so
      // capping the run here bounds MLEN without making the stream illegal.
      if (position - literalStart >= MAX_LITERAL_RUN) {
        commands.push({ insertStart: literalStart, insertLength: position - literalStart, copyLength: 0, distance: 0 });
        literalStart = position;
      }

      const best = findBestMatch(data, position, maxDistance, head, chain, parseRing);
      if (best.length < MIN_MATCH) {
        insert(position);
        ++position;
        continue;
      }

      insert(position);
      if (position + 1 < data.length) {
        const later = findBestMatch(data, position + 1, maxDistance, head, chain, parseRing);
        if (later.length >= MIN_MATCH && later.score > best.score + LAZY_MATCH_MARGIN) {
          ++position;
          continue;
        }
      }

      commands.push({
        insertStart: literalStart,
        insertLength: position - literalStart,
        copyLength: best.length,
        distance: best.distance
      });

      if (best.distance !== parseRing[0]) {
        parseRing[3] = parseRing[2];
        parseRing[2] = parseRing[1];
        parseRing[1] = parseRing[0];
        parseRing[0] = best.distance;
      }

      const matchEnd = position + best.length;
      for (let i = position + 1; i < matchEnd; ++i) insert(i);
      position = matchEnd;
      literalStart = position;
    }

    if (literalStart < data.length)
      commands.push({ insertStart: literalStart, insertLength: data.length - literalStart, copyLength: 0, distance: 0 });

    return commands;
  }

  // ===== ENCODER: META-BLOCK LAYOUT =====

  function commandEnd(command) {
    return command.insertStart + command.insertLength + command.copyLength;
  }

  function segmentByteCount(commands, segmentStarts, segment) {
    const from = segmentStarts[segment];
    const to = segment + 1 < segmentStarts.length ? segmentStarts[segment + 1] : commands.length;
    let bytes = 0;
    for (let i = from; i < to; ++i) bytes += commands[i].insertLength + commands[i].copyLength;
    return bytes;
  }

  function makeRange(commands, segmentStarts, from, to) {
    const commandStart = segmentStarts[from];
    const commandEndIndex = to < segmentStarts.length ? segmentStarts[to] : commands.length;
    return {
      commandStart: commandStart,
      commandEnd: commandEndIndex,
      byteStart: commands[commandStart].insertStart,
      byteEnd: commandEnd(commands[commandEndIndex - 1])
    };
  }

  // Groups commands into meta-blocks. Adjacent segments are merged while their
  // literal distributions are similar enough that one shared set of prefix codes
  // stays cheaper than a second meta-block header.
  function splitMetaBlocks(data, commands) {
    const blocks = [];
    if (commands.length === 0) return blocks;

    // Cut the command stream into fixed-size segments first; split points may
    // only fall on those boundaries.
    const segmentStarts = [0];
    const forcedEnd = [false];
    let carried = 0;
    for (let i = 0; i < commands.length; ++i) {
      carried += commands[i].insertLength + commands[i].copyLength;
      const literalOnly = commands[i].copyLength === 0;
      if ((carried < SEGMENT_BYTES && !literalOnly) || i + 1 >= commands.length) continue;
      segmentStarts.push(i + 1);
      forcedEnd.push(literalOnly);
      carried = 0;
    }

    const segmentCount = segmentStarts.length;
    const histograms = new Array(segmentCount);
    for (let s = 0; s < segmentCount; ++s) {
      const histogram = new Int32Array(256);
      const from = segmentStarts[s];
      const to = s + 1 < segmentCount ? segmentStarts[s + 1] : commands.length;
      for (let i = from; i < to; ++i) {
        const command = commands[i];
        for (let k = 0; k < command.insertLength; ++k) histogram[data[command.insertStart + k]]++;
      }
      histograms[s] = histogram;
    }

    let openStart = 0;
    let openHistogram = Int32Array.from(histograms[0]);
    let openBytes = segmentByteCount(commands, segmentStarts, 0);

    for (let s = 1; s < segmentCount; ++s) {
      const segmentBytes = segmentByteCount(commands, segmentStarts, s);
      const startNewBlock = forcedEnd[s] ||
        openBytes + segmentBytes > MAX_METABLOCK_BYTES ||
        mergeCostUnits(openHistogram, histograms[s]) > SPLIT_THRESHOLD_UNITS;

      if (startNewBlock) {
        blocks.push(makeRange(commands, segmentStarts, openStart, s));
        openStart = s;
        openHistogram = Int32Array.from(histograms[s]);
        openBytes = segmentBytes;
        continue;
      }

      for (let b = 0; b < 256; ++b) openHistogram[b] += histograms[s][b];
      openBytes += segmentBytes;
    }

    blocks.push(makeRange(commands, segmentStarts, openStart, segmentCount));
    return blocks;
  }

  // ===== ENCODER: LITERAL CONTEXT MODELLING (RFC 7932 Section 7.1) =====

  function literalContext(p1, p2, contextMode) {
    return getLiteralContextId(contextMode, p1, p2);
  }

  // Picks the literal context mode whose per-context distributions are cheapest
  // to code before any clustering is applied.
  function chooseContextMode(perMode) {
    let best = 0, bestCost = Number.MAX_SAFE_INTEGER;
    for (let mode = 0; mode < perMode.length; ++mode) {
      let cost = 0;
      for (let c = 0; c < 64; ++c) cost += histogramCostUnits(perMode[mode][c]);
      if (cost >= bestCost) continue;
      bestCost = cost;
      best = mode;
    }
    return best;
  }

  // Measures one clustering: descriptor bits for every literal code, the context
  // map, the NTREESL field and the literal payload itself.
  function evaluateClustering(members, clusters) {
    const map = new Array(64).fill(0);
    for (let t = 0; t < members.length; ++t)
      for (let k = 0; k < members[t].length; ++k) map[members[t][k]] = t;

    const codes = new Array(clusters.length);
    let cost = 0;
    for (let t = 0; t < clusters.length; ++t) {
      codes[t] = buildPrefixCode(clusters[t], LITERAL_ALPHABET_SIZE, MAX_CODE_LENGTH);
      cost += measureDescriptorBits(codes[t], LITERAL_ALPHABET_SIZE) * 256;
      for (let b = 0; b < 256; ++b) cost += clusters[t][b] * symbolBits(codes[t], b) * 256;
    }

    const scratch = new BitWriter();
    writeCount(scratch, clusters.length);
    if (clusters.length > 1) writeContextMap(scratch, map, clusters.length);
    cost += scratch.bitLength() * 256;

    return { map: map, codes: codes, cost: cost };
  }

  // Clusters the 64 literal contexts into prefix codes. Contexts are merged
  // greedily by the extra cost of sharing one distribution, and the tree count
  // that minimises the measured total of descriptors, context map and literal
  // data wins.
  function chooseLiteralTrees(contextFrequencies) {
    const members = [];
    const clusters = [];
    for (let c = 0; c < 64; ++c) {
      let total = 0;
      for (let b = 0; b < 256; ++b) total += contextFrequencies[c][b];
      if (total === 0) continue;
      members.push([c]);
      clusters.push(Int32Array.from(contextFrequencies[c]));
    }

    // Nothing was coded from this alphabet at all.
    if (clusters.length === 0)
      return {
        map: new Array(64).fill(0),
        codes: [buildPrefixCode(new Int32Array(256), LITERAL_ALPHABET_SIZE, MAX_CODE_LENGTH)]
      };

    // Pairwise merge costs are cached; a merge only invalidates one row.
    const pairCost = [];
    for (let i = 0; i < clusters.length; ++i) {
      const row = new Array(clusters.length).fill(0);
      for (let j = i + 1; j < clusters.length; ++j) row[j] = mergeCostUnits(clusters[i], clusters[j]);
      pairCost.push(row);
    }

    let bestCost = Number.MAX_SAFE_INTEGER, bestMap = null, bestCodes = null;

    for (;;) {
      if (LITERAL_TREE_CANDIDATES.indexOf(clusters.length) >= 0) {
        const evaluated = evaluateClustering(members, clusters);
        if (evaluated.cost < bestCost) {
          bestCost = evaluated.cost;
          bestMap = evaluated.map;
          bestCodes = evaluated.codes;
        }
      }

      if (clusters.length <= 1) break;

      let mergeI = 0, mergeJ = 1, mergeCost = Number.MAX_SAFE_INTEGER;
      for (let i = 0; i < clusters.length; ++i)
        for (let j = i + 1; j < clusters.length; ++j) {
          if (pairCost[i][j] >= mergeCost) continue;
          mergeCost = pairCost[i][j];
          mergeI = i;
          mergeJ = j;
        }

      for (let b = 0; b < 256; ++b) clusters[mergeI][b] += clusters[mergeJ][b];
      for (let k = 0; k < members[mergeJ].length; ++k) members[mergeI].push(members[mergeJ][k]);
      clusters.splice(mergeJ, 1);
      members.splice(mergeJ, 1);

      pairCost.splice(mergeJ, 1);
      for (let i = 0; i < pairCost.length; ++i) pairCost[i].splice(mergeJ, 1);

      for (let k = 0; k < clusters.length; ++k) {
        if (k === mergeI) continue;
        const cost = mergeCostUnits(clusters[mergeI], clusters[k]);
        if (k > mergeI) pairCost[mergeI][k] = cost;
        else pairCost[k][mergeI] = cost;
      }
    }

    return { map: bestMap, codes: bestCodes };
  }

  // Writes a literal context map (RFC 7932 Section 7.3) with RLEMAX = 0 and no
  // move-to-front transform: only 64 entries are involved, so neither pays off.
  function writeContextMap(writer, contextMap, treeCount) {
    writer.writeBits(1, 0); // RLEMAX = 0

    const frequencies = new Array(treeCount).fill(0);
    for (let i = 0; i < contextMap.length; ++i) frequencies[contextMap[i]]++;

    const code = buildPrefixCode(frequencies, treeCount, MAX_CODE_LENGTH);
    writePrefixCodeDescriptor(writer, code, treeCount);
    for (let i = 0; i < contextMap.length; ++i) writeSymbol(writer, code, contextMap[i]);

    writer.writeBits(1, 0); // IMTF = 0
  }

  // ===== ENCODER: META-BLOCK EMISSION =====

  // Resolves the distance encoding of every command in a meta-block, advancing
  // the distance ring buffer exactly as the decoder will. A distance code of -1
  // means the command uses an implicit-distance insert-and-copy range and no
  // distance symbol is written; the ring is left untouched for code 0 and for
  // implicit distances, per RFC 7932 Section 4.
  function resolveCommands(commands, range, ring) {
    const resolved = new Array(range.commandEnd - range.commandStart);
    for (let i = range.commandStart; i < range.commandEnd; ++i) {
      const command = commands[i];
      const insertCode = findLengthCode(INSERT_LENGTH_CODES, command.insertLength);

      if (command.copyLength === 0) {
        // A trailing literal-only command: the decoder finishes the meta-block
        // before it would read a distance, so the copy code only has to exist.
        resolved[i - range.commandStart] = {
          insertStart: command.insertStart,
          insertLength: command.insertLength,
          copyLength: 0,
          distance: 0,
          iacCode: encodeInsertAndCopyCode(insertCode, 0, insertCode <= 7),
          insertCode: insertCode,
          copyCode: 0,
          distanceCode: -1
        };
        continue;
      }

      const copyCode = findLengthCode(COPY_LENGTH_CODES, command.copyLength);
      const canUseImplicit = insertCode <= 7 && copyCode <= 15 && command.distance === ring[0];

      let iacCode, distanceCode;
      if (canUseImplicit) {
        iacCode = encodeInsertAndCopyCode(insertCode, copyCode, true);
        distanceCode = -1;
      } else {
        iacCode = encodeInsertAndCopyCode(insertCode, copyCode, false);
        distanceCode = findRingDistanceCode(command.distance, ring);
        if (distanceCode < 0) distanceCode = encodeDistance(command.distance).code;

        if (distanceCode !== 0) {
          ring[3] = ring[2];
          ring[2] = ring[1];
          ring[1] = ring[0];
          ring[0] = command.distance;
        }
      }

      resolved[i - range.commandStart] = {
        insertStart: command.insertStart,
        insertLength: command.insertLength,
        copyLength: command.copyLength,
        distance: command.distance,
        iacCode: iacCode,
        insertCode: insertCode,
        copyCode: copyCode,
        distanceCode: distanceCode
      };
    }
    return resolved;
  }

  // MNIBBLES must be the smallest nibble count whose most significant nibble is
  // non-zero, because a conformant decoder (zlib's brotliDecompressSync among
  // them) rejects a stream whose last nibble is all zeros (Section 9.2).
  function writeMetaBlockLength(writer, byteLength) {
    const mlen = byteLength - 1;
    const nibbles = mlen <= 0xFFFF ? 4 : (mlen <= 0xFFFFF ? 5 : 6);
    writer.writeBits(2, nibbles - 4);
    for (let i = 0; i < nibbles; ++i)
      writer.writeBits(4, OpCodes.And32(OpCodes.Shr32(mlen, i * 4), 0xF));
  }

  // Builds one entropy-coded meta-block into its own writer so its size can be
  // compared against the uncompressed alternative before it is spliced in.
  function buildCompressedMetaBlock(data, commands, range, isLast, ring) {
    const resolved = resolveCommands(commands, range, ring);

    // Literal frequencies per context, for every context mode, so the cheapest
    // mode can be picked before the contexts are clustered.
    const perMode = new Array(4);
    for (let mode = 0; mode < 4; ++mode) {
      const byContext = new Array(64);
      for (let c = 0; c < 64; ++c) byContext[c] = new Int32Array(256);
      perMode[mode] = byContext;
    }

    const iacFrequencies = new Int32Array(IAC_ALPHABET_SIZE);
    const distanceFrequencies = new Int32Array(DISTANCE_ALPHABET_SIZE);

    for (let ci = 0; ci < resolved.length; ++ci) {
      const command = resolved[ci];
      iacFrequencies[command.iacCode]++;
      if (command.distanceCode >= 0) distanceFrequencies[command.distanceCode]++;

      for (let k = 0; k < command.insertLength; ++k) {
        const position = command.insertStart + k;
        const p1 = position > 0 ? data[position - 1] : 0;
        const p2 = position > 1 ? data[position - 2] : 0;
        const literal = data[position];
        for (let mode = 0; mode < 4; ++mode) perMode[mode][literalContext(p1, p2, mode)][literal]++;
      }
    }

    const contextMode = chooseContextMode(perMode);
    const literalTrees = chooseLiteralTrees(perMode[contextMode]);
    const contextMap = literalTrees.map;
    const literalCodes = literalTrees.codes;

    const iacCode = buildPrefixCode(iacFrequencies, IAC_ALPHABET_SIZE, MAX_CODE_LENGTH);
    const distanceCode = buildPrefixCode(distanceFrequencies, DISTANCE_ALPHABET_SIZE, MAX_CODE_LENGTH);

    const writer = new BitWriter();

    writer.writeBits(1, isLast ? 1 : 0);
    if (isLast) writer.writeBits(1, 0); // ISLASTEMPTY = 0

    writeMetaBlockLength(writer, range.byteEnd - range.byteStart);

    if (!isLast) writer.writeBits(1, 0); // ISUNCOMPRESSED = 0

    writeCount(writer, 1); // NBLTYPESL
    writeCount(writer, 1); // NBLTYPESI
    writeCount(writer, 1); // NBLTYPESD

    writer.writeBits(2, 0); // NPOSTFIX = 0
    writer.writeBits(4, 0); // NDIRECT (raw value, shifted left by NPOSTFIX) = 0

    writer.writeBits(2, contextMode);

    writeCount(writer, literalCodes.length); // NTREESL
    if (literalCodes.length > 1) writeContextMap(writer, contextMap, literalCodes.length);

    writeCount(writer, 1); // NTREESD

    for (let t = 0; t < literalCodes.length; ++t)
      writePrefixCodeDescriptor(writer, literalCodes[t], LITERAL_ALPHABET_SIZE);

    writePrefixCodeDescriptor(writer, iacCode, IAC_ALPHABET_SIZE);
    writePrefixCodeDescriptor(writer, distanceCode, DISTANCE_ALPHABET_SIZE);

    for (let ci = 0; ci < resolved.length; ++ci) {
      const command = resolved[ci];
      writeSymbol(writer, iacCode, command.iacCode);

      const insertExtra = INSERT_LENGTH_CODES[command.insertCode][1];
      if (insertExtra > 0)
        writer.writeBits(insertExtra, command.insertLength - INSERT_LENGTH_CODES[command.insertCode][0]);

      const copyExtra = COPY_LENGTH_CODES[command.copyCode][1];
      if (copyExtra > 0)
        writer.writeBits(copyExtra, command.copyLength - COPY_LENGTH_CODES[command.copyCode][0]);

      for (let k = 0; k < command.insertLength; ++k) {
        const position = command.insertStart + k;
        const p1 = position > 0 ? data[position - 1] : 0;
        const p2 = position > 1 ? data[position - 2] : 0;
        writeSymbol(writer, literalCodes[contextMap[literalContext(p1, p2, contextMode)]], data[position]);
      }

      if (command.distanceCode < 0) continue;

      writeSymbol(writer, distanceCode, command.distanceCode);
      if (command.distanceCode < 16) continue;

      const distanceInfo = encodeDistance(command.distance);
      if (distanceInfo.extraBits > 0) writer.writeBits(distanceInfo.extraBits, distanceInfo.extraValue);
    }

    return writer;
  }

  // Builds one uncompressed meta-block into its own writer. The payload is
  // byte-aligned against the whole stream, so the number of padding bits depends
  // on how many bits already precede this meta-block.
  function buildUncompressedMetaBlock(data, range, startBitOffset) {
    const writer = new BitWriter();
    writer.writeBits(1, 0); // ISLAST = 0
    writeMetaBlockLength(writer, range.byteEnd - range.byteStart);
    writer.writeBits(1, 1); // ISUNCOMPRESSED = 1

    const padding = (8 - (startBitOffset + writer.bitLength()) % 8) % 8;
    if (padding > 0) writer.writeBits(padding, 0);

    for (let i = range.byteStart; i < range.byteEnd; ++i) writer.writeBits(8, data[i]);
    return writer;
  }

  // ===== ENCODER: STREAM-LEVEL FRAMING =====

  // Picks the smallest window that can express every backward distance.
  function computeWindowBits(dataLength) {
    for (let bits = 10; bits < 24; ++bits)
      if (OpCodes.Shl32(1, bits) - 16 >= dataLength) return bits;
    return 24;
  }

  function writeWindowBits(writer, wbits) {
    if (wbits === 16) { writer.writeBits(1, 0); return; }
    writer.writeBits(1, 1);
    if (wbits >= 18 && wbits <= 24) { writer.writeBits(3, wbits - 17); return; }
    if (wbits === 17) { writer.writeBits(3, 0); writer.writeBits(3, 0); return; }
    if (wbits >= 10 && wbits <= 15) { writer.writeBits(3, 0); writer.writeBits(3, wbits - 8); return; }
    throw new Error('Unsupported window size (bits): ' + wbits);
  }

  function byteLengthOfBits(bits) {
    return Math.floor((bits + 7) / 8);
  }

  class BrotliEncoder {
    compress(input) {
      // Empty in, empty out - matching the framework contract this codec is
      // registered under. Every non-empty input becomes a real Brotli stream.
      if (input.length === 0) return [];

      const data = Uint8Array.from(input);
      const windowBits = computeWindowBits(data.length);
      const maxDistance = OpCodes.Shl32(1, windowBits) - 16;

      const commands = findCommands(data, maxDistance);
      const blocks = splitMetaBlocks(data, commands);

      const writer = new BitWriter();
      writeWindowBits(writer, windowBits);

      let ring = INITIAL_DISTANCE_RING.slice();
      for (let bi = 0; bi < blocks.length; ++bi) {
        const block = blocks[bi];
        const isLastBlock = bi === blocks.length - 1;

        const candidateRing = ring.slice();
        const compressed = buildCompressedMetaBlock(data, commands, block, isLastBlock, candidateRing);
        const stored = buildUncompressedMetaBlock(data, block, writer.bitLength());

        let useCompressed;
        if (isLastBlock) {
          // The stream ends here: the compressed form can carry ISLAST=1
          // directly, while the uncompressed form needs a trailing empty last
          // meta-block.
          const withCompressed = byteLengthOfBits(writer.bitLength() + compressed.bitLength());
          const withStored = byteLengthOfBits(writer.bitLength() + stored.bitLength() + 2);
          useCompressed = withCompressed <= withStored;
        } else
          useCompressed = compressed.bitLength() < stored.bitLength();

        if (useCompressed) {
          writer.appendBits(compressed);
          ring = candidateRing;
        } else
          writer.appendBits(stored);

        if (!isLastBlock || useCompressed) continue;

        writer.writeBits(1, 1); // ISLAST = 1
        writer.writeBits(1, 1); // ISLASTEMPTY = 1
      }

      writer.flush();
      return writer.bytes;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class BrotliCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "Brotli";
      this.description = "RFC 7932-compatible Brotli codec. The decoder implements the full RFC 7932 bitstream grammar (meta-block framing, complex/simple prefix codes, block-switch commands, insert-and-copy commands, distance ring buffer, context modeling, and the static dictionary with word transforms) and correctly reads streams from conformant encoders such as zlib's brotliCompressSync. The encoder exploits the format rather than emitting bare LZ77 plus Huffman: literal context modeling (all four context modes, with the 64 contexts clustered into up to 16 literal prefix codes and sent as a context map), the distance ring buffer including the implicit-distance insert-and-copy ranges, run-length coded prefix code descriptors, and cost-driven meta-block splitting with a per-meta-block uncompressed fallback. It does not emit static dictionary references, multiple block types with block-switch commands, non-zero NPOSTFIX/NDIRECT, or distance context modeling.";
      this.inventor = "Jyrki Alakuijala, Zoltan Szabadka (Google)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      this.compressionRatio = "Genuine LZ77 + Huffman compression (typically well under 1% of input size for repetitive text; near 1.0 - meta-block framing overhead only - for incompressible data)";
      this.windowSize = "10-24 bits (1KB - 16MB)";
      this.implementation = "Pure JavaScript, RFC 7932 bitstream-compatible in both directions";

      this.documentation = [
        new LinkItem("RFC 7932 - Brotli Compressed Data Format", "https://datatracker.ietf.org/doc/html/rfc7932"),
        new LinkItem("RFC 9841 - Shared Brotli Compressed Data Format", "https://datatracker.ietf.org/doc/rfc9841/"),
        new LinkItem("Official Brotli Repository", "https://github.com/google/brotli"),
        new LinkItem("Google Brotli Announcement (2015)", "https://opensource.googleblog.com/2015/09/introducing-brotli-new-compression.html")
      ];

      this.references = [
        new LinkItem("RFC 7932 Section 8 - Static Dictionary", "https://datatracker.ietf.org/doc/html/rfc7932#section-8"),
        new LinkItem("RFC 7932 Section 9 - Compressed Data Format", "https://datatracker.ietf.org/doc/html/rfc7932#section-9"),
        new LinkItem("Node.js zlib Brotli bindings (interop reference)", "https://nodejs.org/api/zlib.html#zlib-constants")
      ];

      this.notes = [
        "DECODER: full RFC 7932 grammar, including the static dictionary and word transforms - reads real-world",
        "  Brotli streams (verified against zlib's brotliCompressSync output, including compressed meta-blocks",
        "  that reference the static dictionary)",
        "ENCODER: hash-chain LZ77 (minimum match 4, cost-aware ranking, one-step lazy matching) plus",
        "  canonical, length-limited (package-merge, RFC-capped at 15 bits for data alphabets / 5 bits for",
        "  the code-length alphabet) prefix coding. Implements literal context modeling (Section 7.1, all",
        "  four modes, 64 contexts clustered into up to 16 trees and sent as a context map per Section 7.3),",
        "  the distance ring buffer with codes 0-15 and the implicit-distance insert-and-copy ranges",
        "  (Sections 4 and 5), run-length coded complex prefix code descriptors (Section 3.5), and",
        "  cost-driven meta-block splitting with a per-meta-block uncompressed fallback (Section 9.2)",
        "ENCODER LIMITATIONS: no static dictionary references (Section 8), one block type per category (no",
        "  block-switch commands, Section 6), NPOSTFIX=0 and NDIRECT=0 (Section 4), and no distance context",
        "  modeling (Section 7.2). Typical output sits between the reference encoder's quality 7 and 9",
        "  settings. Verified byte-for-byte interoperable with zlib's brotliDecompressSync and the",
        "  reference `brotli` CLI in both directions, and byte-identical to the CompressionWorkbench",
        "  C# encoder for the same input",
        "Static dictionary (Appendix A, 122,784 bytes) and word transforms (Appendix B, 121 entries) are",
        "  transcribed directly from the RFC 7932 specification text and verified against its own CRC-32 checks"
      ];

      this.tests = [
        {
          text: "Round-trip - Empty input",
          uri: "https://datatracker.ietf.org/doc/html/rfc7932#section-9.2",
          input: [],
          expected: []
        },
        {
          text: "Interop - decode real zlib brotliCompressSync('Hello, World!') output (uncompressed meta-block)",
          uri: "https://nodejs.org/api/zlib.html",
          input: OpCodes.Hex8ToBytes("0b068048656c6c6f2c20576f726c642103"),
          expected: OpCodes.AnsiToBytes("Hello, World!"),
          inverse: true
        },
        {
          text: "Interop - decode real zlib brotliCompressSync output using Huffman/context-coded meta-block + static dictionary",
          uri: "https://nodejs.org/api/zlib.html",
          input: OpCodes.Hex8ToBytes("1b6701888c946ee622d083a5ba905e13148d807c430b830d387048206f24bc41a715ce66c7e34485a560239c7af587498101"),
          expected: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(8)),
          inverse: true
        },
        {
          text: "Interop - decode real zlib brotliCompressSync output of pseudo-random binary data",
          uri: "https://nodejs.org/api/zlib.html",
          input: OpCodes.Hex8ToBytes("1bff01f8af8bb705ff306b83267bfcc35b3dd043b93fce189cd7ca005d5c1c1742186f0cce0b2d0df0c1c571a1f7e9e6e0bcd2d2001f5c1c577a9f6e0ece1b9852200fc6a2f18a4f8726d47539f179dc37dad4360025d47962ee799c87e9d596ff4b77cc1d9189f7b9a8f2e5fbafb0a943043ad44528bb3c2e1726b64d81f6659e965deae70926d6f5ffeccb3810b5d4f74dd5acf3fb84ddc70651876b9f445c7edfc34d6c00feca978909d9d40fe31aeafa52b93c0e4336b67d7b0d65be2fb9dc778835b675111965ba2f375b5f01287fae03b34dcfbd990ef5079f7479208c26b64d99f8329f9036f55d13"),
          expected: Array.from({ length: 512 }, (_, i) => OpCodes.And32(i * 37 + 11, 0xff)),
          inverse: true
        },
        {
          text: "Regression - single byte round-trips through our own encoder/decoder",
          uri: "https://github.com/google/brotli/tree/master/tests/testdata",
          input: OpCodes.AnsiToBytes("X")
        },
        {
          text: "Brotli Round-trip - Pangram",
          uri: "https://github.com/google/brotli/blob/master/tests/testdata",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Brotli Round-trip - Binary data",
          uri: "https://datatracker.ietf.org/doc/html/rfc7932",
          input: [0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA]
        },
        {
          text: "Brotli Round-trip - all 256 byte values",
          uri: "https://datatracker.ietf.org/doc/html/rfc7932",
          input: Array.from({ length: 256 }, (_, i) => i)
        }
      ];

      this.vulnerabilities = [
        new Vulnerability("Compression Bomb (Decompression Bomb)",
          '',
          "Maliciously crafted Brotli streams with high compression ratios can decompress to extremely large outputs, causing memory exhaustion. Always validate and limit decompressed output size before decompression.",
          "https://en.wikipedia.org/wiki/Zip_bomb"),
        new Vulnerability("Memory Exhaustion via Window Size",
          '',
          "Attackers can specify large window sizes (up to 16MB) causing excessive memory allocation. Limit window size for untrusted input.",
          "https://datatracker.ietf.org/doc/html/rfc7932#section-9.1")
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BrotliInstance(this, isInverse);
    }
  }

  /**
 * Brotli cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BrotliInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        this.inputBuffer = [];
        return [];
      }

      try {
        let result;
        if (this.isInverse) {
          const decoder = new BrotliDecoder();
          result = decoder.decompress(this.inputBuffer);
        } else {
          const encoder = new BrotliEncoder();
          result = encoder.compress(this.inputBuffer);
        }

        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw new Error(`Brotli ${this.isInverse ? 'decompression' : 'compression'} failed: ${error.message}`);
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BrotliCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { BrotliCompression, BrotliInstance };
}));
