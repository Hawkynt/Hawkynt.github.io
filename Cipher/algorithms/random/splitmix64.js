/*
 * SplitMix64 Pseudo-Random Number Generator
 * Based on the reference implementation by Guy L. Steele Jr. and Doug Lea
 * Original source: Java 8's SplittableRandom (java.util.SplittableRandom)
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

  class SplitMix64Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SplitMix64";
      this.description = "SplitMix64 is a very fast pseudo-random number generator designed by Guy L. Steele Jr. and Doug Lea. It uses a simple linear congruential update combined with a high-quality 64-bit mixing function. Commonly used to seed other PRNGs like xorshift*.";
      this.inventor = "Guy L. Steele Jr., Doug Lea";
      this.year = 2013;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Fast Splittable Pseudorandom Number Generators (OOPSLA 2014)",
          "https://dl.acm.org/doi/10.1145/2714064.2660195"
        ),
        new LinkItem(
          "Java 8 SplittableRandom Source Code",
          "https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/SplittableRandom.java"
        ),
        new LinkItem(
          "Reference Implementation (C)",
          "https://github.com/lemire/testingRNG/blob/master/source/splitmix64.h"
        ),
        new LinkItem(
          "Wikipedia: SplitMix64",
          "https://en.wikipedia.org/wiki/Pseudorandom_number_generator#SplitMix64"
        )
      ];

      this.references = [
        new LinkItem(
          "PCG: A Better Random Number Generator",
          "https://www.pcg-random.org/posts/some-prng-implementations.html"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors verified against multiple reference implementations
      // Rosetta Code: https://rosettacode.org/wiki/Pseudo-random_numbers/Splitmix64
      // Reference C: https://prng.di.unimi.it/splitmix64.c
      this.tests = [
        {
          text: "Seed 0: First 8 outputs (verified against reference C implementation)",
          uri: "https://prng.di.unimi.it/splitmix64.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 64, // 8 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "E220A8397B1DCDAF" + // Output 1
            "6E789E6AA1B965F4" + // Output 2
            "06C45D188009454F" + // Output 3
            "F88BB8A8724C81EC" + // Output 4
            "1B39896A51A8749B" + // Output 5
            "53CB9F0C747EA2EA" + // Output 6
            "2C829ABE1F4532E1" + // Output 7
            "C584133AC916AB3C"   // Output 8
          )
        },
        {
          text: "Seed 1: First 5 outputs",
          uri: "https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/SplittableRandom.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "910A2DEC89025CC1" + // Output 1
            "BEEB8DA1658EEC67" + // Output 2
            "F893A2EEFB32555E" + // Output 3
            "71C18690EE42C90B" + // Output 4
            "71BB54D8D101B5B9"   // Output 5
          )
        },
        {
          text: "Seed 42: First 5 outputs (commonly used test seed)",
          uri: "https://prng.di.unimi.it/splitmix64.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "BDD732262FEB6E95" +
            "28EFE333B266F103" +
            "47526757130F9F52" +
            "581CE1FF0E4AE394" +
            "09BC585A244823F2"
          )
        },
        {
          text: "Seed 1234567: First 5 outputs (Rosetta Code test vector)",
          uri: "https://rosettacode.org/wiki/Pseudo-random_numbers/Splitmix64",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "599ED017FB08FC85" + // 6457827717110365317
            "2C73F08458540FA5" + // 3203168211198807973
            "883EBCE5A3F27C77" + // 9817491932198370423
            "3FBEF740E9177B3F" + // 4593380528125082431
            "E3B8346708CB5ECD"   // 16408922859458223821
          )
        },
        {
          text: "Seed 987654321: First 5 outputs (Rosetta Code test vector)",
          uri: "https://rosettacode.org/wiki/Pseudo-random_numbers/Splitmix64",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000003ADE68B1"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "B0DE530201A9D17C" +
            "E0B60B3994B35AA2" +
            "E048F39ADC9EE4A0" +
            "867287110E89EB48" +
            "BFB28D8C1560F051"
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
      return new SplitMix64Instance(this);
    }
  }

  /**
 * SplitMix64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SplitMix64Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SplitMix64 constants
      this.GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;  // Scaled golden ratio
      this.MIX_CONST_1 = 0xBF58476D1CE4E5B9n;   // Stafford variant 13
      this.MIX_CONST_2 = 0x94D049BB133111EBn;

      // Generator state
      this._state = 0n;
      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian - most significant byte first)
      this._state = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        this._state = OpCodes.OrN(OpCodes.ShiftLn(this._state, 8), BigInt(seedBytes[i]));
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit value
     * Based on reference implementation: splitmix64_r()
     *
     * Algorithm:
     * 1. state += GOLDEN_GAMMA
     * 2. z = state
     * 3. z = (z XOR (z shr 30)) * MIX_CONST_1
     * 4. z = (z XOR (z shr 27)) * MIX_CONST_2
     * 5. return z XOR (z shr 31)
     */
    _next64() {
      if (!this._ready) {
        throw new Error('SplitMix64 not initialized: set seed first');
      }

      // Step 1: Add golden gamma to state
      this._state = OpCodes.AndN(this._state + this.GOLDEN_GAMMA, 0xFFFFFFFFFFFFFFFFn);

      // Step 2-5: Mix function (Stafford variant 13) applied to new state
      let z = this._state;
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 30)) * this.MIX_CONST_1, 0xFFFFFFFFFFFFFFFFn);
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 27)) * this.MIX_CONST_2, 0xFFFFFFFFFFFFFFFFn);
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 31)), 0xFFFFFFFFFFFFFFFFn);

      return z;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('SplitMix64 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 64-bit value
        const value = this._next64();

        // Extract bytes (big-endian order - most significant byte first)
        const bytesToExtract = Math.min(bytesRemaining, 8);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, (7 - i) * 8), 0xFFn));
          output.push(byte);
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
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic SplitMix64 - would require mixing
      // For now, Feed is a no-op (SplitMix64 is deterministic)
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
  const algorithmInstance = new SplitMix64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SplitMix64Algorithm, SplitMix64Instance };
}));
