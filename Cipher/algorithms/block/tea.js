/*
 * TEA (Tiny Encryption Algorithm) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Implements the Tiny Encryption Algorithm by David Wheeler and Roger Needham (1994).
 * 64-bit blocks with 128-bit keys using 32 rounds.
 * Educational implementation - known cryptographic weaknesses make it unsuitable for production.
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
   * TEA (Tiny Encryption Algorithm) - Educational block cipher implementation
   * 64-bit blocks with 128-bit keys using 32 rounds of simple XOR, shift, and add operations
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class TEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "TEA";
      this.description = "Tiny Encryption Algorithm with 64-bit blocks and 128-bit keys using simple XOR, shift, and add operations. Fast but has known cryptanalytic weaknesses.";
      this.inventor = "David Wheeler, Roger Needham";
      this.year = 1994;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.GB;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("TEA: A Tiny Encryption Algorithm", "https://www.cix.co.uk/~klockstone/tea.htm"),
        new LinkItem("Cambridge Computer Laboratory TEA", "https://www.cl.cam.ac.uk/teaching/1415/SecurityII/tea.pdf"),
        new LinkItem("Original TEA Paper", "https://link.springer.com/chapter/10.1007/3-540-60590-8_29")
      ];

      this.references = [
        new LinkItem("Crypto++ TEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/tea.cpp"),
        new LinkItem("Bouncy Castle TEA Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines"),
        new LinkItem("TEA Cryptanalysis Papers", "https://eprint.iacr.org/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Related-key attacks",
          "TEA is vulnerable to related-key attacks due to weak key schedule",
          "Use XTEA or modern ciphers like AES instead"
        ),
        new Vulnerability(
          "Equivalent keys",
          "Multiple keys can encrypt to the same ciphertext",
          "Algorithm is obsolete - use modern alternatives"
        )
      ];

      // Test vectors from TEA specification
      this.tests = [
        {
          text: "TEA All Zeros Test Vector",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("41EA3A0A94BAA940")
        },
        {
          text: "TEA All Ones Test Vector",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          key: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          expected: OpCodes.Hex8ToBytes("319BBEFB016ABDB2")
        },
        {
          text: "TEA Sequential Pattern Test",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
          expected: OpCodes.Hex8ToBytes("17B5BA5198581091")
        },
        {
          text: "TEA ASCII Test Vector",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: OpCodes.AnsiToBytes("HELLO123"),
          key: OpCodes.AnsiToBytes("YELLOW SUBMARINE"),
          expected: OpCodes.Hex8ToBytes("7ADC06304F85383E")
        },
        {
          text: "TEA Single Bit Key Test",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          expected: OpCodes.Hex8ToBytes("0C6D2A1D930C3FAB")
        }
      ];
    }

    /**
     * Create a new instance of the TEA cipher
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {TEAInstance} New TEA cipher instance
     */
    CreateInstance(isInverse = false) {
      return new TEAInstance(this, isInverse);
    }
  }

  /**
   * TEA cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IBlockCipherInstance}
   */
  class TEAInstance extends IBlockCipherInstance {
    /**
     * Initialize TEA cipher instance
     * @param {TEAAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // TEA constants
      this.DELTA = OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("9E3779B9")); // Magic constant (OpCodes.Xor32(2, 32) / golden ratio)
      this.ROUNDS = 32;        // Standard TEA uses 32 rounds
    }

    /**
     * Set encryption/decryption key
     * @param {uint8[]|null} keyBytes - 128-bit (16-byte) key or null to clear
     * @throws {Error} If key size is not exactly 16 bytes
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (must be 16 bytes)
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. TEA requires exactly 16 bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Feed data to cipher for encryption/decryption
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

    /**
     * Encrypt single 64-bit block using TEA algorithm
     * @private
     * @param {uint8[]} block - 8-byte input block
     * @returns {uint8[]} 8-byte encrypted block
     */
    _encryptBlock(block) {
      // Convert block to two 32-bit words (big-endian)
      let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // Extract key as four 32-bit words (big-endian)
      const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
      const k1 = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
      const k2 = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
      const k3 = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

      let sum = 0;

      // 32 rounds of TEA encryption
      for (let i = 0; i < this.ROUNDS; i++) {
        sum = OpCodes.ToUint32(sum + this.DELTA);
        v0 = OpCodes.ToUint32(v0 + OpCodes.XorN(OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.Shl32(v1, 4) + k0),
          OpCodes.ToUint32(v1 + sum)),
          OpCodes.ToUint32(OpCodes.Shr32(v1, 5) + k1)));
        v1 = OpCodes.ToUint32(v1 + OpCodes.XorN(OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.Shl32(v0, 4) + k2),
          OpCodes.ToUint32(v0 + sum)),
          OpCodes.ToUint32(OpCodes.Shr32(v0, 5) + k3)));
      }

      // Convert back to bytes
      const v0Bytes = OpCodes.Unpack32BE(v0);
      const v1Bytes = OpCodes.Unpack32BE(v1);

      return [...v0Bytes, ...v1Bytes];
    }

    /**
     * Decrypt single 64-bit block using TEA algorithm
     * @private
     * @param {uint8[]} block - 8-byte input block
     * @returns {uint8[]} 8-byte decrypted block
     */
    _decryptBlock(block) {
      // Convert block to two 32-bit words (big-endian)
      let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // Extract key as four 32-bit words (big-endian)
      const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
      const k1 = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
      const k2 = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
      const k3 = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

      let sum = OpCodes.ToUint32(this.DELTA * this.ROUNDS);

      // 32 rounds of TEA decryption (reverse order)
      for (let i = 0; i < this.ROUNDS; i++) {
        v1 = OpCodes.ToUint32(v1 - OpCodes.XorN(OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.Shl32(v0, 4) + k2),
          OpCodes.ToUint32(v0 + sum)),
          OpCodes.ToUint32(OpCodes.Shr32(v0, 5) + k3)));
        v0 = OpCodes.ToUint32(v0 - OpCodes.XorN(OpCodes.XorN(
          OpCodes.ToUint32(OpCodes.Shl32(v1, 4) + k0),
          OpCodes.ToUint32(v1 + sum)),
          OpCodes.ToUint32(OpCodes.Shr32(v1, 5) + k1)));
        sum = OpCodes.ToUint32(sum - this.DELTA);
      }

      // Convert back to bytes
      const v0Bytes = OpCodes.Unpack32BE(v0);
      const v1Bytes = OpCodes.Unpack32BE(v1);

      return [...v0Bytes, ...v1Bytes];
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new TEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TEAAlgorithm, TEAInstance };
}));