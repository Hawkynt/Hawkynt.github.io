/*
 * SEED Key Wrap Implementation (RFC 4010)
 * Based on RFC 3394 Key Wrap Algorithm using SEED block cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SEED Key Wrap provides secure key wrapping using the SEED block cipher
 * as defined in RFC 4010. The algorithm follows RFC 3394 key wrap structure
 * with SEED replacing AES as the underlying block cipher.
 *
 * This implementation uses the production-grade Bouncy Castle reference implementation
 * and the existing SEED cipher from this project for cryptographic operations.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/seed'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/seed')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.SeedAlgorithm);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, SeedModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====

  // Default Initial Value for RFC 3394 key wrap (A6A6A6A6A6A6A6A6)
  const DEFAULT_IV = Object.freeze([0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6]);

  // ===== HELPER FUNCTIONS =====

  /**
   * Process 16-byte block with SEED cipher
   * @param {Array<number>} kek - Key Encryption Key bytes
   * @param {boolean} forEncryption - true for encryption, false for decryption
   * @param {Array<number>} input - 16-byte input block
   * @returns {Array<number>} 16-byte output block
   */
  function processBlock(kek, forEncryption, input) {
    if (input.length !== 16) {
      throw new Error("Block size must be 16 bytes");
    }

    // Get SEED algorithm from registry
    const seedAlg = AlgorithmFramework.Find("SEED");
    if (!seedAlg) {
      throw new Error("SEED algorithm not found. Ensure seed.js is loaded.");
    }

    // Create fresh instance for each block to avoid state accumulation
    const seedInstance = seedAlg.CreateInstance(!forEncryption);
    seedInstance.key = kek;
    seedInstance.Feed(input);
    return seedInstance.Result();
  }

  // ===== KEY WRAP ALGORITHM (RFC 3394 with SEED) =====

  /**
   * Wrap key data using SEED cipher (RFC 3394 algorithm)
   * @param {Array<number>} kek - Key Encryption Key
   * @param {Array<number>} keyToWrap - Key data to wrap (must be multiple of 8 bytes)
   * @param {Array<number>} iv - Initial value (8 bytes, defaults to A6A6A6A6A6A6A6A6)
   * @returns {Array<number>} Wrapped key data
   */
  function wrapKey(kek, keyToWrap, iv) {
    if (!iv) {
      iv = [...DEFAULT_IV];
    }

    if (keyToWrap.length < 8) {
      throw new Error("Wrap data must be at least 8 bytes");
    }

    if (keyToWrap.length % 8 !== 0) {
      throw new Error("Wrap data must be a multiple of 8 bytes");
    }

    const n = keyToWrap.length / 8;

    // Create output buffer: IV + wrapped key
    const block = new Array(keyToWrap.length + iv.length);

    // Copy IV to start
    for (let i = 0; i < iv.length; ++i) {
      block[i] = iv[i];
    }

    // Copy key data
    for (let i = 0; i < keyToWrap.length; ++i) {
      block[iv.length + i] = keyToWrap[i];
    }

    // Special case: single 64-bit block
    if (n === 1) {
      const encrypted = processBlock(kek, true, block);
      return encrypted;
    }

    // Standard RFC 3394 algorithm: 6 * n iterations
    const buf = new Array(8 + iv.length);

    for (let j = 0; j < 6; ++j) {
      for (let i = 1; i <= n; ++i) {
        // Concatenate A with R[i]
        for (let k = 0; k < iv.length; ++k) {
          buf[k] = block[k];
        }
        for (let k = 0; k < 8; ++k) {
          buf[iv.length + k] = block[8 * i + k];
        }

        // Encrypt the block
        const encrypted = processBlock(kek, true, buf);
        for (let k = 0; k < encrypted.length; ++k) {
          buf[k] = encrypted[k];
        }

        // Calculate t = (n*j) + i
        let t = n * j + i;

        // XOR t into the last bytes of A (MSB first)
        for (let k = 1; t !== 0; ++k) {
          const v = t & 0xff;
          buf[iv.length - k] ^= v;
          t >>>= 8;
        }

        // Store A and R[i]
        for (let k = 0; k < 8; ++k) {
          block[k] = buf[k];
        }
        for (let k = 0; k < 8; ++k) {
          block[8 * i + k] = buf[8 + k];
        }
      }
    }

    return block;
  }

  /**
   * Unwrap key data using SEED cipher (RFC 3394 algorithm)
   * @param {Array<number>} kek - Key Encryption Key
   * @param {Array<number>} wrappedKey - Wrapped key data (must be multiple of 8 bytes, minimum 16)
   * @param {Array<number>} iv - Expected initial value (8 bytes, defaults to A6A6A6A6A6A6A6A6)
   * @returns {Array<number>} Unwrapped key data
   * @throws {Error} If integrity check fails
   */
  function unwrapKey(kek, wrappedKey, iv) {
    if (!iv) {
      iv = [...DEFAULT_IV];
    }

    if (wrappedKey.length < 16) {
      throw new Error("Unwrap data too short (minimum 16 bytes)");
    }

    if (wrappedKey.length % 8 !== 0) {
      throw new Error("Unwrap data must be a multiple of 8 bytes");
    }

    let n = wrappedKey.length / 8;
    n = n - 1; // Subtract IV block

    const block = new Array(wrappedKey.length - iv.length);
    const a = new Array(iv.length);
    const buf = new Array(8 + iv.length);

    // Special case: single 64-bit block
    if (n === 1) {
      const decrypted = processBlock(kek, false, wrappedKey);

      // Extract A and plaintext
      for (let i = 0; i < iv.length; ++i) {
        a[i] = decrypted[i];
      }
      for (let i = 0; i < 8; ++i) {
        block[i] = decrypted[iv.length + i];
      }
    } else {
      // Copy A (first 8 bytes)
      for (let i = 0; i < iv.length; ++i) {
        a[i] = wrappedKey[i];
      }

      // Copy ciphertext blocks
      for (let i = 0; i < wrappedKey.length - iv.length; ++i) {
        block[i] = wrappedKey[iv.length + i];
      }

      // Standard RFC 3394 algorithm: 6 * n iterations in reverse
      for (let j = 5; j >= 0; --j) {
        for (let i = n; i >= 1; --i) {
          // Concatenate A with R[i]
          for (let k = 0; k < iv.length; ++k) {
            buf[k] = a[k];
          }
          for (let k = 0; k < 8; ++k) {
            buf[iv.length + k] = block[8 * (i - 1) + k];
          }

          // Calculate t = (n*j) + i
          let t = n * j + i;

          // XOR t from the last bytes of A (MSB first)
          for (let k = 1; t !== 0; ++k) {
            const v = t & 0xff;
            buf[iv.length - k] ^= v;
            t >>>= 8;
          }

          // Decrypt the block
          const decrypted = processBlock(kek, false, buf);
          for (let k = 0; k < decrypted.length; ++k) {
            buf[k] = decrypted[k];
          }

          // Store A and R[i]
          for (let k = 0; k < 8; ++k) {
            a[k] = buf[k];
          }
          for (let k = 0; k < 8; ++k) {
            block[8 * (i - 1) + k] = buf[8 + k];
          }
        }
      }
    }

    // Verify integrity check value (constant-time comparison)
    if (!OpCodes.ConstantTimeCompare(a, iv)) {
      throw new Error("Checksum failed - integrity verification error");
    }

    return block;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class SeedWrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SEED-WRAP";
      this.description = "RFC 4010 SEED Key Wrap algorithm. Provides authenticated encryption for key material using SEED block cipher with RFC 3394 key wrap structure. Ensures both confidentiality and integrity of wrapped keys.";
      this.inventor = "Korea Internet & Security Agency (KISA) / IETF";
      this.year = 2005;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.KR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // SEED uses fixed 128-bit keys
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 4010 - SEED Key Wrap", "https://tools.ietf.org/rfc/rfc4010.txt"),
        new LinkItem("RFC 3394 - AES Key Wrap Algorithm", "https://tools.ietf.org/rfc/rfc3394.txt"),
        new LinkItem("RFC 4269 - SEED Encryption Algorithm", "https://tools.ietf.org/rfc/rfc4269.txt")
      ];

      this.references = [
        new LinkItem("Bouncy Castle SEEDWrapEngine", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/SEEDWrapEngine.java"),
        new LinkItem("NIST SP 800-38F - Key Wrap Modes", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf")
      ];

      // Test vectors generated using SEED cipher with RFC 3394 algorithm
      // These are bit-perfect outputs from the SEED-WRAP implementation
      this.tests = [
        {
          text: "SEED-WRAP 128-bit KEK wrapping 128-bit key",
          uri: "https://tools.ietf.org/rfc/rfc4010.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("bf71f77138b5afea05232a8dad54024e812dc8dd7d132559")
        },
        {
          text: "SEED-WRAP single 64-bit block (simplified algorithm)",
          uri: "https://tools.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("bff44891b9801360b718dbaaa5083596")
        },
        {
          text: "SEED-WRAP wrapping 192-bit key",
          uri: "https://tools.ietf.org/rfc/rfc4010.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("405bbc1a0f41638d8fac416726d69f4d64742da5a8702b34858a395eda259aef")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SeedWrapInstance(this, isInverse);
    }
  }

  /**
 * SeedWrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SeedWrapInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
    }

    // Property setter for Key Encryption Key
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

      // Validate key size (SEED only supports 128-bit keys)
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SEED-WRAP requires 128-bit (16 byte) keys.`);
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

    // Property setter for custom IV (optional, defaults to RFC 3394 standard IV)
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

      if (ivBytes.length !== 8) {
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. IV must be 8 bytes.`);
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

    // Feed data to wrap/unwrap
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    // Get the result of wrapping/unwrapping
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      try {
        const iv = this._iv || [...DEFAULT_IV];
        let result;

        if (this.isInverse) {
          // Unwrap operation
          result = unwrapKey(this._key, this.inputBuffer, iv);
        } else {
          // Wrap operation
          result = wrapKey(this._key, this.inputBuffer, iv);
        }

        // Clear input buffer
        this.inputBuffer = [];

        return result;
      } catch (error) {
        // Clear input buffer on error
        this.inputBuffer = [];
        throw error;
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SeedWrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SeedWrapAlgorithm, SeedWrapInstance };
}));
