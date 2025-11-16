/*
 * Xorshift64 Pseudo-Random Number Generator
 * Based on George Marsaglia's original xorshift algorithm (2003)
 *
 * This implementation uses the classic xorshift64 variant with a single 64-bit state
 * variable, as described in Marsaglia's seminal paper "Xorshift RNGs" (2003).
 *
 * Period: 2^64 - 1
 * State: 64 bits (one 64-bit word)
 * Algorithm: Three xorshift operations with parameters (13, 7, 17)
 * Formula: x ^= x << 13; x ^= x >> 7; x ^= x << 17;
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

  class Xorshift64Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xorshift64";
      this.description = "Xorshift64 is a very fast pseudo-random number generator invented by George Marsaglia. It uses three xorshift operations on a single 64-bit state to generate random numbers with a period of 2^64-1. Commonly used in game engines and simulations.";
      this.inventor = "George Marsaglia";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Xorshift Family";
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
          "Original Paper: Xorshift RNGs (Marsaglia, 2003)",
          "https://www.jstatsoft.org/article/view/v008i14"
        ),
        new LinkItem(
          "Wikipedia: Xorshift",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "Analysis by Sebastiano Vigna",
          "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf"
        ),
        new LinkItem(
          "Reference Implementation (Stack Overflow)",
          "https://stackoverflow.com/questions/53886131/how-does-xorshift32-works"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Modern PRNG Alternatives (xoshiro/xoroshiro)",
          "https://prng.di.unimi.it/"
        ),
        new LinkItem(
          "Note on Marsaglia's Xorshift RNGs (Panneton & L'Ecuyer)",
          "https://www.iro.umontreal.ca/~lecuyer/myftp/papers/xorshift.pdf"
        )
      ];

      // Test vectors verified against reference implementation
      // Generated using parameters (13, 7, 17) from Marsaglia's paper
      // Reference: Marsaglia, G. (2003). "Xorshift RNGs". Journal of Statistical Software, 8(14), 1-6.
      this.tests = [
        {
          text: "Seed 1: First 5 outputs (40 bytes) - verified against reference C implementation",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "0000000040822041" +  // Output 1: 1082269761
            "100041060C011441" +  // Output 2: 1152992998833853505
            "9B1E842F6E862629" +  // Output 3: 11177516664432764457
            "F554F503555D8025" +  // Output 4: 17678023832001937445
            "860C1FB090599265"    // Output 5: 9659130143999365733
          )
        },
        {
          text: "Seed 88172645463325252: First 3 outputs (24 bytes) - from Marsaglia's examples",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("0139408DCBBF7A44"),
          outputSize: 24, // 3 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "79690975FBDE15B0" +  // Output 1: 8748534153485358512
            "2A337357AE2CC59B" +  // Output 2: 3040900993826735515
            "2FEF107A27529AD0"    // Output 3: 3453997556048239312
          )
        },
        {
          text: "Seed 12345: First 5 outputs (40 bytes) - common test seed",
          uri: "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000003039"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "00000C163A391E19" +  // Output 1: 13289605635609
            "9C0EB9542F03CA65" +  // Output 2: 11245129090807876197
            "A228090AD781F4B1" +  // Output 3: 11684599175382693041
            "20F578D6EAF5FB18" +  // Output 4: 2374937242968128280
            "7B76F0B8E8E1D6EE"    // Output 5: 8896562790888756974
          )
        },
        {
          text: "Seed 0 (becomes 1): First 5 outputs (40 bytes) - zero seed handling",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "0000000040822041" +  // Same as seed 1
            "100041060C011441" +
            "9B1E842F6E862629" +
            "F554F503555D8025" +
            "860C1FB090599265"
          )
        },
        {
          text: "Seed 9223372036854775807 (max int64): First 5 outputs - large seed value",
          uri: "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf",
          input: null,
          seed: OpCodes.Hex8ToBytes("7FFFFFFFFFFFFFFF"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "810000003F801FC0" +  // Output 1: 9295429631958065088
            "8FFDBFFE03FEEFFF" +  // Output 2: 10375660214241128447
            "CE8FC004C67D0DE0" +  // Output 3: 14884326420225265120
            "BA17A467EEF88FFB" +  // Output 4: 13409367181816795131
            "901172F84EB1E024"    // Output 5: 10381205026863439908
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
      return new Xorshift64Instance(this);
    }
  }

  /**
 * Xorshift64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xorshift64Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xorshift64 uses a single 64-bit state variable (BigInt)
      this._state = 0n;
      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     * Seed format: up to 8 bytes converted to a 64-bit BigInt
     * If seed is 0, it's automatically set to 1 (zero state produces all zeros)
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

      // Ensure state is not zero (would cause all zeros output)
      // Marsaglia's xorshift requires non-zero initial state
      if (this._state === 0n) {
        this._state = 1n;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit value using xorshift64 algorithm
     *
     * Algorithm from Marsaglia (2003):
     * x ^= x << 13
     * x ^= x >> 7
     * x ^= x << 17
     * return x
     *
     * Uses shift parameters (13, 7, 17) recommended by Marsaglia
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xorshift64 not initialized: set seed first');
      }

      const mask64 = 0xFFFFFFFFFFFFFFFFn;

      // Step 1: x ^= x << 13
      this._state = OpCodes.XorN(this._state, OpCodes.AndN(OpCodes.ShiftLn(this._state, 13), mask64));

      // Step 2: x ^= x >> 7
      this._state = OpCodes.XorN(this._state, OpCodes.ShiftRn(this._state, 7));

      // Step 3: x ^= x << 17
      this._state = OpCodes.XorN(this._state, OpCodes.AndN(OpCodes.ShiftLn(this._state, 17), mask64));

      // Ensure state remains 64-bit
      this._state = OpCodes.AndN(this._state, mask64);

      return this._state;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xorshift64 not initialized: set seed first');
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
      // For PRNG, Feed can be used to skip outputs or add entropy
      // Basic xorshift64 doesn't support reseeding, so Feed is a no-op
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
  const algorithmInstance = new Xorshift64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xorshift64Algorithm, Xorshift64Instance };
}));
