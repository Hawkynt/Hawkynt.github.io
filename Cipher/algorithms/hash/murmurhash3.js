
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

  /**
 * MurmurHash3Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class MurmurHash3Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MurmurHash3";
      this.description = "Fast non-cryptographic hash function with excellent distribution properties. Designed for hash tables, bloom filters, and general purpose hashing.";
      this.category = CategoryType.HASH;
      this.subCategory = "Fast Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Non-cryptographic
      this.complexity = ComplexityType.LOW;

      // Algorithm properties
      this.inventor = "Austin Appleby";
      this.year = 2008;
      this.country = CountryCode.US;

      // Hash-specific properties
      this.SupportedOutputSizes = [new KeySize(4, 4, 1)]; // 32 bits = 4 bytes
      this.outputSize = 4; // 32 bits = 4 bytes
      this.blockSize = 4; // Process in 4-byte chunks

      // Documentation
      this.documentation = [
        new LinkItem("MurmurHash3 Original Repository", "https://github.com/aappleby/MurmurHash"),
        new LinkItem("SMHasher Test Suite", "https://github.com/aappleby/smhasher"),
        new LinkItem("Wikipedia MurmurHash", "https://en.wikipedia.org/wiki/MurmurHash")
      ];

      this.references = [
        new LinkItem("smhasher (MurmurHash3.cpp reference implementation)", "https://github.com/aappleby/smhasher")
      ];

      // Test vectors (official MurmurHash3 test vectors with seed 0)
      this.tests = [
        {
          text: "MurmurHash3 Empty String",
          uri: "https://github.com/aappleby/smhasher",
          input: [],
          expected: OpCodes.Hex8ToBytes("00000000")
        },
        {
          text: "MurmurHash3 Single character 'a'",
          uri: "https://github.com/aappleby/smhasher",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("3c2569b2")
        },
        {
          text: "MurmurHash3 Short string 'abc'",
          uri: "https://github.com/aappleby/smhasher",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes("b3dd93fa")
        }
      ];
    }

    /**
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
   * @returns {MurmurHash3Instance} New hash instance
   */

    CreateInstance(isInverse = false) {
      return new MurmurHash3Instance(this, isInverse);
    }
  }

  /**
 * MurmurHash3 instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class MurmurHash3Instance extends IHashFunctionInstance {
    /**
   * Initialize a MurmurHash3 instance
   * @param {MurmurHash3Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 4; // 32 bits = 4 bytes

      // MurmurHash3 32-bit constants (official values)
      /** @type {uint32} */
      this.c1 = 0xcc9e2d51;
      /** @type {uint32} */
      this.c2 = 0x1b873593;
      /** @type {int32} */
      this.r1 = 15;
      /** @type {int32} */
      this.r2 = 13;
      /** @type {uint32} */
      this.m = 5;
      /** @type {uint32} */
      this.n = 0xe6546b64;

      /** @type {uint32} */
      this.seed = 0;
      /** @type {uint8[]} */
      this._inputData = [];
    }

    /**
     * Reset the seed
     * @returns {boolean} Always true
     */
    Init() {
      this.seed = 0;
      return true;
    }

    /**
     * Read a 32-bit little-endian value from a byte array
     * @param {uint8[]} data - Source bytes
     * @param {int32} offset - Index of the first byte
     * @returns {uint32} The value, or 0 when fewer than four bytes remain
     */
    readLE32(data, offset) {
      if (offset + 4 > data.length) return 0;
      return OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }

    /**
     * MurmurHash3 x86 32-bit (official specification)
     * @param {uint8[]} input - Message bytes
     * @param {uint32} seed - Hash seed
     * @returns {uint32} Hash value
     */
    murmurHash32(input, seed) {
      const len = input.length;
      let h1 = OpCodes.Shr32(seed, 0);  // Ensure unsigned 32-bit
      let offset = 0;

      // Process 4-byte chunks
      while (offset + 4 <= len) {
        let k1 = this.readLE32(input, offset);

        // Apply MurmurHash3 mixing function
        k1 = OpCodes.Mul32(k1, this.c1);
        k1 = OpCodes.RotL32(k1, this.r1);
        k1 = OpCodes.Mul32(k1, this.c2);

        h1 = OpCodes.Xor32(h1, k1);
        h1 = OpCodes.RotL32(h1, this.r2);
        h1 = OpCodes.Add32(OpCodes.Mul32(h1, this.m), this.n);

        offset += 4;
      }

      // Handle remaining bytes (1-3 bytes)
      /** @type {uint32} */
      let k1 = 0;
      const remaining = OpCodes.And32(len, 3); // len % 4

      if (remaining >= 3) k1 = OpCodes.Xor32(k1, OpCodes.Shl32(input[offset + 2], 16));
      if (remaining >= 2) k1 = OpCodes.Xor32(k1, OpCodes.Shl32(input[offset + 1], 8));
      if (remaining >= 1) {
        k1 = OpCodes.Xor32(k1, input[offset]);
        k1 = OpCodes.Mul32(k1, this.c1);
        k1 = OpCodes.RotL32(k1, this.r1);
        k1 = OpCodes.Mul32(k1, this.c2);
        h1 = OpCodes.Xor32(h1, k1);
      }

      // Finalization
      h1 = OpCodes.Xor32(h1, len);

      // Apply final mixing (avalanche)
      h1 = OpCodes.Xor32(h1, OpCodes.Shr32(h1, 16));
      h1 = OpCodes.Mul32(h1, 0x85ebca6b);
      h1 = OpCodes.Xor32(h1, OpCodes.Shr32(h1, 13));
      h1 = OpCodes.Mul32(h1, 0xc2b2ae35);
      h1 = OpCodes.Xor32(h1, OpCodes.Shr32(h1, 16));

      return h1;
    }

    /**
     * Hash a byte array with the current seed
     * @param {uint8[]} input - Message bytes (null hashes the empty message)
     * @returns {uint8[]} 4-byte big-endian digest
     */
    Hash(input) {
      if (!input || input.length === 0) {
        // Handle empty input
        const hash = this.murmurHash32([], this.seed);
        return OpCodes.Unpack32BE(hash);
      }

      const hash = this.murmurHash32(input, this.seed);
      return OpCodes.Unpack32BE(hash);
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {uint8[]} data - Input data as byte array
     */
    Feed(data) {
      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it, so Feed(a); Feed(b) hashes the same bytes as
      // Feed(a || b). Update carries the same obligation.
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {uint8[]} Hash digest as byte array
     */
    Result() {
      return this.Hash(this._inputData);
    }

    /**
     * Append message bytes
     * @param {uint8[]} data - Bytes to append
     */
    Update(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this._inputData.push(data[i]);
    }

    /**
     * Digest of everything fed so far
     * @returns {uint8[]} Hash digest as byte array
     */
    Final() {
      return this.Hash(this._inputData);
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Hash digest as byte array
     */
    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MurmurHash3 is a one-way hash function - decryption not possible');
    }

    /**
     * Forget the seed and all fed data
     */
    ClearData() {
      this.seed = 0;
      this._inputData = [];
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new MurmurHash3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MurmurHash3Algorithm, MurmurHash3Instance };
}));