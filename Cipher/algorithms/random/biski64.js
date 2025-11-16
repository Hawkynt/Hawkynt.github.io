/*
 * biski64 Pseudo-Random Number Generator
 * Original algorithm by Daniel Cota (2025)
 * Reference implementation: https://github.com/danielcota/biski64
 *
 * biski64 is a very fast and robust 64-bit PRNG with 192-bit state,
 * minimum period of 2^64, passing BigCrush and PractRand statistical tests.
 * Combines Weyl sequence with mixing functions for high-quality output.
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
   * Used to initialize biski64 state from a single 64-bit seed
   * Based on reference implementation at https://github.com/danielcota/biski64
   */
  function SplitMix64Next(seedState) {
    const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
    const MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
    const MIX_CONST_2 = 0x94D049BB133111EBn;

    seedState = OpCodes.ToQWord(seedState + GOLDEN_GAMMA);

    let z = seedState;
    z = OpCodes.ToQWord(OpCodes.XorN(z, OpCodes.ShiftRn(z, 30)) * MIX_CONST_1);
    z = OpCodes.ToQWord(OpCodes.XorN(z, OpCodes.ShiftRn(z, 27)) * MIX_CONST_2);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 31));

    return { value: z, nextState: seedState };
  }

  class Biski64Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "biski64";
      this.description = "biski64 is a very fast, high-quality 64-bit PRNG with 192-bit state combining a Weyl sequence with rotation-based mixing functions. It guarantees minimum period of 2^64 through proven injectivity and passes BigCrush and PractRand statistical tests. Designed for both single-threaded and parallel applications with exceptional performance.";
      this.inventor = "Daniel Cota";
      this.year = 2025;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official GitHub Repository",
          "https://github.com/danielcota/biski64"
        ),
        new LinkItem(
          "C Reference Implementation",
          "https://github.com/danielcota/biski64/tree/main/c"
        ),
        new LinkItem(
          "Rust Implementation (crates.io)",
          "https://crates.io/crates/biski64"
        )
      ];

      this.references = [
        new LinkItem(
          "PractRand Statistical Testing Suite",
          "http://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "TestU01 BigCrush Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Design Parameters and Analysis",
          "https://github.com/danielcota/biski64#design-parameters"
        )
      ];

      // Test vectors generated from official C reference implementation
      // Source: https://github.com/danielcota/biski64/tree/main/c
      this.tests = [
        {
          text: "Seed=0: First five 64-bit outputs (verified against C reference)",
          uri: "https://github.com/danielcota/biski64",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 40, // 5 x 64-bit values = 40 bytes
          // After warmup: fast_loop=0xa05df6b219a2dedf, mix=0x1acd9ee061f02269, loop_mix=0x991157f5c5fc66a3
          // Output sequence (little-endian bytes per 64-bit value):
          // 1. 0xb3def6d627ec890c  2. 0x55d76ddbac140d48  3. 0xfb36803e21f856a9
          // 4. 0x72f94f3c8a821ab3  5. 0x436b95c3a804377f
          expected: OpCodes.Hex8ToBytes("0c89ec27d6f6deb3480d14acdb6dd755a956f8213e8036fb" +
                                        "b31a828a3c4ff9727f3704a8c3956b43")
        },
        {
          text: "Seed=1: First five 64-bit outputs",
          uri: "https://github.com/danielcota/biski64",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"),
          outputSize: 40,
          // Verified against C reference implementation
          expected: OpCodes.Hex8ToBytes("6b67c277227bdf8de2c9215a1a382289ba3902db374aa0aa" +
                                        "80ada2e1a2a0769d62efd36d4878e6af")
        },
        {
          text: "Seed=12345: First five 64-bit outputs",
          uri: "https://github.com/danielcota/biski64",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930"), // 12345 = 0x3039 in little-endian
          outputSize: 40,
          // Verified against C reference implementation
          expected: OpCodes.Hex8ToBytes("1abb804492c09d2ed947f0f2f2b3d28fbdb884622cf8bb17" +
                                        "0f4079403772a29da154733485f249df")
        },
        {
          text: "Seed=0xDEADBEEF: First five 64-bit outputs",
          uri: "https://github.com/danielcota/biski64",
          input: null,
          seed: OpCodes.Hex8ToBytes("efbeadde"), // 0xDEADBEEF in little-endian
          outputSize: 40,
          // Verified against C reference implementation
          expected: OpCodes.Hex8ToBytes("71f017b36988261245aec3c31eacf8c2005689f091e6f3d9" +
                                        "f86cf5dd0d3e23b24497b4928abc68be")
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
      return new Biski64Instance(this);
    }
  }

  /**
 * Biski64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Biski64Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // biski64 constants
      this.WEYL_CONSTANT = 0x9999999999999999n;  // Additive constant for Weyl sequence

      // biski64 state: three 64-bit values (using BigInt)
      this._fast_loop = 0n;  // Weyl sequence component
      this._mix = 0n;        // Mixed state component
      this._loop_mix = 0n;   // Loop mixed component
      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     * Uses SplitMix64 to initialize the three state values, then performs warmup
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

      // Initialize state using SplitMix64 (matching C reference implementation)
      let state = seedValue;

      let result = SplitMix64Next(state);
      this._mix = result.value;
      state = result.nextState;

      result = SplitMix64Next(state);
      this._loop_mix = result.value;
      state = result.nextState;

      result = SplitMix64Next(state);
      this._fast_loop = result.value;

      // Mark as ready before warmup so _next64() doesn't throw
      this._ready = true;

      // Warmup: discard first 16 values to eliminate statistical weaknesses
      for (let i = 0; i < 16; ++i) {
        this._next64();
      }
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the biski64 algorithm
     *
     * Algorithm from https://github.com/danielcota/biski64:
     * 1. output = mix + loop_mix
     * 2. old_loop_mix = loop_mix
     * 3. loop_mix = fast_loop ^ mix
     * 4. mix = rotl(mix, 16) + rotl(old_loop_mix, 40)
     * 5. fast_loop += 0x9999999999999999
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('biski64 not initialized: set seed first');
      }

      // Step 1: Compute output before updating state
      const output = OpCodes.ToQWord(this._mix + this._loop_mix);

      // Step 2: Save old loop_mix for mixing
      const old_loop_mix = this._loop_mix;

      // Step 3: Update loop_mix
      this._loop_mix = OpCodes.XorN(this._fast_loop, this._mix);

      // Step 4: Update mix with rotations
      const mix_rot16 = OpCodes.RotL64n(this._mix, 16);
      const loop_mix_rot40 = OpCodes.RotL64n(old_loop_mix, 40);
      this._mix = OpCodes.ToQWord(mix_rot16 + loop_mix_rot40);

      // Step 5: Update fast_loop (Weyl sequence)
      this._fast_loop = OpCodes.ToQWord(this._fast_loop + this.WEYL_CONSTANT);

      return output;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('biski64 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesGenerated = 0;

      while (bytesGenerated < length) {
        // Generate next 64-bit value
        const value64 = this._next64();

        // Extract bytes in little-endian order (matching test vectors)
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
      // Not implemented in basic biski64 - would require mixing
      // For now, Feed is a no-op (biski64 is deterministic)
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
     * Stream initialization for parallel execution
     * Spaces out fast_loop values across multiple streams
     * Based on reference implementation biski64_stream()
     *
     * @param {number} streamIndex - Index of this stream (0-based)
     * @param {number} totalNumStreams - Total number of parallel streams
     */
    initializeStream(streamIndex, totalNumStreams) {
      if (totalNumStreams === 1) {
        // Single stream: use normal initialization (already done in seed setter)
        return;
      }

      // Calculate cycles per stream and offset fast_loop
      // This ensures non-overlapping sequences across parallel streams
      const cyclesPerStream = 0xFFFFFFFFFFFFFFFFn / BigInt(totalNumStreams);
      this._fast_loop = OpCodes.ToQWord(
        BigInt(streamIndex) * cyclesPerStream * this.WEYL_CONSTANT
      );

      // Re-warmup after adjusting fast_loop
      for (let i = 0; i < 16; ++i) {
        this._next64();
      }
    }
  }

  // Register algorithm
  const algorithmInstance = new Biski64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Biski64Algorithm, Biski64Instance };
}));
