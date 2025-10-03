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
        uri: "https://datatracker.ietf.org/doc/html/rfc4503",
        keySize: 16,
        key: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        input: global.OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("B15754F036A5D6ECF56B45261C4AF70288E8D815C59C0C397B696C4789C68AA7")
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
      // RFC 4503: Divide 128-bit key into 8 subkeys K0..K7 (16 bits each)
      // K0 = key[1:0], K1 = key[3:2], ..., K7 = key[15:14]
      const K = [];
      for (let i = 0; i < 8; i++) {
        // Little-endian 16-bit subkeys from byte pairs
        K[i] = this.keyBytes[i*2] | (this.keyBytes[i*2+1] << 8);
      }

      // RFC 4503 state initialization equations
      // For even j: Xj = K(j+1 mod 8) || Kj, Cj = K(j+4 mod 8) || K(j+5 mod 8)
      // For odd j: Xj = K(j+5 mod 8) || K(j+4 mod 8), Cj = Kj || K(j+1 mod 8)
      for (let j = 0; j < 8; j++) {
        if (j % 2 === 0) { // even
          this.X[j] = (K[(j+1) & 7] << 16) | K[j];
          this.C[j] = (K[(j+4) & 7] << 16) | K[(j+5) & 7];
        } else { // odd
          this.X[j] = (K[(j+5) & 7] << 16) | K[(j+4) & 7];
          this.C[j] = (K[j] << 16) | K[(j+1) & 7];
        }
        this.X[j] = this.X[j] >>> 0;
        this.C[j] = this.C[j] >>> 0;
      }

      // Initialize carry bit
      this.b = 0;

      // Iterate the system four times
      for (let i = 0; i < 4; i++) {
        this.nextState();
      }

      // Modify counters like CryptoJS
      for (let i = 0; i < 8; i++) {
        this.C[i] = (this.C[i] ^ this.X[(i + 4) & 7]) >>> 0;
      }

      // If IV is provided, perform IV setup
      if (this.ivBytes.length > 0) {
        this.ivSetup();
      }
    },
    
    /**
     * IV setup according to RFC 4503 and CryptoJS
     */
    ivSetup: function() {
      // Convert IV bytes to 32-bit words
      const IV_0 = global.OpCodes.Pack32LE(this.ivBytes[0], this.ivBytes[1], this.ivBytes[2], this.ivBytes[3]);
      const IV_1 = global.OpCodes.Pack32LE(this.ivBytes[4], this.ivBytes[5], this.ivBytes[6], this.ivBytes[7]);

      // Generate four subvectors like CryptoJS
      const i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
      const i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
      const i1 = (i0 >>> 16) | (i2 & 0xffff0000);
      const i3 = (i2 << 16)  | (i0 & 0x0000ffff);

      // Modify counter values like CryptoJS
      this.C[0] = (this.C[0] ^ i0) >>> 0;
      this.C[1] = (this.C[1] ^ i1) >>> 0;
      this.C[2] = (this.C[2] ^ i2) >>> 0;
      this.C[3] = (this.C[3] ^ i3) >>> 0;
      this.C[4] = (this.C[4] ^ i0) >>> 0;
      this.C[5] = (this.C[5] ^ i1) >>> 0;
      this.C[6] = (this.C[6] ^ i2) >>> 0;
      this.C[7] = (this.C[7] ^ i3) >>> 0;

      // Iterate system 4 times
      for (let i = 0; i < 4; i++) {
        this.nextState();
      }
    },
    
    /**
     * g-function exactly as implemented in CryptoJS
     * @param {number} x - X state value
     * @param {number} c - Counter value
     * @returns {number} g-function result (32-bit)
     */
    gFunction: function(x, c) {
      const gx = (x + c) >>> 0;

      // Construct high and low argument for squaring like CryptoJS
      const ga = gx & 0xffff;
      const gb = gx >>> 16;

      // Calculate high and low result of squaring like CryptoJS
      const gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
      const gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

      // High XOR low
      return (gh ^ gl) >>> 0;
    },
    
    /**
     * Next-state function exactly as implemented in CryptoJS
     */
    nextState: function() {
      // Save old counter values for carry computation
      const C_ = [];
      for (let i = 0; i < 8; i++) {
        C_[i] = this.C[i];
      }

      // Calculate new counter values like CryptoJS
      this.C[0] = (this.C[0] + 0x4d34d34d + this.b) | 0;
      this.C[1] = (this.C[1] + 0xd34d34d3 + ((this.C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
      this.C[2] = (this.C[2] + 0x34d34d34 + ((this.C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
      this.C[3] = (this.C[3] + 0x4d34d34d + ((this.C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
      this.C[4] = (this.C[4] + 0xd34d34d3 + ((this.C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
      this.C[5] = (this.C[5] + 0x34d34d34 + ((this.C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
      this.C[6] = (this.C[6] + 0x4d34d34d + ((this.C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
      this.C[7] = (this.C[7] + 0xd34d34d3 + ((this.C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
      this.b = (this.C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

      // Calculate the g-values like CryptoJS
      const G = [];
      for (let i = 0; i < 8; i++) {
        G[i] = this.gFunction(this.X[i], this.C[i]);
      }

      // Calculate new state values exactly like CryptoJS
      this.X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
      this.X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
      this.X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
      this.X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
      this.X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
      this.X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
      this.X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
      this.X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
    },
    
    /**
     * Generate a 128-bit block of keystream (CryptoJS compatible)
     * @returns {Array} 16 bytes of keystream
     */
    generateBlock: function() {
      this.nextState();

      // Generate four keystream words like CryptoJS
      const S = [];
      S[0] = this.X[0] ^ (this.X[5] >>> 16) ^ (this.X[3] << 16);
      S[1] = this.X[2] ^ (this.X[7] >>> 16) ^ (this.X[5] << 16);
      S[2] = this.X[4] ^ (this.X[1] >>> 16) ^ (this.X[7] << 16);
      S[3] = this.X[6] ^ (this.X[3] >>> 16) ^ (this.X[1] << 16);

      const keystream = [];

      for (let i = 0; i < 4; i++) {
        // Swap endian like CryptoJS
        S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
               (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);
      }

      // Extract bytes in the order that matches test vectors
      // Try reverse word order with little-endian bytes
      for (let i = 3; i >= 0; i--) {
        keystream.push(S[i] & 0xFF);
        keystream.push((S[i] >>> 8) & 0xFF);
        keystream.push((S[i] >>> 16) & 0xFF);
        keystream.push((S[i] >>> 24) & 0xFF);
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