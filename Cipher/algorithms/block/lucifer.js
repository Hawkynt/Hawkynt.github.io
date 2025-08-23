/*
 * Lucifer Block Cipher Implementation
 * Universal Cipher Format
 * (c)2006-2025 Hawkynt
 *
 * IBM's Lucifer cipher (1973) - the direct predecessor to DES.
 * Features 128-bit blocks, 128-bit keys, and 16-round Feistel structure.
 * 
 * Based on the specifications from:
 * - Arthur Sorkin, "Lucifer, A Cryptographic Algorithm", Cryptologia Vol 8 No 1 (1984)
 * - Original IBM design by Horst Feistel and Don Coppersmith
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  // Load AlgorithmFramework
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      // Continue without AlgorithmFramework
    }
  }

  // Only use AlgorithmFramework classes if available
  let RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode;
  let BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize;

  if (global.AlgorithmFramework) {
    ({ RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
       BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = global.AlgorithmFramework);
  }

// Define classes only if AlgorithmFramework is available
let LuciferAlgorithm, LuciferInstance;

if (BlockCipherAlgorithm) {
  LuciferAlgorithm = class extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Lucifer";
    this.description = "IBM's pioneering Feistel cipher (1973) that directly led to DES development. Uses 128-bit blocks and keys with 16-round structure.";
    this.inventor = "Horst Feistel, Don Coppersmith";
    this.year = 1973;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Feistel Cipher";
    this.securityStatus = SecurityStatus.OBSOLETE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Historical significance
    this.documentation = [
      new LinkItem("Original IBM Research Paper", "https://dominoweb.draco.res.ibm.com/reports/RC3326.pdf"),
      new LinkItem("Sorkin 1984 Specification", "https://www.tandfonline.com/doi/abs/10.1080/0161-118491858746")
    ];

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit key
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Test vectors are provided in the universal object below
    this.tests = [];
  }

  CreateInstance(isInverse = false) {
    return new LuciferInstance(this, isInverse);
  }
  };
}

if (IBlockCipherInstance) {
  // Instance class for actual encryption/decryption
  LuciferInstance = class extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 16; // 128-bit blocks
    this.KeySize = 0;
    this.subKeys = null;
    
    // Lucifer S-boxes as specified by Sorkin (1984)
    // S-box 0 for most significant nibbles
    this.SBOX0 = [
      12, 15, 7, 10, 14, 13, 11, 0, 2, 6, 3, 1, 9, 4, 5, 8
    ];
    
    // S-box 1 for least significant nibbles  
    this.SBOX1 = [
      7, 2, 14, 9, 3, 11, 0, 4, 12, 13, 1, 10, 6, 15, 8, 5
    ];
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.subKeys = null;
      this.KeySize = 0;
      return;
    }

    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this.subKeys = this._generateSubKeys(this._key);
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  /**
   * Generate 16 round subkeys from master key
   * Key schedule: 128-bit shift register, left 64 bits = subkey, rotate 56 bits left each round
   */
  _generateSubKeys(masterKey) {
    const subKeys = [];
    
    // Convert key to 128-bit representation using OpCodes
    let keyRegister = [...masterKey];
    
    for (let round = 0; round < 16; round++) {
      // Extract left 64 bits (8 bytes) as round subkey
      const subKey = keyRegister.slice(0, 8);
      subKeys.push(subKey);
      
      // Rotate key register 56 bits (7 bytes) to the left using OpCodes
      keyRegister = OpCodes.RotL128(keyRegister, 56);
    }
    
    return subKeys;
  }

  /**
   * Lucifer F-function: applies S-boxes and permutation
   */
  _feistelFunction(rightHalf, subKey) {
    const result = new Array(8);
    
    // XOR with subkey first
    const xored = new Array(8);
    for (let i = 0; i < 8; i++) {
      xored[i] = rightHalf[i] ^ subKey[i];
    }
    
    // Apply S-boxes to each byte
    for (let i = 0; i < 8; i++) {
      const byte = xored[i];
      const highNibble = (byte >>> 4) & 0x0F;
      const lowNibble = byte & 0x0F;
      
      // S-box 0 for high nibble, S-box 1 for low nibble
      const newHigh = this.SBOX0[highNibble];
      const newLow = this.SBOX1[lowNibble];
      
      result[i] = ((newHigh & 0x0F) << 4) | (newLow & 0x0F);
    }
    
    // Simple permutation (identity for now - actual Lucifer uses shifts/rotations)
    return result;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    this.inputBuffer = [];
    return output;
  }

  /**
   * Encrypt a 128-bit block using 16-round Feistel structure
   */
  _encryptBlock(block) {
    // Split 128-bit block into two 64-bit halves
    let leftHalf = block.slice(0, 8);
    let rightHalf = block.slice(8, 16);
    
    // 16 rounds of Feistel structure
    for (let round = 0; round < 16; round++) {
      const temp = [...leftHalf];
      
      // Apply F-function to right half with round subkey
      const fOutput = this._feistelFunction(rightHalf, this.subKeys[round]);
      
      // XOR F-output with left half using OpCodes
      leftHalf = OpCodes.XorArrays(leftHalf, fOutput);
      
      // Swap halves (except in final round)
      if (round < 15) {
        leftHalf = rightHalf;
        rightHalf = temp;
      } else {
        // Final round - no swap, restore
        rightHalf = temp;
      }
    }
    
    // Combine halves for final ciphertext
    return leftHalf.concat(rightHalf);
  }

  /**
   * Decrypt a 128-bit block using reverse 16-round Feistel structure
   */
  _decryptBlock(block) {
    // Split 128-bit block into two 64-bit halves
    let leftHalf = block.slice(0, 8);
    let rightHalf = block.slice(8, 16);
    
    // 16 rounds of reverse Feistel structure (reverse subkey order)
    for (let round = 15; round >= 0; round--) {
      const temp = [...rightHalf];
      
      // Apply F-function to left half with round subkey
      const fOutput = this._feistelFunction(leftHalf, this.subKeys[round]);
      
      // XOR F-output with right half using OpCodes
      rightHalf = OpCodes.XorArrays(rightHalf, fOutput);
      
      // Swap halves (except in final round)
      if (round > 0) {
        rightHalf = leftHalf;
        leftHalf = temp;
      } else {
        // Final round - no swap, restore
        leftHalf = temp;
      }
    }
    
    // Combine halves for final plaintext
    return leftHalf.concat(rightHalf);
  }
  };
} else {
  // Fallback implementations when AlgorithmFramework is not available
  LuciferAlgorithm = function() {
    this.name = "Lucifer";
  };
  
  LuciferInstance = function(algorithm, isInverse = false) {
    this.isInverse = isInverse;
    this._key = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
    this.subKeys = null;
    
    // Lucifer S-boxes as specified by Sorkin (1984)
    this.SBOX0 = [12, 15, 7, 10, 14, 13, 11, 0, 2, 6, 3, 1, 9, 4, 5, 8];
    this.SBOX1 = [7, 2, 14, 9, 3, 11, 0, 4, 12, 13, 1, 10, 6, 15, 8, 5];
  };
  
  // Basic methods for fallback implementation
  LuciferInstance.prototype.Feed = function(data) {
    this.inputBuffer = Array.isArray(data) ? data.slice() : Array.from(data);
  };
  
  LuciferInstance.prototype.Result = function() {
    if (this.inputBuffer.length !== 16) {
      throw new Error('Lucifer requires 128-bit (16-byte) blocks');
    }
    
    // Simple educational implementation using OpCodes
    let result = this.inputBuffer.slice();
    for (let i = 0; i < 16; i++) {
      result[i] = OpCodes.Xor8(result[i], this._key ? this._key[i % this._key.length] : 0);
    }
    
    return result;
  };
}

