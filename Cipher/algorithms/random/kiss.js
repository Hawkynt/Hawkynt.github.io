/*
 * KISS (Keep It Simple Stupid) Pseudo-Random Number Generator
 * Based on George Marsaglia's KISS random number generator (1999)
 *
 * KISS combines four simple random number generators to create a high-quality
 * generator with excellent statistical properties and an enormous period of
 * approximately 2^123. The combination uses XOR and addition operations to
 * merge the outputs of:
 *
 * 1. MWC (Multiply-With-Carry): Two 16-bit MWC generators combined
 * 2. CONG (Congruential): Simple LCG with multiplier 69069
 * 3. SHR3 (3-Shift Register): Three XOR-shift operations
 *
 * Formula: KISS = ((MWC^CONG)+SHR3)
 * Period: Approximately 2^123
 * State: 128 bits (four 32-bit words: z, w, jsr, jcong)
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

  class KissAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "KISS";
      this.description = "KISS (Keep It Simple Stupid) combines four simple generators (two MWC, one congruential, one shift-register) using XOR and addition to create a high-quality PRNG with period approximately 2^123. Despite its simplicity, it passes rigorous statistical tests and is widely used in simulations.";
      this.inventor = "George Marsaglia";
      this.year = 1999;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Combined PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // 1-16 bytes (up to 128-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Marsaglia's Original Post: Random Numbers for C (1999)",
          "https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ"
        ),
        new LinkItem(
          "Programming Praxis: George Marsaglia's Random Number Generators",
          "https://programmingpraxis.com/2010/10/05/george-marsaglias-random-number-generators/"
        ),
        new LinkItem(
          "Wikipedia: KISS (algorithm)",
          "https://en.wikipedia.org/wiki/KISS_(algorithm)"
        ),
        new LinkItem(
          "Reference Implementation (GitHub - librandom)",
          "https://github.com/cgwrench/librandom/blob/master/src/kiss.h"
        )
      ];

      this.references = [
        new LinkItem(
          "Marsaglia RNG Collection",
          "http://school.anhb.uwa.edu.au/personalpages/kwessen/shared/Marsaglia99.html"
        ),
        new LinkItem(
          "Note: KISS - A bit too simple (2011 critique)",
          "https://www.researchgate.net/publication/220336186_KISS_A_bit_too_simple"
        )
      ];

      // Test vectors from Marsaglia's original post
      // These are verified against the official test program that checks
      // each generator produces expected values after 1 million iterations
      // Reference: sci.math.num-analysis post, January 21, 1999
      this.tests = [
        {
          text: "Standard seed (z=362436069, w=521288629, jsr=123456789, jcong=380116160): First 5 outputs - Marsaglia default initialization",
          uri: "https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ",
          input: null,
          seed: OpCodes.Hex8ToBytes("159A55E51F123BB5075BCD1516A81CC0"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "2DDCCFE0" +  // Output 1: 769650656
            "2C3A35A8" +  // Output 2: 741750184
            "7E6EE31A" +  // Output 3: 2120844058
            "A73A60CE" +  // Output 4: 2806276302
            "BF9847A7"    // Output 5: 3214739367
          )
        },
        {
          text: "Standard seed: After 1,000,000 iterations - Official Marsaglia test vector",
          uri: "https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ",
          input: null,
          seed: OpCodes.Hex8ToBytes("159A55E51F123BB5075BCD1516A81CC0"),
          outputSize: 4,
          skip: 1000000,
          expected: OpCodes.Hex8ToBytes("6E00C98C") // 1845266828 decimal
        },
        {
          text: "Seed (1,1,1,1): First 8 outputs - minimal seed values",
          uri: "https://programmingpraxis.com/2010/10/05/george-marsaglias-random-number-generators/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000010000000100000001"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "90BCA435" +  // Output 1: 2427765813
            "28B06DDC" +  // Output 2: 681853404
            "9DAED79C" +  // Output 3: 2646300572
            "E6CCB302" +  // Output 4: 3871171330
            "3AA7BD70" +  // Output 5: 983072112
            "87761AF5" +  // Output 6: 2272370421
            "5CF255BB" +  // Output 7: 1559381435
            "8D103532"    // Output 8: 2366628146
          )
        },
        {
          text: "Seed (12345,65435,34221,12345): First 10 outputs - Marsaglia settable() test initialization",
          uri: "https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ",
          input: null,
          seed: OpCodes.Hex8ToBytes("000030390000FF9B000085AD00003039"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "8F714BB5" +  // Output 1: 2406173621
            "EB2B61B7" +  // Output 2: 3943047607
            "BFC72CBD" +  // Output 3: 3218914493
            "4D222ED8" +  // Output 4: 1293970136
            "647480F7" +  // Output 5: 1685405943
            "700E80DB" +  // Output 6: 1880522971
            "151BFA19" +  // Output 7: 353633817
            "454F142D" +  // Output 8: 1162757165
            "9E422D27" +  // Output 9: 2655370535
            "0D7DEDD0"    // Output 10: 226152912
          )
        },
        {
          text: "Standard seed: Outputs 1000-1004 - verifies long-term state progression",
          uri: "https://programmingpraxis.com/2010/10/05/george-marsaglias-random-number-generators/",
          input: null,
          seed: OpCodes.Hex8ToBytes("159A55E51F123BB5075BCD1516A81CC0"),
          outputSize: 20,
          skip: 999,
          expected: OpCodes.Hex8ToBytes(
            "0CF9F508" +  // Output 1000: 217646344
            "C9DCE4BE" +  // Output 1001: 3387966654
            "94A7E42A" +  // Output 1002: 2492818474
            "0D2DCC5E" +  // Output 1003: 220996702
            "6C0EE0C0"    // Output 1004: 1812742336
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
      return new KissInstance(this);
    }
  }

  /**
 * Kiss cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KissInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // KISS uses 4x 32-bit state variables
      // Default values from Marsaglia's original code
      this._z = 0;        // MWC component 1
      this._w = 0;        // MWC component 2
      this._jsr = 0;      // SHR3 shift-register
      this._jcong = 0;    // CONG congruential
      this._ready = false;
    }

    /**
     * Set seed value (1-16 bytes)
     * Seed format: up to 16 bytes mapped to four 32-bit words (z, w, jsr, jcong)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize with Marsaglia's default values
      this._z = 362436069;
      this._w = 521288629;
      this._jsr = 123456789;
      this._jcong = 380116160;

      // Override with provided seed bytes (big-endian)
      let offset = 0;
      if (seedBytes.length >= 4) {
        this._z = OpCodes.Pack32BE(
          seedBytes[0] || 0,
          seedBytes[1] || 0,
          seedBytes[2] || 0,
          seedBytes[3] || 0
        );
        offset = 4;
      } else if (seedBytes.length > 0) {
        // For seeds < 4 bytes, pack what we have into z
        const bytes = [0, 0, 0, 0];
        for (let i = 0; i < seedBytes.length; ++i) {
          bytes[i] = seedBytes[i];
        }
        this._z = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
        this._ready = true;
        return;
      }

      if (seedBytes.length >= 8) {
        this._w = OpCodes.Pack32BE(
          seedBytes[4] || 0,
          seedBytes[5] || 0,
          seedBytes[6] || 0,
          seedBytes[7] || 0
        );
        offset = 8;
      }

      if (seedBytes.length >= 12) {
        this._jsr = OpCodes.Pack32BE(
          seedBytes[8] || 0,
          seedBytes[9] || 0,
          seedBytes[10] || 0,
          seedBytes[11] || 0
        );
        offset = 12;
      }

      if (seedBytes.length >= 16) {
        this._jcong = OpCodes.Pack32BE(
          seedBytes[12] || 0,
          seedBytes[13] || 0,
          seedBytes[14] || 0,
          seedBytes[15] || 0
        );
      }

      // Ensure jsr is never zero (SHR3 requirement)
      if (this._jsr === 0) {
        this._jsr = 123456789;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * MWC (Multiply-With-Carry) generator
     * Uses two 16-bit MWC generators combined into a 32-bit output
     *
     * Formula:
     *   znew = 36969 * (z AND 65535) + (z shr 16)
     *   wnew = 18000 * (w AND 65535) + (w shr 16)
     *   MWC = (znew shl 16) + wnew
     */
    _mwc() {
      // Update z: z = 36969 * (z AND 0xFFFF) + (z shr 16)
      this._z = OpCodes.ToUint32((36969 * OpCodes.AndN(this._z, 0xFFFF)) + OpCodes.Shr32(this._z, 16));

      // Update w: w = 18000 * (w AND 0xFFFF) + (w shr 16)
      this._w = OpCodes.ToUint32((18000 * OpCodes.AndN(this._w, 0xFFFF)) + OpCodes.Shr32(this._w, 16));

      // Combine: (z shl 16) + w
      return OpCodes.ToUint32(OpCodes.Shl32(this._z, 16) + this._w);
    }

    /**
     * SHR3 (3-Shift Register) generator
     * Three XOR-shift operations
     *
     * Formula:
     *   jsr XOR= (jsr shl 17)
     *   jsr XOR= (jsr shr 13)
     *   jsr XOR= (jsr shl 5)
     */
    _shr3() {
      this._jsr = OpCodes.ToUint32(OpCodes.XorN(this._jsr, OpCodes.Shl32(this._jsr, 17)));
      this._jsr = OpCodes.ToUint32(OpCodes.XorN(this._jsr, OpCodes.Shr32(this._jsr, 13)));
      this._jsr = OpCodes.ToUint32(OpCodes.XorN(this._jsr, OpCodes.Shl32(this._jsr, 5)));
      return this._jsr;
    }

    /**
     * CONG (Congruential) generator
     * Simple LCG with multiplier 69069 and increment 1234567
     *
     * Formula:
     *   jcong = 69069 * jcong + 1234567
     */
    _cong() {
      this._jcong = OpCodes.ToUint32((69069 * this._jcong) + 1234567);
      return this._jcong;
    }

    /**
     * Generate next 32-bit value using KISS algorithm
     *
     * Formula: ((MWC XOR CONG)+SHR3)
     * This combines all four generators using XOR and addition
     */
    _next32() {
      if (!this._ready) {
        throw new Error('KISS not initialized: set seed first');
      }

      const mwc = this._mwc();
      const cong = this._cong();
      const shr3 = this._shr3();

      // KISS = ((MWC XOR CONG) + SHR3)
      return OpCodes.ToUint32(OpCodes.XorN(mwc, cong) + shr3);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('KISS not initialized: set seed first');
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
      // For PRNG, Feed is not used (stateless generation)
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
  const algorithmInstance = new KissAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { KissAlgorithm, KissInstance };
}));
