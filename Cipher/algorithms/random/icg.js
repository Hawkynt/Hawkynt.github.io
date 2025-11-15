/*
 * Inversive Congruential Generator (ICG)
 * By Jürgen Eichenauer-Herrmann (1992)
 * Based on the C# implementation from Hawkynt Randomizer
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
   * Compute modular multiplicative inverse using Extended Euclidean Algorithm
   * Standard implementation ensuring positive results
   * @param {BigInt} value - Value to invert
   * @param {BigInt} modulus - Modulus
   * @returns {BigInt} Modular multiplicative inverse, or 0 if none exists
   */
  function ModInverse(value, modulus) {
    if (value === 0n) return 0n;

    let t = 0n, newT = 1n;
    let r = modulus, newR = value % modulus;

    while (newR !== 0n) {
      const quotient = r / newR;

      // Update t and newT
      [t, newT] = [newT, t - quotient * newT];

      // Update r and newR
      [r, newR] = [newR, r - quotient * newR];
    }

    if (r > 1n) return 0n; // No inverse exists

    // Ensure positive result
    return t < 0n ? t + modulus : t;
  }

  class ICGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ICG (Inversive Congruential Generator)";
      this.description = "The Inversive Congruential Generator is a non-linear pseudorandom number generator that uses modular multiplicative inversion. It uses the formula X(n+1) = (a * X(n)^(-1) + c) mod m, where X(n)^(-1) is the modular multiplicative inverse. ICG has better statistical properties than LCG but is computationally more expensive.";
      this.inventor = "Jürgen Eichenauer-Herrmann";
      this.year = 1992;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudorandom Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DE;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // Flexible seed size

      // Documentation
      this.documentation = [
        new LinkItem(
          "Eichenauer-Herrmann: Inversive Congruential Pseudorandom Numbers (1992)",
          "https://doi.org/10.1145/146382.146385"
        ),
        new LinkItem(
          "Wikipedia: Inversive Congruential Generator",
          "https://en.wikipedia.org/wiki/Inversive_congruential_generator"
        ),
        new LinkItem(
          "Knuth: The Art of Computer Programming Vol. 2 (Section 3.2.2)",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        )
      ];

      this.references = [
        new LinkItem(
          "Eichenauer, J., Lehn, J.: A non-linear congruential pseudo random number generator",
          "https://link.springer.com/article/10.1007/BF02307276"
        ),
        new LinkItem(
          "Niederreiter, H.: Random Number Generation and Quasi-Monte Carlo Methods",
          "https://doi.org/10.1137/1.9781611970081"
        )
      ];

      // Test vectors computed from ICG formula with verified parameters
      // Using constants from C# implementation:
      // a = 6364136223846793005, c = 1442695040888963407, m = 2^64 - 59 (18446744073709551557)
      // Formula: X[n] = (a * X[n-1]^(-1) + c) mod m
      this.tests = [
        {
          text: "ICG with C# default parameters - seed=1, first 5 values",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"), // a = 6364136223846793005
          increment: OpCodes.Hex8ToBytes("14057B7EF767814F"), // c = 1442695040888963407
          modulo: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFC5"), // m = 18446744073709551557
          outputSize: 40, // 5 x 8 bytes
          // ICG sequence: 7806831264735756412, 2786147638208421241, 13239823990500765767, 340352254088881284, 16823841100781560281
          expected: OpCodes.Hex8ToBytes("6C576FAC43FD007C26AA6283EB34DD79B7BD4DC5927E304704B92C926378A484E97A4A5839B3A1D9")
        },
        {
          text: "ICG with seed=0 (special case - returns increment)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"), // seed = 0
          multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"),
          increment: OpCodes.Hex8ToBytes("14057B7EF767814F"),
          modulo: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFC5"),
          outputSize: 8, // 1 value
          // When state is 0, ICG returns c (since inverse of 0 doesn't exist)
          expected: OpCodes.Hex8ToBytes("14057B7EF767814F")
        },
        {
          text: "ICG with small modulus m=251 (prime), a=3, c=5, seed=7",
          uri: "https://en.wikipedia.org/wiki/Inversive_congruential_generator",
          input: null,
          seed: OpCodes.Hex8ToBytes("07"), // seed = 7
          multiplier: OpCodes.Hex8ToBytes("03"), // a = 3
          increment: OpCodes.Hex8ToBytes("05"), // c = 5
          modulo: OpCodes.Hex8ToBytes("FB"), // m = 251 (prime)
          outputSize: 10, // 10 bytes
          // ICG generates: 113, 65, 90, 164, 230, 220, 13, 179, 120, 187
          // 7^(-1) mod 251 = 36, so X[1] = (3*36 + 5) mod 251 = 113
          // Note: sequence starts from first generated value (not seed)
          expected: OpCodes.Hex8ToBytes("71415AA4E6DC0DB378BB")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new ICGInstance(this);
    }
  }

  class ICGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // ICG state
      this._state = 0n;

      // ICG parameters (default values match C# implementation)
      this._multiplier = 6364136223846793005n;
      this._increment = 1442695040888963407n;
      this._modulo = 18446744073709551557n; // 2^64 - 59 (large prime)

      // Internal state
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

      // Apply modulo to seed
      this._state = seedValue % this._modulo;

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
     * Should be a large prime for best statistical properties
     */
    set modulo(moduloBytes) {
      if (!moduloBytes || moduloBytes.length === 0) {
        this._modulo = 18446744073709551557n; // Default
        return;
      }

      // Convert modulo bytes to BigInt (big-endian)
      let moduloValue = 0n;
      for (let i = 0; i < moduloBytes.length; ++i) {
        moduloValue = OpCodes.OrN(OpCodes.ShiftLn(moduloValue, 8n), BigInt(moduloBytes[i]));
      }

      this._modulo = moduloValue;
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
     * Generate next value using ICG formula: X(n+1) = (a * X(n)^(-1) + c) mod m
     * Matches C# implementation logic
     */
    _next() {
      if (!this._ready) {
        throw new Error('ICG not initialized: set seed first');
      }

      // ICG formula: state = (a * state^(-1) + c) mod m
      // Special case: if state is 0, modular inverse doesn't exist, return c
      if (this._state === 0n) {
        this._state = this._increment % this._modulo;
      } else {
        // Compute modular multiplicative inverse
        const inverse = ModInverse(this._state, this._modulo);

        // Apply ICG formula with proper positive modulo
        let result = (this._multiplier * inverse + this._increment) % this._modulo;
        // Ensure result is positive (JavaScript modulo can return negative)
        this._state = result < 0n ? result + this._modulo : result;
      }

      return this._state;
    }

    /**
     * Generate random bytes
     * Outputs values packed based on modulo size (8-bit for m<256, 16-bit for m<65536, etc.)
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('ICG not initialized: set seed first');
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

      // Determine bytes per value based on modulo size
      let bytesPerValue;
      if (this._modulo <= 0x100n) {
        bytesPerValue = 1; // 8-bit
      } else if (this._modulo <= 0x10000n) {
        bytesPerValue = 2; // 16-bit
      } else if (this._modulo <= 0x100000000n) {
        bytesPerValue = 4; // 32-bit
      } else {
        bytesPerValue = 8; // 64-bit
      }

      while (output.length < length) {
        const value = this._next();

        // Pack value as big-endian with appropriate byte width
        for (let i = (bytesPerValue - 1) * 8; i >= 0; i -= 8) {
          if (output.length < length) {
            output.push(Number(OpCodes.AndN(OpCodes.ShiftRn(value, BigInt(i)), 0xFFn)));
          }
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is typically not used (ICG is deterministic)
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
  const algorithmInstance = new ICGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ICGAlgorithm, ICGInstance };
}));
