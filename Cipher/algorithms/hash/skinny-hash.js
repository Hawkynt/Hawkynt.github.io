/* SKINNY-HASH - Lightweight Hash Functions based on SKINNY Tweakable Block Cipher
 * Professional implementation following reference C implementation
 * (c)2006-2025 Hawkynt
 *
 * SKINNY-HASH is a family of hash functions built using the SKINNY-128 tweakable block cipher.
 * Two variants: SKINNY-tk2-HASH (32-byte state, 4-byte rate) and SKINNY-tk3-HASH (48-byte state, 16-byte rate).
 * Reference: Southern Storm Software lightweight-crypto/src/combined/skinny-hash.c
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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // ============================================================================
  // SKINNY-128 Primitives (shared by both hash variants)
  // ============================================================================

  /**
   * Apply SKINNY-128 S-box to all bytes in a 32-bit word
   */
  function skinny128_sbox(x) {
    x = x >>> 0;
    let y;

    x = ~x;
    x ^= (((x >>> 2) & (x >>> 3)) & 0x11111111);
    y = (((x << 5) & (x << 1)) & 0x20202020);
    x ^= (((x << 5) & (x << 4)) & 0x40404040) ^ y;
    y = (((x << 2) & (x << 1)) & 0x80808080);
    x ^= (((x >>> 2) & (x << 1)) & 0x02020202) ^ y;
    y = (((x >>> 5) & (x << 1)) & 0x04040404);
    x ^= (((x >>> 1) & (x >>> 2)) & 0x08080808) ^ y;
    x = ~x;

    x = (((x & 0x08080808) << 1) |
         ((x & 0x32323232) << 2) |
         ((x & 0x01010101) << 5) |
         ((x & 0x80808080) >>> 6) |
         ((x & 0x40404040) >>> 4) |
         ((x & 0x04040404) >>> 2)) >>> 0;

    return x;
  }

  /**
   * LFSR2 - Linear feedback shift register for TK2 update
   */
  function skinny128_LFSR2(x) {
    x = x >>> 0;
    const shifted = (x << 1) & 0xFEFEFEFE;
    const feedback = (((x >>> 7) ^ (x >>> 5)) & 0x01010101);
    return (shifted ^ feedback) >>> 0;
  }

  /**
   * LFSR3 - Linear feedback shift register for TK3 update
   */
  function skinny128_LFSR3(x) {
    x = x >>> 0;
    const shifted = (x >>> 1) & 0x7F7F7F7F;
    const feedback = (((x << 7) ^ (x << 1)) & 0x80808080);
    return (shifted ^ feedback) >>> 0;
  }

  /**
   * Permute half of the tweakey state
   */
  function skinny128_permute_tk_half(tk, idx) {
    const row2 = tk[idx];
    const row3 = tk[idx + 1];
    const row3_rotated = OpCodes.RotL32(row3, 16);

    tk[idx] = (((row2 >>> 8) & 0x000000FF) |
               ((row2 << 16) & 0x00FF0000) |
               (row3_rotated & 0xFF00FF00)) >>> 0;

    tk[idx + 1] = (((row2 >>> 16) & 0x000000FF) |
                   (row2 & 0xFF000000) |
                   ((row3_rotated << 8) & 0x0000FF00) |
                   (row3_rotated & 0x00FF0000)) >>> 0;
  }

  /**
   * SKINNY-128-256 encryption using full tweakey
   * (48 rounds with combined TK1+TK2 tweakey)
   */
  function skinny128_256_encrypt_tk_full(tk, ciphertext, plaintext) {
    // Load plaintext state
    let s0 = OpCodes.Pack32LE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]);
    let s1 = OpCodes.Pack32LE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]);
    let s2 = OpCodes.Pack32LE(plaintext[8], plaintext[9], plaintext[10], plaintext[11]);
    let s3 = OpCodes.Pack32LE(plaintext[12], plaintext[13], plaintext[14], plaintext[15]);

    // Copy tweakey for local modification
    const TK1 = new Array(4);
    const TK2 = new Array(4);

    for (let i = 0; i < 4; i++) {
      TK1[i] = OpCodes.Pack32LE(tk[i * 4], tk[i * 4 + 1], tk[i * 4 + 2], tk[i * 4 + 3]);
      TK2[i] = OpCodes.Pack32LE(tk[16 + i * 4], tk[16 + i * 4 + 1], tk[16 + i * 4 + 2], tk[16 + i * 4 + 3]);
    }

    // 48 rounds (SKINNY-128-256), grouped in sets of 4
    let rc = 0;
    for (let round = 0; round < 48; round += 4) {

      // Round 1
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = (s0 ^ TK1[0] ^ TK2[0] ^ (rc & 0x0F)) >>> 0;
      s1 = (s1 ^ TK1[1] ^ TK2[1] ^ (rc >>> 4)) >>> 0;
      s2 = (s2 ^ 0x02) >>> 0;
      s1 = OpCodes.RotL32(s1, 8);
      s2 = OpCodes.RotL32(s2, 16);
      s3 = OpCodes.RotL32(s3, 24);
      s1 = (s1 ^ s2) >>> 0;
      s2 = (s2 ^ s0) >>> 0;
      s3 = (s3 ^ s2) >>> 0;
      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);

      // Round 2
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = (s3 ^ TK1[2] ^ TK2[2] ^ (rc & 0x0F)) >>> 0;
      s0 = (s0 ^ TK1[3] ^ TK2[3] ^ (rc >>> 4)) >>> 0;
      s1 = (s1 ^ 0x02) >>> 0;
      s0 = OpCodes.RotL32(s0, 8);
      s1 = OpCodes.RotL32(s1, 16);
      s2 = OpCodes.RotL32(s2, 24);
      s0 = (s0 ^ s1) >>> 0;
      s1 = (s1 ^ s3) >>> 0;
      s2 = (s2 ^ s1) >>> 0;
      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);

      // Round 3
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = (s2 ^ TK1[0] ^ TK2[0] ^ (rc & 0x0F)) >>> 0;
      s3 = (s3 ^ TK1[1] ^ TK2[1] ^ (rc >>> 4)) >>> 0;
      s0 = (s0 ^ 0x02) >>> 0;
      s3 = OpCodes.RotL32(s3, 8);
      s0 = OpCodes.RotL32(s0, 16);
      s1 = OpCodes.RotL32(s1, 24);
      s3 = (s3 ^ s0) >>> 0;
      s0 = (s0 ^ s2) >>> 0;
      s1 = (s1 ^ s0) >>> 0;
      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);

      // Round 4
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = (s1 ^ TK1[2] ^ TK2[2] ^ (rc & 0x0F)) >>> 0;
      s2 = (s2 ^ TK1[3] ^ TK2[3] ^ (rc >>> 4)) >>> 0;
      s3 = (s3 ^ 0x02) >>> 0;
      s2 = OpCodes.RotL32(s2, 8);
      s3 = OpCodes.RotL32(s3, 16);
      s0 = OpCodes.RotL32(s0, 24);
      s2 = (s2 ^ s3) >>> 0;
      s3 = (s3 ^ s1) >>> 0;
      s0 = (s0 ^ s3) >>> 0;
      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);
    }

    // Write ciphertext
    const s0_bytes = OpCodes.Unpack32LE(s0);
    const s1_bytes = OpCodes.Unpack32LE(s1);
    const s2_bytes = OpCodes.Unpack32LE(s2);
    const s3_bytes = OpCodes.Unpack32LE(s3);

    for (let i = 0; i < 4; i++) {
      ciphertext[i] = s0_bytes[i];
      ciphertext[i + 4] = s1_bytes[i];
      ciphertext[i + 8] = s2_bytes[i];
      ciphertext[i + 12] = s3_bytes[i];
    }
  }

  /**
   * SKINNY-128-384 encryption using full tweakey
   * (56 rounds with combined TK1+TK2+TK3 tweakey)
   */
  function skinny128_384_encrypt_tk_full(tk, ciphertext, plaintext) {
    // Load plaintext state
    let s0 = OpCodes.Pack32LE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]);
    let s1 = OpCodes.Pack32LE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]);
    let s2 = OpCodes.Pack32LE(plaintext[8], plaintext[9], plaintext[10], plaintext[11]);
    let s3 = OpCodes.Pack32LE(plaintext[12], plaintext[13], plaintext[14], plaintext[15]);

    // Copy tweakey for local modification
    const TK1 = new Array(4);
    const TK2 = new Array(4);
    const TK3 = new Array(4);

    for (let i = 0; i < 4; i++) {
      TK1[i] = OpCodes.Pack32LE(tk[i * 4], tk[i * 4 + 1], tk[i * 4 + 2], tk[i * 4 + 3]);
      TK2[i] = OpCodes.Pack32LE(tk[16 + i * 4], tk[16 + i * 4 + 1], tk[16 + i * 4 + 2], tk[16 + i * 4 + 3]);
      TK3[i] = OpCodes.Pack32LE(tk[32 + i * 4], tk[32 + i * 4 + 1], tk[32 + i * 4 + 2], tk[32 + i * 4 + 3]);
    }

    // 56 rounds (SKINNY-128-384), grouped in sets of 4
    let rc = 0;
    for (let round = 0; round < 56; round += 4) {

      // Round 1
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = (s0 ^ TK1[0] ^ TK2[0] ^ TK3[0] ^ (rc & 0x0F)) >>> 0;
      s1 = (s1 ^ TK1[1] ^ TK2[1] ^ TK3[1] ^ (rc >>> 4)) >>> 0;
      s2 = (s2 ^ 0x02) >>> 0;
      s1 = OpCodes.RotL32(s1, 8);
      s2 = OpCodes.RotL32(s2, 16);
      s3 = OpCodes.RotL32(s3, 24);
      s1 = (s1 ^ s2) >>> 0;
      s2 = (s2 ^ s0) >>> 0;
      s3 = (s3 ^ s2) >>> 0;
      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      skinny128_permute_tk_half(TK3, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);
      TK3[2] = skinny128_LFSR3(TK3[2]);
      TK3[3] = skinny128_LFSR3(TK3[3]);

      // Round 2
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = (s3 ^ TK1[2] ^ TK2[2] ^ TK3[2] ^ (rc & 0x0F)) >>> 0;
      s0 = (s0 ^ TK1[3] ^ TK2[3] ^ TK3[3] ^ (rc >>> 4)) >>> 0;
      s1 = (s1 ^ 0x02) >>> 0;
      s0 = OpCodes.RotL32(s0, 8);
      s1 = OpCodes.RotL32(s1, 16);
      s2 = OpCodes.RotL32(s2, 24);
      s0 = (s0 ^ s1) >>> 0;
      s1 = (s1 ^ s3) >>> 0;
      s2 = (s2 ^ s1) >>> 0;
      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      skinny128_permute_tk_half(TK3, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);
      TK3[0] = skinny128_LFSR3(TK3[0]);
      TK3[1] = skinny128_LFSR3(TK3[1]);

      // Round 3
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = skinny128_sbox(s1);
      s2 = (s2 ^ TK1[0] ^ TK2[0] ^ TK3[0] ^ (rc & 0x0F)) >>> 0;
      s3 = (s3 ^ TK1[1] ^ TK2[1] ^ TK3[1] ^ (rc >>> 4)) >>> 0;
      s0 = (s0 ^ 0x02) >>> 0;
      s3 = OpCodes.RotL32(s3, 8);
      s0 = OpCodes.RotL32(s0, 16);
      s1 = OpCodes.RotL32(s1, 24);
      s3 = (s3 ^ s0) >>> 0;
      s0 = (s0 ^ s2) >>> 0;
      s1 = (s1 ^ s0) >>> 0;
      skinny128_permute_tk_half(TK1, 2);
      skinny128_permute_tk_half(TK2, 2);
      skinny128_permute_tk_half(TK3, 2);
      TK2[2] = skinny128_LFSR2(TK2[2]);
      TK2[3] = skinny128_LFSR2(TK2[3]);
      TK3[2] = skinny128_LFSR3(TK3[2]);
      TK3[3] = skinny128_LFSR3(TK3[3]);

      // Round 4
      rc = ((rc << 1) ^ ((rc >>> 5) & 0x01) ^ ((rc >>> 4) & 0x01) ^ 0x01) & 0x3F;
      s1 = skinny128_sbox(s1);
      s2 = skinny128_sbox(s2);
      s3 = skinny128_sbox(s3);
      s0 = skinny128_sbox(s0);
      s1 = (s1 ^ TK1[2] ^ TK2[2] ^ TK3[2] ^ (rc & 0x0F)) >>> 0;
      s2 = (s2 ^ TK1[3] ^ TK2[3] ^ TK3[3] ^ (rc >>> 4)) >>> 0;
      s3 = (s3 ^ 0x02) >>> 0;
      s2 = OpCodes.RotL32(s2, 8);
      s3 = OpCodes.RotL32(s3, 16);
      s0 = OpCodes.RotL32(s0, 24);
      s2 = (s2 ^ s3) >>> 0;
      s3 = (s3 ^ s1) >>> 0;
      s0 = (s0 ^ s3) >>> 0;
      skinny128_permute_tk_half(TK1, 0);
      skinny128_permute_tk_half(TK2, 0);
      skinny128_permute_tk_half(TK3, 0);
      TK2[0] = skinny128_LFSR2(TK2[0]);
      TK2[1] = skinny128_LFSR2(TK2[1]);
      TK3[0] = skinny128_LFSR3(TK3[0]);
      TK3[1] = skinny128_LFSR3(TK3[1]);
    }

    // Write ciphertext
    const s0_bytes = OpCodes.Unpack32LE(s0);
    const s1_bytes = OpCodes.Unpack32LE(s1);
    const s2_bytes = OpCodes.Unpack32LE(s2);
    const s3_bytes = OpCodes.Unpack32LE(s3);

    for (let i = 0; i < 4; i++) {
      ciphertext[i] = s0_bytes[i];
      ciphertext[i + 4] = s1_bytes[i];
      ciphertext[i + 8] = s2_bytes[i];
      ciphertext[i + 12] = s3_bytes[i];
    }
  }

  // ============================================================================
  // SKINNY-tk2-HASH (32-byte state, 4-byte absorption rate)
  // ============================================================================

  class SKINNYtk2Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "SKINNY-tk2-HASH";
      this.description = "Lightweight hash function based on SKINNY-128-256 tweakable block cipher. Uses 32-byte internal state with 4-byte absorption rate for efficient lightweight implementations.";
      this.inventor = "Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem("SKINNY Specification", "https://eprint.iacr.org/2016/660.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Official test vectors from SKINNY-tk2-HASH.txt
      this.tests = [
        {
          text: "SKINNY-tk2-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("5DC460677EBA0DF3B48C60E949097A6C5D58E1C9ECF97C6FE89212B4B91F246F")
        },
        {
          text: "SKINNY-tk2-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("49BC2538DEC23CD247989DE36F83BB730D307C758405EF15F7E97FCB7F7674D9")
        },
        {
          text: "SKINNY-tk2-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("A5CDCF914B9B8368CB4BC005B36F475E514ED3441799D0E8C022FD50BED8E206")
        },
        {
          text: "SKINNY-tk2-HASH: Three bytes (Count=4)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("28FB54A33D65032430AF9B45C3417D52D600D22904C8C4AB3675EF29DFF999B7")
        },
        {
          text: "SKINNY-tk2-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("5557CAA3489858BBF119D7FCF55CDAA1E9817FD647CF68094432A2487D20D377")
        },
        {
          text: "SKINNY-tk2-HASH: Sixteen bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("8E110634307103B6AA92851B083058814F2A64DA807B0824EB8D2865CC6A1447")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SKINNYtk2HashInstance(this);
    }
  }

  class SKINNYtk2HashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.STATE_SIZE = 32;
      this.RATE = 4;
      this.state = new Uint8Array(this.STATE_SIZE);
      this.buffer = new Uint8Array(this.RATE);
      this.bufferPos = 0;
      this.Reset();
    }

    Reset() {
      this.state.fill(0);
      this.state[this.RATE] = 0x80; // Initial padding position marker
      this.buffer.fill(0);
      this.bufferPos = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      let offset = 0;

      // Handle partial block from previous Feed
      while (offset < data.length && this.bufferPos < this.RATE) {
        this.buffer[this.bufferPos++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferPos === this.RATE) {
        // XOR buffer into state
        for (let i = 0; i < this.RATE; i++) {
          this.state[i] ^= this.buffer[i];
        }

        // Permute state
        this._permute();

        // Start new block
        this.bufferPos = 0;

        while (offset < data.length && this.bufferPos < this.RATE) {
          this.buffer[this.bufferPos++] = data[offset++];
        }
      }
    }

    Result() {
      // XOR partial block into state
      for (let i = 0; i < this.bufferPos; i++) {
        this.state[i] ^= this.buffer[i];
      }

      // Apply 0x80 padding byte
      this.state[this.bufferPos] ^= 0x80;

      // Permute
      this._permute();

      // Extract first 16 bytes
      const output = new Array(32);
      for (let i = 0; i < 16; i++) {
        output[i] = this.state[i];
      }

      // Permute again
      this._permute();

      // Extract next 16 bytes
      for (let i = 0; i < 16; i++) {
        output[16 + i] = this.state[i];
      }

      // Reset for next use
      this.Reset();

      return output;
    }

    _permute() {
      const temp = new Uint8Array(32);
      const block = new Uint8Array(16);
      block.fill(0);

      // Encrypt block[0:16] = {0x00, 0x00...} using state as tweakey
      skinny128_256_encrypt_tk_full(this.state, temp, block);

      // Encrypt block[16:32] = {0x01, 0x00...} using state as tweakey
      block[0] = 0x01;
      skinny128_256_encrypt_tk_full(this.state, temp.subarray(16), block);

      // Update state
      this.state.set(temp);
    }
  }

  // ============================================================================
  // SKINNY-tk3-HASH (48-byte state, 16-byte absorption rate)
  // ============================================================================

  class SKINNYtk3Hash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "SKINNY-tk3-HASH";
      this.description = "Lightweight hash function based on SKINNY-128-384 tweakable block cipher. Uses 48-byte internal state with 16-byte absorption rate for higher throughput in lightweight implementations.";
      this.inventor = "Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem("SKINNY Specification", "https://eprint.iacr.org/2016/660.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Official test vectors from SKINNY-tk3-HASH.txt
      this.tests = [
        {
          text: "SKINNY-tk3-HASH: Empty message (Count=1)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("15C81E6EB26ED692B51CF10A3FE186718C7AA6745CCEB7C82FF63F915F91E27B")
        },
        {
          text: "SKINNY-tk3-HASH: Single byte 0x00 (Count=2)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("1EFD40A650A042DBEFEF8FD5552F70F52F5224036BFC5483CF1828A62B4C5D59")
        },
        {
          text: "SKINNY-tk3-HASH: Two bytes (Count=3)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("760BF1C2F83615FF57DF00BA05128B124A4DEA2CC096601130C534DC7571EACB")
        },
        {
          text: "SKINNY-tk3-HASH: Three bytes (Count=4)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("3F5FF72381989FEED4F8F732DC5414FD9E8712CDD3C4D363A1C9E8A568E33EDE")
        },
        {
          text: "SKINNY-tk3-HASH: Four bytes (Count=5)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("92AD1CB242B43F9A00F65FEB037ACA2DC98958CA0083D132C944C1FA85C36D8F")
        },
        {
          text: "SKINNY-tk3-HASH: Sixteen bytes (Count=17)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("A09D8D868ADF68957378C500ADA9678A362897068D9AB00E9483196C318FD4FF")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new SKINNYtk3HashInstance(this);
    }
  }

  class SKINNYtk3HashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.STATE_SIZE = 48;
      this.RATE = 16;
      this.state = new Uint8Array(this.STATE_SIZE);
      this.buffer = new Uint8Array(this.RATE);
      this.bufferPos = 0;
      this.Reset();
    }

    Reset() {
      this.state.fill(0);
      this.state[this.RATE] = 0x80; // Initial padding position marker
      this.buffer.fill(0);
      this.bufferPos = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      let offset = 0;

      // Handle partial block from previous Feed
      while (offset < data.length && this.bufferPos < this.RATE) {
        this.buffer[this.bufferPos++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferPos === this.RATE) {
        // XOR buffer into state
        for (let i = 0; i < this.RATE; i++) {
          this.state[i] ^= this.buffer[i];
        }

        // Permute state
        this._permute();

        // Start new block
        this.bufferPos = 0;

        while (offset < data.length && this.bufferPos < this.RATE) {
          this.buffer[this.bufferPos++] = data[offset++];
        }
      }
    }

    Result() {
      // XOR partial block into state
      for (let i = 0; i < this.bufferPos; i++) {
        this.state[i] ^= this.buffer[i];
      }

      // Apply 0x80 padding byte
      this.state[this.bufferPos] ^= 0x80;

      // Permute
      this._permute();

      // Extract first 16 bytes
      const output = new Array(32);
      for (let i = 0; i < 16; i++) {
        output[i] = this.state[i];
      }

      // Permute again
      this._permute();

      // Extract next 16 bytes
      for (let i = 0; i < 16; i++) {
        output[16 + i] = this.state[i];
      }

      // Reset for next use
      this.Reset();

      return output;
    }

    _permute() {
      const temp = new Uint8Array(48);
      const block = new Uint8Array(16);
      block.fill(0);

      // Encrypt block[0:16] = {0x00, 0x00...} using state as tweakey
      skinny128_384_encrypt_tk_full(this.state, temp, block);

      // Encrypt block[16:32] = {0x01, 0x00...} using state as tweakey
      block[0] = 0x01;
      skinny128_384_encrypt_tk_full(this.state, temp.subarray(16), block);

      // Encrypt block[32:48] = {0x02, 0x00...} using state as tweakey
      block[0] = 0x02;
      skinny128_384_encrypt_tk_full(this.state, temp.subarray(32), block);

      // Update state
      this.state.set(temp);
    }
  }

  // Register both algorithms
  RegisterAlgorithm(new SKINNYtk2Hash());
  RegisterAlgorithm(new SKINNYtk3Hash());

  return {
    SKINNYtk2Hash,
    SKINNYtk2HashInstance,
    SKINNYtk3Hash,
    SKINNYtk3HashInstance
  };
}));
