/*
 * LFSR88 Pseudo-Random Number Generator
 * Based on Pierre L'Ecuyer's "Maximally Equidistributed Combined Tausworthe Generators" (1996)
 *
 * LFSR88 combines three Tausworthe LFSR components to create a high-quality PRNG
 * with an approximate period of 2^88. This algorithm is used in the GNU Scientific
 * Library (GSL) as gsl_rng_taus and provides excellent statistical properties while
 * being simpler and faster than LFSR113.
 *
 * Period: approximately 2^88 (combined from three components with periods 2^31-1, 2^29-1, 2^28-1)
 * State: 96 bits (three 32-bit words: z1, z2, z3)
 *
 * Each component uses a different primitive trinomial for maximum statistical quality:
 * - Component z1: period 2^31-1, uses trinomial with shift 13, 19
 * - Component z2: period 2^29-1, uses trinomial with shift 2, 25
 * - Component z3: period 2^28-1, uses trinomial with shift 3, 11
 *
 * The output is the XOR of all three components, providing excellent statistical
 * properties for simulation and Monte Carlo applications.
 *
 * SECURITY WARNING: LFSR88 is NOT cryptographically secure.
 * It is designed for statistical quality in simulations, not security.
 * Use only for:
 * - Scientific simulations
 * - Monte Carlo methods
 * - Statistical sampling
 * - Gaming applications
 *
 * References:
 * - L'Ecuyer, P. (1996). "Maximally Equidistributed Combined Tausworthe Generators"
 *   Mathematics of Computation, 65(213), 203-213
 * - GNU Scientific Library: gsl_rng_taus implementation
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

  class LFSR88Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LFSR88";
      this.description = "LFSR88 is a combined linear feedback shift register using three Tausworthe components with primitive trinomials. With a period of approximately 2^88, it provides excellent statistical quality for simulations and Monte Carlo methods. Simpler and faster than LFSR113, widely used in GNU Scientific Library (GSL).";
      this.inventor = "Pierre L'Ecuyer";
      this.year = 1996;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Tausworthe LFSR";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CA;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 12, 1)]; // 1-12 bytes (up to 96-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "L'Ecuyer: Maximally Equidistributed Combined Tausworthe Generators (1996)",
          "https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/"
        ),
        new LinkItem(
          "GNU Scientific Library: Random Number Generators",
          "https://www.gnu.org/software/gsl/doc/html/rng.html"
        ),
        new LinkItem(
          "GSL Source: gsl_rng_taus",
          "https://github.com/ampl/gsl/blob/master/rng/taus.c"
        ),
        new LinkItem(
          "L'Ecuyer: Tables of Maximally Equidistributed Combined LFSR Generators",
          "https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/"
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
          "Panneton & L'Ecuyer: On the xorshift random number generators (2005)",
          "https://dl.acm.org/doi/10.1145/1132973.1132974"
        )
      ];

      // Test vectors verified against LFSR88 mathematical specification
      // Generated using L'Ecuyer's algorithm from "Maximally Equidistributed Combined Tausworthe Generators" (1996)
      // Seed format: [z1, z2, z3] each as 32-bit big-endian
      // Reference: Implementation verified against algorithm specification from L'Ecuyer (1996)
      this.tests = [
        {
          text: "Seed (12345, 23456, 34567): First 5 outputs - verified against LFSR88 specification",
          uri: "https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000303900005BA000008707"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "0D063A57" +  // Output 1: 218511959
            "39786E63" +  // Output 2: 964193891
            "455D3D00" +  // Output 3: 1163738368
            "2CA381E2" +  // Output 4: 748913122
            "805AFCF6"    // Output 5: 2153446646
          )
        },
        {
          text: "Seed (987654321, 123456789, 362436069): First 10 outputs - large seed values",
          uri: "https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/",
          input: null,
          seed: OpCodes.Hex8ToBytes("3ADE68B1075BCD15159A55E5"),
          outputSize: 40, // 10 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "38E0E6EB" +  // Output 1: 954263275
            "B81C2DB7" +  // Output 2: 3088854455
            "1E43DC1D" +  // Output 3: 507763741
            "9567CF51" +  // Output 4: 2506608465
            "78B9BE0C" +  // Output 5: 2025438732
            "CD95F930" +  // Output 6: 3449157936
            "E9903CB4" +  // Output 7: 3918544052
            "B3D3529E" +  // Output 8: 3016970910
            "C1423895" +  // Output 9: 3242342549
            "391F9E51"    // Output 10: 958373457
          )
        },
        {
          text: "Seed (2, 8, 16): Minimal valid seed values - edge case test",
          uri: "https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000020000000800000010"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "00202080" +  // Output 1: 2105472
            "02002C80" +  // Output 2: 33565824
            "48088062" +  // Output 3: 1208516706
            "804D2000" +  // Output 4: 2152538112
            "428049A0"    // Output 5: 1115703712
          )
        },
        {
          text: "Seed (1000000, 2000000, 3000000): First 8 outputs - round seed values",
          uri: "https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/",
          input: null,
          seed: OpCodes.Hex8ToBytes("000F4240001E8480002DC6C0"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "784C7D76" +  // Output 1: 2018278774
            "0FA83EDE" +  // Output 2: 262684382
            "80FDE985" +  // Output 3: 2164124037
            "B34C4FAE" +  // Output 4: 3008122798
            "EAACEDF0" +  // Output 5: 3937201648
            "B6523986" +  // Output 6: 3058841990
            "4005B43B" +  // Output 7: 1074115643
            "C328D759"    // Output 8: 3274233689
          )
        },
        {
          text: "Seed (12345, 23456, 34567): Outputs 11-15 - verifies long-term state progression",
          uri: "https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000303900005BA000008707"),
          outputSize: 20,
          skip: 10,  // Skip first 10 outputs
          expected: OpCodes.Hex8ToBytes(
            "93F757CD" +  // Output 11: 2482460621
            "B1D16696" +  // Output 12: 2983290518
            "117EEE33" +  // Output 13: 293531187
            "DD3FCFDD" +  // Output 14: 3711946717
            "2B582A1E"    // Output 15: 727198238
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
      return new LFSR88Instance(this);
    }
  }

  /**
 * LFSR88 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LFSR88Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // LFSR88 uses 3x 32-bit state variables (z1, z2, z3)
      this._z1 = 0;
      this._z2 = 0;
      this._z3 = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-12 bytes)
     * Seed format: up to 12 bytes mapped to three 32-bit words (z1, z2, z3)
     *
     * Seed requirements (from GSL implementation):
     * - z1 >= 2 (must be > 1)
     * - z2 >= 8 (must be > 7)
     * - z3 >= 16 (must be > 15)
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
      }

      // Enforce minimum values for each component (GSL requirement)
      if (this._z1 < 2) this._z1 = 12345;
      if (this._z2 < 8) this._z2 = 23456;
      if (this._z3 < 16) this._z3 = 34567;

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using LFSR88 algorithm
     *
     * Algorithm from L'Ecuyer (1996) / GSL implementation:
     *
     * Component z1 (period 2^31-1):
     *   b = ((z1 << 13) ^ z1) >> 19
     *   z1 = ((z1 & 0xFFFFFFFE) << 12) ^ b
     *
     * Component z2 (period 2^29-1):
     *   b = ((z2 << 2) ^ z2) >> 25
     *   z2 = ((z2 & 0xFFFFFFF8) << 4) ^ b
     *
     * Component z3 (period 2^28-1):
     *   b = ((z3 << 3) ^ z3) >> 11
     *   z3 = ((z3 & 0xFFFFFFF0) << 17) ^ b
     *
     * Output: z1 ^ z2 ^ z3
     */
    _next32() {
      if (!this._ready) {
        throw new Error('LFSR88 not initialized: set seed first');
      }

      // Component z1: period 2^31-1
      let b1 = OpCodes.Shr32(
        OpCodes.Shl32(this._z1, 13) ^ this._z1,
        19
      );
      this._z1 = OpCodes.Shl32(this._z1 & 0xFFFFFFFE, 12) ^ b1;

      // Component z2: period 2^29-1
      let b2 = OpCodes.Shr32(
        OpCodes.Shl32(this._z2, 2) ^ this._z2,
        25
      );
      this._z2 = OpCodes.Shl32(this._z2 & 0xFFFFFFF8, 4) ^ b2;

      // Component z3: period 2^28-1
      let b3 = OpCodes.Shr32(
        OpCodes.Shl32(this._z3, 3) ^ this._z3,
        11
      );
      this._z3 = OpCodes.Shl32(this._z3 & 0xFFFFFFF0, 17) ^ b3;

      // Combine all components with XOR
      return (this._z1 ^ this._z2 ^ this._z3) >>> 0;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('LFSR88 not initialized: set seed first');
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
      // Not standard for basic LFSR88, but useful for testing
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
  const algorithmInstance = new LFSR88Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LFSR88Algorithm, LFSR88Instance };
}));
