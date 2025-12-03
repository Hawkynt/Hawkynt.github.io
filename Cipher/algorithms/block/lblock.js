/*
 * LBlock - Lightweight Block Cipher
 * Professional implementation following ACNS 2011 specification
 * (c)2006-2025 Hawkynt
 *
 * LBlock is a 64-bit block cipher with 80-bit keys designed for
 * resource-constrained environments. It uses a 32-round Feistel
 * network with 10 different 4-bit S-boxes.
 *
 * Published: Applied Cryptography and Network Security (ACNS) 2011
 * Authors: Wenling Wu, Lei Zhang
 *
 * Reference: https://eprint.iacr.org/2011/345
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

  // 10 S-boxes (4-bit to 4-bit substitution) from LBlock specification
  const SBOX = [
    [14, 9, 15, 0, 13, 4, 10, 11, 1, 2, 8, 3, 7, 6, 12, 5],     // S0
    [4, 11, 14, 9, 15, 13, 0, 10, 7, 12, 5, 6, 2, 8, 1, 3],     // S1
    [1, 14, 7, 12, 15, 13, 0, 6, 11, 5, 9, 3, 2, 4, 8, 10],     // S2
    [7, 6, 8, 11, 0, 15, 3, 14, 9, 10, 12, 13, 5, 2, 4, 1],     // S3
    [14, 5, 15, 0, 7, 2, 12, 13, 1, 8, 4, 9, 11, 10, 6, 3],     // S4
    [2, 13, 11, 12, 15, 14, 0, 9, 7, 10, 6, 3, 1, 8, 4, 5],     // S5
    [11, 9, 4, 14, 0, 15, 10, 13, 6, 12, 5, 7, 3, 8, 1, 2],     // S6
    [13, 10, 15, 0, 14, 4, 9, 11, 2, 1, 8, 3, 7, 5, 12, 6],     // S7
    [8, 7, 14, 5, 15, 13, 0, 6, 11, 12, 9, 10, 2, 4, 1, 3],     // S8
    [11, 5, 15, 0, 7, 2, 9, 13, 4, 8, 1, 12, 14, 10, 3, 6]      // S9
  ];

  // Key schedule - matches kmarquet/bloc C implementation
  function keySchedule(key) {
    const roundKeys = [];
    const k = new Array(10); // 10 bytes (80 bits)

    // Copy initial key
    for (let i = 0; i < 10; ++i) {
      k[i] = key[i];
    }

    // First round key (round 0)
    roundKeys[0] = [k[6], k[7], k[8], k[9]];

    // Generate remaining 31 round keys
    for (let i = 1; i < 32; ++i) {
      // K <<< 29 (rotate left by 29 bits)
      const keyR = [k[6], k[7], k[8], k[9]];

      k[9] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[6], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(k[5], 0xF8), 3), 0x1F));
      k[8] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[5], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(k[4], 0xF8), 3), 0x1F));
      k[7] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[4], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(k[3], 0xF8), 3), 0x1F));
      k[6] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[3], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(k[2], 0xF8), 3), 0x1F));
      k[5] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[2], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(k[1], 0xF8), 3), 0x1F));
      k[4] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[1], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(k[0], 0xF8), 3), 0x1F));
      k[3] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(k[0], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(keyR[3], 0xF8), 3), 0x1F));
      k[2] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(keyR[3], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(keyR[2], 0xF8), 3), 0x1F));
      k[1] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(keyR[2], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(keyR[1], 0xF8), 3), 0x1F));
      k[0] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shl8(OpCodes.AndN(keyR[1], 0x07), 5), 0xE0), OpCodes.AndN(OpCodes.Shr8(OpCodes.AndN(keyR[0], 0xF8), 3), 0x1F));

      // Apply S-boxes to k[9]
      k[9] = OpCodes.XorN(OpCodes.Shl8(SBOX[9][OpCodes.AndN(OpCodes.Shr8(k[9], 4), 0x0F)], 4), SBOX[8][OpCodes.AndN(k[9], 0x0F)]);

      // XOR with round constant
      k[6] = OpCodes.XorN(k[6], OpCodes.AndN(OpCodes.Shr32(i, 2), 0x07));
      k[5] = OpCodes.XorN(k[5], OpCodes.Shl8(OpCodes.AndN(i, 0x03), 6));

      // Extract round key
      roundKeys[i] = [k[6], k[7], k[8], k[9]];
    }

    return roundKeys;
  }

  // F function for round transformation
  function fFunction(rightHalf, roundKey) {
    // rightHalf is 4 bytes (32 bits)
    // roundKey is 4 bytes (32 bits)

    // Step 1: Key addition - XOR with round key
    const tmp = new Array(4);
    tmp[0] = OpCodes.XorN(rightHalf[0], roundKey[0]);
    tmp[1] = OpCodes.XorN(rightHalf[1], roundKey[1]);
    tmp[2] = OpCodes.XorN(rightHalf[2], roundKey[2]);
    tmp[3] = OpCodes.XorN(rightHalf[3], roundKey[3]);

    // Step 2: S-box substitution (2 S-boxes per byte)
    // Each byte: high nibble uses odd S-box, low nibble uses even S-box
    tmp[0] = OpCodes.XorN(OpCodes.Shl8(SBOX[1][OpCodes.AndN(OpCodes.Shr8(tmp[0], 4), 0x0F)], 4), SBOX[0][OpCodes.AndN(tmp[0], 0x0F)]);
    tmp[1] = OpCodes.XorN(OpCodes.Shl8(SBOX[3][OpCodes.AndN(OpCodes.Shr8(tmp[1], 4), 0x0F)], 4), SBOX[2][OpCodes.AndN(tmp[1], 0x0F)]);
    tmp[2] = OpCodes.XorN(OpCodes.Shl8(SBOX[5][OpCodes.AndN(OpCodes.Shr8(tmp[2], 4), 0x0F)], 4), SBOX[4][OpCodes.AndN(tmp[2], 0x0F)]);
    tmp[3] = OpCodes.XorN(OpCodes.Shl8(SBOX[7][OpCodes.AndN(OpCodes.Shr8(tmp[3], 4), 0x0F)], 4), SBOX[6][OpCodes.AndN(tmp[3], 0x0F)]);

    // Step 3: P-layer permutation (inline nibble swapping and XOR)
    const t = new Array(4);
    t[0] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shr8(tmp[0], 4), 0x0F), OpCodes.AndN(tmp[1], 0xF0));
    t[1] = OpCodes.XorN(OpCodes.AndN(tmp[0], 0x0F), OpCodes.Shl8(OpCodes.AndN(tmp[1], 0x0F), 4));
    t[2] = OpCodes.XorN(OpCodes.AndN(OpCodes.Shr8(tmp[2], 4), 0x0F), OpCodes.AndN(tmp[3], 0xF0));
    t[3] = OpCodes.XorN(OpCodes.AndN(tmp[2], 0x0F), OpCodes.Shl8(OpCodes.AndN(tmp[3], 0x0F), 4));

    return t;
  }

  /**
 * LBlock - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class LBlock extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "LBlock";
      this.description = "Lightweight 64-bit block cipher with 80-bit keys designed for resource-constrained environments. Uses 32-round Feistel network with 10 different 4-bit S-boxes. Optimized for both hardware and software implementations with low power consumption.";
      this.inventor = "Wenling Wu, Lei Zhang";
      this.year = 2011;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Lightweight Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CN;

      this.SupportedKeySizes = [new KeySize(10, 10, 1)]; // 80-bit keys only
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit blocks only

      this.documentation = [
        new LinkItem("LBlock Specification (ePrint Archive)", "https://eprint.iacr.org/2011/345"),
        new LinkItem("ACNS 2011 Paper (Springer)", "https://link.springer.com/chapter/10.1007/978-3-642-21554-4_19")
      ];

      // Test vectors from kmarquet/bloc reference C implementation
      // Note: Verified against https://github.com/kmarquet/bloc/blob/master/LBlock/LBlock.c
      this.tests = [
        {
          text: "LBlock-80 Test Vector #1 (all zeros, kmarquet/bloc verified)",
          uri: "https://github.com/kmarquet/bloc/blob/master/LBlock/LBlock.c",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("cd5be708531818c2")
        },
        {
          text: "LBlock-80 Test Vector #2 (kmarquet/bloc verified)",
          uri: "https://github.com/kmarquet/bloc/blob/master/LBlock/LBlock.c",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0123456789abcdeffedc"),
          expected: OpCodes.Hex8ToBytes("17e7c48e9678327e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LBlockInstance(this, isInverse);
    }
  }

  /**
 * LBlock cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LBlockInstance extends IBlockCipherInstance {
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

      if (keyBytes.length !== 10) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 10 bytes)`);
      }

      this._key = [...keyBytes];
      this._roundKeys = keySchedule(new Uint8Array(this._key));
      // Note: round keys are used in reverse order during decryption,
      // but we don't reverse them here - the processBlock handles it
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
      // Block layout: x[0..3] = LEFT half, x[4..7] = RIGHT half
      const x = [...block];

      if (this.isInverse) {
        // Decryption: apply rounds in reverse order
        this.oneRoundInv(x, this._roundKeys[31]);
        for (let i = 30; i >= 0; --i) {
          this.swap(x);
          this.oneRoundInv(x, this._roundKeys[i]);
        }
      } else {
        // Encryption: apply 32 rounds (31 with swap + 1 final without swap)
        for (let i = 0; i < 31; ++i) {
          this.oneRound(x, this._roundKeys[i]);
          this.swap(x);
        }
        this.oneRound(x, this._roundKeys[31]);
      }

      return x;
    }

    oneRound(x, k) {
      // Apply F function to right half (x[4..7])
      const t = fFunction([x[4], x[5], x[6], x[7]], k);

      // XOR with left half with LEFT rotation
      // Left half rotation: x[0],x[1],x[2],x[3] → x[3],x[0],x[1],x[2]
      const tmp = [
        OpCodes.XorN(x[3], t[0]),
        OpCodes.XorN(x[0], t[1]),
        OpCodes.XorN(x[1], t[2]),
        OpCodes.XorN(x[2], t[3])
      ];

      // Update left half
      x[0] = tmp[0];
      x[1] = tmp[1];
      x[2] = tmp[2];
      x[3] = tmp[3];
    }

    oneRoundInv(x, k) {
      // Apply F function to right half (x[4..7])
      const t = fFunction([x[4], x[5], x[6], x[7]], k);

      // XOR with left half (no rotation in decrypt)
      const tmp = [
        OpCodes.XorN(x[0], t[0]),
        OpCodes.XorN(x[1], t[1]),
        OpCodes.XorN(x[2], t[2]),
        OpCodes.XorN(x[3], t[3])
      ];

      // Update left half with RIGHT rotation
      // Right rotation: tmp[0],tmp[1],tmp[2],tmp[3] → tmp[1],tmp[2],tmp[3],tmp[0]
      x[0] = tmp[1];
      x[1] = tmp[2];
      x[2] = tmp[3];
      x[3] = tmp[0];
    }

    swap(x) {
      // Swap left and right halves
      const tmp = [x[0], x[1], x[2], x[3]];
      x[0] = x[4]; x[1] = x[5]; x[2] = x[6]; x[3] = x[7];
      x[4] = tmp[0]; x[5] = tmp[1]; x[6] = tmp[2]; x[7] = tmp[3];
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new LBlock());

  return LBlock;
}));
