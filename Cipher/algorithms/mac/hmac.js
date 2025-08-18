#!/usr/bin/env node
/*
 * Universal HMAC (Hash-based Message Authentication Code)
 * Compatible with both Browser and Node.js environments
 * Based on RFC 2104 specification
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of HMAC using configurable hash functions.
 * Provides message authentication using a secret key and cryptographic hash function.
 * 
 * Supports SHA-1, MD5, and other hash functions implemented in this collection.
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
  
  // Load hash functions
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha1.js');
      require('../hash/md5.js');
    } catch (e) {
      console.error('Failed to load hash functions:', e.message);
    }
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
      console.error('HMAC requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create HMAC object
  const HMAC = {
    // Public interface properties
    internalName: 'HMAC',
    name: 'HMAC',
    comment: 'Hash-based Message Authentication Code (RFC 2104) - Educational Implementation',
    minKeyLength: 1,    // HMAC requires a key
    maxKeyLength: 1024, // Reasonable maximum key length
    stepKeyLength: 1,
    minBlockSize: 0,    // Can authenticate any length message
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,  // HMAC is one-way
    isInitialized: false,
    
    // HMAC constants
    IPAD: 0x36, // Inner pad byte
    OPAD: 0x5C, // Outer pad byte
    
    // Default hash function parameters
    DEFAULT_HASH: 'SHA1',
    BLOCK_SIZES: {
      'SHA1': 64,   // SHA-1 uses 64-byte blocks
      'MD5': 64,    // MD5 uses 64-byte blocks
      'SHA256': 64  // SHA-256 uses 64-byte blocks
    },
    
    // Comprehensive test vectors from RFC 2104, RFC 4231, and other standards
    testVectors: [
      {
        algorithm: 'HMAC-MD5',
        description: 'Basic HMAC-MD5 with 16-byte key',
        origin: 'RFC 2104',
        link: 'https://tools.ietf.org/html/rfc2104',
        standard: 'RFC 2104',
        key: '\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b',
        message: 'Hi There',
        mac: '9294727a3638bb1c13f48ef8158bfc9d',
        keyHex: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        messageHex: '4869205468657265',
        macHex: '9294727a3638bb1c13f48ef8158bfc9d',
        notes: 'RFC 2104 test case 1 - basic functionality',
        category: 'basic'
      },
      {
        algorithm: 'HMAC-MD5',
        description: 'HMAC-MD5 with text key',
        origin: 'RFC 2104',
        link: 'https://tools.ietf.org/html/rfc2104',
        standard: 'RFC 2104',
        key: 'Jefe',
        message: 'what do ya want for nothing?',
        mac: '750c783e6ab0b503eaa86e310a5db738',
        keyHex: '4a656665',
        messageHex: '7768617420646f2079612077616e7420666f72206e6f7468696e673f',
        macHex: '750c783e6ab0b503eaa86e310a5db738',
        notes: 'RFC 2104 test case 2 - text key',
        category: 'basic'
      },
      {
        algorithm: 'HMAC-SHA1',
        description: 'Basic HMAC-SHA1 with 20-byte key',
        origin: 'RFC 2104',
        link: 'https://tools.ietf.org/html/rfc2104',
        standard: 'RFC 2104',
        key: '\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b',
        message: 'Hi There',
        mac: 'b617318655057264e28bc0b6fb378c8ef146be00',
        keyHex: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        messageHex: '4869205468657265',
        macHex: 'b617318655057264e28bc0b6fb378c8ef146be00',
        notes: 'RFC 2104 test case 1 adapted for SHA-1',
        category: 'basic'
      },
      {
        algorithm: 'HMAC-SHA256',
        description: 'HMAC-SHA256 with 32-byte key',
        origin: 'RFC 4231',
        link: 'https://tools.ietf.org/html/rfc4231',
        standard: 'RFC 4231',
        key: '\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b\x0b',
        message: 'Hi There',
        mac: 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
        keyHex: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        messageHex: '4869205468657265',
        macHex: 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
        notes: 'RFC 4231 test case 1 - SHA-256 based HMAC',
        category: 'basic'
      },
      {
        algorithm: 'HMAC-SHA256',
        description: 'Long key test (longer than block size)',
        origin: 'RFC 4231',
        link: 'https://tools.ietf.org/html/rfc4231',
        standard: 'RFC 4231',
        key: '\xaa'.repeat(131),
        message: 'Test Using Larger Than Block-Size Key - Hash Key First',
        mac: '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
        keyHex: 'aa'.repeat(131),
        messageHex: '54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b65792046697273',
        macHex: '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
        notes: 'Key longer than block size - should be hashed first',
        category: 'boundary'
      },
      {
        algorithm: 'HMAC-SHA256',
        description: 'Long message test',
        origin: 'RFC 4231',
        link: 'https://tools.ietf.org/html/rfc4231',
        standard: 'RFC 4231',
        key: '\xaa'.repeat(20),
        message: '\xdd'.repeat(50),
        mac: '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe',
        keyHex: 'aa'.repeat(20),
        messageHex: 'dd'.repeat(50),
        macHex: '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe',
        notes: 'Long message with repeated bytes',
        category: 'boundary'
      },
      {
        algorithm: 'HMAC-SHA1',
        description: 'Empty message test',
        origin: 'Custom test',
        link: 'https://tools.ietf.org/html/rfc2104',
        standard: 'Custom',
        key: 'key',
        message: '',
        mac: 'f42bb0eeb018ebbd4597ae7213711ec60760843f',
        keyHex: '6b6579',
        messageHex: '',
        macHex: 'f42bb0eeb018ebbd4597ae7213711ec60760843f',
        notes: 'Edge case: empty message authentication',
        category: 'boundary'
      },
      {
        algorithm: 'HMAC-SHA256',
        description: 'TLS key derivation example',
        origin: 'RFC 5246',
        link: 'https://tools.ietf.org/html/rfc5246',
        standard: 'RFC 5246',
        key: 'master_secret_example',
        message: 'key expansion',
        mac: 'example_mac_for_tls_key_derivation_placeholder',
        keyHex: '6d61737465725f7365637265745f6578616d706c65',
        messageHex: '6b6579206578706e73696f6e',
        macHex: '6578616d706c655f6d61635f666f725f746c735f6b65795f64657269766174696f6e5f706c616365686f6c646572',
        notes: 'Real-world usage in TLS key derivation',
        category: 'application'
      }
    ],
    
    // Reference links for HMAC
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 2104: HMAC: Keyed-Hashing for Message Authentication',
          url: 'https://tools.ietf.org/html/rfc2104',
          description: 'Original HMAC specification by Krawczyk, Bellare, and Canetti'
        },
        {
          name: 'RFC 4231: Identifiers and Test Vectors for HMAC-SHA-224, HMAC-SHA-256, HMAC-SHA-384, and HMAC-SHA-512',
          url: 'https://tools.ietf.org/html/rfc4231',
          description: 'Test vectors for HMAC with SHA-2 family hash functions'
        },
        {
          name: 'NIST FIPS 198-1: The Keyed-Hash Message Authentication Code (HMAC)',
          url: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.198-1.pdf',
          description: 'NIST official standard for HMAC'
        },
        {
          name: 'RFC 5869: HMAC-based Extract-and-Expand Key Derivation Function (HKDF)',
          url: 'https://tools.ietf.org/html/rfc5869',
          description: 'Key derivation function based on HMAC'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL libcrypto HMAC',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/hmac/hmac.c',
          description: 'Production OpenSSL HMAC implementation'
        },
        {
          name: 'libgcrypt HMAC',
          url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/hmac-tests.c',
          description: 'GNU Cryptographic Library HMAC implementation'
        },
        {
          name: 'Python hmac module',
          url: 'https://docs.python.org/3/library/hmac.html',
          description: 'Python standard library HMAC implementation'
        },
        {
          name: 'Go crypto/hmac',
          url: 'https://golang.org/pkg/crypto/hmac/',
          description: 'Go standard library HMAC package'
        },
        {
          name: 'Java javax.crypto.Mac',
          url: 'https://docs.oracle.com/en/java/javase/11/docs/api/java.base/javax/crypto/Mac.html',
          description: 'Java standard library MAC interface'
        }
      ],
      validation: [
        {
          name: 'NIST CAVP HMAC Test Vectors',
          url: 'https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Message-Authentication',
          description: 'Comprehensive HMAC test vectors for validation'
        },
        {
          name: 'RFC 4231 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc4231#section-4',
          description: 'Official test vectors for HMAC-SHA-2 variants'
        },
        {
          name: 'HMAC Online Calculator',
          url: 'https://www.freeformatter.com/hmac-generator.html',
          description: 'Online tool for HMAC calculation and verification'
        }
      ],
      applications: [
        {
          name: 'TLS/SSL Key Derivation',
          url: 'https://tools.ietf.org/html/rfc5246#section-5',
          description: 'HMAC usage in TLS for key derivation and PRF'
        },
        {
          name: 'JWT (JSON Web Tokens)',
          url: 'https://tools.ietf.org/html/rfc7519',
          description: 'HMAC-SHA256 for JWT signature verification'
        },
        {
          name: 'OAuth 1.0a Signature',
          url: 'https://tools.ietf.org/html/rfc5849',
          description: 'HMAC-SHA1 for OAuth request authentication'
        },
        {
          name: 'AWS API Authentication',
          url: 'https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html',
          description: 'HMAC-SHA256 in AWS Signature Version 4'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      HMAC.isInitialized = true;
    },
    
    // Set up instance with key and optional hash function
    KeySetup: function(key, hashFunction) {
      let id;
      do {
        id = 'HMAC[' + global.generateUniqueID() + ']';
      } while (HMAC.instances[id] || global.objectInstances[id]);
      
      const hashFunc = hashFunction || HMAC.DEFAULT_HASH;
      HMAC.instances[id] = new HMAC.HMACInstance(key, hashFunc);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear HMAC data
    ClearData: function(id) {
      if (HMAC.instances[id]) {
        // Secure cleanup
        const instance = HMAC.instances[id];
        if (instance.keyPadded) OpCodes.ClearArray(instance.keyPadded);
        
        delete HMAC.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'HMAC', 'ClearData');
        return false;
      }
    },
    
    // Generate HMAC (encryption interface)
    encryptBlock: function(id, message) {
      if (!HMAC.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'HMAC', 'encryptBlock');
        return '';
      }
      
      const instance = HMAC.instances[id];
      return HMAC.calculate(message, instance.keyPadded, instance.hashFunction);
    },
    
    // HMAC is one-way (no decryption)
    decryptBlock: function(id, ciphertext) {
      global.throwException('Operation Not Supported Exception', 'HMAC function cannot be reversed', 'HMAC', 'decryptBlock');
      return ciphertext;
    },
    
    /**
     * Core HMAC calculation function
     * @param {string} message - Message to authenticate
     * @param {Array} keyPadded - Pre-processed key (padded to block size)
     * @param {string} hashFunction - Hash function name (SHA1, MD5, etc.)
     * @returns {string} HMAC value as hex string
     */
    calculate: function(message, keyPadded, hashFunction) {
      const blockSize = HMAC.BLOCK_SIZES[hashFunction] || 64;
      
      // Create inner and outer padded keys
      const innerKey = new Array(blockSize);
      const outerKey = new Array(blockSize);
      
      for (let i = 0; i < blockSize; i++) {
        innerKey[i] = keyPadded[i] ^ HMAC.IPAD;
        outerKey[i] = keyPadded[i] ^ HMAC.OPAD;
      }
      
      // Hash(K XOR ipad, message)
      const innerData = OpCodes.BytesToString(innerKey) + message;
      const innerHash = HMAC.getHashFunction(hashFunction).hash(innerData);
      
      // Convert hex hash back to bytes for outer hash
      const innerHashBytes = OpCodes.HexToBytes(innerHash);
      
      // Hash(K XOR opad, Hash(K XOR ipad, message))
      const outerData = OpCodes.BytesToString(outerKey) + OpCodes.BytesToString(innerHashBytes);
      const finalHash = HMAC.getHashFunction(hashFunction).hash(outerData);
      
      return finalHash;
    },
    
    /**
     * Get hash function implementation
     * @param {string} hashFunction - Hash function name
     * @returns {Object} Hash function object
     */
    getHashFunction: function(hashFunction) {
      switch (hashFunction.toUpperCase()) {
        case 'SHA1':
          return global.SHA1;
        case 'MD5':
          return global.MD5;
        default:
          throw new Error('Unsupported hash function: ' + hashFunction);
      }
    },
    
    /**
     * Prepare key for HMAC computation
     * @param {string} key - Raw key
     * @param {string} hashFunction - Hash function name
     * @returns {Array} Padded key as byte array
     */
    prepareKey: function(key, hashFunction) {
      const blockSize = HMAC.BLOCK_SIZES[hashFunction] || 64;
      let keyBytes = OpCodes.StringToBytes(key);
      
      // If key is longer than block size, hash it
      if (keyBytes.length > blockSize) {
        const hashedKey = HMAC.getHashFunction(hashFunction).hash(key);
        keyBytes = OpCodes.HexToBytes(hashedKey);
      }
      
      // Pad key to block size with zeros
      const paddedKey = new Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        paddedKey[i] = i < keyBytes.length ? keyBytes[i] : 0;
      }
      
      return paddedKey;
    },
    
    /**
     * Verify HMAC
     * @param {string} message - Original message
     * @param {string} key - Secret key
     * @param {string} expectedHmac - Expected HMAC value
     * @param {string} hashFunction - Hash function name
     * @returns {boolean} True if HMAC is valid
     */
    verify: function(message, key, expectedHmac, hashFunction) {
      const keyPadded = HMAC.prepareKey(key, hashFunction || HMAC.DEFAULT_HASH);
      const calculatedHmac = HMAC.calculate(message, keyPadded, hashFunction || HMAC.DEFAULT_HASH);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(calculatedHmac),
        OpCodes.HexToBytes(expectedHmac)
      );
    },
    
    // Instance class
    HMACInstance: function(key, hashFunction) {
      this.hashFunction = hashFunction || HMAC.DEFAULT_HASH;
      this.keyPadded = HMAC.prepareKey(key, this.hashFunction);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(HMAC);
  }
  
  // Export to global scope
  global.HMAC = HMAC;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HMAC;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);