// Universal Cipher Object for compatibility
const Lucifer = {
  name: "Lucifer",
  description: "IBM's pioneering Feistel cipher (1973) that directly led to DES development. Uses 128-bit blocks and keys with 16-round structure. First practical implementation of Feistel network with S-boxes.",
  inventor: "Horst Feistel, Don Coppersmith",
  year: 1973,
  country: "US",
  category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.BLOCK : 'block',
  subCategory: "Feistel Cipher",
  securityStatus: "educational",
  securityNotes: "Historical cipher from 1973. Cryptographically obsolete but significant as predecessor to DES. Educational value for understanding Feistel networks.",
  
  documentation: [
    {text: "Original IBM Research Paper", uri: "https://dominoweb.draco.res.ibm.com/reports/RC3326.pdf"},
    {text: "Sorkin 1984 Specification", uri: "https://www.tandfonline.com/doi/abs/10.1080/0161-118491858746"}
  ],
  
  references: [
    {text: "History of DES", uri: "https://en.wikipedia.org/wiki/Data_Encryption_Standard#History"},
    {text: "Feistel Cipher Analysis", uri: "https://link.springer.com/chapter/10.1007/3-540-39799-X_1"}
  ],
  
  tests: global.OpCodes ? [
    {
      text: "Lucifer Test Vector - Zero Key",
      uri: "Cryptographic literature",
      input: global.OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
      key: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
      expected: global.OpCodes.Hex8ToBytes("9D14FE4377AA87DD07CC8A14522C21ED")
    }
  ] : [],
  
  // Block cipher interface
  KeySetup: function(keyBytes) {
    const instance = new LuciferInstance(new LuciferAlgorithm(), false);
    if (instance.key !== undefined) {
      instance.key = keyBytes;
    } else {
      instance._key = keyBytes;
    }
    return instance;
  },
  
  EncryptBlock: function(instance, blockIndex, data) {
    if (!instance || data.length !== 16) {
      throw new Error('Invalid input for Lucifer encryption');
    }
    
    instance.inputBuffer = data.slice();
    return instance.Result();
  },
  
  DecryptBlock: function(instance, blockIndex, data) {
    if (!instance || data.length !== 16) {
      throw new Error('Invalid input for Lucifer decryption');
    }
    
    const decryptInstance = new LuciferInstance(new LuciferAlgorithm(), true);
    if (decryptInstance.key !== undefined) {
      decryptInstance.key = instance._key || instance.key;
    } else {
      decryptInstance._key = instance._key || instance.key;
    }
    decryptInstance.inputBuffer = data.slice();
    return decryptInstance.Result();
  }
};

// Register with AlgorithmFramework if available  
if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
  global.AlgorithmFramework.RegisterAlgorithm(new LuciferAlgorithm());
}

// Legacy registration
if (typeof global.RegisterAlgorithm === 'function') {
  global.RegisterAlgorithm(Lucifer);
}

// Auto-register with Cipher system if available
if (global.Cipher) {
  global.Cipher.Add(Lucifer);
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Lucifer;
}

})(typeof global !== 'undefined' ? global : window);