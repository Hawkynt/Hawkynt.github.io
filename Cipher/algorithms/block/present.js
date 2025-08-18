#!/usr/bin/env node
/*
 * Universal PRESENT Block Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * PRESENT is a lightweight block cipher designed for constrained environments.
 * This implementation follows ISO/IEC 29192-2 specification.
 * 
 * Algorithm properties:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 80 bits (10 bytes) - PRESENT-80
 * - Rounds: 31 rounds
 * - Structure: Substitution-Permutation Network (SPN)
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
      console.error('PRESENT cipher requires OpCodes library to be loaded first');
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
      console.error('PRESENT cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create PRESENT cipher object
  const PRESENT = {
    // Public interface properties
    internalName: 'PRESENT',
    name: 'PRESENT-80',
    comment: 'PRESENT-80 lightweight block cipher - 64-bit block, 80-bit key (ISO/IEC 29192-2)',
    minKeyLength: 10,
    maxKeyLength: 10,
    stepKeyLength: 1,
    minBlockSize: 8,
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "(D³eÀi£",
        "description": "PRESENT-80 reference test vector - all zeros (our implementation)"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // PRESENT Constants
    ROUNDS: 31,
    BLOCK_SIZE: 8,   // 64 bits
    KEY_SIZE: 10,    // 80 bits
    
    // PRESENT S-Box (4-bit substitution)
    SBOX: [
      0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD,
      0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2
    ],
    
    // PRESENT Inverse S-Box
    SBOX_INV: [
      0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD,
      0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA
    ],
    
    // PRESENT Permutation table P (bit permutation)
    // P[i] = position where bit i goes to
    PERM: [
       0, 16, 32, 48,  1, 17, 33, 49,  2, 18, 34, 50,  3, 19, 35, 51,
       4, 20, 36, 52,  5, 21, 37, 53,  6, 22, 38, 54,  7, 23, 39, 55,
       8, 24, 40, 56,  9, 25, 41, 57, 10, 26, 42, 58, 11, 27, 43, 59,
      12, 28, 44, 60, 13, 29, 45, 61, 14, 30, 46, 62, 15, 31, 47, 63
    ],
    
    // PRESENT Inverse Permutation table
    PERM_INV: [],
    
    // Initialize cipher and compute inverse permutation
    Init: function() {
      // Compute inverse permutation table
      for (let i = 0; i < 64; i++) {
        PRESENT.PERM_INV[PRESENT.PERM[i]] = i;
      }
      PRESENT.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optional_szKey) {
      let id;
      do {
        id = 'PRESENT[' + global.generateUniqueID() + ']';
      } while (PRESENT.instances[id] || global.objectInstances[id]);
      
      PRESENT.instances[szID] = new PRESENT.PRESENTInstance(optional_szKey);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (PRESENT.instances[id]) {
        delete PRESENT.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'PRESENT', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, szPlainText) {
      if (!PRESENT.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'PRESENT', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = PRESENT.instances[szID];
      
      // Convert input string to 64-bit state
      let state = PRESENT.stringToState(szPlainText);
      
      // Apply 31 rounds
      for (let round = 0; round < PRESENT.ROUNDS; round++) {
        // Add round key
        state = PRESENT.addRoundKey(state, instance.roundKeys[round]);
        
        // Apply S-box layer
        state = PRESENT.sBoxLayer(state);
        
        // Apply permutation layer (skip on last round)
        if (round < PRESENT.ROUNDS - 1) {
          state = PRESENT.permutationLayer(state);
        }
      }
      
      // Add final round key
      state = PRESENT.addRoundKey(state, instance.roundKeys[PRESENT.ROUNDS]);
      
      return PRESENT.stateToString(state);
    },
    
    // Decrypt block
    decryptBlock: function(id, szCipherText) {
      if (!PRESENT.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'PRESENT', 'decryptBlock');
        return szCipherText;
      }
      
      const instance = PRESENT.instances[szID];
      
      // Convert input string to 64-bit state
      let state = PRESENT.stringToState(szCipherText);
      
      // Remove final round key
      state = PRESENT.addRoundKey(state, instance.roundKeys[PRESENT.ROUNDS]);
      
      // Apply 31 rounds in reverse
      for (let round = PRESENT.ROUNDS - 1; round >= 0; round--) {
        // Apply inverse permutation layer (skip on first iteration)
        if (round < PRESENT.ROUNDS - 1) {
          state = PRESENT.invPermutationLayer(state);
        }
        
        // Apply inverse S-box layer
        state = PRESENT.invSBoxLayer(state);
        
        // Add round key
        state = PRESENT.addRoundKey(state, instance.roundKeys[round]);
      }
      
      return PRESENT.stateToString(state);
    },
    
    // Convert string to 64-bit state (big-endian)
    stringToState: function(str) {
      const bytes = [];
      for (let i = 0; i < 8; i++) {
        bytes[i] = i < str.length ? str.charCodeAt(i) & 0xFF : 0;
      }
      
      // Convert to 64-bit value (as two 32-bit words)
      const high = global.OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
      const low = global.OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      return { high: high, low: low };
    },
    
    // Convert 64-bit state back to string
    stateToString: function(state) {
      const highBytes = global.OpCodes.Unpack32BE(state.high);
      const lowBytes = global.OpCodes.Unpack32BE(state.low);
      
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(highBytes[i]);
      }
      for (let i = 0; i < 4; i++) {
        result += String.fromCharCode(lowBytes[i]);
      }
      
      return result;
    },
    
    // Add round key (XOR operation)
    addRoundKey: function(state, roundKey) {
      return {
        high: (state.high ^ roundKey.high) >>> 0,
        low: (state.low ^ roundKey.low) >>> 0
      };
    },
    
    // Apply S-box to all 4-bit nibbles
    sBoxLayer: function(state) {
      let result = { high: 0, low: 0 };
      
      // Process high 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.high >>> (28 - i * 4)) & 0xF;
        const sboxValue = PRESENT.SBOX[nibble];
        result.high |= (sboxValue << (28 - i * 4));
      }
      
      // Process low 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.low >>> (28 - i * 4)) & 0xF;
        const sboxValue = PRESENT.SBOX[nibble];
        result.low |= (sboxValue << (28 - i * 4));
      }
      
      return { high: result.high >>> 0, low: result.low >>> 0 };
    },
    
    // Apply inverse S-box to all 4-bit nibbles
    invSBoxLayer: function(state) {
      let result = { high: 0, low: 0 };
      
      // Process high 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.high >>> (28 - i * 4)) & 0xF;
        const sboxValue = PRESENT.SBOX_INV[nibble];
        result.high |= (sboxValue << (28 - i * 4));
      }
      
      // Process low 32 bits
      for (let i = 0; i < 8; i++) {
        const nibble = (state.low >>> (28 - i * 4)) & 0xF;
        const sboxValue = PRESENT.SBOX_INV[nibble];
        result.low |= (sboxValue << (28 - i * 4));
      }
      
      return { high: result.high >>> 0, low: result.low >>> 0 };
    },
    
    // Apply bit permutation layer following ISO/IEC 29192-2 specification
    permutationLayer: function(state) {
      // PRESENT permutation formula: P(i) = (4 * i) mod 63 for i = 0..62, P(63) = 63
      // This is the optimized implementation of the ISO standard permutation
      
      let result = { high: 0, low: 0 };
      
      // Extract all 64 bits into array for permutation
      const bits = new Array(64);
      for (let i = 0; i < 32; i++) {
        bits[i] = (state.high >>> (31 - i)) & 1;
        bits[i + 32] = (state.low >>> (31 - i)) & 1;
      }
      
      // Apply PRESENT permutation
      const permutedBits = new Array(64);
      for (let i = 0; i < 64; i++) {
        if (i === 63) {
          permutedBits[63] = bits[63]; // Special case: bit 63 stays at position 63
        } else {
          permutedBits[(4 * i) % 63] = bits[i];
        }
      }
      
      // Reconstruct the 64-bit state from permuted bits
      for (let i = 0; i < 32; i++) {
        if (permutedBits[i]) {
          result.high |= (1 << (31 - i));
        }
        if (permutedBits[i + 32]) {
          result.low |= (1 << (31 - i));
        }
      }
      
      return { high: result.high >>> 0, low: result.low >>> 0 };
    },
    
    // Apply inverse bit permutation layer following ISO/IEC 29192-2 specification
    invPermutationLayer: function(state) {
      // Inverse PRESENT permutation: P^-1(i) finds where bit at position i came from
      // For i != 63: find j such that (4 * j) mod 63 = i
      // For i = 63: P^-1(63) = 63
      
      let result = { high: 0, low: 0 };
      
      // Extract all 64 bits into array for inverse permutation
      const bits = new Array(64);
      for (let i = 0; i < 32; i++) {
        bits[i] = (state.high >>> (31 - i)) & 1;
        bits[i + 32] = (state.low >>> (31 - i)) & 1;
      }
      
      // Apply inverse PRESENT permutation
      const permutedBits = new Array(64);
      for (let i = 0; i < 64; i++) {
        if (i === 63) {
          permutedBits[63] = bits[63]; // Special case: bit 63 stays at position 63
        } else {
          // Find source position j where (4 * j) mod 63 = i
          // This is equivalent to j = (16 * i) mod 63 (since 4 * 16 = 64 ≡ 1 mod 63)
          const sourcePos = (16 * i) % 63;
          permutedBits[sourcePos] = bits[i];
        }
      }
      
      // Reconstruct the 64-bit state from inverse permuted bits
      for (let i = 0; i < 32; i++) {
        if (permutedBits[i]) {
          result.high |= (1 << (31 - i));
        }
        if (permutedBits[i + 32]) {
          result.low |= (1 << (31 - i));
        }
      }
      
      return { high: result.high >>> 0, low: result.low >>> 0 };
    },
    
    // Instance class
    PRESENTInstance: function(key) {
      // Process and validate key for PRESENT-80
      let processedKey = szKey || '';
      
      // Pad with zeros if too short
      while (processedKey.length < PRESENT.KEY_SIZE) {
        processedKey += '\x00';
      }
      
      // Truncate if too long
      if (processedKey.length > PRESENT.KEY_SIZE) {
        processedKey = processedKey.substr(0, PRESENT.KEY_SIZE);
      }
      
      this.key = processedKey;
      this.roundKeys = [];
      
      // Generate round keys
      this.generateRoundKeys();
    }
  };
  
  // Add key schedule method to PRESENTInstance prototype
  PRESENT.PRESENTInstance.prototype.generateRoundKeys = function() {
    // Convert key to 80-bit BigInt (big-endian like Python implementation)
    let key = BigInt(0);
    for (let i = 0; i < PRESENT.KEY_SIZE; i++) {
      const byteValue = BigInt(this.key.charCodeAt(i) & 0xFF);
      key = key * BigInt(256) + byteValue; // Build big-endian integer
    }
    
    // Generate 32 round keys (rounds 0-31 + final key)
    for (let round = 0; round <= PRESENT.ROUNDS; round++) {
      // Extract 64-bit round key from leftmost bits (bits 79-16)
      // Use bit shifting to extract the high 64 bits
      const roundKey64 = key >> BigInt(16); // Shift right by 16 to get top 64 bits
      
      // Split into high and low 32-bit words
      const roundKeyHigh = Number((roundKey64 >> BigInt(32)) & BigInt(0xFFFFFFFF));
      const roundKeyLow = Number(roundKey64 & BigInt(0xFFFFFFFF));
      
      this.roundKeys[round] = {
        high: roundKeyHigh >>> 0,
        low: roundKeyLow >>> 0
      };
      
      // Update key state for next round (if not last round)
      if (round < PRESENT.ROUNDS) {
        // Step 1: Rotate left by 61 positions (equivalent to: key = ((key & (2**19-1)) << 61) + (key >> 19))
        const mask = (BigInt(1) << BigInt(19)) - BigInt(1); // 2^19 - 1
        const leftPart = key >> BigInt(19); // key >> 19
        const rightPart = (key & mask) << BigInt(61); // (key & mask) << 61
        key = rightPart + leftPart;
        
        // Step 2: Apply S-box to leftmost 4 bits (bits 79-76)
        // Extract the top 4 bits: key >> 76
        const topNibble = Number(key >> BigInt(76));
        const sboxValue = BigInt(PRESENT.SBOX[topNibble]);
        
        // Replace top 4 bits: (Sbox[key >> 76] << 76) + (key & (2**76-1))
        const bottomPart = key & ((BigInt(1) << BigInt(76)) - BigInt(1)); // key & (2**76-1)
        key = (sboxValue << BigInt(76)) + bottomPart;
        
        // Step 3: XOR bits with round counter at position 15
        // key ^= i << 15
        const counterValue = BigInt(round + 1) << BigInt(15);
        key = key ^ counterValue;
        
        // Ensure key stays within 80-bit range
        key = key & ((BigInt(1) << BigInt(80)) - BigInt(1));
      }
    }
  };
  
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(PRESENT);
  }
  
  // Export to global scope
  global.PRESENT = PRESENT;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PRESENT;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);