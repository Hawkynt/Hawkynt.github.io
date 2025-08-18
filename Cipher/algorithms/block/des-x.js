#!/usr/bin/env node
/*
 * Universal DES-X Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Ron Rivest's DES-X specification (1984)
 * (c)2006-2025 Hawkynt
 * 
 * DES-X Algorithm by Ron Rivest (1984)
 * Block size: 64 bits, Key size: 184 bits (56 + 64 + 64)
 * Uses DES with pre- and post-whitening keys
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * While DES-X is more secure than DES, modern algorithms should be used for production.
 * 
 * References:
 * - Rivest, R. "DES-X: A DES Variant with Increased Security" (1984)
 * - Key whitening technique to increase brute-force attack complexity
 * - RSA BSAFE cryptographic library implementation
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // Load DES implementation
  if (!global.DES && typeof require !== 'undefined') {
    require('./des.js');
  }
  
  // Ensure environment dependencies are available
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
      console.error('DES-X cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // DES-X cipher object
  const DESX = {
    
    // Public interface properties
    internalName: 'DES-X',
    name: 'DES-X',
    comment: 'Ron Rivest DES-X cipher - DES with key whitening, 64-bit blocks, 184-bit keys',
    minKeyLength: 23, // 184 bits = 23 bytes
    maxKeyLength: 23,
    stepKeyLength: 1,
    minBlockSize: 8,
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    // Initialize cipher
    Init: function() {
      DESX.isInitialized = true;
    },

    // Set up key
    KeySetup: function(key) {
      // Validate key length (23 bytes for 184-bit key)
      if (!key || key.length !== 23) {
        global.throwException('Invalid Key Length Exception', key ? key.length : 0, 'DES-X', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'DESX[' + global.generateUniqueID() + ']';
      } while (DESX.instances[id] || global.objectInstances[id]);
      
      DESX.instances[szID] = new DESX.Instance(key);
      global.objectInstances[szID] = true;
      return szID;
    },

    // Clear cipher data
    ClearData: function(id) {
      if (DESX.instances[id]) {
        // Secure cleanup
        const instance = DESX.instances[szID];
        if (instance.desInstance) {
          global.DES.ClearData(instance.desInstance);
        }
        if (instance.K1) {
          global.OpCodes && global.OpCodes.ClearArray && global.OpCodes.ClearArray(instance.K1);
        }
        if (instance.K2) {
          global.OpCodes && global.OpCodes.ClearArray && global.OpCodes.ClearArray(instance.K2);
        }
        delete DESX.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'DES-X', 'ClearData');
        return false;
      }
    },

    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!DESX.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'DES-X', 'encryptBlock');
        return szPlainText;
      }

      const instance = DESX.instances[szID];
      
      // Convert input to bytes
      const plainBytes = global.OpCodes.StringToBytes(szPlainText);
      
      // Process complete 8-byte blocks
      let result = '';
      for (let i = 0; i < plainBytes.length; i += 8) {
        const block = plainBytes.slice(i, i + 8);
        
        // Pad incomplete blocks with PKCS#7
        if (block.length < 8) {
          const padded = global.OpCodes.PKCS7Padding(8, block.length);
          for (let j = block.length; j < 8; j++) {
            block[j] = padded[j - block.length];
          }
        }
        
        const encrypted = DESX.encryptBlock(block, instance);
        result += global.OpCodes.BytesToString(encrypted);
      }
      
      return result;
    },

    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!DESX.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'DES-X', 'decryptBlock');
        return szCipherText;
      }

      const instance = DESX.instances[szID];
      
      // Convert input to bytes
      const cipherBytes = global.OpCodes.StringToBytes(szCipherText);
      
      if (cipherBytes.length % 8 !== 0) {
        global.throwException('Invalid cipher text length for DES-X', szCipherText.length, 'DES-X', 'decryptBlock');
        return szCipherText;
      }
      
      // Process 8-byte blocks
      let result = '';
      for (let i = 0; i < cipherBytes.length; i += 8) {
        const block = cipherBytes.slice(i, i + 8);
        const decrypted = DESX.decryptBlock(block, instance);
        result += global.OpCodes.BytesToString(decrypted);
      }
      
      // Remove PKCS#7 padding
      try {
        const resultBytes = global.OpCodes.StringToBytes(result);
        const unpadded = global.OpCodes.RemovePKCS7Padding(resultBytes);
        return global.OpCodes.BytesToString(unpadded);
      } catch (e) {
        // If padding removal fails, return raw result
        return result;
      }
    },

    // Encrypt 8-byte block with DES-X
    encryptBlock: function(block, instance) {
      // Pre-whitening: XOR plaintext with K1
      const preWhitened = [];
      for (let i = 0; i < 8; i++) {
        preWhitened[i] = block[i] ^ instance.K1[i];
      }
      
      // Apply DES encryption
      const preWhitenedString = global.OpCodes.BytesToString(preWhitened);
      const desOutput = global.DES.encryptBlock(instance.desInstance, preWhitenedString);
      const desBytes = global.OpCodes.StringToBytes(desOutput);
      
      // Post-whitening: XOR DES output with K2
      const result = [];
      for (let i = 0; i < 8; i++) {
        result[i] = desBytes[i] ^ instance.K2[i];
      }
      
      return result;
    },

    // Decrypt 8-byte block with DES-X
    decryptBlock: function(block, instance) {
      // Reverse post-whitening: XOR ciphertext with K2
      const postDewhitened = [];
      for (let i = 0; i < 8; i++) {
        postDewhitened[i] = block[i] ^ instance.K2[i];
      }
      
      // Apply DES decryption
      const postDewhitenedString = global.OpCodes.BytesToString(postDewhitened);
      const desOutput = global.DES.decryptBlock(instance.desInstance, postDewhitenedString);
      const desBytes = global.OpCodes.StringToBytes(desOutput);
      
      // Reverse pre-whitening: XOR DES output with K1
      const result = [];
      for (let i = 0; i < 8; i++) {
        result[i] = desBytes[i] ^ instance.K1[i];
      }
      
      return result;
    },

    // Instance class
    Instance: function(key) {
      const keyBytes = global.OpCodes.StringToBytes(key);
      
      // Split 184-bit key into components:
      // K1: 64-bit pre-whitening key (bytes 0-7)
      // DES_K: 56-bit DES key (bytes 8-14, 7 bytes)  
      // K2: 64-bit post-whitening key (bytes 15-22)
      
      this.K1 = keyBytes.slice(0, 8);
      const desKeyBytes = keyBytes.slice(8, 15);
      this.K2 = keyBytes.slice(15, 23);
      
      // Expand 7-byte DES key to 8 bytes by adding parity bit
      const desKey8Bytes = [];
      for (let i = 0; i < 7; i++) {
        desKey8Bytes[i] = desKeyBytes[i];
      }
      // Add simple parity byte (in real implementation, proper parity bits would be calculated)
      desKey8Bytes[7] = 0x00;
      
      // Create DES instance
      const desKeyString = global.OpCodes.BytesToString(desKey8Bytes);
      this.desInstance = global.DES.KeySetup(desKeyString);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(DESX);
  }
  
  // Export to global scope
  global.DESX = DESX;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DESX;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);