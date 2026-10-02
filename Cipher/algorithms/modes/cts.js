/*
 * CTS (Ciphertext Stealing) Mode of Operation
 * Handles arbitrary length messages without padding
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
    root.CTS = factory(root.AlgorithmFramework, root.OpCodes);
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

  class CtsAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "CTS";
      this.description = "Ciphertext Stealing (CTS) mode allows block ciphers to handle arbitrary-length plaintexts without padding by 'stealing' ciphertext bits from the penultimate block to pad the final block. This maintains the original plaintext length while providing the security properties of CBC mode. This implementation follows the CBC-CS3 ordering of NIST SP 800-38A Addendum, the variant used by RFC 3962 and Kerberos, in which the last two ciphertext blocks are always exchanged - including when the message length is an exact multiple of the block size.";
      this.inventor = "Meyer, Matyas";
      this.year = 1982;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = true;
      this.SupportedIVSizes = [
        new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
      ];

      this.documentation = [
        new LinkItem("RFC 3962 - AES Encryption for Kerberos 5", "https://tools.ietf.org/rfc/rfc3962.txt"),
        new LinkItem("NIST SP 800-38A - Addendum", "https://csrc.nist.gov/publications/detail/sp/800-38a/addendum/final"),
        new LinkItem("IEEE P1363 - CTS Definition", "https://standards.ieee.org/standard/1363-2000.html")
      ];

      this.references = [
        new LinkItem("Applied Cryptography", "Bruce Schneier - CTS Mode"),
        new LinkItem("Handbook of Applied Cryptography", "Chapter 7 - Block Cipher Modes")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("IV Reuse", "Reusing IV with same key reveals patterns. Always use unique IVs."),
        new Vulnerability("Minimum Length", "Requires at least one full block. Cannot encrypt data shorter than block size."),
        new Vulnerability("Error Propagation", "Like CBC, single-bit errors in ciphertext affect two plaintext blocks.")
      ];

      // RFC 3962 Appendix B, "Some test vectors for CBC with ciphertext
      // stealing, using an initial vector of all-zero" (AES-128, key
      // "chicken teriyaki"). These pin the CS3 block ordering.
      this.tests = [
        {
          text: "RFC 3962 CTS - 17 bytes (one byte past a block boundary)",
          uri: "https://www.rfc-editor.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b652074686520"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c6353568f2bf8cb4d8a580362da7ff7f97")
        },
        {
          text: "RFC 3962 CTS - 31 bytes (partial final block)",
          uri: "https://www.rfc-editor.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b65207468652047656e6572616c20476175277320"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("fc00783e0efdb2c1d445d4c8eff7ed2297687268d6ecccc0c07b25e25ecfe5")
        },
        {
          text: "RFC 3962 CTS - 32 bytes (exact multiple, last two blocks swapped)",
          uri: "https://www.rfc-editor.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b65207468652047656e6572616c2047617527732043"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("39312523a78662d5be7fcbcc98ebf5a897687268d6ecccc0c07b25e25ecfe584")
        },
        {
          text: "RFC 3962 CTS - 47 bytes (three blocks, partial final)",
          uri: "https://www.rfc-editor.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b65207468652047656e6572616c20476175277320436869636b656e2c20706c656173652c"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("97687268d6ecccc0c07b25e25ecfe584b3fffd940c16a18c1b5549d2f838029e39312523a78662d5be7fcbcc98ebf5")
        },
        {
          text: "RFC 3962 CTS - 48 bytes (three exact blocks)",
          uri: "https://www.rfc-editor.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b65207468652047656e6572616c20476175277320436869636b656e2c20706c656173652c20"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("97687268d6ecccc0c07b25e25ecfe5849dad8bbb96c4cdc03bc103e1a194bbd839312523a78662d5be7fcbcc98ebf5a8")
        },
        {
          text: "RFC 3962 CTS - 64 bytes (four exact blocks)",
          uri: "https://www.rfc-editor.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b65207468652047656e6572616c20476175277320436869636b656e2c20706c656173652c20616e6420776f6e746f6e20736f75702e"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("97687268d6ecccc0c07b25e25ecfe58439312523a78662d5be7fcbcc98ebf5a84807efe836ee89a526730dbc2f7bc8409dad8bbb96c4cdc03bc103e1a194bbd8")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CtsModeInstance(this, isInverse);
    }
  }

  /**
   * Block layout of the buffered message
   */
  class CtsLayout {
    /**
     * @param {int32} blockSize - Cipher block size in bytes
     * @param {int32} totalLen - Message length in bytes
     * @param {int32} lastLen - Length of the last (possibly partial) block, 1..blockSize
     * @param {int32} chunkCount - Number of blocks including the last one
     */
    constructor(blockSize, totalLen, lastLen, chunkCount) {
      /** @type {int32} */
      this.blockSize = blockSize;
      /** @type {int32} */
      this.totalLen = totalLen;
      /** @type {int32} */
      this.lastLen = lastLen;
      /** @type {int32} */
      this.chunkCount = chunkCount;
    }
  }

  /**
 * CtsMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CtsModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {CtsAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {IBlockCipherInstance|null} */
      this.blockCipher = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this.iv = null;
      /** @type {int32} */
      this._cipherBlockSize = 0;
    }

    /**
     * @param {IBlockCipherInstance} cipher - Block cipher instance
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
      this._cipherBlockSize = cipher.BlockSize;
    }

    /**
     * @param {uint8[]} iv
     */
    setIV(iv) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before IV");
      }
      if (!iv || iv.length !== this._cipherBlockSize) {
        throw new Error("IV must be " + this._cipherBlockSize + " bytes");
      }
      this.iv = [...iv];
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
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
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
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this._cipherBlockSize;

      // CTS requires at least one full block
      if (this.inputBuffer.length < blockSize) {
        throw new Error("CTS requires at least " + blockSize + " bytes (one full block)");
      }

      /** @type {uint8[]} */
      const result = this.isInverse ? this._decrypt() : this._encrypt();

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * Number of ciphertext/plaintext blocks and the length of the last one.
     * The last block holds between 1 and blockSize bytes; a length that is an
     * exact multiple of the block size still counts as a full final block, and
     * CS3 swaps the last two blocks in that case too.
     * @private
     * @returns {CtsLayout}
     */
    _layout() {
      const blockSize = this._cipherBlockSize;
      const totalLen = this.inputBuffer.length;
      const remainder = totalLen % blockSize;
      const lastLen = remainder === 0 ? blockSize : remainder;
      const chunkCount = (totalLen - lastLen) / blockSize + 1;
      const layout = new CtsLayout(blockSize, totalLen, lastLen, chunkCount);
      return layout;
    }

    /**
     * @private
     * @param {uint8[]} block
     * @returns {uint8[]}
     */
    _encipherBlock(block) {
      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.blockCipher.key;
      cipher.Feed(block);
      /** @type {uint8[]} */
      const processed = cipher.Result();
      return processed;
    }

    /**
     * @private
     * @param {uint8[]} block
     * @returns {uint8[]}
     */
    _decipherBlock(block) {
      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(true);
      cipher.key = this.blockCipher.key;
      cipher.Feed(block);
      /** @type {uint8[]} */
      const processed = cipher.Result();
      return processed;
    }

    /**
     * @returns {uint8[]}
     */
    _encrypt() {
      /** @type {CtsLayout} */
      const layout = this._layout();
      /** @type {int32} */
      const blockSize = layout.blockSize;
      /** @type {int32} */
      const lastLen = layout.lastLen;
      /** @type {int32} */
      const chunkCount = layout.chunkCount;

      /** @type {uint8[]} */
      const output = [];
      let previousBlock = [...this.iv];

      // Blocks 1 .. n-2 are plain CBC
      for (let i = 0; i < chunkCount - 2; i++) {
        const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
        const encryptedBlock = this._encipherBlock(OpCodes.XorArrays(block, previousBlock));
        for (let _i = 0; _i < encryptedBlock.length; _i++) output.push(encryptedBlock[_i]);
        previousBlock = encryptedBlock;
      }

      if (chunkCount === 1) {
        // A single block cannot steal anything; it is plain CBC.
        const block = this.inputBuffer.slice(0, blockSize);
        const encryptedBlock = this._encipherBlock(OpCodes.XorArrays(block, previousBlock));
        for (let _i = 0; _i < encryptedBlock.length; _i++) output.push(encryptedBlock[_i]);
        return output;
      }

      // CBC-CS3 (RFC 3962) for the last two blocks:
      //   C*_{n-1} = E(P_{n-1} XOR C_{n-2})
      //   C_n      = MSB_d(C*_{n-1})
      //   C_{n-1}  = E((P_n || 0^{b-d}) XOR C*_{n-1})
      // and the two are emitted in the order C_{n-1} then C_n.
      const penultimateStart = (chunkCount - 2) * blockSize;
      const penultimateBlock = this.inputBuffer.slice(penultimateStart, penultimateStart + blockSize);
      const finalBlock = this.inputBuffer.slice(penultimateStart + blockSize);

      const encryptedPenultimate = this._encipherBlock(OpCodes.XorArrays(penultimateBlock, previousBlock));

      // The final plaintext block is zero-padded, then chained on C*_{n-1}.
      const paddedFinal = OpCodes.CreateArray(blockSize, 0);
      for (let i = 0; i < lastLen; i++) paddedFinal[i] = finalBlock[i];

      const encryptedFinal = this._encipherBlock(OpCodes.XorArrays(paddedFinal, encryptedPenultimate));

      for (let _i = 0; _i < encryptedFinal.length; _i++) output.push(encryptedFinal[_i]);
      for (let _i = 0; _i < lastLen; _i++) output.push(encryptedPenultimate[_i]);

      return output;
    }

    /**
     * @returns {uint8[]}
     */
    _decrypt() {
      /** @type {CtsLayout} */
      const layout = this._layout();
      /** @type {int32} */
      const blockSize = layout.blockSize;
      /** @type {int32} */
      const lastLen = layout.lastLen;
      /** @type {int32} */
      const chunkCount = layout.chunkCount;

      /** @type {uint8[]} */
      const output = [];
      let previousBlock = [...this.iv];

      // Blocks 1 .. n-2 are plain CBC
      for (let i = 0; i < chunkCount - 2; i++) {
        const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);
        const plainBlock = OpCodes.XorArrays(this._decipherBlock(block), previousBlock);
        for (let _i = 0; _i < plainBlock.length; _i++) output.push(plainBlock[_i]);
        previousBlock = block;
      }

      if (chunkCount === 1) {
        const block = this.inputBuffer.slice(0, blockSize);
        const plainBlock = OpCodes.XorArrays(this._decipherBlock(block), previousBlock);
        for (let _i = 0; _i < plainBlock.length; _i++) output.push(plainBlock[_i]);
        return output;
      }

      // Inverse of CS3: the full block on the wire is C_{n-1}, followed by the
      // d-byte C_n which is the head of C*_{n-1}.
      const penultimateStart = (chunkCount - 2) * blockSize;
      const wireFullBlock = this.inputBuffer.slice(penultimateStart, penultimateStart + blockSize);
      const wireTail = this.inputBuffer.slice(penultimateStart + blockSize);

      // Z = D(C_{n-1}) = (P_n || 0^{b-d}) XOR C*_{n-1}
      const z = this._decipherBlock(wireFullBlock);

      // C*_{n-1} = C_n || LSB_{b-d}(Z)
      /** @type {uint8[]} */
      const starBlock = new Array(blockSize);
      for (let i = 0; i < lastLen; i++) starBlock[i] = wireTail[i];
      for (let i = lastLen; i < blockSize; i++) starBlock[i] = z[i];

      // P_n = MSB_d(Z XOR C*_{n-1})
      /** @type {uint8[]} */
      const plainFinal = [];
      for (let i = 0; i < lastLen; i++) plainFinal.push(OpCodes.Xor8(z[i], starBlock[i]));

      // P_{n-1} = D(C*_{n-1}) XOR C_{n-2}
      const plainPenultimate = OpCodes.XorArrays(this._decipherBlock(starBlock), previousBlock);

      for (let _i = 0; _i < plainPenultimate.length; _i++) output.push(plainPenultimate[_i]);
      for (let _i = 0; _i < plainFinal.length; _i++) output.push(plainFinal[_i]);

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new CtsAlgorithm());

  // ===== EXPORTS =====

  return { CtsAlgorithm, CtsModeInstance };
}));