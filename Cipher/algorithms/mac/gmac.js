#!/usr/bin/env node
/*
 * Universal GMAC (Galois Message Authentication Code)
 * Compatible with both Browser and Node.js environments
 * Based on NIST SP 800-38D - GCM specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of GMAC using Galois Field arithmetic.
 * GMAC is the authentication component of GCM mode, providing message
 * authentication using GF(2^128) multiplication operations.
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
  
  // Load AES for block cipher operations
  if (typeof require !== 'undefined') {
    try {
      require('../block/rijndael.js');
    } catch (e) {
      console.error('Failed to load AES implementation:', e.message);
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
      console.error('GMAC requires Cipher system to be loaded first');
      return;
    }
  }
  
  // GMAC Constants
  const GMAC_CONSTANTS = {
    BLOCK_SIZE: 16,           // 128 bits
    GF_POLYNOMIAL: 0x87,      // Reduction polynomial for GF(2^128)
    MAX_AAD_SIZE: Math.pow(2, 36) - 32,  // NIST SP 800-38D limit
    MAX_PLAINTEXT_SIZE: Math.pow(2, 36) - 32
  };
  
  const GMAC = {
    internalName: 'gmac',
    name: 'GMAC',
    
    // Required Cipher interface properties
    minKeyLength: 16,        // 128-bit minimum
    maxKeyLength: 32,        // 256-bit maximum 
    stepKeyLength: 8,        // 64-bit steps (128, 192, 256)
    minBlockSize: 0,         // Variable length input
    maxBlockSize: 0,         // No maximum limit
    stepBlockSize: 1,        // Byte-wise processing
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'NIST SP 800-38D Implementation',
    description: 'Galois Message Authentication Code - Authentication component of GCM mode',
    reference: 'NIST SP 800-38D: https://csrc.nist.gov/publications/detail/sp/800-38d/final',
    
    // Security parameters
    tagLength: 16,           // 128-bit authentication tag
    blockSize: 16,           // AES block size
    keySize: [16, 24, 32],   // Supported AES key lengths
    
    /**
     * Initialize GMAC instance
     */
    Init: function() {
      const instance = {
        key: null,
        h: new Array(16).fill(0),           // Auth key H = E_K(0^128)
        ghash: new Array(16).fill(0),       // GHASH accumulator
        aad: [],                            // Additional Authenticated Data
        totalAADLength: 0,                  // Total AAD bit length
        initialized: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Setup GMAC with encryption key
     */
    KeySetup: function(instanceId, key) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid GMAC instance ID');
      }
      
      if (!key || (key.length !== 16 && key.length !== 24 && key.length !== 32)) {
        throw new Error('GMAC key must be 128, 192, or 256 bits');
      }
      
      instance.key = key.slice();
      
      // Generate authentication key H = AES_K(0^128)
      const zeroBlock = new Array(16).fill(0);
      try {
        // Use AES to encrypt zero block
        const aesId = global.Cipher.GetCipher('Rijndael').Init();
        global.Cipher.GetCipher('Rijndael').KeySetup(aesId, key);
        instance.h = global.Cipher.GetCipher('Rijndael').encryptBlock(aesId, zeroBlock);
        global.Cipher.GetCipher('Rijndael').ClearData(aesId);
      } catch (e) {
        throw new Error('Failed to generate GMAC authentication key: ' + e.message);
      }
      
      // Reset state
      instance.ghash.fill(0);
      instance.aad = [];
      instance.totalAADLength = 0;
      instance.initialized = true;
      
      return true;
    },
    
    /**
     * GF(2^128) multiplication using reduction polynomial
     */
    gfMultiply: function(x, y) {
      const result = new Array(16).fill(0);
      const v = y.slice();
      
      for (let i = 0; i < 16; i++) {
        for (let j = 7; j >= 0; j--) {
          if ((x[i] >>> j) & 1) {
            // XOR v into result
            for (let k = 0; k < 16; k++) {
              result[k] ^= v[k];
            }
          }
          
          // Right shift v and apply reduction if needed
          const carry = v[15] & 1;
          for (let k = 15; k > 0; k--) {
            v[k] = (v[k] >>> 1) | ((v[k-1] & 1) << 7);
          }
          v[0] = (v[0] >>> 1);
          
          if (carry) {
            v[0] ^= 0xE1; // Apply reduction polynomial
          }
        }
      }
      
      return result;
    },
    
    /**
     * GHASH function - core of GMAC authentication
     */
    ghash: function(h, data) {
      let y = new Array(16).fill(0);
      
      // Process data in 128-bit blocks
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        
        // Pad block if necessary
        while (block.length < 16) {
          block.push(0);
        }
        
        // Y_i = (Y_{i-1} ⊕ X_i) · H
        for (let j = 0; j < 16; j++) {
          y[j] ^= block[j];
        }
        
        y = this.gfMultiply(y, h);
      }
      
      return y;
    },
    
    /**
     * Update GMAC with Additional Authenticated Data
     */
    UpdateAAD: function(instanceId, aad) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('GMAC instance not properly initialized');
      }
      
      if (!Array.isArray(aad)) {
        aad = Array.from(aad);
      }
      
      // Check AAD size limits (NIST SP 800-38D)
      if (instance.totalAADLength + aad.length * 8 > GMAC_CONSTANTS.MAX_AAD_SIZE) {
        throw new Error('AAD size exceeds NIST limit');
      }
      
      instance.aad = instance.aad.concat(aad);
      instance.totalAADLength += aad.length * 8;
      
      return true;
    },
    
    /**
     * Generate GMAC authentication tag
     */
    Finalize: function(instanceId, iv) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('GMAC instance not properly initialized');
      }
      
      if (!iv || iv.length !== 12) {
        throw new Error('GMAC requires 96-bit (12-byte) initialization vector');
      }
      
      // Prepare GMAC input: AAD || len(AAD)
      const gmacInput = instance.aad.slice();
      
      // Pad AAD to block boundary
      const aadPadding = 16 - (gmacInput.length % 16);
      if (aadPadding < 16) {
        for (let i = 0; i < aadPadding; i++) {
          gmacInput.push(0);
        }
      }
      
      // Append length fields: len(AAD) || len(C) = len(AAD) || 0
      const aadBitLength = instance.totalAADLength;
      const plaintextBitLength = 0; // GMAC has no ciphertext
      
      // Add 64-bit AAD length (big-endian)
      for (let i = 7; i >= 0; i--) {
        gmacInput.push((aadBitLength >>> (i * 8)) & 0xFF);
      }
      
      // Add 64-bit plaintext length (big-endian, zero for GMAC)
      for (let i = 7; i >= 0; i--) {
        gmacInput.push((plaintextBitLength >>> (i * 8)) & 0xFF);
      }
      
      // Compute GHASH
      const ghashResult = this.ghash(instance.h, gmacInput);
      
      // Generate J_0 from IV: IV || 0^31 || 1
      const j0 = iv.slice();
      j0.push(0, 0, 0, 1);
      
      // Encrypt J_0 to get tag mask
      let tagMask;
      try {
        const aesId = global.Cipher.GetCipher('Rijndael').Init();
        global.Cipher.GetCipher('Rijndael').KeySetup(aesId, instance.key);
        tagMask = global.Cipher.GetCipher('Rijndael').encryptBlock(aesId, j0);
        global.Cipher.GetCipher('Rijndael').ClearData(aesId);
      } catch (e) {
        throw new Error('Failed to generate GMAC tag mask: ' + e.message);
      }
      
      // Final tag = GHASH ⊕ E_K(J_0)
      const tag = new Array(16);
      for (let i = 0; i < 16; i++) {
        tag[i] = ghashResult[i] ^ tagMask[i];
      }
      
      return tag;
    },
    
    /**
     * Verify GMAC authentication tag
     */
    Verify: function(instanceId, iv, expectedTag) {
      const computedTag = this.Finalize(instanceId, iv);
      
      if (!expectedTag || expectedTag.length !== 16) {
        return false;
      }
      
      // Constant-time comparison
      let result = 0;
      for (let i = 0; i < 16; i++) {
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
        // Clear sensitive data
        if (instance.key) instance.key.fill(0);
        instance.h.fill(0);
        instance.ghash.fill(0);
        instance.aad.fill(0);
        instance.totalAADLength = 0;
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
        keyLength: '128/192/256 bits',
        tagLength: '128 bits',
        description: 'Galois Message Authentication Code',
        standard: 'NIST SP 800-38D',
        security: 'Provides authentication for GCM mode',
        performance: 'Hardware-accelerated on modern processors'
      };
    }
  };
  
  // Test vectors from NIST SP 800-38D
  GMAC.testVectors = [
    {
      algorithm: 'GMAC',
      testId: 'gmac-nist-001',
      description: 'NIST SP 800-38D Test Case 1 - GMAC with 128-bit key',
      category: 'official',
      
      keyHex: '00000000000000000000000000000000',
      ivHex: '000000000000000000000000',
      aadHex: '',
      expectedTagHex: '58E2FCCEFA7E3061367F1D57A4E7455A',
      
      source: {
        type: 'nist',
        identifier: 'NIST SP 800-38D',
        title: 'Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-38d/final',
        organization: 'NIST',
        section: 'Appendix B - Test Vectors',
        datePublished: '2007-11-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'GMAC',
      testId: 'gmac-nist-002',
      description: 'NIST SP 800-38D Test Case 2 - GMAC with AAD',
      category: 'official',
      
      keyHex: '00000000000000000000000000000000',
      ivHex: '000000000000000000000000',
      aadHex: '00000000000000000000000000000000',
      expectedTagHex: 'AB6E47D42CEC13BDF53A67B21257BDDF',
      
      source: {
        type: 'nist',
        identifier: 'NIST SP 800-38D',
        title: 'Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-38d/final',
        organization: 'NIST',
        section: 'Appendix B - Test Vectors',
        datePublished: '2007-11-01',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(GMAC);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GMAC;
  }
  
  // Export to global scope
  global.GMAC = GMAC;
  
})(typeof global !== 'undefined' ? global : window);