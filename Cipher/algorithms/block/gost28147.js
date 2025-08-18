/*
 * Universal GOST 28147-89 Cipher
 * Compatible with both Browser and Node.js environments
 * Russian Federal Standard GOST 28147-89 block cipher implementation
 * 
 * Algorithm specifications:
 * - Type: Feistel cipher
 * - Key Size: 256 bits (32 bytes)
 * - Block Size: 64 bits (8 bytes) 
 * - Rounds: 32 rounds (24 forward + 8 reverse)
 * - S-boxes: 8 S-boxes with 4-bit to 4-bit substitution
 * 
 * References:
 * - RFC 4357: Additional Cryptographic Algorithms for Use with GOST 28147-89
 * - GOST 28147-89: Soviet/Russian encryption standard
 * 
 * (c)2025 Educational implementation for cryptographic learning
 */

(function(global) {
  'use strict';
  
  // Ensure dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('GOST 28147-89 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // GOST 28147-89 S-boxes (RFC 4357 id-Gost28147-89-CryptoPro-A-ParamSet)
  // Each S-box is 4-bit to 4-bit substitution (16 entries)
  const GOST_SBOXES = [
    // S0
    [10, 4, 5, 6, 8, 1, 3, 7, 13, 12, 14, 0, 9, 2, 11, 15],
    // S1
    [5, 15, 4, 0, 2, 13, 11, 9, 1, 7, 6, 3, 12, 14, 10, 8],
    // S2 
    [7, 15, 12, 14, 9, 4, 1, 0, 3, 11, 5, 2, 6, 10, 8, 13],
    // S3
    [4, 10, 7, 12, 0, 15, 2, 8, 14, 1, 6, 5, 13, 11, 9, 3],
    // S4
    [7, 6, 4, 11, 9, 12, 2, 10, 1, 8, 0, 14, 15, 13, 3, 5],
    // S5
    [7, 6, 2, 4, 13, 9, 15, 0, 10, 1, 5, 11, 8, 14, 12, 3],
    // S6
    [13, 14, 4, 1, 7, 0, 5, 10, 3, 12, 8, 15, 6, 2, 9, 11],
    // S7
    [1, 3, 10, 9, 5, 11, 4, 15, 8, 6, 7, 14, 13, 0, 2, 12]
  ];
  
  // Create GOST cipher object
  const GOST28147 = {
    // Public interface properties
    internalName: 'gost-28147-89',
    name: 'GOST 28147-89',
    comment: 'Russian Federal Standard GOST 28147-89 block cipher',
    minKeyLength: 32,  // 256 bits
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 8,   // 64 bits
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f",
        "expected": "ÛZ¡ÝÒÄû»",
        "description": "GOST 28147-89 all zeros plaintext test vector (educational)"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f",
        "expected": ")Ùì¶L¿t",
        "description": "GOST 28147-89 pattern test vector (educational)"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "Ã¬Iù§:né",
        "description": "GOST 28147-89 all ones boundary test vector (educational)"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Initialize cipher
    Init: function() {
      GOST28147.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(key) {
      if (!key || key.length !== 32) {
        global.throwException('Invalid Key Length Exception', key ? key.length : 0, 'GOST28147', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'GOST28147[' + global.generateUniqueID() + ']';
      } while (GOST28147.instances[id] || global.objectInstances[id]);
      
      GOST28147.instances[szID] = new GOST28147.GOSTInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (GOST28147.instances[id]) {
        // Clear sensitive key material
        const instance = GOST28147.instances[szID];
        if (instance.subkeys) {
          for (let i = 0; i < instance.subkeys.length; i++) {
            instance.subkeys[i] = 0;
          }
        }
        delete GOST28147.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'GOST28147', 'ClearData');
        return false;
      }
    },
    
    // F-function: F(R, K) = S(R + K) <<< 11
    F_function: function(right, subkey) {
      // Add subkey modulo 2^32
      const sum = (right + subkey) >>> 0;
      
      // Apply S-boxes (8 x 4-bit substitutions)
      let result = 0;
      for (let i = 0; i < 8; i++) {
        const nibble = (sum >>> (i * 4)) & 0xF;
        const sboxValue = GOST_SBOXES[i][nibble];
        result |= (sboxValue << (i * 4));
      }
      
      // Rotate left by 11 positions
      return global.OpCodes.RotL32(result, 11);
    },
    
    // Encrypt single 64-bit block
    encryptBlock: function(id, szPlainText) {
      if (!GOST28147.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'GOST28147', 'encryptBlock');
        return szPlainText;
      }
      
      if (szPlainText.length !== 8) {
        global.throwException('Invalid Block Size Exception', szPlainText.length, 'GOST28147', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = GOST28147.instances[szID];
      const input = [];
      
      // Convert string to byte array
      for (let i = 0; i < 8; i++) {
        input[i] = szPlainText.charCodeAt(i) & 0xFF;
      }
      
      // Split into 32-bit halves (little-endian)
      let left = global.OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      let right = global.OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      
      // 32 rounds of Feistel network
      // First 24 rounds: forward key order (K0,K1,...,K7, K0,K1,...,K7, K0,K1,...,K7)
      for (let round = 0; round < 24; round++) {
        const keyIndex = round % 8;
        const temp = left;
        left = right;
        right = temp ^ GOST28147.F_function(right, instance.subkeys[keyIndex]);
      }
      
      // Last 8 rounds: reverse key order (K7,K6,...,K0) - don't swap on final round
      for (let round = 24; round < 32; round++) {
        const keyIndex = 7 - (round - 24);
        if (round === 31) {
          // Final round - no swap
          right = left ^ GOST28147.F_function(right, instance.subkeys[keyIndex]);
        } else {
          const temp = left;
          left = right;
          right = temp ^ GOST28147.F_function(right, instance.subkeys[keyIndex]);
        }
      }
      
      // Convert back to string (little-endian)
      const leftBytes = global.OpCodes.Unpack32LE(left);
      const rightBytes = global.OpCodes.Unpack32LE(right);
      
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(leftBytes[i]);
      }
      for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(rightBytes[i]);
      }
      
      return result;
    },
    
    // Decrypt single 64-bit block
    decryptBlock: function(id, szCipherText) {
      if (!GOST28147.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'GOST28147', 'decryptBlock');
        return szCipherText;
      }
      
      if (szCipherText.length !== 8) {
        global.throwException('Invalid Block Size Exception', szCipherText.length, 'GOST28147', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = GOST28147.instances[szID];
      const input = [];
      
      // Convert string to byte array
      for (let i = 0; i < 8; i++) {
        input[i] = szCipherText.charCodeAt(i) & 0xFF;
      }
      
      // Split into 32-bit halves (little-endian)
      let left = global.OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      let right = global.OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      
      // 32 rounds of Feistel network (reverse of encryption for decryption)
      // First 8 rounds: reverse key order (K7,K6,...,K0) 
      for (let round = 0; round < 8; round++) {
        const keyIndex = 7 - round;
        const temp = left;
        left = right;
        right = temp ^ GOST28147.F_function(right, instance.subkeys[keyIndex]);
      }
      
      // Last 24 rounds: reverse key order repeated 3 times (K7→K0, K7→K0, K7→K0) - don't swap on final round
      for (let round = 8; round < 32; round++) {
        const keyIndex = 7 - ((round - 8) % 8);
        if (round === 31) {
          // Final round - no swap  
          right = left ^ GOST28147.F_function(right, instance.subkeys[keyIndex]);
        } else {
          const temp = left;
          left = right;
          right = temp ^ GOST28147.F_function(right, instance.subkeys[keyIndex]);
        }
      }
      
      // Convert back to string (little-endian)
      const leftBytes = global.OpCodes.Unpack32LE(left);
      const rightBytes = global.OpCodes.Unpack32LE(right);
      
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(leftBytes[i]);
      }
      for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(rightBytes[i]);
      }
      
      return result;
    },
    
    // Instance class
    GOSTInstance: function(key) {
      this.subkeys = new Array(8);
      
      // Generate 8 x 32-bit subkeys from 256-bit key
      for (let i = 0; i < 8; i++) {
        const keyBytes = [];
        for (let j = 0; j < 4; j++) {
          keyBytes[j] = szKey.charCodeAt(i * 4 + j) & 0xFF;
        }
        // Pack as little-endian 32-bit word
        this.subkeys[i] = global.OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(GOST28147);
  }
  
  // Export to global scope
  global.GOST28147 = GOST28147;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GOST28147;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);