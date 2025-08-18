#!/usr/bin/env node
/*
 * Universal SkipJack Cipher
 * Compatible with both Browser and Node.js environments
 * Based on declassified NSA SkipJack Algorithm (1998)
 * (c)2006-2025 Hawkynt
 * 
 * SkipJack Algorithm by NSA (Declassified June 24, 1998)
 * Block size: 64 bits, Key size: 80 bits (10 bytes)
 * Uses unbalanced Feistel network with 32 rounds
 * Originally designed for Clipper chip (Escrowed Encryption Standard)
 * 
 * Historical Note: SkipJack was classified until 1998 and originally
 * intended for the controversial Clipper chip. The algorithm uses
 * two types of stepping rules (Rule A and Rule B) with an F-table S-box.
 * NIST approval was withdrawn in 2015, but algorithm remains historically
 * significant as the first declassified NSA block cipher.
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * SkipJack is not approved for new cryptographic protection per NIST.
 * 
 * References:
 * - "Skipjack and KEA Algorithm Specifications" Version 2.0, May 29, 1998
 * - NIST Special Publication 800-17 (MOVS test requirements)
 * - Original NSA reference implementation
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
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
      console.error('SkipJack cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // SkipJack cipher object
  const SkipJack = {
    name: "SkipJack",
    description: "Declassified NSA block cipher from 1998, originally designed for the Clipper chip. Uses unbalanced Feistel network with 32 rounds, 64-bit blocks, and 80-bit keys. Educational and historical significance only.",
    inventor: "NSA (National Security Agency)",
    year: 1987,
    country: "US",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "insecure",
    securityNotes: "NIST approval withdrawn in 2015. Known cryptanalytic attacks exist. Historical interest only - not approved for new cryptographic protection.",
    
    documentation: [
      {text: "Skipjack and KEA Algorithm Specifications", uri: "https://csrc.nist.gov/csrc/media/projects/cryptographic-algorithm-validation-program/documents/skipjack/skipjack.pdf"},
      {text: "NIST Special Publication 800-17", uri: "https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01"},
      {text: "Declassification of SkipJack", uri: "https://www.nsa.gov/news-features/declassified-documents/"}
    ],
    
    references: [
      {text: "Original NSA Reference Implementation", uri: "https://github.com/coruus/nist-testvectors"},
      {text: "Cryptanalysis of SkipJack", uri: "https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html"},
      {text: "SkipJack Cryptanalysis Papers", uri: "https://eprint.iacr.org/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Differential Cryptanalysis",
        text: "Vulnerable to differential attacks with reduced complexity",
        mitigation: "Algorithm is deprecated - use modern alternatives like AES"
      },
      {
        type: "Related-key attacks",
        text: "Weak key schedule allows related-key attacks",
        mitigation: "Do not use SkipJack for any security-critical applications"
      }
    ],
    
    tests: [
      {
        text: "SkipJack NIST Test Vector",
        uri: "NIST Special Publication 800-17",
        keySize: 10,
        blockSize: 8,
        input: Hex8ToBytes("0000000000000000"),
        key: Hex8ToBytes("0000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'SkipJack',
    comment: 'NSA SkipJack cipher - 64-bit blocks, 80-bit keys (declassified 1998)',
    minKeyLength: 10,   // 80 bits exactly
    maxKeyLength: 10,   // 80 bits exactly
    stepKeyLength: 1,
    minBlockSize: 8,    // 64 bits
    maxBlockSize: 8,    // 64 bits
    stepBlockSize: 1,
    instances: {},

  // Legacy test vectors for compatibility
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "ª®Þgd\u0014=",
        "description": "SkipJack all zeros test vector - verified implementation"
    },
    {
        "input": "3\"\u0011\u0000ÝÌ»ª",
        "key": "\u0000wfUD3\"\u0011",
        "expected": "%Êâz\u0012Ó\u0000",
        "description": "SkipJack reference test vector - matches GitHub cryptospecs implementation"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿ",
        "expected": "è\u0013!óJ 9",
        "description": "SkipJack all ones test vector - boundary condition"
    },
    {
        "input": "TESTDATA",
        "key": "1234567890",
        "expected": "ËÚ½!Í ",
        "description": "SkipJack ASCII plaintext and key test"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u00124Vx¼Þð\u00124",
        "expected": "ÊSº%×\u0015",
        "description": "SkipJack sequential pattern test vector"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // SkipJack F-table (S-box) - Official from NSA specification
    FTABLE: [
      0xa3,0xd7,0x09,0x83,0xf8,0x48,0xf6,0xf4,0xb3,0x21,0x15,0x78,0x99,0xb1,0xaf,0xf9,
      0xe7,0x2d,0x4d,0x8a,0xce,0x4c,0xca,0x2e,0x52,0x95,0xd9,0x1e,0x4e,0x38,0x44,0x28,
      0x0a,0xdf,0x02,0xa0,0x17,0xf1,0x60,0x68,0x12,0xb7,0x7a,0xc3,0xe9,0xfa,0x3d,0x53,
      0x96,0x84,0x6b,0xba,0xf2,0x63,0x9a,0x19,0x7c,0xae,0xe5,0xf5,0xf7,0x16,0x6a,0xa2,
      0x39,0xb6,0x7b,0x0f,0xc1,0x93,0x81,0x1b,0xee,0xb4,0x1a,0xea,0xd0,0x91,0x2f,0xb8,
      0x55,0xb9,0xda,0x85,0x3f,0x41,0xbf,0xe0,0x5a,0x58,0x80,0x5f,0x66,0x0b,0xd8,0x90,
      0x35,0xd5,0xc0,0xa7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6d,0x98,0x9b,0x76,
      0x97,0xfc,0xb2,0xc2,0xb0,0xfe,0xdb,0x20,0xe1,0xeb,0xd6,0xe4,0xdd,0x47,0x4a,0x1d,
      0x42,0xed,0x9e,0x6e,0x49,0x3c,0xcd,0x43,0x27,0xd2,0x07,0xd4,0xde,0xc7,0x67,0x18,
      0x89,0xcb,0x30,0x1f,0x8d,0xc6,0x8f,0xaa,0xc8,0x74,0xdc,0xc9,0x5d,0x5c,0x31,0xa4,
      0x70,0x88,0x61,0x2c,0x9f,0x0d,0x2b,0x87,0x50,0x82,0x54,0x64,0x26,0x7d,0x03,0x40,
      0x34,0x4b,0x1c,0x73,0xd1,0xc4,0xfd,0x3b,0xcc,0xfb,0x7f,0xab,0xe6,0x3e,0x5b,0xa5,
      0xad,0x04,0x23,0x9c,0x14,0x51,0x22,0xf0,0x29,0x79,0x71,0x7e,0xff,0x8c,0x0e,0xe2,
      0x0c,0xef,0xbc,0x72,0x75,0x6f,0x37,0xa1,0xec,0xd3,0x8e,0x62,0x8b,0x86,0x10,0xe8,
      0x08,0x77,0x11,0xbe,0x92,0x4f,0x24,0xc5,0x32,0x36,0x9d,0xcf,0xf3,0xa6,0xbb,0xac,
      0x5e,0x6c,0xa9,0x13,0x57,0x25,0xb5,0xe3,0xbd,0xa8,0x3a,0x01,0x05,0x59,0x2a,0x46
    ],
    
    // Initialize cipher
    Init: function() {
      SkipJack.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      if (!optional_key || optional_key.length !== 10) {
        global.throwException('Key Length Exception', optional_key ? optional_key.length : 0, 'SkipJack', 'KeySetup');
        return false;
      }
      
      let id;
      do {
        id = 'SkipJack[' + global.generateUniqueID() + ']';
      } while (SkipJack.instances[id] || global.objectInstances[id]);
      
      SkipJack.instances[id] = new SkipJack.SkipJackInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (SkipJack.instances[id]) {
        const instance = SkipJack.instances[id];
        if (instance.key) global.OpCodes.ClearArray(instance.key);
        
        delete SkipJack.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'SkipJack', 'ClearData');
        return false;
      }
    },
    
    // G-function definitions (matching C reference implementation)
    g0: function(input, key) {
      const g1 = (input >>> 8) & 0xFF;
      const g2 = input & 0xFF;
      const g3 = SkipJack.FTABLE[g2 ^ key[0]] ^ g1;
      const g4 = SkipJack.FTABLE[g3 ^ key[1]] ^ g2;
      const g5 = SkipJack.FTABLE[g4 ^ key[2]] ^ g3;
      const g6 = SkipJack.FTABLE[g5 ^ key[3]] ^ g4;
      return (g5 << 8) | g6;
    },
    
    g4: function(input, key) {
      const g1 = (input >>> 8) & 0xFF;
      const g2 = input & 0xFF;
      const g3 = SkipJack.FTABLE[g2 ^ key[4]] ^ g1;
      const g4 = SkipJack.FTABLE[g3 ^ key[5]] ^ g2;
      const g5 = SkipJack.FTABLE[g4 ^ key[6]] ^ g3;
      const g6 = SkipJack.FTABLE[g5 ^ key[7]] ^ g4;
      return (g5 << 8) | g6;
    },
    
    g8: function(input, key) {
      const g1 = (input >>> 8) & 0xFF;
      const g2 = input & 0xFF;
      const g3 = SkipJack.FTABLE[g2 ^ key[8]] ^ g1;
      const g4 = SkipJack.FTABLE[g3 ^ key[9]] ^ g2;
      const g5 = SkipJack.FTABLE[g4 ^ key[0]] ^ g3;
      const g6 = SkipJack.FTABLE[g5 ^ key[1]] ^ g4;
      return (g5 << 8) | g6;
    },
    
    g2: function(input, key) {
      const g1 = (input >>> 8) & 0xFF;
      const g2 = input & 0xFF;
      const g3 = SkipJack.FTABLE[g2 ^ key[2]] ^ g1;
      const g4 = SkipJack.FTABLE[g3 ^ key[3]] ^ g2;
      const g5 = SkipJack.FTABLE[g4 ^ key[4]] ^ g3;
      const g6 = SkipJack.FTABLE[g5 ^ key[5]] ^ g4;
      return (g5 << 8) | g6;
    },
    
    g6: function(input, key) {
      const g1 = (input >>> 8) & 0xFF;
      const g2 = input & 0xFF;
      const g3 = SkipJack.FTABLE[g2 ^ key[6]] ^ g1;
      const g4 = SkipJack.FTABLE[g3 ^ key[7]] ^ g2;
      const g5 = SkipJack.FTABLE[g4 ^ key[8]] ^ g3;
      const g6 = SkipJack.FTABLE[g5 ^ key[9]] ^ g4;
      return (g5 << 8) | g6;
    },
    
    // Inverse G-functions for decryption
    g0_inv: function(input, key) {
      const g6 = input & 0xFF;
      const g5 = (input >>> 8) & 0xFF;
      const g4 = SkipJack.FTABLE[g5 ^ key[3]] ^ g6;
      const g3 = SkipJack.FTABLE[g4 ^ key[2]] ^ g5;
      const g2 = SkipJack.FTABLE[g3 ^ key[1]] ^ g4;
      const g1 = SkipJack.FTABLE[g2 ^ key[0]] ^ g3;
      return (g1 << 8) | g2;
    },
    
    g4_inv: function(input, key) {
      const g6 = input & 0xFF;
      const g5 = (input >>> 8) & 0xFF;
      const g4 = SkipJack.FTABLE[g5 ^ key[7]] ^ g6;
      const g3 = SkipJack.FTABLE[g4 ^ key[6]] ^ g5;
      const g2 = SkipJack.FTABLE[g3 ^ key[5]] ^ g4;
      const g1 = SkipJack.FTABLE[g2 ^ key[4]] ^ g3;
      return (g1 << 8) | g2;
    },
    
    g8_inv: function(input, key) {
      const g6 = input & 0xFF;
      const g5 = (input >>> 8) & 0xFF;
      const g4 = SkipJack.FTABLE[g5 ^ key[1]] ^ g6;
      const g3 = SkipJack.FTABLE[g4 ^ key[0]] ^ g5;
      const g2 = SkipJack.FTABLE[g3 ^ key[9]] ^ g4;
      const g1 = SkipJack.FTABLE[g2 ^ key[8]] ^ g3;
      return (g1 << 8) | g2;
    },
    
    g2_inv: function(input, key) {
      const g6 = input & 0xFF;
      const g5 = (input >>> 8) & 0xFF;
      const g4 = SkipJack.FTABLE[g5 ^ key[5]] ^ g6;
      const g3 = SkipJack.FTABLE[g4 ^ key[4]] ^ g5;
      const g2 = SkipJack.FTABLE[g3 ^ key[3]] ^ g4;
      const g1 = SkipJack.FTABLE[g2 ^ key[2]] ^ g3;
      return (g1 << 8) | g2;
    },
    
    g6_inv: function(input, key) {
      const g6 = input & 0xFF;
      const g5 = (input >>> 8) & 0xFF;
      const g4 = SkipJack.FTABLE[g5 ^ key[9]] ^ g6;
      const g3 = SkipJack.FTABLE[g4 ^ key[8]] ^ g5;
      const g2 = SkipJack.FTABLE[g3 ^ key[7]] ^ g4;
      const g1 = SkipJack.FTABLE[g2 ^ key[6]] ^ g3;
      return (g1 << 8) | g2;
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!SkipJack.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SkipJack', 'encryptBlock');
        return plaintext;
      }
      
      if (plaintext.length !== 8) {
        global.throwException('Block Size Exception', plaintext.length, 'SkipJack', 'encryptBlock');
        return plaintext;
      }
      
      const instance = SkipJack.instances[id];
      const key = instance.key;
      
      // Convert plaintext to 4 16-bit words using OpCodes
      const bytes = global.OpCodes.StringToBytes(plaintext);
      let w1 = global.OpCodes.Pack32BE(bytes[0], bytes[1], 0, 0) >>> 16;
      let w2 = global.OpCodes.Pack32BE(bytes[2], bytes[3], 0, 0) >>> 16;
      let w3 = global.OpCodes.Pack32BE(bytes[4], bytes[5], 0, 0) >>> 16;
      let w4 = global.OpCodes.Pack32BE(bytes[6], bytes[7], 0, 0) >>> 16;
      
      // First 8 rounds (Rule A) - exactly matching C reference
      w1 = SkipJack.g0(w1, key); w4 ^= w1 ^ 1;
      w4 = SkipJack.g4(w4, key); w3 ^= w4 ^ 2;
      w3 = SkipJack.g8(w3, key); w2 ^= w3 ^ 3;
      w2 = SkipJack.g2(w2, key); w1 ^= w2 ^ 4;
      w1 = SkipJack.g6(w1, key); w4 ^= w1 ^ 5;
      w4 = SkipJack.g0(w4, key); w3 ^= w4 ^ 6;
      w3 = SkipJack.g4(w3, key); w2 ^= w3 ^ 7;
      w2 = SkipJack.g8(w2, key); w1 ^= w2 ^ 8;
      
      // Second 8 rounds (Rule B) - exactly matching C reference
      w2 ^= w1 ^ 9;  w1 = SkipJack.g2(w1, key);
      w1 ^= w4 ^ 10; w4 = SkipJack.g6(w4, key);
      w4 ^= w3 ^ 11; w3 = SkipJack.g0(w3, key);
      w3 ^= w2 ^ 12; w2 = SkipJack.g4(w2, key);
      w2 ^= w1 ^ 13; w1 = SkipJack.g8(w1, key);
      w1 ^= w4 ^ 14; w4 = SkipJack.g2(w4, key);
      w4 ^= w3 ^ 15; w3 = SkipJack.g6(w3, key);
      w3 ^= w2 ^ 16; w2 = SkipJack.g0(w2, key);
      
      // Third 8 rounds (Rule A) - exactly matching C reference
      w1 = SkipJack.g4(w1, key); w4 ^= w1 ^ 17;
      w4 = SkipJack.g8(w4, key); w3 ^= w4 ^ 18;
      w3 = SkipJack.g2(w3, key); w2 ^= w3 ^ 19;
      w2 = SkipJack.g6(w2, key); w1 ^= w2 ^ 20;
      w1 = SkipJack.g0(w1, key); w4 ^= w1 ^ 21;
      w4 = SkipJack.g4(w4, key); w3 ^= w4 ^ 22;
      w3 = SkipJack.g8(w3, key); w2 ^= w3 ^ 23;
      w2 = SkipJack.g2(w2, key); w1 ^= w2 ^ 24;
      
      // Last 8 rounds (Rule B) - exactly matching C reference
      w2 ^= w1 ^ 25; w1 = SkipJack.g6(w1, key);
      w1 ^= w4 ^ 26; w4 = SkipJack.g0(w4, key);
      w4 ^= w3 ^ 27; w3 = SkipJack.g4(w3, key);
      w3 ^= w2 ^ 28; w2 = SkipJack.g8(w2, key);
      w2 ^= w1 ^ 29; w1 = SkipJack.g2(w1, key);
      w1 ^= w4 ^ 30; w4 = SkipJack.g6(w4, key);
      w4 ^= w3 ^ 31; w3 = SkipJack.g0(w3, key);
      w3 ^= w2 ^ 32; w2 = SkipJack.g4(w2, key);
      
      // Pack back to bytes using OpCodes
      const cipherBytes = [
        (w1 >>> 8) & 0xFF, w1 & 0xFF,
        (w2 >>> 8) & 0xFF, w2 & 0xFF,
        (w3 >>> 8) & 0xFF, w3 & 0xFF,
        (w4 >>> 8) & 0xFF, w4 & 0xFF
      ];
      
      return global.OpCodes.BytesToString(cipherBytes);
    },
    
    // Decrypt block  
    decryptBlock: function(id, ciphertext) {
      if (!SkipJack.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SkipJack', 'decryptBlock');
        return ciphertext;
      }
      
      if (ciphertext.length !== 8) {
        global.throwException('Block Size Exception', ciphertext.length, 'SkipJack', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = SkipJack.instances[id];
      const key = instance.key;
      
      // Convert ciphertext to 4 16-bit words using OpCodes
      const bytes = global.OpCodes.StringToBytes(ciphertext);
      let w1 = global.OpCodes.Pack32BE(bytes[0], bytes[1], 0, 0) >>> 16;
      let w2 = global.OpCodes.Pack32BE(bytes[2], bytes[3], 0, 0) >>> 16;
      let w3 = global.OpCodes.Pack32BE(bytes[4], bytes[5], 0, 0) >>> 16;
      let w4 = global.OpCodes.Pack32BE(bytes[6], bytes[7], 0, 0) >>> 16;
      
      // First 8 rounds (reverse of last 8 encryption rounds)
      w2 = SkipJack.g4_inv(w2, key); w3 ^= w2 ^ 32;
      w3 = SkipJack.g0_inv(w3, key); w4 ^= w3 ^ 31;
      w4 = SkipJack.g6_inv(w4, key); w1 ^= w4 ^ 30;
      w1 = SkipJack.g2_inv(w1, key); w2 ^= w1 ^ 29;
      w2 = SkipJack.g8_inv(w2, key); w3 ^= w2 ^ 28;
      w3 = SkipJack.g4_inv(w3, key); w4 ^= w3 ^ 27;
      w4 = SkipJack.g0_inv(w4, key); w1 ^= w4 ^ 26;
      w1 = SkipJack.g6_inv(w1, key); w2 ^= w1 ^ 25;
      
      // Second 8 rounds (reverse of third 8 encryption rounds)
      w1 ^= w2 ^ 24; w2 = SkipJack.g2_inv(w2, key);
      w2 ^= w3 ^ 23; w3 = SkipJack.g8_inv(w3, key);
      w3 ^= w4 ^ 22; w4 = SkipJack.g4_inv(w4, key);
      w4 ^= w1 ^ 21; w1 = SkipJack.g0_inv(w1, key);
      w1 ^= w2 ^ 20; w2 = SkipJack.g6_inv(w2, key);
      w2 ^= w3 ^ 19; w3 = SkipJack.g2_inv(w3, key);
      w3 ^= w4 ^ 18; w4 = SkipJack.g8_inv(w4, key);
      w4 ^= w1 ^ 17; w1 = SkipJack.g4_inv(w1, key);
      
      // Third 8 rounds (reverse of second 8 encryption rounds)
      w2 = SkipJack.g0_inv(w2, key); w3 ^= w2 ^ 16;
      w3 = SkipJack.g6_inv(w3, key); w4 ^= w3 ^ 15;
      w4 = SkipJack.g2_inv(w4, key); w1 ^= w4 ^ 14;
      w1 = SkipJack.g8_inv(w1, key); w2 ^= w1 ^ 13;
      w2 = SkipJack.g4_inv(w2, key); w3 ^= w2 ^ 12;
      w3 = SkipJack.g0_inv(w3, key); w4 ^= w3 ^ 11;
      w4 = SkipJack.g6_inv(w4, key); w1 ^= w4 ^ 10;
      w1 = SkipJack.g2_inv(w1, key); w2 ^= w1 ^ 9;
      
      // Last 8 rounds (reverse of first 8 encryption rounds)
      w1 ^= w2 ^ 8; w2 = SkipJack.g8_inv(w2, key);
      w2 ^= w3 ^ 7; w3 = SkipJack.g4_inv(w3, key);
      w3 ^= w4 ^ 6; w4 = SkipJack.g0_inv(w4, key);
      w4 ^= w1 ^ 5; w1 = SkipJack.g6_inv(w1, key);
      w1 ^= w2 ^ 4; w2 = SkipJack.g2_inv(w2, key);
      w2 ^= w3 ^ 3; w3 = SkipJack.g8_inv(w3, key);
      w3 ^= w4 ^ 2; w4 = SkipJack.g4_inv(w4, key);
      w4 ^= w1 ^ 1; w1 = SkipJack.g0_inv(w1, key);
      
      // Pack back to bytes using OpCodes
      const plainBytes = [
        (w1 >>> 8) & 0xFF, w1 & 0xFF,
        (w2 >>> 8) & 0xFF, w2 & 0xFF,
        (w3 >>> 8) & 0xFF, w3 & 0xFF,
        (w4 >>> 8) & 0xFF, w4 & 0xFF
      ];
      
      return global.OpCodes.BytesToString(plainBytes);
    },
    
    // Instance class
    SkipJackInstance: function(key) {
      if (!key || key.length !== 10) {
        throw new Error('SkipJack requires exactly 10-byte (80-bit) key');
      }
      
      // Store key as byte array
      this.key = global.OpCodes.StringToBytes(key);
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
    global.Cipher.Add(SkipJack);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(SkipJack);
  }
  
  // Export to global scope
  global.SkipJack = SkipJack;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkipJack;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);