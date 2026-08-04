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

  // ----- Correct, O(n log n) suffix-array based Burrows-Wheeler core -----
  //
  // The transform is defined over T = data ++ [sentinel], where sentinel is
  // a value strictly smaller than every real byte and occurs exactly once.
  // Sorting the m = n+1 CYCLIC ROTATIONS of T (equivalently, since the
  // sentinel is unique and minimal, sorting the SUFFIXES of T) gives the
  // BWT rotation matrix. The row whose rotation starts at position 0 (the
  // unrotated original T) is the "primary index"; earlier implementations
  // in this file computed that index against one sort order while badly
  // reconstructing the inverse permutation with a different, buggy
  // hand-rolled "next array" - this replaces both with a single
  // well-tested core shared by forward and inverse transforms.
  //
  // A convenient structural fact is used to avoid ever materializing the
  // sentinel as a byte: the sentinel appears in the last column L at
  // EXACTLY the row equal to the primary index (because L[i] is the
  // character preceding rotation start sa[i], and that is the sentinel
  // precisely when sa[i] === 0). So the sentinel's row can be omitted from
  // the serialized last column entirely and reinserted purely from the
  // stored primary index on decode - keeping the wire format at exactly
  // n+4 bytes (4-byte primary index + n real data bytes), with no marker
  // byte collisions of the kind that broke this file's previous encoding.

  function _countingSortByKey(arr, key, keyRange) {
    const count = new Array(keyRange).fill(0);
    for (let i = 0; i < arr.length; i++) count[key[arr[i]]]++;
    for (let i = 1; i < keyRange; i++) count[i] += count[i - 1];
    const output = new Array(arr.length);
    for (let i = arr.length - 1; i >= 0; i--) {
      const k = key[arr[i]];
      count[k]--;
      output[count[k]] = arr[i];
    }
    return output;
  }

  // Suffix array (equivalently: sorted cyclic rotations) of data++[sentinel],
  // computed via prefix doubling with counting sort - O(n log n) overall.
  function _buildRotationSuffixArray(data) {
    const n = data.length;
    const m = n + 1;
    if (m === 1) return [0];

    let rank = new Array(m);
    for (let i = 0; i < n; i++) rank[i] = data[i] + 1; // real bytes: 1..256
    rank[n] = 0; // sentinel: uniquely smallest

    let sa = new Array(m);
    for (let i = 0; i < m; i++) sa[i] = i;
    sa = _countingSortByKey(sa, rank, 257);

    let cls = new Array(m);
    cls[sa[0]] = 0;
    for (let i = 1; i < m; i++) cls[sa[i]] = cls[sa[i - 1]] + (rank[sa[i]] !== rank[sa[i - 1]] ? 1 : 0);
    let classCount = cls[sa[m - 1]] + 1;

    for (let k = 1; classCount < m; k *= 2) {
      const key2 = new Array(m);
      for (let i = 0; i < m; i++) key2[i] = cls[(i + k) % m];

      sa = _countingSortByKey(sa, key2, classCount);
      sa = _countingSortByKey(sa, cls, classCount);

      const newCls = new Array(m);
      newCls[sa[0]] = 0;
      for (let i = 1; i < m; i++) {
        const prev = sa[i - 1], cur = sa[i];
        const same = cls[prev] === cls[cur] && key2[prev] === key2[cur];
        newCls[cur] = newCls[prev] + (same ? 0 : 1);
      }
      cls = newCls;
      classCount = cls[sa[m - 1]] + 1;
      if (classCount === m) break;
    }

    return sa;
  }

  function bwtEncode(data) {
    const n = data.length;
    if (n === 0) return { primaryIndex: 0, lastColumn: [] };
    const m = n + 1;
    const sa = _buildRotationSuffixArray(data);

    let primaryIndex = -1;
    const lastColumn = [];
    for (let i = 0; i < m; i++) {
      const pos = sa[i];
      if (pos === 0) { primaryIndex = i; continue; } // sentinel row, omitted
      lastColumn.push(data[pos - 1]);
    }
    return { primaryIndex, lastColumn };
  }

  function bwtDecode(primaryIndex, lastColumn) {
    const n = lastColumn.length;
    if (n === 0) return [];
    const m = n + 1;

    // Reinsert the sentinel (symbol 0) at row=primaryIndex; real bytes use
    // symbol domain 1..256 so the sentinel remains uniquely smallest.
    const fullL = new Array(m);
    for (let i = 0, j = 0; i < m; i++) {
      fullL[i] = (i === primaryIndex) ? 0 : (lastColumn[j++] + 1);
    }

    const count = new Array(257).fill(0);
    for (let i = 0; i < m; i++) count[fullL[i]]++;
    const C = new Array(257).fill(0);
    let sum = 0;
    for (let s = 0; s < 257; s++) { C[s] = sum; sum += count[s]; }

    const occRank = new Array(257).fill(0);
    const T = new Array(m);
    for (let i = 0; i < m; i++) {
      const s = fullL[i];
      T[i] = C[s] + occRank[s];
      occRank[s]++;
    }

    const original = new Array(m);
    let p = primaryIndex;
    for (let i = m - 1; i >= 0; i--) {
      original[i] = fullL[p];
      p = T[p];
    }

    // Strip the sentinel (symbol 0) and shift real bytes back down by 1.
    const result = new Array(n);
    let k = 0;
    for (let i = 0; i < m; i++) {
      if (original[i] !== 0) result[k++] = original[i] - 1;
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
          new LinkItem("Suffix Arrays for BWT", "https://web.stanford.edu/class/cs166/lectures/04/Small04.pdf")
        ];

        // Test vectors - round-trip tests. Format: [primary_index(4 bytes
        // BE)][last_column(n bytes)]. The primary index also identifies the
        // one omitted sentinel row (see the core algorithm comment above).
        this.tests = [
          {
            text: "Empty data test",
            uri: "Edge case test",
            input: [],
            expected: [] // Empty input produces empty output
          },
          {
            text: "Single byte test",
            uri: "Minimal transformation test",
            input: [65], // "A"
            expected: [0,0,0,1,65] // BWT output: [position, transformed_data]
          },
          {
            text: "Regression: all 256 byte values",
            uri: "Regression test for primary-index / sentinel-row reconstruction bug",
            input: Array.from({length: 256}, (_, i) => i),
            expected: [0,0,0,1,255].concat(Array.from({length: 255}, (_, i) => i))
          },
          {
            text: "Regression: pseudo-random data, length 91",
            uri: "Regression test - non-repeating pseudo-random input",
            input: [0,0,64,0,64,0,64,0,64,0,57,128,192,0,0,0,64,128,0,64,0,64,0,0,0,64,0,0,0,0,64,0,0,64,0,0,64,0,0,64,128,0,0,57,128,0,0,0,0,64,0,0,0,64,0,0,0,64,128,128,0,0,64,0,64,0,0,0,64,0,0,0,0,0,0,0,64,128,184,128,192,0,64,128,0,0,0,64,0,0,64],
            expected: [0,0,0,27,64,64,0,0,128,64,0,64,64,0,64,128,0,192,64,0,128,64,0,0,0,0,0,0,64,64,128,64,0,0,0,0,64,0,0,0,64,64,0,0,0,0,0,0,64,0,128,64,64,0,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,57,64,64,128,64,64,64,57,184,128,128,128]
          },
          {
            text: "Regression: alternating pattern, length 83",
            uri: "Regression test - repetitive alternating input",
            input: Array.from({length: 83}, (_, i) => (i % 2 ? 0x62 : 0x61)),
            expected: [0,0,0,42,97,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97,97]
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
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        const data = this.inputBuffer.slice();
        const { primaryIndex, lastColumn } = bwtEncode(data);

        // Output: [primary_index(4 bytes BE)][last_column(n bytes)]
        const result = OpCodes.Unpack32BE(primaryIndex);
        for (let i = 0; i < lastColumn.length; i++) result.push(lastColumn[i]);

        this.inputBuffer = [];
        return result;
      }

      _decompress() {
        if (this.inputBuffer.length < 4) {
          this.inputBuffer = [];
          return [];
        }

        const originalPosition = OpCodes.Pack32BE(
          this.inputBuffer[0],
          this.inputBuffer[1],
          this.inputBuffer[2],
          this.inputBuffer[3]
        );

        const lastColumn = this.inputBuffer.slice(4);

        const result = bwtDecode(originalPosition, lastColumn);

        this.inputBuffer = [];
        return result;
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