/*
 * LRW (Liskov-Rivest-Wagner) Mode of Operation
 * Tweakable block cipher mode for disk encryption (predecessor to XTS)
 * (c)2006-2025 Hawkynt
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
    root.LRW = factory(root.AlgorithmFramework, root.OpCodes);
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

  class LrwAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "LRW";
      this.description = "LRW (Liskov-Rivest-Wagner) is a tweakable block cipher mode designed for disk encryption. It combines a block cipher with Galois field multiplication to create a tweakable cipher that's suitable for random-access storage. LRW was later superseded by XTS mode due to security improvements.";
      this.inventor = "Moses Liskov, Ronald Rivest, David Wagner";
      this.year = 2002;
      this.category = CategoryType.MODE;
      this.subCategory = "Disk Encryption Mode";
      this.securityStatus = SecurityStatus.DEPRECATED; // Replaced by XTS
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for LRW

      this.documentation = [
        new LinkItem("LRW Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/lrw.pdf"),
        new LinkItem("IEEE P1619 Draft", "https://standards.ieee.org/ieee/1619/3618/"),
        new LinkItem("Tweakable Block Ciphers", "https://web.cs.ucdavis.edu/~rogaway/papers/tweakable.pdf")
      ];

      this.references = [
        new LinkItem("XTS Mode (LRW successor)", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf"),
        new LinkItem("dm-crypt LRW Implementation", "https://gitlab.com/cryptsetup/cryptsetup/-/blob/main/lib/crypto_backend/crypto_kernel.c"),
        new LinkItem("Linux Kernel Crypto", "https://github.com/torvalds/linux/tree/master/crypto")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Superseded by XTS", "LRW has been replaced by XTS mode which provides better security properties and addresses potential weaknesses in LRW."),
        new Vulnerability("Galois Field Implementation", "Requires careful implementation of GF(2^128) multiplication to avoid timing attacks and ensure correctness."),
        new Vulnerability("Tweak Management", "Improper tweak handling in disk encryption can lead to security vulnerabilities.")
      ];

      // LRW-32-AES vectors 1..7 from the IEEE P1619 draft, preserved verbatim
      // in the Linux kernel's aes_lrw_tv_template. LRW was dropped from P1619
      // in favour of XTS, so these draft values are the only published set.
      this.tests = [
        {
          text: "LRW-32-AES-1 (AES-128, index 1)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("4562ac25f828176d4c268414b5680185"),
          tweakKey: OpCodes.Hex8ToBytes("258e2a05e73e9d03ee5a830ccc094c87"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          expected: OpCodes.Hex8ToBytes("f1b273cd65a3df5fe95d489254634eb8")
        },
        {
          text: "LRW-32-AES-2 (AES-128, index 2)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("59704714f557478cd779e80f54887944"),
          tweakKey: OpCodes.Hex8ToBytes("0d48f0b7b15a53ea1caa6b29c2cafbaf"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000000000002"),
          expected: OpCodes.Hex8ToBytes("00c82bae95bbcde5274f0769b260e136")
        },
        {
          text: "LRW-32-AES-3 (AES-128, large index)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("d82a9134b26a565030fe69e2377f9847"),
          tweakKey: OpCodes.Hex8ToBytes("cdf90b160c648fb6b00d0d1bae85871f"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000200000000"),
          expected: OpCodes.Hex8ToBytes("76322183ed8ff182f9596203690e5e01")
        },
        {
          text: "LRW-32-AES-4 (AES-192, index 1)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("0f6aeff8d3d2bb152583f73c1f012874cac6bc354d4a6554"),
          tweakKey: OpCodes.Hex8ToBytes("90ae61cf7baebdccade494c54a29ae70"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          expected: OpCodes.Hex8ToBytes("9c0f152f55a2d8f0d67b8f9e2822bc41")
        },
        {
          text: "LRW-32-AES-5 (AES-192, large index)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("8ad4ee102fbd81fff886ceac93c5adc6a01907c09df7bbdd"),
          tweakKey: OpCodes.Hex8ToBytes("5213b2b7f0ff11d8d608d0cd2eb1176f"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000200000000"),
          expected: OpCodes.Hex8ToBytes("d4276a7f14913d65c860480287e33406")
        },
        {
          text: "LRW-32-AES-6 (AES-256, index 1)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("f8d476ffd646ee6c2384cb1c77d6195dfef1a9f37bbc8d21a79c21f8cb900289"),
          tweakKey: OpCodes.Hex8ToBytes("a845348ec8c5b5f126f50e76fefd1b1e"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
          expected: OpCodes.Hex8ToBytes("bd06b8e1db98899ec498e491cf1c702b")
        },
        {
          text: "LRW-32-AES-7 (AES-256, large index)",
          uri: "https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("30313233343536373839414243444546"),
          key: OpCodes.Hex8ToBytes("fb7615b23d80891dd470980bc79584c8b2fb64ce6097878d17fce45a49e830b7"),
          tweakKey: OpCodes.Hex8ToBytes("6e7817e72d5e12d46064047af12f9e0c"),
          tweak: OpCodes.Hex8ToBytes("00000000000000000000000200000000"),
          expected: OpCodes.Hex8ToBytes("5b908ec1abdd675f3d698a9553c89ce5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LrwModeInstance(this, isInverse);
    }
  }

  /**
 * LrwMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LrwModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.key = null; // Block cipher key
      this.tweakKey = null; // LRW tweak key for GF multiplication
      this.tweak = null; // Sector/block identifier
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      if (cipher.BlockSize !== 16) {
        throw new Error("LRW mode requires 128-bit block cipher (typically AES)");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the block cipher encryption key
     * @param {Array} key - Block cipher key
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Block cipher key cannot be empty");
      }
      this.key = [...key];
    }

    /**
     * Set the LRW tweak key for Galois field operations
     * @param {Array} tweakKey - 128-bit tweak key for GF(2^128) multiplication
     */
    setTweakKey(tweakKey) {
      if (!tweakKey || tweakKey.length !== 16) {
        throw new Error("LRW tweak key must be exactly 128 bits (16 bytes)");
      }
      this.tweakKey = [...tweakKey];
    }

    /**
     * Set the tweak value (sector/block identifier)
     * @param {Array} tweak - Tweak value for this block
     */
    setTweak(tweak) {
      if (!tweak || tweak.length !== 16) {
        throw new Error("LRW tweak must be exactly 128 bits (16 bytes)");
      }
      this.tweak = [...tweak];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key || !this.tweakKey) {
        throw new Error("Both block cipher key and tweak key must be set for LRW mode.");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key || !this.tweakKey) {
        throw new Error("Both block cipher key and tweak key must be set for LRW mode.");
      }
      if (!this.tweak) {
        throw new Error("Tweak not set. Call setTweak() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes for LRW mode`);
      }

      const output = [];

      // LRW construction: C = E_K(P XOR T) XOR T with T = K2 (*) I, where I is
      // the block index. The index advances by one for every 16-byte block of
      // the data unit, so the offset cannot be computed once up front.
      let blockIndex = [...this.tweak];

      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const inputBlock = this.inputBuffer.slice(i, i + blockSize);
        const offset = this._gf128Multiply(this.tweakKey, blockIndex);

        const cipher = this.blockCipher.algorithm.CreateInstance(this.isInverse);
        cipher.key = this.key;
        cipher.Feed(OpCodes.XorArrays(inputBlock, offset));
        const processed = cipher.Result();

        const outputBlock = OpCodes.XorArrays(processed, offset);
        for (let _i = 0; _i < outputBlock.length; _i++) output.push(outputBlock[_i]);

        blockIndex = this._incrementIndex(blockIndex);
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Add one to a big-endian 128-bit block index
     * @private
     */
    _incrementIndex(index) {
      const result = [...index];
      for (let i = result.length - 1; i >= 0; i--) {
        result[i] = (result[i] + 1) % 256;
        if (result[i] !== 0) break;
      }
      return result;
    }

    /**
     * Multiply a 128-bit value by x in GF(2^128)
     * The value is a plain big-endian integer, so bit 0 of the last byte is the
     * coefficient of x^0 and the reduction folds into that same byte.
     * @private
     */
    _gf128MulX(value) {
      const result = new Array(16);
      const overflow = OpCodes.AndN(OpCodes.Shr32(value[0], 7), 1);
      for (let i = 0; i < 15; i++) {
        const low = OpCodes.AndN(OpCodes.Shl32(value[i], 1), 0xFF);
        const high = OpCodes.AndN(OpCodes.Shr32(value[i + 1], 7), 1);
        result[i] = OpCodes.OrN(low, high);
      }
      result[15] = OpCodes.AndN(OpCodes.Shl32(value[15], 1), 0xFF);
      if (overflow) result[15] = OpCodes.XorN(result[15], 0x87);
      return result;
    }

    /**
     * Multiply two 128-bit values in GF(2^128)
     * Uses the reduction polynomial x^128 + x^7 + x^2 + x + 1 with the
     * big-endian byte / big-endian bit convention of the IEEE P1619 LRW
     * vectors: byte 0 bit 7 is the coefficient of x^127 and byte 15 bit 0 is
     * the coefficient of x^0.
     * @param {Array} a - First 128-bit operand
     * @param {Array} b - Second 128-bit operand
     * @returns {Array} Product in GF(2^128)
     */
    _gf128Multiply(a, b) {
      let result = new Array(16).fill(0);
      let v = [...a];

      // Walk the exponents of b from x^0 upwards, doubling a each step.
      for (let exponent = 0; exponent < 128; exponent++) {
        const byteIndex = 15 - Math.floor(exponent / 8);
        const bitIndex = exponent % 8;

        if (OpCodes.AndN(OpCodes.Shr32(b[byteIndex], bitIndex), 1)) {
          result = OpCodes.XorArrays(result, v);
        }

        v = this._gf128MulX(v);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new LrwAlgorithm());

  // ===== EXPORTS =====

  return { LrwAlgorithm, LrwModeInstance };
}));