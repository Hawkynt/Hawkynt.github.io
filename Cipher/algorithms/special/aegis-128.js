/*
 * AEGIS-128 Authenticated Encryption Implementation
 * NIST Lightweight Cryptography Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of AEGIS-128 AEAD cipher
 * CAESAR competition finalist with AES round function building blocks
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
        AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

class Aegis128Algorithm extends AeadAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "AEGIS-128";
    this.description = "High-performance authenticated encryption using AES round functions as building blocks. CAESAR competition finalist with excellent AES-NI performance.";
    this.inventor = "Hongjun Wu, Bart Preneel";
    this.year = 2014;
    this.category = CategoryType.SPECIAL;
    this.subCategory = "AEAD Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.CN;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 16, 16)
    ];
    this.SupportedTagSizes = [16]; // 128-bit authentication tag
    this.SupportsDetached = false;

    // Documentation and references
    this.documentation = [
      new LinkItem("AEGIS CAESAR Competition Submission", "https://competitions.cr.yp.to/round3/aegisv11.pdf"),
      new LinkItem("AEGIS Algorithm Specification v1.1", "https://datatracker.ietf.org/doc/draft-irtf-cfrg-aegis-aead/")
    ];

    this.references = [
      new LinkItem("The AEGIS Family of Authenticated Encryption Algorithms", "https://eprint.iacr.org/2013/695.pdf"),
      new LinkItem("CAESAR Competition Results", "https://competitions.cr.yp.to/caesar.html")
    ];

    // Known vulnerabilities (if any)
    this.knownVulnerabilities = [];

    // Test vectors using OpCodes byte arrays
    this.tests = [
      {
        text: "AEGIS-128 empty plaintext test vector",
        uri: "https://competitions.cr.yp.to/round3/aegisv11.pdf",
        input: [],
        key: OpCodes.Hex8ToBytes("10001000100010001000100010001000"),
        nonce: OpCodes.Hex8ToBytes("10001000100010001000100010001000"),
        aad: [],
        expected: OpCodes.Hex8ToBytes("79d94593d8c2119d7e8fd9b8fc77845c5c077a05b2528b6ac54b563aed8efe84")
      },
      {
        text: "AEGIS-128 single block test vector",
        uri: "https://competitions.cr.yp.to/round3/aegisv11.pdf",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("10001000100010001000100010001000"),
        nonce: OpCodes.Hex8ToBytes("10001000100010001000100010001000"),
        aad: [],
        expected: OpCodes.Hex8ToBytes("c1457a35a6ed5ff6ec0c8e0346b05821b0f11a0e26d4bd5fab4fb9ad80f65d78c8d0554f8ae9fd73")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new Aegis128AlgorithmInstance(this, isInverse);
  }
}

class Aegis128AlgorithmInstance extends IAeadInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.nonce = null;
    this.inputBuffer = [];
    this.tagSize = 16; // 128-bit authentication tag
    
    // AEGIS-128 specific state
    this.state = null;
    this.initialized = false;
    
    // Constants
    this.NONCE_SIZE = 16;
    this.TAG_SIZE = 16;
    this.KEY_SIZE = 16;
    this.STATE_SIZE = 5;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.initialized = false;
      return;
    }

    // Validate key size
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      const msg = OpCodes.AnsiToBytes(`Invalid key size: ${keyBytes.length} bytes`);
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }

    this._key = [...keyBytes];
    this.initialized = false;
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Set nonce for AEAD operation
  setNonce(nonce) {
    if (!nonce || nonce.length !== this.NONCE_SIZE) {
      const msg = OpCodes.AnsiToBytes("AEGIS-128 requires 16-byte nonce");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    this.nonce = [...nonce];
    this.initialized = false;
  }

  // Set additional authenticated data
  setAAD(aad) {
    this.aad = aad ? [...aad] : [];
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) {
      const msg = OpCodes.AnsiToBytes("Key not set");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }

    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) {
      const msg = OpCodes.AnsiToBytes("Key not set");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    // Set default nonce if not provided (for test vectors)
    if (!this.nonce) {
      this.nonce = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]; // 16-byte nonce
    }

    const input = this.inputBuffer;
    const output = this.isInverse 
      ? this._aeadDecrypt(input, this.nonce, this.aad || [])
      : this._aeadEncrypt(input, this.nonce, this.aad || []);

    // Clear buffers for next operation
    this.inputBuffer = [];
    this.aad = [];
    
    return output;
  }
  /**
   * AES round function (SubBytes, ShiftRows, MixColumns, AddRoundKey)
   * Simplified educational implementation
   * @param {Array} state - 16-byte state array
   * @param {Array} roundKey - 16-byte round key
   * @returns {Array} Updated 16-byte state
   */
  _aesRound(state, roundKey) {
    // SubBytes (S-box substitution)
    const sbox = [
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
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
    
    let result = state.slice(0);
    
    // SubBytes
    for (let i = 0; i < 16; i++) {
      result[i] = sbox[result[i]];
    }
    
    // ShiftRows
    const temp = result.slice(0);
    // Row 0: no shift
    // Row 1: shift left by 1
    result[1] = temp[5]; result[5] = temp[9]; result[9] = temp[13]; result[13] = temp[1];
    // Row 2: shift left by 2
    result[2] = temp[10]; result[6] = temp[14]; result[10] = temp[2]; result[14] = temp[6];
    // Row 3: shift left by 3
    result[3] = temp[15]; result[7] = temp[3]; result[11] = temp[7]; result[15] = temp[11];
    
    // MixColumns (simplified)
    for (let col = 0; col < 4; col++) {
      const c0 = result[col * 4];
      const c1 = result[col * 4 + 1];
      const c2 = result[col * 4 + 2];
      const c3 = result[col * 4 + 3];
      
      result[col * 4] = (this._gf2Mul(2, c0) ^ this._gf2Mul(3, c1) ^ c2 ^ c3) & 0xFF;
      result[col * 4 + 1] = (c0 ^ this._gf2Mul(2, c1) ^ this._gf2Mul(3, c2) ^ c3) & 0xFF;
      result[col * 4 + 2] = (c0 ^ c1 ^ this._gf2Mul(2, c2) ^ this._gf2Mul(3, c3)) & 0xFF;
      result[col * 4 + 3] = (this._gf2Mul(3, c0) ^ c1 ^ c2 ^ this._gf2Mul(2, c3)) & 0xFF;
    }
    
    // AddRoundKey
    for (let i = 0; i < 16; i++) {
      result[i] ^= roundKey[i];
    }
    
    return result;
  }

  /**
   * Galois Field multiplication for MixColumns
   * @param {number} a - First operand
   * @param {number} b - Second operand
   * @returns {number} Product in GF(2^8)
   */
  _gf2Mul(a, b) {
    let result = 0;
    for (let i = 0; i < 8; i++) {
      if ((b & 1) === 1) {
        result ^= a;
      }
      const carry = (a & 0x80) !== 0;
      a <<= 1;
      if (carry) {
        a ^= 0x1b; // AES irreducible polynomial
      }
      b >>= 1;
    }
    return result & 0xFF;
  }
  /**
   * Initialize AEGIS-128 state with key and nonce
   */
  _initialize() {
    if (!this.nonce) {
      const msg = OpCodes.AnsiToBytes("Nonce must be set before initialization");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    // Initialize state array
    this.state = new Array(this.STATE_SIZE);
    for (let i = 0; i < this.STATE_SIZE; i++) {
      this.state[i] = new Array(16); // Each register is 16 bytes
    }
    
    // Constants for AEGIS-128 initialization
    const c0 = [0x00, 0x01, 0x01, 0x02, 0x03, 0x05, 0x08, 0x0d, 0x15, 0x22, 0x37, 0x59, 0x90, 0xe9, 0x79, 0x62];
    const c1 = [0xdb, 0x3d, 0x18, 0x55, 0x6d, 0xc2, 0x2f, 0xf1, 0x20, 0x11, 0x31, 0x42, 0x73, 0xb5, 0x28, 0xdd];
    
    // Initialize state registers
    this.state[0] = [...this._key];  // S0 = key
    this.state[1] = [...this.nonce]; // S1 = nonce
    this.state[2] = [...c1];         // S2 = c1
    this.state[3] = [...c0];         // S3 = c0
    
    // S4 = key XOR nonce
    this.state[4] = [];
    for (let i = 0; i < 16; i++) {
      this.state[4][i] = this._key[i] ^ this.nonce[i];
    }
    
    // Run 10 initialization rounds
    for (let i = 0; i < 10; i++) {
      this._stateUpdate(this._key, this.nonce);
    }
    
    this.initialized = true;
  }
  
  /**
   * AEGIS-128 state update function
   * @param {Array} msg0 - First 16-byte message block
   * @param {Array} msg1 - Second 16-byte message block (can be same as msg0)
   */
  _stateUpdate(msg0, msg1) {
    // Temporary storage for state updates
    const temp = new Array(this.STATE_SIZE);
    
    // AES round functions with message injection
    temp[0] = this._aesRound(this.state[4], this.state[0]);
    for (let i = 0; i < 16; i++) {
      temp[0][i] ^= msg0[i];
    }
    
    temp[1] = this._aesRound(this.state[0], this.state[1]);
    temp[2] = this._aesRound(this.state[1], this.state[2]);
    temp[3] = this._aesRound(this.state[2], this.state[3]);
    
    temp[4] = this._aesRound(this.state[3], this.state[4]);
    for (let i = 0; i < 16; i++) {
      temp[4][i] ^= msg1[i];
    }
    
    // Update state
    for (let i = 0; i < this.STATE_SIZE; i++) {
      this.state[i] = temp[i];
    }
  }
  
  /**
   * Process associated data
   * @param {Array} aad - Associated authenticated data bytes
   */
  _processAAD(aad) {
    // Process complete 16-byte blocks
    for (let i = 0; i < aad.length; i += 16) {
      const block = aad.slice(i, i + 16);
      
      // Pad partial blocks with zeros
      while (block.length < 16) {
        block.push(0);
      }
      
      this._stateUpdate(block, block);
    }
  }
  
  /**
   * Finalize and generate authentication tag
   * @param {number} aadLen - Length of associated data in bytes
   * @param {number} msgLen - Length of message in bytes
   * @returns {Array} 16-byte authentication tag
   */
  _finalize(aadLen, msgLen) {
    // Create length block (little-endian 64-bit lengths)
    const lengthBlock = new Array(16);
    
    // AAD length in bits (little-endian 64-bit)
    const aadBits = aadLen * 8;
    for (let i = 0; i < 8; i++) {
      lengthBlock[i] = (aadBits >>> (i * 8)) & 0xFF;
    }
    
    // Message length in bits (little-endian 64-bit)
    const msgBits = msgLen * 8;
    for (let i = 0; i < 8; i++) {
      lengthBlock[8 + i] = (msgBits >>> (i * 8)) & 0xFF;
    }
    
    // Process length block
    this._stateUpdate(lengthBlock, lengthBlock);
    
    // Run 7 additional rounds
    for (let i = 0; i < 7; i++) {
      this._stateUpdate(this.state[0], this.state[0]);
    }
    
    // Generate authentication tag
    const tag = [];
    for (let i = 0; i < 16; i++) {
      tag[i] = this.state[0][i] ^ this.state[1][i] ^ this.state[2][i] ^ this.state[3][i] ^ this.state[4][i];
    }
    
    return tag;
  }
  
  _aeadEncrypt(plaintext, nonce, aad) {
    // Simplified AEGIS-128 encryption for educational purposes
    if (!this.initialized) {
      this._initialize();
    }
    
    // Process associated data
    this._processAAD(aad);
    
    // Encrypt plaintext
    const ciphertext = [];
    
    // Process complete 16-byte blocks
    for (let i = 0; i < plaintext.length; i += 16) {
      const block = plaintext.slice(i, i + 16);
      const isPartialBlock = block.length < 16;
      
      // Generate keystream
      const keystream = [];
      for (let j = 0; j < 16; j++) {
        keystream[j] = this.state[1][j] ^ this.state[4][j] ^ this.state[2][j] ^ (this.state[3][j] & this.state[4][j]);
      }
      
      // Encrypt block
      const cipherBlock = [];
      for (let j = 0; j < block.length; j++) {
        cipherBlock[j] = block[j] ^ keystream[j];
      }
      ciphertext.push(...cipherBlock);
      
      // Pad partial blocks for state update
      const paddedBlock = [...block];
      if (isPartialBlock) {
        while (paddedBlock.length < 16) {
          paddedBlock.push(0);
        }
      }
      
      this._stateUpdate(paddedBlock, paddedBlock);
    }
    
    // Generate authentication tag
    const tag = this._finalize(aad.length, plaintext.length);
    
    return [...ciphertext, ...tag];
  }
  
  _aeadDecrypt(ciphertextWithTag, nonce, aad) {
    if (ciphertextWithTag.length < this.TAG_SIZE) {
      const msg = OpCodes.AnsiToBytes("Ciphertext too short for authentication tag");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    const ciphertext = ciphertextWithTag.slice(0, -this.TAG_SIZE);
    const providedTag = ciphertextWithTag.slice(-this.TAG_SIZE);
    
    // Initialize state
    if (!this.initialized) {
      this._initialize();
    }
    
    // Process associated data
    this._processAAD(aad);
    
    // Decrypt ciphertext (same as encryption for stream cipher component)
    const plaintext = [];
    
    // Process complete 16-byte blocks
    for (let i = 0; i < ciphertext.length; i += 16) {
      const block = ciphertext.slice(i, i + 16);
      const isPartialBlock = block.length < 16;
      
      // Generate keystream
      const keystream = [];
      for (let j = 0; j < 16; j++) {
        keystream[j] = this.state[1][j] ^ this.state[4][j] ^ this.state[2][j] ^ (this.state[3][j] & this.state[4][j]);
      }
      
      // Decrypt block
      const plainBlock = [];
      for (let j = 0; j < block.length; j++) {
        plainBlock[j] = block[j] ^ keystream[j];
      }
      plaintext.push(...plainBlock);
      
      // Pad partial blocks for state update
      const paddedBlock = [...plainBlock];
      if (isPartialBlock) {
        while (paddedBlock.length < 16) {
          paddedBlock.push(0);
        }
      }
      
      this._stateUpdate(paddedBlock, paddedBlock);
    }
    
    // Verify authentication tag
    const expectedTag = this._finalize(aad.length, ciphertext.length);
    
    if (!OpCodes.SecureCompare(providedTag, expectedTag)) {
      const msg = OpCodes.AnsiToBytes("Authentication verification failed");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    return plaintext;
  }
}
// Register the algorithm
RegisterAlgorithm(new Aegis128Algorithm());

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new Aegis128Algorithm();
}