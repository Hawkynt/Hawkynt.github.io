/* SKINNY-AEAD Family of Authenticated Encryption Algorithms
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
 *
 * SKINNY-AEAD is a family of lightweight authenticated encryption algorithms
 * based on the SKINNY tweakable block cipher. It was a Round 2 candidate in
 * the NIST Lightweight Cryptography competition.
 *
 * The family consists of six variants:
 * - M1: SKINNY-128-384, 128-bit key, 128-bit nonce, 128-bit tag (primary)
 * - M2: SKINNY-128-384, 128-bit key, 96-bit nonce, 128-bit tag
 * - M3: SKINNY-128-384, 128-bit key, 128-bit nonce, 64-bit tag (PAEF mode)
 * - M4: SKINNY-128-384, 128-bit key, 96-bit nonce, 64-bit tag
 * - M5: SKINNY-128-256, 128-bit key, 96-bit nonce, 128-bit tag
 * - M6: SKINNY-128-256, 128-bit key, 96-bit nonce, 64-bit tag
 *
 * Reference: https://sites.google.com/site/skinnycipher/home
 * Implementation: Based on Southern Storm Software reference implementation
 */

(function(global) {
  'use strict';

  // Load AlgorithmFramework
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  const OpCodes = global.OpCodes;

  // Domain separation prefixes for SKINNY-AEAD variants
  const DOMAIN_SEP_M1 = 0x00;
  const DOMAIN_SEP_M2 = 0x10;
  const DOMAIN_SEP_M3 = 0x08;
  const DOMAIN_SEP_M4 = 0x18;
  const DOMAIN_SEP_M5 = 0x10;
  const DOMAIN_SEP_M6 = 0x18;

  // ==========================================================================
  // Embedded SKINNY-128 Tweakable Block Cipher Functions
  // (Required for direct TK1 manipulation in AEAD modes)
  // ==========================================================================

  // SKINNY-128 S-box (bit-sliced)
  function skinny128_sbox(x) {
    x = OpCodes.ToUint32(x);
    let y;
    x = ~x;
    x = OpCodes.XorN(x, OpCodes.AndN(OpCodes.AndN(OpCodes.Shr32(x, 2), OpCodes.Shr32(x, 3)), 0x11111111));
    y = OpCodes.AndN(OpCodes.AndN(OpCodes.Shl32(x, 5), OpCodes.Shl32(x, 1)), 0x20202020);
    x = OpCodes.XorN(x, OpCodes.XorN(OpCodes.AndN(OpCodes.AndN(OpCodes.Shl32(x, 5), OpCodes.Shl32(x, 4)), 0x40404040), y));
    y = OpCodes.AndN(OpCodes.AndN(OpCodes.Shl32(x, 2), OpCodes.Shl32(x, 1)), 0x80808080);
    x = OpCodes.XorN(x, OpCodes.XorN(OpCodes.AndN(OpCodes.AndN(OpCodes.Shr32(x, 2), OpCodes.Shl32(x, 1)), 0x02020202), y));
    y = OpCodes.AndN(OpCodes.AndN(OpCodes.Shr32(x, 5), OpCodes.Shl32(x, 1)), 0x04040404);
    x = OpCodes.XorN(x, OpCodes.XorN(OpCodes.AndN(OpCodes.AndN(OpCodes.Shr32(x, 1), OpCodes.Shr32(x, 2)), 0x08080808), y));
    x = ~x;
    x = OpCodes.ToUint32(OpCodes.OrN(
         OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(x, 0x08080808), 1),
         OpCodes.Shl32(OpCodes.AndN(x, 0x32323232), 2)),
         OpCodes.OrN(OpCodes.Shl32(OpCodes.AndN(x, 0x01010101), 5),
         OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(x, 0x80808080), 6),
         OpCodes.OrN(OpCodes.Shr32(OpCodes.AndN(x, 0x40404040), 4),
         OpCodes.Shr32(OpCodes.AndN(x, 0x04040404), 2))))));
    return x;
  }

  // LFSR2 for TK2
  function skinny128_LFSR2(x) {
    x = OpCodes.ToUint32(x);
    const shifted = OpCodes.AndN(OpCodes.Shl32(x, 1), 0xFEFEFEFE);
    const feedback = OpCodes.AndN(OpCodes.XorN(OpCodes.Shr32(x, 7), OpCodes.Shr32(x, 5)), 0x01010101);
    return OpCodes.ToUint32(OpCodes.XorN(shifted, feedback));
  }

  // LFSR3 for TK3
  function skinny128_LFSR3(x) {
    x = OpCodes.ToUint32(x);
    const shifted = OpCodes.AndN(OpCodes.Shr32(x, 1), 0x7F7F7F7F);
    const feedback = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(x, 7), OpCodes.Shl32(x, 1)), 0x80808080);
    return OpCodes.ToUint32(OpCodes.XorN(shifted, feedback));
  }

  // Permute half of tweakey
  function skinny128_permute_tk_half(tk, idx) {
    const row2 = tk[idx];
    const row3 = tk[idx + 1];
    const row3_rotated = OpCodes.RotL32(row3, 16);
    tk[idx] = OpCodes.ToUint32(OpCodes.OrN(
               OpCodes.OrN(OpCodes.AndN(OpCodes.Shr32(row2, 8), 0x000000FF),
               OpCodes.AndN(OpCodes.Shl32(row2, 16), 0x00FF0000)),
               OpCodes.AndN(row3_rotated, 0xFF00FF00)));
    tk[idx + 1] = OpCodes.ToUint32(OpCodes.OrN(
                   OpCodes.OrN(OpCodes.AndN(OpCodes.Shr32(row2, 16), 0x000000FF),
                   OpCodes.AndN(row2, 0xFF000000)),
                   OpCodes.OrN(OpCodes.AndN(OpCodes.Shl32(row3_rotated, 8), 0x0000FF00),
                   OpCodes.AndN(row3_rotated, 0x00FF0000))));
  }

  // SKINNY-128-384 encryption with full tweakey
  function skinny_128_384_encrypt_tk_full(tweakey, output, input) {
    // Load state
    let s0 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
    let s1 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let s2 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
    let s3 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

    // Load tweakey (TK1, TK2, TK3)
    const TK1 = [
      OpCodes.Pack32LE(tweakey[0], tweakey[1], tweakey[2], tweakey[3]),
      OpCodes.Pack32LE(tweakey[4], tweakey[5], tweakey[6], tweakey[7]),
      OpCodes.Pack32LE(tweakey[8], tweakey[9], tweakey[10], tweakey[11]),
      OpCodes.Pack32LE(tweakey[12], tweakey[13], tweakey[14], tweakey[15])
    ];
    const TK2 = [
      OpCodes.Pack32LE(tweakey[16], tweakey[17], tweakey[18], tweakey[19]),
      OpCodes.Pack32LE(tweakey[20], tweakey[21], tweakey[22], tweakey[23]),
      OpCodes.Pack32LE(tweakey[24], tweakey[25], tweakey[26], tweakey[27]),
      OpCodes.Pack32LE(tweakey[28], tweakey[29], tweakey[30], tweakey[31])
    ];
    const TK3 = [
      OpCodes.Pack32LE(tweakey[32], tweakey[33], tweakey[34], tweakey[35]),
      OpCodes.Pack32LE(tweakey[36], tweakey[37], tweakey[38], tweakey[39]),
      OpCodes.Pack32LE(tweakey[40], tweakey[41], tweakey[42], tweakey[43]),
      OpCodes.Pack32LE(tweakey[44], tweakey[45], tweakey[46], tweakey[47])
    ];

    // 56 rounds, 4 at a time
    let rc = 0;
    for (let round = 0; round < 56; round += 4) {
      // Round 1
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s0 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, TK1[0]), TK2[0]), TK3[0]), OpCodes.AndN(rc, 0x0F)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s1, TK1[1]), TK2[1]), TK3[1]), OpCodes.Shr32(rc, 4)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, 0x02));

      s1 = OpCodes.RotL32(s1, 8);
      s2 = OpCodes.RotL32(s2, 16);
      s3 = OpCodes.RotL32(s3, 24);

      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s2));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s0));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s2));

      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      skinny128_permute_tk_half(TK3, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);
      TK3[2] = skinny128_LFSR3(TK3[2]);
      TK3[3] = skinny128_LFSR3(TK3[3]);

      // Round 2
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s3 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s3, TK1[2]), TK2[2]), TK3[2]), OpCodes.AndN(rc, 0x0F)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, TK1[3]), TK2[3]), TK3[3]), OpCodes.Shr32(rc, 4)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, 0x02));

      s0 = OpCodes.RotL32(s0, 8);
      s1 = OpCodes.RotL32(s1, 16);
      s2 = OpCodes.RotL32(s2, 24);

      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s1));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s3));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s1));

      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      skinny128_permute_tk_half(TK3, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);
      TK3[0] = skinny128_LFSR3(TK3[0]);
      TK3[1] = skinny128_LFSR3(TK3[1]);

      // Round 3
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s2 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s2, TK1[0]), TK2[0]), TK3[0]), OpCodes.AndN(rc, 0x0F)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s3, TK1[1]), TK2[1]), TK3[1]), OpCodes.Shr32(rc, 4)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, 0x02));

      s3 = OpCodes.RotL32(s3, 8);
      s0 = OpCodes.RotL32(s0, 16);
      s1 = OpCodes.RotL32(s1, 24);

      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s0));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s2));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s0));

      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      skinny128_permute_tk_half(TK3, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);
      TK3[2] = skinny128_LFSR3(TK3[2]);
      TK3[3] = skinny128_LFSR3(TK3[3]);

      // Round 4
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s1 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s1, TK1[2]), TK2[2]), TK3[2]), OpCodes.AndN(rc, 0x0F)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s2, TK1[3]), TK2[3]), TK3[3]), OpCodes.Shr32(rc, 4)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, 0x02));

      s2 = OpCodes.RotL32(s2, 8);
      s3 = OpCodes.RotL32(s3, 16);
      s0 = OpCodes.RotL32(s0, 24);

      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s3));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s1));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s3));

      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      skinny128_permute_tk_half(TK3, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);
      TK3[0] = skinny128_LFSR3(TK3[0]);
      TK3[1] = skinny128_LFSR3(TK3[1]);
    }

    // Pack result
    const s0_bytes = OpCodes.Unpack32LE(s0);
    const s1_bytes = OpCodes.Unpack32LE(s1);
    const s2_bytes = OpCodes.Unpack32LE(s2);
    const s3_bytes = OpCodes.Unpack32LE(s3);

    for (let i = 0; i < 4; i++) {
      output[i] = s0_bytes[i];
      output[4 + i] = s1_bytes[i];
      output[8 + i] = s2_bytes[i];
      output[12 + i] = s3_bytes[i];
    }
  }

  // SKINNY-128-256 encryption with full tweakey
  function skinny_128_256_encrypt_tk_full(tweakey, output, input) {
    // Load state
    let s0 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
    let s1 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
    let s2 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
    let s3 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

    // Load tweakey (TK1, TK2)
    const TK1 = [
      OpCodes.Pack32LE(tweakey[0], tweakey[1], tweakey[2], tweakey[3]),
      OpCodes.Pack32LE(tweakey[4], tweakey[5], tweakey[6], tweakey[7]),
      OpCodes.Pack32LE(tweakey[8], tweakey[9], tweakey[10], tweakey[11]),
      OpCodes.Pack32LE(tweakey[12], tweakey[13], tweakey[14], tweakey[15])
    ];
    const TK2 = [
      OpCodes.Pack32LE(tweakey[16], tweakey[17], tweakey[18], tweakey[19]),
      OpCodes.Pack32LE(tweakey[20], tweakey[21], tweakey[22], tweakey[23]),
      OpCodes.Pack32LE(tweakey[24], tweakey[25], tweakey[26], tweakey[27]),
      OpCodes.Pack32LE(tweakey[28], tweakey[29], tweakey[30], tweakey[31])
    ];

    // 48 rounds, 4 at a time
    let rc = 0;
    for (let round = 0; round < 48; round += 4) {
      // Round 1
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s0 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, TK1[0]), TK2[0]), OpCodes.AndN(rc, 0x0F)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s1, TK1[1]), TK2[1]), OpCodes.Shr32(rc, 4)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, 0x02));

      s1 = OpCodes.RotL32(s1, 8);
      s2 = OpCodes.RotL32(s2, 16);
      s3 = OpCodes.RotL32(s3, 24);

      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s2));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s0));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s2));

      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);

      // Round 2
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s3 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s3, TK1[2]), TK2[2]), OpCodes.AndN(rc, 0x0F)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, TK1[3]), TK2[3]), OpCodes.Shr32(rc, 4)));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, 0x02));

      s0 = OpCodes.RotL32(s0, 8);
      s1 = OpCodes.RotL32(s1, 16);
      s2 = OpCodes.RotL32(s2, 24);

      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s1));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s3));
      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s1));

      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);

      // Round 3
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s2 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s2, TK1[0]), TK2[0]), OpCodes.AndN(rc, 0x0F)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s3, TK1[1]), TK2[1]), OpCodes.Shr32(rc, 4)));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, 0x02));

      s3 = OpCodes.RotL32(s3, 8);
      s0 = OpCodes.RotL32(s0, 16);
      s1 = OpCodes.RotL32(s1, 24);

      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s0));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s2));
      s1 = OpCodes.ToUint32(OpCodes.XorN(s1, s0));

      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);

      // Round 4
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);

      rc = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(rc, 1), OpCodes.AndN(OpCodes.Shr32(rc, 5), 0x01)), OpCodes.AndN(OpCodes.Shr32(rc, 4), 0x01)), 0x01), 0x3F);
      s1 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s1, TK1[2]), TK2[2]), OpCodes.AndN(rc, 0x0F)));
      s2 = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s2, TK1[3]), TK2[3]), OpCodes.Shr32(rc, 4)));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, 0x02));

      s2 = OpCodes.RotL32(s2, 8);
      s3 = OpCodes.RotL32(s3, 16);
      s0 = OpCodes.RotL32(s0, 24);

      s2 = OpCodes.ToUint32(OpCodes.XorN(s2, s3));
      s3 = OpCodes.ToUint32(OpCodes.XorN(s3, s1));
      s0 = OpCodes.ToUint32(OpCodes.XorN(s0, s3));

      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);
    }

    // Pack result
    const s0_bytes = OpCodes.Unpack32LE(s0);
    const s1_bytes = OpCodes.Unpack32LE(s1);
    const s2_bytes = OpCodes.Unpack32LE(s2);
    const s3_bytes = OpCodes.Unpack32LE(s3);

    for (let i = 0; i < 4; i++) {
      output[i] = s0_bytes[i];
      output[4 + i] = s1_bytes[i];
      output[8 + i] = s2_bytes[i];
      output[12 + i] = s3_bytes[i];
    }
  }

  // ==========================================================================
  // SKINNY-AEAD Implementation
  // ==========================================================================

  class SkinnyAeadAlgorithm extends AeadAlgorithm {
    constructor(variant, nonce_size, tag_size, uses_256) {
      super();

      this.variant = variant;
      this.nonce_size = nonce_size;
      this.tag_size = tag_size;
      this.uses_256 = uses_256;

      this.name = `SKINNY-AEAD-M${variant}`;

      const descriptions = {
        1: 'Primary SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 128-bit nonce, and 128-bit tag. NIST LWC Round 2 candidate.',
        2: 'SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 96-bit nonce, and 128-bit tag. Optimized for shorter nonces.',
        3: 'SKINNY-AEAD PAEF mode using SKINNY-128-384 with 128-bit key, 128-bit nonce, and 64-bit tag. Shorter authentication tag.',
        4: 'SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 96-bit nonce, and 64-bit tag. Compact nonce and tag.',
        5: 'SKINNY-AEAD variant using SKINNY-128-256 with 128-bit key, 96-bit nonce, and 128-bit tag. Faster than 384-bit variants.',
        6: 'SKINNY-AEAD variant using SKINNY-128-256 with 128-bit key, 96-bit nonce, and 64-bit tag. Most compact configuration.'
      };

      this.description = descriptions[variant];
      this.inventor = 'Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim';
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = 'Authenticated Encryption';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(nonce_size, nonce_size, 1)];
      this.SupportedTagSizes = [new KeySize(tag_size, tag_size, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem('SKINNY-AEAD Specification', 'https://sites.google.com/site/skinnycipher/home'),
        new LinkItem('NIST LWC Submission', 'https://csrc.nist.gov/projects/lightweight-cryptography'),
        new LinkItem('Reference Implementation', 'https://github.com/rweather/lightweight-crypto')
      ];

      this.references = [
        new LinkItem('SKINNY Paper (CRYPTO 2016)', 'https://eprint.iacr.org/2016/660'),
        new LinkItem('SKINNY Official Website', 'https://sites.google.com/site/skinnycipher/')
      ];

      this.tests = [];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SkinnyAeadInstance(this, isInverse);
    }
  }

  /**
 * SkinnyAead cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SkinnyAeadInstance extends IAeadInstance {
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
      this._nonce = null;
      this._aad = [];
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Must be 16 bytes.`);
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
      const expectedSize = this.algorithm.nonce_size;
      if (nonceBytes.length !== expectedSize) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes. Must be ${expectedSize} bytes.`);
      }
      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      this._aad = aadBytes ? [...aadBytes] : [];
    }

    get aad() { return [...this._aad]; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      const tagSize = this.algorithm.tag_size;

      if (this.isInverse) {
        if (this.inputBuffer.length < tagSize) {
          throw new Error('Input too short for authentication tag');
        }

        const ciphertext = this.inputBuffer.slice(0, -tagSize);
        const receivedTag = this.inputBuffer.slice(-tagSize);

        const result = this.algorithm.uses_256
          ? this._process256(ciphertext, true)
          : this._process384(ciphertext, true);

        const plaintext = result.data;
        const computedTag = result.tag;

        if (!OpCodes.ConstantTimeCompare(computedTag, receivedTag)) {
          throw new Error('Authentication tag mismatch');
        }

        this.inputBuffer = [];
        this._aad = [];
        return plaintext;
      } else {
        const plaintext = this.inputBuffer;
        const result = this.algorithm.uses_256
          ? this._process256(plaintext, false)
          : this._process384(plaintext, false);

        this.inputBuffer = [];
        this._aad = [];

        return [...result.data, ...result.tag];
      }
    }

    _process384(message, isDecrypt) {
      const variant = this.algorithm.variant;
      const prefix = [DOMAIN_SEP_M1, DOMAIN_SEP_M2, DOMAIN_SEP_M3, DOMAIN_SEP_M4][variant - 1];
      const tagSize = this.algorithm.tag_size;

      // Initialize tweakey: [TK1(16)|TK2(16)|TK3(16)]
      // TK1 = [zeros(16)|nonce(padded)|key(16)] - wait this is wrong
      // From C: TK1[0-15]=0, TK2[16-31]=nonce(padded), TK3[32-47]=key
      const tweakey = new Array(48);

      // TK1: first 16 bytes are zeros initially (will be modified for LFSR/domain)
      for (let i = 0; i < 16; i++) tweakey[i] = 0;

      // TK2: nonce (padded to 16 bytes)
      const nonceLen = this._nonce.length;
      for (let i = 0; i < nonceLen; i++) {
        tweakey[16 + i] = this._nonce[i];
      }
      for (let i = nonceLen; i < 16; i++) {
        tweakey[16 + i] = 0;
      }

      // TK3: key
      for (let i = 0; i < 16; i++) {
        tweakey[32 + i] = this._key[i];
      }

      // Process message
      const sum = new Array(16).fill(0);
      const output = [];
      let mlen = message.length;
      let offset = 0;

      // 64-bit LFSR stored as bytes in little-endian
      const lfsr_bytes = new Array(8).fill(0);
      lfsr_bytes[0] = 1; // Start with 1

      // Set domain for message processing
      tweakey[15] = OpCodes.OrN(prefix, 0);

      // Process complete blocks
      while (mlen >= 16) {
        // Set LFSR in TK1
        for (let i = 0; i < 8; i++) {
          tweakey[i] = lfsr_bytes[i];
        }

        const block = message.slice(offset, offset + 16);
        const result_block = new Array(16);

        if (isDecrypt) {
          // Decrypt block
          skinny_128_384_encrypt_tk_full(tweakey, result_block, block);
          for (let i = 0; i < 16; i++) {
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], result_block[i]));
            output.push(result_block[i]);
          }
        } else {
          // Encrypt block
          for (let i = 0; i < 16; i++) {
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], block[i]));
          }
          skinny_128_384_encrypt_tk_full(tweakey, result_block, block);
          output.push(...result_block);
        }

        offset += 16;
        mlen -= 16;

        // Update 64-bit LFSR
        const feedback = OpCodes.AndN(lfsr_bytes[7], 0x80) ? 0x1B : 0x00;
        for (let i = 7; i > 0; i--) {
          lfsr_bytes[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(lfsr_bytes[i], 1), OpCodes.Shr32(lfsr_bytes[i - 1], 7)), 0xFF);
        }
        lfsr_bytes[0] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(lfsr_bytes[0], 1), feedback), 0xFF);
      }

      // Process final partial block
      for (let i = 0; i < 8; i++) {
        tweakey[i] = lfsr_bytes[i];
      }

      if (mlen > 0) {
        tweakey[15] = OpCodes.OrN(prefix, 1);

        const zero_block = new Array(16).fill(0);
        const keystream = new Array(16);
        skinny_128_384_encrypt_tk_full(tweakey, keystream, zero_block);

        const partial = message.slice(offset);
        for (let i = 0; i < mlen; i++) {
          if (isDecrypt) {
            const p = OpCodes.XorN(partial[i], keystream[i]);
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], p));
            output.push(p);
          } else {
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], partial[i]));
            output.push(OpCodes.XorN(partial[i], keystream[i]));
          }
        }
        sum[mlen] = OpCodes.ToByte(OpCodes.XorN(sum[mlen], 0x80));

        // Update LFSR
        const feedback = OpCodes.AndN(lfsr_bytes[7], 0x80) ? 0x1B : 0x00;
        for (let i = 7; i > 0; i--) {
          lfsr_bytes[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(lfsr_bytes[i], 1), OpCodes.Shr32(lfsr_bytes[i - 1], 7)), 0xFF);
        }
        lfsr_bytes[0] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(lfsr_bytes[0], 1), feedback), 0xFF);
        for (let i = 0; i < 8; i++) {
          tweakey[i] = lfsr_bytes[i];
        }
        tweakey[15] = OpCodes.OrN(prefix, 5);
      } else {
        tweakey[15] = OpCodes.OrN(prefix, 4);
      }

      // Finalize sum
      const finalSum = new Array(16);
      skinny_128_384_encrypt_tk_full(tweakey, finalSum, sum);

      // Authenticate associated data
      if (this._aad.length > 0) {
        this._authenticate384(tweakey, prefix, finalSum, this._aad);
      }

      return {
        data: output,
        tag: finalSum.slice(0, tagSize)
      };
    }

    _authenticate384(tweakey, prefix, tag, ad) {
      let adlen = ad.length;
      let offset = 0;

      const lfsr_bytes = new Array(8).fill(0);
      lfsr_bytes[0] = 1;

      tweakey[15] = OpCodes.OrN(prefix, 2);

      // Process complete blocks
      while (adlen >= 16) {
        for (let i = 0; i < 8; i++) {
          tweakey[i] = lfsr_bytes[i];
        }

        const block = ad.slice(offset, offset + 16);
        const encrypted = new Array(16);
        skinny_128_384_encrypt_tk_full(tweakey, encrypted, block);

        for (let i = 0; i < 16; i++) {
          tag[i] = OpCodes.ToByte(OpCodes.XorN(tag[i], encrypted[i]));
        }

        offset += 16;
        adlen -= 16;

        const feedback = OpCodes.AndN(lfsr_bytes[7], 0x80) ? 0x1B : 0x00;
        for (let i = 7; i > 0; i--) {
          lfsr_bytes[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(lfsr_bytes[i], 1), OpCodes.Shr32(lfsr_bytes[i - 1], 7)), 0xFF);
        }
        lfsr_bytes[0] = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(lfsr_bytes[0], 1), feedback), 0xFF);
      }

      // Process final partial block
      if (adlen > 0) {
        for (let i = 0; i < 8; i++) {
          tweakey[i] = lfsr_bytes[i];
        }
        tweakey[15] = OpCodes.OrN(prefix, 3);

        const block = new Array(16).fill(0);
        for (let i = 0; i < adlen; i++) {
          block[i] = ad[offset + i];
        }
        block[adlen] = 0x80;

        const encrypted = new Array(16);
        skinny_128_384_encrypt_tk_full(tweakey, encrypted, block);

        for (let i = 0; i < 16; i++) {
          tag[i] = OpCodes.ToByte(OpCodes.XorN(tag[i], encrypted[i]));
        }
      }
    }

    _process256(message, isDecrypt) {
      const variant = this.algorithm.variant;
      const prefix = [DOMAIN_SEP_M5, DOMAIN_SEP_M6][variant - 5];
      const tagSize = this.algorithm.tag_size;

      // Initialize tweakey: [TK1(16)|TK2(16)]
      // TK1 = nonce(right-aligned with zero padding) + domain byte
      // TK2 = key
      const tweakey = new Array(32);

      const nonceLen = this._nonce.length;
      for (let i = 0; i < 16 - nonceLen; i++) {
        tweakey[i] = 0;
      }
      for (let i = 0; i < nonceLen; i++) {
        tweakey[16 - nonceLen + i] = this._nonce[i];
      }

      for (let i = 0; i < 16; i++) {
        tweakey[16 + i] = this._key[i];
      }

      // Process message
      const sum = new Array(16).fill(0);
      const output = [];
      let mlen = message.length;
      let offset = 0;

      // 24-bit LFSR
      let lfsr = 1;

      // Set domain for message processing
      tweakey[3] = OpCodes.OrN(prefix, 0);

      // Process complete blocks
      while (mlen >= 16) {
        // Set LFSR in TK1
        tweakey[0] = OpCodes.AndN(lfsr, 0xFF);
        tweakey[1] = OpCodes.AndN(OpCodes.Shr32(lfsr, 8), 0xFF);
        tweakey[2] = OpCodes.AndN(OpCodes.Shr32(lfsr, 16), 0xFF);

        const block = message.slice(offset, offset + 16);
        const result_block = new Array(16);

        if (isDecrypt) {
          skinny_128_256_encrypt_tk_full(tweakey, result_block, block);
          for (let i = 0; i < 16; i++) {
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], result_block[i]));
            output.push(result_block[i]);
          }
        } else {
          for (let i = 0; i < 16; i++) {
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], block[i]));
          }
          skinny_128_256_encrypt_tk_full(tweakey, result_block, block);
          output.push(...result_block);
        }

        offset += 16;
        mlen -= 16;

        // Update 24-bit LFSR
        const feedback = OpCodes.AndN(lfsr, 0x800000) ? 0x1B : 0x00;
        lfsr = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(lfsr, 1), feedback), 0xFFFFFF);
      }

      // Process final partial block
      tweakey[0] = OpCodes.AndN(lfsr, 0xFF);
      tweakey[1] = OpCodes.AndN(OpCodes.Shr32(lfsr, 8), 0xFF);
      tweakey[2] = OpCodes.AndN(OpCodes.Shr32(lfsr, 16), 0xFF);

      if (mlen > 0) {
        tweakey[3] = OpCodes.OrN(prefix, 1);

        const zero_block = new Array(16).fill(0);
        const keystream = new Array(16);
        skinny_128_256_encrypt_tk_full(tweakey, keystream, zero_block);

        const partial = message.slice(offset);
        for (let i = 0; i < mlen; i++) {
          if (isDecrypt) {
            const p = OpCodes.XorN(partial[i], keystream[i]);
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], p));
            output.push(p);
          } else {
            sum[i] = OpCodes.ToByte(OpCodes.XorN(sum[i], partial[i]));
            output.push(OpCodes.XorN(partial[i], keystream[i]));
          }
        }
        sum[mlen] = OpCodes.ToByte(OpCodes.XorN(sum[mlen], 0x80));

        const feedback = OpCodes.AndN(lfsr, 0x800000) ? 0x1B : 0x00;
        lfsr = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(lfsr, 1), feedback), 0xFFFFFF);
        tweakey[0] = OpCodes.AndN(lfsr, 0xFF);
        tweakey[1] = OpCodes.AndN(OpCodes.Shr32(lfsr, 8), 0xFF);
        tweakey[2] = OpCodes.AndN(OpCodes.Shr32(lfsr, 16), 0xFF);
        tweakey[3] = OpCodes.OrN(prefix, 5);
      } else {
        tweakey[3] = OpCodes.OrN(prefix, 4);
      }

      // Finalize sum
      const finalSum = new Array(16);
      skinny_128_256_encrypt_tk_full(tweakey, finalSum, sum);

      // Authenticate associated data
      if (this._aad.length > 0) {
        this._authenticate256(tweakey, prefix, finalSum, this._aad);
      }

      return {
        data: output,
        tag: finalSum.slice(0, tagSize)
      };
    }

    _authenticate256(tweakey, prefix, tag, ad) {
      let adlen = ad.length;
      let offset = 0;
      let lfsr = 1;

      tweakey[3] = OpCodes.OrN(prefix, 2);

      // Process complete blocks
      while (adlen >= 16) {
        tweakey[0] = OpCodes.AndN(lfsr, 0xFF);
        tweakey[1] = OpCodes.AndN(OpCodes.Shr32(lfsr, 8), 0xFF);
        tweakey[2] = OpCodes.AndN(OpCodes.Shr32(lfsr, 16), 0xFF);

        const block = ad.slice(offset, offset + 16);
        const encrypted = new Array(16);
        skinny_128_256_encrypt_tk_full(tweakey, encrypted, block);

        for (let i = 0; i < 16; i++) {
          tag[i] = OpCodes.ToByte(OpCodes.XorN(tag[i], encrypted[i]));
        }

        offset += 16;
        adlen -= 16;

        const feedback = OpCodes.AndN(lfsr, 0x800000) ? 0x1B : 0x00;
        lfsr = OpCodes.AndN(OpCodes.XorN(OpCodes.Shl32(lfsr, 1), feedback), 0xFFFFFF);
      }

      // Process final partial block
      if (adlen > 0) {
        tweakey[0] = OpCodes.AndN(lfsr, 0xFF);
        tweakey[1] = OpCodes.AndN(OpCodes.Shr32(lfsr, 8), 0xFF);
        tweakey[2] = OpCodes.AndN(OpCodes.Shr32(lfsr, 16), 0xFF);
        tweakey[3] = OpCodes.OrN(prefix, 3);

        const block = new Array(16).fill(0);
        for (let i = 0; i < adlen; i++) {
          block[i] = ad[offset + i];
        }
        block[adlen] = 0x80;

        const encrypted = new Array(16);
        skinny_128_256_encrypt_tk_full(tweakey, encrypted, block);

        for (let i = 0; i < 16; i++) {
          tag[i] = OpCodes.ToByte(OpCodes.XorN(tag[i], encrypted[i]));
        }
      }
    }
  }

  // ==========================================================================
  // Create and Register All Six Variants
  // ==========================================================================

  const m1 = new SkinnyAeadAlgorithm(1, 16, 16, false);
  m1.tests = [
    {
      text: 'SKINNY-AEAD-M1 Official Test Vector #1 (empty PT, empty AD)',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M1.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      aad: OpCodes.Hex8ToBytes(''),
      expected: OpCodes.Hex8ToBytes('99CE68EF7B52AAD0E11C6E2FC722426D')
    },
    {
      text: 'SKINNY-AEAD-M1 Official Test Vector #2 (empty PT, 1 byte AD)',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M1.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      aad: OpCodes.Hex8ToBytes('00'),
      expected: OpCodes.Hex8ToBytes('4720E8EA3682D9E9DC5C83563705F8F4')
    },
    {
      text: 'SKINNY-AEAD-M1 Official Test Vector #37 (1 byte PT, 3 bytes AD)',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M1.txt',
      input: OpCodes.Hex8ToBytes('00'),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      aad: OpCodes.Hex8ToBytes('000102'),
      expected: OpCodes.Hex8ToBytes('859DB826629C124578ABA5A459E97A312F')
    }
  ];

  const m2 = new SkinnyAeadAlgorithm(2, 12, 16, false);
  m2.tests = [
    {
      text: 'SKINNY-AEAD-M2 Official Test Vector #1',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M2.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B'),
      aad: OpCodes.Hex8ToBytes(''),
      expected: OpCodes.Hex8ToBytes('B9E76FC4D90272FF24E6386BF522CFE3')
    }
  ];

  const m3 = new SkinnyAeadAlgorithm(3, 16, 8, false);
  m3.tests = [
    {
      text: 'SKINNY-AEAD-M3 Official Test Vector #1',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M3.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      aad: OpCodes.Hex8ToBytes(''),
      expected: OpCodes.Hex8ToBytes('62B08C0557EDCC94')
    }
  ];

  const m4 = new SkinnyAeadAlgorithm(4, 12, 8, false);
  m4.tests = [
    {
      text: 'SKINNY-AEAD-M4 Official Test Vector #1',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M4.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B'),
      aad: OpCodes.Hex8ToBytes(''),
      expected: OpCodes.Hex8ToBytes('F94B439573612A09')
    }
  ];

  const m5 = new SkinnyAeadAlgorithm(5, 12, 16, true);
  m5.tests = [
    {
      text: 'SKINNY-AEAD-M5 Official Test Vector #1',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M5.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B'),
      aad: OpCodes.Hex8ToBytes(''),
      expected: OpCodes.Hex8ToBytes('26171C0816F2CCC821D57F0090F8E1AB')
    }
  ];

  const m6 = new SkinnyAeadAlgorithm(6, 12, 8, true);
  m6.tests = [
    {
      text: 'SKINNY-AEAD-M6 Official Test Vector #1',
      uri: 'https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M6.txt',
      input: OpCodes.Hex8ToBytes(''),
      key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
      nonce: OpCodes.Hex8ToBytes('000102030405060708090A0B'),
      aad: OpCodes.Hex8ToBytes(''),
      expected: OpCodes.Hex8ToBytes('DAAB927F30D9C87B')
    }
  ];

  RegisterAlgorithm(m1);
  RegisterAlgorithm(m2);
  RegisterAlgorithm(m3);
  RegisterAlgorithm(m4);
  RegisterAlgorithm(m5);
  RegisterAlgorithm(m6);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SkinnyAeadAlgorithm,
      SkinnyAeadInstance,
      SkinnyAeadM1: m1,
      SkinnyAeadM2: m2,
      SkinnyAeadM3: m3,
      SkinnyAeadM4: m4,
      SkinnyAeadM5: m5,
      SkinnyAeadM6: m6
    };
  }

})(typeof globalThis !== 'undefined' ? globalThis :
   typeof window !== 'undefined' ? window :
   typeof global !== 'undefined' ? global :
   typeof self !== 'undefined' ? self : this);
