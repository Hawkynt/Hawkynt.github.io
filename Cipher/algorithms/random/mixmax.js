/*
 * MIXMAX Pseudo-Random Number Generator
 * Based on matrix-recursive method by Konstantin Savvidy and George Savvidy
 *
 * This implementation uses a simplified 256x256 matrix generator with Fibonacci-like
 * recurrence relation. The matrix is constructed with a special "magic number" parameter
 * to achieve optimal spectral properties.
 *
 * Period: Extremely long (10^4682 for N=256)
 * State: 256 x 64-bit words (16,384 bits total)
 * Algorithm: Matrix-congruential method with special recurrence
 *
 * Note: This is a simplified educational implementation based on the matrix-recursive
 * principle. The full MIXMAX from hepforge.org uses modular arithmetic on GF(p) where
 * p=2^61-1. This version uses implicit mod 2^64 for educational purposes.
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class MixmaxAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MIXMAX";
      this.description = "MIXMAX is a matrix-recursive pseudo-random number generator based on Kolmogorov K-systems and Anosov C-systems. It uses a special NxN matrix multiplication in a Galois field to generate extremely high-quality random numbers with exceptional statistical properties and very long periods.";
      this.inventor = "Konstantin Savvidy, George Savvidy";
      this.year = 2015;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 2048, 1)]; // 1-2048 bytes (256 x 64-bit words)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: The MIXMAX random number generator (CPC 2015)",
          "https://arxiv.org/abs/1403.5355"
        ),
        new LinkItem(
          "Spectral Test of MIXMAX Generators (Chaos 2018)",
          "https://arxiv.org/abs/1806.05243"
        ),
        new LinkItem(
          "Official Implementation (HEPForge)",
          "https://mixmax.hepforge.org/"
        ),
        new LinkItem(
          "ROOT CERN Implementation",
          "https://root.cern.ch/doc/master/classROOT_1_1Math_1_1MixMaxEngine.html"
        ),
        new LinkItem(
          "Wikipedia: MIXMAX generator",
          "https://en.wikipedia.org/wiki/MIXMAX_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "A Priori Tests for MIXMAX (arXiv 2018)",
          "https://arxiv.org/abs/1804.01563"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Savvidy's Research Papers",
          "https://inspirehep.net/authors/987637"
        )
      ];

      // Test vectors
      // NOTE: These are generated from the simplified matrix implementation (implicit mod 2^64)
      // The full MIXMAX from hepforge.org uses modular arithmetic on GF(2^61-1)
      // This implementation matches the C# reference code provided
      this.tests = [
        {
          text: "Seed [1,2,3,4]: First 4 outputs (32 bytes) - Verified against C# implementation",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000020000000300000004"),
          outputSize: 32, // 4 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "6379AFC57B50BF57" +  // Output 1: Sum of SplitMix64-initialized state
            "2C9062F116E0458A" +  // Output 2: After first matrix multiplication
            "D22A0A30E848249B" +  // Output 3: Continued state evolution
            "A286B8C5A633B27A"    // Output 4: Matrix-recursive progression
          )
        },
        {
          text: "Seed [0]: First 3 outputs (24 bytes) - Zero seed with SplitMix64 initialization",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 24,
          expected: OpCodes.Hex8ToBytes(
            "05BC6A4A6D369615" +  // Output 1: SplitMix64(0) generates non-zero state
            "B1D0A961F181C742" +  // Output 2: Matrix transformation
            "0294730F6FBEF9AE"    // Output 3: Further evolution
          )
        },
        {
          text: "Seed [1]: First 5 outputs (40 bytes) - Single-byte seed propagation",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "FF4A6538E039E776" +  // Output 1: SplitMix64(1) state sum
            "DEA700280BDC6E54" +  // Output 2: Matrix-vector multiplication
            "B67E275AC7959C34" +  // Output 3: Continued progression
            "0DCF790540C41F19" +  // Output 4: State evolution
            "B13744FCB2DFF6EE"    // Output 5: Long-term behavior
          )
        },
        {
          text: "Seed [42]: First 4 outputs (32 bytes) - Common test seed value",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "462494AB7E4722B7" +  // Output 1: SplitMix64(42) initialization
            "233C616CC59DCF72" +  // Output 2
            "3D3137ECCF3BEFAD" +  // Output 3
            "B59766EE350E766E"    // Output 4
          )
        },
        {
          text: "Seed [123456789]: First 3 outputs (24 bytes) - Large seed value test",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000075BCD15"),
          outputSize: 24,
          expected: OpCodes.Hex8ToBytes(
            "8506A0FDAC78F9CA" +  // Output 1: Large seed handling
            "EFB5DB32389C75DE" +  // Output 2
            "1D094A706B95537F"    // Output 3
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new MixmaxInstance(this);
    }
  }

  class MixmaxInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MIXMAX configuration (simplified N=256 version)
      this.MATRIX_SIZE = 256;
      this.MAGIC_NUMBER = -3n; // Special parameter for optimal spectral properties

      // Generator state (256 x 64-bit words)
      this._state = new Array(this.MATRIX_SIZE);
      for (let i = 0; i < this.MATRIX_SIZE; ++i) {
        this._state[i] = 0n;
      }

      // Transformation matrix (256x256)
      this._matrix = this._initializeMatrix();
      this._ready = false;
    }

    /**
     * Initialize the MIXMAX transformation matrix
     * Based on special Fibonacci-like recurrence relation
     *
     * Matrix construction (from reference implementation):
     * - First column: all 1s
     * - For column > row: 1
     * - For column <= row: (row - column + 2)
     * - Special adjustment: matrix[2,1] += MAGIC_NUMBER
     */
    _initializeMatrix() {
      const matrix = new Array(this.MATRIX_SIZE);

      for (let row = 0; row < this.MATRIX_SIZE; ++row) {
        matrix[row] = new Array(this.MATRIX_SIZE);

        // First column: all 1s
        matrix[row][0] = 1n;

        // Remaining columns
        for (let col = 1; col < this.MATRIX_SIZE; ++col) {
          if (col > row) {
            matrix[row][col] = 1n;
          } else {
            matrix[row][col] = BigInt(row - col + 2);
          }
        }
      }

      // Apply magic number adjustment at position [2,1]
      matrix[2][1] = OpCodes.AndN(matrix[2][1] + this.MAGIC_NUMBER, 0xFFFFFFFFFFFFFFFFn);

      return matrix;
    }

    /**
     * Seed using SplitMix64 for state initialization
     * This matches the C# implementation's seeding strategy
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to initial 64-bit value (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Initialize state using SplitMix64
      // SplitMix64 constants
      const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      const MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      const MIX_CONST_2 = 0x94D049BB133111EBn;

      // Generate 256 state values using SplitMix64
      for (let i = 0; i < this.MATRIX_SIZE; ++i) {
        // SplitMix64 next() function
        seedValue = OpCodes.AndN(seedValue + GOLDEN_GAMMA, 0xFFFFFFFFFFFFFFFFn);
        let z = seedValue;
        z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 30)) * MIX_CONST_1, 0xFFFFFFFFFFFFFFFFn);
        z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 27)) * MIX_CONST_2, 0xFFFFFFFFFFFFFFFFn);
        z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 31)), 0xFFFFFFFFFFFFFFFFn);

        this._state[i] = z;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit value using MIXMAX matrix multiplication
     *
     * Algorithm:
     * 1. Sum all state values to produce output (mod 2^64)
     * 2. Compute newState[i] = sum(matrix[i][j] * state[j]) for all j
     * 3. Update state to newState
     * 4. Return output
     */
    _next64() {
      if (!this._ready) {
        throw new Error('MIXMAX not initialized: set seed first');
      }

      // Step 1: Compute output as sum of all state values (implicit mod 2^64)
      let result = 0n;
      for (let i = 0; i < this.MATRIX_SIZE; ++i) {
        result = OpCodes.AndN(result + this._state[i], 0xFFFFFFFFFFFFFFFFn);
      }

      // Step 2: Matrix-vector multiplication to compute new state
      const newState = new Array(this.MATRIX_SIZE);
      for (let i = 0; i < this.MATRIX_SIZE; ++i) {
        newState[i] = 0n;

        for (let j = 0; j < this.MATRIX_SIZE; ++j) {
          // newState[i] += matrix[i][j] * state[j] (mod 2^64)
          const product = OpCodes.AndN(this._matrix[i][j] * this._state[j], 0xFFFFFFFFFFFFFFFFn);
          newState[i] = OpCodes.AndN(newState[i] + product, 0xFFFFFFFFFFFFFFFFn);
        }
      }

      // Step 3: Update state
      this._state = newState;

      // Step 4: Return output
      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('MIXMAX not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 64-bit value
        const value = this._next64();

        // Extract bytes (big-endian order - most significant byte first)
        const bytesToExtract = Math.min(bytesRemaining, 8);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, (7 - i) * 8), 0xFFn));
          output.push(byte);
        }

        bytesRemaining -= bytesToExtract;
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed can be used to add entropy or skip outputs
      // Not implemented in basic MIXMAX
    }

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 32;
    }
  }

  // Register algorithm
  const algorithmInstance = new MixmaxAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MixmaxAlgorithm, MixmaxInstance };
}));
