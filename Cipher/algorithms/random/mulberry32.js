/*
 * Mulberry32 Pseudo-Random Number Generator
 * Designed by Tommy Ettinger (2017)
 *
 * Mulberry32 is an extremely simple and fast 32-bit PRNG with single 32-bit state.
 * It uses a Weyl sequence (state += constant) combined with MurmurHash3-style mixing
 * to produce high-quality pseudo-random output despite its minimal state size.
 *
 * Properties:
 * - State: Single 32-bit value
 * - Period: ~2^32 (4 billion values)
 * - Speed: Extremely fast (one of the fastest JS PRNGs)
 * - Quality: Passes gjrand statistical tests with good P-values
 * - Limitation: Not equidistributed (cannot produce ~1/3 of possible 32-bit values)
 *
 * IMPORTANT NOTES:
 * 1. The author later noted that Mulberry32 is not equidistributed
 * 2. For critical applications, consider more advanced PRNGs (xoshiro, PCG)
 * 3. NOT cryptographically secure - use CSPRNG for security-sensitive applications
 *
 * Algorithm:
 *   state = state + 0x6D2B79F5 | 0;
 *   z = state;
 *   z = Math.imul(z ^ z >>> 15, z | 1);
 *   z ^= z + Math.imul(z ^ z >>> 7, z | 61);
 *   return (z ^ z >>> 14) >>> 0;
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

  class Mulberry32Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Mulberry32";
      this.description = "Mulberry32 is an extremely simple and fast 32-bit PRNG with single 32-bit state, designed by Tommy Ettinger. It uses a Weyl sequence combined with MurmurHash3-style mixing to produce high-quality output despite minimal state. Very fast but not equidistributed.";
      this.inventor = "Tommy Ettinger";
      this.year = 2017;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (8-32 bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Discussion: Mulberry32 PRNG (Tommy Ettinger, 2017)",
          "https://gist.github.com/tommyettinger/46a874533244883189143505d203312c"
        ),
        new LinkItem(
          "JavaScript PRNGs Collection (bryc)",
          "https://github.com/bryc/code/blob/master/jshash/PRNGs.md"
        ),
        new LinkItem(
          "Mulberry32 Implementation (cprosche)",
          "https://github.com/cprosche/mulberry32"
        ),
        new LinkItem(
          "StackOverflow: Looking for 32-bit PRNG",
          "https://stackoverflow.com/questions/17035441/looking-for-decent-quality-prng-with-only-32-bits-of-state"
        )
      ];

      this.references = [
        new LinkItem(
          "Author's Note: Not Equidistributed",
          "https://github.com/bryc/code/discussions/21"
        ),
        new LinkItem(
          "gjrand Statistical Testing",
          "http://gjrand.sourceforge.net/"
        )
      ];

      // Test vectors generated from reference implementation
      // Algorithm: state += 0x6D2B79F5; z = state; z = Math.imul(z ^ z >>> 15, z | 1); z ^= z + Math.imul(z ^ z >>> 7, z | 61); return (z ^ z >>> 14) >>> 0;
      // Reference: Tommy Ettinger's original Gist and bryc's implementation
      // Verified using JavaScript reference implementation
      this.tests = [
        {
          text: "Seed 0: First 5 outputs (20 bytes) - verified against reference implementation",
          uri: "https://gist.github.com/tommyettinger/46a874533244883189143505d203312c",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "4434B462" +  // Output 1: 1144235106
            "00159C37" +  // Output 2: 1416247
            "39285B08" +  // Output 3: 959027976
            "256D8104" +  // Output 4: 628834564
            "77A2CBD4"    // Output 5: 2007396308
          )
        },
        {
          text: "Seed 1: First 5 outputs (20 bytes) - single-bit seed difference",
          uri: "https://github.com/bryc/code/blob/master/jshash/PRNGs.md",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "A087EAF3" +  // Output 1: 2692892403
            "00B349C9" +  // Output 2: 11749833
            "8706C4EB" +  // Output 3: 2266596587
            "FB2627FD" +  // Output 4: 4213934077
            "F7E79D2B"    // Output 5: 4159201579
          )
        },
        {
          text: "Seed 42: First 8 outputs (32 bytes) - commonly used test seed",
          uri: "https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000002A"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "99E1EF7C" +  // Output 1: 2582171516
            "72C32B8A" +  // Output 2: 1925634954
            "DA3B32C0" +  // Output 3: 3660710592
            "AB73B0AD" +  // Output 4: 2876158125
            "2CC09A8A" +  // Output 5: 750868106
            "86CEC4D3" +  // Output 6: 2261574867
            "45F24514" +  // Output 7: 1173505300
            "9FEF4401"    // Output 8: 2683282433
          )
        },
        {
          text: "Seed 12345: First 5 outputs (20 bytes) - larger seed value",
          uri: "https://github.com/cprosche/mulberry32",
          input: null,
          seed: OpCodes.Hex8ToBytes("00003039"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "FACF78C5" +  // Output 1: 4207614149
            "4E875100" +  // Output 2: 1317269760
            "7BF4E2F2" +  // Output 3: 2079843058
            "D1642650" +  // Output 4: 3512755792
            "8269E5CA"    // Output 5: 2188084682
          )
        },
        {
          text: "Seed 0xFFFFFFFF (max 32-bit): First 5 outputs (20 bytes) - edge case",
          uri: "https://gist.github.com/tommyettinger/46a874533244883189143505d203312c",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFF"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "E57BF3D3" +  // Output 1: 3850322899
            "3081A5A4" +  // Output 2: 813720996
            "B7350390" +  // Output 3: 3074163600
            "F1ADE904" +  // Output 4: 4054411524
            "D8616A2F"    // Output 5: 3630443055
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
      return new Mulberry32Instance(this);
    }
  }

  /**
 * Mulberry32 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Mulberry32Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Mulberry32 uses a single 32-bit state variable
      this._state = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-4 bytes)
     * Seed format: 1-4 bytes packed into a 32-bit state value (big-endian)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Pack seed bytes into 32-bit state (big-endian)
      if (seedBytes.length >= 4) {
        this._state = OpCodes.Pack32BE(
          seedBytes[0],
          seedBytes[1],
          seedBytes[2],
          seedBytes[3]
        );
      } else if (seedBytes.length === 3) {
        this._state = OpCodes.Pack32BE(0, seedBytes[0], seedBytes[1], seedBytes[2]);
      } else if (seedBytes.length === 2) {
        this._state = OpCodes.Pack32BE(0, 0, seedBytes[0], seedBytes[1]);
      } else {
        this._state = OpCodes.Pack32BE(0, 0, 0, seedBytes[0]);
      }

      this._state = OpCodes.ToUint32(this._state); // Ensure unsigned 32-bit
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using Mulberry32 algorithm
     *
     * Algorithm (from Tommy Ettinger):
     * state = state + 0x6D2B79F5 | 0;
     * z = state;
     * z = Math.imul(z ^ z >>> 15, z | 1);
     * z ^= z + Math.imul(z ^ z >>> 7, z | 61);
     * return (z ^ z >>> 14) >>> 0;
     *
     * Key constant: 0x6D2B79F5 (1831565813 decimal)
     * This is a carefully chosen increment for the Weyl sequence
     *
     * NOTE: Bitwise operations (^, |, >>>) are integral to the Mulberry32 algorithm
     * specification and cannot be replaced with OpCodes equivalents.
     */
    _next32() {
      if (!this._ready) {
        throw new Error('Mulberry32 not initialized: set seed first');
      }

      // Step 1: Weyl sequence - add constant to state
      this._state = OpCodes.ToInt(this._state + 0x6D2B79F5);
      let z = this._state;

      // Step 2: MurmurHash3-style mixing
      // First mix: XOR with right-shift 15, multiply by (z | 1)
      const zShifted15 = OpCodes.Shr32(z, 15);
      z = Math.imul(OpCodes.XorN(z, zShifted15), OpCodes.OrN(z, 1));

      // Step 3: Second mix: XOR with addition and multiply
      const zShifted7 = OpCodes.Shr32(z, 7);
      z = OpCodes.ToInt(OpCodes.XorN(z, z + Math.imul(OpCodes.XorN(z, zShifted7), OpCodes.OrN(z, 61))));

      // Step 4: Final mix: XOR with right-shift 14
      const zShifted14 = OpCodes.Shr32(z, 14);
      return OpCodes.ToDWord(OpCodes.XorN(z, zShifted14));
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Mulberry32 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order for consistency)
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
      // For PRNG, Feed is not typically used
      // Included for interface compliance
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors (if needed)
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
  const algorithmInstance = new Mulberry32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Mulberry32Algorithm, Mulberry32Instance };
}));
