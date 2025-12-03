/*
 * Lehmer RNG (Park-Miller Minimal Standard)
 * By D. H. Lehmer (1951), refined by Park & Miller (1988)
 *
 * Pure multiplicative LCG using Schrage's method to avoid overflow
 * X(n+1) = (a × X(n)) mod m where a=16807, m=2^31-1
 * Also known as MINSTD or Park-Miller minimal standard generator
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

  // MINSTD constants (Park-Miller minimal standard)
  const MULTIPLIER = 16807;      // a = 7^5
  const MODULUS = 2147483647;    // m = 2^31 - 1 (Mersenne prime M31)
  const QUOTIENT = 127773;       // q = m div a
  const REMAINDER = 2836;        // r = m mod a

  class LehmerAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lehmer RNG (Park-Miller)";
      this.description = "A multiplicative linear congruential generator using the Park-Miller minimal standard parameters. Uses Schrage's method to avoid overflow with the recurrence X(n+1) = (16807 × X(n)) mod (2^31-1). Despite being a minimal standard in 1988, it has known statistical weaknesses and should only be used for educational purposes.";
      this.inventor = "D. H. Lehmer (refined by Park & Miller)";
      this.year = 1951;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Linear Congruential Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(4, 4, 1)]; // 32-bit seed (1 to 2^31-2)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Park & Miller (1988): Random Number Generators: Good Ones Are Hard to Find",
          "https://doi.org/10.1145/63039.63042"
        ),
        new LinkItem(
          "Wikipedia: Lehmer Random Number Generator",
          "https://en.wikipedia.org/wiki/Lehmer_random_number_generator"
        ),
        new LinkItem(
          "Schrage's Method Explanation",
          "https://craftofcoding.wordpress.com/2021/07/05/demystifying-random-numbers-schrages-method/"
        )
      ];

      this.references = [
        new LinkItem(
          "Communications of the ACM, Vol 31, No 10 (1988)",
          "https://doi.org/10.1145/63039.63042"
        ),
        new LinkItem(
          "Numerical Recipes in C (2nd Edition, 1992), p.279",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "C++ std::minstd_rand0 reference implementation",
          "https://en.cppreference.com/w/cpp/numeric/random/linear_congruential_engine"
        ),
        new LinkItem(
          "stdlib-js MINSTD implementation",
          "https://github.com/stdlib-js/random-base-minstd"
        )
      ];

      // Test vectors from official Park & Miller 1988 paper
      // Source: "Random Number Generators: Good Ones Are Hard to Find"
      // The canonical test: seed=1, after 10,000 iterations yields 1043618065
      this.tests = [
        {
          text: "Park-Miller 1988: First 10 values from seed=1",
          uri: "https://doi.org/10.1145/63039.63042",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          outputSize: 40, // 10 × 4 bytes = 40 bytes
          expected: OpCodes.Hex8ToBytes("000041A710D63AF160B7ACD93AB50C2A4431B7821C06DAC806058ED856E509FE56F32F4377A4044D")
          // Decimal values: 16807, 282475249, 1622650073, 984943658, 1144108930,
          //                 470211272, 101027544, 1457850878, 1458777923, 2007237709
        },
        {
          text: "Park-Miller 1988 canonical test: 10,000th iteration from seed=1 = 1043618065",
          uri: "https://doi.org/10.1145/63039.63042",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          count: 10000, // Generate 10,000 values
          outputSize: 4, // Return only the 10,000th value
          expected: OpCodes.Hex8ToBytes("3E345911") // 1043618065 (canonical test value)
        },
        {
          text: "Park-Miller: Seed=123456789, first 5 values",
          uri: "https://github.com/stdlib-js/random-base-minstd",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15"), // seed = 123456789
          outputSize: 20, // 5 × 4 bytes
          expected: OpCodes.Hex8ToBytes("1BF521797A689D456A2D5BCB47E5A2E23528C84E")
          // Decimal: 469049721, 2053676357, 1781357515, 1206231778, 891865166
        },
        {
          text: "Park-Miller: Seed=2147483646 (max seed), first value",
          uri: "https://doi.org/10.1145/63039.63042",
          input: null,
          seed: OpCodes.Hex8ToBytes("7FFFFFFE"), // seed = 2147483646 (m-1, maximum valid seed)
          outputSize: 4,
          expected: OpCodes.Hex8ToBytes("7FFFBE58") // 2147466840 = (16807 × 2147483646) mod 2147483647
        },
        {
          text: "Park-Miller: Seed=16807 (a), first value",
          uri: "https://doi.org/10.1145/63039.63042",
          input: null,
          seed: OpCodes.Hex8ToBytes("000041A7"), // seed = 16807 (the multiplier itself)
          outputSize: 4,
          expected: OpCodes.Hex8ToBytes("10D63AF1") // 282475249 = (16807 × 16807) mod 2147483647
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
      return new LehmerInstance(this);
    }
  }

  /**
 * Lehmer cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LehmerInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Lehmer RNG state (must be in range [1, MODULUS-1])
      this._state = 1;
      this._ready = false;

      // Optional count for skipping ahead to nth value
      this._skipCount = null;
    }

    /**
     * Set seed value (must be 1 to 2147483646)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 32-bit integer (big-endian)
      let seedValue = 0;
      for (let i = 0; i < seedBytes.length && i < 4; ++i) {
        seedValue = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(seedValue, 8), seedBytes[i]));
      }

      // Validate seed is in valid range [1, MODULUS-1]
      if (seedValue < 1 || seedValue >= MODULUS) {
        throw new Error('Lehmer RNG seed must be in range [1, 2147483646]');
      }

      this._state = OpCodes.ToUint32(seedValue); // Ensure unsigned 32-bit
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set count parameter (for skipping ahead to nth value)
     */
    set count(skipCount) {
      this._skipCount = skipCount;
    }

    get count() {
      return this._skipCount || 0;
    }

    /**
     * Generate next value using Schrage's method to avoid overflow
     *
     * Schrage's method computes (a × x) mod m without overflow:
     * Given m = qa + r where q = ⌊m/a⌋ and r = m mod a
     * Then: (a × x) mod m = a(x mod q) - r⌊x/q⌋ (mod m)
     *
     * For MINSTD: a=16807, m=2147483647, q=127773, r=2836
     *
     * @returns {number} Next random value in range [1, 2147483646]
     */
    _next() {
      if (!this._ready) {
        throw new Error('Lehmer RNG not initialized: set seed first');
      }

      // Schrage's method to compute (16807 × state) mod 2147483647
      const hi = Math.floor(this._state / QUOTIENT); // ⌊state/q⌋ using integer truncation
      const lo = this._state % QUOTIENT;       // state mod q

      let test = MULTIPLIER * lo - REMAINDER * hi; // a×lo - r×hi

      if (test > 0) {
        this._state = test;
      } else {
        this._state = test + MODULUS;                // Adjust if negative
      }

      return this._state;
    }

    /**
     * Generate random bytes
     * Outputs 32-bit values (big-endian) in range [1, 2147483646]
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Lehmer RNG not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      // If count is set, skip ahead to the nth value
      if (this._skipCount && this._skipCount > 1) {
        for (let i = 1; i < this._skipCount; ++i) {
          this._next();
        }
        this._skipCount = null; // Clear after use
      }

      const output = [];

      // Generate values and pack as 32-bit big-endian
      while (output.length < length) {
        const value = this._next();
        const bytes = OpCodes.Unpack32BE(value);

        for (let i = 0; i < 4 && output.length < length; ++i) {
          output.push(bytes[i]);
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
      // For PRNG, Feed is typically not used (Lehmer RNG is deterministic)
      // Could be used for reseeding if needed
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
  const algorithmInstance = new LehmerAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LehmerAlgorithm, LehmerInstance };
}));
