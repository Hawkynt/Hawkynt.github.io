/*
 * LFSR113 Pseudo-Random Number Generator
 * Based on Pierre L'Ecuyer's "Tables of Maximally Equidistributed Combined LFSR Generators" (1999)
 *
 * LFSR113 combines four Tausworthe LFSR components to create a high-quality PRNG
 * with an approximate period of 2^113. This algorithm is used in the GNU Scientific
 * Library (GSL) as gsl_rng_taus113.
 *
 * Period: approximately 2^113 (combined from four components with periods 2^31-1, 2^29-1, 2^28-1, 2^25-1)
 * State: 128 bits (four 32-bit words: z1, z2, z3, z4)
 *
 * Each component uses a different primitive trinomial for maximum statistical quality:
 * - Component z1: period 2^31-1, uses trinomial with taps at bits 6, 13, 18
 * - Component z2: period 2^29-1, uses trinomial with taps at bits 2, 27
 * - Component z3: period 2^28-1, uses trinomial with taps at bits 13, 21, 7
 * - Component z4: period 2^25-1, uses trinomial with taps at bits 3, 12, 13
 *
 * The output is the XOR of all four components, providing excellent statistical
 * properties for simulation and Monte Carlo applications.
 *
 * SECURITY WARNING: LFSR113 is NOT cryptographically secure.
 * It is designed for statistical quality in simulations, not security.
 * Use only for:
 * - Scientific simulations
 * - Monte Carlo methods
 * - Statistical sampling
 * - Gaming applications
 *
 * References:
 * - L'Ecuyer, P. (1999). "Tables of Maximally Equidistributed Combined LFSR Generators"
 *   Mathematics of Computation, 68(225), 261-269
 * - GNU Scientific Library: gsl_rng_taus113 implementation
 * - TestU01: Comprehensive PRNG test suite
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

  class LFSR113Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LFSR113";
      this.description = "LFSR113 is a combined linear feedback shift register using four Tausworthe components with primitive trinomials. With a period of approximately 2^113, it provides excellent statistical quality for simulations and Monte Carlo methods. Widely used in GNU Scientific Library (GSL).";
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
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // 1-16 bytes (up to 128-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "L'Ecuyer: Tables of Maximally Equidistributed Combined LFSR Generators (1999)",
          "https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/"
        ),
        new LinkItem(
          "GNU Scientific Library: Random Number Generators",
          "https://www.gnu.org/software/gsl/doc/html/rng.html"
        ),
        new LinkItem(
          "GSL Source: gsl_rng_taus113",
          "https://github.com/ampl/gsl/blob/master/rng/taus113.c"
        ),
        new LinkItem(
          "Wikipedia: Combined Linear Congruential Generator",
          "https://en.wikipedia.org/wiki/Combined_linear_congruential_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01: Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "L'Ecuyer: Uniform Random Number Generation (2017)",
          "https://pubsonline.informs.org/doi/10.1287/ijoc.2016.0744"
        ),
        new LinkItem(
          "Panneton and L'Ecuyer: On the xorshift random number generators (2005)",
          "https://dl.acm.org/doi/10.1145/1132973.1132974"
        )
      ];

      // Test vectors verified against LFSR113 mathematical specification
      // Generated using L'Ecuyer's algorithm from "Tables of Maximally Equidistributed Combined LFSR Generators" (1999)
      // Seed format: [z1, z2, z3, z4] each as 32-bit big-endian
      // Reference: GSL source code (taus113.c) and L'Ecuyer's paper
      this.tests = [
        {
          text: "Seed (12345, 23456, 34567, 45678): First 5 outputs - verified against LFSR113 specification",
          uri: "https://github.com/ampl/gsl/blob/master/rng/taus113.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000303900005BA0000087070000B26E"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "D6E2EE34" +  // Output 1: 3605196340
            "20487A82" +  // Output 2: 541620866
            "B4B42F7B" +  // Output 3: 3031707515
            "1ECB28DD" +  // Output 4: 516630749
            "F0404482"    // Output 5: 4030743682
          )
        },
        {
          text: "Seed (987654321, 123456789, 362436069, 521288629): First 10 outputs - large seed values",
          uri: "https://github.com/ampl/gsl/blob/master/rng/taus113.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3ADE68B1075BCD15159A55E51F123BB5"),
          outputSize: 40, // 10 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "35FFD4A6" +  // Output 1: 905958566
            "874AFBBA" +  // Output 2: 2269838266
            "E88A2F02" +  // Output 3: 3901370114
            "3F7C813F" +  // Output 4: 1065124159
            "06E12E04" +  // Output 5: 115420676
            "A2527763" +  // Output 6: 2723313507
            "564D45D7" +  // Output 7: 1447904727
            "861C1FFB" +  // Output 8: 2249990139
            "6C1A069F" +  // Output 9: 1813644959
            "197EE877"    // Output 10: 427747447
          )
        },
        {
          text: "Seed (2, 8, 16, 128): Minimal valid seed values - edge case test",
          uri: "https://github.com/ampl/gsl/blob/master/rng/taus113.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000002000000080000001000000080"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "00180820" +  // Output 1: 1574944
            "000419C8" +  // Output 2: 268744
            "42200624" +  // Output 3: 1109394980
            "00828214" +  // Output 4: 8552980
            "31412E59"    // Output 5: 826355289
          )
        },
        {
          text: "Seed (1000000, 2000000, 3000000, 4000000): First 8 outputs - round seed values",
          uri: "https://github.com/ampl/gsl/blob/master/rng/taus113.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("000F4240001E8480002DC6C0003D0900"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "BEB9746D" +  // Output 1: 3199825005
            "080A61E0" +  // Output 2: 134898144
            "AE650DC5" +  // Output 3: 2925858245
            "3685FC3F" +  // Output 4: 914750527
            "1B0BC9A4" +  // Output 5: 453757348
            "87CAFF3B" +  // Output 6: 2278227771
            "45B7800E" +  // Output 7: 1169653774
            "7E08D479"    // Output 8: 2114507897
          )
        },
        {
          text: "Seed (12345, 23456, 34567, 45678): Outputs 11-15 - verifies long-term state progression",
          uri: "https://github.com/ampl/gsl/blob/master/rng/taus113.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000303900005BA0000087070000B26E"),
          outputSize: 20,
          skip: 10,  // Skip first 10 outputs
          expected: OpCodes.Hex8ToBytes(
            "F5519473" +  // Output 11: 4115764339
            "3F2F40AC" +  // Output 12: 1060061356
            "C83AD68A" +  // Output 13: 3359299210
            "D2A5D8F0" +  // Output 14: 3534084336
            "1032C2DB"    // Output 15: 271762139
          )
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
      return new LFSR113Instance(this);
    }
  }

  /**
 * LFSR113 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LFSR113Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // LFSR113 uses 4x 32-bit state variables (z1, z2, z3, z4)
      this._z1 = 0;
      this._z2 = 0;
      this._z3 = 0;
      this._z4 = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-16 bytes)
     * Seed format: up to 16 bytes mapped to four 32-bit words (z1, z2, z3, z4)
     *
     * Seed requirements (from GSL implementation):
     * - z1 >= 2 (must be > 1)
     * - z2 >= 8 (must be > 7)
     * - z3 >= 16 (must be > 15)
     * - z4 >= 128 (must be > 127)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize with GSL default seed values
      this._z1 = 12345;
      this._z2 = 23456;
      this._z3 = 34567;
      this._z4 = 45678;

      // Override with provided seed bytes (big-endian)
      let offset = 0;
      if (seedBytes.length >= 4) {
        this._z1 = OpCodes.Pack32BE(
          seedBytes[0] || 0,
          seedBytes[1] || 0,
          seedBytes[2] || 0,
          seedBytes[3] || 0
        );
        offset = 4;
      } else if (seedBytes.length > 0) {
        // For seeds < 4 bytes, pack what we have into z1
        const bytes = [0, 0, 0, 0];
        for (let i = 0; i < seedBytes.length; ++i) {
          bytes[i] = seedBytes[i];
        }
        this._z1 = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      if (seedBytes.length >= 8) {
        this._z2 = OpCodes.Pack32BE(
          seedBytes[4] || 0,
          seedBytes[5] || 0,
          seedBytes[6] || 0,
          seedBytes[7] || 0
        );
        offset = 8;
      }

      if (seedBytes.length >= 12) {
        this._z3 = OpCodes.Pack32BE(
          seedBytes[8] || 0,
          seedBytes[9] || 0,
          seedBytes[10] || 0,
          seedBytes[11] || 0
        );
        offset = 12;
      }

      if (seedBytes.length >= 16) {
        this._z4 = OpCodes.Pack32BE(
          seedBytes[12] || 0,
          seedBytes[13] || 0,
          seedBytes[14] || 0,
          seedBytes[15] || 0
        );
      }

      // Enforce minimum values for each component (GSL requirement)
      if (this._z1 < 2) this._z1 = 12345;
      if (this._z2 < 8) this._z2 = 23456;
      if (this._z3 < 16) this._z3 = 34567;
      if (this._z4 < 128) this._z4 = 45678;

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using LFSR113 algorithm
     *
     * Algorithm from L'Ecuyer (1999) / GSL implementation:
     *
     * Component z1 (period 2^31-1):
     *   b = ((z1 shl 6) XOR z1) shr 13
     *   z1 = ((z1 AND 0xFFFFFFFE) shl 18) XOR b
     *
     * Component z2 (period 2^29-1):
     *   b = ((z2 shl 2) XOR z2) shr 27
     *   z2 = ((z2 AND 0xFFFFFFF8) shl 2) XOR b
     *
     * Component z3 (period 2^28-1):
     *   b = ((z3 shl 13) XOR z3) shr 21
     *   z3 = ((z3 AND 0xFFFFFFF0) shl 7) XOR b
     *
     * Component z4 (period 2^25-1):
     *   b = ((z4 shl 3) XOR z4) shr 12
     *   z4 = ((z4 AND 0xFFFFFF80) shl 13) XOR b
     *
     * Output: z1 XOR z2 XOR z3 XOR z4
     */
    _next32() {
      if (!this._ready) {
        throw new Error('LFSR113 not initialized: set seed first');
      }

      // Component z1: period 2^31-1
      let b1 = OpCodes.Shr32(
        OpCodes.XorN(OpCodes.Shl32(this._z1, 6), this._z1),
        13
      );
      this._z1 = OpCodes.XorN(OpCodes.Shl32(OpCodes.AndN(this._z1, 0xFFFFFFFE), 18), b1);

      // Component z2: period 2^29-1
      let b2 = OpCodes.Shr32(
        OpCodes.XorN(OpCodes.Shl32(this._z2, 2), this._z2),
        27
      );
      this._z2 = OpCodes.XorN(OpCodes.Shl32(OpCodes.AndN(this._z2, 0xFFFFFFF8), 2), b2);

      // Component z3: period 2^28-1
      let b3 = OpCodes.Shr32(
        OpCodes.XorN(OpCodes.Shl32(this._z3, 13), this._z3),
        21
      );
      this._z3 = OpCodes.XorN(OpCodes.Shl32(OpCodes.AndN(this._z3, 0xFFFFFFF0), 7), b3);

      // Component z4: period 2^25-1
      let b4 = OpCodes.Shr32(
        OpCodes.XorN(OpCodes.Shl32(this._z4, 3), this._z4),
        12
      );
      this._z4 = OpCodes.XorN(OpCodes.Shl32(OpCodes.AndN(this._z4, 0xFFFFFF80), 13), b4);

      // Combine all components with XOR
      return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(this._z1, this._z2), this._z3), this._z4));
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('LFSR113 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        const bytes = OpCodes.Unpack32BE(value);

        for (let i = 0; i < bytesToExtract; ++i) {
          output.push(bytes[i]);
        }

        bytesRemaining -= bytesToExtract;
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
      // For PRNG, Feed can be used to skip outputs
      // Not standard for basic LFSR113, but useful for testing
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors
      if (this._skip && this._skip > 0) {
        // Skip the specified number of 32-bit outputs
        for (let i = 0; i < this._skip; ++i) {
          this._next32();
        }
        this._skip = 0; // Reset skip counter
      }

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

    /**
     * Set skip count (number of outputs to skip before generating result)
     */
    set skip(count) {
      this._skip = count;
    }

    get skip() {
      return this._skip || 0;
    }
  }

  // Register algorithm
  const algorithmInstance = new LFSR113Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LFSR113Algorithm, LFSR113Instance };
}));
