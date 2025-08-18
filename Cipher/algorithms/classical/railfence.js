/*
 * Universal Rail Fence Cipher
 * Compatible with both Browser and Node.js environments
 * Classical transposition cipher with zigzag pattern
 * (c)2025 Hawkynt - Educational implementation
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
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
      console.error('Rail Fence cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load metadata system
  if (!global.CipherMetadata && typeof require !== 'undefined') {
    try {
      require('../../cipher-metadata.js');
    } catch (e) {
      console.warn('Could not load cipher metadata system:', e.message);
    }
  }

  // Create Rail Fence cipher object
  const RailFence = {
    // Public interface properties
    internalName: 'RailFence',
    name: 'Rail Fence Cipher',
    comment: 'Classical zigzag transposition cipher with configurable rails',
    minKeyLength: 1,
    maxKeyLength: 1,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The rail fence cipher is a classical transposition cipher where plaintext is written diagonally on successive "rails" of an imaginary fence, then read off horizontally to produce ciphertext.',
      country: 'US',
      countryName: 'United States',
      nYear: 1800, // Approximate historical usage
      inventor: 'Unknown (Classical)',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'transposition',
      securityLevel: 'obsolete',
      complexity: 'beginner',
      
      // Technical Details
      blockSize: 0, // Variable length
      keySizes: [1], // Number of rails
      keyType: 'integer',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['historical', 'educational', 'broken', 'transposition', 'zigzag'],
      educationalLevel: 'elementary',
      prerequisites: ['basic_patterns'],
      learningObjectives: 'Understanding transposition ciphers and visual pattern recognition',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'OBSOLETE: Easily broken by brute force due to limited key space. For educational purposes only.',
      vulnerabilities: ['brute_force', 'frequency_analysis', 'known_plaintext'],
      
      // Standards and References
      specifications: [
        {
          name: 'Rail Fence Cipher - Classical Cryptography',
          url: 'https://en.wikipedia.org/wiki/Rail_fence_cipher',
          type: 'educational',
          verified: true
        }
      ]
    },

    // Algorithm constants
    MIN_RAILS: 2,
    MAX_RAILS: 26,
    DEFAULT_RAILS: 3,

    // Initialize cipher (optional for Rail Fence)
    Init: function() {
      this.isInitialized = true;
      return true;
    },

    // Set up key (number of rails)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'RailFence[' + global.generateUniqueID() + ']';
      } while (RailFence.instances[id] || global.objectInstances[id]);
      
      try {
        RailFence.instances[id] = new RailFence.RailFenceInstance(optional_key);
        global.objectInstances[id] = true;
        return id;
      } catch (e) {
        global.throwException('Key Setup Exception', e.message, 'RailFence', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (RailFence.instances[id]) {
        delete RailFence.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RailFence', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!RailFence.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RailFence', 'encryptBlock');
        return plaintext;
      }
      
      const instance = RailFence.instances[id];
      const rails = instance.rails;
      
      if (plaintext.length === 0) {
        return '';
      }
      
      if (rails < 2) {
        return plaintext; // No transformation needed
      }
      
      // Create rail arrays
      const railArrays = [];
      for (let i = 0; i < rails; i++) {
        railArrays[i] = [];
      }
      
      // Fill rails with zigzag pattern
      let currentRail = 0;
      let direction = 1; // 1 for down, -1 for up
      
      for (let i = 0; i < plaintext.length; i++) {
        railArrays[currentRail].push(plaintext.charAt(i));
        
        // Move to next rail
        currentRail += direction;
        
        // Change direction at boundaries
        if (currentRail === rails - 1 || currentRail === 0) {
          direction *= -1;
        }
      }
      
      // Read off rails horizontally
      let result = '';
      for (let i = 0; i < rails; i++) {
        result += railArrays[i].join('');
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!RailFence.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RailFence', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = RailFence.instances[id];
      const rails = instance.rails;
      
      if (ciphertext.length === 0) {
        return '';
      }
      
      if (rails < 2) {
        return ciphertext; // No transformation needed
      }
      
      // Create rail arrays
      const railArrays = [];
      for (let i = 0; i < rails; i++) {
        railArrays[i] = [];
      }
      
      // Calculate how many characters go on each rail
      const railLengths = new Array(rails).fill(0);
      let currentRail = 0;
      let direction = 1;
      
      for (let i = 0; i < ciphertext.length; i++) {
        railLengths[currentRail]++;
        currentRail += direction;
        
        if (currentRail === rails - 1 || currentRail === 0) {
          direction *= -1;
        }
      }
      
      // Distribute cipher text to rails
      let pos = 0;
      for (let i = 0; i < rails; i++) {
        for (let j = 0; j < railLengths[i]; j++) {
          railArrays[i].push(ciphertext.charAt(pos++));
        }
      }
      
      // Read back in zigzag pattern
      const railIndices = new Array(rails).fill(0);
      currentRail = 0;
      direction = 1;
      let result = '';
      
      for (let i = 0; i < ciphertext.length; i++) {
        result += railArrays[currentRail][railIndices[currentRail]++];
        currentRail += direction;
        
        if (currentRail === rails - 1 || currentRail === 0) {
          direction *= -1;
        }
      }
      
      return result;
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    },
    
    // Instance class
    RailFenceInstance: function(key) {
      // Parse rails from key
      let rails = RailFence.DEFAULT_RAILS;
      
      if (key && key.length > 0) {
        const parsedRails = parseInt(key, 10);
        if (!isNaN(parsedRails) && parsedRails >= RailFence.MIN_RAILS && parsedRails <= RailFence.MAX_RAILS) {
          rails = parsedRails;
        } else {
          throw new Error(`Invalid number of rails: ${key}. Must be integer between ${RailFence.MIN_RAILS} and ${RailFence.MAX_RAILS}`);
        }
      }
      
      this.rails = rails;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(RailFence);
  }
  
  // Export to global scope
  global.RailFence = RailFence;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RailFence;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);