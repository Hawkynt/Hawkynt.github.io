/*
 * GCM-SIV Mode of Operation
 * Authenticated encryption with nonce misuse resistance
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
    root.GCMSIV = factory(root.AlgorithmFramework, root.OpCodes);
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

  class GcmSivAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "GCM-SIV";
      this.description = "GCM-SIV is a nonce-misuse resistant authenticated encryption algorithm that provides both privacy and authenticity even when nonces are repeated. It combines POLYVAL hash with AES-CTR encryption in a SIV-like construction, offering strong security guarantees and better performance than traditional SIV modes.";
      this.inventor = "Shay Gueron, Yehuda Lindell";
      this.year = 2017;
      this.category = CategoryType.MODE;
      this.subCategory = "Nonce-Misuse Resistant AEAD";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [new KeySize(16, 16, 0)]; // Fixed 128-bit tag
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("RFC 8452 - AES-GCM-SIV", "https://tools.ietf.org/rfc/rfc8452.txt"),
        new LinkItem("GCM-SIV Paper", "https://eprint.iacr.org/2017/168.pdf"),
        new LinkItem("NIST Consideration", "https://csrc.nist.gov/projects/lightweight-cryptography")
      ];

      this.references = [
        new LinkItem("POLYVAL Specification", "Section 3 of RFC 8452"),
        new LinkItem("Nonce-Misuse Resistance", "https://tools.ietf.org/rfc/rfc5297.txt")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse Safe", "GCM-SIV is specifically designed to be safe against nonce reuse, providing graceful degradation."),
        new Vulnerability("Key Commitment", "Does not provide key commitment - different keys may decrypt to different plaintexts."),
        new Vulnerability("Performance Trade-off", "Slightly slower than GCM due to two-pass construction.")
      ];

      // RFC 8452 Appendix C. The expected value is the full "Result", i.e. the
      // ciphertext with the 16-byte tag appended.
      this.tests = [
        {
          text: "RFC 8452 C.1 AEAD_AES_128_GCM_SIV - 8-byte plaintext, no AAD",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("0100000000000000"),
          key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
          aad: [],
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("b5d839330ac7b786578782fff6013b815b287c22493a364c")
        },
        {
          text: "RFC 8452 C.1 AEAD_AES_128_GCM_SIV - one block, no AAD",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
          aad: [],
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("743f7c8077ab25f8624e2e948579cf77303aaf90f6fe21199c6068577437a0c4")
        },
        {
          text: "RFC 8452 C.1 AEAD_AES_128_GCM_SIV - one block with 1-byte AAD",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("02000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
          aad: OpCodes.Hex8ToBytes("01"),
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("e2b0c5da79a901c1745f700525cb335b8f8936ec039e4e4bb97ebd8c4457441f")
        },
        {
          text: "RFC 8452 C.1 AEAD_AES_128_GCM_SIV - ragged plaintext and AAD",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("0300000000000000000000000000000004000000"),
          key: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
          aad: OpCodes.Hex8ToBytes("010000000000000000000000000000000200"),
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("6bb0fecf5ded9b77f902c7d5da236a4391dd029724afc9805e976f451e6d87f6fe106514")
        },
        {
          text: "RFC 8452 C.1 AEAD_AES_128_GCM_SIV - random key, 21-byte plaintext",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("e42a3c02c25b64869e146d7b233987bddfc240871d"),
          key: OpCodes.Hex8ToBytes("f901cfe8a69615a93fdf7a98cad48179"),
          nonce: OpCodes.Hex8ToBytes("6245709fb18853f68d833640"),
          aad: OpCodes.Hex8ToBytes("7576f7028ec6eb5ea7e298342a94d4b202b370ef9768ec6561c4fe6b7e7296fa859c21"),
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("391cc328d484a4f46406181bcd62efd9b3ee197d052d15506c84a9edd65e13e9d24a2a6e70")
        },
        {
          text: "RFC 8452 C.2 AEAD_AES_256_GCM_SIV - one block, no AAD",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0100000000000000000000000000000000000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("030000000000000000000000"),
          aad: [],
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("85a01b63025ba19b7fd3ddfc033b3e76c9eac6fa700942702e90862383c6c366")
        },
        {
          text: "RFC 8452 C.2 AEAD_AES_256_GCM_SIV - random key, 21-byte plaintext",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("ced532ce4159b035277d4dfbb7db62968b13cd4eec"),
          key: OpCodes.Hex8ToBytes("3c535de192eaed3822a2fbbe2ca9dfc88255e14a661b8aa82cc54236093bbc23"),
          nonce: OpCodes.Hex8ToBytes("688089e55540db1872504e1c"),
          aad: OpCodes.Hex8ToBytes("734320ccc9d9bbbb19cb81b2af4ecbc3e72834321f7aa0f70b7282b4f33df23f167541"),
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("626660c26ea6612fb17ad91e8e767639edd6c9faee9d6c7029675b89eaf4ba1ded1a286594")
        },
        {
          text: "RFC 8452 C.2 AEAD_AES_256_GCM_SIV - 32-bit counter wrap",
          uri: "https://www.rfc-editor.org/rfc/rfc8452.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("000000000000000000000000000000004db923dc793ee6497c76dcc03a98e108"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("000000000000000000000000"),
          aad: [],
          tagSize: 16,
          expected: OpCodes.Hex8ToBytes("f3f80f2cf0cb2dd9c5984fcda908456cc537703b5ba70324a6793a7bf218d3eaffffffff000000000000000000000000")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new GcmSivModeInstance(this, isInverse);
    }
  }

  /**
 * GcmSivMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GcmSivModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.key = null;
      this.nonce = null;
      this.aad = [];
      this.tagSize = 16;
      this.inputBuffer = [];
    }

    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize || cipher.BlockSize !== 16) {
        throw new Error("GCM-SIV requires AES (128-bit block size)");
      }
      this.blockCipher = cipher;
      this.key = cipher.key;
    }

    setNonce(nonce) {
      if (!nonce || nonce.length !== 12) {
        throw new Error("GCM-SIV requires exactly 96-bit (12-byte) nonce");
      }
      this.nonce = [...nonce];
    }

    setAAD(aad) {
      this.aad = aad ? [...aad] : [];
    }

    setTagSize(size) {
      if (size !== 16) {
        throw new Error("GCM-SIV only supports 128-bit (16-byte) tags");
      }
      this.tagSize = size;
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
      if (!this.nonce) {
        throw new Error("Nonce not set. Call setNonce() first.");
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
      if (!this.nonce) {
        throw new Error("Nonce not set. Call setNonce() first.");
      }

      if (!this.isInverse) {
        // GCM-SIV encryption - return concatenated ciphertext+tag for test compatibility
        const result = this._encrypt();
        return [...result.ciphertext, ...result.tag];
      } else {
        if (this.inputBuffer.length < this.tagSize) {
          throw new Error("Input too short for authentication tag");
        }
        return this._decrypt();
      }
    }

    _encrypt() {
      // Step 1: Derive keys
      const {authKey, encKey} = this._deriveKeys();

      // Step 2: Compute authentication tag using POLYVAL
      const tag = this._computeTag(authKey, encKey);

      // Step 3: Encrypt plaintext using AES-CTR with tag as initial counter
      const ciphertext = this._ctrEncrypt(encKey, tag);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return { ciphertext: ciphertext, tag: tag };
    }

    _decrypt() {
      // Extract ciphertext and tag
      const ciphertext = this.inputBuffer.slice(0, -this.tagSize);
      const receivedTag = this.inputBuffer.slice(-this.tagSize);

      // Step 1: Derive keys
      const {authKey, encKey} = this._deriveKeys();

      // Step 2: Decrypt ciphertext using AES-CTR
      const plaintext = this._ctrDecrypt(encKey, receivedTag, ciphertext);

      // Step 3: Verify authentication tag
      // Temporarily set input buffer to plaintext for tag computation
      const originalBuffer = this.inputBuffer;
      this.inputBuffer = plaintext;
      const expectedTag = this._computeTag(authKey, encKey);
      this.inputBuffer = originalBuffer;

      if (!OpCodes.SecureCompare(receivedTag, expectedTag)) {
        throw new Error("GCM-SIV authentication failed - tag mismatch");
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return plaintext;
    }

    /**
     * Derive authentication and encryption keys from master key
     * @returns {Object} Object with authKey and encKey
     */
    _deriveKeys() {
      // RFC 8452 section 4: each derivation block is a 32-bit little-endian
      // counter followed by the 12-byte nonce, and only the first eight bytes
      // of every AES output contribute to the derived key.
      const encKeyLength = this.key.length === 32 ? 32 : 16;
      const blockCount = 2 + encKeyLength / 8;
      const material = [];

      for (let i = 0; i < blockCount; i++) {
        const block = new Array(16).fill(0);
        const counterBytes = OpCodes.Unpack32LE(i);
        block[0] = counterBytes[0];
        block[1] = counterBytes[1];
        block[2] = counterBytes[2];
        block[3] = counterBytes[3];
        for (let j = 0; j < 12; j++) block[4 + j] = this.nonce[j];

        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(block);
        const out = cipher.Result();
        for (let j = 0; j < 8; j++) material.push(out[j]);
      }

      return {
        authKey: material.slice(0, 16),
        encKey: material.slice(16, 16 + encKeyLength)
      };
    }

    /**
     * Reverse the byte order of a 16-byte block
     * @private
     */
    _byteReverse(block) {
      const out = new Array(16);
      for (let i = 0; i < 16; i++) out[i] = block[15 - i];
      return out;
    }

    /**
     * Multiply a GHASH field element by x
     * @private
     */
    _mulXGhash(block) {
      const out = new Array(16);
      const carry = OpCodes.AndN(block[15], 1);
      for (let i = 15; i > 0; i--) {
        const low = OpCodes.Shr32(block[i], 1);
        const high = OpCodes.AndN(OpCodes.Shl32(OpCodes.AndN(block[i - 1], 1), 7), 0xFF);
        out[i] = OpCodes.OrN(low, high);
      }
      out[0] = OpCodes.Shr32(block[0], 1);
      if (carry) out[0] = OpCodes.XorN(out[0], 0xE1);
      return out;
    }

    /**
     * Compute authentication tag using POLYVAL
     * @param {Array} authKey - Authentication key
     * @param {Array} encKey - Encryption key  
     * @returns {Array} Authentication tag
     */
    _computeTag(authKey, encKey) {
      // S_s = POLYVAL(H, pad(AAD), pad(plaintext), length_block)
      const blocks = [];
      const paddedAAD = this._padToBlockSize([...this.aad]);
      for (let i = 0; i < paddedAAD.length; i += 16) blocks.push(paddedAAD.slice(i, i + 16));
      const paddedPlaintext = this._padToBlockSize([...this.inputBuffer]);
      for (let i = 0; i < paddedPlaintext.length; i += 16) blocks.push(paddedPlaintext.slice(i, i + 16));
      blocks.push(this._encodeLengths());

      const s = this._polyval(authKey, blocks);

      // The nonce is XORed into the first twelve bytes and the top bit of the
      // last byte is cleared, then the block is enciphered with the message
      // encryption key.
      for (let i = 0; i < 12; i++) s[i] = OpCodes.XorN(s[i], this.nonce[i]);
      s[15] = OpCodes.AndN(s[15], 0x7F);

      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = encKey;
      cipher.Feed(s);
      return cipher.Result();
    }

    /**
     * POLYVAL universal hash function (RFC 8452 Appendix A), expressed through
     * GHASH: POLYVAL(H, X_i) = ByteReverse(GHASH(mulX_GHASH(ByteReverse(H)),
     * ByteReverse(X_i)...)). POLYVAL and GHASH use reversed polynomials and
     * reversed bit orders, so a GHASH multiplier cannot be used directly.
     * @param {Array} key - POLYVAL key H
     * @param {Array} blocks - Array of 16-byte blocks
     * @returns {Array} POLYVAL result
     */
    _polyval(key, blocks) {
      const ghashKey = this._mulXGhash(this._byteReverse(key));
      let y = new Array(16).fill(0);

      for (const block of blocks) {
        y = OpCodes.XorArrays(y, this._byteReverse(block));
        y = OpCodes.GHashMul(y, ghashKey);
      }

      return this._byteReverse(y);
    }

    /**
     * AES-CTR mode encryption
     * @param {Array} key - Encryption key
     * @param {Array} tag - Tag used as initial counter
     * @returns {Array} Ciphertext
     */
    _ctrEncrypt(key, tag) {
      const output = [];
      let counter = [...tag];
      counter[15] = counter[15] + (counter[15] < 128 ? 128 : 0); // Set MSB (equivalent to |= 0x80)

      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const remainingBytes = Math.min(16, this.inputBuffer.length - i);
        const plaintextBlock = this.inputBuffer.slice(i, i + remainingBytes);

        // Encrypt counter
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = key;
        cipher.Feed(counter);
        const keystream = cipher.Result();

        // XOR with plaintext
        for (let j = 0; j < remainingBytes; j++) {
          output.push(OpCodes.XorArrays([plaintextBlock[j]], [keystream[j]])[0]);
        }

        // Increment counter
        this._incrementCounter(counter);
      }

      return output;
    }

    /**
     * AES-CTR mode decryption
     * @param {Array} key - Encryption key
     * @param {Array} tag - Tag used as initial counter
     * @param {Array} ciphertext - Ciphertext to decrypt
     * @returns {Array} Plaintext
     */
    _ctrDecrypt(key, tag, ciphertext) {
      const output = [];
      let counter = [...tag];
      counter[15] = counter[15] + (counter[15] < 128 ? 128 : 0); // Set MSB (equivalent to |= 0x80)

      for (let i = 0; i < ciphertext.length; i += 16) {
        const remainingBytes = Math.min(16, ciphertext.length - i);
        const cipherBlock = ciphertext.slice(i, i + remainingBytes);

        // Encrypt counter (same as encryption)
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = key;
        cipher.Feed(counter);
        const keystream = cipher.Result();

        // XOR with ciphertext
        for (let j = 0; j < remainingBytes; j++) {
          output.push(OpCodes.XorArrays([cipherBlock[j]], [keystream[j]])[0]);
        }

        // Increment counter
        this._incrementCounter(counter);
      }

      return output;
    }

    /**
     * Encode AAD and plaintext lengths for authentication
     * @returns {Array} Length encoding block
     */
    _encodeLengths() {
      // length_block = LE64(bitlen(AAD)) || LE64(bitlen(plaintext)). This is a
      // POLYVAL input block in its own right; it is not XORed with the nonce.
      const aadBits = this.aad.length * 8;
      const plaintextBits = this.inputBuffer.length * 8;

      const result = new Array(16).fill(0);

      const aadBytes = OpCodes.Unpack32LE(aadBits);
      result[0] = aadBytes[0];
      result[1] = aadBytes[1];
      result[2] = aadBytes[2];
      result[3] = aadBytes[3];

      const plaintextBytes = OpCodes.Unpack32LE(plaintextBits);
      result[8] = plaintextBytes[0];
      result[9] = plaintextBytes[1];
      result[10] = plaintextBytes[2];
      result[11] = plaintextBytes[3];

      return result;
    }

    /**
     * Pad data to multiple of block size
     * @param {Array} data - Data to pad
     * @returns {Array} Padded data
     */
    _padToBlockSize(data) {
      const blockSize = 16;
      const paddingLength = blockSize - (data.length % blockSize);
      if (paddingLength === blockSize) return data;

      return [...data, ...new Array(paddingLength).fill(0)];
    }

    /**
     * Increment counter for CTR mode
     * @param {Array} counter - Counter to increment (modified in place)
     */
    _incrementCounter(counter) {
      // RFC 8452: only the first 32 bits form the counter, little-endian, and
      // overflow past those four bytes is discarded rather than carried into
      // the rest of the block.
      for (let i = 0; i < 4; i++) {
        counter[i] = (counter[i] + 1) % 256;
        if (counter[i] !== 0) break;
      }
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new GcmSivAlgorithm());

  // ===== EXPORTS =====

  return { GcmSivAlgorithm, GcmSivModeInstance };
}));