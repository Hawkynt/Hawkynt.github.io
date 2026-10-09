/*
 * ZUC-128-MAC (128-EIA3) - Production Implementation
 * 3GPP Integrity Algorithm for LTE/4G Mobile Communications
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ZUC-128-MAC (also known as 128-EIA3) is the integrity algorithm for 3GPP LTE/4G.
 * It uses the ZUC stream cipher to generate keystream and processes message bits
 * to produce a 32-bit authentication tag.
 *
 * Features:
 * - 128-bit keys and 128-bit IVs
 * - 32-bit (4-byte) MAC output
 * - Bit-oriented MAC computation
 * - 3GPP standard for mobile integrity protection
 *
 * SECURITY STATUS: SECURE - 3GPP standard, extensively analyzed for mobile security.
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

  // ZUC is resolved at first use rather than at load: the page loads the mac
  // directory before stream/zuc.js, and requiring another directory's module
  // at load would also make that module count towards this directory.
  /**
   * The registered ZUC stream cipher (registry first, CommonJS fallback)
   * @returns {Algorithm} The ZUC algorithm
   * @throws {Error} If ZUC is not registered
   */
  function findZUC() {
    /** @type {Algorithm} */
    let zuc = AlgorithmFramework.Find('ZUC');
    if (!zuc && typeof require !== 'undefined') {
      try { require('../stream/zuc.js'); } catch (e) { /* reported below */ }
      zuc = AlgorithmFramework.Find('ZUC');
    }
    if (!zuc) throw new Error('ZUC stream cipher dependency is required');
    return zuc;
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          MacAlgorithm, IMacInstance,
          TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZUC128MACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ZUC-128-MAC";
      this.description = "3GPP integrity algorithm 128-EIA3 for LTE/4G mobile communications. Uses ZUC-128 stream cipher to generate keystream and processes message bits to produce 32-bit authentication tag.";
      this.inventor = "DACAS (Data Assurance and Communication Security Research Center)";
      this.year = 2011;
      this.category = CategoryType.MAC;
      this.subCategory = "Stream Cipher MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(4, 4, 0)  // ZUC-128-MAC produces 4-byte (32-bit) MAC
      ];
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key
      ];
      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0)  // 128-bit IV
      ];
      this.NeedsKey = true;
      this.NeedsNonce = true;

      // Documentation links
      this.documentation = [
        new LinkItem("3GPP TS 35.221 - ZUC Specification", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.221/"),
        new LinkItem("ZUC-128 EIA3 Specification", "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf"),
        new LinkItem("3GPP Security Algorithms", "https://www.3gpp.org/technologies/keywords-acronyms/100-the-3gpp-security-algorithms")
      ];

      this.references = [
        new LinkItem("GmSSL ZUC/128-EIA3 Implementation", "https://github.com/guanzhi/GmSSL/blob/master/src/zuc.c")
      ];

      // Official 3GPP test vectors from GSMA specification
      this.tests = [
        {
          text: "3GPP ZUC-128-MAC Test 1 - 400 bits of zeros",
          uri: "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf",
          input: new Array(50).fill(0),  // 400 bits = 50 bytes of zeros
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("508dd5ff")
        },
        {
          text: "3GPP ZUC-128-MAC Test 2 - 4000 bits of 0x11",
          uri: "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf",
          input: new Array(500).fill(0x11),  // 4000 bits = 500 bytes of 0x11
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("fbed4c12")
        },
        {
          text: "3GPP ZUC-128-MAC Test 3 - 400 bits of zeros, all-ones key/IV",
          uri: "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf",
          input: new Array(50).fill(0),
          key: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          iv: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          expected: OpCodes.Hex8ToBytes("55e01504")
        },
        {
          text: "3GPP ZUC-128-MAC Test 4 - 4000 bits of 0x11, all-ones key/IV",
          uri: "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf",
          input: new Array(500).fill(0x11),
          key: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          iv: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          expected: OpCodes.Hex8ToBytes("9ce9a0c4")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // MACs cannot be reversed
      }
      return new ZUC128MACInstance(this);
    }
  }

  // Instance class implementing ZUC-128-MAC
  /**
 * ZUC128MAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZUC128MACInstance extends IMacInstance {
    /**
     * Initialize a ZUC-128-MAC instance
     * @param {ZUC128MACAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this._iv = null;
      this.inputBuffer = [];
      /** @type {IAlgorithmInstance} */
      this.zucEngine = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error('Invalid ZUC-128-MAC key size: ' + keyBytes.length + ' bytes. Requires exactly 16 bytes (128 bits)');
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== 16) {
        throw new Error('Invalid ZUC-128-MAC IV size: ' + ivBytes.length + ' bytes. Requires exactly 16 bytes (128 bits)');
      }

      this._iv = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }

      // Initialize ZUC engine
      /** @type {Algorithm} */
      const zucAlgo = findZUC();
      this.zucEngine = zucAlgo.CreateInstance();
      this.zucEngine.key = this._key;
      this.zucEngine.iv = this._iv;

      // Initialize MAC and keystream
      /** @type {uint32} */
      let mac = 0;
      /** @type {uint32[]} */
      const keyStream = [0, 0];

      // Generate initial keystream word at position 0 (BC: lines 100-103)
      keyStream[0] = this._generateKeyStreamWord();

      // Initialize indices (BC: lines 104-105)
      let wordIndex = 1;  // theWordIndex = theKeyStream.length - 1 = 2 - 1 = 1
      let byteIndex = 3;  // theByteIndex = Integer.BYTES - 1 = 4 - 1 = 3

      // Process each byte (BC: update() lines 113-129)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const inputByte = this.inputBuffer[i];

        // Shift for next byte FIRST (BC: shift4NextByte() at line 116)
        byteIndex = (byteIndex + 1) % 4;
        if (byteIndex === 0) {
          keyStream[wordIndex] = this._generateKeyStreamWord();
          wordIndex = (wordIndex + 1) % 2;
        }

        // Process bits of the byte (BC: lines 118-128)
        const bitBase = byteIndex * 8;
        /** @type {uint8} */
        let bitMask = 0x80;
        for (let bitNo = 0; bitMask > 0; bitMask = OpCodes.Shr8(bitMask, 1), bitNo++) {
          if (OpCodes.ToByte(inputByte&bitMask) !== 0) {
            mac = OpCodes.Xor32(mac, this._getKeyStreamWord(keyStream, wordIndex, bitBase + bitNo));
          }
        }
      }

      // Final processing (BC: doFinal lines 215-226)
      // Shift for final position (BC: line 218)
      byteIndex = (byteIndex + 1) % 4;
      if (byteIndex === 0) {
        keyStream[wordIndex] = this._generateKeyStreamWord();
        wordIndex = (wordIndex + 1) % 2;
      }

      // XOR with keystream at final position (BC: line 219)
      mac = OpCodes.Xor32(mac, this._getKeyStreamWord(keyStream, wordIndex, byteIndex * 8));

      // Get and XOR final word (BC: getFinalWord() lines 198-206, then line 220)
      /** @type {uint32} */
      let finalWord;
      if (byteIndex !== 0) {
        finalWord = this._generateKeyStreamWord();
      } else {
        wordIndex = (wordIndex + 1) % 2;
        finalWord = keyStream[wordIndex];
      }
      mac = OpCodes.Xor32(mac, finalWord);

      // Clear input buffer
      this.inputBuffer = [];

      // Return MAC as 4 bytes (big-endian)
      return OpCodes.Unpack32BE(OpCodes.ToDWord(mac));
    }

    /**
     * Next 32-bit ZUC keystream word
     * @returns {uint32} Keystream word (big-endian)
     */
    _generateKeyStreamWord() {
      // Generate raw keystream word from ZUC (NOT XORed with input)
      // We need to call the ZUC internal keystream generation directly
      // Since ZUC XORs keystream with input, feeding zeros gives us the raw keystream
      this.zucEngine.Feed(OpCodes.CreateArray(4, 0));
      /** @type {uint8[]} */
      const bytes = this.zucEngine.Result();
      return OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    /**
     * The 32 keystream bits starting bitNo bits into keyStream[wordIndex]
     * @param {uint32[]} keyStream - Two-word keystream window
     * @param {int32} wordIndex - Index of the current word (0 or 1)
     * @param {int32} bitNo - Bit offset into the current word, 0..31
     * @returns {uint32} Keystream word
     */
    _getKeyStreamWord(keyStream, wordIndex, bitNo) {
      const first = keyStream[wordIndex];
      if (bitNo === 0) {
        return first;
      }
      const second = keyStream[(wordIndex + 1) % 2];
      const leftPart = OpCodes.Shl32(first, bitNo);
      const rightPart = OpCodes.Shr32(second, 32 - bitNo);
      return OpCodes.Or32(leftPart, rightPart);
    }

    /**
     * Feed data and return the MAC
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} 4-byte MAC
     */
    ComputeMac(data) {
      this.Feed(data);
      return this.Result();
    }
  }

  // Register the algorithm
  const algorithmInstance = new ZUC128MACAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { ZUC128MACAlgorithm, ZUC128MACInstance };
}));
