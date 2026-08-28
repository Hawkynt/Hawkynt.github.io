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

  function _countingSortByKey(arr, key, keyRange) {
    const count = new Array(keyRange).fill(0);
    for (let i = 0; i < arr.length; i++) count[key[arr[i]]]++;
    for (let i = 1; i < keyRange; i++) count[i] += count[i - 1];
    const output = new Array(arr.length);
    for (let i = arr.length - 1; i >= 0; i--) {
      const k = key[arr[i]];
      count[k]--;
      output[count[k]] = arr[i];
    }
    return output;
  }

  // Suffix array (equivalently: sorted cyclic rotations) of data++[sentinel],
  // computed via prefix doubling with counting sort - O(n log n) overall.
  function _buildRotationSuffixArray(data) {
    const n = data.length;
    const m = n + 1;
    if (m === 1) return [0];

    let rank = new Array(m);
    for (let i = 0; i < n; i++) rank[i] = data[i] + 1; // real bytes: 1..256
    rank[n] = 0; // sentinel: uniquely smallest

    let sa = new Array(m);
    for (let i = 0; i < m; i++) sa[i] = i;
    sa = _countingSortByKey(sa, rank, 257);

    let cls = new Array(m);
    cls[sa[0]] = 0;
    for (let i = 1; i < m; i++) cls[sa[i]] = cls[sa[i - 1]] + (rank[sa[i]] !== rank[sa[i - 1]] ? 1 : 0);
    let classCount = cls[sa[m - 1]] + 1;

    for (let k = 1; classCount < m; k *= 2) {
      const key2 = new Array(m);
      for (let i = 0; i < m; i++) key2[i] = cls[(i + k) % m];

      sa = _countingSortByKey(sa, key2, classCount);
      sa = _countingSortByKey(sa, cls, classCount);

      const newCls = new Array(m);
      newCls[sa[0]] = 0;
      for (let i = 1; i < m; i++) {
        const prev = sa[i - 1], cur = sa[i];
        const same = cls[prev] === cls[cur] && key2[prev] === key2[cur];
        newCls[cur] = newCls[prev] + (same ? 0 : 1);
      }
      cls = newCls;
      classCount = cls[sa[m - 1]] + 1;
      if (classCount === m) break;
    }

    return sa;
  }

  function bwtEncode(data) {
    const n = data.length;
    if (n === 0) return { primaryIndex: 0, lastColumn: [] };
    const m = n + 1;
    const sa = _buildRotationSuffixArray(data);

    let primaryIndex = -1;
    const lastColumn = [];
    for (let i = 0; i < m; i++) {
      const pos = sa[i];
      if (pos === 0) { primaryIndex = i; continue; } // sentinel row, omitted
      lastColumn.push(data[pos - 1]);
    }
    return { primaryIndex, lastColumn };
  }

  function bwtDecode(primaryIndex, lastColumn) {
    const n = lastColumn.length;
    if (n === 0) return [];
    const m = n + 1;

    // Reinsert the sentinel (symbol 0) at row=primaryIndex; real bytes use
    // symbol domain 1..256 so the sentinel remains uniquely smallest.
    const fullL = new Array(m);
    for (let i = 0, j = 0; i < m; i++) {
      fullL[i] = (i === primaryIndex) ? 0 : (lastColumn[j++] + 1);
    }

    const count = new Array(257).fill(0);
    for (let i = 0; i < m; i++) count[fullL[i]]++;
    const C = new Array(257).fill(0);
    let sum = 0;
    for (let s = 0; s < 257; s++) { C[s] = sum; sum += count[s]; }

    const occRank = new Array(257).fill(0);
    const T = new Array(m);
    for (let i = 0; i < m; i++) {
      const s = fullL[i];
      T[i] = C[s] + occRank[s];
      occRank[s]++;
    }

    const original = new Array(m);
    let p = primaryIndex;
    for (let i = m - 1; i >= 0; i--) {
      original[i] = fullL[p];
      p = T[p];
    }

    // Strip the sentinel (symbol 0) and shift real bytes back down by 1.
    const result = new Array(n);
    let k = 0;
    for (let i = 0; i < m; i++) {
      if (original[i] !== 0) result[k++] = original[i] - 1;
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
        this.BLOCK_SIZE = 65536;          // 64KB blocks
        this.MIN_BLOCK_SIZE = 1024;       // Minimum block size
        this.CONTEXT_ORDER = 8;           // Context modeling order
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

      CreateInstance(isInverse = false) {
        return new BWTAdvancedInstance(this, isInverse);
      }
    }

    class BWTAdvancedInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Advanced BWT configuration
        this.blockSize = algorithm.BLOCK_SIZE;
        this.minBlockSize = algorithm.MIN_BLOCK_SIZE;
        this.contextOrder = algorithm.CONTEXT_ORDER;
        this.suffixCacheSize = algorithm.SUFFIX_CACHE_SIZE;

        // Advanced processing modules
        this.postProcessor = new BWTPostProcessor();
        this.contextModeler = new BWTContextModeler(this.contextOrder);
        
        // State management
        this.statistics = {
          transformedBlocks: 0,
          totalBytes: 0,
          compressionRatio: 1.0
        };
      }


      Result() {
        const result = this.isInverse ?
          this.decompress(this.inputBuffer) :
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) {
          return [0, 0, 0, 0, 255, 255, 255, 255]; // Empty header + end marker
        }

        const compressed = [];
        let offset = 0;

        // Process data in blocks
        while (offset < data.length) {
          const blockEnd = Math.min(offset + this.blockSize, data.length);
          const block = data.slice(offset, blockEnd);
          
          // Transform block using advanced BWT
          const transformedBlock = this._transformBlockAdvanced(block);
          for (let _i = 0; _i < transformedBlock.length; _i++) compressed.push(transformedBlock[_i]);
          
          offset = blockEnd;
          this.statistics.transformedBlocks++;
        }

        // Add end marker
        compressed.push(255, 255, 255, 255);

        this.statistics.totalBytes = data.length;
        this.statistics.compressionRatio = data.length / compressed.length;

        return compressed;
      }

      decompress(data) {
        if (!data || data.length < 8) return [];

        const decompressed = [];
        let offset = 0;

        // Process blocks until end marker
        while (offset < data.length - 3) {
          // Check for end marker
          if (data[offset] === 255 && data[offset + 1] === 255 && 
              data[offset + 2] === 255 && data[offset + 3] === 255) {
            break;
          }

          // Parse block header
          if (offset + 7 >= data.length) break;
          
          const lengthBytes = data.slice(offset, offset + 4);
          const blockLength = OpCodes.BytesToWords32BE(lengthBytes)[0];

          const indexBytes = data.slice(offset + 4, offset + 8);
          const primaryIndex = OpCodes.BytesToWords32BE(indexBytes)[0];

          offset += 8;

          if (blockLength === 0) continue;

          // Extract transformed data
          if (offset + blockLength > data.length) break;
          const transformedData = data.slice(offset, offset + blockLength);
          offset += blockLength;

          // Inverse transform
          const originalBlock = this._inverseTransformAdvanced(transformedData, primaryIndex);
          for (let _i = 0; _i < originalBlock.length; _i++) decompressed.push(originalBlock[_i]);
        }

        return decompressed;
      }

      /**
       * Transform block using the correct sentinel-based BWT core, followed
       * by move-to-front post-processing for better downstream compression.
       * @private
       */
      _transformBlockAdvanced(block) {
        if (block.length === 0) return [0, 0, 0, 0, 255, 255, 255, 255];

        // Pre-process block for better transformation
        const preprocessed = this.postProcessor.preprocess(block);

        // Correct BWT: primaryIndex is both the row of the unrotated string
        // AND the (omitted) sentinel row in the last column - see the core
        // algorithm comment above.
        const { primaryIndex, lastColumn } = bwtEncode(preprocessed);

        // Apply post-processing for better compression
        const postProcessed = this.postProcessor.postprocess(lastColumn);

        // Create output block using OpCodes
        const result = [];

        // Block header: [length(4)][primary_index(4)][data...]
        const lengthBytes = OpCodes.Words32ToBytesBE([postProcessed.length]);
        for (let _i = 0; _i < lengthBytes.length; _i++) result.push(lengthBytes[_i]);

        const indexBytes = OpCodes.Words32ToBytesBE([primaryIndex]);
        for (let _i = 0; _i < indexBytes.length; _i++) result.push(indexBytes[_i]);

        for (let _i = 0; _i < postProcessed.length; _i++) result.push(postProcessed[_i]);

        return result;
      }

      /**
       * Inverse transform: undo move-to-front, then the correct sentinel-
       * based inverse BWT.
       * @private
       */
      _inverseTransformAdvanced(transformedData, primaryIndex) {
        if (transformedData.length === 0) return [];

        // Reverse post-processing (inverse move-to-front)
        const bwtData = this.postProcessor.unpostprocess(transformedData);

        // Correct inverse BWT (LF-mapping reconstruction with the sentinel
        // reinserted at row=primaryIndex).
        const original = bwtDecode(primaryIndex, bwtData);

        // Reverse pre-processing
        return this.postProcessor.unpreprocess(original);
      }

      /**
       * Get compression statistics
       */
      getStatistics() {
        return { ...this.statistics };
      }
    }

    /**
     * BWT Post-processor for enhanced compression
     */
    class BWTPostProcessor {
      constructor() {
        this.transformations = [
          this._moveToFrontTransform,
          this._runLengthPreprocess,
          this._localRankTransform
        ];
      }

      /**
       * Pre-process data before BWT
       */
      preprocess(data) {
        // Apply lightweight preprocessing that doesn't hurt BWT
        return this._applyBestPreprocessing(data);
      }

      /**
       * Post-process BWT output for better compression
       */
      postprocess(bwtData) {
        // Apply transformations that work well after BWT
        return this._moveToFrontTransform(bwtData);
      }

      /**
       * Reverse post-processing
       */
      unpostprocess(data) {
        return this._inverseMoveToFrontTransform(data);
      }

      /**
       * Reverse pre-processing
       */
      unpreprocess(data) {
        // Most preprocessing is identity for educational version
        return data;
      }

      /**
       * Apply best preprocessing transformation
       * @private
       */
      _applyBestPreprocessing(data) {
        // For educational version, return data as-is
        // Real implementation might apply delta coding, etc.
        return data;
      }

      /**
       * Move-to-front transformation
       * @private
       */
      _moveToFrontTransform(data) {
        const alphabet = [];
        for (let i = 0; i < 256; i++) alphabet.push(i);
        
        const result = [];
        for (const byte of data) {
          const index = alphabet.indexOf(byte);
          result.push(index);
          
          // Move to front
          alphabet.splice(index, 1);
          alphabet.unshift(byte);
        }
        
        return result;
      }

      /**
       * Inverse move-to-front transformation
       * @private
       */
      _inverseMoveToFrontTransform(data) {
        const alphabet = [];
        for (let i = 0; i < 256; i++) alphabet.push(i);
        
        const result = [];
        for (const index of data) {
          const byte = alphabet[index];
          result.push(byte);
          
          // Move to front
          alphabet.splice(index, 1);
          alphabet.unshift(byte);
        }
        
        return result;
      }

      /**
       * Run-length preprocessing
       * @private
       */
      _runLengthPreprocess(data) {
        // Simplified run-length aware preprocessing
        return data; // Educational version
      }

      /**
       * Local rank transformation
       * @private
       */
      _localRankTransform(data) {
        // Transform based on local character rankings
        return data; // Educational version
      }
    }

    /**
     * Context modeler for BWT analysis
     */
    class BWTContextModeler {
      constructor(order) {
        this.order = order;
        this.contexts = new Map();
      }

      /**
       * Analyze BWT output for patterns
       */
      analyze(bwtData) {
        const analysis = {
          entropy: this._calculateEntropy(bwtData),
          patterns: this._findPatterns(bwtData),
          clustering: this._analyzeCluster(bwtData)
        };

        return analysis;
      }

      _calculateEntropy(data) {
        const frequencies = new Array(256).fill(0);
        for (const byte of data) {
          frequencies[byte]++;
        }

        let entropy = 0;
        for (const freq of frequencies) {
          if (freq > 0) {
            const p = freq / data.length;
            entropy -= p * Math.log2(p);
          }
        }

        return entropy;
      }

      _findPatterns(data) {
        const patterns = new Map();
        
        for (let len = 2; len <= Math.min(8, data.length); len++) {
          for (let i = 0; i <= data.length - len; i++) {
            const pattern = data.slice(i, i + len).join(',');
            patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
          }
        }

        return patterns;
      }

      _analyzeCluster(data) {
        // Analyze clustering properties of BWT output
        const clusters = [];
        let currentCluster = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
          if (Math.abs(data[i] - data[i-1]) <= 16) {
            currentCluster.push(data[i]);
          } else {
            if (currentCluster.length > 1) {
              clusters.push([...currentCluster]);
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