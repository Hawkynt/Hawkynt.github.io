/*
 * Universal LZ78 Compression Algorithm
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Lempel-Ziv 1978 dictionary building algorithm
 * (c)2006-2025 Hawkynt
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * LZ78Algorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZ78Algorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZ78 Dictionary Building";
        this.description = "Lempel-Ziv 1978 algorithm builds dictionary of phrases during compression, providing universal compression without sliding window.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.inventor = "Abraham Lempel, Jacob Ziv";
        this.year = 1978;
        this.country = CountryCode.IL;

        // LZ78 Configuration parameters
        /** @type {int32} */
        this.MAX_DICTIONARY_SIZE = 4096; // Maximum number of dictionary entries

        this.documentation = [
          new LinkItem("Compression of Individual Sequences via Variable-Rate Coding", "https://ieeexplore.ieee.org/document/1055934"),
          new LinkItem("LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ78"),
          new LinkItem("Data Compression Techniques", "https://web.stanford.edu/class/ee398a/")
        ];

        this.references = [
          new LinkItem("The Data Compression Book", "https://www.amazon.com/Data-Compression-Book-Mark-Nelson/dp/0130907529"),
          new LinkItem("Introduction to Data Compression", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
        ];

        // Test vectors - round-trip verified. Byte-identical to the
        // CompressionWorkbench (C#) reference implementation (BB_Lz78).
        //
        // Wire format: a flat, self-describing token stream with NO length
        // header (compress of an empty input yields 0 bytes). Each token is
        // serialized as:
        //   [Index low byte][Index high byte][Flag byte]{[Literal byte]}
        // Index is the 2-byte little-endian dictionary index of the matched
        // trie node. Flag 0 means the token is followed by one literal byte
        // (the byte that caused the trie lookup to miss); a non-terminal
        // token is therefore 4 bytes total. Flag 1 means the token is
        // terminal (emitted only when the input ends mid-match) and carries
        // no literal byte, making it 3 bytes total.
        this.tests = [
          new TestCase(
            [], // Empty input
            [], // No tokens, no header
            "Empty input",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65], // "A"
            [0, 0, 0, 65], // 1 token: (index=0, byte='A')
            "Single character",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 66], // "AB"
            [0, 0, 0, 65, 0, 0, 0, 66], // 2 tokens: (0,'A'), (0,'B')
            "Two unique characters",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 65], // "AA"
            [0, 0, 0, 65, 1, 0, 1], // 2 tokens: (0,'A'), terminal(1)
            "Repeated character",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            // All 256 distinct byte values - regression test for the byte-0xFF
            // vs "no trailing byte" sentinel collision that used to drop data.
            Array.from({length: 256}, (_, i) => i),
            (() => {
              const out = [];
              for (let i = 0; i < 256; i++) out.push(0, 0, 0, i);
              return out;
            })(),
            "All 256 byte values (regression: byte 0xFF sentinel collision)",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            // Pseudo-random data, odd length (65 bytes, not a multiple of any token unit)
            [128,0,0,0,0,0,0,0,64,0,0,0,0,0,64,0,0,64,0,64,128,0,64,0,0,0,0,0,64,0,0,0,64,128,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,64,0,64,128,192,0,0,0,0,0,64],
            [0,0,0,128,0,0,0,0,2,0,0,0,3,0,0,0,2,0,0,64,4,0,0,0,5,0,0,0,7,0,0,64,1,0,0,0,0,0,0,64,6,0,0,0,10,0,0,0,3,0,0,64,1,0,0,192,11,0,0,0,15,0,0,0,7,0,0,0,13,0,0,0,10,0,0,128,0,0,0,192,11,0,0,64],
            "Pseudo-random data, odd length",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            // Alternating pattern, odd length (67 bytes)
            Array.from({length: 67}, (_, i) => (i % 2 ? 0x62 : 0x61)),
            [0,0,0,97,0,0,0,98,1,0,0,98,3,0,0,97,2,0,0,97,5,0,0,98,4,0,0,98,7,0,0,97,6,0,0,97,9,0,0,98,8,0,0,98,11,0,0,97,10,0,0,97,13,0,0,98,12,0,0,98,4,0,1],
            "Alternating pattern, odd length",
            "https://en.wikipedia.org/wiki/LZ78"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {LZ78Instance} New instance
       */
      CreateInstance(isInverse = false) {
        return new LZ78Instance(this, isInverse);
      }
    }

    /**
     * One LZ78 token: a dictionary index and the byte that follows it, or
     * -1 for the terminal token that has no following byte
     */
    class LZ78Token {
      /**
       * @param {int32} index - Dictionary entry
       * @param {int32} value - Following byte, or -1 when there is none
       */
      constructor(index, value) {
        /** @type {int32} */
        this.index = index;
        /** @type {int32} */
        this.byte = value;
      }
    }

    class LZ78Instance extends IAlgorithmInstance {
      /**
       * @param {LZ78Algorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decompress, false = compress
        /** @type {uint8[]} */
        this.inputBuffer = [];
        /** @type {boolean} */
        this.hasBeenFed = false;
        /** @type {int32} */
        this.maxDictionarySize = algorithm.MAX_DICTIONARY_SIZE;
      }

      /**
       * Collect input bytes
       * @param {uint8[]} data - Input bytes
       */
      Feed(data) {
        this.hasBeenFed = true;
        if (!data || data.length === 0) {
          return;
        }
        for (let k = 0; k < data.length; k++) {
          this.inputBuffer.push(data[k]);
        }
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        if (!this.hasBeenFed) {
          throw new Error('No data fed to algorithm');
        }

        // Process using existing compression logic
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          result = this.decompress(this.inputBuffer);
        } else {
          result = this.compress(this.inputBuffer);
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        this.hasBeenFed = false;
        return result;
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Serialized tokens
       */
      compress(data) {
        /** @type {LZ78Token[]} */
        const tokens = [];

        if (!data || data.length === 0) {
          return this._serializeTokens(tokens);
        }

        // Trie as per-entry child lists: the first child of each entry, the
        // next sibling of each child and the byte leading to it. Entry 0 is
        // the root (empty string); children are entries >= 1, so 0 marks
        // "no child"/"no sibling".
        /** @type {int32} */
        const maxEntries = this.maxDictionarySize;
        /** @type {int32[]} */
        const firstChild = new Int32Array(maxEntries);
        /** @type {int32[]} */
        const nextSibling = new Int32Array(maxEntries);
        /** @type {uint8[]} */
        const childByte = new Uint8Array(maxEntries);
        /** @type {int32} */
        let nextIndex = 1; // next dictionary entry index to assign
        /** @type {int32} */
        let currentIndex = 0; // current node in the trie (0 = root)

        for (let i = 0; i < data.length; i++) {
          /** @type {uint32} */
          const symbol = OpCodes.And32(data[i], 0xFF);

          /** @type {int32} */
          let childIndex = firstChild[currentIndex];
          while (childIndex !== 0 && childByte[childIndex] !== symbol) {
            childIndex = nextSibling[childIndex];
          }

          if (childIndex !== 0) {
            // Extend the current match.
            currentIndex = childIndex;
            continue;
          }

          // Mismatch: emit token and add new entry.
          tokens.push(new LZ78Token(currentIndex, symbol));

          childByte[nextIndex] = symbol;
          nextSibling[nextIndex] = firstChild[currentIndex];
          firstChild[currentIndex] = nextIndex;
          ++nextIndex;
          currentIndex = 0;

          // Reset dictionary when it reaches maximum size.
          if (nextIndex < maxEntries) {
            continue;
          }

          firstChild.fill(0);
          nextIndex = 1;
        }

        // If we ended mid-match, emit a terminal token.
        if (currentIndex > 0) {
          tokens.push(new LZ78Token(currentIndex, -1));
        }

        return this._serializeTokens(tokens);
      }

      /**
       * @param {uint8[]} data - Serialized tokens
       * @returns {uint8[]} Decoded bytes
       */
      decompress(data) {
        /** @type {uint8[]} */
        const output = [];
        if (!data || data.length === 0) {
          return output;
        }

        // Deserialize tokens
        /** @type {LZ78Token[]} */
        const tokens = this._deserializeTokens(data);

        // Rebuild dictionary and output during decompression.
        // Dictionary entry 0 = empty byte array (root).
        /** @type {uint8[][]} */
        let dictionary = [];
        /** @type {uint8[]} */
        const root = [];
        dictionary.push(root);
        /** @type {int32} */
        const maxEntries = this.maxDictionarySize;

        for (let t = 0; t < tokens.length; t++) {
          /** @type {LZ78Token} */
          const token = tokens[t];
          if (token.index < 0 || token.index >= dictionary.length) {
            throw new Error('Invalid dictionary index in compressed data');
          }

          /** @type {uint8[]} */
          const prefix = dictionary[token.index];

          if (token.byte >= 0) {
            // Normal token: prefix + next byte.
            /** @type {uint8[]} */
            const entry = prefix.slice();
            entry.push(token.byte);
            for (let k = 0; k < entry.length; k++) {
              output.push(entry[k]);
            }
            dictionary.push(entry);

            // Reset dictionary when it reaches maximum size.
            if (dictionary.length < maxEntries) {
              continue;
            }

            /** @type {uint8[][]} */
            const restarted = [];
            /** @type {uint8[]} */
            const emptyRoot = [];
            restarted.push(emptyRoot);
            dictionary = restarted;
          } else {
            // Terminal token: emit prefix only, no new dictionary entry.
            for (let k = 0; k < prefix.length; k++) {
              output.push(prefix[k]);
            }
          }
        }

        return output;
      }

      /**
       * Serialize tokens to compressed format.
       * Flat, self-describing stream with no length header - the empty
       * input therefore compresses to 0 bytes. Per token:
       *   [Index low byte][Index high byte][Flag byte]{[Literal byte]}
       * Index is the little-endian 2-byte dictionary index. Flag 0 means a
       * literal byte follows (4-byte token); flag 1 marks a terminal token
       * with no literal byte (3-byte token, only ever the last token in the
       * stream, emitted when the input ends mid-match).
       * @private
       * @param {LZ78Token[]} tokens - Tokens
       * @returns {uint8[]} Serialized bytes
       */
      _serializeTokens(tokens) {
        /** @type {uint8[]} */
        const bytes = [];

        for (let t = 0; t < tokens.length; t++) {
          /** @type {LZ78Token} */
          const token = tokens[t];
          // Index (2 bytes, little-endian) using OpCodes
          /** @type {uint8[]} */
          const indexBytes = OpCodes.Unpack16LE(token.index);
          bytes.push(indexBytes[0]);
          bytes.push(indexBytes[1]);

          // Flag byte + optional literal byte
          if (token.byte >= 0) {
            bytes.push(0);
            bytes.push(OpCodes.And32(token.byte, 0xFF));
          } else {
            bytes.push(1);
          }
        }

        return bytes;
      }

      /**
       * Deserialize tokens from compressed format
       * @private
       * @param {uint8[]} compressedData - Serialized bytes
       * @returns {LZ78Token[]} Tokens
       */
      _deserializeTokens(compressedData) {
        /** @type {uint8[]} */
        const bytes = compressedData;
        /** @type {LZ78Token[]} */
        const tokens = [];

        /** @type {int32} */
        let pos = 0;
        while (pos < bytes.length) {
          if (pos + 3 > bytes.length) {
            throw new Error('Invalid compressed data: truncated token');
          }

          // Read index (2 bytes, little-endian) using OpCodes
          /** @type {int32} */
          const index = OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]);
          /** @type {uint8} */
          const flag = bytes[pos + 2];

          if (flag === 0) {
            if (pos + 4 > bytes.length) {
              throw new Error('Invalid compressed data: truncated token');
            }
            tokens.push(new LZ78Token(index, bytes[pos + 3]));
            pos += 4;
          } else {
            tokens.push(new LZ78Token(index, -1));
            pos += 3;
          }
        }

        return tokens;
      }

      // Utility functions

      /**
       * @param {string} str - Text
       * @returns {uint8[]} Low byte of each character
       */
      _stringToBytes(str) {
        /** @type {uint8[]} */
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(OpCodes.And32(str.charCodeAt(i), 0xFF));
        }
        return bytes;
      }

      /**
       * @param {uint8[]} bytes - Bytes
       * @returns {string} One character per byte
       */
      _bytesToString(bytes) {
        /** @type {string} */
        let str = "";
        for (let i = 0; i < bytes.length; i++) {
          str += String.fromCharCode(bytes[i]);
        }
        return str;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZ78Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZ78Algorithm, LZ78Instance };
}));