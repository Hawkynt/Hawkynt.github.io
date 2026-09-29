/*
 * NIST SP 800-56A Rev. 3 Implementation
 * Single-Step Key Derivation Function
 * (c)2006-2025 Hawkynt
 *
 * Implements NIST SP 800-56A Rev. 3 Section 5.8.1 single-step KDF
 * using hash functions or HMAC for key derivation in key agreement schemes.
 *
 * Reference: NIST Special Publication 800-56A Revision 3
 * https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf
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
      require('../hash/sha1.js');
      require('../hash/sha256.js');
      require('../hash/sha512.js');
    } catch (e) {
      // Hash functions may already be loaded or unavailable
    }
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          KdfAlgorithm, IKdfInstance, IHashFunctionInstance, TestCase, LinkItem, Vulnerability,
          KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class SP80056AAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-56A";
      this.description = "NIST SP 800-56A Revision 3 single-step key derivation function for key agreement schemes. Uses concatenation format: counter || Z || FixedInfo with hash or HMAC-based derivation.";
      this.inventor = "National Institute of Standards and Technology (NIST)";
      this.year = 2018;
      this.category = CategoryType.KDF;
      this.subCategory = "Key Agreement KDF";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific properties
      this.SaltRequired = false; // Salt is optional
      this.SupportedOutputSizes = [new KeySize(1, 8191, 1)]; // Max ~2^32 * hash_len bits

      // Documentation and references
      this.documentation = [
        new LinkItem(
          "NIST SP 800-56A Rev. 3 - Recommendation for Pair-Wise Key-Establishment Schemes",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf"
        ),
        new LinkItem(
          "NIST SP 800-56C Rev. 2 - Recommendation for Key-Derivation Methods",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "Botan SP800-56A Implementation",
          "https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_56a/sp800_56c_one_step.cpp"
        ),
        new LinkItem(
          "OpenSSL KDF Implementation",
          "https://github.com/openssl/openssl/blob/master/crypto/kdf/kdf_sp800_56c.c"
        )
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak Hash Function",
          "Avoid SHA-1 for cryptographic security; use SHA-256 or stronger hash functions"
        ),
        new Vulnerability(
          "Insufficient Shared Secret Entropy",
          "Ensure shared secret Z has sufficient entropy from secure key agreement"
        )
      ];

      // Test vectors from Botan (official NIST CAVP vectors)
      // Source: https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec
      this.tests = [
        // SP800-56A(SHA-1) vectors
        new TestCase(
          OpCodes.Hex8ToBytes("51373E8B6FDEC284DB569204CA13D2CAA23BD1D85DCAB02A"),
          OpCodes.Hex8ToBytes("049B3766"),
          "SP800-56A SHA-1 Vector #1",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("B2F3A2D4FBB002D9F0B51258AF43E98A5423FB145257AE460342361C2199D380"),
          OpCodes.Hex8ToBytes("B7D5840565"),
          "SP800-56A SHA-1 Vector #2",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("7CE80E8B0480CDE01FEC587FE7045A8E"),
          OpCodes.Hex8ToBytes("176E355AAA4A2209A7CAD190D2C76B78B12CDF83ADD1387709C30750110E573021"),
          "SP800-56A SHA-1 Vector #3 - 33 byte output",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),

        // SP800-56A(SHA-224) vectors
        new TestCase(
          OpCodes.Hex8ToBytes("51373E8B6FDEC284DB569204CA13D2CAA23BD1D85DCAB02A"),
          OpCodes.Hex8ToBytes("E14BA657"),
          "SP800-56A SHA-224 Vector #1",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("B2F3A2D4FBB002D9F0B51258AF43E98A5423FB145257AE460342361C2199D380"),
          OpCodes.Hex8ToBytes("2C92BD1085"),
          "SP800-56A SHA-224 Vector #2",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),

        // SP800-56A(SHA-256) vectors
        new TestCase(
          OpCodes.Hex8ToBytes("51373E8B6FDEC284DB569204CA13D2CAA23BD1D85DCAB02A"),
          OpCodes.Hex8ToBytes("F62EBAB9"),
          "SP800-56A SHA-256 Vector #1",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("B2F3A2D4FBB002D9F0B51258AF43E98A5423FB145257AE460342361C2199D380"),
          OpCodes.Hex8ToBytes("39CB7A8753"),
          "SP800-56A SHA-256 Vector #2",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("BA68A99D6EB2AFFD8BD039AB13C3A3AA9F02C6C11FDE8570429D2FCE61D97D81C51CDBB8FF143D04"),
          OpCodes.Hex8ToBytes("F7632AE67C0B"),
          "SP800-56A SHA-256 Vector #3",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("DC5E08ED643FC5ACA38CDF756CA0D7D678F3B241FA61976EEB16A904FC83E0326E1CBD639A9591899ADF8DE1FC1B1B5D"),
          OpCodes.Hex8ToBytes("706F616063ADBA"),
          "SP800-56A SHA-256 Vector #4",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("2897B5B2F94BE3550BAC75877817A0F47836A57A5FF777345DAA6E5F0599D4AB8D4C59C62067AEDF00C02DDA77E4AF871CDA63FBDE164EDC"),
          OpCodes.Hex8ToBytes("35F489FC6A91BE16"),
          "SP800-56A SHA-256 Vector #5",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),

        // SP800-56A(SHA-384) vectors
        new TestCase(
          OpCodes.Hex8ToBytes("51373E8B6FDEC284DB569204CA13D2CAA23BD1D85DCAB02A"),
          OpCodes.Hex8ToBytes("894340AD"),
          "SP800-56A SHA-384 Vector #1",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("B2F3A2D4FBB002D9F0B51258AF43E98A5423FB145257AE460342361C2199D380"),
          OpCodes.Hex8ToBytes("C4159FBAEA"),
          "SP800-56A SHA-384 Vector #2",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),

        // SP800-56A(SHA-512) vectors
        new TestCase(
          OpCodes.Hex8ToBytes("51373E8B6FDEC284DB569204CA13D2CAA23BD1D85DCAB02A"),
          OpCodes.Hex8ToBytes("6F015EA0"),
          "SP800-56A SHA-512 Vector #1",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("B2F3A2D4FBB002D9F0B51258AF43E98A5423FB145257AE460342361C2199D380"),
          OpCodes.Hex8ToBytes("189C0F84B0"),
          "SP800-56A SHA-512 Vector #2",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("BA68A99D6EB2AFFD8BD039AB13C3A3AA9F02C6C11FDE8570429D2FCE61D97D81C51CDBB8FF143D04"),
          OpCodes.Hex8ToBytes("B7269E8FA844"),
          "SP800-56A SHA-512 Vector #3",
          "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec"
        )
      ];

      // Add test parameters for each test vector
      // SHA-1 vectors
      this.tests[0].salt = OpCodes.Hex8ToBytes('');
      this.tests[0].label = OpCodes.Hex8ToBytes("6C5544797A91115DC3330EBD003851D239A706FF2AA2AB70039C5510DDF06420");
      this.tests[0].hashFunction = 'SHA-1';
      this.tests[0].outputSize = 4;

      this.tests[1].salt = OpCodes.Hex8ToBytes('');
      this.tests[1].label = OpCodes.Hex8ToBytes("F9C06213585289654996F0C40467B9A69480AB8D5B16A08C7A0C5F1570F966EF");
      this.tests[1].hashFunction = 'SHA-1';
      this.tests[1].outputSize = 5;

      this.tests[2].salt = OpCodes.Hex8ToBytes('');
      this.tests[2].label = OpCodes.Hex8ToBytes("EA0E5D80A76BB5063148CC997B76DA2D895BC3E4DFF37C48579CC4E580F1FDA3");
      this.tests[2].hashFunction = 'SHA-1';
      this.tests[2].outputSize = 33;

      // SHA-224 vectors
      this.tests[3].salt = OpCodes.Hex8ToBytes('');
      this.tests[3].label = OpCodes.Hex8ToBytes("6C5544797A91115DC3330EBD003851D239A706FF2AA2AB70039C5510DDF06420");
      this.tests[3].hashFunction = 'SHA-224';
      this.tests[3].outputSize = 4;

      this.tests[4].salt = OpCodes.Hex8ToBytes('');
      this.tests[4].label = OpCodes.Hex8ToBytes("F9C06213585289654996F0C40467B9A69480AB8D5B16A08C7A0C5F1570F966EF");
      this.tests[4].hashFunction = 'SHA-224';
      this.tests[4].outputSize = 5;

      // SHA-256 vectors
      this.tests[5].salt = OpCodes.Hex8ToBytes('');
      this.tests[5].label = OpCodes.Hex8ToBytes("6C5544797A91115DC3330EBD003851D239A706FF2AA2AB70039C5510DDF06420");
      this.tests[5].hashFunction = 'SHA-256';
      this.tests[5].outputSize = 4;

      this.tests[6].salt = OpCodes.Hex8ToBytes('');
      this.tests[6].label = OpCodes.Hex8ToBytes("F9C06213585289654996F0C40467B9A69480AB8D5B16A08C7A0C5F1570F966EF");
      this.tests[6].hashFunction = 'SHA-256';
      this.tests[6].outputSize = 5;

      this.tests[7].salt = OpCodes.Hex8ToBytes('');
      this.tests[7].label = OpCodes.Hex8ToBytes("9D4169CC1427F2A407191B84AB7ABAACE66A95CA26AB0915803106315080F331");
      this.tests[7].hashFunction = 'SHA-256';
      this.tests[7].outputSize = 6;

      this.tests[8].salt = OpCodes.Hex8ToBytes('');
      this.tests[8].label = OpCodes.Hex8ToBytes("430312B971580AC2ABBE70998F136D3CACE833E0B165B74C351AFE5FA20D1EB7");
      this.tests[8].hashFunction = 'SHA-256';
      this.tests[8].outputSize = 7;

      this.tests[9].salt = OpCodes.Hex8ToBytes('');
      this.tests[9].label = OpCodes.Hex8ToBytes("EDEFB6C58327538F3B4F7E4B9AF30C7025122DE56B7E682E56D7EFE433C2CA85");
      this.tests[9].hashFunction = 'SHA-256';
      this.tests[9].outputSize = 8;

      // SHA-384 vectors
      this.tests[10].salt = OpCodes.Hex8ToBytes('');
      this.tests[10].label = OpCodes.Hex8ToBytes("6C5544797A91115DC3330EBD003851D239A706FF2AA2AB70039C5510DDF06420");
      this.tests[10].hashFunction = 'SHA-384';
      this.tests[10].outputSize = 4;

      this.tests[11].salt = OpCodes.Hex8ToBytes('');
      this.tests[11].label = OpCodes.Hex8ToBytes("F9C06213585289654996F0C40467B9A69480AB8D5B16A08C7A0C5F1570F966EF");
      this.tests[11].hashFunction = 'SHA-384';
      this.tests[11].outputSize = 5;

      // SHA-512 vectors
      this.tests[12].salt = OpCodes.Hex8ToBytes('');
      this.tests[12].label = OpCodes.Hex8ToBytes("6C5544797A91115DC3330EBD003851D239A706FF2AA2AB70039C5510DDF06420");
      this.tests[12].hashFunction = 'SHA-512';
      this.tests[12].outputSize = 4;

      this.tests[13].salt = OpCodes.Hex8ToBytes('');
      this.tests[13].label = OpCodes.Hex8ToBytes("F9C06213585289654996F0C40467B9A69480AB8D5B16A08C7A0C5F1570F966EF");
      this.tests[13].hashFunction = 'SHA-512';
      this.tests[13].outputSize = 5;

      this.tests[14].salt = OpCodes.Hex8ToBytes('');
      this.tests[14].label = OpCodes.Hex8ToBytes("9D4169CC1427F2A407191B84AB7ABAACE66A95CA26AB0915803106315080F331");
      this.tests[14].hashFunction = 'SHA-512';
      this.tests[14].outputSize = 6;
    }

    /**
   * Create new SP 800-56A KDF instance
   * @param {boolean} [isInverse=false] - Refused by Feed: the KDF has no inverse
   * @returns {SP80056AInstance} New instance
   */

    CreateInstance(isInverse = false) {
      return new SP80056AInstance(this, isInverse);
    }
  }

  /**
 * SP 800-56A one-step KDF instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class SP80056AInstance extends IKdfInstance {
    /**
   * Initialize an SP 800-56A KDF instance
   * @param {SP80056AAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Refused by Feed: the KDF has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default output size
      /** @type {uint8[]} */
      this._salt = [];
      /** @type {uint8[]} */
      this._label = [];
      /** @type {string} */
      this._hashFunction = 'SHA-256';
      /** @type {uint8[]} Shared secret Z (null until the first Feed) */
      this._secret = null;
    }

    // Property getters and setters (copies in and out)
    /** @returns {uint8[]} Copy of the salt (HMAC key; empty selects the plain hash) */
    get salt() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._salt) { copy = this._salt.slice(); }
      return copy;
    }
    /** @param {uint8[]} value - Salt (null clears it) */
    set salt(value) {
      if (value) { this._salt = value.slice(); } else { this._salt = []; }
    }

    /** @returns {uint8[]} Copy of the FixedInfo */
    get label() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._label) { copy = this._label.slice(); }
      return copy;
    }
    /** @param {uint8[]} value - FixedInfo (null clears it) */
    set label(value) {
      if (value) { this._label = value.slice(); } else { this._label = []; }
    }

    /** @returns {int32} Output size in bytes */
    get outputSize() { return this.OutputSize; }
    /** @param {int32} value - Output size in bytes */
    set outputSize(value) { this.OutputSize = value; }

    /** @returns {string} Hash name: SHA-1, SHA-224, SHA-256, SHA-384 or SHA-512 */
    get hashFunction() { return this._hashFunction; }
    /** @param {string} value - Hash name: SHA-1, SHA-224, SHA-256, SHA-384 or SHA-512 */
    set hashFunction(value) { this._hashFunction = value; }

    /**
   * Feed shared secret Z
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the input is not an array or the instance is inverse
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SP80056AInstance.Feed: Input must be byte array (shared secret Z)');
      }

      if (this.isInverse) {
        throw new Error('SP80056AInstance.Feed: KDF cannot be reversed (one-way function)');
      }

      // Store shared secret Z for Result() method
      // Feed is a streaming interface: successive calls extend the input rather
      // than replace it, so Feed(a); Feed(b) derives from the same octet string
      // as Feed(a || b).
      if (!this._secret) this._secret = [];
      for (let i = 0; i < data.length; i++) this._secret.push(data[i]);
    }

    /**
   * Derive the key
   * @returns {uint8[]} Derived key bytes
   * @throws {Error} If nothing was fed or the hash is unsupported
   */

    Result() {
      if (!this._secret) {
        throw new Error('SP80056AInstance.Result: Shared secret Z required - use Feed() method');
      }

      const secret = this._secret;
      /** @type {uint8[]} */
      let salt = [];
      if (this._salt) { salt = this._salt; }
      /** @type {uint8[]} */
      let label = [];
      if (this._label) { label = this._label; }
      const outputSize = this.OutputSize;
      const hashFunc = this._hashFunction;

      return this.deriveKey(secret, salt, label, outputSize, hashFunc);
    }

    /**
     * Digest length of a supported hash
     * @param {string} hashName - SHA-1, SHA-224, SHA-256, SHA-384 or SHA-512
     * @returns {int32} Digest size in bytes, 0 when unsupported
     */
    hashSize(hashName) {
      switch (hashName) {
        case 'SHA-1': return 20;
        case 'SHA-224': return 28;
        case 'SHA-256': return 32;
        case 'SHA-384': return 48;
        case 'SHA-512': return 64;
        default: return 0;
      }
    }

    /**
     * NIST SP 800-56A Rev. 3 section 5.8.1 one-step KDF: counter || Z || FixedInfo,
     * hashed, or HMAC'd with the salt as key when a salt is set
     * @param {uint8[]} secret - Shared secret Z
     * @param {uint8[]} salt - HMAC key (empty selects the plain hash)
     * @param {uint8[]} fixedInfo - FixedInfo
     * @param {int32} outputLength - Output length in bytes
     * @param {string} hashFunction - Hash name
     * @returns {uint8[]} Derived key
     * @throws {Error} If the hash is unsupported or unavailable
     */
    deriveKey(secret, salt, fixedInfo, outputLength, hashFunction) {
      const hashLen = this.hashSize(hashFunction);
      if (hashLen === 0) {
        throw new Error('Unsupported hash function: ' + hashFunction);
      }

      // Calculate number of iterations needed
      // reps = ceil(outputLength / hashLen)
      const reps = Math.ceil(outputLength / hashLen);

      // SP 800-56A limit: reps must not exceed 2^32 - 1
      if (reps > 0xFFFFFFFF) {
        throw new Error('SP800-56A KDF requested output too large');
      }

      // Get hash algorithm from framework (registered under the same name)
      const hashAlg = AlgorithmFramework.Find(hashFunction);
      if (!hashAlg) {
        throw new Error('Hash function not found: ' + hashFunction);
      }

      /** @type {uint8[]} */
      let result = [];

      // For HMAC mode (when salt is provided), use HMAC construction
      const useHmac = salt && salt.length > 0;

      // Iterate for each block
      for (let i = 1; i <= reps; i++) {
        // Prepare input: counter (32-bit BE) || Z || FixedInfo
        const counterBytes = OpCodes.Unpack32BE(i);

        const blockInput = counterBytes.concat(secret).concat(fixedInfo);

        /** @type {uint8[]} */
        let blockHash;
        if (useHmac) {
          // Use HMAC with salt as key
          blockHash = this.calculateHMAC(salt, blockInput, hashFunction);
        } else {
          // Use plain hash
          /** @type {IHashFunctionInstance} */
          const hashInst = hashAlg.CreateInstance();
          hashInst.Feed(blockInput);
          blockHash = hashInst.Result();
        }

        result = result.concat(blockHash);
      }

      // Truncate to desired output length
      return result.slice(0, outputLength);
    }

    /**
     * HMAC (RFC 2104) over a registered hash
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @param {string} hashFunction - Hash name
     * @returns {uint8[]} MAC
     * @throws {Error} If the hash is unsupported or unavailable
     */
    calculateHMAC(key, message, hashFunction) {
      if (this.hashSize(hashFunction) === 0) {
        throw new Error('Unsupported hash function: ' + hashFunction);
      }

      let blockSize = 64;
      if (hashFunction === 'SHA-384' || hashFunction === 'SHA-512') { blockSize = 128; }

      // Get hash algorithm from framework
      const hashAlg = AlgorithmFramework.Find(hashFunction);
      if (!hashAlg) {
        throw new Error('Hash function not found: ' + hashFunction);
      }

      // Prepare key - pad or hash if needed
      let keyPrime = key.slice();
      if (keyPrime.length > blockSize) {
        // If key is longer than block size, hash it first
        /** @type {IHashFunctionInstance} */
        const hashInst = hashAlg.CreateInstance();
        hashInst.Feed(keyPrime);
        /** @type {uint8[]} */
        const hashedKey = hashInst.Result();
        keyPrime = hashedKey;
      }

      // Pad key to block size
      while (keyPrime.length < blockSize) {
        keyPrime.push(0);
      }

      // HMAC constants
      /** @type {uint8[]} */
      const ipad = [];
      /** @type {uint8[]} */
      const opad = [];
      for (let i = 0; i < blockSize; i++) {
        ipad.push(0x36);
        opad.push(0x5c);
      }

      // Inner hash: H((K' XOR ipad) || message)
      const innerKey = OpCodes.XorArrays(keyPrime, ipad);
      const innerInput = innerKey.concat(message);
      /** @type {IHashFunctionInstance} */
      const innerHashInst = hashAlg.CreateInstance();
      innerHashInst.Feed(innerInput);
      /** @type {uint8[]} */
      const innerHash = innerHashInst.Result();

      // Outer hash: H((K' XOR opad) || innerHash)
      const outerKey = OpCodes.XorArrays(keyPrime, opad);
      const outerInput = outerKey.concat(innerHash);
      /** @type {IHashFunctionInstance} */
      const outerHashInst = hashAlg.CreateInstance();
      outerHashInst.Feed(outerInput);
      /** @type {uint8[]} */
      const result = outerHashInst.Result();

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SP80056AAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SP80056AAlgorithm, SP80056AInstance };
}));
