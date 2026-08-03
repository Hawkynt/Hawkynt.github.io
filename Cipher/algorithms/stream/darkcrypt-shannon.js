/*
 * Shannon (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Shannon is a word-oriented stream cipher (with an integrated MAC, not used
 * here) designed by Hawkes, McDonald, Paddon, Rose and Wiggers de Vries,
 * influenced by the SOBER family, Helix/Phelix, Trivium and SHA-256. It uses
 * a single 32-bit-wide, 16-element non-linear feedback shift register plus
 * one extra "konst" word, combined through two S-box functions.
 *
 * This port targets the keystream-only path (setup(key,iv) + crypt(buf,len))
 * as exposed by the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). This is an UNMODIFIED implementation of the published
 * Qualcomm reference algorithm (256-bit key, 128-bit nonce, standard
 * shn_key/shn_nonce/shn_stream calls) - unlike several other ciphers in this
 * DarkCrypt batch, no deviations from the reference design were needed.
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
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const N = 16;                        // register length in words
  const FOLD = N;                      // diffusion rounds
  const INITKONST = 0x6996c53a;
  const KEYP = 13;                     // where key/MAC words are folded in

  function sbox1(w) {
    w = OpCodes.Xor32(w, OpCodes.Or32(OpCodes.RotL32(w, 5), OpCodes.RotL32(w, 7)));
    w = OpCodes.Xor32(w, OpCodes.Or32(OpCodes.RotL32(w, 19), OpCodes.RotL32(w, 22)));
    return w;
  }

  function sbox2(w) {
    w = OpCodes.Xor32(w, OpCodes.Or32(OpCodes.RotL32(w, 7), OpCodes.RotL32(w, 22)));
    w = OpCodes.Xor32(w, OpCodes.Or32(OpCodes.RotL32(w, 5), OpCodes.RotL32(w, 19)));
    return w;
  }

  class DarkCryptShannonAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Shannon (DarkCrypt)";
      this.description = "Shannon stream cipher (Hawkes, McDonald, Paddon, Rose, Wiggers de Vries), 256-bit key / 128-bit nonce, keystream-only path (MAC unused). Unmodified port of the published Qualcomm reference algorithm, as implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Philip Hawkes, Cameron McDonald, Michael Paddon, Gregory Rose, Miriam Wiggers de Vries";
      this.year = 2007;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("Design and Primitive Specification for Shannon", "https://eprint.iacr.org/2007/044"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("Reference implementation of the Shannon cipher", "https://github.com/timniederhausen/shannon")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Limited public cryptanalysis", "Shannon has received comparatively little independent cryptanalysis; not recommended for new designs.", "Use a modern vetted stream cipher such as ChaCha20.")
      ];

      // Test vectors verified against the DarkCrypt implementation
      // (setup(key,iv) + crypt(buf,len) in-place XOR keystream).
      this.tests = [
        {
          text: "DarkCrypt Shannon — incrementing key, zero nonce, 128-byte zero keystream",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00".repeat(128)),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0ee2138f44128488c2420f73e456e8c69b882661cdbad4599ff1450cf3c404fe51e404ad44d6b91e033baa73b68e02a419e4890205125a4db883de138ba9941f84cebab0ea8b1aeb5b24dfe7ffd030399494cbbec37498d04d4f8b3b3563b2410319d85c8fa845960d798127ff5431e4b93ecca5ff8946213aeb27046ce8d6fc")
        },
        {
          text: "DarkCrypt Shannon — incrementing key/plaintext, zero nonce",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0ee3118c4017828fca4b0578e85be6c98b993472d9afc24e87e85f17efd91ae171c5268e60f39f392b1280589aa32c8b29d5bb3131276c7a80bae428b794aa20")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptShannonInstance(this, isInverse);
    }
  }

  class DarkCryptShannonInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      this.R = new Array(N).fill(0);
      this.CRC = new Array(N).fill(0);
      this.initR = new Array(N).fill(0);
      this.konst = 0;
      this.sbuf = 0;
      this.nbuf = 0; // number of buffered stream BITS remaining in sbuf
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Shannon (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes || ivBytes.length !== 16)
        throw new Error("Invalid IV size. Shannon (DarkCrypt) requires exactly 16 bytes");
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key || !this._iv) throw new Error("Key and IV must be set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key || !this._iv) throw new Error("Key and IV must be set");
      if (this.inputBuffer.length === 0) return [];

      const buf = [...this.inputBuffer];
      this._stream(buf);
      this.inputBuffer = [];
      return buf;
    }

    // ===== Shannon core =====

    _initialize() {
      this._key_setup(this._key);
      this._nonce_setup(this._iv);
    }

    _cycle() {
      let t = OpCodes.Xor32(OpCodes.Xor32(this.R[12], this.R[13]), this.konst);
      t = OpCodes.Xor32(sbox1(t), OpCodes.RotL32(this.R[0], 1));
      for (let i = 1; i < N; i++) this.R[i - 1] = this.R[i];
      this.R[N - 1] = t;
      t = sbox2(OpCodes.Xor32(this.R[2], this.R[15]));
      this.R[0] = OpCodes.Xor32(this.R[0], t);
      this.sbuf = OpCodes.Xor32(OpCodes.Xor32(t, this.R[8]), this.R[12]);
    }

    _initState() {
      this.R[0] = 1;
      this.R[1] = 1;
      for (let i = 2; i < N; i++) this.R[i] = OpCodes.Add32(this.R[i - 1], this.R[i - 2]);
      this.konst = INITKONST;
    }

    _saveState() { for (let i = 0; i < N; i++) this.initR[i] = this.R[i]; }
    _reloadState() { for (let i = 0; i < N; i++) this.R[i] = this.initR[i]; }
    _genKonst() { this.konst = this.R[0]; }
    _addKey(k) { this.R[KEYP] = OpCodes.Xor32(this.R[KEYP], k); }
    _diffuse() { for (let i = 0; i < FOLD; i++) this._cycle(); }

    _loadKey(key) {
      const keylen = key.length;
      let i = 0;
      for (; i + 4 <= keylen; i += 4) {
        const k = OpCodes.Pack32LE(key[i], key[i + 1], key[i + 2], key[i + 3]);
        this._addKey(k);
        this._cycle();
      }
      if (i < keylen) {
        const xtra = [0, 0, 0, 0];
        let j = 0;
        for (; i < keylen; i++) xtra[j++] = key[i];
        const k = OpCodes.Pack32LE(xtra[0], xtra[1], xtra[2], xtra[3]);
        this._addKey(k);
        this._cycle();
      }
      this._addKey(OpCodes.ToUint32(keylen));
      this._cycle();

      for (let ii = 0; ii < N; ii++) this.CRC[ii] = this.R[ii];
      this._diffuse();
      for (let ii = 0; ii < N; ii++) this.R[ii] = OpCodes.Xor32(this.R[ii], this.CRC[ii]);
    }

    _key_setup(keyBytes) {
      this._initState();
      this._loadKey(keyBytes);
      this._genKonst();
      this._saveState();
      this.nbuf = 0;
    }

    _nonce_setup(nonceBytes) {
      this._reloadState();
      this.konst = INITKONST;
      this._loadKey(nonceBytes);
      this._genKonst();
      this.nbuf = 0;
    }

    // XOR pseudo-random bytes into buf, in place.
    _stream(buf) {
      let pos = 0;
      let nbytes = buf.length;

      while (this.nbuf !== 0 && nbytes !== 0) {
        buf[pos] = OpCodes.XorN(buf[pos], OpCodes.And32(this.sbuf, 0xff));
        this.sbuf = OpCodes.Shr32(this.sbuf, 8);
        this.nbuf -= 8;
        pos++; nbytes--;
      }

      const wholeWords = OpCodes.And32(nbytes, ~0x3);
      const endPos = pos + wholeWords;
      while (pos < endPos) {
        this._cycle();
        const b = OpCodes.Unpack32LE(this.sbuf);
        buf[pos]     = OpCodes.XorN(buf[pos], b[0]);
        buf[pos + 1] = OpCodes.XorN(buf[pos + 1], b[1]);
        buf[pos + 2] = OpCodes.XorN(buf[pos + 2], b[2]);
        buf[pos + 3] = OpCodes.XorN(buf[pos + 3], b[3]);
        pos += 4;
      }

      nbytes &= 0x3;
      if (nbytes !== 0) {
        this._cycle();
        this.nbuf = 32;
        while (this.nbuf !== 0 && nbytes !== 0) {
          buf[pos] = OpCodes.XorN(buf[pos], OpCodes.And32(this.sbuf, 0xff));
          this.sbuf = OpCodes.Shr32(this.sbuf, 8);
          this.nbuf -= 8;
          pos++; nbytes--;
        }
      }
    }
  }

  const algorithmInstance = new DarkCryptShannonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptShannonAlgorithm, DarkCryptShannonInstance };
}));
