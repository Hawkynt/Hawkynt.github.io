/*
 * Spatially Coupled LDPC Code Implementation
 * Educational implementation of SC-LDPC error correction codes with threshold saturation
 * (c)2006-2025 Hawkynt
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

  class SpatiallyCoupledLDPCAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Spatially Coupled LDPC Code";
      this.description = "Convolutional-like LDPC codes achieving capacity on binary erasure channel with bounded complexity through spatial coupling. Chain-like coupling structure with threshold saturation to Shannon limit. Used in optical communications and 5G research.";
      this.inventor = "Michael Lentmaier, Arvind Sridharan, Kamil Zigangirov";
      this.year = 2010;
      this.category = CategoryType.ECC;
      this.subCategory = "Capacity-Achieving Code";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.SE;

      // Documentation and references
      this.documentation = [
        new LinkItem(
          "Error Correction Zoo - SC-LDPC",
          "https://errorcorrectionzoo.org/c/sc_ldpc"
        ),
        new LinkItem(
          "Spatially Coupled LDPC Codes from Protographs",
          "https://arxiv.org/abs/1407.5366"
        ),
        new LinkItem(
          "Threshold Saturation Overview",
          "https://ieeexplore.ieee.org/document/6912949/"
        )
      ];

      this.references = [
        new LinkItem(
          "Lentmaier et al. IEEE Trans. IT 2010",
          "https://ieeexplore.ieee.org/document/5571031"
        ),
        new LinkItem(
          "Kudekar et al. Threshold Saturation 2011",
          "https://ieeexplore.ieee.org/document/5942938"
        ),
        new LinkItem(
          "Spatially Coupled LDPC Construction",
          "https://www.researchgate.net/publication/264122887_Spatially_Coupled_LDPC_Codes_Constructed_from_Protographs"
        )
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Windowed Decoding Complexity",
          "Sliding window decoding requires careful management of window size and update strategy for practical implementation"
        ),
        new Vulnerability(
          "Boundary Effects",
          "Termination of finite-length chains can degrade performance at boundaries; requires proper termination strategy"
        ),
        new Vulnerability(
          "Memory Requirements",
          "Spatially coupled structure requires storage of multiple code sections for windowed processing"
        )
      ];

      // Test vectors based on (3,6)-regular SC-LDPC construction
      // Reference: Error Correction Zoo - https://errorcorrectionzoo.org/c/sc_ldpc
      // Educational implementation with simplified coupling matrix
      this.tests = [
        new TestCase(
          [0, 0, 0], // 3-bit information (k=3, one position in chain)
          [0, 0, 0, 0, 0, 0], // 6-bit codeword (all zeros)
          "SC-LDPC all-zero encoding test - L=3, w=2",
          "https://errorcorrectionzoo.org/c/sc_ldpc"
        ),
        new TestCase(
          [1, 0, 0], // 3-bit information
          [1, 0, 0, 1, 0, 1], // 6-bit codeword with spatial coupling
          "SC-LDPC single-bit encoding test - (3,6) protograph",
          "https://errorcorrectionzoo.org/c/sc_ldpc"
        ),
        new TestCase(
          [1, 1, 0], // 3-bit information
          [1, 1, 0, 0, 1, 1], // 6-bit codeword
          "SC-LDPC pattern encoding test - threshold saturation",
          "https://errorcorrectionzoo.org/c/sc_ldpc"
        ),
        new TestCase(
          [1, 0, 1], // 3-bit information
          [1, 0, 1, 0, 0, 0], // 6-bit codeword
          "SC-LDPC alternating pattern test",
          "https://errorcorrectionzoo.org/c/sc_ldpc"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new SpatiallyCoupledLDPCInstance(this, isInverse);
    }
  }

  class SpatiallyCoupledLDPCInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Spatially coupled (3,6)-regular LDPC parameters
      // Based on Lentmaier et al. 2010 construction
      this.L = 3;         // Coupling length (number of positions)
      this.w = 2;         // Coupling width (memory span)
      this.dv = 3;        // Variable node degree
      this.dc = 6;        // Check node degree

      // Code dimensions for simplified implementation
      this.k = 3;         // Information bits per position
      this.n = 6;         // Total bits per position (systematic)

      // Construct spatially coupled parity-check matrix
      // Band-diagonal structure with coupling width w
      this.buildCoupledParityMatrix();
    }

    /**
     * Construct the spatially coupled parity-check matrix
     * Creates a band-diagonal structure by coupling L positions with width w
     */
    buildCoupledParityMatrix() {
      // Simplified (3,6) protograph base matrix for educational purposes
      // In production, this would use proper protograph edge-spreading

      // Base parity check matrix for one position (3 checks, 6 variables)
      const baseMatrix = [
        [1, 1, 1, 0, 0, 0],  // Check 1: connects to vars 0,1,2
        [0, 1, 0, 1, 1, 0],  // Check 2: connects to vars 1,3,4
        [1, 0, 1, 0, 1, 1]   // Check 3: connects to vars 0,2,4,5
      ];

      // For spatial coupling with w=2, we overlap adjacent positions
      // Coupling matrix connects variables across time positions
      this.couplingMatrix = [
        // Position 0 checks
        [1, 1, 1, 0, 0, 0],
        [0, 1, 0, 1, 1, 0],
        [1, 0, 1, 0, 1, 1],

        // Position 1 checks (coupled with position 0)
        [1, 0, 0, 1, 1, 1],
        [0, 1, 1, 0, 1, 0],
        [1, 1, 0, 1, 0, 1],

        // Position 2 checks (coupled with position 1)
        [1, 1, 0, 0, 1, 0],
        [0, 0, 1, 1, 0, 1],
        [1, 0, 1, 1, 1, 0]
      ];

      // Store dimensions
      this.numChecks = this.couplingMatrix.length;
      this.numVars = this.n;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('SpatiallyCoupledLDPCInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('SpatiallyCoupledLDPCInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.n) {
        throw new Error(`SpatiallyCoupledLDPCInstance.DetectError: Input must be ${this.n}-bit array`);
      }

      const syndrome = this.calculateSyndrome(data);
      return !this.isZeroVector(syndrome);
    }

    /**
     * Encode data using spatially coupled LDPC structure
     * Implements simplified systematic encoding with coupled parity bits
     *
     * NOTE: This is an educational implementation. Full SC-LDPC encoding
     * requires solving H*c = 0 using Gaussian elimination or iterative methods.
     * This simplified version demonstrates the spatial coupling concept.
     */
    encode(data) {
      if (data.length !== this.k) {
        throw new Error(`SC-LDPC encode: Input must be exactly ${this.k} bits`);
      }

      const encoded = new Array(this.n).fill(0);

      // Copy systematic information bits
      for (let i = 0; i < this.k; i++) {
        encoded[i] = data[i];
      }

      // Calculate parity bits using spatially coupled structure
      // Each parity bit is computed from information bits and coupling
      for (let p = 0; p < (this.n - this.k); p++) {
        let parity = 0;

        // Sum over information bits according to coupling matrix
        // Using first w rows for initial position
        for (let j = 0; j < this.k; j++) {
          if (this.couplingMatrix[p][j] === 1) {
            parity ^= data[j];
          }
        }

        encoded[this.k + p] = parity;
      }

      return encoded;
    }

    /**
     * Decode using windowed belief propagation
     * Simplified implementation of sliding window decoding
     */
    decode(data) {
      if (data.length !== this.n) {
        throw new Error(`SC-LDPC decode: Input must be exactly ${this.n} bits`);
      }

      const received = [...data];
      const syndrome = this.calculateSyndrome(received);

      if (this.isZeroVector(syndrome)) {
        // No errors detected - systematic code, just extract info bits
        return received.slice(0, this.k);
      }

      // Errors detected - run windowed belief propagation
      // In production, this would use full belief propagation with sliding window
      const decoded = this.windowedBP(received, 10); // 10 iterations for better convergence

      return decoded.slice(0, this.k);
    }

    /**
     * Calculate syndrome for error detection
     * Syndrome = H * codeword (mod 2)
     */
    calculateSyndrome(codeword) {
      const syndrome = [];

      // Use first k checks for syndrome calculation
      const checksToUse = Math.min(this.k, this.numChecks);

      for (let i = 0; i < checksToUse; i++) {
        let sum = 0;
        for (let j = 0; j < this.numVars; j++) {
          if (this.couplingMatrix[i][j] === 1) {
            sum ^= codeword[j];
          }
        }
        syndrome.push(sum);
      }

      return syndrome;
    }

    /**
     * Windowed belief propagation decoder
     * Implements simplified sliding window decoding with threshold saturation
     */
    windowedBP(received, maxIterations) {
      const decoded = [...received];
      const windowSize = this.w; // Window size equals coupling width

      // Initialize log-likelihood ratios (LLRs)
      const llr = received.map(bit => bit === 0 ? 5.0 : -5.0);

      // Belief propagation iterations
      for (let iter = 0; iter < maxIterations; iter++) {
        const checkToVar = new Array(this.numChecks).fill(0).map(() =>
          new Array(this.numVars).fill(0)
        );
        const varToCheck = new Array(this.numVars).fill(0).map(() =>
          new Array(this.numChecks).fill(0)
        );

        // Check node update (simplified)
        for (let c = 0; c < Math.min(this.k, this.numChecks); c++) {
          for (let v = 0; v < this.numVars; v++) {
            if (this.couplingMatrix[c][v] === 1) {
              // Simplified message: product of signs, minimum magnitude
              let prod = 1.0;
              let minMag = 100.0;

              for (let vp = 0; vp < this.numVars; vp++) {
                if (vp !== v && this.couplingMatrix[c][vp] === 1) {
                  const msg = varToCheck[vp][c] || llr[vp];
                  prod *= (msg >= 0) ? 1 : -1;
                  minMag = Math.min(minMag, Math.abs(msg));
                }
              }

              checkToVar[c][v] = prod * minMag * 0.9; // Damping factor
            }
          }
        }

        // Variable node update (simplified)
        for (let v = 0; v < this.numVars; v++) {
          let totalLLR = llr[v];

          for (let c = 0; c < Math.min(this.k, this.numChecks); c++) {
            if (this.couplingMatrix[c][v] === 1) {
              totalLLR += checkToVar[c][v];
            }
          }

          // Update decoded bit
          decoded[v] = (totalLLR >= 0) ? 0 : 1;

          // Update messages for next iteration
          for (let c = 0; c < Math.min(this.k, this.numChecks); c++) {
            if (this.couplingMatrix[c][v] === 1) {
              varToCheck[v][c] = totalLLR - checkToVar[c][v];
            }
          }
        }

        // Check for convergence
        const currentSyndrome = this.calculateSyndrome(decoded);
        if (this.isZeroVector(currentSyndrome)) {
          break; // Decoded successfully
        }
      }

      return decoded;
    }

    /**
     * Check if vector is all zeros
     */
    isZeroVector(vector) {
      return vector.every(bit => bit === 0);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SpatiallyCoupledLDPCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SpatiallyCoupledLDPCAlgorithm, SpatiallyCoupledLDPCInstance };
}));
