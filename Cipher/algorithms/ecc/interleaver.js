/*
 * Interleaver Implementation
 * Rearranges data to distribute burst errors across multiple codewords
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

  class InterleaverAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Interleaver";
      this.description = "Block interleaver that rearranges data to distribute burst errors across multiple codewords. Uses matrix transposition to convert burst errors into random errors. Note: Interleaving is a technique used WITH error correction codes, not a standalone correction algorithm.";
      this.inventor = "Unknown (Data Reorganization Concept)";
      this.year = 1960;
      this.category = CategoryType.ECC;
      this.subCategory = "Interleaving";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Interleaving", "https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving"),
        new LinkItem("Error Control Coding", "https://www.sciencedirect.com/topics/engineering/interleaver"),
        new LinkItem("Digital Communications Tutorial", "https://www.tutorialspoint.com/digital_communication/digital_communication_interleaving.htm")
      ];

      this.references = [
        new LinkItem("Convolutional Interleaving", "https://en.wikipedia.org/wiki/Convolutional_interleaver"),
        new LinkItem("Turbo Code Interleaving", "https://ieeexplore.ieee.org/document/539815")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "No Error Correction",
          "Interleaving only redistributes errors. Must be combined with error correction codes for actual correction capability."
        ),
        new Vulnerability(
          "Latency Introduction",
          "Block interleaving introduces delay as entire blocks must be buffered before transmission/processing."
        )
      ];

      // Test vectors for block interleaving
      this.tests = [
        {
          text: "4x4 block interleaving test",
          uri: "https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving",
          rows: 4,
          cols: 4,
          input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          expected: [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15, 4, 8, 12, 16]
        },
        {
          text: "Sequential interleaving pattern",
          uri: "https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving",
          rows: 4,
          cols: 4,
          input: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
          expected: [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15]
        },
        {
          text: "3x3 interleaving test",
          uri: "https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving",
          rows: 3,
          cols: 3,
          input: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          expected: [1, 4, 7, 2, 5, 8, 3, 6, 9]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new InterleaverInstance(this, isInverse);
    }
  }

  class InterleaverInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._rows = 4; // Default 4x4 interleaving
      this._cols = 4;
      this._interleaveType = 'block'; // 'block' or 'convolutional' (future)
    }

    set rows(r) {
      if (r < 1 || r > 256) {
        throw new Error('InterleaverInstance.rows: Must be between 1 and 256');
      }
      this._rows = r;
    }

    get rows() {
      return this._rows;
    }

    set cols(c) {
      if (c < 1 || c > 256) {
        throw new Error('InterleaverInstance.cols: Must be between 1 and 256');
      }
      this._cols = c;
    }

    get cols() {
      return this._cols;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('InterleaverInstance.Feed: Input must be array');
      }

      if (this.isInverse) {
        this.result = this.deinterleave(data);
      } else {
        this.result = this.interleave(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('InterleaverInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    interleave(data) {
      // Block interleaving: write row-major, read column-major
      const blockSize = this._rows * this._cols;

      if (data.length % blockSize !== 0) {
        throw new Error(`Interleaver: Input length must be multiple of ${blockSize} (rows=${this._rows} × cols=${this._cols})`);
      }

      const result = new Array(data.length);
      const numBlocks = data.length / blockSize;

      for (let block = 0; block < numBlocks; ++block) {
        const offset = block * blockSize;

        // Write row-major, read column-major (transpose)
        for (let r = 0; r < this._rows; ++r) {
          for (let c = 0; c < this._cols; ++c) {
            const inputIdx = offset + r * this._cols + c;
            const outputIdx = offset + c * this._rows + r;
            result[outputIdx] = data[inputIdx];
          }
        }
      }

      return result;
    }

    deinterleave(data) {
      // Reverse of interleaving: write column-major, read row-major
      const blockSize = this._rows * this._cols;

      if (data.length % blockSize !== 0) {
        throw new Error(`Deinterleaver: Input length must be multiple of ${blockSize} (rows=${this._rows} × cols=${this._cols})`);
      }

      const result = new Array(data.length);
      const numBlocks = data.length / blockSize;

      for (let block = 0; block < numBlocks; ++block) {
        const offset = block * blockSize;

        // Write column-major, read row-major (transpose back)
        for (let c = 0; c < this._cols; ++c) {
          for (let r = 0; r < this._rows; ++r) {
            const inputIdx = offset + c * this._rows + r;
            const outputIdx = offset + r * this._cols + c;
            result[outputIdx] = data[inputIdx];
          }
        }
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new InterleaverAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { InterleaverAlgorithm, InterleaverInstance };
}));
