/*
 * SM4 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Based on GB/T 32907-2016 - SM4 Block Cipher Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * SM4 is the Chinese national standard block cipher also known as SMS4.
 * Features 128-bit blocks and keys with 32-round substitution-permutation network.
 * Developed by Lu Shuiwang et al. and standardized in China in 2016.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class Sm4Algorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "SM4";
    this.description = "Chinese national standard block cipher (GB/T 32907-2016, also known as SMS4). Features 128-bit blocks and keys with 32-round substitution-permutation network for high security.";
    this.inventor = "Lu Shuiwang, et al.";
    this.year = 2006;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.CN;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit keys
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("GB/T 32907-2016 - SM4 Block Cipher Algorithm", "https://tools.ietf.org/rfc/rfc8018.txt"),
      new LinkItem("IETF RFC 8018 - SMS4 Encryption Algorithm", "https://tools.ietf.org/rfc/rfc8018.txt"),
      new LinkItem("Wikipedia - SM4 cipher", "https://en.wikipedia.org/wiki/SM4_(cipher)")
    ];

    this.references = [
      new LinkItem("Original SM4 Specification", "http://www.oscca.gov.cn/sca/xxgk/2016-08/17/content_1002386.shtml"),
      new LinkItem("OpenSSL SM4 Implementation", "https://github.com/openssl/openssl/tree/master/crypto/sm4"),
      new LinkItem("GmSSL Implementation", "https://github.com/guanzhi/GmSSL")
    ];

    // Test vectors from official specifications
    this.tests = [
      {
        text: "SM4 Official Test Vector #1",
        uri: "GB/T 32907-2016",
        input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        expected: OpCodes.Hex8ToBytes("681edf34d206965e86b3e94f536e4246")
      },
      {
        text: "SM4 Test Vector #2 - All Zeros",
        uri: "Educational test",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        expected: OpCodes.Hex8ToBytes("595298c7c6fd271f0402f804c33d3f66")
      },
      {
        text: "SM4 Test Vector #3 - Pattern Test",
        uri: "Educational test",
        input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("f766678f13f36996b50c47b4959ee71d")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new Sm4Instance(this, isInverse);
  }
}

// SM4 constants and S-box
class Sm4Constants {
  static BLOCK_SIZE = 16;
  static KEY_SIZE = 16;
  static ROUNDS = 32;
  
  // SM4 S-box (from GB/T 32907-2016)
  static SBOX = [
    0xd6, 0x90, 0xe9, 0xfe, 0xcc, 0xe1, 0x3d, 0xb7, 0x16, 0xb6, 0x14, 0xc2, 0x28, 0xfb, 0x2c, 0x05,
    0x2b, 0x67, 0x9a, 0x76, 0x2a, 0xbe, 0x04, 0xc3, 0xaa, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
    0x9c, 0x42, 0x50, 0xf4, 0x91, 0xef, 0x98, 0x7a, 0x33, 0x54, 0x0b, 0x43, 0xed, 0xcf, 0xac, 0x62,
    0xe4, 0xb3, 0x1c, 0xa9, 0xc9, 0x08, 0xe8, 0x95, 0x80, 0xdf, 0x94, 0xfa, 0x75, 0x8f, 0x3f, 0xa6,
    0x47, 0x07, 0xa7, 0xfc, 0xf3, 0x73, 0x17, 0xba, 0x83, 0x59, 0x3c, 0x19, 0xe6, 0x85, 0x4f, 0xa8,
    0x68, 0x6b, 0x81, 0xb2, 0x71, 0x64, 0xda, 0x8b, 0xf8, 0xeb, 0x0f, 0x4b, 0x70, 0x56, 0x9d, 0x35,
    0x1e, 0x24, 0x0e, 0x5e, 0x63, 0x58, 0xd1, 0xa2, 0x25, 0x22, 0x7c, 0x3b, 0x01, 0x21, 0x78, 0x87,
    0xd4, 0x00, 0x46, 0x57, 0x9f, 0xd3, 0x27, 0x52, 0x4c, 0x36, 0x02, 0xe7, 0xa0, 0xc4, 0xc8, 0x9e,
    0xea, 0xbf, 0x8a, 0xd2, 0x40, 0xc7, 0x38, 0xb5, 0xa3, 0xf7, 0xf2, 0xce, 0xf9, 0x61, 0x15, 0xa1,
    0xe0, 0xae, 0x5d, 0xa4, 0x9b, 0x34, 0x1a, 0x55, 0xad, 0x93, 0x32, 0x30, 0xf5, 0x8c, 0xb1, 0xe3,
    0x1d, 0xf6, 0xe2, 0x2e, 0x82, 0x66, 0xca, 0x60, 0xc0, 0x29, 0x23, 0xab, 0x0d, 0x53, 0x4e, 0x6f,
    0xd5, 0xdb, 0x37, 0x45, 0xde, 0xfd, 0x8e, 0x2f, 0x03, 0xff, 0x6a, 0x72, 0x6d, 0x6c, 0x5b, 0x51,
    0x8d, 0x1b, 0xaf, 0x92, 0xbb, 0xdd, 0xbc, 0x7f, 0x11, 0xd9, 0x5c, 0x41, 0x1f, 0x10, 0x5a, 0xd8,
    0x0a, 0xc1, 0x31, 0x88, 0xa5, 0xcd, 0x7b, 0xbd, 0x2d, 0x74, 0xd0, 0x12, 0xb8, 0xe5, 0xb4, 0xb0,
    0x89, 0x69, 0x97, 0x4a, 0x0c, 0x96, 0x77, 0x7e, 0x65, 0xb9, 0xf1, 0x09, 0xc5, 0x6e, 0xc6, 0x84,
    0x18, 0xf0, 0x7d, 0xec, 0x3a, 0xdc, 0x4d, 0x20, 0x79, 0xee, 0x5f, 0x3e, 0xd7, 0xcb, 0x39, 0x48
  ];

  // System constants for key expansion (fixed constants FK)
  static FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];

  // Round constants for key expansion (constant CK)
  static CK = [
    0x00070e15, 0x1c232a31, 0x383f464d, 0x545b6269,
    0x70777e85, 0x8c939aa1, 0xa8afb6bd, 0xc4cbd2d9,
    0xe0e7eef5, 0xfc030a11, 0x181f262d, 0x343b4249,
    0x50575e65, 0x6c737a81, 0x888f969d, 0xa4abb2b9,
    0xc0c7ced5, 0xdce3eaf1, 0xf8ff060d, 0x141b2229,
    0x30373e45, 0x4c535a61, 0x686f767d, 0x848b9299,
    0xa0a7aeb5, 0xbcc3cad1, 0xd8dfe6ed, 0xf4fb0209,
    0x10171e25, 0x2c333a41, 0x484f565d, 0x646b7279
  ];
}

class Sm4Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size (SM4 only supports 128-bit keys)
    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. SM4 requires 128-bit (16 byte) keys.`);
    }

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    this.roundKeys = this._generateKeySchedule(keyBytes);
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

  // Generate SM4 key schedule
  _generateKeySchedule(masterKey) {
    const roundKeys = [];
    
    // Convert master key to 32-bit words (big-endian)
    const mk = [];
    for (let i = 0; i < 4; i++) {
      mk[i] = OpCodes.Pack32BE(masterKey[i*4], masterKey[i*4+1], masterKey[i*4+2], masterKey[i*4+3]);
    }
    
    // Initialize K values with FK constants
    const k = [];
    for (let i = 0; i < 4; i++) {
      k[i] = mk[i] ^ Sm4Constants.FK[i];
    }
    
    // Generate 32 round keys
    for (let i = 0; i < 32; i++) {
      const temp = k[(i+1) % 4] ^ k[(i+2) % 4] ^ k[(i+3) % 4] ^ Sm4Constants.CK[i];
      const rk = k[i % 4] ^ this._tPrime(temp);
      roundKeys.push(rk);
      k[(i+4) % 4] = rk;
    }
    
    return roundKeys;
  }

  // SM4 S-box transformation (τ function)
  _tau(input) {
    const bytes = OpCodes.Unpack32BE(input);
    const output = [];
    
    for (let i = 0; i < 4; i++) {
      output[i] = Sm4Constants.SBOX[bytes[i]];
    }
    
    return OpCodes.Pack32BE(output[0], output[1], output[2], output[3]);
  }

  // SM4 linear transformation L for encryption (L function)
  _L(input) {
    return input ^ OpCodes.RotL32(input, 2) ^ OpCodes.RotL32(input, 10) ^ OpCodes.RotL32(input, 18) ^ OpCodes.RotL32(input, 24);
  }

  // SM4 linear transformation L' for key expansion (L' function)
  _LPrime(input) {
    return input ^ OpCodes.RotL32(input, 13) ^ OpCodes.RotL32(input, 23);
  }

  // SM4 combined transformation T for encryption
  _T(input) {
    return this._L(this._tau(input));
  }

  // SM4 combined transformation T' for key expansion
  _tPrime(input) {
    return this._LPrime(this._tau(input));
  }

  // Encrypt 128-bit block
  _encryptBlock(plaintext) {
    if (plaintext.length !== 16) {
      throw new Error('Input must be exactly 16 bytes');
    }
    
    // Convert to 32-bit words (big-endian)
    const x = [];
    for (let i = 0; i < 4; i++) {
      x[i] = OpCodes.Pack32BE(plaintext[i*4], plaintext[i*4+1], plaintext[i*4+2], plaintext[i*4+3]);
    }
    
    // 32 rounds of SM4 transformation
    for (let i = 0; i < 32; i++) {
      const temp = x[1] ^ x[2] ^ x[3] ^ this.roundKeys[i];
      x[(i+4) % 4] = x[i % 4] ^ this._T(temp);
      
      // Rotate the array
      if (i < 31) {
        const temp2 = x[0];
        x[0] = x[1]; x[1] = x[2]; x[2] = x[3]; x[3] = temp2;
      }
    }
    
    // Reverse transformation (R function)
    const result = [];
    OpCodes.Unpack32BE(x[3]).forEach(b => result.push(b));
    OpCodes.Unpack32BE(x[2]).forEach(b => result.push(b));
    OpCodes.Unpack32BE(x[1]).forEach(b => result.push(b));
    OpCodes.Unpack32BE(x[0]).forEach(b => result.push(b));
    
    return result;
  }

  // Decrypt 128-bit block
  _decryptBlock(ciphertext) {
    if (ciphertext.length !== 16) {
      throw new Error('Input must be exactly 16 bytes');
    }
    
    // Convert to 32-bit words (big-endian)
    const x = [];
    for (let i = 0; i < 4; i++) {
      x[i] = OpCodes.Pack32BE(ciphertext[i*4], ciphertext[i*4+1], ciphertext[i*4+2], ciphertext[i*4+3]);
    }
    
    // 32 rounds of SM4 transformation with reverse key order
    for (let i = 0; i < 32; i++) {
      const temp = x[1] ^ x[2] ^ x[3] ^ this.roundKeys[31-i];
      x[(i+4) % 4] = x[i % 4] ^ this._T(temp);
      
      // Rotate the array
      if (i < 31) {
        const temp2 = x[0];
        x[0] = x[1]; x[1] = x[2]; x[2] = x[3]; x[3] = temp2;
      }
    }
    
    // Reverse transformation (R function)
    const result = [];
    OpCodes.Unpack32BE(x[3]).forEach(b => result.push(b));
    OpCodes.Unpack32BE(x[2]).forEach(b => result.push(b));
    OpCodes.Unpack32BE(x[1]).forEach(b => result.push(b));
    OpCodes.Unpack32BE(x[0]).forEach(b => result.push(b));
    
    return result;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new Sm4Algorithm());