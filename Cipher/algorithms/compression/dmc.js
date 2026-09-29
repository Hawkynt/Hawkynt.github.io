/*
 * DMC (Dynamic Markov Compression) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DMC predicts each input *bit* using a finite-state Markov model and codes
 * it with a carryless binary arithmetic/range coder. The model is a complete
 * binary tree over 8 bit-decisions per byte: states 1..255 are internal
 * nodes (state s has children 2s and 2s+1), states 256..511 are leaves that
 * transition back to the root (state 1), giving an order-0 starting point.
 * Every state begins with a count of 1 for each outgoing edge (a uniform
 * prior). Whenever a transition (state, bit) has been taken often enough
 * (count reaches CloneThreshold) and the state it leads to is also
 * significantly used via other paths, that destination state is "cloned"
 * into a private copy dedicated to this transition, with its statistics
 * split proportionally between the original and the clone. This lets the
 * model specialize its context over time without ever needing a full reset.
 *
 * Reference:
 *   G. V. Cormack and R. N. S. Horspool, "Data Compression Using Dynamic
 *   Markov Modelling", The Computer Journal, Vol. 30, No. 6, 1987,
 *   pp. 541-550.
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // Binary tree model: nodes 1..255 (internal), 256..511 (leaves, order-0 reset).
  /** @type {int32} */
  const INITIAL_STATES = 512;
  /** @type {int32} */
  const MAX_STATES = 0x40000;   // 1 << 18 = 262144 states max
  /** @type {int32} */
  const CLONE_THRESHOLD = 128;  // Minimum edge count before a clone is considered
  /** @type {uint32} */
  const TOP = 0x1000000;        // 1 << 24
  /** @type {uint32} */
  const BOTTOM = 0x10000;       // 1 << 16

  // Builds the initial complete binary tree model shared by encoder/decoder.
  // Returns the initial stateCount (the next free slot for cloning).
  /**
   * @param {int32[]} next0 - Successor after a 0-bit
   * @param {int32[]} next1 - Successor after a 1-bit
   * @param {int32[]} count0 - 0-bit count per state
   * @param {int32[]} count1 - 1-bit count per state
   * @returns {int32} Initial number of states
   */
  function initializeModel(next0, next1, count0, count1) {
    for (let s = 1; s < INITIAL_STATES; s++) {
      count0[s] = 1;
      count1[s] = 1;

      if (s < 256) {
        // Internal node: children are 2s and 2s+1.
        next0[s] = 2 * s;
        next1[s] = 2 * s + 1;
      } else {
        // Leaf node: go back to root (order-0).
        next0[s] = 1;
        next1[s] = 1;
      }
    }

    // State 0 is unused; set defaults so accidental access is safe.
    count0[0] = 1;
    count1[0] = 1;
    next0[0] = 1;
    next1[0] = 1;

    return INITIAL_STATES;
  }

  // Predicted split point p0 for the current state: the sub-range of `range`
  // assigned to a 0-bit, clamped away from the 0/range extremes. The product
  // range * count needs more than 32 bits, so it is formed in float64 (exact).
  /**
   * @param {uint32} range - Current range
   * @param {int32} count0State - 0-bit count of the state
   * @param {int32} total - Both counts of the state
   * @returns {uint32} Split point
   */
  function computeP0(range, count0State, total) {
    /** @type {float64} */
    const wideRange = range;
    /** @type {uint32} */
    let p0 = Math.floor(wideRange * count0State / total);
    if (p0 < 1) {
      p0 = 1;
    }
    if (p0 >= range) {
      p0 = range - 1;
    }
    return p0;
  }

  // Clones the destination state of the (state, bitVal) transition once its
  // edge count crosses CLONE_THRESHOLD and the destination is also
  // meaningfully used via other paths, splitting statistics proportionally.
  // Returns the (possibly incremented) stateCount.
  /**
   * @param {int32} state - Current state
   * @param {int32} bitVal - Bit just coded
   * @param {int32} stateCount - Number of states in use
   * @param {int32[]} next0 - Successor after a 0-bit
   * @param {int32[]} next1 - Successor after a 1-bit
   * @param {int32[]} count0 - 0-bit count per state
   * @param {int32[]} count1 - 1-bit count per state
   * @returns {int32} New number of states
   */
  function maybeClone(state, bitVal, stateCount, next0, next1, count0, count1) {
    if (stateCount >= MAX_STATES) {
      return stateCount;
    }

    /** @type {int32} */
    const targetCount = bitVal === 0 ? count0[state] : count1[state];
    if (targetCount < CLONE_THRESHOLD) {
      return stateCount;
    }

    /** @type {int32} */
    const target = bitVal === 0 ? next0[state] : next1[state];
    /** @type {int32} */
    const targetTotal = count0[target] + count1[target];
    if (targetTotal <= targetCount + 2) {
      return stateCount;
    }

    /** @type {int32} */
    const clone = stateCount;

    next0[clone] = next0[target];
    next1[clone] = next1[target];

    /** @type {float64} */
    const ratio = targetCount / targetTotal;
    /** @type {int32} */
    const oldCount0 = count0[target];
    /** @type {int32} */
    const oldCount1 = count1[target];
    count0[clone] = Math.max(1, Math.floor(oldCount0 * ratio));
    count1[clone] = Math.max(1, Math.floor(oldCount1 * ratio));
    count0[target] = Math.max(1, oldCount0 - count0[clone] + 1);
    count1[target] = Math.max(1, oldCount1 - count1[clone] + 1);

    if (bitVal === 0) {
      next0[state] = clone;
    } else {
      next1[state] = clone;
    }

    return stateCount + 1;
  }

  /**
 * DMCCompression - Dynamic Markov Compression algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class DMCCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "DMC";
        this.description = "Dynamic Markov Compression. Predicts each bit with an adaptive finite-state Markov model (a binary tree that grows by cloning states shared by multiple significant paths) and codes it with a carryless binary arithmetic coder.";
        this.inventor = "Gordon V. Cormack, R. Nigel S. Horspool";
        this.year = 1987;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Context Modeling";
        this.securityStatus = null;
        this.complexity = ComplexityType.EXPERT;
        this.country = CountryCode.CA;

        // Documentation and references
        this.documentation = [
          new LinkItem("Data Compression Using Dynamic Markov Modelling (Cormack and Horspool, 1987)", "https://doi.org/10.1093/comjnl/30.6.541"),
          new LinkItem("Dynamic Markov compression - Wikipedia", "https://en.wikipedia.org/wiki/Dynamic_Markov_compression"),
          new LinkItem("Arithmetic coding - Wikipedia", "https://en.wikipedia.org/wiki/Arithmetic_coding")
        ];

        this.references = [
          new LinkItem("A bit-level context modeling and arithmetic coding overview", "https://www.cs.cmu.edu/~aberger/pdf/dmc.pdf"),
          new LinkItem("Data Compression: The Complete Reference (Salomon)", "https://www.springer.com/gp/book/9781846286025")
        ];

        // Test vectors - round-trip compression tests only (DMC's compressed
        // output is inherently implementation-defined: it depends on the
        // exact initial automaton, clone thresholds, and arithmetic coder
        // precision, none of which the original paper fixes precisely).
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Repetitive input - 'AAAAAAAAAA'",
            uri: "https://doi.org/10.1093/comjnl/30.6.541",
            input: OpCodes.AsciiToBytes("AAAAAAAAAA"),
            expected: []
          },
          {
            text: "Text sample - 'the quick brown fox'",
            uri: "https://doi.org/10.1093/comjnl/30.6.541",
            input: OpCodes.AsciiToBytes("the quick brown fox"),
            expected: []
          }
        ];
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {DMCInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new DMCInstance(this, isInverse);
      }
    }

    class DMCInstance extends IAlgorithmInstance {
      /**
       * @param {DMCCompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          result = this._decompress(this.inputBuffer);
        } else {
          result = this._compress(this.inputBuffer);
        }
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /**
       * Settle the leading byte of the interval while it is fixed
       * (carryless normalization, identical in encoder and decoder)
       * @param {uint32} low - Interval start
       * @param {uint32} range - Interval size
       * @returns {boolean} True when a byte has to be shifted out
       */
      _mustShift(low, range) {
        /** @type {uint32} */
        const sum = OpCodes.Add32(low, range);
        if (OpCodes.Xor32(low, sum) >= TOP) {
          return range < BOTTOM;
        }
        return true;
      }

      /**
       * @param {uint8[]} data - Input bytes (a missing array counts as empty)
       * @returns {uint8[]} Size header and coded stream
       */
      _compress(data) {
        /** @type {uint8[]} */
        let input = data;
        if (!input) {
          input = [];
        }

        // 4-byte LE original length header.
        /** @type {uint8[]} */
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(input.length));
        if (input.length === 0) {
          return output;
        }

        /** @type {int32[]} */
        const next0 = new Int32Array(MAX_STATES);
        /** @type {int32[]} */
        const next1 = new Int32Array(MAX_STATES);
        /** @type {int32[]} */
        const count0 = new Int32Array(MAX_STATES);
        /** @type {int32[]} */
        const count1 = new Int32Array(MAX_STATES);
        /** @type {int32} */
        let stateCount = initializeModel(next0, next1, count0, count1);

        // Carryless arithmetic encoder state.
        /** @type {uint32} */
        let low = 0;
        /** @type {uint32} */
        let range = 0xFFFFFFFF;
        /** @type {int32} */
        let state = 1; // Root of binary tree.

        /** @type {uint8[]} */
        const bytes = [];

        for (let i = 0; i < input.length; i++) {
          /** @type {uint8} */
          const byteVal = input[i];
          for (let bit = 7; bit >= 0; bit--) {
            /** @type {int32} */
            const bitVal = OpCodes.GetBit(byteVal, bit) ? 1 : 0;
            /** @type {int32} */
            const total = count0[state] + count1[state];
            /** @type {uint32} */
            const p0 = computeP0(range, count0[state], total);

            if (bitVal === 0) {
              range = p0;
              count0[state]++;
            } else {
              low = OpCodes.Add32(low, p0);
              range = OpCodes.Sub32(range, p0);
              count1[state]++;
            }

            stateCount = maybeClone(state, bitVal, stateCount, next0, next1, count0, count1);

            state = bitVal === 0 ? next0[state] : next1[state];

            // Carryless normalization.
            while (this._mustShift(low, range)) {
              /** @type {uint32} */
              const sum = OpCodes.Add32(low, range);
              if (OpCodes.Xor32(low, sum) >= TOP) {
                range = OpCodes.And32(OpCodes.Sub32(0, low), BOTTOM - 1);
              }
              bytes.push(OpCodes.GetByte(low, 3));
              low = OpCodes.Shl32(low, 8);
              range = OpCodes.Shl32(range, 8);
            }
          }
        }

        // Flush encoder.
        for (let i = 0; i < 4; i++) {
          bytes.push(OpCodes.GetByte(low, 3));
          low = OpCodes.Shl32(low, 8);
        }

        for (let i = 0; i < bytes.length; i++) {
          output.push(bytes[i]);
        }
        return output;
      }

      /**
       * @param {uint8[]} data - Size header and coded stream (a missing array counts as empty)
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        /** @type {uint8[]} */
        let input = data;
        if (!input) {
          input = [];
        }
        if (input.length < 4) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        /** @type {uint32} */
        const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
        /** @type {uint8[]} */
        const result = new Array(originalSize);
        if (originalSize === 0) {
          return result;
        }

        /** @type {uint8[]} */
        const src = input.slice(4);
        /** @type {int32[]} */
        const next0 = new Int32Array(MAX_STATES);
        /** @type {int32[]} */
        const next1 = new Int32Array(MAX_STATES);
        /** @type {int32[]} */
        const count0 = new Int32Array(MAX_STATES);
        /** @type {int32[]} */
        const count1 = new Int32Array(MAX_STATES);
        /** @type {int32} */
        let stateCount = initializeModel(next0, next1, count0, count1);

        // Carryless arithmetic decoder state.
        /** @type {uint32} */
        let low = 0;
        /** @type {uint32} */
        let range = 0xFFFFFFFF;
        /** @type {uint32} */
        let code = 0;
        /** @type {int32} */
        let srcPos = 0;

        // Prime the code register.
        for (let i = 0; i < 4; i++) {
          /** @type {uint8} */
          const nextByte = srcPos < src.length ? src[srcPos++] : 0;
          code = OpCodes.Or32(OpCodes.Shl32(code, 8), nextByte);
        }

        /** @type {int32} */
        let state = 1; // Root of binary tree.

        for (let i = 0; i < originalSize; i++) {
          /** @type {uint32} */
          let b = 0;
          for (let bit = 7; bit >= 0; bit--) {
            /** @type {int32} */
            const total = count0[state] + count1[state];
            /** @type {uint32} */
            const p0 = computeP0(range, count0[state], total);

            /** @type {int32} */
            let bitVal = 0;
            /** @type {uint32} */
            const diff = OpCodes.Sub32(code, low);
            if (diff < p0) {
              bitVal = 0;
              range = p0;
              count0[state]++;
            } else {
              bitVal = 1;
              low = OpCodes.Add32(low, p0);
              range = OpCodes.Sub32(range, p0);
              count1[state]++;
            }

            stateCount = maybeClone(state, bitVal, stateCount, next0, next1, count0, count1);

            state = bitVal === 0 ? next0[state] : next1[state];

            b = OpCodes.SetBit(b, bit, bitVal === 1);

            // Carryless normalization (must match encoder exactly).
            while (this._mustShift(low, range)) {
              /** @type {uint32} */
              const sum = OpCodes.Add32(low, range);
              if (OpCodes.Xor32(low, sum) >= TOP) {
                range = OpCodes.And32(OpCodes.Sub32(0, low), BOTTOM - 1);
              }
              /** @type {uint8} */
              const nextByte = srcPos < src.length ? src[srcPos++] : 0;
              code = OpCodes.Or32(OpCodes.Shl32(code, 8), nextByte);
              low = OpCodes.Shl32(low, 8);
              range = OpCodes.Shl32(range, 8);
            }
          }
          result[i] = OpCodes.ToUint8(b);
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new DMCCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DMCCompression, DMCInstance };
}));
