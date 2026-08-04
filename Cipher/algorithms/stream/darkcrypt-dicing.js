/*
 * DICING (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DICING is a synchronous stream cipher designed by Li An-Ping and
 * submitted to the eSTREAM project. Rather than a classic bit-level LFSR,
 * DICING is built from "projectors": state arrays that evolve by
 * multiplication in a GF(2^m) field, giving LFSR-like periods with a
 * byte-oriented, table-driven implementation. A pair of projectors
 * (held in the skey1/skey2 state arrays) forms a clock-control
 * mechanism ("dice"): each step both arrays are tapped and shifted, and
 * the two tap values jointly pick how far a second pair of projectors
 * (ckey1/ckey2) rotates. ckey1/ckey2 in turn feed a combiner that mixes
 * them through four interleaved 32x8 substitution tables -- an
 * AES-style table combination of a GF(2^8) S-box, S(x) = 5*(x^(x^127
 * xor 3)), together with a key-dependent affine transform -- and XORs
 * in a fixed per-word mask (ch) to produce each 128-bit output block.
 *
 * Key setup expands the key into a per-key-instance version of the four
 * substitution tables via a folded, key-derived seed. IV setup then
 * drives the IV through four rounds of that same table mixing (each
 * round combined with the key, a swapped/complemented half of the key,
 * or nothing, in turn) to derive the initial dice/projector state, the
 * combiner mask and the first rotation keys.
 *
 * This file implements the tweaked/optimized second revision of the
 * cipher (as opposed to the original eSTREAM submission's construction)
 * with a 256-bit key and a 256-bit IV, matching the "Dicing (256 bit)"
 * cipher shipped by the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). Test vectors were captured from the
 * plugin's own keystream output for a sequential key and an all-zero IV.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Byte substitution table S(x) used both directly (key/IV expansion) and,
  // combined with the key-dependent affine transform, to build the four
  // 32x8 combiner tables sbox0..sbox3.
  const SBOX = [
    0xd5,0xbd,0x05,0x00,0xf0,0x68,0x03,0xb3,0xe5,0x6b,
    0xa3,0xef,0x92,0x3b,0x36,0xdb,0xc7,0x98,0x01,0xe8,
    0xb9,0xf1,0x7a,0xb0,0x50,0x4f,0xbf,0x34,0x4e,0xf9,
    0xfd,0x78,0x2c,0xf8,0x59,0xc6,0x82,0x8c,0x2b,0xe0,
    0x55,0x3f,0xb7,0x84,0x85,0xf6,0x61,0xc3,0xaf,0x20,
    0x2f,0xdc,0x6f,0xc8,0xb5,0x1b,0x8b,0x0c,0x12,0xac,
    0xdd,0xe3,0x1f,0x49,0x26,0xba,0xf7,0x74,0x97,0x21,
    0x60,0xb1,0xb6,0x0f,0x4d,0x4c,0x5b,0x8e,0xd1,0xd2,
    0x69,0xaa,0x67,0x58,0xd9,0x75,0xde,0x3d,0x47,0xa9,
    0x83,0xc9,0x9c,0xa0,0x11,0xed,0x3a,0x4a,0x48,0x1a,
    0xca,0x57,0xfb,0xee,0x5d,0x39,0x8a,0x96,0x13,0xf5,
    0xf2,0x28,0xe9,0xe4,0x62,0x3c,0x30,0xfc,0x5f,0xcf,
    0xa1,0xd3,0x66,0xcd,0xfa,0xe2,0xb4,0x27,0xd7,0x15,
    0x6a,0x63,0x33,0x38,0x08,0x9d,0xd8,0x51,0xe7,0x7c,
    0xe1,0x44,0x6d,0x16,0xa2,0x88,0x2a,0x70,0x5a,0x52,
    0x73,0xa4,0x71,0x2d,0xfe,0x46,0x7d,0x29,0xec,0x41,
    0x1e,0x7f,0x17,0x42,0x31,0x23,0x37,0xea,0x72,0x89,
    0x94,0xae,0xc5,0xa7,0xab,0x9b,0xd6,0x76,0x19,0xd0,
    0x9e,0x91,0x53,0x81,0x7e,0x8f,0x93,0x7b,0x18,0xa5,
    0x40,0xf3,0x4b,0x35,0x2e,0x6e,0x45,0x80,0x32,0xa6,
    0xad,0xda,0xd4,0x10,0x9f,0xbb,0x54,0xe6,0x14,0x04,
    0x07,0xbc,0x79,0xff,0x43,0xeb,0xcb,0xa8,0x5c,0x64,
    0xb8,0x1c,0x0e,0x86,0x0d,0xc2,0xb2,0x56,0x24,0x3e,
    0x5e,0x09,0x25,0x6c,0x0a,0x06,0x1d,0x99,0x02,0xf4,
    0x77,0x87,0x90,0x95,0xcc,0x0b,0xc4,0xbe,0x9a,0xc1,
    0x8d,0xc0,0x65,0x22,0xce,0xdf
  ];

  // Fixed round constant used while folding the IV into the initial state.
  const CT = [
    0x9a,0x04,0x4d,0xcc,0x2c,0x81,0xf9,0x28,
    0x65,0x87,0xc0,0x50,0x28,0x25,0x41,0xe1,
    0x04,0x94,0x95,0xa3,0xc6,0x9e,0x39,0xa5,
    0xbf,0x93,0xb9,0x92,0xb5,0x61,0x8e,0xf3
  ];

  function readU32LE(bytes, off) {
    return OpCodes.Pack32LE(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
  }

  function writeU32LE(bytes, off, value) {
    const b = OpCodes.Unpack32LE(value);
    bytes[off] = b[0]; bytes[off + 1] = b[1]; bytes[off + 2] = b[2]; bytes[off + 3] = b[3];
  }

  function wordsToBytes(words) {
    const out = [];
    for (let i = 0; i < words.length; i++) out.push(...OpCodes.Unpack32LE(words[i]));
    return out;
  }

  function bytesToWords(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i += 4) out.push(readU32LE(bytes, i));
    return out;
  }

  class DarkCryptDicingAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "DICING (DarkCrypt)";
      this.description = "DICING synchronous stream cipher, 256-bit key / 256-bit IV variant matching DarkCrypt's \"Dicing (256 bit)\". Two GF(2^m)-based projector pairs form a clock-controlled dice mechanism and a table-driven combiner (four 32x8 S-box tables plus a key-derived mask) that emits 128-bit output blocks. Ported from the tweaked eSTREAM DICING-v2 reference construction.";
      this.inventor = "Li An-Ping; DarkCrypt build by Alexander Myasnikov";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedNonceSizes = [new KeySize(32, 32, 0)]; // fixed 256-bit

      this.documentation = [
        new LinkItem("A New Stream Cipher: DICING (Li An-Ping)", "https://cr.yp.to/streamciphers/dicing/desc2.pdf"),
        new LinkItem("eSTREAM DICING Page", "https://www.ecrypt.eu.org/stream/dicingp3.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt / Zarya Total Commander plugin", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [];

      // Test vectors generated from the DarkCrypt plugin's own Dicing keystream output.
      this.tests = [
        {
          text: "DarkCrypt Dicing - 256-bit key, zero IV keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("93fc3b3d41dbbf5ac6f39b58e5cd45febe7487679dc56971147ddd4a7d9945ed1a79d36d84a5854b2b5a4149bb18ad3160656058e648cad582d9122c145ce3f8a73abff437ac0e8c466561c11bb55dfc1337bc358a4fa22054a0363ab1f13ab7df4e599232df73d02ba40d6b5c91dd2adfdfe562e956b891d39eddaa873b19f6")
        },
        {
          text: "DarkCrypt Dicing - 256-bit key, zero IV, incrementing 64-byte input (fresh setup)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("93fd393e45deb95dcefa9153e9c04bf1ae65957489d07f660c64c75161845bf23a58f14ea080a36c03736b629735831e5054526bd27dfce2bae028172861ddc7")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDicingInstance(this, isInverse);
    }
  }

  class DarkCryptDicingInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. DICING (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length !== 32)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. DICING (DarkCrypt) requires exactly 32 bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data to process");
      if (!this.initialized) throw new Error("DICING (DarkCrypt) not properly initialized");

      const output = [];
      let idx = 0;
      const len = this.inputBuffer.length;
      while (idx < len) {
        const block = this._produceBlock();
        const chunk = Math.min(16, len - idx);
        for (let i = 0; i < chunk; i++) output.push(OpCodes.XorN(this.inputBuffer[idx + i], block[i]));
        idx += chunk;
      }
      this.inputBuffer = [];
      return output;
    }

    // ===== DICING (256-bit / v2 construction) core =====

    _initialize() {
      if (!this._key || !this._iv) return;

      this.keyWords = new Array(8).fill(0);
      for (let i = 0; i < 8; i++) this.keyWords[i] = readU32LE(this._key, i * 4);

      this.ckey1 = new Array(4).fill(0);
      this.ckey2 = new Array(4).fill(0);
      this.ch = new Array(4).fill(0);
      this.var1 = new Array(4).fill(0);
      this.var2 = new Array(4).fill(0);
      this.skey1 = new Array(80).fill(0);
      this.skey2 = new Array(80).fill(0);
      this.sbox0 = new Array(256).fill(0);
      this.sbox1 = new Array(256).fill(0);
      this.sbox2 = new Array(256).fill(0);
      this.sbox3 = new Array(256).fill(0);
      this.cyl = 0;

      this._keysetup();
      this._ivsetup();

      this.initialized = true;
    }

    // Fold the 256-bit key into a 128-bit seed (mkey) and expand it into the
    // four 32x8 combiner tables sbox0..sbox3.
    _keysetup() {
      const mkey = new Array(4).fill(0);
      for (let j = 0; j < 4; j++) mkey[j] = OpCodes.Xor32(this.keyWords[j], this.keyWords[4 + j]);
      this._extendsbox(mkey);
    }

    _extendsbox(mkeyWords) {
      const mkey = new Array(16).fill(0);
      for (let i = 0; i < 4; i++) {
        const b = OpCodes.Unpack32LE(mkeyWords[i]);
        mkey[i * 4] = b[0]; mkey[i * 4 + 1] = b[1]; mkey[i * 4 + 2] = b[2]; mkey[i * 4 + 3] = b[3];
      }

      const w = new Array(16).fill(0);
      const y = new Array(16).fill(0);

      let x = 1, z = 254;
      for (let i = 0; i < 8; i++) {
        w[i] = OpCodes.And32(OpCodes.Xor32(x, OpCodes.And32(mkey[i], z)), 0xFF);
        y[i] = OpCodes.And32(OpCodes.Xor32(x, OpCodes.And32(mkey[8 + i], z)), 0xFF);
        x = OpCodes.And32(OpCodes.Shl32(x, 1), 0xFF);
        z = OpCodes.And32(OpCodes.Xor32(z, x), 0xFF);
      }

      for (let k = 7; k >= 0; k--) {
        let xk = OpCodes.And32(~mkey[k], 0xFF);
        let zk = OpCodes.And32(~mkey[8 + k], 0xFF);
        for (let i = 0; i < k; i++) {
          w[k] = OpCodes.And32(OpCodes.Xor32(w[k], w[i + OpCodes.Shl32(OpCodes.And32(xk, 1), 3)]), 0xFF);
          y[k] = OpCodes.And32(OpCodes.Xor32(y[k], y[i + OpCodes.Shl32(OpCodes.And32(zk, 1), 3)]), 0xFF);
          xk = OpCodes.Shr32(xk, 1); zk = OpCodes.Shr32(zk, 1);
        }
      }

      let c1 = 0, c2 = 0;
      x = 1;
      for (let i = 0; i < 8; i++) {
        c1 = OpCodes.And32(OpCodes.Xor32(c1, OpCodes.And32(mkey[i], x)), 0xFF);
        c2 = OpCodes.And32(OpCodes.Xor32(c2, OpCodes.And32(mkey[8 + i], x)), 0xFF);
        x = OpCodes.And32(OpCodes.Shl32(x, 1), 0xFF);
      }

      x = OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(c2, 1), OpCodes.Shr32(c2, 7)), 0xFF);
      c2 = OpCodes.And32(OpCodes.Xor32(c2, c1), 0xFF);
      c1 = OpCodes.And32(OpCodes.Xor32(c1, x), 0xFF);

      const tabl = new Array(256).fill(0);
      tabl[0] = OpCodes.Or32(OpCodes.Or32(c2, OpCodes.Shl32(c2, 16)), OpCodes.Shl32(c2, 24));

      let n = 1;
      for (let k = 0; k < 8; k++) {
        const xx = w[k], zz = y[k];
        const temp = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(xx, OpCodes.Shl32(zz, 8)), OpCodes.Shl32(xx, 16)), OpCodes.Shl32(OpCodes.Xor32(xx, zz), 24));
        for (let i = 0; i < n; i++) tabl[i + n] = OpCodes.Xor32(tabl[i], temp);
        n = OpCodes.Shl32(n, 1);
      }

      const c2f = OpCodes.And32(~c1, 0xFF);
      for (let k = 0; k < 256; k++) {
        const m = OpCodes.Xor32(k, c1);
        const v = tabl[OpCodes.Xor32(SBOX[k], c2f)];
        this.sbox0[m] = OpCodes.ToUint32(v);
        this.sbox1[m] = OpCodes.RotR32(v, 8);
        this.sbox2[m] = OpCodes.RotR32(v, 16);
        this.sbox3[m] = OpCodes.RotR32(v, 24);
      }
    }

    // AES-style T-table byte mix: combines 4 bytes at [base, base+4, base+8, base+12]
    // of a 32-byte buffer through the four combiner tables.
    _mix4(bytes, base) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.sbox0[OpCodes.And32(bytes[base], 0xFF)], this.sbox1[OpCodes.And32(bytes[base + 4], 0xFF)]), this.sbox2[OpCodes.And32(bytes[base + 8], 0xFF)]), this.sbox3[OpCodes.And32(bytes[base + 12], 0xFF)]);
    }

    // One mixing round over a 32-byte buffer (two independent 16-byte halves,
    // 4 output words each), optionally XORed against 8 further words.
    _roundMix(srcBytes, xorWords) {
      const outWords = new Array(8);
      for (let col = 0; col < 4; col++) {
        let w0 = this._mix4(srcBytes, col);
        let w1 = this._mix4(srcBytes, col + 16);
        if (xorWords) {
          w0 = OpCodes.Xor32(w0, xorWords[2 * col]);
          w1 = OpCodes.Xor32(w1, xorWords[2 * col + 1]);
        }
        outWords[2 * col] = w0;
        outWords[2 * col + 1] = w1;
      }
      return outWords;
    }

    // Derive the initial dice/projector state (skey1/skey2), the combiner mask
    // (ch), the initial rotation keys (ckey1/ckey2) and memory words (var1/var2)
    // from the IV, running it through four rounds of table mixing.
    _ivsetup() {
      this.cyl = 64;
      for (let i = 0; i < 64; i++) { this.skey1[i] = 0; this.skey2[i] = 0; }

      const x = new Array(8).fill(0);
      for (let i = 0; i < 4; i++) {
        x[i] = OpCodes.ToUint32(~this.keyWords[4 + i]);
        x[4 + i] = OpCodes.ToUint32(~this.keyWords[i]);
      }

      let uWords = bytesToWords(this._iv);

      for (let k = 0; k < 4; k++) {
        const vWords = new Array(8);
        for (let i = 0; i < 8; i++) vWords[i] = OpCodes.Xor32(uWords[i], readU32LE(CT, i * 4));
        const vBytes = wordsToBytes(vWords);

        const r1Bytes = wordsToBytes(this._roundMix(vBytes, this.keyWords));
        const r2Bytes = wordsToBytes(this._roundMix(r1Bytes, x));
        uWords = this._roundMix(r2Bytes, null);

        if (k === 0) {
          for (let i = 0; i < 4; i++) this.ch[i] = OpCodes.Xor32(uWords[i], uWords[4 + i]);
        } else if (k === 1) {
          for (let i = 0; i < 4; i++) { this.var1[i] = uWords[i]; this.var2[i] = uWords[4 + i]; }
        } else if (k === 2) {
          const b1 = wordsToBytes(uWords.slice(0, 4));
          const b2 = wordsToBytes(uWords.slice(4, 8));
          for (let i = 0; i < 16; i++) { this.skey1[64 + i] = b1[i]; this.skey2[64 + i] = b2[i]; }
        } else {
          for (let i = 0; i < 4; i++) { this.ckey1[i] = uWords[i]; this.ckey2[i] = uWords[4 + i]; }
        }
      }

      this.skey1[79] &= 0x7F;
      this.skey2[79] &= 0x3F;

      let allZero = true;
      for (let i = 0; i < 4; i++) {
        if (this.ckey1[i] > 0 || this.ckey2[i] > 0) { allZero = false; break; }
      }
      if (allZero) {
        for (let i = 0; i < 4; i++) { this.ckey1[i] = this.keyWords[i]; this.ckey2[i] = this.keyWords[4 + i]; }
      }
    }

    // One controller step: taps and shifts skey1/skey2 at the given cyclic
    // offset, uses the combined tap value to pick rotation counts for
    // ckey1/ckey2, rotates them, and folds the result into var1/var2.
    _tick(cyl) {
      const s1 = this.skey1, s2 = this.skey2;

      let tmp = OpCodes.Or32(OpCodes.Shr32(s1[cyl + 15], 7), OpCodes.Shl32(s1[cyl + 16], 1));
      let d = tmp;
      tmp ^= OpCodes.Shl32(tmp, 3);
      s1[cyl + 0]  = OpCodes.And32(OpCodes.Xor32(s1[cyl + 0], OpCodes.And32(tmp, 0xFF)), 0xFF);
      s1[cyl + 1]  = OpCodes.And32(OpCodes.Xor32(s1[cyl + 1], OpCodes.And32(OpCodes.Shr32(tmp, 8), 0xFF)), 0xFF);
      tmp = OpCodes.Shl32(tmp, 1);
      s1[cyl + 5]  = OpCodes.And32(OpCodes.Xor32(s1[cyl + 5], OpCodes.And32(tmp, 0xFF)), 0xFF);
      s1[cyl + 11] = OpCodes.And32(OpCodes.Xor32(s1[cyl + 11], OpCodes.And32(tmp, 0xFF)), 0xFF);
      tmp = OpCodes.Shr32(tmp, 8);
      s1[cyl + 6]  = OpCodes.And32(OpCodes.Xor32(s1[cyl + 6], OpCodes.And32(tmp, 0xFF)), 0xFF);
      s1[cyl + 12] = OpCodes.And32(OpCodes.Xor32(s1[cyl + 12], OpCodes.And32(tmp, 0xFF)), 0xFF);
      s1[cyl + 15] &= 0x7F;
      s1[cyl + 16] = 0;

      let tmp2 = OpCodes.Or32(OpCodes.Shr32(s2[cyl + 15], 6), OpCodes.Shl32(s2[cyl + 16], 2));
      d ^= tmp2;
      tmp2 ^= OpCodes.Shl32(tmp2, 7);
      s2[cyl + 0]  = OpCodes.And32(OpCodes.Xor32(s2[cyl + 0], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      s2[cyl + 1]  = OpCodes.And32(OpCodes.Xor32(s2[cyl + 1], OpCodes.And32(OpCodes.Shr32(tmp2, 8), 0xFF)), 0xFF);
      tmp2 = OpCodes.Shl32(tmp2, 3);
      s2[cyl + 4]  = OpCodes.And32(OpCodes.Xor32(s2[cyl + 4], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      s2[cyl + 10] = OpCodes.And32(OpCodes.Xor32(s2[cyl + 10], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      tmp2 = OpCodes.Shr32(tmp2, 8);
      s2[cyl + 5]  = OpCodes.And32(OpCodes.Xor32(s2[cyl + 5], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      s2[cyl + 11] = OpCodes.And32(OpCodes.Xor32(s2[cyl + 11], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      tmp2 = OpCodes.Shr32(tmp2, 8);
      s2[cyl + 6]  = OpCodes.And32(OpCodes.Xor32(s2[cyl + 6], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      s2[cyl + 12] = OpCodes.And32(OpCodes.Xor32(s2[cyl + 12], OpCodes.And32(tmp2, 0xFF)), 0xFF);
      s2[cyl + 15] &= 0x3F;
      s2[cyl + 16] = 0;

      const n1 = 1 + OpCodes.And32(d, 15);
      {
        const c1 = this.ckey1;
        let temp = OpCodes.Shr32(c1[3], 32 - n1);
        temp = OpCodes.Xor32(temp, OpCodes.Shl32(temp, 3));
        const nc3 = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(c1[3], n1), OpCodes.Shr32(c1[2], (32 - n1))), temp);
        const nc2 = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(c1[2], n1), OpCodes.Shr32(c1[1], (32 - n1))), OpCodes.Shl32(temp, 3));
        const nc1 = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(c1[1], n1), OpCodes.Shr32(c1[0], (32 - n1))), temp);
        const nc0 = OpCodes.Xor32(OpCodes.Shl32(c1[0], n1), temp);
        c1[3] = nc3; c1[2] = nc2; c1[1] = nc1; c1[0] = nc0;
      }

      const n2 = 1 + OpCodes.Shr32(d, 4);
      {
        const c2 = this.ckey2;
        let temp = OpCodes.Shr32(c2[3], 32 - n2);
        temp = OpCodes.Xor32(OpCodes.Xor32(temp, OpCodes.Shl32(temp, 5)), OpCodes.Shl32(temp, 7));
        const nc3 = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(c2[3], n2), OpCodes.Shr32(c2[2], (32 - n2))), temp);
        const nc2 = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(c2[2], n2), OpCodes.Shr32(c2[1], (32 - n2))), temp);
        const nc1 = OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(c2[1], n2), OpCodes.Shr32(c2[0], (32 - n2))), OpCodes.Shl32(temp, 5));
        const nc0 = OpCodes.Xor32(OpCodes.Shl32(c2[0], n2), temp);
        c2[3] = nc3; c2[2] = nc2; c2[1] = nc1; c2[0] = nc0;
      }

      for (let i = 0; i < 4; i++) {
        this.var1[i] = OpCodes.Xor32(this.var1[i], this.ckey1[i]);
        this.var2[i] = OpCodes.Xor32(this.var2[i], this.ckey2[i]);
      }
    }

    // Combining sub-process: mixes var1/var2 through the combiner tables
    // twice (rolling one byte per output word) and folds in the mask ch
    // to produce one 128-bit (16-byte) keystream block.
    _combine() {
      const v1 = this.var1, v2 = this.var2;
      let c0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.sbox0[OpCodes.And32(v1[0], 0xFF)], this.sbox1[OpCodes.And32(OpCodes.Shr32(v1[0], 8), 0xFF)]), this.sbox2[OpCodes.And32(OpCodes.Shr32(v1[0], 16), 0xFF)]), this.sbox3[OpCodes.And32(OpCodes.Shr32(v1[0], 24), 0xFF)]), v2[0]);
      let c1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.sbox0[OpCodes.And32(v1[1], 0xFF)], this.sbox1[OpCodes.And32(OpCodes.Shr32(v1[1], 8), 0xFF)]), this.sbox2[OpCodes.And32(OpCodes.Shr32(v1[1], 16), 0xFF)]), this.sbox3[OpCodes.And32(OpCodes.Shr32(v1[1], 24), 0xFF)]), v2[1]);
      let c2 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.sbox0[OpCodes.And32(v1[2], 0xFF)], this.sbox1[OpCodes.And32(OpCodes.Shr32(v1[2], 8), 0xFF)]), this.sbox2[OpCodes.And32(OpCodes.Shr32(v1[2], 16), 0xFF)]), this.sbox3[OpCodes.And32(OpCodes.Shr32(v1[2], 24), 0xFF)]), v2[2]);
      let c3 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.sbox0[OpCodes.And32(v1[3], 0xFF)], this.sbox1[OpCodes.And32(OpCodes.Shr32(v1[3], 8), 0xFF)]), this.sbox2[OpCodes.And32(OpCodes.Shr32(v1[3], 16), 0xFF)]), this.sbox3[OpCodes.And32(OpCodes.Shr32(v1[3], 24), 0xFF)]), v2[3]);

      const out = new Array(16);
      for (let w = 0; w < 4; w++) {
        const word = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.sbox0[OpCodes.And32(c0, 0xFF)], this.sbox1[OpCodes.And32(c1, 0xFF)]), this.sbox2[OpCodes.And32(c2, 0xFF)]), this.sbox3[OpCodes.And32(c3, 0xFF)]), this.ch[w]);
        const b = OpCodes.Unpack32LE(word);
        out[w * 4] = b[0]; out[w * 4 + 1] = b[1]; out[w * 4 + 2] = b[2]; out[w * 4 + 3] = b[3];
        c0 = OpCodes.Shr32(c0, 8); c1 = OpCodes.Shr32(c1, 8); c2 = OpCodes.Shr32(c2, 8); c3 = OpCodes.Shr32(c3, 8);
      }
      return out;
    }

    // Produces one 16-byte keystream block, refreshing the dice state every
    // 64 steps (the controller re-seeds its low half from the previous
    // cycle's high half, matching the reference construction's period).
    _produceBlock() {
      if (this.cyl === 0) {
        for (let i = 0; i < 16; i += 4) {
          for (let j = 0; j < 4; j++) { this.skey1[i + j + 64] = this.skey1[i + j]; this.skey1[i + j] = 0; }
          for (let j = 0; j < 4; j++) { this.skey2[i + j + 64] = this.skey2[i + j]; this.skey2[i + j] = 0; }
        }
        this.cyl = 64;
      }
      this.cyl--;
      this._tick(this.cyl);
      return this._combine();
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptDicingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptDicingAlgorithm, DarkCryptDicingInstance };
}));
