#!/usr/bin/env node
/*
 * Universal OCB3 (Offset Codebook Mode Version 3) Implementation
 * Compatible with both Browser and Node.js environments
 * Based on RFC 7253 - The OCB Authenticated-Encryption Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * OCB3 Algorithm Overview:
 * - Authenticated encryption with associated data (AEAD)
 * - Single-pass design for high efficiency
 * - Uses offset values to ensure block cipher invocations are independent
 * - Designed by Phillip Rogaway with patent-free status (as of 2014)
 * - Standardized in RFC 7253 and widely studied
 * 
 * Key Features:
 * - Key sizes: 128, 192, or 256 bits (AES key sizes)
 * - Nonce size: Up to 120 bits (15 bytes) with length encoding
 * - Tag size: Configurable (commonly 128 bits / 16 bytes)
 * - High performance: ~1.5x faster than GCM in software
 * - Parallel-friendly for both encryption and authentication
 * 
 * Construction:
 * 1. Process associated data with OCB authentication
 * 2. Encrypt plaintext with offset-based block processing
 * 3. Combine authentication and encryption checksums
 * 4. Generate final authentication tag
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - RFC 7253: The OCB Authenticated-Encryption Algorithm
 * - "OCB: A Block-Cipher Mode of Operation for Efficient Authenticated Encryption" by Rogaway
 * - Phillip Rogaway's OCB specification and analysis papers
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
      console.error('OCB3 cipher requires Cipher system to be loaded first');
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
  
  // Create OCB3 cipher object
  const OCB3 = {
    // Public interface properties
    internalName: 'OCB3',
    name: 'OCB3 Authenticated Encryption',
    comment: 'OCB3: Offset Codebook Mode Version 3 - RFC 7253 High-Performance AEAD',
    minKeyLength: 16,   // 128-bit keys
    maxKeyLength: 32,   // 256-bit keys  
    stepKeyLength: 8,   // 128, 192, or 256 bits
    minBlockSize: 1,    // AEAD can handle any data size
    maxBlockSize: 65536, // Practical limit
    stepBlockSize: 1,
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'OCB3',
      displayName: 'OCB3 Offset Codebook Authenticated Encryption',
      description: 'High-performance single-pass authenticated encryption using offset values to ensure block cipher independence. Significantly faster than GCM while providing strong security guarantees.',
      
      inventor: 'Phillip Rogaway',
      year: 2011,
      background: 'Third version of OCB mode, designed for optimal performance and patent-free usage. Standardized in RFC 7253 and widely adopted for high-performance applications.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Provably secure with tight security bounds. Patent-free since 2014. Significantly more efficient than other AEAD modes while maintaining security.',
      
      category: global.CipherMetadata.Categories.AEAD,
      subcategory: 'High-Performance Offset-Based',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: '128, 192, or 256 bits',
      blockSize: 128, // AES block size
      rounds: 'AES rounds (10, 12, or 14)',
      nonceSize: 'Up to 120 bits (15 bytes)',
      tagSize: 'Configurable (commonly 128 bits)',
      
      specifications: [
        {
          name: 'RFC 7253 - The OCB Authenticated-Encryption Algorithm',
          url: 'https://tools.ietf.org/html/rfc7253'
        },
        {
          name: 'OCB Mode Specification v3.0',
          url: 'https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-spec.htm'
        }
      ],
      
      testVectors: [
        {
          name: 'RFC 7253 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7253#appendix-A'
        },
        {
          name: 'OCB Reference Implementation Tests',
          url: 'https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-ref.htm'
        }
      ],
      
      references: [
        {
          name: 'OCB: A Block-Cipher Mode for Efficient Authenticated Encryption',
          url: 'https://web.cs.ucdavis.edu/~rogaway/papers/ocb-full.pdf'
        },
        {
          name: 'OCB Mode - Phillip Rogaway\'s Page',
          url: 'https://web.cs.ucdavis.edu/~rogaway/ocb/'
        }
      ],
      
      implementationNotes: 'Uses precomputed offset tables for efficiency. Single-pass design processes both encryption and authentication simultaneously.',
      performanceNotes: 'Approximately 1.5x faster than AES-GCM in software. Highly parallelizable for both encryption and decryption operations.',
      
      educationalValue: 'Excellent example of offset-based cryptography and high-performance AEAD design. Shows how clever mathematical constructions improve efficiency.',
      prerequisites: ['AES understanding', 'AEAD concepts', 'Galois Field arithmetic', 'Parallel cryptography'],
      
      tags: ['aead', 'high-performance', 'rfc7253', 'offset-based', 'patent-free', 'single-pass', 'rogaway'],
      
      version: '1.0'
    }) : null,

    // Test vectors for OCB3 from RFC 7253
    testVectors: [
      {
        algorithm: 'OCB3',
        key: '000102030405060708090a0b0c0d0e0f',
        nonce: 'bbaa99887766554433221100',
        aad: '',
        plaintext: '',
        ciphertext: '785407bfffc8ad9edcc5520ac9111ee6',
        description: 'RFC 7253 OCB3 Test Vector 1 (empty plaintext)'
      },
      {
        algorithm: 'OCB3',
        key: '000102030405060708090a0b0c0d0e0f',
        nonce: 'bbaa99887766554433221101',
        aad: '',
        plaintext: '0001020304050607',
        ciphertext: '6820b3657b6f615a5725bda0d3b4eb3a257c9af1f8f03009',
        description: 'RFC 7253 OCB3 Test Vector 2'
      }
    ],
    
    // Official test vectors from RFC 7253
    officialTestVectors: [
      // RFC 7253 Appendix A
      {
        algorithm: 'OCB3',
        description: 'RFC 7253 Appendix A Test Vector 1',
        origin: 'RFC 7253 - The OCB Authenticated-Encryption Algorithm',
        link: 'https://tools.ietf.org/html/rfc7253#appendix-A',
        standard: 'RFC 7253',
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f',
        keyHex: '000102030405060708090a0b0c0d0e0f',
        nonce: '\xbb\xaa\x99\x88\x77\x66\x55\x44\x33\x22\x11\x00',
        nonceHex: 'bbaa99887766554433221100',
        aad: '',
        aadHex: '',
        plaintext: '',
        plaintextHex: '',
        ciphertext: '\x78\x54\x07\xbf\xff\xc8\xad\x9e\xdc\xc5\x52\x0a\xc9\x11\x1e\xe6',
        ciphertextHex: '785407bfffc8ad9edcc5520ac9111ee6',
        notes: 'Empty plaintext test vector for OCB3',
        category: 'official-standard'
      }
    ],
    
    // Reference links to authoritative sources
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 7253 - The OCB Authenticated-Encryption Algorithm',
          url: 'https://tools.ietf.org/html/rfc7253',
          description: 'Official IETF specification for OCB3'
        },
        {
          name: 'OCB Mode Official Specification',
          url: 'https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-spec.htm',
          description: 'Phillip Rogaway\'s official OCB specification'
        }
      ],
      implementations: [
        {
          name: 'OCB Reference Implementation',
          url: 'https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-ref.htm',
          description: 'Official reference implementation by Phillip Rogaway'
        },
        {
          name: 'OpenSSL OCB Implementation',
          url: 'https://github.com/openssl/openssl/tree/master/crypto/modes',
          description: 'Production OCB implementation in OpenSSL'
        }
      ],
      validation: [
        {
          name: 'RFC 7253 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7253#appendix-A',
          description: 'Official test vectors from RFC 7253'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: false, // AEAD, not stream cipher
    boolIsAEAD: true, // Mark as AEAD cipher
    
    // OCB3 constants
    BLOCK_SIZE: 16,        // AES block size
    TAG_SIZE: 16,          // Default tag size (128 bits)
    MAX_NONCE_SIZE: 15,    // Maximum nonce size
    
    // Initialize cipher
    Init: function() {
      OCB3.isInitialized = true;
    },
    
    // Set up key and initialize OCB3 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'OCB3[' + global.generateUniqueID() + ']';
      } while (OCB3.instances[id] || global.objectInstances[id]);
      
      OCB3.instances[id] = new OCB3.OCB3Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (OCB3.instances[id]) {
        const instance = OCB3.instances[id];
        if (instance.key && global.OpCodes) {
          global.OpCodes.ClearArray(instance.key);
        }
        if (instance.aesId && global.Rijndael) {
          global.Rijndael.ClearData(instance.aesId);
        }
        if (instance.offsetTable && global.OpCodes) {
          for (let i = 0; i < instance.offsetTable.length; i++) {
            global.OpCodes.ClearArray(instance.offsetTable[i]);
          }
        }
        delete OCB3.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'OCB3', 'ClearData');
        return false;
      }
    },
    
    // Encrypt and authenticate (AEAD encryption)
    encryptBlock: function(id, plainText, associatedData, nonce) {
      if (!OCB3.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'OCB3', 'encryptBlock');
        return plainText;
      }
      
      const instance = OCB3.instances[id];
      return instance.encrypt(plainText, associatedData || '', nonce || '');
    },
    
    // Decrypt and verify (AEAD decryption)
    decryptBlock: function(id, cipherTextWithTag, associatedData, nonce) {
      if (!OCB3.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'OCB3', 'decryptBlock');
        return cipherTextWithTag;
      }
      
      const instance = OCB3.instances[id];
      return instance.decrypt(cipherTextWithTag, associatedData || '', nonce || '');
    },
    
    // OCB3 Instance class
    OCB3Instance: function(key) {
      this.key = [];              // Key bytes
      this.aesId = null;          // AES instance
      this.offsetTable = [];      // Precomputed offset values
      this.L = null;              // L = E_K(0^128)
      this.LDollar = null;        // L_$ = L * x
      this.LStar = null;          // L_* = L * x^2
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.key.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        this.key = key.slice(0);
      } else {
        throw new Error('OCB3 key must be string or byte array');
      }
      
      // Validate key length
      if (this.key.length !== 16 && this.key.length !== 24 && this.key.length !== 32) {
        throw new Error('OCB3 key must be 128, 192, or 256 bits (16, 24, or 32 bytes)');
      }
      
      // Initialize AES and precomputed values
      this.initializeAES();
      this.precomputeOffsets();
    }
  };
  
  // Add methods to OCB3Instance prototype
  OCB3.OCB3Instance.prototype = {
    
    /**
     * Initialize AES instance
     */
    initializeAES: function() {
      this.aesId = global.Rijndael.KeySetup(global.OpCodes.BytesToString(this.key));
    },
    
    /**
     * Galois Field multiplication by x (polynomial x) in GF(2^128)
     * @param {Array} block - 16-byte block
     * @returns {Array} Block multiplied by x
     */
    gfMulX: function(block) {
      const result = new Array(16);
      let carry = 0;
      
      for (let i = 15; i >= 0; i--) {
        const newCarry = (block[i] & 0x80) ? 1 : 0;
        result[i] = ((block[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }
      
      // If there was a carry, XOR with the reduction polynomial
      if (carry) {
        result[15] ^= 0x87; // GF(2^128) reduction polynomial for OCB
      }
      
      return result;
    },
    
    /**
     * XOR two 16-byte blocks
     * @param {Array} a - First block
     * @param {Array} b - Second block  
     * @returns {Array} XOR result
     */
    xorBlocks: function(a, b) {
      const result = new Array(16);
      for (let i = 0; i < 16; i++) {
        result[i] = a[i] ^ b[i];
      }
      return result;
    },
    
    /**
     * Precompute offset values for efficiency
     */
    precomputeOffsets: function() {
      // L = E_K(0^128)
      const zeroBlock = new Array(16).fill(0);
      this.L = global.OpCodes.StringToBytes(
        global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(zeroBlock))
      );
      
      // L_$ = L * x
      this.LDollar = this.gfMulX(this.L);
      
      // L_* = L * x^2
      this.LStar = this.gfMulX(this.LDollar);
      
      // Precompute L_i = L * x^i for i = 0, 1, 2, ...
      this.offsetTable = [];
      this.offsetTable[0] = this.L.slice(0);
      
      for (let i = 1; i < 64; i++) { // Precompute enough for practical use
        this.offsetTable[i] = this.gfMulX(this.offsetTable[i - 1]);
      }
    },
    
    /**
     * Get offset value L_i where i = ntz(block_index)
     * ntz = number of trailing zeros in binary representation
     * @param {number} blockIndex - Block index (1-based)
     * @returns {Array} Offset value
     */
    getOffset: function(blockIndex) {
      // Find number of trailing zeros
      let ntz = 0;
      let temp = blockIndex;
      while (temp > 0 && (temp & 1) === 0) {
        ntz++;
        temp >>>= 1;
      }
      
      // Return L_ntz
      if (ntz < this.offsetTable.length) {
        return this.offsetTable[ntz];
      } else {
        // Compute on-the-fly for very large indices
        let result = this.L.slice(0);
        for (let i = 0; i < ntz; i++) {
          result = this.gfMulX(result);
        }
        return result;
      }
    },
    
    /**
     * Process nonce to generate initial offset
     * @param {Array} nonceBytes - Nonce bytes
     * @returns {Array} Initial offset value
     */
    processNonce: function(nonceBytes) {
      // Nonce must be at most 15 bytes (120 bits)
      if (nonceBytes.length > OCB3.MAX_NONCE_SIZE) {
        throw new Error('OCB3 nonce must be at most 15 bytes (120 bits)');
      }
      
      // Pad nonce to 16 bytes with length encoding
      const paddedNonce = nonceBytes.slice(0);
      while (paddedNonce.length < 15) {
        paddedNonce.unshift(0);
      }
      paddedNonce.push(nonceBytes.length & 0xFF); // Length encoding
      
      // Ktop = E_K(Nonce || 1)
      const ktop = global.OpCodes.StringToBytes(
        global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(paddedNonce))
      );
      
      // Stretch = Ktop || (Ktop[1..64] XOR Ktop[9..72])
      const stretch = ktop.slice(0);
      for (let i = 0; i < 8; i++) {
        stretch.push(ktop[i + 1] ^ ktop[i + 9]);
      }
      
      // Extract bottom offset bits
      const bottom = nonceBytes.length % 8;
      const offset = new Array(16);
      
      for (let i = 0; i < 16; i++) {
        const byteIndex = Math.floor((i * 8 + bottom) / 8);
        const bitOffset = (i * 8 + bottom) % 8;
        
        if (byteIndex < stretch.length) {
          offset[i] = ((stretch[byteIndex] << bitOffset) | 
                      (byteIndex + 1 < stretch.length ? stretch[byteIndex + 1] >>> (8 - bitOffset) : 0)) & 0xFF;
        } else {
          offset[i] = 0;
        }
      }
      
      return offset;
    },
    
    /**
     * Process associated data for authentication
     * @param {string} aad - Associated authenticated data
     * @param {Array} initialOffset - Initial offset value
     * @returns {Array} Authentication checksum
     */
    processAAD: function(aad, initialOffset) {
      if (aad.length === 0) {
        return new Array(16).fill(0);
      }
      
      const aadBytes = global.OpCodes.StringToBytes(aad);
      let sum = new Array(16).fill(0);
      let offset = initialOffset.slice(0);
      let blockIndex = 1;
      
      // Process complete blocks
      for (let i = 0; i < aadBytes.length; i += 16) {
        if (i + 16 <= aadBytes.length) {
          // Complete block
          const block = aadBytes.slice(i, i + 16);
          
          // Offset = Offset XOR L_ntz(i)
          const ntzOffset = this.getOffset(blockIndex);
          offset = this.xorBlocks(offset, ntzOffset);
          
          // Sum = Sum XOR E_K(AAD_block XOR Offset)
          const input = this.xorBlocks(block, offset);
          const encrypted = global.OpCodes.StringToBytes(
            global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(input))
          );
          sum = this.xorBlocks(sum, encrypted);
          
          blockIndex++;
        } else {
          // Final partial block
          const finalBlock = aadBytes.slice(i);
          finalBlock.push(0x80); // Pad with 10*
          while (finalBlock.length < 16) {
            finalBlock.push(0);
          }
          
          // Offset = Offset XOR L_*
          offset = this.xorBlocks(offset, this.LStar);
          
          // Sum = Sum XOR E_K(final_block XOR Offset)
          const input = this.xorBlocks(finalBlock, offset);
          const encrypted = global.OpCodes.StringToBytes(
            global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(input))
          );
          sum = this.xorBlocks(sum, encrypted);
        }
      }
      
      return sum;
    },
    
    /**
     * Encrypt plaintext with OCB3
     * @param {string} plaintext - Data to encrypt
     * @param {string} aad - Associated authenticated data
     * @param {string} nonceStr - Nonce string
     * @returns {string} Ciphertext + authentication tag
     */
    encrypt: function(plaintext, aad, nonceStr) {
      const nonceBytes = global.OpCodes.StringToBytes(nonceStr);
      const plaintextBytes = global.OpCodes.StringToBytes(plaintext);
      
      // Process nonce to get initial offset
      let offset = this.processNonce(nonceBytes);
      
      // Process associated data
      const aadSum = this.processAAD(aad, offset);
      
      // Encrypt plaintext
      const ciphertext = [];
      let sum = new Array(16).fill(0);
      let blockIndex = 1;
      
      // Process complete blocks
      for (let i = 0; i < plaintextBytes.length; i += 16) {
        if (i + 16 <= plaintextBytes.length) {
          // Complete block
          const block = plaintextBytes.slice(i, i + 16);
          
          // Offset = Offset XOR L_ntz(i)
          const ntzOffset = this.getOffset(blockIndex);
          offset = this.xorBlocks(offset, ntzOffset);
          
          // C_i = E_K(P_i XOR Offset) XOR Offset
          const input = this.xorBlocks(block, offset);
          const encrypted = global.OpCodes.StringToBytes(
            global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(input))
          );
          const cipherBlock = this.xorBlocks(encrypted, offset);
          ciphertext.push(...cipherBlock);
          
          // Sum = Sum XOR P_i
          sum = this.xorBlocks(sum, block);
          
          blockIndex++;
        } else {
          // Final partial block
          const finalBlock = plaintextBytes.slice(i);
          
          // Offset = Offset XOR L_*
          offset = this.xorBlocks(offset, this.LStar);
          
          // Pad = E_K(Offset)
          const pad = global.OpCodes.StringToBytes(
            global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(offset))
          );
          
          // C_* = P_* XOR Pad[1..|P_*|]
          for (let j = 0; j < finalBlock.length; j++) {
            ciphertext.push(finalBlock[j] ^ pad[j]);
          }
          
          // Sum = Sum XOR (P_* || 1 || 0*)
          const paddedFinal = finalBlock.slice(0);
          paddedFinal.push(0x80);
          while (paddedFinal.length < 16) {
            paddedFinal.push(0);
          }
          sum = this.xorBlocks(sum, paddedFinal);
        }
      }
      
      // Generate authentication tag
      // Tag = E_K(Sum XOR Offset XOR L_$) XOR AAD_sum
      const tagInput = this.xorBlocks(this.xorBlocks(sum, offset), this.LDollar);
      const tagEncrypted = global.OpCodes.StringToBytes(
        global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(tagInput))
      );
      const tag = this.xorBlocks(tagEncrypted, aadSum);
      
      return global.OpCodes.BytesToString(ciphertext.concat(tag));
    },
    
    /**
     * Decrypt ciphertext and verify authentication
     * @param {string} ciphertextWithTag - Ciphertext + authentication tag
     * @param {string} aad - Associated authenticated data
     * @param {string} nonceStr - Nonce string
     * @returns {string} Decrypted plaintext
     */
    decrypt: function(ciphertextWithTag, aad, nonceStr) {
      if (ciphertextWithTag.length < OCB3.TAG_SIZE) {
        throw new Error('Ciphertext must include authentication tag');
      }
      
      const nonceBytes = global.OpCodes.StringToBytes(nonceStr);
      
      // Split ciphertext and tag
      const ciphertext = ciphertextWithTag.substring(0, ciphertextWithTag.length - OCB3.TAG_SIZE);
      const receivedTag = ciphertextWithTag.substring(ciphertextWithTag.length - OCB3.TAG_SIZE);
      const ciphertextBytes = global.OpCodes.StringToBytes(ciphertext);
      const receivedTagBytes = global.OpCodes.StringToBytes(receivedTag);
      
      // Process nonce to get initial offset
      let offset = this.processNonce(nonceBytes);
      
      // Process associated data
      const aadSum = this.processAAD(aad, offset);
      
      // Decrypt ciphertext
      const plaintext = [];
      let sum = new Array(16).fill(0);
      let blockIndex = 1;
      
      // Process complete blocks
      for (let i = 0; i < ciphertextBytes.length; i += 16) {
        if (i + 16 <= ciphertextBytes.length) {
          // Complete block
          const block = ciphertextBytes.slice(i, i + 16);
          
          // Offset = Offset XOR L_ntz(i)
          const ntzOffset = this.getOffset(blockIndex);
          offset = this.xorBlocks(offset, ntzOffset);
          
          // P_i = D_K(C_i XOR Offset) XOR Offset
          const input = this.xorBlocks(block, offset);
          const decrypted = global.OpCodes.StringToBytes(
            global.Rijndael.decryptBlock(this.aesId, global.OpCodes.BytesToString(input))
          );
          const plainBlock = this.xorBlocks(decrypted, offset);
          plaintext.push(...plainBlock);
          
          // Sum = Sum XOR P_i
          sum = this.xorBlocks(sum, plainBlock);
          
          blockIndex++;
        } else {
          // Final partial block
          const finalBlock = ciphertextBytes.slice(i);
          
          // Offset = Offset XOR L_*
          offset = this.xorBlocks(offset, this.LStar);
          
          // Pad = E_K(Offset)
          const pad = global.OpCodes.StringToBytes(
            global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(offset))
          );
          
          // P_* = C_* XOR Pad[1..|C_*|]
          const finalPlain = [];
          for (let j = 0; j < finalBlock.length; j++) {
            finalPlain.push(finalBlock[j] ^ pad[j]);
          }
          plaintext.push(...finalPlain);
          
          // Sum = Sum XOR (P_* || 1 || 0*)
          const paddedFinal = finalPlain.slice(0);
          paddedFinal.push(0x80);
          while (paddedFinal.length < 16) {
            paddedFinal.push(0);
          }
          sum = this.xorBlocks(sum, paddedFinal);
        }
      }
      
      // Verify authentication tag
      const tagInput = this.xorBlocks(this.xorBlocks(sum, offset), this.LDollar);
      const tagEncrypted = global.OpCodes.StringToBytes(
        global.Rijndael.encryptBlock(this.aesId, global.OpCodes.BytesToString(tagInput))
      );
      const expectedTag = this.xorBlocks(tagEncrypted, aadSum);
      
      // Constant-time comparison
      if (!global.OpCodes.ConstantTimeCompare(receivedTagBytes, expectedTag)) {
        throw new Error('Authentication verification failed - message integrity compromised');
      }
      
      return global.OpCodes.BytesToString(plaintext);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(OCB3);
  }
  
  // Export to global scope
  global.OCB3 = OCB3;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCB3;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);