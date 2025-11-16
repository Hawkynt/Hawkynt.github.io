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

        // Simplified test vectors for correct LZ78
        this.tests = [
          new TestCase(
            [], // Empty input
            [0, 0, 0, 0], // No tokens
            "Empty input",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65], // "A"
            [0, 0, 0, 1, 0, 0, 65], // 1 token: (0,'A')
            "Single character",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 66], // "AB"
            [0, 0, 0, 2, 0, 0, 65, 0, 0, 66], // 2 tokens: (0,'A'), (0,'B')
            "Two unique characters",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 65], // "AA"
            [0, 0, 0, 2, 0, 0, 65, 0, 1, 255], // 2 tokens: (0,'A'), (1,null)
            "Repeated character",
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
        this.inputBuffer.push(...data);
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
            output.push(...newSequence);

            // Add to dictionary if not full
            if (nextIndex < this.algorithm.MAX_DICTIONARY_SIZE) {
              dictionary.set(nextIndex, newSequence);
              nextIndex++;
            }
          } else {
            // No byte indicates final sequence
            output.push(...dictSequence);
          }
        }

        return output;
      }

      /**
       * Serialize tokens to compressed format
       * Format: [TokenCount(4 bytes)][Token1][Token2]...[TokenN]
       * Token format: [Index(2 bytes)][Byte(1 byte, 255 if null)]
       * @private
       */
      _serializeTokens(tokens) {
        const bytes = [];

        // Write token count (4 bytes, big-endian) using OpCodes
        const count = tokens.length;
        const countBytes = OpCodes.Words32ToBytesBE([count]);
        bytes.push(...countBytes);

        // Write tokens
        for (const token of tokens) {
          // Index (2 bytes, big-endian) using OpCodes
          const indexBytes = OpCodes.Words32ToBytesBE([token.index]);
          bytes.push(indexBytes[2], indexBytes[3]); // Take low 2 bytes

          // Byte (1 byte, 255 if null)
          if (token.byte !== null) {
            bytes.push(token.byte & 0xFF);
          } else {
            bytes.push(255);
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

        if (bytes.length !== 4 + count * 3) {
          throw new Error('Invalid compressed data: length mismatch');
        }

        let pos = 4;
        for (let i = 0; i < count; i++) {
          // Read index (2 bytes) using OpCodes
          const indexBytes = [0, 0, bytes[pos], bytes[pos + 1]];
          const indexArray = OpCodes.BytesToWords32BE(indexBytes);
          const index = indexArray[0];

          // Read byte (1 byte)
          const byteValue = bytes[pos + 2];
          const byte = byteValue !== 255 ? byteValue : null;

          tokens.push({
            index: index,
            byte: byte
          });

          pos += 3;
        }

        return tokens;
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xFF);
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