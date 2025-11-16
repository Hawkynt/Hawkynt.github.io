/*
 * Ran3 (Numerical Recipes Subtractive Generator)
 * By Donald Knuth (1981), adapted by William H. Press et al. (1988)
 * Based on Knuth's subtractive method from TAOCP Volume 2
 *
 * Subtractive random number generator with shuffling.
 * Period approximately 2 × 10^18.
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

  class Ran3Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Ran3 (Numerical Recipes)";
      this.description = "Subtractive random number generator from Numerical Recipes based on Knuth's algorithm. Uses 55-element state array with subtractive method (MA[i] = MA[i-55] - MA[i-31]) and initialization based on golden ratio constant MSEED=161803398. Period approximately 2 × 10^18. Returns uniform deviates in range [0.0, 1.0).";
      this.inventor = "Donald Knuth (subtractive method), adapted by William H. Press, Saul A. Teukolsky, William T. Vetterling, Brian P. Flannery";
      this.year = 1981;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Subtractive Generator";
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
          "Knuth, D.E.: The Art of Computer Programming, Vol 2 (Seminumerical Algorithms)",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "Ran3 Reference Implementation (GitHub)",
          "https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c"
        )
      ];

      this.references = [
        new LinkItem(
          "Numerical Recipes Legacy Code",
          "http://numerical.recipes/routines/instc.html"
        ),
        new LinkItem(
          "Knuth, TAOCP Volume 2, Section 3.2.2 (Algorithm A)",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "Subtractive Generator - Rosetta Code",
          "https://rosettacode.org/wiki/Subtractive_generator"
        )
      ];

      // Test vectors from reference C implementation
      // Verified by compiling and running original Numerical Recipes ran3.c code
      // Output format: 4-byte IEEE 754 single-precision floats (little-endian)
      this.tests = [
        {
          text: "Seed=-1 (initializes to 1) - First 10 float values",
          uri: "https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"), // seed = 1 (negated during init)
          outputSize: 40, // 10 x 4 bytes (single precision)
          // Values verified from reference implementation:
          // 0.2982273400, 0.7151191831, 0.0330211073, 0.8743935823, 0.5341944098,
          // 0.6315862536, 0.8910297751, 0.2575476766, 0.9316351414, 0.2772463560
          expected: OpCodes.Hex8ToBytes("41B1983E0D12373F2441073D42D85F3FF7C0083FA3AF213F871A643F4ADD833EA47F6E3F3CF38D3E")
        },
        {
          text: "Seed=-12345 - First 10 float values",
          uri: "https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3039"), // seed = 12345 (negated during init)
          outputSize: 40,
          // Values verified from reference implementation:
          // 0.8606066704, 0.9254647493, 0.4180614948, 0.2896375954, 0.1422465742,
          // 0.4496120512, 0.2465265989, 0.2168676853, 0.5650326610, 0.4001483619
          expected: OpCodes.Hex8ToBytes("B8505C3F42EB6C3F280CD63E614B943E16A9113E8D33E63E78717C3E90125E3EFBA5103F3FE0CC3E")
        },
        {
          text: "Seed=-123456789 - First 10 float values",
          uri: "https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15"), // seed = 123456789 (negated during init)
          outputSize: 40,
          // Values verified from reference implementation:
          // 0.2184717655, 0.9195268154, 0.0615427606, 0.5854668617, 0.2656133175,
          // 0.3160306215, 0.1076581106, 0.6766876578, 0.2099320292, 0.8140342236
          expected: OpCodes.Hex8ToBytes("10B75F3E1C666B3F43147C3D28E1153F78FE873EC4CEA13EDB7BDC3D673B2D3F6CF8563E8C64503F")
        },
        {
          text: "Seed=-1 - First value only (initialization test)",
          uri: "https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"),
          outputSize: 4,
          // First value: 0.2982273400
          expected: OpCodes.Hex8ToBytes("41B1983E")
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
      return new Ran3Instance(this);
    }
  }

  /**
 * Ran3 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Ran3Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ran3 constants from Numerical Recipes
      this.MBIG = 1000000000;           // Modulus (1 billion)
      this.MSEED = 161803398;           // Golden ratio related seed
      this.MZ = 0;                      // Zero threshold
      this.FAC = 1.0 / this.MBIG;       // Scaling factor

      // State variables
      this._ma = new Array(56).fill(0); // State array (1-indexed, 0 unused)
      this._inext = 0;                  // First circular index
      this._inextp = 0;                 // Second circular index (offset by 31)
      this._iff = 0;                    // Initialization flag

      this._initialized = false;
      this._ready = false;
    }

    /**
     * Set seed value
     * Note: Ran3 uses NEGATIVE seeds for initialization
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

      // Ensure seed is valid
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
     * Initialize the Ran3 generator
     * Based on the reference implementation from Numerical Recipes
     */
    _initialize() {
      // Negate seed for initialization (Ran3 convention)
      let idum = -this._seedValue;

      // Mark as initialized
      this._iff = 1;

      // Compute initial mj = |MSEED - |idum|| mod MBIG
      let mj = Math.abs(this.MSEED - Math.abs(idum));
      mj = mj % this.MBIG;
      this._ma[55] = mj;

      // Initialize mk = 1
      let mk = 1;

      // Fill state array using subtractive method with permutation
      for (let i = 1; i <= 54; ++i) {
        // ii = (21 * i) % 55
        const ii = (21 * i) % 55;
        this._ma[ii] = mk;

        // Compute next mk using subtractive method
        mk = mj - mk;
        if (mk < this.MZ) {
          mk += this.MBIG;
        }

        mj = this._ma[ii];
      }

      // "Warm up" the generator by running it 4 times through the array
      for (let k = 1; k <= 4; ++k) {
        for (let i = 1; i <= 55; ++i) {
          // Subtractive: ma[i] -= ma[1 + (i+30) % 55]
          this._ma[i] -= this._ma[1 + ((i + 30) % 55)];
          if (this._ma[i] < this.MZ) {
            this._ma[i] += this.MBIG;
          }
        }
      }

      // Initialize circular indices
      this._inext = 0;
      this._inextp = 31; // Offset by 31 positions

      this._initialized = true;
    }

    /**
     * Generate next random value (single precision float)
     * Returns value in range [0.0, 1.0)
     */
    _next() {
      if (!this._ready) {
        throw new Error('Ran3 not initialized: set seed first');
      }

      // Lazy initialization
      if (!this._initialized) {
        this._initialize();
      }

      // Increment circular indices
      ++this._inext;
      if (this._inext === 56) {
        this._inext = 1;
      }

      ++this._inextp;
      if (this._inextp === 56) {
        this._inextp = 1;
      }

      // Compute new value using subtractive method
      let mj = this._ma[this._inext] - this._ma[this._inextp];
      if (mj < this.MZ) {
        mj += this.MBIG;
      }

      // Update state
      this._ma[this._inext] = mj;

      // Return normalized float value
      return mj * this.FAC;
    }

    /**
     * Generate random bytes
     * Outputs single-precision IEEE 754 values (4 bytes each)
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Ran3 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate single-precision float values (4 bytes each)
      while (output.length < length) {
        const value = this._next();

        // Convert float to IEEE 754 binary representation (little-endian)
        // JavaScript stores floats as doubles internally, need to convert to single precision
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
  const algorithmInstance = new Ran3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Ran3Algorithm, Ran3Instance };
}));
