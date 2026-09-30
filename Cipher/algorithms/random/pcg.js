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
   * @returns {PCGInstance|null} New cipher instance
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
    /**
     * @param {PCGAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {int32} */
      this._outputSize = 0; // 0 selects the default of 32 bytes

      // PCG state (128-bit)
      /** @type {BigInt} */
      this._state = 0n; // UInt128 state
      /** @type {BigInt} */
      this._sequence = null; // Increment (will be set to default on first seed)

      // PCG constants (from Abseil pcg64_2018_engine)
      // Multiplier: 0x2360ed051fc65da4 4385df649fccf645 (128-bit)
      /** @type {BigInt} */
      this.MULTIPLIER = OpCodes.OrN(OpCodes.ShiftLn(0x2360ed051fc65da4n, 64n), 0x4385df649fccf645n);

      // Default increment: 0x5851f42d4c957f2d 14057b7ef767814f (128-bit, must be odd)
      /** @type {BigInt} */
      this.DEFAULT_INCREMENT = OpCodes.OrN(OpCodes.ShiftLn(0x5851f42d4c957f2dn, 64n), 0x14057b7ef767814fn);

      /** @type {boolean} */
      this._ready = false;
    }

    /**
     * Set seed value
     * Can accept 64-bit or 128-bit seed as byte array
     * Matches Abseil pcg_engine::seed() behavior
     * @param {uint8[]|null} seedBytes - Seed bytes
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to BigInt (big-endian)
      /** @type {BigInt} */
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
      /** @type {BigInt} */
      const increment = this._sequence;
      /** @type {BigInt} */
      const tmp = seedValue;
      /** @type {BigInt} */
      const sum = tmp + increment;
      /** @type {BigInt} */
      const product = sum * this.MULTIPLIER;
      this._state = product + increment;

      // Mask to 128 bits
      /** @type {BigInt} */
      const mask128 = OpCodes.ShiftLn(1n, 128) - 1n;
      this._state = OpCodes.AndN(this._state, mask128);

      this._ready = true;
    }

    /**
     * @returns {uint8[]|null} The seed cannot be read back: null
     */
    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set sequence/increment value (must be odd)
     * @param {uint8[]} seqBytes - Increment, big-endian
     */
    set sequence(seqBytes) {
      if (!seqBytes || seqBytes.length === 0) {
        /** @type {BigInt} */
        this._sequence = 1n;
        return;
      }

      // Convert sequence bytes to BigInt
      /** @type {BigInt} */
      let seqValue = 0n;
      for (let i = 0; i < seqBytes.length; ++i) {
        seqValue = OpCodes.OrN(OpCodes.ShiftLn(seqValue, 8), BigInt(seqBytes[i]));
      }

      // Ensure sequence is odd (required for full period LCG)
      this._sequence = OpCodes.OrN(seqValue, 1n);
    }

    /**
     * @returns {uint8[]} The parameter cannot be read back: null
     */
    get sequence() {
      return null;
    }

    /**
     * Generate a single 64-bit value
     * Based on C# implementation with RXS-M-XS permutation
     * @returns {BigInt} Next 64-bit output
     */
    _next64() {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      // Advance state: state = state * MULTIPLIER + INCREMENT
      /** @type {BigInt} */
      const increment = this._sequence;

      // Perform 128-bit multiplication and addition
      /** @type {BigInt} */
      const product = this._state * this.MULTIPLIER;
      /** @type {BigInt} */
      const advanced = product + increment;

      // Mask to 128 bits
      /** @type {BigInt} */
      const mask128 = OpCodes.ShiftLn(1n, 128) - 1n;
      /** @type {BigInt} */
      const s = OpCodes.AndN(advanced, mask128);

      this._state = s;

      // Apply RXS-M-XS permutation (from C# Permute function)
      return this._permute(s);
    }

    /**
     * XSL-RR-128-64 permutation function
     * Matches Abseil pcg_xsl_rr_128_64 mixer
     * This is the standard PCG64 output permutation
     * @param {BigInt} s - 128-bit state
     * @returns {BigInt} 64-bit output
     */
    _permute(s) {
      // Extract rotation count from top 6 bits: rotate = state >> 122
      /** @type {int32} */
      const rotate = Number(OpCodes.ShiftRn(s, 122));

      // XOR with right-shifted state: state ^= state >> 64
      /** @type {BigInt} */
      const folded = OpCodes.XorN(s, OpCodes.ShiftRn(s, 64));

      // Extract lower 64 bits
      /** @type {BigInt} */
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      /** @type {BigInt} */
      let result = OpCodes.AndN(folded, mask64);

      // Rotate right by 'rotate' bits (using 64-bit rotation)
      // rotr(s, rotate) = (s >> rotate)|(s << (64 - rotate))
      /** @type {int32} */
      const rotateAmount = OpCodes.And32(rotate, 63); // Ensure rotate is 0-63
      if (rotateAmount !== 0) {
        /** @type {BigInt} */
        const shifted = OpCodes.ShiftRn(result, rotateAmount);
        /** @type {BigInt} */
        const wrapped = OpCodes.AndN(OpCodes.ShiftLn(result, 64 - rotateAmount), mask64);
        result = OpCodes.OrN(shifted, wrapped);
      }

      return result;
    }

    /**
     * Generate a single 32-bit value (for PCG32 compatibility)
     * @returns {uint32} Upper 32 bits of the next output
     */
    _next32() {
      /** @type {BigInt} */
      const value64 = this._next64();

      // Extract upper 32 bits for better distribution
      /** @type {uint32} */
      const value32 = Number(OpCodes.ShiftRn(value64, 32));
      return OpCodes.ToUint32(value32); // Ensure unsigned 32-bit
    }

    /**
     * Generate random bytes
     * Outputs 64-bit values packed as bytes
     *
     * @param {int32} length - Number of random bytes to generate
     * @returns {uint8[]} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      if (length === 0) {
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      /** @type {uint8[]} */
      const output = [];

      while (output.length < length) {
        /** @type {BigInt} */
        const value64 = this._next64();

        // Pack 64-bit value as 8 bytes (big-endian)
        for (let i = 56; i >= 0; i -= 8) {
          if (output.length < length) {
            /** @type {uint8} */
            const b = Number(OpCodes.AndN(OpCodes.ShiftRn(value64, i), 0xFFn));
            output.push(b);
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
      /** @type {int32} */
      const size = (this._outputSize ? this._outputSize : 32);
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     * @param {int32} size - Bytes returned by Result()
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    /**
     * @returns {int32} Bytes returned by Result()
     */
    get outputSize() {
      return (this._outputSize ? this._outputSize : 32);
    }
  }

  // Register algorithm
  const algorithmInstance = new PCGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PCGAlgorithm, PCGInstance };
}));
