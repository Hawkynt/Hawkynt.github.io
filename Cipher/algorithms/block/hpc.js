/*
 * HPC (Hasty Pudding Cipher) Implementation
 *
 * Author: Rich Schroeppel
 * Year: 1998
 * Type: Variable block size cipher (0-137 billion bits)
 *
 * Description:
 * HPC is an AES candidate cipher featuring variable block sizes from 0 to over 137 billion bits.
 * It consists of 5 sub-ciphers optimized for different block size ranges:
 * - Tiny: 0-35 bits (uses recursive call to Medium cipher)
 * - Short: 36-64 bits
 * - Medium: 65-128 bits
 * - Long: 129-512 bits
 * - Extended: 513+ bits (supports arbitrarily large blocks)
 *
 * Each sub-cipher uses different mixing operations optimized for its block size range.
 * HPC supports tweakable encryption (spice parameter) without changing keys.
 *
 * This implementation uses BigInt for true 64-bit arithmetic, matching the C reference.
 *
 * Reference: https://github.com/iscgar/hasty-pudding
 * Test Vectors: NIST AES submission package
 *
 * Security: EDUCATIONAL USE ONLY - Not recommended for production
 *
 * IMPORTANT: This cipher internally works at BIT LEVEL but provides
 * BYTE-ALIGNED external API for compatibility with AlgorithmFramework.
 */

