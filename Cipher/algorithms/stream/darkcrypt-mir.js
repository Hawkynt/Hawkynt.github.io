/*
 * Mir (DarkCrypt variant) Stream Cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Mir" stream cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 *
 * Internal design:
 *   - 128-bit key, 64-bit IV.
 *   - State: six 64-bit words (W0..W5) plus a 256-byte key-dependent substitution
 *     table built by iterating the AES S-box over the key bytes.
 *   - Round function mixes the words with 64x64->64 modular multiplications of
 *     (Wi<<1) against (Wj | odd-constant), a T-function term R = H ^ (H + K0) where
 *     H = W2 & W3 & W4 & W5, a byte substitution of W0 by the key-dependent table
 *     indexed with the bytes of W1, and a 29-bit rotation of W1. Odd constants
 *     0x1248842112488421, 0x1248124812481248 and 0x4812481248124812 are fixed
 *     round constants of the design.
 *   - Key setup: load W0=W3=key[0..7], W1=W5=key[8..15], W2/W4=constants, run 8 rounds.
 *   - IV setup: XOR IV-derived S-box values into the low bytes of the twelve state
 *     dwords, then run 2 rounds.
 *   - Keystream: each round emits the freshly computed 64-bit word W1 (little-endian);
 *     ciphertext = plaintext XOR keystream, processed in fixed 64-byte (512-bit) chunks.
 *
 * Test vectors verified against the DarkCrypt implementation.
 * Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const MASK64 = OpCodes.ShiftLn(1n, 64) - 1n;
  const K0 = 0x1248842112488421n;
  const K1 = 0x1248124812481248n;
  const K2 = 0x4812481248124812n;

  // Standard AES S-box, used to build Mir's key-dependent substitution table.
  const AES_SBOX = [
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
  ];

  const lo = (w) => OpCodes.AndN(w, 0xFFFFFFFFn);
  const hi = (w) => OpCodes.AndN(OpCodes.ShiftRn(w, 32), 0xFFFFFFFFn);

  class DarkCryptMirAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Mir (DarkCrypt)";
      this.description = "Mir stream cipher from the DarkCrypt Total Commander plugin. Six 64-bit state words mixed with 64-bit modular multiplications, a T-function term and a key-dependent AES-S-box substitution. 128-bit key, 64-bit IV. As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Alexander Myasnikov (DarkCrypt)";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit key
      this.SupportedNonceSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit IV

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary cipher", "Obscure design with no public cryptanalysis; not recommended for real use.", "Use a vetted stream cipher such as ChaCha20.")
      ];

      // Test vectors verified against the DarkCrypt implementation (key = 00..0F, IV = 8 zero bytes).
      this.tests = [
        {
          text: "DarkCrypt Mir — incrementing plaintext 00..3F",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("e830032e6a759bbb7483a4d2c105ba2ee96d42ccb708815fb8e52d97712b169029c0ac178aa654c83dba6651b09678597c9e5c51cb2ef0008b85365a8f051142")
        },
        {
          text: "DarkCrypt Mir — zero plaintext (raw keystream)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("e831012d6e709dbc7c8aaed9cd08b421f97c50dfa31d9748a0fc378c6d36088f09e18e34ae8372ef15934c7a9cbb56764caf6e62ff1bc637b3bc0c61b3382f7d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMirInstance(this, isInverse);
    }
  }

  class DarkCryptMirInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this.W = [0n, 0n, 0n, 0n, 0n, 0n];
      this.S = new Uint8Array(256);
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Mir (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._init();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length !== 8)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Mir (DarkCrypt) requires exactly 8 bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._init();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(n) { this.iv = n; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.initialized) throw new Error("Key/IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this.initialized) throw new Error("Key/IV not set");
      const out = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i += 8) {
        const w = this._round();
        for (let j = 0; j < 8 && i + j < this.inputBuffer.length; j++) {
          const ksByte = Number(OpCodes.AndN(OpCodes.ShiftRn(w, j * 8), 0xFFn));
          out[i + j] = OpCodes.Xor32(this.inputBuffer[i + j], ksByte);
        }
      }
      this.inputBuffer = [];
      return out;
    }

    _round() {
      const W = this.W, S = this.S;
      const W0 = W[0], W1 = W[1], W2 = W[2], W3 = W[3], W4 = W[4], W5 = W[5];
      const A = OpCodes.AndN(OpCodes.ShiftLn(W2, 1), MASK64);
      const B = OpCodes.AndN(OpCodes.ShiftLn(W4, 1), MASK64);
      const P = W5 | K2;
      const Q = W3 | K1;
      const M1 = OpCodes.AndN(P * A, MASK64);
      const M2 = OpCodes.AndN(Q * A, MASK64);
      const M3 = OpCodes.AndN(Q * B, MASK64);
      const M4 = OpCodes.AndN(P * B, MASK64);

      // W0.byte[i] ^= S[W1.byte[i]]
      let W0s = 0n;
      for (let i = 0n; i < 8n; i++) {
        const shift = i * 8n;
        const w0byte = Number(OpCodes.AndN(OpCodes.ShiftRn(W0, shift), 0xFFn));
        const w1byte = Number(OpCodes.AndN(OpCodes.ShiftRn(W1, shift), 0xFFn));
        W0s |= OpCodes.ShiftLn(BigInt(OpCodes.Xor32(w0byte, S[w1byte])), shift);
      }

      const D = OpCodes.AndN(W2, W3);
      const G = OpCodes.AndN(D, W4);
      const H = OpCodes.AndN(G, W5);
      const R = OpCodes.XorN(H, OpCodes.AndN(H + K0, MASK64));

      const nW5 = OpCodes.AndN(W5 + M2 + OpCodes.AndN(R, G), MASK64);
      const nW4 = OpCodes.AndN(W4 + M1 + OpCodes.AndN(D, R), MASK64);
      const nW3 = OpCodes.AndN(W3 + M4 + OpCodes.AndN(R, W2), MASK64);
      const nW2 = OpCodes.AndN(W2 + M3 + R, MASK64);

      const ROT = OpCodes.RotL64n(W1, 29);
      const E = OpCodes.AndN(ROT + hi(nW3), MASK64);
      const W1new = OpCodes.AndN(OpCodes.XorN(lo(W0s), hi(nW2)) | OpCodes.ShiftLn(OpCodes.XorN(hi(W0s), hi(nW4)), 32), MASK64);
      const W0new = OpCodes.AndN(E + OpCodes.ShiftLn(hi(nW5), 32) + W1new, MASK64);

      W[0] = W0new; W[1] = W1new; W[2] = nW2; W[3] = nW3; W[4] = nW4; W[5] = nW5;
      return W1new;
    }

    _init() {
      const key = this._key, iv = this._iv;

      // Key-dependent substitution table: iterate AES S-box over the 16 key bytes.
      for (let i = 0; i < 256; i++) {
        let v = i;
        for (let j = 0; j < 16; j++) v = AES_SBOX[OpCodes.And32(OpCodes.Xor32(v, key[j]), 0xFF)];
        this.S[i] = v;
      }

      const kd = [];
      for (let i = 0; i < 4; i++)
        kd.push(BigInt(OpCodes.ToUint32(OpCodes.Pack32LE(key[i*4], key[i*4+1], key[i*4+2], key[i*4+3]))));
      const keyLo = kd[0] | OpCodes.ShiftLn(kd[1], 32);
      const keyHi = kd[2] | OpCodes.ShiftLn(kd[3], 32);
      this.W[0] = keyLo;
      this.W[1] = keyHi;
      this.W[2] = K0;
      this.W[3] = keyLo;
      this.W[4] = K1;
      this.W[5] = keyHi;
      for (let r = 0; r < 8; r++) this._round();

      // IV mixing: XOR IV-derived S-box values into the low byte of each state dword.
      const s = (idx) => this.S[iv[idx]];
      const xb = (wi, half, val) => {
        this.W[wi] ^= OpCodes.ShiftLn(BigInt(OpCodes.And32(val, 0xFF)), half * 32);
      };
      xb(2, 1, OpCodes.Xor32(OpCodes.Xor32(s(0), s(1)), s(2)));
      xb(3, 1, OpCodes.Xor32(OpCodes.Xor32(s(0), s(3)), s(4)));
      xb(4, 1, OpCodes.Xor32(OpCodes.Xor32(s(2), s(5)), s(7)));
      xb(5, 1, OpCodes.Xor32(OpCodes.Xor32(s(3), s(6)), s(7)));
      xb(2, 0, OpCodes.Xor32(s(3), s(5)));
      xb(3, 0, OpCodes.Xor32(s(7), s(6)));
      xb(4, 0, OpCodes.Xor32(s(0), s(1)));
      xb(5, 0, OpCodes.Xor32(s(2), s(4)));
      xb(0, 0, OpCodes.Xor32(OpCodes.Xor32(s(0), s(5)), s(6)));
      xb(0, 1, OpCodes.Xor32(OpCodes.Xor32(s(1), s(3)), s(5)));
      xb(1, 0, OpCodes.Xor32(OpCodes.Xor32(s(1), s(4)), s(7)));
      xb(1, 1, OpCodes.Xor32(OpCodes.Xor32(s(2), s(4)), s(6)));
      this._round();
      this._round();

      this.inputBuffer = [];
      this.initialized = true;
    }
  }

  const algorithmInstance = new DarkCryptMirAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMirAlgorithm, DarkCryptMirInstance };
}));
