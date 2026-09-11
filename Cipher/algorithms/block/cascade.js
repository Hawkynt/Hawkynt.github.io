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

      // Get maximum key sizes for both ciphers.
      // A cipher may advertise several disjoint KeySize entries (e.g. Twofish lists
      // 16, 24 and 32 separately), so the maximum must span all of them.
      const maxKeyLength = alg => alg.SupportedKeySizes.reduce((m, ks) => Math.max(m, ks.maxSize), 0);
      const key1Size = maxKeyLength(this.cipher1Algorithm);
      const key2Size = maxKeyLength(this.cipher2Algorithm);
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

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

  // Test vectors are the published CASCADE known-answer tests from the Botan
  // library's own test data (src/tests/data/block/cascade.vec), which is the
  // reference definition of this construction.
  const BOTAN_CASCADE_VEC = 'https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec';

  // Cascade(Serpent, Twofish)
  const cascadeSerpentTwofish = new CascadeAlgorithm("Serpent", "Twofish");
  cascadeSerpentTwofish.SupportedKeySizes = [new KeySize(64, 64, 0)]; // 32 + 32 bytes
  cascadeSerpentTwofish.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // 128-bit (LCM of 16,16)
  cascadeSerpentTwofish.tests = [
    {
      text: 'Botan cascade.vec - Cascade(Serpent,Twofish) vector 1',
      uri: BOTAN_CASCADE_VEC,
      input: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
      key: OpCodes.Hex8ToBytes('B50638F695AFA16F9378D43374CA8568600135ECD1E513838722366346BC4B2101422291558FAA30A3196CBEB42E67F4C075882482897F72A8A30AE9B3AD426D'),
      expected: OpCodes.Hex8ToBytes('E78516D21D23DA501939C24C48BCC79DE78516D21D23DA501939C24C48BCC79D')
    },
    {
      text: 'Botan cascade.vec - Cascade(Serpent,Twofish) vector 2',
      uri: BOTAN_CASCADE_VEC,
      input: OpCodes.Hex8ToBytes('47CB8147C5290D6F94FBF3351777087FA731610A3F66E3CCFA6D9B18F980E687'),
      key: OpCodes.Hex8ToBytes('9E8F6BC09768AED8F533FA4FC35FF6FEB8020FFBC8350DDFD20ACA7ECF1889CFBFCD78E261B9A3CD825401AFA7ADCDFA88DBA8230FB92D4B942C25EE92F27A02'),
      expected: OpCodes.Hex8ToBytes('F234E056923B3DB26AABC8F604F0CE2C1A7F4C35B0B74958014D791668FF6BF4')
    },
    {
      text: 'Botan cascade.vec - Cascade(Serpent,Twofish) vector 3',
      uri: BOTAN_CASCADE_VEC,
      input: OpCodes.Hex8ToBytes('B9A28D32734EF678BACD5539FF9FF951AF81F44AFE223256E5D8898FB862A767B90BD2D95E17E4411D02D49481CCE4191EE2C7AE8EBDF6312BDC66317AD42140'),
      key: OpCodes.Hex8ToBytes('1EF34E47005028F2D95120052855C6001225200A333CA4D7D5A356B5554EE2AE7EBC9BA57BADA0DAFC84C2187C51CB3CCB5EEE40F27C00537FFFCA2851DD8BD8'),
      expected: OpCodes.Hex8ToBytes('065E390C4FD10E9929F30D89A67E0D4CFA3AF90BEF46B2B435B53CBE0B7DD1B612D4C5E2D03028B488000C06517434FC70F7B62C273CA5DEBD9CA7034D853087')
    }
  ];

  // Cascade(Serpent, AES-256) - using Rijndael as AES
  const cascadeSerpentAES = new CascadeAlgorithm("Serpent", "Rijndael (AES)");
  cascadeSerpentAES.name = "Cascade(Serpent,AES-256)"; // Override name for clarity
  cascadeSerpentAES.SupportedKeySizes = [new KeySize(64, 64, 0)]; // 32 + 32 bytes
  cascadeSerpentAES.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // 128-bit
  cascadeSerpentAES.tests = [
    {
      text: 'Botan cascade.vec - Cascade(Serpent,AES-256) vector 1',
      uri: BOTAN_CASCADE_VEC,
      input: OpCodes.Hex8ToBytes('06CEB2B4FD2F0A27B3C90D77D2E9BBD3665A8DCAC9187B1EE9F6A60D39042A9D3719883B3E87845B9D4A8BE258379959775969CBF5768A359797B2FA19FC2FCC'),
      key: OpCodes.Hex8ToBytes('EE426051D1ADCE09AC02E2023331F273BB1B2C4C5905DEDA3E1032CCD0DB56115B011F05688F781E3F790364968E06DC6E7BD5FA38DB068CBD34A85B6B3A9458'),
      expected: OpCodes.Hex8ToBytes('05FFBF6E8097FC746FFAD8C3306E6DB668148796180F26CA5DE06AE76DE16D078A0E72B259982423ED96FF95719DEB160CEFE7697752B0CFA984A18DDCEF2EC0')
    },
    {
      text: 'Botan cascade.vec - Cascade(Serpent,AES-256) vector 2',
      uri: BOTAN_CASCADE_VEC,
      input: OpCodes.Hex8ToBytes('FBAF0DE6C09D10EB31F21A7C784BF453F82F51EFFA8B363EE6B33DF15204F43445170DED1E39AB922548ED82AAADED6BF470A5226B69D025FE3D532AADDA069C464D2C8A65E1A18698BD521AFB3053229C1539626392031F8C36229FF3178A7F5C716E30DBEFDDD4AC2113071977B795A8B29DA7F467471A996FB63136387C28'),
      key: OpCodes.Hex8ToBytes('CDCD23F5518DB5DAE8C69B56EB352D4F3C4A64A5FFC8E5BC2511B8310993C48EFA30A0F9E2B98A0FB1FE64173E6A8038047AEBAE22E17392FE32CF1D0DE3BB76'),
      expected: OpCodes.Hex8ToBytes('7ED1F730EED52DFB63E073A40EAE404E443ACEB9A3B55132E740ACE1EEDF99D0F22B3F2326E2E124594E75ED1915C8D155F24269254B22B6E8C53E9F64E70552D5E3004782C6C47341EBF8716B59DAB49B512B6DF7F9D7FB914FFA56F7F89B561B6A5DFE9334B7561144B25FE0F57BEBB4058EC7D9EEA57AB62825A86312BBC3')
    }
  ];

  // Cascade(Serpent, CAST-128)
  const cascadeSerpentCAST = new CascadeAlgorithm("Serpent", "CAST-128");
  cascadeSerpentCAST.SupportedKeySizes = [new KeySize(48, 48, 0)]; // 32 + 16 bytes
  cascadeSerpentCAST.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // 128-bit (LCM of 16,8)
  cascadeSerpentCAST.tests = [
    {
      text: 'Botan cascade.vec - Cascade(Serpent,CAST-128) vector 1',
      uri: BOTAN_CASCADE_VEC,
      input: OpCodes.Hex8ToBytes('27EDE4B2A3784A33898FA330167317BF7354072672D49DD03D13D3F0856CF3D9C17C1237565E7320BDD23C03BDE195A4FE58623A983DB9C308D5A976D92CD6A2'),
      key: OpCodes.Hex8ToBytes('EFA9CC5F3E245AB463CC60A5015CB0F663676760832CEE6C633A518112E518D45DD4B627E9507CDB03A1ADD870E28362'),
      expected: OpCodes.Hex8ToBytes('2D7096A03BAB4DBDABEDB9F069FE68C3E12ED65ACCE43ECF7F6D810B5EEC36A522B605715BE12003E324436652BEA06BD289DBE886A5DE9E51CFF6C065A21F2B')
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
