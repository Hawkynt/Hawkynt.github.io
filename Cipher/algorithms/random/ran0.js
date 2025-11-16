/*
 * Ran0 (Park-Miller Minimal Standard from Numerical Recipes)
 * By Stephen K. Park and Keith W. Miller (1988)
 * From Numerical Recipes in C (Press et al., 1992)
 *
 * Minimal standard multiplicative linear congruential generator.
 * Uses Schrage's method to avoid overflow: X(n+1) = (a × X(n)) mod m
 * where a=16807 (7^5) and m=2^31-1 (Mersenne prime M31)
 *
 * This is the simplest form from Numerical Recipes Chapter 7.
 * For better generators, see Ran2 or Ran3 from the same source.
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

  // Ran0 constants (Park-Miller minimal standard from Numerical Recipes)
  const IA = 16807;              // Multiplier a = 7^5
  const IM = 2147483647;         // Modulus m = 2^31 - 1 (Mersenne prime M31)
  const AM = 1.0 / IM;           // Floating point scaling factor
  const IQ = 127773;             // Quotient q = m div a (for Schrage's method)
  const IR = 2836;               // Remainder r = m mod a (for Schrage's method)

  class Ran0Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Ran0 (Numerical Recipes)";
      this.description = "Park-Miller minimal standard PRNG from Numerical Recipes. Simple multiplicative linear congruential generator using Schrage's method to compute (16807 × seed) mod (2^31-1) without overflow. Returns floating-point values in [0.0, 1.0). Superseded by Ran2 and Ran3, but useful for educational purposes and as a reference implementation.";
      this.inventor = "Stephen K. Park and Keith W. Miller";
      this.year = 1988;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Linear Congruential Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (converts to 32-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Numerical Recipes in C: The Art of Scientific Computing (2nd Ed.), Section 7.1",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "Park and Miller (1988): Random Number Generators: Good Ones Are Hard to Find",
          "https://doi.org/10.1145/63039.63042"
        ),
        new LinkItem(
          "Wikipedia: Lehmer Random Number Generator",
          "https://en.wikipedia.org/wiki/Lehmer_random_number_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "Press et al., Numerical Recipes in C (1992), pp. 278-286",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "Park and Miller, CACM 31(10):1192-1201 (1988)",
          "https://doi.org/10.1145/63039.63042"
        ),
        new LinkItem(
          "Numerical Recipes Legacy Code Repository",
          "http://numerical.recipes/routines/instc.html"
        )
      ];

      // Test vectors from Numerical Recipes and Park-Miller 1988 paper
      // All test vectors verified against reference implementation
      this.tests = [
        {
          text: "Seed=1: First 10 output values (floating-point doubles)",
          uri: "http://numerical.recipes/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 80, // 10 × 8 bytes (IEEE 754 double precision)
          // Expected values (verified from reference implementation):
          // 0.00000782637, 0.13153778814, 0.75560532220, 0.45865013192, 0.53276723741,
          // 0.21895918633, 0.04704461621, 0.67886471687, 0.67929640584, 0.93469289594
          expected: OpCodes.Hex8ToBytes(
            "80D32000C069E03E76AC21F13AD6C03FD65B7036EB2DE83F0CB53A15865ADD3F" +
            "DC18A2E06D0CE13FB60D38C8DA06CC3F772C30603B16A83F8572AB7F42B9E53F" +
            "9879EBD0CBBCE53F02D27B1301E9ED3F"
          )
        },
        {
          text: "Seed=123456789: First 5 output values",
          uri: "http://numerical.recipes/",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15"), // 123456789 in big-endian
          outputSize: 40, // 5 × 8 bytes
          // Expected values (verified from reference):
          // 0.21841829699, 0.95631757656, 0.82950923398, 0.56169544280, 0.41530708150
          expected: OpCodes.Hex8ToBytes(
            "43EA377921F5CB3F4F347D51279AEE3FAE16F5F2568BEA3FD1F2A3B868F9E13F" +
            "C82835276494DA3F"
          )
        },
        {
          text: "Park-Miller canonical test: 10,000th iteration from seed=1",
          uri: "https://doi.org/10.1145/63039.63042",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          count: 10000, // Skip to 10,000th value
          outputSize: 8,
          // 10,000th value = 1043618065 → as float: 0.48597253183
          expected: OpCodes.Hex8ToBytes("5934BE882C1ADF3F")
        },
        {
          text: "Seed=16807 (multiplier a): First value",
          uri: "http://numerical.recipes/",
          input: null,
          seed: OpCodes.Hex8ToBytes("000041A7"), // 16807 (the multiplier)
          outputSize: 8,
          // (16807 × 16807) mod 2147483647 = 282475249 → as float: 0.13153778814
          expected: OpCodes.Hex8ToBytes("76AC21F13AD6C03F")
        },
        {
          text: "Seed=2147483646 (max valid seed): First value",
          uri: "https://doi.org/10.1145/63039.63042",
          input: null,
          seed: OpCodes.Hex8ToBytes("7FFFFFFE"), // IM-1 (maximum valid seed)
          outputSize: 8,
          // (16807 × 2147483646) mod 2147483647 = 2147466840 → as float: 0.99999217363
          expected: OpCodes.Hex8ToBytes("DFFF3F96EFFFEF3F")
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
      return new Ran0Instance(this);
    }
  }

  /**
 * Ran0 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Ran0Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ran0 state (seed value, must be in range [1, IM-1])
      this._idum = 0;
      this._ready = false;

      // Optional count for skipping to nth value (for testing)
      this._skipCount = null;
    }

    /**
     * Set seed value
     * Must be in range [1, IM-1] = [1, 2147483646]
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 32-bit integer (big-endian)
      let seedValue = 0;
      for (let i = 0; i < seedBytes.length && i < 4; ++i) {
        seedValue = OpCodes.OrN(seedValue * 256, seedBytes[i]);
      }

      // Ensure seed is in valid range [1, IM-1]
      if (seedValue === 0 || seedValue >= IM) {
        seedValue = 1;
      }

      this._idum = seedValue;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve original seed from PRNG state
    }

    /**
     * Set count parameter for skipping to nth value (testing purposes)
     */
    set count(value) {
      this._skipCount = value;
    }

    get count() {
      return this._skipCount || 0;
    }

    /**
     * Generate next random value using Schrage's method
     *
     * Schrage's method computes (a × x) mod m without 32-bit overflow:
     * m = qa + r  where q = floor(m/a), r = m mod a
     * Then: (a × x) mod m = a(x mod q) - r × floor(x/q)  (with adjustment if negative)
     *
     * For Ran0: a=16807, m=2147483647, q=127773, r=2836
     *
     * @returns {number} Random float in range [0.0, 1.0)
     */
    _next() {
      if (!this._ready) {
        throw new Error('Ran0 not initialized: set seed first');
      }

      // Schrage's method from Numerical Recipes
      const k = (this._idum / IQ) | 0;  // k = floor(idum / IQ)
      this._idum = IA * (this._idum - k * IQ) - IR * k;

      if (this._idum < 0) {
        this._idum += IM;
      }

      // Convert to floating point in range [0.0, 1.0)
      return AM * this._idum;
    }

    /**
     * Generate random bytes
     * Outputs IEEE 754 double-precision floats (8 bytes each)
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Ran0 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      // If count is set, skip ahead to the nth value (for testing)
      if (this._skipCount && this._skipCount > 1) {
        for (let i = 1; i < this._skipCount; ++i) {
          this._next();
        }
        this._skipCount = null; // Clear after use
      }

      const output = [];

      // Generate double-precision values (8 bytes each)
      while (output.length < length) {
        const value = this._next();

        // Convert double to IEEE 754 binary representation (little-endian)
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
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed is not used (Ran0 is deterministic based on seed)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes (4 doubles)
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
  const algorithmInstance = new Ran0Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Ran0Algorithm, Ran0Instance };
}));
