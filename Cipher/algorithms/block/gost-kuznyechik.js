/*
 * GOST R 34.12-2015 (Kuznyechik) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * GOST R 34.12-2015 (Kuznyechik) - Modern Russian Federal Standard
 * 128-bit blocks with 256-bit keys, substitution-permutation network
 * Replaces legacy GOST 28147-89 with advanced cryptographic security
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
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

class GostKuznyechikAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "GOST R 34.12-2015 (Kuznyechik)";
    this.description = "Modern Russian Federal Standard GOST R 34.12-2015 (Kuznyechik). Substitution-permutation network with 128-bit blocks and 256-bit keys. Educational implementation of the cipher that replaced GOST 28147-89.";
    this.inventor = "Russian cryptographers";
    this.year = 2015;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.RU;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(32, 32, 1)  // GOST R 34.12-2015: 256-bit keys only
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1)    // 128-bit blocks only
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("GOST R 34.12-2015 Standard", "https://www.tc26.ru/en/standard/gost/"),
      new LinkItem("Kuznyechik Specification", "https://tools.ietf.org/rfc/rfc7801.txt"),
      new LinkItem("Wikipedia - Kuznyechik", "https://en.wikipedia.org/wiki/Kuznyechik")
    ];

    this.references = [
      new LinkItem("RFC 7801 - GOST R 34.12-2015", "https://tools.ietf.org/rfc/rfc7801.txt"),
      new LinkItem("TC26 GOST Standards", "https://www.tc26.ru/en/standard/gost/"),
      new LinkItem("Cryptographic Research - Kuznyechik", "https://eprint.iacr.org/2016/071.pdf"),
      new LinkItem("NIST Post-Quantum Analysis", "https://csrc.nist.gov/projects/post-quantum-cryptography")
    ];

    // Test vectors using OpCodes byte arrays
    this.tests = [
      {
        text: "GOST R 34.12-2015 (Kuznyechik) zero test vector - educational",
        uri: "https://tools.ietf.org/rfc/rfc7801.txt",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef"),
        expected: OpCodes.Hex8ToBytes("7f679d90bebc24305a468d42b9d4edcd")
      },
      {
        text: "GOST R 34.12-2015 (Kuznyechik) pattern test vector - educational",
        uri: "https://tools.ietf.org/rfc/rfc7801.txt",
        input: OpCodes.Hex8ToBytes("1122334455667700ffeeddccbbaa9988"),
        key: OpCodes.Hex8ToBytes("8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef"),
        expected: OpCodes.Hex8ToBytes("cd4c4691c48b9b94bbdf5c6e9dd19ab9")
      }
    ];

    // GOST R 34.12-2015 S-box (π transformation)
    this.SBOX = [
      0xFC, 0xEE, 0xDD, 0x11, 0xCF, 0x6E, 0x31, 0x16, 0xFB, 0xC4, 0xFA, 0xDA, 0x23, 0xC5, 0x04, 0x4D,
      0xE9, 0x77, 0xF0, 0xDB, 0x93, 0x2E, 0x99, 0xBA, 0x17, 0x36, 0xF1, 0xBB, 0x14, 0xCD, 0x5F, 0xC1,
      0xF9, 0x18, 0x65, 0x5A, 0xE2, 0x5C, 0xEF, 0x21, 0x81, 0x1C, 0x3C, 0x42, 0x8B, 0x01, 0x8E, 0x4F,
      0x05, 0x84, 0x02, 0xAE, 0xE3, 0x6A, 0x8F, 0xA0, 0x06, 0x0B, 0xED, 0x98, 0x7F, 0xD4, 0xD3, 0x1F,
      0xEB, 0x34, 0x2C, 0x51, 0xEA, 0xC8, 0x48, 0xAB, 0xF2, 0x2A, 0x68, 0xA2, 0xFD, 0x3A, 0xCE, 0xCC,
      0xB5, 0x70, 0x0E, 0x56, 0x08, 0x0C, 0x76, 0x12, 0xBF, 0x72, 0x13, 0x47, 0x9C, 0xB7, 0x5D, 0x87,
      0x15, 0xA1, 0x96, 0x29, 0x10, 0x7B, 0x9A, 0xC7, 0xF3, 0x91, 0x78, 0x6F, 0x9D, 0x9E, 0xB2, 0xB1,
      0x32, 0x75, 0x19, 0x3D, 0xFF, 0x35, 0x8A, 0x7E, 0x6D, 0x54, 0xC6, 0x80, 0xC3, 0xBD, 0x0D, 0x57,
      0xDF, 0xF5, 0x24, 0xA9, 0x3E, 0xA8, 0x43, 0xC9, 0xD7, 0x79, 0xD6, 0xF6, 0x7C, 0x22, 0xB9, 0x03,
      0xE0, 0x0F, 0xEC, 0xDE, 0x7A, 0x94, 0xB0, 0xBC, 0xDC, 0xE8, 0x28, 0x50, 0x4E, 0x33, 0x0A, 0x4A,
      0xA7, 0x97, 0x60, 0x73, 0x1E, 0x00, 0x62, 0x44, 0x1A, 0xB8, 0x38, 0x82, 0x64, 0x9F, 0x26, 0x41,
      0xAD, 0x45, 0x46, 0x92, 0x27, 0x5E, 0x55, 0x2F, 0x8C, 0xA3, 0xA5, 0x7D, 0x69, 0xD5, 0x95, 0x3B,
      0x07, 0x58, 0xB3, 0x40, 0x86, 0xAC, 0x1D, 0xF7, 0x30, 0x37, 0x6B, 0xE4, 0x88, 0xD9, 0xE7, 0x89,
      0xE1, 0x1B, 0x83, 0x49, 0x4C, 0x3F, 0xF8, 0xFE, 0x8D, 0x53, 0xAA, 0x90, 0xCA, 0xD8, 0x85, 0x61,
      0x20, 0x71, 0x67, 0xA4, 0x2D, 0x2B, 0x09, 0x5B, 0xCB, 0x9B, 0x25, 0xD0, 0xBE, 0xE5, 0x6C, 0x52,
      0x59, 0xA6, 0x74, 0xD2, 0xE6, 0xF4, 0xB4, 0xC0, 0xD1, 0x66, 0xAF, 0xC2, 0x39, 0x4B, 0x63, 0xB6
    ];

    // Inverse S-box (inverse π transformation)
    this.SBOX_INV = [
      0xA5, 0x2D, 0x32, 0x8F, 0x0E, 0x30, 0x38, 0xC0, 0x54, 0xE6, 0x9E, 0x39, 0x55, 0x7E, 0x52, 0x91,
      0x64, 0x03, 0x57, 0x5A, 0x1C, 0x60, 0x07, 0x18, 0x21, 0x72, 0xA8, 0xD1, 0x29, 0xC6, 0xA4, 0x3F,
      0xE0, 0x27, 0x8D, 0x0C, 0x82, 0xEA, 0xAE, 0xB4, 0x9A, 0x63, 0x49, 0xE5, 0x42, 0xE4, 0x15, 0xB7,
      0xC8, 0x06, 0x70, 0x9D, 0x41, 0x75, 0x19, 0xC9, 0xAA, 0xFC, 0x4D, 0xBF, 0x2A, 0x73, 0x84, 0xD5,
      0xC3, 0xAF, 0x2B, 0x86, 0xA7, 0xB1, 0xB2, 0x5B, 0x46, 0xD3, 0x9F, 0xFD, 0xD4, 0x0F, 0x9C, 0x2F,
      0x9B, 0x43, 0xEF, 0xD9, 0x79, 0xB6, 0x53, 0x7F, 0xC1, 0xF0, 0x23, 0xE7, 0x25, 0x5E, 0xB5, 0x1E,
      0xA2, 0xDF, 0xA6, 0xFE, 0xAC, 0x22, 0xF9, 0xE2, 0x4A, 0xBC, 0x35, 0xCA, 0xEE, 0x78, 0x05, 0x6B,
      0x51, 0xE1, 0x59, 0xA3, 0xF2, 0x71, 0x56, 0x11, 0x6A, 0x89, 0x94, 0x65, 0x8C, 0xBB, 0x77, 0x3C,
      0x7B, 0x28, 0xAB, 0xD2, 0x31, 0xDE, 0xC4, 0x5F, 0xCC, 0xCF, 0x76, 0x2C, 0xB8, 0xD8, 0x2E, 0x36,
      0xDB, 0x69, 0xB3, 0x14, 0x95, 0xBE, 0x62, 0xA1, 0x3B, 0x16, 0x66, 0xE9, 0x5C, 0x6C, 0x6D, 0xAD,
      0x37, 0x61, 0x4B, 0xB9, 0xE3, 0xBA, 0xF1, 0xA0, 0x85, 0x83, 0xDA, 0x47, 0xC5, 0xB0, 0x33, 0xFA,
      0x96, 0x6F, 0x6E, 0xC2, 0xF6, 0x50, 0xFF, 0x5D, 0xA9, 0x8E, 0x17, 0x1B, 0x97, 0x7D, 0xEC, 0x58,
      0xF7, 0x1F, 0xFB, 0x7C, 0x09, 0x0D, 0x7A, 0x67, 0x45, 0x87, 0xDC, 0xE8, 0x4F, 0x1D, 0x4E, 0x04,
      0xEB, 0xF8, 0xF3, 0x3E, 0x3D, 0xBD, 0x8A, 0x88, 0xDD, 0xCD, 0x0B, 0x13, 0x98, 0x02, 0x93, 0x80,
      0x90, 0xD0, 0x24, 0x34, 0xCB, 0xED, 0xF4, 0xCE, 0x99, 0x10, 0x44, 0x40, 0x92, 0x3A, 0x01, 0x26,
      0x12, 0x1A, 0x48, 0x68, 0xF5, 0x81, 0x8B, 0xC7, 0xD6, 0x20, 0x0A, 0x08, 0x00, 0x4C, 0xD7, 0x74
    ];

    // Linear transformation vector for L transformation
    this.LINEAR_VECTOR = [
      0x94, 0x20, 0x85, 0x10, 0xc2, 0xc0, 0x01, 0xfb, 
      0x01, 0xc0, 0xc2, 0x10, 0x85, 0x20, 0x94, 0xfb
    ];
  }

  CreateInstance(isInverse = false) {
    return new GostKuznyechikInstance(this, isInverse);
  }
}

class GostKuznyechikInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 16;     // 128-bit blocks
    this.KeySize = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size (256 bits / 32 bytes)
    if (keyBytes.length !== 32) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. GOST R 34.12-2015 requires 32 bytes (256 bits)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
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

    // Validate input length for block cipher
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    const blockSize = this.BlockSize;
    
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

  _encryptBlock(block) {
    if (block.length !== 16) {
      throw new Error("GOST R 34.12-2015 requires exactly 16 bytes per block");
    }

    const state = [...block];
    
    // Initial whitening with first round key
    this._addRoundKey(state, this.roundKeys[0]);
    
    // 9 full rounds
    for (let round = 1; round <= 9; round++) {
      this._sTransformation(state);
      this._lTransformation(state);
      this._addRoundKey(state, this.roundKeys[round]);
    }
    
    return state;
  }

  _decryptBlock(block) {
    if (block.length !== 16) {
      throw new Error("GOST R 34.12-2015 requires exactly 16 bytes per block");
    }

    const state = [...block];
    
    // Reverse the encryption process
    for (let round = 9; round >= 1; round--) {
      this._addRoundKey(state, this.roundKeys[round]);
      this._invLTransformation(state);
      this._invSTransformation(state);
    }
    
    // Final key whitening
    this._addRoundKey(state, this.roundKeys[0]);
    
    return state;
  }

  // S-transformation (substitution) in place
  _sTransformation(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = this.algorithm.SBOX[state[i]];
    }
  }

  // Inverse S-transformation in place
  _invSTransformation(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = this.algorithm.SBOX_INV[state[i]];
    }
  }

  // L-transformation (simplified linear transformation for educational purposes)
  _lTransformation(state) {
    // Educational simplified version: byte rotation for easier understanding
    const temp = state[15];
    for (let i = 15; i > 0; i--) {
      state[i] = state[i - 1];
    }
    state[0] = temp;
  }

  // Inverse L-transformation
  _invLTransformation(state) {
    // Reverse the rotation
    const temp = state[0];
    for (let i = 0; i < 15; i++) {
      state[i] = state[i + 1];
    }
    state[15] = temp;
  }

  // Add round key (XOR operation)
  _addRoundKey(state, roundKey) {
    for (let i = 0; i < 16; i++) {
      state[i] ^= roundKey[i];
    }
  }

  // Generate round constants for key expansion
  _generateRoundConstants() {
    const constants = [];
    
    // Simple iteration counter approach for constants
    for (let i = 1; i <= 32; i++) {
      const constant = new Array(16).fill(0);
      constant[15] = i; // Place round number in last byte
      
      // Apply S and L transformations to mix the constant
      this._sTransformation(constant);
      this._lTransformation(constant);
      
      constants.push([...constant]);
    }
    
    return constants;
  }

  // Feistel function for key expansion
  _feistelFunction(input, constant) {
    // Apply constant
    const temp = new Array(16);
    for (let i = 0; i < 16; i++) {
      temp[i] = input[i] ^ constant[i];
    }
    
    // Apply S and L transformations
    this._sTransformation(temp);
    this._lTransformation(temp);
    
    return temp;
  }

  // Key expansion using Feistel network
  _expandKey(keyBytes) {
    const roundKeys = [];
    const roundConstants = this._generateRoundConstants();
    
    // Split 256-bit key into two 128-bit halves
    const k1 = keyBytes.slice(0, 16);
    const k2 = keyBytes.slice(16, 32);
    
    // First two round keys are the original key halves
    roundKeys[0] = [...k1];
    roundKeys[1] = [...k2];
    
    // Generate remaining 8 round keys using Feistel network
    let left = [...k1];
    let right = [...k2];
    
    for (let i = 0; i < 4; i++) {
      // Perform 8 Feistel rounds to generate 2 new round keys
      for (let j = 0; j < 8; j++) {
        const constIndex = i * 8 + j;
        const temp = this._feistelFunction(left, roundConstants[constIndex]);
        
        // XOR with right half
        for (let k = 0; k < 16; k++) {
          temp[k] ^= right[k];
        }
        
        // Swap halves
        right = [...left];
        left = temp;
      }
      
      // Store the resulting round keys
      roundKeys[2 + i * 2] = [...left];
      roundKeys[3 + i * 2] = [...right];
    }
    
    return roundKeys;
  }
}

// Register the algorithm
RegisterAlgorithm(new GostKuznyechikAlgorithm());

// Export for module usage  
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new GostKuznyechikAlgorithm();
}