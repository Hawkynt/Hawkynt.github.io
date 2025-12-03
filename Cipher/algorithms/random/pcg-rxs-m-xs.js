/*
 * PCG-RXS-M-XS (Permuted Congruential Generator - Random XorShift, Multiply, XorShift)
 * By Melissa E. O'Neill (2014)
 * 64-bit state with 32-bit output using RXS-M-XS permutation
 *
 * The most statistically powerful PCG variant combining:
 * 1. Random XorShift (variable shift from state bits)
 * 2. MCG Multiply (constant multiplier)
 * 3. Fixed XorShift (final mixing)
 *
 * This is the slowest but strongest output transformation,
 * passing BigCrush with minimum 36 bits of state.
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

  class PCGRxsMXsAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PCG-RXS-M-XS";
      this.description = "PCG variant using RXS-M-XS permutation (Random XorShift, Multiply, XorShift) - the most statistically powerful PCG output function. This 64-bit state generator passes BigCrush with excellent uniformity, combining variable xorshift based on state bits, MCG multiplication, and final xorshift for superior statistical properties.";
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
          "Apache Commons RNG: PcgRxsMXs64",
          "https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/main/java/org/apache/commons/rng/core/source64/PcgRxsMXs64.java"
        )
      ];

      // Test vectors from Apache Commons RNG PcgRxsMXs64Test.java
      // Reference: https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/test/java/org/apache/commons/rng/core/source64/PcgRxsMXs64Test.java
      this.tests = [
        {
          text: "PCG-RXS-M-XS seed=0x012de1babb3c4104, first 10 x 64-bit outputs (Apache Commons RNG)",
          uri: "https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/test/java/org/apache/commons/rng/core/source64/PcgRxsMXs64Test.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("012de1babb3c4104"),
          outputSize: 80, // 10 x 8 bytes = 80 bytes
          expected: OpCodes.Hex8ToBytes("a5ace6c92c5fa6c7ac02118387228764a6e796e49dc36e004713f32552134368a2ad36cb4e6b7cc96bbce7db898fa11d134cb18300fe9eb03f705c0d635cbc234bd7531b62a59b62413cc95f3c3e9952")
        },
        {
          text: "PCG-RXS-M-XS seed=0x012de1babb3c4104 + increment=0xc8161b4202294965, first 10 x 64-bit outputs (Apache Commons RNG)",
          uri: "https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/test/java/org/apache/commons/rng/core/source64/PcgRxsMXs64Test.java",
          input: null,
          seed: OpCodes.Hex8ToBytes("012de1babb3c4104"),
          sequence: OpCodes.Hex8ToBytes("c8161b4202294965"),
          outputSize: 80, // 10 x 8 bytes = 80 bytes
          expected: OpCodes.Hex8ToBytes("c147f2291fa40ccf8edbcbf8a5f4987761e05a1d5213f0b4c039f9369032e63895146e605b2e4a965480af6332262d037cbfb3a67a7145575c9f0a25eba415756e23dba403318dec7b230e581b829dbc")
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
      return new PCGRxsMXsInstance(this);
    }
  }

  /**
 * PCGRxsMXs cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PCGRxsMXsInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // PCG state (64-bit)
      this._state = 0n;

      // PCG constants for 64-bit LCG (from Apache Commons RNG)
      this.MULTIPLIER = 6364136223846793005n; // 64-bit LCG multiplier
      this.DEFAULT_INCREMENT = 1442695040888963407n; // Default increment (odd)

      // RXS-M-XS output constants (from Apache Commons RNG)
      this.MULTIPLY_CONSTANT = 0xAEF17502108EF2D9n; // -5840758589994634535L as unsigned

      this._increment = this.DEFAULT_INCREMENT;
      this._ready = false;
    }

    /**
     * Set seed value (64-bit)
     * Matches Apache Commons RNG initialization
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

      // Initialize state using Apache Commons RNG method:
      // state = bump(seed + increment)
      // where bump(x) = x * MULTIPLIER + increment
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      this._state = (seedValue + this._increment) * this.MULTIPLIER + this._increment;
      this._state = OpCodes.AndN(this._state, mask64);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set sequence/increment value
     * Increment must be odd for full period
     */
    set sequence(seqBytes) {
      if (!seqBytes || seqBytes.length === 0) {
        this._increment = this.DEFAULT_INCREMENT;
        return;
      }

      // Convert sequence bytes to 64-bit BigInt (big-endian)
      let seqValue = 0n;
      for (let i = 0; i < Math.min(seqBytes.length, 8); ++i) {
        seqValue = OpCodes.OrN(OpCodes.ShiftLn(seqValue, 8n), BigInt(seqBytes[i]));
      }

      // Ensure increment is odd (required for full period LCG)
      // Apache Commons RNG stores increment shr 1 to ensure odd on restoration
      // We directly ensure it's odd here
      this._increment = OpCodes.OrN(OpCodes.ShiftLn(seqValue, 1n), 1n);

      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      this._increment = OpCodes.AndN(this._increment, mask64);
    }

    get sequence() {
      return null;
    }

    /**
     * Generate a single 64-bit value using RXS-M-XS permutation
     *
     * RXS-M-XS (Random XorShift, Multiply, XorShift):
     * 1. Save current state
     * 2. Advance LCG state
     * 3. Apply permutation to OLD state
     *
     * Reference: Apache Commons RNG PcgRxsMXs64.next()
     */
    _next64() {
      if (!this._ready) {
        throw new Error('PCG not initialized: set seed first');
      }

      const mask64 = 0xFFFFFFFFFFFFFFFFn;

      // Save current state for output
      const oldState = this._state;

      // Advance LCG state: state = state * MULTIPLIER + INCREMENT
      this._state = this._state * this.MULTIPLIER + this._increment;
      this._state = OpCodes.AndN(this._state, mask64);

      // Apply RXS-M-XS permutation to old state
      return this._permute(oldState);
    }

    /**
     * RXS-M-XS permutation function
     *
     * Based on Apache Commons RNG implementation:
     * https://github.com/apache/commons-rng/blob/master/commons-rng-core/src/main/java/org/apache/commons/rng/core/source64/PcgRxsMXs64.java
     *
     * Steps:
     * 1. Random XorShift: word XOR (word right-shift by variable amount)
     * 2. Multiply: word multiplied by MULTIPLY_CONSTANT
     * 3. XorShift: word XOR (word right-shift by 43)
     */
    _permute(state) {
      const mask64 = 0xFFFFFFFFFFFFFFFFn;

      // Step 1: Random XorShift
      // Extract shift amount from top 5 bits: ShiftRn(state, 59) + 5
      const shiftAmount1 = Number(OpCodes.ShiftRn(state, 59n)) + 5;
      let word = OpCodes.XorN(state, OpCodes.ShiftRn(state, BigInt(shiftAmount1)));
      word = OpCodes.AndN(word, mask64);

      // Step 2: MCG Multiply
      word = word * this.MULTIPLY_CONSTANT;
      word = OpCodes.AndN(word, mask64);

      // Step 3: Fixed XorShift (shift right by 43)
      word = OpCodes.XorN(word, OpCodes.ShiftRn(word, 43n));
      word = OpCodes.AndN(word, mask64);

      return word;
    }

    /**
     * Generate a single 32-bit value
     * Extracts upper 32 bits from 64-bit output
     */
    _next32() {
      const value64 = this._next64();

      // Extract upper 32 bits for better distribution
      const value32 = Number(OpCodes.ShiftRn(value64, 32n));
      return OpCodes.ToUint32(value32);
    }

    /**
     * Generate random bytes
     * Outputs 64-bit values packed as bytes (big-endian)
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
  const algorithmInstance = new PCGRxsMXsAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PCGRxsMXsAlgorithm, PCGRxsMXsInstance };
}));
