/*
 * HOTP (HMAC-Based One-Time Password) Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements HOTP as defined in RFC 4226
 * Reference: https://tools.ietf.org/rfc/rfc4226.txt
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
          Algorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // HMAC-SHA1 comes from the collection's own HMAC and SHA-1. Under CommonJS
  // they are loaded with this file; in the browser the page loads them.
  if (typeof require !== 'undefined') {
    try {
      require('../mac/hmac.js');
      require('../hash/sha1.js');
    } catch (e) {
      // Reported as a missing dependency when an OTP is computed.
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * HOTP (HMAC-Based One-Time Password) Algorithm
   *
   * Implements RFC 4226 for generating time-independent one-time passwords.
   * HOTP generates deterministic OTPs based on a shared secret key and a
   * counter value, making it suitable for event-based two-factor authentication
   * where client and server maintain synchronized counter values.
   *
   * @class
   * @extends Algorithm
   *
   * @example
   * // Create HOTP instance
   * const hotp = new HOTPAlgorithm().CreateInstance();
   * hotp.key = OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930");
   * hotp.counter = 0;
   * hotp.digits = 6;
   * const otp = hotp.Result(); // Returns "755224" as byte array
   */
  class HOTPAlgorithm extends Algorithm {
    /**
     * Creates a new HOTP algorithm definition with metadata and test vectors
     *
     * @constructor
     */
    constructor() {
      super();

      // Required metadata
      this.name = "HOTP";
      this.description = "HMAC-Based One-Time Password algorithm as defined in RFC 4226. Generates time-independent OTPs using HMAC-SHA1 for two-factor authentication, synchronized by counter value between client and server.";
      this.inventor = "David M'Raihi, Mihir Bellare, Frank Hoornaert, David Naccache, Ohad Ranen";
      this.year = 2005;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "One-Time Password";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation links
      this.documentation = [
        new LinkItem(
          "RFC 4226 - HOTP: An HMAC-Based One-Time Password Algorithm",
          "https://tools.ietf.org/rfc/rfc4226.txt"
        ),
        new LinkItem(
          "OATH HOTP Specification",
          "https://openauthentication.org/specifications-technical-resources/"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "Botan HOTP Test Vectors",
          "https://github.com/randombit/botan/blob/master/src/tests/data/otp/hotp.vec"
        ),
        new LinkItem(
          "Google Authenticator Compatibility",
          "https://github.com/google/google-authenticator"
        )
      ];

      // Official test vectors from RFC 4226
      this.tests = [
        {
          text: "RFC 4226 HOTP Test Vector - Counter 0 (6 digits)",
          uri: "https://tools.ietf.org/rfc/rfc4226.txt",
          input: [],  // HOTP doesn't use input data
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"), // "12345678901234567890"
          counter: 0,
          digits: 6,
          expected: OpCodes.AnsiToBytes("755224")
        },
        {
          text: "RFC 4226 HOTP Test Vector - Counter 1 (6 digits)",
          uri: "https://tools.ietf.org/rfc/rfc4226.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"),
          counter: 1,
          digits: 6,
          expected: OpCodes.AnsiToBytes("287082")
        },
        {
          text: "RFC 4226 HOTP Test Vector - Counter 2 (6 digits)",
          uri: "https://tools.ietf.org/rfc/rfc4226.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"),
          counter: 2,
          digits: 6,
          expected: OpCodes.AnsiToBytes("359152")
        },
        {
          text: "RFC 4226 HOTP Test Vector - Counter 7 (7 digits)",
          uri: "https://tools.ietf.org/rfc/rfc4226.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"),
          counter: 7,
          digits: 7,
          expected: OpCodes.AnsiToBytes("2162583")
        },
        {
          text: "RFC 4226 HOTP Test Vector - Counter 8 (8 digits)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/otp/hotp.vec",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"),
          counter: 8,
          digits: 8,
          expected: OpCodes.AnsiToBytes("73399871")
        }
      ];
    }

    /**
     * Creates a new HOTP instance for generating one-time passwords
     *
     * @param {boolean} [isInverse=false] - Not used for HOTP (one-way function only)
     * @returns {HOTPInstance} A new HOTP instance configured for OTP generation
     */
    CreateInstance(isInverse = false) {
      return new HOTPInstance(this);
    }
  }

  /**
   * HOTP Instance for generating one-time passwords
   *
   * Maintains state for HOTP generation including secret key, counter value,
   * and desired OTP length. Implements the Feed/Result pattern from
   * AlgorithmFramework.
   *
   * @class
   * @extends IAlgorithmInstance
   *
   * @example
   * // Generate a 6-digit HOTP
   * const instance = new HOTPInstance(algorithm);
   * instance.key = secretKeyBytes;
   * instance.counter = 5;
   * instance.digits = 6;
   * const otp = instance.Result(); // Returns OTP as ASCII byte array
   */
  class HOTPInstance extends IAlgorithmInstance {
    /**
     * Creates a new HOTP instance
     *
     * @constructor
     * @param {HOTPAlgorithm} algorithm - The parent HOTP algorithm definition
     */
    constructor(algorithm) {
      super(algorithm);

      /**
       * Shared secret key for HMAC-SHA1
       * @type {uint8[]|null}
       * @private
       */
      this._key = null;

      /**
       * Counter value (typically incremented after each OTP generation)
       * @type {uint64}
       * @private
       */
      this._counter = 0;

      /**
       * Number of digits in the generated OTP (6-10)
       * @type {int32}
       * @private
       */
      this._digits = 6;  // Default 6-digit OTP
    }

    /**
     * Sets the shared secret key for HOTP generation
     *
     * The key is typically 20 bytes (160 bits) for HMAC-SHA1, but can be
     * any length. The key is copied internally to prevent external modification.
     *
     * @param {uint8[]} keyBytes - Secret key as byte array (uint8 values 0-255)
     * @throws {Error} If keyBytes is not a byte array
     *
     * @example
     * instance.key = OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930");
     */
    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key must be a byte array");
      }
      this._key = keyBytes.slice();
    }

    /**
     * Gets a copy of the current secret key
     *
     * @returns {uint8[]|null} Copy of the secret key bytes, or null if not set
     */
    get key() {
      return this._key ? this._key.slice() : null;
    }

    /**
     * Sets the counter value for HOTP generation
     *
     * The counter must be synchronized between client and server. It is typically
     * incremented after each successful OTP validation. RFC 4226 recommends
     * using an 8-byte (64-bit) counter value.
     *
     * @param {uint64} value - Counter value (non-negative integer, uint64 range)
     * @throws {Error} If value is not a non-negative integer
     *
     * @example
     * instance.counter = 0;  // First OTP
     * instance.counter = 1;  // Second OTP
     */
    set counter(value) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("Counter must be a non-negative integer");
      }
      this._counter = value;
    }

    /**
     * Gets the current counter value
     *
     * @returns {uint64} Current counter value (uint64)
     */
    get counter() {
      return this._counter;
    }

    /**
     * Sets the number of digits for the generated OTP
     *
     * RFC 4226 supports OTPs with 6-10 digits. Most implementations use 6 digits
     * for usability, though 8 digits provides better security against brute force.
     *
     * @param {int32} value - Number of OTP digits (integer 6-10 inclusive)
     * @throws {Error} If value is not between 6 and 10 (inclusive)
     *
     * @example
     * instance.digits = 6;  // Standard 6-digit OTP
     * instance.digits = 8;  // More secure 8-digit OTP
     */
    set digits(value) {
      if (!Number.isInteger(value) || value < 6 || value > 10) {
        throw new Error("Digits must be between 6 and 10");
      }
      this._digits = value;
    }

    /**
     * Gets the current OTP digit length setting
     *
     * @returns {int32} Number of digits (6-10)
     */
    get digits() {
      return this._digits;
    }

    /**
     * Feed method (not used for HOTP)
     *
     * HOTP is a one-shot algorithm that doesn't use streaming input.
     * All parameters are set via properties (key, counter, digits).
     * This method exists for AlgorithmFramework compatibility.
     *
     * @param {uint8[]} data - Input data (ignored for HOTP)
     * @returns {void}
     */
    Feed(data) {
      // HOTP doesn't use streaming input
      // Data is provided via properties (key, counter, digits)
    }

    /**
     * Generates the HOTP value
     *
     * Implements the HOTP algorithm from RFC 4226:
     * 1. Compute HMAC-SHA1(key, counter)
     * 2. Apply dynamic truncation to extract 31-bit value
     * 3. Reduce modulo 10^digits to get OTP
     * 4. Format with leading zeros
     *
     * @returns {uint8[]} OTP as ASCII-encoded byte array (e.g., "755224" as bytes)
     * @throws {Error} If key is not set
     *
     * @example
     * instance.key = OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930");
     * instance.counter = 0;
     * instance.digits = 6;
     * const otp = instance.Result();
     * // Returns [55, 53, 53, 50, 50, 52] (ASCII bytes for "755224")
     */
    Result() {
      if (!this._key || this._key.length === 0) {
        throw new Error("Key not set");
      }

      // Step 1: Generate HMAC-SHA1(key, counter)
      /** @type {uint8[]} */
      const counterBytes = this._encodeCounter(this._counter);
      /** @type {uint8[]} */
      const hmacResult = this._hmacSHA1(this._key, counterBytes);

      // Step 2: Dynamic Truncation (DT)
      // Extract 4 bytes starting at offset (last nibble of hash)
      /** @type {int32} */
      const offset = OpCodes.And32(hmacResult[19], 0x0F);
      /** @type {uint32} */
      const binaryCode =
        OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
          OpCodes.Shl32(OpCodes.And32(hmacResult[offset], 0x7F), 24),
          OpCodes.Shl32(OpCodes.And32(hmacResult[offset + 1], 0xFF), 16)),
          OpCodes.Shl32(OpCodes.And32(hmacResult[offset + 2], 0xFF), 8)),
          OpCodes.And32(hmacResult[offset + 3], 0xFF));

      // Step 3: Compute OTP = binaryCode mod 10^digits
      /** @type {uint64} */
      let modulus = 1;
      for (let d = 0; d < this._digits; d++) modulus = modulus * 10;
      /** @type {uint64} */
      const otp = binaryCode % modulus;

      // Step 4: Convert to string with leading zeros
      /** @type {string} */
      let otpString = String(otp);
      while (otpString.length < this._digits) otpString = '0' + otpString;

      // Return as byte array (ASCII encoding)
      return OpCodes.AnsiToBytes(otpString);
    }

    /**
     * Encodes counter value as 8-byte big-endian array
     *
     * Converts a 64-bit counter into an 8-byte big-endian representation
     * as required by RFC 4226 for HMAC-SHA1 input.
     *
     * @private
     * @param {uint64} counter - Counter value (uint64, 0 to 2^53-1 in JavaScript)
     * @returns {uint8[]} 8-byte big-endian array (uint8 values)
     *
     * @example
     * _encodeCounter(0) // Returns [0,0,0,0,0,0,0,0]
     * _encodeCounter(1) // Returns [0,0,0,0,0,0,0,1]
     * _encodeCounter(256) // Returns [0,0,0,0,0,0,1,0]
     */
    _encodeCounter(counter) {
      /** @type {uint8[]} */
      const result = OpCodes.CreateArray(8, 0);
      /** @type {uint64} */
      let rest = counter;
      for (let i = 7; i >= 0; i--) {
        result[i] = rest % 256;
        rest = Math.floor(rest / 256);
      }
      return result;
    }

    /**
     * Computes HMAC-SHA1 of message using key
     *
     * Uses the registered HMAC over the registered SHA-1, as RFC 4226 requires.
     *
     * @private
     * @param {uint8[]} key - Secret key as byte array (uint8 values)
     * @param {uint8[]} message - Message to authenticate (uint8 values)
     * @returns {uint8[]} 20-byte HMAC-SHA1 hash (uint8 values)
     * @throws {Error} If HMAC is not registered
     *
     * @example
     * const key = [0x31, 0x32, 0x33, ...];
     * const msg = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
     * const hmac = _hmacSHA1(key, msg); // Returns 20-byte hash
     */
    _hmacSHA1(key, message) {
      /** @type {Algorithm} */
      const hmacAlgorithm = AlgorithmFramework.Find('HMAC');
      if (!hmacAlgorithm) {
        throw new Error("Cannot compute HMAC-SHA1: HMAC is not registered. Load it before HOTP");
      }

      /** @type {IMacInstance} */
      const hmacInstance = hmacAlgorithm.CreateInstance(false);
      hmacInstance.key = key;
      hmacInstance.hashFunction = 'SHA-1';
      /** @type {uint8[]} */
      const mac = hmacInstance.ComputeMac(message);
      return mac;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new HOTPAlgorithm());

  return {
    HOTPAlgorithm,
    HOTPInstance
  };
}));
