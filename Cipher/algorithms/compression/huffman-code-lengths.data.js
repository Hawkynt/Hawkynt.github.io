/*
 * Deterministic Huffman Code-Length Builder
 * (c)2006-2025 Hawkynt
 *
 * This is a utility library, NOT an algorithm implementation.
 * Used by: Implode (ZIP method 6), RAR5.
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
   * Builds Huffman code lengths for the given symbol weights.
   *
   * @param {Array<number>} weights Weight per symbol, indexed by symbol value. Symbols
   *   whose weight is zero or negative are excluded from the tree and get length zero.
   * @param {number} [symbolCount] How many entries of weights to consider; defaults to
   *   the full array.
   * @returns {Array<number>} One code length per symbol, zero for excluded symbols. A
   *   single participating symbol gets length one. Lengths are otherwise unbounded;
   *   callers needing a depth limit clamp and repair the Kraft sum themselves.
   */
  function buildCodeLengths(weights, symbolCount) {
    const count = symbolCount === undefined ? weights.length : symbolCount;
    const lengths = new Array(count).fill(0);

    let leafCount = 0;
    for (let i = 0; i < count; ++i)
      if (weights[i] > 0) ++leafCount;

    if (leafCount === 0) return lengths;

    if (leafCount === 1) {
      for (let i = 0; i < count; ++i)
        if (weights[i] > 0) { lengths[i] = 1; break; }
      return lengths;
    }

    // Node storage. Slots [0, leafCount) hold the leaves in ascending order, slots
    // [leafCount, nodeCount) the internal nodes in creation order. Every internal node
    // therefore sits at a higher index than both of its children.
    const nodeCount = 2 * leafCount - 1;
    const nodeWeight = new Array(nodeCount).fill(0);
    const nodeSymbol = new Array(nodeCount).fill(-1);
    const nodeLeft = new Array(nodeCount).fill(-1);
    const nodeRight = new Array(nodeCount).fill(-1);

    const leaves = [];
    for (let i = 0; i < count; ++i)
      if (weights[i] > 0) leaves.push({ weight: weights[i], symbol: i });

    // Ascending by (weight, symbol), which is exactly the total order restricted to
    // leaves because a leaf's rank is its symbol value. The comparison never returns
    // zero for two different leaves, so how the sort itself treats equal keys cannot
    // matter.
    leaves.sort((a, b) => a.weight !== b.weight ? a.weight - b.weight : a.symbol - b.symbol);

    for (let i = 0; i < leafCount; ++i) {
      nodeWeight[i] = leaves[i].weight;
      nodeSymbol[i] = leaves[i].symbol;
    }

    // Two-queue merge: leafHead walks the sorted leaves, internalHead the internal nodes
    // in creation order. Both queues are in ascending total order, so the smallest node
    // still in play is always one of the two fronts.
    let leafHead = 0;
    let internalHead = leafCount;
    let created = leafCount;

    const takeSmallest = () => {
      // Equal weight favours the leaf: a leaf's rank is below symbolCount while an
      // internal node's rank is at or above it.
      const takeLeaf = leafHead < leafCount
        && (internalHead >= created || nodeWeight[leafHead] <= nodeWeight[internalHead]);

      return takeLeaf ? leafHead++ : internalHead++;
    };

    while (created < nodeCount) {
      const left = takeSmallest();
      const right = takeSmallest();
      nodeWeight[created] = nodeWeight[left] + nodeWeight[right];
      nodeSymbol[created] = -1;
      nodeLeft[created] = left;
      nodeRight[created] = right;
      ++created;
    }

    // Depths, walked from the root backwards. Both children of a node always sit at a
    // lower index than the node itself, so one reverse pass suffices and no recursion is
    // needed even for a maximally skewed tree.
    const depth = new Array(nodeCount).fill(0);
    for (let i = nodeCount - 1; i >= leafCount; --i) {
      const childDepth = depth[i] + 1;
      depth[nodeLeft[i]] = childDepth;
      depth[nodeRight[i]] = childDepth;
    }

    for (let i = 0; i < leafCount; ++i)
      lengths[nodeSymbol[i]] = Math.max(depth[i], 1);

    return lengths;
  }

  return { buildCodeLengths };
}));
