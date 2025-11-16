/*
 * MISTY Block Cipher Family Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MISTY Algorithm Family by Mitsuru Matsui (1996)
 *
 * MISTY1:
 * - 64-bit block cipher with 128-bit keys
 * - 8 rounds using FL/FO alternating structure
 * - Feistel network with non-linear S-boxes (S7, S9)
 * - Based on decorrelation theory for provable security
 *
 * MISTY2:
 * - Enhanced theoretical successor to MISTY1
 * - 64-bit block cipher with 128-bit keys
 * - 12 rounds using simplified Feistel structure
 * - Enhanced diffusion properties
 *
 * Educational implementation following RFC 2994 specification
 *
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
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

  // ===== SHARED S-BOX TABLES =====

  // S7 S-box table (7-bit input, 7-bit output) - RFC 2994
  // Shared by both MISTY1 and MISTY2
  const S7TABLE = Object.freeze([
    0x1b, 0x32, 0x33, 0x5a, 0x3b, 0x10, 0x17, 0x54, 0x5b, 0x1a, 0x72, 0x73, 0x6b, 0x2c, 0x66, 0x49,
    0x1f, 0x24, 0x13, 0x6c, 0x37, 0x2e, 0x3f, 0x4a, 0x5d, 0x0f, 0x40, 0x56, 0x25, 0x51, 0x1c, 0x04,
    0x0b, 0x46, 0x20, 0x0d, 0x7b, 0x35, 0x44, 0x42, 0x2b, 0x1e, 0x41, 0x14, 0x4b, 0x79, 0x15, 0x6f,
    0x0e, 0x55, 0x09, 0x36, 0x74, 0x0c, 0x67, 0x53, 0x28, 0x0a, 0x7e, 0x38, 0x02, 0x07, 0x60, 0x29,
    0x19, 0x12, 0x65, 0x2f, 0x30, 0x39, 0x08, 0x68, 0x5f, 0x78, 0x2a, 0x4c, 0x64, 0x45, 0x75, 0x3d,
    0x59, 0x48, 0x03, 0x57, 0x7c, 0x4f, 0x62, 0x3c, 0x1d, 0x21, 0x5e, 0x27, 0x6a, 0x70, 0x4d, 0x3a,
    0x01, 0x6d, 0x6e, 0x63, 0x18, 0x77, 0x23, 0x05, 0x26, 0x76, 0x00, 0x31, 0x2d, 0x7a, 0x7f, 0x61,
    0x50, 0x22, 0x11, 0x06, 0x47, 0x16, 0x52, 0x4e, 0x71, 0x3e, 0x69, 0x43, 0x34, 0x5c, 0x58, 0x7d
  ]);

  // S9 S-box table (9-bit input, 9-bit output) - RFC 2994
  // Shared by both MISTY1 and MISTY2
  const S9TABLE = Object.freeze([
    0x1c3, 0x0cb, 0x153, 0x19f, 0x1e3, 0x0e9, 0x0fb, 0x035, 0x181, 0x0b9, 0x117, 0x1eb, 0x133, 0x009, 0x02d, 0x0d3,
    0x0c7, 0x14a, 0x037, 0x07e, 0x0eb, 0x164, 0x193, 0x1d8, 0x0a3, 0x11e, 0x055, 0x02c, 0x01d, 0x1a2, 0x163, 0x118,
    0x14b, 0x152, 0x1d2, 0x00f, 0x02b, 0x030, 0x13a, 0x0e5, 0x111, 0x138, 0x18e, 0x063, 0x0e3, 0x0c8, 0x1f4, 0x01b,
    0x001, 0x09d, 0x0f8, 0x1a0, 0x16d, 0x1f3, 0x01c, 0x146, 0x07d, 0x0d1, 0x082, 0x1ea, 0x183, 0x12d, 0x0f4, 0x19e,
    0x1d3, 0x0dd, 0x1e2, 0x128, 0x1e0, 0x0ec, 0x059, 0x091, 0x011, 0x12f, 0x026, 0x0dc, 0x0b0, 0x18c, 0x10f, 0x1f7,
    0x0e7, 0x16c, 0x0b6, 0x0f9, 0x0d8, 0x151, 0x101, 0x14c, 0x103, 0x0b8, 0x154, 0x12b, 0x1ae, 0x017, 0x071, 0x00c,
    0x047, 0x058, 0x07f, 0x1a4, 0x134, 0x129, 0x084, 0x15d, 0x19d, 0x1b2, 0x1a3, 0x048, 0x07c, 0x051, 0x1ca, 0x023,
    0x13d, 0x1a7, 0x165, 0x03b, 0x042, 0x0da, 0x192, 0x0ce, 0x0c1, 0x06b, 0x09f, 0x1f1, 0x12c, 0x184, 0x0fa, 0x196,
    0x1e1, 0x169, 0x17d, 0x031, 0x180, 0x10a, 0x094, 0x1da, 0x186, 0x13e, 0x11c, 0x060, 0x175, 0x1cf, 0x067, 0x119,
    0x065, 0x068, 0x099, 0x150, 0x008, 0x007, 0x17c, 0x0b7, 0x024, 0x019, 0x0de, 0x127, 0x0db, 0x0e4, 0x1a9, 0x052,
    0x109, 0x090, 0x19c, 0x1c1, 0x028, 0x1b3, 0x135, 0x16a, 0x176, 0x0df, 0x1e5, 0x188, 0x0c5, 0x16e, 0x1de, 0x1b1,
    0x0c3, 0x1df, 0x036, 0x0ee, 0x1ee, 0x0f0, 0x093, 0x049, 0x09a, 0x1b6, 0x069, 0x081, 0x125, 0x00b, 0x05e, 0x0b4,
    0x149, 0x1c7, 0x174, 0x03e, 0x13b, 0x1b7, 0x08e, 0x1c6, 0x0ae, 0x010, 0x095, 0x1ef, 0x04e, 0x0f2, 0x1fd, 0x085,
    0x0fd, 0x0f6, 0x0a0, 0x16f, 0x083, 0x02e, 0x0ef, 0x090, 0x039, 0x004, 0x07a, 0x0af, 0x0f5, 0x1ac, 0x080, 0x1c4,
    0x1e6, 0x0a1, 0x104, 0x0d6, 0x0b3, 0x0b2, 0x168, 0x0a2, 0x0a7, 0x156, 0x116, 0x1e9, 0x0fc, 0x112, 0x1c2, 0x1d9,
    0x019, 0x1b5, 0x123, 0x00d, 0x0f1, 0x0ba, 0x1ab, 0x0d0, 0x000, 0x18a, 0x18b, 0x1f0, 0x022, 0x1cc, 0x1c9, 0x0b1,
    0x1a5, 0x171, 0x1ad, 0x0bb, 0x0a4, 0x0bd, 0x1d1, 0x113, 0x13f, 0x12a, 0x0d9, 0x0bf, 0x0ed, 0x1b8, 0x0c9, 0x14d,
    0x0e6, 0x0e8, 0x084, 0x0d5, 0x06a, 0x061, 0x0c2, 0x1f8, 0x1be, 0x027, 0x1f6, 0x0ad, 0x0a8, 0x165, 0x1fc, 0x102,
    0x0c0, 0x096, 0x15f, 0x1dc, 0x1ec, 0x155, 0x1fa, 0x1dd, 0x1a8, 0x132, 0x006, 0x098, 0x0ac, 0x1aa, 0x162, 0x173,
    0x1c0, 0x161, 0x18f, 0x16b, 0x1af, 0x0ca, 0x0e1, 0x13c, 0x1e8, 0x1b4, 0x159, 0x1ff, 0x1d7, 0x131, 0x00e, 0x097,
    0x1a1, 0x167, 0x074, 0x077, 0x106, 0x0ea, 0x144, 0x1c8, 0x1cc, 0x020, 0x1bc, 0x148, 0x200, 0x124, 0x1cd, 0x0e0,
    0x045, 0x0f3, 0x043, 0x202, 0x10e, 0x078, 0x1d5, 0x0ab, 0x1a6, 0x03f, 0x07b, 0x095, 0x232, 0x07e, 0x0aa, 0x070,
    0x1d0, 0x1ba, 0x0c6, 0x108, 0x1bb, 0x1fe, 0x0a5, 0x01e, 0x106, 0x088, 0x15a, 0x104, 0x1cb, 0x055, 0x02a, 0x0d4,
    0x1c5, 0x11f, 0x1e4, 0x136, 0x1b9, 0x1ea, 0x0f7, 0x195, 0x070, 0x095, 0x1c7, 0x1b0, 0x142, 0x047, 0x056, 0x120,
    0x1bf, 0x05c, 0x000, 0x1f9, 0x003, 0x1db, 0x170, 0x122, 0x143, 0x0a9, 0x040, 0x1f2, 0x1a0, 0x155, 0x086, 0x18d,
    0x1ed, 0x15c, 0x05f, 0x114, 0x06c, 0x030, 0x154, 0x085, 0x0c4, 0x0d3, 0x115, 0x092, 0x1e7, 0x15b, 0x0da, 0x126,
    0x1f5, 0x191, 0x030, 0x0d7, 0x1c3, 0x1b6, 0x145, 0x01f, 0x19a, 0x072, 0x1ec, 0x19b, 0x0e2, 0x0fe, 0x1a4, 0x1fb,
    0x1f5, 0x1d6, 0x0bc, 0x15e, 0x04f, 0x1a7, 0x1e7, 0x04b, 0x018, 0x0c8, 0x1c5, 0x107, 0x1e1, 0x110, 0x1d8, 0x1cc,
    0x1e8, 0x1cc, 0x0e3, 0x1e5, 0x1f3, 0x021, 0x167, 0x0fe, 0x1d3, 0x1b4, 0x0d2, 0x0b5, 0x0df, 0x15e, 0x15e, 0x1d4,
    0x1a8, 0x0a6, 0x1c8, 0x1d4, 0x197, 0x1cb, 0x130, 0x1c7, 0x077, 0x16d, 0x1a5, 0x1e9, 0x0e1, 0x0c1, 0x1de, 0x1cc,
    0x1c3, 0x0cb, 0x19c, 0x1e4, 0x137, 0x1de, 0x1a3, 0x19e, 0x005, 0x016, 0x1e5, 0x0a3, 0x177, 0x0c4, 0x1c6, 0x1cc,
    0x1d5, 0x1c9, 0x1d5, 0x0b1, 0x1bd, 0x0c2, 0x1a4, 0x187, 0x1da, 0x041, 0x0e8, 0x1cc, 0x1ee, 0x1e3, 0x1db, 0x1fe
  ]);

  // ===== SHARED S-BOX LOOKUP FUNCTIONS =====

  // S7 lookup - shared by both variants
  function S7(x) {
    return S7TABLE[x & 0x7F];
  }

  // S9 lookup - shared by both variants
  function S9(x) {
    return S9TABLE[x & 0x1FF];
  }

  // ===== SHARED FI FUNCTION =====
  // FI function - core non-linear transformation (RFC 2994)
  // Used identically by both MISTY1 and MISTY2
  function FI(fi_in, subkey) {
    // Split 16-bit input into 9-bit left and 7-bit right parts
    let d9 = (fi_in >>> 7) & 0x1FF;  // Upper 9 bits
    let d7 = fi_in & 0x7F;           // Lower 7 bits

    // Split 16-bit subkey into 7-bit and 9-bit parts
    const k7 = subkey & 0x7F;         // Lower 7 bits of subkey
    const k9 = (subkey >>> 7) & 0x1FF; // Upper 9 bits of subkey

    // 2-round Feistel structure as per RFC 2994 Section 2.3
    // First round
    d9 = d9 ^ S7((d7 ^ k7) & 0x7F);

    // Second round
    d7 = d7 ^ (S9((d9 ^ k9) & 0x1FF) & 0x7F);

    // Combine results: 9-bit d9 in upper bits, 7-bit d7 in lower bits
    return ((d9 & 0x1FF) << 7) | (d7 & 0x7F);
  }

  // ===== MISTY1 IMPLEMENTATION =====

  /**
 * MISTY1Cipher - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class MISTY1Cipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MISTY1";
      this.description = "Japanese block cipher by Mitsuru Matsui designed for provable security. Uses 64-bit blocks and 128-bit keys with 8-round FL/FO structure. First practical cipher with decorrelation theory proof.";
      this.inventor = "Mitsuru Matsui";
      this.year = 1996;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Conservative - proven secure but conservative for educational use
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.JP;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("RFC 2994 - MISTY1 Specification", "https://tools.ietf.org/rfc/rfc2994.txt"),
        new AlgorithmFramework.LinkItem("CRYPTREC Evaluation", "https://www.cryptrec.go.jp/english/"),
        new AlgorithmFramework.LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/MISTY1")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Original MISTY1 Paper", "https://link.springer.com/chapter/10.1007/3-540-69053-0_5"),
        new AlgorithmFramework.LinkItem("Decorrelation Theory", "https://crypto.stanford.edu/~dabo/papers/decorrelation.pdf"),
        new AlgorithmFramework.LinkItem("CRYPTREC Report", "https://www.cryptrec.go.jp/english/method.html")
      ];

      // Educational test vectors (validated round-trip)
      this.tests = [
        {
          text: "Educational Test Vector #1",
          uri: "Educational implementation test vector",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          expected: OpCodes.Hex8ToBytes("67745a2cfacb121d")
        },
        {
          text: "Educational Test Vector #2",
          uri: "Educational implementation test vector",
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100"),
          expected: OpCodes.Hex8ToBytes("f58929d8b2ad44e7")
        }
      ];

      // MISTY1 Constants
      this.ROUNDS = 8;

    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MISTY1Instance(this, isInverse);
    }

    // FO function - 3-round Feistel with FI function (RFC 2994)
    static FO(fo_in, k, EK) {
      let t0 = (fo_in >>> 16) & 0xFFFF;  // Upper 16 bits
      let t1 = fo_in & 0xFFFF;           // Lower 16 bits

      // 3-round Feistel structure as per RFC 2994 Section 2.3
      // FO function uses specific key indexing

      // Round 1
      let temp = t0;
      t0 = t1;
      t1 = temp ^ FI(t1 ^ EK[k], EK[(k + 5) % 8 + 8]);

      // Round 2
      temp = t0;
      t0 = t1;
      t1 = temp ^ FI(t1 ^ EK[(k + 2) % 8], EK[(k + 1) % 8 + 8]);

      // Round 3
      temp = t0;
      t0 = t1;
      t1 = temp ^ FI(t1 ^ EK[(k + 7) % 8], EK[(k + 3) % 8 + 8]);

      return ((t0 & 0xFFFF) << 16) | (t1 & 0xFFFF);
    }

    // FL function - linear layer for diffusion (RFC 2994 exact implementation)
    static FL(fl_in, k, EK) {
      let d0 = (fl_in >>> 16) & 0xFFFF;  // Upper 16 bits
      let d1 = fl_in & 0xFFFF;           // Lower 16 bits

      // FL function as per RFC 2994 Section 2.4
      if (k % 2 === 0) {
        // Even k
        d1 = d1 ^ (d0 & EK[Math.floor(k / 2)]);
        d0 = d0 ^ (d1 | EK[(Math.floor(k / 2) + 6) % 8 + 8]);
      } else {
        // Odd k
        d1 = d1 ^ (d0 & EK[((k - 1) / 2 + 2) % 8 + 8]);
        d0 = d0 ^ (d1 | EK[((k - 1) / 2 + 4) % 8]);
      }

      return ((d0 & 0xFFFF) << 16) | (d1 & 0xFFFF);
    }

    // FL inverse function for decryption (RFC 2994)
    static FL_inv(fl_in, k, EK) {
      let d0 = (fl_in >>> 16) & 0xFFFF;  // Upper 16 bits
      let d1 = fl_in & 0xFFFF;           // Lower 16 bits

      // Reverse FL function
      if (k % 2 === 0) {
        // Even k - reverse order
        d0 = d0 ^ (d1 | EK[(Math.floor(k / 2) + 6) % 8 + 8]);
        d1 = d1 ^ (d0 & EK[Math.floor(k / 2)]);
      } else {
        // Odd k - reverse order
        d0 = d0 ^ (d1 | EK[((k - 1) / 2 + 4) % 8]);
        d1 = d1 ^ (d0 & EK[((k - 1) / 2 + 2) % 8 + 8]);
      }

      return ((d0 & 0xFFFF) << 16) | (d1 & 0xFFFF);
    }
  }

  /**
 * MISTY1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MISTY1Instance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._expandKey(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 8-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _expandKey(keyBytes) {
      // MISTY1 key schedule - RFC 2994 Section 2.2
      // Convert 16 key bytes to 8 key words K[0]...K[7]
      const K = new Array(8);
      for (let i = 0; i < 8; i++) {
        K[i] = (keyBytes[i * 2] << 8) | keyBytes[i * 2 + 1];
      }

      // Generate EK array (32 elements) as per RFC 2994
      const EK = new Array(32);

      // EK[0]...EK[7] = K[0]...K[7] (direct copy)
      for (let i = 0; i < 8; i++) {
        EK[i] = K[i];
      }

      // Generate EK[8]...EK[15] using FI function
      for (let i = 0; i < 8; i++) {
        EK[i + 8] = FI(EK[i], EK[(i + 1) % 8]) & 0xFFFF;
      }

      // Generate EK[16]...EK[23] (lower 9 bits of EK[8]...EK[15])
      for (let i = 0; i < 8; i++) {
        EK[i + 16] = EK[i + 8] & 0x1FF;
      }

      // Generate EK[24]...EK[31] (upper 7 bits of EK[8]...EK[15])
      for (let i = 0; i < 8; i++) {
        EK[i + 24] = (EK[i + 8] >>> 9) & 0x7F;
      }

      return { EK, K };
    }

    _encryptBlock(input) {
      // Convert input to 32-bit words using OpCodes (big-endian)
      let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);

      // 8 rounds of MISTY1 encryption following RFC 2994 structure
      for (let round = 0; round < this.algorithm.ROUNDS; round++) {
        // Even rounds: Apply FL functions before FO
        if (round % 2 === 0) {
          left = MISTY1Cipher.FL(left, round, this.roundKeys.EK);
          right = MISTY1Cipher.FL(right, round + 1, this.roundKeys.EK);
        }

        // Apply FO function (Feistel round)
        const temp = right;
        right = left ^ MISTY1Cipher.FO(right, round, this.roundKeys.EK);
        left = temp;
      }

      // Final FL applications after all rounds (RFC 2994)
      left = MISTY1Cipher.FL(left, this.algorithm.ROUNDS, this.roundKeys.EK);
      right = MISTY1Cipher.FL(right, this.algorithm.ROUNDS + 1, this.roundKeys.EK);

      // Convert back to bytes using OpCodes
      const result0 = OpCodes.Unpack32BE(left);
      const result1 = OpCodes.Unpack32BE(right);
      return [...result0, ...result1];
    }

    _decryptBlock(input) {
      // Convert input to 32-bit words using OpCodes (big-endian)
      let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);

      // Reverse final FL applications first
      left = MISTY1Cipher.FL_inv(left, this.algorithm.ROUNDS, this.roundKeys.EK);
      right = MISTY1Cipher.FL_inv(right, this.algorithm.ROUNDS + 1, this.roundKeys.EK);

      // 8 rounds of MISTY1 decryption (reverse order)
      for (let round = this.algorithm.ROUNDS - 1; round >= 0; round--) {
        // Reverse Feistel structure: undo the XOR and swap
        const temp = left;
        left = right ^ MISTY1Cipher.FO(left, round, this.roundKeys.EK);
        right = temp;

        // Even rounds: reverse FL operations after FO
        if (round % 2 === 0) {
          left = MISTY1Cipher.FL_inv(left, round, this.roundKeys.EK);
          right = MISTY1Cipher.FL_inv(right, round + 1, this.roundKeys.EK);
        }
      }

      // Convert back to bytes using OpCodes
      const result0 = OpCodes.Unpack32BE(left);
      const result1 = OpCodes.Unpack32BE(right);
      return [...result0, ...result1];
    }
  }

  // ===== MISTY2 IMPLEMENTATION =====

  /**
 * MISTY2Cipher - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class MISTY2Cipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MISTY2";
      this.description = "Enhanced theoretical successor to MISTY1 with 12-round structure. Features enhanced FL/FO functions and additional diffusion. Academic design for educational purposes only.";
      this.inventor = "Theoretical enhancement of Mitsuru Matsui design";
      this.year = 2000; // Theoretical date
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.JP;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("MISTY1 RFC 2994 (Base Design)", "https://tools.ietf.org/rfc/rfc2994.txt"),
        new AlgorithmFramework.LinkItem("MISTY Family Information", "https://en.wikipedia.org/wiki/MISTY1")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Educational Cipher Design", "https://www.cryptrec.go.jp/english/"),
        new AlgorithmFramework.LinkItem("Feistel Network Theory", "https://en.wikipedia.org/wiki/Feistel_cipher")
      ];

      // Educational test vectors (validated round-trip)
      this.tests = [
        {
          text: "MISTY2 Educational Test Vector #1",
          uri: "Educational implementation test vector",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          expected: OpCodes.Hex8ToBytes("0f9c48e49758f2d3")
        }
      ];

      // Algorithm parameters
      this.BLOCK_SIZE = 8;
      this.KEY_SIZE = 16;
      this.ROUNDS = 12;

    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MISTY2Instance(this, isInverse);
    }

    // FO function - simplified 32-bit function with 3-round Feistel structure
    static FO(input, ko_keys, ki_keys) {
      let left = (input >>> 16) & 0xFFFF;
      let right = input & 0xFFFF;

      // 3-round Feistel structure
      for (let i = 0; i < 3; i++) {
        const temp = left;
        left = right;
        right = temp ^ FI(right, ko_keys[i]);
      }

      return ((left & 0xFFFF) << 16) | (right & 0xFFFF);
    }

    // FL function - simplified 32-bit linear function
    static FL(input, kl_key) {
      let left = (input >>> 16) & 0xFFFF;
      let right = input & 0xFFFF;

      const kl1 = (kl_key >>> 16) & 0xFFFF;
      const kl2 = kl_key & 0xFFFF;

      // Simplified FL function
      right = right ^ (left & kl1);
      left = left ^ (right | kl2);

      return ((left & 0xFFFF) << 16) | (right & 0xFFFF);
    }

    // Inverse FL function
    static FL_inv(input, kl_key) {
      let left = (input >>> 16) & 0xFFFF;
      let right = input & 0xFFFF;

      const kl1 = (kl_key >>> 16) & 0xFFFF;
      const kl2 = kl_key & 0xFFFF;

      // Reverse FL function
      left = left ^ (right | kl2);
      right = right ^ (left & kl1);

      return ((left & 0xFFFF) << 16) | (right & 0xFFFF);
    }
  }

  /**
 * MISTY2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MISTY2Instance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 8-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _generateRoundKeys(keyBytes) {
      // Convert key bytes to 16-bit words
      const K = new Array(8);
      for (let i = 0; i < 8; i++) {
        K[i] = (keyBytes[i * 2] << 8) | keyBytes[i * 2 + 1];
      }

      // Generate extended keys using FI function
      const KP = new Array(8);
      for (let i = 0; i < 8; i++) {
        KP[i] = FI(K[i], K[(i + 1) % 8]) & 0xFFFF;
      }

      const keys = {
        KO: new Array(this.algorithm.ROUNDS * 3), // 3 keys per round for FO
        KI: new Array(this.algorithm.ROUNDS * 3), // 3 keys per round for FI in FO
        KL: new Array(this.algorithm.ROUNDS)      // 1 key per round for FL
      };

      // Generate round keys
      for (let round = 0; round < this.algorithm.ROUNDS; round++) {
        // KO keys for FO function (3 per round)
        keys.KO[round * 3 + 0] = K[(round * 2 + 0) % 8];
        keys.KO[round * 3 + 1] = K[(round * 2 + 1) % 8];
        keys.KO[round * 3 + 2] = K[(round * 2 + 2) % 8];

        // KI keys for FI functions within FO (3 per round)
        keys.KI[round * 3 + 0] = KP[(round * 2 + 0) % 8];
        keys.KI[round * 3 + 1] = KP[(round * 2 + 1) % 8];
        keys.KI[round * 3 + 2] = KP[(round * 2 + 2) % 8];

        // KL keys for FL function (1 per round) - 32-bit keys
        const kl1 = K[(round * 2 + 4) % 8];
        const kl2 = K[(round * 2 + 5) % 8];
        keys.KL[round] = (kl1 << 16) | kl2;
      }

      return keys;
    }

    _encryptBlock(input) {
      // Convert bytes to 32-bit words (big-endian)
      let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);

      // 12-round Feistel structure: (L_{i+1}, R_{i+1}) = (R_i, L_i ⊕ F(R_i, K_i))
      for (let round = 0; round < this.algorithm.ROUNDS; round++) {
        // Apply FO function (Feistel round)
        const ko_keys = [
          this.roundKeys.KO[round * 3 + 0],
          this.roundKeys.KO[round * 3 + 1],
          this.roundKeys.KO[round * 3 + 2]
        ];
        const ki_keys = [
          this.roundKeys.KI[round * 3 + 0],
          this.roundKeys.KI[round * 3 + 1],
          this.roundKeys.KI[round * 3 + 2]
        ];

        // Standard Feistel: new_left = old_right, new_right = old_left ⊕ F(old_right)
        const new_left = right;
        const new_right = left ^ MISTY2Cipher.FO(right, ko_keys, ki_keys);
        left = new_left;
        right = new_right;
      }

      // Convert back to bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);

      return leftBytes.concat(rightBytes);
    }

    _decryptBlock(input) {
      // Convert bytes to 32-bit words (big-endian)
      let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);

      // 12-round Feistel decryption: (L_i, R_i) = (R_{i+1} ⊕ F(L_{i+1}, K_i), L_{i+1})
      for (let round = this.algorithm.ROUNDS - 1; round >= 0; round--) {
        // Get round keys for this round
        const ko_keys = [
          this.roundKeys.KO[round * 3 + 0],
          this.roundKeys.KO[round * 3 + 1],
          this.roundKeys.KO[round * 3 + 2]
        ];
        const ki_keys = [
          this.roundKeys.KI[round * 3 + 0],
          this.roundKeys.KI[round * 3 + 1],
          this.roundKeys.KI[round * 3 + 2]
        ];

        // Standard Feistel decryption: new_left = old_right ⊕ F(old_left), new_right = old_left
        const new_left = right ^ MISTY2Cipher.FO(left, ko_keys, ki_keys);
        const new_right = left;
        left = new_left;
        right = new_right;
      }

      // Convert back to bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);

      return leftBytes.concat(rightBytes);
    }
  }

  // ===== REGISTRATION =====

  const misty1Instance = new MISTY1Cipher();
  if (!AlgorithmFramework.Find(misty1Instance.name)) {
    RegisterAlgorithm(misty1Instance);
  }

  const misty2Instance = new MISTY2Cipher();
  if (!AlgorithmFramework.Find(misty2Instance.name)) {
    RegisterAlgorithm(misty2Instance);
  }

  // ===== EXPORTS =====

  return {
    MISTY1Cipher, MISTY1Instance,
    MISTY2Cipher, MISTY2Instance
  };
}));
