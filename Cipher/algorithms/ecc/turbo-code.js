/*
 * Turbo Code Implementation
 * Parallel concatenated convolutional codes with iterative decoding for 3G/4G LTE
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

  class TurboCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Turbo Code";
      this.description = "Parallel concatenated convolutional codes with iterative decoding. First practical codes to closely approach Shannon limit. Used in 3G/4G mobile communications. Two recursive systematic convolutional encoders separated by interleaver. Iterative MAP/SOVA decoding with extrinsic information exchange.";
      this.inventor = "Claude Berrou, Alain Glavieux, Punya Thitimajshima";
      this.year = 1993;
      this.category = CategoryType.ECC;
      this.subCategory = "Concatenated Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.FR;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Turbo Code", "https://en.wikipedia.org/wiki/Turbo_code"),
        new LinkItem("3GPP TS 36.212 - LTE Multiplexing and Channel Coding", "https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/"),
        new LinkItem("Turbo Code Tutorial", "https://www.mathworks.com/help/comm/ug/turbo-encoder.html"),
        new LinkItem("NASA Turbo Code Overview", "https://tmo.jpl.nasa.gov/progress_report/42-154/154F.pdf")
      ];

      this.references = [
        new LinkItem("Original 1993 ICC Paper", "https://ieeexplore.ieee.org/document/264935"),
        new LinkItem("Berrou et al. - Near Shannon Limit Error-Correcting Coding", "https://doi.org/10.1109/ICC.1993.264935"),
        new LinkItem("3GPP LTE Physical Layer Specification", "https://www.3gpp.org/ftp/Specs/archive/36_series/36.211/"),
        new LinkItem("Iterative Decoding Survey", "https://ieeexplore.ieee.org/document/910577")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Decoding Complexity",
          "Iterative MAP/SOVA decoding requires significant computational resources. Complexity increases with frame length and iteration count."
        ),
        new Vulnerability(
          "Decoding Latency",
          "Iterative decoding introduces latency proportional to iteration count. Critical for real-time applications."
        ),
        new Vulnerability(
          "Error Floor",
          "Low error floors may occur at high SNR due to low-weight codewords. Mitigated by interleaver design."
        )
      ];

      // Test vectors based on standard rate 1/3 turbo code configuration
      // Using constraint length K=4, generators (13,15) octal
      // Verified with actual encoder output
      this.tests = [
        new TestCase(
          [0, 0, 0, 0], // 4 zero bits input
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Systematic + 2 parity streams (rate 1/3)
          "Turbo code all zeros - K=4 rate 1/3",
          "https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/"
        ),
        new TestCase(
          [1, 0, 0, 0], // Single 1 bit
          [1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1], // Encoded with both RSC encoders
          "Turbo code single bit - K=4 rate 1/3",
          "https://www.3gpp.org/ftp/Specs/archive/36_series/36.212/"
        ),
        new TestCase(
          [1, 1, 0, 0], // Pattern 1100
          [1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0], // Encoded output
          "Turbo code pattern 1100 - K=4 rate 1/3",
          "https://ieeexplore.ieee.org/document/264935"
        ),
        new TestCase(
          [1, 0, 1, 0], // Alternating pattern
          [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1], // Encoded with interleaving
          "Turbo code alternating - K=4 rate 1/3",
          "https://ieeexplore.ieee.org/document/264935"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TurboCodeInstance(this, isInverse);
    }
  }

  /**
 * TurboCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TurboCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;

      // Standard turbo code configuration (LTE-like)
      // K=4 constraint length, rate 1/3
      this._constraintLength = 4;
      this._generator1 = 0b1101; // 13 octal - feedback polynomial
      this._generator2 = 0b1111; // 15 octal - feedforward polynomial
      this._iterations = 6; // Iterative decoding iterations
      this._interleaver = null; // Will be generated based on input length
    }

    set iterations(value) {
      if (value < 1 || value > 20) {
        throw new Error('TurboCodeInstance.iterations: Must be between 1 and 20');
      }
      this._iterations = value;
    }

    get iterations() {
      return this._iterations;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TurboCodeInstance.Feed: Input must be bit array');
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
        throw new Error('TurboCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      // Turbo encoding: parallel concatenation of two RSC encoders
      // Output format: [systematic bits, parity1 bits, parity2 bits]
      const n = data.length;
      const systematic = [...data];

      // Generate interleaver for this block size
      this._interleaver = this.generateInterleaver(n);

      // First RSC encoder (no interleaving)
      const parity1 = this.rscEncode(data);

      // Interleave input for second encoder
      const interleaved = this.interleave(data, this._interleaver);

      // Second RSC encoder (with interleaving)
      const parity2 = this.rscEncode(interleaved);

      // Combine into rate 1/3 output: systematic + parity1 + parity2
      const encoded = [];
      for (let i = 0; i < n; ++i) {
        encoded.push(systematic[i], parity1[i], parity2[i]);
      }

      return encoded;
    }

    rscEncode(data) {
      // Recursive Systematic Convolutional encoder
      // Using generators (13, 15) octal for K=4
      const parity = [];
      let state = 0; // K-1 = 3 bits of state
      const stateMask = OpCodes.Shl32(1, (this._constraintLength - 1)) - 1;

      for (let i = 0; i < data.length; ++i) {
        const inputBit = OpCodes.AndN(data[i], 1);

        // Compute parity output before state update
        const fullState = OpCodes.OrN(state, OpCodes.Shl32(inputBit, (this._constraintLength - 1)));
        const parityBit = this.convolve(fullState, this._generator2);

        // Feedback through generator1
        const feedbackBit = this.convolve(fullState, this._generator1);

        // Update state with feedback
        state = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(state, 1), feedbackBit), stateMask);

        parity.push(parityBit);
      }

      return parity;
    }

    convolve(state, generator) {
      // XOR all bits where generator polynomial is 1
      let result = 0;
      let temp = OpCodes.AndN(state, generator);

      while (temp) {
        result = OpCodes.XorN(result, OpCodes.AndN(temp, 1));
        temp = OpCodes.Shr32(temp, 1);
      }

      return result;
    }

    generateInterleaver(length) {
      // Generate pseudo-random interleaver using S-random interleaver
      // For educational purposes, using simple block interleaver
      // In 3GPP LTE, QPP (Quadratic Permutation Polynomial) is used

      const interleaver = [];
      const rows = Math.ceil(Math.sqrt(length));
      const cols = Math.ceil(length / rows);

      // Block interleaver: write by rows, read by columns
      for (let c = 0; c < cols; ++c) {
        for (let r = 0; r < rows; ++r) {
          const idx = r * cols + c;
          if (idx < length) {
            interleaver.push(idx);
          }
        }
      }

      return interleaver;
    }

    interleave(data, pattern) {
      const result = new Array(data.length);
      for (let i = 0; i < pattern.length; ++i) {
        result[i] = data[pattern[i]];
      }
      return result;
    }

    deinterleave(data, pattern) {
      const result = new Array(data.length);
      for (let i = 0; i < pattern.length; ++i) {
        result[pattern[i]] = data[i];
      }
      return result;
    }

    decode(received) {
      // Simplified iterative turbo decoder
      // Full implementation would use MAP (BCJR) or SOVA algorithm
      // This is an educational approximation using hard decision decoding

      if (received.length % 3 !== 0) {
        throw new Error('Turbo decode: Input length must be multiple of 3 (rate 1/3)');
      }

      const n = received.length / 3;

      // Extract systematic, parity1, and parity2 streams
      const systematic = [];
      const parity1 = [];
      const parity2 = [];

      for (let i = 0; i < n; ++i) {
        systematic.push(received[i * 3]);
        parity1.push(received[i * 3 + 1]);
        parity2.push(received[i * 3 + 2]);
      }

      // Generate same interleaver used for encoding
      this._interleaver = this.generateInterleaver(n);

      // Iterative decoding (simplified)
      let decoded = [...systematic]; // Start with systematic bits
      let extrinsic = new Array(n).fill(0); // Extrinsic information

      for (let iter = 0; iter < this._iterations; ++iter) {
        // Decoder 1: use systematic + parity1 + extrinsic from decoder 2
        const decoder1Output = this.simpleSISODecode(
          systematic,
          parity1,
          extrinsic
        );

        // Compute extrinsic from decoder 1
        const extrinsic1 = decoder1Output.map((val, idx) =>
          val - systematic[idx] - extrinsic[idx]
        );

        // Interleave extrinsic for decoder 2
        const interleavedExtrinsic = this.interleave(extrinsic1, this._interleaver);
        const interleavedSystematic = this.interleave(systematic, this._interleaver);

        // Decoder 2: use interleaved systematic + parity2 + interleaved extrinsic
        const decoder2Output = this.simpleSISODecode(
          interleavedSystematic,
          parity2,
          interleavedExtrinsic
        );

        // Compute extrinsic from decoder 2
        const extrinsic2 = decoder2Output.map((val, idx) =>
          val - interleavedSystematic[idx] - interleavedExtrinsic[idx]
        );

        // Deinterleave extrinsic for next iteration
        extrinsic = this.deinterleave(extrinsic2, this._interleaver);

        // Make hard decisions on final iteration
        if (iter === this._iterations - 1) {
          decoded = decoder1Output.map(llr => llr > 0 ? 1 : 0);
        }
      }

      return decoded;
    }

    simpleSISODecode(systematic, parity, extrinsic) {
      // Simplified Soft-Input Soft-Output decoder
      // Educational approximation of MAP/SOVA algorithm
      // Returns log-likelihood ratios (LLRs)

      const n = systematic.length;
      const llr = new Array(n);

      for (let i = 0; i < n; ++i) {
        // Combine systematic information with parity check and extrinsic
        // In real turbo decoder, this would be full trellis-based BCJR algorithm

        // Simple heuristic: if systematic and parity agree, high confidence
        const systematicContrib = systematic[i] ? 1 : -1;
        const parityContrib = parity[i] ? 1 : -1;
        const extrinsicContrib = extrinsic[i];

        // Weighted combination (simplified)
        llr[i] = 0.5 * systematicContrib + 0.3 * parityContrib + 0.2 * extrinsicContrib;
      }

      return llr;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new TurboCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TurboCodeAlgorithm, TurboCodeInstance };
}));
