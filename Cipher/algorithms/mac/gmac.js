/*
 * GMAC (Galois Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * GMAC is the authentication component of GCM mode, providing message
 * authentication using Galois Field arithmetic over GF(2^128).
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

class GMACAlgorithm extends MacAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "GMAC";
    this.description = "Galois Message Authentication Code as defined in NIST SP 800-38D. Authentication component of GCM mode using Galois Field arithmetic.";
    this.inventor = "NIST";
    this.year = 2007;
    this.category = CategoryType.MAC;
    this.subCategory = "GMAC";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.US;
    
    // MAC-specific configuration
    this.SupportedMacSizes = [
      new KeySize(16, 16, 0)  // 128-bit MAC output
    ];
    this.NeedsKey = true;
    this.NeedsNonce = true; // GMAC requires IV/nonce
    
    // Documentation links
    this.documentation = [
      new LinkItem("NIST SP 800-38D - GCM Specification", "https://csrc.nist.gov/publications/detail/sp/800-38d/final"),
      new LinkItem("RFC 5288 - AES Galois Counter Mode", "https://tools.ietf.org/html/rfc5288")
    ];
    
    // Reference links
    this.references = [
      new LinkItem("Intel PCLMULQDQ Instruction", "https://software.intel.com/content/www/us/en/develop/articles/intel-carry-less-multiplication-instruction-and-its-usage-for-computing-the-gcm-mode.html"),
      new LinkItem("Bouncy Castle GCM/GMAC", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/modes/gcm"),
      new LinkItem("OpenSSL GMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c")
    ];
    
    // Test vectors from NIST SP 800-38D
    this.tests = [
      // Test Case 1: Empty AAD
      {
        text: "NIST SP 800-38D Test Case 1 - Empty AAD",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38d/final",
        input: [], // No AAD
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("58E2FCCEFA7E3061367F1D57A4E7455A")
      },
      // Test Case 2: With AAD
      {
        text: "NIST SP 800-38D Test Case 2 - With AAD",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38d/final",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("AB6E47D42CEC13BDF53A67B21257BDDF")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // GMAC cannot be reversed
    }
    return new GMACInstance(this);
  }
}

// Instance class - handles the actual GMAC computation
class GMACInstance extends IMacInstance {
  constructor(algorithm) {
    super(algorithm);
    this._key = null;
    this._nonce = null;
    this.inputBuffer = [];
    
    this.h = new Array(16).fill(0); // Authentication key H = AES_K(0^128)
    this.ghashState = new Array(16).fill(0); // GHASH accumulator
    
    // AES-128 S-box for key generation
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
    
    this.RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
    this.roundKeys = null;
  }

  // Property setter for key
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.h.fill(0);
      return;
    }

    if (!Array.isArray(keyBytes)) {
      throw new Error("Invalid key - must be byte array");
    }

    if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
      throw new Error("GMAC requires 128, 192, or 256-bit AES key");
    }

    this._key = [...keyBytes];
    this.roundKeys = this._expandKey(keyBytes);
    
    // Generate authentication key H = AES_K(0^128)
    const zeroBlock = new Array(16).fill(0);
    this.h = this._aesEncrypt(zeroBlock);
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Property setter for nonce/IV
  set nonce(nonceBytes) {
    if (!nonceBytes) {
      this._nonce = null;
      return;
    }

    if (!Array.isArray(nonceBytes)) {
      throw new Error("Invalid nonce - must be byte array");
    }

    if (nonceBytes.length !== 12) {
      throw new Error("GMAC requires 96-bit (12-byte) nonce");
    }

    this._nonce = [...nonceBytes];
  }

  get nonce() {
    return this._nonce ? [...this._nonce] : null;
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
    if (!this._nonce) {
      throw new Error("Nonce not set - GMAC requires IV");
    }
    
    const mac = this._computeGMAC();
    this.inputBuffer = []; // Clear buffer for next use
    this.ghashState.fill(0); // Reset GHASH state
    return mac;
  }

  // Compute MAC (IMacInstance interface)
  ComputeMac(data) {
    if (!this._key) {
      throw new Error("Key not set");
    }
    if (!this._nonce) {
      throw new Error("Nonce not set - GMAC requires IV");
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

  // AES key expansion (simplified for AES-128)
  _expandKey(key) {
    const roundKeys = [];
    const keyLength = key.length;
    const rounds = keyLength === 16 ? 10 : keyLength === 24 ? 12 : 14;
    const w = new Array((rounds + 1) * 16);
    
    // Copy original key
    for (let i = 0; i < keyLength; i++) {
      w[i] = key[i];
    }
    
    // Generate round keys (simplified for educational purposes)
    const keyWords = keyLength / 4;
    for (let i = keyWords; i < (rounds + 1) * 4; i++) {
      let temp = [w[(i-1)*4], w[(i-1)*4+1], w[(i-1)*4+2], w[(i-1)*4+3]];
      
      if (i % keyWords === 0) {
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
        temp[0] ^= this.RCON[Math.floor(i / keyWords) - 1];
      }
      
      for (let j = 0; j < 4; j++) {
        w[i*4 + j] = w[(i-keyWords)*4 + j] ^ temp[j];
      }
    }
    
    // Split into round keys
    for (let i = 0; i <= rounds; i++) {
      roundKeys[i] = w.slice(i * 16, (i + 1) * 16);
    }
    
    return roundKeys;
  }

  // AES-128 encryption (simplified)
  _aesEncrypt(plaintext) {
    const state = [...plaintext];
    const rounds = this.roundKeys.length - 1;
    
    // Initial round
    this._addRoundKey(state, this.roundKeys[0]);
    
    // Main rounds
    for (let round = 1; round < rounds; round++) {
      this._subBytes(state);
      this._shiftRows(state);
      this._mixColumns(state);
      this._addRoundKey(state, this.roundKeys[round]);
    }
    
    // Final round
    this._subBytes(state);
    this._shiftRows(state);
    this._addRoundKey(state, this.roundKeys[rounds]);
    
    return state;
  }

  // AES transformations
  _subBytes(state) {
    for (let i = 0; i < 16; i++) {
      state[i] = this.SBOX[state[i]];
    }
  }

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

  _addRoundKey(state, roundKey) {
    for (let i = 0; i < 16; i++) {
      state[i] ^= roundKey[i];
    }
  }

  // GF(2^128) multiplication
  _gfMultiply(x, y) {
    const result = new Array(16).fill(0);
    const v = [...y];
    
    for (let i = 0; i < 16; i++) {
      for (let j = 7; j >= 0; j--) {
        if ((x[i] >>> j) & 1) {
          // XOR v into result
          for (let k = 0; k < 16; k++) {
            result[k] ^= v[k];
          }
        }
        
        // Right shift v and apply reduction if needed
        const carry = v[15] & 1;
        for (let k = 15; k > 0; k--) {
          v[k] = (v[k] >>> 1) | ((v[k-1] & 1) << 7);
        }
        v[0] = (v[0] >>> 1);
        
        if (carry) {
          v[0] ^= 0xE1; // Apply reduction polynomial
        }
      }
    }
    
    return result;
  }

  // GHASH function - core of GMAC authentication
  _ghash(data) {
    let y = new Array(16).fill(0);
    
    // Process data in 128-bit blocks
    for (let i = 0; i < data.length; i += 16) {
      const block = data.slice(i, Math.min(i + 16, data.length));
      
      // Pad block if necessary
      while (block.length < 16) {
        block.push(0);
      }
      
      // Y_i = (Y_{i-1} ⊕ X_i) · H
      for (let j = 0; j < 16; j++) {
        y[j] ^= block[j];
      }
      
      y = this._gfMultiply(y, this.h);
    }
    
    return y;
  }

  // Core GMAC computation
  _computeGMAC() {
    // Prepare GMAC input: AAD || len(AAD)
    const gmacInput = [...this.inputBuffer];
    
    // Pad AAD to block boundary
    const aadPadding = 16 - (gmacInput.length % 16);
    if (aadPadding < 16) {
      for (let i = 0; i < aadPadding; i++) {
        gmacInput.push(0);
      }
    }
    
    // Append length fields: len(AAD) || len(C) = len(AAD) || 0
    const aadBitLength = this.inputBuffer.length * 8;
    const plaintextBitLength = 0; // GMAC has no ciphertext
    
    // Add 64-bit AAD length (big-endian)
    for (let i = 7; i >= 0; i--) {
      gmacInput.push((aadBitLength >>> (i * 8)) & 0xFF);
    }
    
    // Add 64-bit plaintext length (big-endian, zero for GMAC)
    for (let i = 7; i >= 0; i--) {
      gmacInput.push((plaintextBitLength >>> (i * 8)) & 0xFF);
    }
    
    // Compute GHASH
    const ghashResult = this._ghash(gmacInput);
    
    // Generate J_0 from IV: IV || 0^31 || 1
    const j0 = [...this._nonce];
    j0.push(0, 0, 0, 1);
    
    // Encrypt J_0 to get tag mask
    const tagMask = this._aesEncrypt(j0);
    
    // Final tag = GHASH ⊕ E_K(J_0)
    const tag = new Array(16);
    for (let i = 0; i < 16; i++) {
      tag[i] = ghashResult[i] ^ tagMask[i];
    }
    
    return tag;
  }
}

// Register the algorithm
RegisterAlgorithm(new GMACAlgorithm());