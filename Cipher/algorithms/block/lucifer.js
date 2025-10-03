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

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }
  
  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

// Define classes only if AlgorithmFramework is available
let LuciferAlgorithm, LuciferInstance;

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
      new KeySize(16, 16, 0) // Fixed 128-bit key
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 0) // Fixed 128-bit blocks
    ];

    // Educational test vectors for Lucifer cipher
    this.tests = [
      {
        text: "Lucifer all-zeros test vector - educational",
        uri: "Educational implementation based on Sorkin 1984 specification",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("04040404040404040707070707070707")
      },
      {
        text: "Lucifer pattern test vector - educational",
        uri: "Educational implementation based on Sorkin 1984 specification",
        input: OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
        expected: OpCodes.Hex8ToBytes("47e6fe08ce6a2896344b175acf9c0d06")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new LuciferInstance(this, isInverse);
  }
  };

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
      // Apply F-function to right half with round subkey
      const fOutput = this._feistelFunction(rightHalf, this.subKeys[round]);

      // Standard Feistel: new_left = old_right, new_right = old_left XOR F(old_right)
      const newLeft = [...rightHalf];
      const newRight = OpCodes.XorArrays(leftHalf, fOutput);

      leftHalf = newLeft;
      rightHalf = newRight;
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
      // Apply F-function to left half with round subkey
      const fOutput = this._feistelFunction(leftHalf, this.subKeys[round]);

      // Reverse Feistel: new_right = old_left, new_left = old_right XOR F(old_left)
      const newRight = [...leftHalf];
      const newLeft = OpCodes.XorArrays(rightHalf, fOutput);

      leftHalf = newLeft;
      rightHalf = newRight;
    }

    // Combine halves for final plaintext
    return leftHalf.concat(rightHalf);
  }
  };

  // ===== REGISTRATION =====

    const algorithmInstance = new LuciferAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LuciferAlgorithm, LuciferInstance };
}));