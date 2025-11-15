/*
 * RomuTrio (Romu) Pseudo-Random Number Generator
 * Algorithm by Mark Overton (2020)
 * Part of the Rotate-Multiply (Romu) PRNG family
 *
 * RomuTrio is an extremely fast, non-cryptographic PRNG that uses
 * rotation and multiplication operations. It passes PractRand and
 * TestU01 statistical tests with excellent performance characteristics.
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
   * Used to initialize RomuTrio state from a single 64-bit seed
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

  class RomuTrioAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RomuTrio";
      this.description = "RomuTrio is a member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It uses three 64-bit state variables with rotation and multiplication operations to achieve exceptional speed while passing rigorous statistical tests including PractRand and TestU01.";
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
      this.SupportedSeedSizes = [new KeySize(8, 24, 1)]; // 64-bit seed or 3x64-bit for full state

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
      // Using RomuTrio algorithm with known seeds
      // Algorithm: xp=x; x=15241094284759029579*z; y=y-xp; y=rotl(y,12); z=z-y; z=rotl(z,44); return xp;
      this.tests = [
        {
          text: "Seed (1,1,1): First four 64-bit outputs from RomuTrio",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("010000000000000001000000000000000100000000000000"), // x=1, y=1, z=1 (little-endian)
          outputSize: 32, // 4 x 64-bit values = 32 bytes
          // Expected outputs calculated from RomuTrio algorithm
          // Output 1: xp=1 (0x0000000000000001)
          // Output 2: xp=0xD3833E804F4C574B (ROMU_MULTIPLIER * 1)
          // Outputs 3,4: subsequent values from continued state transitions
          expected: OpCodes.Hex8ToBytes("01000000000000004B574C4F803E83D300000000000000000000000000000000")
        },
        {
          text: "Seed (0,0,1): First four 64-bit outputs from RomuTrio",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000000000000000000000000100000000000000"), // x=0, y=0, z=1
          outputSize: 32,
          // Output 1: xp=0, then x=ROMU_MULTIPLIER*1
          // Outputs calculated from RomuTrio state transitions
          expected: OpCodes.Hex8ToBytes("00000000000000004B574C4F803E83D30000000000B074C50000004B574C4F80")
        },
        {
          text: "Seed via SplitMix64(0): First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"), // Single 64-bit seed=0, initialized via SplitMix64
          outputSize: 32,
          // State initialized via SplitMix64(0): x=0xe220a8397b1dcdaf, y=0x6e789e6aa1b965f4, z=0x06c45d188009454f
          // Outputs calculated from RomuTrio state transitions
          expected: OpCodes.Hex8ToBytes("AFCD1D7B39A820E22527B99D5442CCC1CC7DE71AF3E3464122857317D8D4882F")
        },
        {
          text: "Seed via SplitMix64(1): First four 64-bit outputs",
          uri: "https://arxiv.org/abs/2002.11331",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"), // Single 64-bit seed=1
          outputSize: 32,
          // State initialized via SplitMix64(1): x=0x910a2dec89025cc1, y=0xbeeb8da1658eec67, z=0xf893a2eefb32555e
          // Outputs calculated from RomuTrio state transitions
          expected: OpCodes.Hex8ToBytes("C15C0289EC2D0A918AF4A90CAB8108115E4371067B6D365AF7421D4CE665D833")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new RomuTrioInstance(this);
    }
  }

  class RomuTrioInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // RomuTrio algorithm constant
      this.ROMU_MULTIPLIER = 0xD3833E804F4C574Bn; // 15241094284759029579

      // RomuTrio state: three 64-bit values (using BigInt)
      this._xState = 0n;
      this._yState = 0n;
      this._zState = 0n;
      this._ready = false;
    }

    /**
     * Set seed value
     * Supports either:
     * - 8 bytes: single 64-bit seed (uses SplitMix64 to initialize x,y,z)
     * - 24 bytes: direct initialization of x,y,z states (8 bytes each)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (seedBytes.length >= 24) {
        // Direct state initialization: 24 bytes = 3x64-bit values (little-endian)
        this._xState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._xState = OpCodes.OrN(this._xState, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
        }

        this._yState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._yState = OpCodes.OrN(this._yState, OpCodes.ShiftLn(BigInt(seedBytes[8 + i]), i * 8));
        }

        this._zState = 0n;
        for (let i = 0; i < 8; ++i) {
          this._zState = OpCodes.OrN(this._zState, OpCodes.ShiftLn(BigInt(seedBytes[16 + i]), i * 8));
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
     * Implements the RomuTrio algorithm:
     *   uint64_t xp = xState, yp = yState, zp = zState;
     *   xState = 15241094284759029579u * zp;
     *   yState = yp - xp; yState = rotl(yState, 12);
     *   zState = zp - yp; zState = rotl(zState, 44);
     *   return xp;
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('RomuTrio not initialized: set seed first');
      }

      // Save previous state values
      const xp = this._xState;
      const yp = this._yState;
      const zp = this._zState;

      // Update xState: x = MULTIPLIER * z
      this._xState = OpCodes.ToQWord(this.ROMU_MULTIPLIER * zp);

      // Update yState: y = y - xp; y = rotl(y, 12)
      this._yState = OpCodes.ToQWord(yp - xp);
      this._yState = OpCodes.RotL64n(this._yState, 12);

      // Update zState: z = z - yp; z = rotl(z, 44)
      this._zState = OpCodes.ToQWord(zp - yp);
      this._zState = OpCodes.RotL64n(this._zState, 44);

      // Return previous xState as output
      return xp;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('RomuTrio not initialized: set seed first');
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
    Feed(data) {
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic RomuTrio - would require mixing
      // For now, Feed is a no-op (RomuTrio is deterministic)
    }

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
     * @returns {Object} Current state {x, y, z}
     */
    getState() {
      return {
        x: this._xState,
        y: this._yState,
        z: this._zState
      };
    }
  }

  // Register algorithm
  const algorithmInstance = new RomuTrioAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { RomuTrioAlgorithm, RomuTrioInstance };
}));
