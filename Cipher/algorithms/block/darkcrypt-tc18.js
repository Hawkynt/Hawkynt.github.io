/*
 * TC18 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * TC18 is an obscure, non-mainstream block cipher shipped with the DarkCrypt
 * Total Commander plugin (Alexander Myasnikov, "Zarya" project); no public
 * specification is known to exist.
 * The DarkCrypt readme lists "TC18 (64 bit, CBC)" — that figure is the KEY
 * size; the block size (confirmed against the reference implementation and
 * test vectors) is 128 bits.
 *
 * Structure: an unbalanced Feistel network over two 64-bit halves (16 rounds,
 * i.e. 8 alternating half-updates), operating in a custom GF(2^8) field with
 * reduction polynomial 0x169 (x^8+x^6+x^5+x^3+1) — not AES's field. The
 * 8-byte key seeds a 232-byte expansion buffer L: the first 32 bytes cycle
 * the key, the remaining 200 bytes follow the recurrence
 *   L[i] = ROL8( L[i-32] ^ L[i-7] ^ L[i-5] ^ L[i-3] ^ L[i-2] ^ L[i-1] ^ 0x1B, 1 )
 * after which L[32..231] (but not L[0..31]) are passed through a fixed
 * 256-byte S-box. From L, two 8x8 byte matrices A and B are built with a
 * shared cursor starting at L[32] using two different triangular fill rules
 * (row 0 and the diagonal always draw fresh cursor bytes with a 0->1
 * zero-avoidance substitution; A's strictly-lower triangle and B's strictly-
 * upper triangle draw further cursor bytes unmodified; the remaining entries
 * are zero). The round-mixing matrix M = A x B (GF(2^8) matrix product) and
 * the 16 round keys (8 bytes each) are the last 128 bytes of L. Each round's
 * F-function XORs the input half with the round key, substitutes through the
 * S-box, then applies M as a linear GF(2^8) transform.
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation.
 * 64-bit key, 128-bit block. Educational only.
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Fixed 256-byte substitution table.
  const SBOX = [
    0x17,0x63,0x50,0xC2,0xEB,0x3B,0xE7,0xDF,0xC6,0x6C,0x5B,0x86,
    0x64,0x56,0x6B,0x37,0xA1,0xD3,0xB7,0x1D,0x75,0x80,0xB9,0xE3,0x9D,0xEE,0xDB,0x71,
    0x77,0x34,0xBD,0x09,0x66,0x01,0x0B,0xED,0xD5,0xA8,0x00,0xA4,0x2E,0xC1,0xFE,0x30,
    0x3C,0x1A,0xB0,0x1B,0x0E,0xA3,0xC5,0x57,0xEC,0x83,0xDD,0x02,0x3D,0xB2,0x5D,0xCC,
    0xD1,0x7C,0x23,0xA0,0x33,0xF5,0x07,0x78,0xF4,0x84,0xB6,0xD9,0xAD,0x1C,0x5C,0x3A,
    0x90,0xDA,0x26,0x58,0x98,0x4E,0xF8,0x22,0x6E,0xF2,0xDC,0x4C,0xF6,0x55,0x89,0xBB,
    0x60,0x73,0xD2,0x1F,0x36,0x53,0x5E,0x46,0x43,0x47,0xC0,0x42,0x0C,0x6F,0x85,0x2B,
    0x7E,0x79,0xD0,0xC9,0xFF,0x16,0x88,0xA6,0x2F,0xB8,0x5A,0x67,0xB5,0x99,0xC7,0xAE,
    0x87,0xF3,0xA2,0x8C,0x97,0x6D,0x3F,0x41,0x06,0x49,0xAB,0x1E,0xB1,0x18,0x31,0xFC,
    0xD6,0x39,0x8D,0xE8,0x19,0x4D,0x70,0xE1,0xFA,0x32,0xF7,0x61,0x13,0x38,0x35,0x69,
    0xA7,0x14,0x8B,0x25,0x0D,0x28,0xCB,0xD4,0x0F,0x3E,0x8F,0xBE,0xBA,0x48,0x15,0x4A,
    0x20,0x04,0xCD,0xF9,0xC8,0x7F,0x2D,0x76,0x5F,0xE9,0xE5,0x11,0xC4,0x68,0x82,0xBC,
    0x95,0xC3,0x03,0xCF,0xEF,0x65,0x92,0x8E,0xAF,0x21,0x7B,0x45,0x0A,0xDE,0x9B,0x12,
    0x40,0xF0,0xE4,0x74,0x9E,0xEA,0x91,0xFD,0x51,0x05,0x81,0x96,0x62,0xBF,0xAC,0xCA,
    0xD8,0x93,0x08,0x10,0x52,0xE6,0x54,0xB3,0xD7,0xCE,0x29,0xB4,0x9C,0x44,0xF1,0x9A,
    0x59,0x72,0x2C,0x7D,0xE2,0x4F,0x94,0xE0,0x2A,0x4B,0x27,0xFB,0xAA,0x24,0x8A,0x7A,
    0x9F,0xA9,0xA5,0x6A
  ];

  const GF_POLY = 0x169; // custom GF(2^8) reduction polynomial (x^8+x^6+x^5+x^3+1)

  function rol8(x, n) {
    x = OpCodes.AndN(x, 0xff);
    return OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(x, n), OpCodes.Shr32(x, 8 - n)), 0xff);
  }

  // Peasant/Russian multiplication in the DLL's custom GF(2^8) field.
  function gfMul(a, b) {
    let A = OpCodes.AndN(a, 0xff);
    let B = OpCodes.AndN(b, 0xff);
    let acc = 0;
    while (B !== 0) {
      if (OpCodes.AndN(B, 1)) acc = OpCodes.XorN(acc, A);
      A = OpCodes.Shl32(A, 1);
      if (OpCodes.AndN(A, 0x100)) A = OpCodes.XorN(A, GF_POLY);
      B = OpCodes.Shr32(B, 1);
    }
    return OpCodes.AndN(acc, 0xff);
  }

  // Build the 232-byte key-expansion buffer L.
  function buildL(keyBytes) {
    const L = new Array(232);
    for (let i = 0; i < 32; i++) L[i] = keyBytes[i % 8];
    for (let i = 32; i < 232; i++) {
      const v = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(
                  OpCodes.XorN(L[i-32], L[i-7]), L[i-5]), L[i-3]), L[i-2]), L[i-1]), 0x1B);
      L[i] = rol8(v, 1);
    }
    for (let i = 32; i < 232; i++) L[i] = SBOX[L[i]];
    return L;
  }

  // 8x8 matrix A: row 0 always draws from the cursor; elsewhere the diagonal
  // and the strictly-lower triangle draw from the cursor (diagonal entries
  // get 0 replaced by 1); the strictly-upper triangle is zero.
  function buildMatrixA(L, cursorRef) {
    const m = new Array(64);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        let v;
        if (c === 0 || c === r) {
          v = L[cursorRef.pos++];
          if (v === 0) v = 1;
        } else if (c < r) {
          v = L[cursorRef.pos++];
        } else {
          v = 0;
        }
        m[r * 8 + c] = v;
      }
    }
    return m;
  }

  // 8x8 matrix B: row 0 and the diagonal draw from the cursor (0->1 on the
  // diagonal); the strictly-upper triangle draws further cursor bytes
  // unmodified; the strictly-lower triangle (excluding row 0) is zero.
  function buildMatrixB(L, cursorRef) {
    const m = new Array(64);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        let v;
        if (c === r || r === 0) {
          v = L[cursorRef.pos++];
          if (v === 0) v = 1;
        } else if (c < r) {
          v = 0;
        } else {
          v = L[cursorRef.pos++];
        }
        m[r * 8 + c] = v;
      }
    }
    return m;
  }

  // Standard GF(2^8) matrix product M = A x B.
  function matMul(A, B) {
    const M = new Array(64);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let acc = 0;
        for (let k = 0; k < 8; k++) acc = OpCodes.XorN(acc, gfMul(A[i*8+k], B[k*8+j]));
        M[i*8+j] = acc;
      }
    }
    return M;
  }

  function keySchedule(keyBytes) {
    const L = buildL(keyBytes);
    const cursor = { pos: 32 };
    const A = buildMatrixA(L, cursor);
    const B = buildMatrixB(L, cursor);
    const M = matMul(A, B);
    const RK = [];
    for (let r = 0; r < 16; r++) RK.push(L.slice(104 + r * 8, 104 + r * 8 + 8));
    return { M, RK };
  }

  // Round function: byte-wise key-XOR + S-box, then the GF(2^8) matrix M.
  function roundF(X, r, sched) {
    const t = new Array(8);
    for (let i = 0; i < 8; i++) t[i] = SBOX[OpCodes.And32(OpCodes.XorN(X[i], sched.RK[r][i]), 0xff)];
    const out = new Array(8);
    for (let i = 0; i < 8; i++) {
      let acc = 0;
      for (let j = 0; j < 8; j++) acc = OpCodes.XorN(acc, gfMul(t[j], sched.M[i*8+j]));
      out[i] = acc;
    }
    return out;
  }

  function xor8(a, b) {
    const o = new Array(8);
    for (let i = 0; i < 8; i++) o[i] = OpCodes.XorN(a[i], b[i]);
    return o;
  }

  class DarkCryptTC18Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "TC18 (DarkCrypt)";
      this.description = "Obscure block cipher from the DarkCrypt Total Commander plugin with no known public specification. An unbalanced 16-round Feistel network over two 64-bit halves in a custom GF(2^8) field, using a key-derived 8x8 linear mixing matrix and a fixed S-box.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / Zarya project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(8, 8, 0)];    // fixed 64-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented/unanalyzed design", "No public cryptanalysis exists for this cipher; it should not be relied upon for security.", "Use AES or another vetted, publicly analyzed cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Tc18 — incrementing key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("65829deea528d2376f6ef89d5d4f7135")
        },
        {
          text: "DarkCrypt Tc18 — incrementing key, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("479e3a9947168262855b5719a8dbc382")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptTC18Instance(this, isInverse);
    }
  }

  class DarkCryptTC18Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._sched = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._sched = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 8)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. TC18 (DarkCrypt) requires exactly 8 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._sched = keySchedule(keyBytes);
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

    _encryptBlock(block) {
      let P0 = block.slice(0, 8), P1 = block.slice(8, 16);
      for (let r = 0; r < 16; r += 2) {
        P1 = xor8(P1, roundF(P0, r, this._sched));
        P0 = xor8(P0, roundF(P1, r + 1, this._sched));
      }
      return P0.concat(P1);
    }

    _decryptBlock(block) {
      let P0 = block.slice(0, 8), P1 = block.slice(8, 16);
      for (let r = 15; r >= 1; r -= 2) {
        P0 = xor8(P0, roundF(P1, r, this._sched));
        P1 = xor8(P1, roundF(P0, r - 1, this._sched));
      }
      return P0.concat(P1);
    }
  }

  const algorithmInstance = new DarkCryptTC18Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptTC18Algorithm, DarkCryptTC18Instance };
}));
