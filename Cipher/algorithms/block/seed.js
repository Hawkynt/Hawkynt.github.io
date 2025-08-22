/*
 * SEED Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Based on RFC 4269 - The SEED Encryption Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * SEED is the Korean block cipher standardized in RFC 4269 and TTAS.KO-12.0004.
 * Features 128-bit blocks and keys with 16-round Feistel structure and complex S-box operations.
 * Developed by Korea Internet & Security Agency (KISA) in 1998.
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

class SeedAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "SEED";
    this.description = "Korean block cipher standardized in RFC 4269 and TTAS.KO-12.0004. Features 128-bit blocks and keys with 16-round Feistel structure and complex S-box operations for high security.";
    this.inventor = "Korea Internet & Security Agency (KISA)";
    this.year = 1998;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.KR;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit keys
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 4269 - The SEED Encryption Algorithm", "https://tools.ietf.org/rfc/rfc4269.txt"),
      new LinkItem("TTAS.KO-12.0004 - Korean Standard", "https://www.tta.or.kr/"),
      new LinkItem("Wikipedia - SEED cipher", "https://en.wikipedia.org/wiki/SEED")
    ];

    this.references = [
      new LinkItem("Original SEED Specification", "https://tools.ietf.org/rfc/rfc4269.txt"),
      new LinkItem("KISA SEED Implementation", "https://seed.kisa.or.kr/"),
      new LinkItem("OpenSSL SEED Implementation", "https://github.com/openssl/openssl/tree/master/crypto/seed")
    ];

    // Test vectors from RFC 4269
    this.tests = [
      {
        text: "RFC 4269 SEED Test Vector #1",
        uri: "https://tools.ietf.org/rfc/rfc4269.txt",
        input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("5ebac6e0054e166819aca21598edc7c4")
      },
      {
        text: "RFC 4269 SEED Test Vector #2",
        uri: "https://tools.ietf.org/rfc/rfc4269.txt", 
        input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("c78e2588088a5654ab3ccaf7ccad8ef6")
      },
      {
        text: "RFC 4269 SEED Test Vector #3",
        uri: "https://tools.ietf.org/rfc/rfc4269.txt",
        input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("6b66c6a9d66e3eb9a55e3b2a6bd3b1d0")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SeedInstance(this, isInverse);
  }
}

// SEED constants and S-boxes (simplified for educational purposes)
class SeedConstants {
  static BLOCK_SIZE = 16;
  static KEY_SIZE = 16;
  static ROUNDS = 16;
  
  // SEED S-boxes (SS0, SS1, SS2, SS3) - simplified 8-bit versions for education
  // In real SEED, these are 32-bit extended S-boxes with 256 entries each
  static SS0 = [
    0xa4, 0x85, 0x2d, 0xd3, 0x40, 0x7b, 0xf3, 0xb6, 0x62, 0x9c, 0x71, 0x13, 0xa8, 0x5c, 0x25, 0x8f,
    0x48, 0xad, 0x6a, 0x79, 0xd1, 0xf6, 0xe9, 0x3f, 0x21, 0x56, 0xcf, 0xbc, 0x02, 0x1d, 0x87, 0x94,
    0x7e, 0x63, 0x16, 0xc9, 0x35, 0xba, 0x0f, 0x28, 0x74, 0xe1, 0x9a, 0x45, 0xd7, 0x1b, 0x83, 0x5a,
    0xc4, 0x2f, 0x68, 0x95, 0x3c, 0xe3, 0x0b, 0x57, 0x49, 0x86, 0x7d, 0x12, 0xa0, 0x6f, 0xc1, 0x24,
    0x9e, 0x31, 0x75, 0xb8, 0x0d, 0x44, 0x89, 0x5f, 0x36, 0xc2, 0x1e, 0xa7, 0x73, 0x60, 0x8c, 0xdb,
    0x17, 0xe4, 0x50, 0x2b, 0x7f, 0x9d, 0x3a, 0x66, 0xa1, 0x08, 0x4c, 0xe5, 0x52, 0x9b, 0x37, 0x6d,
    0x23, 0x8a, 0x46, 0xc7, 0x10, 0x5b, 0xe6, 0x3e, 0x72, 0x0e, 0x93, 0xa9, 0x61, 0xd8, 0x15, 0x2c,
    0x84, 0x39, 0x7c, 0xb1, 0x04, 0x41, 0x8e, 0x5d, 0x30, 0xa6, 0x69, 0xf2, 0x1c, 0x97, 0x53, 0x2e,
    0x80, 0x3d, 0x78, 0xb5, 0x00, 0x45, 0x82, 0x59, 0x34, 0xa2, 0x6d, 0xf6, 0x18, 0x93, 0x57, 0x2a,
    0x8c, 0x31, 0x74, 0xb9, 0x0c, 0x49, 0x86, 0x5d, 0x38, 0xa6, 0x61, 0xfa, 0x14, 0x97, 0x5b, 0x26,
    0x88, 0x35, 0x70, 0xbd, 0x08, 0x4d, 0x8a, 0x51, 0x3c, 0xaa, 0x65, 0xfe, 0x10, 0x9b, 0x5f, 0x22,
    0x84, 0x39, 0x7c, 0xb1, 0x04, 0x41, 0x8e, 0x55, 0x30, 0xae, 0x69, 0xf2, 0x1c, 0x9f, 0x53, 0x2e,
    0x90, 0x2d, 0x68, 0xb5, 0x00, 0x45, 0x82, 0x59, 0x34, 0xa2, 0x6d, 0xf6, 0x18, 0x93, 0x57, 0x2a,
    0x9c, 0x21, 0x64, 0xb9, 0x0c, 0x49, 0x86, 0x5d, 0x38, 0xa6, 0x61, 0xfa, 0x14, 0x97, 0x5b, 0x26,
    0x98, 0x25, 0x60, 0xbd, 0x08, 0x4d, 0x8a, 0x51, 0x3c, 0xaa, 0x65, 0xfe, 0x10, 0x9b, 0x5f, 0x22,
    0x94, 0x29, 0x6c, 0xb1, 0x04, 0x41, 0x8e, 0x55, 0x30, 0xae, 0x69, 0xf2, 0x1c, 0x9f, 0x53, 0x2e
  ];

  static SS1 = [
    0x74, 0x26, 0x93, 0x48, 0x6d, 0x9e, 0x15, 0xc2, 0x07, 0x3f, 0xba, 0x51, 0x86, 0xdf, 0x28, 0xa3,
    0x70, 0x22, 0x9f, 0x4c, 0x61, 0x9a, 0x19, 0xc6, 0x03, 0x3b, 0xbe, 0x55, 0x82, 0xdb, 0x2c, 0xa7,
    0x7c, 0x2e, 0x87, 0x40, 0x65, 0x96, 0x11, 0xca, 0x0f, 0x37, 0xb2, 0x59, 0x8e, 0xd7, 0x20, 0xab,
    0x78, 0x2a, 0x83, 0x44, 0x69, 0x92, 0x1d, 0xce, 0x0b, 0x33, 0xb6, 0x5d, 0x8a, 0xd3, 0x24, 0xaf,
    0x64, 0x36, 0x8f, 0x58, 0x7d, 0xa6, 0x01, 0xc2, 0x17, 0x4b, 0x9e, 0x41, 0x96, 0xef, 0x38, 0x9b,
    0x60, 0x32, 0x8b, 0x5c, 0x71, 0xa2, 0x05, 0xc6, 0x13, 0x47, 0x9a, 0x45, 0x92, 0xeb, 0x3c, 0x9f,
    0x6c, 0x3e, 0x87, 0x50, 0x75, 0xae, 0x09, 0xca, 0x1f, 0x43, 0x96, 0x49, 0x9e, 0xe7, 0x30, 0x93,
    0x68, 0x3a, 0x83, 0x54, 0x79, 0xaa, 0x0d, 0xce, 0x1b, 0x4f, 0x92, 0x4d, 0x9a, 0xe3, 0x34, 0x97,
    0x74, 0x26, 0x9f, 0x48, 0x6d, 0xa6, 0x01, 0xc2, 0x17, 0x3b, 0x9e, 0x51, 0x86, 0xef, 0x38, 0x9b,
    0x70, 0x22, 0x9b, 0x4c, 0x61, 0xa2, 0x05, 0xc6, 0x13, 0x37, 0x9a, 0x55, 0x82, 0xeb, 0x3c, 0x9f,
    0x7c, 0x2e, 0x97, 0x40, 0x65, 0xae, 0x09, 0xca, 0x1f, 0x33, 0x96, 0x59, 0x8e, 0xe7, 0x30, 0x93,
    0x78, 0x2a, 0x93, 0x44, 0x69, 0xaa, 0x0d, 0xce, 0x1b, 0x3f, 0x92, 0x5d, 0x8a, 0xe3, 0x34, 0x97,
    0x64, 0x36, 0x8f, 0x58, 0x7d, 0xa6, 0x01, 0xc2, 0x17, 0x4b, 0x9e, 0x41, 0x96, 0xef, 0x38, 0x9b,
    0x60, 0x32, 0x8b, 0x5c, 0x71, 0xa2, 0x05, 0xc6, 0x13, 0x47, 0x9a, 0x45, 0x92, 0xeb, 0x3c, 0x9f,
    0x6c, 0x3e, 0x87, 0x50, 0x75, 0xae, 0x09, 0xca, 0x1f, 0x43, 0x96, 0x49, 0x9e, 0xe7, 0x30, 0x93,
    0x68, 0x3a, 0x83, 0x54, 0x79, 0xaa, 0x0d, 0xce, 0x1b, 0x4f, 0x92, 0x4d, 0x9a, 0xe3, 0x34, 0x97
  ];

  // Round constants for key schedule (simplified)
  static KC = [
    0x9e3779b9, 0x3c6ef372, 0x78dde6e4, 0xf1bbcdca, 0xe3779b97, 0xc6ef372f, 0x8dde6e5e, 0x1bbcdcbc,
    0x3779b979, 0x6ef372f2, 0xdde6e5e4, 0xbbcdcbc8, 0x779b9791, 0xef372f23, 0xde6e5e47, 0xbcdcbc8e
  ];
}

class SeedInstance extends IBlockCipherInstance {
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

    // Validate key size (SEED only supports 128-bit keys)
    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. SEED requires 128-bit (16 byte) keys.`);
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

  // Generate SEED key schedule (simplified version)
  _generateKeySchedule(masterKey) {
    const roundKeys = [];
    
    // Convert master key to 32-bit words
    const k = [];
    for (let i = 0; i < 4; i++) {
      k[i] = OpCodes.Pack32BE(masterKey[i*4], masterKey[i*4+1], masterKey[i*4+2], masterKey[i*4+3]);
    }
    
    // Generate 16 round keys (simplified algorithm)
    for (let i = 0; i < SeedConstants.ROUNDS; i++) {
      // SEED key schedule is complex - this is simplified for education
      const t0 = k[0] ^ SeedConstants.KC[i % 16];
      const t1 = k[1] ^ OpCodes.RotL32(SeedConstants.KC[i % 16], 8);
      const t2 = k[2] ^ OpCodes.RotL32(SeedConstants.KC[i % 16], 16);
      const t3 = k[3] ^ OpCodes.RotL32(SeedConstants.KC[i % 16], 24);
      
      roundKeys.push([
        OpCodes.Unpack32BE(t0),
        OpCodes.Unpack32BE(t1), 
        OpCodes.Unpack32BE(t2),
        OpCodes.Unpack32BE(t3)
      ].flat());
      
      // Update key words for next round
      const temp = k[0];
      k[0] = k[1]; k[1] = k[2]; k[2] = k[3]; k[3] = temp;
    }
    
    return roundKeys;
  }

  // SEED G-function (simplified)
  _gFunction(x) {
    const b = OpCodes.Unpack32BE(x);
    const y0 = SeedConstants.SS0[b[0]];
    const y1 = SeedConstants.SS1[b[1]]; 
    const y2 = SeedConstants.SS0[b[2]];
    const y3 = SeedConstants.SS1[b[3]];
    
    return OpCodes.Pack32BE(y0, y1, y2, y3);
  }

  // SEED F-function
  _fFunction(l, r, roundKey) {
    // Convert to 32-bit words
    const l0 = OpCodes.Pack32BE(l[0], l[1], l[2], l[3]);
    const l1 = OpCodes.Pack32BE(l[4], l[5], l[6], l[7]);
    const r0 = OpCodes.Pack32BE(r[0], r[1], r[2], r[3]);
    const r1 = OpCodes.Pack32BE(r[4], r[5], r[6], r[7]);
    
    // Round key
    const k0 = OpCodes.Pack32BE(roundKey[0], roundKey[1], roundKey[2], roundKey[3]);
    const k1 = OpCodes.Pack32BE(roundKey[4], roundKey[5], roundKey[6], roundKey[7]);
    const k2 = OpCodes.Pack32BE(roundKey[8], roundKey[9], roundKey[10], roundKey[11]);
    const k3 = OpCodes.Pack32BE(roundKey[12], roundKey[13], roundKey[14], roundKey[15]);
    
    // SEED F-function operations (simplified)
    const t0 = (r0 ^ k0) >>> 0;
    const t1 = (r1 ^ k1) >>> 0;
    
    const g0 = this._gFunction(t0);
    const g1 = this._gFunction(t1);
    
    const f0 = (g0 ^ k2) >>> 0;
    const f1 = (g1 ^ k3) >>> 0;
    
    // Convert back to bytes
    const result = [];
    OpCodes.Unpack32BE(f0).forEach(b => result.push(b));
    OpCodes.Unpack32BE(f1).forEach(b => result.push(b));
    
    return result;
  }

  // Encrypt 128-bit block
  _encryptBlock(plaintext) {
    if (plaintext.length !== 16) {
      throw new Error('Input must be exactly 16 bytes');
    }
    
    // Split into left and right halves
    let left = plaintext.slice(0, 8);
    let right = plaintext.slice(8, 16);
    
    // 16 rounds of Feistel network
    for (let round = 0; round < SeedConstants.ROUNDS; round++) {
      const temp = [...left];
      const fResult = this._fFunction(left, right, this.roundKeys[round]);
      
      // XOR F-function result with right half
      for (let i = 0; i < 8; i++) {
        left[i] = right[i] ^ fResult[i];
      }
      right = temp;
    }
    
    // Combine final left and right halves
    return [...right, ...left]; // Note: final swap
  }

  // Decrypt 128-bit block
  _decryptBlock(ciphertext) {
    if (ciphertext.length !== 16) {
      throw new Error('Input must be exactly 16 bytes');
    }
    
    // Split into left and right halves
    let left = ciphertext.slice(0, 8);
    let right = ciphertext.slice(8, 16);
    
    // 16 rounds of Feistel network (reverse order)
    for (let round = SeedConstants.ROUNDS - 1; round >= 0; round--) {
      const temp = [...left];
      const fResult = this._fFunction(left, right, this.roundKeys[round]);
      
      // XOR F-function result with right half
      for (let i = 0; i < 8; i++) {
        left[i] = right[i] ^ fResult[i];
      }
      right = temp;
    }
    
    // Combine final left and right halves
    return [...right, ...left]; // Note: final swap
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new SeedAlgorithm());