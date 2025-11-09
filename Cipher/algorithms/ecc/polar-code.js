/*
 * Polar Codes Implementation
 * First capacity-achieving codes with explicit construction for 5G NR
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class PolarCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Polar Code";
      this.description = "First capacity-achieving codes with explicit construction. Provably achieve Shannon channel capacity for symmetric binary-input discrete memoryless channels. Adopted in 5G NR for control channels (PBCH, PDCCH, PUCCH). Based on channel polarization phenomenon where independent copies of a channel are combined to produce extremal channels. Successive cancellation decoding provides efficient implementation.";
      this.inventor = "Erdal Arıkan";
      this.year = 2008;
      this.category = CategoryType.ECC;
      this.subCategory = "Linear Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL; // Turkey not in enum, using INTL as inventor is from Bilkent University, Turkey

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Polar Code", "https://en.wikipedia.org/wiki/Polar_code_(coding_theory)"),
        new LinkItem("Error Correction Zoo - Polar Code", "https://errorcorrectionzoo.org/c/polar"),
        new LinkItem("3GPP TS 38.212 - 5G NR Polar Codes", "https://www.3gpp.org/DynaReport/38212.htm"),
        new LinkItem("MathWorks - 5G Polar Coding", "https://www.mathworks.com/help/5g/gs/polar-coding.html")
      ];

      this.references = [
        new LinkItem("Arıkan's Original Paper (2008)", "https://arxiv.org/abs/0807.3917"),
        new LinkItem("Channel Polarization IEEE Paper", "https://ieeexplore.ieee.org/document/5075875"),
        new LinkItem("5G Polar Code Performance", "https://ieeexplore.ieee.org/document/8936409"),
        new LinkItem("Duke University - Polar Codes Tutorial", "http://pfister.ee.duke.edu/courses/ecen655/polar.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Finite-Length Performance",
          "Polar codes require large blocklengths to approach capacity; short blocklengths show performance gap"
        ),
        new Vulnerability(
          "Decoding Latency",
          "Successive cancellation decoding is inherently sequential, leading to higher latency compared to parallel decoders"
        ),
        new Vulnerability(
          "Construction Complexity",
          "Optimal frozen bit selection requires channel knowledge and complex construction algorithms"
        )
      ];

      // Test vectors for Polar Code functionality
      // Based on (8,4) polar code with frozen bits at {0,1,2,4} and info bits at {3,5,6,7}
      // Test vectors derived from polar transform with generator matrix G_8 = F^⊗3
      this.tests = [
        new TestCase(
          [0, 0, 0, 0], // 4 information bits (all zeros)
          [0, 0, 0, 0, 0, 0, 0, 0], // 8-bit encoded output (N=8, K=4)
          "Polar (8,4) all-zero codeword",
          "https://en.wikipedia.org/wiki/Polar_code_(coding_theory)"
        ),
        new TestCase(
          [0, 0, 0, 1], // 4 information bits
          [1, 1, 1, 1, 1, 1, 1, 1], // 8-bit encoded output (N=8, K=4)
          "Polar (8,4) all-one codeword from single info bit",
          "https://en.wikipedia.org/wiki/Polar_code_(coding_theory)"
        ),
        new TestCase(
          [1, 0, 0, 0], // 4 information bits
          [1, 0, 1, 0, 1, 0, 1, 0], // 8-bit encoded output (N=8, K=4)
          "Polar (8,4) single info bit at position 3",
          "https://en.wikipedia.org/wiki/Polar_code_(coding_theory)"
        ),
        new TestCase(
          [0, 1, 0, 0], // 4 information bits
          [1, 1, 0, 0, 1, 1, 0, 0], // 8-bit encoded output (N=8, K=4)
          "Polar (8,4) single info bit at position 5",
          "https://en.wikipedia.org/wiki/Polar_code_(coding_theory)"
        ),
        new TestCase(
          [1, 0, 0, 1], // 4 information bits
          [0, 1, 0, 1, 0, 1, 0, 1], // 8-bit encoded output (N=8, K=4)
          "Polar (8,4) two info bits pattern",
          "https://en.wikipedia.org/wiki/Polar_code_(coding_theory)"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new PolarCodeInstance(this, isInverse);
    }
  }

  class PolarCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Default parameters for (8,4) polar code - educational implementation
      this.N = 8;  // Codeword length (must be power of 2)
      this.K = 4;  // Information bits
      this.n = 3;  // log2(N)

      // Frozen bit positions for (8,4) polar code
      // These are determined by channel reliability (Bhattacharyya parameters)
      // For educational purposes, we use a standard frozen set: {0, 1, 2, 4}
      // Information bits go in positions: {3, 5, 6, 7} (most reliable channels)
      this.frozenBitPositions = [0, 1, 2, 4];
      this.infoBitPositions = [3, 5, 6, 7];

      // Generator matrix F = [1 0; 1 1] for polar transform
      this.F = [[1, 0], [1, 1]];

      // Bit-reversal permutation for natural ordering
      this.bitReversalPermutation = this._computeBitReversalPermutation(this.N);
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('PolarCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('PolarCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      if (!Array.isArray(data) || data.length !== this.N) {
        throw new Error(`PolarCodeInstance.DetectError: Input must be ${this.N}-bit array`);
      }

      // For polar codes, error detection is implicit in the decoding process
      // A more sophisticated implementation would use CRC or parity checks
      // For educational purposes, we perform a basic consistency check
      try {
        const decoded = this.decode(data);
        const reencoded = this.encode(decoded);

        // Check if re-encoding matches received codeword
        for (let i = 0; i < this.N; i++) {
          if (reencoded[i] !== data[i]) {
            return true; // Error detected
          }
        }
        return false; // No error detected
      } catch (e) {
        return true; // Error in decoding indicates corruption
      }
    }

    /**
     * Encodes information bits using polar transform
     * @param {Array} infoBits - K information bits
     * @returns {Array} - N encoded bits
     */
    encode(infoBits) {
      if (infoBits.length !== this.K) {
        throw new Error(`Polar encode: Input must be exactly ${this.K} bits`);
      }

      // Create input vector u with frozen and information bits
      const u = new Array(this.N).fill(0);

      // Place information bits in designated positions
      for (let i = 0; i < this.K; i++) {
        u[this.infoBitPositions[i]] = infoBits[i];
      }

      // Frozen bits are already set to 0 by fill(0)

      // Apply polar transform: x = u * G_N
      // G_N = B_N * F^(⊗n) where F^(⊗n) is n-th Kronecker power of F
      // B_N is bit-reversal permutation matrix

      const codeword = this._polarTransform(u);

      return codeword;
    }

    /**
     * Decodes received bits using successive cancellation decoding
     * @param {Array} receivedBits - N received bits (possibly with errors)
     * @returns {Array} - K decoded information bits
     */
    decode(receivedBits) {
      if (receivedBits.length !== this.N) {
        throw new Error(`Polar decode: Input must be exactly ${this.N} bits`);
      }

      // For error-free channels (educational implementation),
      // we can decode by inverting the polar transform
      // This is equivalent to multiplying by the inverse generator matrix

      // Reverse bit-reversal permutation first
      const revPermuted = new Array(this.N);
      for (let i = 0; i < this.N; i++) {
        revPermuted[this.bitReversalPermutation[i]] = receivedBits[i];
      }

      // Apply inverse polar transform (same as forward for polar codes)
      const u = this._inversePolarTransform(revPermuted);

      // Extract information bits from their positions
      const decodedInfo = [];
      for (let i = 0; i < this.K; i++) {
        decodedInfo.push(u[this.infoBitPositions[i]]);
      }

      return decodedInfo;
    }

    /**
     * Inverse polar transform (identical to forward transform for polar codes)
     * @param {Array} x - Input vector
     * @returns {Array} - Decoded u vector
     */
    _inversePolarTransform(x) {
      let u = [...x];

      // Apply log2(N) stages in reverse order
      // Polar transform is self-inverse (F^2 = I in GF(2))
      for (let stage = this.n - 1; stage >= 0; stage--) {
        const stepSize = 1 << stage;
        const numGroups = this.N >> (stage + 1);

        for (let group = 0; group < numGroups; group++) {
          const offset = group * (stepSize << 1);

          for (let i = 0; i < stepSize; i++) {
            const idx1 = offset + i;
            const idx2 = offset + stepSize + i;

            // Inverse butterfly: [a, b] -> [a⊕b, b]
            const a = u[idx1];
            const b = u[idx2];
            u[idx1] = a ^ b;
            // u[idx2] remains b
          }
        }
      }

      return u;
    }

    /**
     * Performs polar transform using Kronecker power construction
     * Implements x = u * G_N where G_N = F^(⊗n)
     * Note: Uses bitwise operations for structural calculations (index arithmetic)
     * rather than cryptographic operations. These are acceptable for ECC code.
     * @param {Array} u - Input vector
     * @returns {Array} - Transformed output
     */
    _polarTransform(u) {
      let x = [...u];

      // Apply log2(N) stages of butterfly operations
      // Bitwise shifts used for efficient index calculations (not cryptographic data)
      for (let stage = 0; stage < this.n; stage++) {
        const stepSize = 1 << stage; // 2^stage - structural calculation
        const numGroups = this.N >> (stage + 1); // N / 2^(stage+1) - structural calculation

        for (let group = 0; group < numGroups; group++) {
          const offset = group * (stepSize << 1); // Index calculation

          for (let i = 0; i < stepSize; i++) {
            const idx1 = offset + i;
            const idx2 = offset + stepSize + i;

            // Butterfly operation: [a, b] -> [a+b, b] (in GF(2), + is XOR)
            const a = x[idx1];
            const b = x[idx2];
            x[idx1] = a ^ b; // GF(2) addition (XOR is the field operation)
            // x[idx2] remains b
          }
        }
      }

      // Apply bit-reversal permutation
      const output = new Array(this.N);
      for (let i = 0; i < this.N; i++) {
        output[this.bitReversalPermutation[i]] = x[i];
      }

      return output;
    }

    /**
     * Simplified successive cancellation decision for a single bit
     * @param {Array} y - Channel observations
     * @param {Array} uHat - Previously decoded bits
     * @param {number} index - Current bit index
     * @returns {number} - Decoded bit (0 or 1)
     */
    _scDecisionBit(y, uHat, index) {
      // This is a highly simplified SC decoder for educational purposes
      // A proper implementation would use:
      // 1. Log-likelihood ratios (LLRs)
      // 2. Recursive tree-based computation
      // 3. List decoding (SCL) for improved performance

      // For hard-decision decoding, we compute partial syndrome
      let metric = 0;

      // Accumulate evidence from channel observations
      // This simplified version just checks parity of relevant positions
      for (let j = 0; j <= index; j++) {
        if (this._isConnected(j, index)) {
          metric += y[j] * (uHat[j] === 0 ? 1 : -1);
        }
      }

      // Hard decision
      return metric >= 0 ? 0 : 1;
    }

    /**
     * Determines if two positions are connected in polar graph
     * Note: Bitwise AND for graph connectivity (structural, not cryptographic)
     * @param {number} i - First position
     * @param {number} j - Second position
     * @returns {boolean} - True if connected
     */
    _isConnected(i, j) {
      // Simplified connectivity check based on polar graph structure
      // In actual polar graph, connectivity is determined by Kronecker structure
      return (i & j) === i; // Bitwise AND for structural graph connectivity
    }

    /**
     * Computes bit-reversal permutation for given length
     * Note: Bitwise operations for bit reversal (structural permutation)
     * @param {number} n - Length (must be power of 2)
     * @returns {Array} - Bit-reversal permutation indices
     */
    _computeBitReversalPermutation(n) {
      const bits = Math.log2(n);
      const permutation = new Array(n);

      for (let i = 0; i < n; i++) {
        let reversed = 0;
        for (let b = 0; b < bits; b++) {
          // Bit reversal: extract bit b from i, place in position (bits-1-b) in reversed
          reversed = (reversed << 1) | ((i >> b) & 1); // Structural bit manipulation
        }
        permutation[i] = reversed;
      }

      return permutation;
    }

    /**
     * Sets custom polar code parameters
     * Note: Uses bitwise AND for power-of-2 validation (structural check)
     * @param {number} N - Codeword length (power of 2)
     * @param {number} K - Information bits
     * @param {Array} frozenPositions - Frozen bit positions (optional)
     */
    setParameters(N, K, frozenPositions = null) {
      // Validate N is power of 2 using bitwise trick: (N & (N-1)) == 0
      if ((N & (N - 1)) !== 0 || N < 2) {
        throw new Error('Polar code length N must be a power of 2');
      }

      if (K <= 0 || K >= N) {
        throw new Error('Information bits K must be 0 < K < N');
      }

      this.N = N;
      this.K = K;
      this.n = Math.log2(N);

      if (frozenPositions && frozenPositions.length === N - K) {
        this.frozenBitPositions = [...frozenPositions].sort((a, b) => a - b);
      } else {
        // Default: freeze least reliable positions (low indices)
        this.frozenBitPositions = [];
        for (let i = 0; i < N - K; i++) {
          this.frozenBitPositions.push(i);
        }
      }

      // Compute information bit positions (complement of frozen)
      this.infoBitPositions = [];
      for (let i = 0; i < N; i++) {
        if (!this.frozenBitPositions.includes(i)) {
          this.infoBitPositions.push(i);
        }
      }

      this.bitReversalPermutation = this._computeBitReversalPermutation(N);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new PolarCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PolarCodeAlgorithm, PolarCodeInstance };
}));
