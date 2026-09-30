/*
 * LZX Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZX is Microsoft's Lempel-Ziv Extended codec, used in CAB, CHM and WIM.
 * It pairs an LZ77 matcher over a 32 KiB sliding window with three Huffman
 * trees and a bit stream of its own shape: bits are accumulated
 * most-significant-bit first and flushed as 16-bit little-endian words.
 *
 * Wire format produced here (a 4-byte little-endian uncompressed length
 * followed by the LZX bit stream):
 *   - each block starts with a 3-bit block type (1 = verbatim, 2 = aligned
 *     offset, 3 = uncompressed) and a block size: a 1-bit flag meaning "the
 *     default 32768 bytes", otherwise a 0 bit plus an explicit 16-bit size
 *   - a verbatim block header carries three code-length lists, each encoded
 *     against the previous block's lengths as a delta modulo 17 and then
 *     run-length coded through a 20-symbol pre-tree whose own lengths are
 *     20 raw 4-bit fields: the first 256 main-tree symbols, the remaining
 *     main-tree symbols, then the 249 length-tree symbols
 *   - main-tree symbols below 256 are literals; above that, the symbol
 *     splits into a position slot and a 3-bit length header, with an extra
 *     length-tree symbol when the header saturates and slot footer bits for
 *     non-repeat slots
 *   - position slots 0, 1 and 2 replay the repeated offsets R0, R1 and R2;
 *     slots 3 and up carry a formatted offset of (distance - 2)
 *
 * Only verbatim blocks are emitted; aligned-offset blocks are a ratio
 * optimisation, not a correctness requirement. The decoder reads all three
 * block types.
 *
 * Documentation and references:
 *   - Microsoft Cabinet format specification, LZX section
 *     (https://learn.microsoft.com/en-us/previous-versions/bb417343(v=msdn.10))
 *   - https://en.wikipedia.org/wiki/LZX - overview of the method
 *   - https://github.com/kyz/libmspack - documentation of the CAB and CHM
 *     containers that carry LZX streams
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

  // ===== CONSTANTS =====

  const WINDOW_BITS = 15;
  const WINDOW_SIZE = 32768;
  const WINDOW_MASK = 32767;
  const NUM_CHARS = 256;
  const MIN_MATCH = 2;
  const MAX_MATCH = 257;
  const NUM_LENGTH_SYMBOLS = 249;
  const NUM_ALIGNED_SYMBOLS = 8;
  const NUM_PRE_TREE_SYMBOLS = 20;
  const PRE_TREE_BITS = 4;
  const NUM_LENGTH_HEADERS = 8;
  const MIN_NON_REPEAT_DISTANCE = 5;
  const BLOCK_TYPE_VERBATIM = 1;
  const BLOCK_TYPE_ALIGNED = 2;
  const BLOCK_TYPE_UNCOMPRESSED = 3;
  const DEFAULT_BLOCK_SIZE = 32768;
  const MAX_HUFFMAN_BITS = 16;
  const NUM_POSITION_SLOTS = 30;            // 32 KiB window
  const NUM_MAIN_SYMBOLS = 496;             // NUM_CHARS + 30 * 8
  const CHAIN_DEPTH = 64;                   // "normal" compression level

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;

  /**
   * @param {int32} size - Number of entries
   * @param {int32} value - Initial value of every entry
   * @returns {int32[]} Plain array filled with value
   */
  function filledArray(size, value) {
    /** @type {int32[]} */
    const arr = new Array(size);
    arr.fill(value);
    return arr;
  }

  // ===== POSITION SLOTS =====

  // Slot 0..3 map straight to offsets 0..3; beyond that each pair of slots
  // adds one footer bit, so slot 2k has base 2^k and slot 2k+1 has base
  // 3 * 2^(k-1).
  /**
   * @param {int32} offset - Formatted offset (distance minus two)
   * @returns {int32} Position slot
   */
  function offsetToSlot(offset) {
    if (offset < 4) {
      return offset;
    }

    /** @type {int32} */
    let log2 = 0;
    /** @type {int32} */
    let tmp = offset;
    while (tmp > 1) {
      tmp = Math.floor(tmp / 2);
      ++log2;
    }

    /** @type {int32} */
    const halfBit = OpCodes.And32(OpCodes.Shr32(offset, log2 - 1), 1);
    return 2 * log2 + halfBit;
  }

  /**
   * @param {int32} slot - Position slot
   * @returns {int32} Smallest formatted offset of the slot
   */
  function slotBase(slot) {
    if (slot < 4) {
      return slot;
    }
    /** @type {int32} */
    const k = Math.floor(slot / 2);
    return slot % 2 === 0 ? OpCodes.Shl32(1, k) : OpCodes.Shl32(3, k - 1);
  }

  /**
   * @param {int32} slot - Position slot
   * @returns {int32} Footer bit count of the slot
   */
  function slotFooterBits(slot) {
    if (slot < 4) {
      return 0;
    }
    return Math.floor(slot / 2) - 1;
  }

  // ===== LZX BIT STREAM (MSB-first bits, 16-bit little-endian words) =====

  class LzxBitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsUsed = 0;
    }

    /**
     * @param {uint32} value - Value whose low count bits are written
     * @param {int32} count - Bit count, most significant first
     */
    writeBits(value, count) {
      if (count === 0) {
        return;
      }

      /** @type {uint32} */
      let mask = 0xFFFFFFFF;
      if (count !== 32) {
        /** @type {int32} */
        const span = OpCodes.Shl32(1, count);
        mask = span - 1;
      }
      /** @type {uint32} */
      const masked = OpCodes.And32(value, mask);

      this.buffer = OpCodes.Or32(OpCodes.Shl32(this.buffer, count), masked);
      this.bitsUsed += count;

      while (this.bitsUsed >= 16) {
        this.bitsUsed -= 16;
        /** @type {uint32} */
        const word = OpCodes.And32(OpCodes.Shr32(this.buffer, this.bitsUsed), 0xFFFF);
        this.bytes.push(OpCodes.And32(word, 0xFF));
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(word, 8), 0xFF));
      }
    }

    // Pads to the next 16-bit word boundary, then appends one zero word so a
    // decoder's lookahead never runs off the end of the byte stream.
    flush() {
      if (this.bitsUsed > 0) {
        /** @type {uint32} */
        const word = OpCodes.And32(OpCodes.Shl32(this.buffer, 16 - this.bitsUsed), 0xFFFF);
        this.bytes.push(OpCodes.And32(word, 0xFF));
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(word, 8), 0xFF));
        this.bitsUsed = 0;
        this.buffer = 0;
      }

      this.bytes.push(0);
      this.bytes.push(0);
    }
  }

  class LzxBitReader {
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
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsLeft = 0;
      /** @type {boolean} */
      this.endOfStream = false;
    }

    /**
     * @returns {int32} Next byte, -1 past the end
     */
    readByte() {
      if (this.pos < this.bytes.length) {
        return this.bytes[this.pos++];
      }
      return -1;
    }

    // Pulls one 16-bit little-endian word into the accumulator. Past the end
    // of the byte stream the accumulator is padded with zero words, which is
    // what the trailing zero word written by the encoder guarantees anyway.
    fill() {
      /** @type {int32} */
      const lo = this.readByte();
      /** @type {int32} */
      let hi = this.readByte();

      /** @type {uint32} */
      let word = 0;
      if (lo < 0) {
        this.endOfStream = true;
      } else {
        if (hi < 0) {
          hi = 0;
        }
        word = OpCodes.Or32(OpCodes.Shl32(hi, 8), lo);
      }

      this.bitBuffer = OpCodes.Or32(OpCodes.Shl32(this.bitBuffer, 16), word);
      this.bitsLeft += 16;
    }

    /**
     * @param {int32} count - Bits wanted in the accumulator
     */
    ensureBits(count) {
      while (this.bitsLeft < count) {
        this.fill();
      }
    }

    /**
     * @param {int32} count - Bit count
     * @returns {uint32} Next count bits, not consumed
     */
    peekBits(count) {
      /** @type {int32} */
      const span = OpCodes.Shl32(1, count);
      return OpCodes.And32(
        OpCodes.Shr32(this.bitBuffer, this.bitsLeft - count),
        span - 1
      );
    }

    /**
     * @param {int32} count - Bits to consume
     */
    removeBits(count) {
      this.bitsLeft -= count;
    }

    /**
     * @param {int32} count - Bit count
     * @returns {uint32} Next count bits
     */
    readBits(count) {
      if (count === 0) {
        return 0;
      }

      this.ensureBits(count);
      /** @type {uint32} */
      const value = this.peekBits(count);
      this.removeBits(count);
      return value;
    }

    alignTo16Bits() {
      /** @type {int32} */
      const mod = OpCodes.And32(this.bitsLeft, 15);
      if (mod !== 0) {
        this.removeBits(mod);
      }
    }

    /**
     * @returns {uint32} Little-endian 32-bit value read byte by byte
     */
    readRawInt32LE() {
      /** @type {int32} */
      const b0 = this.readByte();
      /** @type {int32} */
      const b1 = this.readByte();
      /** @type {int32} */
      const b2 = this.readByte();
      /** @type {int32} */
      const b3 = this.readByte();
      if (b0 < 0 || b1 < 0 || b2 < 0 || b3 < 0) {
        throw new Error('LZX: unexpected end of stream');
      }

      return OpCodes.Pack32LE(b0, b1, b2, b3);
    }
  }

  // ===== HUFFMAN =====

  // Plain Huffman build with deterministic tie-breaking (lowest frequency
  // first, then insertion order), depth-clamped to maxBits and then
  // Kraft-corrected. The working list is kept sorted by (frequency,
  // insertion number) - a total order, since insertion numbers are unique.
  /**
   * @param {int32[]} frequencies - Frequency per symbol
   * @param {int32} numSymbols - Alphabet size
   * @param {int32} maxBits - Longest allowed code
   * @returns {int32[]} Code length per symbol
   */
  function buildCodeLengths(frequencies, numSymbols, maxBits) {
    /** @type {int32[]} */
    const lengths = filledArray(numSymbols, 0);
    /** @type {int32[]} */
    const symbolIds = [];
    /** @type {float64[]} */
    const symbolFreqs = [];
    for (let i = 0; i < numSymbols; ++i) {
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
    const leftChild = filledArray(nodeCount, -1);
    /** @type {int32[]} */
    const rightChild = filledArray(nodeCount, -1);
    /** @type {int32[]} */
    const nodeSym = filledArray(nodeCount, -1);

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
        lengths[nodeSym[node]] = Math.max(1, Math.min(depth, maxBits));
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

    fixKraftInequality(lengths, maxBits);
    return lengths;
  }

  /**
   * Inserts (freq, insertion number, node) into the sorted working list:
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

  /**
   * @param {int32[]} lengths - Code lengths, adjusted in place
   * @param {int32} maxBits - Longest allowed code
   */
  function fixKraftInequality(lengths, maxBits) {
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

  // Canonical assignment, most-significant-bit first: shortest codes first,
  // symbols of equal length in ascending symbol order.
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
    const codes = filledArray(lengths.length, 0);
    if (maxLen === 0) {
      return codes;
    }

    /** @type {int32[]} */
    const blCount = filledArray(maxLen + 1, 0);
    for (let i = 0; i < lengths.length; ++i) {
      if (lengths[i] > 0) {
        ++blCount[lengths[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = filledArray(maxLen + 1, 0);
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
   * Canonical decoder: a single symbol with its nominal length, or first code
   * and symbols per code length.
   */
  class LzxDecoder {
    /**
     * @param {int32} single - The only used symbol, -1 otherwise
     * @param {int32} singleLength - Its code length
     * @param {int32[]} firstCode - First code per length
     * @param {int32[][]} symbolsByLength - Symbols per length in code order
     */
    constructor(single, singleLength, firstCode, symbolsByLength) {
      /** @type {int32} */
      this.single = single;
      /** @type {int32} */
      this.singleLength = singleLength;
      /** @type {int32[]} */
      this.firstCode = firstCode;
      /** @type {int32[][]} */
      this.symbolsByLength = symbolsByLength;
    }
  }

  // Decoder counterpart of the canonical numbering above. A tree with a
  // single used symbol decodes any bit pattern as that symbol, consuming its
  // nominal code length, which is what the reference decode table does.
  /**
   * @param {int32[]} lengths - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {LzxDecoder} Decoder
   */
  function buildDecoder(lengths, numSymbols) {
    /** @type {int32[]} */
    const blCount = filledArray(MAX_HUFFMAN_BITS + 1, 0);
    /** @type {int32} */
    let usedCount = 0;
    /** @type {int32} */
    let singleSym = -1;
    for (let i = 0; i < numSymbols; ++i) {
      /** @type {int32} */
      const len = lengths[i];
      if (len <= 0 || len > MAX_HUFFMAN_BITS) {
        continue;
      }
      ++blCount[len];
      ++usedCount;
      singleSym = i;
    }

    if (usedCount === 1) {
      /** @type {int32[][]} */
      const noLists = [];
      return new LzxDecoder(singleSym, lengths[singleSym], blCount, noLists);
    }

    /** @type {int32[]} */
    const firstCode = filledArray(MAX_HUFFMAN_BITS + 1, 0);
    /** @type {int32} */
    let code = 0;
    for (let b = 1; b <= MAX_HUFFMAN_BITS; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      firstCode[b] = code;
    }

    /** @type {int32[][]} */
    const symbolsByLength = [];
    for (let b = 0; b <= MAX_HUFFMAN_BITS; ++b) {
      /** @type {int32[]} */
      const bucket = [];
      symbolsByLength.push(bucket);
    }
    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const len = lengths[sym];
      if (len <= 0 || len > MAX_HUFFMAN_BITS) {
        continue;
      }
      symbolsByLength[len].push(sym);
    }

    return new LzxDecoder(-1, 0, firstCode, symbolsByLength);
  }

  /**
   * @param {LzxBitReader} reader - Input bits
   * @param {LzxDecoder} decoder - Canonical decoder
   * @returns {int32} Decoded symbol
   */
  function decodeSymbol(reader, decoder) {
    if (decoder.single >= 0) {
      reader.ensureBits(decoder.singleLength);
      reader.removeBits(decoder.singleLength);
      return decoder.single;
    }

    for (let len = 1; len <= MAX_HUFFMAN_BITS; ++len) {
      reader.ensureBits(len);
      /** @type {uint32} */
      const code = reader.peekBits(len);
      /** @type {int32[]} */
      const list = decoder.symbolsByLength[len];
      if (list.length > 0) {
        /** @type {float64} */
        const index = code - decoder.firstCode[len];
        if (index >= 0 && index < list.length) {
          reader.removeBits(len);
          return list[index];
        }
      }
    }

    throw new Error('LZX: invalid Huffman code encountered during decoding');
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

  class LZXCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZX";
      this.description = "Microsoft's Lempel-Ziv Extended codec used in CAB, CHM and WIM. LZ77 over a 32 KiB window feeding a main tree of literals plus position-slot/length-header symbols, a secondary length tree and repeated-offset registers R0/R1/R2, all carried in a bit stream flushed as 16-bit little-endian words.";
      this.inventor = "Jonathan Forbes, Tomi Poutanen";
      this.year = 1996;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("Microsoft CAB Format Specification", "https://learn.microsoft.com/en-us/previous-versions/bb417343(v=msdn.10)"),
        new LinkItem("LZX Algorithm Overview", "https://en.wikipedia.org/wiki/LZX"),
        new LinkItem("libmspack", "https://github.com/kyz/libmspack")
      ];

      this.references = [
        new LinkItem("Microsoft ms-compress", "https://github.com/coderforlife/ms-compress"),
        new LinkItem("Canonical Huffman code", "https://en.wikipedia.org/wiki/Canonical_Huffman_code")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lzx building block (Compression.Core.Dictionary.Lzx), the
      // authoritative wire format: a 4-byte little-endian original-length
      // header followed by the LZX verbatim block stream.
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x21, 0x02, 0xFA, 0x07, 0x7D, 0x9F, 0x40, 0xF4, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F, 0x04, 0xF7, 0x7D, 0x00, 0xD0,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7D, 0x10, 0xDF, 0xF7,
            0x00, 0x64, 0x00, 0x00
          ]
        },
        {
          text: "All literals (ABCD)",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [
            0x04, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x40, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x21, 0x20, 0xFA, 0x07, 0x7D, 0xAA, 0xCE, 0xF7, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0xF7, 0x7D, 0x40, 0xDF,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0x00, 0xDF, 0xF7,
            0x91, 0x7D, 0x00, 0xB0, 0x00, 0x00
          ]
        },
        {
          text: "Simple repetition - AAAA",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: OpCodes.AnsiToBytes("AAAA"),
          expected: [
            0x04, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x40, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x21, 0x02, 0xFA, 0x07, 0x7D, 0x9F, 0x48, 0xF4, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x2D, 0x04, 0xDF, 0xF7, 0xE0, 0x7C,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0x01, 0x7D, 0xDF,
            0x50, 0xF6, 0x00, 0x00
          ]
        },
        {
          text: "Pattern ABCABC",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: OpCodes.AnsiToBytes("ABCABC"),
          expected: [
            0x06, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x60, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x31, 0x23, 0xFD, 0x07, 0x7D, 0x56, 0xCF, 0xF7, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0xF7, 0x7D, 0x40, 0xDF,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0x00, 0xDF, 0xF7,
            0x9B, 0x7D, 0x00, 0x58, 0x00, 0x00
          ]
        },
        {
          text: "English text with repeats",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          expected: [
            0x5A, 0x00, 0x00, 0x00, 0x05, 0x20, 0x00, 0xA0, 0x00, 0x00, 0x00, 0x00,
            0x55, 0x21, 0x43, 0x00, 0xCF, 0x0C, 0xDB, 0xF4, 0x48, 0xD5, 0xC0, 0x03,
            0x7F, 0x03, 0x2C, 0x7F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80,
            0x41, 0x08, 0x2E, 0xFD, 0x27, 0xAE, 0x78, 0xDF, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x40, 0x88, 0xF7, 0xC9, 0x7F, 0xDF, 0xA0, 0x89,
            0x14, 0xC2, 0xAB, 0x4F, 0x44, 0x1E, 0xE1, 0xAC, 0x5C, 0xF9, 0x8D, 0x2A,
            0x81, 0x7C, 0xD1, 0x54, 0xAC, 0x1B, 0x38, 0xEF, 0x11, 0x1F, 0xD1, 0xFA,
            0x80, 0xC5, 0x00, 0x00
          ]
        },
        {
          text: "Long run - 256 bytes of 'a'",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: new Array(256).fill(0x61),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x10, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x21, 0x02, 0xDA, 0x07, 0x7D, 0x9F, 0x40, 0xFC, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x33, 0x84, 0x7D, 0x9F, 0xC8, 0xF7,
            0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x20, 0xF7, 0x7D,
            0x5B, 0xDF, 0x00, 0xA4, 0x00, 0x00
          ]
        },
        {
          text: "All 256 byte values in order",
          uri: "https://en.wikipedia.org/wiki/LZX",
          input: (() => { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x10, 0x20, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xDF, 0x07,
            0xF4, 0x7D, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
            0x7D, 0x1F, 0xD9, 0xF7, 0x01, 0x00, 0x03, 0x02, 0x05, 0x04, 0x07, 0x06,
            0x09, 0x08, 0x0B, 0x0A, 0x0D, 0x0C, 0x0F, 0x0E, 0x11, 0x10, 0x13, 0x12,
            0x15, 0x14, 0x17, 0x16, 0x19, 0x18, 0x1B, 0x1A, 0x1D, 0x1C, 0x1F, 0x1E,
            0x21, 0x20, 0x23, 0x22, 0x25, 0x24, 0x27, 0x26, 0x29, 0x28, 0x2B, 0x2A,
            0x2D, 0x2C, 0x2F, 0x2E, 0x31, 0x30, 0x33, 0x32, 0x35, 0x34, 0x37, 0x36,
            0x39, 0x38, 0x3B, 0x3A, 0x3D, 0x3C, 0x3F, 0x3E, 0x41, 0x40, 0x43, 0x42,
            0x45, 0x44, 0x47, 0x46, 0x49, 0x48, 0x4B, 0x4A, 0x4D, 0x4C, 0x4F, 0x4E,
            0x51, 0x50, 0x53, 0x52, 0x55, 0x54, 0x57, 0x56, 0x59, 0x58, 0x5B, 0x5A,
            0x5D, 0x5C, 0x5F, 0x5E, 0x61, 0x60, 0x63, 0x62, 0x65, 0x64, 0x67, 0x66,
            0x69, 0x68, 0x6B, 0x6A, 0x6D, 0x6C, 0x6F, 0x6E, 0x71, 0x70, 0x73, 0x72,
            0x75, 0x74, 0x77, 0x76, 0x79, 0x78, 0x7B, 0x7A, 0x7D, 0x7C, 0x7F, 0x7E,
            0x81, 0x80, 0x83, 0x82, 0x85, 0x84, 0x87, 0x86, 0x89, 0x88, 0x8B, 0x8A,
            0x8D, 0x8C, 0x8F, 0x8E, 0x91, 0x90, 0x93, 0x92, 0x95, 0x94, 0x97, 0x96,
            0x99, 0x98, 0x9B, 0x9A, 0x9D, 0x9C, 0x9F, 0x9E, 0xA1, 0xA0, 0xA3, 0xA2,
            0xA5, 0xA4, 0xA7, 0xA6, 0xA9, 0xA8, 0xAB, 0xAA, 0xAD, 0xAC, 0xAF, 0xAE,
            0xB1, 0xB0, 0xB3, 0xB2, 0xB5, 0xB4, 0xB7, 0xB6, 0xB9, 0xB8, 0xBB, 0xBA,
            0xBD, 0xBC, 0xBF, 0xBE, 0xC1, 0xC0, 0xC3, 0xC2, 0xC5, 0xC4, 0xC7, 0xC6,
            0xC9, 0xC8, 0xCB, 0xCA, 0xCD, 0xCC, 0xCF, 0xCE, 0xD1, 0xD0, 0xD3, 0xD2,
            0xD5, 0xD4, 0xD7, 0xD6, 0xD9, 0xD8, 0xDB, 0xDA, 0xDD, 0xDC, 0xDF, 0xDE,
            0xE1, 0xE0, 0xE3, 0xE2, 0xE5, 0xE4, 0xE7, 0xE6, 0xE9, 0xE8, 0xEB, 0xEA,
            0xED, 0xEC, 0xEF, 0xEE, 0xF1, 0xF0, 0xF3, 0xF2, 0xF5, 0xF4, 0xF7, 0xF6,
            0xF9, 0xF8, 0xFB, 0xFA, 0xFD, 0xFC, 0xFF, 0xFE, 0x00, 0x00
          ]
        }
      ];

    }

    CreateInstance(isInverse = false) {
      return new LZXInstance(this, isInverse);
    }
  }

  /**
   * Repeat-offset registers r0..r2.
   */
  class RepeatOffsets {
    /**
     * @param {float64} r0 - Most recent offset
     * @param {float64} r1 - Second offset
     * @param {float64} r2 - Third offset
     */
    constructor(r0, r1, r2) {
      /** @type {float64} */
      this.r0 = r0;
      /** @type {float64} */
      this.r1 = r1;
      /** @type {float64} */
      this.r2 = r2;
    }
  }

  /**
   * Compressor state that persists across blocks.
   */
  class LzxEncodeState {
    constructor() {
      /** @type {RepeatOffsets} */
      this.regs = new RepeatOffsets(1, 1, 1);
      /** @type {int32[]} */
      this.prevMainLengths = filledArray(NUM_MAIN_SYMBOLS, 0);
      /** @type {int32[]} */
      this.prevLengthLengths = filledArray(NUM_LENGTH_SYMBOLS, 0);
    }
  }

  /**
   * Decompressor state that persists across blocks.
   */
  class LzxDecodeState {
    constructor() {
      /** @type {int32} */
      this.windowPos = 0;
      /** @type {RepeatOffsets} */
      this.regs = new RepeatOffsets(1, 1, 1);
      /** @type {int32[]} */
      this.mainLengths = filledArray(NUM_MAIN_SYMBOLS, 0);
      /** @type {int32[]} */
      this.lengthLengths = filledArray(NUM_LENGTH_SYMBOLS, 0);
      /** @type {int32[]} */
      this.alignedLengths = filledArray(NUM_ALIGNED_SYMBOLS, 0);
      /** @type {LzxDecoder} */
      this.mainDecoder = null;
      /** @type {LzxDecoder} */
      this.lengthDecoder = null;
      /** @type {LzxDecoder} */
      this.alignedDecoder = null;
    }
  }

  /**
   * Parsed tokens as parallel rows: a literal or a (length, distance) match.
   */
  class LzxTokens {
    constructor() {
      /** @type {boolean[]} */
      this.isLiteral = [];
      /** @type {int32[]} */
      this.value = [];
      /** @type {int32[]} */
      this.matchLength = [];
      /** @type {int32[]} */
      this.offset = [];
    }

    /**
     * @param {boolean} isLiteral - True for a literal
     * @param {int32} value - Literal byte
     * @param {int32} length - Match length
     * @param {int32} offset - Match distance
     */
    add(isLiteral, value, length, offset) {
      this.isLiteral.push(isLiteral);
      this.value.push(value);
      this.matchLength.push(length);
      this.offset.push(offset);
    }
  }

  class LZXInstance extends IAlgorithmInstance {
    /**
     * @param {LZXCompression} algorithm - Owning algorithm
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
     * @returns {uint8[]} Size header followed by verbatim blocks
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const out = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return out;
      }

      // Compressor state that persists across blocks.
      /** @type {LzxEncodeState} */
      const state = new LzxEncodeState();

      /** @type {LzxBitWriter} */
      const writer = new LzxBitWriter();
      /** @type {LzxTokens} */
      const tokens = LZXInstance._tokenise(data, state);
      /** @type {int32} */
      const tokenCount = tokens.isLiteral.length;

      /** @type {int32} */
      let tokenStart = 0;
      while (tokenStart < tokenCount) {
        /** @type {int32} */
        let blockBytes = 0;
        /** @type {int32} */
        let blockTokenEnd = tokenStart;
        while (blockTokenEnd < tokenCount) {
          /** @type {int32} */
          const tokBytes = tokens.isLiteral[blockTokenEnd] ? 1 : tokens.matchLength[blockTokenEnd];
          if (blockBytes + tokBytes > DEFAULT_BLOCK_SIZE && blockBytes > 0) {
            break;
          }

          blockBytes += tokBytes;
          ++blockTokenEnd;
          if (blockBytes >= DEFAULT_BLOCK_SIZE) {
            break;
          }
        }

        LZXInstance._emitVerbatimBlock(writer, tokens, tokenStart, blockTokenEnd, blockBytes, state);
        tokenStart = blockTokenEnd;
      }

      writer.flush();
      for (let i = 0; i < writer.bytes.length; ++i) {
        out.push(writer.bytes[i]);
      }
      return out;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {LzxEncodeState} state - Initial repeat offsets
     * @returns {LzxTokens} Greedy parse
     */
    static _tokenise(data, state) {
      /** @type {LzxTokens} */
      const tokens = new LzxTokens();
      /** @type {HashChainMatchFinder} */
      const finder = new HashChainMatchFinder(WINDOW_SIZE, CHAIN_DEPTH);
      /** @type {int32} */
      let pos = 0;
      /** @type {float64} */
      let r0 = state.regs.r0;
      /** @type {float64} */
      let r1 = state.regs.r1;
      /** @type {float64} */
      let r2 = state.regs.r2;

      while (pos < data.length) {
        /** @type {MatchResult} */
        const match = finder.findMatch(data, pos, WINDOW_SIZE, MAX_MATCH, MIN_MATCH);
        if (match.length >= MIN_MATCH) {
          /** @type {int32} */
          const distance = match.distance;
          /** @type {boolean} */
          const isRepeat = distance === r0 || distance === r1 || distance === r2;
          /** @type {boolean} */
          const canEncode = isRepeat || distance >= MIN_NON_REPEAT_DISTANCE;

          if (canEncode) {
            tokens.add(false, 0, match.length, distance);

            if (!isRepeat) {
              r2 = r1;
              r1 = r0;
              r0 = distance;
            } else if (distance === r1) {
              /** @type {float64} */
              const t = r0;
              r0 = r1;
              r1 = t;
            } else if (distance === r2) {
              /** @type {float64} */
              const t = r0;
              r0 = r2;
              r2 = t;
            }

            for (let i = 1; i < match.length && pos + i < data.length; ++i) {
              finder.insertPosition(data, pos + i);
            }

            pos += match.length;
            continue;
          }
        }

        tokens.add(true, data[pos], 0, 0);
        ++pos;
      }

      return tokens;
    }

    // Returns the position slot for a distance, mutating the repeat-offset
    // registers held in `regs` as a side effect.
    /**
     * @param {int32} distance - Match distance
     * @param {RepeatOffsets} regs - Repeat-offset registers, updated
     * @returns {int32} Position slot
     */
    static _positionSlot(distance, regs) {
      if (distance === regs.r0) {
        return 0;
      }

      if (distance === regs.r1) {
        /** @type {float64} */
        const t = regs.r0;
        regs.r0 = regs.r1;
        regs.r1 = t;
        return 1;
      }

      if (distance === regs.r2) {
        /** @type {float64} */
        const t = regs.r0;
        regs.r0 = regs.r2;
        regs.r2 = t;
        return 2;
      }

      /** @type {int32} */
      const slot = offsetToSlot(distance - 2);
      regs.r2 = regs.r1;
      regs.r1 = regs.r0;
      regs.r0 = distance;
      return slot;
    }

    /**
     * @param {LzxBitWriter} writer - Output bits
     * @param {LzxTokens} tokens - All tokens
     * @param {int32} tokenStart - First token of the block
     * @param {int32} tokenEnd - End of the block's tokens
     * @param {int32} blockUncompressedSize - Bytes the block covers
     * @param {LzxEncodeState} state - Cross-block state, updated
     */
    static _emitVerbatimBlock(writer, tokens, tokenStart, tokenEnd, blockUncompressedSize, state) {
      /** @type {int32[]} */
      const mainFreq = filledArray(NUM_MAIN_SYMBOLS, 0);
      /** @type {int32[]} */
      const lengthFreq = filledArray(NUM_LENGTH_SYMBOLS, 0);
      /** @type {RepeatOffsets} */
      let regs = new RepeatOffsets(state.regs.r0, state.regs.r1, state.regs.r2);

      for (let i = tokenStart; i < tokenEnd; ++i) {
        if (tokens.isLiteral[i]) {
          ++mainFreq[tokens.value[i]];
          continue;
        }

        /** @type {int32} */
        const length = tokens.matchLength[i];
        /** @type {int32} */
        const slot = LZXInstance._positionSlot(tokens.offset[i], regs);
        /** @type {int32} */
        const lengthHeader = Math.min(length - MIN_MATCH, NUM_LENGTH_HEADERS - 1);
        ++mainFreq[NUM_CHARS + slot * NUM_LENGTH_HEADERS + lengthHeader];
        if (lengthHeader !== NUM_LENGTH_HEADERS - 1) {
          continue;
        }

        /** @type {int32} */
        const extraLen = length - MIN_MATCH - (NUM_LENGTH_HEADERS - 1);
        ++lengthFreq[Math.max(0, Math.min(extraLen, NUM_LENGTH_SYMBOLS - 1))];
      }

      /** @type {int32[]} */
      const mainLengths = buildCodeLengths(mainFreq, NUM_MAIN_SYMBOLS, MAX_HUFFMAN_BITS);
      /** @type {int32[]} */
      const lengthLengths = buildCodeLengths(lengthFreq, NUM_LENGTH_SYMBOLS, MAX_HUFFMAN_BITS);
      /** @type {int32[]} */
      const mainCodes = buildCanonicalCodes(mainLengths);
      /** @type {int32[]} */
      const lengthCodes = buildCanonicalCodes(lengthLengths);

      writer.writeBits(BLOCK_TYPE_VERBATIM, 3);
      if (blockUncompressedSize === DEFAULT_BLOCK_SIZE) {
        writer.writeBits(1, 1);
      } else {
        writer.writeBits(0, 1);
        writer.writeBits(blockUncompressedSize, 16);
      }

      LZXInstance._writeTreeWithPreTree(writer, mainLengths, 0, NUM_CHARS, state.prevMainLengths);
      LZXInstance._writeTreeWithPreTree(writer, mainLengths, NUM_CHARS, NUM_MAIN_SYMBOLS - NUM_CHARS, state.prevMainLengths);
      LZXInstance._writeTreeWithPreTree(writer, lengthLengths, 0, NUM_LENGTH_SYMBOLS, state.prevLengthLengths);

      for (let i = 0; i < NUM_MAIN_SYMBOLS; ++i) {
        state.prevMainLengths[i] = mainLengths[i];
      }
      for (let i = 0; i < NUM_LENGTH_SYMBOLS; ++i) {
        state.prevLengthLengths[i] = lengthLengths[i];
      }

      regs = new RepeatOffsets(state.regs.r0, state.regs.r1, state.regs.r2);
      for (let i = tokenStart; i < tokenEnd; ++i) {
        if (tokens.isLiteral[i]) {
          /** @type {int32} */
          const literal = tokens.value[i];
          writer.writeBits(mainCodes[literal], mainLengths[literal]);
          continue;
        }

        /** @type {int32} */
        const length = tokens.matchLength[i];
        /** @type {int32} */
        const offset = tokens.offset[i];
        /** @type {int32} */
        const slot = LZXInstance._positionSlot(offset, regs);
        /** @type {int32} */
        const lengthHeader = Math.min(length - MIN_MATCH, NUM_LENGTH_HEADERS - 1);
        /** @type {int32} */
        const mainSym = NUM_CHARS + slot * NUM_LENGTH_HEADERS + lengthHeader;
        writer.writeBits(mainCodes[mainSym], mainLengths[mainSym]);

        if (lengthHeader === NUM_LENGTH_HEADERS - 1) {
          /** @type {int32} */
          const extraLen = Math.max(0, Math.min(length - MIN_MATCH - (NUM_LENGTH_HEADERS - 1), NUM_LENGTH_SYMBOLS - 1));
          writer.writeBits(lengthCodes[extraLen], lengthLengths[extraLen]);
        }

        if (slot < 3) {
          continue;
        }

        /** @type {int32} */
        const footerBits = slotFooterBits(slot);
        if (footerBits <= 0) {
          continue;
        }

        writer.writeBits(offset - 2 - slotBase(slot), footerBits);
      }

      state.regs.r0 = regs.r0;
      state.regs.r1 = regs.r1;
      state.regs.r2 = regs.r2;
    }

    // Encodes one code-length list as a delta against the previous block's
    // lengths, run-length codes it and writes it behind a 20-symbol pre-tree.
    /**
     * @param {LzxBitWriter} writer - Output bits
     * @param {int32[]} lengths - New code lengths
     * @param {int32} start - First entry
     * @param {int32} count - Number of entries
     * @param {int32[]} prevLengths - Previous block's code lengths
     */
    static _writeTreeWithPreTree(writer, lengths, start, count, prevLengths) {
      /** @type {int32[]} */
      const deltas = filledArray(count, 0);
      for (let i = 0; i < count; ++i) {
        deltas[i] = (prevLengths[start + i] - lengths[start + i] + 17) % 17;
      }

      /** @type {int32[]} */
      const preSym = [];
      /** @type {int32[]} */
      const preExtra = [];
      /** @type {int32[]} */
      const preExtraBits = [];
      /** @type {int32} */
      let di = 0;
      while (di < count) {
        /** @type {int32} */
        const sym = deltas[di];

        if (sym !== 0) {
          preSym.push(sym);
          preExtra.push(0);
          preExtraBits.push(0);
          ++di;
          continue;
        }

        /** @type {int32} */
        let runLen = 0;
        while (di + runLen < count && deltas[di + runLen] === 0) {
          ++runLen;
        }

        while (runLen > 0) {
          if (runLen >= 20) {
            /** @type {int32} */
            const thisRun = Math.min(runLen, 51);
            preSym.push(18);
            preExtra.push(thisRun - 20);
            preExtraBits.push(5);
            di += thisRun;
            runLen -= thisRun;
          } else if (runLen >= 4) {
            /** @type {int32} */
            const thisRun = Math.min(runLen, 19);
            preSym.push(17);
            preExtra.push(thisRun - 4);
            preExtraBits.push(4);
            di += thisRun;
            runLen -= thisRun;
          } else {
            preSym.push(0);
            preExtra.push(0);
            preExtraBits.push(0);
            ++di;
            --runLen;
          }
        }
      }

      /** @type {int32[]} */
      const preFreq = filledArray(NUM_PRE_TREE_SYMBOLS, 0);
      for (let i = 0; i < preSym.length; ++i) {
        ++preFreq[preSym[i]];
      }

      /** @type {int32[]} */
      const preLengths = buildCodeLengths(preFreq, NUM_PRE_TREE_SYMBOLS, MAX_HUFFMAN_BITS);
      /** @type {int32[]} */
      const preCodes = buildCanonicalCodes(preLengths);

      for (let i = 0; i < NUM_PRE_TREE_SYMBOLS; ++i) {
        writer.writeBits(preLengths[i], PRE_TREE_BITS);
      }

      for (let i = 0; i < preSym.length; ++i) {
        /** @type {int32} */
        const sym = preSym[i];
        // A zero-length code means the symbol never appears; a one-bit dummy
        // keeps the stream well-formed.
        /** @type {int32} */
        const plen = preLengths[sym] === 0 ? 1 : preLengths[sym];
        writer.writeBits(preCodes[sym], plen);
        if (preExtraBits[i] > 0) {
          writer.writeBits(preExtra[i], preExtraBits[i]);
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
        throw new Error('LZX: input too small for header');
      }

      /** @type {uint32} */
      const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (uncompressedSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {LzxBitReader} */
      const reader = new LzxBitReader(data, 4);
      /** @type {uint8[]} */
      const output = new Array(uncompressedSize);
      /** @type {int32[]} */
      const window = filledArray(WINDOW_SIZE, 0);
      /** @type {LzxDecodeState} */
      const state = new LzxDecodeState();

      /** @type {float64} */
      let outPos = 0;
      while (outPos < uncompressedSize) {
        /** @type {uint32} */
        const blockType = reader.readBits(3);

        /** @type {float64} */
        let blockSize = 0;
        /** @type {uint32} */
        const defaultFlag = reader.readBits(1);
        if (defaultFlag === 1) {
          blockSize = DEFAULT_BLOCK_SIZE;
        } else {
          blockSize = reader.readBits(16);
        }

        blockSize = Math.min(blockSize, uncompressedSize - outPos);

        if (blockType === BLOCK_TYPE_VERBATIM) {
          LZXInstance._readVerbatimBlockHeader(reader, state);
          LZXInstance._decodeBlock(reader, state, window, false, output, outPos, blockSize);
        } else if (blockType === BLOCK_TYPE_ALIGNED) {
          for (let i = 0; i < NUM_ALIGNED_SYMBOLS; ++i) {
            /** @type {int32} */
            const len = reader.readBits(3);
            state.alignedLengths[i] = len;
          }
          state.alignedDecoder = buildDecoder(state.alignedLengths, NUM_ALIGNED_SYMBOLS);
          LZXInstance._readVerbatimBlockHeader(reader, state);
          LZXInstance._decodeBlock(reader, state, window, true, output, outPos, blockSize);
        } else if (blockType === BLOCK_TYPE_UNCOMPRESSED) {
          LZXInstance._decodeUncompressedBlock(reader, state, window, output, outPos, blockSize);
        } else {
          throw new Error('LZX: invalid block type ' + blockType);
        }

        outPos += blockSize;
      }

      return output;
    }

    /**
     * @param {LzxBitReader} reader - Input bits
     * @param {LzxDecodeState} state - Receives the main and length trees
     */
    static _readVerbatimBlockHeader(reader, state) {
      LZXInstance._readPreTreeAndApply(reader, state.mainLengths, 0, NUM_CHARS);
      LZXInstance._readPreTreeAndApply(reader, state.mainLengths, NUM_CHARS, NUM_MAIN_SYMBOLS - NUM_CHARS);
      LZXInstance._readPreTreeAndApply(reader, state.lengthLengths, 0, NUM_LENGTH_SYMBOLS);

      state.mainDecoder = buildDecoder(state.mainLengths, NUM_MAIN_SYMBOLS);
      state.lengthDecoder = buildDecoder(state.lengthLengths, NUM_LENGTH_SYMBOLS);
    }

    /**
     * @param {LzxBitReader} reader - Input bits
     * @param {int32[]} lengths - Code lengths, updated by the deltas
     * @param {int32} start - First entry
     * @param {int32} count - Number of entries
     */
    static _readPreTreeAndApply(reader, lengths, start, count) {
      /** @type {int32[]} */
      const preLengths = filledArray(NUM_PRE_TREE_SYMBOLS, 0);
      for (let i = 0; i < NUM_PRE_TREE_SYMBOLS; ++i) {
        /** @type {int32} */
        const len = reader.readBits(PRE_TREE_BITS);
        preLengths[i] = len;
      }

      /** @type {LzxDecoder} */
      const preDecoder = buildDecoder(preLengths, NUM_PRE_TREE_SYMBOLS);

      /** @type {int32} */
      let pos = start;
      /** @type {int32} */
      const end = start + count;
      while (pos < end) {
        /** @type {int32} */
        const sym = decodeSymbol(reader, preDecoder);

        if (sym < 17) {
          lengths[pos] = (lengths[pos] - sym + 17) % 17;
          ++pos;
        } else if (sym === 17) {
          /** @type {int32} */
          const field = reader.readBits(4);
          /** @type {int32} */
          let runLen = 4 + field;
          while (runLen-- > 0 && pos < end) {
            ++pos;
          }
        } else if (sym === 18) {
          /** @type {int32} */
          const field = reader.readBits(5);
          /** @type {int32} */
          let runLen = 20 + field;
          while (runLen-- > 0 && pos < end) {
            ++pos;
          }
        } else if (sym === 19) {
          /** @type {int32} */
          const field = reader.readBits(1);
          /** @type {int32} */
          let runLen = 4 + field;
          /** @type {int32} */
          const nextSym = decodeSymbol(reader, preDecoder);
          /** @type {int32} */
          const newLen = (lengths[pos] - nextSym + 17) % 17;
          while (runLen-- > 0 && pos < end) {
            lengths[pos++] = newLen;
          }
        } else {
          throw new Error('LZX: invalid pre-tree symbol ' + sym);
        }
      }
    }

    /**
     * @param {LzxBitReader} reader - Input bits
     * @param {LzxDecodeState} state - Trees, window position and repeat offsets
     * @param {int32[]} window - Sliding window
     * @param {boolean} isAligned - True for an aligned-offset block
     * @param {uint8[]} output - Output buffer
     * @param {float64} outPos - First output position of the block
     * @param {float64} blockSize - Bytes in the block
     */
    static _decodeBlock(reader, state, window, isAligned, output, outPos, blockSize) {
      /** @type {float64} */
      const end = outPos + blockSize;
      /** @type {float64} */
      let pos = outPos;

      while (pos < end) {
        /** @type {int32} */
        const mainSym = decodeSymbol(reader, state.mainDecoder);

        if (mainSym < NUM_CHARS) {
          output[pos++] = mainSym;
          window[state.windowPos] = mainSym;
          state.windowPos = OpCodes.And32(state.windowPos + 1, WINDOW_MASK);
          continue;
        }

        /** @type {int32} */
        const matchSym = mainSym - NUM_CHARS;
        /** @type {int32} */
        const positionSlot = Math.floor(matchSym / NUM_LENGTH_HEADERS);
        /** @type {int32} */
        const lengthHeader = matchSym % NUM_LENGTH_HEADERS;

        /** @type {int32} */
        let matchLength = lengthHeader + MIN_MATCH;
        if (lengthHeader === NUM_LENGTH_HEADERS - 1) {
          /** @type {int32} */
          const lenSym = decodeSymbol(reader, state.lengthDecoder);
          matchLength = NUM_LENGTH_HEADERS - 1 + MIN_MATCH + lenSym;
        }

        /** @type {float64} */
        const matchOffset = LZXInstance._decodeMatchOffset(reader, state, isAligned, positionSlot);

        /** @type {int32} */
        let srcPos = OpCodes.And32(state.windowPos - matchOffset + WINDOW_SIZE, WINDOW_MASK);
        for (let i = 0; i < matchLength && pos < end; ++i) {
          /** @type {int32} */
          const b = window[srcPos];
          output[pos++] = b;
          window[state.windowPos] = b;
          state.windowPos = OpCodes.And32(state.windowPos + 1, WINDOW_MASK);
          srcPos = OpCodes.And32(srcPos + 1, WINDOW_MASK);
        }
      }
    }

    /**
     * @param {LzxBitReader} reader - Input bits
     * @param {LzxDecodeState} state - Repeat offsets, updated
     * @param {boolean} isAligned - True for an aligned-offset block
     * @param {int32} positionSlot - Position slot
     * @returns {float64} Match distance
     */
    static _decodeMatchOffset(reader, state, isAligned, positionSlot) {
      /** @type {RepeatOffsets} */
      const regs = state.regs;
      if (positionSlot === 0) {
        return regs.r0;
      }

      if (positionSlot === 1) {
        /** @type {float64} */
        const t = regs.r0;
        regs.r0 = regs.r1;
        regs.r1 = t;
        return regs.r0;
      }

      if (positionSlot === 2) {
        /** @type {float64} */
        const t = regs.r0;
        regs.r0 = regs.r2;
        regs.r2 = t;
        return regs.r0;
      }

      /** @type {float64} */
      const base = slotBase(positionSlot);
      /** @type {int32} */
      const footerBits = slotFooterBits(positionSlot);

      /** @type {uint32} */
      let footer = 0;
      if (isAligned && footerBits >= 3) {
        /** @type {int32} */
        const verbatimBits = footerBits - 3;
        /** @type {uint32} */
        let verbatimValue = 0;
        if (verbatimBits > 0) {
          /** @type {uint32} */
          const verbatim = reader.readBits(verbatimBits);
          verbatimValue = OpCodes.Shl32(verbatim, 3);
        }
        /** @type {int32} */
        const alignedSym = decodeSymbol(reader, state.alignedDecoder);
        footer = OpCodes.Or32(verbatimValue, alignedSym);
      } else if (footerBits > 0) {
        footer = reader.readBits(footerBits);
      }

      /** @type {float64} */
      const matchOffset = base + footer + 2;
      regs.r2 = regs.r1;
      regs.r1 = regs.r0;
      regs.r0 = matchOffset;
      return matchOffset;
    }

    /**
     * @param {LzxBitReader} reader - Input bits
     * @param {LzxDecodeState} state - Window position and repeat offsets
     * @param {int32[]} window - Sliding window
     * @param {uint8[]} output - Output buffer
     * @param {float64} outPos - First output position of the block
     * @param {float64} blockSize - Bytes in the block
     */
    static _decodeUncompressedBlock(reader, state, window, output, outPos, blockSize) {
      reader.alignTo16Bits();

      /** @type {uint32} */
      const r0 = reader.readRawInt32LE();
      state.regs.r0 = r0;
      /** @type {uint32} */
      const r1 = reader.readRawInt32LE();
      state.regs.r1 = r1;
      /** @type {uint32} */
      const r2 = reader.readRawInt32LE();
      state.regs.r2 = r2;

      for (let i = 0; i < blockSize; ++i) {
        /** @type {int32} */
        const b = reader.readByte();
        if (b < 0) {
          throw new Error('LZX: unexpected end of stream');
        }
        output[outPos + i] = b;
      }

      if (OpCodes.And32(blockSize, 1) !== 0) {
        reader.readByte();
      }

      for (let i = 0; i < blockSize; ++i) {
        window[state.windowPos] = output[outPos + i];
        state.windowPos = OpCodes.And32(state.windowPos + 1, WINDOW_MASK);
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZXCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZXCompression, LZXInstance };
}));
