/*
 * Rabin Cryptosystem Implementation
 * Rabin public key cryptosystem based on quadratic residues
 * Compatible with AlgorithmFramework - uses JavaScript native BigInt
 * (c)2006-2025 Hawkynt
 *
 * Based on Crypto++ implementation by Wei Dai
 * Reference: rabin.h, rabin.cpp from Crypto++
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
          TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== NUMBER THEORY UTILITIES FOR RABIN =====

  const NumberTheory = {
    /**
     * Compute greatest common divisor using Euclidean algorithm
     * @param {BigInt} a - First number
     * @param {BigInt} b - Second number
     * @returns {BigInt} GCD of a and b
     */
    gcd: function(a, b) {
      a = a < 0n ? -a : a;
      b = b < 0n ? -b : b;
      while (b !== 0n) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    },

    /**
     * Extended Euclidean algorithm: find x, y such that ax + by = gcd(a,b)
     * @param {BigInt} a - First number
     * @param {BigInt} b - Second number
     * @returns {Object} {gcd, x, y}
     */
    extendedGcd: function(a, b) {
      if (b === 0n) {
        return { gcd: a, x: 1n, y: 0n };
      }

      const result = this.extendedGcd(b, a % b);
      const x = result.y;
      const y = result.x - (a / b) * result.y;

      return { gcd: result.gcd, x: x, y: y };
    },

    /**
     * Modular multiplicative inverse using extended Euclidean algorithm
     * @param {BigInt} a - Number to invert
     * @param {BigInt} m - Modulus
     * @returns {BigInt} Inverse of a mod m, or throws if not invertible
     */
    modInverse: function(a, m) {
      const result = this.extendedGcd(a, m);
      if (result.gcd !== 1n) {
        throw new Error('Modular inverse does not exist');
      }
      // Ensure positive result
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
      base = base % m;

      while (exp > 0n) {
        if (exp % 2n === 1n) {
          result = (result * base) % m;
        }
        exp = exp >> 1n;
        base = (base * base) % m;
      }

      return result;
    },

    /**
     * Compute Jacobi symbol (a/n)
     * For Rabin, we need Jacobi symbol to determine quadratic residues
     * @param {BigInt} a - Upper value
     * @param {BigInt} n - Lower value (must be odd)
     * @returns {number} -1, 0, or 1
     */
    jacobi: function(a, n) {
      if (n <= 0n || n % 2n === 0n) {
        throw new Error('Jacobi symbol: n must be odd and positive');
      }

      a = a % n;
      let result = 1;

      while (a !== 0n) {
        // Remove factors of 2
        while (a % 2n === 0n) {
          a = a / 2n;
          const nMod8 = Number(n % 8n);
          if (nMod8 === 3 || nMod8 === 5) {
            result = -result;
          }
        }

        // Swap a and n
        const temp = a;
        a = n;
        n = temp;

        // Quadratic reciprocity
        if (a % 4n === 3n && n % 4n === 3n) {
          result = -result;
        }

        a = a % n;
      }

      return n === 1n ? result : 0;
    },

    /**
     * Tonelli-Shanks algorithm for computing modular square root
     * Find x such that x^2 ≡ n (mod p) where p is prime
     * @param {BigInt} n - Number to find square root of
     * @param {BigInt} p - Prime modulus
     * @returns {BigInt} Square root of n mod p
     */
    modularSquareRoot: function(n, p) {
      // Special case: p ≡ 3 (mod 4)
      if (p % 4n === 3n) {
        return this.modExp(n, (p + 1n) / 4n, p);
      }

      // Tonelli-Shanks for p ≡ 1 (mod 4)
      // Factor p-1 = 2^s * q with q odd
      let s = 0n;
      let q = p - 1n;
      while (q % 2n === 0n) {
        q = q / 2n;
        s = s + 1n;
      }

      // Find a quadratic non-residue z
      let z = 2n;
      while (this.jacobi(z, p) !== -1) {
        z = z + 1n;
      }

      let m = s;
      let c = this.modExp(z, q, p);
      let t = this.modExp(n, q, p);
      let r = this.modExp(n, (q + 1n) / 2n, p);

      while (t !== 1n) {
        // Find least i such that t^(2^i) = 1
        let i = 1n;
        let temp = (t * t) % p;
        while (temp !== 1n && i < m) {
          temp = (temp * temp) % p;
          i = i + 1n;
        }

        // Update values
        const b = this.modExp(c, this.modExp(2n, m - i - 1n, p - 1n), p);
        m = i;
        c = (b * b) % p;
        t = (t * c) % p;
        r = (r * b) % p;
      }

      return r;
    },

    /**
     * Chinese Remainder Theorem: solve x ≡ a1 (mod n1), x ≡ a2 (mod n2)
     * @param {BigInt} a1 - First remainder
     * @param {BigInt} n1 - First modulus
     * @param {BigInt} a2 - Second remainder
     * @param {BigInt} n2 - Second modulus
     * @param {BigInt} u - Precomputed n2^(-1) mod n1
     * @returns {BigInt} Solution x
     */
    crt: function(a1, n1, a2, n2, u) {
      // x = a2 + n2 * ((a1 - a2) * u mod n1)
      const diff = ((a1 - a2) % n1 + n1) % n1;
      const mult = (diff * u) % n1;
      return a2 + n2 * mult;
    },

    /**
     * Miller-Rabin primality test (simplified)
     * @param {BigInt} n - Number to test
     * @param {number} k - Number of rounds (higher = more accurate)
     * @returns {boolean} True if probably prime
     */
    isProbablyPrime: function(n, k = 20) {
      if (n === 2n || n === 3n) return true;
      if (n < 2n || n % 2n === 0n) return false;

      // Write n-1 as 2^r * d
      let r = 0n;
      let d = n - 1n;
      while (d % 2n === 0n) {
        r = r + 1n;
        d = d / 2n;
      }

      // Witness loop
      for (let i = 0; i < k; ++i) {
        // Pick random witness a in [2, n-2]
        const a = this._randomBigInt(2n, n - 2n);

        let x = this.modExp(a, d, n);

        if (x === 1n || x === n - 1n) continue;

        let continueWitnessLoop = false;
        for (let j = 0n; j < r - 1n; ++j) {
          x = (x * x) % n;
          if (x === n - 1n) {
            continueWitnessLoop = true;
            break;
          }
        }

        if (continueWitnessLoop) continue;

        return false; // Composite
      }

      return true; // Probably prime
    },

    /**
     * Generate random BigInt in range [min, max]
     * @param {BigInt} min - Minimum value
     * @param {BigInt} max - Maximum value
     * @returns {BigInt} Random value
     */
    _randomBigInt: function(min, max) {
      const range = max - min + 1n;
      const bits = range.toString(2).length;

      let result;
      do {
        result = 0n;
        for (let i = 0; i < bits; ++i) {
          result = (result << 1n) | BigInt(Math.random() < 0.5 ? 0 : 1);
        }
      } while (result >= range);

      return min + result;
    },

    /**
     * Generate random prime p ≡ 3 (mod 4) of specified bit length
     * @param {number} bits - Bit length of prime
     * @returns {BigInt} Random prime
     */
    generatePrime3Mod4: function(bits) {
      const minValue = 1n << BigInt(bits - 1);
      const maxValue = (1n << BigInt(bits)) - 1n;

      let candidate;
      do {
        candidate = this._randomBigInt(minValue, maxValue);
        // Ensure candidate ≡ 3 (mod 4)
        if (candidate % 4n !== 3n) {
          candidate = candidate - (candidate % 4n) + 3n;
          if (candidate < minValue) candidate += 4n;
        }
        // Make sure it's odd
        if (candidate % 2n === 0n) candidate += 4n;
      } while (!this.isProbablyPrime(candidate));

      return candidate;
    }
  };

  // ===== RABIN ALGORITHM IMPLEMENTATION =====

  class RabinCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Rabin";
      this.description = "Rabin public key cryptosystem based on quadratic residues modulo composite numbers. Security equivalent to integer factorization. Each ciphertext decrypts to four possible plaintexts requiring disambiguation.";
      this.inventor = "Michael O. Rabin";
      this.year = 1979;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Public Key Cryptosystem";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // Rabin-1024 (educational)
        new KeySize(2048, 2048, 0), // Rabin-2048
        new KeySize(3072, 3072, 0), // Rabin-3072
        new KeySize(4096, 4096, 0)  // Rabin-4096
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Original Rabin Paper (1979)", "https://courses.csail.mit.edu/6.857/2009/handouts/rabin.pdf"),
        new LinkItem("Crypto++ Rabin Implementation", "https://github.com/weidai11/cryptopp/blob/master/rabin.cpp"),
        new LinkItem("Wikipedia - Rabin Cryptosystem", "https://en.wikipedia.org/wiki/Rabin_cryptosystem"),
        new LinkItem("Handbook of Applied Cryptography - Chapter 8", "http://cacr.uwaterloo.ca/hac/")
      ];

      this.references = [
        new LinkItem("Crypto++ rabin.h", "https://github.com/weidai11/cryptopp/blob/master/rabin.h"),
        new LinkItem("Crypto++ rabin.cpp", "https://github.com/weidai11/cryptopp/blob/master/rabin.cpp"),
        new LinkItem("Crypto++ Integer Implementation", "https://github.com/weidai11/cryptopp/blob/master/integer.cpp")
      ];

      // Test vectors - Round-trip testing only (Rabin uses randomization)
      // Reference: Crypto++ implementation uses random blinding, making output non-deterministic
      // Test validates: encrypt(plaintext) -> decrypt(ciphertext) -> plaintext
      // Expected is set to input for validation - actual test is round-trip only
      this.tests = [
        {
          text: "Rabin Round-trip Test - Crypto++ Implementation Pattern",
          uri: "https://github.com/weidai11/cryptopp/blob/master/rabin.cpp",
          input: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64"), // "Hello World"
          key: OpCodes.Hex8ToBytes("0400"), // 1024-bit key
          expected: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64") // Same as input - round-trip test validates this
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RabinInstance(this, isInverse);
    }
  }

  class RabinInstance extends IAlgorithmInstance {
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

    get key() {
      return this._keyData;
    }

    set publicKey(keyData) {
      if (keyData) {
        this._publicKey = keyData;
      } else {
        this._publicKey = null;
      }
    }

    get publicKey() {
      return this._publicKey;
    }

    set privateKey(keyData) {
      if (keyData) {
        this._privateKey = keyData;
      } else {
        this._privateKey = null;
      }
    }

    get privateKey() {
      return this._privateKey;
    }

    // Initialize Rabin with specified key size
    Init(keySize) {
      if (![1024, 2048, 3072, 4096].includes(keySize)) {
        throw new Error('Invalid Rabin key size. Use 1024, 2048, 3072, or 4096.');
      }

      this.keySize = keySize;
      return true;
    }

    // Feed data for processing
    Feed(data) {
      if (Array.isArray(data)) {
        this.inputBuffer.push(...data);
      } else if (typeof data === 'string') {
        this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
      } else {
        this.inputBuffer.push(data);
      }
    }

    // Get result (encryption/decryption)
    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      try {
        let result;
        if (this.isInverse) {
          // Decrypt - returns one of four possible plaintexts
          result = this._decrypt(this.inputBuffer);
        } else {
          // Encrypt: c = m^2 mod n
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

      let keySize = 1024; // Default
      if (Array.isArray(keyData)) {
        if (keyData.length >= 2) {
          keySize = OpCodes.Pack16BE(keyData[0], keyData[1]);
        } else if (keyData.length >= 1) {
          const keyStr = String.fromCharCode(...keyData);
          keySize = parseInt(keyStr) || 1024;
        }
      } else if (typeof keyData === 'string') {
        keySize = parseInt(keyData) || 1024;
      } else if (typeof keyData === 'number') {
        keySize = keyData;
      }

      // Ensure keySize is valid
      if (![1024, 2048, 3072, 4096].includes(keySize)) {
        keySize = 1024;
      }

      this.Init(keySize);

      // Generate keys
      const keyPair = this._generateKeys();
      this._publicKey = keyPair.publicKey;
      this._privateKey = keyPair.privateKey;
    }

    /**
     * Generate Rabin key pair
     * Following Crypto++ implementation:
     * - p, q are primes ≡ 3 (mod 4)
     * - n = p * q
     * - Find r, s such that Jacobi(r, p) = 1, Jacobi(r, q) = -1
     *                        Jacobi(s, p) = -1, Jacobi(s, q) = 1
     * @returns {Object} {publicKey, privateKey}
     */
    _generateKeys() {
      const primeBits = this.keySize / 2;

      // Generate two primes p, q ≡ 3 (mod 4)
      const p = NumberTheory.generatePrime3Mod4(primeBits);
      const q = NumberTheory.generatePrime3Mod4(primeBits);

      const n = p * q;

      // Find r and s values
      // r: Jacobi(r, p) = 1 and Jacobi(r, q) = -1
      // s: Jacobi(s, p) = -1 and Jacobi(s, q) = 1
      let r = null;
      let s = null;
      let t = 2n;

      while (r === null || s === null) {
        const jp = NumberTheory.jacobi(t, p);
        const jq = NumberTheory.jacobi(t, q);

        if (r === null && jp === 1 && jq === -1) {
          r = t;
        }

        if (s === null && jp === -1 && jq === 1) {
          s = t;
        }

        t = t + 1n;
      }

      // Compute u = q^(-1) mod p for CRT
      const u = NumberTheory.modInverse(q, p);

      const publicKey = {
        n: n,
        r: r,
        s: s,
        keySize: this.keySize
      };

      const privateKey = {
        n: n,
        r: r,
        s: s,
        p: p,
        q: q,
        u: u,
        keySize: this.keySize
      };

      return { publicKey, privateKey };
    }

    /**
     * Encrypt message using Rabin
     * Following Crypto++ ApplyFunction:
     * c = m^2 mod n
     * If m is odd: c = c * r mod n
     * If Jacobi(m, n) = -1: c = c * s mod n
     *
     * @param {Array} message - Message bytes
     * @returns {Array} Encrypted bytes
     */
    _encrypt(message) {
      if (!this._publicKey) {
        throw new Error('Rabin public key not set. Generate keys first.');
      }

      const { n, r, s } = this._publicKey;

      // Convert message to BigInt
      let m = 0n;
      for (let i = 0; i < message.length; ++i) {
        m = (m << 8n) | BigInt(message[i]);
      }

      // Ensure m < n
      m = m % n;

      // Compute c = m^2 mod n
      let c = (m * m) % n;

      // Apply transformations based on message properties
      const isOdd = (m % 2n) === 1n;
      const jacobiValue = NumberTheory.jacobi(m, n);

      if (isOdd) {
        c = (c * r) % n;
      }

      if (jacobiValue === -1) {
        c = (c * s) % n;
      }

      // Convert ciphertext to bytes
      return this._bigIntToBytes(c);
    }

    /**
     * Decrypt ciphertext using Rabin
     * Following Crypto++ CalculateInverse with blinding:
     * 1. Blind the ciphertext: c' = c * r^2 where r is random
     * 2. Adjust for r, s values based on Jacobi symbols
     * 3. Compute square roots modulo p and q
     * 4. Use CRT to combine
     * 5. Unblind and select correct root
     *
     * Returns one of four possible square roots (plaintext disambiguation required)
     *
     * @param {Array} ciphertext - Encrypted bytes
     * @returns {Array} Decrypted bytes (one of four possibilities)
     */
    _decrypt(ciphertext) {
      if (!this._privateKey) {
        throw new Error('Rabin private key not set. Generate keys first.');
      }

      const { n, r, s, p, q, u } = this._privateKey;

      // Convert ciphertext to BigInt
      let c = 0n;
      for (let i = 0; i < ciphertext.length; ++i) {
        c = (c << 8n) | BigInt(ciphertext[i]);
      }

      // Ensure c < n
      c = c % n;

      // Blinding: generate random r_blind and compute c' = c * r_blind^2 mod n
      const r_blind = NumberTheory._randomBigInt(1n, n - 1n);
      const r_blind_sq = (r_blind * r_blind) % n;
      let c_blind = (c * r_blind_sq) % n;

      // Compute cp = c_blind mod p, cq = c_blind mod q
      let cp = c_blind % p;
      let cq = c_blind % q;

      // Compute Jacobi symbols
      const jp = NumberTheory.jacobi(cp, p);
      const jq = NumberTheory.jacobi(cq, q);

      // Adjust for r value: if jq = -1, multiply by r^(-1)
      if (jq === -1) {
        const r_inv_p = NumberTheory.modInverse(r, p);
        const r_inv_q = NumberTheory.modInverse(r, q);
        cp = (cp * r_inv_p) % p;
        cq = (cq * r_inv_q) % q;
      }

      // Adjust for s value: if jp = -1, multiply by s^(-1)
      if (jp === -1) {
        const s_inv_p = NumberTheory.modInverse(s, p);
        const s_inv_q = NumberTheory.modInverse(s, q);
        cp = (cp * s_inv_p) % p;
        cq = (cq * s_inv_q) % q;
      }

      // Compute modular square roots
      // For p, q ≡ 3 (mod 4), we can use simple formula
      cp = NumberTheory.modularSquareRoot(cp, p);
      cq = NumberTheory.modularSquareRoot(cq, q);

      // Adjust sign for jp = -1
      if (jp === -1) {
        cp = p - cp;
      }

      // Use Chinese Remainder Theorem to combine
      let m = NumberTheory.crt(cp, p, cq, q, u);

      // Unblind: m = m / r_blind mod n
      const r_blind_inv = NumberTheory.modInverse(r_blind, n);
      m = (m * r_blind_inv) % n;

      // Adjust sign based on Jacobi symbols
      const mIsEven = (jq === -1 && m % 2n === 0n) || (jq === 1 && m % 2n === 1n);
      if (mIsEven) {
        m = n - m;
      }

      // Convert plaintext to bytes
      return this._bigIntToBytes(m);
    }

    /**
     * Convert BigInt to byte array
     * @param {BigInt} value - BigInt value
     * @returns {Array} Byte array
     */
    _bigIntToBytes(value) {
      if (value === 0n) return [0];

      const bytes = [];
      while (value > 0n) {
        bytes.unshift(Number(value & 0xFFn));
        value = value >> 8n;
      }
      return bytes;
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

  const algorithmInstance = new RabinCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RabinCipher, RabinInstance, NumberTheory };
}));
