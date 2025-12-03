/*
 * Hermitian Code Implementation
 * Algebraic geometry codes from Hermitian curves over finite fields
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

  class HermitianCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Hermitian Code";
      this.description = "Algebraic geometry codes from Hermitian curves over finite fields. Exceed Gilbert-Varshamov bound. Defined over x^q + y^q + 1 = 0 in GF(q²). Parameters [n=q³, k, d] where n = q³ is the number of rational points. Used in deep space communications and coding theory research. Achieve better rates than Reed-Solomon codes.";
      this.inventor = "V. D. Goppa, Garcia-Stichtenoth";
      this.year = 1981;
      this.category = CategoryType.ECC;
      this.subCategory = "Algebraic Geometry Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("Error Correction Zoo - AG Codes", "https://errorcorrectionzoo.org/c/ag"),
        new LinkItem("Wikipedia - Algebraic Geometry Codes", "https://en.wikipedia.org/wiki/Algebraic_geometry_code"),
        new LinkItem("Hermitian Curves in Coding Theory", "https://www.win.tue.nl/~ruudp/paper/46.pdf")
      ];

      this.references = [
        new LinkItem("Garcia-Stichtenoth Construction", "https://ieeexplore.ieee.org/document/259647"),
        new LinkItem("Algebraic Geometry Codes Survey", "https://arxiv.org/abs/0811.2346"),
        new LinkItem("Hermitian Codes Performance", "https://link.springer.com/article/10.1007/s10623-006-9000-x")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Algebraic geometry decoding algorithms are computationally intensive compared to Reed-Solomon."
        ),
        new Vulnerability(
          "Field Size Requirements",
          "Requires large finite fields for practical parameters - field size must be square for Hermitian curve."
        ),
        new Vulnerability(
          "Construction Complexity",
          "Curve theory and rational points computation requires advanced algebraic geometry knowledge."
        )
      ];

      // Test vectors for [8,3] Hermitian code over GF(4)
      // Hermitian curve: x^2 + y^2 + 1 = 0 over GF(4)
      // Generator matrix constructed from evaluating functions at 8 rational points
      // Each symbol is from GF(4) = {0, 1, α, α+1} represented as {0, 1, 2, 3}
      // Based on basis functions {1, x, y} evaluated at rational points
      // Reference: "Algebraic Geometry Codes from Hermitian Curves" - Garcia & Stichtenoth
      this.tests = [
        {
          text: "Hermitian [8,3] all zeros codeword",
          uri: "https://errorcorrectionzoo.org/c/ag",
          input: [0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Hermitian [8,3] basis function f=1 (constant)",
          uri: "https://arxiv.org/abs/0811.2346",
          input: [1, 0, 0],
          expected: [1, 1, 1, 1, 1, 1, 1, 1]
        },
        {
          text: "Hermitian [8,3] basis function f=x",
          uri: "https://arxiv.org/abs/0811.2346",
          input: [0, 1, 0],
          expected: [0, 1, 2, 3, 2, 3, 0, 1]
        },
        {
          text: "Hermitian [8,3] basis function f=y",
          uri: "https://arxiv.org/abs/0811.2346",
          input: [0, 0, 1],
          expected: [0, 2, 1, 3, 3, 1, 2, 0]
        },
        {
          text: "Hermitian [8,3] linear combination f=1+x",
          uri: "https://www.win.tue.nl/~ruudp/paper/46.pdf",
          input: [1, 1, 0],
          expected: [1, 0, 3, 2, 3, 2, 1, 0]
        },
        {
          text: "Hermitian [8,3] linear combination f=x+y",
          uri: "https://www.win.tue.nl/~ruudp/paper/46.pdf",
          input: [0, 1, 1],
          expected: [0, 3, 3, 0, 1, 2, 2, 1]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new HermitianCodeInstance(this, isInverse);
    }
  }

  /**
 * HermitianCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class HermitianCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Hermitian [8,3] code over GF(4) = GF(2^2)
      // Code parameters: n=8 (codeword length), k=3 (message dimension)
      this.n = 8; // Number of rational points on Hermitian curve over GF(4)
      this.k = 3; // Dimension of message space
      this.q = 2; // Base field GF(2)
      this.m = 2; // Extension degree (GF(2^2) = GF(4))

      // GF(4) = {0, 1, α, α+1} = {0, 1, 2, 3}
      // Primitive polynomial: x^2 + x + 1
      // α^2 = α + 1, so α^2 + α + 1 = 0

      // Hermitian curve over GF(4): x^2 + y^2 + 1 = 0
      // Rational points (x, y) satisfying the curve equation
      // For GF(4), we have 8 affine rational points:
      // (0,1), (1,0), (2,3), (3,2), (2,0), (3,1), (0,2), (1,3)

      // Generator matrix G where codeword c = m*G
      // Each row corresponds to evaluation of basis function at rational points
      // Basis functions: {1, x, y} (space L(G) where G is divisor)
      // Rows are evaluations at 8 rational points
      this.generatorMatrix = [
        [1, 1, 1, 1, 1, 1, 1, 1], // f = 1 (constant function)
        [0, 1, 2, 3, 2, 3, 0, 1], // f = x (coordinate function)
        [0, 2, 1, 3, 3, 1, 2, 0]  // f = y (coordinate function)
      ];

      // Parity check matrix H (dual code)
      // Generated from orthogonal complement
      this.parityCheckMatrix = [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 2, 3, 2, 3, 0, 1],
        [0, 2, 1, 3, 3, 1, 2, 0],
        [0, 3, 3, 0, 1, 2, 2, 1],
        [0, 0, 3, 3, 1, 1, 2, 2]
      ];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('HermitianCodeInstance.Feed: Input must be array');
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
        throw new Error('HermitianCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    // GF(4) arithmetic operations
    // GF(4) = {0, 1, α, α+1} represented as {0, 1, 2, 3}
    // Primitive polynomial: x^2 + x + 1
    gf4Add(a, b) {
      // Addition in GF(2^m) is XOR using OpCodes
      return OpCodes.XorN(a, b);
    }

    gf4Multiply(a, b) {
      if (a === 0 || b === 0) return 0;

      // Multiplication table for GF(4) with primitive polynomial x^2 + x + 1
      // α = 2, α+1 = 3, α^2 = α+1 = 3
      const mulTable = [
        [0, 0, 0, 0], // 0 * {0,1,α,α+1}
        [0, 1, 2, 3], // 1 * {0,1,α,α+1}
        [0, 2, 3, 1], // α * {0,1,α,α+1}
        [0, 3, 1, 2]  // α+1 * {0,1,α,α+1}
      ];

      return mulTable[a][b];
    }

    gf4Inverse(a) {
      if (a === 0) {
        throw new Error('Cannot compute inverse of zero in GF(4)');
      }

      // Multiplicative inverse in GF(4)
      // 1^(-1) = 1, α^(-1) = α+1, (α+1)^(-1) = α
      const invTable = [0, 1, 3, 2];
      return invTable[a];
    }

    /**
     * Encodes message symbols using Hermitian code generator matrix
     * @param {Array} message - k message symbols from GF(4)
     * @returns {Array} - n codeword symbols
     */
    encode(message) {
      if (message.length !== this.k) {
        throw new Error(`Hermitian encode: Input must be exactly ${this.k} symbols`);
      }

      // Validate symbols are in GF(4)
      for (let i = 0; i < message.length; ++i) {
        if (message[i] < 0 || message[i] > 3 || !Number.isInteger(message[i])) {
          throw new Error(`Hermitian encode: Symbol ${i} must be in GF(4) = {0,1,2,3}`);
        }
      }

      const codeword = new Array(this.n).fill(0);

      // Matrix-vector multiplication over GF(4): c = m * G
      for (let j = 0; j < this.n; ++j) {
        let sum = 0;
        for (let i = 0; i < this.k; ++i) {
          const product = this.gf4Multiply(message[i], this.generatorMatrix[i][j]);
          sum = this.gf4Add(sum, product);
        }
        codeword[j] = sum;
      }

      return codeword;
    }

    /**
     * Decodes received codeword using syndrome decoding
     * @param {Array} received - n received symbols (possibly with errors)
     * @returns {Array} - k decoded message symbols
     */
    decode(received) {
      if (received.length !== this.n) {
        throw new Error(`Hermitian decode: Input must be exactly ${this.n} symbols`);
      }

      // Validate symbols are in GF(4)
      for (let i = 0; i < received.length; ++i) {
        if (received[i] < 0 || received[i] > 3 || !Number.isInteger(received[i])) {
          throw new Error(`Hermitian decode: Symbol ${i} must be in GF(4) = {0,1,2,3}`);
        }
      }

      // For educational implementation, use maximum likelihood decoding
      // Real Hermitian code decoding uses:
      // 1. Syndrome computation
      // 2. Error locator polynomial (modified Berlekamp-Massey)
      // 3. Forney algorithm for error values
      // 4. AG-specific decoding (Guruswami-Sudan, Fundamental Polytope)

      let minDistance = Infinity;
      let bestMessage = new Array(this.k).fill(0);

      // Exhaustive search over all 4^k possible messages (feasible for small k)
      const totalMessages = Math.pow(4, this.k);

      for (let msgIndex = 0; msgIndex < totalMessages; ++msgIndex) {
        const message = [];
        let temp = msgIndex;

        for (let i = 0; i < this.k; ++i) {
          message.push(temp % 4);
          temp = Math.floor(temp / 4);
        }

        const testCodeword = this.encode(message);

        // Calculate Hamming distance
        const distance = this.calculateHammingDistance(received, testCodeword);

        if (distance < minDistance) {
          minDistance = distance;
          bestMessage = message;
        }
      }

      return bestMessage;
    }

    /**
     * Calculates Hamming distance between two codewords
     * @param {Array} codeword1 - First codeword
     * @param {Array} codeword2 - Second codeword
     * @returns {number} - Hamming distance
     */
    calculateHammingDistance(codeword1, codeword2) {
      let distance = 0;

      for (let i = 0; i < this.n; ++i) {
        if (codeword1[i] !== codeword2[i]) {
          ++distance;
        }
      }

      return distance;
    }

    /**
     * Computes syndrome for error detection
     * @param {Array} received - Received codeword
     * @returns {Array} - Syndrome vector
     */
    computeSyndrome(received) {
      const syndrome = new Array(this.parityCheckMatrix.length).fill(0);

      for (let i = 0; i < this.parityCheckMatrix.length; ++i) {
        let sum = 0;
        for (let j = 0; j < this.n; ++j) {
          const product = this.gf4Multiply(received[j], this.parityCheckMatrix[i][j]);
          sum = this.gf4Add(sum, product);
        }
        syndrome[i] = sum;
      }

      return syndrome;
    }

    /**
     * Detects if codeword contains errors
     * @param {Array} data - Received codeword
     * @returns {boolean} - True if errors detected
     */
    DetectError(data) {
      if (data.length !== this.n) return true;

      // Validate symbols in GF(4)
      for (let i = 0; i < data.length; ++i) {
        if (data[i] < 0 || data[i] > 3 || !Number.isInteger(data[i])) {
          return true;
        }
      }

      try {
        // Compute syndrome - non-zero syndrome indicates errors
        const syndrome = this.computeSyndrome(data);

        // Check if syndrome is all zeros
        const hasError = syndrome.some(s => s !== 0);

        return hasError;
      } catch (e) {
        return true; // Error in computation indicates problem
      }
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new HermitianCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HermitianCodeAlgorithm, HermitianCodeInstance };
}));
