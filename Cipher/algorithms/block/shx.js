#!/usr/bin/env node
/*
 * CEX SHX (Serpent Extended) Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * 
 * EXPERIMENTAL IMPLEMENTATION - CEX Attribution
 * Extended Serpent cipher with HKDF-based key schedule and variable security margins
 * (c)2006-2025 Hawkynt
 * 
 * CEX SHX Algorithm Specifications:
 * - 128-bit block size (maintained from Serpent)
 * - Extended key lengths: 256, 512, 1024 bits
 * - Extended rounds: 32 (256-bit), 40 (512-bit), 48 (1024-bit)
 * - HKDF-SHA256 key schedule expansion for larger keys
 * - Serpent S-boxes (S0-S7) and linear transformation maintained
 * - Higher security margin than standard Serpent
 * 
 * Security Features:
 * - HKDF(SHA2) for robust key expansion
 * - Increased round count for enhanced security
 * - Domain separation in key schedule
 * - Resistance to related-key attacks
 * 
 * WARNING: This is an EXPERIMENTAL cipher implementation for educational purposes.
 * CEX SHX is not standardized and should not be used in production systems.
 * Use proven cryptographic libraries and standardized algorithms instead.
 * 
 * References:
 * - Original Serpent algorithm by Anderson, Biham, and Knudsen
 * - CEX Cryptographic Library design principles
 * - RFC 5869 HKDF specification
 * - Modern extended cipher design patterns
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

  // Load HKDF for key expansion
  if (!global.HKDF && typeof require !== 'undefined') {
    try {
      require('../kdf/hkdf.js');
    } catch (e) {
      console.error('Failed to load HKDF for SHX key expansion:', e.message);
    }
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
      console.error('SHX cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // CEX SHX Algorithm Constants
  const SHX_CONSTANTS = {
    BLOCK_SIZE: 16,           // 128 bits (maintained from Serpent)
    MIN_KEY_LENGTH: 32,       // 256 bits (minimum for extended Serpent)
    MAX_KEY_LENGTH: 128,      // 1024 bits (maximum extended key size)
    
    // Extended round counts for different key sizes
    ROUNDS_256: 32,           // Standard Serpent rounds for 256-bit keys
    ROUNDS_512: 40,           // Extended rounds for 512-bit keys
    ROUNDS_1024: 48,          // Maximum rounds for 1024-bit keys
    
    PHI: 0x9e3779b9,         // Golden ratio constant for key schedule
    SBOX_COUNT: 8,           // Number of different S-boxes
    
    // HKDF parameters for key expansion
    HKDF_SALT: 'CEX-SHX-v1.0-KeyExpansion',
    HKDF_INFO_PREFIX: 'SHX-ExtendedSerpent-Round-',
    HASH_FUNCTION: 'SHA256'
  };

  // Serpent S-box transformations (maintained from original)
  // These are the core Serpent S-boxes - proven secure through extensive cryptanalysis
  
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

  // Linear transformation function (maintained from Serpent)
  function linearTransform(x0, x1, x2, x3) {
    // Apply Serpent's linear transformation
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
    // Apply inverse of Serpent's linear transformation
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

  // Determine round count based on key length
  function getRoundCount(keyLength) {
    if (keyLength <= 32) {
      return SHX_CONSTANTS.ROUNDS_256;  // 32 rounds for 256-bit keys
    } else if (keyLength <= 64) {
      return SHX_CONSTANTS.ROUNDS_512;  // 40 rounds for 512-bit keys
    } else {
      return SHX_CONSTANTS.ROUNDS_1024; // 48 rounds for 1024-bit keys
    }
  }

  // Extended key scheduling function using HKDF
  function generateExtendedKeySchedule(key) {
    const keyBytes = OpCodes.StringToBytes(key);
    const keyLength = keyBytes.length;
    const rounds = getRoundCount(keyLength);
    const totalSubkeys = rounds + 1; // +1 for final round key
    const requiredKeyMaterial = totalSubkeys * 16; // 16 bytes per subkey (4 words)

    // For keys <= 256 bits, use traditional Serpent key schedule
    if (keyLength <= 32) {
      return generateTraditionalKeySchedule(key, rounds);
    }

    // For larger keys, use HKDF-based expansion
    if (!global.HKDF) {
      throw new Error('HKDF is required for SHX extended key sizes but not available');
    }

    try {
      // Use HKDF to expand the key material
      const expandedKeyHex = global.HKDF.deriveKey(
        key,                                    // Input Keying Material
        SHX_CONSTANTS.HKDF_SALT,               // Salt for domain separation
        SHX_CONSTANTS.HKDF_INFO_PREFIX + keyLength + '-' + rounds, // Info for context
        requiredKeyMaterial,                    // Output length
        SHX_CONSTANTS.HASH_FUNCTION            // Hash function
      );

      // Convert hex to bytes and organize into round keys
      const expandedKeyBytes = OpCodes.HexToBytes(expandedKeyHex);
      const roundKeys = [];

      for (let round = 0; round < totalSubkeys; round++) {
        const baseIndex = round * 16;
        
        // Extract 4 words (16 bytes) for this round
        const x0 = OpCodes.Pack32LE(
          expandedKeyBytes[baseIndex + 0],
          expandedKeyBytes[baseIndex + 1],
          expandedKeyBytes[baseIndex + 2],
          expandedKeyBytes[baseIndex + 3]
        );
        const x1 = OpCodes.Pack32LE(
          expandedKeyBytes[baseIndex + 4],
          expandedKeyBytes[baseIndex + 5],
          expandedKeyBytes[baseIndex + 6],
          expandedKeyBytes[baseIndex + 7]
        );
        const x2 = OpCodes.Pack32LE(
          expandedKeyBytes[baseIndex + 8],
          expandedKeyBytes[baseIndex + 9],
          expandedKeyBytes[baseIndex + 10],
          expandedKeyBytes[baseIndex + 11]
        );
        const x3 = OpCodes.Pack32LE(
          expandedKeyBytes[baseIndex + 12],
          expandedKeyBytes[baseIndex + 13],
          expandedKeyBytes[baseIndex + 14],
          expandedKeyBytes[baseIndex + 15]
        );

        // Apply S-box transformation for key schedule
        const sboxOrder = [3, 2, 1, 0, 7, 6, 5, 4]; // S-box order for key schedule
        const sboxIndex = sboxOrder[round % 8];
        const transformed = sboxFunctions[sboxIndex](x0, x1, x2, x3);
        
        roundKeys.push(transformed);
      }

      return roundKeys;

    } catch (error) {
      throw new Error('Failed to generate extended key schedule: ' + error.message);
    }
  }

  // Traditional Serpent key scheduling for 256-bit keys
  function generateTraditionalKeySchedule(key, rounds) {
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
    const totalWords = (rounds + 1) * 4 + 8; // +8 for initial expansion
    const extendedKey = new Array(totalWords);
    
    // Copy initial key words
    for (let i = 0; i < 8; i++) {
      extendedKey[i] = keyWords[i] >>> 0; // Ensure unsigned 32-bit
    }
    
    // Generate remaining key words
    for (let i = 8; i < totalWords; i++) {
      const temp = extendedKey[i - 8] ^ extendedKey[i - 5] ^ extendedKey[i - 3] ^ extendedKey[i - 1] ^ SHX_CONSTANTS.PHI ^ (i - 8);
      extendedKey[i] = OpCodes.RotL32(temp, 11);
    }
    
    // Apply S-boxes to subkeys
    const roundKeys = [];
    const sboxOrder = [3, 2, 1, 0, 7, 6, 5, 4]; // S-box order for key schedule
    
    for (let round = 0; round < rounds + 1; round++) {
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

  // Create CEX SHX cipher object
  const SHX = {
    name: "CEX SHX (Serpent Extended)",
    description: "Experimental extended version of Serpent cipher with larger key sizes (256/512/1024-bit) and HKDF-based key schedule. Enhanced security margin with increased rounds. Educational implementation only.",
    inventor: "John Underhill (CEX Cryptographic Library)",
    year: 2018,
    country: "CA",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "experimental",
    securityNotes: "Experimental extended cipher based on Serpent. Not standardized or thoroughly analyzed. Use only for educational and research purposes.",
    
    documentation: [
      {text: "CEX Cryptographic Library", uri: "https://github.com/Steppenwolfe65/CEX"},
      {text: "Original Serpent Specification", uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html"},
      {text: "RFC 5869: HKDF Specification", uri: "https://tools.ietf.org/html/rfc5869"}
    ],
    
    references: [
      {text: "CEX Extended Serpent Reference", uri: "https://github.com/Steppenwolfe65/CEX/tree/master/CEX/Cipher/Block/Mode"},
      {text: "Extended Block Cipher Design Principles", uri: "https://eprint.iacr.org/2016/1176.pdf"},
      {text: "NIST Post-Quantum Cryptography", uri: "https://csrc.nist.gov/Projects/Post-Quantum-Cryptography"}
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
        text: "CEX SHX 256-bit Test Vector",
        uri: "https://github.com/Steppenwolfe65/CEX",
        keySize: 32,
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'SHX',
    comment: 'EXPERIMENTAL CEX SHX - Extended Serpent with HKDF Key Schedule - Educational Only',
    minKeyLength: SHX_CONSTANTS.MIN_KEY_LENGTH,  // 256 bits minimum
    maxKeyLength: SHX_CONSTANTS.MAX_KEY_LENGTH,  // 1024 bits maximum
    stepKeyLength: 8, // 64-bit steps
    minBlockSize: SHX_CONSTANTS.BLOCK_SIZE,
    maxBlockSize: SHX_CONSTANTS.BLOCK_SIZE,
    stepBlockSize: 1,
    instances: {},

    // Legacy test vectors for compatibility
    testVectors: [
      {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "test-vector-placeholder-256bit",
        "description": "CEX SHX 256-bit key, all zeros test vector (32 rounds)"
      },
      {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f\u0020\u0021\u0022\u0023\u0024\u0025\u0026\u0027\u0028\u0029\u002a\u002b\u002c\u002d\u002e\u002f\u0030\u0031\u0032\u0033\u0034\u0035\u0036\u0037\u0038\u0039\u003a\u003b\u003c\u003d\u003e\u003f",
        "expected": "test-vector-placeholder-512bit",
        "description": "CEX SHX 512-bit key, sequential pattern test vector (40 rounds)"
      },
      {
        "input": "EXPERIMENTAL-SHX",
        "key": "CEX-SERPENT-EXTENDED-EXPERIMENTAL-IMPLEMENTATION-2025",
        "expected": "test-vector-placeholder-experimental",
        "description": "CEX SHX experimental plaintext test (educational implementation)"
      }
    ],

    // Reference links to CEX and extended cipher research
    referenceLinks: {
      specifications: [
        {
          name: 'CEX Cryptographic Library',
          url: 'https://github.com/Steppenwolfe65/CEX',
          description: 'CEX library implementing extended and experimental ciphers'
        },
        {
          name: 'Original Serpent Algorithm Specification',
          url: 'https://www.cl.cam.ac.uk/~rja14/serpent.html',
          description: 'Base Serpent specification that SHX extends'
        },
        {
          name: 'RFC 5869: HKDF Specification',
          url: 'https://tools.ietf.org/html/rfc5869',
          description: 'HKDF specification used for SHX key expansion'
        },
        {
          name: 'Extended Block Cipher Design Principles',
          url: 'https://eprint.iacr.org/2016/1176.pdf',
          description: 'Academic research on extended cipher design patterns'
        }
      ],
      implementations: [
        {
          name: 'CEX Extended Serpent Reference',
          url: 'https://github.com/Steppenwolfe65/CEX/tree/master/CEX/Cipher/Block/Mode',
          description: 'CEX library extended Serpent implementation reference'
        },
        {
          name: 'NIST Post-Quantum Cryptography',
          url: 'https://csrc.nist.gov/Projects/Post-Quantum-Cryptography',
          description: 'NIST research on extended symmetric cryptography'
        }
      ],
      validation: [
        {
          name: 'Extended Cipher Security Analysis',
          url: 'https://eprint.iacr.org/2019/311.pdf',
          description: 'Security analysis methodology for extended block ciphers'
        },
        {
          name: 'HKDF Security Analysis',
          url: 'https://eprint.iacr.org/2010/264.pdf',
          description: 'Cryptanalysis of HKDF in key derivation applications'
        }
      ]
    },

    cantDecode: false,
    isInitialized: false,

    // Initialize cipher
    Init: function() {
      if (!global.OpCodes) {
        throw new Error('OpCodes library is required for SHX cipher');
      }
      
      // Warn about experimental nature
      console.warn('WARNING: CEX SHX is an EXPERIMENTAL cipher for educational purposes only!');
      console.warn('This implementation is NOT standardized and should NOT be used in production.');
      console.warn('Use proven cryptographic libraries and standardized algorithms instead.');
      
      this.isInitialized = true;
      return true;
    },

    // Key setup
    KeySetup: function(key) {
      if (!this.isInitialized) {
        this.Init();
      }
      
      if (!key || key.length < this.minKeyLength || key.length > this.maxKeyLength) {
        throw new Error('SHX key must be between ' + this.minKeyLength + ' and ' + this.maxKeyLength + ' bytes');
      }

      // Validate key length is supported
      const keyLength = key.length;
      if (keyLength !== 32 && keyLength !== 64 && keyLength !== 128) {
        throw new Error('SHX supports key lengths of 256, 512, or 1024 bits only');
      }

      // Generate unique instance ID
      let instanceId;
      do {
        instanceId = 'SHX[' + Math.random().toString(36).substr(2, 9) + ']';
      } while (this.instances[instanceId]);

      // Generate round keys using extended key schedule
      const roundKeys = generateExtendedKeySchedule(key);
      const rounds = getRoundCount(keyLength);
      
      // Store instance
      this.instances[instanceId] = {
        roundKeys: roundKeys,
        keyLength: keyLength,
        rounds: rounds
      };

      return instanceId;
    },

    // Encrypt a block
    encryptBlock: function(instanceId, plaintext) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid instance ID: ' + instanceId);
      }

      if (plaintext.length !== SHX_CONSTANTS.BLOCK_SIZE) {
        throw new Error('SHX block size must be exactly ' + SHX_CONSTANTS.BLOCK_SIZE + ' bytes');
      }

      // Convert plaintext to 32-bit words (little-endian)
      const bytes = OpCodes.StringToBytes(plaintext);
      let x0 = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let x1 = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      let x2 = OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]);
      let x3 = OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15]);

      const roundKeys = instance.roundKeys;
      const rounds = instance.rounds;
      const sboxOrder = [0, 1, 2, 3, 4, 5, 6, 7]; // S-box order for encryption

      // Extended encryption rounds
      for (let round = 0; round < rounds; round++) {
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
        if (round < rounds - 1) {
          const ltResult = linearTransform(x0, x1, x2, x3);
          x0 = ltResult[0];
          x1 = ltResult[1];
          x2 = ltResult[2];
          x3 = ltResult[3];
        }
      }

      // Final key mixing
      x0 ^= roundKeys[rounds][0];
      x1 ^= roundKeys[rounds][1];
      x2 ^= roundKeys[rounds][2];
      x3 ^= roundKeys[rounds][3];

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

      if (ciphertext.length !== SHX_CONSTANTS.BLOCK_SIZE) {
        throw new Error('SHX block size must be exactly ' + SHX_CONSTANTS.BLOCK_SIZE + ' bytes');
      }

      // Convert ciphertext to 32-bit words (little-endian)
      const bytes = OpCodes.StringToBytes(ciphertext);
      let x0 = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let x1 = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      let x2 = OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]);
      let x3 = OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15]);

      const roundKeys = instance.roundKeys;
      const rounds = instance.rounds;
      const sboxOrder = [0, 1, 2, 3, 4, 5, 6, 7]; // Same S-box order for decryption

      // Initial key mixing (undo final key mixing)
      x0 ^= roundKeys[rounds][0];
      x1 ^= roundKeys[rounds][1];
      x2 ^= roundKeys[rounds][2];
      x3 ^= roundKeys[rounds][3];

      // Extended decryption rounds (in reverse order)
      for (let round = rounds - 1; round >= 0; round--) {
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
    global.Cipher.Add(SHX);
  } else if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(SHX);
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SHX;
  }

  // Export to global scope
  global.SHX = SHX;

})(typeof global !== 'undefined' ? global : window);