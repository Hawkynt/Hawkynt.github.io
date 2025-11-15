/*
 * SFC32 (Small Fast Counting) Pseudo-Random Number Generator
 * Based on Chris Doty-Humphrey's design from PractRand test suite
 *
 * This implementation uses the SFC32 variant (32-bit operations).
 * SFC is designed to be small, fast, and have good statistical properties
 * while avoiding short cycles through the use of a counter.
 *
 * Period: Minimum 2^32, average approximately 2^127
 * State: 128 bits (four 32-bit values: a, b, c, counter)
 * Algorithm: Chaotic mapping driven by incrementing counter
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

  class SFC32Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SFC32";
      this.description = "Small Fast Counting (SFC32) is a high-quality PRNG by Chris Doty-Humphrey designed for the PractRand test suite. It combines a chaotic invertible mapping with a counter to guarantee no small cycles and passes rigorous statistical tests.";
      this.inventor = "Chris Doty-Humphrey";
      this.year = 2010;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // 1-16 bytes (up to 128-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "PractRand: Chris Doty-Humphrey's PRNG Test Suite",
          "http://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "PractRand RNG Engines Documentation",
          "http://pracrand.sourceforge.net/RNG_engines.txt"
        ),
        new LinkItem(
          "Apache Commons RNG Implementation",
          "https://commons.apache.org/proper/commons-rng/commons-rng-core/javadocs/api-1.3/org/apache/commons/rng/core/source32/DotyHumphreySmallFastCounting32.html"
        ),
        new LinkItem(
          "JavaScript PRNG Implementations (bryc/code)",
          "https://github.com/bryc/code/blob/master/jshash/PRNGs.md"
        )
      ];

      this.references = [
        new LinkItem(
          "NumPy SFC64 Implementation",
          "https://numpy.org/doc/stable/reference/random/bit_generators/sfc64.html"
        ),
        new LinkItem(
          "PractRand Statistical Test Suite",
          "http://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "TestU01 Statistical Testing",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      // Test vectors generated using verified SFC32 algorithm implementation
      // Reference: Apache Commons RNG DotyHumphreySmallFastCounting32
      // Algorithm: tmp = a + b + counter; counter++; a = b ^ (b >> 9); b = c + (c << 3); c = ROL(c, 21) + tmp
      // Note: PractRand recommends discarding first 12-15 outputs for better quality
      this.tests = [
        {
          text: "Seed (1,2,3,4): First 5 outputs (20 bytes) - verified against SFC32 reference implementation",
          uri: "https://github.com/bryc/code/blob/master/jshash/PRNGs.md",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000020000000300000004"),
          outputSize: 20, // 5 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "00000007" +  // Output 1: a(1) + b(2) + counter(4) = 7
            "00000022" +  // Output 2: 34
            "03600060" +  // Output 3: 56623200
            "0B421D78" +  // Output 4: 188882296
            "CC849C75"    // Output 5: 3431242869
          )
        },
        {
          text: "Seed (0,0,0,1): First 10 outputs - minimal seed with counter=1",
          uri: "http://pracrand.sourceforge.net/RNG_engines.txt",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          outputSize: 40, // 10 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "00000001" +  // Output 1: 0+0+1 = 1
            "00000002" +  // Output 2: 0+0+2 = 2
            "0000000C" +  // Output 3: 12
            "0120001F" +  // Output 4: 18874399
            "0360B483" +  // Output 5: 56685699
            "99E14D9B" +  // Output 6: 2582277531
            "D9C4E5DE" +  // Output 7: 3653396958
            "3F6D95A6" +  // Output 8: 1063994790
            "59390FB3" +  // Output 9: 1496895411
            "004B9EFB"    // Output 10: 4956923
          )
        },
        {
          text: "Seed (0x9E3779B9, 0x243F6A88, 0xB7E15162, 12): Standard test seed - first 8 outputs",
          uri: "https://commons.apache.org/proper/commons-rng/",
          input: null,
          seed: OpCodes.Hex8ToBytes("9E3779B9243F6A88B7E151620000000C"),
          outputSize: 32, // 8 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "C276E44D" +  // Output 1: 3262555213
            "9B1951BC" +  // Output 2: 2602246588
            "DC0D8DD9" +  // Output 3: 3691355609
            "5FDF01A4" +  // Output 4: 1608221092
            "9EE74639" +  // Output 5: 2663082553
            "D956E004" +  // Output 6: 3648299012
            "8959F5A3" +  // Output 7: 2304378275
            "A65A8E9D"    // Output 8: 2791067293
          )
        },
        {
          text: "Seed (12345, 67890, 11111, 1): Common test values - first 12 outputs (discard first 12 per PractRand)",
          uri: "http://pracrand.sourceforge.net/",
          input: null,
          seed: OpCodes.Hex8ToBytes("000030390001093200002B670000000001"),
          outputSize: 48, // 12 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "0001396C" +  // Output 1: 80236
            "00029057" +  // Output 2: 168023
            "D3EC8B58" +  // Output 3: 3553961816
            "733481ED" +  // Output 4: 1932984813
            "214324F0" +  // Output 5: 557441264
            "16ED3820" +  // Output 6: 385401888
            "FF915741" +  // Output 7: 4287382337
            "6940350B" +  // Output 8: 1765696779
            "DB7782EC" +  // Output 9: 3682018028
            "49733921" +  // Output 10: 1232070945
            "410D3859" +  // Output 11: 1091180633
            "A992C3AF"    // Output 12: 2845115311
          )
        },
        {
          text: "Seed (1,1,1,1): Identical seed values - first 6 outputs",
          uri: "https://github.com/bryc/code/blob/master/jshash/PRNGs.md",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001000000010000000100000001"),
          outputSize: 24, // 6 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "00000003" +  // Output 1: 1+1+1 = 3
            "0000000C" +  // Output 2: 12
            "01200027" +  // Output 3: 18874407
            "0480B48B" +  // Output 4: 75744395
            "9B0201E2" +  // Output 5: 2601214434
            "6CE50A5B"    // Output 6: 1827351131
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new SFC32Instance(this);
    }
  }

  class SFC32Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // SFC32 uses 3x 32-bit state variables plus 1 counter
      this._a = 0;
      this._b = 0;
      this._c = 0;
      this._counter = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-16 bytes)
     * Seed format: up to 16 bytes mapped to four 32-bit words (a, b, c, counter)
     * Default initialization if seed is shorter than 16 bytes
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize with default values (commonly used constants)
      this._a = 0;
      this._b = 0;
      this._c = 0;
      this._counter = 1; // Counter typically starts at 1

      // Override with provided seed bytes (big-endian)
      let offset = 0;

      // Read 'a' (first 4 bytes)
      if (seedBytes.length >= 4) {
        this._a = OpCodes.Pack32BE(
          seedBytes[0] || 0,
          seedBytes[1] || 0,
          seedBytes[2] || 0,
          seedBytes[3] || 0
        );
        offset = 4;
      } else if (seedBytes.length > 0) {
        // For seeds < 4 bytes, pack what we have into a
        const bytes = [0, 0, 0, 0];
        for (let i = 0; i < seedBytes.length; ++i) {
          bytes[i] = seedBytes[i];
        }
        this._a = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
        this._ready = true;
        return;
      }

      // Read 'b' (next 4 bytes)
      if (seedBytes.length >= 8) {
        this._b = OpCodes.Pack32BE(
          seedBytes[4] || 0,
          seedBytes[5] || 0,
          seedBytes[6] || 0,
          seedBytes[7] || 0
        );
        offset = 8;
      }

      // Read 'c' (next 4 bytes)
      if (seedBytes.length >= 12) {
        this._c = OpCodes.Pack32BE(
          seedBytes[8] || 0,
          seedBytes[9] || 0,
          seedBytes[10] || 0,
          seedBytes[11] || 0
        );
        offset = 12;
      }

      // Read 'counter' (last 4 bytes)
      if (seedBytes.length >= 16) {
        this._counter = OpCodes.Pack32BE(
          seedBytes[12] || 0,
          seedBytes[13] || 0,
          seedBytes[14] || 0,
          seedBytes[15] || 0
        );
      }

      // Ensure counter is at least 1 to avoid weak initial states
      if (this._counter === 0) {
        this._counter = 1;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using SFC32 algorithm
     *
     * Algorithm from Chris Doty-Humphrey (PractRand):
     * tmp = a + b + counter
     * counter = counter + 1
     * a = b ^ (b >> 9)
     * b = c + (c << 3)
     * c = ROL(c, 21) + tmp
     * return tmp
     */
    _next32() {
      if (!this._ready) {
        throw new Error('SFC32 not initialized: set seed first');
      }

      // Step 1: tmp = a + b + counter
      let tmp = (this._a + this._b + this._counter) >>> 0;

      // Step 2: Increment counter
      this._counter = (this._counter + 1) >>> 0;

      // Step 3: a = b ^ (b >> 9)
      this._a = (this._b ^ (this._b >>> 9)) >>> 0;

      // Step 4: b = c + (c << 3)
      this._b = (this._c + (this._c << 3)) >>> 0;

      // Step 5: c = ROL(c, 21) + tmp
      // Using OpCodes for rotation
      this._c = (OpCodes.RotL32(this._c, 21) + tmp) >>> 0;

      return tmp;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('SFC32 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order)
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
    Feed(data) {
      // For PRNG, Feed can be used to skip outputs
      // Not standard for SFC32, but useful for testing
    }

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors
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
  const algorithmInstance = new SFC32Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SFC32Algorithm, SFC32Instance };
}));
