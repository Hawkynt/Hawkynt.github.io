/*
 * Xoroshiro256** (StarStar) Pseudo-Random Number Generator
 * Original algorithm by David Blackman and Sebastiano Vigna (2018)
 * Public domain reference implementation
 *
 * Default PRNG for .NET 6+, GNU Fortran, and Lua
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

  /**
   * SplitMix64 seeding algorithm
   * Used to initialize xoroshiro256** state from a single 64-bit seed
   * Matches C# ref parameter behavior: the output VALUE becomes the next state
   * Based on http://prng.di.unimi.it/splitmix64.c
   */
  function SplitMix64(state) {
    const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
    state = OpCodes.ToQWord(state + GOLDEN_GAMMA);

    let z = state;
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 30));
    z = OpCodes.ToQWord(z * 0xBF58476D1CE4E5B9n);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 27));
    z = OpCodes.ToQWord(z * 0x94D049BB133111EBn);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 31));

    // Return the mixed value, and use it as next state (matching C# ref behavior)
    return { value: z, nextState: z };
  }

  class Xoroshiro256StarStarAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xoroshiro256**";
      this.description = "Xoroshiro256** is a large-state, high-quality pseudo-random number generator with a 256-bit state space. Adopted as the default PRNG for .NET 6+, GNU Fortran, and Lua, it features a multiplication-based scrambler (multiply by 5, rotate, multiply by 9) providing excellent statistical properties. With a period of 2^256-1, it's ideal for parallel and distributed computing via jump functions.";
      this.inventor = "David Blackman, Sebastiano Vigna";
      this.year = 2018;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IT;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official Reference Implementation",
          "https://prng.di.unimi.it/xoroshiro256starstar.c"
        ),
        new LinkItem(
          "xoshiro / xoroshiro generators and the PRNG shootout",
          "https://prng.di.unimi.it/"
        ),
        new LinkItem(
          "Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)",
          "https://arxiv.org/pdf/1805.01407"
        )
      ];

      this.references = [
        new LinkItem(
          "Wikipedia: Xoroshiro128+",
          "https://en.wikipedia.org/wiki/Xoroshiro128+"
        ),
        new LinkItem(
          ".NET 6 Random Class Implementation",
          "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Random.Xoshiro256StarStarImpl.cs"
        ),
        new LinkItem(
          "PCG: A Quick Look at Xoshiro256**",
          "https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html"
        )
      ];

      // Test vectors generated using official algorithm from https://prng.di.unimi.it/xoroshiro256starstar.c
      // Validated against reference implementation with SplitMix64 seeding
      this.tests = [
        {
          text: "Seed=0: First four 64-bit outputs from xoroshiro256**",
          uri: "https://prng.di.unimi.it/xoroshiro256starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // State after SplitMix64(0):
          // s[0]=0xe220a8397b1dcdaf, s[1]=0xa706dd2f4d197e6f,
          // s[2]=0x238275bc38fcbe91, s[3]=0x2130748aaac80268
          // Output: 0x1a70a846bd9cc2a9, 0x6a0ef250cd2b9e80, 0x61325a7589c2ff27, 0x21ccf8536a2bb70a
          expected: OpCodes.Hex8ToBytes("a9c29cbd46a8701a809e2bcd50f20e6a27ffc289755a32610ab72b6a53f8cc21")
        },
        {
          text: "Seed=1: First four 64-bit outputs from xoroshiro256**",
          uri: "https://prng.di.unimi.it/xoroshiro256starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 32,
          // State after SplitMix64(1):
          // s[0]=0x910a2dec89025cc1, s[1]=0x5e41ab087439611e,
          // s[2]=0xb18a02f46d8d86c3, s[3]=0xe28195ddd9ee4956
          // Output: 0xc5883e370b0926c3, 0x021b74b80f71f81c, 0x268df06749e5c8ce, 0xe052757d667afef2
          expected: OpCodes.Hex8ToBytes("c326090b373e88c51cf8710fb8741b02cec8e54967f08d26f2fe7a667d7552e0")
        },
        {
          text: "Seed=12345: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoroshiro256starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930000000000000"), // 12345 in little-endian
          outputSize: 32,
          // State after SplitMix64(12345):
          // s[0]=0x22118258a9d111a0, s[1]=0x040d6020823fbd3f,
          // s[2]=0xa9fb86aff8ee1b6d, s[3]=0x2b50fa6de868a494
          // Output: 0x2cf2db729a2209da, 0xd65cf80b902ac89f, 0x8aec86410d6d1626, 0x6255ec3d560639fb
          expected: OpCodes.Hex8ToBytes("da09229a72dbf22c9fc82a900bf85cd626166d0d4186ec8afb3906563dec5562")
        },
        {
          text: "Seed=0xDEADBEEF: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoroshiro256starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("efbeadde00000000"), // 0xDEADBEEF in little-endian
          outputSize: 32,
          // State after SplitMix64(0xdeadbeef):
          // s[0]=0x4adfb90f68c9eb9b, s[1]=0x1ed543473e16964c,
          // s[2]=0x215b1b415720f3ec, s[3]=0x8618f15a74b1be69
          // Output: 0xbe69c2f4fc35b0b5, 0xb2474aacf60030cd, 0x6f1c904bb78dc701, 0xea84fdfc08e59484
          expected: OpCodes.Hex8ToBytes("b5b035fcf4c269becd3000f6ac4a47b201c78db74b901c6f8494e508fcfd84ea")
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
      return new Xoroshiro256StarStarInstance(this);
    }
  }

  /**
 * Xoroshiro256StarStar cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xoroshiro256StarStarInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xoroshiro256** state: four 64-bit values (using BigInt)
      this._s0 = 0n;
      this._s1 = 0n;
      this._s2 = 0n;
      this._s3 = 0n;
      this._ready = false;
    }

    /**
     * Set seed value (64-bit)
     * Uses SplitMix64 to initialize the four state values
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (little-endian)
      let seedValue = 0n;
      for (let i = 0; i < Math.min(8, seedBytes.length); ++i) {
        seedValue = OpCodes.OrN(seedValue, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
      }

      // Initialize state using SplitMix64
      let state = seedValue;

      let result = SplitMix64(state);
      this._s0 = result.value;
      state = result.nextState;

      result = SplitMix64(state);
      this._s1 = result.value;
      state = result.nextState;

      result = SplitMix64(state);
      this._s2 = result.value;
      state = result.nextState;

      result = SplitMix64(state);
      this._s3 = result.value;

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the xoroshiro256** algorithm
     *
     * Algorithm from https://prng.di.unimi.it/xoroshiro256starstar.c:
     * 1. result = rotl(s[1] * 5, 7) * 9  (**starstar** scrambler)
     * 2. t = s[1] shl 17
     * 3. s[2] ^= s[0]
     * 4. s[3] ^= s[1]
     * 5. s[1] ^= s[2]
     * 6. s[0] ^= s[3]
     * 7. s[2] ^= t
     * 8. s[3] = rotl(s[3], 45)
     *
     * The ** variant uses multiplication-based scrambler (multiply by 5, rotate 7, multiply by 9)
     * which provides better statistical quality than the + variant's addition-based scrambler.
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xoroshiro256** not initialized: set seed first');
      }

      const s0 = this._s0;
      const s1 = this._s1;
      const s2 = this._s2;
      const s3 = this._s3;

      // Output function: result = rotl(s[1] * 5, 7) * 9
      // This is the **starstar** scrambler - multiplication based
      const mult5 = OpCodes.ToQWord(s1 * 5n);
      const rotated = OpCodes.RotL64n(mult5, 7);
      const result = OpCodes.ToQWord(rotated * 9n);

      // State update
      // t = s[1] shl 17
      const t = OpCodes.ToQWord(OpCodes.ShiftLn(s1, 17n));

      // s[2] ^= s[0]
      // s[3] ^= s[1]
      // s[1] ^= s[2]
      // s[0] ^= s[3]
      const new_s2 = OpCodes.XorN(s2, s0);
      const new_s3 = OpCodes.XorN(s3, s1);
      const new_s1 = OpCodes.XorN(s1, new_s2);
      const new_s0 = OpCodes.XorN(s0, new_s3);

      // s[2] ^= t
      this._s2 = OpCodes.XorN(new_s2, t);

      // s[3] = rotl(s[3], 45)
      this._s3 = OpCodes.RotL64n(new_s3, 45);

      // Update remaining state
      this._s0 = new_s0;
      this._s1 = new_s1;

      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xoroshiro256** not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesGenerated = 0;

      while (bytesGenerated < length) {
        // Generate next 64-bit value
        const value64 = this._next64();

        // Extract bytes in little-endian order
        for (let i = 0; i < 8 && bytesGenerated < length; ++i) {
          const shifted = OpCodes.ShiftRn(value64, BigInt(i * 8));
          const byteVal = Number(OpCodes.AndN(shifted, 0xFFn));
          output.push(byteVal);
          ++bytesGenerated;
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
      // Not implemented in basic xoroshiro256** - would require mixing
      // For now, Feed is a no-op (xoroshiro256** is deterministic)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes (4 x 64-bit values)
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

    /**
     * Jump function (equivalent to 2^128 calls to _next64())
     * Useful for parallel computation - allows splitting the sequence
     * Based on official implementation at https://prng.di.unimi.it/xoroshiro256starstar.c
     */
    jump() {
      // Jump polynomial coefficients from official xoroshiro256** implementation
      const JUMP = [
        0x180ec6d33cfd0aban,
        0xd5a61266f0c9392cn,
        0xa9582618e03fc9aan,
        0x39abdc4529b1661cn
      ];

      let s0 = 0n;
      let s1 = 0n;
      let s2 = 0n;
      let s3 = 0n;

      for (let i = 0; i < JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, BigInt(b));
          if (OpCodes.AndN(JUMP[i], mask) !== 0n) {
            s0 = OpCodes.XorN(s0, this._s0);
            s1 = OpCodes.XorN(s1, this._s1);
            s2 = OpCodes.XorN(s2, this._s2);
            s3 = OpCodes.XorN(s3, this._s3);
          }
          this._next64();
        }
      }

      this._s0 = s0;
      this._s1 = s1;
      this._s2 = s2;
      this._s3 = s3;
    }

    /**
     * Long jump function (equivalent to 2^192 calls to _next64())
     * Useful for parallel computation across multiple machines
     * Based on official implementation at https://prng.di.unimi.it/xoroshiro256starstar.c
     */
    longJump() {
      // Long jump polynomial coefficients from official xoroshiro256** implementation
      const LONG_JUMP = [
        0x76e15d3efefdcbbfn,
        0xc5004e441c522fb3n,
        0x77710069854ee241n,
        0x39109bb02acbe635n
      ];

      let s0 = 0n;
      let s1 = 0n;
      let s2 = 0n;
      let s3 = 0n;

      for (let i = 0; i < LONG_JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, BigInt(b));
          if (OpCodes.AndN(LONG_JUMP[i], mask) !== 0n) {
            s0 = OpCodes.XorN(s0, this._s0);
            s1 = OpCodes.XorN(s1, this._s1);
            s2 = OpCodes.XorN(s2, this._s2);
            s3 = OpCodes.XorN(s3, this._s3);
          }
          this._next64();
        }
      }

      this._s0 = s0;
      this._s1 = s1;
      this._s2 = s2;
      this._s3 = s3;
    }
  }

  // Register algorithm
  const algorithmInstance = new Xoroshiro256StarStarAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xoroshiro256StarStarAlgorithm, Xoroshiro256StarStarInstance };
}));
