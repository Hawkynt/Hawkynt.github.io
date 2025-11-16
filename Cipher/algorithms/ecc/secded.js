/*
 * SECDED (Single Error Correction, Double Error Detection) Implementation
 * Extended Hamming code with additional parity bit
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

  class SECDEDAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SECDED";
      this.description = "Extended Hamming code providing Single Error Correction and Double Error Detection. Used in ECC RAM and critical storage systems. Achieves Hamming distance of 4 through additional parity bit.";
      this.inventor = "Richard Hamming (Extended)";
      this.year = 1961;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Hamming Code", "https://en.wikipedia.org/wiki/Hamming_code"),
        new LinkItem("SECDED Code in DRAM", "https://www.researchgate.net/publication/372210291_SECDED_code_and_its_extended_applications_in_DRAM_system"),
        new LinkItem("Error Correction Tutorial", "http://lumetta.web.engr.illinois.edu/120-S19/slide-copies/142-error-correction-and-hamming-codes.pdf")
      ];

      this.references = [
        new LinkItem("IBM 7030 Stretch", "https://en.wikipedia.org/wiki/IBM_7030_Stretch"),
        new LinkItem("ECC Memory", "https://en.wikipedia.org/wiki/ECC_memory"),
        new LinkItem("Error Correcting Codes", "https://www.jameswhanlon.com/error-correcting-codes.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Double Error Detection Only",
          "Can detect but not correct double-bit errors. Triple errors may be miscorrected as single errors."
        ),
        new Vulnerability(
          "Burst Error Weakness",
          "Not optimized for burst errors affecting consecutive bits."
        )
      ];

      // Test vectors for SECDED (8,4) code - Extended Hamming (7,4)
      this.tests = [
        new TestCase(
          [0, 0, 0, 0], // 4-bit data
          [0, 0, 0, 0, 0, 0, 0, 0], // 8-bit SECDED encoded
          "SECDED (8,4) all zeros",
          "https://en.wikipedia.org/wiki/Hamming_code"
        ),
        new TestCase(
          [1, 1, 1, 1], // 4-bit data
          [1, 1, 1, 1, 1, 1, 1, 1], // 8-bit SECDED encoded
          "SECDED (8,4) all ones",
          "https://en.wikipedia.org/wiki/Hamming_code"
        ),
        new TestCase(
          [1, 0, 1, 0], // 4-bit data
          [0, 1, 0, 1, 1, 0, 1, 0], // 8-bit SECDED encoded
          "SECDED (8,4) pattern test",
          "https://en.wikipedia.org/wiki/Hamming_code"
        ),
        new TestCase(
          [0, 1, 0, 1], // 4-bit data
          [1, 0, 1, 0, 0, 1, 0, 1], // 8-bit SECDED encoded
          "SECDED (8,4) alternating pattern",
          "https://en.wikipedia.org/wiki/Hamming_code"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SECDEDInstance(this, isInverse);
    }
  }

  /**
 * SECDED cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SECDEDInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SECDEDInstance.Feed: Input must be bit array');
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
        throw new Error('SECDEDInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      if (!Array.isArray(data) || data.length !== 8) {
        throw new Error('SECDEDInstance.DetectError: Input must be 8-bit array');
      }

      const syndrome = this.calculateSyndrome(data);
      const overallParity = this.calculateOverallParity(data);

      // syndrome = 0, parity = 0 -> no error
      // syndrome = 0, parity = 1 -> parity bit error
      // syndrome != 0, parity = 1 -> single error (correctable)
      // syndrome != 0, parity = 0 -> double error (detectable, not correctable)

      return syndrome !== 0 || overallParity !== 0;
    }

    encode(data) {
      // SECDED (8,4) encoding - Extended Hamming (7,4) + overall parity
      if (data.length !== 4) {
        throw new Error('SECDED encode: Input must be exactly 4 bits');
      }

      const [d1, d2, d3, d4] = data;
      const encoded = new Array(8);

      // First encode as Hamming (7,4)
      // Data bits go to positions 3, 5, 6, 7 (1-indexed in Hamming)
      encoded[3] = d1; // position 4 in SECDED (position 3 in Hamming)
      encoded[5] = d2; // position 6 in SECDED (position 5 in Hamming)
      encoded[6] = d3; // position 7 in SECDED (position 6 in Hamming)
      encoded[7] = d4; // position 8 in SECDED (position 7 in Hamming)

      // Hamming parity bits at positions 1, 2, 4 (1-indexed in Hamming)
      encoded[1] = d1 ^ d2 ^ d4; // position 2 in SECDED (p1 in Hamming)
      encoded[2] = d1 ^ d3 ^ d4; // position 3 in SECDED (p2 in Hamming)
      encoded[4] = d2 ^ d3 ^ d4; // position 5 in SECDED (p4 in Hamming)

      // Overall parity bit at position 0 (covers all 7 Hamming bits)
      encoded[0] = encoded[1] ^ encoded[2] ^ encoded[3] ^ encoded[4] ^
                   encoded[5] ^ encoded[6] ^ encoded[7];

      return encoded;
    }

    decode(data) {
      // SECDED (8,4) decoding with single error correction and double error detection
      if (data.length !== 8) {
        throw new Error('SECDED decode: Input must be exactly 8 bits');
      }

      const received = [...data];
      const syndrome = this.calculateSyndrome(received);
      const overallParity = this.calculateOverallParity(received);

      if (syndrome === 0 && overallParity === 0) {
        // No error
      } else if (syndrome === 0 && overallParity !== 0) {
        // Error in overall parity bit (position 0)
        console.log('SECDED: Parity bit error detected and corrected');
        received[0] ^= 1;
      } else if (syndrome !== 0 && overallParity !== 0) {
        // Single bit error in Hamming portion (correctable)
        // Syndrome indicates position in 1-indexed Hamming code
        // Map to SECDED positions: 1->1, 2->2, 3->3, 4->4, 5->5, 6->6, 7->7
        const errorPos = syndrome;
        console.log(`SECDED: Single error at position ${errorPos + 1}, correcting...`);
        if (errorPos >= 1 && errorPos <= 7) {
          received[errorPos] ^= 1;
        }
      } else if (syndrome !== 0 && overallParity === 0) {
        // Double bit error detected (cannot correct)
        throw new Error('SECDED: Double bit error detected - cannot correct');
      }

      // Extract data bits from positions 4, 6, 7, 8 (1-indexed)
      return [received[3], received[5], received[6], received[7]];
    }

    calculateSyndrome(data) {
      // Calculate Hamming syndrome from positions 1-7 (indices 1-7)
      const s1 = data[1] ^ data[3] ^ data[5] ^ data[7]; // p1 XOR positions 3,5,7
      const s2 = data[2] ^ data[3] ^ data[6] ^ data[7]; // p2 XOR positions 3,6,7
      const s4 = data[4] ^ data[5] ^ data[6] ^ data[7]; // p4 XOR positions 5,6,7

      // Syndrome indicates error position in Hamming code (1-indexed)
      return s1 + (s2 << 1) + (s4 << 2);
    }

    calculateOverallParity(data) {
      // XOR all bits including overall parity bit
      return data.reduce((parity, bit) => parity ^ bit, 0);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new SECDEDAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SECDEDAlgorithm, SECDEDInstance };
}));
