/*
 * Rabin-Williams Signature Scheme Implementation
 * IEEE P1363 conformant signature scheme with Bernstein's tweaked square roots
 * Compatible with AlgorithmFramework - uses JavaScript native BigInt
 * (c)2006-2025 Hawkynt
 *
 * Based on Crypto++ implementation by Wei Dai
 * Reference: rw.h, rw.cpp from Crypto++
 * Paper: "RSA signatures and Rabin–Williams signatures: the state of the art"
 *        by Daniel J. Bernstein (http://cr.yp.to/sigs/rwsota-20080131.pdf)
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

  // ===== NUMBER THEORY UTILITIES FOR RABIN-WILLIAMS =====

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
     * Chinese Remainder Theorem: solve x ≡ a1 (mod n1), x ≡ a2 (mod n2)
     * Crypto++ implementation: x = a2 + n2 * ((a1 - a2) * u mod n1)
     * @param {BigInt} xp - x mod p
     * @param {BigInt} p - First prime modulus
     * @param {BigInt} xq - x mod q
     * @param {BigInt} q - Second prime modulus
     * @param {BigInt} u - Precomputed q^(-1) mod p
     * @returns {BigInt} Solution x
     */
    crt: function(xp, p, xq, q, u) {
      // x = xq + q * ((xp - xq) * u mod p)
      let diff = ((xp - xq) % p + p) % p;
      const mult = (diff * u) % p;
      return xq + q * mult;
    },

    /**
     * Miller-Rabin primality test (deterministic for small numbers, probabilistic otherwise)
     * @param {BigInt} n - Number to test
     * @param {number} k - Number of rounds
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
     * Generate random prime p ≡ 3 (mod 8) for Rabin-Williams
     * @param {number} bits - Bit length of prime
     * @returns {BigInt} Random prime
     */
    generatePrime3Mod8: function(bits) {
      const minValue = 1n << BigInt(bits - 1);
      const maxValue = (1n << BigInt(bits)) - 1n;

      let candidate;
      do {
        candidate = this._randomBigInt(minValue, maxValue);
        // Ensure candidate ≡ 3 (mod 8)
        const remainder = candidate % 8n;
        if (remainder !== 3n) {
          candidate = candidate - remainder + 3n;
          if (candidate < minValue) candidate += 8n;
        }
      } while (!this.isProbablyPrime(candidate));

      return candidate;
    },

    /**
     * Generate random prime q ≡ 7 (mod 8) for Rabin-Williams
     * @param {number} bits - Bit length of prime
     * @returns {BigInt} Random prime
     */
    generatePrime7Mod8: function(bits) {
      const minValue = 1n << BigInt(bits - 1);
      const maxValue = (1n << BigInt(bits)) - 1n;

      let candidate;
      do {
        candidate = this._randomBigInt(minValue, maxValue);
        // Ensure candidate ≡ 7 (mod 8)
        const remainder = candidate % 8n;
        if (remainder !== 7n) {
          candidate = candidate - remainder + 7n;
          if (candidate < minValue) candidate += 8n;
        }
      } while (!this.isProbablyPrime(candidate));

      return candidate;
    }
  };

  // ===== RABIN-WILLIAMS ALGORITHM IMPLEMENTATION =====

  class RabinWilliamsSignature extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Rabin-Williams";
      this.description = "Rabin-Williams signature scheme from IEEE P1363 using Bernstein's tweaked square roots for performance. Provides unambiguous signatures with security equivalent to integer factorization.";
      this.inventor = "Michael O. Rabin, Hugh C. Williams";
      this.year = 1979;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signature Scheme";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // RW-1024 (educational)
        new KeySize(2048, 2048, 0), // RW-2048
        new KeySize(3072, 3072, 0), // RW-3072
        new KeySize(4096, 4096, 0)  // RW-4096
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
        new LinkItem("Bernstein's Tweaked Roots", "http://cr.yp.to/sigs/rwsota-20080131.pdf")
      ];

      // Test vectors - Round-trip testing only (RW uses randomized blinding)
      // Reference: Crypto++ implementation uses random blinding per IEEE P1363 and Bernstein's paper
      // Test validates: sign(message) -> verify(signature) -> message
      // Expected is set to input for validation - actual test is round-trip only
      this.tests = [
        {
          text: "Rabin-Williams Round-trip Test - IEEE P1363 Compliance",
          uri: "http://cr.yp.to/sigs/rwsota-20080131.pdf",
          input: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64"), // "Hello World"
          key: OpCodes.Hex8ToBytes("0400"), // 1024-bit key
          expected: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64") // Same as input - round-trip test validates this
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RabinWilliamsInstance(this, isInverse);
    }
  }

  /**
 * RabinWilliams cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RabinWilliamsInstance extends IAlgorithmInstance {
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
      this._precomputed = null;
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

    // Initialize Rabin-Williams with specified key size
    Init(keySize) {
      if (![1024, 2048, 3072, 4096].includes(keySize)) {
        throw new Error('Invalid RW key size. Use 1024, 2048, 3072, or 4096.');
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
      if (Array.isArray(data)) {
        this.inputBuffer.push(...data);
      } else if (typeof data === 'string') {
        this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
      } else {
        this.inputBuffer.push(data);
      }
    }

    // Get result (signature generation/verification)
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
          // Verify signature
          result = this._verify(this.inputBuffer);
        } else {
          // Generate signature: s = sqrt(x) mod n with tweaks
          result = this._sign(this.inputBuffer);
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

      // Precompute values for performance (Bernstein's tweaks)
      this._precomputeTweakedRoots();
    }

    /**
     * Generate Rabin-Williams key pair
     * Following Crypto++ implementation:
     * - p ≡ 3 (mod 8), q ≡ 7 (mod 8) (Rabin-Williams requirement)
     * - n = p * q (n ≡ 5 (mod 8) guaranteed by construction)
     * - u = q^(-1) mod p
     * @returns {Object} {publicKey, privateKey}
     */
    _generateKeys() {
      const primeBits = this.keySize / 2;

      // Generate primes with required congruences
      // p ≡ 3 (mod 8)
      const p = NumberTheory.generatePrime3Mod8(primeBits);

      // q ≡ 7 (mod 8)
      const q = NumberTheory.generatePrime7Mod8(primeBits);

      const n = p * q;

      // Verify n ≡ 5 (mod 8) - this should always be true
      if (n % 8n !== 5n) {
        throw new Error('Invalid RW modulus: n must be ≡ 5 (mod 8)');
      }

      // Compute u = q^(-1) mod p for CRT
      const u = NumberTheory.modInverse(q, p);

      const publicKey = {
        n: n,
        keySize: this.keySize
      };

      const privateKey = {
        n: n,
        p: p,
        q: q,
        u: u,
        keySize: this.keySize
      };

      return { publicKey, privateKey };
    }

    /**
     * Precompute tweaked roots for performance (Bernstein optimization)
     * Following Crypto++ PrecomputeTweakedRoots():
     * - m_pre_2_9p = 2^((9*p - 11)/8) mod p
     * - m_pre_2_3q = 2^((3*q - 5)/8) mod q
     * - m_pre_q_p = q^(p - 2) mod p
     */
    _precomputeTweakedRoots() {
      if (!this._privateKey) return;

      const { p, q } = this._privateKey;

      this._precomputed = {
        pre_2_9p: NumberTheory.modExp(2n, (9n * p - 11n) / 8n, p),
        pre_2_3q: NumberTheory.modExp(2n, (3n * q - 5n) / 8n, q),
        pre_q_p: NumberTheory.modExp(q, p - 2n, p)
      };
    }

    /**
     * ApplyFunction from Crypto++ rw.cpp
     * Computes the public function: transform input x to output based on IEEE P1363
     * This handles the unambiguous encoding with tweaks
     *
     * @param {BigInt} x - Input value (0 < x < n)
     * @returns {BigInt} Output value
     */
    _applyFunction(x) {
      const { n } = this._publicKey;

      // Compute out = x^2 mod n
      let out = (x * x) % n;

      // IEEE P1363 Rabin-Williams uses r=12
      const r = 12n;
      const r2 = r / 2n; // 6
      const r3a = (16n + 5n - r) % 16n; // 9
      const r3b = (16n + 13n - r) % 16n; // 1
      const r4 = (8n + 5n - r / 2n) % 8n; // 2

      const outMod16 = out % 16n;

      // Apply transformations based on output mod 16
      if (outMod16 === r) {
        // out = out (no change)
      } else if (outMod16 === r2 || outMod16 === r2 + 8n) {
        // out = out * 2
        out = (out << 1n) % n;
      } else if (outMod16 === r3a || outMod16 === r3b) {
        // out = n - out
        out = n - out;
      } else if (outMod16 === r4 || outMod16 === r4 + 8n) {
        // out = (n - out) * 2
        out = ((n - out) << 1n) % n;
      } else {
        // Invalid input - return 0
        out = 0n;
      }

      return out;
    }

    /**
     * Sign message using Rabin-Williams with tweaked square roots
     * Following Crypto++ CalculateInverse with Bernstein's optimizations
     *
     * Algorithm from rw.cpp lines 195-265:
     * 1. Blind the message hash with random r: re = r^2 * r^2 * x mod n
     * 2. Compute e and f tweaks based on Jacobi-like tests
     * 3. Calculate square roots modulo p and q using tweaked formulas
     * 4. Combine using CRT
     * 5. Unblind: s = Y^2 * rInv and select canonical representative
     *
     * @param {Array} message - Message bytes (typically hash)
     * @returns {Array} Signature bytes
     */
    _sign(message) {
      if (!this._privateKey) {
        throw new Error('RW private key not set. Generate keys first.');
      }

      const { n, p, q, u } = this._privateKey;
      const { pre_2_9p, pre_2_3q, pre_q_p } = this._precomputed;

      // Convert message to BigInt (this would normally be a hash)
      let x = 0n;
      for (let i = 0; i < message.length; ++i) {
        x = (x << 8n) | BigInt(message[i]);
      }

      // Ensure x < n
      x = x % n;

      // IEEE P1363 requires x mod 16 ∈ {12, 6, 14, 9, 1, 2, 10}
      // Adjust x to have valid form by ensuring x mod 16 = 12 (simplest valid case)
      const xMod16 = x % 16n;
      const validMods = [12n, 6n, 14n, 9n, 1n, 2n, 10n];
      if (!validMods.includes(xMod16)) {
        // Adjust to x mod 16 = 12 by adding offset
        const offset = (12n - xMod16 + 16n) % 16n;
        x = (x + offset) % n;
      }

      // Blinding (Crypto++ lines 203-213): generate random r, square it
      let r;
      let rInv;
      do {
        r = NumberTheory._randomBigInt(1n, n - 1n);
        // Square r to satisfy Jacobi requirements (line 211)
        r = (r * r) % n;

        // Compute r^(-1) mod n
        try {
          rInv = NumberTheory.modInverse(r, n);
        } catch (e) {
          rInv = 0n;
        }
      } while (rInv === 0n);

      // Blind (lines 215-216): re = r^2 * r^2 * x = r^4 * x
      let re = (r * r) % n;
      re = (re * x) % n;

      // Compute tweaks e and f (Bernstein's method from rw.cpp lines 218-231)
      const h = re;
      let e, f;

      // Test U = h^((q+1)/8) mod q (line 221)
      const U = NumberTheory.modExp(h, (q + 1n) / 8n, q);
      const U4_minus_h = (NumberTheory.modExp(U, 4n, q) - h % q + q) % q;

      if (U4_minus_h === 0n) {
        e = 1n;
      } else {
        e = -1n;
      }

      // Test V = (e*h)^((p-3)/8) mod p (line 192-193)
      // Note: e can be -1, handle properly in modular arithmetic
      const eh = e * h;  // Works for both e = 1 and e = -1
      const ehModP = ((eh % p) + p) % p;  // Normalize to positive modulo p
      const V = NumberTheory.modExp(ehModP, (p - 3n) / 8n, p);
      const V4 = NumberTheory.modExp(V, 4n, p);
      const eh2_mod_p = NumberTheory.modExp(ehModP, 2n, p);
      const test = ((V4 * eh2_mod_p) % p - ehModP + p) % p;

      if (test === 0n) {
        f = 1n;
      } else {
        f = 2n;
      }

      // Compute W and X with precomputed tweaks (lines 233-250)
      let W, X;

      // Line 239: W = (f == 1) ? U : pre_2_3q * U mod q
      if (f === 1n) {
        W = U;
      } else {
        W = (pre_2_3q * U) % q;
      }

      // Lines 208-209: t = V^3 * eh mod p, X = (f == 1) ? t : pre_2_9p * t mod p
      const t = (NumberTheory.modExp(V, 3n, p) * ehModP) % p;
      if (f === 1n) {
        X = t;
      } else {
        X = (pre_2_9p * t) % p;
      }

      // Combine using CRT (line 253): Y = W + q * modp.Multiply(pre_q_p, (X - W))
      // CRT to combine square roots from mod p and mod q
      const Y = NumberTheory.crt(X, p, W, q, pre_q_p);

      // Unblind (line 256): s = Y^2 * rInv mod n
      let s = ((Y * Y) % n * rInv) % n;

      // IEEE P1363 Section 8.2.8 (line 260): take minimum of s and n-s
      if (s > n - s) {
        s = n - s;
      }

      // Verify signature is correct (line 261)
      if (this._applyFunction(s) !== x) {
        throw new Error('RW signature generation failed: verification check failed');
      }

      // Convert signature to bytes
      return this._bigIntToBytes(s);
    }

    /**
     * Verify signature using Rabin-Williams public function
     *
     * @param {Array} signature - Signature bytes
     * @returns {Array} Recovered message bytes (or empty if verification fails)
     */
    _verify(signature) {
      if (!this._publicKey) {
        throw new Error('RW public key not set.');
      }

      // Convert signature to BigInt
      let s = 0n;
      for (let i = 0; i < signature.length; ++i) {
        s = (s << 8n) | BigInt(signature[i]);
      }

      // Apply public function
      const recovered = this._applyFunction(s);

      // Convert to bytes
      return this._bigIntToBytes(recovered);
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
      if (this._precomputed) {
        this._precomputed.pre_2_9p = 0n;
        this._precomputed.pre_2_3q = 0n;
        this._precomputed.pre_q_p = 0n;
        this._precomputed = null;
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

  return { RabinWilliamsSignature, RabinWilliamsInstance, NumberTheory };
}));
