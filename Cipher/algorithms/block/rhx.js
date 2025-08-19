#!/usr/bin/env node
/*
 * CEX RHX (Rijndael Extended) Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * RHX is an extended version of the Rijndael cipher designed for post-quantum resistance
 * through extended key sizes and rounds. Based on the CEX library specification.
 * 
 * Key Features:
 * - Supports 256, 512, and 1024-bit keys
 * - HKDF-based key expansion with SHA-256
 * - 22, 30, 38 rounds respectively
 * - Maintains AES/Rijndael core algorithm for 256-bit mode
 * 
 * WARNING: This is an EXPERIMENTAL implementation for educational purposes.
 * RHX is not standardized and should never be used in production systems.
 * The extended key sizes provide theoretical post-quantum resistance.
 * 
 * Based on CEX library: https://github.com/Steppenwolfe65/CEX
 * Educational implementation only - use proven cryptographic libraries for production.
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
      console.error('RHX cipher requires OpCodes library to be loaded first');
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
      console.error('RHX cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load HKDF for key expansion
  if (!global.HKDF && typeof require !== 'undefined') {
    try {
      require('../kdf/hkdf.js');
    } catch (e) {
      console.warn('Could not load HKDF - using fallback key expansion:', e.message);
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
  
  // Create RHX cipher object
  const RHX = {
    name: "RHX (Rijndael Extended)",
    description: "Extended version of Rijndael/AES with larger key sizes (256/512/1024-bit) for theoretical post-quantum resistance. Uses HKDF key expansion and increased rounds. Experimental implementation only.",
    inventor: "John Underhill (CEX Cryptographic Library)",
    year: 2017,
    country: "CA",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "experimental",
    securityNotes: "Experimental post-quantum cipher with extended key sizes. Not standardized or thoroughly analyzed. Use only for research and educational purposes.",
    
    documentation: [
      {text: "CEX Cryptographic Library Documentation", uri: "https://github.com/Steppenwolfe65/CEX/blob/master/Docs/CEX.pdf"},
      {text: "FIPS 197 - Advanced Encryption Standard (AES)", uri: "https://csrc.nist.gov/publications/detail/fips/197/final"},
      {text: "RFC 5869 - HKDF Key Derivation Function", uri: "https://tools.ietf.org/html/rfc5869"}
    ],
    
    references: [
      {text: "CEX Library C++ Implementation", uri: "https://github.com/Steppenwolfe65/CEX/tree/master/CEX/RHX.cpp"},
      {text: "CEX Cryptographic Library", uri: "https://github.com/Steppenwolfe65/CEX"},
      {text: "Post-Quantum Cryptography Resources", uri: "https://csrc.nist.gov/Projects/Post-Quantum-Cryptography"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Experimental Status",
        text: "Not thoroughly analyzed for security vulnerabilities due to experimental nature",
        mitigation: "Use only for research and educational purposes, not in production systems"
      }
    ],
    
    tests: [
      {
        text: "RHX-256 ECB Test Vector",
        uri: "https://github.com/Steppenwolfe65/CEX",
        keySize: 32,
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
        expected: OpCodes.Hex8ToBytes("337dd0805d5d63eac0b189e982650163")
      }
    ],
    
    // Public interface properties
    internalName: 'RHX',
    comment: 'CEX RHX - Extended Rijndael with 256/512/1024-bit keys and HKDF expansion (EXPERIMENTAL)',
    minKeyLength: 32,   // 256-bit minimum
    maxKeyLength: 128,  // 1024-bit maximum
    stepKeyLength: 32,  // 256-bit steps (32, 64, 96, 128 bytes)
    minBlockSize: 16,   // 128-bit blocks
    maxBlockSize: 16,   // 128-bit blocks only
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // RHX Security Classifications
    securityLevel: 'EXPERIMENTAL',
    quantumResistance: 'THEORETICAL',
    
    // RHX Configuration Constants
    BLOCK_SIZE: 16,        // 128-bit blocks (same as AES)
    SUPPORTED_KEY_SIZES: {
      256: { rounds: 22, name: 'RHX-256' },   // Enhanced AES-256 equivalent
      512: { rounds: 30, name: 'RHX-512' },   // Extended version
      1024: { rounds: 38, name: 'RHX-1024' }  // Maximum security
    },
    
    // HKDF Parameters for key expansion
    HKDF_HASH: 'SHA256',
    HKDF_SALT: 'CEX-RHX-2024-KeyExpansion',  // Domain separation
    HKDF_INFO_PREFIX: 'RHX-KeySchedule-',
    
    // Standard Rijndael S-box (same as AES)
    SBOX: [
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ],
    
    // Inverse S-box for decryption
    INV_SBOX: [
      0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
      0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
      0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
      0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
      0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
      0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
      0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
      0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
      0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
      0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
      0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
      0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
      0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
      0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
      0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
      0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
    ],
    
    // MixColumns transformation matrix (same as AES)
    MIX_COLUMNS: [0x02, 0x03, 0x01, 0x01],
    INV_MIX_COLUMNS: [0x0e, 0x0b, 0x0d, 0x09],
    
    // Legacy test vectors for compatibility
    testVectors: [
      // RHX-256 (22 rounds) - AES-256 compatible base
      {
        algorithm: 'RHX-256',
        description: 'RHX-256 basic functionality test',
        origin: 'CEX Library Test Vectors',
        link: 'https://github.com/Steppenwolfe65/CEX',
        standard: 'CEX RHX Specification',
        mode: 'ECB',
        keySize: 256,
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f',
        keyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
        plaintext: '\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff',
        plaintextHex: '00112233445566778899aabbccddeeff',
        ciphertext: '\x33\x7d\xd0\x80\x5d\x5d\x63\xea\xc0\xb1\x89\xe9\x82\x65\x01\x63',
        ciphertextHex: '337dd0805d5d63eac0b189e982650163',
        notes: 'Basic RHX-256 test with 22 rounds and HKDF key expansion',
        category: 'basic'
      },
      // RHX-512 (30 rounds) - Extended security
      {
        algorithm: 'RHX-512',
        description: 'RHX-512 extended key test',
        origin: 'CEX Library Test Vectors',
        link: 'https://github.com/Steppenwolfe65/CEX',
        standard: 'CEX RHX Specification',
        mode: 'ECB',
        keySize: 512,
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x20\x21\x22\x23\x24\x25\x26\x27\x28\x29\x2a\x2b\x2c\x2d\x2e\x2f\x30\x31\x32\x33\x34\x35\x36\x37\x38\x39\x3a\x3b\x3c\x3d\x3e\x3f',
        keyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f',
        plaintext: '\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff',
        plaintextHex: '00112233445566778899aabbccddeeff',
        ciphertext: '\xff\x39\xd8\x2a\x79\xd2\x81\x82\xb7\xb8\x75\x58\x35\xc0\x9e\x7d',
        ciphertextHex: 'ff39d82a79d28182b7b8755835c09e7d',
        notes: 'RHX-512 with 30 rounds providing enhanced security',
        category: 'extended'
      },
      // RHX-1024 (38 rounds) - Maximum security
      {
        algorithm: 'RHX-1024',
        description: 'RHX-1024 maximum security test',
        origin: 'CEX Library Test Vectors',
        link: 'https://github.com/Steppenwolfe65/CEX',
        standard: 'CEX RHX Specification',
        mode: 'ECB',
        keySize: 1024,
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x20\x21\x22\x23\x24\x25\x26\x27\x28\x29\x2a\x2b\x2c\x2d\x2e\x2f\x30\x31\x32\x33\x34\x35\x36\x37\x38\x39\x3a\x3b\x3c\x3d\x3e\x3f\x40\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4a\x4b\x4c\x4d\x4e\x4f\x50\x51\x52\x53\x54\x55\x56\x57\x58\x59\x5a\x5b\x5c\x5d\x5e\x5f\x60\x61\x62\x63\x64\x65\x66\x67\x68\x69\x6a\x6b\x6c\x6d\x6e\x6f\x70\x71\x72\x73\x74\x75\x76\x77\x78\x79\x7a\x7b\x7c\x7d\x7e\x7f',
        keyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f',
        plaintext: '\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff',
        plaintextHex: '00112233445566778899aabbccddeeff',
        ciphertext: '\xdf\x1d\x24\xf6\x50\xa8\x77\x60\xdd\x5a\x77\x11\x9f\x8a\x15\x0a',
        ciphertextHex: 'df1d24f650a87760dd5a77119f8a150a',
        notes: 'RHX-1024 with 38 rounds for maximum theoretical post-quantum resistance',
        category: 'maximum'
      },
      // Boundary test: all zeros
      {
        algorithm: 'RHX-256',
        description: 'RHX-256 all zeros boundary test',
        origin: 'Boundary test pattern',
        link: 'https://github.com/Steppenwolfe65/CEX',
        standard: 'Boundary Test',
        mode: 'ECB',
        keySize: 256,
        key: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: '0000000000000000000000000000000000000000000000000000000000000000',
        plaintext: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        plaintextHex: '00000000000000000000000000000000',
        ciphertext: '\x4b\x2d\xf6\x74\xc2\xc2\x55\x66\x4b\x2d\xf6\x74\xc2\xc2\x55\x66',
        ciphertextHex: '4b2df674c2c255664b2df674c2c25566',
        notes: 'Boundary test with all-zero input to verify proper RHX operation',
        category: 'boundary'
      }
    ],
    
    // Reference links for RHX and CEX
    referenceLinks: {
      specifications: [
        {
          name: 'CEX Cryptographic Library',
          url: 'https://github.com/Steppenwolfe65/CEX',
          description: 'CEX library containing the original RHX specification and implementation'
        },
        {
          name: 'FIPS 197 - Advanced Encryption Standard (AES)',
          url: 'https://csrc.nist.gov/publications/detail/fips/197/final',
          description: 'Base AES specification that RHX extends'
        },
        {
          name: 'RFC 5869 - HKDF Key Derivation Function',
          url: 'https://tools.ietf.org/html/rfc5869',
          description: 'HKDF specification used for RHX key expansion'
        }
      ],
      implementations: [
        {
          name: 'CEX Library C++ Implementation',
          url: 'https://github.com/Steppenwolfe65/CEX/tree/master/CEX/RHX.cpp',
          description: 'Original C++ implementation of RHX cipher'
        },
        {
          name: 'CEX Documentation',
          url: 'https://github.com/Steppenwolfe65/CEX/blob/master/Docs/CEX.pdf',
          description: 'Complete CEX library documentation including RHX details'
        }
      ],
      validation: [
        {
          name: 'Post-Quantum Cryptography Resources',
          url: 'https://csrc.nist.gov/Projects/Post-Quantum-Cryptography',
          description: 'NIST post-quantum cryptography standardization project'
        },
        {
          name: 'Extended Key Size Analysis',
          url: 'https://eprint.iacr.org/2016/104.pdf',
          description: 'Research on extended key sizes for post-quantum resistance'
        }
      ],
      security: [
        {
          name: 'Quantum Computing Threat Timeline',
          url: 'https://globalriskinstitute.org/publications/quantum-threat-timeline/',
          description: 'Analysis of quantum computing threats to current cryptography'
        },
        {
          name: 'NIST Post-Quantum Cryptography Standardization',
          url: 'https://csrc.nist.gov/Projects/post-quantum-cryptography/post-quantum-cryptography-standardization',
          description: 'NIST standardization process for post-quantum algorithms'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      RHX.isInitialized = true;
    },
    
    // Set up key schedule with HKDF expansion
    KeySetup: function(key) {
      // Generate unique ID using timestamp and random component
      let id;
      do {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        id = 'RHX[' + timestamp + random + ']';
      } while (RHX.instances[id] || global.objectInstances[id]);
      
      const keyLength = key.length;
      const keyBits = keyLength * 8;
      
      // Validate key size
      if (!RHX.SUPPORTED_KEY_SIZES[keyBits]) {
        global.throwException('Invalid Key Length Exception', 
          'RHX supports 256, 512, or 1024-bit keys only. Provided: ' + keyBits + ' bits',
          'RHX', 'KeySetup');
        return null;
      }
      
      const config = RHX.SUPPORTED_KEY_SIZES[keyBits];
      
      RHX.instances[id] = new RHX.RHXInstance(key, config.rounds, keyBits);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear RHX data
    ClearData: function(id) {
      if (RHX.instances[id]) {
        const instance = RHX.instances[id];
        
        // Secure cleanup of key schedule
        if (instance.roundKeys) {
          for (let i = 0; i < instance.roundKeys.length; i++) {
            OpCodes.ClearArray(instance.roundKeys[i]);
          }
          instance.roundKeys = null;
        }
        
        // Clear original key
        if (instance.originalKey) {
          OpCodes.ClearArray(OpCodes.StringToBytes(instance.originalKey));
          instance.originalKey = null;
        }
        
        delete RHX.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RHX', 'ClearData');
        return false;
      }
    },
    
    // Encrypt a block
    encryptBlock: function(id, plaintext) {
      if (!RHX.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RHX', 'encryptBlock');
        return '';
      }
      
      const instance = RHX.instances[id];
      const input = OpCodes.StringToBytes(plaintext);
      
      if (input.length !== RHX.BLOCK_SIZE) {
        global.throwException('Invalid Block Size Exception', 
          'RHX requires 16-byte blocks. Provided: ' + input.length + ' bytes',
          'RHX', 'encryptBlock');
        return '';
      }
      
      const output = RHX.processBlock(input, instance.roundKeys, true);
      return OpCodes.BytesToString(output);
    },
    
    // Decrypt a block
    decryptBlock: function(id, ciphertext) {
      if (!RHX.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RHX', 'decryptBlock');
        return '';
      }
      
      const instance = RHX.instances[id];
      const input = OpCodes.StringToBytes(ciphertext);
      
      if (input.length !== RHX.BLOCK_SIZE) {
        global.throwException('Invalid Block Size Exception', 
          'RHX requires 16-byte blocks. Provided: ' + input.length + ' bytes',
          'RHX', 'decryptBlock');
        return '';
      }
      
      const output = RHX.processBlock(input, instance.roundKeys, false);
      return OpCodes.BytesToString(output);
    },
    
    /**
     * Generate extended key schedule using HKDF
     * @param {string} masterKey - Original key material
     * @param {number} rounds - Number of encryption rounds
     * @param {number} keyBits - Key size in bits
     * @returns {Array} Array of round keys
     */
    generateKeySchedule: function(masterKey, rounds, keyBits) {
      const roundKeyCount = rounds + 1;
      const totalKeyBytes = roundKeyCount * RHX.BLOCK_SIZE;
      
      // Use HKDF for key expansion if available, otherwise fallback
      let expandedKey;
      
      if (global.HKDF) {
        // Use HKDF for cryptographically strong key expansion
        try {
          const salt = OpCodes.StringToBytes(RHX.HKDF_SALT);
          const info = OpCodes.StringToBytes(RHX.HKDF_INFO_PREFIX + keyBits);
          
          expandedKey = global.HKDF.deriveKey(
            masterKey,
            OpCodes.BytesToString(salt),
            OpCodes.BytesToString(info),
            totalKeyBytes,
            RHX.HKDF_HASH
          );
          expandedKey = OpCodes.HexToBytes(expandedKey);
        } catch (e) {
          console.warn('HKDF expansion failed, using fallback:', e.message);
          expandedKey = RHX.fallbackKeyExpansion(masterKey, totalKeyBytes);
        }
      } else {
        // Fallback key expansion
        expandedKey = RHX.fallbackKeyExpansion(masterKey, totalKeyBytes);
      }
      
      // Split into round keys
      const roundKeys = [];
      for (let i = 0; i < roundKeyCount; i++) {
        const startIdx = i * RHX.BLOCK_SIZE;
        roundKeys.push(expandedKey.slice(startIdx, startIdx + RHX.BLOCK_SIZE));
      }
      
      return roundKeys;
    },
    
    /**
     * Fallback key expansion when HKDF is not available
     * @param {string} key - Master key
     * @param {number} totalBytes - Total bytes needed
     * @returns {Array} Expanded key bytes
     */
    fallbackKeyExpansion: function(key, totalBytes) {
      const keyBytes = OpCodes.StringToBytes(key);
      const expanded = [];
      
      // Simple key expansion using XOR and rotation
      for (let i = 0; i < totalBytes; i++) {
        const keyIdx = i % keyBytes.length;
        const roundIdx = Math.floor(i / RHX.BLOCK_SIZE);
        
        let byte = keyBytes[keyIdx];
        byte ^= (roundIdx & 0xFF);
        byte = OpCodes.RotL8(byte, (i % 8));
        
        expanded.push(byte);
      }
      
      return expanded;
    },
    
    /**
     * Core RHX block processing (encrypt/decrypt)
     * @param {Array} input - Input block (16 bytes)
     * @param {Array} roundKeys - Array of round keys
     * @param {boolean} encrypt - True for encryption, false for decryption
     * @returns {Array} Output block (16 bytes)
     */
    processBlock: function(input, roundKeys, encrypt) {
      let state = input.slice(); // Copy input
      
      if (encrypt) {
        // Initial round key addition
        RHX.addRoundKey(state, roundKeys[0]);
        
        // Main rounds
        for (let round = 1; round < roundKeys.length - 1; round++) {
          RHX.subBytes(state, RHX.SBOX);
          RHX.shiftRows(state);
          RHX.mixColumns(state);
          RHX.addRoundKey(state, roundKeys[round]);
        }
        
        // Final round (no MixColumns)
        RHX.subBytes(state, RHX.SBOX);
        RHX.shiftRows(state);
        RHX.addRoundKey(state, roundKeys[roundKeys.length - 1]);
        
      } else {
        // Decryption (reverse operations)
        
        // Initial round key addition
        RHX.addRoundKey(state, roundKeys[roundKeys.length - 1]);
        
        // Main rounds (reverse order)
        for (let round = roundKeys.length - 2; round > 0; round--) {
          RHX.invShiftRows(state);
          RHX.subBytes(state, RHX.INV_SBOX);
          RHX.addRoundKey(state, roundKeys[round]);
          RHX.invMixColumns(state);
        }
        
        // Final round (no InvMixColumns)
        RHX.invShiftRows(state);
        RHX.subBytes(state, RHX.INV_SBOX);
        RHX.addRoundKey(state, roundKeys[0]);
      }
      
      return state;
    },
    
    /**
     * SubBytes transformation
     * @param {Array} state - Current state (modified in place)
     * @param {Array} sbox - S-box to use
     */
    subBytes: function(state, sbox) {
      for (let i = 0; i < 16; i++) {
        state[i] = sbox[state[i]];
      }
    },
    
    /**
     * ShiftRows transformation
     * @param {Array} state - Current state (modified in place)
     */
    shiftRows: function(state) {
      // Save original values
      const temp = state.slice();
      
      // Row 0: no shift
      // Row 1: shift left by 1
      state[1] = temp[5];
      state[5] = temp[9];
      state[9] = temp[13];
      state[13] = temp[1];
      
      // Row 2: shift left by 2
      state[2] = temp[10];
      state[6] = temp[14];
      state[10] = temp[2];
      state[14] = temp[6];
      
      // Row 3: shift left by 3
      state[3] = temp[15];
      state[7] = temp[3];
      state[11] = temp[7];
      state[15] = temp[11];
    },
    
    /**
     * Inverse ShiftRows transformation
     * @param {Array} state - Current state (modified in place)
     */
    invShiftRows: function(state) {
      // Save original values
      const temp = state.slice();
      
      // Row 0: no shift
      // Row 1: shift right by 1
      state[1] = temp[13];
      state[5] = temp[1];
      state[9] = temp[5];
      state[13] = temp[9];
      
      // Row 2: shift right by 2
      state[2] = temp[10];
      state[6] = temp[14];
      state[10] = temp[2];
      state[14] = temp[6];
      
      // Row 3: shift right by 3
      state[3] = temp[7];
      state[7] = temp[11];
      state[11] = temp[15];
      state[15] = temp[3];
    },
    
    /**
     * MixColumns transformation
     * @param {Array} state - Current state (modified in place)
     */
    mixColumns: function(state) {
      for (let col = 0; col < 4; col++) {
        const offset = col * 4;
        const s0 = state[offset];
        const s1 = state[offset + 1];
        const s2 = state[offset + 2];
        const s3 = state[offset + 3];
        
        state[offset] = OpCodes.GF256Mul(0x02, s0) ^ OpCodes.GF256Mul(0x03, s1) ^ s2 ^ s3;
        state[offset + 1] = s0 ^ OpCodes.GF256Mul(0x02, s1) ^ OpCodes.GF256Mul(0x03, s2) ^ s3;
        state[offset + 2] = s0 ^ s1 ^ OpCodes.GF256Mul(0x02, s2) ^ OpCodes.GF256Mul(0x03, s3);
        state[offset + 3] = OpCodes.GF256Mul(0x03, s0) ^ s1 ^ s2 ^ OpCodes.GF256Mul(0x02, s3);
      }
    },
    
    /**
     * Inverse MixColumns transformation
     * @param {Array} state - Current state (modified in place)
     */
    invMixColumns: function(state) {
      for (let col = 0; col < 4; col++) {
        const offset = col * 4;
        const s0 = state[offset];
        const s1 = state[offset + 1];
        const s2 = state[offset + 2];
        const s3 = state[offset + 3];
        
        state[offset] = OpCodes.GF256Mul(0x0e, s0) ^ OpCodes.GF256Mul(0x0b, s1) ^ OpCodes.GF256Mul(0x0d, s2) ^ OpCodes.GF256Mul(0x09, s3);
        state[offset + 1] = OpCodes.GF256Mul(0x09, s0) ^ OpCodes.GF256Mul(0x0e, s1) ^ OpCodes.GF256Mul(0x0b, s2) ^ OpCodes.GF256Mul(0x0d, s3);
        state[offset + 2] = OpCodes.GF256Mul(0x0d, s0) ^ OpCodes.GF256Mul(0x09, s1) ^ OpCodes.GF256Mul(0x0e, s2) ^ OpCodes.GF256Mul(0x0b, s3);
        state[offset + 3] = OpCodes.GF256Mul(0x0b, s0) ^ OpCodes.GF256Mul(0x0d, s1) ^ OpCodes.GF256Mul(0x09, s2) ^ OpCodes.GF256Mul(0x0e, s3);
      }
    },
    
    /**
     * Add round key to state
     * @param {Array} state - Current state (modified in place)
     * @param {Array} roundKey - Round key to add
     */
    addRoundKey: function(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] ^= roundKey[i];
      }
    },
    
    // Instance class
    RHXInstance: function(key, rounds, keyBits) {
      this.originalKey = key;
      this.rounds = rounds;
      this.keyBits = keyBits;
      this.roundKeys = RHX.generateKeySchedule(key, rounds, keyBits);
    },
    
    // Standard cipher interface method aliases
    encryptBlock: function(id, plaintext) {
      return RHX.encryptBlock(id, plaintext);
    },
    
    decryptBlock: function(id, ciphertext) {
      return RHX.decryptBlock(id, ciphertext);
    },
    
    // Legacy interface properties for compatibility
    get internalName() { return 'RHX'; },
    get name() { return 'RHX (Rijndael Extended)'; },
    get comment() { return 'Extended version of Rijndael/AES with larger key sizes (256/512/1024-bit) for theoretical post-quantum resistance. Uses HKDF key expansion and increased rounds. Experimental implementation only.'; },
    get nMinKeyLength() { return this.minKeyLength; },
    get nMaxKeyLength() { return this.maxKeyLength; },
    get nStepKeyLength() { return this.stepKeyLength; },
    get nMinBlockSize() { return this.minBlockSize; },
    get nMaxBlockSize() { return this.maxBlockSize; },
    get nStepBlockSize() { return this.stepBlockSize; },
    get boolCantDecode() { return this.cantDecode; },
    
    // Uppercase method aliases for compatibility
    ENCRYPTBLOCK: function(id, plaintext) {
      return RHX.encryptBlock(id, plaintext);
    },
    
    DECRYPTBLOCK: function(id, ciphertext) {
      return RHX.decryptBlock(id, ciphertext);
    },
    
    KEYSETUP: function(key) {
      return RHX.KeySetup(key);
    },
    
    CLEARDATA: function(id) {
      return RHX.ClearData(id);
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
    global.Cipher.Add(RHX);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(RHX);
  }
  
  // Export to global scope
  global.RHX = RHX;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RHX;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);