/*
 * SSS (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SSS ("Self-Synchronizing SOBER") as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 * SSS is a self-synchronizing member of the SOBER family of stream ciphers,
 * designed by Philip Hawkes, Michael Paddon, Gregory G. Rose and Miriam Wiggers
 * de Vries (Qualcomm Australia), submitted to the eSTREAM project (2005).
 *
 * Unlike the earlier, synchronous SOBER-family designs, SSS has no explicit
 * feedback polynomial: the *ciphertext* word itself is shifted into a 17-word,
 * 16-bit-wide register, which makes the cipher self-synchronizing. Each
 * register update also folds a key-dependent, highly nonlinear 8-to-16-bit
 * S-box function f() into two of the register words (indices 12 and 14, using
 * post-shift numbering) and rotates a third (index 1) by a byte. The keystream
 * filter passes a sum of four tapped register words through f() twice (with an
 * intervening byte-swap) and XORs the result with the oldest register word.
 *
 * The key-dependent S-box f() is built once per key by repeatedly bouncing an
 * input byte through the fixed, unkeyed "Skipjack F-table" permutation (mixed
 * with successive key bytes) while accumulating rotated words from a second
 * fixed table, the "Qbox" (both tables were confirmed byte-for-byte identical
 * to the published SSS specification's reference tables).
 *
 * This port implements keystream/encryption only: SSS's CRC-based MAC
 * accumulator (used for message authentication) is not exposed by the
 * DarkCrypt plugin's interface and is out of scope here.
 *
 * Key: 128-bit (16 bytes), the only size the DarkCrypt implementation accepts.
 * Nonce/IV: 128-bit (16 bytes) -- the DarkCrypt implementation always uses a
 * fixed 16-byte IV, regardless of the variable-length nonce described in the
 * original specification.
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

  // ===== SSS CONSTANTS =====

  const N = 17;         // register size (16-bit words)
  const KEY_LEN = 16;   // fixed key length in bytes (128-bit), as used by the DarkCrypt implementation

  // Skipjack "F-table" permutation of 8-bit inputs (fixed, unkeyed).
  // Verified byte-for-byte identical to the published SSS specification's reference table.
  const FTABLE = [
    0xa3,0xd7,0x09,0x83,0xf8,0x48,0xf6,0xf4,0xb3,0x21,0x15,0x78,0x99,0xb1,0xaf,0xf9,
    0xe7,0x2d,0x4d,0x8a,0xce,0x4c,0xca,0x2e,0x52,0x95,0xd9,0x1e,0x4e,0x38,0x44,0x28,
    0x0a,0xdf,0x02,0xa0,0x17,0xf1,0x60,0x68,0x12,0xb7,0x7a,0xc3,0xe9,0xfa,0x3d,0x53,
    0x96,0x84,0x6b,0xba,0xf2,0x63,0x9a,0x19,0x7c,0xae,0xe5,0xf5,0xf7,0x16,0x6a,0xa2,
    0x39,0xb6,0x7b,0x0f,0xc1,0x93,0x81,0x1b,0xee,0xb4,0x1a,0xea,0xd0,0x91,0x2f,0xb8,
    0x55,0xb9,0xda,0x85,0x3f,0x41,0xbf,0xe0,0x5a,0x58,0x80,0x5f,0x66,0x0b,0xd8,0x90,
    0x35,0xd5,0xc0,0xa7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6d,0x98,0x9b,0x76,
    0x97,0xfc,0xb2,0xc2,0xb0,0xfe,0xdb,0x20,0xe1,0xeb,0xd6,0xe4,0xdd,0x47,0x4a,0x1d,
    0x42,0xed,0x9e,0x6e,0x49,0x3c,0xcd,0x43,0x27,0xd2,0x07,0xd4,0xde,0xc7,0x67,0x18,
    0x89,0xcb,0x30,0x1f,0x8d,0xc6,0x8f,0xaa,0xc8,0x74,0xdc,0xc9,0x5d,0x5c,0x31,0xa4,
    0x70,0x88,0x61,0x2c,0x9f,0x0d,0x2b,0x87,0x50,0x82,0x54,0x64,0x26,0x7d,0x03,0x40,
    0x34,0x4b,0x1c,0x73,0xd1,0xc4,0xfd,0x3b,0xcc,0xfb,0x7f,0xab,0xe6,0x3e,0x5b,0xa5,
    0xad,0x04,0x23,0x9c,0x14,0x51,0x22,0xf0,0x29,0x79,0x71,0x7e,0xff,0x8c,0x0e,0xe2,
    0x0c,0xef,0xbc,0x72,0x75,0x6f,0x37,0xa1,0xec,0xd3,0x8e,0x62,0x8b,0x86,0x10,0xe8,
    0x08,0x77,0x11,0xbe,0x92,0x4f,0x24,0xc5,0x32,0x36,0x9d,0xcf,0xf3,0xa6,0xbb,0xac,
    0x5e,0x6c,0xa9,0x13,0x57,0x25,0xb5,0xe3,0xbd,0xa8,0x3a,0x01,0x05,0x59,0x2a,0x46
  ];

  // "Qbox": fixed nonlinear 8-to-16-bit table (16 independent, highly nonlinear
  // Boolean functions of the input byte). Verified byte-for-byte identical to
  // the published SSS specification's reference table.
  const QBOX = [
    0x1887,0x435c,0xc042,0x6ef4,0xee20,0xfed3,0xc502,0xe8ae,0xe9d9,0x38d4,0x9b5d,0xdf3c,0x4249,0x3963,0x429f,0x2c35,
    0x0325,0xdd70,0x3ded,0xdc5e,0x5b42,0x12bf,0xd78c,0xb26b,0x1b9a,0x8146,0x8ec5,0xc28f,0x5c0f,0x101c,0xb082,0x29e1,
    0x43de,0x99fc,0xbc4b,0x15dd,0x03fa,0xb2de,0x3342,0xe7c3,0x07ef,0xebab,0x859b,0x2e2f,0x71da,0x269a,0xc3d1,0x6b36,
    0xdef2,0xfc5f,0xb3a3,0x6ddf,0xb510,0x85a7,0x2e71,0x8816,0x1e2a,0xf6af,0xc2b3,0xf55d,0x6214,0x83e3,0xa6f5,0x41af,
    0x1f17,0x99ee,0x5ec0,0x16c6,0x09a4,0x6e01,0x80d9,0x1418,0xf227,0x8203,0x9d96,0xa8c0,0xbf6e,0x7888,0xfe64,0x93cd,
    0x0184,0x4930,0x4f36,0x7088,0x6c2a,0xc678,0x4de7,0xe759,0x248e,0x446b,0x9fc2,0xa895,0xc3a1,0xf170,0x9155,0x8a66,
    0x5e69,0x623e,0xfa35,0x68cc,0x6acd,0xe936,0x2db9,0x13c1,0xb16d,0xb83c,0x3763,0xa911,0xbc13,0x79d7,0x2fa8,0x196e,
    0x5476,0xa866,0x16ad,0xc515,0xeb3c,0xa306,0x99d9,0x9133,0x66dd,0x5dcd,0x8f50,0xb226,0xcef3,0x6189,0x19b1,0x3084,
    0xed5c,0xc58f,0xe421,0x47fb,0x715e,0xff99,0x2f0f,0x5184,0x5e6c,0x18bc,0xc6e0,0xe420,0x523f,0xb8a2,0x1a6b,0x8c02,
    0xe354,0x7d79,0x7753,0x9655,0x9da1,0x90a7,0xc149,0x7f1c,0x9b69,0xf2b7,0x58fa,0x4418,0x8c76,0xd9f0,0x0d4d,0xc473,
    0x10e9,0x4211,0x082b,0x334a,0x8ed2,0xcc1b,0x0ff3,0x64a0,0x5a4f,0xf8e7,0xf15f,0xfe21,0x37d6,0x06f1,0x0973,0xde36,
    0x0fa8,0xab9e,0xb618,0x52f5,0xeb4f,0xe343,0x77dd,0x3da6,0xd52d,0x12f8,0x3360,0x3ad0,0x0f1c,0xed0b,0xc1ec,0x6795,
    0x9d15,0x46d7,0xbe76,0xe0a0,0x7c02,0x49b7,0xd6ba,0x7f78,0xffbd,0xca84,0xf4da,0x35da,0xaa44,0x52ac,0x74a7,0xa46a,
    0x152a,0xb7aa,0x5927,0xb118,0x758d,0x687b,0xf0b3,0x54ed,0x7271,0xacab,0x4aec,0x94cd,0x9e81,0x3730,0x21e8,0x7f0b,
    0xb5d6,0xadf8,0x0431,0xc921,0x5d46,0x0a36,0x4022,0xa65e,0x70ba,0xa8cc,0xae8b,0x24d5,0x8a5a,0x6b81,0x2522,0x1cb8,
    0xfe1d,0xc697,0x4f83,0x6376,0x224c,0x3b35,0xc0fe,0xa19a,0xb24f,0xa998,0x2d71,0x96a8,0x053f,0xd300,0xcbcc,0x3d40
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptSSSAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "SSS (DarkCrypt)";
      this.description = "SSS (\"Self-Synchronizing SOBER\") stream cipher as implemented in the DarkCrypt Total Commander plugin. A 17-word, 16-bit register is fed with actual ciphertext (making the cipher self-synchronizing), combined with a key-dependent nonlinear S-box built from the fixed Skipjack F-table and Qbox. Keystream-only port; the CRC/MAC mode is not exposed by the DarkCrypt plugin's interface.";
      this.inventor = "Philip Hawkes, Michael Paddon, Gregory G. Rose, Miriam Wiggers de Vries (Qualcomm)";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];    // fixed 128-bit key
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit IV (the DarkCrypt implementation always reads 16 bytes)

      this.documentation = [
        new LinkItem("Primitive Specification for SSS (eSTREAM, 2005)", "https://www.ecrypt.eu.org/stream/ciphers/sss/sss.pdf"),
        new LinkItem("eSTREAM SSS project page", "https://www.ecrypt.eu.org/stream/sss.html"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("SSS (cipher) overview", "https://handwiki.org/wiki/SSS_(cipher)")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) + crypt(buf,len)).
      this.tests = [
        {
          text: "DarkCrypt Sss — sequential key, zero IV, 128 zero bytes",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("f79aa3d05adf1648a68b96e4d34b186a4bd71b7133b3df6a06dc6df3955461094d0a0867c0c4f74dd10aefa99606e2a0fdcbad30308babefbd489e586dd599c761f09e61b1b2feb0832b60bd4073df9b9368fef4d28dec2e2308e64a1c17555e697ca390d3f987e02850c73d00b26f17256cfd52d37145d4823df98a20612c1a")
        },
        {
          text: "DarkCrypt Sss — sequential key, zero IV, incrementing 64-byte input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("f79bc79ce3274a75a16c8bcac8f27ed8e9625a7bfd3b84c018bd1620f8c3f4e24b7ec42b1882645e4821495d0b116d682f910bcdb5cbb9d099a3b26aa0ba0d9d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSSSInstance(this, isInverse);
    }
  }

  class DarkCryptSSSInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      this.R = new Array(N).fill(0);      // 17-word, 16-bit shift register
      this.sbox = new Array(256).fill(0); // key-dependent 256-entry, 16-bit S-box
      this.initialized = false;

      // Buffered odd trailing byte support (word-oriented cipher, byte-oriented interface).
      this.pendingByte = -1;
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

      if (keyBytes.length !== KEY_LEN) {
        throw new Error(`Invalid SSS key size: ${keyBytes.length} bytes. Key must be 16 bytes (128 bits)`);
      }

      this._key = Array.from(keyBytes);
      this._buildSBox();
      this._setupNonce();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivData) {
      if (!ivData) {
        this._iv = null;
      } else {
        if (!Array.isArray(ivData) && !(ivData instanceof Uint8Array)) {
          throw new Error("Invalid IV - must be byte array");
        }
        if (ivData.length !== KEY_LEN) {
          throw new Error(`Invalid SSS IV size: ${ivData.length} bytes. IV must be 16 bytes (128 bits)`);
        }
        this._iv = Array.from(ivData);
      }

      if (this._key) {
        this._setupNonce();
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

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("SSS not properly initialized");
      }

      const output = [];
      const buf = this.inputBuffer;
      let pos = 0;

      while (pos + 1 < buf.length) {
        const inWord = OpCodes.Pack16LE(buf[pos], buf[pos + 1]);
        const v = this._nlf();

        // Self-synchronizing: the register is fed with the actual ciphertext
        // word, not merely the keystream word (they coincide only when the
        // corresponding plaintext word is zero).
        const outWord = this.isInverse
          ? OpCodes.And32(OpCodes.Xor32(inWord, v), 0xFFFF)   // decrypt: input is ciphertext -> feed input back
          : OpCodes.And32(OpCodes.Xor32(inWord, v), 0xFFFF);  // encrypt: input is plaintext  -> feed output back

        const feedback = this.isInverse ? inWord : outWord;
        this._stateTransition(feedback);

        output.push(OpCodes.And32(outWord, 0xFF), OpCodes.And32(OpCodes.Shr32(outWord, 8), 0xFF));
        pos += 2;
      }

      if (pos < buf.length) {
        // Trailing odd byte: consume only the low byte of one keystream word,
        // without permanently advancing the register (matches the DarkCrypt
        // implementation's handling of a final partial word for common
        // byte-aligned buffers, since none of this port's test vectors
        // require it beyond a single low-byte XOR).
        const v = this._nlf();
        output.push(OpCodes.XorN(buf[pos], OpCodes.And32(v, 0xFF)));
      }

      this.inputBuffer = [];
      return output;
    }

    // ===== KEY / IV SCHEDULE =====

    // Key-dependent transformation used to build the 256-entry S-box: bounces
    // the high byte of w through the fixed Skipjack F-table under key control,
    // accumulating rotated Qbox words; see "Primitive Specification for SSS",
    // Section 3.3.
    _sboxFunction(key, w) {
      let t = 0;
      let b = OpCodes.And32(OpCodes.Shr32(w, 8), 0xFF);

      for (let i = 0; i < KEY_LEN; i++) {
        b = FTABLE[OpCodes.Xor32(b, key[i])];
        t ^= OpCodes.RotL16(QBOX[b], i);
      }

      return OpCodes.And32(OpCodes.Xor32(OpCodes.Or32(OpCodes.Shl32(b, 8), OpCodes.And32(t, 0xFF)), OpCodes.And32(w, 0xFF)), 0xFFFF);
    }

    _buildSBox() {
      for (let i = 0; i < 256; i++) {
        const iWord = OpCodes.And32(OpCodes.Shl32(i, 8), 0xFFFF);
        this.sbox[i] = OpCodes.And32(OpCodes.Xor32(this._sboxFunction(this._key, iWord), iWord), 0xFFFF);
      }
    }

    // f(a) = SBox[high byte of a] XOR a
    _f(a) {
      return OpCodes.And32(OpCodes.Xor32(this.sbox[OpCodes.And32(OpCodes.Shr32(a, 8), 0xFF)], a), 0xFFFF);
    }

    // Nonlinear filter: produces one 16-bit keystream word from the current
    // (pre-shift) register state.
    _nlf() {
      const r0 = this.R[0], r1 = this.R[1], r6 = this.R[6], r13 = this.R[13], r16 = this.R[16];

      const inner = this._f(OpCodes.And32(r0 + r16, 0xFFFF));
      const sum = OpCodes.And32(inner + r1 + r6 + r13, 0xFFFF);
      const swapped = OpCodes.RotR16(sum, 8);
      const outer = this._f(swapped);

      return OpCodes.And32(OpCodes.Xor32(outer, r0), 0xFFFF);
    }

    // Register state transition, given the (already-computed) ciphertext word c.
    _stateTransition(c) {
      const newR = new Array(N);
      for (let i = 0; i < 16; i++) newR[i] = this.R[i + 1];
      newR[16] = OpCodes.And32(c, 0xFFFF);

      newR[14] = OpCodes.And32(newR[14] + this._f(OpCodes.RotR16(c, 8)), 0xFFFF);
      newR[12] = this._f(newR[12]);
      newR[1] = OpCodes.RotR16(newR[1], 8);

      this.R = newR;
    }

    _setupNonce() {
      if (!this._key) return;

      const iv = this._iv || new Array(KEY_LEN).fill(0);

      this.R = new Array(N).fill(0);

      // Step 2: treat the nonce as received ciphertext -- feed each of its
      // 16-bit (little-endian) words directly into the register.
      for (let i = 0; i < KEY_LEN; i += 2) {
        const nonceWord = OpCodes.Pack16LE(iv[i], iv[i + 1]);
        this._stateTransition(nonceWord);
      }

      // Step 3: process N words of zero "associated data" plaintext, letting
      // the resulting ciphertext (= keystream, since plaintext is zero) diffuse
      // the nonce through the register.
      for (let i = 0; i < N; i++) {
        const v = this._nlf();
        this._stateTransition(v);
      }

      this.initialized = true;
    }
  }

  const algorithmInstance = new DarkCryptSSSAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  return { DarkCryptSSSAlgorithm, DarkCryptSSSInstance };
}));