(function(global) {
  'use strict';

  // Load dependencies
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const OpCodes = global.OpCodes;
  const AlgorithmFramework = global.AlgorithmFramework;

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ========================[ CONSTANTS ]========================

  const HPC_PI19 = 3141592653589793238n;
  const HPC_E19 = 2718281828459045235n;
  const HPC_R220 = 14142135623730950488n;

  const HPC_KX_SIZE = 256;
  const HPC_CIPHER_COUNT = 5;
  const HPC_STIR_PASSES = 3;
  const HPC_ROUND_COUNT = 8;
  const HPC_TWEAK_BIT_SIZE = 512;

  const CIPHER_ID_TINY = 1;
  const CIPHER_ID_SHORT = 2;
  const CIPHER_ID_MEDIUM = 3;
  const CIPHER_ID_LONG = 4;
  const CIPHER_ID_EXTENDED = 5;

  // Permutation tables
  const Perma = [
    OpCodes.XorN(0x243F6A8885A308D3n, 0n),   OpCodes.XorN(0x13198A2E03707344n, 1n),
    OpCodes.XorN(0xA4093822299F31D0n, 2n),   OpCodes.XorN(0x082EFA98EC4E6C89n, 3n),
    OpCodes.XorN(0x452821E638D01377n, 4n),   OpCodes.XorN(0xBE5466CF34E90C6Cn, 5n),
    OpCodes.XorN(0xC0AC29B7C97C50DDn, 6n),   OpCodes.XorN(0x9216D5D98979FB1Bn, 7n),
    OpCodes.XorN(0xB8E1AFED6A267E96n, 8n),   OpCodes.XorN(0xA458FEA3F4933D7En, 9n),
    OpCodes.XorN(0x0D95748F728EB658n, 10n),  OpCodes.XorN(0x7B54A41DC25A59B5n, 11n),
    OpCodes.XorN(0xCA417918B8DB38EFn, 12n),  OpCodes.XorN(0xB3EE1411636FBC2An, 13n),
    OpCodes.XorN(0x61D809CCFB21A991n, 14n),  OpCodes.XorN(0x487CAC605DEC8032n, 15n)
  ];

  const Permai = [
    OpCodes.XorN(0xA4093822299F31D0n, 2n),   OpCodes.XorN(0x61D809CCFB21A991n, 14n),
    OpCodes.XorN(0x487CAC605DEC8032n, 15n),  OpCodes.XorN(0x243F6A8885A308D3n, 0n),
    OpCodes.XorN(0x13198A2E03707344n, 1n),   OpCodes.XorN(0x7B54A41DC25A59B5n, 11n),
    OpCodes.XorN(0xB8E1AFED6A267E96n, 8n),   OpCodes.XorN(0x452821E638D01377n, 4n),
    OpCodes.XorN(0x0D95748F728EB658n, 10n),  OpCodes.XorN(0x082EFA98EC4E6C89n, 3n),
    OpCodes.XorN(0xB3EE1411636FBC2An, 13n),  OpCodes.XorN(0x9216D5D98979FB1Bn, 7n),
    OpCodes.XorN(0xBE5466CF34E90C6Cn, 5n),   OpCodes.XorN(0xC0AC29B7C97C50DDn, 6n),
    OpCodes.XorN(0xA458FEA3F4933D7En, 9n),   OpCodes.XorN(0xCA417918B8DB38EFn, 12n)
  ];

  const Permb = [
    0xB7E151628AED2A6An - 0n,   0xBF7158809CF4F3C7n - 1n,
    0x62E7160F38B4DA56n - 2n,   0xA784D9045190CFEFn - 3n,
    0x324E7738926CFBE5n - 4n,   0xF4BF8D8D8C31D763n - 5n,
    0xDA06C80ABB1185EBn - 6n,   0x4F7C7B5757F59584n - 7n,
    0x90CFD47D7C19BB42n - 8n,   0x158D9554F7B46BCEn - 9n,
    0x8A9A276BCFBFA1C8n - 10n,  0xE5AB6ADD835FD1A0n - 11n,
    0x86D1BF275B9B241Dn - 12n,  0xF0D3D37BE67008E1n - 13n,
    0x0FF8EC6D31BEB5CCn - 14n,  0xEB64749A47DFDFB9n - 15n
  ];

  const Permbi = [
    0xE5AB6ADD835FD1A0n - 11n,  0xF0D3D37BE67008E1n - 13n,
    0x90CFD47D7C19BB42n - 8n,   0xF4BF8D8D8C31D763n - 5n,
    0x4F7C7B5757F59584n - 7n,   0x324E7738926CFBE5n - 4n,
    0x62E7160F38B4DA56n - 2n,   0xBF7158809CF4F3C7n - 1n,
    0x8A9A276BCFBFA1C8n - 10n,  0xEB64749A47DFDFB9n - 15n,
    0xB7E151628AED2A6An - 0n,   0xDA06C80ABB1185EBn - 6n,
    0x0FF8EC6D31BEB5CCn - 14n,  0x86D1BF275B9B241Dn - 12n,
    0x158D9554F7B46BCEn - 9n,   0xA784D9045190CFEFn - 3n
  ];

  // Nibble permutations used by the Tiny cipher's 4-, 5- and 6-bit paths. Each
  // constant packs a permutation of 0..15 as sixteen nibbles, so the image of v
  // is nibble v: (PERMn >> (v * 4)) & 15. PERM1I/PERM2I are the exact inverses,
  // which is what fixes the indexing convention: the shift amount is (v & 15)
  // scaled by four, NOT v masked with (15 << 2). The latter reaches only shift
  // amounts 0, 4, 8 and 12, i.e. four of the sixteen nibbles, collapsing the
  // "permutation" into a four-to-one map and destroying the block's contents.
  const PERM1 = 0x324f6a850d19e7cbn;
  const PERM2 = 0x2b7e1568adf09c43n;
  const PERM1I = 0xc3610a492b8dfe57n;
  const PERM2I = 0x5c62e738d9a10fb4n;

  // Swizzle polynomials for Extended cipher
  const Swizpoly = [
    0x13, 0x25, 0x43, 0x83, 0x11d, 0x211, 0x409,
    0x805, 0x1053, 0x201b, 0x402b, 0x8003, 0x1002d,
    0x20009, 0x40027, 0x80027, 0x100009,
    0x200005, 0x400003, 0x800021, 0x100001b,
    0x2000009, 0x4000047, 0x8000027, 0x10000009,
    0x20000005, 0x40000053, 0x80000009
  ];

  // ========================[ UTILITY FUNCTIONS ]========================

  function mask64(value) {
    return OpCodes.AndN(value, 0xFFFFFFFFFFFFFFFFn);
  }

  function rotL64(value, positions) {
    return OpCodes.RotL64n(value, positions);
  }

  function rotR64(value, positions) {
    return OpCodes.RotR64n(value, positions);
  }

  function getCipherId(dataBitSize) {
    if (dataBitSize <= 35) return CIPHER_ID_TINY;
    if (dataBitSize <= 64) return CIPHER_ID_SHORT;
    if (dataBitSize <= 128) return CIPHER_ID_MEDIUM;
    if (dataBitSize <= 512) return CIPHER_ID_LONG;
    if (dataBitSize <= 137438954048) return CIPHER_ID_EXTENDED;
    return -1;
  }

  // Convert byte array to BigInt (little-endian)
  function bytesToBigInt(bytes, bitSize) {
    let result = 0n;
    const byteCount = Math.ceil(bitSize / 8);
    for (let i = 0; i < byteCount && i < bytes.length; ++i) {
      result |= OpCodes.ShiftLn(BigInt(bytes[i]), BigInt(i * 8));
    }
    // Apply bit mask if not byte-aligned
    if (bitSize % 8 !== 0) {
      const mask = (OpCodes.ShiftLn(1n, BigInt(bitSize))) - 1n;
      result &= mask;
    }
    return result;
  }

  // Convert BigInt to byte array (little-endian)
  function bigIntToBytes(value, bitSize) {
    const byteCount = Math.ceil(bitSize / 8);
    const bytes = new Array(byteCount).fill(0);
    for (let i = 0; i < byteCount; ++i) {
      bytes[i] = Number(OpCodes.AndN((OpCodes.ShiftRn(value, BigInt(i * 8))), 0xFFn));
    }
    return bytes;
  }

  // Pack bytes into 64-bit BigInt array (little-endian per word)
  function packBytesToState(bytes, bitSize) {
    const wordCount = Math.min(HPC_ROUND_COUNT, Math.ceil(bitSize / 64));
    const state = new Array(HPC_ROUND_COUNT).fill(0n);

    const byteLimit = bitSize <= 512 ? Math.ceil(bitSize / 8) : 64;
    const wordLimit = OpCodes.AndN((byteLimit - 1), ~7);

    let byteIdx = 0;
    for (let w = 0; w < wordCount && byteIdx < wordLimit; ++w) {
      for (let b = 0; b < 8 && byteIdx < wordLimit; ++b, ++byteIdx) {
        state[w] |= OpCodes.ShiftLn(BigInt(bytes[byteIdx] || 0), BigInt(b * 8));
      }
    }

    // Handle the trailing word. The loop above deliberately stops on a whole-word
    // boundary below byteLimit, so the final word always lands here - including
    // the 512-bit case, where the eighth word is the trailing one and was
    // previously skipped outright, silently zeroing the top 64 bits of the block.
    if (byteIdx < byteLimit) {
      const lastWordIdx = Math.min(wordCount - 1, Math.floor((bitSize + 63) / 64) - 1);
      for (let b = 0; b < 8 && byteIdx < byteLimit; ++b, ++byteIdx) {
        state[lastWordIdx] |= OpCodes.ShiftLn(BigInt(bytes[byteIdx] || 0), BigInt(b * 8));
      }
    }

    // Apply mask to last word if needed
    if (bitSize < 512) {
      const lastWordIdx = Math.floor((bitSize + 63) / 64) - 1;
      if (lastWordIdx >= 0 && lastWordIdx < HPC_ROUND_COUNT) {
        const mask = (OpCodes.ShiftLn(((OpCodes.ShiftLn(1n, BigInt((bitSize - 1) % 64))) - 1n), 1n))|1n;
        state[lastWordIdx] &= mask;
      }
    }

    return state;
  }

  // Unpack 64-bit BigInt array to bytes (little-endian per word)
  function unpackStateToBytes(state, bitSize) {
    const byteLimit = bitSize <= 512 ? Math.ceil(bitSize / 8) : 64;
    const bytes = new Array(byteLimit).fill(0);
    const wordLimit = OpCodes.AndN((byteLimit - 1), ~7);
    // Index (plus one) of the word holding the trailing bytes. This must be the
    // block's own last word, not word 7: packBytesToState writes the trailing
    // bytes to ceil(bitSize/64)-1, so hardcoding 7 for every block wider than
    // 128 bits read the tail back out of a word the block never occupied.
    const lastWord64 = Math.min(HPC_ROUND_COUNT, Math.ceil(bitSize / 64));

    let byteIdx = 0;
    for (let w = 0; w < HPC_ROUND_COUNT && byteIdx < wordLimit; ++w) {
      for (let sh = 0; sh < 64 && byteIdx < wordLimit; sh += 8, ++byteIdx) {
        bytes[byteIdx] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[w], BigInt(sh))), 0xFFn));
      }
    }

    // Handle partial last word
    if (byteIdx < byteLimit) {
      const lastWordIdx = lastWord64 - 1;
      for (let sh = 0; sh < 64 && byteIdx < byteLimit; sh += 8, ++byteIdx) {
        bytes[byteIdx] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[lastWordIdx], BigInt(sh))), 0xFFn));
      }
    }

    return bytes;
  }

  // ========================[ KEY EXPANSION ]========================

  function initializeKX(keyBytes, keyBitSize, cipherId, backup) {
    const KX = new Array(HPC_KX_SIZE);

    // Initialize with constants
    KX[0] = mask64(HPC_PI19 + BigInt(cipherId));
    KX[1] = mask64(HPC_E19 * BigInt(keyBitSize));
    KX[2] = mask64(rotL64(HPC_R220, cipherId));

    // Expand using recurrence relation
    for (let i = 3; i < HPC_KX_SIZE; ++i) {
      KX[i] = mask64(KX[i-1] + (OpCodes.XorN(KX[i-2], rotR64(KX[i-3], 23))));
    }

    // Incorporate key material
    let leftKeyBits = keyBitSize;
    let keyOffset = 0;

    while (leftKeyBits > 0) {
      const iterationKeyBits = Math.min(leftKeyBits, HPC_KX_SIZE * 64 / 2);
      const endByte = keyOffset + Math.floor(iterationKeyBits / 8);

      // XOR key bytes into KX
      for (let sh = 0, i = 0; keyOffset < endByte; ++keyOffset, sh = OpCodes.AndN((sh + 8), 63), ++i) {
        KX[Math.floor(i / 8)] ^= OpCodes.ShiftLn(BigInt(keyBytes[keyOffset]), BigInt(sh));
      }

      // Handle leftover bits
      if (OpCodes.AndN(iterationKeyBits, 7)) {
        const leftoverBits = OpCodes.AndN(iterationKeyBits, 7);
        const v = OpCodes.ShiftLn((OpCodes.AndN(BigInt(keyBytes[keyOffset++]), ((OpCodes.ShiftLn(1n, BigInt(leftoverBits))) - 1n))), BigInt(OpCodes.AndN((iterationKeyBits - leftoverBits), 63)));
        KX[Math.floor((iterationKeyBits + 8 - 1) / 64)] ^= v;
      }

      // Stir the key schedule
      let s0 = KX[248], s1 = KX[249], s2 = KX[250], s3 = KX[251];
      let s4 = KX[252], s5 = KX[253], s6 = KX[254], s7 = KX[255];

      for (let pass = 0; pass < HPC_STIR_PASSES + backup; ++pass) {
        for (let ki = 0; ki < HPC_KX_SIZE; ++ki) {
          s0 = mask64(OpCodes.XorN(s0, mask64((OpCodes.XorN(KX[ki], KX[OpCodes.AndN((ki + 83), 255)])) + KX[Number(OpCodes.AndN(s0, 0xFFn))])));
          s2 = mask64(s2 + KX[ki]); // Wagner fix
          s1 = mask64(s1 + s0);
          s3 = mask64(OpCodes.XorN(s3, s2));
          s5 = mask64(s5 - s4);
          s7 = mask64(OpCodes.XorN(s7, s6));
          s3 = mask64(s3 + ((OpCodes.ShiftRn(s0, 13n))));
          s4 = mask64(OpCodes.XorN(s4, ((OpCodes.ShiftLn(s1, 11n)))));
          s5 = mask64(OpCodes.XorN(s5, (OpCodes.ShiftLn(s3, (OpCodes.AndN(s1, 31n))))));
          s6 = mask64(s6 + ((OpCodes.ShiftRn(s2, 17n))));
          s7 = mask64(s7|mask64(s3 + s4));
          s2 = mask64(s2 - s5);
          s0 = mask64(s0 - (OpCodes.XorN(s6, BigInt(ki))));
          s1 = mask64(OpCodes.XorN(s1, mask64(s5 + HPC_PI19)));
          s2 = mask64(s2 + (OpCodes.ShiftRn(s7, BigInt(pass))));
          s2 = mask64(OpCodes.XorN(s2, s1));
          s4 = mask64(s4 - s3);
          s6 = mask64(OpCodes.XorN(s6, s5));
          s0 = mask64(s0 + s7);
          KX[ki] = mask64(s2 + s6);
        }
      }

      leftKeyBits -= iterationKeyBits;
    }

    return KX;
  }

  // ========================[ FIBONACCI FOLD ]========================

  function fibFold(N0, N1) {
    let n = mask64(N0 + ((OpCodes.ShiftRn(N1, 25n))));
    let n1 = mask64(N1 + (n < N0 ? 1n : 0n));

    n = mask64(OpCodes.XorN(n, (((OpCodes.ShiftLn(n1, 9n)))|((OpCodes.ShiftRn(n, 55n))))));
    n1 = mask64(OpCodes.XorN(n1, ((OpCodes.ShiftRn(n1, 55n)))));

    n = mask64(n + (((OpCodes.ShiftLn(n1, 30n)))|((OpCodes.ShiftRn(n, 34n)))));
    n = mask64(OpCodes.XorN(n, ((OpCodes.ShiftRn(n, 21n)))));
    n = mask64(n + ((OpCodes.ShiftRn(n, 13n))));
    n = mask64(OpCodes.XorN(n, ((OpCodes.ShiftRn(n, 8n)))));
    n = mask64(n + ((OpCodes.ShiftRn(n, 5n))));
    n = mask64(OpCodes.XorN(n, ((OpCodes.ShiftRn(n, 3n)))));
    n = mask64(n + ((OpCodes.ShiftRn(n, 2n))));
    n = mask64(OpCodes.XorN(n, ((OpCodes.ShiftRn(n, 1n)))));
    n = mask64(n + ((OpCodes.ShiftRn(n, 1n))));

    return Number(OpCodes.AndN(n, 1n));
  }

  // ========================[ TINY CIPHER (0-35 bits) ]========================

  function tinyEncrypt(state, spice, KX, blockSize, mask, backup) {
    let s0 = state[0];

    if (blockSize <= 4) {
      // 1-4 bits: use Medium cipher as subcipher
      const tmp = [
        mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 16] + KX[128] + BigInt(backup)),
        mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 17] + KX[129])
      ];

      mediumEncrypt(tmp, spice, KX, 128, 0xFFFFFFFFFFFFFFFFn, 0);

      tmp[0] = mask64(tmp[0] + KX[136]);
      tmp[1] = mask64(tmp[1] + KX[137]);

      if (blockSize === 1) {
        // 1 bit
        s0 = (OpCodes.XorN(s0, BigInt(fibFold(tmp[0], tmp[1]))));
      } else if (blockSize === 2 || blockSize === 3) {
        // 2-3 bits
        for (let ri = 0; ri < 2; ++ri) {
          let t = tmp[ri];
          for (let bi = 0; bi < 64; bi += (OpCodes.Shl32(blockSize, 1))) {
            s0 = mask64(OpCodes.XorN(s0, t));
            t = OpCodes.ShiftRn(t, BigInt(blockSize));
            s0 = mask64(s0 + t);
            s0 = mask64(((OpCodes.ShiftLn(s0, 1n)))|(OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), BigInt(blockSize - 1))));
            t = OpCodes.ShiftRn(t, BigInt(blockSize));
          }
        }
      } else {
        // 4 bits
        for (let ri = 0; ri < 2; ++ri) {
          let t = tmp[ri];
          for (let bi = 0; bi < 64; bi += 8) {
            s0 = mask64(OpCodes.XorN(s0, t));
            t = OpCodes.ShiftRn(t, 4n);
            s0 = (OpCodes.AndN((OpCodes.ShiftRn(PERM1, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n));
            s0 = mask64(s0 + t);
            s0 = (OpCodes.AndN((OpCodes.ShiftRn(PERM2, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n));
            t = OpCodes.ShiftRn(t, 4n);
          }
        }
      }
    } else if (blockSize === 5 || blockSize === 6) {
      // 5-6 bits: use Long cipher as subcipher
      const tmpBs = OpCodes.Shl32(96, (blockSize - 4));
      const tmp = new Array(HPC_ROUND_COUNT).fill(0n);
      const bsBase = OpCodes.AndN(tmpBs, 0xFF);
      const l64 = (OpCodes.Shr32(tmpBs, 6)) - 1;

      for (let i = 0; i < (OpCodes.Shr32(tmpBs, 6)) - 1; ++i) {
        tmp[i] = mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 16 + i] + KX[bsBase + i]);
      }
      tmp[HPC_ROUND_COUNT - 1] = mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 16 + l64] + KX[bsBase + HPC_ROUND_COUNT - 1]);
      tmp[0] = mask64(tmp[0] + BigInt(backup));

      longEncrypt(tmp, spice, KX, tmpBs, 0xFFFFFFFFFFFFFFFFn, 0);

      for (let i = 0; i < (OpCodes.Shr32(tmpBs, 6)) - 1; ++i) {
        tmp[i] = mask64(tmp[i] + KX[bsBase + HPC_ROUND_COUNT + i]);
      }
      tmp[(OpCodes.Shr32(tmpBs, 6)) - 1] = mask64(tmp[HPC_ROUND_COUNT - 1] + KX[bsBase + (OpCodes.Shl32(HPC_ROUND_COUNT, 1)) - 1]);

      const pmask = OpCodes.XorN((OpCodes.AndN(mask, 0xFFn)), 15n);

      for (let ri = 0; ri < (OpCodes.Shr32(tmpBs, 6)); ++ri) {
        let t = tmp[ri];
        for (let bi = 0; bi < (7 - (blockSize - 5)); ++bi) {
          s0 = mask64(OpCodes.XorN(s0, t));
          s0 = (OpCodes.AndN(s0, pmask))|((OpCodes.AndN((OpCodes.ShiftRn(PERM1, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n)));
          s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 3n)))));
          t = OpCodes.ShiftRn(t, BigInt(blockSize));
          s0 = mask64(s0 + t);
          s0 = (OpCodes.AndN(s0, pmask))|((OpCodes.AndN((OpCodes.ShiftRn(PERM2, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n)));
          t = OpCodes.ShiftRn(t, BigInt(blockSize - 1));
        }
      }
    } else {
      // 7-35 bits
      const LBH = OpCodes.Shr32((blockSize + 1), 1);

      const tmp = [
        mask64((OpCodes.XorN(spice[0], KX[(OpCodes.Shl32(blockSize, 2)) + 16])) + KX[0] + BigInt(backup)),
        mask64((OpCodes.XorN(spice[1], KX[(OpCodes.Shl32(blockSize, 2)) + 17])) + KX[1]),
        mask64((OpCodes.XorN(spice[2], KX[(OpCodes.Shl32(blockSize, 2)) + 18])) + KX[2]),
        mask64((OpCodes.XorN(spice[3], KX[(OpCodes.Shl32(blockSize, 2)) + 19])) + KX[3]),
        mask64((OpCodes.XorN(spice[4], KX[(OpCodes.Shl32(blockSize, 2)) + 20])) + KX[4]),
        mask64((OpCodes.XorN(spice[5], KX[(OpCodes.Shl32(blockSize, 2)) + 21])) + KX[5]),
        mask64((OpCodes.XorN(spice[6], KX[(OpCodes.Shl32(blockSize, 2)) + 22])) + KX[6]),
        mask64((OpCodes.XorN(spice[7], KX[(OpCodes.Shl32(blockSize, 2)) + 23])) + KX[7]),
        0n, 0n
      ];
      const zspice = new Array(HPC_ROUND_COUNT).fill(0n);

      longEncrypt(tmp, zspice, KX, 512, 0xFFFFFFFFFFFFFFFFn, 0);

      for (let i = 0; i < HPC_ROUND_COUNT; ++i) {
        tmp[i] = mask64(tmp[i] + KX[HPC_ROUND_COUNT + i]);
      }

      tmp[8] = tmp[9] = tmp[7];

      for (let ri = 0; ri < HPC_ROUND_COUNT; ++ri) {
        tmp[8] = mask64(tmp[8] + (OpCodes.XorN(((OpCodes.ShiftLn(tmp[8], 21n)) + (OpCodes.ShiftRn(tmp[8], 13n))), (tmp[ri] + KX[ri + 16]))));
        tmp[9] = mask64(OpCodes.XorN(tmp[9], tmp[8]));
      }

      if (blockSize < 16) {
        for (let ri = 0; ri < HPC_ROUND_COUNT + 2; ++ri) {
          let t = tmp[ri];
          for (let bi = 0; bi < 64; bi += (OpCodes.Shl32(blockSize, 1))) {
            s0 = mask64(s0 + t);
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftLn(KX[(16 * ri) + Number(OpCodes.AndN(s0, 15n))], 4n))));
            s0 = mask64((OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), 4n))|(OpCodes.ShiftLn(s0, BigInt(blockSize - 4))));
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), BigInt(LBH)))));
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(t, BigInt(blockSize)))));
            s0 = mask64(s0 + (OpCodes.ShiftLn(s0, BigInt(LBH + 2))));
            s0 = mask64(OpCodes.XorN(s0, Perma[Number(OpCodes.AndN(s0, 15n))]));
            s0 = mask64(s0 + (OpCodes.ShiftLn(s0, BigInt(LBH))));
            t = OpCodes.ShiftRn(t, BigInt(OpCodes.Shl32(blockSize, 1)));
          }
        }
      } else {
        for (let ri = 0; ri < HPC_ROUND_COUNT + 2; ++ri) {
          let t = tmp[ri];
          for (let bi = 0; bi < 64; bi += blockSize) {
            s0 = mask64(s0 + t);
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftLn(KX[Number(OpCodes.AndN(s0, 0xFFn))], 8n))));
            s0 = mask64((OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), 8n))|(OpCodes.ShiftLn(s0, BigInt(blockSize - 8))));
            t = OpCodes.ShiftRn(t, BigInt(blockSize));
          }
        }
      }
    }

    state[0] = s0;
  }

  function tinyDecrypt(state, spice, KX, blockSize, mask, backup) {
    let s0 = state[0];

    if (blockSize <= 4) {
      const tmp = [
        mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 16] + KX[128] + BigInt(backup)),
        mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 17] + KX[129])
      ];

      mediumEncrypt(tmp, spice, KX, 128, 0xFFFFFFFFFFFFFFFFn, 0);

      tmp[0] = mask64(tmp[0] + KX[136]);
      tmp[1] = mask64(tmp[1] + KX[137]);

      if (blockSize === 1) {
        s0 = (OpCodes.XorN(s0, BigInt(fibFold(tmp[0], tmp[1]))));
      } else if (blockSize === 2 || blockSize === 3) {
        for (let ri = 2; ri-- > 0; ) {
          const t = tmp[ri];
          for (let bi = Math.ceil(64 / (OpCodes.Shl32(blockSize, 1))); bi-- > 0; ) {
            const v = OpCodes.AndN((OpCodes.ShiftRn(t, BigInt(bi * (OpCodes.Shl32(blockSize, 1))))), ((OpCodes.ShiftLn(1n, BigInt(OpCodes.Shl32(blockSize, 1)))) - 1n));
            s0 = mask64((OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), 1n))|(OpCodes.ShiftLn(s0, BigInt(blockSize - 1))));
            s0 = mask64(s0 - (OpCodes.ShiftRn(v, BigInt(blockSize))));
            s0 = mask64(OpCodes.XorN(s0, v));
          }
        }
      } else {
        for (let ri = 2; ri-- > 0; ) {
          const t = tmp[ri];
          for (let bi = 64; bi > 0; bi -= 8) {
            const v = OpCodes.AndN((OpCodes.ShiftRn(t, BigInt(bi - 8))), 0xFFn);
            s0 = (OpCodes.AndN((OpCodes.ShiftRn(PERM2I, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n));
            s0 = mask64(s0 - ((OpCodes.ShiftRn(v, 4n))));
            s0 = (OpCodes.AndN((OpCodes.ShiftRn(PERM1I, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n));
            s0 = mask64(OpCodes.XorN(s0, v));
          }
        }
      }
    } else if (blockSize === 5 || blockSize === 6) {
      const tmpBs = OpCodes.Shl32(96, (blockSize - 4));
      const tmp = new Array(HPC_ROUND_COUNT).fill(0n);
      const bsBase = OpCodes.AndN(tmpBs, 0xFF);
      const l64 = (OpCodes.Shr32(tmpBs, 6)) - 1;

      for (let i = 0; i < (OpCodes.Shr32(tmpBs, 6)) - 1; ++i) {
        tmp[i] = mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 16 + i] + KX[bsBase + i]);
      }
      tmp[HPC_ROUND_COUNT - 1] = mask64(KX[(OpCodes.Shl32(blockSize, 1)) + 16 + l64] + KX[bsBase + HPC_ROUND_COUNT - 1]);
      tmp[0] = mask64(tmp[0] + BigInt(backup));

      longEncrypt(tmp, spice, KX, tmpBs, 0xFFFFFFFFFFFFFFFFn, 0);

      for (let i = 0; i < (OpCodes.Shr32(tmpBs, 6)) - 1; ++i) {
        tmp[i] = mask64(tmp[i] + KX[bsBase + HPC_ROUND_COUNT + i]);
      }
      tmp[(OpCodes.Shr32(tmpBs, 6)) - 1] = mask64(tmp[HPC_ROUND_COUNT - 1] + KX[bsBase + (OpCodes.Shl32(HPC_ROUND_COUNT, 1)) - 1]);

      const pmask = OpCodes.XorN((OpCodes.AndN(mask, 0xFFn)), 15n);

      for (let ri = (OpCodes.Shr32(tmpBs, 6)); ri-- > 0; ) {
        const t = tmp[ri];
        for (let bi = (7 - (blockSize - 5)); bi-- > 0; ) {
          // Each forward iteration advances t by blockSize + (blockSize - 1)
          // bits but READS 2*blockSize of them: blockSize for the XOR and the
          // next blockSize for the addition, so successive iterations overlap by
          // one bit. Recovering only (2*blockSize - 1) bits here - the stride
          // rather than the span - dropped the top bit of the addend, which is
          // inside the block mask and therefore changes the result.
          const v = OpCodes.AndN((OpCodes.ShiftRn(t, BigInt(bi * ((OpCodes.Shl32(blockSize, 1)) - 1)))), ((OpCodes.ShiftLn(1n, BigInt(OpCodes.Shl32(blockSize, 1)))) - 1n));
          s0 = (OpCodes.AndN(s0, pmask))|((OpCodes.AndN((OpCodes.ShiftRn(PERM2I, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n)));
          s0 = mask64(s0 - (OpCodes.ShiftRn(v, BigInt(blockSize))));
          s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), 3n))));
          s0 = (OpCodes.AndN(s0, pmask))|((OpCodes.AndN((OpCodes.ShiftRn(PERM1I, OpCodes.ShiftLn(OpCodes.AndN(s0, 15n), 2n))), 15n)));
          s0 = mask64(OpCodes.XorN(s0, v));
        }
      }
    } else {
      const LBH = OpCodes.Shr32((blockSize + 1), 1);

      const tmp = [
        mask64((OpCodes.XorN(spice[0], KX[(OpCodes.Shl32(blockSize, 2)) + 16])) + KX[0] + BigInt(backup)),
        mask64((OpCodes.XorN(spice[1], KX[(OpCodes.Shl32(blockSize, 2)) + 17])) + KX[1]),
        mask64((OpCodes.XorN(spice[2], KX[(OpCodes.Shl32(blockSize, 2)) + 18])) + KX[2]),
        mask64((OpCodes.XorN(spice[3], KX[(OpCodes.Shl32(blockSize, 2)) + 19])) + KX[3]),
        mask64((OpCodes.XorN(spice[4], KX[(OpCodes.Shl32(blockSize, 2)) + 20])) + KX[4]),
        mask64((OpCodes.XorN(spice[5], KX[(OpCodes.Shl32(blockSize, 2)) + 21])) + KX[5]),
        mask64((OpCodes.XorN(spice[6], KX[(OpCodes.Shl32(blockSize, 2)) + 22])) + KX[6]),
        mask64((OpCodes.XorN(spice[7], KX[(OpCodes.Shl32(blockSize, 2)) + 23])) + KX[7]),
        0n, 0n
      ];
      const zspice = new Array(HPC_ROUND_COUNT).fill(0n);

      longEncrypt(tmp, zspice, KX, 512, 0xFFFFFFFFFFFFFFFFn, 0);

      for (let i = 0; i < HPC_ROUND_COUNT; ++i) {
        tmp[i] = mask64(tmp[i] + KX[HPC_ROUND_COUNT + i]);
      }

      tmp[8] = tmp[9] = tmp[7];

      for (let ri = 0; ri < HPC_ROUND_COUNT; ++ri) {
        tmp[8] = mask64(tmp[8] + (OpCodes.XorN(((OpCodes.ShiftLn(tmp[8], 21n)) + (OpCodes.ShiftRn(tmp[8], 13n))), (tmp[ri] + KX[ri + 16]))));
        tmp[9] = mask64(OpCodes.XorN(tmp[9], tmp[8]));
      }

      if (blockSize < 16) {
        for (let ri = HPC_ROUND_COUNT + 2; ri-- > 0; ) {
          const t = tmp[ri];
          for (let bi = Math.ceil(64 / (OpCodes.Shl32(blockSize, 1))); bi-- > 0; ) {
            const v = OpCodes.AndN((OpCodes.ShiftRn(t, BigInt(bi * (OpCodes.Shl32(blockSize, 1))))), ((OpCodes.ShiftLn(1n, BigInt(OpCodes.Shl32(blockSize, 1)))) - 1n));
            s0 = mask64(s0 - (OpCodes.ShiftLn(s0, BigInt(LBH))));
            s0 = mask64(OpCodes.XorN(s0, Permai[Number(OpCodes.AndN(s0, 15n))]));
            s0 = mask64(s0 - (OpCodes.ShiftLn(s0, BigInt(LBH + 2))));
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(v, BigInt(blockSize)))));
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), BigInt(LBH)))));
            s0 = mask64(((OpCodes.ShiftLn(s0, 4n)))|(OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), BigInt(blockSize - 4))));
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftLn(KX[(16 * ri) + Number(OpCodes.AndN(s0, 15n))], 4n))));
            s0 = mask64(s0 - v);
          }
        }
      } else {
        for (let ri = HPC_ROUND_COUNT + 2; ri-- > 0; ) {
          let t = tmp[ri];
          for (let bi = Math.ceil(64 / blockSize); bi-- > 0; ) {
            s0 = mask64(((OpCodes.ShiftLn(s0, 8n)))|(OpCodes.ShiftRn((OpCodes.AndN(s0, mask)), BigInt(blockSize - 8))));
            s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftLn(KX[Number(OpCodes.AndN(s0, 0xFFn))], 8n))));
            s0 = mask64(s0 - (OpCodes.ShiftRn(t, BigInt(bi * blockSize))));
          }
        }
      }
    }

    state[0] = s0;
  }

  // ========================[ SHORT CIPHER (36-64 bits) ]========================

  function shortEncrypt(state, spice, KX, blockSize, mask, backup) {
    const LBH = OpCodes.Shr32((blockSize + 1), 1);
    const LBQ = OpCodes.Shr32((LBH + 1), 1);
    const LBT = (OpCodes.Shr32((blockSize + LBQ), 2)) + 2;
    const GAP = 64 - blockSize;

    let s0 = state[0];

    for (let ri = 0; ri < HPC_ROUND_COUNT; ++ri) {
      let k = mask64(KX[Number(OpCodes.AndN(s0, 0xFFn))] + spice[ri]);
      let t;

      s0 = mask64(s0 + ((OpCodes.ShiftLn(k, 8n))));
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.AndN((OpCodes.ShiftRn(k, BigInt(GAP))), ~0xFFn))));
      s0 = mask64(s0 + (OpCodes.ShiftLn(s0, BigInt(LBH + ri))));
      t = spice[OpCodes.XorN(ri, 7)];
      s0 = mask64(OpCodes.XorN(s0, t));
      s0 = mask64(s0 - (OpCodes.ShiftRn(t, BigInt(GAP + ri))));
      s0 = mask64(s0 + ((OpCodes.ShiftRn(t, 13n))));
      s0 &= mask;

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(LBH)))));
      t = OpCodes.AndN(s0, 0xFFn);
      k = mask64(OpCodes.XorN(KX[Number(t)], spice[OpCodes.XorN(ri, 4)]));
      k = mask64(KX[Number(OpCodes.AndN((t + BigInt(3 * ri) + 1n), 0xFFn))] + rotR64(k, 23));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(k, 8n)))));
      s0 = mask64(s0 - (OpCodes.AndN((OpCodes.ShiftRn(k, BigInt(GAP))), ~0xFFn)));
      s0 = mask64(s0 - (OpCodes.ShiftLn(s0, BigInt(LBH))));
      t = mask64(OpCodes.XorN(spice[OpCodes.XorN(ri, 1)], (HPC_PI19 + BigInt(blockSize))));
      s0 = mask64(s0 + ((OpCodes.ShiftLn(t, 3n))));
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(t, BigInt(GAP + 2)))));
      s0 = mask64(s0 - t);
      s0 &= mask;

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(LBQ)))));
      s0 = mask64(s0 + Permb[Number(OpCodes.AndN(s0, 15n))]);
      t = spice[OpCodes.XorN(ri, 2)];
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(t, BigInt(GAP + 4)))));
      s0 = mask64(s0 + (OpCodes.ShiftLn(s0, BigInt(LBT + Number(OpCodes.AndN(s0, 15n))))));
      s0 = mask64(s0 + t);
      s0 &= mask;

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(LBH)))));
      s0 &= mask;
    }

    state[0] = s0;
  }

  function shortDecrypt(state, spice, KX, blockSize, mask, backup) {
    const LBH = OpCodes.Shr32((blockSize + 1), 1);
    const LBQ = OpCodes.Shr32((LBH + 1), 1);
    const LBT = (OpCodes.Shr32((blockSize + LBQ), 2)) + 2;
    const GAP = 64 - blockSize;

    let s0 = state[0];

    for (let ri = HPC_ROUND_COUNT; ri-- > 0; ) {
      let k, t = spice[OpCodes.XorN(ri, 2)];

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(LBH)))));
      s0 = mask64(s0 - t);
      k = OpCodes.ShiftLn(s0, BigInt(LBT + Number(OpCodes.AndN(s0, 15n))));
      s0 = mask64(s0 - (OpCodes.ShiftLn((s0 - k), BigInt(LBT + Number(OpCodes.AndN(s0, 15n))))));
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(t, BigInt(GAP + 4)))));
      s0 = mask64(s0 - Permbi[Number(OpCodes.AndN(s0, 15n))]);
      s0 &= mask;

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(LBQ)))));
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(OpCodes.Shl32(LBQ, 1))))));
      t = mask64(OpCodes.XorN(spice[OpCodes.XorN(ri, 1)], (HPC_PI19 + BigInt(blockSize))));
      s0 = mask64(s0 + t);
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(t, BigInt(GAP + 2)))));
      s0 = mask64(s0 - ((OpCodes.ShiftLn(t, 3n))));
      s0 = mask64(s0 + (OpCodes.ShiftLn(s0, BigInt(LBH))));
      t = OpCodes.AndN(s0, 0xFFn);
      k = mask64(OpCodes.XorN(KX[Number(t)], spice[OpCodes.XorN(ri, 4)]));
      k = mask64(KX[Number(OpCodes.AndN((t + BigInt(3 * ri) + 1n), 0xFFn))] + rotR64(k, 23));
      s0 = mask64(s0 + (OpCodes.AndN((OpCodes.ShiftRn(k, BigInt(GAP))), ~0xFFn)));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(k, 8n)))));
      s0 &= mask;

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(LBH)))));
      t = spice[OpCodes.XorN(ri, 7)];
      s0 = mask64(s0 - ((OpCodes.ShiftRn(t, 13n))));
      s0 = mask64(s0 + (OpCodes.ShiftRn(t, BigInt(GAP + ri))));
      s0 = mask64(OpCodes.XorN(s0, t));
      s0 = mask64(s0 - (OpCodes.ShiftLn(s0, BigInt(LBH + ri))));
      k = mask64(KX[Number(OpCodes.AndN(s0, 0xFFn))] + spice[ri]);
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.AndN((OpCodes.ShiftRn(k, BigInt(GAP))), ~0xFFn))));
      s0 = mask64(s0 - ((OpCodes.ShiftLn(k, 8n))));
      s0 &= mask;
    }

    state[0] = s0;
  }

  // ========================[ MEDIUM CIPHER (65-128 bits) ]========================

  function mediumEncrypt(state, spice, KX, blockSize, mask, backup) {
    let s0 = state[0], s1 = state[1];

    for (let ri = 0; ri < HPC_ROUND_COUNT; ++ri) {
      let k = KX[Number(OpCodes.AndN(s0, 0xFFn))];
      let t, kk;

      s1 = mask64(s1 + k);
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(k, 8n)))));
      s1 = mask64(OpCodes.XorN(s1, s0));
      s1 &= mask;

      s0 = mask64(s0 - ((OpCodes.ShiftRn(s1, 11n))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(s1, 2n)))));
      s0 = mask64(s0 - spice[OpCodes.XorN(ri, 4)]);
      s0 = mask64(s0 + mask64(OpCodes.XorN(((OpCodes.ShiftLn(s0, 32n))), (HPC_PI19 + BigInt(blockSize)))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 17n)))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 34n)))));
      t = spice[ri];
      s0 = mask64(OpCodes.XorN(s0, t));
      s0 = mask64(s0 + ((OpCodes.ShiftLn(t, 5n))));
      t = OpCodes.ShiftRn(t, 4n);
      s1 = mask64(s1 + t);
      s0 = mask64(OpCodes.XorN(s0, t));
      s0 = mask64(s0 + (OpCodes.ShiftLn(s0, BigInt(22 + Number(OpCodes.AndN(s0, 31n))))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 23n)))));
      s0 = mask64(s0 - spice[OpCodes.XorN(ri, 7)]);

      t = OpCodes.AndN(s0, 0xFFn);
      k = KX[Number(t)];
      kk = KX[Number(OpCodes.AndN((t + BigInt(3 * ri) + 1n), 0xFFn))];

      s1 = mask64(OpCodes.XorN(s1, k));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(kk, 8n)))));
      kk = mask64(OpCodes.XorN(kk, k));
      s1 = mask64(s1 + ((OpCodes.ShiftRn(kk, 5n))));
      s0 = mask64(s0 - ((OpCodes.ShiftLn(kk, 12n))));
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.AndN(kk, ~0xFFn))));
      s1 = mask64(s1 + s0);
      s1 &= mask;

      s0 = mask64(s0 + ((OpCodes.ShiftLn(s1, 3n))));
      s0 = mask64(OpCodes.XorN(s0, spice[OpCodes.XorN(ri, 2)]));
      s0 = mask64(s0 + KX[blockSize + ri + 16]);
      s0 = mask64(s0 + ((OpCodes.ShiftLn(s0, 22n))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s1, 4n)))));
      s0 = mask64(s0 + spice[OpCodes.XorN(ri, 1)]);
      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(ri + 33)))));
    }

    state[0] = s0;
    state[1] = s1;
  }

  function mediumDecrypt(state, spice, KX, blockSize, mask, backup) {
    let s0 = state[0], s1 = state[1];

    for (let ri = HPC_ROUND_COUNT; ri-- > 0; ) {
      let k, t, kk;

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.ShiftRn(s0, BigInt(ri + 33)))));
      s0 = mask64(s0 - spice[OpCodes.XorN(ri, 1)]);
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s1, 4n)))));
      t = mask64(s0 - ((OpCodes.ShiftLn(s0, 22n))));
      s0 = mask64(s0 - ((OpCodes.ShiftLn(t, 22n))));
      s0 = mask64(s0 - KX[blockSize + ri + 16]);
      s0 = mask64(OpCodes.XorN(s0, spice[OpCodes.XorN(ri, 2)]));
      s0 = mask64(s0 - ((OpCodes.ShiftLn(s1, 3n))));
      s1 = mask64(s1 - s0);

      t = OpCodes.AndN(s0, 0xFFn);
      k = KX[Number(t)];
      kk = mask64(OpCodes.XorN(KX[Number(OpCodes.AndN((t + BigInt(3 * ri) + 1n), 0xFFn))], k));

      s0 = mask64(OpCodes.XorN(s0, (OpCodes.AndN(kk, ~0xFFn))));
      s0 = mask64(s0 + ((OpCodes.ShiftLn(kk, 12n))));
      s1 = mask64(s1 - ((OpCodes.ShiftRn(kk, 5n))));
      kk = mask64(OpCodes.XorN(kk, k));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(kk, 8n)))));
      s1 = mask64(OpCodes.XorN(s1, k));

      s0 = mask64(s0 + spice[OpCodes.XorN(ri, 7)]);
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 23n)))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 46n)))));
      t = OpCodes.ShiftLn(s0, BigInt(22 + Number(OpCodes.AndN(s0, 31n))));
      s0 = mask64(s0 - (OpCodes.ShiftLn((s0 - t), BigInt(22 + Number(OpCodes.AndN(s0, 31n))))));
      t = OpCodes.ShiftRn(spice[ri], 4n);
      s0 = mask64(OpCodes.XorN(s0, t));
      s1 = mask64(s1 - t);
      t = spice[ri];
      s0 = mask64(s0 - ((OpCodes.ShiftLn(t, 5n))));
      s0 = mask64(OpCodes.XorN(s0, t));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s0, 17n)))));
      t = mask64(s0 - (HPC_PI19 + BigInt(blockSize)));
      s0 = mask64(s0 - (OpCodes.XorN(((OpCodes.ShiftLn(t, 32n))), (HPC_PI19 + BigInt(blockSize)))));
      s0 = mask64(s0 + spice[OpCodes.XorN(ri, 4)]);
      s1 &= mask;

      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(s1, 2n)))));
      s0 = mask64(s0 + ((OpCodes.ShiftRn(s1, 11n))));
      s1 = mask64(OpCodes.XorN(s1, s0));
      k = KX[Number(OpCodes.AndN(s0, 0xFFn))];
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(k, 8n)))));
      s1 = mask64(s1 - k);
      s1 &= mask;
    }

    state[0] = s0;
    state[1] = s1;
  }

  // ========================[ LONG CIPHER (129-512 bits) ]========================

  function longEncrypt(state, spice, KX, blockSize, mask, backup) {
    // The Long cipher (HPC spec, "Long Cipher", 129-512 bit blocks) keeps the
    // block's FIRST two words in s0/s1, its LAST word in s7, and the words in
    // between in s2..s6 - which is why s7 is the one masked with lmask and why
    // the cascade below brings s2..s6 into play as the block crosses 192, 256,
    // 320, 384 and 448 bits (one extra intermediate word per step). Binding s7
    // to state[7] instead of to the block's own last word left the last word
    // untouched and carried a word of state that the output never recorded, so
    // every block narrower than 449 bits was undecryptable.
    const lastWord = Math.ceil(blockSize / 64) - 1;
    let s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];
    let s4 = state[4], s5 = state[5], s6 = state[6], s7 = state[lastWord];

    for (let ri = 0; ri < HPC_ROUND_COUNT; ++ri) {
      let t = OpCodes.AndN(s0, 0xFFn);
      let k = KX[Number(t)];
      let kk = KX[Number(OpCodes.AndN((t + BigInt(3 * ri) + 1n), 0xFFn))];

      s1 = mask64(s1 + k);
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(kk, 8n)))));
      kk = mask64(OpCodes.XorN(kk, k));
      s1 = mask64(s1 + ((OpCodes.ShiftRn(kk, 5n))));
      s0 = mask64(s0 - ((OpCodes.ShiftLn(kk, 12n))));
      s7 = mask64(s7 + kk);
      s7 = mask64(OpCodes.XorN(s7, s0));
      s7 &= mask;

      s1 = mask64(s1 + s7);
      s1 = mask64(OpCodes.XorN(s1, ((OpCodes.ShiftLn(s7, 13n)))));
      s0 = mask64(s0 - ((OpCodes.ShiftRn(s7, 11n))));
      s0 = mask64(s0 + spice[ri]);
      s1 = mask64(OpCodes.XorN(s1, spice[OpCodes.XorN(ri, 1)]));
      s0 = mask64(s0 + (OpCodes.ShiftLn(s1, BigInt(ri + 9))));
      s1 = mask64(s1 + mask64(OpCodes.XorN(((OpCodes.ShiftRn(s0, 3n))), (HPC_PI19 + BigInt(blockSize)))));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s1, 4n)))));
      s0 = mask64(s0 + spice[OpCodes.XorN(ri, 2)]);
      t = spice[OpCodes.XorN(ri, 4)];
      s1 = mask64(s1 + t);
      s1 = mask64(OpCodes.XorN(s1, ((OpCodes.ShiftRn(t, 3n)))));
      s1 = mask64(s1 - ((OpCodes.ShiftLn(t, 5n))));
      s0 = mask64(OpCodes.XorN(s0, s1));

      if (blockSize > 192) {
        if (blockSize > 256) {
          if (blockSize > 320) {
            if (blockSize > 384) {
              if (blockSize > 448) {
                s6 = mask64(s6 + s0);
                s6 = mask64(OpCodes.XorN(s6, ((OpCodes.ShiftLn(s3, 11n)))));
                s1 = mask64(s1 + ((OpCodes.ShiftRn(s6, 13n))));
                s6 = mask64(s6 + ((OpCodes.ShiftLn(s5, 7n))));
                s4 = mask64(OpCodes.XorN(s4, s6));
              }
              s5 = mask64(OpCodes.XorN(s5, s1));
              s5 = mask64(s5 + ((OpCodes.ShiftLn(s4, 15n))));
              s0 = mask64(s0 - ((OpCodes.ShiftRn(s5, 7n))));
              s5 = mask64(OpCodes.XorN(s5, ((OpCodes.ShiftRn(s3, 9n)))));
              s2 = mask64(OpCodes.XorN(s2, s5));
            }
            s4 = mask64(s4 - s2);
            s4 = mask64(OpCodes.XorN(s4, ((OpCodes.ShiftRn(s1, 10n)))));
            s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(s4, 3n)))));
            s4 = mask64(s4 - ((OpCodes.ShiftLn(s2, 6n))));
            s3 = mask64(s3 + s4);
          }
          s3 = mask64(OpCodes.XorN(s3, s2));
          s3 = mask64(s3 - ((OpCodes.ShiftRn(s0, 7n))));
          s2 = mask64(OpCodes.XorN(s2, ((OpCodes.ShiftLn(s3, 15n)))));
          s3 = mask64(OpCodes.XorN(s3, ((OpCodes.ShiftLn(s1, 5n)))));
          s1 = mask64(s1 + s3);
        }
        s2 = mask64(OpCodes.XorN(s2, s1));
        s2 = mask64(s2 + ((OpCodes.ShiftLn(s0, 13n))));
        s1 = mask64(s1 - ((OpCodes.ShiftRn(s2, 5n))));
        s2 = mask64(s2 - ((OpCodes.ShiftRn(s1, 8n))));
        s0 = mask64(OpCodes.XorN(s0, s2));
      }

      s1 = mask64(OpCodes.XorN(s1, KX[Number(OpCodes.AndN((BigInt(blockSize) + BigInt(OpCodes.Shl32(ri, 5)) + 17n), 0xFFn))]));
      s1 = mask64(s1 + ((OpCodes.ShiftLn(s0, 19n))));
      s0 = mask64(s0 - ((OpCodes.ShiftRn(s1, 27n))));
      s1 = mask64(OpCodes.XorN(s1, spice[OpCodes.XorN(ri, 7)]));
      s7 = mask64(s7 - s1);
      s0 = mask64(s0 + (OpCodes.AndN(s1, ((OpCodes.ShiftRn(s1, 5n))))));
      s1 = mask64(OpCodes.XorN(s1, (OpCodes.ShiftRn(s0, (OpCodes.AndN(s0, 31n))))));
      s0 = mask64(OpCodes.XorN(s0, KX[Number(OpCodes.AndN(s1, 0xFFn))]));
    }

    state[0] = s0; state[1] = s1; state[2] = s2; state[3] = s3;
    state[4] = s4; state[5] = s5; state[6] = s6;
    state[lastWord] = s7; // written last: for narrow blocks it overlaps an s2..s6 slot
  }

  function longDecrypt(state, spice, KX, blockSize, mask, backup) {
    const lastWord = Math.ceil(blockSize / 64) - 1;
    let s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];
    let s4 = state[4], s5 = state[5], s6 = state[6], s7 = state[lastWord];

    for (let ri = HPC_ROUND_COUNT; ri-- > 0; ) {
      let t, k, kk;

      s0 = mask64(OpCodes.XorN(s0, KX[Number(OpCodes.AndN(s1, 0xFFn))]));
      s1 = mask64(OpCodes.XorN(s1, (OpCodes.ShiftRn(s0, (OpCodes.AndN(s0, 31n))))));
      s0 = mask64(s0 - (OpCodes.AndN(s1, ((OpCodes.ShiftRn(s1, 5n))))));
      s7 = mask64(s7 + s1);
      s7 &= mask;

      s1 = mask64(OpCodes.XorN(s1, spice[OpCodes.XorN(ri, 7)]));
      s0 = mask64(s0 + ((OpCodes.ShiftRn(s1, 27n))));
      s1 = mask64(s1 - ((OpCodes.ShiftLn(s0, 19n))));
      s1 = mask64(OpCodes.XorN(s1, KX[Number(OpCodes.AndN((BigInt(blockSize) + BigInt(OpCodes.Shl32(ri, 5)) + 17n), 0xFFn))]));

      if (blockSize > 192) {
        s0 = mask64(OpCodes.XorN(s0, s2));
        s2 = mask64(s2 + ((OpCodes.ShiftRn(s1, 8n))));
        s1 = mask64(s1 + ((OpCodes.ShiftRn(s2, 5n))));
        s2 = mask64(s2 - ((OpCodes.ShiftLn(s0, 13n))));
        s2 = mask64(OpCodes.XorN(s2, s1));

        if (blockSize > 256) {
          s1 = mask64(s1 - s3);
          s3 = mask64(OpCodes.XorN(s3, ((OpCodes.ShiftLn(s1, 5n)))));
          s2 = mask64(OpCodes.XorN(s2, ((OpCodes.ShiftLn(s3, 15n)))));
          s3 = mask64(s3 + ((OpCodes.ShiftRn(s0, 7n))));
          s3 = mask64(OpCodes.XorN(s3, s2));

          if (blockSize > 320) {
            s3 = mask64(s3 - s4);
            s4 = mask64(s4 + ((OpCodes.ShiftLn(s2, 6n))));
            s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(s4, 3n)))));
            s4 = mask64(OpCodes.XorN(s4, ((OpCodes.ShiftRn(s1, 10n)))));
            s4 = mask64(s4 + s2);

            if (blockSize > 384) {
              s2 = mask64(OpCodes.XorN(s2, s5));
              s5 = mask64(OpCodes.XorN(s5, ((OpCodes.ShiftRn(s3, 9n)))));
              s0 = mask64(s0 + ((OpCodes.ShiftRn(s5, 7n))));
              s5 = mask64(s5 - ((OpCodes.ShiftLn(s4, 15n))));
              s5 = mask64(OpCodes.XorN(s5, s1));

              if (blockSize > 448) {
                s4 = mask64(OpCodes.XorN(s4, s6));
                s6 = mask64(s6 - ((OpCodes.ShiftLn(s5, 7n))));
                s1 = mask64(s1 - ((OpCodes.ShiftRn(s6, 13n))));
                s6 = mask64(OpCodes.XorN(s6, ((OpCodes.ShiftLn(s3, 11n)))));
                s6 = mask64(s6 - s0);
              }
            }
          }
        }
      }

      s0 = mask64(OpCodes.XorN(s0, s1));
      t = spice[OpCodes.XorN(ri, 4)];
      s1 = mask64(s1 + ((OpCodes.ShiftLn(t, 5n))));
      s1 = mask64(OpCodes.XorN(s1, ((OpCodes.ShiftRn(t, 3n)))));
      s1 = mask64(s1 - t);
      s0 = mask64(s0 - spice[OpCodes.XorN(ri, 2)]);
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftRn(s1, 4n)))));
      s1 = mask64(s1 - mask64(OpCodes.XorN(((OpCodes.ShiftRn(s0, 3n))), (HPC_PI19 + BigInt(blockSize)))));
      s0 = mask64(s0 - (OpCodes.ShiftLn(s1, BigInt(ri + 9))));
      s1 = mask64(OpCodes.XorN(s1, spice[OpCodes.XorN(ri, 1)]));
      s0 = mask64(s0 - spice[ri]);
      s0 = mask64(s0 + ((OpCodes.ShiftRn(s7, 11n))));
      s1 = mask64(OpCodes.XorN(s1, ((OpCodes.ShiftLn(s7, 13n)))));
      s1 = mask64(s1 - s7);

      t = OpCodes.AndN(s0, 0xFFn);
      k = KX[Number(t)];
      kk = mask64(OpCodes.XorN(KX[Number(OpCodes.AndN((t + BigInt(3 * ri) + 1n), 0xFFn))], k));

      s7 = mask64(OpCodes.XorN(s7, s0));
      s7 = mask64(s7 - kk);
      s0 = mask64(s0 + ((OpCodes.ShiftLn(kk, 12n))));
      s1 = mask64(s1 - ((OpCodes.ShiftRn(kk, 5n))));
      kk = mask64(OpCodes.XorN(kk, k));
      s0 = mask64(OpCodes.XorN(s0, ((OpCodes.ShiftLn(kk, 8n)))));
      s1 = mask64(s1 - k);
    }

    state[0] = s0; state[1] = s1; state[2] = s2; state[3] = s3;
    state[4] = s4; state[5] = s5; state[6] = s6;
    state[lastWord] = s7;
  }

  // ========================[ EXTENDED STIR (for Extended cipher) ]========================

  function extendedStir(s, spice, KX, ri, mask) {
    let t = OpCodes.AndN(s[0], 0xFFn);
    let k = KX[Number(t)];
    let kk = KX[Number(OpCodes.AndN((t + BigInt(OpCodes.Shl32(ri, 2)) + 1n), 0xFFn))];
    let tt;

    s[3] = mask64(s[3] + s[7]);
    s[5] = mask64(OpCodes.XorN(s[5], s[7]));
    s[1] = mask64(s[1] + k);
    s[2] = mask64(OpCodes.XorN(s[2], k));
    s[4] = mask64(s[4] + kk);
    s[6] = mask64(OpCodes.XorN(s[6], kk));
    s[4] = mask64(OpCodes.XorN(s[4], s[1]));
    s[5] = mask64(s[5] + s[2]);
    s[0] = mask64(OpCodes.XorN(s[0], (OpCodes.ShiftRn(s[5], 13n))));
    s[1] = mask64(s[1] - (OpCodes.ShiftRn(s[6], 22n)));
    s[2] = mask64(OpCodes.XorN(s[2], (OpCodes.ShiftLn(s[7], 7n))));
    s[7] = mask64(OpCodes.XorN(s[7], (OpCodes.ShiftLn(s[6], 9n))));
    s[7] = mask64(s[7] + s[0]);
    s[4] = mask64(s[4] - s[0]);

    t = OpCodes.AndN(s[1], 31n);
    tt = OpCodes.ShiftRn(s[1], t);
    s[6] = mask64(OpCodes.XorN(s[6], tt));
    s[7] = mask64(s[7] + tt);

    tt = OpCodes.ShiftLn(s[2], t);
    s[3] = mask64(s[3] + tt);
    s[5] = mask64(OpCodes.XorN(s[5], tt));
    tt = OpCodes.ShiftRn(s[4], t);
    s[2] = mask64(s[2] - tt);
    s[5] = mask64(s[5] + tt);

    if (ri === 1) {
      s[0] = mask64(s[0] + spice[0]);
      s[1] = mask64(OpCodes.XorN(s[1], spice[1]));
      s[2] = mask64(s[2] - spice[2]);
      s[3] = mask64(OpCodes.XorN(s[3], spice[3]));
      s[4] = mask64(s[4] + spice[4]);
      s[5] = mask64(OpCodes.XorN(s[5], spice[5]));
      s[6] = mask64(s[6] - spice[6]);
      s[7] = mask64(OpCodes.XorN(s[7], spice[7]));
    }

    s[7] = mask64(s[7] - s[3]);
    s[7] &= mask;
    s[1] = mask64(OpCodes.XorN(s[1], (OpCodes.ShiftRn(s[7], 11n))));
    s[6] = mask64(s[6] + s[3]);
    s[0] = mask64(OpCodes.XorN(s[0], s[6]));

    t = mask64(OpCodes.XorN(s[2], s[5]));
    s[3] = mask64(s[3] - t);
    t &= 0x5555555555555555n;
    s[2] = mask64(OpCodes.XorN(s[2], t));
    s[5] = mask64(OpCodes.XorN(s[5], t));
    s[0] = mask64(s[0] + t);

    t = OpCodes.ShiftLn(s[4], 9n);
    s[6] = mask64(s[6] - t);
    s[1] = mask64(s[1] + t);
  }

  function extendedStirInverse(s, spice, KX, ri, mask) {
    let t, tt, k, kk;

    t = OpCodes.ShiftLn(s[4], 9n);
    s[1] = mask64(s[1] - t);
    s[6] = mask64(s[6] + t);

    t = mask64(OpCodes.XorN(s[2], s[5]));
    s[3] = mask64(s[3] + t);
    t &= 0x5555555555555555n;
    s[2] = mask64(OpCodes.XorN(s[2], t));
    s[5] = mask64(OpCodes.XorN(s[5], t));
    s[0] = mask64(s[0] - t);

    s[0] = mask64(OpCodes.XorN(s[0], s[6]));
    s[6] = mask64(s[6] - s[3]);
    s[1] = mask64(OpCodes.XorN(s[1], (OpCodes.ShiftRn(s[7], 11n))));
    s[7] = mask64(s[7] + s[3]);

    if (ri === 1) {
      s[0] = mask64(s[0] - spice[0]);
      s[1] = mask64(OpCodes.XorN(s[1], spice[1]));
      s[2] = mask64(s[2] + spice[2]);
      s[3] = mask64(OpCodes.XorN(s[3], spice[3]));
      s[4] = mask64(s[4] - spice[4]);
      s[5] = mask64(OpCodes.XorN(s[5], spice[5]));
      s[6] = mask64(s[6] + spice[6]);
      s[7] = mask64(OpCodes.XorN(s[7], spice[7]));
    }

    t = OpCodes.AndN(s[1], 31n);
    tt = OpCodes.ShiftRn(s[4], t);
    s[5] = mask64(s[5] - tt);
    s[2] = mask64(s[2] + tt);
    tt = OpCodes.ShiftLn(s[2], t);
    s[5] = mask64(OpCodes.XorN(s[5], tt));
    s[3] = mask64(s[3] - tt);

    tt = OpCodes.ShiftRn(s[1], t);
    s[6] = mask64(OpCodes.XorN(s[6], tt));
    s[7] = mask64(s[7] - tt);

    s[4] = mask64(s[4] + s[0]);
    s[7] = mask64(s[7] - s[0]);
    s[7] = mask64(OpCodes.XorN(s[7], (OpCodes.ShiftLn(s[6], 9n))));
    s[7] &= mask;
    s[2] = mask64(OpCodes.XorN(s[2], (OpCodes.ShiftLn(s[7], 7n))));
    s[1] = mask64(s[1] + (OpCodes.ShiftRn(s[6], 22n)));
    s[0] = mask64(OpCodes.XorN(s[0], (OpCodes.ShiftRn(s[5], 13n))));
    s[5] = mask64(s[5] - s[2]);
    s[4] = mask64(OpCodes.XorN(s[4], s[1]));

    t = OpCodes.AndN(s[0], 0xFFn);
    k = KX[Number(t)];
    kk = KX[Number(OpCodes.AndN((t + BigInt(OpCodes.Shl32(ri, 2)) + 1n), 0xFFn))];

    s[6] = mask64(OpCodes.XorN(s[6], kk));
    s[4] = mask64(s[4] - kk);
    s[2] = mask64(OpCodes.XorN(s[2], k));
    s[1] = mask64(s[1] - k);
    s[5] = mask64(OpCodes.XorN(s[5], s[7]));
    s[3] = mask64(s[3] - s[7]);
  }

  // ========================[ EXTENDED CIPHER (513+ bits) ]========================

  function extendedEncrypt(state, spice, KX, plaintext, ciphertext, blockSize, mask, backup) {
    const LWD = Math.ceil(blockSize / 64);
    let qmask = LWD - 1;

    // Calculate qmask as next power of 2 minus 1
    qmask |= OpCodes.Shr32(qmask, 1);
    qmask |= OpCodes.Shr32(qmask, 2);
    qmask |= OpCodes.Shr32(qmask, 4);
    qmask |= OpCodes.Shr32(qmask, 8);
    qmask |= OpCodes.Shr32(qmask, 16);

    // Pre-mixing
    for (let i = 0; i < 3; ++i) {
      extendedStir(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }

    const s7Copy = state[7];

    // First pass
    for (let i = HPC_ROUND_COUNT; i < LWD; ++i) {
      const j = i * 8;
      const lmask = (i === LWD - 1) ? mask : 0xFFFFFFFFFFFFFFFFn;
      const byteLimit = (lmask !== 0xFFFFFFFFFFFFFFFFn) ? Math.ceil((OpCodes.AndN(blockSize, 63)) / 8) : 8;

      state[7] = 0n;
      for (let bi = 0; bi < byteLimit; ++bi) {
        state[7] |= OpCodes.ShiftLn(BigInt(plaintext[j + bi] || 0), BigInt(bi * 8));
      }

      extendedStir(state, spice, KX, 0, lmask);

      for (let bi = 0; bi < byteLimit; ++bi) {
        ciphertext[j + bi] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[7], BigInt(bi * 8))), 0xFFn));
      }
    }

    // First intermission
    state[7] = s7Copy;
    extendedStir(state, spice, KX, 0, 0xFFFFFFFFFFFFFFFFn);
    state[0] = mask64(state[0] + BigInt(blockSize));
    for (let i = 0; i < 2; ++i) {
      extendedStir(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
    state[0] = mask64(state[0] + BigInt(blockSize));
    const s7Copy2 = state[7];

    // Second pass
    for (let q = 1; q !== 0; q = OpCodes.AndN(((q * 5) + 1), qmask)) {
      if (q < HPC_ROUND_COUNT || q >= LWD) continue;

      const j = q * 8;
      const lmask = (q === LWD - 1) ? mask : 0xFFFFFFFFFFFFFFFFn;
      const byteLimit = (lmask !== 0xFFFFFFFFFFFFFFFFn) ? Math.ceil((OpCodes.AndN(blockSize, 63)) / 8) : 8;

      state[7] = 0n;
      for (let bi = 0; bi < byteLimit; ++bi) {
        state[7] |= OpCodes.ShiftLn(BigInt(ciphertext[j + bi] || 0), BigInt(bi * 8));
      }

      extendedStir(state, spice, KX, 0, lmask);

      for (let bi = 0; bi < byteLimit; ++bi) {
        ciphertext[j + bi] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[7], BigInt(bi * 8))), 0xFFn));
      }
    }

    // Second intermission
    state[7] = s7Copy2;
    extendedStir(state, spice, KX, 1, 0xFFFFFFFFFFFFFFFFn);
    state[0] = mask64(state[0] + BigInt(blockSize));
    for (let i = 0; i < 2; ++i) {
      extendedStir(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
    state[0] = mask64(state[0] + BigInt(blockSize));
    const s7Copy3 = state[7];

    // Find swizzle polynomial
    let swz = 0;
    for (let i = 0; i < Swizpoly.length; ++i) {
      if (Swizpoly[i] > qmask) {
        swz = Swizpoly[i];
        break;
      }
    }

    // Third pass
    qmask = (OpCodes.Shr32(qmask, 1)) + 1;
    for (let q = 2; q !== 1; q = OpCodes.XorN((OpCodes.Shl32(q, 1)), ((OpCodes.AndN(q, qmask)) ? swz : 0))) {
      if (q < HPC_ROUND_COUNT || q >= LWD) continue;

      const j = q * 8;
      const lmask = (q === LWD - 1) ? mask : 0xFFFFFFFFFFFFFFFFn;
      const byteLimit = (lmask !== 0xFFFFFFFFFFFFFFFFn) ? Math.ceil((OpCodes.AndN(blockSize, 63)) / 8) : 8;

      state[7] = 0n;
      for (let bi = 0; bi < byteLimit; ++bi) {
        state[7] |= OpCodes.ShiftLn(BigInt(ciphertext[j + bi] || 0), BigInt(bi * 8));
      }

      extendedStir(state, spice, KX, 0, lmask);

      for (let bi = 0; bi < byteLimit; ++bi) {
        ciphertext[j + bi] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[7], BigInt(bi * 8))), 0xFFn));
      }
    }

    // Finale
    state[7] = s7Copy3;
    extendedStir(state, spice, KX, 0, 0xFFFFFFFFFFFFFFFFn);
    for (let i = 0; i < 3; ++i) {
      extendedStir(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
  }

  function extendedDecrypt(state, spice, KX, ciphertext, plaintext, blockSize, mask, backup) {
    const LWD = Math.ceil(blockSize / 64);
    let qmask = LWD - 1;

    qmask |= OpCodes.Shr32(qmask, 1);
    qmask |= OpCodes.Shr32(qmask, 2);
    qmask |= OpCodes.Shr32(qmask, 4);
    qmask |= OpCodes.Shr32(qmask, 8);
    qmask |= OpCodes.Shr32(qmask, 16);

    // Finale inverse
    for (let i = 3; i-- > 0; ) {
      extendedStirInverse(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
    extendedStirInverse(state, spice, KX, 0, 0xFFFFFFFFFFFFFFFFn);

    // Find swizzle polynomial
    let swz = 0;
    for (let i = 0; i < Swizpoly.length; ++i) {
      if (Swizpoly[i] > qmask) {
        swz = Swizpoly[i];
        break;
      }
    }

    const s7Copy = state[7];

    // Third pass inverse
    swz = OpCodes.Shr32(swz, 1);
    for (let q = swz; q !== 1; q = OpCodes.XorN((OpCodes.Shr32(q, 1)), ((OpCodes.AndN(q, 1)) ? swz : 0))) {
      if (q < HPC_ROUND_COUNT || q >= LWD) continue;

      const j = q * 8;
      const lmask = (q === LWD - 1) ? mask : 0xFFFFFFFFFFFFFFFFn;
      const byteLimit = (lmask !== 0xFFFFFFFFFFFFFFFFn) ? Math.ceil((OpCodes.AndN(blockSize, 63)) / 8) : 8;

      state[7] = 0n;
      for (let bi = 0; bi < byteLimit; ++bi) {
        state[7] |= OpCodes.ShiftLn(BigInt(ciphertext[j + bi] || 0), BigInt(bi * 8));
      }

      extendedStirInverse(state, spice, KX, 0, lmask);

      for (let bi = 0; bi < byteLimit; ++bi) {
        plaintext[j + bi] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[7], BigInt(bi * 8))), 0xFFn));
      }
    }

    // Second intermission inverse
    state[7] = s7Copy;
    state[0] = mask64(state[0] - BigInt(blockSize));
    for (let i = 2; i-- > 0; ) {
      extendedStirInverse(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
    state[0] = mask64(state[0] - BigInt(blockSize));
    extendedStirInverse(state, spice, KX, 1, 0xFFFFFFFFFFFFFFFFn);
    const s7Copy2 = state[7];

    // Second pass inverse
    for (let q = (OpCodes.AndN(0x33333333, qmask)); q !== 0; q = OpCodes.AndN(((q - 1) * 0xcccccccd), qmask)) {
      if (q < HPC_ROUND_COUNT || q >= LWD) continue;

      const j = q * 8;
      const lmask = (q === LWD - 1) ? mask : 0xFFFFFFFFFFFFFFFFn;
      const byteLimit = (lmask !== 0xFFFFFFFFFFFFFFFFn) ? Math.ceil((OpCodes.AndN(blockSize, 63)) / 8) : 8;

      state[7] = 0n;
      for (let bi = 0; bi < byteLimit; ++bi) {
        state[7] |= OpCodes.ShiftLn(BigInt(plaintext[j + bi] || 0), BigInt(bi * 8));
      }

      extendedStirInverse(state, spice, KX, 0, lmask);

      for (let bi = 0; bi < byteLimit; ++bi) {
        plaintext[j + bi] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[7], BigInt(bi * 8))), 0xFFn));
      }
    }

    // First intermission inverse
    state[7] = s7Copy2;
    state[0] = mask64(state[0] - BigInt(blockSize));
    for (let i = 2; i-- > 0; ) {
      extendedStirInverse(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
    state[0] = mask64(state[0] - BigInt(blockSize));
    extendedStirInverse(state, spice, KX, 0, 0xFFFFFFFFFFFFFFFFn);
    const s7Copy3 = state[7];

    // First pass inverse
    for (let i = LWD - 1; i >= HPC_ROUND_COUNT; --i) {
      const j = i * 8;
      const lmask = (i === LWD - 1) ? mask : 0xFFFFFFFFFFFFFFFFn;
      const byteLimit = (lmask !== 0xFFFFFFFFFFFFFFFFn) ? Math.ceil((OpCodes.AndN(blockSize, 63)) / 8) : 8;

      state[7] = 0n;
      for (let bi = 0; bi < byteLimit; ++bi) {
        state[7] |= OpCodes.ShiftLn(BigInt(plaintext[j + bi] || 0), BigInt(bi * 8));
      }

      extendedStirInverse(state, spice, KX, 0, lmask);

      for (let bi = 0; bi < byteLimit; ++bi) {
        plaintext[j + bi] = Number(OpCodes.AndN((OpCodes.ShiftRn(state[7], BigInt(bi * 8))), 0xFFn));
      }
    }

    state[7] = s7Copy3;

    // Pre-mixing inverse
    for (let i = 3; i-- > 0; ) {
      extendedStirInverse(state, spice, KX, i, 0xFFFFFFFFFFFFFFFFn);
    }
  }

  // ========================[ ALGORITHM CLASS ]========================

  /**
 * HPCAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class HPCAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "HPC";
      this.description = "Hasty Pudding Cipher with variable bit-level block sizes (0-137 billion bits). AES candidate featuring 5 sub-ciphers optimized for different block size ranges and tweakable encryption.";
      this.inventor = "Rich Schroeppel";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Byte-aligned external API (internally works at bit level)
      this.SupportedBlockSizes = [new KeySize(1, 8192, 1)]; // 1 byte to 64KB
      this.SupportedKeySizes = [new KeySize(16, 256, 1)];   // 128-2048 bits

      this.documentation = [
        new LinkItem("HPC Reference Implementation", "https://github.com/iscgar/hasty-pudding"),
        new LinkItem("AES Submission Package", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
      ];

      this.references = [
        new LinkItem("cryptospecs HPC Reference Source (hpc.c)", "https://github.com/stamparm/cryptospecs/blob/master/symmetrical/sources/hpc.c"),
        new LinkItem("neilsagarwal HPC Implementation (Python)", "https://github.com/neilsagarwal/hpc")
      ];

      // Official NIST test vectors (15-bit and 64-bit blocks)
      // Test vector format: hex strings represent byte arrays in memory order
      this.tests = [
        {
          text: "HPC-Tiny 15-bit with Wagner fix (1999) - Test #0",
          uri: "https://github.com/iscgar/hasty-pudding",
          input: OpCodes.Hex8ToBytes("0000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          blockSizeBits: 15,
          expected: OpCodes.Hex8ToBytes("1b41")  // Post-Wagner-fix (May 1999): 0x1b41
        },
        {
          text: "HPC-Tiny 15-bit with Wagner fix (1999) - Test #1",
          uri: "https://github.com/iscgar/hasty-pudding",
          input: OpCodes.Hex8ToBytes("0100"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          blockSizeBits: 15,
          expected: OpCodes.Hex8ToBytes("5c41")  // Post-Wagner-fix (May 1999): 0x5c41
        },
        {
          text: "HPC-Short 64-bit with Wagner fix (1999) - Test #0",
          uri: "https://github.com/iscgar/hasty-pudding",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0da29b76a1616de1")  // Post-Wagner-fix (May 1999)
        },
        {
          text: "HPC-Short 64-bit with Wagner fix (1999) - Test #1",
          uri: "https://github.com/iscgar/hasty-pudding",
          input: OpCodes.Hex8ToBytes("0100000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("99ecc89522c69080")  // Post-Wagner-fix (May 1999)
        },
        {
          text: "HPC-Short 64-bit with Wagner fix (1999) - Test #2",
          uri: "https://github.com/iscgar/hasty-pudding",
          input: OpCodes.Hex8ToBytes("0200000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("92e8afd44c695afd")  // Post-Wagner-fix (May 1999)
        }
      ];
    }

    CreateInstance(isInverse) {
      return new HPCInstance(this, isInverse);
    }
  }

  // ========================[ INSTANCE CLASS ]========================

  /**
 * HPC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HPCInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._keyBitSize = 0;
      this._blockSizeBits = null;
      this._KX = null; // Key expansion array
      this._tweak = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._keyBitSize = 0;
        this._KX = null;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = [...keyBytes];
      this._keyBitSize = keyBytes.length * 8;
      this._KX = null; // Will be initialized when needed
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set blockSizeBits(bits) {
      if (bits < 1 || bits > 65536 * 8) {
        throw new Error("Invalid block size: " + bits + " bits");
      }
      this._blockSizeBits = bits;
    }

    get blockSizeBits() {
      return this._blockSizeBits;
    }

    set tweak(tweakBytes) {
      if (!tweakBytes) {
        this._tweak = null;
        return;
      }
      if (tweakBytes.length > HPC_TWEAK_BIT_SIZE / 8) {
        throw new Error("Tweak too large: " + tweakBytes.length + " bytes (max " + (HPC_TWEAK_BIT_SIZE / 8) + ")");
      }
      this._tweak = [...tweakBytes];
    }

    get tweak() {
      return this._tweak ? [...this._tweak] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      // Determine block size in bits. HPC encrypts exactly one block per call,
      // so when a block size has been declared the input has to BE that block:
      // it is neither padded nor split. Silently keeping the first ceil(bits/8)
      // bytes and dropping the rest - and dropping the bits above the block
      // width in the trailing byte - turned a caller's mistake into quiet data
      // loss, so both are refused instead.
      let blockSizeBits = this._blockSizeBits;
      if (!blockSizeBits) {
        // Default to input size in bits
        blockSizeBits = this.inputBuffer.length * 8;
      } else {
        const blockBytes = Math.ceil(blockSizeBits / 8);
        if (this.inputBuffer.length !== blockBytes)
          throw new Error("Input must be exactly one " + blockSizeBits + "-bit block ("
            + blockBytes + " bytes); got " + this.inputBuffer.length);
        const usedBitsInLastByte = blockSizeBits - (blockBytes - 1) * 8;
        if (OpCodes.Shr32(this.inputBuffer[blockBytes - 1], usedBitsInLastByte) !== 0)
          throw new Error("Input carries bits above the declared " + blockSizeBits
            + "-bit block width; byte " + (blockBytes - 1) + " must fit in "
            + usedBitsInLastByte + " bit(s)");
      }

      const cipherId = getCipherId(blockSizeBits);
      if (cipherId === -1) {
        throw new Error("Block size too large: " + blockSizeBits + " bits");
      }

      // Initialize key expansion for this cipher if not done
      if (!this._KX) {
        this._KX = [];
        for (let id = CIPHER_ID_TINY; id <= CIPHER_ID_EXTENDED; ++id) {
          this._KX[id - 1] = initializeKX(this._key, this._keyBitSize, id, 0);
        }
      }

      // Prepare spice (tweak) array
      const spice = new Array(HPC_ROUND_COUNT).fill(0n);
      if (this._tweak) {
        for (let i = 0; i < Math.min(this._tweak.length, 64); ++i) {
          spice[Math.floor(i / 8)] |= OpCodes.ShiftLn(BigInt(this._tweak[i]), BigInt((i % 8) * 8));
        }
      }

      // Pack input into state
      const state = packBytesToState(this.inputBuffer, blockSizeBits);

      // Calculate mask for last word
      const mask = (OpCodes.ShiftLn(((OpCodes.ShiftLn(1n, BigInt((blockSizeBits - 1) % 64))) - 1n), 1n))|1n;
      const backup = 0;

      // Streamed body of an Extended block (words 8 and up). The block's first
      // eight words never leave the state registers, so this buffer is only
      // complete once they are written back over its first 64 bytes below.
      let extendedBuffer = null;

      // Encryption and decryption have different KX addition/subtraction order
      if (!this.isInverse) {
        // ENCRYPTION: Add pre-KX, encrypt, add post-KX
        for (let i = 0; i <= backup; ++i) {
          state[0] = mask64(state[0] + BigInt(i));

          for (let j = 0; j < HPC_ROUND_COUNT; ++j) {
            state[j] = mask64(state[j] + this._KX[cipherId - 1][OpCodes.AndN((blockSizeBits + j), 0xff)]);
          }

          if (blockSizeBits < 512) {
            const l64 = Math.floor((blockSizeBits + 63) / 64) - 1;
            if (l64 >= 0 && l64 < HPC_ROUND_COUNT) {
              state[l64] &= mask;
            }
          }

          // Execute encryption
          switch (cipherId) {
            case CIPHER_ID_TINY:
              tinyEncrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_SHORT:
              shortEncrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_MEDIUM:
              mediumEncrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_LONG:
              longEncrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_EXTENDED:
              // Falls through to the post-KX step like every other sub-cipher.
              // Returning here skipped it entirely, so an Extended block was
              // encrypted with the pre-KX whitening only and decrypted with the
              // post-KX whitening only - two different transforms.
              extendedBuffer = new Array(this.inputBuffer.length).fill(0);
              extendedEncrypt(state, spice, this._KX[cipherId - 1], this.inputBuffer, extendedBuffer, blockSizeBits, mask, backup);
              break;
          }

          // Add post-KX
          for (let j = 0; j < HPC_ROUND_COUNT; ++j) {
            state[j] = mask64(state[j] + this._KX[cipherId - 1][OpCodes.AndN((blockSizeBits + HPC_ROUND_COUNT + j), 0xff)]);
          }

          if (blockSizeBits < 512) {
            const l64 = Math.floor((blockSizeBits + 63) / 64) - 1;
            if (l64 >= 0 && l64 < HPC_ROUND_COUNT) {
              state[l64] &= mask;
            }
          }
        }
      } else {
        // DECRYPTION: Subtract post-KX, decrypt, subtract pre-KX (reversed order!)
        for (let i = backup + 1; i-- > 0; ) {
          // Subtract post-KX (which was added AFTER encryption)
          for (let j = 0; j < HPC_ROUND_COUNT; ++j) {
            state[j] = mask64(state[j] - this._KX[cipherId - 1][OpCodes.AndN((blockSizeBits + HPC_ROUND_COUNT + j), 0xff)]);
          }

          if (blockSizeBits < 512) {
            const l64 = Math.floor((blockSizeBits + 63) / 64) - 1;
            if (l64 >= 0 && l64 < HPC_ROUND_COUNT) {
              state[l64] &= mask;
            }
          }

          // Execute decryption
          switch (cipherId) {
            case CIPHER_ID_TINY:
              tinyDecrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_SHORT:
              shortDecrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_MEDIUM:
              mediumDecrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_LONG:
              longDecrypt(state, spice, this._KX[cipherId - 1], blockSizeBits, mask, backup);
              break;
            case CIPHER_ID_EXTENDED:
              extendedBuffer = new Array(this.inputBuffer.length).fill(0);
              extendedDecrypt(state, spice, this._KX[cipherId - 1], this.inputBuffer, extendedBuffer, blockSizeBits, mask, backup);
              break;
          }

          // Subtract pre-KX (which was added BEFORE encryption)
          for (let j = 0; j < HPC_ROUND_COUNT; ++j) {
            state[j] = mask64(state[j] - this._KX[cipherId - 1][OpCodes.AndN((blockSizeBits + j), 0xff)]);
          }

          state[0] = mask64(state[0] - BigInt(i));

          if (blockSizeBits < 512) {
            const l64 = Math.floor((blockSizeBits + 63) / 64) - 1;
            if (l64 >= 0 && l64 < HPC_ROUND_COUNT) {
              state[l64] &= mask;
            }
          }
        }
      }

      // Unpack state to output
      const output = unpackStateToBytes(state, blockSizeBits);

      // The Extended cipher holds the block's first eight words in the state
      // registers for the whole transform and streams only words 8 and up
      // through the buffer, so the head has to be written back over the
      // buffer's leading 64 bytes. Without it those bytes stayed as the zeros
      // the buffer was allocated with, which is why an Extended block came back
      // from decryption as a run of nulls.
      if (extendedBuffer) {
        for (let i = 0; i < output.length && i < extendedBuffer.length; ++i) extendedBuffer[i] = output[i];
        this.inputBuffer = [];
        return extendedBuffer;
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new HPCAlgorithm());

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
