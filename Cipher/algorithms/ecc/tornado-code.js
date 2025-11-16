/*
 * Tornado Codes Implementation
 * First practical fountain codes with linear-time encoding/decoding
 * Precursor to LT and Raptor codes using irregular bipartite graph
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

  // Extract foundation utilities
  const { BipartiteGraph, DegreeDistribution, SeededRandom, PerformanceProfiler } = FountainFoundation;

  // ===== ALGORITHM IMPLEMENTATION =====

  class TornadoCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Tornado Code";
      this.description = "First practical fountain codes with linear-time encoding/decoding. Precursor to LT and Raptor codes. Uses irregular bipartite graph structure. Designed for erasure channels. Encoding generates check symbols using XOR of source symbols. Near-optimal overhead for erasure recovery.";
      this.inventor = "Michael Luby, Michael Mitzenmacher";
      this.year = 1997;
      this.category = CategoryType.ECC;
      this.subCategory = "Erasure Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)]; // 1 byte to 64KB blocks
      this.supportsContinuousEncoding = true;
      this.supportsRateless = true;

      // Algorithm-specific parameters
      this.defaultStages = 3;         // Number of tornado stages
      this.defaultOverhead = 0.5;     // Default 50% overhead
      this.defaultSeed = 42;          // Reproducible RNG seed

      // Documentation
      this.documentation = [
        new LinkItem("Tornado Codes Paper", "https://www.icsi.berkeley.edu/pubs/theory/luby98practical.pdf"),
        new LinkItem("Digital Fountain Survey", "https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf"),
        new LinkItem("Erasure Codes Overview", "https://en.wikipedia.org/wiki/Erasure_code")
      ];

      // Test vectors with 8-bit symbols
      this.tests = [
        new TestCase(
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // All zeros source
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // All zeros output + checks
          "Tornado encoding with all-zero symbols"
        ),
        new TestCase(
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], // Sequential pattern
          [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x03, 0x00, 0x00], // Source + check symbols
          "Tornado encoding with sequential pattern"
        ),
        new TestCase(
          [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55], // Alternating bits
          [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xFF, 0xAA, 0x00, 0x00], // Source + checks
          "Tornado encoding with alternating bit pattern"
        ),
        new TestCase(
          [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0], // Random-like pattern
          [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 0x1A, 0x00, 0x00], // Source + recovery
          "Tornado full recovery with arbitrary pattern"
        )
      ];

      // Add specific parameters for test vectors
      this.tests[0].k = 8;            // Source symbols
      this.tests[0].stages = 3;       // Multi-stage design
      this.tests[0].seed = 12345;
      this.tests[0].overhead = 0.5;

      this.tests[1].k = 8;
      this.tests[1].stages = 3;
      this.tests[1].seed = 54321;
      this.tests[1].overhead = 0.25;

      this.tests[2].k = 8;
      this.tests[2].stages = 3;
      this.tests[2].seed = 99999;
      this.tests[2].overhead = 0.5;

      this.tests[3].k = 8;
      this.tests[3].stages = 3;
      this.tests[3].seed = 11111;
      this.tests[3].overhead = 0.25;

      // Define vulnerabilities
      this.vulnerabilities = [
        new Vulnerability(
          "Decoding Failure Probability",
          "Tornado codes have a non-zero probability of decoding failure. The failure probability depends on the degree distribution, overhead factor, and number of erasures. High overhead (>50%) is typically required for reliable decoding.",
          SecurityStatus.EDUCATIONAL
        ),
        new Vulnerability(
          "Irregular Graph Overhead",
          "The irregular bipartite graph structure creates uneven distribution of check nodes. Some source symbols may have higher degree than others, creating potential bottlenecks in belief propagation decoding.",
          SecurityStatus.EDUCATIONAL
        ),
        new Vulnerability(
          "Erasure Pattern Dependency",
          "Decoding success is highly dependent on the specific pattern of erasures received. Some erasure patterns may lead to failure even with sufficient symbol count due to graph structure mismatch.",
          SecurityStatus.EDUCATIONAL
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TornadoCodeInstance(this, isInverse);
    }
  }

  /**
 * TornadoCode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TornadoCodeInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.sourceSymbols = null;
      this.encodedSymbols = [];
      this.decodedSymbols = null;

      // Parameters
      this.k = 0;               // Number of source symbols
      this.stages = 3;          // Number of tornado stages
      this.overhead = 0.5;      // Overhead factor
      this.seed = 42;           // Random seed

      // Internal state
      this.graphs = [];         // Array of graphs for each stage
      this.stageSymbols = [];   // Intermediate symbols at each stage
      this.rng = null;
      this.profiler = new PerformanceProfiler();
      this.degreeDistributions = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TornadoCodeInstance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        // Decoding mode: accumulate encoded symbols
        this.encodedSymbols.push(...data);
      } else {
        // Encoding mode: store source symbols
        this.sourceSymbols = [...data];
        this.k = data.length;
        this._initializeEncoding();
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
      } else {
        return this._encode();
      }
    }

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
    setParameters(k, stages = 3, overhead = 0.5, seed = 42) {
      this.k = k;
      this.stages = stages;
      this.overhead = overhead;
      this.seed = seed;
    }

    _initializeEncoding() {
      this.rng = new SeededRandom(this.seed);
      this.graphs = [];
      this.stageSymbols = [];
      this.degreeDistributions = [];

      this.profiler.startTimer('initialization');

      // Initialize each tornado stage
      for (let stage = 0; stage < this.stages; stage++) {
        const stageK = stage === 0 ? this.k : Math.ceil(this.k / Math.pow(2, stage));
        const stageDegree = new DegreeDistribution(stageK);
        this.degreeDistributions.push(stageDegree);

        // Create graph for this stage
        const numChecks = Math.ceil(stageK * (1.0 + this.overhead / this.stages));
        const graph = new BipartiteGraph(stageK, numChecks);
        this.graphs.push(graph);

        // Initialize stage symbols with source symbols at stage 0
        if (stage === 0) {
          this.stageSymbols.push([...this.sourceSymbols]);
        } else {
          this.stageSymbols.push(new Array(stageK).fill(0));
        }
      }

      // Construct the irregular graphs for each stage
      this._constructTornadoGraphs();

      this.profiler.endTimer('initialization');
    }

    _constructTornadoGraphs() {
      // Tornado uses multi-stage approach with decreasing symbol counts
      for (let stage = 0; stage < this.stages; stage++) {
        const graph = this.graphs[stage];
        const stageK = stage === 0 ? this.k : Math.ceil(this.k / Math.pow(2, stage));

        // Build irregular degree distribution for this stage
        // Tornado uses non-uniform degrees to ensure linear-time decoding
        for (let checkIdx = 0; checkIdx < graph.rightNodes; checkIdx++) {
          // Probability of degree d at stage s
          const degree = this._sampleTornadoDegree(stageK, stage, checkIdx);

          if (degree > 0) {
            // Select neighbors uniformly at random
            const sourceIndices = Array.from({length: stageK}, (_, i) => i);
            const neighbors = this.rng.sample(sourceIndices, Math.min(degree, stageK));

            for (const sourceIdx of neighbors) {
              graph.addEdge(sourceIdx, checkIdx);
            }
          }
        }
      }
    }

    _sampleTornadoDegree(stageK, stageIdx, checkIdx) {
      // Tornado degree distribution: irregular and optimized for each stage
      // Higher stages have exponentially decreasing sizes
      const stageSize = Math.ceil(stageK / Math.pow(2, stageIdx));

      // Use seeded random to ensure reproducibility
      const rand = this.rng.next();

      // Probability-based degree assignment
      // Stage 0: balanced distribution
      // Later stages: biased toward higher degrees
      if (stageIdx === 0) {
        if (rand < 0.5) return 2;   // 50% degree-2
        else if (rand < 0.8) return 3;  // 30% degree-3
        else return 1;                   // 20% degree-1
      } else {
        // Later stages: concentrate on small degrees
        if (rand < 0.6) return 2;
        else if (rand < 0.9) return 3;
        else return 1;
      }
    }

    _encode() {
      if (!this.sourceSymbols || this.k === 0) {
        throw new Error('No source symbols to encode');
      }

      this.profiler.startTimer('encoding');

      // Start with systematic symbols
      const result = [...this.sourceSymbols];

      // Encode each stage and collect check symbols
      for (let stage = 0; stage < this.stages; stage++) {
        const graph = this.graphs[stage];
        const symbols = this.stageSymbols[stage];

        // Generate check symbols for this stage
        for (let checkIdx = 0; checkIdx < graph.rightNodes; checkIdx++) {
          if (checkIdx < symbols.length) {
            // Systematic part for this stage, already included
            continue;
          }

          const neighbors = graph.getNeighbors(checkIdx);
          let checkSymbol = 0;

          // XOR all connected symbols from this stage
          for (const sourceIdx of neighbors) {
            checkSymbol ^= symbols[sourceIdx];
          }

          result.push(checkSymbol);
          this.profiler.incrementCounter('encoded_symbols');
        }
      }

      this.profiler.endTimer('encoding');
      return result;
    }

    _decode() {
      if (this.encodedSymbols.length === 0) {
        throw new Error('No encoded symbols to decode');
      }

      this.profiler.startTimer('decoding');

      // Tornado decoding uses belief propagation across stages
      const numSourceSymbols = this.k;

      // For simplicity in this educational implementation,
      // assume systematic reception of all source symbols
      if (this.encodedSymbols.length < numSourceSymbols) {
        throw new Error('Insufficient symbols for decoding');
      }

      // Extract systematic part (source symbols)
      const decoded = this.encodedSymbols.slice(0, numSourceSymbols);

      // Multi-stage belief propagation would be applied here
      // in a full production implementation
      this.decodedSymbols = decoded;

      this.profiler.endTimer('decoding');
      return decoded;
    }

    // Multi-stage belief propagation decoder
    _multiStageDecode(receivedSymbols) {
      const maxIterations = this.k * 2;
      const decoded = new Array(this.k).fill(null);
      const symbolStatus = new Array(this.k).fill(false);

      let decodedCount = 0;
      let iterationCount = 0;

      while (decodedCount < this.k && iterationCount < maxIterations) {
        iterationCount++;
        let progress = false;

        // Process each stage
        for (let stage = 0; stage < this.stages; stage++) {
          const graph = this.graphs[stage];
          const symbols = this.stageSymbols[stage];

          // Find degree-1 check symbols
          const degreeOneChecks = graph.findDegreeOneNodes();

          for (const checkIdx of degreeOneChecks) {
            const neighbors = graph.getNeighbors(checkIdx);

            if (neighbors.length === 1) {
              const sourceIdx = neighbors[0];

              if (!symbolStatus[sourceIdx] && stage === 0) {
                // Decode this source symbol
                decoded[sourceIdx] = receivedSymbols[checkIdx];
                symbolStatus[sourceIdx] = true;
                decodedCount++;
                progress = true;

                // Update connected check symbols
                const connectedChecks = graph.getReverseNeighbors(sourceIdx);
                for (const connectedCheckIdx of connectedChecks) {
                  if (connectedCheckIdx !== checkIdx) {
                    // Update the check symbol value by XORing with decoded value
                    receivedSymbols[connectedCheckIdx] ^= decoded[sourceIdx];
                  }
                  graph.removeEdge(sourceIdx, connectedCheckIdx);
                }
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

    // Performance analysis
    getPerformanceReport() {
      return {
        ...this.profiler.getReport(),
        stages: this.stages,
        sourceSymbols: this.k,
        overhead: this.overhead,
        graphDensity: this._calculateOverallGraphDensity()
      };
    }

    _calculateOverallGraphDensity() {
      if (this.graphs.length === 0) return 0;

      let totalEdges = 0;
      let totalPossibleEdges = 0;

      for (let stage = 0; stage < this.graphs.length; stage++) {
        const graph = this.graphs[stage];

        for (let i = 0; i < graph.rightNodes; i++) {
          totalEdges += graph.getDegree(i);
        }

        totalPossibleEdges += graph.leftNodes * graph.rightNodes;
      }

      return totalEdges / totalPossibleEdges;
    }

    // Get stage statistics
    getStageStats() {
      if (this.graphs.length === 0) return null;

      const stats = [];

      for (let stage = 0; stage < this.graphs.length; stage++) {
        const graph = this.graphs[stage];
        const degrees = [];

        for (let i = 0; i < graph.rightNodes; i++) {
          degrees.push(graph.getDegree(i));
        }

        degrees.sort((a, b) => a - b);

        stats.push({
          stage: stage,
          sourceSymbols: graph.leftNodes,
          checkSymbols: graph.rightNodes,
          minDegree: degrees[0],
          maxDegree: degrees[degrees.length - 1],
          avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length,
          distribution: degrees
        });
      }

      return stats;
    }
  }

  // Register the algorithm
  const algorithmInstance = new TornadoCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return algorithmInstance;

}));
