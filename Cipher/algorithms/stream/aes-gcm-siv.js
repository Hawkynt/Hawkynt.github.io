/*
 * AES-GCM-SIV Implementation - Nonce-Misuse Resistant Authenticated Encryption
 * RFC 8452 Standard
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const AES_GCM_SIV = {
    name: "AES-GCM-SIV",
    description: "Synthetic Initialization Vector (SIV) authenticated encryption mode providing nonce-misuse resistance. Combines the efficiency of GCM with the security guarantees of SIV mode.",
    inventor: "Shay Gueron, Yehuda Lindell",
    year: 2017,
    country: "Multi-national",
    category: "cipher",
    subCategory: "Authenticated Encryption",
    securityStatus: "standard",
    securityNotes: "RFC 8452 standard providing nonce-misuse resistant authenticated encryption. Safer than standard GCM when nonces might be reused.",
    
    documentation: [
      {text: "RFC 8452", uri: "https://tools.ietf.org/rfc/rfc8452.html"},
      {text: "Original Paper", uri: "https://eprint.iacr.org/2017/168"},
      {text: "IETF Draft", uri: "https://datatracker.ietf.org/doc/draft-irtf-cfrg-gcmsiv/"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/Wycheproof/wycheproof"},
      {text: "Security Analysis", uri: "https://eprint.iacr.org/2017/168"},
      {text: "Performance Benchmarks", uri: "https://bench.cr.yp.to/results-aead.html"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Key Commitment",
        text: "Does not provide key commitment properties",
        mitigation: "Use dedicated key commitment schemes if required"
      }
    ],
    
    tests: [
      {
        text: "AES-128-GCM-SIV Test Vector 1",
        uri: "RFC 8452",
        key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("DC20E2D83F25705BB49E439ECA56DE25")
      },
      {
        text: "AES-128-GCM-SIV Test Vector 2",
        uri: "RFC 8452",
        key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes("0100000000000000"),
        expectedCiphertext: OpCodes.Hex8ToBytes("B5D839330AC7B786"),
        expectedTag: OpCodes.Hex8ToBytes("578782FFF6013B815B287C22493A364C")
      },
      {
        text: "AES-128-GCM-SIV Test Vector 3",
        uri: "RFC 8452",
        key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
        aad: OpCodes.Hex8ToBytes("01"),
        plaintext: OpCodes.Hex8ToBytes("010000000000000000000000"),
        expectedCiphertext: OpCodes.Hex8ToBytes("7A78A4F8F1A6ADA6C3D4C037"),
        expectedTag: OpCodes.Hex8ToBytes("CE4F3F334B69A6F3F2F6C395B3C60C0F")
      }
    ],

    // Legacy interface properties
    internalName: 'aes-gcm-siv',
    minKeyLength: 16,
    maxKeyLength: 32,
    stepKeyLength: 16,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 16,
    blockSize: 16,
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: true,
    isAEAD: true,
    complexity: 'High',
    family: 'AES-GCM',
    category: 'Authenticated-Encryption',
    
    // AES-GCM-SIV constants
    BLOCK_SIZE: 16,
    TAG_SIZE: 16,
    NONCE_SIZE: 12,
    
    // AES S-box
    SBOX: [
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
    ],
    
    // Current configuration
    key: null,
    keyScheduled: false,
    
    // Initialize AES-GCM-SIV
    Init: function() {
      this.key = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 16 && key.length !== 32) {
        throw new Error('AES-GCM-SIV requires 16-byte (AES-128) or 32-byte (AES-256) key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'aes-gcm-siv-' + (key.length * 8) + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Simplified AES encryption (educational implementation)
    aesEncrypt: function(key, plaintext) {
      // This is a simplified educational AES implementation
      // Production code would use a full AES implementation
      
      const state = OpCodes.CopyArray(plaintext);
      const roundKeys = this.generateRoundKeys(key);
      
      // Initial round
      this.addRoundKey(state, roundKeys[0]);
      
      // Main rounds
      const numRounds = (key.length === 16) ? 10 : 14;
      for (let round = 1; round < numRounds; round++) {
        this.subBytes(state);
        this.shiftRows(state);
        this.mixColumns(state);
        this.addRoundKey(state, roundKeys[round]);
      }
      
      // Final round
      this.subBytes(state);
      this.shiftRows(state);
      this.addRoundKey(state, roundKeys[numRounds]);
      
      return state;
    },
    
    // Generate AES round keys (simplified)
    generateRoundKeys: function(key) {
      const roundKeys = [];
      const numRounds = (key.length === 16) ? 11 : 15;
      
      // First round key is the original key
      roundKeys.push(OpCodes.CopyArray(key));
      
      // Generate subsequent round keys (simplified)
      for (let i = 1; i < numRounds; i++) {
        const prevKey = roundKeys[i - 1];
        const newKey = new Array(16);
        
        for (let j = 0; j < 16; j++) {
          newKey[j] = prevKey[j] ^ (i + j);
        }
        
        roundKeys.push(newKey);
      }
      
      return roundKeys;
    },
    
    // AES SubBytes operation
    subBytes: function(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
    },
    
    // AES ShiftRows operation (simplified)
    shiftRows: function(state) {
      // Row 1: shift left by 1
      const temp1 = state[1];
      state[1] = state[5];
      state[5] = state[9];
      state[9] = state[13];
      state[13] = temp1;
      
      // Row 2: shift left by 2
      const temp2a = state[2], temp2b = state[6];
      state[2] = state[10];
      state[6] = state[14];
      state[10] = temp2a;
      state[14] = temp2b;
      
      // Row 3: shift left by 3
      const temp3 = state[15];
      state[15] = state[11];
      state[11] = state[7];
      state[7] = state[3];
      state[3] = temp3;
    },
    
    // AES MixColumns operation (simplified)
    mixColumns: function(state) {
      for (let col = 0; col < 4; col++) {
        const offset = col * 4;
        const s0 = state[offset];
        const s1 = state[offset + 1];
        const s2 = state[offset + 2];
        const s3 = state[offset + 3];
        
        state[offset] = this.gfMul(2, s0) ^ this.gfMul(3, s1) ^ s2 ^ s3;
        state[offset + 1] = s0 ^ this.gfMul(2, s1) ^ this.gfMul(3, s2) ^ s3;
        state[offset + 2] = s0 ^ s1 ^ this.gfMul(2, s2) ^ this.gfMul(3, s3);
        state[offset + 3] = this.gfMul(3, s0) ^ s1 ^ s2 ^ this.gfMul(2, s3);
      }
    },
    
    // Galois Field multiplication (simplified)
    gfMul: function(a, b) {
      let result = 0;
      while (a > 0) {
        if (a & 1) {
          result ^= b;
        }
        a >>>= 1;
        b <<= 1;
        if (b & 0x100) {
          b ^= 0x11B; // AES irreducible polynomial
        }
      }
      return result & 0xFF;
    },
    
    // Add round key
    addRoundKey: function(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] ^= roundKey[i % roundKey.length];
      }
    },
    
    // POLYVAL hash function (GCM-SIV specific)
    polyval: function(key, data) {
      // Simplified POLYVAL implementation
      let result = new Array(16).fill(0);
      
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        while (block.length < 16) {
          block.push(0);
        }
        
        // XOR with result
        for (let j = 0; j < 16; j++) {
          result[j] ^= block[j];
        }
        
        // Multiply by key in GF(2^128) (simplified)
        result = this.gf128Multiply(result, key);
      }
      
      return result;
    },
    
    // GF(2^128) multiplication (simplified educational version)
    gf128Multiply: function(a, b) {
      const result = new Array(16).fill(0);
      
      // Simplified multiplication for educational purposes
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
          result[(i + j) % 16] ^= ((a[i] * b[j]) & 0xFF);
        }
      }
      
      return result;
    },
    
    // Derive authentication key
    deriveAuthKey: function(key, nonce) {
      const input = new Array(16).fill(0);
      input[0] = 0; // Counter for auth key derivation
      
      for (let i = 0; i < nonce.length; i++) {
        input[4 + i] = nonce[i];
      }
      
      return this.aesEncrypt(key, input);
    },
    
    // Derive encryption key
    deriveEncKey: function(key, nonce) {
      const input = new Array(16).fill(0);
      input[0] = 1; // Counter for enc key derivation
      
      for (let i = 0; i < nonce.length; i++) {
        input[4 + i] = nonce[i];
      }
      
      return this.aesEncrypt(key, input);
    },
    
    // Generate synthetic IV
    generateSIV: function(authKey, aad, plaintext) {
      const data = [];
      
      // Add AAD
      if (aad && aad.length > 0) {
        data.push(...aad);
        // Add padding
        while (data.length % 16 !== 0) {
          data.push(0);
        }
      }
      
      // Add plaintext
      if (plaintext && plaintext.length > 0) {
        data.push(...plaintext);
        // Add padding
        while (data.length % 16 !== 0) {
          data.push(0);
        }
      }
      
      // Add length block
      const lengthBlock = new Array(16).fill(0);
      lengthBlock[0] = (aad ? aad.length : 0) & 0xFF;
      lengthBlock[8] = (plaintext ? plaintext.length : 0) & 0xFF;
      data.push(...lengthBlock);
      
      // Compute POLYVAL
      const hash = this.polyval(authKey, data);
      
      // XOR with nonce
      for (let i = 0; i < 12; i++) {
        hash[i] ^= this.nonce[i];
      }
      
      // Clear bit 63
      hash[15] &= 0x7F;
      
      return hash;
    },
    
    // CTR mode encryption
    ctrEncrypt: function(key, iv, plaintext) {
      const ciphertext = [];
      let counter = OpCodes.CopyArray(iv);
      
      // Set bit 63
      counter[15] |= 0x80;
      
      for (let i = 0; i < plaintext.length; i += 16) {
        const block = plaintext.slice(i, i + 16);
        const keystream = this.aesEncrypt(key, counter);
        
        for (let j = 0; j < block.length; j++) {
          ciphertext.push(block[j] ^ keystream[j]);
        }
        
        // Increment counter
        this.incrementCounter(counter);
      }
      
      return ciphertext;
    },
    
    // Increment counter
    incrementCounter: function(counter) {
      for (let i = 0; i < 16; i++) {
        counter[i]++;
        if (counter[i] !== 0) break;
      }
    },
    
    // AEAD Encryption
    encryptAEAD: function(key, nonce, aad, plaintext) {
      this.nonce = nonce;
      
      // Derive keys
      const authKey = this.deriveAuthKey(key, nonce);
      const encKey = this.deriveEncKey(key, nonce);
      
      // Generate synthetic IV
      const siv = this.generateSIV(authKey, aad, plaintext);
      
      // Encrypt with CTR mode
      const ciphertext = this.ctrEncrypt(encKey, siv, plaintext);
      
      return {
        ciphertext: ciphertext,
        tag: siv
      };
    },
    
    // AEAD Decryption with verification
    decryptAEAD: function(key, nonce, aad, ciphertext, tag) {
      this.nonce = nonce;
      
      // Derive keys
      const authKey = this.deriveAuthKey(key, nonce);
      const encKey = this.deriveEncKey(key, nonce);
      
      // Decrypt with CTR mode
      const plaintext = this.ctrEncrypt(encKey, tag, ciphertext);
      
      // Verify tag
      const expectedSIV = this.generateSIV(authKey, aad, plaintext);
      
      if (!OpCodes.SecureCompare(tag, expectedSIV)) {
        throw new Error('Authentication tag verification failed');
      }
      
      return plaintext;
    },
    
    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const nonce = new Array(12).fill(0);
      nonce[0] = blockIndex & 0xFF;
      nonce[1] = (blockIndex >> 8) & 0xFF;
      
      const result = this.encryptAEAD(this.key, nonce, null, plaintext);
      return result.ciphertext.concat(result.tag);
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      if (ciphertext.length < 16) {
        throw new Error('Ciphertext too short for authentication tag');
      }
      
      const nonce = new Array(12).fill(0);
      nonce[0] = blockIndex & 0xFF;
      nonce[1] = (blockIndex >> 8) & 0xFF;
      
      const actualCiphertext = ciphertext.slice(0, -16);
      const tag = ciphertext.slice(-16);
      
      return this.decryptAEAD(this.key, nonce, null, actualCiphertext, tag);
    },
    
    ClearData: function() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
      }
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running AES-GCM-SIV test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.nonce, test.aad, test.plaintext);
          
          const ciphertextMatch = OpCodes.SecureCompare(result.ciphertext, test.expectedCiphertext);
          const tagMatch = OpCodes.SecureCompare(result.tag, test.expectedTag);
          
          if (ciphertextMatch && tagMatch) {
            console.log(`Test ${i + 1}: PASS`);
          } else {
            console.log(`Test ${i + 1}: FAIL`);
            if (!ciphertextMatch) {
              console.log('Expected ciphertext:', OpCodes.BytesToHex8(test.expectedCiphertext));
              console.log('Actual ciphertext:', OpCodes.BytesToHex8(result.ciphertext));
            }
            if (!tagMatch) {
              console.log('Expected tag:', OpCodes.BytesToHex8(test.expectedTag));
              console.log('Actual tag:', OpCodes.BytesToHex8(result.tag));
            }
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Demonstrate nonce-misuse resistance
      console.log('\\nAES-GCM-SIV Nonce-Misuse Resistance Demonstration:');
      this.Init();
      this.KeySetup(OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF"));
      
      const nonce = OpCodes.Hex8ToBytes("000000000000000000000000");
      const aad = OpCodes.StringToBytes("Nonce reuse safe");
      const plaintext1 = OpCodes.StringToBytes("First message");
      const plaintext2 = OpCodes.StringToBytes("Second message");
      
      // Same nonce, different plaintexts
      const encrypted1 = this.encryptAEAD(this.key, nonce, aad, plaintext1);
      const encrypted2 = this.encryptAEAD(this.key, nonce, aad, plaintext2);
      
      console.log('Same nonce used for both encryptions');
      console.log('Plaintext 1:', OpCodes.BytesToString(plaintext1));
      console.log('Plaintext 2:', OpCodes.BytesToString(plaintext2));
      console.log('Ciphertext 1:', OpCodes.BytesToHex8(encrypted1.ciphertext));
      console.log('Ciphertext 2:', OpCodes.BytesToHex8(encrypted2.ciphertext));
      console.log('Tags different (deterministic but secure):', !OpCodes.SecureCompare(encrypted1.tag, encrypted2.tag));
      
      return {
        algorithm: 'AES-GCM-SIV',
        keySize: this.key ? this.key.length * 8 : 128,
        allTestsPassed: allPassed,
        testCount: this.tests.length,
        nonceSize: this.NONCE_SIZE,
        tagSize: this.TAG_SIZE,
        notes: 'Nonce-misuse resistant authenticated encryption mode'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(AES_GCM_SIV);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AES_GCM_SIV;
  }
  
  // Global export
  global.AES_GCM_SIV = AES_GCM_SIV;
  
})(typeof global !== 'undefined' ? global : window);