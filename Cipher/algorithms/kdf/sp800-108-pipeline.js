/*
 * NIST SP 800-108 KDF in Pipeline Mode Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements Key-Based Key Derivation Function (KBKDF) in Pipeline Mode
 * as defined in NIST Special Publication 800-108
 * Reference: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          KdfAlgorithm, IKdfInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class SP800108PipelineAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-108-Pipeline";
      this.description = "NIST SP 800-108 Key Derivation Function in Pipeline Mode. Uses HMAC with pipelined PRF expansion where each iteration computes an intermediate value, following the NIST standardized specification.";
      this.inventor = "NIST";
      this.year = 2009;
      this.category = CategoryType.KDF;
      this.subCategory = "NIST SP 800-108 Pipeline Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific configuration
      this.SupportedKeyDerivationSizes = [
        new KeySize(1, 65535, 1)  // Variable output size (1 byte to 64KB)
      ];
      this.NeedsKey = true;  // Requires input key material (KI)

      // Documentation links
      this.documentation = [
        new LinkItem(
          "NIST SP 800-108 Revision 1 - Recommendation for Key Derivation Using Pseudorandom Functions",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf"
        ),
        new LinkItem(
          "RFC 6803 - KBKDF with HMAC",
          "https://tools.ietf.org/rfc/rfc6803.txt"
        ),
        new LinkItem(
          "OpenSSL EVP_KDF-KB Documentation",
          "https://www.openssl.org/docs/manmaster/man7/EVP_KDF-KB.html"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "Botan SP800_108_Pipeline Implementation",
          "https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp"
        ),
        new LinkItem(
          "BouncyCastle KBKDF Pipeline",
          "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/generators/KDFCounterBytesGenerator.java"
        ),
        new LinkItem(
          "rust-kbkdf Implementation",
          "https://github.com/RustCrypto/KDFs"
        )
      ];

      // Official test vectors from Botan (BouncyCastle reference + rust-kbkdf interop)
      this.tests = [
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 1 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("63CB90F9CD34B95007277AE6FC17FB45A9248725"),
          label: OpCodes.Hex8ToBytes("FD7DBFDD60FED4CADA6DB78A"),
          context: OpCodes.Hex8ToBytes("B65A30885B0849C7099B"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("4B0D")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 2 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("954418FCD0EA5B6800D99B5502AFC98FF7E9302D"),
          label: OpCodes.Hex8ToBytes("F441EBB9D176AFC02CA826C6"),
          context: OpCodes.Hex8ToBytes("644E398DF79D9477A706"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("17F5")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 3 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("486DEE7BF8590AD8146F4419131A8ED35FB67407"),
          label: OpCodes.Hex8ToBytes("1E1A50A04838FD3D15DE70ED"),
          context: OpCodes.Hex8ToBytes("6303AD8D6F85B06A8133"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("096F")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1, 20 bytes (exactly one PRF block)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("E46A6B8AA59E92E64F066319962564F87AFF921A"),
          label: OpCodes.Hex8ToBytes("2894F522FC3244125E79FDA2"),
          context: OpCodes.Hex8ToBytes("E97FF4ECBE1AF9B60F178B36C82A9DA13ECE72B4EAA7CBE6DAE081B51B6E5A0776DDD88252CD2EE81503A10D2679D97B3A647D885BDF529F22DC8DB7FCFD013F7A11A4FEB91A6F1611262BB4EE0F17C526CD606B2EB6BC2FCEF15E1D585CCBAE5807285A"),
          outputLength: 20,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("9334C17D345653ED331E714A17184AC75D9B9908")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA256, 36 bytes (one group past the first block)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("5f55c3256b553dc14191bb6bf7a2683d5fb23175674a989f4039979b88afb41a"),
          label: OpCodes.Hex8ToBytes("ba99b90163142fa41257855bf43d865d"),
          context: OpCodes.Hex8ToBytes("06849bae8a99c78d89ca12ec321c74b0f14282ea26f120e837374138aada472cd397f163ec138b36a3a0501ffecccd3a"),
          outputLength: 36,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("c526b989ccc815bfaabe89f9a88b1ff9786b95d09ca03fd9235df54edf89ac7b95d4e0ae")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA256, 48 bytes (two PRF blocks)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("5b5a55801cbf928335b51b03fa90e663d8f15ec10d1ff37e13d4cae60cc7c4c9"),
          label: OpCodes.Hex8ToBytes("76088a05cc92d29510c998144c95b9bc"),
          context: OpCodes.Hex8ToBytes("d8037597ab1b305806983009732e64ac9ed3a3bdbc6208d6439b2b57138585fb408619fd882e1253b81055d4025d7831087f68442d0d88b3b428b5b0b04abb54"),
          outputLength: 48,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("f255ffa7fb16595048ea36da923c358db664f6ff3f36f76203de596f352f1feb87084379051f511dd2a58bfaa5ec7ac8")
        }
      ];
    }

    /**
   * Create new SP 800-108 pipeline-mode KDF instance
   * @param {boolean} [isInverse=false] - True returns null: the KDF has no inverse
   * @returns {SP800108PipelineInstance} New instance, or null for isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null;  // KDF cannot be reversed
      }
      return new SP800108PipelineInstance(this);
    }
  }

  // Instance class - handles the actual KDF computation
  /**
 * SP 800-108 pipeline-mode KDF instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class SP800108PipelineInstance extends IKdfInstance {
    /**
     * Initialize an SP 800-108 pipeline-mode KDF instance
     * @param {SP800108PipelineAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} Input key material KI (null until fed or set) */
      this._keyInput = null;
      /** @type {uint8[]} Label (null means empty) */
      this._label = null;
      /** @type {uint8[]} Context (null means empty) */
      this._context = null;
      /** @type {int32} */
      this._counterBits = 32;  // Default counter bits (8, 16, 24, or 32)
      /** @type {int32} */
      this._outputLengthBits = 32;  // Default output length field bits (8, 16, 24, or 32)
      /** @type {int32} */
      this._outputLength = 32;  // Default output length
      /** @type {string} */
      this._hashAlgorithm = 'SHA-256';  // Default hash function for HMAC
    }

    // Property accessors for input key material (KI) - matches test vector 'input' field
    /** @returns {uint8[]} Copy of the input key material, or null */
    get input() {
      if (this._keyInput) { return this._keyInput.slice(); }
      return null;
    }

    /**
     * @param {uint8[]} value - Input key material (copied)
     * @throws {Error} If it is not a byte array
     */
    set input(value) {
      if (!value || !Array.isArray(value)) {
        throw new Error("Key input must be a byte array");
      }
      this._keyInput = value.slice();
    }

    // Alias for compatibility
    /** @returns {uint8[]} Copy of the input key material, or null */
    get keyInput() {
      if (this._keyInput) { return this._keyInput.slice(); }
      return null;
    }

    /**
     * @param {uint8[]} value - Input key material (copied)
     * @throws {Error} If it is not a byte array
     */
    set keyInput(value) {
      this.input = value;
    }

    // Label (optional fixed input data)
    /** @returns {uint8[]} Copy of the label */
    get label() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._label) { copy = this._label.slice(); }
      return copy;
    }

    /** @param {uint8[]} value - Label (copied; anything but an array clears it) */
    set label(value) {
      if (value && Array.isArray(value)) { this._label = value.slice(); } else { this._label = []; }
    }

    // Context (optional fixed input data)
    /** @returns {uint8[]} Copy of the context */
    get context() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._context) { copy = this._context.slice(); }
      return copy;
    }

    /** @param {uint8[]} value - Context (copied; anything but an array clears it) */
    set context(value) {
      if (value && Array.isArray(value)) { this._context = value.slice(); } else { this._context = []; }
    }

    // Counter bits (8, 16, 24, or 32)
    /** @returns {int32} Counter width in bits */
    get counterBits() {
      return this._counterBits;
    }

    /**
     * @param {int32} value - Counter width: 8, 16, 24 or 32
     * @throws {Error} For any other width
     */
    set counterBits(value) {
      if (value !== 8 && value !== 16 && value !== 24 && value !== 32) {
        throw new Error("Counter bits must be one of: 8, 16, 24, 32");
      }
      this._counterBits = value;
    }

    // Output length field bits (8, 16, 24, or 32)
    /** @returns {int32} Width of the [L] field in bits */
    get outputLengthBits() {
      return this._outputLengthBits;
    }

    /**
     * @param {int32} value - [L] field width: 8, 16, 24 or 32
     * @throws {Error} For any other width
     */
    set outputLengthBits(value) {
      if (value !== 8 && value !== 16 && value !== 24 && value !== 32) {
        throw new Error("Output length bits must be one of: 8, 16, 24, 32");
      }
      this._outputLengthBits = value;
    }

    // Output length in bytes
    /** @returns {int32} Output length in bytes */
    get outputLength() {
      return this._outputLength;
    }

    /**
     * @param {int32} value - Output length, 1..65535
     * @throws {Error} If it is not an integer in range
     */
    set outputLength(value) {
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error("Output length must be between 1 and 65535 bytes");
      }
      this._outputLength = value;
    }

    // Hash algorithm used for HMAC (SHA-256, SHA-512, etc.)
    /** @returns {string} Hash name (upper case) */
    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    /**
     * @param {string} value - SHA-1, SHA-256 or SHA-512 (any case, dash optional)
     * @throws {Error} If it is not a non-empty string
     */
    set hashAlgorithm(value) {
      if (!value || typeof value !== 'string') {
        throw new Error("Hash algorithm must be a valid string");
      }
      this._hashAlgorithm = value.toUpperCase();
    }

    // Main derivation method
    // For KDFs, Feed() is used to provide the input key material
    /**
   * Feed input key material (anything but an array is ignored)
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (data && Array.isArray(data)) {
        // Feed is a streaming interface: successive calls extend the input rather
        // than replace it, so Feed(a); Feed(b) derives from the same octet string
        // as Feed(a || b).
        if (!this._keyInput) this._keyInput = [];
        for (let i = 0; i < data.length; i++) this._keyInput.push(data[i]);
      }
    }

    /**
   * Derive the key
   * @returns {uint8[]} Derived key bytes
   * @throws {Error} If no key material was given, or the hash is unsupported or unavailable
   */

    Result() {
      if (!this._keyInput || this._keyInput.length === 0) {
        throw new Error("Key input not set");
      }

      if (this._outputLength < 1) {
        throw new Error("Output length must be at least 1 byte");
      }

      // Reject an unsupported hash before deriving anything
      this._checkHashAlgorithm();

      /** @type {uint8[]} */
      const output = [];
      const counterBytes = this._counterBits / 8;
      const outputBits = this._outputLength * 8;
      const outputLengthFieldBytes = this._outputLengthBits / 8;

      // Calculate number of HMAC iterations needed
      const hmacOutputBytes = this._getHMACOutputSize();
      const blocksNeeded = Math.ceil(this._outputLength / hmacOutputBytes);

      // SP 800-108 Pipeline Mode KDF
      // A(0) = HMAC(K_I, Label || 0x00 || Context || [L]_L_r)
      // A(i) = HMAC(K_I, A(i-1))
      // K_i = HMAC(K_I, A(i) || [i]_r || Label || 0x00 || Context || [L]_L_r)
      const constantInput = this._constantInput(outputBits, outputLengthFieldBytes);

      // Compute A(0) = HMAC(K_I, Label || 0x00 || Context || [L]_L_r)
      let aPrev = this._hmacSelected(this._keyInput, constantInput);

      // Each block: A(i) = HMAC(K_I, A(i-1))
      //             K_i = HMAC(K_I, A(i) || [i]_r || Label || 0x00 || Context || [L]_L_r)
      for (let i = 1; i <= blocksNeeded; i++) {
        // Compute A(i) = HMAC(K_I, A(i-1)) for i > 0
        if (i > 1) {
          aPrev = this._hmacSelected(this._keyInput, aPrev);
        }

        // Compute K_i = HMAC(K_I, A(i) || [i]_r || Label || 0x00 || Context || [L]_L_r)
        /** @type {uint8[]} */
        const blockInput = [];

        // Add A(i)
        for (let _i = 0; _i < aPrev.length; _i++) blockInput.push(aPrev[_i]);

        // Add counter [i]_r (r bits, encoded in big-endian)
        const counterBytes_i = this._encodeCounter(i, counterBytes);
        for (let _i = 0; _i < counterBytes_i.length; _i++) blockInput.push(counterBytes_i[_i]);

        // Add constant input (Label || 0x00 || Context || [L]_L_r)
        for (let _i = 0; _i < constantInput.length; _i++) blockInput.push(constantInput[_i]);

        // Compute HMAC(K_I, block_input)
        const blockOutput = this._hmacSelected(this._keyInput, blockInput);
        for (let _i = 0; _i < blockOutput.length; _i++) output.push(blockOutput[_i]);
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
    }

    /**
     * The constant input Label || 0x00 || Context || [L]_L_r
     * @param {int32} outputBits - L, the output length in bits
     * @param {int32} outputLengthFieldBytes - Width of the [L] field in bytes
     * @returns {uint8[]} Constant input
     */
    _constantInput(outputBits, outputLengthFieldBytes) {
      /** @type {uint8[]} */
      const constantInput = [];

      // Add label
      if (this._label && this._label.length > 0) {
        for (let _i = 0; _i < this._label.length; _i++) constantInput.push(this._label[_i]);
      }

      // Add fixed separator (0x00)
      constantInput.push(0x00);

      // Add context
      if (this._context && this._context.length > 0) {
        for (let _i = 0; _i < this._context.length; _i++) constantInput.push(this._context[_i]);
      }

      // Add output length in bits [L]_L_r (L_r bits, big-endian)
      const outputLengthBytes = this._encodeCounter(outputBits, outputLengthFieldBytes);
      for (let _i = 0; _i < outputLengthBytes.length; _i++) constantInput.push(outputLengthBytes[_i]);

      return constantInput;
    }

    /**
     * Encode counter as big-endian bytes
     * @param {int32} counter - Counter value
     * @param {int32} numBytes - Counter width in bytes
     * @returns {uint8[]} Encoded counter
     */
    _encodeCounter(counter, numBytes) {
      /** @type {uint8[]} */
      const result = [];
      for (let i = numBytes - 1; i >= 0; i--) {
        result.push(OpCodes.ToByte(OpCodes.Shr32(counter, i * 8)));
      }
      return result;
    }

    /**
     * Reject a hash algorithm this KDF has no HMAC for
     * @returns {void}
     * @throws {Error} Unless the hash is SHA-1, SHA-256 or SHA-512
     */
    _checkHashAlgorithm() {
      const hashAlgo = this._hashAlgorithm.toUpperCase();
      if (hashAlgo !== 'SHA-256' && hashAlgo !== 'SHA256' && hashAlgo !== 'SHA-512' && hashAlgo !== 'SHA512' &&
          hashAlgo !== 'SHA-1' && hashAlgo !== 'SHA1') {
        throw new Error('Unsupported hash algorithm: ' + this._hashAlgorithm);
      }
    }

    /**
     * HMAC with the selected hash
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @returns {uint8[]} MAC
     * @throws {Error} If the hash is unsupported or unavailable
     */
    _hmacSelected(key, message) {
      const hashAlgo = this._hashAlgorithm.toUpperCase();

      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') {
        return this._hmacSHA256(key, message);
      } else if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') {
        return this._hmacSHA512(key, message);
      } else if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') {
        return this._hmacSHA1(key, message);
      } else {
        throw new Error('Unsupported hash algorithm: ' + this._hashAlgorithm);
      }
    }

    /**
     * Get HMAC output size for the selected hash
     * @returns {int32} Output size in bytes
     */
    _getHMACOutputSize() {
      const hashAlgo = this._hashAlgorithm.toUpperCase();
      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') return 32;
      if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') return 64;
      if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') return 20;
      return 32;  // Default to SHA-256 output size
    }

    /**
     * HMAC-SHA256
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @returns {uint8[]} MAC
     */
    _hmacSHA256(key, message) {
      return this._hmacCompute(key, message, 'SHA-256', 32);
    }

    /**
     * HMAC-SHA512
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @returns {uint8[]} MAC
     */
    _hmacSHA512(key, message) {
      return this._hmacCompute(key, message, 'SHA-512', 64);
    }

    /**
     * HMAC-SHA1
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @returns {uint8[]} MAC
     */
    _hmacSHA1(key, message) {
      return this._hmacCompute(key, message, 'SHA-1', 20);
    }

    /**
     * Generic HMAC computation: Node crypto under CommonJS; elsewhere there is
     * no synchronous HMAC, so this throws
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512
     * @param {int32} hashOutputSize - MAC length in bytes (informational)
     * @returns {uint8[]} MAC
     * @throws {Error} Outside Node
     */
    _hmacCompute(key, message, hashName, hashOutputSize) {
      // Use Node.js crypto if available
      if (typeof module !== 'undefined' && typeof require !== 'undefined') {
        const crypto = require('crypto');
        const hmac = crypto.createHmac(
          hashName.replace('-', '').toLowerCase(),
          Buffer.from(key)
        );
        hmac.update(Buffer.from(message));
        return Array.from(hmac.digest());
      }

      // Web Crypto (browser) is async and cannot serve this synchronous KDF
      if (typeof require === 'undefined' && typeof crypto !== 'undefined' && crypto.subtle) {
        return this._hmacWebCrypto(key, message, hashName);
      }

      throw new Error(
        'Cannot compute HMAC: No crypto library available (requires Node.js crypto or Web Crypto API)'
      );
    }

    /**
     * HMAC computation using Web Crypto API: it is async and a KDF must be
     * synchronous, so this always throws
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @param {string} hashName - Hash name
     * @returns {uint8[]} Never returns
     * @throws {Error} Always
     */
    _hmacWebCrypto(key, message, hashName) {
      throw new Error(
        'Web Crypto API is async. For SP800-108 Pipeline KDF in browser, ' +
        'use the async version or provide HMAC via OpCodes.'
      );
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP800108PipelineAlgorithm());

  return {
    SP800108PipelineAlgorithm,
    SP800108PipelineInstance
  };
}));
