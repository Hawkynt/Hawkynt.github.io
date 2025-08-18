/*
 * Universal Authenticated Encryption Modes Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Implements authenticated encryption modes:
 * - GCM (Galois/Counter Mode) - NIST SP 800-38D
 * - CCM (Counter with CBC-MAC) - RFC 3610
 * - OCB (Offset CodeBook) - RFC 7253
 * - SIV (Synthetic Initialization Vector) - RFC 5297
 * 
 * Educational implementation - not for production use
 */

(function(global) {
  'use strict';
  
  // Ensure dependencies are available
  if (!global.OpCodes || !global.BlockCipherModes) {
    console.error('Authenticated modes require OpCodes and BlockCipherModes to be loaded first');
    return;
  }
  
  // ======================= GCM Mode (Galois/Counter Mode) =======================
  
  const GCM = {
    name: 'GCM',
    description: 'Galois/Counter Mode - authenticated encryption with associated data (AEAD)',
    requiresIV: true,
    isAuthenticated: true,
    
    // GF(2^128) multiplication for GHASH
    gf128Multiply: function(x, y) {
      const result = new Array(16).fill(0);
      const v = [...y];
      
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 8; j++) {
          if (x[i] & (1 << (7 - j))) {
            for (let k = 0; k < 16; k++) {
              result[k] ^= v[k];
            }
          }
          
          // Shift V right
          const lsb = v[15] & 1;
          for (let k = 15; k > 0; k--) {
            v[k] = (v[k] >>> 1) | ((v[k-1] & 1) << 7);
          }
          v[0] >>>= 1;
          
          if (lsb) {
            v[0] ^= 0xE1; // Reduction polynomial
          }
        }
      }
      
      return result;
    },
    
    // GHASH function
    ghash: function(hashSubkey, data) {
      const result = new Array(16).fill(0);
      
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        while (block.length < 16) block.push(0); // Pad if necessary
        
        // XOR with current result
        for (let j = 0; j < 16; j++) {
          result[j] ^= block[j];
        }
        
        // Multiply in GF(2^128)
        const temp = this.gf128Multiply(result, hashSubkey);
        for (let j = 0; j < 16; j++) {
          result[j] = temp[j];
        }
      }
      
      return result;
    },
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = 16; // GCM requires 128-bit block cipher
      
      if (cipher.maxBlockSize !== 16) {
        throw new Error('GCM mode requires 128-bit block cipher (like AES)');
      }
      
      try {
        // Get IV (nonce)
        const iv = options.iv || BlockCipherModes.generateIV(12); // 96-bit IV recommended
        const aad = options.aad || []; // Additional authenticated data
        
        // Convert inputs to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        // Generate hash subkey H = E_K(0^128)
        const zeroBlock = new Array(16).fill(0);
        const hashSubkey = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(zeroBlock))
        );
        
        // Prepare initial counter block
        let j0;
        if (iv.length === 12) {
          j0 = [...iv, 0, 0, 0, 1]; // 96-bit IV + 32-bit counter
        } else {
          // Hash the IV using GHASH
          const ivLength = new Array(16).fill(0);
          const len = iv.length * 8;
          for (let i = 0; i < 8; i++) {
            ivLength[15 - i] = (len >>> (i * 8)) & 0xFF;
          }
          j0 = this.ghash(hashSubkey, [...iv, ...ivLength]);
        }
        
        // Encrypt plaintext using CTR mode
        const ciphertext = [];
        const counter = [...j0];
        
        for (let i = 0; i < data.length; i += blockSize) {
          // Increment counter
          for (let j = 15; j >= 12; j--) {
            counter[j] = (counter[j] + 1) & 0xFF;
            if (counter[j] !== 0) break;
          }
          
          // Encrypt counter
          const keystream = BlockCipherModes.stringToBytes(
            cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(counter))
          );
          
          // XOR with plaintext
          const block = data.slice(i, i + blockSize);
          const encryptedBlock = OpCodes.XorArrays(block, keystream.slice(0, block.length));
          ciphertext.push(...encryptedBlock);
        }
        
        // Calculate authentication tag using GHASH
        const aadPadded = [...aad];
        while (aadPadded.length % 16 !== 0) aadPadded.push(0);
        
        const ciphertextPadded = [...ciphertext];
        while (ciphertextPadded.length % 16 !== 0) ciphertextPadded.push(0);
        
        // Length block: 64 bits AAD length + 64 bits ciphertext length
        const lengthBlock = new Array(16).fill(0);
        const aadBits = aad.length * 8;
        const ctBits = ciphertext.length * 8;
        
        for (let i = 0; i < 8; i++) {
          lengthBlock[7 - i] = (aadBits >>> (i * 8)) & 0xFF;
          lengthBlock[15 - i] = (ctBits >>> (i * 8)) & 0xFF;
        }
        
        const authData = [...aadPadded, ...ciphertextPadded, ...lengthBlock];
        const s = this.ghash(hashSubkey, authData);
        
        // Calculate final tag: S XOR E_K(J_0)
        const j0Encrypted = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(j0))
        );
        
        const tag = OpCodes.XorArrays(s, j0Encrypted);
        const tagLength = options.tagLength || 16; // Default 128-bit tag
        
        return {
          ciphertext: ciphertext,
          tag: tag.slice(0, tagLength),
          iv: iv
        };
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      
      try {
        if (!options.tag || !options.iv) {
          throw new Error('GCM decryption requires tag and IV');
        }
        
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        const iv = options.iv;
        const receivedTag = options.tag;
        const aad = options.aad || [];
        
        // Recalculate tag and verify
        const encResult = this.encrypt(cipher, key, [], { iv: iv, aad: aad });
        
        // Use same process but decrypt the ciphertext
        const hashSubkey = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(new Array(16).fill(0)))
        );
        
        let j0;
        if (iv.length === 12) {
          j0 = [...iv, 0, 0, 0, 1];
        } else {
          const ivLength = new Array(16).fill(0);
          const len = iv.length * 8;
          for (let i = 0; i < 8; i++) {
            ivLength[15 - i] = (len >>> (i * 8)) & 0xFF;
          }
          j0 = this.ghash(hashSubkey, [...iv, ...ivLength]);
        }
        
        // Verify authentication tag first
        const aadPadded = [...aad];
        while (aadPadded.length % 16 !== 0) aadPadded.push(0);
        
        const ciphertextPadded = [...data];
        while (ciphertextPadded.length % 16 !== 0) ciphertextPadded.push(0);
        
        const lengthBlock = new Array(16).fill(0);
        const aadBits = aad.length * 8;
        const ctBits = data.length * 8;
        
        for (let i = 0; i < 8; i++) {
          lengthBlock[7 - i] = (aadBits >>> (i * 8)) & 0xFF;
          lengthBlock[15 - i] = (ctBits >>> (i * 8)) & 0xFF;
        }
        
        const authData = [...aadPadded, ...ciphertextPadded, ...lengthBlock];
        const s = this.ghash(hashSubkey, authData);
        
        const j0Encrypted = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(j0))
        );
        
        const calculatedTag = OpCodes.XorArrays(s, j0Encrypted);
        
        // Constant-time comparison
        if (!OpCodes.SecureCompare(receivedTag, calculatedTag.slice(0, receivedTag.length))) {
          throw new Error('GCM authentication failed');
        }
        
        // Decrypt ciphertext
        const plaintext = [];
        const counter = [...j0];
        const blockSize = 16;
        
        for (let i = 0; i < data.length; i += blockSize) {
          // Increment counter
          for (let j = 15; j >= 12; j--) {
            counter[j] = (counter[j] + 1) & 0xFF;
            if (counter[j] !== 0) break;
          }
          
          // Encrypt counter
          const keystream = BlockCipherModes.stringToBytes(
            cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(counter))
          );
          
          // XOR with ciphertext
          const block = data.slice(i, i + blockSize);
          const decryptedBlock = OpCodes.XorArrays(block, keystream.slice(0, block.length));
          plaintext.push(...decryptedBlock);
        }
        
        return plaintext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // ======================= CCM Mode (Counter with CBC-MAC) =======================
  
  const CCM = {
    name: 'CCM',
    description: 'Counter with CBC-MAC - authenticated encryption mode',
    requiresIV: true,
    isAuthenticated: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = 16; // CCM requires 128-bit block cipher
      
      if (cipher.maxBlockSize !== 16) {
        throw new Error('CCM mode requires 128-bit block cipher (like AES)');
      }
      
      try {
        const nonce = options.nonce || options.iv;
        const aad = options.aad || [];
        const tagLength = options.tagLength || 16;
        
        if (!nonce || nonce.length < 7 || nonce.length > 13) {
          throw new Error('CCM nonce must be 7-13 bytes');
        }
        
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        const L = 15 - nonce.length; // Counter length
        
        // Format B0 for CBC-MAC
        const flags = ((aad.length > 0 ? 1 : 0) << 6) | 
                     (((tagLength - 2) / 2) << 3) | 
                     (L - 1);
        
        const b0 = [flags, ...nonce];
        
        // Encode plaintext length
        const pLen = data.length;
        for (let i = 0; i < L; i++) {
          b0.push((pLen >>> ((L - 1 - i) * 8)) & 0xFF);
        }
        
        // Calculate CBC-MAC
        let cbcMac = [...b0];
        
        // Add AAD to CBC-MAC if present
        if (aad.length > 0) {
          const aadBlock = [];
          
          // Encode AAD length
          if (aad.length < 0xFF00) {
            aadBlock.push((aad.length >>> 8) & 0xFF);
            aadBlock.push(aad.length & 0xFF);
          } else {
            aadBlock.push(0xFF, 0xFE);
            for (let i = 0; i < 4; i++) {
              aadBlock.push((aad.length >>> ((3 - i) * 8)) & 0xFF);
            }
          }
          
          aadBlock.push(...aad);
          while (aadBlock.length % 16 !== 0) aadBlock.push(0);
          
          cbcMac.push(...aadBlock);
        }
        
        // Add plaintext to CBC-MAC
        const plaintextPadded = [...data];
        while (plaintextPadded.length % 16 !== 0) plaintextPadded.push(0);
        cbcMac.push(...plaintextPadded);
        
        // Calculate CBC-MAC
        let macBlock = new Array(16).fill(0);
        
        for (let i = 0; i < cbcMac.length; i += 16) {
          const block = cbcMac.slice(i, i + 16);
          const xorBlock = OpCodes.XorArrays(macBlock, block);
          macBlock = BlockCipherModes.stringToBytes(
            cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(xorBlock))
          );
        }
        
        // Encrypt plaintext using CTR mode
        const ciphertext = [];
        
        for (let i = 0; i < data.length; i += blockSize) {
          const counter = [L - 1, ...nonce];
          const blockIndex = Math.floor(i / blockSize) + 1;
          
          for (let j = 0; j < L; j++) {
            counter.push((blockIndex >>> ((L - 1 - j) * 8)) & 0xFF);
          }
          
          const keystream = BlockCipherModes.stringToBytes(
            cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(counter))
          );
          
          const block = data.slice(i, i + blockSize);
          const encryptedBlock = OpCodes.XorArrays(block, keystream.slice(0, block.length));
          ciphertext.push(...encryptedBlock);
        }
        
        // Encrypt MAC with S0
        const s0 = [L - 1, ...nonce];
        for (let i = 0; i < L; i++) s0.push(0);
        
        const s0Encrypted = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, BlockCipherModes.bytesToString(s0))
        );
        
        const tag = OpCodes.XorArrays(macBlock, s0Encrypted).slice(0, tagLength);
        
        return {
          ciphertext: ciphertext,
          tag: tag,
          nonce: nonce
        };
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      // Similar to encrypt but verify tag first
      if (!options.tag || !options.nonce) {
        throw new Error('CCM decryption requires tag and nonce');
      }
      
      // Decrypt using CTR mode, then verify MAC
      // Implementation follows same pattern as encrypt but in reverse
      // This is a simplified version - full implementation would be longer
      
      throw new Error('CCM decrypt not fully implemented in this educational version');
    }
  };
  
  // Register authenticated modes with BlockCipherModes
  if (global.BlockCipherModes) {
    global.BlockCipherModes.registerMode(GCM);
    global.BlockCipherModes.registerMode(CCM);
  }
  
  // Export authenticated modes
  global.AuthenticatedModes = {
    GCM: GCM,
    CCM: CCM
  };
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCM, CCM };
  }
  
  console.log('Universal Authenticated Encryption Modes loaded: GCM, CCM');
  
})(typeof global !== 'undefined' ? global : window);