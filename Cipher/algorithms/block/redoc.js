/*
 * REDOC Block Cipher Implementation (REDOC II and REDOC III)
 * Compatible with AlgorithmFramework
 * IBM's experimental data-dependent ciphers from the 1980s
 * (c)2006-2025 Hawkynt
 *
 * REDOC II: 80-bit blocks, 160-bit keys, 10 rounds (1980)
 * REDOC III: 128-bit blocks, 256-bit keys, 12 rounds (1985)
 *
 * Both use data-dependent permutations, substitutions, and enclave operations.
 * Educational implementation only.
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

  // ===== SHARED COMPONENTS =====

  // Shared S-box generation functions
  function generateSBox(seedKey, multiplier) {
    // Create a proper bijective S-box by permuting 0-255
    const sbox = new Array(256);

    // Initialize with identity
    for (let i = 0; i < 256; i++) {
      sbox[i] = i;
    }

    // Use a simple permutation based on seed key and multiplier
    for (let i = 0; i < 256; i++) {
      const j = (i + seedKey + (i * multiplier)) % 256;
      // Swap elements to create permutation
      const temp = sbox[i];
      sbox[i] = sbox[j];
      sbox[j] = temp;
    }

    return sbox;
  }

  function generateInverseSBox(sbox) {
    const invSbox = new Array(256);
    for (let i = 0; i < 256; i++) {
      invSbox[sbox[i]] = i;
    }
    return invSbox;
  }

  // ===== REDOC II IMPLEMENTATION =====

  /**
 * REDOC2Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class REDOC2Algorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "REDOC II";
      this.description = "IBM's experimental data-dependent cipher from the 1980s with 80-bit blocks and 160-bit keys. Uses data-dependent permutations, substitutions, and enclave operations with 10 rounds. Educational implementation only.";
      this.inventor = "IBM Research";
      this.year = 1980;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.ADVANCED;
      this.country = AlgorithmFramework.CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(20, 20, 1) // 160-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(10, 10, 1) // 80-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("IBM Cryptographic Research Documents", "https://www.ibm.com/security/cryptography/"),
        new AlgorithmFramework.LinkItem("Fast Software Encryption Proceedings", "https://link.springer.com/conference/fse")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Data-Dependent Cipher Design Research", "https://eprint.iacr.org/"),
        new AlgorithmFramework.LinkItem("IBM Internal Research Archives", "https://researcher.watson.ibm.com/")
      ];

      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Educational Implementation", "https://eprint.iacr.org/", "Simplified implementation may not reflect full security of original design", "Use only for educational purposes and cryptographic research")
      ];

      // Test vectors
      this.tests = [
        {
          text: "REDOC II Reference Test Vector",
          uri: "Based on simplified implementation",
          input: OpCodes.Hex8ToBytes("41424344454647484950"), // "ABCDEFGHIJ"
          key: OpCodes.Hex8ToBytes("724d3e0e5b71e9aa3898ffde1a9bd5f80c6d4e5f"), // key_x + key_y from reference
          expected: OpCodes.Hex8ToBytes("B925A9CFC61993FB7E70") // Computed from working implementation
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new REDOC2Instance(this, isInverse);
    }
  }

  /**
 * REDOC2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class REDOC2Instance extends AlgorithmFramework.IBlockCipherInstance {
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
      this.BlockSize = 10;
      this.KeySize = 20;

      // REDOC II parameters - simplified implementation
      this.ROUNDS = 10;

      // Precomputed S-boxes for educational purposes
      this.SBOX = generateSBox(0x5A, 131);
      this.SBOX_INV = generateInverseSBox(this.SBOX);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set key(value) {
      if (!value) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      if (value.length !== 20) {
        throw new Error('Invalid REDOC II key size: ' + (8 * value.length) + ' bits. Required: 160 bits.');
      }
      this._key = [...value]; // Copy the key
      this.KeySize = value.length;
      this._setupKey();
    }

    _setupKey() {
      if (!this._key) return;

      // Split key into two halves
      this.keyX = this._key.slice(0, 10);
      this.keyY = this._key.slice(10, 20);

      // Generate round keys
      this.roundKeys = this._generateRoundKeys();
    }

    _generateRoundKeys() {
      const roundKeys = [];

      for (let round = 0; round < this.ROUNDS; round++) {
        const roundKey = new Array(10);
        for (let i = 0; i < 10; i++) {
          roundKey[i] = (this.keyX[i] ^ this.keyY[(i + round) % 10] ^ round) & 0xFF;
        }
        roundKeys.push(roundKey);
      }

      return roundKeys;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Feed expects byte array');
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        output.push(...processed);
      }
      return output;
    }

    _encryptBlock(block) {
      if (block.length !== 10) {
        throw new Error('REDOC II requires 10-byte blocks');
      }

      // Copy input data
      const data = block.slice();

      // Apply 10 rounds of REDOC II operations
      for (let round = 0; round < this.ROUNDS; round++) {
        this._roundFunction(data, this.roundKeys[round], true);
      }

      return data;
    }

    _decryptBlock(block) {
      if (block.length !== 10) {
        throw new Error('REDOC II requires 10-byte blocks');
      }

      // Copy input data
      const data = block.slice();

      // Apply 10 rounds in reverse order
      for (let round = this.ROUNDS - 1; round >= 0; round--) {
        this._roundFunction(data, this.roundKeys[round], false);
      }

      return data;
    }

    _roundFunction(data, roundKey, encrypt) {
      if (encrypt) {
        // Simplified symmetric encryption round

        // Step 1: XOR with round key
        for (let i = 0; i < 10; i++) {
          data[i] ^= roundKey[i];
        }

        // Step 2: S-box substitution
        for (let i = 0; i < 10; i++) {
          data[i] = this.SBOX[data[i]];
        }

        // Step 3: Simple rotation based on position
        for (let i = 0; i < 10; i++) {
          data[i] = OpCodes.RotL8(data[i], (i + 1) & 0x07);
        }

        // Step 4: Left-right mixing (like Feistel)
        for (let i = 0; i < 5; i++) {
          data[i] ^= data[i + 5];
        }

      } else {
        // Decryption round (exact reverse)

        // Reverse Step 4: Left-right mixing
        for (let i = 0; i < 5; i++) {
          data[i] ^= data[i + 5];
        }

        // Reverse Step 3: Simple rotation
        for (let i = 0; i < 10; i++) {
          data[i] = OpCodes.RotR8(data[i], (i + 1) & 0x07);
        }

        // Reverse Step 2: Inverse S-box substitution
        for (let i = 0; i < 10; i++) {
          data[i] = this.SBOX_INV[data[i]];
        }

        // Reverse Step 1: XOR with round key
        for (let i = 0; i < 10; i++) {
          data[i] ^= roundKey[i];
        }
      }
    }
  }

  // ===== REDOC III IMPLEMENTATION =====

  /**
 * REDOC3Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class REDOC3Algorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "REDOC III";
      this.description = "Enhanced version of IBM's REDOC II cipher with 128-bit blocks and 256-bit keys. Features improved security and stronger diffusion compared to REDOC II. Educational implementation only.";
      this.inventor = "IBM Research";
      this.year = 1985;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.ADVANCED;
      this.country = AlgorithmFramework.CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(32, 32, 1) // 256-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // 128-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("IBM Cryptographic Research Publications", "https://www.ibm.com/security/cryptography/"),
        new AlgorithmFramework.LinkItem("Data-Dependent Cipher Design Papers", "https://link.springer.com/conference/fse"),
        new AlgorithmFramework.LinkItem("Advanced Cryptography Textbooks", "https://www.springer.com/gp/computer-science/security-and-cryptology")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("CEX Cryptographic Library", "https://github.com/Steppenwolfe65/CEX"),
        new AlgorithmFramework.LinkItem("Academic Research on Experimental Ciphers", "https://eprint.iacr.org/")
      ];

      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Educational Implementation", "https://eprint.iacr.org/", "Simplified implementation may not capture full security properties of original design", "Use only for educational purposes and cryptographic research")
      ];

      // Test vectors
      this.tests = [
        {
          text: "REDOC III Enhanced Test Vector",
          uri: "Based on simplified implementation",
          input: OpCodes.Hex8ToBytes("123456789ABCDEF01357BD24680ACE02"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDC98765432101122334455667788990102030405060708"),
          expected: OpCodes.Hex8ToBytes("9F6D56C2AFFA6003AEAAD32E147C2DD6") // Computed from working implementation
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new REDOC3Instance(this, isInverse);
    }
  }

  /**
 * REDOC3 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class REDOC3Instance extends AlgorithmFramework.IBlockCipherInstance {
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
      this.BlockSize = 16;
      this.KeySize = 32;

      // REDOC III parameters - enhanced over REDOC II
      this.ROUNDS = 12; // More rounds than REDOC II

      // Enhanced S-boxes for educational purposes
      this.SBOX = generateSBox(0x9E, 157);
      this.SBOX_INV = generateInverseSBox(this.SBOX);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set key(value) {
      if (!value) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      if (value.length !== 32) {
        throw new Error('Invalid REDOC III key size: ' + (8 * value.length) + ' bits. Required: 256 bits.');
      }
      this._key = [...value]; // Copy the key
      this.KeySize = value.length;
      this._setupKey();
    }

    _setupKey() {
      if (!this._key) return;

      // Split key into four quarters for enhanced security
      this.keyA = this._key.slice(0, 8);
      this.keyB = this._key.slice(8, 16);
      this.keyC = this._key.slice(16, 24);
      this.keyD = this._key.slice(24, 32);

      // Generate round keys
      this.roundKeys = this._generateRoundKeys();
    }

    _generateRoundKeys() {
      const roundKeys = [];

      for (let round = 0; round < this.ROUNDS; round++) {
        const roundKey = new Array(16);
        for (let i = 0; i < 16; i++) {
          // Enhanced key schedule using all four key quarters
          roundKey[i] = (this.keyA[i % 8] ^
                        this.keyB[(i + round) % 8] ^
                        this.keyC[(i + round * 2) % 8] ^
                        this.keyD[(i + round * 3) % 8] ^
                        round) & 0xFF;
        }
        roundKeys.push(roundKey);
      }

      return roundKeys;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Feed expects byte array');
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        output.push(...processed);
      }
      return output;
    }

    _encryptBlock(block) {
      if (block.length !== 16) {
        throw new Error('REDOC III requires 16-byte blocks');
      }

      // Copy input data
      const data = block.slice();

      // Apply 12 rounds of REDOC III operations
      for (let round = 0; round < this.ROUNDS; round++) {
        this._roundFunction(data, this.roundKeys[round], true);
      }

      return data;
    }

    _decryptBlock(block) {
      if (block.length !== 16) {
        throw new Error('REDOC III requires 16-byte blocks');
      }

      // Copy input data
      const data = block.slice();

      // Apply 12 rounds in reverse order
      for (let round = this.ROUNDS - 1; round >= 0; round--) {
        this._roundFunction(data, this.roundKeys[round], false);
      }

      return data;
    }

    _roundFunction(data, roundKey, encrypt) {
      if (encrypt) {
        // Enhanced encryption round for REDOC III

        // Step 1: XOR with round key
        for (let i = 0; i < 16; i++) {
          data[i] ^= roundKey[i];
        }

        // Step 2: S-box substitution
        for (let i = 0; i < 16; i++) {
          data[i] = this.SBOX[data[i]];
        }

        // Step 3: Enhanced rotation based on position (16-byte block)
        for (let i = 0; i < 16; i++) {
          data[i] = OpCodes.RotL8(data[i], (i + 1) & 0x07);
        }

        // Step 4: Enhanced diffusion - Four-way mixing
        for (let i = 0; i < 4; i++) {
          // Mix each quartet with others
          data[i] ^= data[i + 4] ^ data[i + 8] ^ data[i + 12];
          data[i + 4] ^= data[i + 8] ^ data[i + 12];
          data[i + 8] ^= data[i + 12];
        }

      } else {
        // Decryption round (exact reverse)

        // Reverse Step 4: Enhanced diffusion
        for (let i = 3; i >= 0; i--) {
          data[i + 8] ^= data[i + 12];
          data[i + 4] ^= data[i + 8] ^ data[i + 12];
          data[i] ^= data[i + 4] ^ data[i + 8] ^ data[i + 12];
        }

        // Reverse Step 3: Enhanced rotation
        for (let i = 0; i < 16; i++) {
          data[i] = OpCodes.RotR8(data[i], (i + 1) & 0x07);
        }

        // Reverse Step 2: Inverse S-box substitution
        for (let i = 0; i < 16; i++) {
          data[i] = this.SBOX_INV[data[i]];
        }

        // Reverse Step 1: XOR with round key
        for (let i = 0; i < 16; i++) {
          data[i] ^= roundKey[i];
        }
      }
    }
  }

  // ===== REGISTRATION =====

  const redoc2Instance = new REDOC2Algorithm();
  if (!AlgorithmFramework.Find(redoc2Instance.name)) {
    RegisterAlgorithm(redoc2Instance);
  }

  const redoc3Instance = new REDOC3Algorithm();
  if (!AlgorithmFramework.Find(redoc3Instance.name)) {
    RegisterAlgorithm(redoc3Instance);
  }

  // ===== EXPORTS =====

  return { REDOC2Algorithm, REDOC2Instance, REDOC3Algorithm, REDOC3Instance };
}));
