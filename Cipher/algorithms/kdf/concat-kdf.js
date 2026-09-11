/*
 * Concatenation KDF (NIST SP 800-56A/C) Implementation
 * Production-grade implementation of NIST-recommended KDF for key agreement protocols
 * (c)2006-2025 Hawkynt
 */

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

  // Load required hash functions
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha256.js');
      require('../hash/sha512.js');
      require('../hash/sha1.js');
    } catch (e) {
      // Hash functions may already be loaded or unavailable
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

  // ===== CONCATKDF HASH IMPLEMENTATION =====

  class ConcatKDFHashAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Concat KDF (Hash)";
      this.description = "NIST SP 800-56A/C Concatenation Key Derivation Function using hash functions. Official NIST-recommended KDF for key agreement protocols like ECDH. Single-step KDF that concatenates counter, shared secret, and context information.";
      this.inventor = "NIST";
      this.year = 2007;
      this.category = CategoryType.KDF;
      this.subCategory = "Single-Step KDF";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false; // Concat KDF uses otherinfo, not salt
      this.SupportedOutputSizes = [new KeySize(1, 65535, 1)]; // Flexible output size

      // Hash function configuration
      this.HASH_FUNCTIONS = {
        'SHA-1': { size: 20, name: 'SHA-1', blockSize: 64 },
        'SHA-256': { size: 32, name: 'SHA-256', blockSize: 64 },
        'SHA-512': { size: 64, name: 'SHA-512', blockSize: 128 }
      };

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST SP 800-56A Rev. 3 - Key Agreement Schemes", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf"),
        new LinkItem("NIST SP 800-56C Rev. 2 - Key Derivation", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf"),
        new LinkItem("Python cryptography - ConcatKDFHash", "https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#cryptography.hazmat.primitives.kdf.concatkdf.ConcatKDFHash")
      ];

      this.references = [
        new LinkItem("pyca/cryptography - concatkdf.py", "https://github.com/pyca/cryptography/blob/main/src/cryptography/hazmat/primitives/kdf/concatkdf.py"),
        new LinkItem("OpenSSL EVP_KDF-X963", "https://www.openssl.org/docs/man3.0/man7/EVP_KDF-X963.html"),
        new LinkItem("ANSI X9.63 KDF (Related Standard)", "https://webstore.ansi.org/standards/ascx9/ansix9632011r2017")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak Hash Function",
          "Use SHA-256 or SHA-512 instead of SHA-1 for modern security requirements"
        ),
        new Vulnerability(
          "Insufficient Shared Secret Entropy",
          "Ensure shared secret from key agreement has sufficient entropy for cryptographic security"
        ),
        new Vulnerability(
          "Missing Context Information",
          "Include appropriate context in otherinfo parameter to bind derived key to specific usage"
        )
      ];

      // Official test vectors from pyca/cryptography library
      // Source: https://github.com/pyca/cryptography/blob/main/tests/hazmat/primitives/test_concatkdf.py
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("52169af5c485dcc2321eb8d26d5efa21fb9b93c98e38412ee2484cf14f0d0d23"),
          OpCodes.Hex8ToBytes("1c3bc9e7c4547c5191c0d478cccaed55"),
          "ConcatKDFHash SHA-256 Test Vector",
          "https://github.com/pyca/cryptography/blob/main/tests/hazmat/primitives/test_concatkdf.py"
        ),
        // The Concatenation KDF is the NIST SP 800-56A single-step KDF, so Botan's
        // sp800_56a.vec applies verbatim. These two sit either side of the hash block
        // boundary: 33 bytes needs a second digest, 48 bytes needs two full ones.
        new TestCase(
          OpCodes.Hex8ToBytes("7CE80E8B0480CDE01FEC587FE7045A8E"),
          OpCodes.Hex8ToBytes("9E04DDBA94C2C36F8E9B1B6F9B0F4D70A20CF1122DD94AB5724D192ED1939D924D"),
          "NIST SP 800-56A single-step KDF, SHA-256, 33 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("8D1C9B4D7CC7F6122CB68E43B146BD32DE9F5E09143118B29DB51705F25D6C81890132F81DF3DC53A7950D0803107306289FA88E907C2E53EC13ECA20F972B38B84C5C1847F0BCB2EE4A9B64EB48348B73256E61CE2A2CFCDB71F7DB70BFFCC101F8A7F1FEE5F9D377E81FF9EC79B7FB25C849D7B9DD125107717EC8FD93105762B1AC629FF6DF99"),
          OpCodes.Hex8ToBytes("95352C138EB9B23735BD68CB242889970846DCCBD9775BCAD068528E8008A3BAF1ED2047525EAA29C99CD6E0E634EB30"),
          "NIST SP 800-56A single-step KDF, SHA-256, 48 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        )
      ];

      // Add test parameters
      this.tests[0].otherinfo = OpCodes.Hex8ToBytes("a1b2c3d4e53728157e634612c12d6d5223e204aeea4341565369647bd184bcd246f72971f292badaa2fe4124612cba");
      this.tests[0].outputSize = 16;
      this.tests[0].hashFunction = 'SHA-256';

      this.tests[1].otherinfo = OpCodes.Hex8ToBytes("EA0E5D80A76BB5063148CC997B76DA2D895BC3E4DFF37C48579CC4E580F1FDA3");
      this.tests[1].outputSize = 33;
      this.tests[1].hashFunction = 'SHA-256';

      this.tests[2].otherinfo = OpCodes.Hex8ToBytes("2D14C1C1989469A6676196410B62AF1A98D05DE226B22213FA731A814ADE2F5C");
      this.tests[2].outputSize = 48;
      this.tests[2].hashFunction = 'SHA-256';
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // KDF cannot be reversed (one-way function)
      }
      return new ConcatKDFHashInstance(this, isInverse);
    }
  }

  /**
 * ConcatKDFHash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ConcatKDFHashInstance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this._otherinfo = [];
      this._hashFunction = 'SHA-256';
      this._inputData = null;
    }

    // Property getters and setters
    get otherinfo() { return this._otherinfo; }
    set otherinfo(value) {
      if (value === null || value === undefined) {
        this._otherinfo = [];
      } else if (Array.isArray(value)) {
        this._otherinfo = value;
      } else {
        throw new Error('ConcatKDFHashInstance: otherinfo must be byte array');
      }
    }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) {
      if (typeof value !== 'number' || value < 1) {
        throw new Error('ConcatKDFHashInstance: outputSize must be positive integer');
      }
      this.OutputSize = value;
    }

    get hashFunction() { return this._hashFunction; }
    set hashFunction(value) {
      this._hashFunction = value;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ConcatKDFHashInstance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('ConcatKDFHashInstance.Feed: Concat KDF cannot be reversed (one-way function)');
      }

      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._inputData) this._inputData = [];
      for (let i = 0; i < data.length; i++) this._inputData.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._inputData) {
        throw new Error('ConcatKDFHashInstance.Result: No data fed - use Feed() method with shared secret');
      }

      const sharedSecret = this._inputData;
      const otherinfo = this._otherinfo || [];
      const outputSize = this.OutputSize || 32;
      const hashFunc = this._hashFunction || 'SHA-256';

      return this.deriveKey(sharedSecret, otherinfo, outputSize, hashFunc);
    }

    deriveKey(sharedSecret, otherinfo, outputLength, hashFunction) {
      // NIST SP 800-56C Single-Step KDF with Concatenation
      // KDF(Z, OtherInfo) = H(counter || Z || OtherInfo) for each counter

      const hashName = Array.isArray(hashFunction) ? String.fromCharCode(...hashFunction) : hashFunction;
      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('ConcatKDFHashInstance: Unsupported hash function: ' + hashName);
      }

      // Get hash algorithm from framework
      const hashAlg = AlgorithmFramework.Find(hashInfo.name);
      if (!hashAlg) {
        throw new Error('ConcatKDFHashInstance: Hash function not found: ' + hashInfo.name);
      }

      const hashLen = hashInfo.size;
      const numBlocks = Math.ceil(outputLength / hashLen);

      // NIST SP 800-56C: Check max output length
      // max_H_outputBits = (2^32 - 1) * hashLen
      const maxOutput = hashLen * 0xFFFFFFFF;
      if (outputLength > maxOutput) {
        throw new Error('ConcatKDFHashInstance: Output length too large for hash function');
      }

      let output = [];
      let counter = 1;

      // Generate derived key material
      // For each block: KM_i = H(counter || Z || OtherInfo)
      for (let i = 0; i < numBlocks; i++) {
        // Pack counter as 32-bit big-endian (4 bytes)
        const counterBytes = OpCodes.Unpack32BE(counter);

        // Concatenate: counter || sharedSecret || otherinfo
        const hashInput = counterBytes.concat(sharedSecret).concat(otherinfo);

        // Hash the concatenated input
        const hashInst = hashAlg.CreateInstance();
        hashInst.Feed(hashInput);
        const hashResult = hashInst.Result();

        // Append to output
        output = output.concat(hashResult);

        counter++;
      }

      // Truncate to desired output length
      return output.slice(0, outputLength);
    }
  }

  // ===== CONCATKDF HMAC IMPLEMENTATION =====

  class ConcatKDFHMACAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Concat KDF (HMAC)";
      this.description = "NIST SP 800-56A/C Concatenation Key Derivation Function using HMAC. HMAC-based variant of the single-step KDF for enhanced security in key agreement protocols. Uses salt parameter for additional randomization.";
      this.inventor = "NIST";
      this.year = 2007;
      this.category = CategoryType.KDF;
      this.subCategory = "Single-Step KDF";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false; // Salt is optional (defaults to zeros)
      this.SupportedOutputSizes = [new KeySize(1, 65535, 1)];

      // Hash function configuration
      this.HASH_FUNCTIONS = {
        'SHA-1': { size: 20, name: 'SHA-1', blockSize: 64 },
        'SHA-256': { size: 32, name: 'SHA-256', blockSize: 64 },
        'SHA-512': { size: 64, name: 'SHA-512', blockSize: 128 }
      };

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST SP 800-56A Rev. 3 - Key Agreement Schemes", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf"),
        new LinkItem("NIST SP 800-56C Rev. 2 - Key Derivation", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf"),
        new LinkItem("Python cryptography - ConcatKDFHMAC", "https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#cryptography.hazmat.primitives.kdf.concatkdf.ConcatKDFHMAC")
      ];

      this.references = [
        new LinkItem("pyca/cryptography - concatkdf.py", "https://github.com/pyca/cryptography/blob/main/src/cryptography/hazmat/primitives/kdf/concatkdf.py"),
        new LinkItem("RFC 2104 - HMAC", "https://tools.ietf.org/html/rfc2104")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak Hash Function",
          "Use SHA-256 or SHA-512 instead of SHA-1 for modern security requirements"
        ),
        new Vulnerability(
          "Predictable Salt",
          "Use random salt when possible instead of default zero-filled salt"
        )
      ];

      // Official test vectors from pyca/cryptography library
      // Source: https://github.com/pyca/cryptography/blob/main/tests/hazmat/primitives/test_concatkdf.py
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("013951627c1dea63ea2d7702dd24e963eef5faac6b4af7e4b831cde499dff1ce45f6179f741c728aa733583b024092088f0af7fce1d045edbc5790931e8d5ca79c73"),
          OpCodes.Hex8ToBytes("64ce901db10d558661f10b6836a122a7605323ce2f39bf27eaaac8b34cf89f2f"),
          "ConcatKDFHMAC SHA-512 Test Vector",
          "https://github.com/pyca/cryptography/blob/main/tests/hazmat/primitives/test_concatkdf.py"
        ),
        // HMAC form of the NIST SP 800-56A single-step KDF; the salt is the HMAC key.
        // 33 bytes stops one byte into the second block, 50 bytes stops short of it.
        new TestCase(
          OpCodes.Hex8ToBytes("E74EA408ACD848AB616E9891F35050533002C16915BCE2E84749E24FFBFB175D0AD4E8D10A093FAAACAF5A37F3985C538B38FD3765CC106D58147FB9F896758D"),
          OpCodes.Hex8ToBytes("2CAFCCDFE04660B80FDE08CFB5E80A7CEF9E0B4C5D0BC34551CCA98C4E85C9FC60"),
          "NIST SP 800-56A single-step KDF, HMAC-SHA-512, 33 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("3F4D4CA74C46AEA4FCBD8B5BB752A86D3651A82EFD76D17078FCEA9FF258264C0B65CB14637317F99B977B6E97F9298C686A7C983020F608D6F0D6D17950B339F522979D4C19547DD62B9BC20DA97A4B0A5D7C4F51EAC08BA978F0243AE92401B6EB4A83519431BDD7E9C3147FF2A76BFCF252BA13465C8467B1DC4F52C253B7AFFAB32D389CE01C801CC1662A9BD59CB710334676475EA2613D95F289F243D0D195A96B49F94E4B5380742B6496D8B7D062D6246BB616BA779F213FC1D87ACEB5B0E385A50565DB"),
          OpCodes.Hex8ToBytes("D105B8E5D103FA30A5666863FFCF335E1150722AE34FDDCB133395B94E4815F32E1A6B3E8D65166346667FAB04F9F43E92CB"),
          "NIST SP 800-56A single-step KDF, HMAC-SHA-512, 50 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        )
      ];

      // Add test parameters - default salt (128 bytes of zeros for SHA-512)
      this.tests[0].salt = new Array(128).fill(0);
      this.tests[0].otherinfo = OpCodes.Hex8ToBytes("a1b2c3d4e55e600be5f367e0e8a465f4bf2704db00c9325c9fbd216d12b49160b2ae5157650f43415653696421e68e");
      this.tests[0].outputSize = 32;
      this.tests[0].hashFunction = 'SHA-512';

      this.tests[1].salt = OpCodes.Hex8ToBytes("C767F6D57C1F68860197E6634B7D82C4");
      this.tests[1].otherinfo = OpCodes.Hex8ToBytes("5F5194B32F19C2800FBA4B056F2F55B7EB0687520D38ECB7D42951F8FFD769B7");
      this.tests[1].outputSize = 33;
      this.tests[1].hashFunction = 'SHA-512';

      this.tests[2].salt = OpCodes.Hex8ToBytes("C767F6D57C1F68860197E6634B7D82C4");
      this.tests[2].otherinfo = OpCodes.Hex8ToBytes("E0BC94FAC3F6B34EF8002F0EA7EC0B6AACD17FBDA64C92C34DD1E2703B6B3742");
      this.tests[2].outputSize = 50;
      this.tests[2].hashFunction = 'SHA-512';
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // KDF cannot be reversed (one-way function)
      }
      return new ConcatKDFHMACInstance(this, isInverse);
    }
  }

  /**
 * ConcatKDFHMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ConcatKDFHMACInstance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this._salt = null; // Will default to zeros of block size
      this._otherinfo = [];
      this._hashFunction = 'SHA-256';
      this._inputData = null;
    }

    // Property getters and setters
    get salt() { return this._salt; }
    set salt(value) {
      if (value === null || value === undefined) {
        this._salt = null;
      } else if (Array.isArray(value)) {
        this._salt = value;
      } else {
        throw new Error('ConcatKDFHMACInstance: salt must be byte array');
      }
    }

    get otherinfo() { return this._otherinfo; }
    set otherinfo(value) {
      if (value === null || value === undefined) {
        this._otherinfo = [];
      } else if (Array.isArray(value)) {
        this._otherinfo = value;
      } else {
        throw new Error('ConcatKDFHMACInstance: otherinfo must be byte array');
      }
    }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) {
      if (typeof value !== 'number' || value < 1) {
        throw new Error('ConcatKDFHMACInstance: outputSize must be positive integer');
      }
      this.OutputSize = value;
    }

    get hashFunction() { return this._hashFunction; }
    set hashFunction(value) {
      this._hashFunction = value;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ConcatKDFHMACInstance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('ConcatKDFHMACInstance.Feed: Concat KDF cannot be reversed (one-way function)');
      }

      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._inputData) this._inputData = [];
      for (let i = 0; i < data.length; i++) this._inputData.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._inputData) {
        throw new Error('ConcatKDFHMACInstance.Result: No data fed - use Feed() method with shared secret');
      }

      const sharedSecret = this._inputData;
      const salt = this._salt;
      const otherinfo = this._otherinfo || [];
      const outputSize = this.OutputSize || 32;
      const hashFunc = this._hashFunction || 'SHA-256';

      return this.deriveKey(sharedSecret, salt, otherinfo, outputSize, hashFunc);
    }

    deriveKey(sharedSecret, salt, otherinfo, outputLength, hashFunction) {
      // NIST SP 800-56C Single-Step KDF with HMAC
      // KDF(Z, OtherInfo) = HMAC(salt, counter || Z || OtherInfo) for each counter

      const hashName = Array.isArray(hashFunction) ? String.fromCharCode(...hashFunction) : hashFunction;
      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('ConcatKDFHMACInstance: Unsupported hash function: ' + hashName);
      }

      // Get hash algorithm from framework
      const hashAlg = AlgorithmFramework.Find(hashInfo.name);
      if (!hashAlg) {
        throw new Error('ConcatKDFHMACInstance: Hash function not found: ' + hashInfo.name);
      }

      const hashLen = hashInfo.size;
      const blockSize = hashInfo.blockSize;
      const numBlocks = Math.ceil(outputLength / hashLen);

      // NIST SP 800-56C: Check max output length
      const maxOutput = hashLen * 0xFFFFFFFF;
      if (outputLength > maxOutput) {
        throw new Error('ConcatKDFHMACInstance: Output length too large for hash function');
      }

      // Default salt: zeros of hash block size
      const actualSalt = salt || new Array(blockSize).fill(0);

      let output = [];
      let counter = 1;

      // Generate derived key material
      // For each block: KM_i = HMAC(salt, counter || Z || OtherInfo)
      for (let i = 0; i < numBlocks; i++) {
        // Pack counter as 32-bit big-endian (4 bytes)
        const counterBytes = OpCodes.Unpack32BE(counter);

        // Concatenate: counter || sharedSecret || otherinfo
        const hmacInput = counterBytes.concat(sharedSecret).concat(otherinfo);

        // Compute HMAC
        const hmacResult = this.calculateHMAC(actualSalt, hmacInput, hashAlg, blockSize);

        // Append to output
        output = output.concat(hmacResult);

        counter++;
      }

      // Truncate to desired output length
      return output.slice(0, outputLength);
    }

    calculateHMAC(key, message, hashAlg, blockSize) {
      // Standalone HMAC implementation (RFC 2104)
      // HMAC(K, m) = H((K' XOR opad) || H((K' XOR ipad) || m))

      // Prepare key - pad or hash if needed
      let keyPrime = [...key];
      if (keyPrime.length > blockSize) {
        // If key is longer than block size, hash it first
        const hashInst = hashAlg.CreateInstance();
        hashInst.Feed(keyPrime);
        keyPrime = hashInst.Result();
      }

      // Pad key to block size
      while (keyPrime.length < blockSize) {
        keyPrime.push(0);
      }

      // HMAC constants
      const ipad = 0x36;
      const opad = 0x5c;

      // Create constant arrays for XOR
      const ipadArray = new Array(blockSize).fill(ipad);
      const opadArray = new Array(blockSize).fill(opad);

      // Inner hash: H((K' XOR ipad) || message)
      const innerKey = OpCodes.XorArrays(keyPrime, ipadArray);
      const innerInput = innerKey.concat(message);
      const innerHashInst = hashAlg.CreateInstance();
      innerHashInst.Feed(innerInput);
      const innerHash = innerHashInst.Result();

      // Outer hash: H((K' XOR opad) || innerHash)
      const outerKey = OpCodes.XorArrays(keyPrime, opadArray);
      const outerInput = outerKey.concat(innerHash);
      const outerHashInst = hashAlg.CreateInstance();
      outerHashInst.Feed(outerInput);
      const result = outerHashInst.Result();

      return result;
    }
  }

  // ===== REGISTRATION =====

  const concatKdfHashInstance = new ConcatKDFHashAlgorithm();
  if (!AlgorithmFramework.Find(concatKdfHashInstance.name)) {
    RegisterAlgorithm(concatKdfHashInstance);
  }

  const concatKdfHmacInstance = new ConcatKDFHMACAlgorithm();
  if (!AlgorithmFramework.Find(concatKdfHmacInstance.name)) {
    RegisterAlgorithm(concatKdfHmacInstance);
  }

  // ===== EXPORTS =====

  return {
    ConcatKDFHashAlgorithm,
    ConcatKDFHashInstance,
    ConcatKDFHMACAlgorithm,
    ConcatKDFHMACInstance
  };
}));
