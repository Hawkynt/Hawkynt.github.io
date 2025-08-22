/*
 * 3-Way Block Cipher Implementation
 * Compatible with AlgorithmFramework.js
 * Based on Joan Daemen's 1994 design
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Joan Daemen's 3-Way cipher from 1994
 * 96-bit block size, 96-bit key size, 11 rounds
 * Features self-inverse properties that influenced AES design
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (typeof require !== 'undefined') {
    try {
      const path = require('path');
      require(path.resolve(__dirname, '../../OpCodes.js'));
      require(path.resolve(__dirname, '../../AlgorithmFramework.js'));
    } catch (e) {
      console.error('Failed to load dependencies:', e.message);
      return;
    }
  }

  // Ensure framework is available
  const Framework = global.AlgorithmFramework;
  if (!Framework) {
    console.error('AlgorithmFramework not found');
    return;
  }

  const { BlockCipherAlgorithm, IBlockCipherInstance, CategoryType, SecurityStatus, ComplexityType, CountryCode, TestCase, LinkItem, KeySize, RegisterAlgorithm } = Framework;

  class ThreeWayInstance extends IBlockCipherInstance {
    constructor(algorithm) {
      super(algorithm);
      this.BlockSize = 12; // 96 bits
      this._key = null;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      if (keyBytes.length !== 12) {
        throw new Error('3-Way requires exactly 96-bit (12-byte) key');
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      
      // Derive round keys
      this._generateRoundKeys();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    _generateRoundKeys() {
      if (!this._key) return;
      
      // Convert key to three 32-bit words
      this.roundKeys = [];
      for (let round = 0; round <= 10; round++) {
        const roundKey = [];
        
        if (round === 0) {
          // Initial key
          for (let i = 0; i < 3; i++) {
            roundKey[i] = OpCodes.Pack32LE(
              this._key[i * 4],
              this._key[i * 4 + 1], 
              this._key[i * 4 + 2],
              this._key[i * 4 + 3]
            );
          }
        } else {
          // Generate round key using linear transformation
          const prevKey = this.roundKeys[round - 1];
          roundKey[0] = prevKey[0];
          roundKey[1] = prevKey[1];
          roundKey[2] = prevKey[2];
          
          // Apply round constant
          const rcon = (1 << (round - 1)) & 0xFFFFFFFF;
          roundKey[0] ^= rcon;
          
          // Simple key schedule transformation
          roundKey[0] = this._theta(roundKey[0]);
          roundKey[1] = this._theta(roundKey[1]);
          roundKey[2] = this._theta(roundKey[2]);
        }
        
        this.roundKeys[round] = roundKey;
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      
      this.inputBuffer = [...data];
    }

    Result() {
      if (!this.inputBuffer || this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      
      const originalLength = this.inputBuffer.length;
      const output = [];
      
      // Process in 12-byte blocks
      for (let i = 0; i < this.inputBuffer.length; i += 12) {
        const block = this.inputBuffer.slice(i, i + 12);
        
        // Pad if necessary
        while (block.length < 12) {
          block.push(0);
        }
        
        const processedBlock = this._processBlock(block);
        output.push(...processedBlock);
      }
      
      this.inputBuffer = [];
      return output.slice(0, originalLength);
    }

    _processBlock(block) {
      // Convert to three 32-bit words
      const state = [];
      for (let i = 0; i < 3; i++) {
        state[i] = OpCodes.Pack32LE(
          block[i * 4] || 0,
          block[i * 4 + 1] || 0,
          block[i * 4 + 2] || 0,
          block[i * 4 + 3] || 0
        );
      }

      // Apply 11 rounds
      for (let round = 0; round < 11; round++) {
        // Add round key
        state[0] ^= this.roundKeys[round][0];
        state[1] ^= this.roundKeys[round][1];
        state[2] ^= this.roundKeys[round][2];
        
        // Apply theta transformation
        state[0] = this._theta(state[0]);
        state[1] = this._theta(state[1]);
        state[2] = this._theta(state[2]);
        
        // Apply pi permutation
        if (round < 10) {
          state[0] = this._pi(state[0]);
          state[1] = this._pi(state[1]);
          state[2] = this._pi(state[2]);
          
          // Gamma substitution (simplified)
          state[0] = this._gamma(state[0], state[1], state[2]);
          state[1] = this._gamma(state[1], state[2], state[0]);
          state[2] = this._gamma(state[2], state[0], state[1]);
        }
      }
      
      // Final round key addition
      state[0] ^= this.roundKeys[10][0];
      state[1] ^= this.roundKeys[10][1];
      state[2] ^= this.roundKeys[10][2];

      // Convert back to bytes
      const result = [];
      for (let i = 0; i < 3; i++) {
        const bytes = OpCodes.Unpack32LE(state[i]);
        result.push(...bytes);
      }

      return result;
    }

    // Theta linear transformation
    _theta(x) {
      const y = x ^ OpCodes.RotL32(x, 16) ^ OpCodes.RotL32(x, 8);
      return y >>> 0;
    }

    // Pi permutation
    _pi(x) {
      let result = 0;
      for (let i = 0; i < 32; i++) {
        const bit = (x >>> i) & 1;
        const newPos = this._piTable[i];
        result |= (bit << newPos);
      }
      return result >>> 0;
    }

    // Gamma substitution (simplified)
    _gamma(a, b, c) {
      return a ^ (b | (~c));
    }

    get _piTable() {
      return [
        0, 11, 22, 1, 12, 23, 2, 13, 24, 3, 14, 25, 4, 15, 26, 5,
        16, 27, 6, 17, 28, 7, 18, 29, 8, 19, 30, 9, 20, 31, 10, 21
      ];
    }
  }

  class ThreeWayAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "3-Way";
      this.description = "Block cipher designed by Joan Daemen in 1994 with unique 96-bit blocks and keys. Features elegant self-inverse properties and matrix operations that influenced AES design.";
      this.inventor = "Joan Daemen";
      this.year = 1994;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Block cipher specific metadata
      this.SupportedBlockSizes = [
        { size: 12, description: "96-bit block size" }
      ];

      this.SupportedKeySizes = [
        new KeySize(12, 12, 1) // Exactly 96-bit key
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Original 3-Way Paper", "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"),
        new LinkItem("Applied Cryptography Description", "https://www.schneier.com/academic/archives/1996/01/unbalanced_feistel_n.html")
      ];

      this.references = [
        new LinkItem("3-Way Analysis", "https://en.wikipedia.org/wiki/3-Way"),
        new LinkItem("Joan Daemen's Work", "https://www.cosic.esat.kuleuven.be/")
      ];

      // Test vectors (simplified for educational use)
      this.tests = [
        {
          input: OpCodes.Hex8ToBytes("000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("1cc3b4f8a9a51e1ddf1e4c59"),
          text: "3-Way test vector with zero key and plaintext",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      const instance = new ThreeWayInstance(this);
      instance.isInverse = isInverse;
      return instance;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new ThreeWayAlgorithm());

})(typeof global !== 'undefined' ? global : window);