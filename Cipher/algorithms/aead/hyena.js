/*
 * HYENA - NIST Lightweight Cryptography Candidate
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * HYENA is an authenticated encryption with associated data (AEAD) scheme
 * based on the GIFT-128 block cipher in nibble-based representation.
 * It uses a sponge-like construction with efficient processing of both
 * associated data and plaintext/ciphertext.
 *
 * Features:
 * - 128-bit key, 96-bit nonce
 * - 128-bit authentication tag
 * - GIFT-128 block cipher (nibble-based)
 * - Efficient feedback mode with delta values
 * - Submission to NIST LWC competition
 *
 * References:
 * - NIST Lightweight Cryptography Competition
 * - Reference implementation: rweather/lightweight-crypto
 *
 * This implementation is for educational purposes only.
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== GIFT-128 NIBBLE-BASED IMPLEMENTATION =====

  // Round constants for GIFT-128 (bit-sliced representation)
  const GIFT128_RC = new Uint8Array([
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
    0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
    0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
    0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E, 0x1C, 0x38,
    0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
  ]);

  // GIFT-128 key schedule (nibble-based variant for HYENA)
  class GIFT128NKeySchedule {
    constructor(key) {
      // HYENA uses little-endian nibble-based representation
      // Per C reference line 789: k[0]=key[0..3], k[1]=key[8..11], k[2]=key[4..7], k[3]=key[12..15]
      this.k = new Uint32Array(4);
      this.k[0] = OpCodes.Pack32LE(key[0], key[1], key[2], key[3]);
      this.k[1] = OpCodes.Pack32LE(key[8], key[9], key[10], key[11]);
      this.k[2] = OpCodes.Pack32LE(key[4], key[5], key[6], key[7]);
      this.k[3] = OpCodes.Pack32LE(key[12], key[13], key[14], key[15]);
    }
  }

  // Bit permutation helper
  function bitPermuteStep(value, mask, shift) {
    const t = ((value >>> shift) ^ value) & mask;
    return ((value ^ t) ^ (t << shift)) >>> 0;
  }

  // PERM3_INNER - core permutation for GIFT-128
  function perm3Inner(x) {
    x = bitPermuteStep(x, 0x0a0a0a0a, 3);
    x = bitPermuteStep(x, 0x00cc00cc, 6);
    x = bitPermuteStep(x, 0x0000f0f0, 12);
    x = bitPermuteStep(x, 0x000000ff, 24);
    return x >>> 0;
  }

  // Row permutations PERM0-PERM3
  function perm0(x) {
    return OpCodes.RotL32(perm3Inner(x), 8);
  }

  function perm1(x) {
    return OpCodes.RotL32(perm3Inner(x), 16);
  }

  function perm2(x) {
    return OpCodes.RotL32(perm3Inner(x), 24);
  }

  function perm3(x) {
    return perm3Inner(x);
  }

  // Convert nibble-based to word-based representation
  function gift128nToWords(input) {
    // Load as little-endian 32-bit words
    let s0 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);
    let s1 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
    let s2 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let s3 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);

    // Apply permutation to convert nibbles to bit-sliced words
    function permWords(x) {
      x = bitPermuteStep(x, 0x0a0a0a0a, 3);
      x = bitPermuteStep(x, 0x00cc00cc, 6);
      x = bitPermuteStep(x, 0x0000f0f0, 12);
      x = bitPermuteStep(x, 0x0000ff00, 8);
      return x >>> 0;
    }

    s0 = permWords(s0);
    s1 = permWords(s1);
    s2 = permWords(s2);
    s3 = permWords(s3);

    // Rearrange bytes
    const output = new Uint8Array(16);
    output[0] = s0 & 0xFF;
    output[1] = s1 & 0xFF;
    output[2] = s2 & 0xFF;
    output[3] = s3 & 0xFF;
    output[4] = (s0 >>> 8) & 0xFF;
    output[5] = (s1 >>> 8) & 0xFF;
    output[6] = (s2 >>> 8) & 0xFF;
    output[7] = (s3 >>> 8) & 0xFF;
    output[8] = (s0 >>> 16) & 0xFF;
    output[9] = (s1 >>> 16) & 0xFF;
    output[10] = (s2 >>> 16) & 0xFF;
    output[11] = (s3 >>> 16) & 0xFF;
    output[12] = (s0 >>> 24) & 0xFF;
    output[13] = (s1 >>> 24) & 0xFF;
    output[14] = (s2 >>> 24) & 0xFF;
    output[15] = (s3 >>> 24) & 0xFF;

    return output;
  }

  // Convert word-based to nibble-based representation
  function gift128nToNibbles(input) {
    // Load bytes and rearrange
    const s0 = (input[12] << 24) | (input[8] << 16) | (input[4] << 8) | input[0];
    const s1 = (input[13] << 24) | (input[9] << 16) | (input[5] << 8) | input[1];
    const s2 = (input[14] << 24) | (input[10] << 16) | (input[6] << 8) | input[2];
    const s3 = (input[15] << 24) | (input[11] << 16) | (input[7] << 8) | input[3];

    // Apply inverse permutation
    function invPermWords(x) {
      x = bitPermuteStep(x, 0x00aa00aa, 7);
      x = bitPermuteStep(x, 0x0000cccc, 14);
      x = bitPermuteStep(x, 0x00f000f0, 4);
      x = bitPermuteStep(x, 0x0000ff00, 8);
      return x >>> 0;
    }

    const t0 = invPermWords(s0);
    const t1 = invPermWords(s1);
    const t2 = invPermWords(s2);
    const t3 = invPermWords(s3);

    // Store as little-endian 32-bit words
    const output = new Uint8Array(16);
    const words = [t0, t1, t2, t3];
    for (let i = 0; i < 4; ++i) {
      const w = words[3 - i];
      output[i * 4] = w & 0xFF;
      output[i * 4 + 1] = (w >>> 8) & 0xFF;
      output[i * 4 + 2] = (w >>> 16) & 0xFF;
      output[i * 4 + 3] = (w >>> 24) & 0xFF;
    }

    return output;
  }

  // GIFT-128 bit-sliced encryption (TINY variant - matches C reference exactly)
  function gift128bEncrypt(ks, state) {
    let s0 = OpCodes.Pack32BE(state[0], state[1], state[2], state[3]);
    let s1 = OpCodes.Pack32BE(state[4], state[5], state[6], state[7]);
    let s2 = OpCodes.Pack32BE(state[8], state[9], state[10], state[11]);
    let s3 = OpCodes.Pack32BE(state[12], state[13], state[14], state[15]);

    // Initialize key words (pre-swapped for round function, per C line 1096-1099)
    let w0 = ks.k[3];
    let w1 = ks.k[1];
    let w2 = ks.k[2];
    let w3 = ks.k[0];

    // Perform 40 rounds (per C line 1102-1133)
    for (let round = 0; round < 40; ++round) {
      // SubCells - apply S-box (per C line 1104-1113)
      s1 ^= s0 & s2;
      s0 ^= s1 & s3;
      s2 ^= s0 | s1;
      s3 ^= s2;
      s1 ^= s3;
      s3 ^= 0xFFFFFFFF;
      s2 ^= s0 & s1;
      const temp = s0;
      s0 = s3;
      s3 = temp;

      // PermBits - apply 128-bit permutation (per C line 1116-1119)
      s0 = perm0(s0);
      s1 = perm1(s1);
      s2 = perm2(s2);
      s3 = perm3(s3);

      // AddRoundKey - XOR with key schedule and round constant (per C line 1122-1124)
      s2 ^= w1;
      s1 ^= w3;
      s3 = (s3 ^ (0x80000000 ^ GIFT128_RC[round])) >>> 0;

      // Rotate the key schedule (per C line 1127-1132)
      const temp2 = w3;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = (((temp2 & 0xFFFC0000) >>> 2) | ((temp2 & 0x00030000) << 14) |
            ((temp2 & 0x00000FFF) << 4) | ((temp2 & 0x0000F000) >>> 12)) >>> 0;
    }

    // Write output
    const b0 = OpCodes.Unpack32BE(s0);
    const b1 = OpCodes.Unpack32BE(s1);
    const b2 = OpCodes.Unpack32BE(s2);
    const b3 = OpCodes.Unpack32BE(s3);

    return [
      b0[0], b0[1], b0[2], b0[3],
      b1[0], b1[1], b1[2], b1[3],
      b2[0], b2[1], b2[2], b2[3],
      b3[0], b3[1], b3[2], b3[3]
    ];
  }

  // GIFT-128 nibble-based encryption (wrapper around bit-sliced)
  function gift128nEncrypt(ks, output, input) {
    const words = gift128nToWords(input);
    const encrypted = gift128bEncrypt(ks, words);
    const nibbles = gift128nToNibbles(encrypted);
    for (let i = 0; i < 16; ++i) {
      output[i] = nibbles[i];
    }
  }

  // ===== HYENA DELTA OPERATIONS =====

  // Double a delta value in F(2^64) field
  // D = D << 1 if top bit is 0, or D = (D << 1) ^ 0x1B otherwise
  function hyenaDoubleDelta(D) {
    const mask = (D[0] >>> 7) & 1;
    for (let i = 0; i < 7; ++i) {
      D[i] = ((D[i] << 1) | (D[i + 1] >>> 7)) & 0xFF;
    }
    D[7] = ((D[7] << 1) ^ (mask ? 0x1B : 0)) & 0xFF;
  }

  // Triple a delta value in F(2^64) field
  // D' = D ^ (D << 1) if top bit is 0, or D' = D ^ (D << 1) ^ 0x1B otherwise
  function hyenaTripleDelta(D) {
    const mask = (D[0] >>> 7) & 1;
    for (let i = 0; i < 7; ++i) {
      D[i] ^= ((D[i] << 1) | (D[i + 1] >>> 7)) & 0xFF;
    }
    D[7] ^= ((D[7] << 1) ^ (mask ? 0x1B : 0)) & 0xFF;
  }

  // ===== HYENA-v1 IMPLEMENTATION =====

  // Process associated data for HYENA-v1
  function hyenaV1ProcessAD(ks, Y, D, ad, adlen, mlen) {
    const feedback = new Uint8Array(16);
    hyenaDoubleDelta(D);

    let pos = 0;
    while (adlen > 16) {
      // Copy AD to feedback
      for (let i = 0; i < 16; ++i) {
        feedback[i] = ad[pos + i];
      }

      // XOR feedback with Y[8..15] and D
      for (let i = 0; i < 8; ++i) {
        feedback[8 + i] ^= Y[8 + i] ^ D[i];
      }

      // XOR Y with feedback
      for (let i = 0; i < 16; ++i) {
        Y[i] ^= feedback[i];
      }

      // Encrypt Y in-place
      gift128nEncrypt(ks, Y, Y);
      hyenaDoubleDelta(D);

      pos += 16;
      adlen -= 16;
    }

    // Process last AD block
    if (adlen === 16) {
      hyenaDoubleDelta(D);
      for (let i = 0; i < 16; ++i) {
        feedback[i] = ad[pos + i];
      }
      for (let i = 0; i < 8; ++i) {
        feedback[8 + i] ^= Y[8 + i] ^ D[i];
      }
      for (let i = 0; i < 16; ++i) {
        Y[i] ^= feedback[i];
      }
    } else {
      hyenaDoubleDelta(D);
      hyenaDoubleDelta(D);
      for (let i = 0; i < adlen; ++i) {
        feedback[i] = ad[pos + i];
      }
      feedback[adlen] = 0x01;
      for (let i = adlen + 1; i < 16; ++i) {
        feedback[i] = 0;
      }
      if (adlen > 8) {
        for (let i = 8; i < adlen; ++i) {
          feedback[i] ^= Y[i];
        }
      }
      for (let i = 0; i < 8; ++i) {
        feedback[8 + i] ^= D[i];
      }
      for (let i = 0; i < 16; ++i) {
        Y[i] ^= feedback[i];
      }
    }
  }

  // HYENA-v1 encryption
  function hyenaV1Encrypt(key, nonce, plaintext, ad) {
    const ks = new GIFT128NKeySchedule(key);
    const Y = new Uint8Array(16);
    const D = new Uint8Array(8);
    const feedback = new Uint8Array(16);

    // Initialize Y with domain separation
    Y[0] = 0;
    if (ad.length === 0) {
      Y[0] |= 0x01;
    }
    if (ad.length === 0 && plaintext.length === 0) {
      Y[0] |= 0x02;
    }
    Y[1] = 0;
    Y[2] = 0;
    Y[3] = 0;
    for (let i = 0; i < 12; ++i) {
      Y[4 + i] = nonce[i];
    }

    // Encrypt Y to initialize state
    gift128nEncrypt(ks, Y, Y);

    // Copy Y[8..15] to D
    for (let i = 0; i < 8; ++i) {
      D[i] = Y[8 + i];
    }

    // Process associated data
    hyenaV1ProcessAD(ks, Y, D, ad, ad.length, plaintext.length);

    // Encrypt plaintext
    const ciphertext = new Uint8Array(plaintext.length + 16);
    let cpos = 0;
    let mpos = 0;
    let mlen = plaintext.length;

    if (mlen > 0) {
      while (mlen > 16) {
        gift128nEncrypt(ks, Y, Y);
        hyenaDoubleDelta(D);

        for (let i = 0; i < 16; ++i) {
          feedback[i] = plaintext[mpos + i];
        }
        for (let i = 0; i < 8; ++i) {
          feedback[8 + i] ^= Y[8 + i] ^ D[i];
        }
        for (let i = 0; i < 16; ++i) {
          ciphertext[cpos + i] = plaintext[mpos + i] ^ Y[i];
          Y[i] ^= feedback[i];
        }

        cpos += 16;
        mpos += 16;
        mlen -= 16;
      }

      gift128nEncrypt(ks, Y, Y);

      if (mlen === 16) {
        hyenaDoubleDelta(D);
        hyenaDoubleDelta(D);

        for (let i = 0; i < 16; ++i) {
          feedback[i] = plaintext[mpos + i];
        }
        for (let i = 0; i < 8; ++i) {
          feedback[8 + i] ^= Y[8 + i] ^ D[i];
        }
        for (let i = 0; i < 16; ++i) {
          ciphertext[cpos + i] = plaintext[mpos + i] ^ Y[i];
          Y[i] ^= feedback[i];
        }
        cpos += 16;
      } else {
        hyenaDoubleDelta(D);
        hyenaDoubleDelta(D);
        hyenaDoubleDelta(D);

        for (let i = 0; i < mlen; ++i) {
          feedback[i] = plaintext[mpos + i];
        }
        feedback[mlen] = 0x01;
        for (let i = mlen + 1; i < 16; ++i) {
          feedback[i] = 0;
        }
        if (mlen > 8) {
          for (let i = 8; i < mlen; ++i) {
            feedback[i] ^= Y[i];
          }
        }
        for (let i = 0; i < 8; ++i) {
          feedback[8 + i] ^= D[i];
        }
        for (let i = 0; i < mlen; ++i) {
          ciphertext[cpos + i] = plaintext[mpos + i] ^ Y[i];
        }
        for (let i = 0; i < 16; ++i) {
          Y[i] ^= feedback[i];
        }
        cpos += mlen;
      }
    }

    // Swap two halves of Y and generate tag
    for (let i = 0; i < 8; ++i) {
      const temp1 = Y[i];
      const temp2 = Y[i + 8];
      Y[i] = temp2;
      Y[i + 8] = temp1;
    }

    const tag = new Uint8Array(16);
    gift128nEncrypt(ks, tag, Y);

    // Append tag to ciphertext
    for (let i = 0; i < 16; ++i) {
      ciphertext[cpos + i] = tag[i];
    }

    return ciphertext;
  }

  // HYENA-v1 decryption
  function hyenaV1Decrypt(key, nonce, ciphertext, ad) {
    if (ciphertext.length < 16) {
      return null; // Invalid ciphertext length
    }

    const ks = new GIFT128NKeySchedule(key);
    const Y = new Uint8Array(16);
    const D = new Uint8Array(8);
    const feedback = new Uint8Array(16);

    const clen = ciphertext.length - 16;
    const plaintext = new Uint8Array(clen);

    // Initialize Y with domain separation
    Y[0] = 0;
    if (ad.length === 0) {
      Y[0] |= 0x01;
    }
    if (ad.length === 0 && clen === 0) {
      Y[0] |= 0x02;
    }
    Y[1] = 0;
    Y[2] = 0;
    Y[3] = 0;
    for (let i = 0; i < 12; ++i) {
      Y[4 + i] = nonce[i];
    }

    // Encrypt Y to initialize state
    gift128nEncrypt(ks, Y, Y);

    // Copy Y[8..15] to D
    for (let i = 0; i < 8; ++i) {
      D[i] = Y[8 + i];
    }

    // Process associated data
    hyenaV1ProcessAD(ks, Y, D, ad, ad.length, clen);

    // Decrypt ciphertext
    let cpos = 0;
    let mpos = 0;
    let mlen = clen;

    if (mlen > 0) {
      while (mlen > 16) {
        gift128nEncrypt(ks, Y, Y);
        hyenaDoubleDelta(D);

        for (let i = 8; i < 16; ++i) {
          feedback[i] = ciphertext[cpos + i];
        }
        for (let i = 0; i < 16; ++i) {
          plaintext[mpos + i] = ciphertext[cpos + i] ^ Y[i];
        }
        for (let i = 0; i < 8; ++i) {
          feedback[i] = plaintext[mpos + i];
        }
        for (let i = 0; i < 8; ++i) {
          feedback[8 + i] ^= D[i];
        }
        for (let i = 0; i < 16; ++i) {
          Y[i] ^= feedback[i];
        }

        cpos += 16;
        mpos += 16;
        mlen -= 16;
      }

      gift128nEncrypt(ks, Y, Y);

      if (mlen === 16) {
        hyenaDoubleDelta(D);
        hyenaDoubleDelta(D);

        for (let i = 8; i < 16; ++i) {
          feedback[i] = ciphertext[cpos + i];
        }
        for (let i = 0; i < 16; ++i) {
          plaintext[mpos + i] = ciphertext[cpos + i] ^ Y[i];
        }
        for (let i = 0; i < 8; ++i) {
          feedback[i] = plaintext[mpos + i];
        }
        for (let i = 0; i < 8; ++i) {
          feedback[8 + i] ^= D[i];
        }
        for (let i = 0; i < 16; ++i) {
          Y[i] ^= feedback[i];
        }
        cpos += 16;
      } else {
        hyenaDoubleDelta(D);
        hyenaDoubleDelta(D);
        hyenaDoubleDelta(D);

        if (mlen > 8) {
          for (let i = 8; i < mlen; ++i) {
            feedback[i] = ciphertext[cpos + i];
          }
          for (let i = 0; i < mlen; ++i) {
            plaintext[mpos + i] = ciphertext[cpos + i] ^ Y[i];
          }
          for (let i = 0; i < 8; ++i) {
            feedback[i] = plaintext[mpos + i];
          }
        } else {
          for (let i = 0; i < mlen; ++i) {
            plaintext[mpos + i] = ciphertext[cpos + i] ^ Y[i];
          }
          for (let i = 0; i < mlen; ++i) {
            feedback[i] = plaintext[mpos + i];
          }
        }

        feedback[mlen] = 0x01;
        for (let i = mlen + 1; i < 16; ++i) {
          feedback[i] = 0;
        }
        for (let i = 0; i < 8; ++i) {
          feedback[8 + i] ^= D[i];
        }
        for (let i = 0; i < 16; ++i) {
          Y[i] ^= feedback[i];
        }
        cpos += mlen;
      }
    }

    // Swap two halves of Y and compute tag
    for (let i = 0; i < 8; ++i) {
      const temp1 = Y[i];
      const temp2 = Y[i + 8];
      Y[i] = temp2;
      Y[i + 8] = temp1;
    }

    const computedTag = new Uint8Array(16);
    gift128nEncrypt(ks, computedTag, Y);

    // Verify tag (constant-time comparison)
    const receivedTag = ciphertext.slice(cpos, cpos + 16);
    if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
      // Clear plaintext on authentication failure
      OpCodes.ClearArray(plaintext);
      return null;
    }

    return plaintext;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class HyenaAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "HYENA";
      this.description = "NIST Lightweight Cryptography candidate combining GIFT-128 nibble-based cipher with efficient AEAD construction. Uses sponge-like mode with delta values for authenticated encryption.";
      this.inventor = "Subhadeep Banik, Khashayar Barooti, Fatih Balli, Andrea Caforio, F. Betül Durak, Serge Vaudenay";
      this.year = 2020;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("HYENA Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/hyena-spec-round2.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto"),
        new LinkItem("GIFT Cipher", "https://giftcipher.github.io/gift/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC KAT (HYENA-v1.txt)
      // https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count 1 (empty PT, empty AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("F83CA141A233342B1507192F171774A6")
        },
        {
          text: "NIST LWC KAT Count 2 (empty PT, 1-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("E350763873B36471681989E03CDFB4BE")
        },
        {
          text: "NIST LWC KAT Count 3 (empty PT, 2-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("0001"),
          input: [],
          expected: OpCodes.Hex8ToBytes("9A9914D7A8CDFEDB8A688BE6DB7D214F")
        },
        {
          text: "NIST LWC KAT Count 17 (empty PT, 16-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("50A5C6ABBA4CE9171452107468ADE5AE")
        },
        {
          text: "NIST LWC KAT Count 34 (1-byte PT, empty AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("3562C0CAC7E1F43E1B2FA4D8ADDBF15C3F")
        },
        {
          text: "NIST LWC KAT Count 35 (1-byte PT, 1-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/HYENA-v1.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("A79E7781A6274290D22A1A52590920EE64")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new HyenaInstance(this, isInverse);
    }
  }

  // AEAD instance implementing Feed/Result pattern
  class HyenaInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this.inputBuffer = [];
      this.aad = [];
    }

    // Key property
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Nonce property
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 12) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 12)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Associated data property
    set associatedData(adBytes) {
      this.aad = adBytes ? [...adBytes] : [];
    }

    get associatedData() {
      return [...this.aad];
    }

    // Feed/Result pattern implementation
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const key = new Uint8Array(this._key);
      const nonce = new Uint8Array(this._nonce);
      const input = new Uint8Array(this.inputBuffer);
      const ad = new Uint8Array(this.aad);

      let output;
      if (this.isInverse) {
        // Decryption
        output = hyenaV1Decrypt(key, nonce, input, ad);
        if (output === null) {
          throw new Error("Authentication tag verification failed");
        }
      } else {
        // Encryption
        output = hyenaV1Encrypt(key, nonce, input, ad);
      }

      this.inputBuffer = [];
      return Array.from(output);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new HyenaAlgorithm());

  return HyenaAlgorithm;
}));
