/*
 * Xorshift32 Pseudo-Random Number Generator
 * Invented by George Marsaglia (2003)
 *
 * Xorshift32 is the simplest member of the xorshift family, using only a single
 * 32-bit state variable and three XOR-shift operations. Despite its simplicity,
 * it produces high-quality pseudorandom numbers suitable for simulations and gaming.
 *
 * Properties:
 * - State: Single 32-bit value (must be non-zero)
 * - Period: 2^32 - 1 (4,294,967,295 values)
 * - Speed: Extremely fast (only 3 operations per output)
 * - Quality: Passes many statistical tests
 * - Limitations: NOT cryptographically secure, relatively short period
 *
 * Algorithm (parameters 13, 17, 5):
 *   x ^= x << 13;
 *   x ^= x >> 17;
 *   x ^= x << 5;
 *   return x;
 *
 * Reference: Marsaglia, G. (2003). "Xorshift RNGs". Journal of Statistical Software, 8(14), 1-6.
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

  class Xorshift32Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xorshift32";
      this.description = "Xorshift32 is the simplest xorshift PRNG using a single 32-bit state with three XOR-shift operations. Invented by George Marsaglia in his seminal 2003 paper on xorshift generators. Extremely fast with period 2^32-1, suitable for simulations and gaming.";
      this.inventor = "George Marsaglia";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Xorshift Family";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (8-32 bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Xorshift RNGs (Marsaglia, 2003)",
          "https://www.jstatsoft.org/article/view/v008i14"
        ),
        new LinkItem(
          "PDF: Xorshift RNGs (Direct Download)",
          "https://www.jstatsoft.org/index.php/jss/article/view/v008i14/xorshift.pdf"
        ),
        new LinkItem(
          "Wikipedia: Xorshift",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "Reference C Implementation",
          "https://github.com/edrosten/8point_algo/blob/master/xorshift.h"
        )
      ];

      this.references = [
        new LinkItem(
          "Sebastiano Vigna: Analysis of xorshift generators",
          "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf"
        ),
        new LinkItem(
          "Modern PRNG Alternatives (xoshiro/xoroshiro)",
          "https://prng.di.unimi.it/"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors generated from reference JavaScript implementation
      // Algorithm: x ^= x << 13; x ^= x >> 17; x ^= x << 5;
      // Parameters: (13, 17, 5) - Marsaglia's recommended triplet for 32-bit
      // Reference: Marsaglia, G. (2003). "Xorshift RNGs". Journal of Statistical Software, 8(14), 1-6.
      this.tests = [
        {
          text: "Seed 1: First 5 outputs (20 bytes) - verified against reference implementation",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "00042021" +  // Output 1: 270369
            "04080601" +  // Output 2: 67634689
            "9DCCA8C5" +  // Output 3: 2647435461
            "1255994F" +  // Output 4: 307599695
            "8EF917D1"    // Output 5: 2398689233
          )
        },
        {
          text: "Seed 12345: First 5 outputs (20 bytes) - common test seed",
          uri: "https://github.com/edrosten/8point_algo/blob/master/xorshift.h",
          input: null,
          seed: OpCodes.Hex8ToBytes("00003039"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "C6E5747A" +  // Output 1: 3336926330
            "652A09AF" +  // Output 2: 1697253807
            "A7E08FA0" +  // Output 3: 2816511904
            "748E41EA" +  // Output 4: 1955480042
            "2AD8A9D3"    // Output 5: 718842323
          )
        },
        {
          text: "Seed 0 (defaults to 1): First 5 outputs - zero seed handling",
          uri: "https://www.jstatsoft.org/article/view/v008i14",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "00042021" +  // Output 1: 270369 (same as seed 1)
            "04080601" +  // Output 2: 67634689
            "9DCCA8C5" +  // Output 3: 2647435461
            "1255994F" +  // Output 4: 307599695
            "8EF917D1"    // Output 5: 2398689233
          )
        },
        {
          text: "Seed 0xFFFFFFFF (max 32-bit): First 5 outputs (20 bytes) - edge case",
          uri: "https://en.wikipedia.org/wiki/Xorshift",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFF"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "0003E01F" +  // Output 1: 253983
            "FC07FDFF" +  // Output 2: 4228382207
            "74BB9843" +  // Output 3: 1958451267
            "F1CC88DA" +  // Output 4: 4056713434
            "7A28EE91"    // Output 5: 2049502865
          )
        },
        {
          text: "Seed 42: First 8 outputs (32 bytes) - answer to everything",
          uri: "https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000002A"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "00AD4528" +  // Output 1: 11355432
            "A90A34AC" +  // Output 2: 2836018348
            "1C67AF03" +  // Output 3: 476557059
            "D970C3C0" +  // Output 4: 3648046016
            "E01CCBC4" +  // Output 5: 3759983556
            "55EA99B6" +  // Output 6: 1441438134
            "DD5701D8" +  // Output 7: 3713466840
            "90EFF2AE"    // Output 8: 2431644334
          )
        },
        {
          text: "Seed 2^31 (0x80000000): First 5 outputs - high bit set",
          uri: "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf",
          input: null,
          seed: OpCodes.Hex8ToBytes("80000000"),
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes(
            "80084000" +  // Output 1: 2148024320
            "89088484" +  // Output 2: 2299036804
            "AA914148" +  // Output 3: 2861646152
            "D5B80294" +  // Output 4: 3585606292
            "68B7E441"    // Output 5: 1756881985
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
      return new Xorshift32Instance(this);
    }
  }

  /**
 * Xorshift32 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xorshift32Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xorshift32 uses a single 32-bit state variable
      this._state = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-4 bytes)
     * Seed format: 1-4 bytes packed into a 32-bit state value (big-endian)
     * Note: Seed of 0 is converted to 1 (all-zero state would produce all zeros)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Pack seed bytes into 32-bit state (big-endian)
      if (seedBytes.length >= 4) {
        this._state = OpCodes.Pack32BE(
          seedBytes[0],
          seedBytes[1],
          seedBytes[2],
          seedBytes[3]
        );
      } else if (seedBytes.length === 3) {
        this._state = OpCodes.Pack32BE(0, seedBytes[0], seedBytes[1], seedBytes[2]);
      } else if (seedBytes.length === 2) {
        this._state = OpCodes.Pack32BE(0, 0, seedBytes[0], seedBytes[1]);
      } else {
        this._state = OpCodes.Pack32BE(0, 0, 0, seedBytes[0]);
      }

      // Ensure unsigned 32-bit and never zero
      this._state = OpCodes.ToDWord(this._state);
      if (this._state === 0) {
        this._state = 1; // Default to 1 if seed is 0
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using Xorshift32 algorithm
     *
     * Algorithm from Marsaglia (2003):
     * x ^= x << 13;  // Left shift and XOR
     * x ^= x >> 17;  // Right shift and XOR
     * x ^= x << 5;   // Left shift and XOR
     * return x;
     *
     * Parameters (13, 17, 5) are Marsaglia's recommended triplet for 32-bit xorshift
     * These values ensure maximal period of 2^32-1
     */
    _next32() {
      if (!this._ready) {
        throw new Error('Xorshift32 not initialized: set seed first');
      }

      // Step 1: x ^= x << 13
      let x = this._state;
      x = OpCodes.ToDWord(x ^ OpCodes.Shl32(x, 13));

      // Step 2: x ^= x >> 17
      x = OpCodes.ToDWord(x ^ OpCodes.Shr32(x, 17));

      // Step 3: x ^= x << 5
      x = OpCodes.ToDWord(x ^ OpCodes.Shl32(x, 5));

      // Update state and return
      this._state = x;
      return x;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xorshift32 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order for consistency)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        const bytes = OpCodes.Unpack32BE(value);

        for (let i = 0; i < bytesToExtract; ++i) {
          output.push(bytes[i]);
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
      // For PRNG, Feed is not typically used
      // Included for interface compliance
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors (if needed)
      if (this._skip && this._skip > 0) {
        // Skip the specified number of 32-bit outputs
        for (let i = 0; i < this._skip; ++i) {
          this._next32();
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
  const algorithmInstance = new Xorshift32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xorshift32Algorithm, Xorshift32Instance };
}));
