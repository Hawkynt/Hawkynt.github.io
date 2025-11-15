/*
 * XorShift128 Pseudo-Random Number Generator
 * Based on George Marsaglia's original xorshift algorithm (2003)
 *
 * This implementation uses the classic xorshift128 variant with 4x 32-bit state
 * variables, as described in Marsaglia's seminal paper "Xorshift RNGs" (2003).
 *
 * Period: 2^128 - 1
 * State: 128 bits (four 32-bit words)
 * Algorithm: Three xorshift operations with parameters (11, 8, 19)
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

  class XorShift128Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XorShift128";
      this.description = "XorShift128 is a very fast pseudo-random number generator invented by George Marsaglia. It uses three xorshift operations on a 128-bit state to generate high-quality random numbers with a period of 2^128-1. Widely used in simulations and gaming.";
      this.inventor = "George Marsaglia";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // 1-16 bytes (up to 128-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Xorshift RNGs (Marsaglia, 2003)",
          "https://www.jstatsoft.org/article/view/v008i14"
        ),
        new LinkItem(
          "Wikipedia: Xorshift",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "Reference Implementation (GitHub)",
          "https://github.com/WebDrake/xorshift"
        ),
        new LinkItem(
          "Sebastiano Vigna: Analysis of xorshift generators",
          "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Modern PRNG Alternatives (xoshiro/xoroshiro)",
          "https://prng.di.unimi.it/"
        )
      ];

      // Test vectors verified against reference implementation
      // Generated using parameters (11, 8, 19) from Marsaglia's paper
      // Seed format: [x, y, z, w] each as 32-bit big-endian
      // Reference: Marsaglia, G. (2003). "Xorshift RNGs". Journal of Statistical Software, 8(14), 1-6.
      this.tests = [
        {
          text: "Seed (1,2,3,4): First 5 outputs (20 bytes) - verified against reference C implementation",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000020000000300000004"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "0000080D" +  // Output 1: 2061
            "0000181F" +  // Output 2: 6175
            "00000004" +  // Output 3: 4
            "00002020" +  // Output 4: 8224
            "0040004D"    // Output 5: 4194381
          )
        },
        {
          text: "Seed (123456789, 362436069, 521288629, 88675123): First 10 outputs - Marsaglia's standard test seed",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15159A55E51F123BB505491333"),
          outputSize: 40, // 10 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "DCA345EA" +  // Output 1: 3701687786
            "1B5116E6" +  // Output 2: 458299110
            "951049AA" +  // Output 3: 2500872618
            "D88D00B0" +  // Output 4: 3633119408
            "1EC7825E" +  // Output 5: 516391518
            "8DB24146" +  // Output 6: 2377269574
            "9AF81443" +  // Output 7: 2599949379
            "2AC00F2C" +  // Output 8: 717229868
            "0837AD58" +  // Output 9: 137866584
            "17906569"    // Output 10: 395339113
          )
        },
        {
          text: "Seed (1,1,1,1): First 8 outputs - all identical seed values",
          uri: "https://github.com/WebDrake/xorshift",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000010000000100000001"),
          outputSize: 32, // 8 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "00000808" +  // Output 1: 2056
            "00000001" +  // Output 2: 1
            "00000808" +  // Output 3: 2056
            "00000001" +  // Output 4: 1
            "00400841" +  // Output 5: 4196417
            "00400040" +  // Output 6: 4194368
            "00000808" +  // Output 7: 2056
            "00000001"    // Output 8: 1
          )
        },
        {
          text: "Seed (1000000, 2000000, 3000000, 4000000): First 5 outputs - large seed values",
          uri: "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf",
          input: null,
          seed: OpCodes.Hex8ToBytes("000F4240001E8480002DC6C0003D0900"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "7A5A5605" +  // Output 1: 2053281285
            "8E94E74A" +  // Output 2: 2391615306
            "E0E12B9E" +  // Output 3: 3772312478
            "087C4B8B" +  // Output 4: 142163851
            "A03EDEFF"    // Output 5: 2688593663
          )
        },
        {
          text: "Seed (1,2,3,4): Outputs 11-15 - verifies long-term state progression",
          uri: "https://github.com/WebDrake/xorshift",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000020000000300000004"),
          outputSize: 20,
          skip: 10,  // Skip first 10 outputs
          expected: OpCodes.Hex8ToBytes(
            "00C28A0F" +  // Output 11: 12749327
            "004ED758" +  // Output 12: 5166936
            "11C11A89" +  // Output 13: 298143369
            "22431FFE" +  // Output 14: 574898174
            "36C57B4B"    // Output 15: 918945611
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new XorShift128Instance(this);
    }
  }

  class XorShift128Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // XorShift128 uses 4x 32-bit state variables
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-16 bytes)
     * Seed format: up to 16 bytes mapped to four 32-bit words (x, y, z, w)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize state variables from seed
      // Default to common starting values if seed is shorter than 16 bytes
      this._x = 123456789;
      this._y = 362436069;
      this._z = 521288629;
      this._w = 88675123;

      // Override with provided seed bytes (big-endian)
      let offset = 0;
      if (seedBytes.length >= 4) {
        this._x = OpCodes.Pack32BE(
          seedBytes[0] || 0,
          seedBytes[1] || 0,
          seedBytes[2] || 0,
          seedBytes[3] || 0
        );
        offset = 4;
      } else if (seedBytes.length > 0) {
        // For seeds < 4 bytes, pack what we have into x
        const bytes = [0, 0, 0, 0];
        for (let i = 0; i < seedBytes.length; ++i) {
          bytes[i] = seedBytes[i];
        }
        this._x = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
        this._ready = true;
        return;
      }

      if (seedBytes.length >= 8) {
        this._y = OpCodes.Pack32BE(
          seedBytes[4] || 0,
          seedBytes[5] || 0,
          seedBytes[6] || 0,
          seedBytes[7] || 0
        );
        offset = 8;
      }

      if (seedBytes.length >= 12) {
        this._z = OpCodes.Pack32BE(
          seedBytes[8] || 0,
          seedBytes[9] || 0,
          seedBytes[10] || 0,
          seedBytes[11] || 0
        );
        offset = 12;
      }

      if (seedBytes.length >= 16) {
        this._w = OpCodes.Pack32BE(
          seedBytes[12] || 0,
          seedBytes[13] || 0,
          seedBytes[14] || 0,
          seedBytes[15] || 0
        );
      }

      // Ensure state is not all zeros (would cause all zeros output)
      if (this._x === 0 && this._y === 0 && this._z === 0 && this._w === 0) {
        this._x = 123456789;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using xorshift128 algorithm
     *
     * Algorithm from Marsaglia (2003):
     * t = x ^ (x << 11)
     * x = y; y = z; z = w
     * w = w ^ (w >> 19) ^ (t ^ (t >> 8))
     * return w
     */
    _next32() {
      if (!this._ready) {
        throw new Error('XorShift128 not initialized: set seed first');
      }

      // Step 1: t = x ^ (x << 11)
      let t = this._x ^ ((this._x << 11) >>> 0);
      t = t >>> 0; // Ensure unsigned 32-bit

      // Step 2: Rotate state (x=y, y=z, z=w)
      this._x = this._y;
      this._y = this._z;
      this._z = this._w;

      // Step 3: w = w ^ (w >> 19) ^ (t ^ (t >> 8))
      this._w = (this._w ^ (this._w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;

      return this._w;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('XorShift128 not initialized: set seed first');
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
    Feed(data) {
      // For PRNG, Feed can be used to skip outputs
      // Not standard for basic xorshift, but useful for testing
    }

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
  const algorithmInstance = new XorShift128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XorShift128Algorithm, XorShift128Instance };
}));
