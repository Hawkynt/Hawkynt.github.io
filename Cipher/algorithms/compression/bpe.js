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

        // Test vectors with actual compressed outputs.
        // Dictionary entries are [Code(2 bytes)][Elem1(2 bytes)][Elem2(2 bytes)]
        // since a replacement pair element may itself be an earlier
        // replacement code (> 255) once pairs nest inside pairs - see the
        // "repeat16" regression vector below, which used to truncate those
        // 16-bit elements to a single byte and corrupt the dictionary.
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
            expected: [0,1,1,0,0,65,0,66,0,0,0,2,1,0,1,0] // BPE finds AB pair and replaces it
          },
          {
            text: "Nested pair regression - 16 repeated bytes",
            uri: "Regression test for dictionary element truncation bug",
            input: Array(16).fill(0x61),
            // Three levels of pair nesting: (a,a)->256, (256,256)->257, (257,257)->258
            expected: [0,3,1,0,0,97,0,97,1,1,1,0,1,0,1,2,1,1,1,1,0,0,0,2,1,2,1,2]
          },
          {
            text: "All 256 byte values (no beneficial pairs)",
            uri: "Regression test - full byte-value corpus",
            input: Array.from({length: 256}, (_, i) => i),
            expected: [0,0,0,0,1,0].concat(Array.from({length: 256}, (_, i) => [0, i]).flat())
          },
          {
            text: "Alternating pattern, odd length (73 bytes)",
            uri: "Regression test - odd length input",
            input: Array.from({length: 73}, (_, i) => (i % 2 ? 0x62 : 0x61)),
            expected: [0,5,1,0,0,97,0,98,1,1,1,0,1,0,1,2,1,1,1,1,1,3,1,2,1,2,1,4,1,3,1,3,0,0,0,4,1,4,1,4,1,2,0,97]
          },
          {
            text: "Pseudo-random data, odd length (77 bytes)",
            uri: "Regression test - non-repeating pseudo-random input",
            input: [128,0,0,0,64,0,64,0,0,0,0,64,0,0,0,64,0,0,0,0,0,0,64,0,0,56,0,64,0,0,0,64,0,0,0,0,0,0,64,0,0,0,0,64,0,0,0,64,0,0,0,0,0,64,0,0,0,0,0,0,0,0,56,0,0,0,64,128,0,64,128,128,0,0,0,64,0],
            expected: [0,9,1,0,0,0,0,0,1,1,0,0,0,64,1,2,1,0,1,0,1,3,1,0,1,1,1,4,1,3,1,2,1,5,0,128,1,3,1,6,1,1,1,2,1,7,0,64,1,4,1,8,1,0,0,64,0,0,0,20,1,5,1,6,1,7,1,8,1,0,0,56,1,1,1,4,1,8,1,2,1,7,1,6,1,2,0,56,1,3,0,128,1,1,0,128,1,5,0,0]
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
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
              for (let _i = 0; _i < replacement.length; _i++) newData.push(replacement[_i]);
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

        // Dictionary entries: [Code(2 bytes)][Elem1(2 bytes)][Elem2(2 bytes)]
        // Replacement pair elements can themselves be earlier replacement
        // codes (>255) once BPE nests pairs-of-pairs, so each element needs
        // the full 16 bits, not a single truncated byte.
        for (const [code, replacement] of Object.entries(dictionary)) {
          const codeNum = parseInt(code);
          const codeBytes = OpCodes.Unpack16BE(codeNum);
          bytes.push(codeBytes[0], codeBytes[1]);
          const elem1Bytes = OpCodes.Unpack16BE(replacement[0]);
          bytes.push(elem1Bytes[0], elem1Bytes[1]);
          const elem2Bytes = OpCodes.Unpack16BE(replacement[1]);
          bytes.push(elem2Bytes[0], elem2Bytes[1]);
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
          if (pos + 6 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete dictionary');
          }

          const code = OpCodes.Pack16BE(bytes[pos], bytes[pos + 1]);
          const elem1 = OpCodes.Pack16BE(bytes[pos + 2], bytes[pos + 3]);
          const elem2 = OpCodes.Pack16BE(bytes[pos + 4], bytes[pos + 5]);

          dictionary[code] = [elem1, elem2];
          pos += 6;
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