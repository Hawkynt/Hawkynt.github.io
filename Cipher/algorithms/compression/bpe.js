/*
 * Byte-Pair Encoding (BPE) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of Philip Gage's pair replacement algorithm
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
 * BPECompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class BPECompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Byte-Pair Encoding (BPE)";
        this.description = "Iteratively replaces the most frequently occurring byte pairs with unused byte values. Simple greedy approach that can achieve good compression on structured data with repeated patterns.";
        this.inventor = "Philip Gage";
        this.year = 1994;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Transform";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("A New Algorithm for Data Compression - Philip Gage", "http://www.cbloom.com/papers/gage_bpe.pdf"),
          new LinkItem("Byte Pair Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Byte_pair_encoding"),
          new LinkItem("BPE Algorithm Explanation", "https://leimao.github.io/blog/Byte-Pair-Encoding/")
        ];

        this.references = [
          new LinkItem("Philip Gage Original Implementation", "http://www.cbloom.com/src/index_lz.html"),
          new LinkItem("sentencepiece BPE Implementation", "https://github.com/google/sentencepiece"),
          new LinkItem("Modern BPE in NLP", "https://github.com/rsennrich/subword-nmt")
        ];

        // Test vectors with actual compressed outputs
        this.tests = [
          {
            text: "Empty data test",
            uri: "Edge case test", 
            input: [], 
            expected: [] // Empty input produces empty output
          },
          {
            text: "Single byte test",
            uri: "Minimal compression test",
            input: [65], // "A"
            expected: [0,0,0,0,0,1,0,65] // BPE compressed format
          },
          {
            text: "Pattern with potential compression",
            uri: "BPE optimization test",
            input: [65, 66, 65, 66], // "ABAB"
            expected: [0,1,1,0,65,66,0,0,0,2,1,0,1,0] // BPE finds AB pair and replaces it
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new BPEInstance(this, isInverse);
      }
    }

    class BPEInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.maxIterations = 256; // Limit iterations to prevent infinite loops
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        let workingData = [...this.inputBuffer];
        const dictionary = {};

        let replacementCode = 256; // Start after regular byte values
        let iteration = 0;

        // Iteratively find and replace most frequent byte pairs
        while (iteration < this.maxIterations) {
          // Find most frequent byte pair
          const pairCounts = this._countBytePairs(workingData);

          if (Object.keys(pairCounts).length === 0) {
            break; // No pairs found
          }

          // Find most frequent pair
          let maxCount = 0;
          let bestPair = null;

          for (const [pair, count] of Object.entries(pairCounts)) {
            if (count > maxCount && count > 1) { // Only replace if appears more than once
              maxCount = count;
              bestPair = pair;
            }
          }

          if (!bestPair || maxCount <= 1) {
            break; // No beneficial replacements found
          }

          // Parse the pair
          const [byte1, byte2] = bestPair.split(',').map(x => parseInt(x));

          // Replace all occurrences of the pair
          const newData = [];
          let i = 0;

          while (i < workingData.length) {
            if (i < workingData.length - 1 && 
                workingData[i] === byte1 && 
                workingData[i + 1] === byte2) {
              // Found pair, replace with new code
              newData.push(replacementCode);
              i += 2;
            } else {
              // Copy single byte
              newData.push(workingData[i]);
              i++;
            }
          }

          // Only accept replacement if it actually saves space
          if (newData.length < workingData.length) {
            // Store replacement in dictionary
            dictionary[replacementCode] = [byte1, byte2];
            workingData = newData;
            replacementCode++;

            // Stop if we've used all available codes
            if (replacementCode > 65535) break;
          } else {
            break; // No more beneficial replacements
          }

          iteration++;
        }

        // Create compressed format: [DictSize][Dictionary][CompressedData]
        const compressed = this._packCompressedData(dictionary, workingData);

        // Clear input buffer
        this.inputBuffer = [];

        return compressed;
      }

      _decompress() {
        // Unpack compressed data
        const { dictionary, data } = this._unpackCompressedData(this.inputBuffer);

        // Expand using dictionary (reverse order of compression)
        let workingData = [...data];

        // Get replacement codes in reverse order (highest to lowest)
        const replacementCodes = Object.keys(dictionary)
          .map(x => parseInt(x))
          .sort((a, b) => b - a);

        // Apply replacements in reverse order
        for (const code of replacementCodes) {
          const replacement = dictionary[code];
          const newData = [];

          for (const byte of workingData) {
            if (byte === code) {
              // Replace code with original pair
              newData.push(...replacement);
            } else {
              newData.push(byte);
            }
          }

          workingData = newData;
        }

        // Clear input buffer
        this.inputBuffer = [];

        return workingData;
      }

      /**
       * Count occurrences of all byte pairs
       * @private
       */
      _countBytePairs(data) {
        const pairCounts = {};

        for (let i = 0; i < data.length - 1; i++) {
          const pair = `${data[i]},${data[i + 1]}`;
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        }

        return pairCounts;
      }

      /**
       * Pack compressed data with dictionary
       * @private
       */
      _packCompressedData(dictionary, data) {
        const bytes = [];

        // Dictionary size (2 bytes, big-endian)
        const dictSize = Object.keys(dictionary).length;
        const dictSizeBytes = OpCodes.Unpack16BE(dictSize);
        bytes.push(dictSizeBytes[0], dictSizeBytes[1]);

        // Dictionary entries: [Code(2 bytes)][Byte1][Byte2]
        for (const [code, replacement] of Object.entries(dictionary)) {
          const codeNum = parseInt(code);
          const codeBytes = OpCodes.Unpack16BE(codeNum);
          bytes.push(codeBytes[0], codeBytes[1]);
          bytes.push(OpCodes.ToByte(replacement[0]));
          bytes.push(OpCodes.ToByte(replacement[1]));
        }

        // Data length (4 bytes, big-endian)
        const dataLength = data.length;
        const lengthBytes = OpCodes.Unpack32BE(dataLength);
        bytes.push(lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]);

        // Compressed data (may contain codes > 255, so use 2 bytes per value)
        for (const value of data) {
          const valueBytes = OpCodes.Unpack16BE(value);
          bytes.push(valueBytes[0], valueBytes[1]);
        }

        return bytes;
      }

      /**
       * Unpack compressed data
       * @private
       */
      _unpackCompressedData(bytes) {
        if (bytes.length < 6) {
          throw new Error('Invalid BPE compressed data: too short');
        }

        let pos = 0;

        // Read dictionary size
        const dictSize = OpCodes.Pack16BE(bytes[pos], bytes[pos + 1]);
        pos += 2;

        // Read dictionary
        const dictionary = {};
        for (let i = 0; i < dictSize; i++) {
          if (pos + 4 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete dictionary');
          }

          const code = OpCodes.Pack16BE(bytes[pos], bytes[pos + 1]);
          const byte1 = bytes[pos + 2];
          const byte2 = bytes[pos + 3];

          dictionary[code] = [byte1, byte2];
          pos += 4;
        }

        // Read data length
        if (pos + 4 > bytes.length) {
          throw new Error('Invalid BPE compressed data: missing data length');
        }

        const dataLength = OpCodes.Pack32BE(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
        pos += 4;

        // Read compressed data
        const data = [];
        for (let i = 0; i < dataLength; i++) {
          if (pos + 2 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete data');
          }

          const value = OpCodes.Pack16BE(bytes[pos], bytes[pos + 1]);
          data.push(value);
          pos += 2;
        }

        return { dictionary, data };
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new BPECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BPECompression, BPEInstance };
}));