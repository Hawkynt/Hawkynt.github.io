/*
 * Serpent (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Serpent block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). The round function (S-boxes cycling
 * S0..S7, standard linear transform) and 256-bit-only key size match textbook
 * Serpent, but the key schedule's prekey-word generation is NOT the overlapping
 * "circular buffer" recurrence used by common reference sources (e.g. libgcrypt):
 * it produces 33*4 = 132 non-overlapping prekey words w0..w131 from the 8 key
 * words via w[i] = ROTL(w[i-8] XOR w[i-5] XOR w[i-3] XOR w[i-1] XOR PHI XOR i, 11),
 * then groups them into consecutive non-overlapping quads (round i uses
 * w[4i..4i+3]) run through S-boxes in order S3,S2,S1,S0,S7,S6,S5,S4 (repeating).
 * This differs from this repository's textbook algorithms/block/serpent.js, whose
 * key schedule generates prekeys with an overlapping (i+k)%8 recurrence and does
 * not reproduce this variant's subkeys beyond the very first round key.
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation.
 * 128-bit blocks, 256-bit keys only (fixed). Educational only.
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

  const PHI = 0x9E3779B9;
  const ROUNDS = 32;

  // Forward S-boxes S0..S7 (standard Serpent boolean formulas).
  const SBOX = [
    (a, b, c, d) => { // S0
      const t1 = OpCodes.XorN(a, d), t3 = OpCodes.XorN(c, t1), t4 = OpCodes.XorN(b, t3);
      const X3 = OpCodes.XorN(OpCodes.AndN(a, d), t4);
      const t7 = OpCodes.XorN(a, OpCodes.AndN(b, t1));
      const X2 = OpCodes.XorN(t4, OpCodes.OrN(c, t7));
      const t12 = OpCodes.AndN(X3, OpCodes.XorN(t3, t7));
      const X1 = OpCodes.XorN(~t3, t12);
      const X0 = OpCodes.XorN(t12, ~t7);
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S1
      const t2 = OpCodes.XorN(b, ~a);
      const t5 = OpCodes.XorN(c, OpCodes.OrN(a, t2));
      const X2 = OpCodes.XorN(d, t5);
      const t7 = OpCodes.XorN(b, OpCodes.OrN(d, t2));
      const t8 = OpCodes.XorN(t2, X2);
      const X3 = OpCodes.XorN(t8, OpCodes.AndN(t5, t7));
      const t11 = OpCodes.XorN(t5, t7);
      const X1 = OpCodes.XorN(X3, t11);
      const X0 = OpCodes.XorN(t5, OpCodes.AndN(t8, t11));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S2
      const t1 = ~a;
      const t2 = OpCodes.XorN(b, d);
      const t3 = OpCodes.AndN(c, t1);
      const X0 = OpCodes.XorN(t2, t3);
      const t5 = OpCodes.XorN(c, t1);
      const t6 = OpCodes.XorN(c, X0);
      const t7 = OpCodes.AndN(b, t6);
      const X3 = OpCodes.XorN(t5, t7);
      const X2 = OpCodes.XorN(a, OpCodes.AndN(OpCodes.OrN(d, t7), OpCodes.OrN(X0, t5)));
      const X1 = OpCodes.XorN(OpCodes.XorN(t2, X3), OpCodes.XorN(X2, OpCodes.OrN(d, t1)));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S3
      const t1 = OpCodes.XorN(a, b);
      const t2 = OpCodes.AndN(a, c);
      const t3 = OpCodes.OrN(a, d);
      const t4 = OpCodes.XorN(c, d);
      const t5 = OpCodes.AndN(t1, t3);
      const t6 = OpCodes.OrN(t2, t5);
      const X2 = OpCodes.XorN(t4, t6);
      const t8 = OpCodes.XorN(b, t3);
      const t9 = OpCodes.XorN(t6, t8);
      const t10 = OpCodes.AndN(t4, t9);
      const X0 = OpCodes.XorN(t1, t10);
      const t12 = OpCodes.AndN(X2, X0);
      const X1 = OpCodes.XorN(t9, t12);
      const X3 = OpCodes.XorN(OpCodes.OrN(b, d), OpCodes.XorN(t4, t12));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S4
      const t1 = OpCodes.XorN(a, d);
      const t2 = OpCodes.AndN(d, t1);
      const t3 = OpCodes.XorN(c, t2);
      const t4 = OpCodes.OrN(b, t3);
      const X3 = OpCodes.XorN(t1, t4);
      const t6 = ~b;
      const t7 = OpCodes.OrN(t1, t6);
      const X0 = OpCodes.XorN(t3, t7);
      const t9 = OpCodes.AndN(a, X0);
      const t10 = OpCodes.XorN(t1, t6);
      const t11 = OpCodes.AndN(t4, t10);
      const X2 = OpCodes.XorN(t9, t11);
      const X1 = OpCodes.XorN(OpCodes.XorN(a, t3), OpCodes.AndN(t10, X2));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S5
      const t1 = ~a;
      const t2 = OpCodes.XorN(a, b);
      const t3 = OpCodes.XorN(a, d);
      const t4 = OpCodes.XorN(c, t1);
      const t5 = OpCodes.OrN(t2, t3);
      const X0 = OpCodes.XorN(t4, t5);
      const t7 = OpCodes.AndN(d, X0);
      const t8 = OpCodes.XorN(t2, X0);
      const X1 = OpCodes.XorN(t7, t8);
      const t10 = OpCodes.OrN(t1, X0);
      const t11 = OpCodes.OrN(t2, t7);
      const t12 = OpCodes.XorN(t3, t10);
      const X2 = OpCodes.XorN(t11, t12);
      const X3 = OpCodes.XorN(OpCodes.XorN(b, t7), OpCodes.AndN(X1, t12));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S6
      const t1 = ~a;
      const t2 = OpCodes.XorN(a, d);
      const t3 = OpCodes.XorN(b, t2);
      const t4 = OpCodes.OrN(t1, t2);
      const t5 = OpCodes.XorN(c, t4);
      const X1 = OpCodes.XorN(b, t5);
      const t7 = OpCodes.OrN(t2, X1);
      const t8 = OpCodes.XorN(d, t7);
      const t9 = OpCodes.AndN(t5, t8);
      const X2 = OpCodes.XorN(t3, t9);
      const t11 = OpCodes.XorN(t5, t8);
      const X0 = OpCodes.XorN(X2, t11);
      const X3 = OpCodes.XorN(~t5, OpCodes.AndN(t3, t11));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // S7
      const t1 = OpCodes.XorN(b, c);
      const t2 = OpCodes.AndN(c, t1);
      const t3 = OpCodes.XorN(d, t2);
      const t4 = OpCodes.XorN(a, t3);
      const t5 = OpCodes.OrN(d, t1);
      const t6 = OpCodes.AndN(t4, t5);
      const X1 = OpCodes.XorN(b, t6);
      const t8 = OpCodes.OrN(t3, X1);
      const t9 = OpCodes.AndN(a, t4);
      const X3 = OpCodes.XorN(t1, t9);
      const t11 = OpCodes.XorN(t4, t8);
      const t12 = OpCodes.AndN(X3, t11);
      const X2 = OpCodes.XorN(t3, t12);
      const X0 = OpCodes.XorN(~t11, OpCodes.AndN(X3, X2));
      return [X0, X1, X2, X3];
    }
  ];

  // Inverse S-boxes InvS0..InvS7.
  const INV_SBOX = [
    (a, b, c, d) => { // InvS0
      const t1 = ~a;
      const t2 = OpCodes.XorN(a, b);
      const t4 = OpCodes.XorN(d, OpCodes.OrN(t1, t2));
      const t5 = OpCodes.XorN(c, t4);
      const X2 = OpCodes.XorN(t2, t5);
      const t8 = OpCodes.XorN(t1, OpCodes.AndN(d, t2));
      const X1 = OpCodes.XorN(t4, OpCodes.AndN(X2, t8));
      const X3 = OpCodes.XorN(OpCodes.AndN(a, t4), OpCodes.OrN(t5, X1));
      const X0 = OpCodes.XorN(X3, OpCodes.XorN(t5, t8));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS1
      const t1 = OpCodes.XorN(b, d);
      const t3 = OpCodes.XorN(a, OpCodes.AndN(b, t1));
      const t4 = OpCodes.XorN(t1, t3);
      const X3 = OpCodes.XorN(c, t4);
      const t7 = OpCodes.XorN(b, OpCodes.AndN(t1, t3));
      const t8 = OpCodes.OrN(X3, t7);
      const X1 = OpCodes.XorN(t3, t8);
      const t10 = ~X1;
      const t11 = OpCodes.XorN(X3, t7);
      const X0 = OpCodes.XorN(t10, t11);
      const X2 = OpCodes.XorN(t4, OpCodes.OrN(t10, t11));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS2
      const t1 = OpCodes.XorN(b, d);
      const t2 = ~t1;
      const t3 = OpCodes.XorN(a, c);
      const t4 = OpCodes.XorN(c, t1);
      const t5 = OpCodes.AndN(b, t4);
      const X0 = OpCodes.XorN(t3, t5);
      const t7 = OpCodes.OrN(a, t2);
      const t8 = OpCodes.XorN(d, t7);
      const t9 = OpCodes.OrN(t3, t8);
      const X3 = OpCodes.XorN(t1, t9);
      const t11 = ~t4;
      const t12 = OpCodes.OrN(X0, X3);
      const X1 = OpCodes.XorN(t11, t12);
      const X2 = OpCodes.XorN(OpCodes.AndN(d, t11), OpCodes.XorN(t3, t12));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS3
      const t1 = OpCodes.OrN(a, b);
      const t2 = OpCodes.XorN(b, c);
      const t3 = OpCodes.AndN(b, t2);
      const t4 = OpCodes.XorN(a, t3);
      const t5 = OpCodes.XorN(c, t4);
      const t6 = OpCodes.OrN(d, t4);
      const X0 = OpCodes.XorN(t2, t6);
      const t8 = OpCodes.OrN(t2, t6);
      const t9 = OpCodes.XorN(d, t8);
      const X2 = OpCodes.XorN(t5, t9);
      const t11 = OpCodes.XorN(t1, t9);
      const t12 = OpCodes.AndN(X0, t11);
      const X3 = OpCodes.XorN(t4, t12);
      const X1 = OpCodes.XorN(X3, OpCodes.XorN(X0, t11));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS4
      const t1 = OpCodes.OrN(c, d);
      const t2 = OpCodes.AndN(a, t1);
      const t3 = OpCodes.XorN(b, t2);
      const t4 = OpCodes.AndN(a, t3);
      const t5 = OpCodes.XorN(c, t4);
      const X1 = OpCodes.XorN(d, t5);
      const t7 = ~a;
      const t8 = OpCodes.AndN(t5, X1);
      const X3 = OpCodes.XorN(t3, t8);
      const t10 = OpCodes.OrN(X1, t7);
      const t11 = OpCodes.XorN(d, t10);
      const X0 = OpCodes.XorN(X3, t11);
      const X2 = OpCodes.XorN(OpCodes.AndN(t3, t11), OpCodes.XorN(X1, t7));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS5
      const t1 = ~c;
      const t2 = OpCodes.AndN(b, t1);
      const t3 = OpCodes.XorN(d, t2);
      const t4 = OpCodes.AndN(a, t3);
      const t5 = OpCodes.XorN(b, t1);
      const X3 = OpCodes.XorN(t4, t5);
      const t7 = OpCodes.OrN(b, X3);
      const t8 = OpCodes.AndN(a, t7);
      const X1 = OpCodes.XorN(t3, t8);
      const t10 = OpCodes.OrN(a, d);
      const t11 = OpCodes.XorN(t1, t7);
      const X0 = OpCodes.XorN(t10, t11);
      const X2 = OpCodes.XorN(OpCodes.AndN(b, t10), OpCodes.OrN(t4, OpCodes.XorN(a, c)));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS6
      const t1 = ~a;
      const t2 = OpCodes.XorN(a, b);
      const t3 = OpCodes.XorN(c, t2);
      const t4 = OpCodes.OrN(c, t1);
      const t5 = OpCodes.XorN(d, t4);
      const X1 = OpCodes.XorN(t3, t5);
      const t7 = OpCodes.AndN(t3, t5);
      const t8 = OpCodes.XorN(t2, t7);
      const t9 = OpCodes.OrN(b, t8);
      const X3 = OpCodes.XorN(t5, t9);
      const t11 = OpCodes.OrN(b, X3);
      const X0 = OpCodes.XorN(t8, t11);
      const X2 = OpCodes.XorN(OpCodes.AndN(d, t1), OpCodes.XorN(t3, t11));
      return [X0, X1, X2, X3];
    },
    (a, b, c, d) => { // InvS7
      const t3 = OpCodes.OrN(c, OpCodes.AndN(a, b));
      const t4 = OpCodes.AndN(d, OpCodes.OrN(a, b));
      const X3 = OpCodes.XorN(t3, t4);
      const t6 = ~d;
      const t7 = OpCodes.XorN(b, t4);
      const t9 = OpCodes.OrN(t7, OpCodes.XorN(X3, t6));
      const X1 = OpCodes.XorN(a, t9);
      const X0 = OpCodes.XorN(OpCodes.XorN(c, t7), OpCodes.OrN(d, X1));
      const X2 = OpCodes.XorN(OpCodes.XorN(t3, X1), OpCodes.XorN(X0, OpCodes.AndN(a, X3)));
      return [X0, X1, X2, X3];
    }
  ];

  class DarkCryptSerpentAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Serpent (DarkCrypt)";
      this.description = "Serpent variant from the DarkCrypt Total Commander plugin: standard 32-round S-box/linear-transform structure, but a non-overlapping flat key-schedule recurrence (unlike the overlapping circular-buffer recurrence used by common reference sources). Fixed 256-bit key, 128-bit block.";
      this.inventor = "Ross Anderson, Eli Biham, Lars Knudsen (base Serpent); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Serpent (base algorithm)", "https://www.cl.cam.ac.uk/~rja14/serpent.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key schedule", "Uses a non-overlapping prekey generation scheme instead of the overlapping circular-buffer recurrence common in reference sources; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Serpent — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("49672ba898d98df95019180445491089")
        },
        {
          text: "DarkCrypt Serpent — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("de269ff833e432b85b2e88d2701ce75c")
        },
        {
          text: "DarkCrypt Serpent — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("b3691ac95c69060089c450f61fe384b7")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSerpentInstance(this, isInverse);
    }
  }

  class DarkCryptSerpentInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Serpent (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(this._key);
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
      this.inputBuffer = [];
      return output;
    }

    // Non-overlapping flat prekey-word generation: w[i] = ROTL(w[i-8]^w[i-5]^w[i-3]^w[i-1]^PHI^i, 11)
    // for i = 0..131, seeded with the 8 key words w[-8..-1]. Round key K_i is derived from the
    // non-overlapping quad w[4i..4i+3] via S-boxes cycling S3,S2,S1,S0,S7,S6,S5,S4.
    _generateRoundKeys(keyBytes) {
      const NUM_PREKEY_WORDS = 4 * (ROUNDS + 1); // 132
      const w = new Array(8 + NUM_PREKEY_WORDS).fill(0);

      for (let i = 0; i < 8; ++i) {
        w[i] = OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]);
      }

      for (let i = 8; i < w.length; ++i) {
        const gen = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(w[i - 8], w[i - 5]), w[i - 3]), w[i - 1]), PHI);
        w[i] = OpCodes.RotL32(OpCodes.XorN(gen, (i - 8)), 11);
      }

      const roundKeys = [];
      for (let i = 0; i <= ROUNDS; ++i) {
        const o = 8 + 4 * i;
        const sboxIndex = ((3 - (i % 4)) + (Math.floor(i / 4) % 2) * 4) % 8;
        roundKeys.push(SBOX[sboxIndex](w[o], w[o + 1], w[o + 2], w[o + 3]));
      }
      return roundKeys;
    }

    _linearTransform(X0, X1, X2, X3) {
      const x0 = OpCodes.RotL32(X0, 13);
      const x2 = OpCodes.RotL32(X2, 3);
      const x1 = OpCodes.XorN(OpCodes.XorN(X1, x0), x2);
      const x3 = OpCodes.XorN(OpCodes.XorN(X3, x2), OpCodes.Shl32(x0, 3));
      const nX1 = OpCodes.RotL32(x1, 1);
      const nX3 = OpCodes.RotL32(x3, 7);
      const nX0 = OpCodes.RotL32(OpCodes.XorN(OpCodes.XorN(x0, nX1), nX3), 5);
      const nX2 = OpCodes.RotL32(OpCodes.XorN(OpCodes.XorN(x2, nX3), OpCodes.Shl32(nX1, 7)), 22);
      return [nX0, nX1, nX2, nX3];
    }

    _inverseLinearTransform(X0, X1, X2, X3) {
      const x2 = OpCodes.XorN(OpCodes.XorN(OpCodes.RotR32(X2, 22), X3), OpCodes.Shl32(X1, 7));
      const x0 = OpCodes.XorN(OpCodes.XorN(OpCodes.RotR32(X0, 5), X1), X3);
      const x3 = OpCodes.RotR32(X3, 7);
      const x1 = OpCodes.RotR32(X1, 1);
      const nX3 = OpCodes.XorN(OpCodes.XorN(x3, x2), OpCodes.Shl32(x0, 3));
      const nX1 = OpCodes.XorN(OpCodes.XorN(x1, x0), x2);
      const nX2 = OpCodes.RotR32(x2, 3);
      const nX0 = OpCodes.RotR32(x0, 13);
      return [nX0, nX1, nX2, nX3];
    }

    _encryptBlock(block) {
      let X0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let X1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let X2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let X3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      for (let round = 0; round < ROUNDS; ++round) {
        X0 = OpCodes.XorN(X0, this.roundKeys[round][0]);
        X1 = OpCodes.XorN(X1, this.roundKeys[round][1]);
        X2 = OpCodes.XorN(X2, this.roundKeys[round][2]);
        X3 = OpCodes.XorN(X3, this.roundKeys[round][3]);

        [X0, X1, X2, X3] = SBOX[round % 8](X0, X1, X2, X3);

        if (round < ROUNDS - 1)
          [X0, X1, X2, X3] = this._linearTransform(X0, X1, X2, X3);
      }

      X0 = OpCodes.XorN(X0, this.roundKeys[ROUNDS][0]);
      X1 = OpCodes.XorN(X1, this.roundKeys[ROUNDS][1]);
      X2 = OpCodes.XorN(X2, this.roundKeys[ROUNDS][2]);
      X3 = OpCodes.XorN(X3, this.roundKeys[ROUNDS][3]);

      return [...OpCodes.Unpack32LE(X0), ...OpCodes.Unpack32LE(X1), ...OpCodes.Unpack32LE(X2), ...OpCodes.Unpack32LE(X3)];
    }

    _decryptBlock(block) {
      let X0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let X1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let X2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let X3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      X0 = OpCodes.XorN(X0, this.roundKeys[ROUNDS][0]);
      X1 = OpCodes.XorN(X1, this.roundKeys[ROUNDS][1]);
      X2 = OpCodes.XorN(X2, this.roundKeys[ROUNDS][2]);
      X3 = OpCodes.XorN(X3, this.roundKeys[ROUNDS][3]);

      for (let round = ROUNDS - 1; round >= 0; --round) {
        if (round < ROUNDS - 1)
          [X0, X1, X2, X3] = this._inverseLinearTransform(X0, X1, X2, X3);

        [X0, X1, X2, X3] = INV_SBOX[round % 8](X0, X1, X2, X3);

        X0 = OpCodes.XorN(X0, this.roundKeys[round][0]);
        X1 = OpCodes.XorN(X1, this.roundKeys[round][1]);
        X2 = OpCodes.XorN(X2, this.roundKeys[round][2]);
        X3 = OpCodes.XorN(X3, this.roundKeys[round][3]);
      }

      return [...OpCodes.Unpack32LE(X0), ...OpCodes.Unpack32LE(X1), ...OpCodes.Unpack32LE(X2), ...OpCodes.Unpack32LE(X3)];
    }
  }

  const algorithmInstance = new DarkCryptSerpentAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSerpentAlgorithm, DarkCryptSerpentInstance };
}));
