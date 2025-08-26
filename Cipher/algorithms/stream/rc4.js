#!/usr/bin/env node
/*
 * Universal RC4 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on RC4 specification by Ron Rivest (1987)
 * (c)2006-2025 Hawkynt
 * 
 * RC4 is a variable-key-size stream cipher using:
 * - Key Scheduling Algorithm (KSA) for S-box initialization
 * - Pseudo-Random Generation Algorithm (PRGA) for keystream generation
 * - 256-byte internal state (S-box)
 * - Two index pointers (i, j)
 * 
 * WARNING: RC4 is cryptographically broken and deprecated (RFC 7465).
 * Known vulnerabilities include keystream biases and related-key attacks.
 * This implementation is for educational purposes only.
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  }
  
  // Create RC4 cipher object
  const RC4 = {
    // Public interface properties
    internalName: 'RC4',
    name: 'RC4 Stream Cipher',
    comment: 'RC4 Stream Cipher - DEPRECATED: Cryptographically broken (RFC 7465)',
    minKeyLength: 1,      // RC4 supports 1-256 byte keys
    maxKeyLength: 256,
    stepKeyLength: 1,
    minBlockSize: 1,      // Stream cipher - processes byte by byte
    maxBlockSize: 65536,  // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Required metadata following CONTRIBUTING.md
    description: "Variable-key-size stream cipher using secret internal state of 256 bytes with two index pointers. Widely used but now deprecated due to numerous vulnerabilities including keystream biases and related-key attacks.",
    inventor: "Ron Rivest",
    year: 1987,
    country: "US",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: "insecure",
    securityNotes: "Officially deprecated by RFC 7465 due to statistical biases, related-key attacks, and WEP vulnerabilities. Never use for secure applications.",
    
    documentation: [
      {text: "RFC 6229: Test Vectors for the Stream Cipher RC4", uri: "https://tools.ietf.org/html/rfc6229"},
      {text: "RFC 7465: Prohibiting RC4 Cipher Suites", uri: "https://tools.ietf.org/html/rfc7465"},
      {text: "Wikipedia: RC4", uri: "https://en.wikipedia.org/wiki/RC4"}
    ],
    
    references: [
      {text: "Applied Cryptography - RC4 Analysis", uri: "https://www.schneier.com/academic/paperfiles/paper-rc4.pdf"},
      {text: "Fluhrer-Mantin-Shamir Attack on WEP", uri: "https://www.drizzle.com/~aboba/IEEE/rc4_ksaproc.pdf"},
      {text: "RC4 Biases and Practical Attacks", uri: "https://www.imperva.com/blog/rc4-attacks-what-you-need-to-know/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Statistical Biases", 
        text: "RC4 keystream contains detectable statistical biases exploitable in various attack scenarios",
        mitigation: "Use approved stream ciphers like ChaCha20 or AES-GCM"
      },
      {
        type: "Related-Key Attacks",
        text: "Vulnerable to attacks when keys share common prefixes or patterns (WEP vulnerability)",
        mitigation: "Algorithm fundamentally broken - avoid all use"
      },
      {
        type: "Broadcast Attacks",
        text: "Statistical analysis of multiple ciphertexts can recover plaintext patterns",
        mitigation: "RC4 deprecated by RFC 7465 - use modern alternatives"
      }
    ],
    
    tests: [
      {
        text: "RFC 6229 Test Vector (40-bit key)",
        uri: "https://tools.ietf.org/html/rfc6229#section-2",
        keySize: 5,
        input: global.OpCodes.Hex8ToBytes("0000000000000000"),
        key: global.OpCodes.Hex8ToBytes("0102030405"),
        expected: global.OpCodes.Hex8ToBytes("b2396305f03dc027")
      },
      {
        text: "RFC 6229 Test Vector (128-bit key)",
        uri: "https://tools.ietf.org/html/rfc6229#section-2",
        keySize: 16,
        input: global.OpCodes.Hex8ToBytes("0000000000000000"),
        key: global.OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
        expected: global.OpCodes.Hex8ToBytes("9ac7cc9a609d1ef7")
      }
    ],
    
    // Initialize cipher
    Init: function() {
      RC4.isInitialized = true;
    },
    
    // Set up key and initialize RC4 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'RC4[' + global.generateUniqueID() + ']';
      } while (RC4.instances[id] || global.objectInstances[id]);
      
      RC4.instances[id] = new RC4.RC4Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        
        set key(keyData) {
          this._instance = new RC4.RC4Instance(keyData);
        },
        
        set keySize(size) {
          // Store for later use when key is set
          this._keySize = size;
        },
        
        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = data.slice();
          } else if (typeof data === 'string') {
            this._inputData = [];
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },
        
        Result: function() {
          if (!this._instance || this._inputData.length === 0) {
            return [];
          }
          
          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            const keystreamByte = this._instance.generateKeystreamByte();
            result.push(this._inputData[i] ^ keystreamByte);
          }
          return result;
        }
      };
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (RC4.instances[id]) {
        // Clear sensitive data
        const instance = RC4.instances[id];
        if (instance.S && global.OpCodes) {
          global.OpCodes.ClearArray(instance.S);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete RC4.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC4', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!RC4.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RC4', 'encryptBlock');
        return plaintext;
      }
      
      const instance = RC4.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.generateKeystreamByte();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return RC4.encryptBlock(id, ciphertext);
    },
    
    // RC4 Instance class
    RC4Instance: function(key) {
      this.S = new Array(256);     // S-box permutation array
      this.i = 0;                  // PRGA counter i
      this.j = 0;                  // PRGA counter j
      this.keyBytes = [];          // Store key as byte array
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        this.keyBytes = key.slice(0); // Copy array
      } else {
        throw new Error('RC4 key must be string or byte array');
      }
      
      if (this.keyBytes.length === 0) {
        throw new Error('RC4 key cannot be empty');
      }
      
      // Initialize S-box with KSA (Key Scheduling Algorithm)
      this.keySchedulingAlgorithm();
    }
  };
  
  // Add methods to RC4Instance prototype
  RC4.RC4Instance.prototype = {
    
    /**
     * Key Scheduling Algorithm (KSA)
     * Initializes the S-box permutation based on the key
     */
    keySchedulingAlgorithm: function() {
      // Step 1: Initialize S-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.S[i] = i;
      }
      
      // Step 2: Use key to scramble S-box
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + this.S[i] + this.keyBytes[i % this.keyBytes.length]) % 256;
        
        // Swap S[i] and S[j]
        const temp = this.S[i];
        this.S[i] = this.S[j];
        this.S[j] = temp;
      }
      
      // Reset PRGA counters
      this.i = 0;
      this.j = 0;
    },
    
    /**
     * Pseudo-Random Generation Algorithm (PRGA)
     * Generates one keystream byte
     * @returns {number} Keystream byte (0-255)
     */
    generateKeystreamByte: function() {
      // Increment i
      this.i = (this.i + 1) % 256;
      
      // Update j
      this.j = (this.j + this.S[this.i]) % 256;
      
      // Swap S[i] and S[j]
      const temp = this.S[this.i];
      this.S[this.i] = this.S[this.j];
      this.S[this.j] = temp;
      
      // Calculate output
      const t = (this.S[this.i] + this.S[this.j]) % 256;
      return this.S[t];
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.generateKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset the cipher to initial state (re-run KSA)
     */
    reset: function() {
      this.keySchedulingAlgorithm();
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(RC4);
  }
  
  // Auto-register with legacy Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(RC4);
  }
  
  // Export to global scope
  global.RC4 = RC4;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RC4;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);