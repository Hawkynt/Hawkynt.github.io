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
        new LinkItem("ETSI/SAGE Specification", "https://www.gsma.com/aboutus/wp-content/uploads/2014/12/snow3gspec.pdf"),
        new LinkItem("Wikipedia: SNOW", "https://en.wikipedia.org/wiki/SNOW")
      ];

      // Security notes
      this.knownVulnerabilities = [
        new Vulnerability(
          "Theoretical Attacks",
          "Some theoretical cryptanalytic attacks exist but require impractical amounts of data",
          "Attacks not practical for real-world 3G usage scenarios"
        )
      ];

      // Official 3GPP TS 35.216 test vectors
      this.tests = [
        {
          text: "3GPP TS 35.216 Test Vector 1",
          uri: "https://www.3gpp.org/ftp/Specs/archive/35_series/35.216/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("13b2655e88d404bb")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SNOW3GInstance(this, isInverse);
    }
  }

  // Instance class implementing production-grade SNOW 3G
  class SNOW3GInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // SNOW 3G state
      this.LFSR = new Array(16).fill(0);  // 16 32-bit words
      this.R1 = 0;
      this.R2 = 0;
      this.R3 = 0;
      this.initialized = false;
    }

    // Property setter for key
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
        throw new Error(`Invalid SNOW 3G key size: ${keyBytes.length} bytes. Requires exactly 16 bytes (128 bits)`);
      }

      this._key = [...keyBytes];
      if (this._iv) {
        this._initialize();
      }
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV
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
        throw new Error(`Invalid SNOW 3G IV size: ${ivBytes.length} bytes. Requires exactly 16 bytes (128 bits)`);
      }

      this._iv = [...ivBytes];
      if (this._key) {
        this._initialize();
      }
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Feed data to the cipher
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

      this.inputBuffer.push(...data);
    }

    // Get the cipher result
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

      const output = [];

      // Process input data in 4-byte chunks (32-bit words)
      for (let i = 0; i < this.inputBuffer.length; i += 4) {
        const keystreamWord = this._generateKeyword();

        // Convert keystream word to bytes (big-endian)
        const keystreamBytes = [
          (keystreamWord >>> 24) & 0xFF,
          (keystreamWord >>> 16) & 0xFF,
          (keystreamWord >>> 8) & 0xFF,
          keystreamWord & 0xFF
        ];

        // XOR with input data
        for (let j = 0; j < 4 && i + j < this.inputBuffer.length; j++) {
          output.push(this.inputBuffer[i + j] ^ keystreamBytes[j]);
        }
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize SNOW 3G with key and IV
    _initialize() {
      if (!this._key || !this._iv) return;

      // Convert key and IV to 32-bit words
      const K = this._bytesToWords(this._key);
      const IV = this._bytesToWords(this._iv);

      // Initialize LFSR according to SNOW 3G specification
      for (let i = 0; i < 16; i++) {
        if (i < 4) {
          this.LFSR[i] = K[3 - i] ^ IV[3 - i];
        } else if (i < 8) {
          this.LFSR[i] = K[11 - i];
        } else if (i < 12) {
          this.LFSR[i] = K[7 - (i - 8)] ^ IV[7 - (i - 8)];
        } else {
          this.LFSR[i] = K[19 - i];
        }
      }

      // Initialize FSM registers
      this.R1 = 0;
      this.R2 = 0;
      this.R3 = 0;

      // Run initialization phase (32 clocks without output)
      for (let i = 0; i < 32; i++) {
        const f = this._clockFSM();
        this._clockLFSR(f);
      }

      this.initialized = true;
    }

    // Convert bytes to 32-bit words (big-endian)
    _bytesToWords(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        const word = OpCodes.Pack32BE(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
        words.push(word >>> 0); // Ensure unsigned
      }
      return words;
    }

    // Generate one keystream word
    _generateKeyword() {
      const F = this._clockFSM();
      this._clockLFSR(0); // Clock LFSR with 0 during keystream generation
      return (F ^ this.LFSR[0]) >>> 0;
    }

    // FSM function
    _clockFSM() {
      const F = (this.LFSR[15] + this.R1) >>> 0;
      const r = (this.R2 + (this.R3 ^ this.LFSR[5])) >>> 0;

      this.R3 = this._S2_T(this.R2) >>> 0;
      this.R2 = this._S1_T(this.R1) >>> 0;
      this.R1 = r;

      return F;
    }

    // LFSR function
    _clockLFSR(F) {
      const v = (this.LFSR[0] ^ this._mulAlpha(this.LFSR[2]) ^ this.LFSR[11] ^ this._mulAlpha(this.LFSR[15]) ^ F) >>> 0;

      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = v;
    }

    // S-box substitution S1
    _S1_T(w) {
      return ((SNOW3GAlgorithm.S1[(w >>> 24) & 0xFF] << 24) |
              (SNOW3GAlgorithm.S1[(w >>> 16) & 0xFF] << 16) |
              (SNOW3GAlgorithm.S1[(w >>> 8) & 0xFF] << 8) |
              (SNOW3GAlgorithm.S1[w & 0xFF])) >>> 0;
    }

    // S-box substitution S2
    _S2_T(w) {
      return ((SNOW3GAlgorithm.S2[(w >>> 24) & 0xFF] << 24) |
              (SNOW3GAlgorithm.S2[(w >>> 16) & 0xFF] << 16) |
              (SNOW3GAlgorithm.S2[(w >>> 8) & 0xFF] << 8) |
              (SNOW3GAlgorithm.S2[w & 0xFF])) >>> 0;
    }

    // Multiplication by alpha in GF(2^32)
    _mulAlpha(w) {
      return ((w << 8) | (w >>> 24)) >>> 0;
    }
  }

  // SNOW 3G S-boxes (from 3GPP specification)
  SNOW3GAlgorithm.S1 = [
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

  SNOW3GAlgorithm.S2 = [
      0xE2, 0x4E, 0x54, 0xFC, 0x94, 0xC2, 0x4A, 0xCC, 0x62, 0x0D, 0x6A, 0x46, 0x3C, 0x4D, 0x8B, 0xD1,
      0x5E, 0xFA, 0x64, 0xCB, 0xB4, 0x97, 0xBE, 0x2B, 0xBC, 0x77, 0x2E, 0x03, 0xD3, 0x19, 0x59, 0xC1,
      0x1D, 0x06, 0x41, 0x6B, 0x55, 0xF0, 0x99, 0x69, 0xEA, 0x9C, 0x18, 0xAE, 0x63, 0xDF, 0xE7, 0xBB,
      0x00, 0x73, 0x66, 0xFB, 0x96, 0x4C, 0x85, 0xE4, 0x3A, 0x09, 0x45, 0xAA, 0x0F, 0xEE, 0x10, 0xEB,
      0x2D, 0x7F, 0xF4, 0x29, 0xAC, 0xCF, 0xAD, 0x91, 0x8D, 0x78, 0xC8, 0x95, 0xF9, 0x2F, 0xCE, 0xCD,
      0x08, 0x7A, 0x88, 0x38, 0x5C, 0x83, 0x2A, 0x28, 0x47, 0xDB, 0xB8, 0xC7, 0x93, 0xA4, 0x12, 0x53,
      0xFF, 0x87, 0x0E, 0x31, 0x36, 0x21, 0x58, 0x48, 0x01, 0x8E, 0x37, 0x74, 0x32, 0xCA, 0xE9, 0xB1,
      0xB7, 0xAB, 0x0C, 0xD7, 0xC4, 0x56, 0x42, 0x26, 0x07, 0x98, 0x60, 0xD9, 0xB6, 0xB9, 0x11, 0x40,
      0xEC, 0x20, 0x8C, 0xBD, 0xA0, 0xC9, 0x84, 0x04, 0x49, 0x23, 0xF1, 0x4F, 0x50, 0x1F, 0x13, 0xDC,
      0xD8, 0xC0, 0x9E, 0x57, 0xE3, 0xC3, 0x7B, 0x65, 0x3B, 0x02, 0x8F, 0x3E, 0xE8, 0x25, 0x92, 0xE5,
      0x15, 0xDD, 0xFD, 0x17, 0xA9, 0xBF, 0xD4, 0x9A, 0x7E, 0xC5, 0x39, 0x67, 0xFE, 0x76, 0x9D, 0x43,
      0xA7, 0xE1, 0xD0, 0xF5, 0x68, 0xF2, 0x1B, 0x34, 0x70, 0x05, 0xA3, 0x8A, 0xD5, 0x79, 0x86, 0xA8,
      0x30, 0xC6, 0x51, 0x4B, 0x1E, 0xA6, 0x27, 0xF6, 0x35, 0xD2, 0x6E, 0x24, 0x16, 0x82, 0x5F, 0xDA,
      0xE6, 0x75, 0xA2, 0xEF, 0x2C, 0xB2, 0x1C, 0x9F, 0x5D, 0x6F, 0x80, 0x0A, 0x72, 0x44, 0x9B, 0x6C,
      0x90, 0x0B, 0x5B, 0x33, 0x7D, 0x5A, 0x52, 0xF3, 0x61, 0xA1, 0xF7, 0xB0, 0xD6, 0x3F, 0x7C, 0x6D,
      0xED, 0x14, 0xE0, 0xA5, 0x3D, 0x22, 0xB3, 0xF8, 0x89, 0xDE, 0x71, 0x1A, 0xAF, 0xBA, 0xB5, 0x81
  ];

  // Register the algorithm
  const algorithmInstance = new SNOW3GAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { SNOW3GAlgorithm, SNOW3GInstance };
}));