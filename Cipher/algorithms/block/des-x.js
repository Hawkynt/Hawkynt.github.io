/*
 * DES-X (DES eXtended) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * DES-X by Ron Rivest (1984) - DES with key whitening
 * Block size: 64 bits, Key size: 184 bits (56-bit DES key + 64-bit pre-whitening + 64-bit post-whitening)
 * Uses standard DES with additional XOR keys before and after encryption
 * 
 * Educational implementation for learning cryptographic key whitening techniques.
 * DES-X provides increased resistance to brute-force attacks compared to standard DES.
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
 * DESXAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class DESXAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DES-X";
      this.description = "DES with key whitening by Ron Rivest (1984). Uses 64-bit pre/post-whitening keys with standard DES to increase resistance to brute-force attacks. Educational implementation showing key whitening techniques.";
      this.inventor = "Ronald L. Rivest";
      this.year = 1984;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(23, 23, 0) // Fixed 184-bit keys (23 bytes)
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit blocks (8 bytes)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("DES-X Original Specification", "https://people.csail.mit.edu/rivest/pubs.html#Rivest84"),
        new LinkItem("RSA BSAFE DES-X Documentation", "https://web.archive.org/web/20050404121715/http://www.rsasecurity.com/rsalabs/node.asp?id=2229"),
        new LinkItem("Applied Cryptography - DES-X", "https://www.schneier.com/books/applied-cryptography/")
      ];

      this.references = [
        new LinkItem("Crypto++ DES-X Implementation", "https://github.com/weidai11/cryptopp"),
        new LinkItem("Key Whitening in Block Ciphers", "https://eprint.iacr.org/"),
        new LinkItem("DES-X Security Analysis", "https://link.springer.com/chapter/10.1007/BFb0052332")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Based on DES",
          "DES-X inherits all weaknesses of DES including small key size and susceptibility to differential cryptanalysis",
          "Use modern block ciphers like AES instead of DES-X"
        ),
        new Vulnerability(
          "Key whitening limitations",
          "While key whitening increases security, it doesn't address fundamental DES weaknesses",
          "DES-X is obsolete - use AES or other modern ciphers"
        )
      ];

      // Test vectors for DES-X with key whitening verification
      this.tests = [
        {
          text: "DES-X All Zeros Test Vector",
          uri: "https://people.csail.mit.edu/rivest/pubs.html#Rivest84",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8CA64DE9C1B123A7")
        },
        {
          text: "DES-X Key Whitening Test Vector",
          uri: "https://people.csail.mit.edu/rivest/pubs.html#Rivest84",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          key: OpCodes.Hex8ToBytes("123456789ABCDEF00123456789ABCDFEDCBA9876543210"),
          expected: OpCodes.Hex8ToBytes("E90D655C944145EC")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DESXInstance(this, isInverse);
    }
  }

  /**
 * DESX cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DESXInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // DES-X key components
      this.K1 = null; // Pre-whitening key (8 bytes)
      this.K2 = null; // Post-whitening key (8 bytes)
      this.desKey = null; // DES key (7 bytes, padded to 8)

      // Cache for DES algorithm
      this._desAlgorithm = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        this.K1 = null;
        this.K2 = null;
        this.desKey = null;
        return;
      }

      // Validate key size (must be 23 bytes for 184-bit key)
      if (keyBytes.length !== 23) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. DES-X requires exactly 23 bytes (184 bits)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Split 184-bit key into components:
      // K1: bytes 0-7 (64-bit pre-whitening key)
      // DES_K: bytes 8-14 (56-bit DES key, 7 bytes)  
      // K2: bytes 15-22 (64-bit post-whitening key)

      this.K1 = keyBytes.slice(0, 8);
      this.desKey = keyBytes.slice(8, 15);
      this.K2 = keyBytes.slice(15, 23);

      // Pad DES key to 8 bytes (add parity byte)
      this.desKeyPadded = [...this.desKey, 0x00];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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

    _encryptBlock(block) {
      // Pre-whitening: XOR plaintext with K1
      const preWhitened = [];
      for (let i = 0; i < 8; i++) {
        preWhitened[i] = OpCodes.XorN(block[i], this.K1[i]);
      }

      // Apply DES encryption using working DES implementation
      const desOutput = this._callDES(preWhitened, this.desKeyPadded, false);

      // Post-whitening: XOR DES output with K2
      const result = [];
      for (let i = 0; i < 8; i++) {
        result[i] = OpCodes.XorN(desOutput[i], this.K2[i]);
      }

      return result;
    }

    _decryptBlock(block) {
      // Reverse post-whitening: XOR ciphertext with K2
      const postDewhitened = [];
      for (let i = 0; i < 8; i++) {
        postDewhitened[i] = OpCodes.XorN(block[i], this.K2[i]);
      }

      // Apply DES decryption using working DES implementation
      const desOutput = this._callDES(postDewhitened, this.desKeyPadded, true);

      // Reverse pre-whitening: XOR DES output with K1
      const result = [];
      for (let i = 0; i < 8; i++) {
        result[i] = OpCodes.XorN(desOutput[i], this.K1[i]);
      }

      return result;
    }

    // Inline DES implementation for DES-X
    _callDES(data, key, decrypt = false) {
      if (data.length !== 8 || key.length !== 8) {
        throw new Error("DES requires 8-byte blocks and keys");
      }

      // Initialize DES tables if not done yet
      if (!this._desTables) {
        this._initDESTables();
      }

      // Generate subkeys for this DES key
      const subkeys = this._generateDESSubkeys(key);

      // Perform DES encryption/decryption
      return this._desCrypt(data, subkeys, decrypt);
    }

    _initDESTables() {
      this._desTables = {};

      // Initial Permutation
      this._desTables.IP = [
        58, 50, 42, 34, 26, 18, 10, 2,
        60, 52, 44, 36, 28, 20, 12, 4,
        62, 54, 46, 38, 30, 22, 14, 6,
        64, 56, 48, 40, 32, 24, 16, 8,
        57, 49, 41, 33, 25, 17, 9, 1,
        59, 51, 43, 35, 27, 19, 11, 3,
        61, 53, 45, 37, 29, 21, 13, 5,
        63, 55, 47, 39, 31, 23, 15, 7
      ];

      // Final Permutation (inverse of IP)
      this._desTables.FP = [
        40, 8, 48, 16, 56, 24, 64, 32,
        39, 7, 47, 15, 55, 23, 63, 31,
        38, 6, 46, 14, 54, 22, 62, 30,
        37, 5, 45, 13, 53, 21, 61, 29,
        36, 4, 44, 12, 52, 20, 60, 28,
        35, 3, 43, 11, 51, 19, 59, 27,
        34, 2, 42, 10, 50, 18, 58, 26,
        33, 1, 41, 9, 49, 17, 57, 25
      ];

      // Permuted Choice 1 (64 bits to 56 bits)
      this._desTables.PC1 = [
        57, 49, 41, 33, 25, 17, 9,
        1, 58, 50, 42, 34, 26, 18,
        10, 2, 59, 51, 43, 35, 27,
        19, 11, 3, 60, 52, 44, 36,
        63, 55, 47, 39, 31, 23, 15,
        7, 62, 54, 46, 38, 30, 22,
        14, 6, 61, 53, 45, 37, 29,
        21, 13, 5, 28, 20, 12, 4
      ];

      // Permuted Choice 2 (56 bits to 48 bits)
      this._desTables.PC2 = [
        14, 17, 11, 24, 1, 5,
        3, 28, 15, 6, 21, 10,
        23, 19, 12, 4, 26, 8,
        16, 7, 27, 20, 13, 2,
        41, 52, 31, 37, 47, 55,
        30, 40, 51, 45, 33, 48,
        44, 49, 39, 56, 34, 53,
        46, 42, 50, 36, 29, 32
      ];

      // Expansion table (32 bits to 48 bits)
      this._desTables.E = [
        32, 1, 2, 3, 4, 5,
        4, 5, 6, 7, 8, 9,
        8, 9, 10, 11, 12, 13,
        12, 13, 14, 15, 16, 17,
        16, 17, 18, 19, 20, 21,
        20, 21, 22, 23, 24, 25,
        24, 25, 26, 27, 28, 29,
        28, 29, 30, 31, 32, 1
      ];

      // P-box permutation
      this._desTables.P = [
        16, 7, 20, 21,
        29, 12, 28, 17,
        1, 15, 23, 26,
        5, 18, 31, 10,
        2, 8, 24, 14,
        32, 27, 3, 9,
        19, 13, 30, 6,
        22, 11, 4, 25
      ];

      // Rotation schedule for key generation
      this._desTables.SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

      // S-boxes
      const SBOX_DATA = Object.freeze([
        [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
        [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
        [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
        [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
        [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
        [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
        [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
        [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
      ]);

      this._desTables.SBOX = [];
      for (let i = 0; i < SBOX_DATA.length; i++) {
        const flatSbox = SBOX_DATA[i];
        const sbox = [];
        for (let row = 0; row < 4; row++) {
          sbox[row] = [];
          for (let col = 0; col < 16; col++) {
            sbox[row][col] = flatSbox[row * 16 + col];
          }
        }
        this._desTables.SBOX.push(sbox);
      }
    }

    _generateDESSubkeys(key) {
      // Convert key to bits and apply PC1 permutation
      let keyBits = this._bytesToBits(key);
      keyBits = this._permute(keyBits, this._desTables.PC1);

      // Split into two 28-bit halves
      let c = keyBits.slice(0, 28);
      let d = keyBits.slice(28, 56);

      const subkeys = [];

      // Generate 16 subkeys
      for (let i = 0; i < 16; i++) {
        // Left circular shift both halves
        c = this._leftShift(c, this._desTables.SHIFTS[i]);
        d = this._leftShift(d, this._desTables.SHIFTS[i]);

        // Combine and apply PC2 permutation
        const combined = c.concat(d);
        subkeys[i] = this._permute(combined, this._desTables.PC2);
      }

      return subkeys;
    }

    _desCrypt(input, subkeys, isDecrypt) {
      // Convert input to bits and apply initial permutation
      let bits = this._bytesToBits(input);
      bits = this._permute(bits, this._desTables.IP);

      // Split into left and right halves
      let left = bits.slice(0, 32);
      let right = bits.slice(32, 64);

      // 16 rounds of Feistel network
      for (let i = 0; i < 16; i++) {
        const temp = right.slice();
        const key = isDecrypt ? subkeys[15 - i] : subkeys[i];
        right = this._xorBits(left, this._feistelFunction(right, key));
        left = temp;
      }

      // Combine halves (note: right and left are swapped before final permutation)
      const combined = right.concat(left);

      // Apply final permutation and convert back to bytes
      const finalBits = this._permute(combined, this._desTables.FP);
      return this._bitsToBytes(finalBits);
    }

    _feistelFunction(right, key) {
      // Expansion permutation (32 bits to 48 bits)
      const expanded = this._permute(right, this._desTables.E);

      // XOR with round key
      const xored = this._xorBits(expanded, key);

      // S-box substitution (48 bits to 32 bits)
      const substituted = this._sboxSubstitution(xored);

      // P-box permutation
      return this._permute(substituted, this._desTables.P);
    }

    _sboxSubstitution(input) {
      const output = [];

      for (let i = 0; i < 8; i++) {
        // Extract 6-bit block for this S-box
        const block = input.slice(i * 6, (i + 1) * 6);

        // Calculate row (outer bits) and column (middle 4 bits)
        const row = OpCodes.SetBit(OpCodes.SetBit(0, 1, block[0]), 0, block[5]);
        const col = OpCodes.SetBit(OpCodes.SetBit(OpCodes.SetBit(OpCodes.SetBit(0, 3, block[1]), 2, block[2]), 1, block[3]), 0, block[4]);

        // Get value from S-box
        const val = this._desTables.SBOX[i][row][col];

        // Convert to 4-bit binary and add to output
        for (let j = 3; j >= 0; j--) {
          output.push(OpCodes.GetBit(val, j));
        }
      }

      return output;
    }

    _permute(input, table) {
      const output = new Array(table.length);
      for (let i = 0; i < table.length; i++) {
        output[i] = input[table[i] - 1];
      }
      return output;
    }

    _xorBits(a, b) {
      return OpCodes.XorArrays(a, b);
    }

    _leftShift(input, n) {
      return input.slice(n).concat(input.slice(0, n));
    }

    _bytesToBits(bytes) {
      const bits = new Array(bytes.length * 8);
      for (let i = 0; i < bytes.length; i++) {
        for (let j = 0; j < 8; j++) {
          bits[i * 8 + j] = OpCodes.GetBit(bytes[i], 7 - j);
        }
      }
      return bits;
    }

    _bitsToBytes(bits) {
      const bytes = new Array(bits.length / 8);
      for (let i = 0; i < bytes.length; i++) {
        let val = 0;
        for (let j = 0; j < 8; j++) {
          val = OpCodes.SetBit(val, 7 - j, bits[i * 8 + j]);
        }
        bytes[i] = val;
      }
      return bytes;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new DESXAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DESXAlgorithm, DESXInstance };
}));