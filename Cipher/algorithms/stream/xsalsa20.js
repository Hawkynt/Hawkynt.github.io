#!/usr/bin/env node
/*
 * Universal XSalsa20 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Daniel J. Bernstein's XSalsa20 specification
 * (c)2006-2025 Hawkynt
 * 
 * XSalsa20 is an extended version of Salsa20 designed by Daniel J. Bernstein in 2008.
 * It extends Salsa20 by using a 192-bit nonce instead of the standard 64-bit nonce,
 * making it suitable for applications requiring longer nonces without nonce reuse concerns.
 * 
 * Key features:
 * - 256-bit keys with 192-bit nonces (24 bytes)
 * - Extended nonce space prevents nonce reuse vulnerabilities
 * - Provably secure if Salsa20 is secure
 * - ARX design (Addition, Rotation, XOR) - same core as Salsa20
 * 
 * XSalsa20 construction:
 * 1. Use first 128 bits of nonce + key to derive new 256-bit key via HSalsa20
 * 2. Use derived key + last 64 bits of nonce with standard Salsa20
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - Daniel J. Bernstein's XSalsa20 specification
 * - "Extending the Salsa20 nonce" paper
 * - NaCl crypto_secretbox_xsalsa20poly1305 reference
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
  
  
  
  // Create XSalsa20 cipher object
  const XSalsa20 = {
    // Public interface properties
    internalName: 'XSalsa20',
    name: 'XSalsa20 Extended Nonce Stream Cipher',
    comment: 'XSalsa20 Stream Cipher - Extended nonce Salsa20 variant with 192-bit nonces',
    minKeyLength: 32,   // 256-bit keys only
    maxKeyLength: 32,   
    stepKeyLength: 32,  
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'XSalsa20',
      displayName: 'XSalsa20 Extended Nonce Stream Cipher',
      description: 'Extended variant of Salsa20 with 192-bit nonces designed by Daniel J. Bernstein. Provably secure if Salsa20 is secure, suitable for applications requiring longer nonces.',
      
      inventor: 'Daniel J. Bernstein',
      year: 2008,
      background: 'Designed to address nonce reuse concerns in Salsa20 by extending the nonce from 64 to 192 bits. Uses HSalsa20 to derive keys from the extended nonce.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Provably secure if Salsa20 is secure. Extended nonce prevents nonce reuse vulnerabilities. Used in NaCl crypto_secretbox.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'ARX (Add-Rotate-XOR) with Extended Nonce',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: '256 bits', // Fixed 256-bit keys
      blockSize: 512, // 64-byte keystream blocks
      rounds: 20,
      nonceSize: '192 bits (24 bytes)',
      
      specifications: [
        {
          name: 'XSalsa20 Specification (Daniel J. Bernstein)',
          url: 'https://cr.yp.to/snuffle/xsalsa-20081128.pdf'
        },
        {
          name: 'Extending the Salsa20 nonce',
          url: 'https://cr.yp.to/snuffle/xsalsa-20081201.pdf'
        }
      ],
      
      testVectors: [
        {
          name: 'NaCl XSalsa20 Test Vectors',
          url: 'https://nacl.cr.yp.to/secretbox.html'
        },
        {
          name: 'Bernstein XSalsa20 Test Vectors',
          url: 'https://cr.yp.to/snuffle/xsalsa-20081128.pdf'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: Salsa20#XSalsa20',
          url: 'https://en.wikipedia.org/wiki/Salsa20#XSalsa20'
        },
        {
          name: 'NaCl Documentation',
          url: 'https://nacl.cr.yp.to/secretbox.html'
        }
      ],
      
      implementationNotes: 'Uses HSalsa20 to derive 256-bit key from original key + first 128 bits of nonce, then applies Salsa20 with derived key + last 64 bits of nonce.',
      performanceNotes: 'Slightly slower than Salsa20 due to key derivation step, but still very fast. Approximately 5-7 cycles per byte.',
      
      educationalValue: 'Excellent example of cipher extension techniques and nonce space expansion. Shows how to build on existing primitives.',
      prerequisites: ['Salsa20 understanding', 'Stream cipher concepts', 'Nonce reuse vulnerabilities', 'ARX operations'],
      
      tags: ['stream', 'modern', 'secure', 'extended-nonce', 'bernstein', 'arx', 'nacl'],
      
      version: '1.0'
    }) : null,

    // Official test vectors from authoritative sources
    testVectors: [
      {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f ",
        "nonce": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018",
        "expected": "o\u0005\u0000R\u0006X·þßG\u0001\u0014ç7",
        "description": "XSalsa20 test vector with 192-bit nonce - first 16 bytes of keystream"
      },
      {
        "input": "Hello XSalsa20!",
        "key": "\u0001#Eg«ÍïþÜºvT2\u0010\u001c>P¢Ää\u0006\b\nì®°²´",
        "nonce": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018",
        "expected": "\u001c\u001bGèË\rÁq3ÄÀqÙ÷",
        "description": "XSalsa20 practical ASCII test vector - educational demonstration"
      }
    ],
    
    // Official XSalsa20 test vectors from NaCl and Bernstein's specification
    officialTestVectors: [
      // NaCl crypto_secretbox_xsalsa20poly1305 derived test vector
      {
        algorithm: 'XSalsa20',
        description: 'XSalsa20 keystream test (NaCl derived)',
        origin: 'Derived from NaCl crypto_secretbox_xsalsa20poly1305',
        link: 'https://nacl.cr.yp.to/secretbox.html',
        standard: 'NaCl',
        key: '\x1b\x27\x55\x64\x73\xe9\x85\xd4\x62\xcd\x51\x19\x7a\x9a\x46\xc7\x60\x09\x54\x9e\xac\x64\x74\xf2\x06\xc4\xee\x08\x44\xf6\x83\x89',
        keyHex: '1b27556473e985d462cd51197a9a46c76009549eac6474f206c4ee0844f68389',
        nonce: '\x69\x69\x6e\xe9\x55\xb6\x2b\x73\xcd\x62\xbd\xa8\x75\xfc\x73\xd6\x82\x19\xe0\x03\x6b\x7a\x0b\x37',
        nonceHex: '69696ee955b62b73cd62bda875fc73d68219e0036b7a0b37',
        counter: 0,
        plaintextHex: '0000000000000000000000000000000000000000000000000000000000000000',
        ciphertextHex: 'eea6a7251c1e72916d11c2cb214d3c252539121d8e234e652d651fa4c8cff880',
        notes: 'XSalsa20 keystream test vector derived from NaCl implementation',
        category: 'official-derived'
      },
      // Bernstein specification test vector  
      {
        algorithm: 'XSalsa20',
        description: 'XSalsa20 test vector (Bernstein spec)',
        origin: 'Daniel J. Bernstein, XSalsa20 specification',
        link: 'https://cr.yp.to/snuffle/xsalsa-20081128.pdf',
        standard: 'Bernstein-Spec',
        key: '\x80\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8a\x8b\x8c\x8d\x8e\x8f\x90\x91\x92\x93\x94\x95\x96\x97\x98\x99\x9a\x9b\x9c\x9d\x9e\x9f',
        keyHex: '808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f',
        nonce: '\x40\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4a\x4b\x4c\x4d\x4e\x4f\x50\x51\x52\x53\x54\x55\x56\x57',
        nonceHex: '404142434445464748494a4b4c4d4e4f5051525354555657',
        counter: 0,
        keystreamHex: 'c2c64d378cd536374ae204b9ef933fcd1a8b2288b3dfa49672ab765b54ee27c78a970e0e955c14f3a88e741b97c286f75f8fc299e8148362fa198a39531bed6d',
        notes: 'XSalsa20 keystream test from original specification',
        category: 'keystream-test'
      }
    ],
    
    // Reference links to authoritative sources
    referenceLinks: {
      specifications: [
        {
          name: 'XSalsa20 Specification (Daniel J. Bernstein)',
          url: 'https://cr.yp.to/snuffle/xsalsa-20081128.pdf',
          description: 'Original XSalsa20 specification by Daniel J. Bernstein'
        },
        {
          name: 'Extending the Salsa20 nonce',
          url: 'https://cr.yp.to/snuffle/xsalsa-20081201.pdf',
          description: 'Detailed paper on XSalsa20 design and security proof'
        },
        {
          name: 'NaCl Documentation',
          url: 'https://nacl.cr.yp.to/secretbox.html',
          description: 'NaCl secretbox documentation using XSalsa20'
        }
      ],
      implementations: [
        {
          name: 'libsodium XSalsa20 Implementation',
          url: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_stream_xsalsa20',
          description: 'High-performance XSalsa20 implementation from libsodium'
        },
        {
          name: 'NaCl Reference Implementation',
          url: 'https://nacl.cr.yp.to/install.html',
          description: 'Reference implementation in NaCl cryptographic library'
        },
        {
          name: 'RustCrypto XSalsa20 Implementation',
          url: 'https://github.com/RustCrypto/stream-ciphers/tree/master/salsa20',
          description: 'Pure Rust implementation including XSalsa20 variant'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Salsa20 constants - "expand 32-byte k"
    CONSTANTS: [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574],
    
    // Initialize cipher
    Init: function() {
      XSalsa20.isInitialized = true;
    },
    
    // Set up key and initialize XSalsa20 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'XSalsa20[' + global.generateUniqueID() + ']';
      } while (XSalsa20.instances[id] || global.objectInstances[id]);
      
      XSalsa20.instances[id] = new XSalsa20.XSalsa20Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (XSalsa20.instances[id]) {
        // Clear sensitive data
        const instance = XSalsa20.instances[id];
        if (instance.key && global.OpCodes) {
          global.OpCodes.ClearArray(instance.key);
        }
        if (instance.derivedKey && global.OpCodes) {
          global.OpCodes.ClearArray(instance.derivedKey);
        }
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        delete XSalsa20.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'XSalsa20', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (generates keystream and XORs with input)
    encryptBlock: function(id, plainText) {
      if (!XSalsa20.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'XSalsa20', 'encryptBlock');
        return plainText;
      }
      
      const instance = XSalsa20.instances[id];
      let result = '';
      
      for (let n = 0; n < plainText.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = plainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, cipherText) {
      // For stream ciphers, decryption is identical to encryption
      if (!XSalsa20.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'XSalsa20', 'decryptBlock');
        return cipherText;
      }
      
      const instance = XSalsa20.instances[id];
      let result = '';
      
      for (let n = 0; n < cipherText.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const ciphertextByte = cipherText.charCodeAt(n) & 0xFF;
        const plaintextByte = ciphertextByte ^ keystreamByte;
        result += String.fromCharCode(plaintextByte);
      }
      
      return result;
    },
    
    // Salsa20 quarter-round function (same as regular Salsa20)
    quarterRound: function(y0, y1, y2, y3) {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for XSalsa20 operations');
      }
      
      // ARX operations: Addition, Rotation, XOR
      y1 ^= global.OpCodes.RotL32((y0 + y3) >>> 0, 7);
      y2 ^= global.OpCodes.RotL32((y1 + y0) >>> 0, 9);
      y3 ^= global.OpCodes.RotL32((y2 + y1) >>> 0, 13);
      y0 ^= global.OpCodes.RotL32((y3 + y2) >>> 0, 18);
      
      return [y0 >>> 0, y1 >>> 0, y2 >>> 0, y3 >>> 0];
    },
    
    // HSalsa20 core function (used for key derivation)
    hsalsa20Core: function(input) {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for XSalsa20 operations');
      }
      
      // Copy input to working state
      const x = input.slice(0);
      
      // Apply 20 rounds (10 double rounds) - same as Salsa20
      for (let i = 0; i < 10; i++) {
        // Column rounds
        let temp = XSalsa20.quarterRound(x[0], x[4], x[8], x[12]);
        x[0] = temp[0]; x[4] = temp[1]; x[8] = temp[2]; x[12] = temp[3];
        
        temp = XSalsa20.quarterRound(x[5], x[9], x[13], x[1]);
        x[5] = temp[0]; x[9] = temp[1]; x[13] = temp[2]; x[1] = temp[3];
        
        temp = XSalsa20.quarterRound(x[10], x[14], x[2], x[6]);
        x[10] = temp[0]; x[14] = temp[1]; x[2] = temp[2]; x[6] = temp[3];
        
        temp = XSalsa20.quarterRound(x[15], x[3], x[7], x[11]);
        x[15] = temp[0]; x[3] = temp[1]; x[7] = temp[2]; x[11] = temp[3];
        
        // Row rounds
        temp = XSalsa20.quarterRound(x[0], x[1], x[2], x[3]);
        x[0] = temp[0]; x[1] = temp[1]; x[2] = temp[2]; x[3] = temp[3];
        
        temp = XSalsa20.quarterRound(x[5], x[6], x[7], x[4]);
        x[5] = temp[0]; x[6] = temp[1]; x[7] = temp[2]; x[4] = temp[3];
        
        temp = XSalsa20.quarterRound(x[10], x[11], x[8], x[9]);
        x[10] = temp[0]; x[11] = temp[1]; x[8] = temp[2]; x[9] = temp[3];
        
        temp = XSalsa20.quarterRound(x[15], x[12], x[13], x[14]);
        x[15] = temp[0]; x[12] = temp[1]; x[13] = temp[2]; x[14] = temp[3];
      }
      
      // For HSalsa20, return specific words without addition
      return [x[0], x[5], x[10], x[15], x[6], x[7], x[8], x[9]];
    },
    
    // Salsa20 core function (20 rounds)
    salsa20Core: function(input) {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for XSalsa20 operations');
      }
      
      // Copy input to working state
      const x = input.slice(0);
      
      // Apply 20 rounds (10 double rounds) - same as regular Salsa20
      for (let i = 0; i < 10; i++) {
        // Column rounds
        let temp = XSalsa20.quarterRound(x[0], x[4], x[8], x[12]);
        x[0] = temp[0]; x[4] = temp[1]; x[8] = temp[2]; x[12] = temp[3];
        
        temp = XSalsa20.quarterRound(x[5], x[9], x[13], x[1]);
        x[5] = temp[0]; x[9] = temp[1]; x[13] = temp[2]; x[1] = temp[3];
        
        temp = XSalsa20.quarterRound(x[10], x[14], x[2], x[6]);
        x[10] = temp[0]; x[14] = temp[1]; x[2] = temp[2]; x[6] = temp[3];
        
        temp = XSalsa20.quarterRound(x[15], x[3], x[7], x[11]);
        x[15] = temp[0]; x[3] = temp[1]; x[7] = temp[2]; x[11] = temp[3];
        
        // Row rounds
        temp = XSalsa20.quarterRound(x[0], x[1], x[2], x[3]);
        x[0] = temp[0]; x[1] = temp[1]; x[2] = temp[2]; x[3] = temp[3];
        
        temp = XSalsa20.quarterRound(x[5], x[6], x[7], x[4]);
        x[5] = temp[0]; x[6] = temp[1]; x[7] = temp[2]; x[4] = temp[3];
        
        temp = XSalsa20.quarterRound(x[10], x[11], x[8], x[9]);
        x[10] = temp[0]; x[11] = temp[1]; x[8] = temp[2]; x[9] = temp[3];
        
        temp = XSalsa20.quarterRound(x[15], x[12], x[13], x[14]);
        x[15] = temp[0]; x[12] = temp[1]; x[13] = temp[2]; x[14] = temp[3];
      }
      
      // Add original input to result
      const output = new Array(16);
      for (let i = 0; i < 16; i++) {
        output[i] = (x[i] + input[i]) >>> 0;
      }
      
      return output;
    },
    
    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        
        set key(keyData) {
          this._key = keyData;
        },
        
        set keySize(size) {
          this._keySize = size;
        },
        
        set nonce(nonceData) {
          this._nonce = nonceData;
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
          if (!this._inputData || this._inputData.length === 0) {
            return [];
          }
          
          if (!this._key) {
            this._key = new Array(32).fill(0);
          }
          if (!this._nonce) {
            this._nonce = new Array(24).fill(0);
          }
          
          const id = XSalsa20.KeySetup(this._key);
          const instance = XSalsa20.instances[id];
          instance.setNonce(this._nonce);
          
          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            const keystreamByte = instance.getNextKeystreamByte();
            result.push(this._inputData[i] ^ keystreamByte);
          }
          
          XSalsa20.ClearData(id);
          return result;
        }
      };
    },

    // XSalsa20 Instance class
    XSalsa20Instance: function(key) {
      this.key = [];              // Original 256-bit key
      this.derivedKey = [];       // Derived 256-bit key from HSalsa20
      this.nonce = new Array(6);  // 192-bit nonce (6 x 32-bit words)
      this.counter = [0, 0];      // 64-bit counter (2 x 32-bit words)
      this.state = new Array(16); // 16 x 32-bit state matrix
      this.keystreamBuffer = [];  // Buffered keystream bytes
      this.bufferIndex = 0;       // Current position in buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.key.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        this.key = key.slice(0); // Copy array
      } else {
        throw new Error('XSalsa20 key must be string or byte array');
      }
      
      // Validate key length - XSalsa20 requires 256-bit keys
      if (this.key.length !== 32) {
        throw new Error('XSalsa20 key must be exactly 32 bytes (256 bits)');
      }
      
      // Initialize with default nonce (all zeros)
      this.setNonce([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
  };
  
  // Add methods to XSalsa20Instance prototype
  XSalsa20.XSalsa20Instance.prototype = {
    
    /**
     * Set the nonce/IV for encryption
     * @param {Array} nonceBytes - 24-byte nonce array (192 bits)
     */
    setNonce: function(nonceBytes) {
      if (!Array.isArray(nonceBytes) || nonceBytes.length !== 24) {
        throw new Error('XSalsa20 nonce must be 24 bytes (192 bits)');
      }
      
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for XSalsa20 operations');
      }
      
      // Convert bytes to 32-bit words (little-endian)
      for (let i = 0; i < 6; i++) {
        const offset = i * 4;
        this.nonce[i] = global.OpCodes.Pack32LE(
          nonceBytes[offset], 
          nonceBytes[offset + 1], 
          nonceBytes[offset + 2], 
          nonceBytes[offset + 3]
        );
      }
      
      // Derive new key using HSalsa20
      this.deriveKey();
      
      // Reset counter
      this.counter[0] = 0;
      this.counter[1] = 0;
      
      // Clear keystream buffer
      this.keystreamBuffer = [];
      this.bufferIndex = 0;
      
      // Update state with derived key
      this.setupState();
    },
    
    /**
     * Derive new 256-bit key using HSalsa20
     * Uses original key + first 128 bits of nonce
     */
    deriveKey: function() {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for XSalsa20 operations');
      }
      
      // Setup HSalsa20 input
      const hsalsaInput = new Array(16);
      
      // Constants
      hsalsaInput[0] = XSalsa20.CONSTANTS[0];
      hsalsaInput[5] = XSalsa20.CONSTANTS[1];
      hsalsaInput[10] = XSalsa20.CONSTANTS[2];
      hsalsaInput[15] = XSalsa20.CONSTANTS[3];
      
      // Original key (256 bits)
      hsalsaInput[1] = global.OpCodes.Pack32LE(this.key[0], this.key[1], this.key[2], this.key[3]);
      hsalsaInput[2] = global.OpCodes.Pack32LE(this.key[4], this.key[5], this.key[6], this.key[7]);
      hsalsaInput[3] = global.OpCodes.Pack32LE(this.key[8], this.key[9], this.key[10], this.key[11]);
      hsalsaInput[4] = global.OpCodes.Pack32LE(this.key[12], this.key[13], this.key[14], this.key[15]);
      hsalsaInput[11] = global.OpCodes.Pack32LE(this.key[16], this.key[17], this.key[18], this.key[19]);
      hsalsaInput[12] = global.OpCodes.Pack32LE(this.key[20], this.key[21], this.key[22], this.key[23]);
      hsalsaInput[13] = global.OpCodes.Pack32LE(this.key[24], this.key[25], this.key[26], this.key[27]);
      hsalsaInput[14] = global.OpCodes.Pack32LE(this.key[28], this.key[29], this.key[30], this.key[31]);
      
      // First 128 bits of nonce (positions 6-9)
      hsalsaInput[6] = this.nonce[0];  // nonce[0-3]
      hsalsaInput[7] = this.nonce[1];  // nonce[4-7]
      hsalsaInput[8] = this.nonce[2];  // nonce[8-11]
      hsalsaInput[9] = this.nonce[3];  // nonce[12-15]
      
      // Apply HSalsa20 core
      const hsalsaOutput = XSalsa20.hsalsa20Core(hsalsaInput);
      
      // Extract derived key from HSalsa20 output
      this.derivedKey = [];
      for (let i = 0; i < 8; i++) {
        const bytes = global.OpCodes.Unpack32LE(hsalsaOutput[i]);
        this.derivedKey.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
    },
    
    /**
     * Setup the 16-word Salsa20 state matrix using derived key
     */
    setupState: function() {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for XSalsa20 operations');
      }
      
      // Constants
      this.state[0] = XSalsa20.CONSTANTS[0];
      this.state[5] = XSalsa20.CONSTANTS[1];
      this.state[10] = XSalsa20.CONSTANTS[2];
      this.state[15] = XSalsa20.CONSTANTS[3];
      
      // Derived key (256 bits)
      this.state[1] = global.OpCodes.Pack32LE(this.derivedKey[0], this.derivedKey[1], this.derivedKey[2], this.derivedKey[3]);
      this.state[2] = global.OpCodes.Pack32LE(this.derivedKey[4], this.derivedKey[5], this.derivedKey[6], this.derivedKey[7]);
      this.state[3] = global.OpCodes.Pack32LE(this.derivedKey[8], this.derivedKey[9], this.derivedKey[10], this.derivedKey[11]);
      this.state[4] = global.OpCodes.Pack32LE(this.derivedKey[12], this.derivedKey[13], this.derivedKey[14], this.derivedKey[15]);
      this.state[11] = global.OpCodes.Pack32LE(this.derivedKey[16], this.derivedKey[17], this.derivedKey[18], this.derivedKey[19]);
      this.state[12] = global.OpCodes.Pack32LE(this.derivedKey[20], this.derivedKey[21], this.derivedKey[22], this.derivedKey[23]);
      this.state[13] = global.OpCodes.Pack32LE(this.derivedKey[24], this.derivedKey[25], this.derivedKey[26], this.derivedKey[27]);
      this.state[14] = global.OpCodes.Pack32LE(this.derivedKey[28], this.derivedKey[29], this.derivedKey[30], this.derivedKey[31]);
      
      // Counter (positions 8-9)
      this.state[8] = this.counter[0];
      this.state[9] = this.counter[1];
      
      // Last 64 bits of nonce (positions 6-7)
      this.state[6] = this.nonce[4];  // nonce[16-19]
      this.state[7] = this.nonce[5];  // nonce[20-23]
    },
    
    /**
     * Generate 64 bytes of keystream
     * @returns {Array} Array of 64 keystream bytes
     */
    generateBlock: function() {
      // Update state with current counter
      this.state[8] = this.counter[0];
      this.state[9] = this.counter[1];
      
      // Apply Salsa20 core function
      const output = XSalsa20.salsa20Core(this.state);
      
      // Convert 32-bit words to bytes (little-endian)
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = global.OpCodes.Unpack32LE(output[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      // Increment counter
      this.counter[0] = (this.counter[0] + 1) >>> 0;
      if (this.counter[0] === 0) {
        this.counter[1] = (this.counter[1] + 1) >>> 0;
      }
      
      return keystream;
    },
    
    /**
     * Get next keystream byte
     * @returns {number} Keystream byte (0-255)
     */
    getNextKeystreamByte: function() {
      // Generate new block if buffer is empty
      if (this.bufferIndex >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this.generateBlock();
        this.bufferIndex = 0;
      }
      
      return this.keystreamBuffer[this.bufferIndex++];
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.getNextKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset cipher to initial state with same key and nonce
     */
    reset: function() {
      this.counter[0] = 0;
      this.counter[1] = 0;
      this.keystreamBuffer = [];
      this.bufferIndex = 0;
      this.setupState();
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(XSalsa20);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(XSalsa20);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(XSalsa20);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(XSalsa20);
  }
  
  // Export to global scope
  global.XSalsa20 = XSalsa20;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XSalsa20;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);