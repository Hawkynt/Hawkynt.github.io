/*
 * SplitMix32 Pseudo-Random Number Generator
 * Based on the fmix32 finalizer from MurmurHash3
 *
 * SplitMix32 is a 32-bit splittable PRNG designed by Guy L. Steele Jr., Doug Lea,
 * and Christine H. Flood. It uses a Weyl sequence (state += golden ratio constant)
 * combined with MurmurHash3-style mixing to produce high-quality pseudo-random output.
 *
 * Properties:
 * - State: Single 32-bit value
 * - Period: 2^32 (full 32-bit counter cycle)
 * - Speed: Extremely fast
 * - Quality: Passes statistical tests, improved mixing constants variant
 * - Use case: Excellent for seeding other generators (xoroshiro, xoshiro)
 *
 * Algorithm Variants:
 * 1. Standard (MurmurHash3 constants): 0x85ebca6b, 0xc2b2ae35
 * 2. Improved (better mixing): 0x21f0aaad, 0x735a2d97 (used here)
 *
 * Standard Algorithm:
 *   state += 0x9E3779B9;
 *   z = state;
 *   z = (z ^ (z >>> 16)) * 0x85ebca6b;
 *   z = (z ^ (z >>> 13)) * 0xc2b2ae35;
 *   return (z ^ (z >>> 16)) >>> 0;
 *
 * Improved Algorithm (implemented):
 *   state += 0x9E3779B9;
 *   z = state;
 *   z = (z ^ (z >>> 16)) * 0x21f0aaad;
 *   z = (z ^ (z >>> 15)) * 0x735a2d97;
 *   return (z ^ (z >>> 15)) >>> 0;
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

  class SplitMix32Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SplitMix32";
      this.description = "SplitMix32 is a fast 32-bit splittable PRNG based on MurmurHash3's fmix32 finalizer. It uses a Weyl sequence with golden ratio constant combined with improved mixing functions. Commonly used to seed other PRNGs like xoroshiro and xoshiro.";
      this.inventor = "Guy L. Steele Jr., Doug Lea, Christine H. Flood";
      this.year = 2014;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (8-32 bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Fast Splittable Pseudorandom Number Generators (OOPSLA 2014)",
          "https://dl.acm.org/doi/10.1145/2714064.2660195"
        ),
        new LinkItem(
          "SplitMix32 JavaScript Implementation (attilabuti)",
          "https://github.com/attilabuti/SimplexNoise"
        ),
        new LinkItem(
          "MurmurHash3 fmix32 Finalizer",
          "https://github.com/aappleby/smhasher/blob/master/src/MurmurHash3.cpp"
        ),
        new LinkItem(
          "Haskell splitmix Package (32-bit variant)",
          "https://hackage.haskell.org/package/splitmix/docs/System-Random-SplitMix32.html"
        )
      ];

      this.references = [
        new LinkItem(
          "JavaScript PRNGs Collection (bryc)",
          "https://github.com/bryc/code/blob/master/jshash/PRNGs.md"
        ),
        new LinkItem(
          "Seeding Random Generators with SplitMix",
          "https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript"
        ),
        new LinkItem(
          "PCG: Bugs in SplitMix Discussion",
          "https://www.pcg-random.org/posts/bugs-in-splitmix.html"
        )
      ];

      // Test vectors generated from reference implementation
      // Using improved mixing constants (0x21f0aaad, 0x735a2d97)
      // Reference: https://github.com/attilabuti/SimplexNoise
      // Algorithm: state += 0x9E3779B9; z = state; z = (z ^ (z >>> 16)) * 0x21f0aaad; z = (z ^ (z >>> 15)) * 0x735a2d97; return (z ^ (z >>> 15)) >>> 0;
      this.tests = [
        {
          text: "Seed 0: First 5 outputs (20 bytes) - verified against reference implementation",
          uri: "https://github.com/attilabuti/SimplexNoise",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "64625032" +  // Output 1: 1684164658
            "D9C0799C" +  // Output 2: 3653269916
            "AF362E10" +  // Output 3: 2939563536
            "7FA88912" +  // Output 4: 2141751570
            "C4671B39"    // Output 5: 3295091513
          )
        },
        {
          text: "Seed 1: First 5 outputs (20 bytes) - single-bit seed difference",
          uri: "https://github.com/attilabuti/SimplexNoise",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "5E2D1772" +  // Output 1: 1580013426
            "14E498F0" +  // Output 2: 350525680
            "D20EA1FD" +  // Output 3: 3524174333
            "B382F339" +  // Output 4: 3011703609
            "2660B860"    // Output 5: 643872864
          )
        },
        {
          text: "Seed 42: First 8 outputs (32 bytes) - commonly used test seed",
          uri: "https://github.com/attilabuti/SimplexNoise",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000002A"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "20E44818" +  // Output 1: 551831576
            "0895A923" +  // Output 2: 144025891
            "1339A01F" +  // Output 3: 322543647
            "B4E3841A" +  // Output 4: 3034809370
            "361F702A" +  // Output 5: 908029994
            "9DDBCDCF" +  // Output 6: 2648427983
            "03AE3C3C" +  // Output 7: 61750332
            "6F22AC67"    // Output 8: 1864543335
          )
        },
        {
          text: "Seed 12345: First 5 outputs (20 bytes) - larger seed value",
          uri: "https://github.com/attilabuti/SimplexNoise",
          input: null,
          seed: OpCodes.Hex8ToBytes("00003039"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "C3B24A19" +  // Output 1: 3283241497
            "248B6DF5" +  // Output 2: 613117429
            "AF4B7724" +  // Output 3: 2940958500
            "1EC7438D" +  // Output 4: 516375437
            "CBCF9585"    // Output 5: 3419379077
          )
        },
        {
          text: "Seed 0xFFFFFFFF (max 32-bit): First 5 outputs (20 bytes) - edge case",
          uri: "https://github.com/attilabuti/SimplexNoise",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFF"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "EB721C8A" +  // Output 1: 3950124170
            "FFE8BD34" +  // Output 2: 4293442868
            "4DA2A8CE" +  // Output 3: 1302505678
            "A4A5CC85" +  // Output 4: 2762329221
            "C85A6BE7"    // Output 5: 3361369063
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
      return new SplitMix32Instance(this);
    }
  }

  /**
 * SplitMix32 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SplitMix32Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SplitMix32 constants (improved mixing variant)
      this.GOLDEN_GAMMA = 0x9E3779B9;  // 32-bit truncation of golden ratio
      this.MIX_CONST_1 = 0x21f0aaad;   // Improved mixing constant 1
      this.MIX_CONST_2 = 0x735a2d97;   // Improved mixing constant 2

      // Generator state
      this._state = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-4 bytes)
     * Seed format: 1-4 bytes packed into a 32-bit state value (big-endian)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Pack seed bytes into 32-bit state (big-endian)
      if (seedBytes.length >= 4) {
        this._state = OpCodes.Pack32BE(
          seedBytes[0],
          seedBytes[1],
          seedBytes[2],
          seedBytes[3]
        );
      } else if (seedBytes.length === 3) {
        this._state = OpCodes.Pack32BE(0, seedBytes[0], seedBytes[1], seedBytes[2]);
      } else if (seedBytes.length === 2) {
        this._state = OpCodes.Pack32BE(0, 0, seedBytes[0], seedBytes[1]);
      } else {
        this._state = OpCodes.Pack32BE(0, 0, 0, seedBytes[0]);
      }

      this._state = OpCodes.ToUint32(this._state); // Ensure unsigned 32-bit
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using SplitMix32 algorithm (improved variant)
     *
     * Algorithm:
     * state += 0x9E3779B9;  // Add golden ratio constant (Weyl sequence)
     * z = state;
     * z = (z ^ (z >>> 16)) * 0x21f0aaad;  // First mixing stage
     * z = (z ^ (z >>> 15)) * 0x735a2d97;  // Second mixing stage
     * return (z ^ (z >>> 15)) >>> 0;      // Final mixing and unsigned conversion
     *
     * Key constants:
     * - 0x9E3779B9: Golden ratio constant (creates full-period Weyl sequence)
     * - 0x21f0aaad, 0x735a2d97: Improved mixing constants (better than MurmurHash3 originals)
     */
    _next32() {
      if (!this._ready) {
        throw new Error('SplitMix32 not initialized: set seed first');
      }

      // Step 1: Add golden ratio constant to state (Weyl sequence)
      this._state = OpCodes.ToInt(this._state + this.GOLDEN_GAMMA);
      let z = this._state;

      // Step 2: First mixing stage - XOR with right-shift 16, multiply by constant
      const zShifted16 = OpCodes.Shr32(z, 16);
      z = Math.imul(OpCodes.XorN(z, zShifted16), this.MIX_CONST_1);

      // Step 3: Second mixing stage - XOR with right-shift 15, multiply by constant
      const zShifted15_1 = OpCodes.Shr32(z, 15);
      z = Math.imul(OpCodes.XorN(z, zShifted15_1), this.MIX_CONST_2);

      // Step 4: Final mixing - XOR with right-shift 15
      const zShifted15_2 = OpCodes.Shr32(z, 15);
      return OpCodes.ToDWord(OpCodes.XorN(z, zShifted15_2));
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('SplitMix32 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order for consistency)
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
      // For PRNG, Feed is not typically used
      // Included for interface compliance
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors (if needed)
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
  const algorithmInstance = new SplitMix32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SplitMix32Algorithm, SplitMix32Instance };
}));
