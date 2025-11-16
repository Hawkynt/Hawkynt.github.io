/*
 * PBKDF2 Implementation
 * Educational implementation of Password-Based Key Derivation Function 2
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

  class PBKDF2Algorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PBKDF2";
      this.description = "Password-Based Key Derivation Function 2 (PBKDF2) using HMAC-SHA1 for key stretching. Converts passwords into cryptographic keys through iterative hashing. Educational implementation demonstrating key derivation principles.";
      this.inventor = "RSA Laboratories";
      this.year = 2000;
      this.category = CategoryType.KDF;
      this.subCategory = "Key Derivation Function";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = true;
      this.SupportedOutputSizes = [1, 128]; // 1 to 128 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 2898 - PKCS #5: Password-Based Cryptography Specification", "https://tools.ietf.org/html/rfc2898"),
        new LinkItem("Wikipedia - PBKDF2", "https://en.wikipedia.org/wiki/PBKDF2"),
        new LinkItem("OWASP Password Storage", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html")
      ];

      this.references = [
        new LinkItem("NIST SP 800-132", "https://csrc.nist.gov/publications/detail/sp/800-132/final"),
        new LinkItem("bcrypt vs PBKDF2", "https://security.stackexchange.com/questions/4781/do-any-security-experts-recommend-bcrypt-for-password-storage"),
        new LinkItem("Python PBKDF2 Implementation", "https://docs.python.org/3/library/hashlib.html#hashlib.pbkdf2_hmac")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Timing Attacks",
          "Use constant-time comparison for password verification and sufficient iteration counts"
        ),
        new Vulnerability(
          "Insufficient Iteration Count",
          "Use minimum 100,000 iterations for 2023. Increase over time as computing power grows"
        )
      ];

      // Test vectors from RFC 6070 (PBKDF2-HMAC-SHA1)
      this.tests = [
        {
          text: "RFC 6070 Test Vector 1: password/salt, 1 iteration",
          uri: "https://tools.ietf.org/html/rfc6070",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          iterations: 1,
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes("0c60c80f961f0e71f3a9b524af6012062fe037a6")
        },
        {
          text: "RFC 6070 Test Vector 2: password/salt, 2 iterations",
          uri: "https://tools.ietf.org/html/rfc6070",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('salt'),
          iterations: 2,
          outputSize: 20,
          expected: OpCodes.Hex8ToBytes("ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PBKDF2Instance(this, isInverse);
    }
  }

  /**
 * PBKDF2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PBKDF2Instance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this.Iterations = 100000; // Default secure iteration count
      this.salt = null;
    }

    // Property aliases for test vector compatibility
    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; }

    get iterations() { return this.Iterations; }
    set iterations(value) { this.Iterations = value; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('PBKDF2Instance.Feed: Input must be byte array (password)');
      }

      if (this.isInverse) {
        throw new Error('PBKDF2Instance.Feed: PBKDF2 cannot be reversed (one-way function)');
      }

      // Store input data for Result() method
      this._inputData = data;
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // PBKDF2 can work with pre-set parameters or fed data
      if (!this.password && !this._inputData) {
        throw new Error('PBKDF2Instance.Result: Password required - use Feed() method or set password directly');
      }

      const pwd = this.password || this._inputData;
      const slt = this.salt || [];
      const iter = this.Iterations || 4096;
      const outSize = this.OutputSize || 32;

      return this.deriveKey(pwd, slt, iter, outSize);
    }

    deriveKey(password, salt, iterations, outputSize) {
      const hLen = 20; // SHA1 output size (using HMAC-SHA1 per RFC 6070)
      const l = Math.ceil(outputSize / hLen);
      const r = outputSize - (l - 1) * hLen;

      let derivedKey = [];

      for (let i = 1; i <= l; i++) {
        const block = this.F(password, salt, iterations, i);

        if (i < l) {
          derivedKey = derivedKey.concat(block);
        } else {
          // Last block - only take r bytes
          derivedKey = derivedKey.concat(block.slice(0, r));
        }
      }

      return derivedKey;
    }

    F(password, salt, iterations, blockNumber) {
      // F(P, S, c, i) = U_1 XOR U_2 XOR ... XOR U_c

      // U_1 = PRF(P, S || INT(i))
      const saltPlusI = [...salt, ...this.intToBytes(blockNumber)];
      let U = this.hmacSha1(password, saltPlusI);
      let result = [...U];

      // U_2 through U_c
      for (let j = 2; j <= iterations; j++) {
        U = this.hmacSha1(password, U);
        result = OpCodes.XorArrays(result, U);
      }

      return result;
    }

    hmacSha1(key, data) {
      // Self-contained HMAC-SHA1 implementation for PBKDF2
      // HMAC(K, M) = H((K ⊕ opad) || H((K ⊕ ipad) || M))

      const blockSize = 64; // SHA-1 block size
      const opad = 0x5C;
      const ipad = 0x36;

      // If key is longer than block size, hash it
      let keyBytes = Array.isArray(key) ? [...key] : OpCodes.AnsiToBytes(key.toString());
      if (keyBytes.length > blockSize) {
        keyBytes = this.sha1(keyBytes);
      }

      // Pad key to block size
      while (keyBytes.length < blockSize) {
        keyBytes.push(0);
      }

      // Create inner and outer padded keys
      const innerKey = keyBytes.map(b => b ^ ipad);
      const outerKey = keyBytes.map(b => b ^ opad);

      // HMAC = H(outer_key || H(inner_key || data))
      const innerHash = this.sha1([...innerKey, ...data]);
      return this.sha1([...outerKey, ...innerHash]);
    }

    sha1(data) {
      // Try to use framework SHA-1 algorithm first
      const sha1Alg = AlgorithmFramework.Find('SHA-1');
      if (sha1Alg) {
        const sha1Instance = sha1Alg.CreateInstance();
        sha1Instance.Feed(data);
        return sha1Instance.Result();
      }

      // If SHA-1 not available, try to load it dynamically
      try {
        if (typeof require !== 'undefined') {
          // Try to load SHA-1 algorithm
          require('../hash/sha1.js');
          const sha1AlgNow = AlgorithmFramework.Find('SHA-1');
          if (sha1AlgNow) {
            const sha1Instance = sha1AlgNow.CreateInstance();
            sha1Instance.Feed(data);
            return sha1Instance.Result();
          }
        }
      } catch (e) {
        // Ignore loading errors and fall back
      }

      // Self-contained SHA-1 implementation for PBKDF2 as last resort
      // This ensures the algorithm works independently of other framework components

      // Define masks since they're not in OpCodes
      const MASK32 = 0xFFFFFFFF;

      // SHA-1 initial hash values
      const h = OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476C3D2E1F0');

      // Pre-processing: pad message
      const paddedData = [...data];
      const originalLength = data.length * 8;

      paddedData.push(0x80);
      while (paddedData.length % 64 !== 56) {
        paddedData.push(0);
      }

      // Append length as 64-bit big-endian
      for (let i = 7; i >= 0; i--) {
        paddedData.push((originalLength >>> (i * 8)) & 0xFF);
      }

      // Process message in chunks of 64 bytes
      for (let chunkStart = 0; chunkStart < paddedData.length; chunkStart += 64) {
        const w = new Array(80);

        // Break chunk into sixteen 32-bit big-endian words
        for (let i = 0; i < 16; i++) {
          w[i] = OpCodes.Pack32BE(
            paddedData[chunkStart + i * 4],
            paddedData[chunkStart + i * 4 + 1],
            paddedData[chunkStart + i * 4 + 2],
            paddedData[chunkStart + i * 4 + 3]
          );
        }

        // Extend the sixteen 32-bit words into eighty 32-bit words
        for (let i = 16; i < 80; i++) {
          w[i] = this.leftRotate(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
        }

        // Initialize hash value for this chunk
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];

        // Main loop
        for (let i = 0; i < 80; i++) {
          let f, k;
          if (i < 20) {
            f = (b & c) | (~b & d);
            k = OpCodes.Hex32ToDWords('5A827999')[0];
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = OpCodes.Hex32ToDWords('6ED9EBA1')[0];
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = OpCodes.Hex32ToDWords('8F1BBCDC')[0];
          } else {
            f = b ^ c ^ d;
            k = OpCodes.Hex32ToDWords('CA62C1D6')[0];
          }

          const temp = (this.leftRotate(a, 5) + f + e + k + w[i]) & MASK32;
          e = d;
          d = c;
          c = this.leftRotate(b, 30);
          b = a;
          a = temp;
        }

        // Add this chunk's hash to result so far
        h[0] = (h[0] + a) & MASK32;
        h[1] = (h[1] + b) & MASK32;
        h[2] = (h[2] + c) & MASK32;
        h[3] = (h[3] + d) & MASK32;
        h[4] = (h[4] + e) & MASK32;
      }

      // Convert to byte array
      const result = [];
      for (let i = 0; i < 5; i++) {
        const bytes = OpCodes.Unpack32BE(h[i]);
        result.push(...bytes);
      }

      return result;
    }

    leftRotate(value, amount) {
      return OpCodes.RotL32(value, amount);
    }

    intToBytes(value) {
      return OpCodes.Unpack32BE(value);
    }

    // Configuration methods
    setSalt(salt) {
      this.salt = Array.isArray(salt) ? salt : OpCodes.AnsiToBytes(salt);
    }

    setIterations(iterations) {
      if (iterations < 1000) {
        console.warn('PBKDF2: Low iteration count may be insecure');
      }
      this.Iterations = iterations;
    }

    setOutputSize(size) {
      if (size < 16) {
        console.warn('PBKDF2: Small output size may be insecure');
      }
      this.OutputSize = size;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new PBKDF2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PBKDF2Algorithm, PBKDF2Instance };
}));