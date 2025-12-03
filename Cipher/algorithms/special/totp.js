/*
 * TOTP (Time-Based One-Time Password) Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements TOTP as defined in RFC 6238
 * Reference: https://tools.ietf.org/rfc/rfc6238.txt
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * TOTP (Time-Based One-Time Password) Algorithm Implementation
   *
   * Implements RFC 6238 TOTP specification for generating time-synchronized one-time passwords.
   * TOTP is widely used in two-factor authentication (2FA) systems and is the basis for
   * Google Authenticator, Authy, and similar authentication apps.
   *
   * @class TOTPAlgorithm
   * @extends {Algorithm}
   * @description Production-ready TOTP implementation supporting SHA-1, SHA-256, and SHA-512
   * hash algorithms with configurable time steps and digit lengths (6-10 digits).
   */
  class TOTPAlgorithm extends Algorithm {
    /**
     * Creates a new TOTP algorithm instance with RFC 6238 compliant metadata
     * @constructor
     */
    constructor() {
      super();

      // Required metadata
      this.name = "TOTP";
      this.description = "Time-Based One-Time Password algorithm as defined in RFC 6238. Generates time-dependent OTPs using HMAC for two-factor authentication, synchronized by time between client and server with 30-second default window.";
      this.inventor = "David M'Raihi, Johan Rydell, Mingliang Pei, Salah Machani";
      this.year = 2011;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "One-Time Password";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation links
      this.documentation = [
        new LinkItem(
          "RFC 6238 - TOTP: Time-Based One-Time Password Algorithm",
          "https://tools.ietf.org/rfc/rfc6238.txt"
        ),
        new LinkItem(
          "OATH TOTP Specification",
          "https://openauthentication.org/specifications-technical-resources/"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "Botan TOTP Test Vectors",
          "https://github.com/randombit/botan/blob/master/src/tests/data/otp/totp.vec"
        ),
        new LinkItem(
          "Google Authenticator Compatibility",
          "https://github.com/google/google-authenticator"
        )
      ];

      // Official test vectors from RFC 6238 Appendix B
      this.tests = [
        {
          text: "RFC 6238 TOTP Test Vector - SHA1 @ 59s (8 digits)",
          uri: "https://tools.ietf.org/rfc/rfc6238.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"), // "12345678901234567890"
          timestamp: 59,
          timestep: 30,
          digits: 8,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.AnsiToBytes("94287082")
        },
        {
          text: "RFC 6238 TOTP Test Vector - SHA1 @ 1111111109s (8 digits)",
          uri: "https://tools.ietf.org/rfc/rfc6238.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"),
          timestamp: 1111111109,
          timestep: 30,
          digits: 8,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.AnsiToBytes("07081804")
        },
        {
          text: "RFC 6238 TOTP Test Vector - SHA1 @ 1234567890s (8 digits)",
          uri: "https://tools.ietf.org/rfc/rfc6238.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930"),
          timestamp: 1234567890,
          timestep: 30,
          digits: 8,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.AnsiToBytes("89005924")
        },
        {
          text: "RFC 6238 TOTP Test Vector - SHA256 @ 59s (8 digits)",
          uri: "https://tools.ietf.org/rfc/rfc6238.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930313233343536373839303132"),
          timestamp: 59,
          timestep: 30,
          digits: 8,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.AnsiToBytes("46119246")
        },
        {
          text: "RFC 6238 TOTP Test Vector - SHA512 @ 59s (8 digits)",
          uri: "https://tools.ietf.org/rfc/rfc6238.txt",
          input: [],
          key: OpCodes.Hex8ToBytes("31323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334"),
          timestamp: 59,
          timestep: 30,
          digits: 8,
          hashAlgorithm: "SHA-512",
          expected: OpCodes.AnsiToBytes("90693936")
        }
      ];
    }

    /**
     * Creates a new TOTP instance for generating one-time passwords
     *
     * @param {boolean} [isInverse=false] - Ignored for TOTP (no inverse operation)
     * @returns {TOTPInstance} A new TOTP instance configured with this algorithm's metadata
     * @example
     * const totp = algorithm.CreateInstance();
     * totp.key = OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930");
     * totp.timestamp = 59;
     * const otp = totp.Result(); // Returns "94287082" as byte array
     */
    CreateInstance(isInverse = false) {
      return new TOTPInstance(this);
    }
  }

  /**
   * TOTP Instance - Handles time-based one-time password generation
   *
   * Implements the Feed/Result pattern from AlgorithmFramework for TOTP computation.
   * This instance maintains state for key, timestamp, timestep, digits, hash algorithm,
   * and T0 values required for RFC 6238 compliant TOTP generation.
   *
   * @class TOTPInstance
   * @extends {IAlgorithmInstance}
   * @description Stateful instance for TOTP generation with configurable parameters.
   * Uses HMAC-based algorithm with dynamic truncation to produce N-digit OTPs.
   */
  class TOTPInstance extends IAlgorithmInstance {
    /**
     * Creates a new TOTP instance
     *
     * @constructor
     * @param {TOTPAlgorithm} algorithm - Parent TOTP algorithm providing metadata
     */
    constructor(algorithm) {
      super(algorithm);

      /**
       * Secret key for HMAC computation
       * @type {Uint8Array|null}
       * @private
       */
      this._key = null;

      /**
       * Unix timestamp in seconds for OTP generation
       * @type {number}
       * @private
       */
      this._timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp

      /**
       * Time step window in seconds (typically 30)
       * @type {number}
       * @private
       */
      this._timestep = 30;  // Default 30-second time step

      /**
       * Number of digits in generated OTP (6-10)
       * @type {number}
       * @private
       */
      this._digits = 8;  // Default 8-digit OTP

      /**
       * Hash algorithm name (SHA-1, SHA-256, or SHA-512)
       * @type {string}
       * @private
       */
      this._hashAlgorithm = 'SHA-1';  // Default hash algorithm

      /**
       * Initial counter time (Unix epoch start, typically 0)
       * @type {number}
       * @private
       */
      this._t0 = 0;  // Default Unix epoch start
    }

    /**
     * Sets the secret key for TOTP generation
     *
     * @param {Uint8Array} keyBytes - Secret key as byte array (typically 20 bytes for SHA-1,
     *                                 32 bytes for SHA-256, 64 bytes for SHA-512)
     * @throws {Error} If keyBytes is not a valid byte array
     * @example
     * instance.key = OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930");
     */
    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key must be a byte array");
      }
      this._key = [...keyBytes];
    }

    /**
     * Gets a copy of the secret key
     *
     * @returns {Uint8Array|null} Copy of the secret key, or null if not set
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Sets the Unix timestamp for TOTP calculation
     *
     * @param {number} value - Unix timestamp in seconds (uint64, non-negative integer)
     * @throws {Error} If value is not a non-negative integer
     * @example
     * instance.timestamp = 59; // January 1, 1970 00:00:59 UTC
     */
    set timestamp(value) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("Timestamp must be a non-negative integer");
      }
      this._timestamp = value;
    }

    /**
     * Gets the current Unix timestamp used for TOTP calculation
     *
     * @returns {number} Unix timestamp in seconds (uint64)
     */
    get timestamp() {
      return this._timestamp;
    }

    /**
     * Sets the time step duration for TOTP windows
     *
     * @param {number} value - Time step in seconds (uint32, positive integer, typically 30)
     * @throws {Error} If value is not a positive integer
     * @example
     * instance.timestep = 30; // Standard 30-second window
     */
    set timestep(value) {
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("Timestep must be a positive integer");
      }
      this._timestep = value;
    }

    /**
     * Gets the current time step duration
     *
     * @returns {number} Time step in seconds (uint32)
     */
    get timestep() {
      return this._timestep;
    }

    /**
     * Sets the number of digits in the generated OTP
     *
     * @param {number} value - Number of digits (uint8, range 6-10, typically 6 or 8)
     * @throws {Error} If value is not between 6 and 10
     * @example
     * instance.digits = 6; // Standard 6-digit OTP (Google Authenticator)
     */
    set digits(value) {
      if (!Number.isInteger(value) || value < 6 || value > 10) {
        throw new Error("Digits must be between 6 and 10");
      }
      this._digits = value;
    }

    /**
     * Gets the number of digits in the generated OTP
     *
     * @returns {number} Number of OTP digits (uint8, 6-10)
     */
    get digits() {
      return this._digits;
    }

    /**
     * Sets the hash algorithm for HMAC computation
     *
     * @param {string} value - Hash algorithm name (case-insensitive: "SHA-1", "SHA-256", or "SHA-512")
     * @throws {Error} If value is not a valid string
     * @example
     * instance.hashAlgorithm = "SHA-256"; // Use SHA-256 for HMAC
     */
    set hashAlgorithm(value) {
      if (!value || typeof value !== 'string') {
        throw new Error("Hash algorithm must be a valid string");
      }
      this._hashAlgorithm = value.toUpperCase();
    }

    /**
     * Gets the current hash algorithm name
     *
     * @returns {string} Hash algorithm name (uppercase: "SHA-1", "SHA-256", or "SHA-512")
     */
    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    /**
     * Sets the initial counter time (T0)
     *
     * @param {number} value - Initial counter time as Unix timestamp (uint64, typically 0 for Unix epoch)
     * @throws {Error} If value is not a non-negative integer
     * @example
     * instance.t0 = 0; // Start counting from Unix epoch (standard)
     */
    set t0(value) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("T0 must be a non-negative integer");
      }
      this._t0 = value;
    }

    /**
     * Gets the initial counter time (T0)
     *
     * @returns {number} Initial counter time as Unix timestamp (uint64)
     */
    get t0() {
      return this._t0;
    }

    /**
     * Feed method (no-op for TOTP)
     *
     * TOTP does not use streaming input. All parameters are provided via properties
     * (key, timestamp, timestep, digits, hashAlgorithm, t0) before calling Result().
     *
     * @param {Uint8Array} data - Ignored for TOTP (not used)
     */
    Feed(data) {
      // TOTP doesn't use streaming input
      // Data is provided via properties (key, timestamp, timestep, digits, hashAlgorithm)
    }

    /**
     * Generates the TOTP value for the current timestamp
     *
     * Implements RFC 6238 TOTP algorithm:
     * 1. Calculate counter T = floor((timestamp - T0) / timestep)
     * 2. Generate HMAC(key, counter) using configured hash algorithm
     * 3. Apply dynamic truncation (DT) to extract 31-bit value
     * 4. Compute OTP = truncated_value mod 10^digits
     * 5. Format as zero-padded ASCII string
     *
     * @returns {Uint8Array} TOTP value as ASCII-encoded byte array (e.g., "123456" -> [49,50,51,52,53,54])
     * @throws {Error} If key is not set
     * @example
     * instance.key = OpCodes.Hex8ToBytes("3132333435363738393031323334353637383930");
     * instance.timestamp = 59;
     * instance.timestep = 30;
     * instance.digits = 8;
     * const otp = instance.Result(); // Returns ASCII bytes for "94287082"
     */
    Result() {
      if (!this._key || this._key.length === 0) {
        throw new Error("Key not set");
      }

      // Step 1: Calculate counter T = floor((Current Unix time - T0) / X)
      const counter = Math.floor((this._timestamp - this._t0) / this._timestep);

      // Step 2: Generate HMAC(key, counter)
      const counterBytes = this._encodeCounter(counter);
      const hmacResult = this._hmac(this._key, counterBytes);

      // Step 3: Dynamic Truncation (DT) - same as HOTP
      const offset = OpCodes.AndN(hmacResult[hmacResult.length - 1], 0x0F);
      const binaryCode =
        OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
          OpCodes.Shl32(OpCodes.AndN(hmacResult[offset], 0x7F), 24),
          OpCodes.Shl32(OpCodes.AndN(hmacResult[offset + 1], 0xFF), 16)),
          OpCodes.Shl32(OpCodes.AndN(hmacResult[offset + 2], 0xFF), 8)),
          OpCodes.AndN(hmacResult[offset + 3], 0xFF));

      // Step 4: Compute OTP = binaryCode mod 10^digits
      const modulus = Math.pow(10, this._digits);
      const otp = binaryCode % modulus;

      // Step 5: Convert to string with leading zeros
      const otpString = otp.toString().padStart(this._digits, '0');

      // Return as byte array (ASCII encoding)
      return OpCodes.AnsiToBytes(otpString);
    }

    /**
     * Encodes a counter value as 8-byte big-endian byte array
     *
     * Converts the time-based counter into the format required for HMAC input
     * according to RFC 6238 specification.
     *
     * @private
     * @param {number} counter - Counter value (uint64, T = floor((timestamp - T0) / timestep))
     * @returns {Uint8Array} 8-byte big-endian representation of counter
     * @example
     * _encodeCounter(1) // Returns [0,0,0,0,0,0,0,1]
     */
    _encodeCounter(counter) {
      const result = new Array(8).fill(0);
      for (let i = 7; i >= 0; i--) {
        result[i] = OpCodes.AndN(counter, 0xFF);
        counter = Math.floor(counter / 256);
      }
      return result;
    }

    /**
     * Computes HMAC using the configured hash algorithm
     *
     * Attempts to use Node.js crypto module first, falls back to OpCodes.HMAC if available.
     * Supports SHA-1, SHA-256, and SHA-512 hash algorithms.
     *
     * @private
     * @param {Uint8Array} key - Secret key for HMAC computation
     * @param {Uint8Array} message - Message to authenticate (8-byte counter value)
     * @returns {Uint8Array} HMAC result as byte array (20 bytes for SHA-1, 32 for SHA-256, 64 for SHA-512)
     * @throws {Error} If hash algorithm is unsupported or no crypto library is available
     * @example
     * const hmac = _hmac([0x31,0x32,...], [0,0,0,0,0,0,0,1]); // HMAC-SHA1 of counter=1
     */
    _hmac(key, message) {
      const hashAlgo = this._hashAlgorithm.toUpperCase();

      // Try using Node.js crypto if available
      if (typeof require !== 'undefined') {
        try {
          const crypto = require('crypto');
          let hashName;

          if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') {
            hashName = 'sha1';
          } else if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') {
            hashName = 'sha256';
          } else if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') {
            hashName = 'sha512';
          } else {
            throw new Error(`Unsupported hash algorithm: ${hashAlgo}`);
          }

          const hmac = crypto.createHmac(hashName, Buffer.from(key));
          hmac.update(Buffer.from(message));
          return Array.from(hmac.digest());
        } catch (e) {
          // Fall through to alternate implementation
        }
      }

      // Check if we have HMAC in OpCodes
      if (OpCodes && OpCodes.HMAC) {
        return OpCodes.HMAC(key, message, hashAlgo);
      }

      throw new Error(
        `Cannot compute HMAC: No crypto library available (requires Node.js crypto or Web Crypto API)`
      );
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new TOTPAlgorithm());

  return {
    TOTPAlgorithm,
    TOTPInstance
  };
}));
