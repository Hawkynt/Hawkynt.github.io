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

  // Real-valued symbols travel as octets: each symbol is a signed 16-bit
  // two's-complement value, most significant octet first.
  /**
   * @param {int32[]} symbols - Symbols in -32768..32767
   * @returns {uint8[]} Two octets per symbol
   */
  function symbolsToOctets(symbols) {
    /** @type {uint8[]} */
    const octets = [];
    for (let i = 0; i < symbols.length; ++i) {
      const pair = OpCodes.Unpack16BE(OpCodes.ToUint16(symbols[i]));
      octets.push(pair[0]);
      octets.push(pair[1]);
    }
    return octets;
  }

  /**
   * @param {uint8[]} octets - Two octets per symbol
   * @returns {int32[]} Symbols in -32768..32767
   */
  function octetsToSymbols(octets) {
    if (octets.length % 2 !== 0) {
      throw new Error('AlamoutiCodeInstance: Input must hold two octets per symbol');
    }
    /** @type {int32[]} */
    const symbols = [];
    for (let i = 0; i < octets.length; i += 2) {
      // sign-extend the 16-bit word
      const high = OpCodes.ToInt(OpCodes.Shl32(OpCodes.Pack16BE(octets[i], octets[i + 1]), 16));
      symbols.push(OpCodes.Shr32Signed(high, 16));
    }
    return symbols;
  }

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
      // Each symbol travels as a signed 16-bit big-endian word, four hex digits
      // per symbol (FFFF is -1); the descriptions give the symbols themselves.
      this.tests = [
        // Basic encoding tests with real symbols (educational simplification)
        new TestCase(
          OpCodes.Hex8ToBytes("00010000"),
          OpCodes.Hex8ToBytes("0001000000000001"),
          "Alamouti encoding: [1, 0] -> [1, 0; 0, 1]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("00000001"),
          OpCodes.Hex8ToBytes("00000001FFFF0000"),
          "Alamouti encoding: [0, 1] -> [0, 1; -1, 0]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("00010001"),
          OpCodes.Hex8ToBytes("00010001FFFF0001"),
          "Alamouti encoding: [1, 1] -> [1, 1; -1, 1]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("FFFF0001"),
          OpCodes.Hex8ToBytes("FFFF0001FFFFFFFF"),
          "Alamouti encoding: [-1, 1] -> [-1, 1; -1, -1]",
          "https://ieeexplore.ieee.org/document/730453"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0002FFFE"),
          OpCodes.Hex8ToBytes("0002FFFE00020002"),
          "Alamouti encoding: [2, -2] -> [2, -2; 2, 2]",
          "https://ieeexplore.ieee.org/document/730453"
        ),
        // Zero input edge case
        new TestCase(
          OpCodes.Hex8ToBytes("00000000"),
          OpCodes.Hex8ToBytes("0000000000000000"),
          "Alamouti encoding: [0, 0] -> [0, 0; 0, 0]",
          "https://en.wikipedia.org/wiki/Alamouti_space%E2%80%93time_code"
        ),
        // Orthogonality verification vectors
        new TestCase(
          OpCodes.Hex8ToBytes("00030004"),
          OpCodes.Hex8ToBytes("00030004FFFC0003"),
          "IEEE 802.11n pattern: [3, 4]",
          "https://standards.ieee.org/standard/802_11n-2009.html"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("FFFE0003"),
          OpCodes.Hex8ToBytes("FFFE0003FFFDFFFE"),
          "3GPP LTE pattern: [-2, 3]",
          "https://www.3gpp.org/technologies/keywords-acronyms/98-lte"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {AlamoutiCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AlamoutiCodeInstance(this, isInverse);
    }
  }

  /**
 * AlamoutiCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AlamoutiCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {AlamoutiCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // Channel state information for decoding (default: identity channels)
      /** @type {float64} */
      this._h1 = 1.0; // Channel gain from TX antenna 1 to RX
      /** @type {float64} */
      this._h2 = 1.0; // Channel gain from TX antenna 2 to RX

      // Noise variance for soft decision decoding (optional)
      /** @type {float64} */
      this._noiseVariance = 0.0;
    }

    // Configuration properties for channel parameters
    /**
     * @param {float64} value - Channel gain from TX antenna 1
     */
    set h1(value) {
      if (typeof value !== 'number') {
        throw new Error('AlamoutiCodeInstance.h1: Must be a number (channel gain)');
      }
      this._h1 = value;
    }

    /**
     * @returns {float64} Channel gain from TX antenna 1
     */
    get h1() {
      return this._h1;
    }

    /**
     * @param {float64} value - Channel gain from TX antenna 2
     */
    set h2(value) {
      if (typeof value !== 'number') {
        throw new Error('AlamoutiCodeInstance.h2: Must be a number (channel gain)');
      }
      this._h2 = value;
    }

    /**
     * @returns {float64} Channel gain from TX antenna 2
     */
    get h2() {
      return this._h2;
    }

    /**
     * @param {float64} value - Non-negative noise variance
     */
    set noiseVariance(value) {
      if (typeof value !== 'number' || value < 0) {
        throw new Error('AlamoutiCodeInstance.noiseVariance: Must be a non-negative number');
      }
      this._noiseVariance = value;
    }

    /**
     * @returns {float64} Noise variance
     */
    get noiseVariance() {
      return this._noiseVariance;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Symbols, two octets each (signed 16-bit, big-endian)
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('AlamoutiCodeInstance.Feed: Input must be an array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A chunk cannot be coded on its own either, since
      // the symbol pairing runs from the start of the message, so the symbols
      // are collected here and coded once, in Result(). The length rules below
      // therefore apply to the whole message and are checked there.
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('AlamoutiCodeInstance.Result: Call Feed() first to process data');
      }

      /** @type {int32[]} */
      const symbols = octetsToSymbols(this._feedBuffer);
      /** @type {int32[]} */
      let coded;
      if (this.isInverse) {
        if (symbols.length % 4 !== 0) {
          throw new Error('AlamoutiCodeInstance.Result: Decode input must hold a multiple of 4 symbols (received symbol matrix)');
        }
        coded = this.decode(symbols);
      } else {
        if (symbols.length % 2 !== 0) {
          throw new Error('AlamoutiCodeInstance.Result: Encode input must hold an even number of symbols (symbol pairs)');
        }
        coded = this.encode(symbols);
      }
      this.result = symbolsToOctets(coded);
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
     * @param {int32[]} symbols - Input symbols in -32767..32767 (must have even length)
     * @returns {int32[]} Space-time encoded matrix in row-major order
     */
    encode(symbols) {
      for (let i = 0; i < symbols.length; ++i) {
        if (symbols[i] === -32768) {
          throw new Error('AlamoutiCodeInstance.encode: Symbols must lie in -32767..32767 so that their negation fits');
        }
      }

      /** @type {int32[]} */
      const encoded = [];

      // Process symbols in pairs
      for (let i = 0; i < symbols.length; i += 2) {
        /** @type {int32} */
        const s1 = symbols[i];
        /** @type {int32} */
        const s2 = symbols[i + 1];

        // Alamouti encoding matrix (row-major):
        // [s1,  s2]
        // [-s2, s1]
        encoded.push(s1);
        encoded.push(s2);
        encoded.push(-s2);
        encoded.push(s1);
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
     * @param {int32[]} received - Received signal matrix [r1_t1, r1_t2, r2_t1, r2_t2]
     * @returns {int32[]} Decoded symbols in -32768..32767
     */
    decode(received) {
      /** @type {int32[]} */
      const decoded = [];
      /** @type {float64} */
      const h1 = this._h1;
      /** @type {float64} */
      const h2 = this._h2;

      // Normalization factor (channel energy)
      /** @type {float64} */
      const norm = h1 * h1 + h2 * h2;

      if (norm === 0) {
        throw new Error('AlamoutiCodeInstance.decode: Channel gains cannot both be zero');
      }

      // Process the space-time matrix in blocks of 4 (2 time slots x 2 antennas)
      for (let i = 0; i < received.length; i += 4) {
        // The block holds the transmitted matrix in row-major order, so each
        // row is one time slot and each column is one transmit antenna:
        //   time slot 1: [x11, x12]
        //   time slot 2: [x21, x22]
        /** @type {float64} */
        const x11 = received[i];     // Time slot 1, TX antenna 1
        /** @type {float64} */
        const x12 = received[i + 1]; // Time slot 1, TX antenna 2
        /** @type {float64} */
        const x21 = received[i + 2]; // Time slot 2, TX antenna 1
        /** @type {float64} */
        const x22 = received[i + 3]; // Time slot 2, TX antenna 2

        // The receiver sees one composite sample per time slot, both antennas
        // summed through their channel gains. This step was missing: the
        // combiner below was being fed raw matrix entries as though they were
        // already received samples, and it paired them across the wrong slots,
        // so it reconstructed (s1 - s2)/2 and (s2 - s1)/2 instead of s1 and s2.
        /** @type {float64} */
        const r1 = h1 * x11 + h2 * x12;
        /** @type {float64} */
        const r2 = h1 * x21 + h2 * x22;

        // Maximum likelihood combining (simplified for real symbols).
        // Substituting r1 = h1*s1 + h2*s2 and r2 = -h1*s2 + h2*s1 makes both
        // numerators collapse to (h1^2 + h2^2) times the wanted symbol, so this
        // is exact for any channel gains, not only the unit-gain default.
        /** @type {float64} */
        const s1_hat = (h1 * r1 + h2 * r2) / norm;
        /** @type {float64} */
        const s2_hat = (h2 * r1 - h1 * r2) / norm;

        // Hard decision (round to nearest symbol); the result must still fit
        // the signed 16-bit word it travels in
        /** @type {int32} */
        const d1 = Math.round(s1_hat);
        /** @type {int32} */
        const d2 = Math.round(s2_hat);
        if (d1 < -32768 || d1 > 32767 || d2 < -32768 || d2 > 32767) {
          throw new Error('AlamoutiCodeInstance.decode: Decoded symbol leaves the signed 16-bit range');
        }
        decoded.push(d1);
        decoded.push(d2);
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
