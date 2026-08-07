/*
 * LZMW (Lempel-Ziv-Miller-Wegman) Compression Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Miller and Wegman's 1985 variant of LZW. Where LZW adds "the match just
 * coded plus one raw byte" to the dictionary, LZMW adds the concatenation of
 * the match just coded (the previous match) and the ENTIRE match coded next
 * (the current match). Dictionary entries therefore grow by whole matches at a
 * time rather than one byte at a time, so the dictionary fills - and needs
 * resetting - far sooner than LZW's for the same input.
 *
 * Specification sources:
 *   V. S. Miller, M. N. Wegman, "Variations on a theme by Ziv and Lempel",
 *     Combinatorial Algorithms on Words, NATO ASI Series F12, 1985.
 *   T. Bell, J. Cleary, I. Witten, "Text Compression", Prentice Hall, 1990.
 *
 * Wire format (matches CompressionWorkbench's BB_Lzmw building block):
 *   [originalLength: 4 bytes little-endian][variable-width code stream]
 * Codes are packed least-significant-bit first, start at 9 bits and grow to at
 * most 16 bits. Code 256 clears the dictionary and resets the width, code 257
 * ends the stream, and dictionary entries start at 258. An empty input
 * produces only the 4-byte header.
 *
 * Code-width growth is applied two writes after the insertion that triggered
 * it. The encoder discovers a new entry (previous match plus next match) as
 * soon as it has found the next match, before that match's code has even been
 * written; the decoder can only perform the matching insertion once it has
 * decoded the NEXT code, so its width tracking is always one insertion behind.
 * Delaying the encoder's growth by one extra write keeps both sides working
 * from the same insertion history.
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM PARAMETERS (fixed to match CompressionWorkbench's BB_Lzmw) =====

  const MIN_BITS = 9;
  const MAX_BITS = 16;
  const CLEAR_CODE = OpCodes.Shl32(1, MIN_BITS - 1);  // 256
  const STOP_CODE = CLEAR_CODE + 1;                    // 257
  const FIRST_USABLE_CODE = CLEAR_CODE + 2;            // 258
  const MAX_CODE = OpCodes.Shl32(1, MAX_BITS);         // 65536

  // ===== BIT STREAM HELPERS (LSB-first) =====

  class LsbBitWriter {
    constructor() {
      this.bytes = [];
      this.buf = 0;
      this.nBits = 0;
    }

    writeBits(value, width) {
      this.buf = OpCodes.ToUint32(OpCodes.OrN(this.buf, OpCodes.Shl32(value, this.nBits)));
      this.nBits += width;
      while (this.nBits >= 8) {
        this.bytes.push(OpCodes.AndN(this.buf, 0xFF));
        this.buf = OpCodes.Shr32(this.buf, 8);
        this.nBits -= 8;
      }
    }

    flush() {
      if (this.nBits > 0) {
        this.bytes.push(OpCodes.AndN(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class LsbBitReader {
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.buf = 0;
      this.nBits = 0;
    }

    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) throw new Error('LZMW: unexpected end of stream');
        this.buf = OpCodes.ToUint32(OpCodes.OrN(this.buf, OpCodes.Shl32(this.bytes[this.pos++], this.nBits)));
        this.nBits += 8;
      }
      const mask = OpCodes.ToUint32(OpCodes.Shl32(1, width) - 1);
      const value = OpCodes.AndN(this.buf, mask);
      this.buf = OpCodes.Shr32(this.buf, width);
      this.nBits -= width;
      return value;
    }
  }

  // ===== SHARED HELPERS =====

  // The monotonic code-width growth rule shared by LZW, LZMW and LZAP: the
  // width needed to represent codes up to (but not including) nextCode.
  function computeWidth(nextCode) {
    let w = MIN_BITS;
    while (nextCode >= OpCodes.Shl32(1, w) && w < MAX_BITS) ++w;
    return w;
  }

  function buildInitialTrie() {
    const root = { children: new Map(), code: -1 };
    for (let b = 0; b < 256; ++b) root.children.set(b, { children: null, code: b });
    return root;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * LzmwCompression - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class LzmwCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZMW";
      this.description = "Miller-Wegman variant of LZW: instead of adding the previous match plus one character, the dictionary gains the concatenation of the previous match and the entire current match, so entries grow by whole matches at a time. Variable-width codes from 9 to 16 bits are packed least-significant-bit first behind a 4-byte little-endian length header, with clear and stop codes.";
      this.inventor = "Victor S. Miller, Mark N. Wegman";
      this.year = 1985;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - LZMW", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch#Variants"),
        new LinkItem("Wikibooks - Data Compression/Dictionary compression", "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"),
        new LinkItem("Miller and Wegman, Variations on a theme by Ziv and Lempel (NATO ASI Series F12, 1985)", "https://link.springer.com/chapter/10.1007/978-3-642-82456-2_9")
      ];

      this.references = [
        new LinkItem("Bell, Cleary and Witten, Text Compression (1990)", "https://openlibrary.org/books/OL2185474M/Text_compression"),
        new LinkItem("Ziv and Lempel, Compression of Individual Sequences via Variable-Rate Coding (1978)", "https://ieeexplore.ieee.org/document/1055934")
      ];

      // Test vectors - byte-exact against CompressionWorkbench's BB_Lzmw
      // building block. Expected outputs are given as hex.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("00000000"),
          "Empty input - only the 4-byte little-endian length header",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("A"),
          OpCodes.Hex8ToBytes("01000000410202"),
          "Single byte 0x41 - one literal code followed by the stop code",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("0001000061c2081c48b0a0c18308132a3c383020"),
          "Long repetitive run - 256 copies of 0x61, entries double in length each step",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = (i % 2) === 0 ? 0x61 : 0x62; return b; })(),
          OpCodes.Hex8ToBytes("4000000061c4081448b0a0c183070b0604"),
          "Alternating two-byte pattern - 32 repetitions of 'ab'",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("d3b07a1c8f4e2b6905c1fd3846a70e92"),
          OpCodes.Hex8ToBytes("10000000d360e9e1f0c8c98a340582f5c361e49403490101"),
          "Pseudo-random binary sample - 16 high-entropy bytes, no reusable matches",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("b400000074d0940111a74e9a316b408891f3e68e1b1066dee001a1a64e1b387340bcb153460e088104d984d19307049937675c80246810a142860e214aa46811a3468e1e598e2c7932e5ca962f63ceac7933e7ce9e3f830e2d7ab4674a17200202"),
          "ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
          OpCodes.Hex8ToBytes("000100000002081840a080810308122858c0a08183071022489840a182850b183268d8c0a183870f2042881841a28489132852a858c1a2858b173062c89841a3868d1b3872e8d8c1a3878f1f4082081942a488912348922859c2a489932750a2489942a58a952b58b268d9c2a58b972f60c2881943a68c993368d2a859c3a68d9b3770e2c89943a78e9d3b78f2e8d9c3a78f9f3f8002091a44a890a1438812295ac4a891a3479022499a44a992a54b983269dac4a993a74fa042891a45aa94a953a852a95ac5aa95ab57b062c99a45ab96ad5bb872e9dac5ab97af5fc082091b46ac98b163c892295bc6ac99b367d0a2499b46ad9ab56bd8b269dbc6ad9bb76fe0c2891b47ae9cb973e8d2a95bc7ae9dbb77f0e2c99b47af9ebd7bf8f2e9dbc7af9fbf7f0202"),
          "All 256 byte values 0x00..0xFF - no repetition, every code is a single byte",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LzmwInstance(this, isInverse);
    }
  }

  class LzmwInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? this._decompress(input) : this._compress(input);
    }

    _compress(data) {
      const out = [
        OpCodes.And32(data.length, 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF)
      ];

      if (data.length === 0) return out;

      const writer = new LsbBitWriter();

      // Two-deep width pipeline: activeBits is used for the write happening
      // right now, queuedBits is already committed for the NEXT write.
      let activeBits = MIN_BITS;
      let queuedBits = MIN_BITS;

      let root = buildInitialTrie();
      let nextCode = FIRST_USABLE_CODE;

      let match = LzmwInstance._findLongestMatch(root, data, 0);
      let curNode = match.node;
      let curCode = match.code;
      let curLen = match.length;
      let pos = 0;

      for (;;) {
        writer.writeBits(curCode, activeBits);
        pos += curLen;
        if (pos >= data.length) break;

        const next = LzmwInstance._findLongestMatch(root, data, pos);

        // Add the concatenation of the previous match (curNode) and the entire
        // next match as one new dictionary entry.
        const assigned = LzmwInstance._insertSuffix(curNode, data, pos, next.length, nextCode);
        if (assigned >= 0) nextCode = assigned + 1;

        // The width queued two writes ago is promoted unconditionally: that
        // promotion reflects an earlier, already-completed insertion and is due
        // regardless of whether this iteration's own insertion succeeded.
        activeBits = queuedBits;

        if (assigned < 0) {
          // Dictionary is full: reset and re-derive the current match against
          // the fresh dictionary so the next emitted code always fits in
          // MIN_BITS. The clear code is written at the just-promoted width,
          // never at a width grown from this abandoned insertion.
          writer.writeBits(CLEAR_CODE, activeBits);
          root = buildInitialTrie();
          nextCode = FIRST_USABLE_CODE;
          activeBits = MIN_BITS;
          queuedBits = MIN_BITS;
          match = LzmwInstance._findLongestMatch(root, data, pos);
          curNode = match.node;
          curCode = match.code;
          curLen = match.length;
          continue;
        }

        queuedBits = computeWidth(nextCode);

        curNode = next.node;
        curCode = next.code;
        curLen = next.length;
      }

      writer.writeBits(STOP_CODE, activeBits);
      const bits = writer.flush();
      for (let i = 0; i < bits.length; i++) out.push(bits[i]);

      return out;
    }

    // Walks from the root matching the longest existing dictionary entry that
    // is a prefix of data[pos..]. The walk continues through structural
    // (uncoded) nodes - created as intermediate steps of earlier single-entry
    // insertions - to find a possibly deeper coded descendant, tracking the
    // deepest node that actually carries a code.
    static _findLongestMatch(root, data, pos) {
      let node = root;
      let bestNode = null;
      let bestCode = -1;
      let bestLen = 0;
      let len = 0;
      let p = pos;

      while (p < data.length && node.children !== null && node.children.has(data[p])) {
        node = node.children.get(data[p]);
        ++len;
        ++p;
        if (node.code < 0) continue;
        bestNode = node;
        bestCode = node.code;
        bestLen = len;
      }

      return { node: bestNode, code: bestCode, length: bestLen };
    }

    // Inserts one new dictionary entry: the string reached by walking from
    // startNode (an already-matched entry) through the given suffix bytes.
    // Intermediate nodes created along the way stay uncoded; only the final
    // node receives the newly assigned code. Returns the assigned code, or -1
    // if the dictionary is already full.
    static _insertSuffix(startNode, data, pos, length, nextCode) {
      if (nextCode >= MAX_CODE) return -1;

      let node = startNode;
      for (let i = 0; i < length; ++i) {
        const b = data[pos + i];
        if (node.children === null) node.children = new Map();
        let child = node.children.get(b);
        if (child === undefined) {
          child = { children: null, code: -1 };
          node.children.set(b, child);
        }
        node = child;
      }

      node.code = nextCode;
      return nextCode;
    }

    _decompress(data) {
      if (data.length < 4) return [];

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) return [];

      const reader = new LsbBitReader(data, 4);
      const output = [];

      let currentBits = MIN_BITS;
      let nextCode = FIRST_USABLE_CODE;
      let dictionary = LzmwInstance._initDictionary();
      let previousEntry = null;

      while (output.length < originalSize) {
        let code;
        try {
          code = reader.readBits(currentBits);
        } catch (e) {
          break;
        }

        if (code === CLEAR_CODE) {
          dictionary = LzmwInstance._initDictionary();
          currentBits = MIN_BITS;
          nextCode = FIRST_USABLE_CODE;
          previousEntry = null;
          continue;
        }

        if (code === STOP_CODE) break;

        if (code >= dictionary.length)
          throw new Error('LZMW: invalid code ' + code + ' (dictionary size ' + dictionary.length + ')');

        const entry = dictionary[code];
        for (let i = 0; i < entry.length; i++) output.push(entry[i]);

        if (previousEntry !== null && nextCode < MAX_CODE) {
          const newEntry = new Array(previousEntry.length + entry.length);
          for (let i = 0; i < previousEntry.length; i++) newEntry[i] = previousEntry[i];
          for (let i = 0; i < entry.length; i++) newEntry[previousEntry.length + i] = entry[i];
          dictionary.push(newEntry);
          ++nextCode;

          // This naturally lands one insertion behind the encoder's own view -
          // exactly the width the encoder's two-write-delayed pipeline expects.
          currentBits = computeWidth(nextCode);
        }

        previousEntry = entry;
      }

      return output;
    }

    static _initDictionary() {
      const dictionary = [];
      for (let i = 0; i < CLEAR_CODE; ++i) dictionary.push([i]);
      dictionary.push([]); // clear code placeholder
      dictionary.push([]); // stop code placeholder
      return dictionary;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LzmwCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LzmwCompression, LzmwInstance };
}));
