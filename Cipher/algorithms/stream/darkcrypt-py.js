/*
 * Py (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Py ("Roo") is an eSTREAM Phase 2 focus candidate designed by Eli Biham and
 * Jennifer Seberry. It uses two "rolling arrays": a 260-entry array Y of 32-bit
 * words and a 256-entry byte permutation P, both indexed with a continuously
 * advancing round counter so that old entries are discarded and new ones
 * appended each round (RC4-like sliding window, but on much larger tables).
 * Each round swaps one byte of P (index chosen from Y), derives a new Y entry,
 * and emits two 32-bit little-endian output words per round.
 *
 * This file ports the DarkCrypt Total Commander plugin's implementation.
 * The core algorithm matches the authors' published eSTREAM reference source
 * (py.c) exactly - verified bit-for-bit against the official eSTREAM test
 * vectors (key=8000000000000000, IV=00000000). DarkCrypt's wrapper hardcodes
 * a fixed 64-byte (512-bit) key and 32-byte (256-bit) IV; its test vectors
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

  // ---- Fixed internal permutation, shared seed across the whole Py family ----
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
  const YMAXIND = 256;
  const PYSIZE = 260;   // YMAXIND - YMININD + 1
  const YOFF = 3;       // -YMININD, offset to map virtual Y index to array index
  const KEY_BYTES = 64;
  const IV_BYTES = 32;

  class DarkCryptPyAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Py (DarkCrypt)";
      this.description = "Py (\"Roo\") eSTREAM Phase 2 candidate by Biham and Seberry, using two rolling arrays (a 260-word Y array and a 256-byte permutation P) indexed by a continuously advancing round counter. Ported from the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 256-bit IV.";
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
        new LinkItem("eSTREAM reference C source (py.c)", "https://github.com/Yawolf/py-cipher"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Distinguishing / key-recovery attacks", "Wu and Preneel, and others, broke Py's IV setup with chosen-IV attacks; superseded by the tweaked TPy.", "Use TPy or a vetted modern cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv)+crypt(buf,len)).
      this.tests = [
        {
          text: "DarkCrypt Py keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("2d92f053176f06e956c924da00218c5a84f2c9e513def4ea5785c7ee8aea32e1c190fcecf208b72ae5a2f2b1c8e801fe1a93785ea5ef503ecd159c0757e40e50910c8ab04f8116711ce1431f6c2f040a1b80e3c158689230dcbb6db3d32e53f5d7f67bea16441e6adbb581e7f0aa4e40a12f269bddd280ac345fbb0a2cde8628")
        },

        ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPyInstance(this, isInverse);
    }
  }

  class DarkCryptPyInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this.Y = null;
      this.P = null;
      this.s = 0;
      this.R = 0;
      this.ksBuf = [];
      this.ksPos = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Py (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== IV_BYTES)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Py (DarkCrypt) requires exactly ${IV_BYTES} bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      this.inputBuffer.push(...data);
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

      // --- Key setup ---
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

      // --- IV setup ---
      let v = OpCodes.And32(OpCodes.Xor32(iv[0], OpCodes.And32(OpCodes.Shr32(this._getY(0), 16), 0xFF)), 0xFF);
      let d = OpCodes.And32(OpCodes.Or32(OpCodes.Xor32(iv[1 % ivsizeb], OpCodes.And32(OpCodes.Shr32(this._getY(1), 16), 0xFF)), 1), 0xFF);
      this.P = new Array(256 + 4096);
      {
        let vv = v;
        for (let i = 0; i < 256; i++) {
          this._setP(i, IP[vv]);
          vv = OpCodes.And32(vv + d, 0xFF);
        }
      }
      s = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(v, 24), OpCodes.Shl32(d, 16)), OpCodes.Shl32(this._getP(254), 8)), this._getP(255));
      s = OpCodes.Xor32(s, (OpCodes.ToUint32(this._getY(YMININD) + this._getY(YMAXIND))));

      this.E = new Array(256 + 4096);
      const eivBase = 256 - ivsizeb;
      for (let i = 0; i < ivsizeb; i++) {
        s = OpCodes.ToUint32(s + iv[i] + this._getY(YMININD + i));
        const s0 = this._getP(OpCodes.And32(s, 0xFF));
        this._setE(i + eivBase, s0);
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
      }
      for (let i = 0; i < ivsizeb; i++) {
        s = OpCodes.ToUint32(s + iv[i] + this._getY(YMAXIND - i));
        const s0 = this._getP(OpCodes.And32(s, 0xFF));
        this._setE(i + eivBase, OpCodes.And32((this._getE(i + eivBase) + s0), 0xFF));
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
      }

      for (let R = 0; R < PYSIZE; R++) {
        const readIdx = R + eivBase;
        const writeIdx = readIdx + ivsizeb;
        const x0 = OpCodes.And32(OpCodes.Xor32(this._getE(readIdx), OpCodes.And32(s, 0xFF)), 0xFF);
        this._setE(writeIdx, x0);

        this._setP(R + 256, this._getP(R + x0));
        this._setP(R + x0, this._getP(R + 0));

        s = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R + YMININD)) + this._getY(R + x0));
        this._setY(R + YMAXIND + 1, s);
      }

      s = OpCodes.ToUint32(s + this._getY(PYSIZE + 26) + this._getY(PYSIZE + 153) + this._getY(PYSIZE + 208));
      if (s === 0) s = OpCodes.ToUint32(keysizeb * 8 + (OpCodes.Shl32((ivsizeb * 8), 16)) + 0x87654321);

      this.s = s;
      this.R = PYSIZE;
      this.ksBuf = [];
      this.ksPos = 0;
    }

    _round() {
      const R = this.R;
      let s = this.s;

      const x0 = OpCodes.And32(this._getY(R + 185), 0xFF);
      this._setP(R + 256, this._getP(R + x0));
      this._setP(R + x0, this._getP(R + 0));

      s = OpCodes.ToUint32(s + this._getY(R + this._getP(R + 1 + 72)));
      s = OpCodes.ToUint32(s - this._getY(R + this._getP(R + 1 + 239)));
      s = OpCodes.RotL32(s, OpCodes.And32(this._getP(R + 1 + 116), 31));
      const newY = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R + YMININD)) + this._getY(R + this._getP(R + 1 + 153)));
      this._setY(R + YMAXIND + 1, newY);

      s = OpCodes.RotL32(s, 11);
      const out1 = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R + 256)) + this._getY(R + this._getP(R + 1 + 26)));
      s = OpCodes.RotL32(s, 7);
      const out2 = OpCodes.ToUint32(OpCodes.Xor32(s, this._getY(R - 1)) + this._getY(R + this._getP(R + 1 + 208)));

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

  const algorithmInstance = new DarkCryptPyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPyAlgorithm, DarkCryptPyInstance };
}));
