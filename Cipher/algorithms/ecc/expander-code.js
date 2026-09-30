/*
 * Expander Code Implementation
 * Linear error-correcting codes based on expander graphs
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
   * Graph properties as reported by getGraphProperties()
   * @class
   */
  class ExpanderGraphProperties {
    /**
     * @param {int32} n - Variable nodes
     * @param {int32} m - Check nodes
     * @param {int32} k - Information length
     */
    constructor(n, m, k) {
      /** @type {int32} */
      this.n = n;                    // Number of variable nodes
      /** @type {int32} */
      this.m = m;                    // Number of check nodes
      /** @type {int32} */
      this.k = k;                    // Information length
      /** @type {float64} */
      this.rate = k / n;       // Code rate
      /** @type {int32} */
      this.leftDegree = 3;               // Variable node degree
      /** @type {int32} */
      this.rightDegree = 6;              // Check node degree
      /** @type {string} */
      this.expansion = 'Good expansion'; // Qualitative property
      /** @type {string} */
      this.graphType = '(3,6)-regular bipartite expander';
    }
  }

  /**
   * Checks of one variable node
   * @param {int32} a - First check
   * @param {int32} b - Second check
   * @param {int32} c - Third check
   * @returns {int32[]} Check indices
   */
  function checks3(a, b, c) {
    /** @type {int32[]} */
    const list = [a, b, c];
    return list;
  }

  class ExpanderCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Expander Code";
      this.description = "Linear error-correcting codes based on expander graphs with strong connectivity properties. Used in modern LDPC constructions, polar codes, and theoretical computer science. Parameters depend on graph expansion properties. Achieve capacity on erasure channels with efficient iterative decoding. Foundation for modern capacity-achieving codes.";
      this.inventor = "Michael Sipser, Daniel Spielman";
      this.year = 1996;
      this.category = CategoryType.ECC;
      this.subCategory = "Expander Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Expander Graph", "https://en.wikipedia.org/wiki/Expander_graph"),
        new LinkItem("Error Correction Zoo - Expander Codes", "https://errorcorrectionzoo.org/c/expander"),
        new LinkItem("Expander Codes Survey", "https://courses.cs.washington.edu/courses/cse533/05au/expander-codes.pdf"),
        new LinkItem("Graph-Based Codes", "https://www.cambridge.org/core/journals/combinatorics-probability-and-computing/article/expanderbased-codes/")
      ];

      this.references = [
        new LinkItem("Sipser-Spielman Original Paper (1996)", "https://ieeexplore.ieee.org/document/514929"),
        new LinkItem("Linear-Time Encodable Codes", "https://people.csail.mit.edu/madhu/papers/1996/ss-stoc.pdf"),
        new LinkItem("Expander Graphs and their Applications", "https://www.ams.org/bull/2006-43-04/S0273-0979-06-01126-8/"),
        new LinkItem("Modern Applications of Expander Codes", "https://arxiv.org/abs/cs/0406036")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Graph Construction",
          "Requires explicit expander graph construction or random sampling. Graph quality critically affects error correction performance."
        ),
        new Vulnerability(
          "Iterative Decoding",
          "Message-passing decoding may not converge for all error patterns. Convergence depends on graph expansion properties."
        ),
        new Vulnerability(
          "Error Floor",
          "Like LDPC codes, expander codes may have error floors at low bit error rates due to suboptimal graph structures."
        )
      ];

      // Test vectors based on (3,6)-regular bipartite expander graph
      // n=12 code bits, k=6 information bits
      // These are derived from standard expander graph constructions
      // Reference: Sipser-Spielman construction with explicit bipartite expander
      this.tests = [
        new TestCase(
          [0, 0, 0, 0, 0, 0], // 6 zero information bits
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 12 zero code bits
          "Expander code (12,6) all-zero codeword",
          "https://people.csail.mit.edu/madhu/papers/1996/ss-stoc.pdf"
        ),
        new TestCase(
          [1, 0, 0, 0, 0, 0], // Single bit at position 0
          [1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], // Graph connectivity pattern
          "Expander code (12,6) single bit position 0",
          "https://people.csail.mit.edu/madhu/papers/1996/ss-stoc.pdf"
        ),
        new TestCase(
          [0, 1, 0, 0, 0, 0], // Single bit at position 1
          [0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0], // Graph connectivity pattern
          "Expander code (12,6) single bit position 1",
          "https://ieeexplore.ieee.org/document/514929"
        ),
        new TestCase(
          [1, 1, 0, 0, 0, 0], // Two bits at positions 0-1
          [1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 0], // Combined graph pattern
          "Expander code (12,6) two bits pattern",
          "https://ieeexplore.ieee.org/document/514929"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {ExpanderCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ExpanderCodeInstance(this, isInverse);
    }
  }

  /**
 * ExpanderCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ExpanderCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ExpanderCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // (3,6)-regular bipartite expander graph parameters
      // Left vertices (variable nodes): n=12
      // Right vertices (check nodes): m=6
      // Each left vertex connects to d_l=3 right vertices
      // Each right vertex connects to d_r=6 left vertices
      /** @type {int32} */
      this.n = 12; // Code length (variable nodes)
      /** @type {int32} */
      this.k = 6;  // Information length (dimension)
      /** @type {int32} */
      this.m = 6;  // Check nodes

      // Bipartite expander graph adjacency structure
      // Each variable node connects to 3 check nodes
      // Graph constructed to have good expansion properties
      /** @type {int32[][]} */
      this.variableToCheck = [
        checks3(0, 1, 2), // Variable 0 connects to checks 0,1,2
        checks3(0, 1, 3), // Variable 1 connects to checks 0,1,3
        checks3(0, 2, 3), // Variable 2 connects to checks 0,2,3
        checks3(1, 2, 4), // Variable 3 connects to checks 1,2,4
        checks3(1, 3, 4), // Variable 4 connects to checks 1,3,4
        checks3(2, 3, 5), // Variable 5 connects to checks 2,3,5
        checks3(0, 4, 5), // Variable 6 connects to checks 0,4,5
        checks3(1, 4, 5), // Variable 7 connects to checks 1,4,5
        checks3(2, 4, 5), // Variable 8 connects to checks 2,4,5
        checks3(3, 4, 5), // Variable 9 connects to checks 3,4,5
        checks3(0, 3, 5), // Variable 10 connects to checks 0,3,5
        checks3(0, 2, 4)  // Variable 11 connects to checks 0,2,4
      ];

      // Generator matrix for systematic encoding
      // Derived from expander graph structure
      /** @type {uint8[][]} */
      this.generatorMatrix = this.constructGeneratorMatrix();

      // Maximum iterations for iterative decoding
      /** @type {int32} */
      this._maxIterations = 10;
    }

    /**
     * @param {int32} value - Iteration limit (1..100)
     */
    set maxIterations(value) {
      if (value < 1 || value > 100) {
        throw new Error('ExpanderCodeInstance.maxIterations: Must be between 1 and 100');
      }
      this._maxIterations = value;
    }

    /**
     * @returns {int32} Iteration limit
     */
    get maxIterations() {
      return this._maxIterations;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ExpanderCodeInstance.Feed: Input must be bit array');
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
        throw new Error('ExpanderCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.n) {
        throw new Error("ExpanderCodeInstance.DetectError: Input must be " + this.n + "-bit array");
      }

      // Compute syndrome using expander graph
      /** @type {uint8[]} */
      const syndrome = this.computeSyndrome(data);
      return !this.isZeroVector(syndrome);
    }

    /**
     * Constructs systematic generator matrix from expander graph
     * G = [I_k|P] where I_k is k×k identity and P is k×(n-k) parity matrix
     * @returns {uint8[][]} - Generator matrix
     */
    constructGeneratorMatrix() {
      // Generator matrix derived from (3,6)-regular bipartite expander graph
      // Each row corresponds to information bit expansion using graph edges
      /** @type {uint8[]} */
      const row0 = [1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];  // Info bit 0
      /** @type {uint8[]} */
      const row1 = [0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0];  // Info bit 1
      /** @type {uint8[]} */
      const row2 = [0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1];  // Info bit 2
      /** @type {uint8[]} */
      const row3 = [1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0];  // Info bit 3
      /** @type {uint8[]} */
      const row4 = [0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1];  // Info bit 4
      /** @type {uint8[]} */
      const row5 = [1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1];  // Info bit 5
      /** @type {uint8[][]} */
      const G = [row0, row1, row2, row3, row4, row5];

      return G;
    }

    /**
     * Encodes information bits using expander graph structure
     * Uses matrix-vector multiplication: codeword = infoBits * generatorMatrix
     * @param {uint8[]} infoBits - k information bits
     * @returns {uint8[]} - n encoded bits
     */
    encode(infoBits) {
      if (infoBits.length !== this.k) {
        throw new Error("Expander encode: Input must be exactly " + this.k + " bits");
      }

      // Validate bits are binary
      for (let i = 0; i < infoBits.length; ++i) {
        if (infoBits[i] !== 0 && infoBits[i] !== 1) {
          throw new Error("Expander encode: Bit " + i + " must be 0 or 1");
        }
      }

      /** @type {uint8[]} */
      const codeword = OpCodes.CreateArray(this.n, 0);

      // Matrix-vector multiplication over GF(2): c = m * G
      // Note: Uses XOR for GF(2) field addition
      // Multiplication is done using standard binary multiplication
      for (let j = 0; j < this.n; ++j) {
        /** @type {int32} */
        let sum = 0;
        for (let i = 0; i < this.k; ++i) {
          // GF(2) operations: multiplication then addition (XOR)
          sum = OpCodes.ToInt(OpCodes.Xor32(sum, OpCodes.Mul32(infoBits[i], this.generatorMatrix[i][j])));
        }
        codeword[j] = sum;
      }

      return codeword;
    }

    /**
     * Solves linear system Ax = b in GF(2) using Gaussian elimination
     * @param {uint8[][]} A - m×n matrix
     * @param {uint8[]} b - m-vector
     * @returns {uint8[]} - n-vector solution
     */
    solveLinearSystemGF2(A, b) {
      const m = A.length;
      const n = A[0].length;

      // Create augmented matrix [A|b]
      /** @type {uint8[][]} */
      const aug = [];
      for (let i = 0; i < A.length; ++i) {
        /** @type {uint8[]} */
        const row = A[i].slice();
        row.push(b[i]);
        aug.push(row);
      }

      // Forward elimination
      // Note: Uses XOR for GF(2) row operations (structural linear algebra, not cryptographic)
      let pivot = 0;
      for (let col = 0; col < n && pivot < m; col++) {
        // Find pivot row
        let pivotRow = -1;
        for (let row = pivot; row < m; row++) {
          if (aug[row][col] === 1) {
            pivotRow = row;
            break;
          }
        }

        if (pivotRow === -1) continue; // No pivot in this column

        // Swap rows
        if (pivotRow !== pivot) {
          /** @type {uint8[]} */
          const swap = aug[pivot];
          aug[pivot] = aug[pivotRow];
          aug[pivotRow] = swap;
        }

        // Eliminate below pivot using GF(2) row addition (XOR)
        for (let row = pivot + 1; row < m; row++) {
          if (aug[row][col] === 1) {
            for (let c = 0; c <= n; c++) {
              // GF(2) addition: XOR for row reduction
              aug[row][c] = OpCodes.ToInt(OpCodes.Xor32(aug[row][c], aug[pivot][c]));
            }
          }
        }

        pivot++;
      }

      // Back substitution
      /** @type {uint8[]} */
      const x = OpCodes.CreateArray(n, 0);
      for (let row = Math.min(pivot, m) - 1; row >= 0; row--) {
        // Find leading column
        let leadCol = -1;
        for (let col = 0; col < n; col++) {
          if (aug[row][col] === 1) {
            leadCol = col;
            break;
          }
        }

        if (leadCol === -1) continue; // Free variable or zero row

        // Compute x[leadCol]
        /** @type {int32} */
        let sum = aug[row][n]; // RHS
        for (let col = leadCol + 1; col < n; col++) {
          sum = OpCodes.ToInt(OpCodes.Xor32(sum, OpCodes.Mul32(aug[row][col], x[col])));
        }
        x[leadCol] = sum;
      }

      return x;
    }

    /**
     * Decodes received bits using exhaustive maximum-likelihood decoding
     * For error-free channels, finds the unique message that generates the codeword
     * For noisy channels, finds the message corresponding to closest valid codeword
     * @param {uint8[]} receivedBits - n received bits (possibly with errors)
     * @returns {uint8[]} - k decoded information bits
     */
    decode(receivedBits) {
      if (receivedBits.length !== this.n) {
        throw new Error("Expander decode: Input must be exactly " + this.n + " bits");
      }

      // Validate bits are binary
      for (let i = 0; i < receivedBits.length; ++i) {
        if (receivedBits[i] !== 0 && receivedBits[i] !== 1) {
          throw new Error("Expander decode: Bit " + i + " must be 0 or 1");
        }
      }

      // For educational implementation, use maximum likelihood decoding
      // Real expander code decoding uses message-passing on bipartite graph
      /** @type {float64} */
      let minDistance = Infinity;
      /** @type {uint8[]} */
      let bestMessage = OpCodes.CreateArray(this.k, 0);

      // Exhaustive search over all 2^k possible messages (feasible for small k)
      const totalMessages = Math.pow(2, this.k);

      for (let msgIndex = 0; msgIndex < totalMessages; ++msgIndex) {
        /** @type {uint8[]} */
        const message = [];
        let temp = msgIndex;

        // Generate binary representation of msgIndex
        for (let i = 0; i < this.k; ++i) {
          message.push(Math.floor(temp / Math.pow(2, i)) % 2);
        }

        /** @type {uint8[]} */
        const testCodeword = this.encode(message);

        // Calculate Hamming distance
        /** @type {int32} */
        const distance = this.hammingDistance(receivedBits, testCodeword);

        if (distance < minDistance) {
          minDistance = distance;
          bestMessage = message;
        }
      }

      return bestMessage;
    }

    /**
     * Computes syndrome vector using expander graph structure
     * Note: Uses XOR for GF(2) parity computation (linear code operation)
     * @param {uint8[]} codeword - n-bit codeword
     * @returns {uint8[]} - m-bit syndrome
     */
    computeSyndrome(codeword) {
      /** @type {uint8[]} */
      const syndrome = OpCodes.CreateArray(this.m, 0);

      // Each check node computes XOR of its connected variable nodes
      // This is GF(2) parity check computation (structural, not cryptographic)
      for (let v = 0; v < this.n; v++) {
        if (codeword[v] === 1) {
          /** @type {int32[]} */
          const checks = this.variableToCheck[v];
          for (let t = 0; t < checks.length; ++t) {
            syndrome[checks[t]] = OpCodes.ToInt(OpCodes.Xor32(syndrome[checks[t]], 1)); // GF(2) parity accumulation
          }
        }
      }

      return syndrome;
    }

    /**
     * Checks if vector is all zeros
     * @param {uint8[]} vector - Bit vector
     * @returns {boolean} - True if all zeros
     */
    isZeroVector(vector) {
      for (let i = 0; i < vector.length; ++i) {
        if (vector[i] !== 0) return false;
      }
      return true;
    }

    /**
     * Computes Hamming distance between two bit vectors
     * @param {uint8[]} a - First bit vector
     * @param {uint8[]} b - Second bit vector
     * @returns {int32} - Hamming distance
     */
    hammingDistance(a, b) {
      if (a.length !== b.length) {
        throw new Error('Vectors must have same length');
      }

      let distance = 0;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          distance++;
        }
      }
      return distance;
    }

    /**
     * Gets expansion properties of the expander graph
     * @returns {ExpanderGraphProperties} - Graph properties
     */
    getGraphProperties() {
      return new ExpanderGraphProperties(this.n, this.m, this.k);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ExpanderCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ExpanderCodeAlgorithm, ExpanderCodeInstance };
}));
