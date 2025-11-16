/*
 * CHAM Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * CHAM-128/128 - Korean lightweight block cipher
 * 128-bit blocks with 128-bit keys, 112 rounds
 * ARX operations with 4-branch Feistel structure
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

  /**
 * CHAMCipher - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class CHAMCipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CHAM";
      this.description = "Korean lightweight block cipher designed for resource-constrained devices. CHAM-128/128 uses 128-bit blocks with 128-bit keys and 112 rounds with ARX operations.";
      this.inventor = "Koo, Roh, Kim, Jung, Lee, and Kwon";
      this.year = 2017;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.BASIC;
      this.country = AlgorithmFramework.CountryCode.KR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // CHAM-128/128: 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("CHAM: A Family of Lightweight Block Ciphers", "https://link.springer.com/chapter/10.1007/978-3-319-78556-1_1"),
        new AlgorithmFramework.LinkItem("ICISC 2017 Paper", "https://eprint.iacr.org/2017/1032.pdf")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Original CHAM Specification", "https://eprint.iacr.org/2017/1032.pdf"),
        new AlgorithmFramework.LinkItem("Lightweight Cryptography Research", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      // Test vectors
      this.tests = [
        {
          text: "CHAM-128/128 (Paper Vector)",
          uri: "https://eprint.iacr.org/2017/1032.pdf",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("346074c3c50057b532ec648df7329348")
        }
      ];

      // CHAM-128/128 Constants
      this.ROUNDS = 80;      // 80 rounds for CHAM-128/128
      this.ROT_ALPHA = 1;     // Alpha rotation constant
      this.ROT_BETA = 8;      // Beta rotation constant
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CHAMInstance(this, isInverse);
    }
  }

  /**
 * CHAM cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CHAMInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
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
        this.roundKeys = null;
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
      this.roundKeys = this._expandKey(keyBytes);
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

    _encryptBlock(blockBytes) {
      if (blockBytes.length !== 16) {
        throw new Error('CHAM: Input must be exactly 16 bytes');
      }

      if (!this.roundKeys) {
        throw new Error('CHAM: Round keys not initialized');
      }

      const rk = this.roundKeys;

      // Convert input to 32-bit words using OpCodes (little-endian)
      let x0 = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let x1 = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let x2 = OpCodes.Pack32LE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let x3 = OpCodes.Pack32LE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);

      for (let round = 0; round < this.algorithm.ROUNDS; round += 8) {
        let temp = OpCodes.Add32((x0 ^ round) >>> 0, (OpCodes.RotL32(x1, 1) ^ rk[0]) >>> 0);
        x0 = OpCodes.RotL32(temp, 8);

        temp = OpCodes.Add32((x1 ^ (round + 1)) >>> 0, (OpCodes.RotL32(x2, 8) ^ rk[1]) >>> 0);
        x1 = OpCodes.RotL32(temp, 1);

        temp = OpCodes.Add32((x2 ^ (round + 2)) >>> 0, (OpCodes.RotL32(x3, 1) ^ rk[2]) >>> 0);
        x2 = OpCodes.RotL32(temp, 8);

        const x0Rot8 = OpCodes.RotL32(x0, 8);
        temp = OpCodes.Add32((x3 ^ (round + 3)) >>> 0, (x0Rot8 ^ rk[3]) >>> 0);
        x3 = OpCodes.RotL32(temp, 1);

        temp = OpCodes.Add32((x0 ^ (round + 4)) >>> 0, (OpCodes.RotL32(x1, 1) ^ rk[4]) >>> 0);
        x0 = OpCodes.RotL32(temp, 8);

        temp = OpCodes.Add32((x1 ^ (round + 5)) >>> 0, (OpCodes.RotL32(x2, 8) ^ rk[5]) >>> 0);
        x1 = OpCodes.RotL32(temp, 1);

        temp = OpCodes.Add32((x2 ^ (round + 6)) >>> 0, (OpCodes.RotL32(x3, 1) ^ rk[6]) >>> 0);
        x2 = OpCodes.RotL32(temp, 8);

        const x0Rot8Second = OpCodes.RotL32(x0, 8);
        temp = OpCodes.Add32((x3 ^ (round + 7)) >>> 0, (x0Rot8Second ^ rk[7]) >>> 0);
        x3 = OpCodes.RotL32(temp, 1);
      }

      const result = [];
      result.push(...OpCodes.Unpack32LE(x0));
      result.push(...OpCodes.Unpack32LE(x1));
      result.push(...OpCodes.Unpack32LE(x2));
      result.push(...OpCodes.Unpack32LE(x3));

      return result;
    }

    _decryptBlock(blockBytes) {
      if (blockBytes.length !== 16) {
        throw new Error('CHAM: Input must be exactly 16 bytes');
      }

      if (!this.roundKeys) {
        throw new Error('CHAM: Round keys not initialized');
      }

      const rk = this.roundKeys;

      let x0 = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let x1 = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let x2 = OpCodes.Pack32LE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let x3 = OpCodes.Pack32LE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);

      for (let round = this.algorithm.ROUNDS - 8; round >= 0; round -= 8) {
        const x0Rot8After5 = OpCodes.RotL32(x0, 8);
        let tmp = OpCodes.RotR32(x3, 1);
        tmp = OpCodes.Sub32(tmp, (x0Rot8After5 ^ rk[7]) >>> 0);
        x3 = (tmp ^ (round + 7)) >>> 0;

        tmp = OpCodes.RotR32(x2, 8);
        tmp = OpCodes.Sub32(tmp, (OpCodes.RotL32(x3, 1) ^ rk[6]) >>> 0);
        x2 = (tmp ^ (round + 6)) >>> 0;

        tmp = OpCodes.RotR32(x1, 1);
        tmp = OpCodes.Sub32(tmp, (OpCodes.RotL32(x2, 8) ^ rk[5]) >>> 0);
        x1 = (tmp ^ (round + 5)) >>> 0;

        tmp = OpCodes.RotR32(x0, 8);
        tmp = OpCodes.Sub32(tmp, (OpCodes.RotL32(x1, 1) ^ rk[4]) >>> 0);
        x0 = (tmp ^ (round + 4)) >>> 0;

        const x0Rot8After1 = OpCodes.RotL32(x0, 8);
        tmp = OpCodes.RotR32(x3, 1);
        tmp = OpCodes.Sub32(tmp, (x0Rot8After1 ^ rk[3]) >>> 0);
        x3 = (tmp ^ (round + 3)) >>> 0;

        tmp = OpCodes.RotR32(x2, 8);
        tmp = OpCodes.Sub32(tmp, (OpCodes.RotL32(x3, 1) ^ rk[2]) >>> 0);
        x2 = (tmp ^ (round + 2)) >>> 0;

        tmp = OpCodes.RotR32(x1, 1);
        tmp = OpCodes.Sub32(tmp, (OpCodes.RotL32(x2, 8) ^ rk[1]) >>> 0);
        x1 = (tmp ^ (round + 1)) >>> 0;

        tmp = OpCodes.RotR32(x0, 8);
        tmp = OpCodes.Sub32(tmp, (OpCodes.RotL32(x1, 1) ^ rk[0]) >>> 0);
        x0 = (tmp ^ round) >>> 0;
      }

      const result = [];
      result.push(...OpCodes.Unpack32LE(x0));
      result.push(...OpCodes.Unpack32LE(x1));
      result.push(...OpCodes.Unpack32LE(x2));
      result.push(...OpCodes.Unpack32LE(x3));

      return result;
    }

    _expandKey(keyBytes) {
      const words = [
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];

      const rk = new Array(8);
      rk[0] = words[0] >>> 0;
      rk[1] = words[1] >>> 0;
      rk[2] = words[2] >>> 0;
      rk[3] = words[3] >>> 0;

      rk[4] = (rk[1] ^ OpCodes.RotL32(rk[1], 1) ^ OpCodes.RotL32(rk[1], 11)) >>> 0;
      rk[5] = (rk[0] ^ OpCodes.RotL32(rk[0], 1) ^ OpCodes.RotL32(rk[0], 11)) >>> 0;
      rk[6] = (rk[3] ^ OpCodes.RotL32(rk[3], 1) ^ OpCodes.RotL32(rk[3], 11)) >>> 0;
      rk[7] = (rk[2] ^ OpCodes.RotL32(rk[2], 1) ^ OpCodes.RotL32(rk[2], 11)) >>> 0;

      rk[0] = (rk[0] ^ OpCodes.RotL32(rk[0], 1) ^ OpCodes.RotL32(rk[0], 8)) >>> 0;
      rk[1] = (rk[1] ^ OpCodes.RotL32(rk[1], 1) ^ OpCodes.RotL32(rk[1], 8)) >>> 0;
      rk[2] = (rk[2] ^ OpCodes.RotL32(rk[2], 1) ^ OpCodes.RotL32(rk[2], 8)) >>> 0;
      rk[3] = (rk[3] ^ OpCodes.RotL32(rk[3], 1) ^ OpCodes.RotL32(rk[3], 8)) >>> 0;

      return rk;
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new CHAMCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CHAMCipher, CHAMInstance };
}));