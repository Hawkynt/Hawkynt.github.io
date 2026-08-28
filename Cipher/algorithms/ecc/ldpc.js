/*
 * LDPC (Low-Density Parity-Check) Implementation
 * Educational implementation of LDPC error correction codes
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class LDPCAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LDPC";
      this.description = "Low-Density Parity-Check (LDPC) codes using sparse parity-check matrices for efficient error correction. Modern error correction technique used in WiFi, DVB-S2, and 5G. Educational implementation demonstrating belief propagation decoding.";
      this.inventor = "Robert Gallager";
      this.year = 1962;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - LDPC Code", "https://en.wikipedia.org/wiki/Low-density_parity-check_code"),
        new LinkItem("LDPC Tutorial", "https://www.mathworks.com/help/comm/ug/ldpc-encoder-and-decoder.html"),
        new LinkItem("Belief Propagation", "https://en.wikipedia.org/wiki/Belief_propagation")
      ];

      this.references = [
        new LinkItem("Gallager's Original Thesis", "https://dspace.mit.edu/handle/1721.1/11242"),
        new LinkItem("Modern LDPC Codes", "https://ieeexplore.ieee.org/document/910572"),
        new LinkItem("IEEE 802.11n Standard", "https://standards.ieee.org/standard/802_11n-2009.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Iterative decoding algorithms have high computational complexity and may not converge"
        ),
        new Vulnerability(
          "Error Floor Phenomenon",
          "Performance degradation at very low error rates due to near-codewords"
        )
      ];

      // Test vectors for basic LDPC functionality
      this.tests = [
        new TestCase(
          [0, 0, 0, 0], // 4-bit data
          [0, 0, 0, 0, 0, 0, 0], // 7-bit encoded (simplified)
          "LDPC basic encoding test",
          "https://en.wikipedia.org/wiki/Low-density_parity-check_code"
        ),
        new TestCase(
          [1, 0, 1, 0], // 4-bit data
          [1, 0, 1, 0, 0, 1, 0], // 7-bit encoded (corrected)
          "LDPC pattern encoding test", 
          "https://en.wikipedia.org/wiki/Low-density_parity-check_code"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LDPCInstance(this, isInverse);
    }
  }

  /**
 * LDPC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LDPCInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Simple (7,4) parity-check matrix in systematic form H = [P | I].
      //
      // The encoder below derives each parity bit from the first k columns of
      // this matrix and appends it, which produces the codeword c = [d | P*d].
      // For H*c^T to vanish on those codewords the trailing n-k columns must be
      // the identity, so that H*c^T = P*d + I*(P*d) = 0. They previously held a
      // lower-triangular block instead, which put the encoder and the decoder on
      // two different codes: 12 of the 16 codewords the encoder emitted had a
      // non-zero syndrome, so the decoder declared errors in error-free words
      // and "corrected" them into different messages.
      this.parityMatrix = [
        [1, 1, 1, 0, 1, 0, 0],
        [1, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 0, 1]
      ];
      this.n = 7; // code length
      this.k = 4; // information length
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('LDPCInstance.Feed: Input must be bit array');
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
        throw new Error('LDPCInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.n) {
        throw new Error(`LDPCInstance.DetectError: Input must be ${this.n}-bit array`);
      }

      const syndrome = this.calculateSyndrome(data);
      return !this.isZeroVector(syndrome);
    }

    encode(data) {
      // Simplified LDPC systematic encoding
      if (data.length !== this.k) {
        throw new Error(`LDPC encode: Input must be exactly ${this.k} bits`);
      }

      const encoded = new Array(this.n);

      // Copy information bits to systematic positions
      for (let i = 0; i < this.k; i++) {
        encoded[i] = data[i];
      }

      // Calculate parity bits using simplified method
      for (let i = 0; i < this.n - this.k; i++) {
        let parity = 0;
        for (let j = 0; j < this.k; j++) {
          parity = OpCodes.XorN(parity, (this.parityMatrix[i][j] * data[j]));
        }
        encoded[this.k + i] = parity;
      }

      return encoded;
    }

    decode(data) {
      // Simplified LDPC decoding (not full belief propagation)
      if (data.length !== this.n) {
        throw new Error(`LDPC decode: Input must be exactly ${this.n} bits`);
      }

      const received = [...data];
      const syndrome = this.calculateSyndrome(received);

      if (this.isZeroVector(syndrome)) {
        // No errors detected
        return received.slice(0, this.k); // Extract information bits
      }

      // A single error in position j produces exactly column j of the
      // parity-check matrix as its syndrome, so the syndrome identifies the
      // flipped bit whenever that column is unique. The previous routine
      // instead flipped the first bit participating in each violated check,
      // which is not a decoder at all: it returned whatever bits that walk
      // happened to produce and presented them as a corrected message.
      const errorPosition = this._locateSingleError(syndrome);

      if (errorPosition < 0) {
        // The syndrome is not any single-column pattern, or it matches more
        // than one column and so does not identify a unique error. Either way
        // the damage is outside what this code can resolve. Report that rather
        // than handing back bits that are known to be wrong.
        throw new Error('LDPC decode: syndrome does not identify a correctable error pattern; the received word is uncorrectable');
      }

      received[errorPosition] = OpCodes.XorN(received[errorPosition], 1);

      return received.slice(0, this.k); // Extract information bits
    }

    calculateSyndrome(data) {
      const syndrome = new Array(this.parityMatrix.length);

      for (let i = 0; i < this.parityMatrix.length; i++) {
        let sum = 0;
        for (let j = 0; j < this.n; j++) {
          sum = OpCodes.XorN(sum, (this.parityMatrix[i][j] * data[j]));
        }
        syndrome[i] = sum;
      }

      return syndrome;
    }

    isZeroVector(vector) {
      return vector.every(bit => bit === 0);
    }

    /**
   * Match a syndrome against the columns of the parity-check matrix.
   * @param {uint8[]} syndrome - Syndrome vector
   * @returns {number} Index of the single flipped bit, or -1 when the syndrome
   *   matches no column or matches several and is therefore ambiguous.
   */

    _locateSingleError(syndrome) {
      let match = -1;

      for (let j = 0; j < this.n; ++j) {
        let identical = true;
        for (let i = 0; i < this.parityMatrix.length; ++i) {
          if (this.parityMatrix[i][j] !== syndrome[i]) {
            identical = false;
            break;
          }
        }

        if (identical) {
          if (match >= 0) {
            // Two positions share this syndrome, so it cannot single one out.
            // Columns 2 and 4 of this matrix coincide, which is why the code
            // has minimum distance 2 and detects a single error without being
            // able to correct every one of them.
            return -1;
          }
          match = j;
        }
      }

      return match;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LDPCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LDPCAlgorithm, LDPCInstance };
}));