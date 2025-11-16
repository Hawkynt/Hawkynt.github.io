/*
 * Additive Congruential Random Number Generator (ACRNG)
 * Based on Knuth's Algorithm 3.2.2A from TAOCP Volume 2 (Seminumerical Algorithms)
 *
 * The ACRNG is a special case of the Lagged Fibonacci Generator that uses
 * cascading additions through the entire state array, producing a recurrence:
 * X[1] = (X[0] + X[1]) mod m
 * X[2] = (X[1]_new + X[2]) mod m
 * ...
 * X[n] = (X[n-1]_new + X[n]) mod m
 *
 * Returns X[n] as the output value.
 *
 * This creates a dependency chain where each element depends on the updated
 * previous element, distinguishing it from typical LFG which uses fixed lags.
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

  class ACRNGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ACRNG (Additive Congruential RNG)";
      this.description = "The Additive Congruential Random Number Generator uses cascading additions through a state array, where each element is updated by adding the previous (newly updated) element. This creates a dependency chain distinct from typical lagged Fibonacci generators. Fast and simple, but not cryptographically secure.";
      this.inventor = "Donald Knuth";
      this.year = 1997;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Knuth: The Art of Computer Programming Vol. 2, Section 3.2.2",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "Wikipedia: Linear Congruential Generator (Related Algorithm)",
          "https://en.wikipedia.org/wiki/Linear_congruential_generator"
        ),
        new LinkItem(
          "C# Reference Implementation",
          "https://github.com/Hawkynt/Randomizer"
        )
      ];

      this.references = [
        new LinkItem(
          "SplitMix64 (used for state initialization)",
          "https://prng.di.unimi.it/splitmix64.c"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors verified against C# reference implementation
      // State initialized with SplitMix64 using specified seed
      // Default order = 12 (state array size = 13)
      this.tests = [
        {
          text: "ACRNG order=12, implicit modulo (2^64), seed=0: First 8 outputs (64 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          order: 12,
          modulo: null, // implicit modulo (2^64)
          outputSize: 64, // 8 uint64 values × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "80DE6C41FF947F83" + // Output 1
            "23ADA7AB849C1F4D" + // Output 2
            "1829D6C3D6599998" + // Output 3
            "3834669E0759A381" + // Output 4
            "20FA987227AD02F2" + // Output 5
            "58C87338A1C8FE2C" + // Output 6
            "E59E98A337CFE905" + // Output 7
            "19AA71A2997F1E74"   // Output 8
          )
        },
        {
          text: "ACRNG order=12, implicit modulo (2^64), seed=1: First 8 outputs (64 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          order: 12,
          modulo: null,
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "84E6E8AA35BDD945" + // Output 1
            "987C4DA32714A28C" + // Output 2
            "77396D87D11BCB59" + // Output 3
            "53DBF93125371BBD" + // Output 4
            "052BD52374F843B2" + // Output 5
            "4A91588A9723B6EA" + // Output 6
            "4CD40D5385A95D74" + // Output 7
            "469279F6AD4C280F"   // Output 8
          )
        },
        {
          text: "ACRNG order=12, implicit modulo (2^64), seed=42: First 8 outputs (64 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          order: 12,
          modulo: null,
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "7519C1F49DDA4850" + // Output 1
            "D8AAA63CC2AAE849" + // Output 2
            "652D5163487F134B" + // Output 3
            "DF346BF650785DE2" + // Output 4
            "E376C4DB79C67DEB" + // Output 5
            "3BDA3CFFD4BCD9B9" + // Output 6
            "E90E68A25E07F527" + // Output 7
            "1A03B3CC067A8C69"   // Output 8
          )
        },
        {
          text: "ACRNG order=12, implicit modulo (2^64), seed=1234567: First 5 outputs (40 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          order: 12,
          modulo: null,
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "5CBEFABF9C666DAE" + // Output 1
            "DFCFC7A2C85F1CEE" + // Output 2
            "695BD837C36F8092" + // Output 3
            "68479C6444F4D82B" + // Output 4
            "1D75265F5D690A31"   // Output 5
          )
        },
        {
          text: "ACRNG order=5, implicit modulo (2^64), seed=42: First 5 outputs (40 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          order: 5,
          modulo: null,
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "A48F3117D94FA0E6" + // Output 1
            "3102A4464575D185" + // Output 2
            "21BD544C486ED973" + // Output 3
            "A3BFE0962DCF51D8" + // Output 4
            "F120DE0995D56EC9"   // Output 5
          )
        },
        {
          text: "ACRNG order=12, modulo=2^31-1, seed=1: First 8 outputs (32 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          order: 12,
          modulo: OpCodes.Hex8ToBytes("7FFFFFFF"), // 2^31 - 1 = 2147483647
          outputSize: 32, // 8 uint32 values × 4 bytes
          expected: OpCodes.Hex8ToBytes(
            "3F8BAAAF" + // Output 1
            "580D3E88" + // Output 2
            "3F8EAA32" + // Output 3
            "4CEF1DA8" + // Output 4
            "7F502348" + // Output 5
            "2C470844" + // Output 6
            "1F532A98" + // Output 7
            "3A755751"   // Output 8
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
      return new ACRNGInstance(this);
    }
  }

  /**
 * ACRNG cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ACRNGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SplitMix64 constants for state initialization
      this.GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      this.MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      this.MIX_CONST_2 = 0x94D049BB133111EBn;

      // ACRNG parameters
      this._order = 12;          // Default order (state array size = order + 1)
      this._modulo = 0n;         // 0 means implicit modulo (2^64)
      this._useImplicitModulo = true;

      // Generator state
      this._state = null;        // State array (64-bit BigInt values)
      this._ready = false;       // Initialization status
    }

    /**
     * Set order parameter (state array size = order + 1)
     * Default is 12, creating a state array of 13 elements
     */
    set order(value) {
      if (value <= 0) {
        throw new Error('Order must be positive');
      }
      this._order = value;
      // Invalidate state if already initialized
      if (this._state !== null) {
        this._ready = false;
      }
    }

    get order() {
      return this._order;
    }

    /**
     * Set modulo parameter (m)
     * If modulo is null, 0, or empty, use implicit modulo (2^64)
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
     * Initialize generator with seed value (1-8 bytes)
     * State is initialized using SplitMix64 algorithm
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Initialize state array (size = order + 1)
      const stateSize = this._order + 1;
      this._state = new Array(stateSize);

      // Use SplitMix64 to initialize state
      for (let i = 0; i < stateSize; ++i) {
        const nextValue = this._splitmix64Next(seedValue);

        if (this._useImplicitModulo) {
          // No modulo - use full 64-bit values
          this._state[i] = nextValue;
        } else {
          // Apply modulo to state values
          this._state[i] = nextValue % this._modulo;
        }

        seedValue = nextValue; // Use output as next seed
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * SplitMix64 next function for state initialization
     * This matches the C# reference implementation
     */
    _splitmix64Next(z) {
      // Add golden gamma to state
      z = OpCodes.AndN(z + this.GOLDEN_GAMMA, 0xFFFFFFFFFFFFFFFFn);

      // Mix function (Stafford variant 13)
      let result = z;
      result = OpCodes.AndN(OpCodes.XorN(result, OpCodes.ShiftRn(result, 30)) * this.MIX_CONST_1, 0xFFFFFFFFFFFFFFFFn);
      result = OpCodes.AndN(OpCodes.XorN(result, OpCodes.ShiftRn(result, 27)) * this.MIX_CONST_2, 0xFFFFFFFFFFFFFFFFn);
      result = OpCodes.AndN(OpCodes.XorN(result, OpCodes.ShiftRn(result, 31)), 0xFFFFFFFFFFFFFFFFn);

      return result;
    }

    /**
     * Generate next value using ACRNG algorithm
     * Cascading addition: X[i] = (X[i-1]_new + X[i]) mod m for i = 1 to order
     * Returns X[order] as output
     */
    _next() {
      if (!this._ready) {
        throw new Error('ACRNG not initialized: set seed first');
      }

      if (this._useImplicitModulo) {
        // Implicit modulo - natural 64-bit overflow
        for (let i = 1; i < this._state.length; ++i) {
          this._state[i] = OpCodes.AndN(this._state[i - 1] + this._state[i], 0xFFFFFFFFFFFFFFFFn);
        }
      } else {
        // Explicit modulo - use UInt128 arithmetic like C#
        for (let i = 1; i < this._state.length; ++i) {
          // Add with 128-bit precision, then apply modulo
          const sum = this._state[i - 1] + this._state[i];
          this._state[i] = sum % this._modulo;
        }
      }

      // Return last element of state array
      return this._state[this._state.length - 1];
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('ACRNG not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Determine byte width based on modulo
      // If modulo is set and <= 2^32, use 32-bit output; otherwise use 64-bit
      const use32Bit = !this._useImplicitModulo && this._modulo > 0n && this._modulo <= 0x100000000n;
      const bytesPerValue = use32Bit ? 4 : 8;

      while (output.length < length) {
        const value = this._next();

        if (use32Bit) {
          // Pack as 32-bit value (big-endian)
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
      // For PRNG, Feed is typically not used (ACRNG is deterministic)
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
  const algorithmInstance = new ACRNGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ACRNGAlgorithm, ACRNGInstance };
}));
