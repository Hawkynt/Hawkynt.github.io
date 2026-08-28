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
        this.MIN_MATCH_LENGTH = 3;      // Minimum substring length for compression
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

      CreateInstance(isInverse = false) {
        return new SuffixTreeInstance(this, isInverse);
      }
    }

    class SuffixTreeInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Matches CompressionWorkbench's BB_SuffixTree
        this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
        this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      }


      Result() {
        if (this.isInverse) {
          const result = this.decompress(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }

        // Even empty input produces a fixed 4-byte header (matches the
        // C# reference, which always writes the original length).
        const result = this.compress(this.inputBuffer);
        this.inputBuffer = [];
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
      compress(data) {
        const n = data.length;
        const compressed = OpCodes.Unpack32LE(n);
        if (n === 0) return compressed;

        const bytes = new Uint8Array(n);
        for (let k = 0; k < n; k++) bytes[k] = data[k];

        const suffixArray = this._buildSuffixArray(bytes, n);
        const rankOf = new Int32Array(n);
        for (let k = 0; k < n; k++) rankOf[suffixArray[k]] = k;

        // lcp[k] = LCP(suffix at rank k-1, suffix at rank k) for 1 <= k <= n-1.
        // Index 0 and index n are sentinels below every possible match length, so
        // the interval searches below always terminate without a bounds test.
        const lcp = this._buildLcpArray(bytes, n, suffixArray, rankOf);

        const INFINITE = 0x7fffffff;

        let lcpSize = 1;
        while (lcpSize < n + 1) lcpSize *= 2;
        const lcpTree = new Int32Array(lcpSize * 2).fill(INFINITE);
        for (let k = 0; k <= n; k++) lcpTree[lcpSize + k] = lcp[k];
        for (let k = lcpSize - 1; k >= 1; k--)
          lcpTree[k] = Math.min(lcpTree[k * 2], lcpTree[k * 2 + 1]);

        // Visited positions keyed by rank; -1 marks a rank not yet reached.
        // Aggregated by maximum, so a range query yields the most recent visit.
        let visitedSize = 1;
        while (visitedSize < n) visitedSize *= 2;
        const visitedTree = new Int32Array(visitedSize * 2).fill(-1);

        // Canonical cover of a query range, reused so queries never allocate.
        const leftNodes = new Int32Array(64);
        const rightNodes = new Int32Array(64);
        let leftCount = 0;
        let rightCount = 0;

        const cover = (size, lo, hi) => {
          let left = size + lo;
          let right = size + hi + 1;
          leftCount = 0;
          rightCount = 0;
          while (left < right) {
            if (left % 2 === 1) { leftNodes[leftCount++] = left; left++; }
            if (right % 2 === 1) { right--; rightNodes[rightCount++] = right; }
            left = Math.floor(left / 2);
            right = Math.floor(right / 2);
          }
        };

        const lcpMin = (lo, hi) => {
          if (lo > hi) return INFINITE;
          cover(lcpSize, lo, hi);
          let best = INFINITE;
          for (let t = 0; t < leftCount; t++) if (lcpTree[leftNodes[t]] < best) best = lcpTree[leftNodes[t]];
          for (let t = 0; t < rightCount; t++) if (lcpTree[rightNodes[t]] < best) best = lcpTree[rightNodes[t]];
          return best;
        };

        // Rightmost index in [0, hi] whose LCP entry is below limit.
        const lastLcpBelow = (hi, limit) => {
          cover(lcpSize, 0, hi);
          for (let t = 0; t < rightCount; t++) {
            let node = rightNodes[t];
            if (lcpTree[node] >= limit) continue;
            while (node < lcpSize) node = lcpTree[node * 2 + 1] < limit ? node * 2 + 1 : node * 2;
            return node - lcpSize;
          }
          for (let t = leftCount - 1; t >= 0; t--) {
            let node = leftNodes[t];
            if (lcpTree[node] >= limit) continue;
            while (node < lcpSize) node = lcpTree[node * 2 + 1] < limit ? node * 2 + 1 : node * 2;
            return node - lcpSize;
          }
          return 0;
        };

        // Leftmost index in [lo, n] whose LCP entry is below limit.
        const firstLcpBelow = (lo, limit) => {
          cover(lcpSize, lo, n);
          for (let t = 0; t < leftCount; t++) {
            let node = leftNodes[t];
            if (lcpTree[node] >= limit) continue;
            while (node < lcpSize) node = lcpTree[node * 2] < limit ? node * 2 : node * 2 + 1;
            return node - lcpSize;
          }
          for (let t = rightCount - 1; t >= 0; t--) {
            let node = rightNodes[t];
            if (lcpTree[node] >= limit) continue;
            while (node < lcpSize) node = lcpTree[node * 2] < limit ? node * 2 : node * 2 + 1;
            return node - lcpSize;
          }
          return n;
        };

        const markVisited = (rankIndex, position) => {
          let node = visitedSize + rankIndex;
          visitedTree[node] = position;
          node = Math.floor(node / 2);
          while (node >= 1) {
            const a = visitedTree[node * 2];
            const b = visitedTree[node * 2 + 1];
            visitedTree[node] = a > b ? a : b;
            node = Math.floor(node / 2);
          }
        };

        // Nearest visited rank strictly below hi+1, or -1 when there is none.
        const lastVisited = (hi) => {
          if (hi < 0) return -1;
          cover(visitedSize, 0, hi);
          for (let t = 0; t < rightCount; t++) {
            let node = rightNodes[t];
            if (visitedTree[node] < 0) continue;
            while (node < visitedSize) node = visitedTree[node * 2 + 1] >= 0 ? node * 2 + 1 : node * 2;
            return node - visitedSize;
          }
          for (let t = leftCount - 1; t >= 0; t--) {
            let node = leftNodes[t];
            if (visitedTree[node] < 0) continue;
            while (node < visitedSize) node = visitedTree[node * 2 + 1] >= 0 ? node * 2 + 1 : node * 2;
            return node - visitedSize;
          }
          return -1;
        };

        // Nearest visited rank at or above lo, or -1 when there is none.
        const firstVisited = (lo) => {
          if (lo > n - 1) return -1;
          cover(visitedSize, lo, n - 1);
          for (let t = 0; t < leftCount; t++) {
            let node = leftNodes[t];
            if (visitedTree[node] < 0) continue;
            while (node < visitedSize) node = visitedTree[node * 2] >= 0 ? node * 2 : node * 2 + 1;
            return node - visitedSize;
          }
          for (let t = rightCount - 1; t >= 0; t--) {
            let node = rightNodes[t];
            if (visitedTree[node] < 0) continue;
            while (node < visitedSize) node = visitedTree[node * 2] >= 0 ? node * 2 : node * 2 + 1;
            return node - visitedSize;
          }
          return -1;
        };

        const mostRecentVisited = (lo, hi) => {
          cover(visitedSize, lo, hi);
          let best = -1;
          for (let t = 0; t < leftCount; t++) if (visitedTree[leftNodes[t]] > best) best = visitedTree[leftNodes[t]];
          for (let t = 0; t < rightCount; t++) if (visitedTree[rightNodes[t]] > best) best = visitedTree[rightNodes[t]];
          return best;
        };

        let literalRun = [];

        const flushLiteralRun = () => {
          if (literalRun.length === 0) return;
          compressed.push(0, literalRun.length);
          for (let _i = 0; _i < literalRun.length; _i++) compressed.push(literalRun[_i]);
          literalRun = [];
        };

        let i = 0;
        while (i < n) {
          const rank = rankOf[i];
          const cap = Math.min(this.maxMatchLength, n - i);

          let matchLength = 0;
          const before = lastVisited(rank - 1);
          if (before >= 0) {
            const shared = lcpMin(before + 1, rank);
            if (shared > matchLength) matchLength = shared;
          }
          const after = firstVisited(rank + 1);
          if (after >= 0) {
            const shared = lcpMin(rank + 1, after);
            if (shared > matchLength) matchLength = shared;
          }
          if (matchLength > cap) matchLength = cap;

          if (matchLength >= this.minMatchLength) {
            const lowRank = lastLcpBelow(rank, matchLength);
            const highRank = firstLcpBelow(rank + 1, matchLength) - 1;
            const matchPosition = mostRecentVisited(lowRank, highRank);

            flushLiteralRun();
            compressed.push(matchLength);
            { const _src = OpCodes.Unpack32LE(i - matchPosition); for (let _i = 0; _i < _src.length; _i++) compressed.push(_src[_i]); }
            markVisited(rank, i);
            i += matchLength;
          } else {
            literalRun.push(data[i]);
            markVisited(rank, i);
            i++;
            if (literalRun.length === 255) flushLiteralRun();
          }
        }

        flushLiteralRun();
        return compressed;
      }

      decompress(data) {
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) return [];

        const result = new Array(originalLength);
        let outPos = 0;
        let pos = 4;

        while (outPos < originalLength) {
          const control = data[pos++];

          if (control === 0) {
            const count = data[pos++];
            for (let k = 0; k < count; k++)
              result[outPos++] = data[pos++];
            continue;
          }

          const length = control;
          const offset = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
          pos += 4;

          const srcPos = outPos - offset;
          for (let k = 0; k < length; k++)
            result[outPos + k] = result[srcPos + k];
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
       * @param {Uint8Array} bytes Input bytes.
       * @param {number} n Number of input bytes.
       * @returns {Int32Array} Start positions of the suffixes in lexical order.
       * @private
       */
      _buildSuffixArray(bytes, n) {
        const size = n + 1;
        const symbols = new Int32Array(size);
        for (let k = 0; k < n; k++) symbols[k] = bytes[k] + 1;

        const order = new Int32Array(size);
        const rank = new Int32Array(size);
        const nextRank = new Int32Array(size);
        const shifted = new Int32Array(size);
        const alphabet = 257;
        const counts = new Int32Array(Math.max(alphabet, size) + 1);

        for (let k = 0; k < size; k++) counts[symbols[k]]++;
        for (let c = 1; c < alphabet; c++) counts[c] += counts[c - 1];
        for (let k = size - 1; k >= 0; k--) order[--counts[symbols[k]]] = k;

        let classes = 1;
        rank[order[0]] = 0;
        for (let k = 1; k < size; k++) {
          if (symbols[order[k]] !== symbols[order[k - 1]]) classes++;
          rank[order[k]] = classes - 1;
        }

        for (let step = 1; classes < size; step *= 2) {
          for (let k = 0; k < size; k++) {
            let start = order[k] - step;
            if (start < 0) start += size;
            shifted[k] = start;
          }

          counts.fill(0, 0, classes);
          for (let k = 0; k < size; k++) counts[rank[k]]++;
          for (let c = 1; c < classes; c++) counts[c] += counts[c - 1];
          for (let k = size - 1; k >= 0; k--) order[--counts[rank[shifted[k]]]] = shifted[k];

          let grown = 1;
          nextRank[order[0]] = 0;
          for (let k = 1; k < size; k++) {
            const currentHead = rank[order[k]];
            const currentTail = rank[(order[k] + step) % size];
            const previousHead = rank[order[k - 1]];
            const previousTail = rank[(order[k - 1] + step) % size];
            if (currentHead !== previousHead || currentTail !== previousTail) grown++;
            nextRank[order[k]] = grown - 1;
          }
          rank.set(nextRank);
          classes = grown;
        }

        const suffixArray = new Int32Array(n);
        for (let k = 1; k < size; k++) suffixArray[k - 1] = order[k];
        return suffixArray;
      }

      /**
       * Builds the LCP array with Kasai's linear-time scan. Entry k holds the
       * longest common prefix of the suffixes at ranks k-1 and k; entries 0 and n
       * are sentinels set below any achievable match length.
       * @param {Uint8Array} bytes Input bytes.
       * @param {number} n Number of input bytes.
       * @param {Int32Array} suffixArray Suffix start positions in lexical order.
       * @param {Int32Array} rankOf Inverse of the suffix array.
       * @returns {Int32Array} LCP values indexed by rank, length n+1.
       * @private
       */
      _buildLcpArray(bytes, n, suffixArray, rankOf) {
        const lcp = new Int32Array(n + 1);
        lcp[0] = -1;
        lcp[n] = -1;

        let shared = 0;
        for (let position = 0; position < n; position++) {
          const rank = rankOf[position];
          if (rank === 0) { shared = 0; continue; }
          const previous = suffixArray[rank - 1];
          while (position + shared < n && previous + shared < n && bytes[position + shared] === bytes[previous + shared])
            shared++;
          lcp[rank] = shared;
          if (shared > 0) shared--;
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