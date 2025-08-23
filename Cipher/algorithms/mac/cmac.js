/*
 * CMAC (Cipher-based Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * CMAC is a block cipher-based MAC algorithm that provides cryptographic authentication.
 * This implementation uses AES as the underlying block cipher and follows NIST SP 800-38B.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class CMACAlgorithm extends MacAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "CMAC";
    this.description = "Cipher-based Message Authentication Code as defined in NIST SP 800-38B. Provides cryptographic authentication using AES block cipher.";
    this.inventor = "NIST";
    this.year = 2005;
    this.category = CategoryType.MAC;
    this.subCategory = "CMAC";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;
    
    // MAC-specific configuration
    this.SupportedMacSizes = [
      new KeySize(16, 16, 1)  // 128-bit MAC output
    ];
    this.NeedsKey = true;
    
    // Documentation links
    this.documentation = [
      new LinkItem("NIST SP 800-38B - CMAC Specification", "https://csrc.nist.gov/publications/detail/sp/800-38b/final"),
      new LinkItem("RFC 4493 - The AES-CMAC Algorithm", "https://tools.ietf.org/html/rfc4493")
    ];
    
    // Reference links
    this.references = [
      new LinkItem("OpenSSL CMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/cmac/cmac.c"),
      new LinkItem("Bouncy Castle CMAC", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/macs"),
      new LinkItem("Python Cryptography CMAC", "https://cryptography.io/en/latest/hazmat/primitives/mac/cmac/")
    ];
    
    // Test vectors from NIST SP 800-38B
    this.tests = [
      // Test Case 1: Empty message
      {
        text: "NIST SP 800-38B Example 1 - Empty Message",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
        input: [],
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("bb1d6929e95937287fa37d129b756746")
      },
      // Test Case 2: Single block message
      {
        text: "NIST SP 800-38B Example 2 - Single Block",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("070a16b46b4d4144f79bdd9dd04a287c")
      },
      // Test Case 3: Multi-block message
      {
        text: "NIST SP 800-38B Example 3 - Multi Block",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("dfa66747de9ae63030ca32611497c827")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // CMAC cannot be reversed
    }
    return new CMACInstance(this);
  }
}

// Instance class - handles the actual CMAC computation
class CMACInstance extends IMacInstance {
  constructor(algorithm) {
    super(algorithm);
    this._key = null;
    this.inputBuffer = [];
    this.state = new Array(16).fill(0); // AES block state
    
    // AES-128 S-box
    this.SBOX = [
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
    
    // AES round constants
    this.RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
    
    this.roundKeys = null;
    this.subkeys = null; // K1 and K2 for CMAC
  }

  // Property setter for key
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.subkeys = null;
      return;
    }

    if (!Array.isArray(keyBytes)) {
      throw new Error("Invalid key - must be byte array");
    }

    if (keyBytes.length !== 16) {
      throw new Error("CMAC requires 128-bit (16-byte) AES key");
    }

    this._key = [...keyBytes];
    this.roundKeys = this._expandKey(keyBytes);
    this.subkeys = this._generateSubkeys();
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Feed data to the MAC
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    this.inputBuffer.push(...data);
  }

  // Get the MAC result
  Result() {
    if (!this._key) {
      throw new Error("Key not set");
    }
    // Note: Empty input is valid for CMAC
    
    const mac = this._computeCMAC();
    this.inputBuffer = []; // Clear buffer for next use
    this.state.fill(0); // Reset state
    return mac;
  }

  // Compute MAC (IMacInstance interface)
  ComputeMac(data) {
    if (!this._key) {
      throw new Error("Key not set");
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    
    // Temporarily store current buffer and replace with new data
    const originalBuffer = this.inputBuffer;
    this.inputBuffer = [...data];
    const result = this.Result();
    this.inputBuffer = originalBuffer; // Restore original buffer
    return result;
  }

  // AES key expansion
  _expandKey(key) {
    const roundKeys = [];
    const w = new Array(176); // 11 round keys * 16 bytes
    
    // Copy original key
    for (let i = 0; i < 16; i++) {
      w[i] = key[i];
    }
    
    // Generate round keys
    for (let i = 16; i < 176; i += 4) {
      let temp = [w[i-4], w[i-3], w[i-2], w[i-1]];
      
      if (i % 16 === 0) {
        // RotWord
        const t = temp[0];
        temp[0] = temp[1];
        temp[1] = temp[2];
        temp[2] = temp[3];
        temp[3] = t;
        
        // SubWord
        for (let j = 0; j < 4; j++) {
          temp[j] = this.SBOX[temp[j]];
        }
        
        // XOR with Rcon
        temp[0] ^= this.RCON[(i / 16) - 1];
      }
      
      for (let j = 0; j < 4; j++) {
        w[i + j] = w[i - 16 + j] ^ temp[j];
      }
    }
    
    // Split into round keys
    for (let i = 0; i < 11; i++) {
      roundKeys[i] = w.slice(i * 16, (i + 1) * 16);
    }
    
    return roundKeys;
  }

  // Generate CMAC subkeys K1 and K2
  _generateSubkeys() {
    // Encrypt zero block with AES
    const zeroBlock = new Array(16).fill(0);
    const L = this._aesEncrypt(zeroBlock);
    
    // Generate K1
    const K1 = this._leftShift(L);
    if (L[0] & 0x80) {
      K1[15] ^= 0x87; // Rb constant for 128-bit blocks
    }
    
    // Generate K2
    const K2 = this._leftShift(K1);
    if (K1[0] & 0x80) {
      K2[15] ^= 0x87;
    }
    
    return { K1, K2 };
  }

  // Left shift operation for CMAC subkey generation
  _leftShift(data) {
    const result = new Array(data.length);
    let carry = 0;
    
    for (let i = data.length - 1; i >= 0; i--) {
      const newCarry = (data[i] & 0x80) ? 1 : 0;
      result[i] = ((data[i] << 1) | carry) & 0xFF;
      carry = newCarry;
    }
    
    return result;
  }

  // AES-128 encryption
  _aesEncrypt(plaintext) {
    const state = [...plaintext];
    
    // Initial round
    this._addRoundKey(state, this.roundKeys[0]);
    
    // Main rounds
    for (let round = 1; round < 10; round++) {
      this._subBytes(state);
      this._shiftRows(state);
      this._mixColumns(state);
      this._addRoundKey(state, this.roundKeys[round]);
    }
    
    // Final round
    this._subBytes(state);
    this._shiftRows(state);
    this._addRoundKey(state, this.roundKeys[10]);
    
    return state;
  }

  // AES SubBytes transformation
  _subBytes(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = this.SBOX[state[i]];
    }
  }

  // AES ShiftRows transformation
  _shiftRows(state) {
    let temp;
    
    // Row 1: shift left by 1
    temp = state[1];
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
    
    // Row 3: shift left by 3
    temp = state[3];
    state[3] = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = temp;
  }

  // AES MixColumns transformation
  _mixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const s0 = state[c];
      const s1 = state[c + 4];
      const s2 = state[c + 8];
      const s3 = state[c + 12];
      
      state[c] = OpCodes.GF256Mul(0x02, s0) ^ OpCodes.GF256Mul(0x03, s1) ^ s2 ^ s3;
      state[c + 4] = s0 ^ OpCodes.GF256Mul(0x02, s1) ^ OpCodes.GF256Mul(0x03, s2) ^ s3;
      state[c + 8] = s0 ^ s1 ^ OpCodes.GF256Mul(0x02, s2) ^ OpCodes.GF256Mul(0x03, s3);
      state[c + 12] = OpCodes.GF256Mul(0x03, s0) ^ s1 ^ s2 ^ OpCodes.GF256Mul(0x02, s3);
    }
  }

  // AES AddRoundKey transformation
  _addRoundKey(state, roundKey) {
    for (let i = 0; i < 16; i++) {
      state[i] ^= roundKey[i];
    }
  }

  // Core CMAC computation
  _computeCMAC() {
    let x = new Array(16).fill(0); // CBC-MAC state
    
    // Process complete blocks
    let pos = 0;
    while (pos + 16 <= this.inputBuffer.length) {
      const block = this.inputBuffer.slice(pos, pos + 16);
      
      // XOR with previous state
      for (let i = 0; i < 16; i++) {
        x[i] ^= block[i];
      }
      
      // Encrypt with AES
      x = this._aesEncrypt(x);
      pos += 16;
    }
    
    // Handle final block
    const remainingBytes = this.inputBuffer.length - pos;
    const finalBlock = new Array(16).fill(0);
    
    if (remainingBytes === 16) {
      // Complete final block: XOR with K1
      for (let i = 0; i < 16; i++) {
        finalBlock[i] = this.inputBuffer[pos + i] ^ this.subkeys.K1[i];
      }
    } else {
      // Incomplete final block: pad and XOR with K2
      for (let i = 0; i < remainingBytes; i++) {
        finalBlock[i] = this.inputBuffer[pos + i];
      }
      finalBlock[remainingBytes] = 0x80; // Padding
      
      for (let i = 0; i < 16; i++) {
        finalBlock[i] ^= this.subkeys.K2[i];
      }
    }
    
    // XOR with state and encrypt
    for (let i = 0; i < 16; i++) {
      x[i] ^= finalBlock[i];
    }
    
    return this._aesEncrypt(x);
  }
}

// Register the algorithm
RegisterAlgorithm(new CMACAlgorithm());