/*
 * Subtract-with-Borrow (SWB) Pseudo-Random Number Generator
 * Based on the original algorithm by George Marsaglia and Arif Zaman (1991)
 *
 * Formula: X[n] = (X[n-r] - X[n-s] - borrow) mod m
 *
 * SWB is a lagged Fibonacci generator with borrow propagation, similar to
 * hardware subtraction. The borrow bit from the previous subtraction is
 * subtracted in the next iteration. This creates very long periods with
 * minimal computational overhead.
 *
 * Standard parameters (used in this implementation):
 * - r = 4096 (lag parameter, state size)
 * - s = 63 (short lag)
 * - L = 4093 (long lag, where r-L = 3)
 * - m = 2^64 (modulus, 64-bit arithmetic)
 *
 * Period: approximately 2^(64 * 4096) ≈ 2^262144
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

  class SubtractWithBorrowAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Subtract-with-Borrow (SWB)";
      this.description = "Subtract-with-Borrow is a lagged Fibonacci generator with borrow propagation, invented by George Marsaglia and Arif Zaman in 1991. It uses the formula X[n] = (X[n-r] - X[n-s] - borrow) mod m with very long periods. Fast and memory-efficient but not cryptographically secure.";
      this.inventor = "George Marsaglia, Arif Zaman";
      this.year = 1991;
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
          "Original Paper: A New Class of Random Number Generators (1991)",
          "https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full"
        ),
        new LinkItem(
          "ResearchGate: A New Class of Random Number Generators",
          "https://www.researchgate.net/publication/38363004_A_New_Class_of_Random_Number_Generators"
        ),
        new LinkItem(
          "Wikipedia: Subtract with carry",
          "https://en.wikipedia.org/wiki/Subtract_with_carry"
        ),
        new LinkItem(
          "C++ Standard Library: std::subtract_with_carry_engine",
          "https://en.cppreference.com/w/cpp/numeric/random/subtract_with_carry_engine"
        )
      ];

      this.references = [
        new LinkItem(
          "Analysis of add-with-carry and subtract-with-borrow generators",
          "https://www.researchgate.net/publication/221529552_Analysis_of_add-with-carry_and_subtract-with-borrow_generators"
        ),
        new LinkItem(
          "On the Lattice Structure of AWC and SWB Generators",
          "https://www.researchgate.net/publication/220136420_On_the_Lattice_Structure_of_the_Add-With-Carry_and_Subtract-With-Borrow_Random_Number_Generators"
        ),
        new LinkItem(
          "A revision of the subtract-with-borrow random number generators (2017)",
          "https://arxiv.org/abs/1705.03123"
        )
      ];

      // Test vectors verified against C# reference implementation
      // Parameters: r=4096, s=63, L=4093, m=2^64
      // State initialized using SplitMix64 algorithm
      this.tests = [
        {
          text: "Seed 0: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 40, // 5 uint64 values × 8 bytes
          expected: OpCodes.Hex8ToBytes(
            "0AE12FAD109B1C4F" + // Output 1
            "2C056FC4220A91DE" + // Output 2
            "EC4507A4021B9A03" + // Output 3
            "696A25D23A3110F8" + // Output 4
            "89863A39432DA426"   // Output 5
          )
        },
        {
          text: "Seed 1: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "0A16558AA58099FF" + // Output 1
            "7D054668D25EDD7C" + // Output 2
            "EBF95BD8080AA072" + // Output 3
            "EEBA28CA7D12FA3E" + // Output 4
            "9E5D5DE2489093E8"   // Output 5
          )
        },
        {
          text: "Seed 42: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "CA13722C11AD5617" + // Output 1
            "7A83A92BD6180B4F" + // Output 2
            "00AF31BD58256800" + // Output 3
            "5355DD85A78BE3AC" + // Output 4
            "AAE02192B3F6F5C4"   // Output 5
          )
        },
        {
          text: "Seed 1234567: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "5E5E874A13CC0AD4" + // Output 1
            "0D0991C3E2BC9B05" + // Output 2
            "0C3FF517B5AC3F3D" + // Output 3
            "44BB3D0DD6F5BDCB" + // Output 4
            "FBB7439B68B88BE2"   // Output 5
          )
        },
        {
          text: "Seed 987654321: First 5 outputs (40 bytes) - SWB(4096, 63, 4093)",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000003ADE68B1"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "268B7F5CEE02DE79" + // Output 1
            "C44E6685E70D7B94" + // Output 2
            "C080778ED8A1656D" + // Output 3
            "A915AF8BC016F7CD" + // Output 4
            "189C9CCCB3C90502"   // Output 5
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new SubtractWithBorrowInstance(this);
    }
  }

  class SubtractWithBorrowInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SplitMix64 constants for state initialization
      this.GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      this.MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      this.MIX_CONST_2 = 0x94D049BB133111EBn;

      // SWB parameters (standard configuration)
      this.M = 0xFFFFFFFFFFFFFFFFn; // ulong.MaxValue = 2^64 - 1 (matches C# const)
      this.S = 63;    // Short lag
      this.L = 4093;  // Long lag
      this.R = 4096;  // State size (lag parameter r)

      // Generator state
      this._state = null;         // State array (64-bit BigInt values)
      this._carry = 0n;           // Borrow bit
      this._index = 0;            // Current position in circular buffer
      this._ready = false;        // Initialization status
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
      this._state = new Array(this.R);
      for (let i = 0; i < this.R; ++i) {
        this._state[i] = this._splitmix64Next(seedValue);
        seedValue = this._state[i]; // Use output as next seed
      }

      // Initialize carry using one more SplitMix64 iteration
      this._carry = this._splitmix64Next(seedValue);

      // Start at position R-1 (same as C# reference implementation)
      this._index = this.R - 1;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * SplitMix64 next function for state initialization
     * This matches the C# reference implementation exactly
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
     * Generate next 64-bit value using Subtract-with-Borrow recurrence
     * X[n] = (X[n-r] - X[n-s] - borrow) mod m
     *
     * C# reference:
     * var index = (this._index + 1) % R;
     * var j = (index + R - S) % R;
     * var k = (index + R - L) % R;
     * var t = (Int128)state[j] - state[k] - this._carry;
     * this._carry = t < 0 ? 1UL : 0UL;
     * if (t < 0) t += M;
     * state[index] = (ulong)t;
     * this._index = index;
     * return (ulong)t;
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Subtract-with-Borrow not initialized: set seed first');
      }

      // Advance index (circular buffer)
      const index = (this._index + 1) % this.R;

      // Calculate lagged indices
      const j = (index + this.R - this.S) % this.R;
      const k = (index + this.R - this.L) % this.R;

      // Perform subtraction with borrow: t = state[j] - state[k] - carry
      // Using signed arithmetic to detect negative results (matches C# Int128 behavior)
      let t = this._state[j] - this._state[k] - this._carry;

      // Update carry: if result is negative, set carry to 1, otherwise 0
      // This matches C#: this._carry = t < 0 ? 1UL : 0UL;
      this._carry = t < 0n ? 1n : 0n;

      // If negative, add M (ulong.MaxValue = 2^64-1)
      // This matches C#: if (t < 0) t += M;
      // Example: t = -1421721706374129148 becomes:
      //          -1421721706374129148 + (2^64-1) = 17025022367335422467
      if (t < 0n) {
        t += this.M;
      }

      // Ensure result is within 64-bit range (0..2^64-1)
      // After adding M to negative values, result is already in range
      t = OpCodes.AndN(t, 0xFFFFFFFFFFFFFFFFn);

      // Store result in state array
      this._state[index] = t;

      // Update index for next iteration
      this._index = index;

      return t;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Subtract-with-Borrow not initialized: set seed first');
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
    Feed(data) {
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic SWB - would require mixing
      // For now, Feed is a no-op (SWB is deterministic)
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
  const algorithmInstance = new SubtractWithBorrowAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SubtractWithBorrowAlgorithm, SubtractWithBorrowInstance };
}));
