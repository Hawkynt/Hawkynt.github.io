/*
 * RomuQuad Pseudo-Random Number Generator
 * Algorithm by Mark Overton (2020)
 * Part of the Rotate-Multiply (Romu) PRNG family
 *
 * RomuQuad is the highest-quality member of the Romu family, using
 * four 64-bit state variables (w, x, y, z) to provide exceptional
 * statistical quality while maintaining very good speed. It passes
 * all BigCrush tests with maximum quality and is recommended for
 * demanding applications requiring high-quality randomness.
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
   * Used to initialize RomuQuad state from a single 64-bit seed
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

  class RomuQuadAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RomuQuad";
      this.description = "RomuQuad is the highest-quality member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It uses four 64-bit state variables with rotation and multiplication operations to achieve exceptional statistical quality while maintaining very good speed. RomuQuad passes all BigCrush tests with maximum quality and is recommended for demanding applications.";
      this.inventor = "Mark Overton";
      this.year = 2020;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 32, 1)]; // 64-bit seed or 4x64-bit for full state

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

      // Test vectors generated from reference implementation
      // Using RomuQuad algorithm with known seeds
      // Algorithm: result=w; temp=x*MULTIPLIER; w=temp-z; w=rotl(w,52); x=y+w; y=z+temp; z=temp+result; z=rotl(z,19); return result;
      this.tests = [
        {
          text: "Seed (1,1,1,1): First four 64-bit outputs from RomuQuad",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000010000000000000001000000000000000100000000000000"), // w=1, x=1, y=1, z=1 (little-endian)
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // Expected outputs calculated from RomuQuad algorithm
          // Output 1: result=w=1 (0x0000000000000001)
          // Output 2: result=0x74AD3833E804F4C5 (after first state transition)
          // Outputs 3,4: subsequent values from continued state transitions
          expected: OpCodes.Hex8ToBytes("0100000000000000C5F404E83338AD744630DB0AD65E973E06FC27105E6EE70D")
        },
        {
          text: "Seed (0,0,0,1): First four 64-bit outputs from RomuQuad",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000100000000000000"), // w=0, x=0, y=0, z=1
          outputSize: 32,
          // Output 1: result=0, then w=temp-z where temp=0, so w=0-1=-1 (0xFFFFFFFFFFFFFFFF after rotation)
          // Outputs calculated from RomuQuad state transitions
          expected: OpCodes.Hex8ToBytes("0000000000000000FFFFFFFFFFFFFFFF3A0BFB17CCC7528BFFC329DD5DD93536")
        },
        {
          text: "Seed via SplitMix64(0): First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"), // Single 64-bit seed=0, initialized via SplitMix64
          outputSize: 32,
          // State initialized via SplitMix64(0): w=0xe220a8397b1dcdaf, x=0x6e789e6aa1b965f4, y=0x06c45d188009454f, z=0xf88bb8a8724c81ec
          // Outputs calculated from RomuQuad state transitions
          expected: OpCodes.Hex8ToBytes("AFCD1D7B39A820E2A411B89013D70589B48F0A530C9E51D416317AA5131F4CDA")
        },
        {
          text: "Seed via SplitMix64(1): First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"), // Single 64-bit seed=1
          outputSize: 32,
          // State initialized via SplitMix64(1): w=0x910a2dec89025cc1, x=0xbeeb8da1658eec67, y=0xf893a2eefb32555e, z=0x71c18690ee42c90b
          // Outputs calculated from RomuQuad state transitions
          expected: OpCodes.Hex8ToBytes("C15C0289EC2D0A9177C8D58103712AA2ADA40F24AC878918CAF84E08292C94A3")
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
      return new RomuQuadInstance(this);
    }
  }

  /**
 * RomuQuad cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RomuQuadInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // RomuQuad algorithm constant
      this.ROMU_MULTIPLIER = 0xD3833E804F4C574Bn; // 15241094284759029579

      // RomuQuad state: four 64-bit values (using BigInt)
      this._wState = 0n;
      this._xState = 0n;
      this._yState = 0n;
      this._zState = 0n;
      this._ready = false;
    }

    /**
     * Set seed value
     * Supports either:
     * - 8 bytes: single 64-bit seed (uses SplitMix64 to initialize w,x,y,z)
     * - 32 bytes: direct initialization of w,x,y,z states (8 bytes each)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (seedBytes.length >= 32) {
        // Direct state initialization: 32 bytes = 4x64-bit values (little-endian)
        this._wState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._wState = OpCodes.OrN(this._wState, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
        }

        this._xState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._xState = OpCodes.OrN(this._xState, OpCodes.ShiftLn(BigInt(seedBytes[8 + i]), i * 8));
        }

        this._yState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._yState = OpCodes.OrN(this._yState, OpCodes.ShiftLn(BigInt(seedBytes[16 + i]), i * 8));
        }

        this._zState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._zState = OpCodes.OrN(this._zState, OpCodes.ShiftLn(BigInt(seedBytes[24 + i]), i * 8));
        }
      } else {
        // Single 64-bit seed: use SplitMix64 to initialize state
        let seedValue = 0n;
        for (let i = 0; i < Math.min(8, seedBytes.length); ++i) {
          seedValue = OpCodes.OrN(seedValue, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
        }

        // Initialize state using SplitMix64
        let state = seedValue;

        let result = SplitMix64(state);
        this._wState = result.value;
        state = result.nextState;

        result = SplitMix64(state);
        this._xState = result.value;
        state = result.nextState;

        result = SplitMix64(state);
        this._yState = result.value;
        state = result.nextState;

        result = SplitMix64(state);
        this._zState = result.value;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the RomuQuad algorithm:
     *   uint64_t result = wState;
     *   uint64_t temp = xState * 15241094284759029579u;
     *   wState = temp - zState;
     *   wState = rotl(wState, 52);
     *   xState = yState + wState;
     *   yState = zState + temp;
     *   zState = temp + result;
     *   zState = rotl(zState, 19);
     *   return result;
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('RomuQuad not initialized: set seed first');
      }

      // Save output value
      const result = this._wState;

      // Calculate temp = x * MULTIPLIER
      const temp = OpCodes.ToQWord(this._xState * this.ROMU_MULTIPLIER);

      // Update wState: w = temp - z; w = rotl(w, 52)
      this._wState = OpCodes.ToQWord(temp - this._zState);
      this._wState = OpCodes.RotL64n(this._wState, 52);

      // Update xState: x = y + w
      this._xState = OpCodes.ToQWord(this._yState + this._wState);

      // Update yState: y = z + temp
      this._yState = OpCodes.ToQWord(this._zState + temp);

      // Update zState: z = temp + result; z = rotl(z, 19)
      this._zState = OpCodes.ToQWord(temp + result);
      this._zState = OpCodes.RotL64n(this._zState, 19);

      // Return saved output
      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('RomuQuad not initialized: set seed first');
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
      // Not implemented in basic RomuQuad - would require mixing
      // For now, Feed is a no-op (RomuQuad is deterministic)
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
     * @returns {Object} Current state {w, x, y, z}
     */
    getState() {
      return {
        w: this._wState,
        x: this._xState,
        y: this._yState,
        z: this._zState
      };
    }
  }

  // Register algorithm
  const algorithmInstance = new RomuQuadAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { RomuQuadAlgorithm, RomuQuadInstance };
}));
