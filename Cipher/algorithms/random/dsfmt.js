/*
 * dSFMT (Double precision SIMD-oriented Fast Mersenne Twister) dSFMT-521
 * Based on reference implementation by Mutsuo Saito and Makoto Matsumoto
 * Original algorithm published in 2007
 *
 * dSFMT-521 is a variant of Mersenne Twister optimized for generating double precision
 * floating point numbers directly without integer-to-float conversion. It has period 2^521-1.
 * This JavaScript implementation uses portable scalar version (no native SIMD support).
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

  // dSFMT-521 algorithm constants (from dSFMT-params521.h and dSFMT-params.h)
  const MEXP = 521;                        // Mersenne exponent
  const N = 4;                             // State array size: ((MEXP - 128) / 104 + 1) = 4
  const N64 = N * 2;                       // Size as 64-bit array (8)

  // dSFMT-521-specific parameters
  const POS1 = 3;                          // Position parameter
  const SL1 = 25;                          // Left shift parameter (bits)
  const SR = 12;                           // Right shift parameter (bits) - from dSFMT-params.h

  // 64-bit masks for recursion (from dSFMT-params521.h)
  const MSK1 = 0x000fbfefff77efff;         // Mask 1 (64-bit)
  const MSK2 = 0x000ffeebfbdfbfdf;         // Mask 2 (64-bit)

  // Split into 32-bit parts for JavaScript
  const MSK1_LOW = 0xff77efff;
  const MSK1_HIGH = 0x000fbfef;
  const MSK2_LOW = 0xfbdfbfdf;
  const MSK2_HIGH = 0x000ffeeb;

  // Fix values for period certification (64-bit)
  const FIX1_LOW = 0x61638469;
  const FIX1_HIGH = 0xcfb393d6;
  const FIX2_LOW = 0x83ae2adb;
  const FIX2_HIGH = 0xc1668678;

  // Periodicity control values (PCV)
  const PCV1_LOW = 0x00000000;
  const PCV1_HIGH = 0xccaa5880;
  const PCV2_LOW = 0x00000001;
  const PCV2_HIGH = 0x00000000;

  // Initialization constants
  const DEFAULT_SEED = 0;                  // Default seed value (from test vectors)
  const INIT_MULTIPLIER = 1812433253;      // Initialization multiplier

  // IEEE 754 double precision constants (from dSFMT-params.h)
  const LOW_MASK_LOW = 0xFFFFFFFF;         // Lower 32 bits: all 1s
  const LOW_MASK_HIGH = 0x000FFFFF;        // Upper 32 bits: keep 20 mantissa bits
  const HIGH_CONST_LOW = 0x00000000;       // Lower 32 bits of constant
  const HIGH_CONST_HIGH = 0x3FF00000;      // Upper 32 bits: exponent for [1.0, 2.0)

  class dSFMTAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "dSFMT-521 (Double precision SIMD-oriented Fast Mersenne Twister)";
      this.description = "dSFMT-521 is a variant of Mersenne Twister optimized for generating double precision floating point numbers directly. It has period 2^521-1 and generates IEEE 754 doubles in range [1, 2) with 52-bit mantissa precision, though this JavaScript version uses portable scalar implementation.";
      this.inventor = "Mutsuo Saito and Makoto Matsumoto";
      this.year = 2007;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(4, 4, 1)]; // 32-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official dSFMT Website",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/SFMT/"
        ),
        new LinkItem(
          "dSFMT Paper: A PRNG specialized in double precision floating point numbers",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/dSFMT.pdf"
        ),
        new LinkItem(
          "GitHub Repository: MersenneTwister-Lab/dSFMT",
          "https://github.com/MersenneTwister-Lab/dSFMT"
        )
      ];

      this.references = [
        new LinkItem(
          "Reference Implementation (C code)",
          "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.c"
        ),
        new LinkItem(
          "dSFMT-521 Parameters",
          "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT-params521.h"
        ),
        new LinkItem(
          "Test Vectors (double precision output)",
          "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt"
        )
      ];

      // Test vectors from official dSFMT.521.out.txt
      // Generated with init_gen_rand(0) in range [1, 2)
      this.tests = [
        {
          text: "dSFMT-521 with seed 0 (first 5 doubles in [1,2))",
          uri: "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(0),
          outputSize: 40, // 5 doubles = 40 bytes
          expected: OpCodes.ConcatArrays(
            OpCodes.DoubleToBytes(1.421944098478936),
            OpCodes.DoubleToBytes(1.957408659873361),
            OpCodes.DoubleToBytes(1.190111011127383),
            OpCodes.DoubleToBytes(1.632549872377003),
            OpCodes.DoubleToBytes(1.616831120464805)
          )
        },
        {
          text: "dSFMT-521 with seed 0 (doubles 6-10 in [1,2))",
          uri: "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(0),
          skipBytes: 40, // Skip first 5 doubles
          outputSize: 40,
          expected: OpCodes.ConcatArrays(
            OpCodes.DoubleToBytes(1.984390160895336),
            OpCodes.DoubleToBytes(1.643335574461273),
            OpCodes.DoubleToBytes(1.739347032660861),
            OpCodes.DoubleToBytes(1.228605414113949),
            OpCodes.DoubleToBytes(1.052731243538065)
          )
        },
        {
          text: "dSFMT-521 with seed 0 (doubles 11-15 in [1,2))",
          uri: "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(0),
          skipBytes: 80, // Skip first 10 doubles
          outputSize: 40,
          expected: OpCodes.ConcatArrays(
            OpCodes.DoubleToBytes(1.772446323308858),
            OpCodes.DoubleToBytes(1.114863567000073),
            OpCodes.DoubleToBytes(1.636605378654444),
            OpCodes.DoubleToBytes(1.087462000589056),
            OpCodes.DoubleToBytes(1.391044934734219)
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new dSFMTInstance(this);
    }
  }

  class dSFMTInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // dSFMT state - array of 128-bit integers represented as 2x64-bit words
      // Each 64-bit word is stored as two 32-bit values [low, high]
      // Total: (N+1) 128-bit blocks = (N+1)*2 64-bit values = (N+1)*4 32-bit values
      this._state = new Array((N + 1) * 4);
      for (let i = 0; i < (N + 1) * 4; ++i) {
        this._state[i] = 0;
      }

      this._index = N64;                   // Index into 64-bit values (marks uninitialized)
      this._outputSize = 40;               // Default output size (5 doubles = 40 bytes)
      this._skipBytes = 0;                 // Number of bytes to skip before generating output
    }

    /**
     * Initialize the generator with a 32-bit seed
     * Based on dSFMT dsfmt_init_gen_rand function
     *
     * @param {Array} seedBytes - 4-byte array containing 32-bit seed
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._index = N64; // Mark as uninitialized
        return;
      }

      // Convert seed bytes to 32-bit unsigned integer (little-endian)
      let seedValue = 0;
      for (let i = 0; i < Math.min(seedBytes.length, 4); ++i) {
        seedValue |= (seedBytes[i] << (i * 8));
      }
      seedValue = seedValue >>> 0; // Ensure unsigned

      // Initialize state array treating it as 32-bit words
      // state[0] = seed (low 32 bits), state[1] = 0 (high 32 bits)
      this._state[0] = seedValue;
      this._state[1] = 0;

      // Initialize remaining 64-bit values
      for (let i = 1; i < N64; ++i) {
        const idx = i * 2;
        const prevIdx = (i - 1) * 2;

        // Get previous 64-bit value
        const prevLow = this._state[prevIdx];
        const prevHigh = this._state[prevIdx + 1];

        // XOR with (prev >> 30) - using BigInt for accuracy
        const prev64 = (BigInt(prevHigh) << 32n) | BigInt(prevLow);
        const shift30 = prev64 >> 30n;
        const xored64 = prev64 ^ shift30;

        // Multiply by INIT_MULTIPLIER
        const mult64 = (xored64 * BigInt(INIT_MULTIPLIER)) & 0xFFFFFFFFFFFFFFFFn;

        // Add index
        const sum64 = (mult64 + BigInt(i)) & 0xFFFFFFFFFFFFFFFFn;

        // Store result
        this._state[idx] = Number(sum64 & 0xFFFFFFFFn) >>> 0;
        this._state[idx + 1] = Number(sum64 >> 32n) >>> 0;
      }

      // Apply initial mask to ensure IEEE 754 format
      this._initialMask();

      // Period certification
      this._periodCertification();

      // Reset index to trigger generation on first use
      this._index = N64;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Apply initial mask to ensure IEEE 754 format
     * Sets the exponent bits to produce values in [1, 2) range
     */
    _initialMask() {
      for (let i = 0; i < N64; ++i) {
        const idx = i * 2;
        // Apply LOW_MASK and set HIGH_CONST
        this._state[idx] = (this._state[idx] & LOW_MASK_LOW) >>> 0;
        this._state[idx + 1] = ((this._state[idx + 1] & LOW_MASK_HIGH) | HIGH_CONST_HIGH) >>> 0;
      }
    }

    /**
     * Period certification - ensures state has full period
     * Based on dSFMT period_certification function
     */
    _periodCertification() {
      // Inner product with first two 64-bit values
      const pcv = [PCV1_LOW, PCV1_HIGH, PCV2_LOW, PCV2_HIGH];

      let innerLow = 0;
      let innerHigh = 0;

      for (let i = 0; i < 2; ++i) {
        const idx = i * 2;
        const pcvIdx = i * 2;
        innerLow ^= this._state[idx] & pcv[pcvIdx];
        innerHigh ^= this._state[idx + 1] & pcv[pcvIdx + 1];
      }

      // Reduce to single bit
      let inner = innerLow ^ innerHigh;
      for (let i = 16; i > 0; i >>= 1) {
        inner ^= inner >>> i;
      }
      inner &= 1;

      // If inner is 0, modify state to ensure full period
      if (inner === 0) {
        this._state[0] ^= FIX1_LOW;
        this._state[1] = (this._state[1] ^ FIX1_HIGH) >>> 0;
        this._state[2] ^= FIX2_LOW;
        this._state[3] = (this._state[3] ^ FIX2_HIGH) >>> 0;

        // Re-apply initial mask
        this._initialMask();
      }
    }

    /**
     * dSFMT recursion formula (portable C version)
     * Based on dSFMT-common.h do_recursion for standard C
     *
     * lung->u[0] = (t0 << DSFMT_SL1) ^ (L1 >> 32) ^ (L1 << 32) ^ b->u[0];
     * lung->u[1] = (t1 << DSFMT_SL1) ^ (L0 >> 32) ^ (L0 << 32) ^ b->u[1];
     * r->u[0] = (lung->u[0] >> DSFMT_SR) ^ (lung->u[0] & DSFMT_MSK1) ^ t0;
     * r->u[1] = (lung->u[1] >> DSFMT_SR) ^ (lung->u[1] & DSFMT_MSK2) ^ t1;
     *
     * @param {number} aIdx - Index to 'a' block (128-bit = 4x32)
     * @param {number} bIdx - Index to 'b' block
     * @param {number} lungIdx - Index to 'lung' block (I/O parameter)
     * @param {number} rIdx - Index to 'r' output block
     */
    _doRecursion(aIdx, bIdx, lungIdx, rIdx) {
      // Load values using BigInt for 64-bit operations
      const t0 = (BigInt(this._state[aIdx + 1]) << 32n) | BigInt(this._state[aIdx]);
      const t1 = (BigInt(this._state[aIdx + 3]) << 32n) | BigInt(this._state[aIdx + 2]);
      const L0 = (BigInt(this._state[lungIdx + 1]) << 32n) | BigInt(this._state[lungIdx]);
      const L1 = (BigInt(this._state[lungIdx + 3]) << 32n) | BigInt(this._state[lungIdx + 2]);
      const b0 = (BigInt(this._state[bIdx + 1]) << 32n) | BigInt(this._state[bIdx]);
      const b1 = (BigInt(this._state[bIdx + 3]) << 32n) | BigInt(this._state[bIdx + 2]);

      // Update lung
      // lung[0] = (t0 << SL1) ^ (L1 >> 32) ^ (L1 << 32) ^ b0
      const newL0 = ((t0 << BigInt(SL1)) ^ (L1 >> 32n) ^ (L1 << 32n) ^ b0) & 0xFFFFFFFFFFFFFFFFn;

      // lung[1] = (t1 << SL1) ^ (L0 >> 32) ^ (L0 << 32) ^ b1
      const newL1 = ((t1 << BigInt(SL1)) ^ (L0 >> 32n) ^ (L0 << 32n) ^ b1) & 0xFFFFFFFFFFFFFFFFn;

      // Store lung
      this._state[lungIdx] = Number(newL0 & 0xFFFFFFFFn) >>> 0;
      this._state[lungIdx + 1] = Number(newL0 >> 32n) >>> 0;
      this._state[lungIdx + 2] = Number(newL1 & 0xFFFFFFFFn) >>> 0;
      this._state[lungIdx + 3] = Number(newL1 >> 32n) >>> 0;

      // Compute output r
      // r[0] = (lung[0] >> SR) ^ (lung[0] & MSK1) ^ t0
      const msk1 = BigInt(MSK1);
      const r0 = ((newL0 >> BigInt(SR)) ^ (newL0 & msk1) ^ t0) & 0xFFFFFFFFFFFFFFFFn;

      // r[1] = (lung[1] >> SR) ^ (lung[1] & MSK2) ^ t1
      const msk2 = BigInt(MSK2);
      const r1 = ((newL1 >> BigInt(SR)) ^ (newL1 & msk2) ^ t1) & 0xFFFFFFFFFFFFFFFFn;

      // Store result
      this._state[rIdx] = Number(r0 & 0xFFFFFFFFn) >>> 0;
      this._state[rIdx + 1] = Number(r0 >> 32n) >>> 0;
      this._state[rIdx + 2] = Number(r1 & 0xFFFFFFFFn) >>> 0;
      this._state[rIdx + 3] = Number(r1 >> 32n) >>> 0;
    }

    /**
     * Generate all N 128-bit blocks at once
     * Based on dSFMT gen_rand_array_c1o2 function
     */
    _genRandAll() {
      // lung is the extra state element at position N
      const lungIdx = N * 4;

      // Process first loop: i from 0 to N-POS1-1
      for (let i = 0; i < N - POS1; ++i) {
        const aIdx = i * 4;
        const bIdx = (i + POS1) * 4;
        const rIdx = i * 4;
        this._doRecursion(aIdx, bIdx, lungIdx, rIdx);
      }

      // Process second loop: i from N-POS1 to N-1
      for (let i = N - POS1; i < N; ++i) {
        const aIdx = i * 4;
        const bIdx = (i + POS1 - N) * 4;
        const rIdx = i * 4;
        this._doRecursion(aIdx, bIdx, lungIdx, rIdx);
      }

      this._index = 0;
    }

    /**
     * Convert 64-bit state value to IEEE 754 double in [1, 2)
     * The state already has the correct exponent bits set
     */
    _stateToDouble(idx) {
      // Read 64 bits as double
      const buffer = new ArrayBuffer(8);
      const uint32View = new Uint32Array(buffer);
      const float64View = new Float64Array(buffer);

      // Store in little-endian order
      uint32View[0] = this._state[idx];
      uint32View[1] = this._state[idx + 1];

      return float64View[0];
    }

    /**
     * Generate random doubles in [1, 2) range
     *
     * @param {number} count - Number of doubles to generate
     * @returns {Array} Array of double values
     */
    NextDoubles(count) {
      const output = [];

      for (let i = 0; i < count; ++i) {
        if (this._index >= N64) {
          this._genRandAll();
        }

        output.push(this._stateToDouble(this._index * 2));
        this._index += 1;
      }

      return output;
    }

    /**
     * Generate random bytes
     * Outputs doubles as 8-byte IEEE 754 values in little-endian order
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 8-byte doubles
      const fullDoubles = Math.floor(length / 8);
      const doubles = this.NextDoubles(fullDoubles);

      for (let i = 0; i < fullDoubles; ++i) {
        const bytes = OpCodes.DoubleToBytes(doubles[i]);
        output.push(...bytes);
      }

      // Handle remaining bytes (if length not multiple of 8)
      const remainingBytes = length % 8;
      if (remainingBytes > 0) {
        const extraDouble = this.NextDoubles(1)[0];
        const bytes = OpCodes.DoubleToBytes(extraDouble);
        for (let i = 0; i < remainingBytes; ++i) {
          output.push(bytes[i]);
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is not used in standard dSFMT
      // The algorithm is deterministic based on initial seed only
    }

    Result() {
      // Handle skipBytes parameter for test vectors
      if (this._skipBytes > 0) {
        this.NextBytes(this._skipBytes);
        this._skipBytes = 0;
      }

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

    /**
     * Set number of bytes to skip before generating output
     * Used for testing specific positions in the output stream
     */
    set skipBytes(count) {
      this._skipBytes = count;
    }

    get skipBytes() {
      return this._skipBytes;
    }
  }

  // Register algorithm
  const algorithmInstance = new dSFMTAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { dSFMTAlgorithm, dSFMTInstance };
}));
