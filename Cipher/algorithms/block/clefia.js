/*
 * CLEFIA Block Cipher Implementation
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
        new LinkItem("RFC 6114: The 128-Bit Blockcipher CLEFIA", "https://tools.ietf.org/rfc/rfc6114.txt"),
        new LinkItem("ISO/IEC 29192-2:2012", "https://www.iso.org/standard/56552.html")
      ];

      this.references = [
        new LinkItem("CLEFIA FSE 2007 Paper", "https://link.springer.com/chapter/10.1007/978-3-540-74619-5_12"),
        new LinkItem("Sony CLEFIA Page", "https://www.sony.net/Products/cryptography/clefia/")
      ];

      // Test vectors from RFC 6114
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"), // input
          OpCodes.Hex8ToBytes("de2bf2fd9b74aacdf1298555459494fd"), // expected
          "CLEFIA-128 RFC 6114 test vector",
          "https://tools.ietf.org/rfc/rfc6114.txt"
        )
      ];
      // Additional property for key in test vector
      this.tests[0].key = OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100");
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new CLEFIAInstance(this, isInverse);
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
      this.inputBuffer = [];

      return output;
    }

    // Galois Field multiplication for diffusion matrix
    _gfMul(a, b) {
      let result = 0;
      for (let i = 0; i < 8; i++) {
        if (b & 1) {
          result ^= a;
        }
        const msb = a & 0x80;
        a <<= 1;
        if (msb) {
          a ^= 0x87; // Irreducible polynomial for AES
        }
        b >>>= 1;
      }
      return result & 0xFF;
    }

    // F-function F0 using S0 and M0
    _F0(input, rk) {
      const y = [];
      // XOR with round key
      for (let i = 0; i < 4; i++) {
        y[i] = input[i] ^ rk[i];
      }

      // S-box substitution using S0
      for (let i = 0; i < 4; i++) {
        y[i] = S0[y[i]];
      }

      // Diffusion using M0
      const output = [];
      for (let i = 0; i < 4; i++) {
        output[i] = 0;
        for (let j = 0; j < 4; j++) {
          output[i] ^= this._gfMul(M0[i][j], y[j]);
        }
      }

      return output;
    }

    // F-function F1 using S1 and M1
    _F1(input, rk) {
      const y = [];
      // XOR with round key
      for (let i = 0; i < 4; i++) {
        y[i] = input[i] ^ rk[i];
      }

      // S-box substitution using S1
      for (let i = 0; i < 4; i++) {
        y[i] = S1[y[i]];
      }

      // Diffusion using M1
      const output = [];
      for (let i = 0; i < 4; i++) {
        output[i] = 0;
        for (let j = 0; j < 4; j++) {
          output[i] ^= this._gfMul(M1[i][j], y[j]);
        }
      }

      return output;
    }

    // Generate round keys and whitening keys (simplified version)
    _generateKeys() {
      this.roundKeys = [];
      this.whiteningKeys = [];

      // Initialize whitening keys
      for (let i = 0; i < 4; i++) {
        this.whiteningKeys[i] = [];
        for (let j = 0; j < 4; j++) {
          this.whiteningKeys[i][j] = this._key[(i * 4 + j) % this.KeySize];
        }
      }

      // Generate round keys (simplified - real implementation uses complex key schedule)
      for (let round = 0; round < this.rounds * 2; round++) {
        this.roundKeys[round] = [];
        for (let i = 0; i < 4; i++) {
          this.roundKeys[round][i] = this._key[(round * 4 + i) % this.KeySize] ^ round;
        }
      }
    }

    // Encrypt 16-byte block
    _encryptBlock(block) {
      // Split block into four 32-bit words
      let P = [];
      for (let i = 0; i < 4; i++) {
        P[i] = [];
        for (let j = 0; j < 4; j++) {
          P[i][j] = block[i * 4 + j];
        }
      }

      // Pre-whitening
      for (let i = 0; i < 4; i++) {
        P[0][i] ^= this.whiteningKeys[0][i];
        P[1][i] ^= this.whiteningKeys[1][i];
      }

      // Main rounds
      for (let round = 0; round < this.rounds; round++) {
        const T0 = this._F0(P[1], this.roundKeys[round * 2]);
        const T1 = this._F1(P[3], this.roundKeys[round * 2 + 1]);

        // XOR results
        for (let i = 0; i < 4; i++) {
          P[0][i] ^= T0[i];
          P[2][i] ^= T1[i];
        }

        // Rotate state
        const temp = P[0];
        P[0] = P[1];
        P[1] = P[2];
        P[2] = P[3];
        P[3] = temp;
      }

      // Post-whitening
      for (let i = 0; i < 4; i++) {
        P[0][i] ^= this.whiteningKeys[2][i];
        P[1][i] ^= this.whiteningKeys[3][i];
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
      // Split block into four 32-bit words
      let C = [];
      for (let i = 0; i < 4; i++) {
        C[i] = [];
        for (let j = 0; j < 4; j++) {
          C[i][j] = block[i * 4 + j];
        }
      }

      // Pre-whitening (inverse)
      for (let i = 0; i < 4; i++) {
        C[0][i] ^= this.whiteningKeys[2][i];
        C[1][i] ^= this.whiteningKeys[3][i];
      }

      // Main rounds (inverse)
      for (let round = this.rounds - 1; round >= 0; round--) {
        // Inverse rotate state
        const temp = C[3];
        C[3] = C[2];
        C[2] = C[1];
        C[1] = C[0];
        C[0] = temp;

        const T0 = this._F0(C[1], this.roundKeys[round * 2]);
        const T1 = this._F1(C[3], this.roundKeys[round * 2 + 1]);

        // XOR results
        for (let i = 0; i < 4; i++) {
          C[0][i] ^= T0[i];
          C[2][i] ^= T1[i];
        }
      }

      // Post-whitening (inverse)
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

  // ===== REGISTRATION =====

    const algorithmInstance = new CLEFIAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CLEFIAAlgorithm, CLEFIAInstance };
}));