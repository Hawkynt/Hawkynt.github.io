/*
 * LZAP (Lempel-Ziv All Prefixes) Compression Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A derivative of LZMW attributed to James Storer (1988). Where LZMW adds only
 * the concatenation of the previous match and the entire current match, LZAP
 * adds the previous match concatenated with EVERY prefix of the current match.
 * If the previous match is "com" and the current match is "press", LZAP adds
 * "comp", "compr", "compre", "compres" and "compress" - five entries, where LZW
 * would add one ("comp") and LZMW would add one ("compress"). This trades a much
 * larger dictionary (and correspondingly more frequent resets) for fewer
 * emitted codes.
 *
 * Specification source:
 *   Wikibooks, "Data Compression/Dictionary compression" (LZAP section).
 *
 * Wire format (matches CompressionWorkbench's BB_Lzap building block):
 *   [originalLength: 4 bytes little-endian][variable-width code stream]
 * Codes are packed least-significant-bit first, start at 9 bits and grow to at
 * most 12 bits. The 12-bit ceiling is deliberately lower than LZW's customary
 * 16: "every prefix" makes the dictionary grow multiplicatively rather than
 * linearly on repetitive input, so a wider code space would let single entries
 * reach tens of thousands of bytes before a reset. Code 256 clears the
 * dictionary and resets the width, code 257 ends the stream, and dictionary
 * entries start at 258. An empty input produces only the 4-byte header.
 *
 * Code-width growth is applied two writes after the batch of insertions that
 * triggered it. The decoder can only replicate a step's prefix insertions once
 * it has decoded the next code (their content depends on that code's bytes), so
 * it is always one insertion batch behind the encoder; delaying width growth by
 * one extra write keeps both sides synchronised.
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

  // ===== ALGORITHM PARAMETERS (fixed to match CompressionWorkbench's BB_Lzap) =====

  /** @type {int32} */
  const MIN_BITS = 9;
  /** @type {int32} */
  const MAX_BITS = 12;
  /** @type {int32} */
  const CLEAR_CODE = OpCodes.Shl32(1, MIN_BITS - 1);  // 256
  /** @type {int32} */
  const STOP_CODE = CLEAR_CODE + 1;                    // 257
  /** @type {int32} */
  const FIRST_USABLE_CODE = CLEAR_CODE + 2;            // 258
  /** @type {int32} */
  const MAX_CODE = OpCodes.Shl32(1, MAX_BITS);         // 4096

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
          throw new Error('LZAP: unexpected end of stream');
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
  class LzapTrie {
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
  class LzapMatch {
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
   * LzapCompression - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class LzapCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZAP";
      this.description = "Lempel-Ziv All Prefixes, a derivative of LZMW: after coding a match the dictionary gains the previous match concatenated with every prefix of the current match rather than a single entry, so far fewer codes are emitted at the cost of a rapidly filling dictionary. Variable-width codes from 9 to 12 bits are packed least-significant-bit first behind a 4-byte little-endian length header, with clear and stop codes.";
      this.inventor = "James A. Storer";
      this.year = 1988;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikibooks - Data Compression/Dictionary compression", "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"),
        new LinkItem("Wikipedia - LZW variants", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch#Variants")
      ];

      this.references = [
        new LinkItem("Storer, Data Compression: Methods and Theory (1988)", "https://openlibrary.org/books/OL2394827M/Data_compression"),
        new LinkItem("Miller and Wegman, Variations on a theme by Ziv and Lempel (NATO ASI Series F12, 1985)", "https://link.springer.com/chapter/10.1007/978-3-642-82456-2_9")
      ];

      // Test vectors - byte-exact against CompressionWorkbench's BB_Lzap
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
          OpCodes.Hex8ToBytes("0001000061c20824789021c59036b13ece1910"),
          "Long repetitive run - 256 copies of 0x61, every prefix widens the dictionary at once",
          "https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = (i % 2) === 0 ? 0x61 : 0x62; return b; })(),
          OpCodes.Hex8ToBytes("4000000061c40814685021448d260302"),
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
          OpCodes.Hex8ToBytes("b400000074d0940111a74e9a316b408891f3e68e1b1066dee001a1a64e1b387340bcb153460e088104d984d19307049937675c84246810a142860e214aa46811a3468e1e63963c9972e5cb993777fe1c7a74a954ab5cc9b2a5fbf77040"),
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
     * @returns {LzapInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new LzapInstance(this, isInverse);
    }
  }

  class LzapInstance extends IAlgorithmInstance {
    /**
     * @param {LzapCompression} algorithm - Parent algorithm
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

      /** @type {LzapTrie} */
      let root = new LzapTrie();
      /** @type {int32} */
      let nextCode = FIRST_USABLE_CODE;

      /** @type {LzapMatch} */
      let match = LzapInstance._findLongestMatch(root, data, 0);
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

        /** @type {LzapMatch} */
        const next = LzapInstance._findLongestMatch(root, data, pos);

        // Add the previous match concatenated with every prefix of the current
        // match, walking forward from curNode one byte at a time.
        /** @type {int32} */
        const assigned = LzapInstance._insertAllPrefixes(root, curNode, data, pos, next.length, nextCode);
        nextCode += assigned;

        // The width queued two writes ago is promoted unconditionally: that
        // promotion reflects an earlier, already-completed insertion and is due
        // regardless of whether this iteration's own insertion succeeded.
        activeBits = queuedBits;

        if (assigned < next.length) {
          // The dictionary filled up partway through (or before) adding this
          // step's prefixes: reset and re-derive the current match against the
          // fresh dictionary. The clear code is written at the just-promoted
          // width, never at a width grown from this abandoned insertion.
          writer.writeBits(CLEAR_CODE, activeBits);
          root = new LzapTrie();
          nextCode = FIRST_USABLE_CODE;
          activeBits = MIN_BITS;
          queuedBits = MIN_BITS;
          match = LzapInstance._findLongestMatch(root, data, pos);
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
    // is a prefix of data[pos..]. Every node beyond the root carries a code by
    // construction (LZAP codes every prefix it inserts), so the walk simply
    // stops at the first missing child.
    /**
     * @param {LzapTrie} trie - Dictionary
     * @param {uint8[]} data - Input bytes
     * @param {int32} pos - Position to match
     * @returns {LzapMatch} Longest entry on the path
     */
    static _findLongestMatch(trie, data, pos) {
      /** @type {int32} */
      let node = 0;
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
      }

      return new LzapMatch(node, trie.code[node], len);
    }

    // Inserts one new dictionary entry per prefix of the current match's bytes,
    // walking forward from startNode (the previous match's already-matched
    // node) one byte at a time - length 1, then 2, then 3, and so on - assigning
    // a fresh code to every node visited. Reports how many prefixes were
    // actually assigned before the dictionary filled up.
    /**
     * @param {LzapTrie} trie - Dictionary
     * @param {int32} startNode - Node of the previous match
     * @param {uint8[]} data - Input bytes
     * @param {int32} pos - Start of the current match
     * @param {int32} length - Length of the current match
     * @param {int32} nextCode - First code to assign
     * @returns {int32} Number of prefixes assigned (codes used)
     */
    static _insertAllPrefixes(trie, startNode, data, pos, length, nextCode) {
      /** @type {int32} */
      let node = startNode;
      /** @type {int32} */
      let assigned = 0;
      /** @type {int32} */
      let code = nextCode;

      for (let i = 0; i < length; ++i) {
        if (code >= MAX_CODE) {
          break;
        }

        /** @type {uint8} */
        const b = data[pos + i];
        /** @type {int32} */
        let childNode = trie.child(node, b);
        if (childNode < 0) {
          childNode = trie.addNode(-1);
          trie.addEdge(node, b, childNode);
        }
        node = childNode;
        trie.code[node] = code;
        ++code;
        ++assigned;
      }

      return assigned;
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
      let dictionary = LzapInstance._initDictionary();
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
          dictionary = LzapInstance._initDictionary();
          currentBits = MIN_BITS;
          nextCode = FIRST_USABLE_CODE;
          previousEntry = null;
          continue;
        }

        if (code === STOP_CODE) {
          break;
        }

        if (code >= dictionary.length) {
          throw new Error('LZAP: invalid code ' + code + ' (dictionary size ' + dictionary.length + ')');
        }

        /** @type {uint8[]} */
        const entry = dictionary[code];
        for (let i = 0; i < entry.length; i++) {
          output.push(entry[i]);
        }

        if (previousEntry !== null) {
          /** @type {int32} */
          const prevLen = previousEntry.length;
          /** @type {boolean} */
          let completed = true;
          for (let prefixLen = 1; prefixLen <= entry.length; ++prefixLen) {
            if (nextCode >= MAX_CODE) {
              completed = false;
              break;
            }

            /** @type {uint8[]} */
            const newEntry = new Array(prevLen + prefixLen);
            for (let i = 0; i < prevLen; i++) {
              newEntry[i] = previousEntry[i];
            }
            for (let i = 0; i < prefixLen; i++) {
              newEntry[prevLen + i] = entry[i];
            }
            dictionary.push(newEntry);
            ++nextCode;
          }

          // Only grow the width when every prefix was added. When the batch is
          // cut short by a full dictionary the encoder abandons this insertion
          // outright and writes a clear code at whatever width was already
          // active, so the width must be left untouched here for the upcoming
          // clear code to be read at the width it was written with.
          if (completed) {
            currentBits = computeWidth(nextCode);
          }
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

  const algorithmInstance = new LzapCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LzapCompression, LzapInstance };
}));
