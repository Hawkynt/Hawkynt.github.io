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
 *     * static dictionary references (Section 8) - the 13,504 words of
 *       Appendix A are searched with a hash index over the first four bytes of
 *       each word, and the transforms of Appendix B are applied so that a
 *       reference beyond the sliding window can code a word, a case-flipped
 *       word, or a word with a prefix, a suffix or a truncated tail;
 *     * a hash-chain match finder with cost-aware ranking and two steps of
 *       lazy matching, and canonical length-limited (package-merge) prefix codes.
 *   NOT implemented on the encoding side: the OmitFirst1..9 dictionary word
 *   transforms (8 of the 121 in Appendix B), several block types per category
 *   with block-switch commands (Section 6), non-zero NPOSTFIX/NDIRECT distance
 *   parameters (Section 4), distance context modelling (Section 7.2), and an
 *   optimal parse. Any compliant Brotli decoder, including zlib's
 *   brotliDecompressSync and the reference `brotli` CLI, accepts the output
 *   byte-for-byte.
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
  /** @type {int32[]} */
  const CODE_LENGTH_CODE_ORDER = [1, 2, 3, 4, 0, 5, 17, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  /** @type {int32} */
  const REPEAT_PREVIOUS_CODE_LENGTH = 16;
  /** @type {int32} */
  const REPEAT_ZERO_CODE_LENGTH = 17;

  // Section 6: block count code alphabet (26 symbols): base and extra bits.
  /** @type {int32[]} */
  const BLOCK_LENGTH_BASE = [
    1, 5, 9, 13, 17, 25, 33, 41,
    49, 65, 81, 97, 113, 145, 177, 209,
    241, 305, 369, 497, 753, 1265, 2289, 4337,
    8433, 16625
  ];
  /** @type {int32[]} */
  const BLOCK_LENGTH_EXTRA = [
    2, 2, 2, 2, 3, 3, 3, 3,
    4, 4, 4, 4, 5, 5, 5, 5,
    6, 6, 7, 8, 9, 10, 11, 12,
    13, 24
  ];

  // Section 5: insert-length code alphabet (24 symbols): base and extra bits.
  /** @type {int32[]} */
  const INSERT_LENGTH_BASE = [
    0, 1, 2, 3, 4, 5, 6, 8,
    10, 14, 18, 26, 34, 50, 66, 98,
    130, 194, 322, 578, 1090, 2114, 6210, 22594
  ];
  /** @type {int32[]} */
  const INSERT_LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 1, 1,
    2, 2, 3, 3, 4, 4, 5, 5,
    6, 7, 8, 9, 10, 12, 14, 24
  ];

  // Section 5: copy-length code alphabet (24 symbols): base and extra bits.
  /** @type {int32[]} */
  const COPY_LENGTH_BASE = [
    2, 3, 4, 5, 6, 7, 8, 9,
    10, 12, 14, 18, 22, 30, 38, 54,
    70, 102, 134, 198, 326, 582, 1094, 2118
  ];
  /** @type {int32[]} */
  const COPY_LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 2, 2, 3, 3, 4, 4,
    5, 5, 6, 7, 8, 9, 10, 24
  ];

  // Section 5: maps an 11-block (64-code) region of the insert-and-copy length
  // code (0..703) to insertLengthCodeBase, copyLengthCodeBase and
  // distanceIsImplicitZero. Derived directly from the RFC's insert/copy range
  // table; one row per region:
  //   code   0.. 63, 64..127, 128..191, 192..255, 256..319, 320..383,
  //   384..447, 448..511, 512..575, 576..639, 640..703
  /** @type {int32[]} */
  const RANGE_INSERT_BASE = [0, 0, 0, 0, 8, 8, 0, 16, 8, 16, 16];
  /** @type {int32[]} */
  const RANGE_COPY_BASE = [0, 8, 0, 8, 0, 8, 16, 0, 16, 8, 16];
  /** @type {boolean[]} */
  const RANGE_IMPLICIT_DISTANCE = [true, true, false, false, false, false, false, false, false, false, false];

  // Section 7.1: context lookup tables for UTF8 (Lut0/Lut1) and Signed (Lut2)
  // context modes. Extracted and CRC-32 verified against the RFC 7932 text.
  /** @type {uint8[]} */
  const LUT0 = BrotliDictionary.Table('CONTEXT_LUT0');
  /** @type {uint8[]} */
  const LUT1 = BrotliDictionary.Table('CONTEXT_LUT1');
  /** @type {uint8[]} */
  const LUT2 = BrotliDictionary.Table('CONTEXT_LUT2');

  // Section 9.2: MNIBBLES field value to nibble count (0 = metadata block).
  /** @type {int32[]} */
  const MNIBBLES_MAP = [4, 5, 6, 0];

  // ===== SMALL HELPERS =====

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

  // A table row looked up past the end of a code table: throws exactly what
  // destructuring the missing row threw.
  function throwMissingRow() {
    throw new TypeError('undefined is not iterable (cannot read property Symbol(Symbol.iterator))');
  }

  // Smallest b such that Shl32(1, b) >= n, computed without floating point.
  /**
   * @param {int32} n - Alphabet size
   * @returns {int32} Bits needed
   */
  function BitLength(n) {
    /** @type {int32} */
    let bits = 0;
    /** @type {uint32} */
    let v = 1;
    while (v < n) {
      v = OpCodes.Shl32(v, 1);
      bits++;
    }
    return bits;
  }

  // ===== BIT READER (LSB-first, matching RFC 7932 Section 1.5.1) =====

  class BitReader {
    /**
     * @param {uint8[]} buffer - Input bytes
     */
    constructor(buffer) {
      /** @type {uint8[]} */
      this.buffer = buffer;
      /** @type {float64} */
      this.bitPos = 0; // absolute bit index into buffer
    }

    /**
     * @param {int32} n - Bit count
     * @returns {uint32} Bits, least significant first
     */
    readBits(n) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < n; ++i) {
        /** @type {float64} */
        const byteIndex = Math.floor(this.bitPos / 8);
        /** @type {int32} */
        const bitIndex = this.bitPos % 8;
        if (byteIndex >= this.buffer.length) {
          throw new Error('Unexpected end of Brotli stream');
        }
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(this.buffer[byteIndex], bitIndex), 1);
        result = OpCodes.Or32(result, OpCodes.Shl32(bit, i));
        this.bitPos++;
      }
      return result;
    }

    // Advance to the next byte boundary (no-op if already aligned).
    alignToByte() {
      /** @type {int32} */
      const rem = this.bitPos % 8;
      if (rem !== 0) {
        this.bitPos += (8 - rem);
      }
    }

    /**
     * @returns {float64} Index of the byte holding the next bit
     */
    bytePos() {
      return Math.floor(this.bitPos / 8);
    }

    /**
     * @param {float64} n - Byte count
     */
    skipBytes(n) {
      this.bitPos += n * 8;
    }
  }

  // ===== HUFFMAN (PREFIX CODE) DECODER =====
  // Canonical prefix code per RFC 7932 Section 3.2. A single non-zero-length
  // symbol collapses to a zero-bit code (Section 3.5).

  class HuffmanTree {
    constructor() {
      /** @type {int32} */
      this.singleSymbol = -1;
      /** @type {int32} */
      this.maxLength = 0;
      // One row per code length, listing its symbols in code order: the
      // canonical codes of one length are consecutive, starting at
      // firstCode[length].
      /** @type {int32[][]} */
      this.byLength = null;
      /** @type {int32[]} */
      this.firstCode = null;
    }

    /**
     * @param {int32[]} lengths - Code length per symbol
     * @param {int32} alphabetSize - Symbols considered
     * @returns {boolean} False when no symbol has a code
     */
    buildFromLengths(lengths, alphabetSize) {
      /** @type {int32} */
      let nonZeroCount = 0;
      /** @type {int32} */
      let lastSymbol = -1;
      for (let s = 0; s < alphabetSize; ++s) {
        if (lengths[s] > 0) {
          nonZeroCount++;
          lastSymbol = s;
        }
      }
      if (nonZeroCount === 0) {
        return false;
      }
      if (nonZeroCount === 1) {
        this.singleSymbol = lastSymbol;
        return true;
      }

      /** @type {int32} */
      let maxLength = 0;
      for (let s = 0; s < alphabetSize; ++s) {
        if (lengths[s] > maxLength) {
          maxLength = lengths[s];
        }
      }
      this.maxLength = maxLength;

      /** @type {int32[]} */
      const blCount = filledArray(maxLength + 1, 0);
      for (let s = 0; s < alphabetSize; ++s) {
        if (lengths[s] > 0) {
          blCount[lengths[s]]++;
        }
      }

      /** @type {int32[]} */
      const firstCode = filledArray(maxLength + 1, 0);
      /** @type {uint32} */
      let code = 0;
      for (let bits = 1; bits <= maxLength; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        firstCode[bits] = code;
      }
      this.firstCode = firstCode;

      /** @type {int32[][]} */
      const rows = new Array(maxLength + 1);
      for (let len = 0; len <= maxLength; ++len) {
        /** @type {int32[]} */
        const row = [];
        rows[len] = row;
      }
      this.byLength = rows;
      // Symbols in increasing order get consecutive codes of their length.
      for (let s = 0; s < alphabetSize; ++s) {
        /** @type {int32} */
        const len = lengths[s];
        if (len === 0) {
          continue;
        }
        rows[len].push(s);
      }
      return true;
    }

    /**
     * @param {BitReader} reader - Input
     * @returns {int32} Decoded symbol
     */
    decode(reader) {
      if (this.singleSymbol >= 0) {
        return this.singleSymbol;
      }
      /** @type {uint32} */
      let code = 0;
      for (let len = 1; len <= this.maxLength; ++len) {
        /** @type {uint32} */
        const bit = reader.readBits(1);
        code = OpCodes.Or32(OpCodes.Shl32(code, 1), bit);
        /** @type {int32[]} */
        const atLength = this.byLength[len];
        /** @type {int32} */
        const offset = code - this.firstCode[len];
        if (offset >= 0 && offset < atLength.length) {
          return atLength[offset];
        }
      }
      throw new Error('Invalid Brotli prefix code');
    }
  }

  // ===== VARIABLE-LENGTH INTEGER READERS (Section 9.1/9.2/7.3) =====

  // Section 9.1: WBITS (window size exponent), value range 10..24 (or 16).
  /**
   * @param {BitReader} reader - Input
   * @returns {int32} WBITS
   */
  function readWindowBits(reader) {
    /** @type {uint32} */
    const flag = reader.readBits(1);
    if (flag === 0) {
      return 16;
    }
    /** @type {uint32} */
    const n = reader.readBits(3);
    if (n !== 0) {
      return OpCodes.Add32(17, n);
    }
    /** @type {uint32} */
    const m = reader.readBits(3);
    if (m !== 0) {
      return OpCodes.Add32(8, m);
    }
    return 17;
  }

  // Section 9.2: shared variable-length code used for NBLTYPESx and NTREESx.
  // value 1 -> 1 bit "0"; value 2 -> "0001"; else base (2 to the power v) + 1, with v extra bits.
  /**
   * @param {BitReader} reader - Input
   * @returns {int32} Count
   */
  function readBlockCountVLC(reader) {
    /** @type {uint32} */
    const flag = reader.readBits(1);
    if (flag === 0) {
      return 1;
    }
    /** @type {uint32} */
    const v = reader.readBits(3);
    if (v === 0) {
      return 2;
    }
    /** @type {uint32} */
    const extra = reader.readBits(v);
    /** @type {uint32} */
    const base = OpCodes.Shl32(1, v);
    return OpCodes.Add32(OpCodes.Add32(base, 1), extra);
  }

  // Section 7.3: RLEMAX field. 0 -> single 0 bit; else 4 bits + 1 (range 1..16).
  /**
   * @param {BitReader} reader - Input
   * @returns {int32} RLEMAX
   */
  function readRunLengthMax(reader) {
    /** @type {uint32} */
    const flag = reader.readBits(1);
    if (flag === 0) {
      return 0;
    }
    /** @type {uint32} */
    const value = reader.readBits(4);
    return OpCodes.Add32(value, 1);
  }

  // Section 3.5: fixed 6-symbol prefix code (values 0..5) used to transmit the
  // code lengths of the 18-symbol code-length alphabet itself.
  /**
   * @param {BitReader} reader - Input
   * @returns {int32} Code length 0..5
   */
  function readCodeLengthCodeLength(reader) {
    /** @type {uint32} */
    const b0 = reader.readBits(1);
    if (b0 === 0) {
      /** @type {uint32} */
      const b1 = reader.readBits(1);
      return b1 === 0 ? 0 : 3;
    }
    /** @type {uint32} */
    const b1 = reader.readBits(1);
    if (b1 === 0) {
      return 4;
    }
    /** @type {uint32} */
    const b2 = reader.readBits(1);
    if (b2 === 0) {
      return 2;
    }
    /** @type {uint32} */
    const b3 = reader.readBits(1);
    return b3 === 0 ? 1 : 5;
  }

  /**
   * @param {BitReader} reader - Input
   * @param {HuffmanTree} tree - Block count code
   * @returns {int32} Block length
   */
  function decodeBlockLength(reader, tree) {
    /** @type {int32} */
    const code = tree.decode(reader);
    if (code >= BLOCK_LENGTH_BASE.length) {
      throwMissingRow();
    }
    /** @type {int32} */
    const base = BLOCK_LENGTH_BASE[code];
    /** @type {int32} */
    const extra = BLOCK_LENGTH_EXTRA[code];
    /** @type {uint32} */
    let extraValue = 0;
    if (extra > 0) {
      extraValue = reader.readBits(extra);
    }
    return OpCodes.Add32(base, extraValue);
  }

  // Section 3.4: simple prefix code (1..4 symbols).
  /**
   * @param {BitReader} reader - Input
   * @param {int32} alphabetSize - Alphabet size
   * @returns {HuffmanTree} Prefix code
   */
  function readSimplePrefixCode(reader, alphabetSize) {
    /** @type {uint32} */
    const nsymField = reader.readBits(2);
    /** @type {int32} */
    const nsym = nsymField + 1;
    /** @type {int32} */
    const alphabetBits = BitLength(alphabetSize);
    /** @type {int32[]} */
    const symbols = [];
    for (let i = 0; i < nsym; ++i) {
      /** @type {uint32} */
      const symbol = reader.readBits(alphabetBits);
      symbols.push(symbol);
    }

    /** @type {HuffmanTree} */
    const tree = new HuffmanTree();
    if (nsym === 1) {
      tree.singleSymbol = symbols[0];
      return tree;
    }

    /** @type {int32[]} */
    const lengths = filledArray(alphabetSize, 0);
    if (nsym === 2) {
      lengths[symbols[0]] = 1;
      lengths[symbols[1]] = 1;
    } else if (nsym === 3) {
      lengths[symbols[0]] = 1;
      lengths[symbols[1]] = 2;
      lengths[symbols[2]] = 2;
    } else {
      /** @type {uint32} */
      const treeSelect = reader.readBits(1);
      if (treeSelect === 0) {
        for (let i = 0; i < 4; ++i) {
          lengths[symbols[i]] = 2;
        }
      } else {
        lengths[symbols[0]] = 1;
        lengths[symbols[1]] = 2;
        lengths[symbols[2]] = 3;
        lengths[symbols[3]] = 3;
      }
    }
    tree.buildFromLengths(lengths, alphabetSize);
    return tree;
  }

  // Section 3.5: complex prefix code. hskip in {0,2,3} (1 selects the simple
  // form and is handled by the caller before this function is reached).
  /**
   * @param {BitReader} reader - Input
   * @param {int32} hskip - HSKIP
   * @param {int32} alphabetSize - Alphabet size
   * @returns {HuffmanTree} Prefix code
   */
  function readComplexPrefixCode(reader, hskip, alphabetSize) {
    // Phase 1: decode the 18 code-length-alphabet code lengths themselves,
    // using the fixed 6-symbol code above, terminating once the Kraft sum
    // (tracked as `space`, scaled by 32) is exhausted.
    /** @type {int32[]} */
    const codeLengthLengths = filledArray(18, 0);
    /** @type {int32} */
    let space = 32;
    /** @type {int32} */
    let nonZeroCount = 0;
    /** @type {int32} */
    let lastNonZeroSymbol = -1;
    for (let i = hskip; i < 18 && space > 0; ++i) {
      /** @type {int32} */
      const len = readCodeLengthCodeLength(reader);
      /** @type {int32} */
      const symbol = CODE_LENGTH_CODE_ORDER[i];
      codeLengthLengths[symbol] = len;
      if (len !== 0) {
        /** @type {uint32} */
        const share = OpCodes.Shr32(32, len);
        space -= share;
        nonZeroCount++;
        lastNonZeroSymbol = symbol;
      }
    }

    /** @type {HuffmanTree} */
    const codeLengthTree = new HuffmanTree();
    if (nonZeroCount === 1) {
      codeLengthTree.singleSymbol = lastNonZeroSymbol;
    } else {
      codeLengthTree.buildFromLengths(codeLengthLengths, 18);
    }

    // Phase 2: decode the alphabetSize target code lengths using the tree
    // from phase 1, honoring the 16 (repeat previous) / 17 (repeat zero)
    // run-length codes. RFC 7932 3.5: a run of consecutive 16s (or 17s)
    // CHAINS - each subsequent repeat code in the run modifies the running
    // repeat count (repeat = 4*(repeat-2) + next-bits) instead of adding an
    // independent one; we track that running state and emit only the delta.
    // Trailing 0/17 codes are omitted entirely from the stream, so once the
    // Kraft sum for the target alphabet (spaceTarget) reaches zero, no more
    // bits are read even if `symbol` has not reached alphabetSize.
    /** @type {int32[]} */
    const lengths = filledArray(alphabetSize, 0);
    /** @type {int32} */
    let symbol = 0;
    /** @type {int32} */
    let prevLength = 8;
    /** @type {float64} */
    let repeat = 0;
    /** @type {int32} */
    let repeatLength = -1;
    /** @type {float64} */
    let spaceTarget = 32768;
    while (symbol < alphabetSize && spaceTarget > 0) {
      /** @type {int32} */
      const decoded = codeLengthTree.decode(reader);
      if (decoded < 16) {
        lengths[symbol++] = decoded;
        if (decoded !== 0) {
          prevLength = decoded;
          /** @type {uint32} */
          const share = OpCodes.Shr32(32768, decoded);
          spaceTarget -= share;
        }
        repeat = 0;
        repeatLength = -1;
        continue;
      }

      /** @type {boolean} */
      const usePrevious = decoded === REPEAT_PREVIOUS_CODE_LENGTH;
      /** @type {int32} */
      const extraBits = usePrevious ? 2 : 3;
      /** @type {int32} */
      const newLength = usePrevious ? prevLength : 0;
      if (repeatLength !== newLength) {
        repeat = 0;
        repeatLength = newLength;
      }
      /** @type {float64} */
      const oldRepeat = repeat;
      if (repeat > 0) {
        repeat = OpCodes.Shl32(repeat - 2, extraBits);
      }
      /** @type {uint32} */
      const repeatBits = reader.readBits(extraBits);
      repeat += OpCodes.Add32(repeatBits, 3);

      /** @type {float64} */
      const delta = Math.min(repeat - oldRepeat, alphabetSize - symbol);
      if (delta < 0) {
        throw new Error('Invalid Brotli complex prefix code: repeat overruns alphabet');
      }
      if (newLength !== 0) {
        /** @type {float64} */
        const share = OpCodes.Shr32(32768, newLength);
        spaceTarget -= delta * share;
      }
      for (let i = 0; i < delta; ++i) {
        lengths[symbol++] = newLength;
      }
    }

    /** @type {HuffmanTree} */
    const tree = new HuffmanTree();
    tree.buildFromLengths(lengths, alphabetSize);
    return tree;
  }

  /**
   * @param {BitReader} reader - Input
   * @param {int32} alphabetSize - Alphabet size
   * @returns {HuffmanTree} Prefix code
   */
  function readPrefixCode(reader, alphabetSize) {
    /** @type {uint32} */
    const hskip = reader.readBits(2);
    if (hskip === 1) {
      return readSimplePrefixCode(reader, alphabetSize);
    }
    return readComplexPrefixCode(reader, hskip, alphabetSize);
  }

  // ===== INSERT-AND-COPY LENGTH DECODING (Section 5) =====

  /**
   * Decoded insert-and-copy command lengths.
   */
  class InsertAndCopy {
    /**
     * @param {int32} insertLength - Literals to insert
     * @param {int32} copyLength - Bytes to copy
     * @param {boolean} distanceIsImplicitZero - Reuses the last distance
     */
    constructor(insertLength, copyLength, distanceIsImplicitZero) {
      /** @type {int32} */
      this.insertLength = insertLength;
      /** @type {int32} */
      this.copyLength = copyLength;
      /** @type {boolean} */
      this.distanceIsImplicitZero = distanceIsImplicitZero;
    }
  }

  /**
   * @param {BitReader} reader - Input
   * @param {int32} code - Insert-and-copy symbol
   * @returns {InsertAndCopy} Command lengths
   */
  function decodeInsertAndCopy(reader, code) {
    /** @type {uint32} */
    const block = OpCodes.Shr32(code, 6);
    /** @type {uint32} */
    const sub = OpCodes.And32(code, 63);
    if (block >= RANGE_INSERT_BASE.length) {
      throwMissingRow();
    }
    /** @type {int32} */
    const insertBase = RANGE_INSERT_BASE[block];
    /** @type {int32} */
    const copyBase = RANGE_COPY_BASE[block];
    /** @type {boolean} */
    const distanceIsImplicitZero = RANGE_IMPLICIT_DISTANCE[block];
    /** @type {int32} */
    const insertLengthCode = insertBase + OpCodes.And32(OpCodes.Shr32(sub, 3), 7);
    /** @type {int32} */
    const copyLengthCode = copyBase + OpCodes.And32(sub, 7);

    /** @type {int32} */
    const insertExtra = INSERT_LENGTH_EXTRA[insertLengthCode];
    /** @type {uint32} */
    let insertExtraValue = 0;
    if (insertExtra > 0) {
      insertExtraValue = reader.readBits(insertExtra);
    }
    /** @type {int32} */
    const insertLength = INSERT_LENGTH_BASE[insertLengthCode] + insertExtraValue;

    /** @type {int32} */
    const copyExtra = COPY_LENGTH_EXTRA[copyLengthCode];
    /** @type {uint32} */
    let copyExtraValue = 0;
    if (copyExtra > 0) {
      copyExtraValue = reader.readBits(copyExtra);
    }
    /** @type {int32} */
    const copyLength = COPY_LENGTH_BASE[copyLengthCode] + copyExtraValue;

    return new InsertAndCopy(insertLength, copyLength, distanceIsImplicitZero);
  }

  // ===== DISTANCE DECODING (Section 4) =====

  /**
   * @param {BitReader} reader - Input
   * @param {int32} code - Distance symbol
   * @param {int32} nPostfix - NPOSTFIX
   * @param {int32} nDirect - NDIRECT
   * @param {int32[]} distanceCache - Four most recent distances
   * @returns {int32} Distance
   */
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
    if (code < 16 + nDirect) {
      return code - 16 + 1;
    }

    /** @type {uint32} */
    const postfixMask = OpCodes.BitMask(nPostfix);
    /** @type {int32} */
    const base = code - nDirect - 16;
    /** @type {int32} */
    const ndistbits = 1 + OpCodes.Shr32(base, nPostfix + 1);
    /** @type {uint32} */
    const hcode = OpCodes.Shr32(base, nPostfix);
    /** @type {uint32} */
    const lcode = OpCodes.And32(base, postfixMask);
    /** @type {uint32} */
    const dextra = reader.readBits(ndistbits);
    /** @type {int32} */
    const offset = OpCodes.Shl32(2 + OpCodes.And32(hcode, 1), ndistbits) - 4;
    /** @type {float64} */
    const shifted = OpCodes.Shl32(offset + dextra, nPostfix);
    return shifted + lcode + nDirect + 1;
  }

  // ===== CONTEXT MODELING (Section 7) =====

  /**
   * @param {int32} mode - Context mode
   * @param {uint8} p1 - Last byte
   * @param {uint8} p2 - Byte before the last
   * @returns {uint32} Literal context id
   */
  function getLiteralContextId(mode, p1, p2) {
    if (mode === 0) {
      return OpCodes.And32(p1, 0x3f);       // LSB6
    }
    if (mode === 1) {
      return OpCodes.Shr32(p1, 2);           // MSB6
    }
    if (mode === 2) {
      return OpCodes.Or32(LUT0[p1], LUT1[p2]); // UTF8
    }
    return OpCodes.Or32(OpCodes.Shl32(LUT2[p1], 3), LUT2[p2]); // Signed
  }

  // Section 7.2: distance context is derived from the copy length (2,3,4,>4).
  /**
   * @param {int32} copyLength - Copy length
   * @returns {int32} Distance context id
   */
  function getDistanceContextId(copyLength) {
    if (copyLength === 2) {
      return 0;
    }
    if (copyLength === 3) {
      return 1;
    }
    if (copyLength === 4) {
      return 2;
    }
    return 3;
  }

  // Section 7.3: context map with move-to-front + run-length zero coding.
  /**
   * @param {BitReader} reader - Input
   * @param {int32} size - Map entries
   * @param {int32} treeCount - Number of trees
   * @returns {int32[]} Context map
   */
  function readContextMap(reader, size, treeCount) {
    if (treeCount < 2) {
      return filledArray(size, 0);
    }

    /** @type {int32} */
    const rleMax = readRunLengthMax(reader);
    /** @type {HuffmanTree} */
    const tree = readPrefixCode(reader, treeCount + rleMax);

    /** @type {int32[]} */
    const map = [];
    while (map.length < size) {
      /** @type {int32} */
      const symbol = tree.decode(reader);
      if (symbol === 0) {
        map.push(0);
      } else if (symbol <= rleMax) {
        /** @type {uint32} */
        const extra = reader.readBits(symbol);
        /** @type {float64} */
        const zeroRun = OpCodes.Shl32(1, symbol) + extra;
        for (let i = 0; i < zeroRun && map.length < size; ++i) {
          map.push(0);
        }
      } else {
        map.push(symbol - rleMax);
      }
    }

    /** @type {uint32} */
    const useMtf = reader.readBits(1);
    if (useMtf === 1) {
      /** @type {int32[]} */
      const mtf = new Array(256);
      for (let i = 0; i < 256; ++i) {
        mtf[i] = i;
      }
      for (let i = 0; i < map.length; ++i) {
        /** @type {int32} */
        const index = map[i];
        /** @type {int32} */
        const value = mtf[index];
        map[i] = value;
        for (let k = index; k > 0; --k) {
          mtf[k] = mtf[k - 1];
        }
        mtf[0] = value;
      }
    }
    return map;
  }

  // ===== BLOCK-SWITCH STATE (Section 6) =====

  class BlockCategory {
    /**
     * @param {int32} numTypes - Block types in this category
     */
    constructor(numTypes) {
      /** @type {int32} */
      this.numTypes = numTypes;
      /** @type {int32} */
      this.type = 0;
      /** @type {int32} */
      this.previousType = 1;
      /** @type {int32} */
      this.count = 0;
      /** @type {HuffmanTree} */
      this.typeTree = null;
      /** @type {HuffmanTree} */
      this.lengthTree = null;
    }
  }

  /**
   * @param {BitReader} reader - Input
   * @returns {BlockCategory} Category header
   */
  function readBlockCategoryHeader(reader) {
    /** @type {int32} */
    const numTypes = readBlockCountVLC(reader);
    /** @type {BlockCategory} */
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

  /**
   * @param {BitReader} reader - Input
   * @param {BlockCategory} category - Category, advanced
   */
  function advanceBlockType(reader, category) {
    if (category.count === 0) {
      /** @type {int32} */
      const symbol = category.typeTree.decode(reader);
      /** @type {int32} */
      let newType = 0;
      if (symbol === 0) {
        newType = category.previousType;
      } else if (symbol === 1) {
        newType = (category.type + 1) % category.numTypes;
      } else {
        newType = symbol - 2;
      }
      category.previousType = category.type;
      category.type = newType;
      category.count = decodeBlockLength(reader, category.lengthTree);
    }
    category.count--;
  }

  // ===== BROTLI DECOMPRESSOR =====

  /**
   * Last two produced bytes, carried across meta-blocks for literal context ids.
   */
  class LiteralHistory {
    constructor() {
      /** @type {uint8} */
      this.p1 = 0;
      /** @type {uint8} */
      this.p2 = 0;
    }
  }

  class BrotliDecoder {
    /**
     * @param {uint8[]} input - Brotli stream
     * @returns {uint8[]} Decoded bytes
     */
    decompress(input) {
      /** @type {BitReader} */
      const reader = new BitReader(input);
      /** @type {uint8[]} */
      const output = [];

      /** @type {int32} */
      const windowBits = readWindowBits(reader);
      /** @type {int32} */
      const windowSize = OpCodes.Shl32(1, windowBits) - 16;

      // Section 4: ring buffer of the four most recent (non-implicit, non-
      // dictionary) distances, initialized at the *stream* level.
      /** @type {int32[]} */
      const distanceCache = [4, 11, 15, 16];
      /** @type {LiteralHistory} */
      const history = new LiteralHistory(); // last two produced bytes, for literal context IDs

      for (;;) {
        /** @type {boolean} */
        /** @type {uint32} */
        const isLastBit = reader.readBits(1);
        /** @type {boolean} */
        const isLast = isLastBit === 1;
        if (isLast) {
          /** @type {uint32} */
          const isLastEmpty = reader.readBits(1);
          if (isLastEmpty === 1) {
            break; // ISLASTEMPTY
          }
        }

        /** @type {uint32} */
        const mnibblesRaw = reader.readBits(2);
        /** @type {int32} */
        const mnibbles = MNIBBLES_MAP[mnibblesRaw];

        if (mnibbles === 0) {
          // MNIBBLES==0: empty/metadata meta-block (Section 9.2/10).
          /** @type {uint32} */
          const reserved = reader.readBits(1);
          if (reserved !== 0) {
            throw new Error('Invalid Brotli stream: reserved bit must be zero');
          }
          /** @type {uint32} */
          const mskipBytes = reader.readBits(2);
          /** @type {float64} */
          let mskipLen = 0;
          if (mskipBytes > 0) {
            /** @type {uint32} */
            const mskipField = reader.readBits(OpCodes.Mul32(mskipBytes, 8));
            mskipLen = mskipField + 1;
          }
          reader.alignToByte();
          reader.skipBytes(mskipLen);
          if (isLast) {
            break;
          }
          continue;
        }

        /** @type {uint32} */
        let mlen = 0;
        for (let i = 0; i < mnibbles; ++i) {
          /** @type {uint32} */
          const nibble = reader.readBits(4);
          mlen = OpCodes.Or32(mlen, OpCodes.Shl32(nibble, i * 4));
        }
        mlen++;

        // ISUNCOMPRESSED only exists when this is not the last meta-block;
        // a data-carrying last meta-block is always the compressed form.
        /** @type {boolean} */
        let isUncompressed = false;
        if (!isLast) {
          /** @type {uint32} */
          const uncompressedBit = reader.readBits(1);
          isUncompressed = uncompressedBit === 1;
        }

        if (isUncompressed) {
          reader.alignToByte();
          for (let i = 0; i < mlen; ++i) {
            /** @type {float64} */
            const at = reader.bytePos();
            /** @type {uint8} */
            const byte = input[at];
            reader.skipBytes(1);
            output.push(byte);
            history.p2 = history.p1;
            history.p1 = byte;
          }
          if (isLast) {
            break;
          }
          continue;
        }

        this._decodeCompressedMetaBlock(reader, output, mlen, windowSize, distanceCache, history);

        if (isLast) {
          break;
        }
      }

      return output;
    }

    /**
     * @param {BitReader} reader - Input
     * @param {uint8[]} output - Output, appended to
     * @param {uint32} mlen - Meta-block length
     * @param {int32} windowSize - Maximum backward distance
     * @param {int32[]} distanceCache - Four most recent distances
     * @param {LiteralHistory} history - Last two bytes, updated when the meta-block completes
     */
    _decodeCompressedMetaBlock(reader, output, mlen, windowSize, distanceCache, history) {
      /** @type {uint8} */
      let p1 = history.p1;
      /** @type {uint8} */
      let p2 = history.p2;

      /** @type {BlockCategory} */
      const literalCategory = readBlockCategoryHeader(reader);
      /** @type {BlockCategory} */
      const insertCopyCategory = readBlockCategoryHeader(reader);
      /** @type {BlockCategory} */
      const distanceCategory = readBlockCategoryHeader(reader);

      /** @type {uint32} */
      const nPostfix = reader.readBits(2);
      /** @type {uint32} */
      const nDirectField = reader.readBits(4);
      /** @type {uint32} */
      const nDirect = OpCodes.Shl32(nDirectField, nPostfix);

      /** @type {int32[]} */
      const contextModes = [];
      for (let i = 0; i < literalCategory.numTypes; ++i) {
        /** @type {uint32} */
        const mode = reader.readBits(2);
        contextModes.push(mode);
      }

      /** @type {int32} */
      const literalTreeCount = readBlockCountVLC(reader);
      /** @type {int32[]} */
      const literalContextMap = readContextMap(reader, 64 * literalCategory.numTypes, literalTreeCount);
      /** @type {int32} */
      const distanceTreeCount = readBlockCountVLC(reader);
      /** @type {int32[]} */
      const distanceContextMap = readContextMap(reader, 4 * distanceCategory.numTypes, distanceTreeCount);

      /** @type {HuffmanTree[]} */
      const literalTrees = [];
      for (let i = 0; i < literalTreeCount; ++i) {
        /** @type {HuffmanTree} */
        const tree = readPrefixCode(reader, 256);
        literalTrees.push(tree);
      }

      /** @type {HuffmanTree[]} */
      const insertCopyTrees = [];
      for (let i = 0; i < insertCopyCategory.numTypes; ++i) {
        /** @type {HuffmanTree} */
        const tree = readPrefixCode(reader, 704);
        insertCopyTrees.push(tree);
      }

      /** @type {int32} */
      const distanceAlphabetSize = OpCodes.Add32(OpCodes.Add32(16, nDirect), OpCodes.Shl32(48, nPostfix));
      /** @type {HuffmanTree[]} */
      const distanceTrees = [];
      for (let i = 0; i < distanceTreeCount; ++i) {
        /** @type {HuffmanTree} */
        const tree = readPrefixCode(reader, distanceAlphabetSize);
        distanceTrees.push(tree);
      }

      /** @type {int32} */
      let produced = 0;
      while (produced < mlen) {
        advanceBlockType(reader, insertCopyCategory);
        /** @type {HuffmanTree} */
        const commandTree = insertCopyTrees[insertCopyCategory.type];
        /** @type {int32} */
        const commandCode = commandTree.decode(reader);
        /** @type {InsertAndCopy} */
        const command = decodeInsertAndCopy(reader, commandCode);

        for (let i = 0; i < command.insertLength && produced < mlen; ++i) {
          advanceBlockType(reader, literalCategory);
          /** @type {int32} */
          const contextMode = contextModes[literalCategory.type];
          /** @type {uint32} */
          const contextId = getLiteralContextId(contextMode, p1, p2);
          /** @type {int32} */
          const treeIndex = literalContextMap[OpCodes.Add32(64 * literalCategory.type, contextId)];
          /** @type {HuffmanTree} */
          const literalTree = literalTrees[treeIndex];
          /** @type {int32} */
          const literal = literalTree.decode(reader);
          output.push(literal);
          p2 = p1;
          p1 = literal;
          produced++;
        }

        if (produced >= mlen) {
          break;
        }
        if (command.copyLength === 0) {
          continue;
        }

        /** @type {int32} */
        let distance = 0;
        /** @type {int32} */
        let distanceCode = 0;
        if (command.distanceIsImplicitZero) {
          distance = distanceCache[0];
        } else {
          advanceBlockType(reader, distanceCategory);
          /** @type {int32} */
          const contextId = getDistanceContextId(command.copyLength);
          /** @type {int32} */
          const treeIndex = distanceContextMap[4 * distanceCategory.type + contextId];
          /** @type {HuffmanTree} */
          const distanceTree = distanceTrees[treeIndex];
          distanceCode = distanceTree.decode(reader);
          distance = decodeDistanceCode(reader, distanceCode, nPostfix, nDirect, distanceCache);
        }

        if (distance <= 0) {
          throw new Error('Invalid Brotli distance: non-positive');
        }

        /** @type {int32} */
        const maxAllowedDistance = Math.min(windowSize, output.length);
        /** @type {boolean} */
        const isDictionaryReference = distance > maxAllowedDistance;

        if (!command.distanceIsImplicitZero && distanceCode !== 0 && !isDictionaryReference) {
          distanceCache[3] = distanceCache[2];
          distanceCache[2] = distanceCache[1];
          distanceCache[1] = distanceCache[0];
          distanceCache[0] = distance;
        }

        if (!isDictionaryReference) {
          for (let i = 0; i < command.copyLength && produced < mlen; ++i) {
            /** @type {uint8} */
            const byte = output[output.length - distance];
            output.push(byte);
            p2 = p1;
            p1 = byte;
            produced++;
          }
        } else {
          /** @type {uint8[]} */
          const word = BrotliDictionary.LookupWord(command.copyLength, distance, maxAllowedDistance);
          if (!word) {
            throw new Error('Invalid Brotli static dictionary reference');
          }
          for (let i = 0; i < word.length && produced < mlen; ++i) {
            output.push(word[i]);
            p2 = p1;
            p1 = word[i];
            produced++;
          }
        }
      }

      history.p1 = p1;
      history.p2 = p2;
    }
  }

  // ===== BROTLI COMPRESSOR =====
  //
  // Emits RFC 7932 streams that use the format's own modelling machinery:
  // literal context modelling (Section 7.1, all four context modes, with the 64
  // context values clustered into several literal prefix codes that are
  // transmitted as a context map per Section 7.3), the distance ring buffer
  // including the implicit-distance insert-and-copy ranges (Sections 4 and 5),
  // run-length coded complex prefix code descriptors (Section 3.5),
  // cost-driven meta-block splitting where every meta-block independently falls
  // back to the uncompressed form of Section 9.2, and static dictionary
  // references with their word transforms (Section 8).
  //
  // Deliberately NOT implemented: the OmitFirst1..9 word transforms, several
  // block types per category with block-switch commands (Section 6), non-zero
  // NPOSTFIX/NDIRECT distance parameters (Section 4), distance context
  // modelling (Section 7.2), and an optimal parse. All of those are optional
  // encoder-side features; the emitted streams stay fully conformant without
  // them.
  //
  // Every encoding decision is taken with integer arithmetic only, so this
  // encoder and CompressionWorkbench's C# encoder emit identical bytes.

  // Tunables. Any change here must be mirrored in CompressionWorkbench's
  // BrotliCompressor.cs, otherwise the two stop producing identical bytes.
  /** @type {int32} */
  const MIN_MATCH = 4;
  /** @type {int32} */
  const HASH_BITS = 17;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const MAX_CHAIN = 256;
  /** @type {int32} */
  const MAX_COPY_LENGTH = 8388608;
  /** @type {int32} */
  const MAX_LITERAL_RUN = 4194304;
  /** @type {int32} */
  const SEGMENT_BYTES = 32768;
  /** @type {int32} */
  const MAX_METABLOCK_BYTES = 16777216;
  /** @type {int32} */
  const SPLIT_THRESHOLD_UNITS = 262144;
  /** @type {int32} */
  const ESTIMATED_COMMAND_BITS = 12;
  /** @type {int32} */
  const ESTIMATED_DISTANCE_BITS = 12;
  /** @type {int32} */
  const MATCH_RANK_LITERAL_BITS = 5;
  /** @type {int32} */
  const LAZY_MATCH_MARGIN = 8;
  /** @type {int32} */
  const LAZY_LOOKAHEAD = 2;
  /** @type {int32[]} */
  const LITERAL_TREE_CANDIDATES = [1, 2, 4, 8, 16];
  /** @type {int32[]} */
  const INITIAL_DISTANCE_RING = [4, 11, 15, 16];
  /** @type {int32} */
  const DISTANCE_ALPHABET_SIZE = 64;   // 16 + NDIRECT(0) + 48 for NPOSTFIX(0)
  /** @type {int32} */
  const LITERAL_ALPHABET_SIZE = 256;
  /** @type {int32} */
  const IAC_ALPHABET_SIZE = 704;
  /** @type {int32} */
  const NUM_CODE_LENGTH_CODES = 18;
  /** @type {int32} */
  const MAX_CODE_LENGTH = 15;
  // Largest exactly representable integer, the starting point of every
  // minimum search.
  /** @type {float64} */
  const MAX_SAFE_INTEGER = 9007199254740991;

  /**
   * @returns {float64[]} Powers of two 2^0 .. 2^31
   */
  function buildPow2Table() {
    /** @type {float64[]} */
    const table = new Array(32);
    /** @type {float64} */
    let value = 1;
    for (let i = 0; i < 32; ++i) {
      table[i] = value;
      value = value * 2;
    }
    return table;
  }

  /** @type {float64[]} */
  const POW2 = buildPow2Table();

  class BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitCount = 0;
    }

    /**
     * @param {int32} n - Bit count
     * @param {uint32} value - Bits, least significant first
     */
    writeBits(n, value) {
      // NOTE: bitBuffer legitimately becomes 0 mid-stream whenever the
      // currently-accumulated pending bits are all zero while bitCount is
      // still nonzero (e.g. writing a zero nibble). Never key any logic off
      // "is bitBuffer falsy" - only bitCount tracks the pending bit position.
      if (n <= 0) {
        return;
      }
      /** @type {uint32} */
      const masked = OpCodes.And32(value, OpCodes.BitMask(n));
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
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.And32(this.bitBuffer, 0xFF));
      }
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
    /**
     * @param {BitWriter} other - Writer whose bits are appended
     */
    appendBits(other) {
      for (let i = 0; i < other.bytes.length; ++i) {
        this.writeBits(8, other.bytes[i]);
      }
      if (other.bitCount > 0) {
        this.writeBits(other.bitCount, other.bitBuffer);
      }
    }

    // Total number of bits written so far (complete bytes plus any pending
    // partial byte) - used to compare a candidate meta-block's true size.
    /**
     * @returns {float64} Bits written
     */
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
  /**
   * @param {float64} x - Argument, at least 1
   * @returns {float64} floor(log2(x) * 65536)
   */
  function computeLog2Fixed(x) {
    /** @type {int32} */
    let exponent = 0;
    /** @type {float64} */
    let v = x;
    while (v >= 2) {
      v = Math.floor(v / 2);
      ++exponent;
    }

    // Mantissa in [1, 2) held as a fixed point number with 20 fractional bits.
    /** @type {float64} */
    let mantissa = Math.floor(x * 1048576 / POW2[exponent]);
    /** @type {float64} */
    let result = exponent * 65536;
    /** @type {float64} */
    let bit = 32768;
    for (let i = 0; i < 16; ++i) {
      mantissa = Math.floor(mantissa * mantissa / 1048576);
      if (mantissa >= 2097152) {
        result += bit;
        mantissa = Math.floor(mantissa / 2);
      }
      bit = Math.floor(bit / 2);
    }
    return result;
  }

  /** @type {int32[]} */
  let LOG2_TABLE = null;

  /**
   * @param {float64} x - Argument, at least 1
   * @returns {float64} floor(log2(x) * 65536)
   */
  function log2Fixed(x) {
    if (LOG2_TABLE === null) {
      /** @type {int32[]} */
      const table = new Int32Array(65536);
      for (let i = 1; i < 65536; ++i) {
        table[i] = computeLog2Fixed(i);
      }
      LOG2_TABLE = table;
    }
    if (x < 65536) {
      return LOG2_TABLE[x];
    }
    return computeLog2Fixed(x);
  }

  // Ideal cost, in 1/256-bit units, of coding `count` occurrences of one symbol
  // inside an alphabet seen `total` times.
  /**
   * @param {float64} count - Occurrences of the symbol
   * @param {float64} total - Occurrences of the alphabet
   * @returns {float64} Cost in 1/256 bits
   */
  function bitCostUnits(count, total) {
    if (count <= 0) {
      return 0;
    }

    // Clamped so the division below can never see a negative numerator: integer
    // division truncates towards zero in the C# implementation but towards minus
    // infinity here, and the two must not be able to disagree.
    /** @type {float64} */
    const delta = log2Fixed(total) - log2Fixed(count);
    return delta <= 0 ? 0 : Math.floor(count * delta / 256);
  }

  /**
   * @param {int32[]} histogram - Symbol counts
   * @returns {float64} Cost in 1/256 bits
   */
  function histogramCostUnits(histogram) {
    /** @type {float64} */
    let total = 0;
    for (let i = 0; i < histogram.length; ++i) {
      total += histogram[i];
    }
    if (total === 0) {
      return 0;
    }
    /** @type {float64} */
    let cost = 0;
    for (let i = 0; i < histogram.length; ++i) {
      cost += bitCostUnits(histogram[i], total);
    }
    return cost;
  }

  // Extra cost, in 1/256-bit units, of coding two histograms with one shared
  // distribution instead of two separate ones. Never negative.
  /**
   * @param {int32[]} a - First histogram
   * @param {int32[]} b - Second histogram
   * @returns {float64} Cost in 1/256 bits
   */
  function mergeCostUnits(a, b) {
    /** @type {float64} */
    let totalA = 0;
    /** @type {float64} */
    let totalB = 0;
    for (let i = 0; i < a.length; ++i) {
      totalA += a[i];
      totalB += b[i];
    }
    /** @type {float64} */
    const totalMerged = totalA + totalB;
    if (totalMerged === 0) {
      return 0;
    }

    /** @type {float64} */
    let cost = 0;
    for (let i = 0; i < a.length; ++i) {
      /** @type {float64} */
      const fa = a[i];
      /** @type {float64} */
      const fb = b[i];
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

  /**
   * Package-merge item: a weight and the symbols it covers.
   */
  class PackageItem {
    /**
     * @param {float64} weight - Summed frequency
     * @param {int32[]} symbols - Covered symbols
     */
    constructor(weight, symbols) {
      /** @type {float64} */
      this.weight = weight;
      /** @type {int32[]} */
      this.symbols = symbols;
    }
  }

  // Merges two weight-ascending lists into one, preferring the first list on
  // ties so the result does not depend on any sort implementation.
  /**
   * @param {PackageItem[]} first - Weight-ascending list, wins ties
   * @param {PackageItem[]} second - Weight-ascending list
   * @returns {PackageItem[]} Merged weight-ascending list
   */
  function mergeAscending(first, second) {
    /** @type {PackageItem[]} */
    const merged = [];
    /** @type {int32} */
    let i = 0;
    /** @type {int32} */
    let j = 0;
    while (i < first.length && j < second.length) {
      if (first[i].weight <= second[j].weight) {
        merged.push(first[i++]);
      } else {
        merged.push(second[j++]);
      }
    }
    while (i < first.length) {
      merged.push(first[i++]);
    }
    while (j < second.length) {
      merged.push(second[j++]);
    }
    return merged;
  }

  /**
   * @param {int32[]} frequencies - Frequency per symbol
   * @param {int32} alphabetSize - Alphabet size
   * @param {int32} maxLength - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildCodeLengths(frequencies, alphabetSize, maxLength) {
    /** @type {int32[]} */
    const lengths = filledArray(alphabetSize, 0);

    /** @type {int32[]} */
    const used = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (frequencies[symbol] > 0) {
        used.push(symbol);
      }
    }

    if (used.length === 0) {
      return lengths;
    }
    if (used.length === 1) {
      lengths[used[0]] = 1;
      return lengths;
    }

    // Ordered by (weight, symbol) - a total order, so an insertion sort gives
    // exactly the order any correct sort gives. `used` is symbol-ascending, so
    // inserting after equal weights keeps the symbol order.
    /** @type {PackageItem[]} */
    const basis = [];
    for (let u = 0; u < used.length; ++u) {
      /** @type {int32[]} */
      const single = [used[u]];
      /** @type {PackageItem} */
      const item = new PackageItem(frequencies[used[u]], single);
      /** @type {int32} */
      let at = basis.length;
      basis.push(item);
      while (at > 0 && basis[at - 1].weight > item.weight) {
        basis[at] = basis[at - 1];
        --at;
      }
      basis[at] = item;
    }

    /** @type {PackageItem[]} */
    let list = basis;
    for (let level = 2; level <= maxLength; ++level) {
      /** @type {PackageItem[]} */
      const packaged = [];
      for (let i = 0; i + 1 < list.length; i += 2) {
        /** @type {int32[]} */
        const combined = [];
        /** @type {int32[]} */
        const left = list[i].symbols;
        /** @type {int32[]} */
        const right = list[i + 1].symbols;
        for (let k = 0; k < left.length; ++k) {
          combined.push(left[k]);
        }
        for (let k = 0; k < right.length; ++k) {
          combined.push(right[k]);
        }
        packaged.push(new PackageItem(list[i].weight + list[i + 1].weight, combined));
      }
      list = mergeAscending(packaged, basis);
    }

    /** @type {int32} */
    const take = Math.min(2 * used.length - 2, list.length);
    for (let i = 0; i < take; ++i) {
      /** @type {int32[]} */
      const symbols = list[i].symbols;
      for (let k = 0; k < symbols.length; ++k) {
        lengths[symbols[k]]++;
      }
    }
    return lengths;
  }

  // Rewrites code lengths that will be transmitted as a simple prefix code
  // (RFC 7932 Section 3.4). The implied lengths are positional and the symbols
  // are always written in ascending order, so the shortest code goes to the
  // smallest symbol - exactly what a canonical code does for equal lengths.
  /**
   * @param {int32[]} lengths - Code lengths, rewritten in place
   * @param {int32} alphabetSize - Alphabet size
   */
  function normalizeSimpleCode(lengths, alphabetSize) {
    /** @type {int32[]} */
    const used = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (lengths[symbol] > 0) {
        used.push(symbol);
      }
    }

    if (used.length === 2) {
      lengths[used[0]] = 1;
      lengths[used[1]] = 1;
    } else if (used.length === 3) {
      lengths[used[0]] = 1;
      lengths[used[1]] = 2;
      lengths[used[2]] = 2;
    } else if (used.length === 4) {
      for (let i = 0; i < 4; ++i) {
        lengths[used[i]] = 2;
      }
    }
  }

  /**
   * Canonical prefix code for encoding.
   */
  class PrefixCode {
    /**
     * @param {int32[]} lengths - Code length per symbol
     * @param {int32[]} codes - Code value per symbol, or null for a zero-bit code
     * @param {int32} singleSymbol - The only symbol of a zero-bit code, else -1
     */
    constructor(lengths, codes, singleSymbol) {
      /** @type {int32[]} */
      this.lengths = lengths;
      /** @type {int32[]} */
      this.codes = codes;
      /** @type {int32} */
      this.singleSymbol = singleSymbol;
    }
  }

  // Canonical code assignment - the exact encode-side mirror of
  // HuffmanTree.buildFromLengths's blCount/nextCode algorithm, recording a
  // {code, length} pair per symbol instead of a decode map. A code with a single
  // symbol decodes with zero bits (Section 3.5), so nothing is written for it.
  /**
   * @param {int32[]} lengths - Code length per symbol
   * @param {int32} alphabetSize - Alphabet size
   * @returns {PrefixCode} Canonical code
   */
  function makePrefixCode(lengths, alphabetSize) {
    /** @type {int32} */
    let usedCount = 0;
    /** @type {int32} */
    let lastSymbol = 0;
    /** @type {int32} */
    let maxLength = 0;
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (lengths[symbol] <= 0) {
        continue;
      }
      ++usedCount;
      lastSymbol = symbol;
      if (lengths[symbol] > maxLength) {
        maxLength = lengths[symbol];
      }
    }

    if (usedCount <= 1) {
      return new PrefixCode(lengths, null, lastSymbol);
    }

    /** @type {int32[]} */
    const lengthCounts = filledArray(maxLength + 1, 0);
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (lengths[symbol] > 0) {
        lengthCounts[lengths[symbol]]++;
      }
    }

    /** @type {int32[]} */
    const nextCode = filledArray(maxLength + 1, 0);
    /** @type {uint32} */
    let value = 0;
    for (let bits = 1; bits <= maxLength; ++bits) {
      value = OpCodes.Shl32(value + lengthCounts[bits - 1], 1);
      nextCode[bits] = value;
    }

    /** @type {int32[]} */
    const codes = filledArray(alphabetSize, 0);
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      /** @type {int32} */
      const length = lengths[symbol];
      if (length > 0) {
        codes[symbol] = nextCode[length]++;
      }
    }
    return new PrefixCode(lengths, codes, -1);
  }

  /**
   * @param {int32[]} frequencies - Frequency per symbol
   * @param {int32} alphabetSize - Alphabet size
   * @param {int32} maxLength - Longest allowed code
   * @returns {PrefixCode} Canonical code
   */
  function buildPrefixCode(frequencies, alphabetSize, maxLength) {
    /** @type {int32[]} */
    const lengths = buildCodeLengths(frequencies, alphabetSize, maxLength);

    /** @type {int32} */
    let usedCount = 0;
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (lengths[symbol] > 0) {
        ++usedCount;
      }
    }

    // An alphabet nothing was coded from still needs a descriptor; the NSYM=1
    // simple form costs the fewest bits and decodes to a zero-bit code.
    if (usedCount === 0) {
      lengths[0] = 1;
    } else if (usedCount <= 4) {
      normalizeSimpleCode(lengths, alphabetSize);
    }

    return makePrefixCode(lengths, alphabetSize);
  }

  // Writes one symbol, most significant bit of the canonical code first, which
  // is how HuffmanTree.decode reconstructs the tree path bit by bit.
  /**
   * @param {BitWriter} writer - Output
   * @param {PrefixCode} code - Prefix code
   * @param {int32} symbol - Symbol to write
   */
  function writeSymbol(writer, code, symbol) {
    if (code.singleSymbol >= 0) {
      return; // zero-bit code
    }
    /** @type {int32} */
    const length = code.lengths[symbol];
    /** @type {int32} */
    const value = code.codes[symbol];
    for (let i = length - 1; i >= 0; --i) {
      writer.writeBits(1, OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }
  }

  /**
   * @param {PrefixCode} code - Prefix code
   * @param {int32} symbol - Symbol
   * @returns {int32} Bits the symbol takes
   */
  function symbolBits(code, symbol) {
    return code.singleSymbol >= 0 ? 0 : code.lengths[symbol];
  }

  // The fixed 6-symbol code used to transmit each code-length-alphabet symbol's
  // own code length (0..5) - the exact bit-for-bit inverse of
  // readCodeLengthCodeLength above.
  /**
   * @param {BitWriter} writer - Output
   * @param {int32} value - Code length 0..5
   */
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

  /**
   * One planned code-length-alphabet symbol and its extra bits.
   */
  class CodeLengthEmission {
    /**
     * @param {int32} symbol - Code-length alphabet symbol
     * @param {int32} extraBits - Extra-bit count
     * @param {int32} extraValue - Extra-bit value
     */
    constructor(symbol, extraBits, extraValue) {
      /** @type {int32} */
      this.symbol = symbol;
      /** @type {int32} */
      this.extraBits = extraBits;
      /** @type {int32} */
      this.extraValue = extraValue;
    }
  }

  // Emits a planned complex prefix code descriptor (RFC 7932 Section 3.5).
  /**
   * @param {BitWriter} writer - Output
   * @param {CodeLengthEmission[]} emissions - Planned symbols
   */
  function emitComplexPrefixCodeDescriptor(writer, emissions) {
    /** @type {int32[]} */
    const frequencies = filledArray(NUM_CODE_LENGTH_CODES, 0);
    for (let i = 0; i < emissions.length; ++i) {
      frequencies[emissions[i].symbol]++;
    }

    /** @type {int32[]} */
    const clLengths = buildCodeLengths(frequencies, NUM_CODE_LENGTH_CODES, 5);
    /** @type {PrefixCode} */
    const clCode = makePrefixCode(clLengths, NUM_CODE_LENGTH_CODES);

    writer.writeBits(2, 0); // HSKIP = 0

    // Mirrors the decoder's `space` (Kraft sum, scaled by 32) tracker: once it
    // reaches zero the decoder stops reading code-length-code-lengths, so the
    // writer must stop emitting them at exactly the same point.
    /** @type {int32} */
    let space = 32;
    for (let i = 0; i < NUM_CODE_LENGTH_CODES && space > 0; ++i) {
      /** @type {int32} */
      const index = CODE_LENGTH_CODE_ORDER[i];
      /** @type {int32} */
      const length = clLengths[index];
      writeCodeLengthCodeLength(writer, length);
      if (length !== 0) {
        /** @type {uint32} */
        const share = OpCodes.Shr32(32, length);
        space -= share;
      }
    }

    for (let i = 0; i < emissions.length; ++i) {
      /** @type {CodeLengthEmission} */
      const emission = emissions[i];
      writeSymbol(writer, clCode, emission.symbol);
      if (emission.extraBits > 0) {
        writer.writeBits(emission.extraBits, emission.extraValue);
      }
    }
  }

  // Spells out every code length individually.
  /**
   * @param {int32[]} lengths - Code lengths
   * @param {int32} lastNonZero - Last symbol with a code
   * @returns {CodeLengthEmission[]} Planned symbols
   */
  function planPlainEmissions(lengths, lastNonZero) {
    /** @type {CodeLengthEmission[]} */
    const emissions = [];
    for (let symbol = 0; symbol <= lastNonZero; ++symbol) {
      emissions.push(new CodeLengthEmission(lengths[symbol], 0, 0));
    }
    return emissions;
  }

  // Plans a run of at least three zeros with code 17. Consecutive 17s chain in
  // the decoder as run = ((run - 2) * 8) + delta + 3, so N emissions with deltas
  // d(1)..d(N) produce sum(8^(N-i) * d(i)) + (8^N + 13) / 7 zeros.
  /**
   * @param {CodeLengthEmission[]} emissions - Plan, appended to
   * @param {int32} count - Zeros in the run
   */
  function planZeroRun(emissions, count) {
    /** @type {int32} */
    let n = 1;
    while (Math.floor((POW2[3 * (n + 1)] + 6) / 7) < count) {
      ++n;
    }

    /** @type {float64} */
    let remaining = count - Math.floor((POW2[3 * n] + 13) / 7);
    for (let i = 0; i < n; ++i) {
      /** @type {float64} */
      const weight = POW2[3 * (n - 1 - i)];
      /** @type {float64} */
      const delta = Math.min(Math.floor(remaining / weight), 7);
      emissions.push(new CodeLengthEmission(REPEAT_ZERO_CODE_LENGTH, 3, delta));
      remaining -= delta * weight;
    }
  }

  // Plans a repeat of the previous non-zero length with code 16. Consecutive 16s
  // chain as run = ((run - 2) * 4) + delta + 3, so N emissions with deltas
  // d(1)..d(N) produce sum(4^(N-i) * d(i)) + (4^N + 5) / 3 repeats.
  /**
   * @param {CodeLengthEmission[]} emissions - Plan, appended to
   * @param {int32} count - Repeats in the run
   */
  function planRepeatRun(emissions, count) {
    /** @type {int32} */
    let n = 1;
    while (Math.floor((POW2[2 * (n + 1)] + 2) / 3) < count) {
      ++n;
    }

    /** @type {float64} */
    let remaining = count - Math.floor((POW2[2 * n] + 5) / 3);
    for (let i = 0; i < n; ++i) {
      /** @type {float64} */
      const weight = POW2[2 * (n - 1 - i)];
      /** @type {float64} */
      const delta = Math.min(Math.floor(remaining / weight), 3);
      emissions.push(new CodeLengthEmission(REPEAT_PREVIOUS_CODE_LENGTH, 2, delta));
      remaining -= delta * weight;
    }
  }

  // Folds runs into the repeat codes 16 and 17.
  /**
   * @param {int32[]} lengths - Code lengths
   * @param {int32} lastNonZero - Last symbol with a code
   * @returns {CodeLengthEmission[]} Planned symbols
   */
  function planRunLengthEmissions(lengths, lastNonZero) {
    /** @type {CodeLengthEmission[]} */
    const emissions = [];
    /** @type {int32} */
    let i = 0;
    while (i <= lastNonZero) {
      /** @type {int32} */
      const length = lengths[i];
      /** @type {int32} */
      let runEnd = i;
      while (runEnd + 1 <= lastNonZero && lengths[runEnd + 1] === length) {
        ++runEnd;
      }
      /** @type {int32} */
      const runLength = runEnd - i + 1;

      if (length === 0 && runLength >= 3) {
        planZeroRun(emissions, runLength);
      } else if (length > 0 && runLength >= 4) {
        emissions.push(new CodeLengthEmission(length, 0, 0));
        planRepeatRun(emissions, runLength - 1);
      } else {
        for (let j = 0; j < runLength; ++j) {
          emissions.push(new CodeLengthEmission(length, 0, 0));
        }
      }

      i = runEnd + 1;
    }
    return emissions;
  }

  // Bits a planned emission stream occupies, or -1 when the plan is unusable
  // because its code-length alphabet would hold a single symbol (an incomplete
  // code that decoders are not required to accept in this position).
  /**
   * @param {CodeLengthEmission[]} emissions - Planned symbols
   * @returns {float64} Bits, or -1
   */
  function measureEmissions(emissions) {
    /** @type {boolean[]} */
    const seen = new Array(NUM_CODE_LENGTH_CODES);
    seen.fill(false);
    /** @type {int32} */
    let distinct = 0;
    for (let i = 0; i < emissions.length; ++i) {
      /** @type {int32} */
      const symbol = emissions[i].symbol;
      if (seen[symbol]) {
        continue;
      }
      seen[symbol] = true;
      ++distinct;
    }
    if (distinct < 2) {
      return -1;
    }

    /** @type {BitWriter} */
    const scratch = new BitWriter();
    emitComplexPrefixCodeDescriptor(scratch, emissions);
    /** @type {float64} */
    const bits = scratch.bitLength();
    return bits;
  }

  // Two symbol streams are planned - one that spells out every code length and
  // one that folds runs into the repeat codes - and the cheaper one wins.
  /**
   * @param {BitWriter} writer - Output
   * @param {int32[]} lengths - Code lengths
   * @param {int32} alphabetSize - Alphabet size
   */
  function writeComplexPrefixCodeDescriptor(writer, lengths, alphabetSize) {
    /** @type {int32} */
    let lastNonZero = 0;
    for (let symbol = alphabetSize - 1; symbol >= 0; --symbol) {
      if (lengths[symbol] > 0) {
        lastNonZero = symbol;
        break;
      }
    }

    /** @type {CodeLengthEmission[]} */
    const plain = planPlainEmissions(lengths, lastNonZero);
    /** @type {CodeLengthEmission[]} */
    const runLength = planRunLengthEmissions(lengths, lastNonZero);
    /** @type {float64} */
    const plainBits = measureEmissions(plain);
    /** @type {float64} */
    const runLengthBits = measureEmissions(runLength);
    /** @type {CodeLengthEmission[]} */
    const chosen = plainBits >= 0 && (runLengthBits < 0 || plainBits <= runLengthBits) ? plain : runLength;

    emitComplexPrefixCodeDescriptor(writer, chosen);
  }

  // Alphabets with at most four coded symbols use the simple form of RFC 7932
  // Section 3.4; everything else uses the complex form of Section 3.5.
  /**
   * @param {BitWriter} writer - Output
   * @param {PrefixCode} code - Prefix code
   * @param {int32} alphabetSize - Alphabet size
   */
  function writePrefixCodeDescriptor(writer, code, alphabetSize) {
    /** @type {int32[]} */
    const used = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (code.lengths[symbol] > 0) {
        used.push(symbol);
      }
    }

    if (used.length > 4) {
      writeComplexPrefixCodeDescriptor(writer, code.lengths, alphabetSize);
      return;
    }

    writer.writeBits(2, 1); // HSKIP = 1 selects the simple prefix code form
    writer.writeBits(2, used.length - 1); // NSYM - 1

    /** @type {int32} */
    const symbolBitCount = alphabetBits(alphabetSize);
    for (let i = 0; i < used.length; ++i) {
      writer.writeBits(symbolBitCount, used[i]);
    }

    // tree-select 0 gives all four symbols length 2; the 1/2/3/3 shape is never
    // used because its lengths would then follow symbol order, not frequency.
    if (used.length === 4) {
      writer.writeBits(1, 0);
    }
  }

  // Number of bits an alphabet index occupies in a simple prefix code.
  /**
   * @param {int32} alphabetSize - Alphabet size
   * @returns {int32} Bits per symbol index
   */
  function alphabetBits(alphabetSize) {
    /** @type {int32} */
    let bits = 1;
    while (POW2[bits] < alphabetSize) {
      ++bits;
    }
    return bits;
  }

  /**
   * @param {PrefixCode} code - Prefix code
   * @param {int32} alphabetSize - Alphabet size
   * @returns {float64} Descriptor bits
   */
  function measureDescriptorBits(code, alphabetSize) {
    /** @type {BitWriter} */
    const scratch = new BitWriter();
    writePrefixCodeDescriptor(scratch, code, alphabetSize);
    /** @type {float64} */
    const bits = scratch.bitLength();
    return bits;
  }

  // Writes a block-type or tree count using the variable-length code of RFC 7932
  // Section 9.2: 1 is a single zero bit, 2 is "1" plus three zero bits, and any
  // larger N is "1", three bits of nbits, then nbits of N - 1 - 2 to the nbits.
  /**
   * @param {BitWriter} writer - Output
   * @param {int32} count - Count to write
   */
  function writeCount(writer, count) {
    if (count === 1) {
      writer.writeBits(1, 0);
      return;
    }
    writer.writeBits(1, 1);

    /** @type {int32} */
    const value = count - 1;
    if (value === 1) {
      writer.writeBits(3, 0);
      return;
    }

    /** @type {int32} */
    let bits = 0;
    /** @type {float64} */
    let v = value;
    while (v > 1) {
      v = Math.floor(v / 2);
      ++bits;
    }
    writer.writeBits(3, bits);
    writer.writeBits(bits, value - POW2[bits]);
  }

  // ===== ENCODER: INSERT/COPY AND DISTANCE CODE INVERSION =====

  // Finds the bucket index i such that bases[i] <= value, scanning from the
  // top since bucket bases are monotonically increasing and contiguous.
  /**
   * @param {int32[]} bases - Bucket bases
   * @param {int32} value - Length
   * @returns {int32} Bucket index
   */
  function findLengthCode(bases, value) {
    for (let i = bases.length - 1; i >= 0; --i) {
      if (value >= bases[i]) {
        return i;
      }
    }
    return 0;
  }

  // Combines an insert length code and a copy length code (RFC 7932 Table 8).
  /**
   * @param {int32} insertCode - Insert length code
   * @param {int32} copyCode - Copy length code
   * @param {boolean} implicitDistance - Uses the implicit-distance ranges
   * @returns {int32} Insert-and-copy symbol, or -1
   */
  function encodeInsertAndCopyCode(insertCode, copyCode, implicitDistance) {
    for (let b = 0; b < RANGE_INSERT_BASE.length; ++b) {
      if (RANGE_IMPLICIT_DISTANCE[b] !== implicitDistance) {
        continue;
      }
      /** @type {int32} */
      const insertOffset = insertCode - RANGE_INSERT_BASE[b];
      /** @type {int32} */
      const copyOffset = copyCode - RANGE_COPY_BASE[b];
      if (insertOffset >= 0 && insertOffset <= 7 && copyOffset >= 0 && copyOffset <= 7) {
        return b * 64 + insertOffset * 8 + copyOffset;
      }
    }
    return -1;
  }

  // Returns the ring buffer distance code 0-15 that reproduces `distance`, or -1
  // when none does (RFC 7932 Section 4).
  /**
   * @param {int32} distance - Distance
   * @param {int32[]} ring - Four most recent distances
   * @returns {int32} Ring code, or -1
   */
  function findRingDistanceCode(distance, ring) {
    for (let i = 0; i < 4; ++i) {
      if (distance === ring[i]) {
        return i;
      }
    }
    if (distance === ring[0] - 1) {
      return 4;
    }
    if (distance === ring[0] + 1) {
      return 5;
    }
    if (distance === ring[0] - 2) {
      return 6;
    }
    if (distance === ring[0] + 2) {
      return 7;
    }
    if (distance === ring[0] - 3) {
      return 8;
    }
    if (distance === ring[0] + 3) {
      return 9;
    }
    if (distance === ring[1] - 1) {
      return 10;
    }
    if (distance === ring[1] + 1) {
      return 11;
    }
    if (distance === ring[1] - 2) {
      return 12;
    }
    if (distance === ring[1] + 2) {
      return 13;
    }
    if (distance === ring[1] - 3) {
      return 14;
    }
    if (distance === ring[1] + 3) {
      return 15;
    }
    return -1;
  }

  /**
   * Explicit distance code with its extra bits.
   */
  class DistanceCodeInfo {
    /**
     * @param {int32} code - Distance symbol
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

  // Inverts the NPOSTFIX=0, NDIRECT=0 distance formula of RFC 7932 Section 4:
  // for code 16 + b the decoder reads nbits = 1 + b / 2 extra bits and forms
  // ((2 + (b mod 2)) * 2 to the nbits) - 4 + extra + 1.
  /**
   * @param {int32} distance - Distance
   * @returns {DistanceCodeInfo} Distance code
   */
  function encodeDistance(distance) {
    for (let b = 0; b < 48; ++b) {
      /** @type {int32} */
      const extraBits = 1 + Math.floor(b / 2);
      /** @type {int32} */
      const offset = OpCodes.Shl32(2 + (b % 2), extraBits) - 4;
      /** @type {int32} */
      const first = offset + 1;
      /** @type {float64} */
      const last = offset + POW2[extraBits];
      if (distance >= first && distance <= last) {
        return new DistanceCodeInfo(16 + b, extraBits, distance - first);
      }
    }
    throw new Error('Distance out of representable range: ' + distance);
  }

  /**
   * @param {int32} distance - Distance
   * @returns {int32} Extra bits its explicit code needs
   */
  function distanceExtraBits(distance) {
    for (let b = 0; b < 48; ++b) {
      /** @type {int32} */
      const extraBits = 1 + Math.floor(b / 2);
      /** @type {int32} */
      const offset = OpCodes.Shl32(2 + (b % 2), extraBits) - 4;
      if (distance >= offset + 1 && distance <= offset + POW2[extraBits]) {
        return extraBits;
      }
    }
    return 24;
  }

  // ===== ENCODER: STATIC DICTIONARY MATCH FINDER (RFC 7932 Section 8) =====
  //
  // A copy command whose distance exceeds the maximum in-window backward
  // distance addresses the 122,784-byte static word list of Appendix A instead
  // of the sliding window. RFC 7932 Section 8 decodes such a reference as
  //
  //   word_id      = distance - max_allowed_distance - 1
  //   index        = word_id mod NWORDS[copy_length]
  //   transform_id = word_id div NWORDS[copy_length]
  //   output       = prefix(transform_id) + T(base_word) + suffix(transform_id)
  //
  // where max_allowed_distance is min(window size, bytes produced so far) and
  // the *copy length* selects the length class of the base word - the number of
  // bytes the reference actually produces is the length of the transformed word,
  // which the transform may shorten or lengthen.
  //
  // The encoder therefore has to find, at a given input position, a (length,
  // index, transform_id) triple whose transformed word is a prefix of the
  // remaining input. Transforms are grouped by their prefix and by their
  // elementary word operation, so one hash probe per prefix locates every
  // candidate base word:
  //
  //   * Identity and OmitLast1..9 all leave the *head* of the base word intact,
  //     so a single index entry keyed on the first four bytes of the base word
  //     serves all ten - the longest common prefix decides which of them fit.
  //   * FermentFirst and FermentAll change bytes in place without changing the
  //     length, so each gets its own index entry keyed on the first four bytes
  //     of the already-fermented word.
  //   * OmitFirst1..9 shift the word head out of view and would need a separate
  //     index per omission count; those eight transforms are not searched. They
  //     all carry an empty prefix and suffix, so nothing else is lost with them.

  /** @type {int32} */
  const DICT_MIN_WORD_LENGTH = 4;
  /** @type {int32} */
  const DICT_MAX_WORD_LENGTH = 24;
  /** @type {int32} */
  const DICT_HASH_BITS = 16;
  /** @type {int32} */
  const DICT_HASH_SIZE = OpCodes.Shl32(1, DICT_HASH_BITS);
  /** @type {int32} */
  const DICT_OP_HEAD = 0;
  /** @type {int32} */
  const DICT_OP_FERMENT_FIRST = 1;
  /** @type {int32} */
  const DICT_OP_FERMENT_ALL = 2;

  // RFC 7932 Appendix B elementary transform ids.
  /** @type {int32} */
  const TID_IDENTITY = 0;
  /** @type {int32} */
  const TID_FERMENT_FIRST = 1;
  /** @type {int32} */
  const TID_FERMENT_ALL = 2;
  /** @type {int32} */
  const TID_OMIT_FIRST_LOW = 3;
  /** @type {int32} */
  const TID_OMIT_FIRST_HIGH = 11;
  /** @type {int32} */
  const TID_OMIT_LAST_BASE = 11; // OmitLast_k has elementary id TID_OMIT_LAST_BASE + k
  /** @type {int32} */
  const TID_COUNT = 21;

  // Transform ids of the two pure case-flip transforms (empty prefix and suffix),
  // used to precompute the fermented copies of the whole word list.
  /** @type {int32} */
  const TRANSFORM_FERMENT_FIRST_ONLY = 9;
  /** @type {int32} */
  const TRANSFORM_FERMENT_ALL_ONLY = 44;

  // Shortest transformed word worth a copy command of its own.
  /** @type {int32} */
  const DICT_MIN_OUTPUT = 4;

  // Assumed cost of one literal when deciding whether a dictionary reference
  // repays the command that carries it.
  /** @type {int32} */
  const DICTIONARY_LITERAL_BITS = 8;

  /** @type {int32[]} */
  const NWORDS = BrotliDictionary.Table('NWORDS');
  /** @type {int32[]} */
  const DOFFSET = BrotliDictionary.Table('DOFFSET');

  /**
   * @param {string} text - Latin-1 text
   * @returns {uint8[]} Its character codes
   */
  function stringBytes(text) {
    /** @type {uint8[]} */
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; ++i) {
      bytes[i] = text.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * @param {uint8[]} a - First array
   * @param {uint8[]} b - Second array
   * @returns {boolean} True when both hold the same bytes
   */
  function sameByteArrays(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * One searchable transform: its id and suffix.
   */
  class DictionaryTransform {
    /**
     * @param {int32} id - Transform id
     * @param {uint8[]} suffix - Suffix bytes
     */
    constructor(id, suffix) {
      /** @type {int32} */
      this.id = id;
      /** @type {uint8[]} */
      this.suffix = suffix;
    }
  }

  /**
   * Transforms sharing a prefix and an elementary operation, by suffix start.
   */
  class TransformSlot {
    constructor() {
      /** @type {DictionaryTransform[]} */
      this.empty = [];
      /** @type {DictionaryTransform[][]} */
      this.byByte = new Array(256);
      this.byByte.fill(null);
    }
  }

  /**
   * Transforms sharing a prefix, by elementary operation.
   */
  class DictionaryGroup {
    /**
     * @param {uint8[]} prefix - Prefix bytes
     */
    constructor(prefix) {
      /** @type {uint8[]} */
      this.prefix = prefix;
      /** @type {TransformSlot[]} */
      this.byTid = new Array(TID_COUNT);
      this.byTid.fill(null);
    }
  }

  // Groups the searchable transforms by prefix, then by elementary operation,
  // then by the first byte of the suffix, so a match only has to test the
  // handful of transforms whose suffix can possibly follow.
  /**
   * @returns {DictionaryGroup[]} Transform groups
   */
  function buildDictionaryGroups() {
    /** @type {string[]} */
    const prefixes = BrotliDictionary.Table('TRANSFORM_PREFIXES');
    /** @type {int32[]} */
    const types = BrotliDictionary.Table('TRANSFORM_TYPES');
    /** @type {string[]} */
    const suffixes = BrotliDictionary.Table('TRANSFORM_SUFFIXES');
    /** @type {DictionaryGroup[]} */
    const groups = [];

    for (let id = 0; id < types.length; ++id) {
      /** @type {int32} */
      const tid = types[id];
      if (tid >= TID_OMIT_FIRST_LOW && tid <= TID_OMIT_FIRST_HIGH) {
        continue;
      }

      /** @type {uint8[]} */
      const prefix = stringBytes(prefixes[id]);
      /** @type {uint8[]} */
      const suffix = stringBytes(suffixes[id]);

      /** @type {int32} */
      let groupIndex = -1;
      for (let i = 0; i < groups.length; ++i) {
        if (sameByteArrays(groups[i].prefix, prefix)) {
          groupIndex = i;
          break;
        }
      }
      if (groupIndex < 0) {
        groups.push(new DictionaryGroup(prefix));
        groupIndex = groups.length - 1;
      }

      /** @type {DictionaryGroup} */
      const group = groups[groupIndex];
      if (group.byTid[tid] === null) {
        group.byTid[tid] = new TransformSlot();
      }

      /** @type {TransformSlot} */
      const slot = group.byTid[tid];
      /** @type {DictionaryTransform} */
      const entry = new DictionaryTransform(id, suffix);
      if (suffix.length === 0) {
        slot.empty.push(entry);
        continue;
      }
      if (slot.byByte[suffix[0]] === null) {
        /** @type {DictionaryTransform[]} */
        const list = [];
        slot.byByte[suffix[0]] = list;
      }
      slot.byByte[suffix[0]].push(entry);
    }

    return groups;
  }

  /** @type {DictionaryGroup[]} */
  const DICTIONARY_GROUPS = buildDictionaryGroups();

  // Hash of four bytes, the same multiply-shift the window match finder uses.
  /**
   * @param {uint8} b0 - First byte
   * @param {uint8} b1 - Second byte
   * @param {uint8} b2 - Third byte
   * @param {uint8} b3 - Fourth byte
   * @returns {uint32} Bucket
   */
  function hashFourBytes(b0, b1, b2, b3) {
    /** @type {uint32} */
    const word = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(b0, 24), OpCodes.Shl32(b1, 16)),
      OpCodes.Or32(OpCodes.Shl32(b2, 8), b3)
    );
    return OpCodes.Shr32(OpCodes.Mul32(word, 2654435761), 32 - DICT_HASH_BITS);
  }

  // The word list in three forms: untouched, every word with its first character
  // case-flipped, and every word with all characters case-flipped (RFC 7932
  // Section 8's FermentFirst and FermentAll). Neither ferment changes a word's
  // length, so all three share the DOFFSET layout of the original.
  /**
   * @returns {uint8[][]} Untouched, FermentFirst and FermentAll word lists
   */
  function buildDictionaryForms() {
    /** @type {uint8[]} */
    const dict = BrotliDictionary.Table('DICT');
    /** @type {uint8[]} */
    const base = new Uint8Array(dict.length);
    for (let i = 0; i < dict.length; ++i) {
      base[i] = dict[i];
    }
    /** @type {uint8[]} */
    const fermentFirst = new Uint8Array(base.length);
    /** @type {uint8[]} */
    const fermentAll = new Uint8Array(base.length);

    for (let length = DICT_MIN_WORD_LENGTH; length <= DICT_MAX_WORD_LENGTH; ++length) {
      /** @type {int32} */
      const count = NWORDS[length];
      for (let index = 0; index < count; ++index) {
        /** @type {int32} */
        const offset = DOFFSET[length] + index * length;
        /** @type {uint8[]} */
        const word = new Array(length);
        for (let i = 0; i < length; ++i) {
          word[i] = base[offset + i];
        }
        /** @type {uint8[]} */
        const first = BrotliDictionary.ApplyTransform(word, TRANSFORM_FERMENT_FIRST_ONLY);
        /** @type {uint8[]} */
        const all = BrotliDictionary.ApplyTransform(word, TRANSFORM_FERMENT_ALL_ONLY);
        for (let i = 0; i < length; ++i) {
          fermentFirst[offset + i] = first[i];
          fermentAll[offset + i] = all[i];
        }
      }
    }

    /** @type {uint8[][]} */
    const forms = [base, fermentFirst, fermentAll];
    return forms;
  }

  /**
   * Hash index over every word form: chained entries keyed on four bytes.
   */
  class DictionaryIndex {
    /**
     * @param {uint8[][]} forms - Word list forms
     * @param {int32[]} head - First entry per bucket
     * @param {int32[]} next - Next entry per entry
     * @param {uint8[]} entryLength - Word length per entry
     * @param {uint16[]} entryIndex - Word index per entry
     * @param {uint8[]} entryOp - Word form per entry
     */
    constructor(forms, head, next, entryLength, entryIndex, entryOp) {
      /** @type {uint8[][]} */
      this.forms = forms;
      /** @type {int32[]} */
      this.head = head;
      /** @type {int32[]} */
      this.next = next;
      /** @type {uint8[]} */
      this.entryLength = entryLength;
      /** @type {uint16[]} */
      this.entryIndex = entryIndex;
      /** @type {uint8[]} */
      this.entryOp = entryOp;
    }
  }

  /** @type {DictionaryIndex} */
  let DICTIONARY_INDEX = null;

  /**
   * @returns {DictionaryIndex} The hash index, built on first use
   */
  function dictionaryIndex() {
    if (DICTIONARY_INDEX !== null) {
      return DICTIONARY_INDEX;
    }

    /** @type {uint8[][]} */
    const forms = buildDictionaryForms();
    /** @type {int32} */
    let total = 0;
    for (let length = DICT_MIN_WORD_LENGTH; length <= DICT_MAX_WORD_LENGTH; ++length) {
      total += NWORDS[length];
    }
    total = total * forms.length;

    /** @type {int32[]} */
    const head = new Int32Array(DICT_HASH_SIZE);
    head.fill(-1);
    /** @type {int32[]} */
    const next = new Int32Array(total);
    next.fill(-1);
    /** @type {uint8[]} */
    const entryLength = new Uint8Array(total);
    /** @type {uint16[]} */
    const entryIndex = new Uint16Array(total);
    /** @type {uint8[]} */
    const entryOp = new Uint8Array(total);

    /** @type {int32} */
    let count = 0;
    for (let op = 0; op < forms.length; ++op) {
      /** @type {uint8[]} */
      const source = forms[op];
      for (let length = DICT_MIN_WORD_LENGTH; length <= DICT_MAX_WORD_LENGTH; ++length) {
        /** @type {int32} */
        const words = NWORDS[length];
        for (let index = 0; index < words; ++index) {
          /** @type {int32} */
          const offset = DOFFSET[length] + index * length;
          /** @type {uint32} */
          const bucket = hashFourBytes(source[offset], source[offset + 1],
            source[offset + 2], source[offset + 3]);
          entryLength[count] = length;
          entryIndex[count] = index;
          entryOp[count] = op;
          next[count] = head[bucket];
          head[bucket] = count;
          ++count;
        }
      }
    }

    DICTIONARY_INDEX = new DictionaryIndex(forms, head, next, entryLength, entryIndex, entryOp);
    return DICTIONARY_INDEX;
  }

  // Approximate bit cost of a dictionary reference. The copy length code covers
  // the *base word* length; the distance is always explicit because the ring
  // buffer never holds a dictionary distance (RFC 7932 Section 4).
  /**
   * @param {int32} copyLength - Base word length
   * @param {int32} distance - Dictionary distance
   * @returns {int32} Approximate bits
   */
  function dictionaryMatchCost(copyLength, distance) {
    /** @type {int32} */
    const copyCode = findLengthCode(COPY_LENGTH_BASE, copyLength);
    return ESTIMATED_COMMAND_BITS + COPY_LENGTH_EXTRA[copyCode] +
      ESTIMATED_DISTANCE_BITS + distanceExtraBits(distance);
  }

  /**
   * A static dictionary reference candidate.
   */
  class DictionaryMatch {
    /**
     * @param {int32} copyLength - Base word length
     * @param {int32} outputLength - Bytes produced
     * @param {int32} distance - Dictionary distance
     * @param {int32} score - Ranking score
     */
    constructor(copyLength, outputLength, distance, score) {
      /** @type {int32} */
      this.copyLength = copyLength;
      /** @type {int32} */
      this.outputLength = outputLength;
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.score = score;
    }
  }

  // Tests one list of transforms that share a prefix and an elementary word
  // operation, keeping the best reference found so far. Ties are broken towards
  // the smaller distance so the result never depends on traversal order.
  /**
   * @param {uint8[]} data - Input
   * @param {int32} maxAllowedDistance - Decoder's maximum backward distance
   * @param {DictionaryTransform[]} list - Transforms to test
   * @param {int32} wordLength - Base word length
   * @param {int32} wordIndex - Base word index
   * @param {int32} headLength - Prefix plus word bytes already matched
   * @param {int32} suffixStart - Input position of the suffix
   * @param {DictionaryMatch} best - Best so far, or null
   * @returns {DictionaryMatch} Best after this list, or null
   */
  function considerDictionaryList(data, maxAllowedDistance, list,
    wordLength, wordIndex, headLength, suffixStart, best) {
    for (let i = 0; i < list.length; ++i) {
      /** @type {DictionaryTransform} */
      const candidate = list[i];
      /** @type {uint8[]} */
      const suffix = candidate.suffix;
      if (suffixStart + suffix.length > data.length) {
        continue;
      }

      /** @type {boolean} */
      let matches = true;
      for (let k = 0; k < suffix.length; ++k) {
        if (data[suffixStart + k] !== suffix[k]) {
          matches = false;
          break;
        }
      }
      if (!matches) {
        continue;
      }

      /** @type {int32} */
      const outputLength = headLength + suffix.length;
      if (outputLength < DICT_MIN_OUTPUT) {
        continue;
      }

      /** @type {int32} */
      const distance = maxAllowedDistance + 1 + candidate.id * NWORDS[wordLength] + wordIndex;
      /** @type {int32} */
      const cost = dictionaryMatchCost(wordLength, distance);
      if (outputLength * DICTIONARY_LITERAL_BITS <= cost) {
        continue;
      }

      /** @type {int32} */
      const score = outputLength * MATCH_RANK_LITERAL_BITS - cost;
      if (best !== null && (score < best.score || (score === best.score && distance >= best.distance))) {
        continue;
      }

      best = new DictionaryMatch(wordLength, outputLength, distance, score);
    }
    return best;
  }

  /**
   * @param {uint8[]} data - Input
   * @param {int32} maxAllowedDistance - Decoder's maximum backward distance
   * @param {DictionaryGroup} group - Transforms with the matched prefix
   * @param {int32} tid - Elementary transform id
   * @param {int32} wordLength - Base word length
   * @param {int32} wordIndex - Base word index
   * @param {int32} headLength - Prefix plus word bytes already matched
   * @param {int32} suffixStart - Input position of the suffix
   * @param {DictionaryMatch} best - Best so far, or null
   * @returns {DictionaryMatch} Best after these transforms, or null
   */
  function considerDictionaryTransforms(data, maxAllowedDistance, group, tid,
    wordLength, wordIndex, headLength, suffixStart, best) {
    /** @type {TransformSlot} */
    const slot = group.byTid[tid];
    if (slot === null) {
      return best;
    }

    best = considerDictionaryList(data, maxAllowedDistance, slot.empty,
      wordLength, wordIndex, headLength, suffixStart, best);

    if (suffixStart >= data.length) {
      return best;
    }
    /** @type {DictionaryTransform[]} */
    const list = slot.byByte[data[suffixStart]];
    if (list === null) {
      return best;
    }

    return considerDictionaryList(data, maxAllowedDistance, list,
      wordLength, wordIndex, headLength, suffixStart, best);
  }

  // Best static dictionary reference at `position`, or null when none pays off.
  // `maxAllowedDistance` must be the value the decoder will compute, that is
  // min(window size, bytes produced so far).
  /**
   * @param {uint8[]} data - Input
   * @param {int32} position - Input position
   * @param {int32} maxAllowedDistance - Decoder's maximum backward distance
   * @returns {DictionaryMatch} Best reference, or null
   */
  function findDictionaryMatch(data, position, maxAllowedDistance) {
    /** @type {DictionaryIndex} */
    const index = dictionaryIndex();
    /** @type {DictionaryMatch} */
    let best = null;

    for (let g = 0; g < DICTIONARY_GROUPS.length; ++g) {
      /** @type {DictionaryGroup} */
      const group = DICTIONARY_GROUPS[g];
      /** @type {uint8[]} */
      const prefix = group.prefix;
      /** @type {int32} */
      const wordStart = position + prefix.length;
      if (wordStart + DICT_MIN_WORD_LENGTH > data.length) {
        continue;
      }

      /** @type {boolean} */
      let prefixMatches = true;
      for (let i = 0; i < prefix.length; ++i) {
        if (data[position + i] !== prefix[i]) {
          prefixMatches = false;
          break;
        }
      }
      if (!prefixMatches) {
        continue;
      }

      /** @type {uint32} */
      const bucket = hashFourBytes(data[wordStart], data[wordStart + 1],
        data[wordStart + 2], data[wordStart + 3]);

      for (let e = index.head[bucket]; e >= 0; e = index.next[e]) {
        /** @type {int32} */
        const wordLength = index.entryLength[e];
        /** @type {int32} */
        const wordIndex = index.entryIndex[e];
        /** @type {int32} */
        const op = index.entryOp[e];
        /** @type {uint8[]} */
        const source = index.forms[op];
        /** @type {int32} */
        const offset = DOFFSET[wordLength] + wordIndex * wordLength;

        /** @type {int32} */
        const limit = Math.min(wordLength, data.length - wordStart);
        /** @type {int32} */
        let common = 0;
        while (common < limit && source[offset + common] === data[wordStart + common]) {
          ++common;
        }
        if (common < DICT_MIN_WORD_LENGTH) {
          continue;
        }

        if (op !== DICT_OP_HEAD) {
          if (common !== wordLength) {
            continue;
          }
          /** @type {int32} */
          const tid = op === DICT_OP_FERMENT_FIRST ? TID_FERMENT_FIRST : TID_FERMENT_ALL;
          best = considerDictionaryTransforms(data, maxAllowedDistance, group, tid,
            wordLength, wordIndex, prefix.length + wordLength, wordStart + wordLength, best);
          continue;
        }

        // Identity keeps the whole word, OmitLast_k drops its last k bytes; both
        // only need the head of the word to match.
        for (let omit = 0; omit <= 9; ++omit) {
          /** @type {int32} */
          const middle = wordLength - omit;
          if (middle < 1) {
            break;
          }
          if (middle > common) {
            continue;
          }
          /** @type {int32} */
          const tid = omit === 0 ? TID_IDENTITY : TID_OMIT_LAST_BASE + omit;
          best = considerDictionaryTransforms(data, maxAllowedDistance, group, tid,
            wordLength, wordIndex, prefix.length + middle, wordStart + middle, best);
        }
      }
    }

    return best;
  }

  // ===== ENCODER: LZ77 MATCH FINDER (hash chain, min match 4) =====

  /**
   * @param {uint8[]} data - Input
   * @param {int32} position - Position of the four hashed bytes
   * @returns {uint32} Bucket
   */
  function hashAt(data, position) {
    /** @type {uint32} */
    const word = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(data[position], 24), OpCodes.Shl32(data[position + 1], 16)),
      OpCodes.Or32(OpCodes.Shl32(data[position + 2], 8), data[position + 3])
    );
    return OpCodes.Shr32(OpCodes.Mul32(word, 2654435761), 32 - HASH_BITS);
  }

  /**
   * @param {uint8[]} data - Input
   * @param {int32} a - First position
   * @param {int32} b - Second position
   * @param {int32} maxLength - Longest length to test
   * @returns {int32} Common length
   */
  function matchLength(data, a, b, maxLength) {
    /** @type {int32} */
    let length = 0;
    while (length < maxLength && data[a + length] === data[b + length]) {
      ++length;
    }
    return length;
  }

  // Approximate cost in bits of a backward reference, used only to steer the
  // parse. A ring buffer distance is assumed to cost three bits, an explicit one
  // twelve plus its extra bits.
  /**
   * @param {int32} length - Copy length
   * @param {int32} distance - Distance
   * @param {boolean} inRing - Distance is in the ring buffer
   * @returns {int32} Approximate bits
   */
  function matchCost(length, distance, inRing) {
    /** @type {int32} */
    const copyCode = findLengthCode(COPY_LENGTH_BASE, length);
    /** @type {int32} */
    let cost = ESTIMATED_COMMAND_BITS + COPY_LENGTH_EXTRA[copyCode];
    if (inRing) {
      cost += 3;
    } else {
      cost += ESTIMATED_DISTANCE_BITS + distanceExtraBits(distance);
    }
    return cost;
  }

  // Ranks two candidate references against each other. Extra matched bytes are
  // only worth what the command that would otherwise cover them costs, not a
  // full literal each, so long far references do not automatically beat short
  // near ones.
  /**
   * @param {int32} length - Copy length
   * @param {int32} distance - Distance
   * @param {boolean} inRing - Distance is in the ring buffer
   * @returns {int32} Ranking score
   */
  function matchScore(length, distance, inRing) {
    return length * MATCH_RANK_LITERAL_BITS - matchCost(length, distance, inRing);
  }

  // Whether coding a reference beats coding the same bytes as literals.
  /**
   * @param {int32} length - Copy length
   * @param {int32} distance - Distance
   * @param {boolean} inRing - Distance is in the ring buffer
   * @returns {boolean} True when the reference is cheaper
   */
  function matchPaysOff(length, distance, inRing) {
    return length * 8 > matchCost(length, distance, inRing);
  }

  /**
   * An in-window match candidate.
   */
  class WindowMatch {
    /**
     * @param {int32} length - Match length
     * @param {int32} distance - Distance
     * @param {int32} score - Ranking score
     */
    constructor(length, distance, score) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.score = score;
    }
  }

  /** @type {WindowMatch} */
  const NO_MATCH = new WindowMatch(0, 0, -2147483648);

  /**
   * @param {uint8[]} data - Input
   * @param {int32} position - Input position
   * @param {int32} maxDistance - Largest distance allowed
   * @param {int32[]} head - Latest position per hash bucket
   * @param {int32[]} chain - Previous position per position
   * @param {int32[]} parseRing - Parse-time distance ring
   * @returns {WindowMatch} Best in-window match
   */
  function findBestMatch(data, position, maxDistance, head, chain, parseRing) {
    /** @type {int32} */
    const maxLength = Math.min(MAX_COPY_LENGTH, data.length - position);
    if (maxLength < MIN_MATCH || position + MIN_MATCH > data.length) {
      return NO_MATCH;
    }

    /** @type {int32} */
    let bestLength = 0;
    /** @type {int32} */
    let bestDistance = 0;
    /** @type {int32} */
    let bestScore = -2147483648;

    // Distances already in the ring buffer code for almost nothing, so they are
    // worth trying even when the hash chain offers a longer match elsewhere.
    for (let i = 0; i < 4; ++i) {
      /** @type {int32} */
      const distance = parseRing[i];
      if (distance > position || distance > maxDistance) {
        continue;
      }
      /** @type {int32} */
      const length = matchLength(data, position, position - distance, maxLength);
      if (length < MIN_MATCH || !matchPaysOff(length, distance, true)) {
        continue;
      }
      /** @type {int32} */
      const score = matchScore(length, distance, true);
      if (score <= bestScore) {
        continue;
      }
      bestScore = score;
      bestLength = length;
      bestDistance = distance;
    }

    /** @type {int32} */
    let candidate = head[hashAt(data, position)];
    /** @type {int32} */
    let depth = 0;
    while (candidate >= 0 && depth < MAX_CHAIN) {
      /** @type {int32} */
      const distance = position - candidate;
      if (distance > maxDistance) {
        break;
      }
      if (distance > 0) {
        /** @type {int32} */
        const length = matchLength(data, position, candidate, maxLength);
        if (length >= MIN_MATCH && matchPaysOff(length, distance, false)) {
          /** @type {int32} */
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

    return new WindowMatch(bestLength, bestDistance, bestScore);
  }

  // Best reference of either kind at one position: an in-window backward match
  // or a static dictionary word. `copyLength` is what the copy length code has
  // to carry, `outputLength` is how many input bytes the reference covers; the
  // two differ only for dictionary references whose transform changes the word
  // length.
  class Reference {
    /**
     * @param {int32} copyLength - Copy length code value
     * @param {int32} outputLength - Input bytes covered
     * @param {int32} distance - Distance
     * @param {int32} score - Ranking score
     * @param {boolean} isDictionary - Static dictionary reference
     */
    constructor(copyLength, outputLength, distance, score, isDictionary) {
      /** @type {int32} */
      this.copyLength = copyLength;
      /** @type {int32} */
      this.outputLength = outputLength;
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.score = score;
      /** @type {boolean} */
      this.isDictionary = isDictionary;
    }
  }

  /** @type {Reference} */
  const NO_REFERENCE = new Reference(0, 0, 0, -2147483648, false);

  /**
   * @param {uint8[]} data - Input
   * @param {int32} position - Input position
   * @param {int32} maxDistance - Largest distance allowed
   * @param {int32[]} head - Latest position per hash bucket
   * @param {int32[]} chain - Previous position per position
   * @param {int32[]} parseRing - Parse-time distance ring
   * @returns {Reference} Best reference
   */
  function findBestReference(data, position, maxDistance, head, chain, parseRing) {
    /** @type {WindowMatch} */
    const window = findBestMatch(data, position, maxDistance, head, chain, parseRing);
    /** @type {DictionaryMatch} */
    const dictionary = findDictionaryMatch(data, position, Math.min(maxDistance, position));

    if (dictionary !== null && (window.length < MIN_MATCH || dictionary.score > window.score)) {
      return new Reference(dictionary.copyLength, dictionary.outputLength, dictionary.distance, dictionary.score, true);
    }

    if (window.length < MIN_MATCH) {
      return NO_REFERENCE;
    }

    return new Reference(window.length, window.length, window.distance, window.score, false);
  }

  /**
   * One insert-and-copy command of the parse.
   */
  class BrotliCommand {
    /**
     * @param {int32} insertStart - First literal
     * @param {int32} insertLength - Literal count
     * @param {int32} copyLength - Copy length code value (0 for literal-only)
     * @param {int32} outputLength - Input bytes the copy covers
     * @param {int32} distance - Distance
     * @param {boolean} isDictionary - Static dictionary reference
     */
    constructor(insertStart, insertLength, copyLength, outputLength, distance, isDictionary) {
      /** @type {int32} */
      this.insertStart = insertStart;
      /** @type {int32} */
      this.insertLength = insertLength;
      /** @type {int32} */
      this.copyLength = copyLength;
      /** @type {int32} */
      this.outputLength = outputLength;
      /** @type {int32} */
      this.distance = distance;
      /** @type {boolean} */
      this.isDictionary = isDictionary;
    }
  }

  // Adds position `at` to the hash chains when four bytes are left there.
  /**
   * @param {uint8[]} data - Input
   * @param {int32[]} head - Latest position per hash bucket
   * @param {int32[]} chain - Previous position per position
   * @param {int32} at - Position to insert
   */
  function insertHash(data, head, chain, at) {
    if (at + MIN_MATCH > data.length) {
      return;
    }
    /** @type {uint32} */
    const h = hashAt(data, at);
    chain[at] = head[h];
    head[h] = at;
  }

  // Splits the input into insert-and-copy commands using a hash chain match
  // finder with two steps of lazy matching driven by the approximate bit cost.
  /**
   * @param {uint8[]} data - Input
   * @param {int32} maxDistance - Largest distance allowed
   * @returns {BrotliCommand[]} Commands covering the whole input
   */
  function findCommands(data, maxDistance) {
    /** @type {int32[]} */
    const head = new Int32Array(HASH_SIZE);
    head.fill(-1);
    /** @type {int32[]} */
    const chain = new Int32Array(Math.max(1, data.length));
    chain.fill(-1);

    // Mirrors the real distance ring buffer closely enough to steer the parse;
    // the codes actually emitted are resolved later against the true ring.
    /** @type {int32[]} */
    const parseRing = INITIAL_DISTANCE_RING.slice();

    /** @type {BrotliCommand[]} */
    const commands = [];
    /** @type {int32} */
    let literalStart = 0;
    /** @type {int32} */
    let position = 0;

    while (position < data.length) {
      // A literal-only command is only legal as the last command of a
      // meta-block, and splitMetaBlocks closes a meta-block right after one, so
      // capping the run here bounds MLEN without making the stream illegal.
      if (position - literalStart >= MAX_LITERAL_RUN) {
        commands.push(new BrotliCommand(literalStart, position - literalStart, 0, 0, 0, false));
        literalStart = position;
      }

      /** @type {Reference} */
      const best = findBestReference(data, position, maxDistance, head, chain, parseRing);
      if (best.outputLength < MIN_MATCH) {
        insertHash(data, head, chain, position);
        ++position;
        continue;
      }

      insertHash(data, head, chain, position);
      /** @type {boolean} */
      let deferred = false;
      for (let ahead = 1; ahead <= LAZY_LOOKAHEAD && position + ahead < data.length; ++ahead) {
        /** @type {Reference} */
        const later = findBestReference(data, position + ahead, maxDistance, head, chain, parseRing);
        if (later.outputLength < MIN_MATCH) {
          continue;
        }
        if (later.score <= best.score + LAZY_MATCH_MARGIN * ahead) {
          continue;
        }
        deferred = true;
        break;
      }
      if (deferred) {
        ++position;
        continue;
      }

      commands.push(new BrotliCommand(literalStart, position - literalStart,
        best.copyLength, best.outputLength, best.distance, best.isDictionary));

      // A dictionary distance never enters the ring buffer (RFC 7932 Section 4).
      if (!best.isDictionary && best.distance !== parseRing[0]) {
        parseRing[3] = parseRing[2];
        parseRing[2] = parseRing[1];
        parseRing[1] = parseRing[0];
        parseRing[0] = best.distance;
      }

      /** @type {int32} */
      const matchEnd = position + best.outputLength;
      for (let i = position + 1; i < matchEnd; ++i) {
        insertHash(data, head, chain, i);
      }
      position = matchEnd;
      literalStart = position;
    }

    if (literalStart < data.length) {
      commands.push(new BrotliCommand(literalStart, data.length - literalStart, 0, 0, 0, false));
    }

    return commands;
  }

  // ===== ENCODER: META-BLOCK LAYOUT =====

  /**
   * @param {BrotliCommand} command - Command
   * @returns {int32} Input position after the command
   */
  function commandEnd(command) {
    return command.insertStart + command.insertLength + command.outputLength;
  }

  /**
   * @param {BrotliCommand[]} commands - Commands
   * @param {int32[]} segmentStarts - First command per segment
   * @param {int32} segment - Segment
   * @returns {int32} Input bytes the segment covers
   */
  function segmentByteCount(commands, segmentStarts, segment) {
    /** @type {int32} */
    const from = segmentStarts[segment];
    /** @type {int32} */
    const to = segment + 1 < segmentStarts.length ? segmentStarts[segment + 1] : commands.length;
    /** @type {int32} */
    let bytes = 0;
    for (let i = from; i < to; ++i) {
      bytes += commands[i].insertLength + commands[i].outputLength;
    }
    return bytes;
  }

  /**
   * Commands and input bytes of one meta-block.
   */
  class MetaBlockRange {
    /**
     * @param {int32} commandStart - First command
     * @param {int32} commandEnd - Command after the last
     * @param {int32} byteStart - First input byte
     * @param {int32} byteEnd - Input byte after the last
     */
    constructor(commandStart, commandEnd, byteStart, byteEnd) {
      /** @type {int32} */
      this.commandStart = commandStart;
      /** @type {int32} */
      this.commandEnd = commandEnd;
      /** @type {int32} */
      this.byteStart = byteStart;
      /** @type {int32} */
      this.byteEnd = byteEnd;
    }
  }

  /**
   * @param {BrotliCommand[]} commands - Commands
   * @param {int32[]} segmentStarts - First command per segment
   * @param {int32} from - First segment
   * @param {int32} to - Segment after the last
   * @returns {MetaBlockRange} Meta-block range
   */
  function makeRange(commands, segmentStarts, from, to) {
    /** @type {int32} */
    const commandStart = segmentStarts[from];
    /** @type {int32} */
    const commandEndIndex = to < segmentStarts.length ? segmentStarts[to] : commands.length;
    return new MetaBlockRange(commandStart, commandEndIndex,
      commands[commandStart].insertStart, commandEnd(commands[commandEndIndex - 1]));
  }

  // Groups commands into meta-blocks. Adjacent segments are merged while their
  // literal distributions are similar enough that one shared set of prefix codes
  // stays cheaper than a second meta-block header.
  /**
   * @param {uint8[]} data - Input
   * @param {BrotliCommand[]} commands - Commands
   * @returns {MetaBlockRange[]} Meta-blocks
   */
  function splitMetaBlocks(data, commands) {
    /** @type {MetaBlockRange[]} */
    const blocks = [];
    if (commands.length === 0) {
      return blocks;
    }

    // Cut the command stream into fixed-size segments first; split points may
    // only fall on those boundaries.
    /** @type {int32[]} */
    const segmentStarts = [0];
    /** @type {boolean[]} */
    const forcedEnd = [false];
    /** @type {int32} */
    let carried = 0;
    for (let i = 0; i < commands.length; ++i) {
      carried += commands[i].insertLength + commands[i].outputLength;
      /** @type {boolean} */
      const literalOnly = commands[i].copyLength === 0;
      if ((carried < SEGMENT_BYTES && !literalOnly) || i + 1 >= commands.length) {
        continue;
      }
      segmentStarts.push(i + 1);
      forcedEnd.push(literalOnly);
      carried = 0;
    }

    /** @type {int32} */
    const segmentCount = segmentStarts.length;
    /** @type {int32[][]} */
    const histograms = new Array(segmentCount);
    for (let s = 0; s < segmentCount; ++s) {
      /** @type {int32[]} */
      const histogram = new Int32Array(256);
      /** @type {int32} */
      const from = segmentStarts[s];
      /** @type {int32} */
      const to = s + 1 < segmentCount ? segmentStarts[s + 1] : commands.length;
      for (let i = from; i < to; ++i) {
        /** @type {BrotliCommand} */
        const command = commands[i];
        for (let k = 0; k < command.insertLength; ++k) {
          histogram[data[command.insertStart + k]]++;
        }
      }
      histograms[s] = histogram;
    }

    /** @type {int32} */
    let openStart = 0;
    /** @type {int32[]} */
    let openHistogram = histograms[0].slice();
    /** @type {int32} */
    let openBytes = segmentByteCount(commands, segmentStarts, 0);

    for (let s = 1; s < segmentCount; ++s) {
      /** @type {int32} */
      const segmentBytes = segmentByteCount(commands, segmentStarts, s);
      /** @type {boolean} */
      let startNewBlock = forcedEnd[s] || openBytes + segmentBytes > MAX_METABLOCK_BYTES;
      if (!startNewBlock) {
        /** @type {float64} */
        const mergeCost = mergeCostUnits(openHistogram, histograms[s]);
        startNewBlock = mergeCost > SPLIT_THRESHOLD_UNITS;
      }

      if (startNewBlock) {
        blocks.push(makeRange(commands, segmentStarts, openStart, s));
        openStart = s;
        openHistogram = histograms[s].slice();
        openBytes = segmentBytes;
        continue;
      }

      for (let b = 0; b < 256; ++b) {
        openHistogram[b] += histograms[s][b];
      }
      openBytes += segmentBytes;
    }

    blocks.push(makeRange(commands, segmentStarts, openStart, segmentCount));
    return blocks;
  }

  // ===== ENCODER: LITERAL CONTEXT MODELLING (RFC 7932 Section 7.1) =====

  /**
   * @param {uint8} p1 - Last byte
   * @param {uint8} p2 - Byte before the last
   * @param {int32} contextMode - Context mode
   * @returns {uint32} Literal context id
   */
  function literalContext(p1, p2, contextMode) {
    return getLiteralContextId(contextMode, p1, p2);
  }

  // Picks the literal context mode whose per-context distributions are cheapest
  // to code before any clustering is applied.
  /**
   * @param {int32[][][]} perMode - Histograms per mode and context
   * @returns {int32} Context mode
   */
  function chooseContextMode(perMode) {
    /** @type {int32} */
    let best = 0;
    /** @type {float64} */
    let bestCost = MAX_SAFE_INTEGER;
    for (let mode = 0; mode < perMode.length; ++mode) {
      /** @type {float64} */
      let cost = 0;
      for (let c = 0; c < 64; ++c) {
        cost += histogramCostUnits(perMode[mode][c]);
      }
      if (cost >= bestCost) {
        continue;
      }
      bestCost = cost;
      best = mode;
    }
    return best;
  }

  /**
   * One measured literal clustering.
   */
  class Clustering {
    /**
     * @param {int32[]} map - Tree per context
     * @param {PrefixCode[]} codes - Literal code per tree
     * @param {float64} cost - Cost in 1/256 bits
     */
    constructor(map, codes, cost) {
      /** @type {int32[]} */
      this.map = map;
      /** @type {PrefixCode[]} */
      this.codes = codes;
      /** @type {float64} */
      this.cost = cost;
    }
  }

  // Measures one clustering: descriptor bits for every literal code, the context
  // map, the NTREESL field and the literal payload itself.
  /**
   * @param {int32[][]} members - Contexts per cluster
   * @param {int32[][]} clusters - Histogram per cluster
   * @returns {Clustering} Codes, map and cost
   */
  function evaluateClustering(members, clusters) {
    /** @type {int32[]} */
    const map = filledArray(64, 0);
    for (let t = 0; t < members.length; ++t) {
      for (let k = 0; k < members[t].length; ++k) {
        map[members[t][k]] = t;
      }
    }

    /** @type {PrefixCode[]} */
    const codes = new Array(clusters.length);
    /** @type {float64} */
    let cost = 0;
    for (let t = 0; t < clusters.length; ++t) {
      codes[t] = buildPrefixCode(clusters[t], LITERAL_ALPHABET_SIZE, MAX_CODE_LENGTH);
      cost += measureDescriptorBits(codes[t], LITERAL_ALPHABET_SIZE) * 256;
      for (let b = 0; b < 256; ++b) {
        /** @type {float64} */
        const frequency = clusters[t][b];
        cost += frequency * symbolBits(codes[t], b) * 256;
      }
    }

    /** @type {BitWriter} */
    const scratch = new BitWriter();
    writeCount(scratch, clusters.length);
    if (clusters.length > 1) {
      writeContextMap(scratch, map, clusters.length);
    }
    /** @type {float64} */
    const mapBits = scratch.bitLength();
    cost += mapBits * 256;

    return new Clustering(map, codes, cost);
  }

  /**
   * @param {int32[]} candidates - Allowed tree counts
   * @param {int32} count - Tree count
   * @returns {boolean} True when count is allowed
   */
  function isTreeCandidate(candidates, count) {
    for (let i = 0; i < candidates.length; ++i) {
      if (candidates[i] === count) {
        return true;
      }
    }
    return false;
  }

  // Clusters the 64 literal contexts into prefix codes. Contexts are merged
  // greedily by the extra cost of sharing one distribution, and the tree count
  // that minimises the measured total of descriptors, context map and literal
  // data wins.
  /**
   * @param {int32[][]} contextFrequencies - Histogram per context
   * @returns {Clustering} Chosen map and codes
   */
  function chooseLiteralTrees(contextFrequencies) {
    /** @type {int32[][]} */
    const members = [];
    /** @type {int32[][]} */
    const clusters = [];
    for (let c = 0; c < 64; ++c) {
      /** @type {float64} */
      let total = 0;
      for (let b = 0; b < 256; ++b) {
        total += contextFrequencies[c][b];
      }
      if (total === 0) {
        continue;
      }
      /** @type {int32[]} */
      const single = [c];
      members.push(single);
      clusters.push(contextFrequencies[c].slice());
    }

    // Nothing was coded from this alphabet at all.
    if (clusters.length === 0) {
      /** @type {PrefixCode[]} */
      const onlyCode = [buildPrefixCode(new Int32Array(256), LITERAL_ALPHABET_SIZE, MAX_CODE_LENGTH)];
      return new Clustering(filledArray(64, 0), onlyCode, 0);
    }

    // Pairwise merge costs are cached; a merge only invalidates one row.
    /** @type {float64[][]} */
    const pairCost = [];
    for (let i = 0; i < clusters.length; ++i) {
      /** @type {float64[]} */
      const row = filledArray(clusters.length, 0);
      for (let j = i + 1; j < clusters.length; ++j) {
        row[j] = mergeCostUnits(clusters[i], clusters[j]);
      }
      pairCost.push(row);
    }

    /** @type {float64} */
    let bestCost = MAX_SAFE_INTEGER;
    /** @type {int32[]} */
    let bestMap = null;
    /** @type {PrefixCode[]} */
    let bestCodes = null;

    for (;;) {
      if (isTreeCandidate(LITERAL_TREE_CANDIDATES, clusters.length)) {
        /** @type {Clustering} */
        const evaluated = evaluateClustering(members, clusters);
        if (evaluated.cost < bestCost) {
          bestCost = evaluated.cost;
          bestMap = evaluated.map;
          bestCodes = evaluated.codes;
        }
      }

      if (clusters.length <= 1) {
        break;
      }

      /** @type {int32} */
      let mergeI = 0;
      /** @type {int32} */
      let mergeJ = 1;
      /** @type {float64} */
      let mergeCost = MAX_SAFE_INTEGER;
      for (let i = 0; i < clusters.length; ++i) {
        for (let j = i + 1; j < clusters.length; ++j) {
          if (pairCost[i][j] >= mergeCost) {
            continue;
          }
          mergeCost = pairCost[i][j];
          mergeI = i;
          mergeJ = j;
        }
      }

      for (let b = 0; b < 256; ++b) {
        clusters[mergeI][b] += clusters[mergeJ][b];
      }
      for (let k = 0; k < members[mergeJ].length; ++k) {
        members[mergeI].push(members[mergeJ][k]);
      }
      clusters.splice(mergeJ, 1);
      members.splice(mergeJ, 1);

      pairCost.splice(mergeJ, 1);
      for (let i = 0; i < pairCost.length; ++i) {
        pairCost[i].splice(mergeJ, 1);
      }

      for (let k = 0; k < clusters.length; ++k) {
        if (k === mergeI) {
          continue;
        }
        /** @type {float64} */
        const cost = mergeCostUnits(clusters[mergeI], clusters[k]);
        if (k > mergeI) {
          pairCost[mergeI][k] = cost;
        } else {
          pairCost[k][mergeI] = cost;
        }
      }
    }

    return new Clustering(bestMap, bestCodes, bestCost);
  }

  // Writes a literal context map (RFC 7932 Section 7.3) with RLEMAX = 0 and no
  // move-to-front transform: only 64 entries are involved, so neither pays off.
  /**
   * @param {BitWriter} writer - Output
   * @param {int32[]} contextMap - Tree per context
   * @param {int32} treeCount - Number of trees
   */
  function writeContextMap(writer, contextMap, treeCount) {
    writer.writeBits(1, 0); // RLEMAX = 0

    /** @type {int32[]} */
    const frequencies = filledArray(treeCount, 0);
    for (let i = 0; i < contextMap.length; ++i) {
      frequencies[contextMap[i]]++;
    }

    /** @type {PrefixCode} */
    const code = buildPrefixCode(frequencies, treeCount, MAX_CODE_LENGTH);
    writePrefixCodeDescriptor(writer, code, treeCount);
    for (let i = 0; i < contextMap.length; ++i) {
      writeSymbol(writer, code, contextMap[i]);
    }

    writer.writeBits(1, 0); // IMTF = 0
  }

  // ===== ENCODER: META-BLOCK EMISSION =====

  /**
   * A command with its codes resolved against the distance ring.
   */
  class ResolvedCommand {
    /**
     * @param {int32} insertStart - First literal
     * @param {int32} insertLength - Literal count
     * @param {int32} copyLength - Copy length code value
     * @param {int32} distance - Distance
     * @param {int32} iacCode - Insert-and-copy symbol
     * @param {int32} insertCode - Insert length code
     * @param {int32} copyCode - Copy length code
     * @param {int32} distanceCode - Distance symbol, or -1 for an implicit distance
     */
    constructor(insertStart, insertLength, copyLength, distance, iacCode, insertCode, copyCode, distanceCode) {
      /** @type {int32} */
      this.insertStart = insertStart;
      /** @type {int32} */
      this.insertLength = insertLength;
      /** @type {int32} */
      this.copyLength = copyLength;
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.iacCode = iacCode;
      /** @type {int32} */
      this.insertCode = insertCode;
      /** @type {int32} */
      this.copyCode = copyCode;
      /** @type {int32} */
      this.distanceCode = distanceCode;
    }
  }

  // Resolves the distance encoding of every command in a meta-block, advancing
  // the distance ring buffer exactly as the decoder will. A distance code of -1
  // means the command uses an implicit-distance insert-and-copy range and no
  // distance symbol is written; the ring is left untouched for code 0 and for
  // implicit distances, per RFC 7932 Section 4.
  /**
   * @param {BrotliCommand[]} commands - Commands
   * @param {MetaBlockRange} range - Meta-block
   * @param {int32[]} ring - Distance ring, advanced
   * @returns {ResolvedCommand[]} Resolved commands of the meta-block
   */
  function resolveCommands(commands, range, ring) {
    /** @type {ResolvedCommand[]} */
    const resolved = new Array(range.commandEnd - range.commandStart);
    for (let i = range.commandStart; i < range.commandEnd; ++i) {
      /** @type {BrotliCommand} */
      const command = commands[i];
      /** @type {int32} */
      const insertCode = findLengthCode(INSERT_LENGTH_BASE, command.insertLength);

      if (command.copyLength === 0) {
        // A trailing literal-only command: the decoder finishes the meta-block
        // before it would read a distance, so the copy code only has to exist.
        resolved[i - range.commandStart] = new ResolvedCommand(command.insertStart, command.insertLength,
          0, 0, encodeInsertAndCopyCode(insertCode, 0, insertCode <= 7), insertCode, 0, -1);
        continue;
      }

      /** @type {int32} */
      const copyCode = findLengthCode(COPY_LENGTH_BASE, command.copyLength);
      /** @type {boolean} */
      const canUseImplicit = !command.isDictionary &&
        insertCode <= 7 && copyCode <= 15 && command.distance === ring[0];

      /** @type {int32} */
      let iacCode = 0;
      /** @type {int32} */
      let distanceCode = 0;
      if (canUseImplicit) {
        iacCode = encodeInsertAndCopyCode(insertCode, copyCode, true);
        distanceCode = -1;
      } else if (command.isDictionary) {
        // A dictionary reference always spells its distance out and never
        // enters the ring buffer (RFC 7932 Sections 4 and 8).
        iacCode = encodeInsertAndCopyCode(insertCode, copyCode, false);
        /** @type {DistanceCodeInfo} */
        const explicit = encodeDistance(command.distance);
        distanceCode = explicit.code;
      } else {
        iacCode = encodeInsertAndCopyCode(insertCode, copyCode, false);
        distanceCode = findRingDistanceCode(command.distance, ring);
        if (distanceCode < 0) {
          /** @type {DistanceCodeInfo} */
          const explicit = encodeDistance(command.distance);
          distanceCode = explicit.code;
        }

        if (distanceCode !== 0) {
          ring[3] = ring[2];
          ring[2] = ring[1];
          ring[1] = ring[0];
          ring[0] = command.distance;
        }
      }

      resolved[i - range.commandStart] = new ResolvedCommand(command.insertStart, command.insertLength,
        command.copyLength, command.distance, iacCode, insertCode, copyCode, distanceCode);
    }
    return resolved;
  }

  // MNIBBLES must be the smallest nibble count whose most significant nibble is
  // non-zero, because a conformant decoder (zlib's brotliDecompressSync among
  // them) rejects a stream whose last nibble is all zeros (Section 9.2).
  /**
   * @param {BitWriter} writer - Output
   * @param {int32} byteLength - Meta-block length
   */
  function writeMetaBlockLength(writer, byteLength) {
    /** @type {int32} */
    const mlen = byteLength - 1;
    /** @type {int32} */
    const nibbles = mlen <= 0xFFFF ? 4 : (mlen <= 0xFFFFF ? 5 : 6);
    writer.writeBits(2, nibbles - 4);
    for (let i = 0; i < nibbles; ++i) {
      writer.writeBits(4, OpCodes.And32(OpCodes.Shr32(mlen, i * 4), 0xF));
    }
  }

  // Builds one entropy-coded meta-block into its own writer so its size can be
  // compared against the uncompressed alternative before it is spliced in.
  /**
   * @param {uint8[]} data - Input
   * @param {BrotliCommand[]} commands - Commands
   * @param {MetaBlockRange} range - Meta-block
   * @param {boolean} isLast - Last meta-block of the stream
   * @param {int32[]} ring - Distance ring, advanced
   * @returns {BitWriter} Meta-block bits
   */
  function buildCompressedMetaBlock(data, commands, range, isLast, ring) {
    /** @type {ResolvedCommand[]} */
    const resolved = resolveCommands(commands, range, ring);

    // Literal frequencies per context, for every context mode, so the cheapest
    // mode can be picked before the contexts are clustered.
    /** @type {int32[][][]} */
    const perMode = new Array(4);
    for (let mode = 0; mode < 4; ++mode) {
      /** @type {int32[][]} */
      const byContext = new Array(64);
      for (let c = 0; c < 64; ++c) {
        byContext[c] = new Int32Array(256);
      }
      perMode[mode] = byContext;
    }

    /** @type {int32[]} */
    const iacFrequencies = new Int32Array(IAC_ALPHABET_SIZE);
    /** @type {int32[]} */
    const distanceFrequencies = new Int32Array(DISTANCE_ALPHABET_SIZE);

    for (let ci = 0; ci < resolved.length; ++ci) {
      /** @type {ResolvedCommand} */
      const command = resolved[ci];
      iacFrequencies[command.iacCode]++;
      if (command.distanceCode >= 0) {
        distanceFrequencies[command.distanceCode]++;
      }

      for (let k = 0; k < command.insertLength; ++k) {
        /** @type {int32} */
        const position = command.insertStart + k;
        /** @type {uint8} */
        const p1 = position > 0 ? data[position - 1] : 0;
        /** @type {uint8} */
        const p2 = position > 1 ? data[position - 2] : 0;
        /** @type {uint8} */
        const literal = data[position];
        for (let mode = 0; mode < 4; ++mode) {
          /** @type {uint32} */
          const context = literalContext(p1, p2, mode);
          perMode[mode][context][literal]++;
        }
      }
    }

    /** @type {int32} */
    const contextMode = chooseContextMode(perMode);
    /** @type {Clustering} */
    const literalTrees = chooseLiteralTrees(perMode[contextMode]);
    /** @type {int32[]} */
    const contextMap = literalTrees.map;
    /** @type {PrefixCode[]} */
    const literalCodes = literalTrees.codes;

    /** @type {PrefixCode} */
    const iacCode = buildPrefixCode(iacFrequencies, IAC_ALPHABET_SIZE, MAX_CODE_LENGTH);
    /** @type {PrefixCode} */
    const distanceCode = buildPrefixCode(distanceFrequencies, DISTANCE_ALPHABET_SIZE, MAX_CODE_LENGTH);

    /** @type {BitWriter} */
    const writer = new BitWriter();

    writer.writeBits(1, isLast ? 1 : 0);
    if (isLast) {
      writer.writeBits(1, 0); // ISLASTEMPTY = 0
    }

    writeMetaBlockLength(writer, range.byteEnd - range.byteStart);

    if (!isLast) {
      writer.writeBits(1, 0); // ISUNCOMPRESSED = 0
    }

    writeCount(writer, 1); // NBLTYPESL
    writeCount(writer, 1); // NBLTYPESI
    writeCount(writer, 1); // NBLTYPESD

    writer.writeBits(2, 0); // NPOSTFIX = 0
    writer.writeBits(4, 0); // NDIRECT (raw value, shifted left by NPOSTFIX) = 0

    writer.writeBits(2, contextMode);

    writeCount(writer, literalCodes.length); // NTREESL
    if (literalCodes.length > 1) {
      writeContextMap(writer, contextMap, literalCodes.length);
    }

    writeCount(writer, 1); // NTREESD

    for (let t = 0; t < literalCodes.length; ++t) {
      writePrefixCodeDescriptor(writer, literalCodes[t], LITERAL_ALPHABET_SIZE);
    }

    writePrefixCodeDescriptor(writer, iacCode, IAC_ALPHABET_SIZE);
    writePrefixCodeDescriptor(writer, distanceCode, DISTANCE_ALPHABET_SIZE);

    for (let ci = 0; ci < resolved.length; ++ci) {
      /** @type {ResolvedCommand} */
      const command = resolved[ci];
      writeSymbol(writer, iacCode, command.iacCode);

      /** @type {int32} */
      const insertExtra = INSERT_LENGTH_EXTRA[command.insertCode];
      if (insertExtra > 0) {
        writer.writeBits(insertExtra, command.insertLength - INSERT_LENGTH_BASE[command.insertCode]);
      }

      /** @type {int32} */
      const copyExtra = COPY_LENGTH_EXTRA[command.copyCode];
      if (copyExtra > 0) {
        writer.writeBits(copyExtra, command.copyLength - COPY_LENGTH_BASE[command.copyCode]);
      }

      for (let k = 0; k < command.insertLength; ++k) {
        /** @type {int32} */
        const position = command.insertStart + k;
        /** @type {uint8} */
        const p1 = position > 0 ? data[position - 1] : 0;
        /** @type {uint8} */
        const p2 = position > 1 ? data[position - 2] : 0;
        /** @type {uint32} */
        const context = literalContext(p1, p2, contextMode);
        writeSymbol(writer, literalCodes[contextMap[context]], data[position]);
      }

      if (command.distanceCode < 0) {
        continue;
      }

      writeSymbol(writer, distanceCode, command.distanceCode);
      if (command.distanceCode < 16) {
        continue;
      }

      /** @type {DistanceCodeInfo} */
      const distanceInfo = encodeDistance(command.distance);
      if (distanceInfo.extraBits > 0) {
        writer.writeBits(distanceInfo.extraBits, distanceInfo.extraValue);
      }
    }

    return writer;
  }

  // Builds one uncompressed meta-block into its own writer. The payload is
  // byte-aligned against the whole stream, so the number of padding bits depends
  // on how many bits already precede this meta-block.
  /**
   * @param {uint8[]} data - Input
   * @param {MetaBlockRange} range - Meta-block
   * @param {float64} startBitOffset - Bits already in the stream
   * @returns {BitWriter} Meta-block bits
   */
  function buildUncompressedMetaBlock(data, range, startBitOffset) {
    /** @type {BitWriter} */
    const writer = new BitWriter();
    writer.writeBits(1, 0); // ISLAST = 0
    writeMetaBlockLength(writer, range.byteEnd - range.byteStart);
    writer.writeBits(1, 1); // ISUNCOMPRESSED = 1

    /** @type {float64} */
    const written = writer.bitLength();
    /** @type {int32} */
    const padding = (8 - (startBitOffset + written) % 8) % 8;
    if (padding > 0) {
      writer.writeBits(padding, 0);
    }

    for (let i = range.byteStart; i < range.byteEnd; ++i) {
      writer.writeBits(8, data[i]);
    }
    return writer;
  }

  // ===== ENCODER: STREAM-LEVEL FRAMING =====

  // Picks the smallest window that can express every backward distance.
  /**
   * @param {int32} dataLength - Input length
   * @returns {int32} WBITS
   */
  function computeWindowBits(dataLength) {
    for (let bits = 10; bits < 24; ++bits) {
      /** @type {int32} */
      const window = OpCodes.Shl32(1, bits) - 16;
      if (window >= dataLength) {
        return bits;
      }
    }
    return 24;
  }

  /**
   * @param {BitWriter} writer - Output
   * @param {int32} wbits - WBITS
   */
  function writeWindowBits(writer, wbits) {
    if (wbits === 16) {
      writer.writeBits(1, 0);
      return;
    }
    writer.writeBits(1, 1);
    if (wbits >= 18 && wbits <= 24) {
      writer.writeBits(3, wbits - 17);
      return;
    }
    if (wbits === 17) {
      writer.writeBits(3, 0);
      writer.writeBits(3, 0);
      return;
    }
    if (wbits >= 10 && wbits <= 15) {
      writer.writeBits(3, 0);
      writer.writeBits(3, wbits - 8);
      return;
    }
    throw new Error('Unsupported window size (bits): ' + wbits);
  }

  /**
   * @param {float64} bits - Bit count
   * @returns {float64} Bytes needed
   */
  function byteLengthOfBits(bits) {
    return Math.floor((bits + 7) / 8);
  }

  class BrotliEncoder {
    /**
     * @param {uint8[]} input - Bytes to compress
     * @returns {uint8[]} Brotli stream
     */
    compress(input) {
      // Zero bytes is not a Brotli stream. An empty input still needs the window
      // header and a final meta-block that is both last and empty (RFC 7932
      // section 9.2), or no other decoder can read it; node's zlib rejects zero
      // bytes with "unexpected end of file".
      if (input.length === 0) {
        /** @type {BitWriter} */
        const emptyWriter = new BitWriter();
        writeWindowBits(emptyWriter, computeWindowBits(0));
        emptyWriter.writeBits(1, 1); // ISLAST = 1
        emptyWriter.writeBits(1, 1); // ISLASTEMPTY = 1
        emptyWriter.flush();
        return emptyWriter.bytes;
      }

      /** @type {uint8[]} */
      const data = new Uint8Array(input.length);
      for (let i = 0; i < input.length; ++i) {
        data[i] = input[i];
      }
      /** @type {int32} */
      const windowBits = computeWindowBits(data.length);
      /** @type {int32} */
      const maxDistance = OpCodes.Shl32(1, windowBits) - 16;

      /** @type {BrotliCommand[]} */
      const commands = findCommands(data, maxDistance);
      /** @type {MetaBlockRange[]} */
      const blocks = splitMetaBlocks(data, commands);

      /** @type {BitWriter} */
      const writer = new BitWriter();
      writeWindowBits(writer, windowBits);

      /** @type {int32[]} */
      let ring = INITIAL_DISTANCE_RING.slice();
      for (let bi = 0; bi < blocks.length; ++bi) {
        /** @type {MetaBlockRange} */
        const block = blocks[bi];
        /** @type {boolean} */
        const isLastBlock = bi === blocks.length - 1;

        /** @type {int32[]} */
        const candidateRing = ring.slice();
        /** @type {BitWriter} */
        const compressed = buildCompressedMetaBlock(data, commands, block, isLastBlock, candidateRing);
        /** @type {BitWriter} */
        const stored = buildUncompressedMetaBlock(data, block, writer.bitLength());

        /** @type {float64} */
        const writtenBits = writer.bitLength();
        /** @type {float64} */
        const compressedBits = compressed.bitLength();
        /** @type {float64} */
        const storedBits = stored.bitLength();
        /** @type {boolean} */
        let useCompressed = false;
        if (isLastBlock) {
          // The stream ends here: the compressed form can carry ISLAST=1
          // directly, while the uncompressed form needs a trailing empty last
          // meta-block.
          /** @type {float64} */
          const withCompressed = byteLengthOfBits(writtenBits + compressedBits);
          /** @type {float64} */
          const withStored = byteLengthOfBits(writtenBits + storedBits + 2);
          useCompressed = withCompressed <= withStored;
        } else {
          useCompressed = compressedBits < storedBits;
        }

        if (useCompressed) {
          writer.appendBits(compressed);
          ring = candidateRing;
        } else {
          writer.appendBits(stored);
        }

        if (!isLastBlock || useCompressed) {
          continue;
        }

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
      this.description = "RFC 7932-compatible Brotli codec. The decoder implements the full RFC 7932 bitstream grammar (meta-block framing, complex/simple prefix codes, block-switch commands, insert-and-copy commands, distance ring buffer, context modeling, and the static dictionary with word transforms) and correctly reads streams from conformant encoders such as zlib's brotliCompressSync. The encoder exploits the format rather than emitting bare LZ77 plus Huffman: literal context modeling (all four context modes, with the 64 contexts clustered into up to 16 literal prefix codes and sent as a context map), the distance ring buffer including the implicit-distance insert-and-copy ranges, run-length coded prefix code descriptors, cost-driven meta-block splitting with a per-meta-block uncompressed fallback, and static dictionary references searched with a hash index over the Appendix A word list and coded with the Appendix B transforms. It does not use the OmitFirst word transforms, multiple block types with block-switch commands, non-zero NPOSTFIX/NDIRECT, distance context modeling, or an optimal parse.";
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
        "ENCODER: hash-chain LZ77 (minimum match 4, cost-aware ranking, two-step lazy matching) plus",
        "  canonical, length-limited (package-merge, RFC-capped at 15 bits for data alphabets / 5 bits for",
        "  the code-length alphabet) prefix coding. Implements literal context modeling (Section 7.1, all",
        "  four modes, 64 contexts clustered into up to 16 trees and sent as a context map per Section 7.3),",
        "  the distance ring buffer with codes 0-15 and the implicit-distance insert-and-copy ranges",
        "  (Sections 4 and 5), run-length coded complex prefix code descriptors (Section 3.5),",
        "  cost-driven meta-block splitting with a per-meta-block uncompressed fallback (Section 9.2),",
        "  and static dictionary references (Section 8) found through a hash index over the first four",
        "  bytes of every word form and coded with the Appendix B word transforms",
        "ENCODER LIMITATIONS: the OmitFirst1-9 word transforms are not searched (8 of the 121 in",
        "  Appendix B; they carry no prefix or suffix), one block type per category (no block-switch",
        "  commands, Section 6), NPOSTFIX=0 and NDIRECT=0 (Section 4), no distance context modeling",
        "  (Section 7.2), and a cost-ranked greedy parse with two lazy steps rather than an optimal one.",
        "  Verified byte-for-byte interoperable with zlib's brotliDecompressSync and the",
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
   * @param {BrotliCompression} algorithm - Parent algorithm instance
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
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) {
        return;
      }
      for (let i = 0; i < data.length; ++i) {
        this.inputBuffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Decoding nothing yields nothing. Encoding nothing still has to produce
      // a valid stream, so only the inverse direction may short-circuit.
      if (this.isInverse && this.inputBuffer.length === 0) {
        this.inputBuffer = [];
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      try {
        /** @type {uint8[]} */
        let result = null;
        if (this.isInverse) {
          /** @type {BrotliDecoder} */
          const decoder = new BrotliDecoder();
          result = decoder.decompress(this.inputBuffer);
        } else {
          /** @type {BrotliEncoder} */
          const encoder = new BrotliEncoder();
          result = encoder.compress(this.inputBuffer);
        }

        this.inputBuffer = [];
        return result;
      } catch (error) {
        /** @type {Error} */
        const err = error;
        /** @type {string} */
        const text = err.message;
        this.inputBuffer = [];
        throw new Error('Brotli ' + (this.isInverse ? 'decompression' : 'compression') + ' failed: ' + text);
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
