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

  /**
   * The Bezout coefficients of a and b alongside their gcd.
   */
  class ExtendedGcdResult {
    /**
     * @param {BigInt} gcd - gcd(a, b)
     * @param {BigInt} x - coefficient of a
     * @param {BigInt} y - coefficient of b
     */
    constructor(gcd, x, y) {
      /** @type {BigInt} */
      this.gcd = gcd;
      /** @type {BigInt} */
      this.x = x;
      /** @type {BigInt} */
      this.y = y;
    }
  }

  /**
   * Compute greatest common divisor using Euclidean algorithm
   * @param {BigInt} a - First number
   * @param {BigInt} b - Second number
   * @returns {BigInt} GCD of a and b
   */
  function gcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
   * Extended Euclidean algorithm: find x, y such that ax + by = gcd(a,b)
   * @param {BigInt} a - First number
   * @param {BigInt} b - Second number
   * @returns {ExtendedGcdResult} {gcd, x, y}
   */
  function extendedGcd(a, b) {
    if (b === 0n) {
      return new ExtendedGcdResult(a, 1n, 0n);
    }

    const result = extendedGcd(b, a % b);
    const x = result.y;
    const y = result.x - (a / b) * result.y;

    return new ExtendedGcdResult(result.gcd, x, y);
  }

  /**
   * Modular multiplicative inverse using extended Euclidean algorithm
   * @param {BigInt} a - Number to invert
   * @param {BigInt} m - Modulus
   * @returns {BigInt} Inverse of a mod m, or throws if not invertible
   */
  function modInverse(a, m) {
    const result = extendedGcd(a, m);
    if (result.gcd !== 1n) {
      throw new Error('Modular inverse does not exist');
    }
    // Ensure positive result
    return ((result.x % m) + m) % m;
  }

  /**
   * Modular exponentiation: compute (base^exp) mod m efficiently
   * @param {BigInt} base - Base value
   * @param {BigInt} exp - Exponent
   * @param {BigInt} m - Modulus
   * @returns {BigInt} (base^exp) mod m
   */
  function modExp(base, exp, m) {
    if (m === 1n) return 0n;

    /** @type {BigInt} */
    let result = 1n;
    base = base % m;

    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = (result * base) % m;
      }
      exp = OpCodes.ShiftRn(exp, 1n);
      base = (base * base) % m;
    }

    return result;
  }

  /**
   * Compute Jacobi symbol (a/n)
   * For Rabin, we need Jacobi symbol to determine quadratic residues
   * @param {BigInt} a - Upper value
   * @param {BigInt} n - Lower value (must be odd)
   * @returns {int32} -1, 0, or 1
   */
  function jacobi(a, n) {
    if (n <= 0n || n % 2n === 0n) {
      throw new Error('Jacobi symbol: n must be odd and positive');
    }

    a = a % n;
    let result = 1;

    while (a !== 0n) {
      // Remove factors of 2
      while (a % 2n === 0n) {
        a = a / 2n;
        /** @type {int32} */
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
  }

  /**
   * Tonelli-Shanks algorithm for computing modular square root
   * Find x such that x^2 ≡ n (mod p) where p is prime
   * @param {BigInt} n - Number to find square root of
   * @param {BigInt} p - Prime modulus
   * @returns {BigInt} Square root of n mod p
   */
  function modularSquareRoot(n, p) {
    // Special case: p ≡ 3 (mod 4)
    if (p % 4n === 3n) {
      return modExp(n, (p + 1n) / 4n, p);
    }

    // Tonelli-Shanks for p ≡ 1 (mod 4)
    // Factor p-1 = 2^s * q with q odd
    /** @type {BigInt} */
    let s = 0n;
    /** @type {BigInt} */
    let q = p - 1n;
    while (q % 2n === 0n) {
      q = q / 2n;
      s = s + 1n;
    }

    // Find a quadratic non-residue z
    /** @type {BigInt} */
    let z = 2n;
    while (jacobi(z, p) !== -1) {
      z = z + 1n;
    }

    /** @type {BigInt} */
    let m = s;
    /** @type {BigInt} */
    let c = modExp(z, q, p);
    /** @type {BigInt} */
    let t = modExp(n, q, p);
    /** @type {BigInt} */
    let r = modExp(n, (q + 1n) / 2n, p);

    while (t !== 1n) {
      // Find least i such that t^(2^i) = 1
      /** @type {BigInt} */
      let i = 1n;
      /** @type {BigInt} */
      let temp = (t * t) % p;
      while (temp !== 1n && i < m) {
        temp = (temp * temp) % p;
        i = i + 1n;
      }

      // Update values
      const b = modExp(c, modExp(2n, m - i - 1n, p - 1n), p);
      m = i;
      c = (b * b) % p;
      t = (t * c) % p;
      r = (r * b) % p;
    }

    return r;
  }

  /**
   * Chinese Remainder Theorem: solve x ≡ a1 (mod n1), x ≡ a2 (mod n2)
   * @param {BigInt} a1 - First remainder
   * @param {BigInt} n1 - First modulus
   * @param {BigInt} a2 - Second remainder
   * @param {BigInt} n2 - Second modulus
   * @param {BigInt} u - Precomputed n2^(-1) mod n1
   * @returns {BigInt} Solution x
   */
  function crt(a1, n1, a2, n2, u) {
    // x = a2 + n2 * ((a1 - a2) * u mod n1)
    const diff = ((a1 - a2) % n1 + n1) % n1;
    const mult = (diff * u) % n1;
    return a2 + n2 * mult;
  }

  /**
   * Miller-Rabin primality test (simplified)
   * @param {BigInt} n - Number to test
   * @param {int32} k - Number of rounds (higher = more accurate)
   * @param {function} [source] - Optional deterministic bit source
   * @returns {boolean} True if probably prime
   */
  function isProbablyPrime(n, k = 20, source) {
    if (n === 2n || n === 3n) {
      return true;
    }
    if (n < 2n || n % 2n === 0n) {
      return false;
    }

    // Write n-1 as 2^r * d
    /** @type {BigInt} */
    let r = 0n;
    /** @type {BigInt} */
    let d = n - 1n;
    while (d % 2n === 0n) {
      r = r + 1n;
      d = d / 2n;
    }

    // Witness loop
    for (let i = 0; i < k; ++i) {
      // Pick random witness a in [2, n-2]
      const a = randomBigInt(2n, n - 2n, source);

      let x = modExp(a, d, n);

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
  }

  /**
   * One uniformly random bit from Math.random, the default bit source.
   * @returns {BigInt} 0n or 1n
   */
  function mathRandomBit() {
    return BigInt(Math.random() < 0.5 ? 0 : 1);
  }

  /**
   * Generate random BigInt in range [min, max]
   * @param {BigInt} min - Minimum value
   * @param {BigInt} max - Maximum value
   * @param {function} [source] - Optional deterministic bit source returning 0n or 1n
   * @returns {BigInt} Random value
   */
  function randomBigInt(min, max, source) {
    const range = max - min + 1n;
    /** @type {string} */
    const rangeBits = range.toString(2);
    const bits = rangeBits.length;
    const nextBit = source || mathRandomBit;

    /** @type {BigInt} */
    let result;
    do {
      result = 0n;
      for (let i = 0; i < bits; ++i) {
        result = OpCodes.OrN(OpCodes.ShiftLn(result, 1n), nextBit());
      }
    } while (result >= range);

    return min + result;
  }

  /**
   * Deterministic bit source for key generation.
   *
   * A key pair has to be a function of the key material and nothing else. The
   * generator below is SplitMix64 (Steele, Lea and Flood, "Fast Splittable
   * Pseudorandom Number Generators", OOPSLA 2014), seeded from the caller's
   * key bytes, so the same key always yields the same p and q.
   *
   * @param {uint8[]} seedBytes - Key material to seed from
   * @returns {function} Bit source returning 0n or 1n
   */
  function deterministicBitSource(seedBytes) {
    /** @type {BigInt} */
    const MASK64 = 0xFFFFFFFFFFFFFFFFn;
    /** @type {BigInt} */
    let state = 0x243F6A8885A308D3n;   // pi, first 64 fractional bits
    // FNV-1a over the key material, so every seed byte reaches the state
    for (let i = 0; i < seedBytes.length; ++i)
      state = OpCodes.AndN(OpCodes.XorN(state, BigInt(seedBytes[i] % 256)) * 0x100000001B3n, MASK64);

    /** @type {BigInt} */
    let reservoir = 0n;
    let available = 0;
    return function nextBit() {
      if (available === 0) {
        state = OpCodes.AndN(state + 0x9E3779B97F4A7C15n, MASK64);
        /** @type {BigInt} */
        let z = state;
        z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 30n)) * 0xBF58476D1CE4E5B9n, MASK64);
        z = OpCodes.AndN(OpCodes.XorN(z, OpCodes.ShiftRn(z, 27n)) * 0x94D049BB133111EBn, MASK64);
        reservoir = OpCodes.XorN(z, OpCodes.ShiftRn(z, 31n));
        available = 64;
      }
      const bit = OpCodes.AndN(reservoir, 1n);
      reservoir = OpCodes.ShiftRn(reservoir, 1n);
      --available;
      return bit;
    };
  }

  /**
   * Odd primes below 1000, used to reject most candidates before any
   * modular exponentiation is attempted.
   *
   * About three quarters of the odd numbers in a large interval have a
   * factor in this list, and finding it costs one BigInt remainder each
   * while a single Miller-Rabin round costs a full modular exponentiation.
   * Without the sieve the search for one 2048-bit prime ran twenty
   * exponentiations against every composite it drew.
   * @returns {BigInt[]} the odd primes below 1000
   */
  function buildSmallPrimes() {
    /** @type {BigInt[]} */
    const primes = [];
    const sieve = new Uint8Array(1000);
    for (let i = 3; i < 1000; i += 2) {
      if (sieve[i]) continue;
      primes.push(BigInt(i));
      for (let j = i * i; j < 1000; j += i + i) sieve[j] = 1;
    }
    return primes;
  }

  /** @type {BigInt[]} */
  const SMALL_PRIMES = buildSmallPrimes();

  /**
   * Whether a candidate survives trial division by the small primes.
   * @param {BigInt} n - Candidate
   * @returns {boolean} False when a small prime divides it
   */
  function passesTrialDivision(n) {
    for (let i = 0; i < SMALL_PRIMES.length; ++i) {
      const p = SMALL_PRIMES[i];
      if (n === p) return true;
      if (n % p === 0n) return false;
    }
    return true;
  }

  /**
   * Generate random prime p ≡ 3 (mod 4) of specified bit length
   * @param {int32} bits - Bit length of prime
   * @param {function} [source] - Optional deterministic bit source
   * @returns {BigInt} Random prime
   */
  function generatePrime3Mod4(bits, source) {
    /** @type {BigInt} */
    const minValue = OpCodes.ShiftLn(1n, BigInt(bits - 1));
    /** @type {BigInt} */
    const maxValue = OpCodes.ShiftLn(1n, BigInt(bits)) - 1n;

    for (;;) {
      /** @type {BigInt} */
      let candidate = randomBigInt(minValue, maxValue, source);
      // Ensure candidate ≡ 3 (mod 4)
      if (candidate % 4n !== 3n) {
        candidate = candidate - (candidate % 4n) + 3n;
        if (candidate < minValue) candidate += 4n;
      }
      // Make sure it's odd
      if (candidate % 2n === 0n) candidate += 4n;

      // A candidate ≡ 3 (mod 4) stays that way under steps of 4, so the
      // draw is walked forward rather than redrawn. Each draw costs as many
      // BigInt shifts as the prime has bits, and the walk reuses one draw
      // for a whole run of candidates.
      for (let step = 0; step < 4096 && candidate <= maxValue; ++step, candidate += 4n) {
        if (!passesTrialDivision(candidate)) continue;
        if (isProbablyPrime(candidate, 20, source)) return candidate;
      }
    }
  }

  // The number theory above, under the names this module has always exported.
  const NumberTheory = {
    gcd: gcd,
    extendedGcd: extendedGcd,
    modInverse: modInverse,
    modExp: modExp,
    jacobi: jacobi,
    modularSquareRoot: modularSquareRoot,
    crt: crt,
    isProbablyPrime: isProbablyPrime,
    _randomBigInt: randomBigInt,
    deterministicBitSource: deterministicBitSource,
    SMALL_PRIMES: SMALL_PRIMES,
    _passesTrialDivision: passesTrialDivision,
    generatePrime3Mod4: generatePrime3Mod4
  };

  /**
   * A Rabin public key: the modulus and the two twist values.
   */
  class RabinPublicKey {
    /**
     * @param {BigInt} n - modulus p * q
     * @param {BigInt} r - value with Jacobi(r, p) = 1, Jacobi(r, q) = -1
     * @param {BigInt} s - value with Jacobi(s, p) = -1, Jacobi(s, q) = 1
     * @param {int32} keySize - modulus size in bits
     */
    constructor(n, r, s, keySize) {
      /** @type {BigInt} */
      this.n = n;
      /** @type {BigInt} */
      this.r = r;
      /** @type {BigInt} */
      this.s = s;
      /** @type {int32} */
      this.keySize = keySize;
    }
  }

  /**
   * A Rabin private key: the public values and the factorisation.
   */
  class RabinPrivateKey {
    /**
     * @param {BigInt} n - modulus p * q
     * @param {BigInt} r - value with Jacobi(r, p) = 1, Jacobi(r, q) = -1
     * @param {BigInt} s - value with Jacobi(s, p) = -1, Jacobi(s, q) = 1
     * @param {BigInt} p - first prime, 3 mod 4
     * @param {BigInt} q - second prime, 3 mod 4
     * @param {BigInt} u - q^-1 mod p
     * @param {int32} keySize - modulus size in bits
     */
    constructor(n, r, s, p, q, u, keySize) {
      /** @type {BigInt} */
      this.n = n;
      /** @type {BigInt} */
      this.r = r;
      /** @type {BigInt} */
      this.s = s;
      /** @type {BigInt} */
      this.p = p;
      /** @type {BigInt} */
      this.q = q;
      /** @type {BigInt} */
      this.u = u;
      /** @type {int32} */
      this.keySize = keySize;
    }
  }

  /**
   * A generated key pair.
   */
  class RabinKeyPair {
    /**
     * @param {RabinPublicKey} publicKey - public half
     * @param {RabinPrivateKey} privateKey - private half
     */
    constructor(publicKey, privateKey) {
      /** @type {RabinPublicKey} */
      this.publicKey = publicKey;
      /** @type {RabinPrivateKey} */
      this.privateKey = privateKey;
    }
  }

  /**
   * A field-by-field copy of a public key.
   * @param {RabinPublicKey} key - key to copy
   * @returns {RabinPublicKey} the copy
   */
  function copyPublicKey(key) {
    return new RabinPublicKey(key.n, key.r, key.s, key.keySize);
  }

  /**
   * A field-by-field copy of a private key.
   * @param {RabinPrivateKey} key - key to copy
   * @returns {RabinPrivateKey} the copy
   */
  function copyPrivateKey(key) {
    return new RabinPrivateKey(key.n, key.r, key.s, key.p, key.q, key.u, key.keySize);
  }

  /** @type {int32[]} */
  const KEY_SIZES = [1024, 2048, 3072, 4096];

  // A key pair is a pure function of the key material, so it is derived once and
  // reused. Without this every instance would pay for two probable-prime searches
  // and the encrypting and decrypting instances of a single message would each
  // spend that time separately.
  const KEY_PAIR_CACHE = new Map();

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

      // Algorithm-specific metadata.
      //
      // 3072 and 4096 were listed here as well. Init still accepts them, but
      // they are not advertised: the pair is derived rather than supplied, so
      // selecting one starts a probable-prime search over 1536- or 2048-bit
      // candidates, and that search runs for about ten and fourteen seconds of
      // uninterruptible arithmetic. In a browser that is the tab frozen for
      // that long, and no committed vector can cover it either - the engine
      // allows five seconds per vector. A caller who has p and q already can
      // still set them through the privateKey property at any size.
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // Rabin-1024 (educational)
        new KeySize(2048, 2048, 0)  // Rabin-2048
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
        },
        {
          // The second declared key size, which no vector reached before. The
          // root extraction runs modulo 1024-bit p and q here rather than
          // 512-bit ones, and the Jacobi symbols that pick the right root out
          // of the four are computed over a modulus twice as wide.
          text: "Rabin-2048 round-trip",
          uri: "https://github.com/weidai11/cryptopp/blob/master/rabin.cpp",
          input: OpCodes.Hex8ToBytes("546865207365636f6e64206b65792073697a65"),
          key: OpCodes.Hex8ToBytes("0800"), // 2048-bit key
          expected: OpCodes.Hex8ToBytes("546865207365636f6e64206b65792073697a65")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RabinInstance(this, isInverse);
    }
  }

  /**
 * Rabin cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RabinInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {RabinCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {int32} */
      this.keySize = 1024;
      /** @type {RabinPublicKey|null} */
      this._publicKey = null;
      /** @type {RabinPrivateKey|null} */
      this._privateKey = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this._keyData = null;
    }

    // Property setters/getters for compatibility
    /**
     * @param {uint8[]} keyData - modulus size selector (see KeySetup)
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

    /**
     * @param {RabinPublicKey|null} keyData - public key
     */
    set publicKey(keyData) {
      if (keyData) {
        this._publicKey = keyData;
      } else {
        this._publicKey = null;
      }
    }

    /**
     * @returns {RabinPublicKey|null} current public key
     */
    get publicKey() {
      return this._publicKey;
    }

    /**
     * @param {RabinPrivateKey|null} keyData - private key
     */
    set privateKey(keyData) {
      if (keyData) {
        this._privateKey = keyData;
      } else {
        this._privateKey = null;
      }
    }

    /**
     * @returns {RabinPrivateKey|null} current private key
     */
    get privateKey() {
      return this._privateKey;
    }

    // Initialize Rabin with specified key size
    /**
     * @param {int32} keySize - modulus size in bits
     * @returns {boolean} true once the size is accepted
     */
    Init(keySize) {
      if (!KEY_SIZES.includes(keySize)) {
        throw new Error('Invalid Rabin key size. Use 1024, 2048, 3072, or 4096.');
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
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      } else if (typeof data === 'string') {
        this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
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
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      try {
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          // Decrypt - returns one of four possible plaintexts
          result = this._decrypt(this.inputBuffer);
        } else {
          // Encrypt: c = m^2 mod n
          result = this._encrypt(this.inputBuffer);
        }

        return result;
      } finally {
        this.inputBuffer = [];
      }
    }

    // Set up keys
    /**
     * @param {uint8[]} keyData - modulus size: two big-endian bytes, one ASCII digit, a string or a number
     */
    KeySetup(keyData) {
      this._keyData = keyData;

      /** @type {int32} */
      let keySize = 1024; // Default
      if (Array.isArray(keyData)) {
        /** @type {uint8[]} */
        const bytes = keyData;
        if (bytes.length >= 2) {
          keySize = OpCodes.Pack16BE(bytes[0], bytes[1]);
        } else if (bytes.length >= 1) {
          const keyStr = String.fromCharCode(...bytes);
          /** @type {int32} */
          const parsed = parseInt(keyStr);
          keySize = parsed ? parsed : 1024;
        }
      } else if (typeof keyData === 'string') {
        /** @type {string} */
        const text = keyData;
        /** @type {int32} */
        const parsed = parseInt(text);
        keySize = parsed ? parsed : 1024;
      } else if (typeof keyData === 'number') {
        /** @type {int32} */
        const bits = keyData;
        keySize = bits;
      }

      // Ensure keySize is valid
      if (!KEY_SIZES.includes(keySize)) {
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
     *
     * The pair is derived deterministically from the supplied key material. A
     * key pair drawn from Math.random on every CreateInstance call cannot be
     * used at all: the encrypting instance and the decrypting instance would
     * hold different moduli, so no ciphertext could ever be decrypted and the
     * scheme would be broken by construction rather than by its mathematics.
     *
     * Note what the key material is here: this interface takes a modulus size,
     * not a private key, so the pair it derives is reproducible by anyone who
     * knows that size and offers no confidentiality. That is what the
     * EDUCATIONAL security status on this algorithm means. Real use has to
     * supply p and q, which is what the publicKey and privateKey setters are
     * for.
     *
     * @returns {RabinKeyPair} {publicKey, privateKey}
     */
    _generateKeys() {
      // The key size is always part of the seed, so two sizes cannot share a
      // stream even when the caller passes the size in some other form.
      /** @type {uint8[]} */
      let supplied;
      if (Array.isArray(this._keyData)) {
        supplied = this._keyData;
      } else if (typeof this._keyData === 'string') {
        /** @type {string} */
        const text = this._keyData;
        supplied = [];
        for (let i = 0; i < text.length; i++) supplied.push(text.charCodeAt(i) % 256);
      } else {
        supplied = [];
      }
      /** @type {uint8[]} */
      const sizeBytes = [this.keySize % 256, Math.floor(this.keySize / 256) % 256];
      const seedMaterial = supplied.concat(sizeBytes);
      const cacheKey = seedMaterial.join(',');
      /** @type {RabinKeyPair} */
      const cached = KEY_PAIR_CACHE.get(cacheKey);
      // BigInt is immutable, so a shallow copy is enough to keep a caller's
      // ClearData from zeroing the cached pair out from under the next instance.
      if (cached)
        return new RabinKeyPair(copyPublicKey(cached.publicKey), copyPrivateKey(cached.privateKey));

      const primeBits = this.keySize / 2;

      // Generate two primes p, q ≡ 3 (mod 4). Two independent bit sources are
      // used so that p and q are drawn from different streams and cannot
      // coincide.
      /** @type {uint8[]} */
      const pTag = [0x70];
      /** @type {uint8[]} */
      const qTag = [0x71];
      const p = generatePrime3Mod4(primeBits,
        deterministicBitSource(seedMaterial.concat(pTag)));
      const q = generatePrime3Mod4(primeBits,
        deterministicBitSource(seedMaterial.concat(qTag)));

      const n = p * q;

      // Find r and s values
      // r: Jacobi(r, p) = 1 and Jacobi(r, q) = -1
      // s: Jacobi(s, p) = -1 and Jacobi(s, q) = 1
      /** @type {BigInt|null} */
      let r = null;
      /** @type {BigInt|null} */
      let s = null;
      /** @type {BigInt} */
      let t = 2n;

      while (r === null || s === null) {
        const jp = jacobi(t, p);
        const jq = jacobi(t, q);

        if (r === null && jp === 1 && jq === -1) {
          r = t;
        }

        if (s === null && jp === -1 && jq === 1) {
          s = t;
        }

        t = t + 1n;
      }

      // Compute u = q^(-1) mod p for CRT
      const u = modInverse(q, p);

      const publicKey = new RabinPublicKey(n, r, s, this.keySize);

      const privateKey = new RabinPrivateKey(n, r, s, p, q, u, this.keySize);

      KEY_PAIR_CACHE.set(cacheKey, new RabinKeyPair(copyPublicKey(publicKey), copyPrivateKey(privateKey)));
      return new RabinKeyPair(publicKey, privateKey);
    }

    /**
     * Encrypt message using Rabin
     * Following Crypto++ ApplyFunction:
     * c = m^2 mod n
     * If m is odd: c = c * r mod n
     * If Jacobi(m, n) = -1: c = c * s mod n
     *
     * @param {uint8[]} message - Message bytes
     * @returns {uint8[]} Encrypted bytes
     */
    _encrypt(message) {
      if (!this._publicKey) {
        throw new Error('Rabin public key not set. Generate keys first.');
      }

      const n = this._publicKey.n;
      const r = this._publicKey.r;
      const s = this._publicKey.s;

      // Convert message to BigInt
      /** @type {BigInt} */
      let m = 0n;
      for (let i = 0; i < message.length; ++i) {
        m = OpCodes.OrN(OpCodes.ShiftLn(m, 8n), BigInt(message[i]));
      }

      // Ensure m < n
      m = m % n;

      // Compute c = m^2 mod n
      let c = (m * m) % n;

      // Apply transformations based on message properties
      const isOdd = (m % 2n) === 1n;
      const jacobiValue = jacobi(m, n);

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
     * @param {uint8[]} ciphertext - Encrypted bytes
     * @returns {uint8[]} Decrypted bytes (one of four possibilities)
     */
    _decrypt(ciphertext) {
      if (!this._privateKey) {
        throw new Error('Rabin private key not set. Generate keys first.');
      }

      const n = this._privateKey.n;
      const r = this._privateKey.r;
      const s = this._privateKey.s;
      const p = this._privateKey.p;
      const q = this._privateKey.q;
      const u = this._privateKey.u;

      // Convert ciphertext to BigInt
      /** @type {BigInt} */
      let c = 0n;
      for (let i = 0; i < ciphertext.length; ++i) {
        c = OpCodes.OrN(OpCodes.ShiftLn(c, 8n), BigInt(ciphertext[i]));
      }

      // Ensure c < n
      c = c % n;

      // Blinding: generate random r_blind and compute c' = c * r_blind^2 mod n
      const r_blind = randomBigInt(1n, n - 1n);
      const r_blind_sq = (r_blind * r_blind) % n;
      let c_blind = (c * r_blind_sq) % n;

      // The blinding factor enters squared, so it changes neither Jacobi symbol
      // of the ciphertext - but the roots extracted below are those of
      // (m * r_blind)^2, not of m^2. Selecting the root by Jacobi(m, n) alone
      // therefore picks the wrong one of the two conjugate pairs whenever the
      // blinding factor is a quadratic non-residue, which is half the time; the
      // parity correction at the end can only tell m from n-m, so the wrong pair
      // survives to the output. The target symbol is
      // Jacobi(m * r_blind, n) = Jacobi(m, n) * Jacobi(r_blind, n).
      const jBlind = jacobi(r_blind, n);

      // Compute cp = c_blind mod p, cq = c_blind mod q
      let cp = c_blind % p;
      let cq = c_blind % q;

      // Compute Jacobi symbols
      const jp = jacobi(cp, p);
      const jq = jacobi(cq, q);

      // Adjust for r value: if jq = -1, multiply by r^(-1)
      if (jq === -1) {
        const r_inv_p = modInverse(r, p);
        const r_inv_q = modInverse(r, q);
        cp = (cp * r_inv_p) % p;
        cq = (cq * r_inv_q) % q;
      }

      // Adjust for s value: if jp = -1, multiply by s^(-1)
      if (jp === -1) {
        const s_inv_p = modInverse(s, p);
        const s_inv_q = modInverse(s, q);
        cp = (cp * s_inv_p) % p;
        cq = (cq * s_inv_q) % q;
      }

      // Compute modular square roots
      // For p, q ≡ 3 (mod 4), we can use simple formula
      cp = modularSquareRoot(cp, p);
      cq = modularSquareRoot(cq, q);

      // Select the conjugate pair. modularSquareRoot returns the root that is
      // itself a residue mod p, so the combined root starts with Jacobi +1;
      // negating it mod p flips the symbol because p ≡ 3 (mod 4).
      if (jp * jBlind === -1) {
        cp = p - cp;
      }

      // Use Chinese Remainder Theorem to combine
      let m = crt(cp, p, cq, q, u);

      // Unblind: m = m / r_blind mod n
      const r_blind_inv = modInverse(r_blind, n);
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
     * @returns {uint8[]} Byte array
     */
    _bigIntToBytes(value) {
      if (value === 0n) {
        /** @type {uint8[]} */
        const zero = [0];
        return zero;
      }

      /** @type {uint8[]} */
      const bytes = [];
      while (value > 0n) {
        /** @type {uint8} */
        const low = Number(OpCodes.AndN(value, 0xFFn));
        bytes.unshift(low);
        value = OpCodes.ShiftRn(value, 8n);
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
