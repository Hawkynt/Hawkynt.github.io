#!/usr/bin/env node
/*
 * Universal F-FCSR Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on eSTREAM specification by Arnault, Berger, and Lauradoux
 * (c)2006-2025 Hawkynt
 * 
 * F-FCSR is a stream cipher based on Feedback with Carry Shift Registers.
 * It computes binary expansion of 2-adic numbers using FCSR automaton.
 * 
 * Variants:
 * - F-FCSR-H: 80-bit key, 160-bit FCSR, 82-bit carry register
 * - F-FCSR-8: 128-bit key, 128-bit FCSR, 65-bit carry register
 * 
 * Key characteristics:
 * - Uses FCSR automaton (nonlinear feedback with carries)
 * - Linear filtering of FCSR states for output
 * - 8-bit output per automaton transition
 * 
 * SECURITY WARNING: F-FCSR has been cryptanalytically broken and should not
 * be used for actual security. Implemented for educational purposes only.
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
      console.error('F-FCSR cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create F-FCSR cipher object
  const FFCSR = {
    // Public interface properties
    internalName: 'F-FCSR',
    name: 'F-FCSR Stream Cipher',
    comment: 'F-FCSR Feedback with Carry Shift Register - DEPRECATED: Cryptographically broken',
    minKeyLength: 10,   // 80 bits for F-FCSR-H
    maxKeyLength: 16,   // 128 bits for F-FCSR-8
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // F-FCSR variants configuration
    VARIANTS: {
      'F-FCSR-H': { keySize: 10, mainRegSize: 160, carryRegSize: 82 },   // 80-bit variant
      'F-FCSR-8': { keySize: 16, mainRegSize: 128, carryRegSize: 65 }    // 128-bit variant
    },
    
    // Initialize cipher
    Init: function() {
      FFCSR.isInitialized = true;
    },
    
    // Set up key and initialize F-FCSR state
    KeySetup: function(key) {
      let id;
      do {
        id = 'F-FCSR[' + global.generateUniqueID() + ']';
      } while (FFCSR.instances[id] || global.objectInstances[id]);
      
      FFCSR.instances[id] = new FFCSR.FFCSRInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (FFCSR.instances[id]) {
        // Clear sensitive data
        const instance = FFCSR.instances[id];
        if (instance.mainRegister && global.OpCodes) {
          global.OpCodes.ClearArray(instance.mainRegister);
        }
        if (instance.carryRegister && global.OpCodes) {
          global.OpCodes.ClearArray(instance.carryRegister);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete FFCSR.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Generate keystream and XOR with input (encryption/decryption)
    encryptBlock: function(id, input) {
      const instance = FFCSR.instances[id];
      if (!instance) {
        throw new Error('Invalid F-FCSR instance ID');
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
      return FFCSR.encryptBlock(id, input);
    },
    
    // F-FCSR instance class
    FFCSRInstance: function(key) {
      this.keyBytes = global.OpCodes.AsciiToBytes(key);
      this.keyLength = this.keyBytes.length;
      
      // Determine variant based on key length
      if (this.keyLength <= 10) {
        this.variant = FFCSR.VARIANTS['F-FCSR-H'];
        this.variantName = 'F-FCSR-H';
      } else {
        this.variant = FFCSR.VARIANTS['F-FCSR-8'];
        this.variantName = 'F-FCSR-8';
      }
      
      // Initialize FCSR registers
      this.mainRegister = new Array(this.variant.mainRegSize).fill(0);
      this.carryRegister = new Array(this.variant.carryRegSize).fill(0);
      
      // FCSR connection polynomial (simplified)
      this.connectionPoly = this.generateConnectionPolynomial();
      
      this.initializeFCSR();
    }
  };
  
  // Add methods to the instance prototype
  FFCSR.FFCSRInstance.prototype.generateConnectionPolynomial = function() {
    // Generate connection polynomial based on key
    // In real F-FCSR, this would be derived from key in a more complex way
    const poly = new Array(this.variant.mainRegSize).fill(0);
    
    // Create a pattern based on key bytes
    for (let i = 0; i < this.keyLength; i++) {
      const keyByte = this.keyBytes[i];
      for (let bit = 0; bit < 8; bit++) {
        const polyIndex = (i * 8 + bit) % this.variant.mainRegSize;
        poly[polyIndex] = (keyByte >> bit) & 1;
      }
    }
    
    // Ensure the polynomial is valid (odd number, etc.)
    poly[0] = 1; // Make sure it's odd
    
    return poly;
  };
  
  FFCSR.FFCSRInstance.prototype.initializeFCSR = function() {
    // Initialize main register with key material
    let keyBitIndex = 0;
    const totalKeyBits = this.keyLength * 8;
    
    for (let i = 0; i < this.variant.mainRegSize; i++) {
      if (keyBitIndex < totalKeyBits) {
        const byteIndex = Math.floor(keyBitIndex / 8);
        const bitIndex = keyBitIndex % 8;
        this.mainRegister[i] = (this.keyBytes[byteIndex] >> bitIndex) & 1;
        keyBitIndex++;
      } else {
        // Repeat key pattern if needed
        const repeatIndex = keyBitIndex % totalKeyBits;
        const byteIndex = Math.floor(repeatIndex / 8);
        const bitIndex = repeatIndex % 8;
        this.mainRegister[i] = (this.keyBytes[byteIndex] >> bitIndex) & 1;
        keyBitIndex++;
      }
    }
    
    // Initialize carry register with derived values
    for (let i = 0; i < this.variant.carryRegSize; i++) {
      const keyIndex = i % this.keyLength;
      this.carryRegister[i] = (this.keyBytes[keyIndex] >> (i % 8)) & 1;
    }
    
    // Ensure non-zero state
    if (this.isAllZero(this.mainRegister)) {
      this.mainRegister[0] = 1;
    }
  };
  
  FFCSR.FFCSRInstance.prototype.isAllZero = function(register) {
    for (let i = 0; i < register.length; i++) {
      if (register[i] !== 0) return false;
    }
    return true;
  };
  
  FFCSR.FFCSRInstance.prototype.clockFCSR = function() {
    // FCSR automaton step with carry propagation
    const n = this.variant.mainRegSize;
    const l = this.variant.carryRegSize;
    
    // Calculate feedback with carry
    let sum = 0;
    
    // Add weighted main register values according to connection polynomial
    for (let i = 0; i < n; i++) {
      if (this.connectionPoly[i]) {
        sum += this.mainRegister[i];
      }
    }
    
    // Add carry register contribution
    for (let i = 0; i < Math.min(l, 8); i++) { // Limit carry influence
      sum += this.carryRegister[i] << i;
    }
    
    // Get new bit and carry
    const newBit = sum & 1;
    const newCarry = sum >> 1;
    
    // Shift main register
    for (let i = n - 1; i > 0; i--) {
      this.mainRegister[i] = this.mainRegister[i - 1];
    }
    this.mainRegister[0] = newBit;
    
    // Update carry register
    for (let i = l - 1; i > 0; i--) {
      this.carryRegister[i] = this.carryRegister[i - 1];
    }
    this.carryRegister[0] = newCarry & 1;
    
    // Propagate higher-order carries
    let carryProp = newCarry >> 1;
    for (let i = 1; i < l && carryProp > 0; i++) {
      const sum = this.carryRegister[i] + carryProp;
      this.carryRegister[i] = sum & 1;
      carryProp = sum >> 1;
    }
  };
  
  FFCSR.FFCSRInstance.prototype.generateFilteredOutput = function() {
    // Linear filter function to extract 8 bits from FCSR state
    let output = 0;
    const n = this.variant.mainRegSize;
    
    // 8 subfilters for 8-bit output (simplified implementation)
    for (let bitPos = 0; bitPos < 8; bitPos++) {
      let filterBit = 0;
      
      // Simple linear filter: XOR selected positions
      const step = Math.floor(n / 8);
      for (let i = 0; i < 8; i++) {
        const pos = (bitPos * step + i * step) % n;
        filterBit ^= this.mainRegister[pos];
      }
      
      // Add some carry register bits for nonlinearity
      if (bitPos < this.variant.carryRegSize) {
        filterBit ^= this.carryRegister[bitPos];
      }
      
      output |= (filterBit << bitPos);
    }
    
    return output;
  };
  
  FFCSR.FFCSRInstance.prototype.generateKeystreamByte = function() {
    // Clock the FCSR automaton
    this.clockFCSR();
    
    // Apply linear filter to get 8-bit output
    return this.generateFilteredOutput();
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(FFCSR);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FFCSR;
  }
  
})(typeof global !== 'undefined' ? global : window);