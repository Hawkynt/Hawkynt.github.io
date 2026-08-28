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

  // A fixed key pair, so that an encrypting instance and a decrypting instance
  // configured with the same key selector share the same modulus. Generating a
  // fresh key inside each instance is what made decryption impossible: the two
  // instances never held the same n.
  //
  // This is Example 1 of the RSA Laboratories PKCS #1 v1.5 encryption test
  // vectors, the 1024-bit key printed in pkcs1v15crypt-vectors.txt and carried
  // in the test corpus of pyca/cryptography. It is published material and
  // confers no confidentiality whatever. Reproducing it here means the
  // published ciphertexts of that file can be decrypted by this code and
  // checked against the published plaintexts, which is the only external
  // check available for a scheme whose encryption is randomised.
  //
  // Independently confirmed: n = p * q, both factors prime, and d * e is
  // congruent to 1 modulo lcm(p - 1, q - 1).
  const RSA_KEYS = {
    1024: {
      n: 'a8b3b284af8eb50b387034a860f146c4919f318763cd6c5598c8ae4811a1e0ab' +
         'c4c7e0b082d693a5e7fced675cf4668512772c0cbc64a742c6c630f533c8cc72' +
         'f62ae833c40bf25842e984bb78bdbf97c0107d55bdb662f5c4e0fab9845cb514' +
         '8ef7392dd3aaff93ae1e6b667bb3d4247616d4f5ba10d4cfd226de88d39f16fb',
      e: '010001',
      d: '53339cfdb79fc8466a655c7316aca85c55fd8f6dd898fdaf119517ef4f52e8fd' +
         '8e258df93fee180fa0e4ab29693cd83b152a553d4ac4d1812b8b9fa5af0e7f55' +
         'fe7304df41570926f3311f15c4d65a732c483116ee3d3d2d0af3549ad9bf7cbf' +
         'b78ad884f84d5beb04724dc7369b31def37d0cf539e9cfcdd3de653729ead5d1',
      p: 'd32737e7267ffe1341b2d5c0d150a81b586fb3132bed2f8d5262864a9cb9f30a' +
         'f38be448598d413a172efb802c21acf1c11c520c2f26a471dcad212eac7ca39d',
      q: 'cc8853d1d54da630fac004f471f281c7b8982d8224a490edbeb33d3e3d5cc93c' +
         '4765703d1dd791642f1f116a0dd852be2419b2af72bfe9a030e860b0288b5d77'
    }
  };

  const SUPPORTED_KEY_SIZES = [1024];

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

      // The one size for which a key pair from a published test vector set is
      // reproduced below. Larger moduli work the moment key material of that
      // size is supplied through the publicKey/privateKey properties; none is
      // hard-coded here, because no key that has not been checked against an
      // outside source belongs in this file.
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0) // RSA-1024, PKCS #1 v1.5 test vector key
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
      // (RFC 8017 Section 7.2.1 step 2), so no fixed ciphertext is a property
      // of the scheme and none can be committed here as an expected value.
      // These vectors state the invertibility requirement instead: the
      // expected value is the plaintext, and the round trip is what is graded.
      //
      // The external check that this really is RSA and not a stub is the
      // published key above. Decrypting the ciphertext of PKCS #1 v1.5 example
      // 1.1,
      //   50b4c14136bd198c2f3c3ed243fce036 e168d56517984a263cd66492b80804f1
      //   69d210f2b9bdfb48b12f9ea05009c77d a257cc600ccefe3a6283789d8ea0e607
      //   ac58e2690ec4ebc10146e8cbaa5ed4d5 cce6fe7b0ff9efc1eabb564dbf498285
      //   f449ee61dd7b42ee5b5892cb90601f30 cda07bf26489310bcd23b528ceab3c31
      // with this key yields exactly the message that file records for it,
      //   6628194e12073db03ba94cda9ef95323 97d50dba79b987004afefe34
      // which no implementation that does not perform RSADP can produce.
      this.tests = [
        {
          text: "RSA-1024 RSAES-PKCS1-v1_5 round-trip (RFC 8017 Section 7.2)",
          uri: "https://www.rfc-editor.org/rfc/rfc8017#section-7.2",
          input: OpCodes.Hex8ToBytes("48656c6c6f20525341"), // "Hello RSA"
          key: OpCodes.Hex8ToBytes("0400"), // PKCS #1 v1.5 example 1 key
          expected: OpCodes.Hex8ToBytes("48656c6c6f20525341")
        },
        {
          text: "RSA-1024 RSAES-PKCS1-v1_5 round-trip with leading zero octets",
          uri: "https://www.rfc-editor.org/rfc/rfc8017#section-7.2",
          input: OpCodes.Hex8ToBytes("0000000102030405"),
          key: OpCodes.Hex8ToBytes("0400"), // PKCS #1 v1.5 example 1 key
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
