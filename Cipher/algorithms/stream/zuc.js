#!/usr/bin/env node
/*
 * ZUC Stream Cipher - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Based on 3GPP Confidentiality Algorithm 128-EEA3 & Integrity Algorithm 128-EIA3
 * Core component of LTE/4G mobile communications security
 * 
 * Educational implementation - not for production use
 * Use certified implementations for actual mobile systems
 * 
 * Features:
 * - 128-bit key and IV support
 * - 16-stage 31-bit LFSR
 * - Bit reorganization layer
 * - Nonlinear function with S-boxes
 * - 32-bit word-oriented keystream output
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (typeof global !== 'undefined' && !global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const ZUC = {
    internalName: 'zuc',
    name: 'ZUC Stream Cipher (3GPP LTE)',
    // Required Cipher interface properties
    minKeyLength: 16,        // Minimum key length in bytes
    maxKeyLength: 32,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Constants
    MASK31: 0x7FFFFFFF, // 2^31 - 1
    
    // S-boxes for the nonlinear function
    S0: OpCodes.Hex8ToBytes("3e725b47cae0003304d1549809b96dcb7b1bf932af9d6aa5b82dfc1d085303904d4e8499e4ced991ddb685488b296eaccdc1f81e734369c6b5bdfd396320d438767db2a7cfed57c5f32cbb142106559be3ef5e314f7f5aa40d8251495fba581c4a16d517a892241f8cffd8ae2e01d3ad3b4bda46ebc9de9a8f87d73a806f2fc8b1b437f70a2213287ccc3c89c7c3965607bf7ef00b2b975235417961a64c10febc2695888ab0a3fbc01894f2e1e5e95dd0dc1166645cec59427512f5749caa230e86abbe2a02e767e644a26cc2939ff1f6fa36d250689e6271153dd640c4e20f8e83776b25053f0c30ea70b7a1e8a9658d271adb81b3a0f4457a19dfee783460"),
    
    S1: OpCodes.Hex8ToBytes("55c263713bc847869f3cda5b29aafd778cc5940ca61a1300e3a8167240f9f8424426689681d9453e1076c6a78b3943e13ab5562ac06db3052266bfdc0bfa6248dd20110636c9c1cff62752bb69f5d4877f844cd29c57a4bc4f9adffed68d7aeb2b53d85ca11417fb23d57d3067730809eeb7703f61b2198e4ee54b938f5ddba9adf1ae2ecb0dfcf42d466e1d97e8d1e94d37a5755e839eab829db91ce0cd498901b6bd5824a25f387899159050b895e4d091c7ceed0fb46fa0ccf0024a79c3dea3efea51e66b18ec1b2c80f774e7ff215a6a541e41319235c433070aba7e0e3488b1987cf33d606c7bcad31f3265042864be859b2f598ad7b025acaf1203e2f2"),
    
    // D constants for LFSR operations
    D: [
      0x44D7, 0x26BC, 0x626B, 0x135E, 0x5789, 0x35E2, 0x7135, 0x09AF,
      0x4D78, 0x2F13, 0x6BC4, 0x1AF1, 0x5E26, 0x3C4D, 0x789A, 0x47AC
    ],
    
    // LFSR state (16 x 31-bit registers)
    LFSR: null,
    
    // Bit reorganization registers
    X: null,
    
    // Nonlinear function registers
    R1: 0,
    R2: 0,
    
    /**
     * Initialize ZUC with key and IV
     * @param {Array} key - 128-bit key (16 bytes)
     * @param {Array} iv - 128-bit initialization vector (16 bytes)
     */
    Init: function(key, iv) {
      // Initialize LFSR with key and IV
      this.LFSR = new Array(16);
      this.X = new Array(4);
      
      // Use default values if key/iv not provided
      if (!key) {
        key = new Array(16).fill(0);
      }
      if (!iv) {
        iv = new Array(16).fill(0);
      }
      
      // Load key and IV into LFSR
      for (let i = 0; i < 16; i++) {
        this.LFSR[i] = ((key[i] << 23) | (this.D[i] << 8) | iv[i]) & this.MASK31;
      }
      
      this.R1 = 0;
      this.R2 = 0;
      
      // Initialization phase (32 iterations without output)
      for (let i = 0; i < 32; i++) {
        this.BitReorganization();
        const W = this.NonlinearFunction();
        this.LFSRWithInitialization(W >>> 1);
      }
    },
    
    /**
     * LFSR step with initialization feedback
     */
    LFSRWithInitialization: function(u) {
      const f = this.LFSR[0];
      const v = this.MulByPow2(this.LFSR[0], 8);
      
      const s16 = ((this.MulByPow2(this.LFSR[15], 15) + 
                   this.MulByPow2(this.LFSR[13], 17) + 
                   this.MulByPow2(this.LFSR[10], 21) + 
                   this.MulByPow2(this.LFSR[4], 20) + 
                   v + u) % 0x7FFFFFFF) & this.MASK31;
      
      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = s16;
    },
    
    /**
     * LFSR step without initialization feedback (working mode)
     */
    LFSRWithoutInitialization: function() {
      const v = this.MulByPow2(this.LFSR[0], 8);
      
      const s16 = ((this.MulByPow2(this.LFSR[15], 15) + 
                   this.MulByPow2(this.LFSR[13], 17) + 
                   this.MulByPow2(this.LFSR[10], 21) + 
                   this.MulByPow2(this.LFSR[4], 20) + 
                   v) % 0x7FFFFFFF) & this.MASK31;
      
      // Shift LFSR
      for (let i = 0; i < 15; i++) {
        this.LFSR[i] = this.LFSR[i + 1];
      }
      this.LFSR[15] = s16;
    },
    
    /**
     * Multiplication by 2^k modulo (2^31 - 1)
     */
    MulByPow2: function(x, k) {
      return (((x << k) | (x >>> (31 - k))) & this.MASK31);
    },
    
    /**
     * Bit reorganization
     */
    BitReorganization: function() {
      this.X[0] = ((this.LFSR[15] & 0x7FFF8000) << 1) | (this.LFSR[14] & 0x0000FFFF);
      this.X[1] = ((this.LFSR[11] & 0x0000FFFF) << 16) | (this.LFSR[9] >>> 15);
      this.X[2] = ((this.LFSR[7] & 0x0000FFFF) << 16) | (this.LFSR[5] >>> 15);
      this.X[3] = ((this.LFSR[2] & 0x0000FFFF) << 16) | (this.LFSR[0] >>> 15);
    },
    
    /**
     * S-box lookup (32-bit word composed of 4 bytes)
     */
    Sbox: function(x) {
      return (this.S0[(x >>> 24) & 0xFF] << 24) |
             (this.S1[(x >>> 16) & 0xFF] << 16) |
             (this.S0[(x >>> 8) & 0xFF] << 8) |
             (this.S1[x & 0xFF]);
    },
    
    /**
     * Linear transformation L1
     */
    L1: function(x) {
      return x ^ OpCodes.RotL32(x, 2) ^ OpCodes.RotL32(x, 10) ^ OpCodes.RotL32(x, 18) ^ OpCodes.RotL32(x, 24);
    },
    
    /**
     * Linear transformation L2
     */
    L2: function(x) {
      return x ^ OpCodes.RotL32(x, 8) ^ OpCodes.RotL32(x, 14) ^ OpCodes.RotL32(x, 22) ^ OpCodes.RotL32(x, 30);
    },
    
    /**
     * Nonlinear function F
     */
    NonlinearFunction: function() {
      const W1 = (this.X[0] ^ this.R1) >>> 0;
      const W2 = (this.X[1] ^ this.R2) >>> 0;
      const u = this.L1((W1 << 16) | (W2 >>> 16));
      const v = this.L2((W2 << 16) | (W1 >>> 16));
      
      this.R1 = this.Sbox(this.L1((u + this.X[2]) >>> 0));
      this.R2 = this.Sbox(this.L2((v + this.X[3]) >>> 0));
      
      return (this.X[0] ^ this.R1) >>> 0;
    },
    
    /**
     * Generate keystream word
     */
    GenerateKeystream: function() {
      this.BitReorganization();
      const Z = this.NonlinearFunction();
      this.LFSRWithoutInitialization();
      return Z;
    },
    
    /**
     * Generate keystream of specified length
     * @param {number} length - Number of 32-bit words to generate
     * @returns {Array} Array of 32-bit keystream words
     */
    GenerateKeystreamWords: function(length) {
      const keystream = [];
      for (let i = 0; i < length; i++) {
        keystream.push(this.GenerateKeystream());
      }
      return keystream;
    },
    
    /**
     * Encrypt/Decrypt data using ZUC keystream
     * @param {Array} data - Input data bytes
     * @param {Array} key - 128-bit key
     * @param {Array} iv - 128-bit IV
     * @returns {Array} Encrypted/decrypted data
     */
    Process: function(data, key, iv) {
      // Initialize ZUC
      this.Init(key, iv);
      
      // Generate enough keystream
      const wordsNeeded = Math.ceil(data.length / 4);
      const keystream = this.GenerateKeystreamWords(wordsNeeded);
      
      // Convert keystream to bytes
      const keystreamBytes = [];
      for (let i = 0; i < keystream.length; i++) {
        const word = keystream[i];
        keystreamBytes.push((word >>> 24) & 0xFF);
        keystreamBytes.push((word >>> 16) & 0xFF);
        keystreamBytes.push((word >>> 8) & 0xFF);
        keystreamBytes.push(word & 0xFF);
      }
      
      // XOR with data
      const result = [];
      for (let i = 0; i < data.length; i++) {
        result.push(data[i] ^ keystreamBytes[i]);
      }
      
      return result;
    },
    
    /**
     * Test vectors for validation
     */
    TestVectors: [
      {
        key: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        iv: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        expected: [0x27BEDE74, 0x018082DA],
        description: "Test vector with all zeros"
      },
      {
        key: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
        iv: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
        expected: [0x0657CFA0, 0x7096398B],
        description: "Test vector with all ones"
      }
    ],
    
    // Generate keystream for encryption/decryption
    GenerateKeystream: function(length) {
      const keystream = [];
      const wordsNeeded = Math.ceil(length / 4);
      
      for (let i = 0; i < wordsNeeded; i++) {
        this.BitReorganization();
        const Z = this.NonlinearFunction();
        this.LFSRWithWorkMode();
        keystream.push(Z);
      }
      
      return keystream;
    },
    
    // Required Cipher interface methods
    KeySetup: function(key, options) {
      // Convert string key to byte array
      let keyBytes, ivBytes;
      
      if (typeof key === 'string') {
        if (key.length === 32) {
          // Hex key
          keyBytes = global.OpCodes ? global.OpCodes.HexToBytes(key) : [];
        } else {
          // String key - pad or truncate to 16 bytes
          keyBytes = [];
          for (let i = 0; i < 16; i++) {
            keyBytes[i] = i < key.length ? key.charCodeAt(i) : 0;
          }
        }
      } else {
        keyBytes = key || new Array(16).fill(0);
      }
      
      // Generate IV from options or use default
      if (options && options.iv) {
        ivBytes = options.iv;
      } else {
        ivBytes = new Array(16).fill(0);
      }
      
      // Initialize with key and IV
      this.Init(keyBytes, ivBytes);
      
      // Return instance ID
      return 'zuc-instance-' + Math.random().toString(36).substr(2, 9);
    },
    
    encryptBlock: function(id, plaintext) {
      // ZUC is a stream cipher - process the data
      const data = global.OpCodes ? global.OpCodes.AsciiToBytes(plaintext) : [];
      const keystream = this.GenerateKeystream(data.length);
      const result = [];
      
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ ((keystream[Math.floor(i/4)] >>> ((3 - (i % 4)) * 8)) & 0xFF);
      }
      
      return global.OpCodes ? global.OpCodes.BytesToString(result) : '';
    },
    
    decryptBlock: function(id, ciphertext) {
      // XOR operation is symmetric for stream ciphers
      return this.encryptBlock(id, ciphertext);
    },
    
    ClearData: function(id) {
      // Clear sensitive data
      if (this.LFSR) {
        this.LFSR.fill(0);
      }
      this.R1 = 0;
      this.R2 = 0;
      return true;
    },
    
    // Add uppercase aliases for test compatibility
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    }
  };
  
  // Auto-register with Cipher system if available
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(ZUC);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ZUC);
  }
  
  // Legacy registration for compatibility
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    const ZUCCipher = {
      internalName: ZUC.internalName,
      name: ZUC.name,
      minKeyLength: ZUC.minKeyLength,
      maxKeyLength: ZUC.maxKeyLength,
      stepKeyLength: ZUC.stepKeyLength,
      minBlockSize: ZUC.minBlockSize,
      maxBlockSize: ZUC.maxBlockSize,
      stepBlockSize: ZUC.stepBlockSize,
      instances: {},
      
      // Store current key and IV
      currentKey: null,
      currentIV: null,
      
      Init: function() {
        // Initialize with default key and IV
        this.currentKey = new Array(16).fill(0);
        this.currentIV = new Array(16).fill(0);
        return 0;
      },
      
      // Set key (expects 32 hex chars = 16 bytes)
      KeySetup: function(nKeyIndex, key) {
        try {
          if (key.length !== 32) {
            return "Key must be 32 hex characters (128 bits)";
          }
          this.currentKey = global.OpCodes.HexToBytes(key);
          return "Key set successfully";
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      // Encrypt/Decrypt using ZUC stream cipher
      encryptBlock: function(nKeyIndex, plaintext) {
        try {
          // Use first 32 chars as IV if longer than 32 chars
          let iv = this.currentIV;
          let plaintextData = plaintext;
          
          if (plaintextData.length > 32) {
            iv = global.OpCodes.HexToBytes(plaintextData.substring(0, 32));
            plaintextData = plaintextData.substring(32);
          }
          
          const data = global.OpCodes.HexToBytes(plaintextData);
          const result = ZUC.Process(data, this.currentKey, iv);
          return global.OpCodes.BytesToHex(result);
        } catch (e) {
          return "Error: " + e.message;
        }
      },
      
      decryptBlock: function(nKeyIndex, ciphertext) {
        // Stream cipher - decryption is the same as encryption
        return this.encryptBlock(nKeyIndex, ciphertext);
      },
      
      ClearData: function() {
        if (this.currentKey) {
          global.OpCodes.ClearArray(this.currentKey);
        }
        if (this.currentIV) {
          global.OpCodes.ClearArray(this.currentIV);
        }
        if (ZUC.LFSR) {
          global.OpCodes.ClearArray(ZUC.LFSR);
        }
        if (ZUC.X) {
          global.OpCodes.ClearArray(ZUC.X);
        }
        ZUC.R1 = 0;
        ZUC.R2 = 0;
      }
    };
    
    // Removed duplicate registration to prevent conflicts
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZUC;
  }
  
  // Export to global scope
  global.ZUC = ZUC;
  
})(typeof global !== 'undefined' ? global : window);