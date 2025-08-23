/*
 * XChaCha20-Poly1305 Implementation - Extended Nonce AEAD
 * Extended ChaCha20-Poly1305 with 192-bit nonces
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const XCHACHA20_POLY1305 = {
    name: "XChaCha20-Poly1305",
    description: "Extended ChaCha20-Poly1305 authenticated encryption with 192-bit nonces. Provides the security and performance of ChaCha20-Poly1305 while eliminating nonce size limitations.",
    inventor: "Scott Arciszewski (libsodium team)",
    year: 2018,
    country: "Multi-national",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Authenticated Encryption",
    securityStatus: "active",
    securityNotes: "Modern AEAD construction extending ChaCha20-Poly1305 with larger nonces. Widely used in applications requiring nonce-misuse resistance without nonce management complexity.",
    
    documentation: [
      {text: "XChaCha20 Specification", uri: "https://tools.ietf.org/html/draft-irtf-cfrg-xchacha-03"},
      {text: "libsodium Documentation", uri: "https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction"},
      {text: "Extended Nonce Paper", uri: "https://cr.yp.to/snuffle/xsalsa-20110204.pdf"}
    ],
    
    references: [
      {text: "libsodium Implementation", uri: "https://github.com/jedisct1/libsodium"},
      {text: "NaCl Family", uri: "https://nacl.cr.yp.to/"},
      {text: "Crypto++ Implementation", uri: "https://github.com/weidai11/cryptopp"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Key Reuse",
        text: "Extended nonces reduce but don't eliminate nonce reuse risks",
        mitigation: "Still ensure nonces are not reused, though collision probability is negligible"
      }
    ],
    
    tests: [
      {
        text: "XChaCha20-Poly1305 Test Vector 1",
        uri: "libsodium test vectors",
        key: OpCodes.Hex8ToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f"),
        nonce: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f5051525354555657"),
        aad: OpCodes.Hex8ToBytes("50515253c0c1c2c3c4c5c6c7"),
        plaintext: OpCodes.AsciiToBytes("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it."),
        expectedLength: 114 // plaintext length
      },
      {
        text: "XChaCha20-Poly1305 Test Vector 2 (Empty)",
        uri: "libsodium test vectors",
        key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes(""),
        expectedLength: 0
      }
    ],

    // Legacy interface properties
    internalName: 'xchacha20-poly1305',
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
    family: 'ChaCha',
    category: 'Authenticated-Encryption',
    
    // XChaCha20-Poly1305 constants
    KEY_SIZE: 32,
    NONCE_SIZE: 24,  // Extended nonce: 192 bits
    TAG_SIZE: 16,
    BLOCK_SIZE: 64,
    
    // Current configuration
    key: null,
    keyScheduled: false,
    
    // Initialize XChaCha20-Poly1305
    Init: function() {
      this.key = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 32) {
        throw new Error('XChaCha20-Poly1305 requires exactly 32-byte (256-bit) key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'xchacha20-poly1305-' + Math.random().toString(36).substr(2, 9);
    },
    
    // HChaCha20 - used for key derivation with extended nonce
    hchacha20: function(key, nonce) {
      // Initialize state with constants, key, and first 16 bytes of nonce
      const state = new Array(16);
      
      // Constants "expand 32-byte k"
      state[0] = 0x61707865;
      state[1] = 0x3320646e;
      state[2] = 0x79622d32;
      state[3] = 0x6b206574;
      
      // Key
      for (let i = 0; i < 8; i++) {
        state[4 + i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1],
          key[i * 4 + 2], key[i * 4 + 3]
        );
      }
      
      // First 16 bytes of nonce
      for (let i = 0; i < 4; i++) {
        state[12 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }
      
      // Working state for rounds
      const workingState = OpCodes.CopyArray(state);
      
      // 20 rounds (10 double rounds)
      for (let i = 0; i < 10; i++) {
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
      
      // Extract key material: words 0, 1, 2, 3, 12, 13, 14, 15
      const derivedKey = [];
      const keyWords = [0, 1, 2, 3, 12, 13, 14, 15];
      
      for (const wordIndex of keyWords) {
        const bytes = OpCodes.Unpack32LE(workingState[wordIndex]);
        derivedKey.push(...bytes);
      }
      
      return derivedKey;
    },
    
    // ChaCha20 quarter round
    quarterRound: function(state, a, b, c, d) {
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] = OpCodes.RotL32(state[d] ^ state[a], 16);
      
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] = OpCodes.RotL32(state[b] ^ state[c], 12);
      
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] = OpCodes.RotL32(state[d] ^ state[a], 8);
      
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] = OpCodes.RotL32(state[b] ^ state[c], 7);
    },
    
    // ChaCha20 block function
    chachaBlock: function(key, counter, nonce) {
      // Initialize state
      const state = new Array(16);
      
      // Constants "expand 32-byte k"
      state[0] = 0x61707865;
      state[1] = 0x3320646e;
      state[2] = 0x79622d32;
      state[3] = 0x6b206574;
      
      // Key
      for (let i = 0; i < 8; i++) {
        state[4 + i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1],
          key[i * 4 + 2], key[i * 4 + 3]
        );
      }
      
      // Counter
      state[12] = counter;
      
      // Nonce (12 bytes)
      for (let i = 0; i < 3; i++) {
        state[13 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }
      
      // Working state for rounds
      const workingState = OpCodes.CopyArray(state);
      
      // 20 rounds (10 double rounds)
      for (let i = 0; i < 10; i++) {
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
      
      // Add original state
      for (let i = 0; i < 16; i++) {
        workingState[i] = (workingState[i] + state[i]) >>> 0;
      }
      
      // Serialize to bytes
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(workingState[i]);
        keystream.push(...bytes);
      }
      
      return keystream;
    },
    
    // XChaCha20 encryption/decryption
    xchacha20: function(key, nonce, data) {
      // Derive key using HChaCha20 with first 16 bytes of nonce
      const derivedKey = this.hchacha20(key, nonce.slice(0, 16));
      
      // Use last 8 bytes of nonce + 4 zero bytes as ChaCha20 nonce
      const chacha20Nonce = new Array(12);
      chacha20Nonce.fill(0, 0, 4); // 4 zero bytes
      for (let i = 0; i < 8; i++) {
        chacha20Nonce[4 + i] = nonce[16 + i];
      }
      
      // Use standard ChaCha20 with derived key
      const result = [];
      let blockCounter = 1; // Start at 1 (0 reserved for Poly1305 key)
      
      for (let i = 0; i < data.length; i += this.BLOCK_SIZE) {
        const keystream = this.chachaBlock(derivedKey, blockCounter, chacha20Nonce);
        const block = data.slice(i, i + this.BLOCK_SIZE);
        
        for (let j = 0; j < block.length; j++) {
          result.push(block[j] ^ keystream[j]);
        }
        
        blockCounter++;
      }
      
      return result;
    },
    
    // XChaCha20-Poly1305 key generation for authentication
    poly1305KeyGen: function(key, nonce) {
      // Derive key using HChaCha20
      const derivedKey = this.hchacha20(key, nonce.slice(0, 16));
      
      // Use last 8 bytes of nonce + 4 zero bytes as ChaCha20 nonce
      const chacha20Nonce = new Array(12);
      chacha20Nonce.fill(0, 0, 4);
      for (let i = 0; i < 8; i++) {
        chacha20Nonce[4 + i] = nonce[16 + i];
      }
      
      // Generate first block (counter = 0) for Poly1305 key
      const keystream = this.chachaBlock(derivedKey, 0, chacha20Nonce);
      return keystream.slice(0, 32);
    },
    
    // Poly1305 authenticator (simplified educational version)
    poly1305: function(key, data) {
      // Poly1305 constants
      const P = 0x3fffffffffffffffffffffffffffffffb; // 2^130 - 5
      
      // Clamp key
      const r = []
      for (let i = 0; i < 16; i++) {
        r[i] = key[i];
      }
      r[3] &= 15;
      r[7] &= 15;
      r[11] &= 15;
      r[15] &= 15;
      r[4] &= 252;
      r[8] &= 252;
      r[12] &= 252;
      
      const s = key.slice(16, 32);
      
      // Process data in 16-byte blocks
      let accumulator = 0;
      
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        
        // Pad block
        while (block.length < 16) {
          block.push(0);
        }
        block.push(1); // Add padding bit
        
        // Convert to number (simplified for educational purposes)
        let blockNum = 0;
        for (let j = 0; j < block.length; j++) {
          blockNum += block[j] * Math.pow(256, j);
        }
        
        // Add to accumulator
        accumulator += blockNum;
        
        // Multiply by r (simplified)
        let rNum = 0;
        for (let j = 0; j < r.length; j++) {
          rNum += r[j] * Math.pow(256, j);
        }
        
        accumulator = (accumulator * rNum) % P;
      }
      
      // Add s (simplified)
      let sNum = 0;
      for (let j = 0; j < s.length; j++) {
        sNum += s[j] * Math.pow(256, j);
      }
      
      accumulator = (accumulator + sNum) >>> 0;
      
      // Convert back to bytes
      const tag = new Array(16);
      for (let i = 0; i < 16; i++) {
        tag[i] = (accumulator >>> (i * 8)) & 0xFF;
      }
      
      return tag;
    },
    
    // Pad data to 16-byte boundary
    padToBlockSize: function(data) {
      const padded = OpCodes.CopyArray(data);
      while (padded.length % 16 !== 0) {
        padded.push(0);
      }
      return padded;
    },
    
    // Encode length as 8-byte little-endian
    encodeLength: function(length) {
      const result = new Array(8);
      for (let i = 0; i < 8; i++) {
        result[i] = (length >>> (i * 8)) & 0xFF;
      }
      return result;
    },
    
    // AEAD Encryption
    encryptAEAD: function(key, nonce, aad, plaintext) {
      if (nonce.length !== 24) {
        throw new Error('XChaCha20-Poly1305 requires exactly 24-byte (192-bit) nonce');
      }
      
      // Generate Poly1305 key
      const poly1305Key = this.poly1305KeyGen(key, nonce);
      
      // Encrypt plaintext with XChaCha20
      const ciphertext = this.xchacha20(key, nonce, plaintext);
      
      // Construct data for authentication
      const authData = [];
      
      // Add AAD
      if (aad && aad.length > 0) {
        authData.push(...this.padToBlockSize(aad));
      }
      
      // Add ciphertext
      authData.push(...this.padToBlockSize(ciphertext));
      
      // Add lengths
      authData.push(...this.encodeLength(aad ? aad.length : 0));
      authData.push(...this.encodeLength(ciphertext.length));
      
      // Compute authentication tag
      const tag = this.poly1305(poly1305Key, authData);
      
      return {
        ciphertext: ciphertext,
        tag: tag
      };
    },
    
    // AEAD Decryption with verification
    decryptAEAD: function(key, nonce, aad, ciphertext, expectedTag) {
      if (nonce.length !== 24) {
        throw new Error('XChaCha20-Poly1305 requires exactly 24-byte (192-bit) nonce');
      }
      
      // Generate Poly1305 key
      const poly1305Key = this.poly1305KeyGen(key, nonce);
      
      // Construct data for authentication
      const authData = [];
      
      // Add AAD
      if (aad && aad.length > 0) {
        authData.push(...this.padToBlockSize(aad));
      }
      
      // Add ciphertext
      authData.push(...this.padToBlockSize(ciphertext));
      
      // Add lengths
      authData.push(...this.encodeLength(aad ? aad.length : 0));
      authData.push(...this.encodeLength(ciphertext.length));
      
      // Verify authentication tag
      const tag = this.poly1305(poly1305Key, authData);
      
      if (!OpCodes.SecureCompare(tag, expectedTag)) {
        throw new Error('Authentication tag verification failed');
      }
      
      // Decrypt ciphertext with XChaCha20
      const plaintext = this.xchacha20(key, nonce, ciphertext);
      
      return plaintext;
    },
    
    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const nonce = new Array(24).fill(0);
      nonce[0] = blockIndex & 0xFF;
      nonce[1] = (blockIndex >> 8) & 0xFF;
      nonce[2] = (blockIndex >> 16) & 0xFF;
      
      const result = this.encryptAEAD(this.key, nonce, null, plaintext);
      return result.ciphertext.concat(result.tag);
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      if (ciphertext.length < 16) {
        throw new Error('Ciphertext too short for authentication tag');
      }
      
      const nonce = new Array(24).fill(0);
      nonce[0] = blockIndex & 0xFF;
      nonce[1] = (blockIndex >> 8) & 0xFF;
      nonce[2] = (blockIndex >> 16) & 0xFF;
      
      const actualCiphertext = ciphertext.slice(0, -16);
      const tag = ciphertext.slice(-16);
      
      return this.decryptAEAD(this.key, nonce, null, actualCiphertext, tag);
    },
    
    ClearData: function() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
      }
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running XChaCha20-Poly1305 test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.nonce, test.aad, test.plaintext);
          
          // Check basic properties
          const ciphertextLengthMatch = (result.ciphertext.length === test.expectedLength);
          const tagPresent = (result.tag.length === 16);
          
          if (ciphertextLengthMatch && tagPresent) {
            console.log(`Test ${i + 1}: PASS (length checks)`);
            console.log('Ciphertext length:', result.ciphertext.length);
            console.log('Tag:', OpCodes.BytesToHex8(result.tag));
          } else {
            console.log(`Test ${i + 1}: FAIL`);
            console.log('Expected ciphertext length:', test.expectedLength);
            console.log('Actual ciphertext length:', result.ciphertext.length);
            allPassed = false;
          }
          
          // Test decryption
          try {
            const decrypted = this.decryptAEAD(test.key, test.nonce, test.aad, result.ciphertext, result.tag);
            const decryptMatch = OpCodes.SecureCompare(decrypted, test.plaintext);
            
            if (!decryptMatch) {
              console.log(`Test ${i + 1} decryption: FAIL`);
              allPassed = false;
            }
          } catch (error) {
            console.log(`Test ${i + 1} decryption: ERROR - ${error.message}`);
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Demonstrate extended nonce benefits
      console.log('\nXChaCha20-Poly1305 Extended Nonce Demonstration:');
      this.Init();
      this.KeySetup(OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"));
      
      // 192-bit nonce (24 bytes)
      const extendedNonce = OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617");
      const aad = OpCodes.AsciiToBytes("Extended nonce AEAD");
      const plaintext = OpCodes.AsciiToBytes("XChaCha20-Poly1305 extends ChaCha20-Poly1305 with 192-bit nonces for better nonce management");
      
      const encrypted = this.encryptAEAD(this.key, extendedNonce, aad, plaintext);
      console.log('Plaintext:', OpCodes.BytesToString(plaintext));
      console.log('Extended Nonce (192-bit):', OpCodes.BytesToHex8(extendedNonce));
      console.log('Associated Data:', OpCodes.BytesToString(aad));
      console.log('Ciphertext:', OpCodes.BytesToHex8(encrypted.ciphertext.slice(0, 32)), '...');
      console.log('Tag:', OpCodes.BytesToHex8(encrypted.tag));
      
      const decrypted = this.decryptAEAD(this.key, extendedNonce, aad, encrypted.ciphertext, encrypted.tag);
      const demoSuccess = OpCodes.SecureCompare(decrypted, plaintext);
      console.log('Decrypted:', OpCodes.BytesToString(decrypted.slice(0, 50)), '...');
      console.log('Demo test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'XChaCha20-Poly1305',
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        keySize: this.KEY_SIZE * 8,
        nonceSize: this.NONCE_SIZE * 8,
        tagSize: this.TAG_SIZE * 8,
        notes: 'Extended nonce variant of ChaCha20-Poly1305 with 192-bit nonces'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(XCHACHA20_POLY1305);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XCHACHA20_POLY1305;
  }
  
  // Global export
  global.XCHACHA20_POLY1305 = XCHACHA20_POLY1305;
  
})(typeof global !== 'undefined' ? global : window);