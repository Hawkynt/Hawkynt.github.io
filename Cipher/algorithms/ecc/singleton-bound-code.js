/*
 * Singleton Bound Code (MDS Code) Implementation
 * Educational implementation of Maximum Distance Separable codes using Cauchy matrix construction
 * (c)2006-2025 Hawkynt
 *
 * MDS codes achieve the Singleton bound: d = n - k + 1
 * where n = codeword length, k = message length, d = minimum distance
 *
 * This implementation uses Cauchy matrices, which are distinct from Reed-Solomon
 * but also achieve MDS properties. Cauchy-based MDS codes are used in:
 * - RAID-6 erasure coding
 * - Network coding systems
 * - Distributed storage systems
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
          ErrorCorrectionAlgorithm, IErrorCorrectionInstance,
          TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * SingletonBoundCodeAlgorithm - MDS Code using Cauchy matrix construction
   *
   * Mathematical background:
   * - Singleton bound: d ≤ n - k + 1 for any linear code
   * - MDS codes achieve equality: d = n - k + 1
   * - Cauchy matrix elements: C[i,j] = 1/(x_i + y_j) where x_i, y_j are distinct
   * - Any k×k submatrix of a Cauchy matrix is invertible (MDS property)
   */
  class SingletonBoundCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Singleton Bound Code (MDS)";
      this.description = "Maximum Distance Separable code achieving Singleton bound d=n-k+1 using Cauchy matrix construction. Provides optimal erasure correction with any k symbols sufficient to reconstruct message. Used in RAID-6, distributed storage, and network coding. Educational implementation demonstrating MDS property beyond Reed-Solomon.";
      this.inventor = "Richard Singleton";
      this.year = 1964;
      this.category = CategoryType.ECC;
      this.subCategory = "Maximum Distance Separable Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Singleton Bound - Wikipedia", "https://en.wikipedia.org/wiki/Singleton_bound"),
        new LinkItem("MDS Codes - Error Correction Zoo", "https://errorcorrectionzoo.org/c/mds"),
        new LinkItem("Cauchy Matrix MDS Construction", "https://en.wikipedia.org/wiki/Cauchy_matrix")
      ];

      this.references = [
        new LinkItem("Singleton (1964) - Maximum distance q-nary codes", "https://ieeexplore.ieee.org/document/1053689"),
        new LinkItem("Blahut (2003) - Algebraic Codes for Data Transmission", "https://doi.org/10.1017/CBO9780511800467"),
        new LinkItem("Roth (2006) - Introduction to Coding Theory", "https://www.cambridge.org/core/books/introduction-to-coding-theory/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Erasure-Only Correction",
          "This implementation focuses on erasure correction (known error locations). Error correction requires syndrome decoding."
        ),
        new Vulnerability(
          "Galois Field Arithmetic Complexity",
          "GF(256) operations require careful implementation. Performance depends on log/antilog table efficiency."
        ),
        new Vulnerability(
          "Matrix Inversion Numerical Stability",
          "Cauchy matrix inversion over finite fields requires exact arithmetic to avoid reconstruction failures."
        )
      ];

      // Test vectors for (6,4) MDS code over GF(256)
      // These demonstrate the MDS property: any 4 of 6 symbols reconstruct the message
      // Authentic vectors computed from Cauchy matrix construction with
      // x = [0,1], y = [2,3,4,5] giving C[i,j] = 1/(x[i] XOR y[j])
      this.tests = [
        new TestCase(
          [1, 2, 3, 4], // 4 data symbols
          [1, 2, 3, 4, 20, 0], // 6 codeword symbols (systematic encoding)
          "MDS (6,4) encoding - systematic form with Cauchy parity",
          "https://en.wikipedia.org/wiki/MDS_code"
        ),
        new TestCase(
          [0, 0, 0, 0], // Zero message
          [0, 0, 0, 0, 0, 0], // All-zero codeword
          "MDS zero codeword test - demonstrates linearity",
          "https://en.wikipedia.org/wiki/MDS_code"
        ),
        new TestCase(
          [255, 255, 255, 255], // Maximum values (all 0xFF)
          [255, 255, 255, 255, 97, 97], // Encoded with Cauchy parity
          "MDS maximum value test in GF(256)",
          "https://en.wikipedia.org/wiki/MDS_code"
        ),
        new TestCase(
          [1, 0, 0, 0], // First basis vector
          [1, 0, 0, 0, 142, 244], // Encoded - parity from first column of Cauchy matrix
          "MDS basis vector e_1 - first column of generator",
          "https://en.wikipedia.org/wiki/MDS_code"
        ),
        new TestCase(
          [100, 200, 50, 150], // Random message
          [100, 200, 50, 150, 45, 176], // Systematic encoding
          "MDS random message - demonstrates general encoding",
          "https://en.wikipedia.org/wiki/MDS_code"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SingletonBoundCodeInstance(this, isInverse);
    }
  }

  /**
   * SingletonBoundCodeInstance - MDS code implementation using Cauchy matrices
   *
   * Implementation details:
   * - Systematic encoding: [data parity] where parity computed via Cauchy matrix
   * - Erasure decoding: Matrix inversion to reconstruct from any k symbols
   * - GF(256) arithmetic using primitive polynomial (0x11D): x to the 8th plus x to the 4th plus x cubed plus x squared plus 1
   */
  class SingletonBoundCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // MDS code parameters (6,4) over GF(256)
      this.n = 6;        // Codeword length
      this.k = 4;        // Message length
      this.r = 2;        // Redundancy (n - k)
      this.d = 3;        // Minimum distance (n - k + 1) - Singleton bound!
      this.field = 256;  // GF(256) - Galois Field with 256 elements
      this.primitive = 0x11D; // Primitive polynomial: x to the 8th plus x to the 4th plus x cubed plus x squared plus 1

      // Initialize Galois Field arithmetic tables
      this.initializeGaloisField();

      // Generate Cauchy matrix for encoding
      this.cauchyMatrix = this.generateCauchyMatrix();
    }

    /**
     * Feed data for encoding/decoding
     * @param {Array<number>} data - Symbol array (bytes)
     */
    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SingletonBoundCodeInstance.Feed: Input must be symbol array');
      }

      if (this.isInverse) {
        // Decoding mode
        this.result = this.decode(data);
      } else {
        // Encoding mode
        this.result = this.encode(data);
      }
    }

    /**
     * Return processed result
     * @returns {Array<number>} Encoded/decoded symbol array
     */
    Result() {
      if (this.result === null) {
        throw new Error('SingletonBoundCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * Detect if codeword has errors (MDS property check)
     * @param {Array<number>} data - Received codeword
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.n) {
        throw new Error(`SingletonBoundCodeInstance.DetectError: Input must be ${this.n}-symbol array`);
      }

      // For MDS codes, we check if parity symbols match computed values
      const message = data.slice(0, this.k);
      const receivedParity = data.slice(this.k);
      const computedParity = this.computeParity(message);

      // Compare parity symbols
      for (let i = 0; i < this.r; ++i) {
        if (receivedParity[i] !== computedParity[i]) {
          return true; // Error detected
        }
      }
      return false; // No error
    }

    /**
     * Encode message to codeword (systematic form)
     * @param {Array<number>} message - k data symbols
     * @returns {Array<number>} n codeword symbols
     */
    encode(message) {
      if (message.length !== this.k) {
        throw new Error(`MDS encode: Input must be exactly ${this.k} symbols`);
      }

      // Validate symbols in field range
      for (let symbol of message) {
        if (symbol < 0 || symbol >= this.field) {
          throw new Error(`MDS: Symbol ${symbol} out of range [0, ${this.field-1}]`);
        }
      }

      // Systematic encoding: [message parity]
      const codeword = new Array(this.n);

      // Copy message symbols
      for (let i = 0; i < this.k; ++i) {
        codeword[i] = message[i];
      }

      // Compute parity symbols using Cauchy matrix
      const parity = this.computeParity(message);
      for (let i = 0; i < this.r; ++i) {
        codeword[this.k + i] = parity[i];
      }

      return codeword;
    }

    /**
     * Decode codeword to message (with erasure correction)
     * @param {Array<number>} received - n received symbols (may have erasures marked as null)
     * @returns {Array<number>} k decoded message symbols
     */
    decode(received) {
      if (received.length !== this.n) {
        throw new Error(`MDS decode: Input must be exactly ${this.n} symbols`);
      }

      // Count erasures (marked as null or -1)
      const erasures = [];
      for (let i = 0; i < this.n; ++i) {
        if (received[i] === null || received[i] === -1 || received[i] === undefined) {
          erasures.push(i);
        }
      }

      // MDS codes can correct up to (n - k) erasures
      if (erasures.length > this.r) {
        throw new Error(`MDS decode: Too many erasures (${erasures.length} > ${this.r})`);
      }

      // If no erasures, just extract message
      if (erasures.length === 0) {
        // Verify parity
        if (this.DetectError(received)) {
          console.warn('MDS: Parity check failed, but no erasures marked. Returning message portion.');
        }
        return received.slice(0, this.k);
      }

      // Erasure decoding: reconstruct using any k symbols
      return this.erasureDecode(received, erasures);
    }

    /**
     * Compute parity symbols using Cauchy matrix multiplication
     * @param {Array<number>} message - k message symbols
     * @returns {Array<number>} r parity symbols
     */
    computeParity(message) {
      const parity = new Array(this.r);

      // Parity matrix is rows k..n-1 of Cauchy matrix
      for (let i = 0; i < this.r; ++i) {
        let sum = 0;
        for (let j = 0; j < this.k; ++j) {
          const matrixElement = this.cauchyMatrix[this.k + i][j];
          sum = OpCodes.XorN(sum, this.gfMultiply(matrixElement, message[j]));
        }
        parity[i] = sum;
      }

      return parity;
    }

    /**
     * Erasure decoding using matrix inversion
     * @param {Array<number>} received - n symbols with erasures
     * @param {Array<number>} erasures - Indices of erased symbols
     * @returns {Array<number>} k decoded message symbols
     */
    erasureDecode(received, erasures) {
      // Select k surviving symbols
      const surviving = [];
      for (let i = 0; i < this.n; ++i) {
        if (!erasures.includes(i)) {
          surviving.push(i);
        }
      }

      if (surviving.length < this.k) {
        throw new Error('MDS decode: Not enough symbols to reconstruct');
      }

      // Use first k surviving symbols
      surviving.length = this.k;

      // Special case: If all surviving symbols are data symbols (first k positions),
      // and they're in order, just return them
      let allDataInOrder = true;
      for (let i = 0; i < this.k; ++i) {
        if (surviving[i] !== i) {
          allDataInOrder = false;
          break;
        }
      }

      if (allDataInOrder) {
        return received.slice(0, this.k);
      }

      // General case: Extract k×k submatrix and invert
      const submatrix = this.extractSubmatrix(surviving);
      const inverse = this.invertMatrix(submatrix);

      // Extract surviving symbol values
      const survivingValues = surviving.map(idx => received[idx]);

      // Multiply inverse by surviving symbols: message = inverse * codeword_partial
      const message = new Array(this.k);
      for (let i = 0; i < this.k; ++i) {
        let sum = 0;
        for (let j = 0; j < this.k; ++j) {
          sum = OpCodes.XorN(sum, this.gfMultiply(inverse[i][j], survivingValues[j]));
        }
        message[i] = sum;
      }

      return message;
    }

    /**
     * Generate Cauchy matrix for MDS code in systematic form
     * Generator matrix G = [I_k P] where I_k is identity and P is r×k parity matrix
     * P derived from Cauchy matrix to ensure MDS property
     * @returns {Array<Array<number> >} n×k generator matrix in systematic form
     */
    generateCauchyMatrix() {
      const matrix = [];

      // First k rows: Identity matrix [I_k combined with parity]
      for (let i = 0; i < this.k; ++i) {
        const row = new Array(this.k);
        for (let j = 0; j < this.k; ++j) {
          row[j] = (i === j) ? 1 : 0;
        }
        matrix.push(row);
      }

      // Last r rows: Cauchy parity matrix
      // Choose distinct x and y values for Cauchy construction
      // x = [0, 1, ..., r-1], y = [r, r+1, ..., r+k-1]
      const x = [];
      for (let i = 0; i < this.r; ++i) {
        x.push(i);
      }

      const y = [];
      for (let j = 0; j < this.k; ++j) {
        y.push(this.r + j);
      }

      // Compute Cauchy parity rows
      for (let i = 0; i < this.r; ++i) {
        const row = [];
        for (let j = 0; j < this.k; ++j) {
          // C[i,j] = 1/(x[i] + y[j]) in GF(256)
          const denominator = OpCodes.XorN(x[i], y[j]); // Addition in GF(256) is XOR
          if (denominator === 0) {
            throw new Error('Cauchy matrix: x_i + y_j = 0 not allowed');
          }
          const element = this.gfInverse(denominator);
          row.push(element);
        }
        matrix.push(row);
      }

      return matrix;
    }

    /**
     * Extract k×k submatrix for decoding
     * @param {Array<number>} rows - Row indices to extract
     * @returns {Array<Array<number> >} k×k submatrix
     */
    extractSubmatrix(rows) {
      const submatrix = [];
      for (let i = 0; i < this.k; ++i) {
        const row = [];
        for (let j = 0; j < this.k; ++j) {
          row.push(this.cauchyMatrix[rows[i]][j]);
        }
        submatrix.push(row);
      }
      return submatrix;
    }

    /**
     * Invert matrix over GF(256) using Gaussian elimination
     * @param {Array<Array<number> >} matrix - k×k matrix
     * @returns {Array<Array<number> >} k×k inverse matrix
     */
    invertMatrix(matrix) {
      const k = matrix.length;

      // Create augmented matrix [A I] where A is matrix to invert, I is identity
      const augmented = [];
      for (let i = 0; i < k; ++i) {
        const row = [...matrix[i]];
        for (let j = 0; j < k; ++j) {
          row.push(i === j ? 1 : 0);
        }
        augmented.push(row);
      }

      // Gaussian elimination with partial pivoting
      for (let col = 0; col < k; ++col) {
        // Find pivot
        let pivotRow = col;
        for (let row = col + 1; row < k; ++row) {
          if (augmented[row][col] !== 0) {
            pivotRow = row;
            break;
          }
        }

        if (augmented[pivotRow][col] === 0) {
          throw new Error('Matrix is singular, cannot invert');
        }

        // Swap rows if needed
        if (pivotRow !== col) {
          const temp = augmented[col];
          augmented[col] = augmented[pivotRow];
          augmented[pivotRow] = temp;
        }

        // Scale pivot row
        const pivot = augmented[col][col];
        const pivotInv = this.gfInverse(pivot);
        for (let j = 0; j < 2 * k; ++j) {
          augmented[col][j] = this.gfMultiply(augmented[col][j], pivotInv);
        }

        // Eliminate column
        for (let row = 0; row < k; ++row) {
          if (row !== col && augmented[row][col] !== 0) {
            const factor = augmented[row][col];
            for (let j = 0; j < 2 * k; ++j) {
              augmented[row][j] = OpCodes.XorN(augmented[row][j], this.gfMultiply(factor, augmented[col][j]));
            }
          }
        }
      }

      // Extract inverse from augmented matrix
      const inverse = [];
      for (let i = 0; i < k; ++i) {
        inverse.push(augmented[i].slice(k));
      }

      return inverse;
    }

    /**
     * Initialize Galois Field GF(256) log and antilog tables
     */
    initializeGaloisField() {
      this.gfLog = new Array(this.field);
      this.gfAntilog = new Array(this.field);

      let x = 1;
      for (let i = 0; i < this.field - 1; ++i) {
        this.gfAntilog[i] = x;
        this.gfLog[x] = i;
        x = OpCodes.Shl32(x, 1);
        if (OpCodes.AndN(x, this.field)) {
          x = OpCodes.XorN(x, this.primitive);
        }
      }
      this.gfLog[0] = this.field - 1; // Special case for zero
    }

    /**
     * Galois Field multiplication
     * @param {number} a - GF(256) element
     * @param {number} b - GF(256) element
     * @returns {number} a * b in GF(256)
     */
    gfMultiply(a, b) {
      if (a === 0 || b === 0) return 0;
      return this.gfAntilog[(this.gfLog[a] + this.gfLog[b]) % (this.field - 1)];
    }

    /**
     * Galois Field division
     * @param {number} a - GF(256) element
     * @param {number} b - GF(256) element
     * @returns {number} a / b in GF(256)
     */
    gfDivide(a, b) {
      if (b === 0) throw new Error('Division by zero in Galois Field');
      if (a === 0) return 0;
      return this.gfAntilog[(this.gfLog[a] - this.gfLog[b] + this.field - 1) % (this.field - 1)];
    }

    /**
     * Galois Field multiplicative inverse
     * @param {number} a - GF(256) element
     * @returns {number} 1/a in GF(256)
     */
    gfInverse(a) {
      if (a === 0) throw new Error('Zero has no inverse in Galois Field');
      const logInv = (this.field - 1 - this.gfLog[a]) % (this.field - 1);
      return this.gfAntilog[logInv];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SingletonBoundCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SingletonBoundCodeAlgorithm, SingletonBoundCodeInstance };
}));
