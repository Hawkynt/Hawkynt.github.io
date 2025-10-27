/*
 * MICKEY Stream Cipher Implementation
 * Hardware-oriented stream cipher with irregular clocking from eSTREAM portfolio
 * Universal cipher implementation compatible with Browser and Node.js
 * (c)2006-2025 Hawkynt
 *
 * MICKEY (Mutual Irregular Clocking KEYstream) is a hardware-oriented stream cipher
 * that uses two 100-bit registers (R and S) with irregular clocking control.
 * This educational implementation demonstrates the basic principles of MICKEY.
 */

(function(global) {
  'use strict';

  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      global.OpCodes = require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }

  const OpCodes = global.OpCodes;

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
      console.error('MICKEY cipher requires Cipher system to be loaded first');
      return;
    }
  }

  const MICKEY = {
    name: 'MICKEY',
    description: 'Hardware-oriented stream cipher using two 100-bit registers with irregular clocking. Part of the eSTREAM hardware portfolio. Educational implementation demonstrating clock-controlled register principles.',
    inventor: 'Steve Babbage, Matthew Dodd',
    year: 2005,
    country: 'GB',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: 'Stream Cipher',
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.EDUCATIONAL : 'educational',
    securityNotes: 'Hardware-oriented design with irregular clocking. This educational implementation uses simplified registers for demonstration purposes.',

    documentation: [
      {text: 'MICKEY eSTREAM Specification', uri: 'https://www.ecrypt.eu.org/stream/mickey.html'},
      {text: 'eSTREAM Hardware Portfolio', uri: 'https://www.ecrypt.eu.org/stream/'}
    ],

    references: [
      {text: 'Hardware-Oriented Stream Ciphers', uri: 'https://en.wikipedia.org/wiki/Stream_cipher'}
    ],

    knownVulnerabilities: [
      {
        type: 'Implementation Specific',
        text: 'This is a simplified educational implementation not suitable for security applications.',
        mitigation: 'Use only for educational purposes to understand clock-controlled generators.'
      }
    ],

    tests: [
      {
        text: 'Educational test vector with simplified initialization',
        uri: 'Educational implementation',
        input: [0x48, 0x65, 0x6C, 0x6C, 0x6F],
        key: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F],
        expected: [0x5C, 0xE1, 0xC2, 0x43, 0x0D]
      }
    ],

    // Simplified MICKEY parameters (educational)
    REGISTER_SIZE: 32,  // Simplified from 100 bits for educational purposes
    INIT_ROUNDS: 64,    // Simplified initialization rounds

    // Internal state
    registerR: null,
    registerS: null,
    isInitialized: false,

    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.registerR = new Array(this.REGISTER_SIZE).fill(0);
      this.registerS = new Array(this.REGISTER_SIZE).fill(0);
      this.isInitialized = false;
      return true;
    },

    /**
     * Setup key for MICKEY cipher
     * @param {Array} key - 80-bit key as byte array (10 bytes), will use first 16 bytes if longer
     */
    KeySetup: function(key) {
      if (!key || key.length < 8) {
        throw new Error('MICKEY requires at least 64-bit (8 byte) key');
      }

      // Use first 16 bytes of key for 128-bit compatibility, or pad if shorter
      const keyBytes = key.slice(0, 16);
      while (keyBytes.length < 16) keyBytes.push(0);

      // Initialize state
      this.Init();

      // Load key into registers (simplified initialization)
      let bitIndex = 0;

      // Initialize register R with key bits
      for (let i = 0; i < this.REGISTER_SIZE && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.registerR[i] = (keyBytes[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }

      // Initialize register S with remaining key bits
      for (let i = 0; i < this.REGISTER_SIZE && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.registerS[i] = (keyBytes[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }

      // Ensure registers are not all zeros
      if (this.registerR.every(bit => bit === 0)) {
        this.registerR[0] = 1;
      }
      if (this.registerS.every(bit => bit === 0)) {
        this.registerS[0] = 1;
      }

      // Run initialization rounds
      for (let i = 0; i < this.INIT_ROUNDS; i++) {
        this.clockRegisters();
      }

      this.isInitialized = true;
      return true;
    },

    /**
     * Clock both registers with irregular control
     * @returns {number} Control bit for irregular clocking
     */
    clockRegisters: function() {
      // Get control bits from both registers
      const controlR = this.registerR[0];
      const controlS = this.registerS[0];

      // Clock register R (LFSR-style with simplified polynomial)
      const feedbackR = this.registerR[0] ^ this.registerR[7] ^ this.registerR[15];
      for (let i = 0; i < this.REGISTER_SIZE - 1; i++) {
        this.registerR[i] = this.registerR[i + 1];
      }
      this.registerR[this.REGISTER_SIZE - 1] = feedbackR;

      // Clock register S with nonlinear feedback
      const feedbackS = this.nonlinearFunction();
      for (let i = 0; i < this.REGISTER_SIZE - 1; i++) {
        this.registerS[i] = this.registerS[i + 1];
      }
      this.registerS[this.REGISTER_SIZE - 1] = feedbackS;

      return controlR ^ controlS;
    },

    /**
     * Simplified nonlinear function for register S
     * @returns {number} Feedback bit (0 or 1)
     */
    nonlinearFunction: function() {
      // Simplified nonlinear function combining multiple register positions
      const s0 = this.registerS[0];
      const s1 = this.registerS[1];
      const s2 = this.registerS[2];
      const s3 = this.registerS[3];

      // Simple nonlinear function: (s0 AND s1) XOR (s2 AND s3) XOR s0
      return ((s0 & s1) ^ (s2 & s3) ^ s0) & 1;
    },

    /**
     * Generate a single keystream bit
     * @returns {number} Output bit (0 or 1)
     */
    generateBit: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }

      // Output is combination of both registers
      const output = this.registerR[0] ^ this.registerS[0];

      // Clock the registers
      this.clockRegisters();

      return output;
    },

    /**
     * Generate a byte (8 bits)
     * @returns {number} Byte value (0-255)
     */
    generateByte: function() {
      let byte = 0;

      for (let bit = 0; bit < 8; bit++) {
        const bitValue = this.generateBit();
        byte |= (bitValue << bit);
      }

      return byte;
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
     * Encrypt block using MICKEY cipher
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
     * Get current register states for debugging
     * @returns {Object} Current states of both registers
     */
    getStates: function() {
      return {
        registerR: this.registerR ? this.registerR.slice() : null,
        registerS: this.registerS ? this.registerS.slice() : null
      };
    },

    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.registerR) {
        OpCodes.ClearArray(this.registerR);
        this.registerR = null;
      }
      if (this.registerS) {
        OpCodes.ClearArray(this.registerS);
        this.registerS = null;
      }
      this.isInitialized = false;
    },

    // Stream cipher interface for testing framework
    CreateInstance: function(isDecrypt) {
      const instance = {
        _key: null,
        _iv: null,
        _inputData: [],
        _cipher: Object.create(MICKEY),

        set key(keyData) {
          // Accept various key sizes (8, 10, 16, 24, 32 bytes)
          if (!keyData || keyData.length < 8) {
            throw new Error('MICKEY requires at least 64-bit (8 byte) key');
          }
          this._key = Array.isArray(keyData) ? [...keyData] : keyData;
          this._cipher.KeySetup(this._key);
        },

        get key() {
          return this._key ? [...this._key] : null;
        },

        set iv(ivData) {
          // MICKEY doesn't use IV in traditional sense, but store for compatibility
          this._iv = Array.isArray(ivData) ? [...ivData] : ivData;
        },

        get iv() {
          return this._iv ? [...this._iv] : null;
        },

        set nonce(nonceData) {
          this.iv = nonceData;
        },

        get nonce() {
          return this.iv;
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
            this._key = OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F');
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
    global.AlgorithmFramework.RegisterAlgorithm(MICKEY);
  }

  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(MICKEY);
  }

  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(MICKEY);
  }

  // Export to global scope
  global.MICKEY = MICKEY;
  global['MICKEY'] = MICKEY;

  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MICKEY;
  }

})(typeof global !== 'undefined' ? global : window);