/*
 * Wichmann-Hill Combined Generator
 * By Brian Wichmann and David Hill (1982)
 * Modernized 64-bit variant with large primes
 * Based on the C# implementation from Hawkynt.Randomizer
 *
 * This is a modern 64-bit variant of the classic Wichmann-Hill algorithm,
 * using three Linear Congruential Generators with large prime moduli near 2^64.
 * The outputs are combined to produce improved randomness properties.
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

  class WichmannHillAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Wichmann-Hill";
      this.description = "Combined random number generator using three Linear Congruential Generators with large prime moduli near 2^64. This modernized variant improves upon the original 1982 AS183 algorithm by using 64-bit arithmetic and larger primes, providing an extremely long period and better statistical properties than simple LCGs.";
      this.inventor = "Brian Wichmann and David Hill";
      this.year = 1982;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudorandom Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.GB;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 32, 1)];

      // Documentation
      this.documentation = [
        new LinkItem(
          "Wichmann, B.A. and Hill, I.D. (1982): Algorithm AS 183: An Efficient and Portable Pseudo-random Number Generator (Applied Statistics 31:188-190)",
          "https://www.jstor.org/stable/2347988"
        ),
        new LinkItem(
          "McLeod, A.I. (1985): Remark AS R58: A Remark on Algorithm AS 183 (Applied Statistics 34:198-200)",
          "https://www.jstor.org/stable/2347378"
        ),
        new LinkItem(
          "Wikipedia: Wichmann-Hill Generator",
          "https://en.wikipedia.org/wiki/Wichmann%E2%80%93Hill"
        )
      ];

      this.references = [
        new LinkItem(
          "Original AS183 Paper - Applied Statistics",
          "https://academic.oup.com/jrsssc/article-abstract/31/2/188/6963832"
        ),
        new LinkItem(
          "Wichmann-Hill Implementation Guide",
          "https://people.sc.fsu.edu/~jburkardt/m_src/asa183/asa183.html"
        )
      ];

      // Test vectors verified by running the C# implementation
      // The modernized variant uses three large primes near 2^64:
      // MODULUS_X = 18446744073709551557 (2^64 - 59)
      // MODULUS_Y = 18446744073709551533 (2^64 - 83)
      // MODULUS_Z = 18446744073709551521 (2^64 - 95)
      // MULTIPLIER_X = 6364136223846793005
      // MULTIPLIER_Y = 1442695040888963407
      // MULTIPLIER_Z = 1229782938247303441
      this.tests = [
        {
          text: "Modernized 64-bit variant, seed=1 - First 5 values (8 bytes each)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"), // seed = 1
          outputSize: 40, // 5 x 8 bytes
          expected: OpCodes.Hex8ToBytes("0657C71CD00132E59BE711B3D64CCD31A5C923BDD09AC22A4EC5B77F8AF1E2A8164D1E21FC54F174")
        },
        {
          text: "Modernized 64-bit variant, seed=42 - First 5 values (8 bytes each)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"), // seed = 42
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("2B77E25E13F294543F54BE2CB9ED2C4B9753DEEAEDCE96AF456610EB40B08E515A4BF254AF2DD91B")
        },
        {
          text: "Modernized 64-bit variant, seed=12345 - First 5 values (8 bytes each)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000003039"), // seed = 12345
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("B60DAF6198914A4E0E408ACD97013B5B7F61C25C0FB4E029A647DB70CC8D51EA1A632A25E20F99A6")
        },
        {
          text: "Modernized 64-bit variant, seed=1000000 - First 5 values (8 bytes each)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000F4240"), // seed = 1000000
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("321E08C3A86EB0B0DE16241CEED7A4F1B99DAFA2C41EC0C856B8244AB00A908C731D999437B7BA88")
        },
        {
          text: "Modernized 64-bit variant, seed=0xDEADBEEF - First 5 values (8 bytes each)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000DEADBEEF"), // seed = 0xDEADBEEF
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("40C8CD72A36B85BB0A9004FF6B8DEDB30A88E02DBBD1B206EBABB900FC54A2C9BD136837299FD960")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new WichmannHillInstance(this);
    }
  }

  class WichmannHillInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Large primes near 2^64 (matching C# implementation)
      this.MODULUS_X = 18446744073709551557n; // 2^64 - 59
      this.MODULUS_Y = 18446744073709551533n; // 2^64 - 83
      this.MODULUS_Z = 18446744073709551521n; // 2^64 - 95

      // Multipliers (matching C# implementation)
      this.MULTIPLIER_X = 6364136223846793005n;
      this.MULTIPLIER_Y = 1442695040888963407n;
      this.MULTIPLIER_Z = 1229782938247303441n;

      // State variables (BigInt for 64-bit+ arithmetic)
      this._x = 0n;
      this._y = 0n;
      this._z = 0n;

      // Ready flag
      this._ready = false;
    }

    /**
     * Set seed value
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8n), BigInt(seedBytes[i]));
      }

      // Seed the three LCGs using division method (matching C# implementation)
      // C# UInt128: ~0 gives max value (0xFFFFFFFFFFFFFFFF for 64-bit portion)
      const MAX_U64 = 0xFFFFFFFFFFFFFFFFn;

      // First: X = seed % MODULUS_X (or MAX_U64 if 0)
      let quotient = seedValue;
      let remainder = quotient % this.MODULUS_X;
      this._x = (remainder === 0n) ? MAX_U64 : remainder;

      // Second: Y = (seed / MODULUS_X) % MODULUS_Y (or MAX_U64 if 0)
      quotient = quotient / this.MODULUS_X;
      remainder = quotient % this.MODULUS_Y;
      this._y = (remainder === 0n) ? MAX_U64 : remainder;

      // Third: Z = (seed / (MODULUS_X * MODULUS_Y)) (or MAX_U64 if 0)
      quotient = quotient / this.MODULUS_Y;
      this._z = (quotient === 0n) ? MAX_U64 : quotient;

      this._ready = true;
    }

    get seed() {
      return null;
    }

    /**
     * Generate next 64-bit value
     */
    _next() {
      if (!this._ready) {
        throw new Error('Wichmann-Hill not initialized: set seed first');
      }

      // Update X: X = (X * MULTIPLIER_X) % MODULUS_X
      this._x = (this._x * this.MULTIPLIER_X) % this.MODULUS_X;

      // Update Y: Y = (Y * MULTIPLIER_Y) % MODULUS_Y
      this._y = (this._y * this.MULTIPLIER_Y) % this.MODULUS_Y;

      // Update Z: Z = (Z * MULTIPLIER_Z) % MODULUS_Z
      this._z = (this._z * this.MULTIPLIER_Z) % this.MODULUS_Z;

      // Combine: result = X + Y + Z
      // JavaScript BigInt naturally wraps at arbitrary precision, but we
      // want to simulate ulong overflow behavior from C#, so mask to 64 bits
      const result = OpCodes.AndN(this._x + this._y + this._z, 0xFFFFFFFFFFFFFFFFn);

      return result;
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Wichmann-Hill not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      while (output.length < length) {
        const value = this._next();

        // Pack as 64-bit value (big-endian)
        for (let i = 56; i >= 0; i -= 8) {
          if (output.length < length) {
            output.push(Number(OpCodes.AndN(OpCodes.ShiftRn(value, BigInt(i)), 0xFFn)));
          }
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is typically not used (deterministic)
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
  const algorithmInstance = new WichmannHillAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { WichmannHillAlgorithm, WichmannHillInstance };
}));
