/*
 * RSA Implementation
 * RSA public key cryptosystem based on integer factorization hardness
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Primitives follow RFC 8017 (PKCS #1 v2.2):
 *   I2OSP  - Section 4.1
 *   OS2IP  - Section 4.2
 *   RSAEP  - Section 5.1.1   c = m^e mod n
 *   RSADP  - Section 5.1.2   m = c^d mod n
 *   EME-PKCS1-v1_5 encoding/decoding - Section 7.2.1 / 7.2.2
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

  // ===== INTEGER / OCTET-STRING PRIMITIVES (RFC 8017 Section 4) =====

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

  /**
   * Generate a padding string of pseudo-randomly chosen non-zero octets
   * (RFC 8017 Section 7.2.1 step 2).
   * @param {number} count - Length of the padding string
   * @returns {uint8[]} Non-zero octets
   */
  function nonZeroPadding(count) {
    const padding = new Array(count);
    let produced = 0;

    while (produced < count) {
      const candidates = randomBytes(count - produced);
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
   *
   * EM = 0x00 || 0x02 || PS || 0x00 || M, where PS holds at least eight
   * non-zero octets. The separator makes the message boundary explicit, so a
   * message that begins with zero octets survives the round trip untouched.
   *
   * @param {uint8[]} message - Message octets
   * @param {number} k - Length of the encoded message (modulus length in octets)
   * @returns {uint8[]} Encoded message of exactly k octets
   */
  function emeEncode(message, k) {
    if (message.length > k - 11) {
      throw new Error('RSA: message too long (' + message.length + ' bytes, maximum ' + (k - 11) + ')');
    }

    const padding = nonZeroPadding(k - message.length - 3);
    const encoded = new Array(k);
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
   * @param {uint8[]} encoded - Encoded message of k octets
   * @returns {uint8[]} Recovered message octets
   */
  function emeDecode(encoded) {
    if (encoded.length < 11 || encoded[0] !== 0x00 || encoded[1] !== 0x02) {
      throw new Error('RSA: decryption error - malformed encoded message');
    }

    let separator = -1;
    for (let i = 2; i < encoded.length; ++i) {
      if (encoded[i] === 0x00) {
        separator = i;
        break;
      }
    }

    if (separator < 0 || separator < 10) {
      throw new Error('RSA: decryption error - padding string too short');
    }

    return encoded.slice(separator + 1);
  }

  /**
   * Modular exponentiation by square and multiply.
   * @param {BigInt} base - Base value
   * @param {BigInt} exponent - Exponent
   * @param {BigInt} modulus - Modulus
   * @returns {BigInt} base^exponent mod modulus
   */
  function modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

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

  // ===== DEMONSTRATION KEY MATERIAL =====

  // Fixed key pairs so that an encrypting instance and a decrypting instance
  // configured with the same key selector share the same modulus. Generating a
  // fresh key inside each instance is what made decryption impossible: the two
  // instances never held the same n.
  //
  // These key pairs are published here in full and are therefore demonstration
  // material only, never a secret. Each was produced with a standard generator
  // and checked to satisfy n = p * q, both factors prime, and d * e congruent
  // to 1 modulo lcm(p - 1, q - 1).
  const RSA_KEYS = {
    1024: {
      n: 'dfd1c3f19b2a97f84863d81f392927669c90301997ecb9a78e45643b17ebe078' +
         'a7386ae9cb80387bb9fa84376acfe34b2efea22184fb0c61ef2002da8ed8ebc5' +
         '4825d2857f84f691fa9ed3f90736c333f5c3b78c0ab8cd32fa10b188f18bfe34' +
         '5be5614b72937b2b8fe971dc8e67d5b1a70fbbf48f8be5d7dc17918ec8465f17',
      e: '010001',
      d: 'db54f5beab3f1743c0b4cf52f1b209a17da5b2ed31bb52c8071cab37599ed60f' +
         '86573c36362d45acc1b8e49e65f6a917c14ad8d91e36e2908a440567e67a5eb7' +
         'd4fd59c9793f0434f3dc2f5c3923437fd4eed00ba907e894a1c6b00d4c0bd09a' +
         '4444cdb91f4d0badc786043f165b8a94291d0bb9da93621863df6166653d4169',
      p: 'fa1d74d1005052c79827808eb3def51c4485e39de39646142347530136f0424c' +
         'd359a72a589a212686fa25369bbc5afc21e0e9b755ab1f674b0472f2d315dc6d',
      q: 'e515eb71a3420f2a20739b1da9a5f85b5de7c2845e80f0be05de883eb1ed1788' +
         '67c58fc3e4e5f6994a1dd072d5ea5f5879437b5dc3752be1111c0706378b2f13'
    },
    2048: {
      n: 'b869f83079da0cb0ff18902982906add23b46c0699bc7bd20b367768752a76d2' +
         '887a0cd2049419c55a529a6b17da8bc2b914c0e1bdd4d119c9c9417d0f9f8d97' +
         'f1e1e61f45eb0e2fa9d1b017429e3dea1216a743b9e8b9368d993cd3e3427d41' +
         'f9c1983f0dc3a96bb01174fbdf75aae83264f2f324f44409db9821f56c689cbd' +
         '8997886ee16825b285e8af1411fbc2ef5a6200be60c80654eebe59eac4dd61de' +
         '380a8dfdd6caffcba159950eed46531e90e4d000fe7ae7c6aa6971e5f7ad5eaa' +
         '7306538d5a645ef88f76c27c16ac9aea160c5272bea3d43a9bdfd87b122b47d9' +
         '7160248fee5b331547afe45dbaf9d30780ed0ae8c6cef5e98f217e0aefbd6b71',
      e: '010001',
      d: '017f3ab88a04af1db0b46e5727ec2c31e75c4b943223498e06f1463eded49d6a' +
         '50194d8956e82cdd614252669426fe0372a52c7ba8a2d59fb3f7a24475a001f2' +
         '3dd06ba1cd5b7f1dfbeeebd304836c553e1858fb3fc317ddcd8074f1f36252c9' +
         'fa510bff57094392d0371410075c592ad15de86af8ddd2bf91bcc669cb9b7dca' +
         '3890a5f43dd28525d8e382553b33de08cdbb2f836374786cd79b3929d97e2461' +
         '56eafac2c477b64ce37ffd97df1e52a4b6524a752f0ac6bd31423f49a54a3e61' +
         '5550863ad66cba44891c0117a23d02bcce2b5c62387ce5886a2b270e5ebd1343' +
         '46f8e02a6ec49383327a6a722782cc0ecdd3feb93fb3d82666157d7988040511',
      p: 'd9530f4605ea9dc480a7ec8da971a2789aff1f301d110f2975f65c3c0209bb70' +
         '74ea707b719fd623bc80ca2d0cddbec10442f98d68fd33c80c49464ead75c219' +
         'cd8744e954b027ad5a611eb8aa7d9b8b58c343120e50fc7db494d3dc38936fd1' +
         'db444742a692d5a0eaf928f427c37d75e22c28af02e21af3d73e02fe10d510cb',
      q: 'd93b8fd445f370a7bf4e9bac2a6abc0cfee904e373e724bbd14a81fa79b01a2a' +
         'bb45cdc05c46b3f4052542497956688f21528ba2fb86785728fb55fd06e6ed9c' +
         '579c260ba5ac2efc96fd7b8439d40fd1caadd8b8cf8b9d5cce7a8c8ca9bd6085' +
         '8c6945931636e82669694b7fbb2ceaef07456e236cc85ad7c56a6e0c274dd933'
    }
  };

  const SUPPORTED_KEY_SIZES = [1024, 2048];

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

    throw new Error('RSA: unrecognised key selector');
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class RSACipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RSA";
      this.description = "RSA public key cryptosystem based on integer factorization hardness. First practical asymmetric encryption enabling secure communication without shared secrets. Implements the RSAEP and RSADP primitives with EME-PKCS1-v1_5 encoding from RFC 8017 over fixed demonstration key pairs.";
      this.inventor = "Ron Rivest, Adi Shamir, Leonard Adleman";
      this.year = 1977;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Public Key Cryptosystem";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata: the sizes for which a demonstration key
      // pair is published below. Larger moduli work the moment key material of
      // that size is supplied through the publicKey/privateKey properties.
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // RSA-1024 (deprecated, demonstration only)
        new KeySize(2048, 2048, 0)  // RSA-2048
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Original RSA Paper (1978)", "https://dl.acm.org/doi/10.1145/359340.359342"),
        new LinkItem("RFC 8017 - PKCS #1: RSA Cryptography Specifications Version 2.2", "https://www.rfc-editor.org/rfc/rfc8017"),
        new LinkItem("RFC 3447 - PKCS #1: RSA Cryptography Specifications Version 2.1", "https://tools.ietf.org/rfc/rfc3447.txt"),
        new LinkItem("NIST SP 800-56B - Key Establishment Using Integer Factorization", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Br2.pdf"),
        new LinkItem("Wikipedia - RSA (cryptosystem)", "https://en.wikipedia.org/wiki/RSA_(cryptosystem)")
      ];

      this.references = [
        new LinkItem("OpenSSL RSA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/rsa/rsa_lib.c"),
        new LinkItem("GnuPG RSA Implementation", "https://github.com/gpg/gnupg/blob/master/g10/pubkey-enc.c"),
        new LinkItem("Python cryptography library RSA", "https://github.com/pyca/cryptography/tree/main/src/cryptography/hazmat/primitives/asymmetric")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Bleichenbacher's Attack",
          '',
          "EME-PKCS1-v1_5 leaks whether a ciphertext decodes correctly. Use RSAES-OAEP (RFC 8017 Section 7.1) where an attacker can observe decryption failures",
          "https://link.springer.com/chapter/10.1007/BFb0055716"),
        new Vulnerability("Published Demonstration Keys",
          '',
          "The key pairs in this file are printed in the source and confer no confidentiality. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration",
          "https://www.rfc-editor.org/rfc/rfc8017")
      ];

      // Test vectors.
      //
      // RSAES-PKCS1-v1_5 draws a fresh padding string for every encryption
      // (RFC 8017 Section 7.2.1 step 2), so a fixed ciphertext is not a
      // property of the scheme and cannot be committed as an expected value.
      // These vectors state the invertibility requirement instead, the same
      // convention the other randomised public-key schemes here use: the
      // expected value is the plaintext, and the round trip is what is graded.
      this.tests = [
        {
          text: "RSA-1024 RSAES-PKCS1-v1_5 round-trip (RFC 8017 Section 7.2)",
          uri: "https://www.rfc-editor.org/rfc/rfc8017#section-7.2",
          input: OpCodes.Hex8ToBytes("48656c6c6f20525341"), // "Hello RSA"
          key: OpCodes.Hex8ToBytes("0400"), // 1024-bit demonstration key
          expected: OpCodes.Hex8ToBytes("48656c6c6f20525341")
        },
        {
          text: "RSA-2048 RSAES-PKCS1-v1_5 round-trip with leading zero octets",
          uri: "https://www.rfc-editor.org/rfc/rfc8017#section-7.2",
          input: OpCodes.Hex8ToBytes("0000000102030405"),
          key: OpCodes.Hex8ToBytes("0800"), // 2048-bit demonstration key
          expected: OpCodes.Hex8ToBytes("0000000102030405")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RSAInstance(this, isInverse);
    }
  }

  /**
 * RSA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class RSAInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.keySize = 2048;
      this._publicKey = null;
      this._privateKey = null;
      this.inputBuffer = [];
      this._keyData = null;
    }

    // Property setter for key (for test suite compatibility)
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

    // Property setters/getters for UI compatibility
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

    // Initialize RSA with specified key size
    Init(keySize) {
      if (!SUPPORTED_KEY_SIZES.includes(keySize)) {
        throw new Error('RSA: no demonstration key of ' + keySize + ' bits. Use ' + SUPPORTED_KEY_SIZES.join(' or ') + ', or set publicKey/privateKey directly.');
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
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data.charCodeAt(i) % 256);
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
   * @throws {Error} If key not set, or the message does not fit the modulus
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      try {
        const result = this.isInverse
          ? this._decrypt(this.inputBuffer)
          : this._encrypt(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw error;
      }
    }

    // Set up keys
    KeySetup(keyData) {
      this._keyData = keyData; // Store for getter

      this.Init(parseKeySize(keyData));

      const material = RSA_KEYS[this.keySize];
      const n = hexToBigInt(material.n);
      const e = hexToBigInt(material.e);

      this._publicKey = {
        n: n,
        e: e,
        keySize: this.keySize
      };

      this._privateKey = {
        n: n,
        e: e,
        d: hexToBigInt(material.d),
        p: hexToBigInt(material.p),
        q: hexToBigInt(material.q),
        keySize: this.keySize
      };
    }

    /**
     * Number of octets in the modulus, k in RFC 8017 terms.
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
     * RSAES-PKCS1-v1_5 encryption (RFC 8017 Section 7.2.1)
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} Ciphertext of exactly k octets
     */
    _encrypt(message) {
      if (!this._publicKey) {
        throw new Error('RSA public key not set. Assign a key first.');
      }

      const { n, e } = this._publicKey;
      const k = this._modulusLength(n);

      // Step 1-2: EME-PKCS1-v1_5 encoding
      const encoded = emeEncode(message, k);

      // Step 3a-3b: RSAEP, c = m^e mod n (Section 5.1.1)
      const m = OS2IP(encoded);
      if (m >= n) {
        throw new Error('RSA: encoded message representative out of range');
      }
      const c = modPow(m, e, n);

      // Step 3c: I2OSP back to k octets
      return I2OSP(c, k);
    }

    /**
     * RSAES-PKCS1-v1_5 decryption (RFC 8017 Section 7.2.2)
     * @param {uint8[]} ciphertext - Ciphertext of exactly k octets
     * @returns {uint8[]} Recovered message octets
     */
    _decrypt(ciphertext) {
      if (!this._privateKey) {
        throw new Error('RSA private key not set. Assign a key first.');
      }

      const { n, d } = this._privateKey;
      const k = this._modulusLength(n);

      // Step 1: length check
      if (ciphertext.length !== k) {
        throw new Error('RSA: decryption error - ciphertext is ' + ciphertext.length + ' bytes, expected ' + k);
      }

      // Step 2a-2b: RSADP, m = c^d mod n (Section 5.1.2)
      const c = OS2IP(ciphertext);
      if (c >= n) {
        throw new Error('RSA: decryption error - ciphertext representative out of range');
      }
      const m = modPow(c, d, n);

      // Step 2c and 3: I2OSP to k octets, then strip the encoding
      return emeDecode(I2OSP(m, k));
    }

    // Clear sensitive data
    ClearData() {
      if (this._privateKey) {
        this._privateKey.d = 0n;
        this._privateKey.p = 0n;
        this._privateKey.q = 0n;
        this._privateKey = null;
      }
      this._publicKey = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RSACipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RSACipher, RSAInstance, I2OSP, OS2IP, modPow };
}));
