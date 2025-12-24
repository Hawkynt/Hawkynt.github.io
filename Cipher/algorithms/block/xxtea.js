/*
 * XXTEA (Corrected Block TEA) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * XXTEA Algorithm by Roger Needham and David Wheeler (1998)
 * - Variable block size cipher (minimum 8 bytes, maximum 1024 bytes)
 * - 128-bit keys with improved key schedule
 * - Better diffusion across entire variable-length blocks
 * - Uses same golden ratio constant: 0x9E3779B9
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

  class XXTEAAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XXTEA";
      this.description = "Corrected Block TEA by Needham and Wheeler with variable block sizes and enhanced security over TEA/XTEA. Supports blocks from 8 bytes to 1KB with 128-bit keys and improved diffusion.";
      this.inventor = "Roger Needham, David Wheeler";
      this.year = 1998;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.GB;

      // Block and key specifications
      this.blockSize = 8; // Minimum block size (variable)
      this.keySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit key
      ];

      // AlgorithmFramework compatibility
      this.SupportedKeySizes = [new AlgorithmFramework.KeySize(16, 16, 1)]; // Fixed 128-bit key
      this.SupportedBlockSizes = [new AlgorithmFramework.KeySize(8, 1024, 4)]; // Variable block size (8 bytes to 1KB, 4-byte steps)

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("Block TEA corrections and improvements", "https://www.cix.co.uk/~klockstone/xxtea.htm"),
        new AlgorithmFramework.LinkItem("Variable block cipher design", "https://link.springer.com/chapter/10.1007/3-540-60590-8_29"),
        new AlgorithmFramework.LinkItem("Cambridge Cryptography Research", "https://www.cl.cam.ac.uk/research/security/")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Crypto++ XXTEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/tea.cpp"),
        new AlgorithmFramework.LinkItem("Node.js XXTEA Implementation", "https://www.npmjs.com/package/xxtea"),
        new AlgorithmFramework.LinkItem("Python XXTEA Implementation", "https://pypi.org/project/xxtea/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Limited standardization", "https://www.schneier.com/academic/", "Not widely standardized or analyzed compared to modern ciphers", "Use standardized ciphers like AES for production security applications"),
        new AlgorithmFramework.Vulnerability("Variable block complexity", "https://eprint.iacr.org/", "Variable block sizes may introduce implementation complexities and edge cases", "Careful implementation and testing required for security-critical applications")
      ];

      // Test vectors from verified Crypt-XXTEA implementation
      this.tests = [
        {
          text: "XXTEA 8-byte block - all zeros",
          uri: "https://github.com/an0maly/Crypt-XXTEA/blob/master/t/test-vectors.t",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ab043705808c5d57")
        },
        {
          text: "XXTEA 8-byte block - mixed key",
          uri: "https://github.com/an0maly/Crypt-XXTEA/blob/master/t/test-vectors.t",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0102040810204080fffefcf8f0e0c080"),
          expected: OpCodes.Hex8ToBytes("d1e78be2c746728a")
        },
        {
          text: "XXTEA 8-byte block - all ones plaintext",
          uri: "https://github.com/an0maly/Crypt-XXTEA/blob/master/t/test-vectors.t",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("9e3779b99b9773e9b979379e6b695156"),
          expected: OpCodes.Hex8ToBytes("67ed0ea8e8973fc5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XXTEAInstance(this, isInverse);
    }
  }

  /**
 * XXTEA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XXTEAInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8; // Minimum block size
      this.KeySize = 0;

      // XXTEA constants
      this.DELTA = 0x9E3779B9; // Magic constant: OpCodes.Xor32(2, 32) / golden ratio
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
        return;
      }

      // Validate key size (must be 16 bytes)
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. XXTEA requires exactly 16 bytes`);
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

      // Validate input length (must be multiple of 4 bytes and at least 8 bytes)
      if (this.inputBuffer.length < 8 || this.inputBuffer.length % 4 !== 0) {
        throw new Error(`Input length must be at least 8 bytes and multiple of 4 bytes. Got ${this.inputBuffer.length} bytes`);
      }

      const output = this.isInverse
        ? this._decryptData(this.inputBuffer)
        : this._encryptData(this.inputBuffer);

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Encrypt variable-length data
    _encryptData(data) {
      // Convert key to 32-bit words (little-endian for XXTEA)
      const keyWords = this._getKeyWords();

      // Convert to 32-bit words using OpCodes (little-endian for XXTEA)
      const words = [];
      for (let i = 0; i < data.length; i += 4) {
        words.push(OpCodes.Pack32LE(data[i], data[i+1], data[i+2], data[i+3]));
      }

      // XXTEA encryption algorithm
      const encryptedWords = this._encryptWords(words, keyWords);

      // Convert back to bytes using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < encryptedWords.length; i++) {
        const bytes = OpCodes.Unpack32LE(encryptedWords[i]);
        result.push(...bytes);
      }

      return result;
    }

    // Decrypt variable-length data
    _decryptData(data) {
      // Convert key to 32-bit words (little-endian for XXTEA)
      const keyWords = this._getKeyWords();

      // Convert to 32-bit words using OpCodes (little-endian for XXTEA)
      const words = [];
      for (let i = 0; i < data.length; i += 4) {
        words.push(OpCodes.Pack32LE(data[i], data[i+1], data[i+2], data[i+3]));
      }

      // XXTEA decryption algorithm
      const decryptedWords = this._decryptWords(words, keyWords);

      // Convert back to bytes using OpCodes (little-endian)
      const result = [];
      for (let i = 0; i < decryptedWords.length; i++) {
        const bytes = OpCodes.Unpack32LE(decryptedWords[i]);
        result.push(...bytes);
      }

      return result;
    }

    // Get key as 32-bit words
    _getKeyWords() {
      return [
        OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15])
      ];
    }

    // Internal XXTEA encryption algorithm
    _encryptWords(v, k) {
      const n = v.length;
      if (n < 2) return v; // Need at least 2 words

      // Copy input to avoid modification
      const words = OpCodes.CopyArray(v);

      // Calculate number of rounds: 6 + 52/n (minimum 6 rounds)
      const rounds = 6 + Math.floor(52 / n);
      let sum = 0;
      let z = words[n-1];

      for (let round = 0; round < rounds; round++) {
        sum = OpCodes.Shr32((sum + this.DELTA), 0);
        const e = OpCodes.AndN(OpCodes.Shr32(sum, 2), 3);

        for (let p = 0; p < n; p++) {
          const y = words[(p + 1) % n];
          const mx = this._calculateMX(z, y, sum, k[OpCodes.XorN(OpCodes.AndN(p, 3), e)], p, e);
          words[p] = OpCodes.Shr32((words[p] + mx), 0);
          z = words[p];
        }
      }

      return words;
    }

    // Internal XXTEA decryption algorithm
    _decryptWords(v, k) {
      const n = v.length;
      if (n < 2) return v; // Need at least 2 words

      // Copy input to avoid modification
      const words = OpCodes.CopyArray(v);

      // Calculate number of rounds: 6 + 52/n (minimum 6 rounds)
      const rounds = 6 + Math.floor(52 / n);
      let sum = OpCodes.Shr32((rounds * this.DELTA), 0);
      let y = words[0];

      for (let round = 0; round < rounds; round++) {
        const e = OpCodes.AndN(OpCodes.Shr32(sum, 2), 3);

        for (let p = n - 1; p >= 0; p--) {
          const z = words[p > 0 ? p - 1 : n - 1];
          const mx = this._calculateMX(z, y, sum, k[OpCodes.XorN(OpCodes.AndN(p, 3), e)], p, e);
          words[p] = OpCodes.Shr32((words[p] - mx), 0);
          y = words[p];
        }

        sum = OpCodes.Shr32((sum - this.DELTA), 0);
      }

      return words;
    }

    // Calculate the MX value for XXTEA round function
    _calculateMX(z, y, sum, key, p, e) {
      // Original XXTEA MX calculation with improved bit operations
      const part1 = OpCodes.Shr32(OpCodes.XorN(OpCodes.Shr32(z, 5), OpCodes.Shl32(y, 2)), 0);
      const part2 = OpCodes.Shr32(OpCodes.XorN(OpCodes.Shr32(y, 3), OpCodes.Shl32(z, 4)), 0);
      const part3 = OpCodes.Shr32(OpCodes.XorN(sum, y), 0);
      const part4 = OpCodes.Shr32(OpCodes.XorN(key, z), 0);

      return OpCodes.Shr32(OpCodes.XorN((part1 + part2), (part3 + part4)), 0);
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new XXTEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XXTEAAlgorithm, XXTEAInstance };
}));