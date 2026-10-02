/*
 * ElGamal Implementation
 * ElGamal public key cryptosystem based on discrete logarithm problem
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Encryption follows the original scheme, restated as Algorithm 8.18 in the
 * Handbook of Applied Cryptography:
 *   c1 = g^k mod p,  c2 = m * y^k mod p   with k drawn afresh per message
 *   m  = c2 * (c1^x)^-1 mod p
 * The message is carried in an EME-PKCS1-v1_5 block (RFC 8017 Section 7.2.1)
 * so that its length and any leading zero octets survive the integer round
 * trip. The groups are the published MODP groups of RFC 3526.
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

  // ===== BIGINT AND OCTET-STRING UTILITIES =====

  /**
   * Parse a hexadecimal literal into a BigInt.
   * @param {string} hex - Hexadecimal digits, no prefix
   * @returns {BigInt} Parsed value
   */
  function hexToBigInt(hex) {
    /** @type {BigInt} */
    let value = 0n;
    for (let i = 0; i < hex.length; ++i) {
      /** @type {int32} */
      const digit = parseInt(hex.charAt(i), 16);
      value = value * 16n + BigInt(digit);
    }
    return value;
  }

  /**
   * OS2IP - Octet string to non-negative integer (RFC 8017 Section 4.2)
   * @param {uint8[]} octets - Big-endian octet string
   * @returns {BigInt} Corresponding integer
   */
  function OS2IP(octets) {
    /** @type {BigInt} */
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
   * @param {int32} xLen - Intended length of the octet string
   * @returns {uint8[]} Big-endian octet string of exactly xLen bytes
   */
  function I2OSP(value, xLen) {
    if (value < 0n) {
      throw new Error('I2OSP: integer must be non-negative');
    }

    /** @type {uint8[]} */
    const octets = new Array(xLen);
    let remaining = value;
    for (let i = xLen - 1; i >= 0; --i) {
      /** @type {uint8} */
      const octet = Number(remaining % 256n);
      octets[i] = octet;
      remaining = remaining / 256n;
    }

    if (remaining !== 0n) {
      throw new Error('I2OSP: integer too large for ' + xLen + ' octets');
    }

    return octets;
  }

  /**
   * Modular exponentiation using square and multiply.
   * @param {BigInt} base - Base value
   * @param {BigInt} exponent - Exponent
   * @param {BigInt} modulus - Modulus
   * @returns {BigInt} base^exponent mod modulus
   */
  function modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

    /** @type {BigInt} */
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;

    while (e > 0n) {
      if (e % 2n === 1n) {
        result = (result * b) % modulus;
      }
      e = e / 2n;
      b = (b * b) % modulus;
    }

    return result;
  }

  /**
   * Modular multiplicative inverse using the extended Euclidean algorithm.
   * @param {BigInt} a - Value to invert
   * @param {BigInt} m - Modulus
   * @returns {BigInt} a^-1 mod m
   */
  function modInverse(a, m) {
    let oldR = ((a % m) + m) % m;
    let r = m;
    /** @type {BigInt} */
    let oldS = 1n;
    /** @type {BigInt} */
    let s = 0n;

    while (r !== 0n) {
      const quotient = oldR / r;
      const tmpR = oldR - quotient * r;
      oldR = r;
      r = tmpR;
      const tmpS = oldS - quotient * s;
      oldS = s;
      s = tmpS;
    }

    if (oldR !== 1n) {
      throw new Error('ElGamal: value is not invertible modulo p');
    }

    return ((oldS % m) + m) % m;
  }

  /**
   * Draw a random integer in [min, max].
   * @param {BigInt} min - Lower bound, inclusive
   * @param {BigInt} max - Upper bound, inclusive
   * @returns {BigInt} Random value in range
   */
  function randomBigInt(min, max) {
    const range = max - min + 1n;
    /** @type {string} */
    const rangeHex = range.toString(16);
    const octets = Math.ceil(rangeHex.length / 2) + 8;

    // Sampling one extra byte beyond the range and reducing keeps the bias
    // below any practically detectable level while avoiding a rejection loop.
    const value = OS2IP(OpCodes.SecureRandomBytes(octets));
    return min + (value % range);
  }

  /**
   * Generate a padding string of pseudo-randomly chosen non-zero octets
   * (RFC 8017 Section 7.2.1 step 2).
   * @param {int32} count - Length of the padding string
   * @returns {uint8[]} Non-zero octets
   */
  function nonZeroPadding(count) {
    /** @type {uint8[]} */
    const padding = new Array(count);
    let produced = 0;

    while (produced < count) {
      const candidates = OpCodes.SecureRandomBytes(count - produced);
      for (let i = 0; i < candidates.length && produced < count; ++i) {
        if (candidates[i] !== 0) {
          padding[produced] = candidates[i];
          ++produced;
        }
      }
    }

    return padding;
  }

  /**
   * EME-PKCS1-v1_5 encoding (RFC 8017 Section 7.2.1 steps 1-2)
   * @param {uint8[]} message - Message octets
   * @param {int32} emLen - Length of the encoded message
   * @returns {uint8[]} Encoded message of exactly emLen octets
   */
  function emeEncode(message, emLen) {
    if (message.length > emLen - 11) {
      throw new Error('ElGamal: message too long (' + message.length + ' bytes, maximum ' + (emLen - 11) + ')');
    }

    const padding = nonZeroPadding(emLen - message.length - 3);
    /** @type {uint8[]} */
    const encoded = new Array(emLen);
    encoded[0] = 0x00;
    encoded[1] = 0x02;

    for (let i = 0; i < padding.length; ++i) {
      encoded[2 + i] = padding[i];
    }

    encoded[2 + padding.length] = 0x00;

    for (let i = 0; i < message.length; ++i) {
      encoded[3 + padding.length + i] = message[i];
    }

    return encoded;
  }

  /**
   * EME-PKCS1-v1_5 decoding (RFC 8017 Section 7.2.2 step 3)
   * @param {uint8[]} encoded - Encoded message
   * @returns {uint8[]} Recovered message octets
   */
  function emeDecode(encoded) {
    if (encoded.length < 11 || encoded[0] !== 0x00 || encoded[1] !== 0x02) {
      throw new Error('ElGamal: decryption error - malformed encoded message');
    }

    let separator = -1;
    for (let i = 2; i < encoded.length; ++i) {
      if (encoded[i] === 0x00) {
        separator = i;
        break;
      }
    }

    if (separator < 10) {
      throw new Error('ElGamal: decryption error - padding string too short');
    }

    return encoded.slice(separator + 1);
  }

  // ===== DEMONSTRATION KEY MATERIAL =====

  // The moduli are the published MODP groups of RFC 3526 with generator 2:
  // group 5 (1536 bit) and group 14 (2048 bit). Both are safe primes, so the
  // generator spans a subgroup of prime order (p - 1) / 2.
  //
  // The private exponent x is printed here in full and is therefore
  // demonstration material only, never a secret. What matters for correctness
  // is that it is fixed: an instance that encrypts and an instance that
  // decrypts must agree on y and x, and a key generated per instance never can.
  /** @type {int32[]} */
  const SUPPORTED_KEY_SIZES = [1536, 2048];

  // Group and key columns, one entry per size of SUPPORTED_KEY_SIZES.
  /** @type {string[]} */
  const ELGAMAL_KEYS_P = [
    'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
    '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
    '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
    'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
    '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
    '9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
    '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
    '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
    'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
    '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
    '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
    'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
    '3995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF'
  ];
  /** @type {string[]} */
  const ELGAMAL_KEYS_G = [
    '02',
    '02'
  ];
  /** @type {string[]} */
  const ELGAMAL_KEYS_X = [
    '2bbe1f724b173fac2786b5688eef84f57fe15f7920fad88287fb6ceb70165a26',
    'dae9fa2100bbbb5eecdf258cb9957d07e5c509e0c31fb45db84cb3a4ca3a0d36'
  ];
  /** @type {string[]} */
  const ELGAMAL_KEYS_Y = [
    'ea98fc68f7f84684154fb3e875c29cee444a1577be29aa879743e03d26d8dd76' +
    '772956f7802456b1c0027fb99bf7402238745b5ea12f50587ec7ed33c48955eb' +
    '3112a762aa310465c878c92610532186dfffdfce9af276846de4c830d0d720e1' +
    '13265f206f50489be63574ae11f71f64cfdd19d2d897d306598cd76034327381' +
    '817f182e2a42a71145c756ac554fe740e4de0ee2529556a77b13bea0ad9e0041' +
    '08183bccea2e1891a5fe0a5c5c42a231ccd5d5df4ecbc372a4e329479f4dbed6',
    'ae132bcf91859e8020441a6ccdf18948f04c7d00d1a5f283b56aa7a7bd2c1428' +
    'd5122d4500460feebfd23990178de9fd14afe2c6a0c1be17e5033b1707f3d8ef' +
    '25c07eea50ef3bdab6b402233858ee4f5922b879892aebb5653f6286f8ec65de' +
    '6f50a736191004c8c291b1c9616fb51f970a774d82f745cef41fdd64a8b76373' +
    'be679531f7805aff3d8807d0110c18640877e647477fdb92d576d0e1ec290eaa' +
    'c0b7d258f3817152f496724ce72e14e722dcae213c7aaa797640ef2056ca2a38' +
    '36579374c0d02029cda6ff750034e87008051748a5cae852035fe5440d55a778' +
    'c8494b77305690bb0d2c67718a5ea84e760810a37ba7d759c3ef320acf827a04'
  ];

  /**
   * Read a key size selector. Both spellings used across this collection are
   * accepted: decimal digits in ASCII, and a big-endian 16-bit count of bits.
   * A size in bits is passed to Init directly.
   * @param {uint8[]} keyData - Key selector octets
   * @returns {int32} Key size in bits
   */
  function parseKeySize(keyData) {
    if (keyData) {
      /** @type {uint8[]} */
      const bytes = keyData;
      let digits = '';
      let allDigits = bytes.length > 0;
      for (let i = 0; i < bytes.length; ++i) {
        if (bytes[i] < 0x30 || bytes[i] > 0x39) {
          allDigits = false;
          break;
        }
        digits += String.fromCharCode(bytes[i]);
      }

      if (allDigits) {
        /** @type {int32} */
        const size = parseInt(digits, 10);
        return size;
      }

      if (bytes.length >= 2) {
        return OpCodes.Pack16BE(bytes[0], bytes[1]);
      }
    }

    throw new Error('ElGamal: unrecognised key selector');
  }

  /**
   * ElGamal public key: group (p, g) and y = g^x mod p
   */
  class ElGamalPublicKey {
    /**
     * @param {BigInt} p - Prime modulus
     * @param {BigInt} g - Generator
     * @param {BigInt} y - Public value g^x mod p
     * @param {int32} keySize - Modulus size in bits
     */
    constructor(p, g, y, keySize) {
      /** @type {BigInt} */
      this.p = p;
      /** @type {BigInt} */
      this.g = g;
      /** @type {BigInt} */
      this.y = y;
      /** @type {int32} */
      this.keySize = keySize;
    }
  }

  /**
   * ElGamal private key: the public key and the secret exponent x
   */
  class ElGamalPrivateKey {
    /**
     * @param {BigInt} p - Prime modulus
     * @param {BigInt} g - Generator
     * @param {BigInt} y - Public value g^x mod p
     * @param {BigInt} x - Secret exponent
     * @param {int32} keySize - Modulus size in bits
     */
    constructor(p, g, y, x, keySize) {
      /** @type {BigInt} */
      this.p = p;
      /** @type {BigInt} */
      this.g = g;
      /** @type {BigInt} */
      this.y = y;
      /** @type {BigInt} */
      this.x = x;
      /** @type {int32} */
      this.keySize = keySize;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ElGamalCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ElGamal";
      this.description = "ElGamal public key cryptosystem based on the discrete logarithm problem in finite fields. Provides semantic security through randomized encryption: every message is encrypted under a fresh ephemeral exponent. Uses the published MODP groups of RFC 3526 with EME-PKCS1-v1_5 message encoding.";
      this.inventor = "Taher ElGamal";
      this.year = 1985;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Public Key Cryptosystem";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata: the groups published below. Other groups
      // work the moment key material is supplied through the publicKey and
      // privateKey properties.
      this.SupportedKeySizes = [
        new KeySize(1536, 1536, 0), // RFC 3526 group 5
        new KeySize(2048, 2048, 0)  // RFC 3526 group 14
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Original ElGamal Paper (1985)", "https://link.springer.com/chapter/10.1007/3-540-39568-7_2"),
        new LinkItem("Handbook of Applied Cryptography - Chapter 8 (Algorithm 8.18)", "http://cacr.uwaterloo.ca/hac/about/chap8.pdf"),
        new LinkItem("RFC 3526 - More MODP Diffie-Hellman groups", "https://www.rfc-editor.org/rfc/rfc3526"),
        new LinkItem("RFC 8017 - PKCS #1 v2.2, EME-PKCS1-v1_5", "https://www.rfc-editor.org/rfc/rfc8017#section-7.2"),
        new LinkItem("Wikipedia - ElGamal encryption", "https://en.wikipedia.org/wiki/ElGamal_encryption")
      ];

      this.references = [
        new LinkItem("Crypto++ Source - elgamal.h", "https://github.com/weidai11/cryptopp/blob/master/elgamal.h"),
        new LinkItem("Crypto++ Source - elgamal.cpp", "https://github.com/weidai11/cryptopp/blob/master/elgamal.cpp"),
        new LinkItem("OpenSSL DH Implementation", "https://github.com/openssl/openssl/tree/master/crypto/dh")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Small Subgroup Attack",
          '',
          "Ensure prime p is a safe prime (p = 2q + 1 where q is prime) to prevent small subgroup attacks. The RFC 3526 groups used here are safe primes",
          "https://link.springer.com/chapter/10.1007/3-540-68339-9_3"),
        new Vulnerability("Chosen Ciphertext Attack",
          '',
          "Basic ElGamal is malleable and not CCA-secure: multiplying c2 by a constant multiplies the plaintext by it. Use a CCA-secure construction for production",
          "https://link.springer.com/chapter/10.1007/BFb0053428"),
        new Vulnerability("Published Demonstration Key",
          '',
          "The private exponent in this file is printed in the source and confers no confidentiality. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration",
          "https://www.rfc-editor.org/rfc/rfc3526")
      ];

      // Test vectors.
      //
      // ElGamal draws a fresh ephemeral exponent k for every message, so the
      // ciphertext pair is deliberately not a function of the plaintext alone
      // and no fixed ciphertext can be committed as an expected value. These
      // vectors state the invertibility requirement instead.
      //
      // The external check on the arithmetic is OpenSSL, reached through the
      // Diffie-Hellman interface over the same RFC 3526 groups. For both
      // groups it agrees that the published y is g^x mod p, and for a
      // ciphertext produced here it computes the same c1^x mod p that
      // decryption divides out, from which the message follows by a single
      // modular division. Neither of those numbers comes from this file.
      this.tests = [
        {
          text: "ElGamal over RFC 3526 group 5 - round-trip",
          uri: "http://cacr.uwaterloo.ca/hac/about/chap8.pdf",
          input: OpCodes.Hex8ToBytes("456c47616d616c2054657374"), // "ElGamal Test"
          key: OpCodes.Hex8ToBytes("0600"), // 1536-bit group
          expected: OpCodes.Hex8ToBytes("456c47616d616c2054657374")
        },
        {
          text: "ElGamal over RFC 3526 group 14 - round-trip with leading zero octets",
          uri: "https://www.rfc-editor.org/rfc/rfc3526#section-3",
          input: OpCodes.Hex8ToBytes("0000000102030405"),
          key: OpCodes.Hex8ToBytes("0800"), // 2048-bit group
          expected: OpCodes.Hex8ToBytes("0000000102030405")
        },
        {
          text: "ElGamal over RFC 3526 group 14 - round-trip of an all-zero message",
          uri: "https://www.rfc-editor.org/rfc/rfc3526#section-3",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0800"), // 2048-bit group
          expected: OpCodes.Hex8ToBytes("0000000000000000")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ElGamalInstance(this, isInverse);
    }
  }

  /**
 * ElGamal cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class ElGamalInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ElGamalCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {int32} */
      this.keySize = 2048; // Bit length of the prime modulus
      /** @type {ElGamalPublicKey|null} */
      this._publicKey = null;
      /** @type {ElGamalPrivateKey|null} */
      this._privateKey = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._keyData = null;
    }

    // Property setter for key (for test suite compatibility)
    /**
     * @param {uint8[]} keyData - Key size selector (see parseKeySize)
     */
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

    // Property setters/getters for public key
    /**
     * @param {ElGamalPublicKey|null} keyData - Public key, or null to clear it
     */
    set publicKey(keyData) {
      this._publicKey = keyData ? keyData : null;
    }

    /**
     * @returns {ElGamalPublicKey|null} Public key
     */
    get publicKey() {
      return this._publicKey;
    }

    // Property setters/getters for private key
    /**
     * @param {ElGamalPrivateKey|null} keyData - Private key, or null to clear it
     */
    set privateKey(keyData) {
      this._privateKey = keyData ? keyData : null;
    }

    /**
     * @returns {ElGamalPrivateKey|null} Private key
     */
    get privateKey() {
      return this._privateKey;
    }

    // Initialize ElGamal with specified key size
    /**
     * @param {int32} keySize - Modulus size in bits
     * @returns {boolean} True once the size is accepted
     */
    Init(keySize) {
      if (!SUPPORTED_KEY_SIZES.includes(keySize)) {
        throw new Error('ElGamal: no demonstration group of ' + keySize + ' bits. Use ' + SUPPORTED_KEY_SIZES.join(' or ') + ', or set publicKey/privateKey directly.');
      }

      this.keySize = keySize;
      return true;
    }

    // Feed data for processing
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (typeof data === 'string') {
        /** @type {string} */
        const text = data;
        for (let i = 0; i < text.length; ++i) this.inputBuffer.push(text.charCodeAt(i) % 256);
      } else if (data && typeof data.length === 'number') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
      } else {
        this.inputBuffer.push(data);
      }
    }

    // Get result (encryption/decryption)
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, or the message does not fit the group
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      try {
        const result = this.isInverse
          ? this._decrypt(this.inputBuffer)
          : this._encrypt(this.inputBuffer);

        return result;
      } finally {
        this.inputBuffer = [];
      }
    }

    // Set up keys
    /**
     * @param {uint8[]} keyData - Key size selector (see parseKeySize)
     */
    KeySetup(keyData) {
      this._keyData = keyData;

      this.Init(parseKeySize(keyData));

      const index = SUPPORTED_KEY_SIZES.indexOf(this.keySize);
      const p = hexToBigInt(ELGAMAL_KEYS_P[index]);
      const g = hexToBigInt(ELGAMAL_KEYS_G[index]);
      const y = hexToBigInt(ELGAMAL_KEYS_Y[index]);

      this._publicKey = new ElGamalPublicKey(p, g, y, this.keySize);

      this._privateKey = new ElGamalPrivateKey(p, g, y,
        hexToBigInt(ELGAMAL_KEYS_X[index]),
        this.keySize);
    }

    /**
     * Number of octets in the prime modulus.
     * @param {BigInt} p - Prime modulus
     * @returns {int32} Octet length
     */
    _modulusLength(p) {
      let octets = 0;
      let value = p;
      while (value > 0n) {
        value = value / 256n;
        ++octets;
      }
      return octets;
    }

    /**
     * ElGamal encryption (HAC Algorithm 8.18)
     *
     * The encoded message occupies one octet fewer than the modulus, which is
     * what guarantees its integer value stays below p.
     *
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} Ciphertext pair c1 || c2, each of k octets
     */
    _encrypt(message) {
      if (!this._publicKey) {
        throw new Error('ElGamal public key not set. Assign a key first.');
      }

      /** @type {BigInt} */
      const p = this._publicKey.p;
      /** @type {BigInt} */
      const g = this._publicKey.g;
      /** @type {BigInt} */
      const y = this._publicKey.y;
      const k = this._modulusLength(p);

      const encoded = emeEncode(message, k - 1);
      const m = OS2IP(encoded);

      // Ephemeral exponent, fresh for every message
      const ephemeral = randomBigInt(2n, p - 2n);

      const c1 = modPow(g, ephemeral, p);
      const c2 = (m * modPow(y, ephemeral, p)) % p;

      const c1Bytes = I2OSP(c1, k);
      const c2Bytes = I2OSP(c2, k);

      /** @type {uint8[]} */
      const out = new Array(2 * k);
      for (let i = 0; i < k; ++i) {
        out[i] = c1Bytes[i];
        out[k + i] = c2Bytes[i];
      }
      return out;
    }

    /**
     * ElGamal decryption (HAC Algorithm 8.18)
     * @param {uint8[]} ciphertext - Ciphertext pair c1 || c2
     * @returns {uint8[]} Recovered message octets
     */
    _decrypt(ciphertext) {
      if (!this._privateKey) {
        throw new Error('ElGamal private key not set. Assign a key first.');
      }

      /** @type {BigInt} */
      const p = this._privateKey.p;
      /** @type {BigInt} */
      const x = this._privateKey.x;
      const k = this._modulusLength(p);

      if (ciphertext.length !== 2 * k) {
        throw new Error('ElGamal: decryption error - ciphertext is ' + ciphertext.length + ' bytes, expected ' + (2 * k));
      }

      const c1 = OS2IP(ciphertext.slice(0, k));
      const c2 = OS2IP(ciphertext.slice(k));

      if (c1 >= p || c2 >= p) {
        throw new Error('ElGamal: decryption error - ciphertext component out of range');
      }

      // The shared secret is c1^x = g^(k*x) = y^k, the very factor encryption
      // multiplied into c2, so dividing it out leaves the message.
      const shared = modPow(c1, x, p);
      const m = (c2 * modInverse(shared, p)) % p;

      return emeDecode(I2OSP(m, k - 1));
    }

    // Clear sensitive data
    ClearData() {
      if (this._privateKey) {
        this._privateKey.x = 0n;
        this._privateKey = null;
      }
      this._publicKey = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ElGamalCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ElGamalCipher, ElGamalInstance, modPow, modInverse, I2OSP, OS2IP };
}));
