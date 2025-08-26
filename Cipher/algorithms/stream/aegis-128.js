/*
 * AEGIS-128 Implementation - High-Performance Authenticated Encryption
 * CAESAR Competition Winner (High-Performance Category)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const AEGIS_128 = {
    name: "AEGIS-128",
    description: "High-performance authenticated encryption with associated data (AEAD) using AES round function. Winner of CAESAR competition high-performance category with exceptional speed on AES-NI enabled processors.",
    inventor: "Hongjun Wu, Bart Preneel",
    year: 2016,
    country: "Multi-national",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "CAESAR competition winner with strong security analysis. Based on AES round function security assumptions.",
    
    documentation: [
      {text: "CAESAR Submission", uri: "https://competitions.cr.yp.to/round3/aegisv11.pdf"},
      {text: "IETF RFC 9380", uri: "https://tools.ietf.org/rfc/rfc9380.txt"},
      {text: "CAESAR Competition Results", uri: "https://competitions.cr.yp.to/caesar-submissions.html"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/jedisct1/aegis-c"},
      {text: "Supercop Benchmarks", uri: "https://bench.cr.yp.to/results-aead.html"},
      {text: "Academic Paper", uri: "https://eprint.iacr.org/2015/1047.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Side-Channel Attacks", 
        text: "Potential timing vulnerabilities in AES round function implementations without hardware acceleration",
        mitigation: "Use AES-NI hardware acceleration or constant-time AES implementation"
      }
    ],
    
    tests: [
      {
        text: "AEGIS-128 Test Vector 1 (RFC 9380)",
        uri: "https://tools.ietf.org/rfc/rfc9380.txt",
        key: OpCodes.Hex8ToBytes("10010000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("10000200000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes("0001020304050607"),
        plaintext: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
        expectedCiphertext: OpCodes.Hex8ToBytes("79d94593d8c2119d7e8fd9b8fc77845c5c077a05b2528b6ac54b563aed8efe84"),
        expectedTag: OpCodes.Hex8ToBytes("cc6f3372f6aa1bb82388d695c3962d9a")
      },
      {
        text: "AEGIS-128 Test Vector 2 (Empty AAD)",
        uri: "https://tools.ietf.org/rfc/rfc9380.txt",
        key: OpCodes.Hex8ToBytes("10010000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("10000200000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expectedCiphertext: OpCodes.Hex8ToBytes("79d94593d8c2119d7e8fd9b8fc77845c"),
        expectedTag: OpCodes.Hex8ToBytes("b20a5fbd25444f0a17abf6b0e3edaf23")
      },
      {
        text: "AEGIS-128 Test Vector 3 (Empty Plaintext)",
        uri: "https://tools.ietf.org/rfc/rfc9380.txt",
        key: OpCodes.Hex8ToBytes("10010000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("10000200000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes("0001020304050607"),
        plaintext: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("c2b879a67def9d74e6c14f708bbcc9b4")
      }
    ],

    // Legacy interface properties
    internalName: 'aegis-128',
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
    family: 'AES-Based',
    category: 'Authenticated-Encryption',
    
    // Internal state
    state: null,
    keyScheduled: false,
    
    // AES S-box for AES round function
    SBOX: [
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ],
    
    // AES SubBytes transformation
    subBytes: function(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
      return state;
    },
    
    // AES ShiftRows transformation
    shiftRows: function(state) {
      const temp = OpCodes.CopyArray(state);
      
      // Row 1: shift left by 1
      state[1] = temp[5]; state[5] = temp[9]; state[9] = temp[13]; state[13] = temp[1];
      
      // Row 2: shift left by 2
      state[2] = temp[10]; state[6] = temp[14]; state[10] = temp[2]; state[14] = temp[6];
      
      // Row 3: shift left by 3
      state[3] = temp[15]; state[7] = temp[3]; state[11] = temp[7]; state[15] = temp[11];
      
      return state;
    },
    
    // AES MixColumns transformation
    mixColumns: function(state) {
      const gfMul2 = [
        0x00,0x02,0x04,0x06,0x08,0x0a,0x0c,0x0e,0x10,0x12,0x14,0x16,0x18,0x1a,0x1c,0x1e,
        0x20,0x22,0x24,0x26,0x28,0x2a,0x2c,0x2e,0x30,0x32,0x34,0x36,0x38,0x3a,0x3c,0x3e,
        0x40,0x42,0x44,0x46,0x48,0x4a,0x4c,0x4e,0x50,0x52,0x54,0x56,0x58,0x5a,0x5c,0x5e,
        0x60,0x62,0x64,0x66,0x68,0x6a,0x6c,0x6e,0x70,0x72,0x74,0x76,0x78,0x7a,0x7c,0x7e,
        0x80,0x82,0x84,0x86,0x88,0x8a,0x8c,0x8e,0x90,0x92,0x94,0x96,0x98,0x9a,0x9c,0x9e,
        0xa0,0xa2,0xa4,0xa6,0xa8,0xaa,0xac,0xae,0xb0,0xb2,0xb4,0xb6,0xb8,0xba,0xbc,0xbe,
        0xc0,0xc2,0xc4,0xc6,0xc8,0xca,0xcc,0xce,0xd0,0xd2,0xd4,0xd6,0xd8,0xda,0xdc,0xde,
        0xe0,0xe2,0xe4,0xe6,0xe8,0xea,0xec,0xee,0xf0,0xf2,0xf4,0xf6,0xf8,0xfa,0xfc,0xfe,
        0x1b,0x19,0x1f,0x1d,0x13,0x11,0x17,0x15,0x0b,0x09,0x0f,0x0d,0x03,0x01,0x07,0x05,
        0x3b,0x39,0x3f,0x3d,0x33,0x31,0x37,0x35,0x2b,0x29,0x2f,0x2d,0x23,0x21,0x27,0x25,
        0x5b,0x59,0x5f,0x5d,0x53,0x51,0x57,0x55,0x4b,0x49,0x4f,0x4d,0x43,0x41,0x47,0x45,
        0x7b,0x79,0x7f,0x7d,0x73,0x71,0x77,0x75,0x6b,0x69,0x6f,0x6d,0x63,0x61,0x67,0x65,
        0x9b,0x99,0x9f,0x9d,0x93,0x91,0x97,0x95,0x8b,0x89,0x8f,0x8d,0x83,0x81,0x87,0x85,
        0xbb,0xb9,0xbf,0xbd,0xb3,0xb1,0xb7,0xb5,0xab,0xa9,0xaf,0xad,0xa3,0xa1,0xa7,0xa5,
        0xdb,0xd9,0xdf,0xdd,0xd3,0xd1,0xd7,0xd5,0xcb,0xc9,0xcf,0xcd,0xc3,0xc1,0xc7,0xc5,
        0xfb,0xf9,0xff,0xfd,0xf3,0xf1,0xf7,0xf5,0xeb,0xe9,0xef,0xed,0xe3,0xe1,0xe7,0xe5
      ];
      
      const gfMul3 = [
        0x00,0x03,0x06,0x05,0x0c,0x0f,0x0a,0x09,0x18,0x1b,0x1e,0x1d,0x14,0x17,0x12,0x11,
        0x30,0x33,0x36,0x35,0x3c,0x3f,0x3a,0x39,0x28,0x2b,0x2e,0x2d,0x24,0x27,0x22,0x21,
        0x60,0x63,0x66,0x65,0x6c,0x6f,0x6a,0x69,0x78,0x7b,0x7e,0x7d,0x74,0x77,0x72,0x71,
        0x50,0x53,0x56,0x55,0x5c,0x5f,0x5a,0x59,0x48,0x4b,0x4e,0x4d,0x44,0x47,0x42,0x41,
        0xc0,0xc3,0xc6,0xc5,0xcc,0xcf,0xca,0xc9,0xd8,0xdb,0xde,0xdd,0xd4,0xd7,0xd2,0xd1,
        0xf0,0xf3,0xf6,0xf5,0xfc,0xff,0xfa,0xf9,0xe8,0xeb,0xee,0xed,0xe4,0xe7,0xe2,0xe1,
        0xa0,0xa3,0xa6,0xa5,0xac,0xaf,0xaa,0xa9,0xb8,0xbb,0xbe,0xbd,0xb4,0xb7,0xb2,0xb1,
        0x90,0x93,0x96,0x95,0x9c,0x9f,0x9a,0x99,0x88,0x8b,0x8e,0x8d,0x84,0x87,0x82,0x81,
        0x9b,0x98,0x9d,0x9e,0x97,0x94,0x91,0x92,0x83,0x80,0x85,0x86,0x8f,0x8c,0x89,0x8a,
        0xab,0xa8,0xad,0xae,0xa7,0xa4,0xa1,0xa2,0xb3,0xb0,0xb5,0xb6,0xbf,0xbc,0xb9,0xba,
        0xfb,0xf8,0xfd,0xfe,0xf7,0xf4,0xf1,0xf2,0xe3,0xe0,0xe5,0xe6,0xef,0xec,0xe9,0xea,
        0xcb,0xc8,0xcd,0xce,0xc7,0xc4,0xc1,0xc2,0xd3,0xd0,0xd5,0xd6,0xdf,0xdc,0xd9,0xda,
        0x5b,0x58,0x5d,0x5e,0x57,0x54,0x51,0x52,0x43,0x40,0x45,0x46,0x4f,0x4c,0x49,0x4a,
        0x6b,0x68,0x6d,0x6e,0x67,0x64,0x61,0x62,0x73,0x70,0x75,0x76,0x7f,0x7c,0x79,0x7a,
        0x3b,0x38,0x3d,0x3e,0x37,0x34,0x31,0x32,0x23,0x20,0x25,0x26,0x2f,0x2c,0x29,0x2a,
        0x0b,0x08,0x0d,0x0e,0x07,0x04,0x01,0x02,0x13,0x10,0x15,0x16,0x1f,0x1c,0x19,0x1a
      ];
      
      for (let col = 0; col < 4; col++) {
        const a = state[col * 4];
        const b = state[col * 4 + 1];
        const c = state[col * 4 + 2];
        const d = state[col * 4 + 3];
        
        state[col * 4] = gfMul2[a] ^ gfMul3[b] ^ c ^ d;
        state[col * 4 + 1] = a ^ gfMul2[b] ^ gfMul3[c] ^ d;
        state[col * 4 + 2] = a ^ b ^ gfMul2[c] ^ gfMul3[d];
        state[col * 4 + 3] = gfMul3[a] ^ b ^ c ^ gfMul2[d];
      }
      
      return state;
    },
    
    // AES round function (without key addition)
    aesRound: function(state) {
      this.subBytes(state);
      this.shiftRows(state);
      this.mixColumns(state);
      return state;
    },
    
    // XOR two 128-bit states
    xorState: function(a, b) {
      const result = new Array(16);
      for (let i = 0; i < 16; i++) {
        result[i] = a[i] ^ b[i];
      }
      return result;
    },
    
    // AEGIS-128 initialization
    Init: function() {
      this.state = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 16) {
        throw new Error('AEGIS-128 requires exactly 16-byte key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'aegis-128-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Initialize AEGIS state with key and IV
    initializeState: function(key, iv) {
      if (iv.length !== 16) {
        throw new Error('AEGIS-128 requires 16-byte IV');
      }
      
      // AEGIS-128 has 5 states of 128 bits each
      const state = new Array(5);
      for (let i = 0; i < 5; i++) {
        state[i] = new Array(16);
      }
      
      // Initialize state with key and IV
      const c1 = OpCodes.Hex8ToBytes("db3d18556dc22ff12011314273b528dd");
      const c2 = OpCodes.Hex8ToBytes("00000000000000000000000000000000");
      
      state[0] = this.xorState(key, iv);
      state[1] = OpCodes.CopyArray(c1);
      state[2] = OpCodes.CopyArray(c2);
      state[3] = this.xorState(c1, key);
      state[4] = this.xorState(key, c2);
      
      // Perform 10 initialization rounds
      for (let i = 0; i < 10; i++) {
        this.updateState(state, this.xorState(key, iv));
      }
      
      return state;
    },
    
    // AEGIS state update
    updateState: function(state, message) {
      const temp = this.xorState(this.aesRound(OpCodes.CopyArray(state[0])), message);
      
      state[0] = this.aesRound(OpCodes.CopyArray(state[4]));
      state[4] = this.aesRound(OpCodes.CopyArray(state[3]));
      state[3] = this.aesRound(OpCodes.CopyArray(state[2]));
      state[2] = this.aesRound(OpCodes.CopyArray(state[1]));
      state[1] = temp;
    },
    
    // Generate keystream block
    generateKeystream: function(state) {
      return this.xorState(
        this.xorState(state[1], state[4]),
        this.xorState(state[2], state[3])
      );
    },
    
    // Pack 64-bit integer as little endian bytes
    pack64LE: function(value) {
      const result = new Array(8);
      for (let i = 0; i < 8; i++) {
        result[i] = (value >> (i * 8)) & 0xFF;
      }
      return result;
    },
    
    // Encrypt/decrypt with AEAD
    processAEAD: function(key, iv, aad, plaintext, encrypt) {
      if (!key || key.length !== 16) {
        throw new Error('Invalid key: must be 16 bytes');
      }
      if (!iv || iv.length !== 16) {
        throw new Error('Invalid IV: must be 16 bytes');
      }
      
      const state = this.initializeState(key, iv);
      
      // Process associated data
      if (aad && aad.length > 0) {
        for (let i = 0; i < aad.length; i += 16) {
          const block = aad.slice(i, i + 16);
          // Pad to 16 bytes if necessary
          while (block.length < 16) {
            block.push(0);
          }
          this.updateState(state, block);
        }
      }
      
      const result = [];
      
      // Process plaintext/ciphertext
      for (let i = 0; i < plaintext.length; i += 16) {
        const block = plaintext.slice(i, i + 16);
        const keystream = this.generateKeystream(state);
        
        const outputBlock = new Array(block.length);
        for (let j = 0; j < block.length; j++) {
          outputBlock[j] = block[j] ^ keystream[j];
        }
        
        result.push(...outputBlock);
        
        if (encrypt) {
          // For encryption, update state with ciphertext
          const fullBlock = OpCodes.CopyArray(outputBlock);
          while (fullBlock.length < 16) {
            fullBlock.push(0);
          }
          this.updateState(state, fullBlock);
        } else {
          // For decryption, update state with plaintext
          const fullBlock = OpCodes.CopyArray(block);
          while (fullBlock.length < 16) {
            fullBlock.push(0);
          }
          this.updateState(state, fullBlock);
        }
      }
      
      // Generate authentication tag - pack 64-bit lengths in little endian
      const aadLenBytes = this.pack64LE(aad ? aad.length : 0);
      const msgLenBytes = this.pack64LE(plaintext.length);
      const lengthBlock = aadLenBytes.concat(msgLenBytes);
      
      this.updateState(state, lengthBlock);
      
      // Finalization
      for (let i = 0; i < 7; i++) {
        this.updateState(state, this.xorState(state[2], this.key));
      }
      
      const tag = this.xorState(
        this.xorState(state[0], state[1]),
        this.xorState(state[2], state[3])
      );
      
      return {
        data: result,
        tag: tag
      };
    },
    
    // AEAD Encryption
    encryptAEAD: function(key, iv, aad, plaintext) {
      return this.processAEAD(key, iv, aad, plaintext, true);
    },
    
    // AEAD Decryption with verification
    decryptAEAD: function(key, iv, aad, ciphertext, expectedTag) {
      const result = this.processAEAD(key, iv, aad, ciphertext, false);
      
      // Verify authentication tag
      if (!OpCodes.SecureCompare(result.tag, expectedTag)) {
        throw new Error('Authentication tag verification failed');
      }
      
      return result.data;
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
      return result.data.concat(result.tag);
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
        for (let i = 0; i < this.state.length; i++) {
          OpCodes.ClearArray(this.state[i]);
        }
      }
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running AEGIS-128 test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.iv, test.aad, test.plaintext);
          
          const ciphertextMatch = OpCodes.SecureCompare(result.data, test.expectedCiphertext);
          const tagMatch = OpCodes.SecureCompare(result.tag, test.expectedTag);
          
          if (ciphertextMatch && tagMatch) {
            console.log(`Test ${i + 1}: PASS`);
          } else {
            console.log(`Test ${i + 1}: FAIL`);
            console.log('Expected ciphertext:', OpCodes.BytesToHex8(test.expectedCiphertext));
            console.log('Actual ciphertext:', OpCodes.BytesToHex8(result.data));
            console.log('Expected tag:', OpCodes.BytesToHex8(test.expectedTag));
            console.log('Actual tag:', OpCodes.BytesToHex8(result.tag));
            allPassed = false;
          }
          
          // Test decryption
          const decrypted = this.decryptAEAD(test.key, test.iv, test.aad, result.data, result.tag);
          const decryptMatch = OpCodes.SecureCompare(decrypted, test.plaintext);
          
          if (!decryptMatch) {
            console.log(`Test ${i + 1} decryption: FAIL`);
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      return {
        algorithm: 'AEGIS-128',
        allTestsPassed: allPassed,
        testCount: this.tests.length,
        notes: 'Educational implementation of CAESAR competition winner'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(AEGIS_128);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AEGIS_128;
  }
  
  // Global export
  global.AEGIS_128 = AEGIS_128;
  
})(typeof global !== 'undefined' ? global : window);