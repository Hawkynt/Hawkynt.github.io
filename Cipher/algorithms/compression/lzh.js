/*
 * LZH (-lh5-) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZH is the classic LHA/LHarc "-lh5-" method: an LZSS sliding-window
 * matcher (8 KiB window, minimum match length 3, maximum 256) whose
 * output symbol stream is entropy-coded with two Huffman trees rebuilt
 * per block of 16384 tokens:
 *   - a combined literal/length tree of 510 symbols (0-255 are literal
 *     bytes, 256-509 are match-length codes for lengths 3..256). Its code
 *     lengths are themselves transmitted through a small 19-symbol
 *     "T tree" whose own lengths are written as 3-bit values with a unary
 *     extension, preceded by a 5-bit symbol count and carrying the classic
 *     2-bit skip field after index 2;
 *   - a position tree, one symbol per offset slot. Slot 0 and 1 carry no
 *     extra bits; slot s (s of at least 2) is followed by (s - 1) raw bits
 *     holding the offset minus 2^(s-1). For -lh5- the position tree header
 *     uses a 4-bit symbol count.
 *
 * Blocks are preceded by a 16-bit token count. All bit fields are written
 * most-significant-bit first. The stream is prefixed with a 4-byte
 * little-endian uncompressed length so it round-trips standalone.
 *
 * Documentation and background:
 *   - Haruhiko Okumura, "LZHUF" (1989) - the LZSS plus Huffman encoder that
 *     established the lh-family design.
 *   - https://en.wikipedia.org/wiki/LHA_(file_format) - overview of the
 *     -lh5- method: 8 KiB window, minimum match length 3, dynamic Huffman
 *     coding of the literal/length and position alphabets.
 *   - https://en.wikipedia.org/wiki/LZ77_and_LZ78 - background on the
 *     LZSS sliding-window matching this method is built on.
 *
 * Written from the published description of the method. It carries the
 * -lh5- symbol layout but not the surrounding .lzh archive container, so
 * output is a self-contained bitstream rather than an archive member.
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
  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== LH5 CONSTANTS =====

  const WINDOW_SIZE = 8192;                 // 2^13, the -lh5- window
  const WINDOW_MASK = 8191;
  const P_BIT = 4;                          // position-tree header width for -lh5-
  const N_CHAR = 256;                       // literal symbols
  const MAX_MATCH = 256;
  const THRESHOLD = 3;                      // minimum encodable match length
  const NUM_CODES = 510;                    // N_CHAR + MAX_MATCH - THRESHOLD + 1
  const BLOCK_SIZE = 16384;                 // tokens per Huffman block
  const MAX_CODE_BITS = 16;
  const MAX_POSITION_BITS = 17;
  const NUM_CODE_LENGTH_SYMBOLS = 19;
  const T_TREE_MAX_BITS = 7;

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;
  const MAX_CHAIN_DEPTH = 128;

  /**
   * @param {int32} size - Number of entries
   * @returns {int32[]} Plain array of zeros
   */
  function zeroArray(size) {
    /** @type {int32[]} */
    const arr = new Array(size);
    for (let i = 0; i < size; ++i) {
      arr[i] = 0;
    }
    return arr;
  }

  // ===== BIT STREAM HELPERS (most-significant-bit first) =====

  class MsbBitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} bit - Bit to append (low bit used)
     */
    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8) {
        return;
      }

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} value - Value whose low count bits are written
     * @param {int32} count - Bit count, most significant first
     */
    writeBits(value, count) {
      for (let i = 0; i < count; ++i) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, count - 1 - i), 1));
      }
    }

    flush() {
      if (this.bitsInBuffer <= 0) {
        return;
      }

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class MsbBitReader {
    /**
     * @param {uint8[]} bytes - Input
     * @param {int32} start - First byte of the bit stream
     */
    constructor(bytes, start) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = start;
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @param {int32} count - Bit count (zero bits past the end)
     * @returns {uint32} Bits read, most significant first
     */
    readBits(count) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < count; ++i) {
        if (this.bitsInBuffer === 0) {
          /** @type {uint32} */
          let next = 0;
          if (this.pos < this.bytes.length) {
            next = this.bytes[this.pos++];
          }
          this.buffer = next;
          this.bitsInBuffer = 8;
        }
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(this.buffer, this.bitsInBuffer - 1), 1);
        --this.bitsInBuffer;
        result = OpCodes.Or32(OpCodes.Shl32(result, 1), bit);
      }
      return result;
    }
  }

  // ===== CANONICAL HUFFMAN =====

  // Canonical code assignment: shortest lengths first, symbols of equal
  // length in ascending symbol order.
  /**
   * @param {int32[]} lengths - Code length per symbol
   * @returns {int32[]} Code per symbol
   */
  function buildCanonicalCodes(lengths) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > maxLen) {
        maxLen = lengths[i];
      }
    }

    /** @type {int32[]} */
    const codes = zeroArray(lengths.length);
    if (maxLen === 0) {
      return codes;
    }

    /** @type {int32[]} */
    const blCount = zeroArray(maxLen + 1);
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0) {
        ++blCount[lengths[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = zeroArray(maxLen + 1);
    /** @type {int32} */
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0) {
        codes[i] = nextCode[lengths[i]]++;
      }
    }

    return codes;
  }

  /**
   * Canonical decoder: first code and symbols per code length.
   */
  class LzhDecoder {
    /**
     * @param {int32[]} firstCode - First code per length
     * @param {int32[][]} symbolsByLength - Symbols per length in code order
     * @param {int32} maxBits - Longest code length considered
     */
    constructor(firstCode, symbolsByLength, maxBits) {
      /** @type {int32[]} */
      this.firstCode = firstCode;
      /** @type {int32[][]} */
      this.symbolsByLength = symbolsByLength;
      /** @type {int32} */
      this.maxBits = maxBits;
    }
  }

  // Decode side of the same numbering. Lengths above maxBits are excluded
  // from the canonical numbering, matching the reference decode table.
  /**
   * @param {int32[]} lengths - Code length per symbol
   * @param {int32} maxBits - Longest code length considered
   * @returns {LzhDecoder} Decoder
   */
  function buildDecoder(lengths, maxBits) {
    /** @type {int32[]} */
    const blCount = zeroArray(maxBits + 1);
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0 && lengths[i] <= maxBits) {
        ++blCount[lengths[i]];
      }
    }

    /** @type {int32[]} */
    const firstCode = zeroArray(maxBits + 1);
    /** @type {int32} */
    let code = 0;
    for (let b = 1; b <= maxBits; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      firstCode[b] = code;
    }

    /** @type {int32[][]} */
    const symbolsByLength = [];
    for (let b = 0; b <= maxBits; ++b) {
      /** @type {int32[]} */
      const bucket = [];
      symbolsByLength.push(bucket);
    }
    for (let sym = 0; sym < lengths.length; ++sym) {
      /** @type {int32} */
      const len = lengths[sym];
      if (len === 0 || len > maxBits) {
        continue;
      }
      symbolsByLength[len].push(sym);
    }

    return new LzhDecoder(firstCode, symbolsByLength, maxBits);
  }

  /**
   * @param {MsbBitReader} reader - Input bits
   * @param {LzhDecoder} decoder - Canonical decoder
   * @returns {int32} Decoded symbol
   */
  function decodeSymbol(reader, decoder) {
    /** @type {int32} */
    let code = 0;
    for (let len = 1; len <= decoder.maxBits; ++len) {
      /** @type {uint32} */
      const bit = reader.readBits(1);
      code = OpCodes.Or32(OpCodes.Shl32(code, 1), bit);
      /** @type {int32[]} */
      const list = decoder.symbolsByLength[len];
      if (list.length > 0) {
        /** @type {int32} */
        const index = code - decoder.firstCode[len];
        if (index >= 0 && index < list.length) {
          return list[index];
        }
      }
    }
    throw new Error('LZH: invalid Huffman code in stream');
  }

  // Huffman length assignment with deterministic tie-breaking (lowest
  // frequency first, then insertion order), depth-clamped to maxBits and
  // then Kraft-corrected. The working list is kept sorted by
  // (frequency, insertion number) - a total order, since insertion numbers
  // are unique.
  /**
   * @param {int32[]} frequencies - Frequency per symbol
   * @param {int32} maxBits - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildCodeLengths(frequencies, maxBits) {
    /** @type {int32} */
    const n = frequencies.length;
    /** @type {int32[]} */
    const lengths = zeroArray(n);
    /** @type {int32[]} */
    const symbolIds = [];
    /** @type {float64[]} */
    const symbolFreqs = [];
    for (let i = 0; i < n; ++i) {
      if (frequencies[i] > 0) {
        symbolIds.push(i);
        symbolFreqs.push(frequencies[i]);
      }
    }

    if (symbolIds.length === 0) {
      return lengths;
    }
    if (symbolIds.length === 1) {
      lengths[symbolIds[0]] = 1;
      return lengths;
    }

    /** @type {int32} */
    const nodeCount = symbolIds.length * 2 - 1;
    /** @type {int32[]} */
    const leftChild = new Array(nodeCount);
    /** @type {int32[]} */
    const rightChild = new Array(nodeCount);
    /** @type {int32[]} */
    const nodeSym = new Array(nodeCount);
    for (let i = 0; i < nodeCount; ++i) {
      leftChild[i] = -1;
      rightChild[i] = -1;
      nodeSym[i] = -1;
    }

    /** @type {float64[]} */
    const sortedFreq = [];
    /** @type {int32[]} */
    const sortedTie = [];
    /** @type {int32[]} */
    const sortedNode = [];
    /** @type {int32} */
    let tieBreaker = 0;

    for (let i = 0; i < symbolIds.length; ++i) {
      nodeSym[i] = symbolIds[i];
      tieBreaker = insertSorted(sortedFreq, sortedTie, sortedNode, symbolFreqs[i], tieBreaker, i);
    }

    /** @type {int32} */
    let nextNode = symbolIds.length;
    while (sortedNode.length > 1) {
      /** @type {float64} */
      const firstFreq = sortedFreq.shift();
      sortedTie.shift();
      /** @type {int32} */
      const firstNode = sortedNode.shift();
      /** @type {float64} */
      const secondFreq = sortedFreq.shift();
      sortedTie.shift();
      /** @type {int32} */
      const secondNode = sortedNode.shift();
      /** @type {int32} */
      const parent = nextNode++;
      leftChild[parent] = firstNode;
      rightChild[parent] = secondNode;
      tieBreaker = insertSorted(sortedFreq, sortedTie, sortedNode, firstFreq + secondFreq, tieBreaker, parent);
    }

    /** @type {int32[]} */
    const stackNode = [sortedNode[0]];
    /** @type {int32[]} */
    const stackDepth = [0];
    while (stackNode.length > 0) {
      /** @type {int32} */
      const node = stackNode.pop();
      /** @type {int32} */
      const depth = stackDepth.pop();
      if (leftChild[node] === -1) {
        lengths[nodeSym[node]] = Math.min(depth, maxBits);
      } else {
        if (leftChild[node] >= 0) {
          stackNode.push(leftChild[node]);
          stackDepth.push(depth + 1);
        }
        if (rightChild[node] >= 0) {
          stackNode.push(rightChild[node]);
          stackDepth.push(depth + 1);
        }
      }
    }

    fixCodeLengths(lengths, maxBits);
    return lengths;
  }

  /**
   * Inserts (freq, next insertion number, node) into the sorted working list:
   * after every entry with a lower frequency, or an equal frequency and a lower
   * insertion number.
   * @param {float64[]} sortedFreq - Frequencies, ascending
   * @param {int32[]} sortedTie - Insertion numbers
   * @param {int32[]} sortedNode - Nodes
   * @param {float64} freq - New entry's frequency
   * @param {int32} tie - New entry's insertion number
   * @param {int32} node - New entry's node
   * @returns {int32} Next insertion number
   */
  function insertSorted(sortedFreq, sortedTie, sortedNode, freq, tie, node) {
    /** @type {int32} */
    let lo = 0;
    /** @type {int32} */
    let hi = sortedNode.length;
    while (lo < hi) {
      /** @type {int32} */
      const mid = Math.floor((lo + hi) / 2);
      if (sortedFreq[mid] < freq || (sortedFreq[mid] === freq && sortedTie[mid] < tie)) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    sortedFreq.push(0);
    sortedTie.push(0);
    sortedNode.push(0);
    for (let k = sortedNode.length - 1; k > lo; --k) {
      sortedFreq[k] = sortedFreq[k - 1];
      sortedTie[k] = sortedTie[k - 1];
      sortedNode[k] = sortedNode[k - 1];
    }
    sortedFreq[lo] = freq;
    sortedTie[lo] = tie;
    sortedNode[lo] = node;
    return tie + 1;
  }

  // Lengthens codes until the Kraft sum fits, walking from the last symbol
  // backwards.
  /**
   * @param {int32[]} lengths - Code lengths, adjusted in place
   * @param {int32} maxBits - Longest allowed code
   */
  function fixCodeLengths(lengths, maxBits) {
    /** @type {uint32} */
    const kraftMax = OpCodes.Shl32(1, maxBits);
    /** @type {float64} */
    let kraftSum = 0;
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0) {
        kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
      }
    }

    // Every pass that finds a code below maxBits strictly reduces the Kraft
    // sum; the guard stops a pathological all-maxBits input from spinning.
    /** @type {int32} */
    let guard = lengths.length * maxBits + 1024;
    while (kraftSum > kraftMax && guard-- > 0) {
      for (let i = lengths.length - 1; i >= 0; --i) {
        if (lengths[i] <= 0 || lengths[i] >= maxBits) {
          continue;
        }

        kraftSum -= OpCodes.Shr32(kraftMax, lengths[i]);
        ++lengths[i];
        kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
        if (kraftSum <= kraftMax) {
          break;
        }
      }
    }
  }

  /**
   * @param {int32[]} lengths - Code lengths
   * @returns {int32} Number of used symbols
   */
  function countUsedSymbols(lengths) {
    /** @type {int32} */
    let used = 0;
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0) {
        ++used;
      }
    }
    return used;
  }

  // ===== MATCH FINDER =====

  /**
   * Match found by the hash-chain finder; length 0 when none.
   */
  class MatchResult {
    /**
     * @param {int32} distance - Backward distance
     * @param {int32} length - Match length
     */
    constructor(distance, length) {
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Chain window, a power of two
     * @param {int32} maxChainDepth - Chain walk limit
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32[]} */
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize);
      /** @type {int32} */
      this.prevMask = windowSize - 1;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    static computeHash(data, position) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Current position, inserted into the chains
     * @param {int32} maxDistance - Farthest allowed distance
     * @param {int32} maxLength - Longest allowed match
     * @param {int32} minLength - Shortest usable match
     * @returns {MatchResult} Longest (nearest on ties) match
     */
    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new MatchResult(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;

      /** @type {int32} */
      const hash = HashChainMatchFinder.computeHash(data, position);
      /** @type {int32} */
      let candidate = this.head[hash];
      /** @type {int32} */
      let chainCount = 0;
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          /** @type {int32} */
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) {
            ++length;
          }

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength) {
              break;
            }
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart) {
          break;
        }

        ++chainCount;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      if (bestLength >= minLength) {
        return new MatchResult(bestDistance, bestLength);
      }
      return new MatchResult(0, 0);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position to insert into the chains
     */
    insertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }

      /** @type {int32} */
      const hash = HashChainMatchFinder.computeHash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== ALGORITHM =====

  class LZHCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZH";
      this.description = "LHA/LHarc -lh5- method: LZSS matching over an 8 KiB window feeding two per-block Huffman trees, a 510-symbol literal/length tree whose code lengths travel through a 19-symbol code-length tree, and a slot-based position tree with raw extra bits.";
      this.inventor = "Haruyasu Yoshizaki, Haruhiko Okumura";
      this.year = 1988;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.documentation = [
        new LinkItem("LHA file format", "https://en.wikipedia.org/wiki/LHA_(file_format)"),
        new LinkItem("LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Canonical Huffman code", "https://en.wikipedia.org/wiki/Canonical_Huffman_code")
      ];

      this.references = [
        new LinkItem("Haruhiko Okumura on LZHUF and LZARI", "https://oku.edu.mie-u.ac.jp/~okumura/compression/"),
        new LinkItem("Huffman coding", "https://en.wikipedia.org/wiki/Huffman_coding")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lzh building block (Compression.Core.Dictionary.Lzh), the
      // authoritative wire format: a 4-byte little-endian original-length
      // header followed by the -lh5- block stream.
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - single-symbol trees",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x04, 0x10, 0x00
          ]
        },
        {
          text: "All literals (ABCD)",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [
            0x04, 0x00, 0x00, 0x00, 0x00, 0x04, 0x28, 0x05, 0x24, 0x50, 0xB7, 0xC0,
            0x06, 0xC0
          ]
        },
        {
          text: "Simple repetition - AAAA",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: OpCodes.AnsiToBytes("AAAA"),
          expected: [
            0x04, 0x00, 0x00, 0x00, 0x00, 0x02, 0x20, 0x04, 0x30, 0x10, 0xB6, 0x55,
            0x40, 0x10
          ]
        },
        {
          text: "Pattern ABCABC",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: OpCodes.AnsiToBytes("ABCABC"),
          expected: [
            0x06, 0x00, 0x00, 0x00, 0x00, 0x04, 0x28, 0x05, 0x30, 0x10, 0xB7, 0x95,
            0x10, 0x21, 0xB0
          ]
        },
        {
          text: "English text with repeats",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          expected: [
            0x5A, 0x00, 0x00, 0x00, 0x00, 0x2B, 0x48, 0xAE, 0xB0, 0xA9, 0x3E, 0x06,
            0x7F, 0xD5, 0x60, 0xF5, 0x52, 0x00, 0xE0, 0x01, 0x8E, 0x46, 0x07, 0x9C,
            0x00, 0x12, 0x33, 0x41, 0x84, 0x28, 0x9F, 0x56, 0x3C, 0x89, 0x59, 0xC3,
            0xF2, 0xB8, 0x55, 0x1A, 0xF9, 0x02, 0xA9, 0xA2, 0x35, 0xF3, 0x3B, 0xCE,
            0x07, 0xC4, 0x7E, 0xB7, 0x5E, 0x18
          ]
        },
        {
          text: "Long run - 256 bytes of 'a'",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: new Array(256).fill(0x61),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x20, 0x04, 0x3F, 0xD1, 0x36, 0xC3,
            0x40, 0x10
          ]
        },
        {
          text: "All 256 byte values in order",
          uri: "https://en.wikipedia.org/wiki/LHA_(file_format)",
          input: (() => { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x02, 0xA0, 0x00, 0x00, 0x00, 0x20,
            0x40, 0x60, 0x80, 0xA0, 0xC0, 0xE1, 0x01, 0x21, 0x41, 0x61, 0x81, 0xA1,
            0xC1, 0xE2, 0x02, 0x22, 0x42, 0x62, 0x82, 0xA2, 0xC2, 0xE3, 0x03, 0x23,
            0x43, 0x63, 0x83, 0xA3, 0xC3, 0xE4, 0x04, 0x24, 0x44, 0x64, 0x84, 0xA4,
            0xC4, 0xE5, 0x05, 0x25, 0x45, 0x65, 0x85, 0xA5, 0xC5, 0xE6, 0x06, 0x26,
            0x46, 0x66, 0x86, 0xA6, 0xC6, 0xE7, 0x07, 0x27, 0x47, 0x67, 0x87, 0xA7,
            0xC7, 0xE8, 0x08, 0x28, 0x48, 0x68, 0x88, 0xA8, 0xC8, 0xE9, 0x09, 0x29,
            0x49, 0x69, 0x89, 0xA9, 0xC9, 0xEA, 0x0A, 0x2A, 0x4A, 0x6A, 0x8A, 0xAA,
            0xCA, 0xEB, 0x0B, 0x2B, 0x4B, 0x6B, 0x8B, 0xAB, 0xCB, 0xEC, 0x0C, 0x2C,
            0x4C, 0x6C, 0x8C, 0xAC, 0xCC, 0xED, 0x0D, 0x2D, 0x4D, 0x6D, 0x8D, 0xAD,
            0xCD, 0xEE, 0x0E, 0x2E, 0x4E, 0x6E, 0x8E, 0xAE, 0xCE, 0xEF, 0x0F, 0x2F,
            0x4F, 0x6F, 0x8F, 0xAF, 0xCF, 0xF0, 0x10, 0x30, 0x50, 0x70, 0x90, 0xB0,
            0xD0, 0xF1, 0x11, 0x31, 0x51, 0x71, 0x91, 0xB1, 0xD1, 0xF2, 0x12, 0x32,
            0x52, 0x72, 0x92, 0xB2, 0xD2, 0xF3, 0x13, 0x33, 0x53, 0x73, 0x93, 0xB3,
            0xD3, 0xF4, 0x14, 0x34, 0x54, 0x74, 0x94, 0xB4, 0xD4, 0xF5, 0x15, 0x35,
            0x55, 0x75, 0x95, 0xB5, 0xD5, 0xF6, 0x16, 0x36, 0x56, 0x76, 0x96, 0xB6,
            0xD6, 0xF7, 0x17, 0x37, 0x57, 0x77, 0x97, 0xB7, 0xD7, 0xF8, 0x18, 0x38,
            0x58, 0x78, 0x98, 0xB8, 0xD8, 0xF9, 0x19, 0x39, 0x59, 0x79, 0x99, 0xB9,
            0xD9, 0xFA, 0x1A, 0x3A, 0x5A, 0x7A, 0x9A, 0xBA, 0xDA, 0xFB, 0x1B, 0x3B,
            0x5B, 0x7B, 0x9B, 0xBB, 0xDB, 0xFC, 0x1C, 0x3C, 0x5C, 0x7C, 0x9C, 0xBC,
            0xDC, 0xFD, 0x1D, 0x3D, 0x5D, 0x7D, 0x9D, 0xBD, 0xDD, 0xFE, 0x1E, 0x3E,
            0x5E, 0x7E, 0x9E, 0xBE, 0xDE, 0xFF, 0x1F, 0x3F, 0x5F, 0x7F, 0x9F, 0xBF,
            0xDF, 0xE0
          ]
        }
      ];

    }

    CreateInstance(isInverse = false) {
      return new LZHInstance(this, isInverse);
    }
  }

  /**
   * Parsed tokens as parallel rows: a literal byte or a (length, distance - 1) match.
   */
  class LzhTokens {
    constructor() {
      /** @type {boolean[]} */
      this.isLiteral = [];
      /** @type {int32[]} */
      this.value = [];
      /** @type {int32[]} */
      this.matchLength = [];
      /** @type {int32[]} */
      this.distance = [];
    }

    /**
     * @param {boolean} isLiteral - True for a literal
     * @param {int32} value - Literal byte
     * @param {int32} length - Match length
     * @param {int32} distance - Match distance minus one
     */
    add(isLiteral, value, length, distance) {
      this.isLiteral.push(isLiteral);
      this.value.push(value);
      this.matchLength.push(length);
      this.distance.push(distance);
    }
  }

  /**
   * T-tree symbols of the literal/length code lengths, with their raw extra bits.
   */
  class TSymbolList {
    constructor() {
      /** @type {int32[]} */
      this.sym = [];
      /** @type {int32[]} */
      this.extraBits = [];
      /** @type {int32[]} */
      this.extraValue = [];
    }

    /**
     * @param {int32} sym - T-tree symbol
     * @param {int32} extraBits - Raw bits following it
     * @param {int32} extraValue - Their value
     */
    add(sym, extraBits, extraValue) {
      this.sym.push(sym);
      this.extraBits.push(extraBits);
      this.extraValue.push(extraValue);
    }
  }

  /**
   * Per-block decoding state: remaining token count and the two trees
   * (a single symbol, or a decoder when more than one symbol is used).
   */
  class LzhDecodeState {
    constructor() {
      /** @type {int32} */
      this.blockRemaining = 0;
      /** @type {int32} */
      this.singleCodeSymbol = -1;
      /** @type {LzhDecoder} */
      this.codeDecoder = null;
      /** @type {int32} */
      this.singlePosSymbol = -1;
      /** @type {LzhDecoder} */
      this.posDecoder = null;
    }
  }

  class LZHInstance extends IAlgorithmInstance {
    /**
     * @param {LZHCompression} algorithm - Owning algorithm
     * @param {boolean} isInverse - True for decompression
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }


    /**
     * @returns {uint8[]} Compressed or decompressed bytes
     */
    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        /** @type {uint8[]} */
        const decoded = this._decompress();
        this.inputBuffer = [];
        return decoded;
      }

      /** @type {uint8[]} */
      const encoded = this._compress();
      this.inputBuffer = [];
      return encoded;
    }

    // ===== COMPRESSION =====

    /**
     * @returns {uint8[]} Size header followed by the block stream
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const out = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return out;
      }

      /** @type {uint8[]} */
      const payload = this._encode(data);
      for (let i = 0; i < payload.length; ++i) {
        out.push(payload[i]);
      }
      return out;
    }

    /**
     * @param {uint8[]} data - Input
     * @returns {LzhTokens} Greedy parse
     */
    _generateTokens(data) {
      /** @type {LzhTokens} */
      const tokens = new LzhTokens();
      /** @type {HashChainMatchFinder} */
      const finder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
      /** @type {int32} */
      let pos = 0;

      while (pos < data.length) {
        /** @type {MatchResult} */
        const match = finder.findMatch(data, pos, WINDOW_SIZE, MAX_MATCH, THRESHOLD);

        if (match.length >= THRESHOLD) {
          tokens.add(false, 0, match.length, match.distance - 1);
          for (let i = 1; i < match.length && pos + i < data.length; ++i) {
            finder.insertPosition(data, pos + i);
          }

          pos += match.length;
        } else {
          tokens.add(true, data[pos], 0, 0);
          ++pos;
        }
      }

      return tokens;
    }

    // Slot 0 covers distance 0, slot 1 distance 1, and slot s (s of at
    // least 2) covers [2^(s-1), 2^s - 1] with (s - 1) raw extra bits.
    /**
     * @param {int32} distance - Match distance minus one
     * @returns {int32} Position slot
     */
    static _positionSlot(distance) {
      if (distance <= 1) {
        return distance;
      }

      /** @type {int32} */
      let slot = 1;
      /** @type {int32} */
      let d = distance;
      while (d > 1) {
        d = Math.floor(d / 2);
        ++slot;
      }
      return slot;
    }

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} Block stream
     */
    _encode(data) {
      /** @type {LzhTokens} */
      const tokens = this._generateTokens(data);
      /** @type {MsbBitWriter} */
      const bits = new MsbBitWriter();
      /** @type {int32} */
      const tokenCount = tokens.isLiteral.length;
      /** @type {int32} */
      let tokenIdx = 0;

      while (tokenIdx < tokenCount) {
        /** @type {int32} */
        const blockEnd = Math.min(tokenIdx + BLOCK_SIZE, tokenCount);
        /** @type {int32} */
        const blockCount = blockEnd - tokenIdx;

        /** @type {int32[]} */
        const codeFreq = zeroArray(NUM_CODES);
        /** @type {int32} */
        let maxPosSlot = -1;

        for (let i = tokenIdx; i < blockEnd; ++i) {
          if (tokens.isLiteral[i]) {
            ++codeFreq[tokens.value[i]];
          } else {
            ++codeFreq[tokens.matchLength[i] - THRESHOLD + N_CHAR];
            /** @type {int32} */
            const slot = LZHInstance._positionSlot(tokens.distance[i]);
            if (slot > maxPosSlot) {
              maxPosSlot = slot;
            }
          }
        }

        /** @type {int32[]} */
        const posFreq = zeroArray(Math.max(maxPosSlot + 1, 1));
        for (let i = tokenIdx; i < blockEnd; ++i) {
          if (!tokens.isLiteral[i]) {
            /** @type {int32} */
            const slot = LZHInstance._positionSlot(tokens.distance[i]);
            ++posFreq[slot];
          }
        }

        /** @type {int32[]} */
        const codeLengths = buildCodeLengths(codeFreq, MAX_CODE_BITS);
        /** @type {int32[]} */
        const posLengths = buildCodeLengths(posFreq, MAX_POSITION_BITS);

        /** @type {boolean} */
        const codeSingle = countUsedSymbols(codeLengths) <= 1;
        /** @type {boolean} */
        const posSingle = countUsedSymbols(posLengths) <= 1;

        bits.writeBits(blockCount, 16);
        LZHInstance._writeCTree(bits, codeLengths);
        LZHInstance._writePtTree(bits, posLengths, P_BIT, P_BIT);

        /** @type {int32[]} */
        const codeCodes = buildCanonicalCodes(codeLengths);
        /** @type {int32[]} */
        const posCodes = buildCanonicalCodes(posLengths);

        for (let i = tokenIdx; i < blockEnd; ++i) {
          if (tokens.isLiteral[i]) {
            if (!codeSingle) {
              /** @type {int32} */
              const literal = tokens.value[i];
              bits.writeBits(codeCodes[literal], codeLengths[literal]);
            }
            continue;
          }

          /** @type {int32} */
          const lengthCode = tokens.matchLength[i] - THRESHOLD + N_CHAR;
          if (!codeSingle) {
            bits.writeBits(codeCodes[lengthCode], codeLengths[lengthCode]);
          }

          /** @type {int32} */
          const distance = tokens.distance[i];
          /** @type {int32} */
          const slot = LZHInstance._positionSlot(distance);
          if (!posSingle) {
            bits.writeBits(posCodes[slot], posLengths[slot]);
          }

          if (slot <= 1) {
            continue;
          }

          /** @type {int32} */
          const extraBits = slot - 1;
          /** @type {int32} */
          const base = OpCodes.Shl32(1, extraBits);
          bits.writeBits(distance - base, extraBits);
        }

        tokenIdx = blockEnd;
      }

      bits.flush();
      return bits.bytes;
    }

    // Writes the literal/length tree: a T tree describing the code lengths,
    // then the count of transmitted lengths, then the run-length coded
    // lengths themselves.
    /**
     * @param {MsbBitWriter} bits - Output bits
     * @param {int32[]} codeLengths - Literal/length code lengths
     */
    static _writeCTree(bits, codeLengths) {
      /** @type {int32} */
      let numC = codeLengths.length;
      while (numC > 0 && codeLengths[numC - 1] === 0) {
        --numC;
      }
      if (numC === 0) {
        numC = 1;
      }

      /** @type {int32} */
      let singleSym = -1;
      /** @type {int32} */
      let usedCount = 0;
      for (let i = 0; i < codeLengths.length; ++i) {
        if (codeLengths[i] > 0) {
          singleSym = i;
          ++usedCount;
        }
      }

      if (usedCount <= 1) {
        LZHInstance._writePtTree(bits, zeroArray(NUM_CODE_LENGTH_SYMBOLS), 5, 3);
        bits.writeBits(0, 9);
        bits.writeBits(usedCount > 0 ? singleSym : 0, 9);
        return;
      }

      // T alphabet: 0 = a single zero length, 1 = run of (3 plus 4 raw bits)
      // zeros, 2 = run of (20 plus 9 raw bits) zeros, 3..18 = an actual code
      // length of (symbol - 2).
      /** @type {TSymbolList} */
      const tSymbols = new TSymbolList();
      /** @type {int32} */
      let i2 = 0;
      while (i2 < numC) {
        if (codeLengths[i2] === 0) {
          /** @type {int32} */
          let zeroRun = 0;
          while (i2 + zeroRun < numC && codeLengths[i2 + zeroRun] === 0) {
            ++zeroRun;
          }

          /** @type {int32} */
          let remaining = zeroRun;
          while (remaining > 0) {
            if (remaining >= 20) {
              /** @type {int32} */
              const count = Math.min(remaining, 20 + 511);
              tSymbols.add(2, 9, count - 20);
              remaining -= count;
            } else if (remaining >= 3) {
              /** @type {int32} */
              const count = Math.min(remaining, 3 + 15);
              tSymbols.add(1, 4, count - 3);
              remaining -= count;
            } else {
              tSymbols.add(0, 0, 0);
              --remaining;
            }
          }
          i2 += zeroRun;
        } else {
          tSymbols.add(codeLengths[i2] + 2, 0, 0);
          ++i2;
        }
      }

      /** @type {int32[]} */
      const tFreq = zeroArray(NUM_CODE_LENGTH_SYMBOLS);
      for (let i = 0; i < tSymbols.sym.length; ++i) {
        ++tFreq[tSymbols.sym[i]];
      }

      /** @type {int32[]} */
      const tLengths = buildCodeLengths(tFreq, T_TREE_MAX_BITS);
      LZHInstance._writePtTree(bits, tLengths, 5, 3);
      bits.writeBits(numC, 9);

      /** @type {int32[]} */
      const tCodes = buildCanonicalCodes(tLengths);
      /** @type {boolean} */
      const tIsSingle = countUsedSymbols(tLengths) <= 1;

      for (let i = 0; i < tSymbols.sym.length; ++i) {
        /** @type {int32} */
        const sym = tSymbols.sym[i];
        if (!tIsSingle) {
          bits.writeBits(tCodes[sym], tLengths[sym]);
        }
        if (tSymbols.extraBits[i] > 0) {
          bits.writeBits(tSymbols.extraValue[i], tSymbols.extraBits[i]);
        }
      }
    }

    // Writes a PT-style tree, used for both the T tree (nBit 5, specialBit 3)
    // and the position tree (nBit and specialBit both P_BIT). Format: symbol
    // count in nBit bits, then per symbol a 3-bit length with a unary
    // extension for lengths of 7 or more; when specialBit is 3 a 2-bit skip
    // count follows index 2. A count of zero means a single symbol whose
    // index follows in nBit bits.
    /**
     * @param {MsbBitWriter} bits - Output bits
     * @param {int32[]} lengths - Code lengths
     * @param {int32} nBit - Width of the symbol count
     * @param {int32} specialBit - 3 when the skip field follows index 2
     */
    static _writePtTree(bits, lengths, nBit, specialBit) {
      /** @type {int32} */
      let numSym = lengths.length;
      while (numSym > 0 && lengths[numSym - 1] === 0) {
        --numSym;
      }

      /** @type {int32} */
      let singleSym = -1;
      /** @type {int32} */
      let usedCount = 0;
      for (let i = 0; i < lengths.length; ++i) {
        if (lengths[i] > 0) {
          singleSym = i;
          ++usedCount;
        }
      }

      if (usedCount <= 1) {
        bits.writeBits(0, nBit);
        bits.writeBits(usedCount > 0 ? singleSym : 0, nBit);
        return;
      }

      bits.writeBits(numSym, nBit);

      for (let i = 0; i < numSym; ++i) {
        /** @type {int32} */
        const len = lengths[i];
        if (len < 7) {
          bits.writeBits(len, 3);
        } else {
          bits.writeBits(7, 3);
          for (let j = 0; j < len - 7; ++j) {
            bits.writeBits(1, 1);
          }
          bits.writeBits(0, 1);
        }

        if (i === 2 && specialBit === 3) {
          /** @type {int32} */
          let skipCount = 0;
          while (i + 1 + skipCount < numSym && skipCount < 3 && lengths[i + 1 + skipCount] === 0) {
            ++skipCount;
          }
          bits.writeBits(skipCount, 2);
          i += skipCount;
        }
      }
    }

    // ===== DECOMPRESSION =====

    /**
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      if (data.length < 4) {
        throw new Error('LZH: input too small for header');
      }

      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {MsbBitReader} */
      const reader = new MsbBitReader(data, 4);
      /** @type {LzhDecodeState} */
      const state = new LzhDecodeState();

      /** @type {uint8[]} */
      const output = new Array(originalSize);
      /** @type {int32[]} */
      const window = zeroArray(WINDOW_SIZE);
      /** @type {int32} */
      let windowPos = 0;
      /** @type {float64} */
      let outPos = 0;

      while (outPos < originalSize) {
        if (state.blockRemaining === 0) {
          LZHInstance._readBlock(reader, state);
        }

        /** @type {int32} */
        let code = state.singleCodeSymbol;
        if (code < 0) {
          code = decodeSymbol(reader, state.codeDecoder);
        }
        --state.blockRemaining;

        if (code < N_CHAR) {
          output[outPos++] = code;
          window[windowPos] = code;
          windowPos = OpCodes.And32(windowPos + 1, WINDOW_MASK);
        } else {
          /** @type {int32} */
          const length = code - N_CHAR + THRESHOLD;
          /** @type {int32} */
          const position = LZHInstance._decodePosition(reader, state);
          /** @type {int32} */
          let srcPos = OpCodes.And32(windowPos - position - 1 + WINDOW_SIZE, WINDOW_MASK);
          for (let j = 0; j < length && outPos < originalSize; ++j) {
            /** @type {int32} */
            const b = window[srcPos];
            output[outPos++] = b;
            window[windowPos] = b;
            windowPos = OpCodes.And32(windowPos + 1, WINDOW_MASK);
            srcPos = OpCodes.And32(srcPos + 1, WINDOW_MASK);
          }
        }
      }

      return output;
    }

    /**
     * @param {MsbBitReader} reader - Input bits
     * @param {LzhDecodeState} state - Current trees
     * @returns {int32} Match distance minus one
     */
    static _decodePosition(reader, state) {
      /** @type {int32} */
      let slot = state.singlePosSymbol;
      if (slot < 0) {
        slot = decodeSymbol(reader, state.posDecoder);
      }

      if (slot <= 1) {
        return slot;
      }

      /** @type {int32} */
      const extraBits = slot - 1;
      /** @type {int32} */
      const base = OpCodes.Shl32(1, extraBits);
      /** @type {int32} */
      const extra = reader.readBits(extraBits);
      return base + extra;
    }

    /**
     * @param {MsbBitReader} reader - Input bits
     * @param {LzhDecodeState} state - Trees, replaced by the new block's
     */
    static _readBlock(reader, state) {
      /** @type {int32} */
      const blockCount = reader.readBits(16);
      state.blockRemaining = blockCount;
      LZHInstance._readCTree(reader, state);
      LZHInstance._readPTree(reader, state);
    }

    /**
     * @param {MsbBitReader} reader - Input bits
     * @param {int32} nBit - Width of the symbol count
     * @param {int32} specialBit - 3 when the skip field follows index 2
     * @returns {int32[]} Code lengths
     */
    static _readPtTree(reader, nBit, specialBit) {
      /** @type {int32} */
      const numSym = reader.readBits(nBit);
      if (numSym === 0) {
        /** @type {int32} */
        const sym = reader.readBits(nBit);
        /** @type {int32[]} */
        const lengths = zeroArray(sym + 1);
        lengths[sym] = 1;
        return lengths;
      }

      /** @type {int32[]} */
      const codeLengths = zeroArray(numSym);
      for (let i = 0; i < numSym; ++i) {
        /** @type {int32} */
        let len = reader.readBits(3);
        if (len === 7) {
          for (;;) {
            /** @type {uint32} */
            const more = reader.readBits(1);
            if (more !== 1) {
              break;
            }
            ++len;
          }
        }
        codeLengths[i] = len;

        if (i === 2 && specialBit === 3) {
          /** @type {int32} */
          const skip = reader.readBits(2);
          for (let j = 0; j < skip && i + 1 < numSym; ++j) {
            ++i;
            codeLengths[i] = 0;
          }
        }
      }

      return codeLengths;
    }

    /**
     * @param {MsbBitReader} reader - Input bits
     * @param {LzhDecodeState} state - Receives the literal/length tree
     */
    static _readCTree(reader, state) {
      /** @type {int32[]} */
      const tLengths = LZHInstance._readPtTree(reader, 5, 3);

      /** @type {int32} */
      let tSingleSym = -1;
      /** @type {int32} */
      let tUsed = 0;
      for (let j = 0; j < tLengths.length; ++j) {
        if (tLengths[j] > 0) {
          tSingleSym = j;
          ++tUsed;
        }
      }

      /** @type {LzhDecoder} */
      let tDecoder = null;
      if (tUsed > 1) {
        tSingleSym = -1;
        /** @type {int32} */
        let maxLen = 0;
        for (let j = 0; j < tLengths.length; ++j) {
          if (tLengths[j] > maxLen) {
            maxLen = tLengths[j];
          }
        }
        tDecoder = buildDecoder(tLengths, Math.min(maxLen, 12));
      }

      /** @type {int32} */
      const numC = reader.readBits(9);
      if (numC === 0) {
        /** @type {int32} */
        const single = reader.readBits(9);
        state.singleCodeSymbol = single;
        state.codeDecoder = null;
        return;
      }

      /** @type {int32[]} */
      const codeLengths = zeroArray(Math.max(numC, NUM_CODES));
      /** @type {int32} */
      let i = 0;
      while (i < numC) {
        /** @type {int32} */
        let tSym = 0;
        if (tSingleSym >= 0) {
          tSym = tSingleSym;
        } else if (tDecoder !== null) {
          tSym = decodeSymbol(reader, tDecoder);
        } else {
          tSym = 0;
        }

        if (tSym === 0) {
          codeLengths[i++] = 0;
        } else if (tSym === 1) {
          /** @type {int32} */
          const runField = reader.readBits(4);
          /** @type {int32} */
          const run = 3 + runField;
          for (let j = 0; j < run && i < numC; ++j) {
            codeLengths[i++] = 0;
          }
        } else if (tSym === 2) {
          /** @type {int32} */
          const runField = reader.readBits(9);
          /** @type {int32} */
          const run = 20 + runField;
          for (let j = 0; j < run && i < numC; ++j) {
            codeLengths[i++] = 0;
          }
        } else {
          codeLengths[i++] = tSym - 2;
        }
      }

      state.singleCodeSymbol = -1;
      /** @type {int32} */
      let maxCodeLen = 0;
      for (let j = 0; j < codeLengths.length; ++j) {
        if (codeLengths[j] > maxCodeLen) {
          maxCodeLen = codeLengths[j];
        }
      }

      if (maxCodeLen === 0) {
        state.singleCodeSymbol = 0;
        state.codeDecoder = null;
      } else {
        state.codeDecoder = buildDecoder(codeLengths, Math.min(maxCodeLen, 16));
      }
    }

    /**
     * @param {MsbBitReader} reader - Input bits
     * @param {LzhDecodeState} state - Receives the position tree
     */
    static _readPTree(reader, state) {
      /** @type {int32[]} */
      const ptLengths = LZHInstance._readPtTree(reader, P_BIT, P_BIT);

      /** @type {int32} */
      let usedCount = 0;
      /** @type {int32} */
      let singleSym = -1;
      for (let i = 0; i < ptLengths.length; ++i) {
        if (ptLengths[i] > 0) {
          singleSym = i;
          ++usedCount;
        }
      }

      if (usedCount <= 1) {
        state.singlePosSymbol = usedCount > 0 ? singleSym : 0;
        state.posDecoder = null;
        return;
      }

      state.singlePosSymbol = -1;
      /** @type {int32} */
      let maxLen = 0;
      for (let i = 0; i < ptLengths.length; ++i) {
        if (ptLengths[i] > maxLen) {
          maxLen = ptLengths[i];
        }
      }
      state.posDecoder = buildDecoder(ptLengths, Math.min(maxLen, 16));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZHCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZHCompression, LZHInstance };
}));
