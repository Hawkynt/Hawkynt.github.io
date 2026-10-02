/*
 * SNOW 3G Stream Cipher - Production Implementation
 * 3GPP TS 35.216 standardized stream cipher for 3G/UMTS networks
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SNOW 3G is the standardized stream cipher used in 3G UMTS networks for the
 * UEA2 confidentiality and UIA2 integrity algorithms. It features an LFSR-based
 * design with a finite state machine (FSM) and operates on 128-bit keys and IVs.
 *
 * SECURITY STATUS: SECURE - Currently used in 3G mobile networks worldwide.
 * Despite theoretical attacks, remains secure for mobile communications.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // SNOW 3G S-box SR (3GPP TS 35.216; the AES S-box), the byte S-box beneath S1
  /** @type {uint8[]} */
  const SNOW3G_SR = [
      0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
      0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
      0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
      0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
      0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
      0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
      0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
      0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
      0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
      0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
      0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
      0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
      0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
      0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
      0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
      0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16
  ];

  // SNOW 3G S-box SQ (3GPP TS 35.216), the byte S-box beneath S2
  /** @type {uint8[]} */
  const SNOW3G_SQ = [
      0x25, 0x24, 0x73, 0x67, 0xD7, 0xAE, 0x5C, 0x30, 0xA4, 0xEE, 0x6E, 0xCB, 0x7D, 0xB5, 0x82, 0xDB,
      0xE4, 0x8E, 0x48, 0x49, 0x4F, 0x5D, 0x6A, 0x78, 0x70, 0x88, 0xE8, 0x5F, 0x5E, 0x84, 0x65, 0xE2,
      0xD8, 0xE9, 0xCC, 0xED, 0x40, 0x2F, 0x11, 0x28, 0x57, 0xD2, 0xAC, 0xE3, 0x4A, 0x15, 0x1B, 0xB9,
      0xB2, 0x80, 0x85, 0xA6, 0x2E, 0x02, 0x47, 0x29, 0x07, 0x4B, 0x0E, 0xC1, 0x51, 0xAA, 0x89, 0xD4,
      0xCA, 0x01, 0x46, 0xB3, 0xEF, 0xDD, 0x44, 0x7B, 0xC2, 0x7F, 0xBE, 0xC3, 0x9F, 0x20, 0x4C, 0x64,
      0x83, 0xA2, 0x68, 0x42, 0x13, 0xB4, 0x41, 0xCD, 0xBA, 0xC6, 0xBB, 0x6D, 0x4D, 0x71, 0x21, 0xF4,
      0x8D, 0xB0, 0xE5, 0x93, 0xFE, 0x8F, 0xE6, 0xCF, 0x43, 0x45, 0x31, 0x22, 0x37, 0x36, 0x96, 0xFA,
      0xBC, 0x0F, 0x08, 0x52, 0x1D, 0x55, 0x1A, 0xC5, 0x4E, 0x23, 0x69, 0x7A, 0x92, 0xFF, 0x5B, 0x5A,
      0xEB, 0x9A, 0x1C, 0xA9, 0xD1, 0x7E, 0x0D, 0xFC, 0x50, 0x8A, 0xB6, 0x62, 0xF5, 0x0A, 0xF8, 0xDC,
      0x03, 0x3C, 0x0C, 0x39, 0xF1, 0xB8, 0xF3, 0x3D, 0xF2, 0xD5, 0x97, 0x66, 0x81, 0x32, 0xA0, 0x00,
      0x06, 0xCE, 0xF6, 0xEA, 0xB7, 0x17, 0xF7, 0x8C, 0x79, 0xD6, 0xA7, 0xBF, 0x8B, 0x3F, 0x1F, 0x53,
      0x63, 0x75, 0x35, 0x2C, 0x60, 0xFD, 0x27, 0xD3, 0x94, 0xA5, 0x7C, 0xA1, 0x05, 0x58, 0x2D, 0xBD,
      0xD9, 0xC7, 0xAF, 0x6B, 0x54, 0x0B, 0xE0, 0x38, 0x04, 0xC8, 0x9D, 0xE7, 0x14, 0xB1, 0x87, 0x9C,
      0xDF, 0x6F, 0xF9, 0xDA, 0x2A, 0xC4, 0x59, 0x16, 0x74, 0x91, 0xAB, 0x26, 0x61, 0x76, 0x34, 0x2B,
      0xAD, 0x99, 0xFB, 0x72, 0xEC, 0x33, 0x12, 0xDE, 0x98, 0x3B, 0xC0, 0x9B, 0x3E, 0x18, 0x10, 0x3A,
      0x56, 0xE1, 0x77, 0xC9, 0x1E, 0x9E, 0x95, 0xA3, 0x90, 0x19, 0xA8, 0x6C, 0x09, 0xD0, 0xF0, 0x86
  ];

  /**
   * MULx: the byte v multiplied by x in GF(2^8), reduced with the constant c
   * @param {uint8} v
   * @param {uint8} c
   * @returns {uint8}
   */
  function mulX(v, c) {
    return OpCodes.And8(v, 0x80) !== 0 ? OpCodes.Xor8(OpCodes.Shl8(v, 1), c) : OpCodes.Shl8(v, 1);
  }

  /**
   * MULxPOW: the byte v multiplied by x^i in GF(2^8), reduced with the constant c
   * @param {uint8} v
   * @param {int32} i
   * @param {uint8} c
   * @returns {uint8}
   */
  function mulXPow(v, i, c) {
    let r = v;
    for (let k = 0; k < i; k++) r = mulX(r, c);
    return r;
  }

  // MULalpha and DIValpha of the LFSR feedback, tabulated over their byte argument
  /** @type {uint32[]} */
  const MUL_ALPHA = [];
  /** @type {uint32[]} */
  const DIV_ALPHA = [];
  for (let c = 0; c < 256; c++) {
    MUL_ALPHA.push(OpCodes.Pack32BE(mulXPow(c, 23, 0xA9), mulXPow(c, 245, 0xA9), mulXPow(c, 48, 0xA9), mulXPow(c, 239, 0xA9)));
    DIV_ALPHA.push(OpCodes.Pack32BE(mulXPow(c, 16, 0xA9), mulXPow(c, 39, 0xA9), mulXPow(c, 6, 0xA9), mulXPow(c, 64, 0xA9)));
  }

  /**
   * The S1 and S2 word substitutions: each byte through the S-box box, then the
   * column mix of the specification with reduction constant c
   * (S1: SR with 0x1B, S2: SQ with 0x69)
   * @param {uint32} w
   * @param {uint8[]} box
   * @param {uint8} c
   * @returns {uint32}
   */
  function sBoxWord(w, box, c) {
    const s0 = box[OpCodes.GetByte(w, 3)];
    const s1 = box[OpCodes.GetByte(w, 2)];
    const s2 = box[OpCodes.GetByte(w, 1)];
    const s3 = box[OpCodes.GetByte(w, 0)];
    const m0 = mulX(s0, c);
    const m1 = mulX(s1, c);
    const m2 = mulX(s2, c);
    const m3 = mulX(s3, c);
    const r0 = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(m0, s1), s2), m3), s3);
    const r1 = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(m0, s0), m1), s2), s3);
    const r2 = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(s0, m1), s1), m2), s3);
    const r3 = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(s0, s1), m2), s2), m3);
    return OpCodes.Pack32BE(r0, r1, r2, r3);
  }

  /**
 * SNOW3GAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class SNOW3GAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SNOW 3G";
      this.description = "3GPP standardized stream cipher for UMTS/3G networks. Used in UEA2 confidentiality and UIA2 integrity algorithms. Features LFSR-based design with FSM and operates on 128-bit keys and IVs.";
      this.inventor = "P. Ekdahl, T. Johansson";
      this.year = 2003;
      this.category = CategoryType.STREAM;
      this.subCategory = "3GPP Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.SE;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // Fixed 128-bit key
      ];
      this.SupportedNonceSizes = [
        new KeySize(16, 16, 0)  // Fixed 128-bit IV
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("3GPP TS 35.216: SNOW 3G Specification", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.216/"),
        new LinkItem("3GPP TS 35.217: Implementors' Test Data", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/"),
        new LinkItem("ETSI/SAGE Specification", "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/snow3gspec.pdf"),
        new LinkItem("Wikipedia: SNOW", "https://en.wikipedia.org/wiki/SNOW")
      ];

      this.references = [
        new LinkItem("CryptoMobile C Reference (ETSI/SAGE-derived)", "https://github.com/mitshell/CryptoMobile")
      ];

      // Security notes
      this.knownVulnerabilities = [
        new Vulnerability(
          "Theoretical Attacks",
          "Some theoretical cryptanalytic attacks exist but require impractical amounts of data",
          "Attacks not practical for real-world 3G usage scenarios"
        )
      ];

      // 3GPP TS 35.217 (UEA2/UIA2 Document 3: Implementors' Test Data), SNOW 3G test sets:
      // keystream words z1 and z2, as the encryption of eight zero bytes
      this.tests = [
        {
          text: "3GPP TS 35.217 SNOW 3G Test Set 1",
          uri: "https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("2BD6459F82C5B300952C49104881FF48"),
          iv: OpCodes.Hex8ToBytes("EA024714AD5C4D84DF1F9B251C0BF45F"),
          expected: OpCodes.Hex8ToBytes("ABEE97047AC31373")
        },
        {
          text: "3GPP TS 35.217 SNOW 3G Test Set 2",
          uri: "https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("8CE33E2CC3C0B5FC1F3DE8A6DC66B1F3"),
          iv: OpCodes.Hex8ToBytes("D3C5D592327FB11CDE551988CEB2F9B7"),
          expected: OpCodes.Hex8ToBytes("EFF8A342F751480F")
        },
        {
          text: "3GPP TS 35.217 SNOW 3G Test Set 3",
          uri: "https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("4035C6680AF8C6D1A8FF8667B1714013"),
          iv: OpCodes.Hex8ToBytes("62A540981BA6F9B74592B0E78690F71B"),
          expected: OpCodes.Hex8ToBytes("A8C874A97AE7C4F8")
        },
        {
          text: "3GPP TS 35.217 SNOW 3G Test Set 4",
          uri: "https://www.3gpp.org/ftp/Specs/archive/35_series/35.217/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0DED7263109CF92E3352255A140E0F76"),
          iv: OpCodes.Hex8ToBytes("6B68079A41A7C4C91BEFD79F7FDCC233"),
          expected: OpCodes.Hex8ToBytes("D712C05CA937C2A6")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SNOW3GInstance(this, isInverse);
    }
  }

  // Instance class implementing production-grade SNOW 3G
  /**
 * SNOW3G cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SNOW3GInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SNOW3GAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // SNOW 3G state
      /** @type {uint32[]} */
      this.LFSR = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];  // 16 32-bit words
      /** @type {uint32} */
      this.R1 = 0;
      /** @type {uint32} */
      this.R2 = 0;
      /** @type {uint32} */
      this.R3 = 0;
      /** @type {boolean} */
      this.initialized = false;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error("Invalid SNOW 3G key size: " + keyBytes.length + " bytes. Requires exactly 16 bytes (128 bits)");
      }

      this._key = [...keyBytes];
      if (this._iv) {
        this._initialize();
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV
    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== 16) {
        throw new Error("Invalid SNOW 3G IV size: " + ivBytes.length + " bytes. Requires exactly 16 bytes (128 bits)");
      }

      this._iv = [...ivBytes];
      if (this._key) {
        this._initialize();
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Feed data to the cipher
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
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the cipher result
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
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("SNOW 3G not properly initialized");
      }

      /** @type {uint8[]} */
      const output = [];

      // Process input data in 4-byte chunks (32-bit words)
      for (let i = 0; i < this.inputBuffer.length; i += 4) {
        const keystreamWord = this._generateKeyword();

        // Convert keystream word to bytes (big-endian)
        /** @type {uint8[]} */
        const keystreamBytes = [
          OpCodes.And32(OpCodes.Shr32(keystreamWord, 24), 0xFF),
          OpCodes.And32(OpCodes.Shr32(keystreamWord, 16), 0xFF),
          OpCodes.And32(OpCodes.Shr32(keystreamWord, 8), 0xFF),
          OpCodes.And32(keystreamWord, 0xFF)
        ];

        // XOR with input data
        for (let j = 0; j < 4 && i + j < this.inputBuffer.length; j++) {
          output.push(OpCodes.Xor32(this.inputBuffer[i + j], keystreamBytes[j]));
        }
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize SNOW 3G with key and IV (initialisation mode of the specification)
    _initialize() {
      if (!this._key || !this._iv) return;

      // Key words k0..k3 and IV words IV0..IV3, big-endian, in byte order
      const k = this._bytesToWords(this._key);
      const iv = this._bytesToWords(this._iv);
      /** @type {uint32} */
      const ONES = 0xFFFFFFFF;

      const s = this.LFSR;
      s[15] = OpCodes.Xor32(k[3], iv[0]);
      s[14] = k[2];
      s[13] = k[1];
      s[12] = OpCodes.Xor32(k[0], iv[1]);
      s[11] = OpCodes.Xor32(k[3], ONES);
      s[10] = OpCodes.Xor32(OpCodes.Xor32(k[2], ONES), iv[2]);
      s[9] = OpCodes.Xor32(OpCodes.Xor32(k[1], ONES), iv[3]);
      s[8] = OpCodes.Xor32(k[0], ONES);
      s[7] = k[3];
      s[6] = k[2];
      s[5] = k[1];
      s[4] = k[0];
      s[3] = OpCodes.Xor32(k[3], ONES);
      s[2] = OpCodes.Xor32(k[2], ONES);
      s[1] = OpCodes.Xor32(k[1], ONES);
      s[0] = OpCodes.Xor32(k[0], ONES);

      this.R1 = 0;
      this.R2 = 0;
      this.R3 = 0;

      // 32 clocks with the FSM output fed into the LFSR
      for (let i = 0; i < 32; i++) {
        const f = this._clockFSM();
        this._clockLFSR(f);
      }

      // Keystream mode starts with one clock whose FSM output is discarded
      this._clockFSM();
      this._clockLFSR(0);

      this.initialized = true;
    }

    // Convert bytes to 32-bit words (big-endian)
    /**
     * @param {uint8[]} bytes
     * @returns {uint32[]}
     */
    _bytesToWords(bytes) {
      /** @type {uint32[]} */
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        words.push(OpCodes.Pack32BE(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]));
      }
      return words;
    }

    // Generate one keystream word: z = F XOR s0, then clock the LFSR in keystream mode
    /**
     * @returns {uint32}
     */
    _generateKeyword() {
      const F = this._clockFSM();
      const z = OpCodes.Xor32(F, this.LFSR[0]);
      this._clockLFSR(0);
      return z;
    }

    // Clock the FSM: F = (s15 + R1) XOR R2; R1 = R2 + (R3 XOR s5), R2 = S1(R1), R3 = S2(R2)
    /**
     * @returns {uint32}
     */
    _clockFSM() {
      const F = OpCodes.Xor32(OpCodes.Add32(this.LFSR[15], this.R1), this.R2);
      const r = OpCodes.Add32(this.R2, OpCodes.Xor32(this.R3, this.LFSR[5]));

      this.R3 = sBoxWord(this.R2, SNOW3G_SQ, 0x69);
      this.R2 = sBoxWord(this.R1, SNOW3G_SR, 0x1B);
      this.R1 = r;

      return F;
    }

    // Clock the LFSR: v = s0*alpha XOR s2 XOR s11*alpha^-1 XOR F (F = 0 in keystream mode)
    /**
     * @param {uint32} F
     */
    _clockLFSR(F) {
      const s = this.LFSR;
      const s0Alpha = OpCodes.Xor32(OpCodes.Shl32(s[0], 8), MUL_ALPHA[OpCodes.GetByte(s[0], 3)]);
      const s11DivAlpha = OpCodes.Xor32(OpCodes.Shr32(s[11], 8), DIV_ALPHA[OpCodes.GetByte(s[11], 0)]);
      const v = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(s0Alpha, s[2]), s11DivAlpha), F);

      for (let i = 0; i < 15; i++) {
        s[i] = s[i + 1];
      }
      s[15] = v;
    }
  }

  // SNOW 3G S-boxes (from 3GPP specification)
  SNOW3GAlgorithm.S1 = SNOW3G_SR;

  SNOW3GAlgorithm.S2 = SNOW3G_SQ;

  // Register the algorithm
  const algorithmInstance = new SNOW3GAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { SNOW3GAlgorithm, SNOW3GInstance };
}));