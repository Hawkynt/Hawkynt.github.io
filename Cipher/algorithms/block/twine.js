/*
 * TWINE - Lightweight Block Cipher
 * Professional implementation following NEC specification
 * (c)2006-2025 Hawkynt
 *
 * TWINE is a 64-bit block cipher with 80-bit or 128-bit keys designed
 * by NEC for resource-constrained environments. It uses a 36-round
 * Type-2 Generalized Feistel structure with a 4-bit S-box.
 *
 * Published: Selected Areas in Cryptography (SAC) 2012
 * Authors: Tomoyasu Suzaki, Kazuhiko Minematsu, Sumio Morioka, Eita Kobayashi
 *
 * Reference: https://www.nec.com/en/global/rd/tg/code/symenc/twine.html
 * Paper: https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf
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

  // S-box (4-bit to 4-bit substitution) from TWINE specification
  const SBOX = [0xC, 0x0, 0xF, 0xA, 0x2, 0xB, 0x9, 0x5, 0x8, 0x3, 0xD, 0x7, 0x1, 0xE, 0x6, 0x4];

  // Permutation for encryption (π function)
  const PERM = [5, 0, 1, 4, 7, 12, 3, 8, 13, 6, 9, 2, 15, 10, 11, 14];

  // Round constants for key schedule (6-bit values)
  const CONh = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x03, 0x06,
    0x0C, 0x18, 0x30, 0x23, 0x05, 0x0A, 0x14, 0x28,
    0x13, 0x26, 0x0F, 0x1E, 0x3C, 0x3B, 0x35, 0x29,
    0x11, 0x22, 0x07, 0x0E, 0x1C, 0x38, 0x33, 0x25,
    0x09, 0x12, 0x24, 0x0B
  ];

  // Key schedule for TWINE-80 (80-bit key)
  function keySchedule80(key) {
    const roundKeys = [];
    const wk = new Array(20);

    // Initialize working key from input (20 nibbles from 80 bits)
    // Extract nibbles MSB first (like Python reference: pos 19, 18, ..., 1, 0)
    for (let i = 0; i < 20; ++i) {
      const byteIdx = Math.floor(i / 2);
      const nibbleShift = ((i % 2) === 0) ? 4 : 0;
      wk[i] = OpCodes.AndN(OpCodes.Shr32(key[byteIdx], nibbleShift), 0x0F);
    }

    // Generate round keys RK[1] to RK[36]
    for (let r = 1; r <= 36; ++r) {
      // Extract round key OpCodes.Xor32(RK, r) = (WK_1, WK_3, WK_4, WK_6, WK_13, WK_14, WK_15, WK_16)
      roundKeys[r] = [wk[1], wk[3], wk[4], wk[6], wk[13], wk[14], wk[15], wk[16]];

      // Update working key (only for rounds 1-35, not after round 36)
      if (r < 36) {
        // 1. XOR S-box outputs into nibbles
        wk[1] = OpCodes.XorN(wk[1], SBOX[wk[0]]);
        wk[4] = OpCodes.XorN(wk[4], SBOX[wk[16]]);

        // 2. XOR round constants into nibbles
        wk[7] = OpCodes.XorN(wk[7], OpCodes.AndN(OpCodes.Shr32(CONh[r - 1], 3), 0x07));  // Upper 3 bits
        wk[19] = OpCodes.XorN(wk[19], OpCodes.AndN(CONh[r - 1], 0x07));                 // Lower 3 bits

        // 3. Rotate first 4 nibbles: WK[0..3] ← WK[1..3, 0]
        const temp0 = wk[0];
        for (let i = 0; i < 3; ++i) {
          wk[i] = wk[i + 1];
        }
        wk[3] = temp0;

        // 4. Rotate all 20 nibbles by 4 positions: WK[0..19] ← WK[4..19, 0..3]
        const temp = [wk[0], wk[1], wk[2], wk[3]];
        for (let i = 0; i < 16; ++i) {
          wk[i] = wk[i + 4];
        }
        wk[16] = temp[0];
        wk[17] = temp[1];
        wk[18] = temp[2];
        wk[19] = temp[3];
      }
    }

    return roundKeys;
  }

  // Key schedule for TWINE-128 (128-bit key)
  function keySchedule128(key) {
    const roundKeys = [];
    const wk = new Array(32);

    // Initialize working key from input (32 nibbles from 128 bits)
    // Extract nibbles MSB first (like Python reference: pos 31, 30, ..., 1, 0)
    for (let i = 0; i < 32; ++i) {
      const byteIdx = Math.floor(i / 2);
      const nibbleShift = ((i % 2) === 0) ? 4 : 0;
      wk[i] = OpCodes.AndN(OpCodes.Shr32(key[byteIdx], nibbleShift), 0x0F);
    }

    // Generate round keys RK[1] to RK[36]
    for (let r = 1; r <= 36; ++r) {
      // Extract round key OpCodes.Xor32(RK, r) = (WK_2, WK_3, WK_12, WK_15, WK_17, WK_18, WK_28, WK_31)
      roundKeys[r] = [wk[2], wk[3], wk[12], wk[15], wk[17], wk[18], wk[28], wk[31]];

      // Update working key (only for rounds 1-35, not after round 36)
      if (r < 36) {
        // 1. XOR S-box outputs into nibbles
        wk[1] = OpCodes.XorN(wk[1], SBOX[wk[0]]);
        wk[4] = OpCodes.XorN(wk[4], SBOX[wk[16]]);
        wk[23] = OpCodes.XorN(wk[23], SBOX[wk[30]]);

        // 2. XOR round constants into nibbles
        wk[7] = OpCodes.XorN(wk[7], OpCodes.AndN(OpCodes.Shr32(CONh[r - 1], 3), 0x07));  // Upper 3 bits
        wk[19] = OpCodes.XorN(wk[19], OpCodes.AndN(CONh[r - 1], 0x07));                 // Lower 3 bits

        // 3. Rotate first 4 nibbles: WK[0..3] ← WK[1..3, 0]
        const temp0 = wk[0];
        for (let i = 0; i < 3; ++i) {
          wk[i] = wk[i + 1];
        }
        wk[3] = temp0;

        // 4. Rotate all 32 nibbles by 4 positions: WK[0..31] ← WK[4..31, 0..3]
        const temp = [wk[0], wk[1], wk[2], wk[3]];
        for (let i = 0; i < 28; ++i) {
          wk[i] = wk[i + 4];
        }
        wk[28] = temp[0];
        wk[29] = temp[1];
        wk[30] = temp[2];
        wk[31] = temp[3];
      }
    }

    return roundKeys;
  }

  // Inverse permutation for decryption
  const INV_PERM = new Array(16);
  for (let i = 0; i < 16; ++i) {
    INV_PERM[PERM[i]] = i;
  }

  // Round function for encryption
  function roundFunction(state, roundKey) {
    // 1. Apply S-box to even positions, XOR to odd positions
    // X[2*j+1] = S(X[2*j] XOR RK[j]) XOR X[2*j+1]
    const tempState = [...state];
    for (let j = 0; j < 8; ++j) {
      tempState[2 * j + 1] = OpCodes.XorN(SBOX[OpCodes.XorN(state[2 * j], roundKey[j])], state[2 * j + 1]);
    }

    // 2. Apply permutation to all 16 nibbles
    const newState = new Array(16);
    for (let h = 0; h < 16; ++h) {
      newState[PERM[h]] = tempState[h];
    }

    return newState;
  }

  // Round function for decryption (same S-box XOR, but inverse permutation first)
  function invRoundFunction(state, roundKey) {
    // 1. Apply inverse permutation
    const tempState = new Array(16);
    for (let h = 0; h < 16; ++h) {
      tempState[INV_PERM[h]] = state[h];
    }

    // 2. Apply S-box to even positions, XOR to odd positions (same as encryption)
    // X[2*j+1] = S(X[2*j] XOR RK[j]) XOR X[2*j+1]
    for (let j = 0; j < 8; ++j) {
      tempState[2 * j + 1] = OpCodes.XorN(SBOX[OpCodes.XorN(tempState[2 * j], roundKey[j])], tempState[2 * j + 1]);
    }

    return tempState;
  }

  /**
 * Twine - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Twine extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "TWINE";
      this.description = "Lightweight block cipher designed by NEC for resource-constrained environments. 64-bit block size with 80-bit or 128-bit keys using 36-round Type-2 Generalized Feistel structure. Optimized for both hardware and software implementations.";
      this.inventor = "Tomoyasu Suzaki, Kazuhiko Minematsu, Sumio Morioka, Eita Kobayashi (NEC)";
      this.year = 2012;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Lightweight Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(10, 16, 6)]; // 80-bit (10 bytes) or 128-bit (16 bytes)
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit blocks only

      this.documentation = [
        new LinkItem("TWINE Official Page (NEC)", "https://www.nec.com/en/global/rd/tg/code/symenc/twine.html"),
        new LinkItem("TWINE Specification (PDF)", "https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf"),
        new LinkItem("SAC 2012 Paper", "https://link.springer.com/chapter/10.1007/978-3-642-35999-6_22")
      ];

      // Test vectors from NEC specification (Table 1 of the paper)
      this.tests = [
        {
          text: "TWINE-80 Test Vector (Table 1, SAC 2012 Paper)",
          uri: "https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("00112233445566778899"),
          expected: OpCodes.Hex8ToBytes("7c1f0f80b1df9c28")
        },
        {
          text: "TWINE-128 Test Vector (Table 1, SAC 2012 Paper)",
          uri: "https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          expected: OpCodes.Hex8ToBytes("979ff9b379b5a9b8")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TwineInstance(this, isInverse);
    }
  }

  /**
 * Twine cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TwineInstance extends IBlockCipherInstance {
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

      if (keyBytes.length !== 10 && keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 10 or 16 bytes)`);
      }

      this._key = [...keyBytes];

      // Generate round keys based on key length
      if (keyBytes.length === 10) {
        this._roundKeys = keySchedule80(new Uint8Array(this._key));
      } else {
        this._roundKeys = keySchedule128(new Uint8Array(this._key));
      }
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
      // Convert block to 16 nibbles (4-bit values)
      // Extract nibbles MSB first (like Python reference)
      const X = {}; // X[round][nibble] like Python reference
      X[1] = new Array(16);
      for (let i = 0; i < 16; ++i) {
        const byteIdx = Math.floor(i / 2);
        const nibbleShift = ((i % 2) === 0) ? 4 : 0;
        X[1][i] = OpCodes.AndN(OpCodes.Shr32(block[byteIdx], nibbleShift), 0x0F);
      }

      if (this.isInverse) {
        // Decryption: Start from round 36 (ciphertext), work backwards to round 1 (plaintext)
        // Python: X[36] = ciphertext, then for i = 36 down to 2: S-box then inv_perm
        X[36] = X[1];
        delete X[1];

        // Round 36 down to round 2
        for (let i = 36; i >= 2; --i) {
          // Apply S-box to even positions, XOR to odd positions (modifies current round i)
          for (let j = 0; j < 8; ++j) {
            X[i][2 * j + 1] = OpCodes.XorN(SBOX[OpCodes.XorN(X[i][2 * j], this._roundKeys[i][j])], X[i][2 * j + 1]);
          }

          // Apply inverse permutation to previous round (Python: X[i-1][INV_PERM[h]] = X[i][h])
          X[i - 1] = new Array(16);
          for (let h = 0; h < 16; ++h) {
            X[i - 1][INV_PERM[h]] = X[i][h];
          }
        }

        // Round 1: S-box only, no inverse permutation
        for (let j = 0; j < 8; ++j) {
          X[1][2 * j + 1] = OpCodes.XorN(SBOX[OpCodes.XorN(X[1][2 * j], this._roundKeys[1][j])], X[1][2 * j + 1]);
        }

        // Convert final state (X[1]) back to bytes
        const result = new Array(8);
        for (let i = 0; i < 8; ++i) {
          result[i] = OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(X[1][2 * i], 0x0F), 4), OpCodes.AndN(X[1][2 * i + 1], 0x0F));
        }
        return result;

      } else {
        // Encryption: Apply rounds 1-35 with S-box + permutation
        for (let i = 1; i <= 35; ++i) {
          // Apply S-box to even positions, XOR to odd positions (modifies current round)
          for (let j = 0; j < 8; ++j) {
            X[i][2 * j + 1] = OpCodes.XorN(SBOX[OpCodes.XorN(X[i][2 * j], this._roundKeys[i][j])], X[i][2 * j + 1]);
          }

          // Apply permutation to next round (Python: X[i + 1][PERM[h]] = X[i][h])
          X[i + 1] = new Array(16);
          for (let h = 0; h < 16; ++h) {
            X[i + 1][PERM[h]] = X[i][h];
          }
        }

        // Round 36: S-box only, no permutation
        for (let j = 0; j < 8; ++j) {
          X[36][2 * j + 1] = OpCodes.XorN(SBOX[OpCodes.XorN(X[36][2 * j], this._roundKeys[36][j])], X[36][2 * j + 1]);
        }

        // Convert final state (X[36]) back to bytes
        const result = new Array(8);
        for (let i = 0; i < 8; ++i) {
          result[i] = OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(X[36][2 * i], 0x0F), 4), OpCodes.AndN(X[36][2 * i + 1], 0x0F));
        }
        return result;
      }
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Twine());

  return Twine;
}));
