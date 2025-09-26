/*
 * CLEFIA Block Cipher Implementation
 * Based on RFC 6114 and reference implementations
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CLEFIA Algorithm by Sony Corporation (2007)
 * Block size: 128 bits, Key size: 128/192/256 bits
 * Uses Generalized Feistel Network with F-functions
 *
 * NOTE: This is an educational implementation for learning purposes only.
 * Use established cryptographic libraries for production systems.
 *
 * References:
 * - RFC 6114: The 128-Bit Blockcipher CLEFIA
 * - CLEFIA: A New 128-bit Block Cipher (FSE 2007)
 * - ISO/IEC 29192-2:2012 Lightweight Cryptography
 */

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

  // ===== CLEFIA CONSTANTS =====

  // S-Box S0 from RFC 6114 Table 1
  const S0 = [
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
  ];

  // S-Box S1 from RFC 6114 Table 2
  const S1 = [
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
  ];

  // RFC 6114 CON constants generation parameters
  const GF16_PRIMITIVE_POLY = 0x1002b; // z^16 + z^15 + z^13 + z^11 + z^5 + z^4 + 1
  const P_CONST = 0xb7e1;
  const Q_CONST = 0x243f;

  // Initial values for CON generation
  const IV_128 = 0x428a;
  const IV_192 = 0x7137;
  const IV_256 = 0xb5c0;

  // GF(2^16) multiplication with primitive polynomial
  function gf16Mult(a, b) {
    let result = 0;
    while (b > 0) {
      if (b & 1) {
        result ^= a;
      }
      a <<= 1;
      if (a & 0x10000) {
        a ^= GF16_PRIMITIVE_POLY;
      }
      b >>= 1;
    }
    return result & 0xFFFF;
  }

  // Generate CON constants according to RFC 6114
  function generateCON(keySize) {
    let iv, numConstants;
    if (keySize === 16) {
      iv = IV_128;
      numConstants = 60;
    } else if (keySize === 24) {
      iv = IV_192;
      numConstants = 84;
    } else {
      iv = IV_256;
      numConstants = 108;
    }

    const con = [];
    let t = iv;

    for (let i = 0; i < numConstants / 2; i++) {
      // CON[2i] = (t XOR P) | ((~t) <<< 1)
      const con0_high = (t ^ P_CONST) & 0xFFFF;
      const not_t_rot = ((~t) << 1) & 0xFFFF;
      const con0 = (con0_high << 16) | not_t_rot;
      con.push(con0);

      // CON[2i+1] = ((~t) XOR Q) | (t <<< 8)
      const con1_high = ((~t) ^ Q_CONST) & 0xFFFF;
      const t_rot8 = ((t << 8) | (t >>> 8)) & 0xFFFF;
      const con1 = (con1_high << 16) | t_rot8;
      con.push(con1);

      // t = t * (0x0002^-1) in GF(2^16)
      // 0x0002^-1 in GF(2^16) with the primitive polynomial is 0x8001
      t = gf16Mult(t, 0x8001);
    }

    return con;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class CLEFIAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CLEFIA";
      this.description = "Sony's CLEFIA block cipher with 128-bit blocks and 128/192/256-bit keys. Uses Generalized Feistel Network with F-functions for lightweight cryptography applications.";
      this.inventor = "Sony Corporation";
      this.year = 2007;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // No known breaks, analyzed in multiple papers
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // 128, 192, 256-bit keys (16, 24, 32 bytes)
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit (16-byte) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 6114: The 128-Bit Blockcipher CLEFIA", "https://www.rfc-editor.org/rfc/rfc6114.html"),
        new LinkItem("ISO/IEC 29192-2:2012", "https://www.iso.org/standard/56552.html")
      ];

      this.references = [
        new LinkItem("CLEFIA FSE 2007 Paper", "https://link.springer.com/chapter/10.1007/978-3-540-74619-5_12"),
        new LinkItem("Sony CLEFIA Page", "https://www.sony.net/Products/cryptography/clefia/")
      ];

      // Vulnerabilities and limitations
      this.vulnerabilities = [];

      // Test vectors - RFC 6114 compliant test vector
      this.tests = [
        {
          input:    OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key:      OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100"),
          expected: OpCodes.Hex8ToBytes("de2bf2fd9b74aacdf1298555459494fd"), // RFC 6114 expected result
          text:"RFC 6114 CLEFIA-128 test vector",
          uri:"https://www.rfc-editor.org/rfc/rfc6114.html"
        }
      ];

    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new CLEFIAInstance(this, isInverse);
    }

    // Galois Field multiplication using OpCodes
    _gfMul(a, b) {
      return OpCodes.GF256Mul(a, b);
    }

    // Apply M0 diffusion matrix
    _applyM0(input) {
      const output = new Array(4);
      // M0 matrix:
      // result[0] = input[0] ^ (2 * input[1]) ^ (4 * input[2]) ^ (6 * input[3])
      // result[1] = (2 * input[0]) ^ input[1] ^ (6 * input[2]) ^ (4 * input[3])
      // result[2] = (4 * input[0]) ^ (6 * input[1]) ^ input[2] ^ (2 * input[3])
      // result[3] = (6 * input[0]) ^ (4 * input[1]) ^ (2 * input[2]) ^ input[3]

      output[0] = input[0] ^ this._gfMul(input[1], 0x02) ^ this._gfMul(input[2], 0x04) ^ this._gfMul(input[3], 0x06);
      output[1] = this._gfMul(input[0], 0x02) ^ input[1] ^ this._gfMul(input[2], 0x06) ^ this._gfMul(input[3], 0x04);
      output[2] = this._gfMul(input[0], 0x04) ^ this._gfMul(input[1], 0x06) ^ input[2] ^ this._gfMul(input[3], 0x02);
      output[3] = this._gfMul(input[0], 0x06) ^ this._gfMul(input[1], 0x04) ^ this._gfMul(input[2], 0x02) ^ input[3];

      return output;
    }

    // Apply M1 diffusion matrix
    _applyM1(input) {
      const output = new Array(4);
      // M1 matrix:
      // result[0] = input[0] ^ (8 * input[1]) ^ (2 * input[2]) ^ (10 * input[3])
      // result[1] = (8 * input[0]) ^ input[1] ^ (10 * input[2]) ^ (2 * input[3])
      // result[2] = (2 * input[0]) ^ (10 * input[1]) ^ input[2] ^ (8 * input[3])
      // result[3] = (10 * input[0]) ^ (2 * input[1]) ^ (8 * input[2]) ^ input[3]

      output[0] = input[0] ^ this._gfMul(input[1], 0x08) ^ this._gfMul(input[2], 0x02) ^ this._gfMul(input[3], 0x0a);
      output[1] = this._gfMul(input[0], 0x08) ^ input[1] ^ this._gfMul(input[2], 0x0a) ^ this._gfMul(input[3], 0x02);
      output[2] = this._gfMul(input[0], 0x02) ^ this._gfMul(input[1], 0x0a) ^ input[2] ^ this._gfMul(input[3], 0x08);
      output[3] = this._gfMul(input[0], 0x0a) ^ this._gfMul(input[1], 0x02) ^ this._gfMul(input[2], 0x08) ^ input[3];

      return output;
    }

    // F-function F0 using S0/S1 and M0
    _F0(input, rk) {
      const y = new Array(4);

      // XOR with round key
      for (let i = 0; i < 4; i++) {
        y[i] = input[i] ^ rk[i];
      }

      // S-box substitution: F0 uses S0, S1, S0, S1
      y[0] = S0[y[0]];
      y[1] = S1[y[1]];
      y[2] = S0[y[2]];
      y[3] = S1[y[3]];

      // Apply M0 diffusion matrix
      return this._applyM0(y);
    }

    // F-function F1 using S1/S0 and M1
    _F1(input, rk) {
      const y = new Array(4);

      // XOR with round key
      for (let i = 0; i < 4; i++) {
        y[i] = input[i] ^ rk[i];
      }

      // S-box substitution: F1 uses S1, S0, S1, S0
      y[0] = S1[y[0]];
      y[1] = S0[y[1]];
      y[2] = S1[y[2]];
      y[3] = S0[y[3]];

      // Apply M1 diffusion matrix
      return this._applyM1(y);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class CLEFIAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.whiteningKeys = null;
      this.rounds = 0;
      this.inputBuffer = [];
      this.BlockSize = 16; // 128-bit blocks
      this.KeySize = 0;    // will be set when key is assigned
    }

    // Property setter for key - validates and sets up key schedule
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.whiteningKeys = null;
        this.rounds = 0;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const validSizes = [16, 24, 32];
      if (!validSizes.includes(keyBytes.length)) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16, 24, or 32 bytes)`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;

      // Determine number of rounds based on key length
      if (this.KeySize === 16) {
        this.rounds = 18;
      } else if (this.KeySize === 24) {
        this.rounds = 22;
      } else if (this.KeySize === 32) {
        this.rounds = 26;
      }

      // Generate round keys and whitening keys
      this._generateKeys();
    }

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    // RFC 6114 compliant key schedule implementation based on Sony's reference
    _generateKeys() {
      this.roundKeys = [];
      this.whiteningKeys = [];

      if (this.KeySize === 16) {
        this._generateKeys128();
      } else if (this.KeySize === 24) {
        this._generateKeys192();
      } else {
        this._generateKeys256();
      }
    }

    // 128-bit key schedule following Sony's ClefiaKeySet128 exactly
    _generateKeys128() {
      const IV = [0x42, 0x8a]; // cubic root of 2
      const con128 = this._clefiaConSet(IV, 30); // generates 4*60 = 240 bytes

      // GFN_{4,12} (generating L from K)
      const L = this._clefiaGfn4([...this._key], con128, 12);

      // Initial whitening keys (WK0, WK1) - first 8 bytes of K
      this.whiteningKeys = [];
      this.whiteningKeys[0] = this._key.slice(0, 4);
      this.whiteningKeys[1] = this._key.slice(4, 8);

      // Generate 18 round keys (36 total for pairs)
      this.roundKeys = [];
      let currentL = [...L];

      for (let i = 0; i < 18; i++) {
        // Round key = L XOR CON[i*16 + 96..i*16 + 111]
        const rk = [];
        for (let j = 0; j < 16; j++) {
          rk[j] = currentL[j] ^ con128[i * 16 + 96 + j];
        }

        // On odd rounds, XOR with K
        if (i % 2 === 1) {
          for (let j = 0; j < 16; j++) {
            rk[j] ^= this._key[j];
          }
        }

        // Split into two 4-byte round keys for F0 and F1
        this.roundKeys[i * 2] = rk.slice(0, 4);     // RK for F0
        this.roundKeys[i * 2 + 1] = rk.slice(8, 12); // RK for F1

        // Update L using DoubleSwap
        currentL = this._clefiaDoubleSwap(currentL);
      }

      // Final whitening keys (WK2, WK3) - last 8 bytes of K
      this.whiteningKeys[2] = this._key.slice(8, 12);
      this.whiteningKeys[3] = this._key.slice(12, 16);

    }

    // Placeholder for 192/256-bit keys
    _generateKeys192() {
      // For now, use simplified approach
      this.whiteningKeys = [];
      for (let i = 0; i < 4; i++) {
        this.whiteningKeys[i] = [];
        for (let j = 0; j < 4; j++) {
          this.whiteningKeys[i][j] = this._key[(i * 4 + j) % this.KeySize];
        }
      }

      this.roundKeys = [];
      for (let round = 0; round < this.rounds * 2; round++) {
        this.roundKeys[round] = [];
        for (let i = 0; i < 4; i++) {
          this.roundKeys[round][i] = this._key[(round * 4 + i) % this.KeySize] ^ (round & 0xFF);
        }
      }
    }

    _generateKeys256() {
      // For now, use simplified approach
      this.whiteningKeys = [];
      for (let i = 0; i < 4; i++) {
        this.whiteningKeys[i] = [];
        for (let j = 0; j < 4; j++) {
          this.whiteningKeys[i][j] = this._key[(i * 4 + j) % this.KeySize];
        }
      }

      this.roundKeys = [];
      for (let round = 0; round < this.rounds * 2; round++) {
        this.roundKeys[round] = [];
        for (let i = 0; i < 4; i++) {
          this.roundKeys[round][i] = this._key[(round * 4 + i) % this.KeySize] ^ (round & 0xFF);
        }
      }
    }

    // CON constants generation following Sony's ClefiaConSet
    _clefiaConSet(iv, lk) {
      const con = [];
      let t = [...iv];

      for (let i = 0; i < lk; i++) {
        // Generate 8 bytes per iteration
        con.push(t[0] ^ 0xb7);
        con.push(t[1] ^ 0xe1);
        con.push(~((t[0] << 1) | (t[1] >>> 7)) & 0xFF);
        con.push(~((t[1] << 1) | (t[0] >>> 7)) & 0xFF);
        con.push((~t[0] ^ 0x24) & 0xFF);
        con.push((~t[1] ^ 0x3f) & 0xFF);
        con.push(t[1]);
        con.push(t[0]);

        // Update t for next iteration
        if (t[1] & 0x01) {
          t[0] ^= 0xa8;
          t[1] ^= 0x30;
        }
        const tmp = t[0] << 7;
        t[0] = (t[0] >>> 1) | (t[1] << 7) & 0xFF;
        t[1] = ((t[1] >>> 1) | tmp) & 0xFF;
      }

      return con;
    }

    // GFN4 function following Sony's ClefiaGfn4
    _clefiaGfn4(x, rk, r) {
      let fin = [...x];
      let fout = new Array(16);

      for (let round = 0; round < r; round++) {
        // F0 and F1 functions
        const f0_out = this._clefiaF0Xor(fin.slice(0, 4), rk.slice(round * 8, round * 8 + 4));
        const f1_out = this._clefiaF1Xor(fin.slice(8, 12), rk.slice(round * 8 + 4, round * 8 + 8));

        for (let i = 0; i < 4; i++) {
          fout[i] = f0_out[i];
          fout[i + 4] = fin[i + 4];
          fout[i + 8] = f1_out[i];
          fout[i + 12] = fin[i + 12];
        }

        if (round < r - 1) {
          // Swapping for next round
          for (let i = 0; i < 4; i++) {
            fin[i] = fout[i + 4];
            fin[i + 4] = fout[i + 8];
            fin[i + 8] = fout[i + 12];
            fin[i + 12] = fout[i];
          }
        }
      }

      return fout;
    }

    // F0 function with XOR
    _clefiaF0Xor(x, rk) {
      const result = this.algorithm._F0(x, rk);
      for (let i = 0; i < 4; i++) {
        result[i] ^= x[i];
      }
      return result;
    }

    // F1 function with XOR
    _clefiaF1Xor(x, rk) {
      const result = this.algorithm._F1(x, rk);
      for (let i = 0; i < 4; i++) {
        result[i] ^= x[i];
      }
      return result;
    }

    // DoubleSwap function following Sony's ClefiaDoubleSwap
    _clefiaDoubleSwap(lk) {
      const t = new Array(16);

      t[0]  = (lk[0] << 7) | (lk[1] >>> 1);
      t[1]  = (lk[1] << 7) | (lk[2] >>> 1);
      t[2]  = (lk[2] << 7) | (lk[3] >>> 1);
      t[3]  = (lk[3] << 7) | (lk[4] >>> 1);
      t[4]  = (lk[4] << 7) | (lk[5] >>> 1);
      t[5]  = (lk[5] << 7) | (lk[6] >>> 1);
      t[6]  = (lk[6] << 7) | (lk[7] >>> 1);
      t[7]  = (lk[7] << 7) | (lk[15] & 0x7f);

      t[8]  = (lk[8]  >>> 7) | (lk[0]  & 0xfe);
      t[9]  = (lk[9]  >>> 7) | (lk[8]  << 1);
      t[10] = (lk[10] >>> 7) | (lk[9]  << 1);
      t[11] = (lk[11] >>> 7) | (lk[10] << 1);
      t[12] = (lk[12] >>> 7) | (lk[11] << 1);
      t[13] = (lk[13] >>> 7) | (lk[12] << 1);
      t[14] = (lk[14] >>> 7) | (lk[13] << 1);
      t[15] = (lk[15] >>> 7) | (lk[14] << 1);

      // Ensure all values are bytes
      for (let i = 0; i < 16; i++) {
        t[i] &= 0xFF;
      }

      return t;
    }


    // Encrypt 16-byte block
    _encryptBlock(block) {
      // Split block into four 32-bit words (P0, P1, P2, P3)
      let P = [];
      for (let i = 0; i < 4; i++) {
        P[i] = [];
        for (let j = 0; j < 4; j++) {
          P[i][j] = block[i * 4 + j];
        }
      }

      // Pre-whitening: P0 ^= WK0, P1 ^= WK1
      for (let i = 0; i < 4; i++) {
        P[0][i] ^= this.whiteningKeys[0][i];
        P[1][i] ^= this.whiteningKeys[1][i];
      }

      // Main rounds
      for (let round = 0; round < this.rounds; round++) {
        const T0 = this.algorithm._F0(P[1], this.roundKeys[round * 2]);
        const T1 = this.algorithm._F1(P[3], this.roundKeys[round * 2 + 1]);

        // XOR results: P0 ^= T0, P2 ^= T1
        for (let i = 0; i < 4; i++) {
          P[0][i] ^= T0[i];
          P[2][i] ^= T1[i];
        }

        // Rotate state: (P0, P1, P2, P3) -> (P1, P2, P3, P0)
        const temp = P[0];
        P[0] = P[1];
        P[1] = P[2];
        P[2] = P[3];
        P[3] = temp;
      }

      // Post-whitening: P2 ^= WK2, P3 ^= WK3
      for (let i = 0; i < 4; i++) {
        P[2][i] ^= this.whiteningKeys[2][i];
        P[3][i] ^= this.whiteningKeys[3][i];
      }

      // Flatten to byte array
      const result = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] = P[i][j];
        }
      }

      return result;
    }

    // Decrypt 16-byte block
    _decryptBlock(block) {
      // Split block into four 32-bit words (C0, C1, C2, C3)
      let C = [];
      for (let i = 0; i < 4; i++) {
        C[i] = [];
        for (let j = 0; j < 4; j++) {
          C[i][j] = block[i * 4 + j];
        }
      }

      // Pre-whitening (inverse): C2 ^= WK2, C3 ^= WK3
      for (let i = 0; i < 4; i++) {
        C[2][i] ^= this.whiteningKeys[2][i];
        C[3][i] ^= this.whiteningKeys[3][i];
      }

      // Main rounds (inverse)
      for (let round = this.rounds - 1; round >= 0; round--) {
        // Inverse rotate state: (C0, C1, C2, C3) -> (C3, C0, C1, C2)
        const temp = C[3];
        C[3] = C[2];
        C[2] = C[1];
        C[1] = C[0];
        C[0] = temp;

        const T0 = this.algorithm._F0(C[1], this.roundKeys[round * 2]);
        const T1 = this.algorithm._F1(C[3], this.roundKeys[round * 2 + 1]);

        // XOR results: C0 ^= T0, C2 ^= T1
        for (let i = 0; i < 4; i++) {
          C[0][i] ^= T0[i];
          C[2][i] ^= T1[i];
        }
      }

      // Post-whitening (inverse): C0 ^= WK0, C1 ^= WK1
      for (let i = 0; i < 4; i++) {
        C[0][i] ^= this.whiteningKeys[0][i];
        C[1][i] ^= this.whiteningKeys[1][i];
      }

      // Flatten to byte array
      const result = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] = C[i][j];
        }
      }

      return result;
    }
  }

  // Register the algorithm immediately
  if (AlgorithmFramework && AlgorithmFramework.RegisterAlgorithm) {
    AlgorithmFramework.RegisterAlgorithm(new CLEFIAAlgorithm());
  }

  return CLEFIAAlgorithm;
}));