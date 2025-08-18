#!/usr/bin/env node
/*
 * EAX (Encrypt-then-Authenticate-then-Translate) Universal Implementation
 * Based on the EAX mode paper by Bellare, Rogaway, and Wagner
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - DO NOT USE IN PRODUCTION
 * EAX provides authenticated encryption with associated data (AEAD)
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
      console.error('EAX cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const EAX = {
    // Public interface properties
    internalName: 'EAX',
    name: 'EAX Authenticated Encryption',
    comment: 'EAX Mode - Encrypt-then-Authenticate-then-Translate AEAD',
    minKeyLength: 16, // 128-bit AES
    maxKeyLength: 32, // 256-bit AES
    stepKeyLength: 8,
    minBlockSize: 16, // AES block size
    maxBlockSize: 1024, // Practical limit
    stepBlockSize: 16,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // EAX constants
    BLOCK_SIZE: 16, // AES block size
    TAG_LENGTH: 16, // Authentication tag length
    
    // Test vectors from EAX specification
    testVectors: [
      {
        input: '',
        key: '233952DEE4D5ED5F9B9C6D6FF80FF478',
        nonce: '62EC67F9C3A4A407FCB2A8C49031A8B3',
        aad: '6BFB914FD07EAE6B',
        expected: 'E037830E8389F27B025A2D6527E79D01',
        description: 'EAX Test Vector 1 - Empty plaintext with AAD'
      },
      {
        input: 'F7FB',
        key: '91945D3F4DCBEE0BF45EF52255F095A4',
        nonce: 'BECAF043B0A23D843194BA972C66DEBD',
        aad: 'FA3BFD4806EB53FA',
        expected: '19DD5C4C9331049D0BDAB0277408F67967E5',
        description: 'EAX Test Vector 2 - 2 byte plaintext'
      }
    ],
    
    // Initialize EAX
    Init: function() {
      EAX.isInitialized = true;
    },
    
    // Set up key for EAX
    KeySetup: function(key) {
      let id;
      do {
        id = 'EAX[' + global.generateUniqueID() + ']';
      } while (EAX.instances[id] || global.objectInstances[id]);
      
      EAX.instances[id] = new EAX.EAXInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear EAX data
    ClearData: function(id) {
      if (EAX.instances[id]) {
        delete EAX.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Encrypt and authenticate with EAX
    encryptBlock: function(intInstanceID, input, optional_nonce, optional_aad) {
      const id = 'EAX[' + intInstanceID + ']';
      if (!EAX.instances[id]) return '';
      
      return EAX.instances[id].encrypt(input, optional_nonce || '00000000000000000000000000000000', optional_aad || '');
    },
    
    // Decrypt and verify with EAX
    decryptBlock: function(intInstanceID, input, optional_nonce, optional_aad) {
      const id = 'EAX[' + intInstanceID + ']';
      if (!EAX.instances[id]) return '';
      
      return EAX.instances[id].decrypt(input, optional_nonce || '00000000000000000000000000000000', optional_aad || '');
    },
    
    // EAX Instance Class
    EAXInstance: function(key) {
      this.key = OpCodes.HexToBytes(key);
      this.keyLength = this.key.length;
      
      // Validate key length
      if (this.keyLength !== 16 && this.keyLength !== 24 && this.keyLength !== 32) {
        throw new Error('EAX: Invalid key length. Must be 128, 192, or 256 bits');
      }
      
      this.setupAES();
    },
    
    // Setup AES functions
    setupAES: function() {
      EAX.EAXInstance.prototype.setupAES = function() {
        this.rounds = this.keyLength === 16 ? 10 : (this.keyLength === 24 ? 12 : 14);
      };
      
      // Simplified AES encryption for educational purposes
      EAX.EAXInstance.prototype.aesEncrypt = function(plaintext, key) {
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
      EAX.EAXInstance.prototype.xorBlocks = function(a, b) {
        const result = new Array(Math.max(a.length, b.length));
        for (let i = 0; i < result.length; i++) {
          const aByte = i < a.length ? a[i] : 0;
          const bByte = i < b.length ? b[i] : 0;
          result[i] = aByte ^ bByte;
        }
        return result;
      };
      
      // OMAC (One-Key MAC) implementation
      EAX.EAXInstance.prototype.omac = function(data, prefix) {
        // Simplified OMAC for educational purposes
        // Real OMAC requires proper subkey generation and Galois field operations
        
        // Start with prefix byte
        let mac = new Array(16).fill(0);
        mac[15] = prefix;
        
        // Process data in blocks
        for (let i = 0; i < data.length; i += 16) {
          const block = new Array(16).fill(0);
          const remaining = Math.min(16, data.length - i);
          
          for (let j = 0; j < remaining; j++) {
            block[j] = data[i + j];
          }
          
          // If partial block, apply padding
          if (remaining < 16) {
            block[remaining] = 0x80; // 10* padding
          }
          
          // XOR with current MAC
          mac = this.xorBlocks(mac, block);
          
          // Encrypt
          mac = this.aesEncrypt(mac, this.key);
        }
        
        return mac;
      };
      
      // CTR mode encryption
      EAX.EAXInstance.prototype.ctrEncrypt = function(plaintext, nonce) {
        const ciphertext = [];
        const counter = nonce.slice(); // Copy nonce as initial counter
        
        for (let i = 0; i < plaintext.length; i += 16) {
          // Encrypt counter
          const keystream = this.aesEncrypt(counter, this.key);
          
          // XOR with plaintext
          const blockSize = Math.min(16, plaintext.length - i);
          for (let j = 0; j < blockSize; j++) {
            ciphertext.push(plaintext[i + j] ^ keystream[j]);
          }
          
          // Increment counter (simplified - just increment last byte)
          for (let k = 15; k >= 0; k--) {
            counter[k] = (counter[k] + 1) & 0xFF;
            if (counter[k] !== 0) break; // No carry needed
          }
        }
        
        return ciphertext;
      };
      
      // EAX Encrypt function
      EAX.EAXInstance.prototype.encrypt = function(plaintext, nonce, aad) {
        const plaintextBytes = plaintext ? OpCodes.HexToBytes(plaintext) : [];
        const nonceBytes = OpCodes.HexToBytes(nonce);
        const aadBytes = aad ? OpCodes.HexToBytes(aad) : [];
        
        // Validate nonce length
        if (nonceBytes.length !== 16) {
          throw new Error('EAX: Nonce must be 128 bits (32 hex characters)');
        }
        
        // Compute OMAC values
        const omacN = this.omac(nonceBytes, 0); // OMAC_0(N)
        const omacA = this.omac(aadBytes, 1);   // OMAC_1(A)
        
        // Encrypt plaintext using CTR mode with OMAC_0(N) as nonce
        const ciphertext = this.ctrEncrypt(plaintextBytes, omacN);
        
        // Compute OMAC_2(C)
        const omacC = this.omac(ciphertext, 2);
        
        // Compute authentication tag: OMAC_0(N) XOR OMAC_1(A) XOR OMAC_2(C)
        let tag = this.xorBlocks(omacN, omacA);
        tag = this.xorBlocks(tag, omacC);
        
        // Return ciphertext + tag
        return OpCodes.BytesToHex([...ciphertext, ...tag]);
      };
      
      // EAX Decrypt function
      EAX.EAXInstance.prototype.decrypt = function(ciphertext, nonce, aad) {
        const ciphertextBytes = OpCodes.HexToBytes(ciphertext);
        
        if (ciphertextBytes.length < 16) {
          throw new Error('EAX: Ciphertext too short');
        }
        
        // Extract tag and actual ciphertext
        const tagLength = 16;
        const tag = ciphertextBytes.slice(-tagLength);
        const actualCiphertext = ciphertextBytes.slice(0, -tagLength);
        
        const nonceBytes = OpCodes.HexToBytes(nonce);
        const aadBytes = aad ? OpCodes.HexToBytes(aad) : [];
        
        // Validate nonce length
        if (nonceBytes.length !== 16) {
          throw new Error('EAX: Nonce must be 128 bits (32 hex characters)');
        }
        
        // Compute OMAC values for verification
        const omacN = this.omac(nonceBytes, 0);
        const omacA = this.omac(aadBytes, 1);
        const omacC = this.omac(actualCiphertext, 2);
        
        // Compute expected tag
        let expectedTag = this.xorBlocks(omacN, omacA);
        expectedTag = this.xorBlocks(expectedTag, omacC);
        
        // Constant-time tag comparison
        let tagMatch = true;
        for (let i = 0; i < 16; i++) {
          if (expectedTag[i] !== tag[i]) {
            tagMatch = false;
          }
        }
        
        if (!tagMatch) {
          throw new Error('EAX: Authentication tag verification failed');
        }
        
        // Decrypt using CTR mode
        const plaintext = this.ctrEncrypt(actualCiphertext, omacN);
        
        return OpCodes.BytesToHex(plaintext);
      };
    }
  };
  
  // Initialize the prototype functions
  EAX.setupAES();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(EAX);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EAX;
  }
  
})(typeof global !== 'undefined' ? global : window);