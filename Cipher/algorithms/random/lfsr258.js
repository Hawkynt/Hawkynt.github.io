/*
 * LFSR258 - Combined Linear Feedback Shift Register (Tausworthe PRNG)
 * By Pierre L'Ecuyer (1999)
 *
 * LFSR258 is a high-quality pseudo-random number generator that combines five
 * 64-bit Tausworthe Linear Feedback Shift Register (LFSR) generators using XOR.
 * The period length is approximately 2^258, making it suitable for extensive
 * Monte Carlo simulations and statistical testing.
 *
 * The algorithm uses five components with different periods:
 * - Component z1: period 2^63 - 1
 * - Component z2: period 2^55 - 1
 * - Component z3: period 2^52 - 1
 * - Component z4: period 2^47 - 1
 * - Component z5: period 2^41 - 1
 *
 * Combined period: approximately 2^258
 *
 * Each component uses left shift and right shift operations combined with XOR
 * to generate pseudo-random bits. The five components are XORed together to
 * produce the final output.
 *
 * LFSR258 is used in the TestU01 statistical testing suite and has excellent
 * statistical properties. It is significantly better than LFSR113 due to the
 * longer periods of individual components.
 *
 * SECURITY WARNING: LFSR-based generators are NOT cryptographically secure.
 * They should only be used for:
 * - Statistical simulations
 * - Monte Carlo methods
 * - Non-cryptographic applications
 * - Educational purposes
 *
 * References:
 * - L'Ecuyer, P. "Tables of Maximally Equidistributed Combined LFSR Generators"
 *   Mathematics of Computation, 68(225):261-269, 1999
 *   https://www.iro.umontreal.ca/~lecuyer/myftp/papers/comblfsr3.pdf
 * - L'Ecuyer, P., Simard, R. "TestU01: A C library for empirical testing of
 *   random number generators" ACM Trans. Math. Softw. 33(4), 2007
 * - SSJ: Stochastic Simulation in Java
 *   https://github.com/umontreal-simul/ssj
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

  class LFSR258Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LFSR258";
      this.description = "Combined Linear Feedback Shift Register using five 64-bit Tausworthe components with extremely long period (2^258). Developed for the TestU01 statistical testing suite with superior quality to LFSR113. Uses BigInt for 64-bit arithmetic in JavaScript.";
      this.inventor = "Pierre L'Ecuyer";
      this.year = 1999;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Tausworthe LFSR";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CA;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(40, 40, 1)]; // 5 x 8 bytes = 40 bytes

      // Documentation
      this.documentation = [
        new LinkItem(
          "L'Ecuyer: Tables of Maximally Equidistributed Combined LFSR Generators (1999)",
          "https://www.iro.umontreal.ca/~lecuyer/myftp/papers/comblfsr3.pdf"
        ),
        new LinkItem(
          "TestU01: Statistical Testing Library",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "L'Ecuyer&Simard: TestU01 Paper (2007)",
          "https://dl.acm.org/doi/10.1145/1268776.1268777"
        ),
        new LinkItem(
          "SSJ Library - LFSR258 Reference Implementation",
          "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java"
        )
      ];

      this.references = [
        new LinkItem(
          "Mathematics of Computation: Combined LFSR Generators",
          "https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/"
        ),
        new LinkItem(
          "L'Ecuyer: Uniform Random Number Generation (1994)",
          "https://www.iro.umontreal.ca/~lecuyer/myftp/papers/handstat.pdf"
        )
      ];

      // Test vectors from reference implementation
      // Generated using SSJ library implementation
      // https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java
      this.tests = [
        {
          text: "Default seed (123456789123456789 for all 5 components) - First 8 bytes",
          uri: "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("01B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F15"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("456E698A9B4E9CF5")
        },
        {
          text: "Default seed (123456789123456789 for all 5 components) - First 16 bytes",
          uri: "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("01B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F15"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("456E698A9B4E9CF59B773DED05A86848")
        },
        {
          text: "Custom seed [12345, 23456, 34567, 131072, 8388608] - First 8 bytes",
          uri: "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000030390000000000005BA0000000000000870700000000000200000000000000800000"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("0011000083000080")
        },
        {
          text: "Minimum valid seeds [2, 512, 4096, 131072, 8388608] - First 8 bytes",
          uri: "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000020000000000000200000000000000100000000000000200000000000000800000"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("0003000080000080")
        },
        {
          text: "Maximum seeds (all 0xFFFFFFFFFFFFFFFF) - First 8 bytes",
          uri: "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("C3EFFFFF80FFFF7F")
        },
        {
          text: "Default seed - First 32 bytes (sequence test)",
          uri: "https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("01B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F1501B69B4BACD05F15"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("456E698A9B4E9CF59B773DED05A8684851A18DE9815FFD298274805F0797F5F3")
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
      return new LFSR258Instance(this);
    }
  }

  /**
 * LFSR258 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LFSR258Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Default seed from SSJ library: 123456789123456789 for all components
      this._z0 = 123456789123456789n;
      this._z1 = 123456789123456789n;
      this._z2 = 123456789123456789n;
      this._z3 = 123456789123456789n;
      this._z4 = 123456789123456789n;

      this._ready = false;
      this._outputSize = 32; // Default output size
    }

    /**
     * Set seed value (40 bytes = 5 x 8-byte BigInt values)
     * Seed format: [z0 (8 bytes), z1 (8 bytes), z2 (8 bytes), z3 (8 bytes), z4 (8 bytes)]
     *
     * Seed requirements (as specified in L'Ecuyer's paper):
     * - z0 >= 2
     * - z1 >= 512
     * - z2 >= 4096
     * - z3 >= 131072
     * - z4 >= 8388608
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Expect 40 bytes (5 x 8 bytes for each 64-bit component)
      if (seedBytes.length !== 40) {
        throw new Error('LFSR258 requires exactly 40 bytes of seed (5 x 8-byte components)');
      }

      // Unpack 5 x 64-bit values (big-endian)
      this._z0 = this._bytesToBigInt64(seedBytes.slice(0, 8));
      this._z1 = this._bytesToBigInt64(seedBytes.slice(8, 16));
      this._z2 = this._bytesToBigInt64(seedBytes.slice(16, 24));
      this._z3 = this._bytesToBigInt64(seedBytes.slice(24, 32));
      this._z4 = this._bytesToBigInt64(seedBytes.slice(32, 40));

      // Validate minimum seed requirements
      if (this._z0 < 2n) {
        throw new Error('LFSR258 seed component z0 must be >= 2');
      }
      if (this._z1 < 512n) {
        throw new Error('LFSR258 seed component z1 must be >= 512');
      }
      if (this._z2 < 4096n) {
        throw new Error('LFSR258 seed component z2 must be >= 4096');
      }
      if (this._z3 < 131072n) {
        throw new Error('LFSR258 seed component z3 must be >= 131072');
      }
      if (this._z4 < 8388608n) {
        throw new Error('LFSR258 seed component z4 must be >= 8388608');
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Convert 8 bytes to unsigned 64-bit BigInt (big-endian)
     */
    _bytesToBigInt64(bytes) {
      let result = 0n;
      for (let i = 0; i < 8; ++i) {
        result = OpCodes.OrN(result << 8n, BigInt(OpCodes.ToByte(bytes[i])));
      }
      return OpCodes.AndN(result, 0xFFFFFFFFFFFFFFFFn);
    }

    /**
     * Convert 64-bit BigInt to 8 bytes (big-endian)
     */
    _bigInt64ToBytes(value) {
      const bytes = [];
      let val = OpCodes.AndN(value, 0xFFFFFFFFFFFFFFFFn);
      for (let i = 7; i >= 0; --i) {
        bytes[i] = Number(OpCodes.AndN(val, 0xFFn));
        val >>= 8n;
      }
      return bytes;
    }

    /**
     * Generate next 64-bit pseudo-random value
     * Implements the exact algorithm from L'Ecuyer's LFSR258 specification
     */
    _nextNumber() {
      if (!this._ready) {
        throw new Error('LFSR258 not initialized: set seed first');
      }

      // Component 0: period 2^63 - 1
      let b = OpCodes.XorN(this._z0 << 1n, this._z0) >> 53n;
      this._z0 = OpCodes.XorN(OpCodes.AndN(this._z0, 0xFFFFFFFFFFFFFFFEn) << 10n, b);

      // Component 1: period 2^55 - 1
      b = OpCodes.XorN(this._z1 << 24n, this._z1) >> 50n;
      this._z1 = OpCodes.XorN(OpCodes.AndN(this._z1, 0xFFFFFFFFFFFFFE00n) << 5n, b);

      // Component 2: period 2^52 - 1
      b = OpCodes.XorN(this._z2 << 3n, this._z2) >> 23n;
      this._z2 = OpCodes.XorN(OpCodes.AndN(this._z2, 0xFFFFFFFFFFFFF000n) << 29n, b);

      // Component 3: period 2^47 - 1
      b = OpCodes.XorN(this._z3 << 5n, this._z3) >> 24n;
      this._z3 = OpCodes.XorN(OpCodes.AndN(this._z3, 0xFFFFFFFFFFFE0000n) << 23n, b);

      // Component 4: period 2^41 - 1
      b = OpCodes.XorN(this._z4 << 3n, this._z4) >> 33n;
      this._z4 = OpCodes.XorN(OpCodes.AndN(this._z4, 0xFFFFFFFFFF800000n) << 8n, b);

      // XOR all components and mask to 64 bits
      const result = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(this._z0, this._z1), this._z2), this._z3), this._z4), 0xFFFFFFFFFFFFFFFFn);
      return result;
    }

    /**
     * Generate 32-bit pseudo-random value
     * Takes upper 32 bits of 64-bit result (matching Java implementation)
     */
    _next32() {
      const value64 = this._nextNumber();
      return Number(OpCodes.AndN(value64 >> 32n, 0xFFFFFFFFn));
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('LFSR258 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let remaining = length;

      // Generate in 4-byte (32-bit) chunks
      while (remaining > 0) {
        const value = this._next32();
        const chunk = Math.min(4, remaining);

        // Pack bytes in little-endian order (LSB first)
        for (let i = 0; i < chunk; ++i) {
          output.push(OpCodes.ToByte(value >>> (i * 8)));
        }

        remaining -= chunk;
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
      // For PRNG, Feed is not used (no input data to process)
      // Could be extended to support re-seeding or mixing
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
  const algorithmInstance = new LFSR258Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LFSR258Algorithm, LFSR258Instance };
}));
