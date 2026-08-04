/*
 * Py6 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Py6 is Biham and Seberry's reduced-state variant of Py, submitted alongside
 * it to eSTREAM. It shrinks the rolling permutation P to 64 entries (6-bit
 * values) and the rolling word array Y to 68 entries, cutting key/IV setup
 * cost sharply while keeping the same round structure and output rate (two
 * 32-bit little-endian words per round) as Py.
 *
 * This file ports the DarkCrypt Total Commander plugin's implementation.
 * The core algorithm matches the authors' published eSTREAM reference source
 * (py6.c) exactly - verified bit-for-bit against the official eSTREAM test
 * vectors (key=8000000000000000, IV=00000000). DarkCrypt's wrapper hardcodes
 * a fixed 32-byte (256-bit) key and 32-byte (256-bit) IV; its test vectors
 * are verified against that implementation.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  function buildInternalPermutation() {
    const seed = "This is the seed for generating the fixed internal permutation for Py. " +
      "The permutation is used in the key setup and IV setup as a source of nonlinearity. " +
      "The shifted special keys on a keyboard are ~!@#$%^&*()_+{}:|<>?";
    const ip = new Array(256);
    for (let i = 0; i < 256; i++) ip[i] = i;
    let j = 0, p = 0;
    for (let i = 0; i < 256 * 16; i++) {
      j = OpCodes.And32(j + seed.charCodeAt(p), 0xFF);
      const tmp = ip[OpCodes.And32(i, 0xFF)];
      ip[OpCodes.And32(i, 0xFF)] = ip[OpCodes.And32(j, 0xFF)];
      ip[OpCodes.And32(j, 0xFF)] = tmp;
      p++;
      if (p >= seed.length) p = 0;
    }
    return ip;
  }
  const IP = buildInternalPermutation();

  const YMININD = -3;
  const YMAXIND = 64;
  const PYSIZE = 68;    // YMAXIND - YMININD + 1
  const YOFF = 3;
  const MASK = 0x3F;
  const KEY_BYTES = 32;
  const IV_BYTES = 32;

  class DarkCryptPy6Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Py6 (DarkCrypt)";
      this.description = "Reduced-state variant of Py by Biham and Seberry: a 64-entry (6-bit) rolling permutation P and a 68-entry rolling word array Y, same round structure and two-word output as Py but far cheaper key/IV setup. Ported from the DarkCrypt Total Commander plugin, which hardcodes a 256-bit key and 256-bit IV.";
      this.inventor = "Eli Biham, Jennifer Seberry";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Rolling-Array Stream Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.IL;

      this.SupportedKeySizes = [new KeySize(KEY_BYTES, KEY_BYTES, 0)];
      this.SupportedNonceSizes = [new KeySize(IV_BYTES, IV_BYTES, 0)];

      this.documentation = [
        new LinkItem("eSTREAM Py Phase 2 page", "https://www.ecrypt.eu.org/stream/pyp2.html"),
        new LinkItem("Py (cipher) - Wikipedia", "https://en.wikipedia.org/wiki/Py_(cipher)"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("Biham, Seberry - C Code of Py6, eSTREAM submission package", "https://www.ecrypt.eu.org/stream/py.html"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Distinguishing / key-recovery attacks", "Py6 shares Py's broken IV setup and was superseded by the tweaked TPy6.", "Use TPy6 or a vetted modern cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv)+crypt(buf,len)).
      this.tests = [
        {
          text: "DarkCrypt Py6 keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("76f4f37ef99618f05f6e37915b5f155b11baa364135804add08f5993c755c704b7fdc77ef8f8c05f290c039847874a902e043e337ecad27bdee53ecb4a1d9906f9953c55c6c5847b11e6e8d129d96086eb78d2980ae6554e3dafff17422681a4ca95ac40d0fbe93c2263887d87a80d6d9ff19933f6ca642fa56cbcc42f58269b")
        },

        ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPy6Instance(this, isInverse);
    }
  }

  class DarkCryptPy6Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this.Y = null;
      this.P = null;
      this.E = null;
      this.s = 0;
      this.R = 0;
      this.ksBuf = [];
      this.ksPos = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Py6 (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== IV_BYTES)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Py6 (DarkCrypt) requires exactly ${IV_BYTES} bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

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

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _getY(idx) { return OpCodes.ToUint32(this.Y[idx + YOFF]); }
    _setY(idx, val) { this.Y[idx + YOFF] = OpCodes.ToUint32(val); }
    _getP(idx) { return this.P[idx]; }
    _setP(idx, val) { this.P[idx] = val; }
    _getE(idx) { return this.E[idx]; }
    _setE(idx, val) { this.E[idx] = val; }

    _initialize() {
      const key = this._key, iv = this._iv;
      const keysizeb = key.length, ivsizeb = iv.length;

      // --- Key setup (identical structure across the whole Py family) ---
      let s = IP[keysizeb - 1];
      s = OpCodes.Or32((OpCodes.Shl32(s, 8)), IP[OpCodes.And32(OpCodes.Xor32(s, ivsizeb - 1), 0xFF)]);
      s = OpCodes.Or32((OpCodes.Shl32(s, 8)), IP[OpCodes.And32(OpCodes.Xor32(s, key[0]), 0xFF)]);
      s = OpCodes.Or32((OpCodes.Shl32(s, 8)), IP[OpCodes.And32(OpCodes.Xor32(s, key[keysizeb - 1]), 0xFF)]);
      for (let j = 0; j < keysizeb; j++) {
        s = OpCodes.ToUint32(s + key[j]);
        const s0 = IP[OpCodes.And32(s, 0xFF)];
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
      }
      for (let j = 0; j < keysizeb; j++) {
        s = OpCodes.ToUint32(s + key[j]);
        const s0 = IP[OpCodes.And32(s, 0xFF)];
        s = OpCodes.Xor32(s, (OpCodes.ToUint32(OpCodes.RotL32(s, 8) + s0)));
      }
      this.Y = new Array(PYSIZE + 4096);
      let j = 0;
      for (let i = YMININD; i <= YMAXIND; i++) {
        s = OpCodes.ToUint32(s + key[j]);
        const s0 = IP[OpCodes.And32(s, 0xFF)];
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
        this._setY(i, s);
        j++;
        if (j >= keysizeb) j = 0;
      }

      // --- IV setup (Py6: narrow 64-entry / 6-bit P, rotate-by-6 mixing) ---
      let v = OpCodes.And32(OpCodes.Xor32(iv[0], OpCodes.And32(OpCodes.Shr32(this._getY(0), 16), 0xFF)), 0xFF);
      let d = OpCodes.And32(OpCodes.Or32(OpCodes.Xor32(iv[1 % ivsizeb], OpCodes.And32(OpCodes.Shr32(this._getY(1), 16), 0xFF)), 1), 0xFF);
      this.P = new Array(64 + 4096);
      {
        let vv = v;
        for (let i = 0; i < 64; i++) {
          this._setP(i, OpCodes.And32(vv, MASK));
          vv = OpCodes.And32(vv + d, 0xFF);
        }
        v = OpCodes.And32(vv, MASK);
      }
      s = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(v, 24), OpCodes.Shl32(d, 16)), OpCodes.Shl32(this._getP(62), 8)), this._getP(63));
      s = OpCodes.Xor32(s, (OpCodes.ToUint32(this._getY(YMININD) + this._getY(YMAXIND))));

      this.E = new Array(64 + 4096);
      const eivBase = 64 - ivsizeb;
      for (let i = 0; i < ivsizeb; i++) {
        s = OpCodes.ToUint32(s + iv[i] + this._getY(YMININD + i));
        const s0 = this._getP(OpCodes.And32(s, MASK));
        this._setE(i + eivBase, s0);
        s = OpCodes.Xor32(OpCodes.RotL32(s, 6), s0);
      }
      for (let i = 0; i < ivsizeb; i++) {
        s = OpCodes.ToUint32(s + iv[i] + this._getY(YMAXIND - i));
        const s0 = this._getP(OpCodes.And32(s, MASK));
        this._setE(i + eivBase, OpCodes.And32((this._getE(i + eivBase) + s0), MASK));
        s = OpCodes.Xor32(OpCodes.RotL32(s, 6), s0);
      }

      for (let R = 0; R < PYSIZE; R++) {
        const readIdx = R + eivBase;
        const writeIdx = readIdx + ivsizeb;
        const x0 = OpCodes.And32(OpCodes.Xor32(this._getE(readIdx), OpCodes.And32(s, MASK)), MASK);
        this._setE(writeIdx, x0);

        this._setP(R + 64, this._getP(R + x0));
        this._setP(R + x0, this._getP(R + 0));

        s = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R + YMININD)) + this._getY(R + x0));
        this._setY(R + YMAXIND + 1, s);
      }

      s = OpCodes.ToUint32(s + this._getY(PYSIZE + 8) + this._getY(PYSIZE + 21) + this._getY(PYSIZE + 48));
      if (s === 0) s = OpCodes.ToUint32(keysizeb * 8 + (OpCodes.Shl32((ivsizeb * 8), 16)) + 0x87654321);

      this.s = s;
      this.R = PYSIZE;
      this.ksBuf = [];
      this.ksPos = 0;
    }

    _round() {
      const R = this.R;
      let s = this.s;

      const x0 = OpCodes.And32(this._getY(R + 43), MASK);
      this._setP(R + 64, this._getP(R + x0));
      this._setP(R + x0, this._getP(R + 0));

      s = OpCodes.ToUint32(s + this._getY(R + this._getP(R + 1 + 18)));
      s = OpCodes.ToUint32(s - this._getY(R + this._getP(R + 1 + 57)));
      s = OpCodes.RotL32(s, OpCodes.And32(this._getP(R + 1 + 26), 31));
      const newY = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R + YMININD)) + this._getY(R + this._getP(R + 1 + 48)));
      this._setY(R + YMAXIND + 1, newY);

      s = OpCodes.RotL32(s, 11);
      const out1 = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R + 64)) + this._getY(R + this._getP(R + 1 + 8)));
      s = OpCodes.RotL32(s, 7);
      const out2 = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R - 1)) + this._getY(R + this._getP(R + 1 + 21)));

      this.s = s;
      this.R = R + 1;

      return [...OpCodes.Unpack32LE(out1), ...OpCodes.Unpack32LE(out2)];
    }

    _nextKeystreamByte() {
      if (this.ksPos >= this.ksBuf.length) {
        this.ksBuf = this._round();
        this.ksPos = 0;
      }
      return this.ksBuf[this.ksPos++];
    }
  }

  const algorithmInstance = new DarkCryptPy6Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPy6Algorithm, DarkCryptPy6Instance };
}));
