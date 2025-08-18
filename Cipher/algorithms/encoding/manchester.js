#!/usr/bin/env node
/*
 * Universal Manchester Encoding/Decoding
 * Based on IEEE 802.3 specification for Ethernet
 * Compatible with both Browser and Node.js environments
 * 
 * Manchester encoding is a line code in which each data bit is represented
 * by at least one transition. It combines clock and data signals and is
 * self-synchronizing. Used in Ethernet 10Base-T and other protocols.
 * 
 * References:
 * - IEEE 802.3: Ethernet Standard
 * - G.E. Thomas Patent (1949): Pulse Code Communication
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
  
  const ManchesterEncoding = {
    internalName: 'manchester',
    name: 'Manchester Encoding',
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

    
    // Encoding variant ('ieee802' or 'g_e_thomas')
    variant: 'ieee802',
    
    /**
     * Initialize the encoder
     */
    Init: function() {
      this.variant = 'ieee802';  // Default to IEEE 802.3 standard
    },
    
    /**
     * Set up encoding variant
     * @param {string|Object} key - Variant selector or configuration
     */
    KeySetup: function(key) {
      if (typeof key === 'string') {
        if (key === 'ieee802' || key === 'g_e_thomas') {
          this.variant = key;
        } else {
          throw new Error('Manchester: Invalid variant. Use "ieee802" or "g_e_thomas"');
        }
      } else if (typeof key === 'object' && key !== null) {
        this.variant = key.variant || 'ieee802';
      } else {
        this.variant = 'ieee802';
      }
    },
    
    /**
     * Encode binary data to Manchester encoded signal
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {Array} Manchester encoded signal (array of 0s and 1s)
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Manchester: Invalid mode for encoding');
      }
      
      // Convert input to bit array
      let bits;
      if (typeof data === 'string') {
        // Convert string to bits
        const bytes = OpCodes.StringToBytes(data);
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
        throw new Error('Manchester: Invalid input data type');
      }
      
      if (bits.length === 0) {
        return [];
      }
      
      const encoded = [];
      
      if (this.variant === 'ieee802') {
        // IEEE 802.3: 0 = high-to-low transition, 1 = low-to-high transition
        for (const bit of bits) {
          if (bit === 0) {
            encoded.push(1, 0);  // High-to-low transition
          } else {
            encoded.push(0, 1);  // Low-to-high transition
          }
        }
      } else if (this.variant === 'g_e_thomas') {
        // G.E. Thomas: 0 = low-to-high transition, 1 = high-to-low transition
        for (const bit of bits) {
          if (bit === 0) {
            encoded.push(0, 1);  // Low-to-high transition
          } else {
            encoded.push(1, 0);  // High-to-low transition
          }
        }
      }
      
      return encoded;
    },
    
    /**
     * Decode Manchester encoded signal to binary data
     * @param {number} mode - Decoding mode (0 = decode to bits, 1 = decode to string)
     * @param {Array} data - Manchester encoded signal
     * @returns {Array|string} Decoded data
     */
    decryptBlock: function(mode, data) {
      if (typeof mode !== 'number' || (mode !== 0 && mode !== 1)) {
        throw new Error('Manchester: Invalid mode for decoding');
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        return mode === 0 ? [] : '';
      }
      
      if (data.length % 2 !== 0) {
        throw new Error('Manchester: Encoded data length must be even');
      }
      
      const bits = [];
      
      // Decode pairs of symbols
      for (let i = 0; i < data.length; i += 2) {
        const first = data[i];
        const second = data[i + 1];
        
        if (this.variant === 'ieee802') {
          // IEEE 802.3: [1,0] = 0, [0,1] = 1
          if (first === 1 && second === 0) {
            bits.push(0);
          } else if (first === 0 && second === 1) {
            bits.push(1);
          } else {
            throw new Error(`Manchester: Invalid transition [${first},${second}] at position ${i}`);
          }
        } else if (this.variant === 'g_e_thomas') {
          // G.E. Thomas: [0,1] = 0, [1,0] = 1
          if (first === 0 && second === 1) {
            bits.push(0);
          } else if (first === 1 && second === 0) {
            bits.push(1);
          } else {
            throw new Error(`Manchester: Invalid transition [${first},${second}] at position ${i}`);
          }
        }
      }
      
      if (mode === 0) {
        // Return as bit array
        return bits;
      } else {
        // Convert bits to string
        if (bits.length % 8 !== 0) {
          throw new Error('Manchester: Bit count must be multiple of 8 for string conversion');
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
     * Analyze Manchester signal for clock recovery
     * @param {Array} signal - Manchester encoded signal
     * @returns {Object} Analysis results
     */
    analyzeSignal: function(signal) {
      if (!Array.isArray(signal) || signal.length === 0) {
        return { valid: false, reason: 'Empty or invalid signal' };
      }
      
      if (signal.length % 2 !== 0) {
        return { valid: false, reason: 'Signal length must be even' };
      }
      
      let validTransitions = 0;
      let invalidTransitions = 0;
      const transitions = [];
      
      for (let i = 0; i < signal.length; i += 2) {
        const first = signal[i];
        const second = signal[i + 1];
        const transition = `${first}${second}`;
        
        transitions.push(transition);
        
        if (transition === '01' || transition === '10') {
          validTransitions++;
        } else {
          invalidTransitions++;
        }
      }
      
      return {
        valid: invalidTransitions === 0,
        totalBits: signal.length / 2,
        validTransitions: validTransitions,
        invalidTransitions: invalidTransitions,
        clockRecovery: validTransitions === signal.length / 2,
        transitions: transitions,
        efficiency: (validTransitions / (validTransitions + invalidTransitions)) * 100
      };
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.variant = 'ieee802';
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
        keySize: 'Variant selector',
        description: 'Manchester encoding for self-synchronizing data transmission',
        variants: {
          'ieee802': 'IEEE 802.3 (0=high-to-low, 1=low-to-high)',
          'g_e_thomas': 'G.E. Thomas (0=low-to-high, 1=high-to-low)'
        },
        features: ['Self-synchronizing', 'Clock recovery', 'DC-balanced'],
        applications: ['Ethernet 10Base-T', 'RFID', 'Infrared communication'],
        inventor: 'G.E. Thomas (1949)',
        standard: 'IEEE 802.3'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(ManchesterEncoding);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManchesterEncoding;
  }
  
  // Make available globally
  global.ManchesterEncoding = ManchesterEncoding;
  
})(typeof global !== 'undefined' ? global : window);