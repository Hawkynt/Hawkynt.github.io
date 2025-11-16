/*
 * RomuDuo Pseudo-Random Number Generator
 * Algorithm by Mark Overton (2020)
 * Part of the Rotate-Multiply (Romu) PRNG family
 *
 * RomuDuo is a two-state Romu variant designed for general-purpose use,
 * balancing speed and statistical quality. It uses rotation and multiplication
 * operations on two 64-bit state variables. Passes PractRand and BigCrush
 * statistical tests while being more compact than RomuTrio.
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
   * Used to initialize RomuDuo state from a single 64-bit seed
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

  class RomuDuoAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RomuDuo";
      this.description = "RomuDuo is a two-state member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It balances speed and quality using rotation and multiplication operations on two 64-bit state variables. Recommended for general-purpose use, passing PractRand and BigCrush statistical tests.";
      this.inventor = "Mark Overton";
      this.year = 2020;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 16, 1)]; // 64-bit seed or 2x64-bit for full state

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
          "BigCrush Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors verified against reference RomuDuo implementation
      // Using RomuDuo algorithm with known seeds
      // Algorithm: result=x; x=MULTIPLIER*y; y=rotl(y,36)+result; y=rotl(y,15); return result;
      this.tests = [
        {
          text: "Seed (1,1): First four 64-bit outputs from RomuDuo",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("01000000000000000100000000000000"), // x=1, y=1 (little-endian)
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // Verified outputs: 1, 0xD3833E804F4C574B, 0x599827A62BA58000, 0x5589AA295D896FB7
          expected: OpCodes.Hex8ToBytes("01000000000000004b574c4f803e83d30080a52ba6279859b76f895d29aa8955")
        },
        {
          text: "Seed (0,1): First four 64-bit outputs from RomuDuo",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000000100000000000000"), // x=0, y=1
          outputSize: 32,
          // Verified outputs: 0, 0xD3833E804F4C574B, 0xBA58000000000000, 0x077CB0282058128B
          expected: OpCodes.Hex8ToBytes("00000000000000004b574c4f803e83d300000000000058ba8b12582028b07c07")
        },
        {
          text: "Seed via SplitMix64(0): First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"), // Single 64-bit seed=0, initialized via SplitMix64
          outputSize: 32,
          // State initialized via SplitMix64(0): x=0xe220a8397b1dcdaf, y=0x6e789e6aa1b965f4
          // Verified outputs: 0xE220A8397B1DCDAF, 0x55FCF1B3F366CA7C, 0x5694123773CF1729, 0x29F4BE04C7CC9BE2
          expected: OpCodes.Hex8ToBytes("afcd1d7b39a820e27cca66f3b3f1fc552917cf7337129456e29bccc704bef429")
        },
        {
          text: "Seed via SplitMix64(1): First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"), // Single 64-bit seed=1
          outputSize: 32,
          // State initialized via SplitMix64(1): x=0x910a2dec89025cc1, y=0xbeeb8da1658eec67
          // Verified outputs: 0x910A2DEC89025CC1, 0x18D1BEAE4ACA432D, 0xA2A9D464B7B269D4, 0x2FA4C84356245F98
          expected: OpCodes.Hex8ToBytes("c15c0289ec2d0a912d43ca4aaebed118d469b2b764d4a9a2985f245643c8a42f")
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
      return new RomuDuoInstance(this);
    }
  }

  /**
 * RomuDuo cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RomuDuoInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // RomuDuo algorithm constant (same as RomuTrio)
      this.ROMU_MULTIPLIER = 0xD3833E804F4C574Bn; // 15241094284759029579

      // RomuDuo state: two 64-bit values (using BigInt)
      this._xState = 0n;
      this._yState = 0n;
      this._ready = false;
    }

    /**
     * Set seed value
     * Supports either:
     * - 8 bytes: single 64-bit seed (uses SplitMix64 to initialize x,y)
     * - 16 bytes: direct initialization of x,y states (8 bytes each)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (seedBytes.length >= 16) {
        // Direct state initialization: 16 bytes = 2x64-bit values (little-endian)
        this._xState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._xState = OpCodes.OrN(this._xState, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
        }

        this._yState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._yState = OpCodes.OrN(this._yState, OpCodes.ShiftLn(BigInt(seedBytes[8 + i]), i * 8));
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
        this._xState = result.value;
        state = result.nextState;

        result = SplitMix64(state);
        this._yState = result.value;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the RomuDuo algorithm:
     *   uint64_t result = xState;
     *   xState = 15241094284759029579u * yState;
     *   yState = rotl(yState, 36) + result;
     *   yState = rotl(yState, 15);
     *   return result;
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('RomuDuo not initialized: set seed first');
      }

      // Save current xState as result
      const result = this._xState;

      // Update xState: x = MULTIPLIER * y
      this._xState = OpCodes.ToQWord(this.ROMU_MULTIPLIER * this._yState);

      // Update yState: y = rotl(y, 36) + result
      this._yState = OpCodes.RotL64n(this._yState, 36);
      this._yState = OpCodes.ToQWord(this._yState + result);

      // Update yState: y = rotl(y, 15)
      this._yState = OpCodes.RotL64n(this._yState, 15);

      // Return saved xState as output
      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('RomuDuo not initialized: set seed first');
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
      // Not implemented in basic RomuDuo - would require mixing
      // For now, Feed is a no-op (RomuDuo is deterministic)
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
     * @returns {Object} Current state {x, y}
     */
    getState() {
      return {
        x: this._xState,
        y: this._yState
      };
    }
  }

  // Register algorithm
  const algorithmInstance = new RomuDuoAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { RomuDuoAlgorithm, RomuDuoInstance };
}));
