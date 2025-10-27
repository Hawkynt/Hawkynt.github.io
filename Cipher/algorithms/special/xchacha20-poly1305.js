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
      this.SupportedTagSizes = [16]; // 128-bit authentication tag
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

    CreateInstance(isInverse = false) {
      return new XChaCha20Poly1305AlgorithmInstance(this, isInverse);
    }
  }

  class XChaCha20Poly1305AlgorithmInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.nonce = null;
      this.inputBuffer = [];
      this.tagSize = 16; // 128-bit authentication tag

      // XChaCha20-Poly1305 specific state
      this.initialized = false;

      // Constants
      this.NONCE_SIZE = 24; // 192-bit nonces for XChaCha20
      this.TAG_SIZE = 16;
      this.KEY_SIZE = 32;
      this.BLOCK_SIZE = 64;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        const msg = OpCodes.AnsiToBytes(`Invalid key size: ${keyBytes.length} bytes`);
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      this._key = [...keyBytes];
      this.initialized = false;
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Set nonce for AEAD operation
    setNonce(nonce) {
      if (!nonce || nonce.length !== this.NONCE_SIZE) {
        const msg = OpCodes.AnsiToBytes("XChaCha20-Poly1305 requires 24-byte nonce");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }
      this.nonce = [...nonce];
      this.initialized = false;
    }

    // Set additional authenticated data
    setAAD(aad) {
      this.aad = aad ? [...aad] : [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) {
        const msg = OpCodes.AnsiToBytes("Key not set");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) {
        const msg = OpCodes.AnsiToBytes("Key not set");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      // Set default nonce if not provided (for test vectors)
      if (!this.nonce) {
        this.nonce = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]; // 24-byte nonce
      }

      const input = this.inputBuffer;
      const output = this.isInverse 
        ? this._aeadDecrypt(input, this.nonce, this.aad || [])
        : this._aeadEncrypt(input, this.nonce, this.aad || []);

      // Clear buffers for next operation
      this.inputBuffer = [];
      this.aad = [];

      return output;
    }

    // HChaCha20 - used for key derivation with extended nonce
    _hchacha20(key, nonce) {
      // Initialize state with constants, key, and first 16 bytes of nonce
      const state = new Array(16);

      // Constants "expand 32-byte k"
      state[0] = 0x61707865;
      state[1] = 0x3320646e;
      state[2] = 0x79622d32;
      state[3] = 0x6b206574;

      // Key
      for (let i = 0; i < 8; i++) {
        state[4 + i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1],
          key[i * 4 + 2], key[i * 4 + 3]
        );
      }

      // First 16 bytes of nonce
      for (let i = 0; i < 4; i++) {
        state[12 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }

      // Working state for rounds
      const workingState = OpCodes.CopyArray(state);

      // 20 rounds (10 double rounds)
      for (let i = 0; i < 10; i++) {
        // Column rounds
        this._quarterRound(workingState, 0, 4, 8, 12);
        this._quarterRound(workingState, 1, 5, 9, 13);
        this._quarterRound(workingState, 2, 6, 10, 14);
        this._quarterRound(workingState, 3, 7, 11, 15);

        // Diagonal rounds
        this._quarterRound(workingState, 0, 5, 10, 15);
        this._quarterRound(workingState, 1, 6, 11, 12);
        this._quarterRound(workingState, 2, 7, 8, 13);
        this._quarterRound(workingState, 3, 4, 9, 14);
      }

      // Extract key material: words 0, 1, 2, 3, 12, 13, 14, 15
      const derivedKey = [];
      const keyWords = [0, 1, 2, 3, 12, 13, 14, 15];

      for (const wordIndex of keyWords) {
        const bytes = OpCodes.Unpack32LE(workingState[wordIndex]);
        derivedKey.push(...bytes);
      }

      return derivedKey;
    }

    // ChaCha20 quarter round
    _quarterRound(state, a, b, c, d) {
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] = OpCodes.RotL32(state[d] ^ state[a], 16);

      state[c] = (state[c] + state[d]) >>> 0;
      state[b] = OpCodes.RotL32(state[b] ^ state[c], 12);

      state[a] = (state[a] + state[b]) >>> 0;
      state[d] = OpCodes.RotL32(state[d] ^ state[a], 8);

      state[c] = (state[c] + state[d]) >>> 0;
      state[b] = OpCodes.RotL32(state[b] ^ state[c], 7);
    }

    // ChaCha20 block function
    _chachaBlock(key, counter, nonce) {
      // Initialize state
      const state = new Array(16);

      // Constants "expand 32-byte k"
      state[0] = 0x61707865;
      state[1] = 0x3320646e;
      state[2] = 0x79622d32;
      state[3] = 0x6b206574;

      // Key
      for (let i = 0; i < 8; i++) {
        state[4 + i] = OpCodes.Pack32LE(
          key[i * 4], key[i * 4 + 1],
          key[i * 4 + 2], key[i * 4 + 3]
        );
      }

      // Counter
      state[12] = counter;

      // Nonce (12 bytes)
      for (let i = 0; i < 3; i++) {
        state[13 + i] = OpCodes.Pack32LE(
          nonce[i * 4], nonce[i * 4 + 1],
          nonce[i * 4 + 2], nonce[i * 4 + 3]
        );
      }

      // Working state for rounds
      const workingState = OpCodes.CopyArray(state);

      // 20 rounds (10 double rounds)
      for (let i = 0; i < 10; i++) {
        // Column rounds
        this._quarterRound(workingState, 0, 4, 8, 12);
        this._quarterRound(workingState, 1, 5, 9, 13);
        this._quarterRound(workingState, 2, 6, 10, 14);
        this._quarterRound(workingState, 3, 7, 11, 15);

        // Diagonal rounds
        this._quarterRound(workingState, 0, 5, 10, 15);
        this._quarterRound(workingState, 1, 6, 11, 12);
        this._quarterRound(workingState, 2, 7, 8, 13);
        this._quarterRound(workingState, 3, 4, 9, 14);
      }

      // Add original state
      for (let i = 0; i < 16; i++) {
        workingState[i] = (workingState[i] + state[i]) >>> 0;
      }

      // Serialize to bytes
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(workingState[i]);
        keystream.push(...bytes);
      }

      return keystream;
    }

    // XChaCha20 encryption/decryption
    _xchacha20(key, nonce, data) {
      // Derive key using HChaCha20 with first 16 bytes of nonce
      const derivedKey = this._hchacha20(key, nonce.slice(0, 16));

      // Use last 8 bytes of nonce + 4 zero bytes as ChaCha20 nonce
      const chacha20Nonce = new Array(12);
      chacha20Nonce.fill(0, 0, 4); // 4 zero bytes
      for (let i = 0; i < 8; i++) {
        chacha20Nonce[4 + i] = nonce[16 + i];
      }

      // Use standard ChaCha20 with derived key
      const result = [];
      let blockCounter = 1; // Start at 1 (0 reserved for Poly1305 key)

      for (let i = 0; i < data.length; i += this.BLOCK_SIZE) {
        const keystream = this._chachaBlock(derivedKey, blockCounter, chacha20Nonce);
        const block = data.slice(i, i + this.BLOCK_SIZE);

        for (let j = 0; j < block.length; j++) {
          result.push(block[j] ^ keystream[j]);
        }

        blockCounter++;
      }

      return result;
    }

    // XChaCha20-Poly1305 key generation for authentication
    _poly1305KeyGen(key, nonce) {
      // Derive key using HChaCha20
      const derivedKey = this._hchacha20(key, nonce.slice(0, 16));

      // Use last 8 bytes of nonce + 4 zero bytes as ChaCha20 nonce
      const chacha20Nonce = new Array(12);
      chacha20Nonce.fill(0, 0, 4);
      for (let i = 0; i < 8; i++) {
        chacha20Nonce[4 + i] = nonce[16 + i];
      }

      // Generate first block (counter = 0) for Poly1305 key
      const keystream = this._chachaBlock(derivedKey, 0, chacha20Nonce);
      return keystream.slice(0, 32);
    }

    // Poly1305 authenticator using framework's implementation
    _poly1305(key, data) {
      const poly1305Alg = AlgorithmFramework.Find('Poly1305');
      if (!poly1305Alg) {
        throw new Error('Poly1305 algorithm not found in framework');
      }

      const instance = poly1305Alg.CreateInstance();
      instance.key = key; // 32-byte key
      instance.Feed(data);
      return instance.Result();
    }

    // Pad data to 16-byte boundary
    _padToBlockSize(data) {
      const padded = OpCodes.CopyArray(data);
      while (padded.length % 16 !== 0) {
        padded.push(0);
      }
      return padded;
    }

    // Encode length as 8-byte little-endian
    _encodeLength(length) {
      const result = new Array(8);
      // JavaScript bitwise operators work on 32-bit integers only
      // Shifts >= 32 bits wrap around, so we need special handling
      for (let i = 0; i < 4; i++) {
        result[i] = (length >>> (i * 8)) & 0xFF;
      }
      // Upper 4 bytes are zero for lengths < 2^32
      for (let i = 4; i < 8; i++) {
        result[i] = 0;
      }
      return result;
    }

    _aeadEncrypt(plaintext, nonce, aad) {
      if (nonce.length !== this.NONCE_SIZE) {
        const msg = OpCodes.AnsiToBytes('XChaCha20-Poly1305 requires exactly 24-byte (192-bit) nonce');
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      // Generate Poly1305 key
      const poly1305Key = this._poly1305KeyGen(this._key, nonce);

      // Encrypt plaintext with XChaCha20
      const ciphertext = this._xchacha20(this._key, nonce, plaintext);

      // Construct data for authentication
      const authData = [];

      // Add AAD
      if (aad && aad.length > 0) {
        authData.push(...this._padToBlockSize(aad));
      }

      // Add ciphertext
      authData.push(...this._padToBlockSize(ciphertext));

      // Add lengths
      authData.push(...this._encodeLength(aad ? aad.length : 0));
      authData.push(...this._encodeLength(ciphertext.length));

      // Compute authentication tag
      const tag = this._poly1305(poly1305Key, authData);

      // Clear sensitive key material
      OpCodes.ClearArray(poly1305Key);

      return [...ciphertext, ...tag];
    }

    _aeadDecrypt(ciphertextWithTag, nonce, aad) {
      if (ciphertextWithTag.length < this.TAG_SIZE) {
        const msg = OpCodes.AnsiToBytes("Ciphertext too short for authentication tag");
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      if (nonce.length !== this.NONCE_SIZE) {
        const msg = OpCodes.AnsiToBytes('XChaCha20-Poly1305 requires exactly 24-byte (192-bit) nonce');
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      const ciphertext = ciphertextWithTag.slice(0, -this.TAG_SIZE);
      const expectedTag = ciphertextWithTag.slice(-this.TAG_SIZE);

      // Generate Poly1305 key
      const poly1305Key = this._poly1305KeyGen(this._key, nonce);

      // Construct data for authentication
      const authData = [];

      // Add AAD
      if (aad && aad.length > 0) {
        authData.push(...this._padToBlockSize(aad));
      }

      // Add ciphertext
      authData.push(...this._padToBlockSize(ciphertext));

      // Add lengths
      authData.push(...this._encodeLength(aad ? aad.length : 0));
      authData.push(...this._encodeLength(ciphertext.length));

      // Verify authentication tag
      const tag = this._poly1305(poly1305Key, authData);

      if (!OpCodes.SecureCompare(tag, expectedTag)) {
        OpCodes.ClearArray(poly1305Key);
        const msg = OpCodes.AnsiToBytes('Authentication tag verification failed');
        throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
      }

      // Decrypt ciphertext with XChaCha20
      const plaintext = this._xchacha20(this._key, nonce, ciphertext);

      // Clear sensitive key material
      OpCodes.ClearArray(poly1305Key);

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