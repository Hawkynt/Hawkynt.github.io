/*
 * Ran1 (Numerical Recipes Park-Miller + Bays-Durham)
 * By Stephen K. Park, Keith W. Miller, and Bays-Durham (1988)
 * Based on the reference implementation from Numerical Recipes in C
 *
 * Park-Miller Minimal Standard LCG with Bays-Durham shuffle (32 entries).
 * Improved randomness compared to raw Park-Miller generator.
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

  class Ran1Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Ran1 (Numerical Recipes)";
      this.description = "Park-Miller Minimal Standard LCG combined with Bays-Durham shuffle (32 entries) from Numerical Recipes. Uses Schrage's method to compute (16807 × X) mod (2^31-1) without overflow, then shuffles output through a 32-entry table to remove low-order serial correlations. Period ~2.1 × 10^9. Returns uniform deviates in range [0.0, 1.0).";
      this.inventor = "Stephen K. Park, Keith W. Miller, Bays-Durham";
      this.year = 1988;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Linear Congruential Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // Flexible seed size (1-8 bytes)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Numerical Recipes in C: The Art of Scientific Computing (2nd Edition)",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "Park and Miller (1988): Random Number Generators: Good Ones Are Hard to Find",
          "https://doi.org/10.1145/63039.63042"
        ),
        new LinkItem(
          "Ran1 Reference Implementation (UC Berkeley)",
          "https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C"
        )
      ];

      this.references = [
        new LinkItem(
          "Numerical Recipes Legacy Code",
          "http://numerical.recipes/routines/instc.html"
        ),
        new LinkItem(
          "Press et al.: Numerical Recipes - The Art of Scientific Computing",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "Bays-Durham Shuffle Algorithm",
          "https://en.wikipedia.org/wiki/Lehmer_random_number_generator"
        )
      ];

      // Test vectors from reference C implementation (Numerical Recipes ran1)
      // Verified by compiling and running original Numerical Recipes ran1.c code
      // Output format: 4-byte IEEE 754 single-precision floats (little-endian)
      this.tests = [
        {
          text: "Seed=-1 (initializes to 1) - First 10 float values",
          uri: "https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"), // seed = 1 (negated during init)
          outputSize: 40, // 10 x 4 bytes (single precision)
          // Values verified from reference implementation:
          // 0.4159993529, 0.0919648930, 0.7564104795, 0.5297002196, 0.9304364920,
          // 0.3835020661, 0.6539189816, 0.0668422356, 0.7226604223, 0.6711493731
          expected: OpCodes.Hex8ToBytes("DEFDD43E1758BC3D1EA4413F6F9A073F16316E3F625AC43E3C67273F95E4883D4600393F72D02B3F")
        },
        {
          text: "Seed=-12345 - First 10 float values",
          uri: "https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C",
          input: null,
          seed: OpCodes.Hex8ToBytes("3039"), // seed = 12345 (negated during init)
          outputSize: 40,
          // Values verified from reference implementation:
          // 0.9231205583, 0.3331466019, 0.1978884190, 0.9494217038, 0.7838003635,
          // 0.9838846326, 0.9141300321, 0.5832833052, 0.2091340870, 0.1777828783
          expected: OpCodes.Hex8ToBytes("A1516C3F3192AA3E43A34A3E4D0D733F24A7483FDDDF7B3F6D046A3F0E52153F3F27563EB70C363E")
        },
        {
          text: "Seed=-123456789 - First 10 float values",
          uri: "https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15"), // seed = 123456789 (negated during init)
          outputSize: 40,
          // Values verified from reference implementation:
          // 0.9119770527, 0.0617272295, 0.3969884813, 0.3516286612, 0.8228873014,
          // 0.7546734810, 0.0018383712, 0.1853141189, 0.5743658543, 0.8408474326
          expected: OpCodes.Hex8ToBytes("5477693FB1D57C3D1342CB3EAC08B43EBEA8523F4832413F80F5F03AFCC23D3EA409133FC741573F")
        },
        {
          text: "Seed=-1 - First value only (initialization test)",
          uri: "https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"),
          outputSize: 4,
          // First value: 0.4159993529
          expected: OpCodes.Hex8ToBytes("DEFDD43E")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new Ran1Instance(this);
    }
  }

  /**
 * Ran1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Ran1Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ran1 constants from Numerical Recipes
      this.IA = 16807;                    // Park-Miller multiplier
      this.IM = 2147483647;               // Park-Miller modulus (2^31-1)
      this.AM = 1.0 / this.IM;            // Scaling factor
      this.IQ = 127773;                   // IM div IA (for Schrage's method)
      this.IR = 2836;                     // IM mod IA (for Schrage's method)
      this.NTAB = 32;                     // Shuffle table size
      this.NDIV = 1 + Math.floor((this.IM - 1) / this.NTAB); // ~67108864
      this.EPS = 1.2e-7;                  // Small epsilon for endpoint exclusion
      this.RNMX = 1.0 - this.EPS;         // Maximum return value (< 1.0)

      // State variables
      this._idum = 0;                     // Current LCG state
      this._iy = 0;                       // Last output from shuffle table
      this._iv = new Array(this.NTAB).fill(0); // Shuffle table

      this._initialized = false;
      this._ready = false;
    }

    /**
     * Set seed value
     * Note: Ran1 uses NEGATIVE seeds for initialization (Numerical Recipes convention)
     * Positive seed value here will be negated during initialization
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to integer (big-endian)
      let seedValue = 0;
      for (let i = 0; i < seedBytes.length; ++i) {
        seedValue = OpCodes.OrN(seedValue * 256, seedBytes[i]);
      }

      // Ensure seed is valid (Ran1 expects negative for init, but we store positive)
      if (seedValue < 1) {
        seedValue = 1;
      }

      // Store seed (will be negated during initialization)
      this._seedValue = seedValue;
      this._initialized = false; // Mark for lazy initialization
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Initialize the Ran1 generator
     * Based on the reference implementation from Numerical Recipes
     */
    _initialize() {
      // Negate seed for initialization (Numerical Recipes convention)
      this._idum = -this._seedValue;

      // Ensure positive seed value (Numerical Recipes handles both cases)
      if (this._idum < 0) {
        this._idum = -this._idum;
      }
      if (this._idum < 1) {
        this._idum = 1;
      }

      // Initialize shuffle table with 8 warm-up iterations + NTAB values
      for (let j = this.NTAB + 7; j >= 0; --j) {
        // Schrage's method: compute (IA * idum) mod IM
        const k = Math.floor(this._idum / this.IQ);
        this._idum = this.IA * (this._idum - k * this.IQ) - this.IR * k;
        if (this._idum < 0) {
          this._idum += this.IM;
        }

        // After warm-up (j < NTAB), fill shuffle table
        if (j < this.NTAB) {
          this._iv[j] = this._idum;
        }
      }

      // Initialize last output with first shuffle table entry
      this._iy = this._iv[0];
      this._initialized = true;
    }

    /**
     * Generate next random value (single precision float)
     * Returns value in range [0.0, 1.0) with RNMX clipping
     */
    _next() {
      if (!this._ready) {
        throw new Error('Ran1 not initialized: set seed first');
      }

      // Lazy initialization
      if (!this._initialized) {
        this._initialize();
      }

      // Compute next value using Schrage's method
      const k = Math.floor(this._idum / this.IQ);
      this._idum = this.IA * (this._idum - k * this.IQ) - this.IR * k;
      if (this._idum < 0) {
        this._idum += this.IM;
      }

      // Bays-Durham shuffle: select index from shuffle table
      const j = Math.floor(this._iy / this.NDIV);

      // Output value from shuffle table (will be used next time)
      this._iy = this._iv[j];

      // Refill shuffle table with fresh random value
      this._iv[j] = this._idum;

      // Convert to floating point in range [0.0, 1.0)
      let temp = this.AM * this._iy;

      // Ensure result is strictly less than 1.0 (endpoint exclusion)
      if (temp > this.RNMX) {
        return this.RNMX;
      }
      return temp;
    }

    /**
     * Generate random bytes
     * Outputs single-precision IEEE 754 values (4 bytes each)
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Ran1 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate single-precision float values (4 bytes each)
      while (output.length < length) {
        const value = this._next();

        // Convert float to IEEE 754 binary representation (little-endian)
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setFloat32(0, value, true); // true = little-endian

        // Extract bytes
        for (let i = 0; i < 4 && output.length < length; ++i) {
          output.push(view.getUint8(i));
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed is typically not used (deterministic)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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
  const algorithmInstance = new Ran1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Ran1Algorithm, Ran1Instance };
}));
