/*
 * IDEA (International Data Encryption Algorithm) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * IDEA Algorithm by Xuejia Lai and James L. Massey (1991)
 * - 64-bit block size, 128-bit key size
 * - Uses 8 full rounds + final half-round with Lai-Massey structure
 * - Three operations: XOR (⊕), addition mod 2^16 (+), multiplication mod (2^16 + 1) (⊙)
 * - Patent expired in 2011, now freely usable
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
 * IDEAAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class IDEAAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "IDEA";
      this.description = "International Data Encryption Algorithm by Lai and Massey. Uses Lai-Massey structure with three operations: XOR, addition mod 2^16, and multiplication mod (2^16+1). Patent expired 2011.";
      this.inventor = "Xuejia Lai, James L. Massey";
      this.year = 1991;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.CH;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit key
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("IDEA Algorithm Specification", "https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm"),
        new AlgorithmFramework.LinkItem("Original Academic Paper", "https://link.springer.com/chapter/10.1007/3-540-46877-3_35"),
        new AlgorithmFramework.LinkItem("Applied Cryptography - IDEA", "https://www.schneier.com/books/applied_cryptography/")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("OpenSSL IDEA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/idea/"),
        new AlgorithmFramework.LinkItem("Crypto++ IDEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/idea.cpp"),
        new AlgorithmFramework.LinkItem("Bouncy Castle IDEA Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Patent History", "https://patents.google.com/patent/US5214703A", "Algorithm was patented until 2011, limiting adoption. Patent-free since 2011.", "Use AES for new applications requiring standardized algorithms")
      ];

      // Test vectors from NESSIE IDEA ECB test vectors
      this.tests = [
        {
          text: "NESSIE IDEA ECB test vector - all zeros",
          uri: "https://raw.githubusercontent.com/pyca/cryptography/main/vectors/cryptography_vectors/ciphers/IDEA/idea-ecb.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0001000100000000")
        },
        {
          text: "NESSIE IDEA ECB test vector - high bit plaintext",
          uri: "https://raw.githubusercontent.com/pyca/cryptography/main/vectors/cryptography_vectors/ciphers/IDEA/idea-ecb.txt",
          input: OpCodes.Hex8ToBytes("8000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8001000180008000")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new IDEAInstance(this, isInverse);
    }
  }

  /**
 * IDEA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class IDEAInstance extends AlgorithmFramework.IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.encryptKeys = null;
      this.decryptKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;

      // IDEA constants
      this.ROUNDS = 8;
      this.TOTAL_SUBKEYS = 52; // (8 * 6) + 4
      this.MODULUS = 0x10001;  // 2^16 + 1
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.encryptKeys = null;
        this.decryptKeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Generate encryption and decryption subkeys
      this.encryptKeys = this._expandKey(keyBytes);
      this.decryptKeys = this._invertKey(this.encryptKeys);
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

    /**
     * Multiplication modulo (2^16 + 1) - IDEA's special operation
     * Based on Bouncy Castle implementation
     * In IDEA, 0 represents 2^16 (65536) for multiplication
     */
    _mulMod(x, y) {
      const BASE = 0x10001;
      const MASK = 0xFFFF;
      
      if (x === 0) {
        x = BASE - y;
      } else if (y === 0) {
        x = BASE - x;
      } else {
        const p = x * y;
        y = p & MASK;
        x = (p >>> 16); // Use unsigned right shift
        x = y - x + ((y < x) ? 1 : 0);
      }
      return x & MASK;
    }

    /**
     * Modular inverse for multiplication mod (2^16 + 1)
     * Based on Bouncy Castle MulInv implementation
     */
    _mulInv(x) {
      const BASE = 0x10001;
      const MASK = 0xFFFF;
      
      if (x < 2) return x;
      
      let t0 = 1;
      let t1 = Math.floor(BASE / x);
      let y = BASE % x;
      
      while (y !== 1) {
        const q = Math.floor(x / y);
        x = x % y;
        t0 = (t0 + (t1 * q)) & MASK;
        
        if (x === 1) return t0;
        
        const q2 = Math.floor(y / x);
        y = y % x;
        t1 = (t1 + (t0 * q2)) & MASK;
      }
      
      return (1 - t1) & MASK;
    }

    /**
     * Additive inverse modulo 2^16
     * Based on Bouncy Castle AddInv implementation
     */
    _addInv(x) {
      const MASK = 0xFFFF;
      return (0 - x) & MASK;
    }

    /**
     * Generate 52 subkeys from 128-bit master key
     * Based on Bouncy Castle ExpandKey implementation
     */
    _expandKey(uKey) {
      const key = new Array(52);
      const MASK = 0xFFFF;
      
      // Pad key if needed (though IDEA requires exactly 16 bytes)
      if (uKey.length < 16) {
        const tmp = new Array(16).fill(0);
        for (let i = 0; i < uKey.length; i++) {
          tmp[tmp.length - uKey.length + i] = uKey[i];
        }
        uKey = tmp;
      }
      
      // Extract first 8 subkeys directly from user key (big-endian)
      for (let i = 0; i < 8; i++) {
        key[i] = OpCodes.Pack16BE(uKey[i * 2], uKey[i * 2 + 1]);
      }
      
      // Generate remaining subkeys using IDEA key schedule
      // Note: These bit operations are part of IDEA's key schedule algorithm
      // and combine bits from different key values - not suitable for OpCodes replacement
      for (let i = 8; i < 52; i++) {
        if ((i & 7) < 6) {
          key[i] = ((key[i - 7] & 127) << 9 | key[i - 6] >>> 7) & MASK;
        } else if ((i & 7) === 6) {
          key[i] = ((key[i - 7] & 127) << 9 | key[i - 14] >>> 7) & MASK;
        } else {
          key[i] = ((key[i - 15] & 127) << 9 | key[i - 14] >>> 7) & MASK;
        }
      }
      
      return key;
    }

    /**
     * Generate decryption subkeys from encryption subkeys
     * Based on Bouncy Castle InvertKey implementation
     */
    _invertKey(inKey) {
      const key = new Array(52);
      let inOff = 0;
      let p = 52; // Work backwards
      
      // First round
      let t1 = this._mulInv(inKey[inOff++]);
      let t2 = this._addInv(inKey[inOff++]);
      let t3 = this._addInv(inKey[inOff++]);
      let t4 = this._mulInv(inKey[inOff++]);
      key[--p] = t4;
      key[--p] = t3;
      key[--p] = t2;
      key[--p] = t1;
      
      // Rounds 2-8
      for (let round = 1; round < 8; round++) {
        t1 = inKey[inOff++];
        t2 = inKey[inOff++];
        key[--p] = t2;
        key[--p] = t1;
        
        t1 = this._mulInv(inKey[inOff++]);
        t2 = this._addInv(inKey[inOff++]);
        t3 = this._addInv(inKey[inOff++]);
        t4 = this._mulInv(inKey[inOff++]);
        key[--p] = t4;
        key[--p] = t2; // NB: Order - t2 and t3 are swapped!
        key[--p] = t3;
        key[--p] = t1;
      }
      
      // Final half-round
      t1 = inKey[inOff++];
      t2 = inKey[inOff++];
      key[--p] = t2;
      key[--p] = t1;
      
      t1 = this._mulInv(inKey[inOff++]);
      t2 = this._addInv(inKey[inOff++]);
      t3 = this._addInv(inKey[inOff++]);
      t4 = this._mulInv(inKey[inOff]);
      key[--p] = t4;
      key[--p] = t3;
      key[--p] = t2;
      key[--p] = t1;
      
      return key;
    }

    /**
     * IDEA encryption/decryption engine
     * Based on Bouncy Castle IdeaFunc implementation
     */
    _ideaFunc(workingKey, input, output) {
      const MASK = 0xFFFF;
      
      // Extract four 16-bit words (big-endian)
      let x0 = OpCodes.Pack16BE(input[0], input[1]);
      let x1 = OpCodes.Pack16BE(input[2], input[3]);
      let x2 = OpCodes.Pack16BE(input[4], input[5]);
      let x3 = OpCodes.Pack16BE(input[6], input[7]);
      
      let keyOff = 0;
      
      // 8 rounds
      for (let round = 0; round < 8; round++) {
        x0 = this._mulMod(x0, workingKey[keyOff++]);
        x1 += workingKey[keyOff++];
        x1 &= MASK;
        x2 += workingKey[keyOff++];
        x2 &= MASK;
        x3 = this._mulMod(x3, workingKey[keyOff++]);
        
        const t0 = x1;
        const t1 = x2;
        x2 ^= x0;
        x1 ^= x3;
        x2 = this._mulMod(x2, workingKey[keyOff++]);
        x1 += x2;
        x1 &= MASK;
        x1 = this._mulMod(x1, workingKey[keyOff++]);
        x2 += x1;
        x2 &= MASK;
        x0 ^= x1;
        x3 ^= x2;
        x1 ^= t1;
        x2 ^= t0;
      }
      
      // Final transformation
      const result = [
        this._mulMod(x0, workingKey[keyOff++]) & 0xFFFF,
        (x2 + workingKey[keyOff++]) & MASK, // NB: Order - x2 and x1 swapped
        (x1 + workingKey[keyOff++]) & MASK,
        this._mulMod(x3, workingKey[keyOff]) & 0xFFFF
      ];
      
      // Convert back to bytes (big-endian)
      const bytes0 = OpCodes.Unpack16BE(result[0]);
      const bytes1 = OpCodes.Unpack16BE(result[1]);
      const bytes2 = OpCodes.Unpack16BE(result[2]);
      const bytes3 = OpCodes.Unpack16BE(result[3]);

      output[0] = bytes0[0];
      output[1] = bytes0[1];
      output[2] = bytes1[0];
      output[3] = bytes1[1];
      output[4] = bytes2[0];
      output[5] = bytes2[1];
      output[6] = bytes3[0];
      output[7] = bytes3[1];
      
      return output;
    }

    // Encrypt a 64-bit block
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }

      const output = new Array(8);
      return this._ideaFunc(this.encryptKeys, block, output);
    }

    // Decrypt a 64-bit block
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }

      const output = new Array(8);
      return this._ideaFunc(this.decryptKeys, block, output);
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new IDEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { IDEAAlgorithm, IDEAInstance };
}));