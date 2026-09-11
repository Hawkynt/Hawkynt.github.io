/*
 * FEAL-8 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * FEAL Algorithm by NTT (Akihiro Shimizu and Shoji Miyaguchi, 1987)
 * Block size: 64 bits, Key size: 64 bits, Rounds: 8
 * Uses Feistel network with fast software implementation
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * FEAL is considered cryptographically broken and should not be used for security.
 * 
 * References:
 * - Shimizu, A. and Miyaguchi, S. "Fast data encipherment algorithm FEAL" (EUROCRYPT 1987)
 * - FEAL-8 specification with 8 rounds for improved security
 * - Differential cryptanalysis by Biham and Shamir showed weaknesses
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
   * FEAL-8 (Fast Data Encipherment Algorithm) - Educational Feistel cipher
   * 64-bit blocks with 64-bit keys using 8 rounds. Cryptographically broken.
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class FEALAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FEAL-8";
      this.description = "Fast Data Encipherment Algorithm by NTT. Educational implementation of a cryptographically broken Feistel cipher with 8 rounds, 64-bit blocks and keys.";
      this.inventor = "Akihiro Shimizu, Shoji Miyaguchi";
      this.year = 1987;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN; // Cryptographically broken due to differential cryptanalysis
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.JP;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit (8-byte) key
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit (8-byte) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("FEAL-8 Specification", "https://en.wikipedia.org/wiki/FEAL"),
        new LinkItem("Original EUROCRYPT 1987 Paper", "https://link.springer.com/chapter/10.1007/3-540-39118-5_24")
      ];

      this.references = [
        new LinkItem("Differential Cryptanalysis of FEAL", "https://link.springer.com/chapter/10.1007/3-540-46877-3_35"),
        new LinkItem("FEAL Cryptanalysis", "https://www.iacr.org/archive/crypto1989/000350213.pdf")
      ];

      // Known vulnerabilities - FEAL is completely broken
      this.knownVulnerabilities = [
        new Vulnerability("Differential Cryptanalysis",
          "FEAL-8 can be broken with differential cryptanalysis using only a few hundred chosen plaintexts",
          '',
          "https://en.wikipedia.org/wiki/Differential_cryptanalysis")
      ];

      // Test vectors
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("0000000000000000"), // input
          OpCodes.Hex8ToBytes("ceef2c86f2490752"), // expected
          "Handbook of Applied Cryptography, Example 7.99 (FEAL-8)",
          "https://cacr.uwaterloo.ca/hac/about/chap7.pdf"
        )
      ];
      // Additional property for key in test vector
      this.tests[0].key = OpCodes.Hex8ToBytes("0123456789abcdef");
    }

    /**
     * Create new FEAL cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {FEALInstance} New FEAL cipher instance
     */
    CreateInstance(isInverse = false) {
      return new FEALInstance(this, isInverse);
    }

  }

  /**
   * FEAL cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IBlockCipherInstance}
   */
  class FEALInstance extends IBlockCipherInstance {
    /**
     * Initialize FEAL cipher instance
     * @param {FEALAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8; // 64-bit blocks
      this.KeySize = 0;   // will be set when key is assigned
    }

    /**
     * Set encryption/decryption key and generate round keys
     * @param {uint8[]|null} keyBytes - 64-bit (8-byte) key or null to clear
     * @throws {Error} If key size is not exactly 8 bytes
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 8) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 8 bytes)`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;
      this.roundKeys = this._generateRoundKeys(keyBytes);
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    /**
     * Feed data to cipher for encryption/decryption
     * @param {uint8[]} data - Input data bytes
     * @throws {Error} If key not set
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
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

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

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
     * FEAL S0 box function - rotated addition
     * @private
     * @param {uint8} a - First input byte
     * @param {uint8} b - Second input byte
     * @returns {uint8} Transformed byte
     */
    _S0(a, b) {
      return OpCodes.RotL8(OpCodes.AndN(a + b, 0xFF), 2);
    }

    /**
     * FEAL S1 box function - rotated addition with constant
     * @private
     * @param {uint8} a - First input byte
     * @param {uint8} b - Second input byte
     * @returns {uint8} Transformed byte
     */
    _S1(a, b) {
      return OpCodes.RotL8(OpCodes.AndN(a + b + 1, 0xFF), 2);
    }

    /**
     * FEAL F-function (Feistel round function)
     * @private
     * @param {uint8[]} data - 4 data bytes
     * @param {uint8[]} key - 2 subkey bytes
     * @returns {uint8[]} 4 transformed bytes
     */
    _F(data, key) {
      const a = data;
      const b = key;

      const ret = [0, 0, 0, 0];
      const T = OpCodes.XorN(OpCodes.XorN(a[3], a[2]), b[1]);
      ret[1] = this._S1(OpCodes.XorN(OpCodes.XorN(a[0], a[1]), b[0]), T);
      ret[0] = this._S0(a[0], ret[1]);
      ret[2] = this._S0(T, ret[1]);
      ret[3] = this._S1(ret[2], a[3]);

      return ret;
    }

    /**
     * FEAL Fk function used by the key schedule
     * @private
     * @param {uint8[]} a - 4 bytes
     * @param {uint8[]} b - 4 bytes
     * @returns {uint8[]} 4 bytes
     */
    _Fk(a, b) {
      const ret = [0, 0, 0, 0];

      ret[1] = this._S1(OpCodes.XorN(a[0], a[1]), OpCodes.XorN(OpCodes.XorN(b[0], a[2]), a[3]));
      ret[0] = this._S0(a[0], OpCodes.XorN(b[2], ret[1]));
      ret[2] = this._S0(OpCodes.XorN(a[2], a[3]), OpCodes.XorN(b[1], ret[1]));
      ret[3] = this._S1(a[3], OpCodes.XorN(b[3], ret[2]));

      return ret;
    }

    /**
     * Generate the 16 16-bit subkeys K0..K15 from the 64-bit master key.
     * FEAL-8 is FEAL-N with N=8, i.e. FEAL-NX with a zero right key half, so
     * the Qi term of the FEAL-NX schedule vanishes.
     * @private
     * @param {uint8[]} keyBytes - 8-byte master key
     * @returns {uint8[]} 24 subkey bytes (K0..K11 for N=8: 2*(N+4))
     */
    _generateRoundKeys(keyBytes) {
      const N = 8;
      const subKeys = new Array(2 * (N + 4));
      for (let i = 0; i < subKeys.length; i++) subKeys[i] = 0;

      let ACurrent = keyBytes.slice(0, 4);
      let BCurrent = keyBytes.slice(4, 8);
      let XORTemp = [0, 0, 0, 0];

      const numIterations = Math.floor(N / 2) + 4;
      for (let i = 0; i < numIterations; i++) {
        let XORResult = BCurrent.slice(0, 4);
        if (i > 0) XORResult = OpCodes.XorArrays(XORResult, XORTemp);

        XORTemp = ACurrent.slice(0, 4);
        ACurrent = this._Fk(ACurrent, XORResult);

        subKeys[4 * i] = ACurrent[0];
        subKeys[4 * i + 1] = ACurrent[1];
        subKeys[4 * i + 2] = ACurrent[2];
        subKeys[4 * i + 3] = ACurrent[3];

        const temp = ACurrent;
        ACurrent = BCurrent;
        BCurrent = temp;
      }

      return subKeys;
    }

    /**
     * Encrypt single 64-bit block using FEAL-8
     * @private
     * @param {uint8[]} block - 8-byte input block
     * @returns {uint8[]} 8-byte encrypted block
     */
    _encryptBlock(block) {
      const N = 8;
      const subkeys = this.roundKeys;

      // Pre-whitening with K8..K11
      const firstXor = subkeys.slice(2 * N, 2 * N + 8);
      const whitened = OpCodes.XorArrays(block, firstXor);

      let LCurrent = whitened.slice(0, 4);
      let RCurrent = whitened.slice(4, 8);
      RCurrent = OpCodes.XorArrays(LCurrent, RCurrent);

      for (let i = 0; i < N; i++) {
        const subkey = subkeys.slice(2 * i, 2 * i + 2);
        LCurrent = OpCodes.XorArrays(LCurrent, this._F(RCurrent, subkey));
        const temp = LCurrent;
        LCurrent = RCurrent;
        RCurrent = temp;
      }

      LCurrent = OpCodes.XorArrays(LCurrent, RCurrent);
      const lastXor = subkeys.slice(2 * N + 8, 2 * N + 16);
      return OpCodes.XorArrays(lastXor, RCurrent.concat(LCurrent));
    }

    /**
     * Decrypt single 64-bit block using FEAL-8
     * @private
     * @param {uint8[]} block - 8-byte input block
     * @returns {uint8[]} 8-byte decrypted block
     */
    _decryptBlock(block) {
      const N = 8;
      const subkeys = this.roundKeys;

      const firstXor = subkeys.slice(2 * N + 8, 2 * N + 16);
      const unwhitened = OpCodes.XorArrays(block, firstXor);

      let LCurrent = unwhitened.slice(4, 8);
      let RCurrent = unwhitened.slice(0, 4);
      LCurrent = OpCodes.XorArrays(LCurrent, RCurrent);

      for (let i = N - 1; i >= 0; i--) {
        const temp = LCurrent;
        LCurrent = RCurrent;
        RCurrent = temp;

        const subkey = subkeys.slice(2 * i, 2 * i + 2);
        LCurrent = OpCodes.XorArrays(LCurrent, this._F(RCurrent, subkey));
      }

      const lastXor = subkeys.slice(2 * N, 2 * N + 8);
      RCurrent = OpCodes.XorArrays(LCurrent, RCurrent);
      return OpCodes.XorArrays(LCurrent.concat(RCurrent), lastXor);
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new FEALAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FEALAlgorithm, FEALInstance };
}));