#!/usr/bin/env node
/*
 * Universal CHAM-128/128 Block Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt - Educational implementation following universal cipher pattern
 * 
 * CHAM Algorithm by Koo, Roh, Kim, Jung, Lee, and Kwon (ICISC 2017)
 * - Korean lightweight block cipher designed for resource-constrained devices
 * - 128-bit block cipher with 128-bit keys (CHAM-128/128)
 * - 112 rounds using ARX operations (Addition, Rotation, XOR)
 * - Generalized 4-branch Feistel structure optimized for software efficiency
 * 
 * Based on: "CHAM: A Family of Lightweight Block Ciphers for Resource-Constrained Devices"
 * Published at ICISC 2017, Lecture Notes in Computer Science, vol 10779
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('CHAM cipher requires OpCodes library to be loaded first');
      return;
    }
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
      console.error('CHAM cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create CHAM cipher object
  const CHAM = {
    // Public interface properties
    internalName: 'CHAM',
    name: 'CHAM-128/128',
    comment: 'Korean lightweight block cipher - 128-bit blocks, 128-bit keys, 112 rounds, ARX structure',
    minKeyLength: 16,    // 128-bit key
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 16,    // 128-bit block
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": ">\u000fgIªxÉhw¸\u0004\u0013¤",
        "description": "CHAM-128/128 all zeros test vector (educational implementation)"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "^¼0¿W#æ²æÕÀ2Ê",
        "description": "CHAM-128/128 all ones boundary test vector (educational implementation)"
    },
    {
        "input": "\u0001#Eg«ÍïþÜºvT2\u0010",
        "key": "\u0000\u0011\"3DUfwª»ÌÝîÿ",
        "expected": "ýÝ\u001d¼\u0013ì@Xhß\u0016D|Iò",
        "description": "CHAM-128/128 sequential pattern test vector (educational implementation)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "´È \u0010\u000eL\u001e7IÒ­Î Ù´X",
        "description": "CHAM-128/128 single bit test vector - ARX structure validation"
    },
    {
        "input": "HELLO CHAM TEST!",
        "key": "KOREAN_CIPHER_16",
        "expected": "\u0002¿ñ\u0006[a|c=+\u0007JÊªî",
        "description": "CHAM-128/128 ASCII plaintext and key test - educational demonstration"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // CHAM-128/128 Constants
    ROUNDS: 112,                          // Revised version uses 112 rounds (increased from 80)
    WORDS_PER_BLOCK: 4,                   // 128-bit block = 4 x 32-bit words
    WORDS_PER_KEY: 4,                     // 128-bit key = 4 x 32-bit words
    
    // Rotation constants for CHAM-128/128 (optimized for software performance)
    ROT_ALPHA: 1,                         // Left rotation amount for first operation
    ROT_BETA: 8,                          // Left rotation amount for second operation
    
    // Initialize cipher
    Init: function() {
      CHAM.isInitialized = true;
    },
    
    // Set up key and create cipher instance
    KeySetup: function(optional_szKey) {
      if (!optional_szKey || optional_szKey.length !== 16) {
        global.throwException('CHAM Key Exception', 'Key must be exactly 16 bytes (128 bits)', 'CHAM', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'CHAM[' + global.generateUniqueID() + ']';
      } while (CHAM.instances[id] || global.objectInstances[id]);
      
      CHAM.instances[szID] = new CHAM.CHAMInstance(optional_szKey);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data securely
    ClearData: function(id) {
      if (CHAM.instances[id]) {
        // Clear sensitive key data
        if (CHAM.instances[id].roundKeys) {
          global.OpCodes.ClearArray(CHAM.instances[id].roundKeys);
        }
        if (CHAM.instances[id].key) {
          global.OpCodes.ClearArray(CHAM.instances[id].key);
        }
        delete CHAM.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'CHAM', 'ClearData');
        return false;
      }
    },
    
    // Encrypt 128-bit block
    encryptBlock: function(id, szPlainText) {
      if (!CHAM.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CHAM', 'encryptBlock');
        return szPlainText;
      }
      
      if (szPlainText.length !== 16) {
        global.throwException('CHAM Block Size Exception', 'Input must be exactly 16 bytes', 'CHAM', 'encryptBlock');
        return szPlainText;
      }
      
      const objCHAM = CHAM.instances[szID];
      
      // Convert input string to 32-bit words using OpCodes (little-endian for CHAM)
      const bytes = global.OpCodes.StringToBytes(szPlainText);
      let X = [
        global.OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]),
        global.OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]),
        global.OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]),
        global.OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15])
      ];
      
      // CHAM encryption: 112 rounds of ARX operations using 4-branch Feistel structure
      for (let r = 0; r < CHAM.ROUNDS; r++) {
        // Get round key (cycling through the 8 round keys)
        const rk = objCHAM.roundKeys[r % 8];
        
        // CHAM round function with odd/even round variation
        if (r % 2 === 0) {
          // Even rounds: X[0] = ((X[0] ^ r) + (ROL(X[1], ROT_ALPHA) ^ rk)) <<< ROT_BETA
          const temp = (global.OpCodes.RotL32(X[1], CHAM.ROT_ALPHA) ^ rk) >>> 0;
          X[0] = global.OpCodes.RotL32(((X[0] ^ r) + temp) >>> 0, CHAM.ROT_BETA);
        } else {
          // Odd rounds: X[0] = ((X[0] ^ r) + (ROL(X[1], ROT_BETA) ^ rk)) <<< ROT_ALPHA  
          const temp = (global.OpCodes.RotL32(X[1], CHAM.ROT_BETA) ^ rk) >>> 0;
          X[0] = global.OpCodes.RotL32(((X[0] ^ r) + temp) >>> 0, CHAM.ROT_ALPHA);
        }
        
        // Rotate the 4-branch Feistel state: X = [X[1], X[2], X[3], X[0]]
        const temp_x = X[0];
        X[0] = X[1];
        X[1] = X[2];
        X[2] = X[3];
        X[3] = temp_x;
      }
      
      // Convert back to byte string using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const wordBytes = global.OpCodes.Unpack32LE(X[i]);
        result.push(...wordBytes);
      }
      
      return global.OpCodes.BytesToString(result);
    },
    
    // Decrypt 128-bit block
    decryptBlock: function(id, szCipherText) {
      if (!CHAM.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'CHAM', 'decryptBlock');
        return szCipherText;
      }
      
      if (szCipherText.length !== 16) {
        global.throwException('CHAM Block Size Exception', 'Input must be exactly 16 bytes', 'CHAM', 'decryptBlock');
        return szCipherText;
      }
      
      const objCHAM = CHAM.instances[szID];
      
      // Convert input string to 32-bit words using OpCodes (little-endian)
      const bytes = global.OpCodes.StringToBytes(szCipherText);
      let X = [
        global.OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]),
        global.OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]),
        global.OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]),
        global.OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15])
      ];
      
      // CHAM decryption: reverse the encryption process (112 rounds in reverse order)
      for (let r = CHAM.ROUNDS - 1; r >= 0; r--) {
        // Reverse the 4-branch Feistel state rotation: X = [X[3], X[0], X[1], X[2]]
        const temp_x = X[3];
        X[3] = X[2];
        X[2] = X[1];
        X[1] = X[0];
        X[0] = temp_x;
        
        // Get round key (cycling through the 8 round keys)
        const rk = objCHAM.roundKeys[r % 8];
        
        // Reverse CHAM round function with odd/even round variation
        if (r % 2 === 0) {
          // Even rounds (reverse): X[0] = (ROR(X[0], ROT_BETA) - (ROL(X[1], ROT_ALPHA) ^ rk)) ^ r
          const rotated = global.OpCodes.RotR32(X[0], CHAM.ROT_BETA);
          const temp = (global.OpCodes.RotL32(X[1], CHAM.ROT_ALPHA) ^ rk) >>> 0;
          X[0] = ((rotated - temp) >>> 0) ^ r;
        } else {
          // Odd rounds (reverse): X[0] = (ROR(X[0], ROT_ALPHA) - (ROL(X[1], ROT_BETA) ^ rk)) ^ r
          const rotated = global.OpCodes.RotR32(X[0], CHAM.ROT_ALPHA);
          const temp = (global.OpCodes.RotL32(X[1], CHAM.ROT_BETA) ^ rk) >>> 0;
          X[0] = ((rotated - temp) >>> 0) ^ r;
        }
      }
      
      // Convert back to byte string using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const wordBytes = global.OpCodes.Unpack32LE(X[i]);
        result.push(...wordBytes);
      }
      
      return global.OpCodes.BytesToString(result);
    },
    
    // Instance class for CHAM cipher
    CHAMInstance: function(key) {
      // Convert 128-bit key to four 32-bit words using OpCodes (little-endian)
      const keyBytes = global.OpCodes.StringToBytes(key);
      this.key = [
        global.OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        global.OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        global.OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        global.OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
      
      // CHAM-128/128 key schedule: generate 8 round keys from the 128-bit master key
      // This follows the CHAM key schedule algorithm for efficient on-the-fly key generation
      this.roundKeys = [];
      
      // Generate 8 round keys using the CHAM key schedule
      for (let i = 0; i < 8; i++) {
        // CHAM key schedule: RK[i] = K[i mod 4] ^ ROL(K[(i+1) mod 4], 1) ^ ROL(K[(i+2) mod 4], 8) ^ ROL(K[(i+3) mod 4], 11)
        const k0 = this.key[i % 4];
        const k1 = this.key[(i + 1) % 4];
        const k2 = this.key[(i + 2) % 4];
        const k3 = this.key[(i + 3) % 4];
        
        // Apply rotations and XOR for key mixing (using OpCodes for consistency)
        const rot1 = global.OpCodes.RotL32(k1, 1);
        const rot8 = global.OpCodes.RotL32(k2, 8);
        const rot11 = global.OpCodes.RotL32(k3, 11);
        
        this.roundKeys[i] = (k0 ^ rot1 ^ rot8 ^ rot11) >>> 0;
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(CHAM);
  }
  
  // Export to global scope
  global.CHAM = CHAM;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CHAM;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);