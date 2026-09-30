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

  // ----- Correct, O(n log n) suffix-array based Burrows-Wheeler core -----
  //
  // Shared with bwt.js: the transform is defined over T = block ++
  // [sentinel], sentinel being strictly smaller than every real byte and
  // occurring exactly once. Sorting the m = n+1 cyclic rotations of T
  // (equivalently its suffixes, since the sentinel is unique and minimal)
  // gives the BWT rotation matrix. The sentinel's row in the last column is
  // always exactly the primary index, so it is omitted from the serialized
  // last column and reinserted purely from the stored index on decode.
  //
  // The previous implementation built a suffix array of the block WITHOUT
  // a sentinel (plain suffix-of-string order, where a shorter suffix that
  // is a prefix of a longer one sorts first) and then applied the "L[i] =
  // S[SA[i]-1 mod n]" rotation formula to it. That formula is only valid
  // for a suffix array that represents cyclic ROTATION order; without a
  // sentinel, plain suffix order and rotation order diverge whenever one
  // suffix is a prefix of another (e.g. any repeated substring reaching
  // the end of the block), corrupting the transform for exactly that kind
  // of input while appearing to work on inputs with no such overlap.

  /**
   * @param {int32} size - Number of entries
   * @param {float64} value - Initial value of every entry
   * @returns {float64[]} Plain array filled with value
   */
  function filledArray(size, value) {
    /** @type {float64[]} */
    const arr = new Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = value;
    }
    return arr;
  }

  /**
   * Stable counting sort of positions by key
   * @param {int32[]} arr - Positions
   * @param {int32[]} key - Key per position
   * @param {int32} keyRange - Keys are below this
   * @returns {int32[]} Positions ordered by key, ties in input order
   */
  function _countingSortByKey(arr, key, keyRange) {
    /** @type {int32[]} */
    const count = filledArray(keyRange, 0);
    for (let i = 0; i < arr.length; i++) {
      count[key[arr[i]]]++;
    }
    for (let i = 1; i < keyRange; i++) {
      count[i] += count[i - 1];
    }
    /** @type {int32[]} */
    const output = new Array(arr.length);
    for (let i = arr.length - 1; i >= 0; i--) {
      /** @type {int32} */
      const k = key[arr[i]];
      count[k]--;
      output[count[k]] = arr[i];
    }
    return output;
  }

  // Suffix array (equivalently: sorted cyclic rotations) of data++[sentinel],
  // computed via prefix doubling with counting sort - O(n log n) overall.
  /**
   * @param {uint8[]} data - Block
   * @returns {int32[]} Rotation starts in sorted order
   */
  function _buildRotationSuffixArray(data) {
    /** @type {int32} */
    const n = data.length;
    /** @type {int32} */
    const m = n + 1;
    if (m === 1) {
      /** @type {int32[]} */
      const single = [0];
      return single;
    }

    /** @type {int32[]} */
    const rank = new Array(m);
    for (let i = 0; i < n; i++) {
      /** @type {int32} */
      const b = data[i];
      rank[i] = b + 1; // real bytes: 1..256
    }
    rank[n] = 0; // sentinel: uniquely smallest

    /** @type {int32[]} */
    let sa = new Array(m);
    for (let i = 0; i < m; i++) {
      sa[i] = i;
    }
    sa = _countingSortByKey(sa, rank, 257);

    /** @type {int32[]} */
    let cls = new Array(m);
    cls[sa[0]] = 0;
    for (let i = 1; i < m; i++) {
      cls[sa[i]] = cls[sa[i - 1]] + (rank[sa[i]] !== rank[sa[i - 1]] ? 1 : 0);
    }
    /** @type {int32} */
    let classCount = cls[sa[m - 1]] + 1;

    for (let k = 1; classCount < m; k *= 2) {
      /** @type {int32[]} */
      const key2 = new Array(m);
      for (let i = 0; i < m; i++) {
        key2[i] = cls[(i + k) % m];
      }

      sa = _countingSortByKey(sa, key2, classCount);
      sa = _countingSortByKey(sa, cls, classCount);

      /** @type {int32[]} */
      const newCls = new Array(m);
      newCls[sa[0]] = 0;
      for (let i = 1; i < m; i++) {
        /** @type {int32} */
        const prev = sa[i - 1];
        /** @type {int32} */
        const cur = sa[i];
        /** @type {boolean} */
        const same = cls[prev] === cls[cur] && key2[prev] === key2[cur];
        newCls[cur] = newCls[prev] + (same ? 0 : 1);
      }
      cls = newCls;
      classCount = cls[sa[m - 1]] + 1;
      if (classCount === m) {
        break;
      }
    }

    return sa;
  }

  /**
   * Result of the forward transform
   */
  class BwtColumn {
    /**
     * @param {int32} primaryIndex - Row of the (omitted) sentinel
     * @param {uint8[]} lastColumn - Last column without the sentinel
     */
    constructor(primaryIndex, lastColumn) {
      /** @type {int32} */
      this.primaryIndex = primaryIndex;
      /** @type {uint8[]} */
      this.lastColumn = lastColumn;
    }
  }

  /**
   * @param {uint8[]} data - Block
   * @returns {BwtColumn} Last column and primary index
   */
  function bwtEncode(data) {
    /** @type {int32} */
    const n = data.length;
    /** @type {uint8[]} */
    const lastColumn = [];
    if (n === 0) {
      return new BwtColumn(0, lastColumn);
    }
    /** @type {int32} */
    const m = n + 1;
    /** @type {int32[]} */
    const sa = _buildRotationSuffixArray(data);

    /** @type {int32} */
    let primaryIndex = -1;
    for (let i = 0; i < m; i++) {
      /** @type {int32} */
      const pos = sa[i];
      if (pos === 0) {
        primaryIndex = i;
        continue;
      } // sentinel row, omitted
      lastColumn.push(data[pos - 1]);
    }
    return new BwtColumn(primaryIndex, lastColumn);
  }

  // The decoder keeps plain arrays and plain arithmetic: a primary index
  // outside the block produces undefined/NaN entries, exactly as before.
  /**
   * @param {uint32} primaryIndex - Row of the sentinel
   * @param {uint8[]} lastColumn - Last column without the sentinel
   * @returns {uint8[]} Original block
   */
  function bwtDecode(primaryIndex, lastColumn) {
    /** @type {int32} */
    const n = lastColumn.length;
    /** @type {uint8[]} */
    const result = new Array(n);
    if (n === 0) {
      return result;
    }
    /** @type {int32} */
    const m = n + 1;

    // Reinsert the sentinel (symbol 0) at row=primaryIndex; real bytes use
    // symbol domain 1..256 so the sentinel remains uniquely smallest.
    /** @type {float64[]} */
    const fullL = new Array(m);
    /** @type {int32} */
    let j = 0;
    for (let i = 0; i < m; i++) {
      if (i === primaryIndex) {
        fullL[i] = 0;
      } else {
        /** @type {float64} */
        const symbol = lastColumn[j++];
        fullL[i] = symbol + 1;
      }
    }

    /** @type {float64[]} */
    const count = filledArray(257, 0);
    for (let i = 0; i < m; i++) {
      count[fullL[i]]++;
    }
    /** @type {float64[]} */
    const C = filledArray(257, 0);
    /** @type {float64} */
    let sum = 0;
    for (let s = 0; s < 257; s++) {
      C[s] = sum;
      sum += count[s];
    }

    /** @type {float64[]} */
    const occRank = filledArray(257, 0);
    /** @type {float64[]} */
    const T = new Array(m);
    for (let i = 0; i < m; i++) {
      /** @type {float64} */
      const s = fullL[i];
      T[i] = C[s] + occRank[s];
      occRank[s]++;
    }

    /** @type {float64[]} */
    const original = new Array(m);
    /** @type {float64} */
    let p = primaryIndex;
    for (let i = m - 1; i >= 0; i--) {
      original[i] = fullL[p];
      p = T[p];
    }

    // Strip the sentinel (symbol 0) and shift real bytes back down by 1.
    /** @type {int32} */
    let k = 0;
    for (let i = 0; i < m; i++) {
      if (original[i] !== 0) {
        result[k++] = original[i] - 1;
      }
    }
    return result;
  }

  /**
 * BWTAdvancedAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class BWTAdvancedAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "BWT-Advanced (Enhanced Burrows-Wheeler Transform)";
        this.description = "Advanced block-sorting compression using enhanced Burrows-Wheeler Transform with optimal suffix array construction, intelligent post-processing, and multi-stage entropy coding for maximum compression efficiency.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Block Sorting";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "Michael Burrows, David Wheeler (Enhanced)";
        this.year = 1994;
        this.country = CountryCode.US;

        // Advanced BWT parameters
        /** @type {int32} */
        this.BLOCK_SIZE = 65536;          // 64KB blocks
        /** @type {int32} */
        this.MIN_BLOCK_SIZE = 1024;       // Minimum block size
        /** @type {int32} */
        this.CONTEXT_ORDER = 8;           // Context modeling order
        /** @type {int32} */
        this.SUFFIX_CACHE_SIZE = 16384;   // Suffix array cache

        this.documentation = [
          new LinkItem("Burrows-Wheeler Transform", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"),
          new LinkItem("Advanced BWT Techniques", "https://arxiv.org/abs/1201.3077"),
          new LinkItem("Suffix Arrays in Practice", "https://web.stanford.edu/class/cs97si/suffix-array.pdf")
        ];

        this.references = [
          new LinkItem("Original BWT Paper", "http://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf"),
          new LinkItem("DCC BWT Improvements", "https://ieeexplore.ieee.org/document/1192719"),
          new LinkItem("Practical Suffix Arrays", "https://github.com/y-256/libdivsufsort"),
          new LinkItem("BWT in bzip2", "http://www.bzip.org/1.0.5/bzip2-manual-1.0.5.html")
        ];

        // Simplified test vectors for BWT Advanced (corrected format)
        this.tests = [
          new TestCase(
            [],
            [0, 0, 0, 0, 255, 255, 255, 255], // Empty block header
            "Empty input - header only",
            "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"
          ),
          new TestCase(
            [97], // "a"
            [0, 0, 0, 1, 0, 0, 0, 1, 97, 255, 255, 255, 255],
            "Single character",
            "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"
          ),
          new TestCase(
            [97, 98], // "ab"
            [0, 0, 0, 2, 0, 0, 0, 1, 98, 98, 255, 255, 255, 255],
            "Two characters",
            "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"
          ),
          new TestCase(
            // Regression: all 256 byte values - the previous non-sentinel
            // suffix-array implementation diverged from rotation order
            // exactly on inputs like this with long overlapping suffixes.
            Array.from({length: 256}, (_, i) => i),
            [0,0,1,0,0,0,0,1,255,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,255,255,255,255],
            "Regression: all 256 byte values",
            "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"
          ),
          new TestCase(
            // Regression: pseudo-random data, length 91
            [0,0,64,0,64,0,64,0,64,0,57,128,192,0,0,0,64,128,0,64,0,64,0,0,0,64,0,0,0,0,64,0,0,64,0,0,64,0,0,64,128,0,0,57,128,0,0,0,0,64,0,0,0,64,0,0,0,64,128,128,0,0,64,0,64,0,0,0,64,0,0,0,0,0,0,0,64,128,184,128,192,0,64,128,0,0,0,64,0,0,64],
            [0,0,0,91,0,0,0,27,64,0,1,0,128,2,2,1,0,1,1,2,2,192,3,2,3,2,2,0,0,0,0,0,1,0,2,1,2,0,0,0,1,1,0,0,1,0,1,0,0,0,0,0,1,1,2,2,0,2,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,60,3,0,4,1,0,0,2,185,3,0,0,255,255,255,255],
            "Regression: pseudo-random data, length 91",
            "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"
          ),
          new TestCase(
            // Regression: alternating pattern, length 83
            Array.from({length: 83}, (_, i) => (i % 2 ? 0x62 : 0x61)),
            [0,0,0,83,0,0,0,42,97,98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255],
            "Regression: alternating pattern, length 83",
            "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {BWTAdvancedInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new BWTAdvancedInstance(this, isInverse);
      }
    }

    /**
     * Transform statistics of an instance
     */
    class BwtStatistics {
      /**
       * @param {int32} transformedBlocks - Blocks transformed
       * @param {int32} totalBytes - Input bytes
       * @param {float64} compressionRatio - Input size over output size
       */
      constructor(transformedBlocks, totalBytes, compressionRatio) {
        /** @type {int32} */
        this.transformedBlocks = transformedBlocks;
        /** @type {int32} */
        this.totalBytes = totalBytes;
        /** @type {float64} */
        this.compressionRatio = compressionRatio;
      }
    }

    class BWTAdvancedInstance extends IAlgorithmInstance {
      /**
       * @param {BWTAdvancedAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // Advanced BWT configuration
        /** @type {int32} */
        this.blockSize = algorithm.BLOCK_SIZE;
        /** @type {int32} */
        this.minBlockSize = algorithm.MIN_BLOCK_SIZE;
        /** @type {int32} */
        this.contextOrder = algorithm.CONTEXT_ORDER;
        /** @type {int32} */
        this.suffixCacheSize = algorithm.SUFFIX_CACHE_SIZE;

        // Advanced processing modules
        /** @type {BWTPostProcessor} */
        this.postProcessor = new BWTPostProcessor();
        /** @type {BWTContextModeler} */
        this.contextModeler = new BWTContextModeler(this.contextOrder);

        // State management
        /** @type {BwtStatistics} */
        this.statistics = new BwtStatistics(0, 0, 1.0);
      }

      /**
       * Transform or restore the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
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
        return result;
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Blocks and end marker
       */
      compress(data) {
        if (!data || data.length === 0) {
          /** @type {uint8[]} */
          const emptyStream = [0, 0, 0, 0, 255, 255, 255, 255]; // Empty header + end marker
          return emptyStream;
        }

        /** @type {uint8[]} */
        const compressed = [];
        /** @type {int32} */
        let offset = 0;

        // Process data in blocks
        while (offset < data.length) {
          /** @type {int32} */
          const blockEnd = Math.min(offset + this.blockSize, data.length);
          /** @type {uint8[]} */
          const block = data.slice(offset, blockEnd);

          // Transform block using advanced BWT
          /** @type {uint8[]} */
          const transformedBlock = this._transformBlockAdvanced(block);
          for (let i = 0; i < transformedBlock.length; i++) {
            compressed.push(transformedBlock[i]);
          }

          offset = blockEnd;
          this.statistics.transformedBlocks++;
        }

        // Add end marker
        for (let i = 0; i < 4; i++) {
          compressed.push(255);
        }

        this.statistics.totalBytes = data.length;
        this.statistics.compressionRatio = data.length / compressed.length;

        return compressed;
      }

      /**
       * @param {uint8[]} data - Blocks and end marker
       * @returns {uint8[]} Original bytes
       */
      decompress(data) {
        /** @type {uint8[]} */
        const decompressed = [];
        if (!data || data.length < 8) {
          return decompressed;
        }

        /** @type {int32} */
        let offset = 0;

        // Process blocks until end marker
        while (offset < data.length - 3) {
          // Check for end marker
          if (data[offset] === 255 && data[offset + 1] === 255 &&
              data[offset + 2] === 255 && data[offset + 3] === 255) {
            break;
          }

          // Parse block header
          if (offset + 7 >= data.length) {
            break;
          }

          /** @type {uint8[]} */
          const lengthBytes = data.slice(offset, offset + 4);
          /** @type {uint32[]} */
          const lengthWords = OpCodes.BytesToWords32BE(lengthBytes);
          /** @type {uint32} */
          const blockLength = lengthWords[0];

          /** @type {uint8[]} */
          const indexBytes = data.slice(offset + 4, offset + 8);
          /** @type {uint32[]} */
          const indexWords = OpCodes.BytesToWords32BE(indexBytes);
          /** @type {uint32} */
          const primaryIndex = indexWords[0];

          offset += 8;

          if (blockLength === 0) {
            continue;
          }

          // Extract transformed data
          /** @type {float64} */
          const blockEnd = offset + blockLength;
          if (blockEnd > data.length) {
            break;
          }
          /** @type {uint8[]} */
          const transformedData = data.slice(offset, blockEnd);
          offset = blockEnd;

          // Inverse transform
          /** @type {uint8[]} */
          const originalBlock = this._inverseTransformAdvanced(transformedData, primaryIndex);
          for (let i = 0; i < originalBlock.length; i++) {
            decompressed.push(originalBlock[i]);
          }
        }

        return decompressed;
      }

      /**
       * Transform block using the correct sentinel-based BWT core, followed
       * by move-to-front post-processing for better downstream compression.
       * @private
       * @param {uint8[]} block - Block bytes
       * @returns {uint8[]} Block header and move-to-front ranks
       */
      _transformBlockAdvanced(block) {
        if (block.length === 0) {
          /** @type {uint8[]} */
          const emptyStream = [0, 0, 0, 0, 255, 255, 255, 255];
          return emptyStream;
        }

        // Pre-process block for better transformation
        /** @type {uint8[]} */
        const preprocessed = this.postProcessor.preprocess(block);

        // Correct BWT: primaryIndex is both the row of the unrotated string
        // AND the (omitted) sentinel row in the last column - see the core
        // algorithm comment above.
        /** @type {BwtColumn} */
        const encoded = bwtEncode(preprocessed);

        // Apply post-processing for better compression
        /** @type {uint8[]} */
        const postProcessed = this.postProcessor.postprocess(encoded.lastColumn);

        // Create output block using OpCodes
        /** @type {uint8[]} */
        const result = [];

        // Block header: [length(4)][primary_index(4)][data...]
        /** @type {uint32[]} */
        const lengthWord = [postProcessed.length];
        /** @type {uint8[]} */
        const lengthBytes = OpCodes.Words32ToBytesBE(lengthWord);
        for (let i = 0; i < lengthBytes.length; i++) {
          result.push(lengthBytes[i]);
        }

        /** @type {uint32[]} */
        const indexWord = [encoded.primaryIndex];
        /** @type {uint8[]} */
        const indexBytes = OpCodes.Words32ToBytesBE(indexWord);
        for (let i = 0; i < indexBytes.length; i++) {
          result.push(indexBytes[i]);
        }

        for (let i = 0; i < postProcessed.length; i++) {
          result.push(postProcessed[i]);
        }

        return result;
      }

      /**
       * Inverse transform: undo move-to-front, then the correct sentinel-
       * based inverse BWT.
       * @private
       * @param {uint8[]} transformedData - Move-to-front ranks
       * @param {uint32} primaryIndex - Row of the sentinel
       * @returns {uint8[]} Original block
       */
      _inverseTransformAdvanced(transformedData, primaryIndex) {
        if (transformedData.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        // Reverse post-processing (inverse move-to-front)
        /** @type {uint8[]} */
        const bwtData = this.postProcessor.unpostprocess(transformedData);

        // Correct inverse BWT (LF-mapping reconstruction with the sentinel
        // reinserted at row=primaryIndex).
        /** @type {uint8[]} */
        const original = bwtDecode(primaryIndex, bwtData);

        // Reverse pre-processing
        /** @type {uint8[]} */
        const restored = this.postProcessor.unpreprocess(original);
        return restored;
      }

      /**
       * Get compression statistics
       * @returns {BwtStatistics} Copy of the statistics
       */
      getStatistics() {
        return new BwtStatistics(this.statistics.transformedBlocks, this.statistics.totalBytes, this.statistics.compressionRatio);
      }
    }

    /**
     * BWT Post-processor for enhanced compression
     */
    class BWTPostProcessor {
      constructor() {
        /** @type {string[]} */
        this.transformations = ['_moveToFrontTransform', '_runLengthPreprocess', '_localRankTransform'];
      }

      /**
       * Pre-process data before BWT
       * @param {uint8[]} data - Block
       * @returns {uint8[]} Pre-processed block
       */
      preprocess(data) {
        // Apply lightweight preprocessing that doesn't hurt BWT
        /** @type {uint8[]} */
        const processed = this._applyBestPreprocessing(data);
        return processed;
      }

      /**
       * Post-process BWT output for better compression
       * @param {uint8[]} bwtData - Last column
       * @returns {uint8[]} Move-to-front ranks
       */
      postprocess(bwtData) {
        // Apply transformations that work well after BWT
        /** @type {uint8[]} */
        const ranks = this._moveToFrontTransform(bwtData);
        return ranks;
      }

      /**
       * Reverse post-processing
       * @param {uint8[]} data - Move-to-front ranks
       * @returns {uint8[]} Last column
       */
      unpostprocess(data) {
        /** @type {uint8[]} */
        const column = this._inverseMoveToFrontTransform(data);
        return column;
      }

      /**
       * Reverse pre-processing
       * @param {uint8[]} data - Block
       * @returns {uint8[]} Block
       */
      unpreprocess(data) {
        // Most preprocessing is identity for educational version
        return data;
      }

      /**
       * Apply best preprocessing transformation
       * @private
       * @param {uint8[]} data - Block
       * @returns {uint8[]} Block
       */
      _applyBestPreprocessing(data) {
        // For educational version, return data as-is
        // Real implementation might apply delta coding, etc.
        return data;
      }

      /**
       * Move-to-front transformation
       * @private
       * @param {uint8[]} data - Bytes
       * @returns {uint8[]} Ranks
       */
      _moveToFrontTransform(data) {
        /** @type {int32[]} */
        const alphabet = [];
        for (let i = 0; i < 256; i++) {
          alphabet.push(i);
        }

        /** @type {uint8[]} */
        const result = [];
        for (let n = 0; n < data.length; n++) {
          /** @type {uint8} */
          const byte = data[n];
          /** @type {int32} */
          let index = 0;
          while (index < alphabet.length && alphabet[index] !== byte) {
            index++;
          }
          result.push(index);

          // Move to front
          for (let k = index; k > 0; k--) {
            alphabet[k] = alphabet[k - 1];
          }
          alphabet[0] = byte;
        }

        return result;
      }

      /**
       * Inverse move-to-front transformation
       * @private
       * @param {uint8[]} data - Ranks
       * @returns {uint8[]} Bytes
       */
      _inverseMoveToFrontTransform(data) {
        /** @type {int32[]} */
        const alphabet = [];
        for (let i = 0; i < 256; i++) {
          alphabet.push(i);
        }

        /** @type {uint8[]} */
        const result = [];
        for (let n = 0; n < data.length; n++) {
          /** @type {int32} */
          const index = data[n];
          /** @type {int32} */
          const byte = alphabet[index];
          result.push(byte);

          // Move to front
          for (let k = index; k > 0; k--) {
            alphabet[k] = alphabet[k - 1];
          }
          alphabet[0] = byte;
        }

        return result;
      }

      /**
       * Run-length preprocessing
       * @private
       * @param {uint8[]} data - Block
       * @returns {uint8[]} Block
       */
      _runLengthPreprocess(data) {
        // Simplified run-length aware preprocessing
        return data; // Educational version
      }

      /**
       * Local rank transformation
       * @private
       * @param {uint8[]} data - Block
       * @returns {uint8[]} Block
       */
      _localRankTransform(data) {
        // Transform based on local character rankings
        return data; // Educational version
      }
    }

    /**
     * Occurrence counts of byte patterns, keyed by their comma-joined text
     */
    class BwtPatternCounts {
      constructor() {
        /** @type {string[]} */
        this.keys = [];
        /** @type {int32[]} */
        this.counts = [];
      }

      /**
       * @returns {int32} Number of distinct patterns
       */
      get size() {
        return this.keys.length;
      }

      /**
       * @param {string} key - Pattern text
       * @returns {int32} Its count (0 when never seen)
       */
      get(key) {
        for (let i = 0; i < this.keys.length; i++) {
          if (this.keys[i] === key) {
            return this.counts[i];
          }
        }
        return 0;
      }

      /**
       * @param {string} key - Pattern text
       */
      increment(key) {
        for (let i = 0; i < this.keys.length; i++) {
          if (this.keys[i] === key) {
            this.counts[i]++;
            return;
          }
        }
        this.keys.push(key);
        this.counts.push(1);
      }
    }

    /**
     * Result of a context analysis
     */
    class BwtAnalysis {
      /**
       * @param {float64} entropy - Order-0 entropy in bits per byte
       * @param {BwtPatternCounts} patterns - Pattern counts
       * @param {uint8[][]} clustering - Runs of nearby byte values
       */
      constructor(entropy, patterns, clustering) {
        /** @type {float64} */
        this.entropy = entropy;
        /** @type {BwtPatternCounts} */
        this.patterns = patterns;
        /** @type {uint8[][]} */
        this.clustering = clustering;
      }
    }

    /**
     * Context modeler for BWT analysis
     */
    class BWTContextModeler {
      /**
       * @param {int32} order - Context order
       */
      constructor(order) {
        /** @type {int32} */
        this.order = order;
        /** @type {BwtPatternCounts} */
        this.contexts = new BwtPatternCounts();
      }

      /**
       * Analyze BWT output for patterns
       * @param {uint8[]} bwtData - Last column
       * @returns {BwtAnalysis} Entropy, pattern counts and clusters
       */
      analyze(bwtData) {
        /** @type {float64} */
        const entropy = this._calculateEntropy(bwtData);
        /** @type {BwtPatternCounts} */
        const patterns = this._findPatterns(bwtData);
        /** @type {uint8[][]} */
        const clustering = this._analyzeCluster(bwtData);
        return new BwtAnalysis(entropy, patterns, clustering);
      }

      /**
       * @param {uint8[]} data - Bytes
       * @returns {float64} Order-0 entropy in bits per byte
       */
      _calculateEntropy(data) {
        /** @type {int32[]} */
        const frequencies = new Int32Array(256);
        for (let n = 0; n < data.length; n++) {
          frequencies[data[n]]++;
        }

        /** @type {float64} */
        let entropy = 0;
        for (let s = 0; s < 256; s++) {
          /** @type {int32} */
          const freq = frequencies[s];
          if (freq > 0) {
            /** @type {float64} */
            const p = freq / data.length;
            entropy -= p * Math.log2(p);
          }
        }

        return entropy;
      }

      /**
       * @param {uint8[]} data - Bytes
       * @returns {BwtPatternCounts} Counts of every 2..8-byte pattern
       */
      _findPatterns(data) {
        /** @type {BwtPatternCounts} */
        const patterns = new BwtPatternCounts();

        for (let len = 2; len <= Math.min(8, data.length); len++) {
          for (let i = 0; i <= data.length - len; i++) {
            /** @type {string} */
            let pattern = '' + data[i];
            for (let k = 1; k < len; k++) {
              pattern += ',' + data[i + k];
            }
            patterns.increment(pattern);
          }
        }

        return patterns;
      }

      /**
       * @param {uint8[]} data - Bytes
       * @returns {uint8[][]} Runs (longer than one) of neighbours differing by at most 16
       */
      _analyzeCluster(data) {
        // Analyze clustering properties of BWT output
        /** @type {uint8[][]} */
        const clusters = [];
        /** @type {uint8[]} */
        let currentCluster = [data[0]];

        for (let i = 1; i < data.length; i++) {
          /** @type {float64} */
          const step = data[i] - data[i - 1];
          if (Math.abs(step) <= 16) {
            currentCluster.push(data[i]);
          } else {
            if (currentCluster.length > 1) {
              clusters.push(currentCluster.slice());
            }
            currentCluster = [data[i]];
          }
        }

        if (currentCluster.length > 1) {
          clusters.push(currentCluster);
        }

        return clusters;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new BWTAdvancedAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BWTAdvancedAlgorithm, BWTAdvancedInstance, BWTPostProcessor, BWTContextModeler };
}));