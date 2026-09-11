/*
 * Tiaoxin-346 Authenticated Encryption with Associated Data (AEAD)
 * CAESAR Competition Third Round Candidate (High Performance Category)
 * Professional implementation following CAESAR submission specification
 * (c)2006-2025 Hawkynt
 *
 * Tiaoxin-346 is a high-performance authenticated encryption algorithm designed by
 * Ivica Nikolić and submitted to the CAESAR competition. It uses AES round functions
 * and achieves excellent software performance (6 AES rounds per 32-byte message).
 *
 * Algorithm Structure:
 * - State: Three registers T3, T4, T6 containing 3, 4, and 6 words (128-bit each)
 * - Key: 128 bits
 * - Nonce (IV): 128 bits
 * - Tag: 128 bits
 * - Based on AES round function for security and efficiency
 *
 * This follows Tiaoxin v2, which differs from v1 only in the finalization
 * length encoding: the v1 reference C shifts a 64-bit length by up to 120 bits,
 * which is undefined behaviour and makes its tags compiler-dependent.
 *
 * Reference: https://competitions.cr.yp.to/round3/tiaoxinv21.pdf
 * Round 2 specification: https://competitions.cr.yp.to/round2/tiaoxinv2.pdf
 * SUPERCOP: https://github.com/floodyberry/supercop/tree/master/crypto_aead/tiaoxinv2
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Tiaoxin-346 constants (from SUPERCOP reference implementation)
  const Z0 = new Uint8Array([
    0x42, 0x8a, 0x2f, 0x98, 0xd7, 0x28, 0xae, 0x22,
    0x71, 0x37, 0x44, 0x91, 0x23, 0xef, 0x65, 0xcd
  ]);

  const Z1 = new Uint8Array([
    0xb5, 0xc0, 0xfb, 0xcf, 0xec, 0x4d, 0x3b, 0x2f,
    0xe9, 0xb5, 0xdb, 0xa5, 0x81, 0x89, 0xdb, 0xbc
  ]);

  // AES S-box (Rijndael S-box)
  const SBOX = new Uint8Array([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ]);

  // AES round function: SubBytes + ShiftRows + MixColumns
  function aesRound(state) {
    // SubBytes
    for (let i = 0; i < 16; ++i) {
      state[i] = SBOX[state[i]];
    }

    // ShiftRows
    let temp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = temp;

    temp = state[2];
    let temp2 = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = temp;
    state[14] = temp2;

    temp = state[3];
    state[3] = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = temp;

    // MixColumns (using GF(256) multiplication)
    for (let col = 0; col < 4; ++col) {
      const base = col * 4;
      const s0 = state[base];
      const s1 = state[base + 1];
      const s2 = state[base + 2];
      const s3 = state[base + 3];

      state[base] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.GF256Mul(s0, 2), OpCodes.GF256Mul(s1, 3)), s2), s3), 0xff);
      state[base + 1] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, OpCodes.GF256Mul(s1, 2)), OpCodes.GF256Mul(s2, 3)), s3), 0xff);
      state[base + 2] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(s0, s1), OpCodes.GF256Mul(s2, 2)), OpCodes.GF256Mul(s3, 3)), 0xff);
      state[base + 3] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.GF256Mul(s0, 3), s1), s2), OpCodes.GF256Mul(s3, 2)), 0xff);
    }
  }

  // XOR two 16-byte words
  function xorWords(dest, src) {
    for (let i = 0; i < 16; ++i) {
      dest[i] ^= src[i];
    }
  }

  // AND two 16-byte words
  function andWords(dest, src) {
    for (let i = 0; i < 16; ++i) {
      dest[i] &= src[i];
    }
  }

  // Copy 16-byte word
  function copyWord(dest, src) {
    for (let i = 0; i < 16; ++i) {
      dest[i] = src[i];
    }
  }

  class TiaoxinAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Tiaoxin-346";
      this.description = "High-performance authenticated encryption from CAESAR competition third round using AES round functions. Designed for exceptional software speed with 6 AES rounds per 32-byte message block.";
      this.inventor = "Ivica Nikolić";
      this.year = 2014;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)]; // 128-bit key
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)]; // 128-bit nonce
      this.SupportedTagSizes = [new KeySize(16, 16, 0)]; // 128-bit tag
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("CAESAR Round 3 Submission (v2.1)", "https://competitions.cr.yp.to/round3/tiaoxinv21.pdf"),
        new LinkItem("CAESAR Round 2 Submission (v2)", "https://competitions.cr.yp.to/round2/tiaoxinv2.pdf"),
        new LinkItem("CAESAR Competition", "https://competitions.cr.yp.to/caesar.html"),
        new LinkItem("SUPERCOP Reference Implementation", "https://github.com/floodyberry/supercop/tree/master/crypto_aead/tiaoxinv2")
      ];

      this.references = [
        new LinkItem("Tiaoxin-346 Specification (PDF)", "https://competitions.cr.yp.to/round3/tiaoxinv21.pdf"),
        new LinkItem("GMU CAESAR Hardware API Implementation and KAT", "https://cryptography.gmu.edu/athena/index.php?id=CAESAR_source_codes"),
        new LinkItem("Weak Keys in Reduced AEGIS and Tiaoxin", "https://eprint.iacr.org/2021/187"),
        new LinkItem("Differential Fault Analysis on Tiaoxin", "https://link.springer.com/chapter/10.1007/978-981-10-2738-3_7")
      ];

      // Published test vectors. The CAESAR submission PDFs carry no test
      // vectors and SUPERCOP ships neither a KAT file nor a checksum for
      // tiaoxin, so these come from George Mason University's CAESAR Hardware
      // API implementation of Tiaoxin, whose KAT was produced by the reference
      // software (aeadtvgen, lib_name = tiaoxinv2, --verify_lib).
      //
      // Note that the round-1 reference C is undefined behaviour in its length
      // encoding - it shifts a 64-bit value by up to 120 bits - so its tags are
      // compiler-dependent. Round 2 corrected exactly that and nothing else;
      // these vectors follow the corrected version.
      const KAT_URI = "https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip";
      this.tests = [
        {
          text: "GMU CAESAR-HW KAT Msg 1 (empty message, empty associated data)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("545B6287D143ACBF33DAAA2D5CCB873E")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 3 (empty message, 1-byte associated data)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes("A0"),
          expected: OpCodes.Hex8ToBytes("4BC1849C85E902F65224933CD6125FC1")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 5 (1-byte message, empty associated data)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("FF"),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("D7B9F3B2A47B6742C58C5F5F26EF7CD03F")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 7 (1-byte message, 1-byte associated data)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("FF"),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes("A0"),
          expected: OpCodes.Hex8ToBytes("6D8A5DC084AAEDAAA02A9E1AC1B01358F0")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 9 (32-byte message and associated data, one full block each)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("FF000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E"),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes("A0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          expected: OpCodes.Hex8ToBytes("0C5B778E763ACA8126FF3D98B7CCB94F7769171A48987FB3FB99B92078DBBEF6A210F4C82B0447EF3658AF76AB95CBE4")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 11 (31-byte message and associated data, short final block)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("FF000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D"),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes("A0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBE"),
          expected: OpCodes.Hex8ToBytes("386F2BE6763ACA8126FF3D98B7CCB94F7769171A48987FB3FB99B92078DBBEF167FC2F34EFF54580C613A9BC4C713A")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 13 (33-byte message and associated data, one byte into a second block)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("FF000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          key: OpCodes.Hex8ToBytes("55565758595A5B5C5D5E5F6061626364"),
          nonce: OpCodes.Hex8ToBytes("B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF"),
          associatedData: OpCodes.Hex8ToBytes("A0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0"),
          expected: OpCodes.Hex8ToBytes("2F585296FF34D59A11D1198C26E7915550AB52448079C91D46CCCFE447CBEC7B7843737FBA1AE66D79A9E3FCC191FFB80B")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 21 (128-byte message, 52-byte associated data)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("CE576F8A005CB3367D831209FFC6905E816BF94A589189FB7D0CEE78EFD815A2B03B0179D0D4BDC6881BDA1BC22FA580AD78C25A2404A381D43A1BA2A8D70BBC3F582404FE4082638DE999B8F665A538573EACD1856C1D1E598ADA322FBD9BDB590BAF23223E0ED17D08E62098F78FD9"),
          key: OpCodes.Hex8ToBytes("51FCC64D3726F9F74AB70E62CD59C740"),
          nonce: OpCodes.Hex8ToBytes("A2CD65E40ED8FB93DAFF1DC45A12A945"),
          associatedData: OpCodes.Hex8ToBytes("11CF345B2643021B701CEAC02BCE1EA121325B8798DC017094387B764B82E67CD32A98554289F0BD30F6A6A87EDB7BA4B11DB2F5"),
          expected: OpCodes.Hex8ToBytes("66FC0642A34E76E2A70F4A3D3EA4A52C9A3D97124579A577924F8CC12D1859EB01E035C018B5D8ACE80FDD7D061727CBB8ADDF9C98A10AD5F19398C5EB43393FD31A8BDCC912AB7916187BE381191DA5DA1677209AF50E878141B699AB618DF3A89B24FB9E9AB8BEB33368A88917F30C852A22DDB263859456968B1822CA4996")
        },
        {
          text: "GMU CAESAR-HW KAT Msg 24 (1-byte message, 111-byte associated data)",
          uri: KAT_URI,
          input: OpCodes.Hex8ToBytes("9D"),
          key: OpCodes.Hex8ToBytes("0A673F78117BA9397650ACCED8B5907B"),
          nonce: OpCodes.Hex8ToBytes("CB7977680D4CC7236ECF52F29A987FF1"),
          associatedData: OpCodes.Hex8ToBytes("814D6A9274D508DB708000A961A391FFEB25D9C65507084BC383CC4B81429D08532769C8C6BF2C84E7C7040679119D8F1DD1257C8604712C51B28B9FE6D3A426F4A938B3E474BC7817B56AF98E180432FA835E5F469112220910487262B575729744B11FA2D823FFA2FE0F17E08A95"),
          expected: OpCodes.Hex8ToBytes("B57B2E6BD87B95AEC1D3D8277C9D69CB06")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TiaoxinInstance(this, isInverse);
    }
  }

  /**
 * Tiaoxin cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TiaoxinInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // State: T3 (3 words), T4 (4 words), T6 (6 words)
      this.T3 = Array.from({ length: 3 }, () => new Uint8Array(16));
      this.T4 = Array.from({ length: 4 }, () => new Uint8Array(16));
      this.T6 = Array.from({ length: 6 }, () => new Uint8Array(16));

      this._key = null;
      this._nonce = null;
      this._ad = [];
      this._data = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16)");
      }
      this._key = new Uint8Array(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? Array.from(this._key) : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (must be 16)");
      }
      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() { return this._nonce ? Array.from(this._nonce) : null; }

    set associatedData(adBytes) {
      if (!adBytes) {
        this._ad = [];
        return;
      }
      this._ad = Array.from(adBytes);
    }

    get associatedData() { return [...this._ad]; }

    // Tiaoxin round update R(T, M) for a register T of s words:
    //
    //   T'[0] = AES(T[s-1], T[0]) XOR M   one AES round on the oldest word,
    //                                     keyed with the current newest word
    //   T'[1] = AES(T[0], Z0)             one AES round on the newest word,
    //                                     keyed with the constant Z0
    //   T'[i] = T[i-1]  for i >= 2        the rest of the register shifts along
    //
    // where AES(X, SK) is MixColumns(ShiftRows(SubBytes(X))) XOR SK. Index 0
    // holds the newest word and index s-1 the oldest. Every right-hand side
    // reads the pre-update register, so the two new words are computed before
    // anything is stored and the shift runs downwards from the far end.
    //
    // M is the only place the message enters the state, and it enters exactly
    // one word per register - which is why all three of M0, M1 and M2 have to
    // be carried through, and why dropping any of them would leave that part of
    // the message out of the tag.
    _round(T, M) {
      const s = T.length;

      const w0 = new Uint8Array(16);
      copyWord(w0, T[s - 1]);
      aesRound(w0);
      xorWords(w0, T[0]);
      xorWords(w0, M);

      const w1 = new Uint8Array(16);
      copyWord(w1, T[0]);
      aesRound(w1);
      xorWords(w1, Z0);

      for (let i = s - 1; i >= 2; --i) {
        copyWord(T[i], T[i - 1]);
      }
      copyWord(T[1], w1);
      copyWord(T[0], w0);
    }

    // Tiaoxin Update transformation: the three registers advance in parallel,
    // each absorbing its own message word.
    _update(M0, M1, M2) {
      this._round(this.T3, M0);
      this._round(this.T4, M1);
      this._round(this.T6, M2);
    }

    // The two 128-bit words the state exposes after an Update. On encryption
    // these are the ciphertext words directly, because the plaintext has
    // already been folded into T3[0], T4[0] and T6[0] by the Update. On
    // decryption the same two expressions are recovered from a zero Update and
    // XORed with the ciphertext to give the plaintext back.
    _extract() {
      const e0 = new Uint8Array(16);
      copyWord(e0, this.T6[3]);
      andWords(e0, this.T4[3]);
      xorWords(e0, this.T3[0]);
      xorWords(e0, this.T3[2]);
      xorWords(e0, this.T4[1]);

      const e1 = new Uint8Array(16);
      copyWord(e1, this.T6[5]);
      andWords(e1, this.T3[2]);
      xorWords(e1, this.T6[0]);
      xorWords(e1, this.T4[2]);
      xorWords(e1, this.T3[1]);

      return [e0, e1];
    }

    // Initialize state with key and nonce
    _initialize() {
      if (!this._key || !this._nonce) {
        throw new Error("Key and nonce must be set");
      }

      // Initialize T3: [K, K, IV]
      copyWord(this.T3[0], this._key);
      copyWord(this.T3[1], this._key);
      copyWord(this.T3[2], this._nonce);

      // Initialize T4: [K, K, IV, Z0]
      copyWord(this.T4[0], this._key);
      copyWord(this.T4[1], this._key);
      copyWord(this.T4[2], this._nonce);
      copyWord(this.T4[3], Z0);

      // Initialize T6: [K, K, IV, Z1, 0, 0]
      copyWord(this.T6[0], this._key);
      copyWord(this.T6[1], this._key);
      copyWord(this.T6[2], this._nonce);
      copyWord(this.T6[3], Z1);
      this.T6[4].fill(0);
      this.T6[5].fill(0);

      // Run 15 initialization rounds with constants
      for (let i = 0; i < 15; ++i) {
        this._update(Z0, Z1, Z0);
      }
    }

    // Split a byte array into the two 128-bit words of the block starting at
    // pos, zero-padding anything past the end of the data.
    _blockWords(data, pos) {
      const w0 = new Uint8Array(16);
      const w1 = new Uint8Array(16);
      for (let i = 0; i < 16; ++i) {
        const a = pos + i;
        if (a < data.length) w0[i] = data[a];
        const b = pos + 16 + i;
        if (b < data.length) w1[i] = data[b];
      }
      return [w0, w1];
    }

    // Process associated data: 32 bytes per Update, zero-padded, with the third
    // message word the XOR of the other two. An empty associated data string is
    // not processed at all.
    _processAD() {
      const ad = this._ad;
      for (let pos = 0; pos < ad.length; pos += 32) {
        const [A0, A1] = this._blockWords(ad, pos);
        const A2 = new Uint8Array(16);
        copyWord(A2, A0);
        xorWords(A2, A1);
        this._update(A0, A1, A2);
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this._data.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      this._initialize();
      this._processAD();

      if (this.isInverse) {
        // Decryption: Last 16 bytes are the tag
        if (this._data.length < 16) {
          throw new Error("Ciphertext must include 16-byte tag");
        }

        const ctLength = this._data.length - 16;
        const ciphertext = this._data.slice(0, ctLength);
        const receivedTag = this._data.slice(ctLength);

        const plaintext = [];
        const zeroWord = new Uint8Array(16);

        // Decrypt message blocks. The message enters the state only through the
        // M word of each register update, and it enters linearly, so running the
        // update with a zero message and then XORing the recovered plaintext
        // into word 0 of each register lands on exactly the state the encryptor
        // reached with Update(M0, M1, M0 XOR M1).
        for (let pos = 0; pos < ciphertext.length; pos += 32) {
          const [C0, C1] = this._blockWords(ciphertext, pos);
          const remaining = ciphertext.length - pos;

          this._update(zeroWord, zeroWord, zeroWord);
          const [e0, e1] = this._extract();

          const M0 = new Uint8Array(16);
          copyWord(M0, C0);
          xorWords(M0, e0);

          const M1 = new Uint8Array(16);
          copyWord(M1, C1);
          xorWords(M1, e1);
          xorWords(M1, M0);

          // A short final block was zero-padded before it was absorbed, so the
          // bytes past the end of the real ciphertext have to be forced back to
          // zero before absorbing; they decrypted to whatever the padding gave.
          for (let i = remaining; i < 16; ++i) M0[i] = 0;
          for (let i = remaining - 16; i < 16; ++i) if (i >= 0) M1[i] = 0;

          for (let i = 0; i < 16 && pos + i < ciphertext.length; ++i) plaintext.push(M0[i]);
          for (let i = 0; i < 16 && pos + 16 + i < ciphertext.length; ++i) plaintext.push(M1[i]);

          const M2 = new Uint8Array(16);
          copyWord(M2, M0);
          xorWords(M2, M1);
          xorWords(this.T3[0], M0);
          xorWords(this.T4[0], M1);
          xorWords(this.T6[0], M2);
        }

        // Finalize and verify tag
        const tag = this._finalize(this._ad.length, ciphertext.length);

        this._data = [];

        if (!OpCodes.SecureCompare(tag, receivedTag)) {
          throw new Error("Authentication tag verification failed");
        }

        return plaintext;

      } else {
        // Encryption
        const plaintext = this._data;
        const ciphertext = [];

        // Encrypt message blocks. A short final block is zero-padded and still
        // absorbed by a full Update - only the ciphertext written out is cut
        // back to the real length. Leaving the tail block out of the state
        // would leave the whole of a sub-block message unauthenticated.
        for (let pos = 0; pos < plaintext.length; pos += 32) {
          const [M0, M1] = this._blockWords(plaintext, pos);
          const M2 = new Uint8Array(16);
          copyWord(M2, M0);
          xorWords(M2, M1);

          this._update(M0, M1, M2);

          // After the update the plaintext is already folded into the state, so
          // the two extracted words are the ciphertext themselves.
          const [C0, C1] = this._extract();
          for (let i = 0; i < 16 && pos + i < plaintext.length; ++i) ciphertext.push(C0[i]);
          for (let i = 0; i < 16 && pos + 16 + i < plaintext.length; ++i) ciphertext.push(C1[i]);
        }

        // Finalize and generate tag
        const tag = this._finalize(this._ad.length, plaintext.length);
        for (let _i = 0; _i < tag.length; _i++) ciphertext.push(tag[_i]);

        this._data = [];
        return ciphertext;
      }
    }

    // Encode a length as a Tiaoxin length word: eight zero bytes followed by the
    // count of BYTES as a 64-bit big-endian integer. The paper writes |A| and
    // |M| as bit counts, but the reference code and the published test vectors
    // both use byte counts, and only the byte reading reproduces them.
    _lengthWord(count) {
      const word = new Uint8Array(16);
      let value = count;
      for (let i = 15; i >= 8; --i) {
        word[i] = OpCodes.AndN(value, 0xff);
        value = Math.floor(value / 256);
      }
      return word;
    }

    // Finalization: Generate authentication tag
    _finalize(adLen, msgLen) {
      // Absorb the two lengths, then run 20 rounds on the constants
      const lenBlock0 = this._lengthWord(adLen);
      const lenBlock1 = this._lengthWord(msgLen);
      const lenBlock2 = new Uint8Array(16);
      copyWord(lenBlock2, lenBlock0);
      xorWords(lenBlock2, lenBlock1);

      this._update(lenBlock0, lenBlock1, lenBlock2);

      for (let i = 0; i < 20; ++i) {
        this._update(Z1, Z0, Z1);
      }

      // Generate 16-byte tag from all state words
      const tag = new Uint8Array(16);
      copyWord(tag, this.T3[0]);
      xorWords(tag, this.T3[1]);
      xorWords(tag, this.T3[2]);
      xorWords(tag, this.T4[0]);
      xorWords(tag, this.T4[1]);
      xorWords(tag, this.T4[2]);
      xorWords(tag, this.T4[3]);
      xorWords(tag, this.T6[0]);
      xorWords(tag, this.T6[1]);
      xorWords(tag, this.T6[2]);
      xorWords(tag, this.T6[3]);
      xorWords(tag, this.T6[4]);
      xorWords(tag, this.T6[5]);

      return Array.from(tag);
    }
  }

  // Register algorithm immediately
  RegisterAlgorithm(new TiaoxinAlgorithm());

  return { TiaoxinAlgorithm, TiaoxinInstance };
}));
