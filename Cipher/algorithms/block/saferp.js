/*
 * SAFER+ (SAFER Plus) Block Cipher
 * Professional implementation matching LibTomCrypt reference
 * (c)2006-2025 Hawkynt
 *
 * Enhanced SAFER with 128-bit blocks and PHT transform
 * 16-byte block, 16/24/32-byte keys, 8/12/16 rounds
 * Reference: LibTomCrypt saferp.c
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

  // SAFER+ constants
  const BLOCK_SIZE = 16;  // 128 bits

  // SAFER exponential and logarithm S-boxes (from LibTomCrypt)
  const safer_ebox = new Uint8Array([
      1,  45, 226, 147, 190,  69,  21, 174, 120,   3, 135, 164, 184,  56, 207,  63,
      8, 103,   9, 148, 235,  38, 168, 107, 189,  24,  52,  27, 187, 191, 114, 247,
     64,  53,  72, 156,  81,  47,  59,  85, 227, 192, 159, 216, 211, 243, 141, 177,
    255, 167,  62, 220, 134, 119, 215, 166,  17, 251, 244, 186, 146, 145, 100, 131,
    241,  51, 239, 218,  44, 181, 178,  43, 136, 209, 153, 203, 140, 132,  29,  20,
    129, 151, 113, 202,  95, 163, 139,  87,  60, 130, 196,  82,  92,  28, 232, 160,
      4, 180, 133,  74, 246,  19,  84, 182, 223,  12,  26, 142, 222, 224,  57, 252,
     32, 155,  36,  78, 169, 152, 158, 171, 242,  96, 208, 108, 234, 250, 199, 217,
      0, 212,  31, 110,  67, 188, 236,  83, 137, 254, 122,  93,  73, 201,  50, 194,
    249, 154, 248, 109,  22, 219,  89, 150,  68, 233, 205, 230,  70,  66, 143,  10,
    193, 204, 185, 101, 176, 210, 198, 172,  30,  65,  98,  41,  46,  14, 116,  80,
      2,  90, 195,  37, 123, 138,  42,  91, 240,   6,  13,  71, 111, 112, 157, 126,
     16, 206,  18,  39, 213,  76,  79, 214, 121,  48, 104,  54, 117, 125, 228, 237,
    128, 106, 144,  55, 162,  94, 118, 170, 197, 127,  61, 175, 165, 229,  25,  97,
    253,  77, 124, 183,  11, 238, 173,  75,  34, 245, 231, 115,  35,  33, 200,   5,
    225, 102, 221, 179,  88, 105,  99,  86,  15, 161,  49, 149,  23,   7,  58,  40
  ]);

  const safer_lbox = new Uint8Array([
    128,   0, 176,   9,  96, 239, 185, 253,  16,  18, 159, 228, 105, 186, 173, 248,
    192,  56, 194, 101,  79,   6, 148, 252,  25, 222, 106,  27,  93,  78, 168, 130,
    112, 237, 232, 236, 114, 179,  21, 195, 255, 171, 182,  71,  68,   1, 172,  37,
    201, 250, 142,  65,  26,  33, 203, 211,  13, 110, 254,  38,  88, 218,  50,  15,
     32, 169, 157, 132, 152,   5, 156, 187,  34, 140,  99, 231, 197, 225, 115, 198,
    175,  36,  91, 135, 102,  39, 247,  87, 244, 150, 177, 183,  92, 139, 213,  84,
    121, 223, 170, 246,  62, 163, 241,  17, 202, 245, 209,  23, 123, 147, 131, 188,
    189,  82,  30, 235, 174, 204, 214,  53,   8, 200, 138, 180, 226, 205, 191, 217,
    208,  80,  89,  63,  77,  98,  52,  10,  72, 136, 181,  86,  76,  46, 107, 158,
    210,  61,  60,   3,  19, 251, 151,  81, 117,  74, 145, 113,  35, 190, 118,  42,
     95, 249, 212,  85,  11, 220,  55,  49,  22, 116, 215, 119, 167, 230,   7, 219,
    164,  47,  70, 243,  97,  69, 103, 227,  12, 162,  59,  28, 133,  24,   4,  29,
     41, 160, 143, 178,  90, 216, 166, 126, 238, 141,  83,  75, 161, 154, 193,  14,
    122,  73, 165,  44, 129, 196, 199,  54,  43, 127,  67, 149,  51, 242, 108, 104,
    109, 240,   2,  40, 206, 221, 155, 234,  94, 153, 124,  20, 134, 207, 229,  66,
    184,  64, 120,  45,  58, 233, 100,  31, 146, 144, 125,  57, 111, 224, 137,  48
  ]);

  // Bias words for key schedule
  const safer_bias = [
    [  70, 151, 177, 186, 163, 183,  16,  10, 197,  55, 179, 201,  90,  40, 172, 100],
    [ 236, 171, 170, 198, 103, 149,  88,  13, 248, 154, 246, 110, 102, 220,   5,  61],
    [ 138, 195, 216, 137, 106, 233,  54,  73,  67, 191, 235, 212, 150, 155, 104, 160],
    [  93,  87, 146,  31, 213, 113,  92, 187,  34, 193, 190, 123, 188, 153,  99, 148],
    [  42,  97, 184,  52,  50,  25, 253, 251,  23,  64, 230,  81,  29,  65,  68, 143],
    [ 221,   4, 128, 222, 231,  49, 214, 127,   1, 162, 247,  57, 218, 111,  35, 202],
    [  58, 208,  28, 209,  48,  62,  18, 161, 205,  15, 224, 168, 175, 130,  89,  44],
    [ 125, 173, 178, 239, 194, 135, 206, 117,   6,  19,   2, 144,  79,  46, 114,  51],
    [ 192, 141, 207, 169, 129, 226, 196,  39,  47, 108, 122, 159,  82, 225,  21,  56],
    [ 252,  32,  66, 199,   8, 228,   9,  85,  94, 140,  20, 118,  96, 255, 223, 215],
    [ 250,  11,  33,   0,  26, 249, 166, 185, 232, 158,  98,  76, 217, 145,  80, 210],
    [  24, 180,   7, 132, 234,  91, 164, 200,  14, 203,  72, 105,  75,  78, 156,  53],
    [  69,  77,  84, 229,  37,  60,  12,  74, 139,  63, 204, 167, 219, 107, 174, 244],
    [  45, 243, 124, 109, 157, 181,  38, 116, 242, 147,  83, 176, 240,  17, 237, 131],
    [ 182,   3,  22, 115,  59,  30, 142, 112, 189, 134,  27,  71, 126,  36,  86, 241],
    [ 136,  70, 151, 177, 186, 163, 183,  16,  10, 197,  55, 179, 201,  90,  40, 172],
    [ 220, 134, 119, 215, 166,  17, 251, 244, 186, 146, 145, 100, 131, 241,  51, 239],
    [  44, 181, 178,  43, 136, 209, 153, 203, 140, 132,  29,  20, 129, 151, 113, 202],
    [ 163, 139,  87,  60, 130, 196,  82,  92,  28, 232, 160,   4, 180, 133,  74, 246],
    [  84, 182, 223,  12,  26, 142, 222, 224,  57, 252,  32, 155,  36,  78, 169, 152],
    [ 171, 242,  96, 208, 108, 234, 250, 199, 217,   0, 212,  31, 110,  67, 188, 236],
    [ 137, 254, 122,  93,  73, 201,  50, 194, 249, 154, 248, 109,  22, 219,  89, 150],
    [ 233, 205, 230,  70,  66, 143,  10, 193, 204, 185, 101, 176, 210, 198, 172,  30],
    [  98,  41,  46,  14, 116,  80,   2,  90, 195,  37, 123, 138,  42,  91, 240,   6],
    [  71, 111, 112, 157, 126,  16, 206,  18,  39, 213,  76,  79, 214, 121,  48, 104],
    [ 117, 125, 228, 237, 128, 106, 144,  55, 162,  94, 118, 170, 197, 127,  61, 175],
    [ 229,  25,  97, 253,  77, 124, 183,  11, 238, 173,  75,  34, 245, 231, 115,  35],
    [ 200,   5, 225, 102, 221, 179,  88, 105,  99,  86,  15, 161,  49, 149,  23,   7],
    [  40,   1,  45, 226, 147, 190,  69,  21, 174, 120,   3, 135, 164, 184,  56, 207],
    [   8, 103,   9, 148, 235,  38, 168, 107, 189,  24,  52,  27, 187, 191, 114, 247],
    [  53,  72, 156,  81,  47,  59,  85, 227, 192, 159, 216, 211, 243, 141, 177, 255],
    [  62, 220, 134, 119, 215, 166,  17, 251, 244, 186, 146, 145, 100, 131, 241,  51]
  ];

  /**
 * SAFERPAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class SAFERPAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "SAFER+";
      this.description = "SAFER+ (SAFER Plus) block cipher with enhanced security. Features 128-bit blocks, PHT transform for diffusion, and Armenian shuffle permutation. Supports 128/192/256-bit keys.";
      this.inventor = "James Massey, Gurgen Khachatrian";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "SP Network";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.SupportedKeySizes = [new KeySize(16, 32, 8)]; // 16, 24, 32 bytes
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];
      this.SupportedRounds = [new KeySize(8, 16, 4)]; // 8, 12, 16 rounds

      this.documentation = [
        new LinkItem("SAFER Specification", "https://en.wikipedia.org/wiki/SAFER"),
        new LinkItem("NESSIE Portfolio", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("LibTomCrypt SAFER+", "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/safer/saferp.c")
      ];

      this.tests = [
        {
          text: "SAFER+: 128-bit key (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/safer/saferp.c",
          key: OpCodes.Hex8ToBytes("2923be84e16cd6ae529049f1f1bbe9eb"),
          input: OpCodes.Hex8ToBytes("b3a6db3c870c3e99245e0d1c06b747de"),
          expected: OpCodes.Hex8ToBytes("e01fb60a0cff54467f0d59f90939a5dc")
        },
        {
          text: "SAFER+: 192-bit key (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/safer/saferp.c",
          key: OpCodes.Hex8ToBytes("48d38f75e6d91d2ae5c0f72b788187440e5f5000d4618dbe"),
          input: OpCodes.Hex8ToBytes("7b0515073b33821f187092da6454ceb1"),
          expected: OpCodes.Hex8ToBytes("5c88043f395f640096828210c16fdb85")
        },
        {
          text: "SAFER+: 256-bit key (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/safer/saferp.c",
          key: OpCodes.Hex8ToBytes("f3a88dfebef2eb71ffa0d03b75068c7e8778734dd0be82bedbc246412b8cfa30"),
          input: OpCodes.Hex8ToBytes("7f70f0a754863295aa5b68130be6fcf5"),
          expected: OpCodes.Hex8ToBytes("580b1924ace5cad5aa416999dc68998a")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SAFERPInstance(this, isInverse);
    }
  }

  /**
 * SAFERP cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SAFERPInstance extends IBlockCipherInstance {
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
      this._rounds = 0;
      this.K = []; // Round keys
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

      if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16, 24, or 32)`);
      }

      this._key = [...keyBytes];
      this._scheduleKey();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set rounds(value) {
      // Rounds are determined by key size, but allow override
      if (value !== 8 && value !== 12 && value !== 16) {
        throw new Error(`Invalid rounds: ${value} (must be 8, 12, or 16)`);
      }
      // Will be set during key schedule
    }

    get rounds() {
      return this._rounds;
    }

    _scheduleKey() {
      const keylen = this._key.length;
      const t = new Uint8Array(33);
      let y = 0;

      // Copy key and compute XOR checksum
      for (let x = 0; x < keylen; ++x) {
        t[x] = this._key[x];
        y = OpCodes.Xor32(y, this._key[x]);
      }
      t[keylen] = y;

      // Determine number of rounds based on key size
      if (keylen === 16) this._rounds = 8;
      else if (keylen === 24) this._rounds = 12;
      else this._rounds = 16;

      // Initialize round key array
      const maxRounds = this._rounds * 2 + 1;
      this.K = new Array(maxRounds);
      for (let i = 0; i < maxRounds; ++i) {
        this.K[i] = new Uint8Array(16);
      }

      // First round key is initial part of augmented key
      for (let x = 0; x < 16; ++x) {
        this.K[0][x] = t[x];
      }

      // Generate remaining round keys
      const tlen = keylen + 1;
      for (let x = 1; x < maxRounds; ++x) {
        // Rotate each byte of augmented key left by 3 bits
        for (let y = 0; y < tlen; ++y) {
          t[y] = OpCodes.RotL8(t[y], 3);
        }

        // Select bytes and add bias
        let z = x;
        for (let y = 0; y < 16; ++y) {
          this.K[x][y] = (t[z] + safer_bias[x - 1][y])&255;
          if (++z === tlen) z = 0;
        }
      }
    }

    // PHT (Pseudo-Hadamard Transform)
    _pht(b) {
      b[0] = (b[0] + (b[1] = (b[0] + b[1])&255))&255;
      b[2] = (b[2] + (b[3] = (b[3] + b[2])&255))&255;
      b[4] = (b[4] + (b[5] = (b[5] + b[4])&255))&255;
      b[6] = (b[6] + (b[7] = (b[7] + b[6])&255))&255;
      b[8] = (b[8] + (b[9] = (b[9] + b[8])&255))&255;
      b[10] = (b[10] + (b[11] = (b[11] + b[10])&255))&255;
      b[12] = (b[12] + (b[13] = (b[13] + b[12])&255))&255;
      b[14] = (b[14] + (b[15] = (b[15] + b[14])&255))&255;
    }

    // Inverse PHT
    _ipht(b) {
      b[15] = (b[15] - (b[14] = (b[14] - b[15])&255))&255;
      b[13] = (b[13] - (b[12] = (b[12] - b[13])&255))&255;
      b[11] = (b[11] - (b[10] = (b[10] - b[11])&255))&255;
      b[9] = (b[9] - (b[8] = (b[8] - b[9])&255))&255;
      b[7] = (b[7] - (b[6] = (b[6] - b[7])&255))&255;
      b[5] = (b[5] - (b[4] = (b[4] - b[5])&255))&255;
      b[3] = (b[3] - (b[2] = (b[2] - b[3])&255))&255;
      b[1] = (b[1] - (b[0] = (b[0] - b[1])&255))&255;
    }

    // Armenian Shuffle
    _shuffle(b, b2) {
      b2[0] = b[8]; b2[1] = b[11]; b2[2] = b[12]; b2[3] = b[15];
      b2[4] = b[2]; b2[5] = b[1]; b2[6] = b[6]; b2[7] = b[5];
      b2[8] = b[10]; b2[9] = b[9]; b2[10] = b[14]; b2[11] = b[13];
      b2[12] = b[0]; b2[13] = b[7]; b2[14] = b[4]; b2[15] = b[3];
    }

    // Inverse Armenian Shuffle
    _ishuffle(b, b2) {
      b2[0] = b[12]; b2[1] = b[5]; b2[2] = b[4]; b2[3] = b[15];
      b2[4] = b[14]; b2[5] = b[7]; b2[6] = b[6]; b2[7] = b[13];
      b2[8] = b[0]; b2[9] = b[9]; b2[10] = b[8]; b2[11] = b[1];
      b2[12] = b[2]; b2[13] = b[11]; b2[14] = b[10]; b2[15] = b[3];
    }

    // Linear Transform (4 rounds of PHT + Shuffle)
    _lt(b, b2) {
      this._pht(b); this._shuffle(b, b2);
      this._pht(b2); this._shuffle(b2, b);
      this._pht(b); this._shuffle(b, b2);
      this._pht(b2);
    }

    // Inverse Linear Transform
    _ilt(b, b2) {
      this._ipht(b);
      this._ishuffle(b, b2); this._ipht(b2);
      this._ishuffle(b2, b); this._ipht(b);
      this._ishuffle(b, b2); this._ipht(b2);
    }

    // Round function
    _round(b, keyIdx) {
      const k = this.K[keyIdx];
      const k1 = this.K[keyIdx + 1];

      b[0] = (safer_ebox[(b[0]^k[0])&255] + k1[0])&255;
      b[1] = safer_lbox[(b[1] + k[1])&255]^k1[1];
      b[2] = safer_lbox[(b[2] + k[2])&255]^k1[2];
      b[3] = (safer_ebox[(b[3]^k[3])&255] + k1[3])&255;
      b[4] = (safer_ebox[(b[4]^k[4])&255] + k1[4])&255;
      b[5] = safer_lbox[(b[5] + k[5])&255]^k1[5];
      b[6] = safer_lbox[(b[6] + k[6])&255]^k1[6];
      b[7] = (safer_ebox[(b[7]^k[7])&255] + k1[7])&255;
      b[8] = (safer_ebox[(b[8]^k[8])&255] + k1[8])&255;
      b[9] = safer_lbox[(b[9] + k[9])&255]^k1[9];
      b[10] = safer_lbox[(b[10] + k[10])&255]^k1[10];
      b[11] = (safer_ebox[(b[11]^k[11])&255] + k1[11])&255;
      b[12] = (safer_ebox[(b[12]^k[12])&255] + k1[12])&255;
      b[13] = safer_lbox[(b[13] + k[13])&255]^k1[13];
      b[14] = safer_lbox[(b[14] + k[14])&255]^k1[14];
      b[15] = (safer_ebox[(b[15]^k[15])&255] + k1[15])&255;
    }

    // Inverse round function
    _iround(b, keyIdx) {
      const k = this.K[keyIdx];
      const k1 = this.K[keyIdx + 1];

      b[0] = safer_lbox[(b[0] - k1[0])&255]^k[0];
      b[1] = (safer_ebox[(b[1]^k1[1])&255] - k[1])&255;
      b[2] = (safer_ebox[(b[2]^k1[2])&255] - k[2])&255;
      b[3] = safer_lbox[(b[3] - k1[3])&255]^k[3];
      b[4] = safer_lbox[(b[4] - k1[4])&255]^k[4];
      b[5] = (safer_ebox[(b[5]^k1[5])&255] - k[5])&255;
      b[6] = (safer_ebox[(b[6]^k1[6])&255] - k[6])&255;
      b[7] = safer_lbox[(b[7] - k1[7])&255]^k[7];
      b[8] = safer_lbox[(b[8] - k1[8])&255]^k[8];
      b[9] = (safer_ebox[(b[9]^k1[9])&255] - k[9])&255;
      b[10] = (safer_ebox[(b[10]^k1[10])&255] - k[10])&255;
      b[11] = safer_lbox[(b[11] - k1[11])&255]^k[11];
      b[12] = safer_lbox[(b[12] - k1[12])&255]^k[12];
      b[13] = (safer_ebox[(b[13]^k1[13])&255] - k[13])&255;
      b[14] = (safer_ebox[(b[14]^k1[14])&255] - k[14])&255;
      b[15] = safer_lbox[(b[15] - k1[15])&255]^k[15];
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
      if (this.inputBuffer.length % BLOCK_SIZE !== 0) {
        throw new Error(`Input must be multiple of ${BLOCK_SIZE} bytes`);
      }

      const output = [];

      for (let offset = 0; offset < this.inputBuffer.length; offset += BLOCK_SIZE) {
        const block = new Uint8Array(16);
        const temp = new Uint8Array(16);

        for (let i = 0; i < 16; ++i) {
          block[i] = this.inputBuffer[offset + i];
        }

        if (this.isInverse) {
          // Decrypt
          const finalKey = this.K[this._rounds * 2];
          block[0] = OpCodes.Xor32(block[0], finalKey[0]);
          block[1] = (block[1] - finalKey[1])&255;
          block[2] = (block[2] - finalKey[2])&255;
          block[3] = OpCodes.Xor32(block[3], finalKey[3]);
          block[4] = OpCodes.Xor32(block[4], finalKey[4]);
          block[5] = (block[5] - finalKey[5])&255;
          block[6] = (block[6] - finalKey[6])&255;
          block[7] = OpCodes.Xor32(block[7], finalKey[7]);
          block[8] = OpCodes.Xor32(block[8], finalKey[8]);
          block[9] = (block[9] - finalKey[9])&255;
          block[10] = (block[10] - finalKey[10])&255;
          block[11] = OpCodes.Xor32(block[11], finalKey[11]);
          block[12] = OpCodes.Xor32(block[12], finalKey[12]);
          block[13] = (block[13] - finalKey[13])&255;
          block[14] = (block[14] - finalKey[14])&255;
          block[15] = OpCodes.Xor32(block[15], finalKey[15]);

          // Reverse rounds
          if (this._rounds > 12) {
            this._ilt(block, temp); this._iround(temp, 30);
            this._ilt(temp, block); this._iround(block, 28);
            this._ilt(block, temp); this._iround(temp, 26);
            this._ilt(temp, block); this._iround(block, 24);
          }
          if (this._rounds > 8) {
            this._ilt(block, temp); this._iround(temp, 22);
            this._ilt(temp, block); this._iround(block, 20);
            this._ilt(block, temp); this._iround(temp, 18);
            this._ilt(temp, block); this._iround(block, 16);
          }
          this._ilt(block, temp); this._iround(temp, 14);
          this._ilt(temp, block); this._iround(block, 12);
          this._ilt(block, temp); this._iround(temp, 10);
          this._ilt(temp, block); this._iround(block, 8);
          this._ilt(block, temp); this._iround(temp, 6);
          this._ilt(temp, block); this._iround(block, 4);
          this._ilt(block, temp); this._iround(temp, 2);
          this._ilt(temp, block); this._iround(block, 0);

          output.push(...block);
        } else {
          // Encrypt
          this._round(block, 0); this._lt(block, temp);
          this._round(temp, 2); this._lt(temp, block);
          this._round(block, 4); this._lt(block, temp);
          this._round(temp, 6); this._lt(temp, block);
          this._round(block, 8); this._lt(block, temp);
          this._round(temp, 10); this._lt(temp, block);
          this._round(block, 12); this._lt(block, temp);
          this._round(temp, 14); this._lt(temp, block);

          if (this._rounds > 8) {
            this._round(block, 16); this._lt(block, temp);
            this._round(temp, 18); this._lt(temp, block);
            this._round(block, 20); this._lt(block, temp);
            this._round(temp, 22); this._lt(temp, block);
          }
          if (this._rounds > 12) {
            this._round(block, 24); this._lt(block, temp);
            this._round(temp, 26); this._lt(temp, block);
            this._round(block, 28); this._lt(block, temp);
            this._round(temp, 30); this._lt(temp, block);
          }

          // Final key mixing
          const finalKey = this.K[this._rounds * 2];
          block[0] = OpCodes.Xor32(block[0], finalKey[0]);
          block[1] = (block[1] + finalKey[1])&255;
          block[2] = (block[2] + finalKey[2])&255;
          block[3] = OpCodes.Xor32(block[3], finalKey[3]);
          block[4] = OpCodes.Xor32(block[4], finalKey[4]);
          block[5] = (block[5] + finalKey[5])&255;
          block[6] = (block[6] + finalKey[6])&255;
          block[7] = OpCodes.Xor32(block[7], finalKey[7]);
          block[8] = OpCodes.Xor32(block[8], finalKey[8]);
          block[9] = (block[9] + finalKey[9])&255;
          block[10] = (block[10] + finalKey[10])&255;
          block[11] = OpCodes.Xor32(block[11], finalKey[11]);
          block[12] = OpCodes.Xor32(block[12], finalKey[12]);
          block[13] = (block[13] + finalKey[13])&255;
          block[14] = (block[14] + finalKey[14])&255;
          block[15] = OpCodes.Xor32(block[15], finalKey[15]);

          output.push(...block);
        }
      }

      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new SAFERPAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SAFERPAlgorithm, SAFERPInstance };
}));
