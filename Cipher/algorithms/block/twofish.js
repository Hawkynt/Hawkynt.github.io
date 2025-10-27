/*
 * Twofish Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Implements the Twofish cipher designed by Bruce Schneier and team.
 * 128-bit blocks with 128, 192, or 256-bit keys.
 * AES finalist with excellent security analysis. Educational implementation.
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== TWOFISH CONSTANTS =====

  // Twofish S-box permutation tables from reference implementation
  const P = Object.freeze([
    // p0
    [
      0xA9, 0x67, 0xB3, 0xE8, 0x04, 0xFD, 0xA3, 0x76, 0x9A, 0x92, 0x80, 0x78, 0xE4, 0xDD, 0xD1, 0x38,
      0x0D, 0xC6, 0x35, 0x98, 0x18, 0xF7, 0xEC, 0x6C, 0x43, 0x75, 0x37, 0x26, 0xFA, 0x13, 0x94, 0x48,
      0xF2, 0xD0, 0x8B, 0x30, 0x84, 0x54, 0xDF, 0x23, 0x19, 0x5B, 0x3D, 0x59, 0xF3, 0xAE, 0xA2, 0x82,
      0x63, 0x01, 0x83, 0x2E, 0xD9, 0x51, 0x9B, 0x7C, 0xA6, 0xEB, 0xA5, 0xBE, 0x16, 0x0C, 0xE3, 0x61,
      0xC0, 0x8C, 0x3A, 0xF5, 0x73, 0x2C, 0x25, 0x0B, 0xBB, 0x4E, 0x89, 0x6B, 0x53, 0x6A, 0xB4, 0xF1,
      0xE1, 0xE6, 0xBD, 0x45, 0xE2, 0xF4, 0xB6, 0x66, 0xCC, 0x95, 0x03, 0x56, 0xD4, 0x1C, 0x1E, 0xD7,
      0xFB, 0xC3, 0x8E, 0xB5, 0xE9, 0xCF, 0xBF, 0xBA, 0xEA, 0x77, 0x39, 0xAF, 0x33, 0xC9, 0x62, 0x71,
      0x81, 0x79, 0x09, 0xAD, 0x24, 0xCD, 0xF9, 0xD8, 0xE5, 0xC5, 0xB9, 0x4D, 0x44, 0x08, 0x86, 0xE7,
      0xA1, 0x1D, 0xAA, 0xED, 0x06, 0x70, 0xB2, 0xD2, 0x41, 0x7B, 0xA0, 0x11, 0x31, 0xC2, 0x27, 0x90,
      0x20, 0xF6, 0x60, 0xFF, 0x96, 0x5C, 0xB1, 0xAB, 0x9E, 0x9C, 0x52, 0x1B, 0x5F, 0x93, 0x0A, 0xEF,
      0x91, 0x85, 0x49, 0xEE, 0x2D, 0x4F, 0x8F, 0x3B, 0x47, 0x87, 0x6D, 0x46, 0xD6, 0x3E, 0x69, 0x64,
      0x2A, 0xCE, 0xCB, 0x2F, 0xFC, 0x97, 0x05, 0x7A, 0xAC, 0x7F, 0xD5, 0x1A, 0x4B, 0x0E, 0xA7, 0x5A,
      0x28, 0x14, 0x3F, 0x29, 0x88, 0x3C, 0x4C, 0x02, 0xB8, 0xDA, 0xB0, 0x17, 0x55, 0x1F, 0x8A, 0x7D,
      0x57, 0xC7, 0x8D, 0x74, 0xB7, 0xC4, 0x9F, 0x72, 0x7E, 0x15, 0x22, 0x12, 0x58, 0x07, 0x99, 0x34,
      0x6E, 0x50, 0xDE, 0x68, 0x65, 0xBC, 0xDB, 0xF8, 0xC8, 0xA8, 0x2B, 0x40, 0xDC, 0xFE, 0x32, 0xA4,
      0xCA, 0x10, 0x21, 0xF0, 0xD3, 0x5D, 0x0F, 0x00, 0x6F, 0x9D, 0x36, 0x42, 0x4A, 0x5E, 0xC1, 0xE0
    ],
    // p1
    [
      0x75, 0xF3, 0xC6, 0xF4, 0xDB, 0x7B, 0xFB, 0xC8, 0x4A, 0xD3, 0xE6, 0x6B, 0x45, 0x7D, 0xE8, 0x4B,
      0xD6, 0x32, 0xD8, 0xFD, 0x37, 0x71, 0xF1, 0xE1, 0x30, 0x0F, 0xF8, 0x1B, 0x87, 0xFA, 0x06, 0x3F,
      0x5E, 0xBA, 0xAE, 0x5B, 0x8A, 0x00, 0xBC, 0x9D, 0x6D, 0xC1, 0xB1, 0x0E, 0x80, 0x5D, 0xD2, 0xD5,
      0xA0, 0x84, 0x07, 0x14, 0xB5, 0x90, 0x2C, 0xA3, 0xB2, 0x73, 0x4C, 0x54, 0x92, 0x74, 0x36, 0x51,
      0x38, 0xB0, 0xBD, 0x5A, 0xFC, 0x60, 0x62, 0x96, 0x6C, 0x42, 0xF7, 0x10, 0x7C, 0x28, 0x27, 0x8C,
      0x13, 0x95, 0x9C, 0xC7, 0x24, 0x46, 0x3B, 0x70, 0xCA, 0xE3, 0x85, 0xCB, 0x11, 0xD0, 0x93, 0xB8,
      0xA6, 0x83, 0x20, 0xFF, 0x9F, 0x77, 0xC3, 0xCC, 0x03, 0x6F, 0x08, 0xBF, 0x40, 0xE7, 0x2B, 0xE2,
      0x79, 0x0C, 0xAA, 0x82, 0x41, 0x3A, 0xEA, 0xB9, 0xE4, 0x9A, 0xA4, 0x97, 0x7E, 0xDA, 0x7A, 0x17,
      0x66, 0x94, 0xA1, 0x1D, 0x3D, 0xF0, 0xDE, 0xB3, 0x0B, 0x72, 0xA7, 0x1C, 0xEF, 0xD1, 0x53, 0x3E,
      0x8F, 0x33, 0x26, 0x5F, 0xEC, 0x76, 0x2A, 0x49, 0x81, 0x88, 0xEE, 0x21, 0xC4, 0x1A, 0xEB, 0xD9,
      0xC5, 0x39, 0x99, 0xCD, 0xAD, 0x31, 0x8B, 0x01, 0x18, 0x23, 0xDD, 0x1F, 0x4E, 0x2D, 0xF9, 0x48,
      0x4F, 0xF2, 0x65, 0x8E, 0x78, 0x5C, 0x58, 0x19, 0x8D, 0xE5, 0x98, 0x57, 0x67, 0x7F, 0x05, 0x64,
      0xAF, 0x63, 0xB6, 0xFE, 0xF5, 0xB7, 0x3C, 0xA5, 0xCE, 0xE9, 0x68, 0x44, 0xE0, 0x4D, 0x43, 0x69,
      0x29, 0x2E, 0xAC, 0x15, 0x59, 0xA8, 0x0A, 0x9E, 0x6E, 0x47, 0xDF, 0x34, 0x35, 0x6A, 0xCF, 0xDC,
      0x22, 0xC9, 0xC0, 0x9B, 0x89, 0xD4, 0xED, 0xAB, 0x12, 0xA2, 0x0D, 0x52, 0xBB, 0x02, 0x2F, 0xA9,
      0xD7, 0x61, 0x1E, 0xB4, 0x50, 0x04, 0xF6, 0xC2, 0x16, 0x25, 0x86, 0x56, 0x55, 0x09, 0xBE, 0x91
    ]
  ]);

  // Constants from C# reference
  const P_00 = 1, P_01 = 0, P_02 = 0, P_03 = P_01 ^ 1, P_04 = 1;
  const P_10 = 0, P_11 = 0, P_12 = 1, P_13 = P_11 ^ 1, P_14 = 0;
  const P_20 = 1, P_21 = 1, P_22 = 0, P_23 = P_21 ^ 1, P_24 = 0;
  const P_30 = 0, P_31 = 1, P_32 = 1, P_33 = P_31 ^ 1, P_34 = 1;

  const GF256_FDBK = 0x169;
  const GF256_FDBK_2 = Math.floor(GF256_FDBK / 2);
  const GF256_FDBK_4 = Math.floor(GF256_FDBK / 4);
  const RS_GF_FDBK = 0x14D;

  const ROUNDS = 16;
  const MAX_ROUNDS = 16;
  const BLOCK_SIZE = 16;
  const MAX_KEY_BITS = 256;

  const INPUT_WHITEN = 0;
  const OUTPUT_WHITEN = INPUT_WHITEN + Math.floor(BLOCK_SIZE / 4);
  const ROUND_SUBKEYS = OUTPUT_WHITEN + Math.floor(BLOCK_SIZE / 4);
  const TOTAL_SUBKEYS = ROUND_SUBKEYS + 2 * MAX_ROUNDS;

  const SK_STEP = 0x02020202;
  const SK_BUMP = 0x01010101;
  const SK_ROTL = 9;

  // ===== ALGORITHM IMPLEMENTATION =====

  class TwofishAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Twofish";
      this.description = "AES finalist cipher by Bruce Schneier with key-dependent S-boxes and MDS matrix. Supports 128, 192, and 256-bit keys with excellent security analysis.";
      this.inventor = "Bruce Schneier, John Kelsey, Doug Whiting, David Wagner, Chris Hall, Niels Ferguson";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Conservative - no known practical attacks
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0), // 128-bit keys
        new KeySize(24, 24, 0), // 192-bit keys  
        new KeySize(32, 32, 0)  // 256-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Twofish Algorithm Specification", "https://www.schneier.com/academic/twofish/"),
        new LinkItem("Twofish: A 128-Bit Block Cipher", "https://www.schneier.com/academic/paperfiles/paper-twofish-paper.pdf"),
        new LinkItem("NIST AES Candidate Submission", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development")
      ];

      this.references = [
        new LinkItem("Crypto++ Twofish Implementation", "https://github.com/weidai11/cryptopp/blob/master/twofish.cpp"),
        new LinkItem("libgcrypt Twofish Implementation", "https://github.com/gpg/libgcrypt/blob/master/cipher/twofish.c"),
        new LinkItem("Bouncy Castle Twofish Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines")
      ];

      // Test vectors from official Twofish specification
      this.tests = [
        {
          text: "Twofish ECB 128-bit Key Test Vector",
          uri: "https://www.schneier.com/code/ecb_ival.txt",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("9F589F5CF6122C32B6BFEC2F2AE8C35A")
        },
        {
          text: "Twofish ECB 128-bit Key Test Vector #2",
          uri: "https://www.schneier.com/code/ecb_ival.txt",
          input: OpCodes.Hex8ToBytes("9F589F5CF6122C32B6BFEC2F2AE8C35A"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("D491DB16E7B1C39E86CB086B789F5419")
        },
        {
          text: "Twofish ECB 192-bit Key Test Vector",
          uri: "https://www.schneier.com/code/ecb_ival.txt",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("EFA71F788965BD4453F860178FC19101")
        },
        {
          text: "Twofish ECB 256-bit Key Test Vector",
          uri: "https://www.schneier.com/code/ecb_ival.txt",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("57FF739D4DC92C1BD7FC01700CC8216F")
        }
      ];

      // Initialize MDS matrices
      this.gMDS0 = new Array(MAX_KEY_BITS);
      this.gMDS1 = new Array(MAX_KEY_BITS);
      this.gMDS2 = new Array(MAX_KEY_BITS);
      this.gMDS3 = new Array(MAX_KEY_BITS);
      this._initializeMDS();
    }

    _initializeMDS() {
      const m1 = new Array(2);
      const mX = new Array(2);
      const mY = new Array(2);
      let j;

      for (let i = 0; i < MAX_KEY_BITS; i++) {
        j = P[0][i] & 0xff;
        m1[0] = j;
        mX[0] = this._Mx_X(j) & 0xff;
        mY[0] = this._Mx_Y(j) & 0xff;

        j = P[1][i] & 0xff;
        m1[1] = j;
        mX[1] = this._Mx_X(j) & 0xff;
        mY[1] = this._Mx_Y(j) & 0xff;

        this.gMDS0[i] = OpCodes.Pack32LE(m1[P_00], mX[P_00], mY[P_00], mY[P_00]);
        this.gMDS1[i] = OpCodes.Pack32LE(mY[P_10], mY[P_10], mX[P_10], m1[P_10]);
        this.gMDS2[i] = OpCodes.Pack32LE(mX[P_20], mY[P_20], m1[P_20], mY[P_20]);
        this.gMDS3[i] = OpCodes.Pack32LE(mX[P_30], m1[P_30], mY[P_30], mX[P_30]);
      }
    }

    _LFSR1(x) {
      return ((x >>> 1) ^ (((x & 0x01) !== 0) ? GF256_FDBK_2 : 0));
    }

    _LFSR2(x) {
      return ((x >>> 2) ^
              (((x & 0x02) !== 0) ? GF256_FDBK_2 : 0) ^
              (((x & 0x01) !== 0) ? GF256_FDBK_4 : 0));
    }

    _Mx_X(x) {
      return x ^ this._LFSR2(x);
    }

    _Mx_Y(x) {
      return x ^ this._LFSR1(x) ^ this._LFSR2(x);
    }

    CreateInstance(isInverse = false) {
      return new TwofishInstance(this, isInverse);
    }
  }

  class TwofishInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;

      // Twofish-specific state
      this.gSubKeys = null;
      this.gSBox = null;
      this.k64Cnt = 0;
      this.workingKey = null;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        this.gSubKeys = null;
        this.gSBox = null;
        return;
      }

      // Validate key size (16, 24, or 32 bytes)
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Twofish requires 16, 24, or 32 bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.workingKey = [...keyBytes];
      this.k64Cnt = Math.floor(keyBytes.length / 8);
      this._setKey(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 16-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlockInternal(block) 
          : this._encryptBlockInternal(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _setKey(key) {
      const k32e = new Array(Math.floor(MAX_KEY_BITS / 64));
      const k32o = new Array(Math.floor(MAX_KEY_BITS / 64));
      const sBoxKeys = new Array(Math.floor(MAX_KEY_BITS / 64));
      this.gSubKeys = new Array(TOTAL_SUBKEYS);

      // Extract key material
      for (let i = 0; i < this.k64Cnt; i++) {
        const p = i * 8;
        k32e[i] = OpCodes.Pack32LE(key[p], key[p + 1], key[p + 2], key[p + 3]);
        k32o[i] = OpCodes.Pack32LE(key[p + 4], key[p + 5], key[p + 6], key[p + 7]);
        sBoxKeys[this.k64Cnt - 1 - i] = this._RS_MDS_Encode(k32e[i], k32o[i]);
      }

      let q, A, B;
      for (let i = 0; i < Math.floor(TOTAL_SUBKEYS / 2); i++) {
        q = i * SK_STEP;
        A = this._F32(q, k32e);
        B = this._F32(q + SK_BUMP, k32o);
        B = OpCodes.RotL32(B, 8);
        A = (A + B) >>> 0;
        this.gSubKeys[i * 2] = A;
        A = (A + B) >>> 0;
        this.gSubKeys[i * 2 + 1] = OpCodes.RotL32(A, SK_ROTL);
      }

      // Fully expand the S-box table for speed
      const k0 = sBoxKeys[0] || 0;
      const k1 = sBoxKeys[1] || 0;
      const k2 = sBoxKeys[2] || 0;
      const k3 = sBoxKeys[3] || 0;
      let b0, b1, b2, b3;
      this.gSBox = new Array(4 * MAX_KEY_BITS);
      
      for (let i = 0; i < MAX_KEY_BITS; i++) {
        b0 = b1 = b2 = b3 = i;
        switch (this.k64Cnt & 3) {
          case 1:
            this.gSBox[i * 2] = this.algorithm.gMDS0[(P[P_01][b0] & 0xff) ^ this._M_b0(k0)];
            this.gSBox[i * 2 + 1] = this.algorithm.gMDS1[(P[P_11][b1] & 0xff) ^ this._M_b1(k0)];
            this.gSBox[i * 2 + 0x200] = this.algorithm.gMDS2[(P[P_21][b2] & 0xff) ^ this._M_b2(k0)];
            this.gSBox[i * 2 + 0x201] = this.algorithm.gMDS3[(P[P_31][b3] & 0xff) ^ this._M_b3(k0)];
            break;
          case 0: // 256 bits of key
            b0 = (P[P_04][b0] & 0xff) ^ this._M_b0(k3);
            b1 = (P[P_14][b1] & 0xff) ^ this._M_b1(k3);
            b2 = (P[P_24][b2] & 0xff) ^ this._M_b2(k3);
            b3 = (P[P_34][b3] & 0xff) ^ this._M_b3(k3);
            // fall through
          case 3: // 192 bits of key
            b0 = (P[P_03][b0] & 0xff) ^ this._M_b0(k2);
            b1 = (P[P_13][b1] & 0xff) ^ this._M_b1(k2);
            b2 = (P[P_23][b2] & 0xff) ^ this._M_b2(k2);
            b3 = (P[P_33][b3] & 0xff) ^ this._M_b3(k2);
            // fall through
          case 2: // 128 bits of key
            this.gSBox[i * 2] = this.algorithm.gMDS0[(P[P_01][(P[P_02][b0] & 0xff) ^ this._M_b0(k1)] & 0xff) ^ this._M_b0(k0)];
            this.gSBox[i * 2 + 1] = this.algorithm.gMDS1[(P[P_11][(P[P_12][b1] & 0xff) ^ this._M_b1(k1)] & 0xff) ^ this._M_b1(k0)];
            this.gSBox[i * 2 + 0x200] = this.algorithm.gMDS2[(P[P_21][(P[P_22][b2] & 0xff) ^ this._M_b2(k1)] & 0xff) ^ this._M_b2(k0)];
            this.gSBox[i * 2 + 0x201] = this.algorithm.gMDS3[(P[P_31][(P[P_32][b3] & 0xff) ^ this._M_b3(k1)] & 0xff) ^ this._M_b3(k0)];
            break;
        }
      }
    }

    _encryptBlockInternal(input) {
      let x0 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]) ^ this.gSubKeys[INPUT_WHITEN];
      let x1 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]) ^ this.gSubKeys[INPUT_WHITEN + 1];
      let x2 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]) ^ this.gSubKeys[INPUT_WHITEN + 2];
      let x3 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]) ^ this.gSubKeys[INPUT_WHITEN + 3];

      let k = ROUND_SUBKEYS;
      let t0, t1;
      for (let r = 0; r < ROUNDS; r += 2) {
        t0 = this._Fe32_0(x0);
        t1 = this._Fe32_3(x1);
        x2 ^= (t0 + t1 + this.gSubKeys[k++]) >>> 0;
        x2 = OpCodes.RotR32(x2, 1);
        x3 = OpCodes.RotL32(x3, 1) ^ ((t0 + 2 * t1 + this.gSubKeys[k++]) >>> 0);

        t0 = this._Fe32_0(x2);
        t1 = this._Fe32_3(x3);
        x0 ^= (t0 + t1 + this.gSubKeys[k++]) >>> 0;
        x0 = OpCodes.RotR32(x0, 1);
        x1 = OpCodes.RotL32(x1, 1) ^ ((t0 + 2 * t1 + this.gSubKeys[k++]) >>> 0);
      }

      const output = [];
      const out2 = OpCodes.Unpack32LE((x2 ^ this.gSubKeys[OUTPUT_WHITEN]) >>> 0);
      const out3 = OpCodes.Unpack32LE((x3 ^ this.gSubKeys[OUTPUT_WHITEN + 1]) >>> 0);
      const out0 = OpCodes.Unpack32LE((x0 ^ this.gSubKeys[OUTPUT_WHITEN + 2]) >>> 0);
      const out1 = OpCodes.Unpack32LE((x1 ^ this.gSubKeys[OUTPUT_WHITEN + 3]) >>> 0);
      
      output.push(...out2, ...out3, ...out0, ...out1);
      return output;
    }

    _decryptBlockInternal(input) {
      let x2 = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]) ^ this.gSubKeys[OUTPUT_WHITEN];
      let x3 = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]) ^ this.gSubKeys[OUTPUT_WHITEN + 1];
      let x0 = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]) ^ this.gSubKeys[OUTPUT_WHITEN + 2];
      let x1 = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]) ^ this.gSubKeys[OUTPUT_WHITEN + 3];

      let k = ROUND_SUBKEYS + 2 * ROUNDS - 1;
      let t0, t1;
      for (let r = 0; r < ROUNDS; r += 2) {
        t0 = this._Fe32_0(x2);
        t1 = this._Fe32_3(x3);
        x1 ^= (t0 + 2 * t1 + this.gSubKeys[k--]) >>> 0;
        x0 = OpCodes.RotL32(x0, 1) ^ ((t0 + t1 + this.gSubKeys[k--]) >>> 0);
        x1 = OpCodes.RotR32(x1, 1);

        t0 = this._Fe32_0(x0);
        t1 = this._Fe32_3(x1);
        x3 ^= (t0 + 2 * t1 + this.gSubKeys[k--]) >>> 0;
        x2 = OpCodes.RotL32(x2, 1) ^ ((t0 + t1 + this.gSubKeys[k--]) >>> 0);
        x3 = OpCodes.RotR32(x3, 1);
      }

      const output = [];
      const out0 = OpCodes.Unpack32LE((x0 ^ this.gSubKeys[INPUT_WHITEN]) >>> 0);
      const out1 = OpCodes.Unpack32LE((x1 ^ this.gSubKeys[INPUT_WHITEN + 1]) >>> 0);
      const out2 = OpCodes.Unpack32LE((x2 ^ this.gSubKeys[INPUT_WHITEN + 2]) >>> 0);
      const out3 = OpCodes.Unpack32LE((x3 ^ this.gSubKeys[INPUT_WHITEN + 3]) >>> 0);
      
      output.push(...out0, ...out1, ...out2, ...out3);
      return output;
    }

    _F32(x, k32) {
      let b0 = this._M_b0(x);
      let b1 = this._M_b1(x);
      let b2 = this._M_b2(x);
      let b3 = this._M_b3(x);
      const k0 = k32[0] || 0;
      const k1 = k32[1] || 0;
      const k2 = k32[2] || 0;
      const k3 = k32[3] || 0;

      let result = 0;
      switch (this.k64Cnt & 3) {
        case 1:
          result = this.algorithm.gMDS0[(P[P_01][b0] & 0xff) ^ this._M_b0(k0)] ^
                  this.algorithm.gMDS1[(P[P_11][b1] & 0xff) ^ this._M_b1(k0)] ^
                  this.algorithm.gMDS2[(P[P_21][b2] & 0xff) ^ this._M_b2(k0)] ^
                  this.algorithm.gMDS3[(P[P_31][b3] & 0xff) ^ this._M_b3(k0)];
          break;
        case 0: // 256 bits of key
          b0 = (P[P_04][b0] & 0xff) ^ this._M_b0(k3);
          b1 = (P[P_14][b1] & 0xff) ^ this._M_b1(k3);
          b2 = (P[P_24][b2] & 0xff) ^ this._M_b2(k3);
          b3 = (P[P_34][b3] & 0xff) ^ this._M_b3(k3);
          // fall through
        case 3: // 192 bits of key
          b0 = (P[P_03][b0] & 0xff) ^ this._M_b0(k2);
          b1 = (P[P_13][b1] & 0xff) ^ this._M_b1(k2);
          b2 = (P[P_23][b2] & 0xff) ^ this._M_b2(k2);
          b3 = (P[P_33][b3] & 0xff) ^ this._M_b3(k2);
          // fall through
        case 2: // 128 bits of key
          result = this.algorithm.gMDS0[(P[P_01][(P[P_02][b0] & 0xff) ^ this._M_b0(k1)] & 0xff) ^ this._M_b0(k0)] ^
                  this.algorithm.gMDS1[(P[P_11][(P[P_12][b1] & 0xff) ^ this._M_b1(k1)] & 0xff) ^ this._M_b1(k0)] ^
                  this.algorithm.gMDS2[(P[P_21][(P[P_22][b2] & 0xff) ^ this._M_b2(k1)] & 0xff) ^ this._M_b2(k0)] ^
                  this.algorithm.gMDS3[(P[P_31][(P[P_32][b3] & 0xff) ^ this._M_b3(k1)] & 0xff) ^ this._M_b3(k0)];
          break;
      }
      return result >>> 0;
    }

    _RS_MDS_Encode(k0, k1) {
      let r = k1;
      for (let i = 0; i < 4; i++) { // shift 1 byte at a time
        r = this._RS_rem(r);
      }
      r ^= k0;
      for (let i = 0; i < 4; i++) {
        r = this._RS_rem(r);
      }
      return r >>> 0;
    }

    _RS_rem(x) {
      const b = ((x >>> 24) & 0xff);
      const g2 = ((b << 1) ^ ((b & 0x80) !== 0 ? RS_GF_FDBK : 0)) & 0xff;
      const g3 = ((b >>> 1) ^ ((b & 0x01) !== 0 ? (RS_GF_FDBK >>> 1) : 0)) ^ g2;
      return ((x << 8) ^ (g3 << 24) ^ (g2 << 16) ^ (g3 << 8) ^ b) >>> 0;
    }

    _M_b0(x) {
      return x & 0xff;
    }

    _M_b1(x) {
      return (x >>> 8) & 0xff;
    }

    _M_b2(x) {
      return (x >>> 16) & 0xff;
    }

    _M_b3(x) {
      return (x >>> 24) & 0xff;
    }

    _Fe32_0(x) {
      return this.gSBox[0x000 + 2 * (x & 0xff)] ^
             this.gSBox[0x001 + 2 * ((x >>> 8) & 0xff)] ^
             this.gSBox[0x200 + 2 * ((x >>> 16) & 0xff)] ^
             this.gSBox[0x201 + 2 * ((x >>> 24) & 0xff)];
    }

    _Fe32_3(x) {
      return this.gSBox[0x000 + 2 * ((x >>> 24) & 0xff)] ^
             this.gSBox[0x001 + 2 * (x & 0xff)] ^
             this.gSBox[0x200 + 2 * ((x >>> 8) & 0xff)] ^
             this.gSBox[0x201 + 2 * ((x >>> 16) & 0xff)];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new TwofishAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TwofishAlgorithm, TwofishInstance };
}));