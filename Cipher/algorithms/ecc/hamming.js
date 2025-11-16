/*
 * Hamming Code Implementation (Parametrized)
 * Supports standard, extended (SECDED), and shortened Hamming codes
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class HammingAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Hamming Code";
      this.description = "Parametrized Hamming error correction codes supporting standard (7,4), (15,11), (31,26) variants, extended SECDED variants with overall parity, and shortened versions. Single-bit error correction using parity bits at power-of-2 positions.";
      this.inventor = "Richard Hamming";
      this.year = 1950;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Hamming Code", "https://en.wikipedia.org/wiki/Hamming_code"),
        new LinkItem("Hamming Code Tutorial", "https://www.tutorialspoint.com/hamming-code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/hamming")
      ];

      this.references = [
        new LinkItem("Hamming's Original Paper", "https://ieeexplore.ieee.org/document/6772729"),
        new LinkItem("Bell Labs Technical Journal", "https://archive.org/details/bstj29-2-147"),
        new LinkItem("Shortened Hamming Optimization", "https://www.researchgate.net/publication/262562757_Optimization_of_shortened_Hamming_codes")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Single Error Correction Only",
          "Standard Hamming codes can only correct single-bit errors. Extended versions (SECDED) can detect double errors."
        ),
        new Vulnerability(
          "Limited Error Detection",
          "Cannot reliably detect burst errors or certain patterns of multiple errors."
        )
      ];

      // Test vectors for various Hamming configurations
      this.tests = [
        // Standard Hamming (7,4)
        new TestCase(
          [0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          "Hamming (7,4) all zeros",
          "https://en.wikipedia.org/wiki/Hamming_code"
        ),
        new TestCase(
          [1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1],
          "Hamming (7,4) all ones",
          "https://en.wikipedia.org/wiki/Hamming_code"
        ),
        new TestCase(
          [1, 0, 1, 0],
          [1, 0, 1, 1, 0, 1, 0],
          "Hamming (7,4) pattern",
          "https://en.wikipedia.org/wiki/Hamming_code"
        ),
        // Extended Hamming (8,4) - SECDED
        {
          text: "Extended Hamming (8,4) SECDED zeros",
          uri: "https://en.wikipedia.org/wiki/Hamming_code",
          parityBits: 3,
          extended: true,
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Extended Hamming (8,4) SECDED ones",
          uri: "https://en.wikipedia.org/wiki/Hamming_code",
          parityBits: 3,
          extended: true,
          input: [1, 1, 1, 1],
          expected: [1, 1, 1, 1, 1, 1, 1, 1]
        },
        // Shortened Hamming (6,3)
        {
          text: "Shortened Hamming (6,3) zeros",
          uri: "https://www.researchgate.net/publication/262562757_Optimization_of_shortened_Hamming_codes",
          parityBits: 3,
          shortened: 1,
          input: [0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0]
        },
        {
          text: "Shortened Hamming (6,3) pattern",
          uri: "https://www.researchgate.net/publication/262562757_Optimization_of_shortened_Hamming_codes",
          parityBits: 3,
          shortened: 1,
          input: [1, 0, 1],
          expected: [1, 0, 1, 1, 0, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new HammingInstance(this, isInverse);
    }
  }

  /**
 * Hamming cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HammingInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Default configuration: Hamming (7,4)
      this._parityBits = 3; // r=3 gives (7,4)
      this._extended = false; // SECDED adds overall parity
      this._shortened = 0; // Number of bits to remove
    }

    // Configuration properties
    set parityBits(r) {
      if (r < 2 || r > 5) {
        throw new Error('HammingInstance.parityBits: Must be between 2 and 5');
      }
      this._parityBits = r;
    }

    get parityBits() {
      return this._parityBits;
    }

    set extended(value) {
      this._extended = !!value;
    }

    get extended() {
      return this._extended;
    }

    set shortened(value) {
      if (value < 0 || value > 4) {
        throw new Error('HammingInstance.shortened: Must be between 0 and 4');
      }
      this._shortened = value;
    }

    get shortened() {
      return this._shortened;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('HammingInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('HammingInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      const r = this._parityBits;
      const n = (1 << r) - 1 - this._shortened; // Total bits after shortening
      const k = n - r; // Data bits (extended parity is added after, doesn't affect k)

      if (data.length !== k) {
        throw new Error(`Hamming encode: Input must be exactly ${k} bits for this configuration`);
      }

      // Standard Hamming encoding
      const fullN = (1 << r) - 1;
      const encoded = new Array(fullN).fill(0);

      // Place data bits (skipping power-of-2 positions)
      let dataIdx = 0;
      for (let i = 1; i <= fullN; ++i) {
        if ((i & (i - 1)) !== 0) { // Not a power of 2
          if (dataIdx < data.length) {
            encoded[i - 1] = data[dataIdx++];
          }
        }
      }

      // Calculate parity bits
      for (let p = 0; p < r; ++p) {
        const pos = 1 << p;
        let parity = 0;
        for (let i = 1; i <= fullN; ++i) {
          if ((i & pos) !== 0) {
            parity ^= encoded[i - 1];
          }
        }
        encoded[pos - 1] = parity;
      }

      // Apply shortening (remove last bits)
      let result = encoded.slice(0, n);

      // Add overall parity for extended (SECDED)
      if (this._extended) {
        const overallParity = result.reduce((p, bit) => p ^ bit, 0);
        result.push(overallParity);
      }

      return result;
    }

    decode(data) {
      const r = this._parityBits;
      const expectedLen = (1 << r) - 1 - this._shortened + (this._extended ? 1 : 0);

      if (data.length !== expectedLen) {
        throw new Error(`Hamming decode: Input must be exactly ${expectedLen} bits for this configuration`);
      }

      let received = [...data];
      let overallParity = 0;

      // Check overall parity for extended codes
      if (this._extended) {
        overallParity = received.reduce((p, bit) => p ^ bit, 0);
        received = received.slice(0, -1); // Remove overall parity bit
      }

      // Pad if shortened
      if (this._shortened > 0) {
        received = [...received, ...new Array(this._shortened).fill(0)];
      }

      // Calculate syndrome
      let syndrome = 0;
      for (let p = 0; p < r; ++p) {
        const pos = 1 << p;
        let parity = 0;
        const fullN = (1 << r) - 1;
        for (let i = 1; i <= fullN; ++i) {
          if ((i & pos) !== 0) {
            parity ^= received[i - 1];
          }
        }
        if (parity !== 0) {
          syndrome |= pos;
        }
      }

      // Error correction
      if (this._extended) {
        // SECDED logic
        if (syndrome === 0 && overallParity === 0) {
          // No error
        } else if (syndrome === 0 && overallParity !== 0) {
          // Error in overall parity only
          console.log('Hamming SECDED: Overall parity error detected');
        } else if (syndrome !== 0 && overallParity !== 0) {
          // Single bit error (correctable)
          console.log(`Hamming SECDED: Single error at position ${syndrome}, correcting...`);
          if (syndrome > 0 && syndrome <= received.length) {
            received[syndrome - 1] ^= 1;
          }
        } else {
          // Double bit error (detectable, not correctable)
          throw new Error('Hamming SECDED: Double bit error detected - cannot correct');
        }
      } else {
        // Standard Hamming correction
        if (syndrome !== 0) {
          console.log(`Hamming: Error at position ${syndrome}, correcting...`);
          if (syndrome > 0 && syndrome <= received.length) {
            received[syndrome - 1] ^= 1;
          }
        }
      }

      // Remove padding
      if (this._shortened > 0) {
        received = received.slice(0, -this._shortened);
      }

      // Extract data bits (skip power-of-2 positions)
      const result = [];
      const fullN = (1 << r) - 1;
      for (let i = 1; i <= fullN && result.length < data.length - (this._extended ? 1 : 0) - r; ++i) {
        if ((i & (i - 1)) !== 0) { // Not a power of 2
          if (i - 1 < received.length) {
            result.push(received[i - 1]);
          }
        }
      }

      return result;
    }

    DetectError(data) {
      const r = this._parityBits;
      const expectedLen = (1 << r) - 1 - this._shortened + (this._extended ? 1 : 0);

      if (data.length !== expectedLen) return true;

      let received = [...data];

      if (this._extended) {
        const overallParity = received.reduce((p, bit) => p ^ bit, 0);
        received = received.slice(0, -1);

        // Pad if shortened
        if (this._shortened > 0) {
          received = [...received, ...new Array(this._shortened).fill(0)];
        }

        let syndrome = 0;
        const fullN = (1 << r) - 1;
        for (let p = 0; p < r; ++p) {
          const pos = 1 << p;
          let parity = 0;
          for (let i = 1; i <= fullN; ++i) {
            if ((i & pos) !== 0) {
              parity ^= received[i - 1];
            }
          }
          if (parity !== 0) {
            syndrome |= pos;
          }
        }

        return syndrome !== 0 || overallParity !== 0;
      } else {
        // Pad if shortened
        if (this._shortened > 0) {
          received = [...received, ...new Array(this._shortened).fill(0)];
        }

        let syndrome = 0;
        const fullN = (1 << r) - 1;
        for (let p = 0; p < r; ++p) {
          const pos = 1 << p;
          let parity = 0;
          for (let i = 1; i <= fullN; ++i) {
            if ((i & pos) !== 0) {
              parity ^= received[i - 1];
            }
          }
          if (parity !== 0) {
            syndrome |= pos;
          }
        }

        return syndrome !== 0;
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new HammingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HammingAlgorithm, HammingInstance };
}));
