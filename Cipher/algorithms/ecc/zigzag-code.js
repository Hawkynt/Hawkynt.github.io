/*
 * Zigzag Code Implementation
 * Diagonal interleaving for burst error correction
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

  class ZigzagCodeAlgorithm extends ErrorCorrectionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zigzag Code";
      this.description = "Diagonal interleaving technique for burst error correction. Data written row-wise into matrix, transmitted in zigzag diagonal pattern. Spreads burst errors across multiple codewords when combined with inner error correction code. Simpler than Fire codes for moderate burst lengths.";
      this.inventor = "Anastasios N. Venetsanopoulos, Richard Friedlander";
      this.year = 1975;
      this.category = CategoryType.ECC;
      this.subCategory = "Burst Error Code";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CA;

      // Documentation and references
      this.documentation = [
        new LinkItem("Burst Error Correction - Wikipedia", "https://en.wikipedia.org/wiki/Burst_error-correcting_code"),
        new LinkItem("Interleaving Techniques", "https://web.njit.edu/~anl/papers/04CASMag.pdf"),
        new LinkItem("Error Control Coding", "https://www.sciencedirect.com/topics/engineering/interleaver")
      ];

      this.references = [
        new LinkItem("IEEE Xplore - Interleaving for Burst Errors", "https://ieeexplore.ieee.org/document/1286985/"),
        new LinkItem("Burst Error Correcting Codes", "https://wiki.cse.buffalo.edu/cse545/content/burst-error-correcting-codes"),
        new LinkItem("Google Patents - Interleaver for Burst Errors", "https://patents.google.com/patent/US6662332B1/en")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Requires Inner Code",
          "Zigzag interleaving alone does not correct errors - must be combined with error correction code like Hamming or BCH."
        ),
        new Vulnerability(
          "Latency Introduction",
          "Diagonal reading introduces delay as entire matrix block must be buffered before transmission."
        ),
        new Vulnerability(
          "Limited to Block Size",
          "Burst error protection limited to matrix dimensions. Bursts longer than one row may affect multiple symbols after deinterleaving."
        )
      ];

      // Test vectors for zigzag diagonal interleaving
      // Based on standard interleaving theory - educational patterns
      this.tests = [
        {
          text: "4x4 zigzag diagonal pattern - ascending diagonals",
          uri: "https://en.wikipedia.org/wiki/Burst_error-correcting_code",
          rows: 4,
          cols: 4,
          direction: 'ascending',
          input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          // Write row-wise: [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]]
          // Read diagonal ascending: 1, 5,2, 9,6,3, 13,10,7,4, 14,11,8, 15,12, 16
          expected: [1, 5, 2, 9, 6, 3, 13, 10, 7, 4, 14, 11, 8, 15, 12, 16]
        },
        {
          text: "4x4 zigzag diagonal pattern - descending diagonals",
          uri: "https://en.wikipedia.org/wiki/Burst_error-correcting_code",
          rows: 4,
          cols: 4,
          direction: 'descending',
          input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          // Write row-wise: [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]]
          // Read diagonal descending: 1, 2,5, 3,6,9, 4,7,10,13, 8,11,14, 12,15, 16
          expected: [1, 2, 5, 3, 6, 9, 4, 7, 10, 13, 8, 11, 14, 12, 15, 16]
        },
        {
          text: "3x3 zigzag pattern - ascending",
          uri: "https://web.njit.edu/~anl/papers/04CASMag.pdf",
          rows: 3,
          cols: 3,
          direction: 'ascending',
          input: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          // Write: [[1,2,3],[4,5,6],[7,8,9]]
          // Read ascending diagonal: 1, 4,2, 7,5,3, 8,6, 9
          expected: [1, 4, 2, 7, 5, 3, 8, 6, 9]
        },
        {
          text: "Sequential bytes - 4x4 ascending pattern",
          uri: "https://ieeexplore.ieee.org/document/1286985/",
          rows: 4,
          cols: 4,
          direction: 'ascending',
          input: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
          expected: [0, 4, 1, 8, 5, 2, 12, 9, 6, 3, 13, 10, 7, 14, 11, 15]
        },
        {
          text: "2x8 rectangular zigzag - ascending",
          uri: "https://wiki.cse.buffalo.edu/cse545/content/burst-error-correcting-codes",
          rows: 2,
          cols: 8,
          direction: 'ascending',
          input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
          // Write: [[1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16]]
          // Read ascending: 1, 9,2, 10,3, 11,4, 12,5, 13,6, 14,7, 15,8, 16
          expected: [1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15, 8, 16]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ZigzagCodeInstance(this, isInverse);
    }
  }

  class ZigzagCodeInstance extends IErrorCorrectionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.result = null;
      this._rows = 4; // Default 4x4 matrix
      this._cols = 4;
      this._direction = 'ascending'; // 'ascending' or 'descending' diagonal pattern
    }

    set rows(r) {
      if (r < 1 || r > 256) {
        throw new Error('ZigzagCodeInstance.rows: Must be between 1 and 256');
      }
      this._rows = r;
    }

    get rows() {
      return this._rows;
    }

    set cols(c) {
      if (c < 1 || c > 256) {
        throw new Error('ZigzagCodeInstance.cols: Must be between 1 and 256');
      }
      this._cols = c;
    }

    get cols() {
      return this._cols;
    }

    set direction(d) {
      if (d !== 'ascending' && d !== 'descending') {
        throw new Error("ZigzagCodeInstance.direction: Must be 'ascending' or 'descending'");
      }
      this._direction = d;
    }

    get direction() {
      return this._direction;
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('ZigzagCodeInstance.Feed: Input must be array');
      }

      if (this.isInverse) {
        this.result = this.dezigzag(data);
      } else {
        this.result = this.zigzag(data);
      }
    }

    Result() {
      if (this.result === null) {
        throw new Error('ZigzagCodeInstance.Result: Call Feed() first to process data');
      }
      return this.result;
    }

    zigzag(data) {
      // Zigzag diagonal interleaving: write row-major, read diagonal
      const blockSize = this._rows * this._cols;

      if (data.length % blockSize !== 0) {
        throw new Error(`Zigzag Code: Input length must be multiple of ${blockSize} (rows=${this._rows} × cols=${this._cols})`);
      }

      const result = [];
      const numBlocks = data.length / blockSize;

      for (let block = 0; block < numBlocks; ++block) {
        const offset = block * blockSize;

        // Create matrix from input data (row-major order)
        const matrix = [];
        for (let r = 0; r < this._rows; ++r) {
          matrix[r] = [];
          for (let c = 0; c < this._cols; ++c) {
            matrix[r][c] = data[offset + r * this._cols + c];
          }
        }

        // Read in diagonal zigzag pattern
        if (this._direction === 'ascending') {
          result.push(...this._readAscendingDiagonals(matrix));
        } else {
          result.push(...this._readDescendingDiagonals(matrix));
        }
      }

      return result;
    }

    dezigzag(data) {
      // Reverse zigzag: write diagonal, read row-major
      const blockSize = this._rows * this._cols;

      if (data.length % blockSize !== 0) {
        throw new Error(`Zigzag Decode: Input length must be multiple of ${blockSize} (rows=${this._rows} × cols=${this._cols})`);
      }

      const result = [];
      const numBlocks = data.length / blockSize;

      for (let block = 0; block < numBlocks; ++block) {
        const offset = block * blockSize;
        const blockData = data.slice(offset, offset + blockSize);

        // Create empty matrix
        const matrix = [];
        for (let r = 0; r < this._rows; ++r) {
          matrix[r] = new Array(this._cols);
        }

        // Write in diagonal zigzag pattern
        if (this._direction === 'ascending') {
          this._writeAscendingDiagonals(matrix, blockData);
        } else {
          this._writeDescendingDiagonals(matrix, blockData);
        }

        // Read back in row-major order
        for (let r = 0; r < this._rows; ++r) {
          for (let c = 0; c < this._cols; ++c) {
            result.push(matrix[r][c]);
          }
        }
      }

      return result;
    }

    _readAscendingDiagonals(matrix) {
      // Read diagonals from bottom-left to top-right (ascending)
      // Pattern: (0,0), (1,0)-(0,1), (2,0)-(1,1)-(0,2), ...
      const result = [];
      const rows = this._rows;
      const cols = this._cols;

      // Start from leftmost column, go down
      for (let startRow = 0; startRow < rows; ++startRow) {
        let r = startRow;
        let c = 0;
        while (r >= 0 && c < cols) {
          result.push(matrix[r][c]);
          --r;
          ++c;
        }
      }

      // Continue from bottom row, go right
      for (let startCol = 1; startCol < cols; ++startCol) {
        let r = rows - 1;
        let c = startCol;
        while (r >= 0 && c < cols) {
          result.push(matrix[r][c]);
          --r;
          ++c;
        }
      }

      return result;
    }

    _readDescendingDiagonals(matrix) {
      // Read diagonals from top-left to bottom-right (descending)
      // Pattern: (0,0), (0,1)-(1,0), (0,2)-(1,1)-(2,0), ...
      const result = [];
      const rows = this._rows;
      const cols = this._cols;

      // Start from top row, go right
      for (let startCol = 0; startCol < cols; ++startCol) {
        let r = 0;
        let c = startCol;
        while (r < rows && c >= 0) {
          result.push(matrix[r][c]);
          ++r;
          --c;
        }
      }

      // Continue from leftmost column (skipping 0,0), go down
      for (let startRow = 1; startRow < rows; ++startRow) {
        let r = startRow;
        let c = cols - 1;
        while (r < rows && c >= 0) {
          result.push(matrix[r][c]);
          ++r;
          --c;
        }
      }

      return result;
    }

    _writeAscendingDiagonals(matrix, data) {
      // Write data into matrix using ascending diagonal pattern
      const rows = this._rows;
      const cols = this._cols;
      let dataIdx = 0;

      // Start from leftmost column, go down
      for (let startRow = 0; startRow < rows; ++startRow) {
        let r = startRow;
        let c = 0;
        while (r >= 0 && c < cols) {
          matrix[r][c] = data[dataIdx++];
          --r;
          ++c;
        }
      }

      // Continue from bottom row, go right
      for (let startCol = 1; startCol < cols; ++startCol) {
        let r = rows - 1;
        let c = startCol;
        while (r >= 0 && c < cols) {
          matrix[r][c] = data[dataIdx++];
          --r;
          ++c;
        }
      }
    }

    _writeDescendingDiagonals(matrix, data) {
      // Write data into matrix using descending diagonal pattern
      const rows = this._rows;
      const cols = this._cols;
      let dataIdx = 0;

      // Start from top row, go right
      for (let startCol = 0; startCol < cols; ++startCol) {
        let r = 0;
        let c = startCol;
        while (r < rows && c >= 0) {
          matrix[r][c] = data[dataIdx++];
          ++r;
          --c;
        }
      }

      // Continue from leftmost column (skipping 0,0), go down
      for (let startRow = 1; startRow < rows; ++startRow) {
        let r = startRow;
        let c = cols - 1;
        while (r < rows && c >= 0) {
          matrix[r][c] = data[dataIdx++];
          ++r;
          --c;
        }
      }
    }

    DetectError(data) {
      // Zigzag interleaving doesn't detect errors by itself
      // It only redistributes them for use with inner error correction code
      // Return false (no error detection capability)
      return false;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

  const algorithmInstance = new ZigzagCodeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZigzagCodeAlgorithm, ZigzagCodeInstance };
}));
