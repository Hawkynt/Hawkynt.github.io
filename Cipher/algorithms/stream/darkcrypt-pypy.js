/*
 * Pypy (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Pypy is Biham and Seberry's strengthened variant of Py, proposed for
 * eSTREAM Phase 2. It reuses Py's key setup, IV setup, and rolling-array
 * round structure (260-entry Y array, 256-entry P permutation) but changes
 * the output stage: instead of emitting two 32-bit words per round (with
 * fixed rotations 11 then 7), Pypy applies a single fixed rotation of 18 and
 * emits only one 32-bit little-endian word per round, closing a weakness
 * that let attackers correlate the two Py output words.
 *
 * This file ports the DarkCrypt Total Commander plugin's implementation.
 * The core algorithm matches the authors' published eSTREAM reference source
 * (pypy.c) exactly - verified bit-for-bit against the official eSTREAM test
 * vectors (key=8000000000000000, IV=00000000). DarkCrypt's wrapper hardcodes
 * a fixed 64-byte (512-bit) key and 64-byte (512-bit) IV; its test vectors
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

  /**
   * @returns {uint8[]}
   */
  function buildInternalPermutation() {
    const seed = "This is the seed for generating the fixed internal permutation for Py. " +
      "The permutation is used in the key setup and IV setup as a source of nonlinearity. " +
      "The shifted special keys on a keyboard are ~!@#$%^&*()_+{}:|<>?";
    /** @type {uint8[]} */
    const ip = new Array(256);
    for (let i = 0; i < 256; i++) ip[i] = i;
    /** @type {uint32} */
    let j = 0;
    let p = 0;
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
  const PYSIZE = 260;
  const YOFF = 3;
  const KEY_BYTES = 64;
  const IV_BYTES = 64;

  class DarkCryptPypyAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Pypy (DarkCrypt)";
      this.description = "Strengthened variant of Py by Biham and Seberry: same rolling-array key/IV setup as Py, but the round output stage is simplified to a single fixed rotation (18) producing one 32-bit word per round instead of two. Ported from the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 512-bit IV.";
      this.inventor = "Eli Biham, Jennifer Seberry";
      this.year = 2006;
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
        new LinkItem("Biham, Seberry - \"Pypy: Another Version of Py\"", "https://www.ecrypt.eu.org/stream/papersdir/2006/038.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Chosen-IV / distinguishing attacks", "Pypy inherits Py's flawed IV setup; broken by chosen-IV attacks and superseded by the tweaked TPypy.", "Use TPypy or a vetted modern cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv)+crypt(buf,len)).
      this.tests = [
        {
          text: "DarkCrypt Pypy keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("108a776da56fee73215a9dc9742a6cd0dfa653ac9c1c238d8912b0a989a7127a94e25c603d91f10686270d71df2c2a588e316124462976c8badb9ed7c1db62b459749cecc8a443d61babf2db406e67086a0a46342359acca24cea2f9211267a69908ffa64ecb791a43393dc42d65049151a9e03909829c1125558ea68d7c3f9f")
        },
        {
          text: "DarkCrypt Pypy — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("03203d5a7794b1ceeb0825425f7c99b6d3f00d2a4764819ebbd8f5122f4c6986a3c0ddfa1734516e8ba8c5e2ff1c3956"),
          key: OpCodes.Hex8ToBytes("0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186abd0f51a3f6489aed3f81d42678cb1d6fb20456a8fb4d9fe23486d92b7dc0126"),
          iv: OpCodes.Hex8ToBytes("073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72a7dc11467bb0e51a4f84b9ee23588dc2f72c6196cb00356a9fd4093e73a8dd12"),
          expected: OpCodes.Hex8ToBytes("73377697e55a2666d2af7a41dbd8c31ef749f682826de5ca75e5e59641c426a109fb41152626e020f6019375395845a8")
        },

        ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPypyInstance(this, isInverse);
    }
  }

  class DarkCryptPypyInstance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptPypyAlgorithm} algorithm
     * @param {boolean} [isInverse=false]
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint32[]|null} */
      this.Y = null;
      /** @type {uint8[]|null} */
      this.P = null;
      /** @type {uint8[]|null} */
      this.E = null;
      /** @type {uint32} */
      this.s = 0;
      /** @type {int32} */
      this.R = 0;
      /** @type {uint8[]} */
      this.ksBuf = [];
      /** @type {int32} */
      this.ksPos = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Pypy (DarkCrypt) requires exactly " + KEY_BYTES + " bytes");
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }
    /**
     * @returns {uint8[]|null}
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} ivBytes
     */
    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== IV_BYTES)
        throw new Error("Invalid IV size: " + ivBytes.length + " bytes. Pypy (DarkCrypt) requires exactly " + IV_BYTES + " bytes");
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }
    /**
     * @returns {uint8[]|null}
     */
    get iv() { return this._iv ? [...this._iv] : null; }

    /**
     * @param {uint8[]} data
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * @returns {uint8[]}
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.Xor8(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    /**
     * @param {int32} idx - Virtual Y index (YMININD..)
     * @returns {uint32} Y word
     */
    _getY(idx) { return OpCodes.ToUint32(this.Y[idx + YOFF]); }
    /**
     * @param {int32} idx - Virtual Y index (YMININD..)
     * @param {uint32} val - Word to store
     */
    _setY(idx, val) { this.Y[idx + YOFF] = OpCodes.ToUint32(val); }
    /**
     * @param {int32} idx - P index
     * @returns {uint8} P entry
     */
    _getP(idx) { return this.P[idx]; }
    /**
     * @param {int32} idx - P index
     * @param {uint8} val - Entry to store
     */
    _setP(idx, val) { this.P[idx] = val; }
    /**
     * @param {int32} idx - E index
     * @returns {uint8} E entry
     */
    _getE(idx) { return this.E[idx]; }
    /**
     * @param {int32} idx - E index
     * @param {uint8} val - Entry to store
     */
    _setE(idx, val) { this.E[idx] = val; }

    _initialize() {
      const key = this._key, iv = this._iv;
      const keysizeb = key.length, ivsizeb = iv.length;

      // --- Key setup (identical structure across the whole Py family) ---
      /** @type {uint32} */
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
      /** @type {uint32[]} */
      const yWords = new Array(PYSIZE + 4096);
      this.Y = yWords;
      let j = 0;
      for (let i = YMININD; i <= YMAXIND; i++) {
        s = OpCodes.ToUint32(s + key[j]);
        const s0 = IP[OpCodes.And32(s, 0xFF)];
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
        this._setY(i, s);
        j++;
        if (j >= keysizeb) j = 0;
      }

      // --- IV setup (identical formulas to untweaked Py) ---
      let v = OpCodes.And32(OpCodes.Xor32(iv[0], OpCodes.And32(OpCodes.Shr32(this._getY(0), 16), 0xFF)), 0xFF);
      let d = OpCodes.And32(OpCodes.Or32(OpCodes.Xor32(iv[1 % ivsizeb], OpCodes.And32(OpCodes.Shr32(this._getY(1), 16), 0xFF)), 1), 0xFF);
      /** @type {uint8[]} */
      const pBytes = new Array(256 + 4096);
      this.P = pBytes;
      {
        let vv = v;
        for (let i = 0; i < 256; i++) {
          this._setP(i, IP[vv]);
          vv = OpCodes.And32(vv + d, 0xFF);
        }
      }
      s = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(v, 24), OpCodes.Shl32(d, 16)), OpCodes.Shl32(this._getP(254), 8)), this._getP(255));
      s = OpCodes.Xor32(s, (OpCodes.ToUint32(this._getY(YMININD) + this._getY(YMAXIND))));

      /** @type {uint8[]} */
      const eBytes = new Array(256 + 4096);
      this.E = eBytes;
      const eivBase = 256 - ivsizeb;
      for (let i = 0; i < ivsizeb; i++) {
        s = OpCodes.Add32(OpCodes.Add32(s, iv[i]), this._getY(YMININD + i));
        const s0 = this._getP(OpCodes.And32(s, 0xFF));
        this._setE(i + eivBase, s0);
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
      }
      for (let i = 0; i < ivsizeb; i++) {
        s = OpCodes.Add32(OpCodes.Add32(s, iv[i]), this._getY(YMAXIND - i));
        const s0 = this._getP(OpCodes.And32(s, 0xFF));
        this._setE(i + eivBase, OpCodes.And32(OpCodes.Add32(this._getE(i + eivBase), s0), 0xFF));
        s = OpCodes.Xor32(OpCodes.RotL32(s, 8), s0);
      }

      for (let R = 0; R < PYSIZE; R++) {
        const readIdx = R + eivBase;
        const writeIdx = readIdx + ivsizeb;
        /** @type {int32} */
        const x0 = OpCodes.And32(OpCodes.Xor32(this._getE(readIdx), OpCodes.And32(s, 0xFF)), 0xFF);
        this._setE(writeIdx, x0);

        this._setP(R + 256, this._getP(R + x0));
        this._setP(R + x0, this._getP(R + 0));

        s = OpCodes.Add32(OpCodes.Xor32(s, this._getY(R + YMININD)), this._getY(R + x0));
        this._setY(R + YMAXIND + 1, s);
      }

      s = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(s, this._getY(PYSIZE + 26)), this._getY(PYSIZE + 153)), this._getY(PYSIZE + 208));
      if (s === 0) s = OpCodes.Add32(OpCodes.Add32(keysizeb * 8, OpCodes.Shl32((ivsizeb * 8), 16)), 0x87654321);

      this.s = s;
      this.R = PYSIZE;
      this.ksBuf = [];
      this.ksPos = 0;
    }

    /**
     * @returns {uint8[]}
     */
    _round() {
      const R = this.R;
      let s = this.s;

      /** @type {int32} */
        const x0 = OpCodes.And32(this._getY(R + 185), 0xFF);
      this._setP(R + 256, this._getP(R + x0));
      this._setP(R + x0, this._getP(R + 0));

      s = OpCodes.Add32(s, this._getY(R + this._getP(R + 1 + 72)));
      s = OpCodes.Sub32(s, this._getY(R + this._getP(R + 1 + 239)));
      s = OpCodes.RotL32(s, OpCodes.And32(this._getP(R + 1 + 116), 31));
      const newY = OpCodes.Add32(OpCodes.Xor32(s, this._getY(R + YMININD)), this._getY(R + this._getP(R + 1 + 153)));
      this._setY(R + YMAXIND + 1, newY);

      s = OpCodes.RotL32(s, 18);
      const out2 = OpCodes.Add32(OpCodes.Xor32(s, this._getY(R - 1)), this._getY(R + this._getP(R + 1 + 208)));

      this.s = s;
      this.R = R + 1;

      return OpCodes.Unpack32LE(out2);
    }

    /**
     * @returns {uint8}
     */
    _nextKeystreamByte() {
      if (this.ksPos >= this.ksBuf.length) {
        this.ksBuf = this._round();
        this.ksPos = 0;
      }
      return this.ksBuf[this.ksPos++];
    }
  }

  const algorithmInstance = new DarkCryptPypyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPypyAlgorithm, DarkCryptPypyInstance };
}));
