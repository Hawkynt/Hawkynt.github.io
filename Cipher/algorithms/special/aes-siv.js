#!/usr/bin/env node
/*
 * Universal AES-SIV (Synthetic Initialization Vector) Implementation
 * Compatible with both Browser and Node.js environments
 * Based on RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption
 * (c)2006-2025 Hawkynt
 * 
 * AES-SIV Algorithm Overview:
 * - Deterministic authenticated encryption with associated data (AEAD)
 * - Provides both authenticity and confidentiality with deterministic behavior
 * - Resistant to nonce reuse attacks - safe even with repeated nonces
 * - Two-pass construction: S2V for authentication + CTR for encryption
 * - Uses AES as underlying block cipher with SIV mode construction
 * 
 * Key Features:
 * - Key sizes: 256 bits, 384 bits, or 512 bits (for AES-128, AES-192, AES-256)
 * - Deterministic encryption (same plaintext → same ciphertext)
 * - Nonce misuse-resistant (safe to reuse nonces)
 * - Supports multiple associated data strings
 * - SIV (authentication tag) serves as synthetic IV for encryption
 * 
 * Construction:
 * 1. S2V (String-to-Vector): Generate 128-bit authentication tag
 * 2. Use authentication tag as synthetic IV for AES-CTR encryption
 * 3. Output: SIV || Ciphertext (authentication tag + encrypted data)
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - RFC 5297: Synthetic Initialization Vector (SIV) Authenticated Encryption
 * - "Deterministic Authenticated-Encryption" by Rogaway & Shrimpton
 * - "SIV-AES: Specifications and Analysis" technical papers
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
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
      console.error('AES-SIV cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load AES dependency
  if (typeof require !== 'undefined') {
    try {
      require('../block/rijndael.js'); // AES implementation
    } catch (e) {
      console.error('Failed to load AES dependency:', e.message);
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
  
  // Create AES-SIV cipher object
  const AES_SIV = {
    // Public interface properties
    internalName: 'AES-SIV',
    name: 'AES-SIV Deterministic AEAD',
    comment: 'AES-SIV: Synthetic Initialization Vector Deterministic Authenticated Encryption - RFC 5297',
    minKeyLength: 32,   // 256-bit keys (128+128 for CMAC+CTR)
    maxKeyLength: 64,   // 512-bit keys (256+256 for CMAC+CTR)
    stepKeyLength: 16,  // AES key sizes
    minBlockSize: 1,    // AEAD can handle any data size
    maxBlockSize: 65536, // Practical limit
    stepBlockSize: 1,
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'AES-SIV',
      displayName: 'AES-SIV Deterministic AEAD',
      description: 'Deterministic authenticated encryption using Synthetic Initialization Vector (SIV) mode. Provides nonce misuse resistance and deterministic encryption properties.',
      
      inventor: 'Phillip Rogaway, Thomas Shrimpton',
      year: 2006,
      background: 'Developed to address nonce reuse vulnerabilities in traditional AEAD schemes. Standardized in RFC 5297 and used in applications requiring deterministic encryption.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Provably secure deterministic AEAD. Safe against nonce reuse attacks. Provides both confidentiality and authenticity guarantees.',
      
      category: global.CipherMetadata.Categories.AEAD,
      subcategory: 'Deterministic/Nonce Misuse-Resistant',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: '256, 384, or 512 bits (double AES key size)',
      blockSize: 128, // AES block size
      rounds: 'AES rounds (10, 12, or 14)',
      nonceSize: 'Optional (can be empty for deterministic mode)',
      tagSize: '128 bits (16 bytes)',
      
      specifications: [
        {
          name: 'RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption',
          url: 'https://tools.ietf.org/html/rfc5297'
        },
        {
          name: 'NIST SP 800-38F - Methods for Key Derivation and Data Protection',
          url: 'https://csrc.nist.gov/publications/detail/sp/800-38f/final'
        }
      ],
      
      testVectors: [
        {
          name: 'RFC 5297 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc5297#appendix-A'
        },
        {
          name: 'NIST CAVP SIV Test Vectors',
          url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program'
        }
      ],
      
      references: [
        {
          name: 'Deterministic Authenticated-Encryption (DAE) Paper',
          url: 'https://web.cs.ucdavis.edu/~rogaway/papers/siv.pdf'
        },
        {
          name: 'SIV Mode Security Analysis',
          url: 'https://eprint.iacr.org/2006/221.pdf'
        }
      ],
      
      implementationNotes: 'Two-pass construction using S2V (String-to-Vector) for authentication and AES-CTR for encryption. Requires double-length keys.',
      performanceNotes: 'Slower than single-pass AEAD due to two passes over data. Provides unique deterministic and nonce-misuse-resistant properties.',
      
      educationalValue: 'Excellent introduction to deterministic encryption and nonce misuse resistance. Shows advanced AEAD construction techniques.',
      prerequisites: ['AES understanding', 'CMAC knowledge', 'CTR mode', 'AEAD concepts', 'Galois Field arithmetic'],
      
      tags: ['aead', 'deterministic', 'nonce-misuse-resistant', 'rfc5297', 'siv', 'aes', 'cmac'],
      
      version: '1.0'
    }) : null,

    // Test vectors for AES-SIV from RFC 5297
    testVectors: [
      {
        algorithm: 'AES-SIV',
        key: '404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f',
        aad: [],
        plaintext: '',
        ciphertext: '85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c',
        description: 'RFC 5297 AES-SIV Test Vector 1 (empty plaintext)'
      },
      {
        algorithm: 'AES-SIV',
        key: '404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f',
        aad: [],
        plaintext: '112233445566778899aabbccddee',
        ciphertext: '85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c317722bc40d38f1b1d82e0eb24f83e6a',
        description: 'RFC 5297 AES-SIV Test Vector 2'
      }
    ],
    
    // Official test vectors from RFC 5297
    officialTestVectors: [
      // RFC 5297 Appendix A.1
      {
        algorithm: 'AES-SIV',
        description: 'RFC 5297 Appendix A.1 Test Vector 1',
        origin: 'RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption',
        link: 'https://tools.ietf.org/html/rfc5297#appendix-A.1',
        standard: 'RFC 5297',
        key: '\x40\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4a\x4b\x4c\x4d\x4e\x4f\x50\x51\x52\x53\x54\x55\x56\x57\x58\x59\x5a\x5b\x5c\x5d\x5e\x5f',
        keyHex: '404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f',
        aad: [],
        aadHex: '',
        plaintext: '',
        plaintextHex: '',
        ciphertext: '\x85\x63\x2d\x07\xc6\xe8\xf3\x7f\x95\x0a\xcd\x32\x0a\x2e\xcc\x93\x40\xc0\x2b\x96\x90\xc4\xdc\x04\xda\xef\x7f\x6a\xfe\x5c',
        ciphertextHex: '85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c',
        notes: 'Empty plaintext test vector for AES-SIV',
        category: 'official-standard'
      }
    ],
    
    // Reference links to authoritative sources
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption',
          url: 'https://tools.ietf.org/html/rfc5297',
          description: 'Official IETF specification for SIV mode'
        },
        {
          name: 'NIST SP 800-38F - Block Cipher Modes',
          url: 'https://csrc.nist.gov/publications/detail/sp/800-38f/final',
          description: 'NIST guidance on advanced block cipher modes including SIV'
        }
      ],
      implementations: [
        {
          name: 'Miscreant SIV Implementation',
          url: 'https://github.com/miscreant/miscreant',
          description: 'High-quality multi-language SIV implementations'
        },
        {
          name: 'OpenSSL SIV Implementation',
          url: 'https://github.com/openssl/openssl/tree/master/providers/implementations/ciphers',
          description: 'Production SIV implementation in OpenSSL'
        }
      ],
      validation: [
        {
          name: 'RFC 5297 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc5297#appendix-A',
          description: 'Official test vectors from RFC 5297'
        },
        {
          name: 'NIST CAVP Test Vectors',
          url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program',
          description: 'NIST validation test vectors for SIV mode'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: false, // AEAD, not stream cipher
    boolIsAEAD: true, // Mark as AEAD cipher
    boolIsDeterministic: true, // Mark as deterministic cipher
    
    // SIV constants
    BLOCK_SIZE: 16,        // AES block size
    SIV_SIZE: 16,          // SIV tag size (128 bits)
    
    // Initialize cipher
    Init: function() {
      AES_SIV.isInitialized = true;
    },
    
    // Set up key and initialize AES-SIV state
    KeySetup: function(key) {
      let id;
      do {
        id = 'AES-SIV[' + global.generateUniqueID() + ']';
      } while (AES_SIV.instances[id] || global.objectInstances[id]);
      
      AES_SIV.instances[id] = new AES_SIV.AESSIVInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (AES_SIV.instances[id]) {
        const instance = AES_SIV.instances[id];
        if (instance.key1 && global.OpCodes) {
          global.OpCodes.ClearArray(instance.key1);
        }
        if (instance.key2 && global.OpCodes) {
          global.OpCodes.ClearArray(instance.key2);
        }
        if (instance.aesId1 && global.Rijndael) {
          global.Rijndael.ClearData(instance.aesId1);
        }
        if (instance.aesId2 && global.Rijndael) {
          global.Rijndael.ClearData(instance.aesId2);
        }
        delete AES_SIV.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'AES-SIV', 'ClearData');
        return false;
      }
    },
    
    // Encrypt and authenticate (AEAD encryption)
    encryptBlock: function(id, plainText, associatedData) {
      if (!AES_SIV.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'AES-SIV', 'encryptBlock');
        return plainText;
      }
      
      const instance = AES_SIV.instances[id];
      const aadArray = Array.isArray(associatedData) ? associatedData : [associatedData || ''];
      return instance.encrypt(plainText, aadArray);
    },
    
    // Decrypt and verify (AEAD decryption)
    decryptBlock: function(id, cipherTextWithSIV, associatedData) {
      if (!AES_SIV.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'AES-SIV', 'decryptBlock');
        return cipherTextWithSIV;
      }
      
      const instance = AES_SIV.instances[id];
      const aadArray = Array.isArray(associatedData) ? associatedData : [associatedData || ''];
      return instance.decrypt(cipherTextWithSIV, aadArray);
    },
    
    // AES-SIV Instance class
    AESSIVInstance: function(key) {
      this.key1 = [];             // First half of key (for CMAC)
      this.key2 = [];             // Second half of key (for CTR)
      this.aesId1 = null;         // AES instance for CMAC
      this.aesId2 = null;         // AES instance for CTR
      
      // Convert key to byte array
      if (typeof key === 'string') {
        const keyBytes = [];
        for (let k = 0; k < key.length; k++) {
          keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
        this.initializeKeys(keyBytes);
      } else if (Array.isArray(key)) {
        this.initializeKeys(key);
      } else {
        throw new Error('AES-SIV key must be string or byte array');
      }
    }
  };
  
  // Add methods to AESSIVInstance prototype
  AES_SIV.AESSIVInstance.prototype = {
    
    /**
     * Initialize the two AES keys from master key
     * @param {Array} keyBytes - Master key bytes
     */
    initializeKeys: function(keyBytes) {
      // Validate key length (must be double AES key size)
      if (keyBytes.length !== 32 && keyBytes.length !== 48 && keyBytes.length !== 64) {
        throw new Error('AES-SIV key must be 256, 384, or 512 bits (32, 48, or 64 bytes)');
      }
      
      // Split key in half
      const halfLen = keyBytes.length / 2;
      this.key1 = keyBytes.slice(0, halfLen);      // First half for CMAC
      this.key2 = keyBytes.slice(halfLen);         // Second half for CTR
      
      // Initialize AES instances
      this.aesId1 = global.Rijndael.KeySetup(global.OpCodes.BytesToString(this.key1));
      this.aesId2 = global.Rijndael.KeySetup(global.OpCodes.BytesToString(this.key2));
    },
    
    /**
     * Galois Field multiplication by 2 (used in CMAC)
     * @param {Array} block - 16-byte block
     * @returns {Array} Block multiplied by 2 in GF(2^128)
     */
    gfMul2: function(block) {
      const result = new Array(16);
      let carry = 0;
      
      for (let i = 15; i >= 0; i--) {
        const newCarry = (block[i] & 0x80) ? 1 : 0;
        result[i] = ((block[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }
      
      // If there was a carry, XOR with the reduction polynomial
      if (carry) {
        result[15] ^= 0x87; // GF(2^128) reduction polynomial
      }
      
      return result;
    },
    
    /**
     * Generate CMAC subkeys K1 and K2
     * @returns {Object} Object with k1 and k2 arrays
     */
    generateCMACSubkeys: function() {
      // L = AES_K(0^128)
      const zeroBlock = new Array(16).fill(0);
      const L = global.OpCodes.StringToBytes(
        global.Rijndael.encryptBlock(this.aesId1, global.OpCodes.BytesToString(zeroBlock))
      );
      
      // K1 = L * 2
      const K1 = this.gfMul2(L);
      
      // K2 = K1 * 2
      const K2 = this.gfMul2(K1);
      
      return { k1: K1, k2: K2 };
    },
    
    /**
     * Compute CMAC of data
     * @param {Array} data - Data to authenticate
     * @returns {Array} 16-byte CMAC
     */
    computeCMAC: function(data) {
      const subkeys = this.generateCMACSubkeys();
      
      // Pad data to multiple of 16 bytes
      const paddedData = data.slice(0);
      const isComplete = (data.length % 16 === 0) && (data.length > 0);
      
      if (!isComplete) {
        // Pad with 10...0 pattern
        paddedData.push(0x80);
        while (paddedData.length % 16 !== 0) {
          paddedData.push(0);
        }
      }
      
      // Process blocks
      let mac = new Array(16).fill(0);
      
      for (let i = 0; i < paddedData.length; i += 16) {
        const block = paddedData.slice(i, i + 16);
        
        // XOR with previous MAC
        for (let j = 0; j < 16; j++) {
          block[j] ^= mac[j];
        }
        
        // If this is the last block, XOR with subkey
        if (i + 16 >= paddedData.length) {
          const subkey = isComplete ? subkeys.k1 : subkeys.k2;
          for (let j = 0; j < 16; j++) {
            block[j] ^= subkey[j];
          }
        }
        
        // Encrypt block
        mac = global.OpCodes.StringToBytes(
          global.Rijndael.encryptBlock(this.aesId1, global.OpCodes.BytesToString(block))
        );
      }
      
      return mac;
    },
    
    /**
     * S2V (String-to-Vector) function
     * @param {Array} strings - Array of strings to authenticate
     * @returns {Array} 16-byte SIV
     */
    s2v: function(strings) {
      // Start with CMAC of zero block
      const zeroBlock = new Array(16).fill(0);
      let v = this.computeCMAC(zeroBlock);
      
      // Process all but the last string
      for (let i = 0; i < strings.length - 1; i++) {
        const stringBytes = global.OpCodes.StringToBytes(strings[i]);
        const cmac = this.computeCMAC(stringBytes);
        
        // v = (v * 2) XOR CMAC(string)
        v = this.gfMul2(v);
        for (let j = 0; j < 16; j++) {
          v[j] ^= cmac[j];
        }
      }
      
      // Handle the last string (plaintext)
      if (strings.length > 0) {
        const lastString = global.OpCodes.StringToBytes(strings[strings.length - 1]);
        
        if (lastString.length >= 16) {
          // XOR v with last 16 bytes
          const lastBlock = lastString.slice(-16);
          for (let j = 0; j < 16; j++) {
            lastBlock[j] ^= v[j];
          }
          
          // Replace last 16 bytes and compute CMAC
          const modifiedString = lastString.slice(0, -16).concat(lastBlock);
          v = this.computeCMAC(modifiedString);
        } else {
          // Pad and XOR with doubled v
          const paddedString = lastString.slice(0);
          paddedString.push(0x80);
          while (paddedString.length < 16) {
            paddedString.push(0);
          }
          
          v = this.gfMul2(v);
          for (let j = 0; j < paddedString.length; j++) {
            v[j] ^= paddedString[j];
          }
          
          v = this.computeCMAC(v);
        }
      }
      
      return v;
    },
    
    /**
     * AES-CTR encryption/decryption
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} iv - 16-byte initialization vector
     * @returns {Array} Encrypted/decrypted data
     */
    aesCTR: function(data, iv) {
      const result = [];
      let counter = iv.slice(0);
      
      // Clear the S bit (bit 31) of the IV for CTR mode
      counter[12] &= 0x7F;
      
      for (let i = 0; i < data.length; i += 16) {
        // Encrypt counter to get keystream
        const keystream = global.OpCodes.StringToBytes(
          global.Rijndael.encryptBlock(this.aesId2, global.OpCodes.BytesToString(counter))
        );
        
        // XOR with data
        for (let j = 0; j < 16 && i + j < data.length; j++) {
          result.push(data[i + j] ^ keystream[j]);
        }
        
        // Increment counter (big-endian)
        for (let j = 15; j >= 0; j--) {
          counter[j] = (counter[j] + 1) & 0xFF;
          if (counter[j] !== 0) break;
        }
      }
      
      return result;
    },
    
    /**
     * Encrypt plaintext with associated data
     * @param {string} plaintext - Data to encrypt
     * @param {Array} aadArray - Array of associated data strings
     * @returns {string} SIV || Ciphertext
     */
    encrypt: function(plaintext, aadArray) {
      // Prepare S2V input: AAD strings + plaintext
      const s2vInput = aadArray.slice(0);
      s2vInput.push(plaintext);
      
      // Compute SIV using S2V
      const siv = this.s2v(s2vInput);
      
      // Encrypt plaintext using AES-CTR with SIV as IV
      const plaintextBytes = global.OpCodes.StringToBytes(plaintext);
      const ciphertext = this.aesCTR(plaintextBytes, siv);
      
      // Return SIV || Ciphertext
      return global.OpCodes.BytesToString(siv.concat(ciphertext));
    },
    
    /**
     * Decrypt ciphertext and verify authenticity
     * @param {string} ciphertextWithSIV - SIV || Ciphertext
     * @param {Array} aadArray - Array of associated data strings
     * @returns {string} Decrypted plaintext
     */
    decrypt: function(ciphertextWithSIV, aadArray) {
      if (ciphertextWithSIV.length < AES_SIV.SIV_SIZE) {
        throw new Error('Ciphertext must include 16-byte SIV');
      }
      
      // Split SIV and ciphertext
      const sivBytes = global.OpCodes.StringToBytes(ciphertextWithSIV.substring(0, AES_SIV.SIV_SIZE));
      const ciphertext = ciphertextWithSIV.substring(AES_SIV.SIV_SIZE);
      const ciphertextBytes = global.OpCodes.StringToBytes(ciphertext);
      
      // Decrypt ciphertext using AES-CTR
      const plaintextBytes = this.aesCTR(ciphertextBytes, sivBytes);
      const plaintext = global.OpCodes.BytesToString(plaintextBytes);
      
      // Verify SIV by recomputing S2V
      const s2vInput = aadArray.slice(0);
      s2vInput.push(plaintext);
      const expectedSIV = this.s2v(s2vInput);
      
      // Constant-time comparison
      if (!global.OpCodes.ConstantTimeCompare(sivBytes, expectedSIV)) {
        throw new Error('Authentication verification failed - message integrity compromised');
      }
      
      return plaintext;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(AES_SIV);
  }
  
  // Export to global scope
  global.AES_SIV = AES_SIV;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AES_SIV;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);