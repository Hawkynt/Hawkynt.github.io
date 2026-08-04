/*
 * CLEFIA Block Cipher - RFC 6114 Compliant Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Based on RFC 6114: The 128-Bit Blockcipher CLEFIA
 * Sony Corporation specification
 * Production-ready implementation matching official test vectors
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
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // S-Box S0 from RFC 6114 Table 1
  const S0 = Object.freeze([
    0x57, 0x49, 0xd1, 0xc6, 0x2f, 0x33, 0x74, 0xfb, 0x95, 0x6d, 0x82, 0xea, 0x0e, 0xb0, 0xa8, 0x1c,
    0x28, 0xd0, 0x4b, 0x92, 0x5c, 0xee, 0x85, 0xb1, 0xc4, 0x0a, 0x76, 0x3d, 0x63, 0xf9, 0x17, 0xaf,
    0xbf, 0xa1, 0x19, 0x65, 0xf7, 0x7a, 0x32, 0x20, 0x06, 0xce, 0xe4, 0x83, 0x9d, 0x5b, 0x4c, 0xd8,
    0x42, 0x5d, 0x2e, 0xe8, 0xd4, 0x9b, 0x0f, 0x13, 0x3c, 0x89, 0x67, 0xc0, 0x71, 0xaa, 0xb6, 0xf5,
    0xa4, 0xbe, 0xfd, 0x8c, 0x12, 0x00, 0x97, 0xda, 0x78, 0xe1, 0xcf, 0x6b, 0x39, 0x43, 0x55, 0x26,
    0x30, 0x98, 0xcc, 0xdd, 0xeb, 0x54, 0xb3, 0x8f, 0x4e, 0x16, 0xfa, 0x22, 0xa5, 0x77, 0x09, 0x61,
    0xd6, 0x2a, 0x53, 0x37, 0x45, 0xc1, 0x6c, 0xae, 0xef, 0x70, 0x08, 0x99, 0x8b, 0x1d, 0xf2, 0xb4,
    0xe9, 0xc7, 0x9f, 0x4a, 0x31, 0x25, 0xfe, 0x7c, 0xd3, 0xa2, 0xbd, 0x56, 0x14, 0x88, 0x60, 0x0b,
    0xcd, 0xe2, 0x34, 0x50, 0x9e, 0xdc, 0x11, 0x05, 0x2b, 0xb7, 0xa9, 0x48, 0xff, 0x66, 0x8a, 0x73,
    0x03, 0x75, 0x86, 0xf1, 0x6a, 0xa7, 0x40, 0xc2, 0xb9, 0x2c, 0xdb, 0x1f, 0x58, 0x94, 0x3e, 0xed,
    0xfc, 0x1b, 0xa0, 0x04, 0xb8, 0x8d, 0xe6, 0x59, 0x62, 0x93, 0x35, 0x7e, 0xca, 0x21, 0xdf, 0x47,
    0x15, 0xf3, 0xba, 0x7f, 0xa6, 0x69, 0xc8, 0x4d, 0x87, 0x3b, 0x9c, 0x01, 0xe0, 0xde, 0x24, 0x52,
    0x7b, 0x0c, 0x68, 0x1e, 0x80, 0xb2, 0x5a, 0xe7, 0xad, 0xd5, 0x23, 0xf4, 0x46, 0x3f, 0x91, 0xc9,
    0x6e, 0x84, 0x72, 0xbb, 0x0d, 0x18, 0xd9, 0x96, 0xf0, 0x5f, 0x41, 0xac, 0x27, 0xc5, 0xe3, 0x3a,
    0x81, 0x6f, 0x07, 0xa3, 0x79, 0xf6, 0x2d, 0x38, 0x1a, 0x44, 0x5e, 0xb5, 0xd2, 0xec, 0xcb, 0x90,
    0x9a, 0x36, 0xe5, 0x29, 0xc3, 0x4f, 0xab, 0x64, 0x51, 0xf8, 0x10, 0xd7, 0xbc, 0x02, 0x7d, 0x8e
  ]);

  // S-Box S1 from RFC 6114 Table 2
  const S1 = Object.freeze([
    0x6c, 0xda, 0xc3, 0xe9, 0x4e, 0x9d, 0x0a, 0x3d, 0xb8, 0x36, 0xb4, 0x38, 0x13, 0x34, 0x0c, 0xd9,
    0xbf, 0x74, 0x94, 0x8f, 0xb7, 0x9c, 0xe5, 0xdc, 0x9e, 0x07, 0x49, 0x4f, 0x98, 0x2c, 0xb0, 0x93,
    0x12, 0xeb, 0xcd, 0xb3, 0x92, 0xe7, 0x41, 0x60, 0xe3, 0x21, 0x27, 0x3b, 0xe6, 0x19, 0xd2, 0x0e,
    0x91, 0x11, 0xc7, 0x3f, 0x2a, 0x8e, 0xa1, 0xbc, 0x2b, 0xc8, 0xc5, 0x0f, 0x5b, 0xf3, 0x87, 0x8b,
    0xfb, 0xf5, 0xde, 0x20, 0xc6, 0xa7, 0x84, 0xce, 0xd8, 0x65, 0x51, 0xc9, 0xa4, 0xef, 0x43, 0x53,
    0x25, 0x5d, 0x9b, 0x31, 0xe8, 0x3e, 0x0d, 0xd7, 0x80, 0xff, 0x69, 0x8a, 0xba, 0x0b, 0x73, 0x5c,
    0x6e, 0x54, 0x15, 0x62, 0xf6, 0x35, 0x30, 0x52, 0xa3, 0x16, 0xd3, 0x28, 0x32, 0xfa, 0xaa, 0x5e,
    0xcf, 0xea, 0xed, 0x78, 0x33, 0x58, 0x09, 0x7b, 0x63, 0xc0, 0xc1, 0x46, 0x1e, 0xdf, 0xa9, 0x99,
    0x55, 0x04, 0xc4, 0x86, 0x39, 0x77, 0x82, 0xec, 0x40, 0x18, 0x90, 0x97, 0x59, 0xdd, 0x83, 0x1f,
    0x9a, 0x37, 0x06, 0x24, 0x64, 0x7c, 0xa5, 0x56, 0x48, 0x08, 0x85, 0xd0, 0x61, 0x26, 0xca, 0x6f,
    0x7e, 0x6a, 0xb6, 0x71, 0xa0, 0x70, 0x05, 0xd1, 0x45, 0x8c, 0x23, 0x1c, 0xf0, 0xee, 0x89, 0xad,
    0x7a, 0x4b, 0xc2, 0x2f, 0xdb, 0x5a, 0x4d, 0x76, 0x67, 0x17, 0x2d, 0xf4, 0xcb, 0xb1, 0x4a, 0xa8,
    0xb5, 0x22, 0x47, 0x3a, 0xd5, 0x10, 0x4c, 0x72, 0xcc, 0x00, 0xf9, 0xe0, 0xfd, 0xe2, 0xfe, 0xae,
    0xf8, 0x5f, 0xab, 0xf1, 0x1b, 0x42, 0x81, 0xd6, 0xbe, 0x44, 0x29, 0xa6, 0x57, 0xb9, 0xaf, 0xf2,
    0xd4, 0x75, 0x66, 0xbb, 0x68, 0x9f, 0x50, 0x02, 0x01, 0x3c, 0x7f, 0x8d, 0x1a, 0x88, 0xbd, 0xac,
    0xf7, 0xe4, 0x79, 0x96, 0xa2, 0xfc, 0x6d, 0xb2, 0x6b, 0x03, 0xe1, 0x2e, 0x7d, 0x14, 0x95, 0x1d
  ]);

  // CON constant generation - RFC 6114 Section 6.6
  // P(16) = 0xb7e1 (fractional part of e-2), Q(16) = 0x243f (fractional part of pi-3)
  // T_k[i] evolves in GF(2^16) defined by the primitive polynomial
  // z^16 + z^15 + z^13 + z^11 + z^5 + z^4 + 1 (0x1a831); each step multiplies
  // by the multiplicative inverse of z (division by 2 in the field).
  const CON_P16 = 0xb7e1;
  const CON_Q16 = 0x243f;

  // Divide a GF(2^16) element by z (multiply by the inverse of 2) under the
  // CLEFIA constant-generation polynomial: reduce with the low 16 bits of the
  // primitive polynomial (0xa831) whenever the constant term is set.
  function gf16DivZ(t) {
    return OpCodes.AndN(t, 1) ? OpCodes.OrN(OpCodes.Shr16(OpCodes.XorN(t, 0xa831), 1), 0x8000) : OpCodes.Shr16(t, 1);
  }

  // Generate `count` pairs of 32-bit CON words from the given 16-bit IV,
  // per RFC 6114 Section 6.6 (Table 4-9 lists the resulting constants).
  function generateCON(iv, count) {
    const con = new Array(count * 2);
    let t = OpCodes.AndN(iv, 0xFFFF);
    for (let i = 0; i < count; i++) {
      const notT = OpCodes.AndN(OpCodes.XorN(t, 0xFFFF), 0xFFFF);
      const hi0 = OpCodes.AndN(OpCodes.XorN(t, CON_P16), 0xFFFF);
      const lo0 = OpCodes.RotL16(notT, 1);
      const hi1 = OpCodes.AndN(OpCodes.XorN(notT, CON_Q16), 0xFFFF);
      const lo1 = OpCodes.RotL16(t, 8);
      con[i * 2] = OpCodes.Or32(OpCodes.Shl32(hi0, 16), lo0);
      con[i * 2 + 1] = OpCodes.Or32(OpCodes.Shl32(hi1, 16), lo1);
      t = gf16DivZ(t);
    }
    return con;
  }

  // CON_128/192/256 - RFC 6114 Appendix C (Tables 7-9), generated rather than
  // hardcoded so the constants are provably derived from the spec algorithm.
  const CON_128 = Object.freeze(generateCON(0x428a, 30));
  const CON_192 = Object.freeze(generateCON(0x7137, 42));
  const CON_256 = Object.freeze(generateCON(0xb5c0, 46));

  // CLEFIA-specific GF(2^8) multiplication
  // Uses irreducible polynomial z^8 + z^4 + z^3 + z^2 + 1 (0x1d)
  // This is different from AES which uses 0x1b
  function gfMul(a, b) {
    let result = 0;
    a &= 0xFF;
    b &= 0xFF;

    for (let i = 0; i < 8; i++) {
      if (OpCodes.AndN(b, 1)) {
        result = OpCodes.XorN(result, a);
      }

      const highBit = OpCodes.AndN(a, 0x80);
      a = OpCodes.AndN(OpCodes.Shl8(a, 1), 0xFF);
      if (highBit) {
        a = OpCodes.XorN(a, 0x1D); // CLEFIA polynomial: z^8 + z^4 + z^3 + z^2 + 1
      }

      b = OpCodes.Shr8(b, 1);
    }

    return OpCodes.AndN(result, 0xFF);
  }

  /**
 * CLEFIAAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class CLEFIAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "CLEFIA";
      this.description = "Sony's CLEFIA block cipher (RFC 6114) with 128-bit blocks and variable key lengths. Generalized Feistel Network design optimized for lightweight implementations.";
      this.inventor = "Sony Corporation";
      this.year = 2007;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(16, 32, 8)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];

      this.documentation = [
        new LinkItem("RFC 6114: The 128-Bit Blockcipher CLEFIA", "https://www.rfc-editor.org/rfc/rfc6114.html"),
        new LinkItem("ISO/IEC 29192-2:2012", "https://www.iso.org/standard/56552.html")
      ];

      this.references = [
        new LinkItem("Sony CLEFIA Reference Code (clefia_ref.c)", "https://www.sony.net/Products/cryptography/clefia/download/data/clefia_ref.c"),
        new LinkItem("go-clefia (port of Sony reference C code)", "https://github.com/dgryski/go-clefia")
      ];

      this.tests = [
        {
          text: "DarkCrypt CLEFIA vector 1/zero",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c75294761d52fb97ab7955d877164213")
        },
        {
          text: "DarkCrypt CLEFIA vector 2/incr",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("3a92f62a3f938146d9ca6303f5b3d790")
        },
        {
          text: "DarkCrypt CLEFIA vector 3/incr2",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("eee2469ffc539734e5f93330cc6d8523")
        },

        {
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100"),
          expected: OpCodes.Hex8ToBytes("de2bf2fd9b74aacdf1298555459494fd"),
          text: "RFC 6114 Appendix A - CLEFIA-128 test vector",
          uri: "https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A"
        },
        {
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100f0e0d0c0b0a09080"),
          expected: OpCodes.Hex8ToBytes("e2482f649f028dc480dda184fde181ad"),
          text: "RFC 6114 Appendix A - CLEFIA-192 test vector",
          uri: "https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A"
        },
        {
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100f0e0d0c0b0a090807060504030201000"),
          expected: OpCodes.Hex8ToBytes("a1397814289de80c10da46d1fa48b38a"),
          text: "RFC 6114 Appendix A - CLEFIA-256 test vector",
          uri: "https://www.rfc-editor.org/rfc/rfc6114.html#appendix-A"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CLEFIAInstance(this, isInverse);
    }
  }

  /**
 * CLEFIA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CLEFIAInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.rk = null;
        this.wk = null;
        return;
      }

      if (![16, 24, 32].includes(keyBytes.length)) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._setupKey();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("Input length must be multiple of 16 bytes");
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        const result = this.isInverse ? this._decrypt(block) : this._encrypt(block);
        for (let _i = 0; _i < result.length; _i++) output.push(result[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    _setupKey() {
      const keyLen = this._key.length;
      if (keyLen === 16) {
        this._setupKey128();
      } else {
        this._setupKey192Or256(keyLen);
      }
    }

    // 128-bit key schedule - RFC 6114 Section 6.3
    // L <- GFN_{4,12}(CON_128[0..23], K); WK0..3 <- K; 9 iterations produce 36 round keys (18 rounds)
    _setupKey128() {
      const conWords = this._genCon(16);
      const gfnRounds = 12;
      const L = this._gfn([...this._key], conWords, gfnRounds, 4);

      // Whitening keys from original key - RFC 6114 Section 6.3
      this.wk = [];
      for (let i = 0; i < 4; i++) {
        this.wk[i] = this._key.slice(i * 4, i * 4 + 4);
      }

      // Round keys derived from L - RFC 6114 Section 6.3
      // 9 iterations generating 4 RK each = 36 round keys for 18 rounds
      this.rk = [];
      const r = 9;
      const conStartIdx = gfnRounds * 2;  // Start after GFN_{4,12} constants (in CON word array)

      for (let i = 0; i < r; i++) {
        // Step 1: T <- L XOR CON (4 CON words = 16 bytes)
        const temp = new Array(16);
        for (let j = 0; j < 4; j++) {
          const conWord = conWords[conStartIdx + i * 4 + j];
          const conBytes = OpCodes.Unpack32BE(conWord);
          for (let k = 0; k < 4; k++) {
            temp[j * 4 + k] = OpCodes.XorN(L[j * 4 + k], conBytes[k]);
          }
        }

        // Step 2: XOR temp with key on ODD iterations (1, 3, 5, 7)
        // RFC 6114 Section 6.3: "if i is odd: T <- T XOR K"
        if ((i % 2) === 1) {
          for (let j = 0; j < 16; j++) {
            temp[j] ^= this._key[j];
          }
        }

        // Step 3: Extract 4 round keys (4 bytes each) from the 16-byte temp
        // Each iteration i generates RK[4i], RK[4i+1], RK[4i+2], RK[4i+3]
        this.rk[i * 4] = temp.slice(0, 4);
        this.rk[i * 4 + 1] = temp.slice(4, 8);
        this.rk[i * 4 + 2] = temp.slice(8, 12);
        this.rk[i * 4 + 3] = temp.slice(12, 16);

        // Step 4: L <- Sigma(L) - Apply AFTER extracting keys
        // Sony reference: ClefiaDoubleSwap(lk) is called after rk assignment
        this._sigma(L);
      }
    }

    // 192/256-bit key schedule - RFC 6114 Section 6.4/6.5
    // KL|KR <- padded key (192-bit pads KR with the bitwise complement of K0|K1);
    // LL|LR <- GFN_{8,10}(CON_k[0..39], KL|KR); WK0..3 <- KL XOR KR.
    // 11 (192-bit) or 13 (256-bit) iterations alternate LL/LR, producing 44/52
    // round keys for 22/26 rounds.
    _setupKey192Or256(keyLen) {
      const conWords = this._genCon(keyLen);

      const kl = this._key.slice(0, 16);
      let kr;
      if (keyLen === 24) {
        // KR <- K4 | K5 | ~K0 | ~K1 (bitwise complement of the first two key words)
        kr = this._key.slice(16, 24)
          .concat(this._key.slice(0, 4).map(b => OpCodes.AndN(OpCodes.XorN(b, 0xFF), 0xFF)))
          .concat(this._key.slice(4, 8).map(b => OpCodes.AndN(OpCodes.XorN(b, 0xFF), 0xFF)));
      } else {
        kr = this._key.slice(16, 32);
      }

      const gfnRounds = 10;
      const gfnOut = this._gfn(kl.concat(kr), conWords, gfnRounds, 8);
      const LL = gfnOut.slice(0, 16);
      const LR = gfnOut.slice(16, 32);

      // Whitening keys - RFC 6114 Section 6.4/6.5: WK0|WK1|WK2|WK3 <- KL XOR KR
      this.wk = [];
      for (let i = 0; i < 4; i++) {
        this.wk[i] = [];
        for (let j = 0; j < 4; j++) {
          this.wk[i][j] = OpCodes.XorN(kl[i * 4 + j], kr[i * 4 + j]);
        }
      }

      // Round keys derived from LL/LR, alternating every two iterations
      this.rk = [];
      const r = keyLen === 24 ? 11 : 13;
      const conStartIdx = gfnRounds * 4;  // Start after GFN_{8,10} constants (in CON word array)

      for (let i = 0; i < r; i++) {
        const useLL = (i % 4) === 0 || (i % 4) === 1;
        const L = useLL ? LL : LR;
        const otherKey = useLL ? kr : kl;

        // Step 1: T <- L XOR CON (4 CON words = 16 bytes)
        const temp = new Array(16);
        for (let j = 0; j < 4; j++) {
          const conWord = conWords[conStartIdx + i * 4 + j];
          const conBytes = OpCodes.Unpack32BE(conWord);
          for (let k = 0; k < 4; k++) {
            temp[j * 4 + k] = OpCodes.XorN(L[j * 4 + k], conBytes[k]);
          }
        }

        // Step 2: XOR temp with the complementary key half on ODD iterations
        if ((i % 2) === 1) {
          for (let j = 0; j < 16; j++) {
            temp[j] ^= otherKey[j];
          }
        }

        // Step 3: Extract 4 round keys (4 bytes each) from the 16-byte temp
        this.rk[i * 4] = temp.slice(0, 4);
        this.rk[i * 4 + 1] = temp.slice(4, 8);
        this.rk[i * 4 + 2] = temp.slice(8, 12);
        this.rk[i * 4 + 3] = temp.slice(12, 16);

        // Step 4: L <- Sigma(L) - mutates LL or LR in place for the next round
        this._sigma(L);
      }
    }

    _sigma(x) {
      // Sigma (DoubleSwap) function from Sony reference implementation
      // RFC 6114 Section 4.2: Complex bit permutation on two 64-bit halves
      // Reference: clefia_ref.c ClefiaDoubleSwap

      const t = new Array(16);

      // First half (bytes 0-7): 7-bit left rotation with crossover
      t[0] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[0], 7), OpCodes.Shr8(x[1], 1)), 0xFF);
      t[1] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[1], 7), OpCodes.Shr8(x[2], 1)), 0xFF);
      t[2] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[2], 7), OpCodes.Shr8(x[3], 1)), 0xFF);
      t[3] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[3], 7), OpCodes.Shr8(x[4], 1)), 0xFF);
      t[4] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[4], 7), OpCodes.Shr8(x[5], 1)), 0xFF);
      t[5] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[5], 7), OpCodes.Shr8(x[6], 1)), 0xFF);
      t[6] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[6], 7), OpCodes.Shr8(x[7], 1)), 0xFF);
      t[7] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl8(x[7], 7), OpCodes.AndN(x[15], 0x7F)), 0xFF);

      // Second half (bytes 8-15): 7-bit right rotation with crossover
      t[8] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[8], 7), OpCodes.AndN(x[0], 0xFE)), 0xFF);
      t[9] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[9], 7), OpCodes.Shl8(x[8], 1)), 0xFF);
      t[10] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[10], 7), OpCodes.Shl8(x[9], 1)), 0xFF);
      t[11] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[11], 7), OpCodes.Shl8(x[10], 1)), 0xFF);
      t[12] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[12], 7), OpCodes.Shl8(x[11], 1)), 0xFF);
      t[13] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[13], 7), OpCodes.Shl8(x[12], 1)), 0xFF);
      t[14] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[14], 7), OpCodes.Shl8(x[13], 1)), 0xFF);
      t[15] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr8(x[15], 7), OpCodes.Shl8(x[14], 1)), 0xFF);

      // Copy back to input array
      for (let i = 0; i < 16; i++) {
        x[i] = t[i];
      }
    }

    // Return the generated CON constants for the given key length (in bytes)
    // Returns array of 32-bit words (not bytes) - RFC 6114 Appendix C
    _genCon(keyLen) {
      if (keyLen === 16) return CON_128;
      if (keyLen === 24) return CON_192;
      return CON_256;
    }

    // GFN_{d,r} - Generalized Feistel Network with d branches (d=4 or d=8)
    // RFC 6114 Section 4.1: GFN_{4,r} is used to derive L for 128-bit keys;
    // GFN_{8,10} is used to derive LL|LR for 192/256-bit keys.
    // x: byte array (d*4 bytes)
    // conWords: array of 32-bit words to use as round keys (d/2 per round)
    // r: number of rounds
    // Output: byte array (d*4 bytes)
    _gfn(x, conWords, r, d) {
      // Convert input bytes to 32-bit words (big-endian per RFC 6114)
      const t = new Array(d);
      for (let branch = 0; branch < d; branch++) {
        t[branch] = OpCodes.Pack32BE(x[branch * 4], x[branch * 4 + 1], x[branch * 4 + 2], x[branch * 4 + 3]);
      }

      const half = d / 2;  // CON words (and F-function applications) consumed per round
      for (let i = 0; i < r; i++) {
        for (let branch = 0; branch < half; branch++) {
          // Each pair of branches (T_{2b}, T_{2b+1}) is updated with F0 (even b) or F1 (odd b)
          const rk = OpCodes.Unpack32BE(conWords[i * half + branch]);
          const srcIdx = branch * 2;
          const dstIdx = branch * 2 + 1;
          const fOut = (branch % 2) === 0 ? this._f0(t[srcIdx], rk) : this._f1(t[srcIdx], rk);
          t[dstIdx] = OpCodes.Xor32(t[dstIdx], fOut);
        }

        // Rotate: T0|T1|...|T_{d-1} <- T1|...|T_{d-1}|T0
        // Skip rotation on last round (equivalent to the RFC's post-loop un-rotate)
        if (i < r - 1) {
          const tmp = t[0];
          for (let branch = 0; branch < d - 1; branch++) {
            t[branch] = t[branch + 1];
          }
          t[d - 1] = tmp;
        }
      }

      // Convert 32-bit words back to bytes (big-endian per RFC 6114)
      const result = [];
      for (let branch = 0; branch < d; branch++) {
        result.push(...OpCodes.Unpack32BE(t[branch]));
      }
      return result;
    }

    // F0 function - accepts 32-bit word and RK bytes, returns 32-bit word
    // RFC 6114 Section 2.1: F0(RK, X) uses S0,S1,S0,S1 S-boxes
    _f0(x32, rk) {
      // Unpack 32-bit word into bytes (big-endian per RFC 6114)
      const xBytes = OpCodes.Unpack32BE(x32);

      // S-box substitution: S0,S1,S0,S1
      const y = [
        S0[OpCodes.XorN(xBytes[0], rk[0])],
        S1[OpCodes.XorN(xBytes[1], rk[1])],
        S0[OpCodes.XorN(xBytes[2], rk[2])],
        S1[OpCodes.XorN(xBytes[3], rk[3])]
      ];

      // Diffusion matrix multiplication (GF(2^8))
      const z = [
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(y[0], gfMul(y[1], 2)), gfMul(y[2], 4)), gfMul(y[3], 6)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(gfMul(y[0], 2), y[1]), gfMul(y[2], 6)), gfMul(y[3], 4)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(gfMul(y[0], 4), gfMul(y[1], 6)), y[2]), gfMul(y[3], 2)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(gfMul(y[0], 6), gfMul(y[1], 4)), gfMul(y[2], 2)), y[3])
      ];

      // Pack result back into 32-bit word (big-endian per RFC 6114)
      return OpCodes.Pack32BE(z[0], z[1], z[2], z[3]);
    }

    // F1 function - accepts 32-bit word and RK bytes, returns 32-bit word
    // RFC 6114 Section 2.1: F1(RK, X) uses S1,S0,S1,S0 S-boxes
    _f1(x32, rk) {
      // Unpack 32-bit word into bytes (big-endian per RFC 6114)
      const xBytes = OpCodes.Unpack32BE(x32);

      // S-box substitution: S1,S0,S1,S0
      const y = [
        S1[OpCodes.XorN(xBytes[0], rk[0])],
        S0[OpCodes.XorN(xBytes[1], rk[1])],
        S1[OpCodes.XorN(xBytes[2], rk[2])],
        S0[OpCodes.XorN(xBytes[3], rk[3])]
      ];

      // Diffusion matrix multiplication (GF(2^8))
      const z = [
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(y[0], gfMul(y[1], 8)), gfMul(y[2], 2)), gfMul(y[3], 10)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(gfMul(y[0], 8), y[1]), gfMul(y[2], 10)), gfMul(y[3], 2)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(gfMul(y[0], 2), gfMul(y[1], 10)), y[2]), gfMul(y[3], 8)),
        OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(gfMul(y[0], 10), gfMul(y[1], 2)), gfMul(y[2], 8)), y[3])
      ];

      // Pack result back into 32-bit word (big-endian per RFC 6114)
      return OpCodes.Pack32BE(z[0], z[1], z[2], z[3]);
    }

    _encrypt(block) {
      // Convert input block to four 32-bit words (big-endian per RFC 6114)
      let p0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let p1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      let p2 = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      let p3 = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      // Convert whitening keys to 32-bit words (big-endian per RFC 6114)
      const wk0 = OpCodes.Pack32BE(this.wk[0][0], this.wk[0][1], this.wk[0][2], this.wk[0][3]);
      const wk1 = OpCodes.Pack32BE(this.wk[1][0], this.wk[1][1], this.wk[1][2], this.wk[1][3]);
      const wk2 = OpCodes.Pack32BE(this.wk[2][0], this.wk[2][1], this.wk[2][2], this.wk[2][3]);
      const wk3 = OpCodes.Pack32BE(this.wk[3][0], this.wk[3][1], this.wk[3][2], this.wk[3][3]);

      // Pre-whitening: P1 ^= WK0, P3 ^= WK1
      p1 = OpCodes.Xor32(p1, wk0);
      p3 = OpCodes.Xor32(p3, wk1);

      // Rounds (each round uses 2 round keys)
      const r = this.rk.length / 2;
      for (let round = 0; round < r; round++) {
        // P1 ^= F0(RK_{2i}, P0)
        p1 ^= this._f0(p0, this.rk[round * 2]);

        // P3 ^= F1(RK_{2i+1}, P2)
        p3 ^= this._f1(p2, this.rk[round * 2 + 1]);

        // Rotate: P0|P1|P2|P3 <- P1|P2|P3|P0
        // Skip rotation on last round (Sony reference clefia_ref.c line 197)
        if (round < r - 1) {
          const tmp = p0;
          p0 = p1;
          p1 = p2;
          p2 = p3;
          p3 = tmp;
        }
      }

      // Post-whitening: P1 ^= WK2, P3 ^= WK3
      p1 = OpCodes.Xor32(p1, wk2);
      p3 = OpCodes.Xor32(p3, wk3);

      // Convert output words back to bytes (big-endian per RFC 6114)
      const result = [];
      result.push(...OpCodes.Unpack32BE(p0));
      result.push(...OpCodes.Unpack32BE(p1));
      result.push(...OpCodes.Unpack32BE(p2));
      result.push(...OpCodes.Unpack32BE(p3));
      return result;
    }

    _decrypt(block) {
      // Convert input block to four 32-bit words (big-endian per RFC 6114)
      let c0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let c1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      let c2 = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      let c3 = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      // Convert whitening keys to 32-bit words (big-endian per RFC 6114)
      const wk0 = OpCodes.Pack32BE(this.wk[0][0], this.wk[0][1], this.wk[0][2], this.wk[0][3]);
      const wk1 = OpCodes.Pack32BE(this.wk[1][0], this.wk[1][1], this.wk[1][2], this.wk[1][3]);
      const wk2 = OpCodes.Pack32BE(this.wk[2][0], this.wk[2][1], this.wk[2][2], this.wk[2][3]);
      const wk3 = OpCodes.Pack32BE(this.wk[3][0], this.wk[3][1], this.wk[3][2], this.wk[3][3]);

      // Inverse pre-whitening: C1 ^= WK2, C3 ^= WK3
      c1 = OpCodes.Xor32(c1, wk2);
      c3 = OpCodes.Xor32(c3, wk3);

      // Inverse rounds (each round uses 2 round keys)
      const r = this.rk.length / 2;
      for (let round = r - 1; round >= 0; round--) {
        // Inverse rotate: C0|C1|C2|C3 <- C3|C0|C1|C2
        // Skip rotation on first decryption round (last encryption round)
        if (round < r - 1) {
          const tmp = c3;
          c3 = c2;
          c2 = c1;
          c1 = c0;
          c0 = tmp;
        }

        // C1 ^= F0(RK_{2i}, C0)
        c1 ^= this._f0(c0, this.rk[round * 2]);

        // C3 ^= F1(RK_{2i+1}, C2)
        c3 ^= this._f1(c2, this.rk[round * 2 + 1]);
      }

      // Inverse post-whitening: C1 ^= WK0, C3 ^= WK1
      c1 = OpCodes.Xor32(c1, wk0);
      c3 = OpCodes.Xor32(c3, wk1);

      // Convert output words back to bytes (big-endian per RFC 6114)
      const result = [];
      result.push(...OpCodes.Unpack32BE(c0));
      result.push(...OpCodes.Unpack32BE(c1));
      result.push(...OpCodes.Unpack32BE(c2));
      result.push(...OpCodes.Unpack32BE(c3));
      return result;
    }
  }

  RegisterAlgorithm(new CLEFIAAlgorithm());
  return CLEFIAAlgorithm;
}));
