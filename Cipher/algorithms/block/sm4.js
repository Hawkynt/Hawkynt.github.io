/*
 * Universal SM4 Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * SM4 (ShangMi 4) - Chinese National Standard GB/T 32907-2016
 * (c)2006-2025 Hawkynt
 * 
 * Technical Specifications:
 * - Block Size: 128 bits (16 bytes)
 * - Key Size: 128 bits (16 bytes)
 * - Rounds: 32
 * - Structure: Unbalanced Feistel Network
 * - S-box: Single 8-bit substitution box
 * - Linear transformations: L and L' for encryption and key schedule
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
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
      console.error('SM4 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create SM4 cipher object
  const SM4 = {
    // Public interface properties
    internalName: 'sm4',
    name: 'SM4',
    comment: 'SM4 Chinese National Standard Block Cipher (GB/T 32907-2016)',
    minKeyLength: 16,
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 16,
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // SM4 S-box (single 8-bit substitution box)
    SBOX: [
      0xD6, 0x90, 0xE9, 0xFE, 0xCC, 0xE1, 0x3D, 0xB7, 0x16, 0xB6, 0x14, 0xC2, 0x28, 0xFB, 0x2C, 0x05,
      0x2B, 0x67, 0x9A, 0x76, 0x2A, 0xBE, 0x04, 0xC3, 0xAA, 0x44, 0x13, 0x26, 0x49, 0x86, 0x06, 0x99,
      0x9C, 0x42, 0x50, 0xF4, 0x91, 0xEF, 0x98, 0x7A, 0x33, 0x54, 0x0B, 0x43, 0xED, 0xCF, 0xAC, 0x62,
      0xE4, 0xB3, 0x1C, 0xA9, 0xC9, 0x08, 0xE8, 0x95, 0x80, 0xDF, 0x94, 0xFA, 0x75, 0x8F, 0x3F, 0xA6,
      0x47, 0x07, 0xA7, 0xFC, 0xF3, 0x73, 0x17, 0xBA, 0x83, 0x59, 0x3C, 0x19, 0xE6, 0x85, 0x4F, 0xA8,
      0x68, 0x6B, 0x81, 0xB2, 0x71, 0x64, 0xDA, 0x8B, 0xF8, 0xEB, 0x0F, 0x4B, 0x70, 0x56, 0x9D, 0x35,
      0x1E, 0x24, 0x0E, 0x5E, 0x63, 0x58, 0xD1, 0xA2, 0x25, 0x22, 0x7C, 0x3B, 0x01, 0x21, 0x78, 0x87,
      0xD4, 0x00, 0x46, 0x57, 0x9F, 0xD3, 0x27, 0x52, 0x4C, 0x36, 0x02, 0xE7, 0xA0, 0xC4, 0xC8, 0x9E,
      0xEA, 0xBF, 0x8A, 0xD2, 0x40, 0xC7, 0x38, 0xB5, 0xA3, 0xF7, 0xF2, 0xCE, 0xF9, 0x61, 0x15, 0xA1,
      0xE0, 0xAE, 0x5D, 0xA4, 0x9B, 0x34, 0x1A, 0x55, 0xAD, 0x93, 0x32, 0x30, 0xF5, 0x8C, 0xB1, 0xE3,
      0x1D, 0xF6, 0xE2, 0x2E, 0x82, 0x66, 0xCA, 0x60, 0xC0, 0x29, 0x23, 0xAB, 0x0D, 0x53, 0x4E, 0x6F,
      0xD5, 0xDB, 0x37, 0x45, 0xDE, 0xFD, 0x8E, 0x2F, 0x03, 0xFF, 0x6A, 0x72, 0x6D, 0x6C, 0x5B, 0x51,
      0x8D, 0x1B, 0xAF, 0x92, 0xBB, 0xDD, 0xBC, 0x7F, 0x11, 0xD9, 0x5C, 0x41, 0x1F, 0x10, 0x5A, 0xD8,
      0x0A, 0xC1, 0x31, 0x88, 0xA5, 0xCD, 0x7B, 0xBD, 0x2D, 0x74, 0xD0, 0x12, 0xB8, 0xE5, 0xB4, 0xB0,
      0x89, 0x69, 0x97, 0x4A, 0x0C, 0x96, 0x77, 0x7E, 0x65, 0xB9, 0xF1, 0x09, 0xC5, 0x6E, 0xC6, 0x84,
      0x18, 0xF0, 0x7D, 0xEC, 0x3A, 0xDC, 0x4D, 0x20, 0x79, 0xEE, 0x5F, 0x3E, 0xD7, 0xCB, 0x39, 0x48
    ],
    
    // System parameters FK (Family Key)
    FK: [0xA3B1BAC6, 0x56AA3350, 0x677D9197, 0xB27022DC],
    
    // System parameters CK (Constant Key) - generated constants
    CK: [],
    
    // Initialize cipher and generate CK values
    Init: function() {
      if (SM4.isInitialized) return;
      
      // Generate CK constants (32 values)
      for (let i = 0; i < 32; i++) {
        SM4.CK[i] = SM4.generateCK(i);
      }
      
      SM4.isInitialized = true;
    },
    
    /**
     * Generate CK constant for round i
     * CK_i = (4i + 0) * 2^24 + (4i + 1) * 2^16 + (4i + 2) * 2^8 + (4i + 3)
     */
    generateCK: function(i) {
      const c0 = (4 * i + 0) & 0xFF;
      const c1 = (4 * i + 1) & 0xFF;
      const c2 = (4 * i + 2) & 0xFF;
      const c3 = (4 * i + 3) & 0xFF;
      return OpCodes.Pack32BE(c0, c1, c2, c3);
    },
    
    /**
     * S-box substitution - apply S-box to each byte of 32-bit word
     * τ(A) = (S-box(a0), S-box(a1), S-box(a2), S-box(a3))
     */
    tau: function(word) {
      const bytes = OpCodes.Unpack32BE(word);
      return OpCodes.Pack32BE(
        SM4.SBOX[bytes[0]],
        SM4.SBOX[bytes[1]],
        SM4.SBOX[bytes[2]],
        SM4.SBOX[bytes[3]]
      );
    },
    
    /**
     * Linear transformation L for encryption
     * L(B) = B ⊕ (B <<< 2) ⊕ (B <<< 10) ⊕ (B <<< 18) ⊕ (B <<< 24)
     */
    linearTransformL: function(word) {
      return word ^ OpCodes.RotL32(word, 2) ^ OpCodes.RotL32(word, 10) ^ 
             OpCodes.RotL32(word, 18) ^ OpCodes.RotL32(word, 24);
    },
    
    /**
     * Linear transformation L' for key schedule
     * L'(B) = B ⊕ (B <<< 13) ⊕ (B <<< 23)
     */
    linearTransformL_Prime: function(word) {
      return word ^ OpCodes.RotL32(word, 13) ^ OpCodes.RotL32(word, 23);
    },
    
    /**
     * T transformation for encryption rounds
     * T(X) = L(τ(X))
     */
    T: function(word) {
      return SM4.linearTransformL(SM4.tau(word));
    },
    
    /**
     * T' transformation for key schedule
     * T'(X) = L'(τ(X))
     */
    T_Prime: function(word) {
      return SM4.linearTransformL_Prime(SM4.tau(word));
    },
    
    /**
     * Key expansion - generate 32 round keys from 128-bit master key
     */
    keyExpansion: function(masterKey) {
      const key = OpCodes.StringToWords32BE(masterKey);
      const roundKeys = [];
      
      // Initial key schedule with FK
      const K = [
        key[0] ^ SM4.FK[0],
        key[1] ^ SM4.FK[1],
        key[2] ^ SM4.FK[2],
        key[3] ^ SM4.FK[3]
      ];
      
      // Generate 32 round keys
      for (let i = 0; i < 32; i++) {
        const temp = K[(i + 1) % 4] ^ K[(i + 2) % 4] ^ K[(i + 3) % 4] ^ SM4.CK[i];
        const rk = K[i % 4] ^ SM4.T_Prime(temp);
        roundKeys[i] = rk;
        K[i % 4] = rk;
      }
      
      return roundKeys;
    },
    
    /**
     * SM4 round function
     * F(X0, X1, X2, X3, RK) = X0 ⊕ T(X1 ⊕ X2 ⊕ X3 ⊕ RK)
     */
    roundFunction: function(X, roundKey) {
      const temp = X[1] ^ X[2] ^ X[3] ^ roundKey;
      return [X[1], X[2], X[3], X[0] ^ SM4.T(temp)];
    },
    
    /**
     * SM4 block encryption
     */
    encryptBlock: function(plaintext, roundKeys) {
      let X = OpCodes.StringToWords32BE(plaintext);
      
      // 32 rounds of encryption
      for (let i = 0; i < 32; i++) {
        X = SM4.roundFunction(X, roundKeys[i]);
      }
      
      // Reverse order for final output
      const output = [X[3], X[2], X[1], X[0]];
      return OpCodes.Words32BEToString(output);
    },
    
    /**
     * SM4 block decryption (same as encryption with reversed round keys)
     */
    decryptBlock: function(ciphertext, roundKeys) {
      let X = OpCodes.StringToWords32BE(ciphertext);
      
      // 32 rounds of decryption (reverse order)
      for (let i = 31; i >= 0; i--) {
        X = SM4.roundFunction(X, roundKeys[i]);
      }
      
      // Reverse order for final output
      const output = [X[3], X[2], X[1], X[0]];
      return OpCodes.Words32BEToString(output);
    },
    
    // Set up key
    KeySetup: function(key) {
      if (!SM4.isInitialized) SM4.Init();
      
      let id;
      do {
        id = 'SM4[' + global.generateUniqueID() + ']';
      } while (SM4.instances[id] || global.objectInstances[id]);
      
      SM4.instances[szID] = new SM4.SM4Instance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (SM4.instances[id]) {
        // Clear sensitive data
        if (SM4.instances[id].roundKeys) {
          OpCodes.ClearArray(SM4.instances[id].roundKeys);
        }
        delete SM4.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'SM4', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!SM4.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SM4', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = SM4.instances[szID];
      if (szPlainText.length !== 16) {
        global.throwException('Block Size Exception', 'SM4 requires exactly 16 bytes', 'SM4', 'encryptBlock');
        return szPlainText;
      }
      
      return SM4.encryptBlock(szPlainText, instance.roundKeys);
    },
    
    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!SM4.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SM4', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = SM4.instances[szID];
      if (szCipherText.length !== 16) {
        global.throwException('Block Size Exception', 'SM4 requires exactly 16 bytes', 'SM4', 'decryptBlock');
        return szCipherText;
      }
      
      return SM4.decryptBlock(szCipherText, instance.roundKeys);
    },
    
    // Instance class
    SM4Instance: function(key) {
      if (!key || key.length !== 16) {
        throw new Error('SM4 requires exactly 16-byte key');
      }
      
      this.key = szKey;
      this.roundKeys = SM4.keyExpansion(key);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(SM4);
  }
  
  // Export to global scope
  global.SM4 = SM4;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SM4;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);