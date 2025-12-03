/*
 * Manchester Encoding Implementation
 * Educational implementation of Manchester line code (IEEE 802.3)
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

  class ManchesterAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Manchester Encoding";
      this.description = "Line code in which each data bit is represented by at least one transition. Combines clock and data signals and is self-synchronizing. Used in Ethernet 10Base-T and other network protocols. Educational implementation following IEEE 802.3 specification.";
      this.inventor = "G.E. Thomas";
      this.year = 1949;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Line Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("IEEE 802.3 Ethernet Standard", "https://standards.ieee.org/standard/802_3-2018.html"),
        new LinkItem("Manchester Code Wikipedia", "https://en.wikipedia.org/wiki/Manchester_code"),
        new LinkItem("Line Code Theory", "https://www.electronics-tutorials.ws/sequential/seq_7.html")
      ];

      this.references = [
        new LinkItem("Ethernet Physical Layer", "https://www.ieee802.org/3/"),
        new LinkItem("G.E. Thomas Patent", "https://patents.google.com/patent/US2632058"),
        new LinkItem("Digital Communications", "https://www.ece.rutgers.edu/~orfanidi/ece346/")
      ];

      this.knownVulnerabilities = [];

      // Test vectors for Manchester encoding
      this.tests = [
        new TestCase(
          [],
          [],
          "Manchester empty data test",
          "IEEE 802.3 standard"
        ),
        new TestCase(
          [0], // Binary: 00000000
          [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], // Each 0 -> 01 transition
          "Single zero byte encoding test - Manchester",
          "Educational standard"
        ),
        new TestCase(
          [1], // Binary: 00000001  
          [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0], // Last bit is 1 -> 10 transition
          "Single byte with LSB set - Manchester",
          "IEEE 802.3 example"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ManchesterInstance(this, isInverse);
    }
  }

  /**
 * Manchester cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ManchesterInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ManchesterInstance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        this.processedData = this.decode(data);
      } else {
        this.processedData = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.processedData === null) {
        throw new Error('ManchesterInstance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      const result = [];

      for (let byteIdx = 0; byteIdx < data.length; byteIdx++) {
        const byte = data[byteIdx];

        // Process each bit from MSB to LSB
        for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
          const bit = OpCodes.AndN(OpCodes.Shr32(byte, bitIdx), 1);

          // Manchester encoding: 0 -> 01 (low to high), 1 -> 10 (high to low)
          if (bit === 0) {
            result.push(0, 1);
          } else {
            result.push(1, 0);
          }
        }
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      // Manchester encoded data should have even length (2 transitions per bit)
      if (data.length % 2 !== 0) {
        throw new Error('Manchester: Invalid encoded data length (must be even)');
      }

      const result = [];
      let currentByte = 0;
      let bitCount = 0;

      for (let i = 0; i < data.length; i += 2) {
        const first = data[i];
        const second = data[i + 1];

        let bit;
        if (first === 0 && second === 1) {
          bit = 0; // 01 -> 0
        } else if (first === 1 && second === 0) {
          bit = 1; // 10 -> 1
        } else {
          throw new Error(`Manchester: Invalid transition pair ${first}${second}`);
        }

        currentByte = OpCodes.OrN(OpCodes.Shl32(currentByte, 1), bit);
        bitCount++;

        if (bitCount === 8) {
          result.push(currentByte);
          currentByte = 0;
          bitCount = 0;
        }
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ManchesterAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ManchesterAlgorithm, ManchesterInstance };
}));