/*
 * TinyJAMBU AEAD Family (128/192/256-bit) - NIST LWC Finalist
 * Professional implementation following NIST Lightweight Cryptography Competition specification
 * (c)2006-2025 Hawkynt
 *
 * TinyJAMBU is a family of lightweight authenticated encryption algorithms designed for
 * resource-constrained environments. It was a finalist in the NIST Lightweight Cryptography
 * Competition. This implementation provides all three key variants: 128-bit, 192-bit, and 256-bit.
 *
 * Algorithm Parameters (all variants):
 * - Nonce: 96 bits (12 bytes)
 * - Tag: 64 bits (8 bytes)
 * - State: 128 bits (4 x 32-bit words)
 *
 * Key Sizes:
 * - TinyJAMBU-128: 128 bits (16 bytes), 8 rounds init/finalize
 * - TinyJAMBU-192: 192 bits (24 bytes), 9 rounds init/finalize
 * - TinyJAMBU-256: 256 bits (32 bytes), 10 rounds init/finalize
 *
 * The core permutation uses a keyed feedback shift register with nonlinear feedback
 * function combining XOR, AND, and NOT operations. Domain separators distinguish
 * different phases: 0x10 (nonce), 0x30 (associated data), 0x50 (plaintext/ciphertext),
 * 0x70 (finalization).
 *
 * Reference: https://csrc.nist.gov/projects/lightweight-cryptography
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/tinyjambu-spec-final.pdf
 * C Reference: https://github.com/rweather/lwc-finalists
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SHARED CORE FUNCTIONS =====

  /**
   * Perform 32 TinyJAMBU steps (one step per bit)
   * This is the core nonlinear feedback function shared by all variants
   * @param {uint32} s0 - State word 0
   * @param {uint32} s1 - State word 1
   * @param {uint32} s2 - State word 2
   * @param {uint32} s3 - State word 3
   * @param {uint32} kword - Key word
   * @returns {uint32} New state word value
   */
  function steps32(s0, s1, s2, s3, kword) {
    // Compute feedback taps using bitwise shift operations
    // Note: These combine two words via shifts, NOT rotations of a single word
    const t1 = OpCodes.Or32(OpCodes.Shr32(s1, 15), OpCodes.Shl32(s2, 17));
    const t2 = OpCodes.Or32(OpCodes.Shr32(s2, 6), OpCodes.Shl32(s3, 26));
    const t3 = OpCodes.Or32(OpCodes.Shr32(s2, 21), OpCodes.Shl32(s3, 11));
    const t4 = OpCodes.Or32(OpCodes.Shr32(s2, 27), OpCodes.Shl32(s3, 5));

    // Nonlinear feedback: XOR(t1, NAND(t2,t3), t4, key)
    // NAND(t2,t3) = NOT(AND(t2,t3)) = XOR(AND(t2,t3), 0xFFFFFFFF)
    return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(s0, t1), OpCodes.Xor32(OpCodes.And32(t2, t3), 0xFFFFFFFF)), t4), kword));
  }

  // ===== ALGORITHM CLASS =====

  /**
   * TinyJAMBU AEAD Algorithm (supports 128, 192, 256-bit variants)
   */
  class TinyJAMBUAlgorithm extends AeadAlgorithm {
    /**
     * @param {string} [variant='128'] - Key size in bits: '128', '192' or '256'
     */
    constructor(variant = '128') {
      super();

      // Store variant-specific parameters
      /** @type {string} */
      this.variant = variant;
      /** @type {int32} */
      this.keySize = 0;
      /** @type {int32} */
      this.keyWords = 0;
      /** @type {int32} */
      this.initRounds = 0;

      if (variant === '128') {
        this.keySize = 16;
        this.keyWords = 4;
        this.initRounds = 8;
        this.description = "Lightweight authenticated encryption finalist in NIST LWC. Features 128-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.";
        this.country = CountryCode.CN;
        this.tests = [
          {
            text: "TinyJAMBU-128: Empty message, empty AAD (Count 1)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes(""),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("7C5456E109B55A3A")
          },
          {
            text: "TinyJAMBU-128: Empty message with 1-byte AAD (Count 2)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00"),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("607DFB91AE92D187")
          },
          {
            text: "TinyJAMBU-128: Empty message with 4-byte AAD (Count 5)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00010203"),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("F7A293DB3FB16464")
          },
          {
            text: "TinyJAMBU-128: 1-byte message, empty AAD (Count 34)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes(""),
            input: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("02A5B193AD5739203E")
          },
          {
            text: "TinyJAMBU-128: 1-byte message with 1-byte AAD (Count 35)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00"),
            input: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("CAB4391F64177F8C2B")
          },
          {
            text: "TinyJAMBU-128: 4-byte message with 4-byte AAD (Count 137)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00010203"),
            input: OpCodes.Hex8ToBytes("00010203"),
            expected: OpCodes.Hex8ToBytes("362BC344C45C165CECA7FD82")
          },
          {
            text: "TinyJAMBU-128: 8-byte message with 8-byte AAD (Count 273)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("0001020304050607"),
            input: OpCodes.Hex8ToBytes("0001020304050607"),
            expected: OpCodes.Hex8ToBytes("C7D6A4D8244A54636022D9E7AB0A0673")
          }
        ];
      } else if (variant === '192') {
        this.keySize = 24;
        this.keyWords = 6;
        this.initRounds = 9;
        this.description = "Lightweight authenticated encryption finalist in NIST LWC. Features 192-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.";
        this.country = CountryCode.INTL;
        this.tests = [
          {
            text: "TinyJAMBU-192: Empty message, empty AAD (Count 1)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes(""),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("7A0775B5021A22A6")
          },
          {
            text: "TinyJAMBU-192: Empty message with 1-byte AAD (Count 2)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00"),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("CE89A55740C8B4E3")
          },
          {
            text: "TinyJAMBU-192: Empty message with 4-byte AAD (Count 5)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00010203"),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("BB87C0583A6DD75A")
          },
          {
            text: "TinyJAMBU-192: 1-byte message, empty AAD (Count 34)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes(""),
            input: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("6017F2D006DCC66569")
          },
          {
            text: "TinyJAMBU-192: 1-byte message with 1-byte AAD (Count 35)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00"),
            input: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("803A2659C516B939AB")
          },
          {
            text: "TinyJAMBU-192: 4-byte message with 4-byte AAD (Count 137)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00010203"),
            input: OpCodes.Hex8ToBytes("00010203"),
            expected: OpCodes.Hex8ToBytes("EC0F17ADE4456F9A644D5FC2")
          },
          {
            text: "TinyJAMBU-192: 8-byte message with 32-byte AAD (Count 297)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            input: OpCodes.Hex8ToBytes("0001020304050607"),
            expected: OpCodes.Hex8ToBytes("813CA1B8AA61E2A8951D73F7B2D03BB3")
          }
        ];
      } else if (variant === '256') {
        this.keySize = 32;
        this.keyWords = 8;
        this.initRounds = 10;
        this.description = "Lightweight authenticated encryption finalist in NIST LWC. Features 256-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.";
        this.country = CountryCode.INTL;
        this.tests = [
          {
            text: "TinyJAMBU-256: Empty message, empty AAD (Count 1)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes(""),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("9B04ED416F7D7F56")
          },
          {
            text: "TinyJAMBU-256: Empty message with 1-byte AAD (Count 2)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00"),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("A68D4C7689096558")
          },
          {
            text: "TinyJAMBU-256: Empty message with 4-byte AAD (Count 5)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00010203"),
            input: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("90F1ACE82C4C5FFE")
          },
          {
            text: "TinyJAMBU-256: 1-byte message, empty AAD (Count 34)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes(""),
            input: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("0FE90A41B4AA18329F")
          },
          {
            text: "TinyJAMBU-256: 1-byte message with 1-byte AAD (Count 35)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00"),
            input: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("20BB303279C2739CE5")
          },
          {
            text: "TinyJAMBU-256: 4-byte message with 4-byte AAD (Count 137)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("00010203"),
            input: OpCodes.Hex8ToBytes("00010203"),
            expected: OpCodes.Hex8ToBytes("0243655595B82F3B398F3D96")
          },
          {
            text: "TinyJAMBU-256: 8-byte message with 32-byte AAD (Count 297)",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
            aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
            input: OpCodes.Hex8ToBytes("0001020304050607"),
            expected: OpCodes.Hex8ToBytes("A5628DF713D4316218A127FC09046F81")
          }
        ];
      } else {
        throw new Error("Unsupported TinyJAMBU variant: " + variant);
      }

      // Required metadata
      this.name = "TinyJAMBU-" + variant + " AEAD";
      this.inventor = "Hongjun Wu, Tao Huang";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;

      this.SupportedKeySizes = [new KeySize(this.keySize, this.keySize, 1)];
      this.SupportedTagSizes = [new KeySize(8, 8, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Finalist Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/tinyjambu-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography Project",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
      ];

      this.references = [
        new LinkItem(
          "rweather/TinyJAMBU Official-Author-Adjacent Reference (C)",
          "https://github.com/rweather/TinyJAMBU"
        ),
        new LinkItem(
          "rweather/lwc-finalists C Reference (embedded-optimized)",
          "https://github.com/rweather/lwc-finalists"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TinyJAMBUInstance(this, isInverse);
    }
  }

  // ===== INSTANCE CLASS =====

  /**
   * TinyJAMBU AEAD Instance (supports all variants)
   */
  class TinyJAMBUInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {TinyJAMBUAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._nonce = null;
      /** @type {uint8[]} */
      this._aad = [];
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Store variant-specific parameters
      /** @type {int32} */
      this.keySize = algorithm.keySize;
      /** @type {int32} */
      this.keyWords = algorithm.keyWords;
      /** @type {int32} */
      this.initRounds = algorithm.initRounds;
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

      if (keyBytes.length !== this.keySize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected " + this.keySize + ")");
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 12) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (expected 12)");
      }

      this._nonce = [...nonceBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get nonce() { return this._nonce ? [...this._nonce] : null; }

    /**
     * @param {uint8[]|null} aadBytes
     */
    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get aad() { return [...this._aad]; }

    /**
     * @param {uint8[]|null} adBytes
     */
    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    /**
     * @returns {uint8[]|null}
     */
    get associatedData() {
      return this.aad;
    }


    /**
   * Get cipher result (encrypted or decrypted inWord)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        // Decrypt mode
        if (this.inputBuffer.length < 8) {
          throw new Error("Ciphertext too short (must include 8-byte tag)");
        }
        return this._decrypt();
      } else {
        // Encrypt mode
        return this._encrypt();
      }
    }

    // ===== PERMUTATION FUNCTIONS =====

    /**
     * TinyJAMBU-128 permutation (4-word key schedule)
     * @param {uint32[]} st
     * @param {uint32[]} kw
     * @param {int32} rounds
     */
    _permutation128(st, kw, rounds) {
      /** @type {uint32} */
      let s0 = st[0];
      /** @type {uint32} */
      let s1 = st[1];
      /** @type {uint32} */
      let s2 = st[2];
      /** @type {uint32} */
      let s3 = st[3];

      for (; rounds > 0; --rounds) {
        s0 = steps32(s0, s1, s2, s3, kw[0]);
        s1 = steps32(s1, s2, s3, s0, kw[1]);
        s2 = steps32(s2, s3, s0, s1, kw[2]);
        s3 = steps32(s3, s0, s1, s2, kw[3]);
      }

      st[0] = s0;
      st[1] = s1;
      st[2] = s2;
      st[3] = s3;
    }

    /**
     * TinyJAMBU-192 permutation (6-word key schedule with rotation)
     * Key schedule pattern: [0,1,2,3], [4,5,0,1], [2,3,4,5]
     * Each round consists of 128 steps (4 x 32-bit operations)
     * @param {uint32[]} st
     * @param {uint32[]} kw
     * @param {int32} rounds
     */
    _permutation192(st, kw, rounds) {
      /** @type {uint32} */
      let s0 = st[0];
      /** @type {uint32} */
      let s1 = st[1];
      /** @type {uint32} */
      let s2 = st[2];
      /** @type {uint32} */
      let s3 = st[3];

      for (; rounds > 0; --rounds) {
        // First set of 128 steps (key[0,1,2,3])
        s0 = steps32(s0, s1, s2, s3, kw[0]);
        s1 = steps32(s1, s2, s3, s0, kw[1]);
        s2 = steps32(s2, s3, s0, s1, kw[2]);
        s3 = steps32(s3, s0, s1, s2, kw[3]);

        if ((--rounds) === 0) break;

        // Second set of 128 steps (key[4,5,0,1])
        s0 = steps32(s0, s1, s2, s3, kw[4]);
        s1 = steps32(s1, s2, s3, s0, kw[5]);
        s2 = steps32(s2, s3, s0, s1, kw[0]);
        s3 = steps32(s3, s0, s1, s2, kw[1]);

        if ((--rounds) === 0) break;

        // Third set of 128 steps (key[2,3,4,5])
        s0 = steps32(s0, s1, s2, s3, kw[2]);
        s1 = steps32(s1, s2, s3, s0, kw[3]);
        s2 = steps32(s2, s3, s0, s1, kw[4]);
        s3 = steps32(s3, s0, s1, s2, kw[5]);
      }

      st[0] = s0;
      st[1] = s1;
      st[2] = s2;
      st[3] = s3;
    }

    /**
     * TinyJAMBU-256 permutation (8-word key schedule)
     * @param {uint32[]} st
     * @param {uint32[]} kw
     * @param {int32} rounds
     */
    _permutation256(st, kw, rounds) {
      /** @type {uint32} */
      let s0 = st[0];
      /** @type {uint32} */
      let s1 = st[1];
      /** @type {uint32} */
      let s2 = st[2];
      /** @type {uint32} */
      let s3 = st[3];

      for (; rounds > 0; --rounds) {
        // First set of 128 steps (key[0..3])
        s0 = steps32(s0, s1, s2, s3, kw[0]);
        s1 = steps32(s1, s2, s3, s0, kw[1]);
        s2 = steps32(s2, s3, s0, s1, kw[2]);
        s3 = steps32(s3, s0, s1, s2, kw[3]);

        if ((--rounds) === 0) break;

        // Second set of 128 steps (key[4..7])
        s0 = steps32(s0, s1, s2, s3, kw[4]);
        s1 = steps32(s1, s2, s3, s0, kw[5]);
        s2 = steps32(s2, s3, s0, s1, kw[6]);
        s3 = steps32(s3, s0, s1, s2, kw[7]);
      }

      st[0] = s0;
      st[1] = s1;
      st[2] = s2;
      st[3] = s3;
    }

    /**
     * Call the appropriate permutation based on variant
     * @param {uint32[]} st
     * @param {uint32[]} kw
     * @param {int32} rounds
     */
    _permutation(st, kw, rounds) {
      switch (this.keyWords) {
        case 4:
          this._permutation128(st, kw, rounds);
          break;
        case 6:
          this._permutation192(st, kw, rounds);
          break;
        case 8:
          this._permutation256(st, kw, rounds);
          break;
        default:
          throw new Error("Unsupported key size: " + this.keyWords + " words");
      }
    }

    // ===== SETUP AND TAG GENERATION =====

    /**
     * Setup TinyJAMBU state with key, nonce, and associated data
     * @param {uint32[]} st
     * @param {uint32[]} kw
     * @param {uint8[]} nonce
     * @param {uint8[]} ad
     * @param {int32} adlen
     */
    _setup(st, kw, nonce, ad, adlen) {
      // Initialize state to zero
      st[0] = 0;
      st[1] = 0;
      st[2] = 0;
      st[3] = 0;

      // Initial permutation with key
      this._permutation(st, kw, this.initRounds);

      // Absorb the three 32-bit words of the 96-bit nonce
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x10));
      this._permutation(st, kw, 3);
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], OpCodes.Pack32LE(nonce[0], nonce[1], nonce[2], nonce[3])));

      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x10));
      this._permutation(st, kw, 3);
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], OpCodes.Pack32LE(nonce[4], nonce[5], nonce[6], nonce[7])));

      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x10));
      this._permutation(st, kw, 3);
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], OpCodes.Pack32LE(nonce[8], nonce[9], nonce[10], nonce[11])));

      // Process as many full 32-bit words of associated data as we can
      let adPos = 0;
      while (adlen >= 4) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x30));
        this._permutation(st, kw, 3);
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], OpCodes.Pack32LE(ad[adPos], ad[adPos + 1], ad[adPos + 2], ad[adPos + 3])));
        adPos += 4;
        adlen -= 4;
      }

      // Handle the left-over associated data bytes
      if (adlen === 1) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x30));
        this._permutation(st, kw, 3);
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], ad[adPos]));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x01));
      } else if (adlen === 2) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x30));
        this._permutation(st, kw, 3);
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], OpCodes.Pack16LE(ad[adPos], ad[adPos + 1])));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x02));
      } else if (adlen === 3) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x30));
        this._permutation(st, kw, 3);
        const word = OpCodes.Or32(OpCodes.Pack16LE(ad[adPos], ad[adPos + 1]), OpCodes.Shl32(ad[adPos + 2], 16));
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], word));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x03));
      }
    }

    /**
     * Generate authentication tag
     * @param {uint32[]} st
     * @param {uint32[]} kw
     * @returns {uint8[]}
     */
    _generateTag(st, kw) {
      /** @type {uint8[]} */
      const tag = new Array(8);

      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x70));
      this._permutation(st, kw, this.initRounds);
      const tag1 = OpCodes.Unpack32LE(st[2]);
      tag[0] = tag1[0];
      tag[1] = tag1[1];
      tag[2] = tag1[2];
      tag[3] = tag1[3];

      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x70));
      this._permutation(st, kw, 3);
      const tag2 = OpCodes.Unpack32LE(st[2]);
      tag[4] = tag2[0];
      tag[5] = tag2[1];
      tag[6] = tag2[2];
      tag[7] = tag2[3];

      return tag;
    }

    // ===== ENCRYPTION / DECRYPTION =====

    /**
     * @returns {uint8[]}
     */
    _encrypt() {
      /** @type {uint8[]} */
      const plaintext = this.inputBuffer;
      /** @type {uint8[]} */
      const output = [];
      /** @type {uint32[]} */
      const st = [0, 0, 0, 0];

      // Unpack key to 32-bit words (little-endian)
      /** @type {uint32[]} */
      const kw = [];
      for (let i = 0; i < this.keyWords; i++) {
        /** @type {int32} */
        const offset = i * 4;
        kw.push(OpCodes.Pack32LE(this._key[offset], this._key[offset + 1], this._key[offset + 2], this._key[offset + 3]));
      }

      // Setup state with key, nonce, and associated data
      this._setup(st, kw, this._nonce, this._aad, this._aad.length);

      // Encrypt plaintext to produce ciphertext
      let mlen = plaintext.length;
      let mPos = 0;

      while (mlen >= 4) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const inWord = OpCodes.Pack32LE(plaintext[mPos], plaintext[mPos + 1], plaintext[mPos + 2], plaintext[mPos + 3]);
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        const ctWord = OpCodes.ToUint32(OpCodes.Xor32(inWord, st[2]));
        const ctBytes = OpCodes.Unpack32LE(ctWord);
        output.push(ctBytes[0]);
        output.push(ctBytes[1]);
        output.push(ctBytes[2]);
        output.push(ctBytes[3]);
        mPos += 4;
        mlen -= 4;
      }

      if (mlen === 1) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const inWord = plaintext[mPos];
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x01));
        output.push(OpCodes.And32(OpCodes.Xor32(st[2], inWord), 0xFF));
      } else if (mlen === 2) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const inWord = OpCodes.Pack16LE(plaintext[mPos], plaintext[mPos + 1]);
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x02));
        const ctWord = OpCodes.ToUint32(OpCodes.Xor32(inWord, st[2]));
        output.push(OpCodes.And32(ctWord, 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(ctWord, 8), 0xFF));
      } else if (mlen === 3) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const inWord = OpCodes.Or32(OpCodes.Pack16LE(plaintext[mPos], plaintext[mPos + 1]), OpCodes.Shl32(plaintext[mPos + 2], 16));
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x03));
        const ctWord = OpCodes.ToUint32(OpCodes.Xor32(inWord, st[2]));
        output.push(OpCodes.And32(ctWord, 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(ctWord, 8), 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(ctWord, 16), 0xFF));
      }

      // Generate authentication tag
      /** @type {uint8[]} */
      const tag = this._generateTag(st, kw);
      for (let _i = 0; _i < tag.length; _i++) output.push(tag[_i]);

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    /**
     * @returns {uint8[]}
     */
    _decrypt() {
      /** @type {uint8[]} */
      const ciphertext = this.inputBuffer;
      /** @type {uint8[]} */
      const output = [];
      /** @type {uint32[]} */
      const st = [0, 0, 0, 0];

      // Extract tag from end of ciphertext
      const ctLen = ciphertext.length - 8;
      /** @type {uint8[]} */
      const providedTag = ciphertext.slice(ctLen);

      // Unpack key to 32-bit words (little-endian)
      /** @type {uint32[]} */
      const kw = [];
      for (let i = 0; i < this.keyWords; i++) {
        /** @type {int32} */
        const offset = i * 4;
        kw.push(OpCodes.Pack32LE(this._key[offset], this._key[offset + 1], this._key[offset + 2], this._key[offset + 3]));
      }

      // Setup state with key, nonce, and associated data
      this._setup(st, kw, this._nonce, this._aad, this._aad.length);

      // Decrypt ciphertext to produce plaintext
      let clen = ctLen;
      let cPos = 0;

      while (clen >= 4) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const ctWord = OpCodes.Pack32LE(ciphertext[cPos], ciphertext[cPos + 1], ciphertext[cPos + 2], ciphertext[cPos + 3]);
        const inWord = OpCodes.ToUint32(OpCodes.Xor32(ctWord, st[2]));
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        const ptBytes = OpCodes.Unpack32LE(inWord);
        output.push(ptBytes[0]);
        output.push(ptBytes[1]);
        output.push(ptBytes[2]);
        output.push(ptBytes[3]);
        cPos += 4;
        clen -= 4;
      }

      if (clen === 1) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const inWord = OpCodes.ToUint32(OpCodes.And32(OpCodes.Xor32(ciphertext[cPos], st[2]), 0xFF));
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x01));
        output.push(inWord);
      } else if (clen === 2) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const ctWord = OpCodes.Pack16LE(ciphertext[cPos], ciphertext[cPos + 1]);
        const inWord = OpCodes.ToUint32(OpCodes.And32(OpCodes.Xor32(ctWord, st[2]), 0xFFFF));
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x02));
        output.push(OpCodes.And32(inWord, 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(inWord, 8), 0xFF));
      } else if (clen === 3) {
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x50));
        this._permutation(st, kw, this.initRounds);
        const ctWord = OpCodes.Or32(OpCodes.Pack16LE(ciphertext[cPos], ciphertext[cPos + 1]), OpCodes.Shl32(ciphertext[cPos + 2], 16));
        const inWord = OpCodes.ToUint32(OpCodes.And32(OpCodes.Xor32(ctWord, st[2]), 0xFFFFFF));
        st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], inWord));
        st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], 0x03));
        output.push(OpCodes.And32(inWord, 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(inWord, 8), 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(inWord, 16), 0xFF));
      }

      // Generate expected tag
      /** @type {uint8[]} */
      const expectedTag = this._generateTag(st, kw);

      // Verify tag (constant-time comparison)
      if (!OpCodes.ConstantTimeCompare(expectedTag, providedTag)) {
        throw new Error("Authentication tag verification failed");
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

  // Register all three TinyJAMBU variants
  const tinyjambu128 = new TinyJAMBUAlgorithm('128');
  if (!AlgorithmFramework.Find(tinyjambu128.name)) {
    RegisterAlgorithm(tinyjambu128);
  }

  const tinyjambu192 = new TinyJAMBUAlgorithm('192');
  if (!AlgorithmFramework.Find(tinyjambu192.name)) {
    RegisterAlgorithm(tinyjambu192);
  }

  const tinyjambu256 = new TinyJAMBUAlgorithm('256');
  if (!AlgorithmFramework.Find(tinyjambu256.name)) {
    RegisterAlgorithm(tinyjambu256);
  }

  // ===== EXPORTS =====

  return { TinyJAMBUAlgorithm, TinyJAMBUInstance };
}));
