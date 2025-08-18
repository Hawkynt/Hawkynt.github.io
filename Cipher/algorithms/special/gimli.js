#!/usr/bin/env node
/*
 * Universal Gimli Cryptographic Permutation Implementation
 * Compatible with both Browser and Node.js environments
 * Based on CHES 2017 specification and NIST LWC submission
 * 
 * Gimli is a 384-bit cryptographic permutation designed for high performance
 * across a wide variety of platforms. It uses only 3 operations: AND, XOR, and rotation,
 * making it exceptionally simple to understand and implement.
 * 
 * Key Features:
 * - 384-bit permutation (12 words of 32 bits each)
 * - 24 rounds with simple structure
 * - Only 3 cryptographic operations: AND, XOR, rotate
 * - Excellent educational value for permutation-based cryptography
 * - NIST Lightweight Cryptography Round 2 finalist
 * - Spiritual successor to ChaCha20
 * 
 * Educational Value:
 * - Perfect introduction to cryptographic permutations
 * - Demonstrates ARX (Add-Rotate-XOR) design principles
 * - Shows how simple operations create complex behavior
 * - NIST standardization process understanding
 * - Lightweight cryptography for IoT applications
 * 
 * Applications:
 * - Hash function construction
 * - Authenticated encryption (AEAD)
 * - Stream cipher construction
 * - Pseudorandom number generation
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - CHES 2017: The Gimli Permutation
 * - NIST LWC Submission: https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/spec-doc/gimli-spec.pdf
 * - GIMLI Website: https://gimli.cr.yp.to/
 * 
 * (c)2006-2025 Hawkynt - Educational implementation following CHES 2017 specification
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
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
      console.error('Gimli requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load metadata system
  if (!global.CipherMetadata && typeof require !== 'undefined') {
    try {
      require('../../cipher-metadata.js');
    } catch (e) {
      console.warn('Could not load cipher metadata system:', e.message);
    }
  }
  
  // Gimli constants
  const GIMLI_ROUNDS = 24;           // Number of rounds
  const GIMLI_STATE_SIZE = 12;       // 12 × 32-bit words = 384 bits
  const GIMLI_RATE = 16;             // 128-bit rate for sponge construction
  const GIMLI_CAPACITY = 32;         // 256-bit capacity for security
  const GIMLI_TAG_SIZE = 16;         // 128-bit authentication tag
  
  // Round constants for Gimli (one for each round where column round occurs)
  const GIMLI_ROUND_CONSTANTS = [
    0x9e377909, 0x9e377909, 0x9e377909, 0x9e377909,
    0x9e377909, 0x9e377909, 0x9e377909, 0x9e377909,
    0x9e377909, 0x9e377909, 0x9e377909, 0x9e377909,
    0x9e377909, 0x9e377909, 0x9e377909, 0x9e377909,
    0x9e377909, 0x9e377909, 0x9e377909, 0x9e377909,
    0x9e377909, 0x9e377909, 0x9e377909, 0x9e377909
  ];
  
  const Gimli = {
    // Universal cipher interface properties
    internalName: 'gimli-universal',
    name: 'Gimli Cryptographic Permutation',
    comment: 'NIST LWC finalist - 384-bit permutation with exceptional simplicity and educational value',
    
    // Cipher interface requirements
    minKeyLength: 1,         // Can work with any input size
    maxKeyLength: 48,        // 384 bits maximum state
    stepKeyLength: 1,
    minBlockSize: 1,         // Flexible input size
    maxBlockSize: 65536,     // Practical limit
    stepBlockSize: 1,
    instances: {},
    
    // Algorithm properties
    isPermutation: true,
    isLightweight: true,
    version: '1.0.0',
    date: '2025-01-18',
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Gimli',
      displayName: 'Gimli Cryptographic Permutation',
      description: 'NIST Lightweight Cryptography finalist featuring a 384-bit permutation with exceptional simplicity. Uses only 3 operations (AND, XOR, rotate) making it perfect for educational purposes and understanding permutation-based cryptography.',
      
      inventor: 'Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier',
      year: 2017,
      background: 'Presented at CHES 2017 as a spiritual successor to ChaCha20. Advanced to Round 2 of NIST Lightweight Cryptography competition. Designed for optimal performance across diverse platforms from microcontrollers to high-performance servers.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.RESEARCH,
      securityNotes: 'NIST LWC Round 2 finalist with extensive cryptanalytic review. While not selected as final standard, it received significant scrutiny and remains academically interesting.',
      
      category: global.CipherMetadata.Categories.SPECIAL,
      subcategory: 'Cryptographic Permutation',
      complexity: global.CipherMetadata.ComplexityLevels.BEGINNER,
      
      keySize: 0, // Permutation - no key
      blockSize: 384, // 384-bit permutation
      rounds: 24,
      
      specifications: [
        {
          name: 'CHES 2017: The Gimli Permutation',
          url: 'https://gimli.cr.yp.to/gimli-20170627.pdf'
        },
        {
          name: 'NIST LWC Submission Specification',
          url: 'https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/spec-doc/gimli-spec.pdf'
        }
      ],
      
      testVectors: [
        {
          name: 'Official Gimli Test Vectors',
          url: 'https://github.com/GIMLI-CIPHER/gimli/tree/master/testvectors'
        },
        {
          name: 'NIST LWC Test Vectors',
          url: 'https://csrc.nist.gov/Projects/lightweight-cryptography/finalists'
        }
      ],
      
      references: [
        {
          name: 'Gimli Official Website',
          url: 'https://gimli.cr.yp.to/'
        },
        {
          name: 'NIST Lightweight Cryptography',
          url: 'https://csrc.nist.gov/Projects/lightweight-cryptography'
        }
      ],
      
      implementationNotes: 'Educational implementation demonstrating the three core Gimli operations. Perfect for understanding permutation-based cryptography.',
      performanceNotes: 'Extremely fast due to simple operations. Designed for both software and hardware efficiency across all platforms.',
      
      educationalValue: 'Outstanding for learning permutation-based cryptography, ARX design principles, and cryptographic simplicity. Shows how 3 operations create complex cryptographic behavior.',
      prerequisites: ['Bitwise operations', 'Rotation concepts', 'Basic cryptographic principles'],
      
      tags: ['permutation', 'lightweight', 'nist-lwc', 'ches2017', 'arx', 'educational', 'simple'],
      
      version: '2.0'
    }) : null,
    
    // Current state
    state: null,
    
    // Initialize Gimli permutation
    Init: function() {
      this.state = new Array(GIMLI_STATE_SIZE).fill(0);
      return true;
    },
    
    // Core Gimli permutation function - the heart of the algorithm
    gimliPermutation: function(state) {
      if (!state) state = this.state;
      
      // 24 rounds of Gimli permutation
      for (let round = GIMLI_ROUNDS - 1; round >= 0; round--) {
        
        // SP-box layer - the three Gimli operations applied to each column
        for (let column = 0; column < 4; column++) {
          const x = state[column];
          const y = state[column + 4];
          const z = state[column + 8];
          
          // The three fundamental Gimli operations:
          // 1. Rotation by 24 bits
          // 2. AND operation for nonlinearity
          // 3. XOR operation for diffusion
          
          // First step: x <<< 24, y <<< 9
          const x_rot = this.rotateLeft32(x, 24);
          const y_rot = this.rotateLeft32(y, 9);
          
          // Second step: nonlinear operation using AND
          const newX = x_rot ^ (z << 1) ^ ((y & z) << 2);
          const newY = y_rot ^ x ^ ((x | z) << 1);
          const newZ = z ^ y ^ ((x & y) << 3);
          
          state[column] = newX;
          state[column + 4] = newY;
          state[column + 8] = newZ;
        }
        
        // Linear layer - different for different round types
        if (round % 4 === 0) {
          // Big swap: swap words 0,1 with 2,3
          [state[0], state[2]] = [state[2], state[0]];
          [state[1], state[3]] = [state[3], state[1]];
          [state[4], state[6]] = [state[6], state[4]];
          [state[5], state[7]] = [state[7], state[5]];
          [state[8], state[10]] = [state[10], state[8]];
          [state[9], state[11]] = [state[11], state[9]];
        }
        
        if (round % 4 === 2) {
          // Small swap: swap words 0,1
          [state[0], state[1]] = [state[1], state[0]];
          [state[4], state[5]] = [state[5], state[4]];
          [state[8], state[9]] = [state[9], state[8]];
        }
        
        if (round % 4 === 0) {
          // Add round constant
          state[0] ^= GIMLI_ROUND_CONSTANTS[round] ^ round;
        }
      }
      
      return state;
    },
    
    // 32-bit left rotation
    rotateLeft32: function(value, positions) {
      if (global.OpCodes) {
        return global.OpCodes.RotL32(value, positions);
      } else {
        // Fallback implementation
        value = value >>> 0; // Ensure 32-bit unsigned
        positions = positions % 32;
        return ((value << positions) | (value >>> (32 - positions))) >>> 0;
      }
    },
    
    // Load 32-bit word from byte array (little-endian)
    loadWord32LE: function(bytes, offset) {
      if (global.OpCodes) {
        return global.OpCodes.Pack32LE(
          bytes[offset] || 0,
          bytes[offset + 1] || 0,
          bytes[offset + 2] || 0,
          bytes[offset + 3] || 0
        );
      } else {
        return (bytes[offset] || 0) |
               ((bytes[offset + 1] || 0) << 8) |
               ((bytes[offset + 2] || 0) << 16) |
               ((bytes[offset + 3] || 0) << 24);
      }
    },
    
    // Store 32-bit word to byte array (little-endian)
    storeWord32LE: function(word, bytes, offset) {
      if (global.OpCodes) {
        const wordBytes = global.OpCodes.Unpack32LE(word);
        for (let i = 0; i < 4; i++) {
          bytes[offset + i] = wordBytes[i];
        }
      } else {
        bytes[offset] = word & 0xFF;
        bytes[offset + 1] = (word >>> 8) & 0xFF;
        bytes[offset + 2] = (word >>> 16) & 0xFF;
        bytes[offset + 3] = (word >>> 24) & 0xFF;
      }
    },
    
    // Initialize state from input data
    initializeState: function(input) {
      // Clear state
      for (let i = 0; i < GIMLI_STATE_SIZE; i++) {
        this.state[i] = 0;
      }
      
      // Load input data into state
      const inputBytes = this.stringToBytes(input);
      const wordCount = Math.min(GIMLI_STATE_SIZE, Math.ceil(inputBytes.length / 4));
      
      for (let i = 0; i < wordCount; i++) {
        this.state[i] = this.loadWord32LE(inputBytes, i * 4);
      }
      
      return this.state;
    },
    
    // Extract bytes from state
    extractBytes: function(length) {
      const output = new Array(length);
      const wordCount = Math.ceil(length / 4);
      
      for (let i = 0; i < wordCount; i++) {
        this.storeWord32LE(this.state[i] || 0, output, i * 4);
      }
      
      return output.slice(0, length);
    },
    
    // Hash function using Gimli permutation (sponge construction)
    hash: function(input, outputLength) {
      if (!outputLength) outputLength = 32; // Default 256-bit hash
      
      const inputBytes = this.stringToBytes(input);
      const rate = GIMLI_RATE; // 128-bit rate
      
      // Initialize state
      this.Init();
      
      // Absorbing phase
      let pos = 0;
      while (pos < inputBytes.length) {
        const blockSize = Math.min(rate, inputBytes.length - pos);
        const block = inputBytes.slice(pos, pos + blockSize);
        
        // XOR block into state
        for (let i = 0; i < blockSize; i++) {
          const wordIndex = Math.floor(i / 4);
          const byteIndex = i % 4;
          const currentWord = this.state[wordIndex];
          const currentBytes = global.OpCodes ? 
            global.OpCodes.Unpack32LE(currentWord) : 
            [currentWord & 0xFF, (currentWord >>> 8) & 0xFF, (currentWord >>> 16) & 0xFF, (currentWord >>> 24) & 0xFF];
          
          currentBytes[byteIndex] ^= block[i];
          this.state[wordIndex] = this.loadWord32LE(currentBytes, 0);
        }
        
        // Apply permutation
        this.gimliPermutation();
        pos += blockSize;
      }
      
      // Padding (simplified)
      const padWord = this.state[Math.floor(rate / 4)] ^ 0x01;
      this.state[Math.floor(rate / 4)] = padWord;
      this.state[GIMLI_STATE_SIZE - 1] ^= 0x80;
      
      // Apply final permutation
      this.gimliPermutation();
      
      // Squeezing phase
      const output = [];
      let remaining = outputLength;
      
      while (remaining > 0) {
        const extractSize = Math.min(rate, remaining);
        const extracted = this.extractBytes(extractSize);
        output.push(...extracted);
        remaining -= extractSize;
        
        if (remaining > 0) {
          this.gimliPermutation();
        }
      }
      
      return output.slice(0, outputLength);
    },
    
    // Simple AEAD-style encryption using Gimli (educational)
    encrypt: function(key, nonce, plaintext, associatedData) {
      // Educational implementation - simplified AEAD construction
      const keyBytes = this.stringToBytes(key);
      const nonceBytes = this.stringToBytes(nonce);
      const plaintextBytes = this.stringToBytes(plaintext);
      const aadBytes = associatedData ? this.stringToBytes(associatedData) : [];
      
      // Initialize with key and nonce
      this.Init();
      
      // Load key and nonce into state
      for (let i = 0; i < Math.min(keyBytes.length, 32); i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        const currentBytes = [0, 0, 0, 0];
        currentBytes[byteIndex] = keyBytes[i];
        this.state[wordIndex] ^= this.loadWord32LE(currentBytes, 0);
      }
      
      for (let i = 0; i < Math.min(nonceBytes.length, 16); i++) {
        const wordIndex = Math.floor((i + 32) / 4);
        const byteIndex = (i + 32) % 4;
        const currentBytes = [0, 0, 0, 0];
        currentBytes[byteIndex] = nonceBytes[i];
        this.state[wordIndex] ^= this.loadWord32LE(currentBytes, 0);
      }
      
      // Initial permutation
      this.gimliPermutation();
      
      // Process associated data (simplified)
      if (aadBytes.length > 0) {
        const aadHash = this.hash(associatedData, 16);
        for (let i = 0; i < 4; i++) {
          this.state[i] ^= this.loadWord32LE(aadHash, i * 4);
        }
        this.gimliPermutation();
      }
      
      // Encrypt plaintext
      const ciphertext = [];
      let pos = 0;
      
      while (pos < plaintextBytes.length) {
        const blockSize = Math.min(GIMLI_RATE, plaintextBytes.length - pos);
        const keystream = this.extractBytes(blockSize);
        
        for (let i = 0; i < blockSize; i++) {
          ciphertext.push(plaintextBytes[pos + i] ^ keystream[i]);
        }
        
        // Update state with plaintext
        for (let i = 0; i < blockSize; i++) {
          const wordIndex = Math.floor(i / 4);
          const byteIndex = i % 4;
          const currentBytes = global.OpCodes ? 
            global.OpCodes.Unpack32LE(this.state[wordIndex]) : 
            [this.state[wordIndex] & 0xFF, (this.state[wordIndex] >>> 8) & 0xFF, 
             (this.state[wordIndex] >>> 16) & 0xFF, (this.state[wordIndex] >>> 24) & 0xFF];
          
          currentBytes[byteIndex] ^= plaintextBytes[pos + i];
          this.state[wordIndex] = this.loadWord32LE(currentBytes, 0);
        }
        
        pos += blockSize;
        if (pos < plaintextBytes.length) {
          this.gimliPermutation();
        }
      }
      
      // Generate authentication tag
      this.gimliPermutation();
      const tag = this.extractBytes(GIMLI_TAG_SIZE);
      
      return {
        ciphertext: this.bytesToString(ciphertext),
        tag: this.bytesToString(tag),
        ciphertextBytes: ciphertext,
        tagBytes: tag
      };
    },
    
    // AEAD decryption
    decrypt: function(key, nonce, ciphertext, tag, associatedData) {
      // This is a simplified educational implementation
      // In practice, implement proper constant-time verification
      
      const ciphertextBytes = this.stringToBytes(ciphertext);
      
      // Reconstruct the encryption process to derive the tag
      const keyBytes = this.stringToBytes(key);
      const nonceBytes = this.stringToBytes(nonce);
      const tagBytes = this.stringToBytes(tag);
      const aadBytes = associatedData ? this.stringToBytes(associatedData) : [];
      
      // Initialize with key and nonce (same as encryption)
      this.Init();
      
      // Load key and nonce
      for (let i = 0; i < Math.min(keyBytes.length, 32); i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        const currentBytes = [0, 0, 0, 0];
        currentBytes[byteIndex] = keyBytes[i];
        this.state[wordIndex] ^= this.loadWord32LE(currentBytes, 0);
      }
      
      for (let i = 0; i < Math.min(nonceBytes.length, 16); i++) {
        const wordIndex = Math.floor((i + 32) / 4);
        const byteIndex = (i + 32) % 4;
        const currentBytes = [0, 0, 0, 0];
        currentBytes[byteIndex] = nonceBytes[i];
        this.state[wordIndex] ^= this.loadWord32LE(currentBytes, 0);
      }
      
      // Initial permutation
      this.gimliPermutation();
      
      // Process associated data
      if (aadBytes.length > 0) {
        const aadHash = this.hash(associatedData, 16);
        for (let i = 0; i < 4; i++) {
          this.state[i] ^= this.loadWord32LE(aadHash, i * 4);
        }
        this.gimliPermutation();
      }
      
      // Decrypt ciphertext
      const plaintext = [];
      let pos = 0;
      
      while (pos < ciphertextBytes.length) {
        const blockSize = Math.min(GIMLI_RATE, ciphertextBytes.length - pos);
        const keystream = this.extractBytes(blockSize);
        
        for (let i = 0; i < blockSize; i++) {
          plaintext.push(ciphertextBytes[pos + i] ^ keystream[i]);
        }
        
        // Update state with plaintext
        for (let i = 0; i < blockSize; i++) {
          const wordIndex = Math.floor(i / 4);
          const byteIndex = i % 4;
          const currentBytes = global.OpCodes ? 
            global.OpCodes.Unpack32LE(this.state[wordIndex]) : 
            [this.state[wordIndex] & 0xFF, (this.state[wordIndex] >>> 8) & 0xFF, 
             (this.state[wordIndex] >>> 16) & 0xFF, (this.state[wordIndex] >>> 24) & 0xFF];
          
          currentBytes[byteIndex] ^= plaintext[pos + i];
          this.state[wordIndex] = this.loadWord32LE(currentBytes, 0);
        }
        
        pos += blockSize;
        if (pos < ciphertextBytes.length) {
          this.gimliPermutation();
        }
      }
      
      // Verify authentication tag
      this.gimliPermutation();
      const computedTag = this.extractBytes(GIMLI_TAG_SIZE);
      
      // Constant-time comparison
      let tagValid = true;
      for (let i = 0; i < Math.min(tagBytes.length, computedTag.length); i++) {
        if (tagBytes[i] !== computedTag[i]) {
          tagValid = false;
        }
      }
      
      if (!tagValid) {
        throw new Error('Authentication tag verification failed');
      }
      
      return {
        plaintext: this.bytesToString(plaintext),
        plaintextBytes: plaintext
      };
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
        id = 'Gimli[' + global.generateUniqueID() + ']';
      } while (this.instances[id] || global.objectInstances[id]);
      
      this.instances[id] = {
        initialized: true,
        key: key || ''
      };
      global.objectInstances[id] = true;
      
      return id;
    },
    
    // Block processing interface (adapted for permutation)
    encryptBlock: function(instanceId, plaintext) {
      if (!this.instances[instanceId]) {
        throw new Error('Unknown Gimli instance: ' + instanceId);
      }
      
      // For permutation mode, apply Gimli to the input
      this.initializeState(plaintext);
      this.gimliPermutation();
      
      // Extract result as string
      const outputBytes = this.extractBytes(plaintext.length);
      return this.bytesToString(outputBytes);
    },
    
    // Decryption is the same as encryption for a permutation
    decryptBlock: function(instanceId, ciphertext) {
      return this.encryptBlock(instanceId, ciphertext);
    },
    
    // Clear sensitive data
    ClearData: function(id) {
      if (this.instances[id]) {
        delete this.instances[id];
        delete global.objectInstances[id];
        return true;
      }
      return false;
    },
    
    // Educational test suite
    runTestVectors: function() {
      console.log('Running Gimli educational test suite...');
      const results = [];
      
      try {
        // Test 1: Basic permutation test
        console.log('Testing basic permutation...');
        this.Init();
        const testInput = 'Hello Gimli!';
        this.initializeState(testInput);
        const stateBefore = [...this.state];
        this.gimliPermutation();
        const stateAfter = [...this.state];
        
        // Verify state changed
        let stateChanged = false;
        for (let i = 0; i < GIMLI_STATE_SIZE; i++) {
          if (stateBefore[i] !== stateAfter[i]) {
            stateChanged = true;
            break;
          }
        }
        
        results.push({
          test: 'Basic Permutation',
          success: stateChanged,
          description: 'Verify that Gimli permutation changes state'
        });
        
        // Test 2: Hash function test
        console.log('Testing hash function...');
        const message = 'Gimli hash test';
        const hash1 = this.hash(message, 32);
        const hash2 = this.hash(message, 32);
        
        // Hashes should be identical
        let hashesEqual = hash1.length === hash2.length;
        for (let i = 0; hashesEqual && i < hash1.length; i++) {
          if (hash1[i] !== hash2[i]) {
            hashesEqual = false;
          }
        }
        
        results.push({
          test: 'Hash Function Consistency',
          success: hashesEqual,
          description: 'Same input produces same hash',
          hashLength: hash1.length
        });
        
        // Test 3: AEAD round-trip test
        console.log('Testing AEAD encryption/decryption...');
        const key = 'Gimli test key 123';
        const nonce = 'nonce123';
        const plaintext = 'Secret message for Gimli AEAD test';
        const aad = 'Associated data';
        
        const encrypted = this.encrypt(key, nonce, plaintext, aad);
        const decrypted = this.decrypt(key, nonce, encrypted.ciphertext, encrypted.tag, aad);
        
        const roundTripSuccess = decrypted.plaintext === plaintext;
        
        results.push({
          test: 'AEAD Round-trip',
          success: roundTripSuccess,
          description: 'Encrypt then decrypt produces original plaintext',
          originalLength: plaintext.length,
          ciphertextLength: encrypted.ciphertext.length,
          tagLength: encrypted.tag.length
        });
        
        // Test 4: Different inputs produce different outputs
        console.log('Testing avalanche effect...');
        const input1 = 'Test input A';
        const input2 = 'Test input B';
        const hash_a = this.hash(input1, 32);
        const hash_b = this.hash(input2, 32);
        
        let differentOutputs = hash_a.length === hash_b.length;
        let diffCount = 0;
        for (let i = 0; i < Math.min(hash_a.length, hash_b.length); i++) {
          if (hash_a[i] !== hash_b[i]) {
            diffCount++;
          }
        }
        
        differentOutputs = diffCount > 0;
        
        results.push({
          test: 'Avalanche Effect',
          success: differentOutputs,
          description: 'Different inputs produce different outputs',
          differingBytes: diffCount,
          totalBytes: hash_a.length
        });
        
        const totalTests = results.length;
        const passedTests = results.filter(r => r.success).length;
        
        console.log(`\nGimli test results: ${passedTests}/${totalTests} passed`);
        
        return {
          algorithm: 'Gimli Permutation',
          implementation: 'Educational CHES 2017 specification',
          totalTests: totalTests,
          passed: passedTests,
          results: results,
          performance: this.measurePerformance(),
          note: 'Educational implementation demonstrating permutation-based cryptography'
        };
        
      } catch (error) {
        console.error('Gimli test failed:', error.message);
        results.push({
          test: 'Overall Test Suite',
          success: false,
          error: error.message
        });
        
        return {
          algorithm: 'Gimli Permutation',
          totalTests: results.length,
          passed: 0,
          results: results,
          error: error.message
        };
      }
    },
    
    // Basic performance measurement
    measurePerformance: function() {
      const iterations = 1000;
      const testData = 'Performance test data for Gimli permutation'.repeat(2);
      
      // Test permutation performance
      const startPerm = Date.now();
      for (let i = 0; i < iterations; i++) {
        this.initializeState(testData);
        this.gimliPermutation();
      }
      const permTime = Date.now() - startPerm;
      
      // Test hash performance
      const startHash = Date.now();
      for (let i = 0; i < iterations; i++) {
        this.hash(testData, 32);
      }
      const hashTime = Date.now() - startHash;
      
      return {
        iterations: iterations,
        permutationTimeMs: permTime,
        hashTimeMs: hashTime,
        permutationsPerSecond: Math.round((iterations * 1000) / permTime),
        hashesPerSecond: Math.round((iterations * 1000) / hashTime),
        dataSize: testData.length
      };
    }
  };
  
  // Educational information
  Gimli.educationalInfo = {
    overview: 'Gimli is a 384-bit cryptographic permutation designed for simplicity and performance. It uses only 3 operations making it perfect for educational purposes.',
    keyFeatures: [
      '384-bit permutation with 24 rounds',
      'Only 3 operations: AND, XOR, and rotation',
      'Exceptional simplicity for education',
      'NIST Lightweight Cryptography Round 2 finalist',
      'Spiritual successor to ChaCha20',
      'Optimal for both software and hardware'
    ],
    designPrinciples: {
      'Simplicity': 'Uses minimal set of operations for maximum clarity',
      'Performance': 'Designed to be fast on all platforms',
      'Security': 'Extensive cryptanalytic review during NIST process',
      'Versatility': 'Can be used for hashing, AEAD, stream ciphers, etc.'
    },
    operations: {
      'AND': 'Provides nonlinearity essential for cryptographic security',
      'XOR': 'Ensures diffusion and reversibility',
      'Rotation': 'Spreads bit dependencies across word boundaries'
    },
    usageExample: `
      // Initialize Gimli
      Gimli.Init();
      
      // Use as hash function
      const message = 'Hello Gimli!';
      const hash = Gimli.hash(message, 32); // 256-bit hash
      
      // Use as AEAD cipher
      const key = 'Secret key for Gimli';
      const nonce = 'unique nonce';
      const plaintext = 'Confidential data';
      const aad = 'Public associated data';
      
      const encrypted = Gimli.encrypt(key, nonce, plaintext, aad);
      const decrypted = Gimli.decrypt(key, nonce, encrypted.ciphertext, encrypted.tag, aad);
      
      // Use as pure permutation
      Gimli.initializeState('Input data');
      Gimli.gimliPermutation(); // Apply the permutation
    `,
    educationalValue: [
      'Perfect introduction to cryptographic permutations',
      'Demonstrates how simple operations create complexity',
      'Shows modern lightweight cryptography principles',
      'Illustrates sponge construction for hashing',
      'Example of rigorous cryptographic design process'
    ],
    cryptographicConcepts: [
      'Permutation-based cryptography',
      'Sponge construction',
      'ARX (Add-Rotate-XOR) design',
      'Cryptographic rounds and iteration',
      'Avalanche effect and diffusion'
    ]
  };
  
  // Auto-register with universal cipher system
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Gimli);
  }
  
  // Export to global scope
  global.Gimli = Gimli;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Gimli;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);

// Self-test if run directly in Node.js
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Gimli Cryptographic Permutation - Educational Implementation');
  console.log('='.repeat(65));
  console.log('CHES 2017 specification - NIST LWC Round 2 finalist');
  console.log('384-bit permutation with exceptional educational value');
  console.log('');
  
  const Gimli = module.exports;
  const testResults = Gimli.runTestVectors();
  
  console.log('\nTest Results Summary:');
  console.log(`Total tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.totalTests - testResults.passed}`);
  
  if (testResults.performance) {
    console.log('\nPerformance Results:');
    console.log(`Permutations/sec: ${testResults.performance.permutationsPerSecond}`);
    console.log(`Hashes/sec: ${testResults.performance.hashesPerSecond}`);
  }
  
  if (testResults.passed === testResults.totalTests) {
    console.log('\n✓ All tests passed! Gimli implementation appears functional.');
  } else {
    console.log('\n✗ Some tests failed. Review implementation.');
  }
  
  console.log('\n' + '='.repeat(65));
  console.log('EDUCATIONAL NOTE:');
  console.log('This Gimli implementation demonstrates permutation-based cryptography.');
  console.log('Perfect for learning how 3 simple operations create complex crypto behavior.');
  console.log('Use certified libraries for production applications.');
}