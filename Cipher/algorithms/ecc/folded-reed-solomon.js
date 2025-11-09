/*
 * Folded Reed-Solomon Code Implementation
 * Reed-Solomon codes with folding transformation achieving list-decoding capacity
 * (c)2006-2025 Hawkynt
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class FoldedReedSolomonAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Folded Reed-Solomon";
      this.description = "Reed-Solomon codes with folding transformation achieving list-decoding capacity. Bundles consecutive symbols into super-symbols for improved error correction. Enables list decoding beyond the unique decoding bound up to (1-R-ε) fraction of errors. First explicit codes achieving list-decoding capacity with efficient algorithms. Educational implementation demonstrates folding concept and systematic encoding over GF(256).";
      this.inventor = "Venkatesan Guruswami, Atri Rudra";
      this.year = 2006;
      this.category = CategoryType.ECC;
      this.subCategory = "Algebraic Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Research algorithm without standardized vectors
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - Folded RS", "https://errorcorrectionzoo.org/c/folded_reed_solomon"),
        new LinkItem("Wikipedia - List Decoding", "https://en.wikipedia.org/wiki/List_decoding"),
        new LinkItem("Guruswami-Rudra Paper", "https://www.cs.cmu.edu/~venkatg/pubs/papers/listdec-journ.pdf")
      ];

      this.references = [
        new LinkItem("Essential Coding Theory", "http://www.cse.buffalo.edu/~atri/courses/coding-theory/book/"),
        new LinkItem("List Decoding Tutorial", "https://people.csail.mit.edu/madhu/ST03/scribe/lect06.pdf"),
        new LinkItem("Folded RS Capacity", "https://arxiv.org/abs/cs/0508023")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "List Decoding Complexity",
          "List decoding is computationally more complex than unique decoding, requiring polynomial interpolation and root-finding."
        ),
        new Vulnerability(
          "Field Size Requirements",
          "Requires large field sizes for good parameters. Field size must be at least n for [n,k] base RS code."
        ),
        new Vulnerability(
          "Folding Overhead",
          "Folding reduces the code rate by factor of s (folding parameter), trading rate for list-decodability."
        )
      ];

      // IMPORTANT: No official test vectors exist for Folded Reed-Solomon codes
      // The Guruswami-Rudra 2006 paper and subsequent research focus on theoretical
      // list-decoding algorithms without providing concrete numerical test vectors.
      // These tests use round-trip validation: encode then decode should match original data
      //
      // Base RS: [16,8] over GF(256), folding s=2 → [8,4] with 2-symbol super-symbols
      // Input: 8 GF(256) data symbols
      // Output: 16 GF(256) symbols (8 data + 8 parity)
      this.tests = [
        {
          text: "Folded RS [8,4] zero data round-trip",
          uri: "https://errorcorrectionzoo.org/c/folded_reed_solomon",
          input: [0, 0, 0, 0, 0, 0, 0, 0] // 8 GF(256) symbols (4 super-symbols)
          // No 'expected' field - will test round-trip: encode → decode → should match input
        },
        {
          text: "Folded RS [8,4] sequential data round-trip",
          uri: "https://www.cs.cmu.edu/~venkatg/teaching/codingtheory/notes/notes11.pdf",
          input: [1, 2, 3, 4, 5, 6, 7, 8] // Sequential GF(256) symbols
        },
        {
          text: "Folded RS [8,4] max value data round-trip",
          uri: "https://arxiv.org/abs/cs/0511072",
          input: [255, 254, 253, 252, 128, 64, 32, 16] // GF(256) values
        },
        {
          text: "Folded RS [8,4] repeated pattern round-trip",
          uri: "http://www.cse.buffalo.edu/~atri/courses/coding-theory/book/",
          input: [42, 42, 42, 42, 99, 99, 99, 99] // Repeated values
        },
        {
          text: "Folded RS [8,4] alternating pattern round-trip",
          uri: "https://errorcorrectionzoo.org/c/folded_reed_solomon",
          input: [1, 255, 2, 254, 3, 253, 4, 252] // Alternating values
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new FoldedReedSolomonInstance(this, isInverse);
    }
  }

  class FoldedReedSolomonInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Folded Reed-Solomon parameters
      // Base RS code: [n,k] over GF(q)
      // After folding with parameter s: [n/s, k/s] over GF(q)^s
      //
      // We use [16, 8] RS code over GF(256) with folding s=2
      // Result: [8, 4] code where each position holds 2 GF(256) symbols
      this.n = 16;       // Base RS code length
      this.k = 8;        // Base RS data symbols
      this.s = 2;        // Folding parameter (bundle pairs)
      this.field = 256;  // GF(256) = GF(2^8)
      this.primitive = 285; // Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1

      // Folded code parameters (conceptual - we work with unfolded representation)
      this.foldedN = this.n / this.s;     // 8 super-symbol positions
      this.foldedK = this.k / this.s;     // 4 data super-symbols
      this.superSymbolSize = this.s;      // Each super-symbol = 2 GF(256) symbols

      // Initialize Galois Field GF(256)
      this.initializeGaloisField();

      // Compute generator polynomial for base [16,8] RS code
      this.generator = this.computeGenerator();
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('FoldedReedSolomonInstance.Feed: Input must be symbol array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('FoldedReedSolomonInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      if (!Array.isArray(data)) {
        throw new Error('FoldedReedSolomonInstance.DetectError: Input must be symbol array');
      }

      // Unfold and check syndromes
      const unfolded = this.unfold(data);
      const syndromes = this.calculateSyndromes(unfolded);
      return syndromes.some(s => s !== 0);
    }

    encode(data) {
      // Folded RS encoding
      // Input: k=8 GF(256) data symbols (foldedK=4 super-symbols of size s=2)
      // Output: n=16 GF(256) symbols (foldedN=8 super-symbols of size s=2)
      //
      // The folding is conceptual - we encode using base RS [16,8] and the
      // codeword can be interpreted as 8 super-symbols of 2 base symbols each

      if (data.length !== this.k) {
        throw new Error(`Folded RS encode: Input must be exactly ${this.k} symbols (${this.foldedK} super-symbols of size ${this.superSymbolSize})`);
      }

      // Validate symbols are in field range
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] >= this.field) {
          throw new Error(`Folded RS: Symbol ${data[i]} at position ${i} out of range [0, ${this.field-1}]`);
        }
      }

      // Encode using base RS [16,8] code over GF(256)
      const rsEncoded = this.encodeBaseRS(data);

      // The folding is implicit in the interpretation:
      // The 16 output symbols can be viewed as 8 super-symbols of size 2
      return rsEncoded;
    }

    decode(data) {
      // Folded RS decoding with error detection
      // Input: n=16 GF(256) symbols (foldedN=8 super-symbols)
      // Output: k=8 GF(256) data symbols (foldedK=4 super-symbols)

      if (data.length !== this.n) {
        throw new Error(`Folded RS decode: Input must be exactly ${this.n} symbols (${this.foldedN} super-symbols)`);
      }

      // Validate symbols
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] >= this.field) {
          throw new Error(`Folded RS: Symbol ${data[i]} at position ${i} out of range [0, ${this.field-1}]`);
        }
      }

      // Calculate syndromes on the received word
      const syndromes = this.calculateSyndromes(data);

      // Check if any errors exist
      if (syndromes.every(s => s === 0)) {
        // No errors, extract data symbols
        return data.slice(0, this.k);
      }

      console.warn('Folded RS: Errors detected in received word');

      // Simplified error correction
      // Full list decoding would use Guruswami-Sudan algorithm
      // For educational purposes, we attempt basic correction
      const corrected = this.correctErrors([...data], syndromes);

      // Extract data portion
      return corrected.slice(0, this.k);
    }

    initializeGaloisField() {
      // Initialize log and antilog tables for GF(256)
      // Using primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (285 in decimal)
      this.gfLog = new Array(this.field);
      this.gfAntilog = new Array(this.field);

      let x = 1;
      for (let i = 0; i < this.field - 1; ++i) {
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

    gfAdd(a, b) {
      // Addition in GF(2^m) is XOR
      return a ^ b;
    }

    gfPower(base, exponent) {
      // Compute base^exponent in Galois Field
      if (base === 0) return 0;
      if (exponent === 0) return 1;
      return this.gfAntilog[(this.gfLog[base] * exponent) % (this.field - 1)];
    }

    computeGenerator() {
      // Compute generator polynomial (x-α^0)(x-α^1)...(x-α^(n-k-1))
      // For [8,4] code, we need (n-k) = 4 roots
      let gen = [1]; // Start with polynomial "1"

      for (let i = 0; i < this.n - this.k; ++i) {
        const alpha_i = this.gfAntilog[i % (this.field - 1)];
        const newGen = new Array(gen.length + 1).fill(0);

        // Multiply by (x - α^i)
        for (let j = 0; j < gen.length; ++j) {
          newGen[j] = this.gfAdd(newGen[j], this.gfMultiply(gen[j], alpha_i));
          newGen[j + 1] = this.gfAdd(newGen[j + 1], gen[j]);
        }
        gen = newGen;
      }

      return gen;
    }

    encodeBaseRS(data) {
      // Systematic RS encoding for [16,8] code over GF(256)
      const encoded = new Array(this.n);

      // Copy data symbols to first k positions
      for (let i = 0; i < this.k; ++i) {
        encoded[i] = data[i];
      }

      // Calculate parity symbols using polynomial division
      const parity = this.calculateParity(data);

      // Append parity symbols
      for (let i = 0; i < parity.length; ++i) {
        encoded[this.k + i] = parity[i];
      }

      return encoded;
    }

    calculateParity(data) {
      // Calculate parity symbols using polynomial division
      // For [n,k] code, we have (n-k) parity symbols
      const parityCount = this.n - this.k;
      const parity = new Array(parityCount).fill(0);

      // Process each data symbol
      for (let i = 0; i < this.k; ++i) {
        const coeff = this.gfAdd(data[i], parity[0]);

        // Shift parity register and apply generator polynomial
        for (let j = 0; j < parityCount - 1; ++j) {
          parity[j] = this.gfAdd(parity[j + 1], this.gfMultiply(this.generator[j], coeff));
        }

        // Last parity symbol
        parity[parityCount - 1] = this.gfMultiply(this.generator[parityCount - 1], coeff);
      }

      return parity;
    }

    calculateSyndromes(data) {
      // Calculate syndrome polynomial S(x)
      const syndromes = new Array(this.n - this.k);

      for (let i = 0; i < this.n - this.k; ++i) {
        syndromes[i] = 0;
        const alpha_i = this.gfAntilog[i % (this.field - 1)];
        let alpha_power = 1;

        for (let j = 0; j < data.length; ++j) {
          syndromes[i] = this.gfAdd(syndromes[i], this.gfMultiply(data[j], alpha_power));
          alpha_power = this.gfMultiply(alpha_power, alpha_i);
        }
      }

      return syndromes;
    }

    correctErrors(received, syndromes) {
      // Simplified error correction for educational purposes
      // Full implementation would use Guruswami-Sudan list decoding algorithm
      // For now, attempt single error correction if syndromes indicate one error

      // Check if it's a single error pattern
      if (syndromes[0] !== 0 && syndromes.length > 1) {
        // Try to locate and correct single error
        // This is a simplified approach - real list decoding is more complex
        for (let pos = 0; pos < received.length; ++pos) {
          // Try correcting at this position
          const testReceived = [...received];
          testReceived[pos] = this.gfAdd(testReceived[pos], syndromes[0]);

          const testSyndromes = this.calculateSyndromes(testReceived);
          if (testSyndromes.every(s => s === 0)) {
            console.log(`Folded RS: Corrected error at position ${pos}`);
            return testReceived;
          }
        }
      }

      console.warn('Folded RS: Could not correct errors - returning received word');
      return received;
    }

    unfold(foldedData) {
      // Unfold super-symbols back to base RS symbols
      // In our representation, data is already unfolded
      return foldedData;
    }

    fold(baseData) {
      // Fold base RS symbols into super-symbols
      // In our representation, this is implicit
      return baseData;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new FoldedReedSolomonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FoldedReedSolomonAlgorithm, FoldedReedSolomonInstance };
}));
