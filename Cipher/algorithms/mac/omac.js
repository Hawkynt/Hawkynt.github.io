#!/usr/bin/env node
/*
 * Universal OMAC/CMAC (One-Key Cipher-Based MAC)
 * Compatible with both Browser and Node.js environments
 * Based on NIST SP 800-38B specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of OMAC1/CMAC using configurable block ciphers.
 * OMAC provides message authentication using a single key and eliminates
 * the need for multiple keys required by traditional CBC-MAC.
 * 
 * WARNING: This implementation is for educational purposes only.
 * Use NIST-certified implementations for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  // Load block cipher implementations
  if (typeof require !== 'undefined') {
    try {
      require('../block/rijndael.js');
      require('../block/des.js');
    } catch (e) {
      console.error('Failed to load block cipher implementations:', e.message);
    }
  }
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('OMAC requires Cipher system to be loaded first');
      return;
    }
  }
  
  // OMAC/CMAC Constants
  const OMAC_CONSTANTS = {
    AES_BLOCK_SIZE: 16,
    DES_BLOCK_SIZE: 8,
    MAX_MESSAGE_SIZE: Math.pow(2, 32) - 1
  };
  
  const OMAC = {
    internalName: 'omac',
    name: 'OMAC/CMAC',
    
    // Required Cipher interface properties
    minKeyLength: 8,         // DES minimum
    maxKeyLength: 32,        // AES-256 maximum 
    stepKeyLength: 8,        // 64-bit steps
    minBlockSize: 0,         // Variable length input
    maxBlockSize: 0,         // No maximum limit
    stepBlockSize: 1,        // Byte-wise processing
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'NIST SP 800-38B Implementation',
    description: 'One-Key Cipher-Based Message Authentication Code (OMAC1/CMAC)',
    reference: 'NIST SP 800-38B: https://csrc.nist.gov/publications/detail/sp/800-38b/final',
    
    // Security parameters
    supportedCiphers: ['AES', 'Rijndael', 'DES', '3DES'],
    
    /**
     * Initialize OMAC instance
     */
    Init: function() {
      const instance = {
        cipher: null,
        cipherName: '',
        cipherId: null,
        blockSize: 0,
        k1: null,               // First subkey
        k2: null,               // Second subkey
        key: null,
        intermediate: null,     // Intermediate MAC value
        messageBuffer: [],      // Buffered message data
        initialized: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Setup OMAC with encryption key and block cipher
     */
    KeySetup: function(instanceId, key, cipherName = 'Rijndael') {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid OMAC instance ID');
      }
      
      if (!key || key.length < 8) {
        throw new Error('OMAC key must be at least 64 bits');
      }
      
      // Validate cipher availability
      if (!global.Cipher.GetCipher(cipherName)) {
        throw new Error('Cipher ' + cipherName + ' not available');
      }
      
      instance.cipher = global.Cipher.GetCipher(cipherName);
      instance.cipherName = cipherName;
      instance.key = key.slice();
      
      // Determine block size
      if (cipherName === 'Rijndael' || cipherName === 'AES') {
        instance.blockSize = 16;
      } else if (cipherName === 'DES' || cipherName === '3DES') {
        instance.blockSize = 8;
      } else {
        // Try to determine from cipher properties
        instance.blockSize = instance.cipher.blockSize || 16;
      }
      
      // Initialize block cipher
      instance.cipherId = instance.cipher.Init();
      instance.cipher.KeySetup(instance.cipherId, key);
      
      // Generate subkeys K1 and K2
      this.generateSubkeys(instance);
      
      // Initialize state
      instance.intermediate = new Array(instance.blockSize).fill(0);
      instance.messageBuffer = [];
      instance.initialized = true;
      
      return true;
    },
    
    /**
     * Generate OMAC subkeys K1 and K2 from L = E_K(0^n)
     */
    generateSubkeys: function(instance) {
      // Step 1: L = E_K(0^n)
      const zeroBlock = new Array(instance.blockSize).fill(0);
      const L = instance.cipher.encryptBlock(instance.cipherId, zeroBlock);
      
      // Determine reduction polynomial based on block size
      let rb;
      if (instance.blockSize === 16) {
        rb = 0x87;  // AES: x^128 + x^7 + x^2 + x + 1
      } else if (instance.blockSize === 8) {
        rb = 0x1B;  // DES: x^64 + x^4 + x^3 + x + 1
      } else {
        throw new Error('Unsupported block size: ' + instance.blockSize);
      }
      
      // Step 2: K1 = L << 1 with conditional XOR
      instance.k1 = this.leftShiftBlock(L, rb);
      
      // Step 3: K2 = K1 << 1 with conditional XOR
      instance.k2 = this.leftShiftBlock(instance.k1, rb);
    },
    
    /**
     * Left shift block by 1 bit with conditional reduction
     */
    leftShiftBlock: function(block, reductionByte) {
      const result = new Array(block.length);
      let carry = 0;
      
      // Left shift bit by bit
      for (let i = block.length - 1; i >= 0; i--) {
        const newCarry = (block[i] & 0x80) ? 1 : 0;
        result[i] = ((block[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }
      
      // Apply reduction if MSB was set
      if (carry) {
        result[result.length - 1] ^= reductionByte;
      }
      
      return result;
    },
    
    /**
     * Update OMAC with message data
     */
    Update: function(instanceId, data) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('OMAC instance not properly initialized');
      }
      
      if (!Array.isArray(data)) {
        data = Array.from(data);
      }
      
      // Add data to message buffer
      instance.messageBuffer = instance.messageBuffer.concat(data);
      
      // Process complete blocks
      while (instance.messageBuffer.length >= instance.blockSize) {
        const block = instance.messageBuffer.splice(0, instance.blockSize);
        
        // XOR with previous intermediate value
        for (let i = 0; i < instance.blockSize; i++) {
          block[i] ^= instance.intermediate[i];
        }
        
        // Encrypt block
        instance.intermediate = instance.cipher.encryptBlock(instance.cipherId, block);
      }
      
      return true;
    },
    
    /**
     * Finalize OMAC and generate authentication tag
     */
    Finalize: function(instanceId) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('OMAC instance not properly initialized');
      }
      
      // Handle final block
      let finalBlock;
      
      if (instance.messageBuffer.length === instance.blockSize) {
        // Complete final block - use K1
        finalBlock = instance.messageBuffer.slice();
        for (let i = 0; i < instance.blockSize; i++) {
          finalBlock[i] ^= instance.k1[i];
        }
      } else {
        // Incomplete final block - pad and use K2
        finalBlock = instance.messageBuffer.slice();
        
        // Apply 10* padding
        finalBlock.push(0x80);
        while (finalBlock.length < instance.blockSize) {
          finalBlock.push(0x00);
        }
        
        // XOR with K2
        for (let i = 0; i < instance.blockSize; i++) {
          finalBlock[i] ^= instance.k2[i];
        }
      }
      
      // XOR with intermediate value
      for (let i = 0; i < instance.blockSize; i++) {
        finalBlock[i] ^= instance.intermediate[i];
      }
      
      // Final encryption
      const tag = instance.cipher.encryptBlock(instance.cipherId, finalBlock);
      
      return tag;
    },
    
    /**
     * Compute OMAC in one call
     */
    MAC: function(key, message, cipherName = 'Rijndael') {
      const instanceId = this.Init();
      this.KeySetup(instanceId, key, cipherName);
      this.Update(instanceId, message);
      const tag = this.Finalize(instanceId);
      this.ClearData(instanceId);
      return tag;
    },
    
    /**
     * Verify OMAC authentication tag
     */
    Verify: function(key, message, expectedTag, cipherName = 'Rijndael') {
      const computedTag = this.MAC(key, message, cipherName);
      
      if (!expectedTag || expectedTag.length !== computedTag.length) {
        return false;
      }
      
      // Constant-time comparison
      let result = 0;
      for (let i = 0; i < computedTag.length; i++) {
        result |= computedTag[i] ^ expectedTag[i];
      }
      
      return result === 0;
    },
    
    /**
     * Clear sensitive instance data
     */
    ClearData: function(instanceId) {
      const instance = this.instances[instanceId];
      if (instance) {
        // Clear cipher instance
        if (instance.cipherId && instance.cipher) {
          instance.cipher.ClearData(instance.cipherId);
        }
        
        // Clear sensitive data
        if (instance.key) instance.key.fill(0);
        if (instance.k1) instance.k1.fill(0);
        if (instance.k2) instance.k2.fill(0);
        if (instance.intermediate) instance.intermediate.fill(0);
        instance.messageBuffer.fill(0);
        instance.initialized = false;
        
        // Remove instance
        delete this.instances[instanceId];
      }
      return true;
    },
    
    /**
     * Get algorithm information
     */
    GetInfo: function() {
      return {
        name: this.name,
        type: 'MAC',
        description: 'One-Key Cipher-Based Message Authentication Code',
        standard: 'NIST SP 800-38B',
        keyLength: 'Depends on block cipher (AES: 128/192/256 bits)',
        tagLength: 'Same as block cipher block size',
        security: 'Provably secure based on block cipher security',
        performance: 'Efficient single-key MAC construction'
      };
    }
  };
  
  // Test vectors from NIST SP 800-38B
  OMAC.testVectors = [
    {
      algorithm: 'OMAC/CMAC',
      testId: 'omac-nist-001',
      description: 'NIST SP 800-38B Example 1 - AES-128 CMAC',
      category: 'official',
      
      keyHex: '2B7E151628AED2A6ABF7158809CF4F3C',
      messageHex: '',
      expectedTagHex: 'BB1D6929E95937287FA37D129B756746',
      cipher: 'AES',
      
      source: {
        type: 'nist',
        identifier: 'NIST SP 800-38B',
        title: 'Recommendation for Block Cipher Modes of Operation: The CMAC Mode for Authentication',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-38b/final',
        organization: 'NIST',
        section: 'Appendix D - Example Computations',
        datePublished: '2005-05-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'OMAC/CMAC',
      testId: 'omac-nist-002',
      description: 'NIST SP 800-38B Example 2 - AES-128 CMAC with 16-byte message',
      category: 'official',
      
      keyHex: '2B7E151628AED2A6ABF7158809CF4F3C',
      messageHex: '6BC1BEE22E409F96E93D7E117393172A',
      expectedTagHex: '070A16B46B4D4144F79BDD9DD04A287C',
      cipher: 'AES',
      
      source: {
        type: 'nist',
        identifier: 'NIST SP 800-38B',
        title: 'Recommendation for Block Cipher Modes of Operation: The CMAC Mode for Authentication',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-38b/final',
        organization: 'NIST',
        section: 'Appendix D - Example Computations',
        datePublished: '2005-05-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'OMAC/CMAC',
      testId: 'omac-nist-003',
      description: 'NIST SP 800-38B Example 3 - AES-128 CMAC with 40-byte message',
      category: 'official',
      
      keyHex: '2B7E151628AED2A6ABF7158809CF4F3C',
      messageHex: '6BC1BEE22E409F96E93D7E117393172AAE2D8A571E03AC9C9EB76FAC45AF8E5130C81C46A35CE411',
      expectedTagHex: 'DFA66747DE9AE63030CA32611497C827',
      cipher: 'AES',
      
      source: {
        type: 'nist',
        identifier: 'NIST SP 800-38B',
        title: 'Recommendation for Block Cipher Modes of Operation: The CMAC Mode for Authentication',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-38b/final',
        organization: 'NIST',
        section: 'Appendix D - Example Computations',
        datePublished: '2005-05-01',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(OMAC);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OMAC;
  }
  
  // Export to global scope
  global.OMAC = OMAC;
  
})(typeof global !== 'undefined' ? global : window);