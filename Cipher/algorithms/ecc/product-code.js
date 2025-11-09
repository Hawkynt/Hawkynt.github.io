/*
 * Product Code (Two-Dimensional Parity) Implementation
 * Multi-dimensional error correction using row and column parity
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

  class ProductCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Product Code";
      this.description = "Two-dimensional error correction using row and column parity checks. Can detect and correct single-bit errors by identifying the intersection of failed row and column parities. Efficient for burst error detection.";
      this.inventor = "Unknown (Matrix Coding Concept)";
      this.year = 1960;
      this.category = CategoryType.ECC;
      this.subCategory = "Block Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = null;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Multidimensional Parity", "https://en.wikipedia.org/wiki/Multidimensional_parity-check_code"),
        new LinkItem("Error Correction Zoo - Tensor Product", "https://errorcorrectionzoo.org/c/tensor"),
        new LinkItem("UMass Interactive Demo", "https://gaia.cs.umass.edu/kurose_ross/interactive/2d_parity.php")
      ];

      this.references = [
        new LinkItem("Two-Dimensional Parity Paper", "https://dl.acm.org/doi/pdf/10.1145/321062.321067"),
        new LinkItem("2D ECC Survey", "https://www.sciencedirect.com/science/article/abs/pii/S002627142200350X"),
        new LinkItem("Error Detection Tutorial", "https://wiki.eecs.yorku.ca/course_archive/2009-10/W/3213/_media/cse3213_11_errorcorrection_w2010.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Double Error Ambiguity",
          "Can detect but not locate/correct two errors. Multiple errors create ambiguous row/column intersections."
        ),
        new Vulnerability(
          "Corner Case Errors",
          "Errors in parity bits themselves require special handling and may not be correctable."
        )
      ];

      // Test vectors for 4x4 product code (16 data bits + 4 row + 4 column + 1 overall parity)
      this.tests = [
        new TestCase(
          // 4x4 data matrix (row-major order)
          [1, 0, 1, 0,
           0, 1, 0, 1,
           1, 1, 0, 0,
           0, 0, 1, 1],
          // 5x5 encoded matrix with row/column parity
          [1, 0, 1, 0, 0,  // row 0 + row parity
           0, 1, 0, 1, 0,  // row 1 + row parity
           1, 1, 0, 0, 0,  // row 2 + row parity
           0, 0, 1, 1, 0,  // row 3 + row parity
           0, 0, 0, 0, 0], // column parities + overall
          "Product code 4x4 matrix test",
          "https://gaia.cs.umass.edu/kurose_ross/interactive/2d_parity.php"
        ),
        new TestCase(
          // All zeros
          [0, 0, 0, 0,
           0, 0, 0, 0,
           0, 0, 0, 0,
           0, 0, 0, 0],
          // All zeros with parity
          [0, 0, 0, 0, 0,
           0, 0, 0, 0, 0,
           0, 0, 0, 0, 0,
           0, 0, 0, 0, 0,
           0, 0, 0, 0, 0],
          "Product code all zeros",
          "https://en.wikipedia.org/wiki/Multidimensional_parity-check_code"
        ),
        new TestCase(
          // Identity pattern
          [1, 0, 0, 0,
           0, 1, 0, 0,
           0, 0, 1, 0,
           0, 0, 0, 1],
          // Identity with parity
          [1, 0, 0, 0, 1,
           0, 1, 0, 0, 1,
           0, 0, 1, 0, 1,
           0, 0, 0, 1, 1,
           1, 1, 1, 1, 0],
          "Product code identity matrix",
          "https://en.wikipedia.org/wiki/Multidimensional_parity-check_code"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new ProductCodeInstance(this, isInverse);
    }
  }

  class ProductCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._rows = 4; // Default 4x4 matrix
      this._cols = 4;
    }

    set rows(r) {
      if (r < 2 || r > 256) {
        throw new Error('ProductCodeInstance.rows: Must be between 2 and 256');
      }
      this._rows = r;
    }

    get rows() {
      return this._rows;
    }

    set cols(c) {
      if (c < 2 || c > 256) {
        throw new Error('ProductCodeInstance.cols: Must be between 2 and 256');
      }
      this._cols = c;
    }

    get cols() {
      return this._cols;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ProductCodeInstance.Feed: Input must be bit array');
      }

      if (this.isInverse) {
        this.result = this.decode(data);
      } else {
        this.result = this.encode(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('ProductCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    DetectError(data) {
      const rows = this._rows + 1;
      const cols = this._cols + 1;

      if (!Array.isArray(data) || data.length !== rows * cols) {
        throw new Error(`ProductCodeInstance.DetectError: Input must be ${rows}x${cols} bit array`);
      }

      // Check row parities
      for (let r = 0; r < rows; ++r) {
        let parity = 0;
        for (let c = 0; c < cols; ++c) {
          parity ^= data[r * cols + c];
        }
        if (parity !== 0) return true;
      }

      // Check column parities
      for (let c = 0; c < cols; ++c) {
        let parity = 0;
        for (let r = 0; r < rows; ++r) {
          parity ^= data[r * cols + c];
        }
        if (parity !== 0) return true;
      }

      return false;
    }

    encode(data) {
      // Encode data matrix with row and column parity
      const dataRows = this._rows;
      const dataCols = this._cols;
      const encodedRows = dataRows + 1;
      const encodedCols = dataCols + 1;

      if (data.length !== dataRows * dataCols) {
        throw new Error(`Product code encode: Input must be ${dataRows}x${dataCols} = ${dataRows * dataCols} bits`);
      }

      const encoded = new Array(encodedRows * encodedCols).fill(0);

      // Copy data bits
      for (let r = 0; r < dataRows; ++r) {
        for (let c = 0; c < dataCols; ++c) {
          encoded[r * encodedCols + c] = data[r * dataCols + c];
        }
      }

      // Calculate row parities (last column)
      for (let r = 0; r < dataRows; ++r) {
        let parity = 0;
        for (let c = 0; c < dataCols; ++c) {
          parity ^= encoded[r * encodedCols + c];
        }
        encoded[r * encodedCols + dataCols] = parity;
      }

      // Calculate column parities (last row)
      for (let c = 0; c < dataCols; ++c) {
        let parity = 0;
        for (let r = 0; r < dataRows; ++r) {
          parity ^= encoded[r * encodedCols + c];
        }
        encoded[dataRows * encodedCols + c] = parity;
      }

      // Calculate overall parity (bottom-right corner)
      let overallParity = 0;
      for (let r = 0; r < dataRows; ++r) {
        overallParity ^= encoded[r * encodedCols + dataCols];
      }
      encoded[dataRows * encodedCols + dataCols] = overallParity;

      return encoded;
    }

    decode(data) {
      const encodedRows = this._rows + 1;
      const encodedCols = this._cols + 1;
      const dataRows = this._rows;
      const dataCols = this._cols;

      if (data.length !== encodedRows * encodedCols) {
        throw new Error(`Product code decode: Input must be ${encodedRows}x${encodedCols} = ${encodedRows * encodedCols} bits`);
      }

      const received = [...data];

      // Find row and column with parity errors
      let errorRow = -1;
      let errorCol = -1;

      // Check row parities
      for (let r = 0; r < encodedRows; ++r) {
        let parity = 0;
        for (let c = 0; c < encodedCols; ++c) {
          parity ^= received[r * encodedCols + c];
        }
        if (parity !== 0) {
          if (errorRow === -1) {
            errorRow = r;
          } else {
            // Multiple row errors - cannot correct
            console.warn('Product code: Multiple row parity errors detected');
            errorRow = -2;
            break;
          }
        }
      }

      // Check column parities
      for (let c = 0; c < encodedCols; ++c) {
        let parity = 0;
        for (let r = 0; r < encodedRows; ++r) {
          parity ^= received[r * encodedCols + c];
        }
        if (parity !== 0) {
          if (errorCol === -1) {
            errorCol = c;
          } else {
            // Multiple column errors - cannot correct
            console.warn('Product code: Multiple column parity errors detected');
            errorCol = -2;
            break;
          }
        }
      }

      // Correct single bit error if found
      if (errorRow >= 0 && errorCol >= 0 && errorRow < encodedRows && errorCol < encodedCols) {
        console.log(`Product code: Error at row ${errorRow}, col ${errorCol} - correcting`);
        received[errorRow * encodedCols + errorCol] ^= 1;
      } else if (errorRow >= 0 || errorCol >= 0) {
        if (errorRow === -2 || errorCol === -2) {
          console.warn('Product code: Multiple errors detected - cannot correct');
        } else {
          console.warn('Product code: Parity error detected but location ambiguous');
        }
      }

      // Extract original data (excluding parity bits)
      const decoded = new Array(dataRows * dataCols);
      for (let r = 0; r < dataRows; ++r) {
        for (let c = 0; c < dataCols; ++c) {
          decoded[r * dataCols + c] = received[r * encodedCols + c];
        }
      }

      return decoded;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ProductCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ProductCodeAlgorithm, ProductCodeInstance };
}));
