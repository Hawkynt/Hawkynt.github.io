/*
 * Pyjamask-96 AEAD - NIST Lightweight Cryptography Candidate
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * Pyjamask-96 uses a 96-bit block cipher with OCB mode for authenticated encryption.
 * It features a unique S-box design based on AND, XOR, and NOT operations optimized
 * for efficient masking against side-channel attacks.
 *
 * Block size: 96 bits (12 bytes)
 * Key size: 128 bits (16 bytes)
 * Nonce size: 64 bits (8 bytes)
 * Tag size: 96 bits (12 bytes)
 * Rounds: 14
 *
 * Reference: https://csrc.nist.gov/Projects/lightweight-cryptography
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/pyjamask-spec-final.pdf
 * C Reference: Southern Storm Software LWC implementations
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
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Constants
  const PYJAMASK_ROUNDS = 14;
  const BLOCK_SIZE = 12; // 96 bits
  const KEY_SIZE = 16;   // 128 bits
  const NONCE_SIZE = 8;  // 64 bits
  const TAG_SIZE = 12;   // 96 bits

  // Matrix multiplication for MixRows operation (matching C reference exactly)
  // These implement multiplication by specific matrix rows in GF(2^32)

  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_b881b9ca(y) {
    /** @type {uint32} */
    let result = y;
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 2));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 3));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 4));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 8));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 15));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 16));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 18));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 19));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 20));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 23));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 24));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 25));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 28));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 30));
    return OpCodes.ToUint32(result);
  }

  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_a3861085(y) {
    /** @type {uint32} */
    let result = y;
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 2));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 6));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 7));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 8));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 13));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 14));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 19));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 24));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 29));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 31));
    return OpCodes.ToUint32(result);
  }

  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_63417021(y) {
    let result = OpCodes.RotR32(y, 1);
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 2));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 6));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 7));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 9));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 15));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 17));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 18));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 19));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 26));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 31));
    return OpCodes.ToUint32(result);
  }

  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_692cf280(y) {
    let result = OpCodes.RotR32(y, 1);
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 2));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 4));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 7));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 10));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 12));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 13));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 16));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 17));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 18));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 19));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 22));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 24));
    return OpCodes.ToUint32(result);
  }

  // Inverse matrix multiplications for decryption
  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_2037a121(y) {
    let result = OpCodes.RotR32(y, 2);
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 10));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 11));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 13));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 14));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 15));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 16));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 18));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 23));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 26));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 31));
    return OpCodes.ToUint32(result);
  }

  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_108ff2a0(y) {
    let result = OpCodes.RotR32(y, 3);
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 8));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 12));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 13));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 14));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 15));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 16));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 17));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 18));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 19));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 22));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 24));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 26));
    return OpCodes.ToUint32(result);
  }

  /**
   * @param {uint32} y
   * @returns {uint32}
   */
  function matrixMultiply_9054d8c0(y) {
    /** @type {uint32} */
    let result = y;
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 3));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 9));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 11));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 13));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 16));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 17));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 19));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 20));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 24));
    result = OpCodes.Xor32(result, OpCodes.RotR32(y, 25));
    return OpCodes.ToUint32(result);
  }

  // Key schedule for Pyjamask-96
  /**
   * @param {uint8[]} key
   * @returns {uint32[]}
   */
  function setupKey(key) {
    /** @type {uint32[]} */
    const rk = [];
    let k0 = OpCodes.Pack32BE(key[0], key[1], key[2], key[3]);
    let k1 = OpCodes.Pack32BE(key[4], key[5], key[6], key[7]);
    let k2 = OpCodes.Pack32BE(key[8], key[9], key[10], key[11]);
    let k3 = OpCodes.Pack32BE(key[12], key[13], key[14], key[15]);

    // First round key is the key itself
    rk.push(k0);
    rk.push(k1);
    rk.push(k2);

    // Derive round keys for all rounds
    for (let round = 0; round < PYJAMASK_ROUNDS; ++round) {
      // Mix columns
      const temp = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(k0, k1), k2), k3));
      k0 = OpCodes.ToUint32(OpCodes.Xor32(k0, temp));
      k1 = OpCodes.ToUint32(OpCodes.Xor32(k1, temp));
      k2 = OpCodes.ToUint32(OpCodes.Xor32(k2, temp));
      k3 = OpCodes.ToUint32(OpCodes.Xor32(k3, temp));

      // Mix rows and add round constants
      // Note: Reference code uses RIGHT rotation (not left as per spec)
      k0 = matrixMultiply_b881b9ca(k0);
      k0 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(k0, 0x00000080), round));
      k1 = OpCodes.RotR32(k1, 8);
      k1 = OpCodes.ToUint32(OpCodes.Xor32(k1, 0x00006a00));
      k2 = OpCodes.RotR32(k2, 15);
      k2 = OpCodes.ToUint32(OpCodes.Xor32(k2, 0x003f0000));
      k3 = OpCodes.RotR32(k3, 18);
      k3 = OpCodes.ToUint32(OpCodes.Xor32(k3, 0x24000000));

      // Store round key (only first 3 words for 96-bit)
      rk.push(k0);
      rk.push(k1);
      rk.push(k2);
    }

    return rk;
  }

  // Pyjamask-96 block cipher encryption
  /**
   * @param {uint32[]} keySchedule
   * @param {uint8[]} input
   * @returns {uint8[]}
   */
  function encryptBlock(keySchedule, input) {
    let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);

    /** @type {int32} */
    let rkIndex = 0;

    // Perform all encryption rounds
    for (let round = 0; round < PYJAMASK_ROUNDS; ++round) {
      // Add round key
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, keySchedule[rkIndex++]));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, keySchedule[rkIndex++]));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, keySchedule[rkIndex++]));

      // Apply 96-bit Pyjamask S-box (matching C reference exactly)
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s1));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s2));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, OpCodes.And32(s0, s1)));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, OpCodes.And32(s1, s2)));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, OpCodes.And32(s0, s2)));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s0));
      s2 = OpCodes.ToUint32(~s2);
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s0));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s1));

      // Mix rows
      s0 = matrixMultiply_a3861085(s0);
      s1 = matrixMultiply_63417021(s1);
      s2 = matrixMultiply_692cf280(s2);
    }

    // Final round key addition
    s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, keySchedule[rkIndex++]));
    s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, keySchedule[rkIndex++]));
    s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, keySchedule[rkIndex++]));

    // Pack output
    /** @type {uint8[]} */
    const output = [];
    const b0 = OpCodes.Unpack32BE(s0);
    const b1 = OpCodes.Unpack32BE(s1);
    const b2 = OpCodes.Unpack32BE(s2);
    for (let i = 0; i < 4; ++i) output.push(b0[i]);
    for (let i = 0; i < 4; ++i) output.push(b1[i]);
    for (let i = 0; i < 4; ++i) output.push(b2[i]);
    return output;
  }

  // Pyjamask-96 block cipher decryption
  //
  // OCB encrypts each full message block with the block cipher, so recovering
  // one needs the cipher's inverse. Until this existed the decryptor called
  // encryptBlock on the ciphertext, which is why every message of a full block
  // or more failed to authenticate while shorter ones - handled as keystream
  // against the padded final block, and therefore symmetric - came back intact.
  /**
   * @param {uint32[]} keySchedule
   * @param {uint8[]} input
   * @returns {uint8[]}
   */
  function decryptBlock(keySchedule, input) {
    let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);

    // Undo the final round key addition first.
    /** @type {int32} */
    let rkIndex = 3 * PYJAMASK_ROUNDS;
    s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, keySchedule[rkIndex]));
    s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, keySchedule[rkIndex + 1]));
    s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, keySchedule[rkIndex + 2]));

    for (let round = PYJAMASK_ROUNDS - 1; round >= 0; --round) {
      // Inverse MixRows: each row's circulant matrix inverted.
      s0 = matrixMultiply_2037a121(s0);
      s1 = matrixMultiply_108ff2a0(s1);
      s2 = matrixMultiply_9054d8c0(s2);

      // Inverse S-box: the forward sequence run backwards, step by step.
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s1));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s0));
      s2 = OpCodes.ToUint32(~s2);
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, s0));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, OpCodes.And32(s0, s2)));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, OpCodes.And32(s1, s2)));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, OpCodes.And32(s0, s1)));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, s2));
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, s1));

      // Remove this round's key.
      rkIndex = 3 * round;
      s0 = OpCodes.ToUint32(OpCodes.Xor32(s0, keySchedule[rkIndex]));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(s1, keySchedule[rkIndex + 1]));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(s2, keySchedule[rkIndex + 2]));
    }

    /** @type {uint8[]} */
    const output = [];
    const b0 = OpCodes.Unpack32BE(s0);
    const b1 = OpCodes.Unpack32BE(s1);
    const b2 = OpCodes.Unpack32BE(s2);
    for (let i = 0; i < 4; ++i) output.push(b0[i]);
    for (let i = 0; i < 4; ++i) output.push(b1[i]);
    for (let i = 0; i < 4; ++i) output.push(b2[i]);
    return output;
  }

  // Double a value in GF(96) for OCB mode
  /**
   * @param {uint8[]} out
   * @param {uint8[]} input
   */
  function doubleL(out, input) {
    const mask = OpCodes.And32(OpCodes.Shr32(input[0], 7), 1);
    for (let i = 0; i < 11; ++i) {
      out[i] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(input[i], 1), OpCodes.Shr32(input[i + 1], 7)), 0xFF);
    }
    out[11] = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(input[11], 1), (mask ? 0x41 : 0)), 0xFF);
    out[10] = OpCodes.Xor32(out[10], (mask ? 0x06 : 0));
  }

  // OCB mode implementation for Pyjamask-96
  class OCBState {
    /**
     * @param {uint8[]} key - 16-byte key
     * @param {uint8[]} nonce - 8-byte nonce
     */
    constructor(key, nonce) {
      /** @type {uint32[]} */
      this.keySchedule = setupKey(key);

      // Initialize L values
      /** @type {uint8[]} */
      this.Lstar = OpCodes.CreateArray(BLOCK_SIZE, 0);
      this.Lstar = encryptBlock(this.keySchedule, this.Lstar);

      /** @type {uint8[]} */
      this.Ldollar = new Array(BLOCK_SIZE);
      doubleL(this.Ldollar, this.Lstar);

      /** @type {uint8[]} */
      this.L0 = new Array(BLOCK_SIZE);
      doubleL(this.L0, this.Ldollar);

      /** @type {uint8[]} */
      this.L1 = new Array(BLOCK_SIZE);
      doubleL(this.L1, this.L0);

      // Initialize offset from nonce
      /** @type {uint8[]} */
      this.offset = OpCodes.CreateArray(BLOCK_SIZE, 0);
      // Copy nonce to end of offset block
      for (let i = 0; i < NONCE_SIZE; ++i) {
        this.offset[BLOCK_SIZE - NONCE_SIZE + i] = nonce[i];
      }
      this.offset[0] = OpCodes.Shl32(OpCodes.And32(TAG_SIZE * 8, 0x7F), 1);
      this.offset[BLOCK_SIZE - NONCE_SIZE - 1] = OpCodes.Or32(this.offset[BLOCK_SIZE - NONCE_SIZE - 1], 0x01);

      const bottom = OpCodes.And32(this.offset[BLOCK_SIZE - 1], 0x3F);
      this.offset[BLOCK_SIZE - 1] = OpCodes.And32(this.offset[BLOCK_SIZE - 1], 0xC0);

      // Create stretch for offset calculation (96-bit block handling)
      /** @type {uint8[]} */
      const stretch = new Array(20);
      /** @type {uint8[]} */
      const encOffset = encryptBlock(this.keySchedule, this.offset);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        stretch[i] = encOffset[i];
      }
      // Extend stretch per Pyjamask specification
      for (let i = 0; i < 8; ++i) {
        stretch[i + 12] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(stretch[i + 1], 1), OpCodes.Shr32(stretch[i + 2], 7)), 0xFF);
      }
      for (let i = 0; i < 8; ++i) {
        stretch[i + 12] = OpCodes.Xor32(stretch[i + 12], stretch[i]);
      }

      // Extract offset
      const bytePos = Math.floor(bottom / 8);
      const bitPos = bottom % 8;
      if (bitPos !== 0) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(stretch[i + bytePos], bitPos),
                           OpCodes.Shr32(stretch[i + bytePos + 1], (8 - bitPos))), 0xFF);
        }
      } else {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = stretch[i + bytePos];
        }
      }
    }

    /**
     * @param {uint32} blockNumber
     * @returns {uint8[]}
     */
    calculateL(blockNumber) {
      /** @type {uint8[]} */
      const L = [...this.L1];
      doubleL(L, L);
      /** @type {uint32} */
      let i = OpCodes.Shr32(blockNumber, 2);
      while ((OpCodes.And32(i, 1)) === 0) {
        doubleL(L, L);
        i = OpCodes.Shr32(i, 1);
      }
      return L;
    }

    /**
     * @param {uint8[]} ad
     * @returns {uint8[]}
     */
    processAD(ad) {
      /** @type {uint8[]} */
      const tag = OpCodes.CreateArray(BLOCK_SIZE, 0);
      /** @type {uint8[]} */
      const offset = OpCodes.CreateArray(BLOCK_SIZE, 0);
      let blockNumber = 1;
      let adIndex = 0;
      let adLen = ad.length;

      // Process full blocks
      while (adLen >= BLOCK_SIZE) {
        /** @type {uint8[]} */
        let L;
        if (OpCodes.And32(blockNumber, 1)) {
          L = this.L0;
        } else if ((OpCodes.And32(blockNumber, 3)) === 2) {
          L = this.L1;
        } else {
          L = this.calculateL(blockNumber);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          offset[i] = OpCodes.Xor32(offset[i], L[i]);
        }

        /** @type {uint8[]} */

        const block = [];
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          block[i] = OpCodes.Xor32(offset[i], ad[adIndex++]);
        }

        /** @type {uint8[]} */

        const encrypted = encryptBlock(this.keySchedule, block);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          tag[i] = OpCodes.Xor32(tag[i], encrypted[i]);
        }

        adLen -= BLOCK_SIZE;
        ++blockNumber;
      }

      // Process partial block
      if (adLen > 0) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          offset[i] = OpCodes.Xor32(offset[i], this.Lstar[i]);
        }
        for (let i = 0; i < adLen; ++i) {
          offset[i] = OpCodes.Xor32(offset[i], ad[adIndex++]);
        }
        offset[adLen] = OpCodes.Xor32(offset[adLen], 0x80);

        /** @type {uint8[]} */

        const encrypted = encryptBlock(this.keySchedule, offset);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          tag[i] = OpCodes.Xor32(tag[i], encrypted[i]);
        }
      }

      return tag;
    }

    /**
     * @param {uint8[]} plaintext
     * @param {uint8[]} ad
     * @returns {uint8[]}
     */
    encrypt(plaintext, ad) {
      /** @type {uint8[]} */
      const ciphertext = [];
      /** @type {uint8[]} */
      const sum = OpCodes.CreateArray(BLOCK_SIZE, 0);
      let blockNumber = 1;
      let ptIndex = 0;
      let ptLen = plaintext.length;

      // Process full plaintext blocks
      while (ptLen >= BLOCK_SIZE) {
        /** @type {uint8[]} */
        let L;
        if (OpCodes.And32(blockNumber, 1)) {
          L = this.L0;
        } else if ((OpCodes.And32(blockNumber, 3)) === 2) {
          L = this.L1;
        } else {
          L = this.calculateL(blockNumber);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.Xor32(this.offset[i], L[i]);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          sum[i] = OpCodes.Xor32(sum[i], plaintext[ptIndex + i]);
        }

        /** @type {uint8[]} */

        const block = [];
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          block[i] = OpCodes.Xor32(this.offset[i], plaintext[ptIndex++]);
        }

        /** @type {uint8[]} */

        const encrypted = encryptBlock(this.keySchedule, block);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          ciphertext.push(OpCodes.Xor32(encrypted[i], this.offset[i]));
        }

        ptLen -= BLOCK_SIZE;
        ++blockNumber;
      }

      // Process partial plaintext block
      if (ptLen > 0) {
        for (let i = 0; i < ptLen; ++i) {
          sum[i] = OpCodes.Xor32(sum[i], plaintext[ptIndex + i]);
        }
        sum[ptLen] = OpCodes.Xor32(sum[ptLen], 0x80);

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.Xor32(this.offset[i], this.Lstar[i]);
        }

        /** @type {uint8[]} */

        const encrypted = encryptBlock(this.keySchedule, this.offset);
        for (let i = 0; i < ptLen; ++i) {
          ciphertext.push(OpCodes.Xor32(encrypted[i], plaintext[ptIndex++]));
        }
      }

      // Finalize
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        sum[i] = OpCodes.Xor32(sum[i], this.offset[i]);
        sum[i] = OpCodes.Xor32(sum[i], this.Ldollar[i]);
      }

      /** @type {uint8[]} */

      const finalTag = encryptBlock(this.keySchedule, sum);

      // Process AD and compute final tag
      /** @type {uint8[]} */
      const adTag = this.processAD(ad);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        finalTag[i] = OpCodes.Xor32(finalTag[i], adTag[i]);
      }

      // Append tag
      for (let _i = 0; _i < finalTag.length; _i++) ciphertext.push(finalTag[_i]);

      return ciphertext;
    }

    /**
     * @param {uint8[]} ciphertext
     * @param {uint8[]} ad
     * @returns {uint8[]}
     */
    decrypt(ciphertext, ad) {
      if (ciphertext.length < TAG_SIZE) {
        throw new Error("Ciphertext too short");
      }

      const ctLen = ciphertext.length - TAG_SIZE;
      /** @type {uint8[]} */
      const receivedTag = ciphertext.slice(ctLen);
      /** @type {uint8[]} */
      const plaintext = [];
      /** @type {uint8[]} */
      const sum = OpCodes.CreateArray(BLOCK_SIZE, 0);
      let blockNumber = 1;
      let ctIndex = 0;
      let remainingLen = ctLen;

      // Process full ciphertext blocks
      while (remainingLen >= BLOCK_SIZE) {
        /** @type {uint8[]} */
        let L;
        if (OpCodes.And32(blockNumber, 1)) {
          L = this.L0;
        } else if ((OpCodes.And32(blockNumber, 3)) === 2) {
          L = this.L1;
        } else {
          L = this.calculateL(blockNumber);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.Xor32(this.offset[i], L[i]);
        }

        /** @type {uint8[]} */

        const block = [];
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          block[i] = OpCodes.Xor32(this.offset[i], ciphertext[ctIndex + i]);
        }

        /** @type {uint8[]} */

        const decrypted = decryptBlock(this.keySchedule, block);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          const pt = OpCodes.Xor32(decrypted[i], this.offset[i]);
          plaintext.push(pt);
          sum[i] = OpCodes.Xor32(sum[i], pt);
        }

        ctIndex += BLOCK_SIZE;
        remainingLen -= BLOCK_SIZE;
        ++blockNumber;
      }

      // Process partial ciphertext block
      if (remainingLen > 0) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.Xor32(this.offset[i], this.Lstar[i]);
        }

        /** @type {uint8[]} */

        const encrypted = encryptBlock(this.keySchedule, this.offset);
        for (let i = 0; i < remainingLen; ++i) {
          const pt = OpCodes.Xor32(encrypted[i], ciphertext[ctIndex++]);
          plaintext.push(pt);
          sum[i] = OpCodes.Xor32(sum[i], pt);
        }
        sum[remainingLen] = OpCodes.Xor32(sum[remainingLen], 0x80);
      }

      // Finalize
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        sum[i] = OpCodes.Xor32(sum[i], this.offset[i]);
        sum[i] = OpCodes.Xor32(sum[i], this.Ldollar[i]);
      }

      /** @type {uint8[]} */

      const computedTag = encryptBlock(this.keySchedule, sum);

      // Process AD and compute final tag
      /** @type {uint8[]} */
      const adTag = this.processAD(ad);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        computedTag[i] = OpCodes.Xor32(computedTag[i], adTag[i]);
      }

      // Verify tag
      let tagMatch = true;
      for (let i = 0; i < TAG_SIZE; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          tagMatch = false;
          break;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }
  }

  // Algorithm class
  class Pyjamask96AEAD extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Pyjamask-96 AEAD";
      this.description = "NIST lightweight cryptography candidate using 96-bit block cipher with OCB mode. Features efficient masking against side-channel attacks.";
      this.inventor = "Dahmun Goudarzi, Jérémy Jean, Stefan Kölbl, Thomas Peyrin, Matthieu Rivain, Yu Sasaki, Siang Meng Sim";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 1)];
      this.SupportedTagSizes = [new KeySize(TAG_SIZE, TAG_SIZE, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Project",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Pyjamask Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/pyjamask-spec-final.pdf"
        ),
        new LinkItem(
          "OCB Mode RFC 7253",
          "https://tools.ietf.org/html/rfc7253"
        )
      ];

      this.references = [
        new LinkItem("Official Pyjamask Reference Implementation", "https://github.com/pyjamask-cipher/pyjamask-reference-implementation"),
        new LinkItem("Pyjamask Cipher Project Site", "https://pyjamask-cipher.github.io/")
      ];

      // Official test vectors from NIST LWC KAT file
      this.tests = [
        {
          text: "Pyjamask-96: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("488F6D07A0ACB94BA38DAFF6")
        },
        {
          text: "Pyjamask-96: Empty message with 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("A4080D3107179D4E79914D6C")
        },
        {
          text: "Pyjamask-96: 1-byte plaintext, empty AAD (Count 34)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("E93E779812B77693E67B3747FA")
        },
        {
          text: "Pyjamask-96: 1-byte plaintext, 8-byte AAD (Count 42)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("E94385DD68FCA0483B70E02629")
        },
        {
          text: "Pyjamask-96: 12-byte plaintext (full block), empty AAD (Count 397)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          expected: OpCodes.Hex8ToBytes("91801ABE9AA41562D34D07B30E13800F7D7608223C9197E4")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Pyjamask96AEADInstance(this, isInverse);
    }
  }

  // Instance class
  /**
 * Pyjamask96AEAD cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Pyjamask96AEADInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Pyjamask96AEAD} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._nonce = null;
      /** @type {uint8[]} */
      this._aad = [];
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected " + KEY_SIZE + ")");
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== NONCE_SIZE) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (expected " + NONCE_SIZE + ")");
      }

      this._nonce = [...nonceBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get nonce() { return this._nonce ? [...this._nonce] : null; }

    /**
     * @param {uint8[]|null} aadBytes
     */
    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get aad() { return [...this._aad]; }

    /**
     * @param {uint8[]|null} adBytes
     */
    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    /**
     * @returns {uint8[]|null}
     */
    get associatedData() {
      return this.aad;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      /** @type {OCBState} */
      const ocb = new OCBState(this._key, this._nonce);

      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        // Decrypt
        result = ocb.decrypt(this.inputBuffer, this._aad);
      } else {
        // Encrypt
        result = ocb.encrypt(this.inputBuffer, this._aad);
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Pyjamask96AEAD());

}));
