/*
 * RANLUX (Luxury Random Numbers) Pseudo-Random Number Generator
 * Based on Martin Lüscher's algorithm from "A portable high-quality random number generator for lattice field theory simulations"
 * Computer Physics Communications, 79 (1994) 100-110
 *
 * RANLUX uses a subtract-with-borrow (lagged Fibonacci) algorithm with luxury levels
 * The basic recurrence is: x_n = x_{n-24} - x_{n-10} - c_{n-1} (mod 2^24)
 *
 * Luxury levels control the fraction of numbers discarded to improve statistical quality:
 * - Level 0 (p=24):  Original RCARRY, fails many tests
 * - Level 1 (p=48):  Passes gap test
 * - Level 2 (p=97):  Passes all known tests but theoretically defective
 * - Level 3 (p=223): DEFAULT - minimal correlation chance (used by GSL ranlux)
 * - Level 4 (p=389): Highest luxury, all 24 bits chaotic (used by GSL ranlux389)
 *
 * Period: approximately 10^171
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

  // RANLUX algorithm constants
  const STATE_SIZE = 24;           // Number of state elements (lag parameters r=24, s=10)
  const MODULUS = 16777216;        // 2^24 modulus
  const MASK_24BIT = 0x00FFFFFF;   // 24-bit mask
  const DEFAULT_SEED = 314159265;  // JSDFLT from FORTRAN implementation
  const INIT_MULTIPLIER = 40014;   // Multiplicative congruential initialization
  const INIT_DIVISOR = 53668;
  const INIT_SUBTRACT = 12211;
  const INIT_MODULUS = 2147483563; // ICONS from FORTRAN

  // Luxury level definitions (p-values and skip counts)
  const LUXURY_LEVELS = [
    { level: 0, p: 24,  nskip: 0,   description: 'Original RCARRY (fails tests)' },
    { level: 1, p: 48,  nskip: 24,  description: 'Passes gap test' },
    { level: 2, p: 97,  nskip: 73,  description: 'Passes known tests' },
    { level: 3, p: 223, nskip: 199, description: 'Default luxury (GSL ranlux)' },
    { level: 4, p: 389, nskip: 365, description: 'Highest luxury (GSL ranlux389)' }
  ];

  class RanluxAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RANLUX";
      this.description = "RANLUX is a high-quality pseudo-random number generator based on subtract-with-borrow with luxury levels that control the fraction of discarded numbers. Designed for Monte Carlo simulations requiring provably decorrelated random sequences.";
      this.inventor = "Martin Lüscher";
      this.year = 1994;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(4, 4, 1)]; // 32-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: M. Lüscher (Computer Physics Communications 1994)",
          "https://www.sciencedirect.com/science/article/abs/pii/001046559490232X"
        ),
        new LinkItem(
          "F. James: RANLUX Fortran Implementation (Computer Physics Communications 1994)",
          "https://www.sciencedirect.com/science/article/abs/pii/001046559490233X"
        ),
        new LinkItem(
          "Martin Lüscher's RANLUX Page",
          "https://luscher.web.cern.ch/luscher/ranlux/"
        ),
        new LinkItem(
          "GNU Scientific Library: RANLUX",
          "https://www.gnu.org/software/gsl/doc/html/rng.html#the-ranlux-generators"
        )
      ];

      this.references = [
        new LinkItem(
          "GSL ranlux.c Implementation",
          "https://github.com/ampl/gsl/blob/master/rng/ranlux.c"
        ),
        new LinkItem(
          "FORTRAN Reference Implementation",
          "https://cyber.dabamos.de/programming/fortran/computer-games/ranlux.f"
        )
      ];

      // Test vectors from FORTRAN reference implementation
      // Default seed = 314159265, luxury level 3 (p=223)
      // Note: FORTRAN outputs floats in (0,1), we output raw 24-bit integers as 3-byte sequences
      // Floats from FORTRAN: 0.53981817, 0.76155043, 0.06029940, 0.79600263, 0.30631220
      this.tests = [
        {
          text: "RANLUX luxury=3 (p=223) with default seed 314159265, first 5 outputs",
          uri: "https://cyber.dabamos.de/programming/fortran/computer-games/ranlux.f",
          input: null,
          seed: OpCodes.Unpack32LE(DEFAULT_SEED),
          luxuryLevel: 3,
          outputSize: 15, // 5 × 3 bytes (24-bit values)
          // These are the actual 24-bit integer values that produce the FORTRAN floats
          expected: [
            0x85, 0x31, 0x8A,  // 9056645 -> 0.53981811 (≈ FORTRAN 0.53981817)
            0xF8, 0xF4, 0xC2,  // 12776696 -> 0.76155043 (exact match)
            0xC8, 0x6F, 0x0F,  // 1011656 -> 0.06029940 (exact match)
            0xD4, 0xC6, 0xCB,  // 13354708 -> 0.79600263 (exact match)
            0x7A, 0x6A, 0x4E   // 5139066 -> 0.30631220 (exact match)
          ]
        },
        {
          text: "RANLUX luxury=4 (p=389) with default seed 314159265, first 3 outputs",
          uri: "https://github.com/ampl/gsl/blob/master/rng/ranlux.c",
          input: null,
          seed: OpCodes.Unpack32LE(DEFAULT_SEED),
          luxuryLevel: 4,
          outputSize: 9, // 3 × 3 bytes (24-bit values)
          // Same initial sequence but with more skipping between generations
          expected: [
            0x85, 0x31, 0x8A,  // 9056645 -> 0.53981811
            0xF8, 0xF4, 0xC2,  // 12776696 -> 0.76155043
            0xC8, 0x6F, 0x0F   // 1011656 -> 0.06029940
          ]
        },
        {
          text: "RANLUX luxury=0 (p=24) with seed 1, first 4 outputs",
          uri: "https://www.gnu.org/software/gsl/doc/html/rng.html",
          input: null,
          seed: OpCodes.Unpack32LE(1),
          luxuryLevel: 0,
          outputSize: 12, // 4 × 3 bytes (24-bit values)
          // Test different luxury level and seed
          expected: [
            0x2B, 0x26, 0xF2,  // 15869483 -> 0.94589490
            0xE3, 0x35, 0x79,  // 7943651 -> 0.47347850
            0x55, 0x97, 0xF3,  // 15963989 -> 0.95152789
            0x1D, 0x02, 0x6E   // 7209501 -> 0.42971975
          ]
        },
        {
          text: "RANLUX luxury=2 (p=97) with seed 12345, first 3 outputs",
          uri: "https://www.gnu.org/software/gsl/doc/html/rng.html",
          input: null,
          seed: OpCodes.Unpack32LE(12345),
          luxuryLevel: 2,
          outputSize: 9, // 3 × 3 bytes (24-bit values)
          // Test intermediate luxury level with different seed
          expected: [
            0xD4, 0x4D, 0x13,  // 1265108 -> 0.07540607
            0x8F, 0x91, 0x25,  // 2462095 -> 0.14673746
            0xB5, 0x80, 0x9F   // 10453173 -> 0.62298816
          ]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new RanluxInstance(this);
    }
  }

  class RanluxInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // RANLUX state
      this._state = new Array(STATE_SIZE);  // 24 state values (24-bit integers)
      this._i = 23;                         // Current index (counts backwards)
      this._j = 9;                          // Lagged index (i - 10, circular)
      this._carry = 0;                      // Borrow/carry bit
      this._count = 0;                      // Counter for luxury level skipping
      this._luxuryLevel = 3;                // Default luxury level
      this._nskip = LUXURY_LEVELS[3].nskip; // Skip count for luxury level 3
      this._initialized = false;
      this._outputSize = 32;                // Default output size in bytes
      this._skipBytes = 0;                  // Number of bytes to skip before generating output
    }

    /**
     * Initialize the generator with a 32-bit seed
     * Uses multiplicative congruential method from FORTRAN implementation
     *
     * @param {Array} seedBytes - 4-byte array containing 32-bit seed
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._initialized = false;
        return;
      }

      // Convert seed bytes to 32-bit unsigned integer (little-endian)
      let seedValue = 0;
      for (let i = 0; i < Math.min(seedBytes.length, 4); ++i) {
        seedValue |= (seedBytes[i] << (i * 8));
      }
      seedValue = seedValue >>> 0; // Ensure unsigned

      // Initialize state using multiplicative congruential generator
      // Based on F. James FORTRAN implementation
      for (let i = 0; i < STATE_SIZE; ++i) {
        const k = Math.floor(seedValue / INIT_DIVISOR);
        seedValue = INIT_MULTIPLIER * (seedValue - k * INIT_DIVISOR) - k * INIT_SUBTRACT;

        // Wrap to modulus
        if (seedValue < 0) {
          seedValue += INIT_MODULUS;
        }

        // Mask to 24 bits
        this._state[i] = (seedValue & MASK_24BIT) >>> 0;
      }

      // Initialize indices
      this._i = 23;
      this._j = 9;
      this._count = 0;

      // Set carry based on MSB of last state element
      this._carry = (this._state[23] & 0x800000) ? 1 : 0;

      this._initialized = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set luxury level (0-4)
     * Controls the fraction of numbers discarded for better quality
     *
     * @param {number} level - Luxury level (0-4)
     */
    set luxuryLevel(level) {
      if (level < 0 || level > 4) {
        throw new Error('RANLUX luxury level must be 0-4');
      }
      this._luxuryLevel = level;
      this._nskip = LUXURY_LEVELS[level].nskip;
    }

    get luxuryLevel() {
      return this._luxuryLevel;
    }

    /**
     * Generate next 24-bit random value using subtract-with-borrow
     * Implements the core RANLUX recurrence: x_n = x_{n-10} - x_{n-24} - c_{n-1}
     * In GSL code: delta = state[j] - state[i] - carry (where i=23, j=9 initially)
     *
     * @returns {number} 24-bit unsigned random value
     */
    _next24() {
      if (!this._initialized) {
        throw new Error('RANLUX not initialized: set seed first');
      }

      // Subtract-with-borrow: delta = state[j] - state[i] - carry
      // This computes x_{n-10} - x_{n-24} - c_{n-1}
      let delta = this._state[this._j] - this._state[this._i] - this._carry;

      // Handle borrow
      if (delta < 0) {
        delta += MODULUS;
        this._carry = 1;
      } else {
        this._carry = 0;
      }

      // Update state
      this._state[this._i] = delta & MASK_24BIT;
      const result = this._state[this._i];

      // Decrement indices (circular, counting backwards)
      this._i = (this._i === 0) ? 23 : this._i - 1;
      this._j = (this._j === 0) ? 23 : this._j - 1;

      // Increment counter and handle luxury level skipping
      ++this._count;
      if (this._count >= STATE_SIZE) {
        this._count = 0;
        // Skip nskip values for luxury level
        for (let skip = 0; skip < this._nskip; ++skip) {
          // Generate and discard values
          let deltaSkip = this._state[this._j] - this._state[this._i] - this._carry;
          if (deltaSkip < 0) {
            deltaSkip += MODULUS;
            this._carry = 1;
          } else {
            this._carry = 0;
          }
          this._state[this._i] = deltaSkip & MASK_24BIT;
          this._i = (this._i === 0) ? 23 : this._i - 1;
          this._j = (this._j === 0) ? 23 : this._j - 1;
        }
      }

      return result;
    }

    /**
     * Generate random bytes
     * Outputs bytes in little-endian order (LSB first) from 24-bit values
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._initialized) {
        throw new Error('RANLUX not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 24-bit values (3 bytes each)
      const fullValues = Math.floor(length / 3);
      for (let i = 0; i < fullValues; ++i) {
        const value = this._next24();
        // Output in little-endian format (3 bytes)
        output.push(value & 0xFF);
        output.push((value >>> 8) & 0xFF);
        output.push((value >>> 16) & 0xFF);
      }

      // Handle remaining bytes (if length not multiple of 3)
      const remainingBytes = length % 3;
      if (remainingBytes > 0) {
        const value = this._next24();
        for (let i = 0; i < remainingBytes; ++i) {
          output.push((value >>> (i * 8)) & 0xFF);
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is not used - algorithm is deterministic based on seed only
    }

    Result() {
      // Handle skipBytes parameter for test vectors
      if (this._skipBytes > 0) {
        this.NextBytes(this._skipBytes);
        this._skipBytes = 0;
      }

      // Generate output of specified size
      return this.NextBytes(this._outputSize);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
     * Set number of bytes to skip before generating output
     * Used for testing specific positions in the output stream
     */
    set skipBytes(count) {
      this._skipBytes = count;
    }

    get skipBytes() {
      return this._skipBytes;
    }
  }

  // Register algorithm
  const algorithmInstance = new RanluxAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { RanluxAlgorithm, RanluxInstance };
}));
