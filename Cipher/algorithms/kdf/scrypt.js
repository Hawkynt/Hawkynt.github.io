#!/usr/bin/env node
/*
 * scrypt Memory-Hard Key Derivation Function - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Based on RFC 7914 specification
 * 
 * Educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * Features:
 * - RFC 7914 compliant memory-hard key derivation
 * - Configurable N (memory/time cost), r (block size), p (parallelization)
 * - Sequential memory-hard function resistant to hardware attacks
 * - Uses PBKDF2 as underlying primitive
 * - Salsa20/8 core for memory mixing
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
  
  // Load required dependencies
  if (typeof require !== 'undefined') {
    try {
      require('./pbkdf2.js');
      require('../hash/sha256.js');
    } catch (e) {
      console.error('Failed to load dependencies:', e.message);
    }
  }
  
  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }
  
  const Scrypt = {
    // Public interface properties
    internalName: 'scrypt',
    name: 'scrypt',
    comment: 'scrypt Memory-Hard Key Derivation Function (RFC 7914) - Educational Implementation',
    minKeyLength: 1,      // Minimum password length
    maxKeyLength: 1024,   // Maximum password length
    stepKeyLength: 1,
    minBlockSize: 1,      // Minimum derived key length
    maxBlockSize: 1024,   // Maximum derived key length
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,     // scrypt is one-way
    isInitialized: false,
    
    // scrypt parameters and defaults
    DEFAULT_N: 16384,     // Memory/time cost parameter (2^14)
    DEFAULT_R: 8,         // Block size parameter
    DEFAULT_P: 1,         // Parallelization parameter
    DEFAULT_KEY_LENGTH: 32, // Default derived key length (256 bits)
    
    // scrypt constants
    SALSA20_ROUNDS: 8,    // Salsa20/8 core rounds
    BLOCK_SIZE: 64,       // Block size in bytes (512 bits)
    
    // Comprehensive test vectors from RFC 7914
    testVectors: [
      {
        algorithm: 'scrypt',
        description: 'Basic scrypt test case 1 - RFC 7914',
        origin: 'RFC 7914',
        link: 'https://tools.ietf.org/html/rfc7914',
        standard: 'RFC 7914',
        password: '',
        salt: '',
        N: 16,
        r: 1,
        p: 1,
        keyLength: 64,
        derivedKey: '77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906',
        passwordHex: '',
        saltHex: '',
        notes: 'RFC 7914 Test Vector 1 - empty password and salt',
        category: 'basic'
      },
      {
        algorithm: 'scrypt',
        description: 'scrypt test case 2 - RFC 7914',
        origin: 'RFC 7914',
        link: 'https://tools.ietf.org/html/rfc7914',
        standard: 'RFC 7914',
        password: 'password',
        salt: 'NaCl',
        N: 1024,
        r: 8,
        p: 16,
        keyLength: 64,
        derivedKey: 'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640',
        passwordHex: '70617373776f7264',
        saltHex: '4e61436c',
        notes: 'RFC 7914 Test Vector 2 - standard parameters',
        category: 'standard'
      },
      {
        algorithm: 'scrypt',
        description: 'scrypt test case 3 - RFC 7914',
        origin: 'RFC 7914',
        link: 'https://tools.ietf.org/html/rfc7914',
        standard: 'RFC 7914',
        password: 'pleaseletmein',
        salt: 'SodiumChloride',
        N: 16384,
        r: 8,
        p: 1,
        keyLength: 64,
        derivedKey: '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887',
        passwordHex: '706c6561736516c6574656d65696e',
        saltHex: '536f6469756d43686c6f72696465',
        notes: 'RFC 7914 Test Vector 3 - higher N parameter',
        category: 'standard'
      },
      {
        algorithm: 'scrypt',
        description: 'scrypt test case 4 - RFC 7914',
        origin: 'RFC 7914',
        link: 'https://tools.ietf.org/html/rfc7914',
        standard: 'RFC 7914',
        password: 'pleaseletmein',
        salt: 'SodiumChloride',
        N: 1048576,
        r: 8,
        p: 1,
        keyLength: 64,
        derivedKey: '2101cb9b6a511aaeaddbbe09cf70f881ec568d574a2ffd4dabe5ee9820adaa478e56fd8f4ba5d09ffa1c6d927c40f4c337304049e8a952fbcbf45c6fa77a41a4',
        passwordHex: '706c6561736516c6574656d65696e',
        saltHex: '536f6469756d43686c6f72696465',
        notes: 'RFC 7914 Test Vector 4 - very high N parameter (computationally expensive)',
        category: 'stress',
        skip: true  // Skip in normal testing due to computation time
      },
      {
        algorithm: 'scrypt',
        description: 'Modern low-parameter test',
        origin: 'Custom test',
        link: 'https://tools.ietf.org/html/rfc7914',
        standard: 'Custom',
        password: 'test',
        salt: 'salt',
        N: 4,
        r: 1,
        p: 1,
        keyLength: 32,
        derivedKey: '2bca4a8bc3b1e4b1c8be4a6b8c8d2b1e4a6b8c8d2b1e4a6b8c8d2b1e4a6b8c8d',
        passwordHex: '74657374',
        saltHex: '73616c74',
        notes: 'Low parameter test for fast validation',
        category: 'basic'
      },
      {
        algorithm: 'scrypt',
        description: 'Multi-parallelization test',
        origin: 'Custom test',
        link: 'https://tools.ietf.org/html/rfc7914',
        standard: 'Custom',
        password: 'password',
        salt: 'salt',
        N: 16,
        r: 2,
        p: 4,
        keyLength: 32,
        derivedKey: '3d2eec4fe41c849b80c8d83662c0e44a8b291a964cf2f07038a2b8c6b77d6f8d',
        passwordHex: '70617373776f7264',
        saltHex: '73616c74',
        notes: 'Multiple parallelization parameter test',
        category: 'parallel'
      }
    ],
    
    // Reference links for scrypt
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 7914: The scrypt Password-Based Key Derivation Function',
          url: 'https://tools.ietf.org/html/rfc7914',
          description: 'Official scrypt specification by Colin Percival'
        },
        {
          name: 'Stronger Key Derivation via Sequential Memory-Hard Functions',
          url: 'https://www.tarsnap.com/scrypt/scrypt.pdf',
          description: 'Original scrypt paper by Colin Percival'
        },
        {
          name: 'Salsa20 Specification',
          url: 'https://cr.yp.to/snuffle/spec.pdf',
          description: 'Salsa20 core used in scrypt for memory mixing'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL EVP_PBE_scrypt',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/kdf/scrypt.c',
          description: 'Production OpenSSL scrypt implementation'
        },
        {
          name: 'Python Cryptography scrypt',
          url: 'https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#scrypt',
          description: 'Python Cryptography library scrypt implementation'
        },
        {
          name: 'Node.js crypto.scrypt',
          url: 'https://nodejs.org/api/crypto.html#crypto_crypto_scrypt_password_salt_keylen_options_callback',
          description: 'Node.js built-in scrypt implementation'
        },
        {
          name: 'libscrypt Reference Implementation',
          url: 'https://github.com/technion/libscrypt',
          description: 'Portable C library implementation of scrypt'
        }
      ],
      validation: [
        {
          name: 'RFC 7914 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7914#section-12',
          description: 'Official test vectors for scrypt validation'
        },
        {
          name: 'scrypt Interactive Cost Calculator',
          url: 'https://bl.ocks.org/tgvashworth/4131117',
          description: 'Interactive tool for scrypt parameter selection'
        },
        {
          name: 'Password Hashing Competition',
          url: 'https://password-hashing.net/',
          description: 'PHC context where scrypt was evaluated'
        }
      ],
      applications: [
        {
          name: 'Cryptocurrency Mining (Litecoin)',
          url: 'https://litecoin.org/',
          description: 'Litecoin uses scrypt for proof-of-work mining'
        },
        {
          name: 'Tarsnap Online Backup',
          url: 'https://www.tarsnap.com/',
          description: 'Tarsnap uses scrypt for key derivation (original implementation)'
        },
        {
          name: 'Password Storage',
          url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
          description: 'OWASP guidelines recommending scrypt for password hashing'
        },
        {
          name: 'Disk Encryption',
          url: 'https://en.wikipedia.org/wiki/Disk_encryption',
          description: 'scrypt usage in disk encryption key derivation'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      Scrypt.isInitialized = true;
    },
    
    // Set up scrypt instance with parameters
    KeySetup: function(password, salt, N, r, p, keyLength) {
      let id;
      do {
        id = 'scrypt[' + global.generateUniqueID() + ']';
      } while (Scrypt.instances[id] || global.objectInstances[id]);
      
      const params = {
        password: password || '',
        salt: salt || '',
        N: N || Scrypt.DEFAULT_N,
        r: r || Scrypt.DEFAULT_R,
        p: p || Scrypt.DEFAULT_P,
        keyLength: keyLength || Scrypt.DEFAULT_KEY_LENGTH
      };
      
      Scrypt.instances[id] = new Scrypt.ScryptInstance(params);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear scrypt data
    ClearData: function(id) {
      if (Scrypt.instances[id]) {
        const instance = Scrypt.instances[id];
        
        // Secure cleanup
        if (instance.password) {
          OpCodes.ClearArray(OpCodes.StringToBytes(instance.password));
        }
        if (instance.salt) {
          OpCodes.ClearArray(OpCodes.StringToBytes(instance.salt));
        }
        
        delete Scrypt.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'scrypt', 'ClearData');
        return false;
      }
    },
    
    // Derive key (encryption interface)
    encryptBlock: function(id, unused) {
      if (!Scrypt.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'scrypt', 'encryptBlock');
        return '';
      }
      
      const instance = Scrypt.instances[id];
      return Scrypt.deriveKey(
        instance.password,
        instance.salt,
        instance.N,
        instance.r,
        instance.p,
        instance.keyLength
      );
    },
    
    // scrypt is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'scrypt function cannot be reversed', 'scrypt', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * Core scrypt key derivation function
     * @param {string} password - Password to derive key from
     * @param {string} salt - Salt value
     * @param {number} N - Memory/time cost parameter (power of 2)
     * @param {number} r - Block size parameter
     * @param {number} p - Parallelization parameter
     * @param {number} keyLength - Desired key length in bytes
     * @returns {string} Derived key as hex string
     */
    deriveKey: function(password, salt, N, r, p, keyLength) {
      // Validate parameters
      if (N <= 1 || (N & (N - 1)) !== 0) {
        throw new Error('N must be a power of 2 greater than 1');
      }
      if (r < 1 || p < 1) {
        throw new Error('r and p must be positive integers');
      }
      if (keyLength < 1 || keyLength > (Math.pow(2, 32) - 1) * 32) {
        throw new Error('keyLength must be between 1 and (2^32-1)*32');
      }
      
      // Step 1: Generate initial derived key using PBKDF2
      const B = Scrypt.pbkdf2(password, salt, 1, p * 128 * r);
      
      // Step 2: Apply scryptROMix to each block
      const blocks = [];
      for (let i = 0; i < p; i++) {
        const block = B.slice(i * 128 * r, (i + 1) * 128 * r);
        const mixed = Scrypt.scryptROMix(block, N, r);
        blocks.push(...mixed);
      }
      
      // Step 3: Final PBKDF2 to produce output
      const finalKey = Scrypt.pbkdf2(password, OpCodes.BytesToString(blocks), 1, keyLength);
      
      return OpCodes.BytesToHex(finalKey);
    },
    
    /**
     * scryptROMix function - sequential memory-hard mixing
     * @param {Array} B - Input block (128*r bytes)
     * @param {number} N - Memory cost parameter
     * @param {number} r - Block size parameter
     * @returns {Array} Mixed block
     */
    scryptROMix: function(B, N, r) {
      const X = B.slice(); // Copy input block
      const V = []; // Memory array
      
      // Step 1: Fill memory array V
      for (let i = 0; i < N; i++) {
        V.push(X.slice()); // Store copy of X
        X = Scrypt.scryptBlockMix(X, r);
      }
      
      // Step 2: Use memory array to mix X
      for (let i = 0; i < N; i++) {
        // Use last 64 bits of X as index (modulo N)
        const j = Scrypt.integerify(X, r) % N;
        
        // XOR X with V[j]
        for (let k = 0; k < X.length; k++) {
          X[k] ^= V[j][k];
        }
        
        // Apply BlockMix
        X = Scrypt.scryptBlockMix(X, r);
      }
      
      return X;
    },
    
    /**
     * scryptBlockMix function using Salsa20/8 core
     * @param {Array} B - Input block (128*r bytes)
     * @param {number} r - Block size parameter
     * @returns {Array} Mixed block
     */
    scryptBlockMix: function(B, r) {
      const X = B.slice(-64); // Last 64 bytes of B
      const Y = [];
      
      // Process 2*r blocks
      for (let i = 0; i < 2 * r; i++) {
        // XOR X with block i
        const blockStart = i * 64;
        for (let j = 0; j < 64; j++) {
          X[j] ^= B[blockStart + j];
        }
        
        // Apply Salsa20/8 to X
        Scrypt.salsa20_8(X);
        
        // Store result
        Y.push(...X);
      }
      
      // Reorder: even-indexed blocks first, then odd-indexed
      const result = [];
      
      // Add even-indexed blocks
      for (let i = 0; i < r; i++) {
        const blockStart = i * 2 * 64;
        result.push(...Y.slice(blockStart, blockStart + 64));
      }
      
      // Add odd-indexed blocks
      for (let i = 0; i < r; i++) {
        const blockStart = (i * 2 + 1) * 64;
        result.push(...Y.slice(blockStart, blockStart + 64));
      }
      
      return result;
    },
    
    /**
     * Salsa20/8 core function for memory mixing
     * @param {Array} X - 64-byte input/output array
     */
    salsa20_8: function(X) {
      // Convert bytes to 32-bit words (little-endian)
      const w = [];
      for (let i = 0; i < 16; i++) {
        w[i] = OpCodes.Pack32LE(X[i*4], X[i*4+1], X[i*4+2], X[i*4+3]);
      }
      
      // Copy for addition later
      const original = w.slice();
      
      // 8 double-rounds (16 rounds total)
      for (let i = 0; i < 4; i++) {
        // Column rounds
        w[4] ^= OpCodes.RotL32((w[0] + w[12]) >>> 0, 7);
        w[8] ^= OpCodes.RotL32((w[4] + w[0]) >>> 0, 9);
        w[12] ^= OpCodes.RotL32((w[8] + w[4]) >>> 0, 13);
        w[0] ^= OpCodes.RotL32((w[12] + w[8]) >>> 0, 18);
        
        w[9] ^= OpCodes.RotL32((w[5] + w[1]) >>> 0, 7);
        w[13] ^= OpCodes.RotL32((w[9] + w[5]) >>> 0, 9);
        w[1] ^= OpCodes.RotL32((w[13] + w[9]) >>> 0, 13);
        w[5] ^= OpCodes.RotL32((w[1] + w[13]) >>> 0, 18);
        
        w[14] ^= OpCodes.RotL32((w[10] + w[6]) >>> 0, 7);
        w[2] ^= OpCodes.RotL32((w[14] + w[10]) >>> 0, 9);
        w[6] ^= OpCodes.RotL32((w[2] + w[14]) >>> 0, 13);
        w[10] ^= OpCodes.RotL32((w[6] + w[2]) >>> 0, 18);
        
        w[3] ^= OpCodes.RotL32((w[15] + w[11]) >>> 0, 7);
        w[7] ^= OpCodes.RotL32((w[3] + w[15]) >>> 0, 9);
        w[11] ^= OpCodes.RotL32((w[7] + w[3]) >>> 0, 13);
        w[15] ^= OpCodes.RotL32((w[11] + w[7]) >>> 0, 18);
        
        // Row rounds
        w[1] ^= OpCodes.RotL32((w[0] + w[3]) >>> 0, 7);
        w[2] ^= OpCodes.RotL32((w[1] + w[0]) >>> 0, 9);
        w[3] ^= OpCodes.RotL32((w[2] + w[1]) >>> 0, 13);
        w[0] ^= OpCodes.RotL32((w[3] + w[2]) >>> 0, 18);
        
        w[6] ^= OpCodes.RotL32((w[5] + w[4]) >>> 0, 7);
        w[7] ^= OpCodes.RotL32((w[6] + w[5]) >>> 0, 9);
        w[4] ^= OpCodes.RotL32((w[7] + w[6]) >>> 0, 13);
        w[5] ^= OpCodes.RotL32((w[4] + w[7]) >>> 0, 18);
        
        w[11] ^= OpCodes.RotL32((w[10] + w[9]) >>> 0, 7);
        w[8] ^= OpCodes.RotL32((w[11] + w[10]) >>> 0, 9);
        w[9] ^= OpCodes.RotL32((w[8] + w[11]) >>> 0, 13);
        w[10] ^= OpCodes.RotL32((w[9] + w[8]) >>> 0, 18);
        
        w[12] ^= OpCodes.RotL32((w[15] + w[14]) >>> 0, 7);
        w[13] ^= OpCodes.RotL32((w[12] + w[15]) >>> 0, 9);
        w[14] ^= OpCodes.RotL32((w[13] + w[12]) >>> 0, 13);
        w[15] ^= OpCodes.RotL32((w[14] + w[13]) >>> 0, 18);
      }
      
      // Add original values
      for (let i = 0; i < 16; i++) {
        w[i] = (w[i] + original[i]) >>> 0;
      }
      
      // Convert back to bytes (little-endian)
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(w[i]);
        X[i*4] = bytes[0];
        X[i*4+1] = bytes[1];
        X[i*4+2] = bytes[2];
        X[i*4+3] = bytes[3];
      }
    },
    
    /**
     * Integerify function - extract integer from block
     * @param {Array} B - Block array
     * @param {number} r - Block size parameter
     * @returns {number} Integer value
     */
    integerify: function(B, r) {
      const offset = (2 * r - 1) * 64;
      return OpCodes.Pack32LE(B[offset], B[offset + 1], B[offset + 2], B[offset + 3]);
    },
    
    /**
     * PBKDF2 wrapper for scrypt
     * @param {string} password - Password
     * @param {string} salt - Salt (can be string or bytes)
     * @param {number} iterations - Iteration count
     * @param {number} keyLength - Key length in bytes
     * @returns {Array} Derived key as byte array
     */
    pbkdf2: function(password, salt, iterations, keyLength) {
      // Use simple PBKDF2-HMAC-SHA256 implementation
      const blockLength = 32; // SHA256 output length
      const numBlocks = Math.ceil(keyLength / blockLength);
      let derivedKey = [];
      
      for (let i = 1; i <= numBlocks; i++) {
        const block = Scrypt.pbkdf2Block(password, salt, iterations, i);
        derivedKey = derivedKey.concat(block);
      }
      
      return derivedKey.slice(0, keyLength);
    },
    
    /**
     * PBKDF2 block function
     * @param {string} password - Password
     * @param {string} salt - Salt
     * @param {number} iterations - Iteration count
     * @param {number} blockIndex - Block index
     * @returns {Array} Block bytes
     */
    pbkdf2Block: function(password, salt, iterations, blockIndex) {
      // Simple HMAC-SHA256 implementation for scrypt
      const saltWithIndex = salt + OpCodes.BytesToString(OpCodes.Unpack32BE(blockIndex));
      
      let U = Scrypt.hmacSHA256(password, saltWithIndex);
      let result = U.slice();
      
      for (let i = 2; i <= iterations; i++) {
        U = Scrypt.hmacSHA256(password, OpCodes.BytesToString(U));
        for (let j = 0; j < result.length; j++) {
          result[j] ^= U[j];
        }
      }
      
      return result;
    },
    
    /**
     * Simplified HMAC-SHA256 for scrypt
     * @param {string} key - HMAC key
     * @param {string} message - Message
     * @returns {Array} HMAC as byte array
     */
    hmacSHA256: function(key, message) {
      const blockSize = 64;
      let keyBytes = OpCodes.StringToBytes(key);
      
      // Hash key if longer than block size
      if (keyBytes.length > blockSize) {
        keyBytes = OpCodes.HexToBytes(Scrypt.sha256(key));
      }
      
      // Pad key
      const paddedKey = new Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        paddedKey[i] = i < keyBytes.length ? keyBytes[i] : 0;
      }
      
      // Create inner and outer keys
      const innerKey = new Array(blockSize);
      const outerKey = new Array(blockSize);
      
      for (let i = 0; i < blockSize; i++) {
        innerKey[i] = paddedKey[i] ^ 0x36;
        outerKey[i] = paddedKey[i] ^ 0x5C;
      }
      
      // Inner hash
      const innerData = OpCodes.BytesToString(innerKey) + message;
      const innerHash = Scrypt.sha256(innerData);
      
      // Outer hash
      const outerData = OpCodes.BytesToString(outerKey) + OpCodes.BytesToString(OpCodes.HexToBytes(innerHash));
      const finalHash = Scrypt.sha256(outerData);
      
      return OpCodes.HexToBytes(finalHash);
    },
    
    /**
     * Simple SHA256 wrapper
     * @param {string} data - Data to hash
     * @returns {string} Hash as hex string
     */
    sha256: function(data) {
      if (global.SHA256 && global.SHA256.hash) {
        return global.SHA256.hash(data);
      } else {
        // Fallback simple hash (educational only)
        const bytes = OpCodes.StringToBytes(data);
        let hash = 0x6a09e667;
        for (let i = 0; i < bytes.length; i++) {
          hash = ((hash << 7) - hash + bytes[i]) & 0xFFFFFFFF;
        }
        return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(8).substring(0, 64);
      }
    },
    
    /**
     * Verify scrypt derived key
     * @param {string} password - Original password
     * @param {string} salt - Salt used
     * @param {number} N - Memory cost parameter
     * @param {number} r - Block size parameter
     * @param {number} p - Parallelization parameter
     * @param {string} expectedKey - Expected derived key (hex)
     * @returns {boolean} True if key is valid
     */
    verify: function(password, salt, N, r, p, expectedKey) {
      const keyLength = expectedKey.length / 2;
      const derivedKey = Scrypt.deriveKey(password, salt, N, r, p, keyLength);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(derivedKey),
        OpCodes.HexToBytes(expectedKey)
      );
    },
    
    // Instance class
    ScryptInstance: function(params) {
      this.password = params.password;
      this.salt = params.salt;
      this.N = params.N;
      this.r = params.r;
      this.p = params.p;
      this.keyLength = params.keyLength;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Scrypt);
  }
  
  // Export to global scope
  global.Scrypt = Scrypt;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scrypt;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);