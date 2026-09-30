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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * SuffixTreeAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class SuffixTreeAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Suffix Tree Compression";
        this.description = "Advanced lossless compression using suffix tree construction and longest common substring analysis. Exploits repetitive structure through efficient substring matching and reference-based encoding with optimal space utilization.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Suffix Structure";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "Edward McCreight, Esko Ukkonen";
        this.year = 1976;
        this.country = CountryCode.US;

        // Suffix Tree parameters (matches CompressionWorkbench's BB_SuffixTree)
        /** @type {int32} */
        this.MIN_MATCH_LENGTH = 3;      // Minimum substring length for compression
        /** @type {int32} */
        this.MAX_MATCH_LENGTH = 255;    // Maximum match length (fits a single control byte)

        this.documentation = [
          new LinkItem("Suffix Trees", "https://en.wikipedia.org/wiki/Suffix_tree"),
          new LinkItem("Ukkonen's Algorithm", "https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf"),
          new LinkItem("Suffix Tree Applications", "https://web.stanford.edu/~mjkay/suffix_trees.pdf")
        ];

        this.references = [
          new LinkItem("Linear Time Suffix Trees", "https://doi.org/10.1145/74073.74089"),
          new LinkItem("McCreight Suffix Trees", "https://dl.acm.org/doi/10.1145/321879.321884"),
          new LinkItem("Practical Suffix Trees", "https://github.com/kvh/suffix-trees"),
          new LinkItem("String Algorithms", "https://www.cambridge.org/core/books/string-algorithms/")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_SuffixTree):
        //   4 bytes original length (little-endian); if 0, no payload follows.
        //   Then a stream of tokens:
        //     0x00, count, <count raw bytes>        -- literal run (count <= 255)
        //     length (1-255), 4-byte LE offset       -- back-reference match
        this.tests = [
          new TestCase(
            [],
            [0, 0, 0, 0],
            "Empty input",
            "https://en.wikipedia.org/wiki/Suffix_tree"
          ),
          new TestCase(
            [97, 98, 97, 98, 97, 98], // "ababab"
            [6, 0, 0, 0, 0, 2, 97, 98, 4, 2, 0, 0, 0],
            "Repetitive pattern - optimal for suffix tree",
            "https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf"
          ),
          new TestCase(
            [98, 97, 110, 97, 110, 97], // "banana"
            [6, 0, 0, 0, 0, 3, 98, 97, 110, 3, 2, 0, 0, 0],
            "Classic suffix tree example",
            "https://web.stanford.edu/~mjkay/suffix_trees.pdf"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {SuffixTreeInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new SuffixTreeInstance(this, isInverse);
      }
    }

    /** @type {int32} */
    const INFINITE = 0x7fffffff;

    /**
     * Segment trees over the LCP array (range minimum) and over the visited
     * positions keyed by rank (range maximum, -1 = not reached yet), with the
     * searches the factorization needs. The canonical cover of a query range
     * is kept in reused buffers so queries never allocate.
     */
    class FactorIndex {
      /**
       * @param {int32[]} lcp - LCP values indexed by rank, length n+1
       * @param {int32} n - Number of input bytes
       */
      constructor(lcp, n) {
        /** @type {int32} */
        this.n = n;

        /** @type {int32} */
        let lcpSize = 1;
        while (lcpSize < n + 1) {
          lcpSize *= 2;
        }
        /** @type {int32} */
        this.lcpSize = lcpSize;
        /** @type {int32[]} */
        this.lcpTree = new Int32Array(lcpSize * 2).fill(INFINITE);
        for (let k = 0; k <= n; k++) {
          this.lcpTree[lcpSize + k] = lcp[k];
        }
        for (let k = lcpSize - 1; k >= 1; k--) {
          this.lcpTree[k] = Math.min(this.lcpTree[k * 2], this.lcpTree[k * 2 + 1]);
        }

        // Visited positions keyed by rank; -1 marks a rank not yet reached.
        // Aggregated by maximum, so a range query yields the most recent visit.
        /** @type {int32} */
        let visitedSize = 1;
        while (visitedSize < n) {
          visitedSize *= 2;
        }
        /** @type {int32} */
        this.visitedSize = visitedSize;
        /** @type {int32[]} */
        this.visitedTree = new Int32Array(visitedSize * 2).fill(-1);

        /** @type {int32[]} */
        this.leftNodes = new Int32Array(64);
        /** @type {int32[]} */
        this.rightNodes = new Int32Array(64);
        /** @type {int32} */
        this.leftCount = 0;
        /** @type {int32} */
        this.rightCount = 0;
      }

      /**
       * Canonical cover of the leaf range [lo, hi] of a tree with size leaves
       * @param {int32} size - Number of leaves
       * @param {int32} lo - First leaf
       * @param {int32} hi - Last leaf
       */
      cover(size, lo, hi) {
        /** @type {int32} */
        let left = size + lo;
        /** @type {int32} */
        let right = size + hi + 1;
        this.leftCount = 0;
        this.rightCount = 0;
        while (left < right) {
          if (left % 2 === 1) {
            this.leftNodes[this.leftCount++] = left;
            left++;
          }
          if (right % 2 === 1) {
            right--;
            this.rightNodes[this.rightCount++] = right;
          }
          left = Math.floor(left / 2);
          right = Math.floor(right / 2);
        }
      }

      /**
       * @param {int32} lo - First LCP index
       * @param {int32} hi - Last LCP index
       * @returns {int32} Minimum LCP in [lo, hi], INFINITE when empty
       */
      lcpMin(lo, hi) {
        if (lo > hi) {
          return INFINITE;
        }
        this.cover(this.lcpSize, lo, hi);
        /** @type {int32} */
        let best = INFINITE;
        for (let t = 0; t < this.leftCount; t++) {
          if (this.lcpTree[this.leftNodes[t]] < best) {
            best = this.lcpTree[this.leftNodes[t]];
          }
        }
        for (let t = 0; t < this.rightCount; t++) {
          if (this.lcpTree[this.rightNodes[t]] < best) {
            best = this.lcpTree[this.rightNodes[t]];
          }
        }
        return best;
      }

      /**
       * Rightmost index in [0, hi] whose LCP entry is below limit.
       * @param {int32} hi - Last LCP index
       * @param {int32} limit - Bound
       * @returns {int32} Index
       */
      lastLcpBelow(hi, limit) {
        this.cover(this.lcpSize, 0, hi);
        for (let t = 0; t < this.rightCount; t++) {
          /** @type {int32} */
          let node = this.rightNodes[t];
          if (this.lcpTree[node] >= limit) {
            continue;
          }
          while (node < this.lcpSize) {
            node = this.lcpTree[node * 2 + 1] < limit ? node * 2 + 1 : node * 2;
          }
          return node - this.lcpSize;
        }
        for (let t = this.leftCount - 1; t >= 0; t--) {
          /** @type {int32} */
          let node = this.leftNodes[t];
          if (this.lcpTree[node] >= limit) {
            continue;
          }
          while (node < this.lcpSize) {
            node = this.lcpTree[node * 2 + 1] < limit ? node * 2 + 1 : node * 2;
          }
          return node - this.lcpSize;
        }
        return 0;
      }

      /**
       * Leftmost index in [lo, n] whose LCP entry is below limit.
       * @param {int32} lo - First LCP index
       * @param {int32} limit - Bound
       * @returns {int32} Index
       */
      firstLcpBelow(lo, limit) {
        this.cover(this.lcpSize, lo, this.n);
        for (let t = 0; t < this.leftCount; t++) {
          /** @type {int32} */
          let node = this.leftNodes[t];
          if (this.lcpTree[node] >= limit) {
            continue;
          }
          while (node < this.lcpSize) {
            node = this.lcpTree[node * 2] < limit ? node * 2 : node * 2 + 1;
          }
          return node - this.lcpSize;
        }
        for (let t = this.rightCount - 1; t >= 0; t--) {
          /** @type {int32} */
          let node = this.rightNodes[t];
          if (this.lcpTree[node] >= limit) {
            continue;
          }
          while (node < this.lcpSize) {
            node = this.lcpTree[node * 2] < limit ? node * 2 : node * 2 + 1;
          }
          return node - this.lcpSize;
        }
        return this.n;
      }

      /**
       * @param {int32} rankIndex - Rank of the visited suffix
       * @param {int32} position - Its position
       */
      markVisited(rankIndex, position) {
        /** @type {int32} */
        let node = this.visitedSize + rankIndex;
        this.visitedTree[node] = position;
        node = Math.floor(node / 2);
        while (node >= 1) {
          /** @type {int32} */
          const a = this.visitedTree[node * 2];
          /** @type {int32} */
          const b = this.visitedTree[node * 2 + 1];
          this.visitedTree[node] = a > b ? a : b;
          node = Math.floor(node / 2);
        }
      }

      /**
       * Nearest visited rank strictly below hi+1, or -1 when there is none.
       * @param {int32} hi - Highest rank considered
       * @returns {int32} Rank or -1
       */
      lastVisited(hi) {
        if (hi < 0) {
          return -1;
        }
        this.cover(this.visitedSize, 0, hi);
        for (let t = 0; t < this.rightCount; t++) {
          /** @type {int32} */
          let node = this.rightNodes[t];
          if (this.visitedTree[node] < 0) {
            continue;
          }
          while (node < this.visitedSize) {
            node = this.visitedTree[node * 2 + 1] >= 0 ? node * 2 + 1 : node * 2;
          }
          return node - this.visitedSize;
        }
        for (let t = this.leftCount - 1; t >= 0; t--) {
          /** @type {int32} */
          let node = this.leftNodes[t];
          if (this.visitedTree[node] < 0) {
            continue;
          }
          while (node < this.visitedSize) {
            node = this.visitedTree[node * 2 + 1] >= 0 ? node * 2 + 1 : node * 2;
          }
          return node - this.visitedSize;
        }
        return -1;
      }

      /**
       * Nearest visited rank at or above lo, or -1 when there is none.
       * @param {int32} lo - Lowest rank considered
       * @returns {int32} Rank or -1
       */
      firstVisited(lo) {
        if (lo > this.n - 1) {
          return -1;
        }
        this.cover(this.visitedSize, lo, this.n - 1);
        for (let t = 0; t < this.leftCount; t++) {
          /** @type {int32} */
          let node = this.leftNodes[t];
          if (this.visitedTree[node] < 0) {
            continue;
          }
          while (node < this.visitedSize) {
            node = this.visitedTree[node * 2] >= 0 ? node * 2 : node * 2 + 1;
          }
          return node - this.visitedSize;
        }
        for (let t = this.rightCount - 1; t >= 0; t--) {
          /** @type {int32} */
          let node = this.rightNodes[t];
          if (this.visitedTree[node] < 0) {
            continue;
          }
          while (node < this.visitedSize) {
            node = this.visitedTree[node * 2] >= 0 ? node * 2 : node * 2 + 1;
          }
          return node - this.visitedSize;
        }
        return -1;
      }

      /**
       * @param {int32} lo - First rank
       * @param {int32} hi - Last rank
       * @returns {int32} Largest visited position in the rank range, or -1
       */
      mostRecentVisited(lo, hi) {
        this.cover(this.visitedSize, lo, hi);
        /** @type {int32} */
        let best = -1;
        for (let t = 0; t < this.leftCount; t++) {
          if (this.visitedTree[this.leftNodes[t]] > best) {
            best = this.visitedTree[this.leftNodes[t]];
          }
        }
        for (let t = 0; t < this.rightCount; t++) {
          if (this.visitedTree[this.rightNodes[t]] > best) {
            best = this.visitedTree[this.rightNodes[t]];
          }
        }
        return best;
      }
    }

    class SuffixTreeInstance extends IAlgorithmInstance {
      /**
       * @param {SuffixTreeAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // Matches CompressionWorkbench's BB_SuffixTree
        /** @type {int32} */
        this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
        /** @type {int32} */
        this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          result = this.decompress(this.inputBuffer);
        } else {
          // Even empty input produces a fixed 4-byte header (matches the
          // C# reference, which always writes the original length).
          result = this.compress(this.inputBuffer);
        }
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      // LZ factorization over the suffix structure of the input: at every
      // visited position the longest previously-started factor is emitted as a
      // (length, offset) back-reference, and unmatched bytes are batched into
      // literal runs.
      //
      // The dictionary is the set of positions already visited by this loop.
      // Written as an explicit suffix trie, every visited position j inserts the
      // whole path data[j .. j+min(255, n-j)) and stamps every node on it with j,
      // so the query at position i resolves to
      //
      //   length_i   = min(255, n - i, max over visited j < i of LCP(j, i))
      //   position_i = the largest visited j < i with LCP(j, i) >= length_i
      //
      // Both are read straight off a suffix array here: LCP(j, i) is the minimum
      // of the LCP array between the two ranks, the maximum over a set of
      // positions is attained at the nearest visited rank on either side, and the
      // positions sharing at least length_i characters occupy one contiguous rank
      // interval whose most recent member answers the second line. That is the
      // same factorization the trie produces, in O(n log n) time and O(n) memory
      // instead of one heap object per distinct substring.
      //
      // Wire format:
      //   4 bytes original length (LE); if 0, no payload follows.
      //   0x00, count, <count raw bytes>   -- literal run (count <= 255)
      //   length (1-255), 4-byte LE offset -- back-reference match
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length header and factor stream
       */
      compress(data) {
        /** @type {int32} */
        const n = data.length;
        /** @type {uint8[]} */
        const compressed = OpCodes.Unpack32LE(n);
        if (n === 0) {
          return compressed;
        }

        /** @type {uint8[]} */
        const bytes = new Uint8Array(n);
        for (let k = 0; k < n; k++) {
          bytes[k] = data[k];
        }

        /** @type {int32[]} */
        const suffixArray = this._buildSuffixArray(bytes, n);
        /** @type {int32[]} */
        const rankOf = new Int32Array(n);
        for (let k = 0; k < n; k++) {
          rankOf[suffixArray[k]] = k;
        }

        // lcp[k] = LCP(suffix at rank k-1, suffix at rank k) for 1 <= k <= n-1.
        // Index 0 and index n are sentinels below every possible match length, so
        // the interval searches below always terminate without a bounds test.
        /** @type {int32[]} */
        const lcp = this._buildLcpArray(bytes, n, suffixArray, rankOf);

        /** @type {FactorIndex} */
        const index = new FactorIndex(lcp, n);

        /** @type {uint8[]} */
        const literalRun = [];

        /** @type {int32} */
        let i = 0;
        while (i < n) {
          /** @type {int32} */
          const rank = rankOf[i];
          /** @type {int32} */
          const cap = Math.min(this.maxMatchLength, n - i);

          /** @type {int32} */
          let matchLength = 0;
          /** @type {int32} */
          const before = index.lastVisited(rank - 1);
          if (before >= 0) {
            /** @type {int32} */
            const shared = index.lcpMin(before + 1, rank);
            if (shared > matchLength) {
              matchLength = shared;
            }
          }
          /** @type {int32} */
          const after = index.firstVisited(rank + 1);
          if (after >= 0) {
            /** @type {int32} */
            const shared = index.lcpMin(rank + 1, after);
            if (shared > matchLength) {
              matchLength = shared;
            }
          }
          if (matchLength > cap) {
            matchLength = cap;
          }

          if (matchLength >= this.minMatchLength) {
            /** @type {int32} */
            const lowRank = index.lastLcpBelow(rank, matchLength);
            /** @type {int32} */
            const highEnd = index.firstLcpBelow(rank + 1, matchLength);
            /** @type {int32} */
            const highRank = highEnd - 1;
            /** @type {int32} */
            const matchPosition = index.mostRecentVisited(lowRank, highRank);

            this._flushLiteralRun(compressed, literalRun);
            compressed.push(matchLength);
            /** @type {uint8[]} */
            const offsetBytes = OpCodes.Unpack32LE(i - matchPosition);
            for (let k = 0; k < offsetBytes.length; k++) {
              compressed.push(offsetBytes[k]);
            }
            index.markVisited(rank, i);
            i += matchLength;
          } else {
            literalRun.push(data[i]);
            index.markVisited(rank, i);
            i++;
            if (literalRun.length === 255) {
              this._flushLiteralRun(compressed, literalRun);
            }
          }
        }

        this._flushLiteralRun(compressed, literalRun);
        return compressed;
      }

      /**
       * Emit a pending literal run (0x00, count, bytes) and empty it
       * @private
       * @param {uint8[]} compressed - Output
       * @param {uint8[]} literalRun - Pending literals (emptied)
       */
      _flushLiteralRun(compressed, literalRun) {
        if (literalRun.length === 0) {
          return;
        }
        compressed.push(0);
        compressed.push(literalRun.length);
        for (let k = 0; k < literalRun.length; k++) {
          compressed.push(literalRun[k]);
        }
        literalRun.length = 0;
      }

      /**
       * @param {uint8[]} data - Length header and factor stream
       * @returns {uint8[]} Decoded bytes
       */
      decompress(data) {
        /** @type {uint32} */
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        /** @type {uint8[]} */
        const result = new Array(originalLength);
        /** @type {int32} */
        let outPos = 0;
        /** @type {int32} */
        let pos = 4;

        while (outPos < originalLength) {
          /** @type {uint8} */
          const control = data[pos++];

          if (control === 0) {
            /** @type {uint8} */
            const count = data[pos++];
            for (let k = 0; k < count; k++) {
              result[outPos++] = data[pos++];
            }
            continue;
          }

          /** @type {int32} */
          const length = control;
          /** @type {uint32} */
          const offset = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
          pos += 4;

          /** @type {int32} */
          const srcPos = outPos - offset;
          for (let k = 0; k < length; k++) {
            result[outPos + k] = result[srcPos + k];
          }
          outPos += length;
        }

        return result;
      }

      /**
       * Builds the suffix array of the input by prefix doubling with a counting
       * sort on each rank pair, which needs a handful of Int32Arrays and no
       * per-substring allocation at all. A sentinel below every byte value is
       * appended so the cyclic sort coincides with the suffix order; its own
       * entry is dropped from the result.
       * @param {uint8[]} bytes Input bytes.
       * @param {int32} n Number of input bytes.
       * @returns {int32[]} Start positions of the suffixes in lexical order.
       * @private
       */
      _buildSuffixArray(bytes, n) {
        /** @type {int32} */
        const size = n + 1;
        /** @type {int32[]} */
        const symbols = new Int32Array(size);
        for (let k = 0; k < n; k++) {
          /** @type {int32} */
          const symbol = bytes[k];
          symbols[k] = symbol + 1;
        }

        /** @type {int32[]} */
        const order = new Int32Array(size);
        /** @type {int32[]} */
        const rank = new Int32Array(size);
        /** @type {int32[]} */
        const nextRank = new Int32Array(size);
        /** @type {int32[]} */
        const shifted = new Int32Array(size);
        /** @type {int32} */
        const alphabet = 257;
        /** @type {int32[]} */
        const counts = new Int32Array(Math.max(alphabet, size) + 1);

        for (let k = 0; k < size; k++) {
          counts[symbols[k]]++;
        }
        for (let c = 1; c < alphabet; c++) {
          counts[c] += counts[c - 1];
        }
        for (let k = size - 1; k >= 0; k--) {
          order[--counts[symbols[k]]] = k;
        }

        /** @type {int32} */
        let classes = 1;
        rank[order[0]] = 0;
        for (let k = 1; k < size; k++) {
          if (symbols[order[k]] !== symbols[order[k - 1]]) {
            classes++;
          }
          rank[order[k]] = classes - 1;
        }

        for (let step = 1; classes < size; step *= 2) {
          for (let k = 0; k < size; k++) {
            /** @type {int32} */
            let start = order[k] - step;
            if (start < 0) {
              start += size;
            }
            shifted[k] = start;
          }

          for (let c = 0; c < classes; c++) {
            counts[c] = 0;
          }
          for (let k = 0; k < size; k++) {
            counts[rank[k]]++;
          }
          for (let c = 1; c < classes; c++) {
            counts[c] += counts[c - 1];
          }
          for (let k = size - 1; k >= 0; k--) {
            order[--counts[rank[shifted[k]]]] = shifted[k];
          }

          /** @type {int32} */
          let grown = 1;
          nextRank[order[0]] = 0;
          for (let k = 1; k < size; k++) {
            /** @type {int32} */
            const currentHead = rank[order[k]];
            /** @type {int32} */
            const currentTail = rank[(order[k] + step) % size];
            /** @type {int32} */
            const previousHead = rank[order[k - 1]];
            /** @type {int32} */
            const previousTail = rank[(order[k - 1] + step) % size];
            if (currentHead !== previousHead || currentTail !== previousTail) {
              grown++;
            }
            nextRank[order[k]] = grown - 1;
          }
          for (let k = 0; k < size; k++) {
            rank[k] = nextRank[k];
          }
          classes = grown;
        }

        /** @type {int32[]} */
        const suffixArray = new Int32Array(n);
        for (let k = 1; k < size; k++) {
          suffixArray[k - 1] = order[k];
        }
        return suffixArray;
      }

      /**
       * Builds the LCP array with Kasai's linear-time scan. Entry k holds the
       * longest common prefix of the suffixes at ranks k-1 and k; entries 0 and n
       * are sentinels set below any achievable match length.
       * @param {uint8[]} bytes Input bytes.
       * @param {int32} n Number of input bytes.
       * @param {int32[]} suffixArray Suffix start positions in lexical order.
       * @param {int32[]} rankOf Inverse of the suffix array.
       * @returns {int32[]} LCP values indexed by rank, length n+1.
       * @private
       */
      _buildLcpArray(bytes, n, suffixArray, rankOf) {
        /** @type {int32[]} */
        const lcp = new Int32Array(n + 1);
        lcp[0] = -1;
        lcp[n] = -1;

        /** @type {int32} */
        let shared = 0;
        for (let position = 0; position < n; position++) {
          /** @type {int32} */
          const rank = rankOf[position];
          if (rank === 0) {
            shared = 0;
            continue;
          }
          /** @type {int32} */
          const previous = suffixArray[rank - 1];
          while (position + shared < n && previous + shared < n && bytes[position + shared] === bytes[previous + shared]) {
            shared++;
          }
          lcp[rank] = shared;
          if (shared > 0) {
            shared--;
          }
        }

        return lcp;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new SuffixTreeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SuffixTreeAlgorithm, SuffixTreeInstance };
}));