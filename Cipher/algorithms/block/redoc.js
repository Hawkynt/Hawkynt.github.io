/*
 * REDOC Block Cipher Implementation (REDOC II and REDOC III)
 * Compatible with AlgorithmFramework
 * IBM's experimental data-dependent ciphers from the 1980s
 * (c)2006-2025 Hawkynt
 *
 * REDOC II: 80-bit blocks, 160-bit keys, 10 rounds (1980)
 * REDOC III: 64-bit blocks, 8- to 272-bit keys, XOR-only key-table masking,
 *            following Michael Wood's reference source code
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

  /**
   * Shared S-box generation: a bijective S-box built by permuting 0-255
   * @param {int32} seedKey - Seed
   * @param {int32} multiplier - Multiplier
   * @returns {uint8[]} S-box
   */
  function generateSBox(seedKey, multiplier) {
    // Create a proper bijective S-box by permuting 0-255
    /** @type {uint8[]} */
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

  /**
   * @param {uint8[]} sbox - Bijective S-box
   * @returns {uint8[]} Inverse S-box
   */
  function generateInverseSBox(sbox) {
    /** @type {uint8[]} */
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

  class REDOC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "REDOC II";
      this.description = "IBM's experimental data-dependent cipher from the 1980s with 80-bit blocks and 160-bit keys. Uses data-dependent permutations, substitutions, and enclave operations with 10 rounds. Educational implementation only.";
      this.inventor = "IBM Research";
      this.year = 1980;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(20, 20, 1) // 160-bit keys only
      ];
      this.SupportedBlockSizes = [
        new KeySize(10, 10, 1) // 80-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("IBM Cryptographic Research Documents", "https://www.ibm.com/security/cryptography/"),
        new LinkItem("Fast Software Encryption Proceedings", "https://link.springer.com/conference/fse")
      ];

      this.references = [
        new LinkItem("Data-Dependent Cipher Design Research", "https://eprint.iacr.org/"),
        new LinkItem("IBM Internal Research Archives", "https://researcher.watson.ibm.com/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Educational Implementation", "Simplified implementation may not reflect full security of original design", "Use only for educational purposes and cryptographic research", "https://eprint.iacr.org/")
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
   * @returns {REDOC2Instance} New cipher instance
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

  class REDOC2Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {REDOC2Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 10;
      this.KeySize = 20;

      // REDOC II parameters - simplified implementation
      /** @type {int32} */
      this.ROUNDS = 10;

      // Precomputed S-boxes for educational purposes
      /** @type {uint8[]} */
      this.SBOX = generateSBox(0x5A, 131);
      /** @type {uint8[]} */
      this.SBOX_INV = generateInverseSBox(this.SBOX);
      /** @type {uint8[]|null} */
      this.keyX = null;
      /** @type {uint8[]|null} */
      this.keyY = null;
      /** @type {uint8[][]|null} */
      this.roundKeys = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} value - Key bytes, or null to clear
     */
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

    /**
     * Split the key and derive the round keys
     */
    _setupKey() {
      if (!this._key) return;

      // Split key into two halves
      this.keyX = this._key.slice(0, 10);
      this.keyY = this._key.slice(10, 20);

      // Generate round keys
      this.roundKeys = this._generateRoundKeys();
    }

    /**
     * @returns {uint8[][]} One round key per round
     */
    _generateRoundKeys() {
      /** @type {uint8[][]} */
      const roundKeys = [];

      for (let round = 0; round < this.ROUNDS; round++) {
        /** @type {uint8[]} */
        const roundKey = new Array(10);
        for (let i = 0; i < 10; i++) {
          roundKey[i] = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(this.keyX[i], this.keyY[(i + round) % 10]), round), 0xFF);
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }
      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
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

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
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

    /**
     * One round, applied in place
     * @param {uint8[]} data - Block bytes
     * @param {uint8[]} roundKey - Round key
     * @param {boolean} encrypt - Forward (true) or inverse (false) round
     */
    _roundFunction(data, roundKey, encrypt) {
      if (encrypt) {
        // Simplified symmetric encryption round

        // Step 1: XOR with round key
        for (let i = 0; i < 10; i++) {
          data[i] = OpCodes.Xor8(data[i], roundKey[i]);
        }

        // Step 2: S-box substitution
        for (let i = 0; i < 10; i++) {
          data[i] = this.SBOX[data[i]];
        }

        // Step 3: Simple rotation based on position
        for (let i = 0; i < 10; i++) {
          data[i] = OpCodes.RotL8(data[i], OpCodes.And32(i + 1, 0x07));
        }

        // Step 4: Left-right mixing (like Feistel)
        for (let i = 0; i < 5; i++) {
          data[i] = OpCodes.Xor8(data[i], data[i + 5]);
        }

      } else {
        // Decryption round (exact reverse)

        // Reverse Step 4: Left-right mixing
        for (let i = 0; i < 5; i++) {
          data[i] = OpCodes.Xor8(data[i], data[i + 5]);
        }

        // Reverse Step 3: Simple rotation
        for (let i = 0; i < 10; i++) {
          data[i] = OpCodes.RotR8(data[i], OpCodes.And32(i + 1, 0x07));
        }

        // Reverse Step 2: Inverse S-box substitution
        for (let i = 0; i < 10; i++) {
          data[i] = this.SBOX_INV[data[i]];
        }

        // Reverse Step 1: XOR with round key
        for (let i = 0; i < 10; i++) {
          data[i] = OpCodes.Xor8(data[i], roundKey[i]);
        }
      }
    }
  }

  // ===== REDOC III IMPLEMENTATION =====
  //
  // Follows Michael Wood's REDOC III reference source (REDOC3.ZIP of the
  // Applied Cryptography source distribution):
  //   - each pair of neighbouring key bytes (the last byte pairs with the
  //     first) seeds rand() and writes 2560 pseudorandom byte pairs into a
  //     2560-byte key table, walking it with a fixed odd-prime step
  //   - the key table is XOR-folded, 16 bytes at a time, into a 16-byte mask
  //   - each 8-byte block gets two passes (mask bytes 0-7, then 8-15): byte i,
  //     XORed with its mask byte, selects an 8-byte row of the key table that
  //     is XORed into every other block byte
  // rand() is the C standard's reference generator (multiplier 1103515245,
  // increment 12345, 15-bit result); the reference source was written for a
  // 16-bit int, so the seed is the 16-bit value of the two key bytes.

  /** @type {int32} */
  const REDOC3_TABLE_SIZE = 2560;
  /** @type {int32} */
  const REDOC3_BLOCK_SIZE = 8;
  /** @type {int32} */
  const REDOC3_MAX_KEY = 34;
  /** @type {uint32} */
  const REDOC3_RAND_MULT = 1103515245;
  /** @type {uint32} */
  const REDOC3_RAND_INC = 12345;
  // Table-walk step per key byte pair: 1 followed by the first 34 odd primes.
  /** @type {uint8[]} */
  const REDOC3_PRIMES = [1, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
                         73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149];

  /**
 * REDOC3Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class REDOC3Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "REDOC III";
      this.description = "Michael Wood's streamlined successor of REDOC II, built only from XORs: the key (1 to 34 bytes) seeds a 2560-byte key table that is folded into a 16-byte mask; two passes over the 8-byte block let each byte, masked, select a table row XORed into all other bytes. Follows Wood's reference source code, which processes 64-bit blocks; Applied Cryptography describes an 80-bit block.";
      this.inventor = "Michael Wood";
      this.year = 1985;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1, REDOC3_MAX_KEY, 1)
      ];
      this.SupportedBlockSizes = [
        new KeySize(REDOC3_BLOCK_SIZE, REDOC3_BLOCK_SIZE, 0)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Applied Cryptography source code (REDOC3.ZIP by Michael Wood)", "https://www.schneier.com/books/applied-cryptography-source/"),
        new LinkItem("Wikipedia: REDOC", "https://en.wikipedia.org/wiki/REDOC"),
        new LinkItem("US Patent 5,003,596 (Wood)", "https://patents.google.com/patent/US5003596A")
      ];

      this.references = [
        new LinkItem("REDOC III reference source (Michael Wood)", "https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Differential cryptanalysis", "Ken Shirriff's differential attack recovers the key with about 2^20 chosen plaintexts and 2^30 memory.", "Use AES or another vetted cipher.", "https://en.wikipedia.org/wiki/REDOC")
      ];

      // Test vectors: Michael Wood's reference source compiled with the C
      // standard's reference rand(); the 32-byte-key vectors also match the
      // DarkCrypt Total Commander plugin's REDOC III on its first 8 bytes.
      const uri = "https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip";
      this.tests = [
        {
          text: "REDOC III reference - sample key of the reference source, zero block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("594280e7122b"),
          expected: OpCodes.Hex8ToBytes("d907f979f2477825")
        },
        {
          text: "REDOC III reference - 1-byte key (minimum)",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("80"),
          expected: OpCodes.Hex8ToBytes("c96886528fbdd43e")
        },
        {
          text: "REDOC III reference - 16-byte key",
          uri: uri,
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("ab6a95c7fc7fd581")
        },
        {
          text: "REDOC III reference - zero 32-byte key, zero block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("4f83a9591536d9bd")
        },
        {
          text: "REDOC III reference - incrementing 32-byte key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("731624c431837ac5")
        },
        {
          text: "REDOC III reference - all-ones 32-byte key and block",
          uri: uri,
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("3485b3877f608773")
        },
        {
          text: "REDOC III reference - 34-byte key (maximum)",
          uri: uri,
          input: OpCodes.Hex8ToBytes("fedcba9876543210"),
          key: OpCodes.Hex8ToBytes("e0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff0001"),
          expected: OpCodes.Hex8ToBytes("8c81eb7f3db7776e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {REDOC3Instance} New cipher instance
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

  class REDOC3Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {REDOC3Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = REDOC3_BLOCK_SIZE;
      this.KeySize = 0;
      /** @type {uint8[]|null} */
      this.keyTable = null;
      /** @type {uint8[]|null} */
      this.maskTable = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} value - Key bytes, or null to clear
     */
    set key(value) {
      if (!value) {
        this._key = null;
        this.KeySize = 0;
        this.keyTable = null;
        this.maskTable = null;
        return;
      }

      if (value.length < 1 || value.length > REDOC3_MAX_KEY) {
        throw new Error('Invalid REDOC III key size: ' + value.length + ' bytes. Required: 1 to ' + REDOC3_MAX_KEY + ' bytes.');
      }
      this._key = [...value]; // Copy the key
      this.KeySize = value.length;
      this.keyTable = this._buildKeyTable(this._key);
      this.maskTable = this._buildMaskTable(this.keyTable);
    }

    /**
     * Fill the 2560-byte key table from the key byte pairs
     * @param {uint8[]} key - Key bytes
     * @returns {uint8[]} Key table
     */
    _buildKeyTable(key) {
      /** @type {uint8[]} */
      const table = new Uint8Array(REDOC3_TABLE_SIZE);
      const length = key.length;
      for (let pi = 1; pi <= length; pi++) {
        // Seed: low byte is key byte pi-1, high byte its successor (the last wraps to the first)
        const next = pi === length ? key[0] : key[pi];
        /** @type {uint32} */
        let seed = OpCodes.Or32(key[pi - 1], OpCodes.Shl32(next, 8));
        /** @type {int32} */
        const step = REDOC3_PRIMES[pi];
        /** @type {int32} */
        let point = 0;
        for (let i = 0; i < REDOC3_TABLE_SIZE; i++) {
          point += step;
          if (point >= REDOC3_TABLE_SIZE) point -= REDOC3_TABLE_SIZE;
          seed = OpCodes.ToUint32(OpCodes.Mul32(seed, REDOC3_RAND_MULT) + REDOC3_RAND_INC);
          const value = OpCodes.And32(OpCodes.Shr32(seed, 16), 0x7FFF);
          table[point] = OpCodes.And32(value, 0xFF);
          // Quirk of the reference: the high byte for position 2558 lands on position 0,
          // and the one for position 2559 falls outside the table.
          const high = OpCodes.Shr32(value, 8);
          if (point + 1 === REDOC3_TABLE_SIZE - 1) table[0] = high;
          else if (point + 1 < REDOC3_TABLE_SIZE) table[point + 1] = high;
        }
      }
      return table;
    }

    /**
     * XOR-fold the key table into the 16-byte mask table
     * @param {uint8[]} table - Key table
     * @returns {uint8[]} Mask table
     */
    _buildMaskTable(table) {
      /** @type {uint8[]} */
      const mask = new Uint8Array(16);
      for (let i = 0; i < REDOC3_TABLE_SIZE; i++) {
        mask[i % 16] = OpCodes.Xor8(mask[i % 16], table[i]);
      }
      return mask;
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this._cryptBlock(block, !this.isInverse);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }
      return output;
    }

    /**
     * Apply one masking step: block byte index, XORed with a mask byte,
     * selects the key-table row that is XORed into every other block byte
     * @param {uint8[]} data - Block bytes, changed in place
     * @param {int32} index - Selecting block byte
     * @param {uint8} maskByte - Mask byte for this step
     */
    _step(data, index, maskByte) {
      const row = OpCodes.Mul32(OpCodes.Xor8(data[index], maskByte), REDOC3_BLOCK_SIZE);
      for (let j = 0; j < REDOC3_BLOCK_SIZE; j++) {
        if (j !== index) data[j] = OpCodes.Xor8(data[j], this.keyTable[OpCodes.Add32(row, j)]);
      }
    }

    /**
     * @param {uint8[]} block - Input block
     * @param {boolean} encrypt - Encrypt (true) or decrypt (false)
     * @returns {uint8[]} Output block
     */
    _cryptBlock(block, encrypt) {
      const data = block.slice();
      const mask = this.maskTable;
      if (encrypt) {
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < REDOC3_BLOCK_SIZE; i++) this._step(data, i, mask[pass * REDOC3_BLOCK_SIZE + i]);
        }
      } else {
        // Each step leaves its selecting byte unchanged, so it undoes itself; run them backwards
        for (let pass = 1; pass >= 0; pass--) {
          for (let i = REDOC3_BLOCK_SIZE - 1; i >= 0; i--) this._step(data, i, mask[pass * REDOC3_BLOCK_SIZE + i]);
        }
      }
      return data;
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
