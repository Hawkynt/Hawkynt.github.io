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
   * @param {number} s0 - State word 0
   * @param {number} s1 - State word 1
   * @param {number} s2 - State word 2
   * @param {number} s3 - State word 3
   * @param {number} kword - Key word
   * @returns {number} New state word value
   */
  function steps32(s0, s1, s2, s3, kword) {
    // Compute feedback taps using bitwise shift operations
    // Note: These combine two words via shifts, NOT rotations of a single word
    const t1 = OpCodes.OrN(OpCodes.Shr32(s1, 15), OpCodes.Shl32(s2, 17));
    const t2 = OpCodes.OrN(OpCodes.Shr32(s2, 6), OpCodes.Shl32(s3, 26));
    const t3 = OpCodes.OrN(OpCodes.Shr32(s2, 21), OpCodes.Shl32(s3, 11));
    const t4 = OpCodes.OrN(OpCodes.Shr32(s2, 27), OpCodes.Shl32(s3, 5));

    // Nonlinear feedback: XOR(t1, NAND(t2,t3), t4, key)
    // NAND(t2,t3) = NOT(AND(t2,t3)) = XOR(AND(t2,t3), 0xFFFFFFFF)
    return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, t1), OpCodes.Xor32(OpCodes.AndN(t2, t3), 0xFFFFFFFF)), t4), kword));
  }

  // ===== ALGORITHM CLASS =====

  /**
   * TinyJAMBU AEAD Algorithm (supports 128, 192, 256-bit variants)
   */
  class TinyJAMBUAlgorithm extends AeadAlgorithm {
    constructor(variant = '128') {
      super();

      const config = this._getVariantConfig(variant);

      // Store variant-specific parameters
      this.variant = variant;
      this.keySize = config.keySize;
      this.keyWords = config.keyWords;
      this.initRounds = config.initRounds;
      this.permutation = config.permutation;

      // Required metadata
      this.name = `TinyJAMBU-${variant} AEAD`;
      this.description = config.description;
      this.inventor = "Hongjun Wu, Tao Huang";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = config.country;

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
        new LinkItem(
          "Reference Implementation (C)",
          "https://github.com/rweather/lwc-finalists"
        )
      ];

      this.tests = config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        '128': {
          description: "Lightweight authenticated encryption finalist in NIST LWC. Features 128-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.",
          keySize: 16,
          keyWords: 4,
          initRounds: 8,
          country: CountryCode.CN,
          tests: [
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
          ]
        },
        '192': {
          description: "Lightweight authenticated encryption finalist in NIST LWC. Features 192-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.",
          keySize: 24,
          keyWords: 6,
          initRounds: 9,
          country: CountryCode.INTL,
          tests: [
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
          ]
        },
        '256': {
          description: "Lightweight authenticated encryption finalist in NIST LWC. Features 256-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.",
          keySize: 32,
          keyWords: 8,
          initRounds: 10,
          country: CountryCode.INTL,
          tests: [
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
          ]
        }
      };

      if (!configs[variant]) {
        throw new Error(`Unsupported TinyJAMBU variant: ${variant}`);
      }

      return configs[variant];
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];

      // Store variant-specific parameters
      this.keySize = algorithm.keySize;
      this.keyWords = algorithm.keyWords;
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${this.keySize})`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 12) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 12)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
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
     */
    _permutation128(state, key, rounds) {
      let s0 = state[0];
      let s1 = state[1];
      let s2 = state[2];
      let s3 = state[3];

      for (; rounds > 0; --rounds) {
        s0 = steps32(s0, s1, s2, s3, key[0]);
        s1 = steps32(s1, s2, s3, s0, key[1]);
        s2 = steps32(s2, s3, s0, s1, key[2]);
        s3 = steps32(s3, s0, s1, s2, key[3]);
      }

      state[0] = s0;
      state[1] = s1;
      state[2] = s2;
      state[3] = s3;
    }

    /**
     * TinyJAMBU-192 permutation (6-word key schedule with rotation)
     * Key schedule pattern: [0,1,2,3], [4,5,0,1], [2,3,4,5]
     * Each round consists of 128 steps (4 x 32-bit operations)
     */
    _permutation192(state, key, rounds) {
      let s0 = state[0];
      let s1 = state[1];
      let s2 = state[2];
      let s3 = state[3];

      for (; rounds > 0; --rounds) {
        // First set of 128 steps (key[0,1,2,3])
        s0 = steps32(s0, s1, s2, s3, key[0]);
        s1 = steps32(s1, s2, s3, s0, key[1]);
        s2 = steps32(s2, s3, s0, s1, key[2]);
        s3 = steps32(s3, s0, s1, s2, key[3]);

        if ((--rounds) === 0) break;

        // Second set of 128 steps (key[4,5,0,1])
        s0 = steps32(s0, s1, s2, s3, key[4]);
        s1 = steps32(s1, s2, s3, s0, key[5]);
        s2 = steps32(s2, s3, s0, s1, key[0]);
        s3 = steps32(s3, s0, s1, s2, key[1]);

        if ((--rounds) === 0) break;

        // Third set of 128 steps (key[2,3,4,5])
        s0 = steps32(s0, s1, s2, s3, key[2]);
        s1 = steps32(s1, s2, s3, s0, key[3]);
        s2 = steps32(s2, s3, s0, s1, key[4]);
        s3 = steps32(s3, s0, s1, s2, key[5]);
      }

      state[0] = s0;
      state[1] = s1;
      state[2] = s2;
      state[3] = s3;
    }

    /**
     * TinyJAMBU-256 permutation (8-word key schedule)
     */
    _permutation256(state, key, rounds) {
      let s0 = state[0];
      let s1 = state[1];
      let s2 = state[2];
      let s3 = state[3];

      for (; rounds > 0; --rounds) {
        // First set of 128 steps (key[0..3])
        s0 = steps32(s0, s1, s2, s3, key[0]);
        s1 = steps32(s1, s2, s3, s0, key[1]);
        s2 = steps32(s2, s3, s0, s1, key[2]);
        s3 = steps32(s3, s0, s1, s2, key[3]);

        if ((--rounds) === 0) break;

        // Second set of 128 steps (key[4..7])
        s0 = steps32(s0, s1, s2, s3, key[4]);
        s1 = steps32(s1, s2, s3, s0, key[5]);
        s2 = steps32(s2, s3, s0, s1, key[6]);
        s3 = steps32(s3, s0, s1, s2, key[7]);
      }

      state[0] = s0;
      state[1] = s1;
      state[2] = s2;
      state[3] = s3;
    }

    /**
     * Call the appropriate permutation based on variant
     */
    _permutation(state, key, rounds) {
      switch (this.keyWords) {
        case 4:
          this._permutation128(state, key, rounds);
          break;
        case 6:
          this._permutation192(state, key, rounds);
          break;
        case 8:
          this._permutation256(state, key, rounds);
          break;
        default:
          throw new Error(`Unsupported key size: ${this.keyWords} words`);
      }
    }

    // ===== SETUP AND TAG GENERATION =====

    /**
     * Setup TinyJAMBU state with key, nonce, and associated data
     */
    _setup(state, key, nonce, ad, adlen) {
      // Initialize state to zero
      state[0] = 0;
      state[1] = 0;
      state[2] = 0;
      state[3] = 0;

      // Initial permutation with key
      this._permutation(state, key, this.initRounds);

      // Absorb the three 32-bit words of the 96-bit nonce
      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x10));
      this._permutation(state, key, 3);
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], OpCodes.Pack32LE(nonce[0], nonce[1], nonce[2], nonce[3])));

      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x10));
      this._permutation(state, key, 3);
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], OpCodes.Pack32LE(nonce[4], nonce[5], nonce[6], nonce[7])));

      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x10));
      this._permutation(state, key, 3);
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], OpCodes.Pack32LE(nonce[8], nonce[9], nonce[10], nonce[11])));

      // Process as many full 32-bit words of associated data as we can
      let adPos = 0;
      while (adlen >= 4) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x30));
        this._permutation(state, key, 3);
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], OpCodes.Pack32LE(ad[adPos], ad[adPos + 1], ad[adPos + 2], ad[adPos + 3])));
        adPos += 4;
        adlen -= 4;
      }

      // Handle the left-over associated data bytes
      if (adlen === 1) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x30));
        this._permutation(state, key, 3);
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], ad[adPos]));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x01));
      } else if (adlen === 2) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x30));
        this._permutation(state, key, 3);
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], OpCodes.Pack16LE(ad[adPos], ad[adPos + 1])));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x02));
      } else if (adlen === 3) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x30));
        this._permutation(state, key, 3);
        const word = OpCodes.OrN(OpCodes.Pack16LE(ad[adPos], ad[adPos + 1]), OpCodes.Shl32(ad[adPos + 2], 16));
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], word));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x03));
      }
    }

    /**
     * Generate authentication tag
     */
    _generateTag(state, key) {
      const tag = new Array(8);

      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x70));
      this._permutation(state, key, this.initRounds);
      const tag1 = OpCodes.Unpack32LE(state[2]);
      tag[0] = tag1[0];
      tag[1] = tag1[1];
      tag[2] = tag1[2];
      tag[3] = tag1[3];

      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x70));
      this._permutation(state, key, 3);
      const tag2 = OpCodes.Unpack32LE(state[2]);
      tag[4] = tag2[0];
      tag[5] = tag2[1];
      tag[6] = tag2[2];
      tag[7] = tag2[3];

      return tag;
    }

    // ===== ENCRYPTION / DECRYPTION =====

    _encrypt() {
      const plaintext = this.inputBuffer;
      const output = [];
      const state = [0, 0, 0, 0];

      // Unpack key to 32-bit words (little-endian)
      const key = [];
      for (let i = 0; i < this.keyWords; i++) {
        const offset = i * 4;
        key.push(OpCodes.Pack32LE(this._key[offset], this._key[offset + 1], this._key[offset + 2], this._key[offset + 3]));
      }

      // Setup state with key, nonce, and associated data
      this._setup(state, key, this._nonce, this._aad, this._aad.length);

      // Encrypt plaintext to produce ciphertext
      let mlen = plaintext.length;
      let mPos = 0;

      while (mlen >= 4) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const data = OpCodes.Pack32LE(plaintext[mPos], plaintext[mPos + 1], plaintext[mPos + 2], plaintext[mPos + 3]);
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        const ctWord = OpCodes.ToUint32(OpCodes.XorN(data, state[2]));
        const ctBytes = OpCodes.Unpack32LE(ctWord);
        output.push(ctBytes[0], ctBytes[1], ctBytes[2], ctBytes[3]);
        mPos += 4;
        mlen -= 4;
      }

      if (mlen === 1) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const data = plaintext[mPos];
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x01));
        output.push(OpCodes.AndN(OpCodes.XorN(state[2], data), 0xFF));
      } else if (mlen === 2) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const data = OpCodes.Pack16LE(plaintext[mPos], plaintext[mPos + 1]);
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x02));
        const ctWord = OpCodes.ToUint32(OpCodes.XorN(data, state[2]));
        output.push(OpCodes.AndN(ctWord, 0xFF), OpCodes.AndN(OpCodes.Shr32(ctWord, 8), 0xFF));
      } else if (mlen === 3) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const data = OpCodes.OrN(OpCodes.Pack16LE(plaintext[mPos], plaintext[mPos + 1]), OpCodes.Shl32(plaintext[mPos + 2], 16));
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x03));
        const ctWord = OpCodes.ToUint32(OpCodes.XorN(data, state[2]));
        output.push(OpCodes.AndN(ctWord, 0xFF), OpCodes.AndN(OpCodes.Shr32(ctWord, 8), 0xFF), OpCodes.AndN(OpCodes.Shr32(ctWord, 16), 0xFF));
      }

      // Generate authentication tag
      const tag = this._generateTag(state, key);
      output.push(...tag);

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _decrypt() {
      const ciphertext = this.inputBuffer;
      const output = [];
      const state = [0, 0, 0, 0];

      // Extract tag from end of ciphertext
      const ctLen = ciphertext.length - 8;
      const providedTag = ciphertext.slice(ctLen);

      // Unpack key to 32-bit words (little-endian)
      const key = [];
      for (let i = 0; i < this.keyWords; i++) {
        const offset = i * 4;
        key.push(OpCodes.Pack32LE(this._key[offset], this._key[offset + 1], this._key[offset + 2], this._key[offset + 3]));
      }

      // Setup state with key, nonce, and associated data
      this._setup(state, key, this._nonce, this._aad, this._aad.length);

      // Decrypt ciphertext to produce plaintext
      let clen = ctLen;
      let cPos = 0;

      while (clen >= 4) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const ctWord = OpCodes.Pack32LE(ciphertext[cPos], ciphertext[cPos + 1], ciphertext[cPos + 2], ciphertext[cPos + 3]);
        const data = OpCodes.ToUint32(OpCodes.XorN(ctWord, state[2]));
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        const ptBytes = OpCodes.Unpack32LE(data);
        output.push(ptBytes[0], ptBytes[1], ptBytes[2], ptBytes[3]);
        cPos += 4;
        clen -= 4;
      }

      if (clen === 1) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const data = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(ciphertext[cPos], state[2]), 0xFF));
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x01));
        output.push(data);
      } else if (clen === 2) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const ctWord = OpCodes.Pack16LE(ciphertext[cPos], ciphertext[cPos + 1]);
        const data = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(ctWord, state[2]), 0xFFFF));
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x02));
        output.push(OpCodes.AndN(data, 0xFF), OpCodes.AndN(OpCodes.Shr32(data, 8), 0xFF));
      } else if (clen === 3) {
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x50));
        this._permutation(state, key, this.initRounds);
        const ctWord = OpCodes.OrN(OpCodes.Pack16LE(ciphertext[cPos], ciphertext[cPos + 1]), OpCodes.Shl32(ciphertext[cPos + 2], 16));
        const data = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(ctWord, state[2]), 0xFFFFFF));
        state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], data));
        state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], 0x03));
        output.push(OpCodes.AndN(data, 0xFF), OpCodes.AndN(OpCodes.Shr32(data, 8), 0xFF), OpCodes.AndN(OpCodes.Shr32(data, 16), 0xFF));
      }

      // Generate expected tag
      const expectedTag = this._generateTag(state, key);

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
