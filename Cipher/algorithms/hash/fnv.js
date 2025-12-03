

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

  // FNV-1a 32-bit constants
  const FNV_32_PRIME = 16777619;      // 0x01000193
  const FNV_32_OFFSET_BASIS = 2166136261; // 0x811c9dc5

  /**
 * FNVAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class FNVAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FNV-1a";
      this.description = "FNV-1a is a fast non-cryptographic hash function with good distribution properties. It uses simple multiply and XOR operations for high performance.";
      this.inventor = "Glenn Fowler, Landon Curt Noll, Phong Vo";
      this.year = 1991;
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BASIC;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [4]; // 32 bits = 4 bytes

      // Performance and technical specifications
      this.blockSize = 1; // Processes one byte at a time
      this.outputSize = 4; // 32 bits = 4 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("FNV Hash Official Website", "http://www.isthe.com/chongo/tech/comp/fnv/index.html"),
        new LinkItem("FNV Hash Specification", "http://www.isthe.com/chongo/tech/comp/fnv/"),
        new LinkItem("Wikipedia FNV Hash", "https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function")
      ];

      this.references = [
        new LinkItem("FNV Reference Implementation", "http://www.isthe.com/chongo/src/fnv/"),
        new LinkItem("Hash Function Performance Tests", "https://github.com/aappleby/smhasher")
      ];

      // Test vectors from FNV specification
      this.tests = [
        {
          text: "FNV-1a Test Vector - Empty string",
          uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
          input: [],
          expected: OpCodes.Hex8ToBytes("811c9dc5")
        },
        {
          text: "FNV-1a Test Vector - 'a'",
          uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("e40c292c")
        },
        {
          text: "FNV-1a Test Vector - 'foobar'",
          uri: "http://www.isthe.com/chongo/tech/comp/fnv/",
          input: OpCodes.AnsiToBytes("foobar"),
          expected: OpCodes.Hex8ToBytes("bf9cf968")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FNVAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * FNVAlgorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FNVAlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 4; // 32 bits = 4 bytes

      // FNV state
      this._buffer = [];
      this._length = 0;
    }

    /**
     * Initialize the hash state
     */
    Init() {
      this._buffer = [];
      this._length = 0;
    }

    /**
     * Add data to the hash calculation
     * @param {Array} data - Data to hash as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this._buffer = this._buffer.concat(Array.from(data));
      this._length += data.length;
    }

    /**
     * Finalize the hash calculation and return result as byte array
     * @returns {Array} Hash digest as byte array
     */
    Final() {
      return this._computeFNV1a(this._buffer);
    }

    /**
     * Hash a complete message in one operation
     * @param {Array} message - Message to hash as byte array
     * @returns {Array} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Core FNV-1a computation
     * @param {Array} data - Input data as byte array
     * @returns {Array} FNV-1a hash digest
     */
    _computeFNV1a(data) {
      const bytes = Array.isArray(data) ? data : OpCodes.AnsiToBytes(data);
      let hash = FNV_32_OFFSET_BASIS;

      for (let i = 0; i < bytes.length; i++) {
        // FNV-1a: XOR byte first, then multiply
        hash = OpCodes.ToUint32(OpCodes.XorN(hash, OpCodes.AndN(bytes[i], 0xFF)));
        hash = OpCodes.ToUint32(Math.imul(hash, FNV_32_PRIME));
      }

      // Return as 4-byte array using OpCodes
      return OpCodes.Unpack32BE(hash);
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('FNV-1a is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      if (!this._buffer) this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      return this.Final();
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new FNVAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FNVAlgorithm, FNVAlgorithmInstance };
}));