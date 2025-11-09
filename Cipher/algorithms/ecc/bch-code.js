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

    CreateInstance(isInverse = false) {
      return new BCHCodeInstance(this, isInverse);
    }
  }

  class BCHCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // BCH(7,4) generator polynomial: x^3 + x + 1 (octal 013 = binary 1011)
      this.generatorPoly = [1, 0, 1, 1]; // coefficients from high to low
    }

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

    Result() {
      if (this.result === null) {
        throw new Error('BCHCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // BCH(7,4) encoding using polynomial division
      if (data.length !== 4) {
        throw new Error('BCH encode: Input must be exactly 4 bits');
      }

      // Systematic encoding: codeword = [data, parity]
      // Multiply data by x^(n-k) and divide by generator polynomial
      const message = [...data];
      const n = 7;
      const k = 4;
      const parityBits = n - k; // 3

      // message * x^3 (shift left by 3)
      const dividend = [...message, 0, 0, 0];

      // Polynomial division to get remainder
      const remainder = this.polyDiv(dividend, this.generatorPoly);

      // Codeword = message + remainder
      return [...message, ...remainder];
    }

    decode(data) {
      // BCH(7,4) decoding with single error correction
      if (data.length !== 7) {
        throw new Error('BCH decode: Input must be exactly 7 bits');
      }

      const received = [...data];

      // Calculate syndrome by dividing received by generator
      const syndrome = this.polySyndrome(received, this.generatorPoly);

      // Check if syndrome is zero (no error)
      const hasError = syndrome.some(bit => bit !== 0);

      if (hasError) {
        console.log(`BCH: Error detected, syndrome = ${syndrome.join('')}`);

        // For BCH(7,4), we can use simple error location
        // Find error position using syndrome
        const errorPos = this.findErrorPosition(syndrome);
        if (errorPos >= 0 && errorPos < 7) {
          received[errorPos] ^= 1;
          console.log(`BCH: Corrected error at position ${errorPos}`);
        }
      }

      // Extract message bits (first k bits in systematic code)
      return received.slice(0, 4);
    }

    // Polynomial division in GF(2)
    polyDiv(dividend, divisor) {
      const result = [...dividend];
      const divisorLen = divisor.length;

      for (let i = 0; i <= result.length - divisorLen; ++i) {
        if (result[i] === 1) {
          for (let j = 0; j < divisorLen; ++j) {
            result[i + j] ^= divisor[j];
          }
        }
      }

      // Return remainder (last divisorLen-1 bits)
      return result.slice(-(divisorLen - 1));
    }

    // Calculate syndrome
    polySyndrome(codeword, generator) {
      return this.polyDiv(codeword, generator);
    }

    // Simple error position finding for BCH(7,4)
    findErrorPosition(syndrome) {
      // For BCH(7,4), map syndrome to error position
      // This is a simplified lookup - full BCH would use Chien search
      const syndromeValue = parseInt(syndrome.join(''), 2);

      // Error position lookup table for BCH(7,4)
      const positionTable = {
        3: 0,   // 011 -> position 0
        6: 1,   // 110 -> position 1
        7: 2,   // 111 -> position 2
        5: 3,   // 101 -> position 3
        1: 4,   // 001 -> position 4
        2: 5,   // 010 -> position 5
        4: 6    // 100 -> position 6
      };

      return positionTable[syndromeValue] !== undefined ? positionTable[syndromeValue] : -1;
    }

    DetectError(data) {
      if (data.length !== 7) return true;

      const syndrome = this.polySyndrome(data, this.generatorPoly);
      return syndrome.some(bit => bit !== 0);
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
