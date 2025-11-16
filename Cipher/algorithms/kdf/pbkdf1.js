/*
 * PBKDF1 Implementation
 * Password-Based Key Derivation Function 1 (DEPRECATED - Use PBKDF2 instead)
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework and OpCodes (REQUIRED)

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
          KdfAlgorithm, IKdfInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class PBKDF1Algorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PBKDF1";
      this.description = "Password-Based Key Derivation Function 1 (PBKDF1) from PKCS #5 v2.0 (RFC 2898 / RFC 8018). Derives cryptographic keys from passwords using iterative hashing with MD5 or SHA-1. Limited to output size of hash function (16 bytes for MD5, 20 bytes for SHA-1). DEPRECATED - use PBKDF2 for new applications.";
      this.inventor = "RSA Laboratories";
      this.year = 2000;
      this.category = CategoryType.KDF;
      this.subCategory = "Password-Based Key Derivation";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = true;
      this.SupportedOutputSizes = [1, 20]; // Max 20 bytes (SHA-1 output size)

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 8018 - PKCS #5: Password-Based Cryptography", "https://tools.ietf.org/html/rfc8018"),
        new LinkItem("RFC 2898 - Original PKCS #5 v2.0 Specification", "https://tools.ietf.org/html/rfc2898"),
        new LinkItem("OpenSSL PBKDF1 Implementation", "https://github.com/openssl/openssl/blob/master/providers/implementations/kdfs/pbkdf1.c.in"),
        new LinkItem("Wikipedia - PBKDF2 (mentions PBKDF1)", "https://en.wikipedia.org/wiki/PBKDF2")
      ];

      this.references = [
        new LinkItem("NIST SP 800-132 - Recommendation for Password-Based Key Derivation", "https://csrc.nist.gov/publications/detail/sp/800-132/final"),
        new LinkItem("OWASP Password Storage Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "DEPRECATED Algorithm",
          "PBKDF1 is deprecated. Use PBKDF2, scrypt, or Argon2 for new applications"
        ),
        new Vulnerability(
          "Limited Output Size",
          "Output limited to hash digest size (16 bytes for MD5, 20 bytes for SHA-1)"
        ),
        new Vulnerability(
          "Weak Hash Functions",
          "Only supports MD5 and SHA-1, both cryptographically weak. MD5 is broken, SHA-1 deprecated"
        ),
        new Vulnerability(
          "Insufficient Iteration Count",
          "Modern attacks require much higher iteration counts (100,000+ for PBKDF2)"
        )
      ];

      // Official test vectors from OpenSSL 3.0 (evpkdf_pbkdf1.txt)
      // Source: https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt
      this.tests = [
        {
          text: "OpenSSL Test Vector: password/saltsalt, 1 iteration, SHA-1",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 1,
          outputSize: 16,
          hashFunction: 'SHA-1',
          expected: OpCodes.Hex8ToBytes("CAB86DD6261710891E8CB56EE3625691")
        },
        {
          text: "OpenSSL Test Vector: password/saltsalt, 2 iterations, SHA-1",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 2,
          outputSize: 16,
          hashFunction: 'SHA-1',
          expected: OpCodes.Hex8ToBytes("E3A8DFCF2EEA6DC81D2AD154274FAAE9")
        },
        {
          text: "OpenSSL Test Vector: password/saltsalt, 4096 iterations, SHA-1",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 4096,
          outputSize: 16,
          hashFunction: 'SHA-1',
          expected: OpCodes.Hex8ToBytes("3CB0C21E81127F5BFF2EEA2B5DC3F31D")
        },
        {
          text: "OpenSSL Test Vector: passwordPASSWORDpassword/saltSALT, 65537 iterations, SHA-1",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('passwordPASSWORDpassword'),
          salt: OpCodes.AnsiToBytes('saltSALT'),
          iterations: 65537,
          outputSize: 16,
          hashFunction: 'SHA-1',
          expected: OpCodes.Hex8ToBytes("B2B4635718AAAD9FEF23FE328EB83ECF")
        },
        {
          text: "OpenSSL Test Vector: empty password/saltsalt, 1 iteration, SHA-1",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes(''),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 1,
          outputSize: 16,
          hashFunction: 'SHA-1',
          expected: OpCodes.Hex8ToBytes("2C2ABACE4BD8BB19F67113DA146DBB8C")
        },
        {
          text: "OpenSSL Test Vector: password/saltsalt, 1 iteration, MD5",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 1,
          outputSize: 16,
          hashFunction: 'MD5',
          expected: OpCodes.Hex8ToBytes("FDBDF3419FFF98BDB0241390F62A9DB3")
        },
        {
          text: "OpenSSL Test Vector: password/saltsalt, 2 iterations, MD5",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 2,
          outputSize: 16,
          hashFunction: 'MD5',
          expected: OpCodes.Hex8ToBytes("3D4A8D4FB4C6E8686B21D36142902966")
        },
        {
          text: "OpenSSL Test Vector: password/saltsalt, 4096 iterations, MD5",
          uri: "https://github.com/openssl/openssl/blob/master/test/recipes/30-test_evp_data/evpkdf_pbkdf1.txt",
          input: OpCodes.AnsiToBytes('password'),
          salt: OpCodes.AnsiToBytes('saltsalt'),
          iterations: 4096,
          outputSize: 16,
          hashFunction: 'MD5',
          expected: OpCodes.Hex8ToBytes("3283ED8F8D037045157DA055BFF84A02")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PBKDF1Instance(this, isInverse);
    }
  }

  /**
 * PBKDF1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PBKDF1Instance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 16; // Default 128-bit output
      this.Iterations = 1000; // Default iteration count
      this.salt = null;
      this.hashFunction = 'SHA-1'; // Default hash function
      this._inputData = null;
      this.password = null;
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
        throw new Error('PBKDF1Instance.Feed: Input must be byte array (password)');
      }

      if (this.isInverse) {
        throw new Error('PBKDF1Instance.Feed: PBKDF1 cannot be reversed (one-way function)');
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
      // PBKDF1 can work with pre-set parameters or fed data
      if (!this.password && !this._inputData) {
        throw new Error('PBKDF1Instance.Result: Password required - use Feed() method or set password directly');
      }

      if (!this.salt || this.salt.length === 0) {
        throw new Error('PBKDF1Instance.Result: Salt required - set salt property');
      }

      const pwd = this.password || this._inputData;
      const slt = this.salt;
      const iter = this.Iterations || 1;
      const outSize = this.OutputSize || 16;
      const hashFunc = this.hashFunction || 'SHA-1';

      // Validate output size based on hash function
      const maxOutputSize = this.getHashOutputSize(hashFunc);
      if (outSize > maxOutputSize) {
        throw new Error(`PBKDF1Instance.Result: Output size ${outSize} exceeds maximum ${maxOutputSize} for ${hashFunc}`);
      }

      return this.deriveKey(pwd, slt, iter, outSize, hashFunc);
    }

    getHashOutputSize(hashFunction) {
      switch (hashFunction.toUpperCase()) {
        case 'MD5':
          return 16;
        case 'SHA-1':
        case 'SHA1':
          return 20;
        default:
          throw new Error(`PBKDF1Instance.getHashOutputSize: Unsupported hash function ${hashFunction}. PBKDF1 only supports MD5 and SHA-1`);
      }
    }

    deriveKey(password, salt, iterations, outputSize, hashFunction) {
      // PBKDF1 Algorithm from RFC 8018 Section 5.1:
      // https://tools.ietf.org/html/rfc8018#page-10
      //
      // T_1 = Hash(password || salt)
      // T_i = Hash(T_{i-1}) for i = 2, 3, ..., c
      // DK = T_c<0..dkLen-1>
      //
      // Where:
      // - Hash is MD5 or SHA-1
      // - c is iteration count
      // - dkLen is desired key length (limited to hash output size)

      // T_1 = Hash(password || salt)
      let T = this.hash([...password, ...salt], hashFunction);

      // T_2 through T_c: repeatedly hash the previous result
      for (let i = 2; i <= iterations; i++) {
        T = this.hash(T, hashFunction);
      }

      // Return first dkLen bytes
      return T.slice(0, outputSize);
    }

    hash(data, hashFunction) {
      const hashName = hashFunction.toUpperCase().replace('-', '');

      // Try to use framework hash algorithm first
      const hashAlg = AlgorithmFramework.Find(hashFunction) || AlgorithmFramework.Find(hashName);
      if (hashAlg) {
        const hashInstance = hashAlg.CreateInstance();
        hashInstance.Feed(data);
        return hashInstance.Result();
      }

      // If hash not available, try to load it dynamically
      try {
        if (typeof require !== 'undefined') {
          // Try to load hash algorithm
          const hashFile = hashFunction.toLowerCase().replace('-', '');
          require('../hash/' + hashFile + '.js');
          const hashAlgNow = AlgorithmFramework.Find(hashFunction) || AlgorithmFramework.Find(hashName);
          if (hashAlgNow) {
            const hashInstance = hashAlgNow.CreateInstance();
            hashInstance.Feed(data);
            return hashInstance.Result();
          }
        }
      } catch (e) {
        // Ignore loading errors and fall back
      }

      // Self-contained implementations for MD5 and SHA-1 as last resort
      if (hashFunction.toUpperCase() === 'MD5') {
        return this.md5(data);
      } else if (hashFunction.toUpperCase() === 'SHA-1' || hashFunction.toUpperCase() === 'SHA1') {
        return this.sha1(data);
      }

      throw new Error(`PBKDF1Instance.hash: Hash function ${hashFunction} not available. PBKDF1 only supports MD5 and SHA-1`);
    }

    // Self-contained MD5 implementation
    md5(data) {
      // MD5 implementation using OpCodes
      const MASK32 = 0xFFFFFFFF;

      // MD5 initial hash values
      const h = OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476');

      // MD5 per-round shift amounts
      const s = [
        7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
        5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
        4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
        6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
      ];

      // MD5 constants (K table) - floor(2^32 * abs(sin(i+1))) for i = 0 to 63
      const K = OpCodes.Hex32ToDWords(
        'd76aa478e8c7b756242070dbc1bdceee' +
        'f57c0faf4787c62aa8304613fd469501' +
        '698098d88b44f7afffff5bb1895cd7be' +
        '6b901122fd987193a679438e49b40821' +
        'f61e2562c040b340265e5a51e9b6c7aa' +
        'd62f105d02441453d8a1e681e7d3fbc8' +
        '21e1cde6c33707d6f4d50d87455a14ed' +
        'a9e3e905fcefa3f8676f02d98d2a4c8a' +
        'fffa39428771f6816d9d6122fde5380c' +
        'a4beea444bdecfa9f6bb4b60bebfbc70' +
        '289b7ec6eaa127fad4ef308504881d05' +
        'd9d4d039e6db99e51fa27cf8c4ac5665' +
        'f4292244432aff97ab9423a7fc93a039' +
        '655b59c38f0ccc92ffeff47d85845dd1' +
        '6fa87e4ffe2ce6e0a30143144e0811a1' +
        'f7537e82bd3af2352ad7d2bbeb86d391'
      );

      // Pre-processing: pad message
      const paddedData = [...data];
      const originalLength = data.length * 8;

      paddedData.push(0x80);
      while (paddedData.length % 64 !== 56) {
        paddedData.push(0);
      }

      // Append length as 64-bit little-endian
      // JavaScript bitwise ops are 32-bit, so handle low/high separately
      const lengthLow = originalLength & 0xFFFFFFFF;
      const lengthHigh = Math.floor(originalLength / 0x100000000);
      for (let i = 0; i < 4; i++) {
        paddedData.push((lengthLow >>> (i * 8)) & 0xFF);
      }
      for (let i = 0; i < 4; i++) {
        paddedData.push((lengthHigh >>> (i * 8)) & 0xFF);
      }

      // Process message in chunks of 64 bytes
      for (let chunkStart = 0; chunkStart < paddedData.length; chunkStart += 64) {
        const M = new Array(16);

        // Break chunk into sixteen 32-bit little-endian words
        for (let i = 0; i < 16; i++) {
          M[i] = OpCodes.Pack32LE(
            paddedData[chunkStart + i * 4],
            paddedData[chunkStart + i * 4 + 1],
            paddedData[chunkStart + i * 4 + 2],
            paddedData[chunkStart + i * 4 + 3]
          );
        }

        // Initialize hash value for this chunk
        let A = h[0], B = h[1], C = h[2], D = h[3];

        // Main loop
        for (let i = 0; i < 64; i++) {
          let F, g;
          if (i < 16) {
            F = (B & C) | (~B & D);
            g = i;
          } else if (i < 32) {
            F = (D & B) | (~D & C);
            g = (5 * i + 1) % 16;
          } else if (i < 48) {
            F = B ^ C ^ D;
            g = (3 * i + 5) % 16;
          } else {
            F = C ^ (B | ~D);
            g = (7 * i) % 16;
          }

          const temp = (A + F + K[i] + M[g]) & MASK32;
          A = D;
          D = C;
          C = B;
          B = (B + OpCodes.RotL32(temp, s[i])) & MASK32;
        }

        // Add this chunk's hash to result so far
        h[0] = (h[0] + A) & MASK32;
        h[1] = (h[1] + B) & MASK32;
        h[2] = (h[2] + C) & MASK32;
        h[3] = (h[3] + D) & MASK32;
      }

      // Convert to byte array (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(h[i]);
        result.push(...bytes);
      }

      return result;
    }

    // Self-contained SHA-1 implementation
    sha1(data) {
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
          w[i] = OpCodes.RotL32(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
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

          const temp = (OpCodes.RotL32(a, 5) + f + e + k + w[i]) & MASK32;
          e = d;
          d = c;
          c = OpCodes.RotL32(b, 30);
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

      // Convert to byte array (big-endian)
      const result = [];
      for (let i = 0; i < 5; i++) {
        const bytes = OpCodes.Unpack32BE(h[i]);
        result.push(...bytes);
      }

      return result;
    }

    // Configuration methods
    setSalt(salt) {
      this.salt = Array.isArray(salt) ? salt : OpCodes.AnsiToBytes(salt);
    }

    setIterations(iterations) {
      if (iterations < 1000) {
        console.warn('PBKDF1: Low iteration count may be insecure. PBKDF1 is deprecated - use PBKDF2 instead');
      }
      this.Iterations = iterations;
    }

    setOutputSize(size) {
      const maxSize = this.getHashOutputSize(this.hashFunction);
      if (size > maxSize) {
        throw new Error(`PBKDF1.setOutputSize: Size ${size} exceeds maximum ${maxSize} for ${this.hashFunction}`);
      }
      this.OutputSize = size;
    }

    setHashFunction(hashFunc) {
      const supported = ['MD5', 'SHA-1', 'SHA1'];
      const normalized = hashFunc.toUpperCase().replace('-', '');
      if (!supported.includes(hashFunc.toUpperCase()) && !supported.includes(normalized)) {
        throw new Error(`PBKDF1.setHashFunction: ${hashFunc} not supported. Only MD5 and SHA-1 allowed`);
      }
      this.hashFunction = hashFunc;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new PBKDF1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PBKDF1Algorithm, PBKDF1Instance };
}));
