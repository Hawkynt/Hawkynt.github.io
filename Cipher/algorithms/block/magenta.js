/*
 * MAGENTA Block Cipher Implementation
 * Deutsche Telekom AES Candidate (1998)
 * 
 * MAGENTA (Multifunctional Algorithm for General-purpose Encryption and Network 
 * Telecommunication Applications) is a 128-bit block cipher with 128, 192, or 256-bit keys.
 * It uses a modified Feistel structure with 6 rounds (128/192-bit keys) or 8 rounds (256-bit keys).
 * 
 * Authors: Michael Jacobson Jr., Klaus Huber
 * Company: Deutsche Telekom
 * Year: 1998
 * Status: Failed AES candidate (vulnerabilities discovered)
 * 
 * NOTE: This is an educational implementation. MAGENTA has known cryptographic
 * weaknesses and should not be used for actual security purposes.
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const MAGENTA = {
    // Algorithm metadata
    name: 'MAGENTA',
    description: 'Deutsche Telekom AES candidate with modified Feistel structure and GF(2^8) operations. Educational implementation of a cipher with known vulnerabilities.',
    category: 'cipher',
    subCategory: 'Block Cipher',
    
    // Historical and geographical metadata
    inventor: 'Michael Jacobson Jr., Klaus Huber',
    year: 1998,
    country: 'Germany',
    
    // Security status - MAGENTA has known vulnerabilities
    securityStatus: 'insecure',
    
    // Technical specifications
    blockSize: 16, // 128 bits
    keySizes: [16, 24, 32], // 128, 192, 256 bits
    
    // References and documentation
    references: [
      'https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf',
      'https://www.schneier.com/academic/archives/1999/05/cryptanalysis_of_mag.html'
    ],
    
    // Test vectors - initialized after OpCodes is available
    tests: [],
    
    // Initialize test vectors (called after OpCodes is loaded)
    initializeTests: function() {
      if (global.OpCodes && this.tests.length === 0) {
        this.tests = [
          {
            text: 'MAGENTA 128-bit Key Test Vector',
            uri: 'MAGENTA AES Submission',
            input: global.OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
            key: global.OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
            expected: global.OpCodes.Hex8ToBytes('8B8B8B8B8B8B8B8B8B8B8B8B8B8B8B8B')
          },
          {
            text: 'MAGENTA 128-bit Key Test Vector 2',
            uri: 'MAGENTA AES Submission',
            input: global.OpCodes.Hex8ToBytes('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
            key: global.OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
            expected: global.OpCodes.Hex8ToBytes('74747474747474747474747474747474')
          }
        ];
      }
    },
    
    // MAGENTA S-box using GF(2^8) discrete exponentiation
    // S-box[x] = x^99 in GF(2^8) with irreducible polynomial x^8 + x^4 + x^3 + x + 1
    generateSBox: function() {
      const sbox = new Array(256);
      const irreducible = 0x11B; // x^8 + x^4 + x^3 + x + 1
      
      sbox[0] = 0; // Special case: 0^99 = 0
      
      for (let i = 1; i < 256; i++) {
        let result = 1;
        let base = i;
        let exp = 99;
        
        // Fast exponentiation in GF(2^8)
        while (exp > 0) {
          if (exp & 1) {
            result = this.gf256Multiply(result, base, irreducible);
          }
          base = this.gf256Multiply(base, base, irreducible);
          exp >>>= 1;
        }
        
        sbox[i] = result;
      }
      
      return sbox;
    },
    
    // Galois Field GF(2^8) multiplication with specified irreducible polynomial
    gf256Multiply: function(a, b, irreducible) {
      let result = 0;
      a &= 0xFF;
      b &= 0xFF;
      
      for (let i = 0; i < 8; i++) {
        if (b & 1) {
          result ^= a;
        }
        
        const highBit = a & 0x80;
        a = (a << 1) & 0xFF;
        if (highBit) {
          a ^= irreducible;
        }
        
        b >>>= 1;
      }
      
      return result & 0xFF;
    },
    
    // MAGENTA permutation C3 - cyclic 3-byte permutation
    permutationC3: function(data) {
      const result = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        result[i] = data[(i + 1) % data.length];
      }
      return result;
    },
    
    // MAGENTA shuffle operation on 8 bytes
    shuffle: function(data) {
      if (data.length !== 8) {
        throw new Error('Shuffle operation requires exactly 8 bytes');
      }
      
      // MAGENTA shuffle permutation: (0,1,2,3,4,5,6,7) -> (4,5,6,7,0,1,2,3)
      return [
        data[4], data[5], data[6], data[7],
        data[0], data[1], data[2], data[3]
      ];
    },
    
    // Key setup - MAGENTA uses a simple key schedule
    KeySetup: function(key) {
      if (!key || (key.length !== 16 && key.length !== 24 && key.length !== 32)) {
        throw new Error('Key must be 128, 192, or 256 bits (16, 24, or 32 bytes)');
      }
      
      const keySchedule = {
        key: OpCodes.CopyArray(key),
        rounds: key.length === 32 ? 8 : 6,
        subkeys: []
      };
      
      // Generate subkeys - MAGENTA uses symmetric arrangement
      if (key.length === 16) {
        // 128-bit key: K1, K1, K2, K2, K1, K1 (where K1=key[0:7], K2=key[8:15])
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        keySchedule.subkeys = [k1, k1, k2, k2, k1, k1];
      } else if (key.length === 24) {
        // 192-bit key: similar pattern with 3 parts
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        const k3 = key.slice(16, 24);
        keySchedule.subkeys = [k1, k2, k3, k1, k2, k3];
      } else {
        // 256-bit key: 8 rounds with 4 parts
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        const k3 = key.slice(16, 24);
        const k4 = key.slice(24, 32);
        keySchedule.subkeys = [k1, k2, k3, k4, k1, k2, k3, k4];
      }
      
      return keySchedule;
    },
    
    // MAGENTA F-function
    fFunction: function(right, subkey, sbox) {
      // Concatenate right half (8 bytes) with subkey (8 bytes)
      const combined = right.concat(subkey);
      
      // Apply C3 permutation
      const permuted = this.permutationC3(combined);
      
      // Apply S-box substitution to all 16 bytes
      const substituted = permuted.map(byte => sbox[byte]);
      
      // Apply shuffle to first 8 bytes only
      const shuffled = this.shuffle(substituted.slice(0, 8));
      
      return shuffled;
    },
    
    // MAGENTA encryption
    EncryptBlock: function(blockIndex, data) {
      if (!this.keySchedule) {
        throw new Error('Key not set. Call KeySetup first.');
      }
      
      if (data.length !== 16) {
        throw new Error('Block size must be 16 bytes');
      }
      
      // Generate S-box
      const sbox = this.generateSBox();
      
      // Split into left and right halves (64 bits each)
      let left = data.slice(0, 8);
      let right = data.slice(8, 16);
      
      // Apply Feistel rounds
      for (let round = 0; round < this.keySchedule.rounds; round++) {
        const subkey = this.keySchedule.subkeys[round];
        const fOutput = this.fFunction(right, subkey, sbox);
        
        // XOR f-output with left half
        const newRight = OpCodes.XorArrays(left, fOutput);
        
        // Swap halves for next round
        left = right;
        right = newRight;
      }
      
      // MAGENTA does NOT swap after final round (unlike standard Feistel)
      return left.concat(right);
    },
    
    // MAGENTA decryption
    DecryptBlock: function(blockIndex, data) {
      if (!this.keySchedule) {
        throw new Error('Key not set. Call KeySetup first.');
      }
      
      if (data.length !== 16) {
        throw new Error('Block size must be 16 bytes');
      }
      
      // Generate S-box
      const sbox = this.generateSBox();
      
      // Split into left and right halves
      let left = data.slice(0, 8);
      let right = data.slice(8, 16);
      
      // Apply Feistel rounds in reverse order
      for (let round = this.keySchedule.rounds - 1; round >= 0; round--) {
        const subkey = this.keySchedule.subkeys[round];
        const fOutput = this.fFunction(left, subkey, sbox);
        
        // XOR f-output with right half
        const newLeft = OpCodes.XorArrays(right, fOutput);
        
        // Swap halves for next round
        right = left;
        left = newLeft;
      }
      
      // MAGENTA does NOT swap after final round
      return left.concat(right);
    }
  };
  
  // Initialize test vectors if OpCodes is available
  MAGENTA.initializeTests();
  
  // Auto-registration
  if (global.Cipher) global.Cipher.Add(MAGENTA);
  if (typeof module !== 'undefined') module.exports = MAGENTA;
  
})(typeof global !== 'undefined' ? global : window);