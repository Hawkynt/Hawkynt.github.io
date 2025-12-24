/*
 * SFMT (SIMD-oriented Fast Mersenne Twister) SFMT19937
 * Based on reference implementation by Mutsuo Saito and Makoto Matsumoto
 * Original algorithm published at MCQMC 2006
 *
 * SFMT19937 is a variant of Mersenne Twister optimized for modern CPUs with SIMD instructions.
 * It generates 128-bit pseudorandom integers at each step and has period 2^19937-1.
 * JavaScript implementation uses portable C version (no native SIMD support).
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

  // SFMT19937 algorithm constants
  const MEXP = 19937;                    // Mersenne exponent
  const N = Math.floor(MEXP / 128) + 1;  // State array size: (19937/128)+1 = 156+1 = 157 (but C gives 156)
  // NOTE: C integer division 19937/128 = 155, then +1 = 156, giving N32=624
  // But SFMT documentation states N=157 for MEXP=19937, giving N32=628
  // Testing shows N=156 matches reference implementation
  const N32 = N * 4;                     // Size as 32-bit array (624)
  const N64 = N * 2;                     // Size as 64-bit array (312)

  // SFMT19937-specific parameters from SFMT-params19937.h
  const POS1 = 122;
  const SL1 = 18;
  const SL2 = 1;
  const SR1 = 11;
  const SR2 = 1;
  const MSK1 = 0xdfffffef;
  const MSK2 = 0xddfecb7f;
  const MSK3 = 0xbffaffff;
  const MSK4 = 0xbffffff6;
  const PARITY1 = 0x00000001;
  const PARITY2 = 0x00000000;
  const PARITY3 = 0x00000000;
  const PARITY4 = 0x13c9e684;

  const DEFAULT_SEED = 1234;             // Default seed value
  const INIT_MULTIPLIER = 1812433253;    // Initialization multiplier

  class SFMTAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SFMT-19937 (SIMD-oriented Fast Mersenne Twister)";
      this.description = "SFMT19937 is a variant of Mersenne Twister optimized for modern CPUs with SIMD instructions. It generates 128-bit blocks with period 2^19937-1 and faster generation than standard MT19937, though this JavaScript version uses portable C implementation without native SIMD.";
      this.inventor = "Mutsuo Saito and Makoto Matsumoto";
      this.year = 2006;
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
          "Official SFMT Website",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/SFMT/"
        ),
        new LinkItem(
          "SFMT Paper: SIMD-oriented Fast Mersenne Twister (MCQMC 2006)",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/sfmt.pdf"
        ),
        new LinkItem(
          "GitHub Repository: MersenneTwister-Lab/SFMT",
          "https://github.com/MersenneTwister-Lab/SFMT"
        ),
        new LinkItem(
          "Master's Thesis: Variants of Mersenne Twister (Mutsuo Saito)",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/SFMT/M062821.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "Reference Implementation (C code)",
          "https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.c"
        ),
        new LinkItem(
          "SFMT19937 Parameters",
          "https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT-params19937.h"
        ),
        new LinkItem(
          "Test Vectors (32-bit output)",
          "https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.19937.out.txt"
        )
      ];

      // Test vectors from official SFMT.19937.out.txt
      // Generated with init_gen_rand(1234)
      this.tests = [
        {
          text: "SFMT19937 with seed 1234 (first 10 outputs)",
          uri: "https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.19937.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(1234),
          outputSize: 40, // 10 uint32 values = 40 bytes
          expected: OpCodes.ConcatArrays([
            OpCodes.Unpack32LE(3440181298),
            OpCodes.Unpack32LE(1564997079),
            OpCodes.Unpack32LE(1510669302),
            OpCodes.Unpack32LE(2930277156),
            OpCodes.Unpack32LE(1452439940),
            OpCodes.Unpack32LE(3796268453),
            OpCodes.Unpack32LE(423124208),
            OpCodes.Unpack32LE(2143818589),
            OpCodes.Unpack32LE(3827219408),
            OpCodes.Unpack32LE(2987036003)
          ])
        },
        {
          text: "SFMT19937 with seed 1234 (outputs 11-20)",
          uri: "https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.19937.out.txt",
          input: null,
          seed: OpCodes.Unpack32LE(1234),
          skipBytes: 40, // Skip first 10 outputs
          outputSize: 40,
          expected: OpCodes.ConcatArrays([
            OpCodes.Unpack32LE(2674978610),
            OpCodes.Unpack32LE(1536842514),
            OpCodes.Unpack32LE(2027035537),
            OpCodes.Unpack32LE(2534897563),
            OpCodes.Unpack32LE(1686527725),
            OpCodes.Unpack32LE(545368292),
            OpCodes.Unpack32LE(1489013321),
            OpCodes.Unpack32LE(1370534252),
            OpCodes.Unpack32LE(4231012796),
            OpCodes.Unpack32LE(3994803019)
          ])
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
      return new SFMTInstance(this);
    }
  }

  /**
 * SFMT cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SFMTInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SFMT state - array of 128-bit integers represented as 4x32-bit words
      this._state = new Array(N32);      // State array (628 uint32 values)
      for (let i = 0; i < N32; ++i) {
        this._state[i] = 0;
      }

      this._index = N32;                 // Index into state array (N32 means uninitialized)
      this._outputSize = 32;             // Default output size in bytes
      this._skipBytes = 0;               // Number of bytes to skip before generating output
    }

    /**
     * Initialize the generator with a 32-bit seed
     * Based on SFMT init_gen_rand function
     *
     * @param {Array} seedBytes - 4-byte array containing 32-bit seed
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._index = N32; // Mark as uninitialized
        return;
      }

      // Convert seed bytes to 32-bit unsigned integer (little-endian)
      let seedValue = 0;
      for (let i = 0; i < Math.min(seedBytes.length, 4); ++i) {
        seedValue = OpCodes.Or32(seedValue, OpCodes.Shl32(seedBytes[i], i * 8));
      }
      seedValue = OpCodes.ToUint32(seedValue);

      // Initialize state array
      this._state[0] = seedValue;

      for (let i = 1; i< N32; ++i) {
        const prev = this._state[i - 1];
        const xored = OpCodes.Xor32(prev, OpCodes.Shr32(prev, 30));
        // 32-bit multiplication using BigInt to avoid overflow
        const product = Number((BigInt(INIT_MULTIPLIER) * BigInt(xored))&0xFFFFFFFFn);
        this._state[i] = OpCodes.ToUint32(product + i);
      }

      // Period certification (ensures non-degenerate state)
      this._periodCertification();

      // Reset index to trigger generation on first use
      this._index = N32;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Period certification - ensures state has full period
     * Based on SFMT period_certification function
     */
    _periodCertification() {
      const parity = [PARITY1, PARITY2, PARITY3, PARITY4];
      let inner = 0;

      // Compute inner product
      for (let i = 0; i< 4; ++i) {
        inner = OpCodes.Xor32(inner, OpCodes.And32(this._state[i], parity[i]));
      }

      // Reduce to single bit
      for (let i = 16; i> 0; i = OpCodes.Shr32(i, 1)) {
        inner = OpCodes.Xor32(inner, OpCodes.Shr32(inner, i));
      }
      inner = OpCodes.And32(inner, 1);

      // If inner is 0, modify state to ensure full period
      if (inner === 0) {
        for (let i = 0; i< 4; ++i) {
          let work = 1;
          for (let j = 0; j< 32; ++j) {
            if (OpCodes.And32(work, parity[i]) !== 0) {
              this._state[i] = OpCodes.Xor32(this._state[i], work);
              return;
            }
            work = OpCodes.Shl32(work, 1);
          }
        }
      }
    }

    /**
     * Left shift of 128-bit block by SL2 bytes
     * Direct translation from SFMT-common.h lshift128 function:
     *   th = ((uint64_t)in->u[3] left-shift 32)|((uint64_t)in->u[2]);
     *   tl = ((uint64_t)in->u[1] left-shift 32)|((uint64_t)in->u[0]);
     *   oh = th left-shift (shift * 8);
     *   ol = tl left-shift (shift * 8);
     *   oh |= tl right-shift (64 - shift * 8);
     *   out->u[1] = (uint32_t)(ol right-shift 32);
     *   out->u[0] = (uint32_t)ol;
     *   out->u[3] = (uint32_t)(oh right-shift 32);
     *   out->u[2] = (uint32_t)oh;
     *
     * @param {Array} block - 4x32-bit block [u0, u1, u2, u3]
     * @returns {Array} Shifted block
     */
    _lshift128(block) {
      const shiftBits = SL2 * 8;

      // Build 64-bit values exactly as C code does
      const th = OpCodes.ShiftLn(BigInt(OpCodes.ToUint32(block[3])), 32)|BigInt(OpCodes.ToUint32(block[2]));
      const tl = OpCodes.ShiftLn(BigInt(OpCodes.ToUint32(block[1])), 32)|BigInt(OpCodes.ToUint32(block[0]));

      // Shift
      let oh = OpCodes.ShiftLn(th, shiftBits)&0xFFFFFFFFFFFFFFFFn;
      let ol = OpCodes.ShiftLn(tl, shiftBits)&0xFFFFFFFFFFFFFFFFn;
      oh |= OpCodes.ShiftRn(tl, 64 - shiftBits);

      // Unpack exactly as C code does
      const result = [0, 0, 0, 0];
      result[1] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(ol, 32)&0xFFFFFFFFn));
      result[0] = OpCodes.ToUint32(Number(ol&0xFFFFFFFFn));
      result[3] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(oh, 32)&0xFFFFFFFFn));
      result[2] = OpCodes.ToUint32(Number(oh&0xFFFFFFFFn));

      return result;
    }

    /**
     * Right shift of 128-bit block by SR2 bytes
     * Direct translation from SFMT-common.h rshift128 function:
     *   th = ((uint64_t)in->u[3] left-shift 32)|((uint64_t)in->u[2]);
     *   tl = ((uint64_t)in->u[1] left-shift 32)|((uint64_t)in->u[0]);
     *   oh = th right-shift (shift * 8);
     *   ol = tl right-shift (shift * 8);
     *   ol |= th left-shift (64 - shift * 8);
     *   out->u[1] = (uint32_t)(ol right-shift 32);
     *   out->u[0] = (uint32_t)ol;
     *   out->u[3] = (uint32_t)(oh right-shift 32);
     *   out->u[2] = (uint32_t)oh;
     *
     * @param {Array} block - 4x32-bit block [u0, u1, u2, u3]
     * @returns {Array} Shifted block
     */
    _rshift128(block) {
      const shiftBits = SR2 * 8;

      // Build 64-bit values exactly as C code does
      const th = OpCodes.ShiftLn(BigInt(OpCodes.ToUint32(block[3])), 32)|BigInt(OpCodes.ToUint32(block[2]));
      const tl = OpCodes.ShiftLn(BigInt(OpCodes.ToUint32(block[1])), 32)|BigInt(OpCodes.ToUint32(block[0]));

      // Shift
      let oh = OpCodes.ShiftRn(th, shiftBits);
      let ol = OpCodes.ShiftRn(tl, shiftBits);
      ol |= OpCodes.ShiftLn(th, 64 - shiftBits)&0xFFFFFFFFFFFFFFFFn;

      // Unpack exactly as C code does
      const result = [0, 0, 0, 0];
      result[1] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(ol, 32)&0xFFFFFFFFn));
      result[0] = OpCodes.ToUint32(Number(ol&0xFFFFFFFFn));
      result[3] = OpCodes.ToUint32(Number(OpCodes.ShiftRn(oh, 32)&0xFFFFFFFFn));
      result[2] = OpCodes.ToUint32(Number(oh&0xFFFFFFFFn));

      return result;
    }

    /**
     * SFMT recursion formula
     * Based on SFMT do_recursion function
     *
     * @param {Array} a - Current state block (4x32)
     * @param {Array} b - State block at position+POS1 (4x32)
     * @param {Array} c - Previous state block (4x32)
     * @param {Array} d - Two-blocks-ago state block (4x32)
     * @returns {Array} New state block (4x32)
     */
    _doRecursion(a, b, c, d) {
      const result = [0, 0, 0, 0];
      const masks = [MSK1, MSK2, MSK3, MSK4];

      const x = this._lshift128(a);
      const y = this._rshift128(c);

      for (let i = 0; i< 4; ++i) {
        result[i] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(a[i], x[i]), OpCodes.And32(OpCodes.Shr32(b[i], SR1), masks[i])), y[i]), OpCodes.Shl32(d[i], SL1));
        result[i] = OpCodes.ToUint32(result[i]);
      }

      return result;
    }

    /**
     * Generate all N 128-bit blocks at once
     * Based on SFMT sfmt_gen_rand_all function
     *
     * C code reference:
     * r1 = &sfmt->state[SFMT_N - 2];
     * r2 = &sfmt->state[SFMT_N - 1];
     * for (i = 0; i < SFMT_N - SFMT_POS1; i++) {
     *     do_recursion(&sfmt->state[i], &sfmt->state[i], &sfmt->state[i + SFMT_POS1], r1, r2);
     *     r1 = r2;
     *     r2 = &sfmt->state[i];
     * }
     * for (; i < SFMT_N; i++) {
     *     do_recursion(&sfmt->state[i], &sfmt->state[i], &sfmt->state[i + SFMT_POS1 - SFMT_N], r1, r2);
     *     r1 = r2;
     *     r2 = &sfmt->state[i];
     * }
     */
    _genRandAll() {
      // r1 and r2 initially point to last two 128-bit blocks (N-2 and N-1)
      // In 32-bit array indexing: (N-2)*4 and (N-1)*4
      let r1Idx = (N - 2) * 4;  // (156-2)*4 = 616
      let r2Idx = (N - 1) * 4;  // (156-1)*4 = 620

      // First loop: i from 0 to N-POS1-1 (in blocks)
      // Process blocks 0 through 33 (34 total blocks for N=156, POS1=122)
      for (let i = 0; i< N - POS1; ++i) {
        const idx = i * 4;           // Convert block index to 32-bit word index
        const bIdx = (i + POS1) * 4; // Block i+POS1 in 32-bit words

        const a = [this._state[idx], this._state[idx + 1], this._state[idx + 2], this._state[idx + 3]];
        const b = [this._state[bIdx], this._state[bIdx + 1], this._state[bIdx + 2], this._state[bIdx + 3]];
        const c = [this._state[r1Idx], this._state[r1Idx + 1], this._state[r1Idx + 2], this._state[r1Idx + 3]];
        const d = [this._state[r2Idx], this._state[r2Idx + 1], this._state[r2Idx + 2], this._state[r2Idx + 3]];

        const newBlock = this._doRecursion(a, b, c, d);
        this._state[idx] = newBlock[0];
        this._state[idx + 1] = newBlock[1];
        this._state[idx + 2] = newBlock[2];
        this._state[idx + 3] = newBlock[3];

        r1Idx = r2Idx;   // r1 = r2
        r2Idx = idx;     // r2 = &state[i]
      }

      // Second loop: i from N-POS1 to N-1 (in blocks)
      // Process blocks 34 through 155 (122 blocks)
      for (let i = N - POS1; i< N; ++i) {
        const idx = i * 4;                    // Convert block index to 32-bit word index
        const bIdx = (i + POS1 - N) * 4;     // Wrap around: block (i+POS1-N) in 32-bit words

        const a = [this._state[idx], this._state[idx + 1], this._state[idx + 2], this._state[idx + 3]];
        const b = [this._state[bIdx], this._state[bIdx + 1], this._state[bIdx + 2], this._state[bIdx + 3]];
        const c = [this._state[r1Idx], this._state[r1Idx + 1], this._state[r1Idx + 2], this._state[r1Idx + 3]];
        const d = [this._state[r2Idx], this._state[r2Idx + 1], this._state[r2Idx + 2], this._state[r2Idx + 3]];

        const newBlock = this._doRecursion(a, b, c, d);
        this._state[idx] = newBlock[0];
        this._state[idx + 1] = newBlock[1];
        this._state[idx + 2] = newBlock[2];
        this._state[idx + 3] = newBlock[3];

        r1Idx = r2Idx;   // r1 = r2
        r2Idx = idx;     // r2 = &state[i]
      }

      this._index = 0;
    }

    /**
     * Generate the next 32-bit random value
     *
     * @returns {number} 32-bit unsigned random value
     */
    _next32() {
      if (this._index >= N32) {
        // Generate all blocks at once
        if (this._index > N32) {
          // If not initialized, use default seed
          this.seed = OpCodes.Unpack32LE(DEFAULT_SEED);
        }

        this._genRandAll();
      }

      return this._state[this._index++];
    }

    /**
     * Generate random bytes
     * Outputs bytes in little-endian order (LSB first) to match reference implementation
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (this._index > N32) {
        throw new Error('SFMT not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 32-bit words
      const fullWords = Math.floor(length / 4);
      for (let i = 0; i< fullWords; ++i) {
        const value = this._next32();
        // Output in little-endian format
        output.push(OpCodes.ToByte(value));
        output.push(OpCodes.ToByte(OpCodes.Shr32(value, 8)));
        output.push(OpCodes.ToByte(OpCodes.Shr32(value, 16)));
        output.push(OpCodes.ToByte(OpCodes.Shr32(value, 24)));
      }

      // Handle remaining bytes (if length not multiple of 4)
      const remainingBytes = length % 4;
      if (remainingBytes> 0) {
        const value = this._next32();
        for (let i = 0; i< remainingBytes; ++i) {
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
      // For PRNG, Feed is not used in standard SFMT
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
  const algorithmInstance = new SFMTAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SFMTAlgorithm, SFMTInstance };
}));
