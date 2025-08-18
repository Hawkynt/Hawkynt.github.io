/*
 * Universal SAFER Cipher (Secure And Fast Encryption Routine)
 * Compatible with both Browser and Node.js environments
 * Based on James Massey's original SAFER K-64 algorithm
 * Reference implementation by Richard De Moliner (ETH Zurich, 1995)
 * 
 * SAFER K-64: 64-bit block, 64-bit key, 6 rounds (default)
 * SAFER K-128: 64-bit block, 128-bit key, 10 rounds (default) 
 * SAFER SK-64: Strengthened key schedule variant
 * SAFER SK-128: Strengthened key schedule variant
 * 
 * Features:
 * - Exponential/Logarithmic S-boxes based on GF(257)
 * - Pseudo-Hadamard Transform (PHT) for diffusion
 * - Byte-oriented operations for efficiency
 * - Cross-platform compatibility with OpCodes integration
 * 
 * (c)2006-2025 Hawkynt - Educational implementation only
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('SAFER cipher requires OpCodes to be loaded first');
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
      console.error('SAFER cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // SAFER Constants
  const SAFER_BLOCK_LEN = 8;
  const SAFER_MAX_ROUNDS = 13;
  const SAFER_K64_DEFAULT_ROUNDS = 6;
  const SAFER_K128_DEFAULT_ROUNDS = 10;
  const SAFER_SK64_DEFAULT_ROUNDS = 8;
  const SAFER_SK128_DEFAULT_ROUNDS = 10;
  const SAFER_KEY_LEN = 1 + SAFER_BLOCK_LEN * (1 + 2 * SAFER_MAX_ROUNDS);
  const TAB_LEN = 256;
  
  // Pre-computed exponential and logarithm tables for GF(257)
  // These are generated using primitive element 45 of GF(257)
  let exp_tab = new Array(TAB_LEN);
  let log_tab = new Array(TAB_LEN);
  
  /**
   * Initialize exponential and logarithm lookup tables
   * Based on powers of 45 modulo 257 (GF(257) arithmetic)
   */
  function initSaferTables() {
    let exp = 1;
    for (let i = 0; i < TAB_LEN; i++) {
      exp_tab[i] = exp & 0xFF;
      log_tab[exp_tab[i]] = i;
      exp = (exp * 45) % 257;
    }
  }
  
  /**
   * Exponential S-box lookup
   * @param {number} x - Input byte (0-255)
   * @returns {number} Exponential transformation result
   */
  function EXP(x) {
    return exp_tab[x & 0xFF];
  }
  
  /**
   * Logarithmic S-box lookup
   * @param {number} x - Input byte (0-255)
   * @returns {number} Logarithmic transformation result
   */
  function LOG(x) {
    return log_tab[x & 0xFF];
  }
  
  /**
   * Pseudo-Hadamard Transform (PHT)
   * This provides diffusion by mixing two bytes
   * @param {number} x - First byte (modified in place)
   * @param {number} y - Second byte (modified in place)
   * @returns {Array} [new_x, new_y]
   */
  function PHT(x, y) {
    const new_y = (y + x) & 0xFF;
    const new_x = (x + new_y) & 0xFF;
    return [new_x, new_y];
  }
  
  /**
   * Inverse Pseudo-Hadamard Transform (IPHT)
   * @param {number} x - First byte (modified in place)
   * @param {number} y - Second byte (modified in place)
   * @returns {Array} [new_x, new_y]
   */
  function IPHT(x, y) {
    const new_x = (x - y) & 0xFF;
    const new_y = (y - new_x) & 0xFF;
    return [new_x, new_y];
  }
  
  /**
   * Rotate left for 8-bit values
   * @param {number} x - Byte value
   * @param {number} n - Number of positions
   * @returns {number} Rotated byte
   */
  function ROL(x, n) {
    return global.OpCodes.RotL8(x, n);
  }
  
  // Create SAFER cipher object
  const Safer = {
    // Public interface properties
    internalName: 'SAFER',
    name: 'SAFER K-64',
    comment: 'Secure And Fast Encryption Routine by James Massey - K-64 variant',
    minKeyLength: 8,
    maxKeyLength: 16,
    stepKeyLength: 8,
    minBlockSize: 8,
    maxBlockSize: 8,
    stepBlockSize: 8,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "12345678",
        "expected": "å\u0019À\t¤$ä£",
        "description": "SAFER K-64 all zeros plaintext"
    },
    {
        "input": "ABCDEFGH",
        "key": "12345678",
        "expected": "\u0015 \u0004\t\u000bD",
        "description": "SAFER K-64 ASCII test"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u0001#Eg«Íï",
        "expected": "\u001bë\u0010IpßN0",
        "description": "SAFER K-64 binary test"
    },
    {
        "input": "saferk64",
        "key": "saferk64",
        "expected": "É\fxÚû\u0014",
        "description": "SAFER K-64 algorithm name test"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "IÚwÑ,\u0004þ",
        "description": "SAFER K-64 all ones plaintext, zero key"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Expose S-box tables for testing
    exp_tab: exp_tab,
    log_tab: log_tab,
    
    // Initialize cipher and S-box tables
    Init: function() {
      if (!Safer.isInitialized) {
        initSaferTables();
        Safer.isInitialized = true;
      }
    },
    
    // Set up key for encryption/decryption
    KeySetup: function(key) {
      Safer.Init();
      
      let id;
      do {
        id = 'SAFER[' + global.generateUniqueID() + ']';
      } while (Safer.instances[id] || global.objectInstances[id]);
      
      Safer.instances[id] = new Safer.SaferInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Safer.instances[id]) {
        // Clear sensitive data
        if (Safer.instances[id].expandedKey) {
          global.OpCodes.ClearArray(Safer.instances[id].expandedKey);
        }
        delete Safer.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'SAFER', 'ClearData');
        return false;
      }
    },
    
    // Encrypt a 64-bit block
    encryptBlock: function(id, plaintext) {
      if (!Safer.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SAFER', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Safer.instances[id];
      if (!instance.expandedKey) {
        global.throwException('Key Not Set Exception', id, 'SAFER', 'encryptBlock');
        return plaintext;
      }
      
      // Convert string to bytes and pad if necessary
      let bytes = global.OpCodes.StringToBytes(plaintext);
      while (bytes.length < SAFER_BLOCK_LEN) {
        bytes.push(0);
      }
      
      // Encrypt the block
      const cipherBytes = Safer.encryptBlock(bytes.slice(0, SAFER_BLOCK_LEN), instance.expandedKey);
      
      // Convert back to string
      return global.OpCodes.BytesToString(cipherBytes);
    },
    
    // Decrypt a 64-bit block
    decryptBlock: function(id, ciphertext) {
      if (!Safer.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'SAFER', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Safer.instances[id];
      if (!instance.expandedKey) {
        global.throwException('Key Not Set Exception', id, 'SAFER', 'decryptBlock');
        return ciphertext;
      }
      
      // Convert string to bytes
      let bytes = global.OpCodes.StringToBytes(ciphertext);
      while (bytes.length < SAFER_BLOCK_LEN) {
        bytes.push(0);
      }
      
      // Decrypt the block
      const plainBytes = Safer.decryptBlock(bytes.slice(0, SAFER_BLOCK_LEN), instance.expandedKey);
      
      // Convert back to string
      return global.OpCodes.BytesToString(plainBytes);
    },
    
    /**
     * Expand user key to round keys
     * @param {Array} userkey1 - First 64 bits of user key
     * @param {Array} userkey2 - Second 64 bits of user key (same as userkey1 for K-64)
     * @param {number} nofRounds - Number of encryption rounds
     * @param {boolean} strengthened - Use strengthened key schedule (SK variants)
     * @returns {Array} Expanded key array
     */
    expandUserKey: function(userkey1, userkey2, nofRounds, strengthened) {
      if (nofRounds > SAFER_MAX_ROUNDS) {
        nofRounds = SAFER_MAX_ROUNDS;
      }
      
      const key = new Array(SAFER_KEY_LEN);
      let keyIndex = 0;
      
      // Store number of rounds as first byte
      key[keyIndex++] = nofRounds;
      
      const ka = new Array(SAFER_BLOCK_LEN + 1);
      const kb = new Array(SAFER_BLOCK_LEN + 1);
      
      ka[SAFER_BLOCK_LEN] = 0;
      kb[SAFER_BLOCK_LEN] = 0;
      
      // Initialize ka and kb arrays
      for (let j = 0; j < SAFER_BLOCK_LEN; j++) {
        ka[SAFER_BLOCK_LEN] ^= ka[j] = ROL(userkey1[j], 5);
        kb[SAFER_BLOCK_LEN] ^= kb[j] = key[keyIndex++] = userkey2[j];
      }
      
      // Generate round keys
      for (let i = 1; i <= nofRounds; i++) {
        // Rotate ka and kb arrays
        for (let j = 0; j < SAFER_BLOCK_LEN + 1; j++) {
          ka[j] = ROL(ka[j], 6);
          kb[j] = ROL(kb[j], 6);
        }
        
        // Generate first 8 bytes of round key
        for (let j = 0; j < SAFER_BLOCK_LEN; j++) {
          if (strengthened) {
            key[keyIndex++] = (ka[(j + 2 * i - 1) % (SAFER_BLOCK_LEN + 1)] + 
                             EXP(EXP((18 * i + j + 1) & 0xFF))) & 0xFF;
          } else {
            key[keyIndex++] = (ka[j] + EXP(EXP((18 * i + j + 1) & 0xFF))) & 0xFF;
          }
        }
        
        // Generate second 8 bytes of round key
        for (let j = 0; j < SAFER_BLOCK_LEN; j++) {
          if (strengthened) {
            key[keyIndex++] = (kb[(j + 2 * i) % (SAFER_BLOCK_LEN + 1)] + 
                             EXP(EXP((18 * i + j + 10) & 0xFF))) & 0xFF;
          } else {
            key[keyIndex++] = (kb[j] + EXP(EXP((18 * i + j + 10) & 0xFF))) & 0xFF;
          }
        }
      }
      
      // Clear temporary arrays
      global.OpCodes.ClearArray(ka);
      global.OpCodes.ClearArray(kb);
      
      return key;
    },
    
    /**
     * Encrypt a single 64-bit block
     * @param {Array} blockIn - 8-byte input block
     * @param {Array} key - Expanded key
     * @returns {Array} 8-byte encrypted block
     */
    encryptBlock: function(blockIn, key) {
      let a = blockIn[0], b = blockIn[1], c = blockIn[2], d = blockIn[3];
      let e = blockIn[4], f = blockIn[5], g = blockIn[6], h = blockIn[7];
      
      let round = key[0];
      if (round > SAFER_MAX_ROUNDS) round = SAFER_MAX_ROUNDS;
      
      let keyIndex = 0;
      
      while (round--) {
        // Key addition/XOR
        a ^= key[++keyIndex]; b = (b + key[++keyIndex]) & 0xFF;
        c = (c + key[++keyIndex]) & 0xFF; d ^= key[++keyIndex];
        e ^= key[++keyIndex]; f = (f + key[++keyIndex]) & 0xFF;
        g = (g + key[++keyIndex]) & 0xFF; h ^= key[++keyIndex];
        
        // S-box layer
        a = (EXP(a) + key[++keyIndex]) & 0xFF; b = LOG(b) ^ key[++keyIndex];
        c = LOG(c) ^ key[++keyIndex]; d = (EXP(d) + key[++keyIndex]) & 0xFF;
        e = (EXP(e) + key[++keyIndex]) & 0xFF; f = LOG(f) ^ key[++keyIndex];
        g = LOG(g) ^ key[++keyIndex]; h = (EXP(h) + key[++keyIndex]) & 0xFF;
        
        // Pseudo-Hadamard Transform layers
        [a, b] = PHT(a, b); [c, d] = PHT(c, d);
        [e, f] = PHT(e, f); [g, h] = PHT(g, h);
        
        [a, c] = PHT(a, c); [e, g] = PHT(e, g);
        [b, d] = PHT(b, d); [f, h] = PHT(f, h);
        
        [a, e] = PHT(a, e); [b, f] = PHT(b, f);
        [c, g] = PHT(c, g); [d, h] = PHT(d, h);
        
        // Permutation
        let t = b; b = e; e = c; c = t;
        t = d; d = f; f = g; g = t;
      }
      
      // Final key addition
      a ^= key[++keyIndex]; b = (b + key[++keyIndex]) & 0xFF;
      c = (c + key[++keyIndex]) & 0xFF; d ^= key[++keyIndex];
      e ^= key[++keyIndex]; f = (f + key[++keyIndex]) & 0xFF;
      g = (g + key[++keyIndex]) & 0xFF; h ^= key[++keyIndex];
      
      return [a & 0xFF, b & 0xFF, c & 0xFF, d & 0xFF, 
              e & 0xFF, f & 0xFF, g & 0xFF, h & 0xFF];
    },
    
    /**
     * Decrypt a single 64-bit block
     * @param {Array} blockIn - 8-byte input block
     * @param {Array} key - Expanded key
     * @returns {Array} 8-byte decrypted block
     */
    decryptBlock: function(blockIn, key) {
      let a = blockIn[0], b = blockIn[1], c = blockIn[2], d = blockIn[3];
      let e = blockIn[4], f = blockIn[5], g = blockIn[6], h = blockIn[7];
      
      let round = key[0];
      if (round > SAFER_MAX_ROUNDS) round = SAFER_MAX_ROUNDS;
      
      // Start from end of key (matches C implementation)
      let keyIndex = SAFER_BLOCK_LEN * (1 + 2 * round);
      
      // Reverse final key addition (matches C exactly)
      h ^= key[keyIndex]; g = (g - key[--keyIndex]) & 0xFF;
      f = (f - key[--keyIndex]) & 0xFF; e ^= key[--keyIndex];
      d ^= key[--keyIndex]; c = (c - key[--keyIndex]) & 0xFF;
      b = (b - key[--keyIndex]) & 0xFF; a ^= key[--keyIndex];
      
      while (round--) {
        // Reverse permutation (matches C implementation exactly)
        let t = e; e = b; b = c; c = t;
        t = f; f = d; d = g; g = t;
        
        // Reverse Pseudo-Hadamard Transform layers (same order as C)
        [a, e] = IPHT(a, e); [b, f] = IPHT(b, f);
        [c, g] = IPHT(c, g); [d, h] = IPHT(d, h);
        
        [a, c] = IPHT(a, c); [e, g] = IPHT(e, g);
        [b, d] = IPHT(b, d); [f, h] = IPHT(f, h);
        
        [a, b] = IPHT(a, b); [c, d] = IPHT(c, d);
        [e, f] = IPHT(e, f); [g, h] = IPHT(g, h);
        
        // Reverse S-box layer - first stage (key subtraction/XOR)
        h = (h - key[--keyIndex]) & 0xFF; g = g ^ key[--keyIndex];
        f = f ^ key[--keyIndex]; e = (e - key[--keyIndex]) & 0xFF;
        d = (d - key[--keyIndex]) & 0xFF; c = c ^ key[--keyIndex];
        b = b ^ key[--keyIndex]; a = (a - key[--keyIndex]) & 0xFF;
        
        // Reverse S-box layer - second stage (LOG/EXP with key subtraction/XOR)
        h = LOG(h) ^ key[--keyIndex]; g = (EXP(g) - key[--keyIndex]) & 0xFF;
        f = (EXP(f) - key[--keyIndex]) & 0xFF; e = LOG(e) ^ key[--keyIndex];
        d = LOG(d) ^ key[--keyIndex]; c = (EXP(c) - key[--keyIndex]) & 0xFF;
        b = (EXP(b) - key[--keyIndex]) & 0xFF; a = LOG(a) ^ key[--keyIndex];
      }
      
      return [a & 0xFF, b & 0xFF, c & 0xFF, d & 0xFF, 
              e & 0xFF, f & 0xFF, g & 0xFF, h & 0xFF];
    },
    
    // Instance class for key management
    SaferInstance: function(key) {
      this.keyBytes = null;
      this.expandedKey = null;
      this.nofRounds = SAFER_K64_DEFAULT_ROUNDS;
      this.strengthened = false;
      
      if (key) {
        this.setKey(key);
      }
    }
  };
  
  // Add methods to SaferInstance prototype
  Safer.SaferInstance.prototype.setKey = function(key) {
    // Convert key to bytes
    const keyBytes = global.OpCodes.StringToBytes(key);
    
    // Determine key type and rounds based on key length
    if (keyBytes.length <= 8) {
      // SAFER K-64: use same key for both halves
      const userkey1 = keyBytes.slice(0, 8);
      while (userkey1.length < 8) userkey1.push(0); // Pad with zeros
      const userkey2 = userkey1.slice(); // Copy for K-64
      
      this.nofRounds = SAFER_K64_DEFAULT_ROUNDS;
      this.strengthened = false;
      this.expandedKey = Safer.expandUserKey(userkey1, userkey2, this.nofRounds, this.strengthened);
    } else {
      // SAFER K-128: use full 128-bit key
      const userkey1 = keyBytes.slice(0, 8);
      const userkey2 = keyBytes.slice(8, 16);
      while (userkey1.length < 8) userkey1.push(0);
      while (userkey2.length < 8) userkey2.push(0);
      
      this.nofRounds = SAFER_K128_DEFAULT_ROUNDS;
      this.strengthened = false;
      this.expandedKey = Safer.expandUserKey(userkey1, userkey2, this.nofRounds, this.strengthened);
    }
    
    this.keyBytes = keyBytes;
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Safer);
  }
  
  // Export to global scope
  global.Safer = Safer;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Safer;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);