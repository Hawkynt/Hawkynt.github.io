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
  /** @type {uint8[]} */
  const SBOX = [
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
  ];
  Object.freeze(SBOX);

  /** @type {BigInt} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  /** @type {BigInt} */
  const V_INITIAL = 0x0123456789abcdefn; // v_{-1} constant from the key schedule (spec 1.5)
  /** @type {int32} */
  const ROUNDS = 12;

  // ---- 64-bit half-block helpers (H = B^8) ----

  /**
   * @param {uint8[]} bytes - Bytes
   * @param {int32} off - Offset of the 8 big-endian bytes
   * @returns {BigInt} 64-bit value
   */
  function bytesToU64(bytes, off) {
    /** @type {BigInt} */
    let v = 0n;
    for (let i = 0; i < 8; i++) {
      /** @type {BigInt} */
      const b = BigInt(bytes[off + i]);
      v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), b);
    }
    return v;
  }

  /**
   * @param {BigInt} v - 64-bit value
   * @param {uint8[]} out - Destination, written big-endian
   * @param {int32} off - Offset of the 8 bytes in out
   */
  function u64ToBytes(v, out, off) {
    for (let i = 7; i >= 0; i--) {
      /** @type {uint8} */
      const b = Number(OpCodes.AndN(v, 0xffn));
      out[off + i] = b;
      v = OpCodes.ShiftRn(v, 8);
    }
  }

  // S-Function (spec 2.5): apply the s-box to each of the 8 bytes independently.
  /**
   * @param {BigInt} x - 64-bit value
   * @returns {BigInt} S(x)
   */
  function S64(x) {
    /** @type {BigInt} */
    let res = 0n;
    for (let i = 0; i < 8; i++) {
      const shift = 8 * (7 - i);
      /** @type {uint8} */
      const b = Number(OpCodes.AndN(OpCodes.ShiftRn(x, shift), 0xffn));
      /** @type {BigInt} */
      const sb = BigInt(SBOX[b]);
      res = OpCodes.OrN(res, OpCodes.ShiftLn(sb, shift));
    }
    return res;
  }

  // P-Function (spec 2.7): linear diffusion defined by an 8x8 binary matrix over
  // the 8 bytes of a half-block. z' = P * z (GF(2) matrix-vector product, i.e. XOR
  // of selected input bytes per output byte).
  /**
   * @param {BigInt} x - 64-bit value
   * @returns {BigInt} P(x)
   */
  function P64(x) {
    /** @type {uint8[]} */
    const z = new Array(8);
    for (let i = 0; i < 8; i++) {
      /** @type {uint8} */
      const zi = Number(OpCodes.AndN(OpCodes.ShiftRn(x, 8 * (7 - i)), 0xffn));
      z[i] = zi;
    }
    /** @type {uint32[]} */
    const zp = [
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[1], z[2]), z[3]), z[4]), z[5]), z[6]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[0], z[2]), z[3]), z[5]), z[6]), z[7]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[0], z[1]), z[3]), z[4]), z[6]), z[7]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[0], z[1]), z[2]), z[4]), z[5]), z[7]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[0], z[1]), z[3]), z[4]), z[5]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[0], z[1]), z[2]), z[5]), z[6]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[1], z[2]), z[3]), z[6]), z[7]),
      OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(z[0], z[2]), z[3]), z[4]), z[7])
    ];
    /** @type {BigInt} */
    let res = 0n;
    for (let i = 0; i < 8; i++) {
      /** @type {BigInt} */
      const zb = BigInt(OpCodes.And32(zp[i], 0xff));
      res = OpCodes.OrN(OpCodes.ShiftLn(res, 8), zb);
    }
    return res;
  }

  // f-Function (spec 2.9): f(X) = P(S(X)), used by the key-schedule G-Function.
  /**
   * @param {BigInt} x - 64-bit value
   * @returns {BigInt} f(x)
   */
  function fFunc(x) { return P64(S64(x)); }

  // BRL-Function (spec 2.4): byte-rotate-left the half-block by one byte.
  /**
   * @param {BigInt} x - 64-bit value
   * @returns {BigInt} x rotated left by one byte
   */
  function BRL(x) { return OpCodes.RotL64n(x, 8); }

  // F-Function (spec 2.2): Y = BRL(S(P(S(X^K1))^K2))
  /**
   * @param {BigInt} x - Half block
   * @param {BigInt} k1 - First round-key half
   * @param {BigInt} k2 - Second round-key half
   * @returns {BigInt} F(x)
   */
  function FFunc(x, k1, k2) {
    return BRL(OpCodes.AndN(S64(OpCodes.XorN(P64(OpCodes.AndN(S64(OpCodes.XorN(x, k1)), MASK64)), k2)), MASK64));
  }

  // G-Function (spec 2.8): ((X1..X4), U0) -> ((U1..U4), ((Y1..Y4), V=U4))
  // Returned as one array: Y1..Y4 at [0..3], U1..U4 (= L) at [4..7]; V = U4 = [7].
  /**
   * @param {BigInt[]} X - Four half-blocks
   * @param {BigInt} U0 - Chaining value
   * @returns {BigInt[]} Y1..Y4 followed by U1..U4
   */
  function GFunc(X, U0) {
    /** @type {BigInt[]} */
    const out = new Array(8);
    for (let i = 0; i < 4; i++) out[i] = fFunc(X[i]);
    out[4] = OpCodes.XorN(fFunc(U0), out[0]);
    for (let i = 1; i < 4; i++) out[4 + i] = OpCodes.XorN(fFunc(out[3 + i]), out[i]);
    return out;
  }

  // ---- 32-bit word / whole-block helpers (W = B^4, block = W^4) ----

  /**
   * @param {uint8[]} block16 - 16 bytes
   * @returns {uint32[]} Four big-endian words
   */
  function wordsFromBlock(block16) {
    /** @type {uint32[]} */
    const w = new Array(4);
    for (let i = 0; i < 4; i++)
      w[i] = OpCodes.Pack32BE(block16[i*4], block16[i*4+1], block16[i*4+2], block16[i*4+3]);
    return w;
  }

  /**
   * @param {uint32[]} words - Four words
   * @returns {uint8[]} 16 big-endian bytes
   */
  function blockFromWords(words) {
    /** @type {uint8[]} */
    const out = new Array(16);
    for (let i = 0; i < 4; i++) {
      const b = OpCodes.Unpack32BE(words[i]);
      out[i*4] = b[0]; out[i*4+1] = b[1]; out[i*4+2] = b[2]; out[i*4+3] = b[3];
    }
    return out;
  }

  // BP-Function (spec 2.12): diagonal byte permutation across the 4 words of a block.
  // new_word[i][j] = old_word[(i+j) mod 4][j]  (0-indexed word i, byte position j)
  /**
   * @param {uint8[]} block16 - 16 bytes
   * @returns {uint8[]} Permuted bytes
   */
  function BP(block16) {
    /** @type {uint8[]} */
    const out = new Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        out[i*4+j] = block16[((i+j)%4)*4 + j];
    return out;
  }

  /**
   * @param {uint8[]} block16 - 16 bytes
   * @returns {uint8[]} Inverse-permuted bytes
   */
  function BPInverse(block16) {
    /** @type {uint8[]} */
    const out = new Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        out[i*4+j] = block16[((i-j+4)%4)*4 + j];
    return out;
  }

  // Binary operator (.) (spec 2.10): y = x * (b|1) mod 2^32, word-wise.
  /**
   * @param {uint32} x - Word
   * @param {uint32} b - Multiplier word (forced odd)
   * @returns {uint32} x * (b|1) mod 2^32
   */
  function odot(x, b) {
    return OpCodes.Mul32(x, OpCodes.Or32(b, 1));
  }

  // Inverse of an odd 32-bit value modulo 2^32 by Newton iteration: a * a = 1 mod 8
  // for odd a, and each step x = x * (2 - a * x) doubles the number of correct low
  // bits (3, 6, 12, 24, 48), so five steps give the unique inverse mod 2^32.
  /**
   * @param {uint32} a - Odd word
   * @returns {uint32} a^-1 mod 2^32
   */
  function modInverse32(a) {
    let x = a;
    for (let i = 0; i < 5; i++) x = OpCodes.Mul32(x, OpCodes.Sub32(2, OpCodes.Mul32(a, x)));
    return x;
  }

  // Binary operator (*) (spec 2.11): the inverse of operator (.): x = y * (b|1)^-1 mod 2^32.
  /**
   * @param {uint32} y - Word
   * @param {uint32} b - Multiplier word (forced odd)
   * @returns {uint32} y * (b|1)^-1 mod 2^32
   */
  function ostar(y, b) {
    return OpCodes.Mul32(y, modInverse32(OpCodes.Or32(b, 1)));
  }

  // IT-Function (spec 2.1): IT(X,A,B) = BP((X^A) . B)
  /**
   * @param {uint8[]} block16 - 16 bytes
   * @param {uint8[]} A16 - 16 key bytes (XOR)
   * @param {uint8[]} B16 - 16 key bytes (multiplier)
   * @returns {uint8[]} 16 bytes
   */
  function ITFunc(block16, A16, B16) {
    const xw = wordsFromBlock(block16), aw = wordsFromBlock(A16), bw = wordsFromBlock(B16);
    /** @type {uint32[]} */
    const tw = new Array(4);
    for (let i = 0; i < 4; i++) tw[i] = odot(OpCodes.Xor32(xw[i], aw[i]), bw[i]);
    return BP(blockFromWords(tw));
  }

  // FT-Function (spec 2.3): FT(X,A,B) = (BP^-1(X) * B) ^ A  (inverse of IT)
  /**
   * @param {uint8[]} block16 - 16 bytes
   * @param {uint8[]} A16 - 16 key bytes (XOR)
   * @param {uint8[]} B16 - 16 key bytes (multiplier)
   * @returns {uint8[]} 16 bytes
   */
  function FTFunc(block16, A16, B16) {
    const bpInv = BPInverse(block16);
    const xw = wordsFromBlock(bpInv), aw = wordsFromBlock(A16), bw = wordsFromBlock(B16);
    /** @type {uint32[]} */
    const ow = new Array(4);
    for (let i = 0; i < 4; i++) ow[i] = OpCodes.Xor32(ostar(xw[i], bw[i]), aw[i]);
    return blockFromWords(ow);
  }

  // ---- Key schedule (spec 1.5) ----
  // v_{-1} = 0123456789abcdef(hex)
  // (L0, (Y0,v0)) = G(K, v_{-1})
  // (L_{i+1}, (Y_{i+1}, v_{i+1})) = G(Y_i, v_i)   for i = 0..7
  // l_{4i..4i+3} = L_{i+1}                        for i = 0..7   (32 half-blocks l0..l31)
  // k_{i+1}[n] = byte p of l_{2n+m}, n = 0..15, where p = floor(i/2), m = i mod 2
  /**
   * @param {uint8[]} key32 - 32 key bytes
   * @returns {uint8[][]} Round keys k1..k16, 16 bytes each
   */
  function generateRoundKeys(key32) {
    /** @type {BigInt[]} */
    const K = [bytesToU64(key32, 0), bytesToU64(key32, 8), bytesToU64(key32, 16), bytesToU64(key32, 24)];

    const g0 = GFunc(K, V_INITIAL);
    let Y = g0.slice(0, 4);
    let U = g0[7];

    // l_{4i..4i+3} = L_{i+1} = U1..U4 of the i-th G call
    /** @type {BigInt[]} */
    let halves = g0.slice(0, 0);
    for (let i = 0; i < 8; i++) {
      const g = GFunc(Y, U);
      Y = g.slice(0, 4); U = g[7];
      halves = halves.concat(g.slice(4, 8));
    }

    /** @type {uint8[][]} */
    const rows = new Array(16);
    for (let i = 0; i < 16; i++) {
      const p = Math.floor(i / 2), m = i % 2;
      const row = new Uint8Array(16);
      for (let n = 0; n < 16; n++) {
        const lVal = halves[2*n + m];
        /** @type {uint8} */
        const rb = Number(OpCodes.AndN(OpCodes.ShiftRn(lVal, 8 * (7 - p)), 0xffn));
        row[n] = rb;
      }
      rows[i] = row;
    }
    return rows; // rows[0..15] == k1..k16
  }

  // ---- Data randomizing part (spec 1.3 / 1.4) ----
  // crypt() runs the shared IT -> 12-round Feistel -> FT pipeline. For decryption the
  // caller passes a reordered subkey array (see reverseRoundKeys) so that the same
  // pipeline undoes encryption exactly.
  /**
   * @param {uint8[]} block16 - 16 bytes
   * @param {uint8[][]} rk - Round keys in pipeline order
   * @returns {uint8[]} 16 bytes
   */
  function crypt(block16, rk) {
    const k13 = rk[12], k14 = rk[13], k15 = rk[14], k16 = rk[15];

    let cur = ITFunc(block16, k13, k14);
    let L = bytesToU64(cur, 0);
    let R = bytesToU64(cur, 8);

    for (let rnd = 0; rnd < ROUNDS; rnd++) {
      const kr1 = bytesToU64(rk[rnd], 0), kr2 = bytesToU64(rk[rnd], 8);
      const newR = OpCodes.AndN(OpCodes.XorN(L, FFunc(R, kr1, kr2)), MASK64);
      L = R; R = newR;
    }

    /** @type {uint8[]} */
    const combined = new Array(16);
    u64ToBytes(R, combined, 0); // C' = (R12, L12)
    u64ToBytes(L, combined, 8);
    return FTFunc(combined, k16, k15);
  }

  // Decryption reuses crypt() with subkeys reordered exactly as prescribed by the
  // spec's Figure 1 (Feistel rounds mirrored, IT/FT roles and keys swapped).
  /**
   * @param {uint8[][]} rk - Encryption round keys
   * @returns {uint8[][]} Decryption round keys
   */
  function reverseRoundKeys(rk) {
    /** @type {uint8[][]} */
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
          text: "NIST AES round-1 E2 KAT ecb_vk.txt, KEYSIZE=256, I=1",
          uri: "https://web.archive.org/web/20070109110059if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/e2-vals.zip",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("8000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("1afeb356ae10f7bb2c3221223fb6bd8a")
        },
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

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptE2Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptE2Instance(this, isInverse);
    }
  }

  class DarkCryptE2Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptE2Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[][]|null} */
      this._encRows = null;
      /** @type {uint8[][]|null} */
      this._decRows = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this._encRows = null; this._decRows = null; this.KeySize = 0;
        return;
      }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. E2-256 (DarkCrypt) requires exactly 32 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._encRows = generateRoundKeys(this._key);
      this._decRows = reverseRoundKeys(this._encRows);
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
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
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      const rk = this.isInverse ? this._decRows : this._encRows;
      /** @type {uint8[]} */
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
