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
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

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
    this.tests = [
      {
        text: "Simple 3-of-5 secret sharing test",
        uri: "https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf",
        input: [123], // Secret byte value 123
        threshold: 3,
        shares: 5,
        expected: "shares" // Will generate 5 shares, any 3 can reconstruct 123
      },
      {
        text: "Multi-byte secret sharing test",
        uri: "https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf",
        input: [72, 101, 108, 108, 111], // "Hello"
        threshold: 2,
        shares: 3,
        expected: "shares" // Will generate 3 shares, any 2 can reconstruct "Hello"
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new ShamirSecretSharingInstance(this, isInverse);
  }
}

class ShamirSecretSharingInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this.threshold = 3; // Default k=3
    this.totalShares = 5; // Default n=5
    this.shares = []; // For reconstruction
    
    // Finite field parameters (GF(256) for byte operations)
    this.PRIME = 257; // Next prime after 256 for GF(257)
  }

  SetThreshold(k) {
    if (k < 2) throw new Error("Threshold must be at least 2");
    this.threshold = k;
  }

  SetTotalShares(n) {
    if (n < this.threshold) throw new Error("Total shares must be >= threshold");
    if (n > 255) throw new Error("Maximum 255 shares supported");
    this.totalShares = n;
  }

  SetShares(shares) {
    // For reconstruction: shares is array of {x, y} objects
    this.shares = shares;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    this.inputBuffer.push(...data);
  }

  Result() {
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    if (this.isInverse) {
      return this._reconstructSecret();
    } else {
      return this._generateShares();
    }
  }

  _generateShares() {
    const shares = [];
    
    // Generate shares for each byte of the secret
    for (let byteIndex = 0; byteIndex < this.inputBuffer.length; byteIndex++) {
      const secret = this.inputBuffer[byteIndex];
      const byteShares = this._generateSharesForByte(secret);
      
      for (let i = 0; i < this.totalShares; i++) {
        if (!shares[i]) shares[i] = { x: i + 1, y: [] };
        shares[i].y.push(byteShares[i].y);
      }
    }

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

  _generateSharesForByte(secret) {
    // Generate random coefficients for polynomial of degree k-1
    const coefficients = [secret]; // a0 = secret
    for (let i = 1; i < this.threshold; i++) {
      coefficients.push(this._randomByte());
    }

    // Evaluate polynomial at points x = 1, 2, ..., n
    const shares = [];
    for (let x = 1; x <= this.totalShares; x++) {
      const y = this._evaluatePolynomial(coefficients, x);
      shares.push({ x: x, y: y });
    }

    return shares;
  }

  _reconstructSecret() {
    if (this.shares.length < this.threshold) {
      throw new Error(`Need at least ${this.threshold} shares for reconstruction`);
    }

    // Use first k shares for reconstruction
    const selectedShares = this.shares.slice(0, this.threshold);
    
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
          numerator = this._fieldMul(numerator, 0 - points[j].x);
          denominator = this._fieldMul(denominator, points[i].x - points[j].x);
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

  _randomByte() {
    // Simple PRNG for educational purposes
    return Math.floor(Math.random() * 256);
  }
}

// Register the algorithm
RegisterAlgorithm(new ShamirSecretSharingAlgorithm());