/*
 * SAFER (Secure And Fast Encryption Routine) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * SAFER K-64/K-128 - Block cipher by James Massey
 * 64-bit blocks with 64-bit or 128-bit keys
 * Uses exponential/logarithmic S-boxes based on GF(257)
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
 * SaferAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class SaferAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SAFER";
      this.description = "Secure And Fast Encryption Routine by James Massey. Uses exponential/logarithmic S-boxes based on GF(257) and Pseudo-Hadamard Transform for diffusion. Educational implementation supporting K-64 and K-128 variants.";
      this.inventor = "James Massey";
      this.year = 1993;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(8, 16, 8)  // SAFER: 64-bit (K-64) or 128-bit (K-128) keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0)    // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("SAFER Specification", "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"),
        new LinkItem("Applied Cryptography - SAFER", "https://www.schneier.com/academic/archives/1995/12/the_safer_k64_and_sa.html"),
        new LinkItem("Wikipedia - SAFER", "https://en.wikipedia.org/wiki/SAFER")
      ];

      this.references = [
        new LinkItem("Original SAFER Paper", "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"),
        new LinkItem("Crypto++ SAFER Implementation", "https://github.com/weidai11/cryptopp/blob/master/safer.cpp"),
        new LinkItem("SAFER Analysis", "https://www.cosic.esat.kuleuven.be/publications/article-431.pdf"),
        new LinkItem("ETH Zurich Reference Implementation", "https://web.archive.org/web/20060926072149/http://www.isi.ee.ethz.ch/~moliner/safer.c")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak keys in some variants",
          "Certain key patterns may exhibit reduced security",
          "Use random keys and strengthened variants when available"
        ),
        new Vulnerability(
          "Small block size",
          "64-bit block size vulnerable to birthday attacks",
          "Avoid encrypting large amounts of data with single key"
        )
      ];

      // Test vectors using OpCodes byte arrays
      this.tests = [
        {
          text: "Crypto++ SAFER K-64 test 1 (zeros)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("032808C90EE7AB7F")
        },
        {
          text: "Crypto++ SAFER K-64 test 2 (sequential plaintext)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("0102030405060708"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("7D28038633B92EB4")
        },
        {
          text: "Crypto++ SAFER K-64 test 3 (incrementing key/plaintext)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708"),
          expected: OpCodes.Hex8ToBytes("71E5CF7F083A59C5")
        },
        {
          text: "Crypto++ SAFER K-64 test 4 (incrementing key/plaintext)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("18191A1B1C1D1E1F"),
          key: OpCodes.Hex8ToBytes("0102030405060708"),
          expected: OpCodes.Hex8ToBytes("356F702CC7FA8161")
        },
        {
          text: "Crypto++ SAFER K-128 test 1 (12 rounds, mirrored key halves)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("5051525354555657"),
          key: OpCodes.Hex8ToBytes("08070605040302010807060504030201"),
          rounds: 12,
          expected: OpCodes.Hex8ToBytes("38E64DBF6E0F896E")
        },
        {
          text: "Crypto++ SAFER K-128 test 2 (12 rounds, mirrored key halves)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("58595A5B5C5D5E5F"),
          key: OpCodes.Hex8ToBytes("08070605040302010807060504030201"),
          rounds: 12,
          expected: OpCodes.Hex8ToBytes("7D8F014A902480FE")
        },
        {
          text: "Crypto++ SAFER K-128 test 3 (12 rounds, distinct key halves)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("6061626364656667"),
          key: OpCodes.Hex8ToBytes("01020304050607080807060504030201"),
          rounds: 12,
          expected: OpCodes.Hex8ToBytes("113511C22E7936DF")
        },
        {
          text: "Crypto++ SAFER K-128 test 4 (12 rounds, distinct key halves)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestData/saferval.dat",
          input: OpCodes.Hex8ToBytes("68696A6B6C6D6E6F"),
          key: OpCodes.Hex8ToBytes("01020304050607080807060504030201"),
          rounds: 12,
          expected: OpCodes.Hex8ToBytes("9EEB2D17C0581437")
        }
      ];

      // SAFER Constants
      /** @type {int32} */
      this.BLOCK_LEN = 8;
      /** @type {int32} */
      this.MAX_ROUNDS = 13;
      /** @type {int32} */
      this.K64_DEFAULT_ROUNDS = 6;
      /** @type {int32} */
      this.K128_DEFAULT_ROUNDS = 10;
      /** @type {int32} */
      this.TAB_LEN = 256;
      /** @type {uint8[]} */
      this.exp_tab = [];
      /** @type {uint8[]} */
      this.log_tab = [];

      // Initialize exponential and logarithm tables
      this._initTables();
    }

    // Initialize exponential and logarithm lookup tables
    /**
     * Build the exponential and logarithm tables of 45 in GF(257)
     */
    _initTables() {
      /** @type {uint8[]} */
      const expTab = new Array(this.TAB_LEN);
      /** @type {uint8[]} */
      const logTab = new Array(this.TAB_LEN);

      let exp = 1;
      for (let i = 0; i < this.TAB_LEN; i++) {
        expTab[i] = OpCodes.And32(exp, 0xFF);
        logTab[expTab[i]] = i;
        exp = (exp * 45) % 257; // GF(257) with primitive element 45
      }
      this.exp_tab = expTab;
      this.log_tab = logTab;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {SaferInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SaferInstance(this, isInverse);
    }
  }

  /**
 * Safer cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SaferInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SaferAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      this.key = null;
      /** @type {uint8[]|null} */
      this.expandedKey = null;
      /** @type {int32} */
      this.nofRounds = 0;
      // Parameters and tables of the parent algorithm
      /** @type {int32} */
      this.blockLen = algorithm.BLOCK_LEN;
      /** @type {int32} */
      this.maxRounds = algorithm.MAX_ROUNDS;
      /** @type {int32} */
      this.k64Rounds = algorithm.K64_DEFAULT_ROUNDS;
      /** @type {int32} */
      this.k128Rounds = algorithm.K128_DEFAULT_ROUNDS;
      /** @type {uint8[]} */
      this.expTab = algorithm.exp_tab;
      /** @type {uint8[]} */
      this.logTab = algorithm.log_tab;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8;     // 64-bit blocks
      this.KeySize = 0;
      this.isStrengthened = false;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.expandedKey = null;
        this.nofRounds = 0;
        this.KeySize = 0;
        return;
      }

      // Validate key size (64 or 128 bits)
      if (keyBytes.length !== 8 && keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. SAFER requires 8 bytes (K-64) or 16 bytes (K-128)");
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Set rounds and variant based on key size
      if (keyBytes.length === 8) {
        this.nofRounds = this.k64Rounds;
        this.isStrengthened = false;
      } else {
        this.nofRounds = this.k128Rounds;
        this.isStrengthened = true;
      }
      this.expandedKey = this._expandKey(keyBytes, this.isStrengthened);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Round count. Defaults to 6 for K-64 and 10 for K-128; the specification
   * permits any count up to 13, and published K-128 answers use 12.
   * @returns {int32} Current round count
   */

    get rounds() {
      return this.nofRounds;
    }

    /**
     * @param {int32} value - Round count 1..13
     */
    set rounds(value) {
      const maxRounds = this.maxRounds;
      if (!value || value < 1 || value > maxRounds) {
        throw new Error("Invalid round count: " + value + " (1.." + maxRounds + ")");
      }
      this.nofRounds = value;
      if (this._key) this.expandedKey = this._expandKey(this._key);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for block cipher
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];
      const blockSize = this.BlockSize;

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("SAFER requires exactly 8 bytes per block");
      }

      let [a, b, c, d, e, f, g, h] = block;
      let round = this.nofRounds;
      let keyIndex = 0;

      while (round--) {
        // Key addition/XOR
        a = OpCodes.Xor32(a, this.expandedKey[++keyIndex]);
        b = OpCodes.And32((b + this.expandedKey[++keyIndex]), 0xFF);
        c = OpCodes.And32((c + this.expandedKey[++keyIndex]), 0xFF);
        d = OpCodes.Xor32(d, this.expandedKey[++keyIndex]);
        e = OpCodes.Xor32(e, this.expandedKey[++keyIndex]);
        f = OpCodes.And32((f + this.expandedKey[++keyIndex]), 0xFF);
        g = OpCodes.And32((g + this.expandedKey[++keyIndex]), 0xFF);
        h = OpCodes.Xor32(h, this.expandedKey[++keyIndex]);

        // S-box layer
        a = OpCodes.And32((this._EXP(a) + this.expandedKey[++keyIndex]), 0xFF);
        b = OpCodes.Xor32(this._LOG(b), this.expandedKey[++keyIndex]);
        c = OpCodes.Xor32(this._LOG(c), this.expandedKey[++keyIndex]);
        d = OpCodes.And32((this._EXP(d) + this.expandedKey[++keyIndex]), 0xFF);
        e = OpCodes.And32((this._EXP(e) + this.expandedKey[++keyIndex]), 0xFF);
        f = OpCodes.Xor32(this._LOG(f), this.expandedKey[++keyIndex]);
        g = OpCodes.Xor32(this._LOG(g), this.expandedKey[++keyIndex]);
        h = OpCodes.And32((this._EXP(h) + this.expandedKey[++keyIndex]), 0xFF);

        // Pseudo-Hadamard Transform layers
        [a, b] = this._PHT(a, b); [c, d] = this._PHT(c, d);
        [e, f] = this._PHT(e, f); [g, h] = this._PHT(g, h);

        [a, c] = this._PHT(a, c); [e, g] = this._PHT(e, g);
        [b, d] = this._PHT(b, d); [f, h] = this._PHT(f, h);

        [a, e] = this._PHT(a, e); [b, f] = this._PHT(b, f);
        [c, g] = this._PHT(c, g); [d, h] = this._PHT(d, h);

        // Permutation
        let t = b; b = e; e = c; c = t;
        t = d; d = f; f = g; g = t;
      }

      // Final key addition
      a = OpCodes.Xor32(a, this.expandedKey[++keyIndex]);
      b = OpCodes.And32((b + this.expandedKey[++keyIndex]), 0xFF);
      c = OpCodes.And32((c + this.expandedKey[++keyIndex]), 0xFF);
      d = OpCodes.Xor32(d, this.expandedKey[++keyIndex]);
      e = OpCodes.Xor32(e, this.expandedKey[++keyIndex]);
      f = OpCodes.And32((f + this.expandedKey[++keyIndex]), 0xFF);
      g = OpCodes.And32((g + this.expandedKey[++keyIndex]), 0xFF);
      h = OpCodes.Xor32(h, this.expandedKey[++keyIndex]);

      return [OpCodes.And32(a, 0xFF), OpCodes.And32(b, 0xFF), OpCodes.And32(c, 0xFF), OpCodes.And32(d, 0xFF),
              OpCodes.And32(e, 0xFF), OpCodes.And32(f, 0xFF), OpCodes.And32(g, 0xFF), OpCodes.And32(h, 0xFF)];
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("SAFER requires exactly 8 bytes per block");
      }

      let [a, b, c, d, e, f, g, h] = block;
      let round = this.nofRounds;

      // Start from end of key
      const blockLen = this.blockLen;
      let keyIndex = blockLen * (1 + 2 * round);

      // Reverse final key addition
      h = OpCodes.Xor32(h, this.expandedKey[keyIndex]);
      g = OpCodes.And32((g - this.expandedKey[--keyIndex]), 0xFF);
      f = OpCodes.And32((f - this.expandedKey[--keyIndex]), 0xFF);
      e = OpCodes.Xor32(e, this.expandedKey[--keyIndex]);
      d = OpCodes.Xor32(d, this.expandedKey[--keyIndex]);
      c = OpCodes.And32((c - this.expandedKey[--keyIndex]), 0xFF);
      b = OpCodes.And32((b - this.expandedKey[--keyIndex]), 0xFF);
      a = OpCodes.Xor32(a, this.expandedKey[--keyIndex]);

      while (round--) {
        // Reverse permutation
        let t = e; e = b; b = c; c = t;
        t = f; f = d; d = g; g = t;

        // Reverse Pseudo-Hadamard Transform layers
        [a, e] = this._IPHT(a, e); [b, f] = this._IPHT(b, f);
        [c, g] = this._IPHT(c, g); [d, h] = this._IPHT(d, h);

        [a, c] = this._IPHT(a, c); [e, g] = this._IPHT(e, g);
        [b, d] = this._IPHT(b, d); [f, h] = this._IPHT(f, h);

        [a, b] = this._IPHT(a, b); [c, d] = this._IPHT(c, d);
        [e, f] = this._IPHT(e, f); [g, h] = this._IPHT(g, h);

        // Reverse S-box layer
        h = OpCodes.And32((h - this.expandedKey[--keyIndex]), 0xFF);
        g = OpCodes.Xor32(g, this.expandedKey[--keyIndex]);
        f = OpCodes.Xor32(f, this.expandedKey[--keyIndex]);
        e = OpCodes.And32((e - this.expandedKey[--keyIndex]), 0xFF);
        d = OpCodes.And32((d - this.expandedKey[--keyIndex]), 0xFF);
        c = OpCodes.Xor32(c, this.expandedKey[--keyIndex]);
        b = OpCodes.Xor32(b, this.expandedKey[--keyIndex]);
        a = OpCodes.And32((a - this.expandedKey[--keyIndex]), 0xFF);

        h = OpCodes.Xor32(this._LOG(h), this.expandedKey[--keyIndex]);
        g = OpCodes.And32((this._EXP(g) - this.expandedKey[--keyIndex]), 0xFF);
        f = OpCodes.And32((this._EXP(f) - this.expandedKey[--keyIndex]), 0xFF);
        e = OpCodes.Xor32(this._LOG(e), this.expandedKey[--keyIndex]);
        d = OpCodes.Xor32(this._LOG(d), this.expandedKey[--keyIndex]);
        c = OpCodes.And32((this._EXP(c) - this.expandedKey[--keyIndex]), 0xFF);
        b = OpCodes.And32((this._EXP(b) - this.expandedKey[--keyIndex]), 0xFF);
        a = OpCodes.Xor32(this._LOG(a), this.expandedKey[--keyIndex]);
      }

      return [OpCodes.And32(a, 0xFF), OpCodes.And32(b, 0xFF), OpCodes.And32(c, 0xFF), OpCodes.And32(d, 0xFF),
              OpCodes.And32(e, 0xFF), OpCodes.And32(f, 0xFF), OpCodes.And32(g, 0xFF), OpCodes.And32(h, 0xFF)];
    }

    // Exponential S-box lookup
    /**
     * @param {uint32} x - Byte (masked)
     * @returns {uint8} 45^x mod 257 (256 as 0)
     */
    _EXP(x) {
      return this.expTab[OpCodes.And32(x, 0xFF)];
    }

    // Logarithmic S-box lookup
    /**
     * @param {uint32} x - Byte (masked)
     * @returns {uint8} Discrete log of x to base 45
     */
    _LOG(x) {
      return this.logTab[OpCodes.And32(x, 0xFF)];
    }

    // Pseudo-Hadamard Transform
    /**
     * @param {uint32} x - First byte
     * @param {uint32} y - Second byte
     * @returns {uint32[]} [2x + y, x + y] mod 256
     */
    _PHT(x, y) {
      const new_y = OpCodes.And32((y + x), 0xFF);
      const new_x = OpCodes.And32((x + new_y), 0xFF);
      return [new_x, new_y];
    }

    // Inverse Pseudo-Hadamard Transform
    /**
     * @param {uint32} x - First byte
     * @param {uint32} y - Second byte
     * @returns {uint32[]} Inverse of _PHT
     */
    _IPHT(x, y) {
      const new_x = OpCodes.And32((x - y), 0xFF);
      const new_y = OpCodes.And32((y - new_x), 0xFF);
      return [new_x, new_y];
    }

    // Expand user key to round keys
    /**
     * @param {uint8[]} keyBytes - Key bytes
     * @returns {uint8[]} Expanded key (round count, then 8 * (1 + 2 * rounds) bytes)
     */
    _expandKey(keyBytes) {
      const nofRounds = this.nofRounds;
      const maxRounds = this.maxRounds;
      const blockLen = this.blockLen;
      if (nofRounds > maxRounds) {
        throw new Error("Too many rounds: " + nofRounds);
      }

      const keyLen = 1 + blockLen * (1 + 2 * nofRounds);
      /** @type {uint8[]} */
      const key = new Array(keyLen);
      let keyIndex = 0;

      // Store number of rounds as first byte
      key[keyIndex++] = nofRounds;

      /** @type {uint8[]} */
      const ka = new Array(blockLen + 1);
      /** @type {uint8[]} */
      const kb = new Array(blockLen + 1);

      ka[blockLen] = 0;
      kb[blockLen] = 0;

      // Initialize ka and kb arrays (keyBytes has 8 or 16 bytes, so every read is defined)
      for (let j = 0; j < blockLen; j++) {
        const userkey1_j = keyBytes[j];
        const userkey2_j = (keyBytes.length > 8) ? keyBytes[j + 8] : userkey1_j;

        ka[j] = OpCodes.RotL8(userkey1_j, 5);
        ka[blockLen] = OpCodes.Xor32(ka[blockLen], ka[j]);
        key[keyIndex++] = userkey2_j;
        kb[j] = userkey2_j;
        kb[blockLen] = OpCodes.Xor32(kb[blockLen], kb[j]);
      }

      // Generate round keys
      for (let i = 1; i <= nofRounds; i++) {
        // Rotate ka and kb arrays
        for (let j = 0; j < blockLen + 1; j++) {
          ka[j] = OpCodes.RotL8(ka[j], 6);
          kb[j] = OpCodes.RotL8(kb[j], 6);
        }

        // Generate first 8 bytes of round key
        for (let j = 0; j < blockLen; j++) {
          key[keyIndex++] = OpCodes.And32((ka[j] + this._EXP(this._EXP(OpCodes.And32((18 * i + j + 1), 0xFF)))), 0xFF);
        }

        // Generate second 8 bytes of round key
        for (let j = 0; j < blockLen; j++) {
          key[keyIndex++] = OpCodes.And32((kb[j] + this._EXP(this._EXP(OpCodes.And32((18 * i + j + 10), 0xFF)))), 0xFF);
        }
      }

      return key;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new SaferAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SaferAlgorithm, SaferInstance };
}));