/*
 * OCB (Offset CodeBook) Mode of Operation - Consolidated
 * Authenticated encryption mode with parallelizable processing
 * Includes both OCB (2001) and OCB3 (2011/RFC 7253) variants
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
    root.OCB = factory(root.AlgorithmFramework, root.OpCodes);
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

  // ===== SHARED UTILITIES =====

  /**
   * Ciphertext and tag of one OCB encryption
   */
  class OcbSealed {
    /**
     * @param {uint8[]} ciphertext - Encrypted message
     * @param {uint8[]} tag - Authentication tag (already truncated)
     */
    constructor(ciphertext, tag) {
      /** @type {uint8[]} */
      this.ciphertext = ciphertext;
      /** @type {uint8[]} */
      this.tag = tag;
    }
  }

  /**
   * Shared OCB utilities for both OCB and OCB3
   */
  class OcbSharedUtils {
    /**
     * Double a value in GF(2^128) (multiply by α = x)
     * @param {uint8[]} value - 128-bit value to double
     * @returns {uint8[]} Doubled value in GF(2^128)
     */
    static gf128Double(value) {
      /** @type {uint8[]} */
      const result = new Array(16);
      /** @type {uint32} */
      let carry = 0;

      // Shift left by 1 bit (multiply by x). The value is big-endian, so byte 0
      // holds the most significant bits and the carry travels towards it.
      for (let i = 15; i >= 0; i--) {
        const newCarry = OpCodes.Shr32(value[i], 7);
        result[i] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(value[i], 1), carry), 0xFF);
        carry = newCarry;
      }

      // If the top bit overflowed, reduce by x^128 + x^7 + x^2 + x + 1. The
      // reduction polynomial lives at the least significant end of a big-endian
      // value, which is the last byte, not the first.
      if (carry) {
        result[15] = OpCodes.Xor8(result[15], 0x87);
      }

      return result;
    }

    /**
     * Number of trailing zeros in binary representation
     * @param {int32} n - Number
     * @returns {int32} Number of trailing zeros
     */
    static ntz(n) {
      if (n === 0) return 0;
      let count = 0;
      while (OpCodes.And32(n, 1) === 0) {
        count++;
        n = OpCodes.Shr32(n, 1);
      }
      return count;
    }

    /**
     * Generate L value: L = E_K(0^n)
     * @param {IBlockCipherInstance} blockCipher - Block cipher instance
     * @param {uint8[]} key - Encryption key
     * @returns {uint8[]} L value
     */
    static generateL(blockCipher, key) {
      const zero = OpCodes.CreateArray(16, 0);
      /** @type {IBlockCipherInstance} */
      const cipher = blockCipher.algorithm.CreateInstance(false);
      cipher.key = key;
      cipher.Feed(zero);
      /** @type {uint8[]} */
      const l = cipher.Result();
      return l;
    }
  }

  // ===== OCB ALGORITHM (2001) =====

  class OcbAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "OCB";
      this.description = "OCB (Offset CodeBook) is an authenticated encryption mode that provides both confidentiality and authenticity in a single pass. It uses offset-based processing that allows for parallel computation while maintaining strong security guarantees. OCB is highly efficient but was patent-encumbered until 2028.";
      this.inventor = "Phillip Rogaway";
      this.year = 2001;
      this.category = CategoryType.MODE;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Patent issues until recently
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = true; // Uses nonce
      this.SupportedIVSizes = [
        new KeySize(12, 15, 1) // Typical nonce sizes for OCB
      ];

      this.documentation = [
        new LinkItem("RFC 7253 - OCB Authenticated Encryption", "https://tools.ietf.org/rfc/rfc7253.txt"),
        new LinkItem("OCB Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/ocb-full.pdf"),
        new LinkItem("OCB3 Specification", "https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-back.htm")
      ];

      this.references = [
        new LinkItem("OCB Reference Implementation", "https://github.com/rweather/arduinolibs/tree/master/libraries/Crypto"),
        new LinkItem("LibOCB", "https://github.com/rweather/arduinolibs/blob/master/libraries/Crypto/OCB.cpp"),
        new LinkItem("Python OCB", "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Cipher/_mode_ocb.py")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Patent Status", "OCB was patent-encumbered until 2028, limiting adoption. Now free for use but still not widely deployed."),
        new Vulnerability("Nonce Reuse", "Reusing nonces with the same key completely breaks OCB security and reveals plaintext patterns."),
        new Vulnerability("Implementation Complexity", "OCB requires careful implementation of offset calculations and GF(2^128) arithmetic.")
      ];

      // Round-trip test vectors based on Rogaway's OCB
      this.tests = [
        {
          text: "OCB round-trip test #1 - 1 byte",
          uri: "https://web.cs.ucdavis.edu/~rogaway/ocb/",
          input: OpCodes.Hex8ToBytes("01"), // Use 1 byte instead of empty
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221100"),
          aad: OpCodes.Hex8ToBytes(""),
          tagLength: 16
        },
        {
          text: "OCB round-trip test #2 - 8-byte plaintext",
          uri: "https://web.cs.ucdavis.edu/~rogaway/ocb/",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221101"),
          aad: OpCodes.Hex8ToBytes(""),
          tagLength: 16
        },
        {
          text: "OCB round-trip test #3 - With AAD",
          uri: "https://web.cs.ucdavis.edu/~rogaway/ocb/",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221102"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          tagLength: 16
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new OcbModeInstance(this, isInverse);
    }
  }

  /**
 * OcbMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class OcbModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {OcbAlgorithm} algorithm - Parent algorithm instance
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
      this.key = null;
      /** @type {uint8[]|null} */
      this.nonce = null;
      /** @type {uint8[]} */
      this.aad = []; // Additional Authenticated Data
      /** @type {int32} */
      this.tagLength = 16; // Default 128-bit tag
    }

    /**
     * Set the underlying block cipher instance
     * @param {IBlockCipherInstance} cipher - The block cipher to use (typically AES)
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      if (cipher.BlockSize !== 16) {
        throw new Error("OCB mode requires 128-bit block cipher (typically AES)");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the encryption key
     * @param {uint8[]} key - Block cipher key
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Key cannot be empty");
      }
      this.key = [...key];
    }

    /**
     * Set the nonce (number used once)
     * @param {uint8[]} nonce - Nonce value (must be unique for each encryption)
     */
    setNonce(nonce) {
      if (!nonce || nonce.length < 12 || nonce.length > 15) {
        throw new Error("OCB nonce must be 12-15 bytes");
      }
      this.nonce = [...nonce];
    }

    /**
     * Set additional authenticated data
     * @param {uint8[]} aad - Additional authenticated data
     */
    setAAD(aad) {
      if (aad) {
        this.aad = [...aad];
      } else {
        /** @type {uint8[]} */
        const empty = [];
        this.aad = empty;
      }
    }

    /**
     * Set the authentication tag length
     * @param {int32} length - Tag length in bytes (8-16)
     */
    setTagLength(length) {
      if (length < 8 || length > 16) {
        throw new Error("OCB tag length must be 8-16 bytes");
      }
      this.tagLength = length;
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
      if (!this.key) {
        throw new Error("Key must be set for OCB mode.");
      }
      if (!this.nonce) {
        throw new Error("Nonce must be set for OCB mode.");
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
      if (!this.key) {
        throw new Error("Key must be set for OCB mode.");
      }
      if (!this.nonce) {
        throw new Error("Nonce must be set for OCB mode.");
      }

      const blockSize = this.blockCipher.BlockSize;

      if (this.isInverse) {
        // OCB Decryption and verification
        return this._decrypt();
      } else {
        // OCB Encryption and authentication - return concatenated ciphertext+tag for test compatibility
        const result = this._encrypt();
        /** @type {uint8[]} */
        const ciphertext = result.ciphertext;
        /** @type {uint8[]} */
        const tag = result.tag;
        /** @type {uint8[]} */
        const sealed = [...ciphertext, ...tag];
        return sealed;
      }
    }

    /**
     * OCB encryption (simplified educational implementation)
     * @returns {OcbSealed} Object containing ciphertext and authentication tag
     */
    _encrypt() {
      const blockSize = this.blockCipher.BlockSize;
      const plaintext = this.inputBuffer;

      // Initialize OCB state
      /** @type {uint8[]} */
      const L = OcbSharedUtils.generateL(this.blockCipher, this.key);
      const offset = this._processNonce(L);

      let checksum = OpCodes.CreateArray(blockSize, 0);
      /** @type {uint8[]} */
      const ciphertext = [];

      // Process full blocks
      const fullBlocks = Math.floor(plaintext.length / blockSize);
      for (let i = 0; i < fullBlocks; i++) {
        const block = plaintext.slice(i * blockSize, (i + 1) * blockSize);

        // Calculate offset for this block
        const blockOffset = this._getOffset(L, i + 1);
        const combinedOffset = OpCodes.XorArrays(offset, blockOffset);

        // OCB encryption: C_i = E_K(P_i ⊕ Offset_i) ⊕ Offset_i
        const xorInput = OpCodes.XorArrays(block, combinedOffset);

        /** @type {IBlockCipherInstance} */
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(xorInput);
        /** @type {uint8[]} */
        const encrypted = cipher.Result();

        const cipherBlock = OpCodes.XorArrays(encrypted, combinedOffset);
        for (let _i = 0; _i < cipherBlock.length; _i++) ciphertext.push(cipherBlock[_i]);

        // Update checksum
        checksum = OpCodes.XorArrays(checksum, block);
      }

      // Handle final partial block if present
      if (plaintext.length % blockSize !== 0) {
        const finalBlock = plaintext.slice(fullBlocks * blockSize);
        const pad = this._generatePad(L, finalBlock.length);

        // XOR with pad
        /** @type {uint8[]} */
        const paddedBlock = [];
        for (let i = 0; i < finalBlock.length; i++) {
          paddedBlock[i] = OpCodes.Xor8(finalBlock[i], pad[i]);
        }
        for (let _i = 0; _i < paddedBlock.length; _i++) ciphertext.push(paddedBlock[_i]);

        // Update checksum with padded final block
        /** @type {uint8[]} */
        const finalChecksum = [...finalBlock];
        finalChecksum.push(0x80); // Padding bit
        while (finalChecksum.length < blockSize) {
          finalChecksum.push(0);
        }
        checksum = OpCodes.XorArrays(checksum, finalChecksum);
      }

      // Generate authentication tag
      const tag = this._generateTag(L, checksum, this.aad);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(checksum);
      this.inputBuffer = [];

      const sealed = new OcbSealed(
        ciphertext,
        tag.slice(0, this.tagLength)
      );
      return sealed;
    }

    /**
     * OCB decryption and authentication verification
     * @returns {uint8[]} Decrypted plaintext
     */
    _decrypt() {
      const blockSize = this.blockCipher.BlockSize;

      // Extract ciphertext and tag
      if (this.inputBuffer.length < this.tagLength) {
        throw new Error("Input too short for authentication tag");
      }

      const ciphertext = this.inputBuffer.slice(0, -this.tagLength);
      const receivedTag = this.inputBuffer.slice(-this.tagLength);

      // Initialize OCB state
      /** @type {uint8[]} */
      const L = OcbSharedUtils.generateL(this.blockCipher, this.key);
      const offset = this._processNonce(L);

      let checksum = OpCodes.CreateArray(blockSize, 0);
      /** @type {uint8[]} */
      const plaintext = [];

      // Process full blocks
      const fullBlocks = Math.floor(ciphertext.length / blockSize);
      for (let i = 0; i < fullBlocks; i++) {
        const block = ciphertext.slice(i * blockSize, (i + 1) * blockSize);

        // Calculate offset for this block
        const blockOffset = this._getOffset(L, i + 1);
        const combinedOffset = OpCodes.XorArrays(offset, blockOffset);

        // OCB decryption: P_i = D_K(C_i ⊕ Offset_i) ⊕ Offset_i
        const xorInput = OpCodes.XorArrays(block, combinedOffset);

        /** @type {IBlockCipherInstance} */
        const cipher = this.blockCipher.algorithm.CreateInstance(true);
        cipher.key = this.key;
        cipher.Feed(xorInput);
        /** @type {uint8[]} */
        const decrypted = cipher.Result();

        const plainBlock = OpCodes.XorArrays(decrypted, combinedOffset);
        for (let _i = 0; _i < plainBlock.length; _i++) plaintext.push(plainBlock[_i]);

        // Update checksum
        checksum = OpCodes.XorArrays(checksum, plainBlock);
      }

      // Handle final partial block if present
      if (ciphertext.length % blockSize !== 0) {
        const finalBlock = ciphertext.slice(fullBlocks * blockSize);
        const pad = this._generatePad(L, finalBlock.length);

        // XOR with pad to get plaintext
        /** @type {uint8[]} */
        const plaintextBlock = [];
        for (let i = 0; i < finalBlock.length; i++) {
          plaintextBlock[i] = OpCodes.Xor8(finalBlock[i], pad[i]);
        }
        for (let _i = 0; _i < plaintextBlock.length; _i++) plaintext.push(plaintextBlock[_i]);

        // Update checksum with padded final block
        /** @type {uint8[]} */
        const finalChecksum = [...plaintextBlock];
        finalChecksum.push(0x80); // Padding bit
        while (finalChecksum.length < blockSize) {
          finalChecksum.push(0);
        }
        checksum = OpCodes.XorArrays(checksum, finalChecksum);
      }

      // Verify authentication tag
      const expectedTag = this._generateTag(L, checksum, this.aad);
      if (!OpCodes.SecureCompare(receivedTag, expectedTag.slice(0, this.tagLength))) {
        throw new Error("OCB authentication failed - tag mismatch");
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(checksum);
      this.inputBuffer = [];

      return plaintext;
    }

    /**
     * Process nonce to generate initial offset
     * @param {uint8[]} L - L value from block cipher
     * @returns {uint8[]} Initial offset
     */
    _processNonce(L) {
      // Simplified nonce processing (educational)
      const noncePadded = [...this.nonce];
      while (noncePadded.length < 16) {
        noncePadded.push(0);
      }

      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(noncePadded);
      /** @type {uint8[]} */
      const offset = cipher.Result();
      return offset;
    }

    /**
     * Calculate offset for block i
     * @param {uint8[]} L - L value
     * @param {int32} i - Block index
     * @returns {uint8[]} Offset for block i
     */
    _getOffset(L, i) {
      // Simplified offset calculation (educational)
      const offset = [...L];
      for (let j = 0; j < 16; j++) {
        offset[j] = OpCodes.Xor8(offset[j], OpCodes.And32(i + j, 0xFF));
      }
      return offset;
    }

    /**
     * Generate padding for final partial block
     * @param {uint8[]} L - L value
     * @param {int32} length - Length of final block
     * @returns {uint8[]} Padding stream
     */
    _generatePad(L, length) {
      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(L);
      /** @type {uint8[]} */
      const pad = cipher.Result();
      return pad.slice(0, length);
    }

    /**
     * Generate authentication tag
     * @param {uint8[]} L - L value
     * @param {uint8[]} checksum - Accumulated checksum
     * @param {uint8[]} aad - Additional authenticated data
     * @returns {uint8[]} Authentication tag
     */
    _generateTag(L, checksum, aad) {
      // Simplified tag generation (educational)
      let tagInput = OpCodes.XorArrays(checksum, L);

      // Process AAD (simplified)
      for (let i = 0; i < aad.length; i++) {
        tagInput[i % 16] = OpCodes.Xor8(tagInput[i % 16], aad[i]);
      }

      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(tagInput);
      /** @type {uint8[]} */
      const tag = cipher.Result();
      return tag;
    }
  }

  // ===== OCB3 ALGORITHM (2011/RFC 7253) =====

  class Ocb3Algorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "OCB3";
      this.description = "OCB3 (Offset CodeBook Mode version 3) is a highly efficient authenticated encryption mode that provides both confidentiality and authenticity in a single pass. It supports parallel processing and was standardized in RFC 7253. OCB3 improves upon earlier OCB versions with enhanced security and performance.";
      this.inventor = "Phillip Rogaway, Ted Krovetz";
      this.year = 2011;
      this.category = CategoryType.MODE;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE; // RFC standardized and patent-free since 2028
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = true; // Uses nonce
      this.SupportedIVSizes = [
        new KeySize(1, 15, 1) // OCB3 supports 1-15 byte nonces
      ];

      this.documentation = [
        new LinkItem("RFC 7253 - OCB3", "https://tools.ietf.org/rfc/rfc7253.txt"),
        new LinkItem("OCB3 Specification", "https://web.cs.ucdavis.edu/~rogaway/ocb/ocb-back.htm"),
        new LinkItem("CAESAR Competition", "https://competitions.cr.yp.to/round3/ocbv11.pdf")
      ];

      this.references = [
        new LinkItem("Reference Implementation", "https://github.com/rweather/arduinolibs/tree/master/libraries/Crypto"),
        new LinkItem("OCB3 in LibTomCrypt", "https://github.com/libtom/libtomcrypt/blob/develop/src/encauth/ocb3/ocb3_encrypt.c"),
        new LinkItem("Python Implementation", "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Cipher/_mode_ocb.py")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse", "Reusing nonces with the same key completely breaks OCB3 security. Each encryption must use a unique nonce."),
        new Vulnerability("Patent History", "OCB was patent-encumbered until 2028. Now free for use but still requires careful implementation.")
      ];

      // RFC 7253 Appendix A sample results (K = 000102030405060708090A0B0C0D0E0F
      // except where noted); the expected value is C = ciphertext || tag.
      this.tests = [
        {
          text: "RFC 7253 AES-128 OCB TAGLEN128, N=...01, 8-byte plaintext",
          uri: "https://www.rfc-editor.org/rfc/rfc7253.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221101"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          tagLength: 16,
          expected: OpCodes.Hex8ToBytes("6820B3657B6F615A5725BDA0D3B4EB3A257C9AF1F8F03009")
        },
        {
          text: "RFC 7253 AES-128 OCB TAGLEN128, N=...03, empty AAD",
          uri: "https://www.rfc-editor.org/rfc/rfc7253.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221103"),
          aad: [],
          tagLength: 16,
          expected: OpCodes.Hex8ToBytes("45DD69F8F5AAE72414054CD1F35D82760B2CD00D2F99BFA9")
        },
        {
          text: "RFC 7253 AES-128 OCB TAGLEN128, N=...04, one full block",
          uri: "https://www.rfc-editor.org/rfc/rfc7253.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221104"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          tagLength: 16,
          expected: OpCodes.Hex8ToBytes("571D535B60B277188BE5147170A9A22C3AD7A4FF3835B8C5701C1CCEC8FC3358")
        },
        {
          text: "RFC 7253 AES-128 OCB TAGLEN128, N=...07, block plus half block",
          uri: "https://www.rfc-editor.org/rfc/rfc7253.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("BBAA99887766554433221107"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          tagLength: 16,
          expected: OpCodes.Hex8ToBytes("1CA2207308C87C010756104D8840CE1952F09673A448A122C92C62241051F57356D7F3C90BB0E07F")
        },
        {
          text: "RFC 7253 AES-128 OCB TAGLEN128, N=...0D, 40-byte plaintext",
          uri: "https://www.rfc-editor.org/rfc/rfc7253.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F2021222324252627"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("BBAA9988776655443322110D"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F2021222324252627"),
          tagLength: 16,
          expected: OpCodes.Hex8ToBytes("D5CA91748410C1751FF8A2F618255B68A0A12E093FF454606E59F9C1D0DDC54B65E8628E568BAD7AED07BA06A4A69483A7035490C5769E60")
        },
        {
          text: "RFC 7253 OCB TAGLEN96 with key 0F0E...0100",
          uri: "https://www.rfc-editor.org/rfc/rfc7253.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F2021222324252627"),
          key: OpCodes.Hex8ToBytes("0F0E0D0C0B0A09080706050403020100"),
          nonce: OpCodes.Hex8ToBytes("BBAA9988776655443322110D"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F2021222324252627"),
          tagLength: 12,
          expected: OpCodes.Hex8ToBytes("1792A4E31E0755FB03E31B22116E6C2DDF9EFD6E33D536F1A0124B0A55BAE884ED93481529C76B6AD0C515F4D1CDD4FDAC4F02AA")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Ocb3ModeInstance(this, isInverse);
    }
  }

  /**
 * Ocb3Mode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Ocb3ModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Ocb3Algorithm} algorithm - Parent algorithm instance
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
      this.key = null;
      /** @type {uint8[]|null} */
      this.nonce = null;
      /** @type {uint8[]} */
      this.aad = []; // Additional Authenticated Data
      /** @type {int32} */
      this.tagLength = 16; // Default 128-bit tag

      // OCB3 state
      /** @type {uint8[]|null} */
      this.L = null; // L = E_K(0^n)
      /** @type {uint8[]|null} */
      this.LDollar = null; // L$ = L ⊕ (OpCodes.Shl32(L, 1))
      /** @type {uint8[][]} */
      this.LTable = []; // L[i] for offset calculations
    }

    /**
     * Set the underlying block cipher instance (must be AES)
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      if (cipher.BlockSize !== 16) {
        throw new Error("OCB3 mode requires 128-bit block cipher (AES)");
      }
      this.blockCipher = cipher;
      // Precompute tables if key is already set
      if (this.key) {
        this._precomputeTables();
      }
    }

    /**
     * Set the encryption key and precompute OCB3 tables
     * @param {uint8[]} key - AES key
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Key cannot be empty");
      }
      this.key = [...key];
      // Only precompute if block cipher is available
      if (this.blockCipher) {
        this._precomputeTables();
      }
    }

    /**
     * Set the nonce (number used once)
     * @param {uint8[]} nonce - Nonce value (1-15 bytes)
     */
    setNonce(nonce) {
      if (!nonce || nonce.length < 1 || nonce.length > 15) {
        throw new Error("OCB3 nonce must be 1-15 bytes");
      }
      this.nonce = [...nonce];
    }

    /**
     * Set additional authenticated data
     * @param {uint8[]} aad - Additional authenticated data
     */
    setAAD(aad) {
      if (aad) {
        this.aad = [...aad];
      } else {
        /** @type {uint8[]} */
        const empty = [];
        this.aad = empty;
      }
    }

    /**
     * Set the authentication tag length
     * @param {int32} length - Tag length in bytes (1-16)
     */
    setTagLength(length) {
      if (length < 1 || length > 16) {
        throw new Error("OCB3 tag length must be 1-16 bytes");
      }
      this.tagLength = length;
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
      if (!this.key) {
        throw new Error("Key must be set for OCB3 mode.");
      }
      if (!this.nonce) {
        throw new Error("Nonce must be set for OCB3 mode.");
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
      if (!this.key) {
        throw new Error("Key must be set for OCB3 mode.");
      }
      if (!this.nonce) {
        throw new Error("Nonce must be set for OCB3 mode.");
      }

      // Ensure tables are precomputed
      if (!this.L || !this.LDollar || this.LTable.length === 0) {
        this._precomputeTables();
      }

      if (this.isInverse) {
        return this._decrypt();
      } else {
        const result = this._encrypt();
        /** @type {uint8[]} */
        const ciphertext = result.ciphertext;
        /** @type {uint8[]} */
        const tag = result.tag;
        /** @type {uint8[]} */
        this.lastTag = tag;
        // RFC 7253 defines the ciphertext as C_1 .. C_* || Tag, so the tag is
        // appended here exactly as GCM and CCM do in this library.
        /** @type {uint8[]} */
        const combined = [];
        for (let _i = 0; _i < ciphertext.length; _i++) combined.push(ciphertext[_i]);
        for (let _i = 0; _i < tag.length; _i++) combined.push(tag[_i]);
        return combined;
      }
    }

    /**
     * Apply the underlying block cipher in the forward direction
     * @private
     * @param {uint8[]} block
     * @returns {uint8[]}
     */
    _encipher(block) {
      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(block);
      /** @type {uint8[]} */
      const processed = cipher.Result();
      return processed;
    }

    /**
     * Apply the underlying block cipher in the inverse direction
     * @private
     * @param {uint8[]} block
     * @returns {uint8[]}
     */
    _decipher(block) {
      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(true);
      cipher.key = this.key;
      cipher.Feed(block);
      /** @type {uint8[]} */
      const processed = cipher.Result();
      return processed;
    }

    /**
     * OCB3 encryption following RFC 7253
     * @returns {OcbSealed} Object containing ciphertext and authentication tag
     */
    _encrypt() {
      const plaintext = this.inputBuffer;
      const m = Math.floor(plaintext.length / 16); // Number of complete blocks

      // Step 1: Process nonce to get initial offset
      let currentOffset = this._processNonce();

      // Step 2: Initialize checksum
      let checksum = OpCodes.CreateArray(16, 0);
      /** @type {uint8[]} */
      const ciphertext = [];

      // Step 3: Process complete blocks
      for (let i = 1; i <= m; i++) {
        const block = plaintext.slice((i - 1) * 16, i * 16);

        // Update offset: Offset_i = Offset_{i-1} ⊕ L[ntz(i)]
        const Li = this._getLi(OcbSharedUtils.ntz(i));
        currentOffset = OpCodes.XorArrays(currentOffset, Li);

        // Encrypt: C_i = E_K(P_i ⊕ Offset_i) ⊕ Offset_i
        const encrypted = this._encipher(OpCodes.XorArrays(block, currentOffset));
        const cipherBlock = OpCodes.XorArrays(encrypted, currentOffset);

        for (let _i = 0; _i < cipherBlock.length; _i++) ciphertext.push(cipherBlock[_i]);

        // Update checksum: Checksum = Checksum ⊕ P_i
        checksum = OpCodes.XorArrays(checksum, block);
      }

      // Step 4: Process final partial block if present
      let finalOffset = currentOffset;
      if (plaintext.length % 16 !== 0) {
        const finalBlock = plaintext.slice(m * 16);

        // Offset_* = Offset_m ⊕ L_*  (L_*, the encryption of the zero block,
        // not L_$ which only takes part in the tag)
        finalOffset = OpCodes.XorArrays(currentOffset, this.L);

        // Pad = E_K(Offset_*)
        const pad = this._encipher(finalOffset);

        // C_* = P_* ⊕ Pad[1..len(P_*)]
        /** @type {uint8[]} */
        const finalCipher = [];
        for (let i = 0; i < finalBlock.length; i++) {
          finalCipher[i] = OpCodes.Xor8(finalBlock[i], pad[i]);
        }
        for (let _i = 0; _i < finalCipher.length; _i++) ciphertext.push(finalCipher[_i]);

        // Update checksum: Checksum = Checksum ⊕ (P_* || 1 || 0^{127-8*len(P_*)})
        /** @type {uint8[]} */
        const paddedFinal = [...finalBlock];
        paddedFinal.push(0x80); // Append 1 bit
        while (paddedFinal.length < 16) {
          paddedFinal.push(0x00); // Pad with zeros
        }
        checksum = OpCodes.XorArrays(checksum, paddedFinal);
      }

      // Step 5: Compute authentication tag
      const tag = this._computeTag(checksum, finalOffset);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(checksum);
      this.inputBuffer = [];

      const sealed = new OcbSealed(
        ciphertext,
        tag.slice(0, this.tagLength)
      );
      return sealed;
    }

    /**
     * OCB3 decryption and tag verification following RFC 7253
     * @returns {uint8[]} Decrypted plaintext
     */
    _decrypt() {
      if (this.inputBuffer.length < this.tagLength) {
        throw new Error("Input too short for authentication tag");
      }

      const ciphertext = this.inputBuffer.slice(0, this.inputBuffer.length - this.tagLength);
      const receivedTag = this.inputBuffer.slice(this.inputBuffer.length - this.tagLength);
      const m = Math.floor(ciphertext.length / 16); // Number of complete blocks

      // Step 1: Process nonce to get initial offset
      let currentOffset = this._processNonce();

      // Step 2: Initialize output and checksum
      /** @type {uint8[]} */
      const output = [];
      let checksum = OpCodes.CreateArray(16, 0);

      // Step 3: Process complete blocks (reverse of encryption)
      for (let i = 1; i <= m; i++) {
        const block = ciphertext.slice((i - 1) * 16, i * 16);

        // Update offset: Offset_i = Offset_{i-1} ⊕ L[ntz(i)]
        const Li = this._getLi(OcbSharedUtils.ntz(i));
        currentOffset = OpCodes.XorArrays(currentOffset, Li);

        // Decrypt: P_i = D_K(C_i ⊕ Offset_i) ⊕ Offset_i
        const decrypted = this._decipher(OpCodes.XorArrays(block, currentOffset));
        const plainBlock = OpCodes.XorArrays(decrypted, currentOffset);

        for (let _i = 0; _i < plainBlock.length; _i++) output.push(plainBlock[_i]);

        checksum = OpCodes.XorArrays(checksum, plainBlock);
      }

      // Step 4: Process final partial block if present
      let finalOffset = currentOffset;
      if (ciphertext.length % 16 !== 0) {
        const finalBlock = ciphertext.slice(m * 16);

        // Offset_* = Offset_m ⊕ L_*, Pad = E_K(Offset_*)
        finalOffset = OpCodes.XorArrays(currentOffset, this.L);
        const pad = this._encipher(finalOffset);

        /** @type {uint8[]} */
        const finalPlain = [];
        for (let i = 0; i < finalBlock.length; i++) {
          finalPlain[i] = OpCodes.Xor8(finalBlock[i], pad[i]);
        }
        for (let _i = 0; _i < finalPlain.length; _i++) output.push(finalPlain[_i]);

        /** @type {uint8[]} */
        const paddedFinal = [...finalPlain];
        paddedFinal.push(0x80);
        while (paddedFinal.length < 16) {
          paddedFinal.push(0x00);
        }
        checksum = OpCodes.XorArrays(checksum, paddedFinal);
      }

      // Step 5: Verify the authentication tag
      const expectedTag = this._computeTag(checksum, finalOffset).slice(0, this.tagLength);
      if (!OpCodes.SecureCompare(receivedTag, expectedTag)) {
        throw new Error("OCB3 authentication failed - tag mismatch");
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(checksum);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Precompute OCB3 tables L, L$, and L[i]
     */
    _precomputeTables() {
      if (!this.key) return;

      // L = E_K(0^n)
      this.L = OcbSharedUtils.generateL(this.blockCipher, this.key);

      // L$ = double(L)
      this.LDollar = OcbSharedUtils.gf128Double(this.L);

      // Precompute L[0], L[1], L[2], ... as needed
      /** @type {uint8[][]} */
      const table = [];
      this.LTable = table;
      /** @type {uint8[]} */
      const l0 = OcbSharedUtils.gf128Double(this.LDollar);
      this.LTable[0] = l0; // L[0] = double(L$)

      // Generate more L[i] values as needed (L[i] = double(L[i-1]))
      for (let i = 1; i < 64; i++) { // Precompute enough for practical use
        /** @type {uint8[]} */
        const li = OcbSharedUtils.gf128Double(this.LTable[i - 1]);
        this.LTable[i] = li;
      }
    }

    /**
     * Process nonce to generate initial offset according to RFC 7253
     * @returns {uint8[]} Initial offset
     */
    _processNonce() {
      /** @type {uint8[]} */
      const nonce = [...this.nonce];
      const len = nonce.length;

      // RFC 7253: Nonce = num2str(TAGLEN mod 128, 7) || zeros(120-bitlen(N)) || 1 || N
      const processedNonce = OpCodes.CreateArray(16, 0);
      processedNonce[0] = OpCodes.And32(OpCodes.Shl32((this.tagLength * 8) % 128, 1), 0xFF);
      processedNonce[15 - len] = OpCodes.Or32(processedNonce[15 - len], 1);
      for (let i = 0; i < len; i++) {
        processedNonce[16 - len + i] = nonce[i];
      }

      // bottom = str2num(Nonce[123..128]) - the six least significant bits
      const bottom = OpCodes.And32(processedNonce[15], 0x3F);

      // Ktop = ENCIPHER(K, Nonce[1..122] || zeros(6))
      /** @type {uint8[]} */
      const ktopInput = [...processedNonce];
      ktopInput[15] = OpCodes.And32(ktopInput[15], 0xC0);
      const ktop = this._encipher(ktopInput);

      // Stretch = Ktop || (Ktop[1..64] xor Ktop[9..72])
      /** @type {uint8[]} */
      const stretch = new Array(24);
      for (let i = 0; i < 16; i++) stretch[i] = ktop[i];
      for (let i = 0; i < 8; i++) stretch[16 + i] = OpCodes.Xor8(ktop[i], ktop[i + 1]);

      // Offset_0 = Stretch[1+bottom..128+bottom]
      const byteShift = Math.floor(bottom / 8);
      const bitShift = bottom % 8;
      /** @type {uint8[]} */
      const offset = new Array(16);
      for (let i = 0; i < 16; i++) {
        if (bitShift === 0) {
          offset[i] = stretch[i + byteShift];
        } else {
          const high = OpCodes.And32(OpCodes.Shl32(stretch[i + byteShift], bitShift), 0xFF);
          const low = OpCodes.Shr32(stretch[i + byteShift + 1], 8 - bitShift);
          offset[i] = OpCodes.Or32(high, low);
        }
      }

      return offset;
    }

    /**
     * Get L[i] from precomputed table
     * @param {int32} i - Index
     * @returns {uint8[]} L[i] value
     */
    _getLi(i) {
      if (i >= this.LTable.length) {
        // Extend table if needed
        while (this.LTable.length <= i) {
          /** @type {uint8[]} */
          const nextL = OcbSharedUtils.gf128Double(this.LTable[this.LTable.length - 1]);
          this.LTable.push(nextL);
        }
      }
      return this.LTable[i];
    }

    /**
     * Compute authentication tag
     * @param {uint8[]} checksum - Accumulated checksum
     * @param {uint8[]} offset - Current offset
     * @returns {uint8[]} Authentication tag
     */
    _computeTag(checksum, offset) {
      // HASH(K, A) per RFC 7253
      let aadChecksum = OpCodes.CreateArray(16, 0);

      if (this.aad.length > 0) {
        const aadBlocks = Math.floor(this.aad.length / 16);
        let aadOffset = OpCodes.CreateArray(16, 0);

        // Process complete AAD blocks
        for (let i = 1; i <= aadBlocks; i++) {
          const aadBlock = this.aad.slice((i - 1) * 16, i * 16);

          const Li = this._getLi(OcbSharedUtils.ntz(i));
          aadOffset = OpCodes.XorArrays(aadOffset, Li);

          const encrypted = this._encipher(OpCodes.XorArrays(aadBlock, aadOffset));
          aadChecksum = OpCodes.XorArrays(aadChecksum, encrypted);
        }

        // Process final partial AAD block if present. The padded block is
        // enciphered after being offset, not merely XORed with a pad.
        if (this.aad.length % 16 !== 0) {
          const finalAAD = this.aad.slice(aadBlocks * 16);
          const finalOffset = OpCodes.XorArrays(aadOffset, this.L);

          /** @type {uint8[]} */
          const paddedAAD = [...finalAAD];
          paddedAAD.push(0x80);
          while (paddedAAD.length < 16) {
            paddedAAD.push(0x00);
          }

          const encrypted = this._encipher(OpCodes.XorArrays(paddedAAD, finalOffset));
          aadChecksum = OpCodes.XorArrays(aadChecksum, encrypted);
        }
      }

      // Tag = ENCIPHER(K, Checksum_* ⊕ Offset_* ⊕ L_$) ⊕ HASH(K, A)
      let tagInput = OpCodes.XorArrays(checksum, offset);
      tagInput = OpCodes.XorArrays(tagInput, this.LDollar);

      return OpCodes.XorArrays(this._encipher(tagInput), aadChecksum);
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new OcbAlgorithm());
  RegisterAlgorithm(new Ocb3Algorithm());

  // ===== EXPORTS =====

  return { OcbAlgorithm, OcbModeInstance, Ocb3Algorithm, Ocb3ModeInstance, OcbSharedUtils };
}));
