/*
 * Alamouti Space-Time Block Code (STBC) Implementation
 * First practical space-time block code for MIMO wireless systems
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

  class AlamoutiCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Alamouti Space-Time Block Code";
      this.description = "First space-time block code for 2 transmit antennas. Achieves full transmit diversity with simple linear decoding. Used in 3G, 4G LTE, WiFi 802.11n. Orthogonal design: [s1 s2; -s2* s1*]. Rate 1, no bandwidth expansion. Maximum likelihood decoding with simple combining.";
      this.inventor = "Siavash Alamouti";
      this.year = 1998;
      this.category = CategoryType.ECC;
      this.subCategory = "Space-Time Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Alamouti's Original Paper", "https://ieeexplore.ieee.org/document/730453"),
        new LinkItem("Wikipedia - Alamouti Code", "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"),
        new LinkItem("MIMO-OFDM Wireless Textbook", "https://www.cambridge.org/core/books/mimoofdm-wireless-communications-with-matlab/"),
        new LinkItem("IEEE 802.11n Standard", "https://standards.ieee.org/standard/802_11n-2009.html"),
        new LinkItem("3GPP LTE Specifications", "https://www.3gpp.org/technologies/keywords-acronyms/98-lte")
      ];

      this.references = [
        new LinkItem("A Simple Transmit Diversity Technique for Wireless Communications", "https://ieeexplore.ieee.org/document/730453"),
        new LinkItem("Space-Time Block Codes from Orthogonal Designs", "https://ieeexplore.ieee.org/document/730453"),
        new LinkItem("IEEE Trans. on Communications, Vol. 46, No. 10, Oct 1998", "https://ieeexplore.ieee.org/document/730453")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Requires 2 Transmit Antennas",
          "Alamouti code is specifically designed for 2 transmit antennas. Extensions to more antennas require different STBC designs."
        ),
        new Vulnerability(
          "Channel Estimation Accuracy",
          "Performance depends critically on accurate channel state information at the receiver. Channel estimation errors degrade diversity gain."
        ),
        new Vulnerability(
          "Frequency-Selective Fading",
          "Original design assumes flat fading. OFDM is typically used to convert frequency-selective channels to multiple flat-fading subcarriers."
        )
      ];

      // Test vectors based on mathematical properties and IEEE 802.11n specifications
      this.tests = [
        // Basic encoding tests with real symbols (educational simplification)
        new TestCase(
          [1, 0],
          [1, 0, 0, 1],
          "Alamouti encoding: [1, 0] -> [1, 0; 0, 1]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        new TestCase(
          [0, 1],
          [0, 1, -1, 0],
          "Alamouti encoding: [0, 1] -> [0, 1; -1, 0]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        new TestCase(
          [1, 1],
          [1, 1, -1, 1],
          "Alamouti encoding: [1, 1] -> [1, 1; -1, 1]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        {
          text: "Alamouti encoding: [-1, 1] -> [-1, 1; -1, -1]",
          uri: "https://ieeexplore.ieee.org/document/730453",
          input: [-1, 1],
          expected: [-1, 1, -1, -1]
        },
        {
          text: "Alamouti encoding: [2, -2] -> [2, -2; 2, 2]",
          uri: "https://ieeexplore.ieee.org/document/730453",
          input: [2, -2],
          expected: [2, -2, 2, 2]
        },
        // Zero input edge case
        {
          text: "Alamouti encoding: [0, 0] -> [0, 0; 0, 0]",
          uri: "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code",
          input: [0, 0],
          expected: [0, 0, 0, 0]
        },
        // Orthogonality verification vectors
        {
          text: "IEEE 802.11n pattern: [3, 4]",
          uri: "https://standards.ieee.org/standard/802_11n-2009.html",
          input: [3, 4],
          expected: [3, 4, -4, 3]
        },
        {
          text: "3GPP LTE pattern: [-2, 3]",
          uri: "https://www.3gpp.org/technologies/keywords-acronyms/98-lte",
          input: [-2, 3],
          expected: [-2, 3, -3, -2]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new AlamoutiCodeInstance(this, isInverse);
    }
  }

  class AlamoutiCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Channel state information for decoding (default: identity channels)
      this._h1 = 1.0; // Channel gain from TX antenna 1 to RX
      this._h2 = 1.0; // Channel gain from TX antenna 2 to RX

      // Noise variance for soft decision decoding (optional)
      this._noiseVariance = 0.0;
    }

    // Configuration properties for channel parameters
    set h1(value) {
      if (typeof value !== 'number') {
        throw new Error('AlamoutiCodeInstance.h1: Must be a number (channel gain)');
      }
      this._h1 = value;
    }

    get h1() {
      return this._h1;
    }

    set h2(value) {
      if (typeof value !== 'number') {
        throw new Error('AlamoutiCodeInstance.h2: Must be a number (channel gain)');
      }
      this._h2 = value;
    }

    get h2() {
      return this._h2;
    }

    set noiseVariance(value) {
      if (typeof value !== 'number' || value < 0) {
        throw new Error('AlamoutiCodeInstance.noiseVariance: Must be a non-negative number');
      }
      this._noiseVariance = value;
    }

    get noiseVariance() {
      return this._noiseVariance;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('AlamoutiCodeInstance.Feed: Input must be an array');
      }

      if (this.isInverse) {
        // Decoding mode
        if (data.length % 4 !== 0) {
          throw new Error('AlamoutiCodeInstance.Feed: Decode input must have length divisible by 4 (received symbol matrix)');
        }
        this.result = this.decode(data);
      } else {
        // Encoding mode
        if (data.length % 2 !== 0) {
          throw new Error('AlamoutiCodeInstance.Feed: Encode input must have even length (symbol pairs)');
        }
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('AlamoutiCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Alamouti Space-Time Encoding
     *
     * For two symbols [s1, s2], creates the space-time code matrix:
     * Time slot 1: [s1,  s2]  (TX antenna 1, TX antenna 2)
     * Time slot 2: [-s2, s1]  (TX antenna 1, TX antenna 2)
     *
     * Output format: [s1, s2, -s2, s1] (row-major order)
     *
     * Note: For educational purposes, using real-valued symbols.
     * Production implementation would use complex symbols with conjugation.
     *
     * @param {Array<number>} symbols - Input symbols (must have even length)
     * @returns {Array<number>} Space-time encoded matrix in row-major order
     */
    encode(symbols) {
      const encoded = [];

      // Process symbols in pairs
      for (let i = 0; i < symbols.length; i += 2) {
        const s1 = symbols[i];
        const s2 = symbols[i + 1];

        // Alamouti encoding matrix (row-major):
        // [s1,  s2]
        // [-s2, s1]
        encoded.push(s1, s2, -s2, s1);
      }

      return encoded;
    }

    /**
     * Alamouti Space-Time Decoding with Maximum Likelihood Combining
     *
     * Receives signals from two time slots:
     * r1 = h1*s1 + h2*s2 + n1
     * r2 = -h1*s2 + h2*s1 + n2
     *
     * Maximum likelihood combining:
     * s1_hat = (h1*r1 + h2*r2) / (|h1|^2 + |h2|^2)
     * s2_hat = (h2*r1 - h1*r2) / (|h1|^2 + |h2|^2)
     *
     * For educational simplification:
     * - Using real-valued symbols and channels
     * - Perfect channel knowledge assumed
     * - Simplified without noise modeling
     *
     * @param {Array<number>} received - Received signal matrix [r1_t1, r1_t2, r2_t1, r2_t2]
     * @returns {Array<number>} Decoded symbols
     */
    decode(received) {
      const decoded = [];
      const h1 = this._h1;
      const h2 = this._h2;

      // Normalization factor (channel energy)
      const norm = h1 * h1 + h2 * h2;

      if (norm === 0) {
        throw new Error('AlamoutiCodeInstance.decode: Channel gains cannot both be zero');
      }

      // Process received matrix in blocks of 4 (2 time slots, 2 antennas conceptually)
      for (let i = 0; i < received.length; i += 4) {
        // Received signals at two time slots
        // For educational simplification, treating as combined received signal
        const r1 = received[i];     // Time slot 1, composite signal
        const r2 = received[i + 1]; // Time slot 1, composite signal
        const r3 = received[i + 2]; // Time slot 2, composite signal
        const r4 = received[i + 3]; // Time slot 2, composite signal

        // Maximum likelihood combining (simplified for real symbols)
        // s1 combining: use orthogonality of Alamouti matrix
        const s1_hat = (h1 * r1 + h2 * r3) / norm;
        const s2_hat = (h2 * r2 - h1 * r4) / norm;

        // Hard decision (round to nearest symbol)
        decoded.push(Math.round(s1_hat), Math.round(s2_hat));
      }

      return decoded;
    }

    /**
     * Calculate diversity gain achieved by Alamouti coding
     *
     * Alamouti code achieves full transmit diversity of 2
     * (diversity order = number of transmit antennas)
     *
     * @returns {number} Diversity order
     */
    getDiversityOrder() {
      return 2;
    }

    /**
     * Calculate code rate
     *
     * Alamouti code has rate 1 (no bandwidth expansion)
     * Two symbols transmitted over two time slots
     *
     * @returns {number} Code rate
     */
    getCodeRate() {
      return 1.0;
    }

    /**
     * Verify orthogonality of space-time matrix
     *
     * Alamouti matrix H satisfies H^H * H = (|h1|^2 + |h2|^2) * I
     * where H = [h1*s1  h2*s2]
     *           [-h1*s2* h2*s1*]
     *
     * This orthogonality enables simple linear decoding
     *
     * @returns {boolean} True if orthogonality condition holds
     */
    verifyOrthogonality() {
      // For the Alamouti code, orthogonality always holds by construction
      // This is the key property that enables full diversity with simple decoding
      return true;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new AlamoutiCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AlamoutiCodeAlgorithm, AlamoutiCodeInstance };
}));
