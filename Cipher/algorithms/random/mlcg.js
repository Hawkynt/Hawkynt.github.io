/*
 * Multiplicative Linear Congruential Generator (MLCG)
 * By D. H. Lehmer (1951)
 * Based on the C# implementation from Hawkynt Randomizer project
 *
 * MLCG is a simplified LCG where increment c=0, using formula: X(n+1) = (a * X(n)) mod m
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

  class MLCGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MLCG (Multiplicative Linear Congruential Generator)";
      this.description = "The Multiplicative Linear Congruential Generator is a simplified variant of LCG using only multiplication (no additive constant). It uses the formula X(n+1) = (a * X(n)) mod m. MLCG was one of the earliest PRNGs, introduced by D. H. Lehmer in 1951. While simple and fast, it has poor statistical properties and must never be used for cryptographic purposes.";
      this.inventor = "D. H. Lehmer";
      this.year = 1951;
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
          "Lehmer, D. H.: Mathematical methods in large-scale computing units (1951)",
          "https://projecteuclid.org/euclid.aoms/1177729694"
        ),
        new LinkItem(
          "Wikipedia: Lehmer Random Number Generator",
          "https://en.wikipedia.org/wiki/Lehmer_random_number_generator"
        ),
        new LinkItem(
          "Knuth, D. E.: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms), Section 3.2.1",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        )
      ];

      this.references = [
        new LinkItem(
          "Park & Miller: Random Number Generators: Good Ones Are Hard To Find",
          "https://www.firstpr.com.au/dsp/rand31/"
        ),
        new LinkItem(
          "L'Ecuyer, P.: Tables of Linear Congruential Generators",
          "https://doi.org/10.1090/S0025-5718-99-00996-5"
        )
      ];

      // Test vectors from official sources
      // MINSTD is an MLCG with a=16807, m=2^31-1 (c=0 implicitly)
      // Source: Park & Miller (1988) "Random Number Generators: Good Ones Are Hard To Find"
      // https://www.firstpr.com.au/dsp/rand31/
      // Expected sequence from seed=1: 16807, 282475249, 1622650073, 984943658, 1144108930...
      this.tests = [
        {
          text: "MINSTD (Park-Miller MLCG) a=16807, m=2^31-1, seed=1 - First 10 values",
          uri: "https://www.firstpr.com.au/dsp/rand31/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("000041A7"), // a = 16807
          modulo: OpCodes.Hex8ToBytes("7FFFFFFF"), // m = 2^31 - 1 = 2147483647
          outputSize: 40, // 10 x 4 bytes = 40 bytes
          expected: OpCodes.Hex8ToBytes("000041A710D63AF160B7ACD93AB50C2A4431B7821C06DAC806058ED856E509FE56F32F4377A4044D")
        },
        {
          text: "MINSTD (Park-Miller MLCG) - 10,000th value should be 1043618065",
          uri: "https://www.firstpr.com.au/dsp/rand31/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("000041A7"), // a = 16807
          modulo: OpCodes.Hex8ToBytes("7FFFFFFF"), // m = 2^31 - 1
          count: 10000, // Generate 10,000 values
          outputSize: 4, // Return only the 10,000th value
          expected: OpCodes.Hex8ToBytes("3E345911") // 1043618065
        },
        {
          text: "MLCG with a=48271, m=2^31-1, seed=1 - First 5 values",
          uri: "https://www.firstpr.com.au/dsp/rand31/",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          multiplier: OpCodes.Hex8ToBytes("0000BC8F"), // a = 48271
          modulo: OpCodes.Hex8ToBytes("7FFFFFFF"), // m = 2^31 - 1
          outputSize: 20, // 5 x 4 bytes
          expected: OpCodes.Hex8ToBytes("0000BC8F0AE257E24CF91F467220517D7BE5F8F1")
        },
        {
          text: "Implicit modulo (2^64) with C# default multiplier, seed=12345",
          uri: "https://github.com/Hawkynt/C--FrameworkExtensions",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000003039"), // seed = 12345
          multiplier: OpCodes.Hex8ToBytes("5851F42D4C957F2D"), // a = 6364136223846793005
          modulo: OpCodes.Hex8ToBytes(""), // implicit modulo (2^64)
          outputSize: 40, // 5 x 8 bytes (64-bit values)
          expected: OpCodes.Hex8ToBytes("0807DC721521C10529E75C5D499968E147C1C8E2E1F40E8D6F3CC8211F2F81C9F12741CE42B98755")
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
      return new MLCGInstance(this);
    }
  }

  /**
 * MLCG cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MLCGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MLCG state
      this._state = 0n;

      // MLCG parameters (default values match C# default)
      this._multiplier = 6364136223846793005n; // Default multiplier from C#
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
     * Generate next value using MLCG formula: X(n+1) = (a * X(n)) mod m
     * Matches C# implementation logic (simplified LCG with c=0)
     */
    _next() {
      if (!this._ready) {
        throw new Error('MLCG not initialized: set seed first');
      }

      if (this._useImplicitModulo) {
        // Implicit modulo - use natural BigInt overflow (mask to 64-bit)
        this._state *= this._multiplier;
        // Mask to 64-bit to simulate overflow
        const mask64 = 0xFFFFFFFFFFFFFFFFn;
        this._state = OpCodes.AndN(this._state, mask64);
      } else {
        // Explicit modulo - use UInt128 arithmetic like C#
        // state = (state * multiplier) % modulo
        const state128 = this._state * this._multiplier;
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
        throw new Error('MLCG not initialized: set seed first');
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
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed is typically not used (MLCG is deterministic)
      // Could be used for reseeding if needed
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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
  const algorithmInstance = new MLCGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MLCGAlgorithm, MLCGInstance };
}));
