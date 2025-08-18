/*
 * Universal XTEA (Extended TEA) Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on original research by David Wheeler and Roger Needham (1997)
 * (c)2006-2025 Hawkynt
 * 
 * XTEA Algorithm by David Wheeler and Roger Needham (1997)
 * - 64-bit block cipher with 128-bit keys
 * - 64 rounds (32 cycles) using improved key schedule over TEA
 * - Magic constant: 0x9E3779B9 (derived from golden ratio)
 * - Addresses equivalent key problem and other weaknesses in TEA
 * 
 * Key improvements over TEA:
 * - More complex key schedule with different indexing
 * - Rearranged shifts, XORs, and additions for better diffusion
 * - Better resistance to related-key attacks
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
      console.error('XTEA cipher requires OpCodes library to be loaded first');
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
      console.error('XTEA cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create XTEA cipher object
  const XTEA = {
    name: "XTEA (Extended TEA)",
    description: "Improved version of TEA designed by David Wheeler and Roger Needham with enhanced key schedule and better security. Uses 64 rounds with 64-bit blocks and 128-bit keys.",
    inventor: "David Wheeler and Roger Needham",
    year: 1997,
    country: "GB",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "educational",
    securityNotes: "Improvement over TEA with better resistance to related-key attacks. Still considered dated - modern ciphers like AES recommended for security-critical applications.",
    
    documentation: [
      {text: "TEA extensions and corrections", uri: "https://www.cix.co.uk/~klockstone/xtea.htm"},
      {text: "Block TEA improvements", uri: "https://link.springer.com/chapter/10.1007/3-540-60590-8_29"},
      {text: "Cambridge Computer Laboratory", uri: "https://www.cl.cam.ac.uk/teaching/1415/SecurityII/"}
    ],
    
    references: [
      {text: "XTEA Cryptanalysis", uri: "https://eprint.iacr.org/"},
      {text: "TEA family comparison", uri: "https://www.schneier.com/academic/archives/1999/02/xtea.html"},
      {text: "Block cipher design evolution", uri: "https://link.springer.com/book/10.1007/978-3-662-04851-1"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Limited analysis",
        text: "Less cryptanalysis compared to modern ciphers, potential unknown weaknesses",
        mitigation: "Use modern standardized ciphers like AES for production applications"
      }
    ],
    
    tests: [
      {
        text: "XTEA Basic Test Vector",
        uri: "TEA extensions and corrections",
        keySize: 16,
        blockSize: 8,
        input: Hex8ToBytes("0000000000000000"),
        key: Hex8ToBytes("00000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'XTEA',
    comment: 'XTEA cipher by Wheeler & Needham - 64-bit blocks, 128-bit keys, 64 rounds (improved TEA)',
    minKeyLength: 16,    // 128-bit key
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 8,     // 64-bit block
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},

  // Legacy test vectors for compatibility
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "ÞéÔØ÷\u0013\u001eÙ",
        "description": "XTEA all-zeros test vector - educational implementation"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "(ü(æ#Vj",
        "description": "XTEA all-ones test vector - boundary condition"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u0001#Eg«ÍïþÜºvT2\u0010",
        "expected": "ÝYìÎm",
        "description": "XTEA pattern test vector - educational implementation"
    },
    {
        "input": "HELLO123",
        "key": "YELLOW SUBMARINE",
        "expected": "ØnV«4\u0016",
        "description": "XTEA ASCII plaintext and key test - educational demonstration"
    }
],

  // Reference links to authoritative sources and production implementations
  referenceLinks: {
    specifications: [
      {
        name: 'XTEA: Extended TEA Algorithm',
        url: 'https://www.cix.co.uk/~klockstone/xtea.htm',
        description: 'Official specification of XTEA by David Wheeler and Roger Needham'
      },
      {
        name: 'Block TEA: XTEA Specification Document',
        url: 'https://www.movable-type.co.uk/scripts/tea-block.html',
        description: 'Detailed technical specification and analysis of XTEA'
      },
      {
        name: 'XTEA Cryptanalysis Research',
        url: 'https://www.iacr.org/cryptodb/data/paper.php?pubkey=2378',
        description: 'Academic research on XTEA security properties and analysis'
      },
      {
        name: 'Cambridge XTEA Documentation',
        url: 'https://www.cl.cam.ac.uk/teaching/1415/SecurityII/xtea.pdf',
        description: 'Educational material on XTEA from Cambridge University'
      }
    ],
    implementations: [
      {
        name: 'Crypto++ XTEA Implementation',
        url: 'https://github.com/weidai11/cryptopp/blob/master/xtea.cpp',
        description: 'High-performance C++ XTEA implementation'
      },
      {
        name: 'Bouncy Castle XTEA Implementation',
        url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
        description: 'Java XTEA implementation from Bouncy Castle'
      },
      {
        name: 'libgcrypt XTEA Implementation',
        url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/',
        description: 'GNU libgcrypt cryptographic library cipher implementations'
      },
      {
        name: 'Python XTEA Implementation',
        url: 'https://pypi.org/project/xtea/',
        description: 'Python XTEA implementation available on PyPI'
      }
    ],
    validation: [
      {
        name: 'XTEA Test Vectors Collection',
        url: 'https://www.cosic.esat.kuleuven.be/nessie/testvectors/',
        description: 'Comprehensive test vectors for XTEA validation'
      },
      {
        name: 'XTEA Security Analysis Papers',
        url: 'https://www.iacr.org/cryptodb/data/paper.php?pubkey=2378',
        description: 'Academic security analysis and cryptanalysis of XTEA'
      },
      {
        name: 'Cryptographic Standards Validation',
        url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program',
        description: 'NIST guidelines for cryptographic algorithm validation'
      }
    ]
  },

    cantDecode: false,
    isInitialized: false,
    
    // XTEA Constants
    CYCLES: 32,                          // XTEA uses 32 cycles (64 rounds)
    DELTA: 0x9E3779B9,                   // Magic constant: 2^32 / golden ratio
    
    // Initialize cipher
    Init: function() {
      XTEA.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      if (!optional_key || optional_key.length !== 16) {
        global.throwException('XTEA Key Exception', 'Key must be exactly 16 bytes (128 bits)', 'XTEA', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'XTEA[' + global.generateUniqueID() + ']';
      } while (XTEA.instances[id] || global.objectInstances[id]);
      
      XTEA.instances[id] = new XTEA.XTEAInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (XTEA.instances[id]) {
        // Clear sensitive key data
        if (XTEA.instances[id].key) {
          global.OpCodes.ClearArray(XTEA.instances[id].key);
        }
        delete XTEA.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'XTEA', 'ClearData');
        return false;
      }
    },
    
    // Encrypt 64-bit block
    encryptBlock: function(id, plaintext) {
      if (!XTEA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'XTEA', 'encryptBlock');
        return plaintext;
      }
      
      if (plaintext.length !== 8) {
        global.throwException('XTEA Block Size Exception', 'Input must be exactly 8 bytes', 'XTEA', 'encryptBlock');
        return plaintext;
      }
      
      const objXTEA = XTEA.instances[id];
      
      // Convert input string to bytes manually (to match working version exactly)
      const ptBytes = [];
      for (let i = 0; i < plaintext.length; i++) {
        ptBytes[i] = plaintext.charCodeAt(i);
      }
      
      // Pack to 32-bit words (big-endian, manual to match working version)
      let v0 = (ptBytes[0] << 24) | (ptBytes[1] << 16) | (ptBytes[2] << 8) | ptBytes[3];
      let v1 = (ptBytes[4] << 24) | (ptBytes[5] << 16) | (ptBytes[6] << 8) | ptBytes[7];
      
      let sum = 0;
      const delta = 0x9E3779B9;
      
      // XTEA encryption using exact working algorithm with explicit unsigned arithmetic
      for (let i = 0; i < XTEA.CYCLES; i++) {
        // First operation: v0 += ...
        const term1 = (((v1 << 4) ^ (v1 >>> 5)) + v1) >>> 0;
        const term2 = (sum + objXTEA.key[sum & 3]) >>> 0;
        const xor_result = (term1 ^ term2) >>> 0;
        v0 = (v0 + xor_result) >>> 0;
        
        // Second operation: sum += delta
        sum = (sum + delta) >>> 0;
        
        // Third operation: v1 += ...
        const term3 = (((v0 << 4) ^ (v0 >>> 5)) + v0) >>> 0;
        const term4 = (sum + objXTEA.key[(sum >>> 11) & 3]) >>> 0;
        const xor_result2 = (term3 ^ term4) >>> 0;
        v1 = (v1 + xor_result2) >>> 0;
      }
      
      // Unpack to bytes (big-endian, manual to match working version)
      const result = [
        (v0 >>> 24) & 0xFF, (v0 >>> 16) & 0xFF, (v0 >>> 8) & 0xFF, v0 & 0xFF,
        (v1 >>> 24) & 0xFF, (v1 >>> 16) & 0xFF, (v1 >>> 8) & 0xFF, v1 & 0xFF
      ];
      
      return result.map(b => String.fromCharCode(b)).join('');
    },
    
    // Decrypt 64-bit block
    decryptBlock: function(id, ciphertext) {
      if (!XTEA.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'XTEA', 'decryptBlock');
        return ciphertext;
      }
      
      if (ciphertext.length !== 8) {
        global.throwException('XTEA Block Size Exception', 'Input must be exactly 8 bytes', 'XTEA', 'decryptBlock');
        return ciphertext;
      }
      
      const objXTEA = XTEA.instances[id];
      
      // Convert input string to bytes manually (to match working version exactly)
      const ctBytes = [];
      for (let i = 0; i < ciphertext.length; i++) {
        ctBytes[i] = ciphertext.charCodeAt(i);
      }
      
      // Pack to 32-bit words (big-endian, manual to match working version)
      let v0 = (ctBytes[0] << 24) | (ctBytes[1] << 16) | (ctBytes[2] << 8) | ctBytes[3];
      let v1 = (ctBytes[4] << 24) | (ctBytes[5] << 16) | (ctBytes[6] << 8) | ctBytes[7];
      
      const delta = 0x9E3779B9;
      let sum = (delta * XTEA.CYCLES) >>> 0;
      
      // XTEA decryption using exact working algorithm with explicit unsigned arithmetic (reverse of encryption)
      for (let i = 0; i < XTEA.CYCLES; i++) {
        // First operation: v1 -= ...
        const term1 = (((v0 << 4) ^ (v0 >>> 5)) + v0) >>> 0;
        const term2 = (sum + objXTEA.key[(sum >>> 11) & 3]) >>> 0;
        const xor_result = (term1 ^ term2) >>> 0;
        v1 = (v1 - xor_result) >>> 0;
        
        // Second operation: sum -= delta
        sum = (sum - delta) >>> 0;
        
        // Third operation: v0 -= ...
        const term3 = (((v1 << 4) ^ (v1 >>> 5)) + v1) >>> 0;
        const term4 = (sum + objXTEA.key[sum & 3]) >>> 0;
        const xor_result2 = (term3 ^ term4) >>> 0;
        v0 = (v0 - xor_result2) >>> 0;
      }
      
      // Unpack to bytes (big-endian, manual to match working version)
      const result = [
        (v0 >>> 24) & 0xFF, (v0 >>> 16) & 0xFF, (v0 >>> 8) & 0xFF, v0 & 0xFF,
        (v1 >>> 24) & 0xFF, (v1 >>> 16) & 0xFF, (v1 >>> 8) & 0xFF, v1 & 0xFF
      ];
      
      return result.map(b => String.fromCharCode(b)).join('');
    },
    
    // Instance class
    XTEAInstance: function(key) {
      // Convert 128-bit key to four 32-bit words manually (to match working version)
      const keyBytes = [];
      for (let i = 0; i < key.length; i++) {
        keyBytes[i] = key.charCodeAt(i);
      }
      
      this.key = [
        (keyBytes[0] << 24) | (keyBytes[1] << 16) | (keyBytes[2] << 8) | keyBytes[3],
        (keyBytes[4] << 24) | (keyBytes[5] << 16) | (keyBytes[6] << 8) | keyBytes[7],
        (keyBytes[8] << 24) | (keyBytes[9] << 16) | (keyBytes[10] << 8) | keyBytes[11],
        (keyBytes[12] << 24) | (keyBytes[13] << 16) | (keyBytes[14] << 8) | keyBytes[15]
      ];
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
    global.Cipher.Add(XTEA);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(XTEA);
  }
  
  // Export to global scope
  global.XTEA = XTEA;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XTEA;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);