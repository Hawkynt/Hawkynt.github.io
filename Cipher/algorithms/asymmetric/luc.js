/*
 * LUC (Lucas-based) Cryptosystem Implementation
 * LUC public key cryptosystem based on Lucas sequences
 * Compatible with AlgorithmFramework
 * Based on Crypto++ implementation by Wei Dai
 * Reference: "Digital signature schemes based on Lucas functions" by Patrick Horster, Markus Michels, Holger Petersen
 * (c)2006-2025 Hawkynt
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
          AsymmetricCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== LUCAS SEQUENCE MATHEMATICS =====

  /**
   * Calculate Lucas sequence V_e(p, 1) mod n using Montgomery representation
   * This is the core mathematical operation for LUC cryptosystem
   *
   * Lucas sequences V_n(p,q) are defined by:
   * V_0 = 2
   * V_1 = p
   * V_n = p*V_(n-1) - q*V_(n-2)
   *
   * For LUC, we use q=1, so: V_n = p*V_(n-1) - V_(n-2)
   *
   * @param {BigInt} e - The exponent
   * @param {BigInt} p - The Lucas parameter
   * @param {BigInt} n - The modulus
   * @returns {BigInt} Lucas value V_e(p, 1) mod n
   */
  function Lucas(e, p, n) {
    if (n <= 0n) {
      throw new Error('Modulus must be positive');
    }
    if (e === 0n) {
      return 2n; // V_0 = 2
    }

    // Reduce p modulo n
    p = ((p % n) + n) % n;

    // Binary method for Lucas sequence computation
    // Start from most significant bit
    let bitLength = e.toString(2).length;
    let v = p;           // V_1
    let v1 = (p * p - 2n) % n; // V_2 = p^2 - 2

    if (v1 < 0n) v1 += n;

    // Process remaining bits from second-most significant to least significant
    for (let i = bitLength - 2; i >= 0; i--) {
      if (OpCodes.AndN(OpCodes.ShiftRn(e, BigInt(i)), 1n)) {
        // Bit is 1: v_{2k+1} = v_k * v_{k+1} - p, v_{2k+2} = v_{k+1}^2 - 2
        let temp = (v * v1 - p) % n;
        if (temp < 0n) temp += n;
        v = temp;

        temp = (v1 * v1 - 2n) % n;
        if (temp < 0n) temp += n;
        v1 = temp;
      } else {
        // Bit is 0: v_{2k} = v_k^2 - 2, v_{2k+1} = v_k * v_{k+1} - p
        let temp = (v * v1 - p) % n;
        if (temp < 0n) temp += n;
        v1 = temp;

        temp = (v * v - 2n) % n;
        if (temp < 0n) temp += n;
        v = temp;
      }
    }

    return v;
  }

  /**
   * Calculate inverse Lucas: find x such that m = V_e(x, 1) mod (p*q)
   * Uses Chinese Remainder Theorem with primes p and q
   *
   * @param {BigInt} e - The exponent
   * @param {BigInt} m - The target Lucas value
   * @param {BigInt} p - First prime factor
   * @param {BigInt} q - Second prime factor
   * @param {BigInt} u - Inverse of p mod q (u = p^-1 mod q)
   * @returns {BigInt} Value x such that V_e(x, 1) = m mod (p*q)
   */
  function InverseLucas(e, m, p, q, u) {
    // Calculate discriminant d = m^2 - 4
    const d = m * m - 4n;

    // Calculate Jacobi symbol to determine the order
    const jacobiP = Jacobi(d, p);
    const jacobiQ = Jacobi(d, q);

    // Compute inverse exponents
    const t1 = p - BigInt(jacobiP);
    const invE_p = modInverse(e, t1);
    const p2 = Lucas(invE_p, m, p);

    const t2 = q - BigInt(jacobiQ);
    const invE_q = modInverse(e, t2);
    const q2 = Lucas(invE_q, m, q);

    // Use Chinese Remainder Theorem to combine results
    return CRT(p2, p, q2, q, u);
  }

  /**
   * Jacobi symbol calculation
   * @param {BigInt} a - First parameter
   * @param {BigInt} b - Second parameter (must be odd)
   * @returns {number} Jacobi symbol value (-1, 0, or 1)
   */
  function Jacobi(a, b) {
    if (b <= 0n || OpCodes.AndN(b, 1n) === 0n) {
      throw new Error('Jacobi: b must be positive and odd');
    }

    a = ((a % b) + b) % b;
    let result = 1;

    while (a !== 0n) {
      // Remove factors of 2
      let i = 0n;
      while (OpCodes.AndN(a, 1n) === 0n) {
        a = OpCodes.ShiftRn(a, 1n);
        i++;
      }

      // If removed odd number of 2s and b ≡ 3,5 (mod 8), flip sign
      if (OpCodes.AndN(i, 1n) === 1n) {
        const bMod8 = OpCodes.AndN(b, 7n);
        if (bMod8 === 3n || bMod8 === 5n) {
          result = -result;
        }
      }

      // Quadratic reciprocity: if both a,b ≡ 3 (mod 4), flip sign
      if (OpCodes.AndN(a, 3n) === 3n && OpCodes.AndN(b, 3n) === 3n) {
        result = -result;
      }

      // Swap and reduce
      [a, b] = [b, a];
      a = a % b;
    }

    return b === 1n ? result : 0;
  }

  /**
   * Chinese Remainder Theorem
   * Calculate x such that x ≡ xp (mod p) and x ≡ xq (mod q)
   *
   * @param {BigInt} xp - Value mod p
   * @param {BigInt} p - First modulus
   * @param {BigInt} xq - Value mod q
   * @param {BigInt} q - Second modulus
   * @param {BigInt} u - Inverse of p mod q
   * @returns {BigInt} Combined value x
   */
  function CRT(xp, p, xq, q, u) {
    // x = p * (u * (xq - xp) mod q) + xp
    let diff = ((xq - xp) % q + q) % q;
    let temp = (u * diff) % q;
    return p * temp + xp;
  }

  /**
   * Modular multiplicative inverse using Extended Euclidean Algorithm
   * @param {BigInt} a - Value to invert
   * @param {BigInt} m - Modulus
   * @returns {BigInt} Inverse of a modulo m
   */
  function modInverse(a, m) {
    a = ((a % m) + m) % m;

    let [oldR, r] = [a, m];
    let [oldS, s] = [1n, 0n];

    while (r !== 0n) {
      const quotient = oldR / r;
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }

    if (oldR !== 1n) {
      throw new Error('Modular inverse does not exist');
    }

    return ((oldS % m) + m) % m;
  }

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
   * LUC is an integer trapdoor of the same shape as RSA, and Crypto++ pairs it
   * with the same PKCS #1 encoding. The explicit separator octet is what lets a
   * message that begins with zero octets come back unchanged.
   *
   * @param {uint8[]} message - Message octets
   * @param {number} emLen - Length of the encoded message
   * @returns {uint8[]} Encoded message of exactly emLen octets
   */
  function emeEncode(message, emLen) {
    if (message.length > emLen - 11) {
      throw new Error('LUC: message too long (' + message.length + ' bytes, maximum ' + (emLen - 11) + ')');
    }

    const padding = nonZeroPadding(emLen - message.length - 3);
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
      throw new Error('LUC: decryption error - malformed encoded message');
    }

    let separator = -1;
    for (let i = 2; i < encoded.length; ++i) {
      if (encoded[i] === 0x00) {
        separator = i;
        break;
      }
    }

    if (separator < 10) {
      throw new Error('LUC: decryption error - padding string too short');
    }

    return encoded.slice(separator + 1);
  }

  // ===== DEMONSTRATION KEY MATERIAL =====

  // Fixed key pairs so that an encrypting instance and a decrypting instance
  // configured with the same key selector share the same modulus. The values
  // that stood here before were not a key at all: n was 123456789012345678901
  // 234567890 while p and q were 11111111111 and 11111111117, whose product is
  // a different number, and u was 1 rather than an inverse of anything.
  //
  // These key pairs are published here in full and are therefore demonstration
  // material only, never a secret. Each was produced with a standard generator
  // and checked to satisfy n = p * q, both factors prime, u * p congruent to 1
  // modulo q, and gcd(e, p^2 - 1) = gcd(e, q^2 - 1) = 1, which is the LUC key
  // condition that makes e invertible modulo p - (D/p) and q - (D/q) whichever
  // way the Jacobi symbols fall.
  const LUC_KEYS = {
    1024: {
      n: 'b49c852e399ebc43bad4149d5470fbccb896862285405ef16cbf73203dd73f34' +
         '01a2c61069938456974305f6b87bb91e88b36e020174f47735e1978d3d1f8073' +
         'dae83dd3f74b62f2d1d73144ccfe2f99bebd785009a1ab8a537bba4f1f3eb233' +
         '3bee012ef64aa0f308d3b8a7ec666e17fbea4f43c4635c491717078e80026019',
      e: '010001',
      p: 'c7aa501634fde3c768ca6eab1bc8ad69cd662fe7b78dffeb5e49cf42487cab60' +
         'c669b5a768b60a1fdbe1a842d3d63263ab30c29b02daef3c86cb27a4fae12669',
      q: 'e791f57705a7ba31ad18afe90d8ceb711c1d9506a0cfce7bfab5ccd8b586bccd' +
         '198069f704a6d6c13b1d66eb692ca19f41796cdcbadd9447b9588d09c3151631',
      u: '41bb3b62203c0c89af0407af5e7b9bedbbab825c5a42715fa6c1dcadc2fa93bc' +
         'db911a46c5edbc782ca3825fe79b4daa5e3e499cd2bb7140bf8b3e0bc795efa7'
    },
    2048: {
      n: 'e616b0b5a95bde1d001cc148d56f133afd54bb5dd62b9407f4a597acefd05ee4' +
         '07152ad0edbbe1b637a4b974befbfdd690b3541705f4a9301560692f1ec03b7c' +
         '35bdf2afeac3e504b9a6786db58bf2fc9afc2fc77762b5edc98a3c353b4f31e6' +
         '37a0433e66b16648c075743f8bfbe30560b5e6b88b53084a84a3be094e7ad66b' +
         '20e6cc313533b0b3ab96178eb53d9d4f2315fe3a94ac7145276c55b13231568f' +
         'af30e423ad4a4c998367b8acefd50d6d096da7c51e01f88f628101e416a1b2bf' +
         '4f1243442612f6252391dfebb0753146bb9feddc300f675e26551bdd77596074' +
         'f9fa9fdfceaf0b934b85d9f24877748045e1664e45ef3478dbaee430cf85d3e9',
      e: '010001',
      p: 'e837b7f02b2d95d4831258d22c6a0c0fc2b2920c0ef24d8dcaa867714b0dede8' +
         '4973de08b150c60bd6e72af3f86f6936d47b9d64b937422fe48a5ed976a8f90d' +
         'e10524bbc63eb34a1ecbf89955db200b19ff6f49d57742d41fc89934b207f494' +
         '833989192e3f181df0d7fcae9194c3d65a5f50710b6edab6b79c0f6bd566e335',
      q: 'fda7273922d23cc1d8306f7c1212d2782acadfa9eed486d74fad5ccdfe6e46f3' +
         'ca94705ccc568e163262d08b329938c5f2fa20979fc2b2784c56c5857936cadb' +
         '3bd00c9e3f791d2d592ef0fdf604bf7e8500329ea790678b87c2573f5bf18006' +
         '76129c4077b7f8f60bc5b6cd750b6e202cc879770b395c38c21799fb224b7065',
      u: '32152ae5bfd97411ab802b49a53e11183738655578c86585a0edddc6cca645a1' +
         '4353741692478cf40c2cdc2fe8771c04d56dbbaffa45f9a4860a7628b16bf835' +
         'b20ae4b1f2d8460b61a5846f012a20ae49e45a544fbc29ffaebd25b1280b7357' +
         'd5d3067dbc29d3b0316d60afa46b8fcd6037193caa5784703180a2091d99a62e'
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

    throw new Error('LUC: unrecognised key selector');
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LUCCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LUC";
      this.description = "LUC public key cryptosystem based on Lucas sequences over finite fields. Encryption is the Lucas function c = V_e(m, 1) mod n and recovery inverts it modulo each prime factor using the Jacobi symbol of the discriminant, then combines by CRT. Historical cryptosystem with no practical advantages over RSA but of pedagogical interest for Lucas function mathematics.";
      this.inventor = "Peter Smith, Michael Lennon";
      this.year = 1993;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Lucas-based Cryptosystem";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.GB;

      // Algorithm-specific metadata
      // The sizes for which a demonstration key pair is published below. Other
      // moduli work the moment key material is supplied through the publicKey
      // and privateKey properties.
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // Minimum
        new KeySize(2048, 2048, 0)  // Recommended
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Crypto++ LUC Implementation", "https://github.com/weidai11/cryptopp/blob/master/luc.h"),
        new LinkItem("LUC: A New Public Key System", "https://link.springer.com/chapter/10.1007/3-540-48329-2_25"),
        new LinkItem("Digital Signature Schemes Based on Lucas Functions", "https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=8a4c7b5e3e5d3e6f7a8b9c0d1e2f3a4b5c6d7e8f"),
        new LinkItem("Wikipedia - Lucas Sequence", "https://en.wikipedia.org/wiki/Lucas_sequence")
      ];

      this.references = [
        new LinkItem("Crypto++ Source - luc.cpp", "https://github.com/weidai11/cryptopp/blob/master/luc.cpp"),
        new LinkItem("Crypto++ Source - nbtheory.cpp (Lucas)", "https://github.com/weidai11/cryptopp/blob/master/nbtheory.cpp")
      ];

      // Test vectors.
      //
      // The PKCS #1 encoding draws a fresh padding string for every encryption
      // (RFC 8017 Section 7.2.1 step 2), so a fixed ciphertext is not a
      // property of the scheme and cannot be committed as an expected value.
      // These vectors state the invertibility requirement instead.
      this.tests = [
        {
          text: "LUC-1024 round-trip - c = V_e(m, 1) mod n recovered through InverseLucas",
          uri: "https://link.springer.com/chapter/10.1007/3-540-48329-2_25",
          input: OpCodes.Hex8ToBytes("74657374"), // "test"
          key: OpCodes.Hex8ToBytes("0400"), // 1024-bit demonstration key
          expected: OpCodes.Hex8ToBytes("74657374")
        },
        {
          text: "LUC-2048 round-trip with leading zero octets",
          uri: "https://github.com/weidai11/cryptopp/blob/master/luc.h",
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
      return new LUCInstance(this, isInverse);
    }
  }

  /**
 * LUC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LUCInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
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
      this._publicKey = keyData;
    }

    get publicKey() {
      return this._publicKey;
    }

    set privateKey(keyData) {
      this._privateKey = keyData;
    }

    get privateKey() {
      return this._privateKey;
    }

    // Initialize LUC with specified key size
    Init(keySize) {
      if (!SUPPORTED_KEY_SIZES.includes(keySize)) {
        throw new Error('LUC: no demonstration key of ' + keySize + ' bits. Use ' + SUPPORTED_KEY_SIZES.join(' or ') + ', or set publicKey/privateKey directly.');
      }

      this.keySize = keySize;
      return true;
    }

    // Feed data for processing
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
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
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      try {
        let result;
        if (this.isInverse) {
          result = this._decrypt(this.inputBuffer);
        } else {
          result = this._encrypt(this.inputBuffer);
        }

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

      const material = LUC_KEYS[this.keySize];
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
     * LUC encryption: c = V_e(m, 1) mod n
     *
     * The encoded message occupies one octet fewer than the modulus, which is
     * what guarantees its integer value stays below n.
     *
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} Ciphertext of exactly k octets
     */
    _encrypt(message) {
      if (!this._publicKey) {
        throw new Error('LUC public key not set. Assign a key first.');
      }

      const { n, e } = this._publicKey;
      const k = this._modulusLength(n);

      const encoded = emeEncode(message, k - 1);
      const m = OS2IP(encoded);

      return I2OSP(Lucas(e, m, n), k);
    }

    /**
     * LUC decryption: recover m from c = V_e(m, 1) mod n
     *
     * The discriminant of the ciphertext has the same quadratic character as
     * that of the plaintext, so the Jacobi symbols taken from c give the order
     * of the Lucas sequence modulo each prime, hence the inverse exponent.
     *
     * @param {uint8[]} ciphertext - Ciphertext of exactly k octets
     * @returns {uint8[]} Recovered message octets
     */
    _decrypt(ciphertext) {
      if (!this._privateKey) {
        throw new Error('LUC private key not set. Assign a key first.');
      }

      const { n, e, p, q, u } = this._privateKey;
      const k = this._modulusLength(n);

      if (ciphertext.length !== k) {
        throw new Error('LUC: decryption error - ciphertext is ' + ciphertext.length + ' bytes, expected ' + k);
      }

      const c = OS2IP(ciphertext);
      if (c >= n) {
        throw new Error('LUC: decryption error - ciphertext out of range');
      }

      const m = InverseLucas(e, c, p, q, u);

      return emeDecode(I2OSP(m, k - 1));
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

  const algorithmInstance = new LUCCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LUCCipher, LUCInstance, Lucas, InverseLucas, Jacobi, CRT, modInverse, I2OSP, OS2IP };
}));
