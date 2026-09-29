/*
 * NIST SP 800-108 KDF in Counter Mode Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements Key-Based Key Derivation Function (KBKDF) in Counter Mode
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

  class SP800108CounterAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-108-Counter";
      this.description = "NIST SP 800-108 Key Derivation Function in Counter Mode. Uses HMAC with counter-based PRF expansion for deriving cryptographic keys from input key material, following the NIST standardized specification.";
      this.inventor = "NIST";
      this.year = 2009;
      this.category = CategoryType.KDF;
      this.subCategory = "NIST SP 800-108 Counter Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific configuration
      this.SupportedKeyDerivationSizes = [
        new KeySize(16, 65535, 1)  // Variable output size (1 byte to 64KB)
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
          "Botan SP800_108_Counter Implementation",
          "https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp"
        ),
        new LinkItem(
          "PyCryptodome NIST SP 800-108 Test Vectors",
          "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/SelfTest/Protocol/test_KDF.py"
        ),
        new LinkItem(
          "OpenSSL KBKDF Implementation",
          "https://github.com/openssl/openssl/blob/master/crypto/kdf/kbkdf.c"
        )
      ];

      // Published test vectors, quoted verbatim from Botan's sp800_108_ctr.vec.
      // Botan names the SP 800-108 Context field "Salt", so Salt maps to context here.
      // Output lengths are chosen around the PRF block boundary: shorter than one
      // HMAC block, exactly one block, and spanning two blocks.
      this.tests = [
        {
          text: "SP800-108-Counter(HMAC(SHA-1)) - 20 bytes, exactly one PRF block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("17182760595F697F27E4E64A8E66102AC83A4B11"),
          label: OpCodes.Hex8ToBytes("EB5A279F6AC4522804FAF25E"),
          context: OpCodes.Hex8ToBytes("13E3EA2CF37566A55321C8E6386FAAC93421D614948EBF5BBA07649D77A27E161021346BAC19B3ADE49D4250DDEACAD90E3643389C320305541B5C3CCE41DEA5586CACEB3D43C43B256DA060CB3366108AB7895C7AFDA46C68C09D63D49E74AD74B05D94"),
          outputLength: 20,
          counterBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("AFA3F9DABB5BE44C4D25DD83EB1C0983D89961CA")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256)) - 12 bytes, truncated below one PRF block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("8a90e91cf6e25ae0f733a0eb186415af49cd7a0d78e1b6d01626b711aab4f12b"),
          label: OpCodes.Hex8ToBytes("036e2c420a6053e7441595745da71384"),
          context: OpCodes.Hex8ToBytes("7ca576af452eb08eccd0bf5a9ce6e5bd"),
          outputLength: 12,
          counterBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("69283d6572c9eba192b68279")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256)) - 36 bytes, one byte group past the first block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("304932533feea6cc93b9a5b01e362b416f6cf1c3eb8019191cd9f607814b6b71"),
          label: OpCodes.Hex8ToBytes("a16cc203753424e8b08633fe43d9b0c4"),
          context: OpCodes.Hex8ToBytes("54eeac24933ff6829bc37e7b1ed932b9f050899bb7d0c32615a708ee213d9085585fb010544fe4d29a8021b39fbb267d"),
          outputLength: 36,
          counterBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("719a8ae5eb4b1ac325d6e3598080e05cc15aede16f0547de0646e7639c1bf605ca557969")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256)) - 48 bytes, two PRF blocks",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("4b7ef2ca535af6b75b9cbf60a0d61a92af7edad9d568688fd9cde1c0c95f3e33"),
          label: OpCodes.Hex8ToBytes("be7baa20a4fd50eb81d30ce04aa8fbfb"),
          context: OpCodes.Hex8ToBytes("ec72d16625fa2404052a5cd44ea924e376b53ad759442803809bb2b09e1189d16950f654fccf806519aa7113c8a64a4a89f470d92a9b0477fe0b0b5549294060"),
          outputLength: 48,
          counterBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("caebdad694080005aff424e983bad862f4f7efec50102381cd25509fabc487a36509dabc6760088a7d33e7a37be94791")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-512)) - 20 bytes, heavy truncation of a 64 byte block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("BFFA0F4267D5F24F219151CB38C581C0D1CFF8EFE475D7C38A47726B226DF36E47E1A579993B4BEF9E3197330610ED57350BDE57EC6EDF231BCEFF1532017C0D"),
          label: OpCodes.Hex8ToBytes("196636113098B35C35406BB4"),
          context: OpCodes.Hex8ToBytes("17E42893512C6DF7747906508AD41396096A13B7D9AA87C4F7FABCBD9795165823A1B54819EB190691C96BAD55AD233A85F3C554C3E9B2D9B588A9F0DA09DF0D83D6141B83F5A62190FD16AA20B15552C3417C96B931E7EB55E06CD57406D5AB79FE12A7"),
          outputLength: 20,
          counterBits: 32,
          hashAlgorithm: "SHA-512",
          expected: OpCodes.Hex8ToBytes("40595AEEF8C541A9C453E27D38F6F04463331A8A")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256),8,32) - 8 bit counter, 24 bytes",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("b1fefddae964b5becda2ac39309eed39ba1fff819425ec48e0ce2efa5eee2e13"),
          label: OpCodes.Hex8ToBytes("d17a21b0e89b371149ee89d4c9239b8a"),
          context: OpCodes.Hex8ToBytes("6baf3ba16f03e5b10fe439a307b16f208ab54cb1a2a564d40644f27ad298f515"),
          outputLength: 24,
          counterBits: 8,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("ba1dea3338a92eeeb3ae0046ac214ba56beb939b7054efe3")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256),16,32) - 16 bit counter, 36 bytes over two blocks",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("c342730ce2412fcdeb94cdf6b9f23d656f44c9cd0acfa9c6ca6904aaafe19d2a"),
          label: OpCodes.Hex8ToBytes("2523abf2d9bd9ee7e06faf7c62999705"),
          context: OpCodes.Hex8ToBytes("6bf53bfb235ae2edce466761860f7470b5fae6d51cd7ce250f984062994dfdf5fead470abb43fe434817564c5dee6f30"),
          outputLength: 36,
          counterBits: 16,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("99cbbccf79545b8a341637395b0349955077ef3b3901e06f6507962b4f08b8d5154b03ad")
        }
      ];
    }

    /**
   * Create new SP 800-108 counter-mode KDF instance
   * @param {boolean} [isInverse=false] - True returns null: the KDF has no inverse
   * @returns {SP800108CounterInstance} New instance, or null for isInverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null;  // KDF cannot be reversed
      }
      return new SP800108CounterInstance(this);
    }
  }

  // Instance class - handles the actual KDF computation
  /**
 * SP 800-108 counter-mode KDF instance implementing the Feed/Result pattern
 * @class
 * @extends {IKdfInstance}
 */

  class SP800108CounterInstance extends IKdfInstance {
    /**
     * Initialize an SP 800-108 counter-mode KDF instance
     * @param {SP800108CounterAlgorithm} algorithm - Parent algorithm instance
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

      // Calculate number of HMAC iterations needed
      const hmacOutputBytes = this._getHMACOutputSize();
      const blocksNeeded = Math.ceil(this._outputLength / hmacOutputBytes);

      // SP 800-108 Counter Mode KDF
      // Each block: HMAC(K_I, [i]_r || Label || 0x00 || Context || [L]_32)
      for (let i = 1; i <= blocksNeeded; i++) {
        /** @type {uint8[]} */
        const blockInput = [];

        // Add counter [i]_r (r bits, encoded in big-endian)
        const counterBytes_i = this._encodeCounter(i, counterBytes);
        for (let _i = 0; _i < counterBytes_i.length; _i++) blockInput.push(counterBytes_i[_i]);

        // Add label
        if (this._label && this._label.length > 0) {
          for (let _i = 0; _i < this._label.length; _i++) blockInput.push(this._label[_i]);
        }

        // Add fixed separator (0x00)
        blockInput.push(0x00);

        // Add context
        if (this._context && this._context.length > 0) {
          for (let _i = 0; _i < this._context.length; _i++) blockInput.push(this._context[_i]);
        }

        // Add output length in bits [L]_32 (always 32 bits, big-endian)
        blockInput.push(OpCodes.ToByte(OpCodes.Shr32(outputBits, 24)));
        blockInput.push(OpCodes.ToByte(OpCodes.Shr32(outputBits, 16)));
        blockInput.push(OpCodes.ToByte(OpCodes.Shr32(outputBits, 8)));
        blockInput.push(OpCodes.ToByte(outputBits));

        // Compute HMAC(K_I, block_input)
        const blockOutput = this._hmacSelected(this._keyInput, blockInput);
        for (let _i = 0; _i < blockOutput.length; _i++) output.push(blockOutput[_i]);
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
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
     * Generic HMAC computation: Node crypto under CommonJS, else a registered
     * HMAC-<hash> algorithm, else the built-in HMAC-SHA256
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512
     * @param {int32} hashOutputSize - MAC length in bytes (informational)
     * @returns {uint8[]} MAC
     * @throws {Error} If no implementation is available
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

      // Try using AlgorithmFramework HMAC implementation
      const hmacResult = this._hmacWithFramework(key, message, hashName);
      if (hmacResult) {
        return hmacResult;
      }

      // Fallback: use built-in pure JavaScript implementation
      if (hashName === 'SHA-256' || hashName === 'SHA256') {
        return this._hmacSha256Pure(key, message);
      }

      throw new Error(
        'Cannot compute HMAC: No crypto library available for ' + hashName + '. Ensure HMAC algorithms are loaded before SP800-108-Counter.'
      );
    }

    /**
     * HMAC computation using a registered HMAC-<hash> algorithm
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @param {string} hashName - SHA-1, SHA-256 or SHA-512 (dash optional)
     * @returns {uint8[]} MAC, or null when no such algorithm is registered
     */
    _hmacWithFramework(key, message, hashName) {
      // Map hash names to HMAC algorithm names in the framework
      let hmacAlgoName = '';
      if (hashName === 'SHA-1' || hashName === 'SHA1') { hmacAlgoName = 'HMAC-SHA-1'; }
      if (hashName === 'SHA-256' || hashName === 'SHA256') { hmacAlgoName = 'HMAC-SHA-256'; }
      if (hashName === 'SHA-512' || hashName === 'SHA512') { hmacAlgoName = 'HMAC-SHA-512'; }
      if (!hmacAlgoName) {
        return null;
      }

      // Try to find the HMAC algorithm in the framework
      const hmacAlgo = AlgorithmFramework.Find(hmacAlgoName);
      if (hmacAlgo) {
        /** @type {IMacInstance} */
        const instance = hmacAlgo.CreateInstance(false);
        if (instance) {
          instance.key = key;
          instance.Feed(message);
          /** @type {uint8[]} */
          const mac = instance.Result();
          return mac;
        }
      }

      return null;
    }

    /**
     * Pure JavaScript HMAC-SHA256 (fallback when no crypto is available).
     * Pads (and, for a long key, hashes) the key array in place.
     * @param {uint8[]} key - HMAC key
     * @param {uint8[]} message - Message
     * @returns {uint8[]} 32-byte MAC
     */
    _hmacSha256Pure(key, message) {
      const BLOCK_SIZE = 64;

      let keyArr = key;
      const msgArr = message;

      // If key is longer than block size, hash it
      if (keyArr.length > BLOCK_SIZE) {
        keyArr = this._sha256Pure(keyArr);
      }

      // Pad key to block size
      while (keyArr.length < BLOCK_SIZE) {
        keyArr.push(0);
      }

      // Create inner and outer padding
      /** @type {uint8[]} */
      const ipad = keyArr.map(b => OpCodes.Xor32(b, 0x36));
      /** @type {uint8[]} */
      const opad = keyArr.map(b => OpCodes.Xor32(b, 0x5c));

      // Inner hash: SHA256(ipad || message)
      const innerInput = ipad.concat(msgArr);
      const innerHash = this._sha256Pure(innerInput);

      // Outer hash: SHA256(opad || inner_hash)
      const outerInput = opad.concat(innerHash);
      return this._sha256Pure(outerInput);
    }

    /**
     * Pure JavaScript SHA-256 (pads the message array in place)
     * @param {uint8[]} message - Message
     * @returns {uint8[]} 32-byte digest
     */
    _sha256Pure(message) {
      // SHA-256 constants
      const K = OpCodes.Hex32ToDWords(
        '428a2f9871374491b5c0fbcfe9b5dba53956c25b59f111f1923f82a4ab1c5ed5' +
        'd807aa9812835b01243185be550c7dc372be5d7480deb1fe9bdc06a7c19bf174' +
        'e49b69c1efbe47860fc19dc6240ca1cc2de92c6f4a7484aa5cb0a9dc76f988da' +
        '983e5152a831c66db00327c8bf597fc7c6e00bf3d5a7914706ca635114292967' +
        '27b70a852e1b21384d2c6dfc53380d13650a7354766a0abb81c2c92e92722c85' +
        'a2bfe8a1a81a664bc24b8b70c76c51a3d192e819d6990624f40e3585106aa070' +
        '19a4c1161e376c082748774c34b0bcb5391c0cb34ed8aa4a5b9cca4f682e6ff3' +
        '748f82ee78a5636f84c878148cc7020890befffaa4506cebbef9a3f7c67178f2'
      );

      // Initial hash values
      const H = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');

      // Pre-processing: adding padding bits
      const msgArr = message;
      const msgLen = msgArr.length;
      const bitLen = msgLen * 8;

      // Append '1' bit and padding zeros
      msgArr.push(0x80);
      while ((msgArr.length % 64) !== 56) {
        msgArr.push(0);
      }

      // Append original length in bits as 64-bit big-endian
      for (let i = 7; i >= 0; i--) {
        msgArr.push(OpCodes.ToByte(Math.floor(bitLen / Math.pow(2, i * 8))));
      }

      // Process each 512-bit block
      for (let offset = 0; offset < msgArr.length; offset += 64) {
        /** @type {uint32[]} */
        const W = new Array(64);

        // Copy block into first 16 words
        for (let i = 0; i < 16; i++) {
          W[i] = OpCodes.Pack32BE(msgArr[offset + i * 4], msgArr[offset + i * 4 + 1], msgArr[offset + i * 4 + 2], msgArr[offset + i * 4 + 3]);
        }

        // Extend the first 16 words into the remaining 48 words
        for (let i = 16; i < 64; i++) {
          const g1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(W[i - 2], 17), OpCodes.RotR32(W[i - 2], 19)), OpCodes.Shr32(W[i - 2], 10));
          const g0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(W[i - 15], 7), OpCodes.RotR32(W[i - 15], 18)), OpCodes.Shr32(W[i - 15], 3));
          W[i] = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(g1, W[i - 7]), g0), W[i - 16]);
        }

        // Initialize working variables
        let a = H[0];
        let b = H[1];
        let c = H[2];
        let d = H[3];
        let e = H[4];
        let f = H[5];
        let g = H[6];
        let h = H[7];

        // Main loop
        for (let i = 0; i < 64; i++) {
          const s1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(e, 6), OpCodes.RotR32(e, 11)), OpCodes.RotR32(e, 25));
          const ch = OpCodes.Xor32(OpCodes.And32(e, f), OpCodes.And32(OpCodes.Not32(e), g));
          const s0 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(a, 2), OpCodes.RotR32(a, 13)), OpCodes.RotR32(a, 22));
          const maj = OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(a, b), OpCodes.And32(a, c)), OpCodes.And32(b, c));
          const T1 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(h, s1), ch), K[i]), W[i]);
          const T2 = OpCodes.Add32(s0, maj);
          h = g;
          g = f;
          f = e;
          e = OpCodes.Add32(d, T1);
          d = c;
          c = b;
          b = a;
          a = OpCodes.Add32(T1, T2);
        }

        // Add compressed chunk to current hash value
        H[0] = OpCodes.Add32(H[0], a);
        H[1] = OpCodes.Add32(H[1], b);
        H[2] = OpCodes.Add32(H[2], c);
        H[3] = OpCodes.Add32(H[3], d);
        H[4] = OpCodes.Add32(H[4], e);
        H[5] = OpCodes.Add32(H[5], f);
        H[6] = OpCodes.Add32(H[6], g);
        H[7] = OpCodes.Add32(H[7], h);
      }

      // Produce the final hash value (big-endian)
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32BE(H[i]);
        for (let _i = 0; _i < bytes.length; _i++) result.push(bytes[_i]);
      }
      return result;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP800108CounterAlgorithm());

  return {
    SP800108CounterAlgorithm,
    SP800108CounterInstance
  };
}));
