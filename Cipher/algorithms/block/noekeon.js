/*
 * NOEKEON Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NOEKEON - NESSIE 128-bit block cipher
 * 128-bit blocks with 128-bit keys, 16 rounds
 * Direct Key Mode implementation
 */

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
 * NOEKEONCipher - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class NOEKEONCipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "NOEKEON";
      this.description = "NESSIE 128-bit block cipher designed by Joan Daemen, Michaël Peeters, Gilles Van Assche and Vincent Rijmen. Direct Key Mode implementation for efficiency.";
      this.inventor = "Joan Daemen, Michaël Peeters, Gilles Van Assche, Vincent Rijmen";
      this.year = 2000;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.BE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // NOEKEON: 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("NOEKEON Specification", "https://gro.noekeon.org/"),
        new AlgorithmFramework.LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Original NOEKEON Paper", "https://gro.noekeon.org/Noekeon-spec.pdf"),
        new AlgorithmFramework.LinkItem("NESSIE Final Report", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      // Test vectors from NESSIE
      this.tests = [
        {
          text: "NOEKEON Zero Test Vector",
          uri: "https://gro.noekeon.org/",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("b1656851699e29fa24b70148503d2dfc")
        },
        {
          text: "NOEKEON Pattern Test Vector",
          uri: "https://gro.noekeon.org/",
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("2a78421b87c7d0924f26113f1d1349b2")
        }
      ];

      // NOEKEON Constants
      this.ROUNDS = 16;                     // 16 rounds
      this.RC1_ENCRYPT_START = 0x80;        // Round constant start for encryption
      
      // Predefined round constants (matching C# BouncyCastle implementation)
      this.ROUND_CONSTANTS = [0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e,
                             0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new NOEKEONInstance(this, isInverse);
    }
  }

  /**
 * NOEKEON cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class NOEKEONInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.keyWords = null;
      this.inputBuffer = [];
      this.outputBuffer = [];
      this.BlockSize = 16;    // 128-bit blocks
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keyWords = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.keyWords = this._convertKeyToWords(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);

      // Process complete blocks
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        this.outputBuffer.push(...processed);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */
    Result() {
      const result = [...this.outputBuffer];
      this.outputBuffer = [];
      return result;
    }

    Reset() {
      this.inputBuffer = [];
      this.outputBuffer = [];
    }

    _convertKeyToWords(keyBytes) {
      // Direct mode NOEKEON - use cipher key directly as working key
      const keyWords = new Array(4);
      for (let i = 0; i < 4; i++) {
        const offset = i * 4;
        keyWords[i] = OpCodes.Pack32BE(
          keyBytes[offset],
          keyBytes[offset + 1],
          keyBytes[offset + 2],
          keyBytes[offset + 3]
        );
      }

      // For decryption, apply theta(k, {0,0,0,0}) to the key (matching C# BouncyCastle)
      if (this.isInverse) {
        let a0 = keyWords[0], a1 = keyWords[1], a2 = keyWords[2], a3 = keyWords[3];

        let t02 = a0 ^ a2;
        t02 ^= OpCodes.RotL32(t02, 8) ^ OpCodes.RotL32(t02, 24);

        let t13 = a1 ^ a3;
        t13 ^= OpCodes.RotL32(t13, 8) ^ OpCodes.RotL32(t13, 24);

        a0 ^= t13;
        a1 ^= t02;
        a2 ^= t13;
        a3 ^= t02;

        keyWords[0] = a0; keyWords[1] = a1; keyWords[2] = a2; keyWords[3] = a3;
      }

      return keyWords;
    }

    _encryptBlock(blockBytes) {
      if (blockBytes.length !== 16) {
        throw new Error('NOEKEON: Input must be exactly 16 bytes');
      }

      // Convert input to 32-bit words using OpCodes (big-endian)
      let a0 = OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let a1 = OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let a2 = OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let a3 = OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);

      const k0 = this.keyWords[0], k1 = this.keyWords[1], k2 = this.keyWords[2], k3 = this.keyWords[3];

      let round = 0;
      for (;;) {
        a0 ^= this.algorithm.ROUND_CONSTANTS[round];

        // theta(a, k);
        let t02 = a0 ^ a2;
        t02 ^= OpCodes.RotL32(t02, 8) ^ OpCodes.RotL32(t02, 24);

        a0 ^= k0;
        a1 ^= k1;
        a2 ^= k2;
        a3 ^= k3;

        let t13 = a1 ^ a3;
        t13 ^= OpCodes.RotL32(t13, 8) ^ OpCodes.RotL32(t13, 24);

        a0 ^= t13;
        a1 ^= t02;
        a2 ^= t13;
        a3 ^= t02;

        if (++round > 16) {
          break;
        }

        // pi1(a);
        a1 = OpCodes.RotL32(a1, 1);
        a2 = OpCodes.RotL32(a2, 5);
        a3 = OpCodes.RotL32(a3, 2);

        // gamma(a);
        const state = [a0, a1, a2, a3];
        this._gamma(state);
        a0 = state[0]; a1 = state[1]; a2 = state[2]; a3 = state[3];

        // pi2(a);
        a1 = OpCodes.RotL32(a1, 31);
        a2 = OpCodes.RotL32(a2, 27);
        a3 = OpCodes.RotL32(a3, 30);
      }

      // Convert back to bytes using OpCodes (big-endian)
      const result = [];
      result.push(...OpCodes.Unpack32BE(a0));
      result.push(...OpCodes.Unpack32BE(a1));
      result.push(...OpCodes.Unpack32BE(a2));
      result.push(...OpCodes.Unpack32BE(a3));

      return result;
    }

    _decryptBlock(blockBytes) {
      if (blockBytes.length !== 16) {
        throw new Error('NOEKEON: Input must be exactly 16 bytes');
      }

      // Convert input to 32-bit words using OpCodes (big-endian)
      let a0 = OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let a1 = OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let a2 = OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let a3 = OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);

      const k0 = this.keyWords[0], k1 = this.keyWords[1], k2 = this.keyWords[2], k3 = this.keyWords[3];

      let round = 16;
      for (;;) {
        // theta(a, k);
        let t02 = a0 ^ a2;
        t02 ^= OpCodes.RotL32(t02, 8) ^ OpCodes.RotL32(t02, 24);

        a0 ^= k0;
        a1 ^= k1;
        a2 ^= k2;
        a3 ^= k3;

        let t13 = a1 ^ a3;
        t13 ^= OpCodes.RotL32(t13, 8) ^ OpCodes.RotL32(t13, 24);

        a0 ^= t13;
        a1 ^= t02;
        a2 ^= t13;
        a3 ^= t02;

        a0 ^= this.algorithm.ROUND_CONSTANTS[round];

        if (--round < 0) {
          break;
        }

        // pi1(a);
        a1 = OpCodes.RotL32(a1, 1);
        a2 = OpCodes.RotL32(a2, 5);
        a3 = OpCodes.RotL32(a3, 2);

        // gamma(a);
        const state = [a0, a1, a2, a3];
        this._gamma(state);
        a0 = state[0]; a1 = state[1]; a2 = state[2]; a3 = state[3];

        // pi2(a);
        a1 = OpCodes.RotL32(a1, 31);
        a2 = OpCodes.RotL32(a2, 27);
        a3 = OpCodes.RotL32(a3, 30);
      }

      // Convert back to bytes using OpCodes (big-endian)
      const result = [];
      result.push(...OpCodes.Unpack32BE(a0));
      result.push(...OpCodes.Unpack32BE(a1));
      result.push(...OpCodes.Unpack32BE(a2));
      result.push(...OpCodes.Unpack32BE(a3));

      return result;
    }

    // NOEKEON Gamma function (matching C# BouncyCastle implementation)
    _gamma(a) {
      const t = a[3];
      a[1] ^= a[3] | a[2];
      a[3] = a[0] ^ (a[2] & (~a[1]));

      a[2] = t ^ (~a[1]) ^ a[2] ^ a[3];

      a[1] ^= a[3] | a[2];
      a[0] = t ^ (a[2] & a[1]);
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new NOEKEONCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NOEKEONCipher, NOEKEONInstance };
}));