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

  // ===== BIT STREAM HELPERS (most-significant-bit first) =====

  class MsbBitWriter {
    constructor() {
      this.bytes = [];
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;
      if (this.bitsInBuffer !== 8)
        return;

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBits(value, count) {
      for (let i = 0; i < count; ++i)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, count - 1 - i), 1));
    }

    flush() {
      if (this.bitsInBuffer <= 0)
        return;

      this.bytes.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  class MsbBitReader {
    constructor(bytes, start) {
      this.bytes = bytes;
      this.pos = start;
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    readBits(count) {
      let result = 0;
      for (let i = 0; i < count; ++i) {
        if (this.bitsInBuffer === 0) {
          this.buffer = this.pos < this.bytes.length ? this.bytes[this.pos++] : 0;
          this.bitsInBuffer = 8;
        }
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

  // Decode side of the same numbering. Lengths above maxBits are excluded
  // from the canonical numbering, matching the reference decode table.
  function buildDecoder(lengths, maxBits) {
    const blCount = new Array(maxBits + 1).fill(0);
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0 && lengths[i] <= maxBits) ++blCount[lengths[i]];

    const firstCode = new Array(maxBits + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxBits; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      firstCode[b] = code;
    }

    const symbolsByLength = [];
    for (let b = 0; b <= maxBits; ++b) symbolsByLength.push([]);
    for (let sym = 0; sym < lengths.length; ++sym) {
      const len = lengths[sym];
      if (len === 0 || len > maxBits) continue;
      symbolsByLength[len].push(sym);
    }

    return { firstCode: firstCode, symbolsByLength: symbolsByLength, maxBits: maxBits };
  }

  function decodeSymbol(reader, decoder) {
    let code = 0;
    for (let len = 1; len <= decoder.maxBits; ++len) {
      code = OpCodes.Or32(OpCodes.Shl32(code, 1), reader.readBits(1));
      const list = decoder.symbolsByLength[len];
      if (list.length > 0) {
        const index = code - decoder.firstCode[len];
        if (index >= 0 && index < list.length)
          return list[index];
      }
    }
    throw new Error('LZH: invalid Huffman code in stream');
  }

  // Huffman length assignment with deterministic tie-breaking (lowest
  // frequency first, then insertion order), depth-clamped to maxBits and
  // then Kraft-corrected.
  function buildCodeLengths(frequencies, maxBits) {
    const n = frequencies.length;
    const lengths = new Array(n).fill(0);
    const symbols = [];
    for (let i = 0; i < n; ++i)
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
        lengths[nodeSym[node]] = Math.min(depth, maxBits);
      } else {
        if (leftChild[node] >= 0) stack.push([leftChild[node], depth + 1]);
        if (rightChild[node] >= 0) stack.push([rightChild[node], depth + 1]);
      }
    }

    fixCodeLengths(lengths, maxBits);
    return lengths;
  }

  // Lengthens codes until the Kraft sum fits, walking from the last symbol
  // backwards.
  function fixCodeLengths(lengths, maxBits) {
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

  function countUsedSymbols(lengths) {
    let used = 0;
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) ++used;
    return used;
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

  class LZHInstance extends IAlgorithmInstance {
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

      const payload = this._encode(data);
      for (let i = 0; i < payload.length; ++i) out.push(payload[i]);
      return out;
    }

    _generateTokens(data) {
      const tokens = [];
      const finder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
      let pos = 0;

      while (pos < data.length) {
        const match = finder.findMatch(data, pos, WINDOW_SIZE, MAX_MATCH, THRESHOLD);

        if (match.length >= THRESHOLD) {
          tokens.push({ isLiteral: false, length: match.length, distance: match.distance - 1 });
          for (let i = 1; i < match.length && pos + i < data.length; ++i)
            finder.insertPosition(data, pos + i);

          pos += match.length;
        } else {
          tokens.push({ isLiteral: true, value: data[pos] });
          ++pos;
        }
      }

      return tokens;
    }

    // Slot 0 covers distance 0, slot 1 distance 1, and slot s (s of at
    // least 2) covers [2^(s-1), 2^s - 1] with (s - 1) raw extra bits.
    static _positionSlot(distance) {
      if (distance <= 1)
        return distance;

      let slot = 1;
      let d = distance;
      while (d > 1) { d = Math.floor(d / 2); ++slot; }
      return slot;
    }

    _encode(data) {
      const tokens = this._generateTokens(data);
      const bits = new MsbBitWriter();
      let tokenIdx = 0;

      while (tokenIdx < tokens.length) {
        const blockEnd = Math.min(tokenIdx + BLOCK_SIZE, tokens.length);
        const blockCount = blockEnd - tokenIdx;

        const codeFreq = new Array(NUM_CODES).fill(0);
        let maxPosSlot = -1;

        for (let i = tokenIdx; i < blockEnd; ++i) {
          const token = tokens[i];
          if (token.isLiteral) {
            ++codeFreq[token.value];
          } else {
            ++codeFreq[token.length - THRESHOLD + N_CHAR];
            const slot = LZHInstance._positionSlot(token.distance);
            if (slot > maxPosSlot) maxPosSlot = slot;
          }
        }

        const posFreq = new Array(Math.max(maxPosSlot + 1, 1)).fill(0);
        for (let i = tokenIdx; i < blockEnd; ++i)
          if (!tokens[i].isLiteral)
            ++posFreq[LZHInstance._positionSlot(tokens[i].distance)];

        const codeLengths = buildCodeLengths(codeFreq, MAX_CODE_BITS);
        const posLengths = buildCodeLengths(posFreq, MAX_POSITION_BITS);

        const codeSingle = countUsedSymbols(codeLengths) <= 1;
        const posSingle = countUsedSymbols(posLengths) <= 1;

        bits.writeBits(blockCount, 16);
        LZHInstance._writeCTree(bits, codeLengths);
        LZHInstance._writePtTree(bits, posLengths, P_BIT, P_BIT);

        const codeCodes = buildCanonicalCodes(codeLengths);
        const posCodes = buildCanonicalCodes(posLengths);

        for (let i = tokenIdx; i < blockEnd; ++i) {
          const token = tokens[i];
          if (token.isLiteral) {
            if (!codeSingle)
              bits.writeBits(codeCodes[token.value], codeLengths[token.value]);
            continue;
          }

          const lengthCode = token.length - THRESHOLD + N_CHAR;
          if (!codeSingle)
            bits.writeBits(codeCodes[lengthCode], codeLengths[lengthCode]);

          const slot = LZHInstance._positionSlot(token.distance);
          if (!posSingle)
            bits.writeBits(posCodes[slot], posLengths[slot]);

          if (slot <= 1)
            continue;

          const extraBits = slot - 1;
          bits.writeBits(token.distance - OpCodes.Shl32(1, extraBits), extraBits);
        }

        tokenIdx = blockEnd;
      }

      bits.flush();
      return bits.bytes;
    }

    // Writes the literal/length tree: a T tree describing the code lengths,
    // then the count of transmitted lengths, then the run-length coded
    // lengths themselves.
    static _writeCTree(bits, codeLengths) {
      let numC = codeLengths.length;
      while (numC > 0 && codeLengths[numC - 1] === 0) --numC;
      if (numC === 0) numC = 1;

      let singleSym = -1;
      let usedCount = 0;
      for (let i = 0; i < codeLengths.length; ++i)
        if (codeLengths[i] > 0) { singleSym = i; ++usedCount; }

      if (usedCount <= 1) {
        LZHInstance._writePtTree(bits, new Array(NUM_CODE_LENGTH_SYMBOLS).fill(0), 5, 3);
        bits.writeBits(0, 9);
        bits.writeBits(usedCount > 0 ? singleSym : 0, 9);
        return;
      }

      // T alphabet: 0 = a single zero length, 1 = run of (3 plus 4 raw bits)
      // zeros, 2 = run of (20 plus 9 raw bits) zeros, 3..18 = an actual code
      // length of (symbol - 2).
      const tSymbols = [];
      let i2 = 0;
      while (i2 < numC) {
        if (codeLengths[i2] === 0) {
          let zeroRun = 0;
          while (i2 + zeroRun < numC && codeLengths[i2 + zeroRun] === 0) ++zeroRun;

          let remaining = zeroRun;
          while (remaining > 0) {
            if (remaining >= 20) {
              const count = Math.min(remaining, 20 + 511);
              tSymbols.push({ sym: 2, extraBits: 9, extraValue: count - 20 });
              remaining -= count;
            } else if (remaining >= 3) {
              const count = Math.min(remaining, 3 + 15);
              tSymbols.push({ sym: 1, extraBits: 4, extraValue: count - 3 });
              remaining -= count;
            } else {
              tSymbols.push({ sym: 0, extraBits: 0, extraValue: 0 });
              --remaining;
            }
          }
          i2 += zeroRun;
        } else {
          tSymbols.push({ sym: codeLengths[i2] + 2, extraBits: 0, extraValue: 0 });
          ++i2;
        }
      }

      const tFreq = new Array(NUM_CODE_LENGTH_SYMBOLS).fill(0);
      for (let i = 0; i < tSymbols.length; ++i) ++tFreq[tSymbols[i].sym];

      const tLengths = buildCodeLengths(tFreq, T_TREE_MAX_BITS);
      LZHInstance._writePtTree(bits, tLengths, 5, 3);
      bits.writeBits(numC, 9);

      const tCodes = buildCanonicalCodes(tLengths);
      const tIsSingle = countUsedSymbols(tLengths) <= 1;

      for (let i = 0; i < tSymbols.length; ++i) {
        const entry = tSymbols[i];
        if (!tIsSingle)
          bits.writeBits(tCodes[entry.sym], tLengths[entry.sym]);
        if (entry.extraBits > 0)
          bits.writeBits(entry.extraValue, entry.extraBits);
      }
    }

    // Writes a PT-style tree, used for both the T tree (nBit 5, specialBit 3)
    // and the position tree (nBit and specialBit both P_BIT). Format: symbol
    // count in nBit bits, then per symbol a 3-bit length with a unary
    // extension for lengths of 7 or more; when specialBit is 3 a 2-bit skip
    // count follows index 2. A count of zero means a single symbol whose
    // index follows in nBit bits.
    static _writePtTree(bits, lengths, nBit, specialBit) {
      let numSym = lengths.length;
      while (numSym > 0 && lengths[numSym - 1] === 0) --numSym;

      let singleSym = -1;
      let usedCount = 0;
      for (let i = 0; i < lengths.length; ++i)
        if (lengths[i] > 0) { singleSym = i; ++usedCount; }

      if (usedCount <= 1) {
        bits.writeBits(0, nBit);
        bits.writeBits(usedCount > 0 ? singleSym : 0, nBit);
        return;
      }

      bits.writeBits(numSym, nBit);

      for (let i = 0; i < numSym; ++i) {
        const len = lengths[i];
        if (len < 7) {
          bits.writeBits(len, 3);
        } else {
          bits.writeBits(7, 3);
          for (let j = 0; j < len - 7; ++j)
            bits.writeBits(1, 1);
          bits.writeBits(0, 1);
        }

        if (i === 2 && specialBit === 3) {
          let skipCount = 0;
          while (i + 1 + skipCount < numSym && skipCount < 3 && lengths[i + 1 + skipCount] === 0)
            ++skipCount;
          bits.writeBits(skipCount, 2);
          i += skipCount;
        }
      }
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const data = this.inputBuffer;
      if (data.length < 4)
        throw new Error('LZH: input too small for header');

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0)
        return [];

      const reader = new MsbBitReader(data, 4);
      const state = {
        blockRemaining: 0,
        singleCodeSymbol: -1,
        codeDecoder: null,
        singlePosSymbol: -1,
        posDecoder: null
      };

      const output = new Array(originalSize);
      const window = new Array(WINDOW_SIZE).fill(0);
      let windowPos = 0;
      let outPos = 0;

      while (outPos < originalSize) {
        if (state.blockRemaining === 0)
          LZHInstance._readBlock(reader, state);

        const code = state.singleCodeSymbol >= 0
          ? state.singleCodeSymbol
          : decodeSymbol(reader, state.codeDecoder);
        --state.blockRemaining;

        if (code < N_CHAR) {
          output[outPos++] = code;
          window[windowPos] = code;
          windowPos = OpCodes.And32(windowPos + 1, WINDOW_MASK);
        } else {
          const length = code - N_CHAR + THRESHOLD;
          const position = LZHInstance._decodePosition(reader, state);
          let srcPos = OpCodes.And32(windowPos - position - 1 + WINDOW_SIZE, WINDOW_MASK);
          for (let j = 0; j < length && outPos < originalSize; ++j) {
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

    static _decodePosition(reader, state) {
      const slot = state.singlePosSymbol >= 0
        ? state.singlePosSymbol
        : decodeSymbol(reader, state.posDecoder);

      if (slot <= 1)
        return slot;

      const extraBits = slot - 1;
      return OpCodes.Shl32(1, extraBits) + reader.readBits(extraBits);
    }

    static _readBlock(reader, state) {
      state.blockRemaining = reader.readBits(16);
      LZHInstance._readCTree(reader, state);
      LZHInstance._readPTree(reader, state);
    }

    static _readPtTree(reader, nBit, specialBit) {
      const numSym = reader.readBits(nBit);
      if (numSym === 0) {
        const sym = reader.readBits(nBit);
        const lengths = new Array(sym + 1).fill(0);
        lengths[sym] = 1;
        return lengths;
      }

      const codeLengths = new Array(numSym).fill(0);
      for (let i = 0; i < numSym; ++i) {
        let len = reader.readBits(3);
        if (len === 7)
          while (reader.readBits(1) === 1) ++len;
        codeLengths[i] = len;

        if (i === 2 && specialBit === 3) {
          const skip = reader.readBits(2);
          for (let j = 0; j < skip && i + 1 < numSym; ++j) {
            ++i;
            codeLengths[i] = 0;
          }
        }
      }

      return codeLengths;
    }

    static _readCTree(reader, state) {
      const tLengths = LZHInstance._readPtTree(reader, 5, 3);

      let tSingleSym = -1;
      let tUsed = 0;
      for (let j = 0; j < tLengths.length; ++j)
        if (tLengths[j] > 0) { tSingleSym = j; ++tUsed; }

      let tDecoder = null;
      if (tUsed > 1) {
        tSingleSym = -1;
        let maxLen = 0;
        for (let j = 0; j < tLengths.length; ++j)
          if (tLengths[j] > maxLen) maxLen = tLengths[j];
        tDecoder = buildDecoder(tLengths, Math.min(maxLen, 12));
      }

      const numC = reader.readBits(9);
      if (numC === 0) {
        state.singleCodeSymbol = reader.readBits(9);
        state.codeDecoder = null;
        return;
      }

      const codeLengths = new Array(Math.max(numC, NUM_CODES)).fill(0);
      let i = 0;
      while (i < numC) {
        let tSym;
        if (tSingleSym >= 0)
          tSym = tSingleSym;
        else if (tDecoder !== null)
          tSym = decodeSymbol(reader, tDecoder);
        else
          tSym = 0;

        if (tSym === 0) {
          codeLengths[i++] = 0;
        } else if (tSym === 1) {
          const run = 3 + reader.readBits(4);
          for (let j = 0; j < run && i < numC; ++j) codeLengths[i++] = 0;
        } else if (tSym === 2) {
          const run = 20 + reader.readBits(9);
          for (let j = 0; j < run && i < numC; ++j) codeLengths[i++] = 0;
        } else {
          codeLengths[i++] = tSym - 2;
        }
      }

      state.singleCodeSymbol = -1;
      let maxCodeLen = 0;
      for (let j = 0; j < codeLengths.length; ++j)
        if (codeLengths[j] > maxCodeLen) maxCodeLen = codeLengths[j];

      if (maxCodeLen === 0) {
        state.singleCodeSymbol = 0;
        state.codeDecoder = null;
      } else {
        state.codeDecoder = buildDecoder(codeLengths, Math.min(maxCodeLen, 16));
      }
    }

    static _readPTree(reader, state) {
      const ptLengths = LZHInstance._readPtTree(reader, P_BIT, P_BIT);

      let usedCount = 0;
      let singleSym = -1;
      for (let i = 0; i < ptLengths.length; ++i)
        if (ptLengths[i] > 0) { singleSym = i; ++usedCount; }

      if (usedCount <= 1) {
        state.singlePosSymbol = usedCount > 0 ? singleSym : 0;
        state.posDecoder = null;
        return;
      }

      state.singlePosSymbol = -1;
      let maxLen = 0;
      for (let i = 0; i < ptLengths.length; ++i)
        if (ptLengths[i] > maxLen) maxLen = ptLengths[i];
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
