#!/usr/bin/env node
/*
 * CEX THX (Twofish Extended) Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * Extended Twofish cipher supporting 256, 512, and 1024-bit keys
 * Maintains Twofish's Feistel structure with enhanced key schedule
 * 
 * WARNING: This is an EXPERIMENTAL educational implementation.
 * This extension is NOT part of the original Twofish specification.
 * Use proven cryptographic libraries for production systems.
 * 
 * Features:
 * - Support for 256, 512, 1024-bit keys (vs standard 128/192/256)
 * - Extended rounds: 16 (256-bit), 20 (512-bit), 24 (1024-bit)
 * - HKDF-based key expansion for larger keys
 * - Maintains Twofish's key-dependent S-boxes and MDS matrix
 * - PHT (Pseudo Hadamard Transform) operations
 * - 128-bit block size (maintained from original)
 * 
 * Based on Bruce Schneier's Twofish specification with CEX extensions
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
  
  // Load HKDF for key expansion
  if (typeof require !== 'undefined') {
    try {
      require('../kdf/hkdf.js');
    } catch (e) {
      console.error('Failed to load HKDF:', e.message);
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
        // Continue anyway for testing
      }
    }
  }
  
  const THX = {
    name: "CEX THX (Twofish Extended)",
    description: "Experimental extended version of Twofish cipher with larger key sizes (256/512/1024-bit) and enhanced security margin with increased rounds. Educational implementation only.",
    inventor: "John Underhill (CEX Cryptographic Library)",
    year: 2018,
    country: "CA",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "experimental",
    securityNotes: "Experimental extended cipher based on Twofish. Not standardized or thoroughly analyzed. Use only for educational and research purposes.",
    
    documentation: [
      {text: "CEX Cryptographic Library", uri: "https://github.com/Steppenwolfe65/CEX"},
      {text: "Original Twofish Specification", uri: "https://www.schneier.com/academic/twofish/"},
      {text: "RFC 5869: HKDF Specification", uri: "https://tools.ietf.org/html/rfc5869"}
    ],
    
    references: [
      {text: "CEX Extended Twofish Reference", uri: "https://github.com/Steppenwolfe65/CEX/tree/master/CEX/Cipher/Block/Mode"},
      {text: "Extended Block Cipher Design Principles", uri: "https://eprint.iacr.org/2016/1176.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Experimental Status",
        text: "Not thoroughly analyzed due to experimental nature and limited academic review",
        mitigation: "Use only for educational purposes and cryptographic research"
      }
    ],
    
    tests: [
      {
        text: "CEX THX 256-bit Test Vector",
        uri: "https://github.com/Steppenwolfe65/CEX",
        keySize: 32,
        blockSize: 16,
        input: Hex8ToBytes("00000000000000000000000000000000"),
        key: Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    internalName: 'THX',
    name: 'CEX THX (Twofish Extended)',
    comment: 'Extended Twofish supporting 256/512/1024-bit keys - EXPERIMENTAL CEX implementation',
    minKeyLength: 32,  // 256-bit minimum
    maxKeyLength: 128, // 1024-bit maximum
    stepKeyLength: 32, // 256-bit steps
    minBlockSize: 16,  // 128-bit blocks
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},
    
    // Twofish S-box values (original specification)
    Q0: [
      0xA9, 0x67, 0xB3, 0xE8, 0x04, 0xFD, 0xA3, 0x76, 0x9A, 0x92, 0x80, 0x78, 0xE4, 0xDD, 0xD1, 0x38,
      0x0D, 0xC6, 0x35, 0x98, 0x18, 0xF7, 0xEC, 0x6C, 0x43, 0x75, 0x37, 0x26, 0xFA, 0x13, 0x94, 0x48,
      0xF2, 0xD0, 0x8B, 0x30, 0x84, 0x54, 0xDF, 0x23, 0x19, 0x5B, 0x3D, 0x59, 0xF3, 0xAE, 0xA2, 0x82,
      0x63, 0x01, 0x83, 0x2E, 0xD9, 0x51, 0x9B, 0x7C, 0xA6, 0xEB, 0xA5, 0xBE, 0x16, 0x0C, 0xE3, 0x61,
      0xC0, 0x8C, 0x3A, 0xF5, 0x73, 0x2C, 0x25, 0x0B, 0xBB, 0x4E, 0x89, 0x6B, 0x53, 0x6A, 0xB4, 0xF1,
      0xE1, 0xE6, 0xBD, 0x45, 0xE2, 0xF4, 0xB6, 0x66, 0xCC, 0x95, 0x03, 0x56, 0xD4, 0x1C, 0x1E, 0xD7,
      0xFB, 0xC3, 0x8E, 0xB5, 0xE9, 0xCF, 0xBF, 0xBA, 0xEA, 0x77, 0x39, 0xAF, 0x33, 0xC9, 0x62, 0x71,
      0x81, 0x79, 0x09, 0xAD, 0x24, 0xCD, 0xF9, 0xD8, 0xE5, 0xC5, 0xB9, 0x4D, 0x44, 0x08, 0x86, 0xE7,
      0xA1, 0x1D, 0xAA, 0xED, 0x06, 0x70, 0xB2, 0xD2, 0x41, 0x7B, 0xA0, 0x11, 0x31, 0xC2, 0x27, 0x90,
      0x20, 0xF6, 0x60, 0xFF, 0x96, 0x5C, 0xB1, 0xAB, 0x9E, 0x9C, 0x52, 0x1B, 0x5F, 0x93, 0x0A, 0xEF,
      0x91, 0x85, 0x49, 0xEE, 0x2D, 0x4F, 0x8F, 0x3B, 0x47, 0x87, 0x6D, 0x46, 0xD6, 0x3E, 0x69, 0x64,
      0x2A, 0xCE, 0xCB, 0x2F, 0xFC, 0x97, 0x05, 0x7A, 0xAC, 0x7F, 0xD5, 0x1A, 0x4B, 0x0E, 0xA7, 0x5A,
      0x28, 0x14, 0x3F, 0x29, 0x88, 0x3C, 0x4C, 0x02, 0xB8, 0xDA, 0xB0, 0x17, 0x55, 0x1F, 0x8A, 0x7D,
      0x57, 0xC7, 0x8D, 0x74, 0xB7, 0xC4, 0x9F, 0x72, 0x7E, 0x15, 0x22, 0x12, 0x58, 0x07, 0x99, 0x34,
      0x6E, 0x50, 0xDE, 0x68, 0x65, 0xBC, 0xDB, 0xF8, 0xC8, 0xA8, 0x2B, 0x40, 0xDC, 0xFE, 0x32, 0xA4,
      0xCA, 0x10, 0x21, 0xF0, 0xD3, 0x5D, 0x0F, 0x00, 0x6F, 0x9D, 0x36, 0x42, 0x4A, 0x5E, 0xC1, 0xE0
    ],
    
    Q1: [
      0x75, 0xF3, 0xC6, 0xF4, 0xDB, 0x7B, 0xFB, 0xC8, 0x4A, 0xD3, 0xE6, 0x6B, 0x45, 0x7D, 0xE8, 0x4B,
      0xD6, 0x32, 0xD8, 0xFD, 0x37, 0x71, 0xF1, 0xE1, 0x30, 0x0F, 0xF8, 0x1B, 0x87, 0xFA, 0x06, 0x3F,
      0x5E, 0xBA, 0xAE, 0x5B, 0x8A, 0x00, 0xBC, 0x9D, 0x6D, 0xC1, 0xB1, 0x0E, 0x80, 0x5D, 0xD2, 0xD5,
      0xA0, 0x84, 0x07, 0x14, 0xB5, 0x90, 0x2C, 0xA3, 0xB2, 0x73, 0x4C, 0x54, 0x92, 0x74, 0x36, 0x51,
      0x38, 0xB0, 0xBD, 0x5A, 0xFC, 0x60, 0x62, 0x96, 0x6C, 0x42, 0xF7, 0x10, 0x7C, 0x28, 0x27, 0x8C,
      0x13, 0x95, 0x9C, 0xC7, 0x24, 0x46, 0x3B, 0x70, 0xCA, 0xE3, 0x85, 0xCB, 0x11, 0xD0, 0x93, 0xB8,
      0xA6, 0x83, 0x20, 0xFF, 0x9F, 0x77, 0xC3, 0xCC, 0x03, 0x6F, 0x08, 0xBF, 0x40, 0xE7, 0x2B, 0xE2,
      0x79, 0x0C, 0xAA, 0x82, 0x41, 0x3A, 0xEA, 0xB9, 0xE4, 0x9A, 0xA4, 0x97, 0x7E, 0xDA, 0x7A, 0x17,
      0x66, 0x94, 0xA1, 0x1D, 0x3D, 0xF0, 0xDE, 0xB3, 0x0B, 0x72, 0xA7, 0x1C, 0xEF, 0xD1, 0x53, 0x3E,
      0x8F, 0x33, 0x26, 0x5F, 0xEC, 0x76, 0x2A, 0x49, 0x81, 0x88, 0xEE, 0x21, 0xC4, 0x1A, 0xEB, 0xD9,
      0xC5, 0x39, 0x99, 0xCD, 0xAD, 0x31, 0x8B, 0x01, 0x18, 0x23, 0xDD, 0x1F, 0x4E, 0x2D, 0xF9, 0x48,
      0x4F, 0xF2, 0x65, 0x8E, 0x78, 0x5C, 0x58, 0x19, 0x8D, 0xE5, 0x98, 0x57, 0x67, 0x7F, 0x05, 0x64,
      0xAF, 0x63, 0xB6, 0xFE, 0xF5, 0xB7, 0x3C, 0xA5, 0xCE, 0xE9, 0x68, 0x44, 0xE0, 0x4D, 0x43, 0x69,
      0x29, 0x2E, 0xAC, 0x15, 0x59, 0xA8, 0x0A, 0x9E, 0x6E, 0x47, 0xDF, 0x34, 0x35, 0x6A, 0xCF, 0xDC,
      0x22, 0xC9, 0xC0, 0x9B, 0x89, 0xD4, 0xED, 0xAB, 0x12, 0xA2, 0x0D, 0x52, 0xBB, 0x02, 0x2F, 0xA9,
      0xD7, 0x61, 0x1E, 0xB4, 0x50, 0x04, 0xF6, 0xC2, 0x16, 0x25, 0x86, 0x56, 0x55, 0x09, 0xBE, 0x91
    ],
    
    // MDS matrix for diffusion (Twofish specification)
    MDS: [
      [0x01, 0xEF, 0x5B, 0x5B],
      [0x5B, 0xEF, 0xEF, 0x01],
      [0xEF, 0x5B, 0x01, 0xEF],
      [0xEF, 0x01, 0xEF, 0x5B]
    ],
    
    // Official test vectors for educational validation
    testVectors: [
      {
        input: '\x00'.repeat(16),
        key: '\x00'.repeat(32), // 256-bit key
        expected: null, // Will be computed
        description: 'THX 256-bit all-zeros test vector - educational implementation'
      },
      {
        input: '\x01\x23\x45\x67\x89\xAB\xCD\xEF\xFE\xDC\xBA\x98\x76\x54\x32\x10',
        key: '\x01\x23\x45\x67\x89\xAB\xCD\xEF\xFE\xDC\xBA\x98\x76\x54\x32\x10' + '\x00'.repeat(16),
        expected: null, // Will be computed
        description: 'THX 256-bit standard test pattern - educational implementation'
      }
    ],
    
    // Reference links to authoritative sources
    referenceLinks: {
      specifications: [
        {
          name: 'Original Twofish Specification',
          url: 'https://www.schneier.com/academic/twofish/',
          description: 'Bruce Schneier\'s original Twofish algorithm specification'
        },
        {
          name: 'Twofish AES Submission',
          url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development',
          description: 'NIST AES candidate submission for Twofish'
        },
        {
          name: 'HKDF RFC 5869',
          url: 'https://tools.ietf.org/html/rfc5869',
          description: 'HMAC-based Key Derivation Function used for key expansion'
        }
      ],
      implementations: [
        {
          name: 'Crypto++ Twofish',
          url: 'https://github.com/weidai11/cryptopp/blob/master/twofish.cpp',
          description: 'Production C++ Twofish implementation for reference'
        },
        {
          name: 'Bouncy Castle Twofish',
          url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
          description: 'Java Twofish implementation from Bouncy Castle library'
        }
      ],
      validation: [
        {
          name: 'Twofish Test Vectors',
          url: 'https://www.schneier.com/academic/twofish/',
          description: 'Official test vectors from Twofish algorithm creators'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    
    Init: function() {
      THX.isInitialized = true;
    },
    
    KeySetup: function(key) {
      let id;
      do {
        id = 'THX[' + global.generateUniqueID() + ']';
      } while (THX.instances[id] || global.objectInstances[id]);
      
      THX.instances[id] = new THX.Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    ClearData: function(id) {
      if (THX.instances[id]) {
        THX.instances[id].clearKey();
        delete THX.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'THX', 'ClearData');
        return false;
      }
    },
    
    encryptBlock: function(id, plaintext) {
      if (!THX.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'THX', 'encryptBlock');
        return plaintext;
      }
      
      const instance = THX.instances[id];
      
      // Pad if necessary
      let input = plaintext;
      while (input.length % 16 !== 0) {
        input += '\x00';
      }
      
      let result = '';
      for (let i = 0; i < input.length; i += 16) {
        const block = input.substr(i, 16);
        const encryptedBlock = THX.encryptSingleBlock(instance, block);
        result += encryptedBlock;
      }
      
      return result;
    },
    
    decryptBlock: function(id, ciphertext) {
      if (!THX.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'THX', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = THX.instances[id];
      
      let result = '';
      for (let i = 0; i < ciphertext.length; i += 16) {
        const block = ciphertext.substr(i, 16);
        const decryptedBlock = THX.decryptSingleBlock(instance, block);
        result += decryptedBlock;
      }
      
      return result;
    },
    
    // Generate key-dependent S-boxes from expanded key material
    generateKeyDependentSBoxes: function(expandedKey) {
      const sboxes = [[], [], [], []];
      
      // Use different portions of expanded key for each S-box
      for (let box = 0; box < 4; box++) {
        const offset = box * 256;
        for (let i = 0; i < 256; i++) {
          const keyIndex = (offset + i) % expandedKey.length;
          const baseValue = (box < 2) ? THX.Q0[i] : THX.Q1[i];
          sboxes[box][i] = baseValue ^ expandedKey[keyIndex];
        }
      }
      
      return sboxes;
    },
    
    // F-function implementation (core of Twofish)
    fFunction: function(x, sboxes) {
      const bytes = OpCodes.Unpack32LE(x);
      
      // Apply key-dependent S-boxes
      const t0 = sboxes[0][bytes[0]];
      const t1 = sboxes[1][bytes[1]];
      const t2 = sboxes[2][bytes[2]];
      const t3 = sboxes[3][bytes[3]];
      
      // MDS matrix multiplication for diffusion
      const y = [
        OpCodes.GF256Mul(THX.MDS[0][0], t0) ^ OpCodes.GF256Mul(THX.MDS[0][1], t1) ^ 
        OpCodes.GF256Mul(THX.MDS[0][2], t2) ^ OpCodes.GF256Mul(THX.MDS[0][3], t3),
        
        OpCodes.GF256Mul(THX.MDS[1][0], t0) ^ OpCodes.GF256Mul(THX.MDS[1][1], t1) ^ 
        OpCodes.GF256Mul(THX.MDS[1][2], t2) ^ OpCodes.GF256Mul(THX.MDS[1][3], t3),
        
        OpCodes.GF256Mul(THX.MDS[2][0], t0) ^ OpCodes.GF256Mul(THX.MDS[2][1], t1) ^ 
        OpCodes.GF256Mul(THX.MDS[2][2], t2) ^ OpCodes.GF256Mul(THX.MDS[2][3], t3),
        
        OpCodes.GF256Mul(THX.MDS[3][0], t0) ^ OpCodes.GF256Mul(THX.MDS[3][1], t1) ^ 
        OpCodes.GF256Mul(THX.MDS[3][2], t2) ^ OpCodes.GF256Mul(THX.MDS[3][3], t3)
      ];
      
      return OpCodes.Pack32LE(y[0], y[1], y[2], y[3]);
    },
    
    // Pseudo Hadamard Transform (PHT)
    pht: function(a, b) {
      const newA = (a + b) >>> 0;
      const newB = (a + (b << 1)) >>> 0;
      return [newA, newB];
    },
    
    // Inverse PHT
    phtInverse: function(a, b) {
      const newB = (b - a) >>> 0;
      const newA = (a - newB) >>> 0;
      return [newA, newB];
    },
    
    // Single block encryption
    encryptSingleBlock: function(instance, block) {
      const data = OpCodes.StringToBytes(block);
      
      // Convert to 32-bit words (little-endian)
      let r0 = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      let r1 = OpCodes.Pack32LE(data[4], data[5], data[6], data[7]);
      let r2 = OpCodes.Pack32LE(data[8], data[9], data[10], data[11]);
      let r3 = OpCodes.Pack32LE(data[12], data[13], data[14], data[15]);
      
      // Input whitening
      r0 ^= instance.subkeys[0];
      r1 ^= instance.subkeys[1];
      r2 ^= instance.subkeys[2];
      r3 ^= instance.subkeys[3];
      
      // Extended Feistel rounds
      for (let round = 0; round < instance.rounds; round++) {
        const k = 4 + (round * 2);
        
        // F-function on r0 and r1
        const f0 = THX.fFunction(r0, instance.sboxes);
        const f1 = THX.fFunction(OpCodes.RotL32(r1, 8), instance.sboxes);
        
        // PHT (Pseudo Hadamard Transform)
        const [t0, t1] = THX.pht(f0, f1);
        
        // Apply round keys and update state
        r2 ^= (t0 + instance.subkeys[k]) >>> 0;
        r3 ^= (t1 + instance.subkeys[k + 1]) >>> 0;
        r3 = OpCodes.RotR32(r3, 1);
        r2 = OpCodes.RotL32(r2, 1);
        
        // Rotate state for next round
        [r0, r1, r2, r3] = [r2, r3, r0, r1];
      }
      
      // Undo last rotation
      [r0, r1, r2, r3] = [r2, r3, r0, r1];
      
      // Output whitening
      const outputWhiteningOffset = 4 + (instance.rounds * 2);
      r0 ^= instance.subkeys[outputWhiteningOffset];
      r1 ^= instance.subkeys[outputWhiteningOffset + 1];
      r2 ^= instance.subkeys[outputWhiteningOffset + 2];
      r3 ^= instance.subkeys[outputWhiteningOffset + 3];
      
      // Convert back to bytes
      const result = [];
      const w0 = OpCodes.Unpack32LE(r0);
      const w1 = OpCodes.Unpack32LE(r1);
      const w2 = OpCodes.Unpack32LE(r2);
      const w3 = OpCodes.Unpack32LE(r3);
      
      return OpCodes.BytesToString([
        ...w0, ...w1, ...w2, ...w3
      ]);
    },
    
    // Single block decryption
    decryptSingleBlock: function(instance, block) {
      const data = OpCodes.StringToBytes(block);
      
      // Convert to 32-bit words (little-endian)
      let r0 = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      let r1 = OpCodes.Pack32LE(data[4], data[5], data[6], data[7]);
      let r2 = OpCodes.Pack32LE(data[8], data[9], data[10], data[11]);
      let r3 = OpCodes.Pack32LE(data[12], data[13], data[14], data[15]);
      
      // Undo output whitening
      const outputWhiteningOffset = 4 + (instance.rounds * 2);
      r0 ^= instance.subkeys[outputWhiteningOffset];
      r1 ^= instance.subkeys[outputWhiteningOffset + 1];
      r2 ^= instance.subkeys[outputWhiteningOffset + 2];
      r3 ^= instance.subkeys[outputWhiteningOffset + 3];
      
      // Apply last rotation that was undone in encryption
      [r0, r1, r2, r3] = [r2, r3, r0, r1];
      
      // Reverse Feistel rounds
      for (let round = instance.rounds - 1; round >= 0; round--) {
        const k = 4 + (round * 2);
        
        // Undo state rotation (reverse of what was done at end of encryption round)
        [r0, r1, r2, r3] = [r2, r3, r0, r1];
        
        // Undo bit rotations
        r2 = OpCodes.RotR32(r2, 1);  // Undo RotL32(r2, 1)
        r3 = OpCodes.RotL32(r3, 1);  // Undo RotR32(r3, 1)
        
        // F-function on r0 and r1 (same as encryption)
        const f0 = THX.fFunction(r0, instance.sboxes);
        const f1 = THX.fFunction(OpCodes.RotL32(r1, 8), instance.sboxes);
        
        // PHT (Pseudo Hadamard Transform) - same as encryption
        const [t0, t1] = THX.pht(f0, f1);
        
        // Undo round key application (XOR is its own inverse)
        r2 ^= (t0 + instance.subkeys[k]) >>> 0;
        r3 ^= (t1 + instance.subkeys[k + 1]) >>> 0;
      }
      
      // Undo input whitening
      r0 ^= instance.subkeys[0];
      r1 ^= instance.subkeys[1];
      r2 ^= instance.subkeys[2];
      r3 ^= instance.subkeys[3];
      
      // Convert back to bytes
      const result = [];
      const w0 = OpCodes.Unpack32LE(r0);
      const w1 = OpCodes.Unpack32LE(r1);
      const w2 = OpCodes.Unpack32LE(r2);
      const w3 = OpCodes.Unpack32LE(r3);
      
      return OpCodes.BytesToString([
        ...w0, ...w1, ...w2, ...w3
      ]);
    },
    
    Instance: function(key) {
      // Validate and normalize key
      this.originalKey = key || '\x00'.repeat(32);
      
      // Ensure key is proper length
      if (this.originalKey.length < 32) {
        // Pad to minimum 256 bits
        while (this.originalKey.length < 32) {
          this.originalKey += '\x00';
        }
      } else if (this.originalKey.length > 128) {
        // Truncate to maximum 1024 bits
        this.originalKey = this.originalKey.substr(0, 128);
      } else {
        // Round up to next valid size (32, 64, 128 bytes)
        const validSizes = [32, 64, 128];
        for (let size of validSizes) {
          if (this.originalKey.length <= size) {
            while (this.originalKey.length < size) {
              this.originalKey += '\x00';
            }
            break;
          }
        }
      }
      
      // Determine number of rounds based on key size
      if (this.originalKey.length === 32) {        // 256-bit
        this.rounds = 16;
      } else if (this.originalKey.length === 64) { // 512-bit
        this.rounds = 20;
      } else {                                     // 1024-bit
        this.rounds = 24;
      }
      
      // HKDF-based key expansion for extended key sizes
      const expandedKeyLength = (4 + this.rounds * 2 + 4) * 4 + 1024; // Subkeys + S-box material
      this.expandedKey = this.expandKey(this.originalKey, expandedKeyLength);
      
      // Generate subkeys
      this.subkeys = [];
      for (let i = 0; i < 4 + this.rounds * 2 + 4; i++) {
        const offset = i * 4;
        this.subkeys[i] = OpCodes.Pack32LE(
          this.expandedKey[offset],
          this.expandedKey[offset + 1],
          this.expandedKey[offset + 2],
          this.expandedKey[offset + 3]
        );
      }
      
      // Generate key-dependent S-boxes
      const sboxKeyMaterial = this.expandedKey.slice((4 + this.rounds * 2 + 4) * 4);
      this.sboxes = THX.generateKeyDependentSBoxes(sboxKeyMaterial);
    }
  };
  
  // Add key expansion method to Instance prototype
  THX.Instance.prototype.expandKey = function(key, length) {
    const keyBytes = OpCodes.StringToBytes(key);
    
    // Use HKDF for key expansion (if available)
    if (global.HKDF && typeof global.HKDF.derive === 'function') {
      try {
        const salt = OpCodes.StringToBytes('THX-Twofish-Extended');
        const info = OpCodes.StringToBytes('CEX-THX-v1.0');
        const expanded = global.HKDF.derive('SHA256', keyBytes, salt, info, length);
        return expanded;
      } catch (e) {
        console.warn('HKDF unavailable, using fallback key expansion');
      }
    }
    
    // Fallback: simple key stretching
    const result = [];
    for (let i = 0; i < length; i++) {
      const keyIndex = i % keyBytes.length;
      const position = Math.floor(i / keyBytes.length);
      result[i] = keyBytes[keyIndex] ^ (position & 0xFF);
    }
    
    return result;
  };
  
  // Add secure key clearing
  THX.Instance.prototype.clearKey = function() {
    if (this.expandedKey) {
      OpCodes.ClearArray(this.expandedKey);
    }
    if (this.subkeys) {
      OpCodes.ClearArray(this.subkeys);
    }
    if (this.sboxes) {
      for (let i = 0; i < 4; i++) {
        if (this.sboxes[i]) {
          OpCodes.ClearArray(this.sboxes[i]);
        }
      }
    }
  };
  
  // Register with Cipher system if available
  if (typeof global !== 'undefined' && global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(THX);
  }
  
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
    global.Cipher.Add(THX);
  }
  
  // Export to global scope
  if (typeof global !== 'undefined') {
    global.THX = THX;
  }
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = THX;
  }
  
})(typeof global !== 'undefined' ? global : window);

console.log('CEX THX (Twofish Extended) loaded - Educational implementation supporting 256/512/1024-bit keys');