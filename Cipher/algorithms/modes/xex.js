/*
 * XEX (XOR-Encrypt-XOR) Mode of Operation
 * Tweakable block cipher mode that forms the basis of XTS
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
    root.XEX = factory(root.AlgorithmFramework, root.OpCodes);
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

  class XexAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "XEX";
      this.description = "XEX (XOR-Encrypt-XOR) is a tweakable block cipher construction that forms the foundation of the XTS disk encryption mode. It uses a simple but effective approach: XOR the plaintext with a tweak-derived mask, encrypt with a standard block cipher, then XOR again with the same mask. This provides strong tweakable encryption suitable for disk encryption.";
      this.inventor = "Phillip Rogaway";
      this.year = 2004;
      this.category = CategoryType.MODE;
      this.subCategory = "Tweakable Block Cipher";
      this.securityStatus = SecurityStatus.SECURE; // Foundation of standardized XTS
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for XEX

      this.documentation = [
        new LinkItem("XEX Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/offsets.pdf"),
        new LinkItem("IEEE 1619-2007 XTS", "https://standards.ieee.org/ieee/1619/3618/"),
        new LinkItem("NIST SP 800-38E", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf")
      ];

      this.references = [
        new LinkItem("XTS Implementation (XEX successor)", "https://github.com/freebsd/freebsd-src/blob/main/sys/opencrypto/xts.c"),
        new LinkItem("Linux dm-crypt", "https://gitlab.com/cryptsetup/cryptsetup/-/blob/main/lib/crypto_backend/crypto_kernel.c"),
        new LinkItem("OpenSSL XTS", "https://github.com/openssl/openssl/blob/master/crypto/modes/xts128.c")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Superseded by XTS", "XEX is now primarily used as the foundation for XTS mode rather than directly. XTS provides additional security improvements."),
        new Vulnerability("Single-Key Weakness", "Pure XEX with a single key has some theoretical weaknesses that XTS addresses by using two independent keys.")
      ];

      // Round-trip test vectors for XEX mode
      this.tests = [
        {
          text: "XEX round-trip test - single block",
          uri: "https://web.cs.ucdavis.edu/~rogaway/papers/offsets.pdf",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweakKey: OpCodes.Hex8ToBytes("603deb1015ca71be2b73aef0857d7781"),
          tweak: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XexModeInstance(this, isInverse);
    }
  }

  /**
 * XexMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XexModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.key = null; // Block cipher key
      this.tweakKey = null; // XEX tweak key
      this.tweak = null; // Tweak value
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      if (cipher.BlockSize !== 16) {
        throw new Error("XEX mode requires 128-bit block cipher (typically AES)");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the block cipher encryption key
     * @param {Array} key - Block cipher key
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Block cipher key cannot be empty");
      }
      this.key = [...key];
    }

    /**
     * Set the XEX tweak key for mask generation
     * @param {Array} tweakKey - 128-bit tweak key for generating masks
     */
    setTweakKey(tweakKey) {
      if (!tweakKey || tweakKey.length !== 16) {
        throw new Error("XEX tweak key must be exactly 128 bits (16 bytes)");
      }
      this.tweakKey = [...tweakKey];
    }

    /**
     * Set the tweak value
     * @param {Array} tweak - Tweak value for this encryption
     */
    setTweak(tweak) {
      if (!tweak || tweak.length !== 16) {
        throw new Error("XEX tweak must be exactly 128 bits (16 bytes)");
      }
      this.tweak = [...tweak];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key || !this.tweakKey) {
        throw new Error("Both block cipher key and tweak key must be set for XEX mode.");
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key || !this.tweakKey) {
        throw new Error("Both block cipher key and tweak key must be set for XEX mode.");
      }
      if (!this.tweak) {
        throw new Error("Tweak not set. Call setTweak() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes for XEX mode`);
      }

      const output = [];

      // XEX construction: C = E_K(P ⊕ Δ) ⊕ Δ
      // Where Δ = E_K2(tweak) for each block

      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);

        // Generate the mask Δ for this block
        const mask = this._generateMask(i / blockSize);

        if (this.isInverse) {
          // XEX Decryption: P = D_K(C ⊕ Δ) ⊕ Δ

          // Step 1: XOR ciphertext with mask
          const xorInput = OpCodes.XorArrays(block, mask);

          // Step 2: Decrypt with block cipher
          const decryptCipher = this.blockCipher.algorithm.CreateInstance(true);
          decryptCipher.key = this.key;
          decryptCipher.Feed(xorInput);
          const decrypted = decryptCipher.Result();

          // Step 3: XOR with mask again
          const plainBlock = OpCodes.XorArrays(decrypted, mask);
          output.push(...plainBlock);

        } else {
          // XEX Encryption: C = E_K(P ⊕ Δ) ⊕ Δ

          // Step 1: XOR plaintext with mask
          const xorInput = OpCodes.XorArrays(block, mask);

          // Step 2: Encrypt with block cipher
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.key;
          encryptCipher.Feed(xorInput);
          const encrypted = encryptCipher.Result();

          // Step 3: XOR with mask again
          const cipherBlock = OpCodes.XorArrays(encrypted, mask);
          output.push(...cipherBlock);
        }
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Generate XEX mask for block i
     * @param {number} blockIndex - Block index (0-based)
     * @returns {Array} 128-bit mask for this block
     */
    _generateMask(blockIndex) {
      // Generate base mask: Δ_0 = E_K2(tweak)
      const baseMask = this._encryptTweak();

      // For block i, multiply by α^i in GF(2^128)
      // Where α is the primitive element (polynomial x)
      let mask = [...baseMask];

      // Multiply by α^blockIndex using repeated doubling
      for (let i = 0; i < blockIndex; i++) {
        mask = this._gf128Double(mask);
      }

      return mask;
    }

    /**
     * Encrypt the tweak with the tweak key to get base mask
     * @returns {Array} Base mask Δ_0
     */
    _encryptTweak() {
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.tweakKey;
      cipher.Feed(this.tweak);
      return cipher.Result();
    }

    /**
     * Double a value in GF(2^128) (multiply by α = x)
     * Uses the reduction polynomial x^128 + x^7 + x^2 + x + 1
     * @param {Array} value - 128-bit value to double
     * @returns {Array} Doubled value in GF(2^128)
     */
    _gf128Double(value) {
      const result = new Array(16);
      let carry = 0;

      // Shift left by 1 bit (multiply by x)
      for (let i = 15; i >= 0; i--) {
        const newCarry = OpCodes.AndN(OpCodes.Shr32(value[i], 7), 1);
        result[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(value[i], 1), carry), 0xFF);
        carry = newCarry;
      }

      // If there was a carry, reduce by the polynomial
      // x^128 + x^7 + x^2 + x + 1 = 0x87 in little-endian bit order
      if (carry) {
        result[0] = OpCodes.XorN(result[0], 0x87);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new XexAlgorithm());

  // ===== EXPORTS =====

  return { XexAlgorithm, XexModeInstance };
}));