/*
 * Xoroshiro128++ Pseudo-Random Number Generator
 * Original algorithm by David Blackman and Sebastiano Vigna (2018)
 * Public domain reference implementation
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
   * Used to initialize xoroshiro128++ state from a single 64-bit seed
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

  class Xoroshiro128PlusPlusAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xoroshiro128++";
      this.description = "Xoroshiro128++ is a small, fast, all-purpose pseudo-random number generator with a 128-bit state. It is the successor to xoroshiro128+, featuring improved statistical quality through a scrambler (rotation + addition) instead of simple addition. Suitable for general-purpose applications requiring speed and quality.";
      this.inventor = "David Blackman, Sebastiano Vigna";
      this.year = 2018;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.IT;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official Reference Implementation",
          "https://prng.di.unimi.it/xoroshiro128plusplus.c"
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
          "PCG: A Quick Look at Xoshiro256**",
          "https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html"
        )
      ];

      // Test vectors generated using C# reference implementation
      // Validated against official C implementation at https://prng.di.unimi.it/xoroshiro128plusplus.c
      // Seeded using SplitMix64 to generate initial state from single 64-bit value
      this.tests = [
        {
          text: "Seed=0: First four 64-bit outputs from xoroshiro128++",
          uri: "https://prng.di.unimi.it/xoroshiro128plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // State after SplitMix64(0): s[0]=0xe220a8397b1dcdaf, s[1]=0xa706dd2f4d197e6f
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0xecf238a8135adffe  2. 0xf9b9b7527910063a  3. 0x5def24cfd0d1589f  4. 0xe34d90f43f235bd2
          expected: OpCodes.Hex8ToBytes("fedf5a13a838f2ec3a06107952b7b9f69f58d1d0cf24ef5dd25b233ff4904de3")
        },
        {
          text: "Seed=1: First four 64-bit outputs from xoroshiro128++",
          uri: "https://prng.di.unimi.it/xoroshiro128plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 32,
          // State after SplitMix64(1): s[0]=0x910a2dec89025cc1, s[1]=0x2c11bcdf593b6821
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0x42f42864042bc358  2. 0x19413784ed962430  3. 0x3ad2b7d801e370cf  4. 0x6fad0f15cfdccf7c
          expected: OpCodes.Hex8ToBytes("583bc2046428f442302496ed84374119cf70e301d8b7d23a7ccfdccf150fad6f")
        },
        {
          text: "Seed=12345: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoroshiro128plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930000000000000"), // 12345 in little-endian
          outputSize: 32,
          // State after SplitMix64(12345): s[0]=0x22118258a9d111a0, s[1]=0x60b56e1ee5acced5
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0xe703da7a478f5ddd  2. 0xd70b39d257899856e  3. 0xe0fd8c5651766f29  4. 0xc685565134dbb9b3
          expected: OpCodes.Hex8ToBytes("dd5d8f477ada03e76e998957d2390bd7296f7651568cfde0b3b9db34515685c6")
        },
        {
          text: "Seed=0xDEADBEEF: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoroshiro128plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("efbeadde00000000"), // 0xDEADBEEF in little-endian
          outputSize: 32,
          // State after SplitMix64(0xdeadbeef): s[0]=0x764a2b1a34a0dba6, s[1]=0x27951b4ff6fb0fad
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0x438d06d06c98bf04  2. 0x2222dadd55f24b8d  3. 0x07fdc414e70fdbee  4. 0xed65e6bd1f49c533
          expected: OpCodes.Hex8ToBytes("04bf986cd0068d438d4bf255ddda2222eedb0fe714c4fd0633c5491fbde665ed")
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
      return new Xoroshiro128PlusPlusInstance(this);
    }
  }

  /**
 * Xoroshiro128PlusPlus cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xoroshiro128PlusPlusInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xoroshiro128++ state: two 64-bit values (using BigInt)
      this._s0 = 0n;
      this._s1 = 0n;
      this._ready = false;
    }

    /**
     * Set seed value (64-bit)
     * Uses SplitMix64 to initialize the two state values
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

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the xoroshiro128++ algorithm
     *
     * Algorithm from https://prng.di.unimi.it/xoroshiro128plusplus.c:
     * 1. result = rotl(s[0] + s[1], 17) + s[0]
     * 2. s[1] ^= s[0]
     * 3. s[0] = rotl(s[0], 49) XOR s[1] XOR (s[1] shl 21)
     * 4. s[1] = rotl(s[1], 28)
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xoroshiro128++ not initialized: set seed first');
      }

      const s0 = this._s0;
      const s1 = this._s1;

      // Output function: result = rotl(s[0] + s[1], 17) + s[0]
      const sum = OpCodes.ToQWord(s0 + s1);
      const rotated = OpCodes.RotL64n(sum, 17);
      const result = OpCodes.ToQWord(rotated + s0);

      // State update
      // s[1] ^= s[0]
      const s1_xor_s0 = OpCodes.XorN(s1, s0);

      // s[0] = rotl(s[0], 49) XOR s[1] XOR (s[1] shl 21)
      this._s0 = OpCodes.XorN(
        OpCodes.XorN(OpCodes.RotL64n(s0, 49), s1_xor_s0),
        OpCodes.ToQWord(OpCodes.ShiftLn(s1_xor_s0, 21))
      );

      // s[1] = rotl(s[1], 28)
      this._s1 = OpCodes.RotL64n(s1_xor_s0, 28);

      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xoroshiro128++ not initialized: set seed first');
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
      // Not implemented in basic xoroshiro128++ - would require mixing
      // For now, Feed is a no-op (xoroshiro128++ is deterministic)
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
     * Jump function (equivalent to 2^64 calls to _next64())
     * Useful for parallel computation - allows splitting the sequence
     * Based on official implementation at https://prng.di.unimi.it/xoroshiro128plusplus.c
     */
    jump() {
      // Jump polynomial coefficients from official implementation
      const JUMP = [
        0x2bd7a6a6e99c2ddcn,
        0x0992ccaf6a6fca05n
      ];

      let s0 = 0n;
      let s1 = 0n;

      for (let i = 0; i < JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, BigInt(b));
          if (OpCodes.AndN(JUMP[i], mask) !== 0n) {
            s0 = OpCodes.XorN(s0, this._s0);
            s1 = OpCodes.XorN(s1, this._s1);
          }
          this._next64();
        }
      }

      this._s0 = s0;
      this._s1 = s1;
    }

    /**
     * Long jump function (equivalent to 2^96 calls to _next64())
     * Useful for parallel computation across multiple machines
     * Based on official implementation at https://prng.di.unimi.it/xoroshiro128plusplus.c
     */
    longJump() {
      // Long jump polynomial coefficients from official implementation
      const LONG_JUMP = [
        0x360fd5f2cf8d5d99n,
        0x9c6e6877736c46e3n
      ];

      let s0 = 0n;
      let s1 = 0n;

      for (let i = 0; i < LONG_JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, BigInt(b));
          if (OpCodes.AndN(LONG_JUMP[i], mask) !== 0n) {
            s0 = OpCodes.XorN(s0, this._s0);
            s1 = OpCodes.XorN(s1, this._s1);
          }
          this._next64();
        }
      }

      this._s0 = s0;
      this._s1 = s1;
    }
  }

  // Register algorithm
  const algorithmInstance = new Xoroshiro128PlusPlusAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xoroshiro128PlusPlusAlgorithm, Xoroshiro128PlusPlusInstance };
}));
