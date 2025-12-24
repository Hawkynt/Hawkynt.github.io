/*
 * XorWow Pseudo-Random Number Generator
 * Based on George Marsaglia's XorShift with Weyl sequence enhancement
 *
 * XorWow extends the xorshift128 algorithm by adding a Weyl sequence generator
 * to improve statistical properties and eliminate short-period anomalies.
 * Used as the default PRNG in NVIDIA's CUDA cuRAND library.
 *
 * Period: 2^192 - 2^32
 * State: 160 bits (five 32-bit state words + 32-bit Weyl counter)
 * Algorithm: XorShift operations with Weyl sequence addition
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

  class XorWowAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XorWow";
      this.description = "XorWow combines George Marsaglia's XorShift algorithm with a Weyl sequence for improved statistical properties. It has a period of 2^192-2^32 and is used as the default PRNG in NVIDIA's CUDA cuRAND library for GPU-accelerated random number generation.";
      this.inventor = "George Marsaglia";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 24, 1)]; // 1-24 bytes (up to 192-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "NVIDIA CUDA cuRAND Documentation",
          "https://docs.nvidia.com/cuda/curand/device-api-overview.html#xorwow-generator"
        ),
        new LinkItem(
          "Original Paper: Xorshift RNGs (Marsaglia, 2003)",
          "https://www.jstatsoft.org/article/view/v008i14"
        ),
        new LinkItem(
          "Wikipedia: Xorshift",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "TestU01 Results for XorWow",
          "https://github.com/cmcqueen/simplerandom"
        )
      ];

      this.references = [
        new LinkItem(
          "CUDA Toolkit Source Code",
          "https://developer.nvidia.com/cuda-toolkit"
        ),
        new LinkItem(
          "SimpleRandom Library (Reference Implementation)",
          "https://github.com/cmcqueen/simplerandom"
        ),
        new LinkItem(
          "Random123 Library (Alternative High-Quality PRNGs)",
          "https://www.deshawresearch.com/resources_random123.html"
        )
      ];

      // Test vectors verified against C# reference implementation
      // XorWow state: [x, y, z, w, v, weyl] each as 32-bit values
      // Reference: C# implementation at X:\Coding\Working Copies\Hawkynt.git\Randomizer\RandomNumberGenerators\Deterministic\XorWow.cs
      this.tests = [
        {
          text: "Seed (1): First 5 outputs - verified against C# implementation",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"), // 64-bit seed value 1
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "ACBED487" +  // Output 1: 2898187399
            "B97556A0" +  // Output 2: 3111474848
            "81F6278D" +  // Output 3: 2180392845
            "17AEC601" +  // Output 4: 397329921
            "C87F3B27"    // Output 5: 3363781415
          )
        },
        {
          text: "Seed (123456789): First 5 outputs - verified against C# implementation",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000075BCD15"), // 64-bit seed value 123456789
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "F43C1487" +  // Output 1: 4097578119
            "A09D56A0" +  // Output 2: 2694665888
            "450E278D" +  // Output 3: 1158555533
            "8D50C601" +  // Output 4: 2370881025
            "6E23FB27"    // Output 5: 1847851815
          )
        },
        {
          text: "Seed (0xDEADBEEF): First 5 outputs - common test value",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000DEADBEEF"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "3416E047" +  // Output 1: 873914439
            "5731BD20" +  // Output 2: 1462877472
            "2A80E40D" +  // Output 3: 713090061
            "8042EC81" +  // Output 4: 2151869569
            "FA2C61E7"    // Output 5: 4197212647
          )
        },
        {
          text: "Seed (1000000): First 5 outputs - large seed value",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000F4240"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "780C3C87" +  // Output 1: 2014067847
            "E80AF6A0" +  // Output 2: 3893032608
            "73ACC78D" +  // Output 3: 1940703117
            "F6276601" +  // Output 4: 4129777153
            "19333327"    // Output 5: 422785831
          )
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
      return new XorWowInstance(this);
    }
  }

  /**
 * XorWow cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XorWowInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // XorWow uses 5x 32-bit state variables + 1 Weyl counter
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 0;
      this._v = 0;
      this._weyl = 0;
      this._ready = false;

      // Weyl sequence constant (from CUDA cuRAND and original implementation)
      this._WEYL_CONSTANT = 362437;
    }

    /**
     * Set seed value (1-24 bytes)
     * Seed format: 8-byte seed (low 32 bits, high 32 bits) or full 24-byte state
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Handle 64-bit seed (standard case)
      if (seedBytes.length === 8) {
        // C# treats ulong as little-endian: low 32 bits first, then high 32 bits
        // So for seed bytes in big-endian format, we need to swap the halves
        const high = OpCodes.Pack32BE(
          seedBytes[0] || 0,
          seedBytes[1] || 0,
          seedBytes[2] || 0,
          seedBytes[3] || 0
        );
        const low = OpCodes.Pack32BE(
          seedBytes[4] || 0,
          seedBytes[5] || 0,
          seedBytes[6] || 0,
          seedBytes[7] || 0
        );

        // Initialize state using the same algorithm as C# version
        const s0 = OpCodes.Xor32(low, 0xAAD26B49);
        const s1 = OpCodes.Xor32(high, 0xF7DCEFDD);
        const t0 = OpCodes.ToUint32((1099087573 * s0));
        const t1 = OpCodes.ToUint32((2591861531 * s1));

        this._weyl = OpCodes.ToUint32(6615241 + t1 + t0);
        this._x = OpCodes.ToUint32(123456789 + t0);
        this._y = OpCodes.Xor32(362436069, t0);
        this._z = OpCodes.ToUint32(521288629 + t1);
        this._w = OpCodes.Xor32(88675123, t1);
        this._v = OpCodes.ToUint32(5783321 + t0);

        this._ready = true;
        return;
      }

      // Handle full state initialization (24 bytes = 6 × 32-bit words)
      if (seedBytes.length >= 24) {
        this._x = OpCodes.Pack32BE(seedBytes[0], seedBytes[1], seedBytes[2], seedBytes[3]);
        this._y = OpCodes.Pack32BE(seedBytes[4], seedBytes[5], seedBytes[6], seedBytes[7]);
        this._z = OpCodes.Pack32BE(seedBytes[8], seedBytes[9], seedBytes[10], seedBytes[11]);
        this._w = OpCodes.Pack32BE(seedBytes[12], seedBytes[13], seedBytes[14], seedBytes[15]);
        this._v = OpCodes.Pack32BE(seedBytes[16], seedBytes[17], seedBytes[18], seedBytes[19]);
        this._weyl = OpCodes.Pack32BE(seedBytes[20], seedBytes[21], seedBytes[22], seedBytes[23]);

        this._ready = true;
        return;
      }

      // For other lengths, pad to 8 bytes and use standard initialization
      const paddedSeed = new Array(8).fill(0);
      for (let i = 0; i < Math.min(seedBytes.length, 8); ++i) {
        paddedSeed[i] = seedBytes[i];
      }
      this.seed = paddedSeed;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using xorwow algorithm
     *
     * Algorithm from Marsaglia (2003) with Weyl sequence:
     * t = x XOR (x right-shift 2)
     * t = t XOR (t left-shift 1)
     * x = y; y = z; z = w; w = v
     * v = v XOR (v left-shift 4)
     * v = v XOR t
     * weyl = weyl + WEYL_CONSTANT
     * return v + weyl
     */
    _next32() {
      if (!this._ready) {
        throw new Error('XorWow not initialized: set seed first');
      }

      // Step 1: t = x XOR (x right-shift 2)
      let t = OpCodes.Xor32(this._x, OpCodes.Shr32(this._x, 2));

      // Step 2: t = t XOR (t left-shift 1)
      t = OpCodes.Xor32(t, OpCodes.Shl32(t, 1));

      // Step 3: Rotate state variables (x=y, y=z, z=w, w=v)
      this._x = this._y;
      this._y = this._z;
      this._z = this._w;
      this._w = this._v;

      // Step 4: v = v XOR (v left-shift 4)
      this._v = OpCodes.Xor32(this._v, OpCodes.Shl32(this._v, 4));

      // Step 5: v = v^t
      this._v = OpCodes.Xor32(this._v, t);

      // Step 6: Add Weyl sequence
      this._weyl = OpCodes.ToUint32((this._weyl + this._WEYL_CONSTANT));

      // Step 7: Return combined result
      return OpCodes.ToUint32((this._v + this._weyl));
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('XorWow not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        const bytes = OpCodes.Unpack32BE(value);

        for (let i = 0; i < bytesToExtract; ++i) {
          output.push(bytes[i]);
        }

        bytesRemaining -= bytesToExtract;
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
      // For PRNG, Feed can be used to skip outputs
      // Not standard for basic xorwow, but useful for testing
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors
      if (this._skip && this._skip > 0) {
        // Skip the specified number of 32-bit outputs
        for (let i = 0; i < this._skip; ++i) {
          this._next32();
        }
        this._skip = 0; // Reset skip counter
      }

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
     * Set skip count (number of outputs to skip before generating result)
     */
    set skip(count) {
      this._skip = count;
    }

    get skip() {
      return this._skip || 0;
    }
  }

  // Register algorithm
  const algorithmInstance = new XorWowAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XorWowAlgorithm, XorWowInstance };
}));
