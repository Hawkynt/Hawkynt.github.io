/*
 * NLS2 (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NLSv2 ("Non-Linear SOBER v2") as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 * NLSv2 is a SOBER-family stream cipher by Philip Hawkes, Michael Paddon,
 * Gregory G. Rose and Miriam Wiggers de Vries (Qualcomm), submitted to the
 * eSTREAM project. It shares SOBER-128's 17-word LFSR-style register and
 * key/IV loading pattern, but uses a different nonlinear feedback and filter:
 *   - feedback: t = ROTL(R[0],19) + ROTL(R[15],9) + konst; t ^= Sbox[t>>24]; t ^= R[4]
 *   - filter (nltap): (R[0]+R[16]) ^ (R[1]+R[13]) ^ (R[6]+konst)   -- no S-box in the filter
 *   - konst is re-initialised to INITKONST before IV loading and regenerated
 *     with a single cycle+nltap (no "avoid zero high byte" retry loop, unlike SOBER-128)
 * The 8-bit->32-bit S-box table (Skipjack F-table combined with a QUT-designed
 * S-box) happens to be numerically identical to the one used by SOBER-128, since
 * both ciphers share the same design lineage; it is embedded here independently
 * as plain data (no code shared with sober128.js).
 * This port implements keystream generation only; the MAC/authentication mode of
 * NLSv2 is not exposed by the plugin's interface and is out of scope here.
 * Key: 128-bit (16 bytes). IV: 128-bit (16 bytes).
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
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance,
          LinkItem, KeySize } = AlgorithmFramework;

  // ===== NLS2 CONSTANTS =====

  const N = 17;                    // register size (words)
  const INITKONST = 0x6996c53a;    // initial KONST during key/IV loading
  const KEYP = 15;                 // register position for key/IV word insertion
  const FOLDP = 4;                 // register position for diffusion feedback

  // Combined Skipjack F-table / QUT 8x32 S-box (data table, not executable code)
  const Sbox = new Uint32Array([
    0xa3aa1887, 0xd65e435c, 0x0b65c042, 0x800e6ef4,
    0xfc57ee20, 0x4d84fed3, 0xf066c502, 0xf354e8ae,
    0xbb2ee9d9, 0x281f38d4, 0x1f829b5d, 0x735cdf3c,
    0x95864249, 0xbc2e3963, 0xa1f4429f, 0xf6432c35,
    0xf7f40325, 0x3cc0dd70, 0x5f973ded, 0x9902dc5e,
    0xda175b42, 0x590012bf, 0xdc94d78c, 0x39aab26b,
    0x4ac11b9a, 0x8c168146, 0xc3ea8ec5, 0x058ac28f,
    0x52ed5c0f, 0x25b4101c, 0x5a2db082, 0x370929e1,
    0x2a1843de, 0xfe8299fc, 0x202fbc4b, 0x833915dd,
    0x33a803fa, 0xd446b2de, 0x46233342, 0x4fcee7c3,
    0x3ad607ef, 0x9e97ebab, 0x507f859b, 0xe81f2e2f,
    0xc55b71da, 0xd7e2269a, 0x1339c3d1, 0x7ca56b36,
    0xa6c9def2, 0xb5c9fc5f, 0x5927b3a3, 0x89a56ddf,
    0xc625b510, 0x560f85a7, 0xace82e71, 0x2ecb8816,
    0x44951e2a, 0x97f5f6af, 0xdfcbc2b3, 0xce4ff55d,
    0xcb6b6214, 0x2b0b83e3, 0x549ea6f5, 0x9de041af,
    0x792f1f17, 0xf73b99ee, 0x39a65ec0, 0x4c7016c6,
    0x857709a4, 0xd6326e01, 0xc7b280d9, 0x5cfb1418,
    0xa6aff227, 0xfd548203, 0x506b9d96, 0xa117a8c0,
    0x9cd5bf6e, 0xdcee7888, 0x61fcfe64, 0xf7a193cd,
    0x050d0184, 0xe8ae4930, 0x88014f36, 0xd6a87088,
    0x6bad6c2a, 0x1422c678, 0xe9204de7, 0xb7c2e759,
    0x0200248e, 0x013b446b, 0xda0d9fc2, 0x0414a895,
    0x3a6cc3a1, 0x56fef170, 0x86c19155, 0xcf7b8a66,
    0x551b5e69, 0xb4a8623e, 0xa2bdfa35, 0xc4f068cc,
    0x573a6acd, 0x6355e936, 0x03602db9, 0x0edf13c1,
    0x2d0bb16d, 0x6980b83c, 0xfeb23763, 0x3dd8a911,
    0x01b6bc13, 0xf55579d7, 0xf55c2fa8, 0x19f4196e,
    0xe7db5476, 0x8d64a866, 0xc06e16ad, 0xb17fc515,
    0xc46feb3c, 0x8bc8a306, 0xad6799d9, 0x571a9133,
    0x992466dd, 0x92eb5dcd, 0xac118f50, 0x9fafb226,
    0xa1b9cef3, 0x3ab36189, 0x347a19b1, 0x62c73084,
    0xc27ded5c, 0x6c8bc58f, 0x1cdde421, 0xed1e47fb,
    0xcdcc715e, 0xb9c0ff99, 0x4b122f0f, 0xc4d25184,
    0xaf7a5e6c, 0x5bbf18bc, 0x8dd7c6e0, 0x5fb7e420,
    0x521f523f, 0x4ad9b8a2, 0xe9da1a6b, 0x97888c02,
    0x19d1e354, 0x5aba7d79, 0xa2cc7753, 0x8c2d9655,
    0x19829da1, 0x531590a7, 0x19c1c149, 0x3d537f1c,
    0x50779b69, 0xed71f2b7, 0x463c58fa, 0x52dc4418,
    0xc18c8c76, 0xc120d9f0, 0xafa80d4d, 0x3b74c473,
    0xd09410e9, 0x290e4211, 0xc3c8082b, 0x8f6b334a,
    0x3bf68ed2, 0xa843cc1b, 0x8d3c0ff3, 0x20e564a0,
    0xf8f55a4f, 0x2b40f8e7, 0xfea7f15f, 0xcf00fe21,
    0x8a6d37d6, 0xd0d506f1, 0xade00973, 0xefbbde36,
    0x84670fa8, 0xfa31ab9e, 0xaedab618, 0xc01f52f5,
    0x6558eb4f, 0x71b9e343, 0x4b8d77dd, 0x8cb93da6,
    0x740fd52d, 0x425412f8, 0xc5a63360, 0x10e53ad0,
    0x5a700f1c, 0x8324ed0b, 0xe53dc1ec, 0x1a366795,
    0x6d549d15, 0xc5ce46d7, 0xe17abe76, 0x5f48e0a0,
    0xd0f07c02, 0x941249b7, 0xe49ed6ba, 0x37a47f78,
    0xe1cfffbd, 0xb007ca84, 0xbb65f4da, 0xb59f35da,
    0x33d2aa44, 0x417452ac, 0xc0d674a7, 0x2d61a46a,
    0xdc63152a, 0x3e12b7aa, 0x6e615927, 0xa14fb118,
    0xa151758d, 0xba81687b, 0xe152f0b3, 0x764254ed,
    0x34c77271, 0x0a31acab, 0x54f94aec, 0xb9e994cd,
    0x574d9e81, 0x5b623730, 0xce8a21e8, 0x37917f0b,
    0xe8a9b5d6, 0x9697adf8, 0xf3d30431, 0x5dcac921,
    0x76b35d46, 0xaa430a36, 0xc2194022, 0x22bca65e,
    0xdaec70ba, 0xdfaea8cc, 0x777bae8b, 0x242924d5,
    0x1f098a5a, 0x4b396b81, 0x55de2522, 0x435c1cb8,
    0xaeb8fe1d, 0x9db3c697, 0x5b164f83, 0xe0c16376,
    0xa319224c, 0xd0203b35, 0x433ac0fe, 0x1466a19a,
    0x45f0b24f, 0x51fda998, 0xc0d52d71, 0xfa0896a8,
    0xf9e6053f, 0xa4b0d300, 0xd499cbcc, 0xb95e3d40
  ]);

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptNLS2Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "NLS2 (DarkCrypt)";
      this.description = "NLSv2 stream cipher (SOBER-family eSTREAM candidate) as implemented in the DarkCrypt Total Commander plugin. 17-word register with a rotate-based nonlinear feedback and an S-box-free nonlinear filter. Keystream-only port; the plugin's MAC mode is not exposed.";
      this.inventor = "Philip Hawkes, Michael Paddon, Gregory G. Rose, Miriam Wiggers de Vries (Qualcomm)";
      this.year = 2006;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];    // fixed 128-bit key
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit IV

      this.documentation = [
        new LinkItem("Specification for NLSv2 (New Stream Cipher Designs, LNCS 4986)", "https://link.springer.com/chapter/10.1007/978-3-540-68351-3_6"),
        new LinkItem("eSTREAM NLS project page", "https://www.ecrypt.eu.org/stream/nls.html"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("eSTREAM NLSv2 reference implementation (nlsref.cpp / nlssbox.h)", "https://github.com/crocs-muni/CryptoStreams/tree/master/streams/stream_ciphers/estream/nls")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) + crypt(buf,len)).
      this.tests = [
        {
          text: "DarkCrypt Nls2lib — sequential key/IV, 128 zero bytes",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("f68ab7b995e75e768cc1b62082ea3117a78d8d5bd0081ba01daeedd165c22813ca93b50e5991c57484bd8bc1bff7098282e68b572c2bfb7ad3803ff2581344f5c66e2ae44dea01fb7b04b0c1c38f39e1837c506f8d20a322241af75b7a9ba05e79c89c8d9a5b21e0b5931fc148178ebe7c1124908b8cb3121150d4c286a27d9c")
        },
        {
          text: "DarkCrypt Nls2lib — sequential key/IV, incrementing 64-byte input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("f68bb5ba91e2587184c8bc2b8ee73f18b79c9f48c41d0db705b7f7ca79df360ceab2972d7db4e353ac94a1ea93da27adb2d7b964181ecd4debb905c9642e7aca")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptNLS2Instance(this, isInverse);
    }
  }

  class DarkCryptNLS2Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      this.R = new Uint32Array(N);
      this.initR = new Uint32Array(N);
      this.konst = 0;
      this.sbuf = 0;
      this.nbuf = 0;
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes) && !(keyBytes instanceof Uint8Array)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid NLS2 key size: ${keyBytes.length} bytes. Key must be 16 bytes (128 bits)`);
      }

      this._key = Array.from(keyBytes);
      this._setupKey();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivData) {
      if (!ivData) {
        this._iv = null;
        return;
      }

      if (!Array.isArray(ivData) && !(ivData instanceof Uint8Array)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivData.length !== 16) {
        throw new Error(`Invalid NLS2 IV size: ${ivData.length} bytes. IV must be 16 bytes (128 bits)`);
      }

      this._iv = Array.from(ivData);

      if (this._key) {
        this._setupIV();
      }
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data) && !(data instanceof Uint8Array)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("NLS2 not properly initialized");
      }

      const output = [];
      let inlen = this.inputBuffer.length;
      let inpos = 0;

      while (this.nbuf !== 0 && inlen !== 0) {
        output.push(OpCodes.Xor32(this.inputBuffer[inpos++], OpCodes.And32(this.sbuf, 0xFF)));
        this.sbuf = OpCodes.Shr32(this.sbuf, 8);
        this.nbuf -= 8;
        --inlen;
      }

      while (inlen >= 4) {
        this._cycle();
        const t = this._nltap();

        const w0 = this.inputBuffer[inpos++];
        const w1 = this.inputBuffer[inpos++];
        const w2 = this.inputBuffer[inpos++];
        const w3 = this.inputBuffer[inpos++];

        const word = OpCodes.Pack32LE(w0, w1, w2, w3);
        const result = OpCodes.ToUint32(OpCodes.Xor32(word, t));

        const unpacked = OpCodes.Unpack32LE(result);
        output.push(unpacked[0]);
        output.push(unpacked[1]);
        output.push(unpacked[2]);
        output.push(unpacked[3]);

        inlen -= 4;
      }

      if (inlen !== 0) {
        this._cycle();
        this.sbuf = this._nltap();
        this.nbuf = 32;

        while (this.nbuf !== 0 && inlen !== 0) {
          output.push(OpCodes.Xor32(this.inputBuffer[inpos++], OpCodes.And32(this.sbuf, 0xFF)));
          this.sbuf = OpCodes.Shr32(this.sbuf, 8);
          this.nbuf -= 8;
          --inlen;
        }
      }

      this.inputBuffer = [];

      return output;
    }

    // ===== KEY / IV SCHEDULE =====

    _setupKey() {
      if (!this._key) return;

      this._initState();
      this._loadKeyMaterial(this._key);
      this._genkonst();
      this._savestate();

      this.nbuf = 0;
      this.initialized = true;

      // Re-derive IV schedule if IV was already set before the key.
      if (this._iv) {
        this._setupIV();
      }
    }

    _setupIV() {
      if (!this._iv || !this._key) return;

      this._reloadstate();
      this.konst = OpCodes.ToUint32(INITKONST);
      this._loadKeyMaterial(this._iv);
      this._genkonst();

      this.nbuf = 0;
    }

    _initState() {
      this.R[0] = 1;
      this.R[1] = 1;
      for (let i = 2; i < N; i++) {
        this.R[i] = OpCodes.ToUint32(this.R[i - 1] + this.R[i - 2]);
      }
      this.konst = OpCodes.ToUint32(INITKONST);
    }

    _loadKeyMaterial(bytes) {
      let i = 0;
      for (; i + 4 <= bytes.length; i += 4) {
        const k = this._byte2word(bytes, i);
        this.R[KEYP] = OpCodes.ToUint32(this.R[KEYP] + k);
        this._cycle();
        this.R[FOLDP] = OpCodes.Xor32(this.R[FOLDP], this._nltap());
      }

      if (i < bytes.length) {
        const xtra = [0, 0, 0, 0];
        let j = 0;
        for (; i < bytes.length; ++i) xtra[j++] = bytes[i];
        const k = this._byte2word(xtra, 0);
        this.R[KEYP] = OpCodes.ToUint32(this.R[KEYP] + k);
        this._cycle();
        this.R[FOLDP] = OpCodes.Xor32(this.R[FOLDP], this._nltap());
      }

      this.R[KEYP] = OpCodes.ToUint32(this.R[KEYP] + bytes.length);

      this._diffuse();
    }

    _byte2word(bytes, offset) {
      return OpCodes.Pack32LE(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
    }

    // NLSv2 nonlinear feedback: rotate-based combination, single S-box lookup.
    _cycle() {
      let t = OpCodes.ToUint32(
        OpCodes.RotL32(this.R[0], 19) + OpCodes.RotL32(this.R[15], 9) + this.konst
      );
      t = OpCodes.Xor32(t, Sbox[OpCodes.GetByte(t, 3)]);
      t = OpCodes.Xor32(t, this.R[4]);

      for (let i = 1; i < N; i++) {
        this.R[i - 1] = this.R[i];
      }
      this.R[N - 1] = OpCodes.ToUint32(t);
    }

    // NLSv2 nonlinear filter: no S-box, three modular-sum terms XORed together.
    _nltap() {
      const a = OpCodes.ToUint32(this.R[0] + this.R[16]);
      const b = OpCodes.ToUint32(this.R[1] + this.R[13]);
      const c = OpCodes.ToUint32(this.R[6] + this.konst);
      return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(a, b), c));
    }

    _diffuse() {
      for (let z = 0; z < N; z++) {
        this._cycle();
        this.R[FOLDP] = OpCodes.Xor32(this.R[FOLDP], this._nltap());
      }
    }

    // NLSv2 generates konst with a single cycle+nltap (no zero-high-byte retry, unlike SOBER-128).
    _genkonst() {
      this._cycle();
      this.konst = OpCodes.ToUint32(this._nltap());
    }

    _savestate() {
      for (let i = 0; i < N; i++) {
        this.initR[i] = this.R[i];
      }
    }

    _reloadstate() {
      for (let i = 0; i < N; i++) {
        this.R[i] = this.initR[i];
      }
    }
  }

  const algorithmInstance = new DarkCryptNLS2Algorithm();
  RegisterAlgorithm(algorithmInstance);

  return { DarkCryptNLS2Algorithm, DarkCryptNLS2Instance };
}));
