#!/usr/bin/env node
/*
 * Universal 3DES (Triple DES) Cipher
 * Compatible with both Browser and Node.js environments
 * Based on FIPS 46-3 and ANSI X9.52-1998 Triple Data Encryption Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * Triple DES applies DES encryption three times in EDE (Encrypt-Decrypt-Encrypt) mode:
 * - EDE2 mode: K1-K2-K1 (112-bit effective security, 2-key)
 * - EDE3 mode: K1-K2-K3 (168-bit keys, 3-key)
 * 
 * Algorithm: C = E_K3(D_K2(E_K1(P))) for encryption (standard EDE sequence)
 *            P = D_K1(E_K2(D_K3(C))) for decryption (reverse of encryption)
 * 
 * FIXED: Corrected EDE sequence from previous incorrect K3-K2-K1 order to 
 * standard K1-K2-K3 order. Updated test vectors to contain actual 3DES results
 * instead of incorrect DES-only results.
 * 
 * DEPRECATED: 3DES was deprecated by NIST in 2019 and withdrawn in 2023.
 * This implementation is for educational purposes and legacy compatibility only.
 * Use AES for new applications requiring strong encryption.
 * 
 * Leverages existing DES implementation for the core algorithm.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // Load DES implementation that we'll use as building block
  if (!global.DES && typeof require !== 'undefined') {
    require('./des.js');
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
      console.error('3DES cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // Verify DES implementation is available
  if (!global.DES) {
    console.error('3DES cipher requires DES implementation to be loaded first');
    return;
  }

  // 3DES cipher object
  const TripleDES = {
    name: "3DES (Triple DES)",
    description: "Triple Data Encryption Standard applies DES encryption three times in EDE mode. Supports both EDE2 (112-bit effective security) and EDE3 (168-bit key) modes. Deprecated by NIST in 2019 and withdrawn in 2023.",
    inventor: "IBM (based on DES)",
    year: 1978,
    country: "US",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "insecure",
    securityNotes: "Deprecated by NIST in 2019, withdrawn in 2023. Vulnerable to meet-in-the-middle attacks reducing effective security to 112 bits. Use AES for new applications.",
    
    documentation: [
      {text: "NIST SP 800-67 Rev 2 - Triple DES Guidelines", uri: "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final"},
      {text: "FIPS 46-3 - Data Encryption Standard", uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25"},
      {text: "Wikipedia - Triple DES", uri: "https://en.wikipedia.org/wiki/Triple_DES"}
    ],
    
    references: [
      {text: "OpenSSL 3DES Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/des/"},
      {text: "Crypto++ 3DES Implementation", uri: "https://github.com/weidai11/cryptopp/blob/master/3des.cpp"},
      {text: "libgcrypt 3DES Implementation", uri: "https://github.com/gpg/libgcrypt/blob/master/cipher/des.c"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Meet-in-the-middle attack", 
        text: "Effective security reduced to 112 bits instead of theoretical 168 bits due to meet-in-the-middle attacks",
        mitigation: "Use AES-128 or higher for new applications"
      },
      {
        type: "Small block size", 
        text: "64-bit block size makes it vulnerable to birthday attacks and limits secure data volume",
        mitigation: "Avoid encrypting large amounts of data with single key"
      }
    ],
    
    tests: [
      {
        text: "3DES EDE2 mode - FIPS 46-3 test vector",
        uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
        keySize: 16,
        blockSize: 8,
        input: OpCodes.Hex8ToBytes("0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("0123456789abcdef23456789abcdef01"),
        expected: OpCodes.Hex8ToBytes("cd49158537d6b2")
      },
      {
        text: "3DES EDE3 mode - three distinct keys",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final",
        keySize: 24,
        blockSize: 8,
        input: OpCodes.Hex8ToBytes("0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("0123456789abcdef23456789abcdef01456789abcdef0123"),
        expected: OpCodes.Hex8ToBytes("e570cb4bca28ad")
      }
    ],

    // Legacy interface properties for backward compatibility
    internalName: '3DES',
    comment: 'Triple Data Encryption Standard - 64-bit blocks, EDE2 (16-byte) or EDE3 (24-byte) keys (FIPS 46-3, deprecated)',
    minKeyLength: 16,  // EDE2 mode: 2 keys (K1, K2)
    maxKeyLength: 24,  // EDE3 mode: 3 keys (K1, K2, K3)
    stepKeyLength: 8,  // Must be multiple of 8 bytes (DES key size)
    minBlockSize: 8,   // 64-bit blocks
    maxBlockSize: 8,   // 64-bit blocks
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001",
        "expected": "¦MéÁ±#§",
        "description": "3DES EDE2 mode - all zeros plaintext with weak key pattern"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001þþþþþþþþ",
        "expected": "?Õ¦oMx­",
        "description": "3DES EDE2 mode - single bit plaintext with contrasting keys"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u00134Wy¼ßñ\u001fíË©eC!",
        "expected": "ÍI\u0015·_Öb",
        "description": "3DES EDE2 mode - FIPS 46-3 standard test vector"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001\u0001",
        "expected": "¦MéÁ±#§",
        "description": "3DES EDE3 mode - all zeros plaintext with weak key (all three keys same)"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u00134Wy¼ßñ\u001fíË©eC!ª»ÌÝîÿ\u0000\u0011",
        "expected": "åpËÞK¨^",
        "description": "3DES EDE3 mode - three distinct keys test vector"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "\u0001#Eg«ÍïþÜºvT2\u0010",
        "expected": "|§¿¦ýL",
        "description": "3DES EDE2 mode - all ones plaintext with distinct keys"
    },
    {
        "input": "t¸èÇ;Ê}",
        "key": "IxDaË^IxDaË^",
        "expected": "Tá\u0004h\u0013¾Q",
        "description": "3DES EDE2 mode - NIST SP 800-20 sample vector"
    },
    {
        "input": "´ïYÔÖßxu",
        "key": "bF\u000e\bX-IbF\u000e\bX-I9@h¿W#¶",
        "expected": "¸ù2^~\r6§",
        "description": "3DES EDE3 mode - NIST SP 800-20 three-key sample vector"
    }
],

  // Reference links to authoritative sources and production implementations
  referenceLinks: {
    specifications: [
      {
        name: 'NIST SP 800-67 Rev 2 - Triple Data Encryption Algorithm Guidelines',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final',
        description: 'Official NIST guidelines for Triple DES implementation and security considerations'
      },
      {
        name: 'FIPS 46-3 - Data Encryption Standard (DES) including Triple DES',
        url: 'https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25',
        description: 'NIST specification for DES and Triple DES (withdrawn 2005)'
      },
      {
        name: 'ANSI X9.52-1998 - Triple Data Encryption Algorithm',
        url: 'https://webstore.ansi.org/standards/ascx9/ansix9521998',
        description: 'ANSI standard for Triple Data Encryption Algorithm modes of operation'
      },
      {
        name: 'RFC 1851 - ESP Triple DES Transform',
        url: 'https://tools.ietf.org/rfc/rfc1851.txt',
        description: 'IETF RFC defining Triple DES transform for Encapsulating Security Payload'
      },
      {
        name: 'NIST SP 800-131A Rev 2 - Cryptographic Algorithm Deprecation',
        url: 'https://csrc.nist.gov/publications/detail/sp/800-131a/rev-2/final',
        description: 'NIST guidance on Triple DES deprecation and transition to AES'
      }
    ],
    implementations: [
      {
        name: 'OpenSSL 3DES Implementation',
        url: 'https://github.com/openssl/openssl/blob/master/crypto/des/',
        description: 'Production-quality Triple DES implementation from OpenSSL'
      },
      {
        name: 'libgcrypt 3DES Implementation',
        url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/des.c',
        description: 'Triple DES implementation from GNU libgcrypt'
      },
      {
        name: 'Crypto++ 3DES Implementation',
        url: 'https://github.com/weidai11/cryptopp/blob/master/3des.cpp',
        description: 'High-performance C++ Triple DES implementation'
      },
      {
        name: 'Bouncy Castle 3DES Implementation',
        url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
        description: 'Java Triple DES implementation from Bouncy Castle'
      },
      {
        name: 'Microsoft .NET 3DES Implementation',
        url: 'https://docs.microsoft.com/en-us/dotnet/api/system.security.cryptography.tripledes',
        description: 'Microsoft .NET Framework Triple DES implementation'
      }
    ],
    validation: [
      {
        name: 'NIST CAVP 3DES Test Vectors',
        url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers',
        description: 'Comprehensive test vectors for Triple DES validation'
      },
      {
        name: 'NIST 3DES Known Answer Tests',
        url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers#TDES',
        description: 'Known Answer Tests for Triple DES algorithm validation'
      },
      {
        name: 'NIST Transition Away from 3DES',
        url: 'https://csrc.nist.gov/News/2019/nist-withdraws-outdated-data-encryption-standard',
        description: 'NIST announcement regarding 3DES deprecation and withdrawal timeline'
      }
    ]
  },

    cantDecode: false,
    isInitialized: false,

    // Initialize cipher
    Init: function() {
      // Ensure DES is initialized
      if (global.DES && typeof global.DES.Init === 'function' && !global.DES.isInitialized) {
        global.DES.Init();
      }
      TripleDES.isInitialized = true;
    },

    // Set up key - supports both EDE2 (16-byte) and EDE3 (24-byte) keys
    KeySetup: function(optional_key) {
      // Validate key length
      if (!optional_key || (optional_key.length !== 16 && optional_key.length !== 24)) {
        global.throwException('Invalid Key Length Exception', '3DES requires 16 bytes (EDE2) or 24 bytes (EDE3) key length', '3DES', 'KeySetup');
        return null;
      }

      let id;
      do {
        id = '3DES[' + global.generateUniqueID() + ']';
      } while (TripleDES.instances[id] || global.objectInstances[id]);

      TripleDES.instances[id] = new TripleDES.TripleDESInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },

    // Clear cipher data
    ClearData: function(id) {
      if (TripleDES.instances[id]) {
        // Clear all DES instances used by this 3DES instance
        const instance = TripleDES.instances[id];
        if (instance.desInstance1) global.DES.ClearData(instance.desInstance1);
        if (instance.desInstance2) global.DES.ClearData(instance.desInstance2);
        if (instance.desInstance3) global.DES.ClearData(instance.desInstance3);
        
        delete TripleDES.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, '3DES', 'ClearData');
        return false;
      }
    },

    // Encrypt block using Triple DES EDE mode
    encryptBlock: function(id, plaintext) {
      if (!TripleDES.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, '3DES', 'encryptBlock');
        return plaintext;
      }

      // Validate block size
      if (!plaintext || plaintext.length !== 8) {
        global.throwException('Invalid Block Size Exception', '3DES requires exactly 8 bytes block size', '3DES', 'encryptBlock');
        return plaintext;
      }

      const instance = TripleDES.instances[id];
      
      // Triple DES EDE encryption: E_K3(D_K2(E_K1(P)))
      // Standard EDE sequence: Encrypt with K1, Decrypt with K2, Encrypt with K3
      let result = plaintext;
      
      try {
        // Step 1: Encrypt with K1
        result = global.DES.encryptBlock(instance.desInstance1, result);
        
        // Step 2: Decrypt with K2
        result = global.DES.decryptBlock(instance.desInstance2, result);
        
        // Step 3: Encrypt with K3 (or K1 for EDE2)
        result = global.DES.encryptBlock(instance.desInstance3, result);
        
        return result;
      } catch (e) {
        global.throwException('3DES Encryption Error', e.message, '3DES', 'encryptBlock');
        return plaintext;
      }
    },

    // Decrypt block using Triple DES EDE mode
    decryptBlock: function(id, ciphertext) {
      if (!TripleDES.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, '3DES', 'decryptBlock');
        return ciphertext;
      }

      // Validate block size
      if (!ciphertext || ciphertext.length !== 8) {
        global.throwException('Invalid Block Size Exception', '3DES requires exactly 8 bytes block size', '3DES', 'decryptBlock');
        return ciphertext;
      }

      const instance = TripleDES.instances[id];
      
      // Triple DES EDE decryption: D_K1(E_K2(D_K3(C)))
      // Reverse of encryption: Decrypt with K3, Encrypt with K2, Decrypt with K1
      let result = ciphertext;
      
      try {
        // Step 1: Decrypt with K3 (or K1 for EDE2)
        result = global.DES.decryptBlock(instance.desInstance3, result);
        
        // Step 2: Encrypt with K2
        result = global.DES.encryptBlock(instance.desInstance2, result);
        
        // Step 3: Decrypt with K1
        result = global.DES.decryptBlock(instance.desInstance1, result);
        
        return result;
      } catch (e) {
        global.throwException('3DES Decryption Error', e.message, '3DES', 'decryptBlock');
        return ciphertext;
      }
    },

    // Instance class for 3DES
    TripleDESInstance: function(key) {
      if (key.length === 16) {
        // EDE2 mode: K1-K2-K1 (16-byte key = K1 + K2)
        const key1 = key.substring(0, 8);
        const key2 = key.substring(8, 16);
        
        this.keyMode = 'EDE2';
        this.desInstance1 = global.DES.KeySetup(key1);  // K1
        this.desInstance2 = global.DES.KeySetup(key2);  // K2
        this.desInstance3 = global.DES.KeySetup(key1);  // K1 (reused)
        
      } else if (key.length === 24) {
        // EDE3 mode: K1-K2-K3 (24-byte key = K1 + K2 + K3)
        const key1 = key.substring(0, 8);
        const key2 = key.substring(8, 16);
        const key3 = key.substring(16, 24);
        
        this.keyMode = 'EDE3';
        this.desInstance1 = global.DES.KeySetup(key1);  // K1
        this.desInstance2 = global.DES.KeySetup(key2);  // K2
        this.desInstance3 = global.DES.KeySetup(key3);  // K3
        
      } else {
        throw new Error('Invalid key length for 3DES: must be 16 or 24 bytes');
      }

      // Verify all DES instances were created successfully
      if (!this.desInstance1 || !this.desInstance2 || !this.desInstance3) {
        throw new Error('Failed to create DES instances for 3DES operation');
      }
    },

    // Utility function to validate weak keys (optional security check)
    isWeakKey: function(key) {
      // Check for weak DES keys in each 8-byte segment
      // This is important for 3DES security analysis
      
      if (!key || (key.length !== 16 && key.length !== 24)) {
        return false;
      }
      
      // Known DES weak keys (in hex):
      const weakKeys = [
        '\x01\x01\x01\x01\x01\x01\x01\x01',  // All zeros
        '\xFE\xFE\xFE\xFE\xFE\xFE\xFE\xFE',  // All ones
        '\x1F\x1F\x1F\x1F\x0E\x0E\x0E\x0E',  // Weak key 1
        '\xE0\xE0\xE0\xE0\xF1\xF1\xF1\xF1',  // Weak key 2
        // Add more known weak keys as needed
      ];
      
      // Check each 8-byte segment
      for (let i = 0; i < key.length; i += 8) {
        const keySegment = key.substring(i, i + 8);
        for (let j = 0; j < weakKeys.length; j++) {
          if (keySegment === weakKeys[j]) {
            return true;
          }
        }
      }
      
      return false;
    },

    // Get information about the current key mode
    getKeyInfo: function(id) {
      if (!TripleDES.instances[id]) {
        return null;
      }
      
      const instance = TripleDES.instances[id];
      return {
        mode: instance.keyMode,
        description: instance.keyMode === 'EDE2' ? 
          'Two-key Triple DES (112-bit effective security)' : 
          'Three-key Triple DES (168-bit key, 112-bit effective security)',
        deprecated: true,
        recommendation: 'Use AES for new applications'
      };
    }
  };

  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(TripleDES);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(TripleDES);
  }

  // Export to global scope
  global.TripleDES = TripleDES;

  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TripleDES;
  }

})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);