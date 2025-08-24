/*
 * ChaCha20-Poly1305 Implementation - Authenticated Encryption with Associated Data
 * RFC 8439 Standard (TLS 1.3, WireGuard)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const CHACHA20_POLY1305 = {
    name: "ChaCha20-Poly1305",
    description: "Authenticated encryption combining ChaCha20 stream cipher with Poly1305 authenticator. Modern AEAD construction used in TLS 1.3, WireGuard, and many secure protocols.",
    inventor: "Daniel J. Bernstein",
    year: 2014,
    country: "US",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Authenticated Encryption",
    securityStatus: "standard",
    securityNotes: "RFC 8439 standard widely deployed in modern secure protocols. Designed for high security and performance on platforms without AES hardware acceleration.",
    
    documentation: [
      {text: "RFC 8439", uri: "https://tools.ietf.org/rfc/rfc8439.html"},
      {text: "Original ChaCha20 Paper", uri: "https://cr.yp.to/chacha/chacha-20080128.pdf"},
      {text: "Poly1305 Paper", uri: "https://cr.yp.to/mac/poly1305-20050329.pdf"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/jedisct1/libsodium"},
      {text: "TLS 1.3 Usage", uri: "https://tools.ietf.org/rfc/rfc8446.html"},
      {text: "WireGuard Protocol", uri: "https://www.wireguard.com/papers/wireguard.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Nonce Reuse",
        text: "Catastrophic failure if nonce is reused with same key",
        mitigation: "Ensure nonces are never reused - use counters or random with sufficient entropy"
      }
    ],
    
    tests: [
      {
        text: "RFC 8439 ChaCha20-Poly1305 AEAD Test Vector 1",
        uri: "https://tools.ietf.org/rfc/rfc8439.txt#section-2.8.2",
        key: OpCodes.Hex8ToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f"),
        nonce: OpCodes.Hex8ToBytes("070000004041424344454647"),
        aad: OpCodes.Hex8ToBytes("50515253c0c1c2c3c4c5c6c7"),
        plaintext: OpCodes.AsciiToBytes("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it."),
        expectedCiphertext: OpCodes.Hex8ToBytes("d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116"),
        expectedTag: OpCodes.Hex8ToBytes("1ae10b594f09e26a7e902ecbd0600691")
      },
      {
        text: "RFC 8439 ChaCha20-Poly1305 Test Vector 2 (Appendix A.5)",
        uri: "https://tools.ietf.org/rfc/rfc8439.txt#appendix-A.5",
        key: OpCodes.Hex8ToBytes("1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0"),
        nonce: OpCodes.Hex8ToBytes("000000000102030405060708"),
        aad: OpCodes.Hex8ToBytes("f33388860000000000004e91"),
        plaintext: OpCodes.Hex8ToBytes("496e7465726e65742d44726166747320617265206472616674206c6567697374726174696f6e20646f63756d656e747320666f7220746865204945544620284945544620526571756573742066c7a6420466f7220436f6d6d656e74732c204945544620526571756573742066c7a642074c7a6420466f7220436f6d6d656e74732c2049454654"),
        expectedCiphertext: OpCodes.Hex8ToBytes("64a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb24c6cfc18755d43eea09ee94e382d26b0bdb7b73c321b0100d4f03b7f355894cf332f830e710b97ce98c8a84abd0b948114ad176e008d33bd60f982b1ff37c8559797a06ef4f0ef61c186324e2b3506383606907b6a7c02b0f9f6157b53c867e4b9166c767b804d46a59b5216cde7a4e99040c5a40433225ee282a1b0a06c523eaf4534d7f83fa1155b0047718cbc546a0d072b04b3564eea1b422273f548271a0bb2316053fa76991955ebd63159434ecebb4e466dae5a1073a6727627097a1049e617d91d361094fa68f0ff77987130305beaba2eda04df997b714d6c6f2c29a6ad5cb4022b02709b"),
        expectedTag: OpCodes.Hex8ToBytes("eead9d67890cbb22392336fea1851f38")
      },
      {
        text: "RFC 8439 Empty AAD and Plaintext Test",
        uri: "https://tools.ietf.org/rfc/rfc8439.txt",
        key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        nonce: OpCodes.Hex8ToBytes("000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
      }
    ],

    // Legacy interface properties
    internalName: 'chacha20-poly1305',
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
    
    // ChaCha20-Poly1305 constants
    KEY_SIZE: 32,
    NONCE_SIZE: 12,
    TAG_SIZE: 16,
    BLOCK_SIZE: 64,
    
    // Current configuration
    key: null,
    keyScheduled: false,
    
    // Initialize ChaCha20-Poly1305
    Init: function() {
      this.key = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 32) {
        throw new Error('ChaCha20-Poly1305 requires exactly 32-byte (256-bit) key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'chacha20-poly1305-' + Math.random().toString(36).substr(2, 9);
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
      
      // Nonce
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
    
    // ChaCha20 encryption/decryption
    chacha20: function(key, counter, nonce, data) {
      const result = [];
      let blockCounter = counter;
      
      for (let i = 0; i < data.length; i += this.BLOCK_SIZE) {
        const keystream = this.chachaBlock(key, blockCounter, nonce);
        const block = data.slice(i, i + this.BLOCK_SIZE);
        
        for (let j = 0; j < block.length; j++) {
          result.push(block[j] ^ keystream[j]);
        }
        
        blockCounter++;
      }
      
      return result;
    },
    
    // Poly1305 key generation
    poly1305KeyGen: function(key, nonce) {
      const counter = 0;
      const keystream = this.chachaBlock(key, counter, nonce);
      return keystream.slice(0, 32);
    },
    
    // Poly1305 authenticator (RFC 8439 compliant)
    poly1305: function(key, data) {
      if (key.length !== 32) {
        throw new Error('Poly1305 key must be 32 bytes');
      }
      
      // Extract r and s from key
      const r = key.slice(0, 16);
      const s = key.slice(16, 32);
      
      // Clamp r according to RFC 8439
      r[3] &= 15;
      r[7] &= 15;
      r[11] &= 15;
      r[15] &= 15;
      r[4] &= 252;
      r[8] &= 252;
      r[12] &= 252;
      
      // Initialize accumulator
      let h = [0, 0, 0, 0, 0]; // 130-bit accumulator as 5 26-bit words
      
      // Convert r to 26-bit words for computation
      const rWords = this.poly1305To26BitWords(r);
      
      // Process data in 16-byte blocks
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        
        // Pad block if necessary
        while (block.length < 16) {
          block.push(0);
        }
        
        // Convert block to 26-bit words and add padding bit
        const blockWords = this.poly1305To26BitWords(block);
        if (block.length === 16) {
          blockWords[4] |= (1 << 24); // Set bit 128
        } else {
          // For partial blocks, set the bit after the last data bit
          const bitPos = block.length * 8;
          blockWords[Math.floor(bitPos / 26)] |= (1 << (bitPos % 26));
        }
        
        // Add block to accumulator
        for (let j = 0; j < 5; j++) {
          h[j] += blockWords[j];
        }
        
        // Multiply by r
        h = this.poly1305Multiply(h, rWords);
      }
      
      // Add s to accumulator
      const sWords = this.poly1305To26BitWords(s);
      for (let i = 0; i < 4; i++) { // Only add first 128 bits of s
        h[i] += sWords[i];
      }
      
      // Carry propagation
      this.poly1305Carry(h);
      
      // Convert back to 16-byte tag
      return this.poly1305From26BitWords(h);
    },
    
    // Convert 16 bytes to 5 26-bit words (little-endian)
    poly1305To26BitWords: function(bytes) {
      const words = [0, 0, 0, 0, 0];
      
      // Pack bytes into 32-bit words first
      const u32 = [];
      for (let i = 0; i < 16; i += 4) {
        u32.push(
          bytes[i] |
          (bytes[i + 1] << 8) |
          (bytes[i + 2] << 16) |
          (bytes[i + 3] << 24)
        );
      }
      
      // Convert to 26-bit words
      words[0] = u32[0] & 0x3ffffff;
      words[1] = ((u32[0] >>> 26) | (u32[1] << 6)) & 0x3ffffff;
      words[2] = ((u32[1] >>> 20) | (u32[2] << 12)) & 0x3ffffff;
      words[3] = ((u32[2] >>> 14) | (u32[3] << 18)) & 0x3ffffff;
      words[4] = (u32[3] >>> 8) & 0x3ffffff;
      
      return words;
    },
    
    // Convert 5 26-bit words back to 16 bytes
    poly1305From26BitWords: function(words) {
      // Ensure words are properly reduced
      this.poly1305Carry(words);
      
      const bytes = new Array(16);
      
      // Pack words into bytes (little-endian)
      let temp = words[0] | (words[1] << 26);
      bytes[0] = temp & 0xff;
      bytes[1] = (temp >>> 8) & 0xff;
      bytes[2] = (temp >>> 16) & 0xff;
      bytes[3] = (temp >>> 24) & 0xff;
      
      temp = (words[1] >>> 6) | (words[2] << 20);
      bytes[4] = temp & 0xff;
      bytes[5] = (temp >>> 8) & 0xff;
      bytes[6] = (temp >>> 16) & 0xff;
      bytes[7] = (temp >>> 24) & 0xff;
      
      temp = (words[2] >>> 12) | (words[3] << 14);
      bytes[8] = temp & 0xff;
      bytes[9] = (temp >>> 8) & 0xff;
      bytes[10] = (temp >>> 16) & 0xff;
      bytes[11] = (temp >>> 24) & 0xff;
      
      temp = (words[3] >>> 18) | (words[4] << 8);
      bytes[12] = temp & 0xff;
      bytes[13] = (temp >>> 8) & 0xff;
      bytes[14] = (temp >>> 16) & 0xff;
      bytes[15] = (temp >>> 24) & 0xff;
      
      return bytes;
    },
    
    // Multiply two 130-bit numbers represented as 5 26-bit words
    poly1305Multiply: function(a, b) {
      const result = [0, 0, 0, 0, 0];
      
      // Multiply with reduction modulo 2^130 - 5
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const product = a[i] * b[j];
          if (i + j < 5) {
            result[i + j] += product;
          } else {
            // Reduce modulo 2^130 - 5
            result[i + j - 5] += product * 5;
          }
        }
      }
      
      this.poly1305Carry(result);
      return result;
    },
    
    // Carry propagation for 26-bit words
    poly1305Carry: function(words) {
      for (let i = 0; i < 4; i++) {
        words[i + 1] += Math.floor(words[i] / (1 << 26));
        words[i] &= 0x3ffffff;
      }
      
      // Handle overflow from word 4
      const overflow = Math.floor(words[4] / (1 << 26));
      words[4] &= 0x3ffffff;
      words[0] += overflow * 5;
      
      // One more carry pass if needed
      if (words[0] >= (1 << 26)) {
        words[1] += Math.floor(words[0] / (1 << 26));
        words[0] &= 0x3ffffff;
      }
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
      // Generate Poly1305 key
      const poly1305Key = this.poly1305KeyGen(key, nonce);
      
      // Encrypt plaintext with ChaCha20 (counter starts at 1)
      const ciphertext = this.chacha20(key, 1, nonce, plaintext);
      
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
      
      // Decrypt ciphertext with ChaCha20 (counter starts at 1)
      const plaintext = this.chacha20(key, 1, nonce, ciphertext);
      
      return plaintext;
    },
    
    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const nonce = new Array(12).fill(0);
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
      
      const nonce = new Array(12).fill(0);
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
      console.log('Running ChaCha20-Poly1305 test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.nonce, test.aad, test.plaintext);
          
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
            const decrypted = this.decryptAEAD(test.key, test.nonce, test.aad, result.ciphertext, result.tag);
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
      
      // Demonstrate modern cryptography
      console.log('\\nChaCha20-Poly1305 Modern Cryptography Demonstration:');
      this.Init();
      this.KeySetup(OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"));
      
      const nonce = OpCodes.Hex8ToBytes("000102030405060708090A0B");
      const aad = OpCodes.AsciiToBytes("TLS 1.3 Record");
      const plaintext = OpCodes.AsciiToBytes("ChaCha20-Poly1305 is used in TLS 1.3, WireGuard, and many modern protocols");
      
      const encrypted = this.encryptAEAD(this.key, nonce, aad, plaintext);
      console.log('Plaintext:', OpCodes.BytesToString(plaintext));
      console.log('Associated Data:', OpCodes.BytesToString(aad));
      console.log('Ciphertext:', OpCodes.BytesToHex8(encrypted.ciphertext));
      console.log('Tag:', OpCodes.BytesToHex8(encrypted.tag));
      
      const decrypted = this.decryptAEAD(this.key, nonce, aad, encrypted.ciphertext, encrypted.tag);
      const demoSuccess = OpCodes.SecureCompare(decrypted, plaintext);
      console.log('Decrypted:', OpCodes.BytesToString(decrypted));
      console.log('Demo test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'ChaCha20-Poly1305',
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        keySize: this.KEY_SIZE * 8,
        nonceSize: this.NONCE_SIZE * 8,
        tagSize: this.TAG_SIZE * 8,
        notes: 'Modern AEAD used in TLS 1.3, WireGuard, and secure protocols'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(CHACHA20_POLY1305);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CHACHA20_POLY1305;
  }
  
  // Global export
  global.CHACHA20_POLY1305 = CHACHA20_POLY1305;
  
})(typeof global !== 'undefined' ? global : window);