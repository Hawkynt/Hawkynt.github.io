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

  function matrixMultiply_b881b9ca(y) {
    let result = y;
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 2));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 3));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 4));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 8));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 15));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 16));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 18));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 19));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 20));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 23));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 24));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 25));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 28));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 30));
    return OpCodes.ToUint32(result);
  }

  function matrixMultiply_a3861085(y) {
    let result = y;
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 2));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 6));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 7));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 8));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 13));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 14));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 19));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 24));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 29));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 31));
    return OpCodes.ToUint32(result);
  }

  function matrixMultiply_63417021(y) {
    let result = OpCodes.RotR32(y, 1);
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 2));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 6));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 7));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 9));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 15));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 17));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 18));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 19));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 26));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 31));
    return OpCodes.ToUint32(result);
  }

  function matrixMultiply_692cf280(y) {
    let result = OpCodes.RotR32(y, 1);
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 2));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 4));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 7));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 10));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 12));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 13));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 16));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 17));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 18));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 19));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 22));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 24));
    return OpCodes.ToUint32(result);
  }

  // Inverse matrix multiplications for decryption
  function matrixMultiply_2037a121(y) {
    let result = OpCodes.RotR32(y, 2);
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 10));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 11));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 13));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 14));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 15));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 16));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 18));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 23));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 26));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 31));
    return OpCodes.ToUint32(result);
  }

  function matrixMultiply_108ff2a0(y) {
    let result = OpCodes.RotR32(y, 3);
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 8));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 12));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 13));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 14));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 15));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 16));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 17));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 18));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 19));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 22));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 24));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 26));
    return OpCodes.ToUint32(result);
  }

  function matrixMultiply_9054d8c0(y) {
    let result = y;
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 3));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 9));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 11));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 13));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 16));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 17));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 19));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 20));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 24));
    result = OpCodes.XorN(result, OpCodes.RotR32(y, 25));
    return OpCodes.ToUint32(result);
  }

  // Key schedule for Pyjamask-96
  function setupKey(key) {
    const rk = [];
    let k0 = OpCodes.Pack32BE(key[0], key[1], key[2], key[3]);
    let k1 = OpCodes.Pack32BE(key[4], key[5], key[6], key[7]);
    let k2 = OpCodes.Pack32BE(key[8], key[9], key[10], key[11]);
    let k3 = OpCodes.Pack32BE(key[12], key[13], key[14], key[15]);

    // First round key is the key itself
    rk.push(k0, k1, k2);

    // Derive round keys for all rounds
    for (let round = 0; round < PYJAMASK_ROUNDS; ++round) {
      // Mix columns
      const temp = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(k0, k1), k2), k3));
      k0 = OpCodes.ToUint32(OpCodes.XorN(k0, temp));
      k1 = OpCodes.ToUint32(OpCodes.XorN(k1, temp));
      k2 = OpCodes.ToUint32(OpCodes.XorN(k2, temp));
      k3 = OpCodes.ToUint32(OpCodes.XorN(k3, temp));

      // Mix rows and add round constants
      // Note: Reference code uses RIGHT rotation (not left as per spec)
      k0 = matrixMultiply_b881b9ca(k0);
      k0 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(k0, 0x00000080), round));
      k1 = OpCodes.RotR32(k1, 8);
      k1 = OpCodes.ToUint32(OpCodes.XorN(k1, 0x00006a00));
      k2 = OpCodes.RotR32(k2, 15);
      k2 = OpCodes.ToUint32(OpCodes.XorN(k2, 0x003f0000));
      k3 = OpCodes.RotR32(k3, 18);
      k3 = OpCodes.ToUint32(OpCodes.XorN(k3, 0x24000000));

      // Store round key (only first 3 words for 96-bit)
      rk.push(k0, k1, k2);
    }

    return rk;
  }

  // Pyjamask-96 block cipher encryption
  function encryptBlock(keySchedule, input) {
    let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);

    let rkIndex = 0;

    // Perform all encryption rounds
    for (let round = 0; round < PYJAMASK_ROUNDS; ++round) {
      // Add round key
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, keySchedule[rkIndex++]));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, keySchedule[rkIndex++]));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, keySchedule[rkIndex++]));

      // Apply 96-bit Pyjamask S-box (matching C reference exactly)
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s1));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s2));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.AndN(s0, s1)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, OpCodes.AndN(s1, s2)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, OpCodes.AndN(s0, s2)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s0));
      s2 = OpCodes.ToUint32(~s2);
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s0));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s1));

      // Mix rows
      s0 = matrixMultiply_a3861085(s0);
      s1 = matrixMultiply_63417021(s1);
      s2 = matrixMultiply_692cf280(s2);
    }

    // Final round key addition
    s0 = OpCodes.ToUint32(OpCodes.XorN(s0, keySchedule[rkIndex++]));
    s1 = OpCodes.ToUint32(OpCodes.XorN(s1, keySchedule[rkIndex++]));
    s2 = OpCodes.ToUint32(OpCodes.XorN(s2, keySchedule[rkIndex++]));

    // Pack output
    const output = [];
    const b0 = OpCodes.Unpack32BE(s0);
    const b1 = OpCodes.Unpack32BE(s1);
    const b2 = OpCodes.Unpack32BE(s2);
    output.push(...b0, ...b1, ...b2);
    return output;
  }

  // Double a value in GF(96) for OCB mode
  function doubleL(out, input) {
    const mask = OpCodes.AndN(OpCodes.Shr32(input[0], 7), 1);
    for (let i = 0; i < 11; ++i) {
      out[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(input[i], 1), OpCodes.Shr32(input[i + 1], 7)), 0xFF);
    }
    out[11] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(input[11], 1), (mask ? 0x41 : 0)), 0xFF);
    out[10] = OpCodes.XorN(out[10], (mask ? 0x06 : 0));
  }

  // OCB mode implementation for Pyjamask-96
  class OCBState {
    constructor(key, nonce) {
      this.keySchedule = setupKey(key);

      // Initialize L values
      this.Lstar = new Array(BLOCK_SIZE).fill(0);
      this.Lstar = encryptBlock(this.keySchedule, this.Lstar);

      this.Ldollar = new Array(BLOCK_SIZE);
      doubleL(this.Ldollar, this.Lstar);

      this.L0 = new Array(BLOCK_SIZE);
      doubleL(this.L0, this.Ldollar);

      this.L1 = new Array(BLOCK_SIZE);
      doubleL(this.L1, this.L0);

      // Initialize offset from nonce
      this.offset = new Array(BLOCK_SIZE).fill(0);
      // Copy nonce to end of offset block
      for (let i = 0; i < NONCE_SIZE; ++i) {
        this.offset[BLOCK_SIZE - NONCE_SIZE + i] = nonce[i];
      }
      this.offset[0] = OpCodes.Shl32(OpCodes.AndN(TAG_SIZE * 8, 0x7F), 1);
      this.offset[BLOCK_SIZE - NONCE_SIZE - 1] = OpCodes.OrN(this.offset[BLOCK_SIZE - NONCE_SIZE - 1], 0x01);

      const bottom = OpCodes.AndN(this.offset[BLOCK_SIZE - 1], 0x3F);
      this.offset[BLOCK_SIZE - 1] = OpCodes.AndN(this.offset[BLOCK_SIZE - 1], 0xC0);

      // Create stretch for offset calculation (96-bit block handling)
      const stretch = new Array(20);
      const encOffset = encryptBlock(this.keySchedule, this.offset);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        stretch[i] = encOffset[i];
      }
      // Extend stretch per Pyjamask specification
      for (let i = 0; i < 8; ++i) {
        stretch[i + 12] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(stretch[i + 1], 1), OpCodes.Shr32(stretch[i + 2], 7)), 0xFF);
      }
      for (let i = 0; i < 8; ++i) {
        stretch[i + 12] = OpCodes.XorN(stretch[i + 12], stretch[i]);
      }

      // Extract offset
      const bytePos = Math.floor(bottom / 8);
      const bitPos = bottom % 8;
      if (bitPos !== 0) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(stretch[i + bytePos], bitPos),
                           OpCodes.Shr32(stretch[i + bytePos + 1], (8 - bitPos))), 0xFF);
        }
      } else {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = stretch[i + bytePos];
        }
      }
    }

    calculateL(blockNumber) {
      const L = [...this.L1];
      doubleL(L, L);
      let i = OpCodes.Shr32(blockNumber, 2);
      while ((OpCodes.AndN(i, 1)) === 0) {
        doubleL(L, L);
        i = OpCodes.Shr32(i, 1);
      }
      return L;
    }

    processAD(ad) {
      const tag = new Array(BLOCK_SIZE).fill(0);
      const offset = new Array(BLOCK_SIZE).fill(0);
      let blockNumber = 1;
      let adIndex = 0;
      let adLen = ad.length;

      // Process full blocks
      while (adLen >= BLOCK_SIZE) {
        let L;
        if (OpCodes.AndN(blockNumber, 1)) {
          L = this.L0;
        } else if ((OpCodes.AndN(blockNumber, 3)) === 2) {
          L = this.L1;
        } else {
          L = this.calculateL(blockNumber);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          offset[i] = OpCodes.XorN(offset[i], L[i]);
        }

        const block = [];
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          block[i] = OpCodes.XorN(offset[i], ad[adIndex++]);
        }

        const encrypted = encryptBlock(this.keySchedule, block);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          tag[i] = OpCodes.XorN(tag[i], encrypted[i]);
        }

        adLen -= BLOCK_SIZE;
        ++blockNumber;
      }

      // Process partial block
      if (adLen > 0) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          offset[i] = OpCodes.XorN(offset[i], this.Lstar[i]);
        }
        for (let i = 0; i < adLen; ++i) {
          offset[i] = OpCodes.XorN(offset[i], ad[adIndex++]);
        }
        offset[adLen] = OpCodes.XorN(offset[adLen], 0x80);

        const encrypted = encryptBlock(this.keySchedule, offset);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          tag[i] = OpCodes.XorN(tag[i], encrypted[i]);
        }
      }

      return tag;
    }

    encrypt(plaintext, ad) {
      const ciphertext = [];
      const sum = new Array(BLOCK_SIZE).fill(0);
      let blockNumber = 1;
      let ptIndex = 0;
      let ptLen = plaintext.length;

      // Process full plaintext blocks
      while (ptLen >= BLOCK_SIZE) {
        let L;
        if (OpCodes.AndN(blockNumber, 1)) {
          L = this.L0;
        } else if ((OpCodes.AndN(blockNumber, 3)) === 2) {
          L = this.L1;
        } else {
          L = this.calculateL(blockNumber);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.XorN(this.offset[i], L[i]);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          sum[i] = OpCodes.XorN(sum[i], plaintext[ptIndex + i]);
        }

        const block = [];
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          block[i] = OpCodes.XorN(this.offset[i], plaintext[ptIndex++]);
        }

        const encrypted = encryptBlock(this.keySchedule, block);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          ciphertext.push(OpCodes.XorN(encrypted[i], this.offset[i]));
        }

        ptLen -= BLOCK_SIZE;
        ++blockNumber;
      }

      // Process partial plaintext block
      if (ptLen > 0) {
        for (let i = 0; i < ptLen; ++i) {
          sum[i] = OpCodes.XorN(sum[i], plaintext[ptIndex + i]);
        }
        sum[ptLen] = OpCodes.XorN(sum[ptLen], 0x80);

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.XorN(this.offset[i], this.Lstar[i]);
        }

        const encrypted = encryptBlock(this.keySchedule, this.offset);
        for (let i = 0; i < ptLen; ++i) {
          ciphertext.push(OpCodes.XorN(encrypted[i], plaintext[ptIndex++]));
        }
      }

      // Finalize
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        sum[i] = OpCodes.XorN(sum[i], this.offset[i]);
        sum[i] = OpCodes.XorN(sum[i], this.Ldollar[i]);
      }

      const finalTag = encryptBlock(this.keySchedule, sum);

      // Process AD and compute final tag
      const adTag = this.processAD(ad);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        finalTag[i] = OpCodes.XorN(finalTag[i], adTag[i]);
      }

      // Append tag
      ciphertext.push(...finalTag);

      return ciphertext;
    }

    decrypt(ciphertext, ad) {
      if (ciphertext.length < TAG_SIZE) {
        throw new Error("Ciphertext too short");
      }

      const ctLen = ciphertext.length - TAG_SIZE;
      const receivedTag = ciphertext.slice(ctLen);
      const plaintext = [];
      const sum = new Array(BLOCK_SIZE).fill(0);
      let blockNumber = 1;
      let ctIndex = 0;
      let remainingLen = ctLen;

      // Process full ciphertext blocks
      while (remainingLen >= BLOCK_SIZE) {
        let L;
        if (OpCodes.AndN(blockNumber, 1)) {
          L = this.L0;
        } else if ((OpCodes.AndN(blockNumber, 3)) === 2) {
          L = this.L1;
        } else {
          L = this.calculateL(blockNumber);
        }

        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.XorN(this.offset[i], L[i]);
        }

        const block = [];
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          block[i] = OpCodes.XorN(this.offset[i], ciphertext[ctIndex + i]);
        }

        const decrypted = encryptBlock(this.keySchedule, block);
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          const pt = OpCodes.XorN(decrypted[i], this.offset[i]);
          plaintext.push(pt);
          sum[i] = OpCodes.XorN(sum[i], pt);
        }

        ctIndex += BLOCK_SIZE;
        remainingLen -= BLOCK_SIZE;
        ++blockNumber;
      }

      // Process partial ciphertext block
      if (remainingLen > 0) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          this.offset[i] = OpCodes.XorN(this.offset[i], this.Lstar[i]);
        }

        const encrypted = encryptBlock(this.keySchedule, this.offset);
        for (let i = 0; i < remainingLen; ++i) {
          const pt = OpCodes.XorN(encrypted[i], ciphertext[ctIndex++]);
          plaintext.push(pt);
          sum[i] = OpCodes.XorN(sum[i], pt);
        }
        sum[remainingLen] = OpCodes.XorN(sum[remainingLen], 0x80);
      }

      // Finalize
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        sum[i] = OpCodes.XorN(sum[i], this.offset[i]);
        sum[i] = OpCodes.XorN(sum[i], this.Ldollar[i]);
      }

      const computedTag = encryptBlock(this.keySchedule, sum);

      // Process AD and compute final tag
      const adTag = this.processAD(ad);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        computedTag[i] = OpCodes.XorN(computedTag[i], adTag[i]);
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${NONCE_SIZE})`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
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
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const ocb = new OCBState(this._key, this._nonce);

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
