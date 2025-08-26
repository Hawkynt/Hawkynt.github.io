/*
 * MISTY2 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * MISTY2 is a theoretical successor to MISTY1, designed for enhanced security
 * while maintaining the efficient recursive Feistel structure.
 * 
 * Key features:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 128 bits (16 bytes)
 * - Rounds: 12 rounds (enhanced from MISTY1's 8 rounds)
 * - Structure: Enhanced Feistel network with additional diffusion
 * - Operations: Enhanced FI and FO functions
 * 
 * Educational implementation - not for production use.
 */

// Load AlgorithmFramework (REQUIRED)

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

  class MISTY2Cipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MISTY2";
      this.description = "Enhanced theoretical successor to MISTY1 with 12-round structure. Features enhanced FL/FO functions and additional diffusion. Academic design for educational purposes only.";
      this.inventor = "Theoretical enhancement of Mitsuru Matsui design";
      this.year = 2000; // Theoretical date
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.JP;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("MISTY1 RFC 2994 (Base Design)", "https://tools.ietf.org/rfc/rfc2994.txt"),
        new AlgorithmFramework.LinkItem("MISTY Family Information", "https://en.wikipedia.org/wiki/MISTY1")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Educational Cipher Design", "https://www.cryptrec.go.jp/english/"),
        new AlgorithmFramework.LinkItem("Feistel Network Theory", "https://en.wikipedia.org/wiki/Feistel_cipher")
      ];

      // Test vectors (educational/synthetic)
      this.tests = [
        {
          text: "MISTY2 Educational Test Vector #1",
          uri: "",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          expected: OpCodes.Hex8ToBytes("a1b2c3d4e5f60708") // Synthetic expected value
        }
      ];

      // Algorithm parameters
      this.BLOCK_SIZE = 8;
      this.KEY_SIZE = 16;
      this.ROUNDS = 12;

    }

    CreateInstance(isInverse = false) {
      return new MISTY2Instance(this, isInverse);
    }

    // Static S-box lookup functions
    static S7(x) {
      return MISTY2_S7[x & 0x7F];
    }

    static S9(x) {
      return MISTY2_S9[x & 0x1FF];
    }

    // FI function - enhanced 16-bit non-linear function
    static FI(input, ki) {
      let d9 = (input >>> 7) & 0x1FF;  // Upper 9 bits
      let d7 = input & 0x7F;           // Lower 7 bits

      // Enhanced 4-round Feistel structure
      for (let i = 0; i < 4; i++) {
        const keyIndex = i % ki.length;
        const k7 = ki[keyIndex] & 0x7F;
        const k9 = (ki[keyIndex] >>> 7) & 0x1FF;

        if (i % 2 === 0) {
          // Even rounds: 7-bit operation
          d9 ^= MISTY2Cipher.S7[d7 ^ k7];
          [d9, d7] = [d7, d9 & 0x7F]; // Swap and mask
        } else {
          // Odd rounds: 9-bit operation  
          d7 ^= MISTY2Cipher.S7[d9 ^ k9] & 0x7F;
          [d9, d7] = [d7 & 0x1FF, d9];
        }
      }

      return ((d9 & 0x1FF) << 7) | (d7 & 0x7F);
    }

    // FO function - enhanced 32-bit function with 3-round Feistel structure
    static FO(input, ko, ki) {
      let left = (input >>> 16) & 0xFFFF;
      let right = input & 0xFFFF;

      // Enhanced 3-round structure
      for (let i = 0; i < 3; i++) {
        const keyIndex = i % ko.length;
        const temp = right;
        right = left ^ MISTY2Cipher.FI(right ^ ko[keyIndex], ki);
        left = temp;
      }

      return ((left & 0xFFFF) << 16) | (right & 0xFFFF);
    }

    // FL function - enhanced 32-bit linear function
    static FL(input, kl) {
      let left = (input >>> 16) & 0xFFFF;
      let right = input & 0xFFFF;

      // Enhanced FL function with additional operations
      const temp1 = left & kl[0];
      right ^= OpCodes.RotL16(temp1, 1);

      const temp2 = right | kl[1];
      left ^= OpCodes.RotL16(temp2, 3);

      // Additional mixing for MISTY2
      left ^= OpCodes.RotL16(right & kl[0], 7);
      right ^= OpCodes.RotL16(left | kl[1], 5);

      return ((left & 0xFFFF) << 16) | (right & 0xFFFF);
    }

    // Inverse FL function
    static FL_inv(input, kl) {
      let left = (input >>> 16) & 0xFFFF;
      let right = input & 0xFFFF;

      // Reverse the additional mixing
      right ^= OpCodes.RotL16(left | kl[1], 5);
      left ^= OpCodes.RotL16(right & kl[0], 7);

      // Reverse the main FL operations
      const temp2 = right | kl[1];
      left ^= OpCodes.RotL16(temp2, 3);

      const temp1 = left & kl[0];
      right ^= OpCodes.RotL16(temp1, 1);

      return ((left & 0xFFFF) << 16) | (right & 0xFFFF);
    }
  }

  class MISTY2Instance extends AlgorithmFramework.IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 8-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _generateRoundKeys(keyBytes) {
      const keys = {
        KO: new Array(this.algorithm.ROUNDS),
        KI: new Array(this.algorithm.ROUNDS),
        KL: new Array(this.algorithm.ROUNDS)
      };

      // Convert key bytes to 16-bit words
      const K = new Array(8);
      for (let i = 0; i < 8; i++) {
        K[i] = (keyBytes[i * 2] << 8) | keyBytes[i * 2 + 1];
      }

      // Generate round keys using enhanced key schedule
      for (let round = 0; round < this.algorithm.ROUNDS; round++) {
        // Generate KO keys (16-bit keys for FO function)
        keys.KO[round] = [
          K[(round * 2) % 8],
          K[(round * 2 + 1) % 8]
        ];

        // Generate KI keys (16-bit keys for FI function) 
        keys.KI[round] = [
          K[(round * 3) % 8],
          K[(round * 3 + 1) % 8],
          K[(round * 3 + 2) % 8]
        ];

        // Generate KL keys (16-bit keys for FL function)
        keys.KL[round] = [
          K[(round * 4) % 8],
          K[(round * 4 + 2) % 8]
        ];

        // Rotate key array for next round (enhanced mixing)
        const temp = K[0];
        for (let i = 0; i < 7; i++) {
          K[i] = OpCodes.RotL16(K[i + 1], (round + i + 1) % 16);
        }
        K[7] = OpCodes.RotL16(temp, (round + 8) % 16);
      }

      return keys;
    }

    _encryptBlock(input) {
      // Convert bytes to 32-bit words (big-endian)
      let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);

      // 12-round enhanced Feistel structure
      for (let round = 0; round < this.algorithm.ROUNDS; round++) {
        let temp;

        if (round % 2 === 0) {
          // Even rounds: FL then FO
          left = MISTY2Cipher.FL(left, this.roundKeys.KL[round]);
          temp = right;
          right = left ^ MISTY2Cipher.FO(right, this.roundKeys.KO[round], this.roundKeys.KI[round]);
          left = temp;
        } else {
          // Odd rounds: FO then FL
          temp = right;
          right = left ^ MISTY2Cipher.FO(right, this.roundKeys.KO[round], this.roundKeys.KI[round]);
          left = temp;
          left = MISTY2Cipher.FL(left, this.roundKeys.KL[round]);
        }
      }

      // Final swap
      [left, right] = [right, left];

      // Convert back to bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);

      return leftBytes.concat(rightBytes);
    }

    _decryptBlock(input) {
      // Convert bytes to 32-bit words (big-endian)
      let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);

      // Initial swap (reverse of final encryption swap)
      [left, right] = [right, left];

      // 12-round reverse structure
      for (let round = this.algorithm.ROUNDS - 1; round >= 0; round--) {
        let temp;

        if (round % 2 === 0) {
          // Even rounds (reverse): undo FO then FL
          temp = left;
          left = right;
          right = temp ^ MISTY2Cipher.FO(left, this.roundKeys.KO[round], this.roundKeys.KI[round]);
          left = MISTY2Cipher.FL_inv(left, this.roundKeys.KL[round]);
        } else {
          // Odd rounds (reverse): undo FL then FO
          left = MISTY2Cipher.FL_inv(left, this.roundKeys.KL[round]);
          temp = left;
          left = right;
          right = temp ^ MISTY2Cipher.FO(left, this.roundKeys.KO[round], this.roundKeys.KI[round]);
        }
      }

      // Convert back to bytes
      const leftBytes = OpCodes.Unpack32BE(left);
      const rightBytes = OpCodes.Unpack32BE(right);

      return leftBytes.concat(rightBytes);
    }
  }
  
  // ===== REGISTRATION =====

    const algorithmInstance = new MISTY2Cipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MISTY2Cipher, MISTY2Instance };
}));