/*
 * Beth-Piper Stop-and-Go Generator Stream Cipher
 * Universal cipher implementation compatible with Browser and Node.js
 * (c)2006-2025 Hawkynt
 * 
 * Implementation of the stop-and-go generator by Thomas Beth and Fred Piper (EUROCRYPT 1984).
 * Uses clock-controlled LFSRs where one LFSR controls the clocking of another.
 * This educational implementation demonstrates irregular clocking techniques in stream ciphers.
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
      console.error('Beth-Piper generator requires Cipher system to be loaded first');
      return;
    }
  }
  
  const BethPiper = {
    name: 'Beth-Piper Stop-and-Go Generator',
    description: 'Clock-controlled LFSR stream cipher using stop-and-go clocking strategy. One LFSR controls the irregular clocking of a second LFSR to introduce nonlinearity. Educational implementation for understanding clock-controlled generators.',
    inventor: 'Thomas Beth, Fred Piper',
    year: 1984,
    country: 'DE',
    category: 'cipher',
    subCategory: 'Stream Cipher',
    securityStatus: 'educational',
    securityNotes: 'Clock-controlled generators can be vulnerable to correlation attacks and algebraic attacks. Modern cryptanalysis has shown weaknesses in simple stop-and-go generators.',
    
    documentation: [
      {text: 'EUROCRYPT 1984 Paper', uri: 'https://link.springer.com/chapter/10.1007/3-540-39757-4_17'},
      {text: 'Stream Ciphers Overview', uri: 'https://en.wikipedia.org/wiki/Stream_cipher'}
    ],
    
    references: [
      {text: 'Clock-Controlled Generators', uri: 'https://link.springer.com/chapter/10.1007/978-3-030-12850-0_1'}
    ],
    
    knownVulnerabilities: [
      {
        type: 'Correlation Attack',
        text: 'Clock-controlled generators can be vulnerable to correlation attacks that exploit dependencies between control and data sequences.',
        mitigation: 'Use only for educational purposes, not in production systems.'
      }
    ],
    
    tests: [
      {
        text: 'Basic functionality test with known key',
        uri: 'Educational test vector',
        input: OpCodes ? OpCodes.Hex8ToBytes('48656C6C6F20576F726C64') : [],
        key: OpCodes ? OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F') : [],
        expected: OpCodes ? OpCodes.Hex8ToBytes('D99A8F65AFFFD6ACBE039B') : []
      }
    ],
    
    // LFSR parameters (use coprime lengths)
    CLOCK_LFSR_LENGTH: 19,   // Clock control LFSR length
    DATA_LFSR_LENGTH: 23,    // Data output LFSR length
    
    // Internal state
    clockLFSR: null,         // Clock control LFSR
    dataLFSR: null,          // Data output LFSR
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.clockLFSR = new Array(this.CLOCK_LFSR_LENGTH).fill(0);
      this.dataLFSR = new Array(this.DATA_LFSR_LENGTH).fill(0);
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key for Beth-Piper generator
     * @param {Array} key - 128-bit key as byte array (16 bytes)
     */
    KeySetup: function(key) {
      if (!key || key.length !== 16) {
        throw new Error('Beth-Piper generator requires 128-bit (16 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Distribute key bits across the two LFSRs
      let bitIndex = 0;
      
      // Initialize clock LFSR
      for (let i = 0; i < this.CLOCK_LFSR_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.clockLFSR[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Initialize data LFSR
      for (let i = 0; i < this.DATA_LFSR_LENGTH && bitIndex < 128; i++) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        this.dataLFSR[i] = (key[byteIndex] >>> bitPos) & 1;
        bitIndex++;
      }
      
      // Use remaining key bits to modify existing LFSR states
      while (bitIndex < 128) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitPos = bitIndex % 8;
        const keyBit = (key[byteIndex] >>> bitPos) & 1;
        
        // XOR with existing LFSR states alternately
        if ((bitIndex % 2) === 0) {
          this.clockLFSR[bitIndex % this.CLOCK_LFSR_LENGTH] ^= keyBit;
        } else {
          this.dataLFSR[bitIndex % this.DATA_LFSR_LENGTH] ^= keyBit;
        }
        bitIndex++;
      }
      
      // Ensure no LFSR is all zeros
      if (this.clockLFSR.every(bit => bit === 0)) {
        this.clockLFSR[0] = 1;
      }
      if (this.dataLFSR.every(bit => bit === 0)) {
        this.dataLFSR[0] = 1;
      }
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Update clock LFSR (polynomial: x^19 + x^5 + x^2 + x + 1)
     * @returns {number} Output bit for clock control
     */
    updateClockLFSR: function() {
      const output = this.clockLFSR[0];
      const feedback = this.clockLFSR[0] ^ this.clockLFSR[1] ^ this.clockLFSR[2] ^ this.clockLFSR[5];
      
      // Shift register
      for (let i = 0; i < this.CLOCK_LFSR_LENGTH - 1; i++) {
        this.clockLFSR[i] = this.clockLFSR[i + 1];
      }
      this.clockLFSR[this.CLOCK_LFSR_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Update data LFSR (polynomial: x^23 + x^18 + 1)
     * @returns {number} Output bit for keystream
     */
    updateDataLFSR: function() {
      const output = this.dataLFSR[0];
      const feedback = this.dataLFSR[0] ^ this.dataLFSR[5]; // Taps at positions 0 and 5 (counting from 0)
      
      // Shift register
      for (let i = 0; i < this.DATA_LFSR_LENGTH - 1; i++) {
        this.dataLFSR[i] = this.dataLFSR[i + 1];
      }
      this.dataLFSR[this.DATA_LFSR_LENGTH - 1] = feedback;
      
      return output;
    },
    
    /**
     * Generate a single output bit using stop-and-go clocking
     * @returns {number} Output bit (0 or 1)
     */
    generateBit: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      // Always clock the control LFSR
      const clockBit = this.updateClockLFSR();
      
      // Clock the data LFSR only when clock control bit is 1
      // Otherwise, output previous value without updating
      let output;
      if (clockBit === 1) {
        output = this.updateDataLFSR();
      } else {
        // Output current bit without updating
        output = this.dataLFSR[0];
      }
      
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
     * Encrypt block using Beth-Piper generator
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
     * Get current LFSR states for debugging
     * @returns {Object} Current states of both LFSRs
     */
    getStates: function() {
      return {
        clockLFSR: this.clockLFSR ? this.clockLFSR.slice() : null,
        dataLFSR: this.dataLFSR ? this.dataLFSR.slice() : null
      };
    },
    
    /**
     * Get statistics about clocking behavior
     * @param {number} samples - Number of samples to analyze
     * @returns {Object} Clocking statistics
     */
    getClockingStats: function(samples = 1000) {
      const stats = {
        totalClocks: 0,
        dataClocks: 0,
        clockingRatio: 0
      };
      
      if (!this.isInitialized) {
        return stats;
      }
      
      // Save current state
      const savedClockLFSR = this.clockLFSR.slice();
      const savedDataLFSR = this.dataLFSR.slice();
      
      // Analyze clocking
      for (let i = 0; i < samples; i++) {
        const clockBit = this.updateClockLFSR();
        stats.totalClocks++;
        
        if (clockBit === 1) {
          stats.dataClocks++;
          this.updateDataLFSR();
        }
      }
      
      stats.clockingRatio = stats.dataClocks / stats.totalClocks;
      
      // Restore state
      this.clockLFSR = savedClockLFSR;
      this.dataLFSR = savedDataLFSR;
      
      return stats;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.clockLFSR) {
        OpCodes.ClearArray(this.clockLFSR);
        this.clockLFSR = null;
      }
      if (this.dataLFSR) {
        OpCodes.ClearArray(this.dataLFSR);
        this.dataLFSR = null;
      }
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Cipher system
  if (global.Cipher) {
    global.AlgorithmFramework.RegisterAlgorithm(BethPiper);
  }
  
  // Make available globally (using filename format for test compatibility)
  global['BETH-PIPER'] = BethPiper;
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BethPiper;
  }
  
})(typeof global !== 'undefined' ? global : window);