/*
 * Poly1305 MAC (Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RFC 7539 compliant Poly1305 implementation
 * Provides one-time authentication using 130-bit field arithmetic
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class Poly1305Algorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Poly1305";
      this.description = "One-time message authenticator designed by D.J. Bernstein using 130-bit field arithmetic. Provides information-theoretic security when used with unique keys.";
      this.inventor = "Daniel J. Bernstein";
      this.year = 2005;
      this.category = CategoryType.MAC;
      this.subCategory = "Universal Hashing MAC";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Changed from SECURE
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(16, 16, 0)  // Poly1305 produces 16-byte MAC
      ];
      this.NeedsKey = true;

      // Test vectors from RFC 7539
      this.tests = [
        // Test Case 1: RFC 7539 Section 2.5.2
        new TestCase(
          OpCodes.Hex8ToBytes("43727970746f6772617068696320466f72756d2052657365617263682047726f7570"),
          OpCodes.Hex8ToBytes("a8061dc1305136c6c22b8baf0c0127a9"),
          "RFC 7539 Section 2.5.2 - Cryptographic Forum Research Group",
          "https://tools.ietf.org/html/rfc7539"
        )
      ];

      // Set keys for test vectors  
      this.tests[0].key = OpCodes.Hex8ToBytes("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b");
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Poly1305 cannot be reversed
      }
      return new Poly1305Instance(this);
    }
  }

  // Instance class - handles the actual Poly1305 computation
  /**
 * Poly1305 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Poly1305Instance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.inputBuffer = [];
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }
      if (keyBytes.length !== 32) {
        throw new Error("Poly1305 requires 32-byte key");
      }
      this._key = [...keyBytes]; // Store copy
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Feed data to the MAC
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // Get the MAC result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      return this.poly1305(this._key, this.inputBuffer);
    }

    // Compute MAC (IMacInstance interface)
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      return this.poly1305(this._key, data);
    }

    /**
     * RFC 7539 compliant Poly1305 implementation
     * Simplified for educational clarity
     */
    poly1305(key, message) {
      // Split key into r and s components
      const rBytes = [...key.slice(0, 16)];
      const sBytes = key.slice(16, 32);

      // Clamp r according to Poly1305 specification
      rBytes[3] &= 15;
      rBytes[7] &= 15;
      rBytes[11] &= 15;
      rBytes[15] &= 15;
      rBytes[4] &= 252;
      rBytes[8] &= 252;
      rBytes[12] &= 252;

      // Convert r to little-endian integer representation
      const r = this.bytesToNum(rBytes);
      const s = this.bytesToNum(sBytes);

      // Initialize accumulator
      let h = BigInt(0);
      const p = (BigInt(1) << BigInt(130)) - BigInt(5); // 2^130 - 5

      // Process message in 16-byte blocks
      if (message.length === 0) {
        // Empty message case - just process single padding bit
        const n = BigInt(1); // Just the padding bit
        h = (h + n) % p;
        h = (h * r) % p;
      } else {
        const msg = [...message];

        while (msg.length > 0) {
          // Take up to 16 bytes for this block
          const blockSize = Math.min(16, msg.length);
          const block = msg.splice(0, blockSize);

          // Pad with zeros to 16 bytes
          while (block.length < 16) {
            block.push(0);
          }

          // Convert block to number and add padding bit
          let n = this.bytesToNum(block);
          if (blockSize === 16) {
            n += BigInt(1) << BigInt(128); // Add 2^128
          } else {
            n += BigInt(1) << BigInt(blockSize * 8); // Add 2^(8*blockSize)
          }

          // h = ((h + n) * r) mod p
          h = (h + n) % p;
          h = (h * r) % p;
        }
      }

      // Final step: add s
      h = (h + s) % (BigInt(1) << BigInt(128)); // mod 2^128

      // Convert back to bytes
      return this.numToBytes(h, 16);
    }

    /**
     * Convert bytes to BigInt (little-endian)
     */
    bytesToNum(bytes) {
      let num = BigInt(0);
      for (let i = bytes.length - 1; i >= 0; i--) {
        num = (num << BigInt(8)) + BigInt(bytes[i]);
      }
      return num;
    }

    /**
     * Convert BigInt to bytes (little-endian)
     */
    numToBytes(num, length) {
      const bytes = new Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = Number(num & BigInt(0xff));
        num >>= BigInt(8);
      }
      return bytes;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Poly1305Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Poly1305Algorithm, Poly1305Instance };
}));