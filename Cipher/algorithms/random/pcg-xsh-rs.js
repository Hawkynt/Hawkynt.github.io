/*
 * PCG-XSH-RS (Permuted Congruential Generator - XOR-Shift-High with Random Shift)
 * By Melissa E. O'Neill (2014)
 * 64-bit state with 32-bit output using XSH-RS permutation
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

  class PCGXshRsAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PCG-XSH-RS";
      this.description = "PCG variant using 64-bit state with XSH-RS permutation (XOR-shift-high with random shift) to output 32-bit values. Requires 49 bits of state to pass BigCrush tests. This variant trades slightly lower statistical quality for simpler implementation compared to XSH-RR.";
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
          "Rust PCG Implementation",
          "https://github.com/rust-random/rand/blob/master/rand_pcg/src/pcg64.rs"
        )
      ];

      // Test vectors generated from XSH-RS implementation
      // Formula: (((state >> 22) ^ state) >> ((state >> 61) + 22))
      // LCG: state = state * 0x5851f42d4c957f2d + increment
      this.tests = [
        {
          text: "PCG-XSH-RS seed=42, increment=54, first 6 x 32-bit outputs",
          uri: "https://www.pcg-random.org/",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002a"), // 42 in decimal
          increment: OpCodes.Hex8ToBytes("0000000000000036"), // 54 in decimal
          outputSize: 24, // 6 x 4 bytes = 24 bytes
          expected: OpCodes.Hex8ToBytes("522bd5a371b43492b011fa35e704af294a1aaabfaf9bfaaa")
        },
        {
          text: "PCG-XSH-RS seed=0, increment=1, first 6 x 32-bit outputs",
          uri: "https://www.pcg-random.org/",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          increment: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 24, // 6 x 4 bytes = 24 bytes
          expected: OpCodes.Hex8ToBytes("0b18fcd8bb5f56897033235de0b78bd0faba6f9ea2df44bd")
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
      return new PCGXshRsInstance(this);
    }
  }

  /**
 * PCGXshRs cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PCGXshRsInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // PCG state (64-bit)
      this._state = 0n;
      this._increment = null; // Will be set on seed or increment property

      // PCG constants for 64-bit LCG (standard PCG multiplier)
      // Same as used in pcg32 variants
      this.MULTIPLIER = 0x5851f42d4c957f2dn; // 64-bit multiplier

      this._ready = false;
    }

    /**
     * Set increment value
     * Note: Increment should be odd for full period LCG, but we allow any value
     * This allows configuring the sequence stream
     */
    set increment(incrementBytes) {
      if (!incrementBytes || incrementBytes.length === 0) {
        this._increment = 1n; // Default to 1 (odd)
        return;
      }

      // Convert increment bytes to 64-bit BigInt (big-endian)
      let incrementValue = 0n;
      for (let i = 0; i < Math.min(incrementBytes.length, 8); ++i) {
        incrementValue = OpCodes.OrN(OpCodes.ShiftLn(incrementValue, 8n), BigInt(incrementBytes[i]));
      }

      // Use the value as-is (caller should ensure it's odd for full period)
      this._increment = incrementValue;
    }

    get increment() {
      return null; // Cannot retrieve increment from PRNG state
    }

    /**
     * Set seed value (64-bit)
     * Matches PCG seed initialization: state = lcg(seed + increment)
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

      // Set default increment if not already set
      if (this._increment === null) {
        this._increment = 1n; // Default increment (odd)
      }

      // Initialize state: state = lcg(seed + increment)
      // This matches standard PCG initialization
      const tmp = seedValue;
      this._state = (tmp + this._increment) * this.MULTIPLIER + this._increment;

      // Mask to 64 bits
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      this._state = OpCodes.AndN(this._state, mask64);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate a single 32-bit value using XSH-RS permutation
     *
     * XSH-RS permutation (XOR-shift-high with random shift)
     * This is simpler than XSH-RR but requires more state bits for BigCrush (49 vs 39)
     *
     * Steps:
     * 1. XOR-shift-high: shift state right 22 bits, XOR with original state
     * 2. Random shift: extract shift amount from top 3 bits, add 22
     * 3. Shift the XOR result right by the random shift amount
     * 4. Extract lower 32 bits as output
     */
    _next32() {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      // Advance LCG state: state = state * MULTIPLIER + INCREMENT
      let state = this._state;
      state = state * this.MULTIPLIER + this._increment;

      // Mask to 64 bits
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      state = OpCodes.AndN(state, mask64);

      this._state = state;

      // Apply XSH-RS permutation
      return this._permute(state);
    }

    /**
     * XSH-RS-64-32 permutation function
     *
     * Reference implementation behavior:
     * - XOR-shift-high reduces 64 bits down while mixing
     * - Random shift amount from top 3 bits provides additional mixing
     * - Final result is 32 bits extracted from the shifted value
     */
    _permute(state) {
      // Step 1: XOR-shift-high (shift right 22, XOR with original)
      const shifted22 = OpCodes.ShiftRn(state, 22n);
      const xorred = OpCodes.XorN(shifted22, state);

      // Step 2: Extract random shift amount from top 3 bits (state >> 61)
      const shiftAmount = Number(OpCodes.ShiftRn(state, 61n)) + 22;

      // Step 3: Apply random shift
      const randomShifted = OpCodes.ShiftRn(xorred, BigInt(shiftAmount));

      // Step 4: Extract lower 32 bits as output
      const result = Number(OpCodes.AndN(randomShifted, 0xFFFFFFFFn));

      return OpCodes.ToDWord(result); // Ensure unsigned 32-bit
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
  const algorithmInstance = new PCGXshRsAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PCGXshRsAlgorithm, PCGXshRsInstance };
}));
