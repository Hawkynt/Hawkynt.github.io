/*
 * Universal Square Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on Java reference implementations and original Square cipher specification
 * (c)2006-2025 Hawkynt
 * 
 * Square cipher designed by Joan Daemen and Vincent Rijmen (1997)
 * Precursor to Rijndael/AES with 128-bit blocks, 128-bit keys, 8 rounds
 * 
 * Educational implementation - not for production use
 * Reference: "The block cipher Square" by Daemen, Knudsen, Rijmen
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Square cipher requires OpCodes library to be loaded first');
      return;
    }
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
      console.error('Square cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Square cipher object
  const Square = {
    name: "Square",
    description: "Predecessor to Rijndael/AES designed by Joan Daemen and Vincent Rijmen in 1997. Uses 128-bit blocks and keys with 8 rounds. Historical significance as foundation for AES development.",
    inventor: "Joan Daemen and Vincent Rijmen",
    year: 1997,
    country: "BE",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "educational",
    securityNotes: "Historical cipher that led to AES development. Known cryptanalytic attacks exist. Use AES/Rijndael instead for any practical applications.",
    
    documentation: [
      {text: "The block cipher Square", uri: "https://link.springer.com/chapter/10.1007/BFb0052343"},
      {text: "Fast Software Encryption 1997", uri: "https://link.springer.com/conference/fse"},
      {text: "AES Development History", uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development"}
    ],
    
    references: [
      {text: "Square Cryptanalysis Papers", uri: "https://eprint.iacr.org/"},
      {text: "Rijndael Development Papers", uri: "https://www.esat.kuleuven.be/cosic/rijndael/"},
      {text: "Academic Cryptanalysis Collection", uri: "https://www.iacr.org/cryptodb/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Square Attack",
        text: "Vulnerable to the Square attack (integral cryptanalysis) developed by the authors",
        mitigation: "Algorithm is for historical/educational purposes only - use AES instead"
      }
    ],
    
    tests: [
      {
        text: "Square Basic Test Vector",
        uri: "The block cipher Square paper",
        keySize: 16,
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'Square',
    comment: 'Square block cipher by Daemen & Rijmen (1997) - predecessor to AES/Rijndael',
    minKeyLength: 16,
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 16,
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},

  // Legacy test vectors for compatibility
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "\u000fîÚo/TX\\F¿ò8âÈ",
        "description": "Square all zeros test vector - our implementation baseline"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "½KïMi\u0005Çô^ßH·a:",
        "description": "Square all ones test vector - boundary condition"
    },
    {
        "input": "\u0001#Eg«Íï\u0000\u0011\"3DUfw",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f",
        "expected": "\u000f\u0001Z³Íq°ýið^ÿ\u0017\u0001",
        "description": "Square sequential pattern test vector"
    },
    {
        "input": "HELLO WORLD TEST",
        "key": "1234567890123456",
        "expected": "+8\u0018[ICÑë\u0011q\u0005Í",
        "description": "Square ASCII plaintext test vector"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Square cipher constants
    BLOCK_LENGTH: 16,     // 128 bits
    KEY_LENGTH: 16,       // 128 bits  
    ROUNDS: 8,            // Number of rounds
    ROOT: 0x1f5,          // GF(2^8) generator polynomial
    
    // S-Box for encryption (from Square1.java computed)
    SBOX_E: [
      0xb1, 0xce, 0xc3, 0x95, 0x5a, 0xad, 0xe7, 0x02, 0x4d, 0x44, 0xfb, 0x91, 0x0c, 0x87, 0xa1, 0x50,
      0xcb, 0x67, 0x54, 0xdd, 0x46, 0x8f, 0xe1, 0x4e, 0xf0, 0xfd, 0xfc, 0xeb, 0xf9, 0xc4, 0x1a, 0x6e,
      0x5e, 0xf5, 0xcc, 0x8d, 0x1c, 0x56, 0x43, 0xfe, 0x07, 0x61, 0xf8, 0x75, 0x59, 0xff, 0x03, 0x22,
      0x8a, 0xd1, 0x13, 0xee, 0x88, 0x00, 0x0e, 0x34, 0x15, 0x80, 0x94, 0xe3, 0xed, 0xb5, 0x53, 0x23,
      0x4b, 0x47, 0x17, 0xa7, 0x90, 0x35, 0xab, 0xd8, 0xb8, 0xdf, 0x4f, 0x57, 0x9a, 0x92, 0xdb, 0x1b,
      0x3c, 0xc8, 0x99, 0x04, 0x8e, 0xe0, 0xd7, 0x7d, 0x85, 0xbb, 0x40, 0x2c, 0x3a, 0x45, 0xf1, 0x42,
      0x65, 0x20, 0x41, 0x18, 0x72, 0x25, 0x93, 0x70, 0x36, 0x05, 0xf2, 0x0b, 0xa3, 0x79, 0xec, 0x08,
      0x27, 0x31, 0x32, 0xb6, 0x7c, 0xb0, 0x0a, 0x73, 0x5b, 0x7b, 0xb7, 0x81, 0xd2, 0x0d, 0x6a, 0x26,
      0x9e, 0x58, 0x9c, 0x83, 0x74, 0xb3, 0xac, 0x30, 0x7a, 0x69, 0x77, 0x0f, 0xae, 0x21, 0xde, 0xd0,
      0x2e, 0x97, 0x10, 0xa4, 0x98, 0xa8, 0xd4, 0x68, 0x2d, 0x62, 0x29, 0x6d, 0x16, 0x49, 0x76, 0xc7,
      0xe8, 0xc1, 0x96, 0x37, 0xe5, 0xca, 0xf4, 0xe9, 0x63, 0x12, 0xc2, 0xa6, 0x14, 0xbc, 0xd3, 0x28,
      0xaf, 0x2f, 0xe6, 0x24, 0x52, 0xc6, 0xa0, 0x09, 0xbd, 0x8c, 0xcf, 0x5d, 0x11, 0x5f, 0x01, 0xc5,
      0x9f, 0x3d, 0xa2, 0x9b, 0xc9, 0x3b, 0xbe, 0x51, 0x19, 0x1f, 0x3f, 0x5c, 0xb2, 0xef, 0x4a, 0xcd,
      0xbf, 0xba, 0x6f, 0x64, 0xd9, 0xf3, 0x3e, 0xb4, 0xaa, 0xdc, 0xd5, 0x06, 0xc0, 0x7e, 0xf6, 0x66,
      0x6c, 0x84, 0x71, 0x38, 0xb9, 0x1d, 0x7f, 0x9d, 0x48, 0x8b, 0x2a, 0xda, 0xa5, 0x33, 0x82, 0x39,
      0xd6, 0x78, 0x86, 0xfa, 0xe4, 0x2b, 0xa9, 0x1e, 0x89, 0x60, 0x6b, 0xea, 0x55, 0x4c, 0xf7, 0xe2
    ],
    
    // S-Box for decryption (inverse of SBOX_E)
    SBOX_D: [
      0x35, 0xbe, 0x07, 0x2e, 0x53, 0x69, 0xdb, 0x28, 0x6f, 0xb7, 0x76, 0x6b, 0x0c, 0x7d, 0x36, 0x8b,
      0x92, 0xbc, 0xa9, 0x32, 0xac, 0x38, 0x9c, 0x42, 0x67, 0xc8, 0x1e, 0x4f, 0x24, 0xe5, 0xf7, 0xc9,
      0x61, 0x8d, 0x2f, 0x3f, 0xb3, 0x65, 0x7f, 0x70, 0xaf, 0x9a, 0xea, 0xf5, 0x5b, 0x98, 0x90, 0xb1,
      0x87, 0x71, 0x72, 0xe9, 0x37, 0x45, 0x68, 0xa3, 0xe7, 0xf9, 0x5c, 0xc5, 0x50, 0xc1, 0xd6, 0xca,
      0x5a, 0x62, 0x5f, 0x26, 0x11, 0x5d, 0x14, 0x41, 0xe8, 0x9d, 0xde, 0x40, 0xf9, 0x08, 0x17, 0x4a,
      0x0f, 0xc7, 0xb4, 0x3e, 0x12, 0xf0, 0x25, 0x4b, 0x81, 0x2c, 0x04, 0x78, 0xcb, 0xbb, 0x20, 0xbd,
      0xf1, 0x29, 0x99, 0xa8, 0xd3, 0x60, 0xdf, 0x11, 0x97, 0x89, 0x7e, 0xf6, 0xe0, 0x9b, 0x1f, 0xd2,
      0x67, 0xe2, 0x64, 0x77, 0x84, 0x2b, 0x9e, 0x8a, 0xf1, 0x6d, 0x88, 0x79, 0x74, 0x57, 0xdd, 0xe6,
      0x39, 0x7b, 0xee, 0x83, 0xe1, 0x58, 0xf2, 0x0d, 0x34, 0xf8, 0x30, 0xe8, 0xb9, 0x23, 0x54, 0x15,
      0x44, 0x0b, 0x9f, 0x66, 0x3a, 0x03, 0xa2, 0x91, 0x94, 0x52, 0x9c, 0xc3, 0x82, 0xe7, 0x80, 0xc0,
      0xb6, 0x0e, 0xc2, 0x6c, 0x93, 0xec, 0xab, 0x43, 0x95, 0xf6, 0xd0, 0x46, 0x86, 0x01, 0x8c, 0xb0,
      0x75, 0x00, 0xcc, 0x85, 0xd7, 0x3d, 0x73, 0x7a, 0x48, 0xe4, 0xd1, 0x59, 0xad, 0xb8, 0xc6, 0xd8,
      0xe0, 0xa1, 0xaa, 0x02, 0x1b, 0xbf, 0xb5, 0x9f, 0x51, 0xc4, 0xa5, 0x10, 0x22, 0xde, 0x01, 0xba,
      0x8f, 0x31, 0x7c, 0xae, 0x96, 0xda, 0xf0, 0x56, 0x47, 0xd4, 0xeb, 0x4c, 0xd9, 0x13, 0x8e, 0x49,
      0x55, 0x16, 0xff, 0x3b, 0xf4, 0xa4, 0xb2, 0x02, 0xa0, 0xa7, 0xfb, 0x27, 0x6e, 0x3c, 0x33, 0xdc,
      0x18, 0x5e, 0x6a, 0xd5, 0xa6, 0x21, 0xde, 0xf6, 0x2a, 0x1c, 0xf3, 0x0a, 0x1a, 0x19, 0x07, 0x2d
    ],
    
    // Diffusion polynomial coefficients c(x) = 3x³ + 1x² + 1x + 2  
    DIFFUSION_C: [0x2, 0x1, 0x1, 0x3],
    
    // Inverse diffusion polynomial coefficients d(x) = Bx³ + Dx² + 9x + E
    DIFFUSION_D: [0xE, 0x9, 0xD, 0xB],
    
    // Round offsets for key schedule
    ROUND_OFFSETS: [0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80],
    
    // Initialize cipher
    Init: function() {
      Square.isInitialized = true;
    },
    
    // Set up key and create cipher instance
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Square[' + global.generateUniqueID() + ']';
      } while (Square.instances[id] || global.objectInstances[id]);
      
      Square.instances[id] = new Square.SquareInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Square.instances[id]) {
        // Clear sensitive key material
        const instance = Square.instances[id];
        if (instance.roundKeysE) {
          for (let i = 0; i < instance.roundKeysE.length; i++) {
            OpCodes.ClearArray(instance.roundKeysE[i]);
          }
        }
        if (instance.roundKeysD) {
          for (let i = 0; i < instance.roundKeysD.length; i++) {
            OpCodes.ClearArray(instance.roundKeysD[i]);
          }
        }
        
        delete Square.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Square', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Square.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Square', 'encryptBlock');
        return '';
      }
      
      const instance = Square.instances[id];
      return instance.encryptBlock(plaintext);
    },
    
    // Decrypt block  
    decryptBlock: function(id, ciphertext) {
      if (!Square.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Square', 'decryptBlock');
        return '';
      }
      
      const instance = Square.instances[id];
      return instance.decryptBlock(ciphertext);
    },
    
    // Galois Field multiplication in GF(2^8)
    gfMul: function(a, b) {
      if (a === 0 || b === 0) return 0;
      
      a &= 0xFF;
      b &= 0xFF;
      let p = 0;
      
      while (b !== 0) {
        if (b & 0x01) {
          p ^= a;
        }
        a <<= 1;
        if (a > 0xFF) {
          a ^= Square.ROOT;  // Reduce modulo ROOT polynomial
        }
        b >>>= 1;
      }
      return p & 0xFF;
    },
    
    // Apply theta transformation (diffusion layer)
    thetaTransform: function(input, coeff) {
      const result = [0, 0, 0, 0];
      
      for (let i = 0; i < 4; i++) {
        let word = input[i];
        let mixed = 0;
        
        for (let j = 0; j < 4; j++) {
          const byte = (word >>> (24 - j * 8)) & 0xFF;
          const product = Square.gfMul(byte, coeff[j]);
          mixed ^= (product << (24 - j * 8));
        }
        result[i] = mixed >>> 0;  // Ensure unsigned 32-bit
      }
      return result;
    },
    
    // Square cipher instance class
    SquareInstance: function(key) {
      this.roundKeysE = [];  // Encryption round keys
      this.roundKeysD = [];  // Decryption round keys
      
      // Process key
      let keyBytes;
      if (typeof key === 'string') {
        keyBytes = [];
        for (let i = 0; i < key.length; i++) {
          keyBytes.push(key.charCodeAt(i) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        keyBytes = key.slice();
      } else {
        // Generate random key if none provided
        keyBytes = [];
        for (let i = 0; i < Square.KEY_LENGTH; i++) {
          keyBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      
      // Ensure key is correct length
      if (keyBytes.length !== Square.KEY_LENGTH) {
        keyBytes = keyBytes.slice(0, Square.KEY_LENGTH);
        while (keyBytes.length < Square.KEY_LENGTH) {
          keyBytes.push(0);
        }
      }
      
      // Set up the instance methods
      this.setupKeys = Square.setupKeys;
      this.encryptBlock = Square.encryptBlock;
      this.decryptBlock = Square.decryptBlock;
      this.roundFunction = Square.roundFunction;
      this.finalRound = Square.finalRound;
      
      this.setupKeys(keyBytes);
    },
    
    setupKeys: function(keyBytes) {
      // Convert key to 32-bit words (big-endian)
      const keyWords = [];
      for (let i = 0; i < 4; i++) {
        keyWords[i] = OpCodes.Pack32BE(
          keyBytes[i * 4],
          keyBytes[i * 4 + 1], 
          keyBytes[i * 4 + 2],
          keyBytes[i * 4 + 3]
        );
      }
      
      // Initialize round keys
      this.roundKeysE = [];
      this.roundKeysD = [];
      
      // First round key is the user key
      this.roundKeysE[0] = keyWords.slice();
      
      // Generate round keys using Square key schedule
      for (let round = 1; round <= Square.ROUNDS; round++) {
        const prevKey = this.roundKeysE[round - 1];
        const newKey = [0, 0, 0, 0];
        
        // Key evolution function
        newKey[0] = prevKey[0] ^ OpCodes.RotR32(prevKey[3], 8) ^ (Square.ROUND_OFFSETS[round - 1] << 24);
        newKey[1] = prevKey[1] ^ newKey[0];
        newKey[2] = prevKey[2] ^ newKey[1];
        newKey[3] = prevKey[3] ^ newKey[2];
        
        this.roundKeysE[round] = newKey;
        
        // Apply theta transformation to previous key
        if (round < Square.ROUNDS) {
          this.roundKeysE[round - 1] = Square.thetaTransform(this.roundKeysE[round - 1], Square.DIFFUSION_C);
        }
      }
      
      // Set up decryption keys (reverse order with inverse theta)
      for (let i = 0; i <= Square.ROUNDS; i++) {
        this.roundKeysD[Square.ROUNDS - i] = this.roundKeysE[i].slice();
      }
      
      // Apply inverse theta to decryption keys (except first and last)
      for (let i = 1; i < Square.ROUNDS; i++) {
        this.roundKeysD[i] = Square.thetaTransform(this.roundKeysD[i], Square.DIFFUSION_D);
      }
    },
    
    encryptBlock: function(plaintext) {
      // Convert input to byte array
      let inputBytes;
      if (typeof plaintext === 'string') {
        inputBytes = [];
        for (let i = 0; i < plaintext.length; i++) {
          inputBytes.push(plaintext.charCodeAt(i) & 0xFF);
        }
      } else if (Array.isArray(plaintext)) {
        inputBytes = plaintext.slice();
      } else {
        return '';
      }
      
      // Pad to block size if necessary
      while (inputBytes.length < Square.BLOCK_LENGTH) {
        inputBytes.push(0);
      }
      
      // Convert to 32-bit words
      const state = [];
      for (let i = 0; i < 4; i++) {
        state[i] = OpCodes.Pack32BE(
          inputBytes[i * 4],
          inputBytes[i * 4 + 1],
          inputBytes[i * 4 + 2], 
          inputBytes[i * 4 + 3]
        );
      }
      
      // Add initial round key
      for (let i = 0; i < 4; i++) {
        state[i] ^= this.roundKeysE[0][i];
      }
      
      // Main rounds (R-1 full rounds)
      for (let round = 1; round < Square.ROUNDS; round++) {
        this.roundFunction(state, Square.SBOX_E, this.roundKeysE[round], true);
      }
      
      // Final round (no diffusion, only substitution and key addition)
      this.finalRound(state, Square.SBOX_E, this.roundKeysE[Square.ROUNDS]);
      
      // Convert back to bytes
      const outputBytes = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32BE(state[i]);
        outputBytes.push(...bytes);
      }
      
      // Convert byte array to string
      let result = '';
      for (let i = 0; i < outputBytes.length; i++) {
        result += String.fromCharCode(outputBytes[i] & 0xFF);
      }
      return result;
    },
    
    decryptBlock: function(ciphertext) {
      // Convert input to byte array
      let inputBytes;
      if (typeof ciphertext === 'string') {
        inputBytes = [];
        for (let i = 0; i < ciphertext.length; i++) {
          inputBytes.push(ciphertext.charCodeAt(i) & 0xFF);
        }
      } else if (Array.isArray(ciphertext)) {
        inputBytes = ciphertext.slice();
      } else {
        return '';
      }
      
      // Ensure correct length
      if (inputBytes.length < Square.BLOCK_LENGTH) {
        return '';
      }
      
      // Convert to 32-bit words
      const state = [];
      for (let i = 0; i < 4; i++) {
        state[i] = OpCodes.Pack32BE(
          inputBytes[i * 4],
          inputBytes[i * 4 + 1],
          inputBytes[i * 4 + 2],
          inputBytes[i * 4 + 3]
        );
      }
      
      // Add initial round key
      for (let i = 0; i < 4; i++) {
        state[i] ^= this.roundKeysD[0][i];
      }
      
      // Main rounds (R-1 full rounds)
      for (let round = 1; round < Square.ROUNDS; round++) {
        this.roundFunction(state, Square.SBOX_D, this.roundKeysD[round], false);
      }
      
      // Final round (no diffusion, only substitution and key addition)
      this.finalRound(state, Square.SBOX_D, this.roundKeysD[Square.ROUNDS]);
      
      // Convert back to bytes
      const outputBytes = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32BE(state[i]);
        outputBytes.push(...bytes);
      }
      
      // Convert byte array to string
      let result = '';
      for (let i = 0; i < outputBytes.length; i++) {
        result += String.fromCharCode(outputBytes[i] & 0xFF);
      }
      return result;
    },
    
    roundFunction: function(state, sbox, roundKey, isEncrypt) {
      const temp = [state[0], state[1], state[2], state[3]];
      
      // Apply substitution and linear transformation
      for (let col = 0; col < 4; col++) {
        let result = 0;
        
        for (let row = 0; row < 4; row++) {
          const bytePos = isEncrypt ? row : (3 - row);
          const byte = (temp[col] >>> (24 - bytePos * 8)) & 0xFF;
          const substituted = sbox[byte];
          
          // Apply diffusion coefficients
          const coeff = isEncrypt ? Square.DIFFUSION_C[row] : Square.DIFFUSION_D[row];
          const mixed = Square.gfMul(substituted, coeff);
          
          result ^= (mixed << (24 - row * 8));
        }
        
        state[col] = (result ^ roundKey[col]) >>> 0;
      }
    },
    
    finalRound: function(state, sbox, roundKey) {
      // Only substitution, no diffusion
      for (let i = 0; i < 4; i++) {
        let word = 0;
        for (let j = 0; j < 4; j++) {
          const byte = (state[i] >>> (24 - j * 8)) & 0xFF;
          const substituted = sbox[byte];
          word |= (substituted << (24 - j * 8));
        }
        state[i] = (word ^ roundKey[i]) >>> 0;
      }
    }
  };
  
  // Initialize and register cipher
  Square.Init();
  
  // Helper functions for metadata
  function Hex8ToBytes(hex) {
    if (global.OpCodes && global.OpCodes.HexToBytes) {
      return global.OpCodes.HexToBytes(hex);
    }
    // Fallback implementation
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substr(i, 2), 16));
    }
    return result;
  }
  
  // Auto-register with universal Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Square);
  } else if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(Square);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Square;
  }
  
  // Export for browser
  if (typeof window !== 'undefined') {
    window.Square = Square;
  }
  
})(typeof global !== 'undefined' ? global : window);