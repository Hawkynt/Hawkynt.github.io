/*
 * Squares Counter-Based Pseudo-Random Number Generator
 * Bernard Widynski (2020)
 *
 * A fast counter-based implementation of von Neumann's middle-square method.
 * Applies multiple rounds of squaring to a counter to produce random output.
 *
 * Key features:
 * - Counter-based (stateless, pure function of counter+key)
 * - Trivially parallelizable (any counter can be computed independently)
 * - Fast: competitive with or faster than other counter-based PRNGs
 * - Passes stringent statistical randomness tests (BigCrush, PractRand)
 * - Based on modernizing von Neumann's classic middle-square method
 *
 * Reference: "Squares: A Fast Counter-Based RNG"
 * Bernard Widynski
 * arXiv:2004.06278, April 2020
 *
 * This implementation uses the key from FlorisSteenkamp's reference implementation:
 * key = 0xea3742c76bf95d47
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

  // 64-bit mask for proper wrapping (JavaScript BigInt arithmetic)
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  /**
   * Squares RNG core algorithm (32-bit output, 3-round version)
   * Based on arXiv:2004.06278 Algorithm 1
   *
   * @param {bigint} counter - 64-bit counter value
   * @param {bigint} key - 64-bit key value
   * @returns {number} 32-bit random output
   */
  function squares32(counter, key) {
    let x, y, z;

    // Initialize: y = x = counter * key (mod 2^64)
    y = x = (counter * key)&MASK64;
    z = (y + key)&MASK64;

    // Round 1: x = (x*x + y) mod 2^64, then swap upper/lower 32 bits
    x = ((x * x)&MASK64) + y&MASK64;
    x = OpCodes.OrN((x >> 32n), (x << 32n))&MASK64;

    // Round 2: x = (x*x + z) mod 2^64, then swap upper/lower 32 bits
    x = ((x * x)&MASK64) + z&MASK64;
    x = OpCodes.OrN((x >> 32n), (x << 32n))&MASK64;

    // Round 3: x = (x*x + y) mod 2^64, output upper 32 bits
    x = ((x * x)&MASK64) + y&MASK64;
    return Number((x >> 32n)&0xFFFFFFFFn);
  }

  /**
   * Squares RNG 4-round version (32-bit output, enhanced quality)
   * Based on arXiv:2004.06278 Algorithm 2
   *
   * @param {bigint} counter - 64-bit counter value
   * @param {bigint} key - 64-bit key value
   * @returns {number} 32-bit random output
   */
  function squares32_4round(counter, key) {
    let x, y, z;

    y = x = (counter * key)&MASK64;
    z = (y + key)&MASK64;

    // Round 1
    x = ((x * x)&MASK64) + y&MASK64;
    x = OpCodes.OrN((x >> 32n), (x << 32n))&MASK64;

    // Round 2
    x = ((x * x)&MASK64) + z&MASK64;
    x = OpCodes.OrN((x >> 32n), (x << 32n))&MASK64;

    // Round 3
    x = ((x * x)&MASK64) + y&MASK64;
    x = OpCodes.OrN((x >> 32n), (x << 32n))&MASK64;

    // Round 4: output upper 32 bits
    x = ((x * x)&MASK64) + z&MASK64;
    return Number((x >> 32n)&0xFFFFFFFFn);
  }

  class SquaresAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Squares";
      this.description = "Fast counter-based PRNG using multiple rounds of squaring, modernizing von Neumann's middle-square method. Trivially parallelizable with competitive performance, passing BigCrush and PractRand statistical tests.";
      this.inventor = "Bernard Widynski";
      this.year = 2020;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Counter-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null; // Country not specified in paper

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.IsCounterBased = true;
      this.SupportedKeySizes = [new KeySize(8, 8, 1)]; // 64-bit key

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Squares: A Fast Counter-Based RNG (arXiv:2004.06278, 2020)",
          "https://arxiv.org/abs/2004.06278"
        ),
        new LinkItem(
          "Paper PDF (arXiv v3)",
          "https://arxiv.org/pdf/2004.06278v3.pdf"
        ),
        new LinkItem(
          "HTML Version (ar5iv)",
          "https://ar5iv.labs.arxiv.org/html/2004.06278"
        )
      ];

      this.references = [
        new LinkItem(
          "Reference Implementation: FlorisSteenkamp/squares-rng (TypeScript/WebAssembly)",
          "https://github.com/FlorisSteenkamp/squares-rng"
        ),
        new LinkItem(
          "BigCrush Statistical Test Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "PractRand Statistical Test Suite",
          "http://pracrand.sourceforge.net/"
        )
      ];

      // Test vectors verified against FlorisSteenkamp reference implementation
      // Using key = 0xea3742c76bf95d47 (from reference implementation)
      this.tests = [
        {
          text: "Squares 3-round: counter=0, key=0xea3742c76bf95d47 - FlorisSteenkamp reference",
          uri: "https://github.com/FlorisSteenkamp/squares-rng",
          input: OpCodes.Hex8ToBytes("0000000000000000"), // counter = 0 (LE)
          key: OpCodes.Hex8ToBytes("475df96bc74237ea"), // key = 0xea3742c76bf95d47 (LE)
          outputSize: 4,
          // squares(0) = 680702563 = 0x2892b263 (LE: 63 b2 92 28)
          expected: OpCodes.Hex8ToBytes("63b29228")
        },
        {
          text: "Squares 3-round: counter=1, key=0xea3742c76bf95d47",
          uri: "https://github.com/FlorisSteenkamp/squares-rng",
          input: OpCodes.Hex8ToBytes("0100000000000000"),
          key: OpCodes.Hex8ToBytes("475df96bc74237ea"),
          outputSize: 4,
          // squares(1) = 3634619202 = 0xd8a3e342
          expected: OpCodes.Hex8ToBytes("42e3a3d8")
        },
        {
          text: "Squares 3-round: counter=100, key=0xea3742c76bf95d47 - Known test vector",
          uri: "https://github.com/FlorisSteenkamp/squares-rng",
          input: OpCodes.Hex8ToBytes("6400000000000000"),
          key: OpCodes.Hex8ToBytes("475df96bc74237ea"),
          outputSize: 4,
          // squares(100) = 1083911291 = 0x409b2c7b
          expected: OpCodes.Hex8ToBytes("7b2c9b40")
        },
        {
          text: "Squares 3-round: counter=42, key=0xea3742c76bf95d47",
          uri: "https://github.com/FlorisSteenkamp/squares-rng",
          input: OpCodes.Hex8ToBytes("2a00000000000000"),
          key: OpCodes.Hex8ToBytes("475df96bc74237ea"),
          outputSize: 4,
          // squares(42) = 617392249 = 0x24cca879
          expected: OpCodes.Hex8ToBytes("79a8cc24")
        },
        {
          text: "Squares 3-round: counter=0xFFFFFFFF, key=0xea3742c76bf95d47 - Max 32-bit counter",
          uri: "https://github.com/FlorisSteenkamp/squares-rng",
          input: OpCodes.Hex8ToBytes("ffffffff00000000"),
          key: OpCodes.Hex8ToBytes("475df96bc74237ea"),
          outputSize: 4,
          // squares(0xFFFFFFFF) = 1129210057 = 0x434e60c9
          expected: OpCodes.Hex8ToBytes("c9604e43")
        },
        {
          text: "Squares 3-round: counter=12345, key=0xea3742c76bf95d47",
          uri: "https://github.com/FlorisSteenkamp/squares-rng",
          input: OpCodes.Hex8ToBytes("3930000000000000"),
          key: OpCodes.Hex8ToBytes("475df96bc74237ea"),
          outputSize: 4,
          // squares(12345) = 3264118160 = 0xc28e7d90
          expected: OpCodes.Hex8ToBytes("907d8ec2")
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
        return null; // Counter-based PRNGs have no inverse operation
      }
      return new SquaresInstance(this);
    }
  }

  /**
 * Squares cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SquaresInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Default key from FlorisSteenkamp reference implementation
      // This key was chosen to have good statistical properties
      this._defaultKey = 0xea3742c76bf95d47n;

      // 64-bit key (stored as BigInt)
      this._key = this._defaultKey;
      this._ready = true; // Ready by default with default key

      // 64-bit counter (stored as BigInt)
      this._counter = 0n;

      // Buffer for partial output
      this._buffer = [];
      this._bufferPos = 0;

      // Use 3-round version by default (faster, sufficient for most uses)
      this._rounds = 3;
    }

    /**
     * Set key value (8 bytes = 64-bit, little-endian)
     */
    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        // Reset to default key
        this._key = this._defaultKey;
        this._ready = true;
        return;
      }

      if (keyBytes.length !== 8) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 8 bytes)`);
      }

      // Parse as little-endian 64-bit BigInt
      this._key = 0n;
      for (let i = 0; i < 8; ++i) {
        this._key = OpCodes.OrN(this._key, BigInt(keyBytes[i]) << BigInt(i * 8));
      }

      this._ready = true;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return null; // Cannot retrieve key
    }

    /**
     * Set counter value (8 bytes = 64-bit, little-endian)
     * For counter-based PRNGs, the "seed" is the initial counter value
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._counter = 0n;
        return;
      }

      if (seedBytes.length !== 8) {
        throw new Error(`Invalid counter size: ${seedBytes.length} bytes (expected 8 bytes)`);
      }

      // Parse as little-endian 64-bit BigInt
      this._counter = 0n;
      for (let i = 0; i < 8; ++i) {
        this._counter = OpCodes.OrN(this._counter, BigInt(seedBytes[i]) << BigInt(i * 8));
      }

      // Clear buffer when counter changes
      this._buffer = [];
      this._bufferPos = 0;
    }

    get seed() {
      return null; // Cannot retrieve seed/counter
    }

    /**
     * Set number of rounds (3 or 4)
     */
    set rounds(numRounds) {
      if (numRounds !== 3 && numRounds !== 4) {
        throw new Error(`Invalid rounds: ${numRounds} (expected 3 or 4)`);
      }
      this._rounds = numRounds;
    }

    get rounds() {
      return this._rounds;
    }

    /**
     * Generate one 32-bit value from current counter
     */
    _generateValue() {
      if (!this._ready) {
        throw new Error('Squares not initialized: set key first');
      }

      let result;
      if (this._rounds === 4) {
        result = squares32_4round(this._counter, this._key);
      } else {
        result = squares32(this._counter, this._key);
      }

      // Increment counter for next generation
      this._counter = (this._counter + 1n)&MASK64;

      return result;
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Squares not initialized: set key first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let remaining = length;

      // Use buffered bytes first
      while (this._bufferPos < this._buffer.length && remaining > 0) {
        output.push(this._buffer[this._bufferPos++]);
        --remaining;
      }

      // Generate new values as needed
      while (remaining > 0) {
        // Generate one 32-bit value
        const value = this._generateValue();

        // Convert to bytes (little-endian)
        this._buffer = OpCodes.Unpack32LE(value);
        this._bufferPos = 0;

        const bytesToCopy = Math.min(remaining, this._buffer.length);
        for (let i = 0; i < bytesToCopy; ++i) {
          output.push(this._buffer[this._bufferPos++]);
        }
        remaining -= bytesToCopy;
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
      // For counter-based PRNG, Feed sets the counter/seed
      if (data && data.length > 0) {
        this.seed = data;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const size = this._outputSize || 4; // Default to one 32-bit value
      return this.NextBytes(size);
    }

    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 4;
    }
  }

  // Register algorithm
  const algorithmInstance = new SquaresAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SquaresAlgorithm, SquaresInstance };
}));
