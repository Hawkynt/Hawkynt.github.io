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

  const BZ_CONSTANTS = {
    BASE_BLOCK_SIZE: 100000,
    MAX_ALPHA_SIZE: 258,
    MAX_CODE_LEN: 20,
    RUNA: 0,
    RUNB: 1,
    N_GROUPS: 6,
    G_SIZE: 50,
    N_ITERS: 4,
    MAX_SELECTORS: 2 + Math.floor(900000 / 50),

    // Magic numbers
    BLOCK_HEADER_MAGIC: 0x314159265359, // π
    STREAM_END_MAGIC: 0x177245385090,   // √π

    // File format
    MAGIC_BZ: 0x425A,  // 'BZ'
    VERSION: 0x68,     // 'h'
  };

  // ===== CRC32 IMPLEMENTATION =====

  class BZip2CRC {
    constructor() {
      this.value = 0xFFFFFFFF;
      this.initTable();
    }

    initTable() {
      // CRC-32/BZIP2 table: poly 0x04C11DB7, MSB-first, NOT reflected
      // (this differs from the zlib/PKZIP CRC-32 which is bit-reflected)
      this.table = new Uint32Array(256);
      for (let i = 0; i < 256; ++i) {
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

    update(byte) {
      const index = OpCodes.Xor32(OpCodes.Shr32(this.value, 24), byte)&0xFF;
      this.value = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(this.value, 8), this.table[index]));
    }

    updateRun(byte, length) {
      for (let i = 0; i < length; ++i) {
        this.update(byte);
      }
    }

    getValue() {
      // Final complement only - no byte/bit reversal (RefOut=false for this CRC variant)
      return OpCodes.ToUint32(OpCodes.Xor32(this.value, 0xFFFFFFFF));
    }
  }

  // ===== BIT STREAM CLASSES =====

  class BitWriter {
    constructor() {
      this.buffer = [];
      this.current = 0;
      this.bitsLeft = 32;
    }

    writeBit(bit) {
      --this.bitsLeft;
      this.current |= OpCodes.Shl32(bit&1, this.bitsLeft);

      if (this.bitsLeft <= 24) {
        this.buffer.push(OpCodes.Shr32(this.current, 24)&0xFF);
        this.current = OpCodes.ToUint32(OpCodes.Shl32(this.current, 8));
        this.bitsLeft += 8;
      }
    }

    writeBits(n, value) {
      for (let i = n - 1; i >= 0; --i) {
        this.writeBit(OpCodes.Shr32(value, i)&1);
      }
    }

    writeInt32(value) {
      this.writeBits(16, (OpCodes.Shr32(value, 16))&0xFFFF);
      this.writeBits(16, value&0xFFFF);
    }

    writeLong48(value) {
      // Handle 48-bit value (JavaScript numbers are safe up to 53 bits)
      this.writeBits(24, Math.floor(value / 16777216)&0xFFFFFF);
      this.writeBits(24, value&0xFFFFFF);
    }

    flush() {
      if (this.bitsLeft < 32) {
        this.buffer.push(OpCodes.Shr32(this.current, 24)&0xFF);
      }
      this.current = 0;
      this.bitsLeft = 32;
    }

    getBytes() {
      return this.buffer;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
      this.current = 0;
      this.bitsLeft = 0;
    }

    readBit() {
      if (this.bitsLeft === 0) {
        if (this.pos >= this.bytes.length) throw new Error('Unexpected end of stream');
        this.current = this.bytes[this.pos++];
        this.bitsLeft = 8;
      }
      --this.bitsLeft;
      return OpCodes.Shr32(this.current, this.bitsLeft)&1;
    }

    readBits(n) {
      let result = 0;
      for (let i = 0; i < n; ++i) {
        result = OpCodes.Shl32(result, 1)|this.readBit();
      }
      return result;
    }

    readInt32() {
      // ToUint32 matters here: plain `|` forces a SIGNED int32 result in JS even though
      // Shl32 itself returns unsigned, so values with bit 31 set (common for CRCs) would
      // otherwise come back negative and fail strict comparison against unsigned CRCs.
      return OpCodes.ToUint32(OpCodes.Shl32(this.readBits(16), 16)|this.readBits(16));
    }

    readLong48() {
      return this.readBits(24) * 16777216 + this.readBits(24);
    }
  }

  // ===== BURROWS-WHEELER TRANSFORM =====

  class BurrowsWheelerTransform {
    /**
     * Build the sorted order of all n cyclic rotations of data in O(n log^2 n).
     * Uses prefix-doubling suffix-array construction on the doubled string
     * (data concatenated with itself) so no sentinel character is needed and
     * ties between genuinely-identical (periodic) rotations resolve consistently.
     * A naive O(n) full-rotation comparator (as a plain sort comparator) is
     * pathological for repeat-heavy input (e.g. long runs of the same byte,
     * which is exactly the common case for compressible data) - this avoids that.
     * @param {uint8[]} data
     * @returns {uint32[]} rotation start indices (0..n-1), sorted ascending by rotation content
     */
    static _sortedRotationOrder(data) {
      const n = data.length;
      const m = 2 * n;

      let sa = new Int32Array(m);
      for (let i = 0; i < m; ++i) sa[i] = i;

      let rank = new Int32Array(m);
      for (let i = 0; i < m; ++i) rank[i] = data[i % n];

      let tmp = new Int32Array(m);

      for (let k = 1; ; k *= 2) {
        sa.sort((a, b) => {
          const ra = rank[a], rb = rank[b];
          if (ra !== rb) return ra - rb;
          const ra2 = a + k < m ? rank[a + k] : -1;
          const rb2 = b + k < m ? rank[b + k] : -1;
          return ra2 - rb2;
        });

        tmp[sa[0]] = 0;
        let classes = 1;
        for (let i = 1; i < m; ++i) {
          const prev = sa[i - 1], cur = sa[i];
          const prevRank2 = prev + k < m ? rank[prev + k] : -1;
          const curRank2 = cur + k < m ? rank[cur + k] : -1;
          if (rank[prev] !== rank[cur] || prevRank2 !== curRank2) ++classes;
          tmp[cur] = classes - 1;
        }

        const swapRank = rank; rank = tmp; tmp = swapRank;

        if (classes >= m || k >= m) break;
      }

      // Keep only the starting positions of the first copy (0..n-1), already in sorted order.
      const order = new Uint32Array(n);
      let oi = 0;
      for (let i = 0; i < m && oi < n; ++i) {
        if (sa[i] < n) order[oi++] = sa[i];
      }
      return order;
    }

    static transform(data) {
      if (data.length === 0) return { transformed: [], primaryIndex: 0 };
      if (data.length === 1) return { transformed: [...data], primaryIndex: 0 };

      const n = data.length;
      const order = BurrowsWheelerTransform._sortedRotationOrder(data);

      // Find primary index (where original string is)
      let primaryIndex = 0;
      for (let i = 0; i < n; ++i) {
        if (order[i] === 0) {
          primaryIndex = i;
          break;
        }
      }

      // Extract last column (L column)
      const transformed = new Uint8Array(n);
      for (let i = 0; i < n; ++i) {
        const start = order[i];
        transformed[i] = data[(start + n - 1) % n];
      }

      return { transformed: Array.from(transformed), primaryIndex };
    }

    static inverseTransform(data, primaryIndex) {
      if (data.length === 0) return [];
      if (data.length === 1) return [...data];

      const n = data.length;

      // Count frequency of each byte
      const counts = new Uint32Array(256);
      for (let i = 0; i < n; ++i) {
        ++counts[data[i]];
      }

      // Calculate cumulative counts
      const cumCounts = new Uint32Array(256);
      let sum = 0;
      for (let i = 0; i < 256; ++i) {
        cumCounts[i] = sum;
        sum += counts[i];
      }

      // Build transformation vector
      const transform = new Uint32Array(n);
      const tempCounts = new Uint32Array(256);

      for (let i = 0; i < n; ++i) {
        const byte = data[i];
        transform[cumCounts[byte] + tempCounts[byte]] = i;
        ++tempCounts[byte];
      }

      // Follow the transformation chain
      const result = new Uint8Array(n);
      let current = primaryIndex;

      for (let i = 0; i < n; ++i) {
        current = transform[current];
        result[i] = data[current];
      }

      return Array.from(result);
    }
  }

  // ===== MOVE-TO-FRONT ENCODING =====

  class MoveToFront {
    static encode(data, inUse) {
      const symbols = [];
      for (let i = 0; i < 256; ++i) {
        if (inUse[i]) symbols.push(i);
      }

      const result = [];
      for (const byte of data) {
        const pos = symbols.indexOf(byte);
        result.push(pos);
        if (pos > 0) {
          symbols.splice(pos, 1);
          symbols.unshift(byte);
        }
      }

      return result;
    }

    static decode(data, seqToUnseq) {
      const symbols = [...seqToUnseq];
      const result = [];

      for (const pos of data) {
        const byte = symbols[pos];
        result.push(byte);
        if (pos > 0) {
          symbols.splice(pos, 1);
          symbols.unshift(byte);
        }
      }

      return result;
    }
  }

  // ===== HUFFMAN CODING =====

  class HuffmanCoding {
    static makeCodeLengths(frequencies, maxLen) {
      const alphaSize = frequencies.length;
      const heap = [];
      const weight = new Int32Array(alphaSize * 2);
      const parent = new Int32Array(alphaSize * 2);

      // Initialize weights
      for (let i = 0; i < alphaSize; ++i) {
        weight[i + 1] = OpCodes.Shl32((frequencies[i] === 0 ? 1 : frequencies[i]), 8);
      }

      while (true) {
        let nNodes = alphaSize;
        let nHeap = 0;

        heap.length = 0;
        heap[0] = 0;
        weight[0] = 0;
        parent[0] = -2;

        // Build initial heap
        // NOTE: this is a 1-indexed binary heap stored in a plain array; positions must be
        // written by INDEX (heap[nHeap] = x), never with .push() - the heap shrinks and
        // regrows as nodes are extracted/combined below, so .push() (which always appends
        // at the current array length) desyncs from the logical heap position nHeap as soon
        // as the array has been left "long" by an earlier extraction.
        for (let i = 1; i <= alphaSize; ++i) {
          parent[i] = -1;
          ++nHeap;
          heap[nHeap] = i;

          // Sift up
          let zz = nHeap;
          let tmp = heap[zz];
          while (weight[tmp] < weight[heap[OpCodes.Shr32(zz, 1)]]) {
            heap[zz] = heap[OpCodes.Shr32(zz, 1)];
            zz = OpCodes.Shr32(zz, 1);
          }
          heap[zz] = tmp;
        }

        // Build Huffman tree
        while (nHeap > 1) {
          // Extract min
          const n1 = heap[1];
          heap[1] = heap[nHeap--];

          // Sift down
          let zz = 1;
          let tmp = heap[zz];
          while (true) {
            let yy = OpCodes.Shl32(zz, 1);
            if (yy > nHeap) break;
            if (yy < nHeap && weight[heap[yy + 1]] < weight[heap[yy]]) ++yy;
            if (weight[tmp] < weight[heap[yy]]) break;
            heap[zz] = heap[yy];
            zz = yy;
          }
          heap[zz] = tmp;

          // Extract second min
          const n2 = heap[1];
          heap[1] = heap[nHeap--];

          // Sift down again
          zz = 1;
          tmp = heap[zz];
          while (true) {
            let yy = OpCodes.Shl32(zz, 1);
            if (yy > nHeap) break;
            if (yy < nHeap && weight[heap[yy + 1]] < weight[heap[yy]]) ++yy;
            if (weight[tmp] < weight[heap[yy]]) break;
            heap[zz] = heap[yy];
            zz = yy;
          }
          heap[zz] = tmp;

          // Combine nodes
          ++nNodes;
          parent[n1] = parent[n2] = nNodes;

          const w1 = weight[n1]&0xFFFFFF00;
          const w2 = weight[n2]&0xFFFFFF00;
          const d1 = weight[n1]&0xFF;
          const d2 = weight[n2]&0xFF;

          weight[nNodes] = (w1 + w2)|(1 + (d1 > d2 ? d1 : d2));
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
        const lengths = new Uint8Array(alphaSize);
        let tooLong = false;

        for (let i = 1; i <= alphaSize; ++i) {
          let j = 0;
          let k = i;
          while (parent[k] >= 0) {
            k = parent[k];
            ++j;
          }
          lengths[i - 1] = j;
          if (j > maxLen) tooLong = true;
        }

        if (!tooLong) return Array.from(lengths);

        // If too long, adjust weights and retry
        for (let i = 1; i <= alphaSize; ++i) {
          let j = OpCodes.Shr32(weight[i], 8);
          j = 1 + OpCodes.Shr32(j, 1);
          weight[i] = OpCodes.Shl32(j, 8);
        }
      }
    }

    static assignCodes(lengths, minLen, maxLen) {
      const codes = new Uint32Array(lengths.length);
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
 * BZIP2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BZIP2Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.blockSize100k = 9; // Default to highest compression
    }

    set blockSize(size) {
      if (size < 1 || size > 9) {
        throw new Error(`Invalid block size: ${size} (must be 1-9)`);
      }
      this.blockSize100k = size;
    }

    get blockSize() {
      return this.blockSize100k;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = this.isInverse ?
        this.decompress(this.inputBuffer) :
        this.compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      const bw = new BitWriter();

      // File header: 'B' 'Z' 'h' <level digit>
      bw.writeBits(8, 0x42);
      bw.writeBits(8, 0x5A);
      bw.writeBits(8, 0x68);
      bw.writeBits(8, 0x30 + this.blockSize100k);

      const maxBlockBytes = BZ_CONSTANTS.BASE_BLOCK_SIZE * this.blockSize100k;
      const n = data.length;
      let computedStreamCRC = 0;
      let pos = 0;

      while (pos < n) {
        const blockStart = pos;
        const rle1 = [];

        // Greedily consume runs (RLE1) until the encoded block would exceed the limit.
        while (pos < n) {
          const byte = data[pos];
          const capRun = Math.min(n - pos, 259); // 4 literal + up to 255 in the length byte
          let runLen = 1;
          while (runLen < capRun && data[pos + runLen] === byte) ++runLen;

          const addBytes = runLen < 4 ? runLen : 5;
          if (rle1.length > 0 && rle1.length + addBytes > maxBlockBytes) break;

          if (runLen < 4) {
            for (let j = 0; j < runLen; ++j) rle1.push(byte);
          } else {
            rle1.push(byte, byte, byte, byte, runLen - 4);
          }
          pos += runLen;
        }

        const blockCRC = this.encodeBlock(bw, rle1, data, blockStart, pos);
        computedStreamCRC = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(computedStreamCRC, 1)|OpCodes.Shr32(computedStreamCRC, 31), blockCRC));
      }

      bw.writeLong48(BZ_CONSTANTS.STREAM_END_MAGIC);
      bw.writeInt32(computedStreamCRC);
      bw.flush();

      return bw.getBytes();
    }

    /**
     * Encode a single block: BWT -> MTF -> RLE2 -> Huffman, with block/stream headers.
     * @param {BitWriter} bw - output bit writer
     * @param {uint8[]} rle1Data - RLE1-encoded payload for this block
     * @param {uint8[]} originalData - full source buffer (for block CRC over the pre-RLE1 bytes)
     * @param {number} blockStart - start offset (inclusive) of this block within originalData
     * @param {number} blockEnd - end offset (exclusive) of this block within originalData
     * @returns {number} the block CRC (also used to update the running stream CRC)
     */
    encodeBlock(bw, rle1Data, originalData, blockStart, blockEnd) {
      // Block CRC is computed over the original (pre-RLE1) bytes belonging to this block
      const crc = new BZip2CRC();
      crc.reset();
      for (let i = blockStart; i < blockEnd; ++i) crc.update(originalData[i]);
      const blockCRC = crc.getValue();

      const { transformed, primaryIndex } = BurrowsWheelerTransform.transform(rle1Data);

      const inUse = new Array(256).fill(false);
      for (let i = 0; i < transformed.length; ++i) inUse[transformed[i]] = true;
      const seqToUnseq = [];
      for (let i = 0; i < 256; ++i) if (inUse[i]) seqToUnseq.push(i);

      const mtfPositions = MoveToFront.encode(transformed, inUse);

      const alphaSize = seqToUnseq.length + 2; // + RUNA/RUNB..EOB
      const eobSymbol = alphaSize - 1;
      const mtfSymbols = this.encodeRLE2(mtfPositions, eobSymbol);

      const freq = new Array(alphaSize).fill(0);
      for (let i = 0; i < mtfSymbols.length; ++i) ++freq[mtfSymbols[i]];

      const lengths = HuffmanCoding.makeCodeLengths(freq, BZ_CONSTANTS.MAX_CODE_LEN);
      let minLen = BZ_CONSTANTS.MAX_CODE_LEN, maxLen = 1;
      for (let i = 0; i < lengths.length; ++i) {
        if (lengths[i] < minLen) minLen = lengths[i];
        if (lengths[i] > maxLen) maxLen = lengths[i];
      }
      const codes = HuffmanCoding.assignCodes(lengths, minLen, maxLen);

      // Minimum legal number of tables is 2; use two identical tables and always
      // select table 0 (a legal, if not compression-optimal, encoding).
      const nGroups = 2;
      const nSelectors = Math.max(1, Math.ceil(mtfSymbols.length / BZ_CONSTANTS.G_SIZE));

      // ===== Block header =====
      bw.writeLong48(BZ_CONSTANTS.BLOCK_HEADER_MAGIC);
      bw.writeInt32(blockCRC);
      bw.writeBit(0); // not randomized
      bw.writeBits(24, primaryIndex);

      // Used-symbol bitmap (16 group bits + up to 16x16 detail bits)
      const inUse16 = new Array(16).fill(false);
      for (let i = 0; i < 256; ++i) if (inUse[i]) inUse16[Math.floor(i / 16)] = true;
      for (let g = 0; g < 16; ++g) bw.writeBit(inUse16[g] ? 1 : 0);
      for (let g = 0; g < 16; ++g) {
        if (!inUse16[g]) continue;
        for (let j = 0; j < 16; ++j) bw.writeBit(inUse[g * 16 + j] ? 1 : 0);
      }

      bw.writeBits(3, nGroups);
      bw.writeBits(15, nSelectors);

      // Selector list: all point at table 0, encoded as MTF value 0 (a single '0' bit each)
      for (let i = 0; i < nSelectors; ++i) bw.writeBit(0);

      // Huffman code-length tables (two identical copies)
      for (let t = 0; t < nGroups; ++t) this.encodeHuffmanLengths(bw, lengths);

      // Symbol stream
      for (let i = 0; i < mtfSymbols.length; ++i) {
        const sym = mtfSymbols[i];
        bw.writeBits(lengths[sym], codes[sym]);
      }

      return blockCRC;
    }

    /**
     * RLE2 / zero-run coding: runs of MTF value 0 are coded via a bijective base-2
     * representation using RUNA(=1x)/RUNB(=2x) symbols; non-zero MTF position p becomes
     * symbol p+1 (0 and 1 are reserved for RUNA/RUNB). Terminated by the EOB symbol.
     * @param {number[]} mtfPositions - MTF-encoded positions
     * @param {number} eobSymbol - end-of-block symbol value (alphaSize - 1)
     * @returns {number[]} Huffman-alphabet symbol stream
     */
    encodeRLE2(mtfPositions, eobSymbol) {
      const result = [];
      let i = 0;
      const n = mtfPositions.length;

      while (i < n) {
        if (mtfPositions[i] === 0) {
          let runLen = 0;
          while (i < n && mtfPositions[i] === 0) { ++runLen; ++i; }

          let remaining = runLen;
          while (remaining > 0) {
            if (remaining % 2 === 1) {
              result.push(BZ_CONSTANTS.RUNA);
              remaining = Math.floor((remaining - 1) / 2);
            } else {
              result.push(BZ_CONSTANTS.RUNB);
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
     * @param {number[]} lengths - code length per symbol (0..alphaSize-1)
     */
    encodeHuffmanLengths(bw, lengths) {
      let curr = lengths[0];
      bw.writeBits(5, curr);

      for (let i = 0; i < lengths.length; ++i) {
        const target = lengths[i];
        if (curr === target) {
          bw.writeBit(0);
          continue;
        }
        bw.writeBit(1);
        while (true) {
          if (curr < target) { bw.writeBit(0); ++curr; }
          else { bw.writeBit(1); --curr; }
          if (curr === target) { bw.writeBit(0); break; }
          bw.writeBit(1);
        }
      }
    }

    decompress(compressedData) {
      const reader = new BitReader(compressedData);

      // Read and validate file header
      const magic = OpCodes.Shl32(reader.readBits(8), 8)|reader.readBits(8);
      if (magic !== BZ_CONSTANTS.MAGIC_BZ) {
        throw new Error('Invalid BZIP2 magic number');
      }

      const version = reader.readBits(8);
      if (version !== BZ_CONSTANTS.VERSION) {
        throw new Error(`Unsupported BZIP2 version: ${String.fromCharCode(version)}`);
      }

      const level = reader.readBits(8);
      if (level < 0x31 || level > 0x39) { // '1' to '9'
        throw new Error(`Invalid BZIP2 level: ${String.fromCharCode(level)}`);
      }

      this.blockSize100k = level - 0x30;

      // Decompress all blocks
      const output = [];
      const streamCRC = new BZip2CRC();
      streamCRC.reset();

      let computedStreamCRC = 0;

      while (true) {
        // Read block or stream end magic
        const blockMagic = reader.readLong48();

        if (blockMagic === BZ_CONSTANTS.STREAM_END_MAGIC) {
          const expectedStreamCRC = reader.readInt32();
          if (expectedStreamCRC !== computedStreamCRC) {
            throw new Error(`Stream CRC mismatch: expected ${expectedStreamCRC.toString(16)}, got ${computedStreamCRC.toString(16)}`);
          }
          break;
        }

        if (blockMagic !== BZ_CONSTANTS.BLOCK_HEADER_MAGIC) {
          throw new Error(`Invalid block magic: ${blockMagic.toString(16)}`);
        }

        // Read block CRC
        const blockCRC = reader.readInt32();

        // Read randomization flag (usually 0)
        const randomized = reader.readBit();
        if (randomized) {
          throw new Error('Randomized blocks not supported');
        }

        // Decode block
        const blockData = this.decodeBlock(reader);

        // Verify block CRC
        const crc = new BZip2CRC();
        crc.reset();
        for (const byte of blockData) {
          crc.update(byte);
        }
        const computedCRC = crc.getValue();

        if (computedCRC !== blockCRC) {
          throw new Error(`Block CRC mismatch: expected ${blockCRC.toString(16)}, got ${computedCRC.toString(16)}`);
        }

        // Update stream CRC
        computedStreamCRC = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(computedStreamCRC, 1)|OpCodes.Shr32(computedStreamCRC, 31), computedCRC));

        // Append block data without spread operator to avoid call stack issues with large arrays
        for (let i = 0; i < blockData.length; ++i) {
          output.push(blockData[i]);
        }
      }

      return output;
    }

    decodeBlock(reader) {
      // Read original pointer
      const origPtr = reader.readBits(24);

      // Read mapping table
      const inUse16 = [];
      for (let i = 0; i < 16; ++i) {
        inUse16.push(reader.readBit());
      }

      const inUse = new Array(256).fill(false);
      const seqToUnseq = [];

      for (let i = 0; i < 16; ++i) {
        if (inUse16[i]) {
          for (let j = 0; j < 16; ++j) {
            if (reader.readBit()) {
              const symbol = i * 16 + j;
              inUse[symbol] = true;
              seqToUnseq.push(symbol);
            }
          }
        }
      }

      const alphaSize = seqToUnseq.length + 2; // +2 for RUNA and RUNB

      // Read number of Huffman tables
      const nGroups = reader.readBits(3);
      if (nGroups < 2 || nGroups > 6) {
        throw new Error(`Invalid number of Huffman groups: ${nGroups}`);
      }

      // Read number of selectors
      const nSelectors = reader.readBits(15);

      // Read selectors with MTF encoding
      const selectorMTF = [];
      for (let i = 0; i < nSelectors; ++i) {
        let j = 0;
        while (reader.readBit()) ++j;
        selectorMTF.push(j);
      }

      // Decode selectors using MTF
      const pos = new Uint8Array(nGroups);
      for (let i = 0; i < nGroups; ++i) pos[i] = i;

      const selectors = new Uint8Array(nSelectors);
      for (let i = 0; i < nSelectors; ++i) {
        const v = selectorMTF[i];
        const tmp = pos[v];
        for (let j = v; j > 0; --j) pos[j] = pos[j - 1];
        pos[0] = tmp;
        selectors[i] = tmp;
      }

      // Read Huffman code lengths
      const lengths = [];
      for (let t = 0; t < nGroups; ++t) {
        let curr = reader.readBits(5);
        const tableLengths = new Uint8Array(alphaSize);

        for (let i = 0; i < alphaSize; ++i) {
          // Read code length using marker bit + 2-bit adjustment pattern
          let markerBit = reader.readBit();
          while (markerBit !== 0) {
            const nextTwoBits = reader.readBits(2);
            curr += 1 - (nextTwoBits&2); // +1 if bit 1 is 0, -1 if bit 1 is 1
            if (curr < 1 || curr > 20) {
              throw new Error(`Invalid Huffman code length: ${curr}`);
            }
            markerBit = nextTwoBits&1; // bit 0 is the next marker
          }
          tableLengths[i] = curr;
        }
        lengths.push(tableLengths);
      }

      // Build Huffman decoding tables
      const tables = this.createDecodingTables(lengths, alphaSize);

      // Decode MTF values using Huffman tables
      const mtfValues = [];
      let groupNo = 0;
      let groupPos = BZ_CONSTANTS.G_SIZE - 1;

      const maxBlockSize = BZ_CONSTANTS.BASE_BLOCK_SIZE * this.blockSize100k;

      // Select initial table
      let tableIdx = selectors[groupNo];
      if (tableIdx === undefined || tableIdx >= tables.length) {
        throw new Error(`Invalid table index: ${tableIdx}`);
      }
      let table = tables[tableIdx];

      // Read first symbol
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
          groupPos = BZ_CONSTANTS.G_SIZE;
          tableIdx = selectors[groupNo];
          if (tableIdx === undefined || tableIdx >= tables.length) {
            throw new Error(`Invalid table index: ${tableIdx}`);
          }
          table = tables[tableIdx];
        }
        --groupPos;

        // Read next symbol
        symbol = this.decodeSymbol(reader, table, lengths[tableIdx]);
      }

      // Combined RLE2 + MTF decoding (as per bzip2 spec, these are interleaved)
      const decoded = this.decodeRLE2andMTF(mtfValues, seqToUnseq);

      // Inverse BWT
      const bwtDecoded = BurrowsWheelerTransform.inverseTransform(decoded, origPtr);

      // RLE1 inverse decoding (final stage)
      const result = this.decodeRLE1(bwtDecoded);

      return result;
    }

    createDecodingTables(lengths, alphaSize) {
      const tables = [];

      for (const tableLengths of lengths) {
        let minLen = 20, maxLen = 0;
        for (const len of tableLengths) {
          if (len > 0) {
            if (len < minLen) minLen = len;
            if (len > maxLen) maxLen = len;
          }
        }

        const limit = new Int32Array(maxLen + 2);
        const base = new Int32Array(maxLen + 1);
        const perm = new Int32Array(alphaSize);

        // Build permutation array sorted by code length
        let pp = 0;
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

        tables.push({ minLen, maxLen, limit, base, perm });
      }

      return tables;
    }

    decodeSymbol(reader, table, lengths) {
      // Read minimum length bits first
      let zn = table.minLen;
      let zvec = reader.readBits(table.minLen);

      // Read additional bits until we find the code
      while (zvec >= table.limit[zn]) {
        if (++zn > BZ_CONSTANTS.MAX_CODE_LEN) {
          throw new Error('Invalid Huffman code');
        }
        zvec = OpCodes.Shl32(zvec, 1)|reader.readBit();
      }

      const permIndex = zvec - table.base[zn];
      if (permIndex < 0 || permIndex >= table.perm.length) {
        throw new Error(`Invalid permutation index: ${permIndex}`);
      }

      return table.perm[permIndex];
    }

    decodeRLE2andMTF(mtfValues, seqToUnseq) {
      // Combined RLE2 + MTF decoding as per bzip2 specification
      // RLE2 and MTF are interleaved - RUNA/RUNB repeat yy[0] from MTF state
      const result = [];
      const yy = [...seqToUnseq]; // MTF state
      let i = 0;

      while (i < mtfValues.length) {
        const symbol = mtfValues[i++];

        if (symbol === BZ_CONSTANTS.RUNA || symbol === BZ_CONSTANTS.RUNB) {
          // Decode run length using binary representation
          let runLength = 0;
          let power = 1;

          --i; // Back up to reprocess
          while (i < mtfValues.length && (mtfValues[i] === BZ_CONSTANTS.RUNA || mtfValues[i] === BZ_CONSTANTS.RUNB)) {
            if (mtfValues[i] === BZ_CONSTANTS.RUNA) {
              runLength += power;
            } else {
              runLength += 2 * power;
            }
            power *= 2;
            ++i;
          }

          // Repeat yy[0] (most recent MTF character)
          const ch = yy[0];
          for (let j = 0; j < runLength; ++j) {
            result.push(ch);
          }
        } else {
          // Regular symbol: output yy[symbol-1] and update MTF state
          const pos = symbol - 1;
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

    decodeRLE1(data) {
      // RLE1 inverse decoding (final stage of bzip2 decompression)
      // When 4 identical bytes AAAA are seen, the next byte N indicates
      // to output N additional copies of A (so total is 4 + N copies)
      // The run length byte N is NOT output - it's metadata only
      const result = [];
      let i = 0;
      let prevByte = -1;
      let runCount = 0;

      while (i < data.length) {
        const byte = data[i++];

        if (byte === prevByte) {
          ++runCount;
          if (runCount < 4) {
            // Still accumulating run, output the byte
            result.push(byte);
          } else if (runCount === 4) {
            // Fourth consecutive byte - next byte is run length (don't output this 4th byte yet)
            if (i < data.length) {
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

    decodeRLE2(mtfValues) {
      const result = [];
      let i = 0;

      while (i < mtfValues.length) {
        const symbol = mtfValues[i++];

        if (symbol === BZ_CONSTANTS.RUNA || symbol === BZ_CONSTANTS.RUNB) {
          // Decode run length
          let runLength = 0;
          let power = 1;

          --i; // Back up to reprocess
          while (i < mtfValues.length && (mtfValues[i] === BZ_CONSTANTS.RUNA || mtfValues[i] === BZ_CONSTANTS.RUNB)) {
            if (mtfValues[i] === BZ_CONSTANTS.RUNA) {
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
