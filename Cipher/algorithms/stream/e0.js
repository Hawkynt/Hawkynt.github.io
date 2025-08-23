#!/usr/bin/env node
/*
 * Universal E0 Bluetooth Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Bluetooth SIG specification
 * (c)2006-2025 Hawkynt
 * 
 * E0 is the stream cipher used in the Bluetooth protocol for encryption.
 * It combines four LFSRs of different lengths with a nonlinear combining function.
 * 
 * Key characteristics:
 * - Key lengths: 8-128 bits (typically 128 bits)
 * - Four LFSRs of lengths: 25, 31, 33, 39 bits
 * - Two 2-bit memory elements
 * - Nonlinear combining function based on majority logic
 * 
 * SECURITY WARNING: E0 has known cryptanalytic vulnerabilities and should not
 * be used for new security applications. Implemented for educational purposes.
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
  } else {
      console.error('E0 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create E0 cipher object
  const E0 = {
    // Public interface properties
    internalName: 'E0',
    name: 'E0 Bluetooth Stream Cipher',
    comment: 'E0 Bluetooth Stream Cipher - DEPRECATED: Has known vulnerabilities',
    minKeyLength: 1,    // 8 bits minimum
    maxKeyLength: 16,   // 128 bits maximum
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // E0 constants
    LFSR_LENGTHS: [25, 31, 33, 39],  // Four LFSR lengths
    TOTAL_STATE_BITS: 132,           // 25+31+33+39 + 4 memory bits
    
    // Primitive feedback polynomials for each LFSR (from Bluetooth spec)
    FEEDBACK_POLYNOMIALS: [
      // LFSR 0 (25 bits): x^25 + x^20 + x^12 + x^8 + 1
      [0, 8, 12, 20, 24],
      // LFSR 1 (31 bits): x^31 + x^24 + x^16 + x^12 + 1  
      [0, 12, 16, 24, 30],
      // LFSR 2 (33 bits): x^33 + x^28 + x^24 + x^4 + 1
      [0, 4, 24, 28, 32],
      // LFSR 3 (39 bits): x^39 + x^36 + x^28 + x^4 + 1
      [0, 4, 28, 36, 38]
    ],
    
    // Output tap positions for each LFSR
    OUTPUT_TAPS: [24, 30, 32, 38], // MSB positions for each LFSR
    
    // Initialize cipher
    Init: function() {
      E0.isInitialized = true;
    },
    
    // Set up key and initialize E0 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'E0[' + global.generateUniqueID() + ']';
      } while (E0.instances[id] || global.objectInstances[id]);
      
      E0.instances[id] = new E0.E0Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (E0.instances[id]) {
        // Clear sensitive data
        const instance = E0.instances[id];
        if (instance.lfsr && global.OpCodes) {
          for (let i = 0; i < instance.lfsr.length; i++) {
            global.OpCodes.ClearArray(instance.lfsr[i]);
          }
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete E0.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Generate keystream and XOR with input (encryption/decryption)
    encryptBlock: function(id, input) {
      const instance = E0.instances[id];
      if (!instance) {
        throw new Error('Invalid E0 instance ID');
      }
      
      const inputBytes = global.OpCodes.AsciiToBytes(input);
      const outputBytes = new Array(inputBytes.length);
      
      for (let i = 0; i < inputBytes.length; i++) {
        const keystreamByte = instance.generateKeystreamByte();
        outputBytes[i] = inputBytes[i] ^ keystreamByte;
      }
      
      return global.OpCodes.BytesToString(outputBytes);
    },
    
    // Decryption is identical to encryption for stream ciphers
    decryptBlock: function(id, input) {
      return E0.encryptBlock(id, input);
    },
    
    // E0 instance class
    E0Instance: function(key) {
      this.keyBytes = global.OpCodes.AsciiToBytes(key);
      this.keyLength = this.keyBytes.length;
      
      // Initialize four LFSRs
      this.lfsr = new Array(4);
      for (let i = 0; i < 4; i++) {
        this.lfsr[i] = new Array(E0.LFSR_LENGTHS[i]).fill(0);
      }
      
      // Initialize 2-bit memory elements (c0, c-1)
      this.c0 = 0;
      this.c_minus_1 = 0;
      
      this.initializeLFSRs();
    }
  };
  
  // Add methods to the instance prototype
  E0.E0Instance.prototype.initializeLFSRs = function() {
    // Load key material into LFSRs
    let keyBitIndex = 0;
    const totalKeyBits = this.keyLength * 8;
    
    // Distribute key bits across all four LFSRs
    for (let reg = 0; reg < 4; reg++) {
      const length = E0.LFSR_LENGTHS[reg];
      
      for (let i = 0; i < length; i++) {
        if (keyBitIndex < totalKeyBits) {
          const byteIndex = Math.floor(keyBitIndex / 8);
          const bitIndex = keyBitIndex % 8;
          this.lfsr[reg][i] = (this.keyBytes[byteIndex] >> bitIndex) & 1;
          keyBitIndex++;
        } else {
          // Repeat key pattern if key is shorter than total LFSR space
          const repeatIndex = keyBitIndex % totalKeyBits;
          const byteIndex = Math.floor(repeatIndex / 8);
          const bitIndex = repeatIndex % 8;
          this.lfsr[reg][i] = (this.keyBytes[byteIndex] >> bitIndex) & 1;
          keyBitIndex++;
        }
      }
    }
    
    // Ensure no LFSR is all zeros
    for (let reg = 0; reg < 4; reg++) {
      let allZero = true;
      for (let i = 0; i < E0.LFSR_LENGTHS[reg]; i++) {
        if (this.lfsr[reg][i] !== 0) {
          allZero = false;
          break;
        }
      }
      if (allZero) {
        this.lfsr[reg][0] = 1;  // Set LSB to prevent all-zero state
      }
    }
    
    // Initialize memory elements with some key-derived values
    this.c0 = (this.keyBytes[0] ^ this.keyBytes[1 % this.keyLength]) & 3;
    this.c_minus_1 = (this.keyBytes[2 % this.keyLength] ^ this.keyBytes[3 % this.keyLength]) & 3;
  };
  
  E0.E0Instance.prototype.clockLFSR = function(regIndex) {
    const reg = this.lfsr[regIndex];
    const length = E0.LFSR_LENGTHS[regIndex];
    const taps = E0.FEEDBACK_POLYNOMIALS[regIndex];
    
    // Calculate feedback using primitive polynomial
    let feedback = 0;
    for (let i = 0; i < taps.length; i++) {
      feedback ^= reg[taps[i]];
    }
    
    // Get output bit before shifting
    const output = reg[length - 1];
    
    // Shift register
    for (let i = length - 1; i > 0; i--) {
      reg[i] = reg[i - 1];
    }
    reg[0] = feedback;
    
    return output;
  };
  
  E0.E0Instance.prototype.combiningFunction = function(outputs) {
    // E0 combining function using majority logic and memory elements
    
    // Sum the four LFSR outputs
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += outputs[i];
    }
    
    // Add memory elements
    sum += this.c0 + this.c_minus_1;
    
    // Extract output bit and carry bits
    const outputBit = sum & 1;
    const carry = sum >> 1;
    
    // Update memory elements (simplified E0 state update)
    this.c_minus_1 = this.c0;
    this.c0 = carry & 3;  // Keep only 2 bits
    
    return outputBit;
  };
  
  E0.E0Instance.prototype.generateKeystreamBit = function() {
    // Clock all four LFSRs and get output bits
    const outputs = new Array(4);
    for (let i = 0; i < 4; i++) {
      outputs[i] = this.clockLFSR(i);
    }
    
    // Apply combining function
    return this.combiningFunction(outputs);
  };
  
  E0.E0Instance.prototype.generateKeystreamByte = function() {
    let keystreamByte = 0;
    
    for (let bit = 0; bit < 8; bit++) {
      const keystreamBit = this.generateKeystreamBit();
      keystreamByte |= (keystreamBit << bit);
    }
    
    return keystreamByte;
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(E0);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = E0;
  }
  
})(typeof global !== 'undefined' ? global : window);