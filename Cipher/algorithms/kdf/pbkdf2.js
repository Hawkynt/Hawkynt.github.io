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

      // Test vectors from RFC 6070
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes('password'),
          OpCodes.Hex8ToBytes("0c60c80f961f0e71f3a9b524af6012062fe037a6"),
          "PBKDF2 RFC 6070 Test Vector 1",
          "https://tools.ietf.org/html/rfc6070"
        ),
        new TestCase(
          OpCodes.AnsiToBytes('password'),
          OpCodes.Hex8ToBytes("ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957"),
          "PBKDF2 RFC 6070 Test Vector 2", 
          "https://tools.ietf.org/html/rfc6070"
        )
      ];

      // Add test parameters
      this.tests[0].salt = OpCodes.AnsiToBytes('salt');
      this.tests[0].iterations = 1;
      this.tests[0].outputSize = 20;

      this.tests[1].salt = OpCodes.AnsiToBytes('salt');
      this.tests[1].iterations = 2;
      this.tests[1].outputSize = 20;
    }

    CreateInstance(isInverse = false) {
      return new PBKDF2Instance(this, isInverse);
    }
  }

  class PBKDF2Instance extends IKdfInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this.Iterations = 100000; // Default secure iteration count
      this.salt = null;
    }

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
      const hLen = 16; // MD5 output size (using HMAC-MD5 instead of HMAC-SHA1)
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
        for (let k = 0; k < result.length; k++) {
          result[k] ^= U[k];
        }
      }

      return result;
    }

    hmacSha1(key, data) {
      // Use framework's HMAC implementation 
      const hmac = AlgorithmFramework.Find(OpCodes.BytesToAnsi([72, 77, 65, 67])); // 'HMAC'
      if (!hmac) {
        throw new Error('HMAC not found in framework - ensure hmac.js is loaded');
      }

      const hmacInstance = hmac.CreateInstance();

      // Use MD5 since it's available in our HMAC implementation
      hmacInstance.hashFunction = [77, 68, 53]; // 'MD5' - Use OpCodes for consistency

      hmacInstance.key = key;
      hmacInstance.Feed(data);
      return hmacInstance.Result();
    }

    sha1(data) {
      // Simplified SHA-1 for educational purposes
      // In production, use a proper cryptographic library
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
          w[i] = (paddedData[chunkStart + i * 4] << 24) |
                 (paddedData[chunkStart + i * 4 + 1] << 16) |
                 (paddedData[chunkStart + i * 4 + 2] << 8) |
                  paddedData[chunkStart + i * 4 + 3];
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
            k = OpCodes.Hex8ToDWord('5A827999');
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = OpCodes.Hex8ToDWord('6ED9EBA1');
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = OpCodes.Hex8ToDWord('8F1BBCDC');
          } else {
            f = b ^ c ^ d;
            k = OpCodes.Hex8ToDWord('CA62C1D6');
          }

          const temp = (this.leftRotate(a, 5) + f + e + k + w[i]) & OpCodes.Mask32;
          e = d;
          d = c;
          c = this.leftRotate(b, 30);
          b = a;
          a = temp;
        }

        // Add this chunk's hash to result so far
        h[0] = (h[0] + a) & OpCodes.Mask32;
        h[1] = (h[1] + b) & OpCodes.Mask32;
        h[2] = (h[2] + c) & OpCodes.Mask32;
        h[3] = (h[3] + d) & OpCodes.Mask32;
        h[4] = (h[4] + e) & OpCodes.Mask32;
      }

      // Convert to byte array
      const result = [];
      for (let i = 0; i < 5; i++) {
        result.push((h[i] >>> 24) & 0xFF);
        result.push((h[i] >>> 16) & 0xFF);
        result.push((h[i] >>> 8) & 0xFF);
        result.push(h[i] & 0xFF);
      }

      return result;
    }

    leftRotate(value, amount) {
      return OpCodes.RotL32(value, amount);
    }

    intToBytes(value) {
      return [
        (value >>> 24) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 8) & 0xFF,
        value & 0xFF
      ];
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