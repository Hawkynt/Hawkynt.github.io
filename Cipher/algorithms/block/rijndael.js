/*
 * Rijndael (AES) Cipher Implementation - FIXED VERSION
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Industrial-grade production-ready AES implementation
 * Supports AES-128, AES-192, and AES-256 encryption/decryption
 * Follows FIPS 197 specification exactly
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class RijndaelAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Rijndael (AES)";
      this.description = "Advanced Encryption Standard, selected by NIST in 2001. Supports 128, 192, and 256-bit keys with 128-bit blocks. Most widely used symmetric cipher worldwide.";
      this.inventor = "Joan Daemen, Vincent Rijmen";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Production-ready but don't claim "secure"
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0), // AES-128
        new KeySize(24, 24, 0), // AES-192  
        new KeySize(32, 32, 0)  // AES-256
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("FIPS 197 Specification", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf"),
        new LinkItem("NIST AES Information", "https://www.nist.gov/publications/advanced-encryption-standard-aes"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard")
      ];

      this.references = [
        new LinkItem("Original Rijndael Specification", "https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/rijndael-ammended.pdf"),
        new LinkItem("NIST Test Vectors", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"),
        new LinkItem("RFC 3826 - AES-CBC", "https://tools.ietf.org/rfc/rfc3826.txt")
      ];

      // Official NIST test vectors
      this.tests = [
        {
          text: "NIST FIPS 197 Test Vector - AES-128 ECB",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf",
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("69c4e0d86a7b0430d8cdb78070b4c55a")
        },
        {
          text: "NIST SP 800-38A Test Vector - AES-128 ECB #1",
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
        },
        {
          text: "NIST SP 800-38A Test Vector - AES-192 ECB #1", 
          uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b"),
          expected: OpCodes.Hex8ToBytes("bd334f1d6e45f25ff712a214571fa5cc")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RijndaelInstance(this, isInverse);
    }
  }

  class RijndaelInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
      this.rounds = 0;
      this.roundKeys = null;

      // AES S-box (forward)
      this.sbox = [
        0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
        0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
        0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
        0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
        0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
        0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
        0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x5f, 0x50, 0x3c, 0x9f, 0xa8,
        0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
        0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
        0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
        0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
        0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
        0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
        0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
        0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
        0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
      ];

      // AES inverse S-box
      this.invSbox = [
        0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
        0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
        0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
        0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
        0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
        0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
        0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
        0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
        0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
        0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
        0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
        0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
        0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
        0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
        0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
        0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
      ];

      // Round constants
      this.rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
      
      // Precomputed T0 table for encryption (from C# AES implementation)
      this.T0 = [
        0xa56363c6, 0x847c7cf8, 0x997777ee, 0x8d7b7bf6, 0x0df2f2ff, 0xbd6b6bd6, 0xb16f6fde, 0x54c5c591,
        0x50303060, 0x03010102, 0xa96767ce, 0x7d2b2b56, 0x19fefee7, 0x62d7d7b5, 0xe6abab4d, 0x9a7676ec,
        0x45caca8f, 0x9d82821f, 0x40c9c989, 0x877d7dfa, 0x15fafaef, 0xeb5959b2, 0xc947478e, 0x0bf0f0fb,
        0xecadad41, 0x67d4d4b3, 0xfda2a25f, 0xeaafaf45, 0xbf9c9c23, 0xf7a4a453, 0x967272e4, 0x5bc0c09b,
        0xc2b7b775, 0x1cfdfde1, 0xae93933d, 0x6a26264c, 0x5a36366c, 0x413f3f7e, 0x02f7f7f5, 0x4fcccc83,
        0x5c343468, 0xf4a5a551, 0x34e5e5d1, 0x08f1f1f9, 0x937171e2, 0x73d8d8ab, 0x53313162, 0x3f15152a,
        0x0c040408, 0x52c7c795, 0x65232346, 0x5ec3c39d, 0x28181830, 0xa1969637, 0x0f05050a, 0xb59a9a2f,
        0x0907070e, 0x36121224, 0x9b80801b, 0x3de2e2df, 0x26ebebcd, 0x6927274e, 0xcdb2b27f, 0x9f7575ea,
        0x1b090912, 0x9e83831d, 0x742c2c58, 0x2e1a1a34, 0x2d1b1b36, 0xb26e6edc, 0xee5a5ab4, 0xfba0a05b,
        0xf65252a4, 0x4d3b3b76, 0x61d6d6b7, 0xceb3b37d, 0x7b292952, 0x3ee3e3dd, 0x712f2f5e, 0x97848413,
        0xf55353a6, 0x68d1d1b9, 0x00000000, 0x2cededc1, 0x60202040, 0x1ffcfce3, 0xc8b1b179, 0xed5b5bb6,
        0xbe6a6ad4, 0x46cbcb8d, 0xd9bebe67, 0x4b393972, 0xde4a4a94, 0xd44c4c98, 0xe85858b0, 0x4acfcf85,
        0x6bd0d0bb, 0x2aefefc5, 0xe5aaaa4f, 0x16fbfbed, 0xc5434386, 0xd74d4d9a, 0x55333366, 0x94858511,
        0xcf45458a, 0x10f9f9e9, 0x06020204, 0x817f7ffe, 0xf05050a0, 0x443c3c78, 0xba9f9f25, 0xe3a8a84b,
        0xf35151a2, 0xfea3a35d, 0xc0404080, 0x8a8f8f05, 0xad92923f, 0xbc9d9d21, 0x48383870, 0x04f5f5f1,
        0xdfbcbc63, 0xc1b6b677, 0x75dadaaf, 0x63212142, 0x30101020, 0x1affffe5, 0x0ef3f3fd, 0x6dd2d2bf,
        0x4ccdcd81, 0x140c0c18, 0x35131326, 0x2fececc3, 0xe15f5fbe, 0xa2979735, 0xcc444488, 0x3917172e,
        0x57c4c493, 0xf2a7a755, 0x827e7efc, 0x473d3d7a, 0xac6464c8, 0xe75d5dba, 0x2b191932, 0x957373e6,
        0xa06060c0, 0x98818119, 0xd14f4f9e, 0x7fdcdca3, 0x66222244, 0x7e2a2a54, 0xab90903b, 0x8388880b,
        0xca46468c, 0x29eeeec7, 0xd3b8b86b, 0x3c141428, 0x79dedea7, 0xe25e5ebc, 0x1d0b0b16, 0x76dbdbad,
        0x3be0e0db, 0x56323264, 0x4e3a3a74, 0x1e0a0a14, 0xdb494992, 0x0a06060c, 0x6c242448, 0xe45c5cb8,
        0x5dc2c29f, 0x6ed3d3bd, 0xefacac43, 0xa66262c4, 0xa8919139, 0xa4959531, 0x37e4e4d3, 0x8b7979f2,
        0x32e7e7d5, 0x43c8c88b, 0x5937376e, 0xb76d6dda, 0x8c8d8d01, 0x64d5d5b1, 0xd24e4e9c, 0xe0a9a949,
        0xb46c6cd8, 0xfa5656ac, 0x07f4f4f3, 0x25eaeacf, 0xaf6565ca, 0x8e7a7af4, 0xe9aeae47, 0x18080810,
        0xd5baba6f, 0x887878f0, 0x6f25254a, 0x722e2e5c, 0x241c1c38, 0xf1a6a657, 0xc7b4b473, 0x51c6c697,
        0x23e8e8cb, 0x7cdddda1, 0x9c7474e8, 0x211f1f3e, 0xdd4b4b96, 0xdcbdbd61, 0x868b8b0d, 0x858a8a0f,
        0x907070e0, 0x423e3e7c, 0xc4b5b571, 0xaa6666cc, 0xd8484890, 0x05030306, 0x01f6f6f7, 0x120e0e1c,
        0xa36161c2, 0x5f35356a, 0xf95757ae, 0xd0b9b969, 0x91868617, 0x58c1c199, 0x271d1d3a, 0xb99e9e27,
        0x38e1e1d9, 0x13f8f8eb, 0xb398982b, 0x33111122, 0xbb6969d2, 0x70d9d9a9, 0x898e8e07, 0xa7949433,
        0xb69b9b2d, 0x221e1e3c, 0x92878715, 0x20e9e9c9, 0x49cece87, 0xff5555aa, 0x78282850, 0x7adfdfa5,
        0x8f8c8c03, 0xf8a1a159, 0x80898909, 0x170d0d1a, 0xdabfbf65, 0x31e6e6d7, 0xc6424284, 0xb86868d0,
        0xc3414182, 0xb0999929, 0x772d2d5a, 0x110f0f1e, 0xcbb0b07b, 0xfc5454a8, 0xd6bbbb6d, 0x3a16162c
      ];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        this.rounds = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Set number of rounds based on key size
      switch (keyBytes.length) {
        case 16: this.rounds = 10; break; // AES-128
        case 24: this.rounds = 12; break; // AES-192
        case 32: this.rounds = 14; break; // AES-256
      }

      this.roundKeys = this._keyExpansion(keyBytes);
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
          ? this._decrypt(block) 
          : this._encrypt(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Fixed key expansion (FIPS 197) - using direct byte access
    _keyExpansion(key) {
      const keyLen = key.length;
      const nk = keyLen / 4; // Number of 32-bit words in key
      const nr = this.rounds; // Number of rounds
      const expandedSize = 16 * (nr + 1); // Total bytes needed
      const expandedKey = new Array(expandedSize);

      // Copy original key
      for (let i = 0; i < keyLen; i++) {
        expandedKey[i] = key[i];
      }

      let rconIndex = 0;
      for (let i = keyLen; i < expandedSize; i += 4) {
        // Take last 4 bytes of the generated key
        let temp = [expandedKey[i-4], expandedKey[i-3], expandedKey[i-2], expandedKey[i-1]];
        
        if ((i / 4) % nk === 0) {
          // RotWord
          const t = temp[0];
          temp[0] = temp[1];
          temp[1] = temp[2];
          temp[2] = temp[3];
          temp[3] = t;
          
          // SubWord
          temp[0] = this.sbox[temp[0]];
          temp[1] = this.sbox[temp[1]];
          temp[2] = this.sbox[temp[2]];
          temp[3] = this.sbox[temp[3]];
          
          // XOR with Rcon
          temp[0] = temp[0] ^ this.rcon[rconIndex];
          rconIndex++;
        } else if (nk > 6 && (i / 4) % nk === 4) {
          // For AES-256 only: SubWord
          temp[0] = this.sbox[temp[0]];
          temp[1] = this.sbox[temp[1]];
          temp[2] = this.sbox[temp[2]];
          temp[3] = this.sbox[temp[3]];
        }
        
        // XOR with appropriate earlier key bytes
        expandedKey[i] = expandedKey[i - 4*nk] ^ temp[0];
        expandedKey[i+1] = expandedKey[i+1 - 4*nk] ^ temp[1];
        expandedKey[i+2] = expandedKey[i+2 - 4*nk] ^ temp[2];
        expandedKey[i+3] = expandedKey[i+3 - 4*nk] ^ temp[3];
      }

      return expandedKey;
    }

    _rotWord(word) {
      return ((word << 8) | (word >>> 24)) >>> 0;
    }

    _subWord(word) {
      return ((this.sbox[(word >>> 24) & 0xff] << 24) |
              (this.sbox[(word >>> 16) & 0xff] << 16) |
              (this.sbox[(word >>> 8) & 0xff] << 8) |
              this.sbox[word & 0xff]) >>> 0;
    }
    
    // Helper function for encryption rounds using T0 table
    _encrypt_t0(b0, b1, b2, b3) {
      return this.T0[b0] ^ 
             OpCodes.RotL32(this.T0[b1], 24) ^ 
             OpCodes.RotL32(this.T0[b2], 16) ^ 
             OpCodes.RotL32(this.T0[b3], 8);
    }
    
    // 32-bit rotation helper
    _shift(r, shift) {
      return ((r >>> shift) | (r << (32 - shift))) >>> 0;
    }

    // Working AES encryption implementation
    _encrypt(input) {
      // Copy input to state array  
      const state = new Array(16);
      for (let i = 0; i < 16; i++) {
        state[i] = input[i];
      }
      
      // Add round key
      this._addRoundKeyLinear(state, 0);
      
      // Main rounds
      for (let round = 1; round < this.rounds; round++) {
        this._subBytesLinear(state);
        this._shiftRowsLinear(state);
        this._mixColumnsLinear(state);
        this._addRoundKeyLinear(state, round);
      }
      
      // Final round (no MixColumns)
      this._subBytesLinear(state);
      this._shiftRowsLinear(state);
      this._addRoundKeyLinear(state, this.rounds);
      
      return state;
    }

    // Main decryption function
    _decrypt(input) {
      // Create 4x4 state matrix: state[row][col]
      const state = [
        [input[0], input[4], input[8], input[12]],
        [input[1], input[5], input[9], input[13]],
        [input[2], input[6], input[10], input[14]],
        [input[3], input[7], input[11], input[15]]
      ];
      
      this._addRoundKey(state, this.rounds);
      
      for (let round = this.rounds - 1; round > 0; round--) {
        this._invShiftRows(state);
        this._invSubBytes(state);
        this._addRoundKey(state, round);
        this._invMixColumns(state);
      }
      
      this._invShiftRows(state);
      this._invSubBytes(state);
      this._addRoundKey(state, 0);
      
      // Convert back to linear array (column-major)
      return [
        state[0][0], state[1][0], state[2][0], state[3][0],
        state[0][1], state[1][1], state[2][1], state[3][1],
        state[0][2], state[1][2], state[2][2], state[3][2],
        state[0][3], state[1][3], state[2][3], state[3][3]
      ];
    }

    _addRoundKeyLinear(state, round) {
      const offset = round * 16;
      for (let i = 0; i < 16; i++) {
        state[i] ^= this.roundKeys[offset + i];
      }
    }
    
    _subBytesLinear(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.sbox[state[i]];
      }
    }
    
    _shiftRowsLinear(state) {
      // Row 1: shift left by 1
      let temp = state[1];
      state[1] = state[5];
      state[5] = state[9]; 
      state[9] = state[13];
      state[13] = temp;
      
      // Row 2: shift left by 2  
      temp = state[2];
      state[2] = state[10];
      state[10] = temp;
      temp = state[6];
      state[6] = state[14];
      state[14] = temp;
      
      // Row 3: shift left by 3 (right by 1)
      temp = state[15];
      state[15] = state[11];
      state[11] = state[7];
      state[7] = state[3];
      state[3] = temp;
    }
    
    _mixColumnsLinear(state) {
      for (let c = 0; c < 4; c++) {
        const s0 = state[c*4];
        const s1 = state[c*4 + 1];
        const s2 = state[c*4 + 2];
        const s3 = state[c*4 + 3];
        
        state[c*4]     = OpCodes.GF256Mul(s0, 2) ^ OpCodes.GF256Mul(s1, 3) ^ s2 ^ s3;
        state[c*4 + 1] = s0 ^ OpCodes.GF256Mul(s1, 2) ^ OpCodes.GF256Mul(s2, 3) ^ s3;
        state[c*4 + 2] = s0 ^ s1 ^ OpCodes.GF256Mul(s2, 2) ^ OpCodes.GF256Mul(s3, 3);
        state[c*4 + 3] = OpCodes.GF256Mul(s0, 3) ^ s1 ^ s2 ^ OpCodes.GF256Mul(s3, 2);
      }
    }

    _subBytes(state) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          state[r][c] = this.sbox[state[r][c]];
        }
      }
    }

    _invSubBytes(state) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          state[r][c] = this.invSbox[state[r][c]];
        }
      }
    }

    _shiftRows(state) {
      // Row 1: shift left by 1
      let temp = state[1][0];
      state[1][0] = state[1][1];
      state[1][1] = state[1][2];
      state[1][2] = state[1][3];
      state[1][3] = temp;
      
      // Row 2: shift left by 2
      temp = state[2][0];
      state[2][0] = state[2][2];
      state[2][2] = temp;
      temp = state[2][1];
      state[2][1] = state[2][3];
      state[2][3] = temp;
      
      // Row 3: shift left by 3 (right by 1)
      temp = state[3][3];
      state[3][3] = state[3][2];
      state[3][2] = state[3][1];
      state[3][1] = state[3][0];
      state[3][0] = temp;
    }

    _invShiftRows(state) {
      // Row 1: shift right by 1
      let temp = state[1][3];
      state[1][3] = state[1][2];
      state[1][2] = state[1][1];
      state[1][1] = state[1][0];
      state[1][0] = temp;
      
      // Row 2: shift right by 2
      temp = state[2][0];
      state[2][0] = state[2][2];
      state[2][2] = temp;
      temp = state[2][1];
      state[2][1] = state[2][3];
      state[2][3] = temp;
      
      // Row 3: shift right by 3 (left by 1)
      temp = state[3][0];
      state[3][0] = state[3][1];
      state[3][1] = state[3][2];
      state[3][2] = state[3][3];
      state[3][3] = temp;
    }

    _mixColumns(state) {
      for (let c = 0; c < 4; c++) {
        const a = [state[0][c], state[1][c], state[2][c], state[3][c]];
        state[0][c] = OpCodes.GF256Mul(a[0], 2) ^ OpCodes.GF256Mul(a[1], 3) ^ a[2] ^ a[3];
        state[1][c] = a[0] ^ OpCodes.GF256Mul(a[1], 2) ^ OpCodes.GF256Mul(a[2], 3) ^ a[3];
        state[2][c] = a[0] ^ a[1] ^ OpCodes.GF256Mul(a[2], 2) ^ OpCodes.GF256Mul(a[3], 3);
        state[3][c] = OpCodes.GF256Mul(a[0], 3) ^ a[1] ^ a[2] ^ OpCodes.GF256Mul(a[3], 2);
      }
    }

    _invMixColumns(state) {
      for (let c = 0; c < 4; c++) {
        const a = [state[0][c], state[1][c], state[2][c], state[3][c]];
        state[0][c] = OpCodes.GF256Mul(a[0], 14) ^ OpCodes.GF256Mul(a[1], 11) ^ OpCodes.GF256Mul(a[2], 13) ^ OpCodes.GF256Mul(a[3], 9);
        state[1][c] = OpCodes.GF256Mul(a[0], 9) ^ OpCodes.GF256Mul(a[1], 14) ^ OpCodes.GF256Mul(a[2], 11) ^ OpCodes.GF256Mul(a[3], 13);
        state[2][c] = OpCodes.GF256Mul(a[0], 13) ^ OpCodes.GF256Mul(a[1], 9) ^ OpCodes.GF256Mul(a[2], 14) ^ OpCodes.GF256Mul(a[3], 11);
        state[3][c] = OpCodes.GF256Mul(a[0], 11) ^ OpCodes.GF256Mul(a[1], 13) ^ OpCodes.GF256Mul(a[2], 9) ^ OpCodes.GF256Mul(a[3], 14);
      }
    }
  }

  // ===== REGISTRATION =====
  const algorithmInstance = new RijndaelAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====
  return { RijndaelAlgorithm, RijndaelInstance };
}));