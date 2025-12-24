/*
 * RANLUX24 Pseudo-Random Number Generator
 * C++ Standard Library Implementation (std::ranlux24)
 *
 * Based on Martin Lüscher's luxury-level random number generator from 1994.
 * RANLUX24 uses a subtract-with-borrow base engine (ranlux24_base) with
 * a discard block adaptor for improved statistical quality.
 *
 * Base Engine (ranlux24_base):
 *   subtract_with_carry_engine<uint_fast32_t, 24, 10, 24>
 *   - word_size: 24 bits
 *   - short_lag (s): 10
 *   - long_lag (r): 24
 *   - Recurrence: x[i] = (x[i-r] - x[i-s] - c) mod 2^24
 *
 * Discard Block Adaptor (ranlux24):
 *   discard_block_engine<ranlux24_base, 223, 23>
 *   - block_size (p): 223 total numbers generated per cycle
 *   - used_block (r): 23 numbers used (200 discarded for luxury level 3)
 *
 * This corresponds to RANLUX luxury level 3 with minimal correlation.
 * Period: approximately 10^171
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

  // RANLUX24 algorithm constants
  const WORD_SIZE = 24;           // 24-bit word size
  const SHORT_LAG = 10;           // Short lag parameter (s)
  const LONG_LAG = 24;            // Long lag parameter (r) - state size
  const MODULUS = 16777216;       // 2^24 modulus
  const MASK_24BIT = 0x00FFFFFF;  // 24-bit mask
  const DEFAULT_SEED = 19780503;  // C++ subtract_with_carry_engine default seed

  // Discard block parameters (luxury level 3)
  const BLOCK_SIZE = 223;         // Total numbers generated per cycle
  const USED_BLOCK = 23;          // Numbers used per cycle
  const DISCARD_COUNT = BLOCK_SIZE - USED_BLOCK; // 200 numbers discarded

  class Ranlux24Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RANLUX24";
      this.description = "RANLUX24 is the C++ standard library implementation of Martin Lüscher's luxury-level random number generator. It uses a 24-bit subtract-with-borrow base engine with a discard block adaptor that discards 200 out of every 223 generated numbers for improved statistical quality.";
      this.inventor = "Martin Lüscher";
      this.year = 1994;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(4, 4, 1)]; // 32-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "C++ Reference: std::ranlux24",
          "https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine"
        ),
        new LinkItem(
          "Original Paper: M. Lüscher (Computer Physics Communications 1994)",
          "https://www.sciencedirect.com/science/article/abs/pii/001046559490232X"
        ),
        new LinkItem(
          "C++ subtract_with_carry_engine Documentation",
          "https://en.cppreference.com/w/cpp/numeric/random/subtract_with_carry_engine"
        ),
        new LinkItem(
          "Martin Lüscher's RANLUX Page",
          "https://luscher.web.cern.ch/luscher/ranlux/"
        )
      ];

      this.references = [
        new LinkItem(
          "C++ Standard Library Random Number Generators",
          "https://en.cppreference.com/w/cpp/header/random"
        ),
        new LinkItem(
          "F. James: RANLUX Implementation (Computer Physics Communications 1994)",
          "https://www.sciencedirect.com/science/article/abs/pii/001046559490233X"
        )
      ];

      // Test vectors from C++ standard library implementation
      // Generated using g++ with -std=c++11
      this.tests = [
        {
          text: "C++ std::ranlux24 with seed 1, first 5 outputs",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine",
          input: null,
          seed: OpCodes.Unpack32LE(1),
          outputSize: 15, // 5 × 3 bytes (24-bit values)
          expected: [
            0x0C, 0x5F, 0x87,  // 8871692 (0x875F0C)
            0x1F, 0x15, 0x39,  // 3740959 (0x39151F)
            0x67, 0xFC, 0x4F,  // 5241959 (0x4FFC67)
            0x6C, 0xB6, 0x18,  // 1619564 (0x18B66C)
            0x59, 0x9F, 0xB0   // 11575129 (0xB09F59)
          ]
        },
        {
          text: "C++ std::ranlux24 with seed 314159265 (FORTRAN default), first 5 outputs",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine",
          input: null,
          seed: OpCodes.Unpack32LE(314159265),
          outputSize: 15,
          expected: [
            0x11, 0x7F, 0x61,  // 6389521 (0x617F11)
            0xA4, 0x02, 0x13,  // 1245860 (0x1302A4)
            0x31, 0x0C, 0x8A,  // 9047089 (0x8A0C31)
            0x02, 0xA7, 0x55,  // 5613314 (0x55A702)
            0x2F, 0xCF, 0xEA   // 15388463 (0xEACF2F)
          ]
        },
        {
          text: "C++ std::ranlux24 with seed 12345, first 5 outputs",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine",
          input: null,
          seed: OpCodes.Unpack32LE(12345),
          outputSize: 15,
          expected: [
            0x6B, 0xFB, 0xFA,  // 16448363 (0xFAFB6B)
            0xA5, 0x6B, 0xAF,  // 11496357 (0xAF6BA5)
            0xC2, 0x0B, 0x1C,  // 1838018 (0x1C0BC2)
            0x49, 0xA1, 0xB4,  // 11837769 (0xB4A149)
            0xD0, 0x80, 0x33   // 3375312 (0x3380D0)
          ]
        },
        {
          text: "C++ std::ranlux24 with seed 42, first 5 outputs",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine",
          input: null,
          seed: OpCodes.Unpack32LE(42),
          outputSize: 15,
          expected: [
            0x9F, 0x9B, 0x35,  // 3513247 (0x359B9F)
            0x68, 0x7A, 0x5D,  // 6126184 (0x5D7A68)
            0x41, 0x63, 0x1F,  // 2057025 (0x1F6341)
            0x63, 0xED, 0x0D,  // 912739 (0x0DED63)
            0xF0, 0x23, 0xFA   // 16393200 (0xFA23F0)
          ]
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
      return new Ranlux24Instance(this);
    }
  }

  /**
 * Ranlux24 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Ranlux24Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Base engine state (subtract_with_carry_engine)
      this._state = new Array(LONG_LAG);  // 24 state values (24-bit integers)
      this._carry = 0;                    // Carry bit
      this._index = 0;                    // Current index in state array

      // Discard block state
      this._blockIndex = 0;               // Position within current block (0-222)

      // Initialization status
      this._initialized = false;
      this._outputSize = 32;              // Default output size in bytes
    }

    /**
     * Initialize the generator with a 32-bit seed
     * Uses linear congruential generator to initialize state array
     * Follows C++ subtract_with_carry_engine specification:
     * - LCG parameters: a=40014, c=0, m=2147483563
     * - For w=24: n = floor(w/32)+1 = 1, so 1 LCG call per state element
     * - State array X[-r]...X[-1] initialized with LCG values mod 2^24
     * - Carry c = (X[-1] == 0) ? 1 : 0
     *
     * @param {Array} seedBytes - 4-byte array containing 32-bit seed
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._initialized = false;
        return;
      }

      // Convert seed bytes to 32-bit unsigned integer (little-endian)
      let seedValue = 0;
      for (let i = 0; i < Math.min(seedBytes.length, 4); ++i) {
        seedValue = OpCodes.ToUint32(OpCodes.Or32(seedValue, OpCodes.Shl32(seedBytes[i], i * 8)));
      }
      seedValue = OpCodes.ToUint32(seedValue); // Ensure unsigned

      // C++ spec: if seed == 0, use default_seed (19780503u)
      if (seedValue === 0) {
        seedValue = DEFAULT_SEED;
      }

      // C++ spec: apply modulus to seed value
      seedValue = seedValue % 2147483563;

      // Initialize state array using LCG
      // LCG: e(i+1) = (40014 * e(i)) mod 2147483563
      const LCG_A = 40014;
      const LCG_M = 2147483563;

      let lcgState = seedValue;

      // For w=24, n=1, so we call LCG once per state position
      // Initialize X[-r] through X[-1] (indices 0 through 23)
      for (let i = 0; i < LONG_LAG; ++i) {
        // Generate next LCG value
        lcgState = (LCG_A * lcgState) % LCG_M;
        // X[i] = (lcg_value * 2^0) mod 2^24 = lcg_value mod 2^24
        this._state[i] = OpCodes.ToUint32(OpCodes.And32(lcgState, MASK_24BIT));
      }

      // C++ spec: carry c = (X[-1] == 0) ? 1 : 0
      this._carry = (this._state[LONG_LAG - 1] === 0) ? 1 : 0;

      // Set index to 0 (start generating from beginning)
      this._index = 0;

      // Reset block index (discard block position)
      this._blockIndex = 0;

      this._initialized = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 24-bit random value using subtract-with-borrow
     * Base engine recurrence: x[i] = (x[i-s] - x[i-r] - c) mod 2^24
     * Where r=24 (LONG_LAG), s=10 (SHORT_LAG)
     * Note: x[i-r] is the current position (24 positions back from future)
     *       x[i-s] is 10 positions back from current
     *
     * @returns {number} 24-bit unsigned random value
     */
    _nextBase() {
      if (!this._initialized) {
        throw new Error('RANLUX24 not initialized: set seed first');
      }

      // Calculate indices for lagged Fibonacci
      // x[i] = x[i-s] - x[i-r] - c (where i-r wraps to current position)
      // shortIndex = i - 10 (circularly)
      // longIndex = i (current position, which is i-24 from future perspective)
      const shortIndex = (this._index + LONG_LAG - SHORT_LAG) % LONG_LAG;
      const longIndex = this._index;

      // Subtract with borrow: temp = state[i-s] - state[i-r] - carry
      // This is: state[shortIndex] - state[longIndex] - carry
      let temp = this._state[shortIndex] - this._state[longIndex] - this._carry;

      // Handle borrow (if result is negative)
      if (temp < 0) {
        temp += MODULUS;
        this._carry = 1;
      } else {
        this._carry = 0;
      }

      // Ensure 24-bit result
      temp = OpCodes.And32(temp, MASK_24BIT);

      // Update state
      this._state[longIndex] = temp;

      // Advance index (circular)
      this._index = (this._index + 1) % LONG_LAG;

      return temp;
    }

    /**
     * Generate next 24-bit value with discard block logic
     * Returns value only for first USED_BLOCK (23) numbers per cycle
     * Discards remaining DISCARD_COUNT (200) numbers
     *
     * @returns {number} 24-bit unsigned random value
     */
    _next24() {
      // Generate base engine value
      const value = this._nextBase();

      // Advance block index
      ++this._blockIndex;

      // If we've generated a full block, discard extra numbers
      if (this._blockIndex >= BLOCK_SIZE) {
        this._blockIndex = 0;
      }

      return value;
    }

    /**
     * Generate next output value (skips discarded values)
     * Only returns values from the used block (first 23 of every 223)
     *
     * @returns {number} 24-bit unsigned random value
     */
    _nextOutput() {
      // If we're past the used block, advance to next block
      while (this._blockIndex >= USED_BLOCK && this._blockIndex < BLOCK_SIZE) {
        this._nextBase();
        ++this._blockIndex;
        if (this._blockIndex >= BLOCK_SIZE) {
          this._blockIndex = 0;
        }
      }

      // Generate and return value from used block
      return this._next24();
    }

    /**
     * Generate random bytes
     * Outputs bytes in little-endian order (LSB first) from 24-bit values
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._initialized) {
        throw new Error('RANLUX24 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 24-bit values (3 bytes each)
      const fullValues = Math.floor(length / 3);
      for (let i = 0; i < fullValues; ++i) {
        const value = this._nextOutput();
        // Output in little-endian format (3 bytes)
        output.push(OpCodes.ToByte(value));
        output.push(OpCodes.ToByte(OpCodes.Shr32(value, 8)));
        output.push(OpCodes.ToByte(OpCodes.Shr32(value, 16)));
      }

      // Handle remaining bytes (if length not multiple of 3)
      const remainingBytes = length % 3;
      if (remainingBytes > 0) {
        const value = this._nextOutput();
        for (let i = 0; i < remainingBytes; ++i) {
          output.push(OpCodes.ToByte(OpCodes.Shr32(value, i * 8)));
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
      // For PRNG, Feed is not used - algorithm is deterministic based on seed only
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Generate output of specified size
      return this.NextBytes(this._outputSize);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }
  }

  // Register algorithm
  const algorithmInstance = new Ranlux24Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Ranlux24Algorithm, Ranlux24Instance };
}));
