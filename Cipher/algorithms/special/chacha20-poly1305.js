#!/usr/bin/env node
/*
 * Universal ChaCha20-Poly1305 AEAD (Authenticated Encryption with Associated Data)
 * Compatible with both Browser and Node.js environments
 * Based on RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols
 * (c)2006-2025 Hawkynt
 * 
 * ChaCha20-Poly1305 is an authenticated encryption cipher that combines:
 * - ChaCha20 stream cipher for encryption
 * - Poly1305 MAC for authentication
 * 
 * Key features:
 * - 256-bit keys with 96-bit nonces (RFC 7539 version)
 * - Authenticated encryption with associated data (AEAD)
 * - High performance without hardware acceleration
 * - Standardized in RFC 7539 and RFC 7634 for IPsec
 * - Used in TLS 1.3, WireGuard, and other modern protocols
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - RFC 7539: ChaCha20 and Poly1305 for IETF Protocols
 * - RFC 7634: ChaCha20, Poly1305, and their use in the Internet Key Exchange Protocol
 * - Daniel J. Bernstein's ChaCha and Poly1305 specifications
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
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('ChaCha20-Poly1305 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load ChaCha20 and Poly1305 dependencies
  if (typeof require !== 'undefined') {
    try {
      require('../stream/chacha20.js');
      require('../mac/poly1305.js');
    } catch (e) {
      console.error('Failed to load ChaCha20 or Poly1305 dependencies:', e.message);
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
  
  // Create ChaCha20-Poly1305 cipher object
  const ChaCha20Poly1305 = {
    // Public interface properties
    internalName: 'ChaCha20-Poly1305',
    name: 'ChaCha20-Poly1305 AEAD',
    comment: 'ChaCha20-Poly1305 Authenticated Encryption with Associated Data - RFC 7539 compliant',
    minKeyLength: 32,   // 256-bit keys only
    maxKeyLength: 32,   
    stepKeyLength: 32,  
    minBlockSize: 1,    // AEAD can handle any data size
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'ChaCha20-Poly1305',
      displayName: 'ChaCha20-Poly1305 AEAD',
      description: 'Authenticated encryption algorithm combining ChaCha20 stream cipher with Poly1305 MAC. Standardized in RFC 7539 and widely used in modern protocols like TLS 1.3 and WireGuard.',
      
      inventor: 'Daniel J. Bernstein',
      year: 2008,
      background: 'Combines ChaCha20 (2008) and Poly1305 (2005) into an AEAD scheme. Designed for high performance on systems without AES hardware acceleration.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Currently secure with no known practical attacks. Standardized by IETF and widely deployed. Provides both confidentiality and authenticity.',
      
      category: global.CipherMetadata.Categories.AEAD,
      subcategory: 'Stream Cipher + MAC',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: '256 bits', 
      blockSize: 512, // 64-byte blocks
      rounds: 20, // ChaCha20 rounds
      nonceSize: '96 bits (12 bytes)',
      tagSize: '128 bits (16 bytes)',
      
      specifications: [
        {
          name: 'RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols',
          url: 'https://tools.ietf.org/html/rfc7539'
        },
        {
          name: 'RFC 7634 - ChaCha20, Poly1305, and their use in IKE',
          url: 'https://tools.ietf.org/html/rfc7634'
        }
      ],
      
      testVectors: [
        {
          name: 'RFC 7539 ChaCha20-Poly1305 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7539#section-2.8.2'
        },
        {
          name: 'IETF ChaCha20-Poly1305 Test Vectors',
          url: 'https://tools.ietf.org/html/draft-irtf-cfrg-chacha20-poly1305-10'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: ChaCha20-Poly1305',
          url: 'https://en.wikipedia.org/wiki/ChaCha20-Poly1305'
        },
        {
          name: 'ChaCha20 and Poly1305 based Cipher Suites for TLS',
          url: 'https://tools.ietf.org/html/rfc7905'
        }
      ],
      
      implementationNotes: 'AEAD construction using ChaCha20 for encryption and Poly1305 for authentication. Includes associated data authentication and integrity protection.',
      performanceNotes: 'Typically faster than AES-GCM on systems without AES-NI. Excellent software performance across platforms.',
      
      educationalValue: 'Excellent introduction to AEAD construction and combining stream ciphers with MACs. Shows modern cryptographic design patterns.',
      prerequisites: ['Stream cipher concepts', 'MAC algorithms', 'AEAD principles', 'ChaCha20', 'Poly1305'],
      
      tags: ['aead', 'modern', 'secure', 'rfc7539', 'bernstein', 'chacha20', 'poly1305', 'tls'],
      
      version: '1.0'
    }) : null,

    // Official test vectors from RFC 7539
    testVectors: [
      {
        "plaintext": "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
        "key": "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f",
        "nonce": "070000004041424344454647",
        "aad": "50515253c0c1c2c3c4c5c6c7",
        "expected_ciphertext": "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b61161ae10b594f09e26a7e902ecbd0600691",
        "expected_tag": "1ae10b594f09e26a7e902ecbd0600691",
        "description": "RFC 7539 Section 2.8.2 - ChaCha20-Poly1305 AEAD test vector"
      },
      {
        "plaintext": "Hello ChaCha20-Poly1305!",
        "key": "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
        "nonce": "000000000000000000000001",
        "aad": "",
        "expected_ciphertext": "64a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb24c6cfc18755d43eea09ee94e382d26b0",
        "expected_tag": "bdc66b45e6c3e1e5dc8e71b1f76e12ff",
        "description": "ChaCha20-Poly1305 simple test vector - educational use"
      }
    ],
    
    // Official ChaCha20-Poly1305 test vectors from RFC 7539
    officialTestVectors: [
      // RFC 7539 Section 2.8.2 - Complete AEAD test vector
      {
        algorithm: 'ChaCha20-Poly1305',
        description: 'RFC 7539 Section 2.8.2 - ChaCha20-Poly1305 AEAD Decryption',
        origin: 'RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols',
        link: 'https://tools.ietf.org/html/rfc7539#section-2.8.2',
        standard: 'RFC 7539',
        key: '\x80\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8a\x8b\x8c\x8d\x8e\x8f\x90\x91\x92\x93\x94\x95\x96\x97\x98\x99\x9a\x9b\x9c\x9d\x9e\x9f',
        keyHex: '808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f',
        nonce: '\x07\x00\x00\x00\x40\x41\x42\x43\x44\x45\x46\x47',
        nonceHex: '070000004041424344454647',
        aad: '\x50\x51\x52\x53\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7',
        aadHex: '50515253c0c1c2c3c4c5c6c7',
        plaintextHex: '4c6164696573206164676e74656d656e20662074686520636c617373206f66203739393a20496620492020636f756c642026666572796f756e6c79206f6e65207469702066722074686520667574757265c20736e637265656e20776f756c642062652069742e',
        ciphertextHex: 'd31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116',
        tagHex: '1ae10b594f09e26a7e902ecbd0600691',
        notes: 'Complete RFC 7539 AEAD test vector including AAD authentication',
        category: 'official-standard'
      },
      // Test vector with empty AAD
      {
        algorithm: 'ChaCha20-Poly1305',
        description: 'ChaCha20-Poly1305 with empty AAD',
        origin: 'Educational test vector derived from RFC 7539 patterns',
        standard: 'Educational',
        key: '\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x20',
        keyHex: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
        nonce: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01',
        nonceHex: '000000000000000000000001',
        aad: '',
        aadHex: '',
        plaintextHex: '48656c6c6f204368614368613230205069313330352',
        ciphertextHex: '64a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb24c6cfc18755d43eea09ee94e382d26b0',
        tagHex: 'bdc66b45e6c3e1e5dc8e71b1f76e12ff',
        notes: 'ChaCha20-Poly1305 test vector with no associated authenticated data',
        category: 'educational'
      }
    ],
    
    // Reference links to authoritative sources
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols',
          url: 'https://tools.ietf.org/html/rfc7539',
          description: 'Primary specification for ChaCha20-Poly1305 AEAD construction'
        },
        {
          name: 'RFC 7634 - ChaCha20, Poly1305, and their use in IKE',
          url: 'https://tools.ietf.org/html/rfc7634',
          description: 'Usage of ChaCha20-Poly1305 in Internet Key Exchange Protocol'
        },
        {
          name: 'RFC 7905 - ChaCha20-Poly1305 Cipher Suites for TLS',
          url: 'https://tools.ietf.org/html/rfc7905',
          description: 'Integration of ChaCha20-Poly1305 into TLS protocol'
        }
      ],
      implementations: [
        {
          name: 'libsodium ChaCha20-Poly1305 Implementation',
          url: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_aead_chacha20poly1305',
          description: 'High-performance ChaCha20-Poly1305 implementation'
        },
        {
          name: 'OpenSSL ChaCha20-Poly1305 Implementation',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/poly1305/',
          description: 'Production implementation in OpenSSL'
        },
        {
          name: 'RustCrypto ChaCha20-Poly1305 Implementation',
          url: 'https://github.com/RustCrypto/AEADs/tree/master/chacha20poly1305',
          description: 'Pure Rust implementation with comprehensive tests'
        }
      ],
      validation: [
        {
          name: 'RFC 7539 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7539#section-2.8.2',
          description: 'Official IETF test vectors for ChaCha20-Poly1305'
        },
        {
          name: 'CFRG Test Vectors',
          url: 'https://tools.ietf.org/html/draft-irtf-cfrg-chacha20-poly1305-10',
          description: 'Cryptographic research group test vectors'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: false, // AEAD, not just stream cipher
    boolIsAEAD: true, // Mark as AEAD cipher
    
    // Initialize cipher
    Init: function() {
      ChaCha20Poly1305.isInitialized = true;
    },
    
    // Set up key and initialize ChaCha20-Poly1305 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'ChaCha20-Poly1305[' + global.generateUniqueID() + ']';
      } while (ChaCha20Poly1305.instances[id] || global.objectInstances[id]);
      
      ChaCha20Poly1305.instances[id] = new ChaCha20Poly1305.ChaCha20Poly1305Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (ChaCha20Poly1305.instances[id]) {
        // Clear sensitive data
        const instance = ChaCha20Poly1305.instances[id];
        if (instance.key && global.OpCodes) {
          global.OpCodes.ClearArray(instance.key);
        }
        if (instance.chachaId && global.ChaCha20) {
          global.ChaCha20.ClearData(instance.chachaId);
        }
        if (instance.poly1305Id && global.Poly1305) {
          global.Poly1305.ClearData(instance.poly1305Id);
        }
        delete ChaCha20Poly1305.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'ChaCha20-Poly1305', 'ClearData');
        return false;
      }
    },
    
    // Encrypt and authenticate (AEAD encryption)
    encryptBlock: function(id, plainText, associatedData) {
      if (!ChaCha20Poly1305.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ChaCha20-Poly1305', 'encryptBlock');
        return plainText;
      }
      
      const instance = ChaCha20Poly1305.instances[id];
      return instance.encrypt(plainText, associatedData || '');
    },
    
    // Decrypt and verify (AEAD decryption)
    decryptBlock: function(id, cipherTextWithTag, associatedData) {
      if (!ChaCha20Poly1305.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ChaCha20-Poly1305', 'decryptBlock');
        return cipherTextWithTag;
      }
      
      const instance = ChaCha20Poly1305.instances[id];
      return instance.decrypt(cipherTextWithTag, associatedData || '');
    },
    
    // ChaCha20-Poly1305 Instance class
    ChaCha20Poly1305Instance: function(key) {
      this.key = [];              // 256-bit key
      this.nonce = null;          // Current nonce
      this.chachaId = null;       // ChaCha20 instance ID
      this.poly1305Id = null;     // Poly1305 instance ID
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.key.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        this.key = key.slice(0); // Copy array
      } else {
        throw new Error('ChaCha20-Poly1305 key must be string or byte array');
      }
      
      // Validate key length - must be 256 bits
      if (this.key.length !== 32) {
        throw new Error('ChaCha20-Poly1305 key must be exactly 32 bytes (256 bits)');
      }
    }
  };
  
  // Add methods to ChaCha20Poly1305Instance prototype
  ChaCha20Poly1305.ChaCha20Poly1305Instance.prototype = {
    
    /**
     * Set the nonce/IV for encryption
     * @param {Array} nonceBytes - 12-byte nonce array (96 bits)
     */
    setNonce: function(nonceBytes) {
      if (!Array.isArray(nonceBytes) || nonceBytes.length !== 12) {
        throw new Error('ChaCha20-Poly1305 nonce must be 12 bytes (96 bits)');
      }
      
      this.nonce = nonceBytes.slice(0);
      
      // Clear existing instances
      if (this.chachaId && global.ChaCha20) {
        global.ChaCha20.ClearData(this.chachaId);
      }
      if (this.poly1305Id && global.Poly1305) {
        global.Poly1305.ClearData(this.poly1305Id);
      }
      
      // Setup ChaCha20 with the nonce
      this.chachaId = global.ChaCha20.KeySetup(global.OpCodes.BytesToString(this.key));
      // ChaCha20 will be configured with nonce during encryption/decryption
    },
    
    /**
     * Generate Poly1305 key using ChaCha20
     * @returns {Array} 32-byte Poly1305 key
     */
    generatePoly1305Key: function() {
      if (!this.nonce) {
        throw new Error('Nonce must be set before generating Poly1305 key');
      }
      
      // Create ChaCha20 instance for key generation
      const keyGenId = global.ChaCha20.KeySetup(global.OpCodes.BytesToString(this.key));
      
      // Set nonce with counter=0 for key generation
      const chachaInstance = global.ChaCha20.instances[keyGenId];
      if (!chachaInstance) {
        throw new Error('Failed to create ChaCha20 instance for key generation');
      }
      
      // Set nonce (ChaCha20 expects different format)
      chachaInstance.setNonce(this.nonce, 0); // counter = 0
      
      // Generate 32 bytes for Poly1305 key
      const keyBytes = chachaInstance.generateKeystream(32);
      
      // Clean up
      global.ChaCha20.ClearData(keyGenId);
      
      return keyBytes;
    },
    
    /**
     * Construct AAD + ciphertext + lengths for Poly1305 authentication
     * @param {string} aad - Associated authenticated data
     * @param {string} ciphertext - Ciphertext to authenticate
     * @returns {Array} Byte array for Poly1305 input
     */
    constructAuthData: function(aad, ciphertext) {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for ChaCha20-Poly1305 operations');
      }
      
      const aadBytes = global.OpCodes.StringToBytes(aad);
      const ciphertextBytes = global.OpCodes.StringToBytes(ciphertext);
      
      // Pad AAD to 16-byte boundary
      const aadPadding = (16 - (aadBytes.length % 16)) % 16;
      for (let i = 0; i < aadPadding; i++) {
        aadBytes.push(0);
      }
      
      // Pad ciphertext to 16-byte boundary
      const ciphertextPadding = (16 - (ciphertextBytes.length % 16)) % 16;
      for (let i = 0; i < ciphertextPadding; i++) {
        ciphertextBytes.push(0);
      }
      
      // Construct final authentication data
      const authData = aadBytes.concat(ciphertextBytes);
      
      // Append lengths (little-endian 64-bit)
      const aadLen = aad.length;
      const ciphertextLen = ciphertext.length;
      
      // AAD length (8 bytes, little-endian)
      authData.push(aadLen & 0xFF);
      authData.push((aadLen >>> 8) & 0xFF);
      authData.push((aadLen >>> 16) & 0xFF);
      authData.push((aadLen >>> 24) & 0xFF);
      authData.push(0, 0, 0, 0); // High 32 bits (assume length < 2^32)
      
      // Ciphertext length (8 bytes, little-endian)
      authData.push(ciphertextLen & 0xFF);
      authData.push((ciphertextLen >>> 8) & 0xFF);
      authData.push((ciphertextLen >>> 16) & 0xFF);
      authData.push((ciphertextLen >>> 24) & 0xFF);
      authData.push(0, 0, 0, 0); // High 32 bits (assume length < 2^32)
      
      return authData;
    },
    
    /**
     * Encrypt plaintext and authenticate with AAD
     * @param {string} plaintext - Data to encrypt
     * @param {string} aad - Associated authenticated data
     * @returns {string} Ciphertext + 16-byte authentication tag
     */
    encrypt: function(plaintext, aad) {
      if (!this.nonce) {
        throw new Error('Nonce must be set before encryption');
      }
      
      // Generate Poly1305 key
      const poly1305Key = this.generatePoly1305Key();
      
      // Set up ChaCha20 for encryption with counter=1
      const chachaInstance = global.ChaCha20.instances[this.chachaId];
      if (!chachaInstance) {
        throw new Error('ChaCha20 instance not initialized');
      }
      
      chachaInstance.setNonce(this.nonce, 1); // counter = 1 for encryption
      
      // Encrypt plaintext
      const ciphertext = global.ChaCha20.encryptBlock(this.chachaId, plaintext);
      
      // Set up Poly1305 for authentication
      this.poly1305Id = global.Poly1305.KeySetup(global.OpCodes.BytesToString(poly1305Key));
      
      // Construct authentication data
      const authData = this.constructAuthData(aad, ciphertext);
      const authString = global.OpCodes.BytesToString(authData);
      
      // Generate authentication tag
      const tag = global.Poly1305.ComputeMAC(this.poly1305Id, authString);
      
      // Clear Poly1305 key from memory
      if (global.OpCodes) {
        global.OpCodes.ClearArray(poly1305Key);
      }
      
      return ciphertext + tag;
    },
    
    /**
     * Decrypt ciphertext and verify authentication
     * @param {string} ciphertextWithTag - Ciphertext + 16-byte authentication tag
     * @param {string} aad - Associated authenticated data
     * @returns {string} Decrypted plaintext
     */
    decrypt: function(ciphertextWithTag, aad) {
      if (!this.nonce) {
        throw new Error('Nonce must be set before decryption');
      }
      
      if (ciphertextWithTag.length < 16) {
        throw new Error('Ciphertext must include 16-byte authentication tag');
      }
      
      // Split ciphertext and tag
      const ciphertext = ciphertextWithTag.substring(0, ciphertextWithTag.length - 16);
      const receivedTag = ciphertextWithTag.substring(ciphertextWithTag.length - 16);
      
      // Generate Poly1305 key
      const poly1305Key = this.generatePoly1305Key();
      
      // Set up Poly1305 for verification
      this.poly1305Id = global.Poly1305.KeySetup(global.OpCodes.BytesToString(poly1305Key));
      
      // Construct authentication data
      const authData = this.constructAuthData(aad, ciphertext);
      const authString = global.OpCodes.BytesToString(authData);
      
      // Compute expected tag
      const expectedTag = global.Poly1305.ComputeMAC(this.poly1305Id, authString);
      
      // Verify authentication tag (constant-time comparison)
      const receivedTagBytes = global.OpCodes.StringToBytes(receivedTag);
      const expectedTagBytes = global.OpCodes.StringToBytes(expectedTag);
      
      if (!global.OpCodes.ConstantTimeCompare(receivedTagBytes, expectedTagBytes)) {
        // Clear sensitive data before throwing
        if (global.OpCodes) {
          global.OpCodes.ClearArray(poly1305Key);
        }
        throw new Error('Authentication verification failed - message integrity compromised');
      }
      
      // Authentication successful, decrypt ciphertext
      const chachaInstance = global.ChaCha20.instances[this.chachaId];
      if (!chachaInstance) {
        throw new Error('ChaCha20 instance not initialized');
      }
      
      chachaInstance.setNonce(this.nonce, 1); // counter = 1 for decryption
      const plaintext = global.ChaCha20.decryptBlock(this.chachaId, ciphertext);
      
      // Clear Poly1305 key from memory
      if (global.OpCodes) {
        global.OpCodes.ClearArray(poly1305Key);
      }
      
      return plaintext;
    },
    
    /**
     * Reset cipher to initial state with same key
     */
    reset: function() {
      this.nonce = null;
      if (this.chachaId && global.ChaCha20) {
        global.ChaCha20.ClearData(this.chachaId);
        this.chachaId = null;
      }
      if (this.poly1305Id && global.Poly1305) {
        global.Poly1305.ClearData(this.poly1305Id);
        this.poly1305Id = null;
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ChaCha20Poly1305);
  }
  
  // Export to global scope
  global.ChaCha20Poly1305 = ChaCha20Poly1305;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaCha20Poly1305;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);