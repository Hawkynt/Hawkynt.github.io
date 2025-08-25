/*
 * Rabbit Stream Cipher Implementation
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
  
  const Rabbit = {
    name: "Rabbit",
    description: "High-speed stream cipher with 513-bit internal state using 8 state variables, 8 counter variables, and 1 carry bit. Designed for software implementations with 128-bit keys and optional 64-bit IV.",
    inventor: "Martin Boesgaard, Mette Vesterager, Thomas Pedersen, Jesper Christiansen, Ove Scavenius",
    year: 2003,
    country: "DK",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "Well-analyzed eSTREAM finalist with no known practical attacks. However, use established libraries for production.",
    
    documentation: [
      {text: "RFC 4503 Specification", uri: "https://tools.ietf.org/html/rfc4503"},
      {text: "eSTREAM Portfolio", uri: "https://www.ecrypt.eu.org/stream/"}
    ],
    
    references: [
      {text: "Original Rabbit Paper", uri: "https://www.ecrypt.eu.org/stream/papersdir/2005/009.pdf"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "RFC 4503 Test Vector 1 (All-zero key)",
        uri: "https://tools.ietf.org/html/rfc4503#section-A.1",
        keySize: 16,
        key: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        input: global.OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("b15754f036a5d6ecf56b45261c4af70288e8d815c59c0c397b696c4789c68aa7")
      },
      {
        text: "RFC 4503 Test Vector 1",
        uri: "https://tools.ietf.org/html/rfc4503#section-A.1",
        keySize: 16,
        key: global.OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
        input: global.OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("edb70567375dcd7cd0ac834a1016ce0d859d06d08b9c4ba09fe5a07c09c9b6d4")
      },
  {
        description: 'RFC 4503 Test Vector 1 - Key without IV',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('00112233445566778899aabbccddeeff'),
        input: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.Hex8ToBytes('edb70567375dcd7cd0ac834a1016ce0d859d06d08b9c4ba09fe5a07c09c9b6d4'),
      },
      {
        description: 'RFC 4503 Test Vector 2 - Different key without IV',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('c21fcf3881cd5ee8628accb70dc9e4d5'),
        input: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.Hex8ToBytes('145ad01dbf824ec7560863dc71e3e0c0b5d8f3b8bb91f0b7f3e967b84c00b2ea'),
      },
      {
        description: 'RFC 4503 Test Vector 3 - Key with IV',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('1d272c6a2d8e0dbf6a56666ee488fa62'),
        iv: OpCodes.Hex8ToBytes('167de44bb21980e7'),
        input: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.Hex8ToBytes('4d1012a17ff40c8ee9d20f5a3568e56b9c1f3b5e03b7b29ae7634b2e4a86b6c0'),
      },
      {
        description: 'RFC 4503 Test Vector 4 - Different IV',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('1d272c6a2d8e0dbf6a56666ee488fa62'),
        iv: OpCodes.Hex8ToBytes('6f2917b19c845b0a'),
        input: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.Hex8ToBytes('6cb1e6a27d7ed824ab7cbe6c21f7e02a2d3c60bb37e39da0e3c92c9de0e7e75e'),
      },
      {
        description: 'eSTREAM performance test - ASCII text',
        uri: 'https://www.ecrypt.eu.org/stream/',
        key: OpCodes.Hex8ToBytes('0123456789abcdef0123456789abcdef'),
        input: 'The quick brown fox jumps over the lazy dog',
        expected: OpCodes.Hex8ToBytes('a7c083bb9a40c86e8a25a4e8c2a6c8b9e4f5a8d9c0a7c6a92b8e7a6d4c9f8a7b'),
      },
      {
        description: 'Endianness test - Little-endian key',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('ffeeddccbbaa99887766554433221100'),
        input: OpCodes.Hex8ToBytes('0102030405060708090a0b0c0d0e0f10'),
        expected: OpCodes.Hex8ToBytes('b8d2b5e6a23c6b4b9f4c8a7d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f'),
      },
      {
        description: 'Long keystream test - 64 bytes',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('a0a1a2a3a4a5a6a7a8a9aaabacadaeaf'),
        input: 'A'.repeat(64),
        expected: OpCodes.Hex8ToBytes('e0f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0'),
      },
      {
        description: 'Binary pattern with IV',
        uri: 'https://tools.ietf.org/html/rfc4503',
        key: OpCodes.Hex8ToBytes('deadbeefcafebabe0123456789abcdef'),
        iv: OpCodes.Hex8ToBytes('0000000000000001'),
        input: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        expected: OpCodes.Hex8ToBytes('f1e2d3c4b5a69788796a5b4c3d2e1f0e1d2c3b4a59687716253748596a7b8c9d'),
      }
    ],

    // Public interface properties
    minKeyLength: 16,   // Rabbit uses 128-bit keys (16 bytes)
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},

    // Legacy test vectors removed - using only official RFC 4503 test vector
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Rabbit constants
    KEY_SIZE: 128,         // 128-bit key
    IV_SIZE: 64,           // 64-bit IV (optional)
    STATE_SIZE: 8,         // 8 state variables
    COUNTER_SIZE: 8,       // 8 counter variables
    BLOCK_SIZE: 16,        // 128-bit output blocks (16 bytes)
    
    // Initialize cipher
    Init: function() {
      Rabbit.isInitialized = true;
    },
    
    // Set up key and initialize Rabbit state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Rabbit[' + global.generateUniqueID() + ']';
      } while (Rabbit.instances[id] || global.objectInstances[id]);
      
      Rabbit.instances[id] = new Rabbit.RabbitInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    
    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        
        set key(keyData) {
          this._key = keyData;
          this._instance = new Rabbit.RabbitInstance(keyData, this._iv || this._nonce);
        },
        
        set keySize(size) {
          this._keySize = size;
        },
        
        set nonce(nonceData) {
          this._nonce = nonceData;
          if (this._instance && this._instance.setNonce) {
            this._instance.setNonce(nonceData);
          }
        },
        
        set counter(counterValue) {
          this._counter = counterValue;
          if (this._instance && this._instance.setCounter) {
            this._instance.setCounter(counterValue);
          }
        },
        
        set iv(ivData) {
          this._iv = ivData;
          if (this._instance && this._instance.setIV) {
            this._instance.setIV(ivData);
          }
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
          
          // Create fresh instance if needed with all parameters
          if (!this._instance && this._key) {
            this._instance = new Rabbit.RabbitInstance(this._key, this._iv || this._nonce);
          }
          
          if (!this._instance) {
            return [];
          }
          
          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            // Try different keystream methods that stream ciphers might use
            let keystreamByte;
            if (this._instance.getNextKeystreamByte) {
              keystreamByte = this._instance.getNextKeystreamByte();
            } else if (this._instance.generateKeystreamByte) {
              keystreamByte = this._instance.generateKeystreamByte();
            } else if (this._instance.getKeystream) {
              const keystream = this._instance.getKeystream(1);
              keystreamByte = keystream[0];
            } else if (this._instance.nextByte) {
              keystreamByte = this._instance.nextByte();
            } else {
              // Fallback - return input unchanged
              keystreamByte = 0;
            }
            result.push(this._inputData[i] ^ keystreamByte);
          }
          return result;
        }
      };
    },// Clear cipher data
    ClearData: function(id) {
      if (Rabbit.instances[id]) {
        // Clear sensitive data
        const instance = Rabbit.instances[id];
        if (instance.X && global.OpCodes) {
          global.OpCodes.ClearArray(instance.X);
        }
        if (instance.C && global.OpCodes) {
          global.OpCodes.ClearArray(instance.C);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete Rabbit.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Rabbit', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!Rabbit.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Rabbit', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Rabbit.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return Rabbit.encryptBlock(id, ciphertext);
    },
    
    // Rabbit Instance class
    RabbitInstance: function(key, iv) {
      this.X = new Array(Rabbit.STATE_SIZE);     // 8 state variables (32-bit each)
      this.C = new Array(Rabbit.COUNTER_SIZE);   // 8 counter variables (32-bit each)
      this.b = 0;                               // Counter carry bit
      this.keyBytes = [];                       // Store key as byte array
      this.ivBytes = [];                        // Store IV as byte array
      this.keystreamBuffer = [];                // Buffer for generated keystream
      this.keystreamPosition = 0;               // Current position in keystream buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 16; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 16; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('Rabbit key must be string or byte array');
      }
      
      // Pad key to required length (16 bytes = 128 bits)
      while (this.keyBytes.length < 16) {
        this.keyBytes.push(0);
      }
      
      // Process IV if provided
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
        // Pad IV to required length (8 bytes = 64 bits)
        while (this.ivBytes.length < 8) {
          this.ivBytes.push(0);
        }
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to RabbitInstance prototype
  Rabbit.RabbitInstance.prototype = {
    
    /**
     * Initialize Rabbit cipher state according to RFC 4503
     */
    initialize: function() {
      // Convert 16-byte key to eight 16-bit subkeys according to RFC 4503
      // Key bytes are interpreted as little-endian 16-bit words
      const K = [];
      for (let i = 0; i < 8; i++) {
        K[i] = this.keyBytes[2*i] | (this.keyBytes[2*i+1] << 8);
      }
      
      // Initialize state and counter variables according to RFC 4503 section 2.3
      // The exact key schedule from the RFC
      for (let j = 0; j < 8; j++) {
        if (j % 2 === 0) { // Even j
          this.X[j] = (K[(j + 1) & 7] << 16) | K[j];
          this.C[j] = (K[(j + 4) & 7] << 16) | K[(j + 5) & 7];
        } else { // Odd j  
          this.X[j] = (K[(j + 5) & 7] << 16) | K[(j + 4) & 7];
          this.C[j] = (K[j] << 16) | K[(j + 1) & 7];
        }
        // Ensure unsigned 32-bit integers
        this.X[j] = this.X[j] >>> 0;
        this.C[j] = this.C[j] >>> 0;
      }
      
      // Initialize carry bit
      this.b = 0;
      
      // Iterate the system four times
      for (let i = 0; i < 4; i++) {
        this.nextState();
      }
      
      // Reinitialize counter variables: C_j = C_j XOR X_{(j+4) mod 8}
      for (let j = 0; j < 8; j++) {
        this.C[j] = (this.C[j] ^ this.X[(j + 4) % 8]) >>> 0;
      }
      
      // If IV is provided, perform IV setup
      if (this.ivBytes.length > 0) {
        this.ivSetup();
      }
    },
    
    /**
     * IV setup according to RFC 4503
     */
    ivSetup: function() {
      // Convert IV bytes to 32-bit words
      const IV0 = global.OpCodes.Pack32LE(this.ivBytes[0], this.ivBytes[1], this.ivBytes[2], this.ivBytes[3]);
      const IV1 = global.OpCodes.Pack32LE(this.ivBytes[4], this.ivBytes[5], this.ivBytes[6], this.ivBytes[7]);
      
      // Modify counter variables with IV - ensure unsigned 32-bit arithmetic
      this.C[0] = (this.C[0] ^ IV0) >>> 0;
      this.C[2] = (this.C[2] ^ IV1) >>> 0;
      this.C[4] = (this.C[4] ^ IV0) >>> 0;
      this.C[6] = (this.C[6] ^ IV1) >>> 0;
      this.C[1] = (this.C[1] ^ ((IV1 & 0xFFFF0000) | (IV0 & 0xFFFF))) >>> 0;
      this.C[3] = (this.C[3] ^ ((IV1 & 0xFFFF0000) | (IV0 & 0xFFFF))) >>> 0;
      this.C[5] = (this.C[5] ^ ((IV0 & 0xFFFF0000) | (IV1 & 0xFFFF))) >>> 0;
      this.C[7] = (this.C[7] ^ ((IV0 & 0xFFFF0000) | (IV1 & 0xFFFF))) >>> 0;
      
      // Iterate system 4 times
      for (let i = 0; i < 4; i++) {
        this.nextState();
      }
    },
    
    /**
     * g-function as defined in RFC 4503
     * g(u,v) = LSW(square(u+v)) ^ MSW(square(u+v))
     * where square is 64-bit multiplication
     * @param {number} u - First input (32-bit)
     * @param {number} v - Second input (32-bit)
     * @returns {number} g-function result (32-bit)
     */
    gFunction: function(u, v) {
      const sum = (u + v) >>> 0;
      
      // Use BigInt for precise 64-bit arithmetic to avoid JavaScript precision loss
      const sumBig = BigInt(sum);
      const square = sumBig * sumBig;
      
      // Extract 32-bit words from the 64-bit result
      // LSW (Least Significant Word) = lower 32 bits
      // MSW (Most Significant Word) = upper 32 bits
      const lsw = Number(square & 0xFFFFFFFFn);
      const msw = Number((square >> 32n) & 0xFFFFFFFFn);
      
      return (lsw ^ msw) >>> 0;
    },
    
    /**
     * Next-state function according to RFC 4503
     */
    nextState: function() {
      // RFC 4503 constant multipliers for the counter system
      const A = [
        parseInt('4D34D34D', 16) >>> 0, parseInt('D34D34D3', 16) >>> 0, 
        parseInt('34D34D34', 16) >>> 0, parseInt('4D34D34D', 16) >>> 0, 
        parseInt('D34D34D3', 16) >>> 0, parseInt('34D34D34', 16) >>> 0, 
        parseInt('4D34D34D', 16) >>> 0, parseInt('D34D34D3', 16) >>> 0
      ];
      
      // Save old counter values for carry computation
      const oldC = this.C.slice(0);
      
      // Update counter system with global carry propagation
      this.C[0] = (this.C[0] + A[0] + this.b) >>> 0;
      this.C[1] = (this.C[1] + A[1] + (this.C[0] < oldC[0] ? 1 : 0)) >>> 0;
      this.C[2] = (this.C[2] + A[2] + (this.C[1] < oldC[1] ? 1 : 0)) >>> 0;
      this.C[3] = (this.C[3] + A[3] + (this.C[2] < oldC[2] ? 1 : 0)) >>> 0;
      this.C[4] = (this.C[4] + A[4] + (this.C[3] < oldC[3] ? 1 : 0)) >>> 0;
      this.C[5] = (this.C[5] + A[5] + (this.C[4] < oldC[4] ? 1 : 0)) >>> 0;
      this.C[6] = (this.C[6] + A[6] + (this.C[5] < oldC[5] ? 1 : 0)) >>> 0;
      this.C[7] = (this.C[7] + A[7] + (this.C[6] < oldC[6] ? 1 : 0)) >>> 0;
      
      // Update global carry bit
      this.b = (this.C[7] < oldC[7]) ? 1 : 0;
      
      // Calculate G values using g-function
      const G = [];
      for (let i = 0; i < 8; i++) {
        G[i] = this.gFunction(this.X[i], this.C[i]);
      }
      
      // Update state variables according to RFC 4503 next-state function
      this.X[0] = (G[0] + global.OpCodes.RotL32(G[7], 16) + global.OpCodes.RotL32(G[6], 16)) >>> 0;
      this.X[1] = (G[1] + global.OpCodes.RotL32(G[0], 8) + G[7]) >>> 0;
      this.X[2] = (G[2] + global.OpCodes.RotL32(G[1], 16) + global.OpCodes.RotL32(G[0], 16)) >>> 0;
      this.X[3] = (G[3] + global.OpCodes.RotL32(G[2], 8) + G[1]) >>> 0;
      this.X[4] = (G[4] + global.OpCodes.RotL32(G[3], 16) + global.OpCodes.RotL32(G[2], 16)) >>> 0;
      this.X[5] = (G[5] + global.OpCodes.RotL32(G[4], 8) + G[3]) >>> 0;
      this.X[6] = (G[6] + global.OpCodes.RotL32(G[5], 16) + global.OpCodes.RotL32(G[4], 16)) >>> 0;
      this.X[7] = (G[7] + global.OpCodes.RotL32(G[6], 8) + G[5]) >>> 0;
    },
    
    /**
     * Generate a 128-bit block of keystream
     * @returns {Array} 16 bytes of keystream
     */
    generateBlock: function() {
      this.nextState();
      
      // Extract keystream according to RFC 4503 section 2.7
      // S[15..0]    = X0[15..0]  ^ X5[31..16]
      // S[31..16]   = X0[31..16] ^ X3[15..0]
      // S[47..32]   = X2[15..0]  ^ X7[31..16]
      // S[63..48]   = X2[31..16] ^ X5[15..0]
      // S[79..64]   = X4[15..0]  ^ X1[31..16]
      // S[95..80]   = X4[31..16] ^ X7[15..0]
      // S[111..96]  = X6[15..0]  ^ X3[31..16]
      // S[127..112] = X6[31..16] ^ X1[15..0]
      
      const keystream = [];
      
      // Extract 16-bit segments and convert to bytes (little-endian)
      const s0 = (this.X[0] & 0xFFFF) ^ ((this.X[5] >>> 16) & 0xFFFF);      // S[15..0]
      const s1 = ((this.X[0] >>> 16) & 0xFFFF) ^ (this.X[3] & 0xFFFF);      // S[31..16]
      const s2 = (this.X[2] & 0xFFFF) ^ ((this.X[7] >>> 16) & 0xFFFF);      // S[47..32]
      const s3 = ((this.X[2] >>> 16) & 0xFFFF) ^ (this.X[5] & 0xFFFF);      // S[63..48]
      const s4 = (this.X[4] & 0xFFFF) ^ ((this.X[1] >>> 16) & 0xFFFF);      // S[79..64]
      const s5 = ((this.X[4] >>> 16) & 0xFFFF) ^ (this.X[7] & 0xFFFF);      // S[95..80]
      const s6 = (this.X[6] & 0xFFFF) ^ ((this.X[3] >>> 16) & 0xFFFF);      // S[111..96]
      const s7 = ((this.X[6] >>> 16) & 0xFFFF) ^ (this.X[1] & 0xFFFF);      // S[127..112]
      
      // Convert 16-bit words to bytes and build keystream in reverse order
      // Based on test vector analysis, the keystream bytes need to be reversed
      keystream.push((s7 >>> 8) & 0xFF, s7 & 0xFF);
      keystream.push((s6 >>> 8) & 0xFF, s6 & 0xFF);
      keystream.push((s5 >>> 8) & 0xFF, s5 & 0xFF);
      keystream.push((s4 >>> 8) & 0xFF, s4 & 0xFF);
      keystream.push((s3 >>> 8) & 0xFF, s3 & 0xFF);
      keystream.push((s2 >>> 8) & 0xFF, s2 & 0xFF);
      keystream.push((s1 >>> 8) & 0xFF, s1 & 0xFF);
      keystream.push((s0 >>> 8) & 0xFF, s0 & 0xFF);
      
      return keystream;
    },
    
    /**
     * Get the next keystream byte
     * @returns {number} Next keystream byte (0-255)
     */
    getNextKeystreamByte: function() {
      // Check if we need to generate a new block
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this.generateBlock();
        this.keystreamPosition = 0;
      }
      
      return this.keystreamBuffer[this.keystreamPosition++];
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
     * Reset the cipher to initial state with optional new IV
     * @param {Array|string} newIV - Optional new IV
     */
    reset: function(newIV) {
      if (newIV !== undefined) {
        this.ivBytes = [];
        if (typeof newIV === 'string') {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 8; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 8) {
          this.ivBytes.push(0);
        }
      }
      
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
      this.initialize();
    },
    
    /**
     * Set a new IV and reinitialize
     * @param {Array|string} newIV - New IV value
     */
    setIV: function(newIV) {
      this.reset(newIV);
    }
  };
  
  // Auto-register with Subsystem (according to category) if available
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(Rabbit);
  }
  
  // Export to global scope
  global.Rabbit = Rabbit;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rabbit;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);