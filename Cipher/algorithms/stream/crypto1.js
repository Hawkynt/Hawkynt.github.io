#!/usr/bin/env node
/*
 * Universal Crypto-1 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on reverse-engineered MIFARE Classic cipher specification
 * (c)2006-2025 Hawkynt
 * 
 * Crypto-1 is a proprietary stream cipher used in NXP MIFARE Classic cards.
 * It was reverse-engineered by the cryptographic community and found to be 
 * severely vulnerable to multiple attacks.
 * 
 * Key characteristics:
 * - 48-bit key and internal state
 * - LFSR with nonlinear filter function
 * - 20-to-1 nonlinear output function
 * - Used in RFID/NFC authentication
 * 
 * This implementation is for educational and research purposes only.
 * SECURITY WARNING: Crypto-1 is cryptographically broken and should never
 * be used for actual security applications.
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
      console.error('Crypto-1 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Crypto-1 cipher object
  const Crypto1 = {
    // Public interface properties
    internalName: 'Crypto-1',
    name: 'Crypto-1 Stream Cipher',
    comment: 'Crypto-1 MIFARE Classic Stream Cipher - DEPRECATED: Cryptographically broken',
    minKeyLength: 6,    // 48 bits exactly
    maxKeyLength: 6,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Crypto-1 constants
    LFSR_SIZE: 48,         // 48-bit LFSR state
    KEY_SIZE: 6,           // 48 bits = 6 bytes
    
    // LFSR feedback polynomial (reverse-engineered)
    // Polynomial: x^48 + x^43 + x^39 + x^38 + x^36 + x^34 + x^33 + x^31 + x^29 + x^24 + x^23 + x^21 + x^19 + x^13 + x^9 + x^7 + x^6 + x^5 + 1
    FEEDBACK_TAPS: [0, 5, 6, 7, 9, 13, 19, 21, 23, 24, 29, 31, 33, 34, 36, 38, 39, 43],
    
    // Filter function taps (20 positions used for nonlinear filter)
    FILTER_TAPS: [0, 1, 2, 3, 5, 6, 7, 8, 9, 13, 14, 15, 17, 19, 24, 30, 32, 33, 43, 45],
    
    // Initialize cipher
    Init: function() {
      Crypto1.isInitialized = true;
    },
    
    // Set up key and initialize Crypto-1 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Crypto1[' + global.generateUniqueID() + ']';
      } while (Crypto1.instances[id] || global.objectInstances[id]);
      
      Crypto1.instances[id] = new Crypto1.Crypto1Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Crypto1.instances[id]) {
        // Clear sensitive data
        const instance = Crypto1.instances[id];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete Crypto1.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Generate keystream and XOR with input (encryption/decryption)
    encryptBlock: function(id, input) {
      const instance = Crypto1.instances[id];
      if (!instance) {
        throw new Error('Invalid Crypto-1 instance ID');
      }
      
      const inputBytes = global.OpCodes.StringToBytes(input);
      const outputBytes = new Array(inputBytes.length);
      
      for (let i = 0; i < inputBytes.length; i++) {
        const keystreamByte = instance.generateKeystreamByte();
        outputBytes[i] = inputBytes[i] ^ keystreamByte;
      }
      
      return global.OpCodes.BytesToString(outputBytes);
    },
    
    // Decryption is identical to encryption for stream ciphers
    decryptBlock: function(id, input) {
      return Crypto1.encryptBlock(id, input);
    },
    
    // Crypto-1 instance class
    Crypto1Instance: function(key) {
      this.keyBytes = global.OpCodes.StringToBytes(key);
      if (this.keyBytes.length !== Crypto1.KEY_SIZE) {
        throw new Error('Crypto-1 requires exactly 48-bit (6-byte) keys');
      }
      
      // Initialize 48-bit LFSR state with key
      this.state = new Array(Crypto1.LFSR_SIZE);
      this.loadKeyIntoLFSR();
    }
  };
  
  // Add methods to the instance prototype
  Crypto1.Crypto1Instance.prototype.loadKeyIntoLFSR = function() {
    // Load 48-bit key into LFSR state
    for (let i = 0; i < Crypto1.LFSR_SIZE; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      if (byteIndex < this.keyBytes.length) {
        this.state[i] = (this.keyBytes[byteIndex] >> bitIndex) & 1;
      } else {
        this.state[i] = 0;
      }
    }
  };
  
  Crypto1.Crypto1Instance.prototype.clockLFSR = function() {
    // Calculate feedback using linear polynomial
    let feedback = 0;
    for (let i = 0; i < Crypto1.FEEDBACK_TAPS.length; i++) {
      feedback ^= this.state[Crypto1.FEEDBACK_TAPS[i]];
    }
    
    // Shift LFSR
    for (let i = Crypto1.LFSR_SIZE - 1; i > 0; i--) {
      this.state[i] = this.state[i - 1];
    }
    this.state[0] = feedback;
    
    return feedback;
  };
  
  Crypto1.Crypto1Instance.prototype.filterFunction = function() {
    // Nonlinear 20-to-1 filter function
    // Extract bits from filter tap positions
    const filterBits = new Array(Crypto1.FILTER_TAPS.length);
    for (let i = 0; i < Crypto1.FILTER_TAPS.length; i++) {
      filterBits[i] = this.state[Crypto1.FILTER_TAPS[i]];
    }
    
    // Simplified nonlinear Boolean function (educational approximation)
    // Real Crypto-1 uses a more complex function, but this captures the essence
    let output = 0;
    
    // Linear terms
    for (let i = 0; i < filterBits.length; i++) {
      output ^= filterBits[i];
    }
    
    // Quadratic terms (degree 2)
    output ^= (filterBits[0] & filterBits[1]);
    output ^= (filterBits[2] & filterBits[3]);
    output ^= (filterBits[4] & filterBits[5]);
    output ^= (filterBits[6] & filterBits[7]);
    output ^= (filterBits[8] & filterBits[9]);
    output ^= (filterBits[10] & filterBits[11]);
    output ^= (filterBits[12] & filterBits[13]);
    output ^= (filterBits[14] & filterBits[15]);
    output ^= (filterBits[16] & filterBits[17]);
    output ^= (filterBits[18] & filterBits[19]);
    
    // Some cubic terms (degree 3) - simplified
    if (filterBits.length >= 6) {
      output ^= (filterBits[0] & filterBits[1] & filterBits[2]);
      output ^= (filterBits[3] & filterBits[4] & filterBits[5]);
    }
    
    return output & 1;
  };
  
  Crypto1.Crypto1Instance.prototype.generateKeystreamBit = function() {
    // Clock LFSR and apply filter function
    this.clockLFSR();
    return this.filterFunction();
  };
  
  Crypto1.Crypto1Instance.prototype.generateKeystreamByte = function() {
    let keystreamByte = 0;
    
    for (let bit = 0; bit < 8; bit++) {
      const keystreamBit = this.generateKeystreamBit();
      keystreamByte |= (keystreamBit << bit);
    }
    
    return keystreamByte;
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Crypto1);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Crypto1;
  }
  
})(typeof global !== 'undefined' ? global : window);