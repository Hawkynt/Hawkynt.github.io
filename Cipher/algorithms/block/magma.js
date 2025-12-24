/*
 * Magma (GOST R 34.12-2015) - Russian Federal Block Cipher Standard
 * Professional implementation following RFC 8891 specification
 * (c)2006-2025 Hawkynt
 *
 * Magma is a 64-bit block cipher with 256-bit keys,  an updated version of
 * the GOST 28147-89 cipher. It uses a 32-round Feistel network structure
 * with substitution boxes (S-boxes) and a simple rotation operation.
 *
 * Approved by Decree #749 of the Russian Federal Agency on Technical
 * Regulating and Metrology on June 19, 2015. Standardized in RFC 8891.
 *
 * Security: Modern replacement for the older GOST 28147-89 (RFC 5830).
 * Structure: Feistel network with 32 rounds, uses mod OpCodes.Xor32(2, 32) addition and
 *            11-bit rotation after S-box substitution.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc8891
 * Standard: GOST R 34.12-2015
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // S-boxes (substitution tables) from RFC 8891 Section 4.1
  // id-tc26-gost-28147-param-Z S-box set
  const SBOX = [
    [12, 4, 6, 2, 10, 5, 11, 9, 14, 8, 13, 7, 0, 3, 15, 1],
    [6, 8, 2, 3, 9, 10, 5, 12, 1, 14, 4, 7, 11, 13, 0, 15],
    [11, 3, 5, 8, 2, 15, 10, 13, 14, 1, 7, 4, 12, 9, 6, 0],
    [12, 8, 2, 1, 13, 4, 15, 6, 7, 0, 10, 5, 3, 14, 9, 11],
    [7, 15, 5, 10, 8, 1, 6, 13, 0, 9, 3, 14, 11, 4, 2, 12],
    [5, 13, 15, 6, 9, 2, 12, 10, 11, 7, 8, 1, 4, 3, 14, 0],
    [8, 14, 2, 5, 6, 9, 1, 12, 15, 4, 11, 0, 13, 10, 3, 7],
    [1, 7, 14, 13, 0, 5, 8, 3, 4, 15, 10, 6, 9, 12, 11, 2]
  ];

  // Transformation t: apply S-boxes to 32-bit value (RFC 8891 Section 4.1)
  function transformT(input) {
    let output = 0;
    for (let i = 0; i < 8; ++i) {
      const nibble = OpCodes.AndN(OpCodes.Shr32(input, 4 * i), 0x0F);
      const substituted = SBOX[i][nibble];
      output = OpCodes.OrN(output, OpCodes.Shl32(substituted, 4 * i));
    }
    return OpCodes.Shr32(output, 0);
  }

  // Transformation g: t followed by 11-bit left rotation (RFC 8891 Section 4.1)
  function transformG(k, a) {
    const sum = OpCodes.Shr32(k + a, 0); // Addition modulo OpCodes.Xor32(2, 32)
    const afterT = transformT(sum);
    return OpCodes.RotL32(afterT, 11);
  }

  // Key schedule: generates 32 round keys from 256-bit key
  function keySchedule(key) {
    const keys = new Array(32);

    // Split 256-bit key into eight 32-bit words (big-endian per RFC 8891)
    const K = new Array(8);
    for (let i = 0; i < 8; ++i) {
      K[i] = OpCodes.Pack32BE(
        key[4 * i],
        key[4 * i + 1],
        key[4 * i + 2],
        key[4 * i + 3]
      );
    }

    // Encryption key schedule (RFC 8891 Section 5.1):
    // K_1..K_24 use keys in order (3 repetitions of K_1..K_8)
    // K_25..K_32 use keys in reverse order (K_8..K_1)
    for (let i = 0; i < 24; ++i) {
      keys[i] = K[i % 8];
    }
    for (let i = 0; i < 8; ++i) {
      keys[24 + i] = K[7 - i];
    }

    return keys;
  }

  // Decryption key schedule (reverse of encryption)
  function decryptionKeySchedule(key) {
    const keys = new Array(32);

    // Split key into eight 32-bit words (big-endian per RFC 8891)
    const K = new Array(8);
    for (let i = 0; i < 8; ++i) {
      K[i] = OpCodes.Pack32BE(
        key[4 * i],
        key[4 * i + 1],
        key[4 * i + 2],
        key[4 * i + 3]
      );
    }

    // Decryption key schedule (RFC 8891 Section 5.2):
    // K_1..K_8 use keys in order
    // K_9..K_32 use keys in reverse order (3 repetitions of K_8..K_1)
    for (let i = 0; i < 8; ++i) {
      keys[i] = K[i];
    }
    for (let i = 0; i < 24; ++i) {
      keys[8 + i] = K[7 - (i % 8)];
    }

    return keys;
  }

  /**
 * Magma - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Magma extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Magma";
      this.description = "Russian Federal block cipher standard GOST R 34.12-2015 with 64-bit blocks and 256-bit keys. Updated version of GOST 28147-89 using a 32-round Feistel network. Standardized in RFC 8891.";
      this.inventor = "Russian Federal Security Service";
      this.year = 2015;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 1)]; // 256-bit keys only
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit blocks only

      this.documentation = [
        new LinkItem("RFC 8891 - GOST R 34.12-2015 Magma Specification", "https://datatracker.ietf.org/doc/html/rfc8891"),
        new LinkItem("GOST R 34.12-2015 Standard", "https://tc26.ru/en/standards/"),
        new LinkItem("Wikipedia - GOST (block cipher)", "https://en.wikipedia.org/wiki/GOST_(block_cipher)")
      ];

      // Official test vectors from RFC 8891 Sections 5.1, 5.2
      this.tests = [
        {
          text: "RFC 8891 Section 5.1 - Encryption Test Vector",
          uri: "https://datatracker.ietf.org/doc/html/rfc8891#section-5.1",
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          expected: OpCodes.Hex8ToBytes("4ee901e5c2d8ca3d")
        },
        {
          text: "RFC 8891 Section 5.2 - Decryption Test Vector",
          uri: "https://datatracker.ietf.org/doc/html/rfc8891#section-5.2",
          input: OpCodes.Hex8ToBytes("4ee901e5c2d8ca3d"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          expected: OpCodes.Hex8ToBytes("fedcba9876543210"),
          inverse: true
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MagmaInstance(this, isInverse);
    }
  }

  /**
 * Magma cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MagmaInstance extends IBlockCipherInstance {
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
      this._roundKeys = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._roundKeys = null;
        return;
      }

      if (keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 32 bytes)`);
      }

      this._key = [...keyBytes];
      this._roundKeys = this.isInverse ?
        decryptionKeySchedule(new Uint8Array(this._key)) :
        keySchedule(new Uint8Array(this._key));
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
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 8 !== 0) {
        throw new Error(`Invalid input length: ${this.inputBuffer.length} bytes (must be multiple of 8)`);
      }

      const output = [];
      const numBlocks = this.inputBuffer.length / 8;

      for (let b = 0; b < numBlocks; ++b) {
        const block = this.inputBuffer.slice(b * 8, (b + 1) * 8);
        const processed = this.processBlock(block);
        output.push(...processed);
      }

      this.inputBuffer = [];
      return output;
    }

    processBlock(block) {
      // RFC 8891: block is (a_1, a_0) where a_1 is first 32 bits, a_0 is last 32 bits
      // Load as big-endian 32-bit words per RFC 8891
      let a1 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let a0 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // Apply 31 rounds of G transformation: G[k](a_1, a_0) = (a_0, g[k](a_0) XOR a_1)
      for (let i = 0; i < 31; ++i) {
        const temp = a1;
        a1 = a0;
        a0 = OpCodes.XorN(transformG(this._roundKeys[i], a0), temp);
      }

      // Final round G*[k](a_1, a_0) = (g[k](a_0) XOR a_1, a_0)
      const finalOutput1 = OpCodes.XorN(transformG(this._roundKeys[31], a0), a1);
      const finalOutput0 = a0;

      // Convert back to bytes (big-endian per RFC 8891): output is (finalOutput1, finalOutput0)
      const result = new Array(8);
      const bytes1 = OpCodes.Unpack32BE(finalOutput1);
      const bytes0 = OpCodes.Unpack32BE(finalOutput0);

      result[0] = bytes1[0];
      result[1] = bytes1[1];
      result[2] = bytes1[2];
      result[3] = bytes1[3];
      result[4] = bytes0[0];
      result[5] = bytes0[1];
      result[6] = bytes0[2];
      result[7] = bytes0[3];

      return result;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Magma());

  return Magma;
}));
