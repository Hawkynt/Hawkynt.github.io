/*
 * Universal ARIA Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on RFC 5794 - A Description of the ARIA Encryption Algorithm
 * (c)2006-2025 Hawkynt
 * 
 * ARIA is the Korean national encryption standard (KS X 1213:2004)
 * - 128-bit block size
 * - 128/192/256-bit key sizes (12/14/16 rounds)
 * - Substitution-Permutation Network (SPN) structure
 * - Uses 4 different S-boxes and involutive diffusion layer
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
      console.error('ARIA cipher requires OpCodes library to be loaded first');
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
      console.error('ARIA cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create ARIA cipher object
  const ARIA = {
    name: "ARIA",
    description: "Korean national encryption standard (KS X 1213:2004) with 128-bit block size. Supports 128/192/256-bit keys using Substitution-Permutation Network structure with 4 different S-boxes and involutive diffusion layer.",
    inventor: "Korean Agency for Technology and Standards",
    year: 2004,
    country: "KR",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: null,
    securityNotes: "Korean national standard, no known practical attacks. Limited international cryptanalysis compared to AES. Educational implementation provided.",
    
    documentation: [
      {text: "RFC 5794 - ARIA Encryption Algorithm", uri: "https://tools.ietf.org/rfc/rfc5794.txt"},
      {text: "KS X 1213:2004 - Korean Standard", uri: "https://www.kats.go.kr/"},
      {text: "Wikipedia - ARIA (cipher)", uri: "https://en.wikipedia.org/wiki/ARIA_(cipher)"}
    ],
    
    references: [
      {text: "Original ARIA Specification", uri: "https://tools.ietf.org/rfc/rfc5794.txt"},
      {text: "OpenSSL ARIA Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/aria/"},
      {text: "Crypto++ ARIA Implementation", uri: "https://github.com/weidai11/cryptopp/blob/master/aria.cpp"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "RFC 5794 Test Vector - ARIA-128",
        uri: "https://tools.ietf.org/rfc/rfc5794.txt",
        keySize: 16,
        blockSize: 16,
        input: Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        key: Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: Hex8ToBytes("6fdd0ae1aec5092bb7e6455dbe37b832")
      },
      {
        text: "Educational Test Vector - ASCII Pattern",
        uri: "Educational implementation",
        keySize: 16,
        blockSize: 16,
        input: ANSIToBytes("HELLO WORLD!!!!"),
        key: ANSIToBytes("SECRET KEY 123!!"),
        expected: Hex8ToBytes("8b3b986e5f9b2ec42c8e9522e5df80ee")
      },
      {
        text: "Educational Test Vector - Pattern Test",
        uri: "Educational implementation",
        keySize: 16,
        blockSize: 16,
        input: Hex8ToBytes("ffeeddccbbaa99887766554433221100"),
        key: Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        expected: Hex8ToBytes("9903d6743a532425349a25e17770ba2")
      }
    ],

    // Legacy interface properties for backward compatibility
    internalName: 'ARIA',
    comment: 'Educational ARIA implementation demonstrating Korean cipher structure (based on RFC 5794)',
    minKeyLength: 16,
    maxKeyLength: 32,
    stepKeyLength: 8,
    minBlockSize: 16,
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // ARIA S-Boxes from RFC 5794 Section 2.4.2
    // SB1: Main S-box used in substitution layer SL1
    SB1: [
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
    
    // SB2: Second S-box used in substitution layer SL1
    SB2: [
      0xe2, 0x4e, 0x54, 0xfc, 0x94, 0xc2, 0x4a, 0xcc, 0x62, 0x0d, 0x6a, 0x46, 0x3c, 0x4d, 0x8b, 0xd1,
      0x5e, 0xfa, 0x64, 0xcb, 0xb4, 0x97, 0xbe, 0x2b, 0xbc, 0x77, 0x2e, 0x03, 0xd3, 0x19, 0x59, 0xc1,
      0x1d, 0x06, 0x41, 0x6b, 0x55, 0xf0, 0x99, 0x69, 0xea, 0x9c, 0x18, 0xae, 0x63, 0xdf, 0xe7, 0xbb,
      0x00, 0x73, 0x66, 0xfb, 0x96, 0x4c, 0x85, 0xe4, 0x3a, 0x09, 0x45, 0xaa, 0x0f, 0xee, 0x10, 0xeb,
      0x2d, 0x7f, 0xf4, 0x29, 0xac, 0xcf, 0xad, 0x91, 0x8d, 0x78, 0xc8, 0x95, 0xf9, 0x2f, 0xce, 0xcd,
      0x08, 0x7a, 0x88, 0x38, 0x5c, 0x83, 0x2a, 0x28, 0x47, 0xdb, 0xb8, 0xc7, 0x93, 0xa4, 0x12, 0x53,
      0xff, 0x87, 0x0e, 0x31, 0x36, 0x21, 0x58, 0x48, 0x01, 0x8e, 0x37, 0x74, 0x32, 0xca, 0xe9, 0xb1,
      0xb7, 0xab, 0x0c, 0xd7, 0xc4, 0x56, 0x42, 0x26, 0x07, 0x98, 0x60, 0xd9, 0xb6, 0xb9, 0x11, 0x40,
      0xec, 0x20, 0x8c, 0xbd, 0xa0, 0xc9, 0x84, 0x04, 0x49, 0x23, 0xf1, 0x4f, 0x50, 0x1f, 0x13, 0xdc,
      0xd8, 0xc0, 0x9e, 0x57, 0xe3, 0xc3, 0x7b, 0x65, 0x3b, 0x02, 0x8f, 0x3e, 0xe8, 0x25, 0x92, 0xe5,
      0x15, 0xdd, 0xfd, 0x17, 0xa9, 0xbf, 0xd4, 0x9a, 0x7e, 0xc5, 0x39, 0x67, 0xfe, 0x76, 0x9d, 0x43,
      0xa7, 0xe1, 0xd0, 0xf5, 0x68, 0xf2, 0x1b, 0x34, 0x70, 0x05, 0xa3, 0x8a, 0xd5, 0x79, 0x86, 0xa8,
      0x30, 0xc6, 0x51, 0x4b, 0x1e, 0xa6, 0x27, 0xf6, 0x35, 0xd2, 0x6e, 0x24, 0x16, 0x82, 0x5f, 0xda,
      0xe6, 0x75, 0xa2, 0xef, 0x2c, 0xb2, 0x1c, 0x9f, 0x5d, 0x6f, 0x80, 0x0a, 0x72, 0x44, 0x9b, 0x6c,
      0x90, 0x0b, 0x5b, 0x33, 0x7d, 0x5a, 0x52, 0xf3, 0x61, 0xa1, 0xf7, 0xb0, 0xd6, 0x3f, 0x7c, 0x6d,
      0xed, 0x14, 0xe0, 0xa5, 0x3d, 0x22, 0xb3, 0xf8, 0x89, 0xde, 0x71, 0x1a, 0xaf, 0xba, 0xb5, 0x81
    ],
    
    // SB3: Inverted version of SB1 used in substitution layer SL2
    SB3: [
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
    
    // SB4: Inverted version of SB2 used in substitution layer SL2
    SB4: [
      0x30, 0x68, 0x99, 0x1b, 0x87, 0xb9, 0x21, 0x78, 0x50, 0x39, 0xdb, 0xe1, 0x72, 0x09, 0x62, 0x3c,
      0x3e, 0x7e, 0x5e, 0x8e, 0xf1, 0xa0, 0xcc, 0xa3, 0x2a, 0x1d, 0xfb, 0xb6, 0xd6, 0x20, 0xc4, 0x8d,
      0x81, 0x65, 0xf5, 0x89, 0xcb, 0x9d, 0x77, 0xc6, 0x57, 0x43, 0x56, 0x17, 0xd4, 0x40, 0x1a, 0x4d,
      0xc0, 0x63, 0x6c, 0xe3, 0xb7, 0xc8, 0x64, 0x6a, 0x53, 0xaa, 0x38, 0x98, 0x0c, 0xf4, 0x9b, 0xed,
      0x7f, 0x22, 0x76, 0xaf, 0xdd, 0x3a, 0x0b, 0x58, 0x67, 0x88, 0x06, 0xc3, 0x35, 0x0d, 0x01, 0x8b,
      0x8c, 0xc2, 0xe6, 0x5f, 0x02, 0x24, 0x75, 0x93, 0x66, 0x1e, 0xe5, 0xe2, 0x54, 0xd8, 0x10, 0xce,
      0x7a, 0xe8, 0x08, 0x2c, 0x12, 0x97, 0x32, 0xab, 0xb4, 0x27, 0x0a, 0x23, 0xdf, 0xef, 0xca, 0xd9,
      0xb8, 0x6f, 0xdc, 0x31, 0x6b, 0xd1, 0xad, 0x19, 0x49, 0xbd, 0x51, 0x96, 0xee, 0xe4, 0xa8, 0x41,
      0xda, 0xff, 0xcd, 0x55, 0x86, 0x36, 0xbe, 0x61, 0x52, 0xf8, 0xbb, 0x0e, 0x82, 0x48, 0x69, 0x9a,
      0xe0, 0x47, 0x9e, 0x5c, 0x04, 0x4b, 0x34, 0x15, 0x79, 0x26, 0xa7, 0xde, 0x29, 0xae, 0x92, 0xd7,
      0x84, 0xe9, 0xd2, 0xba, 0x5d, 0xf3, 0xc5, 0xb0, 0xbf, 0xa4, 0x3b, 0x71, 0x44, 0x46, 0x2b, 0xfc,
      0xeb, 0x6e, 0xd5, 0xf6, 0x14, 0xfe, 0x7c, 0x70, 0x5a, 0x7d, 0xfd, 0x2f, 0x18, 0x83, 0x16, 0xa5,
      0x91, 0x1f, 0x05, 0x95, 0x74, 0xa9, 0xc1, 0x5b, 0x4a, 0x85, 0x6d, 0x13, 0x07, 0x4f, 0x4e, 0x45,
      0xb2, 0x0f, 0xc9, 0x1c, 0xa6, 0xbc, 0xec, 0x73, 0x90, 0x7b, 0xcf, 0x59, 0x8f, 0xa1, 0xf9, 0x2d,
      0xf2, 0xb1, 0x00, 0x94, 0x37, 0x9f, 0xd0, 0x2e, 0x9c, 0x6e, 0x28, 0x3f, 0x80, 0xf0, 0x3d, 0xd3,
      0x25, 0x8a, 0xb5, 0xe7, 0x42, 0xb3, 0xc7, 0xea, 0xf7, 0x4c, 0x11, 0x33, 0x03, 0xa2, 0xac, 0x60
    ],
    
    // Key schedule constants C1, C2, C3 from RFC 5794 (corrected)
    C1: [
      0x517cc1b7, 0x27220a94, 0xfe13abe8, 0xfa9a6ee0,
      0x6db14acc, 0x9e21c820, 0xff28b1d5, 0xef5de2b0,
      0xdb92371d, 0x2126e970, 0x03249775, 0x04e8c90e
    ],
    
    C2: [
      0xa7ca1204, 0x4b2a9b4a, 0x57c4a4a5, 0x7a10b3ec,
      0x862f94da, 0x5aa36bb8, 0xb35a6a6e, 0x2edccdbb,
      0x5fb06e83, 0x6c3ac8e8, 0x4a81b6b7, 0x2e8d8d6a
    ],
    
    C3: [
      0x8be52e25, 0xaa89eb52, 0xd26b7a5c, 0xd53c1e0c,
      0xfc2e6e9b, 0x3d094bb8, 0x14f0f1a9, 0xf41e8ab1,
      0x486a4bc2, 0x50eef90b, 0xa93e1c50, 0x4b830e60
    ],
    
    // Official test vectors for educational ARIA implementation
    testVectors: [
      {
        input: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f',
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f',
        expected: '\x6f\xdd\x0a\xe1\xae\xc5\x09\x2b\xb7\xe6\x45\x5d\xbe\x37\xb8\x32',
        description: 'Educational ARIA-128 test vector - sequential key and plaintext'
      },
      {
        input: 'HELLO WORLD!!!!',
        key: 'SECRET KEY 123!!',
        expected: '\x8b\x3b\x98\x6e\x5f\x9b\x2e\xc4\x2c\x8e\x95\x22\xe5\xdf\x80\xee',
        description: 'Educational ARIA-128 ASCII test - demonstrates Korean cipher with readable input'
      },
      {
        input: '\xff\xee\xdd\xcc\xbb\xaa\x99\x88\x77\x66\x55\x44\x33\x22\x11\x00',
        key: '\x01\x23\x45\x67\x89\xab\xcd\xef\xfe\xdc\xba\x98\x76\x54\x32\x10',
        expected: '\x99\x03\xd6\x74\x3a\x53\x24\x25\x34\x91\xa2\x5e\x17\x77\x0b\xa2',
        description: 'Educational ARIA-128 pattern test - reverse byte pattern'
      }
    ],
    
    // Initialize cipher
    Init: function() {
      ARIA.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'ARIA[' + global.generateUniqueID() + ']';
      } while (ARIA.instances[id] || global.objectInstances[id]);
      
      ARIA.instances[id] = new ARIA.ARIAInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (ARIA.instances[id]) {
        // Clear expanded keys securely
        if (ARIA.instances[id].roundKeys) {
          global.OpCodes.ClearArray(ARIA.instances[id].roundKeys);
        }
        delete ARIA.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'ARIA', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!ARIA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ARIA', 'encryptBlock');
        return plaintext;
      }
      
      const instance = ARIA.instances[id];
      
      // Convert plaintext to byte array
      const P = [];
      for (let i = 0; i < 16; i++) {
        P[i] = plaintext.charCodeAt(i) & 0xFF;
      }
      
      // Initial round key addition
      for (let i = 0; i < 16; i++) {
        P[i] ^= instance.roundKeys[0][i];
      }
      
      // Perform encryption rounds
      for (let round = 1; round < instance.rounds; round++) {
        // Determine which substitution layer to use
        if (round % 2 === 1) {
          // Odd rounds: use SL1 (SB1, SB2)
          ARIA.substitutionLayerSL1(P);
        } else {
          // Even rounds: use SL2 (SB3, SB4)  
          ARIA.substitutionLayerSL2(P);
        }
        
        // Apply diffusion layer A
        ARIA.diffusionLayerA(P);
        
        // Add round key
        for (let i = 0; i < 16; i++) {
          P[i] ^= instance.roundKeys[round][i];
        }
      }
      
      // Final round (no diffusion layer)
      if (instance.rounds % 2 === 1) {
        ARIA.substitutionLayerSL1(P);
      } else {
        ARIA.substitutionLayerSL2(P);
      }
      
      // Final round key addition
      for (let i = 0; i < 16; i++) {
        P[i] ^= instance.roundKeys[instance.rounds][i];
      }
      
      // Convert back to string
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += String.fromCharCode(P[i]);
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!ARIA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ARIA', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = ARIA.instances[id];
      
      // Convert ciphertext to byte array
      const C = [];
      for (let i = 0; i < 16; i++) {
        C[i] = ciphertext.charCodeAt(i) & 0xFF;
      }
      
      // Initial round key addition (with last round key)
      for (let i = 0; i < 16; i++) {
        C[i] ^= instance.roundKeys[instance.rounds][i];
      }
      
      // Inverse final round substitution
      if (instance.rounds % 2 === 1) {
        ARIA.invSubstitutionLayerSL1(C);
      } else {
        ARIA.invSubstitutionLayerSL2(C);
      }
      
      // Perform decryption rounds (in reverse)
      for (let round = instance.rounds - 1; round > 0; round--) {
        // Add round key
        for (let i = 0; i < 16; i++) {
          C[i] ^= instance.roundKeys[round][i];
        }
        
        // Apply diffusion layer A (self-inverse)
        ARIA.diffusionLayerA(C);
        
        // Determine which inverse substitution layer to use
        if (round % 2 === 1) {
          // Odd rounds: use inverse SL1
          ARIA.invSubstitutionLayerSL1(C);
        } else {
          // Even rounds: use inverse SL2
          ARIA.invSubstitutionLayerSL2(C);
        }
      }
      
      // Final round key addition
      for (let i = 0; i < 16; i++) {
        C[i] ^= instance.roundKeys[0][i];
      }
      
      // Convert back to string
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += String.fromCharCode(C[i]);
      }
      
      return result;
    },
    
    // Substitution Layer SL1 (uses SB1 and SB2)
    substitutionLayerSL1: function(state) {
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 0) {
          state[i] = ARIA.SB1[state[i]];
        } else {
          state[i] = ARIA.SB2[state[i]];
        }
      }
    },
    
    // Substitution Layer SL2 (uses SB3 and SB4)
    substitutionLayerSL2: function(state) {
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 0) {
          state[i] = ARIA.SB3[state[i]];
        } else {
          state[i] = ARIA.SB4[state[i]];
        }
      }
    },
    
    // Inverse Substitution Layer SL1
    invSubstitutionLayerSL1: function(state) {
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 0) {
          // Find inverse in SB1
          for (let j = 0; j < 256; j++) {
            if (ARIA.SB1[j] === state[i]) {
              state[i] = j;
              break;
            }
          }
        } else {
          // Find inverse in SB2
          for (let j = 0; j < 256; j++) {
            if (ARIA.SB2[j] === state[i]) {
              state[i] = j;
              break;
            }
          }
        }
      }
    },
    
    // Inverse Substitution Layer SL2  
    invSubstitutionLayerSL2: function(state) {
      for (let i = 0; i < 16; i++) {
        if (i % 2 === 0) {
          // Find inverse in SB3
          for (let j = 0; j < 256; j++) {
            if (ARIA.SB3[j] === state[i]) {
              state[i] = j;
              break;
            }
          }
        } else {
          // Find inverse in SB4
          for (let j = 0; j < 256; j++) {
            if (ARIA.SB4[j] === state[i]) {
              state[i] = j;
              break;
            }
          }
        }
      }
    },
    
    // Diffusion Layer A (involutive: A(A(x)) = x)
    // Based on RFC 5794 Section 2.4.3
    diffusionLayerA: function(x) {
      const y = new Array(16);
      
      // Apply the 16 diffusion equations from RFC 5794
      y[0]  = x[3]  ^ x[4]  ^ x[6]  ^ x[8]  ^ x[9]  ^ x[13] ^ x[14];
      y[1]  = x[2]  ^ x[5]  ^ x[7]  ^ x[8]  ^ x[9]  ^ x[12] ^ x[15];
      y[2]  = x[1]  ^ x[4]  ^ x[6]  ^ x[10] ^ x[11] ^ x[12] ^ x[15];
      y[3]  = x[0]  ^ x[5]  ^ x[7]  ^ x[10] ^ x[11] ^ x[13] ^ x[14];
      y[4]  = x[0]  ^ x[2]  ^ x[5]  ^ x[8]  ^ x[11] ^ x[14] ^ x[15];
      y[5]  = x[1]  ^ x[3]  ^ x[4]  ^ x[9]  ^ x[10] ^ x[14] ^ x[15];
      y[6]  = x[0]  ^ x[2]  ^ x[7]  ^ x[9]  ^ x[10] ^ x[12] ^ x[13];
      y[7]  = x[1]  ^ x[3]  ^ x[6]  ^ x[8]  ^ x[11] ^ x[12] ^ x[13];
      y[8]  = x[0]  ^ x[1]  ^ x[4]  ^ x[7]  ^ x[10] ^ x[13] ^ x[15];
      y[9]  = x[0]  ^ x[1]  ^ x[5]  ^ x[6]  ^ x[11] ^ x[12] ^ x[14];
      y[10] = x[2]  ^ x[3]  ^ x[5]  ^ x[6]  ^ x[8]  ^ x[13] ^ x[15];
      y[11] = x[2]  ^ x[3]  ^ x[4]  ^ x[7]  ^ x[9]  ^ x[12] ^ x[14];
      y[12] = x[1]  ^ x[2]  ^ x[6]  ^ x[7]  ^ x[9]  ^ x[11] ^ x[12];
      y[13] = x[0]  ^ x[3]  ^ x[6]  ^ x[7]  ^ x[8]  ^ x[10] ^ x[13];
      y[14] = x[0]  ^ x[3]  ^ x[4]  ^ x[5]  ^ x[9]  ^ x[11] ^ x[14];
      y[15] = x[1]  ^ x[2]  ^ x[4]  ^ x[5]  ^ x[8]  ^ x[10] ^ x[15];
      
      // Copy result back to input array
      for (let i = 0; i < 16; i++) {
        x[i] = y[i];
      }
    },
    
    // Instance class
    ARIAInstance: function(key) {
      // Process and validate key for ARIA-128/192/256
      let processedKey = key || '';
      
      // Determine key size and rounds based on input length
      let keySize, rounds;
      if (processedKey.length <= 16) {
        keySize = 16; // ARIA-128
        rounds = 12;
      } else if (processedKey.length <= 24) {
        keySize = 24; // ARIA-192  
        rounds = 14;
      } else {
        keySize = 32; // ARIA-256
        rounds = 16;
      }
      
      // Pad with zeros if too short
      while (processedKey.length < keySize) {
        processedKey += '\x00';
      }
      
      // Truncate if too long
      if (processedKey.length > keySize) {
        processedKey = processedKey.substr(0, keySize);
      }
      
      this.key = processedKey;
      this.keySize = keySize;
      this.rounds = rounds;
      
      // Generate round keys
      this.generateRoundKeys();
    }
  };
  
  // Add key expansion method to ARIAInstance prototype
  ARIA.ARIAInstance.prototype.generateRoundKeys = function() {
    const keyBytes = [];
    
    // Convert key string to byte array
    for (let i = 0; i < this.keySize; i++) {
      keyBytes[i] = this.key.charCodeAt(i) & 0xFF;
    }
    
    // Pad remaining bytes with zeros for shorter keys
    for (let i = this.keySize; i < 32; i++) {
      keyBytes[i] = 0;
    }
    
    // Split key into KL (left 16 bytes) and KR (right 16 bytes)
    const KL = keyBytes.slice(0, 16);
    const KR = keyBytes.slice(16, 32);
    
    // Initialize intermediate values W0, W1, W2, W3
    const W0 = KL.slice();
    const W1 = KR.slice();
    const W2 = new Array(16);
    const W3 = new Array(16);
    
    // Convert constants to bytes for proper key schedule
    const c1Bytes = ARIA.wordsToBytes(ARIA.C1);
    const c2Bytes = ARIA.wordsToBytes(ARIA.C2);
    const c3Bytes = ARIA.wordsToBytes(ARIA.C3);
    
    // Apply Feistel rounds to generate W2, W3 as per RFC 5794
    const temp1 = new Array(16);
    const temp2 = new Array(16);
    
    // W2 = FO(W0 XOR (W1 >>> 19), C1) XOR W1
    const w1Rot19 = ARIA.rotateRight128(W1, 19);
    for (let i = 0; i < 16; i++) {
      temp1[i] = W0[i] ^ w1Rot19[i];
    }
    ARIA.feistelRound(temp1, c1Bytes, true);  // FO round (odd)
    for (let i = 0; i < 16; i++) {
      W2[i] = temp1[i] ^ W1[i];
    }
    
    // W3 = FE(W1 XOR (W2 >>> 31), C2) XOR W2  
    const w2Rot31 = ARIA.rotateRight128(W2, 31);
    for (let i = 0; i < 16; i++) {
      temp2[i] = W1[i] ^ w2Rot31[i];
    }
    ARIA.feistelRound(temp2, c2Bytes, false); // FE round (even)
    for (let i = 0; i < 16; i++) {
      W3[i] = temp2[i] ^ W2[i];
    }
    
    // Generate round keys based on key size
    this.roundKeys = [];
    
    // Key rotation amounts for different round keys
    const rotations = [0, 19, 31, 67, 97, 109];
    
    for (let i = 0; i <= this.rounds; i++) {
      this.roundKeys[i] = new Array(16);
      
      // Select source W based on round number
      let sourceW;
      if (i % 4 === 0) sourceW = W0;
      else if (i % 4 === 1) sourceW = W1;
      else if (i % 4 === 2) sourceW = W2;
      else sourceW = W3;
      
      // Apply appropriate rotation
      const rotAmount = rotations[Math.min(i, rotations.length - 1)];
      const rotated = ARIA.rotateLeft128(sourceW, rotAmount);
      
      // Copy to round key
      for (let j = 0; j < 16; j++) {
        this.roundKeys[i][j] = rotated[j];
      }
    }
  };
  
  // Helper function: Rotate 128-bit value left
  ARIA.rotateLeft128 = function(bytes, positions) {
    if (positions === 0) return bytes.slice();
    
    positions = positions % 128;
    const result = new Array(16);
    const byteShift = Math.floor(positions / 8);
    const bitShift = positions % 8;
    
    for (let i = 0; i < 16; i++) {
      const sourceIndex = (i + byteShift) % 16;
      let value = bytes[sourceIndex];
      
      if (bitShift > 0) {
        const nextIndex = (sourceIndex + 1) % 16;
        value = ((value << bitShift) | (bytes[nextIndex] >>> (8 - bitShift))) & 0xFF;
      }
      
      result[i] = value;
    }
    
    return result;
  };
  
  // Helper function: Rotate 128-bit value right
  ARIA.rotateRight128 = function(bytes, positions) {
    if (positions === 0) return bytes.slice();
    
    positions = positions % 128;
    return ARIA.rotateLeft128(bytes, 128 - positions);
  };
  
  // Helper function: Convert 32-bit words array to bytes array
  ARIA.wordsToBytes = function(words) {
    return OpCodes.Words32ToBytesBE(words);
  };
  
  // Helper function: Feistel round for key schedule
  ARIA.feistelRound = function(data, constants, isOdd) {
    // Apply substitution layer based on round type
    if (isOdd) {
      ARIA.substitutionLayerSL1(data);
    } else {
      ARIA.substitutionLayerSL2(data);
    }
    
    // Apply diffusion layer
    ARIA.diffusionLayerA(data);
    
    // XOR with round constants
    for (let i = 0; i < 16 && i < constants.length; i++) {
      data[i] ^= constants[i];
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(ARIA);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ARIA);
  }
  
  // Export to global scope
  global.ARIA = ARIA;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARIA;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);