/*
 * MRG32k3a - Combined Multiple Recursive Generator
 * Based on "Good Parameters and Implementations for Combined Multiple Recursive Random Number Generators"
 * by Pierre L'Ecuyer, Operations Research, Vol. 47, No. 1, January-February 1999
 *
 * MRG32k3a combines two Multiple Recursive Generators (MRGs) to produce high-quality
 * pseudo-random numbers with a period of approximately 2^191. It is recommended for
 * general-purpose Monte Carlo simulations and parallel random number generation.
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

  // MRG32k3a algorithm constants from L'Ecuyer's 1999 paper
  const M1 = 4294967087.0;       // m1 = 2^32 - 209
  const M2 = 4294944443.0;       // m2 = 2^32 - 22853
  const A12 = 1403580.0;         // Coefficient a12
  const A13N = 810728.0;         // Coefficient -a13 (stored as positive)
  const A21 = 527612.0;          // Coefficient a21
  const A23N = 1370589.0;        // Coefficient -a23 (stored as positive)
  const NORM = 2.328306549295728e-10;  // Normalization factor: 1.0 / (m1 + 1)
  const DEFAULT_SEED = 12345;    // Default initial value for all 6 state components

  class MRG32k3aAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MRG32k3a";
      this.description = "MRG32k3a is a combined multiple recursive generator with period approximately 2^191. It combines two MRG components using carefully chosen parameters for excellent statistical properties and is recommended for Monte Carlo simulations.";
      this.inventor = "Pierre L'Ecuyer";
      this.year = 1999;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CA;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [
        new KeySize(4, 4, 1),   // 1 x 32-bit value (expanded to [seed,0,0,seed,0,0])
        new KeySize(24, 24, 1)  // 6 x 32-bit values (explicit state initialization)
      ];

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Good Parameters and Implementations for Combined MRGs (Operations Research 1999)",
          "https://pubsonline.informs.org/doi/pdf/10.1287/opre.47.1.159"
        ),
        new LinkItem(
          "L'Ecuyer's MRG32k3a Reference Implementation",
          "https://simul.iro.umontreal.ca/rng/MRG32k3a.c"
        ),
        new LinkItem(
          "TestU01: Statistical Test Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Wikipedia: Combined Linear Congruential Generator",
          "https://en.wikipedia.org/wiki/Combined_linear_congruential_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "Rosetta Code: MRG32k3a Implementation Examples",
          "https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a"
        ),
        new LinkItem(
          "RngStreams Library (multiple independent streams)",
          "https://github.com/umontreal-simul/RngStreams"
        )
      ];

      // Test vectors from Rosetta Code (authoritative reference implementation)
      // Source: https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a
      // Note: Rosetta Code uses single integer seeds expanded to [seed, 0, 0] for both components
      this.tests = [
        {
          text: "MRG32k3a with seed 1234567 (first 5 outputs - Rosetta Code verification)",
          uri: "https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a",
          input: null,
          seed: this._encodeSingleSeed(1234567),
          outputSize: 20, // 5 uint32 values = 20 bytes
          expected: OpCodes.ConcatArrays(
            OpCodes.Unpack32LE(1459213977),  // Verified from Rosetta Code Python implementation
            OpCodes.Unpack32LE(2827710106),
            OpCodes.Unpack32LE(4245671317),
            OpCodes.Unpack32LE(3877608661),
            OpCodes.Unpack32LE(2595287583)
          )
        },
        {
          text: "MRG32k3a with seed 987654321 (first 5 outputs)",
          uri: "https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a",
          input: null,
          seed: this._encodeSingleSeed(987654321),
          outputSize: 20, // 5 uint32 values = 20 bytes
          expected: OpCodes.ConcatArrays(
            OpCodes.Unpack32LE(3042735940),  // Verified from Rosetta Code Python implementation
            OpCodes.Unpack32LE(3103110088),
            OpCodes.Unpack32LE(3280483497),
            OpCodes.Unpack32LE(795861024),
            OpCodes.Unpack32LE(1610389998)
          )
        },
        {
          text: "MRG32k3a with seed 12345 (first 5 outputs)",
          uri: "https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a",
          input: null,
          seed: this._encodeSingleSeed(12345),
          outputSize: 20, // 5 uint32 values = 20 bytes
          expected: OpCodes.ConcatArrays(
            OpCodes.Unpack32LE(2076541391),  // Verified from Rosetta Code Python implementation
            OpCodes.Unpack32LE(3272943522),
            OpCodes.Unpack32LE(3830942070),
            OpCodes.Unpack32LE(3312114526),
            OpCodes.Unpack32LE(742589995)
          )
        }
      ];
    }

    /**
     * Helper function to encode single seed value into byte array
     * Expands to [seed, 0, 0] for both components (Rosetta Code convention)
     * @private
     */
    _encodeSingleSeed(seed) {
      return OpCodes.Unpack32LE(seed);
    }

    /**
     * Helper function to encode 6 seed values into byte array
     * @private
     */
    _encodeSeed(s10, s11, s12, s20, s21, s22) {
      return OpCodes.ConcatArrays(
        OpCodes.Unpack32LE(s10),
        OpCodes.Unpack32LE(s11),
        OpCodes.Unpack32LE(s12),
        OpCodes.Unpack32LE(s20),
        OpCodes.Unpack32LE(s21),
        OpCodes.Unpack32LE(s22)
      );
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new MRG32k3aInstance(this);
    }
  }

  class MRG32k3aInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MRG32k3a state: two 3-component vectors
      // State vectors hold [newest, middle, oldest] values following Rosetta Code convention
      // Component 1: x1[0], x1[1], x1[2] (values in [0, M1-1])
      // Component 2: x2[0], x2[1], x2[2] (values in [0, M2-1])
      this._x1 = [DEFAULT_SEED, 0, 0];
      this._x2 = [DEFAULT_SEED, 0, 0];

      this._initialized = true;
      this._outputSize = 32;  // Default output size in bytes
      this._skipBytes = 0;    // Number of bytes to skip before generating output
    }

    /**
     * Initialize the generator with seed values
     * Accepts either:
     *   - 4 bytes: single uint32 seed expanded to [seed, 0, 0] for both components (Rosetta Code style)
     *   - 24 bytes: 6 uint32 values for explicit state initialization [x1[0], x1[1], x1[2], x2[0], x2[1], x2[2]]
     *
     * @param {Array} seedBytes - 4-byte or 24-byte array containing seed values
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._initialized = false;
        return;
      }

      if (seedBytes.length === 4) {
        // Single seed value: expand to [seed, 0, 0] for both components
        const seedValue = OpCodes.Pack32LE(seedBytes[0], seedBytes[1], seedBytes[2], seedBytes[3]);

        // Validate seed is in valid range (0 < seed < M1+1)
        if (seedValue <= 0 || seedValue > M1) {
          throw new Error('MRG32k3a seed must be in range (0, ' + M1 + ']');
        }

        this._x1 = [seedValue, 0, 0];
        this._x2 = [seedValue, 0, 0];
        this._initialized = true;
        return;
      }

      if (seedBytes.length === 24) {
        // Explicit 6-value initialization: [x1[0], x1[1], x1[2], x2[0], x2[1], x2[2]]
        const x10 = OpCodes.Pack32LE(seedBytes[0], seedBytes[1], seedBytes[2], seedBytes[3]);
        const x11 = OpCodes.Pack32LE(seedBytes[4], seedBytes[5], seedBytes[6], seedBytes[7]);
        const x12 = OpCodes.Pack32LE(seedBytes[8], seedBytes[9], seedBytes[10], seedBytes[11]);
        const x20 = OpCodes.Pack32LE(seedBytes[12], seedBytes[13], seedBytes[14], seedBytes[15]);
        const x21 = OpCodes.Pack32LE(seedBytes[16], seedBytes[17], seedBytes[18], seedBytes[19]);
        const x22 = OpCodes.Pack32LE(seedBytes[20], seedBytes[21], seedBytes[22], seedBytes[23]);

        // Validate component 1 seeds are in [0, M1-1] and not all zero
        if (x10 < 0 || x10 >= M1 || x11 < 0 || x11 >= M1 || x12 < 0 || x12 >= M1) {
          throw new Error('MRG32k3a component 1 seeds must be in [0, ' + (M1-1) + ']');
        }
        if (x10 === 0 && x11 === 0 && x12 === 0) {
          throw new Error('MRG32k3a component 1 seeds cannot all be zero');
        }

        // Validate component 2 seeds are in [0, M2-1] and not all zero
        if (x20 < 0 || x20 >= M2 || x21 < 0 || x21 >= M2 || x22 < 0 || x22 >= M2) {
          throw new Error('MRG32k3a component 2 seeds must be in [0, ' + (M2-1) + ']');
        }
        if (x20 === 0 && x21 === 0 && x22 === 0) {
          throw new Error('MRG32k3a component 2 seeds cannot all be zero');
        }

        this._x1 = [x10, x11, x12];
        this._x2 = [x20, x21, x22];
        this._initialized = true;
        return;
      }

      throw new Error('MRG32k3a seed must be 4 bytes (single seed) or 24 bytes (6 values)');
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate the next 32-bit random integer value
     * Based on Rosetta Code Python implementation
     *
     * Recurrence relations (using coefficients from L'Ecuyer 1999):
     * Component 1: x1i = (0*x1[0] + 1403580*x1[1] - 810728*x1[2]) mod m1
     * Component 2: x2i = (527612*x2[0] + 0*x2[1] - 1370589*x2[2]) mod m2
     * Output: ((x1i - x2i) mod m1) + 1
     *
     * @returns {number} 32-bit unsigned random integer in [1, M1+1]
     */
    _nextInt() {
      if (!this._initialized) {
        throw new Error('MRG32k3a not initialized: set seed first');
      }

      // Component 1: x1i = (0*x1[0] + 1403580*x1[1] - 810728*x1[2]) mod m1
      let x1i = (0 * this._x1[0] + A12 * this._x1[1] - A13N * this._x1[2]);

      // Python-style modular reduction (always returns positive result)
      x1i = ((x1i % M1) + M1) % M1;

      // Component 2: x2i = (527612*x2[0] + 0*x2[1] - 1370589*x2[2]) mod m2
      let x2i = (A21 * this._x2[0] + 0 * this._x2[1] - A23N * this._x2[2]);

      // Python-style modular reduction (always returns positive result)
      x2i = ((x2i % M2) + M2) % M2;

      // Update state vectors: [new_value] + previous[:2]
      // This shifts the array left, with newest value at index 0
      this._x1 = [x1i, this._x1[0], this._x1[1]];
      this._x2 = [x2i, this._x2[0], this._x2[1]];

      // Combine the two components: z = (x1i - x2i) mod m1
      let z = (x1i - x2i);

      // Python-style modular reduction
      z = ((z % M1) + M1) % M1;

      // Return z + 1 (output range is [1, M1+1])
      return z + 1;
    }

    /**
     * Generate the next floating-point random value in [0, 1)
     * @returns {number} Random float in [0, 1)
     */
    _nextFloat() {
      return (this._nextInt() - 1) * NORM;
    }

    /**
     * Generate random bytes
     * Outputs uint32 values in little-endian order
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._initialized) {
        throw new Error('MRG32k3a not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 32-bit words
      const fullWords = Math.floor(length / 4);
      for (let i = 0; i < fullWords; ++i) {
        const value = this._nextInt();
        // Output in little-endian format
        output.push((value) & 0xFF);
        output.push((value >>> 8) & 0xFF);
        output.push((value >>> 16) & 0xFF);
        output.push((value >>> 24) & 0xFF);
      }

      // Handle remaining bytes (if length not multiple of 4)
      const remainingBytes = length % 4;
      if (remainingBytes > 0) {
        const value = this._nextInt();
        for (let i = 0; i < remainingBytes; ++i) {
          output.push((value >>> (i * 8)) & 0xFF);
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed is not used in standard MRG32k3a
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
  const algorithmInstance = new MRG32k3aAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MRG32k3aAlgorithm, MRG32k3aInstance };
}));
