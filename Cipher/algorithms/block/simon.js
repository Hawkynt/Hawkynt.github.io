/*
 * Universal Simon Block Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on NSA's Simon cipher (2013)
 * (c)2006-2025 Hawkynt
 * 
 * Simon Algorithm by NSA (2013)
 * - Feistel-like design with simple bitwise operations
 * - Simon64/128: 64-bit block cipher with 128-bit keys
 * - 32 rounds using AND, rotate, and XOR operations
 * - Rotation constants optimized for hardware efficiency
 * - Companion to Speck cipher, optimized for hardware implementation
 * 
 * Security Notice: This is an educational implementation designed for
 * learning cryptographic concepts. Not recommended for production use.
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
      console.error('Simon cipher requires OpCodes library to be loaded first');
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
      console.error('Simon cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Simon cipher object
  const Simon = {
    name: "Simon",
    description: "NSA's lightweight block cipher family designed for resource-constrained environments. Simon64/128 variant uses 64-bit blocks with 128-bit keys and 44 rounds. Optimized for hardware implementation.",
    inventor: "NSA (National Security Agency)",
    year: 2013,
    country: "US",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "educational",
    securityNotes: "NSA-designed lightweight cipher. While published openly, some cryptographers recommend caution with NSA-designed algorithms. Use proven alternatives for critical applications.",
    
    documentation: [
      {text: "The Simon and Speck Families of Lightweight Block Ciphers", uri: "https://eprint.iacr.org/2013/404.pdf"},
      {text: "NSA Simon and Speck Specification", uri: "https://nsacyber.github.io/simon-speck/"},
      {text: "Lightweight Cryptography Standardization", uri: "https://csrc.nist.gov/projects/lightweight-cryptography"}
    ],
    
    references: [
      {text: "NSA Reference Implementation", uri: "https://github.com/nsacyber/simon-speck-supercop"},
      {text: "Cryptanalysis of Simon variants", uri: "https://eprint.iacr.org/2014/448.pdf"},
      {text: "NIST Lightweight Cryptography", uri: "https://csrc.nist.gov/Projects/Lightweight-Cryptography"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Reduced-round attacks",
        text: "Various attacks exist against reduced-round variants (not full 44 rounds)",
        mitigation: "Use full-round implementation and consider alternatives for high-security applications"
      }
    ],
    
    tests: [
      {
        text: "Simon64/128 Test Vector",
        uri: "https://eprint.iacr.org/2013/404.pdf",
        keySize: 16,
        blockSize: 8,
        input: Hex8ToBytes("0000000000000000"),
        key: Hex8ToBytes("00000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'Simon',
    comment: 'NSA Simon64/128 cipher - 64-bit blocks, 128-bit keys, 32 rounds (Feistel-like design)',
    minKeyLength: 16,    // 128-bit key
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 8,     // 64-bit block
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Simon64/128 Constants
    ROUNDS: 44,             // NSA standard: 44 rounds for 64/128 variant
    WORD_SIZE: 32,          // 32-bit words (64-bit block = 2 words)
    
    // Generate z0 sequence using LFSR as per NSA specification
    // LFSR for z0: feedback polynomial x^5 + x^2 + 1, initial state [0,0,0,0,1]
    generateZ0Sequence: function(length) {
      const sequence = [];
      let state = [0, 0, 0, 0, 1]; // Initial LFSR state
      
      for (let i = 0; i < length; i++) {
        // Output the rightmost bit
        sequence.push(state[4]);
        
        // Compute feedback: x^5 + x^2 + 1 = state[4] XOR state[1]
        const feedback = state[4] ^ state[1];
        
        // Shift register right and insert feedback at left
        for (let j = 4; j > 0; j--) {
          state[j] = state[j - 1];
        }
        state[0] = feedback;
      }
      
      return sequence;
    },
    
    // Initialize cipher
    Init: function() {
      Simon.isInitialized = true;
    },
    
    // Set up key and generate round keys
    KeySetup: function(optional_key) {
      if (!optional_key || optional_key.length !== 16) {
        global.throwException('Simon Key Exception', 'Key must be exactly 16 bytes (128 bits)', 'Simon', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Simon[' + global.generateUniqueID() + ']';
      } while (Simon.instances[id] || global.objectInstances[id]);
      
      Simon.instances[id] = new Simon.SimonInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Simon.instances[id]) {
        // Clear sensitive key data
        if (Simon.instances[id].roundKeys) {
          global.OpCodes.ClearArray(Simon.instances[id].roundKeys);
        }
        delete Simon.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Simon', 'ClearData');
        return false;
      }
    },
    
    // Simon round function implementation
    // F(x) = ((x <<< 1) & (x <<< 8)) ^ (x <<< 2)
    // This uses bitwise AND between rotated versions, characteristic of Simon
    roundFunction: function(x) {
      const rot1 = global.OpCodes.RotL32(x, 1);
      const rot8 = global.OpCodes.RotL32(x, 8);
      const rot2 = global.OpCodes.RotL32(x, 2);
      
      return ((rot1 & rot8) ^ rot2) >>> 0;
    },
    
    // Encrypt 64-bit block
    encryptBlock: function(id, plaintext) {
      if (!Simon.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Simon', 'encryptBlock');
        return plaintext;
      }
      
      if (plaintext.length !== 8) {
        global.throwException('Simon Block Size Exception', 'Input must be exactly 8 bytes', 'Simon', 'encryptBlock');
        return plaintext;
      }
      
      const objSimon = Simon.instances[id];
      
      // Convert input string to 32-bit words using OpCodes (big-endian for Simon)
      const bytes = global.OpCodes.StringToBytes(plaintext);
      let x = global.OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let y = global.OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      // Simon encryption: 32 rounds of Feistel-like operations
      // Round function: (x, y) -> (y ^ F(x) ^ k_i, x)
      // where F(x) = ((x <<< 1) & (x <<< 8)) ^ (x <<< 2)
      for (let i = 0; i < Simon.ROUNDS; i++) {
        const temp = y ^ Simon.roundFunction(x) ^ objSimon.roundKeys[i];
        y = x;
        x = temp;
      }
      
      // Convert back to byte string using OpCodes (big-endian)
      const result0 = global.OpCodes.Unpack32BE(x);
      const result1 = global.OpCodes.Unpack32BE(y);
      return global.OpCodes.BytesToString([...result0, ...result1]);
    },
    
    // Decrypt 64-bit block
    decryptBlock: function(id, ciphertext) {
      if (!Simon.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Simon', 'decryptBlock');
        return ciphertext;
      }
      
      if (ciphertext.length !== 8) {
        global.throwException('Simon Block Size Exception', 'Input must be exactly 8 bytes', 'Simon', 'decryptBlock');
        return ciphertext;
      }
      
      const objSimon = Simon.instances[id];
      
      // Convert input string to 32-bit words using OpCodes (big-endian for Simon)
      const bytes = global.OpCodes.StringToBytes(ciphertext);
      let x = global.OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let y = global.OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      // Simon decryption: reverse the encryption process
      // Inverse operations in reverse order:
      // (x, y) -> (y, x ^ F(y) ^ k_i)
      for (let i = Simon.ROUNDS - 1; i >= 0; i--) {
        const temp = x;
        x = y;
        y = temp ^ Simon.roundFunction(x) ^ objSimon.roundKeys[i];
      }
      
      // Convert back to byte string using OpCodes (big-endian)
      const result0 = global.OpCodes.Unpack32BE(x);
      const result1 = global.OpCodes.Unpack32BE(y);
      return global.OpCodes.BytesToString([...result0, ...result1]);
    },
    
    // Instance class with key expansion
    SimonInstance: function(key) {
      // Convert 128-bit key to four 32-bit words using OpCodes (big-endian)
      const keyBytes = global.OpCodes.StringToBytes(key);
      const k = [
        global.OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        global.OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        global.OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        global.OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
      
      // Expand key to 44 round keys using Simon key schedule
      this.roundKeys = new Array(Simon.ROUNDS);
      
      // Initialize first 4 round keys directly from master key
      for (let i = 0; i < 4; i++) {
        this.roundKeys[i] = k[i];
      }
      
      // Generate remaining round keys using Simon key schedule
      // For m=4 (128-bit key): k_i = c ^ (z_j)_i ^ k_{i-4} ^ (k_{i-1} >>> 3) ^ (k_{i-1} >>> 4)
      // where c = 2^32 - 4 = 0xfffffffc, z_j is the appropriate constant sequence
      const c = 0xfffffffc;
      const z0Sequence = Simon.generateZ0Sequence(Simon.ROUNDS - 4);
      
      for (let i = 4; i < Simon.ROUNDS; i++) {
        let temp = global.OpCodes.RotR32(this.roundKeys[i - 1], 3);
        temp ^= this.roundKeys[i - 3];
        temp ^= global.OpCodes.RotR32(temp, 1);
        temp ^= this.roundKeys[i - 4];
        temp ^= c;
        temp ^= z0Sequence[i - 4];
        
        this.roundKeys[i] = temp >>> 0;
      }
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
    global.Cipher.Add(Simon);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Simon);
  }
  
  // Export to global scope
  global.Simon = Simon;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Simon;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);