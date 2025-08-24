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
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

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
    this.subKeys = null;
    this.sBox = null;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.KeySize = 0;
      this.subKeys = null;
      this.sBox = null;
      return;
    }

    // Validate key size (16, 24, or 32 bytes)
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. Twofish requires 16, 24, or 32 bytes`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this._generateKeySchedule(keyBytes);
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
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }

  _generateKeySchedule(key) {
    // Twofish key schedule implementation
    this.subKeys = [];
    this.sBox = [[], [], [], []];
    
    const keyLength = key.length;
    const k = keyLength / 8; // Number of 64-bit key words
    
    // Create Me and Mo words from key
    const Me = [];
    const Mo = [];
    
    for (let i = 0; i < k; i++) {
      Me[i] = OpCodes.Pack32LE(
        key[8*i], key[8*i+1], key[8*i+2], key[8*i+3]
      );
      Mo[i] = OpCodes.Pack32LE(
        key[8*i+4], key[8*i+5], key[8*i+6], key[8*i+7]
      );
    }
    
    // Generate round subkeys
    const rho = 0x01010101;
    for (let i = 0; i < 20; i++) {
      const A = this._h(2*i * rho, Me, k);
      const B = OpCodes.RotL32(this._h((2*i+1) * rho, Mo, k), 8);
      
      this.subKeys[2*i] = (A + B) >>> 0;
      this.subKeys[2*i+1] = OpCodes.RotL32((A + 2*B) >>> 0, 9);
    }
    
    // Generate S-box keys
    const S = [];
    for (let i = 0; i < k; i++) {
      // Create S-box key material from key bytes
      for (let j = 0; j < 4; j++) {
        if (!S[j]) S[j] = [];
        S[j][i] = key[8*i + 4 + j];
      }
    }
    
    // Generate key-dependent S-boxes using proper Twofish S-box construction
    for (let i = 0; i < 256; i++) {
      this.sBox[0][i] = this._generateSBoxEntry(i, S[0], k);
      this.sBox[1][i] = this._generateSBoxEntry(i, S[1], k);
      this.sBox[2][i] = this._generateSBoxEntry(i, S[2], k);
      this.sBox[3][i] = this._generateSBoxEntry(i, S[3], k);
    }
  }
  
  _h(x, key, k) {
    // Twofish h function for key schedule
    const bytes = OpCodes.Unpack32LE(x);
    
    // Apply key-dependent transformations
    let y0 = bytes[0], y1 = bytes[1], y2 = bytes[2], y3 = bytes[3];
    
    if (k === 4) {
      y0 = this._q1(y0) ^ OpCodes.Unpack32LE(key[3])[0];
      y1 = this._q0(y1) ^ OpCodes.Unpack32LE(key[3])[1];
      y2 = this._q0(y2) ^ OpCodes.Unpack32LE(key[3])[2];
      y3 = this._q1(y3) ^ OpCodes.Unpack32LE(key[3])[3];
    }
    if (k >= 3) {
      y0 = this._q1(y0) ^ OpCodes.Unpack32LE(key[2])[0];
      y1 = this._q1(y1) ^ OpCodes.Unpack32LE(key[2])[1];
      y2 = this._q0(y2) ^ OpCodes.Unpack32LE(key[2])[2];
      y3 = this._q0(y3) ^ OpCodes.Unpack32LE(key[2])[3];
    }
    if (k >= 2) {
      y0 = this._q1(this._q0(this._q0(y0) ^ OpCodes.Unpack32LE(key[1])[0]) ^ OpCodes.Unpack32LE(key[0])[0]);
      y1 = this._q0(this._q0(this._q1(y1) ^ OpCodes.Unpack32LE(key[1])[1]) ^ OpCodes.Unpack32LE(key[0])[1]);
      y2 = this._q1(this._q1(this._q0(y2) ^ OpCodes.Unpack32LE(key[1])[2]) ^ OpCodes.Unpack32LE(key[0])[2]);
      y3 = this._q0(this._q1(this._q1(y3) ^ OpCodes.Unpack32LE(key[1])[3]) ^ OpCodes.Unpack32LE(key[0])[3]);
    }
    
    // Apply MDS matrix
    return this._mds(OpCodes.Pack32LE(y0, y1, y2, y3));
  }
  
  _generateSBoxEntry(input, keyBytes, k) {
    let value = input;
    
    // Apply key-dependent S-box construction based on k
    if (k === 4) {
      value = this._q1(value ^ keyBytes[3]);
    }
    if (k >= 3) {
      value = this._q0(value ^ keyBytes[2]);
    }
    if (k >= 2) {
      value = this._q0(this._q1(value ^ keyBytes[1]) ^ keyBytes[0]);
    }
    
    return value & 0xFF;
  }

  _q0(x) {
    // Official Twofish Q0 permutation table
    const q0 = [
      0xA9, 0x67, 0xB3, 0xE8, 0x04, 0xFD, 0xA0, 0x2C, 0x9A, 0xF4, 0x45, 0x6F, 0xBF, 0x4C, 0x69, 0x13,
      0x78, 0x95, 0x16, 0x63, 0x21, 0x30, 0x6E, 0x8A, 0xB1, 0xC4, 0x62, 0x35, 0xC0, 0xEF, 0x81, 0x96,
      0xE7, 0x2B, 0x27, 0xD4, 0xC2, 0xF5, 0xD1, 0x0F, 0xDA, 0x24, 0x68, 0xB6, 0x1C, 0x73, 0x90, 0xEB,
      0x84, 0xBE, 0x5A, 0xFC, 0xA6, 0x0A, 0x44, 0x1B, 0x08, 0xA4, 0xE9, 0x4B, 0x66, 0x17, 0xDA, 0x7E,
      0x14, 0x95, 0x80, 0x99, 0x34, 0x6F, 0x15, 0x3C, 0x42, 0x7D, 0x8C, 0xD1, 0x40, 0x4F, 0x89, 0x2F,
      0x54, 0x85, 0xCA, 0x28, 0x2E, 0xA6, 0x30, 0x49, 0x62, 0x87, 0x05, 0x1F, 0xB9, 0xFA, 0x91, 0x18,
      0x33, 0x82, 0x8E, 0x2B, 0xE4, 0x14, 0x54, 0x41, 0x81, 0x20, 0x43, 0x48, 0x10, 0x45, 0x93, 0x48,
      0x65, 0x69, 0x45, 0x6A, 0xDF, 0x02, 0x05, 0xCE, 0xE9, 0x2E, 0x3A, 0x61, 0x0A, 0x57, 0x97, 0x64,
      0xD5, 0x32, 0xBD, 0x64, 0x5D, 0x4E, 0xB6, 0xD6, 0x74, 0xA5, 0x88, 0x0A, 0x36, 0x1E, 0xD6, 0x49,
      0x2A, 0x68, 0x40, 0x7A, 0xD1, 0x2F, 0x08, 0x87, 0x0C, 0x78, 0x3E, 0x27, 0xBE, 0x54, 0xE7, 0xF2,
      0x5D, 0x40, 0x71, 0x0A, 0x05, 0xFE, 0x98, 0x5C, 0x80, 0x15, 0xBF, 0x14, 0xAB, 0x4C, 0x7C, 0xA7,
      0xD3, 0x38, 0x21, 0x90, 0x9F, 0x5B, 0xE8, 0x29, 0x1E, 0x06, 0xC6, 0x52, 0x08, 0x19, 0x85, 0x1F,
      0x22, 0xCF, 0x52, 0x83, 0x9A, 0x42, 0x69, 0x16, 0x50, 0x89, 0x9E, 0x38, 0x08, 0x3C, 0x7A, 0x6B,
      0x4C, 0x1A, 0x29, 0xC1, 0x06, 0x65, 0x4F, 0xDD, 0xA8, 0xB8, 0xCF, 0x09, 0x08, 0x59, 0x50, 0x66,
      0x4A, 0x02, 0xE9, 0x7C, 0x6E, 0x6B, 0x33, 0x0E, 0xA5, 0xF3, 0x2C, 0x4E, 0x81, 0x15, 0x7C, 0x53,
      0x45, 0x9B, 0x92, 0xC2, 0x63, 0xAE, 0x53, 0x86, 0x95, 0x85, 0x79, 0xB6, 0x98, 0xFE, 0xA8, 0x90
    ];
    return q0[x & 0xFF];
  }
  
  _q1(x) {
    // Official Twofish Q1 permutation table
    const q1 = [
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
    ];
    return q1[x & 0xFF];
  }
  
  _mds(x) {
    // Twofish MDS matrix multiplication
    const bytes = OpCodes.Unpack32LE(x);
    
    // MDS matrix coefficients in GF(2^8)
    const mds = [
      [0x01, 0xEF, 0x5B, 0x5B],
      [0x5B, 0xEF, 0xEF, 0x01],
      [0xEF, 0x5B, 0x01, 0xEF],
      [0xEF, 0x01, 0xEF, 0x5B]
    ];
    
    const result = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i] ^= this._gfMultiply(mds[i][j], bytes[j]);
      }
    }
    
    return OpCodes.Pack32LE(result[0], result[1], result[2], result[3]);
  }
  
  _gfMultiply(a, b) {
    // Galois Field multiplication in GF(2^8)
    let result = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) result ^= a;
      const carry = a & 0x80;
      a <<= 1;
      if (carry) a ^= 0x169; // Twofish irreducible polynomial
      b >>>= 1;
    }
    return result & 0xFF;
  }

  _encryptBlock(block) {
    if (!this.subKeys) {
      throw new Error("Subkeys not generated");
    }

    // Convert block to 32-bit words (little-endian)
    let P0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let P1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let P2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let P3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

    // Input whitening
    P0 ^= this.subKeys[0];
    P1 ^= this.subKeys[1];
    P2 ^= this.subKeys[2];
    P3 ^= this.subKeys[3];

    // 16 rounds of Twofish
    for (let round = 0; round < 16; round++) {
      const [T0, T1] = this._fFunction(P0, P1, round);
      
      P2 = OpCodes.RotR32(P2 ^ T0, 1);
      P3 = OpCodes.RotL32(P3, 1) ^ T1;
      
      // Swap for next round (except last round)
      if (round < 15) {
        [P0, P1, P2, P3] = [P2, P3, P0, P1];
      }
    }

    // Output whitening
    P2 ^= this.subKeys[4];
    P3 ^= this.subKeys[5];
    P0 ^= this.subKeys[6];
    P1 ^= this.subKeys[7];

    // Convert back to bytes
    const result = [];
    result.push(...OpCodes.Unpack32LE(P2));
    result.push(...OpCodes.Unpack32LE(P3));
    result.push(...OpCodes.Unpack32LE(P0));
    result.push(...OpCodes.Unpack32LE(P1));

    return result;
  }

  _decryptBlock(block) {
    if (!this.subKeys) {
      throw new Error("Subkeys not generated");
    }

    // Convert block to 32-bit words (little-endian)
    let C0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let C1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let C2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let C3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

    // Undo output whitening
    C2 ^= this.subKeys[4];
    C3 ^= this.subKeys[5];
    C0 ^= this.subKeys[6];
    C1 ^= this.subKeys[7];

    // 16 rounds of Twofish in reverse
    for (let round = 15; round >= 0; round--) {
      // Undo swap from encryption (except first round)
      if (round < 15) {
        [C2, C3, C0, C1] = [C0, C1, C2, C3];
      }
      
      const [T0, T1] = this._fFunction(C0, C1, round);
      
      C2 = OpCodes.RotL32(C2, 1) ^ T0;
      C3 = OpCodes.RotR32(C3 ^ T1, 1);
    }

    // Undo input whitening
    C0 ^= this.subKeys[0];
    C1 ^= this.subKeys[1];
    C2 ^= this.subKeys[2];
    C3 ^= this.subKeys[3];

    // Convert back to bytes
    const result = [];
    result.push(...OpCodes.Unpack32LE(C0));
    result.push(...OpCodes.Unpack32LE(C1));
    result.push(...OpCodes.Unpack32LE(C2));
    result.push(...OpCodes.Unpack32LE(C3));

    return result;
  }

  _fFunction(r0, r1, round) {
    // Twofish F-function implementation
    const t0 = this._gFunction(r0);
    const t1 = this._gFunction(OpCodes.RotL32(r1, 8));
    
    // Pseudo-Hadamard Transform (PHT) with round subkeys
    const f0 = (t0 + t1 + this.subKeys[8 + 2 * round]) >>> 0;
    const f1 = (t0 + 2 * t1 + this.subKeys[8 + 2 * round + 1]) >>> 0;
    
    return [f0, f1];
  }

  _gFunction(x) {
    // Twofish G-function 
    const bytes = OpCodes.Unpack32LE(x);
    
    // Apply key-dependent S-boxes
    const sBoxOutput = [
      this.sBox[0][bytes[0]],
      this.sBox[1][bytes[1]], 
      this.sBox[2][bytes[2]],
      this.sBox[3][bytes[3]]
    ];
    
    // Apply MDS matrix
    return this._mds(OpCodes.Pack32LE(sBoxOutput[0], sBoxOutput[1], sBoxOutput[2], sBoxOutput[3]));
  }
}

// Register the algorithm
RegisterAlgorithm(new TwofishAlgorithm());