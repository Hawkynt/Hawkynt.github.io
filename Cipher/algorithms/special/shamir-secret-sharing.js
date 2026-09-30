/*
 * Shamir Secret Sharing Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Shamir's Secret Sharing scheme
 * Allows splitting a secret into n shares where k shares are needed to reconstruct
 * Based on polynomial interpolation over finite fields
 */

// Load AlgorithmFramework (REQUIRED)

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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class ShamirSecretSharingAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Shamir Secret Sharing";
      this.description = "Secret sharing scheme that splits a secret into n shares where any k shares can reconstruct the original secret. Based on polynomial interpolation over finite fields. Provides perfect secrecy.";
      this.inventor = "Adi Shamir";
      this.year = 1979;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Secret Sharing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Original Paper", "https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing"),
        new LinkItem("Tutorial", "https://www.cs.jhu.edu/~sdoshi/crypto/papers/shamirturing.pdf")
      ];

      this.references = [
        new LinkItem("Implementation Guide", "https://github.com/dsprenkels/sss"),
        new LinkItem("Mathematical Background", "https://en.wikipedia.org/wiki/Polynomial_interpolation"),
        new LinkItem("Finite Field Arithmetic", "https://en.wikipedia.org/wiki/Finite_field_arithmetic")
      ];

      // Test vectors for secret sharing
      // These test deterministic share generation with fixed randomness seed
      this.tests = [
        {
          text: "Simple secret sharing: single byte value",
          uri: "https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf",
          input: OpCodes.AsciiToBytes('A'),
          expected: OpCodes.AsciiToBytes('A'), // Reconstruction should return original
          threshold: 3,
          totalShares: 5,
          testReconstruction: true
        },
        {
          text: "Multi-byte secret sharing test",
          uri: "https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf",
          input: OpCodes.AsciiToBytes('Test'),
          expected: OpCodes.AsciiToBytes('Test'), // Reconstruction should return original
          threshold: 2,
          totalShares: 3,
          testReconstruction: true
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {ShamirSecretSharingInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ShamirSecretSharingInstance(this, isInverse);
    }
  }

  /**
   * One share: its x coordinate and one y value per secret byte
   * @class
   */
  class ShamirShare {
    /**
     * @param {int32} x - Evaluation point
     * @param {int32[]} y - Polynomial values, one per secret byte (0..256)
     */
    constructor(x, y) {
      /** @type {int32} */
      this.x = x;
      /** @type {int32[]} */
      this.y = y;
    }
  }

  /**
   * One interpolation point
   * @class
   */
  class ShamirPoint {
    /**
     * @param {int32} x - Evaluation point
     * @param {int32} y - Value
     */
    constructor(x, y) {
      /** @type {int32} */
      this.x = x;
      /** @type {int32} */
      this.y = y;
    }
  }

  /**
   * Result of the extended Euclidean algorithm: gcd = a*x + b*y
   * @class
   */
  class ExtendedGcd {
    /**
     * @param {int32} gcd - Greatest common divisor
     * @param {int32} x - Bezout coefficient of a
     * @param {int32} y - Bezout coefficient of b
     */
    constructor(gcd, x, y) {
      /** @type {int32} */
      this.gcd = gcd;
      /** @type {int32} */
      this.x = x;
      /** @type {int32} */
      this.y = y;
    }
  }

  /**
 * ShamirSecretSharing cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ShamirSecretSharingInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ShamirSecretSharingAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this._threshold = 3; // Default k=3
      /** @type {int32} */
      this._totalShares = 5; // Default n=5
      /** @type {ShamirShare[]} */
      this._shares = []; // For reconstruction
      /** @type {boolean} */
      this._testReconstruction = false; // Special mode for testing
      /** @type {uint8[]|null} */
      this._seed = null; // Seed for deterministic RNG
      /** @type {uint32} */
      this._rngState = 0; // RNG state

      // Finite field parameters (GF(256) for byte operations)
      /** @type {int32} */
      this.PRIME = 257; // Next prime after 256 for GF(257)
    }

    /**
     * @param {int32} k - Shares needed for reconstruction
     */
    set threshold(k) {
      if (k < 2) throw new Error("Threshold must be at least 2");
      this._threshold = k;
    }

    /**
     * @returns {int32} Shares needed for reconstruction
     */
    get threshold() {
      return this._threshold;
    }

    /**
     * @param {int32} n - Shares generated
     */
    set totalShares(n) {
      if (n < this._threshold) throw new Error("Total shares must be >= threshold");
      if (n > 255) throw new Error("Maximum 255 shares supported");
      this._totalShares = n;
    }

    /**
     * @returns {int32} Shares generated
     */
    get totalShares() {
      return this._totalShares;
    }

    /**
     * @param {ShamirShare[]} sharesData - Shares for reconstruction, objects with x and y
     */
    set shares(sharesData) {
      this._shares = sharesData;
    }

    /**
     * @returns {ShamirShare[]} Shares for reconstruction
     */
    get shares() {
      return this._shares;
    }

    /**
     * @param {boolean} value - Reconstruct the generated shares instead of returning them
     */
    set testReconstruction(value) {
      this._testReconstruction = !!value;
    }

    /**
     * @returns {boolean} Whether the generated shares are reconstructed
     */
    get testReconstruction() {
      return this._testReconstruction;
    }

    /**
     * Set seed for deterministic random number generation
     * Used for testing purposes to make share generation reproducible
     * @param {uint8[]|null} seedBytes - Seed bytes for PRNG initialization
     */
    set seed(seedBytes) {
      if (!seedBytes) {
        this._seed = null;
        this._rngState = 0;
        return;
      }
      /** @type {uint8[]} */
      const seedCopy = seedBytes.slice();
      this._seed = seedCopy;
      // Initialize RNG state from seed using simple hash
      this._rngState = 0;
      for (let i = 0; i < seedCopy.length; i++) {
        this._rngState = OpCodes.Add32(OpCodes.Mul32(this._rngState, 31), seedCopy[i]);
      }
      // Ensure non-zero state
      if (this._rngState === 0) this._rngState = 1;
    }

    /**
     * @returns {uint8[]|null} Copy of the seed
     */
    get seed() {
      return this._seed ? this._seed.slice() : null;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      if (this.isInverse) {
        return this._reconstructSecret();
      } else {
        // Generate shares, then optionally test reconstruction
        /** @type {int32[]} */
        const sharesData = this._generateShares();

        if (this._testReconstruction) {
          // Parse shares and reconstruct to verify
          /** @type {ShamirShare[]} */
          const parsedShares = this._parseShares(sharesData);
          return this._reconstructFromShares(parsedShares);
        } else {
          return sharesData;
        }
      }
    }

    /**
     * Split the buffered secret into shares
     * @returns {int32[]} Shares as a flat array: x1, y1 values, x2, y2 values, ...
     */
    _generateShares() {
      /** @type {ShamirShare[]} */
      const shares = [];
      for (let i = 0; i < this._totalShares; i++) {
        /** @type {int32[]} */
        const values = [];
        shares.push(new ShamirShare(i + 1, values));
      }

      // Generate shares for each byte of the secret
      for (let byteIndex = 0; byteIndex < this.inputBuffer.length; byteIndex++) {
        /** @type {uint8} */
        const secret = this.inputBuffer[byteIndex];
        /** @type {int32[]} */
        const byteShares = this._generateSharesForByte(secret);

        for (let i = 0; i < this._totalShares; i++) {
          shares[i].y.push(byteShares[i]);
        }
      }

      // Clear input buffer
      this.inputBuffer = [];

      // Return shares as flat byte array: [x1, y1_byte1, y1_byte2, ..., x2, y2_byte1, y2_byte2, ...]
      /** @type {int32[]} */
      const result = [];
      for (let s = 0; s < shares.length; s++) {
        /** @type {ShamirShare} */
        const share = shares[s];
        result.push(share.x);
        for (let k = 0; k < share.y.length; k++) result.push(share.y[k]);
      }

      return result;
    }

    /**
     * Parse flat byte array back into shares structure
     * @param {int32[]} sharesData - Flat share array
     * @returns {ShamirShare[]} Shares
     */
    _parseShares(sharesData) {
      /** @type {ShamirShare[]} */
      const shares = [];
      /** @type {int32} */
      const bytesPerSecret = Math.floor((sharesData.length / this._totalShares) - 1);

      for (let i = 0; i < this._totalShares; i++) {
        /** @type {int32} */
        const offset = i * (bytesPerSecret + 1);
        /** @type {int32} */
        const x = sharesData[offset];
        /** @type {int32[]} */
        const y = sharesData.slice(offset + 1, offset + 1 + bytesPerSecret);
        shares.push(new ShamirShare(x, y));
      }

      return shares;
    }

    /**
     * Reconstruct the secret from the first k shares
     * @param {ShamirShare[]} allShares - Shares
     * @returns {uint8[]} Secret bytes
     */
    _reconstructFromShares(allShares) {
      // Use first k shares for reconstruction
      /** @type {ShamirShare[]} */
      const selectedShares = allShares.slice(0, this._threshold);

      // Reconstruct each byte
      /** @type {uint8[]} */
      const secretBytes = [];
      /** @type {int32} */
      const bytesPerShare = selectedShares[0].y.length;

      for (let byteIndex = 0; byteIndex < bytesPerShare; byteIndex++) {
        /** @type {ShamirPoint[]} */
        const points = [];
        for (let s = 0; s < selectedShares.length; s++) {
          points.push(new ShamirPoint(selectedShares[s].x, selectedShares[s].y[byteIndex]));
        }

        secretBytes.push(this._lagrangeInterpolation(points));
      }

      return secretBytes;
    }

    /**
     * Evaluate a random polynomial with constant term secret at x = 1..n
     * @param {uint8} secret - Secret byte
     * @returns {int32[]} The n share values
     */
    _generateSharesForByte(secret) {
      // Generate random coefficients for polynomial of degree k-1
      /** @type {int32[]} */
      const coefficients = [secret]; // a0 = secret
      for (let i = 1; i < this._threshold; i++) {
        coefficients.push(this._randomByte());
      }

      // Evaluate polynomial at points x = 1, 2, ..., n
      /** @type {int32[]} */
      const values = [];
      for (let x = 1; x <= this._totalShares; x++) {
        values.push(this._evaluatePolynomial(coefficients, x));
      }

      return values;
    }

    /**
     * @returns {uint8[]} Secret reconstructed from the configured shares
     */
    _reconstructSecret() {
      if (this._shares.length < this._threshold) {
        throw new Error("Need at least " + this._threshold + " shares for reconstruction");
      }

      return this._reconstructFromShares(this._shares);
    }

    /**
     * @param {int32[]} coefficients - Polynomial coefficients, constant term first
     * @param {int32} x - Evaluation point
     * @returns {int32} Polynomial value in GF(257)
     */
    _evaluatePolynomial(coefficients, x) {
      /** @type {int32} */
      let result = 0;
      for (let i = 0; i < coefficients.length; i++) {
        result = this._fieldAdd(result, this._fieldMul(coefficients[i], this._fieldPow(x, i)));
      }
      return result;
    }

    /**
     * Lagrange interpolation at x = 0
     * @param {ShamirPoint[]} points - Points
     * @returns {int32} Value at 0
     */
    _lagrangeInterpolation(points) {
      /** @type {int32} */
      let secret = 0;

      for (let i = 0; i < points.length; i++) {
        /** @type {int32} */
        let numerator = 1;
        /** @type {int32} */
        let denominator = 1;

        for (let j = 0; j < points.length; j++) {
          if (i !== j) {
            // For numerator: (0 - x_j) = -x_j in field
            numerator = this._fieldMul(numerator, this._fieldSub(0, points[j].x));
            // For denominator: (x_i - x_j) in field
            denominator = this._fieldMul(denominator, this._fieldSub(points[i].x, points[j].x));
          }
        }

        /** @type {int32} */
        const term = this._fieldMul(points[i].y, this._fieldDiv(numerator, denominator));
        secret = this._fieldAdd(secret, term);
      }

      return secret;
    }

    // Finite field arithmetic over GF(257)

    /**
     * @param {int32} a - Operand
     * @param {int32} b - Operand
     * @returns {int32} a + b mod p
     */
    _fieldAdd(a, b) {
      return (a + b) % this.PRIME;
    }

    /**
     * @param {int32} a - Operand
     * @param {int32} b - Operand
     * @returns {int32} a - b mod p
     */
    _fieldSub(a, b) {
      return (a - b + this.PRIME) % this.PRIME;
    }

    /**
     * @param {int32} a - Operand
     * @param {int32} b - Operand
     * @returns {int32} a * b mod p
     */
    _fieldMul(a, b) {
      return (a * b) % this.PRIME;
    }

    /**
     * @param {int32} a - Dividend
     * @param {int32} b - Divisor
     * @returns {int32} a / b mod p
     */
    _fieldDiv(a, b) {
      return this._fieldMul(a, this._fieldInverse(b));
    }

    /**
     * @param {int32} base - Base
     * @param {int32} exp - Exponent
     * @returns {int32} base^exp mod p
     */
    _fieldPow(base, exp) {
      /** @type {int32} */
      let result = 1;
      /** @type {int32} */
      let b = base % this.PRIME;
      /** @type {int32} */
      let e = exp;
      while (e > 0) {
        if (e % 2 === 1) {
          result = this._fieldMul(result, b);
        }
        e = Math.floor(e / 2);
        b = this._fieldMul(b, b);
      }
      return result;
    }

    /**
     * @param {int32} a - Value
     * @returns {int32} a^-1 mod p
     */
    _fieldInverse(a) {
      // Extended Euclidean algorithm for modular inverse
      if (a === 0) throw new Error("Cannot compute inverse of 0");

      /** @type {ExtendedGcd} */
      const extended = this._extendedGCD(a, this.PRIME);
      if (extended.gcd !== 1) throw new Error("Inverse does not exist");

      return (extended.x % this.PRIME + this.PRIME) % this.PRIME;
    }

    /**
     * @param {int32} a - First value
     * @param {int32} b - Second value
     * @returns {ExtendedGcd} gcd and Bezout coefficients
     */
    _extendedGCD(a, b) {
      if (a === 0) return new ExtendedGcd(b, 0, 1);

      /** @type {ExtendedGcd} */
      const inner = this._extendedGCD(b % a, a);
      return new ExtendedGcd(inner.gcd, inner.y - Math.floor(b / a) * inner.x, inner.x);
    }

    /**
     * Generate deterministic or random byte
     * @returns {int32} Random byte (0-255)
     */
    _randomByte() {
      if (this._seed) {
        // Deterministic: Linear Congruential Generator
        // Using MINSTD parameters (a=48271, c=0, m=2^31-1)
        /** @type {uint64} */
        const product = this._rngState * 48271;
        this._rngState = product % 0x7FFFFFFF;
        return OpCodes.And32(this._rngState, 0xFF);
      } else {
        // Non-deterministic
        return Math.floor(Math.random() * 256);
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ShamirSecretSharingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ShamirSecretSharingAlgorithm, ShamirSecretSharingInstance };
}));