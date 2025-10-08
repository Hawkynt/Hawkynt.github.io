/*
 * Panama Stream Cipher Implementation
 * Cryptographic primitive designed by Joan Daemen and Craig Clapp
 * Universal cipher implementation compatible with Browser and Node.js
 * (c)2006-2025 Hawkynt
 *
 * Panama is a stream cipher and hash function that uses a linear buffer
 * and nonlinear state transformation. This educational implementation
 * demonstrates the basic principles of the Panama design.
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

  if (!global.AlgorithmFramework) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../AlgorithmFramework.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Panama cipher requires Cipher system to be loaded first');
      return;
    }
  }

  const Panama = {
    name: 'Panama',
    description: 'Stream cipher and hash function designed by Joan Daemen and Craig Clapp. Features a linear buffer and nonlinear state transformation. Educational implementation demonstrating Panama design principles.',
    inventor: 'Joan Daemen, Craig Clapp',
    year: 1998,
    country: 'BE',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: 'Stream Cipher',
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.EDUCATIONAL : 'educational',
    securityNotes: 'Stream cipher with linear buffer and nonlinear state. This educational implementation uses simplified parameters for demonstration purposes.',

    documentation: [
      {text: 'Panama Specification', uri: 'https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/examples/panama.pdf'},
      {text: 'Joan Daemen Profile', uri: 'https://keccak.team/team.html'}
    ],

    references: [
      {text: 'Stream Cipher Design', uri: 'https://en.wikipedia.org/wiki/Stream_cipher'}
    ],

    knownVulnerabilities: [
      {
        type: 'Implementation Specific',
        text: 'This is a simplified educational implementation not suitable for security applications.',
        mitigation: 'Use only for educational purposes to understand Panama design principles.'
      }
    ],

    tests: [
      {
        text: 'Educational test vector with simplified state',
        uri: 'Educational implementation',
        input: [0x48, 0x65, 0x6C, 0x6C, 0x6F],
        key: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10],
        expected: [0x24, 0x1C, 0x1A, 0xF3, 0xA6]
      }
    ],

    // Simplified Panama parameters (educational)
    STATE_SIZE: 17,      // Simplified from full Panama state
    BUFFER_SIZE: 32,     // Simplified buffer size
    INIT_ROUNDS: 32,     // Simplified initialization rounds

    // Internal state
    state: null,
    buffer: null,
    bufferPos: 0,
    isInitialized: false,

    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.state = new Array(this.STATE_SIZE).fill(0);
      this.buffer = new Array(this.BUFFER_SIZE).fill(0);
      this.bufferPos = 0;
      this.isInitialized = false;
      return true;
    },

    /**
     * Setup key for Panama cipher
     * @param {Array} key - Variable length key as byte array
     */
    KeySetup: function(key) {
      if (!key || key.length === 0) {
        throw new Error('Panama requires a non-empty key');
      }

      // Pad key to 16 bytes for consistent operation
      const keyBytes = key.slice(0, 16);
      while (keyBytes.length < 16) keyBytes.push(0);

      // Initialize state
      this.Init();

      // Load key into state (simplified initialization)
      for (let i = 0; i < this.STATE_SIZE; i++) {
        this.state[i] = keyBytes[i % keyBytes.length];
      }

      // Load key into buffer
      for (let i = 0; i < this.BUFFER_SIZE; i++) {
        this.buffer[i] = keyBytes[i % keyBytes.length];
      }

      // Run initialization rounds
      for (let i = 0; i < this.INIT_ROUNDS; i++) {
        this.updateState();
      }

      this.isInitialized = true;
      return true;
    },

    /**
     * Update Panama state with simplified transformation
     */
    updateState: function() {
      // Simplified Panama state update
      const newState = new Array(this.STATE_SIZE);

      // Linear transformation with buffer mixing
      for (let i = 0; i < this.STATE_SIZE; i++) {
        const prev = (i + this.STATE_SIZE - 1) % this.STATE_SIZE;
        const next = (i + 1) % this.STATE_SIZE;
        const bufVal = this.buffer[i % this.BUFFER_SIZE];

        newState[i] = (this.state[prev] ^ this.state[next] ^ bufVal) & 0xFF;
      }

      // Update state
      this.state = newState;

      // Update buffer position
      this.bufferPos = (this.bufferPos + 1) % this.BUFFER_SIZE;

      // Mix buffer with state
      const stateSum = this.state.reduce((sum, val) => (sum + val) & 0xFF, 0);
      this.buffer[this.bufferPos] = (this.buffer[this.bufferPos] ^ stateSum) & 0xFF;
    },

    /**
     * Generate a single keystream byte
     * @returns {number} Output byte (0-255)
     */
    generateByte: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }

      // Update state
      this.updateState();

      // Generate output byte from state
      let output = 0;
      for (let i = 0; i < 8; i++) {
        output ^= this.state[i % this.STATE_SIZE];
      }

      return output & 0xFF;
    },

    /**
     * Generate keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];

      for (let i = 0; i < length; i++) {
        keystream.push(this.generateByte());
      }

      return keystream;
    },

    /**
     * Encrypt block using Panama cipher
     * @param {number} blockIndex - Block index (position)
     * @param {string|Array} input - Input data
     * @returns {string|Array} Encrypted data
     */
    EncryptBlock: function(blockIndex, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }

      let inputBytes;
      if (typeof input === 'string') {
        inputBytes = OpCodes.AsciiToBytes(input);
        const keystream = this.generateKeystream(inputBytes.length);
        const outputBytes = OpCodes.XorArrays(inputBytes, keystream);
        return String.fromCharCode(...outputBytes);
      } else {
        inputBytes = input;
        const keystream = this.generateKeystream(inputBytes.length);
        return OpCodes.XorArrays(inputBytes, keystream);
      }
    },

    /**
     * Decrypt block (same as encrypt for stream cipher)
     * @param {number} blockIndex - Block index (position)
     * @param {string|Array} input - Input data
     * @returns {string|Array} Decrypted data
     */
    DecryptBlock: function(blockIndex, input) {
      return this.EncryptBlock(blockIndex, input);
    },

    /**
     * Get current state for debugging
     * @returns {Object} Current state and buffer
     */
    getState: function() {
      return {
        state: this.state ? this.state.slice() : null,
        buffer: this.buffer ? this.buffer.slice() : null,
        bufferPos: this.bufferPos
      };
    },

    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.state) {
        OpCodes.ClearArray(this.state);
        this.state = null;
      }
      if (this.buffer) {
        OpCodes.ClearArray(this.buffer);
        this.buffer = null;
      }
      this.bufferPos = 0;
      this.isInitialized = false;
    },

    // Stream cipher interface for testing framework
    CreateInstance: function(isDecrypt) {
      const instance = {
        _key: null,
        _inputData: [],
        _cipher: Object.create(Panama),

        set key(keyData) {
          this._key = keyData;
          this._cipher.KeySetup(keyData);
        },

        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = this._inputData.concat(data);
          } else if (typeof data === 'string') {
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },

        Result: function() {
          if (!this._key) {
            this._key = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10];
            this._cipher.KeySetup(this._key);
          }

          const keystream = this._cipher.generateKeystream(this._inputData.length);
          return OpCodes.XorArrays(this._inputData, keystream);
        }
      };

      return instance;
    }
  };

  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(Panama);
  }

  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(Panama);
  }

  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(Panama);
  }

  // Export to global scope
  global.Panama = Panama;
  global['PANAMA'] = Panama;

  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Panama;
  }

})(typeof global !== 'undefined' ? global : window);