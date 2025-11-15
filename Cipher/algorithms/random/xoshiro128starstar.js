/*
 * Xoshiro128** Pseudo-Random Number Generator
 * Original algorithm by David Blackman and Sebastiano Vigna (2018)
 * Public domain reference implementation
 *
 * Xoshiro128** is a 32-bit all-purpose, rock-solid pseudo-random number generator
 * with excellent speed and statistical properties. It uses a multiplication-based
 * scrambler (**) that provides better statistical quality than the ++ variant,
 * particularly for floating-point generation. Features a 128-bit state (four 32-bit
 * values), passes all BigCrush statistical tests, and is ideal for embedded systems,
 * GPUs, and JavaScript environments.
 *
 * Reference: https://prng.di.unimi.it/xoshiro128starstar.c
 *
 * Algorithm:
 *   result = rotl(s[1] * 5, 7) * 9
 *   t = s[1] leftshift 9
 *   s[2] XOR= s[0]
 *   s[3] XOR= s[1]
 *   s[1] XOR= s[2]
 *   s[0] XOR= s[3]
 *   s[2] XOR= t
 *   s[3] = rotl(s[3], 11)
 *   return result
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
   * SplitMix32 seeding algorithm (improved variant)
   * Used to initialize xoshiro128** state from a single 32-bit seed
   * Based on MurmurHash3 fmix32 with improved mixing constants
   */
  function SplitMix32(state) {
    const GOLDEN_GAMMA = 0x9E3779B9;
    const MIX_CONST_1 = 0x21f0aaad;
    const MIX_CONST_2 = 0x735a2d97;

    state = OpCodes.ToInt(state + GOLDEN_GAMMA);
    let z = state;

    z = Math.imul(z^OpCodes.Shr32(z, 16), MIX_CONST_1);
    z = OpCodes.ToDWord(z);
    z = Math.imul(z^OpCodes.Shr32(z, 15), MIX_CONST_2);
    z = OpCodes.ToDWord(z);
    z = z^OpCodes.Shr32(z, 15);

    return { value: OpCodes.ToDWord(z), nextState: state };
  }

  class Xoshiro128StarStarAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xoshiro128**";
      this.description = "Xoshiro128** is a 32-bit all-purpose, rock-solid pseudo-random number generator with excellent speed and statistical properties. It uses a multiplication-based scrambler for superior statistical quality, passes all BigCrush tests, and is ideal for embedded systems, GPUs, and JavaScript environments.";
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
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (8-32 bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official Reference Implementation",
          "https://prng.di.unimi.it/xoshiro128starstar.c"
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
          "https://en.wikipedia.org/wiki/Xoroshiro128%2B"
        ),
        new LinkItem(
          "Comparison: ** vs ++ scrambler",
          "https://prng.di.unimi.it/#speed"
        )
      ];

      // Test vectors generated using official reference algorithm
      // Seeding with SplitMix32 (improved variant), then generating outputs
      // Validated against reference C implementation at https://prng.di.unimi.it/xoshiro128starstar.c
      this.tests = [
        {
          text: "Seed=0: First five 32-bit outputs from xoshiro128**",
          uri: "https://prng.di.unimi.it/xoshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 20, // 5 x 32-bit values = 20 bytes
          // State after SplitMix32(0): s[0]=0x64625032, s[1]=0xD9C0799C
          //                             s[2]=0xAF362E10, s[3]=0x7FA88912
          // Output sequence: 0x6AB03720, 0x02AE349E, 0x96495024, 0xE5671339, 0x43D97292
          expected: OpCodes.Hex8ToBytes("2037b06a9e34ae0224504996391367e59272d943")
        },
        {
          text: "Seed=1: First five 32-bit outputs from xoshiro128**",
          uri: "https://prng.di.unimi.it/xoshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("01000000"),
          outputSize: 20,
          // State after SplitMix32(1): s[0]=0x5E2D1772, s[1]=0x14E498F0
          //                             s[2]=0xD20EA1FD, s[3]=0xB382F339
          // Output sequence: 0x177119D4, 0x81962DE5, 0xE3609AB3, 0x7CBCC17A, 0x6F2C548E
          expected: OpCodes.Hex8ToBytes("d4197117e52d9681b39a60e37ac1bc7c8e542c6f")
        },
        {
          text: "Seed=42: First five 32-bit outputs from xoshiro128**",
          uri: "https://prng.di.unimi.it/xoshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("2a000000"),
          outputSize: 20,
          // State after SplitMix32(42): s[0]=0x20E44818, s[1]=0x0895A923
          //                              s[2]=0x1339A01F, s[3]=0xB4E3841A
          // Output sequence: 0x275D943D, 0xD9B9AAB4, 0x04A1304E, 0x36411021, 0x88EE979C
          expected: OpCodes.Hex8ToBytes("3d945d27b4aab9d94e30a104211041369c97ee88")
        },
        {
          text: "Seed=12345: First five 32-bit outputs",
          uri: "https://prng.di.unimi.it/xoshiro128starstar.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("39300000"), // 12345 in little-endian
          outputSize: 20,
          // State after SplitMix32(12345): s[0]=0xC3B24A19, s[1]=0x248B6DF5
          //                                 s[2]=0xAF4B7724, s[3]=0x1EC7438D
          // Output sequence: 0x412A0BB3, 0x0C1995DD, 0xDF008665, 0xE2B83D66, 0xF9127DE4
          expected: OpCodes.Hex8ToBytes("b30b2a41dd95190c658600df663db8e2e47d12f9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new Xoshiro128StarStarInstance(this);
    }
  }

  class Xoshiro128StarStarInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xoshiro128** state: four 32-bit values
      this._s0 = 0;
      this._s1 = 0;
      this._s2 = 0;
      this._s3 = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-4 bytes for 32-bit seed)
     * Uses SplitMix32 to initialize the four state values
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 32-bit value (little-endian)
      let seedValue = 0;
      for (let i = 0; i < Math.min(4, seedBytes.length); ++i) {
        seedValue |= OpCodes.Shl32(seedBytes[i], i * 8);
      }
      seedValue = OpCodes.ToDWord(seedValue);

      // Initialize state using SplitMix32
      let state = seedValue;

      let result = SplitMix32(state);
      this._s0 = result.value;
      state = result.nextState;

      result = SplitMix32(state);
      this._s1 = result.value;
      state = result.nextState;

      result = SplitMix32(state);
      this._s2 = result.value;
      state = result.nextState;

      result = SplitMix32(state);
      this._s3 = result.value;

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit random value
     * Implements the xoshiro128** algorithm with multiplication scrambler
     * @returns {number} 32-bit random value
     */
    _next32() {
      if (!this._ready) {
        throw new Error('Xoshiro128** not initialized: set seed first');
      }

      // Output function: result = rotl(s[1] * 5, 7) * 9
      const product1 = Math.imul(this._s1, 5);
      const rotated = OpCodes.RotL32(product1, 7);
      const result = Math.imul(rotated, 9);

      // State update
      const t = OpCodes.Shl32(this._s1, 9);

      this._s2 ^= this._s0;
      this._s3 ^= this._s1;
      this._s1 ^= this._s2;
      this._s0 ^= this._s3;

      this._s2 ^= t;
      this._s3 = OpCodes.RotL32(this._s3, 11);

      // Ensure all state values remain unsigned 32-bit
      this._s0 = OpCodes.ToDWord(this._s0);
      this._s1 = OpCodes.ToDWord(this._s1);
      this._s2 = OpCodes.ToDWord(this._s2);
      this._s3 = OpCodes.ToDWord(this._s3);

      return OpCodes.ToDWord(result);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xoshiro128** not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesGenerated = 0;

      while (bytesGenerated < length) {
        // Generate next 32-bit value
        const value32 = this._next32();

        // Extract bytes in little-endian order
        const bytesToExtract = Math.min(4, length - bytesGenerated);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byteVal = OpCodes.Shr32(value32, i * 8) &0xFF;
          output.push(byteVal);
          ++bytesGenerated;
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic xoshiro128** - would require mixing
      // For now, Feed is a no-op (xoshiro128** is deterministic)
    }

    Result() {
      // Use specified output size or default to 32 bytes (8 x 32-bit values)
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
     * Jump function (equivalent to 2^64 calls to _next32())
     * Useful for parallel computation - allows splitting the sequence
     * Based on official implementation
     */
    jump() {
      // Jump polynomial coefficients (from official implementation)
      const JUMP = [0x8764000b, 0xf542d2d3, 0x6fa035c3, 0x77f2db5b];

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;

      for (let i = 0; i < JUMP.length; ++i) {
        for (let b = 0; b < 32; ++b) {
          if ((JUMP[i] &OpCodes.Shl32(1, b)) !== 0) {
            s0 ^= this._s0;
            s1 ^= this._s1;
            s2 ^= this._s2;
            s3 ^= this._s3;
          }
          this._next32();
        }
      }

      this._s0 = OpCodes.ToDWord(s0);
      this._s1 = OpCodes.ToDWord(s1);
      this._s2 = OpCodes.ToDWord(s2);
      this._s3 = OpCodes.ToDWord(s3);
    }

    /**
     * Long jump function (equivalent to 2^96 calls to _next32())
     * Useful for parallel computation across multiple machines
     * Based on official implementation
     */
    longJump() {
      // Long jump polynomial coefficients (from official implementation)
      const LONG_JUMP = [0xb523952e, 0x0b6f099f, 0xccf5a0ef, 0x1c580662];

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;

      for (let i = 0; i < LONG_JUMP.length; ++i) {
        for (let b = 0; b < 32; ++b) {
          if ((LONG_JUMP[i] &OpCodes.Shl32(1, b)) !== 0) {
            s0 ^= this._s0;
            s1 ^= this._s1;
            s2 ^= this._s2;
            s3 ^= this._s3;
          }
          this._next32();
        }
      }

      this._s0 = OpCodes.ToDWord(s0);
      this._s1 = OpCodes.ToDWord(s1);
      this._s2 = OpCodes.ToDWord(s2);
      this._s3 = OpCodes.ToDWord(s3);
    }
  }

  // Register algorithm
  const algorithmInstance = new Xoshiro128StarStarAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xoshiro128StarStarAlgorithm, Xoshiro128StarStarInstance };
}));
