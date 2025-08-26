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

        // Convert comprehensive test vectors to new format
        this.tests = [
          new TestCase(
            [65, 66, 67, 65, 66, 67, 65, 66, 67], // ABCABCABC
            [0, 0, 0, 6, 0, 0, 65, 0, 0, 66, 0, 0, 67, 0, 1, 66, 0, 3, 65, 0, 2, 67],
            "Basic string with repeated substrings",
            "https://en.wikipedia.org/wiki/LZ78"
          ),
          new TestCase(
            [65, 66, 65, 66, 67, 65, 66, 67, 68, 65, 66, 67, 68, 69], // ABABCABCDABCDE
            [0, 0, 0, 8, 0, 0, 65, 0, 0, 66, 0, 1, 66, 0, 0, 67, 0, 3, 67, 0, 0, 68, 0, 5, 68, 0, 0, 69],
            "Progressive pattern building",
            "https://web.stanford.edu/class/cs106b/assignments/huffman/"
          ),
          new TestCase(
            [65, 66, 65, 66, 65, 66, 65, 66, 65, 66, 67, 68, 67, 68, 67, 68, 67, 68], // ABABABABABCDCDCDCD
            [0, 0, 0, 10, 0, 0, 65, 0, 0, 66, 0, 1, 66, 0, 3, 65, 0, 2, 65, 0, 2, 67, 0, 0, 68, 0, 0, 67, 0, 7, 67, 0, 9, 68],
            "Text with overlapping patterns",
            "https://www.cs.duke.edu/csed/curious/compression/lz78.html"
          ),
          new TestCase(
            [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90], // A-Z alphabet
            [0, 0, 0, 26, 0, 0, 65, 0, 0, 66, 0, 0, 67, 0, 0, 68, 0, 0, 69, 0, 0, 70, 0, 0, 71, 0, 0, 72, 0, 0, 73, 0, 0, 74, 0, 0, 75, 0, 0, 76, 0, 0, 77, 0, 0, 78, 0, 0, 79, 0, 0, 80, 0, 0, 81, 0, 0, 82, 0, 0, 83, 0, 0, 84, 0, 0, 85, 0, 0, 86, 0, 0, 87, 0, 0, 88, 0, 0, 89, 0, 0, 90],
            "Unique character sequence (worst case)",
            "https://www.geeksforgeeks.org/lz78-lempel-ziv-78-compression-technique/"
          ),
          new TestCase(
            [0x00, 0x01, 0x02, 0x00, 0x01, 0x02, 0x03, 0x00, 0x01, 0x02, 0x03, 0x04],
            [0, 0, 0, 8, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1, 1, 0, 3, 3, 0, 4, 2, 0, 0, 3, 0, 0, 4],
            "Binary data with structured patterns",
            "https://www.cs.cmu.edu/~guyb/realworld/compression.pdf"
          ),
          new TestCase(
            // 100 A's + 100 B's = 200 bytes total
            [65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66],
            [0, 0, 0, 28, 0, 0, 65, 0, 1, 65, 0, 2, 65, 0, 3, 65, 0, 4, 65, 0, 5, 65, 0, 6, 65, 0, 7, 65, 0, 8, 65, 0, 9, 65, 0, 10, 65, 0, 11, 65, 0, 12, 65, 0, 9, 66, 0, 0, 66, 0, 15, 66, 0, 16, 66, 0, 17, 66, 0, 18, 66, 0, 19, 66, 0, 20, 66, 0, 21, 66, 0, 22, 66, 0, 23, 66, 0, 24, 66, 0, 25, 66, 0, 26, 66, 0, 22, 0],
            "Long repetitive sequence",
            "https://web.archive.org/web/20080828084534/http://www.dogma.net/markn/articles/lzw/lzw.htm"
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
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        // Process using existing compression logic
        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) return [];

        const inputString = this._bytesToString(data);

        // Reset dictionary for new compression
        const dictionary = { '': 0 }; // Empty string maps to index 0
        const reverseDictionary = { 0: '' };
        let nextIndex = 1;

        const tokens = [];
        let position = 0;

        while (position < inputString.length) {
          // Find the longest string in dictionary that matches at current position
          let currentString = '';
          let matchIndex = 0;

          // Look for longest match
          while (position < inputString.length) {
            const nextChar = inputString.charAt(position);
            const testString = currentString + nextChar;

            if (dictionary.hasOwnProperty(testString)) {
              // String found in dictionary, continue building
              currentString = testString;
              matchIndex = dictionary[testString];
              position++;
            } else {
              // String not in dictionary
              break;
            }
          }

          // Emit token
          if (position < inputString.length) {
            // There's a next character
            const nextChar = inputString.charAt(position);

            tokens.push({
              index: matchIndex,
              character: nextChar
            });

            // Add new string to dictionary if not full
            const newString = currentString + nextChar;
            if (nextIndex < this.algorithm.MAX_DICTIONARY_SIZE) {
              dictionary[newString] = nextIndex;
              reverseDictionary[nextIndex] = newString;
              nextIndex++;
            }

            position++;
          } else {
            // End of input, emit final token
            tokens.push({
              index: matchIndex,
              character: '' // Empty character indicates end
            });
          }
        }

        // Serialize tokens to compressed format
        const compressed = this._serializeTokens(tokens);

        return this._stringToBytes(compressed);
      }

      decompress(data) {
        if (!data || data.length === 0) return [];

        const compressedString = this._bytesToString(data);

        // Deserialize tokens
        const tokens = this._deserializeTokens(compressedString);

        // Rebuild dictionary and output during decompression
        const dictionary = { 0: '' }; // Index 0 is empty string
        let nextIndex = 1;
        let output = '';

        for (const token of tokens) {
          // Get string from dictionary
          if (!dictionary.hasOwnProperty(token.index)) {
            throw new Error('Invalid dictionary index in compressed data');
          }

          const dictString = dictionary[token.index];

          // Append character if present
          if (token.character) {
            const newString = dictString + token.character;
            output += newString;

            // Add to dictionary if not full
            if (nextIndex < this.algorithm.MAX_DICTIONARY_SIZE) {
              dictionary[nextIndex] = newString;
              nextIndex++;
            }
          } else {
            // Empty character indicates final string
            output += dictString;
          }
        }

        return this._stringToBytes(output);
      }

      /**
       * Serialize tokens to compressed format
       * Format: [TokenCount(4 bytes)][Token1][Token2]...[TokenN]
       * Token format: [Index(2 bytes)][CharCode(1 byte, 0 if empty)]
       * @private
       */
      _serializeTokens(tokens) {
        const bytes = [];

        // Write token count (4 bytes, big-endian)
        const count = tokens.length;
        if (global.OpCodes) {
          const packed = global.OpCodes.Pack32BE(count);
          bytes.push(packed[0], packed[1], packed[2], packed[3]);
        } else {
          bytes.push((count >>> 24) & 0xFF);
          bytes.push((count >>> 16) & 0xFF);
          bytes.push((count >>> 8) & 0xFF);
          bytes.push(count & 0xFF);
        }

        // Write tokens
        for (const token of tokens) {
          // Index (2 bytes, big-endian)
          if (global.OpCodes) {
            const packed = global.OpCodes.Pack16BE(token.index);
            bytes.push(packed[0], packed[1]);
          } else {
            bytes.push((token.index >>> 8) & 0xFF);
            bytes.push(token.index & 0xFF);
          }

          // Character (1 byte, 0 if empty)
          if (token.character) {
            bytes.push(global.OpCodes ? global.OpCodes.Byte(token.character.charCodeAt(0)) : (token.character.charCodeAt(0) & 0xFF));
          } else {
            bytes.push(0);
          }
        }

        return this._bytesToString(bytes);
      }

      /**
       * Deserialize tokens from compressed format
       * @private
       */
      _deserializeTokens(compressedData) {
        const bytes = this._stringToBytes(compressedData);

        if (bytes.length < 4) {
          throw new Error('Invalid compressed data: too short');
        }

        // Read token count
        const count = global.OpCodes ? 
          global.OpCodes.Unpack32BE([bytes[0], bytes[1], bytes[2], bytes[3]]) : 
          ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]);
        const tokens = [];

        if (bytes.length !== 4 + count * 3) {
          throw new Error('Invalid compressed data: length mismatch');
        }

        let pos = 4;
        for (let i = 0; i < count; i++) {
          // Read index (2 bytes)
          const index = global.OpCodes ? 
            global.OpCodes.Unpack16BE([bytes[pos], bytes[pos + 1]]) : 
            ((bytes[pos] << 8) | bytes[pos + 1]);

          // Read character (1 byte)
          const charCode = bytes[pos + 2];
          const character = charCode !== 0 ? String.fromCharCode(charCode) : '';

          tokens.push({
            index: index,
            character: character
          });

          pos += 3;
        }

        return tokens;
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(global.OpCodes ? global.OpCodes.Byte(str.charCodeAt(i)) : (str.charCodeAt(i) & 0xFF));
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