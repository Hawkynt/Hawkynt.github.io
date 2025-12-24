/*
 * Speck Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NSA's Speck cipher (2013) - ARX (Addition-Rotation-XOR) design
 * Speck64/128: 64-bit blocks with 128-bit keys, 27 rounds
 * Lightweight cipher optimized for software efficiency
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
   * Speck - NSA lightweight ARX block cipher (Addition-Rotation-XOR design)
   * 64-bit blocks with 128-bit keys using 27 rounds, optimized for software efficiency
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class SpeckCipher extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Speck";
      this.description = "NSA's lightweight ARX (Addition-Rotation-XOR) cipher designed for software efficiency. Speck64/128 variant uses 64-bit blocks with 128-bit keys and 27 rounds. Companion to Simon cipher.";
      this.inventor = "NSA (National Security Agency)";
      this.year = 2013;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.BASIC;
      this.country = AlgorithmFramework.CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // Speck64/128: 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("The Simon and Speck Families of Lightweight Block Ciphers", "https://eprint.iacr.org/2013/404.pdf"),
        new AlgorithmFramework.LinkItem("NSA Simon and Speck Specification", "https://nsacyber.github.io/simon-speck/"),
        new AlgorithmFramework.LinkItem("Lightweight Cryptography Standardization", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("NSA Reference Implementation", "https://github.com/nsacyber/simon-speck-supercop"),
        new AlgorithmFramework.LinkItem("Cryptanalysis of Speck variants", "https://eprint.iacr.org/2016/1010.pdf"),
        new AlgorithmFramework.LinkItem("NIST Lightweight Cryptography", "https://csrc.nist.gov/Projects/Lightweight-Cryptography")
      ];

      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Reduced-round attacks", "Various attacks exist against reduced-round variants (not full 27 rounds)", "Use full-round implementation and consider alternatives for high-security applications")
      ];

      // Test vectors from NSA specification
      this.tests = [
        {
          text: "Speck64/128 Test Vector #1",
          uri: "https://eprint.iacr.org/2013/404.pdf",
          input: OpCodes.Hex8ToBytes("656c69746e696874"),
          key: OpCodes.Hex8ToBytes("1f1e1d1c1b1a19181716151413121110"),
          expected: OpCodes.Hex8ToBytes("4af38b6198e31fa8")
        },
        {
          text: "Speck64/128 Test Vector #2 (zero key)",
          uri: "https://eprint.iacr.org/2013/404.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d54804682c692f27")
        }
      ];

      // Speck64/128 Constants
      this.ROUNDS = 27;       // NSA standard: 27 rounds for 64/128 variant
      this.ALPHA = 8;         // Right rotation constant
      this.BETA = 3;          // Left rotation constant
    }

    /**
     * Create new Speck cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {SpeckInstance} New Speck cipher instance
     */
    CreateInstance(isInverse = false) {
      return new SpeckInstance(this, isInverse);
    }
  }

  /**
   * Speck cipher instance implementing Feed/Result pattern with streaming capability
   * @class
   * @extends {IBlockCipherInstance}
   */
  class SpeckInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
     * Initialize Speck cipher instance
     * @param {SpeckCipher} algorithm - Parent algorithm instance
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
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
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
     * Encrypt single 64-bit block using Speck ARX operations
     * @private
     * @param {uint8[]} blockBytes - 8-byte input block
     * @returns {uint8[]} 8-byte encrypted block
     * @throws {Error} If input not exactly 8 bytes
     */
    _encryptBlock(blockBytes) {
      if (blockBytes.length !== 8) {
        throw new Error('Speck: Input must be exactly 8 bytes');
      }

      // Convert input to 32-bit words using OpCodes (little-endian for Speck)
      let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);

      // Speck encryption: 27 rounds of ARX operations
      // Round function based on NSA specification:
      // x = (ROR(x, 8) + y)^roundKey
      // y = ROL(y, 3)^x
      for (let i = 0; i < this.algorithm.ROUNDS; i++) {
        // Right rotate x by 8 bits, add y, then XOR with round key
        x = OpCodes.RotR32(x, this.algorithm.ALPHA);
        x = OpCodes.ToUint32(x + y);
        x = OpCodes.XorN(x, this.roundKeys[i]);

        // Left rotate y by 3 bits, then XOR with new x
        y = OpCodes.RotL32(y, this.algorithm.BETA);
        y = OpCodes.XorN(y, x);
      }

      // Convert back to bytes using OpCodes (little-endian)
      const result0 = OpCodes.Unpack32LE(x);
      const result1 = OpCodes.Unpack32LE(y);
      return [...result0, ...result1];
    }

    /**
     * Decrypt single 64-bit block using Speck ARX operations
     * @private
     * @param {uint8[]} blockBytes - 8-byte input block
     * @returns {uint8[]} 8-byte decrypted block
     * @throws {Error} If input not exactly 8 bytes
     */
    _decryptBlock(blockBytes) {
      if (blockBytes.length !== 8) {
        throw new Error('Speck: Input must be exactly 8 bytes');
      }

      // Convert input to 32-bit words using OpCodes (little-endian for Speck)
      let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);

      // Speck decryption: reverse the encryption process
      // Inverse operations in reverse order:
      // y = ROR(OpCodes.Xor32(y, x), 3)
      // x = ROL((OpCodes.Xor32(x, roundKey)) - y, 8)
      for (let i = this.algorithm.ROUNDS - 1; i >= 0; i--) {
        // Reverse: y = ROL(y, 3)^x
        y = OpCodes.XorN(y, x);
        y = OpCodes.RotR32(y, this.algorithm.BETA);

        // Reverse: x = (ROR(x, 8) + y)^roundKey
        x = OpCodes.XorN(x, this.roundKeys[i]);
        x = OpCodes.ToUint32(x - y);
        x = OpCodes.RotL32(x, this.algorithm.ALPHA);
      }

      // Convert back to bytes using OpCodes (little-endian)
      const result0 = OpCodes.Unpack32LE(x);
      const result1 = OpCodes.Unpack32LE(y);
      return [...result0, ...result1];
    }

    /**
     * Expand 128-bit key into 27 round keys using Speck key schedule
     * @private
     * @param {uint8[]} keyBytes - 16-byte master key
     * @returns {uint32[]} Array of 27 round keys
     */
    _expandKey(keyBytes) {
      // Convert 128-bit key to four 32-bit words using OpCodes (little-endian)
      // NSA Speck uses specific ordering: k3, k2, k1, k0 (reverse order)
      const k = [
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15]), // k3 -> k0
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),   // k2 -> k1  
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),     // k1 -> k2
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3])      // k0 -> k3
      ];

      // Expand key to 27 round keys using Speck key schedule
      const roundKeys = new Array(this.algorithm.ROUNDS);

      // Initialize first round key and working variables
      roundKeys[0] = k[0];  // First round key is k[0]
      let l = [k[1], k[2], k[3]];  // Key schedule working array

      // Generate remaining round keys using Speck key schedule
      // Key schedule uses same ARX structure as round function
      for (let i = 0; i < this.algorithm.ROUNDS - 1; i++) {
        // Apply round function to l[i % 3] and roundKeys[i]
        // l[i % 3] = (ROR(l[i % 3], 8) + roundKeys[i])^i
        const idx = i % 3;
        l[idx] = OpCodes.RotR32(l[idx], this.algorithm.ALPHA);
        l[idx] = OpCodes.ToUint32(l[idx] + roundKeys[i]);
        l[idx] = OpCodes.XorN(l[idx], i);

        // Generate next round key: roundKeys[i+1] = ROL(roundKeys[i], 3)^l[i % 3]
        roundKeys[i + 1] = OpCodes.XorN(OpCodes.RotL32(roundKeys[i], this.algorithm.BETA), l[idx]);
      }

      return roundKeys;
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new SpeckCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SpeckCipher, SpeckInstance };
}));