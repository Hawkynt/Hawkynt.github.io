/*
 * Xoshiro256++ Pseudo-Random Number Generator
 * Original algorithm by David Blackman and Sebastiano Vigna (2019)
 * Public domain reference implementation
 *
 * NOTE: This is Xoshiro256++, not Xoroshiro256++ (which does not exist).
 * The xoroshiro family uses 128-bit state (2 x 64-bit values).
 * The xoshiro family uses 256-bit state (4 x 64-bit values).
 * Julia programming language uses Xoshiro256++ as its default PRNG.
 *
 * Algorithm:
 *   result = rotl(s[0] + s[3], 23) + s[0]  // ++ scrambler (addition + rotation)
 *   t = s[1] shl 17
 *   s[2] ^= s[0]
 *   s[3] ^= s[1]
 *   s[1] ^= s[2]
 *   s[0] ^= s[3]
 *   s[2] ^= t
 *   s[3] = rotl(s[3], 45)
 *
 * Period: 2^256 - 1
 * State: 4 x 64-bit values (256 bits total)
 *
 * Reference: https://prng.di.unimi.it/xoshiro256plusplus.c
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
   * Used to initialize xoshiro256++ state from a single 64-bit seed
   * Based on http://prng.di.unimi.it/splitmix64.c
   */
  function SplitMix64(state) {
    const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;

    // Update state first by adding golden gamma
    state = OpCodes.ToQWord(state + GOLDEN_GAMMA);

    // Mix the updated state to produce output
    let z = state;
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 30));
    z = OpCodes.ToQWord(z * 0xBF58476D1CE4E5B9n);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 27));
    z = OpCodes.ToQWord(z * 0x94D049BB133111EBn);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 31));

    // Return the mixed value as output, and the updated (unmixed) state for next iteration
    return { value: z, nextState: state };
  }

  class Xoshiro256PlusPlusAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xoshiro256++";
      this.description = "Xoshiro256++ is an all-purpose, rock-solid, small-state pseudo-random number generator with excellent speed and statistical properties. It features a 256-bit state (four 64-bit values), passes all statistical tests, and uses addition and rotation for the output function. Default PRNG for Julia programming language.";
      this.inventor = "David Blackman, Sebastiano Vigna";
      this.year = 2019;
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
          "https://prng.di.unimi.it/xoshiro256plusplus.c"
        ),
        new LinkItem(
          "xoshiro / xoroshiro generators and the PRNG shootout",
          "https://prng.di.unimi.it/"
        ),
        new LinkItem(
          "Original Paper: Scrambled Linear Pseudorandom Number Generators (2021)",
          "https://doi.org/10.1145/3460772"
        ),
        new LinkItem(
          "arXiv: Scrambled Linear Pseudorandom Number Generators",
          "https://arxiv.org/pdf/1805.01407"
        )
      ];

      this.references = [
        new LinkItem(
          "Julia Language: Random Numbers (uses Xoshiro256++ as default)",
          "https://docs.julialang.org/en/v1/stdlib/Random/"
        ),
        new LinkItem(
          "Wikipedia: Xorshift (Xoshiro family)",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "PCG: A Quick Look at Xoshiro256**",
          "https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html"
        ),
        new LinkItem(
          "ACM Transactions on Mathematical Software Paper",
          "https://dl.acm.org/doi/10.1145/3460772"
        )
      ];

      // Test vectors generated using official C implementation at https://prng.di.unimi.it/xoshiro256plusplus.c
      // Seeded using SplitMix64 to generate initial state from single 64-bit value
      // All values verified against reference implementation
      this.tests = [
        {
          text: "Seed=0: First four 64-bit outputs from xoshiro256++",
          uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // State after SplitMix64(0) x4:
          // s[0]=0xe220a8397b1dcdaf, s[1]=0x6e789e6aa1b965f4, s[2]=0x06c45d188009454f, s[3]=0xf88bb8a8724c81ec
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0x53175d61490b23df  2. 0x61da6f3dc380d507  3. 0x5c0fdf91ec9a7bfc  4. 0x02eebf8c3bbe5e1a
          expected: OpCodes.Hex8ToBytes("df230b49615d175307d580c33d6fda61fc7b9aec91df0f5c1a5ebe3b8cbfee02")
        },
        {
          text: "Seed=1: First four 64-bit outputs from xoshiro256++",
          uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 32,
          // State after SplitMix64(1) x4:
          // s[0]=0x910a2dec89025cc1, s[1]=0xbeeb8da1658eec67, s[2]=0xf893a2eefb32555e, s[3]=0x71c18690ee42c90b
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0xcfc5d07f6f03c29b  2. 0xbf424132963fe08d  3. 0x19a37d5757aaf520  4. 0xbf08119f05cd56d6
          expected: OpCodes.Hex8ToBytes("9bc2036f7fd0c5cf8de03f96324142bf20f5aa57577da319d656cd059f1108bf")
        },
        {
          text: "Seed=12345: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930000000000000"), // 12345 in little-endian
          outputSize: 32,
          // State after SplitMix64(12345) x4:
          // s[0]=0x22118258a9d111a0, s[1]=0x346edce5f713f8ed, s[2]=0x1e9a57bc80e6721d, s[3]=0x2d160e7e5c3f42ca
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0x8d948a82def8a568  2. 0x3477f953796702a0  3. 0x15caa2fce6db8d69  4. 0x2cef8853c20c6dd0
          expected: OpCodes.Hex8ToBytes("68a5f8de828a948da002677953f97734698ddbe6fca2ca15d06d0cc25388ef2c")
        },
        {
          text: "Seed=0xDEADBEEFCAFEBABE: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("bebafecaefbeadde"), // 0xDEADBEEFCAFEBABE in little-endian
          outputSize: 32,
          // State after SplitMix64(0xDEADBEEFCAFEBABE) x4
          // Output sequence verified against reference implementation (little-endian bytes per 64-bit value)
          expected: OpCodes.Hex8ToBytes("e04d0b19e99f4cbcc3de715260d4eba244b245d6bcec25a8180f7ac01c1eb3a9")
        },
        {
          text: "Seed=0xFFFFFFFFFFFFFFFF: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          outputSize: 32,
          // State after SplitMix64(0xFFFFFFFFFFFFFFFF) x4
          // Output sequence verified against reference implementation (little-endian bytes per 64-bit value)
          expected: OpCodes.Hex8ToBytes("b2278e94cef8cc56905b5a2e438885e68bca1981a4b5e9e373ae325549190f46")
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
      return new Xoshiro256PlusPlusInstance(this);
    }
  }

  /**
 * Xoshiro256PlusPlus cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xoshiro256PlusPlusInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xoshiro256++ state: four 64-bit values (using BigInt)
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
        seedValue = OpCodes.OrN(seedValue, OpCodes.ShiftLn(BigInt(seedBytes[i]), BigInt(i * 8)));
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
     * Implements the xoshiro256++ algorithm
     *
     * Algorithm from https://prng.di.unimi.it/xoshiro256plusplus.c:
     * 1. result = rotl(s[0] + s[3], 23) + s[0]  (++ scrambler)
     * 2. t = s[1] shl 17
     * 3. s[2] ^= s[0]
     * 4. s[3] ^= s[1]
     * 5. s[1] ^= s[2]
     * 6. s[0] ^= s[3]
     * 7. s[2] ^= t
     * 8. s[3] = rotl(s[3], 45)
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xoshiro256++ not initialized: set seed first');
      }

      const s0 = this._s0;
      const s3 = this._s3;

      // Output function: result = rotl(s[0] + s[3], 23) + s[0]
      const sum = OpCodes.ToQWord(s0 + s3);
      const rotated = OpCodes.RotL64n(sum, 23);
      const result = OpCodes.ToQWord(rotated + s0);

      // State update
      const t = OpCodes.ShiftLn(this._s1, 17n);

      this._s2 = OpCodes.XorN(this._s2, this._s0);
      this._s3 = OpCodes.XorN(this._s3, this._s1);
      this._s1 = OpCodes.XorN(this._s1, this._s2);
      this._s0 = OpCodes.XorN(this._s0, this._s3);

      this._s2 = OpCodes.XorN(this._s2, t);
      this._s3 = OpCodes.RotL64n(this._s3, 45);

      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xoshiro256++ not initialized: set seed first');
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
      // Not implemented in basic xoshiro256++ - would require mixing
      // For now, Feed is a no-op (xoshiro256++ is deterministic)
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
     * Based on official implementation at https://prng.di.unimi.it/xoshiro256plusplus.c
     */
    jump() {
      // Jump polynomial coefficients from official implementation
      // Advances the state by 2^128 steps
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
     * Based on official implementation at https://prng.di.unimi.it/xoshiro256plusplus.c
     */
    longJump() {
      // Long jump polynomial coefficients from official implementation
      // Advances the state by 2^192 steps
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
  const algorithmInstance = new Xoshiro256PlusPlusAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xoshiro256PlusPlusAlgorithm, Xoshiro256PlusPlusInstance };
}));
