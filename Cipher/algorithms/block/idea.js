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

      // Test vectors from various sources
      this.tests = [
        {
          text: "IDEA all zeros test vector",
          uri: "Educational test vector",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("2542673a35551656")
        },
        {
          text: "IDEA incremental pattern test",
          uri: "Educational test vector",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("42165da87a584e0f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new IDEAInstance(this, isInverse);
    }
  }

  class IDEAInstance extends AlgorithmFramework.IBlockCipherInstance {
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
      this.encryptKeys = this._generateSubkeys(keyBytes);
      this.decryptKeys = this._generateDecryptSubkeys(this.encryptKeys);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

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
     * In IDEA, 0 represents 2^16 (65536) for multiplication
     */
    _mulMod(a, b) {
      a &= 0xFFFF;
      b &= 0xFFFF;

      // In IDEA, 0 represents 2^16 for multiplication
      if (a === 0) a = 0x10000;
      if (b === 0) b = 0x10000;

      // Perform multiplication modulo (2^16 + 1)
      const result = (a * b) % this.MODULUS;

      // Convert back: if result is 65536, return 0
      return result === 0x10000 ? 0 : result;
    }

    /**
     * Modular inverse for multiplication mod (2^16 + 1)
     */
    _modInverse(x) {
      x &= 0xFFFF;

      // Special case: inverse of 0 (representing 2^16) is 0
      if (x === 0) return 0;

      // Extended Euclidean algorithm
      let u1 = this.MODULUS;
      let u2 = 0;
      let u3 = x;
      let v1 = 0;
      let v2 = 1;
      let v3 = this.MODULUS;

      while (v3 !== 0) {
        const q = Math.floor(u3 / v3);
        const t1 = u1 - q * v1;
        const t2 = u2 - q * v2;
        const t3 = u3 - q * v3;

        u1 = v1; u2 = v2; u3 = v3;
        v1 = t1; v2 = t2; v3 = t3;
      }

      let result = u1;
      if (result < 0) result += this.MODULUS;

      return result & 0xFFFF;
    }

    /**
     * Additive inverse modulo 2^16
     */
    _addInverse(x) {
      x &= 0xFFFF;
      return x === 0 ? 0 : (0x10000 - x) & 0xFFFF;
    }

    /**
     * Generate 52 subkeys from 128-bit master key
     */
    _generateSubkeys(key) {
      const subkeys = new Array(this.TOTAL_SUBKEYS);

      // Convert key to 16-bit words (8 words from 16 bytes, big-endian)
      const keyWords = [];
      for (let i = 0; i < 8; i++) {
        keyWords[i] = (key[i * 2] << 8) | key[i * 2 + 1];
      }

      // First 8 subkeys are the original key words
      for (let i = 0; i < 8; i++) {
        subkeys[i] = keyWords[i];
      }

      // Generate remaining 44 subkeys using IDEA's key schedule
      let keySchedule = [...keyWords]; // Working copy of key words

      for (let group = 1; group < 7; group++) { // 6 more groups needed
        // Rotate 128-bit key left by 25 bits
        const temp = [...keySchedule];

        // Rotate each word left by 25 bits within the 128-bit context
        for (let i = 0; i < 8; i++) {
          const word1Index = (i + 1) % 8; // Next word (25-bit rotation)
          const word2Index = (i + 2) % 8; // Word after that

          keySchedule[i] = ((temp[word1Index] << 9) | (temp[word2Index] >>> 7)) & 0xFFFF;
        }

        // Copy up to 8 keys from this rotated schedule
        const startIndex = group * 8;
        for (let i = 0; i < 8 && startIndex + i < this.TOTAL_SUBKEYS; i++) {
          subkeys[startIndex + i] = keySchedule[i];
        }
      }

      return subkeys;
    }

    /**
     * Generate decryption subkeys from encryption subkeys
     */
    _generateDecryptSubkeys(encryptKeys) {
      const decryptKeys = new Array(this.TOTAL_SUBKEYS);

      // Generate decryption keys following reference implementation pattern
      for (let i = 0; i < 52; i += 6) {
        // First subkey: multiplicative inverse
        decryptKeys[i] = this._modInverse(encryptKeys[48 - i]);

        // Second and third subkeys: additive inverses (swapped except for first/last)
        if (i === 0 || i === 48) {
          decryptKeys[i + 1] = this._addInverse(encryptKeys[49 - i]);
          decryptKeys[i + 2] = this._addInverse(encryptKeys[50 - i]);
        } else {
          decryptKeys[i + 1] = this._addInverse(encryptKeys[50 - i]);
          decryptKeys[i + 2] = this._addInverse(encryptKeys[49 - i]);
        }

        // Fourth subkey: multiplicative inverse
        decryptKeys[i + 3] = this._modInverse(encryptKeys[51 - i]);

        // Fifth and sixth subkeys: direct copy (MA-box keys)
        if (i < 48) {
          decryptKeys[i + 4] = encryptKeys[46 - i];
          decryptKeys[i + 5] = encryptKeys[47 - i];
        }
      }

      return decryptKeys;
    }

    /**
     * IDEA encryption/decryption engine
     */
    _processBlock(block, subkeys) {
      // Split input into four 16-bit words
      let X1 = (block[0] << 8) | block[1];
      let X2 = (block[2] << 8) | block[3];
      let X3 = (block[4] << 8) | block[5];
      let X4 = (block[6] << 8) | block[7];

      // 8 full rounds
      for (let round = 0; round < this.ROUNDS; round++) {
        const keyOffset = round * 6;

        // Step 1: Multiply and add
        X1 = this._mulMod(X1, subkeys[keyOffset]);
        X2 = OpCodes.AddMod(X2, subkeys[keyOffset + 1], 0x10000);
        X3 = OpCodes.AddMod(X3, subkeys[keyOffset + 2], 0x10000);
        X4 = this._mulMod(X4, subkeys[keyOffset + 3]);

        // Step 2: MA structure (Multiplication-Addition)
        const T1 = X1 ^ X3;
        const T2 = X2 ^ X4;
        const T3 = this._mulMod(T1, subkeys[keyOffset + 4]);
        const T4 = OpCodes.AddMod(T2, T3, 0x10000);
        const T5 = this._mulMod(T4, subkeys[keyOffset + 5]);
        const T6 = OpCodes.AddMod(T3, T5, 0x10000);

        // Step 3: Final XOR and rearrangement
        const Y1 = X1 ^ T5;
        const Y2 = X3 ^ T5;
        const Y3 = X2 ^ T6;
        const Y4 = X4 ^ T6;

        // Prepare for next round (swap middle two words)
        X1 = Y1;
        X2 = Y3;
        X3 = Y2;
        X4 = Y4;
      }

      // Final half-round (no swapping)
      const finalOffset = this.ROUNDS * 6;
      X1 = this._mulMod(X1, subkeys[finalOffset]);
      X2 = OpCodes.AddMod(X2, subkeys[finalOffset + 1], 0x10000);
      X3 = OpCodes.AddMod(X3, subkeys[finalOffset + 2], 0x10000);
      X4 = this._mulMod(X4, subkeys[finalOffset + 3]);

      // Convert back to byte array
      return [
        (X1 >>> 8) & 0xFF, X1 & 0xFF,
        (X2 >>> 8) & 0xFF, X2 & 0xFF,
        (X3 >>> 8) & 0xFF, X3 & 0xFF,
        (X4 >>> 8) & 0xFF, X4 & 0xFF
      ];
    }

    // Encrypt a 64-bit block
    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }

      return this._processBlock(block, this.encryptKeys);
    }

    // Decrypt a 64-bit block
    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('IDEA block size must be exactly 8 bytes');
      }

      return this._processBlock(block, this.decryptKeys);
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