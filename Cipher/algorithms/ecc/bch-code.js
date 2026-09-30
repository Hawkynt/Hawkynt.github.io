/*
 * BCH Code (Bose-Chaudhuri-Hocquenghem) Implementation
 * Powerful cyclic error-correcting codes
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

  class BCHCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCH Code";
      this.description = "Bose-Chaudhuri-Hocquenghem cyclic error-correcting codes constructed using polynomials over Galois fields. Can correct multiple random errors with efficient encoding and decoding. Widely used in satellite communications, QR codes, and storage devices.";
      this.inventor = "Raj Chandra Bose, D. K. Ray-Chaudhuri, Alexis Hocquenghem";
      this.year = 1960;
      this.category = CategoryType.ECC;
      this.subCategory = "Cyclic Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - BCH Code", "https://en.wikipedia.org/wiki/BCH_code"),
        new LinkItem("Error Correction Zoo", "https://errorcorrectionzoo.org/c/q-ary_bch"),
        new LinkItem("VOCAL Technologies", "https://vocal.com/error-correction/bch-codes/")
      ];

      this.references = [
        new LinkItem("BCH Code Tutorial", "https://web.ntpu.edu.tw/~yshan/BCH_code.pdf"),
        new LinkItem("Hardware Implementation", "https://www.researchgate.net/publication/268255309_Hardware_Implementation_of_BCH_Error-Correcting_Codes_on_a_FPGA"),
        new LinkItem("Step-by-step Decoding", "https://www.semanticscholar.org/paper/Step-by-step-decoding-of-the-Bose-Chaudhuri-codes-Massey/0715d789cbacaa47ac2cf28f9fb3d5c55158b027")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Full Berlekamp-Massey or Euclidean algorithm decoding requires complex polynomial operations."
        ),
        new Vulnerability(
          "Limited to t Errors",
          "Can only correct up to t errors as designed. More errors may cause miscorrection."
        )
      ];

      // Test vectors for BCH(7,4) - simplest BCH code (equivalent to Hamming)
      this.tests = [
        {
          text: "BCH(7,4) all zeros",
          uri: "https://en.wikipedia.org/wiki/BCH_code",
          input: [0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "BCH(7,4) all ones",
          uri: "https://en.wikipedia.org/wiki/BCH_code",
          input: [1, 1, 1, 1],
          expected: [1, 1, 1, 1, 1, 1, 1]
        },
        {
          text: "BCH(7,4) pattern test",
          uri: "https://en.wikipedia.org/wiki/BCH_code",
          input: [1, 0, 1, 0],
          expected: [1, 0, 1, 0, 0, 1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BCHCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BCHCodeInstance(this, isInverse);
    }
  }

  /**
 * BCHCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BCHCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {BCHCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // BCH(7,4) generator polynomial: x^3 + x + 1 (octal 013 = binary 1011)
      /** @type {uint8[]} */
      this.generatorPoly = [1, 0, 1, 1]; // coefficients from high to low
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BCHCodeInstance.Feed: Input must be bit array');
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
        throw new Error('BCHCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * @param {uint8[]} data - Message symbols
     * @returns {uint8[]} Codeword symbols
     */
    encode(data) {
      // BCH(7,4) encoding using polynomial division
      if (data.length !== 4) {
        throw new Error('BCH encode: Input must be exactly 4 bits');
      }

      // Systematic encoding: codeword = [data, parity]
      // Multiply data by x^(n-k) and divide by generator polynomial
      /** @type {uint8[]} */
      const message = data.slice();
      const n = 7;
      const k = 4;
      const parityBits = n - k; // 3

      // message * x^3 (shift left by 3)
      /** @type {uint8[]} */
      const dividend = message.slice();
      for (let i = 0; i < parityBits; ++i) dividend.push(0);

      // Polynomial division to get remainder
      /** @type {uint8[]} */
      const remainder = this.polyDiv(dividend, this.generatorPoly);

      // Codeword = message + remainder
      /** @type {uint8[]} */
      const codeword = message.slice();
      for (let i = 0; i < remainder.length; ++i) codeword.push(remainder[i]);
      return codeword;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {uint8[]} Decoded message symbols
     */
    decode(data) {
      // BCH(7,4) decoding with single error correction
      if (data.length !== 7) {
        throw new Error('BCH decode: Input must be exactly 7 bits');
      }

      /** @type {uint8[]} */
      const received = data.slice();

      // Calculate syndrome by dividing received by generator
      /** @type {uint8[]} */
      const syndrome = this.polySyndrome(received, this.generatorPoly);

      // Check if syndrome is zero (no error)
      /** @type {boolean} */
      const hasError = this._isNonZero(syndrome);

      if (hasError) {
        console.log("BCH: Error detected, syndrome = " + (syndrome.join('')));

        // For BCH(7,4), we can use simple error location
        // Find error position using syndrome
        /** @type {int32} */
        const errorPos = this.findErrorPosition(syndrome);
        if (errorPos >= 0 && errorPos < 7) {
          received[errorPos] = OpCodes.Xor32(received[errorPos], 1);
          console.log("BCH: Corrected error at position " + errorPos);
        }
      }

      // Extract message bits (first k bits in systematic code)
      return received.slice(0, 4);
    }

    // Polynomial division in GF(2)
    /**
     * @param {uint8[]} dividend - Dividend coefficients, high to low
     * @param {uint8[]} divisor - Divisor coefficients, high to low
     * @returns {uint8[]} Remainder
     */
    polyDiv(dividend, divisor) {
      /** @type {uint8[]} */
      const result = dividend.slice();
      const divisorLen = divisor.length;

      for (let i = 0; i <= result.length - divisorLen; ++i) {
        if (result[i] === 1) {
          for (let j = 0; j < divisorLen; ++j) {
            result[i + j] = OpCodes.Xor32(result[i + j], divisor[j]);
          }
        }
      }

      // Return remainder (last divisorLen-1 bits)
      return result.slice(-(divisorLen - 1));
    }

    // Calculate syndrome
    /**
     * @param {uint8[]} codeword - Received codeword
     * @param {uint8[]} generator - Generator polynomial
     * @returns {uint8[]} Syndrome bits
     */
    polySyndrome(codeword, generator) {
      return this.polyDiv(codeword, generator);
    }

    // Simple error position finding for BCH(7,4)
    /**
     * @param {uint8[]} syndrome - Syndrome bits
     * @returns {int32} Error position, -1 when the syndrome names none
     */
    findErrorPosition(syndrome) {
      // For BCH(7,4), map syndrome to error position
      // This is a simplified lookup - full BCH would use Chien search
      /** @type {string} */
      const syndromeBits = syndrome.join('');
      /** @type {int32} */
      const syndromeValue = parseInt(syndromeBits, 2);

      // Error position lookup table for BCH(7,4), indexed by syndrome value:
      // 001 -> 4, 010 -> 5, 011 -> 0, 100 -> 6, 101 -> 3, 110 -> 1, 111 -> 2
      /** @type {int32[]} */
      const positionTable = [-1, 4, 5, 0, 6, 3, 1, 2];

      return syndromeValue >= 1 && syndromeValue <= 7 ? positionTable[syndromeValue] : -1;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (data.length !== 7) return true;

      /** @type {uint8[]} */
      const syndrome = this.polySyndrome(data, this.generatorPoly);
      return this._isNonZero(syndrome);
    }

    /**
     * @param {uint8[]} bits - Syndrome bits
     * @returns {boolean} True when any entry is non-zero
     */
    _isNonZero(bits) {
      for (let i = 0; i < bits.length; ++i) {
        if (bits[i] !== 0) return true;
      }
      return false;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new BCHCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BCHCodeAlgorithm, BCHCodeInstance };
}));
