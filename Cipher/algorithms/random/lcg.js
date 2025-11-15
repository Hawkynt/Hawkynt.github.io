/*
 * Linear Congruential Generator (LCG)
 * By D. H. Lehmer (1949)
 * Based on the C# implementation with multiple parameter sets
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

  class LCGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LCG (Linear Congruential Generator)";
      this.description = "The Linear Congruential Generator is one of the oldest and most well-known pseudorandom number generator algorithms. It uses the formula X(n+1) = (a * X(n) + c) mod m to generate a sequence of numbers. Despite its simplicity and speed, it has poor statistical properties and should not be used for cryptographic purposes.";
      this.inventor = "D. H. Lehmer";
      this.year = 1949;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudorandom Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // Flexible seed size

      // Documentation
      this.documentation = [
        new LinkItem(
          "Wikipedia: Linear Congruential Generator",
          "https://en.wikipedia.org/wiki/Linear_congruential_generator"
        ),
        new LinkItem(
          "Knuth, D. E.: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms)",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "Park & Miller: Random Number Generators: Good Ones Are Hard To Find",
          "https://www.firstpr.com.au/dsp/rand31/"
        )
      ];

      this.references = [
        new LinkItem(
          "Park-Miller-Carta Pseudo-Random Number Generators",
          "https://www.firstpr.com.au/dsp/rand31/"
        ),
        new LinkItem(
          "Numerical Recipes in C: The Art of Scientific Computing",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "GLIBC rand() implementation",
          "https://sourceware.org/git/?p=glibc.git;a=blob;f=stdlib/random_r.c"
        )
      ];

      // Test vectors from official sources
      // Park-Miller MINSTD with multiplier a=16807, c=0, m=2^31-1, seed=1
      // Source: https://www.firstpr.com.au/dsp/rand31/
      // Expected sequence: 16807, 282475249, 1622650073, 984943658, 1144108930, 470211272, 101027544, 1457850878, 1458777923, 2007237709
      this.tests = [
        {
          text: "MINSTD (Park-Miller) a=16807, c=0, m=2^31-1, seed=1 - First 10 values",
          uri: "https://www.firstpr.com.au/dsp/rand31/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("000041A7"), // a = 16807
          increment: OpCodes.Hex8ToBytes("00000000"), // c = 0
          modulo: OpCodes.Hex8ToBytes("7FFFFFFF"), // m = 2^31 - 1 = 2147483647
          outputSize: 40, // 10 x 4 bytes = 40 bytes
          expected: OpCodes.Hex8ToBytes("000041A710D63AF160B7ACD93AB50C2A4431B7821C06DAC806058ED856E509FE56F32F4377A4044D")
        },
        {
          text: "MINSTD (Park-Miller) - 10,000th value should be 1043618065",
          uri: "https://www.firstpr.com.au/dsp/rand31/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          multiplier: OpCodes.Hex8ToBytes("000041A7"),
          increment: OpCodes.Hex8ToBytes("00000000"),
          modulo: OpCodes.Hex8ToBytes("7FFFFFFF"),
          count: 10000, // Generate 10,000 values
          outputSize: 4, // Return only the 10,000th value
          expected: OpCodes.Hex8ToBytes("3E345911") // 1043618065
        },
        {
          text: "Numerical Recipes a=1664525, c=1013904223, m=2^32, seed=1 - First 10 values",
          uri: "http://numerical.recipes/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("0019660D"), // a = 1664525
          increment: OpCodes.Hex8ToBytes("3C6EF35F"), // c = 1013904223
          modulo: OpCodes.Hex8ToBytes("0100000000"), // m = 2^32 = 4294967296
          outputSize: 40, // 10 x 4 bytes
          expected: OpCodes.Hex8ToBytes("3C88596C5E8885DB8116017EB4733AC50CF06D605E98C13FC656DD928E625FC90438E694A3A5A0E3")
        },
        {
          text: "ANSI C (glibc) a=1103515245, c=12345, m=2^31, seed=1 - First 8 values",
          uri: "https://sourceware.org/git/?p=glibc.git",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("41C64E6D"), // a = 1103515245
          increment: OpCodes.Hex8ToBytes("00003039"), // c = 12345
          modulo: OpCodes.Hex8ToBytes("80000000"), // m = 2^31 = 2147483648
          outputSize: 32, // 8 x 4 bytes
          expected: OpCodes.Hex8ToBytes("41C67EA6167EB0E72781E494446B9B3D794BDF3215FB748359E2B6001CFBAE39")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new LCGInstance(this);
    }
  }

  class LCGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // LCG state
      this._state = 0n;

      // LCG parameters (default values match C# default: PCG constants)
      this._multiplier = 6364136223846793005n;
      this._increment = 1442695040888963407n;
      this._modulo = 0n; // 0 means implicit modulo (2^64 for JavaScript BigInt)

      // Internal state
      this._ready = false;
      this._useImplicitModulo = true;
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

      // If modulo is set, apply it to the seed
      if (!this._useImplicitModulo && this._modulo > 0n) {
        this._state = seedValue % this._modulo;
      } else {
        this._state = seedValue;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set multiplier parameter (a)
     */
    set multiplier(multiplierBytes) {
      if (!multiplierBytes || multiplierBytes.length === 0) {
        this._multiplier = 6364136223846793005n; // Default
        return;
      }

      // Convert multiplier bytes to BigInt (big-endian)
      let multiplierValue = 0n;
      for (let i = 0; i < multiplierBytes.length; ++i) {
        multiplierValue = OpCodes.OrN(OpCodes.ShiftLn(multiplierValue, 8n), BigInt(multiplierBytes[i]));
      }

      this._multiplier = multiplierValue;
    }

    get multiplier() {
      return null;
    }

    /**
     * Set increment parameter (c)
     */
    set increment(incrementBytes) {
      if (!incrementBytes || incrementBytes.length === 0) {
        this._increment = 1442695040888963407n; // Default
        return;
      }

      // Convert increment bytes to BigInt (big-endian)
      let incrementValue = 0n;
      for (let i = 0; i < incrementBytes.length; ++i) {
        incrementValue = OpCodes.OrN(OpCodes.ShiftLn(incrementValue, 8n), BigInt(incrementBytes[i]));
      }

      this._increment = incrementValue;
    }

    get increment() {
      return null;
    }

    /**
     * Set modulo parameter (m)
     * If modulo is 0 or empty, use implicit modulo (overflow behavior)
     */
    set modulo(moduloBytes) {
      if (!moduloBytes || moduloBytes.length === 0) {
        this._modulo = 0n;
        this._useImplicitModulo = true;
        return;
      }

      // Convert modulo bytes to BigInt (big-endian)
      let moduloValue = 0n;
      for (let i = 0; i < moduloBytes.length; ++i) {
        moduloValue = OpCodes.OrN(OpCodes.ShiftLn(moduloValue, 8n), BigInt(moduloBytes[i]));
      }

      if (moduloValue === 0n) {
        this._modulo = 0n;
        this._useImplicitModulo = true;
      } else {
        this._modulo = moduloValue;
        this._useImplicitModulo = false;
      }
    }

    get modulo() {
      return null;
    }

    /**
     * Set count parameter (for skipping ahead to nth value)
     */
    set count(skipCount) {
      this._skipCount = skipCount;
    }

    get count() {
      return this._skipCount || 0;
    }

    /**
     * Generate next value using LCG formula: X(n+1) = (a * X(n) + c) mod m
     * Matches C# implementation logic
     */
    _next() {
      if (!this._ready) {
        throw new Error('LCG not initialized: set seed first');
      }

      let nextState;

      if (this._useImplicitModulo) {
        // Implicit modulo - use natural BigInt overflow (mask to 64-bit)
        nextState = this._state * this._multiplier + this._increment;
        // Mask to 64-bit to simulate overflow
        const mask64 = 0xFFFFFFFFFFFFFFFFn;
        this._state = OpCodes.AndN(nextState, mask64);
      } else {
        // Explicit modulo - use UInt128 arithmetic like C#
        // state = (state * multiplier + increment) % modulo
        const state128 = this._state * this._multiplier + this._increment;
        this._state = state128 % this._modulo;
      }

      return this._state;
    }

    /**
     * Generate random bytes
     * Outputs values packed as 32-bit or 64-bit depending on modulo size
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('LCG not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      // If count is set, skip ahead to the nth value
      if (this._skipCount && this._skipCount > 1) {
        for (let i = 1; i < this._skipCount; ++i) {
          this._next();
        }
        this._skipCount = null; // Clear after use
      }

      const output = [];

      // Determine byte width based on modulo
      // If modulo <= 2^32, use 32-bit output; otherwise use 64-bit
      const use32Bit = !this._useImplicitModulo && this._modulo > 0n && this._modulo <= 0x100000000n;
      const bytesPerValue = use32Bit ? 4 : 8;

      while (output.length < length) {
        const value = this._next();

        if (use32Bit) {
          // Pack as 32-bit value (big-endian) using OpCodes
          const value32 = Number(OpCodes.AndN(value, 0xFFFFFFFFn));
          const bytes = OpCodes.Unpack32BE(value32);
          for (let i = 0; i < 4 && output.length < length; ++i) {
            output.push(bytes[i]);
          }
        } else {
          // Pack as 64-bit value (big-endian)
          for (let i = 56; i >= 0; i -= 8) {
            if (output.length < length) {
              output.push(Number(OpCodes.AndN(OpCodes.ShiftRn(value, BigInt(i)), 0xFFn)));
            }
          }
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is typically not used (LCG is deterministic)
      // Could be used for reseeding if needed
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
  const algorithmInstance = new LCGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LCGAlgorithm, LCGInstance };
}));
