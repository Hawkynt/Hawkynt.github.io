#!/usr/bin/env node
/*
 * Universal FISH Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Siemens specification by Blöcher and Dichtl (1993)
 * (c)2006-2025 Hawkynt
 * 
 * FISH (FIbonacci SHrinking) is a software-based stream cipher that combines:
 * - Lagged Fibonacci generators for fast 32-bit word operations
 * - Shrinking generator principle for output selection
 * - Variable key length support
 * 
 * Key characteristics:
 * - Designed for fast software implementation (15 Mbit/s on Intel 486)
 * - Uses 32-bit word operations for efficiency
 * - Variable key length (large keys supported)
 * - Lagged Fibonacci generator with shrinking
 * 
 * SECURITY WARNING: FISH has known cryptanalytic vulnerabilities (broken by 
 * Ross Anderson with few thousand bits of known plaintext). Educational use only.
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
      console.error('FISH cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create FISH cipher object
  const FISH = {
    // Public interface properties
    internalName: 'FISH',
    name: 'FISH Stream Cipher',
    comment: 'FISH (FIbonacci SHrinking) Stream Cipher - DEPRECATED: Cryptographically broken',
    minKeyLength: 4,    // Minimum practical key length
    maxKeyLength: 256,  // Large key support (huge key length)
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // FISH constants
    LAG_P: 17,             // First lag parameter
    LAG_Q: 5,              // Second lag parameter  
    REGISTER_SIZE: 17,     // Size of Lagged Fibonacci register
    WORD_SIZE: 32,         // 32-bit words for efficiency
    
    // Initialize cipher
    Init: function() {
      FISH.isInitialized = true;
    },
    
    // Set up key and initialize FISH state
    KeySetup: function(key) {
      let id;
      do {
        id = 'FISH[' + global.generateUniqueID() + ']';
      } while (FISH.instances[id] || global.objectInstances[id]);
      
      FISH.instances[szID] = new FISH.FISHInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (FISH.instances[id]) {
        // Clear sensitive data
        const instance = FISH.instances[szID];
        if (instance.fibonacciRegister && global.OpCodes) {
          global.OpCodes.ClearArray(instance.fibonacciRegister);
        }
        if (instance.shrinkingRegister && global.OpCodes) {
          global.OpCodes.ClearArray(instance.shrinkingRegister);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete FISH.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Generate keystream and XOR with input (encryption/decryption)
    encryptBlock: function(id, szInput) {
      const instance = FISH.instances[szID];
      if (!instance) {
        throw new Error('Invalid FISH instance ID');
      }
      
      const inputBytes = global.OpCodes.StringToBytes(szInput);
      const outputBytes = new Array(inputBytes.length);
      
      for (let i = 0; i < inputBytes.length; i++) {
        const keystreamByte = instance.generateKeystreamByte();
        outputBytes[i] = inputBytes[i] ^ keystreamByte;
      }
      
      return global.OpCodes.BytesToString(outputBytes);
    },
    
    // Decryption is identical to encryption for stream ciphers
    decryptBlock: function(id, szInput) {
      return FISH.encryptBlock(id, szInput);
    },
    
    // FISH instance class
    FISHInstance: function(key) {
      this.keyBytes = global.OpCodes.StringToBytes(key);
      this.keyLength = this.keyBytes.length;
      
      // Initialize Lagged Fibonacci generator (32-bit words)
      this.fibonacciRegister = new Array(FISH.REGISTER_SIZE).fill(0);
      
      // Initialize shrinking control register
      this.shrinkingRegister = new Array(FISH.REGISTER_SIZE).fill(0);
      
      // Position counters
      this.fibPos = 0;
      this.shrinkPos = 0;
      
      this.initializeRegisters();
    }
  };
  
  // Add methods to the instance prototype
  FISH.FISHInstance.prototype.initializeRegisters = function() {
    // Initialize Lagged Fibonacci register with key material
    for (let i = 0; i < FISH.REGISTER_SIZE; i++) {
      let word = 0;
      
      // Pack 4 key bytes into each 32-bit word
      for (let j = 0; j < 4; j++) {
        const keyIndex = (i * 4 + j) % this.keyLength;
        word |= (this.keyBytes[keyIndex] << (j * 8));
      }
      
      // Ensure non-zero values in register
      if (word === 0) {
        word = 0x12345678 + i;
      }
      
      this.fibonacciRegister[i] = word >>> 0; // Ensure 32-bit unsigned
    }
    
    // Initialize shrinking register differently
    for (let i = 0; i < FISH.REGISTER_SIZE; i++) {
      let word = 0;
      
      // Use different key pattern for shrinking register
      for (let j = 0; j < 4; j++) {
        const keyIndex = (i * 4 + j + this.keyLength / 2) % this.keyLength;
        word |= (this.keyBytes[keyIndex] << (j * 8));
      }
      
      if (word === 0) {
        word = 0x87654321 + i;
      }
      
      this.shrinkingRegister[i] = word >>> 0;
    }
    
    // Warm-up the generators
    for (let i = 0; i < 100; i++) {
      this.clockFibonacci();
      this.clockShrinking();
    }
  };
  
  FISH.FISHInstance.prototype.clockFibonacci = function() {
    // Lagged Fibonacci generator: X[n] = X[n-p] + X[n-q] (mod 2^32)
    const p = FISH.LAG_P;
    const q = FISH.LAG_Q;
    
    const pos_p = (this.fibPos - p + FISH.REGISTER_SIZE) % FISH.REGISTER_SIZE;
    const pos_q = (this.fibPos - q + FISH.REGISTER_SIZE) % FISH.REGISTER_SIZE;
    
    const newValue = (this.fibonacciRegister[pos_p] + this.fibonacciRegister[pos_q]) >>> 0;
    
    this.fibonacciRegister[this.fibPos] = newValue;
    this.fibPos = (this.fibPos + 1) % FISH.REGISTER_SIZE;
    
    return newValue;
  };
  
  FISH.FISHInstance.prototype.clockShrinking = function() {
    // Shrinking generator control sequence
    const p = FISH.LAG_P;
    const q = FISH.LAG_Q;
    
    const pos_p = (this.shrinkPos - p + FISH.REGISTER_SIZE) % FISH.REGISTER_SIZE;
    const pos_q = (this.shrinkPos - q + FISH.REGISTER_SIZE) % FISH.REGISTER_SIZE;
    
    const newValue = (this.shrinkingRegister[pos_p] ^ this.shrinkingRegister[pos_q]) >>> 0;
    
    this.shrinkingRegister[this.shrinkPos] = newValue;
    this.shrinkPos = (this.shrinkPos + 1) % FISH.REGISTER_SIZE;
    
    return newValue;
  };
  
  FISH.FISHInstance.prototype.generateKeystreamWord = function() {
    // FISH shrinking principle: generate Fibonacci values until shrinking bit is 1
    let fibValue, shrinkValue;
    
    do {
      fibValue = this.clockFibonacci();
      shrinkValue = this.clockShrinking();
    } while ((shrinkValue & 1) === 0); // Continue until LSB of shrinking value is 1
    
    return fibValue;
  };
  
  FISH.FISHInstance.prototype.generateKeystreamByte = function() {
    // Generate a 32-bit keystream word
    if (!this.currentWord || this.wordBytesUsed >= 4) {
      this.currentWord = this.generateKeystreamWord();
      this.wordBytesUsed = 0;
    }
    
    // Extract next byte from current word
    const byte = (this.currentWord >> (this.wordBytesUsed * 8)) & 0xFF;
    this.wordBytesUsed++;
    
    return byte;
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(FISH);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FISH;
  }
  
})(typeof global !== 'undefined' ? global : window);