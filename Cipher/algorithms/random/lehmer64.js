/*
 * Lehmer64 (64-bit MCG) Pseudo-Random Number Generator
 * Based on D. H. Lehmer's multiplicative congruential generator (1951)
 * Optimized 64-bit variant by Daniel Lemire (2019)
 *
 * Uses 128-bit arithmetic internally with a single 64-bit multiplier.
 * Passes BigCrush statistical tests and is extremely fast on modern 64-bit systems.
 *
 * Reference: https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h
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

  // Lehmer64 multiplier constant (from P. L'Ecuyer's research)
  const MULTIPLIER = 0xda942042e4dd58b5n;

  // Mask for 128-bit arithmetic
  const MASK_128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
  const MASK_64 = 0xFFFFFFFFFFFFFFFFn;

  // SplitMix64 constants for seeding (matching reference implementation)
  const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
  const MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
  const MIX_CONST_2 = 0x94D049BB133111EBn;

  class Lehmer64Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lehmer64";
      this.description = "Lehmer64 is a 64-bit multiplicative congruential generator (MCG) that uses 128-bit arithmetic internally for high-quality output. Based on Lehmer's original MCG (1951) but optimized for modern 64-bit systems by Daniel Lemire (2019). It's extremely fast and passes BigCrush statistical tests.";
      this.inventor = "D. H. Lehmer (original), Daniel Lemire (64-bit variant)";
      this.year = 1951;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Multiplicative Congruential Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // 1-16 bytes (up to 128-bit state)

      // Documentation
      this.documentation = [
        new LinkItem(
          "D. H. Lehmer: Mathematical methods in large-scale computing units (1951)",
          "https://doi.org/10.2307/2002781"
        ),
        new LinkItem(
          "Daniel Lemire: The fastest conventional random number generator that can pass Big Crush?",
          "https://lemire.me/blog/2019/03/19/the-fastest-conventional-random-number-generator-that-can-pass-big-crush/"
        ),
        new LinkItem(
          "Reference Implementation (C)",
          "https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h"
        ),
        new LinkItem(
          "P. L'Ecuyer: Tables of linear congruential generators (1999)",
          "https://doi.org/10.1090/S0025-5718-99-00996-5"
        )
      ];

      this.references = [
        new LinkItem(
          "PCG Random: Does it beat the minimal standard?",
          "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html"
        ),
        new LinkItem(
          "TestU01: BigCrush Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors generated from reference implementation
      // Using SplitMix64-based seeding (matches reference implementation)
      this.tests = [
        {
          text: "Seed 1 (SplitMix64 initialization): First 5 outputs",
          uri: "https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "D013072351F5FC50" + // Output 1
            "F5116E796B986D61" + // Output 2
            "CFE0853995D9C983" + // Output 3
            "8AF139B0BD173856" + // Output 4
            "F4BA5B360862DA7F"   // Output 5
          )
        },
        {
          text: "Seed 0 (SplitMix64 initialization): First 5 outputs",
          uri: "https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "C112A6A15FADB6F6" +
            "EC0339A6F15317E2" +
            "84824B46BBD0A6F9" +
            "E2F53AAA2457752D" +
            "85DE4D73C42A63B9"
          )
        },
        {
          text: "Seed 42 (SplitMix64 initialization): First 5 outputs",
          uri: "https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "CEAE6504D53CE75F" +
            "EBBE9B2AEB6593FC" +
            "1349D62B159350F9" +
            "A92566124EC338FB" +
            "BC24BD3B1BE4839F"
          )
        },
        {
          text: "Direct state 0x123456789ABCDEF0123456789ABCDEF0: First 3 outputs",
          uri: "https://github.com/lemire/testingRNG/blob/master/source/lehmer64.h",
          input: null,
          state: OpCodes.Hex8ToBytes("123456789ABCDEF0123456789ABCDEF0"),
          outputSize: 24, // 3 outputs × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "BF82F820876E23A9" +
            "6664D56F05045B88" +
            "3CF48E8A467812B9"
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
      return new Lehmer64Instance(this);
    }
  }

  /**
 * Lehmer64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Lehmer64Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Lehmer64 state (128-bit BigInt)
      this._state = 0n;
      this._ready = false;
    }

    /**
     * SplitMix64 stateless function for seeding
     * Matches reference implementation initialization
     *
     * @param {BigInt} seed - Seed value
     * @param {number} index - Index (0 or 1 for high/low 64-bit parts)
     * @returns {BigInt} 64-bit output
     */
    _splitmix64_stateless(seed, index) {
      let state = OpCodes.AndN(seed + (BigInt(index) * GOLDEN_GAMMA), MASK_64);

      // SplitMix64 mixing function
      let z = state;
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 30)) * MIX_CONST_1, MASK_64);
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 27)) * MIX_CONST_2, MASK_64);
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 31)), MASK_64);

      return z;
    }

    /**
     * Set seed value (1-8 bytes for 64-bit seed, or use state property for full 128-bit)
     * Uses SplitMix64 to initialize 128-bit state from 64-bit seed (matching reference)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Initialize 128-bit state using SplitMix64 (matches reference implementation)
      const high = this._splitmix64_stateless(seedValue, 0);
      const low = this._splitmix64_stateless(seedValue, 1);
      this._state = OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftLn(high, 64), low), MASK_128);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set state directly (for testing with specific 128-bit values)
     * Allows setting full 128-bit state instead of using seed initialization
     */
    set state(stateBytes) {
      if (!stateBytes || stateBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert state bytes to 128-bit BigInt (big-endian)
      let stateValue = 0n;
      for (let i = 0; i < stateBytes.length && i < 16; ++i) {
        stateValue = OpCodes.OrN(OpCodes.ShiftLn(stateValue, 8), BigInt(stateBytes[i]));
      }

      this._state = OpCodes.AndN(stateValue, MASK_128);
      this._ready = true;
    }

    get state() {
      return null; // Cannot retrieve state
    }

    /**
     * Generate next 64-bit value
     * Algorithm: state *= MULTIPLIER; return upper 64 bits of state
     *
     * @returns {BigInt} Next 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Lehmer64 not initialized: set seed first');
      }

      // Multiply 128-bit state by multiplier (produces 128-bit result, masked)
      this._state = OpCodes.AndN(this._state * MULTIPLIER, MASK_128);

      // Return upper 64 bits as output
      return OpCodes.AndN(OpCodes.ShiftRn(this._state, 64), MASK_64);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Lehmer64 not initialized: set seed first');
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
          const shiftAmount = (7 - i) * 8;
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, BigInt(shiftAmount)), 0xFFn));
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
      // Not implemented in basic Lehmer64 - would require mixing
      // For now, Feed is a no-op (Lehmer64 is deterministic)
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
  const algorithmInstance = new Lehmer64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Lehmer64Algorithm, Lehmer64Instance };
}));
