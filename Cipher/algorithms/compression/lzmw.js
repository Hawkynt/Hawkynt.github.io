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

  /** @type {int32} */
  const MIN_BITS = 9;
  /** @type {int32} */
  const MAX_BITS = 16;
  /** @type {int32} */
  const CLEAR_CODE = OpCodes.Shl32(1, MIN_BITS - 1);  // 256
  /** @type {int32} */
  const STOP_CODE = CLEAR_CODE + 1;                    // 257
  /** @type {int32} */
  const FIRST_USABLE_CODE = CLEAR_CODE + 2;            // 258
  /** @type {int32} */
  const MAX_CODE = OpCodes.Shl32(1, MAX_BITS);         // 65536

  // ===== BIT STREAM HELPERS (LSB-first) =====

  class LsbBitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.buf = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {uint32} value - Value (below 2^width)
     * @param {int32} width - Number of bits
     */
    writeBits(value, width) {
      this.buf = OpCodes.Or32(this.buf, OpCodes.Shl32(value, this.nBits));
      this.nBits += width;
      while (this.nBits >= 8) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = OpCodes.Shr32(this.buf, 8);
        this.nBits -= 8;
      }
    }

    /**
     * @returns {uint8[]} All bytes, the last one zero-padded
     */
    flush() {
      if (this.nBits > 0) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class LsbBitReader {
    /**
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} start - Position of the first bit's byte
     */
    constructor(bytes, start) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = start;
      /** @type {uint32} */
      this.buf = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {int32} width - Number of bits
     * @returns {boolean} True when width more bits are available
     */
    canRead(width) {
      return this.nBits + 8 * (this.bytes.length - this.pos) >= width;
    }

    /**
     * @param {int32} width - Number of bits
     * @returns {uint32} Value read
     */
    readBits(width) {
      while (this.nBits < width) {
        if (this.pos >= this.bytes.length) {
          throw new Error('LZMW: unexpected end of stream');
        }
        this.buf = OpCodes.Or32(this.buf, OpCodes.Shl32(this.bytes[this.pos++], this.nBits));
        this.nBits += 8;
      }
      /** @type {uint32} */
      const mask = OpCodes.Sub32(OpCodes.Shl32(1, width), 1);
      /** @type {uint32} */
      const value = OpCodes.And32(this.buf, mask);
      this.buf = OpCodes.Shr32(this.buf, width);
      this.nBits -= width;
      return value;
    }
  }

  // ===== SHARED HELPERS =====

  // The monotonic code-width growth rule shared by LZW, LZMW and LZAP: the
  // width needed to represent codes up to (but not including) nextCode.
  /**
   * @param {int32} nextCode - Next code to be assigned
   * @returns {int32} Code width in bits
   */
  function computeWidth(nextCode) {
    /** @type {int32} */
    let w = MIN_BITS;
    while (nextCode >= OpCodes.Shl32(1, w) && w < MAX_BITS) {
      ++w;
    }
    return w;
  }

  /**
   * Dictionary trie: node 0 is the root; every node carries a code (-1 for
   * structural nodes). The (parent, byte) -> child edges live in an
   * open-addressing hash table, which only answers lookups and is never
   * iterated, so its layout cannot influence any code.
   */
  class LzmwTrie {
    constructor() {
      /** @type {int32[]} */
      this.code = [-1];
      /** @type {int32[]} */
      this.edgeParent = new Int32Array(1024).fill(-1);
      /** @type {int32[]} */
      this.edgeByte = new Int32Array(1024);
      /** @type {int32[]} */
      this.edgeChild = new Int32Array(1024);
      /** @type {int32} */
      this.edgeMask = 1023;
      /** @type {int32} */
      this.edgeCount = 0;
      for (let b = 0; b < 256; ++b) {
        /** @type {int32} */
        const leaf = this.addNode(b);
        this.addEdge(0, b, leaf);
      }
    }

    /**
     * @param {int32} nodeCode - Code of the new node (-1 for none)
     * @returns {int32} New node
     */
    addNode(nodeCode) {
      this.code.push(nodeCode);
      return this.code.length - 1;
    }

    /**
     * @param {int32} parent - Node
     * @param {int32} value - Edge byte
     * @returns {int32} Hash table slot of the edge, or the empty slot for it
     */
    _slot(parent, value) {
      /** @type {uint32} */
      const h = OpCodes.Xor32(OpCodes.Mul32(parent, 0x9E3779B1), OpCodes.Mul32(value, 0x85EBCA77));
      /** @type {int32} */
      let slot = OpCodes.And32(OpCodes.Xor32(h, OpCodes.Shr32(h, 16)), this.edgeMask);
      while (this.edgeParent[slot] !== -1) {
        if (this.edgeParent[slot] === parent && this.edgeByte[slot] === value) {
          break;
        }
        slot = OpCodes.And32(slot + 1, this.edgeMask);
      }
      return slot;
    }

    /**
     * @param {int32} parent - Node
     * @param {int32} value - Edge byte
     * @returns {int32} Child node, or -1 when there is none
     */
    child(parent, value) {
      /** @type {int32} */
      const slot = this._slot(parent, value);
      if (this.edgeParent[slot] === -1) {
        return -1;
      }
      return this.edgeChild[slot];
    }

    /**
     * @param {int32} parent - Node
     * @param {int32} value - Edge byte
     * @param {int32} childNode - Child node
     */
    addEdge(parent, value, childNode) {
      /** @type {int32} */
      const slot = this._slot(parent, value);
      this.edgeParent[slot] = parent;
      this.edgeByte[slot] = value;
      this.edgeChild[slot] = childNode;
      ++this.edgeCount;
      if (this.edgeCount * 2 > this.edgeMask) {
        this._grow();
      }
    }

    /** Double the edge table and re-insert every edge */
    _grow() {
      /** @type {int32[]} */
      const oldParent = this.edgeParent;
      /** @type {int32[]} */
      const oldByte = this.edgeByte;
      /** @type {int32[]} */
      const oldChild = this.edgeChild;
      /** @type {int32} */
      const size = (this.edgeMask + 1) * 2;
      this.edgeParent = new Int32Array(size).fill(-1);
      this.edgeByte = new Int32Array(size);
      this.edgeChild = new Int32Array(size);
      this.edgeMask = size - 1;
      for (let i = 0; i < oldParent.length; i++) {
        if (oldParent[i] !== -1) {
          /** @type {int32} */
          const slot = this._slot(oldParent[i], oldByte[i]);
          this.edgeParent[slot] = oldParent[i];
          this.edgeByte[slot] = oldByte[i];
          this.edgeChild[slot] = oldChild[i];
        }
      }
    }
  }

  /**
   * Longest coded dictionary entry found at a position
   */
  class LzmwMatch {
    /**
     * @param {int32} node - Trie node of the entry (-1 when none)
     * @param {int32} code - Its code (-1 when none)
     * @param {int32} length - Its length (0 when none)
     */
    constructor(node, code, length) {
      /** @type {int32} */
      this.node = node;
      /** @type {int32} */
      this.code = code;
      /** @type {int32} */
      this.length = length;
    }
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

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {LzmwInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new LzmwInstance(this, isInverse);
    }
  }

  class LzmwInstance extends IAlgorithmInstance {
    /**
     * @param {LzmwCompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      if (this.isInverse) {
        return this._decompress(input);
      }
      return this._compress(input);
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Size header and code stream
     */
    _compress(data) {
      /** @type {uint8[]} */
      const out = [];
      out.push(OpCodes.And32(data.length, 0xFF));
      out.push(OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF));
      out.push(OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF));
      out.push(OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF));

      if (data.length === 0) {
        return out;
      }

      /** @type {LsbBitWriter} */
      const writer = new LsbBitWriter();

      // Two-deep width pipeline: activeBits is used for the write happening
      // right now, queuedBits is already committed for the NEXT write.
      /** @type {int32} */
      let activeBits = MIN_BITS;
      /** @type {int32} */
      let queuedBits = MIN_BITS;

      /** @type {LzmwTrie} */
      let root = new LzmwTrie();
      /** @type {int32} */
      let nextCode = FIRST_USABLE_CODE;

      /** @type {LzmwMatch} */
      let match = LzmwInstance._findLongestMatch(root, data, 0);
      /** @type {int32} */
      let curNode = match.node;
      /** @type {int32} */
      let curCode = match.code;
      /** @type {int32} */
      let curLen = match.length;
      /** @type {int32} */
      let pos = 0;

      for (;;) {
        writer.writeBits(curCode, activeBits);
        pos += curLen;
        if (pos >= data.length) {
          break;
        }

        /** @type {LzmwMatch} */
        const next = LzmwInstance._findLongestMatch(root, data, pos);

        // Add the concatenation of the previous match (curNode) and the entire
        // next match as one new dictionary entry.
        /** @type {int32} */
        const assigned = LzmwInstance._insertSuffix(root, curNode, data, pos, next.length, nextCode);
        if (assigned >= 0) {
          nextCode = assigned + 1;
        }

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
          root = new LzmwTrie();
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
      /** @type {uint8[]} */
      const bits = writer.flush();
      for (let i = 0; i < bits.length; i++) {
        out.push(bits[i]);
      }

      return out;
    }

    // Walks from the root matching the longest existing dictionary entry that
    // is a prefix of data[pos..]. The walk continues through structural
    // (uncoded) nodes - created as intermediate steps of earlier single-entry
    // insertions - to find a possibly deeper coded descendant, tracking the
    // deepest node that actually carries a code.
    /**
     * @param {LzmwTrie} trie - Dictionary
     * @param {uint8[]} data - Input bytes
     * @param {int32} pos - Position to match
     * @returns {LzmwMatch} Deepest coded entry on the path
     */
    static _findLongestMatch(trie, data, pos) {
      /** @type {int32} */
      let node = 0;
      /** @type {int32} */
      let bestNode = -1;
      /** @type {int32} */
      let bestCode = -1;
      /** @type {int32} */
      let bestLen = 0;
      /** @type {int32} */
      let len = 0;
      /** @type {int32} */
      let p = pos;

      while (p < data.length) {
        /** @type {int32} */
        const childNode = trie.child(node, data[p]);
        if (childNode < 0) {
          break;
        }
        node = childNode;
        ++len;
        ++p;
        if (trie.code[node] < 0) {
          continue;
        }
        bestNode = node;
        bestCode = trie.code[node];
        bestLen = len;
      }

      return new LzmwMatch(bestNode, bestCode, bestLen);
    }

    // Inserts one new dictionary entry: the string reached by walking from
    // startNode (an already-matched entry) through the given suffix bytes.
    // Intermediate nodes created along the way stay uncoded; only the final
    // node receives the newly assigned code. Returns the assigned code, or -1
    // if the dictionary is already full.
    /**
     * @param {LzmwTrie} trie - Dictionary
     * @param {int32} startNode - Node of the previous match
     * @param {uint8[]} data - Input bytes
     * @param {int32} pos - Start of the suffix
     * @param {int32} length - Suffix length
     * @param {int32} nextCode - Code to assign
     * @returns {int32} Assigned code, or -1 when the dictionary is full
     */
    static _insertSuffix(trie, startNode, data, pos, length, nextCode) {
      if (nextCode >= MAX_CODE) {
        return -1;
      }

      /** @type {int32} */
      let node = startNode;
      for (let i = 0; i < length; ++i) {
        /** @type {uint8} */
        const b = data[pos + i];
        /** @type {int32} */
        let childNode = trie.child(node, b);
        if (childNode < 0) {
          childNode = trie.addNode(-1);
          trie.addEdge(node, b, childNode);
        }
        node = childNode;
      }

      trie.code[node] = nextCode;
      return nextCode;
    }

    /**
     * @param {uint8[]} data - Size header and code stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(data) {
      /** @type {uint8[]} */
      const output = [];
      if (data.length < 4) {
        return output;
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) {
        return output;
      }

      /** @type {LsbBitReader} */
      const reader = new LsbBitReader(data, 4);

      /** @type {int32} */
      let currentBits = MIN_BITS;
      /** @type {int32} */
      let nextCode = FIRST_USABLE_CODE;
      /** @type {uint8[][]} */
      let dictionary = LzmwInstance._initDictionary();
      /** @type {uint8[]} */
      let previousEntry = null;

      while (output.length < originalSize) {
        // A stream that ends in the middle of a code ends the output.
        /** @type {boolean} */
        const available = reader.canRead(currentBits);
        if (!available) {
          break;
        }
        /** @type {uint32} */
        const code = reader.readBits(currentBits);

        if (code === CLEAR_CODE) {
          dictionary = LzmwInstance._initDictionary();
          currentBits = MIN_BITS;
          nextCode = FIRST_USABLE_CODE;
          previousEntry = null;
          continue;
        }

        if (code === STOP_CODE) {
          break;
        }

        if (code >= dictionary.length) {
          throw new Error('LZMW: invalid code ' + code + ' (dictionary size ' + dictionary.length + ')');
        }

        /** @type {uint8[]} */
        const entry = dictionary[code];
        for (let i = 0; i < entry.length; i++) {
          output.push(entry[i]);
        }

        if (previousEntry !== null && nextCode < MAX_CODE) {
          /** @type {uint8[]} */
          const newEntry = new Array(previousEntry.length + entry.length);
          for (let i = 0; i < previousEntry.length; i++) {
            newEntry[i] = previousEntry[i];
          }
          for (let i = 0; i < entry.length; i++) {
            newEntry[previousEntry.length + i] = entry[i];
          }
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

    /**
     * @returns {uint8[][]} Byte entries plus the clear and stop placeholders
     */
    static _initDictionary() {
      /** @type {uint8[][]} */
      const dictionary = [];
      for (let i = 0; i < CLEAR_CODE; ++i) {
        dictionary.push([i]);
      }
      /** @type {uint8[]} */
      const clearPlaceholder = [];
      /** @type {uint8[]} */
      const stopPlaceholder = [];
      dictionary.push(clearPlaceholder); // clear code placeholder
      dictionary.push(stopPlaceholder); // stop code placeholder
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
