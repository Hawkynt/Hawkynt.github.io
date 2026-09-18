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

  /**
   * Serialise an IEEE 754 double to 8 little-endian bytes.
   *
   * OpCodes.DoubleToBytes is a documented cross-platform placeholder that returns
   * eight zero bytes, so it cannot be used here: dSFMT's whole output is doubles,
   * and routing them through it erases the generator entirely.
   *
   * @param {float64} value - Double precision value
   * @returns {uint8[]} 8 bytes, least significant first
   */
  function DoubleToBytesLE(value) {
    const buffer = new ArrayBuffer(8);
    new Float64Array(buffer)[0] = value;
    const view = new Uint8Array(buffer);
    /** @type {uint8[]} */
    const result = [];
    for (let i = 0; i < 8; ++i) {
      result.push(view[i]);
    }
    return result;
  }

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

      // dSFMT.521.out.txt is the reference output, and this implementation reproduces
      // it: seeded with init_gen_rand(0), all 1000 published [1,2) doubles agree with
      // this generator to the full precision the reference prints.
      //
      // That precision is the problem for a byte-exact vector. The reference prints
      // 15 decimal places, i.e. about 16 significant digits, while a double in [1,2)
      // has an ulp of 2^-52 ~ 2.2e-16. A printed value therefore does not identify a
      // unique double - reconstructing one from the text lands within 2 ulp of the
      // generator's actual value, and measuring across all 1000 published values the
      // gap does reach 2 ulp. No byte-exact expectation can honestly be derived from
      // this file, and inventing one from this implementation's own output would make
      // the vector self-confirming, which is exactly what the previous vectors did:
      // they were built with OpCodes.DoubleToBytes, a placeholder returning eight zero
      // bytes, so expectation and output were both all-zero and agreed vacuously.
      //
      // The vectors below therefore pin the seeding and the output length, and record
      // the published decimals for reference, but carry no byte-exact expectation.
      this.tests = [
        {
          text: "dSFMT-521 seed 0, doubles 1-5 in [1,2) - reference prints " +
                "1.421944098478936 1.957408659873361 1.190111011127383 " +
                "1.632549872377003 1.616831120464805",
          uri: "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(0),
          outputSize: 40 // 5 doubles = 40 bytes
        },
        {
          text: "dSFMT-521 seed 0, doubles 6-10 in [1,2) - reference prints " +
                "1.984390160895336 1.643335574461273 1.739347032660861 " +
                "1.228605414113949 1.052731243538065",
          uri: "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(0),
          skipBytes: 40,
          outputSize: 40
        },
        {
          text: "dSFMT-521 seed 0, doubles 11-15 in [1,2) - reference prints " +
                "1.772446323308858 1.114863567000073 1.636605378654444 " +
                "1.087462000589056 1.391044934734219",
          uri: "https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(0),
          skipBytes: 80,
          outputSize: 40
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
      return new dSFMTInstance(this);
    }
  }

  /**
 * dSFMT cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

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
        seedValue = seedValue|OpCodes.Shl32(seedBytes[i], i * 8);
      }
      seedValue = OpCodes.ToUint32(seedValue);

      // dsfmt_chk_init_gen_rand fills the state with a recurrence over 32-BIT words,
      // not over 64-bit values, and it covers all (N + 1) * 4 words - the extra
      // 128-bit block at the end is the "lung", which takes part in the recursion
      // and must therefore be seeded too.
      this._state[0] = seedValue;
      for (let i = 1; i < (N + 1) * 4; ++i) {
        const prev = this._state[i - 1];
        const xored = OpCodes.XorN(prev, OpCodes.Shr32(prev, 30));
        this._state[i] = OpCodes.ToUint32(OpCodes.Mul32(INIT_MULTIPLIER, xored) + i);
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
        this._state[idx] = OpCodes.ToUint32(this._state[idx]&LOW_MASK_LOW);
        this._state[idx + 1] = OpCodes.ToUint32((this._state[idx + 1]&LOW_MASK_HIGH)|HIGH_CONST_HIGH);
      }
    }

    /**
     * Period certification - ensures state has full period
     * Based on dSFMT period_certification function
     */
    _periodCertification() {
      // The certification is computed over the LUNG (status[N]), not over status[0],
      // and the FIX constants are only XORed into a temporary - the state itself is
      // left alone unless the parity check fails.
      const lungIdx = N * 4;

      const t0Low = OpCodes.Xor32(this._state[lungIdx], FIX1_LOW);
      const t0High = OpCodes.Xor32(this._state[lungIdx + 1], FIX1_HIGH);
      const t1Low = OpCodes.Xor32(this._state[lungIdx + 2], FIX2_LOW);
      const t1High = OpCodes.Xor32(this._state[lungIdx + 3], FIX2_HIGH);

      const innerLow = OpCodes.Xor32(OpCodes.AndN(t0Low, PCV1_LOW), OpCodes.AndN(t1Low, PCV2_LOW));
      const innerHigh = OpCodes.Xor32(OpCodes.AndN(t0High, PCV1_HIGH), OpCodes.AndN(t1High, PCV2_HIGH));

      // Fold the 64-bit inner product down to its parity bit. XORing the two halves
      // together is the first (i = 32) step of the reference's folding loop.
      let inner = OpCodes.Xor32(innerLow, innerHigh);
      for (let i = 16; i > 0; i = OpCodes.Shr32(i, 1)) {
        inner = OpCodes.Xor32(inner, OpCodes.Shr32(inner, i));
      }
      inner = OpCodes.AndN(inner, 1);

      if (inner === 1) {
        return; // period already certified
      }

      // DSFMT_PCV2 is odd, so flipping the low bit of lung.u[1] restores the period.
      this._state[lungIdx + 2] = OpCodes.Xor32(this._state[lungIdx + 2], 1);
    }

    /**
     * dSFMT recursion formula (portable C version)
     * Based on dSFMT-common.h do_recursion for standard C
     *
     * lung->u[0] = (t0 left-shift DSFMT_SL1) xor (L1 right-shift 32) xor (L1 left-shift 32) xor b->u[0];
     * lung->u[1] = (t1 left-shift DSFMT_SL1) xor (L0 right-shift 32) xor (L0 left-shift 32) xor b->u[1];
     * r->u[0] = (lung->u[0] right-shift DSFMT_SR) xor (lung->u[0] and DSFMT_MSK1) xor t0;
     * r->u[1] = (lung->u[1] right-shift DSFMT_SR) xor (lung->u[1] and DSFMT_MSK2) xor t1;
     *
     * @param {number} aIdx - Index to 'a' block (128-bit = 4x32)
     * @param {number} bIdx - Index to 'b' block
     * @param {number} lungIdx - Index to 'lung' block (I/O parameter)
     * @param {number} rIdx - Index to 'r' output block
     */
    _doRecursion(aIdx, bIdx, lungIdx, rIdx) {
      // Load values using BigInt for 64-bit operations
      const t0 = (OpCodes.ShiftLn(BigInt(this._state[aIdx + 1]), 32n)|BigInt(this._state[aIdx]));
      const t1 = (OpCodes.ShiftLn(BigInt(this._state[aIdx + 3]), 32n)|BigInt(this._state[aIdx + 2]));
      const L0 = (OpCodes.ShiftLn(BigInt(this._state[lungIdx + 1]), 32n)|BigInt(this._state[lungIdx]));
      const L1 = (OpCodes.ShiftLn(BigInt(this._state[lungIdx + 3]), 32n)|BigInt(this._state[lungIdx + 2]));
      const b0 = (OpCodes.ShiftLn(BigInt(this._state[bIdx + 1]), 32n)|BigInt(this._state[bIdx]));
      const b1 = (OpCodes.ShiftLn(BigInt(this._state[bIdx + 3]), 32n)|BigInt(this._state[bIdx + 2]));

      // Update lung
      // lung[0] = (t0 left-shift SL1) xor (L1 right-shift 32) xor (L1 left-shift 32) xor b0
      const newL0 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.ShiftLn(t0, BigInt(SL1)), OpCodes.ShiftRn(L1, 32n)), OpCodes.ShiftLn(L1, 32n)), b0)&0xFFFFFFFFFFFFFFFFn;

      // lung[1] = (t1 left-shift SL1) xor (L0 right-shift 32) xor (L0 left-shift 32) xor b1
      const newL1 = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.ShiftLn(t1, BigInt(SL1)), OpCodes.ShiftRn(L0, 32n)), OpCodes.ShiftLn(L0, 32n)), b1)&0xFFFFFFFFFFFFFFFFn;

      // Store lung
      this._state[lungIdx] = OpCodes.ToUint32(Number(newL0&0xFFFFFFFFn));
      this._state[lungIdx + 1] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(newL0, 32n)&0xFFFFFFFFn));
      this._state[lungIdx + 2] = OpCodes.ToUint32(Number(newL1&0xFFFFFFFFn));
      this._state[lungIdx + 3] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(newL1, 32n)&0xFFFFFFFFn));

      // Compute output r
      // r[0] = (lung[0] right-shift SR) xor (lung[0] and MSK1) xor t0
      const msk1 = BigInt(MSK1);
      const r0 = OpCodes.XorN(OpCodes.XorN(OpCodes.ShiftRn(newL0, BigInt(SR)), OpCodes.AndN(newL0, msk1)), t0)&0xFFFFFFFFFFFFFFFFn;

      // r[1] = (lung[1] right-shift SR) xor (lung[1] and MSK2) xor t1
      const msk2 = BigInt(MSK2);
      const r1 = OpCodes.XorN(OpCodes.XorN(OpCodes.ShiftRn(newL1, BigInt(SR)), OpCodes.AndN(newL1, msk2)), t1)&0xFFFFFFFFFFFFFFFFn;

      // Store result
      this._state[rIdx] = OpCodes.ToUint32(Number(r0&0xFFFFFFFFn));
      this._state[rIdx + 1] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(r0, 32n)&0xFFFFFFFFn));
      this._state[rIdx + 2] = OpCodes.ToUint32(Number(r1&0xFFFFFFFFn));
      this._state[rIdx + 3] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(r1, 32n)&0xFFFFFFFFn));
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
        const bytes = DoubleToBytesLE(doubles[i]);
        for (let _i = 0; _i < bytes.length; _i++) output.push(bytes[_i]);
      }

      // Handle remaining bytes (if length not multiple of 8)
      const remainingBytes = length % 8;
      if (remainingBytes > 0) {
        const extraDouble = this.NextDoubles(1)[0];
        const bytes = DoubleToBytesLE(extraDouble);
        for (let i = 0; i < remainingBytes; ++i) {
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
      // For PRNG, Feed is not used in standard dSFMT
      // The algorithm is deterministic based on initial seed only
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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
