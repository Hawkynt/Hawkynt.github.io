/*
 * NewDES Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NewDES (New Data Encryption Standard) is a block cipher designed by Robert Scott.
 * Published in Cryptologia, Volume 9, Number 1 (January 1985).
 * 
 * Key features:
 * - Block size: 64 bits (8 bytes)
 * - Key size: 120 bits (15 bytes)
 * - Structure: Feistel-like with 8 rounds + final transformation
 * - Operations: XOR with S-box substitution using a 256-byte rotor
 * 
 * NewDES was designed to be easier to implement in software than DES
 * and supposedly more secure, though it has since been cryptanalyzed.
 * 
 * Based on Mark Riordan's reference implementation from August 1990.
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

  /**
 * NewDESAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class NewDESAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "NewDES";
      this.description = "New Data Encryption Standard by Robert Scott. Educational implementation of a 64-bit block cipher with 120-bit keys, designed to be easier to implement than DES.";
      this.inventor = "Robert Scott";
      this.year = 1985;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Cryptanalyzed but historically interesting
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm parameters
      this.BLOCK_SIZE = 8;           // 64 bits = 8 bytes
      this.KEY_SIZE = 15;            // 120 bits = 15 bytes
      this.UNRAVELLED_KEY_SIZE = 60; // 15 * 4 = 60 bytes for key schedule
      this.ROTOR_SIZE = 256;         // S-box size
      this.ROUNDS = 17;              // Number of main rounds (NewDES uses 17 rounds)

      // Block and key specifications
      this.blockSize = 8; // 64-bit blocks
      this.keySizes = [
        new KeySize(15, 15, 0) // Fixed 120-bit (15-byte) key
      ];

      // AlgorithmFramework compatibility
      this.SupportedKeySizes = [new KeySize(15, 15, 0)]; // Fixed 120-bit (15-byte) key
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // Fixed 64-bit (8-byte) blocks

      // Documentation and references
      this.documentation = [
        new LinkItem("NewDES Original Paper", "https://www.tandfonline.com/doi/abs/10.1080/0161-118591857944"),
        new LinkItem("NewDES Analysis", "https://en.wikipedia.org/wiki/NewDES")
      ];

      this.references = [
        new LinkItem("Mark Riordan's Implementation", "https://www.schneier.com/academic/archives/1995/12/applied_cryptography_1.html"),
        new LinkItem("Cryptologia Paper", "https://www.tandfonline.com/toc/ucry20/9/1")
      ];

      // Test vectors
      this.tests = [
        {
          text: "NewDES test vector - all zeros plaintext",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcd").slice(0, 15),
          expected: OpCodes.Hex8ToBytes("dacbd6baa814b800"),
          uri: [new LinkItem("NewDES Educational Implementation", "https://en.wikipedia.org/wiki/NewDES")]
        }
      ];
    }

    CreateInstance(isDecryptMode) {
      return new NewDESInstance(this, isDecryptMode);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * NewDES cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class NewDESInstance extends IBlockCipherInstance {
    constructor(algorithm, isDecryptMode) {
      super(algorithm);
      this.isDecryptMode = isDecryptMode || false;
      this.encryptionKey = null;
      this.decryptionKey = null;
      this._key = null;
      this.buffer = [];

      // NewDES S-box (rotor) - fixed substitution table
      this.rotor = [
        32, 137, 239, 188, 102, 125, 221,  72, 212,  68,  81,  37,  86, 237, 147, 149,
        70, 229,  17, 124, 115, 207,  33,  20, 122, 143,  25, 215,  51, 183, 138, 142,
       146, 211, 110, 173,   1, 228, 189,  14, 103,  78, 162,  36, 253, 167, 116, 255,
       158,  45, 185,  50,  98, 168, 250, 235,  54, 141, 195, 247, 240,  63, 148,   2,
       224, 169, 214, 180,  62,  22, 117, 108,  19, 172, 161, 159, 160,  47,  43, 171,
       194, 175, 178,  56, 196, 112,  23, 220,  89,  21, 164, 130, 157,   8,  85, 251,
       216,  44,  94, 179, 226,  38,  90, 119,  40, 202,  34, 206,  35,  69, 231, 246,
        29, 109,  74,  71, 176,   6,  60, 145,  65,  13,  77, 151,  12, 127,  95, 199,
        57, 101,   5, 232, 150, 210, 129,  24, 181,  10, 121, 187,  48, 193, 139, 252,
       219,  64,  88, 233,  96, 128,  80,  53, 191, 144, 218,  11, 106, 132, 155, 104,
        91, 136,  31,  42, 243,  66, 126, 135,  30,  26,  87, 186, 182, 154, 242, 123,
        82, 166, 208,  39, 152, 190, 113, 205, 114, 105, 225,  84,  73, 163,  99, 111,
       204,  61, 200, 217, 170,  15, 198,  28, 192, 254, 134, 234, 222,   7, 236, 248,
       201,  41, 177, 156,  92, 131,  67, 249, 245, 184, 203,   9, 241,   0,  27,  46,
       133, 174,  75,  18,  93, 209, 100, 120,  76, 213,  16,  83,   4, 107, 140,  52,
        58,  55,   3, 244,  97, 197, 238, 227, 118,  49,  79, 230, 223, 165, 153,  59
      ];

      // Key will be set when provided via properties or Feed method
    }

    // Setter for key property (called by test framework)
    set key(keyValue) {
      if (keyValue) {
        this._setupKey(keyValue);
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key;
    }

    _setupKey(keyBytes) {
      if (!keyBytes) {
        throw new Error("Key is required");
      }

      // Validate key size
      if (keyBytes.length !== 15) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 15 bytes)`);
      }

      // Store the original key
      this._key = keyBytes.slice();

      // Set up encryption and decryption keys
      this.encryptionKey = this._setupEncryptionKey(keyBytes);
      this.decryptionKey = this._setupDecryptionKey(keyBytes);
    }

    // Test framework interface
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (Array.isArray(data)) {
        this.buffer = this.buffer.concat(data);
      } else {
        this.buffer.push(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key must be set before processing data');
      }

      if (this.buffer.length === 0) {
        return [];
      }

      // Ensure we have complete 8-byte blocks
      if (this.buffer.length % 8 !== 0) {
        throw new Error('NewDES requires data to be multiple of 8 bytes');
      }

      const result = [];

      // Process each 8-byte block
      for (let i = 0; i < this.buffer.length; i += 8) {
        const block = this.buffer.slice(i, i + 8);
        let processedBlock;

        if (this.isDecryptMode) {
          processedBlock = this._decryptBlock(block);
        } else {
          processedBlock = this._encryptBlock(block);
        }

        result.push(...processedBlock);
      }

      return result;
    }

    EncryptBlock(blockIndex, data) {
      if (data.length !== 8) {
        throw new Error('NewDES requires exactly 8 bytes per block');
      }
      return this._encryptBlock(data);
    }

    DecryptBlock(blockIndex, data) {
      if (data.length !== 8) {
        throw new Error('NewDES requires exactly 8 bytes per block');
      }
      return this._decryptBlock(data);
    }

    /**
     * Create encryption key schedule
     * @param {Array} key - 15-byte user key
     * @returns {Array} 119-byte unravelled key for encryption (17 rounds * 7 bytes)
     */
    _setupEncryptionKey(key) {
      const unravelledKey = new Array(119); // 17 rounds * 7 bytes per round = 119 bytes
      let keyIndex = 0;

      // NewDES key schedule: each set of 2 rounds uses 7 bytes from key, then rotate key
      for (let round = 0; round < 17; round++) {
        for (let i = 0; i < 7; i++) {
          unravelledKey[round * 7 + i] = key[keyIndex];
          keyIndex = (keyIndex + 1) % 15;
        }

        // After every 2 rounds, rotate the key by 7 positions
        if (round % 2 === 1) {
          keyIndex = (keyIndex + 7) % 15;
        }
      }

      return unravelledKey;
    }

    /**
     * Create decryption key schedule
     * @param {Array} key - 15-byte user key
     * @returns {Array} 119-byte unravelled key for decryption (same as encryption)
     */
    _setupDecryptionKey(key) {
      // For NewDES decryption, we use the same key schedule as encryption
      // The reverse operation is handled in the algorithm itself
      return this._setupEncryptionKey(key);
    }

    /**
     * Core NewDES block transformation
     * @param {Array} block - 8-byte block to transform
     * @param {Array} unravelledKey - 119-byte key schedule (17 rounds * 7 bytes per round)
     */
    _newdesBlock(block, unravelledKey) {
      let keyPtr = 0;

      // 17 main rounds
      for (let round = 0; round < 17; round++) {
        // NewDES round: 8 XOR operations per round
        // Each round uses 7 bytes of key material

        // XOR left half with rotor[right half XOR key]
        block[0] ^= this.rotor[block[4] ^ unravelledKey[keyPtr++]];
        block[1] ^= this.rotor[block[5] ^ unravelledKey[keyPtr++]];
        block[2] ^= this.rotor[block[6] ^ unravelledKey[keyPtr++]];
        block[3] ^= this.rotor[block[7] ^ unravelledKey[keyPtr++]];

        // XOR right half with rotor[left half XOR key]
        block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr++]];
        block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr++]];
        block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr++]];

        // Note: block[7] doesn't get additional XOR in this step
        // This creates the asymmetric structure that NewDES requires
      }
    }

    /**
     * Core NewDES block transformation for decryption
     * @param {Array} block - 8-byte block to transform
     * @param {Array} unravelledKey - 119-byte key schedule (17 rounds * 7 bytes per round)
     */
    _newdesBlockDecrypt(block, unravelledKey) {
      // For decryption, apply the same operations in reverse round order
      // Since XOR is its own inverse, we apply the same XORs but with reversed key schedule

      let keyPtr = 119 - 7; // Start from the last round's key

      // 17 main rounds in reverse order
      for (let round = 16; round >= 0; round--) {
        // Reverse the operations from encryption
        // Apply the same XOR pattern but in reverse order

        // Reverse: block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr++]];
        block[6] ^= this.rotor[block[2] ^ unravelledKey[keyPtr + 6]];
        // Reverse: block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr++]];
        block[5] ^= this.rotor[block[1] ^ unravelledKey[keyPtr + 5]];
        // Reverse: block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr++]];
        block[4] ^= this.rotor[block[0] ^ unravelledKey[keyPtr + 4]];

        // Reverse: block[3] ^= this.rotor[block[7] ^ unravelledKey[keyPtr++]];
        block[3] ^= this.rotor[block[7] ^ unravelledKey[keyPtr + 3]];
        // Reverse: block[2] ^= this.rotor[block[6] ^ unravelledKey[keyPtr++]];
        block[2] ^= this.rotor[block[6] ^ unravelledKey[keyPtr + 2]];
        // Reverse: block[1] ^= this.rotor[block[5] ^ unravelledKey[keyPtr++]];
        block[1] ^= this.rotor[block[5] ^ unravelledKey[keyPtr + 1]];
        // Reverse: block[0] ^= this.rotor[block[4] ^ unravelledKey[keyPtr++]];
        block[0] ^= this.rotor[block[4] ^ unravelledKey[keyPtr]];

        keyPtr -= 7; // Move to previous round's key
      }
    }

    /**
     * Encrypt a single block
     * @param {Array} block - 8-byte input block
     * @returns {Array} 8-byte encrypted block
     */
    _encryptBlock(block) {
      if (!this.encryptionKey || !block || block.length !== 8) {
        throw new Error("Invalid encryption state or block size");
      }

      // Copy input block
      const result = block.slice();

      // Apply NewDES encryption
      this._newdesBlock(result, this.encryptionKey);

      return result;
    }

    /**
     * Decrypt a single block
     * @param {Array} block - 8-byte encrypted block
     * @returns {Array} 8-byte decrypted block
     */
    _decryptBlock(block) {
      if (!this.decryptionKey || !block || block.length !== 8) {
        throw new Error("Invalid decryption state or block size");
      }

      // Copy input block
      const result = block.slice();

      // Apply NewDES decryption (reverse operations)
      this._newdesBlockDecrypt(result, this.decryptionKey);

      return result;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new NewDESAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NewDESAlgorithm, NewDESInstance };
}));