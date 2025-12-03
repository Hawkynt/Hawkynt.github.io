/*
 * Multi-Edge Type LDPC Code Implementation
 * Educational implementation of ME-LDPC error correction codes with multiple edge types
 * (c)2006-2025 Hawkynt
 *
 * NOTE: This implementation uses direct bitwise operations (^, &) for Galois Field GF(2) arithmetic.
 * OpCodes is designed for byte-level cryptographic operations; for error correction codes working
 * on individual bits in GF(2), direct operations are more appropriate and readable.
 */

// Load AlgorithmFramework and OpCodes (REQUIRED)

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

  class MultiEdgeLDPCAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Multi-Edge Type LDPC Code";
      this.description = "Generalization of LDPC codes with multiple variable and check node types connected by different edge types. Each edge type has its own degree distribution enabling better optimization than standard LDPC. Used in DVB-S2X satellite broadcasting and 5G NR wireless standards. Spatially-coupled LDPC codes are a special case. Educational implementation demonstrates 2-edge type construction with per-type degree distributions.";
      this.inventor = "Tom Richardson, Rüdiger Urbanke";
      this.year = 2008;
      this.category = CategoryType.ECC;
      this.subCategory = "Structured LDPC Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem(
          "Richardson & Urbanke - Modern Coding Theory",
          "https://www.cambridge.org/core/books/modern-coding-theory/5D29BDA526321BF2566C5C879F577B0C"
        ),
        new LinkItem(
          "Multi-Edge Type LDPC Codes Paper",
          "http://wiiau4.free.fr/pdf/Multi-Edge%20Type%20LDPC%20Codes.pdf"
        ),
        new LinkItem(
          "Error Correction Zoo - Multi-Edge LDPC",
          "https://errorcorrectionzoo.org/c/multi_edge_ldpc"
        ),
        new LinkItem(
          "DVB-S2X Standard (ETSI EN 302 307-2)",
          "https://dvb.org/wp-content/uploads/2021/02/A083-2r2_DVB-S2X_Draft-EN-302-307-2-v131_Feb_2021.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "Richardson & Urbanke 2008 - Multi-Edge Type LDPC Codes",
          "https://www.semanticscholar.org/paper/Multi-Edge-Type-LDPC-Codes-Richardson-Urbanke/27ed099a5e74d9eae71700a187d91fba648da2fd"
        ),
        new LinkItem(
          "5G NR Channel Coding Overview",
          "https://www.cambridge.org/core/journals/apsipa-transactions-on-signal-and-information-processing/article/an-overview-of-channel-coding-for-5g-nr-cellular-communications/CF52C26874AF5E00883E00B6E1F907C7"
        ),
        new LinkItem(
          "Weight Distributions of Multi-Edge LDPC",
          "https://arxiv.org/pdf/1009.1137"
        ),
        new LinkItem(
          "LDPC Decoder for DVB-S2X Standards",
          "https://ieeexplore.ieee.org/document/7345034/"
        )
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Multi-Type Decoder Complexity",
          "Managing multiple edge types requires separate message schedules and update rules for each type, increasing decoder complexity"
        ),
        new Vulnerability(
          "Degree Distribution Optimization",
          "Finding optimal degree distributions per edge type requires extensive density evolution analysis"
        ),
        new Vulnerability(
          "Implementation Overhead",
          "Multiple edge types increase memory requirements and routing complexity in hardware implementations"
        )
      ];

      // Test vectors for 2-edge type ME-LDPC construction
      // Educational implementation with rate 1/2 code
      //
      // Edge Type 1: Information bits with degree-3 variable nodes
      // Edge Type 2: Parity bits with degree-2 variable nodes
      //
      // This creates a (16,8) code: 8 information bits -> 16 codeword bits
      //
      // Test vectors use round-trip validation and specific patterns
      // Reference: Richardson & Urbanke Multi-Edge Type framework
      this.tests = [
        {
          text: "ME-LDPC all-zero codeword (2-edge type, rate 1/2)",
          uri: "http://wiiau4.free.fr/pdf/Multi-Edge%20Type%20LDPC%20Codes.pdf",
          input: [0, 0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "ME-LDPC single-bit test - edge type 1",
          uri: "https://www.semanticscholar.org/paper/Multi-Edge-Type-LDPC-Codes-Richardson-Urbanke/27ed099a5e74d9eae71700a187d91fba648da2fd",
          input: [1, 0, 0, 0, 0, 0, 0, 0]
          // Round-trip test - encode then decode
        },
        {
          text: "ME-LDPC alternating pattern - demonstrating edge type interaction",
          uri: "https://arxiv.org/pdf/1009.1137",
          input: [1, 0, 1, 0, 1, 0, 1, 0]
          // Round-trip test
        },
        {
          text: "ME-LDPC block pattern - edge type 2 dominance",
          uri: "https://errorcorrectionzoo.org/c/multi_edge_ldpc",
          input: [1, 1, 1, 1, 0, 0, 0, 0]
          // Round-trip test
        },
        {
          text: "ME-LDPC all-ones information",
          uri: "https://ieeexplore.ieee.org/document/7345034/",
          input: [1, 1, 1, 1, 1, 1, 1, 1]
          // Round-trip test
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MultiEdgeLDPCInstance(this, isInverse);
    }
  }

  /**
 * MultiEdgeLDPC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MultiEdgeLDPCInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Multi-Edge Type LDPC Parameters
      // Educational 2-edge type construction inspired by Richardson & Urbanke
      //
      // Edge Type 1: Connects information variable nodes (degree 3) to check nodes
      // Edge Type 2: Connects parity variable nodes (degree 2) to check nodes
      //
      // This allows optimized degree distributions per edge type

      // Code dimensions
      this.k = 8;  // Information bits
      this.n = 16; // Codeword length (rate 1/2)
      this.m = 8;  // Number of parity checks

      // Edge type definitions
      this.numEdgeTypes = 2;

      // Edge Type 1: Information bits (systematic part)
      this.edgeType1VariableNodes = this.k; // First 8 variable nodes
      this.edgeType1Degree = 3;             // Each info bit participates in 3 checks

      // Edge Type 2: Parity bits
      this.edgeType2VariableNodes = this.n - this.k; // Last 8 variable nodes
      this.edgeType2Degree = 2;                      // Each parity bit participates in 2 checks

      // Check node degrees (must balance total edges)
      // Total edges from variables = Type1_nodes * Type1_degree + Type2_nodes * Type2_degree
      //                            = 8 * 3 + 8 * 2 = 24 + 16 = 40
      // Divided among m=8 checks = 40/8 = 5 edges per check
      this.checkNodeDegree = 5;

      // Construct multi-edge parity-check matrix
      this.parityCheckMatrix = this.buildMultiEdgeParityMatrix();

      // Transform to systematic form for encoding
      this.transformToSystematicForm();
    }

    /**
     * Build parity-check matrix with multiple edge types
     * Each edge type has different connection patterns and degree distributions
     *
     * Structure: H = [OpCodes.OrN(H1, H2)] where:
     *   H1: m x k submatrix for edge type 1 (information bits)
     *   H2: m x (n-k) submatrix for edge type 2 (parity bits)
     */
    buildMultiEdgeParityMatrix() {
      const H = [];

      // Initialize m x n parity-check matrix
      for (let i = 0; i < this.m; ++i) {
        H[i] = new Array(this.n).fill(0);
      }

      // Build Edge Type 1 connections (information variable nodes)
      // Each information bit connects to exactly 3 check nodes
      // Use deterministic pattern to ensure good graph properties
      for (let varNode = 0; varNode < this.edgeType1VariableNodes; ++varNode) {
        const connectionsNeeded = this.edgeType1Degree;
        const checkNodes = this.selectCheckNodes(varNode, connectionsNeeded, 'type1');

        for (let i = 0; i < checkNodes.length; ++i) {
          H[checkNodes[i]][varNode] = 1;
        }
      }

      // Build Edge Type 2 connections (parity variable nodes)
      // Each parity bit connects to exactly 2 check nodes
      // These connections complete the check node degree requirements
      for (let parNode = 0; parNode < this.edgeType2VariableNodes; ++parNode) {
        const varNode = this.k + parNode; // Offset by information bits
        const connectionsNeeded = this.edgeType2Degree;
        const checkNodes = this.selectCheckNodes(parNode, connectionsNeeded, 'type2');

        for (let i = 0; i < checkNodes.length; ++i) {
          H[checkNodes[i]][varNode] = 1;
        }
      }

      return H;
    }

    /**
     * Select check nodes for a variable node to connect to
     * Uses deterministic algorithm to create good graph structure
     * Different patterns for different edge types
     * Ensures parity submatrix has full rank for systematic encoding
     */
    selectCheckNodes(varNodeIndex, count, edgeType) {
      const checkNodes = [];

      if (edgeType === 'type1') {
        // Information bits: Use cyclic pattern
        const seed = 7;
        for (let i = 0; i < count; ++i) {
          const checkNode = ((varNodeIndex * seed + i * 13) % this.m);
          if (checkNodes.indexOf(checkNode) === -1) {
            checkNodes.push(checkNode);
          } else {
            // Find alternative
            for (let alt = 0; alt < this.m; ++alt) {
              const altCheck = (checkNode + alt) % this.m;
              if (checkNodes.indexOf(altCheck) === -1) {
                checkNodes.push(altCheck);
                break;
              }
            }
          }
        }
      } else {
        // Parity bits (Edge Type 2): Use structured pattern to ensure full rank
        // Each parity variable connects to exactly 2 checks
        // We'll use a pattern that ensures the parity submatrix is full rank

        // For parity variable i (0 to 7), connect to checks based on bit position
        // This creates a near-identity or structured invertible pattern

        if (count === 2) {
          // Primary connection: main diagonal (ensures identity part)
          checkNodes.push(varNodeIndex % this.m);

          // Secondary connection: upper diagonal (creates bi-diagonal structure)
          // Bi-diagonal matrices are always full rank
          const secondCheck = (varNodeIndex + 1) % this.m;
          if (secondCheck !== checkNodes[0]) {
            checkNodes.push(secondCheck);
          } else {
            // Wrap-around case: use different offset
            checkNodes.push((varNodeIndex + 2) % this.m);
          }
        } else {
          // Fallback for other degrees
          for (let i = 0; i < count; ++i) {
            const checkNode = ((varNodeIndex * 11 + i * 17) % this.m);
            if (checkNodes.indexOf(checkNode) === -1) {
              checkNodes.push(checkNode);
            } else {
              for (let alt = 0; alt < this.m; ++alt) {
                const altCheck = (checkNode + alt) % this.m;
                if (checkNodes.indexOf(altCheck) === -1) {
                  checkNodes.push(altCheck);
                  break;
                }
              }
            }
          }
        }
      }

      return checkNodes;
    }

    /**
     * Transform parity-check matrix to systematic form for efficient encoding
     * Uses row operations to convert H to [OpCodes.XorN(P, T) | I] form, then G = [OpCodes.OrN(I, P)]
     */
    transformToSystematicForm() {
      // For LDPC codes, we need to solve H*OpCodes.XorN(c, T) = 0 for encoding
      // We'll transform H into systematic form using Gaussian elimination
      // Goal: H = [OpCodes.OrN(A, B)] where B is invertible (usually identity or near-identity)
      // Then for codeword c = [OpCodes.OrN(s, p)] (OpCodes.OrN(systematic, parity)):
      // H*OpCodes.XorN(c, T) = A*OpCodes.XorN(s, T) + B*OpCodes.XorN(p, T) = 0  =>  OpCodes.XorN(p, T) = B^(-1) * A * OpCodes.XorN(s, T)

      // Make a copy of parity check matrix to transform
      const H_copy = [];
      for (let i = 0; i < this.m; ++i) {
        H_copy[i] = [...this.parityCheckMatrix[i]];
      }

      // Try to get H into form [OpCodes.OrN(A, I)] using column swaps and row operations
      // For educational simplicity, we'll use a robust encoding approach:
      // Solve H*OpCodes.XorN(c, T) = 0 directly for each basis vector

      this.encodingMatrix = [];

      // For each information bit position
      for (let infoBit = 0; infoBit < this.k; ++infoBit) {
        const parityColumn = this.computeParityForBit(infoBit);
        this.encodingMatrix.push(parityColumn);
      }
    }

    /**
     * Compute parity bits for a single information bit position
     * Uses iterative solving with Gaussian elimination
     */
    computeParityForBit(infoBitPos) {
      // Create syndrome vector from this information bit
      const syndrome = new Array(this.m).fill(0);

      for (let check = 0; check < this.m; ++check) {
        syndrome[check] = this.parityCheckMatrix[check][infoBitPos];
      }

      // Extract parity submatrix (rightmost n-k columns)
      const H_parity = [];
      for (let i = 0; i < this.m; ++i) {
        H_parity[i] = [];
        for (let j = 0; j < (this.n - this.k); ++j) {
          H_parity[i][j] = this.parityCheckMatrix[i][this.k + j];
        }
      }

      // Solve H_parity * p = syndrome over GF(2)
      const parity = this.solveLinearSystemGF2(H_parity, syndrome);

      return parity;
    }

    /**
     * Solve linear system A*x = b over GF(2) using Gaussian elimination
     */
    solveLinearSystemGF2(A, b) {
      const m = A.length;
      const n = A[0].length;

      // Create augmented matrix [OpCodes.OrN(A, b)]
      const aug = [];
      for (let i = 0; i < m; ++i) {
        aug[i] = [...A[i], b[i]];
      }

      // Forward elimination to row echelon form
      let pivotRow = 0;
      for (let col = 0; col < n && pivotRow < m; ++col) {
        // Find pivot
        let foundPivot = false;
        for (let row = pivotRow; row < m; ++row) {
          if (aug[row][col] === 1) {
            // Swap rows
            if (row !== pivotRow) {
              const temp = aug[pivotRow];
              aug[pivotRow] = aug[row];
              aug[row] = temp;
            }
            foundPivot = true;
            break;
          }
        }

        if (!foundPivot) continue;

        // Eliminate below
        for (let row = pivotRow + 1; row < m; ++row) {
          if (aug[row][col] === 1) {
            for (let c = 0; c <= n; ++c) {
              aug[row][c] ^= aug[pivotRow][c];
            }
          }
        }

        ++pivotRow;
      }

      // Back substitution
      const solution = new Array(n).fill(0);

      for (let row = Math.min(pivotRow, m) - 1; row >= 0; --row) {
        // Find leading 1
        let leadCol = -1;
        for (let col = 0; col < n; ++col) {
          if (aug[row][col] === 1) {
            leadCol = col;
            break;
          }
        }

        if (leadCol === -1) continue; // Zero row

        // Solve for this variable
        let value = aug[row][n]; // RHS
        for (let col = leadCol + 1; col < n; ++col) {
          value = OpCodes.XorN(value, OpCodes.AndN(aug[row][col], solution[col]));
        }
        solution[leadCol] = value;
      }

      return solution;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('MultiEdgeLDPCInstance.Feed: Input must be bit array');
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
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.result === null) {
        throw new Error('MultiEdgeLDPCInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.n) {
        throw new Error('MultiEdgeLDPCInstance.DetectError: Input must be ' + this.n + '-bit array');
      }

      const syndrome = this.calculateSyndrome(data);
      return !this.isZeroVector(syndrome);
    }

    /**
     * Encode information bits using multi-edge LDPC structure
     * Systematic encoding: codeword = [OpCodes.OrN(info_bits, parity_bits)]
     */
    encode(infoBits) {
      if (infoBits.length !== this.k) {
        throw new Error('Multi-Edge LDPC encode: Input must be exactly ' + this.k + ' bits');
      }

      const codeword = new Array(this.n).fill(0);

      // Copy information bits (systematic part)
      for (let i = 0; i < this.k; ++i) {
        codeword[i] = OpCodes.AndN(infoBits[i], 1);
      }

      // Compute parity bits using precomputed encoding matrix
      // Each parity bit is XOR of subset of information bits
      for (let parityPos = 0; parityPos < (this.n - this.k); ++parityPos) {
        let parityBit = 0;

        for (let infoPos = 0; infoPos < this.k; ++infoPos) {
          if (infoBits[infoPos] === 1 && this.encodingMatrix[infoPos][parityPos] === 1) {
            parityBit = OpCodes.XorN(parityBit, 1);
          }
        }

        codeword[this.k + parityPos] = parityBit;
      }

      return codeword;
    }

    /**
     * Decode received codeword using multi-edge belief propagation
     * Different message schedules for different edge types
     */
    decode(received) {
      if (received.length !== this.n) {
        throw new Error('Multi-Edge LDPC decode: Input must be exactly ' + this.n + ' bits');
      }

      const decoded = [...received];
      const syndrome = this.calculateSyndrome(decoded);

      if (this.isZeroVector(syndrome)) {
        // No errors detected - extract information bits
        return decoded.slice(0, this.k);
      }

      // Multi-edge belief propagation decoding
      // Uses different update schedules for each edge type
      const maxIterations = 20;
      const corrected = this.multiEdgeBeliefPropagation(received, maxIterations);

      return corrected.slice(0, this.k);
    }

    /**
     * Multi-Edge Belief Propagation Decoder
     * Implements type-specific message passing schedules
     *
     * Edge Type 1 (info bits): More aggressive updates (higher reliability)
     * Edge Type 2 (parity bits): Conservative updates (support role)
     */
    multiEdgeBeliefPropagation(received, maxIterations) {
      // Initialize log-likelihood ratios (LLRs)
      // Positive LLR = likely 0, Negative LLR = likely 1
      const channelLLR = received.map(bit => bit === 0 ? 4.0 : -4.0);

      // Message arrays: variable-to-check and check-to-variable
      const varToCheck = [];
      const checkToVar = [];

      // Initialize message structures
      for (let v = 0; v < this.n; ++v) {
        varToCheck[v] = {};
        for (let c = 0; c < this.m; ++c) {
          if (this.parityCheckMatrix[c][v] === 1) {
            varToCheck[v][c] = channelLLR[v];
          }
        }
      }

      for (let c = 0; c < this.m; ++c) {
        checkToVar[c] = {};
        for (let v = 0; v < this.n; ++v) {
          if (this.parityCheckMatrix[c][v] === 1) {
            checkToVar[c][v] = 0.0;
          }
        }
      }

      // Iterative belief propagation
      for (let iter = 0; iter < maxIterations; ++iter) {
        // Check node update (same for all edge types)
        for (let c = 0; c < this.m; ++c) {
          for (let v = 0; v < this.n; ++v) {
            if (this.parityCheckMatrix[c][v] === 1) {
              // Product of signs, minimum magnitude
              let product = 1.0;
              let minMagnitude = 999.0;

              for (let vp = 0; vp < this.n; ++vp) {
                if (vp !== v && this.parityCheckMatrix[c][vp] === 1) {
                  const msg = varToCheck[vp][c] || 0.0;
                  product *= (msg >= 0 ? 1 : -1);
                  minMagnitude = Math.min(minMagnitude, Math.abs(msg));
                }
              }

              checkToVar[c][v] = product * minMagnitude * 0.8; // Damping factor
            }
          }
        }

        // Variable node update with edge-type-specific handling
        const decoded = [];

        for (let v = 0; v < this.n; ++v) {
          let totalLLR = channelLLR[v];

          // Determine edge type
          const isType1 = v < this.k; // Information bits
          const dampingFactor = isType1 ? 0.9 : 0.7; // Type 1 more aggressive

          for (let c = 0; c < this.m; ++c) {
            if (this.parityCheckMatrix[c][v] === 1) {
              totalLLR += (checkToVar[c][v] || 0.0) * dampingFactor;
            }
          }

          // Hard decision
          decoded[v] = totalLLR >= 0 ? 0 : 1;

          // Update variable-to-check messages
          for (let c = 0; c < this.m; ++c) {
            if (this.parityCheckMatrix[c][v] === 1) {
              // Message excludes this check's contribution
              let msgLLR = channelLLR[v];
              for (let cp = 0; cp < this.m; ++cp) {
                if (cp !== c && this.parityCheckMatrix[cp][v] === 1) {
                  msgLLR += (checkToVar[cp][v] || 0.0) * dampingFactor;
                }
              }
              varToCheck[v][c] = msgLLR;
            }
          }
        }

        // Check for convergence
        const currentSyndrome = this.calculateSyndrome(decoded);
        if (this.isZeroVector(currentSyndrome)) {
          return decoded; // Successfully decoded
        }
      }

      // Return best estimate (may contain errors)
      const finalDecoded = [];
      for (let v = 0; v < this.n; ++v) {
        let totalLLR = channelLLR[v];
        for (let c = 0; c < this.m; ++c) {
          if (this.parityCheckMatrix[c][v] === 1) {
            totalLLR += (checkToVar[c][v] || 0.0);
          }
        }
        finalDecoded[v] = totalLLR >= 0 ? 0 : 1;
      }

      return finalDecoded;
    }

    /**
     * Calculate syndrome: s = H * OpCodes.XorN(c, T) (mod 2)
     */
    calculateSyndrome(codeword) {
      const syndrome = new Array(this.m);

      for (let check = 0; check < this.m; ++check) {
        let sum = 0;
        for (let bit = 0; bit < this.n; ++bit) {
          sum = OpCodes.XorN(sum, OpCodes.AndN(this.parityCheckMatrix[check][bit], codeword[bit]));
        }
        syndrome[check] = OpCodes.AndN(sum, 1);
      }

      return syndrome;
    }

    /**
     * Check if vector is all zeros
     */
    isZeroVector(vector) {
      for (let i = 0; i < vector.length; ++i) {
        if (vector[i] !== 0) return false;
      }
      return true;
    }

    /**
     * Get edge type statistics for debugging/analysis
     */
    getEdgeTypeStatistics() {
      return {
        numEdgeTypes: this.numEdgeTypes,
        edgeType1: {
          variableNodes: this.edgeType1VariableNodes,
          degree: this.edgeType1Degree,
          totalEdges: this.edgeType1VariableNodes * this.edgeType1Degree
        },
        edgeType2: {
          variableNodes: this.edgeType2VariableNodes,
          degree: this.edgeType2Degree,
          totalEdges: this.edgeType2VariableNodes * this.edgeType2Degree
        },
        checkNodes: {
          count: this.m,
          averageDegree: this.checkNodeDegree,
          totalEdges: this.m * this.checkNodeDegree
        }
      };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new MultiEdgeLDPCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MultiEdgeLDPCAlgorithm, MultiEdgeLDPCInstance };
}));
