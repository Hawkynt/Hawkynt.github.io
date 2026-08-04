/*
 * Hermes8 (DarkCrypt variant) Stream Cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Hermes8 as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). Hermes8 is a byte-oriented
 * stream cipher (eSTREAM Phase 1 candidate, Ulrich Kaiser) built around
 * the AES S-box. This variant uses a 128-bit key and a 128-bit IV.
 *
 * Internal state (matching the DarkCrypt implementation):
 *   - K[16]   : working key register (evolves during keystream generation)
 *   - ST[17]  : 17-byte state register (initialised from the IV)
 *   - accu    : accumulator byte
 *   - p        : running key index (steps by 3 mod 16)
 *   - c        : mixing counter (triggers key-register update every 7 steps)
 *   - n        : round counter (an extra p advance whenever n % 5 == 0)
 * Update rule per position j:  accu = S[accu ^ ST[j] ^ K[p]]; ST[j] = accu.
 * Key/IV setup runs 5 mixing rounds; each 8-byte keystream block runs 2.
 * Output byte q of a block uses ST[(2*q) mod 17]. Keystream XORs the input.
 *
 * Test vectors generated from the DarkCrypt implementation (setup(key,iv),
 * crypt(in,out,len)). Educational only.
 *
 * SECURITY STATUS: EDUCATIONAL - eSTREAM Phase 1 candidate, not selected.
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

  // Standard AES (Rijndael) S-box - used verbatim by the DarkCrypt implementation.
  const SBOX = Object.freeze([
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
  ]);

  const KEYLEN = 16;   // 128-bit key (bytes)
  const STLEN  = 17;   // state register length

  class DarkCryptHermesAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Hermes8 (DarkCrypt)";
      this.description = "Hermes8 byte-oriented stream cipher as shipped in the DarkCrypt Total Commander plugin. Built around the AES S-box with a 17-byte state register and an evolving 16-byte key register. 128-bit key, 128-bit IV.";
      this.inventor = "Ulrich Kaiser (Hermes8); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit key
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit IV

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Hermes8 eSTREAM submission", "https://www.ecrypt.eu.org/stream/hermes8.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Not selected for eSTREAM", "Hermes8 was an eSTREAM Phase 1 candidate that was not advanced; the DarkCrypt variant is unanalysed.", "Use a vetted cipher such as ChaCha20 or AES-GCM.")
      ];

      // Test vectors generated from the DarkCrypt implementation
      // (key = 00 01 02 .. 0f, iv = all zeros).
      this.tests = [
        {
          text: "DarkCrypt Hermes - 128 zero bytes, key 00..0f, iv 0",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("896e260cddf5618498ce69e189f2c6e8d2ece3bae069a04485b9853fec8bf3c4ae6682ed94adc3854f080d1d161146d000e22ce9e71c72ea29808d5dcfcc7121bbe2234825f52a48f29c5a833c0df270b6da8d53350b29129d8e1be3632000595582ceb16211c4f5dad13ab26b76366325b6b9923a28e1becc05ad433a887a38")
        },
        {
          text: "DarkCrypt Hermes - encrypt 00..3f, key 00..0f, iv 0",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("896f240fd9f0678390c763ea85ffc8e7c2fdf1a9f47cb6539da09f24f096eddb8e47a0ceb088e5a2672127363a3c68ff30d31edad32944dd11b9b766f3f14f1e")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptHermesInstance(this, isInverse);
    }
  }

  class DarkCryptHermesInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== KEYLEN)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Hermes8 (DarkCrypt) requires exactly ${KEYLEN} bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== KEYLEN)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Hermes8 (DarkCrypt) requires exactly ${KEYLEN} bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    // One mixing pass over all 17 state positions (used by both setup and keygen).
    _mixPass() {
      for (let j = 0; j < STLEN; j++) {
        this.accu = SBOX[OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(this.accu, this.ST[j]), this.K[this.p]), 0xFF)];
        this.ST[j] = this.accu;
        this.p = OpCodes.And32(this.p + 3, 0x0F);   // mod 16
        this.c++;
        if (this.c >= 7) {
          const p1 = OpCodes.And32(this.p + 1, 0x0F);
          const p2 = OpCodes.And32(p1 + 1, 0x0F);
          this.K[p1] = SBOX[OpCodes.And32(OpCodes.Xor32(this.K[p1], this.K[this.p]), 0xFF)];
          this.K[p2] = SBOX[OpCodes.And32(OpCodes.Xor32(this.K[p2], this.K[this.p]), 0xFF)];
          this.c -= 7;
        }
      }
    }

    // Run `rounds` mixing passes, advancing n and doing the n%5 extra p step.
    _runRounds(rounds) {
      for (let r = 0; r < rounds; r++) {
        this._mixPass();
        if (this.n % 5 === 0) this.p = OpCodes.And32(this.p + 1, 0x0F);
        this.n = OpCodes.ToUint32(this.n + 1);
      }
    }

    _initialize() {
      if (!this._key || !this._iv) return;
      this.K = this._key.slice(0, KEYLEN);         // working key = key
      this.ST = new Array(STLEN);
      for (let i = 0; i < STLEN; i++)
        this.ST[i] = (i < KEYLEN) ? OpCodes.And32(this._iv[i], 0xFF) : 0;  // ST[16] = 0
      this.accu = 0;
      this.p = 0;
      this.c = 0;
      this.n = 1;
      this._runRounds(5);   // key/IV schedule: 5 mixing rounds
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      const out = [];
      const total = this.inputBuffer.length;
      let off = 0;
      while (off < total) {
        this._runRounds(2);   // 2 mixing rounds per 8-byte keystream block
        const n = Math.min(8, total - off);
        for (let q = 0; q < n; q++)
          out.push(OpCodes.And32(OpCodes.Xor32(this.inputBuffer[off + q], this.ST[(2 * q) % STLEN]), 0xFF));
        off += 8;
      }
      this.inputBuffer = [];
      return out;
    }
  }

  const algorithmInstance = new DarkCryptHermesAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptHermesAlgorithm, DarkCryptHermesInstance };
}));
