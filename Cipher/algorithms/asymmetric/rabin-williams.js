/*
 * Rabin-Williams Signature Scheme Implementation
 * IEEE P1363 conformant signature scheme with message recovery
 * Compatible with AlgorithmFramework - uses JavaScript native BigInt
 * (c)2006-2025 Hawkynt
 *
 * Based on Crypto++ implementation by Wei Dai
 * Reference: rw.h, rw.cpp from Crypto++
 * Paper: "RSA signatures and Rabin-Williams signatures: the state of the art"
 *        by Daniel J. Bernstein (http://cr.yp.to/sigs/rwsota-20080131.pdf)
 *
 * The public function is s -> e * f * s^2 mod n with e in {1, -1} and f in
 * {1, 2}. For n = p*q with p congruent 3 and q congruent 7 modulo 8, exactly
 * one of x, -x, x/2, -x/2 is a square modulo n, which is what makes the
 * square root unambiguous. This implementation transmits the tweak alongside
 * the root, the variant Bernstein calls sending e and f explicitly, so the
 * verifier reconstructs the message representative rather than guessing it.
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
          AsymmetricCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== NUMBER THEORY UTILITIES FOR RABIN-WILLIAMS =====

  const NumberTheory = {
    /**
     * Extended Euclidean algorithm: find x, y such that ax + by = gcd(a,b)
     * @param {BigInt} a - First number
     * @param {BigInt} b - Second number
     * @returns {Object} {gcd, x, y}
     */
    extendedGcd: function(a, b) {
      let oldR = a;
      let r = b;
      let oldS = 1n;
      let s = 0n;
      let oldT = 0n;
      let t = 1n;

      while (r !== 0n) {
        const quotient = oldR / r;
        let tmp = oldR - quotient * r;
        oldR = r;
        r = tmp;
        tmp = oldS - quotient * s;
        oldS = s;
        s = tmp;
        tmp = oldT - quotient * t;
        oldT = t;
        t = tmp;
      }

      return { gcd: oldR, x: oldS, y: oldT };
    },

    /**
     * Modular multiplicative inverse using extended Euclidean algorithm
     * @param {BigInt} a - Number to invert
     * @param {BigInt} m - Modulus
     * @returns {BigInt} Inverse of a mod m
     * @throws {Error} If a is not invertible modulo m
     */
    modInverse: function(a, m) {
      const result = this.extendedGcd(((a % m) + m) % m, m);
      if (result.gcd !== 1n) {
        throw new Error('Modular inverse does not exist');
      }
      return ((result.x % m) + m) % m;
    },

    /**
     * Modular exponentiation: compute (base^exp) mod m efficiently
     * @param {BigInt} base - Base value
     * @param {BigInt} exp - Exponent
     * @param {BigInt} m - Modulus
     * @returns {BigInt} (base^exp) mod m
     */
    modExp: function(base, exp, m) {
      if (m === 1n) return 0n;

      let result = 1n;
      let b = ((base % m) + m) % m;
      let e = exp;

      while (e > 0n) {
        if (e % 2n === 1n) {
          result = (result * b) % m;
        }
        e = e / 2n;
        b = (b * b) % m;
      }

      return result;
    },

    /**
     * Legendre/Jacobi symbol (a/n) for odd positive n
     * @param {BigInt} a - Upper value
     * @param {BigInt} n - Lower value, odd and positive
     * @returns {number} -1, 0 or 1
     */
    jacobi: function(a, n) {
      if (n <= 0n || n % 2n === 0n) {
        throw new Error('Jacobi symbol: n must be odd and positive');
      }

      let top = ((a % n) + n) % n;
      let bottom = n;
      let result = 1;

      while (top !== 0n) {
        while (top % 2n === 0n) {
          top = top / 2n;
          const mod8 = bottom % 8n;
          if (mod8 === 3n || mod8 === 5n) {
            result = -result;
          }
        }

        const swap = top;
        top = bottom;
        bottom = swap;

        if (top % 4n === 3n && bottom % 4n === 3n) {
          result = -result;
        }

        top = top % bottom;
      }

      return bottom === 1n ? result : 0;
    },

    /**
     * Chinese Remainder Theorem, Crypto++ form
     * x = xq + q * ((xp - xq) * u mod p)
     * @param {BigInt} xp - x mod p
     * @param {BigInt} p - First prime modulus
     * @param {BigInt} xq - x mod q
     * @param {BigInt} q - Second prime modulus
     * @param {BigInt} u - Precomputed q^(-1) mod p
     * @returns {BigInt} Solution x modulo p*q
     */
    crt: function(xp, p, xq, q, u) {
      const diff = ((xp - xq) % p + p) % p;
      const mult = (diff * u) % p;
      return xq + q * mult;
    },

    /**
     * Square root modulo a prime congruent to 3 modulo 4
     * @param {BigInt} a - Quadratic residue
     * @param {BigInt} prime - Prime congruent 3 modulo 4
     * @returns {BigInt} A square root of a modulo prime
     */
    squareRoot3Mod4: function(a, prime) {
      return this.modExp(a, (prime + 1n) / 4n, prime);
    },

    /**
     * Draw a random integer in [min, max]
     * @param {BigInt} min - Lower bound, inclusive
     * @param {BigInt} max - Upper bound, inclusive
     * @returns {BigInt} Random value in range
     */
    randomBigInt: function(min, max) {
      const range = max - min + 1n;
      const octets = Math.ceil(range.toString(16).length / 2) + 8;
      return min + (OS2IP(randomBytes(octets)) % range);
    }
  };

  // ===== INTEGER / OCTET-STRING PRIMITIVES =====

  /**
   * Parse a hexadecimal literal into a BigInt.
   * @param {string} hex - Hexadecimal digits, no prefix
   * @returns {BigInt} Parsed value
   */
  function hexToBigInt(hex) {
    let value = 0n;
    for (let i = 0; i < hex.length; ++i) {
      value = value * 16n + BigInt(parseInt(hex.charAt(i), 16));
    }
    return value;
  }

  /**
   * OS2IP - Octet string to non-negative integer (RFC 8017 Section 4.2)
   * @param {uint8[]} octets - Big-endian octet string
   * @returns {BigInt} Corresponding integer
   */
  function OS2IP(octets) {
    let value = 0n;
    for (let i = 0; i < octets.length; ++i) {
      value = value * 256n + BigInt(octets[i]);
    }
    return value;
  }

  /**
   * I2OSP - Non-negative integer to octet string (RFC 8017 Section 4.1)
   *
   * The length is fixed, which is what keeps leading zero octets: a value that
   * needs fewer than xLen octets is left-padded rather than shortened.
   *
   * @param {BigInt} value - Integer to convert
   * @param {number} xLen - Intended length of the octet string
   * @returns {uint8[]} Big-endian octet string of exactly xLen bytes
   */
  function I2OSP(value, xLen) {
    if (value < 0n) {
      throw new Error('I2OSP: integer must be non-negative');
    }

    const octets = new Array(xLen);
    let remaining = value;
    for (let i = xLen - 1; i >= 0; --i) {
      octets[i] = Number(remaining % 256n);
      remaining = remaining / 256n;
    }

    if (remaining !== 0n) {
      throw new Error('I2OSP: integer too large for ' + xLen + ' octets');
    }

    return octets;
  }

  /**
   * Collect cryptographically strong random bytes, falling back to a weaker
   * source only where no such generator exists.
   * @param {number} count - Number of bytes required
   * @returns {uint8[]} Random bytes
   */
  function randomBytes(count) {
    const buffer = new Uint8Array(count);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buffer);
    } else {
      let filled = false;
      if (typeof require !== 'undefined') {
        try {
          require('crypto').randomFillSync(buffer);
          filled = true;
        } catch (e) {
          filled = false;
        }
      }
      if (!filled) {
        for (let i = 0; i < count; ++i) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
      }
    }

    const result = new Array(count);
    for (let i = 0; i < count; ++i) {
      result[i] = buffer[i];
    }
    return result;
  }

  // ===== MESSAGE ENCODING WITH RECOVERY =====

  // ISO/IEC 9796-2 shape: a header octet, the message, its length, and the
  // trailer octet 0xCC that IEEE P1363 uses for Rabin-Williams. The length
  // field is what lets a message of any size come back at exactly that size,
  // and the fixed block width is what lets one that starts with zero octets
  // come back with them intact.
  const HEADER_OCTET = 0x6A;
  const TRAILER_OCTET = 0xCC;
  const ENCODING_OVERHEAD = 4; // header + two length octets + trailer

  /**
   * Wrap a message in a recoverable encoded block.
   * @param {uint8[]} message - Message octets
   * @param {number} emLen - Width of the encoded block
   * @returns {uint8[]} Encoded block of exactly emLen octets
   */
  function encodeForRecovery(message, emLen) {
    const capacity = emLen - ENCODING_OVERHEAD;
    if (message.length > capacity) {
      throw new Error('Rabin-Williams: message too long (' + message.length + ' bytes, maximum ' + capacity + ')');
    }

    const block = new Array(emLen).fill(0x00);
    block[0] = HEADER_OCTET;

    const offset = emLen - 3 - message.length;
    for (let i = 0; i < message.length; ++i) {
      block[offset + i] = message[i];
    }

    block[emLen - 3] = Math.floor(message.length / 256);
    block[emLen - 2] = message.length % 256;
    block[emLen - 1] = TRAILER_OCTET;

    return block;
  }

  /**
   * Recover the message from an encoded block.
   * @param {uint8[]} block - Encoded block
   * @returns {uint8[]} Message octets
   * @throws {Error} If the block is not well formed
   */
  function decodeFromRecovery(block) {
    const emLen = block.length;
    if (emLen < ENCODING_OVERHEAD || block[0] !== HEADER_OCTET || block[emLen - 1] !== TRAILER_OCTET) {
      throw new Error('Rabin-Williams: verification failed - encoded block header or trailer wrong');
    }

    const length = OpCodes.Pack16BE(block[emLen - 3], block[emLen - 2]);
    if (length > emLen - ENCODING_OVERHEAD) {
      throw new Error('Rabin-Williams: verification failed - recovered length out of range');
    }

    const offset = emLen - 3 - length;
    for (let i = 1; i < offset; ++i) {
      if (block[i] !== 0x00) {
        throw new Error('Rabin-Williams: verification failed - encoded block padding is not zero');
      }
    }

    return block.slice(offset, emLen - 3);
  }

  // ===== DEMONSTRATION KEY MATERIAL =====

  // Fixed key pairs so that a signing instance and a verifying instance
  // configured with the same key selector share the same modulus. Generating a
  // fresh key inside each instance is what made verification impossible: the
  // verifier squared the signature under a modulus the signer had never seen.
  //
  // These key pairs are published here in full and are therefore demonstration
  // material only, never a secret. Each was produced with a standard generator
  // and checked to satisfy n = p * q with both factors prime, p congruent 3 and
  // q congruent 7 modulo 8 (hence n congruent 5 modulo 8), and u * q congruent
  // to 1 modulo p.
  const RW_KEYS = {
    1024: {
      n: 'adb1b8740daa87df2f698c394fcdaf981b41fc25ea57077d5b109bd0e60f9c92' +
         'e27a7bae324a9a399dbf651bfd1740a1f03e62aa048bffe39abc68a9357e5674' +
         '21e43e0568b9cac6cdf92203d0603ccd678534daae092aafd76b6119d9155fec' +
         'c214f218c87374bb70bfb4a915416e1698ae10d6ff438a040ab96bf6ba1469e5',
      p: 'cfda4e5ea1269176e3ea66266ad8c0fbcd93ebcf070a1320da0379c0cb946972' +
         '5b26afbba47a47213de7934cdc4a6ece9250f7d0a713e0ea9d79424c4f2bdf43',
      q: 'd5edcf17b3d0352748258c34733097f10a29763a20d2fe4dbab17a181836f541' +
         '1c887fe46e8076d9fa107cb6938606979612c245c546fe1dba12a37790095bb7',
      u: 'a82864c46c48222395d6cb8acbe6ccdcb6b52a32fd8aa021c7aa15c66ec3ea30' +
         '44f36ac065f4135614d9ada891a3b559814ea446d2f3b8ab24f31cb12c2b7def'
    },
    2048: {
      n: '825758bf1705a3fe81421397e937c64d2aa981991aeb59e2092415dd8a15e27f' +
         '49269f8ebc420b824baf27ac086835fae576ffbedaca609c1e2be12ed3c7cb72' +
         '92af71444340c78858845f37bc8907b541338aad2c76fe3ff285570d13e353ad' +
         '300a1a7b1325b76855a6bef899a0c215ec9df6488eade860527833357f4f6c5a' +
         '20621fb82ccae10f5079fdeaeee818e88577cd2ba330de9ca3234dbe3234046f' +
         '2ee660703c0270659d28112e453feda7d632c391e4f552c40bce5bf95c2033fd' +
         'fbb577c4b16a78be0f4e44a86a7b3a17e7182d8ed0c8c82b2653cabd3c0515fd' +
         '38c6d47e62d5acf46e4257edf3473cafce62d9c5198f04a3ea67e93c7aa6d82d',
      p: 'fe2f04d56b682d13e4582a0dba751e1528b5c195444412924ce452c7f3a29f9d' +
         '5e499c10d6cd18741d90abe7273e109f7ba957dfadcaf882f2058ca5b83ec997' +
         '802311904e556bb1c7c7d96750a408ff10fedfef25cbae2096c7003e0c9d62ec' +
         '619cdfc978894b1e5c98a42b3f2f6fb5cbcdb4a6a79fb48959dc1b532a1cec3b',
      q: '8345c804e09e8e5cf6aca689a6a24ff2372448e8d5c98a87887dee9384169fe0' +
         'b301cbee6d3336a076b450b5bf3e05a3a5ccd14ee4718a1676634a6fe5887618' +
         '46c314effd33eddb7ca5e01915ab9e5ae03541a5356e7e5798e878f0ab724eff' +
         '676122591a24070667f416e4985fd21f89fae90a34674095058f19e4b0004eb7',
      u: '8987fac81313f74981c2530278b69c167deba160ee32533f4f3682005e3fd211' +
         '79d4e84b8a80f3e18ab8ffaf8f1ba7c3a293a892e59f325ceda8e2ba91115618' +
         '567d6ce54fbc83025d058c4979ffe8e1560912c6515f3308cc1c5e28e0b5dc70' +
         'eaaf8a173dca14292a370c9cb593ba62198432eea6acf96ff4019afa476a4838'
    }
  };

  const SUPPORTED_KEY_SIZES = [1024, 2048];

  // Tweak codes transmitted with the root. Each names one of the four ways the
  // message representative x relates to u = s^2 mod n.
  const TWEAK_PLAIN = 0;      // x = u
  const TWEAK_NEGATED = 1;    // x = n - u
  const TWEAK_DOUBLED = 2;    // x = 2u mod n
  const TWEAK_NEG_DOUBLED = 3; // x = n - (2u mod n)

  /**
   * Read a key size selector from whatever the caller supplied. Both spellings
   * used across this collection are accepted: decimal digits in ASCII, and a
   * big-endian 16-bit count of bits.
   * @param {uint8[]|string|number} keyData - Key selector
   * @returns {number} Key size in bits
   */
  function parseKeySize(keyData) {
    if (typeof keyData === 'number') {
      return keyData;
    }

    if (typeof keyData === 'string') {
      return parseInt(keyData, 10);
    }

    if (keyData && typeof keyData.length === 'number') {
      let digits = '';
      let allDigits = keyData.length > 0;
      for (let i = 0; i < keyData.length; ++i) {
        if (keyData[i] < 0x30 || keyData[i] > 0x39) {
          allDigits = false;
          break;
        }
        digits += String.fromCharCode(keyData[i]);
      }

      if (allDigits) {
        return parseInt(digits, 10);
      }

      if (keyData.length >= 2) {
        return OpCodes.Pack16BE(keyData[0], keyData[1]);
      }
    }

    throw new Error('Rabin-Williams: unrecognised key selector');
  }

  // ===== RABIN-WILLIAMS ALGORITHM IMPLEMENTATION =====

  class RabinWilliamsSignature extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Rabin-Williams";
      this.description = "Rabin-Williams signature scheme with message recovery, following IEEE P1363 and Bernstein's treatment of the e and f tweaks. Signing extracts a square root modulo n = p*q with p congruent 3 and q congruent 7 modulo 8; verification squares the root and applies the transmitted tweak. Security is equivalent to integer factorization.";
      this.inventor = "Michael O. Rabin, Hugh C. Williams";
      this.year = 1979;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signature Scheme";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata: the sizes for which a demonstration key
      // pair is published below. Other moduli work the moment key material is
      // supplied through the publicKey and privateKey properties.
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // RW-1024 (demonstration)
        new KeySize(2048, 2048, 0)  // RW-2048
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Bernstein's RW Paper (2008)", "http://cr.yp.to/sigs/rwsota-20080131.pdf"),
        new LinkItem("IEEE P1363", "https://standards.ieee.org/standard/1363-2000.html"),
        new LinkItem("Crypto++ RW Implementation", "https://github.com/weidai11/cryptopp/blob/master/rw.cpp"),
        new LinkItem("Wikipedia - Rabin Signature", "https://en.wikipedia.org/wiki/Rabin_signature_algorithm")
      ];

      this.references = [
        new LinkItem("Crypto++ rw.h", "https://github.com/weidai11/cryptopp/blob/master/rw.h"),
        new LinkItem("Crypto++ rw.cpp", "https://github.com/weidai11/cryptopp/blob/master/rw.cpp"),
        new LinkItem("Williams, A modification of the RSA public-key encryption procedure (1980)", "https://ieeexplore.ieee.org/document/1056264")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Message Recovery Without Hashing",
          '',
          "This variant recovers the message itself rather than a hash of it, so an attacker who can pick the representative can pick the message. Sign a hash of the message under a collision resistant function for any use beyond demonstration",
          "http://cr.yp.to/sigs/rwsota-20080131.pdf"),
        new Vulnerability("Published Demonstration Keys",
          '',
          "The key pairs in this file are printed in the source, so anyone can forge under them. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration",
          "https://github.com/weidai11/cryptopp/blob/master/rw.cpp")
      ];

      // Test vectors - sign then verify with recovery.
      //
      // The first is the vector this file has always carried, byte for byte:
      // it asserts that "Hello World" signed under the 1024-bit key comes back
      // as "Hello World". That assertion was correct all along and the code
      // was not; it is left exactly as it stood.
      //
      // No fixed signature is committed as an expected value. Signing here is
      // in fact deterministic - the blinding factor cancels and the canonical
      // root is the smallest of the four - so a signature could be written
      // down, but it would be this implementation quoting itself, and that is
      // how the fabricated vectors this file replaces came to exist. What can
      // be checked without trusting this code is the defining relation. For
      // "Hello World" under the 1024-bit key the signature is
      //   4d47e76ca564e1849f32304da74da59b c0c60b8e75dee9b7d1b1e27d2aa0c465
      //   aef24afc823fb84d2f834cc03c5c0f9e ebd34b67035136f7035ae4e1ec0ee0b6
      //   e57449e456a6333feeb5922e8f9952f2 8dcb17717fe0ef37402dad10647060b9
      //   785c53ea495d23afe4b7182a3d7fb64d 3cd8790c175bf64f9486a3c98291c84a
      // with tweak octet 01, and squaring that root modulo n and negating it
      // reproduces an encoded block that opens with 6A, closes with CC and
      // carries "Hello World" at the length its own length field states.
      this.tests = [
        {
          text: "Rabin-Williams Round-trip Test - IEEE P1363 Compliance",
          uri: "http://cr.yp.to/sigs/rwsota-20080131.pdf",
          input: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64"), // "Hello World"
          key: OpCodes.Hex8ToBytes("0400"), // 1024-bit key
          expected: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64") // Same as input - round-trip test validates this
        },
        {
          text: "Rabin-Williams-2048 recovery of a message with leading zero octets",
          uri: "https://github.com/weidai11/cryptopp/blob/master/rw.cpp",
          input: OpCodes.Hex8ToBytes("0000000102030405"),
          key: OpCodes.Hex8ToBytes("0800"), // 2048-bit demonstration key
          expected: OpCodes.Hex8ToBytes("0000000102030405")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for verification, false for signing
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RabinWilliamsInstance(this, isInverse);
    }
  }

  /**
 * RabinWilliams instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class RabinWilliamsInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Verification mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.keySize = 1024;
      this._publicKey = null;
      this._privateKey = null;
      this.inputBuffer = [];
      this._keyData = null;
    }

    // Property setters/getters for compatibility
    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._keyData;
    }

    set publicKey(keyData) {
      this._publicKey = keyData ? keyData : null;
    }

    get publicKey() {
      return this._publicKey;
    }

    set privateKey(keyData) {
      this._privateKey = keyData ? keyData : null;
    }

    get privateKey() {
      return this._privateKey;
    }

    // Initialize Rabin-Williams with specified key size
    Init(keySize) {
      if (!SUPPORTED_KEY_SIZES.includes(keySize)) {
        throw new Error('Rabin-Williams: no demonstration key of ' + keySize + ' bits. Use ' + SUPPORTED_KEY_SIZES.join(' or ') + ', or set publicKey/privateKey directly.');
      }

      this.keySize = keySize;
      return true;
    }

    // Feed data for processing
    /**
   * Feed data to the scheme for processing
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data.charCodeAt(i) % 256);
      } else if (data && typeof data.length === 'number') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
      } else {
        this.inputBuffer.push(data);
      }
    }

    // Get result (signature generation / verification with recovery)
    /**
   * Get result: a signature, or the message recovered from one
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, or the input does not fit the modulus
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      try {
        const result = this.isInverse
          ? this._verify(this.inputBuffer)
          : this._sign(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw error;
      }
    }

    // Set up keys
    KeySetup(keyData) {
      this._keyData = keyData;

      this.Init(parseKeySize(keyData));

      const material = RW_KEYS[this.keySize];
      const n = hexToBigInt(material.n);

      this._publicKey = {
        n: n,
        keySize: this.keySize
      };

      this._privateKey = {
        n: n,
        p: hexToBigInt(material.p),
        q: hexToBigInt(material.q),
        u: hexToBigInt(material.u),
        keySize: this.keySize
      };
    }

    /**
     * Number of octets in the modulus.
     * @param {BigInt} n - Modulus
     * @returns {number} Octet length
     */
    _modulusLength(n) {
      let octets = 0;
      let value = n;
      while (value > 0n) {
        value = value / 256n;
        ++octets;
      }
      return octets;
    }

    /**
     * The public function: reconstruct the message representative from a root
     * and the tweak that accompanied it.
     * @param {BigInt} s - Signature root
     * @param {number} tweak - One of the TWEAK_ constants
     * @returns {BigInt} Message representative x
     */
    _applyFunction(s, tweak) {
      const { n } = this._publicKey;
      const u = (s * s) % n;

      switch (tweak) {
        case TWEAK_PLAIN:
          return u;
        case TWEAK_NEGATED:
          return (n - u) % n;
        case TWEAK_DOUBLED:
          return (2n * u) % n;
        case TWEAK_NEG_DOUBLED:
          return (n - (2n * u) % n) % n;
        default:
          throw new Error('Rabin-Williams: verification failed - unknown tweak ' + tweak);
      }
    }

    /**
     * Sign a message, producing a root and the tweak needed to recover it.
     *
     * With p congruent 3 and q congruent 7 modulo 8, the multiplier 2 is a
     * non-residue modulo p and a residue modulo q while -1 is a non-residue
     * modulo both, so the four candidates x, -x, x/2 and -x/2 realise all four
     * combinations of Jacobi symbols and exactly one of them is a square
     * modulo n. That is the whole of the Rabin-Williams tweak.
     *
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} Signature: the root in k octets followed by the tweak
     */
    _sign(message) {
      if (!this._privateKey) {
        throw new Error('Rabin-Williams private key not set. Assign a key first.');
      }

      const { n, p, q, u } = this._privateKey;
      const k = this._modulusLength(n);

      const x = OS2IP(encodeForRecovery(message, k - 1));
      if (x === 0n || x >= n) {
        throw new Error('Rabin-Williams: message representative out of range');
      }

      // Pick the candidate that is a square modulo both primes
      const halfOfN = NumberTheory.modInverse(2n, n);
      const candidates = [
        { value: x, tweak: TWEAK_PLAIN },
        { value: (n - x) % n, tweak: TWEAK_NEGATED },
        { value: (x * halfOfN) % n, tweak: TWEAK_DOUBLED },
        { value: ((n - x) % n * halfOfN) % n, tweak: TWEAK_NEG_DOUBLED }
      ];

      let chosen = null;
      for (let i = 0; i < candidates.length; ++i) {
        const value = candidates[i].value;
        if (NumberTheory.jacobi(value, p) === 1 && NumberTheory.jacobi(value, q) === 1) {
          chosen = candidates[i];
          break;
        }
      }

      if (!chosen) {
        throw new Error('Rabin-Williams: no quadratic residue among the four tweaks; representative shares a factor with n');
      }

      // Blinding: work on w * r^2 and divide the root by r afterwards. The
      // blinding factor is a square, so it changes neither Jacobi symbol.
      let blind;
      let blindInverse;
      for (;;) {
        blind = NumberTheory.randomBigInt(1n, n - 1n);
        try {
          blindInverse = NumberTheory.modInverse(blind, n);
          break;
        } catch (e) {
          // blind shares a factor with n; draw again
        }
      }

      const blinded = (chosen.value * ((blind * blind) % n)) % n;

      // Square roots modulo each prime, both congruent 3 modulo 4
      const rootP = NumberTheory.squareRoot3Mod4(blinded % p, p);
      const rootQ = NumberTheory.squareRoot3Mod4(blinded % q, q);

      // All four roots modulo n, unblinded. Taking the smallest makes the
      // signature canonical, so it does not depend on the blinding factor.
      let root = null;
      for (const signP of [rootP, (p - rootP) % p]) {
        for (const signQ of [rootQ, (q - rootQ) % q]) {
          const combined = NumberTheory.crt(signP, p, signQ, q, u) % n;
          const unblinded = (combined * blindInverse) % n;
          if (root === null || unblinded < root) {
            root = unblinded;
          }
        }
      }

      // The relation the verifier will check
      if (this._applyFunction(root, chosen.tweak) !== x) {
        throw new Error('Rabin-Williams: signature generation failed its own consistency check');
      }

      const signature = I2OSP(root, k);
      signature.push(chosen.tweak);
      return signature;
    }

    /**
     * Verify a signature and recover the message it carries.
     * @param {uint8[]} signature - Root in k octets followed by the tweak
     * @returns {uint8[]} Recovered message octets
     */
    _verify(signature) {
      if (!this._publicKey) {
        throw new Error('Rabin-Williams public key not set. Assign a key first.');
      }

      const { n } = this._publicKey;
      const k = this._modulusLength(n);

      if (signature.length !== k + 1) {
        throw new Error('Rabin-Williams: verification failed - signature is ' + signature.length + ' bytes, expected ' + (k + 1));
      }

      const root = OS2IP(signature.slice(0, k));
      if (root >= n) {
        throw new Error('Rabin-Williams: verification failed - root out of range');
      }

      const x = this._applyFunction(root, signature[k]);

      return decodeFromRecovery(I2OSP(x, k - 1));
    }

    // Clear sensitive data
    ClearData() {
      if (this._privateKey) {
        this._privateKey.p = 0n;
        this._privateKey.q = 0n;
        this._privateKey.u = 0n;
        this._privateKey = null;
      }
      this._publicKey = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RabinWilliamsSignature();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RabinWilliamsSignature, RabinWilliamsInstance, NumberTheory, I2OSP, OS2IP };
}));
