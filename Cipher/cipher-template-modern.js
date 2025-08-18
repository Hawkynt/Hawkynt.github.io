#!/usr/bin/env node
/*
 * Modern Cipher Template (without Hungarian notation)
 * Compatible with both Browser and Node.js environments
 * Use this template for new algorithm implementations
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('./OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Algorithm requires OpCodes library to be loaded first');
      return;
    }
  }
  
  if (!global.CipherModern && !global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('./cipher-api-modern.js');
      } catch (e) {
        try {
          require('./cipher.js');
        } catch (e2) {
          console.error('Failed to load cipher system:', e2.message);
          return;
        }
      }
    } else {
      console.error('Algorithm requires cipher system to be loaded first');
      return;
    }
  }
  
  // Algorithm implementation
  const AlgorithmTemplate = {
    // Modern API (without Hungarian notation)
    name: 'template',
    displayName: 'Algorithm Template',
    description: 'Template for new cipher implementations',
    type: 'Block Cipher', // or 'Stream Cipher', 'Hash Function', etc.
    source: 'Educational Template',
    
    // Algorithm constraints
    minKeyLength: 16,
    maxKeyLength: 32,
    stepKeyLength: 8,
    minBlockSize: 16,
    maxBlockSize: 16,
    stepBlockSize: 1,
    
    // Instance storage
    instances: {},
    initialized: false,
    
    // Algorithm constants
    BLOCK_SIZE: 16,
    ROUNDS: 16,
    
    // Initialize algorithm
    init: function() {
      // Perform any one-time initialization
      AlgorithmTemplate.initialized = true;
    },
    
    // Create and setup key
    createKey: function(key) {
      // Validate key
      if (!key || (key.length < AlgorithmTemplate.minKeyLength || key.length > AlgorithmTemplate.maxKeyLength)) {
        throw new Error(`Invalid key length: expected ${AlgorithmTemplate.minKeyLength}-${AlgorithmTemplate.maxKeyLength}, got ${key ? key.length : 0}`);
      }
      
      // Generate unique instance ID
      let id;
      do {
        id = `${AlgorithmTemplate.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } while (AlgorithmTemplate.instances[id] || global.instances[id]);
      
      // Create instance with processed key
      AlgorithmTemplate.instances[id] = new AlgorithmTemplate.Instance(key);
      global.instances[id] = true;
      
      return id;
    },
    
    // Encrypt data
    encrypt: function(keyId, plaintext, options = {}) {
      const instance = AlgorithmTemplate.instances[keyId];
      if (!instance) {
        throw new Error(`Unknown key instance: ${keyId}`);
      }
      
      // Validate input
      if (!plaintext || plaintext.length !== AlgorithmTemplate.BLOCK_SIZE) {
        throw new Error(`Invalid block size: expected ${AlgorithmTemplate.BLOCK_SIZE}, got ${plaintext ? plaintext.length : 0}`);
      }
      
      return AlgorithmTemplate.encryptBlock(instance, plaintext);
    },
    
    // Decrypt data
    decrypt: function(keyId, ciphertext, options = {}) {
      const instance = AlgorithmTemplate.instances[keyId];
      if (!instance) {
        throw new Error(`Unknown key instance: ${keyId}`);
      }
      
      // Validate input
      if (!ciphertext || ciphertext.length !== AlgorithmTemplate.BLOCK_SIZE) {
        throw new Error(`Invalid block size: expected ${AlgorithmTemplate.BLOCK_SIZE}, got ${ciphertext ? ciphertext.length : 0}`);
      }
      
      return AlgorithmTemplate.decryptBlock(instance, ciphertext);
    },
    
    // Clean up instance
    destroy: function(keyId) {
      const instance = AlgorithmTemplate.instances[keyId];
      if (!instance) {
        return false;
      }
      
      // Securely clear sensitive data
      if (instance.expandedKey) {
        global.OpCodes.ClearArray(instance.expandedKey);
      }
      
      delete AlgorithmTemplate.instances[keyId];
      delete global.instances[keyId];
      
      return true;
    },
    
    // Core encryption function
    encryptBlock: function(instance, plaintext) {
      // Convert to words for processing
      const words = global.OpCodes.StringToWords32BE(plaintext);
      let state = words.slice(); // Copy input
      
      // Apply algorithm rounds
      for (let round = 0; round < AlgorithmTemplate.ROUNDS; round++) {
        // Example round function using OpCodes
        state[0] = global.OpCodes.RotL32(state[0] ^ instance.roundKeys[round], 8);
        state[1] = global.OpCodes.RotR32(state[1] + instance.roundKeys[round + 1], 16);
        
        // Swap for Feistel structure
        [state[0], state[1], state[2], state[3]] = [state[2], state[3], state[0], state[1]];
      }
      
      // Convert back to string
      return global.OpCodes.Words32BEToString(state);
    },
    
    // Core decryption function
    decryptBlock: function(instance, ciphertext) {
      // Convert to words for processing
      const words = global.OpCodes.StringToWords32BE(ciphertext);
      let state = words.slice(); // Copy input
      
      // Apply algorithm rounds in reverse
      for (let round = AlgorithmTemplate.ROUNDS - 1; round >= 0; round--) {
        // Reverse swap
        [state[0], state[1], state[2], state[3]] = [state[2], state[3], state[0], state[1]];
        
        // Reverse round function
        state[1] = global.OpCodes.RotL32(state[1] - instance.roundKeys[round + 1], 16);
        state[0] = global.OpCodes.RotR32(state[0] ^ instance.roundKeys[round], 8);
      }
      
      // Convert back to string
      return global.OpCodes.Words32BEToString(state);
    },
    
    // Instance class for key storage
    Instance: function(key) {
      this.originalKey = key;
      this.keyLength = key.length;
      
      // Generate round keys using key schedule
      this.generateRoundKeys();
    }
  };
  
  // Add key schedule method to Instance prototype
  AlgorithmTemplate.Instance.prototype.generateRoundKeys = function() {
    // Convert key to bytes
    const keyBytes = global.OpCodes.StringToBytes(this.originalKey);
    
    // Initialize round keys
    this.roundKeys = [];
    
    // Simple key expansion (implement algorithm-specific schedule)
    for (let i = 0; i < AlgorithmTemplate.ROUNDS + 2; i++) {
      let roundKey = 0;
      for (let j = 0; j < 4; j++) {
        const keyIndex = (i * 4 + j) % keyBytes.length;
        roundKey |= (keyBytes[keyIndex] << (j * 8));
      }
      this.roundKeys[i] = roundKey >>> 0; // Ensure unsigned 32-bit
    }
  };
  
  // Register with modern API if available
  if (global.CipherModern && typeof global.CipherModern.register === 'function') {
    try {
      global.CipherModern.register(AlgorithmTemplate);
    } catch (e) {
      console.warn(`Failed to register with modern API: ${e.message}`);
    }
  }
  
  // Register with legacy API as fallback
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    // Create legacy wrapper
    const legacyWrapper = {
      internalName: AlgorithmTemplate.name,
      name: AlgorithmTemplate.displayName,
      comment: AlgorithmTemplate.description,
      minKeyLength: AlgorithmTemplate.minKeyLength,
      maxKeyLength: AlgorithmTemplate.maxKeyLength,
      stepKeyLength: AlgorithmTemplate.stepKeyLength,
      minBlockSize: AlgorithmTemplate.minBlockSize,
      maxBlockSize: AlgorithmTemplate.maxBlockSize,
      stepBlockSize: AlgorithmTemplate.stepBlockSize,
      instances: AlgorithmTemplate.instances,
      cantDecode: false,
      isInitialized: AlgorithmTemplate.initialized,
      
      Init: AlgorithmTemplate.init,
      KeySetup: AlgorithmTemplate.createKey,
      encryptBlock: AlgorithmTemplate.encrypt,
      decryptBlock: AlgorithmTemplate.decrypt,
      ClearData: AlgorithmTemplate.destroy
    };
    
    try {
      global.Cipher.AddCipher(legacyWrapper);
    } catch (e) {
      console.warn(`Failed to register with legacy API: ${e.message}`);
    }
  }
  
  // Export to global scope
  global.AlgorithmTemplate = AlgorithmTemplate;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlgorithmTemplate;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);