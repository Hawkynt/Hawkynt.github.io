/*
 * Tnepres Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Tnepres is based on Serpent by Anderson, Biham, and Knudsen
 * - 128-bit block size, variable key length (128, 192, 256 bits)
 * - 32 rounds with 8 different 4x4 S-boxes
 * - Byte-swapped version of Serpent (big-endian vs little-endian)
 * - Result of endianness confusion in original AES submission test vectors
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

  class TnepresAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Tnepres";
      this.description = "Tnepres is a 128-bit 32-round block cipher based on Serpent. Due to endianness confusion in AES submission test vectors, Tnepres is a byte-swapped version using big-endian byte order instead of little-endian.";
      this.inventor = "Ross Anderson, Eli Biham, Lars Knudsen";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Historical interest - use Serpent instead
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.GB;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // 128/192/256-bit
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Serpent Algorithm Specification", "https://www.cl.cam.ac.uk/~rja14/serpent.html"),
        new LinkItem("BouncyCastle Tnepres Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/TnepresEngine.java")
      ];

      this.references = [
        new LinkItem("BouncyCastle Serpent Base", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/SerpentEngineBase.java"),
        new LinkItem("Serpent vs Tnepres Explanation", "https://www.cl.cam.ac.uk/~rja14/serpent.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Endianness Confusion", "https://www.cl.cam.ac.uk/~rja14/serpent.html", "Tnepres resulted from byte order confusion in original AES submission. Use Serpent for production.", "Use corrected Serpent cipher instead of Tnepres")
      ];

      // Test vectors from BouncyCastle TnepresTest.java
      this.tests = [
        {
          text: "Tnepres test vector #1 (256-bit key, zero plaintext)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8910494504181950f98dd998a82b6749")
        },
        {
          text: "Tnepres test vector #2 (128-bit key, bit 0 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("10b5ffb720b8cb9002a1142b0ba2e94a")
        },
        {
          text: "Tnepres test vector #3 (128-bit key, bit 39 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000008000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("4f057a42d8d5bd9746e434680ddcd5e5")
        },
        {
          text: "Tnepres test vector #4 (128-bit key, bit 63 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000400000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("99407bf8582ef12550886ef5b6f169b9")
        },
        {
          text: "Tnepres test vector #5 (192-bit key, bit 0 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("40000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d522a3b8d6d89d4d2a124fdd88f36896")
        },
        {
          text: "Tnepres test vector #6 (192-bit key, bit 74 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000200000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("189b8ec3470085b3da97e82ca8964e32")
        },
        {
          text: "Tnepres test vector #7 (192-bit key, bit 67 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000008000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f77d868cf760b9143a89809510ccb099")
        },
        {
          text: "Tnepres test vector #8 (256-bit key, bit 4 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("08000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d43b7b981b829342fce0e3ec6f5f4c82")
        },
        {
          text: "Tnepres test vector #9 (256-bit key, bit 71 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000100000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0bf30e1a0c33ccf6d5293177886912a7")
        },
        {
          text: "Tnepres test vector #10 (256-bit key, bit 127 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6a7f3b805d2ddcba49b89770ade5e507")
        },
        {
          text: "Tnepres test vector #11 (128-bit key bit 0 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("49afbfad9d5a34052cd8ffa5986bd2dd")
        },
        {
          text: "Tnepres test vector #12 (192-bit key bit 86 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000004000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ba8829b1de058c4b48615d851fc74f17")
        },
        {
          text: "Tnepres test vector #13 (256-bit key bit 199 set)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/TnepresTest.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000100000000"),
          expected: OpCodes.Hex8ToBytes("89f64377bf1e8a46c8247044e8056a98")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new TnepresInstance(this, isInverse);
    }
  }

  class TnepresInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;

      // Serpent/Tnepres constants
      this.ROUNDS = 32;
      this.PHI = 0x9e3779b9; // Golden ratio constant for key schedule

      // Temporary registers for S-box operations
      this.X = [0, 0, 0, 0];
    }

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

      // Generate round keys
      this.roundKeys = this._generateKeySchedule(keyBytes);
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

      // Process each 16-byte block
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

    // S-box implementations (same as Serpent/SerpentEngineBase from BouncyCastle)
    // S0 - { 3, 8,15, 1,10, 6, 5,11,14,13, 4, 2, 7, 0, 9,12 }
    _sb0(a, b, c, d) {
      const t1 = a ^ d;
      const t3 = c ^ t1;
      const t4 = b ^ t3;
      this.X[3] = (a & d) ^ t4;
      const t7 = a ^ (b & t1);
      this.X[2] = t4 ^ (c | t7);
      const t12 = this.X[3] & (t3 ^ t7);
      this.X[1] = (~t3) ^ t12;
      this.X[0] = t12 ^ (~t7);
    }

    // InvS0 - {13, 3,11, 0,10, 6, 5,12, 1,14, 4, 7,15, 9, 8, 2 }
    _ib0(a, b, c, d) {
      const t1 = ~a;
      const t2 = a ^ b;
      const t4 = d ^ (t1 | t2);
      const t5 = c ^ t4;
      this.X[2] = t2 ^ t5;
      const t8 = t1 ^ (d & t2);
      this.X[1] = t4 ^ (this.X[2] & t8);
      this.X[3] = (a & t4) ^ (t5 | this.X[1]);
      this.X[0] = this.X[3] ^ (t5 ^ t8);
    }

    // S1 - {15,12, 2, 7, 9, 0, 5,10, 1,11,14, 8, 6,13, 3, 4 }
    _sb1(a, b, c, d) {
      const t2 = b ^ (~a);
      const t5 = c ^ (a | t2);
      this.X[2] = d ^ t5;
      const t7 = b ^ (d | t2);
      const t8 = t2 ^ this.X[2];
      this.X[3] = t8 ^ (t5 & t7);
      const t11 = t5 ^ t7;
      this.X[1] = this.X[3] ^ t11;
      this.X[0] = t5 ^ (t8 & t11);
    }

    // InvS1 - { 5, 8, 2,14,15, 6,12, 3,11, 4, 7, 9, 1,13,10, 0 }
    _ib1(a, b, c, d) {
      const t1 = b ^ d;
      const t3 = a ^ (b & t1);
      const t4 = t1 ^ t3;
      this.X[3] = c ^ t4;
      const t7 = b ^ (t1 & t3);
      const t8 = this.X[3] | t7;
      this.X[1] = t3 ^ t8;
      const t10 = ~this.X[1];
      const t11 = this.X[3] ^ t7;
      this.X[0] = t10 ^ t11;
      this.X[2] = t4 ^ (t10 | t11);
    }

    // S2 - { 8, 6, 7, 9, 3,12,10,15,13, 1,14, 4, 0,11, 5, 2 }
    _sb2(a, b, c, d) {
      const t1 = ~a;
      const t2 = b ^ d;
      const t3 = c & t1;
      this.X[0] = t2 ^ t3;
      const t5 = c ^ t1;
      const t6 = c ^ this.X[0];
      const t7 = b & t6;
      this.X[3] = t5 ^ t7;
      this.X[2] = a ^ ((d | t7) & (this.X[0] | t5));
      this.X[1] = (t2 ^ this.X[3]) ^ (this.X[2] ^ (d | t1));
    }

    // InvS2 - {12, 9,15, 4,11,14, 1, 2, 0, 3, 6,13, 5, 8,10, 7 }
    _ib2(a, b, c, d) {
      const t1 = b ^ d;
      const t2 = ~t1;
      const t3 = a ^ c;
      const t4 = c ^ t1;
      const t5 = b & t4;
      this.X[0] = t3 ^ t5;
      const t7 = a | t2;
      const t8 = d ^ t7;
      const t9 = t3 | t8;
      this.X[3] = t1 ^ t9;
      const t11 = ~t4;
      const t12 = this.X[0] | this.X[3];
      this.X[1] = t11 ^ t12;
      this.X[2] = (d & t11) ^ (t3 ^ t12);
    }

    // S3 - { 0,15,11, 8,12, 9, 6, 3,13, 1, 2, 4,10, 7, 5,14 }
    _sb3(a, b, c, d) {
      const t1 = a ^ b;
      const t2 = a & c;
      const t3 = a | d;
      const t4 = c ^ d;
      const t5 = t1 & t3;
      const t6 = t2 | t5;
      this.X[2] = t4 ^ t6;
      const t8 = b ^ t3;
      const t9 = t6 ^ t8;
      const t10 = t4 & t9;
      this.X[0] = t1 ^ t10;
      const t12 = this.X[2] & this.X[0];
      this.X[1] = t9 ^ t12;
      this.X[3] = (b | d) ^ (t4 ^ t12);
    }

    // InvS3 - { 0, 9,10, 7,11,14, 6,13, 3, 5,12, 2, 4, 8,15, 1 }
    _ib3(a, b, c, d) {
      const t1 = a | b;
      const t2 = b ^ c;
      const t3 = b & t2;
      const t4 = a ^ t3;
      const t5 = c ^ t4;
      const t6 = d | t4;
      this.X[0] = t2 ^ t6;
      const t8 = t2 | t6;
      const t9 = d ^ t8;
      this.X[2] = t5 ^ t9;
      const t11 = t1 ^ t9;
      const t12 = this.X[0] & t11;
      this.X[3] = t4 ^ t12;
      this.X[1] = this.X[3] ^ (this.X[0] ^ t11);
    }

    // S4 - { 1,15, 8, 3,12, 0,11, 6, 2, 5, 4,10, 9,14, 7,13 }
    _sb4(a, b, c, d) {
      const t1 = a ^ d;
      const t2 = d & t1;
      const t3 = c ^ t2;
      const t4 = b | t3;
      this.X[3] = t1 ^ t4;
      const t6 = ~b;
      const t7 = t1 | t6;
      this.X[0] = t3 ^ t7;
      const t9 = a & this.X[0];
      const t10 = t1 ^ t6;
      const t11 = t4 & t10;
      this.X[2] = t9 ^ t11;
      this.X[1] = (a ^ t3) ^ (t10 & this.X[2]);
    }

    // InvS4 - { 5, 0, 8, 3,10, 9, 7,14, 2,12,11, 6, 4,15,13, 1 }
    _ib4(a, b, c, d) {
      const t1 = c | d;
      const t2 = a & t1;
      const t3 = b ^ t2;
      const t4 = a & t3;
      const t5 = c ^ t4;
      this.X[1] = d ^ t5;
      const t7 = ~a;
      const t8 = t5 & this.X[1];
      this.X[3] = t3 ^ t8;
      const t10 = this.X[1] | t7;
      const t11 = d ^ t10;
      this.X[0] = this.X[3] ^ t11;
      this.X[2] = (t3 & t11) ^ (this.X[1] ^ t7);
    }

    // S5 - {15, 5, 2,11, 4,10, 9,12, 0, 3,14, 8,13, 6, 7, 1 }
    _sb5(a, b, c, d) {
      const t1 = ~a;
      const t2 = a ^ b;
      const t3 = a ^ d;
      const t4 = c ^ t1;
      const t5 = t2 | t3;
      this.X[0] = t4 ^ t5;
      const t7 = d & this.X[0];
      const t8 = t2 ^ this.X[0];
      this.X[1] = t7 ^ t8;
      const t10 = t1 | this.X[0];
      const t11 = t2 | t7;
      const t12 = t3 ^ t10;
      this.X[2] = t11 ^ t12;
      this.X[3] = (b ^ t7) ^ (this.X[1] & t12);
    }

    // InvS5 - { 8,15, 2, 9, 4, 1,13,14,11, 6, 5, 3, 7,12,10, 0 }
    _ib5(a, b, c, d) {
      const t1 = ~c;
      const t2 = b & t1;
      const t3 = d ^ t2;
      const t4 = a & t3;
      const t5 = b ^ t1;
      this.X[3] = t4 ^ t5;
      const t7 = b | this.X[3];
      const t8 = a & t7;
      this.X[1] = t3 ^ t8;
      const t10 = a | d;
      const t11 = t1 ^ t7;
      this.X[0] = t10 ^ t11;
      this.X[2] = (b & t10) ^ (t4 | (a ^ c));
    }

    // S6 - { 7, 2,12, 5, 8, 4, 6,11,14, 9, 1,15,13, 3,10, 0 }
    _sb6(a, b, c, d) {
      const t1 = ~a;
      const t2 = a ^ d;
      const t3 = b ^ t2;
      const t4 = t1 | t2;
      const t5 = c ^ t4;
      this.X[1] = b ^ t5;
      const t7 = t2 | this.X[1];
      const t8 = d ^ t7;
      const t9 = t5 & t8;
      this.X[2] = t3 ^ t9;
      const t11 = t5 ^ t8;
      this.X[0] = this.X[2] ^ t11;
      this.X[3] = (~t5) ^ (t3 & t11);
    }

    // InvS6 - {15,10, 1,13, 5, 3, 6, 0, 4, 9,14, 7, 2,12, 8,11 }
    _ib6(a, b, c, d) {
      const t1 = ~a;
      const t2 = a ^ b;
      const t3 = c ^ t2;
      const t4 = c | t1;
      const t5 = d ^ t4;
      this.X[1] = t3 ^ t5;
      const t7 = t3 & t5;
      const t8 = t2 ^ t7;
      const t9 = b | t8;
      this.X[3] = t5 ^ t9;
      const t11 = b | this.X[3];
      this.X[0] = t8 ^ t11;
      this.X[2] = (d & t1) ^ (t3 ^ t11);
    }

    // S7 - { 1,13,15, 0,14, 8, 2,11, 7, 4,12,10, 9, 3, 5, 6 }
    _sb7(a, b, c, d) {
      const t1 = b ^ c;
      const t2 = c & t1;
      const t3 = d ^ t2;
      const t4 = a ^ t3;
      const t5 = d | t1;
      const t6 = t4 & t5;
      this.X[1] = b ^ t6;
      const t8 = t3 | this.X[1];
      const t9 = a & t4;
      this.X[3] = t1 ^ t9;
      const t11 = t4 ^ t8;
      const t12 = this.X[3] & t11;
      this.X[2] = t3 ^ t12;
      this.X[0] = (~t11) ^ (this.X[3] & this.X[2]);
    }

    // InvS7 - { 3, 0, 6,13, 9,14,15, 8, 5,12,11, 7,10, 1, 4, 2 }
    _ib7(a, b, c, d) {
      const t3 = c | (a & b);
      const t4 = d & (a | b);
      this.X[3] = t3 ^ t4;
      const t6 = ~d;
      const t7 = b ^ t4;
      const t9 = t7 | (this.X[3] ^ t6);
      this.X[1] = a ^ t9;
      this.X[0] = (c ^ t7) ^ (d | this.X[1]);
      this.X[2] = (t3 ^ this.X[1]) ^ (this.X[0] ^ (a & this.X[3]));
    }

    // Linear transformation (same as Serpent)
    _LT() {
      const x0 = OpCodes.RotL32(this.X[0], 13);
      const x2 = OpCodes.RotL32(this.X[2], 3);
      const x1 = this.X[1] ^ x0 ^ x2;
      const x3 = this.X[3] ^ x2 ^ (x0 << 3);

      this.X[1] = OpCodes.RotL32(x1, 1);
      this.X[3] = OpCodes.RotL32(x3, 7);
      this.X[0] = OpCodes.RotL32(x0 ^ this.X[1] ^ this.X[3], 5);
      this.X[2] = OpCodes.RotL32(x2 ^ this.X[3] ^ (this.X[1] << 7), 22);
    }

    // Inverse linear transformation (same as Serpent)
    _inverseLT() {
      const x2 = OpCodes.RotR32(this.X[2], 22) ^ this.X[3] ^ (this.X[1] << 7);
      const x0 = OpCodes.RotR32(this.X[0], 5) ^ this.X[1] ^ this.X[3];
      const x3 = OpCodes.RotR32(this.X[3], 7);
      const x1 = OpCodes.RotR32(this.X[1], 1);
      this.X[3] = x3 ^ x2 ^ (x0 << 3);
      this.X[1] = x1 ^ x0 ^ x2;
      this.X[2] = OpCodes.RotR32(x2, 3);
      this.X[0] = OpCodes.RotR32(x0, 13);
    }

    // Key scheduling function - Tnepres version (big-endian, reverse order)
    _generateKeySchedule(key) {
      // Pad key to 256 bits (16 words) - big-endian order
      const kPad = new Array(16).fill(0);
      let length = 0;

      // Process key from end backwards (big-endian)
      for (let off = key.length - 4; off > 0; off -= 4) {
        kPad[length++] = OpCodes.Pack32BE(
          key[off], key[off + 1], key[off + 2], key[off + 3]
        );
      }

      // Handle remaining bytes
      if (key.length % 4 === 0) {
        kPad[length++] = OpCodes.Pack32BE(
          key[0], key[1], key[2], key[3]
        );
        if (length < 8) {
          kPad[length] = 1;
        }
      } else {
        throw new Error("Key must be a multiple of 4 bytes");
      }

      // Expand padded key up to 33 x 128 bits of key material
      const amount = (this.ROUNDS + 1) * 4;
      const w = new Array(amount).fill(0);

      // Compute w0 to w7 from padded key
      for (let i = 8; i < 16; ++i) {
        kPad[i] = OpCodes.RotL32(
          kPad[i - 8] ^ kPad[i - 5] ^ kPad[i - 3] ^ kPad[i - 1] ^ this.PHI ^ (i - 8),
          11
        );
      }

      // Copy initial words
      for (let i = 0; i < 8; ++i) {
        w[i] = kPad[8 + i];
      }

      // Expand to full key schedule
      for (let i = 8; i < amount; ++i) {
        w[i] = OpCodes.RotL32(
          w[i - 8] ^ w[i - 5] ^ w[i - 3] ^ w[i - 1] ^ this.PHI ^ i,
          11
        );
      }

      // Apply S-boxes to create working keys (Tnepres order: 3,2,1,0,7,6,5,4...)
      const roundKeys = [];
      const sboxOrder = [3, 2, 1, 0, 7, 6, 5, 4];

      for (let i = 0; i < 33; ++i) {
        const sboxIndex = sboxOrder[i % 8];
        this.X[0] = w[i * 4 + 0];
        this.X[1] = w[i * 4 + 1];
        this.X[2] = w[i * 4 + 2];
        this.X[3] = w[i * 4 + 3];

        this._applySBox(sboxIndex);

        w[i * 4 + 0] = this.X[0];
        w[i * 4 + 1] = this.X[1];
        w[i * 4 + 2] = this.X[2];
        w[i * 4 + 3] = this.X[3];

        roundKeys[i] = [this.X[0], this.X[1], this.X[2], this.X[3]];
      }

      return roundKeys;
    }

    // Helper method to apply S-box based on index
    _applySBox(sboxIndex) {
      const a = this.X[0], b = this.X[1], c = this.X[2], d = this.X[3];
      switch (sboxIndex) {
        case 0: this._sb0(a, b, c, d); break;
        case 1: this._sb1(a, b, c, d); break;
        case 2: this._sb2(a, b, c, d); break;
        case 3: this._sb3(a, b, c, d); break;
        case 4: this._sb4(a, b, c, d); break;
        case 5: this._sb5(a, b, c, d); break;
        case 6: this._sb6(a, b, c, d); break;
        case 7: this._sb7(a, b, c, d); break;
      }
    }

    // Helper method to apply inverse S-box based on index
    _applyInverseSBox(sboxIndex) {
      const a = this.X[0], b = this.X[1], c = this.X[2], d = this.X[3];
      switch (sboxIndex) {
        case 0: this._ib0(a, b, c, d); break;
        case 1: this._ib1(a, b, c, d); break;
        case 2: this._ib2(a, b, c, d); break;
        case 3: this._ib3(a, b, c, d); break;
        case 4: this._ib4(a, b, c, d); break;
        case 5: this._ib5(a, b, c, d); break;
        case 6: this._ib6(a, b, c, d); break;
        case 7: this._ib7(a, b, c, d); break;
      }
    }

    // Encrypt a block - Tnepres uses big-endian byte order
    _encryptBlock(block) {
      if (block.length !== 16) {
        throw new Error('Tnepres block size must be exactly 16 bytes');
      }

      // Convert plaintext to 32-bit words (big-endian, reverse word order)
      this.X[3] = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      this.X[2] = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      this.X[1] = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      this.X[0] = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      // 32 rounds
      for (let round = 0; round < this.ROUNDS; ++round) {
        // Key mixing
        this.X[0] ^= this.roundKeys[round][0];
        this.X[1] ^= this.roundKeys[round][1];
        this.X[2] ^= this.roundKeys[round][2];
        this.X[3] ^= this.roundKeys[round][3];

        // S-box substitution
        const sboxIndex = round % 8;
        this._applySBox(sboxIndex);

        // Linear transformation (except in last round)
        if (round < this.ROUNDS - 1) {
          this._LT();
        }
      }

      // Final key mixing
      this.X[3] ^= this.roundKeys[32][3];
      this.X[2] ^= this.roundKeys[32][2];
      this.X[1] ^= this.roundKeys[32][1];
      this.X[0] ^= this.roundKeys[32][0];

      // Convert back to bytes (big-endian, reverse word order)
      const result = [];
      const bytes3 = OpCodes.Unpack32BE(this.X[3]);
      const bytes2 = OpCodes.Unpack32BE(this.X[2]);
      const bytes1 = OpCodes.Unpack32BE(this.X[1]);
      const bytes0 = OpCodes.Unpack32BE(this.X[0]);

      result.push(...bytes3, ...bytes2, ...bytes1, ...bytes0);

      return result;
    }

    // Decrypt a block - Tnepres uses big-endian byte order
    _decryptBlock(block) {
      if (block.length !== 16) {
        throw new Error('Tnepres block size must be exactly 16 bytes');
      }

      // Convert ciphertext to 32-bit words (big-endian, reverse word order)
      this.X[3] = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      this.X[2] = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      this.X[1] = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      this.X[0] = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);

      // Undo final key mixing
      this.X[3] ^= this.roundKeys[32][3];
      this.X[2] ^= this.roundKeys[32][2];
      this.X[1] ^= this.roundKeys[32][1];
      this.X[0] ^= this.roundKeys[32][0];

      // 32 rounds in reverse
      for (let round = this.ROUNDS - 1; round >= 0; --round) {
        // Inverse linear transformation first (except for last round which was first)
        if (round < this.ROUNDS - 1) {
          this._inverseLT();
        }

        // Inverse S-box substitution
        const sboxIndex = round % 8;
        this._applyInverseSBox(sboxIndex);

        // Undo key mixing
        this.X[0] ^= this.roundKeys[round][0];
        this.X[1] ^= this.roundKeys[round][1];
        this.X[2] ^= this.roundKeys[round][2];
        this.X[3] ^= this.roundKeys[round][3];
      }

      // Convert back to bytes (big-endian, reverse word order)
      const result = [];
      const bytes3 = OpCodes.Unpack32BE(this.X[3]);
      const bytes2 = OpCodes.Unpack32BE(this.X[2]);
      const bytes1 = OpCodes.Unpack32BE(this.X[1]);
      const bytes0 = OpCodes.Unpack32BE(this.X[0]);

      result.push(...bytes3, ...bytes2, ...bytes1, ...bytes0);

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new TnepresAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TnepresAlgorithm, TnepresInstance };
}));
