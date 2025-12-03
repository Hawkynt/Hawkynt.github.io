/*
 * Simon Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NSA's Simon cipher (2013) - Feistel-like design for hardware optimization
 * Simon64/128: 64-bit blocks with 128-bit keys, 44 rounds
 * Lightweight cipher optimized for hardware efficiency
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
   * Simon - NSA lightweight block cipher optimized for hardware
   * 64-bit blocks with 128-bit keys using 44 rounds and Feistel-like structure
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class SimonCipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Simon";
      this.description = "NSA's lightweight block cipher family designed for resource-constrained environments. Simon64/128 variant uses 64-bit blocks with 128-bit keys and 44 rounds. Optimized for hardware implementation.";
      this.inventor = "NSA (National Security Agency)";
      this.year = 2013;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.BASIC;
      this.country = AlgorithmFramework.CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 0) // Simon64/128: 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 0) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("The Simon and Speck Families of Lightweight Block Ciphers", "https://eprint.iacr.org/2013/404.pdf"),
        new AlgorithmFramework.LinkItem("NSA Simon and Speck Specification", "https://nsacyber.github.io/simon-speck/"),
        new AlgorithmFramework.LinkItem("Lightweight Cryptography Standardization", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("NSA Reference Implementation", "https://github.com/nsacyber/simon-speck-supercop"),
        new AlgorithmFramework.LinkItem("Cryptanalysis of Simon variants", "https://eprint.iacr.org/2014/448.pdf"),
        new AlgorithmFramework.LinkItem("NIST Lightweight Cryptography", "https://csrc.nist.gov/Projects/Lightweight-Cryptography")
      ];

      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Reduced-round attacks", "Various attacks exist against reduced-round variants (not full 44 rounds)", "Use full-round implementation and consider alternatives for high-security applications")
      ];

      // Test vectors from NSA specification
      this.tests = [
        {
          text: "Simon64/128 Test Vector #1",
          uri: "https://eprint.iacr.org/2013/404.pdf",
          input: OpCodes.Hex8ToBytes("656c69746e696874"),
          key: OpCodes.Hex8ToBytes("1f1e1d1c1b1a19181716151413121110"),
          expected: OpCodes.Hex8ToBytes("be921012427893c2")
        },
        {
          text: "Simon64/128 Test Vector #2 (zero key)",
          uri: "https://eprint.iacr.org/2013/404.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8ae8d3db04628ce4")
        }
      ];

      // Simon64/128 Constants
      this.ROUNDS = 44;       // NSA standard: 44 rounds for 64/128 variant
      this.WORD_SIZE = 32;    // 32-bit words (64-bit block = 2 words)
      this.m = 4;            // Number of key words for Simon64/128
    }

    /**
     * Create new Simon cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {SimonInstance} New Simon cipher instance
     */
    CreateInstance(isInverse = false) {
      return new SimonInstance(this, isInverse);
    }

    /**
     * Get Z3 sequence for Simon64/128 key schedule
     * @static
     * @returns {uint8[]} Z3 bit sequence (62 bits)
     */
    static getZ3Sequence() {
      // Z3 sequence for Simon64/128 configuration (62 bits)
      // Source: NSA reference implementation 
      return [1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0,
              1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0,
              0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1];
    }

    /**
     * Simon round function: F(x) = ((x rotL 1) AND (x rotL 8)) XOR (x rotL 2)
     * @static
     * @param {uint32} x - 32-bit input word
     * @returns {uint32} Transformed 32-bit output
     */
    static roundFunction(x) {
      const rot1 = OpCodes.RotL32(x, 1);
      const rot8 = OpCodes.RotL32(x, 8);
      const rot2 = OpCodes.RotL32(x, 2);

      return OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(rot1, rot8), rot2));
    }
  }

  /**
   * Simon cipher instance implementing Feed/Result pattern with streaming
   * @class
   * @extends {IBlockCipherInstance}
   */
  class SimonInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
     * Initialize Simon cipher instance
     * @param {SimonCipher} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.outputBuffer = [];
      this.BlockSize = 8;     // 64-bit blocks
      this.KeySize = 0;
    }

    /**
     * Set encryption/decryption key and expand round keys
     * @param {uint8[]|null} keyBytes - 128-bit (16-byte) key or null to clear
     * @throws {Error} If key size invalid
     */
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
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.roundKeys = this._expandKey(keyBytes);
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Feed data to cipher for encryption/decryption (streaming)
     * @param {uint8[]} data - Input data bytes
     * @throws {Error} If key not set
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);

      // Process complete blocks
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        this.outputBuffer.push(...processed);
      }
    }

    /**
     * Get cipher result (all processed blocks)
     * @returns {uint8[]} Processed output bytes
     */
    Result() {
      const result = [...this.outputBuffer];
      this.outputBuffer = [];
      return result;
    }

    /**
     * Reset cipher state (clear buffers)
     */
    Reset() {
      this.inputBuffer = [];
      this.outputBuffer = [];
    }

    /**
     * Encrypt single 64-bit block using Simon
     * @private
     * @param {uint8[]} blockBytes - 8-byte input block
     * @returns {uint8[]} 8-byte encrypted block
     * @throws {Error} If input not exactly 8 bytes
     */
    _encryptBlock(blockBytes) {
      if (blockBytes.length !== 8) {
        throw new Error('Simon: Input must be exactly 8 bytes');
      }

      // Simon uses little-endian byte ordering for 32-bit words  
      let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);

      // Simon encryption: 44 rounds of Feistel-like operations
      // Round function: (x, y) -> (y XOR F(x) XOR k_i, x)
      // where F(x) = ((x rotL 1) AND (x rotL 8)) XOR (x rotL 2)
      for (let i = 0; i < this.algorithm.ROUNDS; i++) {
        const temp = OpCodes.XorN(OpCodes.XorN(y, SimonCipher.roundFunction(x)), this.roundKeys[i]);
        y = x;
        x = temp;
      }

      // Convert back to bytes (little-endian)
      const xBytes = OpCodes.Unpack32LE(x);
      const yBytes = OpCodes.Unpack32LE(y);
      return [...xBytes, ...yBytes];
    }

    /**
     * Decrypt single 64-bit block using Simon
     * @private
     * @param {uint8[]} blockBytes - 8-byte input block
     * @returns {uint8[]} 8-byte decrypted block
     * @throws {Error} If input not exactly 8 bytes
     */
    _decryptBlock(blockBytes) {
      if (blockBytes.length !== 8) {
        throw new Error('Simon: Input must be exactly 8 bytes');
      }

      // Simon uses little-endian byte ordering for 32-bit words
      let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);

      // Simon decryption: reverse the encryption process
      // Inverse operations in reverse order:
      // (x, y) -> (y, x XOR F(y) XOR k_i)
      for (let i = this.algorithm.ROUNDS - 1; i >= 0; i--) {
        const temp = x;
        x = y;
        y = OpCodes.XorN(OpCodes.XorN(temp, SimonCipher.roundFunction(x)), this.roundKeys[i]);
      }

      // Convert back to bytes (little-endian)
      const xBytes = OpCodes.Unpack32LE(x);
      const yBytes = OpCodes.Unpack32LE(y);
      return [...xBytes, ...yBytes];
    }

    /**
     * Expand 128-bit key into 44 round keys using Simon key schedule
     * @private
     * @param {uint8[]} keyBytes - 16-byte master key
     * @returns {uint32[]} Array of 44 round keys
     */
    _expandKey(keyBytes) {
      // Simon64/128: Convert 128-bit key to four 32-bit words (little-endian)
      const k = [
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];

      // Expand key to 44 round keys using Simon key schedule
      const roundKeys = new Array(this.algorithm.ROUNDS);

      // Initialize first 4 round keys directly from master key
      for (let i = 0; i < this.algorithm.m; i++) {
        roundKeys[i] = k[i];
      }

      // Generate remaining round keys using Simon key schedule for m=4
      // k_i = c XOR (z3)_{i-m} XOR k_{i-m} XOR ((k_{i-1} rotR 3) XOR k_{i-3} XOR ((k_{i-1} rotR 3) XOR k_{i-3}) rotR 1)
      const c = 0xfffffffc;  // 2^32 - 4
      const z3Sequence = SimonCipher.getZ3Sequence();

      for (let i = this.algorithm.m; i < this.algorithm.ROUNDS; i++) {
        let tmp = OpCodes.RotR32(roundKeys[i - 1], 3);
        tmp = OpCodes.XorN(tmp, roundKeys[i - 3]);
        tmp = OpCodes.XorN(tmp, OpCodes.RotR32(tmp, 1));
        tmp = OpCodes.XorN(tmp, roundKeys[i - this.algorithm.m]);
        tmp = OpCodes.XorN(tmp, c);
        tmp = OpCodes.XorN(tmp, z3Sequence[i - this.algorithm.m]);

        roundKeys[i] = OpCodes.ToUint32(tmp);
      }

      return roundKeys;
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new SimonCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SimonCipher, SimonInstance };
}));