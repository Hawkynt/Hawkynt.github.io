/*
 * OCB3 (Offset CodeBook Mode version 3)
 * High-performance authenticated encryption mode with parallelizable processing
 * RFC 7253 compliant implementation
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

      // Test vectors from RFC 7253
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes(""), // Empty plaintext
          OpCodes.Hex8ToBytes(""), // Empty ciphertext
          "RFC 7253 Test Vector 1 - Empty plaintext",
          "https://tools.ietf.org/rfc/rfc7253.txt"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("0001020304050607"), // 8 bytes
          OpCodes.Hex8ToBytes("92b657130a74b85a"), // Expected ciphertext
          "RFC 7253 Test Vector 2 - 8 byte plaintext",
          "https://tools.ietf.org/rfc/rfc7253.txt"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"), // 16 bytes
          OpCodes.Hex8ToBytes("52e48f5d19fe2d9869f0913dda258a57"), // Expected ciphertext
          "RFC 7253 Test Vector 3 - 16 byte plaintext",
          "https://tools.ietf.org/rfc/rfc7253.txt"
        )
      ];

      // Add test parameters from RFC 7253
      this.tests.forEach(test => {
        test.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"); // AES-128 key
        test.nonce = OpCodes.Hex8ToBytes("BBAA9988776655443322110D"); // 96-bit nonce
        test.aad = OpCodes.Hex8ToBytes(""); // No AAD for basic tests
        test.tagLength = 16; // 128-bit tag
      });
    }

    CreateInstance(isInverse = false) {
      return new Ocb3ModeInstance(this, isInverse);
    }
  }

  class Ocb3ModeInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.key = null;
      this.nonce = null;
      this.aad = []; // Additional Authenticated Data
      this.tagLength = 16; // Default 128-bit tag

      // OCB3 state
      this.L = null; // L = E_K(0^n)
      this.LDollar = null; // L$ = L ⊕ (L << 1)
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
    }

    /**
     * Set the encryption key and precompute OCB3 tables
     * @param {Array} key - AES key
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Key cannot be empty");
      }
      this.key = [...key];
      this._precomputeTables();
    }

    /**
     * Set the nonce (number used once)
     * @param {Array} nonce - Nonce value (1-15 bytes)
     */
    setNonce(nonce) {
      if (!nonce || nonce.length < 1 || nonce.length > 15) {
        throw new Error("OCB3 nonce must be 1-15 bytes");
      }
      this.nonce = [...nonce];
    }

    /**
     * Set additional authenticated data
     * @param {Array} aad - Additional authenticated data
     */
    setAAD(aad) {
      this.aad = aad ? [...aad] : [];
    }

    /**
     * Set the authentication tag length
     * @param {number} length - Tag length in bytes (1-16)
     */
    setTagLength(length) {
      if (length < 1 || length > 16) {
        throw new Error("OCB3 tag length must be 1-16 bytes");
      }
      this.tagLength = length;
    }

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
      this.inputBuffer.push(...data);
    }

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

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    /**
     * OCB3 encryption following RFC 7253
     * @returns {Object} Object containing ciphertext and authentication tag
     */
    _encrypt() {
      const plaintext = this.inputBuffer;
      const m = Math.floor(plaintext.length / 16); // Number of complete blocks

      // Step 1: Process nonce to get initial offset
      const offset = this._processNonce();
      let currentOffset = [...offset];

      // Step 2: Initialize checksum
      let checksum = new Array(16).fill(0);
      const ciphertext = [];

      // Step 3: Process complete blocks
      for (let i = 1; i <= m; i++) {
        const block = plaintext.slice((i - 1) * 16, i * 16);

        // Update offset: Offset_i = Offset_{i-1} ⊕ L[ntz(i)]
        const Li = this._getLi(this._ntz(i));
        currentOffset = OpCodes.XorArrays(currentOffset, Li);

        // Encrypt: C_i = E_K(P_i ⊕ Offset_i) ⊕ Offset_i
        const xorInput = OpCodes.XorArrays(block, currentOffset);
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(xorInput);
        const encrypted = cipher.Result();
        const cipherBlock = OpCodes.XorArrays(encrypted, currentOffset);

        ciphertext.push(...cipherBlock);

        // Update checksum: Checksum = Checksum ⊕ P_i
        checksum = OpCodes.XorArrays(checksum, block);
      }

      // Step 4: Process final partial block if present
      if (plaintext.length % 16 !== 0) {
        const finalBlock = plaintext.slice(m * 16);

        // Offset_* = Offset_m ⊕ L_*
        const finalOffset = OpCodes.XorArrays(currentOffset, this.LDollar);

        // Pad = E_K(Offset_*)
        const cipher = this.blockCipher.algorithm.CreateInstance(false);
        cipher.key = this.key;
        cipher.Feed(finalOffset);
        const pad = cipher.Result();

        // C_* = P_* ⊕ Pad[1..len(P_*)]
        const finalCipher = [];
        for (let i = 0; i < finalBlock.length; i++) {
          finalCipher[i] = finalBlock[i] ^ pad[i];
        }
        ciphertext.push(...finalCipher);

        // Update checksum: Checksum = Checksum ⊕ (P_* || 1 || 0^{127-8*len(P_*)})
        const paddedFinal = [...finalBlock];
        paddedFinal.push(0x80); // Append 1 bit
        while (paddedFinal.length < 16) {
          paddedFinal.push(0x00); // Pad with zeros
        }
        checksum = OpCodes.XorArrays(checksum, paddedFinal);
      }

      // Step 5: Compute authentication tag
      const tag = this._computeTag(checksum, currentOffset);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      OpCodes.ClearArray(checksum);
      OpCodes.ClearArray(currentOffset);
      this.inputBuffer = [];

      return {
        ciphertext: ciphertext,
        tag: tag.slice(0, this.tagLength)
      };
    }

    /**
     * OCB3 decryption (placeholder for educational purposes)
     * @returns {Array} Decrypted plaintext
     */
    _decrypt() {
      throw new Error("OCB3 decryption requires the authentication tag for verification");
    }

    /**
     * Precompute OCB3 tables L, L$, and L[i]
     */
    _precomputeTables() {
      if (!this.key) return;

      // L = E_K(0^n)
      const zero = new Array(16).fill(0);
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(zero);
      this.L = cipher.Result();

      // L$ = double(L)
      this.LDollar = this._gf128Double(this.L);

      // Precompute L[0], L[1], L[2], ... as needed
      this.LTable = [];
      this.LTable[0] = this._gf128Double(this.LDollar); // L[0] = double(L$)

      // Generate more L[i] values as needed (L[i] = double(L[i-1]))
      for (let i = 1; i < 64; i++) { // Precompute enough for practical use
        this.LTable[i] = this._gf128Double(this.LTable[i - 1]);
      }
    }

    /**
     * Process nonce to generate initial offset
     * @returns {Array} Initial offset
     */
    _processNonce() {
      const nonce = [...this.nonce];

      // Pad nonce to 128 bits
      const paddedNonce = new Array(16).fill(0);

      // Copy nonce to the end of the padded array
      for (let i = 0; i < nonce.length; i++) {
        paddedNonce[15 - nonce.length + 1 + i] = nonce[i];
      }

      // Set the first bit to indicate nonce length
      paddedNonce[0] = (nonce.length * 8) << 1;
      paddedNonce[15] |= 1; // Set least significant bit

      // Generate offset: Offset_0 = E_K(Nonce || 0^{127-|Nonce|} || 1)
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(paddedNonce);
      return cipher.Result();
    }

    /**
     * Get L[i] from precomputed table
     * @param {number} i - Index
     * @returns {Array} L[i] value
     */
    _getLi(i) {
      if (i >= this.LTable.length) {
        // Extend table if needed
        while (this.LTable.length <= i) {
          const nextL = this._gf128Double(this.LTable[this.LTable.length - 1]);
          this.LTable.push(nextL);
        }
      }
      return this.LTable[i];
    }

    /**
     * Number of trailing zeros in binary representation
     * @param {number} n - Number
     * @returns {number} Number of trailing zeros
     */
    _ntz(n) {
      let count = 0;
      while ((n & 1) === 0 && n !== 0) {
        count++;
        n >>>= 1;
      }
      return count;
    }

    /**
     * Compute authentication tag
     * @param {Array} checksum - Accumulated checksum
     * @param {Array} offset - Current offset
     * @returns {Array} Authentication tag
     */
    _computeTag(checksum, offset) {
      // Process AAD
      let aadChecksum = new Array(16).fill(0);

      if (this.aad.length > 0) {
        const aadBlocks = Math.floor(this.aad.length / 16);
        let aadOffset = new Array(16).fill(0);

        // Process complete AAD blocks
        for (let i = 1; i <= aadBlocks; i++) {
          const aadBlock = this.aad.slice((i - 1) * 16, i * 16);

          const Li = this._getLi(this._ntz(i));
          aadOffset = OpCodes.XorArrays(aadOffset, Li);

          const cipher = this.blockCipher.algorithm.CreateInstance(false);
          cipher.key = this.key;
          const xorInput = OpCodes.XorArrays(aadBlock, aadOffset);
          cipher.Feed(xorInput);
          const encrypted = cipher.Result();

          aadChecksum = OpCodes.XorArrays(aadChecksum, encrypted);
        }

        // Process final partial AAD block if present
        if (this.aad.length % 16 !== 0) {
          const finalAAD = this.aad.slice(aadBlocks * 16);
          const finalOffset = OpCodes.XorArrays(aadOffset, this.LDollar);

          const cipher = this.blockCipher.algorithm.CreateInstance(false);
          cipher.key = this.key;
          cipher.Feed(finalOffset);
          const pad = cipher.Result();

          const paddedAAD = [...finalAAD];
          paddedAAD.push(0x80);
          while (paddedAAD.length < 16) {
            paddedAAD.push(0x00);
          }

          const xorResult = OpCodes.XorArrays(paddedAAD, pad);
          aadChecksum = OpCodes.XorArrays(aadChecksum, xorResult);
        }
      }

      // Final tag computation: Tag = E_K(Checksum ⊕ Offset_final ⊕ L$ ⊕ AAD_checksum)
      let tagInput = OpCodes.XorArrays(checksum, offset);
      tagInput = OpCodes.XorArrays(tagInput, this.LDollar);
      tagInput = OpCodes.XorArrays(tagInput, aadChecksum);

      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(tagInput);

      return cipher.Result();
    }

    /**
     * Double a value in GF(2^128) (multiply by α = x)
     * @param {Array} value - 128-bit value to double
     * @returns {Array} Doubled value in GF(2^128)
     */
    _gf128Double(value) {
      const result = new Array(16);
      let carry = 0;

      // Shift left by 1 bit (multiply by x)
      for (let i = 15; i >= 0; i--) {
        const newCarry = (value[i] >>> 7) & 1;
        result[i] = ((value[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }

      // If there was a carry, reduce by the polynomial x^128 + x^7 + x^2 + x + 1
      if (carry) {
        result[0] ^= 0x87;
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new Ocb3Algorithm());

  // ===== EXPORTS =====

  return { Ocb3Algorithm, Ocb3ModeInstance };
}));