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
        // Wire format (byte-identical to CompressionWorkbench's BB_BPE), all little-endian:
        //   2 bytes dictionary size
        //   6 bytes per dictionary entry: code, val1, val2 (each uint16)
        //   4 bytes encoded-value count
        //   2 bytes per encoded value (codes >= 256 reference dictionary entries)
        this.tests = [
          {
            text: "Empty data test",
            uri: "https://csrc.nist.gov/",
            input: [],
            expected: [0,0,0,0,0,0]
          },
          {
            text: "Single byte test",
            uri: "https://csrc.nist.gov/",
            input: [65], // "A"
            expected: [0,0,1,0,0,0,65,0]
          },
          {
            text: "Pattern with potential compression",
            uri: "https://csrc.nist.gov/",
            input: [65, 66, 65, 66], // "ABAB"
            expected: [0,0,4,0,0,0,65,0,66,0,65,0,66,0]
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
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) return [];
          return this._decompress();
        }

        // Even empty input produces a fixed 6-byte header (matches the
        // C# reference, which always writes dictSize + dataLen).
        return this._compress();
      }

      // Mirrors CompressionWorkbench's BpeBuildingBlock.Compress exactly,
      // including its "net savings" acceptance test and early-stop heuristic.
      _compress() {
        const FIRST_CODE = 256;
        const dataArr = [...this.inputBuffer];
        let dataLen = dataArr.length;

        const dictionary = []; // [{code, val1, val2}, ...] in assignment order
        let nextCode = FIRST_CODE;

        for (let iter = 0; iter < this.maxIterations && dataLen >= 2; ++iter) {
          // Count consecutive pairs, preserving first-occurrence order
          // (matches .NET Dictionary's insertion-order iteration).
          const pairCounts = new Map();
          for (let i = 0; i < dataLen - 1; ++i) {
            const key = dataArr[i] + ',' + dataArr[i + 1];
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          }

          let bestKey = null;
          let bestCount = 0;
          for (const [key, count] of pairCounts) {
            if (count > bestCount) {
              bestCount = count;
              bestKey = key;
            }
          }

          // Stop if the best pair doesn't save enough to justify the
          // 6-byte dictionary entry cost (each replacement saves 2 bytes).
          const netSavings = bestCount * 2 - 6;
          if (netSavings <= 0) break;

          const commaIndex = bestKey.indexOf(',');
          const b1 = parseInt(bestKey.substring(0, commaIndex), 10);
          const b2 = parseInt(bestKey.substring(commaIndex + 1), 10);

          // Replace all occurrences in-place
          const prevLen = dataLen;
          let writePos = 0;
          for (let i = 0; i < dataLen; ++i) {
            if (i < dataLen - 1 && dataArr[i] === b1 && dataArr[i + 1] === b2) {
              dataArr[writePos++] = nextCode;
              ++i; // skip next
            } else {
              dataArr[writePos++] = dataArr[i];
            }
          }
          dataLen = writePos;

          dictionary.push({ code: nextCode, val1: b1, val2: b2 });
          ++nextCode;

          // Stop if this iteration shrank the data by less than 0.5%
          if ((prevLen - dataLen) * 200 < prevLen) break;
        }

        const compressed = this._packCompressedData(dictionary, dataArr.slice(0, dataLen));

        this.inputBuffer = [];
        return compressed;
      }

      // Mirrors CompressionWorkbench's BpeBuildingBlock.Decompress: dictionary
      // rules are expanded in reverse assignment order (last rule first).
      _decompress() {
        const { dictionary, data } = this._unpackCompressedData(this.inputBuffer);

        let workingData = data;
        for (let i = dictionary.length - 1; i >= 0; --i) {
          const { code, val1, val2 } = dictionary[i];
          const newData = [];
          for (const value of workingData) {
            if (value === code)
              newData.push(val1, val2);
            else
              newData.push(value);
          }
          workingData = newData;
        }

        this.inputBuffer = [];
        return workingData;
      }

      /**
       * Pack compressed data with dictionary (all fields little-endian)
       * @private
       */
      _packCompressedData(dictionary, data) {
        const bytes = [];

        { const _src = OpCodes.Unpack16LE(dictionary.length); for (let _i = 0; _i < _src.length; _i++) bytes.push(_src[_i]); }

        for (const entry of dictionary) {
          { const _src = OpCodes.Unpack16LE(entry.code); for (let _i = 0; _i < _src.length; _i++) bytes.push(_src[_i]); }
          { const _src = OpCodes.Unpack16LE(entry.val1); for (let _i = 0; _i < _src.length; _i++) bytes.push(_src[_i]); }
          { const _src = OpCodes.Unpack16LE(entry.val2); for (let _i = 0; _i < _src.length; _i++) bytes.push(_src[_i]); }
        }

        { const _src = OpCodes.Unpack32LE(data.length); for (let _i = 0; _i < _src.length; _i++) bytes.push(_src[_i]); }

        for (const value of data)
          { const _src = OpCodes.Unpack16LE(value); for (let _i = 0; _i < _src.length; _i++) bytes.push(_src[_i]); }

        return bytes;
      }

      /**
       * Unpack compressed data (all fields little-endian)
       * @private
       */
      _unpackCompressedData(bytes) {
        if (bytes.length < 6) {
          throw new Error('Invalid BPE compressed data: too short');
        }

        let pos = 0;

        const dictSize = OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]);
        pos += 2;

        const dictionary = [];
        for (let i = 0; i < dictSize; i++) {
          if (pos + 6 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete dictionary');
          }

          const code = OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]);
          const val1 = OpCodes.Pack16LE(bytes[pos + 2], bytes[pos + 3]);
          const val2 = OpCodes.Pack16LE(bytes[pos + 4], bytes[pos + 5]);

          dictionary.push({ code, val1, val2 });
          pos += 6;
        }

        if (pos + 4 > bytes.length) {
          throw new Error('Invalid BPE compressed data: missing data length');
        }

        const dataLength = OpCodes.Pack32LE(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
        pos += 4;

        const data = [];
        for (let i = 0; i < dataLength; i++) {
          if (pos + 2 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete data');
          }

          data.push(OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]));
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