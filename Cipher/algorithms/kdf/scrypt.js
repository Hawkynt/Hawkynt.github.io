/*
 * scrypt Memory-Hard Key Derivation Function - Universal Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Based on RFC 7914 specification
 * Educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
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

  class ScryptAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "scrypt";
      this.description = "Sequential memory-hard key derivation function designed to resist brute-force attacks using specialized hardware. Uses large memory requirements to prevent time-memory trade-offs.";
      this.inventor = "Colin Percival";
      this.year = 2009;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard KDF";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CA; // Canada

      // KDF-specific configuration
      this.SupportedOutputSizes = [
        new KeySize(1, 1024, 0) // 1-1024 bytes output
      ];
      this.SaltRequired = true;

      // Documentation links
      this.documentation = [
        new LinkItem("RFC 7914 - The scrypt Password-Based Key Derivation Function", "https://tools.ietf.org/html/rfc7914"),
        new LinkItem("Stronger Key Derivation via Sequential Memory-Hard Functions", "https://www.tarsnap.com/scrypt/scrypt.pdf"),
        new LinkItem("Salsa20 Specification", "https://cr.yp.to/snuffle/spec.pdf")
      ];

      // Reference links
      this.references = [
        new LinkItem("OpenSSL EVP_PBE_scrypt", "https://github.com/openssl/openssl/blob/master/crypto/kdf/scrypt.c"),
        new LinkItem("Python Cryptography scrypt", "https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#scrypt"),
        new LinkItem("Node.js crypto.scrypt", "https://nodejs.org/api/crypto.html#crypto_crypto_scrypt_password_salt_keylen_options_callback")
      ];

      // Test vectors from RFC 7914 Section 12
      this.tests = [
        {
          text: "RFC 7914 Test Vector 1 - Empty password and salt",
          uri: "https://datatracker.ietf.org/doc/html/rfc7914#section-12",
          input: [], // Empty password
          salt: [], // Empty salt
          N: 16,
          r: 1,
          p: 1,
          keyLength: 64,
          expected: OpCodes.Hex8ToBytes("77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906")
        },
        {
          text: "RFC 7914 Test Vector 2 - password/NaCl",
          uri: "https://datatracker.ietf.org/doc/html/rfc7914#section-12",
          input: OpCodes.AnsiToBytes("password"),
          salt: OpCodes.AnsiToBytes("NaCl"),
          N: 1024,
          r: 8,
          p: 16,
          keyLength: 64,
          expected: OpCodes.Hex8ToBytes("fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640")
        },
        {
          text: "RFC 7914 Test Vector 3 - pleaseletmein/SodiumChloride",
          uri: "https://datatracker.ietf.org/doc/html/rfc7914#section-12",
          input: OpCodes.AnsiToBytes("pleaseletmein"),
          salt: OpCodes.AnsiToBytes("SodiumChloride"),
          N: 16384,
          r: 8,
          p: 1,
          keyLength: 64,
          expected: OpCodes.Hex8ToBytes("7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // KDFs cannot be reversed
      }
      return new ScryptInstance(this);
    }
  }

  // Instance class - handles the actual scrypt computation
  /**
 * Scrypt cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ScryptInstance extends IKdfInstance {
    constructor(algorithm) {
      super(algorithm);
      this._password = null;
      this._salt = null;
      this._N = 16; // Memory/time cost parameter (reduced for educational testing)
      this._r = 1;  // Block size parameter
      this._p = 1;  // Parallelization parameter
      this._keyLength = 64;
      this.OutputSize = 64;
      this.Iterations = 1; // scrypt doesn't use traditional iterations

      // scrypt constants
      this.SALSA20_ROUNDS = 8;
      this.BLOCK_SIZE = 64;
    }

    // Property getters and setters
    get password() { return this._password; }
    set password(pwd) { this._password = pwd; }

    get salt() { return this._salt; }
    set salt(saltData) { this._salt = saltData; }

    get N() { return this._N; }
    set N(n) { this._N = n; }

    get r() { return this._r; }
    set r(r) { this._r = r; }

    get p() { return this._p; }
    set p(p) { this._p = p; }

    get keyLength() { return this._keyLength; }
    set keyLength(len) { this._keyLength = len; this.OutputSize = len; }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; this._keyLength = value; }

    get iterations() { return this.Iterations; }
    set iterations(value) { this.Iterations = value; }

    // Feed data (not typically used for KDFs, but for framework compatibility)
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!this._password) this._password = data;
    }

    // Get the KDF result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._password || !this._salt) {
        throw new Error('Password and salt required for scrypt');
      }

      return this._computeScrypt(
        this._password,
        this._salt,
        this._N || 16,
        this._r || 1,
        this._p || 1,
        this._keyLength || 64
      );
    }

    // Method for test framework to set scrypt-specific parameters
    SetTestParameters(testVector) {
      if (testVector) {
        if (testVector.N !== undefined) this._N = testVector.N;
        if (testVector.r !== undefined) this._r = testVector.r;
        if (testVector.p !== undefined) this._p = testVector.p;
        if (testVector.keyLength !== undefined) {
          this._keyLength = testVector.keyLength;
          this.OutputSize = testVector.keyLength;
        }
        if (testVector.input !== undefined) this._password = testVector.input;
        if (testVector.salt !== undefined) this._salt = testVector.salt;
      }
    }

    // RFC 7914 compliant scrypt computation
    _computeScrypt(password, salt, N, r, p, keyLength) {
      // Convert string inputs to byte arrays if needed
      if (typeof password === 'string') {
        password = OpCodes.AnsiToBytes(password);
      }
      if (typeof salt === 'string') {
        salt = OpCodes.AnsiToBytes(salt);
      }

      // Step 1: Generate initial derived key using PBKDF2-HMAC-SHA256
      const B = this._pbkdf2(password, salt, 1, p * 128 * r);

      // Step 2: Apply scryptROMix to each block in parallel
      const blocks = new Array(p * 128 * r);
      for (let i = 0; i < p; i++) {
        const blockStart = i * 128 * r;
        const block = B.slice(blockStart, blockStart + 128 * r);
        const mixed = this._scryptROMix(block, N, r);
        for (let j = 0; j < mixed.length; j++) {
          blocks[blockStart + j] = mixed[j];
        }
      }

      // Step 3: Final PBKDF2-HMAC-SHA256 to produce output
      return this._pbkdf2(password, blocks, 1, keyLength);
    }

    // RFC 2898 compliant PBKDF2 with HMAC-SHA256
    _pbkdf2(password, salt, iterations, keyLength) {
      const hLen = 32; // SHA-256 output length
      const dkLen = keyLength;
      const l = Math.ceil(dkLen / hLen);
      const r = dkLen - (l - 1) * hLen;

      let dk = [];

      for (let i = 1; i <= l; i++) {
        const T = this._f(password, salt, iterations, i);
        dk.push(...T);
      }

      return dk.slice(0, dkLen);
    }

    // PBKDF2 F function
    _f(password, salt, iterations, i) {
      // U1 = PRF(Password, Salt || INT_32_BE(i))
      const iBytes = OpCodes.Unpack32BE(i);
      const saltPlusI = [...salt, ...iBytes];
      let U = this._hmacSha256(password, saltPlusI);
      let T = U.slice();

      // U2 = PRF(Password, U1), T = U1 XOR U2
      // ...
      // Uc = PRF(Password, Uc-1), T = T XOR Uc
      for (let j = 1; j < iterations; j++) {
        U = this._hmacSha256(password, U);
        for (let k = 0; k < T.length; k++) {
          T[k] ^= U[k];
        }
      }

      return T;
    }

    // RFC 7914 scryptROMix function
    _scryptROMix(B, N, r) {
      let X = B.slice(); // Copy input block
      const V = new Array(N); // Memory array

      // Step 1: Fill memory array V
      for (let i = 0; i < N; i++) {
        V[i] = X.slice(); // Store copy of X
        X = this._scryptBlockMix(X, r);
      }

      // Step 2: Use memory array to mix X
      for (let i = 0; i < N; i++) {
        const j = this._integerify(X, r) & (N - 1);

        // XOR X with V[j]
        X = OpCodes.XorArrays(X, V[j]);

        // Apply BlockMix
        X = this._scryptBlockMix(X, r);
      }

      return X;
    }

    // RFC 7914 scryptBlockMix function
    _scryptBlockMix(B, r) {
      const blockLen = 64;
      const X = B.slice(B.length - blockLen); // X = B[2r-1]
      const Y = new Array(B.length);

      // Process each block and store in Y sequentially
      for (let i = 0; i < 2 * r; i++) {
        const blockStart = i * blockLen;

        // X = Salsa20/8(X ⊕ B[i])
        for (let j = 0; j < blockLen; j++) {
          X[j] ^= B[blockStart + j];
        }
        this._salsa20_8(X);

        // Store X in Y[i]
        for (let j = 0; j < blockLen; j++) {
          Y[i * blockLen + j] = X[j];
        }
      }

      // Rearrange: B' <-- (Y_0, Y_2, ..., Y_{2r-2}, Y_1, Y_3, ..., Y_{2r-1})
      const result = new Array(B.length);
      for (let i = 0; i < r; i++) {
        // Copy even blocks to first half
        for (let j = 0; j < blockLen; j++) {
          result[i * blockLen + j] = Y[(i * 2) * blockLen + j];
        }
      }
      for (let i = 0; i < r; i++) {
        // Copy odd blocks to second half
        for (let j = 0; j < blockLen; j++) {
          result[(i + r) * blockLen + j] = Y[(i * 2 + 1) * blockLen + j];
        }
      }

      return result;
    }

    // Salsa20/8 core function as specified in RFC 7914
    _salsa20_8(B) {
      // Convert 64-byte array to 16 32-bit words (little-endian)
      const B32 = new Array(16);
      const x = new Array(16);
      for (let i = 0; i < 16; i++) {
        B32[i] = OpCodes.Pack32LE(B[i*4], B[i*4+1], B[i*4+2], B[i*4+3]);
        x[i] = B32[i];
      }

      // Salsa20/8 core (8 rounds of double-round = 4 iterations)
      for (let i = 0; i < 4; i++) {
        // Odd round (operate on columns)
        x[ 4] ^= OpCodes.RotL32((x[ 0] + x[12]) >>> 0, 7);
        x[ 8] ^= OpCodes.RotL32((x[ 4] + x[ 0]) >>> 0, 9);
        x[12] ^= OpCodes.RotL32((x[ 8] + x[ 4]) >>> 0, 13);
        x[ 0] ^= OpCodes.RotL32((x[12] + x[ 8]) >>> 0, 18);

        x[ 9] ^= OpCodes.RotL32((x[ 5] + x[ 1]) >>> 0, 7);
        x[13] ^= OpCodes.RotL32((x[ 9] + x[ 5]) >>> 0, 9);
        x[ 1] ^= OpCodes.RotL32((x[13] + x[ 9]) >>> 0, 13);
        x[ 5] ^= OpCodes.RotL32((x[ 1] + x[13]) >>> 0, 18);

        x[14] ^= OpCodes.RotL32((x[10] + x[ 6]) >>> 0, 7);
        x[ 2] ^= OpCodes.RotL32((x[14] + x[10]) >>> 0, 9);
        x[ 6] ^= OpCodes.RotL32((x[ 2] + x[14]) >>> 0, 13);
        x[10] ^= OpCodes.RotL32((x[ 6] + x[ 2]) >>> 0, 18);

        x[ 3] ^= OpCodes.RotL32((x[15] + x[11]) >>> 0, 7);
        x[ 7] ^= OpCodes.RotL32((x[ 3] + x[15]) >>> 0, 9);
        x[11] ^= OpCodes.RotL32((x[ 7] + x[ 3]) >>> 0, 13);
        x[15] ^= OpCodes.RotL32((x[11] + x[ 7]) >>> 0, 18);

        // Even round (operate on rows)
        x[ 1] ^= OpCodes.RotL32((x[ 0] + x[ 3]) >>> 0, 7);
        x[ 2] ^= OpCodes.RotL32((x[ 1] + x[ 0]) >>> 0, 9);
        x[ 3] ^= OpCodes.RotL32((x[ 2] + x[ 1]) >>> 0, 13);
        x[ 0] ^= OpCodes.RotL32((x[ 3] + x[ 2]) >>> 0, 18);

        x[ 6] ^= OpCodes.RotL32((x[ 5] + x[ 4]) >>> 0, 7);
        x[ 7] ^= OpCodes.RotL32((x[ 6] + x[ 5]) >>> 0, 9);
        x[ 4] ^= OpCodes.RotL32((x[ 7] + x[ 6]) >>> 0, 13);
        x[ 5] ^= OpCodes.RotL32((x[ 4] + x[ 7]) >>> 0, 18);

        x[11] ^= OpCodes.RotL32((x[10] + x[ 9]) >>> 0, 7);
        x[ 8] ^= OpCodes.RotL32((x[11] + x[10]) >>> 0, 9);
        x[ 9] ^= OpCodes.RotL32((x[ 8] + x[11]) >>> 0, 13);
        x[10] ^= OpCodes.RotL32((x[ 9] + x[ 8]) >>> 0, 18);

        x[12] ^= OpCodes.RotL32((x[15] + x[14]) >>> 0, 7);
        x[13] ^= OpCodes.RotL32((x[12] + x[15]) >>> 0, 9);
        x[14] ^= OpCodes.RotL32((x[13] + x[12]) >>> 0, 13);
        x[15] ^= OpCodes.RotL32((x[14] + x[13]) >>> 0, 18);
      }

      // Add original B32 to x (B32 = B32 + x)
      for (let i = 0; i < 16; i++) {
        B32[i] = (B32[i] + x[i]) >>> 0;
      }

      // Convert back to bytes (little-endian)
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(B32[i]);
        B[i*4] = bytes[0];
        B[i*4+1] = bytes[1];
        B[i*4+2] = bytes[2];
        B[i*4+3] = bytes[3];
      }
    }

    // Integerify function - extract integer from block as per RFC 7914
    _integerify(B, r) {
      // Extract from the first 4 bytes of the last 64-byte sub-block
      // B has length 128*r bytes, divided into 2*r blocks of 64 bytes each
      // We want the last (2*r-th) block, which starts at offset (2*r-1)*64
      const blockSize = 64;
      const lastBlockOffset = (2 * r - 1) * blockSize;

      if (lastBlockOffset + 4 > B.length) return 0;

      // Read as little-endian 32-bit integer (use >>> 0 to force unsigned)
      return (B[lastBlockOffset] |
             (B[lastBlockOffset + 1] << 8) |
             (B[lastBlockOffset + 2] << 16) |
             (B[lastBlockOffset + 3] << 24)) >>> 0;
    }

    // HMAC-SHA256 implementation
    _hmacSha256(key, message) {
      const blockSize = 64;
      const outputSize = 32;

      // Adjust key length
      if (key.length > blockSize) {
        key = this._sha256(key);
      }
      if (key.length < blockSize) {
        const padded = new Array(blockSize).fill(0);
        for (let i = 0; i < key.length; i++) {
          padded[i] = key[i];
        }
        key = padded;
      }

      // Create inner and outer padded keys
      const ipad = new Array(blockSize);
      const opad = new Array(blockSize);
      const ipadByte = 0x36;
      const opadByte = 0x5C;
      for (let i = 0; i < blockSize; i++) {
        ipad[i] = key[i] ^ ipadByte;
        opad[i] = key[i] ^ opadByte;
      }

      // HMAC = H(opad || H(ipad || message))
      const inner = this._sha256([...ipad, ...message]);
      return this._sha256([...opad, ...inner]);
    }

    // SHA-256 implementation using existing algorithm
    _sha256(data) {
      // Use the existing SHA-256 algorithm from the framework
      // Try to find SHA-256 algorithm
      let sha256 = AlgorithmFramework.Find('SHA-256');

      // If SHA-256 not available, try to load it dynamically
      if (!sha256) {
        try {
          if (typeof require !== 'undefined') {
            // Try to load SHA-256 algorithm
            require('../hash/sha256.js');
            sha256 = AlgorithmFramework.Find('SHA-256');
          }
        } catch (e) {
          // Ignore loading errors and try alternative names
        }
      }

      // Try alternative names if still not found
      if (!sha256) {
        sha256 = AlgorithmFramework.Find('SHA256') || AlgorithmFramework.Find('sha256');
      }

      if (!sha256) {
        throw new Error('SHA-256 algorithm not available - required for scrypt. Ensure sha256.js is loaded.');
      }
      const instance = sha256.CreateInstance();
      instance.Feed(data);
      return instance.Result();
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ScryptAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ScryptAlgorithm, ScryptInstance };
}));