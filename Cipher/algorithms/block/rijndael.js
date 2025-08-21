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

// Use AlgorithmFramework properties directly without destructuring to avoid conflicts


// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  OpCodes = require('../../OpCodes.js');
}

class RijndaelCipherFixed extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Rijndael (AES)";
    this.description = "Advanced Encryption Standard, selected by NIST in 2001. Supports 128, 192, and 256-bit keys with 128-bit blocks. Most widely used symmetric cipher worldwide.";
    this.inventor = "Joan Daemen, Vincent Rijmen";
    this.year = 1998;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.SECURE;
    this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
    this.country = AlgorithmFramework.CountryCode.BE;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1), // AES-128
      new AlgorithmFramework.KeySize(24, 24, 1), // AES-192  
      new AlgorithmFramework.KeySize(32, 32, 1)  // AES-256
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("FIPS 197 Specification", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf"),
      new AlgorithmFramework.LinkItem("NIST AES Information", "https://www.nist.gov/publications/advanced-encryption-standard-aes"),
      new AlgorithmFramework.LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Advanced_Encryption_Standard")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Original Rijndael Specification", "https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/rijndael-ammended.pdf"),
      new AlgorithmFramework.LinkItem("NIST Test Vectors", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"),
      new AlgorithmFramework.LinkItem("RFC 3826 - AES-CBC", "https://tools.ietf.org/rfc/rfc3826.txt")
    ];

    // Test vectors from NIST SP 800-38A
    this.tests = [
      {
        text: "NIST SP 800-38A AES-128 ECB Vector #1",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
      },
      {
        text: "NIST SP 800-38A AES-128 ECB Vector #2", 
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
        input: OpCodes.Hex8ToBytes("ae2d8a571e03ac9c9eb76fac45af8e51"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("f5d3d58503b9699de785895a96fdbaaf")
      },
      {
        text: "NIST SP 800-38A AES-256 ECB Vector #1",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf", 
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: OpCodes.Hex8ToBytes("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4"),
        expected: OpCodes.Hex8ToBytes("f3eed1bdb5d2a03c064b5a7e3db181f8")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new RijndaelFixedInstance(this, isInverse);
  }
}

class RijndaelFixedInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
    this.rounds = 0;
    
    // Initialize lookup tables
    this._sBox = OpCodes.Hex8ToBytes("637c777bf26b6fc53001672bfed7ab76ca82c97dfa5947f0add4a2af9ca472c0b7fd9326363ff7cc34a5e5f171d8311504c723c31896059a071280e2eb27b27509832c1a1b6e5aa0523bd6b329e32f8453d100ed20fcb15b6acbbe394a4c58cfd0efaafb434d338545f9027f503c9fa851a3408f929d38f5bcb6da2110fff3d2cd0c13ec5f974417c4a77e3d645d197360814fdc222a908846eeb814de5e0bdbe0323a0a4906245cc6a8fb562f3846ae6d75a0db28b9b95e6ad17d3f5c6d49b07b8afe67c6b8c5b7c1d1932e3b5a78e02c7c1c4e5a2b3b08c5b42f7c1c9c3");
    
    this._invSBox = OpCodes.Hex8ToBytes("52096ad5303685382d1e8fca3f0f02c1afbd0301138a6b3a9111414f67dcea97f2cfcef0b4e67396ac7422e7ad3585e2f937e81c75df6e47f11a711d29c5896fb7620eaa18be1bfc563e4bc6d2799adbcfe78cd5af41fddaa3388c07c731b11210592780ec5f60517e21b047e12bb90e39847e1c75dfe6e5aa0e02a7ead5b84");
    
    this._rcon = OpCodes.Hex8ToBytes("00010204081020408036cdab4d9a2f5f");
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
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
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
    const keyWords = key.length / 4;
    const totalWords = 4 * (this.rounds + 1);
    const expandedKey = new Array(totalWords * 4);
    
    // Copy original key
    for (let i = 0; i < key.length; i++) {
      expandedKey[i] = key[i];
    }
    
    // Expand key
    for (let i = keyWords; i < totalWords; i++) {
      let temp = [
        expandedKey[(i-1)*4],
        expandedKey[(i-1)*4+1], 
        expandedKey[(i-1)*4+2],
        expandedKey[(i-1)*4+3]
      ];
      
      if (i % keyWords === 0) {
        // RotWord
        temp = [temp[1], temp[2], temp[3], temp[0]];
        // SubBytes
        temp = temp.map(b => this._sBox[b]);
        // Rcon
        temp[0] ^= this._rcon[Math.floor(i / keyWords)];
      } else if (keyWords > 6 && i % keyWords === 4) {
        // SubBytes for AES-256
        temp = temp.map(b => this._sBox[b]);
      }
      
      expandedKey[i*4] = expandedKey[(i-keyWords)*4] ^ temp[0];
      expandedKey[i*4+1] = expandedKey[(i-keyWords)*4+1] ^ temp[1];
      expandedKey[i*4+2] = expandedKey[(i-keyWords)*4+2] ^ temp[2];
      expandedKey[i*4+3] = expandedKey[(i-keyWords)*4+3] ^ temp[3];
    }
    
    return expandedKey;
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
    
    // Final round
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
    
    // Final round
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
    const temp1 = state[1];
    state[1] = state[5];
    state[5] = state[9]; 
    state[9] = state[13];
    state[13] = temp1;
    
    // Row 2: shift left by 2
    const temp2a = state[2];
    const temp2b = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = temp2a;
    state[14] = temp2b;
    
    // Row 3: shift left by 3 (right by 1)
    const temp3 = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = state[3];
    state[3] = temp3;
  }

  _invShiftRows(state) {
    // Row 1: shift right by 1
    const temp1 = state[13];
    state[13] = state[9];
    state[9] = state[5];
    state[5] = state[1];
    state[1] = temp1;
    
    // Row 2: shift right by 2
    const temp2a = state[2];
    const temp2b = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = temp2a;
    state[14] = temp2b;
    
    // Row 3: shift right by 3 (left by 1)
    const temp3 = state[3];
    state[3] = state[7];
    state[7] = state[11];
    state[11] = state[15];
    state[15] = temp3;
  }

  _mixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const a = [state[c], state[c+4], state[c+8], state[c+12]];
      state[c] = this._gfMul(a[0], 2) ^ this._gfMul(a[1], 3) ^ a[2] ^ a[3];
      state[c+4] = a[0] ^ this._gfMul(a[1], 2) ^ this._gfMul(a[2], 3) ^ a[3];
      state[c+8] = a[0] ^ a[1] ^ this._gfMul(a[2], 2) ^ this._gfMul(a[3], 3);
      state[c+12] = this._gfMul(a[0], 3) ^ a[1] ^ a[2] ^ this._gfMul(a[3], 2);
    }
  }

  _invMixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const a = [state[c], state[c+4], state[c+8], state[c+12]];
      state[c] = this._gfMul(a[0], 14) ^ this._gfMul(a[1], 11) ^ this._gfMul(a[2], 13) ^ this._gfMul(a[3], 9);
      state[c+4] = this._gfMul(a[0], 9) ^ this._gfMul(a[1], 14) ^ this._gfMul(a[2], 11) ^ this._gfMul(a[3], 13);
      state[c+8] = this._gfMul(a[0], 13) ^ this._gfMul(a[1], 9) ^ this._gfMul(a[2], 14) ^ this._gfMul(a[3], 11);
      state[c+12] = this._gfMul(a[0], 11) ^ this._gfMul(a[1], 13) ^ this._gfMul(a[2], 9) ^ this._gfMul(a[3], 14);
    }
  }

  _gfMul(a, b) {
    // Use OpCodes GF multiplication if available, otherwise fallback
    if (OpCodes.GFMul) {
      return OpCodes.GFMul(a, b, 0x1b, 8);
    }
    
    // Fallback implementation
    let result = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) result ^= a;
      const hi_bit_set = a & 0x80;
      a <<= 1;
      if (hi_bit_set) a ^= 0x1b;
      b >>= 1;
    }
    return result & 0xff;
  }
}

// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new RijndaelCipherFixed());
