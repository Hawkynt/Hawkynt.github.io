#!/usr/bin/env node
/*
 * Universal ChaCha20 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on RFC 7539 specification and official test vectors
 * (c)2025 Hawkynt
 * 
 * ChaCha20 is a stream cipher designed by Daniel J. Bernstein.
 * It is a variant of Salsa20 with improved diffusion.
 * The algorithm uses:
 * - 256-bit keys (32 bytes)
 * - 96-bit nonces (12 bytes) with 32-bit counter (RFC 7539)
 * - 20 rounds of quarter-round operations
 * - 512-bit blocks (64 bytes) of keystream generation
 * 
 * This implementation follows RFC 7539 for compatibility with modern protocols.
 * For educational purposes only - use proven libraries for production.
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('./OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('./universal-cipher-env.js');
        require('./cipher-universal.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('ChaCha20 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create ChaCha20 cipher object
  const ChaCha20 = {
    // Public interface properties
    szInternalName: 'ChaCha20',
    szName: 'ChaCha20 Stream Cipher',
    szComment: 'ChaCha20 Stream Cipher - RFC 7539 specification with official test vectors',
    intMinKeyLength: 32,   // ChaCha20 requires exactly 32-byte keys
    intMaxKeyLength: 32,
    intStepKeyLength: 1,
    intMinBlockSize: 1,    // Stream cipher - processes byte by byte
    intMaxBlockSize: 65536, // Practical limit for processing
    intStepBlockSize: 1,
    arrInstances: {},
    boolCantDecode: false,
    boolInit: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // ChaCha20 constants
    CONSTANTS: [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574], // "expand 32-byte k"
    BLOCK_SIZE: 64,        // ChaCha20 generates 64-byte keystream blocks
    NONCE_SIZE: 12,        // RFC 7539 uses 12-byte nonces
    KEY_SIZE: 32,          // ChaCha20 uses 32-byte keys
    
    // Initialize cipher
    Init: function() {
      ChaCha20.boolInit = true;
    },
    
    // Set up key and initialize ChaCha20 state
    KeySetup: function(szKey) {
      let szID;
      do {
        szID = 'ChaCha20[' + global.szGenerateUniqueID() + ']';
      } while (ChaCha20.arrInstances[szID] || global.XObjectInstances[szID]);
      
      ChaCha20.arrInstances[szID] = new ChaCha20.ChaCha20Instance(szKey);
      global.XObjectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(szID) {
      if (ChaCha20.arrInstances[szID]) {
        // Clear sensitive data
        const instance = ChaCha20.arrInstances[szID];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete ChaCha20.arrInstances[szID];
        delete global.XObjectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', szID, 'ChaCha20', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    szEncryptBlock: function(szID, szPlainText) {
      if (!ChaCha20.arrInstances[szID]) {
        global.throwException('Unknown Object Reference Exception', szID, 'ChaCha20', 'szEncryptBlock');
        return szPlainText;
      }
      
      const instance = ChaCha20.arrInstances[szID];
      let szResult = '';
      
      for (let n = 0; n < szPlainText.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = szPlainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        szResult += String.fromCharCode(ciphertextByte);
      }
      
      return szResult;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    szDecryptBlock: function(szID, szCipherText) {
      // For stream ciphers, decryption is identical to encryption
      return ChaCha20.szEncryptBlock(szID, szCipherText);
    },
    
    // ChaCha20 Instance class
    ChaCha20Instance: function(szKey, nonce, counter) {
      this.keyBytes = [];          // Store key as byte array
      this.nonce = [];             // Store nonce as byte array
      this.counter = counter || 0; // Block counter (32-bit)
      this.state = new Array(16);  // ChaCha20 state (16 32-bit words)
      this.keystreamBuffer = [];   // Buffer for generated keystream
      this.keystreamPosition = 0;  // Current position in keystream buffer
      
      // Process key input
      if (typeof szKey === 'string') {
        // Convert string to bytes
        for (let k = 0; k < szKey.length && this.keyBytes.length < ChaCha20.KEY_SIZE; k++) {
          this.keyBytes.push(szKey.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(szKey)) {
        // Copy array (up to KEY_SIZE bytes)
        for (let k = 0; k < szKey.length && this.keyBytes.length < ChaCha20.KEY_SIZE; k++) {
          this.keyBytes.push(szKey[k] & 0xFF);
        }
      } else {
        throw new Error('ChaCha20 key must be string or byte array');
      }
      
      // Pad key to required length if necessary
      while (this.keyBytes.length < ChaCha20.KEY_SIZE) {
        this.keyBytes.push(0);
      }
      
      // Process nonce (default to zero nonce if not provided)
      if (nonce) {
        if (typeof nonce === 'string') {
          for (let n = 0; n < nonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(nonce.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(nonce)) {
          for (let n = 0; n < nonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(nonce[n] & 0xFF);
          }
        }
      }
      
      // Pad nonce to required length
      while (this.nonce.length < ChaCha20.NONCE_SIZE) {
        this.nonce.push(0);
      }
      
      // Initialize state
      this.initializeState();
    }
  };
  
  // Add methods to ChaCha20Instance prototype
  ChaCha20.ChaCha20Instance.prototype = {
    
    /**
     * Initialize the ChaCha20 state array
     * State layout (16 32-bit words):
     * 0-3:   Constants "expand 32-byte k"
     * 4-11:  256-bit key (8 words)
     * 12:    32-bit counter
     * 13-15: 96-bit nonce (3 words)
     */
    initializeState: function() {
      // Constants (words 0-3)
      for (let i = 0; i < 4; i++) {
        this.state[i] = ChaCha20.CONSTANTS[i];
      }
      
      // Key (words 4-11) - convert bytes to little-endian words
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        this.state[4 + i] = global.OpCodes.Pack32LE(
          this.keyBytes[offset],
          this.keyBytes[offset + 1],
          this.keyBytes[offset + 2],
          this.keyBytes[offset + 3]
        );
      }
      
      // Counter (word 12)
      this.state[12] = this.counter;
      
      // Nonce (words 13-15) - convert bytes to little-endian words
      for (let i = 0; i < 3; i++) {
        const offset = i * 4;
        this.state[13 + i] = global.OpCodes.Pack32LE(
          this.nonce[offset],
          this.nonce[offset + 1],
          this.nonce[offset + 2],
          this.nonce[offset + 3]
        );
      }
    },
    
    /**
     * ChaCha20 quarter-round operation
     * Operates on 4 words of the state: (a, b, c, d)
     * @param {Array} state - Working state array
     * @param {number} a - Index of first word
     * @param {number} b - Index of second word  
     * @param {number} c - Index of third word
     * @param {number} d - Index of fourth word
     */
    quarterRound: function(state, a, b, c, d) {
      // a += b; d ^= a; d <<<= 16;
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] ^= state[a];
      state[d] = global.OpCodes.RotL32(state[d], 16);
      
      // c += d; b ^= c; b <<<= 12;
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] ^= state[c];
      state[b] = global.OpCodes.RotL32(state[b], 12);
      
      // a += b; d ^= a; d <<<= 8;
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] ^= state[a];
      state[d] = global.OpCodes.RotL32(state[d], 8);
      
      // c += d; b ^= c; b <<<= 7;
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] ^= state[c];
      state[b] = global.OpCodes.RotL32(state[b], 7);
    },
    
    /**
     * Generate a 64-byte block of keystream
     * @returns {Array} 64 bytes of keystream
     */
    generateBlock: function() {
      // Create working copy of state
      const workingState = this.state.slice(0);
      
      // Perform 20 rounds (10 double-rounds)
      for (let round = 0; round < 10; round++) {
        // Odd round: column operations
        this.quarterRound(workingState, 0, 4, 8, 12);
        this.quarterRound(workingState, 1, 5, 9, 13);
        this.quarterRound(workingState, 2, 6, 10, 14);
        this.quarterRound(workingState, 3, 7, 11, 15);
        
        // Even round: diagonal operations
        this.quarterRound(workingState, 0, 5, 10, 15);
        this.quarterRound(workingState, 1, 6, 11, 12);
        this.quarterRound(workingState, 2, 7, 8, 13);
        this.quarterRound(workingState, 3, 4, 9, 14);
      }
      
      // Add original state to working state
      for (let i = 0; i < 16; i++) {
        workingState[i] = (workingState[i] + this.state[i]) >>> 0;
      }
      
      // Convert words to bytes (little-endian)
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = global.OpCodes.Unpack32LE(workingState[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      // Increment counter for next block
      this.counter = (this.counter + 1) >>> 0;
      this.state[12] = this.counter;
      
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
     * Reset the cipher to initial state with optional new nonce/counter
     * @param {Array|string} newNonce - Optional new nonce
     * @param {number} newCounter - Optional new counter value
     */
    reset: function(newNonce, newCounter) {
      if (newNonce !== undefined) {
        this.nonce = [];
        if (typeof newNonce === 'string') {
          for (let n = 0; n < newNonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(newNonce.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newNonce)) {
          for (let n = 0; n < newNonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(newNonce[n] & 0xFF);
          }
        }
        // Pad nonce to required length
        while (this.nonce.length < ChaCha20.NONCE_SIZE) {
          this.nonce.push(0);
        }
      }
      
      if (newCounter !== undefined) {
        this.counter = newCounter >>> 0;
      } else {
        this.counter = 0;
      }
      
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
      this.initializeState();
    },
    
    /**
     * Set a new nonce for the cipher
     * @param {Array|string} newNonce - New nonce value
     */
    setNonce: function(newNonce) {
      this.reset(newNonce, 0);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ChaCha20);
  }
  
  // Export to global scope
  global.ChaCha20 = ChaCha20;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaCha20;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);