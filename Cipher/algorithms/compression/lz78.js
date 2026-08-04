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

        // Test vectors - round-trip verified. Token format is
        // [Index(2 bytes)][HasByteFlag(1 byte)][Byte(1 byte)]; the flag byte
        // is required because byte value 0xFF is a legal input byte and can
        // not double as a "no trailing byte" sentinel (see allbytes vector).
        this.tests = [
          new TestCase(
            [], // Empty input
            [0, 0, 0, 0], // No tokens
            "Empty input",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65], // "A"
            [0, 0, 0, 1, 0, 0, 1, 65], // 1 token: (0,'A')
            "Single character",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 66], // "AB"
            [0, 0, 0, 2, 0, 0, 1, 65, 0, 0, 1, 66], // 2 tokens: (0,'A'), (0,'B')
            "Two unique characters",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 65], // "AA"
            [0, 0, 0, 2, 0, 0, 1, 65, 0, 1, 0, 0], // 2 tokens: (0,'A'), (1,null)
            "Repeated character",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            // All 256 distinct byte values - regression test for the byte-0xFF
            // vs "no trailing byte" sentinel collision that used to drop data.
            Array.from({length: 256}, (_, i) => i),
            [
              0,0,1,0, 0,0,1,0,0,0,1,1,0,0,1,2,0,0,1,3,0,0,1,4,0,0,1,5,0,0,1,6,0,0,1,7,0,0,1,8,0,0,1,9,
              0,0,1,10,0,0,1,11,0,0,1,12,0,0,1,13,0,0,1,14,0,0,1,15,0,0,1,16,0,0,1,17,0,0,1,18,0,0,1,19,
              0,0,1,20,0,0,1,21,0,0,1,22,0,0,1,23,0,0,1,24,0,0,1,25,0,0,1,26,0,0,1,27,0,0,1,28,0,0,1,29,
              0,0,1,30,0,0,1,31,0,0,1,32,0,0,1,33,0,0,1,34,0,0,1,35,0,0,1,36,0,0,1,37,0,0,1,38,0,0,1,39,
              0,0,1,40,0,0,1,41,0,0,1,42,0,0,1,43,0,0,1,44,0,0,1,45,0,0,1,46,0,0,1,47,0,0,1,48,0,0,1,49,
              0,0,1,50,0,0,1,51,0,0,1,52,0,0,1,53,0,0,1,54,0,0,1,55,0,0,1,56,0,0,1,57,0,0,1,58,0,0,1,59,
              0,0,1,60,0,0,1,61,0,0,1,62,0,0,1,63,0,0,1,64,0,0,1,65,0,0,1,66,0,0,1,67,0,0,1,68,0,0,1,69,
              0,0,1,70,0,0,1,71,0,0,1,72,0,0,1,73,0,0,1,74,0,0,1,75,0,0,1,76,0,0,1,77,0,0,1,78,0,0,1,79,
              0,0,1,80,0,0,1,81,0,0,1,82,0,0,1,83,0,0,1,84,0,0,1,85,0,0,1,86,0,0,1,87,0,0,1,88,0,0,1,89,
              0,0,1,90,0,0,1,91,0,0,1,92,0,0,1,93,0,0,1,94,0,0,1,95,0,0,1,96,0,0,1,97,0,0,1,98,0,0,1,99,
              0,0,1,100,0,0,1,101,0,0,1,102,0,0,1,103,0,0,1,104,0,0,1,105,0,0,1,106,0,0,1,107,0,0,1,108,0,0,1,109,
              0,0,1,110,0,0,1,111,0,0,1,112,0,0,1,113,0,0,1,114,0,0,1,115,0,0,1,116,0,0,1,117,0,0,1,118,0,0,1,119,
              0,0,1,120,0,0,1,121,0,0,1,122,0,0,1,123,0,0,1,124,0,0,1,125,0,0,1,126,0,0,1,127,0,0,1,128,0,0,1,129,
              0,0,1,130,0,0,1,131,0,0,1,132,0,0,1,133,0,0,1,134,0,0,1,135,0,0,1,136,0,0,1,137,0,0,1,138,0,0,1,139,
              0,0,1,140,0,0,1,141,0,0,1,142,0,0,1,143,0,0,1,144,0,0,1,145,0,0,1,146,0,0,1,147,0,0,1,148,0,0,1,149,
              0,0,1,150,0,0,1,151,0,0,1,152,0,0,1,153,0,0,1,154,0,0,1,155,0,0,1,156,0,0,1,157,0,0,1,158,0,0,1,159,
              0,0,1,160,0,0,1,161,0,0,1,162,0,0,1,163,0,0,1,164,0,0,1,165,0,0,1,166,0,0,1,167,0,0,1,168,0,0,1,169,
              0,0,1,170,0,0,1,171,0,0,1,172,0,0,1,173,0,0,1,174,0,0,1,175,0,0,1,176,0,0,1,177,0,0,1,178,0,0,1,179,
              0,0,1,180,0,0,1,181,0,0,1,182,0,0,1,183,0,0,1,184,0,0,1,185,0,0,1,186,0,0,1,187,0,0,1,188,0,0,1,189,
              0,0,1,190,0,0,1,191,0,0,1,192,0,0,1,193,0,0,1,194,0,0,1,195,0,0,1,196,0,0,1,197,0,0,1,198,0,0,1,199,
              0,0,1,200,0,0,1,201,0,0,1,202,0,0,1,203,0,0,1,204,0,0,1,205,0,0,1,206,0,0,1,207,0,0,1,208,0,0,1,209,
              0,0,1,210,0,0,1,211,0,0,1,212,0,0,1,213,0,0,1,214,0,0,1,215,0,0,1,216,0,0,1,217,0,0,1,218,0,0,1,219,
              0,0,1,220,0,0,1,221,0,0,1,222,0,0,1,223,0,0,1,224,0,0,1,225,0,0,1,226,0,0,1,227,0,0,1,228,0,0,1,229,
              0,0,1,230,0,0,1,231,0,0,1,232,0,0,1,233,0,0,1,234,0,0,1,235,0,0,1,236,0,0,1,237,0,0,1,238,0,0,1,239,
              0,0,1,240,0,0,1,241,0,0,1,242,0,0,1,243,0,0,1,244,0,0,1,245,0,0,1,246,0,0,1,247,0,0,1,248,0,0,1,249,
              0,0,1,250,0,0,1,251,0,0,1,252,0,0,1,253,0,0,1,254,0,0,1,255
            ],
            "All 256 byte values (regression: byte 0xFF sentinel collision)",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            // Pseudo-random data, odd length (65 bytes, not a multiple of any token unit)
            [128,0,0,0,0,0,0,0,64,0,0,0,0,0,64,0,0,64,0,64,128,0,64,0,0,0,0,0,64,0,0,0,64,128,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,64,0,64,128,192,0,0,0,0,0,64],
            [0,0,0,21,0,0,1,128,0,0,1,0,0,2,1,0,0,3,1,0,0,2,1,64,0,4,1,0,0,5,1,0,0,7,1,64,0,1,1,0,0,0,1,64,0,6,1,0,0,10,1,0,0,3,1,64,0,1,1,192,0,11,1,0,0,15,1,0,0,7,1,0,0,13,1,0,0,10,1,128,0,0,1,192,0,11,1,64],
            "Pseudo-random data, odd length",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            // Alternating pattern, odd length (67 bytes)
            Array.from({length: 67}, (_, i) => (i % 2 ? 0x62 : 0x61)),
            [0,0,0,16,0,0,1,97,0,0,1,98,0,1,1,98,0,3,1,97,0,2,1,97,0,5,1,98,0,4,1,98,0,7,1,97,0,6,1,97,0,9,1,98,0,8,1,98,0,11,1,97,0,10,1,97,0,13,1,98,0,12,1,98,0,4,0,0],
            "Alternating pattern, odd length",
            "https://en.wikipedia.org/wiki/LZ78"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new LZ78Instance(this, isInverse);
      }
    }

    class LZ78Instance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
        this.hasBeenFed = false;
      }

      Feed(data) {
        this.hasBeenFed = true;
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (!this.hasBeenFed) {
          throw new Error('No data fed to algorithm');
        }

        // Process using existing compression logic
        const result = this.isInverse ?
          this.decompress(this.inputBuffer) :
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        this.hasBeenFed = false;
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) {
          // Return header with 0 tokens for empty input
          return [0, 0, 0, 0];
        }

        // Reset dictionary for new compression
        const dictionary = new Map();
        dictionary.set('', 0); // Empty string maps to index 0
        let nextIndex = 1;

        const tokens = [];
        let position = 0;

        while (position < data.length) {
          // Find the longest sequence in dictionary that matches at current position
          let currentSequence = [];
          let matchIndex = 0;

          // Look for longest match in dictionary
          let testPos = position;
          while (testPos < data.length) {
            currentSequence.push(data[testPos]);
            const testKey = currentSequence.join(',');

            if (dictionary.has(testKey)) {
              // Sequence found in dictionary, continue building
              matchIndex = dictionary.get(testKey);
              testPos++;
            } else {
              // Sequence not in dictionary, back up one step
              currentSequence.pop();
              break;
            }
          }

          // Now currentSequence contains the longest match
          // Move position past the match
          position += currentSequence.length;

          if (position < data.length) {
            // There's a next byte after the match
            const nextByte = data[position];

            tokens.push({
              index: matchIndex,
              byte: nextByte
            });

            // Add the matched sequence + next byte to dictionary
            const newSequence = [...currentSequence, nextByte];
            const newKey = newSequence.join(',');
            if (nextIndex < this.algorithm.MAX_DICTIONARY_SIZE) {
              dictionary.set(newKey, nextIndex);
              nextIndex++;
            }

            position++;
          } else {
            // End of input - emit the match with no additional character
            if (currentSequence.length > 0) {
              // We have a final match but no character to add
              // This shouldn't happen in proper LZ78, but handle it
              tokens.push({
                index: matchIndex,
                byte: null
              });
            } else {
              // No match, emit single character
              const singleByte = data[position - 1]; // This won't execute due to while condition
            }
          }
        }

        // Serialize tokens to compressed format
        return this._serializeTokens(tokens);
      }

      decompress(data) {
        if (!data || data.length === 0) return [];
        if (data.length === 4 && data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 0) {
          // Empty compressed data (0 tokens)
          return [];
        }

        // Deserialize tokens
        const tokens = this._deserializeTokens(data);

        // Rebuild dictionary and output during decompression
        const dictionary = new Map();
        dictionary.set(0, []); // Index 0 is empty sequence
        let nextIndex = 1;
        const output = [];

        for (const token of tokens) {
          // Get sequence from dictionary
          if (!dictionary.has(token.index)) {
            throw new Error('Invalid dictionary index in compressed data');
          }

          const dictSequence = dictionary.get(token.index);

          // Append byte if present
          if (token.byte !== null) {
            const newSequence = [...dictSequence, token.byte];
            for (let _i = 0; _i < newSequence.length; _i++) output.push(newSequence[_i]);

            // Add to dictionary if not full
            if (nextIndex < this.algorithm.MAX_DICTIONARY_SIZE) {
              dictionary.set(nextIndex, newSequence);
              nextIndex++;
            }
          } else {
            // No byte indicates final sequence
            for (let _i = 0; _i < dictSequence.length; _i++) output.push(dictSequence[_i]);
          }
        }

        return output;
      }

      /**
       * Serialize tokens to compressed format
       * Format: [TokenCount(4 bytes)][Token1][Token2]...[TokenN]
       * Token format: [Index(2 bytes)][HasByteFlag(1 byte)][Byte(1 byte, meaningful only if flag=1)]
       *
       * A dedicated flag byte (rather than reusing byte value 255 as a "no byte"
       * sentinel) is required because 255 is itself a legal input byte value -
       * the previous encoding could not tell the literal byte 0xFF apart from
       * "no trailing byte", silently dropping any token whose byte was 0xFF.
       * @private
       */
      _serializeTokens(tokens) {
        const bytes = [];

        // Write token count (4 bytes, big-endian) using OpCodes
        const count = tokens.length;
        const countBytes = OpCodes.Words32ToBytesBE([count]);
        for (let _i = 0; _i < countBytes.length; _i++) bytes.push(countBytes[_i]);

        // Write tokens
        for (const token of tokens) {
          // Index (2 bytes, big-endian) using OpCodes
          const indexBytes = OpCodes.Words32ToBytesBE([token.index]);
          bytes.push(indexBytes[2], indexBytes[3]); // Take low 2 bytes

          // HasByteFlag + Byte value
          if (token.byte !== null) {
            bytes.push(1, OpCodes.AndN(token.byte, 0xFF));
          } else {
            bytes.push(0, 0);
          }
        }

        return bytes;
      }

      /**
       * Deserialize tokens from compressed format
       * @private
       */
      _deserializeTokens(compressedData) {
        const bytes = compressedData;

        if (bytes.length < 4) {
          throw new Error('Invalid compressed data: too short');
        }

        // Read token count using OpCodes
        const countArray = OpCodes.BytesToWords32BE(bytes.slice(0, 4));
        const count = countArray[0];
        const tokens = [];

        if (bytes.length !== 4 + count * 4) {
          throw new Error('Invalid compressed data: length mismatch');
        }

        let pos = 4;
        for (let i = 0; i < count; i++) {
          // Read index (2 bytes) using OpCodes
          const indexBytes = [0, 0, bytes[pos], bytes[pos + 1]];
          const indexArray = OpCodes.BytesToWords32BE(indexBytes);
          const index = indexArray[0];

          // Read HasByteFlag + byte value
          const hasByte = bytes[pos + 2] !== 0;
          const byte = hasByte ? bytes[pos + 3] : null;

          tokens.push({
            index: index,
            byte: byte
          });

          pos += 4;
        }

        return tokens;
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(OpCodes.AndN(str.charCodeAt(i), 0xFF));
        }
        return bytes;
      }

      _bytesToString(bytes) {
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