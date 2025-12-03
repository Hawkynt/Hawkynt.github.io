/*
 * PSS (Probabilistic Signature Scheme) Padding
 * PKCS#1 v2.1 PSS padding for RSA signatures
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

  class PSSAlgorithm extends PaddingAlgorithm {
    constructor() {
      super();

      this.name = "PSS";
      this.description = "Probabilistic Signature Scheme (PSS) padding for RSA signatures as defined in PKCS#1 v2.1. Provides provable security and resistance to signature forgery attacks. Uses randomization and a mask generation function for enhanced security.";
      this.inventor = "Mihir Bellare, Phillip Rogaway";
      this.year = 1996;
      this.category = CategoryType.PADDING;
      this.subCategory = "Signature Padding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 8017 - PKCS #1 v2.2 PSS", "https://tools.ietf.org/rfc/rfc8017.txt"),
        new LinkItem("PKCS #1 v2.1 Standard", "https://www.rsa.com/rsalabs/node.asp?id=2125"),
        new LinkItem("PSS Original Paper", "https://cseweb.ucsd.edu/~mihir/papers/pss.pdf")
      ];

      this.references = [
        new LinkItem("RSA-PSS Wikipedia", "https://en.wikipedia.org/wiki/Probabilistic_signature_scheme"),
        new LinkItem("MGF1 Mask Generation", "https://tools.ietf.org/rfc/rfc3447.txt"),
        new LinkItem("Cryptography Engineering", "https://www.schneier.com/books/cryptography_engineering/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Implementation Errors", "Incorrect implementation of MGF1 or salt handling can compromise security."),
        new Vulnerability("Side Channel Attacks", "Timing or power analysis attacks may be possible with naive implementations."),
        new Vulnerability("Salt Reuse", "Using the same salt for multiple signatures can reveal information.")
      ];

      // Test vectors for PSS padding (educational implementation)
      // Note: Generated from educational implementation with deterministic salt
      // PSS typically takes a hash as input (20 bytes for SHA-1)
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("48656c6c6f20576f726c64"), // "Hello World" - 11 bytes
          OpCodes.Hex8ToBytes("4c7e44412ff1f63ebb446bc23e89347c50f4120b4c7e44432ff1f63ebb446bc23e89347c50f4120b4c7e44452ff1f63ebb446bc23e89347c50f4120b4c7e44472ff1f63ebb446bc23e89347c50f4120b4c7e44492ff1f63ebb446bc23e89347c50f4120b4c7e444b2ff1f63ebb446bc23e89347c50f4120b4c7e444d2ff1f63ebb446bc23e89347c50f4120b4c7e444f2ff1f63ebb446bc23e89347c50f4120b4c7e44512ff1f63ebb446bc23e89347c50f4120b4c7e44532ff1f63ebb446bc23e89347c50f4120b4c7e44552ff1f63ebb446bc23e8935561f808bb5af766905586d37d8b0743eb8a14dddc5844ef358a09b762c58376a8cd8be139d44cfcabc"),
          "PSS padding with 11-byte input",
          "Educational implementation"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"), // 20-byte hash (SHA-1 size)
          OpCodes.Hex8ToBytes("c155e9eec927c1488c28ce44b3efcb62b411b4fcc155e9ecc927c1488c28ce44b3efcb62b411b4fcc155e9eac927c1488c28ce44b3efcb62b411b4fcc155e9e8c927c1488c28ce44b3efcb62b411b4fcc155e9e6c927c1488c28ce44b3efcb62b411b4fcc155e9e4c927c1488c28ce44b3efcb62b411b4fcc155e9e2c927c1488c28ce44b3efcb62b411b4fcc155e9e0c927c1488c28ce44b3efcb62b411b4fcc155e9fec927c1488c28ce44b3efcb62b411b4fcc155e9fcc927c1488c28ce44b3efcb62b411b4fcc155e9fac927c1488c28ce44b3efca48fb652d42225dc4aabebb00ae87189b3e2c2b22a64e25182bcb004db76ee5294aeb411cefb69c31bc"),
          "PSS padding with 20-byte SHA-1 hash",
          "Educational implementation"
        )
      ];

      // Add metadata for tests
      this.tests.forEach(test => {
        test.keySize = 2048; // RSA-2048
        test.saltLength = 20; // 20-byte salt (SHA-1 length)
        test.hashFunction = 'SHA-1';
      });
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PSSInstance(this, isInverse);
    }
  }

  /**
 * PSS cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PSSInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._keySize = 2048; // RSA key size in bits
      this._saltLength = 20; // Default salt length (SHA-1 hash size)
      this._hashFunction = 'SHA-1'; // Hash function name
    }

    // Property getters and setters for test framework
    get keySize() { return this._keySize; }
    set keySize(value) {
      if (value < 1024 || value > 8192 || value % 8 !== 0) {
        throw new Error("Key size must be between 1024-8192 bits and divisible by 8");
      }
      this._keySize = value;
    }

    get saltLength() { return this._saltLength; }
    set saltLength(value) {
      if (value < 0 || value > 255) {
        throw new Error("Salt length must be between 0-255 bytes");
      }
      this._saltLength = value;
    }

    get hashFunction() { return this._hashFunction; }
    set hashFunction(value) {
      this._hashFunction = value;
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
      // Allow empty input buffer - padding can pad zero-length data to a full block
      if (this.isInverse) {
        // For unpadding, we need data
        if (this.inputBuffer.length === 0) {
          return []; // Return empty array for empty input
        }
        return this._verifyPadding();
      } else {
        // For padding, empty input is fine - it will be padded to a full block
        return this._addPadding();
      }
    }

    /**
     * Add PSS padding to message hash
     * @returns {Array} PSS-padded data
     */
    _addPadding() {
      const messageHash = this.inputBuffer;
      const keyBytes = this._keySize / 8;
      const hashLength = this._getHashLength(); // Use fixed hash length, not input length

      // Generate salt (simplified: use deterministic salt for test vectors)
      const salt = new Array(this._saltLength).fill(0).map((_, i) => OpCodes.AndN((i * 37 + 42), 0xFF));

      // Create M' = 0x00 00 00 00 00 00 00 00 || messageHash || salt
      const mPrime = [0, 0, 0, 0, 0, 0, 0, 0, ...messageHash, ...salt];

      // Hash M' (simplified: use XOR-based pseudo-hash for educational purposes)
      const hash = this._simpleHash(mPrime);

      // Create DB = PS || 0x01 || salt
      const psLength = keyBytes - this._saltLength - hashLength - 2;
      const db = [...new Array(psLength).fill(0), 0x01, ...salt];

      // Generate mask using MGF1 (simplified)
      const dbMask = this._mgf1(hash, db.length);

      // Mask DB: maskedDB = DB XOR dbMask
      const maskedDB = db.map((byte, i) => OpCodes.XorN(byte, dbMask[i]));

      // Set leftmost bits to zero (for key size modulo 8)
      const leftmostBits = 8 * keyBytes - this._keySize;
      if (leftmostBits > 0) {
        maskedDB[0] = OpCodes.AndN(maskedDB[0], OpCodes.Shr32(0xFF, leftmostBits));
      }

      // Create EM = maskedDB || H || 0xbc
      const result = [...maskedDB, ...hash, 0xbc];

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Verify PSS padding (simplified verification)
     * @returns {Array} Original message hash if valid
     */
    _verifyPadding() {
      const encodedMessage = this.inputBuffer;
      const keyBytes = this._keySize / 8;
      const hashLength = this._getHashLength();

      if (encodedMessage.length !== keyBytes) {
        throw new Error("Invalid encoded message length");
      }

      // Check rightmost byte is 0xbc
      if (encodedMessage[encodedMessage.length - 1] !== 0xbc) {
        throw new Error("Invalid PSS padding - wrong trailer byte");
      }

      // Extract components
      const maskedDB = encodedMessage.slice(0, keyBytes - hashLength - 1);
      const hash = encodedMessage.slice(keyBytes - hashLength - 1, keyBytes - 1);

      // Check leftmost bits are zero
      const leftmostBits = 8 * keyBytes - this._keySize;
      if (leftmostBits > 0 && OpCodes.AndN(maskedDB[0], OpCodes.Shl32(0xFF, (8 - leftmostBits))) !== 0) {
        throw new Error("Invalid PSS padding - leftmost bits not zero");
      }

      // Generate mask and recover DB
      const dbMask = this._mgf1(hash, maskedDB.length);
      const db = maskedDB.map((byte, i) => OpCodes.XorN(byte, dbMask[i]));

      // Set leftmost bits to zero in recovered DB
      if (leftmostBits > 0) {
        db[0] = OpCodes.AndN(db[0], OpCodes.Shr32(0xFF, leftmostBits));
      }

      // Find 0x01 separator
      let separatorIndex = -1;
      for (let i = 0; i < db.length; i++) {
        if (db[i] === 0x01) {
          separatorIndex = i;
          break;
        } else if (db[i] !== 0x00) {
          throw new Error("Invalid PSS padding - non-zero byte in PS");
        }
      }

      if (separatorIndex === -1) {
        throw new Error("Invalid PSS padding - separator not found");
      }

      // Extract salt
      const salt = db.slice(separatorIndex + 1);
      if (salt.length !== this._saltLength) {
        throw new Error("Invalid PSS padding - wrong salt length");
      }

      // For verification, we would need the original message hash
      // This simplified implementation just returns the hash from EM
      const result = hash;

      // Clear input buffer
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Get hash length based on hash function
     * @returns {number} Hash length in bytes
     */
    _getHashLength() {
      switch (this._hashFunction) {
        case 'SHA-1': return 20;
        case 'SHA-256': return 32;
        case 'SHA-384': return 48;
        case 'SHA-512': return 64;
        default: return 20; // Default to SHA-1
      }
    }

    /**
     * Simplified hash function (for educational purposes only)
     * @param {Array} data - Data to hash
     * @returns {Array} Hash value
     */
    _simpleHash(data) {
      const hashLength = this._getHashLength();
      const hash = new Array(hashLength).fill(0);

      // Simple hash: XOR all bytes with position-dependent transforms
      for (let i = 0; i < data.length; i++) {
        const pos = i % hash.length;
        hash[pos] = OpCodes.XorN(hash[pos], data[i]);
        hash[pos] = OpCodes.RotL8(hash[pos], 1); // Rotate left 1 bit
      }

      // Final mixing
      for (let i = 0; i < hash.length; i++) {
        hash[i] = OpCodes.XorN(hash[i], OpCodes.AndN((i * 17 + 91), 0xFF));
      }

      return hash;
    }

    /**
     * Simplified MGF1 mask generation function
     * @param {Array} seed - Seed for mask generation
     * @param {number} length - Desired mask length
     * @returns {Array} Generated mask
     */
    _mgf1(seed, length) {
      const mask = [];
      const hashLength = this._getHashLength();
      const iterations = Math.ceil(length / hashLength);

      for (let i = 0; i < iterations; i++) {
        // Create input: seed || I2OSP(i, 4)
        const counterBytes = OpCodes.Unpack32BE(i);
        const input = [...seed, ...counterBytes];
        const hashOutput = this._simpleHash(input);
        mask.push(...hashOutput);
      }

      return mask.slice(0, length);
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new PSSAlgorithm());

  // ===== EXPORTS =====

  return { PSSAlgorithm, PSSInstance };
}));