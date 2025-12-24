/*
 * PCG (Permuted Congruential Generator)
 * By Melissa E. O'Neill (2014)
 * Based on the C# implementation with RXS-M-XS permutation
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

  class PCGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PCG (Permuted Congruential Generator)";
      this.description = "PCG is a family of simple, fast, space-efficient, statistically excellent pseudorandom number generators developed by Melissa O'Neill. This implementation uses 128-bit state with RXS-M-XS permutation outputting 64-bit values, combining a linear congruential generator with output mixing for excellent statistical properties.";
      this.inventor = "Melissa E. O'Neill";
      this.year = 2014;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudorandom Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 16, 8)]; // 64-bit or 128-bit seed

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
          "Rosetta Code: PCG32",
          "https://rosettacode.org/wiki/Pseudo-random_numbers/PCG32"
        )
      ];

      // Test vectors from official implementations
      // PCG64 (128-bit state, 64-bit output) with seed = 0
      // From abseil-cpp/absl/random/internal/pcg_engine_test.cc (VerifyGolden test line 275-320)
      this.tests = [
        {
          text: "PCG64 seed=0, first 9 x 64-bit outputs (Abseil golden vector)",
          uri: "https://github.com/abseil/abseil-cpp/blob/master/absl/random/internal/pcg_engine_test.cc#L275-L320",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 72, // 9 x 8 bytes = 72 bytes
          expected: OpCodes.Hex8ToBytes("01070196e695f8f1703ec840c59f4493e54954914b3a44fa96130ff204b9285e7d9fdef535ceb21a666feed42e1219a0981f685721c8326fad80710d6eab4ddae202c480b037a029")
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
      return new PCGInstance(this);
    }
  }

  /**
 * PCG cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PCGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // PCG state (128-bit)
      this._state = 0n; // UInt128 state
      this._sequence = null; // Increment (will be set to default on first seed)

      // PCG constants (from Abseil pcg64_2018_engine)
      // Multiplier: 0x2360ed051fc65da4 4385df649fccf645 (128-bit)
      this.MULTIPLIER = (0x2360ed051fc65da4n << 64n) | 0x4385df649fccf645n;

      // Default increment: 0x5851f42d4c957f2d 14057b7ef767814f (128-bit, must be odd)
      this.DEFAULT_INCREMENT = (0x5851f42d4c957f2dn << 64n) | 0x14057b7ef767814fn;

      this._ready = false;
    }

    /**
     * Set seed value
     * Can accept 64-bit or 128-bit seed as byte array
     * Matches Abseil pcg_engine::seed() behavior
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Use default increment if not set
      if (!this._sequence || this._sequence === 0n) {
        this._sequence = this.DEFAULT_INCREMENT;
      }

      // Initialize state using LCG: state = lcg(seed + increment)
      // lcg(s) = s * MULTIPLIER + INCREMENT
      // This matches Abseil: state_ = lcg(tmp + Params::increment())
      const increment = this._sequence;
      const tmp = seedValue;
      this._state = (tmp + increment) * this.MULTIPLIER + increment;

      // Mask to 128 bits
      const mask128 = (1n << 128n) - 1n;
      this._state = OpCodes.AndN(this._state, mask128);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set sequence/increment value (must be odd)
     */
    set sequence(seqBytes) {
      if (!seqBytes || seqBytes.length === 0) {
        this._sequence = 1n;
        return;
      }

      // Convert sequence bytes to BigInt
      let seqValue = 0n;
      for (let i = 0; i < seqBytes.length; ++i) {
        seqValue = OpCodes.OrN(OpCodes.ShiftLn(seqValue, 8), BigInt(seqBytes[i]));
      }

      // Ensure sequence is odd (required for full period LCG)
      this._sequence = OpCodes.OrN(seqValue, 1n);
    }

    get sequence() {
      return null;
    }

    /**
     * Generate a single 64-bit value
     * Based on C# implementation with RXS-M-XS permutation
     */
    _next64() {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      // Advance state: state = state * MULTIPLIER + INCREMENT
      let state = this._state;
      const increment = this._sequence;

      // Perform 128-bit multiplication and addition
      state = state * this.MULTIPLIER + increment;

      // Mask to 128 bits
      const mask128 = (1n << 128n) - 1n;
      state = OpCodes.AndN(state, mask128);

      this._state = state;

      // Apply RXS-M-XS permutation (from C# Permute function)
      return this._permute(state);
    }

    /**
     * XSL-RR-128-64 permutation function
     * Matches Abseil pcg_xsl_rr_128_64 mixer
     * This is the standard PCG64 output permutation
     */
    _permute(state) {
      // Extract rotation count from top 6 bits: rotate = state >> 122
      const rotate = Number(OpCodes.ShiftRn(state, 122n));

      // XOR with right-shifted state: state ^= state >> 64
      state = OpCodes.XorN(state, OpCodes.ShiftRn(state, 64n));

      // Extract lower 64 bits
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      let result = OpCodes.AndN(state, mask64);

      // Rotate right by 'rotate' bits (using 64-bit rotation)
      // rotr(s, rotate) = (s >> rotate)|(s << (64 - rotate))
      const rotateAmount = OpCodes.And32(rotate, 63); // Ensure rotate is 0-63
      if (rotateAmount !== 0) {
        const shifted = OpCodes.ShiftRn(result, BigInt(rotateAmount));
        const wrapped = OpCodes.AndN(OpCodes.ShiftLn(result, BigInt(64 - rotateAmount)), mask64);
        result = OpCodes.OrN(shifted, wrapped);
      }

      return result;
    }

    /**
     * Generate a single 32-bit value (for PCG32 compatibility)
     */
    _next32() {
      const value64 = this._next64();

      // Extract upper 32 bits for better distribution
      const value32 = Number(OpCodes.ShiftRn(value64, 32n));
      return OpCodes.ToUint32(value32); // Ensure unsigned 32-bit
    }

    /**
     * Generate random bytes
     * Outputs 64-bit values packed as bytes
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
        const value64 = this._next64();

        // Pack 64-bit value as 8 bytes (big-endian)
        for (let i = 56; i >= 0; i -= 8) {
          if (output.length < length) {
            output.push(Number(OpCodes.AndN(OpCodes.ShiftRn(value64, BigInt(i)), 0xFFn)));
          }
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
  const algorithmInstance = new PCGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PCGAlgorithm, PCGInstance };
}));
