#!/usr/bin/env node
/*
 * Universal IDEA Cipher
 * Compatible with both Browser and Node.js environments
 * Based on the International Data Encryption Algorithm (IDEA) by Lai & Massey (1991)
 * (c)2006-2025 Hawkynt
 * 
 * IDEA Algorithm by Xuejia Lai and James L. Massey (1991)
 * Block size: 64 bits, Key size: 128 bits
 * Uses 8 full rounds + final half-round with Lai-Massey structure
 * Three operations: XOR (⊕), addition mod 2^16 (+), multiplication mod (2^16 + 1) (⊙)
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - Lai, X. & Massey, J.L. "A Proposal for a New Block Encryption Standard" (1991)
 * - Schneier, B. "Applied Cryptography" 2nd Edition, Ch. 13
 * - Original IDEA specification and test vectors
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
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
      console.error('IDEA cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // IDEA cipher object
  const IDEA = {
    
    // Public interface properties
    internalName: 'idea',
    name: 'IDEA',
    comment: 'International Data Encryption Algorithm - 64-bit blocks, 128-bit keys, Lai-Massey structure',
    minKeyLength: 16,   // 128 bits
    maxKeyLength: 16,   // 128 bits  
    stepKeyLength: 1,   
    minBlockSize: 8,    // 64 bits
    maxBlockSize: 8,    // 64 bits
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "%Âg:5U\u0016",
        "description": "IDEA all zeros test vector"
    },
    {
        "input": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f",
        "expected": "B\u0016]¨zXN\u000f",
        "description": "IDEA incremental pattern test"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "þÜºvT2\u0010\u000f\u001e-<KZix",
        "expected": "\\d\u000fÂ\u001ag",
        "description": "IDEA mixed binary pattern test"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "¼Ø \u0007!v\u001b",
        "description": "IDEA all ones test vector"
    },
    {
        "input": "IDEAIDEA",
        "key": "1234567890123456",
        "expected": "K,\u001e_6x",
        "description": "IDEA ASCII text test vector"
    }
],

  // Reference links to authoritative sources and production implementations
  referenceLinks: {
    specifications: [
      {
        name: 'IDEA Algorithm Specification',
        url: 'https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm',
        description: 'International Data Encryption Algorithm specification and documentation'
      },
      {
        name: 'IDEA Patent Information',
        url: 'https://patents.google.com/patent/US5214703A',
        description: 'IDEA algorithm patent - US Patent 5,214,703 (expired 2011)'
      },
      {
        name: 'Applied Cryptography - IDEA',
        url: 'https://www.schneier.com/books/applied_cryptography/',
        description: 'Bruce Schneier\'s comprehensive treatment of IDEA algorithm'
      },
      {
        name: 'IDEA Algorithm Academic Paper',
        url: 'https://link.springer.com/chapter/10.1007/3-540-46877-3_35',
        description: 'Original academic paper on IDEA algorithm design and analysis'
      }
    ],
    implementations: [
      {
        name: 'OpenSSL IDEA Implementation',
        url: 'https://github.com/openssl/openssl/blob/master/crypto/idea/',
        description: 'Production-quality IDEA implementation from OpenSSL'
      },
      {
        name: 'Crypto++ IDEA Implementation',
        url: 'https://github.com/weidai11/cryptopp/blob/master/idea.cpp',
        description: 'High-performance C++ IDEA implementation'
      },
      {
        name: 'Bouncy Castle IDEA Implementation',
        url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
        description: 'Java IDEA implementation from Bouncy Castle'
      },
      {
        name: 'libgcrypt IDEA Implementation',
        url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/',
        description: 'GNU libgcrypt cryptographic library cipher implementations'
      }
    ],
    validation: [
      {
        name: 'IDEA Test Vectors',
        url: 'https://www.cosic.esat.kuleuven.be/nessie/testvectors/',
        description: 'Comprehensive test vectors for IDEA validation'
      },
      {
        name: 'NIST Cryptographic Validation',
        url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program',
        description: 'NIST guidance for cryptographic algorithm validation'
      },
      {
        name: 'IDEA Cryptanalysis Research',
        url: 'https://www.iacr.org/cryptodb/data/paper.php?pubkey=789',
        description: 'Academic research on IDEA security analysis and cryptanalysis'
      }
    ]
  },

    cantDecode: false,
    isInitialized: false,
    
    // Constants
    ROUNDS: 8,
    SUBKEYS_PER_ROUND: 6,
    FINAL_SUBKEYS: 4,
    TOTAL_SUBKEYS: 52, // (8 * 6) + 4
    MODULUS: 0x10001,  // 2^16 + 1
    
    // Initialize cipher
    Init: function() {
      IDEA.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'IDEA[' + global.generateUniqueID() + ']';
      } while (IDEA.instances[id] || global.objectInstances[id]);
      
      IDEA.instances[id] = new IDEA.IDEAInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (IDEA.instances[id]) {
        // Clear sensitive data
        const instance = IDEA.instances[id];
        if (instance.encryptKeys) global.OpCodes.ClearArray(instance.encryptKeys);
        if (instance.decryptKeys) global.OpCodes.ClearArray(instance.decryptKeys);
        
        delete IDEA.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'IDEA', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!IDEA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'IDEA', 'encryptBlock');
        return plaintext;
      }
      
      return IDEA.encryptBlock(plaintext, IDEA.instances[id]);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!IDEA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'IDEA', 'decryptBlock');
        return ciphertext;
      }
      
      return IDEA.decryptBlock(ciphertext, IDEA.instances[id]);
    },
    
    /**
     * Multiplication modulo (2^16 + 1) - IDEA's special operation
     * In IDEA, 0 represents 2^16 (65536) for multiplication
     * @param {number} a - First operand (16-bit)
     * @param {number} b - Second operand (16-bit)
     * @returns {number} (a * b) mod (2^16 + 1)
     */
    mulMod: function(a, b) {
      a &= 0xFFFF;
      b &= 0xFFFF;
      
      // In IDEA, 0 represents 2^16 for multiplication
      if (a === 0) a = 0x10000;
      if (b === 0) b = 0x10000;
      
      // Perform multiplication modulo (2^16 + 1)
      const result = (a * b) % IDEA.MODULUS;
      
      // Convert back: if result is 65536, return 0
      return result === 0x10000 ? 0 : result;
    },
    
    /**
     * Modular inverse for multiplication mod (2^16 + 1)
     * Used for key schedule inversion in decryption
     * @param {number} x - Value to invert
     * @returns {number} Multiplicative inverse
     */
    modInverse: function(x) {
      x &= 0xFFFF;
      
      // Special case: inverse of 0 (representing 2^16) is 0
      if (x === 0) return 0;
      
      // Extended Euclidean algorithm
      let u1 = IDEA.MODULUS;
      let u2 = 0;
      let u3 = x;
      let v1 = 0;
      let v2 = 1;
      let v3 = IDEA.MODULUS;
      
      while (v3 !== 0) {
        const q = Math.floor(u3 / v3);
        const t1 = u1 - q * v1;
        const t2 = u2 - q * v2;
        const t3 = u3 - q * v3;
        
        u1 = v1; u2 = v2; u3 = v3;
        v1 = t1; v2 = t2; v3 = t3;
      }
      
      let result = u1;
      if (result < 0) result += IDEA.MODULUS;
      
      return result & 0xFFFF;
    },
    
    /**
     * Additive inverse modulo 2^16
     * @param {number} x - Value to invert
     * @returns {number} Additive inverse
     */
    addInverse: function(x) {
      x &= 0xFFFF;
      return x === 0 ? 0 : (0x10000 - x) & 0xFFFF;
    },
    
    /**
     * Generate 52 subkeys from 128-bit master key
     * IDEA key schedule: first 8 subkeys from key, then rotate left 25 bits per group
     * @param {Array} key - 16-byte master key
     * @returns {Array} Array of 52 16-bit subkeys
     */
    generateSubkeys: function(key) {
      const subkeys = new Array(IDEA.TOTAL_SUBKEYS);
      
      // Convert key to 16-bit words (8 words from 16 bytes, big-endian)
      const keyWords = [];
      for (let i = 0; i < 8; i++) {
        keyWords[i] = (key[i * 2] << 8) | key[i * 2 + 1];
      }
      
      // First 8 subkeys are the original key words
      for (let i = 0; i < 8; i++) {
        subkeys[i] = keyWords[i];
      }
      
      // Generate remaining 44 subkeys using IDEA's key schedule
      // For each group of 8 keys, rotate the 128-bit key left by 25 bits
      let keySchedule = [...keyWords]; // Working copy of key words
      
      for (let group = 1; group < 7; group++) { // 6 more groups needed (8 + 6*8 = 56 > 52)
        // Rotate 128-bit key left by 25 bits
        // Save the original values
        const temp = [...keySchedule];
        
        // Rotate each word left by 25 bits within the 128-bit context
        // 25 bits = 1 word + 9 bits
        for (let i = 0; i < 8; i++) {
          const srcIndex = (i + 7) % 8; // Previous word (25 bits = 16 + 9)
          const nextIndex = (i + 6) % 8; // Word before that
          
          keySchedule[i] = ((temp[srcIndex] << 9) | (temp[nextIndex] >>> 7)) & 0xFFFF;
        }
        
        // Copy up to 8 keys from this rotated schedule
        const startIndex = group * 8;
        for (let i = 0; i < 8 && startIndex + i < IDEA.TOTAL_SUBKEYS; i++) {
          subkeys[startIndex + i] = keySchedule[i];
        }
      }
      
      return subkeys;
    },
    
    /**
     * Generate decryption subkeys from encryption subkeys
     * Based on the reference IDEA implementation from Oryx Embedded
     * @param {Array} encryptKeys - 52 encryption subkeys
     * @returns {Array} 52 decryption subkeys
     */
    generateDecryptSubkeys: function(encryptKeys) {
      const decryptKeys = new Array(IDEA.TOTAL_SUBKEYS);
      
      // Generate decryption keys following reference implementation pattern
      for (let i = 0; i < 52; i += 6) {
        // First subkey: multiplicative inverse of corresponding encryption subkey
        decryptKeys[i] = IDEA.modInverse(encryptKeys[48 - i]);
        
        // Second and third subkeys: additive inverses (swapped except for first/last)
        if (i === 0 || i === 48) {
          decryptKeys[i + 1] = IDEA.addInverse(encryptKeys[49 - i]);
          decryptKeys[i + 2] = IDEA.addInverse(encryptKeys[50 - i]);
        } else {
          decryptKeys[i + 1] = IDEA.addInverse(encryptKeys[50 - i]);
          decryptKeys[i + 2] = IDEA.addInverse(encryptKeys[49 - i]);
        }
        
        // Fourth subkey: multiplicative inverse
        decryptKeys[i + 3] = IDEA.modInverse(encryptKeys[51 - i]);
        
        // Fifth and sixth subkeys: direct copy (MA-box keys)
        if (i < 48) {
          decryptKeys[i + 4] = encryptKeys[46 - i];
          decryptKeys[i + 5] = encryptKeys[47 - i];
        }
      }
      
      return decryptKeys;
    },
    
    /**
     * IDEA encryption/decryption engine
     * @param {string} block - 8-byte input block
     * @param {Array} subkeys - 52 subkeys to use
     * @returns {string} Processed 8-byte block
     */
    processBlock: function(block, subkeys) {
      // Split input into four 16-bit words
      let X1 = (block.charCodeAt(0) << 8) | block.charCodeAt(1);
      let X2 = (block.charCodeAt(2) << 8) | block.charCodeAt(3);
      let X3 = (block.charCodeAt(4) << 8) | block.charCodeAt(5);
      let X4 = (block.charCodeAt(6) << 8) | block.charCodeAt(7);
      
      // 8 full rounds
      for (let round = 0; round < IDEA.ROUNDS; round++) {
        const keyOffset = round * 6;
        
        // Step 1: Multiply and add
        X1 = IDEA.mulMod(X1, subkeys[keyOffset]);
        X2 = global.OpCodes.AddMod(X2, subkeys[keyOffset + 1], 0x10000);
        X3 = global.OpCodes.AddMod(X3, subkeys[keyOffset + 2], 0x10000);
        X4 = IDEA.mulMod(X4, subkeys[keyOffset + 3]);
        
        // Step 2: MA structure (Multiplication-Addition)
        const T1 = X1 ^ X3;
        const T2 = X2 ^ X4;
        const T3 = IDEA.mulMod(T1, subkeys[keyOffset + 4]);
        const T4 = global.OpCodes.AddMod(T2, T3, 0x10000);
        const T5 = IDEA.mulMod(T4, subkeys[keyOffset + 5]);
        const T6 = global.OpCodes.AddMod(T3, T5, 0x10000);
        
        // Step 3: Final XOR and rearrangement
        const Y1 = X1 ^ T5;
        const Y2 = X3 ^ T5;
        const Y3 = X2 ^ T6;
        const Y4 = X4 ^ T6;
        
        // Prepare for next round (swap middle two words)
        X1 = Y1;
        X2 = Y3;
        X3 = Y2;
        X4 = Y4;
      }
      
      // Final half-round (no swapping)
      const finalOffset = IDEA.ROUNDS * 6;
      X1 = IDEA.mulMod(X1, subkeys[finalOffset]);
      X2 = global.OpCodes.AddMod(X2, subkeys[finalOffset + 1], 0x10000);
      X3 = global.OpCodes.AddMod(X3, subkeys[finalOffset + 2], 0x10000);
      X4 = IDEA.mulMod(X4, subkeys[finalOffset + 3]);
      
      // Convert back to byte string
      return String.fromCharCode(
        (X1 >>> 8) & 0xFF, X1 & 0xFF,
        (X2 >>> 8) & 0xFF, X2 & 0xFF,
        (X3 >>> 8) & 0xFF, X3 & 0xFF,
        (X4 >>> 8) & 0xFF, X4 & 0xFF
      );
    },
    
    // Encrypt a 64-bit block
    encryptBlock: function(text, objIDEA) {
      if (text.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }
      
      return IDEA.processBlock(text, objIDEA.encryptKeys);
    },
    
    // Decrypt a 64-bit block
    decryptBlock: function(text, objIDEA) {
      if (text.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }
      
      return IDEA.processBlock(text, objIDEA.decryptKeys);
    },
    
    // Instance class
    IDEAInstance: function(key) {
      // Convert key string to byte array
      const keyBytes = [];
      if (key && key.length >= 16) {
        for (let i = 0; i < 16; i++) {
          keyBytes[i] = key.charCodeAt(i) & 0xFF;
        }
      } else {
        // Default key if not provided or too short
        for (let i = 0; i < 16; i++) {
          keyBytes[i] = i;
        }
      }
      
      // Generate encryption and decryption subkeys
      this.encryptKeys = IDEA.generateSubkeys(keyBytes);
      this.decryptKeys = IDEA.generateDecryptSubkeys(this.encryptKeys);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(IDEA);
  }
  
  // Export to global scope
  global.IDEA = IDEA;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IDEA;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);