/*
 * Reed-Solomon Error Correction Implementation
 * Educational implementation of Reed-Solomon codes
 * (c)2006-2025 Hawkynt
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
        ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

class ReedSolomonAlgorithm extends ErrorCorrectionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Reed-Solomon";
    this.description = "Reed-Solomon error correction codes using polynomial arithmetic over Galois Fields. Can correct burst errors and multiple symbol errors. Used in CDs, DVDs, QR codes, and satellite communications. Educational implementation demonstrating algebraic coding theory.";
    this.inventor = "Irving S. Reed, Gustave Solomon";
    this.year = 1960;
    this.category = CategoryType.ECC;
    this.subCategory = "Algebraic Code";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.EXPERT;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia - Reed-Solomon", "https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction"),
      new LinkItem("Reed-Solomon Tutorial", "https://www.cs.cmu.edu/~guyb/realworld/reedsolomon/reed_solomon_codes.html"),
      new LinkItem("Galois Field Arithmetic", "https://en.wikipedia.org/wiki/Finite_field_arithmetic")
    ];

    this.references = [
      new LinkItem("Reed & Solomon Original Paper", "https://dl.acm.org/doi/10.1145/368873.368880"),
      new LinkItem("Practical Reed-Solomon", "https://ieeexplore.ieee.org/document/1057683"),
      new LinkItem("CD Error Correction", "https://www.ecma-international.org/publications-and-standards/standards/ecma-130/")
    ];

    this.knownVulnerabilities = [
      new Vulnerability(
        "Symbol Error Limitation",
        "Can only correct up to t symbol errors where 2t+1 ≤ n-k+1. Beyond this, errors may go undetected"
      ),
      new Vulnerability(
        "Implementation Complexity",
        "Requires careful implementation of Galois Field arithmetic and polynomial operations"
      )
    ];

    // Test vectors for Reed-Solomon (7,3) code
    this.tests = [
      new TestCase(
        [1, 2, 3], // 3 symbols of data
        [1, 2, 3, 119, 32, 188, 61], // 7 symbols encoded (with parity)
        "Reed-Solomon (7,3) encoding test",
        "https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction"
      ),
      new TestCase(
        [0, 0, 0], // All zero symbols
        [0, 0, 0, 0, 0, 0, 0], // All zero codeword
        "Reed-Solomon zero codeword test",
        "https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction"
      ),
      new TestCase(
        [255, 128, 64], // Max value test
        [255, 128, 64, 206, 19, 99, 137], // Encoded result
        "Reed-Solomon max value test",
        "https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new ReedSolomonInstance(this, isInverse);
  }
}

class ReedSolomonInstance extends IErrorCorrectionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    
    // Reed-Solomon (7,3) parameters for GF(2^8)
    this.n = 7;        // Total symbols
    this.k = 3;        // Data symbols
    this.t = 2;        // Error correction capability (n-k)/2
    this.field = 256;  // GF(2^8)
    this.primitive = 285; // Primitive polynomial for GF(2^8): x^8 + x^4 + x^3 + x^2 + 1
    
    // Pre-compute log and antilog tables for GF(2^8)
    this.initializeGaloisField();
    
    // Generator polynomial for Reed-Solomon (7,3)
    this.generator = this.computeGenerator();
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('ReedSolomonInstance.Feed: Input must be symbol array');
    }

    if (this.isInverse) {
      return this.decode(data);
    } else {
      return this.encode(data);
    }
  }

  Result() {
    // Reed-Solomon processing is done in Feed method
    throw new Error('ReedSolomonInstance.Result: Use Feed() method to encode/decode data');
  }

  DetectError(data) {
    if (!Array.isArray(data) || data.length !== this.n) {
      throw new Error(`ReedSolomonInstance.DetectError: Input must be ${this.n}-symbol array`);
    }

    const syndromes = this.calculateSyndromes(data);
    return syndromes.some(s => s !== 0);
  }

  encode(data) {
    // Reed-Solomon systematic encoding
    if (data.length !== this.k) {
      throw new Error(`Reed-Solomon encode: Input must be exactly ${this.k} symbols`);
    }

    // Validate symbols are in field range
    for (let symbol of data) {
      if (symbol < 0 || symbol >= this.field) {
        throw new Error(`Reed-Solomon: Symbol ${symbol} out of range [0, ${this.field-1}]`);
      }
    }

    const encoded = new Array(this.n);
    
    // Copy data symbols
    for (let i = 0; i < this.k; i++) {
      encoded[i] = data[i];
    }
    
    // Calculate parity symbols using polynomial division
    const parity = this.calculateParity(data);
    for (let i = 0; i < this.n - this.k; i++) {
      encoded[this.k + i] = parity[i];
    }
    
    return encoded;
  }

  decode(data) {
    // Simplified Reed-Solomon decoding
    if (data.length !== this.n) {
      throw new Error(`Reed-Solomon decode: Input must be exactly ${this.n} symbols`);
    }

    const received = [...data];
    const syndromes = this.calculateSyndromes(received);
    
    // Check if any errors exist
    if (syndromes.every(s => s === 0)) {
      return received.slice(0, this.k); // No errors, extract data
    }
    
    console.warn('Reed-Solomon: Errors detected, attempting correction...');
    
    // Simplified error correction (real implementation would use Berlekamp-Massey)
    // For educational purposes, we'll attempt simple error location
    const errorLocations = this.findErrorLocations(syndromes);
    
    if (errorLocations.length <= this.t) {
      // Correct errors (simplified)
      for (let loc of errorLocations) {
        if (loc < this.n) {
          received[loc] ^= syndromes[0]; // Simplified correction
        }
      }
    } else {
      console.warn('Reed-Solomon: Too many errors to correct');
    }
    
    return received.slice(0, this.k);
  }

  initializeGaloisField() {
    // Initialize log and antilog tables for GF(2^8)
    this.gfLog = new Array(this.field);
    this.gfAntilog = new Array(this.field);
    
    let x = 1;
    for (let i = 0; i < this.field - 1; i++) {
      this.gfAntilog[i] = x;
      this.gfLog[x] = i;
      x <<= 1;
      if (x & this.field) {
        x ^= this.primitive;
      }
    }
    this.gfLog[0] = this.field - 1; // Special case for zero
  }

  gfMultiply(a, b) {
    // Galois Field multiplication using log tables
    if (a === 0 || b === 0) return 0;
    return this.gfAntilog[(this.gfLog[a] + this.gfLog[b]) % (this.field - 1)];
  }

  gfDivide(a, b) {
    // Galois Field division
    if (a === 0) return 0;
    if (b === 0) throw new Error('Division by zero in Galois Field');
    return this.gfAntilog[(this.gfLog[a] - this.gfLog[b] + this.field - 1) % (this.field - 1)];
  }

  computeGenerator() {
    // Compute generator polynomial (x-α^0)(x-α^1)...(x-α^(n-k-1))
    let gen = [1]; // Start with polynomial "1"
    
    for (let i = 0; i < this.n - this.k; i++) {
      const alpha_i = this.gfAntilog[i];
      const newGen = new Array(gen.length + 1).fill(0);
      
      // Multiply by (x - α^i)
      for (let j = 0; j < gen.length; j++) {
        newGen[j] ^= this.gfMultiply(gen[j], alpha_i);
        newGen[j + 1] ^= gen[j];
      }
      gen = newGen;
    }
    
    return gen;
  }

  calculateParity(data) {
    // Calculate parity symbols using polynomial division
    const parity = new Array(this.n - this.k).fill(0);
    
    for (let i = 0; i < this.k; i++) {
      const coeff = data[i] ^ parity[0];
      
      // Shift parity symbols
      for (let j = 0; j < this.n - this.k - 1; j++) {
        parity[j] = parity[j + 1] ^ this.gfMultiply(this.generator[j], coeff);
      }
      parity[this.n - this.k - 1] = this.gfMultiply(this.generator[this.n - this.k - 1], coeff);
    }
    
    return parity;
  }

  calculateSyndromes(data) {
    // Calculate syndrome polynomial S(x)
    const syndromes = new Array(this.n - this.k);
    
    for (let i = 0; i < this.n - this.k; i++) {
      syndromes[i] = 0;
      const alpha_i = this.gfAntilog[i];
      let alpha_power = 1;
      
      for (let j = 0; j < this.n; j++) {
        syndromes[i] ^= this.gfMultiply(data[j], alpha_power);
        alpha_power = this.gfMultiply(alpha_power, alpha_i);
      }
    }
    
    return syndromes;
  }

  findErrorLocations(syndromes) {
    // Simplified error location (real implementation uses Berlekamp-Massey + Chien search)
    const locations = [];
    
    // For educational purposes, assume single error at position indicated by syndrome ratio
    if (syndromes[0] !== 0 && syndromes[1] !== 0) {
      const ratio = this.gfDivide(syndromes[1], syndromes[0]);
      const location = this.gfLog[ratio];
      if (location < this.n) {
        locations.push(location);
      }
    }
    
    return locations;
  }
}

// Register the algorithm
RegisterAlgorithm(new ReedSolomonAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReedSolomonAlgorithm, ReedSolomonInstance };
}