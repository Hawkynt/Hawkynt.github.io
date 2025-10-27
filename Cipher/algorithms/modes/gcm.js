/*
 * GCM (Galois/Counter Mode) of Operation
 * Authenticated Encryption with Associated Data (AEAD) mode
 * Combines CTR mode encryption with GHASH authentication
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
    root.GCM = factory(root.AlgorithmFramework, root.OpCodes);
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

  class GcmAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "GCM";
      this.description = "Galois/Counter Mode provides authenticated encryption by combining CTR mode encryption with GHASH authentication using GF(2^128) arithmetic. Widely used in TLS, IPsec, and other security protocols. Provides both confidentiality and authenticity but catastrophically fails if nonces are reused.";
      this.inventor = "David A. McGrew, John Viega";
      this.year = 2005;
      this.category = CategoryType.MODE;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [
        new KeySize(4, 16, 1) // GCM supports tag sizes from 32 to 128 bits
      ];
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("NIST SP 800-38D", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"),
        new LinkItem("Original GCM Paper", "https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.58.4924"),
        new LinkItem("RFC 5288 - AES GCM for TLS", "https://tools.ietf.org/rfc/rfc5288.txt")
      ];

      this.references = [
        new LinkItem("OpenSSL GCM Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c"),
        new LinkItem("ISO/IEC 19772:2009", "GCM international standard"),
        new LinkItem("Crypto++ GCM Implementation", "https://github.com/weidai11/cryptopp/blob/master/gcm.cpp")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse Attack", "Reusing nonce with same key completely breaks confidentiality and authenticity. Authentication key can be recovered. Always use unique nonces."),
        new Vulnerability("Forbidden Attack", "With very long messages (near 2^39 bits), confidentiality degrades. Limit message lengths in practice."),
        new Vulnerability("Authentication Forgery", "With nonce reuse, arbitrary messages can be forged after key recovery.")
      ];

      this.tests = [
        {
          text: "GCM round-trip test #1 - 1 byte",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf",
          input: OpCodes.Hex8ToBytes("00"), // Use 1 byte instead of empty
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
          aad: []
        },
        {
          text: "GCM round-trip test #2 - single block",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
          aad: []
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new GcmModeInstance(this, isInverse);
    }
  }

  class GcmModeInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.iv = null;
      this.tagSize = 16; // Default 128-bit tag
      this.hashKey = null; // GHASH key (E_K(0^128))
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use (must be 128-bit block size)
     */
    setBlockCipher(cipher) {
      if (!cipher || cipher.BlockSize !== 16) {
        throw new Error("GCM requires a 128-bit block cipher");
      }
      this.blockCipher = cipher;
      this._computeHashKey();
    }

    /**
     * Set the initialization vector (nonce)
     * @param {Array} iv - IV/nonce (recommended 96 bits, but supports arbitrary lengths)
     */
    setIV(iv) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before IV");
      }
      if (!iv || iv.length === 0) {
        throw new Error("IV cannot be empty for GCM");
      }
      this.iv = [...iv]; // Copy IV
    }

    /**
     * Set authentication tag size (in bytes)
     * @param {number} size - Tag size in bytes (4-16)
     */
    setTagSize(size) {
      if (size < 4 || size > 16) {
        throw new Error("GCM tag size must be between 4 and 16 bytes");
      }
      this.tagSize = size;
    }

    /**
     * Compute GHASH authentication key H = E_K(0^128)
     * @private
     */
    _computeHashKey() {
      if (!this.blockCipher) return;

      const zeroBlock = new Array(16).fill(0);
      const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
      encryptCipher.key = this.blockCipher.key;
      encryptCipher.Feed(zeroBlock);
      this.hashKey = encryptCipher.Result();
    }

    /**
     * Compute initial counter J_0 from IV
     * @private
     */
    _computeInitialCounter() {
      if (this.iv.length === 12) {
        // Standard 96-bit IV: J_0 = IV || 0^31 || 1
        return [...this.iv, 0, 0, 0, 1];
      } else {
        // Non-standard IV length: J_0 = GHASH(H, IV || padding || len(IV))
        const ivBlocks = this._padToBlocks(this.iv);
        const lenBlock = new Array(16).fill(0);

        // Encode IV length in bits as 64-bit big-endian using OpCodes
        const ivBitLen = this.iv.length * 8;
        const ivLenBytes = OpCodes.Unpack32BE(ivBitLen);
        // Store as 64-bit big-endian (upper 32 bits = 0, lower 32 bits = length)
        lenBlock[8] = 0;
        lenBlock[9] = 0;
        lenBlock[10] = 0;
        lenBlock[11] = 0;
        lenBlock[12] = ivLenBytes[0];
        lenBlock[13] = ivLenBytes[1];
        lenBlock[14] = ivLenBytes[2];
        lenBlock[15] = ivLenBytes[3];

        ivBlocks.push(...lenBlock);
        return this._ghash(ivBlocks);
      }
    }

    /**
     * Pad data to complete 128-bit blocks
     * @private
     */
    _padToBlocks(data) {
      const result = [...data];
      const remainder = result.length % 16;
      if (remainder > 0) {
        const padding = new Array(16 - remainder).fill(0);
        result.push(...padding);
      }
      return result;
    }

    /**
     * GHASH authentication function
     * @private
     */
    _ghash(data) {
      if (!this.hashKey) {
        throw new Error("Hash key not computed");
      }

      let y = new Array(16).fill(0); // Initialize Y_0 = 0^128

      // Process data in 128-bit blocks
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);

        // Y_i = (Y_{i-1} XOR X_i) * H
        y = OpCodes.XorArrays(y, block);
        y = OpCodes.GHashMul(y, this.hashKey);
      }

      return y;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }

      const j0 = this._computeInitialCounter();
      let counter = [...j0];
      const output = [];

      if (this.isInverse) {
        // GCM Decryption + Authentication
        if (this.inputBuffer.length < this.tagSize) {
          throw new Error("Input too short for tag verification");
        }

        const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
        const receivedTag = this.inputBuffer.slice(-this.tagSize);

        // Decrypt ciphertext using CTR mode
        for (let i = 0; i < ciphertext.length; i += 16) {
          const remainingBytes = Math.min(16, ciphertext.length - i);
          const cipherBlock = ciphertext.slice(i, i + remainingBytes);

          counter = OpCodes.GCMIncrement(counter);
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(counter);
          const keystream = encryptCipher.Result();

          const plainBlock = [];
          for (let j = 0; j < remainingBytes; j++) {
            plainBlock[j] = cipherBlock[j] ^ keystream[j];
          }
          output.push(...plainBlock);
        }

        // Verify authentication tag
        const computedTag = this._computeTag(ciphertext, j0);
        const truncatedTag = computedTag.slice(0, this.tagSize);

        if (!OpCodes.SecureCompare(receivedTag, truncatedTag)) {
          throw new Error("GCM authentication verification failed");
        }

      } else {
        // GCM Encryption + Authentication
        const plaintext = [...this.inputBuffer];

        // Encrypt plaintext using CTR mode
        for (let i = 0; i < plaintext.length; i += 16) {
          const remainingBytes = Math.min(16, plaintext.length - i);
          const plainBlock = plaintext.slice(i, i + remainingBytes);

          counter = OpCodes.GCMIncrement(counter);
          const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
          encryptCipher.key = this.blockCipher.key;
          encryptCipher.Feed(counter);
          const keystream = encryptCipher.Result();

          const cipherBlock = [];
          for (let j = 0; j < remainingBytes; j++) {
            cipherBlock[j] = plainBlock[j] ^ keystream[j];
          }
          output.push(...cipherBlock);
        }

        // Compute and append authentication tag
        const tag = this._computeTag(output, j0);
        const truncatedTag = tag.slice(0, this.tagSize);
        output.push(...truncatedTag);
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(counter);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Compute GCM authentication tag
     * @private
     */
    _computeTag(ciphertext, j0) {
      // Prepare data for GHASH: AAD || pad || C || pad || len(AAD) || len(C)
      const ghashInput = [];

      // Add AAD (Additional Authenticated Data)
      if (this.aad && this.aad.length > 0) {
        ghashInput.push(...this._padToBlocks(this.aad));
      }

      // Add ciphertext
      if (ciphertext.length > 0) {
        ghashInput.push(...this._padToBlocks(ciphertext));
      }

      // Add length block: len(AAD) || len(C) in bits as 64-bit values
      const lenBlock = new Array(16).fill(0);
      const aadBitLen = (this.aad ? this.aad.length : 0) * 8;
      const cBitLen = ciphertext.length * 8;

      // Encode lengths as 64-bit big-endian using OpCodes
      const aadLenBytes = OpCodes.Unpack32BE(aadBitLen);
      const cLenBytes = OpCodes.Unpack32BE(cBitLen);

      // Store as 64-bit big-endian (upper 32 bits = 0, lower 32 bits = length)
      lenBlock[0] = 0; lenBlock[1] = 0; lenBlock[2] = 0; lenBlock[3] = 0;
      lenBlock[4] = aadLenBytes[0]; lenBlock[5] = aadLenBytes[1]; lenBlock[6] = aadLenBytes[2]; lenBlock[7] = aadLenBytes[3];
      lenBlock[8] = 0; lenBlock[9] = 0; lenBlock[10] = 0; lenBlock[11] = 0;
      lenBlock[12] = cLenBytes[0]; lenBlock[13] = cLenBytes[1]; lenBlock[14] = cLenBytes[2]; lenBlock[15] = cLenBytes[3];
      ghashInput.push(...lenBlock);

      // Compute GHASH
      const s = this._ghash(ghashInput);

      // Encrypt S with J_0 to get authentication tag
      const encryptCipher = this.blockCipher.algorithm.CreateInstance(false);
      encryptCipher.key = this.blockCipher.key;
      encryptCipher.Feed(j0);
      const j0Encrypted = encryptCipher.Result();

      return OpCodes.XorArrays(s, j0Encrypted);
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new GcmAlgorithm());

  // ===== EXPORTS =====

  return { GcmAlgorithm, GcmModeInstance };
}));