/*
 * Pelican MAC
 * Professional implementation matching LibTomCrypt reference
 * (c)2006-2025 Hawkynt
 *
 * AES-based MAC with 4-round compression
 * 128-bit key, 128-bit tag
 * Reference: LibTomCrypt pelican.c
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
          MacAlgorithm, IMacInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Pelican constants
  const BLOCK_SIZE = 16;  // 128 bits
  const TAG_SIZE = 16;    // 128 bits
  const KEY_SIZE = 16;    // 128 bits (AES-128 only)

  // AES S-box
  const SBOX = new Uint8Array([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ]);

  // AES T-tables for encryption (pre-computed)
  const TE0 = new Uint32Array(256);
  const TE1 = new Uint32Array(256);
  const TE2 = new Uint32Array(256);
  const TE3 = new Uint32Array(256);

  // Initialize T-tables
  (function initTables() {
    const mul2 = [
      0x00,0x02,0x04,0x06,0x08,0x0a,0x0c,0x0e,0x10,0x12,0x14,0x16,0x18,0x1a,0x1c,0x1e,
      0x20,0x22,0x24,0x26,0x28,0x2a,0x2c,0x2e,0x30,0x32,0x34,0x36,0x38,0x3a,0x3c,0x3e,
      0x40,0x42,0x44,0x46,0x48,0x4a,0x4c,0x4e,0x50,0x52,0x54,0x56,0x58,0x5a,0x5c,0x5e,
      0x60,0x62,0x64,0x66,0x68,0x6a,0x6c,0x6e,0x70,0x72,0x74,0x76,0x78,0x7a,0x7c,0x7e,
      0x80,0x82,0x84,0x86,0x88,0x8a,0x8c,0x8e,0x90,0x92,0x94,0x96,0x98,0x9a,0x9c,0x9e,
      0xa0,0xa2,0xa4,0xa6,0xa8,0xaa,0xac,0xae,0xb0,0xb2,0xb4,0xb6,0xb8,0xba,0xbc,0xbe,
      0xc0,0xc2,0xc4,0xc6,0xc8,0xca,0xcc,0xce,0xd0,0xd2,0xd4,0xd6,0xd8,0xda,0xdc,0xde,
      0xe0,0xe2,0xe4,0xe6,0xe8,0xea,0xec,0xee,0xf0,0xf2,0xf4,0xf6,0xf8,0xfa,0xfc,0xfe,
      0x1b,0x19,0x1f,0x1d,0x13,0x11,0x17,0x15,0x0b,0x09,0x0f,0x0d,0x03,0x01,0x07,0x05,
      0x3b,0x39,0x3f,0x3d,0x33,0x31,0x37,0x35,0x2b,0x29,0x2f,0x2d,0x23,0x21,0x27,0x25,
      0x5b,0x59,0x5f,0x5d,0x53,0x51,0x57,0x55,0x4b,0x49,0x4f,0x4d,0x43,0x41,0x47,0x45,
      0x7b,0x79,0x7f,0x7d,0x73,0x71,0x77,0x75,0x6b,0x69,0x6f,0x6d,0x63,0x61,0x67,0x65,
      0x9b,0x99,0x9f,0x9d,0x93,0x91,0x97,0x95,0x8b,0x89,0x8f,0x8d,0x83,0x81,0x87,0x85,
      0xbb,0xb9,0xbf,0xbd,0xb3,0xb1,0xb7,0xb5,0xab,0xa9,0xaf,0xad,0xa3,0xa1,0xa7,0xa5,
      0xdb,0xd9,0xdf,0xdd,0xd3,0xd1,0xd7,0xd5,0xcb,0xc9,0xcf,0xcd,0xc3,0xc1,0xc7,0xc5,
      0xfb,0xf9,0xff,0xfd,0xf3,0xf1,0xf7,0xf5,0xeb,0xe9,0xef,0xed,0xe3,0xe1,0xe7,0xe5
    ];
    const mul3 = [
      0x00,0x03,0x06,0x05,0x0c,0x0f,0x0a,0x09,0x18,0x1b,0x1e,0x1d,0x14,0x17,0x12,0x11,
      0x30,0x33,0x36,0x35,0x3c,0x3f,0x3a,0x39,0x28,0x2b,0x2e,0x2d,0x24,0x27,0x22,0x21,
      0x60,0x63,0x66,0x65,0x6c,0x6f,0x6a,0x69,0x78,0x7b,0x7e,0x7d,0x74,0x77,0x72,0x71,
      0x50,0x53,0x56,0x55,0x5c,0x5f,0x5a,0x59,0x48,0x4b,0x4e,0x4d,0x44,0x47,0x42,0x41,
      0xc0,0xc3,0xc6,0xc5,0xcc,0xcf,0xca,0xc9,0xd8,0xdb,0xde,0xdd,0xd4,0xd7,0xd2,0xd1,
      0xf0,0xf3,0xf6,0xf5,0xfc,0xff,0xfa,0xf9,0xe8,0xeb,0xee,0xed,0xe4,0xe7,0xe2,0xe1,
      0xa0,0xa3,0xa6,0xa5,0xac,0xaf,0xaa,0xa9,0xb8,0xbb,0xbe,0xbd,0xb4,0xb7,0xb2,0xb1,
      0x90,0x93,0x96,0x95,0x9c,0x9f,0x9a,0x99,0x88,0x8b,0x8e,0x8d,0x84,0x87,0x82,0x81,
      0x9b,0x98,0x9d,0x9e,0x97,0x94,0x91,0x92,0x83,0x80,0x85,0x86,0x8f,0x8c,0x89,0x8a,
      0xab,0xa8,0xad,0xae,0xa7,0xa4,0xa1,0xa2,0xb3,0xb0,0xb5,0xb6,0xbf,0xbc,0xb9,0xba,
      0xfb,0xf8,0xfd,0xfe,0xf7,0xf4,0xf1,0xf2,0xe3,0xe0,0xe5,0xe6,0xef,0xec,0xe9,0xea,
      0xcb,0xc8,0xcd,0xce,0xc7,0xc4,0xc1,0xc2,0xd3,0xd0,0xd5,0xd6,0xdf,0xdc,0xd9,0xda,
      0x5b,0x58,0x5d,0x5e,0x57,0x54,0x51,0x52,0x43,0x40,0x45,0x46,0x4f,0x4c,0x49,0x4a,
      0x6b,0x68,0x6d,0x6e,0x67,0x64,0x61,0x62,0x73,0x70,0x75,0x76,0x7f,0x7c,0x79,0x7a,
      0x3b,0x38,0x3d,0x3e,0x37,0x34,0x31,0x32,0x23,0x20,0x25,0x26,0x2f,0x2c,0x29,0x2a,
      0x0b,0x08,0x0d,0x0e,0x07,0x04,0x01,0x02,0x13,0x10,0x15,0x16,0x1f,0x1c,0x19,0x1a
    ];

    for (let i = 0; i < 256; ++i) {
      const s = SBOX[i];
      TE0[i] = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(mul2[s], 24), OpCodes.Shl32(s, 16)), OpCodes.Shl32(s, 8)), mul3[s]);
      TE1[i] = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(mul3[s], 24), OpCodes.Shl32(mul2[s], 16)), OpCodes.Shl32(s, 8)), s);
      TE2[i] = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(s, 24), OpCodes.Shl32(mul3[s], 16)), OpCodes.Shl32(mul2[s], 8)), s);
      TE3[i] = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(s, 24), OpCodes.Shl32(s, 16)), OpCodes.Shl32(mul3[s], 8)), mul2[s]);
    }
  })();

  class PelicanAlgorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "Pelican";
      this.description = "Pelican MAC is an AES-based message authentication code using a 4-round compression function. Provides 128-bit authentication tags with 128-bit keys.";
      this.inventor = "Daemen, Rijmen";
      this.year = 2005;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];  // AES-128 only
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem("Pelican Specification", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/pelican.pdf")
      ];

      this.references = [
        new LinkItem("LibTomCrypt Pelican", "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican.c")
      ];

      this.tests = [
        {
          text: "Pelican: Empty message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: [],
          expected: OpCodes.Hex8ToBytes("eb583715f834dee5a4d16ee4b9d7760e")
        },
        {
          text: "Pelican: 3-byte message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("1c9740606c58172d0394197081c43854")
        },
        {
          text: "Pelican: 16-byte message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("03cc46b8aca79c361e8c6ea67b893249")
        },
        {
          text: "Pelican: 32-byte message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("89cc36581bdd4db578bbacf0ff8b0815")
        },
        {
          text: "Pelican: 35-byte message (LibTomCrypt)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202123"),
          expected: OpCodes.Hex8ToBytes("4a7d454dcdb5da8d487816485d459599")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // MACs have no inverse
      return new PelicanInstance(this);
    }
  }

  /**
 * Pelican cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PelicanInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new Uint8Array(16);
      this.buffer = [];
      this._key = null;
      this.roundKeys = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        return;
      }

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
      }

      this._key = [...keyBytes];
      this._expandKey();
      this._initialize();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    _expandKey() {
      // AES-128 key expansion (10 rounds)
      this.roundKeys = new Uint32Array(44); // 11 round keys * 4 words

      // First round key is the key itself
      for (let i = 0; i < 4; ++i) {
        this.roundKeys[i] = OpCodes.Pack32BE(
          this._key[i * 4],
          this._key[i * 4 + 1],
          this._key[i * 4 + 2],
          this._key[i * 4 + 3]
        );
      }

      const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

      for (let i = 4; i < 44; ++i) {
        let temp = this.roundKeys[i - 1];

        if (i % 4 === 0) {
          // RotWord
          temp = OpCodes.Shr32(OpCodes.Or32(OpCodes.Shl32(temp, 8), OpCodes.Shr32(temp, 24)), 0);

          // SubWord
          const bytes = OpCodes.Unpack32BE(temp);
          for (let j = 0; j < 4; ++j) {
            bytes[j] = SBOX[bytes[j]];
          }
          temp = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);

          // XOR with Rcon
          temp = OpCodes.Xor32(temp, OpCodes.Shl32(rcon[(i / 4) - 1], 24));
        }

        this.roundKeys[i] = OpCodes.ToUint32(OpCodes.Xor32(this.roundKeys[i - 4], temp));
      }
    }

    _aesEncrypt(input, output) {
      // Load state
      let s0 = OpCodes.ToUint32(OpCodes.Pack32BE(input[0], input[1], input[2], input[3]));
      let s1 = OpCodes.ToUint32(OpCodes.Pack32BE(input[4], input[5], input[6], input[7]));
      let s2 = OpCodes.ToUint32(OpCodes.Pack32BE(input[8], input[9], input[10], input[11]));
      let s3 = OpCodes.ToUint32(OpCodes.Pack32BE(input[12], input[13], input[14], input[15]));

      // Initial round key addition
      s0 = OpCodes.Xor32(s0, this.roundKeys[0]);
      s1 = OpCodes.Xor32(s1, this.roundKeys[1]);
      s2 = OpCodes.Xor32(s2, this.roundKeys[2]);
      s3 = OpCodes.Xor32(s3, this.roundKeys[3]);

      // 9 main rounds
      for (let round = 1; round < 10; ++round) {
        const t0 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s0, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s1, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s2, 8), 0xff)]), TE3[OpCodes.And32(s3, 0xff)]), this.roundKeys[round * 4]), 0);

        const t1 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s1, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s2, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s3, 8), 0xff)]), TE3[OpCodes.And32(s0, 0xff)]), this.roundKeys[round * 4 + 1]), 0);

        const t2 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s2, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s3, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s0, 8), 0xff)]), TE3[OpCodes.And32(s1, 0xff)]), this.roundKeys[round * 4 + 2]), 0);

        const t3 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s3, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s0, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s1, 8), 0xff)]), TE3[OpCodes.And32(s2, 0xff)]), this.roundKeys[round * 4 + 3]), 0);

        s0 = t0; s1 = t1; s2 = t2; s3 = t3;
      }

      // Final round (no MixColumns)
      const t0 = OpCodes.Shr32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s0, 24), 0xff)], 24), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s1, 16), 0xff)], 16)), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s2, 8), 0xff)], 8)), SBOX[OpCodes.And32(s3, 0xff)]), 0);

      const t1 = OpCodes.Shr32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s1, 24), 0xff)], 24), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s2, 16), 0xff)], 16)), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s3, 8), 0xff)], 8)), SBOX[OpCodes.And32(s0, 0xff)]), 0);

      const t2 = OpCodes.Shr32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s2, 24), 0xff)], 24), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s3, 16), 0xff)], 16)), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s0, 8), 0xff)], 8)), SBOX[OpCodes.And32(s1, 0xff)]), 0);

      const t3 = OpCodes.Shr32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s3, 24), 0xff)], 24), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s0, 16), 0xff)], 16)), OpCodes.Shl32(SBOX[OpCodes.And32(OpCodes.Shr32(s1, 8), 0xff)], 8)), SBOX[OpCodes.And32(s2, 0xff)]), 0);

      s0 = OpCodes.ToUint32(OpCodes.Xor32(t0, this.roundKeys[40]));
      s1 = OpCodes.ToUint32(OpCodes.Xor32(t1, this.roundKeys[41]));
      s2 = OpCodes.ToUint32(OpCodes.Xor32(t2, this.roundKeys[42]));
      s3 = OpCodes.ToUint32(OpCodes.Xor32(t3, this.roundKeys[43]));

      // Store output
      const b0 = OpCodes.Unpack32BE(s0);
      const b1 = OpCodes.Unpack32BE(s1);
      const b2 = OpCodes.Unpack32BE(s2);
      const b3 = OpCodes.Unpack32BE(s3);

      for (let i = 0; i < 4; ++i) {
        output[i] = b0[i];
        output[i + 4] = b1[i];
        output[i + 8] = b2[i];
        output[i + 12] = b3[i];
      }
    }

    _fourRounds() {
      // Apply 4 AES rounds to state (uses T-tables)
      let s0 = OpCodes.ToUint32(OpCodes.Pack32BE(this.state[0], this.state[1], this.state[2], this.state[3]));
      let s1 = OpCodes.ToUint32(OpCodes.Pack32BE(this.state[4], this.state[5], this.state[6], this.state[7]));
      let s2 = OpCodes.ToUint32(OpCodes.Pack32BE(this.state[8], this.state[9], this.state[10], this.state[11]));
      let s3 = OpCodes.ToUint32(OpCodes.Pack32BE(this.state[12], this.state[13], this.state[14], this.state[15]));

      for (let r = 0; r < 4; ++r) {
        const t0 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s0, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s1, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s2, 8), 0xff)]), TE3[OpCodes.And32(s3, 0xff)]), 0);

        const t1 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s1, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s2, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s3, 8), 0xff)]), TE3[OpCodes.And32(s0, 0xff)]), 0);

        const t2 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s2, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s3, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s0, 8), 0xff)]), TE3[OpCodes.And32(s1, 0xff)]), 0);

        const t3 = OpCodes.Shr32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[OpCodes.And32(OpCodes.Shr32(s3, 24), 0xff)], TE1[OpCodes.And32(OpCodes.Shr32(s0, 16), 0xff)]), TE2[OpCodes.And32(OpCodes.Shr32(s1, 8), 0xff)]), TE3[OpCodes.And32(s2, 0xff)]), 0);

        s0 = t0; s1 = t1; s2 = t2; s3 = t3;
      }

      // Store back to state
      const b0 = OpCodes.Unpack32BE(s0);
      const b1 = OpCodes.Unpack32BE(s1);
      const b2 = OpCodes.Unpack32BE(s2);
      const b3 = OpCodes.Unpack32BE(s3);

      for (let i = 0; i < 4; ++i) {
        this.state[i] = b0[i];
        this.state[i + 4] = b1[i];
        this.state[i + 8] = b2[i];
        this.state[i + 12] = b3[i];
      }
    }

    _initialize() {
      // Initialize state by encrypting zero block
      this.state.fill(0);
      this._aesEncrypt(this.state, this.state);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.buffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");

      // Calculate buffer length
      let buflen = this.buffer.length % 16;
      const numCompleteBlocks = Math.floor(this.buffer.length / 16);

      // Process all complete 16-byte blocks
      for (let block = 0; block < numCompleteBlocks; ++block) {
        for (let i = 0; i < 16; ++i) {
          this.state[i] = OpCodes.Xor32(this.state[i], this.buffer[block * 16 + i]);
        }
        this._fourRounds();
      }

      // Process remaining bytes (partial block, no 4 rounds)
      for (let i = 0; i < buflen; ++i) {
        this.state[i] = OpCodes.Xor32(this.state[i], this.buffer[numCompleteBlocks * 16 + i]);
      }

      // Add padding byte 0x80 at current position
      this.state[buflen] = OpCodes.Xor32(this.state[buflen], 0x80);

      // Final AES encryption
      const tag = new Uint8Array(16);
      this._aesEncrypt(this.state, tag);

      // Reset for next operation
      this.buffer = [];
      this._initialize();

      return Array.from(tag);
    }
  }

  const algorithmInstance = new PelicanAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PelicanAlgorithm, PelicanInstance };
}));
