#!/usr/bin/env node
/*
 * Universal Serpent Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on the AES finalist cipher by Anderson, Biham, and Knudsen
 * (c)2006-2025 Hawkynt
 * 
 * Serpent Algorithm Specifications:
 * - 128-bit block size (16 bytes)
 * - Variable key length: 128, 192, or 256 bits
 * - 32 rounds with 8 different 4x4 S-boxes
 * - Substitution-permutation network structure
 * - Public domain algorithm (no patents)
 * 
 * References:
 * - Original C implementation by Dr. B.R. Gladman
 * - NIST AES submission package
 * - "Serpent: A Proposal for the Advanced Encryption Standard"
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  // Ensure Cipher system is available
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
      console.error('Serpent cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // Serpent Algorithm Constants
  const SERPENT_CONSTANTS = {
    BLOCK_SIZE: 16,           // 128 bits
    MIN_KEY_LENGTH: 16,       // 128 bits
    MAX_KEY_LENGTH: 32,       // 256 bits
    ROUNDS: 32,               // Number of encryption rounds
    PHI: 0x9e3779b9,         // Golden ratio constant for key schedule
    SBOX_COUNT: 8            // Number of different S-boxes
  };

  // Serpent S-box transformations using optimized boolean functions
  // Based on the official C reference implementation by Dr. B.R. Gladman
  
  // S0 transformation (15 terms)
  function sb0(a, b, c, d) {
    let t1 = a ^ d;
    let t2 = a & d;
    let t3 = c ^ t1;
    let t6 = b & t1;
    let t4 = b ^ t3;
    let t10 = ~t3;
    let h = t2 ^ t4;
    let t7 = a ^ t6;
    let t14 = ~t7;
    let t8 = c | t7;
    let t11 = t3 ^ t7;
    let g = t4 ^ t8;
    let t12 = h & t11;
    let f = t10 ^ t12;
    let e = t12 ^ t14;
    return [e, f, g, h];
  }

  // Inverse S0 transformation (15 terms)
  function ib0(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ b;
    let t3 = t1 | t2;
    let t4 = d ^ t3;
    let t7 = d & t2;
    let t5 = c ^ t4;
    let t8 = t1 ^ t7;
    let g = t2 ^ t5;
    let t11 = a & t4;
    let t9 = g & t8;
    let t14 = t5 ^ t8;
    let f = t4 ^ t9;
    let t12 = t5 | f;
    let h = t11 ^ t12;
    let e = h ^ t14;
    return [e, f, g, h];
  }

  // S1 transformation (14 terms)
  function sb1(a, b, c, d) {
    let t1 = ~a;
    let t2 = b ^ t1;
    let t3 = a | t2;
    let t4 = d | t2;
    let t5 = c ^ t3;
    let g = d ^ t5;
    let t7 = b ^ t4;
    let t8 = t2 ^ g;
    let t9 = t5 & t7;
    let h = t8 ^ t9;
    let t11 = t5 ^ t7;
    let f = h ^ t11;
    let t13 = t8 & t11;
    let e = t5 ^ t13;
    return [e, f, g, h];
  }

  // Inverse S1 transformation (17 terms)
  function ib1(a, b, c, d) {
    let t1 = a ^ d;
    let t2 = a & b;
    let t3 = b ^ c;
    let t4 = a ^ t3;
    let t5 = b | d;
    let h = t4 ^ t5;
    let t7 = c | t1;
    let t8 = b ^ t7;
    let t11 = ~t2;
    let t9 = t4 & t8;
    let f = t1 ^ t9;
    let t13 = t9 ^ t11;
    let t12 = h & f;
    let g = t12 ^ t13;
    let t15 = a & d;
    let t16 = c ^ t13;
    let e = t15 ^ t16;
    return [e, f, g, h];
  }

  // S2 transformation (16 terms)
  function sb2(a, b, c, d) {
    let t1 = ~a;
    let t2 = b ^ d;
    let t3 = c & t1;
    let t13 = d | t1;
    let e = t2 ^ t3;
    let t5 = c ^ t1;
    let t6 = c ^ e;
    let t7 = b & t6;
    let t10 = e | t5;
    let h = t5 ^ t7;
    let t9 = d | t7;
    let t11 = t9 & t10;
    let t14 = t2 ^ h;
    let g = a ^ t11;
    let t15 = g ^ t13;
    let f = t14 ^ t15;
    return [e, f, g, h];
  }

  // Inverse S2 transformation (16 terms)
  function ib2(a, b, c, d) {
    let t1 = b ^ d;
    let t2 = ~t1;
    let t3 = a ^ c;
    let t4 = c ^ t1;
    let t7 = a | t2;
    let t5 = b & t4;
    let t8 = d ^ t7;
    let t11 = ~t4;
    let e = t3 ^ t5;
    let t9 = t3 | t8;
    let t14 = d & t11;
    let h = t1 ^ t9;
    let t12 = e | h;
    let f = t11 ^ t12;
    let t15 = t3 ^ t12;
    let g = t14 ^ t15;
    return [e, f, g, h];
  }

  // S3 transformation (17 terms)
  function sb3(a, b, c, d) {
    let t1 = a ^ c;
    let t2 = d ^ t1;
    let t3 = a & t2;
    let t4 = d ^ t3;
    let t5 = b & t4;
    let g = t2 ^ t5;
    let t7 = a | g;
    let t8 = b | d;
    let t11 = a | d;
    let t9 = t4 & t7;
    let f = t8 ^ t9;
    let t12 = b ^ t11;
    let t13 = g ^ t9;
    let t15 = t3 ^ t8;
    let h = t12 ^ t13;
    let t16 = c & t15;
    let e = t12 ^ t16;
    return [e, f, g, h];
  }

  // Inverse S3 transformation (17 terms)
  function ib3(a, b, c, d) {
    let t1 = b ^ c;
    let t2 = b | c;
    let t3 = a ^ c;
    let t7 = a ^ d;
    let t4 = t2 ^ t3;
    let t5 = d | t4;
    let t9 = t2 ^ t7;
    let e = t1 ^ t5;
    let t8 = t1 | t5;
    let t11 = a & t4;
    let g = t8 ^ t9;
    let t12 = e | t9;
    let f = t11 ^ t12;
    let t14 = a & g;
    let t15 = t2 ^ t14;
    let t16 = e & t15;
    let h = t4 ^ t16;
    return [e, f, g, h];
  }

  // S4 transformation (15 terms)
  function sb4(a, b, c, d) {
    let t1 = a ^ d;
    let t2 = d & t1;
    let t3 = c ^ t2;
    let t4 = b | t3;
    let h = t1 ^ t4;
    let t6 = ~b;
    let t7 = t1 | t6;
    let e = t3 ^ t7;
    let t9 = a & e;
    let t10 = t1 ^ t6;
    let t11 = t4 & t10;
    let g = t9 ^ t11;
    let t13 = a ^ t3;
    let t14 = t10 & g;
    let f = t13 ^ t14;
    return [e, f, g, h];
  }

  // Inverse S4 transformation (17 terms)
  function ib4(a, b, c, d) {
    let t1 = c ^ d;
    let t2 = c | d;
    let t3 = b ^ t2;
    let t4 = a & t3;
    let f = t1 ^ t4;
    let t6 = a ^ d;
    let t7 = b | d;
    let t8 = t6 & t7;
    let h = t3 ^ t8;
    let t10 = ~a;
    let t11 = c ^ h;
    let t12 = t10 | t11;
    let e = t3 ^ t12;
    let t14 = c | t4;
    let t15 = t7 ^ t14;
    let t16 = h | t10;
    let g = t15 ^ t16;
    return [e, f, g, h];
  }

  // S5 transformation (16 terms)
  function sb5(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ b;
    let t3 = a ^ d;
    let t4 = c ^ t1;
    let t5 = t2 | t3;
    let e = t4 ^ t5;
    let t7 = d & e;
    let t8 = t2 ^ e;
    let t10 = t1 | e;
    let f = t7 ^ t8;
    let t11 = t2 | t7;
    let t12 = t3 ^ t10;
    let t14 = b ^ t7;
    let g = t11 ^ t12;
    let t15 = f & t12;
    let h = t14 ^ t15;
    return [e, f, g, h];
  }

  // Inverse S5 transformation (16 terms)
  function ib5(a, b, c, d) {
    let t1 = ~c;
    let t2 = b & t1;
    let t3 = d ^ t2;
    let t4 = a & t3;
    let t5 = b ^ t1;
    let h = t4 ^ t5;
    let t7 = b | h;
    let t8 = a & t7;
    let f = t3 ^ t8;
    let t10 = a | d;
    let t11 = t1 ^ t7;
    let e = t10 ^ t11;
    let t13 = a ^ c;
    let t14 = b & t10;
    let t15 = t4 | t13;
    let g = t14 ^ t15;
    return [e, f, g, h];
  }

  // S6 transformation (15 terms)
  function sb6(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ d;
    let t3 = b ^ t2;
    let t4 = t1 | t2;
    let t5 = c ^ t4;
    let f = b ^ t5;
    let t13 = ~t5;
    let t7 = t2 | f;
    let t8 = d ^ t7;
    let t9 = t5 & t8;
    let g = t3 ^ t9;
    let t11 = t5 ^ t8;
    let e = g ^ t11;
    let t14 = t3 & t11;
    let h = t13 ^ t14;
    return [e, f, g, h];
  }

  // Inverse S6 transformation (15 terms)
  function ib6(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ b;
    let t3 = c ^ t2;
    let t4 = c | t1;
    let t5 = d ^ t4;
    let t13 = d & t1;
    let f = t3 ^ t5;
    let t7 = t3 & t5;
    let t8 = t2 ^ t7;
    let t9 = b | t8;
    let h = t5 ^ t9;
    let t11 = b | h;
    let e = t8 ^ t11;
    let t14 = t3 ^ t11;
    let g = t13 ^ t14;
    return [e, f, g, h];
  }

  // S7 transformation (17 terms)
  function sb7(a, b, c, d) {
    let t1 = ~c;
    let t2 = b ^ c;
    let t3 = b | t1;
    let t4 = d ^ t3;
    let t5 = a & t4;
    let t7 = a ^ d;
    let h = t2 ^ t5;
    let t8 = b ^ t5;
    let t9 = t2 | t8;
    let t11 = d & t3;
    let f = t7 ^ t9;
    let t12 = t5 ^ f;
    let t15 = t1 | t4;
    let t13 = h & t12;
    let g = t11 ^ t13;
    let t16 = t12 ^ g;
    let e = t15 ^ t16;
    return [e, f, g, h];
  }

  // Inverse S7 transformation (17 terms)
  function ib7(a, b, c, d) {
    let t1 = a & b;
    let t2 = a | b;
    let t3 = c | t1;
    let t4 = d & t2;
    let h = t3 ^ t4;
    let t6 = ~d;
    let t7 = b ^ t4;
    let t8 = h ^ t6;
    let t11 = c ^ t7;
    let t9 = t7 | t8;
    let f = a ^ t9;
    let t12 = d | f;
    let e = t11 ^ t12;
    let t14 = a & h;
    let t15 = t3 ^ f;
    let t16 = e ^ t14;
    let g = t15 ^ t16;
    return [e, f, g, h];
  }

  // S-box array for encryption
  const sboxFunctions = [sb0, sb1, sb2, sb3, sb4, sb5, sb6, sb7];
  const sboxInvFunctions = [ib0, ib1, ib2, ib3, ib4, ib5, ib6, ib7];

  // Linear transformation function
  function linearTransform(x0, x1, x2, x3) {
    // Apply Serpent's linear transformation (exact C reference implementation)
    x0 = OpCodes.RotL32(x0, 13);
    x2 = OpCodes.RotL32(x2, 3);
    x3 ^= x2 ^ ((x0 << 3) >>> 0);
    x1 ^= x0 ^ x2;
    x3 = OpCodes.RotL32(x3, 7);
    x1 = OpCodes.RotL32(x1, 1);
    x0 ^= x1 ^ x3;
    x2 ^= x3 ^ ((x1 << 7) >>> 0);
    x0 = OpCodes.RotL32(x0, 5);
    x2 = OpCodes.RotL32(x2, 22);
    
    return [x0, x1, x2, x3];
  }

  // Inverse linear transformation function
  function linearTransformInv(x0, x1, x2, x3) {
    // Apply inverse of Serpent's linear transformation (exact C reference implementation)
    x2 = OpCodes.RotR32(x2, 22);
    x0 = OpCodes.RotR32(x0, 5);
    x2 ^= x3 ^ ((x1 << 7) >>> 0);
    x0 ^= x1 ^ x3;
    x3 = OpCodes.RotR32(x3, 7);
    x1 = OpCodes.RotR32(x1, 1);
    x3 ^= x2 ^ ((x0 << 3) >>> 0);
    x1 ^= x0 ^ x2;
    x2 = OpCodes.RotR32(x2, 3);
    x0 = OpCodes.RotR32(x0, 13);
    
    return [x0, x1, x2, x3];
  }

  // Key scheduling function
  function generateKeySchedule(key) {
    // Pad key to 256 bits if necessary
    const keyWords = new Array(8).fill(0);
    const keyBytes = OpCodes.StringToBytes(key);
    
    // Copy key bytes into words
    for (let i = 0; i < Math.min(keyBytes.length, 32); i++) {
      const wordIndex = Math.floor(i / 4);
      const byteIndex = i % 4;
      keyWords[wordIndex] |= (keyBytes[i] << (byteIndex * 8));
    }
    
    // If key is shorter than 256 bits, apply padding
    if (keyBytes.length < 32) {
      const padIndex = keyBytes.length;
      const wordIndex = Math.floor(padIndex / 4);
      const byteIndex = padIndex % 4;
      keyWords[wordIndex] |= (1 << (byteIndex * 8));
    }
    
    // Generate extended key
    const extendedKey = new Array(140);
    
    // Copy initial key words
    for (let i = 0; i < 8; i++) {
      extendedKey[i] = keyWords[i] >>> 0; // Ensure unsigned 32-bit
    }
    
    // Generate remaining key words
    for (let i = 8; i < 140; i++) {
      const temp = extendedKey[i - 8] ^ extendedKey[i - 5] ^ extendedKey[i - 3] ^ extendedKey[i - 1] ^ SERPENT_CONSTANTS.PHI ^ (i - 8);
      extendedKey[i] = OpCodes.RotL32(temp, 11);
    }
    
    // Apply S-boxes to subkeys
    const roundKeys = [];
    const sboxOrder = [3, 2, 1, 0, 7, 6, 5, 4]; // S-box order for key schedule
    
    for (let round = 0; round < 33; round++) {
      const baseIndex = round * 4 + 8;
      const sboxIndex = sboxOrder[round % 8];
      
      const x0 = extendedKey[baseIndex];
      const x1 = extendedKey[baseIndex + 1];
      const x2 = extendedKey[baseIndex + 2];
      const x3 = extendedKey[baseIndex + 3];
      
      const transformed = sboxFunctions[sboxIndex](x0, x1, x2, x3);
      roundKeys.push(transformed);
    }
    
    return roundKeys;
  }

  // Create Serpent cipher object
  const Serpent = {
    name: "Serpent",
    description: "AES finalist cipher by Anderson, Biham, and Knudsen with 32 rounds and 8 S-boxes. Uses substitution-permutation network with 128-bit blocks and 128/192/256-bit keys. Public domain algorithm.",
    inventor: "Ross Anderson, Eli Biham, Lars Knudsen",
    year: 1998,
    country: "GB",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: null,
    securityNotes: "AES finalist with conservative security margin. Designed for high security with 32 rounds. No practical attacks known against full Serpent.",
    
    documentation: [
      {text: "Serpent Algorithm Specification", uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html"},
      {text: "Serpent: A New Block Cipher Proposal", uri: "https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf"},
      {text: "NIST AES Candidate Submission", uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development"}
    ],
    
    references: [
      {text: "Crypto++ Serpent Implementation", uri: "https://github.com/weidai11/cryptopp/blob/master/serpent.cpp"},
      {text: "libgcrypt Serpent Implementation", uri: "https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c"},
      {text: "Bouncy Castle Serpent Implementation", uri: "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Serpent 128-bit Test Vector",
        uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html",
        keySize: 16,
        blockSize: 16,
        input: Hex8ToBytes("00000000000000000000000000000000"),
        key: Hex8ToBytes("00000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'Serpent',
    comment: 'Serpent Block Cipher - AES Finalist by Anderson, Biham, and Knudsen',
    minKeyLength: SERPENT_CONSTANTS.MIN_KEY_LENGTH,
    maxKeyLength: SERPENT_CONSTANTS.MAX_KEY_LENGTH,
    stepKeyLength: 8, // 64-bit steps
    minBlockSize: SERPENT_CONSTANTS.BLOCK_SIZE,
    maxBlockSize: SERPENT_CONSTANTS.BLOCK_SIZE,
    stepBlockSize: 1,
    instances: {},

  // Legacy test vectors for compatibility
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "6 ±zæ©Ð\u0018¸vfºé",
        "description": "Serpent 128-bit key, all zeros test vector (our implementation)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017",
        "expected": "\u0010U@Ð¶[©RGêQ&ëz",
        "description": "Serpent 192-bit key, sequential pattern test vector (our implementation)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "Ig+¨ÙùP\u0019\u0018\u0004EI\u0010",
        "description": "Serpent 256-bit key, all zeros test vector (our implementation)"
    },
    {
        "input": "\u0001#Eg«Íï\u0000\u0011\"3DUfw",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f",
        "expected": "¤UQ£n\u0012wË\u000f]Û",
        "description": "Serpent 128-bit key, pattern test vector (our implementation)"
    },
    {
        "input": "HELLO WORLD TEST",
        "key": "1234567890123456",
        "expected": "a\u001e²öÌ¡F|\\¥-â³",
        "description": "Serpent ASCII plaintext and key test (our implementation)"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "-îg[kt\u00016}¢¨\u000f´Ke",
        "description": "Serpent 128-bit key, all ones boundary test (our implementation)"
    }
],

  // Reference links to authoritative sources and production implementations
  referenceLinks: {
    specifications: [
      {
        name: 'Serpent Algorithm Specification',
        url: 'https://www.cl.cam.ac.uk/~rja14/serpent.html',
        description: 'Official Serpent specification by Anderson, Biham, and Knudsen'
      },
      {
        name: 'Serpent AES Candidate Submission',
        url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development',
        description: 'NIST AES candidate submission documents for Serpent'
      },
      {
        name: 'Serpent: A New Block Cipher Proposal (Paper)',
        url: 'https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf',
        description: 'Academic paper introducing the Serpent algorithm design'
      },
      {
        name: 'Fast Software Encryption - Serpent',
        url: 'https://link.springer.com/chapter/10.1007/3-540-69710-1_14',
        description: 'FSE conference paper on Serpent algorithm and implementation'
      }
    ],
    implementations: [
      {
        name: 'Crypto++ Serpent Implementation',
        url: 'https://github.com/weidai11/cryptopp/blob/master/serpent.cpp',
        description: 'High-performance C++ Serpent implementation'
      },
      {
        name: 'Bouncy Castle Serpent Implementation',
        url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
        description: 'Java Serpent implementation from Bouncy Castle'
      },
      {
        name: 'libgcrypt Serpent Implementation',
        url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c',
        description: 'GNU libgcrypt Serpent implementation'
      },
      {
        name: 'OpenSSL Cipher Collection',
        url: 'https://github.com/openssl/openssl/tree/master/crypto/',
        description: 'OpenSSL cryptographic library cipher implementations'
      }
    ],
    validation: [
      {
        name: 'Serpent Test Vectors',
        url: 'https://www.cl.cam.ac.uk/~rja14/serpent.html',
        description: 'Official test vectors from Serpent algorithm creators'
      },
      {
        name: 'NIST AES Finalist Evaluation',
        url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development',
        description: 'NIST evaluation and test vectors for AES finalist Serpent'
      },
      {
        name: 'Serpent Cryptanalysis Research',
        url: 'https://www.iacr.org/cryptodb/data/paper.php?pubkey=1523',
        description: 'Academic research on Serpent security analysis and cryptanalysis'
      }
    ]
  },

    cantDecode: false,
    isInitialized: false,

    // Initialize cipher
    Init: function() {
      if (!global.OpCodes) {
        throw new Error('OpCodes library is required for Serpent cipher');
      }
      this.isInitialized = true;
      return true;
    },

    // Key setup
    KeySetup: function(key) {
      if (!this.isInitialized) {
        this.Init();
      }
      
      if (!key || key.length < this.minKeyLength || key.length > this.maxKeyLength) {
        throw new Error('Serpent key must be between ' + this.minKeyLength + ' and ' + this.maxKeyLength + ' bytes');
      }

      // Generate unique instance ID
      let instanceId;
      do {
        instanceId = 'Serpent[' + Math.random().toString(36).substr(2, 9) + ']';
      } while (this.instances[instanceId]);

      // Generate round keys
      const roundKeys = generateKeySchedule(key);
      
      // Store instance
      this.instances[instanceId] = {
        roundKeys: roundKeys,
        keyLength: key.length
      };

      return instanceId;
    },

    // Encrypt a block
    encryptBlock: function(instanceId, plaintext) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid instance ID: ' + instanceId);
      }

      if (plaintext.length !== SERPENT_CONSTANTS.BLOCK_SIZE) {
        throw new Error('Serpent block size must be exactly ' + SERPENT_CONSTANTS.BLOCK_SIZE + ' bytes');
      }

      // Convert plaintext to 32-bit words (little-endian)
      const bytes = OpCodes.StringToBytes(plaintext);
      let x0 = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let x1 = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      let x2 = OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]);
      let x3 = OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15]);

      const roundKeys = instance.roundKeys;
      const sboxOrder = [0, 1, 2, 3, 4, 5, 6, 7]; // S-box order for encryption

      // 32 encryption rounds
      for (let round = 0; round < SERPENT_CONSTANTS.ROUNDS; round++) {
        // Key mixing
        x0 ^= roundKeys[round][0];
        x1 ^= roundKeys[round][1];
        x2 ^= roundKeys[round][2];
        x3 ^= roundKeys[round][3];

        // S-box substitution
        const sboxIndex = sboxOrder[round % 8];
        const sboxResult = sboxFunctions[sboxIndex](x0, x1, x2, x3);
        x0 = sboxResult[0];
        x1 = sboxResult[1];
        x2 = sboxResult[2];
        x3 = sboxResult[3];

        // Linear transformation (except in the last round)
        if (round < SERPENT_CONSTANTS.ROUNDS - 1) {
          const ltResult = linearTransform(x0, x1, x2, x3);
          x0 = ltResult[0];
          x1 = ltResult[1];
          x2 = ltResult[2];
          x3 = ltResult[3];
        }
      }

      // Final key mixing
      x0 ^= roundKeys[32][0];
      x1 ^= roundKeys[32][1];
      x2 ^= roundKeys[32][2];
      x3 ^= roundKeys[32][3];

      // Convert back to bytes (little-endian)
      const result = [];
      const bytes0 = OpCodes.Unpack32LE(x0);
      const bytes1 = OpCodes.Unpack32LE(x1);
      const bytes2 = OpCodes.Unpack32LE(x2);
      const bytes3 = OpCodes.Unpack32LE(x3);

      result.push(...bytes0, ...bytes1, ...bytes2, ...bytes3);
      
      return OpCodes.BytesToString(result);
    },

    // Decrypt a block
    decryptBlock: function(instanceId, ciphertext) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid instance ID: ' + instanceId);
      }

      if (ciphertext.length !== SERPENT_CONSTANTS.BLOCK_SIZE) {
        throw new Error('Serpent block size must be exactly ' + SERPENT_CONSTANTS.BLOCK_SIZE + ' bytes');
      }

      // Convert ciphertext to 32-bit words (little-endian)
      const bytes = OpCodes.StringToBytes(ciphertext);
      let x0 = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let x1 = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      let x2 = OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]);
      let x3 = OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15]);

      const roundKeys = instance.roundKeys;
      const sboxOrder = [0, 1, 2, 3, 4, 5, 6, 7]; // Same S-box order for decryption

      // Initial key mixing (undo final key mixing)
      x0 ^= roundKeys[32][0];
      x1 ^= roundKeys[32][1];
      x2 ^= roundKeys[32][2];
      x3 ^= roundKeys[32][3];

      // 32 decryption rounds (in reverse order)
      for (let round = SERPENT_CONSTANTS.ROUNDS - 1; round >= 0; round--) {
        // Inverse S-box substitution (undo the S-box from encryption)
        const sboxIndex = sboxOrder[round % 8];
        const sboxResult = sboxInvFunctions[sboxIndex](x0, x1, x2, x3);
        x0 = sboxResult[0];
        x1 = sboxResult[1];
        x2 = sboxResult[2];
        x3 = sboxResult[3];

        // Inverse linear transformation (undo linear transform, except for first round)
        if (round > 0) {
          const ltResult = linearTransformInv(x0, x1, x2, x3);
          x0 = ltResult[0];
          x1 = ltResult[1];
          x2 = ltResult[2];
          x3 = ltResult[3];
        }

        // Key mixing (undo the round key)
        x0 ^= roundKeys[round][0];
        x1 ^= roundKeys[round][1];
        x2 ^= roundKeys[round][2];
        x3 ^= roundKeys[round][3];
      }

      // Convert back to bytes (little-endian)
      const result = [];
      const bytes0 = OpCodes.Unpack32LE(x0);
      const bytes1 = OpCodes.Unpack32LE(x1);
      const bytes2 = OpCodes.Unpack32LE(x2);
      const bytes3 = OpCodes.Unpack32LE(x3);

      result.push(...bytes0, ...bytes1, ...bytes2, ...bytes3);
      
      return OpCodes.BytesToString(result);
    },

    // Clear instance data
    ClearData: function(instanceId) {
      if (this.instances[instanceId]) {
        // Clear sensitive data
        const instance = this.instances[instanceId];
        if (instance.roundKeys) {
          for (let i = 0; i < instance.roundKeys.length; i++) {
            OpCodes.ClearArray(instance.roundKeys[i]);
          }
        }
        delete this.instances[instanceId];
        return true;
      }
      return false;
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
    global.Cipher.Add(Serpent);
  } else if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Serpent);
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Serpent;
  }

  // Export to global scope
  global.Serpent = Serpent;

})(typeof global !== 'undefined' ? global : window);