#!/usr/bin/env node
/*
 * Universal RC2 Cipher
 * Compatible with both Browser and Node.js environments
 * Based on RFC 2268 - A Description of the RC2(r) Encryption Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * RC2 Algorithm by Ron Rivest (RSA Data Security)
 * Block size: 64 bits (8 bytes), Key size: 8-128 bytes
 * Uses 16 rounds with mixing and mashing operations
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - RFC 2268: A Description of the RC2(r) Encryption Algorithm
 * - RSA Data Security reference implementation
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
      console.error('RC2 cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // RC2 cipher object
  const RC2 = {
    
    // Public interface properties
    internalName: 'RC2',
    name: 'RC2',
    comment: 'Ron Rivest\'s RC2 cipher - 64-bit blocks, variable key length 8-128 bytes',
    minKeyLength: 1,    // 8 bits minimum (RFC allows 1-128 bytes)
    maxKeyLength: 128,  // 1024 bits maximum  
    stepKeyLength: 1,   // Any byte length between min/max
    minBlockSize: 8,    // 64 bits
    maxBlockSize: 8,    // 64 bits
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "Ï¡Gês½y",
        "description": "RC2 test vector: 8-byte all-zero key with default effective length"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿ",
        "expected": "rY\u0001ÅW³W",
        "description": "RC2 test vector: 8-byte all-ones key with all-ones plaintext"
    },
    {
        "input": "\u0010\u0000\u0000\u0000\u0000\u0000\u0000\u0001",
        "key": "0\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "Üïc\u0010®ä{A",
        "description": "RC2 test vector: pattern key with pattern plaintext"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "",
        "expected": "ölmÄ*º",
        "description": "RC2 test vector: 1-byte key, default effective length"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // RC2 PITABLE - 256-byte permutation table from RFC 2268
    PITABLE: [
      217,120,249,196, 25,221,181,237, 40,233,253,121, 74,160,216,157,
      198,126, 55,131, 43,118, 83,142, 98, 76,100,136, 68,139,251,162,
       23,154, 89,245,135,179, 79, 19, 97, 69,109,141,  9,129,125, 50,
      189,143, 64,235,134,183,123, 11,240,149, 33, 34, 92,107, 78,130,
       84,214,101,147,206, 96,178, 28,115, 86,192, 20,167,140,241,220,
       18,117,202, 31, 59,190,228,209, 66, 61,212, 48,163, 60,182, 38,
      111,191, 14,218, 70,105,  7, 87, 39,242, 29,155,188,148, 67,  3,
      248, 17,199,246,144,239, 62,231,  6,195,213, 47,200,102, 30,215,
        8,232,234,222,128, 82,238,247,132,170,114,172, 53, 77,106, 42,
      150, 26,210,113, 90, 21, 73,116, 75,159,208, 94,  4, 24,164,236,
      194,224, 65,110, 15, 81,203,204, 36,145,175, 80,161,244,112, 57,
      153,124, 58,133, 35,184,180,122,252,  2, 54, 91, 37, 85,151, 49,
       45, 93,250,152,227,138,146,174,  5,223, 41, 16,103,108,186,201,
      211,  0,230,207,225,158,168, 44, 99, 22,  1, 63, 88,226,137,169,
       13, 56, 52, 27,171, 51,255,176,187, 72, 12, 95,185,177,205, 46,
      197,243,219, 71,229,165,156,119, 10,166, 32,104,254,127,193,173
    ],
    
    // Initialize cipher
    Init: function() {
      RC2.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_szKey, effectiveBits = 1024) {
      let id;
      do {
        id = 'RC2[' + global.generateUniqueID() + ']';
      } while (RC2.instances[id] || global.objectInstances[id]);
      
      RC2.instances[szID] = new RC2.RC2Instance(optional_szKey, effectiveBits);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (RC2.instances[id]) {
        // Clear sensitive data
        const instance = RC2.instances[szID];
        if (instance.expandedKey) global.OpCodes.ClearArray(instance.expandedKey);
        
        delete RC2.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC2', 'ClearData');
        return false;
      }
    },
    
    // Encrypt a block
    encryptBlock: function(id, szInput) {
      if (RC2.instances[id]) {
        return RC2.instances[szID].encryptBlock(szInput);
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC2', 'encryptBlock');
        return '';
      }
    },
    
    // Decrypt a block
    decryptBlock: function(id, szInput) {
      if (RC2.instances[id]) {
        return RC2.instances[szID].decryptBlock(szInput);
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC2', 'decryptBlock');
        return '';
      }
    },
    
    // RC2 Instance class
    RC2Instance: function(key, effectiveBits = 1024) {
      this.expandedKey = new Array(64);  // 64 16-bit words
      
      // Helper function to pack two bytes into 16-bit word (little-endian)
      this.pack16LE = function(b0, b1) {
        return ((b1 & 0xFF) << 8) | (b0 & 0xFF);
      };
      
      // Helper function to unpack 16-bit word to two bytes (little-endian)
      this.unpack16LE = function(word) {
        return [(word & 0xFF), ((word >>> 8) & 0xFF)];
      };
      
      // 16-bit rotation functions
      this.rotL16 = function(value, positions) {
        value &= 0xFFFF;
        positions &= 15;
        return ((value << positions) | (value >>> (16 - positions))) & 0xFFFF;
      };
      
      this.rotR16 = function(value, positions) {
        value &= 0xFFFF;
        positions &= 15;
        return ((value >>> positions) | (value << (16 - positions))) & 0xFFFF;
      };
      
      // RC2 key expansion algorithm (RFC 2268 compliant)
      this.setupKey = function(key, effectiveBits = 1024) {
        const keyBytes = global.OpCodes.StringToBytes(key);
        const keyLength = keyBytes.length;
        
        // RFC 2268: if effectiveBits is zero, use 1024
        if (effectiveBits === 0) {
          effectiveBits = 1024;
        }
        
        // Step 1: Initialize L with key bytes (copy directly to byte array)
        const L = new Array(128);
        for (let i = 0; i < keyLength; i++) {
          L[i] = keyBytes[i];
        }
        
        // Step 2: Expand to 128 bytes using PITABLE (RFC 2268 algorithm)
        // Follow C code logic exactly: i++ increments without wrapping, accesses expanding array
        if (keyLength < 128) {
          let i = 0;
          let x = L[keyLength - 1];
          let len = keyLength;
          
          while (len < 128) {
            x = RC2.PITABLE[(x + L[i]) & 0xFF];
            L[len] = x;
            i++;
            len++;
          }
        }
        
        // Step 3: Apply effective key length reduction (RFC 2268 Phase 2)
        const len = Math.floor((effectiveBits + 7) / 8);  // effective key length in bytes
        const i = 128 - len;
        let x = RC2.PITABLE[L[i] & (0xFF >>> (7 & -effectiveBits))];
        L[i] = x;
        
        for (let j = i - 1; j >= 0; j--) {
          x = RC2.PITABLE[x ^ L[j + len]];
          L[j] = x;
        }
        
        // Step 4: Convert to 16-bit words (little-endian) - RFC 2268 Phase 3
        for (let i = 0; i < 64; i++) {
          this.expandedKey[i] = this.pack16LE(L[2 * i], L[2 * i + 1]);
        }
      };
      
      // RC2 encryption
      this.encryptBlock = function(plaintext) {
        if (plaintext.length !== 8) {
          global.throwException('Invalid Block Size Exception', plaintext.length, 'RC2', 'encryptBlock');
          return '';
        }
        
        const plainBytes = global.OpCodes.StringToBytes(plaintext);
        
        // Pack into 16-bit words (little-endian)
        let R0 = this.pack16LE(plainBytes[0], plainBytes[1]);
        let R1 = this.pack16LE(plainBytes[2], plainBytes[3]);
        let R2 = this.pack16LE(plainBytes[4], plainBytes[5]);
        let R3 = this.pack16LE(plainBytes[6], plainBytes[7]);
        
        // 16 rounds of encryption
        for (let i = 0; i < 16; i++) {
          const j = i * 4;
          
          // Mix operation
          R0 = (R0 + (R1 & (~R3)) + (R2 & R3) + this.expandedKey[j]) & 0xFFFF;
          R0 = this.rotL16(R0, 1);
          
          R1 = (R1 + (R2 & (~R0)) + (R3 & R0) + this.expandedKey[j + 1]) & 0xFFFF;
          R1 = this.rotL16(R1, 2);
          
          R2 = (R2 + (R3 & (~R1)) + (R0 & R1) + this.expandedKey[j + 2]) & 0xFFFF;
          R2 = this.rotL16(R2, 3);
          
          R3 = (R3 + (R0 & (~R2)) + (R1 & R2) + this.expandedKey[j + 3]) & 0xFFFF;
          R3 = this.rotL16(R3, 5);
          
          // Mash operation after rounds 5 and 11 (i = 4 and 10)
          if (i === 4 || i === 10) {
            R0 = (R0 + this.expandedKey[R3 & 63]) & 0xFFFF;
            R1 = (R1 + this.expandedKey[R0 & 63]) & 0xFFFF;
            R2 = (R2 + this.expandedKey[R1 & 63]) & 0xFFFF;
            R3 = (R3 + this.expandedKey[R2 & 63]) & 0xFFFF;
          }
        }
        
        // Unpack to bytes (little-endian) and convert to string
        const cipherBytes = [
          ...this.unpack16LE(R0),
          ...this.unpack16LE(R1),
          ...this.unpack16LE(R2),
          ...this.unpack16LE(R3)
        ];
        
        return global.OpCodes.BytesToString(cipherBytes);
      };
      
      // RC2 decryption
      this.decryptBlock = function(ciphertext) {
        if (ciphertext.length !== 8) {
          global.throwException('Invalid Block Size Exception', ciphertext.length, 'RC2', 'decryptBlock');
          return '';
        }
        
        const cipherBytes = global.OpCodes.StringToBytes(ciphertext);
        
        // Pack into 16-bit words (little-endian)
        let R0 = this.pack16LE(cipherBytes[0], cipherBytes[1]);
        let R1 = this.pack16LE(cipherBytes[2], cipherBytes[3]);
        let R2 = this.pack16LE(cipherBytes[4], cipherBytes[5]);
        let R3 = this.pack16LE(cipherBytes[6], cipherBytes[7]);
        
        // 16 rounds of decryption (reverse order)
        for (let i = 15; i >= 0; i--) {
          const j = i * 4;
          
          // Reverse mash operation after rounds 5 and 11 (i = 4 and 10)
          if (i === 4 || i === 10) {
            R3 = (R3 - this.expandedKey[R2 & 63]) & 0xFFFF;
            R2 = (R2 - this.expandedKey[R1 & 63]) & 0xFFFF;
            R1 = (R1 - this.expandedKey[R0 & 63]) & 0xFFFF;
            R0 = (R0 - this.expandedKey[R3 & 63]) & 0xFFFF;
          }
          
          // Reverse mix operation
          R3 = this.rotR16(R3, 5);
          R3 = (R3 - (R0 & (~R2)) - (R1 & R2) - this.expandedKey[j + 3]) & 0xFFFF;
          
          R2 = this.rotR16(R2, 3);
          R2 = (R2 - (R3 & (~R1)) - (R0 & R1) - this.expandedKey[j + 2]) & 0xFFFF;
          
          R1 = this.rotR16(R1, 2);
          R1 = (R1 - (R2 & (~R0)) - (R3 & R0) - this.expandedKey[j + 1]) & 0xFFFF;
          
          R0 = this.rotR16(R0, 1);
          R0 = (R0 - (R1 & (~R3)) - (R2 & R3) - this.expandedKey[j]) & 0xFFFF;
        }
        
        // Unpack to bytes (little-endian) and convert to string
        const plainBytes = [
          ...this.unpack16LE(R0),
          ...this.unpack16LE(R1),
          ...this.unpack16LE(R2),
          ...this.unpack16LE(R3)
        ];
        
        return global.OpCodes.BytesToString(plainBytes);
      };
      
      // Setup key if provided
      if (key) {
        this.setupKey(key, effectiveBits);
      }
    }
  };
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(RC2);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RC2;
  }
  
  // Add to global scope
  global.RC2 = RC2;
  
})(typeof global !== 'undefined' ? global : window);