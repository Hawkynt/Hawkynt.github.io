/*
 * Middle Square Method
 * By John von Neumann (1946)
 * Based on the C# implementation from Hawkynt Randomizer
 *
 * The Middle Square Method is one of the earliest pseudorandom number generators.
 * It works by squaring a number and extracting the middle digits as the next value.
 * Despite its historical significance, it has serious flaws including short cycles
 * and the possibility of degenerating to zero.
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

  class MiddleSquareAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Middle Square Method";
      this.description = "The Middle Square Method is one of the earliest pseudorandom number generators, invented by John von Neumann in 1946. It generates numbers by repeatedly squaring a value and extracting the middle digits. This method has serious statistical flaws including short cycles and can degenerate to zero, making it unsuitable for any practical use beyond historical study.";
      this.inventor = "John von Neumann";
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
          "Wikipedia: Middle-square method",
          "https://en.wikipedia.org/wiki/Middle-square_method"
        ),
        new LinkItem(
          "von Neumann, J.: Various techniques used in connection with random digits (1951)",
          "https://mcnp.lanl.gov/pdf_files/nbs_vonneumann.pdf"
        ),
        new LinkItem(
          "History of Random Number Generation",
          "https://www.random.org/history/"
        )
      ];

      this.references = [
        new LinkItem(
          "Applied and Computational Complex Analysis, Volume 1",
          "https://archive.org/details/appliedcomputati01henr"
        ),
        new LinkItem(
          "The Art of Computer Programming, Vol. 2: Seminumerical Algorithms",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        )
      ];

      // Test vectors computed from C# implementation behavior
      // C# implementation: state = ((UInt128)seed << 64) | ~seed
      // Then: Next() returns (ulong)((state *= state) >> 32)
      //
      // The state is initialized with:
      //   High 64 bits: seed value
      //   Low 64 bits: bitwise NOT of seed (64-bit)
      //
      // Each iteration:
      //   1. Square the 128-bit state
      //   2. Mask to 128 bits (simulating UInt128 overflow)
      //   3. Extract bits 32-63 (shift right by 32, take lower 32 bits)
      //
      // Test vectors verified against C# implementation output

      this.tests = [
        {
          text: "Middle Square: seed=5772156649 (von Neumann's example, 10-digit number from 1951 paper)",
          uri: "https://mcnp.lanl.gov/pdf_files/nbs_vonneumann.pdf",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001580C1EE9"), // 5772156649 decimal = 0x1580C1EE9
          outputSize: 40, // 10 x 4 bytes = 40 bytes (first 10 values)
          // Values: 3462435751, 1099940265, 4031481811, 229039669, 3388601729, then zeros
          expected: OpCodes.Hex8ToBytes("CE6093A7418FC1A9F04B87D30DA6DE35C9F9F5810000000000000000000000000000000000000000")
        },
        {
          text: "Middle Square: seed=1 (minimal seed, demonstrates rapid degeneration to zero)",
          uri: "https://en.wikipedia.org/wiki/Middle-square_method",
          input: null,
          seed: OpCodes.Hex8ToBytes("01"), // seed = 1
          outputSize: 40, // 10 x 4 bytes = 40 bytes (first 10 values)
          // State: (1 << 64) | ~1 = 0x0000000000000001FFFFFFFFFFFFFFFE
          // Values: all zeros after first iteration, then 1 at position 5
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000010000000000000000000000000000000000000000")
        },
        {
          text: "Middle Square: seed=12345 (short cycle demonstration)",
          uri: "https://www-cs-faculty.stanford.edu/~knuth/taocp.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("00003039"), // 12345 decimal = 0x3039
          outputSize: 40, // 10 x 4 bytes = 40 bytes
          // Values: 0, 5409351, 3528262475, 2726125526, 4221457025, then zeros
          expected: OpCodes.Hex8ToBytes("0000000000528A47D24D034BA27D5FD6FB9E52810000000000000000000000000000000000000000")
        },
        {
          text: "Middle Square: seed=675248 (historical 6-digit example from literature)",
          uri: "https://en.wikipedia.org/wiki/Middle-square_method",
          input: null,
          seed: OpCodes.Hex8ToBytes("000A4DB0"), // 675248 decimal = 0xA4DB0
          outputSize: 40, // 10 x 4 bytes = 40 bytes
          // Values: 106, 1355339473, 3971226310, 2780283383, 2493887238, 3687369022, 1710950827, 2426797792, 3673676348, 3149666597
          expected: OpCodes.Hex8ToBytes("0000006A50C8D6D1ECB41AC6A5B7C1F794A5B306DBC8C93E65FB09AB90A5FEE0DAF7DA3CBBBC1925")
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
      return new MiddleSquareInstance(this);
    }
  }

  /**
 * MiddleSquare cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MiddleSquareInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Middle Square state (using BigInt for 128-bit arithmetic)
      this._state = 0n;
      this._modulo = 0n; // Optional modulo parameter (0 means no modulo)

      // Internal state
      this._ready = false;
    }

    /**
     * Set seed value
     * Matches C# implementation: state = ((UInt128)seed left-shift 64) bitwise-OR ~seed
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to BigInt (big-endian)
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Middle Square initialization: state = (seed << 64) | ~seed
      // This matches the C# implementation's UInt128 initialization
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      const highPart = OpCodes.ShiftLn(seedValue, 64n);
      // Bitwise NOT for 64-bit: XOR with all 1s
      const lowPart = OpCodes.AndN(OpCodes.XorN(seedValue, mask64), mask64);
      this._state = OpCodes.OrN(highPart, lowPart);

      // Mask to 128-bit
      const mask128 = OpCodes.ShiftLn(1n, 128n) - 1n;
      this._state = OpCodes.AndN(this._state, mask128);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set optional modulo parameter
     * Matches C# implementation's modulo behavior
     */
    set modulo(moduloBytes) {
      if (!moduloBytes || moduloBytes.length === 0) {
        this._modulo = 0n;
        return;
      }

      // Convert modulo bytes to BigInt (big-endian)
      let moduloValue = 0n;
      for (let i = 0; i < moduloBytes.length; ++i) {
        moduloValue = OpCodes.OrN(OpCodes.ShiftLn(moduloValue, 8), BigInt(moduloBytes[i]));
      }

      this._modulo = moduloValue;
    }

    get modulo() {
      return null;
    }

    /**
     * Generate next value using Middle Square method
     * Matches C# implementation:
     * - Without modulo: state *= state; return (ulong)(state right-shift 32);
     * - With modulo: state *= state; return (ulong)(state / modulo % modulo);
     */
    _next() {
      if (!this._ready) {
        throw new Error('Middle Square not initialized: set seed first');
      }

      // Square the state
      this._state = this._state * this._state;

      // Mask to 128-bit (simulate UInt128 overflow)
      const mask128 = OpCodes.ShiftLn(1n, 128n) - 1n;
      this._state = OpCodes.AndN(this._state, mask128);

      let outputValue;

      if (this._modulo === 0n) {
        // Without modulo: extract middle 32 bits (shift right by 32)
        // This matches C#: (ulong)(state >> 32)
        outputValue = OpCodes.ShiftRn(this._state, 32n);
      } else {
        // With modulo: (state / modulo) % modulo
        // This matches C#: (ulong)(state / modulo % modulo)
        outputValue = (this._state / this._modulo) % this._modulo;
      }

      // Return as 64-bit value (but we'll pack only lower 32 bits for compatibility)
      return outputValue;
    }

    /**
     * Generate random bytes
     * Outputs values packed as 32-bit (matching C# ulong but truncated to 32-bit)
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Middle Square not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      while (output.length < length) {
        const value = this._next();

        // Pack as 32-bit value (big-endian) to match test vectors
        // Extract lower 32 bits
        const value32 = Number(OpCodes.AndN(value, 0xFFFFFFFFn));
        const bytes = OpCodes.Unpack32BE(value32);

        for (let i = 0; i < 4 && output.length < length; ++i) {
          output.push(bytes[i]);
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
      // For PRNG, Feed is typically not used (Middle Square is deterministic)
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
  const algorithmInstance = new MiddleSquareAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MiddleSquareAlgorithm, MiddleSquareInstance };
}));
