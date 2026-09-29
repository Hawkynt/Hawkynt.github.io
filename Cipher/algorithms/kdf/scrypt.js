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
   * @returns {ScryptInstance} New instance (null for the inverse, which a KDF has not)
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
 * Scrypt instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class ScryptInstance extends IKdfInstance {
    /**
     * Initialize an scrypt instance with the default (educational) parameters
     * @param {ScryptAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._password = null;
      /** @type {uint8[]} */
      this._salt = null;
      /** @type {int32} Memory/time cost parameter (reduced for educational testing) */
      this._N = 16;
      /** @type {int32} Block size parameter */
      this._r = 1;
      /** @type {int32} Parallelization parameter */
      this._p = 1;
      /** @type {int32} */
      this._keyLength = 64;
      this.OutputSize = 64;
      this.Iterations = 1; // scrypt doesn't use traditional iterations

      // scrypt constants
      /** @type {int32} */
      this.SALSA20_ROUNDS = 8;
      /** @type {int32} */
      this.BLOCK_SIZE = 64;
    }

    // Property getters and setters
    /** @returns {uint8[]} Password bytes */
    get password() { return this._password; }
    /** @param {uint8[]} pwd - Password bytes */
    set password(pwd) { this._password = pwd; }

    /** @returns {uint8[]} Salt bytes */
    get salt() { return this._salt; }
    /** @param {uint8[]} saltData - Salt bytes */
    set salt(saltData) { this._salt = saltData; }

    /** @returns {int32} CPU/memory cost N */
    get N() { return this._N; }
    /** @param {int32} n - CPU/memory cost N */
    set N(n) { this._N = n; }

    /** @returns {int32} Block size r */
    get r() { return this._r; }
    /** @param {int32} r - Block size r */
    set r(r) { this._r = r; }

    /** @returns {int32} Parallelization p */
    get p() { return this._p; }
    /** @param {int32} p - Parallelization p */
    set p(p) { this._p = p; }

    /** @returns {int32} Derived key length in bytes */
    get keyLength() { return this._keyLength; }
    /** @param {int32} len - Derived key length in bytes */
    set keyLength(len) { this._keyLength = len; this.OutputSize = len; }

    /** @returns {int32} Derived key length in bytes */
    get outputSize() { return this.OutputSize; }
    /** @param {int32} value - Derived key length in bytes */
    set outputSize(value) { this.OutputSize = value; this._keyLength = value; }

    /** @returns {int32} Iteration count (unused by scrypt) */
    get iterations() { return this.Iterations; }
    /** @param {int32} value - Iteration count (unused by scrypt) */
    set iterations(value) { this.Iterations = value; }

    // Feed data (not typically used for KDFs, but for framework compatibility)
    /**
   * Append password bytes
   * @param {uint8[]} data - Password bytes
   * @returns {void}
   */

    Feed(data) {
      // Feed is a streaming interface: successive calls extend the password
      // rather than being dropped, so Feed(a); Feed(b) derives from the same
      // octet string as Feed(a || b).
      if (!this._password) this._password = [];
      for (let i = 0; i < data.length; i++) this._password.push(data[i]);
    }

    // Get the KDF result
    /**
   * Derive the key from the fed password and the configured salt
   * @returns {uint8[]} Derived key bytes
   * @throws {Error} If password or salt is not set
   */

    Result() {
      if (!this._password || !this._salt) {
        throw new Error('Password and salt required for scrypt');
      }

      // A parameter left unset (0, undefined) falls back to its default
      return this._computeScrypt(
        this._password,
        this._salt,
        this._N ? this._N : 16,
        this._r ? this._r : 1,
        this._p ? this._p : 1,
        this._keyLength ? this._keyLength : 64
      );
    }

    /**
     * RFC 7914 compliant scrypt computation
     * @param {uint8[]} password - Password bytes
     * @param {uint8[]} salt - Salt bytes
     * @param {int32} N - CPU/memory cost
     * @param {int32} r - Block size
     * @param {int32} p - Parallelization
     * @param {int32} keyLength - Derived key length in bytes
     * @returns {uint8[]} Derived key
     */
    _computeScrypt(password, salt, N, r, p, keyLength) {
      // Step 1: Generate initial derived key using PBKDF2-HMAC-SHA256
      const B = this._pbkdf2(password, salt, 1, p * 128 * r);

      // Step 2: Apply scryptROMix to each block in parallel
      /** @type {uint8[]} */
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

    /**
     * RFC 2898 compliant PBKDF2 with HMAC-SHA256
     * @param {uint8[]} password - Password bytes
     * @param {uint8[]} salt - Salt bytes
     * @param {int32} iterations - Iteration count
     * @param {int32} keyLength - Derived key length in bytes
     * @returns {uint8[]} Derived key
     */
    _pbkdf2(password, salt, iterations, keyLength) {
      const hLen = 32; // SHA-256 output length
      const dkLen = keyLength;
      /** @type {int32} */
      const l = Math.ceil(dkLen / hLen);

      /** @type {uint8[]} */
      const dk = [];

      for (let i = 1; i <= l; i++) {
        const T = this._f(password, salt, iterations, i);
        for (let _i = 0; _i < T.length; _i++) dk.push(T[_i]);
      }

      return dk.slice(0, dkLen);
    }

    /**
     * PBKDF2 F function
     * @param {uint8[]} password - Password bytes
     * @param {uint8[]} salt - Salt bytes
     * @param {int32} iterations - Iteration count
     * @param {int32} i - Block index (1-based)
     * @returns {uint8[]} Output block T_i
     */
    _f(password, salt, iterations, i) {
      // U1 = PRF(Password, Salt || INT_32_BE(i))
      const iBytes = OpCodes.Unpack32BE(i);
      /** @type {uint8[]} */
      const saltPlusI = salt.concat(iBytes);
      let U = this._hmacSha256(password, saltPlusI);
      let T = U.slice();

      // U2 = PRF(Password, U1), T = U1 XOR U2
      // ...
      // Uc = PRF(Password, Uc-1), T = T XOR Uc
      for (let j = 1; j < iterations; j++) {
        U = this._hmacSha256(password, U);
        T = OpCodes.XorArrays(T, U);
      }

      return T;
    }

    /**
     * RFC 7914 scryptROMix function
     * @param {uint8[]} B - 128*r-byte block
     * @param {int32} N - CPU/memory cost
     * @param {int32} r - Block size
     * @returns {uint8[]} Mixed block
     */
    _scryptROMix(B, N, r) {
      let X = B.slice(); // Copy input block
      /** @type {uint8[][]} */
      const V = new Array(N); // Memory array

      // Step 1: Fill memory array V
      for (let i = 0; i < N; i++) {
        V[i] = X.slice(); // Store copy of X
        X = this._scryptBlockMix(X, r);
      }

      // Step 2: Use memory array to mix X
      for (let i = 0; i < N; i++) {
        /** @type {int32} */
        const j = OpCodes.And32(this._integerify(X, r), N - 1);

        // XOR X with V[j]
        X = OpCodes.XorArrays(X, V[j]);

        // Apply BlockMix
        X = this._scryptBlockMix(X, r);
      }

      return X;
    }

    /**
     * RFC 7914 scryptBlockMix function
     * @param {uint8[]} B - 2*r 64-byte blocks
     * @param {int32} r - Block size
     * @returns {uint8[]} Mixed and shuffled blocks
     */
    _scryptBlockMix(B, r) {
      const blockLen = 64;
      let X = B.slice(B.length - blockLen); // X = B[2r-1]
      /** @type {uint8[]} */
      const Y = new Array(B.length);

      // Process each block and store in Y sequentially
      for (let i = 0; i < 2 * r; i++) {
        const blockStart = i * blockLen;

        // X = Salsa20/8(X xor B[i])
        const blockSlice = B.slice(blockStart, blockStart + blockLen);
        X = OpCodes.XorArrays(X, blockSlice);
        this._salsa20_8(X);

        // Store X in Y[i]
        for (let j = 0; j < blockLen; j++) {
          Y[i * blockLen + j] = X[j];
        }
      }

      // Rearrange: B' <-- (Y_0, Y_2, ..., Y_{2r-2}, Y_1, Y_3, ..., Y_{2r-1})
      /** @type {uint8[]} */
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

    /**
     * Salsa20/8 core function as specified in RFC 7914, in place
     * @param {uint8[]} B - 64-byte block, overwritten with the result
     * @returns {void}
     */
    _salsa20_8(B) {
      // Convert 64-byte array to 16 32-bit words (little-endian)
      /** @type {uint32[]} */
      const B32 = new Array(16);
      /** @type {uint32[]} */
      const x = new Array(16);
      for (let i = 0; i < 16; i++) {
        B32[i] = OpCodes.Pack32LE(B[i*4], B[i*4+1], B[i*4+2], B[i*4+3]);
        x[i] = B32[i];
      }

      // Salsa20/8 core (8 rounds of double-round = 4 iterations)
      for (let i = 0; i < 4; i++) {
        // Odd round (operate on columns)
        x[ 4] = OpCodes.Xor32(x[ 4], OpCodes.RotL32(OpCodes.Add32(x[ 0], x[12]), 7));
        x[ 8] = OpCodes.Xor32(x[ 8], OpCodes.RotL32(OpCodes.Add32(x[ 4], x[ 0]), 9));
        x[12] = OpCodes.Xor32(x[12], OpCodes.RotL32(OpCodes.Add32(x[ 8], x[ 4]), 13));
        x[ 0] = OpCodes.Xor32(x[ 0], OpCodes.RotL32(OpCodes.Add32(x[12], x[ 8]), 18));

        x[ 9] = OpCodes.Xor32(x[ 9], OpCodes.RotL32(OpCodes.Add32(x[ 5], x[ 1]), 7));
        x[13] = OpCodes.Xor32(x[13], OpCodes.RotL32(OpCodes.Add32(x[ 9], x[ 5]), 9));
        x[ 1] = OpCodes.Xor32(x[ 1], OpCodes.RotL32(OpCodes.Add32(x[13], x[ 9]), 13));
        x[ 5] = OpCodes.Xor32(x[ 5], OpCodes.RotL32(OpCodes.Add32(x[ 1], x[13]), 18));

        x[14] = OpCodes.Xor32(x[14], OpCodes.RotL32(OpCodes.Add32(x[10], x[ 6]), 7));
        x[ 2] = OpCodes.Xor32(x[ 2], OpCodes.RotL32(OpCodes.Add32(x[14], x[10]), 9));
        x[ 6] = OpCodes.Xor32(x[ 6], OpCodes.RotL32(OpCodes.Add32(x[ 2], x[14]), 13));
        x[10] = OpCodes.Xor32(x[10], OpCodes.RotL32(OpCodes.Add32(x[ 6], x[ 2]), 18));

        x[ 3] = OpCodes.Xor32(x[ 3], OpCodes.RotL32(OpCodes.Add32(x[15], x[11]), 7));
        x[ 7] = OpCodes.Xor32(x[ 7], OpCodes.RotL32(OpCodes.Add32(x[ 3], x[15]), 9));
        x[11] = OpCodes.Xor32(x[11], OpCodes.RotL32(OpCodes.Add32(x[ 7], x[ 3]), 13));
        x[15] = OpCodes.Xor32(x[15], OpCodes.RotL32(OpCodes.Add32(x[11], x[ 7]), 18));

        // Even round (operate on rows)
        x[ 1] = OpCodes.Xor32(x[ 1], OpCodes.RotL32(OpCodes.Add32(x[ 0], x[ 3]), 7));
        x[ 2] = OpCodes.Xor32(x[ 2], OpCodes.RotL32(OpCodes.Add32(x[ 1], x[ 0]), 9));
        x[ 3] = OpCodes.Xor32(x[ 3], OpCodes.RotL32(OpCodes.Add32(x[ 2], x[ 1]), 13));
        x[ 0] = OpCodes.Xor32(x[ 0], OpCodes.RotL32(OpCodes.Add32(x[ 3], x[ 2]), 18));

        x[ 6] = OpCodes.Xor32(x[ 6], OpCodes.RotL32(OpCodes.Add32(x[ 5], x[ 4]), 7));
        x[ 7] = OpCodes.Xor32(x[ 7], OpCodes.RotL32(OpCodes.Add32(x[ 6], x[ 5]), 9));
        x[ 4] = OpCodes.Xor32(x[ 4], OpCodes.RotL32(OpCodes.Add32(x[ 7], x[ 6]), 13));
        x[ 5] = OpCodes.Xor32(x[ 5], OpCodes.RotL32(OpCodes.Add32(x[ 4], x[ 7]), 18));

        x[11] = OpCodes.Xor32(x[11], OpCodes.RotL32(OpCodes.Add32(x[10], x[ 9]), 7));
        x[ 8] = OpCodes.Xor32(x[ 8], OpCodes.RotL32(OpCodes.Add32(x[11], x[10]), 9));
        x[ 9] = OpCodes.Xor32(x[ 9], OpCodes.RotL32(OpCodes.Add32(x[ 8], x[11]), 13));
        x[10] = OpCodes.Xor32(x[10], OpCodes.RotL32(OpCodes.Add32(x[ 9], x[ 8]), 18));

        x[12] = OpCodes.Xor32(x[12], OpCodes.RotL32(OpCodes.Add32(x[15], x[14]), 7));
        x[13] = OpCodes.Xor32(x[13], OpCodes.RotL32(OpCodes.Add32(x[12], x[15]), 9));
        x[14] = OpCodes.Xor32(x[14], OpCodes.RotL32(OpCodes.Add32(x[13], x[12]), 13));
        x[15] = OpCodes.Xor32(x[15], OpCodes.RotL32(OpCodes.Add32(x[14], x[13]), 18));
      }

      // Add original B32 to x (B32 = B32 + x)
      for (let i = 0; i < 16; i++) {
        B32[i] = OpCodes.Add32(B32[i], x[i]);
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

    /**
     * Integerify function - extract integer from block as per RFC 7914
     * @param {uint8[]} B - 128*r-byte block
     * @param {int32} r - Block size
     * @returns {uint32} Little-endian word at the start of the last 64-byte sub-block
     */
    _integerify(B, r) {
      // Extract from the first 4 bytes of the last 64-byte sub-block
      // B has length 128*r bytes, divided into 2*r blocks of 64 bytes each
      // We want the last (2*r-th) block, which starts at offset (2*r-1)*64
      const blockSize = 64;
      const lastBlockOffset = (2 * r - 1) * blockSize;

      if (lastBlockOffset + 4 > B.length) return 0;

      // Read as little-endian 32-bit integer using OpCodes
      return OpCodes.Pack32LE(B[lastBlockOffset], B[lastBlockOffset + 1], B[lastBlockOffset + 2], B[lastBlockOffset + 3]);
    }

    /**
     * HMAC-SHA256 implementation
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} 32-byte MAC
     */
    _hmacSha256(key, message) {
      const blockSize = 64;

      // Adjust key length
      if (key.length > blockSize) {
        key = this._sha256(key);
      }
      if (key.length < blockSize) {
        /** @type {uint8[]} */
        const padded = new Array(blockSize);
        for (let i = 0; i < blockSize; i++) padded[i] = 0;
        for (let i = 0; i < key.length; i++) {
          padded[i] = key[i];
        }
        key = padded;
      }

      // Create inner and outer padded keys
      /** @type {uint8[]} */
      const ipad = new Array(blockSize);
      /** @type {uint8[]} */
      const opad = new Array(blockSize);
      const ipadByte = 0x36;
      const opadByte = 0x5C;
      for (let i = 0; i < blockSize; i++) {
        ipad[i] = OpCodes.Xor8(key[i], ipadByte);
        opad[i] = OpCodes.Xor8(key[i], opadByte);
      }

      // HMAC = H(opad || H(ipad || message))
      const inner = this._sha256(ipad.concat(message));
      return this._sha256(opad.concat(inner));
    }

    /**
     * SHA-256 of a byte array, through the registered SHA-256 algorithm
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} 32-byte digest
     */
    _sha256(data) {
      // Use the existing SHA-256 algorithm from the framework
      // Try to find SHA-256 algorithm
      /** @type {Algorithm} */
      let sha256 = AlgorithmFramework.Find('SHA-256');

      // If SHA-256 not available, load it where a synchronous CommonJS
      // require exists (the same test the module wrapper uses for Node); an
      // AMD loader's require is asynchronous and is not asked
      if (!sha256 && typeof module === 'object' && typeof require === 'function') {
        require('../hash/sha256.js');
        sha256 = AlgorithmFramework.Find('SHA-256');
      }

      // Try alternative names if still not found
      if (!sha256) {
        sha256 = AlgorithmFramework.Find('SHA256');
      }
      if (!sha256) {
        sha256 = AlgorithmFramework.Find('sha256');
      }

      if (!sha256) {
        throw new Error('SHA-256 algorithm not available - required for scrypt. Ensure sha256.js is loaded.');
      }
      /** @type {IAlgorithmInstance} */
      const instance = sha256.CreateInstance();
      instance.Feed(data);
      /** @type {uint8[]} */
      const digest = instance.Result();
      return digest;
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