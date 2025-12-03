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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ShamirSecretSharingInstance(this, isInverse);
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._threshold = 3; // Default k=3
      this._totalShares = 5; // Default n=5
      this._shares = []; // For reconstruction
      this._testReconstruction = false; // Special mode for testing
      this._seed = null; // Seed for deterministic RNG
      this._rngState = 0; // RNG state

      // Finite field parameters (GF(256) for byte operations)
      this.PRIME = 257; // Next prime after 256 for GF(257)
    }

    set threshold(k) {
      if (k < 2) throw new Error("Threshold must be at least 2");
      this._threshold = k;
    }

    get threshold() {
      return this._threshold;
    }

    set totalShares(n) {
      if (n < this._threshold) throw new Error("Total shares must be >= threshold");
      if (n > 255) throw new Error("Maximum 255 shares supported");
      this._totalShares = n;
    }

    get totalShares() {
      return this._totalShares;
    }

    set shares(sharesData) {
      // For reconstruction: shares is array of {x, y} objects
      this._shares = sharesData;
    }

    get shares() {
      return this._shares;
    }

    set testReconstruction(value) {
      this._testReconstruction = !!value;
    }

    get testReconstruction() {
      return this._testReconstruction;
    }

    /**
     * Set seed for deterministic random number generation
     * Used for testing purposes to make share generation reproducible
     * @param {Array} seedBytes - Seed bytes for PRNG initialization
     */
    set seed(seedBytes) {
      if (!seedBytes) {
        this._seed = null;
        this._rngState = 0;
        return;
      }
      this._seed = [...seedBytes];
      // Initialize RNG state from seed using simple hash
      this._rngState = 0;
      for (let i = 0; i < this._seed.length; i++) {
        this._rngState = OpCodes.ToUint32((this._rngState * 31) + this._seed[i]);
      }
      // Ensure non-zero state
      if (this._rngState === 0) this._rngState = 1;
    }

    get seed() {
      return this._seed ? [...this._seed] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
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
        const sharesData = this._generateShares();

        if (this._testReconstruction) {
          // Parse shares and reconstruct to verify
          const parsedShares = this._parseShares(sharesData);
          const reconstructed = this._reconstructFromParsedShares(parsedShares);
          return reconstructed;
        } else {
          return sharesData;
        }
      }
    }

    _generateShares() {
      const shares = [];

      // Generate shares for each byte of the secret
      for (let byteIndex = 0; byteIndex < this.inputBuffer.length; byteIndex++) {
        const secret = this.inputBuffer[byteIndex];
        const byteShares = this._generateSharesForByte(secret);

        for (let i = 0; i < this._totalShares; i++) {
          if (!shares[i]) shares[i] = { x: i + 1, y: [] };
          shares[i].y.push(byteShares[i].y);
        }
      }

      // Save original input for later reference
      const originalInput = [...this.inputBuffer];

      // Clear input buffer
      this.inputBuffer = [];

      // Return shares as flat byte array: [x1, y1_byte1, y1_byte2, ..., x2, y2_byte1, y2_byte2, ...]
      const result = [];
      for (const share of shares) {
        result.push(share.x);
        result.push(...share.y);
      }

      return result;
    }

    _parseShares(sharesData) {
      // Parse flat byte array back into shares structure
      const shares = [];
      const bytesPerSecret = Math.floor((sharesData.length / this._totalShares) - 1);

      for (let i = 0; i < this._totalShares; i++) {
        const offset = i * (bytesPerSecret + 1);
        const x = sharesData[offset];
        const y = sharesData.slice(offset + 1, offset + 1 + bytesPerSecret);
        shares.push({ x: x, y: Array.from(y) });
      }

      return shares;
    }

    _reconstructFromParsedShares(parsedShares) {
      // Use first k shares for reconstruction
      const selectedShares = parsedShares.slice(0, this._threshold);

      // Reconstruct each byte
      const secretBytes = [];
      const bytesPerShare = selectedShares[0].y.length;

      for (let byteIndex = 0; byteIndex < bytesPerShare; byteIndex++) {
        const points = selectedShares.map(share => ({
          x: share.x,
          y: share.y[byteIndex]
        }));

        const secretByte = this._lagrangeInterpolation(points);
        secretBytes.push(secretByte);
      }

      return secretBytes;
    }

    _generateSharesForByte(secret) {
      // Generate random coefficients for polynomial of degree k-1
      const coefficients = [secret]; // a0 = secret
      for (let i = 1; i < this._threshold; i++) {
        coefficients.push(this._randomByte());
      }

      // Evaluate polynomial at points x = 1, 2, ..., n
      const shares = [];
      for (let x = 1; x <= this._totalShares; x++) {
        const y = this._evaluatePolynomial(coefficients, x);
        shares.push({ x: x, y: y });
      }

      return shares;
    }

    _reconstructSecret() {
      if (this._shares.length < this._threshold) {
        throw new Error(`Need at least ${this._threshold} shares for reconstruction`);
      }

      // Use first k shares for reconstruction
      const selectedShares = this._shares.slice(0, this._threshold);

      // Reconstruct each byte
      const secretBytes = [];
      const bytesPerShare = selectedShares[0].y.length;

      for (let byteIndex = 0; byteIndex < bytesPerShare; byteIndex++) {
        const points = selectedShares.map(share => ({
          x: share.x,
          y: share.y[byteIndex]
        }));

        const secretByte = this._lagrangeInterpolation(points);
        secretBytes.push(secretByte);
      }

      return secretBytes;
    }

    _evaluatePolynomial(coefficients, x) {
      let result = 0;
      for (let i = 0; i < coefficients.length; i++) {
        result = this._fieldAdd(result, this._fieldMul(coefficients[i], this._fieldPow(x, i)));
      }
      return result;
    }

    _lagrangeInterpolation(points) {
      let secret = 0;

      for (let i = 0; i < points.length; i++) {
        let numerator = 1;
        let denominator = 1;

        for (let j = 0; j < points.length; j++) {
          if (i !== j) {
            // For numerator: (0 - x_j) = -x_j in field
            numerator = this._fieldMul(numerator, this._fieldSub(0, points[j].x));
            // For denominator: (x_i - x_j) in field
            denominator = this._fieldMul(denominator, this._fieldSub(points[i].x, points[j].x));
          }
        }

        const term = this._fieldMul(points[i].y, this._fieldDiv(numerator, denominator));
        secret = this._fieldAdd(secret, term);
      }

      return secret;
    }

    // Finite field arithmetic over GF(257)
    _fieldAdd(a, b) {
      return (a + b) % this.PRIME;
    }

    _fieldSub(a, b) {
      return (a - b + this.PRIME) % this.PRIME;
    }

    _fieldMul(a, b) {
      return (a * b) % this.PRIME;
    }

    _fieldDiv(a, b) {
      return this._fieldMul(a, this._fieldInverse(b));
    }

    _fieldPow(base, exp) {
      let result = 1;
      base = base % this.PRIME;
      while (exp > 0) {
        if (exp % 2 === 1) {
          result = this._fieldMul(result, base);
        }
        exp = Math.floor(exp / 2);
        base = this._fieldMul(base, base);
      }
      return result;
    }

    _fieldInverse(a) {
      // Extended Euclidean algorithm for modular inverse
      if (a === 0) throw new Error("Cannot compute inverse of 0");

      let extended = this._extendedGCD(a, this.PRIME);
      if (extended.gcd !== 1) throw new Error("Inverse does not exist");

      return (extended.x % this.PRIME + this.PRIME) % this.PRIME;
    }

    _extendedGCD(a, b) {
      if (a === 0) return { gcd: b, x: 0, y: 1 };

      const gcd = this._extendedGCD(b % a, a);
      return {
        gcd: gcd.gcd,
        x: gcd.y - Math.floor(b / a) * gcd.x,
        y: gcd.x
      };
    }

    /**
     * Generate deterministic or secure random byte
     * @returns {number} Random byte (0-255)
     */
    _randomByte() {
      if (this._seed) {
        // Deterministic: Linear Congruential Generator
        // Using MINSTD parameters (a=48271, c=0, m=2^31-1)
        this._rngState = (this._rngState * 48271) % 0x7FFFFFFF;
        return OpCodes.AndN(this._rngState, 0xFF);
      } else {
        // Non-deterministic: Use Math.random (or OpCodes.SecureRandom if available)
        if (typeof OpCodes !== 'undefined' && OpCodes.SecureRandom) {
          return OpCodes.SecureRandom(256);
        } else {
          return Math.floor(Math.random() * 256);
        }
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