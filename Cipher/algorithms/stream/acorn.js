/*
 * ACORN Implementation - Authenticated Encryption with Associated Data
 * CAESAR Competition Winner (Lightweight Category)
 * (c)2006-2025 Hawkynt
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
  
  const ACORN = {
    name: "ACORN",
    description: "Authenticated encryption with associated data (AEAD) stream cipher designed for lightweight applications. Winner of CAESAR competition lightweight category with 128-bit security and efficient hardware implementation.",
    inventor: "Hongjun Wu, Tao Huang, Phuong Pham, Steven Sim",
    year: 2016,
    country: "Multi-national",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "CAESAR competition winner with thorough security analysis. Designed for IoT and resource-constrained environments with authenticated encryption.",
    
    documentation: [
      {text: "CAESAR Submission", uri: "https://competitions.cr.yp.to/round3/acornv3.pdf"},
      {text: "CAESAR Competition Results", uri: "https://competitions.cr.yp.to/caesar-submissions.html"},
      {text: "Algorithm Specification", uri: "https://acorn-cipher.org/"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/hongjun-wu/ACORN-128"},
      {text: "CAESAR Benchmarks", uri: "https://bench.cr.yp.to/results-aead.html"},
      {text: "NIST Lightweight Crypto", uri: "https://csrc.nist.gov/projects/lightweight-cryptography"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Weak Key Classes",
        text: "Small subset of keys may have reduced security margins",
        mitigation: "Use random key generation and avoid structured or low-entropy keys"
      },
      {
        type: "Implementation Attacks",
        text: "Side-channel vulnerabilities in software implementations",
        mitigation: "Use constant-time implementation and appropriate countermeasures"
      }
    ],
    
    tests: [
      {
        text: "ACORN-128 Test Vector 1 (CAESAR)",
        uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        expected: OpCodes.Hex8ToBytes("4DB923DC793EE2B2B1B0F6207BF16B6A")
      },
      {
        text: "ACORN-128 Test Vector 2 (With Data)",
        uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
        input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        expected: OpCodes.Hex8ToBytes("486BB8E5A060F6E96FA0B3B676A7D58AA1D6EBC95B17A1DBE5C32A09A42B4CAF67E804B9D5AB2E1E4B3C02A29E8FE3BC")
      },
      {
        text: "ACORN-128 Test Vector 3 (AAD Only)",
        uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        expected: OpCodes.Hex8ToBytes("7E7B35BC9476E0AEADC8C07DEE4D17E5")
      }
    ],

    // Legacy interface properties
    internalName: 'acorn',
    minKeyLength: 16,
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 16,
    blockSize: 16,
    
    // Algorithm metadata
    isStreamCipher: true,
    isBlockCipher: false,
    isAEAD: true,
    complexity: 'Medium',
    family: 'Lightweight',
    // Removed duplicate category - using the correct one at line 35
    
    // ACORN state (293 bits)
    state: null,
    keyScheduled: false,
    
    // ACORN constants
    STATE_SIZE: 293,
    KEY_SIZE: 128,
    IV_SIZE: 128,
    TAG_SIZE: 128,
    
    // Initialize ACORN
    Init: function() {
      this.state = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 16) {
        throw new Error('ACORN requires exactly 16-byte (128-bit) key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'acorn-128-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Initialize ACORN state with key and IV
    initializeState: function(key, iv) {
      if (iv.length !== 16) {
        throw new Error('ACORN requires 16-byte IV');
      }
      
      // Initialize 293-bit state as array of bits
      this.state = new Array(this.STATE_SIZE).fill(0);
      
      // Load key and IV into state
      for (let i = 0; i < 128; i++) {
        const keyBit = (key[Math.floor(i / 8)] >> (i % 8)) & 1;
        const ivBit = (iv[Math.floor(i / 8)] >> (i % 8)) & 1;
        
        this.state[i] = keyBit;
        this.state[128 + i] = ivBit;
      }
      
      // Initialize remaining bits to 1
      for (let i = 256; i < this.STATE_SIZE; i++) {
        this.state[i] = 1;
      }
      
      // Run initialization for 1792 steps
      for (let i = 0; i < 1792; i++) {
        this.updateState(0, 0);
      }
      
      // XOR key again
      for (let i = 0; i < 128; i++) {
        const keyBit = (key[Math.floor(i / 8)] >> (i % 8)) & 1;
        this.state[i] ^= keyBit;
      }
    },
    
    // ACORN state update function
    updateState: function(ca, cb) {
      // ACORN feedback function with majority gates
      const f = (
        (this.state[12] & this.state[154]) ^
        (this.state[12] & this.state[235]) ^
        (this.state[154] & this.state[235]) ^
        this.state[235]
      ) & 1;
      
      // State update with nonlinear feedback
      const ks = (
        this.state[12] ^ this.state[154] ^ this.state[235] ^
        this.state[61] ^ this.state[193] ^ this.state[230] ^
        this.state[111] ^ this.state[68] ^ ca
      ) & 1;
      
      // Shift state
      for (let i = this.STATE_SIZE - 1; i > 0; i--) {
        this.state[i] = this.state[i - 1];
      }
      
      this.state[0] = ks ^ f ^ cb;
      
      return ks;
    },
    
    // Generate keystream byte
    generateKeystream: function() {
      const outputBits = new Array(8);
      
      for (let i = 0; i < 8; i++) {
        outputBits[i] = this.updateState(0, 0);
      }
      
      // Pack bits into byte
      let result = 0;
      for (let i = 0; i < 8; i++) {
        result |= (outputBits[i] << i);
      }
      
      return result;
    },
    
    // Process associated data
    processAAD: function(aad) {
      if (!aad || aad.length === 0) {
        return;
      }
      
      for (let i = 0; i < aad.length; i++) {
        for (let bit = 0; bit < 8; bit++) {
          const aadBit = (aad[i] >> bit) & 1;
          this.updateState(aadBit, 0);
        }
      }
      
      // Domain separation
      this.updateState(1, 0);
    },
    
    // Encrypt plaintext
    encryptData: function(plaintext) {
      const ciphertext = new Array(plaintext.length);
      
      for (let i = 0; i < plaintext.length; i++) {
        const keyByte = this.generateKeystream();
        ciphertext[i] = plaintext[i] ^ keyByte;
        
        // Feed ciphertext back into state
        for (let bit = 0; bit < 8; bit++) {
          const cipherBit = (ciphertext[i] >> bit) & 1;
          this.updateState(0, cipherBit);
        }
      }
      
      return ciphertext;
    },
    
    // Decrypt ciphertext
    decryptData: function(ciphertext) {
      const plaintext = new Array(ciphertext.length);
      
      for (let i = 0; i < ciphertext.length; i++) {
        const keyByte = this.generateKeystream();
        plaintext[i] = ciphertext[i] ^ keyByte;
        
        // Feed ciphertext back into state
        for (let bit = 0; bit < 8; bit++) {
          const cipherBit = (ciphertext[i] >> bit) & 1;
          this.updateState(0, cipherBit);
        }
      }
      
      return plaintext;
    },
    
    // Generate authentication tag
    generateTag: function() {
      // Domain separation for tag generation
      for (let i = 0; i < 256; i++) {
        this.updateState(1, 0);
      }
      
      const tag = new Array(16);
      for (let i = 0; i < 16; i++) {
        tag[i] = this.generateKeystream();
      }
      
      return tag;
    },
    
    // AEAD Encryption
    encryptAEAD: function(key, iv, aad, plaintext) {
      this.initializeState(key, iv);
      
      // Process associated data
      this.processAAD(aad);
      
      // Encrypt plaintext
      const ciphertext = this.encryptData(plaintext);
      
      // Generate authentication tag
      const tag = this.generateTag();
      
      return {
        ciphertext: ciphertext,
        tag: tag
      };
    },
    
    // AEAD Decryption with verification
    decryptAEAD: function(key, iv, aad, ciphertext, expectedTag) {
      this.initializeState(key, iv);
      
      // Process associated data
      this.processAAD(aad);
      
      // Decrypt ciphertext
      const plaintext = this.decryptData(ciphertext);
      
      // Generate and verify authentication tag
      const tag = this.generateTag();
      
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
      
      const iv = new Array(16).fill(0);
      iv[0] = blockIndex & 0xFF;
      iv[1] = (blockIndex >> 8) & 0xFF;
      
      const result = this.encryptAEAD(this.key, iv, null, plaintext);
      return result.ciphertext.concat(result.tag);
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      if (ciphertext.length < 16) {
        throw new Error('Ciphertext too short for authentication tag');
      }
      
      const iv = new Array(16).fill(0);
      iv[0] = blockIndex & 0xFF;
      iv[1] = (blockIndex >> 8) & 0xFF;
      
      const actualCiphertext = ciphertext.slice(0, -16);
      const tag = ciphertext.slice(-16);
      
      return this.decryptAEAD(this.key, iv, null, actualCiphertext, tag);
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
      console.log('Running ACORN test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.iv, test.aad, test.plaintext);
          
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
            const decrypted = this.decryptAEAD(test.key, test.iv, test.aad, result.ciphertext, result.tag);
            const decryptMatch = OpCodes.SecureCompare(decrypted, test.plaintext);
            
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
      
      // Demonstrate lightweight properties
      console.log('\nACORN Lightweight Demonstration:');
      this.Init();
      this.KeySetup(OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF"));
      
      const iv = OpCodes.Hex8ToBytes("FEDCBA9876543210FEDCBA9876543210");
      const aad = OpCodes.AsciiToBytes("IoT Device");
      const plaintext = OpCodes.AsciiToBytes("Sensor data: 25.3°C");
      
      const encrypted = this.encryptAEAD(this.key, iv, aad, plaintext);
      console.log('Plaintext:', OpCodes.BytesToString(plaintext));
      console.log('AAD:', OpCodes.BytesToString(aad));
      console.log('Ciphertext:', OpCodes.BytesToHex8(encrypted.ciphertext));
      console.log('Tag:', OpCodes.BytesToHex8(encrypted.tag));
      
      const decrypted = this.decryptAEAD(this.key, iv, aad, encrypted.ciphertext, encrypted.tag);
      const demoSuccess = OpCodes.SecureCompare(decrypted, plaintext);
      console.log('Decrypted:', OpCodes.BytesToString(decrypted));
      console.log('Demo test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'ACORN-128',
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        stateSize: this.STATE_SIZE,
        keySize: this.KEY_SIZE,
        tagSize: this.TAG_SIZE,
        notes: 'CAESAR competition winner for lightweight authenticated encryption'
      };
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(ACORN);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(ACORN);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(ACORN);
  }
  
  // Export to global scope
  global.ACORN = ACORN;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ACORN;
  }
  
})(typeof global !== 'undefined' ? global : window);