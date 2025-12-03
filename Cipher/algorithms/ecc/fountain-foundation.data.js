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
    constructor(p = 2, m = 8) {
      this.p = p;  // Prime base (typically 2 for binary)
      this.m = m;  // Extension degree
      this.size = Math.pow(p, m);  // Field size
      this.primitive = this._findPrimitive();
      this._buildTables();
    }

    _findPrimitive() {
      // For GF(2^8), use standard primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1
      // This gives us 0x11D (285 in decimal)
      if (this.p === 2 && this.m === 8) {
        return 0x11D;
      }
      throw new Error(`Primitive polynomial not defined for GF(${this.p}^${this.m})`);
    }

    _buildTables() {
      this.expTable = new Array(this.size);
      this.logTable = new Array(this.size);

      let x = 1;
      for (let i = 0; i < this.size - 1; i++) {
        this.expTable[i] = x;
        this.logTable[x] = i;
        x = this._primitiveMultiply(x, 2);
      }
    }

    // Raw primitive multiplication for table building
    _primitiveMultiply(a, b) {
      let result = 0;
      while (b > 0) {
        if (OpCodes.AndN(b, 1)) {
          result = OpCodes.XorN(result, a);
        }
        a = OpCodes.Shl32(a, 1);
        if (OpCodes.AndN(a, this.size)) {
          a = OpCodes.XorN(a, this.primitive);
        }
        b = OpCodes.Shr32(b, 1);
      }
      return result;
    }

    add(a, b) {
      return OpCodes.XorN(a, b);  // XOR for GF(2^m)
    }

    subtract(a, b) {
      return this.add(a, b);  // Same as add in GF(2^m)
    }

    multiply(a, b) {
      if (a === 0 || b === 0) return 0;
      return this.expTable[(this.logTable[a] + this.logTable[b]) % (this.size - 1)];
    }

    divide(a, b) {
      if (b === 0) throw new Error('Division by zero in Galois Field');
      if (a === 0) return 0;
      return this.expTable[(this.logTable[a] - this.logTable[b] + this.size - 1) % (this.size - 1)];
    }

    power(a, exp) {
      if (exp === 0) return 1;
      if (a === 0) return 0;
      return this.expTable[(this.logTable[a] * exp) % (this.size - 1)];
    }

    inverse(a) {
      if (a === 0) throw new Error('Cannot invert zero in Galois Field');
      return this.expTable[(this.size - 1 - this.logTable[a])];
    }
  }

  /**
   * Sparse matrix representation for efficient operations
   */
  class SparseMatrix {
    constructor(rows, cols) {
      this.rows = rows;
      this.cols = cols;
      this.data = new Map();  // Map from "row,col" to value
      this.rowNonZeros = new Array(rows).fill(0).map(() => new Set());
      this.colNonZeros = new Array(cols).fill(0).map(() => new Set());
    }

    get(row, col) {
      const key = `${row},${col}`;
      return this.data.get(key) || 0;
    }

    set(row, col, value) {
      const key = `${row},${col}`;
      const oldValue = this.data.get(key) || 0;

      if (value === 0) {
        this.data.delete(key);
        this.rowNonZeros[row].delete(col);
        this.colNonZeros[col].delete(row);
      } else {
        this.data.set(key, value);
        this.rowNonZeros[row].add(col);
        this.colNonZeros[col].add(row);
      }
    }

    getRowDegree(row) {
      return this.rowNonZeros[row].size;
    }

    getColDegree(col) {
      return this.colNonZeros[col].size;
    }

    getRowNonZeros(row) {
      return Array.from(this.rowNonZeros[row]);
    }

    getColNonZeros(col) {
      return Array.from(this.colNonZeros[col]);
    }

    // XOR operation for binary matrices
    xorRow(targetRow, sourceRow) {
      const sourceNonZeros = this.getRowNonZeros(sourceRow);
      for (const col of sourceNonZeros) {
        const currentValue = this.get(targetRow, col);
        const sourceValue = this.get(sourceRow, col);
        this.set(targetRow, col, OpCodes.XorN(currentValue, sourceValue));
      }
    }

    clone() {
      const result = new SparseMatrix(this.rows, this.cols);
      for (const [key, value] of this.data) {
        const [row, col] = key.split(',').map(Number);
        result.set(row, col, value);
      }
      return result;
    }
  }

  /**
   * Bipartite graph for fountain codes
   */
  class BipartiteGraph {
    constructor(leftNodes, rightNodes) {
      this.leftNodes = leftNodes;   // Source symbols
      this.rightNodes = rightNodes; // Encoded symbols
      this.edges = new Map();       // Map from right node to set of left nodes
      this.reverseEdges = new Map(); // Map from left node to set of right nodes

      // Initialize empty adjacency lists
      for (let i = 0; i < rightNodes; i++) {
        this.edges.set(i, new Set());
      }
      for (let i = 0; i < leftNodes; i++) {
        this.reverseEdges.set(i, new Set());
      }
    }

    addEdge(leftNode, rightNode) {
      if (leftNode >= this.leftNodes || rightNode >= this.rightNodes) {
        throw new Error('Node index out of bounds');
      }

      this.edges.get(rightNode).add(leftNode);
      this.reverseEdges.get(leftNode).add(rightNode);
    }

    removeEdge(leftNode, rightNode) {
      this.edges.get(rightNode).delete(leftNode);
      this.reverseEdges.get(leftNode).delete(rightNode);
    }

    getNeighbors(rightNode) {
      return Array.from(this.edges.get(rightNode));
    }

    getReverseNeighbors(leftNode) {
      return Array.from(this.reverseEdges.get(leftNode));
    }

    getDegree(rightNode) {
      return this.edges.get(rightNode).size;
    }

    getReverseDegree(leftNode) {
      return this.reverseEdges.get(leftNode).size;
    }

    // Find degree-1 nodes for belief propagation
    findDegreeOneNodes() {
      const degreeOne = [];
      for (let i = 0; i < this.rightNodes; i++) {
        if (this.getDegree(i) === 1) {
          degreeOne.push(i);
        }
      }
      return degreeOne;
    }

    clone() {
      const result = new BipartiteGraph(this.leftNodes, this.rightNodes);
      for (let rightNode = 0; rightNode < this.rightNodes; rightNode++) {
        const neighbors = this.getNeighbors(rightNode);
        for (const leftNode of neighbors) {
          result.addEdge(leftNode, rightNode);
        }
      }
      return result;
    }
  }

  /**
   * Degree distribution functions for fountain codes
   */
  class DegreeDistribution {
    constructor(k) {
      this.k = k;  // Number of source symbols
    }

    // Ideal Soliton Distribution
    idealSoliton(degree) {
      if (degree === 1) {
        return 1.0 / this.k;
      } else if (degree >= 2 && degree <= this.k) {
        return 1.0 / (degree * (degree - 1));
      }
      return 0;
    }

    // Robust Soliton Distribution
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
    sampleDegree(c = 0.1, delta = 0.5, rng = null) {
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
    buildCumulativeDistribution(c = 0.1, delta = 0.5) {
      const cdf = new Array(this.k + 1);
      let cumulative = 0;

      for (let degree = 1; degree <= this.k; degree++) {
        cumulative += this.robustSoliton(degree, c, delta);
        cdf[degree] = cumulative;
      }

      return cdf;
    }

    sampleDegreeFromCDF(cdf, rng = null) {
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
    constructor(seed = 1) {
      this.seed = seed;
    }

    // Linear Congruential Generator
    next() {
      this.seed = (this.seed * 16807) % 2147483647;
      return this.seed / 2147483647;
    }

    nextInt(max) {
      return Math.floor(this.next() * max);
    }

    // Fisher-Yates shuffle
    shuffle(array) {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = this.nextInt(i + 1);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }

    // Sample without replacement
    sample(array, count) {
      if (count > array.length) {
        throw new Error('Cannot sample more items than available');
      }

      const shuffled = this.shuffle(array);
      return shuffled.slice(0, count);
    }
  }

  /**
   * Performance utilities for benchmarking
   */
  class PerformanceProfiler {
    constructor() {
      this.timers = new Map();
      this.counters = new Map();
    }

    startTimer(name) {
      this.timers.set(name, performance.now());
    }

    endTimer(name) {
      const start = this.timers.get(name);
      if (start === undefined) {
        throw new Error(`Timer ${name} was not started`);
      }
      const duration = performance.now() - start;
      this.timers.delete(name);
      return duration;
    }

    incrementCounter(name, value = 1) {
      const current = this.counters.get(name) || 0;
      this.counters.set(name, current + value);
    }

    getCounter(name) {
      return this.counters.get(name) || 0;
    }

    getReport() {
      return {
        counters: Object.fromEntries(this.counters),
        activeTimers: Array.from(this.timers.keys())
      };
    }

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