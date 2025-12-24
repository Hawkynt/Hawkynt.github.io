(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/aria'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/aria')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.AriaAlgorithm);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, AriaModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!AriaModule) {
    throw new Error('ARIA block cipher dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ARIA Key Wrap Algorithm (RFC 3394 structure with ARIA cipher)
  class AriaWrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ARIA-Wrap";
      this.description = "ARIA Key Wrap algorithm following RFC 3394 structure. Securely wraps cryptographic keys using ARIA block cipher with authenticated encryption properties.";
      this.inventor = "NIST (algorithm structure), Korean Agency for Technology and Standards (ARIA cipher)";
      this.year = 2004;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.KR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // ARIA-128/192/256
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 3394 - AES Key Wrap Algorithm (structure)", "https://tools.ietf.org/html/rfc3394"),
        new LinkItem("RFC 5794 - ARIA Encryption Algorithm", "https://tools.ietf.org/html/rfc5794"),
        new LinkItem("NIST Key Wrap Specification", "https://csrc.nist.gov/projects/key-management/key-wrap")
      ];

      this.references = [
        new LinkItem("BouncyCastle ARIAWrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/ARIAWrapEngine.java"),
        new LinkItem("RFC 3394 Implementation Guide", "https://tools.ietf.org/html/rfc3394"),
        new LinkItem("ARIA Algorithm Specification", "https://tools.ietf.org/html/rfc5794")
      ];

      // Test vectors - Generated using verified ARIA implementation with RFC 3394 algorithm
      // These vectors use the same structure as AES Key Wrap but with ARIA cipher
      // Vectors generated and verified against RFC 3394 key wrap algorithm using ARIA block cipher
      this.tests = [
        {
          text: 'ARIA-128 Key Wrap - 128-bit Key Data',
          uri: 'https://tools.ietf.org/html/rfc3394',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("a93f148d4909d85f1aae656909879275ae597b3acf9d60db")
        },
        {
          text: 'ARIA-192 Key Wrap - 128-bit Key Data',
          uri: 'https://tools.ietf.org/html/rfc3394',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("62c0cc597cea0a97c1ddfd9384ba51a9f4ec7aac30f7cedc")
        },
        {
          text: 'ARIA-256 Key Wrap - 128-bit Key Data',
          uri: 'https://tools.ietf.org/html/rfc3394',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("1f68ac246e2519b0235e1474867b08f606bcf85bef006eba")
        },
        {
          text: 'ARIA-128 Key Wrap - 192-bit Key Data',
          uri: 'https://tools.ietf.org/html/rfc3394',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("07f372824d4c9aafffd45f628c5aa433328624051b249ec9fe10c4d49ab5ff8f")
        },
        {
          text: 'ARIA-128 Key Wrap - 256-bit Key Data',
          uri: 'https://tools.ietf.org/html/rfc3394',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("a5d920a3169b4934f2f4f3d03de0c9f33eff79590e1f8b9de4653eca2d8c5edb72bed41ec44d800e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AriaWrapInstance(this, isInverse);
    }
  }

  // ARIA Key Wrap Instance - implements RFC 3394 with ARIA cipher
  /**
 * AriaWrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AriaWrapInstance extends IAlgorithmInstance {
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
      this._iv = null;
      this.ariaEngine = null;

      // Default IV for RFC 3394
      this.DEFAULT_IV = [0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6];
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.ariaEngine = null;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];

      // Create ARIA engine instance for wrapping (encryption mode)
      const AriaAlgorithm = AlgorithmFramework.Find("ARIA");
      if (!AriaAlgorithm) {
        throw new Error("ARIA block cipher not found in registry");
      }

      this.ariaEngine = AriaAlgorithm.CreateInstance(false); // false = encryption for wrapping
      this.ariaEngine.key = keyBytes;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV (optional, defaults to RFC 3394 standard IV)
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
        throw new Error("IV must be exactly 8 bytes");
      }

      this._iv = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : [...this.DEFAULT_IV];
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

    // Get wrapped/unwrapped result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const result = this.isInverse
        ? this._unwrap(this.inputBuffer)
        : this._wrap(this.inputBuffer);

      this.inputBuffer = []; // Clear buffer
      return result;
    }

    // RFC 3394 Key Wrap implementation with ARIA
    _wrap(plaintext) {
      // Validate input length (must be multiple of 8 bytes, minimum 16 bytes)
      if (plaintext.length < 16) {
        throw new Error("Plaintext must be at least 16 bytes (two 64-bit blocks)");
      }
      if (plaintext.length % 8 !== 0) {
        throw new Error("Plaintext length must be multiple of 8 bytes");
      }

      const n = plaintext.length / 8; // Number of 64-bit blocks
      const iv = this.iv;

      // Special case: wrapping single block (64 bits)
      if (n === 1) {
        // For single block, just encrypt IV || plaintext
        const block = [...iv, ...plaintext];
        this.ariaEngine.Feed(block);
        return this.ariaEngine.Result();
      }

      // Initialize registers
      // A = IV (Integrity Check Register)
      let A = [...iv];

      // R[1..n] = plaintext blocks
      const R = [];
      for (let i = 0; i < n; ++i) {
        R[i] = plaintext.slice(i * 8, (i + 1) * 8);
      }

      // Main wrapping loop: 6 iterations as per RFC 3394
      for (let j = 0; j <= 5; ++j) {
        for (let i = 0; i < n; ++i) {
          // B = ARIA(K, A || R[i])
          const block = [...A, ...R[i]];
          this.ariaEngine.Feed(block);
          const B = this.ariaEngine.Result();

          // A = MSB(64, B) XOR t where t = (n*j)+i+1
          A = B.slice(0, 8);
          const t = (n * j) + i + 1;

          // XOR t into the last byte(s) of A (big-endian)
          for (let k = 1; t !== 0 && k <= 8; ++k) {
            const shift = (k - 1) * 8;
            const byteVal = OpCodes.ToByte(OpCodes.Shr32(t, shift));
            if (byteVal !== 0) {
              A[8 - k] = OpCodes.ToByte(OpCodes.Xor32(A[8 - k], byteVal));
            }
            if (t < OpCodes.Shl32(1, k * 8)) break; // No more significant bytes
          }

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Output: A || R[1] || R[2] || ... || R[n]
      const result = [...A];
      for (let i = 0; i < n; ++i) {
        result.push(...R[i]);
      }

      return result;
    }

    // RFC 3394 Key Unwrap implementation with ARIA
    _unwrap(ciphertext) {
      // Validate input length (must be multiple of 8 bytes, minimum 24 bytes)
      if (ciphertext.length < 24) {
        throw new Error("Ciphertext must be at least 24 bytes");
      }
      if (ciphertext.length % 8 !== 0) {
        throw new Error("Ciphertext length must be multiple of 8 bytes");
      }

      const n = (ciphertext.length / 8) - 1; // Number of 64-bit data blocks
      const expectedIV = this.iv;

      // Special case: unwrapping single block
      if (n === 1) {
        // Create ARIA decryption instance
        const AriaAlgorithm = AlgorithmFramework.Find("ARIA");
        const ariaDecrypt = AriaAlgorithm.CreateInstance(true); // true = decryption
        ariaDecrypt.key = this._key;

        ariaDecrypt.Feed(ciphertext);
        const decrypted = ariaDecrypt.Result();

        // Verify IV
        const extractedIV = decrypted.slice(0, 8);
        if (!OpCodes.ConstantTimeCompare(extractedIV, expectedIV)) {
          throw new Error("Authentication check failed: IV mismatch");
        }

        return decrypted.slice(8, 16);
      }

      // Initialize registers
      // A = C[0] (first 64 bits)
      let A = ciphertext.slice(0, 8);

      // R[1..n] = C[1..n]
      const R = [];
      for (let i = 0; i < n; ++i) {
        R[i] = ciphertext.slice((i + 1) * 8, (i + 2) * 8);
      }

      // Create ARIA decryption instance
      const AriaAlgorithm = AlgorithmFramework.Find("ARIA");
      const ariaDecrypt = AriaAlgorithm.CreateInstance(true); // true = decryption
      ariaDecrypt.key = this._key;

      // Main unwrapping loop: 6 iterations in reverse
      for (let j = 5; j >= 0; --j) {
        for (let i = n - 1; i >= 0; --i) {
          // Calculate t = (n*j)+i+1
          const t = (n * j) + i + 1;

          // A' = A XOR t
          const A_prime = [...A];
          for (let k = 1; t !== 0 && k <= 8; ++k) {
            const shift = (k - 1) * 8;
            const byteVal = OpCodes.ToByte(OpCodes.Shr32(t, shift));
            if (byteVal !== 0) {
              A_prime[8 - k] = OpCodes.ToByte(OpCodes.Xor32(A_prime[8 - k], byteVal));
            }
            if (t < OpCodes.Shl32(1, k * 8)) break;
          }

          // B = ARIA_DECRYPT(K, A' || R[i])
          const block = [...A_prime, ...R[i]];
          ariaDecrypt.Feed(block);
          const B = ariaDecrypt.Result();

          // A = MSB(64, B)
          A = B.slice(0, 8);

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Verify IV using constant-time comparison
      if (!OpCodes.ConstantTimeCompare(A, expectedIV)) {
        throw new Error("Authentication check failed: IV mismatch");
      }

      // Output: R[1] || R[2] || ... || R[n]
      const result = [];
      for (let i = 0; i < n; ++i) {
        result.push(...R[i]);
      }

      return result;
    }
  }

  // Register the algorithm
  const algorithmInstance = new AriaWrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Export
  return { AriaWrapAlgorithm, AriaWrapInstance };
}));
