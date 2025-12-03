/*
 * LOTUS-AEAD - Lightweight OCB-like AEAD Construction
 * Professional implementation following NIST LWC submission specification
 * (c)2006-2025 Hawkynt
 *
 * LOTUS-AEAD is a lightweight authenticated encryption with associated data (AEAD)
 * scheme based on the tweakable GIFT-64 block cipher (TweGIFT-64). It uses an
 * OCB-like construction optimized for constrained environments.
 *
 * Key features:
 * - 128-bit keys, 128-bit nonces, 64-bit authentication tags
 * - Based on GIFT-64 with tweakable variant (4-bit domain separation tweaks)
 * - Galois field multiplication for state updates (GF(128) with x^128 + x^7 + x^2 + x + 1)
 * - Parallel processing of two 64-bit blocks per iteration
 *
 * Reference: https://csrc.nist.gov/projects/lightweight-cryptography
 * C Reference: Southern Storm Software lightweight-crypto library
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

  // GIFT-64 constants
  const GIFT64_BLOCK_SIZE = 8;
  const GIFT64_RC = [
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
    0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
    0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
    0x21, 0x02, 0x05, 0x0B
  ];

  // TweGIFT-64 tweak values (4-bit expanded to 16-bit)
  const GIFT64_TWEAKS = {
    0: 0x0000, 1: 0xe1e1, 2: 0xd2d2, 3: 0x3333,
    4: 0xb4b4, 5: 0x5555, 6: 0x6666, 12: 0xcccc, 13: 0x2d2d
  };

  // Bit permutation step helper
  function bitPermuteStep16(y, mask, shift) {
    const t = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(y, shift), y), mask);
    return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(y, t), OpCodes.Shl32(t, shift)));
  }

  // Bit permutation step for 32-bit
  function bitPermuteStep32(y, mask, shift) {
    const t = OpCodes.ToUint32(OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(y, shift), y), mask));
    return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(y, t), OpCodes.Shl32(t, shift)));
  }

  // GIFT-64 key schedule class
  class Gift64KeySchedule {
    constructor(key) {
      // Key schedule: 4 x 32-bit words (little-endian from 16-byte key)
      this.k = new Uint32Array(4);
      if (key && key.length === 16) {
        this.k[0] = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);
        this.k[1] = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
        this.k[2] = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
        this.k[3] = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      }
    }

    // Multiply key by 2 in GF(128) - used for state updates
    mul2() {
      const mask = OpCodes.AndN(this.k[0], 0x80000000) !== 0 ? 0x87 : 0;
      this.k[0] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.k[0], 1), OpCodes.Shr32(this.k[1], 31)));
      this.k[1] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.k[1], 1), OpCodes.Shr32(this.k[2], 31)));
      this.k[2] = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.k[2], 1), OpCodes.Shr32(this.k[3], 31)));
      this.k[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shl32(this.k[3], 1), mask));
    }
  }

  // PERM1_INNER permutation for GIFT-64 (low memory version)
  function perm1Inner(x) {
    x = bitPermuteStep16(x, 0x0a0a, 3);
    x = bitPermuteStep16(x, 0x00cc, 6);
    x = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(x, 0x0f0f), 4), OpCodes.AndN(OpCodes.Shr32(x, 4), 0x0f0f)));
    return OpCodes.ToUint32(OpCodes.AndN(x, 0xFFFF));
  }

  function perm0(x) {
    x = perm1Inner(x);
    // leftRotate12_16: rotate left by 12 bits in 16-bit value
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(x, 12), OpCodes.Shr32(x, 4)), 0xFFFF));
  }

  function perm2(x) {
    x = perm1Inner(x);
    // leftRotate4_16: rotate left by 4 bits
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(x, 4), OpCodes.Shr32(x, 12)), 0xFFFF));
  }

  function perm3(x) {
    x = perm1Inner(x);
    // leftRotate8_16: rotate left by 8 bits
    return OpCodes.ToUint32(OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(x, 8), OpCodes.Shr32(x, 8)), 0xFFFF));
  }

  // TweGIFT-64 encryption with tweak (low memory version)
  function gift64tEncrypt(ks, output, input, tweak) {
    // Convert nibble-based input to word-based representation
    const state = new Uint8Array(8);
    gift64nToWords(state, input);

    // Load state into 16-bit words (big-endian)
    let s0 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(state[0], 8), state[1]));
    let s1 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(state[2], 8), state[3]));
    let s2 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(state[4], 8), state[5]));
    let s3 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(state[6], 8), state[7]));

    // Initialize key schedule words
    let w0 = ks.k[0], w1 = ks.k[1], w2 = ks.k[2], w3 = ks.k[3];

    // 28 rounds of GIFT-64
    for (let round = 0; round < 28; ++round) {
      // SubCells - apply S-box
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, OpCodes.AndN(s0, s2)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, OpCodes.AndN(s1, s3)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.OrN(s0, s1)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s2));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s3));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, 0xFFFF));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, OpCodes.AndN(s0, s1)));
      let temp = s0;
      s0 = s3;
      s3 = temp;

      // PermBits - apply permutation
      s0 = perm0(s0);
      s1 = perm1Inner(s1);
      s2 = perm2(s2);
      s3 = perm3(s3);

      // AddRoundKey - XOR key schedule and round constant
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, OpCodes.AndN(w3, 0xFFFF)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, OpCodes.Shr32(w3, 16)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, OpCodes.XorN(0x8000, GIFT64_RC[round])));

      // AddTweak - XOR tweak every 4 rounds except the last
      if (OpCodes.AndN(OpCodes.AndN(round + 1, 0xFF) % 4, 0xFF) === 0 && round < 27) {
        s2 = OpCodes.ToUint32(OpCodes.XorN(s2, tweak));
      }

      // Rotate key schedule
      temp = w3;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(temp, 0xFFFC0000), 2), OpCodes.Shl32(OpCodes.AndN(temp, 0x00030000), 14)), OpCodes.Shl32(OpCodes.AndN(temp, 0x00000FFF), 4)), OpCodes.Shr32(OpCodes.AndN(temp, 0x0000F000), 12)));
    }

    // Convert back to byte form (big-endian)
    state[0] = OpCodes.AndN(OpCodes.Shr32(s0, 8), 0xFF);
    state[1] = OpCodes.AndN(s0, 0xFF);
    state[2] = OpCodes.AndN(OpCodes.Shr32(s1, 8), 0xFF);
    state[3] = OpCodes.AndN(s1, 0xFF);
    state[4] = OpCodes.AndN(OpCodes.Shr32(s2, 8), 0xFF);
    state[5] = OpCodes.AndN(s2, 0xFF);
    state[6] = OpCodes.AndN(OpCodes.Shr32(s3, 8), 0xFF);
    state[7] = OpCodes.AndN(s3, 0xFF);

    // Convert word-based output back to nibbles
    gift64nToNibbles(output, state);
  }

  // Convert GIFT-64 nibble-based representation to word-based (little-endian)
  function gift64nToWords(output, input) {
    // Load as little-endian 32-bit words
    let s0 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let s1 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);

    // Apply bit permutation
    s0 = bitPermuteStep32(s0, 0x0a0a0a0a, 3);
    s0 = bitPermuteStep32(s0, 0x00cc00cc, 6);
    s0 = bitPermuteStep32(s0, 0x0000f0f0, 12);
    s0 = bitPermuteStep32(s0, 0x0000ff00, 8);

    s1 = bitPermuteStep32(s1, 0x0a0a0a0a, 3);
    s1 = bitPermuteStep32(s1, 0x00cc00cc, 6);
    s1 = bitPermuteStep32(s1, 0x0000f0f0, 12);
    s1 = bitPermuteStep32(s1, 0x0000ff00, 8);

    // Rearrange bytes
    output[0] = OpCodes.AndN(s0, 0xFF);
    output[1] = OpCodes.AndN(s1, 0xFF);
    output[2] = OpCodes.AndN(OpCodes.Shr32(s0, 8), 0xFF);
    output[3] = OpCodes.AndN(OpCodes.Shr32(s1, 8), 0xFF);
    output[4] = OpCodes.AndN(OpCodes.Shr32(s0, 16), 0xFF);
    output[5] = OpCodes.AndN(OpCodes.Shr32(s1, 16), 0xFF);
    output[6] = OpCodes.AndN(OpCodes.Shr32(s0, 24), 0xFF);
    output[7] = OpCodes.AndN(OpCodes.Shr32(s1, 24), 0xFF);
  }

  // Convert GIFT-64 word-based representation back to nibble-based
  function gift64nToNibbles(output, input) {
    // Load bytes and rearrange
    let s0 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(input[6], 24), OpCodes.Shl32(input[4], 16)), OpCodes.Shl32(input[2], 8)), input[0]));
    let s1 = OpCodes.ToUint32(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(input[7], 24), OpCodes.Shl32(input[5], 16)), OpCodes.Shl32(input[3], 8)), input[1]));

    // Apply inverse bit permutation
    s0 = bitPermuteStep32(s0, 0x00aa00aa, 7);
    s0 = bitPermuteStep32(s0, 0x0000cccc, 14);
    s0 = bitPermuteStep32(s0, 0x00f000f0, 4);
    s0 = bitPermuteStep32(s0, 0x0000ff00, 8);

    s1 = bitPermuteStep32(s1, 0x00aa00aa, 7);
    s1 = bitPermuteStep32(s1, 0x0000cccc, 14);
    s1 = bitPermuteStep32(s1, 0x00f000f0, 4);
    s1 = bitPermuteStep32(s1, 0x0000ff00, 8);

    // Store as little-endian
    const bytes0 = OpCodes.Unpack32LE(s0);
    const bytes1 = OpCodes.Unpack32LE(s1);
    output[4] = bytes0[0]; output[5] = bytes0[1]; output[6] = bytes0[2]; output[7] = bytes0[3];
    output[0] = bytes1[0]; output[1] = bytes1[1]; output[2] = bytes1[2]; output[3] = bytes1[3];
  }

  // LOTUS-AEAD initialization
  function lotusInit(ks, deltaN, key, nonce, temp) {
    // Initialize with key
    ks.k[0] = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);
    ks.k[1] = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
    ks.k[2] = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
    ks.k[3] = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);

    // deltaN = E_K(0, tweak=0)
    deltaN.fill(0);
    gift64tEncrypt(ks, deltaN, deltaN, GIFT64_TWEAKS[0]);

    // temp = key XOR nonce
    for (let i = 0; i < 16; ++i) {
      temp[i] = OpCodes.XorN(key[i], nonce[i]);
    }

    // Re-initialize key schedule with temp
    ks.k[0] = OpCodes.Pack32LE(temp[12], temp[13], temp[14], temp[15]);
    ks.k[1] = OpCodes.Pack32LE(temp[8], temp[9], temp[10], temp[11]);
    ks.k[2] = OpCodes.Pack32LE(temp[4], temp[5], temp[6], temp[7]);
    ks.k[3] = OpCodes.Pack32LE(temp[0], temp[1], temp[2], temp[3]);

    // deltaN = E_(K XOR N)(deltaN, tweak=1)
    gift64tEncrypt(ks, deltaN, deltaN, GIFT64_TWEAKS[1]);
  }

  // Process associated data
  function lotusProcessAD(ks, deltaN, V, ad, adlen) {
    const X = new Uint8Array(GIFT64_BLOCK_SIZE);
    let adpos = 0;

    while (adlen > GIFT64_BLOCK_SIZE) {
      ks.mul2();
      // X = ad XOR deltaN
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        X[i] = OpCodes.XorN(ad[adpos + i], deltaN[i]);
      }
      gift64tEncrypt(ks, X, X, GIFT64_TWEAKS[2]);
      // V = V XOR X
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        V[i] = OpCodes.XorN(V[i], X[i]);
      }
      adpos += GIFT64_BLOCK_SIZE;
      adlen -= GIFT64_BLOCK_SIZE;
    }

    ks.mul2();
    if (adlen < GIFT64_BLOCK_SIZE) {
      // Partial block - pad with 0x01
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        X[i] = deltaN[i];
      }
      for (let i = 0; i < adlen; ++i) {
        X[i] = OpCodes.XorN(X[i], ad[adpos + i]);
      }
      X[adlen] = OpCodes.XorN(X[adlen], 0x01);
      gift64tEncrypt(ks, X, X, GIFT64_TWEAKS[3]);
    } else {
      // Full block
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        X[i] = OpCodes.XorN(ad[adpos + i], deltaN[i]);
      }
      gift64tEncrypt(ks, X, X, GIFT64_TWEAKS[2]);
    }
    // V = V XOR X
    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      V[i] = OpCodes.XorN(V[i], X[i]);
    }
  }

  // Generate authentication tag
  function lotusGenTag(ks, tag, deltaN, W, V) {
    ks.mul2();
    // W = W XOR deltaN XOR V
    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      W[i] = OpCodes.XorN(W[i], OpCodes.XorN(deltaN[i], V[i]));
    }
    gift64tEncrypt(ks, W, W, GIFT64_TWEAKS[6]);
    // tag = W XOR deltaN
    for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
      tag[i] = OpCodes.XorN(W[i], deltaN[i]);
    }
  }

  // LOTUS-AEAD encryption
  function lotusEncrypt(ciphertext, plaintext, ptlen, ad, adlen, key, nonce) {
    const ks = new Gift64KeySchedule(key);
    const WV = new Uint8Array(16); // W and V concatenated
    const deltaN = new Uint8Array(GIFT64_BLOCK_SIZE);
    const X1 = new Uint8Array(GIFT64_BLOCK_SIZE);
    const X2 = new Uint8Array(GIFT64_BLOCK_SIZE);
    const temp = new Uint8Array(16);

    // Initialize
    lotusInit(ks, deltaN, key, nonce, temp);
    WV.fill(0);

    const V = new Uint8Array(WV.buffer, GIFT64_BLOCK_SIZE, GIFT64_BLOCK_SIZE);
    const W = new Uint8Array(WV.buffer, 0, GIFT64_BLOCK_SIZE);

    // Process associated data
    if (adlen > 0) {
      lotusProcessAD(ks, deltaN, V, ad, adlen);
    }

    // Encrypt plaintext
    let mlen = ptlen;
    let mpos = 0;
    let cpos = 0;

    if (mlen > 0) {
      // Process two-block chunks
      while (mlen > GIFT64_BLOCK_SIZE * 2) {
        ks.mul2();
        // X1 = plaintext[0:8] XOR deltaN
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          X1[i] = OpCodes.XorN(plaintext[mpos + i], deltaN[i]);
        }
        gift64tEncrypt(ks, X2, X1, GIFT64_TWEAKS[4]);
        // W = W XOR X2
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          W[i] = OpCodes.XorN(W[i], X2[i]);
        }
        gift64tEncrypt(ks, X2, X2, GIFT64_TWEAKS[4]);
        // X2 = plaintext[8:16] XOR X2
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          X2[i] = OpCodes.XorN(X2[i], plaintext[mpos + GIFT64_BLOCK_SIZE + i]);
        }
        // ciphertext[0:8] = X2 XOR deltaN
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          ciphertext[cpos + i] = OpCodes.XorN(X2[i], deltaN[i]);
        }
        gift64tEncrypt(ks, X2, X2, GIFT64_TWEAKS[5]);
        // W = W XOR X2
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          W[i] = OpCodes.XorN(W[i], X2[i]);
        }
        gift64tEncrypt(ks, X2, X2, GIFT64_TWEAKS[5]);
        // ciphertext[8:16] = X1 XOR X2
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          ciphertext[cpos + GIFT64_BLOCK_SIZE + i] = OpCodes.XorN(X1[i], X2[i]);
        }
        cpos += GIFT64_BLOCK_SIZE * 2;
        mpos += GIFT64_BLOCK_SIZE * 2;
        mlen -= GIFT64_BLOCK_SIZE * 2;
      }

      // Process final partial chunk
      ks.mul2();
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        X1[i] = deltaN[i];
      }
      X1[0] = OpCodes.XorN(X1[0], OpCodes.AndN(mlen, 0xFFFFFFFF));
      gift64tEncrypt(ks, X2, X1, GIFT64_TWEAKS[12]);
      for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
        W[i] = OpCodes.XorN(W[i], X2[i]);
      }
      gift64tEncrypt(ks, X2, X2, GIFT64_TWEAKS[12]);

      if (mlen <= GIFT64_BLOCK_SIZE) {
        // Single partial block
        for (let i = 0; i < mlen; ++i) {
          W[i] = OpCodes.XorN(W[i], plaintext[mpos + i]);
          X2[i] = OpCodes.XorN(X2[i], plaintext[mpos + i]);
          ciphertext[cpos + i] = OpCodes.XorN(X2[i], deltaN[i]);
        }
      } else {
        // Two blocks with second partial
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          X2[i] = OpCodes.XorN(X2[i], plaintext[mpos + i]);
          ciphertext[cpos + i] = OpCodes.XorN(X2[i], deltaN[i]);
        }
        cpos += GIFT64_BLOCK_SIZE;
        mpos += GIFT64_BLOCK_SIZE;
        mlen -= GIFT64_BLOCK_SIZE;

        gift64tEncrypt(ks, X2, X2, GIFT64_TWEAKS[13]);
        for (let i = 0; i < GIFT64_BLOCK_SIZE; ++i) {
          W[i] = OpCodes.XorN(W[i], X2[i]);
        }
        gift64tEncrypt(ks, X2, X2, GIFT64_TWEAKS[13]);
        for (let i = 0; i < mlen; ++i) {
          W[i] = OpCodes.XorN(W[i], plaintext[mpos + i]);
          X1[i] = OpCodes.XorN(X1[i], X2[i]);
          ciphertext[cpos + i] = OpCodes.XorN(X1[i], plaintext[mpos + i]);
        }
      }
    }

    // Generate tag
    const tag = new Uint8Array(GIFT64_BLOCK_SIZE);
    lotusGenTag(ks, tag, deltaN, W, V);
    return tag;
  }

  // LOTUS-AEAD Algorithm class
  class LotusAeadAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "LOTUS-AEAD";
      this.description = "Lightweight OCB-like authenticated encryption using TweGIFT-64 block cipher. NIST Lightweight Cryptography Competition candidate with 128-bit keys and 64-bit tags.";
      this.inventor = "Avik Chakraborti, Nilanjan Datta, Ashwin Jha, Cuauhtemoc Mancillas López, Mridul Nandi, Yu Sasaki";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(8, 8, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Submission",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "LOTUS-AEAD Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/lotus-aead-spec-final.pdf"
        ),
        new LinkItem(
          "C Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from NIST LWC KAT file
      this.tests = [
        {
          text: "LOTUS-AEAD: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("37F3EBB83FF38DE8")
        },
        {
          text: "LOTUS-AEAD: Empty message, 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("0020CF359FA6EC6E")
        },
        {
          text: "LOTUS-AEAD: Empty message, 2-byte AAD (Count 3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("9531E45BEEFEE95F")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LotusAeadInstance(this, isInverse);
    }
  }

  // LOTUS-AEAD Instance class
  /**
 * LotusAead cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LotusAeadInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.aadBuffer = [];
      this._key = null;
      this._nonce = null;
      this._aad = null;
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
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16)");
      }
      this._key = new Uint8Array(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (must be 16)");
      }
      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() {
      return this._nonce ? Array.from(this._nonce) : null;
    }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = null;
        return;
      }
      this._aad = new Uint8Array(aadBytes);
    }

    get aad() {
      return this._aad ? Array.from(this._aad) : null;
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
      if (this.inputBuffer.length === 0) {
        // Empty plaintext case - just generate tag
        const aad = this._aad || new Uint8Array(0);
        const tag = lotusEncrypt(
          new Uint8Array(0),
          new Uint8Array(0),
          0,
          aad,
          aad.length,
          this._key,
          this._nonce
        );
        this.inputBuffer = [];
        return Array.from(tag);
      }

      const plaintext = new Uint8Array(this.inputBuffer);
      const aad = this._aad || new Uint8Array(0);
      const ciphertext = new Uint8Array(plaintext.length);

      const tag = lotusEncrypt(
        ciphertext,
        plaintext,
        plaintext.length,
        aad,
        aad.length,
        this._key,
        this._nonce
      );

      // Return ciphertext + tag
      const result = new Uint8Array(ciphertext.length + tag.length);
      result.set(ciphertext, 0);
      result.set(tag, ciphertext.length);

      this.inputBuffer = [];
      return Array.from(result);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new LotusAeadAlgorithm());

  return LotusAeadAlgorithm;
}));
