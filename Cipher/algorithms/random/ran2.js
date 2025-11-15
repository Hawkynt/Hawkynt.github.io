/*
 * Ran2 (Numerical Recipes Combined LCG)
 * By William H. Press, Saul A. Teukolsky, William T. Vetterling, Brian P. Flannery (1988)
 * Based on the reference implementation from Numerical Recipes in C
 *
 * Combined linear congruential generator with Bays-Durham shuffle.
 * Long period (~2.3 × 10^18) random number generator.
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

  class Ran2Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Ran2 (Numerical Recipes)";
      this.description = "Combined linear congruential generator with Bays-Durham shuffle from Numerical Recipes. Uses two LCGs with moduli 2147483563 and 2147483399, combined with a 32-entry shuffle table. Long period (~2.3 × 10^18) makes it suitable for Monte Carlo simulations. Returns uniform deviates in range [0.0, 1.0).";
      this.inventor = "William H. Press, Saul A. Teukolsky, William T. Vetterling, Brian P. Flannery";
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
          "Ran2 Reference Implementation (GitHub)",
          "https://github.com/sharpee/mid/blob/master/mid/ran2.c"
        ),
        new LinkItem(
          "L'Ecuyer, P. (1988): Efficient and Portable Combined Random Number Generators",
          "https://www.iro.umontreal.ca/~lecuyer/myftp/papers/cacm88.pdf"
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
          "GNU Scientific Library - Numerical Recipes generators",
          "https://www.math.utah.edu/software/gsl/gsl-ref_254.html"
        )
      ];

      // Test vectors from reference C implementation
      // Verified by compiling and running original Numerical Recipes code
      // Output format: 8-byte IEEE 754 double-precision floats (little-endian)
      this.tests = [
        {
          text: "Seed=-1 (initializes to 1) - First 10 double values",
          uri: "https://github.com/sharpee/mid/blob/master/mid/ran2.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"), // seed = 1 (negated during init)
          outputSize: 80, // 10 x 8 bytes (double precision)
          // Values verified from reference implementation:
          // 0.2853808991, 0.2533581893, 0.09346853101, 0.6084968907, 0.9034202601,
          // 0.1958731928, 0.462953543, 0.9390213302, 0.1272157551, 0.4159311035
          expected: OpCodes.Hex8ToBytes("B6F1203FAE43D23F7F8944440537D03F1FC0E3BB8DEDB73F1C39AE78CE78E33F319BF29AD1E8EC3F5F33A66E5F12C93F3EEFACE507A1DD3FAA46F475760CEE3FFF36D0199B48C03F9554AD7D9D9EDA3F")
        },
        {
          text: "Seed=-12345 - First 10 double values",
          uri: "https://github.com/sharpee/mid/blob/master/mid/ran2.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3039"), // seed = 12345 (negated during init)
          outputSize: 80,
          // Values verified from reference implementation:
          // 0.02719932390, 0.05895277625, 0.2391678683, 0.02434943014, 0.1149896056,
          // 0.7011819168, 0.6039509626, 0.427812955, 0.7528682039, 0.4092800812
          expected: OpCodes.Hex8ToBytes("BADB7EBA23DA9B3FE93F0BEC0E2FAE3FF64A547E0D9DCE3FB1BF8E980EEF983FFF588C73F56FBD3FFC6D260F1570E63F457E15F89053E33FDE9AAE964961DB3F609A3F0F7F17E83FA0F7E414A531DA3F")
        },
        {
          text: "Seed=-123456789 - First 10 double values",
          uri: "https://github.com/sharpee/mid/blob/master/mid/ran2.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15"), // seed = 123456789 (negated during init)
          outputSize: 80,
          // Values verified from reference implementation:
          // 0.2680716337, 0.841096252, 0.4347236533, 0.3381003275, 0.05734157417,
          // 0.7284026821, 0.1289584408, 0.3750245468, 0.5507592283, 0.2528277312
          expected: OpCodes.Hex8ToBytes("8F9EE4EC1528D13F4990DFAF42EAEA3F19CB792883D2DB3F14885E8E6FA3D53FB8027FF3DF5BAD3FB6823A24134FE73FBB22F6CEB581C03F5F44F0F46600D83F552134D1D19FE13F06C43E5D542ED03F")
        },
        {
          text: "Seed=-1 - First value only (initialization test)",
          uri: "https://github.com/sharpee/mid/blob/master/mid/ran2.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"),
          outputSize: 8,
          // First value: 0.2853808991
          expected: OpCodes.Hex8ToBytes("B6F1203FAE43D23F")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new Ran2Instance(this);
    }
  }

  class Ran2Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ran2 constants from Numerical Recipes
      this.IM1 = 2147483563;      // First modulus
      this.IM2 = 2147483399;      // Second modulus
      this.AM = 1.0 / this.IM1;   // Scaling factor
      this.IMM1 = this.IM1 - 1;   // IM1 - 1
      this.IA1 = 40014;           // First multiplier
      this.IA2 = 40692;           // Second multiplier
      this.IQ1 = 53668;           // IM1 div IA1
      this.IQ2 = 52774;           // IM2 div IA2
      this.IR1 = 12211;           // IM1 mod IA1
      this.IR2 = 3791;            // IM2 mod IA2
      this.NTAB = 32;             // Shuffle table size
      this.NDIV = 1 + Math.floor(this.IMM1 / this.NTAB);
      this.EPS = 1.2e-7;
      this.RNMX = 1.0 - this.EPS;

      // State variables
      this._idum = 0;             // Primary LCG state
      this._idum2 = 123456789;    // Secondary LCG state
      this._iy = 0;               // Last output from shuffle table
      this._iv = new Array(this.NTAB).fill(0); // Shuffle table

      this._initialized = false;
      this._ready = false;
    }

    /**
     * Set seed value
     * Note: Ran2 uses NEGATIVE seeds for initialization
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

      // Ensure seed is valid (Ran2 expects negative for init, but we store positive)
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
     * Initialize the Ran2 generator
     * Based on the reference implementation from Numerical Recipes
     */
    _initialize() {
      // Negate seed for initialization (Ran2 convention)
      this._idum = -this._seedValue;

      // Ensure positive seed value
      if (-this._idum < 1) {
        this._idum = 1;
      } else {
        this._idum = -this._idum;
      }

      // Initialize second generator with same seed
      this._idum2 = this._idum;

      // Load the shuffle table (after 8 warm-ups)
      for (let j = this.NTAB + 7; j >= 0; --j) {
        const k = Math.floor(this._idum / this.IQ1);
        this._idum = this.IA1 * (this._idum - k * this.IQ1) - k * this.IR1;
        if (this._idum < 0) {
          this._idum += this.IM1;
        }
        if (j < this.NTAB) {
          this._iv[j] = this._idum;
        }
      }

      // Initialize last output
      this._iy = this._iv[0];
      this._initialized = true;
    }

    /**
     * Generate next random value (double precision)
     * Returns value in range [0.0, 1.0)
     */
    _next() {
      if (!this._ready) {
        throw new Error('Ran2 not initialized: set seed first');
      }

      // Lazy initialization
      if (!this._initialized) {
        this._initialize();
      }

      // Compute idum = (IA1 * idum) % IM1 using Schrage's method
      let k = Math.floor(this._idum / this.IQ1);
      this._idum = this.IA1 * (this._idum - k * this.IQ1) - k * this.IR1;
      if (this._idum < 0) {
        this._idum += this.IM1;
      }

      // Compute idum2 = (IA2 * idum2) % IM2 using Schrage's method
      k = Math.floor(this._idum2 / this.IQ2);
      this._idum2 = this.IA2 * (this._idum2 - k * this.IQ2) - k * this.IR2;
      if (this._idum2 < 0) {
        this._idum2 += this.IM2;
      }

      // Select index in shuffle table
      const j = Math.floor(this._iy / this.NDIV);

      // Combine outputs: iy = iv[j] - idum2
      this._iy = this._iv[j] - this._idum2;

      // Update shuffle table with fresh value
      this._iv[j] = this._idum;

      // Ensure output is in valid range [1, IMM1]
      if (this._iy < 1) {
        this._iy += this.IMM1;
      }

      // Convert to floating point in range [0.0, 1.0)
      let temp = this.AM * this._iy;
      if (temp > this.RNMX) {
        return this.RNMX;
      }
      return temp;
    }

    /**
     * Generate random bytes
     * Outputs double-precision IEEE 754 values (8 bytes each)
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Ran2 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate double-precision values (8 bytes each)
      while (output.length < length) {
        const value = this._next();

        // Convert double to IEEE 754 binary representation (little-endian)
        // JavaScript stores doubles as IEEE 754 internally
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, value, true); // true = little-endian

        // Extract bytes
        for (let i = 0; i < 8 && output.length < length; ++i) {
          output.push(view.getUint8(i));
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is typically not used (deterministic)
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
  const algorithmInstance = new Ran2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Ran2Algorithm, Ran2Instance };
}));
