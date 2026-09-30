/*
 * XChaCha20-Poly1305 Implementation - Extended Nonce AEAD
 * Extended ChaCha20-Poly1305 with 192-bit nonces
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

  // Load Poly1305 for authentication
  if (typeof require !== 'undefined') {
    try {
      require('../mac/poly1305.js');
    } catch (e) {
      // Poly1305 may already be loaded
    }
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

  class XChaCha20Poly1305Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XChaCha20-Poly1305";
      this.description = "Extended ChaCha20-Poly1305 authenticated encryption with 192-bit nonces. Provides the security and performance of ChaCha20-Poly1305 while eliminating nonce size limitations.";
      this.inventor = "Scott Arciszewski (libsodium team)";
      this.year = 2018;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "AEAD Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(32, 32, 32)
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0) // 128-bit authentication tag
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("XChaCha20 Specification", "https://tools.ietf.org/html/draft-irtf-cfrg-xchacha-03"),
        new LinkItem("libsodium Documentation", "https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction")
      ];

      this.references = [
        new LinkItem("libsodium Implementation", "https://github.com/jedisct1/libsodium"),
        new LinkItem("Extended Nonce Paper", "https://cr.yp.to/snuffle/xsalsa-20110204.pdf")
      ];

      // Known vulnerabilities (if any)
      this.knownVulnerabilities = [
        new Vulnerability("Key Reuse", "Extended nonces reduce but don't eliminate nonce reuse risks", "Still ensure nonces are not reused, though collision probability is negligible")
      ];

      // Test vectors using OpCodes byte arrays
      this.tests = [
        {
          text: "XChaCha20-Poly1305 RFC draft-irtf-cfrg-xchacha-03 Appendix A",
          uri: "https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03",
          input: OpCodes.Hex8ToBytes("4c616469657320616e642047656e746c656d656e206f662074686520636c61737320" +
                                      "6f66202739393a204966204920636f756c64206f6666657220796f75206f6e6c7920" +
                                      "6f6e652074697020666f7220746865206675747572652c2073756e73637265656e20" +
                                      "776f756c642062652069742e"),
          key: OpCodes.Hex8ToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f"),
          nonce: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f5051525354555657"),
          aad: OpCodes.Hex8ToBytes("50515253c0c1c2c3c4c5c6c7"),
          expected: OpCodes.Hex8ToBytes("bd6d179d3e83d43b9576579493c0e939572a1700252bfaccbed2902c21396cbb" +
                                        "731c7f1b0b4aa6440bf3a82f4eda7e39ae64c6708c54c216cb96b72e1213b452" +
                                        "2f8c9ba40db5d945b11b69b982c1bb9e3f3fac2bc369488f76b2383565d3fff9" +
                                        "21f9664c97637da9768812f615c68b13b52ec0875924c1c7987947deafd8780acf49")
        },
        {
          text: "XChaCha20-Poly1305 Empty Input Test (Corrected)",
          uri: "https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("8f3b945a51906dc8600de9f8962d00e6")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {XChaCha20Poly1305AlgorithmInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XChaCha20Poly1305AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * XChaCha20Poly1305Algorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XChaCha20Poly1305AlgorithmInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {XChaCha20Poly1305Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {KeySize[]} */
      this.keySizeList = algorithm.SupportedKeySizes;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      this.key = null;
      /** @type {uint8[]|null} */
      this.nonce = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this.tagSize = 16; // 128-bit authentication tag

      // XChaCha20-Poly1305 specific state
      /** @type {boolean} */
      this.initialized = false;

      // Constants
      /** @type {int32} */
      this.NONCE_SIZE = 24; // 192-bit nonces for XChaCha20
      /** @type {int32} */
      this.TAG_SIZE = 16;
      /** @type {int32} */
      this.KEY_SIZE = 32;
      /** @type {int32} */
      this.BLOCK_SIZE = 64;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      // Validate key size
      /** @type {boolean} */
      let isValidSize = false;
      for (let k = 0; k < this.keySizeList.length; k++) {
        /** @type {KeySize} */
        const ks = this.keySizeList[k];
        if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
            (keyBytes.length - ks.minSize) % ks.stepSize === 0) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = keyBytes.slice();
      this.initialized = false;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? this._key.slice() : null;
    }

    /**
     * Set nonce for AEAD operation
     * @param {uint8[]} nonce - 24-byte nonce
     * @returns {void}
     */
    setNonce(nonce) {
      if (!nonce || nonce.length !== this.NONCE_SIZE) {
        throw new Error("XChaCha20-Poly1305 requires 24-byte nonce");
      }
      this.nonce = nonce.slice();
      this.initialized = false;
    }

    /**
     * Set additional authenticated data
     * @param {uint8[]|null} aad - Associated data
     * @returns {void}
     */
    setAAD(aad) {
      /** @type {uint8[]} */
      let copy = [];
      if (aad) {
        copy = aad.slice();
      }
      this.aad = copy;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) {
        throw new Error("Key not set");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) {
        throw new Error("Key not set");
      }

      // Set default nonce if not provided (for test vectors)
      if (!this.nonce) {
        this.nonce = OpCodes.CreateArray(24, 0); // 24-byte nonce
        this.nonce[23] = 1;
      }

      /** @type {uint8[]} */
      const input = this.inputBuffer;
      /** @type {uint8[]} */
      let aad = [];
      if (this.aad) {
        aad = this.aad;
      }
      /** @type {uint8[]} */
      const output = this.isInverse
        ? this._aeadDecrypt(input, this.nonce, aad)
        : this._aeadEncrypt(input, this.nonce, aad);

      // Clear buffers for next operation
      this.inputBuffer = [];
      this.aad = [];

      return output;
    }

    /**
     * Build the initial ChaCha state from constants, key and four nonce/counter words
     * @param {uint8[]} key - 32-byte key
     * @returns {uint32[]} State with words 12..15 still zero
     */
    _initialWords(key) {
      /** @type {uint32[]} */
      const words = new Array(16);

      // Constants "expand 32-byte k"
      words[0] = 0x61707865;
      words[1] = 0x3320646e;
      words[2] = 0x79622d32;
      words[3] = 0x6b206574;

      // Key
      for (let i = 0; i < 8; i++) {
        words[4 + i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1],
          key[i * 4 + 2], key[i * 4 + 3]
        );
      }
      for (let i = 12; i < 16; i++) words[i] = 0;
      return words;
    }

    /**
     * 20 ChaCha rounds (10 double rounds) in place
     * @param {uint32[]} x - Working state
     * @returns {void}
     */
    _rounds(x) {
      for (let i = 0; i < 10; i++) {
        // Column rounds
        this._quarterRound(x, 0, 4, 8, 12);
        this._quarterRound(x, 1, 5, 9, 13);
        this._quarterRound(x, 2, 6, 10, 14);
        this._quarterRound(x, 3, 7, 11, 15);

        // Diagonal rounds
        this._quarterRound(x, 0, 5, 10, 15);
        this._quarterRound(x, 1, 6, 11, 12);
        this._quarterRound(x, 2, 7, 8, 13);
        this._quarterRound(x, 3, 4, 9, 14);
      }
    }

    /**
     * HChaCha20 - used for key derivation with extended nonce
     * @param {uint8[]} key - 32-byte key
     * @param {uint8[]} nonce - First 16 bytes of the extended nonce
     * @returns {uint8[]} 32-byte subkey
     */
    _hchacha20(key, nonce) {
      // Initialize state with constants, key, and first 16 bytes of nonce
      /** @type {uint32[]} */
      const words = this._initialWords(key);

      // First 16 bytes of nonce
      for (let i = 0; i < 4; i++) {
        words[12 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }

      // Working state for rounds
      /** @type {uint32[]} */
      const x = words.slice();
      this._rounds(x);

      // Extract key material: words 0, 1, 2, 3, 12, 13, 14, 15
      /** @type {uint8[]} */
      const derived = [];
      /** @type {int32[]} */
      const wordIndices = [0, 1, 2, 3, 12, 13, 14, 15];

      for (let w = 0; w < wordIndices.length; w++) {
        /** @type {uint8[]} */
        const bytes = OpCodes.Unpack32LE(x[wordIndices[w]]);
        for (let _i = 0; _i < bytes.length; _i++) derived.push(bytes[_i]);
      }

      return derived;
    }

    /**
     * ChaCha20 quarter round
     * @param {uint32[]} x - Working state
     * @param {int32} a - Word index
     * @param {int32} b - Word index
     * @param {int32} c - Word index
     * @param {int32} d - Word index
     * @returns {void}
     */
    _quarterRound(x, a, b, c, d) {
      x[a] = OpCodes.Add32(x[a], x[b]);
      x[d] = OpCodes.RotL32(OpCodes.Xor32(x[d], x[a]), 16);

      x[c] = OpCodes.Add32(x[c], x[d]);
      x[b] = OpCodes.RotL32(OpCodes.Xor32(x[b], x[c]), 12);

      x[a] = OpCodes.Add32(x[a], x[b]);
      x[d] = OpCodes.RotL32(OpCodes.Xor32(x[d], x[a]), 8);

      x[c] = OpCodes.Add32(x[c], x[d]);
      x[b] = OpCodes.RotL32(OpCodes.Xor32(x[b], x[c]), 7);
    }

    /**
     * ChaCha20 block function
     * @param {uint8[]} key - 32-byte key
     * @param {uint32} counter - Block counter
     * @param {uint8[]} nonce - 12-byte nonce
     * @returns {uint8[]} 64 keystream bytes
     */
    _chachaBlock(key, counter, nonce) {
      // Initialize state
      /** @type {uint32[]} */
      const words = this._initialWords(key);

      // Counter
      words[12] = counter;

      // Nonce (12 bytes)
      for (let i = 0; i < 3; i++) {
        words[13 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }

      // Working state for rounds
      /** @type {uint32[]} */
      const x = words.slice();
      this._rounds(x);

      // Add original state
      for (let i = 0; i < 16; i++) {
        x[i] = OpCodes.Add32(x[i], words[i]);
      }

      // Serialize to bytes
      /** @type {uint8[]} */
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        /** @type {uint8[]} */
        const bytes = OpCodes.Unpack32LE(x[i]);
        for (let _i = 0; _i < bytes.length; _i++) keystream.push(bytes[_i]);
      }

      return keystream;
    }

    /**
     * ChaCha20 nonce: 4 zero bytes and the last 8 bytes of the extended nonce
     * @param {uint8[]} nonce - 24-byte extended nonce
     * @returns {uint8[]} 12-byte nonce
     */
    _innerNonce(nonce) {
      /** @type {uint8[]} */
      const inner = OpCodes.CreateArray(12, 0);
      for (let i = 0; i < 8; i++) {
        inner[4 + i] = nonce[16 + i];
      }
      return inner;
    }

    /**
     * XChaCha20 encryption/decryption
     * @param {uint8[]} key - 32-byte key
     * @param {uint8[]} nonce - 24-byte nonce
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Output bytes
     */
    _xchacha20(key, nonce, data) {
      // Derive key using HChaCha20 with first 16 bytes of nonce
      /** @type {uint8[]} */
      const subkey = this._hchacha20(key, nonce.slice(0, 16));

      // Use last 8 bytes of nonce + 4 zero bytes as ChaCha20 nonce
      /** @type {uint8[]} */
      const chacha20Nonce = this._innerNonce(nonce);

      // Use standard ChaCha20 with derived key
      /** @type {uint8[]} */
      const result = [];
      /** @type {uint32} */
      let blockCounter = 1; // Start at 1 (0 reserved for Poly1305 key)

      for (let i = 0; i < data.length; i += this.BLOCK_SIZE) {
        /** @type {uint8[]} */
        const keystream = this._chachaBlock(subkey, blockCounter, chacha20Nonce);
        /** @type {uint8[]} */
        const block = data.slice(i, i + this.BLOCK_SIZE);

        for (let j = 0; j < block.length; j++) {
          result.push(OpCodes.Xor8(block[j], keystream[j]));
        }

        blockCounter++;
      }

      return result;
    }

    /**
     * XChaCha20-Poly1305 key generation for authentication
     * @param {uint8[]} key - 32-byte key
     * @param {uint8[]} nonce - 24-byte nonce
     * @returns {uint8[]} 32-byte one-time Poly1305 key
     */
    _poly1305KeyGen(key, nonce) {
      // Derive key using HChaCha20
      /** @type {uint8[]} */
      const subkey = this._hchacha20(key, nonce.slice(0, 16));

      // Use last 8 bytes of nonce + 4 zero bytes as ChaCha20 nonce
      /** @type {uint8[]} */
      const chacha20Nonce = this._innerNonce(nonce);

      // Generate first block (counter = 0) for Poly1305 key
      /** @type {uint8[]} */
      const keystream = this._chachaBlock(subkey, 0, chacha20Nonce);
      return keystream.slice(0, 32);
    }

    /**
     * Poly1305 authenticator using framework's implementation
     * @param {uint8[]} key - 32-byte one-time key
     * @param {uint8[]} data - Authenticated data
     * @returns {uint8[]} 16-byte tag
     */
    _poly1305(key, data) {
      /** @type {Algorithm} */
      const poly1305Alg = AlgorithmFramework.Find('Poly1305');
      if (!poly1305Alg) {
        throw new Error('Poly1305 algorithm not found in framework');
      }

      /** @type {IMacInstance} */
      const instance = poly1305Alg.CreateInstance(false);
      instance.key = key; // 32-byte key
      instance.Feed(data);
      /** @type {uint8[]} */
      const tag = instance.Result();
      return tag;
    }

    /**
     * Append data zero-padded to a 16-byte boundary
     * @param {uint8[]} target - Array to extend
     * @param {uint8[]} data - Data to append
     * @returns {void}
     */
    _appendPadded(target, data) {
      for (let i = 0; i < data.length; i++) target.push(data[i]);
      for (let i = data.length; i % 16 !== 0; i++) target.push(0);
    }

    /**
     * Encode length as 8-byte little-endian
     * @param {int32} length - Length in bytes
     * @returns {uint8[]} Encoded length
     */
    _encodeLength(length) {
      /** @type {uint8[]} */
      const result = new Array(8);
      // Lengths are below 2^32: the upper 4 bytes are zero
      for (let i = 0; i < 4; i++) {
        result[i] = OpCodes.And32(OpCodes.Shr32(length, i * 8), 0xFF);
      }
      for (let i = 4; i < 8; i++) {
        result[i] = 0;
      }
      return result;
    }

    /**
     * Poly1305 input: padded AAD, padded ciphertext, both lengths
     * @param {uint8[]} aad - Associated data
     * @param {uint8[]} ciphertext - Ciphertext
     * @returns {uint8[]} MAC input
     */
    _authData(aad, ciphertext) {
      /** @type {uint8[]} */
      const authData = [];

      // Add AAD
      if (aad && aad.length > 0) {
        this._appendPadded(authData, aad);
      }

      // Add ciphertext
      this._appendPadded(authData, ciphertext);

      // Add lengths
      /** @type {uint8[]} */
      const aadLength = this._encodeLength(aad ? aad.length : 0);
      /** @type {uint8[]} */
      const ctLength = this._encodeLength(ciphertext.length);
      for (let i = 0; i < 8; i++) authData.push(aadLength[i]);
      for (let i = 0; i < 8; i++) authData.push(ctLength[i]);
      return authData;
    }

    /**
     * @param {uint8[]} plaintext - Plaintext
     * @param {uint8[]} nonce - 24-byte nonce
     * @param {uint8[]} aad - Associated data
     * @returns {uint8[]} Ciphertext followed by the tag
     */
    _aeadEncrypt(plaintext, nonce, aad) {
      if (nonce.length !== this.NONCE_SIZE) {
        throw new Error('XChaCha20-Poly1305 requires exactly 24-byte (192-bit) nonce');
      }

      // Generate Poly1305 key
      /** @type {uint8[]} */
      const macKey = this._poly1305KeyGen(this._key, nonce);

      // Encrypt plaintext with XChaCha20
      /** @type {uint8[]} */
      const ciphertext = this._xchacha20(this._key, nonce, plaintext);

      // Compute authentication tag
      /** @type {uint8[]} */
      const tag = this._poly1305(macKey, this._authData(aad, ciphertext));

      // Clear sensitive key material
      OpCodes.ClearArray(macKey);

      /** @type {uint8[]} */
      const output = ciphertext.slice();
      for (let i = 0; i < tag.length; i++) output.push(tag[i]);
      return output;
    }

    /**
     * @param {uint8[]} ciphertextWithTag - Ciphertext followed by the tag
     * @param {uint8[]} nonce - 24-byte nonce
     * @param {uint8[]} aad - Associated data
     * @returns {uint8[]} Plaintext
     */
    _aeadDecrypt(ciphertextWithTag, nonce, aad) {
      if (ciphertextWithTag.length < this.TAG_SIZE) {
        throw new Error("Ciphertext too short for authentication tag");
      }

      if (nonce.length !== this.NONCE_SIZE) {
        throw new Error('XChaCha20-Poly1305 requires exactly 24-byte (192-bit) nonce');
      }

      /** @type {uint8[]} */
      const ciphertext = ciphertextWithTag.slice(0, -this.TAG_SIZE);
      /** @type {uint8[]} */
      const expectedTag = ciphertextWithTag.slice(-this.TAG_SIZE);

      // Generate Poly1305 key
      /** @type {uint8[]} */
      const macKey = this._poly1305KeyGen(this._key, nonce);

      // Verify authentication tag
      /** @type {uint8[]} */
      const tag = this._poly1305(macKey, this._authData(aad, ciphertext));

      if (!OpCodes.SecureCompare(tag, expectedTag)) {
        OpCodes.ClearArray(macKey);
        throw new Error('Authentication tag verification failed');
      }

      // Decrypt ciphertext with XChaCha20
      /** @type {uint8[]} */
      const plaintext = this._xchacha20(this._key, nonce, ciphertext);

      // Clear sensitive key material
      OpCodes.ClearArray(macKey);

      return plaintext;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XChaCha20Poly1305Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XChaCha20Poly1305Algorithm, XChaCha20Poly1305AlgorithmInstance };
}));