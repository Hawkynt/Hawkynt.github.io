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

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {BPEInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new BPEInstance(this, isInverse);
      }
    }

    /**
     * One dictionary rule: code stands for the pair (val1, val2)
     */
    class BPEEntry {
      /**
       * @param {int32} code - Replacement code
       * @param {int32} val1 - First value of the pair
       * @param {int32} val2 - Second value of the pair
       */
      constructor(code, val1, val2) {
        /** @type {int32} */
        this.code = code;
        /** @type {int32} */
        this.val1 = val1;
        /** @type {int32} */
        this.val2 = val2;
      }
    }

    /**
     * Unpacked compressed stream: the rules and the encoded values
     */
    class BPEStream {
      /**
       * @param {BPEEntry[]} dictionary - Rules in assignment order
       * @param {int32[]} data - Encoded values
       */
      constructor(dictionary, data) {
        /** @type {BPEEntry[]} */
        this.dictionary = dictionary;
        /** @type {int32[]} */
        this.data = data;
      }
    }

    // Codes stay below 256 + 256 (at most 256 rules), so a pair (a, b) of
    // values is counted at index a * PAIR_STRIDE + b
    /** @type {int32} */
    const PAIR_STRIDE = 512;

    class BPEInstance extends IAlgorithmInstance {
      /**
       * @param {BPECompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];
        /** @type {int32} */
        this.maxIterations = 256; // Limit iterations to prevent infinite loops
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          return this._decompress();
        }

        // Even empty input produces a fixed 6-byte header (matches the
        // C# reference, which always writes dictSize + dataLen).
        return this._compress();
      }

      // Mirrors CompressionWorkbench's BpeBuildingBlock.Compress exactly,
      // including its "net savings" acceptance test and early-stop heuristic.
      /**
       * @returns {uint8[]} Dictionary and encoded values
       */
      _compress() {
        /** @type {int32} */
        const FIRST_CODE = 256;
        /** @type {int32[]} */
        const dataArr = [];
        for (let i = 0; i < this.inputBuffer.length; i++) {
          dataArr.push(this.inputBuffer[i]);
        }
        /** @type {int32} */
        let dataLen = dataArr.length;

        /** @type {BPEEntry[]} */
        const dictionary = []; // in assignment order
        /** @type {int32} */
        let nextCode = FIRST_CODE;
        /** @type {int32[]} */
        const pairCounts = new Int32Array(PAIR_STRIDE * PAIR_STRIDE);

        for (let iter = 0; iter < this.maxIterations && dataLen >= 2; ++iter) {
          // Count consecutive pairs.
          pairCounts.fill(0);
          for (let i = 0; i < dataLen - 1; ++i) {
            /** @type {int32} */
            const key = dataArr[i] * PAIR_STRIDE + dataArr[i + 1];
            pairCounts[key] = pairCounts[key] + 1;
          }

          // Pick the most frequent pair, ties going to the one that occurs
          // earliest. Scanning the data rather than the count table is what
          // makes that rule explicit: the winner is decided by positions in
          // the input, not by the order in which a hash table hands its
          // entries back.
          /** @type {int32} */
          let bestKey = -1;
          /** @type {int32} */
          let bestCount = 0;
          for (let i = 0; i < dataLen - 1; ++i) {
            /** @type {int32} */
            const key = dataArr[i] * PAIR_STRIDE + dataArr[i + 1];
            /** @type {int32} */
            const count = pairCounts[key];
            if (count > bestCount) {
              bestCount = count;
              bestKey = key;
            }
          }

          // Stop if the best pair doesn't save enough to justify the
          // 6-byte dictionary entry cost (each replacement saves 2 bytes).
          /** @type {int32} */
          const netSavings = bestCount * 2 - 6;
          if (netSavings <= 0) {
            break;
          }

          /** @type {int32} */
          const b1 = Math.floor(bestKey / PAIR_STRIDE);
          /** @type {int32} */
          const b2 = bestKey % PAIR_STRIDE;

          // Replace all occurrences in-place
          /** @type {int32} */
          const prevLen = dataLen;
          /** @type {int32} */
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

          dictionary.push(new BPEEntry(nextCode, b1, b2));
          ++nextCode;

          // Stop if this iteration shrank the data by less than 0.5%
          if ((prevLen - dataLen) * 200 < prevLen) {
            break;
          }
        }

        /** @type {uint8[]} */
        const compressed = this._packCompressedData(dictionary, dataArr.slice(0, dataLen));

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return compressed;
      }

      // Mirrors CompressionWorkbench's BpeBuildingBlock.Decompress: dictionary
      // rules are expanded in reverse assignment order (last rule first).
      /**
       * @returns {uint8[]} Decoded bytes
       */
      _decompress() {
        /** @type {BPEStream} */
        const stream = this._unpackCompressedData(this.inputBuffer);

        /** @type {int32[]} */
        let workingData = stream.data;
        for (let i = stream.dictionary.length - 1; i >= 0; --i) {
          /** @type {BPEEntry} */
          const entry = stream.dictionary[i];
          /** @type {int32[]} */
          const newData = [];
          for (let k = 0; k < workingData.length; k++) {
            /** @type {int32} */
            const value = workingData[k];
            if (value === entry.code) {
              newData.push(entry.val1);
              newData.push(entry.val2);
            } else {
              newData.push(value);
            }
          }
          workingData = newData;
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return workingData;
      }

      /**
       * Append the little-endian bytes of a 16-bit value
       * @param {uint8[]} bytes - Destination
       * @param {int32} value - Value
       */
      _push16(bytes, value) {
        /** @type {uint8[]} */
        const src = OpCodes.Unpack16LE(value);
        for (let k = 0; k < src.length; k++) {
          bytes.push(src[k]);
        }
      }

      /**
       * Pack compressed data with dictionary (all fields little-endian)
       * @private
       * @param {BPEEntry[]} dictionary - Rules in assignment order
       * @param {int32[]} data - Encoded values
       * @returns {uint8[]} Packed stream
       */
      _packCompressedData(dictionary, data) {
        /** @type {uint8[]} */
        const bytes = [];

        this._push16(bytes, dictionary.length);

        for (let e = 0; e < dictionary.length; e++) {
          /** @type {BPEEntry} */
          const entry = dictionary[e];
          this._push16(bytes, entry.code);
          this._push16(bytes, entry.val1);
          this._push16(bytes, entry.val2);
        }

        /** @type {uint8[]} */
        const lengthBytes = OpCodes.Unpack32LE(data.length);
        for (let k = 0; k < lengthBytes.length; k++) {
          bytes.push(lengthBytes[k]);
        }

        for (let k = 0; k < data.length; k++) {
          this._push16(bytes, data[k]);
        }

        return bytes;
      }

      /**
       * Unpack compressed data (all fields little-endian)
       * @private
       * @param {uint8[]} bytes - Packed stream
       * @returns {BPEStream} Rules and encoded values
       */
      _unpackCompressedData(bytes) {
        if (bytes.length < 6) {
          throw new Error('Invalid BPE compressed data: too short');
        }

        /** @type {int32} */
        let pos = 0;

        /** @type {int32} */
        const dictSize = OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]);
        pos += 2;

        /** @type {BPEEntry[]} */
        const dictionary = [];
        for (let i = 0; i < dictSize; i++) {
          if (pos + 6 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete dictionary');
          }

          /** @type {int32} */
          const code = OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]);
          /** @type {int32} */
          const val1 = OpCodes.Pack16LE(bytes[pos + 2], bytes[pos + 3]);
          /** @type {int32} */
          const val2 = OpCodes.Pack16LE(bytes[pos + 4], bytes[pos + 5]);

          dictionary.push(new BPEEntry(code, val1, val2));
          pos += 6;
        }

        if (pos + 4 > bytes.length) {
          throw new Error('Invalid BPE compressed data: missing data length');
        }

        /** @type {uint32} */
        const dataLength = OpCodes.Pack32LE(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
        pos += 4;

        /** @type {int32[]} */
        const data = [];
        for (let i = 0; i < dataLength; i++) {
          if (pos + 2 > bytes.length) {
            throw new Error('Invalid BPE compressed data: incomplete data');
          }

          data.push(OpCodes.Pack16LE(bytes[pos], bytes[pos + 1]));
          pos += 2;
        }

        return new BPEStream(dictionary, data);
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