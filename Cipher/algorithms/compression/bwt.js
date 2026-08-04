/*
 * BWT (Burrows-Wheeler Transform) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Burrows-Wheeler Transform is a reversible data transformation that
 * rearranges string characters to improve the performance of other compression techniques.
 */


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

  // ----- Sentinel-free, cyclic-rotation-sort BWT core -----
  //
  // Wire format and algorithm match CompressionWorkbench's BB_Bwt block
  // (Compression.Core.Transforms.BurrowsWheelerTransform) exactly, including
  // its tie-breaking behavior - the authoritative reference this is
  // byte-identical to. Unlike a sentinel-terminated BWT, this sorts the n
  // CYCLIC ROTATIONS of the data directly (all rotations have equal length,
  // so no sentinel is needed to make comparisons well-defined; ties are
  // broken by continuing the cyclic comparison, i.e. wrapping around
  // modulo n). The primary index is the row, in sorted rotation order,
  // whose rotation starts at position 0.
  //
  // Sorting proceeds by prefix doubling: a first counting-sort pass ranks
  // rotations by their first 2 bytes (cyclically), then each further pass
  // doubles the compared prefix length using the previous pass's ranks.
  // Crucially, for any pass beyond the first, ties within a rank class are
  // broken by directly reproducing .NET's Array.Sort(int[], Comparison<int>)
  // - an UNSTABLE introspective sort (insertion sort / quicksort with
  // median-of-3 pivoting / heapsort fallback) - via a faithful port below.
  // Because that sort is not stable, an equivalent but differently-shaped
  // sort (e.g. a stable radix pass) would silently diverge from the
  // reference on any input with repeated substrings, which is most real
  // data; this is why the exact port is required, not just "a" correct sort.

  function _bwtSwap(arr, i, j) {
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }

  function _bwtSwapIfGreater(arr, cmp, i, j) {
    if (i !== j && cmp(arr[i], arr[j]) > 0) _bwtSwap(arr, i, j);
  }

  function _bwtInsertionSort(arr, lo, hi, cmp) {
    for (let i = lo; i < hi; i++) {
      let j = i;
      const t = arr[i + 1];
      while (j >= lo && cmp(t, arr[j]) < 0) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = t;
    }
  }

  function _bwtDownHeap(arr, i, n, lo, cmp) {
    const d = arr[lo + i - 1];
    let child;
    while (i <= Math.floor(n / 2)) {
      child = 2 * i;
      if (child < n && cmp(arr[lo + child - 1], arr[lo + child]) < 0) child++;
      if (!(cmp(d, arr[lo + child - 1]) < 0)) break;
      arr[lo + i - 1] = arr[lo + child - 1];
      i = child;
    }
    arr[lo + i - 1] = d;
  }

  function _bwtHeapSort(arr, lo, hi, cmp) {
    const n = hi - lo + 1;
    for (let i = Math.floor(n / 2); i >= 1; i--) _bwtDownHeap(arr, i, n, lo, cmp);
    for (let i = n; i > 1; i--) {
      _bwtSwap(arr, lo, lo + i - 1);
      _bwtDownHeap(arr, 1, i - 1, lo, cmp);
    }
  }

  function _bwtPickPivotAndPartition(arr, lo, hi, cmp) {
    const mid = lo + Math.floor((hi - lo) / 2);

    _bwtSwapIfGreater(arr, cmp, lo, mid);
    _bwtSwapIfGreater(arr, cmp, lo, hi);
    _bwtSwapIfGreater(arr, cmp, mid, hi);

    const pivot = arr[mid];
    _bwtSwap(arr, mid, hi - 1);
    let left = lo, right = hi - 1;

    while (left < right) {
      do { left++; } while (cmp(arr[left], pivot) < 0);
      do { right--; } while (cmp(pivot, arr[right]) < 0);

      if (left >= right) break;
      _bwtSwap(arr, left, right);
    }

    _bwtSwap(arr, left, hi - 1);
    return left;
  }

  function _bwtIntroSort(arr, lo, hi, depthLimit, cmp) {
    while (hi > lo) {
      const partitionSize = hi - lo + 1;
      if (partitionSize <= 16) {
        if (partitionSize === 1) return;
        if (partitionSize === 2) { _bwtSwapIfGreater(arr, cmp, lo, hi); return; }
        if (partitionSize === 3) {
          _bwtSwapIfGreater(arr, cmp, lo, hi - 1);
          _bwtSwapIfGreater(arr, cmp, lo, hi);
          _bwtSwapIfGreater(arr, cmp, hi - 1, hi);
          return;
        }
        _bwtInsertionSort(arr, lo, hi, cmp);
        return;
      }

      if (depthLimit === 0) {
        _bwtHeapSort(arr, lo, hi, cmp);
        return;
      }
      depthLimit--;

      const p = _bwtPickPivotAndPartition(arr, lo, hi, cmp);
      _bwtIntroSort(arr, p + 1, hi, depthLimit, cmp);
      hi = p - 1;
    }
  }

  function _bwtFloorLog2(n) {
    let r = 0, v = n;
    while (v > 1) { v = Math.floor(v / 2); r++; }
    return r;
  }

  // Faithful port of System.Array.Sort(T[], Comparison<T>) - .NET's
  // introspective sort. Required (not just "a" correct sort) because it is
  // unstable, and its specific tie-breaking behavior on repeated rotations
  // is part of what CompressionWorkbench's BWT output byte-for-byte depends
  // on for any input with repeated substrings.
  function _bwtIntrospectiveSort(arr, cmp) {
    const n = arr.length;
    if (n > 1) _bwtIntroSort(arr, 0, n - 1, 2 * (_bwtFloorLog2(n) + 1), cmp);
  }

  // Sorts the n cyclic rotations of data via prefix-doubling, returning the
  // rotation start positions in sorted order. Matches CompressionWorkbench's
  // BurrowsWheelerTransform.BuildRotationSort exactly.
  function _buildRotationSort(data, length) {
    const sa = new Array(length);
    const rank = new Array(length);
    const tmp = new Array(length);

    for (let i = 0; i < length; i++) { sa[i] = i; rank[i] = data[i]; }

    // First pass (gap=1): forward-stable counting sort on the 16-bit key
    // (data[i], data[(i+1) % length]), avoiding a comparison sort for the
    // common case where most rotations already differ in their first 2 bytes.
    {
      const bucketCounts = new Array(65536).fill(0);
      for (let i = 0; i < length; i++) {
        const key = OpCodes.Or32(OpCodes.Shl32(data[i], 8), data[(i + 1) % length]);
        bucketCounts[key]++;
      }
      let running = 0;
      for (let i = 0; i < 65536; i++) { const c = bucketCounts[i]; bucketCounts[i] = running; running += c; }
      for (let i = 0; i < length; i++) {
        const key = OpCodes.Or32(OpCodes.Shl32(data[i], 8), data[(i + 1) % length]);
        sa[bucketCounts[key]++] = i;
      }

      tmp[sa[0]] = 0;
      for (let i = 1; i < length; i++) {
        tmp[sa[i]] = tmp[sa[i - 1]];
        const prevSecond = data[(sa[i - 1] + 1) % length];
        const curSecond = data[(sa[i] + 1) % length];
        if (data[sa[i]] !== data[sa[i - 1]] || curSecond !== prevSecond) tmp[sa[i]]++;
      }
      for (let i = 0; i < length; i++) rank[i] = tmp[i];

      if (rank[sa[length - 1]] === length - 1) return sa;
    }

    // Subsequent passes: prefix-doubling with .NET's introspective sort as
    // the comparator-based tie-breaker.
    for (let gap = 2; gap < length; gap *= 2) {
      const g = gap, len = length, r = rank;
      _bwtIntrospectiveSort(sa, (a, b) => {
        if (r[a] !== r[b]) return r[a] - r[b];
        return r[(a + g) % len] - r[(b + g) % len];
      });

      tmp[sa[0]] = 0;
      for (let i = 1; i < length; i++) {
        tmp[sa[i]] = tmp[sa[i - 1]];
        const prevSecond = rank[(sa[i - 1] + g) % length];
        const curSecond = rank[(sa[i] + g) % length];
        if (rank[sa[i]] !== rank[sa[i - 1]] || curSecond !== prevSecond) tmp[sa[i]]++;
      }
      for (let i = 0; i < length; i++) rank[i] = tmp[i];

      if (rank[sa[length - 1]] === length - 1) break;
    }

    return sa;
  }

  // Forward BWT: returns the transformed (last-column) bytes and the primary
  // index (the row, in sorted rotation order, starting at position 0).
  function bwtEncode(data) {
    const n = data.length;
    if (n === 0) return { primaryIndex: 0, transformed: [] };

    const sa = _buildRotationSort(data, n);
    const transformed = new Array(n);
    let primaryIndex = 0;

    for (let i = 0; i < n; i++) {
      const pos = sa[i];
      if (pos === 0) { primaryIndex = i; transformed[i] = data[n - 1]; }
      else transformed[i] = data[pos - 1];
    }

    return { primaryIndex, transformed };
  }

  // Inverse BWT via LF-mapping reconstruction.
  function bwtDecode(transformed, primaryIndex) {
    const n = transformed.length;
    if (n === 0) return [];

    const count = new Array(256).fill(0);
    for (let i = 0; i < n; i++) count[transformed[i]]++;

    const cumulative = new Array(256).fill(0);
    let sum = 0;
    for (let c = 0; c < 256; c++) { cumulative[c] = sum; sum += count[c]; }

    const lfMap = new Array(n);
    const tempCount = cumulative.slice();
    for (let i = 0; i < n; i++) {
      lfMap[i] = tempCount[transformed[i]];
      tempCount[transformed[i]]++;
    }

    const result = new Array(n);
    let idx = primaryIndex;
    for (let i = n - 1; i >= 0; i--) {
      result[i] = transformed[idx];
      idx = lfMap[idx];
    }

    return result;
  }

  /**
 * BWTCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class BWTCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "BWT (Burrows-Wheeler Transform)";
        this.description = "Reversible data transformation that rearranges string characters to improve performance of other compression techniques. Used as preprocessing step in bzip2 and other advanced compressors.";
        this.inventor = "Michael Burrows, David Wheeler";
        this.year = 1994;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Transform";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Burrows-Wheeler Transform - Wikipedia", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"),
          new LinkItem("Original BWT Paper", "https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf"),
          new LinkItem("bzip2 Algorithm", "https://sourceware.org/bzip2/")
        ];

        this.references = [
          new LinkItem("bzip2 Implementation", "https://sourceware.org/bzip2/downloads.html"),
          new LinkItem("Educational BWT Tutorial", "https://web.stanford.edu/class/cs262/notes/lecture12.pdf"),
          new LinkItem("CompressionWorkbench BurrowsWheelerTransform (reference implementation)", "https://github.com/Hawkynt")
        ];

        // Test vectors verified against CompressionWorkbench's BB_Bwt
        // (BurrowsWheelerTransform.Forward/BwtBuildingBlock.Compress), the
        // authoritative reference this wire format and tie-breaking behavior
        // is byte-identical to. Format: [primary_index(4 bytes LE)][last
        // column (n bytes)] - no sentinel byte is stored or reserved.
        this.tests = [
          {
            text: "Empty data test - still emits the 4-byte primary-index header",
            uri: "Edge case test",
            input: [],
            expected: [0, 0, 0, 0]
          },
          {
            text: "Single byte test",
            uri: "Minimal transformation test",
            input: [65], // "A"
            expected: [0, 0, 0, 0, 65]
          },
          {
            text: "Regression: all 256 byte values",
            uri: "Regression test for sentinel-free cyclic rotation sort",
            input: Array.from({length: 256}, (_, i) => i),
            expected: [0, 0, 0, 0, 255].concat(Array.from({length: 255}, (_, i) => i))
          },
          {
            text: "Regression: pseudo-random data, length 91 - exercises the gap-doubling tie-break passes",
            uri: "Regression test - non-repeating pseudo-random input",
            input: [0,0,64,0,64,0,64,0,64,0,57,128,192,0,0,0,64,128,0,64,0,64,0,0,0,64,0,0,0,0,64,0,0,64,0,0,64,0,0,64,128,0,0,57,128,0,0,0,0,64,0,0,0,64,0,0,0,64,128,128,0,0,64,0,64,0,0,0,64,0,0,0,0,0,0,0,64,128,184,128,192,0,64,128,0,0,0,64,0,0,64],
            expected: [26,0,0,0,64,0,0,128,64,0,64,64,0,64,0,128,192,64,0,128,0,0,0,0,0,0,64,64,64,128,64,64,0,0,0,0,64,0,0,64,64,0,0,0,0,0,0,0,64,0,128,64,64,0,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,57,64,64,128,64,64,64,57,184,128,128,128]
          },
          {
            text: "Regression: alternating pattern, length 83 - heavily tied rotations, exercises the unstable-sort tie-break",
            uri: "Regression test - repetitive alternating input",
            input: Array.from({length: 83}, (_, i) => (i % 2 ? 0x62 : 0x61)),
            expected: [41,0,0,0,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new BWTInstance(this, isInverse);
      }
    }

    class BWTInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const output = this.isInverse ? this._decompress() : this._compress();
        this.inputBuffer = [];
        return output;
      }

      _compress() {
        const data = this.inputBuffer.slice();
        const { primaryIndex, transformed } = bwtEncode(data);

        // Output: [primary_index(4 bytes LE)][transformed data(n bytes)] -
        // emitted even for empty input, matching CompressionWorkbench.
        const result = OpCodes.Unpack32LE(primaryIndex);
        for (let i = 0; i < transformed.length; i++) result.push(transformed[i]);

        return result;
      }

      _decompress() {
        if (this.inputBuffer.length < 4) {
          return [];
        }

        const primaryIndex = OpCodes.Pack32LE(
          this.inputBuffer[0],
          this.inputBuffer[1],
          this.inputBuffer[2],
          this.inputBuffer[3]
        );

        const transformed = this.inputBuffer.slice(4);

        return bwtDecode(transformed, primaryIndex);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new BWTCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BWTCompression, BWTInstance };
}));
