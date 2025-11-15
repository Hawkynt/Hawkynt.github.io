/*
 * Knuth-B (shuffle_order_engine)
 * Algorithm B from Donald Knuth's The Art of Computer Programming
 * Implemented as shuffle_order_engine<minstd_rand0, 256> in C++ standard library
 *
 * A shuffle algorithm that wraps a base linear congruential generator (minstd_rand0)
 * with a 256-entry shuffle table to improve randomness quality. The shuffle table
 * stores previously generated values and uses new LCG outputs to select which
 * table entry to return, breaking up sequential correlations.
 *
 * Base engine: minstd_rand0 (Lehmer) with a=16807, m=2^31-1
 * Table size: 256 entries
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

  // minstd_rand0 constants (Lehmer PRNG base engine)
  const MULTIPLIER = 16807;      // a = 7^5
  const MODULUS = 2147483647;    // m = 2^31 - 1 (Mersenne prime M31)
  const QUOTIENT = 127773;       // q = m div a
  const REMAINDER = 2836;        // r = m mod a

  // Shuffle table size
  const TABLE_SIZE = 256;

  class KnuthBAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Knuth-B";
      this.description = "Algorithm B from Knuth's The Art of Computer Programming, Volume 2. Implements a shuffle algorithm that wraps the minstd_rand0 linear congruential generator with a 256-entry table to improve randomness by breaking sequential correlations. Used in C++ standard library as shuffle_order_engine<minstd_rand0, 256>.";
      this.inventor = "Donald Knuth";
      this.year = 1969;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Shuffle Algorithm";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(4, 4, 1)]; // 32-bit seed (1 to 2^31-2)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Knuth: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms), Section 3.2.2",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "C++ Reference: std::shuffle_order_engine",
          "https://en.cppreference.com/w/cpp/numeric/random/shuffle_order_engine"
        ),
        new LinkItem(
          "C++ Reference: std::knuth_b",
          "https://en.cppreference.com/w/cpp/numeric/random/knuth_b"
        )
      ];

      this.references = [
        new LinkItem(
          "The Art of Computer Programming, Volume 2 (3rd Edition, 1997)",
          "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
        ),
        new LinkItem(
          "C++ Standard Library Implementation (libstdc++)",
          "https://gcc.gnu.org/onlinedocs/libstdc++/manual/numerics.html#std.numerics.random"
        ),
        new LinkItem(
          "Park and Miller: Random Number Generators: Good Ones Are Hard to Find",
          "https://doi.org/10.1145/63039.63042"
        )
      ];

      // Test vectors from C++ std::knuth_b reference implementation
      // Verified against GCC libstdc++ shuffle_order_engine<minstd_rand0, 256>
      this.tests = [
        {
          text: "C++ std::knuth_b with seed=1, first 10 values",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/knuth_b",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          outputSize: 40, // 10 × 4 bytes = 40 bytes
          expected: OpCodes.Hex8ToBytes("09189C643113C3982278FD06795056C43BD814D710B1D72C061351336A5D128C38532FD146FC9A81")
          // Decimal values: 152607844, 823378840, 578354438, 2035308228, 1004016855,
          //                 280090412, 101929267, 1784484492, 944975825, 1190959745
        },
        {
          text: "C++ std::knuth_b canonical test: 10,000th value from seed=1 = 1112339016",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/knuth_b",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"), // seed = 1
          count: 10000, // Generate 10,000 values
          outputSize: 4, // Return only the 10,000th value
          expected: OpCodes.Hex8ToBytes("424CF248") // 1112339016 (C++ std::knuth_b test value)
        },
        {
          text: "C++ std::knuth_b with seed=123456789, first 5 values",
          uri: "https://en.cppreference.com/w/cpp/numeric/random/knuth_b",
          input: null,
          seed: OpCodes.Hex8ToBytes("075BCD15"), // seed = 123456789
          outputSize: 20, // 5 × 4 bytes
          expected: OpCodes.Hex8ToBytes("704F3A22744474F72DE9C635557BD4A46C9E4484")
          // Decimal: 1884240418, 1950643447, 770295349, 1434178724, 1822311556
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new KnuthBInstance(this);
    }
  }

  class KnuthBInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Base minstd_rand0 (Lehmer) state
      this._state = 1;

      // Shuffle table (256 entries)
      this._table = new Array(TABLE_SIZE);

      // Current table index for next output
      this._y = 0;

      // Ready flag
      this._ready = false;

      // Optional count for skipping ahead to nth value
      this._skipCount = null;
    }

    /**
     * minstd_rand0 next value using Schrage's method
     * This is the base engine that fills the shuffle table
     */
    _nextBase() {
      // Schrage's method to compute (16807 × state) mod 2147483647
      const hi = (this._state / QUOTIENT) | 0;
      const lo = this._state % QUOTIENT;

      let test = MULTIPLIER * lo - REMAINDER * hi;

      if (test > 0) {
        this._state = test;
      } else {
        this._state = test + MODULUS;
      }

      return this._state;
    }

    /**
     * Initialize shuffle table with base engine values
     */
    _initializeTable() {
      // Fill table with initial values from base engine
      for (let i = 0; i < TABLE_SIZE; ++i) {
        this._table[i] = this._nextBase();
      }

      // Initialize y with one more base engine value
      this._y = this._nextBase();
    }

    /**
     * Set seed value (must be 1 to 2147483646)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 32-bit integer (big-endian) using OpCodes
      let seedValue;
      if (seedBytes.length >= 4) {
        seedValue = OpCodes.Pack32BE(seedBytes[0], seedBytes[1], seedBytes[2], seedBytes[3]);
      } else {
        // Handle shorter seeds by zero-padding
        const padded = [0, 0, 0, 0];
        for (let i = 0; i < seedBytes.length; ++i) {
          padded[4 - seedBytes.length + i] = seedBytes[i];
        }
        seedValue = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
      }

      // Validate seed is in valid range [1, MODULUS-1]
      if (seedValue < 1 || seedValue >= MODULUS) {
        throw new Error('Knuth-B seed must be in range [1, 2147483646]');
      }

      this._state = seedValue;
      this._initializeTable();
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
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
     * Generate next shuffled value
     *
     * C++ shuffle_order_engine algorithm:
     * 1. Compute table index from current y value
     * 2. Retrieve value from table at that index (this becomes the result)
     * 3. Generate new base value
     * 4. Store new value in table at the computed index
     * 5. Update y with the RESULT (not the new base value) - key difference!
     * 6. Return the retrieved value
     *
     * The clever part: using the output as the next y creates a feedback loop
     * where each output influences which table entry is selected next.
     *
     * @returns {number} Next shuffled random value
     */
    _next() {
      if (!this._ready) {
        throw new Error('Knuth-B not initialized: set seed first');
      }

      // Step 1: Compute table index from current y
      // Use 64-bit multiplication to avoid overflow
      const j = Math.floor((this._y * TABLE_SIZE) / MODULUS);

      // Step 2: Retrieve value from table - this is our result
      const result = this._table[j];

      // Step 3: Generate new base value
      const newValue = this._nextBase();

      // Step 4: Store new value in table at same index
      this._table[j] = newValue;

      // Step 5: Update y with the RESULT (not newValue!)
      // This creates feedback where output influences next selection
      this._y = result;

      // Step 6: Return the retrieved value
      return result;
    }

    /**
     * Generate random bytes
     * Outputs 32-bit values (big-endian) from shuffled sequence
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Knuth-B not initialized: set seed first');
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

      // Generate values and pack as 32-bit big-endian
      while (output.length < length) {
        const value = this._next();
        const bytes = OpCodes.Unpack32BE(value);

        for (let i = 0; i < 4 && output.length < length; ++i) {
          output.push(bytes[i]);
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is typically not used (Knuth-B is deterministic)
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
  const algorithmInstance = new KnuthBAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { KnuthBAlgorithm, KnuthBInstance };
}));
