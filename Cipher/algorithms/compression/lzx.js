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

  // ===== POSITION SLOTS =====

  // Slot 0..3 map straight to offsets 0..3; beyond that each pair of slots
  // adds one footer bit, so slot 2k has base 2^k and slot 2k+1 has base
  // 3 * 2^(k-1).
  function offsetToSlot(offset) {
    if (offset < 4)
      return offset;

    let log2 = 0;
    let tmp = offset;
    while (tmp > 1) { tmp = Math.floor(tmp / 2); ++log2; }

    const halfBit = OpCodes.And32(OpCodes.Shr32(offset, log2 - 1), 1);
    return 2 * log2 + halfBit;
  }

  function getSlotInfo(slot) {
    if (slot < 4)
      return { base: slot, footerBits: 0 };

    const k = Math.floor(slot / 2);
    return {
      base: slot % 2 === 0 ? OpCodes.Shl32(1, k) : OpCodes.Shl32(3, k - 1),
      footerBits: k - 1
    };
  }

  // ===== LZX BIT STREAM (MSB-first bits, 16-bit little-endian words) =====

  class LzxBitWriter {
    constructor() {
      this.bytes = [];
      this.buffer = 0;
      this.bitsUsed = 0;
    }

    writeBits(value, count) {
      if (count === 0)
        return;

      const mask = count === 32 ? 0xFFFFFFFF : OpCodes.Shl32(1, count) - 1;
      const masked = OpCodes.And32(value, mask);

      this.buffer = OpCodes.Or32(OpCodes.Shl32(this.buffer, count), masked);
      this.bitsUsed += count;

      while (this.bitsUsed >= 16) {
        this.bitsUsed -= 16;
        const word = OpCodes.And32(OpCodes.Shr32(this.buffer, this.bitsUsed), 0xFFFF);
        this.bytes.push(OpCodes.And32(word, 0xFF));
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(word, 8), 0xFF));
      }
    }

    // Pads to the next 16-bit word boundary, then appends one zero word so a
    // decoder's lookahead never runs off the end of the byte stream.
    flush() {
      if (this.bitsUsed > 0) {
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
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.bitBuffer = 0;
      this.bitsLeft = 0;
      this.endOfStream = false;
    }

    readByte() {
      return this.pos < this.bytes.length ? this.bytes[this.pos++] : -1;
    }

    // Pulls one 16-bit little-endian word into the accumulator. Past the end
    // of the byte stream the accumulator is padded with zero words, which is
    // what the trailing zero word written by the encoder guarantees anyway.
    fill() {
      const lo = this.readByte();
      let hi = this.readByte();

      let word = 0;
      if (lo < 0) {
        this.endOfStream = true;
      } else {
        if (hi < 0) hi = 0;
        word = OpCodes.Or32(OpCodes.Shl32(hi, 8), lo);
      }

      this.bitBuffer = OpCodes.Or32(OpCodes.Shl32(this.bitBuffer, 16), word);
      this.bitsLeft += 16;
    }

    ensureBits(count) {
      while (this.bitsLeft < count)
        this.fill();
    }

    peekBits(count) {
      return OpCodes.And32(
        OpCodes.Shr32(this.bitBuffer, this.bitsLeft - count),
        OpCodes.Shl32(1, count) - 1
      );
    }

    removeBits(count) {
      this.bitsLeft -= count;
    }

    readBits(count) {
      if (count === 0)
        return 0;

      this.ensureBits(count);
      const value = this.peekBits(count);
      this.removeBits(count);
      return value;
    }

    alignTo16Bits() {
      const mod = OpCodes.And32(this.bitsLeft, 15);
      if (mod !== 0)
        this.removeBits(mod);
    }

    readRawInt32LE() {
      const b0 = this.readByte(), b1 = this.readByte(), b2 = this.readByte(), b3 = this.readByte();
      if (b0 < 0 || b1 < 0 || b2 < 0 || b3 < 0)
        throw new Error('LZX: unexpected end of stream');

      return OpCodes.Pack32LE(b0, b1, b2, b3);
    }
  }

  // ===== HUFFMAN =====

  // Plain Huffman build with deterministic tie-breaking (lowest frequency
  // first, then insertion order), depth-clamped to maxBits and then
  // Kraft-corrected.
  function buildCodeLengths(frequencies, numSymbols, maxBits) {
    const lengths = new Array(numSymbols).fill(0);
    const symbols = [];
    for (let i = 0; i < numSymbols; ++i)
      if (frequencies[i] > 0) symbols.push({ symbol: i, freq: frequencies[i] });

    if (symbols.length === 0)
      return lengths;
    if (symbols.length === 1) {
      lengths[symbols[0].symbol] = 1;
      return lengths;
    }

    const nodeCount = symbols.length * 2 - 1;
    const leftChild = new Array(nodeCount).fill(-1);
    const rightChild = new Array(nodeCount).fill(-1);
    const nodeSym = new Array(nodeCount).fill(-1);

    const sorted = [];
    let tieBreaker = 0;
    const insert = (freq, node) => {
      const entry = { freq: freq, tie: tieBreaker++, node: node };
      let lo = 0, hi = sorted.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const other = sorted[mid];
        if (other.freq < entry.freq || (other.freq === entry.freq && other.tie < entry.tie))
          lo = mid + 1;
        else
          hi = mid;
      }
      sorted.splice(lo, 0, entry);
    };

    for (let i = 0; i < symbols.length; ++i) {
      nodeSym[i] = symbols[i].symbol;
      insert(symbols[i].freq, i);
    }

    let nextNode = symbols.length;
    while (sorted.length > 1) {
      const first = sorted.shift();
      const second = sorted.shift();
      const parent = nextNode++;
      leftChild[parent] = first.node;
      rightChild[parent] = second.node;
      insert(first.freq + second.freq, parent);
    }

    const stack = [[sorted[0].node, 0]];
    while (stack.length > 0) {
      const entry = stack.pop();
      const node = entry[0], depth = entry[1];
      if (leftChild[node] === -1) {
        lengths[nodeSym[node]] = Math.max(1, Math.min(depth, maxBits));
      } else {
        if (leftChild[node] >= 0) stack.push([leftChild[node], depth + 1]);
        if (rightChild[node] >= 0) stack.push([rightChild[node], depth + 1]);
      }
    }

    fixKraftInequality(lengths, maxBits);
    return lengths;
  }

  function fixKraftInequality(lengths, maxBits) {
    const kraftMax = OpCodes.Shl32(1, maxBits);
    let kraftSum = 0;
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);

    // Every pass that finds a code below maxBits strictly reduces the Kraft
    // sum; the guard stops a pathological all-maxBits input from spinning.
    let guard = lengths.length * maxBits + 1024;
    while (kraftSum > kraftMax && guard-- > 0)
      for (let i = lengths.length - 1; i >= 0; --i) {
        if (lengths[i] <= 0 || lengths[i] >= maxBits)
          continue;

        kraftSum -= OpCodes.Shr32(kraftMax, lengths[i]);
        ++lengths[i];
        kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
        if (kraftSum <= kraftMax)
          break;
      }
  }

  // Canonical assignment, most-significant-bit first: shortest codes first,
  // symbols of equal length in ascending symbol order.
  function buildCanonicalCodes(lengths) {
    let maxLen = 0;
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > maxLen) maxLen = lengths[i];

    const codes = new Array(lengths.length).fill(0);
    if (maxLen === 0)
      return codes;

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) ++blCount[lengths[i]];

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) codes[i] = nextCode[lengths[i]]++;

    return codes;
  }

  // Decoder counterpart of the canonical numbering above. A tree with a
  // single used symbol decodes any bit pattern as that symbol, consuming its
  // nominal code length, which is what the reference decode table does.
  function buildDecoder(lengths, numSymbols) {
    const blCount = new Array(MAX_HUFFMAN_BITS + 1).fill(0);
    let usedCount = 0;
    let singleSym = -1;
    for (let i = 0; i < numSymbols; ++i) {
      const len = lengths[i];
      if (len <= 0 || len > MAX_HUFFMAN_BITS) continue;
      ++blCount[len];
      ++usedCount;
      singleSym = i;
    }

    if (usedCount === 1)
      return { single: singleSym, singleLength: lengths[singleSym] };

    const firstCode = new Array(MAX_HUFFMAN_BITS + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= MAX_HUFFMAN_BITS; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      firstCode[b] = code;
    }

    const symbolsByLength = [];
    for (let b = 0; b <= MAX_HUFFMAN_BITS; ++b) symbolsByLength.push([]);
    for (let sym = 0; sym < numSymbols; ++sym) {
      const len = lengths[sym];
      if (len <= 0 || len > MAX_HUFFMAN_BITS) continue;
      symbolsByLength[len].push(sym);
    }

    return { single: -1, firstCode: firstCode, symbolsByLength: symbolsByLength };
  }

  function decodeSymbol(reader, decoder) {
    if (decoder.single >= 0) {
      reader.ensureBits(decoder.singleLength);
      reader.removeBits(decoder.singleLength);
      return decoder.single;
    }

    for (let len = 1; len <= MAX_HUFFMAN_BITS; ++len) {
      reader.ensureBits(len);
      const code = reader.peekBits(len);
      const list = decoder.symbolsByLength[len];
      if (list.length > 0) {
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

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
    }

    static computeHash(data, position) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length)
        return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = HashChainMatchFinder.computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length])
            ++length;

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength)
              break;
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart)
          break;

        ++chainCount;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength
        ? { distance: bestDistance, length: bestLength }
        : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length)
        return;

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

  class LZXInstance extends IAlgorithmInstance {
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
      if (this.isInverse) {
        if (this.inputBuffer.length === 0)
          return [];
        const decoded = this._decompress();
        this.inputBuffer = [];
        return decoded;
      }

      const encoded = this._compress();
      this.inputBuffer = [];
      return encoded;
    }

    // ===== COMPRESSION =====

    _compress() {
      const data = this.inputBuffer;
      const out = OpCodes.Unpack32LE(data.length);
      if (data.length === 0)
        return out;

      // Compressor state that persists across blocks.
      const state = {
        r0: 1, r1: 1, r2: 1,
        prevMainLengths: new Array(NUM_MAIN_SYMBOLS).fill(0),
        prevLengthLengths: new Array(NUM_LENGTH_SYMBOLS).fill(0)
      };

      const writer = new LzxBitWriter();
      const tokens = LZXInstance._tokenise(data, state);

      let tokenStart = 0;
      while (tokenStart < tokens.length) {
        let blockBytes = 0;
        let blockTokenEnd = tokenStart;
        while (blockTokenEnd < tokens.length) {
          const tok = tokens[blockTokenEnd];
          const tokBytes = tok.isLiteral ? 1 : tok.length;
          if (blockBytes + tokBytes > DEFAULT_BLOCK_SIZE && blockBytes > 0)
            break;

          blockBytes += tokBytes;
          ++blockTokenEnd;
          if (blockBytes >= DEFAULT_BLOCK_SIZE)
            break;
        }

        LZXInstance._emitVerbatimBlock(writer, tokens, tokenStart, blockTokenEnd, blockBytes, state);
        tokenStart = blockTokenEnd;
      }

      writer.flush();
      for (let i = 0; i < writer.bytes.length; ++i) out.push(writer.bytes[i]);
      return out;
    }

    static _tokenise(data, state) {
      const tokens = [];
      const finder = new HashChainMatchFinder(WINDOW_SIZE, CHAIN_DEPTH);
      let pos = 0;
      let r0 = state.r0, r1 = state.r1, r2 = state.r2;

      while (pos < data.length) {
        const match = finder.findMatch(data, pos, WINDOW_SIZE, MAX_MATCH, MIN_MATCH);
        if (match.length >= MIN_MATCH) {
          const distance = match.distance;
          const isRepeat = distance === r0 || distance === r1 || distance === r2;
          const canEncode = isRepeat || distance >= MIN_NON_REPEAT_DISTANCE;

          if (canEncode) {
            tokens.push({ isLiteral: false, length: match.length, offset: distance });

            if (!isRepeat) {
              r2 = r1;
              r1 = r0;
              r0 = distance;
            } else if (distance === r1) {
              const t = r0; r0 = r1; r1 = t;
            } else if (distance === r2) {
              const t = r0; r0 = r2; r2 = t;
            }

            for (let i = 1; i < match.length && pos + i < data.length; ++i)
              finder.insertPosition(data, pos + i);

            pos += match.length;
            continue;
          }
        }

        tokens.push({ isLiteral: true, value: data[pos] });
        ++pos;
      }

      return tokens;
    }

    // Returns the position slot for a distance, mutating the repeat-offset
    // registers held in `regs` as a side effect.
    static _positionSlot(distance, regs) {
      if (distance === regs.r0)
        return 0;

      if (distance === regs.r1) {
        const t = regs.r0; regs.r0 = regs.r1; regs.r1 = t;
        return 1;
      }

      if (distance === regs.r2) {
        const t = regs.r0; regs.r0 = regs.r2; regs.r2 = t;
        return 2;
      }

      const slot = offsetToSlot(distance - 2);
      regs.r2 = regs.r1;
      regs.r1 = regs.r0;
      regs.r0 = distance;
      return slot;
    }

    static _emitVerbatimBlock(writer, tokens, tokenStart, tokenEnd, blockUncompressedSize, state) {
      const mainFreq = new Array(NUM_MAIN_SYMBOLS).fill(0);
      const lengthFreq = new Array(NUM_LENGTH_SYMBOLS).fill(0);
      let regs = { r0: state.r0, r1: state.r1, r2: state.r2 };

      for (let i = tokenStart; i < tokenEnd; ++i) {
        const tok = tokens[i];
        if (tok.isLiteral) {
          ++mainFreq[tok.value];
          continue;
        }

        const slot = LZXInstance._positionSlot(tok.offset, regs);
        const lengthHeader = Math.min(tok.length - MIN_MATCH, NUM_LENGTH_HEADERS - 1);
        ++mainFreq[NUM_CHARS + slot * NUM_LENGTH_HEADERS + lengthHeader];
        if (lengthHeader !== NUM_LENGTH_HEADERS - 1)
          continue;

        const extraLen = tok.length - MIN_MATCH - (NUM_LENGTH_HEADERS - 1);
        ++lengthFreq[Math.max(0, Math.min(extraLen, NUM_LENGTH_SYMBOLS - 1))];
      }

      const mainLengths = buildCodeLengths(mainFreq, NUM_MAIN_SYMBOLS, MAX_HUFFMAN_BITS);
      const lengthLengths = buildCodeLengths(lengthFreq, NUM_LENGTH_SYMBOLS, MAX_HUFFMAN_BITS);
      const mainCodes = buildCanonicalCodes(mainLengths);
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

      for (let i = 0; i < NUM_MAIN_SYMBOLS; ++i) state.prevMainLengths[i] = mainLengths[i];
      for (let i = 0; i < NUM_LENGTH_SYMBOLS; ++i) state.prevLengthLengths[i] = lengthLengths[i];

      regs = { r0: state.r0, r1: state.r1, r2: state.r2 };
      for (let i = tokenStart; i < tokenEnd; ++i) {
        const tok = tokens[i];
        if (tok.isLiteral) {
          writer.writeBits(mainCodes[tok.value], mainLengths[tok.value]);
          continue;
        }

        const slot = LZXInstance._positionSlot(tok.offset, regs);
        const lengthHeader = Math.min(tok.length - MIN_MATCH, NUM_LENGTH_HEADERS - 1);
        const mainSym = NUM_CHARS + slot * NUM_LENGTH_HEADERS + lengthHeader;
        writer.writeBits(mainCodes[mainSym], mainLengths[mainSym]);

        if (lengthHeader === NUM_LENGTH_HEADERS - 1) {
          const extraLen = Math.max(0, Math.min(tok.length - MIN_MATCH - (NUM_LENGTH_HEADERS - 1), NUM_LENGTH_SYMBOLS - 1));
          writer.writeBits(lengthCodes[extraLen], lengthLengths[extraLen]);
        }

        if (slot < 3)
          continue;

        const info = getSlotInfo(slot);
        if (info.footerBits <= 0)
          continue;

        writer.writeBits(tok.offset - 2 - info.base, info.footerBits);
      }

      state.r0 = regs.r0;
      state.r1 = regs.r1;
      state.r2 = regs.r2;
    }

    // Encodes one code-length list as a delta against the previous block's
    // lengths, run-length codes it and writes it behind a 20-symbol pre-tree.
    static _writeTreeWithPreTree(writer, lengths, start, count, prevLengths) {
      const deltas = new Array(count).fill(0);
      for (let i = 0; i < count; ++i)
        deltas[i] = (prevLengths[start + i] - lengths[start + i] + 17) % 17;

      const preSymbols = [];
      let di = 0;
      while (di < count) {
        const sym = deltas[di];

        if (sym !== 0) {
          preSymbols.push({ sym: sym, extra: 0, extraBits: 0 });
          ++di;
          continue;
        }

        let runLen = 0;
        while (di + runLen < count && deltas[di + runLen] === 0) ++runLen;

        while (runLen > 0) {
          if (runLen >= 20) {
            const thisRun = Math.min(runLen, 51);
            preSymbols.push({ sym: 18, extra: thisRun - 20, extraBits: 5 });
            di += thisRun;
            runLen -= thisRun;
          } else if (runLen >= 4) {
            const thisRun = Math.min(runLen, 19);
            preSymbols.push({ sym: 17, extra: thisRun - 4, extraBits: 4 });
            di += thisRun;
            runLen -= thisRun;
          } else {
            preSymbols.push({ sym: 0, extra: 0, extraBits: 0 });
            ++di;
            --runLen;
          }
        }
      }

      const preFreq = new Array(NUM_PRE_TREE_SYMBOLS).fill(0);
      for (let i = 0; i < preSymbols.length; ++i) ++preFreq[preSymbols[i].sym];

      const preLengths = buildCodeLengths(preFreq, NUM_PRE_TREE_SYMBOLS, MAX_HUFFMAN_BITS);
      const preCodes = buildCanonicalCodes(preLengths);

      for (let i = 0; i < NUM_PRE_TREE_SYMBOLS; ++i)
        writer.writeBits(preLengths[i], PRE_TREE_BITS);

      for (let i = 0; i < preSymbols.length; ++i) {
        const entry = preSymbols[i];
        // A zero-length code means the symbol never appears; a one-bit dummy
        // keeps the stream well-formed.
        const plen = preLengths[entry.sym] === 0 ? 1 : preLengths[entry.sym];
        writer.writeBits(preCodes[entry.sym], plen);
        if (entry.extraBits > 0)
          writer.writeBits(entry.extra, entry.extraBits);
      }
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const data = this.inputBuffer;
      if (data.length < 4)
        throw new Error('LZX: input too small for header');

      const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (uncompressedSize === 0)
        return [];

      const reader = new LzxBitReader(data, 4);
      const output = new Array(uncompressedSize);
      const window = new Array(WINDOW_SIZE).fill(0);
      const state = {
        windowPos: 0,
        r0: 1, r1: 1, r2: 1,
        mainLengths: new Array(NUM_MAIN_SYMBOLS).fill(0),
        lengthLengths: new Array(NUM_LENGTH_SYMBOLS).fill(0),
        alignedLengths: new Array(NUM_ALIGNED_SYMBOLS).fill(0),
        mainDecoder: null,
        lengthDecoder: null,
        alignedDecoder: null
      };

      let outPos = 0;
      while (outPos < uncompressedSize) {
        const blockType = reader.readBits(3);

        let blockSize;
        if (reader.readBits(1) === 1)
          blockSize = DEFAULT_BLOCK_SIZE;
        else
          blockSize = reader.readBits(16);

        blockSize = Math.min(blockSize, uncompressedSize - outPos);

        if (blockType === BLOCK_TYPE_VERBATIM) {
          LZXInstance._readVerbatimBlockHeader(reader, state);
          LZXInstance._decodeBlock(reader, state, window, false, output, outPos, blockSize);
        } else if (blockType === BLOCK_TYPE_ALIGNED) {
          for (let i = 0; i < NUM_ALIGNED_SYMBOLS; ++i)
            state.alignedLengths[i] = reader.readBits(3);
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

    static _readVerbatimBlockHeader(reader, state) {
      LZXInstance._readPreTreeAndApply(reader, state.mainLengths, 0, NUM_CHARS);
      LZXInstance._readPreTreeAndApply(reader, state.mainLengths, NUM_CHARS, NUM_MAIN_SYMBOLS - NUM_CHARS);
      LZXInstance._readPreTreeAndApply(reader, state.lengthLengths, 0, NUM_LENGTH_SYMBOLS);

      state.mainDecoder = buildDecoder(state.mainLengths, NUM_MAIN_SYMBOLS);
      state.lengthDecoder = buildDecoder(state.lengthLengths, NUM_LENGTH_SYMBOLS);
    }

    static _readPreTreeAndApply(reader, lengths, start, count) {
      const preLengths = new Array(NUM_PRE_TREE_SYMBOLS).fill(0);
      for (let i = 0; i < NUM_PRE_TREE_SYMBOLS; ++i)
        preLengths[i] = reader.readBits(PRE_TREE_BITS);

      const preDecoder = buildDecoder(preLengths, NUM_PRE_TREE_SYMBOLS);

      let pos = start;
      const end = start + count;
      while (pos < end) {
        const sym = decodeSymbol(reader, preDecoder);

        if (sym < 17) {
          lengths[pos] = (lengths[pos] - sym + 17) % 17;
          ++pos;
        } else if (sym === 17) {
          let runLen = 4 + reader.readBits(4);
          while (runLen-- > 0 && pos < end) ++pos;
        } else if (sym === 18) {
          let runLen = 20 + reader.readBits(5);
          while (runLen-- > 0 && pos < end) ++pos;
        } else if (sym === 19) {
          let runLen = 4 + reader.readBits(1);
          const nextSym = decodeSymbol(reader, preDecoder);
          const newLen = (lengths[pos] - nextSym + 17) % 17;
          while (runLen-- > 0 && pos < end) lengths[pos++] = newLen;
        } else {
          throw new Error('LZX: invalid pre-tree symbol ' + sym);
        }
      }
    }

    static _decodeBlock(reader, state, window, isAligned, output, outPos, blockSize) {
      const end = outPos + blockSize;
      let pos = outPos;

      while (pos < end) {
        const mainSym = decodeSymbol(reader, state.mainDecoder);

        if (mainSym < NUM_CHARS) {
          output[pos++] = mainSym;
          window[state.windowPos] = mainSym;
          state.windowPos = OpCodes.And32(state.windowPos + 1, WINDOW_MASK);
          continue;
        }

        const matchSym = mainSym - NUM_CHARS;
        const positionSlot = Math.floor(matchSym / NUM_LENGTH_HEADERS);
        const lengthHeader = matchSym % NUM_LENGTH_HEADERS;

        let matchLength = lengthHeader + MIN_MATCH;
        if (lengthHeader === NUM_LENGTH_HEADERS - 1) {
          const lenSym = decodeSymbol(reader, state.lengthDecoder);
          matchLength = NUM_LENGTH_HEADERS - 1 + MIN_MATCH + lenSym;
        }

        const matchOffset = LZXInstance._decodeMatchOffset(reader, state, isAligned, positionSlot);

        let srcPos = OpCodes.And32(state.windowPos - matchOffset + WINDOW_SIZE, WINDOW_MASK);
        for (let i = 0; i < matchLength && pos < end; ++i) {
          const b = window[srcPos];
          output[pos++] = b;
          window[state.windowPos] = b;
          state.windowPos = OpCodes.And32(state.windowPos + 1, WINDOW_MASK);
          srcPos = OpCodes.And32(srcPos + 1, WINDOW_MASK);
        }
      }
    }

    static _decodeMatchOffset(reader, state, isAligned, positionSlot) {
      if (positionSlot === 0)
        return state.r0;

      if (positionSlot === 1) {
        const t = state.r0; state.r0 = state.r1; state.r1 = t;
        return state.r0;
      }

      if (positionSlot === 2) {
        const t = state.r0; state.r0 = state.r2; state.r2 = t;
        return state.r0;
      }

      const info = getSlotInfo(positionSlot);

      let footer;
      if (isAligned && info.footerBits >= 3) {
        const verbatimBits = info.footerBits - 3;
        const verbatimValue = verbatimBits > 0 ? OpCodes.Shl32(reader.readBits(verbatimBits), 3) : 0;
        const alignedSym = decodeSymbol(reader, state.alignedDecoder);
        footer = OpCodes.Or32(verbatimValue, alignedSym);
      } else {
        footer = info.footerBits > 0 ? reader.readBits(info.footerBits) : 0;
      }

      const matchOffset = info.base + footer + 2;
      state.r2 = state.r1;
      state.r1 = state.r0;
      state.r0 = matchOffset;
      return matchOffset;
    }

    static _decodeUncompressedBlock(reader, state, window, output, outPos, blockSize) {
      reader.alignTo16Bits();

      state.r0 = reader.readRawInt32LE();
      state.r1 = reader.readRawInt32LE();
      state.r2 = reader.readRawInt32LE();

      for (let i = 0; i < blockSize; ++i) {
        const b = reader.readByte();
        if (b < 0)
          throw new Error('LZX: unexpected end of stream');
        output[outPos + i] = b;
      }

      if (OpCodes.And32(blockSize, 1) !== 0)
        reader.readByte();

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
