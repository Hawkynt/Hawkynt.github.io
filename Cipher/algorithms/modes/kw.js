/*
 * KW (Key Wrap) Mode of Operation
 * Secure key wrapping mode for protecting cryptographic keys
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
    root.KW = factory(root.AlgorithmFramework, root.OpCodes);
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

  class KwAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "KW";
      this.description = "KW (Key Wrap) is a specialized mode designed specifically for securely wrapping (encrypting) cryptographic keys. It provides both confidentiality and integrity protection for key material using a deterministic algorithm with built-in authentication. Commonly used for protecting symmetric keys with a key encryption key (KEK).";
      this.inventor = "NIST";
      this.year = 2001;
      this.category = CategoryType.MODE;
      this.subCategory = "Key Wrapping Mode";
      this.securityStatus = SecurityStatus.SECURE; // Standardized and widely deployed
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses fixed IV (0xA6A6A6A6A6A6A6A6)
      this.SupportedIVSizes = []; // Not applicable for KW

      this.documentation = [
        new LinkItem("RFC 3394 - AES Key Wrap", "https://tools.ietf.org/rfc/rfc3394.txt"),
        new LinkItem("NIST SP 800-38F", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf"),
        new LinkItem("FIPS 197 AES", "https://nvlpubs.nist.gov/nistpubs/fips/nist.fips.197.pdf")
      ];

      this.references = [
        new LinkItem("OpenSSL Key Wrap", "https://github.com/openssl/openssl/blob/master/crypto/modes/wrap128.c"),
        new LinkItem("Crypto++ Key Wrap", "https://github.com/weidai11/cryptopp/blob/master/keywrap.cpp"),
        new LinkItem("Java KeyWrap Cipher", "https://docs.oracle.com/javase/8/docs/technotes/guides/security/crypto/CryptoSpec.html#KeyWrap")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Deterministic Nature", "Key Wrap is deterministic - identical keys will produce identical wrapped values. This may leak information in some contexts."),
        new Vulnerability("Key Size Restrictions", "Input key must be multiple of 64 bits (8 bytes). Minimum key size is 128 bits (16 bytes).")
      ];

      // Round-trip test vectors based on RFC 3394
      this.tests = [
        {
          text: "KW round-trip test - 128-bit key wrap",
          uri: "https://tools.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          kek: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f")
        },
        {
          text: "KW round-trip test - 192-bit key wrap",
          uri: "https://tools.ietf.org/rfc/rfc3394.txt",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff0001020304050607"),
          kek: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new KwModeInstance(this, isInverse);
    }
  }

  class KwModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.kek = null; // Key Encryption Key
      this.defaultIV = [0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6]; // RFC 3394 default IV
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
        throw new Error("Key Wrap requires AES (128-bit block cipher)");
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
        // Key Unwrapping
        return this._unwrapKey();
      } else {
        // Key Wrapping
        return this._wrapKey();
      }
    }

    /**
     * Wrap a key using the RFC 3394 algorithm
     * @returns {Array} Wrapped key
     */
    _wrapKey() {
      const plainKey = this.inputBuffer;

      // Validate input key length
      if (plainKey.length % 8 !== 0) {
        throw new Error("Key to wrap must be multiple of 64 bits (8 bytes)");
      }
      if (plainKey.length < 16) {
        throw new Error("Key to wrap must be at least 128 bits (16 bytes)");
      }

      const n = plainKey.length / 8; // Number of 64-bit blocks

      // Initialize variables
      let A = [...this.defaultIV]; // 64-bit IV
      const R = new Array(n + 1); // Array of 64-bit registers
      R[0] = null; // R[0] is not used

      // Split plaintext key into 64-bit blocks
      for (let i = 1; i <= n; i++) {
        R[i] = plainKey.slice((i - 1) * 8, i * 8);
      }

      // Perform wrapping algorithm
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
          const tBytes = OpCodes.Unpack32BE(t);
          A[7] ^= tBytes[3]; // LSB
          A[6] ^= tBytes[2];
          A[5] ^= tBytes[1];
          A[4] ^= tBytes[0]; // MSB
        }
      }

      // Construct wrapped key: A || R[1] || R[2] || ... || R[n]
      const wrapped = [...A];
      for (let i = 1; i <= n; i++) {
        wrapped.push(...R[i]);
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(A);
      R.forEach(r => r && OpCodes.ClearArray(r));
      this.inputBuffer = [];

      return wrapped;
    }

    /**
     * Unwrap a key using the RFC 3394 algorithm
     * @returns {Array} Unwrapped key
     */
    _unwrapKey() {
      const wrappedKey = this.inputBuffer;

      // Validate wrapped key length
      if (wrappedKey.length % 8 !== 0 || wrappedKey.length < 24) {
        throw new Error("Wrapped key must be multiple of 64 bits and at least 192 bits");
      }

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
          const tBytes = OpCodes.Unpack32BE(t);
          A[7] ^= tBytes[3]; // LSB
          A[6] ^= tBytes[2];
          A[5] ^= tBytes[1];
          A[4] ^= tBytes[0]; // MSB

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

      // Verify IV
      for (let i = 0; i < 8; i++) {
        if (A[i] !== this.defaultIV[i]) {
          throw new Error("Key unwrap failed: Invalid IV");
        }
      }

      // Construct unwrapped key: R[1] || R[2] || ... || R[n]
      const unwrapped = [];
      for (let i = 1; i <= n; i++) {
        unwrapped.push(...R[i]);
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(A);
      R.forEach(r => r && OpCodes.ClearArray(r));
      this.inputBuffer = [];

      return unwrapped;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new KwAlgorithm());

  // ===== EXPORTS =====

  return { KwAlgorithm, KwModeInstance };
}));