/*
 * Parvaresh-Vardy Code Implementation
 * Algebraic codes achieving list-decoding capacity with correlated polynomials
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

  /**
   * Best candidate found by the subset search
   * @class
   */
  class CandidateSearch {
    constructor() {
      /** @type {uint8[]} */
      this.best = null;
      /** @type {int32} */
      this.bestScore = -1;
    }
  }

  class ParvareshVardyAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Parvaresh-Vardy Code";
      this.description = "Algebraic codes achieving list-decoding capacity with efficient algorithms. Generalization of Reed-Solomon using correlated polynomials. First codes explicitly achieving list-decoding capacity. Enabled Guruswami-Rudra folded RS construction. Used in coding theory research and theoretical CS.";
      this.inventor = "Farzad Parvaresh, Alexander Vardy";
      this.year = 2005;
      this.category = CategoryType.ECC;
      this.subCategory = "Algebraic Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - Parvaresh-Vardy", "https://errorcorrectionzoo.org/c/parvaresh_vardy"),
        new LinkItem("Wikipedia - List Decoding", "https://en.wikipedia.org/wiki/List_decoding"),
        new LinkItem("List Decoding Capacity", "https://arxiv.org/abs/cs/0508023")
      ];

      this.references = [
        new LinkItem("Parvaresh-Vardy Original Paper", "https://ieeexplore.ieee.org/document/1510850"),
        new LinkItem("Guruswami-Rudra Codes", "https://arxiv.org/abs/cs/0508023"),
        new LinkItem("Essential Coding Theory", "http://www.cse.buffalo.edu/~atri/courses/coding-theory/book/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "List Decoding Complexity",
          "List decoding requires polynomial interpolation and root-finding. Computationally more expensive than unique decoding."
        ),
        new Vulnerability(
          "Field Size Requirements",
          "Requires sufficiently large finite field to support parameters. Field size must be at least n for [n,k] code."
        ),
        new Vulnerability(
          "Correlation Construction",
          "Security/efficiency depends on careful choice of correlated polynomial h(x). Improper correlation reduces advantages."
        )
      ];

      // Test vectors for Parvaresh-Vardy [8,2] code over GF(16)
      // Two correlated polynomials: f(x) and h(x) = f(x)^2
      // Evaluation at 8 field elements: [1,2,3,4,5,6,7,8]
      this.tests = [
        {
          text: "Parvaresh-Vardy [8,2] all zeros",
          uri: "https://errorcorrectionzoo.org/c/parvaresh_vardy",
          input: [0, 0], // f(x) = 0 (all zeros)
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // All zeros (both polynomials evaluate to 0)
        },
        {
          text: "Parvaresh-Vardy [8,2] constant polynomial",
          uri: "https://errorcorrectionzoo.org/c/parvaresh_vardy",
          input: [1, 0], // f(x) = 1 (constant)
          expected: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] // f evaluates to 1 everywhere, h = f^2 = 1 everywhere
        },
        {
          text: "Parvaresh-Vardy [8,2] linear polynomial correlation",
          uri: "https://errorcorrectionzoo.org/c/parvaresh_vardy",
          input: [0, 1], // f(x) = x (linear)
          expected: [1, 2, 3, 4, 5, 6, 7, 8, 1, 4, 5, 3, 2, 7, 6, 12] // f(x)=x, h(x)=x^2 in GF(16)
        },
        {
          text: "Parvaresh-Vardy [8,2] mixed correlation",
          uri: "https://errorcorrectionzoo.org/c/parvaresh_vardy",
          input: [1, 1], // f(x) = 1 + x
          expected: [0, 3, 2, 5, 4, 7, 6, 9, 0, 5, 4, 2, 3, 6, 7, 13] // f(x)=(1+x), h(x)=(1+x)^2 in GF(16)
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {ParvareshVardyInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ParvareshVardyInstance(this, isInverse);
    }
  }

  /**
 * ParvareshVardy cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ParvareshVardyInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ParvareshVardyAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // Parvaresh-Vardy code parameters
      // [n,k] code over GF(q)
      this.n = 8;          // Code length
      this.k = 2;          // Data symbols (polynomial degree)
      this.field = 16;     // GF(16)
      this.primitive = 19; // Primitive polynomial for GF(16): x^4 + x + 1

      // Evaluation points in GF(16)
      // Use all non-zero elements for maximum code length
      /** @type {uint8[]} */
      this.evalPoints = [1, 2, 3, 4, 5, 6, 7, 8];

      // Initialize Galois Field
      this.initializeGaloisField();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ParvareshVardyInstance.Feed: Input must be symbol array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('ParvareshVardyInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (!Array.isArray(data)) {
        throw new Error('ParvareshVardyInstance.DetectError: Input must be symbol array');
      }

      // Check if data satisfies Parvaresh-Vardy codeword property
      // A codeword is valid if the correlation property holds
      if (data.length !== this.n * 2) {
        return true; // Invalid length indicates error
      }

      return this.hasError(data);
    }

    /**
     * @param {uint8[]} data - Message symbols
     * @returns {uint8[]} Codeword symbols
     */
    encode(data) {
      // Parvaresh-Vardy encoding
      // Input: k coefficients for polynomial f(x)
      // Output: 2n symbols from evaluating f and h = f^2 at n points
      // Total output: 2n symbols (n from f, n from h)

      if (data.length !== this.k) {
        throw new Error("Parvaresh-Vardy encode: Input must be exactly " + this.k + " symbols");
      }

      // Validate symbols are in field range
      for (let s = 0; s < data.length; ++s) {
        /** @type {uint8} */
        const symbol = data[s];
        if (symbol < 0 || symbol >= this.field) {
          throw new Error("Parvaresh-Vardy: Symbol " + symbol + " out of range [0, " + (this.field-1) + "]");
        }
      }

      // Step 1: Construct polynomial f(x) from coefficients
      // f(x) = c0 + c1*x + ... + c(k-1)*x^(k-1)
      /** @type {uint8[]} */
      const f = data.slice();

      // Step 2: Evaluate f at all evaluation points
      /** @type {uint8[]} */
      const fEvals = this.evaluatePolynomial(f);

      // Step 3: Compute h(x) = f(x)^2
      /** @type {uint8[]} */
      const h = this.multiplyPolynomial(f, f);

      // Step 4: Evaluate h at all evaluation points
      /** @type {uint8[]} */
      const hEvals = this.evaluatePolynomial(h);

      // Step 5: Concatenate evaluations [f(α1), f(α2), ..., f(αn), h(α1), h(α2), ..., h(αn)]
      /** @type {uint8[]} */
      const codeword = fEvals.concat(hEvals);

      return codeword;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {uint8[]} Decoded message symbols
     */
    decode(data) {
      // Parvaresh-Vardy decoding with error detection
      // Input: 2n symbols (possibly with errors)
      // Output: k coefficients (data symbols)

      if (data.length !== this.n * 2) {
        throw new Error("Parvaresh-Vardy decode: Input must be exactly " + (this.n * 2) + " symbols");
      }

      // Validate symbols
      for (let s = 0; s < data.length; ++s) {
        /** @type {uint8} */
        const symbol = data[s];
        if (symbol < 0 || symbol >= this.field) {
          throw new Error("Parvaresh-Vardy: Symbol " + symbol + " out of range [0, " + (this.field-1) + "]");
        }
      }

      // Split received data
      /** @type {uint8[]} */
      const fReceived = data.slice(0, this.n);
      /** @type {uint8[]} */
      const hReceived = data.slice(this.n, this.n * 2);

      // Recover the message polynomial by interpolating through every k-subset
      // of evaluation points. Any subset untouched by errors reconstructs the
      // transmitted f exactly, so the candidate agreeing with the most received
      // symbols across both blocks is the maximum-likelihood choice.
      /** @type {int32[]} */
      const subset = OpCodes.CreateArray(this.k, 0);
      /** @type {CandidateSearch} */
      const found = new CandidateSearch();

      this._searchSubsets(0, 0, subset, fReceived, hReceived, found);
      /** @type {uint8[]} */
      const best = found.best;
      /** @type {int32} */
      const bestScore = found.bestScore;

      // Distinct message polynomials of degree below k agree at no more than
      // k-1 evaluation points, so each block has minimum distance n-k+1. As
      // squaring is a bijection in GF(2^m) the h block separates candidates
      // exactly where the f block does, giving the concatenation a minimum
      // distance of 2*(n-k+1) and a unique-decoding radius of half of that.
      const minimumDistance = 2 * (this.n - this.k + 1);
      const correctable = Math.floor((minimumDistance - 1) / 2);

      if (best === null || bestScore < this.n * 2 - correctable) {
        throw new Error('Parvaresh-Vardy decode: Too many errors to correct reliably');
      }

      return best;
    }

    /**
     * Try every k-subset of evaluation points, in lexicographic order
     * @param {int32} start - First point index to try at this depth
     * @param {int32} depth - Points chosen so far
     * @param {int32[]} subset - Chosen point indices
     * @param {uint8[]} fReceived - Received f block
     * @param {uint8[]} hReceived - Received h block
     * @param {CandidateSearch} found - Best candidate so far (updated)
     * @returns {void}
     */
    _searchSubsets(start, depth, subset, fReceived, hReceived, found) {
      if (depth === this.k) {
        /** @type {uint8[]} */
        const candidate = this.interpolatePolynomial(subset, fReceived);
        /** @type {int32} */
        const score = this.agreementScore(candidate, fReceived, hReceived);
        if (score > found.bestScore) {
          found.bestScore = score;
          found.best = candidate;
        }
        return;
      }

      for (let i = start; i < this.n; ++i) {
        subset[depth] = i;
        this._searchSubsets(i + 1, depth + 1, subset, fReceived, hReceived, found);
      }
    }

    /**
     * @returns {void}
     */
    initializeGaloisField() {
      // Initialize log and antilog tables for GF(16)
      /** @type {int32[]} */
      this.gfLog = new Array(this.field);
      /** @type {uint8[]} */
      this.gfAntilog = new Array(this.field);

      /** @type {uint8} */
      let x = 1;
      for (let i = 0; i < this.field - 1; ++i) {
        this.gfAntilog[i] = x;
        this.gfLog[x] = i;
        x = OpCodes.Shl8(x, 1);
        if (OpCodes.And32(x, this.field) !== 0) {
          x = OpCodes.Xor32(x, this.primitive);
        }
      }
      this.gfLog[0] = this.field - 1; // Special case for zero
    }

    /**
     * @param {uint8} a - Field element
     * @param {uint8} b - Field element
     * @returns {uint8} a * b
     */
    gfMultiply(a, b) {
      // Galois Field multiplication using log tables
      if (a === 0 || b === 0) return 0;
      return this.gfAntilog[(this.gfLog[a] + this.gfLog[b]) % (this.field - 1)];
    }

    /**
     * @param {uint8} a - Field element
     * @param {uint8} b - Field element
     * @returns {uint8} a + b
     */
    gfAdd(a, b) {
      // Addition in GF(2^m) is XOR
      return OpCodes.Xor32(a, b);
    }

    /**
     * @param {uint8} a - Field element
     * @param {uint8} b - Non-zero field element
     * @returns {uint8} a / b
     */
    gfDivide(a, b) {
      // Galois Field division using log tables
      if (b === 0) {
        throw new Error('Parvaresh-Vardy: Division by zero in GF');
      }
      if (a === 0) return 0;
      return this.gfAntilog[(this.gfLog[a] - this.gfLog[b] + (this.field - 1)) % (this.field - 1)];
    }

    /**
     * @param {uint8} base - Field element
     * @param {int32} exponent - Exponent
     * @returns {uint8} base^exponent
     */
    gfPower(base, exponent) {
      // Compute base^exponent in Galois Field
      if (base === 0) return 0;
      if (exponent === 0) return 1;
      return this.gfAntilog[(this.gfLog[base] * exponent) % (this.field - 1)];
    }

    /**
     * @param {uint8[]} coefficients - coefficients[i] scales x^i
     * @returns {uint8[]} Values at the n evaluation points
     */
    evaluatePolynomial(coefficients) {
      // Evaluate polynomial with given coefficients at all evaluation points
      // coefficients[i] is coefficient of x^i
      /** @type {uint8[]} */
      const results = OpCodes.CreateArray(this.n, 0);

      for (let i = 0; i < this.n; ++i) {
        /** @type {uint8} */
        const point = this.evalPoints[i];
        /** @type {uint8} */
        let value = 0;
        /** @type {uint8} */
        let pointPower = 1; // point^0 = 1

        for (let j = 0; j < coefficients.length; ++j) {
          // Add coefficients[j] * point^j
          value = this.gfAdd(value, this.gfMultiply(coefficients[j], pointPower));
          pointPower = this.gfMultiply(pointPower, point);
        }

        results[i] = value;
      }

      return results;
    }

    /**
     * @param {uint8[]} poly1 - First factor
     * @param {uint8[]} poly2 - Second factor
     * @returns {uint8[]} Product coefficients
     */
    multiplyPolynomial(poly1, poly2) {
      // Multiply two polynomials over GF(16)
      // Returns coefficients of product polynomial
      const resultDegree = poly1.length + poly2.length - 2;
      /** @type {uint8[]} */
      const result = OpCodes.CreateArray(resultDegree + 1, 0);

      for (let i = 0; i < poly1.length; ++i) {
        for (let j = 0; j < poly2.length; ++j) {
          result[i + j] = this.gfAdd(result[i + j], this.gfMultiply(poly1[i], poly2[j]));
        }
      }

      return result;
    }

    /**
     * @param {int32[]} indices - Evaluation point indices
     * @param {uint8[]} values - Received values by point index
     * @returns {uint8[]} Interpolated coefficients
     */
    interpolatePolynomial(indices, values) {
      // Lagrange interpolation over GF(16). Recovers the unique polynomial of
      // degree below indices.length passing through the selected evaluation
      // points, returned as coefficients with coefficients[i] scaling x^i.
      /** @type {uint8[]} */
      const coefficients = OpCodes.CreateArray(indices.length, 0);

      for (let a = 0; a < indices.length; ++a) {
        /** @type {uint8} */
        const xa = this.evalPoints[indices[a]];
        /** @type {uint8} */
        const ya = values[indices[a]];

        // Basis polynomial: product over b not equal to a of (x + xb),
        // normalised by the product of (xa + xb) so it is 1 at xa and 0 elsewhere
        /** @type {uint8[]} */
        let basis = OpCodes.CreateArray(1, 1);
        /** @type {uint8} */
        let denominator = 1;

        for (let b = 0; b < indices.length; ++b) {
          if (b === a) continue;

          /** @type {uint8} */
          const xb = this.evalPoints[indices[b]];
          /** @type {uint8[]} */
          const factor = [xb, 1];
          basis = this.multiplyPolynomial(basis, factor);
          denominator = this.gfMultiply(denominator, this.gfAdd(xa, xb));
        }

        /** @type {uint8} */
        const scale = this.gfDivide(ya, denominator);
        for (let j = 0; j < basis.length; ++j) {
          coefficients[j] = this.gfAdd(coefficients[j], this.gfMultiply(basis[j], scale));
        }
      }

      return coefficients;
    }

    /**
     * @param {uint8[]} coefficients - Candidate message
     * @param {uint8[]} fReceived - Received f block
     * @param {uint8[]} hReceived - Received h block
     * @returns {int32} Matching symbols
     */
    agreementScore(coefficients, fReceived, hReceived) {
      // Count how many of the 2n received symbols a candidate message
      // polynomial reproduces, across both the f block and the h block
      /** @type {uint8[]} */
      const fEvals = this.evaluatePolynomial(coefficients);
      /** @type {uint8[]} */
      const hEvals = this.evaluatePolynomial(this.multiplyPolynomial(coefficients, coefficients));

      /** @type {int32} */
      let score = 0;
      for (let i = 0; i < this.n; ++i) {
        if (fEvals[i] === fReceived[i]) ++score;
        if (hEvals[i] === hReceived[i]) ++score;
      }

      return score;
    }

    /**
     * @param {uint8[]} fEvals - f block
     * @param {uint8[]} hEvals - h block
     * @returns {boolean} True when h differs from f squared
     */
    checkCorrelation(fEvals, hEvals) {
      // Check if h(αi) = f(αi)^2 for all evaluation points
      // Returns true if any correlation violation is detected (indicating error)

      for (let i = 0; i < this.n; ++i) {
        /** @type {uint8} */
        const expectedH = this.gfMultiply(fEvals[i], fEvals[i]);
        if (expectedH !== hEvals[i]) {
          return true; // Correlation violated
        }
      }

      return false; // Correlation holds
    }

    /**
     * @param {uint8[]} data - Received word
     * @returns {boolean} True when an error is detected
     */
    hasError(data) {
      // Check if received data has errors based on correlation property
      if (data.length !== this.n * 2) {
        return true;
      }

      /** @type {uint8[]} */
      const fEvals = data.slice(0, this.n);
      /** @type {uint8[]} */
      const hEvals = data.slice(this.n, this.n * 2);

      return this.checkCorrelation(fEvals, hEvals);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ParvareshVardyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ParvareshVardyAlgorithm, ParvareshVardyInstance };
}));
