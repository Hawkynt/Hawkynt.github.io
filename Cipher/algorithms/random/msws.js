/*
 * Middle Square Weyl Sequence (MSWS) Random Number Generator
 * Invented by Bernard Widynski (2017)
 *
 * MSWS is a significant improvement over John von Neumann's 1949 Middle Square method.
 * It addresses the historic shortcomings (short cycles, zero states) by adding a Weyl
 * sequence counter with a carefully chosen increment. This creates a full-period generator
 * with excellent statistical properties.
 *
 * The algorithm:
 * 1. Square the current state (128-bit result from 64-bit multiplication)
 * 2. Add Weyl sequence counter (incremented by golden ratio-derived constant)
 * 3. Extract middle 64 bits as output
 * 4. Use full 128-bit result as next state
 *
 * State: 128 bits (x) + 64 bits (w)
 * Output: Middle 64 bits of x
 * Period: 2^64 (from Weyl sequence)
 * Weyl constant: 0xB5AD4ECEDA1CE2A9 (derived from golden ratio phi)
 *
 * Reference: Widynski, B. (2017). "Middle Square Weyl Sequence RNG". arXiv:1704.00358
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

  class MiddleSquareWeylSequenceAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Middle Square Weyl Sequence";
      this.description = "MSWS is a modern improvement of von Neumann's 1949 Middle Square method. By adding a Weyl sequence with a golden ratio-derived increment, it achieves full period and passes statistical tests. The algorithm squares a 64-bit state, adds the Weyl counter, and extracts the middle 64 bits.";
      this.inventor = "Bernard Widynski";
      this.year = 2017;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Middle Square Weyl Sequence RNG (Widynski, 2017)",
          "https://arxiv.org/abs/1704.00358"
        ),
        new LinkItem(
          "arXiv PDF",
          "https://arxiv.org/pdf/1704.00358.pdf"
        ),
        new LinkItem(
          "Wikipedia: Middle Square Method",
          "https://en.wikipedia.org/wiki/Middle-square_method"
        ),
        new LinkItem(
          "Rosetta Code: MSWS Implementations",
          "https://rosettacode.org/wiki/Middle-square_method"
        )
      ];

      this.references = [
        new LinkItem(
          "Original Middle Square Method (von Neumann, 1949)",
          "https://mcnp.lanl.gov/pdf_files/nbs_vonneumann.pdf"
        ),
        new LinkItem(
          "PractRand Statistical Testing Suite",
          "http://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors verified against C# reference implementation
      // This matches the C# implementation in the Hawkynt Randomizer project
      // Weyl constant: 0xB5AD4ECEDA1CE2A9 (from golden ratio)
      // Seed initialization: state = (seed << 64) | ~seed, weyl = 0
      // Output: Middle 64 bits from 128-bit state (state >> 32)
      // Reference: C# MiddleSquareWeylSequence.cs implementation
      this.tests = [
        {
          text: "Seed 0: First output - C# reference implementation",
          uri: "https://arxiv.org/abs/1704.00358",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("FFFFFFFEB5AD4ECE")
        },
        {
          text: "Seed 1: First 5 outputs (40 bytes) - C# reference implementation",
          uri: "https://arxiv.org/abs/1704.00358",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "FFFFFFF8B5AD4ECE" +  // Output 1
            "7A742CD0C5A00D5A" +  // Output 2
            "193D8A560760F364" +  // Output 3
            "C9207C7C8F3CC60E" +  // Output 4
            "71E0D56832C88399"    // Output 5
          )
        },
        {
          text: "Seed 2: First 3 outputs - Additional verification",
          uri: "https://arxiv.org/abs/1704.00358",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000002"),
          outputSize: 24,
          expected: OpCodes.Hex8ToBytes(
            "FFFFFFEEB5AD4ECE" +  // Output 1
            "7032769FDE65216F" +  // Output 2
            "E7DD025969677BE9"    // Output 3
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
      return new MiddleSquareWeylSequenceInstance(this);
    }
  }

  /**
 * MiddleSquareWeylSequence cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MiddleSquareWeylSequenceInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MSWS uses 128-bit state (x) and 64-bit Weyl counter (w)
      // Using BigInt for accurate 128-bit arithmetic
      this._state = 0n;  // 128-bit state
      this._weyl = 0n;   // 64-bit Weyl counter
      this._weylConstant = 0xB5AD4ECEDA1CE2A9n; // Golden ratio derived constant
      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     * Seed initialization: state = (seed << 64) | ~seed, weyl = 0
     * This ensures the initial state is 128 bits with good mixing
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian)
      let seed64 = 0n;
      for (let i = 0; i < Math.min(seedBytes.length, 8); ++i) {
        seed64 = (seed64 << 8n) | BigInt(seedBytes[i] & 0xFF);
      }

      // Initialize state as per MSWS specification: state = (seed << 64) | ~seed
      // This creates a 128-bit state where upper 64 bits = seed, lower 64 bits = bitwise NOT of seed
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      const upperBits = seed64 << 64n;
      const lowerBits = (~seed64) & mask64;
      this._state = upperBits | lowerBits;

      // Initialize Weyl counter to 0
      this._weyl = 0n;

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit value using MSWS algorithm
     *
     * Algorithm from Widynski (2017):
     * 1. x *= x              (square state, produces 128-bit result)
     * 2. w += weyl_constant  (increment Weyl sequence)
     * 3. x += w              (add Weyl counter to state)
     * 4. return x >> 32      (extract middle 64 bits)
     *
     * Note: All state is maintained at full 128-bit precision
     */
    _next64() {
      if (!this._ready) {
        throw new Error('MSWS not initialized: set seed first');
      }

      // Step 1: Square the state (128-bit * 128-bit = 256-bit, but we keep lower 128 bits)
      const mask128 = (1n << 128n) - 1n;
      this._state = (this._state * this._state) & mask128;

      // Step 2: Increment Weyl counter (mod 2^64)
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      this._weyl = (this._weyl + this._weylConstant) & mask64;

      // Step 3: Add Weyl counter to state
      this._state = (this._state + this._weyl) & mask128;

      // Step 4: Extract middle 64 bits (bits 32-95 of the 128-bit state)
      // This is equivalent to: (state >> 32) & 0xFFFFFFFFFFFFFFFF
      const output = (this._state >> 32n) & mask64;

      return output;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('MSWS not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 64-bit value
        const value = this._next64();

        // Extract bytes (big-endian order)
        const bytesToExtract = Math.min(bytesRemaining, 8);

        for (let i = 0; i < bytesToExtract; ++i) {
          // Extract from most significant byte first (big-endian)
          const shift = BigInt((7 - i) * 8);
          const byte = Number((value >> shift) & 0xFFn);
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
      // For PRNG, Feed is not used (state is determined by seed and sequence)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors
      if (this._skip && this._skip > 0) {
        // Skip the specified number of 64-bit outputs
        for (let i = 0; i < this._skip; ++i) {
          this._next64();
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
  const algorithmInstance = new MiddleSquareWeylSequenceAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MiddleSquareWeylSequenceAlgorithm, MiddleSquareWeylSequenceInstance };
}));
