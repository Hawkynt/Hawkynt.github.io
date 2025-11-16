/*
 * Lehmer128 (128-bit MCG) Pseudo-Random Number Generator
 * Based on D. H. Lehmer's multiplicative congruential generator (1951)
 * 128-bit variant described as "the simplest PRNG that passes BigCrush"
 *
 * Uses 128-bit state with multiplicative constant from PCG research.
 * Passes BigCrush statistical tests and PractRand up to 32 TB.
 *
 * Reference: https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html
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

  // Lehmer128 multiplier constant (from PCG research - excellent spectral properties)
  // M8=0.71005, M16=0.66094, M24=0.61455
  const MULTIPLIER = 0x0fc94e3bf4e9ab32866458cd56f5e605n;

  // Mask for 128-bit arithmetic
  const MASK_128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
  const MASK_64 = 0xFFFFFFFFFFFFFFFFn;

  // SplitMix64 constants for seeding (matching Lehmer64 implementation)
  const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
  const MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
  const MIX_CONST_2 = 0x94D049BB133111EBn;

  class Lehmer128Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lehmer128";
      this.description = "Lehmer128 is a 128-bit multiplicative congruential generator (MCG) considered the minimal standard for modern 64-bit PRNGs. Based on Lehmer's original MCG (1951) with a carefully chosen multiplier from PCG research providing excellent spectral properties. It passes BigCrush and PractRand tests up to 32 TB, making it the simplest PRNG suitable for serious use.";
      this.inventor = "D. H. Lehmer (original), optimized variant";
      this.year = 1951;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Multiplicative Congruential Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
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
          "PCG Random: Does it beat the minimal standard?",
          "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html"
        ),
        new LinkItem(
          "P. L'Ecuyer: Tables of linear congruential generators (1999)",
          "https://doi.org/10.1090/S0025-5718-99-00996-5"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01: BigCrush Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "PractRand: Practical Random Number Generator Testing",
          "http://pracrand.sourceforge.net/"
        )
      ];

      // Test vectors generated from implementation validation
      // Using SplitMix64-based seeding (matching Lehmer64 pattern)
      this.tests = [
        {
          text: "Seed 1 (SplitMix64 initialization): First 5 outputs",
          uri: "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "C63F51F8161177A4" + // Output 1
            "E6AECDFDF79BC7D4" + // Output 2
            "8C9CBC663AEB8109" + // Output 3
            "75A8D07CEF123243" + // Output 4
            "F567B888929801D9"   // Output 5
          )
        },
        {
          text: "Seed 0 (SplitMix64 initialization): First 5 outputs",
          uri: "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "8B0F2B375C2D67C7" +
            "4C1D2980CD9389D4" +
            "4CD926F3F2F9DDAB" +
            "04E60C22EE2F62EF" +
            "143862AC141E19D3"
          )
        },
        {
          text: "Seed 42 (SplitMix64 initialization): First 5 outputs",
          uri: "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "85B9AAC0926BDC09" +
            "599B8A2E6781AEDF" +
            "539F0AA577FAB11F" +
            "1B382C2F9E57B996" +
            "E86006E444071702"
          )
        },
        {
          text: "Direct state 0x123456789ABCDEF0123456789ABCDEF0: First 3 outputs",
          uri: "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html",
          input: null,
          state: OpCodes.Hex8ToBytes("123456789ABCDEF0123456789ABCDEF0"),
          outputSize: 24, // 3 outputs × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "B66DF1DA3BD6E94C" +
            "D8B959473B03B162" +
            "11208F133BAFCE12"
          )
        },
        {
          text: "State initialized to 1 (minimal non-zero state): First 10 outputs",
          uri: "https://www.pcg-random.org/posts/does-it-beat-the-minimal-standard.html",
          input: null,
          state: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          outputSize: 80, // 10 outputs × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "0FC94E3BF4E9AB32" + // First output (upper 64 bits of MULTIPLIER)
            "9F4C53132CB5B55A" + // Second output
            "04F16BBAA6C209FE" + // Third output
            "9C0827F89F0F242F" + // Fourth output
            "5B5349DDF2CA0286" + // Fifth output
            "9A09A2D3E4F52267" + // Sixth output
            "F4E9E997E821367B" + // Seventh output
            "D23CF34FC72F4155" + // Eighth output
            "56A2D7E343D7F1B5" + // Ninth output
            "73B5F20E34A8238C"   // Tenth output
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
      return new Lehmer128Instance(this);
    }
  }

  /**
 * Lehmer128 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Lehmer128Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Lehmer128 state (128-bit BigInt)
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
     * Uses SplitMix64 to initialize 128-bit state from 64-bit seed (matching Lehmer64)
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

      // Ensure state is odd (MCG requirement - state must be coprime to modulus)
      this._state = OpCodes.OrN(this._state, 1n);

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
        throw new Error('Lehmer128 not initialized: set seed first');
      }

      // Multiply 128-bit state by multiplier (produces 256-bit result, keep lower 128 bits)
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
        throw new Error('Lehmer128 not initialized: set seed first');
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
      // Not implemented in basic Lehmer128 - would require mixing
      // For now, Feed is a no-op (Lehmer128 is deterministic)
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
  const algorithmInstance = new Lehmer128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Lehmer128Algorithm, Lehmer128Instance };
}));
