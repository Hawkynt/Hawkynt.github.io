/*
 * SHARK-E (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SHARK-E as implemented in the DarkCrypt Total Commander plugin.
 * Unlike its sibling SHARK-A, SHARK-E's main block transform is structurally
 * identical to textbook/Crypto++ SHARK (Rijmen/Daemen/Preneel/Bosselaers/De Win,
 * 1996): 5 rounds combining classic SHARK C-box lookups (S-box substitution
 * fused with an MDS matrix multiply over GF(2^8)) with round-key XORs, followed
 * by a final S-box-only round. The 128-bit blocks are, however, processed in
 * the opposite byte order from the Crypto++ reference (the block is reversed
 * on the way in and out), and DarkCrypt's key schedule is a plain CFB-style
 * bootstrap (round keys 0-6 chained through a fixed 6-round SHARK cipher, with
 * the final round key additionally passed through SHARK's inverse-MDS matrix)
 * with NO rejection sampling — unlike SHARK-A's rejection-sampled schedule.
 * Shares its S-box, C-boxes and inverse-MDS matrix with SHARK-A. As implemented
 * in the DarkCrypt Total Commander plugin; test vectors verified against the
 * DarkCrypt implementation.
 * 64-bit blocks, 128-bit keys. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', './shark-cboxes.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./shark-cboxes.data')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.SharkCBoxes);
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, SharkCBoxes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');
  if (!SharkCBoxes) throw new Error('SharkCBoxes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const { CBOX_ENC, CBOX_DEC } = SharkCBoxes;

  function gfMul(a, b) { return OpCodes.GFMul(a, b, 0x1F5, 8); }

  // ===== Encryption/decryption S-boxes (identical to the classic SHARK S-box) =====
  const SBOX_ENC = Object.freeze([
    177,206,195,149, 90,173,231,  2, 77, 68,251,145, 12,135,161, 80,
    203,103, 84,221, 70,143,225, 78,240,253,252,235,249,196, 26,110,
     94,245,204,141, 28, 86, 67,254,  7, 97,248,117, 89,255,  3, 34,
    138,209, 19,238,136,  0, 14, 52, 21,128,148,227,237,181, 83, 35,
     75, 71, 23,167,144, 53,171,216,184,223, 79, 87,154,146,219, 27,
     60,200,153,  4,142,224,215,125,133,187, 64, 44, 58, 69,241, 66,
    101, 32, 65, 24,114, 37,147,112, 54,  5,242, 11,163,121,236,  8,
     39, 49, 50,182,124,176, 10,115, 91,123,183,129,210, 13,106, 38,
    158, 88,156,131,116,179,172, 48,122,105,119, 15,174, 33,222,208,
     46,151, 16,164,152,168,212,104, 45, 98, 41,109, 22, 73,118,199,
    232,193,150, 55,229,202,244,233, 99, 18,194,166, 20,188,211, 40,
    175, 47,230, 36, 82,198,160,  9,189,140,207, 93, 17, 95,  1,197,
    159, 61,162,155,201, 59,190, 81, 25, 31, 63, 92,178,239, 74,205,
    191,186,111,100,217,243, 62,180,170,220,213,  6,192,126,246,102,
    108,132,113, 56,185, 29,127,157, 72,139, 42,218,165, 51,130, 57,
    214,120,134,250,228, 43,169, 30,137, 96,107,234, 85, 76,247,226
  ]);

  const SBOX_DEC = Object.freeze((function () {
    const t = new Array(256);
    for (let i = 0; i < 256; ++i) t[SBOX_ENC[i]] = i;
    return t;
  })());

  // Inverse of the classic SHARK MDS matrix G (used to finish the key schedule's final round key).
  const MATRIX_IG = Object.freeze([
    [231, 48,144,133,208, 75,145, 65],
    [ 83,149,155,165,150,188,161,104],
    [  2, 69,247,101, 92, 31,182, 82],
    [162,202, 34,148, 68, 99, 42,162],
    [252,103,142, 16, 41,117,133,113],
    [ 36, 69,162,207, 47, 34,193, 14],
    [161,241,113, 64,145, 39, 24,165],
    [ 86,244,175, 50,210,164,220,113]
  ].map(row => Object.freeze(row)));

  // Fixed CFB "seed" keys for the key-schedule bootstrap cipher (cbox[0][0..6] of the classic SHARK
  // C-boxes; the 7th is later transformed by MATRIX_IG).
  const INIT_KEYS_RAW = [
    [0x060d838f, 0x16f3a365],
    [0xa68857ee, 0x5cae56f6],
    [0xebf51635, 0x3c2c4d89],
    [0x652174be, 0x88e85bdc],
    [0x0d4e9a80, 0x86c17921],
    [0x27ba7d33, 0xcffa58a1],
    [0x88d9e104, 0xa237b530]
  ];

  function xorBytes(a, b) { return a.map((x, i) => OpCodes.Xor32(x, b[i])); }

  function transformWord8(bytesBE, matrix) {
    const out = new Array(8).fill(0);
    for (let i = 0; i < 8; ++i)
      for (let j = 0; j < 8; ++j)
        out[i] ^= gfMul(matrix[i][j], bytesBE[j]);
    return out;
  }

  // Classic SHARK C-box round: 8 independent table lookups XORed together (S-box substitution
  // fused with an MDS matrix multiply). `bytes` and the result are 8-byte arrays, MSB-first.
  function cboxRoundBytes(bytes, cboxes) {
    let hi = 0, lo = 0;
    for (let i = 0; i < 8; ++i) {
      const e = cboxes[i][bytes[i]];
      hi ^= e[0]; lo ^= e[1];
    }
    return [...OpCodes.Unpack32BE(hi), ...OpCodes.Unpack32BE(lo)];
  }

  const BOOTSTRAP_INIT_KEYS = (function () {
    const keys = INIT_KEYS_RAW.map(w => [...OpCodes.Unpack32BE(w[0]), ...OpCodes.Unpack32BE(w[1])]);
    keys[6] = transformWord8(keys[6], MATRIX_IG);
    return keys;
  })();

  // Fixed 6-round classic SHARK cipher used purely to stretch/whiten key material during the
  // DarkCrypt key schedule (identical in structure to the main cipher below).
  function bootstrapEncrypt(feedbackBytes) {
    let state = xorBytes(feedbackBytes, BOOTSTRAP_INIT_KEYS[0]);
    for (let round = 1; round < 6; ++round) {
      const c = cboxRoundBytes(state, CBOX_ENC);
      state = xorBytes(c, BOOTSTRAP_INIT_KEYS[round]);
    }
    const sboxed = state.map(b => SBOX_ENC[b]);
    return xorBytes(sboxed, BOOTSTRAP_INIT_KEYS[6]);
  }

  function keyBufBlock(keyBytes, blockIndex) {
    const n = keyBytes.length;
    const bytes = [];
    let idx = (blockIndex * 8) % n;
    for (let i = 0; i < 8; ++i) { bytes.push(keyBytes[idx]); idx = (idx + 1) % n; }
    return bytes;
  }

  // Plain CFB round-key schedule: RK[0]=E(0), RK[i]=keyMaterial[i] XOR E(RK[i-1]) for i=1..6.
  // The final round key is additionally passed through SHARK's inverse-MDS matrix.
  function deriveEncryptRoundKeys(keyBytes) {
    let feedback = new Array(8).fill(0);
    const RK = [];
    for (let block = 0; block < 7; ++block) {
      const enc = bootstrapEncrypt(feedback);
      const cipher = xorBytes(keyBufBlock(keyBytes, block), enc);
      RK.push(cipher);
      feedback = cipher;
    }
    RK[6] = transformWord8(RK[6], MATRIX_IG);
    return RK;
  }

  // Decryption round keys: reversed order, with the (now) middle keys re-transformed by the
  // inverse-MDS matrix so that CBOX_DEC lookups correctly invert the encryption C-box rounds.
  function deriveDecryptRoundKeys(encryptRK) {
    const dRK = new Array(7);
    dRK[0] = encryptRK[6];
    dRK[6] = encryptRK[0];
    for (let i = 1; i < 6; ++i) dRK[i] = transformWord8(encryptRK[6 - i], MATRIX_IG);
    return dRK;
  }

  class SharkEDarkCryptAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SHARK-E (DarkCrypt)";
      this.description = "SHARK-E variant from the DarkCrypt Total Commander plugin: structurally the classic SHARK cipher (5 C-box rounds + S-box-only final round, 64-bit block, 128-bit key) with a plain CFB round-key schedule (no rejection sampling) and blocks processed byte-reversed relative to the Crypto++ reference.";
      this.inventor = "Vincent Rijmen, Joan Daemen, Bart Preneel, Anton Bosselaers, Erik De Win (base SHARK); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SHARK (base algorithm)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/shark.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key schedule", "Custom CFB-style key schedule with no published analysis; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Sharke — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0a4216774ecf4b21")
        },
        {
          text: "DarkCrypt Sharke — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("cc87f651b3b69721")
        },
        {
          text: "DarkCrypt Sharke — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("cd4bc46cab812950")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SharkEDarkCryptInstance(this, isInverse);
    }
  }

  class SharkEDarkCryptInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      this._encryptRK = null;
      this._decryptRK = null;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this.KeySize = 0;
        this._encryptRK = this._decryptRK = null;
        return;
      }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SHARK-E (DarkCrypt) requires exactly 16 bytes`);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._encryptRK = deriveEncryptRoundKeys(this._key);
      this._decryptRK = deriveDecryptRoundKeys(this._encryptRK);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    _encryptBlock(block) {
      const RK = this._encryptRK;
      let state = block.slice().reverse();
      state = xorBytes(state, RK[0]);
      for (let round = 1; round < 6; ++round) {
        const c = cboxRoundBytes(state, CBOX_ENC);
        state = xorBytes(c, RK[round]);
      }
      const sboxed = state.map(b => SBOX_ENC[b]);
      state = xorBytes(sboxed, RK[6]);
      return state.reverse();
    }

    _decryptBlock(block) {
      const dRK = this._decryptRK;
      let state = block.slice().reverse();
      state = xorBytes(state, dRK[0]);
      for (let round = 1; round < 6; ++round) {
        const c = cboxRoundBytes(state, CBOX_DEC);
        state = xorBytes(c, dRK[round]);
      }
      const sboxed = state.map(b => SBOX_DEC[b]);
      state = xorBytes(sboxed, dRK[6]);
      return state.reverse();
    }
  }

  const algorithmInstance = new SharkEDarkCryptAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SharkEDarkCryptAlgorithm, SharkEDarkCryptInstance };
}));
