/*
 * Universal Rijndael (AES) Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on original rijndael.js but modernized for cross-platform use
 * (c)2006-2025 Hawkynt
 * 
 * Supports AES-128, AES-192, and AES-256 encryption/decryption
 * Follows FIPS 197 specification for Advanced Encryption Standard
 * 
 * Educational implementation - not for production use
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Rijndael cipher requires OpCodes library to be loaded first');
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
      console.error('Rijndael cipher requires Cipher system to be loaded first');
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
  
  // Create Rijndael cipher object
  const Rijndael = {
    name: "Rijndael (AES)",
    description: "The Advanced Encryption Standard, selected by NIST in 2001. Supports 128/192/256-bit keys with 128-bit blocks and 10/12/14 rounds respectively. Widely used and thoroughly analyzed.",
    inventor: "Joan Daemen and Vincent Rijmen",
    year: 1998,
    country: "BE",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: null,
    securityNotes: "Current NIST standard for symmetric encryption. Extensively analyzed and considered secure for current applications.",
    
    documentation: [
      {text: "FIPS 197 - Advanced Encryption Standard (AES)", uri: "https://csrc.nist.gov/publications/detail/fips/197/final"},
      {text: "NIST SP 800-38A - Block Cipher Modes of Operation", uri: "https://csrc.nist.gov/publications/detail/sp/800-38a/final"},
      {text: "RFC 3268 - AES Ciphersuites for TLS", uri: "https://tools.ietf.org/rfc/rfc3268.txt"}
    ],
    
    references: [
      {text: "OpenSSL AES Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/aes/"},
      {text: "Mbed TLS AES Implementation", uri: "https://github.com/Mbed-TLS/mbedtls/tree/development/library/aes.c"},
      {text: "libgcrypt Rijndael Implementation", uri: "https://github.com/gpg/libgcrypt/blob/master/cipher/rijndael.c"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "FIPS 197 AES-128 Test Vector",
        uri: "https://csrc.nist.gov/publications/detail/fips/197/final",
        keySize: 16,
        blockSize: 16,
        input: Hex8ToBytes("3243f6a8885a308d313198a2e0370734"),
        key: Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: Hex8ToBytes("3925841d02dc09fbdc1185971969a0b32")
      },
      {
        text: "NIST SP 800-38A AES-192 Test Vector", 
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38a/final",
        keySize: 24,
        blockSize: 16,
        input: Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: Hex8ToBytes("8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b"),
        expected: Hex8ToBytes("bd334f1d6e45f25ff712a214571fa5cc")
      },
      {
        text: "NIST SP 800-38A AES-256 Test Vector",
        uri: "https://csrc.nist.gov/publications/detail/sp/800-38a/final",
        keySize: 32, 
        blockSize: 16,
        input: Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: Hex8ToBytes("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4"),
        expected: Hex8ToBytes("f3eed1bdb5d2a03c064b5a7e3db181f8")
      }
    ],
    
    // Public interface properties
    internalName: 'Rijndael',
    comment: 'Advanced Encryption Standard - Rijndael cipher supporting 128/192/256-bit keys (FIPS 197)',
    minKeyLength: 16,
    maxKeyLength: 32,
    stepKeyLength: 8,
    minBlockSize: 16,
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // AES Constants
    // Number of rounds for different key sizes: [Nk][Nb] where Nk=key words, Nb=block words
    ROUNDS_TABLE: [
      [0, 0, 0, 0, 0], // Nk=0 (unused)
      [0, 0, 0, 0, 0], // Nk=1 (unused)  
      [0, 0, 0, 0, 0], // Nk=2 (unused)
      [0, 0, 0, 0, 0], // Nk=3 (unused)
      [0, 0, 0, 0, 10], // Nk=4 (128-bit key): 10 rounds, Nb=4
      [0, 0, 0, 0, 0], // Nk=5 (unused)
      [0, 0, 0, 0, 12], // Nk=6 (192-bit key): 12 rounds, Nb=4
      [0, 0, 0, 0, 0], // Nk=7 (unused)
      [0, 0, 0, 0, 14]  // Nk=8 (256-bit key): 14 rounds, Nb=4
    ],
    
    // ShiftRows offset table: [Nb][row]
    SHIFT_OFFSETS: [
         0,  0,  0,  0,
      [  0,  1,  2,  3],  0,
      [  0,  1,  2,  3],  0,
      [  0,  1,  3,  4]
    ],
    
    // Round constants for key expansion
    RCON: [ 
      0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 
      0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 
      0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 
      0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 
      0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91
    ],
    
    // AES S-Box (Substitution box)
    SBOX: [
       99, 124, 119, 123, 242, 107, 111, 197,  48,   1, 103,  43, 254, 215, 171, 
      118, 202, 130, 201, 125, 250,  89,  71, 240, 173, 212, 162, 175, 156, 164, 
      114, 192, 183, 253, 147,  38,  54,  63, 247, 204,  52, 165, 229, 241, 113, 
      216,  49,  21,   4, 199,  35, 195,  24, 150,   5, 154,   7,  18, 128, 226, 
      235,  39, 178, 117,   9, 131,  44,  26,  27, 110,  90, 160,  82,  59, 214, 
      179,  41, 227,  47, 132,  83, 209,   0, 237,  32, 252, 177,  91, 106, 203, 
      190,  57,  74,  76,  88, 207, 208, 239, 170, 251,  67,  77,  51, 133,  69, 
      249,   2, 127,  80,  60, 159, 168,  81, 163,  64, 143, 146, 157,  56, 245, 
      188, 182, 218,  33,  16, 255, 243, 210, 205,  12,  19, 236,  95, 151,  68,  
       23, 196, 167, 126,  61, 100,  93,  25, 115,  96, 129,  79, 220,  34,  42, 
      144, 136,  70, 238, 184,  20, 222,  94,  11, 219, 224,  50,  58,  10,  73,
        6,  36,  92, 194, 211, 172,  98, 145, 149, 228, 121, 231, 200,  55, 109, 
      141, 213,  78, 169, 108,  86, 244, 234, 101, 122, 174,   8, 186, 120,  37,  
       46,  28, 166, 180, 198, 232, 221, 116,  31,  75, 189, 139, 138, 112,  62, 
      181, 102,  72,   3, 246,  14,  97,  53,  87, 185, 134, 193,  29, 158, 225,
      248, 152,  17, 105, 217, 142, 148, 155,  30, 135, 233, 206,  85,  40, 223,
      140, 161, 137,  13, 191, 230,  66, 104,  65, 153,  45,  15, 176,  84, 187,  
       22
    ],
    
    // AES Inverse S-Box
    SBOX_INV: [
       82,   9, 106, 213,  48,  54, 165,  56, 191,  64, 163, 158, 129, 243, 215, 
      251, 124, 227,  57, 130, 155,  47, 255, 135,  52, 142,  67,  68, 196, 222, 
      233, 203,  84, 123, 148,  50, 166, 194,  35,  61, 238,  76, 149,  11,  66, 
      250, 195,  78,   8,  46, 161, 102,  40, 217,  36, 178, 118,  91, 162,  73, 
      109, 139, 209,  37, 114, 248, 246, 100, 134, 104, 152,  22, 212, 164,  92, 
      204,  93, 101, 182, 146, 108, 112,  72,  80, 253, 237, 185, 218,  94,  21,  
       70,  87, 167, 141, 157, 132, 144, 216, 171,   0, 140, 188, 211,  10, 247, 
      228,  88,   5, 184, 179,  69,   6, 208,  44,  30, 143, 202,  63,  15,   2, 
      193, 175, 189,   3,   1,  19, 138, 107,  58, 145,  17,  65,  79, 103, 220, 
      234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116,  34, 231, 173,
       53, 133, 226, 249,  55, 232,  28, 117, 223, 110,  71, 241,  26, 113,  29, 
       41, 197, 137, 111, 183,  98,  14, 170,  24, 190,  27, 252,  86,  62,  75, 
      198, 210, 121,  32, 154, 219, 192, 254, 120, 205,  90, 244,  31, 221, 168,
       51, 136,   7, 199,  49, 177,  18,  16,  89,  39, 128, 236,  95,  96,  81,
      127, 169,  25, 181,  74,  13,  45, 229, 122, 159, 147, 201, 156, 239, 160,
      224,  59,  77, 174,  42, 245, 176, 200, 235, 187,  60, 131,  83, 153,  97, 
       23,  43,   4, 126, 186, 119, 214,  38, 225, 105,  20,  99,  85,  33,  12,
      125
    ],
    
    // Legacy test vectors for compatibility
    testVectors: [
      // FIPS 197 AES-128 official test vector
      {
        algorithm: 'AES-128',
        description: 'FIPS 197 AES-128 ECB mode encryption (Appendix B)',
        origin: 'NIST FIPS 197, Appendix B - Example Vectors',
        link: 'https://csrc.nist.gov/publications/detail/fips/197/final',
        standard: 'FIPS 197',
        mode: 'ECB',
        keySize: 128,
        key: '\x2b\x7e\x15\x16\x28\xae\xd2\xa6\xab\xf7\x15\x88\x09\xcf\x4f\x3c',
        keyHex: '2b7e151628aed2a6abf7158809cf4f3c',
        plaintext: '\x32\x43\xf6\xa8\x88\x5a\x30\x8d\x31\x31\x98\xa2\xe0\x37\x07\x34',
        plaintextHex: '3243f6a8885a308d313198a2e0370734',
        ciphertext: '\x39\x25\x84\x1d\x02\xdc\x09\xfb\xdc\x11\x85\x97\x19\x6a\x0b\x32',
        ciphertextHex: '3925841d02dc09fbdc1185971969a0b32',
        notes: 'Official FIPS 197 test vector demonstrating basic AES-128 operation',
        category: 'official-standard'
      },
      // NIST SP 800-38A AES-192 test vector
      {
        algorithm: 'AES-192',
        description: 'NIST SP 800-38A AES-192 ECB mode encryption',
        origin: 'NIST SP 800-38A, Appendix F.1.3',
        link: 'https://csrc.nist.gov/publications/detail/sp/800-38a/final',
        standard: 'NIST SP 800-38A',
        mode: 'ECB',
        keySize: 192,
        key: '\x8e\x73\xb0\xf7\xda\x0e\x64\x52\xc8\x10\xf3\x2b\x80\x90\x79\xe5\x62\xf8\xea\xd2\x52\x2c\x6b\x7b',
        keyHex: '8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b',
        plaintext: '\x6b\xc1\xbe\xe2\x2e\x40\x9f\x96\xe9\x3d\x7e\x11\x73\x93\x17\x2a',
        plaintextHex: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext: '\xbd\x33\x4f\x1d\x6e\x45\xf2\x5f\xf7\x12\xa2\x14\x57\x1f\xa5\xcc',
        ciphertextHex: 'bd334f1d6e45f25ff712a214571fa5cc',
        notes: 'NIST standard test vector for AES-192 demonstrating 192-bit key operation',
        category: 'official-standard'
      },
      // NIST SP 800-38A AES-256 test vector
      {
        algorithm: 'AES-256',
        description: 'NIST SP 800-38A AES-256 ECB mode encryption',
        origin: 'NIST SP 800-38A, Appendix F.1.5',
        link: 'https://csrc.nist.gov/publications/detail/sp/800-38a/final',
        standard: 'NIST SP 800-38A',
        mode: 'ECB',
        keySize: 256,
        key: '\x60\x3d\xeb\x10\x15\xca\x71\xbe\x2b\x73\xae\xf0\x85\x7d\x77\x81\x1f\x35\x2c\x07\x3b\x61\x08\xd7\x2d\x98\x10\xa3\x09\x14\xdf\xf4',
        keyHex: '603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4',
        plaintext: '\x6b\xc1\xbe\xe2\x2e\x40\x9f\x96\xe9\x3d\x7e\x11\x73\x93\x17\x2a',
        plaintextHex: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext: '\xf3\xee\xd1\xbd\xb5\xd2\xa0\x3c\x06\x4b\x5a\x7e\x3d\xb1\x81\xf8',
        ciphertextHex: 'f3eed1bdb5d2a03c064b5a7e3db181f8',
        notes: 'NIST standard test vector for AES-256 demonstrating maximum key strength',
        category: 'official-standard'
      },
      // NIST CAVP Known Answer Test
      {
        algorithm: 'AES-128',
        description: 'NIST CAVP Known Answer Test (ECB-AES128.req)',
        origin: 'NIST Cryptographic Algorithm Validation Program',
        link: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program',
        standard: 'NIST CAVP',
        mode: 'ECB',
        keySize: 128,
        key: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: '00000000000000000000000000000000',
        plaintext: '\xf3\x44\x81\xec\x3c\xc6\x27\xba\xcd\x5d\xc3\xfb\x08\xf2\x73\xe6',
        plaintextHex: 'f34481ec3cc627bacd5dc3fb08f273e6',
        ciphertext: '\x03\x36\x76\x3e\x96\x6d\x92\x59\x5a\x56\x7c\xc9\xce\x53\x7f\x5e',
        ciphertextHex: '0336763e966d92595a567cc9ce537f5e',
        notes: 'CAVP Known Answer Test for validation against NIST test suite',
        category: 'validation-test'
      },
      // Edge case: all zeros key and plaintext
      {
        algorithm: 'AES-128',
        description: 'AES-128 all zeros boundary test',
        origin: 'Common cryptographic test pattern',
        link: 'https://csrc.nist.gov/publications/detail/fips/197/final',
        standard: 'Boundary Test',
        mode: 'ECB',
        keySize: 128,
        key: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: '00000000000000000000000000000000',
        plaintext: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        plaintextHex: '00000000000000000000000000000000',
        ciphertext: '\x66\xe9\x4b\xd4\xef\x8a\x2c\x3b\x88\x4c\xfa\x59\xca\x34\x2b\x2e',
        ciphertextHex: '66e94bd4ef8a2c3b884cfa59ca342b2e',
        notes: 'Boundary test with all-zero input to verify proper operation with edge case data',
        category: 'boundary-test'
      },
      // Edge case: all ones
      {
        algorithm: 'AES-128',
        description: 'AES-128 all ones boundary test',
        origin: 'Common cryptographic test pattern',
        link: 'https://csrc.nist.gov/publications/detail/fips/197/final',
        standard: 'Boundary Test',
        mode: 'ECB',
        keySize: 128,
        key: '\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff',
        keyHex: 'ffffffffffffffffffffffffffffffff',
        plaintext: '\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff',
        plaintextHex: 'ffffffffffffffffffffffffffffffff',
        ciphertext: '\xa1\xf6\x25\x8c\x87\x7d\x5f\xcd\x89\x64\x48\x45\x38\xbf\xc9\x2c',
        ciphertextHex: 'a1f6258c877d5fcd8964484538bfc92c',
        notes: 'Boundary test with all-one input to verify proper operation with maximum byte values',
        category: 'boundary-test'
      }
    ],
    
    // Reference links to authoritative sources and production implementations
    referenceLinks: {
      specifications: [
        {
          name: 'FIPS 197 - Advanced Encryption Standard (AES)',
          url: 'https://csrc.nist.gov/publications/detail/fips/197/final',
          description: 'Official NIST specification for the AES encryption standard'
        },
        {
          name: 'NIST SP 800-38A - Block Cipher Modes of Operation',
          url: 'https://csrc.nist.gov/publications/detail/sp/800-38a/final',
          description: 'NIST special publication defining standard block cipher modes'
        },
        {
          name: 'RFC 3268 - AES Ciphersuites for TLS',
          url: 'https://tools.ietf.org/rfc/rfc3268.txt',
          description: 'IETF RFC defining AES cipher suites for Transport Layer Security'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL AES Implementation',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/aes/',
          description: 'Production-quality AES implementation from OpenSSL'
        },
        {
          name: 'Mbed TLS AES Implementation',
          url: 'https://github.com/Mbed-TLS/mbedtls/tree/development/library/aes.c',
          description: 'Embedded-focused AES implementation from Mbed TLS'
        },
        {
          name: 'libgcrypt Rijndael Implementation',
          url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/rijndael.c',
          description: 'Rijndael implementation from GNU libgcrypt'
        },
        {
          name: 'Crypto++ AES Implementation',
          url: 'https://github.com/weidai11/cryptopp/blob/master/rijndael.cpp',
          description: 'High-performance C++ AES implementation'
        }
      ],
      validation: [
        {
          name: 'NIST CAVP Test Vectors',
          url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers',
          description: 'Comprehensive test vectors for AES validation'
        },
        {
          name: 'NIST AES Known Answer Tests',
          url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers#AES',
          description: 'Known Answer Tests for AES algorithm validation'
        }
      ]
    },
    
    // Initialize cipher with pre-computed tables
    Init: function() {
      // Initialize GF(2^8) multiplication tables for performance
      global.OpCodes.InitGF256Tables();
      Rijndael.isInitialized = true;
    },
    
    // Set up key with comprehensive validation
    KeySetup: function(optional_key) {
      // Validate key
      if (!optional_key) {
        global.throwException('Invalid Key Exception', 'Key cannot be null or undefined', 'Rijndael', 'KeySetup');
        return null;
      }
      
      const keyLength = optional_key.length;
      if (keyLength !== 16 && keyLength !== 24 && keyLength !== 32) {
        global.throwException('Invalid Key Length Exception', 
          `AES requires key length of 16, 24, or 32 bytes. Got ${keyLength} bytes`, 'Rijndael', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Rijndael[' + global.generateUniqueID() + ']';
      } while (Rijndael.instances[id] || global.objectInstances[id]);
      
      try {
        Rijndael.instances[id] = new Rijndael.RijndaelInstance(optional_key);
        global.objectInstances[id] = true;
        return id;
      } catch (e) {
        global.throwException('Key Setup Exception', e.message, 'Rijndael', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data with secure cleanup
    ClearData: function(id) {
      if (Rijndael.instances[id]) {
        const instance = Rijndael.instances[id];
        
        // Securely clear expanded key material
        if (instance.expandedKey) {
          global.OpCodes.ClearArray(instance.expandedKey);
        }
        if (instance.key) {
          // Overwrite key string with zeros
          const keyLength = instance.key.length;
          instance.key = '\x00'.repeat(keyLength);
        }
        
        delete Rijndael.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Rijndael', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block with enhanced validation and error handling
    encryptBlock: function(id, plaintext) {
      if (!Rijndael.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Rijndael', 'encryptBlock');
        return plaintext;
      }
      
      if (!plaintext || plaintext.length !== 16) {
        global.throwException('Invalid Block Size Exception', 
          `AES requires exactly 16-byte blocks. Got ${plaintext ? plaintext.length : 0} bytes`, 'Rijndael', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Rijndael.instances[id];
      
      // Ensure key is expanded (only expand once per instance)
      if (!instance.keyExpanded) {
        instance.keyExpansion();
        instance.keyExpanded = true;
      }
      
      const state = Rijndael.stringToState(plaintext);
      
      // Record operation for performance monitoring
      if (global.OpCodes.RecordOperation) {
        global.OpCodes.RecordOperation('AES-encrypt', 1);
      }
      
      // AddRoundKey (initial)
      Rijndael.addRoundKey(state, instance.expandedKey, 0);
      
      // Main rounds
      for (let round = 1; round < instance.nr; round++) {
        Rijndael.subBytes(state);
        Rijndael.shiftRows(state);
        Rijndael.mixColumns(state);
        Rijndael.addRoundKey(state, instance.expandedKey, round);
      }
      
      // Final round (no MixColumns)
      Rijndael.subBytes(state);
      Rijndael.shiftRows(state);
      Rijndael.addRoundKey(state, instance.expandedKey, instance.nr);
      
      return Rijndael.stateToString(state);
    },
    
    // Decrypt block with enhanced validation and error handling
    decryptBlock: function(id, ciphertext) {
      if (!Rijndael.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Rijndael', 'decryptBlock');
        return ciphertext;
      }
      
      if (!ciphertext || ciphertext.length !== 16) {
        global.throwException('Invalid Block Size Exception', 
          `AES requires exactly 16-byte blocks. Got ${ciphertext ? ciphertext.length : 0} bytes`, 'Rijndael', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Rijndael.instances[id];
      
      // Ensure key is expanded (only expand once per instance)
      if (!instance.keyExpanded) {
        instance.keyExpansion();
        instance.keyExpanded = true;
      }
      
      const state = Rijndael.stringToState(ciphertext);
      
      // Record operation for performance monitoring
      if (global.OpCodes.RecordOperation) {
        global.OpCodes.RecordOperation('AES-decrypt', 1);
      }
      
      // AddRoundKey (initial with last round key)
      Rijndael.addRoundKey(state, instance.expandedKey, instance.nr);
      
      // Main rounds (in reverse)
      for (let round = instance.nr - 1; round > 0; round--) {
        Rijndael.invShiftRows(state);
        Rijndael.invSubBytes(state);
        Rijndael.addRoundKey(state, instance.expandedKey, round);
        Rijndael.invMixColumns(state);
      }
      
      // Final round (no InvMixColumns)
      Rijndael.invShiftRows(state);
      Rijndael.invSubBytes(state);
      Rijndael.addRoundKey(state, instance.expandedKey, 0);
      
      
      return Rijndael.stateToString(state);
    },
    
    // Convert string to AES state matrix (4x4 bytes)
    stringToState: function(str) {
      const state = [[], [], [], []];
      for (let i = 0; i < 16; i += 4) {
        state[0][i/4] = str.charCodeAt(i    ) & 0xFF;
        state[1][i/4] = str.charCodeAt(i + 1) & 0xFF;
        state[2][i/4] = str.charCodeAt(i + 2) & 0xFF;
        state[3][i/4] = str.charCodeAt(i + 3) & 0xFF;
      }
      return state;
    },
    
    // Convert AES state matrix back to string
    stateToString: function(state) {
      let result = '';
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          result += String.fromCharCode(state[row][col]);
        }
      }
      return result;
    },
    
    // SubBytes transformation
    subBytes: function(state) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          state[row][col] = Rijndael.SBOX[state[row][col]];
        }
      }
    },
    
    // Inverse SubBytes transformation
    invSubBytes: function(state) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          state[row][col] = Rijndael.SBOX_INV[state[row][col]];
        }
      }
    },
    
    // ShiftRows transformation
    shiftRows: function(state) {
      for (let row = 1; row < 4; row++) {
        const shiftAmount = Rijndael.SHIFT_OFFSETS[4][row];
        const temp = state[row].slice(0, shiftAmount);
        state[row] = state[row].slice(shiftAmount).concat(temp);
      }
    },
    
    // Inverse ShiftRows transformation
    invShiftRows: function(state) {
      for (let row = 1; row < 4; row++) {
        const shiftAmount = 4 - Rijndael.SHIFT_OFFSETS[4][row];
        const temp = state[row].slice(0, shiftAmount);
        state[row] = state[row].slice(shiftAmount).concat(temp);
      }
    },
    
    // MixColumns transformation using optimized OpCodes functions
    mixColumns: function(state) {
      for (let col = 0; col < 4; col++) {
        const s0 = state[0][col];
        const s1 = state[1][col];
        const s2 = state[2][col];
        const s3 = state[3][col];
        
        // Use fast table-based GF(2^8) multiplication
        state[0][col] = global.OpCodes.FastGF256Mul(s0, 0x02) ^ global.OpCodes.FastGF256Mul(s1, 0x03) ^ s2 ^ s3;
        state[1][col] = s0 ^ global.OpCodes.FastGF256Mul(s1, 0x02) ^ global.OpCodes.FastGF256Mul(s2, 0x03) ^ s3;
        state[2][col] = s0 ^ s1 ^ global.OpCodes.FastGF256Mul(s2, 0x02) ^ global.OpCodes.FastGF256Mul(s3, 0x03);
        state[3][col] = global.OpCodes.FastGF256Mul(s0, 0x03) ^ s1 ^ s2 ^ global.OpCodes.FastGF256Mul(s3, 0x02);
      }
    },
    
    // Inverse MixColumns transformation using optimized OpCodes functions
    invMixColumns: function(state) {
      for (let col = 0; col < 4; col++) {
        const s0 = state[0][col];
        const s1 = state[1][col];
        const s2 = state[2][col];
        const s3 = state[3][col];
        
        // Use fast table-based GF(2^8) multiplication
        state[0][col] = global.OpCodes.FastGF256Mul(s0, 0x0E) ^ global.OpCodes.FastGF256Mul(s1, 0x0B) ^ 
                       global.OpCodes.FastGF256Mul(s2, 0x0D) ^ global.OpCodes.FastGF256Mul(s3, 0x09);
        state[1][col] = global.OpCodes.FastGF256Mul(s0, 0x09) ^ global.OpCodes.FastGF256Mul(s1, 0x0E) ^ 
                       global.OpCodes.FastGF256Mul(s2, 0x0B) ^ global.OpCodes.FastGF256Mul(s3, 0x0D);
        state[2][col] = global.OpCodes.FastGF256Mul(s0, 0x0D) ^ global.OpCodes.FastGF256Mul(s1, 0x09) ^ 
                       global.OpCodes.FastGF256Mul(s2, 0x0E) ^ global.OpCodes.FastGF256Mul(s3, 0x0B);
        state[3][col] = global.OpCodes.FastGF256Mul(s0, 0x0B) ^ global.OpCodes.FastGF256Mul(s1, 0x0D) ^ 
                       global.OpCodes.FastGF256Mul(s2, 0x09) ^ global.OpCodes.FastGF256Mul(s3, 0x0E);
      }
    },
    
    // AddRoundKey transformation using OpCodes functions
    addRoundKey: function(state, expandedKey, round) {
      for (let col = 0; col < 4; col++) {
        const roundKeyWord = expandedKey[round * 4 + col];
        // Extract bytes in same order as original: LSB to MSB
        state[0][col] ^= (roundKeyWord      ) & 0xFF;
        state[1][col] ^= (roundKeyWord >>  8) & 0xFF;
        state[2][col] ^= (roundKeyWord >> 16) & 0xFF;
        state[3][col] ^= (roundKeyWord >> 24) & 0xFF;
      }
    },
    
    // Instance class with enhanced validation and security
    RijndaelInstance: function(key) {
      if (!key) {
        throw new Error('Key cannot be null or undefined');
      }
      
      const keyLength = key.length;
      
      // Strict key length validation (no padding/truncation for security)
      if (keyLength !== 16 && keyLength !== 24 && keyLength !== 32) {
        throw new Error(`Invalid AES key length: ${keyLength} bytes. Must be exactly 16, 24, or 32 bytes`);
      }
      
      // Check for weak keys (all zeros, all ones, etc.)
      const keyBytes = global.OpCodes.StringToBytes(key);
      if (Rijndael.isWeakKey(keyBytes)) {
        console.warn('Warning: Detected potentially weak AES key. Consider using a stronger key.');
      }
      
      this.key = key;
      this.nk = keyLength / 4;      // Number of 32-bit words in key
      this.nb = 4;                  // AES always uses 128-bit blocks (4 words)
      this.nr = Rijndael.ROUNDS_TABLE[this.nk][this.nb]; // Number of rounds
      
      if (!this.nr || this.nr === 0) {
        throw new Error(`Invalid number of rounds for key size ${keyLength}: ${this.nr}`);
      }
      
      // Expanded key will be generated on first use
      this.expandedKey = [];
      this.keyExpanded = false;
    },
    
    // Check for weak keys
    isWeakKey: function(keyBytes) {
      // Check for all zeros
      if (keyBytes.every(b => b === 0)) {
        return true;
      }
      
      // Check for all ones
      if (keyBytes.every(b => b === 0xFF)) {
        return true;
      }
      
      // Check for repeating patterns
      const pattern = keyBytes.slice(0, 4);
      let isRepeating = true;
      for (let i = 4; i < keyBytes.length; i += 4) {
        const segment = keyBytes.slice(i, i + 4);
        if (!global.OpCodes.CompareArrays(pattern, segment)) {
          isRepeating = false;
          break;
        }
      }
      
      return isRepeating;
    },
    
    // Optimized batch processing for multiple blocks
    encryptBlocks: function(blocks, keyInstance) {
      if (!blocks || blocks.length === 0) {
        throw new Error('No blocks provided for encryption');
      }
      
      const results = [];
      const startTime = Date.now();
      
      // Use memory pool for temporary arrays
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].length !== 16) {
          throw new Error(`Block ${i} has invalid size: ${blocks[i].length} bytes`);
        }
        
        const encrypted = Rijndael.encryptBlock(keyInstance, blocks[i]);
        results.push(encrypted);
      }
      
      const endTime = Date.now();
      if (global.OpCodes.RecordOperation) {
        global.OpCodes.RecordOperation('AES-batch-encrypt', blocks.length);
      }
      
      return results;
    },
    
    // Optimized batch processing for multiple blocks
    decryptBlocks: function(blocks, keyInstance) {
      if (!blocks || blocks.length === 0) {
        throw new Error('No blocks provided for decryption');
      }
      
      const results = [];
      const startTime = Date.now();
      
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].length !== 16) {
          throw new Error(`Block ${i} has invalid size: ${blocks[i].length} bytes`);
        }
        
        const decrypted = Rijndael.decryptBlock(keyInstance, blocks[i]);
        results.push(decrypted);
      }
      
      const endTime = Date.now();
      if (global.OpCodes.RecordOperation) {
        global.OpCodes.RecordOperation('AES-batch-decrypt', blocks.length);
      }
      
      return results;
    }
  };
  
  // Add optimized key expansion method to RijndaelInstance prototype
  Rijndael.RijndaelInstance.prototype.keyExpansion = function() {
    // Clear any existing expanded key
    this.expandedKey = [];
    
    // Copy initial key words in LE format (like original)
    for (let i = 0; i < this.nk; i++) {
      this.expandedKey[i] = 
        ((this.key.charCodeAt(4*i    ) & 0xFF)      ) | 
        ((this.key.charCodeAt(4*i + 1) & 0xFF) <<  8) | 
        ((this.key.charCodeAt(4*i + 2) & 0xFF) << 16) | 
        ((this.key.charCodeAt(4*i + 3) & 0xFF) << 24);
    }
    
    // Generate remaining round keys
    for (let i = this.nk; i < this.nb * (this.nr + 1); i++) {
      let temp = this.expandedKey[i - 1];
      
      if (i % this.nk === 0) {
        // RotWord + SubWord + Rcon (matching FIPS 197 exactly)
        temp = 
          ( (Rijndael.SBOX[(temp >>  8) & 0xFF]      ) |
            (Rijndael.SBOX[(temp >> 16) & 0xFF] <<  8) |
            (Rijndael.SBOX[(temp >> 24) & 0xFF] << 16) |
            (Rijndael.SBOX[ temp        & 0xFF] << 24) ) 
          ^ Rijndael.RCON[Math.floor(i / this.nk) - 1];
      } else if (this.nk > 6 && i % this.nk === 4) {
        // Additional SubWord for AES-256 (FIPS 197 section 5.2)
        temp = 
          (Rijndael.SBOX[(temp >> 24) & 0xFF] << 24) |
          (Rijndael.SBOX[(temp >> 16) & 0xFF] << 16) |
          (Rijndael.SBOX[(temp >>  8) & 0xFF] <<  8) |
          (Rijndael.SBOX[ temp        & 0xFF]);
      }
      
      this.expandedKey[i] = this.expandedKey[i - this.nk] ^ temp;
    }
    
    // Validation: ensure correct number of round keys generated
    const expectedKeys = this.nb * (this.nr + 1);
    if (this.expandedKey.length !== expectedKeys) {
      throw new Error(`Key expansion failed: expected ${expectedKeys} keys, got ${this.expandedKey.length}`);
    }
  };
  
  // Helper functions for metadata
  function Hex8ToBytes(hex) {
    if (global.OpCodes && global.OpCodes.HexToBytes) {
      return global.OpCodes.HexToBytes(hex);
    }
    // Fallback implementation
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substr(i, 2), 16));
    }
    return result;
  }
  
  // Auto-register with universal Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Rijndael);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Rijndael);
  }
  
  // Export to global scope
  global.Rijndael = Rijndael;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rijndael;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);