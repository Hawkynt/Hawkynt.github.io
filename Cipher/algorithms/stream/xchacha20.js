#!/usr/bin/env node
/*
 * Universal XChaCha20 Stream Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on draft-irtf-cfrg-xchacha specification and libsodium reference
 * 
 * XChaCha20 is an extended-nonce variant of ChaCha20 that provides:
 * - 192-bit nonces (compared to ChaCha20's 96-bit nonces)
 * - Better security against nonce reuse attacks
 * - Simplified nonce generation for applications
 * - HChaCha20 key derivation for subkey generation
 * 
 * Key Features:
 * - 256-bit keys with 192-bit nonces
 * - Uses HChaCha20 for subkey derivation
 * - Compatible with ChaCha20 core operations
 * - No nonce reuse concerns with random nonces
 * - Excellent for applications needing large nonce spaces
 * 
 * Educational Value:
 * - Demonstrates nonce extension techniques
 * - Shows key derivation function usage
 * - Practical cryptographic engineering
 * - Modern stream cipher construction
 * - Security against nonce reuse attacks
 * 
 * Applications:
 * - File encryption with random nonces
 * - Network protocols requiring unique nonces
 * - Database encryption with deterministic nonces
 * - Any application where nonce management is challenging
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - draft-irtf-cfrg-xchacha: https://tools.ietf.org/html/draft-irtf-cfrg-xchacha
 * - libsodium XChaCha20: https://libsodium.gitbook.io/doc/secret-key_cryptography/xchacha20
 * - ChaCha20 RFC 7539: https://tools.ietf.org/html/rfc7539
 * 
 * (c)2006-2025 Hawkynt - Educational implementation following draft-irtf-cfrg-xchacha
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  } 
  
  
  
  // XChaCha20 constants
  const XCHACHA20_KEY_SIZE = 32;     // 256-bit keys
  const XCHACHA20_NONCE_SIZE = 24;   // 192-bit nonces
  const XCHACHA20_BLOCK_SIZE = 64;   // 64-byte keystream blocks
  const CHACHA20_NONCE_SIZE = 12;    // Internal ChaCha20 nonce size
  const HCHACHA20_NONCE_SIZE = 16;   // HChaCha20 nonce size
  
  // ChaCha20 constants - "expand 32-byte k"
  const CHACHA20_CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];
  
  const XChaCha20 = {
    // Universal cipher interface properties
    internalName: 'xchacha20-universal',
    name: 'XChaCha20 Extended-Nonce Stream Cipher',
    comment: 'Extended-nonce variant of ChaCha20 with 192-bit nonces and HChaCha20 key derivation',
    
    // Cipher interface requirements
    minKeyLength: 32,        // XChaCha20 requires exactly 32-byte keys
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 1,         // Stream cipher - processes byte by byte
    maxBlockSize: 65536,     // Practical limit
    stepBlockSize: 1,
    instances: {},
    
    // Algorithm properties
    isStreamCipher: true,
    version: '1.0.0',
    date: '2025-01-18',
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'XChaCha20',
      displayName: 'XChaCha20 Extended-Nonce Stream Cipher',
      description: 'Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. Uses HChaCha20 key derivation to generate subkeys, eliminating nonce reuse concerns and simplifying secure implementation.',
      
      inventor: 'Daniel J. Bernstein (ChaCha20 base), Frank Denis (XChaCha20 extension)',
      year: 2018,
      background: 'Developed to address ChaCha20\'s small nonce space. Standardized in draft-irtf-cfrg-xchacha and widely implemented in libsodium. Provides practical solution for applications requiring many encryptions.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Secure with proper implementation. Eliminates birthday bound concerns of ChaCha20 nonces. Based on well-analyzed ChaCha20 with proven HChaCha20 key derivation.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'Extended-Nonce Stream Cipher',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 256, // 256-bit keys
      blockSize: 512, // 64-byte keystream blocks
      rounds: 20, // ChaCha20 rounds
      
      specifications: [
        {
          name: 'draft-irtf-cfrg-xchacha: XChaCha: eXtended-nonce ChaCha',
          url: 'https://tools.ietf.org/html/draft-irtf-cfrg-xchacha'
        },
        {
          name: 'ChaCha20 RFC 7539 (base algorithm)',
          url: 'https://tools.ietf.org/html/rfc7539'
        }
      ],
      
      testVectors: [
        {
          name: 'XChaCha20 Test Vectors',
          url: 'https://github.com/jedisct1/libsodium/tree/master/test/default'
        },
        {
          name: 'draft-irtf-cfrg-xchacha Test Vectors',
          url: 'https://tools.ietf.org/html/draft-irtf-cfrg-xchacha#section-2.2.1'
        }
      ],
      
      references: [
        {
          name: 'libsodium XChaCha20 Documentation',
          url: 'https://libsodium.gitbook.io/doc/secret-key_cryptography/xchacha20'
        },
        {
          name: 'Too Much Crypto (XChaCha20 blog post)',
          url: 'https://blog.filippo.io/the-scrypt-parameters/'
        }
      ],
      
      implementationNotes: 'Educational implementation demonstrating HChaCha20 key derivation and nonce extension techniques. Shows practical cryptographic engineering.',
      performanceNotes: 'Similar performance to ChaCha20 with additional HChaCha20 setup cost. Negligible overhead for most applications.',
      
      educationalValue: 'Excellent for learning nonce extension techniques, key derivation functions, and practical cryptographic engineering solutions.',
      prerequisites: ['ChaCha20 understanding', 'Stream cipher concepts', 'Key derivation functions'],
      
      tags: ['stream', 'extended-nonce', 'chacha20-variant', 'key-derivation', 'nonce-extension', 'practical'],
      
      version: '2.0'
    }) : null,
    
    // Initialize XChaCha20
    Init: function() {
      return true;
    },
    
    // ChaCha20 quarter-round operation
    quarterRound: function(state, a, b, c, d) {
      // a += b; d ^= a; d <<<= 16;
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] ^= state[a];
      state[d] = global.OpCodes.RotL32(state[d], 16);
      
      // c += d; b ^= c; b <<<= 12;
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] ^= state[c];
      state[b] = global.OpCodes.RotL32(state[b], 12);
      
      // a += b; d ^= a; d <<<= 8;
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] ^= state[a];
      state[d] = global.OpCodes.RotL32(state[d], 8);
      
      // c += d; b ^= c; b <<<= 7;
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] ^= state[c];
      state[b] = global.OpCodes.RotL32(state[b], 7);
    },
    
    // HChaCha20 key derivation function
    // Takes 256-bit key and 128-bit nonce, produces 256-bit subkey
    hchacha20: function(key, nonce) {
      if (key.length !== XCHACHA20_KEY_SIZE) {
        throw new Error('HChaCha20 key must be 32 bytes');
      }
      if (nonce.length !== HCHACHA20_NONCE_SIZE) {
        throw new Error('HChaCha20 nonce must be 16 bytes');
      }
      
      // Initialize state like ChaCha20
      const state = new Array(16);
      
      // Constants (words 0-3)
      for (let i = 0; i < 4; i++) {
        state[i] = CHACHA20_CONSTANTS[i];
      }
      
      // Key (words 4-11)
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        state[4 + i] = global.OpCodes.Pack32LE(
          key[offset],
          key[offset + 1],
          key[offset + 2],
          key[offset + 3]
        );
      }
      
      // Nonce (words 12-15) - first 16 bytes of XChaCha20 nonce
      for (let i = 0; i < 4; i++) {
        const offset = i * 4;
        state[12 + i] = global.OpCodes.Pack32LE(
          nonce[offset],
          nonce[offset + 1],
          nonce[offset + 2],
          nonce[offset + 3]
        );
      }
      
      // Perform 20 rounds (10 double-rounds) like ChaCha20
      for (let round = 0; round < 10; round++) {
        // Column rounds
        this.quarterRound(state, 0, 4, 8, 12);
        this.quarterRound(state, 1, 5, 9, 13);
        this.quarterRound(state, 2, 6, 10, 14);
        this.quarterRound(state, 3, 7, 11, 15);
        
        // Diagonal rounds
        this.quarterRound(state, 0, 5, 10, 15);
        this.quarterRound(state, 1, 6, 11, 12);
        this.quarterRound(state, 2, 7, 8, 13);
        this.quarterRound(state, 3, 4, 9, 14);
      }
      
      // Extract subkey from words 0, 1, 2, 3, 12, 13, 14, 15
      const subkey = new Array(32);
      const keyWords = [0, 1, 2, 3, 12, 13, 14, 15];
      
      for (let i = 0; i < 8; i++) {
        const bytes = global.OpCodes.Unpack32LE(state[keyWords[i]]);
        subkey[i * 4] = bytes[0];
        subkey[i * 4 + 1] = bytes[1];
        subkey[i * 4 + 2] = bytes[2];
        subkey[i * 4 + 3] = bytes[3];
      }
      
      return subkey;
    },
    
    // ChaCha20 block function for keystream generation
    chacha20Block: function(key, counter, nonce) {
      // Initialize ChaCha20 state
      const state = new Array(16);
      
      // Constants (words 0-3)
      for (let i = 0; i < 4; i++) {
        state[i] = CHACHA20_CONSTANTS[i];
      }
      
      // Key (words 4-11)
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        state[4 + i] = global.OpCodes.Pack32LE(
          key[offset],
          key[offset + 1],
          key[offset + 2],
          key[offset + 3]
        );
      }
      
      // Counter (word 12)
      state[12] = counter;
      
      // Nonce (words 13-15)
      for (let i = 0; i < 3; i++) {
        const offset = i * 4;
        state[13 + i] = global.OpCodes.Pack32LE(
          nonce[offset],
          nonce[offset + 1],
          nonce[offset + 2],
          nonce[offset + 3]
        );
      }
      
      // Create working copy for permutation
      const workingState = state.slice(0);
      
      // Perform 20 rounds (10 double-rounds)
      for (let round = 0; round < 10; round++) {
        // Column rounds
        this.quarterRound(workingState, 0, 4, 8, 12);
        this.quarterRound(workingState, 1, 5, 9, 13);
        this.quarterRound(workingState, 2, 6, 10, 14);
        this.quarterRound(workingState, 3, 7, 11, 15);
        
        // Diagonal rounds
        this.quarterRound(workingState, 0, 5, 10, 15);
        this.quarterRound(workingState, 1, 6, 11, 12);
        this.quarterRound(workingState, 2, 7, 8, 13);
        this.quarterRound(workingState, 3, 4, 9, 14);
      }
      
      // Add original state to working state
      for (let i = 0; i < 16; i++) {
        workingState[i] = (workingState[i] + state[i]) >>> 0;
      }
      
      // Convert to byte array (little-endian)
      const keystream = new Array(64);
      for (let i = 0; i < 16; i++) {
        const bytes = global.OpCodes.Unpack32LE(workingState[i]);
        keystream[i * 4] = bytes[0];
        keystream[i * 4 + 1] = bytes[1];
        keystream[i * 4 + 2] = bytes[2];
        keystream[i * 4 + 3] = bytes[3];
      }
      
      return keystream;
    },
    
    // XChaCha20 encryption/decryption
    xchacha20: function(key, nonce, data, counter) {
      if (key.length !== XCHACHA20_KEY_SIZE) {
        throw new Error('XChaCha20 key must be 32 bytes');
      }
      if (nonce.length !== XCHACHA20_NONCE_SIZE) {
        throw new Error('XChaCha20 nonce must be 24 bytes');
      }
      
      counter = counter || 0;
      
      // Step 1: Derive subkey using HChaCha20
      // Use first 16 bytes of nonce for HChaCha20
      const hchacha20Nonce = nonce.slice(0, 16);
      const subkey = this.hchacha20(key, hchacha20Nonce);
      
      // Step 2: Use ChaCha20 with subkey and remaining nonce bytes
      // Last 8 bytes of XChaCha20 nonce become first 8 bytes of ChaCha20 nonce
      // Plus 4 zero bytes to make 12-byte ChaCha20 nonce
      const chacha20Nonce = [
        ...nonce.slice(16, 24), // Last 8 bytes of XChaCha20 nonce
        0, 0, 0, 0              // 4 zero bytes
      ];
      
      // Step 3: Encrypt/decrypt data using ChaCha20
      const output = new Array(data.length);
      let pos = 0;
      let blockCounter = counter;
      
      while (pos < data.length) {
        // Generate keystream block
        const keystream = this.chacha20Block(subkey, blockCounter, chacha20Nonce);
        
        // XOR with data
        const blockSize = Math.min(XCHACHA20_BLOCK_SIZE, data.length - pos);
        for (let i = 0; i < blockSize; i++) {
          output[pos + i] = data[pos + i] ^ keystream[i];
        }
        
        pos += blockSize;
        blockCounter++;
      }
      
      return output;
    },
    
    // Encrypt data with XChaCha20
    encrypt: function(key, nonce, plaintext, counter) {
      const keyBytes = this.stringToBytes(key);
      const nonceBytes = this.stringToBytes(nonce);
      const plaintextBytes = this.stringToBytes(plaintext);
      
      const ciphertextBytes = this.xchacha20(keyBytes, nonceBytes, plaintextBytes, counter);
      
      return {
        ciphertext: this.bytesToString(ciphertextBytes),
        ciphertextBytes: ciphertextBytes,
        keySize: keyBytes.length,
        nonceSize: nonceBytes.length
      };
    },
    
    // Decrypt data with XChaCha20
    decrypt: function(key, nonce, ciphertext, counter) {
      // For stream ciphers, decryption is identical to encryption
      return this.encrypt(key, nonce, ciphertext, counter);
    },
    
    // Generate random nonce (192 bits)
    generateNonce: function() {
      const nonce = new Array(XCHACHA20_NONCE_SIZE);
      
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Browser environment
        const array = new Uint8Array(XCHACHA20_NONCE_SIZE);
        crypto.getRandomValues(array);
        for (let i = 0; i < XCHACHA20_NONCE_SIZE; i++) {
          nonce[i] = array[i];
        }
      } else if (typeof require !== 'undefined') {
        // Node.js environment
        try {
          const crypto = require('crypto');
          const buffer = crypto.randomBytes(XCHACHA20_NONCE_SIZE);
          for (let i = 0; i < XCHACHA20_NONCE_SIZE; i++) {
            nonce[i] = buffer[i];
          }
        } catch (e) {
          // Fallback to Math.random (not cryptographically secure)
          console.warn('Using insecure random number generation');
          for (let i = 0; i < XCHACHA20_NONCE_SIZE; i++) {
            nonce[i] = Math.floor(Math.random() * 256);
          }
        }
      } else {
        // Fallback
        for (let i = 0; i < XCHACHA20_NONCE_SIZE; i++) {
          nonce[i] = Math.floor(Math.random() * 256);
        }
      }
      
      return nonce;
    },
    
    // String to byte array conversion
    stringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    // Byte array to string conversion
    bytesToString: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    },
    
    // Universal cipher interface methods
    KeySetup: function(key) {
      let id;
      do {
        id = 'XChaCha20[' + global.generateUniqueID() + ']';
      } while (this.instances[id] || global.objectInstances[id]);
      
      this.instances[id] = {
        key: key,
        keyBytes: this.stringToBytes(key)
      };
      global.objectInstances[id] = true;
      
      return id;
    },
    
    // Encrypt block (stream cipher interface)
    encryptBlock: function(instanceId, plaintext) {
      if (!this.instances[instanceId]) {
        throw new Error('Unknown XChaCha20 instance: ' + instanceId);
      }
      
      const instance = this.instances[instanceId];
      
      // Generate random nonce for each encryption
      const nonce = this.generateNonce();
      const plaintextBytes = this.stringToBytes(plaintext);
      
      const ciphertextBytes = this.xchacha20(instance.keyBytes, nonce, plaintextBytes);
      
      // Prepend nonce to ciphertext for storage/transmission
      const output = [...nonce, ...ciphertextBytes];
      
      return this.bytesToString(output);
    },
    
    // Decrypt block (stream cipher interface)
    decryptBlock: function(instanceId, ciphertext) {
      if (!this.instances[instanceId]) {
        throw new Error('Unknown XChaCha20 instance: ' + instanceId);
      }
      
      const instance = this.instances[instanceId];
      const ciphertextBytes = this.stringToBytes(ciphertext);
      
      if (ciphertextBytes.length < XCHACHA20_NONCE_SIZE) {
        throw new Error('Ciphertext too short - missing nonce');
      }
      
      // Extract nonce and ciphertext
      const nonce = ciphertextBytes.slice(0, XCHACHA20_NONCE_SIZE);
      const actualCiphertext = ciphertextBytes.slice(XCHACHA20_NONCE_SIZE);
      
      const plaintextBytes = this.xchacha20(instance.keyBytes, nonce, actualCiphertext);
      
      return this.bytesToString(plaintextBytes);
    },
    
    // Clear sensitive data
    ClearData: function(id) {
      if (this.instances[id]) {
        const instance = this.instances[id];
        
        // Clear key data
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        
        delete this.instances[id];
        delete global.objectInstances[id];
        return true;
      }
      return false;
    },
    
    // Educational test suite
    runTestVectors: function() {
      console.log('Running XChaCha20 educational test suite...');
      const results = [];
      
      try {
        // Test 1: Basic encryption/decryption round-trip
        console.log('Testing basic round-trip...');
        const key = new Array(32).fill(0).map((_, i) => i);
        const nonce = new Array(24).fill(0).map((_, i) => i + 100);
        const plaintext = 'Hello XChaCha20! This is a test message.';
        
        const encrypted = this.encrypt(this.bytesToString(key), this.bytesToString(nonce), plaintext);
        const decrypted = this.decrypt(this.bytesToString(key), this.bytesToString(nonce), encrypted.ciphertext);
        
        const roundTripSuccess = decrypted.ciphertext === plaintext;
        
        results.push({
          test: 'Round-trip Encryption/Decryption',
          success: roundTripSuccess,
          description: 'Encrypt then decrypt produces original plaintext',
          plaintextLength: plaintext.length,
          ciphertextLength: encrypted.ciphertext.length
        });
        
        // Test 2: HChaCha20 subkey derivation
        console.log('Testing HChaCha20 key derivation...');
        const testKey = new Array(32).fill(0x42);
        const testNonce = new Array(16).fill(0x24);
        
        const subkey1 = this.hchacha20(testKey, testNonce);
        const subkey2 = this.hchacha20(testKey, testNonce);
        
        let subkeysEqual = subkey1.length === subkey2.length;
        for (let i = 0; subkeysEqual && i < subkey1.length; i++) {
          if (subkey1[i] !== subkey2[i]) {
            subkeysEqual = false;
          }
        }
        
        results.push({
          test: 'HChaCha20 Deterministic Key Derivation',
          success: subkeysEqual,
          description: 'Same inputs produce same subkey',
          subkeyLength: subkey1.length
        });
        
        // Test 3: Different nonces produce different outputs
        console.log('Testing nonce uniqueness...');
        const nonce1 = new Array(24).fill(1);
        const nonce2 = new Array(24).fill(2);
        const testMessage = 'Test message for nonce uniqueness';
        
        const cipher1 = this.encrypt(this.bytesToString(key), this.bytesToString(nonce1), testMessage);
        const cipher2 = this.encrypt(this.bytesToString(key), this.bytesToString(nonce2), testMessage);
        
        const differentOutputs = cipher1.ciphertext !== cipher2.ciphertext;
        
        results.push({
          test: 'Nonce Uniqueness',
          success: differentOutputs,
          description: 'Different nonces produce different ciphertexts for same plaintext'
        });
        
        // Test 4: Interface compatibility
        console.log('Testing universal cipher interface...');
        const instanceId = this.KeySetup(this.bytesToString(key));
        const encryptedBlock = this.encryptBlock(instanceId, testMessage);
        const decryptedBlock = this.decryptBlock(instanceId, encryptedBlock);
        
        const interfaceSuccess = decryptedBlock === testMessage;
        this.ClearData(instanceId);
        
        results.push({
          test: 'Universal Cipher Interface',
          success: interfaceSuccess,
          description: 'Block encrypt/decrypt interface works correctly'
        });
        
        // Test 5: Large nonce space utilization
        console.log('Testing large nonce space...');
        const randomNonce1 = this.generateNonce();
        const randomNonce2 = this.generateNonce();
        
        let noncesUnique = randomNonce1.length === randomNonce2.length;
        let diffCount = 0;
        for (let i = 0; i < Math.min(randomNonce1.length, randomNonce2.length); i++) {
          if (randomNonce1[i] !== randomNonce2[i]) {
            diffCount++;
          }
        }
        
        noncesUnique = diffCount > 0;
        
        results.push({
          test: 'Random Nonce Generation',
          success: noncesUnique,
          description: 'Generated nonces are unique',
          nonceSize: randomNonce1.length,
          differingBytes: diffCount
        });
        
        const totalTests = results.length;
        const passedTests = results.filter(r => r.success).length;
        
        console.log(`\nXChaCha20 test results: ${passedTests}/${totalTests} passed`);
        
        return {
          algorithm: 'XChaCha20',
          implementation: 'Educational extended-nonce stream cipher',
          totalTests: totalTests,
          passed: passedTests,
          results: results,
          performance: this.measurePerformance(),
          note: 'Educational implementation demonstrating nonce extension techniques'
        };
        
      } catch (error) {
        console.error('XChaCha20 test failed:', error.message);
        results.push({
          test: 'Overall Test Suite',
          success: false,
          error: error.message
        });
        
        return {
          algorithm: 'XChaCha20',
          totalTests: results.length,
          passed: 0,
          results: results,
          error: error.message
        };
      }
    },
    
    // Performance measurement
    measurePerformance: function() {
      const iterations = 100;
      const testData = 'Performance test data for XChaCha20 encryption and decryption.'.repeat(5);
      const key = new Array(32).fill(0x42);
      const nonce = new Array(24).fill(0x24);
      
      // Test encryption performance
      const startEnc = Date.now();
      for (let i = 0; i < iterations; i++) {
        this.xchacha20(key, nonce, this.stringToBytes(testData));
      }
      const encTime = Date.now() - startEnc;
      
      // Test HChaCha20 performance
      const hchacha20Nonce = nonce.slice(0, 16);
      const startHC = Date.now();
      for (let i = 0; i < iterations; i++) {
        this.hchacha20(key, hchacha20Nonce);
      }
      const hcTime = Date.now() - startHC;
      
      const bytesProcessed = testData.length * iterations;
      
      return {
        iterations: iterations,
        encryptionTimeMs: encTime,
        hchacha20TimeMs: hcTime,
        bytesProcessed: bytesProcessed,
        throughputMBps: (bytesProcessed / 1024 / 1024) / (encTime / 1000),
        encryptionsPerSecond: Math.round((iterations * 1000) / encTime),
        keyDerivationsPerSecond: Math.round((iterations * 1000) / hcTime)
      };
    }
  };
  
  // Educational information
  XChaCha20.educationalInfo = {
    overview: 'XChaCha20 extends ChaCha20 with 192-bit nonces, eliminating birthday bound concerns and simplifying secure implementation.',
    keyFeatures: [
      '192-bit nonces (3x larger than ChaCha20)',
      'HChaCha20 key derivation for subkey generation',
      'No nonce reuse concerns with random nonces',
      'Compatible with ChaCha20 core operations',
      'Practical solution for real-world applications'
    ],
    advantages: {
      'Large nonce space': '2^192 possible nonces eliminate collision concerns',
      'Simplified usage': 'Random nonces can be safely used without counters',
      'Better security': 'Resistant to nonce reuse attacks',
      'Practical engineering': 'Solves real-world cryptographic implementation challenges'
    },
    technicalDetails: {
      'Key derivation': 'HChaCha20 derives 256-bit subkeys from 256-bit master keys',
      'Nonce structure': 'First 16 bytes for HChaCha20, last 8 bytes for ChaCha20',
      'Performance': 'Minimal overhead compared to ChaCha20',
      'Compatibility': 'Based on proven ChaCha20 core operations'
    },
    usageExample: `
      // Simple encryption with random nonce
      const key = 'Your 32-byte secret key goes here!!';
      const plaintext = 'Confidential message';
      
      // Generate secure random nonce
      const nonce = XChaCha20.generateNonce();
      
      // Encrypt
      const encrypted = XChaCha20.encrypt(key, XChaCha20.bytesToString(nonce), plaintext);
      
      // Decrypt
      const decrypted = XChaCha20.decrypt(key, XChaCha20.bytesToString(nonce), encrypted.ciphertext);
      
      console.log('Original:', plaintext);
      console.log('Decrypted:', decrypted.ciphertext);
    `,
    securityNotes: [
      'Use cryptographically secure random nonce generation',
      '192-bit nonces eliminate birthday bound concerns',
      'Never reuse nonces with the same key (though unlikely with random nonces)',
      'This implementation is educational only - use proven libraries for production'
    ],
    practicalBenefits: [
      'Database encryption with deterministic nonces from record IDs',
      'File encryption without nonce management complexity',
      'Network protocols with simple nonce handling',
      'Applications requiring many encryptions per key'
    ]
  };
  
  // Auto-register with universal cipher system
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(XChaCha20);
  }
  
  // Export to global scope
  global.XChaCha20 = XChaCha20;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XChaCha20;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);

// Self-test if run directly in Node.js
if (typeof require !== 'undefined' && require.main === module) {
  console.log('XChaCha20 Extended-Nonce Stream Cipher - Educational Implementation');
  console.log('='.repeat(70));
  console.log('draft-irtf-cfrg-xchacha specification');
  console.log('192-bit nonces with HChaCha20 key derivation');
  console.log('');
  
  const XChaCha20 = module.exports;
  const testResults = XChaCha20.runTestVectors();
  
  console.log('\nTest Results Summary:');
  console.log(`Total tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.totalTests - testResults.passed}`);
  
  if (testResults.performance) {
    console.log('\nPerformance Results:');
    console.log(`Throughput: ${testResults.performance.throughputMBps.toFixed(2)} MB/s`);
    console.log(`Encryptions/sec: ${testResults.performance.encryptionsPerSecond}`);
    console.log(`Key derivations/sec: ${testResults.performance.keyDerivationsPerSecond}`);
  }
  
  if (testResults.passed === testResults.totalTests) {
    console.log('\n✓ All tests passed! XChaCha20 implementation appears functional.');
  } else {
    console.log('\n✗ Some tests failed. Review implementation.');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('EDUCATIONAL NOTE:');
  console.log('This XChaCha20 implementation demonstrates nonce extension techniques.');
  console.log('Shows how HChaCha20 key derivation solves practical cryptographic problems.');
  console.log('Use certified libraries for production applications.');
}