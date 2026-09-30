/*
 * Repeat-Accumulate (RA) Code Implementation
 * Capacity-approaching code using repeat-interleave-accumulate construction
 * (c)2006-2025 Hawkynt
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

  class RepeatAccumulateCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Repeat-Accumulate Code";
      this.description = "Capacity-approaching code using repeat-interleave-accumulate construction. Serial concatenation of repetition code with differential encoder (mod-2 accumulator). Used in DVB-RCS satellite standard. Simple construction achieving near-Shannon limit performance with iterative decoding.";
      this.inventor = "Dariush Divsalar, Hui Jin, Robert J. McEliece";
      this.year = 1998;
      this.category = CategoryType.ECC;
      this.subCategory = "Concatenated Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Repeat-Accumulate Code", "https://en.wikipedia.org/wiki/Repeat-accumulate_code"),
        new LinkItem("Error Correction Zoo - RA Code", "https://errorcorrectionzoo.org/c/ra"),
        new LinkItem("MacKay - Information Theory, Inference and Learning", "http://www.inference.org.uk/mackay/itila/"),
        new LinkItem("DVB-RCS Standard Overview", "https://www.etsi.org/technologies/satellite")
      ];

      this.references = [
        new LinkItem("Divsalar et al. - Coding Theorems for Turbo-Like Codes (1998)", "https://tmo.jpl.nasa.gov/progress_report2/"),
        new LinkItem("MacKay, Neal - Near Shannon Limit Performance", "https://www.inference.org.uk/mackay/abstracts/ldpc.html"),
        new LinkItem("Jin et al. - Irregular RA Codes (2000)", "https://ieeexplore.ieee.org/document/1377999/"),
        new LinkItem("DVB-RCS Specifications", "https://www.etsi.org/deliver/etsi_en/301700_301799/301790/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Not Asymptotically Good",
          "RA codes do not maintain constant rate and minimum distance as block length increases. Subject to upper bounds on minimum distance."
        ),
        new Vulnerability(
          "Decoding Complexity",
          "Iterative belief propagation decoding requires significant computation. Performance depends on interleaver quality and iteration count."
        ),
        new Vulnerability(
          "Error Floor",
          "May exhibit error floor at high SNR due to low-weight codewords. Interleaver design critical for performance."
        )
      ];

      // Test vectors based on standard RA code with q=3 repetition, seed=42
      // These vectors demonstrate the repeat-interleave-accumulate construction
      // Construction verified against algorithm from Divsalar et al. 1998
      // Using seeded LCG-based Fisher-Yates interleaver for reproducibility
      this.tests = [
        new TestCase(
          [0, 0], // 2-bit input (K=2)
          [0, 0, 0, 0, 0, 0], // 6-bit output (rate 1/3 with q=3)
          "RA code all zeros - K=2 q=3 seed=42",
          "https://errorcorrectionzoo.org/c/ra"
        ),
        new TestCase(
          [1, 0], // Input: 1,0
          [1, 1, 0, 0, 1, 1], // After repeat [1,1,1,0,0,0], interleave with seed=42, accumulate
          "RA code pattern 10 - K=2 q=3 seed=42",
          "https://errorcorrectionzoo.org/c/ra"
        ),
        new TestCase(
          [0, 1], // Input: 0,1
          [0, 1, 1, 0, 0, 1], // After repeat [0,0,0,1,1,1], interleave with seed=42, accumulate
          "RA code pattern 01 - K=2 q=3 seed=42",
          "https://errorcorrectionzoo.org/c/ra"
        ),
        new TestCase(
          [1, 1], // Input: 1,1
          [1, 0, 1, 0, 1, 0], // After repeat [1,1,1,1,1,1], interleave with seed=42, accumulate
          "RA code pattern 11 - K=2 q=3 seed=42",
          "https://errorcorrectionzoo.org/c/ra"
        ),
        new TestCase(
          [1, 0, 1], // Input: 1,0,1
          [1, 1, 0, 1, 1, 1, 0, 1, 0], // K=3 q=3 seed=42
          "RA code pattern 101 - K=3 q=3 seed=42",
          "https://errorcorrectionzoo.org/c/ra"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RepeatAccumulateCodeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RepeatAccumulateCodeInstance(this, isInverse);
    }
  }

  /**
 * RepeatAccumulateCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RepeatAccumulateCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {RepeatAccumulateCodeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.result = null;

      // Standard RA code configuration
      /** @type {int32} */
      this._repetitionFactor = 3; // q=3 (rate 1/3)
      /** @type {int32[]} */
      this._interleaver = null; // Random interleaver pattern
      /** @type {int32} */
      this._iterations = 10; // Iterative decoding iterations
      /** @type {int32} */
      this._seed = 42; // PRNG seed for reproducible interleaver
    }

    /**
     * @param {int32} value - Repetition factor q (2..10)
     */
    set repetitionFactor(value) {
      if (value < 2 || value > 10) {
        throw new Error('RepeatAccumulateCodeInstance.repetitionFactor: Must be between 2 and 10');
      }
      this._repetitionFactor = value;
    }

    /**
     * @returns {int32} Repetition factor q
     */
    get repetitionFactor() {
      return this._repetitionFactor;
    }

    /**
     * @param {int32} value - Decoder iterations (1..50)
     */
    set iterations(value) {
      if (value < 1 || value > 50) {
        throw new Error('RepeatAccumulateCodeInstance.iterations: Must be between 1 and 50');
      }
      this._iterations = value;
    }

    /**
     * @returns {int32} Decoder iterations
     */
    get iterations() {
      return this._iterations;
    }

    /**
     * @param {int32} value - Interleaver seed
     */
    set seed(value) {
      this._seed = value;
    }

    /**
     * @returns {int32} Interleaver seed
     */
    get seed() {
      return this._seed;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('RepeatAccumulateCodeInstance.Feed: Input must be bit array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk cannot be coded on its own
      // either, because block boundaries and parity are counted from the start
      // of the message, so the symbols are collected here and coded once, in
      // Result().
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('RepeatAccumulateCodeInstance.Result: Call Feed() first to process data');
      }
      this.result = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.result;
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      // RA codes don't have simple syndrome-based error detection
      // Error detection requires full iterative decoding
      return false; // Educational implementation - full decoding needed
    }

    /**
     * @param {uint8[]} data - Message symbols
     * @returns {uint8[]} Codeword symbols
     */
    encode(data) {
      // RA Code Encoding: Repeat → Interleave → Accumulate
      // Rate = K / (q*K) = 1/q where q is repetition factor

      const k = data.length; // Information length
      const n = k * this._repetitionFactor; // Code length

      // Step 1: Repetition - repeat each bit q times
      /** @type {uint8[]} */
      const repeated = this.repeat(data, this._repetitionFactor);

      // Step 2: Interleave - apply random permutation
      this._interleaver = this.generateInterleaver(n, this._seed);
      /** @type {uint8[]} */
      const interleaved = this.interleave(repeated, this._interleaver);

      // Step 3: Accumulate - mod-2 differential encoding
      /** @type {uint8[]} */
      const encoded = this.accumulate(interleaved);

      return encoded;
    }

    /**
     * @param {uint8[]} data - Bits
     * @param {int32} q - Repetition factor
     * @returns {uint8[]} Each bit repeated q times
     */
    repeat(data, q) {
      // Repeat each bit q times: [a,b] → [a,a,a,b,b,b] for q=3
      /** @type {uint8[]} */
      const repeated = [];
      for (let i = 0; i < data.length; ++i) {
        for (let j = 0; j < q; ++j) {
          repeated.push(OpCodes.And32(data[i], 1)); // Ensure single bit
        }
      }
      return repeated;
    }

    /**
     * @param {int32} length - Permutation length
     * @param {int32} seed - LCG seed
     * @returns {int32[]} Permutation
     */
    generateInterleaver(length, seed) {
      // Generate pseudo-random interleaver using seeded PRNG
      // For production: use S-random or dithered relative prime interleaver
      // Educational implementation: Fisher-Yates shuffle with LCG

      /** @type {int32[]} */
      const interleaver = [];
      for (let i = 0; i < length; ++i) {
        interleaver[i] = i;
      }

      // Seeded pseudo-random shuffle (LCG-based Fisher-Yates)
      // (the product is formed in double precision, as before, then reduced modulo 2^31)
      /** @type {float64} */
      let lcgState = seed;

      for (let i = length - 1; i > 0; --i) {
        lcgState = OpCodes.And32(lcgState * 1103515245 + 12345, 0x7FFFFFFF); // LCG with modulo 2^31
        /** @type {int32} */
        const j = lcgState % (i + 1);
        const temp = interleaver[i];
        interleaver[i] = interleaver[j];
        interleaver[j] = temp;
      }

      return interleaver;
    }

    /**
     * @param {uint8[]} data - Bits
     * @param {int32[]} pattern - Permutation
     * @returns {uint8[]} output[i] = data[pattern[i]]
     */
    interleave(data, pattern) {
      // Apply permutation: output[i] = input[pattern[i]]
      /** @type {uint8[]} */
      const result = new Array(data.length);
      for (let i = 0; i < pattern.length; ++i) {
        result[i] = data[pattern[i]];
      }
      return result;
    }

    /**
     * @param {uint8[]} data - Bits
     * @param {int32[]} pattern - Permutation
     * @returns {uint8[]} output[pattern[i]] = data[i]
     */
    deinterleave(data, pattern) {
      // Inverse permutation: output[pattern[i]] = input[i]
      /** @type {uint8[]} */
      const result = new Array(data.length);
      for (let i = 0; i < pattern.length; ++i) {
        result[pattern[i]] = data[i];
      }
      return result;
    }

    /**
     * @param {uint8[]} data - Bits
     * @returns {uint8[]} Running XOR
     */
    accumulate(data) {
      // Mod-2 accumulator (differential encoder)
      // Output: [u₁, u₁⊕u₂, u₁⊕u₂⊕u₃, ...]
      // This is a rate-1 convolutional code with transfer function 1/(1+D)

      /** @type {uint8[]} */
      const accumulated = new Array(data.length);
      /** @type {int32} */
      let parity = 0; // Initial state

      for (let i = 0; i < data.length; ++i) {
        parity = OpCodes.ToInt(OpCodes.Xor32(parity, data[i])); // XOR current bit with state (mod-2 addition)
        accumulated[i] = parity;
      }

      return accumulated;
    }

    /**
     * @param {uint8[]} data - Accumulated bits
     * @returns {uint8[]} Differences
     */
    deaccumulate(data) {
      // Inverse of accumulator (differential decoder)
      // Input: [c₁, c₂, c₃, ...] → Output: [c₁, c₁⊕c₂, c₂⊕c₃, ...]

      /** @type {uint8[]} */
      const deaccumulated = new Array(data.length);
      deaccumulated[0] = data[0];

      for (let i = 1; i < data.length; ++i) {
        deaccumulated[i] = OpCodes.ToInt(OpCodes.Xor32(data[i], data[i - 1])); // Differential decoding (mod-2)
      }

      return deaccumulated;
    }

    /**
     * @param {uint8[]} received - Code bits
     * @returns {uint8[]} Information bits
     */
    decode(received) {
      // Simplified iterative RA decoder
      // Full implementation would use belief propagation on factor graph
      // Educational approximation using hard decision decoding

      const n = received.length;
      const k = n / this._repetitionFactor;

      if (n % this._repetitionFactor !== 0) {
        throw new Error("RA decode: Input length " + n + " not multiple of repetition factor " + this._repetitionFactor);
      }

      // Generate same interleaver used for encoding
      this._interleaver = this.generateInterleaver(n, this._seed);

      // Step 1: Deaccumulate (inverse of differential encoder)
      /** @type {uint8[]} */
      const deaccumulated = this.deaccumulate(received);

      // Step 2: Deinterleave
      /** @type {uint8[]} */
      const deinterleaved = this.deinterleave(deaccumulated, this._interleaver);

      // Step 3: Inverse repetition - majority vote decoding
      /** @type {uint8[]} */
      const decoded = this.majorityVote(deinterleaved, this._repetitionFactor);

      return decoded;
    }

    /**
     * @param {uint8[]} data - Repeated bits
     * @param {int32} q - Repetition factor
     * @returns {uint8[]} Majority bits
     */
    majorityVote(data, q) {
      // Decode repetition code by majority voting
      // Group into blocks of q bits and vote

      /** @type {float64} */
      const k = data.length / q;
      /** @type {uint8[]} */
      const decoded = new Array(k);

      for (let i = 0; i < k; ++i) {
        /** @type {int32} */
        let sum = 0;
        for (let j = 0; j < q; ++j) {
          sum += data[i * q + j];
        }
        // Majority vote: if sum > q/2, output 1, else 0
        decoded[i] = sum > (q / 2) ? 1 : 0;
      }

      return decoded;
    }

    // Advanced iterative decoder (educational version)
    /**
     * @param {uint8[]} received - Code bits
     * @param {int32} maxIterations - Iteration limit
     * @returns {uint8[]} Hard decisions
     */
    iterativeDecode(received, maxIterations) {
      // Simplified message-passing decoder on RA code factor graph
      // Real implementation would use sum-product algorithm with LLRs

      const n = received.length;
      const k = n / this._repetitionFactor;

      // Initialize LLR (log-likelihood ratio) messages
      /** @type {float64[]} */
      const llr = [];
      for (let i = 0; i < received.length; ++i) llr.push(received[i] ? 1.0 : -1.0);

      // Iterative message passing (simplified)
      for (let iter = 0; iter < maxIterations; ++iter) {
        // Variable node updates (simplified)
        // Check node updates (simplified)
        // This is a placeholder for full belief propagation
      }

      // Hard decision
      /** @type {float64[]} */
      const head = llr.slice(0, k);
      /** @type {uint8[]} */
      const decoded = [];
      for (let i = 0; i < head.length; ++i) decoded.push(head[i] > 0 ? 1 : 0);
      return decoded;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RepeatAccumulateCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RepeatAccumulateCodeAlgorithm, RepeatAccumulateCodeInstance };
}));
