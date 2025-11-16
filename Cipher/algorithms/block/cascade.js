/*
 * CASCADE Cipher Construction Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CASCADE Construction by Botan Library (Jack Lloyd)
 * - Chains two block ciphers sequentially
 * - Encryption: C2(C1(plaintext, key1), key2)
 * - Decryption: C1_inv(C2_inv(ciphertext, key2), key1)
 * - Block size is LCM of both cipher block sizes
 * - Key is concatenation of both cipher keys
 *
 * This is a generic construction that can chain any two block ciphers
 * with matching or compatible block sizes.
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
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== LOAD REQUIRED CIPHERS =====
  // CASCADE needs the underlying ciphers to be loaded first
  // In Node.js environment, we can require them directly
  if (typeof require !== 'undefined') {
    try {
      // Load required ciphers for CASCADE combinations
      require('./serpent.js');
      require('./twofish.js');
      require('./rijndael.js'); // For AES-256
      require('./cast.js'); // For CAST-128
    } catch (err) {
      // In browser environment or if files don't exist, algorithms should already be loaded
      // The Find() method will throw an error during initialization if they're missing
    }
  }

  // ===== HELPER FUNCTIONS =====

  /**
   * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
   */
  function gcd(a, b) {
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
   * Calculate Least Common Multiple (LCM)
   */
  function lcm(a, b) {
    return (a * b) / gcd(a, b);
  }

  // ===== CASCADE ALGORITHM IMPLEMENTATION =====

  /**
   * CASCADE(Cipher1, Cipher2) - Sequential cipher chaining construction
   *
   * Creates a composite cipher by applying two ciphers in sequence:
   * - Encryption: output = Cipher2.encrypt(Cipher1.encrypt(input))
   * - Decryption: output = Cipher1.decrypt(Cipher2.decrypt(input))
   *
   * The combined block size is the LCM of both ciphers' block sizes,
   * and the key is split between the two ciphers.
   */
  class CascadeAlgorithm extends BlockCipherAlgorithm {
    constructor(cipher1Name, cipher2Name) {
      super();

      this.cipher1Name = cipher1Name;
      this.cipher2Name = cipher2Name;

      // Required metadata
      this.name = `Cascade(${cipher1Name},${cipher2Name})`;
      this.description = `Sequential chaining of ${cipher1Name} and ${cipher2Name} block ciphers. Encrypts with ${cipher1Name} first, then ${cipher2Name}. Provides increased security margin through cipher diversity.`;
      this.inventor = "Jack Lloyd (Botan Library)";
      this.year = 2010;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher Construction";
      this.securityStatus = null; // Security depends on inner ciphers
      this.complexity = ComplexityType.ADVANCED;
      this.country = null; // Generic construction

      // We'll set these dynamically when instances are created
      this.SupportedKeySizes = [];
      this.SupportedBlockSizes = [];

      // Documentation
      this.documentation = [
        new LinkItem("Botan CASCADE Implementation (Header)", "https://github.com/randombit/botan/blob/master/src/lib/block/cascade/cascade.h"),
        new LinkItem("Botan CASCADE Implementation (Source)", "https://github.com/randombit/botan/blob/master/src/lib/block/cascade/cascade.cpp"),
        new LinkItem("Botan Test Vectors", "https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec")
      ];

      this.references = [
        new LinkItem("Cipher Cascading - Wikipedia", "https://en.wikipedia.org/wiki/Multiple_encryption"),
        new LinkItem("Botan Cryptography Library", "https://botan.randombit.net/")
      ];

      // No specific vulnerabilities - depends on inner ciphers
      this.knownVulnerabilities = [];

      // Test vectors will be set per concrete instance
      this.tests = [];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CascadeInstance(this, isInverse);
    }
  }

  /**
 * Cascade cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CascadeInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Cipher instances
      this.cipher1 = null;
      this.cipher2 = null;
      this.cipher1Algorithm = null;
      this.cipher2Algorithm = null;

      // Key management
      this._key = null;
      this.key1 = null;
      this.key2 = null;

      // Block size management
      this.blockSize1 = 0;
      this.blockSize2 = 0;
      this.combinedBlockSize = 0;
    }

    /**
     * Initialize cipher instances by looking up registered algorithms
     */
    _initializeCiphers() {
      if (this.cipher1 && this.cipher2) {
        return; // Already initialized
      }

      // Look up cipher algorithms from registry
      this.cipher1Algorithm = AlgorithmFramework.Find(this.algorithm.cipher1Name);
      this.cipher2Algorithm = AlgorithmFramework.Find(this.algorithm.cipher2Name);

      if (!this.cipher1Algorithm) {
        throw new Error(`Cipher '${this.algorithm.cipher1Name}' not found in registry. Ensure it is loaded before CASCADE.`);
      }

      if (!this.cipher2Algorithm) {
        throw new Error(`Cipher '${this.algorithm.cipher2Name}' not found in registry. Ensure it is loaded before CASCADE.`);
      }

      // Get block sizes
      this.blockSize1 = this.cipher1Algorithm.SupportedBlockSizes[0].minSize;
      this.blockSize2 = this.cipher2Algorithm.SupportedBlockSizes[0].minSize;

      // Calculate combined block size (LCM of both)
      this.combinedBlockSize = lcm(this.blockSize1, this.blockSize2);

      // Verify block sizes are compatible (combined must be multiple of both)
      if (this.combinedBlockSize % this.blockSize1 !== 0 || this.combinedBlockSize % this.blockSize2 !== 0) {
        throw new Error(`Incompatible block sizes: ${this.blockSize1} and ${this.blockSize2}`);
      }

      // Create cipher instances
      this.cipher1 = this.cipher1Algorithm.CreateInstance(false); // Forward for encryption
      this.cipher2 = this.cipher2Algorithm.CreateInstance(false);
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.key1 = null;
        this.key2 = null;
        return;
      }

      // Initialize ciphers if needed
      this._initializeCiphers();

      // Get maximum key sizes for both ciphers
      const key1Size = this.cipher1Algorithm.SupportedKeySizes[0].maxSize;
      const key2Size = this.cipher2Algorithm.SupportedKeySizes[0].maxSize;
      const requiredKeySize = key1Size + key2Size;

      if (keyBytes.length < requiredKeySize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${requiredKeySize} bytes = ${key1Size} + ${key2Size})`);
      }

      // Store full key
      this._key = [...keyBytes];

      // Split key between two ciphers
      this.key1 = keyBytes.slice(0, key1Size);
      this.key2 = keyBytes.slice(key1Size, key1Size + key2Size);

      // Set keys for both cipher instances
      this.cipher1.key = this.key1;
      this.cipher2.key = this.key2;
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
      if (!this._key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length is multiple of combined block size
      if (this.inputBuffer.length % this.combinedBlockSize !== 0) {
        throw new Error(`Input length ${this.inputBuffer.length} is not a multiple of block size ${this.combinedBlockSize}`);
      }

      // Calculate number of CASCADE blocks (in terms of combined block size)
      const cascadeBlocks = this.inputBuffer.length / this.combinedBlockSize;

      // Calculate total blocks for each cipher
      // blocks_for_cipher = cascade_blocks * (combined_block_size / cipher_block_size)
      const c1TotalBlocks = cascadeBlocks * (this.combinedBlockSize / this.blockSize1);
      const c2TotalBlocks = cascadeBlocks * (this.combinedBlockSize / this.blockSize2);

      if (this.isInverse) {
        // DECRYPTION: Cipher1_decrypt(Cipher2_decrypt(input))
        // Process in reverse order

        // Create inverse cipher instances
        const cipher2Inv = this.cipher2Algorithm.CreateInstance(true);
        const cipher1Inv = this.cipher1Algorithm.CreateInstance(true);
        cipher2Inv.key = this.key2;
        cipher1Inv.key = this.key1;

        // First decrypt with cipher2 - all blocks at once
        cipher2Inv.Feed(this.inputBuffer);
        let intermediate = cipher2Inv.Result();

        // Then decrypt with cipher1 - all blocks at once
        cipher1Inv.Feed(intermediate);
        const output = cipher1Inv.Result();

        this.inputBuffer = []; // Clear for next operation
        return output;

      } else {
        // ENCRYPTION: Cipher2(Cipher1(input))

        // First encrypt with cipher1 - all blocks at once
        this.cipher1.Feed(this.inputBuffer);
        let intermediate = this.cipher1.Result();

        // Then encrypt with cipher2 - all blocks at once
        this.cipher2.Feed(intermediate);
        const output = this.cipher2.Result();

        this.inputBuffer = []; // Clear for next operation
        return output;
      }
    }
  }

  // ===== REGISTER CASCADE COMBINATIONS =====

  // NOTE: CASCADE is implementation-dependent. The test vectors below are generated
  // using SynthelicZ Cipher Tools implementations of Serpent (libgcrypt-based), Twofish,
  // Rijndael (AES), and CAST-128. They will NOT match Botan's CASCADE test vectors
  // because Botan uses different Serpent implementation than libgcrypt.

  // Cascade(Serpent, Twofish)
  const cascadeSerpentTwofish = new CascadeAlgorithm("Serpent", "Twofish");
  cascadeSerpentTwofish.SupportedKeySizes = [new KeySize(64, 64, 0)]; // 32 + 32 bytes
  cascadeSerpentTwofish.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // 128-bit (LCM of 16,16)
  cascadeSerpentTwofish.tests = [
    {
      text: 'Cascade(Serpent,Twofish) Test Vector #1',
      uri: 'Generated from SynthelicZ libgcrypt-based Serpent + Twofish',
      input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
      key: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFFFFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100'),
      expected: OpCodes.Hex8ToBytes('6C2E97CCB949CA3A8743CC6E94D9A23A')
    },
    {
      text: 'Cascade(Serpent,Twofish) Test Vector #2',
      uri: 'Generated from SynthelicZ libgcrypt-based Serpent + Twofish',
      input: OpCodes.Hex8ToBytes('0123456789ABCDEF0123456789ABCDEF'),
      key: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFFFFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100'),
      expected: OpCodes.Hex8ToBytes('818A617CBDD01208AAE758F0759FC1B2')
    },
    {
      text: 'Cascade(Serpent,Twofish) Test Vector #3',
      uri: 'Generated from SynthelicZ libgcrypt-based Serpent + Twofish',
      input: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
      key: OpCodes.Hex8ToBytes('00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFFFFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100'),
      expected: OpCodes.Hex8ToBytes('6C2E97CCB949CA3A8743CC6E94D9A23A6C2E97CCB949CA3A8743CC6E94D9A23A')
    }
  ];

  // Cascade(Serpent, AES-256) - using Rijndael as AES
  const cascadeSerpentAES = new CascadeAlgorithm("Serpent", "Rijndael (AES)");
  cascadeSerpentAES.name = "Cascade(Serpent,AES-256)"; // Override name for clarity
  cascadeSerpentAES.SupportedKeySizes = [new KeySize(64, 64, 0)]; // 32 + 32 bytes
  cascadeSerpentAES.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // 128-bit
  cascadeSerpentAES.tests = [
    {
      text: 'Cascade(Serpent,AES-256) Test Vector #1',
      uri: 'Generated from SynthelicZ libgcrypt-based Serpent + Rijndael (AES)',
      input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
      key: OpCodes.Hex8ToBytes('0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEFFEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210'),
      expected: OpCodes.Hex8ToBytes('26C3ED2087FE60BDA72168618779C862')
    },
    {
      text: 'Cascade(Serpent,AES-256) Test Vector #2',
      uri: 'Generated from SynthelicZ libgcrypt-based Serpent + Rijndael (AES)',
      input: OpCodes.Hex8ToBytes('0123456789ABCDEF0123456789ABCDEF'),
      key: OpCodes.Hex8ToBytes('0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEFFEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210'),
      expected: OpCodes.Hex8ToBytes('371AD80B9E75781C3D8E86042233E262')
    }
  ];

  // Cascade(Serpent, CAST-128)
  const cascadeSerpentCAST = new CascadeAlgorithm("Serpent", "CAST-128");
  cascadeSerpentCAST.SupportedKeySizes = [new KeySize(48, 48, 0)]; // 32 + 16 bytes
  cascadeSerpentCAST.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // 128-bit (LCM of 16,8)
  cascadeSerpentCAST.tests = [
    {
      text: 'Cascade(Serpent,CAST-128) Test Vector #1',
      uri: 'Generated from SynthelicZ libgcrypt-based Serpent + CAST-128',
      input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
      key: OpCodes.Hex8ToBytes('AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899FFEEDDCCBBAA99887766554433220000'),
      expected: OpCodes.Hex8ToBytes('E88358F0A60CB1D8D7CFCC75B21F28AD')
    }
  ];

  // Register all CASCADE combinations
  RegisterAlgorithm(cascadeSerpentTwofish);
  RegisterAlgorithm(cascadeSerpentAES);
  RegisterAlgorithm(cascadeSerpentCAST);

  // Return the classes for potential external use
  return {
    CascadeAlgorithm,
    CascadeInstance
  };
}));
