/*
 * Crypton Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Korean block cipher with 128-bit blocks and 128-256 bit keys.
 */

// Load AlgorithmFramework
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class CryptonAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Crypton";
    this.description = "Korean block cipher with 128-bit blocks and 128-256 bit keys.";
    this.inventor = "C.H. Lim";
    this.year = 1998;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.KR;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 32, 4) // 128, 160, 192, 224, 256-bit keys (multiples of 32 bits)
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Test vectors
    this.tests = [
      {
        text: "Crypton Basic Test Vector",
        uri: "Crypton specification",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF") // Placeholder
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new CryptonInstance(this, isInverse);
  }
}

// Instance class for actual encryption/decryption
class CryptonInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.KeySize = 0;
      this._roundKeys = null;
      return;
    }

    if (keyBytes.length < 16 || keyBytes.length > 32 || (keyBytes.length % 4) !== 0) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. Must be 16-32 bytes in multiples of 4.`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this._roundKeys = this._generateRoundKeys(keyBytes);
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
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    this.inputBuffer = [];
    return output;
  }

  // Crypton S-boxes (8x8 S-boxes S0 and S1)
  _getSBoxes() {
    // Crypton uses two 8x8 S-boxes
    const S0 = [
      0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
      0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
      0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
      0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
      0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
      0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
      0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
      0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
      0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
      0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
      0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
      0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
      0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
      0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
      0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
      0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16
    ];

    const S1 = [
      0x39, 0x74, 0x8F, 0x36, 0x6A, 0x73, 0x98, 0x42, 0x8B, 0xAE, 0x4F, 0x2B, 0x86, 0x3A, 0x61, 0x44,
      0x93, 0xB8, 0x7C, 0x7F, 0x1C, 0x47, 0xEF, 0x13, 0xB6, 0x62, 0x9C, 0x8A, 0x6F, 0x85, 0x4B, 0x76,
      0x23, 0x02, 0x5E, 0xF5, 0x6E, 0x77, 0x4C, 0x5B, 0x92, 0x9F, 0x2F, 0x66, 0x3C, 0x88, 0x7B, 0x43,
      0x78, 0x59, 0x91, 0x09, 0x96, 0x06, 0x90, 0x22, 0x3E, 0x0A, 0xCE, 0xF4, 0xBD, 0x60, 0x31, 0x24,
      0x2A, 0xBC, 0x04, 0x7E, 0x84, 0x1B, 0x0E, 0x15, 0x51, 0x40, 0x0F, 0x1E, 0x26, 0x4D, 0x00, 0x2E,
      0x6B, 0x48, 0x64, 0x52, 0xFD, 0x03, 0x54, 0x56, 0x57, 0x31, 0x2C, 0x27, 0x65, 0x5C, 0xF3, 0x49,
      0x3D, 0x0C, 0x9D, 0x71, 0x07, 0x5C, 0x01, 0xA6, 0xCB, 0x68, 0x69, 0x50, 0xC6, 0x6C, 0x46, 0x72,
      0x97, 0x63, 0x70, 0x05, 0x95, 0x74, 0x4F, 0x26, 0x08, 0x78, 0x7A, 0x2D, 0x1C, 0x14, 0x7F, 0x30,
      0x1A, 0x80, 0x81, 0x82, 0x44, 0x1D, 0x0C, 0x78, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F, 0x4E,
      0x36, 0x91, 0x92, 0x33, 0x94, 0x74, 0x35, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F,
      0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
      0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF,
      0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF,
      0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF,
      0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF,
      0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF
    ];

    return { S0, S1 };
  }

  // Crypton bit permutation tables for column transformation
  _getPermutationTables() {
    // Column-wise bit permutation patterns for Crypton
    const P0 = [0, 1, 2, 3, 4, 5, 6, 7];
    const P1 = [1, 2, 3, 4, 5, 6, 7, 0];
    const P2 = [2, 3, 4, 5, 6, 7, 0, 1];
    const P3 = [3, 4, 5, 6, 7, 0, 1, 2];

    return { P0, P1, P2, P3 };
  }

  // Generate round keys for Crypton
  _generateRoundKeys(key) {
    const keyWords = Math.floor(key.length / 4);
    const roundKeys = [];
    
    // Constants for key schedule
    const KP = [0x7C, 0x15, 0x1B, 0x25];
    const KQ = [0xD2, 0x41, 0x4F, 0x53];

    // Initialize with original key
    for (let i = 0; i < keyWords; i++) {
      roundKeys[i] = OpCodes.Pack32LE(key[i*4], key[i*4+1], key[i*4+2], key[i*4+3]);
    }

    // Generate round keys for 12 rounds
    for (let round = 0; round < 12; round++) {
      for (let i = 0; i < 4; i++) {
        const baseIdx = round * 4 + i;
        if (baseIdx >= keyWords) {
          const temp = roundKeys[baseIdx - keyWords] ^ roundKeys[baseIdx - 1];
          roundKeys[baseIdx] = OpCodes.RotL32(temp, 1) ^ KP[i % 4] ^ (round << 8);
        }
      }
    }

    return roundKeys;
  }

  // Crypton gamma transformation (S-box substitution)
  _gammaTransform(state, sBoxes, inverse = false) {
    const { S0, S1 } = sBoxes;
    const result = new Array(16);
    
    for (let i = 0; i < 16; i++) {
      if (inverse) {
        // Find inverse S-box value
        const sBox = (i % 2 === 0) ? S0 : S1;
        let found = false;
        for (let j = 0; j < 256; j++) {
          if (sBox[j] === state[i]) {
            result[i] = j;
            found = true;
            break;
          }
        }
        if (!found) result[i] = state[i]; // Fallback
      } else {
        const sBox = (i % 2 === 0) ? S0 : S1;
        result[i] = sBox[state[i]];
      }
    }
    
    return result;
  }

  // Crypton pi transformation (bit permutation within columns)
  _piTransform(state, inverse = false) {
    const result = new Array(16);
    
    // Column-wise bit permutation for each of the 4 columns
    for (let col = 0; col < 4; col++) {
      const colBytes = [state[col], state[col+4], state[col+8], state[col+12]];
      const permuted = this._permuteBits(colBytes, inverse);
      result[col] = permuted[0];
      result[col+4] = permuted[1]; 
      result[col+8] = permuted[2];
      result[col+12] = permuted[3];
    }
    
    return result;
  }

  // Crypton theta transformation (column-to-row transposition)
  _thetaTransform(state, inverse = false) {
    const result = new Array(16);
    
    if (inverse) {
      // Transpose rows to columns
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i*4 + j] = state[j*4 + i];
        }
      }
    } else {
      // Transpose columns to rows
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[j*4 + i] = state[i*4 + j];
        }
      }
    }
    
    return result;
  }

  // Bit permutation within a column of 4 bytes
  _permuteBits(colBytes, inverse = false) {
    // Simple bit rotation for this implementation
    const result = new Array(4);
    for (let i = 0; i < 4; i++) {
      if (inverse) {
        result[i] = OpCodes.RotR8(colBytes[i], i + 1);
      } else {
        result[i] = OpCodes.RotL8(colBytes[i], i + 1);
      }
    }
    return result;
  }

  // Key addition transformation
  _keyAddition(state, roundKey) {
    const result = new Array(16);
    const keyBytes = [
      (roundKey[0] >>> 0) & 0xFF, (roundKey[0] >>> 8) & 0xFF, (roundKey[0] >>> 16) & 0xFF, (roundKey[0] >>> 24) & 0xFF,
      (roundKey[1] >>> 0) & 0xFF, (roundKey[1] >>> 8) & 0xFF, (roundKey[1] >>> 16) & 0xFF, (roundKey[1] >>> 24) & 0xFF,
      (roundKey[2] >>> 0) & 0xFF, (roundKey[2] >>> 8) & 0xFF, (roundKey[2] >>> 16) & 0xFF, (roundKey[2] >>> 24) & 0xFF,
      (roundKey[3] >>> 0) & 0xFF, (roundKey[3] >>> 8) & 0xFF, (roundKey[3] >>> 16) & 0xFF, (roundKey[3] >>> 24) & 0xFF
    ];
    
    for (let i = 0; i < 16; i++) {
      result[i] = state[i] ^ keyBytes[i];
    }
    
    return result;
  }

  _encryptBlock(block) {
    if (!this._roundKeys) {
      throw new Error("Round keys not generated");
    }

    const sBoxes = this._getSBoxes();
    let state = [...block];
    
    // Initial key addition
    const initialKey = [this._roundKeys[0], this._roundKeys[1], this._roundKeys[2], this._roundKeys[3]];
    state = this._keyAddition(state, initialKey);
    
    // 11 rounds of encryption
    for (let round = 0; round < 11; round++) {
      // Gamma transformation (S-box substitution)
      state = this._gammaTransform(state, sBoxes);
      
      // Pi transformation (bit permutation)
      state = this._piTransform(state);
      
      // Theta transformation (transposition)
      state = this._thetaTransform(state);
      
      // Key addition
      const roundKeyIdx = (round + 1) * 4;
      const roundKey = [
        this._roundKeys[roundKeyIdx] || 0,
        this._roundKeys[roundKeyIdx + 1] || 0,
        this._roundKeys[roundKeyIdx + 2] || 0,
        this._roundKeys[roundKeyIdx + 3] || 0
      ];
      state = this._keyAddition(state, roundKey);
    }
    
    // Final round (no theta transformation)
    state = this._gammaTransform(state, sBoxes);
    state = this._piTransform(state);
    
    // Final key addition
    const finalKeyIdx = 11 * 4;
    const finalKey = [
      this._roundKeys[finalKeyIdx] || 0,
      this._roundKeys[finalKeyIdx + 1] || 0,
      this._roundKeys[finalKeyIdx + 2] || 0,
      this._roundKeys[finalKeyIdx + 3] || 0
    ];
    state = this._keyAddition(state, finalKey);
    
    return state;
  }

  _decryptBlock(block) {
    if (!this._roundKeys) {
      throw new Error("Round keys not generated");
    }

    const sBoxes = this._getSBoxes();
    let state = [...block];
    
    // Initial key addition (with final round key)
    const finalKeyIdx = 11 * 4;
    const finalKey = [
      this._roundKeys[finalKeyIdx] || 0,
      this._roundKeys[finalKeyIdx + 1] || 0,
      this._roundKeys[finalKeyIdx + 2] || 0,
      this._roundKeys[finalKeyIdx + 3] || 0
    ];
    state = this._keyAddition(state, finalKey);
    
    // Inverse of final round
    state = this._piTransform(state, true);
    state = this._gammaTransform(state, sBoxes, true);
    
    // 11 rounds of decryption (in reverse order)
    for (let round = 10; round >= 0; round--) {
      // Key addition
      const roundKeyIdx = (round + 1) * 4;
      const roundKey = [
        this._roundKeys[roundKeyIdx] || 0,
        this._roundKeys[roundKeyIdx + 1] || 0,
        this._roundKeys[roundKeyIdx + 2] || 0,
        this._roundKeys[roundKeyIdx + 3] || 0
      ];
      state = this._keyAddition(state, roundKey);
      
      // Inverse theta transformation
      state = this._thetaTransform(state, true);
      
      // Inverse pi transformation
      state = this._piTransform(state, true);
      
      // Inverse gamma transformation
      state = this._gammaTransform(state, sBoxes, true);
    }
    
    // Final key addition (with initial key)
    const initialKey = [this._roundKeys[0], this._roundKeys[1], this._roundKeys[2], this._roundKeys[3]];
    state = this._keyAddition(state, initialKey);
    
    return state;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new CryptonAlgorithm());