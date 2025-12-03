/*
 * KWP (Key Wrap with Padding) Mode of Operation
 * Key wrapping mode that can handle arbitrary length keys with padding
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
    root.KWP = factory(root.AlgorithmFramework, root.OpCodes);
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

  class KwpAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "KWP";
      this.description = "KWP (Key Wrap with Padding) extends the standard Key Wrap algorithm to handle arbitrary-length key material by adding padding. It includes the original key length in the IV to enable proper padding removal during unwrapping. This allows secure wrapping of keys that are not multiples of 64 bits.";
      this.inventor = "NIST";
      this.year = 2012;
      this.category = CategoryType.MODE;
      this.subCategory = "Key Wrapping Mode";
      this.securityStatus = SecurityStatus.SECURE; // Standardized extension of KW
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses constructed IV with length information
      this.SupportedIVSizes = []; // Not applicable for KWP

      this.documentation = [
        new LinkItem("RFC 5649 - AES Key Wrap with Padding", "https://tools.ietf.org/rfc/rfc5649.txt"),
        new LinkItem("NIST SP 800-38F", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf"),
        new LinkItem("Key Wrap Extensions", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      this.references = [
        new LinkItem("OpenSSL KWP Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/wrap128.c"),
        new LinkItem("Crypto++ Key Wrap Padding", "https://github.com/weidai11/cryptopp/blob/master/keywrap.cpp"),
        new LinkItem("Python Cryptography KWP", "https://github.com/pyca/cryptography/blob/main/src/cryptography/hazmat/primitives/keywrap.py")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Length Information Leakage", "KWP includes the original key length in the IV, which may leak information about the wrapped key size."),
        new Vulnerability("Padding Oracle Potential", "Improper error handling during unwrapping could potentially leak information about padding validity.")
      ];

      // Round-trip test vectors based on RFC 5649
      this.tests = [
        {
          text: "KWP round-trip test - 20-byte key",
          uri: "https://tools.ietf.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("c37b7e6492584340bed12207808941155068f738"),
          kek: OpCodes.Hex8ToBytes("5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8")
        },
        {
          text: "KWP round-trip test - 7-byte key",
          uri: "https://tools.ietf.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("466f7250617369"),
          kek: OpCodes.Hex8ToBytes("5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KwpModeInstance(this, isInverse);
    }
  }

  /**
 * KwpMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KwpModeInstance extends IAlgorithmInstance {
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
      this.kek = null; // Key Encryption Key
    }

    /**
     * Set the underlying block cipher instance (must be AES for standard compliance)
     * @param {IBlockCipherInstance} cipher - The block cipher to use (typically AES)
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      if (cipher.BlockSize !== 16) {
        throw new Error("Key Wrap with Padding requires AES (128-bit block cipher)");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the Key Encryption Key (KEK)
     * @param {Array} kek - Key Encryption Key (128, 192, or 256 bits)
     */
    setKEK(kek) {
      if (!kek || (kek.length !== 16 && kek.length !== 24 && kek.length !== 32)) {
        throw new Error("KEK must be 128, 192, or 256 bits (16, 24, or 32 bytes)");
      }
      this.kek = [...kek];
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
      if (!this.kek) {
        throw new Error("KEK not set. Call setKEK() first.");
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
      if (!this.kek) {
        throw new Error("KEK not set. Call setKEK() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      if (this.isInverse) {
        // Key Unwrapping with Padding
        return this._unwrapKeyWithPadding();
      } else {
        // Key Wrapping with Padding
        return this._wrapKeyWithPadding();
      }
    }

    /**
     * Wrap a key with padding using RFC 5649 algorithm
     * @returns {Array} Wrapped key with padding
     */
    _wrapKeyWithPadding() {
      const plainKey = this.inputBuffer;
      const originalLength = plainKey.length;

      // Validate minimum key length
      if (originalLength === 0) {
        throw new Error("Key to wrap cannot be empty");
      }

      // Create padded key
      const paddedKey = [...plainKey];

      // Pad to next 8-byte boundary
      while (paddedKey.length % 8 !== 0) {
        paddedKey.push(0);
      }

      // Construct KWP IV: 0xA65959A6 || original_length (32-bit big-endian)
      const kwpIV = [
        0xA6, 0x59, 0x59, 0xA6,
        OpCodes.AndN(OpCodes.Shr32(originalLength, 24), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(originalLength, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(originalLength, 8), 0xFF),
        OpCodes.AndN(originalLength, 0xFF)
      ];

      let result;

      if (paddedKey.length === 8) {
        // Special case: single 64-bit block
        // Encrypt IV || padded_key directly
        const input = kwpIV.concat(paddedKey);
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.kek;
        cipher.Feed(input);
        result = cipher.Result();
      } else {
        // Multiple blocks: use modified Key Wrap algorithm
        const n = paddedKey.length / 8; // Number of 64-bit blocks

        // Initialize variables
        let A = [...kwpIV]; // Use KWP IV instead of default KW IV
        const R = new Array(n + 1); // Array of 64-bit registers
        R[0] = null; // R[0] is not used

        // Split padded key into 64-bit blocks
        for (let i = 1; i <= n; i++) {
          R[i] = paddedKey.slice((i - 1) * 8, i * 8);
        }

        // Perform wrapping algorithm (same as KW but with different IV)
        for (let j = 0; j <= 5; j++) {
          for (let i = 1; i <= n; i++) {
            // Encrypt A || R[i] with KEK
            const input = A.concat(R[i]);
            const cipher = this.blockCipher.algorithm.CreateInstance(false);
            cipher.key = this.kek;
            cipher.Feed(input);
            const B = cipher.Result();

            // Split result and update
            A = B.slice(0, 8);
            R[i] = B.slice(8, 16);

            // XOR MSB of A with (n*j)+i
            const t = (n * j) + i;
            A[7] = OpCodes.XorN(A[7], OpCodes.AndN(t, 0xFF));
            A[6] = OpCodes.XorN(A[6], OpCodes.AndN(OpCodes.Shr32(t, 8), 0xFF));
            A[5] = OpCodes.XorN(A[5], OpCodes.AndN(OpCodes.Shr32(t, 16), 0xFF));
            A[4] = OpCodes.XorN(A[4], OpCodes.AndN(OpCodes.Shr32(t, 24), 0xFF));
          }
        }

        // Construct wrapped key: A || R[1] || R[2] || ... || R[n]
        result = [...A];
        for (let i = 1; i <= n; i++) {
          result.push(...R[i]);
        }

        // Clear sensitive arrays
        OpCodes.ClearArray(A);
        R.forEach(r => r && OpCodes.ClearArray(r));
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(paddedKey);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Unwrap a key with padding using RFC 5649 algorithm
     * @returns {Array} Unwrapped key with padding removed
     */
    _unwrapKeyWithPadding() {
      const wrappedKey = this.inputBuffer;

      // Validate wrapped key length
      if (wrappedKey.length < 16 || wrappedKey.length % 8 !== 0) {
        throw new Error("Wrapped key must be at least 16 bytes and multiple of 8 bytes");
      }

      let decrypted;

      if (wrappedKey.length === 16) {
        // Special case: single block
        // Decrypt directly to get IV || padded_key
        const cipher = this.blockCipher.algorithm.CreateInstance(true);
        cipher.key = this.kek;
        cipher.Feed(wrappedKey);
        decrypted = cipher.Result();
      } else {
        // Multiple blocks: use modified Key Wrap unwrapping
        const n = (wrappedKey.length / 8) - 1; // Number of 64-bit plaintext blocks

        // Initialize variables
        let A = wrappedKey.slice(0, 8); // 64-bit IV
        const R = new Array(n + 1); // Array of 64-bit registers
        R[0] = null; // R[0] is not used

        // Split wrapped key into 64-bit blocks
        for (let i = 1; i <= n; i++) {
          R[i] = wrappedKey.slice(i * 8, (i + 1) * 8);
        }

        // Perform unwrapping algorithm
        for (let j = 5; j >= 0; j--) {
          for (let i = n; i >= 1; i--) {
            // XOR MSB of A with (n*j)+i
            const t = (n * j) + i;
            A[7] = OpCodes.XorN(A[7], OpCodes.AndN(t, 0xFF));
            A[6] = OpCodes.XorN(A[6], OpCodes.AndN(OpCodes.Shr32(t, 8), 0xFF));
            A[5] = OpCodes.XorN(A[5], OpCodes.AndN(OpCodes.Shr32(t, 16), 0xFF));
            A[4] = OpCodes.XorN(A[4], OpCodes.AndN(OpCodes.Shr32(t, 24), 0xFF));

            // Decrypt A || R[i] with KEK
            const input = A.concat(R[i]);
            const cipher = this.blockCipher.algorithm.CreateInstance(true);
            cipher.key = this.kek;
            cipher.Feed(input);
            const B = cipher.Result();

            // Split result and update
            A = B.slice(0, 8);
            R[i] = B.slice(8, 16);
          }
        }

        // Construct decrypted data: A || R[1] || R[2] || ... || R[n]
        decrypted = [...A];
        for (let i = 1; i <= n; i++) {
          decrypted.push(...R[i]);
        }

        // Clear sensitive arrays
        OpCodes.ClearArray(A);
        R.forEach(r => r && OpCodes.ClearArray(r));
      }

      // Extract IV and verify KWP format
      const iv = decrypted.slice(0, 8);
      const paddedKey = decrypted.slice(8);

      // Verify KWP IV format: 0xA65959A6 || length
      if (iv[0] !== 0xA6 || iv[1] !== 0x59 || iv[2] !== 0x59 || iv[3] !== 0xA6) {
        throw new Error("Key unwrap failed: Invalid KWP IV");
      }

      // Extract original key length
      const originalLength = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(iv[4], 24), OpCodes.Shl32(iv[5], 16)), OpCodes.Shl32(iv[6], 8)), iv[7]);

      // Validate length
      if (originalLength > paddedKey.length) {
        throw new Error("Key unwrap failed: Invalid length field");
      }

      // Remove padding and return original key
      const originalKey = paddedKey.slice(0, originalLength);

      // Verify padding is all zeros
      for (let i = originalLength; i < paddedKey.length; i++) {
        if (paddedKey[i] !== 0) {
          throw new Error("Key unwrap failed: Invalid padding");
        }
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(decrypted);
      OpCodes.ClearArray(paddedKey);
      this.inputBuffer = [];

      return originalKey;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new KwpAlgorithm());

  // ===== EXPORTS =====

  return { KwpAlgorithm, KwpModeInstance };
}));