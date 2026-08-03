/*
 * Yamb (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Yamb is a T-function-based synchronous stream cipher submitted by LAN Crypto
 * (Anatoly Lebedev, Sergey Starodubtzev, Alexey Volchkov) to the eCRYPT eSTREAM
 * project (Profile 1/2, April 2005). It combines a 512-bit and a 2048-bit Galois-style
 * word LFSR (state array OLZ, feedback polynomial 0x091B17C9) with a 256-byte
 * RC4-like nonlinear substitution table M, mixed through a 12-step byte network
 * per 32-bit word, generating 256 bytes of keystream per block.
 *
 * The reference algorithm supports keys of 80-256 bits and IVs of 32-128 bits.
 * The DarkCrypt Total Commander plugin always uses the maximum sizes: a
 * 256-bit (32-byte) key and a 128-bit (16-byte) IV; this port fixes those
 * sizes to match. Aside from that, the core algorithm is the unmodified
 * eSTREAM reference construction (verified against the official eSTREAM
 * Yamb256 test vectors and matched against the DarkCrypt implementation's
 * output).
 *
 * Yamb was eliminated in eSTREAM Phase 1 following a distinguishing attack by
 * Hongjun Wu and Bart Preneel. Educational only.
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

  // Galois-LFSR feedback polynomial used by the OLZ word registers.
  const ALF = 0x091B17C9;

  // Fixed initial nonlinear substitution table (256 bytes), from the eSTREAM reference.
  const CONST_M = Object.freeze([
    0x85,0x2D,0x43,0x2F,0xA6,0x90,0xF8,0x1B,0xA9,0xB4,0x1C,0x58,0xE8,0xA5,0xD7,0x56,
    0x6B,0x03,0x38,0x67,0x3D,0xB1,0x7B,0x0B,0xF2,0xCB,0x29,0xFC,0x53,0x75,0x05,0xCA,
    0x0E,0xAE,0xD1,0x9C,0xBC,0xB0,0xDF,0x62,0xCF,0x3A,0xFE,0xDC,0x20,0x83,0x88,0x68,
    0x41,0x24,0x45,0x01,0x91,0xF0,0xA0,0xF6,0x65,0x02,0xB5,0xBE,0x0F,0xE5,0x13,0xD4,
    0xBF,0xA4,0x86,0x4A,0x63,0x82,0x4B,0xAC,0x9E,0xE2,0x7F,0x50,0x6C,0xEC,0x31,0x44,
    0x09,0x94,0x9A,0x40,0x06,0xC3,0x37,0xF4,0x2A,0x57,0x7C,0x25,0x99,0xFA,0x21,0x3B,
    0xEE,0x54,0x3C,0x22,0xB8,0xEB,0x51,0x8C,0x87,0x66,0x10,0x27,0x6D,0xAA,0xCE,0x39,
    0xE0,0xBD,0x8B,0x9B,0x69,0xB6,0xE7,0x36,0xAF,0xDE,0x34,0x93,0x9F,0xA2,0x60,0x14,
    0x7D,0xA7,0x8D,0x7E,0x76,0x48,0x72,0x74,0x23,0xCD,0x73,0xD9,0x33,0xD6,0xB2,0x78,
    0x9D,0x3F,0x32,0x8E,0xED,0x5B,0x2B,0x4F,0xD3,0xE9,0x1E,0x4C,0x16,0x4E,0xB3,0xC5,
    0xD8,0xF3,0x2E,0x26,0x28,0x8A,0x12,0x64,0xFB,0xA3,0xFF,0xAD,0xE1,0xB7,0x1A,0xD0,
    0xF1,0xBA,0x7A,0xA1,0x00,0xD2,0xE4,0xC6,0xC0,0x30,0x81,0x52,0x92,0x46,0x61,0xC1,
    0x95,0x1F,0x2C,0xC2,0x4D,0x42,0x49,0x07,0x5A,0xFD,0x0C,0x70,0xCC,0x84,0xF9,0xD5,
    0x5E,0x18,0xB9,0x5D,0xC9,0x5C,0xC4,0x1D,0x6E,0x35,0x59,0xDB,0x15,0x79,0xDD,0xE6,
    0xDA,0xA8,0x89,0x80,0x98,0x5F,0xEF,0x96,0x19,0xF7,0xC7,0x3E,0x47,0x0D,0x71,0xEA,
    0x04,0xBB,0x55,0x77,0xC8,0x0A,0x17,0x97,0xAB,0x8F,0x11,0x08,0xE3,0x6F,0xF5,0x6A
  ]);

  // Fixed 9-byte padding constant used to fill unused key/IV setup bytes ("LANCrypto" ASCII).
  const CONST_OLZ = Object.freeze([0x4C,0x41,0x4E,0x43,0x72,0x79,0x70,0x74,0x6F]);

  const KEY_SIZE = 32; // DarkCrypt fixes the key to 256 bits (reference range: 80-256 bits)
  const IV_SIZE = 16;  // DarkCrypt fixes the IV to 128 bits (reference range: 32-128 bits)
  const BLOCK_SIZE = 256; // bytes of keystream produced per internal block

  /**
   * The 12-step nonlinear byte mixing network shared by IV setup and keystream
   * generation. Mutates the 256-byte table M in place and returns the mixed
   * 32-bit little-endian word.
   */
  function mix12(word, M) {
    let a = OpCodes.And32(word, 0xFF), b = OpCodes.And32(OpCodes.Shr32(word, 8), 0xFF), c = OpCodes.And32(OpCodes.Shr32(word, 16), 0xFF), d = OpCodes.And32(OpCodes.Shr32(word, 24), 0xFF);

    b ^= M[a]; M[a] = OpCodes.And32(M[a] + d, 0xFF);
    c ^= M[d]; M[d] = OpCodes.And32(M[d] + b, 0xFF);
    a ^= M[b]; M[b] = OpCodes.And32(M[b] + c, 0xFF);
    d ^= M[c]; M[c] = OpCodes.And32(M[c] + a, 0xFF);
    c ^= M[a]; M[a] = OpCodes.And32(M[a] + d, 0xFF);
    b ^= M[d]; M[d] = OpCodes.And32(M[d] + c, 0xFF);
    a ^= M[c]; M[c] = OpCodes.And32(M[c] + b, 0xFF);
    d ^= M[b]; M[b] = OpCodes.And32(M[b] + a, 0xFF);
    b ^= M[a]; M[a] = OpCodes.And32(M[a] + d, 0xFF);
    c ^= M[d]; M[d] = OpCodes.And32(M[d] + b, 0xFF);
    a ^= M[b]; M[b] = OpCodes.And32(M[b] + c, 0xFF);
    d ^= M[c]; M[c] = OpCodes.And32(M[c] + a, 0xFF);

    return OpCodes.Pack32LE(a, b, c, d);
  }

  class DarkCryptYambAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Yamb (DarkCrypt)";
      this.description = "T-function-based eSTREAM Phase 1 candidate by LAN Crypto, combining Galois-style word LFSRs (state OLZ, feedback 0x091B17C9) with a 256-byte nonlinear substitution table mixed via a 12-step byte network. The DarkCrypt implementation fixes the key to 256 bits and the IV to 128 bits (reference supports 80-256 bit keys, 32-128 bit IVs).";
      this.inventor = "LAN Crypto (Anatoly Lebedev, Sergey Starodubtzev, Alexey Volchkov)";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("eSTREAM Yamb page (archived)", "https://www.ecrypt.eu.org/stream/yamb.html"),
        new LinkItem("Yamb specification (LAN Crypto eSTREAM submission)", "https://www.ecrypt.eu.org/stream/ciphers/yamb/yamb.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("Yamb reference C implementation (eSTREAM submission package)", "https://www.ecrypt.eu.org/stream/ciphers/yamb/yambsource.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Distinguishing Attack", "Hongjun Wu and Bart Preneel published a distinguishing attack against the Yamb output; the cipher was archived after eSTREAM Phase 1.", "Use a vetted modern stream cipher such as ChaCha20.")
      ];

      // Test vectors: vector 1 generated from the official eSTREAM Yamb256 reference
      // implementation (yamb.c); vectors 2-3 verified against the DarkCrypt
      // implementation (setup+crypt), matching the same unmodified algorithm at
      // fixed 256-bit key / 128-bit IV sizes.
      this.tests = [
        {
          text: "eSTREAM Yamb reference algorithm — key repeats the eSTREAM 128-bit test key to 256 bits, IV extends the eSTREAM 32-bit test IV with zero bytes to 128 bits (verified against the official yamb.c reference)",
          uri: "https://www.ecrypt.eu.org/stream/ciphers/yamb/yambsource.zip",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("20212223000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0f94b44a299f77f9f11f448247813b1fd9f71e8a4e60d40b950f64ff49d6ff65c7b7aa7ecaf85dde6c81c1d56ac649c3755e25b5442e4e06f9f24d80bb920afc")
        },
        {
          text: "DarkCrypt Yamb — keystream (256-bit incrementing key, zero IV, zero input)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ae5f58527e8a046ba09c11bcca824afbac617b8555e084e64552f718d0adcc5098fc8bd5e656529bcaaf4da24319e86f0c789e003a3650b94ebced8aac7bea69ead427b76f3b04fe3382d829e3f890c3f0e2fa45d8f1843e0cc5f77947a205e5f0915f7f51e3e8a1b867d346f8af8940b3d8746d086bd0975181f08a3c6f49ab")
        },
        {
          text: "DarkCrypt Yamb — encryption (256-bit incrementing key, zero IV, incrementing plaintext)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ae5e5a517a8f026ca8951bb7c68f44f4bc70699641f592f15d4bed03ccb0d24fb8dda9f6c27374bce28667896f34c6403c49ac330e03668e7685d7b19046d456")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptYambInstance(this, isInverse);
    }
  }

  class DarkCryptYambInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      this._key = null;
      this._iv = null;

      // Cipher state
      this.M = null;    // 256-byte nonlinear substitution table
      this.OLZ = null;  // 64-word Galois-style LFSR register
      this.RZ = null;   // 16-word accumulator register
      this._keystreamBuffer = [];
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Yamb (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes || ivBytes.length !== IV_SIZE) {
        this._iv = new Array(IV_SIZE).fill(0);
      } else {
        this._iv = [...ivBytes];
      }
      if (this._key) this._initialize();
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this.M) this._initialize();
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this.M) this._initialize();

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    /**
     * Full key+IV setup, following the eSTREAM Yamb reference algorithm
     * (ECRYPT_keysetup + ECRYPT_ivsetup).
     */
    _initialize() {
      if (!this._key || !this._iv) return;

      const M = new Array(256);
      for (let i = 0; i < 256; i++) M[i] = CONST_M[i];

      const OLZ = new Array(64).fill(0);
      const RZ = new Array(16).fill(0);

      // Build the 60-byte seed buffer: key || iv || repeating "LANCrypto" padding.
      const seed = new Array(60);
      for (let i = 0; i < 32; i++) seed[i] = this._key[i % KEY_SIZE];
      for (let i = 32; i < 32 + IV_SIZE; i++) seed[i] = this._iv[i - 32];
      for (let i = 32 + IV_SIZE; i < 60; i++) seed[i] = CONST_OLZ[(i - 32 - IV_SIZE) % 9];

      for (let i = 0; i < 15; i++)
        OLZ[i] = OpCodes.Pack32LE(seed[i * 4], seed[i * 4 + 1], seed[i * 4 + 2], seed[i * 4 + 3]);

      const idx = { I0: 0, I1: 8, I2: 15 };
      let J = 0;

      for (let i = 0; i < 225; i++) {
        const abcd = this._stepOLZ(OLZ, 0xF, idx);
        const ABCD = OpCodes.XorN(mix12(abcd, M), abcd);
        RZ[J] = OpCodes.ToUint32(ABCD);
        J = OpCodes.And32(J + 1, 0xF);
      }

      for (let i = 0; i < 64; i++) {
        const abcd = this._stepOLZ(OLZ, 0xF, idx);
        const ABCD = OpCodes.ToUint32(OpCodes.XorN(mix12(abcd, M), abcd));
        const abcd2 = OpCodes.ToUint32(ABCD + RZ[J]);
        const bytes2 = OpCodes.Unpack32LE(abcd2);
        M[i * 4] ^= bytes2[0];
        M[i * 4 + 1] ^= bytes2[1];
        M[i * 4 + 2] ^= bytes2[2];
        M[i * 4 + 3] ^= bytes2[3];
        RZ[J] = ABCD;
        J = OpCodes.And32(J + 1, 0xF);
      }

      for (let i = 0; i < 15; i++) {
        const abcd = this._stepOLZ(OLZ, 0xF, idx);
        const ABCD = OpCodes.ToUint32(OpCodes.XorN(mix12(abcd, M), abcd));
        RZ[J] = OpCodes.ToUint32(RZ[J] + ABCD);
        J = OpCodes.And32(J + 1, 0xF);
      }

      for (let i = 1; i < 16; i++) OLZ[i + 32] = RZ[i];

      const idx64 = { I0: 33, I1: 41, I2: 48 };
      J = 0;
      for (let i = 0; i < 16; i++) {
        const abcd = this._stepOLZ(OLZ, 0x3F, idx64);
        const ABCD = OpCodes.ToUint32(OpCodes.XorN(mix12(abcd, M), abcd));
        RZ[J] = ABCD;
        J = OpCodes.And32(J + 1, 0xF);
      }
      for (let i = 0; i < 64; i++) this._stepOLZ(OLZ, 0x3F, idx64);

      this.M = M;
      this.OLZ = OLZ;
      this.RZ = RZ;
      this._keystreamBuffer = [];
    }

    /**
     * Advances a Galois-style word LFSR register by one step:
     * new = feedback(ALF if MSB set) XOR (2*OLZ[I0]) XOR OLZ[I1], stored at OLZ[I2].
     */
    _stepOLZ(OLZ, mask, idx) {
      const v0 = OLZ[idx.I0];
      const feedback = OpCodes.And32(v0, 0x80000000) ? ALF : 0;
      const abcd = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(feedback, OpCodes.Shl32(v0, 1)), OLZ[idx.I1]));
      OLZ[idx.I2] = abcd;
      idx.I0 = OpCodes.And32(idx.I0 + 1, mask);
      idx.I1 = OpCodes.And32(idx.I1 + 1, mask);
      idx.I2 = OpCodes.And32(idx.I2 + 1, mask);
      return abcd;
    }

    /** Generates one 256-byte keystream block, advancing the 64-word OLZ register. */
    _generateBlock() {
      const OLZ = this.OLZ, RZ = this.RZ, M = this.M;
      const BUF = new Array(64);
      for (let i = 0; i < 64; i++) BUF[i] = mix12(OLZ[i], M);

      const out = new Array(BLOCK_SIZE);
      for (let i = 0; i < 64; i++) {
        const ABCD = OpCodes.ToUint32(OpCodes.XorN(BUF[i], OLZ[i]));
        const abcd = OpCodes.ToUint32(ABCD + RZ[OpCodes.And32(i, 0xF)]);
        const bytes = OpCodes.Unpack32LE(abcd);
        out[i * 4] = bytes[0];
        out[i * 4 + 1] = bytes[1];
        out[i * 4 + 2] = bytes[2];
        out[i * 4 + 3] = bytes[3];
        RZ[OpCodes.And32(i, 0xF)] = ABCD;

        const t1 = OLZ[OpCodes.And32(i + 49, 0x3F)], t2 = OLZ[OpCodes.And32(i + 57, 0x3F)];
        const feedback = OpCodes.And32(t1, 0x80000000) ? ALF : 0;
        OLZ[OpCodes.And32(i, 0x3F)] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(feedback, OpCodes.Shl32(t1, 1)), t2));
      }
      return out;
    }

    _nextKeystreamByte() {
      if (this._keystreamBuffer.length === 0)
        this._keystreamBuffer = this._generateBlock();
      return this._keystreamBuffer.shift();
    }
  }

  const algorithmInstance = new DarkCryptYambAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptYambAlgorithm, DarkCryptYambInstance };
}));
