/*
 * PCG-XSL-RR-64-32 (Permuted Congruential Generator - XOR-Shift-Low with Random Rotation)
 * By Melissa E. O'Neill (2014)
 * 64-bit state with 32-bit output using XSH-RR permutation
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

  class PCGXslRrAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PCG-XSL-RR-64-32";
      this.description = "PCG variant using 64-bit state with XSH-RR permutation (XOR-shift-high with random rotation) to output 32-bit values. This is the standard PCG32 algorithm, combining a simple LCG with sophisticated output mixing for excellent statistical properties in a compact implementation.";
      this.inventor = "Melissa E. O'Neill";
      this.year = 2014;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Permuted Congruential Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official PCG Website",
          "https://www.pcg-random.org/"
        ),
        new LinkItem(
          "Original Paper: PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms for Random Number Generation",
          "https://www.pcg-random.org/pdf/toms-oneill-pcg-family-v1.02.pdf"
        ),
        new LinkItem(
          "Wikipedia: Permuted Congruential Generator",
          "https://en.wikipedia.org/wiki/Permuted_congruential_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "PCG C Implementation (Official)",
          "https://github.com/imneme/pcg-c"
        ),
        new LinkItem(
          "PCG C++ Implementation (Official)",
          "https://github.com/imneme/pcg-cpp"
        ),
        new LinkItem(
          "Abseil PCG Engine Implementation",
          "https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine.h"
        )
      ];

      // Test vectors from Abseil pcg32_2018_engine golden test
      // pcg_xsh_rr_64_32 with seed=0, first 20 outputs
      // From: https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine_test.cc#L487-L534
      this.tests = [
        {
          text: "PCG32 (XSH-RR-64-32) seed=0, first 21 x 32-bit outputs (Abseil golden vector)",
          uri: "https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine_test.cc#L487-L534",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 84, // 21 x 4 bytes = 84 bytes
          expected: OpCodes.Hex8ToBytes("7a7ecbd989fd6c06ae646aa8cd3cf9456204b303198c858549fce611d1e9297a142d9440ee75f56b473a9117e3a45903bce807a1e54e5f4d497d6c5161829166a740474b031912a89de3defad266dbf10f38bebb")
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
      return new PCGXslRrInstance(this);
    }
  }

  /**
 * PCGXslRr cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PCGXslRrInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // PCG state (64-bit)
      this._state = 0n;

      // PCG constants for 64-bit LCG (from Abseil pcg32_2018_engine)
      // These are the standard PCG multiplier and increment
      this.MULTIPLIER = 0x5851f42d4c957f2dn; // 64-bit multiplier
      this.INCREMENT = 0x14057b7ef767814fn; // 64-bit increment (must be odd)

      this._ready = false;
    }

    /**
     * Set seed value (64-bit)
     * Matches Abseil pcg_engine::seed() behavior
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < Math.min(seedBytes.length, 8); ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8n), BigInt(seedBytes[i]));
      }

      // Initialize state: state = lcg(seed + increment)
      // This matches Abseil: state_ = lcg(tmp + Params::increment())
      const tmp = seedValue;
      this._state = (tmp + this.INCREMENT) * this.MULTIPLIER + this.INCREMENT;

      // Mask to 64 bits
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      this._state = OpCodes.AndN(this._state, mask64);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate a single 32-bit value using XSH-RR permutation
     * Based on Abseil pcg_xsh_rr_64_32 mixer
     *
     * XSH-RR permutation (XOR-shift-high with random rotation):
     * 1. Extract rotation count from top 5 bits (shift right 59)
     * 2. XOR-shift-high: shift right 18, XOR with state, shift right 27
     * 3. Random rotation: rotate right by extracted count
     */
    _next32() {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      // Advance LCG state: state = state * MULTIPLIER + INCREMENT
      let state = this._state;
      state = state * this.MULTIPLIER + this.INCREMENT;

      // Mask to 64 bits
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      state = OpCodes.AndN(state, mask64);

      this._state = state;

      // Apply XSH-RR permutation (from Abseil pcg_xsh_rr_64_32)
      return this._permute(state);
    }

    /**
     * XSH-RR-64-32 permutation function
     * Matches Abseil pcg_xsh_rr_64_32 mixer
     *
     * Reference: absl/random/internal/pcg_engine.h lines 260-267
     * Uses rotate-right on XOR-shifted state with top bits as rotation count
     */
    _permute(state) {
      // Extract rotation count from top 5 bits (shift right 59)
      const rotate = Number(OpCodes.ShiftRn(state, 59n));

      // XOR-shift-high: shift 18, XOR, shift 27
      const shifted18 = OpCodes.ShiftRn(state, 18n);
      const xorred = OpCodes.XorN(shifted18, state);
      const shifted27 = OpCodes.ShiftRn(xorred, 27n);

      // Extract lower 32 bits as the xorshifted value
      const xorshifted = Number(OpCodes.AndN(shifted27, 0xFFFFFFFFn));

      // Rotate right by 'rotate' bits using OpCodes
      const result = OpCodes.RotR32(xorshifted, rotate);

      return result;
    }

    /**
     * Generate random bytes
     * Outputs 32-bit values packed as bytes (big-endian)
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      while (output.length < length) {
        const value32 = this._next32();

        // Unpack 32-bit value to 4 bytes (big-endian) using OpCodes
        const bytes = OpCodes.Unpack32BE(value32);

        // Add bytes to output (truncate if needed)
        for (let i = 0; i < bytes.length && output.length < length; ++i) {
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
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic PCG - would require mixing
      // For now, Feed is a no-op (PCG is deterministic)
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
  const algorithmInstance = new PCGXslRrAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PCGXslRrAlgorithm, PCGXslRrInstance };
}));
