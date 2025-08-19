/*
 * Spritz Stream Cipher Implementation
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
      console.error('Spritz cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Spritz cipher object
  const Spritz = {
    name: "Spritz",
    description: "Sponge-like stream cipher designed as a successor to RC4 with improved security properties. Uses 256-byte state with absorb/squeeze operations similar to Keccak/SHA-3 construction.",
    inventor: "Ron Rivest, Jacob Schuldt",
    year: 2014,
    country: "US",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "experimental",
    securityNotes: "Newer design with limited cryptanalysis compared to established stream ciphers. More complex than RC4 but lacks extensive security analysis.",
    
    documentation: [
      {text: "Spritz Paper", uri: "https://people.csail.mit.edu/rivest/pubs/RS14.pdf"},
      {text: "Spritz Cryptanalysis", uri: "https://eprint.iacr.org/2016/856.pdf"}
    ],
    
    references: [
      {text: "Rivest's Spritz Page", uri: "https://people.csail.mit.edu/rivest/Spritz/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Limited Analysis", 
        text: "Newer algorithm with less cryptanalytic scrutiny than established ciphers",
        mitigation: "Use well-established stream ciphers for production systems"
      }
    ],
    
    tests: [
      {
        text: "Spritz Basic Test",
        uri: "Educational test case",
        keySize: 16,
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: [] // Limited official test vectors available
      }
    ],

    // Public interface properties
    minKeyLength: 1,    // Spritz supports variable key lengths
    maxKeyLength: 256,  // Up to 256 bytes
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Spritz constants
    STATE_SIZE: 256,       // 256-byte state array
    
    // Initialize cipher
    Init: function() {
      Spritz.isInitialized = true;
    },
    
    // Set up key and initialize Spritz state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Spritz[' + global.generateUniqueID() + ']';
      } while (Spritz.instances[id] || global.objectInstances[id]);
      
      Spritz.instances[id] = new Spritz.SpritzInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Spritz.instances[id]) {
        // Clear sensitive data
        const instance = Spritz.instances[id];
        if (instance.S && global.OpCodes) {
          global.OpCodes.ClearArray(instance.S);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete Spritz.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Spritz', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!Spritz.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Spritz', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Spritz.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.squeeze();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return Spritz.encryptBlock(id, ciphertext);
    },
    
    // Spritz Instance class
    SpritzInstance: function(key, iv) {
      this.S = new Array(Spritz.STATE_SIZE);    // State array (256 bytes)
      this.i = 0;                               // State pointer i
      this.j = 0;                               // State pointer j
      this.k = 0;                               // State pointer k
      this.z = 0;                               // State pointer z
      this.a = 0;                               // Absorb counter
      this.w = 1;                               // Whip counter
      this.keyBytes = [];                       // Store key as byte array
      this.ivBytes = [];                        // Store IV as byte array
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else if (key) {
        throw new Error('Spritz key must be string or byte array');
      }
      
      // Process IV if provided
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to SpritzInstance prototype
  Spritz.SpritzInstance.prototype = {
    
    /**
     * Initialize Spritz cipher state
     */
    initialize: function() {
      this.initializeState();
      this.absorb(this.keyBytes);
      
      if (this.ivBytes.length > 0) {
        this.absorbStop();
        this.absorb(this.ivBytes);
      }
      
      this.absorbStop();
      this.shuffle();
    },
    
    /**
     * Initialize state array to identity permutation
     */
    initializeState: function() {
      this.i = 0;
      this.j = 0;
      this.k = 0;
      this.z = 0;
      this.a = 0;
      this.w = 1;
      
      // Initialize S to identity permutation
      for (let v = 0; v < Spritz.STATE_SIZE; v++) {
        this.S[v] = v;
      }
    },
    
    /**
     * Absorb data into the state (sponge absorb phase)
     * @param {Array} data - Byte array to absorb
     */
    absorb: function(data) {
      for (let v = 0; v < data.length; v++) {
        this.absorbByte(data[v]);
      }
    },
    
    /**
     * Absorb a single byte
     * @param {number} b - Byte to absorb (0-255)
     */
    absorbByte: function(b) {
      this.absorbNibble(b & 0xF);       // Low nibble
      this.absorbNibble((b >>> 4) & 0xF); // High nibble
    },
    
    /**
     * Absorb a single nibble (4 bits)
     * @param {number} x - Nibble to absorb (0-15)
     */
    absorbNibble: function(x) {
      if (this.a === (Spritz.STATE_SIZE / 2)) {
        this.shuffle();
      }
      
      // Swap S[a] and S[128 + x]
      const temp = this.S[this.a];
      this.S[this.a] = this.S[128 + x];
      this.S[128 + x] = temp;
      
      this.a = (this.a + 1) % (Spritz.STATE_SIZE / 2);
    },
    
    /**
     * Stop absorbing (pad and transition to squeeze phase)
     */
    absorbStop: function() {
      if (this.a === (Spritz.STATE_SIZE / 2)) {
        this.shuffle();
      }
      
      this.a = (this.a + 1) % (Spritz.STATE_SIZE / 2);
    },
    
    /**
     * Shuffle the state (equivalent to multiple whip operations)
     */
    shuffle: function() {
      this.whip(512);  // 2 * STATE_SIZE whips
      this.crush();
      this.whip(512);  // 2 * STATE_SIZE whips
      this.crush();
      this.whip(512);  // 2 * STATE_SIZE whips
      this.a = 0;
    },
    
    /**
     * Whip operation (state mixing)
     * @param {number} r - Number of whip rounds
     */
    whip: function(r) {
      for (let v = 0; v < r; v++) {
        this.update();
      }
      this.w = (this.w + 2) % 256;
    },
    
    /**
     * Crush operation (ensures proper avalanche)
     */
    crush: function() {
      for (let v = 0; v < (Spritz.STATE_SIZE / 2); v++) {
        if (this.S[v] > this.S[Spritz.STATE_SIZE - 1 - v]) {
          // Swap S[v] and S[STATE_SIZE - 1 - v]
          const temp = this.S[v];
          this.S[v] = this.S[Spritz.STATE_SIZE - 1 - v];
          this.S[Spritz.STATE_SIZE - 1 - v] = temp;
        }
      }
    },
    
    /**
     * Update state pointers and mix state
     */
    update: function() {
      this.i = (this.i + this.w) % Spritz.STATE_SIZE;
      this.j = (this.k + this.S[(this.j + this.S[this.i]) % Spritz.STATE_SIZE]) % Spritz.STATE_SIZE;
      this.k = (this.i + this.k + this.S[this.j]) % Spritz.STATE_SIZE;
      
      // Swap S[i] and S[j]
      const temp = this.S[this.i];
      this.S[this.i] = this.S[this.j];
      this.S[this.j] = temp;
    },
    
    /**
     * Drip operation (prepare for output)
     * @returns {number} Output byte candidate
     */
    drip: function() {
      if (this.a > 0) {
        this.shuffle();
      }
      
      this.update();
      return this.output();
    },
    
    /**
     * Output function
     * @returns {number} Output byte
     */
    output: function() {
      this.z = this.S[(this.j + this.S[(this.i + this.S[(this.z + this.k) % Spritz.STATE_SIZE]) % Spritz.STATE_SIZE]) % Spritz.STATE_SIZE];
      return this.z;
    },
    
    /**
     * Squeeze operation (sponge squeeze phase)
     * @returns {number} Keystream byte (0-255)
     */
    squeeze: function() {
      if (this.a > 0) {
        this.shuffle();
      }
      
      return this.drip();
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.squeeze());
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
          for (let n = 0; n < newIV.length; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
      }
      
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
    global.Cipher.Add(Spritz);
  
  // Export to global scope
  global.Spritz = Spritz;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Spritz;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);