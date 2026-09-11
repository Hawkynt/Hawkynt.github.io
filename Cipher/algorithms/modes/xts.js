/*
 * XTS (XEX-based Tweaked-codebook mode with ciphertext Stealing) Mode of Operation
 * Disk encryption mode designed for storage devices
 * Uses two keys and a tweak for each sector/block
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
    root.XTS = factory(root.AlgorithmFramework, root.OpCodes);
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

  class XtsAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "XTS";
      this.description = "XEX-based Tweaked-codebook mode with ciphertext Stealing is designed for disk encryption. Uses two independent cipher keys (Key1 for encryption, Key2 for tweak generation) and a tweak value (typically sector number) to ensure different ciphertexts for identical plaintext blocks in different sectors. Supports partial block encryption via ciphertext stealing.";
      this.inventor = "Phillip Rogaway";
      this.year = 2004;
      this.category = CategoryType.MODE;
      this.subCategory = "Disk Encryption Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.RequiresIV = true; // XTS uses tweak value instead of traditional IV
      this.SupportedIVSizes = [
        new KeySize(16, 16, 0) // XTS requires exactly 16-byte tweak for AES
      ];

      this.documentation = [
        new LinkItem("IEEE 1619-2007", "https://standards.ieee.org/standard/1619-2007.html"),
        new LinkItem("NIST SP 800-38E", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf"),
        new LinkItem("FIPS 140-2 Annex A", "XTS-AES approval for disk encryption")
      ];

      this.references = [
        new LinkItem("Original XTS Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/modes.pdf"),
        new LinkItem("OpenSSL XTS Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/xts128.c"),
        new LinkItem("dm-crypt XTS", "Linux kernel XTS implementation")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak Tweak Values", "Using predictable or repeated tweak values can leak information. Always use unique tweaks per data unit."),
        new Vulnerability("Key Reuse", "Using same key for Key1 and Key2 breaks security. Ensure keys are independent."),
        new Vulnerability("Data Unit Size", "Very large data units may have security implications. Recommended maximum is 2^20 blocks per tweak.")
      ];

      // IEEE Std 1619-2007 Annex B XTS-AES vectors. The key is Key1 || Key2 and
      // the IV is the data unit sequence number encoded little-endian into 16
      // bytes. Vectors 15..18 exercise the ciphertext-stealing path.
      this.tests = [
        {
          text: "IEEE 1619 XTS-AES vector 2 (two full blocks)",
          uri: "https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4444444444444444444444444444444444444444444444444444444444444444"),
          key: OpCodes.Hex8ToBytes("1111111111111111111111111111111122222222222222222222222222222222"),
          iv: OpCodes.Hex8ToBytes("33333333330000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c454185e6a16936e39334038acef838bfb186fff7480adc4289382ecd6d394f0")
        },
        {
          text: "IEEE 1619 XTS-AES vector 15 (17 bytes, ciphertext stealing)",
          uri: "https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10"),
          key: OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0"),
          iv: OpCodes.Hex8ToBytes("9a785634120000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6c1625db4671522d3d7599601de7ca09ed")
        },
        {
          text: "IEEE 1619 XTS-AES vector 16 (18 bytes, ciphertext stealing)",
          uri: "https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011"),
          key: OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0"),
          iv: OpCodes.Hex8ToBytes("9a785634120000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d069444b7a7e0cab09e24447d24deb1fedbf")
        },
        {
          text: "IEEE 1619 XTS-AES vector 17 (19 bytes, ciphertext stealing)",
          uri: "https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112"),
          key: OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0"),
          iv: OpCodes.Hex8ToBytes("9a785634120000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e5df1351c0544ba1350b3363cd8ef4beedbf9d")
        },
        {
          text: "IEEE 1619 XTS-AES vector 18 (20 bytes, ciphertext stealing)",
          uri: "https://raw.githubusercontent.com/BrianGladman/modes/master/testvals/xts.1",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          key: OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0"),
          iv: OpCodes.Hex8ToBytes("9a785634120000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("9d84c813f719aa2c7be3f66171c7c5c2edbf9dac")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XtsModeInstance(this, isInverse);
    }
  }

  /**
 * XtsMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XtsModeInstance extends IAlgorithmInstance {
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
      this.tweak = null;
      this.key1 = null;
      this.key2 = null;
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use (must be 128-bit)
     */
    setBlockCipher(cipher) {
      if (!cipher || cipher.BlockSize !== 16) {
        throw new Error("XTS requires a 128-bit block cipher");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the XTS key (must be double the block cipher key size)
     * @param {Array} key - Combined key (Key1 || Key2)
     */
    setKey(key) {
      if (!key || key.length % 2 !== 0) {
        throw new Error("XTS key must be even length (Key1 || Key2)");
      }

      const keySize = key.length / 2;
      this.key1 = key.slice(0, keySize);
      this.key2 = key.slice(keySize);

      // Ensure keys are different for security
      if (OpCodes.SecureCompare(this.key1, this.key2)) {
        throw new Error("XTS Key1 and Key2 must be different");
      }
    }

    /**
     * Set the tweak value (typically sector/block number)
     * @param {Array} tweak - 128-bit tweak value
     */
    setTweak(tweak) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before tweak");
      }
      if (!tweak || tweak.length !== 16) {
        throw new Error("XTS requires 16-byte tweak value");
      }
      this.tweak = [...tweak];
    }

    /**
     * Alternative method for compatibility with IV-based interfaces
     */
    setIV(iv) {
      this.setTweak(iv);
    }

    /**
     * Multiply 128-bit value by α in GF(2^128)
     * α is the primitive element x in the field
     * @private
     */
    _multiplyAlpha(block) {
      // IEEE 1619 represents the tweak as a little-endian 128-bit value, so the
      // multiplication by the primitive element runs from byte 0 (least
      // significant) upwards and the x^128 reduction folds back into byte 0.
      const result = new Array(16);
      let carry = 0;

      for (let i = 0; i < 16; i++) {
        const newCarry = OpCodes.AndN(block[i], 0x80) ? 1 : 0;
        result[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(block[i], 1), carry), 0xFF);
        carry = newCarry;
      }

      // Handle reduction for x^128
      if (carry) {
        result[0] = OpCodes.XorN(result[0], 0x87); // Reduction polynomial
      }

      return result;
    }

    /**
     * Compute sequence of tweaks T_i = α^i * T_0
     * @private
     */
    _computeTweaks(startTweak, count) {
      const tweaks = [];
      let currentTweak = [...startTweak];

      for (let i = 0; i < count; i++) {
        tweaks.push([...currentTweak]);
        currentTweak = this._multiplyAlpha(currentTweak);
      }

      return tweaks;
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
      if (!this.tweak) {
        throw new Error("Tweak not set. Call setTweak() first.");
      }
      if (!this.key1 || !this.key2) {
        throw new Error("Keys not set. Call setKey() first.");
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
        throw new Error("Block cipher not set");
      }
      if (!this.tweak) {
        throw new Error("Tweak not set");
      }
      if (!this.key1 || !this.key2) {
        throw new Error("Keys not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }
      if (this.inputBuffer.length < 16) {
        throw new Error("XTS requires at least 16 bytes of data");
      }

      const blockSize = 16;
      const fullBlocks = Math.floor(this.inputBuffer.length / blockSize);
      const partialBytes = this.inputBuffer.length % blockSize;
      const needsSteal = partialBytes > 0;

      // Encrypt tweak with Key2 to get T_0
      const tweakCipher = this.blockCipher.algorithm.CreateInstance(false);
      tweakCipher.key = this.key2;
      tweakCipher.Feed(this.tweak);
      const t0 = tweakCipher.Result();

      // Generate sequence of tweaks. Ciphertext stealing consumes one tweak
      // beyond the number of whole blocks, because IEEE 1619 encrypts the
      // stolen block with the tweak that would have belonged to the partial
      // block position.
      const tweakCount = needsSteal ? fullBlocks + 1 : fullBlocks;
      const tweaks = this._computeTweaks(t0, tweakCount);

      const output = [];

      if (needsSteal) {
        // XTS with ciphertext stealing for partial last block
        const processingBlocks = fullBlocks - 1;

        // Process all full blocks except the last
        for (let i = 0; i < processingBlocks; i++) {
          const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
          const processedBlock = this._processBlock(block, tweaks[i]);
          for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
        }

        // Handle last full block and partial block with ciphertext stealing
        const lastFullBlock = this.inputBuffer.slice(processingBlocks * blockSize, fullBlocks * blockSize);
        const partialBlock = this.inputBuffer.slice(fullBlocks * blockSize);

        if (this.isInverse) {
          // Decrypt: Process penultimate block first, then steal from it.
          // Encryption built the padded partial block as
          //   partial-plaintext || tail of the processed last full block
          // so decryption must reassemble the stolen block in that same order:
          //   stolen ciphertext bytes || tail recovered from the penultimate block.
          // The two halves were previously concatenated the other way round,
          // which rotated the block and lost the whole ragged tail.
          // IEEE 1619 decrypts the final whole ciphertext block with tweak m
          // (the position the partial block would have occupied) and the
          // reassembled block with tweak m-1.
          const processedPenult = this._processBlock(lastFullBlock, tweaks[processingBlocks + 1]);

          // The leading partialBytes of the recovered block are the partial plaintext
          const partialPlaintext = processedPenult.slice(0, partialBytes);
          const paddedLastBlock = [...partialBlock, ...processedPenult.slice(partialBytes)];

          // Process the reconstructed last full block
          const processedLast = this._processBlock(paddedLastBlock, tweaks[processingBlocks]);

          for (let _i = 0; _i < processedLast.length; _i++) output.push(processedLast[_i]);
          for (let _i = 0; _i < partialPlaintext.length; _i++) output.push(partialPlaintext[_i]);

        } else {
          // Encrypt: Process last full block, then steal for partial
          const processedLast = this._processBlock(lastFullBlock, tweaks[processingBlocks]);

          // Create padded partial block by stealing from processed last block.
          // The stolen block is encrypted with tweak m, one past the tweak used
          // for the final whole block.
          const paddedPartial = [...partialBlock, ...processedLast.slice(partialBytes)];
          const processedPartial = this._processBlock(paddedPartial, tweaks[processingBlocks + 1]);

          for (let _i = 0; _i < processedPartial.length; _i++) output.push(processedPartial[_i]);
          const stolen = processedLast.slice(0, partialBytes);
          for (let _i = 0; _i < stolen.length; _i++) output.push(stolen[_i]);
        }

      } else {
        // Standard XTS for data that's a multiple of block size
        for (let i = 0; i < fullBlocks; i++) {
          const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
          const processedBlock = this._processBlock(block, tweaks[i]);
          for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
        }
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(tweaks);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Process a single 16-byte block with XTS
     * @private
     */
    _processBlock(block, tweak) {
      // Step 1: XOR with tweak
      const tweakedBlock = OpCodes.XorArrays(block, tweak);

      // Step 2: Encrypt/decrypt with Key1
      const cipher = this.blockCipher.algorithm.CreateInstance(this.isInverse);
      cipher.key = this.key1;
      cipher.Feed(tweakedBlock);
      const cipherOutput = cipher.Result();

      // Step 3: XOR with tweak again
      return OpCodes.XorArrays(cipherOutput, tweak);
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new XtsAlgorithm());

  // ===== EXPORTS =====

  return { XtsAlgorithm, XtsModeInstance };
}));