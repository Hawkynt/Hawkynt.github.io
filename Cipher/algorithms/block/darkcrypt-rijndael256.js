/*
 * Rijndael-256 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The original (pre-AES) Rijndael specification generalized to an 8-column
 * state: 256-bit block (Nb=8), 256-bit key (Nk=8), 14 rounds (Nr=Nk+6), as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). Unlike AES (which fixes Nb=4), the original Rijndael
 * proposal's ShiftRow offsets depend on Nb; for Nb=8 the row-shift amounts
 * are {0,1,3,4} rather than AES's {0,1,2,3}. Uses the same S-box, MixColumns
 * matrix, and Rcon sequence as AES/Rijndael-128; the key schedule is the
 * same generalized Rijndael algorithm (RotWord/SubWord every Nk words,
 * plus an extra SubWord at the Nk/2 offset for Nk>6) applied with Nb=Nk=8.
 * As implemented in the DarkCrypt Total Commander plugin (standard
 * generalized-Rijndael-256, no DarkCrypt-specific parameter tweaks for
 * this cipher).
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
}((function () {
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const NB = 8;             // 8 columns -> 256-bit state/block
  const NK = 8;              // 8 key words -> 256-bit key
  const NR = NK + 6;          // 14 rounds
  const BLOCK_SIZE = 4 * NB;   // 32 bytes
  const KEY_SIZE = 4 * NK;      // 32 bytes

  // Row-shift offsets for the generalized Rijndael ShiftRow step, indexed by
  // Nb (per the original Rijndael proposal's table of shift offsets). AES
  // fixes Nb=4 and only ever uses {0,1,2,3}; Nb=8 uses {0,1,3,4}.
  const SHIFT_OFFSETS = [0, 1, 3, 4];

  const SBOX = new Uint8Array([
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  ]);

  const INV_SBOX = new Uint8Array([
    0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
    0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
    0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
    0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
    0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
    0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
    0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
    0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
    0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
    0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
    0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
    0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
    0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
    0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
    0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
    0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d
  ]);

  const RCON = new Uint8Array([
    0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36,0x6c,0xd8,0xab,0x4d
  ]);

  class DarkCryptRijndael256Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Rijndael-256 (DarkCrypt)";
      this.description = "Original Rijndael specification generalized to an 8-column state: 256-bit block, 256-bit key, 14 rounds, ShiftRow offsets {0,1,3,4} (per the original Rijndael proposal, not AES's fixed {0,1,2,3}). As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Joan Daemen, Vincent Rijmen";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)];     // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(BLOCK_SIZE, BLOCK_SIZE, 0)]; // fixed 256-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("AES overview (Wikipedia)", "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard"),
        new LinkItem("Rijndael submission to the AES competition", "https://csrc.nist.gov/projects/block-cipher-techniques/aes-development")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard block size", "256-bit-block Rijndael was not selected as AES and has seen far less cryptanalytic scrutiny than the standardized 128-bit-block variant.", "Use standard AES for interoperable, well-analyzed deployments.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Rijndael256 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c6227e7740b7e53b5cb77865278eab0726f62366d9aabad908936123a1fc8af3")
        },
        {
          text: "DarkCrypt Rijndael256 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("623d2bd4ca3796dc3d02ecf2f37fb637fd3da58509cebb67ab9265b04db51e7d")
        },
        {
          text: "DarkCrypt Rijndael256 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("97601be3b33cf4e6c9babb4601e25b0495026f30a0485dedb25169fed35933d9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRijndael256Instance(this, isInverse);
    }
  }

  class DarkCryptRijndael256Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.roundKeys = null; // NR+1 words of NB*4 bytes each, stored as [round][col][row]
      this.inputBuffer = [];
      this.BlockSize = BLOCK_SIZE;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Rijndael-256 (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._expandKey(this._key);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Generalized Rijndael key schedule: RotWord+SubWord+Rcon every Nk
    // words, plus (since Nk=8 > 6) an extra SubWord-only step at the
    // halfway point of each Nk-word group, per the original Rijndael spec.
    _expandKey(keyBytes) {
      const totalWords = NB * (NR + 1);
      const w = new Array(totalWords);
      for (let i = 0; i < NK; i++) {
        w[i] = [keyBytes[4 * i], keyBytes[4 * i + 1], keyBytes[4 * i + 2], keyBytes[4 * i + 3]];
      }
      let rconIdx = 0;
      for (let i = NK; i < totalWords; i++) {
        let temp = w[i - 1].slice();
        if (i % NK === 0) {
          temp = [temp[1], temp[2], temp[3], temp[0]];
          temp = temp.map(b => SBOX[b]);
          temp[0] ^= RCON[rconIdx++];
        } else if (NK > 6 && (i % NK) === 4) {
          temp = temp.map(b => SBOX[b]);
        }
        const prev = w[i - NK];
        w[i] = [OpCodes.Xor32(prev[0], temp[0]), OpCodes.Xor32(prev[1], temp[1]), OpCodes.Xor32(prev[2], temp[2]), OpCodes.Xor32(prev[3], temp[3])];
      }
      return w;
    }

    _stateFromBlock(block) {
      const state = [[], [], [], []];
      for (let c = 0; c < NB; c++)
        for (let r = 0; r < 4; r++)
          state[r][c] = block[4 * c + r];
      return state;
    }

    _blockFromState(state) {
      const block = new Array(BLOCK_SIZE);
      for (let c = 0; c < NB; c++)
        for (let r = 0; r < 4; r++)
          block[4 * c + r] = state[r][c];
      return block;
    }

    _addRoundKey(state, round) {
      for (let c = 0; c < NB; c++) {
        const word = this.roundKeys[round * NB + c];
        for (let r = 0; r < 4; r++) state[r][c] ^= word[r];
      }
    }

    _subBytes(state) {
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < NB; c++)
          state[r][c] = SBOX[state[r][c]];
    }

    _invSubBytes(state) {
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < NB; c++)
          state[r][c] = INV_SBOX[state[r][c]];
    }

    _shiftRows(state) {
      for (let r = 1; r < 4; r++) {
        const off = SHIFT_OFFSETS[r];
        const row = state[r].slice();
        for (let c = 0; c < NB; c++) state[r][c] = row[(c + off) % NB];
      }
    }

    _invShiftRows(state) {
      for (let r = 1; r < 4; r++) {
        const off = SHIFT_OFFSETS[r];
        const row = state[r].slice();
        for (let c = 0; c < NB; c++) state[r][c] = row[(c - off + NB) % NB];
      }
    }

    _mixColumns(state) {
      for (let c = 0; c < NB; c++) {
        const s0 = state[0][c], s1 = state[1][c], s2 = state[2][c], s3 = state[3][c];
        state[0][c] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.GF256Mul(s0, 2), OpCodes.GF256Mul(s1, 3)), OpCodes.Xor32(s2, s3));
        state[1][c] = OpCodes.Xor32(OpCodes.Xor32(s0, OpCodes.GF256Mul(s1, 2)), OpCodes.Xor32(OpCodes.GF256Mul(s2, 3), s3));
        state[2][c] = OpCodes.Xor32(OpCodes.Xor32(s0, s1), OpCodes.Xor32(OpCodes.GF256Mul(s2, 2), OpCodes.GF256Mul(s3, 3)));
        state[3][c] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.GF256Mul(s0, 3), s1), OpCodes.Xor32(s2, OpCodes.GF256Mul(s3, 2)));
      }
    }

    _invMixColumns(state) {
      for (let c = 0; c < NB; c++) {
        const s0 = state[0][c], s1 = state[1][c], s2 = state[2][c], s3 = state[3][c];
        state[0][c] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.GF256Mul(s0, 14), OpCodes.GF256Mul(s1, 11)), OpCodes.Xor32(OpCodes.GF256Mul(s2, 13), OpCodes.GF256Mul(s3, 9)));
        state[1][c] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.GF256Mul(s0, 9), OpCodes.GF256Mul(s1, 14)), OpCodes.Xor32(OpCodes.GF256Mul(s2, 11), OpCodes.GF256Mul(s3, 13)));
        state[2][c] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.GF256Mul(s0, 13), OpCodes.GF256Mul(s1, 9)), OpCodes.Xor32(OpCodes.GF256Mul(s2, 14), OpCodes.GF256Mul(s3, 11)));
        state[3][c] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.GF256Mul(s0, 11), OpCodes.GF256Mul(s1, 13)), OpCodes.Xor32(OpCodes.GF256Mul(s2, 9), OpCodes.GF256Mul(s3, 14)));
      }
    }

    _encryptBlock(block) {
      const state = this._stateFromBlock(block);
      this._addRoundKey(state, 0);
      for (let round = 1; round < NR; round++) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, round);
      }
      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, NR);
      return this._blockFromState(state);
    }

    _decryptBlock(block) {
      const state = this._stateFromBlock(block);
      this._addRoundKey(state, NR);
      for (let round = NR - 1; round > 0; round--) {
        this._invShiftRows(state);
        this._invSubBytes(state);
        this._addRoundKey(state, round);
        this._invMixColumns(state);
      }
      this._invShiftRows(state);
      this._invSubBytes(state);
      this._addRoundKey(state, 0);
      return this._blockFromState(state);
    }
  }

  const algorithmInstance = new DarkCryptRijndael256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptRijndael256Algorithm, DarkCryptRijndael256Instance };
}));
