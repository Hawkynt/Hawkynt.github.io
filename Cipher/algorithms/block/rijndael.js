/*
 * Rijndael (AES) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Supports AES-128, AES-192, and AES-256 encryption/decryption
 * Follows FIPS 197 specification for Advanced Encryption Standard
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
    this.securityStatus = SecurityStatus.SECURE;
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

    // Official NIST test vectors for AES-128 and AES-192
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
    
    // Standard AES S-box
    this._sBox = [
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
    
    // Standard AES inverse S-box
    this._invSBox = [
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
    
    // Round constants for key expansion
    this._rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
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
    
    this.roundKeys = this._expandKey(keyBytes);
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

  _expandKey(key) {
    const Nk = key.length / 4; // Key length in words (4 bytes each)
    const Nr = this.rounds;
    const totalWords = 4 * (Nr + 1); // Total words needed
    const w = new Array(totalWords * 4); // Store as byte array directly
    
    // Copy original key
    for (let i = 0; i < key.length; i++) {
      w[i] = key[i];
    }
    
    // Generate remaining key material
    for (let i = Nk; i < totalWords; i++) {
      // Get previous word
      let temp = [w[(i-1)*4], w[(i-1)*4+1], w[(i-1)*4+2], w[(i-1)*4+3]];
      
      if (i % Nk === 0) {
        // RotWord: rotate bytes left by 1
        temp = [temp[1], temp[2], temp[3], temp[0]];
        // SubBytes: apply S-box to each byte
        temp = temp.map(b => this._sBox[b]);
        // XOR with round constant
        temp[0] ^= this._rcon[Math.floor(i / Nk) - 1];
      } else if (Nk > 6 && i % Nk === 4) {
        // SubBytes for AES-256 only
        temp = temp.map(b => this._sBox[b]);
      }
      
      // XOR with word Nk positions back
      w[i*4] = w[(i-Nk)*4] ^ temp[0];
      w[i*4+1] = w[(i-Nk)*4+1] ^ temp[1];
      w[i*4+2] = w[(i-Nk)*4+2] ^ temp[2];
      w[i*4+3] = w[(i-Nk)*4+3] ^ temp[3];
    }
    
    return w;
  }

  _encryptBlock(input) {
    const state = [...input];
    
    // Initial round key addition
    this._addRoundKey(state, 0);
    
    // Main rounds
    for (let round = 1; round < this.rounds; round++) {
      this._subBytes(state);
      this._shiftRows(state);
      this._mixColumns(state);
      this._addRoundKey(state, round);
    }
    
    // Final round (no MixColumns)
    this._subBytes(state);
    this._shiftRows(state);
    this._addRoundKey(state, this.rounds);
    
    return state;
  }

  _decryptBlock(input) {
    const state = [...input];
    
    // Initial round key addition
    this._addRoundKey(state, this.rounds);
    
    // Main rounds in reverse
    for (let round = this.rounds - 1; round > 0; round--) {
      this._invShiftRows(state);
      this._invSubBytes(state);
      this._addRoundKey(state, round);
      this._invMixColumns(state);
    }
    
    // Final round (no InvMixColumns)
    this._invShiftRows(state);
    this._invSubBytes(state);
    this._addRoundKey(state, 0);
    
    return state;
  }

  _addRoundKey(state, round) {
    for (let i = 0; i < 16; i++) {
      state[i] ^= this.roundKeys[round * 16 + i];
    }
  }

  _subBytes(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = this._sBox[state[i]];
    }
  }

  _invSubBytes(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = this._invSBox[state[i]];
    }
  }

  _shiftRows(state) {
    // Row 1: shift left by 1
    let temp = state[1];
    state[1] = state[5];
    state[5] = state[9]; 
    state[9] = state[13];
    state[13] = temp;
    
    // Row 2: shift left by 2
    temp = state[2];
    let temp2 = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = temp;
    state[14] = temp2;
    
    // Row 3: shift left by 3 (equivalent to right by 1)
    temp = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = state[3];
    state[3] = temp;
  }

  _invShiftRows(state) {
    // Row 1: shift right by 1
    let temp = state[13];
    state[13] = state[9];
    state[9] = state[5];
    state[5] = state[1];
    state[1] = temp;
    
    // Row 2: shift right by 2 (same as left by 2)
    temp = state[2];
    let temp2 = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = temp;
    state[14] = temp2;
    
    // Row 3: shift right by 3 (equivalent to left by 1)
    temp = state[3];
    state[3] = state[7];
    state[7] = state[11];
    state[11] = state[15];
    state[15] = temp;
  }

  _mixColumns(state) {
    // Work on each column (bytes 0,4,8,12 then 1,5,9,13 etc.)
    for (let c = 0; c < 4; c++) {
      const s0 = state[c];
      const s1 = state[c + 4];
      const s2 = state[c + 8];
      const s3 = state[c + 12];
      
      state[c]      = OpCodes.GF256Mul(s0, 2) ^ OpCodes.GF256Mul(s1, 3) ^ s2 ^ s3;
      state[c + 4]  = s0 ^ OpCodes.GF256Mul(s1, 2) ^ OpCodes.GF256Mul(s2, 3) ^ s3;
      state[c + 8]  = s0 ^ s1 ^ OpCodes.GF256Mul(s2, 2) ^ OpCodes.GF256Mul(s3, 3);
      state[c + 12] = OpCodes.GF256Mul(s0, 3) ^ s1 ^ s2 ^ OpCodes.GF256Mul(s3, 2);
    }
  }

  _invMixColumns(state) {
    // Work on each column with inverse matrix
    for (let c = 0; c < 4; c++) {
      const s0 = state[c];
      const s1 = state[c + 4];
      const s2 = state[c + 8];
      const s3 = state[c + 12];
      
      state[c]      = OpCodes.GF256Mul(s0, 14) ^ OpCodes.GF256Mul(s1, 11) ^ OpCodes.GF256Mul(s2, 13) ^ OpCodes.GF256Mul(s3, 9);
      state[c + 4]  = OpCodes.GF256Mul(s0, 9)  ^ OpCodes.GF256Mul(s1, 14) ^ OpCodes.GF256Mul(s2, 11) ^ OpCodes.GF256Mul(s3, 13);
      state[c + 8]  = OpCodes.GF256Mul(s0, 13) ^ OpCodes.GF256Mul(s1, 9)  ^ OpCodes.GF256Mul(s2, 14) ^ OpCodes.GF256Mul(s3, 11);
      state[c + 12] = OpCodes.GF256Mul(s0, 11) ^ OpCodes.GF256Mul(s1, 13) ^ OpCodes.GF256Mul(s2, 9)  ^ OpCodes.GF256Mul(s3, 14);
    }
  }
}

// Register the algorithm
RegisterAlgorithm(new RijndaelAlgorithm());