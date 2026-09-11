/*
 * SIV (Synthetic IV) Mode of Operation  
 * Authenticated encryption with synthetic initialization vectors
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
    root.SIV = factory(root.AlgorithmFramework, root.OpCodes);
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

  class SivAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "SIV";
      this.description = "Synthetic IV (SIV) mode provides deterministic authenticated encryption by first computing an authentication tag (synthetic IV) using S2V, then encrypting with CTR mode using the synthetic IV. This mode is nonce-misuse resistant and supports key-commitment, making it safe even when nonces are reused or generated incorrectly.";
      this.inventor = "Rogaway, Shrimpton";
      this.year = 2006;
      this.category = CategoryType.MODE;
      this.subCategory = "Deterministic AEAD";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      this.SupportedTagSizes = [new KeySize(16, 16, 0)]; // Fixed 128-bit synthetic IV
      this.SupportsDetached = true;

      this.documentation = [
        new LinkItem("RFC 5297 - SIV Mode", "https://tools.ietf.org/rfc/rfc5297.txt"),
        new LinkItem("SIV Original Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/siv.html"),
        new LinkItem("NIST Recommendation", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      this.references = [
        new LinkItem("Deterministic Encryption", "Bellare et al. - DAE Security Model"),
        new LinkItem("S2V Construction", "https://tools.ietf.org/rfc/rfc5297.txt#section-2.4")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse Safe", "SIV is specifically designed to be safe against nonce reuse, unlike most AEAD modes."),
        new Vulnerability("Deterministic", "Same plaintext with same AAD produces same ciphertext - may leak information patterns."),
        new Vulnerability("Performance", "Requires two passes over data (S2V then CTR), making it slower than single-pass AEAD modes.")
      ];

      // RFC 5297 Appendix A. The expected value is the full output, i.e. the
      // synthetic IV followed by the ciphertext.
      this.tests = [
        {
          text: "RFC 5297 A.1 - deterministic authenticated encryption",
          uri: "https://www.rfc-editor.org/rfc/rfc5297.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("112233445566778899aabbccddee"),
          key: OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          aad: [OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f2021222324252627")],
          expected: OpCodes.Hex8ToBytes("85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c")
        },
        {
          text: "RFC 5297 A.2 - nonce-based authenticated encryption",
          uri: "https://www.rfc-editor.org/rfc/rfc5297.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("7468697320697320736f6d6520706c61696e7465787420746f20656e6372797074207573696e67205349562d414553"),
          key: OpCodes.Hex8ToBytes("7f7e7d7c7b7a79787776757473727170404142434445464748494a4b4c4d4e4f"),
          aad: [
            OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeffdeaddadadeaddadaffeeddccbbaa99887766554433221100"),
            OpCodes.Hex8ToBytes("102030405060708090a0"),
            OpCodes.Hex8ToBytes("09f911029d74e35bd84156c5635688c0")
          ],
          expected: OpCodes.Hex8ToBytes("7bdb6e3b432667eb06f4d14bff2fbd0fcb900f2fddbe404326601965c889bf17dba77ceb094fa663b7a3f748ba8af829ea64ad544a272e9c485b62a3fd5c0d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SivModeInstance(this, isInverse);
    }
  }

  /**
 * SivMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SivModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.key1 = null; // First half of key for MAC
      this.key2 = null; // Second half of key for CTR
      this.aad = []; // Array of associated data strings
      this.inputBuffer = [];
    }

    /**
     * Set the underlying block cipher instance and derive sub-keys
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize || !cipher.key) {
        throw new Error("Invalid block cipher instance");
      }

      // SIV requires double-length key
      if (cipher.key.length < 32) {
        throw new Error("SIV requires at least 256-bit key (double the block cipher key)");
      }

      this.blockCipher = cipher;
      const keyLen = cipher.key.length / 2;

      // Split key into two equal parts
      this.key1 = cipher.key.slice(0, keyLen);        // MAC key
      this.key2 = cipher.key.slice(keyLen, keyLen * 2); // CTR key
    }

    /**
     * Set associated authenticated data
     * @param {Array} aadArray - Array of AAD byte arrays
     */
    setAAD(aadArray) {
      // RFC 5297 authenticates a vector of associated-data strings. Accept
      // either that (an array of byte arrays) or a single flat byte array,
      // which is how most callers and test vectors supply one header.
      if (!aadArray || aadArray.length === 0) {
        this.aad = [];
      } else if (Array.isArray(aadArray[0])) {
        this.aad = aadArray.map(a => [...a]);
      } else {
        this.aad = [[...aadArray]];
      }
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
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      if (!this.isInverse) {
        // Encryption: S2V then CTR
        return this._encrypt();
      } else {
        // Decryption: extract IV, verify with S2V, then CTR decrypt
        if (this.inputBuffer.length < 16) {
          throw new Error("SIV ciphertext too short (missing synthetic IV)");
        }
        return this._decrypt();
      }
    }

    _encrypt() {
      // Step 1: Compute synthetic IV using S2V
      const syntheticIV = this._s2v([...this.aad, this.inputBuffer]);

      // Step 2: Encrypt plaintext using CTR mode with synthetic IV
      const ciphertext = this._ctr(this.inputBuffer, syntheticIV);

      // Step 3: Prepend synthetic IV to ciphertext
      const result = [...syntheticIV, ...ciphertext];

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    _decrypt() {
      // Step 1: Extract synthetic IV and ciphertext
      const syntheticIV = this.inputBuffer.slice(0, 16);
      const ciphertext = this.inputBuffer.slice(16);

      // Step 2: Decrypt ciphertext using CTR mode
      const plaintext = this._ctr(ciphertext, syntheticIV);

      // Step 3: Compute expected synthetic IV using S2V
      const expectedIV = this._s2v([...this.aad, plaintext]);

      // Step 4: Verify synthetic IV
      if (!OpCodes.SecureCompare(syntheticIV, expectedIV)) {
        throw new Error("SIV authentication failed - synthetic IV mismatch");
      }

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return plaintext;
    }

    /**
     * S2V (String-to-Vector) construction for synthetic IV generation
     * @param {Array} strings - Array of byte arrays to authenticate
     * @returns {Array} 128-bit synthetic IV
     */
    _s2v(strings) {
      const blockSize = this.blockCipher.BlockSize;

      if (strings.length === 0) {
        // RFC 5297: S2V(K, <empty vector>) = CMAC(K, <one>)
        const one = new Array(blockSize).fill(0);
        one[blockSize - 1] = 1;
        return this._cmac(one);
      }

      // D = CMAC(K, <zero>)
      let d = this._cmac(new Array(blockSize).fill(0));

      // D = dbl(D) xor CMAC(K, S_i) for every string but the last
      for (let i = 0; i < strings.length - 1; i++) {
        d = OpCodes.XorArrays(this._gfDouble(d), this._cmac(strings[i]));
      }

      const lastString = strings[strings.length - 1];

      if (lastString.length >= blockSize) {
        // T = S_n xorend D: the trailing block of S_n is XORed with D and the
        // head of S_n is left untouched. Building the input the other way round
        // rotates the message and produces a completely different tag.
        const t = [...lastString];
        const offset = t.length - blockSize;
        for (let j = 0; j < blockSize; j++) {
          t[offset + j] = OpCodes.XorN(t[offset + j], d[j]);
        }
        return this._cmac(t);
      }

      // T = dbl(D) xor pad(S_n)
      const paddedLast = [...lastString, 0x80];
      while (paddedLast.length < blockSize) {
        paddedLast.push(0x00);
      }

      return this._cmac(OpCodes.XorArrays(this._gfDouble(d), paddedLast));
    }

    /**
     * CMAC (RFC 4493) under the S2V key
     * @param {Array} data - Data to authenticate
     * @returns {Array} CMAC result
     */
    _cmac(data) {
      const blockSize = this.blockCipher.BlockSize;

      // Subkey generation: L = E_K(0^n), K1 = dbl(L), K2 = dbl(K1). Without the
      // subkeys this is a plain CBC-MAC and does not agree with any published
      // AES-CMAC or AES-SIV value.
      const l = this._encipher(new Array(blockSize).fill(0));
      const subKey1 = this._gfDouble(l);
      const subKey2 = this._gfDouble(subKey1);

      const complete = data.length > 0 && data.length % blockSize === 0;
      const blockCount = complete ? data.length / blockSize : Math.floor(data.length / blockSize) + 1;

      let lastBlock;
      if (complete) {
        lastBlock = OpCodes.XorArrays(data.slice((blockCount - 1) * blockSize), subKey1);
      } else {
        const tail = data.slice((blockCount - 1) * blockSize);
        const padded = [...tail, 0x80];
        while (padded.length < blockSize) padded.push(0x00);
        lastBlock = OpCodes.XorArrays(padded, subKey2);
      }

      let x = new Array(blockSize).fill(0);
      for (let i = 0; i < blockCount - 1; i++) {
        const block = data.slice(i * blockSize, (i + 1) * blockSize);
        x = this._encipher(OpCodes.XorArrays(x, block));
      }

      return this._encipher(OpCodes.XorArrays(x, lastBlock));
    }

    /**
     * Apply the block cipher under the S2V key
     * @private
     */
    _encipher(block) {
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key1;
      cipher.Feed(block);
      return cipher.Result();
    }

    /**
     * CTR mode encryption/decryption
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} iv - Counter initialization vector
     * @returns {Array} Output data
     */
    _ctr(data, iv) {
      const blockSize = this.blockCipher.BlockSize;
      const output = [];

      // RFC 5297: Q = V bitand (1^64 || 0 || 1^31 || 0 || 1^31). Only the two
      // bits that would otherwise let the counter carry across the 32-bit word
      // boundaries are cleared, not the top bit of the whole value.
      let counter = [...iv];
      counter[8] = OpCodes.AndN(counter[8], 0x7F);
      counter[12] = OpCodes.AndN(counter[12], 0x7F);

      for (let i = 0; i < data.length; i += blockSize) {
        const remainingBytes = Math.min(blockSize, data.length - i);
        const inputBlock = data.slice(i, i + remainingBytes);

        // Encrypt counter with CTR key
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key2;
        cipher.Feed(counter);
        const keystream = cipher.Result();

        // XOR with data
        for (let j = 0; j < remainingBytes; j++) {
          output.push(OpCodes.XorN(inputBlock[j], keystream[j]));
        }

        // Increment counter
        this._incrementCounter(counter);
      }

      return output;
    }

    /**
     * GF(2^128) field doubling
     * @param {Array} block - 128-bit block to double
     * @returns {Array} Doubled block
     */
    _gfDouble(block) {
      const result = new Array(block.length);
      let carry = 0;

      // Process from right to left
      for (let i = block.length - 1; i >= 0; i--) {
        const newCarry = OpCodes.AndN(block[i], 0x80) ? 1 : 0;
        result[i] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(block[i], 1), carry), 0xFF);
        carry = newCarry;
      }

      // XOR with reduction polynomial if carry
      if (carry) {
        result[result.length - 1] = OpCodes.XorN(result[result.length - 1], 0x87); // x^128 + x^7 + x^2 + x + 1
      }

      return result;
    }

    /**
     * Increment counter for CTR mode
     * @param {Array} counter - Counter to increment (modified in place)
     */
    _incrementCounter(counter) {
      for (let i = counter.length - 1; i >= 0; i--) {
        counter[i] = OpCodes.AndN(counter[i] + 1, 0xFF);
        if (counter[i] !== 0) break; // No carry
      }
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new SivAlgorithm());

  // ===== EXPORTS =====

  return { SivAlgorithm, SivModeInstance };
}));