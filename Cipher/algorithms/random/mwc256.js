/*
 * MWC256 (Multiply-with-Carry 256) Pseudo-Random Number Generator
 * Invented by George Marsaglia (2003)
 *
 * MWC256, also known as MWC8222, is a multiply-with-carry generator using
 * 256 32-bit elements. It has an extremely long period of approximately 2^8222,
 * making it suitable for high-quality simulations and embedded systems.
 *
 * This is the simplified version posted by Marsaglia on May 13, 2003:
 *
 *   t = a * Q[++i] + c     (64-bit arithmetic)
 *   c = t >> 32            (carry = upper 32 bits)
 *   Q[i] = t & 0xFFFFFFFF  (state = lower 32 bits)
 *   return Q[i]
 *
 * Where:
 *   Q[] = array of 256 × 32-bit values
 *   c = carry value (must be < 809430660)
 *   a = multiplier (809430660)
 *   i = current index (0-255, wraps around)
 *
 * The algorithm requires careful seeding: Q[] must be initialized with 256
 * random 32-bit values, and c must be initialized to a value < 809430660.
 * We use SplitMix64 for high-quality seeding.
 *
 * Reference: Marsaglia's post on comp.lang.c (May 13, 2003)
 * "MWC256, period about 2^8222, fares well in tests"
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

  class MWC256Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MWC256 (Multiply-with-Carry 256)";
      this.description = "MWC256 is a multiply-with-carry generator with 256 32-bit elements invented by George Marsaglia. It achieves an extraordinary period of approximately 2^8222 through an array-based MWC approach. Known for excellent statistical properties and efficiency in embedded systems.";
      this.inventor = "George Marsaglia";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Multiply-With-Carry";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes for 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Marsaglia's comp.lang.c Post (May 13, 2003) - MWC256 Reference Implementation",
          "https://groups.google.com/g/comp.lang.c/c/qZFQgKRCQGg"
        ),
        new LinkItem(
          "Wikipedia: Multiply-with-carry pseudorandom number generator",
          "https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator"
        ),
        new LinkItem(
          "Marsaglia's sci.math Post (Feb 25, 2003) - MWC256 Original Announcement",
          "https://groups.google.com/g/sci.math/c/k3kVM8KwR-s"
        ),
        new LinkItem(
          "Modern C Implementation of MWC256 (GitHub)",
          "https://github.com/HugoDaniel/mwc"
        )
      ];

      this.references = [
        new LinkItem(
          "Distribution Properties of MWC Generators",
          "https://www.ams.org/journals/mcom/1997-66-218/S0025-5718-97-00827-2/"
        ),
        new LinkItem(
          "Haskell mwc-random Package (MWC256 implementation)",
          "https://hackage.haskell.org/package/mwc-random"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors verified against Marsaglia's reference C implementation
      // Seeded using SplitMix64 to initialize Q array and carry value
      // Multiplier: 809430660 (from May 13, 2003 version)
      // Output in little-endian byte order (4 bytes per 32-bit value)
      this.tests = [
        {
          text: "Seed 0: First 5 outputs (20 bytes) - verified against C reference",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\generate_mwc256_vectors.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "853985DD4D44AD486EB3D35A389C85DF" +
            "4DAB581A"
          )
        },
        {
          text: "Seed 1: First 5 outputs (20 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\verify_mwc256.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "ABBF7382B9C63DE8072C39B1E81359E1" +
            "3FC9883B"
          )
        },
        {
          text: "Seed 42: First 5 outputs (20 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\verify_mwc256.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "03595D70F2FBE6A89E8AA771BA8DA0DF" +
            "E712EBDD"
          )
        },
        {
          text: "Seed 1234567: First 8 outputs (32 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\verify_mwc256.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "63B2D6EE7DDC289BF248367E4CE3D7CC" +
            "AB2B932C118E6002CEA2FCAAEA750B8B"
          )
        },
        {
          text: "Seed 987654321: First 8 outputs (32 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Hawkynt.github.io\\Cipher\\verify_mwc256.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000003ADE68B1"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "996730DE7C9749BE79D140F50648DE5C" +
            "D4A6C28BF4BFF9BA2884EC73BA3F879D"
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
      return new MWC256Instance(this);
    }
  }

  /**
 * MWC256 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MWC256Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MWC256 constants (from Marsaglia's May 13, 2003 implementation)
      this.ARRAY_SIZE = 256;                    // Q array size
      this.MULTIPLIER = 809430660n;             // Multiplier constant
      this.MAX_CARRY = 809430660n;              // Maximum carry value

      // Generator state
      this._Q = new Array(this.ARRAY_SIZE);     // State array Q[0..255]
      this._carry = 0n;                         // Carry value (must be < MAX_CARRY)
      this._index = 255;                        // Current index (starts at 255, wraps to 0)
      this._ready = false;

      // SplitMix64 constants for seeding
      this.GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      this.MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      this.MIX_CONST_2 = 0x94D049BB133111EBn;
    }

    /**
     * SplitMix64 function for high-quality array initialization
     * Modifies state in place and returns next value
     */
    _splitmix64(state) {
      const z1 = OpCodes.AndN(state + this.GOLDEN_GAMMA, 0xFFFFFFFFFFFFFFFFn);
      const z2 = OpCodes.AndN(OpCodes.XorN(z1, OpCodes.ShiftRn(z1, 30)) * this.MIX_CONST_1, 0xFFFFFFFFFFFFFFFFn);
      const z3 = OpCodes.AndN(OpCodes.XorN(z2, OpCodes.ShiftRn(z2, 27)) * this.MIX_CONST_2, 0xFFFFFFFFFFFFFFFFn);
      const result = OpCodes.AndN(OpCodes.XorN(z3, OpCodes.ShiftRn(z3, 31)), 0xFFFFFFFFFFFFFFFFn);
      return { state: z1, value: result };
    }

    /**
     * Seed using SplitMix64 to initialize Q array and carry
     * Matches the approach used in test vector generation
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit value for SplitMix64
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Initialize Q array using SplitMix64
      let currentState = seedValue;
      for (let i = 0; i < this.ARRAY_SIZE; ++i) {
        const result = this._splitmix64(currentState);
        currentState = result.state;
        // Use lower 32 bits of SplitMix64 output
        this._Q[i] = OpCodes.AndN(result.value, 0xFFFFFFFFn);
      }

      // Initialize carry using SplitMix64 (must be < MAX_CARRY)
      const carryResult = this._splitmix64(currentState);
      this._carry = carryResult.value % this.MAX_CARRY;

      // Reset index to 255 (will wrap to 0 on first call)
      this._index = 255;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using MWC256 algorithm
     *
     * Algorithm (Marsaglia's May 13, 2003 version):
     * 1. i = (i + 1) % 256
     * 2. t = a * Q[i] + c  (64-bit arithmetic)
     * 3. c = t >> 32       (carry = upper 32 bits)
     * 4. Q[i] = t & 0xFFFFFFFF (state = lower 32 bits)
     * 5. return Q[i]
     */
    _next32() {
      if (!this._ready) {
        throw new Error('MWC256 not initialized: set seed first');
      }

      // Step 1: Increment index with wraparound (0-255)
      this._index = Number(OpCodes.AndN(BigInt(this._index + 1), 0xFFn)); // Fast modulo 256 using bitmask

      // Step 2: t = a * Q[i] + c (64-bit arithmetic)
      const t = this.MULTIPLIER * this._Q[this._index] + this._carry;

      // Step 3: Extract carry (upper 32 bits)
      this._carry = OpCodes.ShiftRn(t, 32);

      // Step 4: Update state (lower 32 bits)
      this._Q[this._index] = OpCodes.AndN(t, 0xFFFFFFFFn);

      // Step 5: Return current state value
      return this._Q[this._index];
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('MWC256 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (little-endian order to match test vectors)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, BigInt(i * 8)), 0xFFn));
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
      // For PRNG, Feed is not used for standard operation
      // Could be used to add entropy in future versions
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
  const algorithmInstance = new MWC256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MWC256Algorithm, MWC256Instance };
}));
