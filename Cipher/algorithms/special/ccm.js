#!/usr/bin/env node
/*
 * CCM (Counter with CBC-MAC) Universal Implementation
 * Based on RFC 3610 and NIST SP 800-38C
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - DO NOT USE IN PRODUCTION
 * CCM provides authenticated encryption with associated data (AEAD)
 */

(function(global) {
  'use strict';
  
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
      console.error('CCM cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const CCM = {
    // Public interface properties
    internalName: 'CCM',
    name: 'CCM Authenticated Encryption',
    comment: 'Counter with CBC-MAC Mode - RFC 3610 AEAD combining CTR and CBC-MAC',
    minKeyLength: 16, // 128-bit AES
    maxKeyLength: 32, // 256-bit AES
    stepKeyLength: 8,
    minBlockSize: 16, // AES block size
    maxBlockSize: 1024, // Practical limit
    stepBlockSize: 16,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // CCM constants
    BLOCK_SIZE: 16, // AES block size
    
    // Test vectors from RFC 3610
    testVectors: [
      {
        input: '20212223',
        key: '404142434445464748494A4B4C4D4E4F',
        nonce: '10111213141516',
        aad: '0001020304050607',
        expected: '7162015B4DAC255D',
        description: 'RFC 3610 Test Vector 1 - 4 byte plaintext'
      },
      {
        input: '202122232425262728292A2B2C2D2E2F',
        key: '404142434445464748494A4B4C4D4E4F',
        nonce: '1011121314151617',
        aad: '000102030405060708090A0B0C0D0E0F',
        expected: 'D2A1F0E051EA5F62081A7792073D593D1FC64FBFACCD',
        description: 'RFC 3610 Test Vector 2 - 16 byte plaintext'
      }
    ],
    
    // Initialize CCM
    Init: function() {
      CCM.isInitialized = true;
    },
    
    // Set up key for CCM
    KeySetup: function(key) {
      let id;
      do {
        id = 'CCM[' + global.generateUniqueID() + ']';
      } while (CCM.instances[id] || global.objectInstances[id]);
      
      CCM.instances[szID] = new CCM.CCMInstance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear CCM data
    ClearData: function(id) {
      if (CCM.instances[id]) {
        delete CCM.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Encrypt and authenticate with CCM
    encryptBlock: function(intInstanceID, szInput, optional_szNonce, optional_szAAD) {
      const id = 'CCM[' + intInstanceID + ']';
      if (!CCM.instances[id]) return '';
      
      return CCM.instances[szID].encrypt(szInput, optional_szNonce || '1011121314151617', optional_szAAD || '');
    },
    
    // Decrypt and verify with CCM
    decryptBlock: function(intInstanceID, szInput, optional_szNonce, optional_szAAD) {
      const id = 'CCM[' + intInstanceID + ']';
      if (!CCM.instances[id]) return '';
      
      return CCM.instances[szID].decrypt(szInput, optional_szNonce || '1011121314151617', optional_szAAD || '');
    },
    
    // CCM Instance Class
    CCMInstance: function(key) {
      this.key = OpCodes.HexToBytes(key);
      this.keyLength = this.key.length;
      
      // Validate key length
      if (this.keyLength !== 16 && this.keyLength !== 24 && this.keyLength !== 32) {
        throw new Error('CCM: Invalid key length. Must be 128, 192, or 256 bits');
      }
      
      this.setupAES();
    },
    
    // Setup AES functions
    setupAES: function() {
      CCM.CCMInstance.prototype.setupAES = function() {
        this.rounds = this.keyLength === 16 ? 10 : (this.keyLength === 24 ? 12 : 14);
      };
      
      // Simplified AES encryption for educational purposes
      CCM.CCMInstance.prototype.aesEncrypt = function(plaintext, key) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = plaintext[i] ^ key[i % key.length];
          // Apply simple transformations
          result[i] = ((result[i] << 1) | (result[i] >> 7)) & 0xFF;
          result[i] ^= 0x63; // Simple constant
        }
        return result;
      };
      
      // XOR two blocks
      CCM.CCMInstance.prototype.xorBlocks = function(a, b) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = a[i] ^ b[i];
        }
        return result;
      };
      
      // Format the B0 block for CCM
      CCM.CCMInstance.prototype.formatB0 = function(nonce, aadLen, plaintextLen, tagLen) {
        const B0 = new Array(16).fill(0);
        
        // Flags byte
        let flags = 0;
        if (aadLen > 0) flags |= 0x40; // AAD present
        flags |= ((tagLen - 2) / 2) << 3; // M field (tag length)
        flags |= (15 - nonce.length - 1); // L field (length field size)
        B0[0] = flags;
        
        // Nonce
        for (let i = 0; i < nonce.length; i++) {
          B0[1 + i] = nonce[i];
        }
        
        // Length field (simplified for educational purposes)
        const lenBytes = 15 - nonce.length;
        for (let i = 0; i < lenBytes; i++) {
          B0[15 - i] = (plaintextLen >>> (i * 8)) & 0xFF;
        }
        
        return B0;
      };
      
      // Format AAD blocks for CCM
      CCM.CCMInstance.prototype.formatAAD = function(aad) {
        if (aad.length === 0) return [];
        
        const blocks = [];
        
        // AAD length encoding (simplified)
        const lenBlock = new Array(16).fill(0);
        lenBlock[0] = (aad.length >>> 8) & 0xFF;
        lenBlock[1] = aad.length & 0xFF;
        
        // Add AAD data to the block
        for (let i = 0; i < Math.min(aad.length, 14); i++) {
          lenBlock[2 + i] = aad[i];
        }
        blocks.push(lenBlock);
        
        // Add remaining AAD blocks if needed
        for (let i = 14; i < aad.length; i += 16) {
          const block = new Array(16).fill(0);
          for (let j = 0; j < 16 && i + j < aad.length; j++) {
            block[j] = aad[i + j];
          }
          blocks.push(block);
        }
        
        return blocks;
      };
      
      // Compute CBC-MAC for authentication
      CCM.CCMInstance.prototype.computeCBCMAC = function(nonce, aad, plaintext, tagLen) {
        const aadBytes = aad || [];
        const plaintextBytes = plaintext || [];
        
        // Format B0 block
        const B0 = this.formatB0(nonce, aadBytes.length, plaintextBytes.length, tagLen);
        
        // Initialize MAC with B0
        let mac = this.aesEncrypt(B0, this.key);
        
        // Process AAD blocks
        const aadBlocks = this.formatAAD(aadBytes);
        for (let i = 0; i < aadBlocks.length; i++) {
          mac = this.xorBlocks(mac, aadBlocks[i]);
          mac = this.aesEncrypt(mac, this.key);
        }
        
        // Process plaintext blocks
        for (let i = 0; i < plaintextBytes.length; i += 16) {
          const block = new Array(16).fill(0);
          for (let j = 0; j < 16 && i + j < plaintextBytes.length; j++) {
            block[j] = plaintextBytes[i + j];
          }
          
          mac = this.xorBlocks(mac, block);
          mac = this.aesEncrypt(mac, this.key);
        }
        
        return mac.slice(0, tagLen);
      };
      
      // Format counter block for CTR mode
      CCM.CCMInstance.prototype.formatCTR = function(nonce, counter) {
        const ctr = new Array(16).fill(0);
        
        // Flags byte for CTR (L field only)
        ctr[0] = 15 - nonce.length - 1;
        
        // Nonce
        for (let i = 0; i < nonce.length; i++) {
          ctr[1 + i] = nonce[i];
        }
        
        // Counter (simplified)
        const lenBytes = 15 - nonce.length;
        for (let i = 0; i < lenBytes; i++) {
          ctr[15 - i] = (counter >>> (i * 8)) & 0xFF;
        }
        
        return ctr;
      };
      
      // CCM Encrypt function
      CCM.CCMInstance.prototype.encrypt = function(plaintext, nonce, aad) {
        const plaintextBytes = plaintext ? OpCodes.HexToBytes(plaintext) : [];
        const nonceBytes = OpCodes.HexToBytes(nonce);
        const aadBytes = aad ? OpCodes.HexToBytes(aad) : [];
        
        // Validate nonce length (7-13 bytes for CCM)
        if (nonceBytes.length < 7 || nonceBytes.length > 13) {
          throw new Error('CCM: Nonce must be 7-13 bytes (14-26 hex characters)');
        }
        
        const tagLen = 8; // 64-bit tag for this implementation
        
        // Compute authentication tag using CBC-MAC
        const tag = this.computeCBCMAC(nonceBytes, aadBytes, plaintextBytes, tagLen);
        
        // Encrypt plaintext using CTR mode
        const ciphertext = [];
        
        // Encrypt the tag first (counter 0)
        const ctr0 = this.formatCTR(nonceBytes, 0);
        const encryptedCtr0 = this.aesEncrypt(ctr0, this.key);
        const encryptedTag = this.xorBlocks(tag.concat(new Array(16 - tag.length).fill(0)), encryptedCtr0).slice(0, tagLen);
        
        // Encrypt plaintext (starting from counter 1)
        for (let i = 0; i < plaintextBytes.length; i += 16) {
          const counter = Math.floor(i / 16) + 1;
          const ctr = this.formatCTR(nonceBytes, counter);
          const keystream = this.aesEncrypt(ctr, this.key);
          
          const blockSize = Math.min(16, plaintextBytes.length - i);
          for (let j = 0; j < blockSize; j++) {
            ciphertext.push(plaintextBytes[i + j] ^ keystream[j]);
          }
        }
        
        // Return ciphertext + tag
        return OpCodes.BytesToHex([...ciphertext, ...encryptedTag]);
      };
      
      // CCM Decrypt function
      CCM.CCMInstance.prototype.decrypt = function(ciphertext, nonce, aad) {
        const ciphertextBytes = OpCodes.HexToBytes(ciphertext);
        const tagLen = 8;
        
        if (ciphertextBytes.length < tagLen) {
          throw new Error('CCM: Ciphertext too short');
        }
        
        // Extract tag and actual ciphertext
        const encryptedTag = ciphertextBytes.slice(-tagLen);
        const actualCiphertext = ciphertextBytes.slice(0, -tagLen);
        
        const nonceBytes = OpCodes.HexToBytes(nonce);
        const aadBytes = aad ? OpCodes.HexToBytes(aad) : [];
        
        // Decrypt the tag
        const ctr0 = this.formatCTR(nonceBytes, 0);
        const encryptedCtr0 = this.aesEncrypt(ctr0, this.key);
        const decryptedTag = this.xorBlocks(encryptedTag.concat(new Array(16 - tagLen).fill(0)), encryptedCtr0).slice(0, tagLen);
        
        // Decrypt ciphertext using CTR mode
        const plaintext = [];
        for (let i = 0; i < actualCiphertext.length; i += 16) {
          const counter = Math.floor(i / 16) + 1;
          const ctr = this.formatCTR(nonceBytes, counter);
          const keystream = this.aesEncrypt(ctr, this.key);
          
          const blockSize = Math.min(16, actualCiphertext.length - i);
          for (let j = 0; j < blockSize; j++) {
            plaintext.push(actualCiphertext[i + j] ^ keystream[j]);
          }
        }
        
        // Verify authentication tag
        const expectedTag = this.computeCBCMAC(nonceBytes, aadBytes, plaintext, tagLen);
        
        // Constant-time tag comparison
        let tagMatch = true;
        for (let i = 0; i < tagLen; i++) {
          if (expectedTag[i] !== decryptedTag[i]) {
            tagMatch = false;
          }
        }
        
        if (!tagMatch) {
          throw new Error('CCM: Authentication tag verification failed');
        }
        
        return OpCodes.BytesToHex(plaintext);
      };
    }
  };
  
  // Initialize the prototype functions
  CCM.setupAES();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(CCM);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCM;
  }
  
})(typeof global !== 'undefined' ? global : window);