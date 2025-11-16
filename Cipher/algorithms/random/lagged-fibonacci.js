/*
 * Lagged Fibonacci Generator (LFG)
 * Based on the generalized Fibonacci recurrence relation
 * X[n] = (X[n-j] ⊙ X[n-k]) mod m
 * where ⊙ is an operation (addition, subtraction, multiplication, or XOR)
 *
 * Common lag pairs (j, k):
 * - (55, 24) - Used in Knuth's TAOCP, period ~2^55
 * - (100, 37) - Knuth's 2002 TAOCP version, period ~2^129
 * - (97, 33) - Alternative with good properties
 * - (250, 103) - Longer period variant
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

  class LaggedFibonacciAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lagged Fibonacci Generator";
      this.description = "The Lagged Fibonacci Generator is a pseudo-random number generator based on the generalized Fibonacci recurrence X[n] = (X[n-j] ⊙ X[n-k]) mod m. Commonly uses additive or subtractive operations with lags like (55,24) or (100,37). Fast and widely used but not cryptographically secure.";
      this.inventor = "Donald Knuth (TAOCP popularization)";
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
          "The Art of Computer Programming Vol. 2 (TAOCP) Section 3.6",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "Knuth FLRNG Reference Implementation (Fortran)",
          "https://github.com/marcoxa/Knuth-FLRNG"
        ),
        new LinkItem(
          "Wikipedia: Lagged Fibonacci Generator",
          "https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      this.references = [
        new LinkItem(
          "Parallel Additive Lagged-Fibonacci Random Number Generators (1995)",
          "https://dl.acm.org/doi/pdf/10.1145/237578.237591"
        ),
        new LinkItem(
          "R Documentation: RNG (uses Lagged Fibonacci)",
          "https://stat.ethz.ch/R-manual/R-devel/library/base/html/Random.html"
        )
      ];

      // Test vectors verified against C# reference implementation
      // Using additive mode with lags (55, 24) - classic Knuth TAOCP configuration
      // State seeded using SplitMix64 algorithm
      this.tests = [
        {
          text: "Additive LFG(56,0,31) with seed 0: First 8 outputs (64 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          operationMode: "additive",
          stateSize: 56,
          shortLag: 0,
          longLag: 31,
          outputSize: 64, // 8 uint64 values × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "6E2B270F55BBD9CB" + // Output 1
            "BE8F229A0FF0FD69" + // Output 2
            "8A430423D94979B1" + // Output 3
            "D766FCBC25827CFA" + // Output 4
            "50BFB1219B6256E6" + // Output 5
            "8CDBB5A71ADE3D8B" + // Output 6
            "EF555E79AC7F597D" + // Output 7
            "883DEADF8941FD1B"   // Output 8
          )
        },
        {
          text: "Additive LFG(56,0,31) with seed 1: First 5 outputs (40 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          operationMode: "additive",
          stateSize: 56,
          shortLag: 0,
          longLag: 31,
          outputSize: 40, // 5 uint64 values × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "2B440A8129B79EDD" + // Output 1
            "E2179FE86C5AB5AF" + // Output 2
            "E080F26C03D0EB10" + // Output 3
            "A10AA381F5B9F82D" + // Output 4
            "936BE653BD04CD1A"   // Output 5
          )
        },
        {
          text: "Subtractive LFG(56,0,31) with seed 42: First 5 outputs (40 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          operationMode: "subtractive",
          stateSize: 56,
          shortLag: 0,
          longLag: 31,
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "5D1E3EB40AAEA7BA" + // Output 1
            "3E7E3396389D12F7" + // Output 2
            "3EF9FE630D996AAD" + // Output 3
            "EDFB62F25C34A10A" + // Output 4
            "5532868CAB023E14"   // Output 5
          )
        },
        {
          text: "XOR LFG(56,0,31) with seed 1234567: First 5 outputs (40 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          operationMode: "xor",
          stateSize: 56,
          shortLag: 0,
          longLag: 31,
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "66F0D01C5164976D" + // Output 1
            "5268A9A206681B44" + // Output 2
            "8116E1454F567576" + // Output 3
            "E04C5DB1B8743592" + // Output 4
            "400AFD37D1CC0A8D"   // Output 5
          )
        },
        {
          text: "Multiplicative LFG(56,0,31) with seed 42: First 5 outputs (40 bytes)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          operationMode: "multiplicative",
          stateSize: 56,
          shortLag: 0,
          longLag: 31,
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "49A85F3E89DAD777" + // Output 1
            "781C458423F14634" + // Output 2
            "25EEB35E0F4788D6" + // Output 3
            "6D99B848395ACFAB" + // Output 4
            "801D649C534714AC"   // Output 5
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
      return new LaggedFibonacciInstance(this);
    }
  }

  /**
 * LaggedFibonacci cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LaggedFibonacciInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SplitMix64 constants for state initialization
      this.GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      this.MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      this.MIX_CONST_2 = 0x94D049BB133111EBn;

      // Lagged Fibonacci parameters
      this._stateSize = 56;      // Default state size (55 lags + 1)
      this._shortLag = 0;        // Default short lag (j)
      this._longLag = 31;        // Default long lag (k) - common (55,24) becomes (0,31) in circular buffer
      this._operationMode = "additive"; // Default operation: additive, subtractive, multiplicative, xor

      // Generator state
      this._state = null;        // State array (64-bit BigInt values)
      this._index = 0;           // Current position in circular buffer
      this._ready = false;       // Initialization status
    }

    /**
     * Set state size (default 56 for classic 55-lag configuration)
     */
    set stateSize(size) {
      if (size <= 0) {
        throw new Error('State size must be positive');
      }
      this._stateSize = size;
      // Only invalidate if already initialized
      if (this._state !== null) {
        this._ready = false;
      }
    }

    get stateSize() {
      return this._stateSize;
    }

    /**
     * Set short lag (j in X[n-j])
     */
    set shortLag(lag) {
      if (lag < 0 || lag >= this._stateSize) {
        throw new Error(`Short lag must be between 0 and ${this._stateSize - 1}`);
      }
      this._shortLag = lag;
    }

    get shortLag() {
      return this._shortLag;
    }

    /**
     * Set long lag (k in X[n-k])
     */
    set longLag(lag) {
      if (lag <= this._shortLag || lag >= this._stateSize) {
        throw new Error(`Long lag must be between ${this._shortLag + 1} and ${this._stateSize - 1}`);
      }
      this._longLag = lag;
    }

    get longLag() {
      return this._longLag;
    }

    /**
     * Set operation mode: "additive", "subtractive", "multiplicative", "xor"
     */
    set operationMode(mode) {
      const validModes = ["additive", "subtractive", "multiplicative", "xor"];
      if (!validModes.includes(mode.toLowerCase())) {
        throw new Error(`Invalid operation mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
      }
      this._operationMode = mode.toLowerCase();
    }

    get operationMode() {
      return this._operationMode;
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

      // Initialize state array using SplitMix64
      this._state = new Array(this._stateSize);
      for (let i = 0; i < this._stateSize; ++i) {
        this._state[i] = this._splitmix64Next(seedValue);
        seedValue = this._state[i]; // Use output as next seed
      }

      this._index = 0;
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
     * Generate next 64-bit value using Lagged Fibonacci recurrence
     * X[n] = (X[n-j] ⊙ X[n-k]) mod 2^64
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Lagged Fibonacci Generator not initialized: set seed first');
      }

      // Calculate indices for lagged values (circular buffer)
      const length = this._state.length;
      const index = this._index;

      let shortIndex = index - this._shortLag;
      if (shortIndex < 0) {
        shortIndex += length;
      }

      let longIndex = index - this._longLag;
      if (longIndex < 0) {
        longIndex += length;
      }

      // Get lagged values
      const a = this._state[shortIndex];
      const b = this._state[longIndex];

      // Apply operation based on mode
      let result;
      switch (this._operationMode) {
        case "additive":
          result = OpCodes.AndN(a + b, 0xFFFFFFFFFFFFFFFFn);
          break;
        case "subtractive":
          result = OpCodes.AndN(a - b, 0xFFFFFFFFFFFFFFFFn);
          break;
        case "multiplicative":
          result = OpCodes.AndN(a * b, 0xFFFFFFFFFFFFFFFFn);
          break;
        case "xor":
          result = OpCodes.XorN(a, b);
          break;
        default:
          throw new Error(`Invalid operation mode: ${this._operationMode}`);
      }

      // Store result in state array
      this._state[index] = result;

      // Advance index (circular)
      this._index = (index + 1) % length;

      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Lagged Fibonacci Generator not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 64-bit value
        const value = this._next64();

        // Extract bytes (big-endian order - most significant byte first)
        const bytesToExtract = Math.min(bytesRemaining, 8);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, (7 - i) * 8), 0xFFn));
          output.push(byte);
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
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic Lagged Fibonacci - would require mixing
      // For now, Feed is a no-op (Lagged Fibonacci is deterministic)
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
  const algorithmInstance = new LaggedFibonacciAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LaggedFibonacciAlgorithm, LaggedFibonacciInstance };
}));
