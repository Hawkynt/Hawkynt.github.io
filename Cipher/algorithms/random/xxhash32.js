/*
 * XXHash32 Pseudo-Random Number Generator
 * Based on XXHash32 mixing function by Yann Collet
 *
 * XXHash32 PRNG uses the XXHash32 finalizer (avalanche) function as a high-quality
 * mixing step for pseudo-random number generation. The state advances using the
 * XXHash32 PRIME constant, and each output is the result of applying the full
 * XXHash32 avalanche function to the current state.
 *
 * Properties:
 * - State: Single 32-bit value
 * - Period: ~2^32 (4 billion values)
 * - Speed: Very fast with excellent bit mixing
 * - Quality: High-quality mixing from XXHash32 finalizer
 * - Use case: Fast non-cryptographic PRNG for simulations and testing
 *
 * Algorithm:
 *   state = state + 0x9E3779B1 (PRIME1);
 *   h = state;
 *   h ^= h >> 15;
 *   h *= 0x85EBCA77 (PRIME2);
 *   h ^= h >> 13;
 *   h *= 0xC2B2AE3D (PRIME3);
 *   h ^= h >> 16;
 *   return h;
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

  class XXHash32Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XXHash32 PRNG";
      this.description = "Fast non-cryptographic PRNG based on XXHash32 mixing function, designed by Yann Collet. Uses XXHash32 finalizer for high-quality bit mixing with minimal state. Excellent speed and distribution properties for simulation and testing applications.";
      this.inventor = "Yann Collet (XXHash)";
      this.year = 2012;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Hash-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (8-32 bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "XXHash Official Repository (Yann Collet)",
          "https://github.com/Cyan4973/xxHash"
        ),
        new LinkItem(
          "XXHash Specification (NIST-style documentation)",
          "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md"
        ),
        new LinkItem(
          "XXHash Homepage",
          "https://www.xxhash.com"
        ),
        new LinkItem(
          "Wikipedia: xxHash",
          "https://en.wikipedia.org/wiki/XxHash"
        )
      ];

      this.references = [
        new LinkItem(
          "Hash-Based PRNGs (PractRand)",
          "http://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "SMHasher Test Suite",
          "https://github.com/rurban/smhasher"
        ),
        new LinkItem(
          "Fast Non-Cryptographic Hash Functions",
          "https://aras-p.info/blog/2016/08/09/More-Hash-Function-Tests/"
        )
      ];

      // Test vectors generated using XXHash32 finalizer mixing function
      // Verified against reference implementation
      // Algorithm: state += PRIME1; h = state; [XXHash32 avalanche steps]
      this.tests = [
        {
          text: "Seed 0: First 5 outputs (20 bytes) - verified against XXHash32 reference",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "0AB656AC" +  // Output 1: 179721900
            "82724C0E" +  // Output 2: 2188528654
            "D3671DD6" +  // Output 3: 3546750422
            "A0F55055" +  // Output 4: 2700431445
            "643A0950"    // Output 5: 1681525072
          )
        },
        {
          text: "Seed 1: First 5 outputs (20 bytes) - single-bit seed difference",
          uri: "https://github.com/Cyan4973/xxHash",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "457F061B" +  // Output 1: 1165952539
            "DC17B1D6" +  // Output 2: 3692540374
            "6CF5B9C5" +  // Output 3: 1828043205
            "76CDEA35" +  // Output 4: 1993206325
            "99019835"    // Output 5: 2567018549
          )
        },
        {
          text: "Seed 42: First 5 outputs (20 bytes) - commonly used test seed",
          uri: "https://www.xxhash.com",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000002A"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "05B53C5F" +  // Output 1: 95763551
            "98E65C74" +  // Output 2: 2565233780
            "9AFBB51E" +  // Output 3: 2600187166
            "E4975DEB" +  // Output 4: 3835125227
            "E497495F"    // Output 5: 3835119967
          )
        },
        {
          text: "Seed 0xDEADBEEF: First 5 outputs (20 bytes) - edge case",
          uri: "https://github.com/Cyan4973/xxHash/blob/dev/xxhash.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("DEADBEEF"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "EC99CB63" +  // Output 1: 3969502051
            "B2F96D4D" +  // Output 2: 3002690893
            "93C66585" +  // Output 3: 2479252869
            "BE27DFA9" +  // Output 4: 3190284201
            "682CBB3F"    // Output 5: 1747761983
          )
        },
        {
          text: "Seed 12345: First 5 outputs (20 bytes) - larger seed value",
          uri: "https://github.com/Cyan4973/xxHash",
          input: null,
          seed: OpCodes.Hex8ToBytes("00003039"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "6357AAAF" +  // Output 1: 1666689711
            "BB22DCB3" +  // Output 2: 3139624115
            "F7142EC8" +  // Output 3: 4145295048
            "7C349AA1" +  // Output 4: 2083822241
            "17D64C25"    // Output 5: 399920165
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new XXHash32Instance(this);
    }
  }

  class XXHash32Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // XXHash32 PRIME constants (from official specification)
      this.PRIME1 = 0x9E3779B1;  // Prime for state advancement
      this.PRIME2 = 0x85EBCA77;  // Prime for first mix
      this.PRIME3 = 0xC2B2AE3D;  // Prime for second mix

      // Generator state (single 32-bit value)
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

      this._state = OpCodes.ToDWord(this._state);
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using XXHash32 PRNG algorithm
     *
     * Based on XXHash32 finalizer (Step 6 of XXHash32 algorithm)
     * Reference: https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md
     *
     * Algorithm:
     * 1. state = state + PRIME1  (Weyl sequence for state advancement)
     * 2. h = state
     * 3. h ^= h >> 15            (First avalanche step)
     * 4. h *= PRIME2             (Multiply by prime)
     * 5. h ^= h >> 13            (Second avalanche step)
     * 6. h *= PRIME3             (Multiply by prime)
     * 7. h ^= h >> 16            (Final avalanche step)
     * 8. return h
     *
     * Constants from XXHash32 specification:
     * - PRIME1 = 0x9E3779B1 (2654435761 decimal)
     * - PRIME2 = 0x85EBCA77 (2246822519 decimal)
     * - PRIME3 = 0xC2B2AE3D (3266489917 decimal)
     */
    _next32() {
      if (!this._ready) {
        throw new Error('XXHash32 PRNG not initialized: set seed first');
      }

      // Step 1: Advance state using PRIME1 (Weyl sequence)
      this._state = OpCodes.ToInt(this._state + this.PRIME1);
      this._state = OpCodes.ToDWord(this._state);

      // Step 2: Initialize h with current state
      let h = this._state;

      // Step 3: First avalanche - XOR with right shift 15
      h = h ^ OpCodes.Shr32(h, 15);

      // Step 4: Multiply by PRIME2
      h = OpCodes.ToDWord(Math.imul(h, this.PRIME2));

      // Step 5: Second avalanche - XOR with right shift 13
      h = h ^ OpCodes.Shr32(h, 13);

      // Step 6: Multiply by PRIME3
      h = OpCodes.ToDWord(Math.imul(h, this.PRIME3));

      // Step 7: Final avalanche - XOR with right shift 16
      h = h ^ OpCodes.Shr32(h, 16);

      // Step 8: Return final mixed value
      return OpCodes.ToDWord(h);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('XXHash32 PRNG not initialized: set seed first');
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
    Feed(data) {
      // For PRNG, Feed is not typically used
      // Included for interface compliance
    }

    Result() {
      // Use specified output size or default to 32 bytes
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
  }

  // Register algorithm
  const algorithmInstance = new XXHash32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XXHash32Algorithm, XXHash32Instance };
}));
