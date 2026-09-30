/*
 * BZIP2 Compression Algorithm - Production Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Full production-quality implementation of the BZIP2 compression algorithm.
 * Based on the original specification by Julian Seward and reference implementations
 * from Bouncy Castle, Go standard library, and other verified sources.
 *
 * Algorithm chain: RLE1 -> BWT -> MTF -> RLE2 -> Huffman Coding
 *
 * This is a COMPLETE implementation suitable for production use, not an educational simplification.
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
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== BZIP2 CONSTANTS =====

  const BZ_BASE_BLOCK_SIZE = 100000;
  const BZ_MAX_CODE_LEN = 20;
  const BZ_RUNA = 0;
  const BZ_RUNB = 1;
  const BZ_G_SIZE = 50;

  // Magic numbers (48-bit, exact in double precision)
  /** @type {float64} */
  const BZ_BLOCK_HEADER_MAGIC = 0x314159265359; // π
  /** @type {float64} */
  const BZ_STREAM_END_MAGIC = 0x177245385090;   // √π

  // File format
  const BZ_MAGIC = 0x425A;  // 'BZ'
  const BZ_VERSION = 0x68;  // 'h'

  /**
   * Lower-case hexadecimal digits of a non-negative integer, as toString(16)
   * spells them.
   * @param {float64} value - Non-negative integer below 2^53
   * @returns {string} Hex digits without prefix or padding
   */
  function hexString(value) {
    if (value === 0) {
      return '0';
    }
    /** @type {string} */
    let text = '';
    /** @type {float64} */
    let rest = value;
    while (rest > 0) {
      /** @type {int32} */
      const digit = rest % 16;
      text = String.fromCharCode(digit < 10 ? 48 + digit : 87 + digit) + text;
      rest = Math.floor(rest / 16);
    }
    return text;
  }

  // ===== CRC32 IMPLEMENTATION =====

  class BZip2CRC {
    constructor() {
      /** @type {uint32} */
      this.value = 0xFFFFFFFF;
      /** @type {uint32[]} */
      this.table = new Uint32Array(256);
      this.initTable();
    }

    initTable() {
      // CRC-32/BZIP2 table: poly 0x04C11DB7, MSB-first, NOT reflected
      // (this differs from the zlib/PKZIP CRC-32 which is bit-reflected)
      this.table = new Uint32Array(256);
      for (let i = 0; i < 256; ++i) {
        /** @type {uint32} */
        let crc = OpCodes.Shl32(i, 24);
        for (let j = 0; j < 8; ++j) {
          if (OpCodes.Shr32(crc, 31) === 1) {
            crc = OpCodes.Xor32(OpCodes.Shl32(crc, 1), 0x04C11DB7);
          } else {
            crc = OpCodes.Shl32(crc, 1);
          }
        }
        this.table[i] = OpCodes.ToUint32(crc);
      }
    }

    reset() {
      this.value = 0xFFFFFFFF;
    }

    /**
     * @param {uint8} byte - Next data byte
     */
    update(byte) {
      /** @type {uint32} */
      const index = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(this.value, 24), byte), 0xFF);
      this.value = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(this.value, 8), this.table[index]));
    }

    /**
     * @param {uint8} byte - Repeated data byte
     * @param {int32} length - Repeat count
     */
    updateRun(byte, length) {
      for (let i = 0; i < length; ++i) {
        this.update(byte);
      }
    }

    /**
     * @returns {uint32} Final CRC
     */
    getValue() {
      // Final complement only - no byte/bit reversal (RefOut=false for this CRC variant)
      return OpCodes.ToUint32(OpCodes.Xor32(this.value, 0xFFFFFFFF));
    }
  }

  // ===== BIT STREAM CLASSES =====

  class BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.buffer = [];
      /** @type {uint32} */
      this.current = 0;
      /** @type {int32} */
      this.bitsLeft = 32;
    }

    /**
     * @param {uint32} bit - Bit to append (low bit used)
     */
    writeBit(bit) {
      --this.bitsLeft;
      this.current = OpCodes.Or32(this.current, OpCodes.Shl32(OpCodes.And32(bit, 1), this.bitsLeft));

      if (this.bitsLeft <= 24) {
        this.buffer.push(OpCodes.And32(OpCodes.Shr32(this.current, 24), 0xFF));
        this.current = OpCodes.ToUint32(OpCodes.Shl32(this.current, 8));
        this.bitsLeft += 8;
      }
    }

    /**
     * @param {int32} n - Bit count, most significant first
     * @param {uint32} value - Value whose low n bits are written
     */
    writeBits(n, value) {
      for (let i = n - 1; i >= 0; --i) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
      }
    }

    /**
     * @param {uint32} value - 32-bit value
     */
    writeInt32(value) {
      this.writeBits(16, OpCodes.And32(OpCodes.Shr32(value, 16), 0xFFFF));
      this.writeBits(16, OpCodes.And32(value, 0xFFFF));
    }

    /**
     * @param {float64} value - 48-bit value
     */
    writeLong48(value) {
      // Handle 48-bit value (JavaScript numbers are safe up to 53 bits)
      this.writeBits(24, OpCodes.And32(Math.floor(value / 16777216), 0xFFFFFF));
      this.writeBits(24, OpCodes.And32(value, 0xFFFFFF));
    }

    flush() {
      if (this.bitsLeft < 32) {
        this.buffer.push(OpCodes.And32(OpCodes.Shr32(this.current, 24), 0xFF));
      }
      this.current = 0;
      this.bitsLeft = 32;
    }

    /**
     * @returns {uint8[]} All bytes written
     */
    getBytes() {
      return this.buffer;
    }
  }

  class BitReader {
    /**
     * @param {uint8[]} bytes - Input
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint8} */
      this.current = 0;
      /** @type {int32} */
      this.bitsLeft = 0;
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      if (this.bitsLeft === 0) {
        if (this.pos >= this.bytes.length) {
          throw new Error('Unexpected end of stream');
        }
        this.current = this.bytes[this.pos++];
        this.bitsLeft = 8;
      }
      --this.bitsLeft;
      return OpCodes.And32(OpCodes.Shr32(this.current, this.bitsLeft), 1);
    }

    // Callers read at most 31 bits at once, so the value never reaches bit 31.
    /**
     * @param {int32} n - Bit count, most significant first
     * @returns {uint32} Bits read
     */
    readBits(n) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < n; ++i) {
        /** @type {uint32} */
        const bit = this.readBit();
        result = OpCodes.Or32(OpCodes.Shl32(result, 1), bit);
      }
      return result;
    }

    /**
     * @returns {uint32} 32-bit value
     */
    readInt32() {
      // The combination stays unsigned, so values with bit 31 set (common for
      // CRCs) compare equal to the unsigned CRCs computed here.
      /** @type {uint32} */
      const high = this.readBits(16);
      /** @type {uint32} */
      const low = this.readBits(16);
      return OpCodes.Or32(OpCodes.Shl32(high, 16), low);
    }

    /**
     * @returns {float64} 48-bit value
     */
    readLong48() {
      /** @type {float64} */
      const high = this.readBits(24);
      /** @type {float64} */
      const low = this.readBits(24);
      return high * 16777216 + low;
    }
  }

  // ===== BURROWS-WHEELER TRANSFORM =====

  /**
   * Result of the forward transform.
   */
  class BwtResult {
    /**
     * @param {uint8[]} transformed - Last column
     * @param {int32} primaryIndex - Row of the original string
     */
    constructor(transformed, primaryIndex) {
      /** @type {uint8[]} */
      this.transformed = transformed;
      /** @type {int32} */
      this.primaryIndex = primaryIndex;
    }
  }

  /**
   * Orders two positions by (rank, rank k further on or -1 past the end).
   * @param {int32[]} rank - Rank per position
   * @param {int32} k - Current doubling step
   * @param {int32} m - Length of the doubled string
   * @param {int32} a - First position
   * @param {int32} b - Second position
   * @returns {int32} Negative, zero or positive like a sort comparator
   */
  function compareRankPairs(rank, k, m, a, b) {
    /** @type {int32} */
    const ra = rank[a];
    /** @type {int32} */
    const rb = rank[b];
    if (ra !== rb) {
      return ra - rb;
    }
    /** @type {int32} */
    const ra2 = a + k < m ? rank[a + k] : -1;
    /** @type {int32} */
    const rb2 = b + k < m ? rank[b + k] : -1;
    return ra2 - rb2;
  }

  // Stable bottom-up merge sort by compareRankPairs: positions with equal keys
  // keep their current relative order, exactly as the stable built-in sort did.
  /**
   * @param {int32[]} sa - Positions, sorted in place
   * @param {int32[]} scratch - Work buffer of the same length
   * @param {int32[]} rank - Rank per position
   * @param {int32} k - Current doubling step
   * @param {int32} m - Length of the doubled string
   */
  function stableSortByRankPairs(sa, scratch, rank, k, m) {
    /** @type {int32[]} */
    let src = sa;
    /** @type {int32[]} */
    let dst = scratch;
    for (let width = 1; width < m; width *= 2) {
      for (let lo = 0; lo < m; lo += 2 * width) {
        /** @type {int32} */
        const mid = Math.min(lo + width, m);
        /** @type {int32} */
        const hi = Math.min(lo + 2 * width, m);
        /** @type {int32} */
        let i = lo;
        /** @type {int32} */
        let j = mid;
        /** @type {int32} */
        let o = lo;
        while (i < mid && j < hi) {
          if (compareRankPairs(rank, k, m, src[j], src[i]) < 0) {
            dst[o++] = src[j++];
          } else {
            dst[o++] = src[i++];
          }
        }
        while (i < mid) {
          dst[o++] = src[i++];
        }
        while (j < hi) {
          dst[o++] = src[j++];
        }
      }
      /** @type {int32[]} */
      const swap = src;
      src = dst;
      dst = swap;
    }
    if (src !== sa) {
      for (let i = 0; i < m; ++i) {
        sa[i] = src[i];
      }
    }
  }

  class BurrowsWheelerTransform {
    /**
     * Build the sorted order of all n cyclic rotations of data in O(n log^2 n).
     * Uses prefix-doubling suffix-array construction on the doubled string
     * (data concatenated with itself) so no sentinel character is needed and
     * ties between genuinely-identical (periodic) rotations resolve consistently:
     * every round is a stable sort, so equal keys keep the order of the
     * previous round.
     * A naive O(n) full-rotation comparator (as a plain sort comparator) is
     * pathological for repeat-heavy input (e.g. long runs of the same byte,
     * which is exactly the common case for compressible data) - this avoids that.
     * @param {uint8[]} data
     * @returns {uint32[]} rotation start indices (0..n-1), sorted ascending by rotation content
     */
    static _sortedRotationOrder(data) {
      /** @type {int32} */
      const n = data.length;
      /** @type {int32} */
      const m = 2 * n;

      /** @type {int32[]} */
      const sa = new Int32Array(m);
      for (let i = 0; i < m; ++i) {
        sa[i] = i;
      }

      /** @type {int32[]} */
      let rank = new Int32Array(m);
      for (let i = 0; i < m; ++i) {
        rank[i] = data[i % n];
      }

      /** @type {int32[]} */
      let tmp = new Int32Array(m);
      /** @type {int32[]} */
      const scratch = new Int32Array(m);

      for (let k = 1; ; k *= 2) {
        stableSortByRankPairs(sa, scratch, rank, k, m);

        tmp[sa[0]] = 0;
        /** @type {int32} */
        let classes = 1;
        for (let i = 1; i < m; ++i) {
          /** @type {int32} */
          const prev = sa[i - 1];
          /** @type {int32} */
          const cur = sa[i];
          /** @type {int32} */
          const prevRank2 = prev + k < m ? rank[prev + k] : -1;
          /** @type {int32} */
          const curRank2 = cur + k < m ? rank[cur + k] : -1;
          if (rank[prev] !== rank[cur] || prevRank2 !== curRank2) {
            ++classes;
          }
          tmp[cur] = classes - 1;
        }

        /** @type {int32[]} */
        const swapRank = rank;
        rank = tmp;
        tmp = swapRank;

        if (classes >= m || k >= m) {
          break;
        }
      }

      // Keep only the starting positions of the first copy (0..n-1), already in sorted order.
      /** @type {uint32[]} */
      const order = new Uint32Array(n);
      /** @type {int32} */
      let oi = 0;
      for (let i = 0; i < m && oi < n; ++i) {
        if (sa[i] < n) {
          order[oi++] = sa[i];
        }
      }
      return order;
    }

    /**
     * @param {uint8[]} data - Block
     * @returns {BwtResult} Last column and primary index
     */
    static transform(data) {
      if (data.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return new BwtResult(empty, 0);
      }
      if (data.length === 1) {
        /** @type {uint8[]} */
        const single = [];
        single.push(data[0]);
        return new BwtResult(single, 0);
      }

      /** @type {int32} */
      const n = data.length;
      /** @type {uint32[]} */
      const order = BurrowsWheelerTransform._sortedRotationOrder(data);

      // Find primary index (where original string is)
      /** @type {int32} */
      let primaryIndex = 0;
      for (let i = 0; i < n; ++i) {
        if (order[i] === 0) {
          primaryIndex = i;
          break;
        }
      }

      // Extract last column (L column)
      /** @type {uint8[]} */
      const column = new Uint8Array(n);
      for (let i = 0; i < n; ++i) {
        /** @type {int32} */
        const start = order[i];
        column[i] = data[(start + n - 1) % n];
      }

      /** @type {uint8[]} */
      const transformed = [];
      for (let i = 0; i < n; ++i) {
        transformed.push(column[i]);
      }
      return new BwtResult(transformed, primaryIndex);
    }

    // A corrupt primary index or byte leaves undefined entries in the plain
    // working arrays and zeros in the typed ones, exactly as before.
    /**
     * @param {uint8[]} data - Last column
     * @param {uint32} primaryIndex - Row of the original string
     * @returns {uint8[]} Original block
     */
    static inverseTransform(data, primaryIndex) {
      if (data.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      if (data.length === 1) {
        /** @type {uint8[]} */
        const single = [];
        single.push(data[0]);
        return single;
      }

      /** @type {int32} */
      const n = data.length;

      // Count frequency of each byte
      /** @type {uint32[]} */
      const counts = new Uint32Array(256);
      for (let i = 0; i < n; ++i) {
        ++counts[data[i]];
      }

      // Calculate cumulative counts
      /** @type {uint32[]} */
      const cumCounts = new Uint32Array(256);
      /** @type {float64} */
      let sum = 0;
      for (let i = 0; i < 256; ++i) {
        cumCounts[i] = sum;
        sum += counts[i];
      }

      // Build transformation vector
      /** @type {uint32[]} */
      const transform = new Uint32Array(n);
      /** @type {uint32[]} */
      const tempCounts = new Uint32Array(256);

      for (let i = 0; i < n; ++i) {
        /** @type {uint8} */
        const byte = data[i];
        /** @type {float64} */
        const slot = cumCounts[byte] + tempCounts[byte];
        transform[slot] = i;
        ++tempCounts[byte];
      }

      // Follow the transformation chain
      /** @type {uint8[]} */
      const result = new Uint8Array(n);
      /** @type {uint32} */
      let current = primaryIndex;

      for (let i = 0; i < n; ++i) {
        current = transform[current];
        result[i] = data[current];
      }

      /** @type {uint8[]} */
      const plain = [];
      for (let i = 0; i < n; ++i) {
        plain.push(result[i]);
      }
      return plain;
    }
  }

  // ===== MOVE-TO-FRONT ENCODING =====

  class MoveToFront {
    /**
     * @param {uint8[]} data - Bytes to code
     * @param {boolean[]} inUse - Byte values present
     * @returns {int32[]} Positions (-1 for a byte not in use)
     */
    static encode(data, inUse) {
      /** @type {int32[]} */
      const symbols = [];
      for (let i = 0; i < 256; ++i) {
        if (inUse[i]) {
          symbols.push(i);
        }
      }

      /** @type {int32[]} */
      const result = [];
      for (let d = 0; d < data.length; ++d) {
        /** @type {uint8} */
        const byte = data[d];
        /** @type {int32} */
        let pos = -1;
        for (let s = 0; s < symbols.length; ++s) {
          if (symbols[s] === byte) {
            pos = s;
            break;
          }
        }
        result.push(pos);
        if (pos > 0) {
          for (let j = pos; j > 0; --j) {
            symbols[j] = symbols[j - 1];
          }
          symbols[0] = byte;
        }
      }

      return result;
    }

    // A position past the end removes nothing and still inserts its
    // (undefined) byte at the front, as splice/unshift did.
    /**
     * @param {int32[]} data - Positions
     * @param {int32[]} seqToUnseq - Initial symbol order
     * @returns {int32[]} Decoded bytes
     */
    static decode(data, seqToUnseq) {
      /** @type {int32[]} */
      const symbols = [];
      for (let i = 0; i < seqToUnseq.length; ++i) {
        symbols.push(seqToUnseq[i]);
      }
      /** @type {int32[]} */
      const result = [];

      for (let d = 0; d < data.length; ++d) {
        /** @type {int32} */
        const pos = data[d];
        /** @type {int32} */
        const byte = symbols[pos];
        result.push(byte);
        if (pos > 0) {
          /** @type {int32} */
          const from = Math.min(Math.trunc(pos), symbols.length);
          for (let j = from; j > 0; --j) {
            symbols[j] = symbols[j - 1];
          }
          symbols[0] = byte;
        }
      }

      return result;
    }
  }

  // ===== HUFFMAN CODING =====

  class HuffmanCoding {
    /**
     * @param {int32[]} frequencies - Frequency per symbol
     * @param {int32} maxLen - Longest allowed code
     * @returns {int32[]} Code length per symbol
     */
    static makeCodeLengths(frequencies, maxLen) {
      /** @type {int32} */
      const alphaSize = frequencies.length;
      // 1-indexed binary heap; only positions 0..nHeap are ever read.
      /** @type {int32[]} */
      const heap = new Int32Array(alphaSize * 2 + 2);
      /** @type {int32[]} */
      const weight = new Int32Array(alphaSize * 2);
      /** @type {int32[]} */
      const parent = new Int32Array(alphaSize * 2);

      // Initialize weights
      for (let i = 0; i < alphaSize; ++i) {
        weight[i + 1] = OpCodes.Shl32((frequencies[i] === 0 ? 1 : frequencies[i]), 8);
      }

      while (true) {
        /** @type {int32} */
        let nNodes = alphaSize;
        /** @type {int32} */
        let nHeap = 0;

        heap[0] = 0;
        weight[0] = 0;
        parent[0] = -2;

        // Build initial heap (positions written by index; the heap shrinks and
        // regrows as nodes are extracted and combined below)
        for (let i = 1; i <= alphaSize; ++i) {
          parent[i] = -1;
          ++nHeap;
          heap[nHeap] = i;

          // Sift up
          /** @type {int32} */
          let zz = nHeap;
          /** @type {int32} */
          const tmp = heap[zz];
          while (weight[tmp] < weight[heap[OpCodes.Shr32(zz, 1)]]) {
            heap[zz] = heap[OpCodes.Shr32(zz, 1)];
            zz = OpCodes.Shr32(zz, 1);
          }
          heap[zz] = tmp;
        }

        // Build Huffman tree
        while (nHeap > 1) {
          // Extract min
          /** @type {int32} */
          const n1 = heap[1];
          heap[1] = heap[nHeap--];

          // Sift down
          /** @type {int32} */
          let zz = 1;
          /** @type {int32} */
          let tmp = heap[zz];
          while (true) {
            /** @type {int32} */
            let yy = OpCodes.Shl32(zz, 1);
            if (yy > nHeap) {
              break;
            }
            if (yy < nHeap && weight[heap[yy + 1]] < weight[heap[yy]]) {
              ++yy;
            }
            if (weight[tmp] < weight[heap[yy]]) {
              break;
            }
            heap[zz] = heap[yy];
            zz = yy;
          }
          heap[zz] = tmp;

          // Extract second min
          /** @type {int32} */
          const n2 = heap[1];
          heap[1] = heap[nHeap--];

          // Sift down again
          zz = 1;
          tmp = heap[zz];
          while (true) {
            /** @type {int32} */
            let yy = OpCodes.Shl32(zz, 1);
            if (yy > nHeap) {
              break;
            }
            if (yy < nHeap && weight[heap[yy + 1]] < weight[heap[yy]]) {
              ++yy;
            }
            if (weight[tmp] < weight[heap[yy]]) {
              break;
            }
            heap[zz] = heap[yy];
            zz = yy;
          }
          heap[zz] = tmp;

          // Combine nodes
          ++nNodes;
          parent[n2] = nNodes;
          parent[n1] = nNodes;

          // Weights stay below 2^31, so the masks and the combination are exact.
          /** @type {int32} */
          const w1 = OpCodes.And32(weight[n1], 0xFFFFFF00);
          /** @type {int32} */
          const w2 = OpCodes.And32(weight[n2], 0xFFFFFF00);
          /** @type {int32} */
          const d1 = OpCodes.And32(weight[n1], 0xFF);
          /** @type {int32} */
          const d2 = OpCodes.And32(weight[n2], 0xFF);

          weight[nNodes] = OpCodes.Or32(w1 + w2, 1 + (d1 > d2 ? d1 : d2));
          parent[nNodes] = -1;
          ++nHeap;
          heap[nHeap] = nNodes;

          // Sift up
          zz = nHeap;
          tmp = heap[zz];
          while (weight[tmp] < weight[heap[OpCodes.Shr32(zz, 1)]]) {
            heap[zz] = heap[OpCodes.Shr32(zz, 1)];
            zz = OpCodes.Shr32(zz, 1);
          }
          heap[zz] = tmp;
        }

        // Calculate code lengths
        /** @type {uint8[]} */
        const lengths = new Uint8Array(alphaSize);
        /** @type {boolean} */
        let tooLong = false;

        for (let i = 1; i <= alphaSize; ++i) {
          /** @type {int32} */
          let j = 0;
          /** @type {int32} */
          let k = i;
          while (parent[k] >= 0) {
            k = parent[k];
            ++j;
          }
          lengths[i - 1] = j;
          if (j > maxLen) {
            tooLong = true;
          }
        }

        if (!tooLong) {
          /** @type {int32[]} */
          const plain = [];
          for (let i = 0; i < alphaSize; ++i) {
            plain.push(lengths[i]);
          }
          return plain;
        }

        // If too long, adjust weights and retry
        for (let i = 1; i <= alphaSize; ++i) {
          /** @type {int32} */
          let j = OpCodes.Shr32(weight[i], 8);
          j = 1 + OpCodes.Shr32(j, 1);
          weight[i] = OpCodes.Shl32(j, 8);
        }
      }
    }

    /**
     * @param {int32[]} lengths - Code length per symbol
     * @param {int32} minLen - Shortest code length
     * @param {int32} maxLen - Longest code length
     * @returns {uint32[]} Canonical code per symbol
     */
    static assignCodes(lengths, minLen, maxLen) {
      /** @type {uint32[]} */
      const codes = new Uint32Array(lengths.length);
      /** @type {uint32} */
      let code = 0;

      for (let len = minLen; len <= maxLen; ++len) {
        for (let i = 0; i < lengths.length; ++i) {
          if (lengths[i] === len) {
            codes[i] = code++;
          }
        }
        code = OpCodes.Shl32(code, 1);
      }

      return codes;
    }
  }

  // ===== MAIN BZIP2 ALGORITHM =====

  class BZIP2Algorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BZIP2";
      this.description = "Block-sorting compression using Burrows-Wheeler Transform, Move-to-Front coding, Run-Length Encoding, and Huffman coding. Both compression and decompression are implemented and interoperate with the real bzip2 CLI in both directions (verified against bzip2 1.0.8: it decodes our compressed output, and our decoder reads real bzip2 -9 output, including block and stream CRC verification). The encoder always uses the minimum legal number of Huffman tables (2, both identical) rather than bzip2's multi-table selector optimization, so output is larger than the reference encoder's but fully standard-compliant.";
      this.inventor = "Julian Seward";
      this.year = 1996;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Block Sorting";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Not a security primitive; ratio is not optimized vs. the reference encoder
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.GB;

      // Documentation with credible sources
      this.documentation = [
        new LinkItem("Official BZIP2 Homepage", "https://sourceware.org/bzip2/"),
        new LinkItem("BZIP2 Format Specification", "https://github.com/dsnet/compress/blob/master/doc/bzip2-format.pdf"),
        new LinkItem("Wikipedia - Bzip2", "https://en.wikipedia.org/wiki/Bzip2")
      ];

      this.references = [
        new LinkItem("Burrows-Wheeler Transform Paper", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"),
        new LinkItem("Original bzip2 Repository", "https://gitlab.com/bzip2/bzip2"),
        new LinkItem("Go Implementation Reference", "https://github.com/golang/go/tree/master/src/compress/bzip2")
      ];

      // Official test vectors from Go standard library
      this.tests = [
        {
          text: "Hello World - Go stdlib test vector",
          uri: "https://github.com/golang/go/blob/master/src/compress/bzip2/bzip2_test.go",
          input: OpCodes.Hex8ToBytes("425a68393141592653594eece83600000251800010400006449080200031064c4101a7a9a580bb9431f8bb9229c28482776741b0"),
          expected: OpCodes.AnsiToBytes("hello world\n"),
          inverse: true  // This is a decompression test
        },
        {
          text: "32 Zero Bytes - Go stdlib test vector",
          uri: "https://github.com/golang/go/blob/master/src/compress/bzip2/bzip2_test.go",
          input: OpCodes.Hex8ToBytes("425a6839314159265359b5aa5098000000600040000004200021008283177245385090b5aa5098"),
          expected: new Array(32).fill(0),
          inverse: true
        },
        {
          text: "1MiB Zeros - Go stdlib test vector",
          uri: "https://github.com/golang/go/blob/master/src/compress/bzip2/bzip2_test.go",
          input: OpCodes.Hex8ToBytes("425a683931415926535938571ce50008084000c0040008200030cc0529a60806c4201e2ee48a70a12070ae39ca"),
          expected: new Array(1048576).fill(0),
          inverse: true
        },
        {
          text: "Round-trip - short text (compression + decompression)",
          uri: "https://sourceware.org/bzip2/",
          input: OpCodes.AnsiToBytes("hello world"),
          expected: [],
          inverse: false
        },
        {
          text: "Round-trip - repeated pattern (compression + decompression)",
          uri: "https://sourceware.org/bzip2/",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(20)),
          expected: [],
          inverse: false
        },
        {
          text: "Round-trip - all 256 byte values (compression + decompression)",
          uri: "https://sourceware.org/bzip2/",
          input: Array.from({ length: 256 }, (_, i) => i),
          expected: [],
          inverse: false
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BZIP2Instance(this, isInverse);
    }
  }

  /**
   * Huffman decoding table of one coding group.
   */
  class BzDecodeTable {
    /**
     * @param {int32} minLen - Shortest code length
     * @param {int32} maxLen - Longest code length
     * @param {int32[]} limit - Code limit per length
     * @param {int32[]} base - Code base per length
     * @param {int32[]} perm - Symbols in code order
     */
    constructor(minLen, maxLen, limit, base, perm) {
      /** @type {int32} */
      this.minLen = minLen;
      /** @type {int32} */
      this.maxLen = maxLen;
      /** @type {int32[]} */
      this.limit = limit;
      /** @type {int32[]} */
      this.base = base;
      /** @type {int32[]} */
      this.perm = perm;
    }
  }

  /**
 * BZIP2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BZIP2Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {BZIP2Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this.blockSize100k = 9; // Default to highest compression
    }

    /**
     * @param {int32} size - Block size in units of 100k (1-9)
     */
    set blockSize(size) {
      if (size < 1 || size > 9) {
        throw new Error('Invalid block size: ' + size + ' (must be 1-9)');
      }
      this.blockSize100k = size;
    }

    /**
     * @returns {int32} Block size in units of 100k
     */
    get blockSize() {
      return this.blockSize100k;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      let result = [];
      if (this.isInverse) {
        result = this.decompress(this.inputBuffer);
      } else {
        result = this.compress(this.inputBuffer);
      }

      this.inputBuffer = [];
      return result;
    }

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} bzip2 stream
     */
    compress(data) {
      /** @type {BitWriter} */
      const bw = new BitWriter();

      // File header: 'B' 'Z' 'h' <level digit>
      bw.writeBits(8, 0x42);
      bw.writeBits(8, 0x5A);
      bw.writeBits(8, 0x68);
      bw.writeBits(8, 0x30 + this.blockSize100k);

      /** @type {int32} */
      const maxBlockBytes = BZ_BASE_BLOCK_SIZE * this.blockSize100k;
      /** @type {int32} */
      const n = data.length;
      /** @type {uint32} */
      let computedStreamCRC = 0;
      /** @type {int32} */
      let pos = 0;

      while (pos < n) {
        /** @type {int32} */
        const blockStart = pos;
        /** @type {uint8[]} */
        const rle1 = [];

        // Greedily consume runs (RLE1) until the encoded block would exceed the limit.
        while (pos < n) {
          /** @type {uint8} */
          const byte = data[pos];
          /** @type {int32} */
          const capRun = Math.min(n - pos, 259); // 4 literal + up to 255 in the length byte
          /** @type {int32} */
          let runLen = 1;
          while (runLen < capRun && data[pos + runLen] === byte) {
            ++runLen;
          }

          /** @type {int32} */
          const addBytes = runLen < 4 ? runLen : 5;
          if (rle1.length > 0 && rle1.length + addBytes > maxBlockBytes) {
            break;
          }

          if (runLen < 4) {
            for (let j = 0; j < runLen; ++j) {
              rle1.push(byte);
            }
          } else {
            rle1.push(byte);
            rle1.push(byte);
            rle1.push(byte);
            rle1.push(byte);
            rle1.push(runLen - 4);
          }
          pos += runLen;
        }

        /** @type {uint32} */
        const blockCRC = this.encodeBlock(bw, rle1, data, blockStart, pos);
        /** @type {uint32} */
        const rotated = OpCodes.Or32(OpCodes.Shl32(computedStreamCRC, 1), OpCodes.Shr32(computedStreamCRC, 31));
        computedStreamCRC = OpCodes.Xor32(rotated, blockCRC);
      }

      bw.writeLong48(BZ_STREAM_END_MAGIC);
      bw.writeInt32(computedStreamCRC);
      bw.flush();

      /** @type {uint8[]} */
      const bytes = bw.getBytes();
      return bytes;
    }

    /**
     * Encode a single block: BWT -> MTF -> RLE2 -> Huffman, with block/stream headers.
     * @param {BitWriter} bw - output bit writer
     * @param {uint8[]} rle1Data - RLE1-encoded payload for this block
     * @param {uint8[]} originalData - full source buffer (for block CRC over the pre-RLE1 bytes)
     * @param {int32} blockStart - start offset (inclusive) of this block within originalData
     * @param {int32} blockEnd - end offset (exclusive) of this block within originalData
     * @returns {uint32} the block CRC (also used to update the running stream CRC)
     */
    encodeBlock(bw, rle1Data, originalData, blockStart, blockEnd) {
      // Block CRC is computed over the original (pre-RLE1) bytes belonging to this block
      /** @type {BZip2CRC} */
      const crc = new BZip2CRC();
      crc.reset();
      for (let i = blockStart; i < blockEnd; ++i) {
        crc.update(originalData[i]);
      }
      /** @type {uint32} */
      const blockCRC = crc.getValue();

      /** @type {BwtResult} */
      const bwt = BurrowsWheelerTransform.transform(rle1Data);
      /** @type {uint8[]} */
      const transformed = bwt.transformed;
      /** @type {int32} */
      const primaryIndex = bwt.primaryIndex;

      /** @type {boolean[]} */
      const inUse = [];
      for (let i = 0; i < 256; ++i) {
        inUse.push(false);
      }
      for (let i = 0; i < transformed.length; ++i) {
        inUse[transformed[i]] = true;
      }
      /** @type {int32[]} */
      const seqToUnseq = [];
      for (let i = 0; i < 256; ++i) {
        if (inUse[i]) {
          seqToUnseq.push(i);
        }
      }

      /** @type {int32[]} */
      const mtfPositions = MoveToFront.encode(transformed, inUse);

      /** @type {int32} */
      const alphaSize = seqToUnseq.length + 2; // + RUNA/RUNB..EOB
      /** @type {int32} */
      const eobSymbol = alphaSize - 1;
      /** @type {int32[]} */
      const mtfSymbols = this.encodeRLE2(mtfPositions, eobSymbol);

      /** @type {int32[]} */
      const freq = [];
      for (let i = 0; i < alphaSize; ++i) {
        freq.push(0);
      }
      for (let i = 0; i < mtfSymbols.length; ++i) {
        ++freq[mtfSymbols[i]];
      }

      /** @type {int32[]} */
      const lengths = HuffmanCoding.makeCodeLengths(freq, BZ_MAX_CODE_LEN);
      /** @type {int32} */
      let minLen = BZ_MAX_CODE_LEN;
      /** @type {int32} */
      let maxLen = 1;
      for (let i = 0; i < lengths.length; ++i) {
        if (lengths[i] < minLen) {
          minLen = lengths[i];
        }
        if (lengths[i] > maxLen) {
          maxLen = lengths[i];
        }
      }
      /** @type {uint32[]} */
      const codes = HuffmanCoding.assignCodes(lengths, minLen, maxLen);

      // Minimum legal number of tables is 2; use two identical tables and always
      // select table 0 (a legal, if not compression-optimal, encoding).
      /** @type {int32} */
      const nGroups = 2;
      /** @type {int32} */
      const nSelectors = Math.max(1, Math.ceil(mtfSymbols.length / BZ_G_SIZE));

      // ===== Block header =====
      bw.writeLong48(BZ_BLOCK_HEADER_MAGIC);
      bw.writeInt32(blockCRC);
      bw.writeBit(0); // not randomized
      bw.writeBits(24, primaryIndex);

      // Used-symbol bitmap (16 group bits + up to 16x16 detail bits)
      /** @type {boolean[]} */
      const inUse16 = [];
      for (let g = 0; g < 16; ++g) {
        inUse16.push(false);
      }
      for (let i = 0; i < 256; ++i) {
        if (inUse[i]) {
          inUse16[Math.floor(i / 16)] = true;
        }
      }
      for (let g = 0; g < 16; ++g) {
        bw.writeBit(inUse16[g] ? 1 : 0);
      }
      for (let g = 0; g < 16; ++g) {
        if (!inUse16[g]) {
          continue;
        }
        for (let j = 0; j < 16; ++j) {
          bw.writeBit(inUse[g * 16 + j] ? 1 : 0);
        }
      }

      bw.writeBits(3, nGroups);
      bw.writeBits(15, nSelectors);

      // Selector list: all point at table 0, encoded as MTF value 0 (a single '0' bit each)
      for (let i = 0; i < nSelectors; ++i) {
        bw.writeBit(0);
      }

      // Huffman code-length tables (two identical copies)
      for (let t = 0; t < nGroups; ++t) {
        this.encodeHuffmanLengths(bw, lengths);
      }

      // Symbol stream
      for (let i = 0; i < mtfSymbols.length; ++i) {
        /** @type {int32} */
        const sym = mtfSymbols[i];
        bw.writeBits(lengths[sym], codes[sym]);
      }

      return blockCRC;
    }

    /**
     * RLE2 / zero-run coding: runs of MTF value 0 are coded via a bijective base-2
     * representation using RUNA(=1x)/RUNB(=2x) symbols; non-zero MTF position p becomes
     * symbol p+1 (0 and 1 are reserved for RUNA/RUNB). Terminated by the EOB symbol.
     * @param {int32[]} mtfPositions - MTF-encoded positions
     * @param {int32} eobSymbol - end-of-block symbol value (alphaSize - 1)
     * @returns {int32[]} Huffman-alphabet symbol stream
     */
    encodeRLE2(mtfPositions, eobSymbol) {
      /** @type {int32[]} */
      const result = [];
      /** @type {int32} */
      let i = 0;
      /** @type {int32} */
      const n = mtfPositions.length;

      while (i < n) {
        if (mtfPositions[i] === 0) {
          /** @type {int32} */
          let runLen = 0;
          while (i < n && mtfPositions[i] === 0) {
            ++runLen;
            ++i;
          }

          /** @type {int32} */
          let remaining = runLen;
          while (remaining > 0) {
            if (remaining % 2 === 1) {
              result.push(BZ_RUNA);
              remaining = Math.floor((remaining - 1) / 2);
            } else {
              result.push(BZ_RUNB);
              remaining = Math.floor((remaining - 2) / 2);
            }
          }
        } else {
          result.push(mtfPositions[i] + 1);
          ++i;
        }
      }

      result.push(eobSymbol);
      return result;
    }

    /**
     * Write one Huffman code-length table using bzip2's delta encoding: a 5-bit seed
     * length followed by, per symbol, a unary sequence of +1/-1 adjustments terminated
     * by a 0 marker bit. Mirrors decodeBlock's length-reading loop exactly.
     * @param {BitWriter} bw
     * @param {int32[]} lengths - code length per symbol (0..alphaSize-1)
     */
    encodeHuffmanLengths(bw, lengths) {
      /** @type {int32} */
      let curr = lengths[0];
      bw.writeBits(5, curr);

      for (let i = 0; i < lengths.length; ++i) {
        /** @type {int32} */
        const target = lengths[i];
        if (curr === target) {
          bw.writeBit(0);
          continue;
        }
        bw.writeBit(1);
        while (true) {
          if (curr < target) {
            bw.writeBit(0);
            ++curr;
          } else {
            bw.writeBit(1);
            --curr;
          }
          if (curr === target) {
            bw.writeBit(0);
            break;
          }
          bw.writeBit(1);
        }
      }
    }

    /**
     * @param {uint8[]} compressedData - bzip2 stream
     * @returns {uint8[]} Decompressed bytes
     */
    decompress(compressedData) {
      /** @type {BitReader} */
      const reader = new BitReader(compressedData);

      // Read and validate file header
      /** @type {uint32} */
      const magicHigh = reader.readBits(8);
      /** @type {uint32} */
      const magicLow = reader.readBits(8);
      /** @type {uint32} */
      const magic = OpCodes.Or32(OpCodes.Shl32(magicHigh, 8), magicLow);
      if (magic !== BZ_MAGIC) {
        throw new Error('Invalid BZIP2 magic number');
      }

      /** @type {uint32} */
      const version = reader.readBits(8);
      if (version !== BZ_VERSION) {
        throw new Error('Unsupported BZIP2 version: ' + String.fromCharCode(version));
      }

      /** @type {uint32} */
      const level = reader.readBits(8);
      if (level < 0x31 || level > 0x39) { // '1' to '9'
        throw new Error('Invalid BZIP2 level: ' + String.fromCharCode(level));
      }

      this.blockSize100k = level - 0x30;

      // Decompress all blocks
      /** @type {uint8[]} */
      const output = [];
      /** @type {BZip2CRC} */
      const streamCRC = new BZip2CRC();
      streamCRC.reset();

      /** @type {uint32} */
      let computedStreamCRC = 0;

      while (true) {
        // Read block or stream end magic
        /** @type {float64} */
        const blockMagic = reader.readLong48();

        if (blockMagic === BZ_STREAM_END_MAGIC) {
          /** @type {uint32} */
          const expectedStreamCRC = reader.readInt32();
          if (expectedStreamCRC !== computedStreamCRC) {
            throw new Error('Stream CRC mismatch: expected ' + hexString(expectedStreamCRC) + ', got ' + hexString(computedStreamCRC));
          }
          break;
        }

        if (blockMagic !== BZ_BLOCK_HEADER_MAGIC) {
          throw new Error('Invalid block magic: ' + hexString(blockMagic));
        }

        // Read block CRC
        /** @type {uint32} */
        const blockCRC = reader.readInt32();

        // Read randomization flag (usually 0)
        /** @type {uint32} */
        const randomized = reader.readBit();
        if (randomized) {
          throw new Error('Randomized blocks not supported');
        }

        // Decode block
        /** @type {uint8[]} */
        const blockData = this.decodeBlock(reader);

        // Verify block CRC
        /** @type {BZip2CRC} */
        const crc = new BZip2CRC();
        crc.reset();
        for (let i = 0; i < blockData.length; ++i) {
          crc.update(blockData[i]);
        }
        /** @type {uint32} */
        const computedCRC = crc.getValue();

        if (computedCRC !== blockCRC) {
          throw new Error('Block CRC mismatch: expected ' + hexString(blockCRC) + ', got ' + hexString(computedCRC));
        }

        // Update stream CRC
        /** @type {uint32} */
        const rotated = OpCodes.Or32(OpCodes.Shl32(computedStreamCRC, 1), OpCodes.Shr32(computedStreamCRC, 31));
        computedStreamCRC = OpCodes.Xor32(rotated, computedCRC);

        // Append block data without spread operator to avoid call stack issues with large arrays
        for (let i = 0; i < blockData.length; ++i) {
          output.push(blockData[i]);
        }
      }

      return output;
    }

    // Corrupt streams can leave zero-length or out-of-range entries in the
    // tables; the lookups below then read undefined and continue exactly as
    // before.
    /**
     * @param {BitReader} reader - Input bits positioned after the block CRC and flag
     * @returns {uint8[]} Decoded block
     */
    decodeBlock(reader) {
      // Read original pointer
      /** @type {uint32} */
      const origPtr = reader.readBits(24);

      // Read mapping table
      /** @type {uint32[]} */
      const inUse16 = [];
      for (let i = 0; i < 16; ++i) {
        /** @type {uint32} */
        const groupUsed = reader.readBit();
        inUse16.push(groupUsed);
      }

      /** @type {boolean[]} */
      const inUse = [];
      for (let i = 0; i < 256; ++i) {
        inUse.push(false);
      }
      /** @type {int32[]} */
      const seqToUnseq = [];

      for (let i = 0; i < 16; ++i) {
        if (inUse16[i]) {
          for (let j = 0; j < 16; ++j) {
            /** @type {uint32} */
            const used = reader.readBit();
            if (used) {
              /** @type {int32} */
              const symbol = i * 16 + j;
              inUse[symbol] = true;
              seqToUnseq.push(symbol);
            }
          }
        }
      }

      /** @type {int32} */
      const alphaSize = seqToUnseq.length + 2; // +2 for RUNA and RUNB

      // Read number of Huffman tables
      /** @type {int32} */
      const nGroups = reader.readBits(3);
      if (nGroups < 2 || nGroups > 6) {
        throw new Error('Invalid number of Huffman groups: ' + nGroups);
      }

      // Read number of selectors
      /** @type {int32} */
      const nSelectors = reader.readBits(15);

      // Read selectors with MTF encoding
      /** @type {int32[]} */
      const selectorMTF = [];
      for (let i = 0; i < nSelectors; ++i) {
        /** @type {int32} */
        let j = 0;
        for (;;) {
          /** @type {uint32} */
          const more = reader.readBit();
          if (!more) {
            break;
          }
          ++j;
        }
        selectorMTF.push(j);
      }

      // Decode selectors using MTF (typed arrays: out-of-range reads give
      // undefined, stored as 0; out-of-range writes are dropped)
      /** @type {uint8[]} */
      const pos = new Uint8Array(nGroups);
      for (let i = 0; i < nGroups; ++i) {
        pos[i] = i;
      }

      /** @type {uint8[]} */
      const selectors = new Uint8Array(nSelectors);
      for (let i = 0; i < nSelectors; ++i) {
        /** @type {int32} */
        const v = selectorMTF[i];
        /** @type {uint8} */
        const tmp = pos[v];
        for (let j = v; j > 0; --j) {
          pos[j] = pos[j - 1];
        }
        pos[0] = tmp;
        selectors[i] = tmp;
      }

      // Read Huffman code lengths
      /** @type {uint8[][]} */
      const lengths = [];
      for (let t = 0; t < nGroups; ++t) {
        /** @type {int32} */
        let curr = reader.readBits(5);
        /** @type {uint8[]} */
        const tableLengths = new Uint8Array(alphaSize);

        for (let i = 0; i < alphaSize; ++i) {
          // Read code length using marker bit + 2-bit adjustment pattern
          /** @type {uint32} */
          let markerBit = reader.readBit();
          while (markerBit !== 0) {
            /** @type {uint32} */
            const nextTwoBits = reader.readBits(2);
            /** @type {int32} */
            const step = OpCodes.And32(nextTwoBits, 2);
            curr += 1 - step; // +1 if bit 1 is 0, -1 if bit 1 is 1
            if (curr < 1 || curr > 20) {
              throw new Error('Invalid Huffman code length: ' + curr);
            }
            markerBit = OpCodes.And32(nextTwoBits, 1); // bit 0 is the next marker
          }
          tableLengths[i] = curr;
        }
        lengths.push(tableLengths);
      }

      // Build Huffman decoding tables
      /** @type {BzDecodeTable[]} */
      const tables = this.createDecodingTables(lengths, alphaSize);

      // Decode MTF values using Huffman tables
      /** @type {int32[]} */
      const mtfValues = [];
      /** @type {int32} */
      let groupNo = 0;
      /** @type {int32} */
      let groupPos = BZ_G_SIZE - 1;

      /** @type {int32} */
      const maxBlockSize = BZ_BASE_BLOCK_SIZE * this.blockSize100k;

      // Select initial table
      /** @type {uint8} */
      let tableIdx = selectors[groupNo];
      if (groupNo >= selectors.length || tableIdx >= tables.length) {
        throw new Error('Invalid table index: ' + tableIdx);
      }
      /** @type {BzDecodeTable} */
      let table = tables[tableIdx];

      // Read first symbol
      /** @type {int32} */
      let symbol = this.decodeSymbol(reader, table, lengths[tableIdx]);

      while (symbol !== alphaSize - 1) { // Loop until EOB marker
        mtfValues.push(symbol);

        if (mtfValues.length > maxBlockSize + 100) {
          throw new Error('Block too large');
        }

        // Check if we need to switch to next table group
        if (groupPos === 0) {
          ++groupNo;
          if (groupNo >= nSelectors) {
            throw new Error('Not enough selectors');
          }
          groupPos = BZ_G_SIZE;
          tableIdx = selectors[groupNo];
          if (groupNo >= selectors.length || tableIdx >= tables.length) {
            throw new Error('Invalid table index: ' + tableIdx);
          }
          table = tables[tableIdx];
        }
        --groupPos;

        // Read next symbol
        symbol = this.decodeSymbol(reader, table, lengths[tableIdx]);
      }

      // Combined RLE2 + MTF decoding (as per bzip2 spec, these are interleaved)
      /** @type {int32[]} */
      const decoded = this.decodeRLE2andMTF(mtfValues, seqToUnseq);

      // Inverse BWT
      /** @type {uint8[]} */
      const bwtDecoded = BurrowsWheelerTransform.inverseTransform(decoded, origPtr);

      // RLE1 inverse decoding (final stage)
      /** @type {uint8[]} */
      const result = this.decodeRLE1(bwtDecoded);

      return result;
    }

    /**
     * @param {uint8[][]} lengths - Code lengths per group
     * @param {int32} alphaSize - Alphabet size
     * @returns {BzDecodeTable[]} Decoding table per group
     */
    createDecodingTables(lengths, alphaSize) {
      /** @type {BzDecodeTable[]} */
      const tables = [];

      for (let t = 0; t < lengths.length; ++t) {
        /** @type {uint8[]} */
        const tableLengths = lengths[t];
        /** @type {int32} */
        let minLen = 20;
        /** @type {int32} */
        let maxLen = 0;
        for (let s = 0; s < tableLengths.length; ++s) {
          /** @type {int32} */
          const len = tableLengths[s];
          if (len > 0) {
            if (len < minLen) {
              minLen = len;
            }
            if (len > maxLen) {
              maxLen = len;
            }
          }
        }

        /** @type {int32[]} */
        const limit = new Int32Array(maxLen + 2);
        /** @type {int32[]} */
        const base = new Int32Array(maxLen + 1);
        /** @type {int32[]} */
        const perm = new Int32Array(alphaSize);

        // Build permutation array sorted by code length
        /** @type {int32} */
        let pp = 0;
        /** @type {int32} */
        let baseVal = 0;
        for (let i = minLen; i <= maxLen; ++i) {
          for (let j = 0; j < alphaSize; ++j) {
            if (tableLengths[j] === i) {
              perm[pp++] = j;
            }
          }
          base[i] = baseVal;
          limit[i] = baseVal + pp;
          baseVal += baseVal + pp; // Double and add pp
        }

        tables.push(new BzDecodeTable(minLen, maxLen, limit, base, perm));
      }

      return tables;
    }

    /**
     * @param {BitReader} reader - Input bits
     * @param {BzDecodeTable} table - Decoding table
     * @param {uint8[]} lengths - Its code lengths (unused)
     * @returns {int32} Decoded symbol
     */
    decodeSymbol(reader, table, lengths) {
      // Read minimum length bits first
      /** @type {int32} */
      let zn = table.minLen;
      /** @type {uint32} */
      let zvec = reader.readBits(table.minLen);

      // Read additional bits until we find the code
      while (zvec >= table.limit[zn]) {
        if (++zn > BZ_MAX_CODE_LEN) {
          throw new Error('Invalid Huffman code');
        }
        /** @type {uint32} */
        const bit = reader.readBit();
        zvec = OpCodes.Or32(OpCodes.Shl32(zvec, 1), bit);
      }

      /** @type {float64} */
      const permIndex = zvec - table.base[zn];
      if (permIndex < 0 || permIndex >= table.perm.length) {
        throw new Error('Invalid permutation index: ' + permIndex);
      }

      return table.perm[permIndex];
    }

    /**
     * @param {int32[]} mtfValues - Huffman-decoded symbols
     * @param {int32[]} seqToUnseq - Initial MTF order
     * @returns {int32[]} Last column bytes
     */
    decodeRLE2andMTF(mtfValues, seqToUnseq) {
      // Combined RLE2 + MTF decoding as per bzip2 specification
      // RLE2 and MTF are interleaved - RUNA/RUNB repeat yy[0] from MTF state
      /** @type {int32[]} */
      const result = [];
      /** @type {int32[]} */
      const yy = []; // MTF state
      for (let s = 0; s < seqToUnseq.length; ++s) {
        yy.push(seqToUnseq[s]);
      }
      /** @type {int32} */
      let i = 0;

      while (i < mtfValues.length) {
        /** @type {int32} */
        const symbol = mtfValues[i++];

        if (symbol === BZ_RUNA || symbol === BZ_RUNB) {
          // Decode run length using binary representation
          /** @type {float64} */
          let runLength = 0;
          /** @type {float64} */
          let power = 1;

          --i; // Back up to reprocess
          while (i < mtfValues.length && (mtfValues[i] === BZ_RUNA || mtfValues[i] === BZ_RUNB)) {
            if (mtfValues[i] === BZ_RUNA) {
              runLength += power;
            } else {
              runLength += 2 * power;
            }
            power *= 2;
            ++i;
          }

          // Repeat yy[0] (most recent MTF character)
          /** @type {int32} */
          const ch = yy[0];
          for (let j = 0; j < runLength; ++j) {
            result.push(ch);
          }
        } else {
          // Regular symbol: output yy[symbol-1] and update MTF state
          /** @type {int32} */
          const pos = symbol - 1;
          /** @type {int32} */
          const ch = yy[pos];
          result.push(ch);

          // Move to front
          if (pos > 0) {
            for (let j = pos; j > 0; --j) {
              yy[j] = yy[j - 1];
            }
            yy[0] = ch;
          }
        }
      }

      return result;
    }

    /**
     * @param {uint8[]} data - RLE1-coded bytes
     * @returns {uint8[]} Decoded bytes
     */
    decodeRLE1(data) {
      // RLE1 inverse decoding (final stage of bzip2 decompression)
      // When 4 identical bytes AAAA are seen, the next byte N indicates
      // to output N additional copies of A (so total is 4 + N copies)
      // The run length byte N is NOT output - it's metadata only
      /** @type {uint8[]} */
      const result = [];
      /** @type {int32} */
      let i = 0;
      /** @type {int32} */
      let prevByte = -1;
      /** @type {int32} */
      let runCount = 0;

      while (i < data.length) {
        /** @type {uint8} */
        const byte = data[i++];

        if (byte === prevByte) {
          ++runCount;
          if (runCount < 4) {
            // Still accumulating run, output the byte
            result.push(byte);
          } else if (runCount === 4) {
            // Fourth consecutive byte - next byte is run length (don't output this 4th byte yet)
            if (i < data.length) {
              /** @type {int32} */
              const runLength = data[i++];  // Consume run length byte
              // Output runLength additional copies (we already output 3, not 4)
              for (let j = 0; j < runLength + 1; ++j) {  // +1 for the 4th byte we didn't output
                result.push(prevByte);
              }
            } else {
              // No run length byte, just output the 4th byte
              result.push(byte);
            }
            runCount = 0;
            prevByte = -1;
          }
          // runCount > 4 should never happen due to reset above
        } else {
          // Different byte, reset counter
          result.push(byte);
          prevByte = byte;
          runCount = 1;
        }
      }

      return result;
    }

    /**
     * @param {int32[]} mtfValues - Huffman-decoded symbols
     * @returns {int32[]} MTF positions with zero runs expanded
     */
    decodeRLE2(mtfValues) {
      /** @type {int32[]} */
      const result = [];
      /** @type {int32} */
      let i = 0;

      while (i < mtfValues.length) {
        /** @type {int32} */
        const symbol = mtfValues[i++];

        if (symbol === BZ_RUNA || symbol === BZ_RUNB) {
          // Decode run length
          /** @type {float64} */
          let runLength = 0;
          /** @type {float64} */
          let power = 1;

          --i; // Back up to reprocess
          while (i < mtfValues.length && (mtfValues[i] === BZ_RUNA || mtfValues[i] === BZ_RUNB)) {
            if (mtfValues[i] === BZ_RUNA) {
              runLength += power;
            } else {
              runLength += 2 * power;
            }
            power *= 2;
            ++i;
          }

          // The run is of the most recent symbol
          if (result.length === 0) {
            // In bzip2, a run at the start means repeat zeros
            for (let j = 0; j < runLength; ++j) {
              result.push(0);
            }
          } else {
            /** @type {int32} */
            const lastSymbol = result[result.length - 1];
            for (let j = 0; j < runLength; ++j) {
              result.push(lastSymbol);
            }
          }
        } else {
          // Symbols are offset by 1 because RUNA and RUNB take indices 0 and 1
          result.push(symbol - 1);
        }
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BZIP2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BZIP2Algorithm, BZIP2Instance, BurrowsWheelerTransform, MoveToFront, HuffmanCoding, BZip2CRC };
}));
