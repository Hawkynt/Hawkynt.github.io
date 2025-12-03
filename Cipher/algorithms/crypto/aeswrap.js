/*
 * AES Key Wrap (RFC 3394) Implementation
 * Production-quality implementation following NIST SP 800-38F standards
 * (c)2006-2025 Hawkynt
 *
 * AES Key Wrap Algorithm Overview:
 * - NIST-approved algorithm for securely wrapping cryptographic keys
 * - Provides both confidentiality and authentication for key material
 * - Uses AES in a specialized mode to wrap keys in multiples of 64 bits
 * - Default Initial Value (IV): 0xA6A6A6A6A6A6A6A6
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/rijndael'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/rijndael')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.Rijndael);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, RijndaelModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CryptoAlgorithm, KeySize, LinkItem, IAlgorithmInstance } = AlgorithmFramework;

  // Default IV for RFC 3394
  const DEFAULT_IV = [0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6];

  // Helper function to get Rijndael algorithm (lazy loading with auto-load)
  function getRijndaelAlgorithm() {
    let rijndael = AlgorithmFramework.Find('Rijndael (AES)');

    // If not found, try to load it
    if (!rijndael) {
      const errors = [];
      try {
        // Attempt to load Rijndael using multiple path strategies
        if (typeof require !== 'undefined') {
          const path = require('path');
          // Try from project root (go up from tests/ if needed)
          let baseDir = path.dirname(require.main.filename);
          // If we're in tests directory, go up one level
          if (baseDir.endsWith('tests')) {
            baseDir = path.dirname(baseDir);
          }
          const rijndaelPath = path.join(baseDir, 'algorithms', 'block', 'rijndael.js');

          // Clear require cache to force re-registration
          delete require.cache[require.resolve(rijndaelPath)];

          require(rijndaelPath);
          rijndael = AlgorithmFramework.Find('Rijndael (AES)');
        }
      } catch (e) {
        errors.push('Strategy 1 failed: ' + e.message);
        // Try relative path as fallback
        try {
          if (typeof require !== 'undefined') {
            const path = require('path');
            const relativePath = '../block/rijndael.js';
            const resolvedPath = path.resolve(__dirname, relativePath);

            // Clear require cache
            if (require.cache[resolvedPath]) {
              delete require.cache[resolvedPath];
            }

            require(relativePath);
            rijndael = AlgorithmFramework.Find('Rijndael (AES)');
          }
        } catch (e2) {
          errors.push('Strategy 2 failed: ' + e2.message);
        }
      }

      if (!rijndael) {
        throw new Error('Rijndael (AES) algorithm not found. Errors: ' + errors.join('; '));
      }
    }
    return rijndael;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class AesKeyWrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "AES Key Wrap";
      this.description = "NIST-approved key wrapping algorithm (RFC 3394) that securely encrypts cryptographic keys using AES. Provides both confidentiality and integrity protection for key material.";
      this.inventor = "NIST";
      this.year = 2001;
      this.country = CountryCode.US;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8)  // 128, 192, 256-bit AES keys
      ];

      this.documentation = [
        new LinkItem("RFC 3394 - Advanced Encryption Standard (AES) Key Wrap Algorithm", "https://www.ietf.org/rfc/rfc3394.txt"),
        new LinkItem("NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping", "https://csrc.nist.gov/publications/detail/sp/800-38f/final"),
        new LinkItem("NIST Key Wrap Specification (Original)", "https://csrc.nist.gov/encryption/kms/key-wrap.pdf")
      ];

      this.references = [
        new LinkItem("BouncyCastle RFC3394WrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC3394WrapEngine.java"),
        new LinkItem("Botan NIST Key Wrap Implementation", "https://github.com/randombit/botan/blob/master/src/lib/misc/nist_keywrap/nist_keywrap.cpp")
      ];

      // Test vectors from RFC 3394 Appendix B and Botan test suite
      this.tests = [
        {
          text: "RFC 3394 - 128-bit KEK, 128-bit Key Data",
          uri: "https://www.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("1FA68B0A8112B447AEF34BD8FB5A7B829D3E862371D2CFE5")
        },
        {
          text: "RFC 3394 - 192-bit KEK, 128-bit Key Data",
          uri: "https://www.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("96778B25AE6CA435F92B5B97C050AED2468AB8A17AD84E5D")
        },
        {
          text: "RFC 3394 - 256-bit KEK, 128-bit Key Data",
          uri: "https://www.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("64E8C3F9CE0F5BA263E9777905818A2A93C8191E7D6E8AE7")
        },
        {
          text: "RFC 3394 - 192-bit KEK, 192-bit Key Data",
          uri: "https://www.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("031D33264E15D33268F24EC260743EDCE1C6C7DDEE725A936BA814915C6762D2")
        },
        {
          text: "RFC 3394 - 256-bit KEK, 192-bit Key Data",
          uri: "https://www.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("A8F9BC1612C68B3FF6E6F4FBE30E71E4769C8B80A32CB8958CD5D17D6B254DA1")
        },
        {
          text: "RFC 3394 - 256-bit KEK, 256-bit Key Data",
          uri: "https://www.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AesKeyWrapInstance(this, isInverse);
    }
  }

  /**
 * AesKeyWrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AesKeyWrapInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = [...DEFAULT_IV];
      this.aesInstance = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.aesInstance = null;
        return;
      }

      // Validate key size (must be 128, 192, or 256 bits)
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize &&
        keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (must be 16, 24, or 32)');
      }

      this._key = [...keyBytes];
      // Don't initialize AES instance here - do it lazily when needed
      this.aesInstance = null;
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
        this._iv = [...DEFAULT_IV];
        return;
      }

      if (ivBytes.length !== 8) {
        throw new Error('Invalid IV size: ' + ivBytes.length + ' bytes (must be 8)');
      }

      this._iv = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return [...this._iv];
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
      if (!this._key) {
        throw new Error('Key not set');
      }

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      const result = this.isInverse ? this._unwrap() : this._wrap();
      this.inputBuffer = [];
      return result;
    }

    _wrap() {
      const plaintext = this.inputBuffer;

      // Validate input length (must be multiple of 8 bytes, minimum 8 bytes)
      if (plaintext.length < 8) {
        throw new Error('Wrap data must be at least 8 bytes');
      }

      if (plaintext.length % 8 !== 0) {
        throw new Error('Wrap data must be a multiple of 8 bytes');
      }

      const n = plaintext.length / 8;

      // Initialize AES instance if not already done
      if (!this.aesInstance) {
        const RijndaelAlgorithm = getRijndaelAlgorithm();
        this.aesInstance = RijndaelAlgorithm.CreateInstance(false);
        this.aesInstance.key = this._key;
      }

      // Special case: single 64-bit block (n=1)
      if (n === 1) {
        // Just encrypt [IV | plaintext] as a single AES block
        const block = [...this._iv, ...plaintext];
        this.aesInstance.Feed(block);
        return this.aesInstance.Result();
      }

      // General case: n >= 2
      // Initialize variables
      let A = [...this._iv];  // 64-bit register A
      const R = [];           // Array of n 64-bit registers

      // Copy input into R[1]...R[n]
      for (let i = 0; i < n; ++i) {
        R[i] = plaintext.slice(i * 8, (i + 1) * 8);
      }

      // Perform wrapping operation
      for (let j = 0; j <= 5; ++j) {
        for (let i = 0; i < n; ++i) {
          // B = AES(K, A | R[i])
          const block = [...A, ...R[i]];
          this.aesInstance.Feed(block);
          const B = this.aesInstance.Result();

          // A = MSB(64, B) XOR t (where t = n*j + i + 1)
          A = B.slice(0, 8);
          const t = n * j + i + 1;

          // XOR the counter t into the last 4 bytes of A (big-endian)
          for (let k = 1; t !== 0 && k <= 4; ++k) {
            A[8 - k] = OpCodes.XorN(A[8 - k], OpCodes.AndN(OpCodes.Shr32(t, (k - 1) * 8), 0xFF));
          }

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Output is A | R[0] | R[1] | ... | R[n-1]
      const output = [...A];
      for (let i = 0; i < n; ++i) {
        output.push(...R[i]);
      }

      return output;
    }

    _unwrap() {
      const ciphertext = this.inputBuffer;

      // Validate input length (must be at least 16 bytes, multiple of 8)
      if (ciphertext.length < 16) {
        throw new Error('Unwrap data must be at least 16 bytes');
      }

      if (ciphertext.length % 8 !== 0) {
        throw new Error('Unwrap data must be a multiple of 8 bytes');
      }

      const n = (ciphertext.length / 8) - 1;

      // Get Rijndael algorithm
      const RijndaelAlgorithm = getRijndaelAlgorithm();

      // Special case: single 64-bit block (n=1)
      if (n === 1) {
        // Just decrypt the ciphertext as a single AES block
        const aesDecrypt = RijndaelAlgorithm.CreateInstance(true);
        aesDecrypt.key = this._key;
        aesDecrypt.Feed(ciphertext);
        const block = aesDecrypt.Result();

        // Check IV
        const receivedIV = block.slice(0, 8);
        if (!OpCodes.ConstantTimeCompare(receivedIV, this._iv)) {
          throw new Error('Integrity check failed: IV mismatch');
        }

        return block.slice(8, 16);
      }

      // General case: n >= 2
      // Initialize variables
      let A = ciphertext.slice(0, 8);  // First 64 bits
      const R = [];                     // Array of n 64-bit registers

      // Copy ciphertext into R[0]...R[n-1]
      for (let i = 0; i < n; ++i) {
        R[i] = ciphertext.slice((i + 1) * 8, (i + 2) * 8);
      }

      // Perform unwrapping operation
      const aesDecrypt = RijndaelAlgorithm.CreateInstance(true);
      aesDecrypt.key = this._key;

      for (let j = 5; j >= 0; --j) {
        for (let i = n - 1; i >= 0; --i) {
          // Calculate t = n*j + i + 1
          const t = n * j + i + 1;

          // XOR t into A (reverse the operation from wrapping)
          const A_copy = [...A];
          for (let k = 1; t !== 0 && k <= 4; ++k) {
            A_copy[8 - k] = OpCodes.XorN(A_copy[8 - k], OpCodes.AndN(OpCodes.Shr32(t, (k - 1) * 8), 0xFF));
          }

          // B = AES_Decrypt(K, (A XOR t) | R[i])
          const block = [...A_copy, ...R[i]];
          aesDecrypt.Feed(block);
          const B = aesDecrypt.Result();

          // A = MSB(64, B)
          A = B.slice(0, 8);

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Check IV integrity
      if (!OpCodes.ConstantTimeCompare(A, this._iv)) {
        throw new Error('Integrity check failed: IV mismatch');
      }

      // Output is R[0] | R[1] | ... | R[n-1]
      const output = [];
      for (let i = 0; i < n; ++i) {
        output.push(...R[i]);
      }

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new AesKeyWrapAlgorithm());

  return AesKeyWrapAlgorithm;
}));
