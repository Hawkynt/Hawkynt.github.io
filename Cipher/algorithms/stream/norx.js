/*
 * NORX Implementation - Authenticated Encryption with Associated Data
 * CAESAR Competition Finalist (High-Performance Category)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const NORX = {
    name: "NORX",
    description: "Authenticated encryption with associated data (AEAD) algorithm designed for high performance. CAESAR competition finalist optimized for 64-bit platforms with parallel processing support.",
    inventor: "Jean-Philippe Aumasson, Philipp Jovanovic, Samuel Neves",
    year: 2014,
    country: "Multi-national",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: "finalist",
    securityNotes: "CAESAR competition finalist with extensive cryptanalysis. Designed for high-performance applications requiring authenticated encryption.",
    
    documentation: [
      {text: "CAESAR Submission", uri: "https://competitions.cr.yp.to/round3/norxv30.pdf"},
      {text: "NORX Official Website", uri: "https://norx.io/"},
      {text: "Algorithm Specification", uri: "https://norx.io/data/norx.pdf"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/norx/norx"},
      {text: "CAESAR Benchmarks", uri: "https://bench.cr.yp.to/results-aead.html"},
      {text: "Cryptanalysis Summary", uri: "https://eprint.iacr.org/2015/1154"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Theoretical Attacks",
        text: "Some theoretical distinguishing attacks on reduced rounds",
        mitigation: "Full-round implementation provides adequate security margin"
      },
      {
        type: "Side-Channel Susceptibility",
        text: "Potential timing attack vulnerabilities in software implementations",
        mitigation: "Use constant-time implementation techniques"
      }
    ],
    
    tests: [
      {
        text: "NORX64-4-1 Test Vector 1 (Empty)",
        uri: "https://norx.io/data/norx.pdf",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        header: OpCodes.Hex8ToBytes(""),
        payload: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("E4AB1492C9F4A9A1E02654F64232BAAE58A4E6C2FC30CB6E6D43CC8CAE55C22F")
      },
      {
        text: "NORX64-4-1 Test Vector 2 (With Data)",
        uri: "https://norx.io/data/norx.pdf",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        header: OpCodes.Hex8ToBytes("0001020304050607"),
        payload: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F"),
        expectedCiphertext: OpCodes.Hex8ToBytes("3C84C9AC903DCC55C1B5AAEC8EB4D50E0E51EC1A1D3C3A8CBAB06FF58F08F9A6E9F6A97C7E5A07618623C80EC80FA940"),
        expectedTag: OpCodes.Hex8ToBytes("F0F24AB3904BD26B1F0203D10BD4C76A90DE5F88E5E6A9ADDABF2F7DFB3847D1")
      },
      {
        text: "NORX64-4-1 Test Vector 3 (Header Only)",
        uri: "https://norx.io/data/norx.pdf",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        header: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        payload: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("88B7BE82E2FF5DB12834AD77F67BB7E04A61DBDE30F6ECFEB6F1A73A5B92A554")
      }
    ],

    // Legacy interface properties
    internalName: 'norx',
    minKeyLength: 32,
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 32,
    blockSize: 64,
    
    // Algorithm metadata
    isStreamCipher: true,
    isBlockCipher: false,
    isAEAD: true,
    complexity: 'Medium',
    family: 'NORX',
    category: 'Authenticated-Encryption',
    
    // NORX constants
    ROUNDS: 4,
    PARALLELISM: 1,
    TAG_SIZE: 32,
    NONCE_SIZE: 16,
    CAPACITY: 256,
    
    // NORX rotation constants
    R0: 8, R1: 19, R2: 40, R3: 63,
    
    // Domain separation constants
    HEADER_TAG: 0x01,
    PAYLOAD_TAG: 0x02,
    TRAILER_TAG: 0x04,
    FINAL_TAG: 0x08,
    BRANCH_TAG: 0x10,
    MERGE_TAG: 0x20,
    
    // Initialize NORX
    Init: function() {
      this.state = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 32) {
        throw new Error('NORX requires exactly 32-byte (256-bit) key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'norx-64-4-1-' + Math.random().toString(36).substr(2, 9);
    },
    
    // NORX G function (quarter round)
    norxG: function(a, b, c, d) {
      // Addition
      a = (a + b) >>> 0;
      d = (d ^ a) >>> 0;
      d = ((d << (32 - this.R0)) | (d >>> this.R0)) >>> 0;
      
      c = (c + d) >>> 0;
      b = (b ^ c) >>> 0;
      b = ((b << (32 - this.R1)) | (b >>> this.R1)) >>> 0;
      
      a = (a + b) >>> 0;
      d = (d ^ a) >>> 0;
      d = ((d << (32 - this.R2)) | (d >>> this.R2)) >>> 0;
      
      c = (c + d) >>> 0;
      b = (b ^ c) >>> 0;
      b = ((b << (32 - this.R3)) | (b >>> this.R3)) >>> 0;
      
      return {a: a, b: b, c: c, d: d};
    },
    
    // NORX F function (full permutation)
    norxF: function(state) {
      // Column step
      let result = this.norxG(state[0], state[4], state[8], state[12]);
      state[0] = result.a; state[4] = result.b; state[8] = result.c; state[12] = result.d;
      
      result = this.norxG(state[1], state[5], state[9], state[13]);
      state[1] = result.a; state[5] = result.b; state[9] = result.c; state[13] = result.d;
      
      result = this.norxG(state[2], state[6], state[10], state[14]);
      state[2] = result.a; state[6] = result.b; state[10] = result.c; state[14] = result.d;
      
      result = this.norxG(state[3], state[7], state[11], state[15]);
      state[3] = result.a; state[7] = result.b; state[11] = result.c; state[15] = result.d;
      
      // Diagonal step
      result = this.norxG(state[0], state[5], state[10], state[15]);
      state[0] = result.a; state[5] = result.b; state[10] = result.c; state[15] = result.d;
      
      result = this.norxG(state[1], state[6], state[11], state[12]);
      state[1] = result.a; state[6] = result.b; state[11] = result.c; state[12] = result.d;
      
      result = this.norxG(state[2], state[7], state[8], state[13]);
      state[2] = result.a; state[7] = result.b; state[8] = result.c; state[13] = result.d;
      
      result = this.norxG(state[3], state[4], state[9], state[14]);
      state[3] = result.a; state[4] = result.b; state[9] = result.c; state[14] = result.d;
    },
    
    // NORX permutation (multiple rounds)
    norxPermute: function(state, rounds) {
      for (let i = 0; i < rounds; i++) {
        this.norxF(state);
      }
    },
    
    // Initialize NORX state
    initializeState: function(key, nonce) {
      if (nonce.length !== 16) {
        throw new Error('NORX requires 16-byte nonce');
      }
      
      // Initialize 16-word (64-byte) state
      const state = new Array(16);
      
      // Load key (256 bits = 8 words)
      for (let i = 0; i < 8; i++) {
        state[i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1], 
          key[i * 4 + 2], key[i * 4 + 3]
        );
      }
      
      // Load nonce (128 bits = 4 words)
      for (let i = 0; i < 4; i++) {
        state[8 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }
      
      // Initialize constants
      state[12] = 0x243F6A88; // First 32 bits of pi
      state[13] = 0x85A308D3; // Next 32 bits of pi
      state[14] = 0x13198A2E; // Parameter block
      state[15] = 0x03707344; // Version and parallelism
      
      // Run initialization permutation
      this.norxPermute(state, 2 * this.ROUNDS);
      
      return state;
    },
    
    // Absorb data into state
    absorb: function(state, data, tag) {
      const blockSize = 40; // 320 bits = 10 words absorption rate
      
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize);
        
        // Pad incomplete blocks
        while (block.length < blockSize) {
          block.push(0);
        }
        
        // XOR block into state
        for (let j = 0; j < 10; j++) {
          if (j * 4 < block.length) {
            const word = OpCodes.Pack32LE(
              block[j * 4] || 0, block[j * 4 + 1] || 0,
              block[j * 4 + 2] || 0, block[j * 4 + 3] || 0
            );
            state[j] ^= word;
          }
        }
        
        // Add domain separation
        state[15] ^= tag;
        
        // Apply permutation
        this.norxPermute(state, this.ROUNDS);
      }
      
      return state;
    },
    
    // Encrypt data
    encrypt: function(state, plaintext) {
      const ciphertext = [];
      const blockSize = 40; // 320 bits = 10 words
      
      for (let i = 0; i < plaintext.length; i += blockSize) {
        const block = plaintext.slice(i, i + blockSize);
        
        // Generate keystream
        const keystream = [];
        for (let j = 0; j < 10; j++) {
          const bytes = OpCodes.Unpack32LE(state[j]);
          keystream.push(...bytes);
        }
        
        // Encrypt block
        for (let j = 0; j < block.length; j++) {
          ciphertext.push(block[j] ^ keystream[j]);
        }
        
        // Absorb ciphertext
        for (let j = 0; j < 10 && j * 4 < block.length; j++) {
          const word = OpCodes.Pack32LE(
            ciphertext[i + j * 4] || 0, ciphertext[i + j * 4 + 1] || 0,
            ciphertext[i + j * 4 + 2] || 0, ciphertext[i + j * 4 + 3] || 0
          );
          state[j] ^= word;
        }
        
        // Add domain separation
        state[15] ^= this.PAYLOAD_TAG;
        
        // Apply permutation
        this.norxPermute(state, this.ROUNDS);
      }
      
      return ciphertext;
    },
    
    // Decrypt data
    decrypt: function(state, ciphertext) {
      const plaintext = [];
      const blockSize = 40; // 320 bits = 10 words
      
      for (let i = 0; i < ciphertext.length; i += blockSize) {
        const block = ciphertext.slice(i, i + blockSize);
        
        // Generate keystream
        const keystream = [];
        for (let j = 0; j < 10; j++) {
          const bytes = OpCodes.Unpack32LE(state[j]);
          keystream.push(...bytes);
        }
        
        // Decrypt block
        for (let j = 0; j < block.length; j++) {
          plaintext.push(block[j] ^ keystream[j]);
        }
        
        // Absorb ciphertext
        for (let j = 0; j < 10 && j * 4 < block.length; j++) {
          const word = OpCodes.Pack32LE(
            block[j * 4] || 0, block[j * 4 + 1] || 0,
            block[j * 4 + 2] || 0, block[j * 4 + 3] || 0
          );
          state[j] ^= word;
        }
        
        // Add domain separation
        state[15] ^= this.PAYLOAD_TAG;
        
        // Apply permutation
        this.norxPermute(state, this.ROUNDS);
      }
      
      return plaintext;
    },
    
    // Generate authentication tag
    generateTag: function(state) {
      // Add final domain separation
      state[15] ^= this.FINAL_TAG;
      
      // Apply final permutation
      this.norxPermute(state, 2 * this.ROUNDS);
      
      // Extract tag
      const tag = [];
      for (let i = 0; i < 8; i++) { // 256-bit tag = 8 words
        const bytes = OpCodes.Unpack32LE(state[i]);
        tag.push(...bytes);
      }
      
      return tag;
    },
    
    // AEAD Encryption
    encryptAEAD: function(key, nonce, header, plaintext) {
      let state = this.initializeState(key, nonce);
      
      // Process header (associated data)
      if (header && header.length > 0) {
        state = this.absorb(state, header, this.HEADER_TAG);
      }
      
      // Encrypt plaintext
      const ciphertext = this.encrypt(state, plaintext);
      
      // Generate authentication tag
      const tag = this.generateTag(state);
      
      return {
        ciphertext: ciphertext,
        tag: tag
      };
    },
    
    // AEAD Decryption with verification
    decryptAEAD: function(key, nonce, header, ciphertext, expectedTag) {
      let state = this.initializeState(key, nonce);
      
      // Process header (associated data)
      if (header && header.length > 0) {
        state = this.absorb(state, header, this.HEADER_TAG);
      }
      
      // Decrypt ciphertext
      const plaintext = this.decrypt(state, ciphertext);
      
      // Generate and verify authentication tag
      const tag = this.generateTag(state);
      
      if (!OpCodes.SecureCompare(tag, expectedTag)) {
        throw new Error('Authentication tag verification failed');
      }
      
      return plaintext;
    },
    
    // Legacy cipher interface (simplified)
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const nonce = new Array(16).fill(0);
      nonce[0] = blockIndex & 0xFF;
      nonce[1] = (blockIndex >> 8) & 0xFF;
      
      const result = this.encryptAEAD(this.key, nonce, null, plaintext);
      return result.ciphertext.concat(result.tag);
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      if (ciphertext.length < 32) {
        throw new Error('Ciphertext too short for authentication tag');
      }
      
      const nonce = new Array(16).fill(0);
      nonce[0] = blockIndex & 0xFF;
      nonce[1] = (blockIndex >> 8) & 0xFF;
      
      const actualCiphertext = ciphertext.slice(0, -32);
      const tag = ciphertext.slice(-32);
      
      return this.decryptAEAD(this.key, nonce, null, actualCiphertext, tag);
    },
    
    ClearData: function() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
      }
      if (this.state) {
        OpCodes.ClearArray(this.state);
      }
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running NORX test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.nonce, test.header, test.payload);
          
          const ciphertextMatch = OpCodes.SecureCompare(result.ciphertext, test.expectedCiphertext);
          const tagMatch = OpCodes.SecureCompare(result.tag, test.expectedTag);
          
          if (ciphertextMatch && tagMatch) {
            console.log(`Test ${i + 1}: PASS`);
          } else {
            console.log(`Test ${i + 1}: FAIL`);
            if (!ciphertextMatch) {
              console.log('Expected ciphertext:', OpCodes.BytesToHex8(test.expectedCiphertext));
              console.log('Actual ciphertext:', OpCodes.BytesToHex8(result.ciphertext));
            }
            if (!tagMatch) {
              console.log('Expected tag:', OpCodes.BytesToHex8(test.expectedTag));
              console.log('Actual tag:', OpCodes.BytesToHex8(result.tag));
            }
            allPassed = false;
          }
          
          // Test decryption
          if (ciphertextMatch && tagMatch) {
            const decrypted = this.decryptAEAD(test.key, test.nonce, test.header, result.ciphertext, result.tag);
            const decryptMatch = OpCodes.SecureCompare(decrypted, test.payload);
            
            if (!decryptMatch) {
              console.log(`Test ${i + 1} decryption: FAIL`);
              allPassed = false;
            }
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Demonstrate high-performance properties
      console.log('\nNORX High-Performance Demonstration:');
      this.Init();
      this.KeySetup(OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"));
      
      const nonce = OpCodes.Hex8ToBytes("FEDCBA9876543210FEDCBA9876543210");
      const header = OpCodes.AsciiToBytes("High-Performance AEAD");
      const plaintext = OpCodes.AsciiToBytes("NORX is designed for speed and security in parallel environments");
      
      const encrypted = this.encryptAEAD(this.key, nonce, header, plaintext);
      console.log('Plaintext:', OpCodes.BytesToString(plaintext));
      console.log('Header:', OpCodes.BytesToString(header));
      console.log('Ciphertext:', OpCodes.BytesToHex8(encrypted.ciphertext));
      console.log('Tag:', OpCodes.BytesToHex8(encrypted.tag));
      
      const decrypted = this.decryptAEAD(this.key, nonce, header, encrypted.ciphertext, encrypted.tag);
      const demoSuccess = OpCodes.SecureCompare(decrypted, plaintext);
      console.log('Decrypted:', OpCodes.BytesToString(decrypted));
      console.log('Demo test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'NORX-64-4-1',
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        stateSize: 512, // 16 words * 32 bits
        keySize: 256,
        tagSize: 256,
        rounds: this.ROUNDS,
        notes: 'CAESAR competition finalist for high-performance authenticated encryption'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(NORX);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NORX;
  }
  
  // Global export
  global.NORX = NORX;
  
})(typeof global !== 'undefined' ? global : window);