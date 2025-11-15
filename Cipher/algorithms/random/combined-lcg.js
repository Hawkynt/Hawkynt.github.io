/*
 * Combined Linear Congruential Generator
 * By Pierre L'Ecuyer (1988)
 * Based on the C# implementation from Hawkynt.Randomizer
 *
 * Combines multiple LCGs to improve statistical properties over single LCGs.
 * The combination modes include additive, subtractive, multiplicative, and XOR.
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
   * Combination modes for combining multiple LCG outputs
   */
  const CombinationMode = Object.freeze({
    ADDITIVE: 0,      // Add outputs: (X1 + X2) mod 2^64
    SUBTRACTIVE: 1,   // Subtract outputs: (X1 - X2) mod 2^64
    MULTIPLICATIVE: 2,// Multiply outputs: (X1 * X2) mod 2^64
    XOR: 3            // XOR outputs: X1 ^ X2
  });

  /**
   * SplitMix64 for seeding individual LCGs
   * Based on Guy L. Steele Jr. and Doug Lea's algorithm
   */
  class SplitMix64 {
    static next(state) {
      // Add golden gamma
      const newState = OpCodes.AndN(state + 0x9E3779B97F4A7C15n, 0xFFFFFFFFFFFFFFFFn);

      // Mix function (Stafford variant 13)
      let z = newState;
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 30)) * 0xBF58476D1CE4E5B9n, 0xFFFFFFFFFFFFFFFFn);
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 27)) * 0x94D049BB133111EBn, 0xFFFFFFFFFFFFFFFFn);
      z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 31)), 0xFFFFFFFFFFFFFFFFn);

      return { state: newState, value: z };
    }
  }

  /**
   * Single Linear Congruential Generator
   * X(n+1) = (a * X(n) + c) mod m
   */
  class LinearCongruentialGenerator {
    constructor(multiplier, increment, modulo) {
      this._multiplier = multiplier;
      this._increment = increment;
      this._modulo = modulo;
      this._state = 0n;
      this._useImplicitModulo = (modulo === 0n);
    }

    seed(seedValue) {
      if (!this._useImplicitModulo && this._modulo > 0n) {
        this._state = seedValue % this._modulo;
      } else {
        this._state = seedValue;
      }
    }

    next() {
      if (this._useImplicitModulo) {
        // Implicit modulo 2^64 (natural BigInt overflow with masking)
        this._state = OpCodes.AndN(
          this._state * this._multiplier + this._increment,
          0xFFFFFFFFFFFFFFFFn
        );
      } else {
        // Explicit modulo (like C# UInt128 arithmetic)
        const state128 = this._state * this._multiplier + this._increment;
        this._state = state128 % this._modulo;
      }
      return this._state;
    }
  }

  class CombinedLCGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Combined LCG";
      this.description = "Combined Linear Congruential Generator combines outputs from multiple LCG instances to produce better statistical properties than a single LCG. Developed by Pierre L'Ecuyer in 1988, the combination methods (additive, subtractive, multiplicative, XOR) significantly extend the period and improve randomness quality.";
      this.inventor = "Pierre L'Ecuyer";
      this.year = 1988;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudorandom Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CA;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 32, 1)]; // Flexible seed size

      // Documentation
      this.documentation = [
        new LinkItem(
          "L'Ecuyer, P. (1988): Efficient and Portable Combined Random Number Generators (CACM 31(6):742-749,774)",
          "https://www.iro.umontreal.ca/~lecuyer/myftp/papers/cacm88.pdf"
        ),
        new LinkItem(
          "L'Ecuyer, P. (1999): Good Parameters for Combined Multiple Recursive Generators (Operations Research 47(1):159-164)",
          "https://pubsonline.informs.org/doi/pdf/10.1287/opre.47.1.159"
        ),
        new LinkItem(
          "Wikipedia: Linear Congruential Generator",
          "https://en.wikipedia.org/wiki/Linear_congruential_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "L'Ecuyer's RNG Papers and Software",
          "https://www.iro.umontreal.ca/~lecuyer/papers.html"
        ),
        new LinkItem(
          "Knuth, D. E.: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms)",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "TestU01: Statistical Testing Suite for RNGs",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors verified by running JavaScript implementation against C# reference
      // Using SplitMix64 for seeding individual LCGs from main seed
      // Default PCG-style parameters: LCG1(a=6364136223846793005, c=1442695040888963407, m=0)
      //                               LCG2(a=3935559000370003845, c=2691343689449507681, m=0)
      this.tests = [
        {
          text: "Default PCG parameters, Additive mode, seed=1 - First 5 values",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"), // seed = 1
          combinationMode: CombinationMode.ADDITIVE,
          // LCG1: a=6364136223846793005, c=1442695040888963407, m=0 (implicit 2^64)
          lcg1Multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"),
          lcg1Increment: OpCodes.Hex8ToBytes("14057B7EF767814F"),
          lcg1Modulo: OpCodes.Hex8ToBytes("00"), // 0 = implicit modulo
          // LCG2: a=3935559000370003845, c=2691343689449507681, m=0 (implicit 2^64)
          lcg2Multiplier: OpCodes.Hex8ToBytes("369DEA0F31A53F85"),
          lcg2Increment: OpCodes.Hex8ToBytes("255992D382208B61"),
          lcg2Modulo: OpCodes.Hex8ToBytes("00"),
          outputSize: 40, // 5 x 8 bytes
          expected: OpCodes.Hex8ToBytes("618049F4081C4420659A51615AC96CB0C55EE230C7BB90D8D13AC8E8FA053618925B372AFCA62170")
        },
        {
          text: "Default PCG parameters, XOR mode, seed=42 - First 5 values",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"), // seed = 42
          combinationMode: CombinationMode.XOR,
          lcg1Multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"),
          lcg1Increment: OpCodes.Hex8ToBytes("14057B7EF767814F"),
          lcg1Modulo: OpCodes.Hex8ToBytes("00"),
          lcg2Multiplier: OpCodes.Hex8ToBytes("369DEA0F31A53F85"),
          lcg2Increment: OpCodes.Hex8ToBytes("255992D382208B61"),
          lcg2Modulo: OpCodes.Hex8ToBytes("00"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("079C9839B884A2704981DC493C664DDE2ED1BFEC97391484183722416C6399F63ED118FD21A09238")
        },
        {
          text: "L'Ecuyer 1988 32-bit parameters, Additive mode, seed=12345 - First 5 values",
          uri: "https://www.iro.umontreal.ca/~lecuyer/myftp/papers/cacm88.pdf",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000003039"), // seed = 12345
          combinationMode: CombinationMode.ADDITIVE,
          // L'Ecuyer 1988: a1=40014, c=0, m1=2147483563 (m1 = 0x7FFFFFAB)
          lcg1Multiplier: OpCodes.Hex8ToBytes("00009C4E"),
          lcg1Increment: OpCodes.Hex8ToBytes("00000000"),
          lcg1Modulo: OpCodes.Hex8ToBytes("7FFFFFAB"),
          // L'Ecuyer 1988: a2=40692, c=0, m2=2147483399 (m2 = 0x7FFFFF07)
          lcg2Multiplier: OpCodes.Hex8ToBytes("00009EF4"),
          lcg2Increment: OpCodes.Hex8ToBytes("00000000"),
          lcg2Modulo: OpCodes.Hex8ToBytes("7FFFFF07"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("000000006265368C000000005FA824580000000039FD3BD5000000005BF0874E0000000075A84D5D")
        },
        {
          text: "Subtractive mode test, seed=1 - First 5 values",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          combinationMode: CombinationMode.SUBTRACTIVE,
          lcg1Multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"),
          lcg1Increment: OpCodes.Hex8ToBytes("14057B7EF767814F"),
          lcg1Modulo: OpCodes.Hex8ToBytes("00"),
          lcg2Multiplier: OpCodes.Hex8ToBytes("369DEA0F31A53F85"),
          lcg2Increment: OpCodes.Hex8ToBytes("255992D382208B61"),
          lcg2Modulo: OpCodes.Hex8ToBytes("00"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("D226E9CEFA38D85898C47E2167F31F067017C59A44754AC45CF94BE0781ECAF297C52CE171D305F0")
        },
        {
          text: "Multiplicative mode test, seed=100 - First 5 values",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000064"), // seed = 100
          combinationMode: CombinationMode.MULTIPLICATIVE,
          lcg1Multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"),
          lcg1Increment: OpCodes.Hex8ToBytes("14057B7EF767814F"),
          lcg1Modulo: OpCodes.Hex8ToBytes("00"),
          lcg2Multiplier: OpCodes.Hex8ToBytes("369DEA0F31A53F85"),
          lcg2Increment: OpCodes.Hex8ToBytes("255992D382208B61"),
          lcg2Modulo: OpCodes.Hex8ToBytes("00"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes("240F6B8A133E41BFF80401A36365D6DC879FB6AFB278C5D7D2EC230014F07200C6C06DE607E40507")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new CombinedLCGInstance(this);
    }
  }

  class CombinedLCGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Default combination mode: ADDITIVE
      this._combinationMode = CombinationMode.ADDITIVE;

      // Default LCG parameters (matching C# defaults: PCG constants)
      // LCG 1: a=6364136223846793005 (0x5851F42D4C957F2D), c=1442695040888963407 (0x14057B7EF767814F), m=0 (implicit)
      this._lcg1Multiplier = 6364136223846793005n;
      this._lcg1Increment = 1442695040888963407n;
      this._lcg1Modulo = 0n;

      // LCG 2: a=3935559000370003845 (0x369DEA0F31A53F85), c=2691343689449507681 (0x255992D382208B61), m=0 (implicit)
      this._lcg2Multiplier = 3935559000370003845n;
      this._lcg2Increment = 2691343689449507681n;
      this._lcg2Modulo = 0n;

      // LCG instances (will be created on seed)
      this._lcg1 = null;
      this._lcg2 = null;
      this._lcgs = []; // Additional LCGs beyond the first two

      // State
      this._ready = false;
      this._seedValue = 0n;
      this._needsInit = false;
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

      this._seedValue = seedValue;
      // Mark as needing initialization but don't initialize yet
      // This allows test vectors to set LCG parameters after seed
      this._needsInit = true;
      this._ready = true;
    }

    get seed() {
      return null;
    }

    /**
     * Initialize LCG instances with seeds derived from main seed using SplitMix64
     */
    _initializeLCGs() {
      let currentState = this._seedValue;

      // Create LCG 1 and seed it
      this._lcg1 = new LinearCongruentialGenerator(
        this._lcg1Multiplier,
        this._lcg1Increment,
        this._lcg1Modulo
      );
      const seed1Result = SplitMix64.next(currentState);
      currentState = seed1Result.state;
      this._lcg1.seed(seed1Result.value);

      // Create LCG 2 and seed it
      this._lcg2 = new LinearCongruentialGenerator(
        this._lcg2Multiplier,
        this._lcg2Increment,
        this._lcg2Modulo
      );
      const seed2Result = SplitMix64.next(currentState);
      currentState = seed2Result.state;
      this._lcg2.seed(seed2Result.value);

      // Seed any additional LCGs
      for (let i = 0; i < this._lcgs.length; ++i) {
        const seedResult = SplitMix64.next(currentState);
        currentState = seedResult.state;
        this._lcgs[i].seed(seedResult.value);
      }
    }

    /**
     * Set combination mode
     */
    set combinationMode(mode) {
      if (typeof mode === 'number' && mode >= 0 && mode <= 3) {
        this._combinationMode = mode;
      }
    }

    get combinationMode() {
      return this._combinationMode;
    }

    /**
     * Set LCG 1 parameters
     */
    set lcg1Multiplier(multiplierBytes) {
      const value = this._bytesToBigInt(multiplierBytes);
      this._lcg1Multiplier = (value !== null) ? value : 6364136223846793005n;
      this._needsInit = true; // Mark for re-initialization
    }

    set lcg1Increment(incrementBytes) {
      const value = this._bytesToBigInt(incrementBytes);
      this._lcg1Increment = (value !== null) ? value : 1442695040888963407n;
      this._needsInit = true; // Mark for re-initialization
    }

    set lcg1Modulo(moduloBytes) {
      const value = this._bytesToBigInt(moduloBytes);
      this._lcg1Modulo = (value !== null) ? value : 0n;
      this._needsInit = true; // Mark for re-initialization
    }

    /**
     * Set LCG 2 parameters
     */
    set lcg2Multiplier(multiplierBytes) {
      const value = this._bytesToBigInt(multiplierBytes);
      this._lcg2Multiplier = (value !== null) ? value : 3935559000370003845n;
      this._needsInit = true; // Mark for re-initialization
    }

    set lcg2Increment(incrementBytes) {
      const value = this._bytesToBigInt(incrementBytes);
      this._lcg2Increment = (value !== null) ? value : 2691343689449507681n;
      this._needsInit = true; // Mark for re-initialization
    }

    set lcg2Modulo(moduloBytes) {
      const value = this._bytesToBigInt(moduloBytes);
      this._lcg2Modulo = (value !== null) ? value : 0n;
      this._needsInit = true; // Mark for re-initialization
    }

    /**
     * Convert byte array to BigInt (big-endian)
     */
    _bytesToBigInt(bytes) {
      if (!bytes || bytes.length === 0) {
        return null;
      }

      let value = 0n;
      for (let i = 0; i < bytes.length; ++i) {
        value = OpCodes.OrN(OpCodes.ShiftLn(value, 8n), BigInt(bytes[i]));
      }
      return value;
    }

    /**
     * Generate next combined value
     */
    _next() {
      if (!this._ready) {
        throw new Error('Combined LCG not initialized: set seed first');
      }

      // Initialize LCGs if needed (lazy initialization)
      if (this._needsInit) {
        this._initializeLCGs();
        this._needsInit = false;
      }

      // Get next value from first LCG
      let result = this._lcg1.next();

      // Get next value from second LCG and combine
      const value2 = this._lcg2.next();
      result = this._combine(result, value2);

      // Combine with any additional LCGs
      for (let i = 0; i < this._lcgs.length; ++i) {
        const valueN = this._lcgs[i].next();
        result = this._combine(result, valueN);
      }

      return result;
    }

    /**
     * Combine two values using the selected combination mode
     */
    _combine(value1, value2) {
      const mask64 = 0xFFFFFFFFFFFFFFFFn;

      switch (this._combinationMode) {
        case CombinationMode.ADDITIVE:
          // (value1 + value2) mod 2^64
          return OpCodes.AndN(value1 + value2, mask64);

        case CombinationMode.SUBTRACTIVE:
          // (value1 - value2) mod 2^64
          return OpCodes.AndN(value1 - value2, mask64);

        case CombinationMode.MULTIPLICATIVE:
          // (value1 * value2) mod 2^64
          return OpCodes.AndN(value1 * value2, mask64);

        case CombinationMode.XOR:
          // value1 ^ value2
          return OpCodes.XorN(value1, value2);

        default:
          // Default to additive
          return OpCodes.AndN(value1 + value2, mask64);
      }
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Combined LCG not initialized: set seed first');
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
  const algorithmInstance = new CombinedLCGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { CombinedLCGAlgorithm, CombinedLCGInstance, CombinationMode };
}));
