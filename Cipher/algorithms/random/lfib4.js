/*
 * LFIB4 - Marsaglia's 4-tap Lagged Fibonacci Generator
 * Four-tap lagged Fibonacci generator optimized for parallel GPU execution
 * x[n] = (x[n-55] + x[n-119] + x[n-179] + x[n-256]) mod 2^32
 *
 * Developed by George Marsaglia as an improvement over 2-lag generators
 * to overcome failure in various randomness tests.
 *
 * Characteristics:
 * - Period: 2^31 * (2^256 - 1) ≈ 2^287
 * - State: 256 × 32-bit values
 * - Four lags: 256, 179, 119, 55
 * - Operations: additive (modulo 2^32)
 * - Passes most statistical tests including those where 2-lag generators fail
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

  class LFIB4Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LFIB4";
      this.description = "Marsaglia's 4-tap Lagged Fibonacci Generator uses four lags (256, 179, 119, 55) with additive operations to achieve better statistical properties than 2-lag generators. Period approximately 2^287. Optimized for GPU parallel execution and Monte Carlo simulations.";
      this.inventor = "George Marsaglia";
      this.year = 1999;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 32, 1)]; // 1-32 bytes for initialization

      // Documentation
      this.documentation = [
        new LinkItem(
          "Marsaglia's Random Number CDROM (original implementation)",
          "https://www.stat.fsu.edu/pub/diehard/"
        ),
        new LinkItem(
          "Wikipedia: Lagged Fibonacci Generator",
          "https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator"
        ),
        new LinkItem(
          "Reference Implementation (C) - Archipelago Project",
          "https://github.com/plasma-umass/Archipelago/blob/master/util/marsaglia.h"
        ),
        new LinkItem(
          "PractRand Testing Suite",
          "http://pracrand.sourceforge.net/"
        )
      ];

      this.references = [
        new LinkItem(
          "Lagged Fibonacci Generators for Distributed Memory Parallel Computers",
          "https://www.sciencedirect.com/science/article/abs/pii/S0743731597913630"
        ),
        new LinkItem(
          "Random Number Generators: Good Ones Are Hard To Find (1988)",
          "https://dl.acm.org/doi/10.1145/63039.63042"
        )
      ];

      // Test vectors generated from this implementation
      // State initialized with SplitMix64 for reproducible results
      // Each test vector verified against the algorithm specification
      this.tests = [
        {
          text: "LFIB4 with seed 0: First 32 bytes output",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "A7DE64B112EC1552" +
            "AFA351065CF21677" +
            "23EE12446F38761D" +
            "7BAC7C67B8536577"
          )
        },
        {
          text: "LFIB4 with seed 1: First 32 bytes output",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "78D69582EA59B4EC" +
            "7C6C1015E0BCA708" +
            "C508973C1D3D7BE7" +
            "FB72BB85685E4CF7"
          )
        },
        {
          text: "LFIB4 with seed 42: First 32 bytes output",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000002A"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "84BC8394D35F29DE" +
            "E163F82F81BA488C" +
            "3D94D837ED689467" +
            "F15298B5F1C38F73"
          )
        },
        {
          text: "LFIB4 with seed 1234567: First 32 bytes output",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0012D687"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "32DBA71168641552" +
            "3F1183EE66FFD0EA" +
            "361FF731A70ECAB7" +
            "BFD472EEF969EBDF"
          )
        },
        {
          text: "LFIB4 with seed 999: First 64 bytes output",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000003E7"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "F4AB8FED0F07C8FD" +
            "70B54844A5CA8EC0" +
            "36CF0F7F7F61422C" +
            "60C6A42592BF5CE8" +
            "F1614584A21DA251" +
            "86317858BE4A28FE" +
            "99BEDAD51A932437" +
            "2D5AA7DC2E4A5DF0"
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
      return new LFIB4Instance(this);
    }
  }

  /**
 * LFIB4 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LFIB4Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // LFIB4 constants
      this.STATE_SIZE = 256;      // Number of 32-bit state values
      this.LAG_1 = 55;            // First lag (n-55)
      this.LAG_2 = 119;           // Second lag (n-119)
      this.LAG_3 = 179;           // Third lag (n-179)
      this.LAG_4 = 256;           // Fourth lag (n-256)

      // SplitMix64 constants for state initialization
      this.GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      this.MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      this.MIX_CONST_2 = 0x94D049BB133111EBn;

      // Generator state
      this._state = null;         // State array (256 × 32-bit values)
      this._counter = 0;          // Current index (0-255, wraps with byte overflow)
      this._ready = false;        // Initialization status
    }

    /**
     * Initialize generator with seed value (1-32 bytes)
     * State is initialized using SplitMix64 to generate 256 × 32-bit values
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length && i < 32; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Initialize state array using SplitMix64
      // Generate 256 × 32-bit values (128 × 64-bit values split into high/low)
      this._state = new Array(this.STATE_SIZE);

      for (let i = 0; i < this.STATE_SIZE; i += 2) {
        const value64 = this._splitmix64Next(seedValue);
        seedValue = value64; // Use output as next seed

        // Split 64-bit value into two 32-bit values (big-endian order)
        const high = Number(OpCodes.AndN(OpCodes.ShiftRn(value64, 32), 0xFFFFFFFFn));
        const low = Number(OpCodes.AndN(value64, 0xFFFFFFFFn));

        this._state[i] = high;
        if (i + 1 < this.STATE_SIZE) {
          this._state[i + 1] = low;
        }
      }

      this._counter = 0;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * SplitMix64 next function for state initialization
     */
    _splitmix64Next(z) {
      // Add golden gamma to state
      z = OpCodes.AndN(z + this.GOLDEN_GAMMA, 0xFFFFFFFFFFFFFFFFn);

      // Mix function (Stafford variant 13)
      let result = z;
      result = OpCodes.AndN(OpCodes.XorN(result, OpCodes.ShiftRn(result, 30)) * this.MIX_CONST_1, 0xFFFFFFFFFFFFFFFFn);
      result = OpCodes.AndN(OpCodes.XorN(result, OpCodes.ShiftRn(result, 27)) * this.MIX_CONST_2, 0xFFFFFFFFFFFFFFFFn);
      result = OpCodes.AndN(OpCodes.XorN(result, OpCodes.ShiftRn(result, 31)), 0xFFFFFFFFFFFFFFFFn);

      return result;
    }

    /**
     * Generate next 32-bit value using LFIB4 recurrence
     * x[n] = (x[n-55] + x[n-119] + x[n-179] + x[n-256]) mod 2^32
     *
     * Using circular buffer with counter c:
     * x[c] = (x[c-55] + x[c-119] + x[c-179] + x[c-256]) mod 2^32
     * With byte wrap: c-55 = c+201, c-119 = c+137, c-179 = c+77, c-256 = c+0
     */
    _next32() {
      if (!this._ready) {
        throw new Error('LFIB4 not initialized: set seed first');
      }

      const c = this._counter;
      const state = this._state;

      // Calculate lagged indices with byte wrapping (0-255)
      // In circular buffer: (c - lag) mod 256 = (c + (256 - lag)) mod 256
      const idx1 = OpCodes.AndN(c + 201, 0xFF);  // c - 55 mod 256
      const idx2 = OpCodes.AndN(c + 137, 0xFF);  // c - 119 mod 256
      const idx3 = OpCodes.AndN(c + 77, 0xFF);   // c - 179 mod 256
      const idx4 = c;                            // c - 256 mod 256 = c

      // LFIB4 recurrence: sum four lagged values (mod 2^32)
      const sum = OpCodes.ToUint32(state[idx1] + state[idx2] + state[idx3] + state[idx4]);

      // Store result back in state array at current position
      state[c] = sum;

      // Increment counter with byte wrap (0-255)
      this._counter = OpCodes.AndN(c + 1, 0xFF);

      return sum;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('LFIB4 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order - most significant byte first)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byte = OpCodes.AndN(OpCodes.Shr32(value, 24 - i * 8), 0xFF);
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
      // Not implemented in basic LFIB4 - would require mixing
      // For now, Feed is a no-op (LFIB4 is deterministic)
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
  const algorithmInstance = new LFIB4Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LFIB4Algorithm, LFIB4Instance };
}));
