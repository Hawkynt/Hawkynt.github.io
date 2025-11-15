/*
 * MT19937-64 Pseudo-Random Number Generator (64-bit Mersenne Twister)
 * Based on reference implementation by Makoto Matsumoto and Takuji Nishimura
 * Original algorithm published in 2004 (64-bit version)
 *
 * MT19937-64 generates high-quality pseudo-random 64-bit numbers with a period of 2^19937-1
 * Uses a state array of 312 64-bit integers with tempering transformations
 *
 * Reference: http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/emt64.html
 * Reference Implementation: http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c
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

  // NOTE: This implementation uses native BigInt operations (>>, <<, ^, &, |) instead of OpCodes
  // because JavaScript's OpCodes library is designed for 32-bit operations, while MT19937-64
  // requires native 64-bit arithmetic. BigInt is the standard JavaScript way to handle 64-bit
  // integers, and its operators are essential for this algorithm's correctness.

  // Helper function to convert BigInt to little-endian byte array
  function BigIntToBytes64LE(value) {
    const bytes = [];
    for (let i = 0; i < 8; ++i) {
      bytes.push(Number((value >> (BigInt(i) * 8n)) & 0xFFn));
    }
    return bytes;
  }

  // Helper function to convert little-endian byte array to BigInt
  function BytesToBigInt64LE(bytes) {
    let value = 0n;
    for (let i = 0; i < Math.min(bytes.length, 8); ++i) {
      value |= BigInt(bytes[i] & 0xFF) << (BigInt(i) * 8n);
    }
    return value;
  }

  // MT19937-64 algorithm constants (from official C implementation)
  const NN = 312;                                      // State vector length
  const MM = 156;                                      // Period parameter
  const MATRIX_A = 0xB5026F5AA96619E9n;               // Constant vector a
  const UPPER_MASK = 0xFFFFFFFF80000000n;             // Most significant 33 bits
  const LOWER_MASK = 0x7FFFFFFFn;                     // Least significant 31 bits
  const DEFAULT_SEED = 5489n;                         // MT19937-64 default seed
  const INIT_MULTIPLIER = 6364136223846793005n;       // Initialization multiplier

  // Tempering masks (from official implementation)
  const TEMPER_MASK_1 = 0x5555555555555555n;          // Used with >> 29
  const TEMPER_MASK_2 = 0x71D67FFFEDA60000n;          // Used with << 17
  const TEMPER_MASK_3 = 0xFFF7EEE000000000n;          // Used with << 37

  class MersenneTwister64Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Mersenne Twister 64-bit (MT19937-64)";
      this.description = "MT19937-64 is the 64-bit version of the widely-used Mersenne Twister PRNG with a period of 2^19937-1. It generates high-quality 64-bit pseudo-random numbers suitable for simulation and statistical applications, though it is not cryptographically secure.";
      this.inventor = "Makoto Matsumoto and Takuji Nishimura";
      this.year = 2004;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official MT19937-64 Page",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/emt64.html"
        ),
        new LinkItem(
          "Reference Implementation (C code)",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c"
        ),
        new LinkItem(
          "Original Paper: Mersenne Twister (ACM TOMACS 1998)",
          "https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/mt.pdf"
        ),
        new LinkItem(
          "Wikipedia: Mersenne Twister",
          "https://en.wikipedia.org/wiki/Mersenne_Twister"
        )
      ];

      this.references = [
        new LinkItem(
          "C++11 std::mt19937_64 Documentation",
          "https://en.cppreference.com/w/cpp/numeric/random/mersenne_twister_engine"
        ),
        new LinkItem(
          "Crypto++ Implementation",
          "https://github.com/weidai11/cryptopp/blob/master/mersenne.h"
        )
      ];

      // Test vectors from official mt19937-64.c reference implementation
      // Using default seed 5489 as specified in the reference code
      // First 10 outputs verified against official reference output
      this.tests = [
        {
          text: "MT19937-64 with seed 5489 (default seed, first 10 outputs)",
          uri: "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c",
          input: null,
          seed: BigIntToBytes64LE(5489n), // 5489 as little-endian bytes
          outputSize: 80, // 10 uint64 values = 80 bytes
          expected: OpCodes.ConcatArrays(
            // Verified against official reference implementation
            // These are the exact first 10 outputs from genrand64_int64() with seed 5489
            BigIntToBytes64LE(14514284786278117030n),
            BigIntToBytes64LE(4620546740167642908n),
            BigIntToBytes64LE(13109570281517897720n),
            BigIntToBytes64LE(17462938647148434322n),
            BigIntToBytes64LE(355488278567739596n),
            BigIntToBytes64LE(7469126240319926998n),
            BigIntToBytes64LE(4635995468481642529n),
            BigIntToBytes64LE(418970542659199878n),
            BigIntToBytes64LE(9604170989252516556n),
            BigIntToBytes64LE(6358044926049913402n)
          )
        },
        {
          text: "MT19937-64 with seed 1 (common test seed, first 5 outputs)",
          uri: "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c",
          input: null,
          seed: BigIntToBytes64LE(1n), // 1 as little-endian bytes
          outputSize: 40, // 5 uint64 values = 40 bytes
          expected: OpCodes.ConcatArrays(
            // Generated from implementation verified against official reference
            BigIntToBytes64LE(2469588189546311528n),
            BigIntToBytes64LE(2516265689700432462n),
            BigIntToBytes64LE(8323445853463659930n),
            BigIntToBytes64LE(387828560950575246n),
            BigIntToBytes64LE(6472927700900931384n)
          )
        },
        {
          text: "MT19937-64 with seed 123456789 (validation test)",
          uri: "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c",
          input: null,
          seed: BigIntToBytes64LE(123456789n), // 123456789 as little-endian bytes
          outputSize: 40, // 5 uint64 values = 40 bytes
          expected: OpCodes.ConcatArrays(
            // Generated from implementation verified against official reference
            BigIntToBytes64LE(6435547048506935310n),
            BigIntToBytes64LE(4923172384746461813n),
            BigIntToBytes64LE(2520679223035091359n),
            BigIntToBytes64LE(526781223349236672n),
            BigIntToBytes64LE(16028989633461488813n)
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new MersenneTwister64Instance(this);
    }
  }

  class MersenneTwister64Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MT19937-64 state (using BigInt for 64-bit operations)
      this._state = new Array(NN);  // State array of 64-bit integers
      this._index = NN + 1;         // Index into state array (NN+1 means uninitialized)
      this._mag01 = [0n, MATRIX_A]; // mag01[x] = x * MATRIX_A for x=0,1
      this._outputSize = 64;        // Default output size in bytes
      this._skipBytes = 0;          // Number of bytes to skip before generating output
    }

    /**
     * Initialize the generator with a 64-bit seed
     * Based on init_genrand64() from the reference implementation
     *
     * @param {Array} seedBytes - 8-byte array containing 64-bit seed (little-endian)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._index = NN + 1; // Mark as uninitialized
        return;
      }

      // Convert seed bytes to 64-bit unsigned integer (little-endian)
      const seedValue = BytesToBigInt64LE(seedBytes);

      // Initialize state array using the reference implementation's algorithm
      // This matches mt19937-64.c init_genrand64() function
      this._state[0] = seedValue;

      for (this._index = 1; this._index < NN; ++this._index) {
        // mt[i] = (6364136223846793005ULL * (mt[i-1] ^ (mt[i-1] >> 62)) + i)
        const prev = this._state[this._index - 1];
        const xored = prev ^ (prev >> 62n);
        const mult = INIT_MULTIPLIER * xored;
        this._state[this._index] = (mult + BigInt(this._index)) & 0xFFFFFFFFFFFFFFFFn;
      }

      // Reset index to trigger twist on first generation
      this._index = NN;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate the next 64-bit random value
     * Based on genrand64_int64() from the reference implementation
     *
     * @returns {BigInt} 64-bit unsigned random value
     */
    _next64() {
      if (this._index >= NN) {
        // Generate NN words at one time
        if (this._index > NN) {
          // If init_genrand64() has not been called, use default seed
          this.seed = BigIntToBytes64LE(DEFAULT_SEED);
        }

        this._twist();
      }

      // Get value from state array
      let x = this._state[this._index++];

      // Tempering transformations (exact sequence from reference implementation)
      x ^= (x >> 29n) & TEMPER_MASK_1;
      x ^= (x << 17n) & TEMPER_MASK_2;
      x ^= (x << 37n) & TEMPER_MASK_3;
      x ^= (x >> 43n);

      return x & 0xFFFFFFFFFFFFFFFFn;
    }

    /**
     * Generate NN words at one time (twist operation)
     * Based on the twist logic in genrand64_int64() from reference implementation
     */
    _twist() {
      let i;

      // First loop: i from 0 to NN-MM-1
      for (i = 0; i < NN - MM; ++i) {
        const x = (this._state[i] & UPPER_MASK) | (this._state[i + 1] & LOWER_MASK);
        this._state[i] = this._state[i + MM] ^ (x >> 1n) ^ this._mag01[Number(x & 1n)];
      }

      // Second loop: i from NN-MM to NN-2
      for (; i < NN - 1; ++i) {
        const x = (this._state[i] & UPPER_MASK) | (this._state[i + 1] & LOWER_MASK);
        this._state[i] = this._state[i + (MM - NN)] ^ (x >> 1n) ^ this._mag01[Number(x & 1n)];
      }

      // Final element
      {
        const x = (this._state[NN - 1] & UPPER_MASK) | (this._state[0] & LOWER_MASK);
        this._state[NN - 1] = this._state[MM - 1] ^ (x >> 1n) ^ this._mag01[Number(x & 1n)];
      }

      this._index = 0;
    }

    /**
     * Generate random bytes
     * Outputs bytes in little-endian order (LSB first) to match test vectors
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (this._index > NN) {
        throw new Error('MT19937-64 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 64-bit words
      const fullWords = Math.floor(length / 8);
      for (let i = 0; i < fullWords; ++i) {
        const value = this._next64();
        // Output in little-endian format (LSB first)
        for (let j = 0; j < 8; ++j) {
          output.push(Number((value >> (BigInt(j) * 8n)) & 0xFFn));
        }
      }

      // Handle remaining bytes (if length not multiple of 8)
      const remainingBytes = length % 8;
      if (remainingBytes > 0) {
        const value = this._next64();
        for (let i = 0; i < remainingBytes; ++i) {
          output.push(Number((value >> (BigInt(i) * 8n)) & 0xFFn));
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is not used in standard MT19937-64
      // The algorithm is deterministic based on initial seed only
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
  const algorithmInstance = new MersenneTwister64Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MersenneTwister64Algorithm, MersenneTwister64Instance };
}));
