/*
 * Fountain Codes Foundation Library
 * Mathematical utilities and data structures for fountain codes
 * Includes: Degree distributions, Bipartite graphs, Sparse matrices
 * (c)2006-2025 Hawkynt
 *
 * This is a utility library, NOT an algorithm implementation.
 * Used by: LT Codes, Raptor Codes, RaptorQ
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.FountainFoundation = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===== MATHEMATICAL FOUNDATIONS =====

  /**
   * Enhanced Galois Field arithmetic for fountain codes
   */
  class GaloisField {
    /**
     * @param {int32} [p=2] - Prime base
     * @param {int32} [m=8] - Extension degree
     */
    constructor(p = 2, m = 8) {
      /** @type {int32} */
      this.p = p;  // Prime base (typically 2 for binary)
      /** @type {int32} */
      this.m = m;  // Extension degree
      /** @type {int32} */
      this.size = Math.pow(p, m);  // Field size
      /** @type {uint32} */
      this.primitive = this._findPrimitive();
      /** @type {uint32[]} */
      this.expTable = null;
      /** @type {int32[]} */
      this.logTable = null;
      this._buildTables();
    }

    /**
     * @returns {uint32} Primitive polynomial
     */
    _findPrimitive() {
      // For GF(2^8), use standard primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1
      // This gives us 0x11D (285 in decimal)
      if (this.p === 2 && this.m === 8) {
        return 0x11D;
      }
      throw new Error('Primitive polynomial not defined for GF(' + this.p + '^' + this.m + ')');
    }

    /**
     * @returns {void}
     */
    _buildTables() {
      /** @type {uint32[]} */
      const expTable = new Array(this.size);
      /** @type {int32[]} */
      const logTable = new Array(this.size);
      this.expTable = expTable;
      this.logTable = logTable;

      /** @type {uint32} */
      let x = 1;
      for (let i = 0; i < this.size - 1; i++) {
        this.expTable[i] = x;
        this.logTable[x] = i;
        x = this._primitiveMultiply(x, 2);
      }
    }

    // Raw primitive multiplication for table building
    /**
     * @param {uint32} a - Field element
     * @param {uint32} b - Field element
     * @returns {uint32} Product by shift-and-add
     */
    _primitiveMultiply(a, b) {
      /** @type {uint32} */
      let result = 0;
      while (b > 0) {
        if (OpCodes.And32(b, 1)) {
          result = OpCodes.ToInt(OpCodes.Xor32(result, a));
        }
        a = OpCodes.Shl32(a, 1);
        if (OpCodes.And32(a, this.size)) {
          a = OpCodes.ToInt(OpCodes.Xor32(a, this.primitive));
        }
        b = OpCodes.Shr32(b, 1);
      }
      return result;
    }

    /**
     * @param {uint32} a - Field element
     * @param {uint32} b - Field element
     * @returns {uint32} a + b
     */
    add(a, b) {
      return OpCodes.ToInt(OpCodes.Xor32(a, b));  // XOR for GF(2^m)
    }

    /**
     * @param {uint32} a - Field element
     * @param {uint32} b - Field element
     * @returns {uint32} a - b
     */
    subtract(a, b) {
      return this.add(a, b);  // Same as add in GF(2^m)
    }

    /**
     * @param {uint32} a - Field element
     * @param {uint32} b - Field element
     * @returns {uint32} a * b
     */
    multiply(a, b) {
      if (a === 0 || b === 0) return 0;
      return this.expTable[(this.logTable[a] + this.logTable[b]) % (this.size - 1)];
    }

    /**
     * @param {uint32} a - Field element
     * @param {uint32} b - Non-zero field element
     * @returns {uint32} a / b
     */
    divide(a, b) {
      if (b === 0) throw new Error('Division by zero in Galois Field');
      if (a === 0) return 0;
      return this.expTable[(this.logTable[a] - this.logTable[b] + this.size - 1) % (this.size - 1)];
    }

    /**
     * @param {uint32} a - Field element
     * @param {int32} exp - Exponent
     * @returns {uint32} a^exp
     */
    power(a, exp) {
      if (exp === 0) return 1;
      if (a === 0) return 0;
      return this.expTable[(this.logTable[a] * exp) % (this.size - 1)];
    }

    /**
     * @param {uint32} a - Non-zero field element
     * @returns {uint32} a^-1
     */
    inverse(a) {
      if (a === 0) throw new Error('Cannot invert zero in Galois Field');
      return this.expTable[(this.size - 1 - this.logTable[a])];
    }
  }

  /**
   * Sparse matrix representation for efficient operations
   */
  class SparseMatrix {
    /**
     * @param {int32} rows - Row count
     * @param {int32} cols - Column count
     */
    constructor(rows, cols) {
      /** @type {int32} */
      this.rows = rows;
      /** @type {int32} */
      this.cols = cols;
      // Non-zero entries per row in insertion order: column, value, and the
      // insertion stamp that lets clone() replay entries in their original order
      /** @type {int32[][]} */
      this.rowNonZeros = new Array(rows);
      /** @type {uint32[][]} */
      this.rowValues = new Array(rows);
      /** @type {int32[][]} */
      this.rowStamps = new Array(rows);
      for (let r = 0; r < rows; ++r) {
        /** @type {int32[]} */
        const columns = [];
        /** @type {uint32[]} */
        const values = [];
        /** @type {int32[]} */
        const stamps = [];
        this.rowNonZeros[r] = columns;
        this.rowValues[r] = values;
        this.rowStamps[r] = stamps;
      }
      // Rows of the non-zero entries per column, in insertion order
      /** @type {int32[][]} */
      this.colNonZeros = new Array(cols);
      for (let c = 0; c < cols; ++c) {
        /** @type {int32[]} */
        const entries = [];
        this.colNonZeros[c] = entries;
      }
      /** @type {int32} */
      this._nextStamp = 0;
    }

    /**
     * @param {int32} row - Row index
     * @param {int32} col - Column index
     * @returns {uint32} Entry, 0 when absent
     */
    get(row, col) {
      /** @type {int32[]} */
      const columns = this.rowNonZeros[row];
      if (columns === undefined) {
        return 0;
      }
      /** @type {int32} */
      const at = columns.indexOf(col);
      if (at < 0) {
        return 0;
      }
      /** @type {uint32} */
      const value = this.rowValues[row][at];
      return value ? value : 0;
    }

    /**
     * @param {int32} row - Row index
     * @param {int32} col - Column index
     * @param {uint32} value - Entry; 0 removes it
     * @returns {void}
     */
    set(row, col, value) {
      /** @type {int32[]} */
      const columns = this.rowNonZeros[row];
      /** @type {int32} */
      const at = columns.indexOf(col);
      /** @type {int32[]} */
      const rowsOfCol = this.colNonZeros[col];

      if (value === 0) {
        if (at >= 0) {
          columns.splice(at, 1);
          this.rowValues[row].splice(at, 1);
          this.rowStamps[row].splice(at, 1);
        }
        /** @type {int32} */
        const rowAt = rowsOfCol.indexOf(row);
        if (rowAt >= 0) {
          rowsOfCol.splice(rowAt, 1);
        }
      } else {
        if (at >= 0) {
          this.rowValues[row][at] = value;
        } else {
          columns.push(col);
          this.rowValues[row].push(value);
          this.rowStamps[row].push(this._nextStamp);
          ++this._nextStamp;
        }
        if (rowsOfCol.indexOf(row) < 0) {
          rowsOfCol.push(row);
        }
      }
    }

    /**
     * @param {int32} row - Row index
     * @returns {int32} Non-zero entries in the row
     */
    getRowDegree(row) {
      return this.rowNonZeros[row].length;
    }

    /**
     * @returns {int32} Number of non-zero entries
     */
    nonZeroCount() {
      /** @type {int32} */
      let count = 0;
      for (let r = 0; r < this.rows; ++r) count += this.rowNonZeros[r].length;
      return count;
    }

    /**
     * @param {int32} col - Column index
     * @returns {int32} Non-zero entries in the column
     */
    getColDegree(col) {
      return this.colNonZeros[col].length;
    }

    /**
     * @param {int32} row - Row index
     * @returns {int32[]} Columns of the non-zero entries, in insertion order
     */
    getRowNonZeros(row) {
      return this.rowNonZeros[row].slice();
    }

    /**
     * @param {int32} col - Column index
     * @returns {int32[]} Rows of the non-zero entries, in insertion order
     */
    getColNonZeros(col) {
      return this.colNonZeros[col].slice();
    }

    // XOR operation for binary matrices
    /**
     * @param {int32} targetRow - Row updated in place
     * @param {int32} sourceRow - Row added to it
     * @returns {void}
     */
    xorRow(targetRow, sourceRow) {
      /** @type {int32[]} */
      const sourceNonZeros = this.getRowNonZeros(sourceRow);
      for (let i = 0; i < sourceNonZeros.length; ++i) {
        /** @type {int32} */
        const col = sourceNonZeros[i];
        /** @type {uint32} */
        const currentValue = this.get(targetRow, col);
        /** @type {uint32} */
        const sourceValue = this.get(sourceRow, col);
        this.set(targetRow, col, OpCodes.ToInt(OpCodes.Xor32(currentValue, sourceValue)));
      }
    }

    /**
     * Copy with the entries replayed in their original insertion order
     * @returns {SparseMatrix} Independent copy
     */
    clone() {
      /** @type {SparseMatrix} */
      const result = new SparseMatrix(this.rows, this.cols);
      /** @type {int32[]} */
      const entryRows = [];
      /** @type {int32[]} */
      const entryIndices = [];
      /** @type {int32[]} */
      const entryStamps = [];
      for (let r = 0; r < this.rows; ++r) {
        /** @type {int32[]} */
        const stamps = this.rowStamps[r];
        for (let i = 0; i < stamps.length; ++i) {
          // Insertion sort by stamp
          let j = entryStamps.length;
          entryRows.push(r);
          entryIndices.push(i);
          entryStamps.push(stamps[i]);
          while (j > 0 && entryStamps[j - 1] > stamps[i]) {
            entryRows[j] = entryRows[j - 1];
            entryIndices[j] = entryIndices[j - 1];
            entryStamps[j] = entryStamps[j - 1];
            --j;
          }
          entryRows[j] = r;
          entryIndices[j] = i;
          entryStamps[j] = stamps[i];
        }
      }
      for (let e = 0; e < entryRows.length; ++e) {
        /** @type {int32} */
        const row = entryRows[e];
        /** @type {int32} */
        const index = entryIndices[e];
        result.set(row, this.rowNonZeros[row][index], this.rowValues[row][index]);
      }
      return result;
    }
  }

  /**
   * Bipartite graph for fountain codes
   */
  class BipartiteGraph {
    /**
     * @param {int32} leftNodes - Source symbol count
     * @param {int32} rightNodes - Encoded symbol count
     */
    constructor(leftNodes, rightNodes) {
      /** @type {int32} */
      this.leftNodes = leftNodes;   // Source symbols
      /** @type {int32} */
      this.rightNodes = rightNodes; // Encoded symbols
      /** @type {int32[][]} */
      this.edges = [];              // Per right node: its left nodes, in insertion order
      /** @type {int32[][]} */
      this.reverseEdges = [];       // Per left node: its right nodes, in insertion order

      // Initialize empty adjacency lists
      for (let i = 0; i < rightNodes; i++) {
        /** @type {int32[]} */
        const adjacent = [];
        this.edges.push(adjacent);
      }
      for (let i = 0; i < leftNodes; i++) {
        /** @type {int32[]} */
        const adjacent = [];
        this.reverseEdges.push(adjacent);
      }
    }

    /**
     * @param {int32} leftNode - Source symbol
     * @param {int32} rightNode - Encoded symbol
     * @returns {void}
     */
    addEdge(leftNode, rightNode) {
      if (leftNode >= this.leftNodes || rightNode >= this.rightNodes) {
        throw new Error('Node index out of bounds');
      }

      /** @type {int32[]} */
      const lefts = this.edges[rightNode];
      if (lefts.indexOf(leftNode) < 0) {
        lefts.push(leftNode);
      }
      /** @type {int32[]} */
      const rights = this.reverseEdges[leftNode];
      if (rights.indexOf(rightNode) < 0) {
        rights.push(rightNode);
      }
    }

    /**
     * @param {int32} leftNode - Source symbol
     * @param {int32} rightNode - Encoded symbol
     * @returns {void}
     */
    removeEdge(leftNode, rightNode) {
      /** @type {int32[]} */
      const lefts = this.edges[rightNode];
      /** @type {int32} */
      const leftAt = lefts.indexOf(leftNode);
      if (leftAt >= 0) {
        lefts.splice(leftAt, 1);
      }
      /** @type {int32[]} */
      const rights = this.reverseEdges[leftNode];
      /** @type {int32} */
      const rightAt = rights.indexOf(rightNode);
      if (rightAt >= 0) {
        rights.splice(rightAt, 1);
      }
    }

    /**
     * @param {int32} rightNode - Encoded symbol
     * @returns {int32[]} Source symbols it covers, in insertion order
     */
    getNeighbors(rightNode) {
      return this.edges[rightNode].slice();
    }

    /**
     * @param {int32} leftNode - Source symbol
     * @returns {int32[]} Encoded symbols covering it, in insertion order
     */
    getReverseNeighbors(leftNode) {
      return this.reverseEdges[leftNode].slice();
    }

    /**
     * @param {int32} rightNode - Encoded symbol
     * @returns {int32} Its degree
     */
    getDegree(rightNode) {
      return this.edges[rightNode].length;
    }

    /**
     * @param {int32} leftNode - Source symbol
     * @returns {int32} Its degree
     */
    getReverseDegree(leftNode) {
      return this.reverseEdges[leftNode].length;
    }

    // Find degree-1 nodes for belief propagation
    /**
     * @returns {int32[]} Encoded symbols of degree one
     */
    findDegreeOneNodes() {
      /** @type {int32[]} */
      const degreeOne = [];
      for (let i = 0; i < this.rightNodes; i++) {
        if (this.getDegree(i) === 1) {
          degreeOne.push(i);
        }
      }
      return degreeOne;
    }

    /**
     * @returns {BipartiteGraph} Independent copy
     */
    clone() {
      /** @type {BipartiteGraph} */
      const result = new BipartiteGraph(this.leftNodes, this.rightNodes);
      for (let rightNode = 0; rightNode < this.rightNodes; rightNode++) {
        /** @type {int32[]} */
        const neighbors = this.getNeighbors(rightNode);
        for (let n = 0; n < neighbors.length; ++n) {
          result.addEdge(neighbors[n], rightNode);
        }
      }
      return result;
    }
  }

  /**
   * Degree distribution functions for fountain codes
   */
  class DegreeDistribution {
    /**
     * @param {int32} k - Source symbol count
     */
    constructor(k) {
      /** @type {int32} */
      this.k = k;  // Number of source symbols
    }

    // Ideal Soliton Distribution
    /**
     * @param {int32} degree - Degree
     * @returns {float64} Probability
     */
    idealSoliton(degree) {
      if (degree === 1) {
        return 1.0 / this.k;
      } else if (degree >= 2 && degree <= this.k) {
        return 1.0 / (degree * (degree - 1));
      }
      return 0;
    }

    // Robust Soliton Distribution
    /**
     * @param {int32} degree - Degree
     * @param {float64} [c=0.1] - Robust Soliton constant
     * @param {float64} [delta=0.5] - Failure probability
     * @returns {float64} Probability
     */
    robustSoliton(degree, c = 0.1, delta = 0.5) {
      const idealProb = this.idealSoliton(degree);

      // Calculate R parameter
      const R = c * Math.log(this.k / delta) * Math.sqrt(this.k);

      // Tau function
      let tau = 0;
      for (let i = 1; i <= this.k; i++) {
        if (i <= this.k / R) {
          tau += R / (i * this.k);
        } else if (i === Math.floor(this.k / R) + 1) {
          tau += R * Math.log(R / delta) / this.k;
        }
      }

      // Calculate tau for specific degree
      let tauDegree = 0;
      if (degree <= this.k / R) {
        tauDegree = R / (degree * this.k);
      } else if (degree === Math.floor(this.k / R) + 1) {
        tauDegree = R * Math.log(R / delta) / this.k;
      }

      // Normalize
      const beta = idealProb + tauDegree;
      const Z = tau + 1.0; // Normalization constant

      return beta / Z;
    }

    // Generate random degree based on robust soliton distribution
    /**
     * @param {float64} [c=0.1] - Robust Soliton constant
     * @param {float64} [delta=0.5] - Failure probability
     * @param {SeededRandom} [rng=null] - Generator; Math.random when null
     * @returns {int32} Sampled degree
     */
    sampleDegree(c = 0.1, delta = 0.5, rng = null) {
      /** @type {float64} */
      const rand = rng ? rng.next() : Math.random();
      let cumulative = 0;

      for (let degree = 1; degree <= this.k; degree++) {
        cumulative += this.robustSoliton(degree, c, delta);
        if (rand <= cumulative) {
          return degree;
        }
      }
      return this.k; // Fallback
    }

    // Precompute cumulative distribution for faster sampling
    /**
     * @param {float64} [c=0.1] - Robust Soliton constant
     * @param {float64} [delta=0.5] - Failure probability
     * @returns {float64[]} cdf[d] = P(degree <= d), d = 1..k
     */
    buildCumulativeDistribution(c = 0.1, delta = 0.5) {
      /** @type {float64[]} */
      const cdf = new Array(this.k + 1);
      let cumulative = 0;

      for (let degree = 1; degree <= this.k; degree++) {
        cumulative += this.robustSoliton(degree, c, delta);
        cdf[degree] = cumulative;
      }

      return cdf;
    }

    /**
     * @param {float64[]} cdf - Cumulative distribution
     * @param {SeededRandom} [rng=null] - Generator; Math.random when null
     * @returns {int32} Sampled degree
     */
    sampleDegreeFromCDF(cdf, rng = null) {
      /** @type {float64} */
      const rand = rng ? rng.next() : Math.random();
      for (let degree = 1; degree < cdf.length; degree++) {
        if (rand <= cdf[degree]) {
          return degree;
        }
      }
      return this.k;
    }
  }

  /**
   * Random number generator with reproducible seeds
   */
  class SeededRandom {
    /**
     * @param {float64} [seed=1] - Seed
     */
    constructor(seed = 1) {
      /** @type {float64} */
      this.seed = seed;
    }

    // Linear Congruential Generator
    /**
     * @returns {float64} Next value in (0, 1)
     */
    next() {
      this.seed = (this.seed * 16807) % 2147483647;
      return this.seed / 2147483647;
    }

    /**
     * @param {int32} max - Exclusive bound
     * @returns {int32} Value in [0, max)
     */
    nextInt(max) {
      return Math.floor(this.next() * max);
    }

    // Fisher-Yates shuffle
    /**
     * @param {int32[]} array - Items
     * @returns {int32[]} Shuffled copy
     */
    shuffle(array) {
      /** @type {int32[]} */
      const result = array.slice();
      for (let i = result.length - 1; i > 0; i--) {
        /** @type {int32} */
        const j = this.nextInt(i + 1);
        /** @type {int32} */
        const swap = result[i];
        result[i] = result[j];
        result[j] = swap;
      }
      return result;
    }

    // Sample without replacement
    /**
     * @param {int32[]} array - Items
     * @param {int32} count - Items to draw
     * @returns {int32[]} count items drawn without replacement
     */
    sample(array, count) {
      if (count > array.length) {
        throw new Error('Cannot sample more items than available');
      }

      /** @type {int32[]} */
      const shuffled = this.shuffle(array);
      return shuffled.slice(0, count);
    }
  }

  /**
   * Performance utilities for benchmarking
   */
  class PerformanceProfiler {
    constructor() {
      /** @type {Map<string, float64>} */
      this.timers = new Map();
      /** @type {Map<string, int32>} */
      this.counters = new Map();
    }

    /**
     * @param {string} name - Timer name
     * @returns {void}
     */
    startTimer(name) {
      this.timers.set(name, performance.now());
    }

    /**
     * @param {string} name - Timer name
     * @returns {float64} Elapsed milliseconds
     */
    endTimer(name) {
      const start = this.timers.get(name);
      if (start === undefined) {
        throw new Error(`Timer ${name} was not started`);
      }
      const duration = performance.now() - start;
      this.timers.delete(name);
      return duration;
    }

    /**
     * @param {string} name - Counter name
     * @param {int32} [value=1] - Increment
     * @returns {void}
     */
    incrementCounter(name, value = 1) {
      const current = this.counters.get(name) || 0;
      this.counters.set(name, current + value);
    }

    /**
     * @param {string} name - Counter name
     * @returns {int32} Counter value, 0 when unset
     */
    getCounter(name) {
      return this.counters.get(name) || 0;
    }

    getReport() {
      return {
        counters: Object.fromEntries(this.counters),
        activeTimers: Array.from(this.timers.keys())
      };
    }

    /**
     * @returns {void}
     */
    reset() {
      this.timers.clear();
      this.counters.clear();
    }
  }

  // ===== EXPORTS =====

  /**
   * Fountain Foundation Library
   *
   * Utility library providing mathematical foundations for fountain codes:
   * - GaloisField: Galois Field GF(2^8) arithmetic
   * - SparseMatrix: Efficient sparse matrix operations
   * - BipartiteGraph: Bipartite graph for encoding/decoding
   * - DegreeDistribution: Degree distribution generators (Robust Soliton, etc.)
   * - SeededRandom: Deterministic seeded random number generator
   * - PerformanceProfiler: Performance measurement utilities
   *
   * Used by: LT Codes, Raptor Codes, RaptorQ
   */
  return {
    GaloisField,
    SparseMatrix,
    BipartiteGraph,
    DegreeDistribution,
    SeededRandom,
    PerformanceProfiler
  };

}));