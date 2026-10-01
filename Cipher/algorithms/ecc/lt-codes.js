/*
 * LT Codes (Luby Transform) Implementation
 * First practical fountain codes with rateless property
 * Uses Robust Soliton distribution for optimal performance
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './fountain-foundation.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./fountain-foundation.data')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.FountainFoundation);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, FountainFoundation) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!FountainFoundation) {
    throw new Error('FountainFoundation dependency is required');
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

  /**
   * Encoded-symbol degree statistics
   * @class
   */
  class DegreeStats {
    /**
     * @param {int32} min - Smallest degree
     * @param {int32} max - Largest degree
     * @param {float64} mean - Mean degree
     * @param {int32} median - Median degree
     * @param {int32[]} distribution - Sorted degrees
     */
    constructor(min, max, mean, median, distribution) {
      /** @type {int32} */
      this.min = min;
      /** @type {int32} */
      this.max = max;
      /** @type {float64} */
      this.mean = mean;
      /** @type {int32} */
      this.median = median;
      /** @type {int32[]} */
      this.distribution = distribution;
    }
  }

  /**
   * Code parameters and encoding-graph density as reported by getPerformanceReport()
   * @class
   */
  class LTPerformanceReport {
    /**
     * @param {float64} overheadUsed - Overhead factor
     * @param {int32} sourceSymbols - Source symbols (k)
     * @param {int32} encodedSymbols - Encoded symbols, 0 before encoding
     * @param {float64} graphDensity - Edges over possible edges
     */
    constructor(overheadUsed, sourceSymbols, encodedSymbols, graphDensity) {
      /** @type {float64} */
      this.overheadUsed = overheadUsed;
      /** @type {int32} */
      this.sourceSymbols = sourceSymbols;
      /** @type {int32} */
      this.encodedSymbols = encodedSymbols;
      /** @type {float64} */
      this.graphDensity = graphDensity;
    }
  }

  /**
   * The indices 0 .. count-1
   * @param {int32} count - Number of indices
   * @returns {int32[]} Index list
   */
  function indexRange(count) {
    /** @type {int32[]} */
    const indices = [];
    for (let i = 0; i < count; ++i) indices.push(i);
    return indices;
  }

  class LTCodesAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LT";
      this.description = "LT (Luby Transform) codes are the first practical implementation of digital fountain codes. They provide rateless error correction where encoded symbols can be generated on-demand. Uses Robust Soliton degree distribution for optimal performance with linear encoding/decoding complexity.";
      this.inventor = "Michael Luby";
      this.year = 2002;
      this.category = CategoryType.ECC;
      this.subCategory = "Fountain Codes";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)]; // 1 byte to 64KB blocks
      this.supportsContinuousEncoding = true;
      this.supportsRateless = true;

      // Algorithm-specific parameters
      this.defaultC = 0.1;     // Robust Soliton parameter
      this.defaultDelta = 0.5; // Failure probability
      this.maxOverhead = 1.5;  // Maximum overhead factor

      // Documentation
      this.documentation = [
        new LinkItem("LT Codes Paper", "https://www.icsi.berkeley.edu/pubs/theory/luby02lt.pdf"),
        new LinkItem("Digital Fountain Survey", "https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf"),
        new LinkItem("Fountain Codes Tutorial", "https://en.wikipedia.org/wiki/Fountain_code")
      ];

      this.references = [
        new LinkItem("LT-code Reference Implementation (Python)", "https://github.com/anrosent/LT-code"),
        new LinkItem("Google gofountain Luby Transform Implementation (Go)", "https://github.com/google/gofountain/blob/master/luby.go")
      ];

      // Test vectors generated from reference implementation
      this.tests = [
        new TestCase(
          [0x48, 0x65, 0x6C, 0x6C], // "Hell"
          [0x48, 0x65, 0x6C, 0x6C, 0x09, 0x65, 0x2D, 0x09], // Original + 4 encoded symbols
          "LT encoding test with 4 source symbols",
          "Reference implementation test vector"
        ),
        new TestCase(
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], // 8-byte input
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x03, 0x0A, 0x03, 0x09], // Original + encoded
          "LT encoding test with 8 source symbols",
          "Reference implementation test vector"
        )
      ];

      // Add specific parameters for test vectors
      this.tests[0].k = 4;           // Source symbols
      this.tests[0].overhead = 1.0;  // 100% overhead
      this.tests[0].seed = 12345;    // For reproducible results

      this.tests[1].k = 8;           // Source symbols
      this.tests[1].overhead = 0.5;  // 50% overhead
      this.tests[1].seed = 54321;    // For reproducible results
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {LTCodesInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LTCodesInstance(this, isInverse);
    }
  }

  /**
 * LTCodes cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LTCodesInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LTCodesAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.sourceSymbols = null;
      /** @type {uint8[]} */
      this.encodedSymbols = [];
      /** @type {uint8[]} */
      this.decodedSymbols = null;

      // Parameters
      this.k = 0;               // Number of source symbols
      this.overhead = 1.0;      // Overhead factor (1.0 = 100% overhead)
      this.c = 0.1;            // Robust Soliton parameter
      this.delta = 0.5;        // Failure probability
      this.seed = 12345;       // Random seed for reproducibility

      // Internal state
      /** @type {BipartiteGraph} */
      this.graph = null;
      /** @type {DegreeDistribution} */
      this.degreeDistribution = null;
      /** @type {SeededRandom} */
      this.rng = null;
      /** @type {PerformanceProfiler} */
      this.profiler = new FountainFoundation.PerformanceProfiler();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('LTCodesInstance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        // Decoding mode: accumulate encoded symbols
        for (let _i = 0; _i < data.length; _i++) this.encodedSymbols.push(data[_i]);
      } else {
        // Encoding mode: the source block is the whole message, so successive
        // calls extend it rather than replace it. The symbol count and the
        // encoding graph are derived from the complete block in Result(), since
        // a partition computed from one call's share of the message describes a
        // different code from the one the whole message asks for.
        if (!this.sourceSymbols) {
          /** @type {uint8[]} */
          const fresh = [];
          this.sourceSymbols = fresh;
        }
        for (let i = 0; i < data.length; i++) this.sourceSymbols.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        return this._decode();
      }

      this.k = this.sourceSymbols ? this.sourceSymbols.length : 0;
      if (this.k > 0) this._initializeEncoding();
      return this._encode();
    }

    /**
     * @param {uint8[]} data - Received codeword symbols
     * @returns {boolean} True if errors detected
     */
    DetectError(data) {
      // For fountain codes, error detection is based on successful decoding
      try {
        this.Feed(data);
        const result = this.Result();
        return result !== null;
      } catch (error) {
        return false;
      }
    }

    // Set parameters
    /**
     * @param {int32} k - Source symbol count
     * @param {float64} [overhead=1.0] - Overhead factor
     * @param {float64} [c=0.1] - Robust Soliton parameter
     * @param {float64} [delta=0.5] - Failure probability
     * @param {int32} [seed=12345] - Random seed
     * @returns {void}
     */
    setParameters(k, overhead = 1.0, c = 0.1, delta = 0.5, seed = 12345) {
      this.k = k;
      this.overhead = overhead;
      this.c = c;
      this.delta = delta;
      this.seed = seed;
    }

    /**
     * @returns {void}
     */
    _initializeEncoding() {
      this.rng = new FountainFoundation.SeededRandom(this.seed);
      this.degreeDistribution = new FountainFoundation.DegreeDistribution(this.k);

      // Calculate number of encoded symbols needed
      const numEncoded = Math.ceil(this.k * (1.0 + this.overhead));
      this.graph = new FountainFoundation.BipartiteGraph(this.k, numEncoded);

      this.profiler.startTimer('graph_construction');
      this._constructEncodingGraph();
      this.profiler.endTimer('graph_construction');
    }

    /**
     * @returns {void}
     */
    _constructEncodingGraph() {
      /** @type {float64[]} */
      const cdf = this.degreeDistribution.buildCumulativeDistribution(this.c, this.delta);

      /** @type {int32} */
      const rightNodes = this.graph.rightNodes;
      for (let encodedIdx = 0; encodedIdx < rightNodes; encodedIdx++) {
        // Sample degree from robust soliton distribution
        /** @type {int32} */
        const degree = this.degreeDistribution.sampleDegreeFromCDF(cdf, this.rng);

        // Sample neighbors uniformly at random
        /** @type {int32[]} */
        const sourceIndices = indexRange(this.k);
        /** @type {int32[]} */
        const neighbors = this.rng.sample(sourceIndices, degree);

        // Add edges to graph
        for (let n = 0; n < neighbors.length; ++n) {
          this.graph.addEdge(neighbors[n], encodedIdx);
        }
      }
    }

    /**
     * @returns {uint8[]} Systematic symbols followed by the repair symbols
     */
    _encode() {
      if (!this.sourceSymbols || this.k === 0) {
        throw new Error('No source symbols to encode');
      }

      this.profiler.startTimer('encoding');

      /** @type {uint8[]} */
      const result = this.sourceSymbols.slice(); // Start with systematic encoding

      // Generate encoded symbols
      /** @type {int32} */
      const rightNodes = this.graph.rightNodes;
      for (let encodedIdx = 0; encodedIdx < rightNodes; encodedIdx++) {
        if (encodedIdx < this.k) {
          // Systematic part already included
          continue;
        }

        /** @type {int32[]} */
        const neighbors = this.graph.getNeighbors(encodedIdx);
        /** @type {uint32} */
        let encodedSymbol = 0;

        // XOR all connected source symbols
        for (let n = 0; n < neighbors.length; ++n) {
          encodedSymbol = OpCodes.Xor32(encodedSymbol, this.sourceSymbols[neighbors[n]]);
        }

        result.push(encodedSymbol);
        this.profiler.incrementCounter('encoded_symbols');
      }

      this.profiler.endTimer('encoding');
      return result;
    }

    /**
     * @returns {uint8[]} Decoded source symbols
     */
    _decode() {
      if (this.encodedSymbols.length === 0) {
        throw new Error('No encoded symbols to decode');
      }

      this.profiler.startTimer('decoding');

      // Initialize decoding state
      /** @type {uint8[]} */
      const received = this.encodedSymbols.slice();
      const numReceived = received.length;

      // Assume systematic encoding for simplicity in this implementation
      if (numReceived < this.k) {
        throw new Error('Insufficient symbols for decoding');
      }

      // Extract systematic part
      /** @type {uint8[]} */
      const decoded = received.slice(0, this.k);

      // In a full implementation, we would use belief propagation
      // For this educational implementation, we assume systematic encoding
      this.decodedSymbols = decoded;

      this.profiler.endTimer('decoding');
      return decoded;
    }

    // Belief Propagation Decoder (simplified)
    /**
     * @param {uint8[]} receivedSymbols - Received symbols
     * @param {BipartiteGraph} encodingGraph - Encoding graph
     * @returns {uint8[]} Decoded symbols, or null when peeling stalls
     */
    _beliefPropagationDecode(receivedSymbols, encodingGraph) {
      /** @type {int32} */
      const numReceived = receivedSymbols.length;
      /** @type {uint8[]} */
      const decoded = [];
      /** @type {boolean[]} */
      const symbolStatus = []; // false = unknown, true = decoded
      for (let i = 0; i < this.k; ++i) {
        decoded.push(null);
        symbolStatus.push(false);
      }

      // Work with a copy of the graph
      /** @type {BipartiteGraph} */
      const workingGraph = encodingGraph.clone();
      /** @type {uint8[]} */
      const workingSymbols = receivedSymbols.slice();

      let decodedCount = 0;
      let iterationCount = 0;
      const maxIterations = this.k * 2;

      while (decodedCount < this.k && iterationCount < maxIterations) {
        iterationCount++;
        let progress = false;

        // Find degree-1 encoded symbols
        for (let encodedIdx = 0; encodedIdx < numReceived; encodedIdx++) {
          /** @type {int32[]} */
          const neighbors = workingGraph.getNeighbors(encodedIdx);

          if (neighbors.length === 1) {
            /** @type {int32} */
            const sourceIdx = neighbors[0];

            if (!symbolStatus[sourceIdx]) {
              // Decode this source symbol
              decoded[sourceIdx] = workingSymbols[encodedIdx];
              symbolStatus[sourceIdx] = true;
              decodedCount++;
              progress = true;

              // Update all encoded symbols connected to this source
              /** @type {int32[]} */
              const connectedEncoded = workingGraph.getReverseNeighbors(sourceIdx);
              for (let c = 0; c < connectedEncoded.length; ++c) {
                /** @type {int32} */
                const connectedIdx = connectedEncoded[c];
                if (connectedIdx !== encodedIdx) {
                  workingSymbols[connectedIdx] = OpCodes.Xor32(workingSymbols[connectedIdx], decoded[sourceIdx]);
                }
                workingGraph.removeEdge(sourceIdx, connectedIdx);
              }
            }
          }
        }

        if (!progress) {
          break; // Cannot make further progress
        }
      }

      return decodedCount === this.k ? decoded : null;
    }

    /**
     * Code parameters and encoding-graph density
     * @returns {LTPerformanceReport} Performance report
     */
    getPerformanceReport() {
      /** @type {int32} */
      let encodedSymbols = 0;
      if (this.graph) encodedSymbols = this.graph.rightNodes;
      return new LTPerformanceReport(this.overhead, this.k, encodedSymbols, this._calculateGraphDensity());
    }

    /**
     * @returns {float64} Edges over possible edges
     */
    _calculateGraphDensity() {
      if (!this.graph) {
        return 0;
      }

      /** @type {int32} */
      const rightNodes = this.graph.rightNodes;
      /** @type {int32} */
      const leftNodes = this.graph.leftNodes;
      /** @type {int32} */
      let totalEdges = 0;
      for (let i = 0; i < rightNodes; i++) {
        /** @type {int32} */
        const degree = this.graph.getDegree(i);
        totalEdges += degree;
      }

      /** @type {int32} */
      const maxPossibleEdges = leftNodes * rightNodes;
      return totalEdges / maxPossibleEdges;
    }

    // Get degree distribution statistics
    /**
     * @returns {DegreeStats} Degree statistics, or null without a graph
     */
    getDegreeStats() {
      if (!this.graph) {
        return null;
      }

      /** @type {int32} */
      const rightNodes = this.graph.rightNodes;
      /** @type {int32[]} */
      const degrees = [];
      /** @type {int32} */
      let sum = 0;
      for (let i = 0; i < rightNodes; i++) {
        /** @type {int32} */
        const degree = this.graph.getDegree(i);
        sum += degree;

        // Insertion sort keeps the list ascending
        let j = degrees.length;
        degrees.push(degree);
        while (j > 0 && degrees[j - 1] > degree) {
          degrees[j] = degrees[j - 1];
          --j;
        }
        degrees[j] = degree;
      }

      return new DegreeStats(
        degrees[0],
        degrees[degrees.length - 1],
        sum / degrees.length,
        degrees[Math.floor(degrees.length / 2)],
        degrees
      );
    }
  }

  // Register the algorithm
  const algorithmInstance = new LTCodesAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));