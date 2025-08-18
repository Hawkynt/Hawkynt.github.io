/*
 * Universal Speck Block Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on NSA's Speck cipher (2013)
 * (c)2006-2025 Hawkynt
 * 
 * Speck Algorithm by NSA (2013)
 * - ARX cipher (Addition-Rotation-XOR) design
 * - Speck64/128: 64-bit block cipher with 128-bit keys
 * - 27 rounds using simple operations (add, rotate, XOR)
 * - Rotation constants: α=8 (right), β=3 (left)
 * 
 * Security Notice: This is an educational implementation designed for
 * learning cryptographic concepts. Not recommended for production use.
 * 
 * Educational implementation - not for production use
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
      console.error('Speck cipher requires OpCodes library to be loaded first');
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
      console.error('Speck cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Speck cipher object
  const Speck = {
    // Public interface properties
    internalName: 'Speck',
    name: 'Speck Block Cipher',
    comment: 'NSA Speck64/128 cipher - 64-bit blocks, 128-bit keys, 27 rounds (ARX design)',
    minKeyLength: 16,    // 128-bit key
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 8,     // 64-bit block
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Speck64/128 Constants
    ROUNDS: 27,             // NSA standard: 27 rounds for 64/128 variant
    ALPHA: 8,               // Right rotation constant
    BETA: 3,                // Left rotation constant
    
    // Initialize cipher
    Init: function() {
      Speck.isInitialized = true;
    },
    
    // Set up key and generate round keys
    KeySetup: function(optional_szKey) {
      if (!optional_szKey || optional_szKey.length !== 16) {
        global.throwException('Speck Key Exception', 'Key must be exactly 16 bytes (128 bits)', 'Speck', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Speck[' + global.generateUniqueID() + ']';
      } while (Speck.instances[id] || global.objectInstances[id]);
      
      Speck.instances[szID] = new Speck.SpeckInstance(optional_szKey);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Speck.instances[id]) {
        // Clear sensitive key data
        if (Speck.instances[id].roundKeys) {
          global.OpCodes.ClearArray(Speck.instances[id].roundKeys);
        }
        delete Speck.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Speck', 'ClearData');
        return false;
      }
    },
    
    // Encrypt 64-bit block
    encryptBlock: function(id, szPlainText) {
      if (!Speck.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Speck', 'encryptBlock');
        return szPlainText;
      }
      
      if (szPlainText.length !== 8) {
        global.throwException('Speck Block Size Exception', 'Input must be exactly 8 bytes', 'Speck', 'encryptBlock');
        return szPlainText;
      }
      
      const objSpeck = Speck.instances[szID];
      
      // Convert input string to 32-bit words using OpCodes (little-endian for Speck)
      const bytes = global.OpCodes.StringToBytes(szPlainText);
      let x = global.OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let y = global.OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      // Speck encryption: 27 rounds of ARX operations
      // Round function based on NSA specification:
      // x = (ROR(x, 8) + y) ^ roundKey
      // y = ROL(y, 3) ^ x
      for (let i = 0; i < Speck.ROUNDS; i++) {
        // Right rotate x by 8 bits, add y, then XOR with round key
        x = global.OpCodes.RotR32(x, Speck.ALPHA);
        x = (x + y) >>> 0;
        x ^= objSpeck.roundKeys[i];
        
        // Left rotate y by 3 bits, then XOR with new x
        y = global.OpCodes.RotL32(y, Speck.BETA);
        y ^= x;
      }
      
      // Convert back to byte string using OpCodes (little-endian)
      const result0 = global.OpCodes.Unpack32LE(x);
      const result1 = global.OpCodes.Unpack32LE(y);
      return global.OpCodes.BytesToString([...result0, ...result1]);
    },
    
    // Decrypt 64-bit block
    decryptBlock: function(id, szCipherText) {
      if (!Speck.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Speck', 'decryptBlock');
        return szCipherText;
      }
      
      if (szCipherText.length !== 8) {
        global.throwException('Speck Block Size Exception', 'Input must be exactly 8 bytes', 'Speck', 'decryptBlock');
        return szCipherText;
      }
      
      const objSpeck = Speck.instances[szID];
      
      // Convert input string to 32-bit words using OpCodes (little-endian for Speck)
      const bytes = global.OpCodes.StringToBytes(szCipherText);
      let x = global.OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let y = global.OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      // Speck decryption: reverse the encryption process
      // Inverse operations in reverse order:
      // y = ROR(y ^ x, 3)
      // x = ROL((x ^ roundKey) - y, 8)
      for (let i = Speck.ROUNDS - 1; i >= 0; i--) {
        // Reverse: y = ROL(y, 3) ^ x
        y ^= x;
        y = global.OpCodes.RotR32(y, Speck.BETA);
        
        // Reverse: x = (ROR(x, 8) + y) ^ roundKey
        x ^= objSpeck.roundKeys[i];
        x = (x - y) >>> 0;
        x = global.OpCodes.RotL32(x, Speck.ALPHA);
      }
      
      // Convert back to byte string using OpCodes (little-endian)
      const result0 = global.OpCodes.Unpack32LE(x);
      const result1 = global.OpCodes.Unpack32LE(y);
      return global.OpCodes.BytesToString([...result0, ...result1]);
    },
    
    // Instance class with key expansion
    SpeckInstance: function(key) {
      // Convert 128-bit key to four 32-bit words using OpCodes (little-endian)
      const keyBytes = global.OpCodes.StringToBytes(key);
      const k = [
        global.OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        global.OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        global.OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        global.OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
      
      // Expand key to 27 round keys using Speck key schedule
      this.roundKeys = new Array(Speck.ROUNDS);
      
      // Initialize first round key and working variables
      this.roundKeys[0] = k[0];  // First round key is k[0]
      let l = [k[1], k[2], k[3]];  // Key schedule working array
      
      // Generate remaining round keys using Speck key schedule
      // Key schedule uses same ARX structure as round function
      for (let i = 0; i < Speck.ROUNDS - 1; i++) {
        // Apply round function to l[i % 3] and roundKeys[i]
        // l[i % 3] = ROR(l[i % 3], 8), l[i % 3] += roundKeys[i], l[i % 3] ^= i
        const idx = i % 3;
        l[idx] = global.OpCodes.RotR32(l[idx], Speck.ALPHA);
        l[idx] = (l[idx] + this.roundKeys[i]) >>> 0;
        l[idx] ^= i;
        
        // Generate next round key: roundKeys[i+1] = ROL(roundKeys[i], 3) ^ l[i % 3]
        this.roundKeys[i + 1] = global.OpCodes.RotL32(this.roundKeys[i], Speck.BETA) ^ l[idx];
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Speck);
  }
  
  // Export to global scope
  global.Speck = Speck;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Speck;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);