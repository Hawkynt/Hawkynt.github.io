/*
 * E2-256 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * E2 is the 128-bit block cipher submitted by NTT (Nippon Telegraph and Telephone
 * Corporation) to the AES competition in 1998 ("Specification of E2 - a 128-bit Block
 * Cipher", NTT, June 1998). It is a 12-round Feistel cipher with an initial transform
 * (IT) and final transform (FT) built from modular multiplication and a byte
 * permutation (BP), and a round function F combining an 8x8 s-box (built from the
 * power function x^127 over GF(2^8) composed with an affine map), a linear P-function,
 * and a one-byte left rotation (BRL). E2 later inspired the design of Camellia.
 *
 * The DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project)
 * implements the 256-bit-key variant of E2 unmodified: its output on the
 * all-zero 256-bit key/plaintext pair matches NTT's own published test vector
 * (Case 3 in the official specification, Appendix A), confirming this is genuine,
 * standard E2 - not a DarkCrypt-specific variant.
 *
 * 128-bit blocks, 256-bit keys. Educational only.
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

  // s-box: Affine(Power(x,127), 97, 225) over GF(2^8) with reduction polynomial
  // x^8+x^4+x^3+x+1 (spec section 2.6). Precomputed/table-verified against the
  // official specification (byte-identical to the DarkCrypt implementation's table).
  const SBOX = Object.freeze([
    225,66,62,129,78,23,158,253,180,63,44,218,49,30,224,65,
    204,243,130,125,124,18,142,187,228,88,21,213,111,233,76,75,
    53,123,90,154,144,69,188,248,121,214,27,136,2,171,207,100,
    9,12,240,1,164,176,246,147,67,99,134,220,17,165,131,139,
    201,208,25,149,106,161,92,36,110,80,33,128,47,231,83,15,
    145,34,4,237,166,72,73,103,236,247,192,57,206,242,45,190,
    93,28,227,135,7,13,122,244,251,50,245,140,219,143,37,150,
    168,234,205,51,101,84,6,141,137,10,94,217,22,14,113,108,
    11,255,96,210,46,211,200,85,194,35,183,116,226,155,223,119,
    43,185,60,98,19,229,148,52,177,39,132,159,215,81,0,97,
    173,133,115,3,8,64,239,104,254,151,31,222,175,102,232,184,
    174,189,179,235,198,107,71,169,216,167,114,238,29,126,170,182,
    117,203,212,48,105,32,127,55,91,157,120,163,241,118,250,5,
    61,58,68,87,59,202,199,138,24,70,156,191,186,56,86,26,
    146,77,38,41,162,152,16,153,112,160,197,40,193,109,20,172,
    249,95,79,196,195,209,252,221,178,89,230,181,54,82,74,42
  ]);

  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  const MASK32 = 0xFFFFFFFFn;
  const V_INITIAL = 0x0123456789abcdefn; // v_{-1} constant from the key schedule (spec 1.5)
  const ROUNDS = 12;

  // ---- 64-bit half-block helpers (H = B^8) ----

  function bytesToU64(bytes, off) {
    let v = 0n;
    for (let i = 0; i < 8; i++) v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), BigInt(bytes[off + i]));
    return v;
  }

  function u64ToBytes(v, out, off) {
    for (let i = 7; i >= 0; i--) { out[off + i] = Number(OpCodes.AndN(v, 0xffn)); v = OpCodes.ShiftRn(v, 8); }
  }

  // S-Function (spec 2.5): apply the s-box to each of the 8 bytes independently.
  function S64(x) {
    let res = 0n;
    for (let i = 0; i < 8; i++) {
      const shift = BigInt(8 * (7 - i));
      const b = Number(OpCodes.AndN(OpCodes.ShiftRn(x, shift), 0xffn));
      res |= OpCodes.ShiftLn(BigInt(SBOX[b]), shift);
    }
    return res;
  }

  // P-Function (spec 2.7): linear diffusion defined by an 8x8 binary matrix over
  // the 8 bytes of a half-block. z' = P * z (GF(2) matrix-vector product, i.e. XOR
  // of selected input bytes per output byte).
  function P64(x) {
    const z = new Array(8);
    for (let i = 0; i < 8; i++) z[i] = Number(OpCodes.AndN(OpCodes.ShiftRn(x, BigInt(8 * (7 - i))), 0xffn));
    const zp = [
      z[1]^z[2]^z[3]^z[4]^z[5]^z[6],
      z[0]^z[2]^z[3]^z[5]^z[6]^z[7],
      z[0]^z[1]^z[3]^z[4]^z[6]^z[7],
      z[0]^z[1]^z[2]^z[4]^z[5]^z[7],
      z[0]^z[1]^z[3]^z[4]^z[5],
      z[0]^z[1]^z[2]^z[5]^z[6],
      z[1]^z[2]^z[3]^z[6]^z[7],
      z[0]^z[2]^z[3]^z[4]^z[7]
    ];
    let res = 0n;
    for (let i = 0; i < 8; i++) res = OpCodes.OrN(OpCodes.ShiftLn(res, 8), BigInt(OpCodes.And32(zp[i], 0xff)));
    return res;
  }

  // f-Function (spec 2.9): f(X) = P(S(X)), used by the key-schedule G-Function.
  function fFunc(x) { return P64(S64(x)); }

  // BRL-Function (spec 2.4): byte-rotate-left the half-block by one byte.
  function BRL(x) { return OpCodes.RotL64n(x, 8); }

  // F-Function (spec 2.2): Y = BRL(S(P(S(X^K1))^K2))
  function FFunc(x, k1, k2) {
    return BRL(OpCodes.AndN(S64(OpCodes.XorN(P64(OpCodes.AndN(S64(OpCodes.XorN(x, k1)), MASK64)), k2)), MASK64));
  }

  // G-Function (spec 2.8): ((X1..X4), U0) -> ((U1..U4), ((Y1..Y4), V=U4))
  function GFunc(X, U0) {
    const Y = X.map(fFunc);
    const U = new Array(4);
    U[0] = OpCodes.XorN(fFunc(U0), Y[0]);
    for (let i = 1; i < 4; i++) U[i] = OpCodes.XorN(fFunc(U[i - 1]), Y[i]);
    return { Y: Y, L: U, newU: U[3] };
  }

  // ---- 32-bit word / whole-block helpers (W = B^4, block = W^4) ----

  function wordsFromBlock(block16) {
    const w = new Array(4);
    for (let i = 0; i < 4; i++)
      w[i] = OpCodes.Pack32BE(block16[i*4], block16[i*4+1], block16[i*4+2], block16[i*4+3]);
    return w;
  }

  function blockFromWords(words) {
    const out = new Array(16);
    for (let i = 0; i < 4; i++) {
      const b = OpCodes.Unpack32BE(words[i]);
      out[i*4] = b[0]; out[i*4+1] = b[1]; out[i*4+2] = b[2]; out[i*4+3] = b[3];
    }
    return out;
  }

  // BP-Function (spec 2.12): diagonal byte permutation across the 4 words of a block.
  // new_word[i][j] = old_word[(i+j) mod 4][j]  (0-indexed word i, byte position j)
  function BP(block16) {
    const w = [block16.slice(0,4), block16.slice(4,8), block16.slice(8,12), block16.slice(12,16)];
    const out = new Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        out[i*4+j] = w[(i+j)%4][j];
    return out;
  }

  function BPInverse(block16) {
    const w = [block16.slice(0,4), block16.slice(4,8), block16.slice(8,12), block16.slice(12,16)];
    const out = new Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        out[i*4+j] = w[(i-j+4)%4][j];
    return out;
  }

  // Binary operator (.) (spec 2.10): y = x * (b|1) mod 2^32, word-wise.
  function odot(x, b) {
    const oddB = BigInt(OpCodes.ToUint32(b | 1));
    return OpCodes.ToUint32(Number(OpCodes.AndN(BigInt(OpCodes.ToUint32(x)) * oddB, MASK32)));
  }

  // Modular inverse of an odd 32-bit value modulo 2^32 (extended Euclidean algorithm).
  function modInverse32(aIn) {
    let a = BigInt(OpCodes.ToUint32(aIn));
    const m = OpCodes.ShiftLn(1n, 32);
    let oldR = a, r = m, oldS = 1n, s = 0n;
    while (r !== 0n) {
      const q = oldR / r;
      [oldR, r] = [r, oldR - q * r];
      [oldS, s] = [s, oldS - q * s];
    }
    return OpCodes.ToUint32(Number(((oldS % m) + m) % m));
  }

  // Binary operator (*) (spec 2.11): the inverse of operator (.): x = y * (b|1)^-1 mod 2^32.
  function ostar(y, b) {
    const invB = BigInt(modInverse32(OpCodes.ToUint32(b | 1)));
    return OpCodes.ToUint32(Number(OpCodes.AndN(BigInt(OpCodes.ToUint32(y)) * invB, MASK32)));
  }

  // IT-Function (spec 2.1): IT(X,A,B) = BP((X^A) . B)
  function ITFunc(block16, A16, B16) {
    const xw = wordsFromBlock(block16), aw = wordsFromBlock(A16), bw = wordsFromBlock(B16);
    const tw = new Array(4);
    for (let i = 0; i < 4; i++) tw[i] = odot(OpCodes.ToUint32(OpCodes.Xor32(xw[i], aw[i])), bw[i]);
    return BP(blockFromWords(tw));
  }

  // FT-Function (spec 2.3): FT(X,A,B) = (BP^-1(X) * B) ^ A  (inverse of IT)
  function FTFunc(block16, A16, B16) {
    const bpInv = BPInverse(block16);
    const xw = wordsFromBlock(bpInv), aw = wordsFromBlock(A16), bw = wordsFromBlock(B16);
    const ow = new Array(4);
    for (let i = 0; i < 4; i++) ow[i] = OpCodes.ToUint32(OpCodes.Xor32(ostar(xw[i], bw[i]), aw[i]));
    return blockFromWords(ow);
  }

  // ---- Key schedule (spec 1.5) ----
  // v_{-1} = 0123456789abcdef(hex)
  // (L0, (Y0,v0)) = G(K, v_{-1})
  // (L_{i+1}, (Y_{i+1}, v_{i+1})) = G(Y_i, v_i)   for i = 0..7
  // l_{4i..4i+3} = L_{i+1}                        for i = 0..7   (32 half-blocks l0..l31)
  // k_{i+1}[n] = byte p of l_{2n+m}, n = 0..15, where p = floor(i/2), m = i mod 2
  function generateRoundKeys(key32) {
    const K = [bytesToU64(key32, 0), bytesToU64(key32, 8), bytesToU64(key32, 16), bytesToU64(key32, 24)];

    let U = V_INITIAL;
    let Y = K;
    const g0 = GFunc(Y, U);
    Y = g0.Y; U = g0.newU;

    const l = new Array(32);
    for (let i = 0; i < 8; i++) {
      const g = GFunc(Y, U);
      Y = g.Y; U = g.newU;
      for (let r = 0; r < 4; r++) l[4*i + r] = g.L[r];
    }

    const roundKeys = new Array(16);
    for (let i = 0; i < 16; i++) {
      const p = OpCodes.Shr32(i, 1), m = OpCodes.And32(i, 1);
      const row = new Uint8Array(16);
      for (let n = 0; n < 16; n++) {
        const lVal = l[2*n + m];
        row[n] = Number(OpCodes.AndN(OpCodes.ShiftRn(lVal, 8 * (7 - p)), 0xffn));
      }
      roundKeys[i] = row;
    }
    return roundKeys; // roundKeys[0..15] == k1..k16
  }

  // ---- Data randomizing part (spec 1.3 / 1.4) ----
  // crypt() runs the shared IT -> 12-round Feistel -> FT pipeline. For decryption the
  // caller passes a reordered subkey array (see reverseRoundKeys) so that the same
  // pipeline undoes encryption exactly.
  function crypt(block16, rk) {
    const k13 = rk[12], k14 = rk[13], k15 = rk[14], k16 = rk[15];

    let cur = ITFunc(block16, k13, k14);
    let L = bytesToU64(cur, 0);
    let R = bytesToU64(cur, 8);

    for (let r = 0; r < ROUNDS; r++) {
      const kr1 = bytesToU64(rk[r], 0), kr2 = bytesToU64(rk[r], 8);
      const newR = OpCodes.AndN(OpCodes.XorN(L, FFunc(R, kr1, kr2)), MASK64);
      L = R; R = newR;
    }

    const combined = new Array(16);
    u64ToBytes(R, combined, 0); // C' = (R12, L12)
    u64ToBytes(L, combined, 8);
    return FTFunc(combined, k16, k15);
  }

  // Decryption reuses crypt() with subkeys reordered exactly as prescribed by the
  // spec's Figure 1 (Feistel rounds mirrored, IT/FT roles and keys swapped).
  function reverseRoundKeys(rk) {
    const out = new Array(16);
    for (let i = 0; i < ROUNDS; i++) out[i] = rk[ROUNDS - 1 - i];
    out[12] = rk[15]; out[13] = rk[14]; out[14] = rk[13]; out[15] = rk[12];
    return out;
  }

  class DarkCryptE2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "E2-256 (DarkCrypt)";
      this.description = "Standard NTT E2 block cipher (256-bit key variant), a 12-round Feistel cipher with initial/final modular-multiplication transforms and an s-box/P-function round structure, submitted to the AES competition in 1998. The DarkCrypt Total Commander plugin implements this unmodified (matches NTT's own published test vector).";
      this.inventor = "Masayuki Kanda, Shiho Moriai, Kazumaro Aoki, Hiroki Ueda, Youichi Takashima, Kazuo Ohta, Tsutomu Matsumoto (NTT)";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("Specification of E2 - a 128-bit Block Cipher (NTT, 1998)", "https://web.archive.org/web/20050131035056/http://info.isl.ntt.co.jp:80/e2/E2spec.pdf"),
        new LinkItem("E2 (cipher) - Wikipedia", "https://en.wikipedia.org/wiki/E2_(cipher)"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Not selected for AES", "E2 was a first-round AES candidate not advanced past round 1; while not broken, it received far less cryptanalytic scrutiny than AES/Rijndael.", "Use AES or another vetted, standardized cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      // The all-zero-key/plaintext vector matches NTT's own Case 3 (256-bit key) test vector
      // from the official specification's Appendix A, confirming a byte-exact, unmodified port.
      this.tests = [
        {
          text: "DarkCrypt E2 — zero key/plaintext (matches NTT spec Appendix A, Case 3)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("5002cb8cd878f26fbab9f52e6c96501e")
        },
        {
          text: "DarkCrypt E2 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("dff330c9ebbd520262ee310b1feed4dd")
        },
        {
          text: "DarkCrypt E2 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("8ac3a298e0dd7e5e4d5a858c0a213e10")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptE2Instance(this, isInverse);
    }
  }

  class DarkCryptE2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this._decryptRoundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this._roundKeys = null; this._decryptRoundKeys = null; this.KeySize = 0;
        return;
      }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. E2-256 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = generateRoundKeys(this._key);
      this._decryptRoundKeys = reverseRoundKeys(this._roundKeys);
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

      const rk = this.isInverse ? this._decryptRoundKeys : this._roundKeys;
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...crypt(block, rk));
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptE2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptE2Algorithm, DarkCryptE2Instance };
}));
