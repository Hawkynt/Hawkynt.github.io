/*
 * Xoshiro++ Pseudo-Random Number Generator Family
 * Original algorithm by David Blackman and Sebastiano Vigna (2018)
 * Public domain reference implementation
 *
 * This unified implementation supports both:
 * - Xoshiro128++ (32-bit variant with 128-bit state)
 * - Xoshiro256++ (64-bit variant with 256-bit state)
 *
 * Xoshiro128++ is a 32-bit all-purpose, rock-solid pseudo-random number generator
 * with excellent speed and statistical properties. It features a 128-bit state
 * (four 32-bit values), passes all BigCrush statistical tests, and is ideal for
 * embedded systems, GPUs, and JavaScript environments.
 *
 * Xoshiro256++ is the 64-bit variant with a 256-bit state (four 64-bit values),
 * providing a larger state space and longer period for applications requiring
 * higher-quality random sequences.
 *
 * Algorithm (Xoshiro128++):
 *   result = rotl(s[0] + s[3], 7) + s[0]
 *   t = s[1] leftshift 9
 *   s[2] XOR= s[0]
 *   s[3] XOR= s[1]
 *   s[1] XOR= s[2]
 *   s[0] XOR= s[3]
 *   s[2] XOR= t
 *   s[3] = rotl(s[3], 11)
 *   return result
 *
 * Algorithm (Xoshiro256++):
 *   result = rotl(s[0] + s[3], 23) + s[0]
 *   t = s[1] leftshift 17
 *   s[2] XOR= s[0]
 *   s[3] XOR= s[1]
 *   s[1] XOR= s[2]
 *   s[0] XOR= s[3]
 *   s[2] XOR= t
 *   s[3] = rotl(s[3], 45)
 *   return result
 *
 * Reference: https://prng.di.unimi.it/
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
   * Used to initialize xoshiro128++ state from a single 32-bit seed
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

  /**
   * SplitMix64 seeding algorithm
   * Used to initialize xoshiro256++ state from a single 64-bit seed
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

    return { value: z, nextState: state };
  }

  /**
   * Unified Xoshiro++ Algorithm Class
   * Supports both 128-bit (32-bit) and 256-bit (64-bit) variants
   */
  class XoshiroPlusPlusAlgorithm extends RandomGenerationAlgorithm {
    constructor(bitWidth) {
      super();

      this.bitWidth = bitWidth;

      if (bitWidth === 128) {
        // Xoshiro128++ (32-bit variant)
        this.name = "Xoshiro128++";
        this.description = "Xoshiro128++ is a 32-bit all-purpose, rock-solid pseudo-random number generator with excellent speed and statistical properties. It features a 128-bit state, passes all BigCrush tests, and is ideal for embedded systems, GPUs, and JavaScript environments.";
        this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (8-32 bit seed)

        // Test vectors for Xoshiro128++
        this.tests = [
          {
            text: "Seed=0: First five 32-bit outputs from xoshiro128++",
            uri: "https://prng.di.unimi.it/xoshiro128plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("00000000"),
            outputSize: 20, // 5 x 32-bit values = 20 bytes
            // State after SplitMix32(0): s[0]=0x64625032, s[1]=0xD9C0799C
            //                             s[2]=0xAF362E10, s[3]=0x7FA88912
            // Output sequence: 0x69CEF2A4, 0x89959840, 0xEEB93EBE, 0x99849937, 0x28EE3191
            expected: OpCodes.Hex8ToBytes("a4f2ce6940989589be3eb9ee379984999131ee28")
          },
          {
            text: "Seed=1: First five 32-bit outputs from xoshiro128++",
            uri: "https://prng.di.unimi.it/xoshiro128plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("01000000"),
            outputSize: 20,
            // State after SplitMix32(1): s[0]=0x5E2D1772, s[1]=0x14E498F0
            //                             s[2]=0xD20EA1FD, s[3]=0xB382F339
            // Output sequence: 0x36326CFA, 0x4E3077D1, 0x48F4CD8D, 0xECD57157, 0xA7AFED85
            expected: OpCodes.Hex8ToBytes("fa6c3236d177304e8dcdf4485771d5ec85edafa7")
          },
          {
            text: "Seed=42: First five 32-bit outputs from xoshiro128++",
            uri: "https://prng.di.unimi.it/xoshiro128plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("2a000000"),
            outputSize: 20,
            // State after SplitMix32(42): s[0]=0x20E44818, s[1]=0x0895A923
            //                              s[2]=0x1339A01F, s[3]=0xB4E3841A
            // Output sequence: 0x04CA6182, 0x9AABE747, 0xA3C70577, 0x3EFF06D6, 0x20491D5E
            expected: OpCodes.Hex8ToBytes("8261ca0447e7ab9a7705c7a3d606ff3e5e1d4920")
          },
          {
            text: "Seed=12345: First five 32-bit outputs",
            uri: "https://prng.di.unimi.it/xoshiro128plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("39300000"), // 12345 in little-endian
            outputSize: 20,
            // State after SplitMix32(12345): s[0]=0xC3B24A19, s[1]=0x248B6DF5
            //                                 s[2]=0xAF4B7724, s[3]=0x1EC7438D
            // Output sequence: 0x00791D8A, 0xB3117E0E, 0x95635769, 0xD030B7CB, 0xDA166145
            expected: OpCodes.Hex8ToBytes("8a1d79000e7e11b369576395cbb730d0456116da")
          }
        ];
      } else if (bitWidth === 256) {
        // Xoshiro256++ (64-bit variant)
        this.name = "Xoshiro256++";
        this.description = "Xoshiro256++ is an all-purpose, rock-solid, small-state pseudo-random number generator with excellent speed and statistical properties. It features a 256-bit state, passes all statistical tests, and uses addition and rotation for the output function.";
        this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed

        // Test vectors for Xoshiro256++
        this.tests = [
          {
            text: "Seed=0: First four 64-bit outputs from xoshiro256++",
            uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("0000000000000000"),
            outputSize: 32, // 4 x 64-bit values = 32 bytes
            // State after SplitMix64(0): s[0]=0xe220a8397b1dcdaf, s[1]=0x6e789e6aa1b965f4
            //                             s[2]=0x06c45d188009454f, s[3]=0xf88bb8a8724c81ec
            // Output sequence: 0x53175d61490b23df, 0x61da6f3dc380d507, 0x5c0fdf91ec9a7bfc, 0x02eebf8c3bbe5e1a
            expected: OpCodes.Hex8ToBytes("df230b49615d175307d580c33d6fda61fc7b9aec91df0f5c1a5ebe3b8cbfee02")
          },
          {
            text: "Seed=1: First four 64-bit outputs from xoshiro256++",
            uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("0100000000000000"),
            outputSize: 32,
            // State after SplitMix64(1): s[0]=0x910a2dec89025cc1, s[1]=0xbeeb8da1658eec67
            //                             s[2]=0xf893a2eefb32555e, s[3]=0x71c18690ee42c90b
            // Output sequence: 0xcfc5d07f6f03c29b, 0xbf424132963fe08d, 0x19a37d5757aaf520, 0xbf08119f05cd56d6
            expected: OpCodes.Hex8ToBytes("9bc2036f7fd0c5cf8de03f96324142bf20f5aa57577da319d656cd059f1108bf")
          },
          {
            text: "Seed=12345: First four 64-bit outputs",
            uri: "https://prng.di.unimi.it/xoshiro256plusplus.c",
            input: null,
            seed: OpCodes.Hex8ToBytes("3930000000000000"), // 12345 in little-endian
            outputSize: 32, // 4 x 64-bit values = 32 bytes
            // State after SplitMix64(12345): s[0]=0x22118258a9d111a0, s[1]=0x346edce5f713f8ed
            //                                 s[2]=0x1e9a57bc80e6721d, s[3]=0x2d160e7e5c3f42ca
            // Output sequence: 0x8d948a82def8a568, 0x3477f953796702a0, 0x15caa2fce6db8d69, 0x2cef8853c20c6dd0
            expected: OpCodes.Hex8ToBytes("68a5f8de828a948da002677953f97734698ddbe6fca2ca15d06d0cc25388ef2c")
          }
        ];
      } else {
        throw new Error(`Invalid bit width: ${bitWidth}. Supported values: 128, 256`);
      }

      // Common metadata
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

      // Documentation (common to both variants)
      this.documentation = [
        new LinkItem(
          `Official Reference Implementation (${this.name})`,
          bitWidth === 128
            ? "https://prng.di.unimi.it/xoshiro128plusplus.c"
            : "https://prng.di.unimi.it/xoshiro256plusplus.c"
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
        )
      ];

      // Add variant-specific references
      if (bitWidth === 128) {
        this.references.push(
          new LinkItem(
            "Rust SmallRng (uses xoshiro128++)",
            "https://docs.rs/rand/latest/rand/rngs/struct.SmallRng.html"
          ),
          new LinkItem(
            "Java RandomGenerator (includes xoshiro128++)",
            "https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/random/package-summary.html"
          )
        );
      } else {
        this.references.push(
          new LinkItem(
            "PCG: A Quick Look at Xoshiro256**",
            "https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html"
          )
        );
      }
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
      return new XoshiroPlusPlusInstance(this);
    }
  }

  /**
   * Unified Xoshiro++ Instance Class
   * Implements both 32-bit and 64-bit variants based on algorithm.bitWidth
   */
  class XoshiroPlusPlusInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      this.bitWidth = algorithm.bitWidth;

      if (this.bitWidth === 128) {
        // Xoshiro128++ state: four 32-bit values
        this._s0 = 0;
        this._s1 = 0;
        this._s2 = 0;
        this._s3 = 0;
      } else {
        // Xoshiro256++ state: four 64-bit values (using BigInt)
        this._s0 = 0n;
        this._s1 = 0n;
        this._s2 = 0n;
        this._s3 = 0n;
      }

      this._ready = false;
    }

    /**
     * Set seed value
     * For 128-bit: 1-4 bytes (32-bit seed)
     * For 256-bit: 8 bytes (64-bit seed)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (this.bitWidth === 128) {
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
      } else {
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
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit random value (Xoshiro128++)
     * @returns {number} 32-bit random value
     */
    _next32() {
      if (!this._ready) {
        throw new Error('Xoshiro128++ not initialized: set seed first');
      }

      // Output function: result = rotl(s[0] + s[3], 7) + s[0]
      const sum = OpCodes.ToInt(this._s0 + this._s3);
      const rotated = OpCodes.RotL32(sum, 7);
      const result = OpCodes.ToInt(rotated + this._s0);

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
     * Generate next 64-bit random value (Xoshiro256++)
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xoshiro256++ not initialized: set seed first');
      }

      // Output function: result = rotl(s[0] + s[3], 23) + s[0]
      const sum = OpCodes.ToQWord(this._s0 + this._s3);
      const rotated = OpCodes.RotL64n(sum, 23);
      const result = OpCodes.ToQWord(rotated + this._s0);

      // State update
      const t = OpCodes.ShiftLn(this._s1, 17);

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
        const variant = this.bitWidth === 128 ? 'Xoshiro128++' : 'Xoshiro256++';
        throw new Error(`${variant} not initialized: set seed first`);
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesGenerated = 0;

      if (this.bitWidth === 128) {
        // Generate 32-bit values and extract bytes
        while (bytesGenerated < length) {
          const value32 = this._next32();

          // Extract bytes in little-endian order
          const bytesToExtract = Math.min(4, length - bytesGenerated);
          for (let i = 0; i < bytesToExtract; ++i) {
            const byteVal = OpCodes.Shr32(value32, i * 8) &0xFF;
            output.push(byteVal);
            ++bytesGenerated;
          }
        }
      } else {
        // Generate 64-bit values and extract bytes
        while (bytesGenerated < length) {
          const value64 = this._next64();

          // Extract bytes in little-endian order
          for (let i = 0; i < 8 && bytesGenerated < length; ++i) {
            const shifted = OpCodes.ShiftRn(value64, i * 8);
            const byteVal = Number(OpCodes.AndN(shifted, 0xFFn));
            output.push(byteVal);
            ++bytesGenerated;
          }
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
      // Not implemented in basic xoshiro++ - would require mixing
      // For now, Feed is a no-op (xoshiro++ is deterministic)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default based on variant
      // 32 bytes = 8 x 32-bit values for 128-bit variant
      // 32 bytes = 4 x 64-bit values for 256-bit variant
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
     * Jump function
     * Xoshiro128++: equivalent to 2^64 calls to _next32()
     * Xoshiro256++: equivalent to 2^128 calls to _next64()
     * Useful for parallel computation - allows splitting the sequence
     * Based on official implementation
     */
    jump() {
      if (this.bitWidth === 128) {
        // Jump polynomial coefficients for xoshiro128++ (from official implementation)
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
      } else {
        // Jump polynomial coefficients for xoshiro256++ (from official implementation)
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
            const mask = OpCodes.ShiftLn(1n, b);
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
    }

    /**
     * Long jump function
     * Xoshiro128++: equivalent to 2^96 calls to _next32()
     * Xoshiro256++: equivalent to 2^192 calls to _next64()
     * Useful for parallel computation across multiple machines
     * Based on official implementation
     */
    longJump() {
      if (this.bitWidth === 128) {
        // Long jump polynomial coefficients for xoshiro128++ (from official implementation)
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
      } else {
        // Long jump polynomial coefficients for xoshiro256++ (from official implementation)
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
            const mask = OpCodes.ShiftLn(1n, b);
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
  }

  // Register both variants
  const xoshiro128 = new XoshiroPlusPlusAlgorithm(128);
  const xoshiro256 = new XoshiroPlusPlusAlgorithm(256);

  if (!AlgorithmFramework.Find(xoshiro128.name)) {
    RegisterAlgorithm(xoshiro128);
  }

  if (!AlgorithmFramework.Find(xoshiro256.name)) {
    RegisterAlgorithm(xoshiro256);
  }

  return { XoshiroPlusPlusAlgorithm, XoshiroPlusPlusInstance };
}));
