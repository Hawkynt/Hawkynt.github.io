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
  const INITIAL_STATES = 512;
  const MAX_STATES = 0x40000;   // 1 << 18 = 262144 states max
  const CLONE_THRESHOLD = 128;  // Minimum edge count before a clone is considered
  const TOP = 0x1000000;        // 1 << 24
  const BOTTOM = 0x10000;       // 1 << 16

  // Builds the initial complete binary tree model shared by encoder/decoder.
  // Returns the initial stateCount (the next free slot for cloning).
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
  // assigned to a 0-bit, clamped away from the 0/range extremes.
  function computeP0(range, count0State, total) {
    let p0 = Math.floor(range * count0State / total);
    if (p0 < 1) p0 = 1;
    if (p0 >= range) p0 = range - 1;
    return p0;
  }

  // Clones the destination state of the (state, bitVal) transition once its
  // edge count crosses CLONE_THRESHOLD and the destination is also
  // meaningfully used via other paths, splitting statistics proportionally.
  // Returns the (possibly incremented) stateCount.
  function maybeClone(state, bitVal, stateCount, next0, next1, count0, count1) {
    if (stateCount >= MAX_STATES) return stateCount;

    const targetCount = bitVal === 0 ? count0[state] : count1[state];
    if (targetCount < CLONE_THRESHOLD) return stateCount;

    const target = bitVal === 0 ? next0[state] : next1[state];
    const targetTotal = count0[target] + count1[target];
    if (targetTotal <= targetCount + 2) return stateCount;

    const clone = stateCount;
    stateCount++;

    next0[clone] = next0[target];
    next1[clone] = next1[target];

    const ratio = targetCount / targetTotal;
    const oldCount0 = count0[target];
    const oldCount1 = count1[target];
    count0[clone] = Math.max(1, Math.floor(oldCount0 * ratio));
    count1[clone] = Math.max(1, Math.floor(oldCount1 * ratio));
    count0[target] = Math.max(1, oldCount0 - count0[clone] + 1);
    count1[target] = Math.max(1, oldCount1 - count1[clone] + 1);

    if (bitVal === 0) next0[state] = clone;
    else next1[state] = clone;

    return stateCount;
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

      CreateInstance(isInverse = false) {
        return new DMCInstance(this, isInverse);
      }
    }

    class DMCInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      _compress(data) {
        data = data || [];

        // 4-byte LE original length header.
        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
        if (data.length === 0) return output;

        const next0 = new Int32Array(MAX_STATES);
        const next1 = new Int32Array(MAX_STATES);
        const count0 = new Int32Array(MAX_STATES);
        const count1 = new Int32Array(MAX_STATES);
        let stateCount = initializeModel(next0, next1, count0, count1);

        // Carryless arithmetic encoder state.
        let low = 0;
        let range = 0xFFFFFFFF;
        let state = 1; // Root of binary tree.

        const bytes = [];

        for (let i = 0; i < data.length; i++) {
          const byteVal = data[i];
          for (let bit = 7; bit >= 0; bit--) {
            const bitVal = OpCodes.GetBit(byteVal, bit) ? 1 : 0;
            const total = count0[state] + count1[state];
            const p0 = computeP0(range, count0[state], total);

            if (bitVal === 0) {
              range = p0;
              count0[state]++;
            } else {
              low = OpCodes.ToUint32(low + p0);
              range = range - p0;
              count1[state]++;
            }

            stateCount = maybeClone(state, bitVal, stateCount, next0, next1, count0, count1);

            state = bitVal === 0 ? next0[state] : next1[state];

            // Carryless normalization.
            while (true) {
              const sum = OpCodes.ToUint32(low + range);
              if (OpCodes.ToUint32(OpCodes.XorN(low, sum)) >= TOP) {
                if (range >= BOTTOM) break;
                range = OpCodes.AndN(OpCodes.ToUint32(-low), BOTTOM - 1);
              }
              bytes.push(OpCodes.GetByte(low, 3));
              low = OpCodes.ToUint32(OpCodes.Shl32(low, 8));
              range = OpCodes.ToUint32(OpCodes.Shl32(range, 8));
            }
          }
        }

        // Flush encoder.
        for (let i = 0; i < 4; i++) {
          bytes.push(OpCodes.GetByte(low, 3));
          low = OpCodes.ToUint32(OpCodes.Shl32(low, 8));
        }

        for (let i = 0; i < bytes.length; i++) output.push(bytes[i]);
        return output;
      }

      _decompress(data) {
        data = data || [];
        if (data.length < 4) return [];

        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalSize === 0) return [];

        const src = data.slice(4);
        const next0 = new Int32Array(MAX_STATES);
        const next1 = new Int32Array(MAX_STATES);
        const count0 = new Int32Array(MAX_STATES);
        const count1 = new Int32Array(MAX_STATES);
        let stateCount = initializeModel(next0, next1, count0, count1);

        // Carryless arithmetic decoder state.
        let low = 0;
        let range = 0xFFFFFFFF;
        let code = 0;
        let srcPos = 0;

        // Prime the code register.
        for (let i = 0; i < 4; i++) {
          const nextByte = srcPos < src.length ? src[srcPos++] : 0;
          code = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(code, 8), nextByte));
        }

        const result = new Array(originalSize);
        let state = 1; // Root of binary tree.

        for (let i = 0; i < originalSize; i++) {
          let b = 0;
          for (let bit = 7; bit >= 0; bit--) {
            const total = count0[state] + count1[state];
            const p0 = computeP0(range, count0[state], total);

            let bitVal;
            const diff = OpCodes.ToUint32(code - low);
            if (diff < p0) {
              bitVal = 0;
              range = p0;
              count0[state]++;
            } else {
              bitVal = 1;
              low = OpCodes.ToUint32(low + p0);
              range = range - p0;
              count1[state]++;
            }

            stateCount = maybeClone(state, bitVal, stateCount, next0, next1, count0, count1);

            state = bitVal === 0 ? next0[state] : next1[state];

            b = OpCodes.SetBit(b, bit, bitVal === 1);

            // Carryless normalization (must match encoder exactly).
            while (true) {
              const sum = OpCodes.ToUint32(low + range);
              if (OpCodes.ToUint32(OpCodes.XorN(low, sum)) >= TOP) {
                if (range >= BOTTOM) break;
                range = OpCodes.AndN(OpCodes.ToUint32(-low), BOTTOM - 1);
              }
              const nextByte = srcPos < src.length ? src[srcPos++] : 0;
              code = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(code, 8), nextByte));
              low = OpCodes.ToUint32(OpCodes.Shl32(low, 8));
              range = OpCodes.ToUint32(OpCodes.Shl32(range, 8));
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
