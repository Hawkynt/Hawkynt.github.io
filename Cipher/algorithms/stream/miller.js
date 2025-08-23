#!/usr/bin/env node
/*
 * Universal Miller Encoding/Decoding
 * Based on Miller code (also known as delay encoding)
 * Compatible with both Browser and Node.js environments
 * 
 * Miller encoding is a line code where each bit is represented by
 * a transition at the beginning of the bit period. A '0' bit has
 * no additional transition, while a '1' bit has a transition in
 * the middle of the bit period.
 * 
 * References:
 * - Miller, A. (1963). "High-speed data transmission"
 * - Used in magnetic tape storage and some communications protocols
 * 
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
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
  
  const MillerEncoding = {
    internalName: 'miller',
    name: 'Miller Encoding (Delay Encoding)',
    version: '1.0.0',
        comment: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // Encoding variant ('standard' or 'inverted')
    variant: 'standard',
    
    // Current signal state (for maintaining continuity)
    currentState: 0,
    
    /**
     * Initialize the encoder
     */
    Init: function() {
      this.variant = 'standard';
      this.currentState = 0;
    },
    
    /**
     * Set up encoding variant and initial state
     * @param {string|Object} key - Variant selector or configuration
     */
    KeySetup: function(key) {
      if (typeof key === 'string') {
        if (key === 'standard' || key === 'inverted') {
          this.variant = key;
        } else {
          throw new Error('Miller: Invalid variant. Use "standard" or "inverted"');
        }
      } else if (typeof key === 'object' && key !== null) {
        this.variant = key.variant || 'standard';
        this.currentState = key.initialState || 0;
      } else {
        this.variant = 'standard';
        this.currentState = 0;
      }
    },
    
    /**
     * Encode binary data to Miller encoded signal
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {Array} Miller encoded signal (array of 0s and 1s)
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Miller: Invalid mode for encoding');
      }
      
      // Convert input to bit array
      let bits;
      if (typeof data === 'string') {
        // Convert string to bits
        const bytes = OpCodes.AsciiToBytes(data);
        bits = [];
        for (const byte of bytes) {
          for (let i = 7; i >= 0; i--) {
            bits.push((byte >>> i) & 1);
          }
        }
      } else if (Array.isArray(data)) {
        // Assume array of bits
        bits = data.slice();
      } else {
        throw new Error('Miller: Invalid input data type');
      }
      
      if (bits.length === 0) {
        return [];
      }
      
      const encoded = [];
      let state = this.currentState;
      
      for (const bit of bits) {
        // Always transition at the beginning of bit period
        state = 1 - state;
        encoded.push(state);
        
        if (this.variant === 'standard') {
          // Standard Miller: 1 = transition in middle, 0 = no transition
          if (bit === 1) {
            state = 1 - state;
            encoded.push(state);
          } else {
            encoded.push(state);
          }
        } else if (this.variant === 'inverted') {
          // Inverted Miller: 0 = transition in middle, 1 = no transition
          if (bit === 0) {
            state = 1 - state;
            encoded.push(state);
          } else {
            encoded.push(state);
          }
        }
      }
      
      // Update current state for next encoding
      this.currentState = state;
      
      return encoded;
    },
    
    /**
     * Decode Miller encoded signal to binary data
     * @param {number} mode - Decoding mode (0 = decode to bits, 1 = decode to string)
     * @param {Array} data - Miller encoded signal
     * @returns {Array|string} Decoded data
     */
    decryptBlock: function(mode, data) {
      if (typeof mode !== 'number' || (mode !== 0 && mode !== 1)) {
        throw new Error('Miller: Invalid mode for decoding');
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        return mode === 0 ? [] : '';
      }
      
      if (data.length % 2 !== 0) {
        throw new Error('Miller: Encoded data length must be even');
      }
      
      const bits = [];
      
      // Decode pairs of symbols
      for (let i = 0; i < data.length; i += 2) {
        const first = data[i];
        const second = data[i + 1];
        
        // Check for transition at beginning (always present in Miller)
        // The actual bit value depends on whether there's a transition in the middle
        const hasMiddleTransition = (first !== second);
        
        if (this.variant === 'standard') {
          // Standard Miller: transition in middle = 1, no transition = 0
          bits.push(hasMiddleTransition ? 1 : 0);
        } else if (this.variant === 'inverted') {
          // Inverted Miller: transition in middle = 0, no transition = 1
          bits.push(hasMiddleTransition ? 0 : 1);
        }
      }
      
      if (mode === 0) {
        // Return as bit array
        return bits;
      } else {
        // Convert bits to string
        if (bits.length % 8 !== 0) {
          throw new Error('Miller: Bit count must be multiple of 8 for string conversion');
        }
        
        const bytes = [];
        for (let i = 0; i < bits.length; i += 8) {
          let byte = 0;
          for (let j = 0; j < 8; j++) {
            byte = (byte << 1) | bits[i + j];
          }
          bytes.push(byte);
        }
        
        return OpCodes.BytesToString(bytes);
      }
    },
    
    /**
     * Analyze Miller signal properties
     * @param {Array} signal - Miller encoded signal
     * @returns {Object} Analysis results
     */
    analyzeSignal: function(signal) {
      if (!Array.isArray(signal) || signal.length === 0) {
        return { valid: false, reason: 'Empty or invalid signal' };
      }
      
      if (signal.length % 2 !== 0) {
        return { valid: false, reason: 'Signal length must be even' };
      }
      
      let transitionsAtBoundary = 0;
      let transitionsInMiddle = 0;
      let noTransitionsInMiddle = 0;
      
      // Analyze each bit period (2 symbols)
      for (let i = 0; i < signal.length - 2; i += 2) {
        const currentFirst = signal[i];
        const currentSecond = signal[i + 1];
        const nextFirst = signal[i + 2];
        
        // Check for transition at bit boundary
        if (currentSecond !== nextFirst) {
          transitionsAtBoundary++;
        }
        
        // Check for transition in middle of bit period
        if (currentFirst !== currentSecond) {
          transitionsInMiddle++;
        } else {
          noTransitionsInMiddle++;
        }
      }
      
      const totalBits = signal.length / 2;
      const expectedBoundaryTransitions = totalBits - 1; // All boundaries except the last
      
      return {
        valid: transitionsAtBoundary >= expectedBoundaryTransitions * 0.9, // Allow some tolerance
        totalBits: totalBits,
        boundaryTransitions: transitionsAtBoundary,
        expectedBoundaryTransitions: expectedBoundaryTransitions,
        middleTransitions: transitionsInMiddle,
        noMiddleTransitions: noTransitionsInMiddle,
        boundaryTransitionRate: (transitionsAtBoundary / expectedBoundaryTransitions) * 100,
        middleTransitionRate: (transitionsInMiddle / totalBits) * 100,
        clockRecovery: transitionsAtBoundary >= expectedBoundaryTransitions * 0.8
      };
    },
    
    /**
     * Generate test pattern for clock recovery
     * @param {number} length - Pattern length in bits
     * @returns {Array} Test pattern signal
     */
    generateTestPattern: function(length = 16) {
      // Generate alternating pattern (good for clock recovery)
      const pattern = [];
      for (let i = 0; i < length; i++) {
        pattern.push(i % 2);
      }
      
      return this.encryptBlock(0, pattern);
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.variant = 'standard';
      this.currentState = 0;
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Line Coding',
        blockSize: '1 bit → 2 symbols',
        keySize: 'Variant and initial state',
        description: 'Miller encoding with transition at bit boundaries',
        variants: {
          'standard': 'Transition in middle = 1, no transition = 0',
          'inverted': 'Transition in middle = 0, no transition = 1'
        },
        features: ['Clock recovery', 'Transition at every bit boundary', 'Self-synchronizing'],
        applications: ['Magnetic tape storage', 'Token Ring networks', 'RFID systems'],
        advantages: ['Guaranteed transitions', 'Good clock recovery', 'Error detection'],
        disadvantages: ['100% bandwidth overhead', 'More complex than NRZ']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(MillerEncoding);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MillerEncoding;
  }
  
  // Make available globally
  global.MillerEncoding = MillerEncoding;
  
})(typeof global !== 'undefined' ? global : window);