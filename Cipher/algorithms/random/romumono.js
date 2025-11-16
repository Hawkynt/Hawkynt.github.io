/*
 * RomuMono Pseudo-Random Number Generator
 * Algorithm by Mark Overton (2020)
 * Part of the Rotate-Multiply (Romu) PRNG family
 *
 * RomuMono is the fastest member of the Romu family, using only a single
 * 64-bit state variable. It's optimized for extreme speed while maintaining
 * acceptable statistical quality. Passes PractRand and BigCrush tests.
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
   * Used to initialize RomuMono state from a single 64-bit seed
   * Based on standard SplitMix64 implementation
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

  class RomuMonoAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RomuMono";
      this.description = "RomuMono is the fastest member of the Romu (Rotate-Multiply) family of pseudo-random number generators. It uses only a single 64-bit state variable with rotation and multiplication operations to achieve extreme speed while maintaining acceptable statistical quality.";
      this.inventor = "Mark Overton";
      this.year = 2020;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed only

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: The Romu Random Number Generators (arXiv:2002.11331)",
          "https://arxiv.org/abs/2002.11331"
        ),
        new LinkItem(
          "Romu Generator Overview",
          "http://www.romu-random.org/"
        ),
        new LinkItem(
          "PractRand Test Results",
          "http://pracrand.sourceforge.net/"
        )
      ];

      this.references = [
        new LinkItem(
          "PCG: Romu - A Good PRNG",
          "https://www.pcg-random.org/posts/romu-a-good-prng.html"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors generated from RomuMono algorithm implementation
      // Algorithm: result = x; x = x * 15241094284759029579; x = rotl(x, 27); return result;
      // These vectors are calculated using the reference algorithm with known seeds
      this.tests = [
        {
          text: "Seed x=1: First four 64-bit outputs from RomuMono",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"), // x=1 (little-endian)
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // Output sequence calculated from RomuMono algorithm:
          // Output 1: 0x0000000000000001
          // Output 2: 0x027A62BA5E9C19F4
          // Output 3: 0xD627EC33E52104B8
          // Output 4: 0xA43F374F409F1FC2
          expected: OpCodes.Hex8ToBytes("0100000000000000F4199C5EBA627A02B80421E533EC27D6C21F9F404F373FA4")
        },
        {
          text: "Seed x=0: First four 64-bit outputs from RomuMono",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"), // x=0 (little-endian)
          outputSize: 32,
          // Output sequence: all zeros because state remains zero
          // Output 1: result=0, x=0*MULT=0, x=rotl(0,27)=0
          // All subsequent outputs are also zero
          expected: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000")
        },
        {
          text: "Seed x=0x0123456789ABCDEF: First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFCDAB8967452301"), // 0x0123456789ABCDEF (little-endian)
          outputSize: 32,
          // Output sequence calculated from RomuMono algorithm:
          // Output 1: 0x0123456789ABCDEF
          // Output 2: 0x64E22C702D81C211
          // Output 3: 0xEA501D0FDDD24EC1
          // Output 4: 0x2B2D654C5CEBFE3A
          expected: OpCodes.Hex8ToBytes("EFCDAB896745230111C2812D702CE264C14ED2DD0F1D50EA3AFEEB5C4C652D2B")
        },
        {
          text: "Seed x=0xFFFFFFFFFFFFFFFF: First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"), // Maximum value (little-endian)
          outputSize: 32,
          // Output sequence calculated from RomuMono algorithm:
          // Output 1: 0xFFFFFFFFFFFFFFFF
          // Output 2: 0xFD859D45A963E60B
          // Output 3: 0xFA1DB111CC56B468
          // Output 4: 0x8FDCB193C50BD5E0
          expected: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF0BE663A9459D85FD68B456CC11B11DFAE0D50BC593B1DC8F")
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
      return new RomuMonoInstance(this);
    }
  }

  /**
 * RomuMono cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RomuMonoInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // RomuMono algorithm constant
      this.ROMU_MULTIPLIER = 0xD3833E804F4C574Bn; // 15241094284759029579

      // RomuMono state: single 64-bit value (using BigInt)
      this._xState = 0n;
      this._ready = false;
    }

    /**
     * Set seed value
     * Accepts 8 bytes for a single 64-bit seed value
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize state from seed bytes (little-endian)
      this._xState = 0n;
      for (let i = 0; i < Math.min(8, seedBytes.length); ++i) {
        this._xState = OpCodes.OrN(this._xState, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the RomuMono algorithm:
     *   result = xState;
     *   xState = xState * 15241094284759029579;
     *   xState = rotl(xState, 27);
     *   return result;
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('RomuMono not initialized: set seed first');
      }

      // Save current state as result
      const result = this._xState;

      // Update state: x = x * MULTIPLIER
      this._xState = OpCodes.ToQWord(this._xState * this.ROMU_MULTIPLIER);

      // Rotate state: x = rotl(x, 27)
      this._xState = OpCodes.RotL64n(this._xState, 27);

      // Return saved state as output
      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('RomuMono not initialized: set seed first');
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
      // Not implemented in basic RomuMono - would require mixing
      // For now, Feed is a no-op (RomuMono is deterministic)
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
     * Get current internal state (for testing/debugging)
     * @returns {BigInt} Current state value
     */
    getState() {
      return this._xState;
    }
  }

  // Register algorithm
  const algorithmInstance = new RomuMonoAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { RomuMonoAlgorithm, RomuMonoInstance };
}));
