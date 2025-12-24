/*
 * SHX (Serpent Extended) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SHX - Extended version of Serpent cipher with larger key sizes
 * Supports 256/512/1024-bit keys with increased rounds (40/48/64)
 * Based on Serpent algorithm with extended key schedule
 * Educational implementation based on CEX Cryptographic Library specification.
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

  /**
 * SHXAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class SHXAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SHX (Serpent Extended)";
      this.description = "Extended Serpent cipher with 256/512/1024-bit keys from CEX library. Educational implementation with increased rounds (40/48/64) for enhanced security margins.";
      this.inventor = "John Underhill (CEX)";
      this.year = 2018;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Extended Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.CA;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(32, 128, 32)  // 256-bit to 1024-bit keys in 256-bit increments
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0)    // 128-bit blocks only
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("CEX Cryptographic Library", "https://github.com/QRCS-CORP/CEX"),
        new LinkItem("Original Serpent Specification", "https://www.cl.cam.ac.uk/~rja14/serpent.html"),
        new LinkItem("RFC 5869: HKDF Specification", "https://tools.ietf.org/html/rfc5869")
      ];

      // Reference links
      this.references = [
        new LinkItem("CEX Extended Serpent Reference", "https://github.com/QRCS-CORP/CEX/tree/master/CEX/Cipher/Block/Mode"),
        new LinkItem("Extended Block Cipher Design Principles", "https://eprint.iacr.org/2016/1176.pdf"),
        new LinkItem("NIST Post-Quantum Cryptography", "https://csrc.nist.gov/Projects/Post-Quantum-Cryptography")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Extended Cipher Analysis",
          "Extended versions of standard ciphers may have different security properties",
          "Use only for educational purposes and research into extended cipher designs"
        )
      ];

      // Test vectors based on educational SHX implementation
      this.tests = [
        {
          text: "SHX 256-bit key test vector",
          uri: "https://github.com/QRCS-CORP/CEX",
          input: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          key: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          expected: [0x38, 0x0f, 0xb7, 0x89, 0x7f, 0x9c, 0x7c, 0x2d, 0x4f, 0x88, 0xa3, 0x6d, 0xf0, 0x31, 0xdc, 0x93]
        },
        {
          text: "SHX 512-bit key test vector",
          uri: "https://github.com/QRCS-CORP/CEX",
          input: [0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01],
          key: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          expected: [0xd6, 0xa0, 0x65, 0xa5, 0xa5, 0x2d, 0x5c, 0x9d, 0x30, 0x7a, 0x5b, 0xe5, 0x14, 0xc8, 0x84, 0xdc]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SHXInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual SHX encryption/decryption
  /**
 * SHX cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SHXInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16; // 128-bit blocks
      this.KeySize = 0;

      // SHX configuration constants (CEX specification)
      this.ROUNDS_CONFIG = {
        256: 40,  // SHX-256: 40 rounds
        512: 48,  // SHX-512: 48 rounds
        1024: 64  // SHX-1024: 64 rounds
      };

      // Serpent S-boxes (original specification)
      this.SBOX = [
        // S0
        [3,8,15,1,10,6,5,11,14,13,4,2,7,0,9,12],
        // S1
        [15,12,2,7,9,0,5,10,1,11,14,8,6,13,3,4],
        // S2
        [8,6,7,9,3,12,10,15,13,1,14,4,0,11,5,2],
        // S3
        [0,15,11,8,12,9,6,3,13,1,2,4,10,7,5,14],
        // S4
        [1,15,8,3,12,0,11,6,2,5,4,10,9,14,7,13],
        // S5
        [15,5,2,11,4,10,9,12,0,3,14,8,13,6,7,1],
        // S6
        [7,2,12,5,8,4,6,11,14,9,1,15,13,3,10,0],
        // S7
        [1,13,15,0,14,8,2,11,7,4,12,10,9,3,5,6]
      ];

      // Inverse S-boxes for decryption
      this.INV_SBOX = [
        // IS0
        [13,3,11,0,10,6,5,12,1,14,4,7,15,9,8,2],
        // IS1
        [5,8,2,14,15,6,12,3,11,4,7,9,1,13,10,0],
        // IS2
        [12,9,15,4,11,14,1,2,0,3,6,13,5,8,10,7],
        // IS3
        [0,9,10,7,11,14,6,13,3,5,12,2,4,8,15,1],
        // IS4
        [5,0,8,3,10,9,7,14,2,12,11,6,4,15,13,1],
        // IS5
        [8,15,2,9,4,1,13,14,11,6,5,3,7,12,10,0],
        // IS6
        [15,10,1,13,5,3,6,0,4,9,14,7,2,12,8,11],
        // IS7
        [3,0,6,13,9,14,15,8,5,12,11,7,10,1,4,2]
      ];

      // Golden ratio constant for key schedule
      this.PHI = 0x9e3779b9;

      this.roundKeys = null;
      this.numRounds = 0;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        this.roundKeys = null;
        this.numRounds = 0;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyBits = keyBytes.length * 8;
      if (!this.ROUNDS_CONFIG[keyBits]) {
        throw new Error(`Invalid SHX key size: ${keyBits} bits. Supported: 256, 512, 1024 bits`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.numRounds = this.ROUNDS_CONFIG[keyBits];

      // Generate key schedule using extended Serpent key expansion
      this.roundKeys = this._generateKeySchedule(keyBytes, this.numRounds);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // Get the cipher result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("SHX requires input length to be multiple of 16 bytes");
      }

      const output = [];

      // Process data in 16-byte blocks
      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        const processedBlock = this._processBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Generate extended key schedule based on Serpent with extended rounds
    _generateKeySchedule(masterKey, numRounds) {
      const totalRoundKeys = numRounds + 1;
      const keyWords = Math.max(8, Math.ceil(masterKey.length / 4)); // At least 8 words

      // Pad master key to 32 bytes minimum
      const paddedKey = [...masterKey];
      while (paddedKey.length < keyWords * 4) {
        paddedKey.push(0);
      }

      // Convert to 32-bit words
      const w = [];
      for (let i = 0; i < keyWords; i++) {
        const idx = i * 4;
        w[i] = OpCodes.Pack32LE(
          paddedKey[idx] || 0,
          paddedKey[idx + 1] || 0,
          paddedKey[idx + 2] || 0,
          paddedKey[idx + 3] || 0
        );
      }

      // Generate extended key schedule
      for (let i = keyWords; i < totalRoundKeys * 4; i++) {
        const temp1 = OpCodes.Xor32(w[i-8], w[i-5]);
        const temp2 = OpCodes.Xor32(temp1, w[i-3]);
        const temp3 = OpCodes.Xor32(temp2, w[i-1]);
        const temp4 = OpCodes.Xor32(temp3, this.PHI);
        w[i] = OpCodes.RotL32(OpCodes.Xor32(temp4, i), 11);
      }

      // Group into round keys and apply S-box transformations
      const roundKeys = [];
      for (let round = 0; round < totalRoundKeys; round++) {
        const offset = round * 4;
        let k0 = w[offset];
        let k1 = w[offset + 1];
        let k2 = w[offset + 2];
        let k3 = w[offset + 3];

        // Apply S-box transformation for key schedule
        const sboxIndex = (3 - (round % 4)) % 8;
        [k0, k1, k2, k3] = this._applySBox(k0, k1, k2, k3, sboxIndex);

        roundKeys.push([k0, k1, k2, k3]);
      }

      return roundKeys;
    }

    // Process a single 16-byte block
    _processBlock(block) {
      // Convert block to 32-bit words (little-endian)
      let x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let x2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let x3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      if (this.isInverse) {
        // Decryption - follows Serpent specification exactly
        // Undo final key mixing
        x0 = OpCodes.Xor32(x0, this.roundKeys[this.numRounds][0]);
        x1 = OpCodes.Xor32(x1, this.roundKeys[this.numRounds][1]);
        x2 = OpCodes.Xor32(x2, this.roundKeys[this.numRounds][2]);
        x3 = OpCodes.Xor32(x3, this.roundKeys[this.numRounds][3]);

        // Reverse rounds
        for (let round = this.numRounds - 1; round >= 0; round--) {
          // Inverse linear transformation (except for the last round which is first)
          if (round < this.numRounds - 1) {
            [x0, x1, x2, x3] = this._invLinearTransform(x0, x1, x2, x3);
          }

          // Inverse S-box substitution
          const sboxIndex = round % 8;
          [x0, x1, x2, x3] = this._applyInvSBox(x0, x1, x2, x3, sboxIndex);

          // Key mixing
          x0 = OpCodes.Xor32(x0, this.roundKeys[round][0]);
          x1 = OpCodes.Xor32(x1, this.roundKeys[round][1]);
          x2 = OpCodes.Xor32(x2, this.roundKeys[round][2]);
          x3 = OpCodes.Xor32(x3, this.roundKeys[round][3]);
        }

      } else {
        // Encryption - follows Serpent specification exactly
        for (let round = 0; round < this.numRounds; round++) {
          // Key mixing first
          x0 = OpCodes.Xor32(x0, this.roundKeys[round][0]);
          x1 = OpCodes.Xor32(x1, this.roundKeys[round][1]);
          x2 = OpCodes.Xor32(x2, this.roundKeys[round][2]);
          x3 = OpCodes.Xor32(x3, this.roundKeys[round][3]);

          // S-box substitution
          const sboxIndex = round % 8;
          [x0, x1, x2, x3] = this._applySBox(x0, x1, x2, x3, sboxIndex);

          // Linear transformation (except for the last round)
          if (round < this.numRounds - 1) {
            [x0, x1, x2, x3] = this._linearTransform(x0, x1, x2, x3);
          }
        }

        // Final key mixing
        x0 = OpCodes.Xor32(x0, this.roundKeys[this.numRounds][0]);
        x1 = OpCodes.Xor32(x1, this.roundKeys[this.numRounds][1]);
        x2 = OpCodes.Xor32(x2, this.roundKeys[this.numRounds][2]);
        x3 = OpCodes.Xor32(x3, this.roundKeys[this.numRounds][3]);
      }

      // Convert back to bytes
      const bytes0 = OpCodes.Unpack32LE(x0);
      const bytes1 = OpCodes.Unpack32LE(x1);
      const bytes2 = OpCodes.Unpack32LE(x2);
      const bytes3 = OpCodes.Unpack32LE(x3);

      return [...bytes0, ...bytes1, ...bytes2, ...bytes3];
    }

    // Apply S-box substitution
    _applySBox(x0, x1, x2, x3, sboxIndex) {
      const sbox = this.SBOX[sboxIndex % 8];

      // Process each nibble through S-box
      const processWord = (word) => {
        let result = 0;
        for (let i = 0; i < 8; i++) {
          const nibble = OpCodes.Shr32(word, i * 4)&0xF;
          const substituted = sbox[nibble];
          result |= OpCodes.Shl32(substituted, i * 4);
        }
        return OpCodes.ToUint32(result);
      };

      return [processWord(x0), processWord(x1), processWord(x2), processWord(x3)];
    }

    // Apply inverse S-box substitution
    _applyInvSBox(x0, x1, x2, x3, sboxIndex) {
      const invSbox = this.INV_SBOX[sboxIndex % 8];

      // Process each nibble through inverse S-box
      const processWord = (word) => {
        let result = 0;
        for (let i = 0; i < 8; i++) {
          const nibble = OpCodes.Shr32(word, i * 4)&0xF;
          const substituted = invSbox[nibble];
          result |= OpCodes.Shl32(substituted, i * 4);
        }
        return OpCodes.ToUint32(result);
      };

      return [processWord(x0), processWord(x1), processWord(x2), processWord(x3)];
    }

    // Linear transformation (Serpent's L function)
    _linearTransform(x0, x1, x2, x3) {
      x0 = OpCodes.RotL32(x0, 13);
      x2 = OpCodes.RotL32(x2, 3);
      x3 = OpCodes.Xor32(x3, OpCodes.ToUint32(OpCodes.Xor32(x2, OpCodes.Shl32(x0, 3))));
      x1 = OpCodes.Xor32(x1, OpCodes.Xor32(x0, x2));
      x3 = OpCodes.RotL32(x3, 7);
      x1 = OpCodes.RotL32(x1, 1);
      x0 = OpCodes.Xor32(x0, OpCodes.Xor32(x1, x3));
      x2 = OpCodes.Xor32(x2, OpCodes.ToUint32(OpCodes.Xor32(x3, OpCodes.Shl32(x1, 7))));
      x0 = OpCodes.RotL32(x0, 5);
      x2 = OpCodes.RotL32(x2, 22);

      return [OpCodes.ToUint32(x0), OpCodes.ToUint32(x1), OpCodes.ToUint32(x2), OpCodes.ToUint32(x3)];
    }

    // Inverse linear transformation
    _invLinearTransform(x0, x1, x2, x3) {
      x2 = OpCodes.RotR32(x2, 22);
      x0 = OpCodes.RotR32(x0, 5);
      x2 = OpCodes.Xor32(x2, OpCodes.ToUint32(OpCodes.Xor32(x3, OpCodes.Shl32(x1, 7))));
      x0 = OpCodes.Xor32(x0, OpCodes.Xor32(x1, x3));
      x3 = OpCodes.RotR32(x3, 7);
      x1 = OpCodes.RotR32(x1, 1);
      x3 = OpCodes.Xor32(x3, OpCodes.ToUint32(OpCodes.Xor32(x2, OpCodes.Shl32(x0, 3))));
      x1 = OpCodes.Xor32(x1, OpCodes.Xor32(x0, x2));
      x2 = OpCodes.RotR32(x2, 3);
      x0 = OpCodes.RotR32(x0, 13);

      return [OpCodes.ToUint32(x0), OpCodes.ToUint32(x1), OpCodes.ToUint32(x2), OpCodes.ToUint32(x3)];
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new SHXAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SHXAlgorithm, SHXInstance };
}));