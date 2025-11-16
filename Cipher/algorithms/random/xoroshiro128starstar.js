/*
 * Xoroshiro128** (StarStar) Pseudo-Random Number Generator
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
   * Used to initialize xoroshiro128** state from a single 64-bit seed
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

  class Xoroshiro128StarStarAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xoroshiro128**";
      this.description = "Xoroshiro128** is a small, fast, all-purpose pseudo-random number generator with a 128-bit state. It features a multiplication-based scrambler (multiply by 5, rotate, multiply by 9) providing superior statistical quality compared to the ++ variant, especially for generating floating-point numbers. Passes all statistical tests including BigCrush.";
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
          "https://prng.di.unimi.it/xoroshiro128starstar.c"
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

      // Test vectors generated using official algorithm from https://prng.di.unimi.it/xoroshiro128starstar.c
      // Validated against reference C implementation
      // Seeded using SplitMix64 to generate initial state from single 64-bit value
      this.tests = [
        {
          text: "Seed=0: First four 64-bit outputs from xoroshiro128**",
          uri: "https://prng.di.unimi.it/xoroshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // State after SplitMix64(0): s[0]=0xe220a8397b1dcdaf, s[1]=0xa706dd2f4d197e6f
          // Algorithm: result = rotl(s0 * 5, 7) * 9
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0xdec90d521e93e35d  2. 0x1fd69d3463f4a4cf  3. 0xdc8a30ec7c4e1c38  4. 0x9c301a99344c9582
          expected: OpCodes.Hex8ToBytes("5de3931e520dc9decfa4f463349dd61f381c4e7cec308adc82954c34991a309c")
        },
        {
          text: "Seed=1: First four 64-bit outputs from xoroshiro128**",
          uri: "https://prng.di.unimi.it/xoroshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 32,
          // State after SplitMix64(1): s[0]=0x910a2dec89025cc1, s[1]=0x2c11bcdf593b6821
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0x65094a0ab526fa3a  2. 0xe1ae03a0cd6ac5fc  3. 0xa15fe94096864368  4. 0x69394c37f9adef90
          expected: OpCodes.Hex8ToBytes("3afa26b50a4a0965fcc56acda003aee16843869640e95fa190efadf9374c3969")
        },
        {
          text: "Seed=12345: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoroshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930000000000000"), // 12345 in little-endian
          outputSize: 32,
          // State after SplitMix64(12345): s[0]=0x22118258a9d111a0, s[1]=0x60b56e1ee5acced5
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0x89f4caece00c92fd  2. 0x06a7e0f4dc1f0cc8  3. 0x9b477f7e1d0982d9  4. 0x6c7f2ee158d72252
          expected: OpCodes.Hex8ToBytes("fd920ce0eccaf489c80c1fdcf4e0a706d982091d7e7f479b5222d758e12e7f6c")
        },
        {
          text: "Seed=0xDEADBEEF: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoroshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("efbeadde00000000"), // 0xDEADBEEF in little-endian
          outputSize: 32,
          // State after SplitMix64(0xdeadbeef): s[0]=0x764a2b1a34a0dba6, s[1]=0x27951b4ff6fb0fad
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0xa9c3dab5bf352193  2. 0x39eb757ddb46aba2  3. 0x82a1aa650cf697a0  4. 0x43726d8e0ed16930
          expected: OpCodes.Hex8ToBytes("932135bfb5dac3a9a2ab46db7d75eb39a097f60c65aaa1823069d10e8e6d7243")
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
      return new Xoroshiro128StarStarInstance(this);
    }
  }

  /**
 * Xoroshiro128StarStar cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xoroshiro128StarStarInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xoroshiro128** state: two 64-bit values (using BigInt)
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
     * Implements the xoroshiro128** algorithm
     *
     * Algorithm from https://prng.di.unimi.it/xoroshiro128starstar.c:
     * 1. result = rotl(s[0] * 5, 7) * 9  (**starstar** scrambler)
     * 2. s[1] ^= s[0]
     * 3. s[0] = rotl(s[0], 24) ^ s[1] ^ (s[1] << 16)
     * 4. s[1] = rotl(s[1], 37)
     *
     * The ** variant uses multiplication-based scrambler (multiply by 5, rotate 7, multiply by 9)
     * which provides better statistical quality than the ++ variant's addition-based scrambler.
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xoroshiro128** not initialized: set seed first');
      }

      const s0 = this._s0;
      const s1 = this._s1;

      // Output function: result = rotl(s[0] * 5, 7) * 9
      // This is the **starstar** scrambler - multiplication based
      const mult5 = OpCodes.ToQWord(s0 * 5n);
      const rotated = OpCodes.RotL64n(mult5, 7);
      const result = OpCodes.ToQWord(rotated * 9n);

      // State update
      // s[1] ^= s[0]
      const s1_xor_s0 = OpCodes.XorN(s1, s0);

      // s[0] = rotl(s[0], 24) ^ s[1] ^ (s[1] << 16)
      this._s0 = OpCodes.XorN(
        OpCodes.XorN(OpCodes.RotL64n(s0, 24), s1_xor_s0),
        OpCodes.ToQWord(OpCodes.ShiftLn(s1_xor_s0, 16))
      );

      // s[1] = rotl(s[1], 37)
      this._s1 = OpCodes.RotL64n(s1_xor_s0, 37);

      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xoroshiro128** not initialized: set seed first');
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
          const shifted = OpCodes.ShiftRn(value64, i * 8);
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
      // Not implemented in basic xoroshiro128** - would require mixing
      // For now, Feed is a no-op (xoroshiro128** is deterministic)
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
     * Based on official implementation at https://prng.di.unimi.it/xoroshiro128starstar.c
     */
    jump() {
      // Jump polynomial coefficients from official xoroshiro128** implementation
      const JUMP = [
        0xdf900294d8f554a5n,
        0x170865df4b3201fcn
      ];

      let s0 = 0n;
      let s1 = 0n;

      for (let i = 0; i < JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, b);
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
     * Based on official implementation at https://prng.di.unimi.it/xoroshiro128starstar.c
     */
    longJump() {
      // Long jump polynomial coefficients from official xoroshiro128** implementation
      const LONG_JUMP = [
        0xd2a98b26625eee7bn,
        0xdddf9b1090aa7ac1n
      ];

      let s0 = 0n;
      let s1 = 0n;

      for (let i = 0; i < LONG_JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, b);
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
  const algorithmInstance = new Xoroshiro128StarStarAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xoroshiro128StarStarAlgorithm, Xoroshiro128StarStarInstance };
}));
