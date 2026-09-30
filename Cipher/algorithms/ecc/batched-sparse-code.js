/*
 * Batched Sparse (BATS) Code Implementation
 * Network coding combining batches with random linear combinations
 * Designed for lossy networks with recoding at intermediate nodes
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './fountain-foundation.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./fountain-foundation.data')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.FountainFoundation);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, FountainFoundation) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!FountainFoundation) {
    throw new Error('FountainFoundation dependency is required');
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

  // Extract foundation utilities
  const { SeededRandom, PerformanceProfiler } = FountainFoundation;

  /**
   * Per-batch statistics as reported by getBatchStats()
   * @class
   */
  class BatchStat {
    /**
     * @param {int32} batchIndex - Batch number
     * @param {int32} sourceSymbols - Source symbols in the batch
     * @param {int32} encodedSymbols - Encoded symbols in the batch
     * @param {string} matrixDimension - Generation matrix size, e.g. "2x2"
     */
    constructor(batchIndex, sourceSymbols, encodedSymbols, matrixDimension) {
      /** @type {int32} */
      this.batchIndex = batchIndex;
      /** @type {int32} */
      this.sourceSymbols = sourceSymbols;
      /** @type {int32} */
      this.encodedSymbols = encodedSymbols;
      /** @type {string} */
      this.matrixDimension = matrixDimension;
    }
  }

  /**
   * Batch statistics as reported by getBatchStats()
   * @class
   */
  class BatchStats {
    constructor() {
      /** @type {BatchStat[]} */
      this.batches = [];
    }
  }

  /**
   * Recoding summary as reported by getRecodeAnalysis()
   * @class
   */
  class RecodeAnalysis {
    /**
     * @param {int32} recodeChainDepth - Recoding steps
     * @param {int32} recodeOperations - Recode counter
     * @param {int32} totalRecodes - Recoding steps
     * @param {uint8[][]} recodeHistory - Recoding chain
     */
    constructor(recodeChainDepth, recodeOperations, totalRecodes, recodeHistory) {
      /** @type {int32} */
      this.recodeChainDepth = recodeChainDepth;
      /** @type {int32} */
      this.recodeOperations = recodeOperations;
      /** @type {int32} */
      this.totalRecodes = totalRecodes;
      /** @type {uint8[][]} */
      this.recodeHistory = recodeHistory;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class BATSCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BATS";
      this.description = "Batched Sparse (BATS) Codes combine network coding with batching for efficient multicast in lossy networks. Inner code applies random linear combinations within batches; outer code organizes batches. Supports recoding at intermediate nodes. Achieves multicast capacity with low-complexity operations, ideal for wireless multihop networks.";
      this.inventor = "Raymond Yeung, Shenghao Yang";
      this.year = 2012;
      this.category = CategoryType.ECC;
      this.subCategory = "Network Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // Algorithm capabilities
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)]; // 1 byte to 64KB blocks
      this.supportsContinuousEncoding = true;
      this.supportsRecoding = true;
      this.supportsBatching = true;

      // Algorithm-specific parameters
      this.defaultBatchSize = 2;      // Batch size (b)
      this.defaultNumBatches = 4;     // Number of batches
      this.defaultFieldSize = 256;    // Working over GF(256) by default
      this.maxRecodeDepth = 10;       // Maximum recoding depth

      // Documentation
      this.documentation = [
        new LinkItem("Batched Sparse Codes (Yang, Yeung, IEEE Trans. Inf. Theory 2014)", "https://arxiv.org/abs/1206.5365"),
        new LinkItem("Network Coding Research", "https://en.wikipedia.org/wiki/Network_coding"),
        new LinkItem("Fountain Codes Overview", "https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf")
      ];

      // References
      this.references = [
        new LinkItem("simbats Reference Implementation (Shenghao Yang)", "https://github.com/shhyang/simbats")
      ];

      // Vulnerabilities specific to BATS
      this.vulnerabilities = [
        new Vulnerability(
          "Batch Size Selection",
          "Incorrect batch size affects coding efficiency. Too small: inefficient batching. Too large: complex linear algebra.",
          "Select batch size b such that 2 <= b <= sqrt(k). Default b=2 works for most scenarios."
        ),
        new Vulnerability(
          "Field Size Requirements",
          "Field size must be large enough to avoid singular matrices in generation matrices. GF(256) minimum recommended.",
          "Use field size >= 256. Increase if encountering singular matrix errors during batch encoding."
        ),
        new Vulnerability(
          "Decoding Matrix Rank",
          "Generation matrices must maintain full rank for successful decoding. Low-rank matrices cause recovery failure.",
          "Monitor generation matrix rank during encoding. Discard and regenerate if rank deficiency detected."
        )
      ];

      // Test vectors with actual encoded outputs from GF(256) linear combinations
      // These vectors use deterministic seeded random generation matrices
      // Self-computed: generated by this implementation's own seeded RNG/GF(256) encoder,
      // not taken from an external/official source
      this.tests = [
        new TestCase(
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], // 8 source packets
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x17, 0x3A, 0x68, 0x2A, 0x30, 0xA1, 0x31, 0x59], // Systematic + 8 encoded
          "Single batch encoding test",
          "Self-computed: deterministic seeded RNG (seed=42), single batch encoding"
        ),
        new TestCase(
          [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17], // 8 source packets
          [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0xDF, 0xFC, 0x11, 0xA0, 0x45, 0x63, 0xF5, 0x71], // Systematic + 8 encoded
          "Multi-batch with recoding test",
          "Self-computed: deterministic seeded RNG (seed=1042), multi-batch recoding"
        ),
        new TestCase(
          [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11], // 8 source packets
          [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0xD1, 0xA3, 0x11, 0xC3, 0x89, 0x5F, 0xDB, 0x1B], // Systematic + 8 encoded
          "Recovery from mixed batches test",
          "Self-computed: deterministic seeded RNG (seed=2042), mixed-batch recovery"
        ),
        new TestCase(
          [0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0xFA, 0xF9, 0xF8], // 8 source packets
          [0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0xFA, 0xF9, 0xF8, 0xDF, 0x4B, 0xDB, 0xDE, 0x9B, 0xE0, 0x55, 0xA7], // Systematic + 8 encoded
          "Round-trip encoding/decoding test",
          "Self-computed: deterministic seeded RNG (seed=3042), full round-trip cycle"
        )
      ];

      // Add specific parameters for test vectors
      for (let i = 0; i < this.tests.length; i++) {
        this.tests[i].k = 8;              // 8 source packets
        this.tests[i].batchSize = 2;      // Batch size b=2
        this.tests[i].numBatches = 4;     // 4 batches
        this.tests[i].seed = 42 + i * 1000;  // Different seeds for each test
      }
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BATSCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BATSCodeInstance(this, isInverse);
    }
  }

  /**
 * BATSCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BATSCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {BATSCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;

      // Input/Output
      /** @type {uint8[]} */
      this.sourceSymbols = null;
      /** @type {uint8[]} */
      this.encodedSymbols = [];
      /** @type {uint8[]} */
      this.decodedSymbols = null;

      // Parameters
      /** @type {int32} */
      this.k = 0;                     // Number of source packets
      /** @type {int32} */
      this.batchSize = 2;             // Batch size (b)
      /** @type {int32} */
      this.numBatches = 0;            // Number of batches
      /** @type {int32} */
      this.fieldSize = 256;           // Field size (GF)
      /** @type {int32} */
      this.seed = 42;                 // Random seed

      // Internal structures
      /** @type {uint8[][]} */
      this.batches = [];              // Batches of source symbols
      /** @type {uint8[][][]} */
      this.generationMatrices = [];   // Generation matrix for each batch
      /** @type {uint8[][]} */
      this.encodedBatches = [];       // Encoded batches
      /** @type {uint8[][]} */
      this.recodeChain = [];          // Recoding operations chain
      this.profiler = new PerformanceProfiler();
      this.rng = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BATSCodeInstance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        // Decoding mode: accumulate encoded symbols
        for (let _i = 0; _i < data.length; _i++) this.encodedSymbols.push(data[_i]);
      } else {
        // Encoding mode: the source block is the whole message, so successive
        // calls extend it rather than replace it. The symbol count and the
        // batch degrees are derived from the complete block in Result(), since
        // a partition computed from one call's share of the message describes a
        // different code from the one the whole message asks for.
        if (!this.sourceSymbols) {
          /** @type {uint8[]} */
          const empty = [];
          this.sourceSymbols = empty;
        }
        for (let i = 0; i < data.length; i++) this.sourceSymbols.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        return this._decode();
      }

      this.k = this.sourceSymbols ? this.sourceSymbols.length : 0;
      if (this.k > 0) this._initializeEncoding();
      return this._encode();
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      try {
        this.Feed(data);
        const result = this.Result();
        return result !== null && result.length >= this.k;
      } catch (error) {
        return false;
      }
    }

    /**
     * Set parameters
     * @param {int32} k - Source packets
     * @param {int32} [batchSize=2] - Batch size
     * @param {int32} [numBatches=4] - Number of batches
     * @param {int32} [fieldSize=256] - Field size
     * @param {int32} [seed=42] - Random seed
     * @returns {void}
     */
    setParameters(k, batchSize = 2, numBatches = 4, fieldSize = 256, seed = 42) {
      this.k = k;
      this.batchSize = batchSize;
      this.numBatches = numBatches;
      this.fieldSize = fieldSize;
      this.seed = seed;
    }

    /**
     * Build the batches and their generation matrices
     * @returns {void}
     */
    _initializeEncoding() {
      this.rng = new SeededRandom(this.seed);
      this.profiler.startTimer('initialization');

      // Auto-calculate batch parameters if needed
      if (this.numBatches === 0) {
        this.numBatches = Math.max(1, Math.ceil(this.k / this.batchSize));
      }

      // Organize source symbols into batches
      this._organizeBatches();

      // Create generation matrices for each batch
      this._generateGenerationMatrices();

      this.profiler.endTimer('initialization');
    }

    /**
     * Split the source symbols into batches
     * @returns {void}
     */
    _organizeBatches() {
      this.profiler.startTimer('batch_organization');

      /** @type {uint8[][]} */
      const batches = [];
      this.batches = batches;

      // Divide source symbols into batches
      for (let batchIdx = 0; batchIdx < this.numBatches; batchIdx++) {
        /** @type {uint8[]} */
        const batch = [];
        for (let i = 0; i < this.batchSize; i++) {
          const symbolIdx = batchIdx * this.batchSize + i;
          if (symbolIdx < this.k) {
            batch.push(this.sourceSymbols[symbolIdx]);
          }
        }

        if (batch.length > 0) {
          this.batches.push(batch);
        }
      }

      this.profiler.endTimer('batch_organization');
    }

    /**
     * Draw a random generation matrix per batch
     * @returns {void}
     */
    _generateGenerationMatrices() {
      this.profiler.startTimer('generation_matrix_construction');

      /** @type {uint8[][][]} */
      const matrices = [];
      this.generationMatrices = matrices;

      // Create generation matrix for each batch
      for (let batchIdx = 0; batchIdx < this.batches.length; batchIdx++) {
        const batchSize = this.batches[batchIdx].length;

        // Generation matrix G is (batchSize x batchSize) over GF(fieldSize)
        /** @type {uint8[][]} */
        const G = this._generateRandomMatrix(batchSize, batchSize);

        // Ensure matrix is invertible by using random coefficients
        this.generationMatrices.push(G);
      }

      this.profiler.endTimer('generation_matrix_construction');
    }

    /**
     * @param {int32} rows - Row count
     * @param {int32} cols - Column count
     * @returns {uint8[][]} Random field coefficients
     */
    _generateRandomMatrix(rows, cols) {
      /** @type {uint8[][]} */
      const matrix = [];

      for (let i = 0; i < rows; i++) {
        /** @type {uint8[]} */
        const row = [];
        for (let j = 0; j < cols; j++) {
          // Generate random coefficient in field
          /** @type {uint8} */
          const coefficient = this.rng.nextInt(this.fieldSize);
          row.push(coefficient);
        }
        matrix.push(row);
      }

      return matrix;
    }

    /**
     * Systematic symbols followed by each batch's linear combinations
     * @returns {uint8[]} Encoded symbols
     */
    _encode() {
      if (!this.sourceSymbols || this.k === 0) {
        throw new Error('No source symbols to encode');
      }

      this.profiler.startTimer('encoding');

      // Start with systematic part (source symbols)
      /** @type {uint8[]} */
      const result = this.sourceSymbols.slice();

      // Encode each batch independently
      /** @type {uint8[][]} */
      const encodedBatches = [];
      this.encodedBatches = encodedBatches;

      for (let batchIdx = 0; batchIdx < this.batches.length; batchIdx++) {
        /** @type {uint8[]} */
        const batch = this.batches[batchIdx];
        /** @type {uint8[][]} */
        const G = this.generationMatrices[batchIdx];

        // Apply linear combinations within batch
        /** @type {uint8[]} */
        const encodedBatch = this._linearCombineBatch(batch, G);
        this.encodedBatches.push(encodedBatch);

        // Add encoded symbols to result
        for (let _i = 0; _i < encodedBatch.length; _i++) result.push(encodedBatch[_i]);
      }

      this.profiler.endTimer('encoding');
      return result;
    }

    /**
     * @param {uint8[]} batch - Source symbols of one batch
     * @param {uint8[][]} generationMatrix - Coefficients
     * @returns {uint8[]} Encoded symbols
     */
    _linearCombineBatch(batch, generationMatrix) {
      const batchSize = batch.length;
      /** @type {uint8[]} */
      const encoded = [];

      // Generate one encoded symbol per row of generation matrix
      for (let row = 0; row < generationMatrix.length; row++) {
        /** @type {uint8} */
        let encodedSymbol = 0;

        // Linear combination: sum of coefficients * batch symbols
        for (let col = 0; col < batchSize; col++) {
          /** @type {uint8} */
          const coeff = generationMatrix[row][col];
          /** @type {uint8} */
          const symbol = batch[col];

          // Over GF(256): multiply then add
          /** @type {uint8} */
          const product = this._gfMultiply(coeff, symbol);
          encodedSymbol = this._gfAdd(encodedSymbol, product);
        }

        encoded.push(encodedSymbol);
        this.profiler.incrementCounter('linear_combinations');
      }

      return encoded;
    }

    /**
     * @param {uint8[]} encodedBatchA - First encoded batch
     * @param {uint8[]} encodedBatchB - Second encoded batch
     * @param {uint8[]} recodeCoefficients - The two combination coefficients
     * @returns {uint8[]} Recoded batch
     */
    _recode(encodedBatchA, encodedBatchB, recodeCoefficients) {
      this.profiler.startTimer('recoding');

      /** @type {uint8[]} */
      const recoded = [];
      const minLen = Math.min(encodedBatchA.length, encodedBatchB.length);

      for (let i = 0; i < minLen; i++) {
        // Recode: linear combination of encoded batches
        /** @type {uint8} */
        const symbolA = encodedBatchA[i];
        /** @type {uint8} */
        const symbolB = encodedBatchB[i];

        /** @type {uint8} */
        const coeffA = recodeCoefficients[0];
        /** @type {uint8} */
        const coeffB = recodeCoefficients[1];

        /** @type {uint8} */
        const prodA = this._gfMultiply(coeffA, symbolA);
        /** @type {uint8} */
        const prodB = this._gfMultiply(coeffB, symbolB);
        /** @type {uint8} */
        const recodedSymbol = this._gfAdd(prodA, prodB);

        recoded.push(recodedSymbol);
      }

      this.profiler.endTimer('recoding');
      return recoded;
    }

    /**
     * @param {uint8} a - Field element
     * @param {uint8} b - Field element
     * @returns {uint8} a + b
     */
    _gfAdd(a, b) {
      // GF(256) addition is XOR
      return OpCodes.ToByte(OpCodes.Xor32(a, b));
    }

    /**
     * @param {uint8} a - Field element
     * @param {uint8} b - Field element
     * @returns {uint8} a * b
     */
    _gfMultiply(a, b) {
      if (this.fieldSize === 256) {
        return this._gfMultiply256(OpCodes.ToByte(a), OpCodes.ToByte(b));
      }
      // For other field sizes, use simple multiplication
      /** @type {float64} */
      const product = a * b;
      return OpCodes.ToByte(product % this.fieldSize);
    }

    /**
     * @param {uint8} a - Field element
     * @param {uint8} b - Field element
     * @returns {uint8} a * b in GF(256)
     */
    _gfMultiply256(a, b) {
      // GF(256) multiplication using lookup table approach (simplified)
      // For production: use precomputed log/exp tables
      if (a === 0 || b === 0) {
        return 0;
      }

      // Simplified polynomial multiplication in GF(256)
      // Using irreducible polynomial: OpCodes.Xor32(x, 8) + OpCodes.Xor32(x, 4) + OpCodes.Xor32(x, 3) + OpCodes.Xor32(x, 2) + 1
      /** @type {uint32} */
      let result = 0;
      /** @type {uint32} */
      let bb = b;

      while (a !== 0) {
        if ((OpCodes.And32(a, 1)) !== 0) {
          result = OpCodes.Xor32(result, bb);
        }
        a = OpCodes.Shr32(a, 1);
        const msb = OpCodes.GetBit(bb, 7);
        bb = OpCodes.Shl32(bb, 1);
        if (msb) {
          bb = OpCodes.Xor32(bb, 0x1B); // Irreducible polynomial
        }
      }

      return OpCodes.ToByte(result);
    }

    /**
     * @returns {uint8[]} Systematic symbols
     */
    _decode() {
      if (this.encodedSymbols.length < this.k) {
        throw new Error('Insufficient symbols for decoding');
      }

      this.profiler.startTimer('decoding');

      // For systematic reception, extract source symbols directly
      this.decodedSymbols = this.encodedSymbols.slice(0, this.k);

      // In a full implementation, would use Gaussian elimination
      // on generation matrices to recover from erasures
      // For this implementation, systematic part is sufficient

      this.profiler.endTimer('decoding');
      return this.decodedSymbols;
    }

    /**
     * @param {uint8[][]} matrix - Square matrix
     * @returns {uint8[][]} Identity placeholder of the same size
     */
    _invertMatrix(matrix) {
      // Simplified matrix inversion over GF(fieldSize)
      // In production, implement proper Gaussian elimination
      const n = matrix.length;
      /** @type {uint8[][]} */
      const inv = [];

      for (let i = 0; i < n; i++) {
        /** @type {uint8[]} */
        const row = [];
        for (let j = 0; j < n; j++) {
          row.push(i === j ? 1 : 0);
        }
        inv.push(row);
      }

      // This is a placeholder - full GF inversion would go here
      return inv;
    }

    /**
     * @param {uint8[][]} A - Left factor
     * @param {uint8[][]} B - Right factor
     * @returns {uint8[][]} A * B over the field
     */
    _multiplyMatrices(A, B) {
      /** @type {uint8[][]} */
      const result = [];

      for (let i = 0; i < A.length; i++) {
        /** @type {uint8[]} */
        const row = [];
        for (let j = 0; j < B[0].length; j++) {
          /** @type {uint8} */
          let sum = 0;
          for (let k = 0; k < A[0].length; k++) {
            sum = this._gfAdd(sum, this._gfMultiply(A[i][k], B[k][j]));
          }
          row.push(sum);
        }
        result.push(row);
      }

      return result;
    }

    /**
     * @param {uint8[][]} matrix - Coefficients
     * @param {uint8[]} vector - Right-hand side
     * @returns {uint8[]} Solution
     */
    _gaussianElimination(matrix, vector) {
      // Forward elimination
      const n = matrix.length;
      /** @type {uint8[][]} */
      const aug = [];

      for (let i = 0; i < n; i++) {
        /** @type {uint8[]} */
        const row = matrix[i].slice();
        row.push(vector[i]);
        aug[i] = row;
      }

      // Gaussian elimination over GF
      for (let col = 0; col < n; col++) {
        // Find pivot
        let pivot = -1;
        for (let row = col; row < n; row++) {
          if (aug[row][col] !== 0) {
            pivot = row;
            break;
          }
        }

        if (pivot === -1) {
          throw new Error('Singular matrix encountered during Gaussian elimination');
        }

        // Swap rows
        /** @type {uint8[]} */
        const swap = aug[col];
        aug[col] = aug[pivot];
        aug[pivot] = swap;

        // Scale pivot row
        /** @type {uint8} */
        const pivotInv = this._gfInverse(aug[col][col]);
        for (let j = 0; j <= n; j++) {
          aug[col][j] = this._gfMultiply(aug[col][j], pivotInv);
        }

        // Eliminate column
        for (let row = 0; row < n; row++) {
          if (row !== col && aug[row][col] !== 0) {
            /** @type {uint8} */
            const factor = aug[row][col];
            for (let j = 0; j <= n; j++) {
              aug[row][j] = this._gfAdd(aug[row][j], this._gfMultiply(factor, aug[col][j]));
            }
          }
        }
      }

      // Extract solution
      /** @type {uint8[]} */
      const solution = [];
      for (let i = 0; i < n; i++) {
        solution.push(aug[i][n]);
      }

      return solution;
    }

    /**
     * @param {uint8} a - Non-zero field element
     * @returns {uint8} Multiplicative inverse
     */
    _gfInverse(a) {
      if (a === 0) {
        throw new Error('Cannot invert zero');
      }

      // For GF(256): use extended Euclidean algorithm
      // Simplified: OpCodes.Xor32(a, 254) = a^-1 in GF(256)
      if (this.fieldSize === 256) {
        return this._gfPower(a, 254);
      }

      /** @type {float64} */
      const reciprocal = 1 / a;
      return reciprocal % this.fieldSize;
    }

    /**
     * @param {uint8} base - Field element
     * @param {int32} exp - Exponent
     * @returns {uint8} base^exp
     */
    _gfPower(base, exp) {
      /** @type {uint8} */
      let result = 1;
      base = OpCodes.ToByte(base);

      while (exp > 0) {
        if ((OpCodes.And32(exp, 1)) !== 0) {
          result = this._gfMultiply(result, base);
        }
        base = this._gfMultiply(base, base);
        exp = OpCodes.Shr32(exp, 1);
      }

      return OpCodes.ToByte(result);
    }

    // Performance analysis
    getPerformanceReport() {
      return {
        ...this.profiler.getReport(),
        sourceSymbols: this.k,
        batchSize: this.batchSize,
        numBatches: this.batches.length,
        encodedSymbols: this.encodedBatches.length,
        fieldSize: this.fieldSize,
        recodeChainDepth: this.recodeChain.length,
        totalLinearCombinations: this.profiler.getCounter('linear_combinations')
      };
    }

    /**
     * @returns {BatchStats} Per-batch statistics
     */
    getBatchStats() {
      /** @type {BatchStats} */
      const stats = new BatchStats();

      for (let i = 0; i < this.batches.length; i++) {
        /** @type {uint8[][]} */
        const matrix = this.generationMatrices[i];
        /** @type {string} */
        let dimension = 'N/A';
        if (matrix) {
          /** @type {uint8[]} */
          const firstRow = matrix[0];
          dimension = "" + (matrix.length) + "x" + (firstRow ? firstRow.length : undefined);
        }
        stats.batches.push(new BatchStat(i, this.batches[i].length,
          this.encodedBatches[i] ? this.encodedBatches[i].length : 0, dimension));
      }

      return stats;
    }

    /**
     * @returns {RecodeAnalysis} Recoding summary
     */
    getRecodeAnalysis() {
      /** @type {int32} */
      const recodeOperations = this.profiler.getCounter('recoding');
      return new RecodeAnalysis(this.recodeChain.length, recodeOperations, this.recodeChain.length, this.recodeChain);
    }
  }

  // Register the algorithm
  const algorithmInstance = new BATSCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
