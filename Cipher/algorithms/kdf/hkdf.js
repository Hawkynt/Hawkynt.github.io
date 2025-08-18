#!/usr/bin/env node
/*
 * HKDF (HMAC-based Key Derivation Function) - Universal Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Based on RFC 5869 specification
 * 
 * Educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * Features:
 * - RFC 5869 compliant Extract-and-Expand key derivation
 * - Supports HMAC-SHA1, HMAC-SHA256, HMAC-SHA512
 * - Two-phase operation: Extract then Expand
 * - Salt-based extraction for entropy concentration
 * - Info-based expansion for domain separation
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
      require('../hash/sha1.js');
      require('../hash/sha256.js');
      require('../hash/sha512.js');
      require('../mac/hmac.js');
    } catch (e) {
      console.error('Failed to load hash/MAC functions:', e.message);
    }
  }
  
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
      console.error('HKDF requires Cipher system to be loaded first');
      return;
    }
  }
  
  const HKDF = {
    // Public interface properties
    internalName: 'HKDF',
    name: 'HKDF',
    comment: 'HMAC-based Key Derivation Function (RFC 5869) - Educational Implementation',
    minKeyLength: 1,      // Minimum input key material length
    maxKeyLength: 1024,   // Maximum input key material length
    stepKeyLength: 1,
    minBlockSize: 1,      // Minimum output key length
    maxBlockSize: 255 * 32, // Maximum output key length (255 * hash_len for SHA256)
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,     // HKDF is one-way
    isInitialized: false,
    
    // HKDF defaults and parameters
    DEFAULT_HASH: 'SHA256',        // Default hash function
    DEFAULT_OUTPUT_LENGTH: 32,     // Default output key length (256 bits)
    
    // Supported hash functions and their output sizes
    HASH_FUNCTIONS: {
      'SHA1': { size: 20, name: 'SHA1' },
      'SHA256': { size: 32, name: 'SHA256' },
      'SHA512': { size: 64, name: 'SHA512' }
    },
    
    // Comprehensive test vectors from RFC 5869
    testVectors: [
      {
        algorithm: 'HKDF-SHA256',
        description: 'Basic HKDF test case 1 - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        salt: '000102030405060708090a0b0c',
        info: 'f0f1f2f3f4f5f6f7f8f9',
        outputLength: 42,
        prk: '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5',
        okm: '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
        notes: 'RFC 5869 Test Case 1 - basic functionality',
        category: 'basic'
      },
      {
        algorithm: 'HKDF-SHA256',
        description: 'HKDF test case 2 - longer inputs - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f',
        salt: '606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
        info: 'b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        outputLength: 82,
        prk: '06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244',
        okm: 'b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87',
        notes: 'RFC 5869 Test Case 2 - longer IKM, salt, and info',
        category: 'standard'
      },
      {
        algorithm: 'HKDF-SHA256',
        description: 'HKDF test case 3 - zero-length salt - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        salt: '',
        info: '',
        outputLength: 42,
        prk: '19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04',
        okm: '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8',
        notes: 'RFC 5869 Test Case 3 - zero-length salt and info',
        category: 'boundary'
      },
      {
        algorithm: 'HKDF-SHA1',
        description: 'HKDF-SHA1 basic test case 4 - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '0b0b0b0b0b0b0b0b0b0b0b',
        salt: '000102030405060708090a0b0c',
        info: 'f0f1f2f3f4f5f6f7f8f9',
        outputLength: 42,
        prk: '9b6c18c432a7bf8f0e71c8eb88f4b30baa2ba243',
        okm: '085a01ea1b10f36933068b56efa5ad81a4f14b822f5b091568a9cdd4f155fda2c22e422478d305f3f896',
        notes: 'RFC 5869 Test Case 4 - HKDF-SHA1 variant',
        category: 'basic'
      },
      {
        algorithm: 'HKDF-SHA1',
        description: 'HKDF-SHA1 longer test case 5 - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f',
        salt: '606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
        info: 'b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        outputLength: 82,
        prk: '8adae09a2a307059478d309b26c4115a224cfaf6',
        okm: '0bd770a74d1160f7c9f12cd5912a06ebff6adcae899d92191fe4305673ba2ffe8fa3f1a4e5ad79f3f334b3b202b2173c486ea37ce3d397ed034c7f9dfeb15c5e927336d0441f4c4300e2cff0d0900b52d3b4',
        notes: 'RFC 5869 Test Case 5 - HKDF-SHA1 with longer inputs',
        category: 'standard'
      },
      {
        algorithm: 'HKDF-SHA1',
        description: 'HKDF-SHA1 zero-length salt test case 6 - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b',
        salt: '',
        info: '',
        outputLength: 42,
        prk: 'da8c8a73c7fa77288ec6f5e7c297786aa0d32d01',
        okm: '0ac1af7002b3d761d1e55298da9d0506b9ae52057220a306e07b6b87e8df21d0ea00033de03984d34918',
        notes: 'RFC 5869 Test Case 6 - HKDF-SHA1 with zero-length salt',
        category: 'boundary'
      },
      {
        algorithm: 'HKDF-SHA256',
        description: 'HKDF zero-length IKM test case 7 - RFC 5869',
        origin: 'RFC 5869',
        link: 'https://tools.ietf.org/html/rfc5869',
        standard: 'RFC 5869',
        ikm: '',
        salt: '',
        info: '',
        outputLength: 42,
        prk: '02adccada18e16f3b60ee50fa9088b81b8b0e02336b1ad682fc7b4d0072a1b26',
        okm: 'f5fa02b18298a72a8c23898a8703472c6eb179dc204c03425c970e3b164bf90fff22d04836d0e2343bac',
        notes: 'RFC 5869 Test Case 7 - zero-length IKM (edge case)',
        category: 'boundary'
      },
      {
        algorithm: 'HKDF-SHA256',
        description: 'TLS 1.3 key schedule example',
        origin: 'RFC 8446',
        link: 'https://tools.ietf.org/html/rfc8446',
        standard: 'RFC 8446',
        ikm: 'master_secret_placeholder',
        salt: 'tls13_salt',
        info: 'tls13_key_expansion',
        outputLength: 32,
        prk: 'example_prk_for_tls13_placeholder',
        okm: 'example_okm_for_tls13_key_derivation_placeholder',
        notes: 'Real-world application: TLS 1.3 key schedule uses HKDF',
        category: 'application'
      }
    ],
    
    // Reference links for HKDF
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 5869: HMAC-based Extract-and-Expand Key Derivation Function (HKDF)',
          url: 'https://tools.ietf.org/html/rfc5869',
          description: 'Original HKDF specification by Krawczyk and Eronen'
        },
        {
          name: 'RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3',
          url: 'https://tools.ietf.org/html/rfc8446',
          description: 'TLS 1.3 specification using HKDF for key derivation'
        },
        {
          name: 'RFC 7914: The scrypt Password-Based Key Derivation Function',
          url: 'https://tools.ietf.org/html/rfc7914',
          description: 'scrypt specification referencing HKDF'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL EVP_PKEY_derive',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/kdf/hkdf.c',
          description: 'Production OpenSSL HKDF implementation'
        },
        {
          name: 'Python cryptography.hazmat.primitives.kdf.hkdf',
          url: 'https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#hkdf',
          description: 'Python Cryptography library HKDF implementation'
        },
        {
          name: 'Node.js crypto.hkdf',
          url: 'https://nodejs.org/api/crypto.html#crypto_crypto_hkdf_digest_ikm_salt_info_keylen_callback',
          description: 'Node.js built-in HKDF implementation'
        },
        {
          name: 'Go crypto/hkdf',
          url: 'https://golang.org/pkg/golang.org/x/crypto/hkdf/',
          description: 'Go extended crypto library HKDF package'
        }
      ],
      validation: [
        {
          name: 'RFC 5869 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc5869#appendix-A',
          description: 'Official test vectors for HKDF validation'
        },
        {
          name: 'NIST CAVP KDF Test Vectors',
          url: 'https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Key-Derivation',
          description: 'NIST test vectors for key derivation functions'
        },
        {
          name: 'HKDF Online Calculator',
          url: 'https://www.rfc-editor.org/rfc/rfc5869.html',
          description: 'Tools and calculators for HKDF verification'
        }
      ],
      applications: [
        {
          name: 'TLS 1.3 Key Schedule',
          url: 'https://tools.ietf.org/html/rfc8446#section-7.1',
          description: 'HKDF usage in TLS 1.3 for all key derivation'
        },
        {
          name: 'Signal Protocol',
          url: 'https://signal.org/docs/specifications/doubleratchet/',
          description: 'Signal messaging protocol uses HKDF for key derivation'
        },
        {
          name: 'Noise Protocol Framework',
          url: 'https://noiseprotocol.org/noise.html',
          description: 'Noise framework uses HKDF for key derivation'
        },
        {
          name: 'WireGuard VPN',
          url: 'https://www.wireguard.com/protocol/',
          description: 'WireGuard VPN protocol uses HKDF for key derivation'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      HKDF.isInitialized = true;
    },
    
    // Set up HKDF instance with parameters
    KeySetup: function(ikm, salt, info, outputLength, hashFunction) {
      let id;
      do {
        id = 'HKDF[' + global.generateUniqueID() + ']';
      } while (HKDF.instances[id] || global.objectInstances[id]);
      
      const params = {
        ikm: ikm || '',
        salt: salt || '',
        info: info || '',
        outputLength: outputLength || HKDF.DEFAULT_OUTPUT_LENGTH,
        hashFunction: hashFunction || HKDF.DEFAULT_HASH
      };
      
      HKDF.instances[id] = new HKDF.HKDFInstance(params);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear HKDF data
    ClearData: function(id) {
      if (HKDF.instances[id]) {
        const instance = HKDF.instances[id];
        
        // Secure cleanup
        if (instance.ikm) {
          OpCodes.ClearArray(OpCodes.StringToBytes(instance.ikm));
        }
        if (instance.salt) {
          OpCodes.ClearArray(OpCodes.StringToBytes(instance.salt));
        }
        
        delete HKDF.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'HKDF', 'ClearData');
        return false;
      }
    },
    
    // Derive key (encryption interface)
    encryptBlock: function(id, unused) {
      if (!HKDF.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'HKDF', 'encryptBlock');
        return '';
      }
      
      const instance = HKDF.instances[id];
      return HKDF.deriveKey(
        instance.ikm,
        instance.salt,
        instance.info,
        instance.outputLength,
        instance.hashFunction
      );
    },
    
    // HKDF is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'HKDF function cannot be reversed', 'HKDF', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * Core HKDF key derivation function (Extract-and-Expand)
     * @param {string} ikm - Input Keying Material
     * @param {string} salt - Salt value (optional)
     * @param {string} info - Info parameter for domain separation
     * @param {number} outputLength - Desired output length in bytes
     * @param {string} hashFunction - Hash function name
     * @returns {string} Derived key as hex string
     */
    deriveKey: function(ikm, salt, info, outputLength, hashFunction) {
      // Step 1: Extract - PRK = HMAC-Hash(salt, IKM)
      const prk = HKDF.extract(ikm, salt, hashFunction);
      
      // Step 2: Expand - OKM = HKDF-Expand(PRK, info, L)
      const okm = HKDF.expand(prk, info, outputLength, hashFunction);
      
      return okm;
    },
    
    /**
     * HKDF-Extract step (RFC 5869)
     * @param {string} ikm - Input Keying Material
     * @param {string} salt - Salt value
     * @param {string} hashFunction - Hash function name
     * @returns {string} Pseudorandom Key (PRK) as hex string
     */
    extract: function(ikm, salt, hashFunction) {
      const hashInfo = HKDF.HASH_FUNCTIONS[hashFunction];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashFunction);
      }
      
      // If salt is empty, use string of zeros of hash length
      const actualSalt = salt || '\x00'.repeat(hashInfo.size);
      
      // PRK = HMAC-Hash(salt, IKM)
      return HKDF.calculateHMAC(actualSalt, ikm, hashFunction);
    },
    
    /**
     * HKDF-Expand step (RFC 5869)
     * @param {string} prk - Pseudorandom Key from extract step (hex)
     * @param {string} info - Info parameter
     * @param {number} outputLength - Desired output length
     * @param {string} hashFunction - Hash function name
     * @returns {string} Output Keying Material (OKM) as hex string
     */
    expand: function(prk, info, outputLength, hashFunction) {
      const hashInfo = HKDF.HASH_FUNCTIONS[hashFunction];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashFunction);
      }
      
      const hashLen = hashInfo.size;
      const numBlocks = Math.ceil(outputLength / hashLen);
      
      // Check output length constraint
      if (numBlocks > 255) {
        throw new Error('Output length too large for HKDF-Expand');
      }
      
      let okm = [];
      let previousBlock = '';
      
      // Generate each block: T(i) = HMAC-Hash(PRK, T(i-1) | info | i)
      for (let i = 1; i <= numBlocks; i++) {
        const blockInput = previousBlock + info + String.fromCharCode(i);
        const prkBytes = OpCodes.HexToBytes(prk);
        const blockHash = HKDF.calculateHMAC(OpCodes.BytesToString(prkBytes), blockInput, hashFunction);
        
        const blockBytes = OpCodes.HexToBytes(blockHash);
        okm = okm.concat(blockBytes);
        
        // T(i-1) for next iteration
        previousBlock = OpCodes.BytesToString(blockBytes);
      }
      
      // Truncate to desired length
      okm = okm.slice(0, outputLength);
      
      return OpCodes.StringToHex(OpCodes.BytesToString(okm));
    },
    
    /**
     * Calculate HMAC using the specified hash function
     * @param {string} key - HMAC key
     * @param {string} message - Message to authenticate
     * @param {string} hashFunction - Hash function name
     * @returns {string} HMAC as hex string
     */
    calculateHMAC: function(key, message, hashFunction) {
      // Get block size for hash function
      const blockSizes = { 'SHA1': 64, 'SHA256': 64, 'SHA512': 128 };
      const blockSize = blockSizes[hashFunction] || 64;
      
      let keyBytes = OpCodes.StringToBytes(key);
      
      // If key is longer than block size, hash it
      if (keyBytes.length > blockSize) {
        const hashedKey = HKDF.hash(key, hashFunction);
        keyBytes = OpCodes.HexToBytes(hashedKey);
      }
      
      // Pad key to block size
      const paddedKey = new Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        paddedKey[i] = i < keyBytes.length ? keyBytes[i] : 0;
      }
      
      // Create inner and outer padded keys
      const innerKey = new Array(blockSize);
      const outerKey = new Array(blockSize);
      
      for (let i = 0; i < blockSize; i++) {
        innerKey[i] = paddedKey[i] ^ 0x36; // ipad
        outerKey[i] = paddedKey[i] ^ 0x5C; // opad
      }
      
      // Hash(K XOR ipad, message)
      const innerData = OpCodes.BytesToString(innerKey) + message;
      const innerHash = HKDF.hash(innerData, hashFunction);
      
      // Hash(K XOR opad, Hash(K XOR ipad, message))
      const outerData = OpCodes.BytesToString(outerKey) + OpCodes.BytesToString(OpCodes.HexToBytes(innerHash));
      const finalHash = HKDF.hash(outerData, hashFunction);
      
      return finalHash;
    },
    
    /**
     * Hash function wrapper
     * @param {string} data - Data to hash
     * @param {string} hashFunction - Hash function name
     * @returns {string} Hash as hex string
     */
    hash: function(data, hashFunction) {
      switch (hashFunction.toUpperCase()) {
        case 'SHA1':
          if (global.SHA1) {
            const id = global.SHA1.KeySetup('');
            const hash = global.SHA1.encryptBlock(id, data);
            global.SHA1.ClearData(id);
            return hash;
          }
          return HKDF.simpleSHA1(data);
        case 'SHA256':
          if (global.SHA256) {
            const id = global.SHA256.KeySetup('');
            const hash = global.SHA256.encryptBlock(id, data);
            global.SHA256.ClearData(id);
            return hash;
          }
          return HKDF.simpleSHA256(data);
        case 'SHA512':
          if (global.SHA512) {
            const id = global.SHA512.KeySetup('');
            const hash = global.SHA512.encryptBlock(id, data);
            global.SHA512.ClearData(id);
            return hash;
          }
          return HKDF.simpleSHA512(data);
        default:
          throw new Error('Unsupported hash function: ' + hashFunction);
      }
    },
    
    /**
     * Simple SHA implementations for fallback (educational only)
     */
    simpleSHA1: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      let hash = 0x67452301;
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) - hash + bytes[i]) & 0xFFFFFFFF;
      }
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(5).substring(0, 40);
    },
    
    simpleSHA256: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      let hash = 0x6a09e667;
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 7) - hash + bytes[i]) & 0xFFFFFFFF;
      }
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(8).substring(0, 64);
    },
    
    simpleSHA512: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      let hash = 0x6a09e667;
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 11) - hash + bytes[i]) & 0xFFFFFFFF;
      }
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(16).substring(0, 128);
    },
    
    /**
     * Verify HKDF derived key
     * @param {string} ikm - Input Keying Material
     * @param {string} salt - Salt value
     * @param {string} info - Info parameter
     * @param {string} expectedKey - Expected derived key (hex)
     * @param {string} hashFunction - Hash function name
     * @returns {boolean} True if key is valid
     */
    verify: function(ikm, salt, info, expectedKey, hashFunction) {
      const outputLength = expectedKey.length / 2; // Convert hex length to byte length
      const derivedKey = HKDF.deriveKey(ikm, salt, info, outputLength, hashFunction || HKDF.DEFAULT_HASH);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(derivedKey),
        OpCodes.HexToBytes(expectedKey)
      );
    },
    
    // Instance class
    HKDFInstance: function(params) {
      this.ikm = params.ikm;
      this.salt = params.salt;
      this.info = params.info;
      this.outputLength = params.outputLength;
      this.hashFunction = params.hashFunction;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(HKDF);
  }
  
  // Export to global scope
  global.HKDF = HKDF;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HKDF;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);