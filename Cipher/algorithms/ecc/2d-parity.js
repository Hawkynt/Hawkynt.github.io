/*
 * 2D Parity Code (Product Code with Single Parity Check)
 * Arranges data in rectangular grid with row and column parity
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

  class TwoDParityAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "2D Parity Code";
      this.description = "Two-dimensional parity check code arranging data in rectangular grid with row and column parity bits. Can correct single-bit errors and detect two-bit errors when they occur in different rows and columns. Simple yet effective for burst error detection in memory systems.";
      this.inventor = "Unknown (classical technique)";
      this.year = 1950;
      this.category = CategoryType.ECC;
      this.subCategory = "Product Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Parity Bit", "https://en.wikipedia.org/wiki/Parity_bit"),
        new LinkItem("2D Parity Tutorial", "https://www.electronics-tutorials.ws/combination/comb_9.html"),
        new LinkItem("Error Detection Codes", "https://www.cs.cornell.edu/courses/cs6114/2018sp/Handouts/Lec2.pdf")
      ];

      this.references = [
        new LinkItem("Product Codes", "https://en.wikipedia.org/wiki/Product_code"),
        new LinkItem("Memory Error Correction", "https://ieeexplore.ieee.org/document/1702292"),
        new LinkItem("2D Parity in RAID", "https://www.usenix.org/legacy/events/fast09/tech/full_papers/plank/plank_html/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited Error Correction",
          "Can only correct single-bit errors. Multiple errors in same row/column cannot be corrected."
        ),
        new Vulnerability(
          "Undetectable Error Patterns",
          "Cannot detect errors in rectangular patterns (2x2 grid of errors)."
        )
      ];

      // Test vectors for 2D Parity (3x3 data = 4x4 with parity)
      this.tests = [
        {
          text: "2D Parity 3x3 all zeros",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          rows: 3,
          cols: 3,
          input: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "2D Parity 3x3 pattern 1",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          rows: 3,
          cols: 3,
          input: [1, 0, 1, 0, 1, 0, 1, 0, 1],
          expected: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1]
        },
        {
          text: "2D Parity 3x3 pattern 2",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          rows: 3,
          cols: 3,
          input: [1, 1, 1, 0, 0, 0, 1, 1, 1],
          expected: [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]
        },
        {
          text: "2D Parity 2x2 simple",
          uri: "https://en.wikipedia.org/wiki/Parity_bit",
          rows: 2,
          cols: 2,
          input: [1, 0, 0, 1],
          expected: [1, 0, 1, 0, 1, 1, 1, 1, 0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TwoDParityInstance(this, isInverse);
    }
  }

  /**
 * TwoDParity cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TwoDParityInstance extends IErrorCorrectionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._rows = 3; // Default 3x3 grid
      this._cols = 3;
    }

    set rows(value) {
      if (value < 1 || value > 16) {
        throw new Error('TwoDParityInstance.rows: Must be between 1 and 16');
      }
      this._rows = value;
    }

    get rows() {
      return this._rows;
    }

    set cols(value) {
      if (value < 1 || value > 16) {
        throw new Error('TwoDParityInstance.cols: Must be between 1 and 16');
      }
      this._cols = value;
    }

    get cols() {
      return this._cols;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('TwoDParityInstance.Feed: Input must be bit array');
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
        throw new Error('TwoDParityInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    encode(data) {
      const rows = this._rows;
      const cols = this._cols;

      if (data.length !== rows * cols) {
        throw new Error(`2D Parity encode: Input must be exactly ${rows * cols} bits for ${rows}x${cols} grid`);
      }

      // Create (rows+1) x (cols+1) output grid
      const encoded = new Array((rows + 1) * (cols + 1)).fill(0);

      // Copy data into grid
      for (let r = 0; r < rows; ++r) {
        for (let c = 0; c < cols; ++c) {
          encoded[r * (cols + 1) + c] = data[r * cols + c];
        }
      }

      // Calculate row parity
      for (let r = 0; r < rows; ++r) {
        let parity = 0;
        for (let c = 0; c < cols; ++c) {
          parity = OpCodes.XorN(parity, encoded[r * (cols + 1) + c]);
        }
        encoded[r * (cols + 1) + cols] = parity;
      }

      // Calculate column parity
      for (let c = 0; c < cols; ++c) {
        let parity = 0;
        for (let r = 0; r < rows; ++r) {
          parity = OpCodes.XorN(parity, encoded[r * (cols + 1) + c]);
        }
        encoded[rows * (cols + 1) + c] = parity;
      }

      // Calculate overall parity (bottom-right corner)
      let overallParity = 0;
      for (let r = 0; r < rows; ++r) {
        overallParity = OpCodes.XorN(overallParity, encoded[r * (cols + 1) + cols]);
      }
      encoded[rows * (cols + 1) + cols] = overallParity;

      return encoded;
    }

    decode(data) {
      const rows = this._rows;
      const cols = this._cols;
      const totalSize = (rows + 1) * (cols + 1);

      if (data.length !== totalSize) {
        throw new Error(`2D Parity decode: Input must be exactly ${totalSize} bits for ${rows}x${cols} grid`);
      }

      const received = [...data];

      // Check row parity syndromes
      let errorRow = -1;
      for (let r = 0; r < rows; ++r) {
        let syndrome = 0;
        for (let c = 0; c <= cols; ++c) {
          syndrome = OpCodes.XorN(syndrome, received[r * (cols + 1) + c]);
        }
        if (syndrome !== 0) {
          errorRow = r;
        }
      }

      // Check column parity syndromes
      let errorCol = -1;
      for (let c = 0; c < cols; ++c) {
        let syndrome = 0;
        for (let r = 0; r <= rows; ++r) {
          syndrome = OpCodes.XorN(syndrome, received[r * (cols + 1) + c]);
        }
        if (syndrome !== 0) {
          errorCol = c;
        }
      }

      // Single-bit error correction
      if (errorRow !== -1 && errorCol !== -1) {
        console.log(`2D Parity: Error detected at position (${errorRow}, ${errorCol}), correcting...`);
        received[errorRow * (cols + 1) + errorCol] = OpCodes.XorN(received[errorRow * (cols + 1) + errorCol], 1);
      } else if (errorRow !== -1 || errorCol !== -1) {
        console.warn('2D Parity: Parity error in row/column parity bits');
      }

      // Extract data (remove parity bits)
      const decoded = [];
      for (let r = 0; r < rows; ++r) {
        for (let c = 0; c < cols; ++c) {
          decoded.push(received[r * (cols + 1) + c]);
        }
      }

      return decoded;
    }

    DetectError(data) {
      const rows = this._rows;
      const cols = this._cols;
      const totalSize = (rows + 1) * (cols + 1);

      if (data.length !== totalSize) return true;

      // Check all row parities
      for (let r = 0; r <= rows; ++r) {
        let syndrome = 0;
        for (let c = 0; c <= cols; ++c) {
          syndrome = OpCodes.XorN(syndrome, data[r * (cols + 1) + c]);
        }
        if (syndrome !== 0) return true;
      }

      // Check all column parities
      for (let c = 0; c <= cols; ++c) {
        let syndrome = 0;
        for (let r = 0; r <= rows; ++r) {
          syndrome = OpCodes.XorN(syndrome, data[r * (cols + 1) + c]);
        }
        if (syndrome !== 0) return true;
      }

      return false;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new TwoDParityAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TwoDParityAlgorithm, TwoDParityInstance };
}));
