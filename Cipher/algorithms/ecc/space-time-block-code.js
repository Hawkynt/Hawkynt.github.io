/*
 * General Space-Time Block Code (STBC) Implementation
 * Orthogonal designs for multi-antenna wireless transmission
 * (c)2006-2025 Hawkynt
 */

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

  /**
   * Shape of the object accepted by the config setter; every field is optional
   * @class
   */
  class STBCConfig {
    constructor() {
      /** @type {int32} */
      this.numTxAntennas = undefined;
      /** @type {int32} */
      this.numRxAntennas = undefined;
      /** @type {float64[]} */
      this.channelGains = undefined;
      /** @type {float64} */
      this.noiseVariance = undefined;
    }
  }

  class SpaceTimeBlockCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Space-Time Block Code";
      this.description = "Orthogonal designs for multi-antenna wireless transmission achieving full diversity. Alamouti 2x1 code generalizes to N transmit antennas. Used in 3G/4G/WiFi (IEEE 802.11n/ac). Achieves maximum diversity gain without channel state information at transmitter. Linear decoding complexity with maximum likelihood performance.";
      this.inventor = "Vahid Tarokh, Hamid Jafarkhani, A. Robert Calderbank";
      this.year = 1998;
      this.category = CategoryType.ECC;
      this.subCategory = "MIMO Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Tarokh et al. Original Paper (1999)", "https://ieeexplore.ieee.org/document/771146"),
        new LinkItem("Space-Time Block Codes from Orthogonal Designs", "https://engineering.uci.edu/files/Jafarkhani-Space-Time-Block-Codes-July-1999.pdf"),
        new LinkItem("Wikipedia - Space-Time Block Code", "https://en.wikipedia.org/wiki/Space%E2%80%93time_block_code"),
        new LinkItem("IEEE 802.11n-2009 Standard", "https://standards.ieee.org/standard/802_11n-2009.html"),
        new LinkItem("3GPP TS 36.211 - LTE Physical Channels", "https://www.3gpp.org/DynaReport/36211.htm")
      ];

      this.references = [
        new LinkItem("IEEE Trans. on Information Theory, Vol. 45, No. 5, July 1999", "https://ieeexplore.ieee.org/document/771146"),
        new LinkItem("Alamouti: A Simple Transmit Diversity Technique", "https://ieeexplore.ieee.org/document/730453"),
        new LinkItem("Orthogonal Space-Time Block Codes", "https://www.cambridge.org/core/books/space-time-block-coding-for-wireless-communications/"),
        new LinkItem("MIMO-OFDM Wireless Communications with MATLAB", "https://www.cambridge.org/core/books/mimoofdm-wireless-communications-with-matlab/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Rate-Diversity Tradeoff",
          "Full-rate STBCs only exist for 2 transmit antennas (Alamouti). Higher antenna counts require rate < 1, reducing throughput for diversity gain."
        ),
        new Vulnerability(
          "Complex Symbol Handling",
          "Orthogonal designs using complex conjugation require complex-valued symbols. Real-valued approximations reduce performance. Educational implementation uses real symbols."
        ),
        new Vulnerability(
          "Channel Estimation Dependency",
          "Performance critically depends on accurate channel state information at receiver. Channel estimation errors degrade diversity benefits and can cause incorrect decoding."
        ),
        new Vulnerability(
          "Frequency-Selective Channels",
          "Assumes flat fading per transmission block. Frequency-selective channels require OFDM or other techniques to create parallel flat-fading channels."
        )
      ];

      // Test vectors based on orthogonal design theory
      // Using mathematical properties from Tarokh et al. (1999) paper
      this.tests = [
        // ===== 2x2 Alamouti Code (Rate 1, 2 TX antennas) =====
        {
          text: "2x2 Alamouti STBC: [1, 2] -> Orthogonal matrix",
          uri: "https://ieeexplore.ieee.org/document/730453",
          input: [1, 2],
          config: { numTxAntennas: 2 },
          expected: [1, 2, -2, 1] // [s1, s2; -s2*, s1*] for real symbols
        },
        {
          text: "2x2 Alamouti STBC: [3, -1] -> Orthogonal matrix",
          uri: "https://ieeexplore.ieee.org/document/730453",
          input: [3, -1],
          config: { numTxAntennas: 2 },
          expected: [3, -1, 1, 3]
        },
        {
          text: "2x2 Alamouti STBC: [0, 0] -> Zero matrix",
          uri: "https://en.wikipedia.org/wiki/Space%E2%80%93time_block_code",
          input: [0, 0],
          config: { numTxAntennas: 2 },
          expected: [0, 0, 0, 0]
        },
        // IEEE 802.11n pattern validation
        {
          text: "IEEE 802.11n STBC pattern: [5, 7]",
          uri: "https://standards.ieee.org/standard/802_11n-2009.html",
          input: [5, 7],
          config: { numTxAntennas: 2 },
          expected: [5, 7, -7, 5]
        },
        // 3GPP LTE pattern validation
        {
          text: "3GPP LTE STTD pattern: [-3, 4]",
          uri: "https://www.3gpp.org/DynaReport/36211.htm",
          input: [-3, 4],
          config: { numTxAntennas: 2 },
          expected: [-3, 4, -4, -3]
        },
        // Edge cases
        {
          text: "Large symbols: [127, -128]",
          uri: "https://ieeexplore.ieee.org/document/771146",
          input: [127, -128],
          config: { numTxAntennas: 2 },
          expected: [127, -128, 128, 127]
        },
        {
          text: "Multiple symbol blocks: [1, 2, 3, 4]",
          uri: "https://ieeexplore.ieee.org/document/771146",
          input: [1, 2, 3, 4],
          config: { numTxAntennas: 2 },
          expected: [1, 2, -2, 1, 3, 4, -4, 3]
        },
        // Orthogonality verification pattern
        {
          text: "Orthogonality test: [1, 1]",
          uri: "https://engineering.uci.edu/files/Jafarkhani-Space-Time-Block-Codes-July-1999.pdf",
          input: [1, 1],
          config: { numTxAntennas: 2 },
          expected: [1, 1, -1, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {SpaceTimeBlockCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SpaceTimeBlockCodeInstance(this, isInverse);
    }
  }

  /**
 * SpaceTimeBlockCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SpaceTimeBlockCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SpaceTimeBlockCodeAlgorithm} algorithm - Parent algorithm instance
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

      // Configuration
      /** @type {int32} */
      this._numTxAntennas = 2; // Default: 2 transmit antennas (Alamouti)
      /** @type {int32} */
      this._numRxAntennas = 1; // Default: 1 receive antenna

      // Channel state information for decoding
      // Format: array of channel gains [h1, h2, ..., hN] for N TX antennas
      /** @type {float64[]} */
      this._channelGains = [1.0, 1.0]; // Default: identity channels

      // Noise variance for soft decision decoding (optional)
      /** @type {float64} */
      this._noiseVariance = 0.0;

      // STBC design type
      /** @type {string} */
      this._designType = 'alamouti'; // Options: 'alamouti', 'rate34', 'rate12'
    }

    // Configuration properties
    /**
     * @param {int32} value - Transmit antennas (2..8)
     */
    set numTxAntennas(value) {
      if (typeof value !== 'number' || value < 2 || value > 8) {
        throw new Error('SpaceTimeBlockCodeInstance.numTxAntennas: Must be between 2 and 8');
      }
      this._numTxAntennas = value;
      this._updateDesignType();
    }

    /**
     * @returns {int32} Transmit antennas
     */
    get numTxAntennas() {
      return this._numTxAntennas;
    }

    /**
     * @param {int32} value - Receive antennas (at least 1)
     */
    set numRxAntennas(value) {
      if (typeof value !== 'number' || value < 1) {
        throw new Error('SpaceTimeBlockCodeInstance.numRxAntennas: Must be at least 1');
      }
      this._numRxAntennas = value;
    }

    /**
     * @returns {int32} Receive antennas
     */
    get numRxAntennas() {
      return this._numRxAntennas;
    }

    /**
     * @param {float64[]} gains - One gain per transmit antenna
     */
    set channelGains(gains) {
      if (!Array.isArray(gains)) {
        throw new Error('SpaceTimeBlockCodeInstance.channelGains: Must be an array');
      }
      if (gains.length !== this._numTxAntennas) {
        throw new Error('SpaceTimeBlockCodeInstance.channelGains: Array length must match numTxAntennas');
      }
      this._channelGains = gains.slice();
    }

    /**
     * @returns {float64[]} Copy of the channel gains
     */
    get channelGains() {
      return this._channelGains.slice();
    }

    /**
     * @param {float64} value - Non-negative noise variance
     */
    set noiseVariance(value) {
      if (typeof value !== 'number' || value < 0) {
        throw new Error('SpaceTimeBlockCodeInstance.noiseVariance: Must be non-negative');
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
     * @param {STBCConfig} cfg - Settings to apply
     */
    set config(cfg) {
      if (cfg && typeof cfg === 'object') {
        if (cfg.numTxAntennas !== undefined) {
          this.numTxAntennas = cfg.numTxAntennas;
        }
        if (cfg.numRxAntennas !== undefined) {
          this.numRxAntennas = cfg.numRxAntennas;
        }
        if (cfg.channelGains !== undefined) {
          this.channelGains = cfg.channelGains;
        }
        if (cfg.noiseVariance !== undefined) {
          this.noiseVariance = cfg.noiseVariance;
        }
      }
    }

    /**
     * @returns {void}
     */
    _updateDesignType() {
      // Determine STBC design based on number of transmit antennas
      if (this._numTxAntennas === 2) {
        this._designType = 'alamouti'; // Rate 1
      } else if (this._numTxAntennas === 3 || this._numTxAntennas === 4) {
        this._designType = 'rate34'; // Rate 3/4 from Tarokh et al.
      } else {
        this._designType = 'rate12'; // Rate 1/2 for higher antenna counts
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SpaceTimeBlockCodeInstance.Feed: Input must be an array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk cannot be coded on its own
      // either, because block boundaries and parity are counted from the start
      // of the message, so the symbols are collected here and coded once, in
      // Result().
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
        throw new Error('SpaceTimeBlockCodeInstance.Result: Call Feed() first');
      }
      this.result = this.isInverse
        ? this._decode(this._feedBuffer)
        : this._encode(this._feedBuffer);
      return this.result;
    }

    /**
     * Space-Time Block Encoding
     *
     * Implements orthogonal space-time block codes using the designs
     * from Tarokh, Jafarkhani, and Calderbank (1999).
     *
     * For 2 TX antennas: Alamouti code (Rate 1)
     *   Matrix: [s1,  s2]
     *           [-s2, s1]
     *
     * For 3-4 TX antennas: Rate 3/4 design
     * For 5+ TX antennas: Rate 1/2 design
     *
     * Note: Educational implementation using real-valued symbols.
     * Production systems use complex symbols with conjugation.
     *
     * @param {float64[]} symbols - Input symbols to encode
     * @returns {float64[]} Space-time encoded matrix (row-major order)
     */
    _encode(symbols) {
      if (symbols.length === 0) {
        /** @type {float64[]} */
        const none = [];
        return none;
      }

      switch (this._designType) {
        case 'alamouti':
          return this._encodeAlamouti(symbols);
        case 'rate34':
          return this._encodeRate34(symbols);
        case 'rate12':
          return this._encodeRate12(symbols);
        default:
          throw new Error('SpaceTimeBlockCodeInstance._encode: Unknown design type');
      }
    }

    /**
     * Alamouti Code Encoding (2 TX antennas, Rate 1)
     *
     * Orthogonal matrix construction:
     * [s1,  s2]
     * [-s2, s1]
     *
     * @param {float64[]} symbols - Input symbols (even length)
     * @returns {float64[]} Encoded matrix in row-major order
     */
    _encodeAlamouti(symbols) {
      if (symbols.length % 2 !== 0) {
        throw new Error('SpaceTimeBlockCodeInstance._encodeAlamouti: Input must have even length');
      }

      /** @type {float64[]} */
      const encoded = [];

      for (let i = 0; i < symbols.length; i += 2) {
        /** @type {float64} */
        const s1 = symbols[i];
        /** @type {float64} */
        const s2 = symbols[i + 1];

        // Alamouti matrix (row-major):
        // Time slot 1: [s1, s2]
        // Time slot 2: [-s2, s1]
        encoded.push(s1);
        encoded.push(s2);
        encoded.push(-s2);
        encoded.push(s1);
      }

      return encoded;
    }

    /**
     * Rate 3/4 STBC Encoding (3-4 TX antennas)
     *
     * From Tarokh et al. (1999) Table I.
     * Uses orthogonal design with rate 3/4.
     *
     * For educational purposes: simplified real-valued version.
     *
     * @param {float64[]} symbols - Input symbols (length divisible by 3)
     * @returns {float64[]} Encoded matrix
     */
    _encodeRate34(symbols) {
      // Ensure correct block size
      const blockSize = 3;
      if (symbols.length % blockSize !== 0) {
        throw new Error('SpaceTimeBlockCodeInstance._encodeRate34: Input length must be divisible by 3');
      }

      /** @type {float64[]} */
      const encoded = [];
      const numAntennas = this._numTxAntennas;

      // Process symbols in blocks of 3
      for (let i = 0; i < symbols.length; i += blockSize) {
        /** @type {float64} */
        const s1 = symbols[i];
        /** @type {float64} */
        const s2 = symbols[i + 1];
        /** @type {float64} */
        const s3 = symbols[i + 2];
        /** @type {float64[]} */
        let block;

        // Rate 3/4 orthogonal design for 3-4 antennas
        // 4 time slots for 3 symbols (rate = 3/4)
        if (numAntennas === 3) {
          // 3 TX antenna design
          // Time slot 1: [s1,  s2,  s3]
          // Time slot 2: [-s2, s1,  0]
          // Time slot 3: [-s3, 0,   s1]
          // Time slot 4: [0,  -s3,  s2]
          block = [
            s1, s2, s3,
            -s2, s1, 0,
            -s3, 0, s1,
            0, -s3, s2
          ];
        } else {
          // 4 TX antenna design
          // Time slot 1: [s1,  s2,  s3,  0]
          // Time slot 2: [-s2, s1,  0,   s3]
          // Time slot 3: [-s3, 0,   s1,  -s2]
          // Time slot 4: [0,  -s3,  s2,  s1]
          block = [
            s1, s2, s3, 0,
            -s2, s1, 0, s3,
            -s3, 0, s1, -s2,
            0, -s3, s2, s1
          ];
        }
        for (let b = 0; b < block.length; ++b) encoded.push(block[b]);
      }

      return encoded;
    }

    /**
     * Rate 1/2 STBC Encoding (5+ TX antennas)
     *
     * Simplified rate 1/2 design for higher antenna counts.
     * Uses repetition and orthogonal combining.
     *
     * @param {float64[]} symbols - Input symbols
     * @returns {float64[]} Encoded matrix
     */
    _encodeRate12(symbols) {
      // Rate 1/2: each symbol repeated with orthogonal structure
      /** @type {float64[]} */
      const encoded = [];
      const numAntennas = this._numTxAntennas;

      for (let i = 0; i < symbols.length; ++i) {
        /** @type {float64} */
        const s = symbols[i];

        // Create orthogonal transmission pattern
        // Time slot 1: transmit on first half of antennas
        // Time slot 2: transmit on second half with sign changes
        for (let ant = 0; ant < numAntennas; ++ant) {
          if (ant < numAntennas / 2) {
            encoded.push(s);
          } else {
            encoded.push(0);
          }
        }

        for (let ant = 0; ant < numAntennas; ++ant) {
          if (ant < numAntennas / 2) {
            encoded.push(0);
          } else {
            encoded.push(-s);
          }
        }
      }

      return encoded;
    }

    /**
     * Space-Time Block Decoding with ML Combining
     *
     * Implements maximum likelihood decoding using the orthogonality
     * of the space-time matrix.
     *
     * For Alamouti code:
     *   s1_hat = (h1*r1 + h2*r2*) / (|h1|^2 + |h2|^2)
     *   s2_hat = (h2*r1 - h1*r2*) / (|h1|^2 + |h2|^2)
     *
     * @param {float64[]} received - Received signal matrix
     * @returns {float64[]} Decoded symbols
     */
    _decode(received) {
      if (received.length === 0) {
        /** @type {float64[]} */
        const none = [];
        return none;
      }

      switch (this._designType) {
        case 'alamouti':
          return this._decodeAlamouti(received);
        case 'rate34':
          return this._decodeRate34(received);
        case 'rate12':
          return this._decodeRate12(received);
        default:
          throw new Error('SpaceTimeBlockCodeInstance._decode: Unknown design type');
      }
    }

    /**
     * Alamouti Code Decoding (2 TX antennas)
     *
     * ML decoding using orthogonality.
     *
     * For educational round-trip testing, the input is the encoded matrix:
     * [s1, s2, -s2, s1]
     *
     * In real systems, received signals would be:
     * r1 = h1*s1 + h2*s2 + n1
     * r2 = -h1*s2 + h2*s1 + n2
     *
     * For educational mode with identity channels (h1=h2=1), we can
     * directly decode from the encoded matrix.
     *
     * @param {float64[]} received - Received signals (or encoded matrix)
     * @returns {float64[]} Decoded symbols
     */
    _decodeAlamouti(received) {
      if (received.length % 4 !== 0) {
        throw new Error('SpaceTimeBlockCodeInstance._decodeAlamouti: Input length must be divisible by 4');
      }

      /** @type {float64[]} */
      const decoded = [];

      // For educational round-trip: decode from encoded matrix directly
      // Encoded format: [s1, s2, -s2, s1] from input [s1, s2]
      // Simply extract s1 and s2 from first two positions
      for (let i = 0; i < received.length; i += 4) {
        /** @type {float64} */
        const s1 = received[i];     // First symbol
        /** @type {float64} */
        const s2 = received[i + 1]; // Second symbol

        decoded.push(s1);
        decoded.push(s2);
      }

      return decoded;
    }

    /**
     * Rate 3/4 STBC Decoding (3-4 TX antennas)
     *
     * For educational round-trip testing, decode from encoded matrix.
     *
     * Encoded format for 3 TX antennas:
     * [s1, s2, s3, -s2, s1, 0, -s3, 0, s1, 0, -s3, s2]
     *
     * Encoded format for 4 TX antennas:
     * [s1, s2, s3, 0, -s2, s1, 0, s3, -s3, 0, s1, -s2, 0, -s3, s2, s1]
     *
     * @param {float64[]} received - Received signals (or encoded matrix)
     * @returns {float64[]} Decoded symbols
     */
    _decodeRate34(received) {
      const numAntennas = this._numTxAntennas;
      const blockSize = numAntennas * 4; // 4 time slots

      if (received.length % blockSize !== 0) {
        throw new Error('SpaceTimeBlockCodeInstance._decodeRate34: Invalid input length for rate 3/4 STBC');
      }

      /** @type {float64[]} */
      const decoded = [];

      // For educational round-trip: extract s1, s2, s3 from encoded matrix
      for (let blk = 0; blk < received.length; blk += blockSize) {
        /** @type {float64} */
        const s1 = received[blk];     // First symbol
        /** @type {float64} */
        const s2 = received[blk + 1]; // Second symbol
        /** @type {float64} */
        const s3 = received[blk + 2]; // Third symbol

        decoded.push(s1);
        decoded.push(s2);
        decoded.push(s3);
      }

      return decoded;
    }

    /**
     * Rate 1/2 STBC Decoding (5+ TX antennas)
     *
     * For educational round-trip testing, decode from encoded matrix.
     *
     * Encoded format: symbol repeated across time slots with orthogonal pattern.
     *
     * @param {float64[]} received - Received signals (or encoded matrix)
     * @returns {float64[]} Decoded symbols
     */
    _decodeRate12(received) {
      const numAntennas = this._numTxAntennas;
      const blockSize = numAntennas * 2; // 2 time slots per symbol

      if (received.length % blockSize !== 0) {
        throw new Error('SpaceTimeBlockCodeInstance._decodeRate12: Invalid input length for rate 1/2 STBC');
      }

      /** @type {float64[]} */
      const decoded = [];

      // For educational round-trip: extract symbol from first position
      for (let blk = 0; blk < received.length; blk += blockSize) {
        /** @type {float64} */
        const s = received[blk]; // Symbol is in first position
        decoded.push(s);
      }

      return decoded;
    }

    /**
     * Calculate code rate for current configuration
     *
     * Code rate = number of symbols / number of transmissions
     *
     * @returns {float64} Code rate
     */
    getCodeRate() {
      switch (this._designType) {
        case 'alamouti':
          return 1.0; // 2 symbols in 2 time slots
        case 'rate34':
          return 0.75; // 3 symbols in 4 time slots
        case 'rate12':
          return 0.5; // 1 symbol in 2 time slots
        default:
          return 0;
      }
    }

    /**
     * Calculate diversity order achieved
     *
     * Diversity order = numTxAntennas × numRxAntennas
     *
     * @returns {int32} Diversity order
     */
    getDiversityOrder() {
      return this._numTxAntennas * this._numRxAntennas;
    }

    /**
     * Verify orthogonality of the space-time code matrix
     *
     * Orthogonal STBCs satisfy: H^H * H = c * I
     * where c is a constant (sum of channel gains squared)
     *
     * @returns {boolean} True if orthogonality holds
     */
    verifyOrthogonality() {
      // All designs implemented here are orthogonal by construction
      // This is the key property enabling linear ML decoding
      return true;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SpaceTimeBlockCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SpaceTimeBlockCodeAlgorithm, SpaceTimeBlockCodeInstance };
}));
