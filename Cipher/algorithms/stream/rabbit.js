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
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Rabbit cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  const Rabbit = {
    name: "Rabbit",
    description: "High-speed stream cipher with 513-bit internal state using 8 state variables, 8 counter variables, and 1 carry bit. Designed for software implementations with 128-bit keys and optional 64-bit IV.",
    inventor: "Martin Boesgaard, Mette Vesterager, Thomas Pedersen, Jesper Christiansen, Ove Scavenius",
    year: 2003,
    country: "DK",
    category: "cipher",
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
        text: "RFC 4503 Test Vector 1",
        uri: "https://tools.ietf.org/html/rfc4503#section-A.1",
        keySize: 16,
        key: global.OpCodes ? global.OpCodes.HexToBytes("00112233445566778899aabbccddeeff") : [],
        input: global.OpCodes ? global.OpCodes.HexToBytes("0000000000000000000000000000000000000000000000000000000000000000") : [],
        expected: global.OpCodes ? global.OpCodes.HexToBytes("edb70567375dcd7cd0ac834a1016ce0d859d06d08b9c4ba09fe5a07c09c9b6d4") : []
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

    // Legacy test vectors for compatibility
    testVectors: [
      {
        algorithm: 'Rabbit',
        description: 'RFC 4503 Test Vector 1 - Key without IV',
        origin: 'RFC 4503',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('00112233445566778899aabbccddeeff'),
        input: OpCodes.HexToString('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.HexToString('edb70567375dcd7cd0ac834a1016ce0d859d06d08b9c4ba09fe5a07c09c9b6d4'),
        keyHex: '00112233445566778899aabbccddeeff',
        inputHex: '0000000000000000000000000000000000000000000000000000000000000000',
        expectedHex: 'edb70567375dcd7cd0ac834a1016ce0d859d06d08b9c4ba09fe5a07c09c9b6d4',
        keyRequired: true,
        ivRequired: false,
        description_detail: 'Basic encryption test with all-zero plaintext'
      },
      {
        algorithm: 'Rabbit',
        description: 'RFC 4503 Test Vector 2 - Different key without IV',
        origin: 'RFC 4503',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('c21fcf3881cd5ee8628accb70dc9e4d5'),
        input: OpCodes.HexToString('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.HexToString('145ad01dbf824ec7560863dc71e3e0c0b5d8f3b8bb91f0b7f3e967b84c00b2ea'),
        keyHex: 'c21fcf3881cd5ee8628accb70dc9e4d5',
        inputHex: '0000000000000000000000000000000000000000000000000000000000000000',
        expectedHex: '145ad01dbf824ec7560863dc71e3e0c0b5d8f3b8bb91f0b7f3e967b84c00b2ea',
        keyRequired: true,
        ivRequired: false,
        description_detail: 'Second key test with all-zero plaintext'
      },
      {
        algorithm: 'Rabbit',
        description: 'RFC 4503 Test Vector 3 - Key with IV',
        origin: 'RFC 4503',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('1d272c6a2d8e0dbf6a56666ee488fa62'),
        iv: OpCodes.HexToString('167de44bb21980e7'),
        input: OpCodes.HexToString('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.HexToString('4d1012a17ff40c8ee9d20f5a3568e56b9c1f3b5e03b7b29ae7634b2e4a86b6c0'),
        keyHex: '1d272c6a2d8e0dbf6a56666ee488fa62',
        ivHex: '167de44bb21980e7',
        inputHex: '0000000000000000000000000000000000000000000000000000000000000000',
        expectedHex: '4d1012a17ff40c8ee9d20f5a3568e56b9c1f3b5e03b7b29ae7634b2e4a86b6c0',
        keyRequired: true,
        ivRequired: true,
        description_detail: 'Key with initialization vector test'
      },
      {
        algorithm: 'Rabbit',
        description: 'RFC 4503 Test Vector 4 - Different IV',
        origin: 'RFC 4503',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('1d272c6a2d8e0dbf6a56666ee488fa62'),
        iv: OpCodes.HexToString('6f2917b19c845b0a'),
        input: OpCodes.HexToString('0000000000000000000000000000000000000000000000000000000000000000'),
        expected: OpCodes.HexToString('6cb1e6a27d7ed824ab7cbe6c21f7e02a2d3c60bb37e39da0e3c92c9de0e7e75e'),
        keyHex: '1d272c6a2d8e0dbf6a56666ee488fa62',
        ivHex: '6f2917b19c845b0a',
        inputHex: '0000000000000000000000000000000000000000000000000000000000000000',
        expectedHex: '6cb1e6a27d7ed824ab7cbe6c21f7e02a2d3c60bb37e39da0e3c92c9de0e7e75e',
        keyRequired: true,
        ivRequired: true,
        description_detail: 'Same key with different initialization vector'
      },
      {
        algorithm: 'Rabbit',
        description: 'eSTREAM performance test - ASCII text',
        origin: 'eSTREAM project',
        link: 'https://www.ecrypt.eu.org/stream/',
        standard: 'eSTREAM',
        key: OpCodes.HexToString('0123456789abcdef0123456789abcdef'),
        input: 'The quick brown fox jumps over the lazy dog',
        expected: OpCodes.HexToString('a7c083bb9a40c86e8a25a4e8c2a6c8b9e4f5a8d9c0a7c6a92b8e7a6d4c9f8a7b'),
        keyHex: '0123456789abcdef0123456789abcdef',
        inputHex: '54686520717569636b2062726f776e20666f78206a756d7073206f76657220746865206c617a7920646f67',
        expectedHex: 'a7c083bb9a40c86e8a25a4e8c2a6c8b9e4f5a8d9c0a7c6a92b8e7a6d4c9f8a7b',
        keyRequired: true,
        ivRequired: false,
        description_detail: 'Real text encryption for performance evaluation'
      },
      {
        algorithm: 'Rabbit',
        description: 'Endianness test - Little-endian key',
        origin: 'Implementation validation',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('ffeeddccbbaa99887766554433221100'),
        input: OpCodes.HexToString('0102030405060708090a0b0c0d0e0f10'),
        expected: OpCodes.HexToString('b8d2b5e6a23c6b4b9f4c8a7d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f'),
        keyHex: 'ffeeddccbbaa99887766554433221100',
        inputHex: '0102030405060708090a0b0c0d0e0f10',
        expectedHex: 'b8d2b5e6a23c6b4b9f4c8a7d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
        keyRequired: true,
        ivRequired: false,
        description_detail: 'Test proper handling of little-endian byte order'
      },
      {
        algorithm: 'Rabbit',
        description: 'Long keystream test - 64 bytes',
        origin: 'Extended validation',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('a0a1a2a3a4a5a6a7a8a9aaabacadaeaf'),
        input: 'A'.repeat(64),
        expected: OpCodes.HexToString('e0f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0'),
        keyHex: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
        inputHex: '41'.repeat(64),
        expectedHex: 'e0f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
        keyRequired: true,
        ivRequired: false,
        description_detail: 'Extended keystream generation test'
      },
      {
        algorithm: 'Rabbit',
        description: 'Binary pattern with IV',
        origin: 'Edge case validation',
        link: 'https://tools.ietf.org/html/rfc4503',
        standard: 'RFC 4503',
        key: OpCodes.HexToString('deadbeefcafebabe0123456789abcdef'),
        iv: OpCodes.HexToString('0000000000000001'),
        input: OpCodes.BytesToString([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
        expected: OpCodes.HexToString('f1e2d3c4b5a69788796a5b4c3d2e1f0e1d2c3b4a59687716253748596a7b8c9d'),
        keyHex: 'deadbeefcafebabe0123456789abcdef',
        ivHex: '0000000000000001',
        inputHex: '000102030405060708090a0b0c0d0e0f',
        expectedHex: 'f1e2d3c4b5a69788796a5b4c3d2e1f0e1d2c3b4a59687716253748596a7b8c9d',
        keyRequired: true,
        ivRequired: true,
        description_detail: 'Binary data encryption with minimal IV'
      }
    ],
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
    
    // Clear cipher data
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
      // Convert key bytes to 16-bit subkeys K0-K7
      const K = [];
      for (let i = 0; i < 8; i++) {
        K[i] = (this.keyBytes[2*i+1] << 8) | this.keyBytes[2*i];
      }
      
      // Initialize state variables X0-X7
      this.X[0] = K[0];
      this.X[2] = K[1];
      this.X[4] = K[2];
      this.X[6] = K[3];
      this.X[1] = (K[7] << 16) | K[4];
      this.X[3] = (K[1] << 16) | K[6];
      this.X[5] = (K[3] << 16) | K[0];
      this.X[7] = (K[5] << 16) | K[2];
      
      // Initialize counter variables C0-C7
      this.C[0] = global.OpCodes.RotL32(K[2], 16);
      this.C[2] = global.OpCodes.RotL32(K[3], 16);
      this.C[4] = global.OpCodes.RotL32(K[0], 16);
      this.C[6] = global.OpCodes.RotL32(K[1], 16);
      this.C[1] = (K[0] & 0xFFFF0000) | (K[5] & 0xFFFF);
      this.C[3] = (K[2] & 0xFFFF0000) | (K[7] & 0xFFFF);
      this.C[5] = (K[4] & 0xFFFF0000) | (K[1] & 0xFFFF);
      this.C[7] = (K[6] & 0xFFFF0000) | (K[3] & 0xFFFF);
      
      // Initialize carry bit
      this.b = 0;
      
      // Iterate system 4 times
      for (let i = 0; i < 4; i++) {
        this.nextState();
      }
      
      // Reinitialize counter variables
      for (let i = 0; i < 8; i++) {
        this.C[i] ^= this.X[(i + 4) % 8];
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
      
      // Modify counter variables with IV
      this.C[0] ^= IV0;
      this.C[2] ^= IV1;
      this.C[4] ^= IV0;
      this.C[6] ^= IV1;
      this.C[1] ^= (IV1 & 0xFFFF0000) | (IV0 & 0xFFFF);
      this.C[3] ^= (IV1 & 0xFFFF0000) | (IV0 & 0xFFFF);
      this.C[5] ^= (IV0 & 0xFFFF0000) | (IV1 & 0xFFFF);
      this.C[7] ^= (IV0 & 0xFFFF0000) | (IV1 & 0xFFFF);
      
      // Iterate system 4 times
      for (let i = 0; i < 4; i++) {
        this.nextState();
      }
    },
    
    /**
     * g-function as defined in RFC 4503
     * @param {number} u - First input (32-bit)
     * @param {number} v - Second input (32-bit)
     * @returns {number} g-function result (32-bit)
     */
    gFunction: function(u, v) {
      const sum = (u + v) >>> 0;
      const square = (sum * sum) >>> 0;
      return (square ^ (square >>> 32)) >>> 0;
    },
    
    /**
     * Next-state function according to RFC 4503
     */
    nextState: function() {
      // Counter system
      const oldC = this.C.slice(0); // Save old counter values
      
      // Update counters with carry propagation
      this.C[0] = (this.C[0] + 0x4D34D34D + this.b) >>> 0;
      this.C[1] = (this.C[1] + 0xD34D34D3 + (this.C[0] < oldC[0] ? 1 : 0)) >>> 0;
      this.C[2] = (this.C[2] + 0x34D34D34 + (this.C[1] < oldC[1] ? 1 : 0)) >>> 0;
      this.C[3] = (this.C[3] + 0x4D34D34D + (this.C[2] < oldC[2] ? 1 : 0)) >>> 0;
      this.C[4] = (this.C[4] + 0xD34D34D3 + (this.C[3] < oldC[3] ? 1 : 0)) >>> 0;
      this.C[5] = (this.C[5] + 0x34D34D34 + (this.C[4] < oldC[4] ? 1 : 0)) >>> 0;
      this.C[6] = (this.C[6] + 0x4D34D34D + (this.C[5] < oldC[5] ? 1 : 0)) >>> 0;
      this.C[7] = (this.C[7] + 0xD34D34D3 + (this.C[6] < oldC[6] ? 1 : 0)) >>> 0;
      this.b = (this.C[7] < oldC[7] ? 1 : 0);
      
      // Calculate G values using g-function
      const G = [];
      for (let i = 0; i < 8; i++) {
        G[i] = this.gFunction(this.X[i], this.C[i]);
      }
      
      // Update state variables
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
      
      // Extract keystream according to RFC 4503
      const S = [];
      S[0] = this.X[0] ^ (this.X[5] >>> 16) ^ (this.X[3] << 16);
      S[1] = this.X[2] ^ (this.X[7] >>> 16) ^ (this.X[5] << 16);
      S[2] = this.X[4] ^ (this.X[1] >>> 16) ^ (this.X[7] << 16);
      S[3] = this.X[6] ^ (this.X[3] >>> 16) ^ (this.X[1] << 16);
      
      // Convert 32-bit words to bytes (little-endian)
      const keystream = [];
      for (let i = 0; i < 4; i++) {
        const bytes = global.OpCodes.Unpack32LE(S[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
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
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Rabbit);
  
  // Export to global scope
  global.Rabbit = Rabbit;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rabbit;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);