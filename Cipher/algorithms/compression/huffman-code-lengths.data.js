/*
 * Deterministic Huffman Code-Length Builder
 * (c)2006-2025 Hawkynt
 *
 * This is a utility library, NOT an algorithm implementation.
 * Used by: ACE, DEFLATE, Deflate64, Huffman, Implode (ZIP method 6), RAR, RAR5,
 * SQX, Xpress, Zling and Zopfli - every place in this project that turns symbol
 * frequencies into code lengths.
 *
 * Textbook Huffman construction says "repeatedly merge the two lightest nodes" but
 * says nothing about which node to pick when several are equally light. Handing the
 * nodes to a generic priority queue leaves the tree shape - and with it the code
 * lengths and every compressed byte that depends on them - at the mercy of that
 * queue's internal ordering of equal keys, which no container documents. This builder
 * removes that freedom by making the tie-break part of the algorithm.
 *
 * THE TOTAL ORDER
 *
 * Every node carries a weight and a rank:
 *   - a leaf for symbol s has the weight of s and rank s;
 *   - the k-th internal node created (k counting from zero) has the summed weight of
 *     its two children and rank symbolCount + k.
 *
 * Node a precedes node b exactly when a.weight < b.weight, or the weights are equal
 * and a.rank < b.rank. Ranks are pairwise distinct - symbols are distinct and all
 * below symbolCount, creation indices are distinct and all at or above it - so no two
 * distinct nodes ever compare equal and the order is total. In plain terms: lighter
 * first; among equal weights, leaves before internal nodes, leaves by ascending symbol
 * value, internal nodes oldest first. Preferring leaves on a tie also keeps the tree
 * shallow, since a leaf can never be deeper than a node that already has children.
 *
 * THE CONSTRUCTION
 *
 * No heap is involved. Leaves are sorted once into the above order; internal nodes are
 * appended to a second queue as they are created, and that queue is already sorted,
 * because merge weights are non-decreasing and creation indices increase. The globally
 * smallest node is therefore always at the front of one of the two queues, and building
 * the tree is an ordinary two-queue merge.
 *
 * The CompressionWorkbench (C#) project implements the same rule in
 * Compression.Core/Entropy/Huffman/DeterministicHuffman.cs; the two agree because they
 * follow the same written rule, not because either mimics the other's runtime.
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
    root.HuffmanCodeLengths = factory();
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function () {
  'use strict';

  /**
   * The total order restricted to leaves: lighter first, equal weights by ascending
   * symbol value (a leaf's rank is its symbol value).
   *
   * @param {float64} weightA Weight of the first leaf.
   * @param {int32} symbolA Symbol of the first leaf.
   * @param {float64} weightB Weight of the second leaf.
   * @param {int32} symbolB Symbol of the second leaf.
   * @returns {boolean} True when the first leaf precedes the second.
   */
  function leafPrecedes(weightA, symbolA, weightB, symbolB) {
    if (weightA !== weightB) {
      return weightA < weightB;
    }
    return symbolA < symbolB;
  }

  /**
   * Sorts the leaves in place into ascending (weight, symbol) order with a bottom-up
   * merge sort. The order never ties for two different leaves, so the result is the
   * one sorted sequence and does not depend on how any sort treats equal keys.
   *
   * @param {float64[]} leafWeight Leaf weights, reordered together with leafSymbol.
   * @param {int32[]} leafSymbol Leaf symbols.
   * @param {int32} n Number of leaves.
   */
  function sortLeaves(leafWeight, leafSymbol, n) {
    /** @type {float64[]} */
    let srcWeight = leafWeight;
    /** @type {int32[]} */
    let srcSymbol = leafSymbol;
    /** @type {float64[]} */
    let dstWeight = new Float64Array(n);
    /** @type {int32[]} */
    let dstSymbol = new Int32Array(n);

    for (let width = 1; width < n; width *= 2) {
      for (let lo = 0; lo < n; lo += 2 * width) {
        /** @type {int32} */
        const mid = Math.min(lo + width, n);
        /** @type {int32} */
        const hi = Math.min(lo + 2 * width, n);
        /** @type {int32} */
        let a = lo;
        /** @type {int32} */
        let b = mid;
        for (let k = lo; k < hi; ++k) {
          /** @type {boolean} */
          let takeA = false;
          if (a < mid) {
            if (b >= hi) {
              takeA = true;
            } else {
              takeA = !leafPrecedes(srcWeight[b], srcSymbol[b], srcWeight[a], srcSymbol[a]);
            }
          }
          if (takeA) {
            dstWeight[k] = srcWeight[a];
            dstSymbol[k] = srcSymbol[a];
            ++a;
          } else {
            dstWeight[k] = srcWeight[b];
            dstSymbol[k] = srcSymbol[b];
            ++b;
          }
        }
      }
      /** @type {float64[]} */
      const swapWeight = srcWeight;
      srcWeight = dstWeight;
      dstWeight = swapWeight;
      /** @type {int32[]} */
      const swapSymbol = srcSymbol;
      srcSymbol = dstSymbol;
      dstSymbol = swapSymbol;
    }

    if (srcWeight !== leafWeight) {
      for (let k = 0; k < n; ++k) {
        leafWeight[k] = srcWeight[k];
        leafSymbol[k] = srcSymbol[k];
      }
    }
  }

  /**
   * Builds Huffman code lengths for the given symbol weights.
   *
   * @param {float64[]} weights Weight per symbol, indexed by symbol value. Symbols
   *   whose weight is zero or negative are excluded from the tree and get length zero.
   * @param {int32} [symbolCount] How many entries of weights to consider; defaults to
   *   the full array.
   * @returns {int32[]} One code length per symbol, zero for excluded symbols. A
   *   single participating symbol gets length one. Lengths are otherwise unbounded;
   *   callers needing a depth limit clamp and repair the Kraft sum themselves.
   */
  function buildCodeLengths(weights, symbolCount = weights.length) {
    /** @type {int32} */
    const count = symbolCount;
    /** @type {int32[]} */
    const lengths = new Array(count);
    for (let i = 0; i < count; ++i) {
      lengths[i] = 0;
    }

    /** @type {int32} */
    let leafCount = 0;
    for (let i = 0; i < count; ++i) {
      if (weights[i] > 0) {
        ++leafCount;
      }
    }

    if (leafCount === 0) {
      return lengths;
    }

    if (leafCount === 1) {
      for (let i = 0; i < count; ++i) {
        if (weights[i] > 0) {
          lengths[i] = 1;
          break;
        }
      }
      return lengths;
    }

    // Node storage. Slots [0, leafCount) hold the leaves in ascending order, slots
    // [leafCount, nodeCount) the internal nodes in creation order. Every internal node
    // therefore sits at a higher index than both of its children.
    /** @type {int32} */
    const nodeCount = 2 * leafCount - 1;
    /** @type {float64[]} */
    const nodeWeight = new Float64Array(nodeCount);
    /** @type {int32[]} */
    const nodeSymbol = new Int32Array(nodeCount).fill(-1);
    /** @type {int32[]} */
    const nodeLeft = new Int32Array(nodeCount).fill(-1);
    /** @type {int32[]} */
    const nodeRight = new Int32Array(nodeCount).fill(-1);

    // Leaves are collected in ascending symbol order.
    /** @type {float64[]} */
    const leafWeight = new Float64Array(leafCount);
    /** @type {int32[]} */
    const leafSymbol = new Int32Array(leafCount);
    /** @type {int32} */
    let collected = 0;
    for (let i = 0; i < count; ++i) {
      if (weights[i] > 0) {
        leafWeight[collected] = weights[i];
        leafSymbol[collected] = i;
        ++collected;
      }
    }

    // Ascending by (weight, symbol), which is exactly the total order restricted to
    // leaves because a leaf's rank is its symbol value.
    sortLeaves(leafWeight, leafSymbol, leafCount);

    for (let i = 0; i < leafCount; ++i) {
      nodeWeight[i] = leafWeight[i];
      nodeSymbol[i] = leafSymbol[i];
    }

    // Two-queue merge: leafHead walks the sorted leaves, internalHead the internal nodes
    // in creation order. Both queues are in ascending total order, so the smallest node
    // still in play is always one of the two fronts.
    /** @type {int32} */
    let leafHead = 0;
    /** @type {int32} */
    let internalHead = leafCount;
    /** @type {int32} */
    let created = leafCount;
    /** @type {int32[]} */
    const picked = new Int32Array(2);

    while (created < nodeCount) {
      for (let p = 0; p < 2; ++p) {
        // Equal weight favours the leaf: a leaf's rank is below symbolCount while an
        // internal node's rank is at or above it.
        /** @type {boolean} */
        const leafLeft = leafHead < leafCount;
        /** @type {boolean} */
        const internalEmpty = internalHead >= created;
        /** @type {boolean} */
        const leafLighter = internalEmpty || nodeWeight[leafHead] <= nodeWeight[internalHead];
        if (leafLeft && leafLighter) {
          picked[p] = leafHead++;
        } else {
          picked[p] = internalHead++;
        }
      }
      /** @type {int32} */
      const left = picked[0];
      /** @type {int32} */
      const right = picked[1];
      nodeWeight[created] = nodeWeight[left] + nodeWeight[right];
      nodeSymbol[created] = -1;
      nodeLeft[created] = left;
      nodeRight[created] = right;
      ++created;
    }

    // Depths, walked from the root backwards. Both children of a node always sit at a
    // lower index than the node itself, so one reverse pass suffices and no recursion is
    // needed even for a maximally skewed tree.
    /** @type {int32[]} */
    const depth = new Int32Array(nodeCount);
    for (let i = nodeCount - 1; i >= leafCount; --i) {
      /** @type {int32} */
      const childDepth = depth[i] + 1;
      depth[nodeLeft[i]] = childDepth;
      depth[nodeRight[i]] = childDepth;
    }

    for (let i = 0; i < leafCount; ++i) {
      lengths[nodeSymbol[i]] = Math.max(depth[i], 1);
    }

    return lengths;
  }

  return { buildCodeLengths };
}));
