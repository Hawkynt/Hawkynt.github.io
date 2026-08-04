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
 * - COMPRESSION performs genuine LZ77 (hash-chain match finder, one-step
 *   lazy matching) plus canonical, length-limited (package-merge) Huffman
 *   coding, emitted as RFC 7932 complex prefix code descriptors (Section
 *   3.5) or - for degenerate single-symbol alphabets - the simple prefix
 *   code's NSYM=1 form (Section 3.4). Uses the simplest legal meta-block
 *   configuration: NBLTYPES=1 for literals/commands/distances (no block-
 *   switch commands), NPOSTFIX=0, NDIRECT=0, a single context mode, and no
 *   static-dictionary references. Each chunk falls back to an uncompressed
 *   meta-block (Section 9.2's ISUNCOMPRESSED=1 form) whenever that would be
 *   smaller. Any compliant Brotli decoder, including zlib's
 *   brotliDecompressSync and the reference `brotli` CLI, accepts the output
 *   byte-for-byte.
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
  // Emits a fully RFC 7932-conformant stream built entirely from uncompressed
  // meta-blocks (Section 9.2's ISUNCOMPRESSED=1 form): a WBITS=16 stream
  // header, one or more <=65536-byte uncompressed meta-blocks (ISLAST=0, so
  // ISUNCOMPRESSED is present and MNIBBLES=4 always suffices for MLEN-1 <=
  // 0xFFFF), followed by a true empty last meta-block (ISLAST=1,
  // ISLASTEMPTY=1). This does not attempt entropy coding, but it is a
  // completely legal Brotli bitstream that any conformant decoder accepts.

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

  // ===== ENCODER: LENGTH-LIMITED CANONICAL HUFFMAN (package-merge) =====
  // Builds prefix-code lengths bounded by maxLen bits via the boundary
  // package-merge algorithm (Larmore and Hirschberg, 1990): the standard
  // technique for optimal length-limited Huffman coding. Needed because RFC
  // 7932 caps code lengths at 15 bits for the data alphabets (Section 3.2)
  // and at 5 bits for the code-length alphabet nested inside a complex
  // prefix code descriptor (Section 3.5) - an unrestricted Huffman build can
  // exceed either limit for skewed frequency distributions.

  function packageMergeLengths(weights, maxLen) {
    const alphabetSize = weights.length;
    const lengths = new Array(alphabetSize).fill(0);

    const used = [];
    for (let s = 0; s < alphabetSize; ++s) if (weights[s] > 0) used.push(s);
    if (used.length === 0) return lengths;
    if (used.length === 1) { lengths[used[0]] = 1; return lengths; }

    const baseItems = used.map(s => ({ weight: weights[s], symbols: [s] }));
    baseItems.sort((a, b) => a.weight - b.weight);

    let list = baseItems;
    for (let level = 2; level <= maxLen; ++level) {
      const packaged = [];
      for (let i = 0; i + 1 < list.length; i += 2) {
        packaged.push({
          weight: list[i].weight + list[i + 1].weight,
          symbols: list[i].symbols.concat(list[i + 1].symbols)
        });
      }
      list = packaged.concat(baseItems);
      list.sort((a, b) => a.weight - b.weight);
    }

    const takeCount = Math.min(2 * used.length - 2, list.length);
    for (let i = 0; i < takeCount; ++i) {
      const symbols = list[i].symbols;
      for (let k = 0; k < symbols.length; ++k) lengths[symbols[k]]++;
    }
    return lengths;
  }

  // Canonical code assignment - the exact encode-side mirror of
  // HuffmanTree.buildFromLengths's blCount/nextCode algorithm, but recording
  // a {code, length} pair per symbol instead of a decode map.
  function assignCanonicalCodes(lengths, alphabetSize) {
    let nonZeroCount = 0, lastSymbol = -1, maxLength = 0;
    for (let s = 0; s < alphabetSize; ++s) {
      if (lengths[s] > 0) {
        nonZeroCount++;
        lastSymbol = s;
        if (lengths[s] > maxLength) maxLength = lengths[s];
      }
    }
    if (nonZeroCount === 0) return { singleSymbol: -1, codes: null };
    if (nonZeroCount === 1) return { singleSymbol: lastSymbol, codes: null };

    const blCount = new Array(maxLength + 1).fill(0);
    for (let s = 0; s < alphabetSize; ++s) if (lengths[s] > 0) blCount[lengths[s]]++;

    const nextCode = new Array(maxLength + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxLength; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }

    const codes = new Array(alphabetSize).fill(null);
    for (let s = 0; s < alphabetSize; ++s) {
      const len = lengths[s];
      if (len === 0) continue;
      codes[s] = { code: nextCode[len]++, length: len };
    }
    return { singleSymbol: -1, codes };
  }

  // Writes one symbol's canonical code, MSB-of-the-code first (matching
  // HuffmanTree.decode's bit-by-bit "shift the accumulator left one position,
  // OR in the next read bit" reconstruction).
  function writeCanonicalSymbol(writer, huffCode, symbol) {
    if (huffCode.singleSymbol >= 0) return; // zero-bit code (Section 3.5)
    const entry = huffCode.codes[symbol];
    for (let i = entry.length - 1; i >= 0; --i)
      writer.writeBits(1, OpCodes.And32(OpCodes.Shr32(entry.code, i), 1));
  }

  // ===== ENCODER: COMPLEX PREFIX CODE DESCRIPTOR WRITER (Section 3.5) =====

  // The fixed 6-symbol code used to transmit each code-length-alphabet
  // symbol's own code length (0..5) - the exact bit-for-bit inverse of
  // readCodeLengthCodeLength above.
  function writeCodeLengthCodeLength(writer, value) {
    switch (value) {
      case 0: writer.writeBits(1, 0); writer.writeBits(1, 0); return;
      case 3: writer.writeBits(1, 0); writer.writeBits(1, 1); return;
      case 4: writer.writeBits(1, 1); writer.writeBits(1, 0); return;
      case 2: writer.writeBits(1, 1); writer.writeBits(1, 1); writer.writeBits(1, 0); return;
      case 1: writer.writeBits(1, 1); writer.writeBits(1, 1); writer.writeBits(1, 1); writer.writeBits(1, 0); return;
      case 5: writer.writeBits(1, 1); writer.writeBits(1, 1); writer.writeBits(1, 1); writer.writeBits(1, 1); return;
      default: throw new Error('Invalid code-length-code-length (must be 0..5): ' + value);
    }
  }

  // Writes a complex prefix code descriptor for `targetLengths` (already
  // length-limited to 15 bits) over an alphabet of `alphabetSize` symbols.
  // Always uses HSKIP=0 and never emits the run-length codes (16/17): every
  // target code length, including zeros, is sent as an explicit code-length-
  // alphabet symbol. RLE is an optional descriptor-size optimization, not a
  // decoder requirement - omitting it keeps this a direct, easily-verified
  // mirror of readComplexPrefixCode's control flow.
  function writeComplexPrefixCode(writer, targetLengths, alphabetSize) {
    writer.writeBits(2, 0); // HSKIP = 0

    const codeLengthWeights = new Array(18).fill(0);
    for (let s = 0; s < alphabetSize; ++s) codeLengthWeights[targetLengths[s]]++;

    const codeLengthLengths = packageMergeLengths(codeLengthWeights, 5);
    const codeLengthHuff = assignCanonicalCodes(codeLengthLengths, 18);

    // Mirrors the decoder's `space` (Kraft sum, scaled by 32) tracker: once
    // it reaches zero the decoder stops reading code-length-code-lengths, so
    // the writer must stop emitting them at exactly the same point.
    let space = 32;
    for (let i = 0; i < 18 && space > 0; ++i) {
      const symbol = CODE_LENGTH_CODE_ORDER[i];
      const len = codeLengthLengths[symbol];
      writeCodeLengthCodeLength(writer, len);
      if (len !== 0) space -= OpCodes.Shr32(32, len);
    }

    // Phase 2 mirrors the decoder's `spaceTarget` (Kraft sum, scaled by
    // 32768) tracker symbol-by-symbol: the decoder only stops early once
    // that sum reaches zero, which requires the target code to be COMPLETE
    // (Kraft sum exactly 32768). A target alphabet with only one used symbol
    // (common for small/simple command or distance sets) gets length 1 for
    // that symbol - an INCOMPLETE code, since half of 32768 is only half of
    // the full sum - so the decoder does NOT stop after it and keeps reading
    // (zero-length) entries all the way to alphabetSize. Any shortcut that
    // assumes completeness (e.g. "stop after the last nonzero symbol")
    // desyncs the stream whenever the code turns out to be incomplete.
    let spaceTarget = 32768;
    for (let s = 0; s < alphabetSize && spaceTarget > 0; ++s) {
      const len = targetLengths[s];
      writeCanonicalSymbol(writer, codeLengthHuff, len);
      if (len !== 0) spaceTarget -= OpCodes.Shr32(32768, len);
    }
  }

  // Section 3.4: simple prefix code, NSYM=1 form - the exact inverse of
  // readSimplePrefixCode's early-return branch (a single symbol, sent as a
  // raw alphabet-index with no Huffman code at all). This is the format's
  // real mechanism for a zero- or one-symbol alphabet; the complex
  // descriptor's own nonZeroCount===1 shortcut (Section 3.5) is decoder-side
  // leniency for reading unusual streams, not a form a conformant decoder is
  // guaranteed to accept from an encoder, so it must not be relied on here.
  function writeSimplePrefixCode(writer, symbolValue, alphabetSize) {
    writer.writeBits(2, 1); // HSKIP = 1 selects the simple prefix code form
    writer.writeBits(2, 0); // NSYM raw 0 -> NSYM = 1
    const alphabetBits = BitLength(alphabetSize);
    writer.writeBits(alphabetBits, symbolValue);
  }

  // Dispatches to the simple (NSYM=1) or complex descriptor depending on how
  // many distinct symbols `targetLengths` actually uses.
  function writePrefixCode(writer, targetLengths, alphabetSize) {
    let nonZeroCount = 0, lastSymbol = 0;
    for (let s = 0; s < alphabetSize; ++s) if (targetLengths[s] > 0) { nonZeroCount++; lastSymbol = s; }
    if (nonZeroCount <= 1) { writeSimplePrefixCode(writer, lastSymbol, alphabetSize); return; }
    writeComplexPrefixCode(writer, targetLengths, alphabetSize);
  }

  // ===== ENCODER: LZ77 MATCH FINDER (hash chain, min match 4) =====

  const LZ_MIN_MATCH = 4;
  const LZ_HASH_BITS = 17;
  const LZ_HASH_SIZE = OpCodes.Shl32(1, LZ_HASH_BITS);
  const LZ_MAX_CHAIN = 128;

  function lzHash4(data, pos) {
    const word = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(data[pos], 24), OpCodes.Shl32(data[pos + 1], 16)),
      OpCodes.Or32(OpCodes.Shl32(data[pos + 2], 8), data[pos + 3])
    );
    const hashed = OpCodes.Mul32(word, 2654435761);
    return OpCodes.Shr32(hashed, 32 - LZ_HASH_BITS);
  }

  class LZMatchFinder {
    constructor(data) {
      this.data = data;
      this.head = new Int32Array(LZ_HASH_SIZE).fill(-1);
      this.prev = new Int32Array(data.length > 0 ? data.length : 1).fill(-1);
    }

    insert(pos) {
      if (pos + LZ_MIN_MATCH > this.data.length) return;
      const h = lzHash4(this.data, pos);
      this.prev[pos] = this.head[h];
      this.head[h] = pos;
    }

    findBest(pos, maxLen) {
      if (maxLen < LZ_MIN_MATCH) return null;
      const data = this.data;
      const h = lzHash4(data, pos);
      let chain = this.head[h];
      let depth = 0;
      let bestLen = 0, bestDist = 0;

      while (chain >= 0 && depth < LZ_MAX_CHAIN) {
        if (chain < pos) {
          let len = 0;
          while (len < maxLen && data[chain + len] === data[pos + len]) len++;
          if (len > bestLen) {
            bestLen = len;
            bestDist = pos - chain;
            if (len >= maxLen) break;
          }
        }
        chain = this.prev[chain];
        depth++;
      }

      return bestLen >= LZ_MIN_MATCH ? { length: bestLen, distance: bestDist } : null;
    }
  }

  // Splits `data[start..end)` into a sequence of insert-and-copy commands.
  // Uses 1-step lazy matching (defer a match if starting one byte later
  // yields a strictly longer one) and keeps the hash chain populated across
  // matched regions so later positions can still find them as match sources.
  function findLZCommands(data, start, end) {
    const matcher = new LZMatchFinder(data);
    const commands = [];
    let literalRunStart = start;
    let pos = start;

    while (pos < end) {
      const maxLen = end - pos;
      let match = matcher.findBest(pos, maxLen);

      if (match) {
        if (pos + 1 < end) {
          matcher.insert(pos);
          const nextMatch = matcher.findBest(pos + 1, end - pos - 1);
          if (nextMatch && nextMatch.length > match.length) {
            pos++;
            continue;
          }
        } else {
          matcher.insert(pos);
        }

        commands.push({
          insertStart: literalRunStart,
          insertLength: pos - literalRunStart,
          copyLength: match.length,
          distance: match.distance
        });

        const matchEnd = pos + match.length;
        for (let i = pos + 1; i < matchEnd; ++i) matcher.insert(i);
        pos = matchEnd;
        literalRunStart = pos;
      } else {
        matcher.insert(pos);
        pos++;
      }
    }

    if (end - literalRunStart > 0) {
      commands.push({ insertStart: literalRunStart, insertLength: end - literalRunStart, copyLength: 0, distance: 0 });
    }

    return commands;
  }

  // ===== ENCODER: INSERT/COPY AND DISTANCE CODE INVERSION =====

  // Finds the bucket index i such that table[i][0] <= value, scanning from
  // the top since bucket bases are monotonically increasing and contiguous.
  function findLengthCode(table, value) {
    for (let i = table.length - 1; i >= 0; --i) if (value >= table[i][0]) return i;
    return 0;
  }

  // Finds the (non-implicit-zero) insert-and-copy range-table block whose
  // [insertBase, copyBase] matches the given 8-wide code groups.
  function insertCopyBlockIndex(insertGroup, copyGroup) {
    for (let b = 0; b < INSERT_COPY_RANGE_TABLE.length; ++b) {
      const entry = INSERT_COPY_RANGE_TABLE[b];
      if (entry[0] === insertGroup && entry[1] === copyGroup && entry[2] === false) return b;
    }
    throw new Error('Unreachable insert/copy group combination');
  }

  // Inverts decodeDistanceCode's NPOSTFIX=0/NDIRECT=0 formula: finds the
  // ring-buffer-external distance code `16+b` and extra-bits value whose
  // decoded distance equals `distance`.
  function computeDistanceCode(distance) {
    for (let b = 0; b <= 200; ++b) {
      const ndistbits = 1 + Math.floor(b / 2);
      const offset = OpCodes.Shl32(2 + (b % 2), ndistbits) - 4;
      const rangeStart = offset + 1;
      const rangeEnd = offset + OpCodes.Shl32(1, ndistbits);
      if (distance >= rangeStart && distance <= rangeEnd)
        return { code: b + 16, extraBits: ndistbits, extraValue: distance - rangeStart };
    }
    throw new Error('Distance out of representable range: ' + distance);
  }

  // ===== ENCODER: STREAM-LEVEL WINDOW SIZE AND META-BLOCK FRAMING =====

  function computeWindowBits(maxDistanceNeeded) {
    for (let wbits = 10; wbits <= 24; ++wbits)
      if (OpCodes.Shl32(1, wbits) - 16 >= maxDistanceNeeded) return wbits;
    return 24;
  }

  function writeWindowBits(writer, wbits) {
    if (wbits === 16) { writer.writeBits(1, 0); return; }
    writer.writeBits(1, 1);
    if (wbits >= 18 && wbits <= 24) { writer.writeBits(3, wbits - 17); return; }
    if (wbits === 17) { writer.writeBits(3, 0); writer.writeBits(3, 0); return; }
    if (wbits >= 9 && wbits <= 15) { writer.writeBits(3, 0); writer.writeBits(3, wbits - 8); return; }
    throw new Error('Unsupported window size (bits): ' + wbits);
  }

  // MNIBBLES is 4 nibbles (up to 65536-byte meta-blocks) unless the chunk
  // needs more, in which case 6 nibbles (up to 16777216 bytes) are used.
  // Section 9.2: "if MNIBBLES is greater than 4, and the last nibble is all
  // zeros, then the stream should be rejected as invalid." A conformant
  // decoder (zlib's brotliDecompressSync among them) enforces this, so
  // MNIBBLES must be the SMALLEST nibble count whose top nibble is nonzero -
  // not just "big enough to fit MLEN-1": 5 nibbles for MLEN-1 in
  // (0xFFFF, 0xFFFFF], 6 nibbles only once even that overflows.
  function writeMnibblesAndMlen(writer, byteLength) {
    const mlen = byteLength - 1;
    const nibbleCount = mlen <= 0xFFFF ? 4 : (mlen <= 0xFFFFF ? 5 : 6);
    const raw = nibbleCount === 4 ? 0 : (nibbleCount === 5 ? 1 : 2);
    writer.writeBits(2, raw);
    for (let i = 0; i < nibbleCount; ++i)
      writer.writeBits(4, OpCodes.And32(OpCodes.Shr32(mlen, i * 4), 0xF));
  }

  // Builds one ISLAST=0 uncompressed meta-block for `chunk` in an isolated
  // (unflushed) BitWriter. `startBitOffset` (0..7) is this meta-block's
  // position, modulo 8, within the REAL stream: the decoder's alignToByte()
  // for an uncompressed payload aligns to the whole stream's absolute bit
  // position, not to a position local to this isolated writer, so the
  // padding here must account for whatever bits precede it in the real
  // stream. The payload bytes are written through writeBits (not pushed
  // directly to `.bytes`) so the emitted bit sequence is correct regardless
  // of this writer's own local byte boundary.
  function buildUncompressedMetaBlockWriter(chunk, startBitOffset) {
    const writer = new BitWriter();
    writer.writeBits(1, 0); // ISLAST = 0
    writeMnibblesAndMlen(writer, chunk.length);
    writer.writeBits(1, 1); // ISUNCOMPRESSED = 1

    const absoluteBits = startBitOffset + writer.bitLength();
    const padBits = (8 - OpCodes.And32(absoluteBits, 7)) % 8;
    // (padBits is at most 7; safe to write directly even when 0.)
    if (padBits > 0) writer.writeBits(padBits, 0);

    for (let i = 0; i < chunk.length; ++i) writer.writeBits(8, chunk[i]);
    return writer;
  }

  // Builds one ISLAST=0 compressed meta-block for `chunk` in an isolated
  // (unflushed) BitWriter: NBLTYPES=1 for all three block categories (no
  // block-switch commands), NPOSTFIX=0, NDIRECT=0, a single (unused, since
  // there is only one literal tree) context mode, and one complex prefix
  // code per alphabet (literals, insert-and-copy commands, distances).
  function buildCompressedMetaBlockWriter(chunk) {
    const commands = findLZCommands(chunk, 0, chunk.length);

    const literalHist = new Array(256).fill(0);
    const cmdHist = new Array(704).fill(0);
    const distHist = new Array(64).fill(0); // 16 + NDIRECT(0) + (48 shifted left by NPOSTFIX(0))

    const annotated = new Array(commands.length);
    for (let ci = 0; ci < commands.length; ++ci) {
      const cmd = commands[ci];
      const hasRealCopy = cmd.copyLength > 0;
      const copyLengthUsed = hasRealCopy ? cmd.copyLength : 2; // placeholder: never decoded (see below)

      const insertCodeIndex = findLengthCode(INSERT_LENGTH_CODES, cmd.insertLength);
      const copyCodeIndex = findLengthCode(COPY_LENGTH_CODES, copyLengthUsed);
      const insertGroup = Math.floor(insertCodeIndex / 8) * 8;
      const copyGroup = Math.floor(copyCodeIndex / 8) * 8;
      const block = insertCopyBlockIndex(insertGroup, copyGroup);
      const sub = (insertCodeIndex - insertGroup) * 8 + (copyCodeIndex - copyGroup);
      const commandCode = block * 64 + sub;

      const distInfo = hasRealCopy ? computeDistanceCode(cmd.distance) : null;

      cmdHist[commandCode]++;
      for (let i = 0; i < cmd.insertLength; ++i) literalHist[chunk[cmd.insertStart + i]]++;
      if (distInfo) distHist[distInfo.code]++;

      annotated[ci] = { cmd, commandCode, insertCodeIndex, copyCodeIndex, copyLengthUsed, distInfo };
    }

    const literalLengths = packageMergeLengths(literalHist, 15);
    const cmdLengths = packageMergeLengths(cmdHist, 15);
    const distLengths = packageMergeLengths(distHist, 15);

    const literalHuff = assignCanonicalCodes(literalLengths, 256);
    const cmdHuff = assignCanonicalCodes(cmdLengths, 704);
    const distHuff = assignCanonicalCodes(distLengths, 64);

    const writer = new BitWriter();
    writer.writeBits(1, 0); // ISLAST = 0
    writeMnibblesAndMlen(writer, chunk.length);
    writer.writeBits(1, 0); // ISUNCOMPRESSED = 0

    writer.writeBits(1, 0); // literal category NBLTYPES = 1
    writer.writeBits(1, 0); // insert-and-copy category NBLTYPES = 1
    writer.writeBits(1, 0); // distance category NBLTYPES = 1

    writer.writeBits(2, 0); // NPOSTFIX = 0
    writer.writeBits(4, 0); // NDIRECT (raw value, shifted left by NPOSTFIX) = 0

    writer.writeBits(2, 0); // context mode for the sole literal block type (irrelevant: 1 literal tree)

    writer.writeBits(1, 0); // literal tree count (NTREESL) = 1 -> context map implicit, no bits
    writer.writeBits(1, 0); // distance tree count (NTREESD) = 1 -> context map implicit, no bits

    writePrefixCode(writer, literalLengths, 256);
    writePrefixCode(writer, cmdLengths, 704);
    writePrefixCode(writer, distLengths, 64);

    for (let ci = 0; ci < annotated.length; ++ci) {
      const a = annotated[ci];
      writeCanonicalSymbol(writer, cmdHuff, a.commandCode);

      const insertExtra = INSERT_LENGTH_CODES[a.insertCodeIndex][1];
      if (insertExtra > 0) writer.writeBits(insertExtra, a.cmd.insertLength - INSERT_LENGTH_CODES[a.insertCodeIndex][0]);

      const copyExtra = COPY_LENGTH_CODES[a.copyCodeIndex][1];
      if (copyExtra > 0) writer.writeBits(copyExtra, a.copyLengthUsed - COPY_LENGTH_CODES[a.copyCodeIndex][0]);

      for (let i = 0; i < a.cmd.insertLength; ++i)
        writeCanonicalSymbol(writer, literalHuff, chunk[a.cmd.insertStart + i]);

      if (a.distInfo) {
        writeCanonicalSymbol(writer, distHuff, a.distInfo.code);
        if (a.distInfo.extraBits > 0) writer.writeBits(a.distInfo.extraBits, a.distInfo.extraValue);
      }
    }

    return writer;
  }

  class BrotliEncoder {
    compress(input) {
      const writer = new BitWriter();

      if (input.length === 0) {
        writer.writeBits(1, 0); // WBITS == 16
        writer.writeBits(1, 1); // ISLAST
        writer.writeBits(1, 1); // ISLASTEMPTY
        writer.flush();
        return writer.bytes;
      }

      // CHUNK_CAP: largest chunk representable with MNIBBLES=6 (24-bit MLEN-1).
      // LZ77 matching is scoped to a single chunk, so a window covering the
      // largest possible chunk covers every distance the encoder can emit.
      const CHUNK_CAP = OpCodes.Shl32(1, 24) - 1; // 16777215
      const windowBits = computeWindowBits(Math.min(input.length, CHUNK_CAP));
      writeWindowBits(writer, windowBits);

      let offset = 0;
      while (offset < input.length) {
        const chunkSize = Math.min(CHUNK_CAP, input.length - offset);
        const chunk = input.slice(offset, offset + chunkSize);

        const compressedWriter = buildCompressedMetaBlockWriter(chunk);
        const uncompressedWriter = buildUncompressedMetaBlockWriter(chunk, writer.bitCount);

        // Fall back to the uncompressed form whenever the compressed form
        // would not actually be smaller (tiny chunks, incompressible data).
        const chosen = compressedWriter.bitLength() < uncompressedWriter.bitLength()
          ? compressedWriter : uncompressedWriter;
        writer.appendBits(chosen);

        offset += chunkSize;
      }

      writer.writeBits(1, 1); // ISLAST = 1
      writer.writeBits(1, 1); // ISLASTEMPTY = 1
      writer.flush();

      return writer.bytes;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class BrotliCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "Brotli";
      this.description = "RFC 7932-compatible Brotli codec. The decoder implements the full RFC 7932 bitstream grammar (meta-block framing, complex/simple prefix codes, block-switch commands, insert-and-copy commands, distance ring buffer, context modeling, and the static dictionary with word transforms) and correctly reads streams from conformant encoders such as zlib's brotliCompressSync. The encoder performs genuine LZ77 (hash-chain match finder) plus canonical Huffman entropy coding: it emits compressed meta-blocks with NBLTYPES=1 for all three block categories, NPOSTFIX=0, NDIRECT=0, and one length-limited (package-merge) prefix code per alphabet (literals, insert-and-copy commands, distances), falling back to an uncompressed meta-block whenever that would be smaller (small or incompressible inputs).";
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
        "ENCODER: hash-chain LZ77 (minimum match 4, one-step lazy matching) plus canonical, length-limited",
        "  (package-merge, RFC-capped at 15 bits for data alphabets / 5 bits for the code-length alphabet)",
        "  Huffman coding, emitted as RFC 7932 complex prefix code descriptors. Uses the simplest legal",
        "  configuration: NBLTYPES=1 for literals/commands/distances (no block switching), NPOSTFIX=0,",
        "  NDIRECT=0, a single context mode, and does not reference the static dictionary. Falls back to an",
        "  uncompressed meta-block per chunk whenever that would be smaller. Verified byte-for-byte",
        "  interoperable with zlib's brotliDecompressSync and the reference `brotli` CLI in both directions",
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
