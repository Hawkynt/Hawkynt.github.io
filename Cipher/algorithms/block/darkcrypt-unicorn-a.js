/*
 * CIPHERUNICORN-A (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CIPHERUNICORN-A as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). CIPHERUNICORN-A is a 128-bit block
 * cipher designed by NEC Corporation (2000), evaluated by CRYPTREC. It uses
 * a 16-round Feistel structure whose round function has a dual structure:
 *   - a "main stream" (function keys FKa/FKb, an A3 rotate/XOR mixer, and a
 *     chain of constant multiplications and byte-substitution expansions T0..T3)
 *   - a "temporary key generation mechanism" (seed keys SKa/SKb, a shorter
 *     chain of the same primitives using only T0/T1) that produces a dynamic
 *     S-box index and a final whitening word mixed into the main stream output.
 * The key scheduler repeatedly applies an "MT" function (32x32-bit modular
 * multiplication combined with a byte-substitution expansion) to a rotating
 * window of the secret key to derive 72 32-bit words, which are then mapped to
 * 8 initial/final whitening words (IK0..IK7) and 16 sets of per-round keys
 * (FKa,SKa,FKb,SKb). Implemented here for the 256-bit key variant only, as
 * used by the DarkCrypt plugin.
 *
 * Derived from the CRYPTREC "CIPHERUNICORN-A" specification (NEC Corporation),
 * cross-checked byte-for-byte against the DarkCrypt implementation. The four
 * substitution tables and the A3 rotate/XOR mixer were verified directly
 * against the DarkCrypt plugin's precomputed lookup tables (the published
 * specification's S0 table contains a transcription error at S0(15), and its
 * rotate/XOR description does not fully capture the exact combination formula
 * used by the reference implementation). Test vectors verified against the
 * DarkCrypt implementation (crypt/decrypt round-trip verified). 128-bit
 * blocks, 256-bit keys. Educational only.
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

  // ---- Substitution tables (verified against the DarkCrypt implementation's precomputed T0 table) ----
  const S0 = [
    149,111,237,155,21,85,108,76,236,75,193,84,22,138,89,55,
    51,145,13,153,148,163,86,59,204,175,91,117,126,70,144,10,
    248,146,201,0,97,208,23,214,147,234,66,65,226,57,210,224,
    172,40,154,87,178,235,135,220,110,121,96,8,9,53,241,105,
    143,169,182,139,112,16,183,67,233,39,197,74,166,218,231,242,
    161,159,192,37,177,228,47,119,14,18,244,56,3,195,239,219,
    33,167,26,180,54,61,58,222,4,30,191,34,107,249,142,150,
    95,42,124,25,232,181,120,93,5,68,6,48,129,41,104,73,
    188,165,212,160,250,141,123,216,94,238,81,202,7,122,196,17,
    207,102,184,189,243,72,206,12,200,225,164,176,247,1,2,254,
    71,185,229,187,251,137,69,168,50,24,171,173,158,221,127,27,
    252,114,152,82,209,38,203,128,215,213,36,174,134,179,90,118,
    80,246,253,125,29,44,15,227,98,205,255,77,198,194,133,130,
    79,103,78,49,19,140,109,211,223,63,64,151,62,217,170,83,
    136,45,115,199,20,46,190,240,132,28,162,230,131,106,32,88,
    157,31,43,156,113,186,35,101,52,60,11,100,116,245,99,92
  ];

  const S1 = [
    174,255,161,109,254,40,95,67,33,124,133,58,224,238,129,56,
    137,57,169,87,221,220,163,84,14,239,171,138,74,192,66,104,
    8,250,43,115,126,88,212,103,62,82,143,4,117,226,28,155,
    65,156,139,183,235,125,217,116,111,237,157,68,160,184,213,172,
    170,132,73,2,1,232,92,249,136,106,175,5,9,140,38,191,
    50,251,85,12,27,48,46,52,145,78,168,159,100,188,16,227,
    26,198,244,205,178,72,142,162,51,246,241,128,194,177,122,20,
    144,49,83,166,247,225,11,7,102,242,185,18,150,165,121,98,
    93,197,70,151,75,118,202,216,108,207,15,112,99,35,101,69,
    86,61,79,110,13,218,149,6,134,29,36,131,181,154,180,230,
    77,193,164,17,211,3,209,105,94,206,44,19,60,123,10,31,
    130,195,76,208,54,252,219,203,199,39,189,80,167,90,32,30,
    233,64,245,182,120,231,127,47,22,135,55,114,234,41,21,81,
    173,223,23,253,153,25,45,248,97,179,186,119,200,146,187,210,
    0,228,24,190,141,236,63,201,96,113,240,147,229,91,107,214,
    89,59,152,215,176,204,243,148,42,158,71,34,222,37,196,53
  ];

  const S2 = [
    37,34,162,132,134,220,91,143,41,45,229,247,98,178,68,56,
    212,97,70,15,58,72,216,208,14,96,214,217,133,179,28,154,
    120,123,83,100,235,3,230,160,193,245,164,155,255,175,79,148,
    227,219,23,95,111,11,87,104,163,203,189,29,156,173,211,64,
    157,53,196,89,81,4,84,16,192,74,13,181,20,184,57,183,
    90,119,93,207,38,131,94,60,116,1,213,122,5,101,144,117,
    75,46,8,172,170,152,231,210,66,54,10,187,128,204,12,102,
    243,115,137,147,159,233,59,221,253,112,165,198,105,222,234,153,
    43,201,121,180,86,205,225,242,182,55,63,232,254,44,9,21,
    136,65,114,31,40,49,0,36,169,22,249,35,62,17,174,248,
    158,151,24,50,176,108,67,127,150,18,2,168,194,171,195,145,
    99,25,80,224,33,200,197,118,161,61,142,77,190,209,48,139,
    238,206,42,125,239,237,52,223,88,167,26,130,76,191,7,71,
    215,27,126,6,251,51,241,129,135,246,244,146,32,177,73,82,
    226,110,78,186,240,141,166,69,107,85,103,149,250,109,202,19,
    113,140,138,39,185,228,106,47,252,199,188,92,218,30,236,124
  ];

  const S3 = [
    24,252,144,121,17,42,77,127,2,35,173,21,129,58,105,113,
    112,229,185,189,76,204,209,87,5,96,82,99,133,140,66,64,
    192,107,194,220,16,68,183,171,219,51,92,13,152,86,135,123,
    98,174,103,156,157,59,145,155,158,8,231,132,83,49,23,32,
    85,69,251,36,233,238,222,149,37,248,26,18,125,11,137,253,
    79,52,56,95,241,187,44,167,124,102,227,115,212,142,154,93,
    247,211,33,28,67,10,147,225,215,210,246,160,131,73,65,57,
    1,182,180,199,207,126,216,224,61,81,202,196,146,188,119,128,
    50,30,91,161,89,12,195,74,235,223,226,172,245,7,218,159,
    242,217,208,38,163,45,39,4,62,136,104,179,88,197,6,0,
    141,190,243,214,109,162,60,165,198,228,221,164,106,101,203,236,
    143,48,110,80,176,78,234,181,97,84,20,70,29,168,27,72,
    71,90,255,19,254,114,25,230,47,43,100,178,40,41,249,186,
    150,205,184,201,139,75,54,22,63,244,108,175,46,169,240,153,
    151,116,122,232,166,117,14,94,111,206,237,177,200,31,170,120,
    213,53,148,15,55,239,3,191,134,250,193,9,130,118,138,34
  ];

  const SBOXES = [S0, S1, S2, S3];

  const CONST0 = 0x7e167289;   // multiplication constant used by the main/temp-key chains
  const CONST1 = 0xfe21464b;   // multiplication constant used by the main/temp-key chains
  const MT_CONST = 0x01010101; // multiplication constant used by the MT key-schedule function

  function U32(x) { return OpCodes.ToUint32(x); }
  function ADD32(a, b) { return OpCodes.Add32(a, b); }
  function SUB32(a, b) { return OpCodes.Sub32(a, b); }
  function XOR32(a, b) { return OpCodes.Xor32(a, b); }
  function MUL32(a, b) { return OpCodes.Mul32(a, b); }

  // Tn function: treats X as four bytes X0..X3 (X0 = most significant byte),
  // selects byte Xn, and expands it via all four substitution tables:
  //   Y = S0(Xn) || S1(Xn) || S2(Xn) || S3(Xn)   (Y0 = most significant byte)
  function Tn(n, X) {
    const shift = 24 - n * 8;
    const b = OpCodes.And32(OpCodes.Shr32(X, shift), 0xFF);
    return U32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(SBOXES[0][b], 24), OpCodes.Shl32(SBOXES[1][b], 16)), OpCodes.Shl32(SBOXES[2][b], 8)), SBOXES[3][b]));
  }

  // A3 function: input/output are a 64-bit value split into (hi,lo) 32-bit words.
  // Specified as Y = (X<<<0) XOR (X<<<23) XOR (X<<<41); the exact bit-level
  // combination implemented by the DarkCrypt reference (and reproduced here)
  // differs from a literal 64-bit rotate-and-XOR by a one-bit correction term.
  function A3(hi, lo) {
    const cf1 = (OpCodes.ToUint32(lo) < 9) ? 1 : 0;
    const cf2 = (OpCodes.ToUint32(lo) < 23) ? 1 : 0;
    const outHi = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(hi, OpCodes.Shl32(hi, 23)), OpCodes.Shr32(hi, 23)), OpCodes.Shr32(lo, 9)), cf1);
    const outLo = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(lo, OpCodes.Shr32(hi, 9)), OpCodes.Shl32(hi, 9)), OpCodes.Shr32(lo, 23)), cf2);
    return [outHi, outLo];
  }

  // MT function: key-schedule mixing primitive.
  //   Y0 = X0 * Const (mod 2^32)
  //   Y1 = X1 XOR T0(Y0)
  function MT(X0, X1) {
    const Y0 = MUL32(X0, MT_CONST);
    const Y1 = XOR32(X1, Tn(0, Y0));
    return [Y0, Y1];
  }

  // F function (round function): combines a main stream chain (function keys
  // FKa/FKb) and a temporary key generation chain (seed keys SKa/SKb).
  function Ffunction(Xl, Xr, FKa, SKa, FKb, SKb) {
    // temporary key generation mechanism
    let WK00 = ADD32(SKa, Xr);
    let WK01 = ADD32(SKb, Xl);
    const WK10 = MUL32(WK00, CONST0);
    const WK11 = XOR32(WK01, Tn(0, WK10));
    const WK21 = MUL32(WK11, CONST1);
    const WK20 = XOR32(WK10, Tn(0, WK21));
    const WK30 = MUL32(WK20, CONST1);
    const WK31 = XOR32(WK21, Tn(0, WK30));
    const WK41 = MUL32(WK31, CONST0);
    const WK40 = XOR32(WK30, Tn(0, WK41));
    const WK51 = XOR32(WK41, Tn(1, WK40));
    const WK50 = XOR32(WK40, Tn(1, WK51));

    // main stream
    const WX00 = ADD32(FKa, Xl);
    const WX01 = ADD32(FKb, Xr);
    const a3 = A3(WX00, WX01);
    const WX10 = a3[0], WX11 = a3[1];
    const WX20 = MUL32(WX10, CONST0);
    const WX21 = XOR32(WX11, Tn(0, WX20));
    const WX31 = MUL32(WX21, CONST1);
    const WX30 = XOR32(WX20, Tn(0, WX31));
    const WX41 = XOR32(WX31, Tn(1, WX30));
    const WX40 = XOR32(WX30, Tn(1, WX41));
    const WX51 = XOR32(WX41, Tn(2, WX40));
    const WX50 = XOR32(WX40, Tn(2, WX51));
    const WX61 = XOR32(WX51, Tn(3, WX50));
    const WX60 = XOR32(WX50, Tn(3, WX61));
    const k1 = OpCodes.And32(OpCodes.Shr32(WK51, 2), 0x3);
    const WX71 = XOR32(WX61, Tn(k1, WX60));
    const k2 = OpCodes.And32(WK51, 0x3);
    const WX70 = XOR32(WX60, Tn(k2, WX71));

    const Yl = XOR32(WX70, WK50);
    const Yr = XOR32(WX71, WK50);
    return [Yl, Yr];
  }

  class DarkCryptUnicornAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "CIPHERUNICORN-A (DarkCrypt)";
      this.description = "CIPHERUNICORN-A block cipher (NEC Corporation, 2000, CRYPTREC-evaluated), 256-bit key variant, as implemented in the DarkCrypt Total Commander plugin. 16-round Feistel network with a dual main-stream/temporary-key-generation round function.";
      this.inventor = "NEC Corporation; DarkCrypt port by Alexander Myasnikov";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("CIPHERUNICORN-A specification (CRYPTREC / NEC Corporation)", "https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/07_02espec.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Known key-schedule weakness", "Published cryptanalysis identifies key-schedule-related key equivalences; not relevant to functional correctness here.", "Use AES or another vetted, actively maintained cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt/decrypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Unicorn-a — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("350518d17ee209c39280abd6da976069")
        },
        {
          text: "DarkCrypt Unicorn-a — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("c6b097ac88291b7d9e3a0b081cadb1f0")
        },
        {
          text: "DarkCrypt Unicorn-a — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("051bb0914cdcfd4b7c7cc5d9ba9c2330")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptUnicornAInstance(this, isInverse);
    }
  }

  class DarkCryptUnicornAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._schedule = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._schedule = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. CIPHERUNICORN-A (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._schedule = this._buildKeySchedule(this._key);
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

    // Key scheduler (256-bit secret key: LINE=8 32-bit words).
    // Derives 72 32-bit words (WK[0..71]) via a dummy loop (3 passes over the
    // 8-word key state) followed by 9 extraction passes of 16 MT calls each
    // (the first 8 calls per pass are non-extracting, the next 8 extract one
    // word each), then maps WK[] onto IK0..IK7 and FKa/SKa/FKb/SKb per round.
    _buildKeySchedule(keyBytes) {
      const LINE = 8;
      const n = 16 + 2; // 18

      const W = [];
      for (let i = 0; i < LINE; i++)
        W.push(OpCodes.Pack32BE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]));

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < LINE; j++) {
          const a = j, b = (j + 1) % LINE;
          const r = MT(W[a], W[b]);
          W[a] = r[0]; W[b] = r[1];
        }
      }

      const WK = new Array(9 * 8);
      let cnt = 0;
      for (let i = 0; i < 9; i++) {
        for (let j = i * 16; j <= i * 16 + 7; j++) {
          const a = j % LINE, b = (j + 1) % LINE;
          const r = MT(W[a], W[b]);
          W[a] = r[0]; W[b] = r[1];
        }
        for (let j = i * 16 + 8; j <= i * 16 + 15; j++) {
          const a = j % LINE, b = (j + 1) % LINE;
          const r = MT(W[a], W[b]);
          W[a] = r[0]; W[b] = r[1];
          WK[cnt++] = W[b];
        }
      }

      const IK = [WK[0], WK[n], WK[n * 2], WK[n * 3], WK[n - 1], WK[n * 2 - 1], WK[n * 3 - 1], WK[n * 4 - 1]];

      const FKa = new Array(16), SKa = new Array(16), FKb = new Array(16), SKb = new Array(16);
      for (let i = 0; i < 16; i++) {
        FKa[i] = WK[1 + i];
        SKa[i] = WK[n + 1 + i];
        FKb[i] = WK[n * 2 + 1 + i];
        SKb[i] = WK[n * 3 + 1 + i];
      }

      return { IK, FKa, SKa, FKb, SKb };
    }

    _encryptBlock(block) {
      const ks = this._schedule;
      const P0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      const P1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      const P2 = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      const P3 = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      let W0 = ADD32(P0, ks.IK[0]), W1 = ADD32(P1, ks.IK[1]), W2 = ADD32(P2, ks.IK[2]), W3 = ADD32(P3, ks.IK[3]);

      for (let i = 0; i < 15; i++) {
        const f = Ffunction(W2, W3, ks.FKa[i], ks.SKa[i], ks.FKb[i], ks.SKb[i]);
        const nR0 = XOR32(W0, f[0]), nR1 = XOR32(W1, f[1]);
        W0 = W2; W1 = W3; W2 = nR0; W3 = nR1;
      }
      const f = Ffunction(W2, W3, ks.FKa[15], ks.SKa[15], ks.FKb[15], ks.SKb[15]);
      const final0 = XOR32(W0, f[0]), final1 = XOR32(W1, f[1]);

      const C0 = SUB32(final0, ks.IK[4]);
      const C1 = SUB32(final1, ks.IK[5]);
      const C2 = SUB32(W2, ks.IK[6]);
      const C3 = SUB32(W3, ks.IK[7]);

      return [...OpCodes.Unpack32BE(C0), ...OpCodes.Unpack32BE(C1), ...OpCodes.Unpack32BE(C2), ...OpCodes.Unpack32BE(C3)];
    }

    _decryptBlock(block) {
      const ks = this._schedule;
      const C0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      const C1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      const C2 = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      const C3 = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      let W0 = ADD32(C0, ks.IK[4]), W1 = ADD32(C1, ks.IK[5]), W2 = ADD32(C2, ks.IK[6]), W3 = ADD32(C3, ks.IK[7]);

      for (let i = 0; i < 15; i++) {
        const r = 15 - i;
        const f = Ffunction(W2, W3, ks.FKa[r], ks.SKa[r], ks.FKb[r], ks.SKb[r]);
        const nR0 = XOR32(W0, f[0]), nR1 = XOR32(W1, f[1]);
        W0 = W2; W1 = W3; W2 = nR0; W3 = nR1;
      }
      const f = Ffunction(W2, W3, ks.FKa[0], ks.SKa[0], ks.FKb[0], ks.SKb[0]);
      const final0 = XOR32(W0, f[0]), final1 = XOR32(W1, f[1]);

      const P0 = SUB32(final0, ks.IK[0]);
      const P1 = SUB32(final1, ks.IK[1]);
      const P2 = SUB32(W2, ks.IK[2]);
      const P3 = SUB32(W3, ks.IK[3]);

      return [...OpCodes.Unpack32BE(P0), ...OpCodes.Unpack32BE(P1), ...OpCodes.Unpack32BE(P2), ...OpCodes.Unpack32BE(P3)];
    }
  }

  const algorithmInstance = new DarkCryptUnicornAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptUnicornAAlgorithm, DarkCryptUnicornAInstance };
}));
