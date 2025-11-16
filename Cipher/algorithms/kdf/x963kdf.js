/*
 * ANSI X9.63 KDF Implementation
 * Educational implementation of ANSI X9.63-2001 Key Derivation Function
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

  // Load required hash functions
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha1.js');
      require('../hash/sha256.js');
      require('../hash/sha512.js');
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class X963KDFAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ANSI X9.63 KDF";
      this.description = "ANSI X9.63-2001 Key Derivation Function for elliptic curve cryptography. Industry-standard KDF used in ECDH key agreement, financial cryptography, and smart card applications. Based on hash function iteration with counter and optional shared information.";
      this.inventor = "ANSI X9F1 Cryptographic Tools Working Group";
      this.year = 2001;
      this.category = CategoryType.KDF;
      this.subCategory = "Hash-based KDF";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false; // SharedInfo is optional
      this.SupportedOutputSizes = [1, 8160]; // 1 to 255*hash_len bytes (255*64 for SHA-512)

      // X9.63 KDF constants
      this.DEFAULT_HASH = 'SHA256';
      this.DEFAULT_OUTPUT_LENGTH = 32;
      this.HASH_FUNCTIONS = {
        'SHA1': { size: 20, name: 'SHA-1' },
        'SHA224': { size: 28, name: 'SHA-224' },
        'SHA256': { size: 32, name: 'SHA-256' },
        'SHA384': { size: 48, name: 'SHA-384' },
        'SHA512': { size: 64, name: 'SHA-512' }
      };

      // Documentation and references
      this.documentation = [
        new LinkItem("ANSI X9.63-2001 - Public Key Cryptography for the Financial Services Industry", "https://webstore.ansi.org/standards/ascx9/ansix9632001r2017"),
        new LinkItem("SEC 1: Elliptic Curve Cryptography (Section 3.6.1)", "https://www.secg.org/sec1-v2.pdf"),
        new LinkItem("NIST SP 800-56A - Recommendation for Pair-Wise Key Establishment Schemes", "https://csrc.nist.gov/publications/detail/sp/800-56a/rev-3/final"),
        new LinkItem("ISO/IEC 18033-2 - Encryption Algorithms", "https://www.iso.org/standard/37971.html")
      ];

      this.references = [
        new LinkItem("OpenSSL X963 KDF Implementation", "https://github.com/openssl/openssl/blob/master/crypto/kdf/kdf_x963.c"),
        new LinkItem("Python cryptography.hazmat.primitives.kdf.x963kdf", "https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#x963kdf"),
        new LinkItem("Bouncy Castle X9.63 KDF", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/agreement/kdf/ECDHKEKGenerator.java")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak Hash Function",
          "SHA-1 is deprecated for security applications. Use SHA-256 or SHA-512 for new implementations."
        ),
        new Vulnerability(
          "Insufficient Shared Secret Length",
          "NIST SP 800-56A Rev 3 requires shared secrets to be at least 112 bits (14 bytes) for security."
        )
      ];

      // Test vectors from OpenSSL (NIST CAVP test suite)
      // https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("fd17198b89ab39c4ab5d7cca363b82f9fd7e23c3984dc8a2"),
          OpCodes.Hex8ToBytes("6e5fad865cb4a51c95209b16df0cc490bc2c9064405c5bccd4ee4832a531fbe7f10cb79e2eab6ab1149fbd5a23cfdabc41242269c9df22f628c4424333855b64e95e2d4fb8469c669f17176c07d103376b10b384ec5763d8b8c610409f19aca8eb31f9d85cc61a8d6d4a03d03e5a506b78d6847e93d295ee548c65afedd2efec"),
          "NIST CAVP X9.63 KDF Test #1 - SHA1 with SharedInfo",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("da67a73072d521a8272c69023573012ddf9b46bff65b3900"),
          OpCodes.Hex8ToBytes("dfc3126c5eebf9a58d89730e8d8ff7cc772592f28c10b349b437d9d068698a22e532eae975dfaf9c5c6a9f2935eafb05353013c253444e61f07bc9ddd15948e614bdc7e445ba3b1893f42f87f18fb352d49956009a642c362d45410b43a9ab376e9261210739174759511d1f9e52f6ec73dfed446dbafaf7fd1a57113abc2e8d"),
          "NIST CAVP X9.63 KDF Test #2 - SHA224 with SharedInfo",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("22518b10e70f2a3f243810ae3254139efbee04aa57c7af7d"),
          OpCodes.Hex8ToBytes("c498af77161cc59f2962b9a713e2b215152d139766ce34a776df11866a69bf2e52a13d9c7c6fc878c50c5ea0bc7b00e0da2447cfd874f6cf92f30d0097111485500c90c3af8b487872d04685d14c8d1dc8d7fa08beb0ce0ababc11f0bd496269142d43525a78e5bc79a17f59676a5706dc54d54d4d1f0bd7e386128ec26afc21"),
          "NIST CAVP X9.63 KDF Test #3 - SHA256 with SharedInfo",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("d8554db1b392cd55c3fe957bed76af09c13ac2a9392f88f6"),
          OpCodes.Hex8ToBytes("671a46aada145162f8ddf1ca586a1cda"),
          "NIST CAVP X9.63 KDF Test #4 - SHA384 without SharedInfo",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("c051fd22539c9de791d6c43a854b8f80a6bf70190050854a"),
          OpCodes.Hex8ToBytes("cf6a84434734ac6949e1d7976743277be789906908ad3ca3a8923da7f476abbeb574306d7243031a85566914bfd247d2519c479953d9d55b6b831e56260806c39af21b74e3ecf470e3bd8332791c8a23c13352514fdef00c2d1a408ba31b2d3f9fdcb373895484649a645d1845eec91b5bfdc5ad28c7824984482002dd4a8677"),
          "NIST CAVP X9.63 KDF Test #5 - SHA384 with SharedInfo",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("87fc0d8c4477485bb574f5fcea264b30885dc8d90ad82782"),
          OpCodes.Hex8ToBytes("947665fbb9152153ef460238506a0245"),
          "NIST CAVP X9.63 KDF Test #6 - SHA512 without SharedInfo",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("00aa5bb79b33e389fa58ceadc047197f14e73712f452caa9fc4c9adb369348b81507392f1a86ddfdb7c4ff8231c4bd0f44e44a1b55b1404747a9e2e753f55ef05a2d"),
          OpCodes.Hex8ToBytes("4463f869f3cc18769b52264b0112b5858f7ad32a5a2d96d8cffabf7fa733633d6e4dd2a599acceb3ea54a6217ce0b50eef4f6b40a5c30250a5a8eeee208002267089dbf351f3f5022aa9638bf1ee419dea9c4ff745a25ac27bda33ca08bd56dd1a59b4106cf2dbbc0ab2aa8e2efa7b17902d34276951ceccab87f9661c3e8816"),
          "NIST CAVP X9.63 KDF Test #7 - SHA512 with SharedInfo (longer input)",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip"
        )
      ];

      // Add test parameters for each test vector
      // Test 0: SHA1 with SharedInfo
      this.tests[0].sharedInfo = OpCodes.Hex8ToBytes("856a53f3e36a26bbc5792879f307cce2");
      this.tests[0].outputSize = 128;
      this.tests[0].hashFunction = 'SHA1';

      // Test 1: SHA224 with SharedInfo
      this.tests[1].sharedInfo = OpCodes.Hex8ToBytes("727997aed53e78f74b1d66743a4ea4d2");
      this.tests[1].outputSize = 128;
      this.tests[1].hashFunction = 'SHA224';

      // Test 2: SHA256 with SharedInfo
      this.tests[2].sharedInfo = OpCodes.Hex8ToBytes("75eef81aa3041e33b80971203d2c0c52");
      this.tests[2].outputSize = 128;
      this.tests[2].hashFunction = 'SHA256';

      // Test 3: SHA384 without SharedInfo
      this.tests[3].sharedInfo = [];
      this.tests[3].outputSize = 16;
      this.tests[3].hashFunction = 'SHA384';

      // Test 4: SHA384 with SharedInfo
      this.tests[4].sharedInfo = OpCodes.Hex8ToBytes("1317504aa34759bb4c931e3b78201945");
      this.tests[4].outputSize = 128;
      this.tests[4].hashFunction = 'SHA384';

      // Test 5: SHA512 without SharedInfo
      this.tests[5].sharedInfo = [];
      this.tests[5].outputSize = 16;
      this.tests[5].hashFunction = 'SHA512';

      // Test 6: SHA512 with SharedInfo
      this.tests[6].sharedInfo = OpCodes.Hex8ToBytes("e3b5b4c1b0d5cf1d2b3a2f9937895d31");
      this.tests[6].outputSize = 128;
      this.tests[6].hashFunction = 'SHA512';
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new X963KDFInstance(this, isInverse);
    }
  }

  /**
 * X963KDF cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class X963KDFInstance extends IKdfInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default 256-bit output
      this._sharedInfo = [];
      this._hashFunction = 'SHA256';
    }

    // Property getters and setters
    get sharedInfo() { return this._sharedInfo; }
    set sharedInfo(value) { this._sharedInfo = value || []; }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; }

    get hashFunction() { return this._hashFunction; }
    set hashFunction(value) { this._hashFunction = value; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('X963KDFInstance.Feed: Input must be byte array (shared secret)');
      }

      if (this.isInverse) {
        throw new Error('X963KDFInstance.Feed: X9.63 KDF cannot be reversed (one-way function)');
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
      // X9.63 KDF can work with pre-set parameters or fed data
      if (!this.sharedSecret && !this._inputData) {
        throw new Error('X963KDFInstance.Result: Shared secret required - use Feed() method or set sharedSecret directly');
      }

      const sharedSecret = this.sharedSecret || this._inputData;
      const sharedInfo = this._sharedInfo || [];
      const outputSize = this.OutputSize || 32;
      const hashFunc = this._hashFunction || 'SHA256';

      return this.deriveKey(sharedSecret, sharedInfo, outputSize, hashFunc);
    }

    deriveKey(sharedSecret, sharedInfo, outputLength, hashFunction) {
      // ANSI X9.63 KDF Algorithm:
      // 1. counter = 1 (32-bit big-endian)
      // 2. output = []
      // 3. while output_length < length:
      //    output += H(shared_secret || counter || sharedinfo)
      //    counter += 1
      // 4. return output[0:length]

      const hashName = Array.isArray(hashFunction)
        ? String.fromCharCode(...hashFunction)
        : hashFunction;

      const hashInfo = this.algorithm.HASH_FUNCTIONS[hashName];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashName);
      }

      const hashLen = hashInfo.size;
      const numBlocks = Math.ceil(outputLength / hashLen);

      // Check output length constraint (max 255 iterations)
      if (numBlocks > 255) {
        throw new Error('Output length too large for X9.63 KDF (max ' + (255 * hashLen) + ' bytes for ' + hashName + ')');
      }

      // Get hash algorithm from framework
      const hashAlg = AlgorithmFramework.Find(hashInfo.name);
      if (!hashAlg) {
        throw new Error('Hash function not found: ' + hashInfo.name);
      }

      let output = [];

      // Generate each block
      for (let counter = 1; counter <= numBlocks; counter++) {
        // Create block input: shared_secret || counter (32-bit big-endian) || sharedInfo
        const blockInput = [...sharedSecret];

        // Append counter as 32-bit big-endian using OpCodes
        const counterBytes = OpCodes.Unpack32BE(counter);
        blockInput.push(...counterBytes);

        // Append sharedInfo if present
        if (sharedInfo && sharedInfo.length > 0) {
          blockInput.push(...sharedInfo);
        }

        // Hash the block input
        const hashInst = hashAlg.CreateInstance();
        hashInst.Feed(blockInput);
        const blockHash = hashInst.Result();

        output = output.concat(blockHash);
      }

      // Truncate to desired length
      return output.slice(0, outputLength);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new X963KDFAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { X963KDFAlgorithm, X963KDFInstance };
}));
