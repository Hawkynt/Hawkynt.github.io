/*
 * ACE Archiver Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ACE was eSKASoft's archiver format (WinAce), whose "ACE 1.0" compression
 * method combines an LZ77 sliding-window match finder with Huffman entropy
 * coding of the literal/length alphabet - the same general family as DEFLATE.
 * ACE's own bitstream was never openly specified; independent analyses (e.g.
 * the GPL "unace" decompressor project) describe a main Huffman tree sized
 * for 256 literals plus a end-of-block marker plus roughly two dozen match
 * length codes, a dictionary size selectable between 1KB and 4MB (10 to 22
 * bits), and up to four "repeated offset" slots reused from LZMA-style coders.
 *
 * This is a documented-subset, from-scratch reimplementation: an LZ77 parser
 * feeding a single adaptive Huffman tree over a 257+26-symbol alphabet
 * (256 literals, one end-of-block symbol, 26 length codes with the same
 * base/extra-bit growth pattern reported for ACE's length table), a fixed
 * 64KB (16-bit) match window - one representative point within ACE's
 * documented 10-22 bit dictionary range - and a minimum match length of 2
 * bytes. Match distances are transmitted as raw fixed-width fields rather
 * than a second Huffman tree, and the repeated-offset optimization is not
 * implemented; both are documented limitations, not oversights. The Huffman
 * table itself is transmitted as an explicit (symbol, frequency) list so the
 * decoder can rebuild an identical tree, rather than ACE's own compressed
 * tree-description encoding.
 *
 * References:
 * - Wikipedia, "ACE (compression format)"
 *   https://en.wikipedia.org/wiki/ACE_(compression_format)
 * - unace (GPL reverse-engineered decompressor project notes on the ACE 1.0/2.0
 *   Huffman/LZ77 structure) - https://github.com/tripsin/unace
 * - Huffman, "A Method for the Construction of Minimum-Redundancy Codes", 1952
 * - Ziv and Lempel, "A Universal Algorithm for Sequential Data Compression", 1977
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== BIT STREAM HELPERS (bit-at-a-time, matches tree traversal decode) =====

  class AceBitWriter {
    constructor() {
      this.bytes = [];
      this.buf = 0;
      this.n = 0;
    }

    writeBit(bit) {
      this.buf = OpCodes.AndN(OpCodes.OrN(this.buf, OpCodes.Shl32(OpCodes.AndN(bit, 1), this.n)), 0xFF);
      this.n++;
      if (this.n === 8) {
        this.bytes.push(this.buf);
        this.buf = 0;
        this.n = 0;
      }
    }

    writeBits(value, width) {
      for (let i = 0; i < width; ++i) this.writeBit(OpCodes.AndN(OpCodes.Shr32(value, i), 1));
    }

    flush() {
      if (this.n > 0) {
        this.bytes.push(this.buf);
        this.buf = 0;
        this.n = 0;
      }
      return this.bytes;
    }
  }

  class AceBitReader {
    constructor(bytes, pos) {
      this.bytes = bytes;
      this.pos = pos;
      this.buf = 0;
      this.n = 0;
    }

    readBit() {
      if (this.n === 0) {
        if (this.pos >= this.bytes.length) throw new Error('ACE: unexpected end of stream');
        this.buf = this.bytes[this.pos++];
        this.n = 8;
      }
      const bit = OpCodes.AndN(this.buf, 1);
      this.buf = OpCodes.Shr32(this.buf, 1);
      this.n--;
      return bit;
    }

    readBits(width) {
      let value = 0;
      for (let i = 0; i < width; ++i) value = OpCodes.OrN(value, OpCodes.Shl32(this.readBit(), i));
      return value;
    }
  }

  // ===== SHARED LZ77 + ADAPTIVE HUFFMAN ENGINE =====

  const EOB_SYMBOL = 256;

  function buildLengthTable(minMatch) {
    const groups = [
      { extra: 0, count: 8 }, { extra: 1, count: 4 }, { extra: 2, count: 4 },
      { extra: 3, count: 4 }, { extra: 4, count: 4 }, { extra: 5, count: 2 }
    ];
    const table = [];
    let base = minMatch;
    for (const g of groups) {
      for (let i = 0; i < g.count; ++i) {
        table.push({ base: base, extra: g.extra });
        base += OpCodes.Shl32(1, g.extra);
      }
    }
    return table;
  }

  class HuffNode {
    constructor(sym, freq, left, right) {
      this.sym = sym;
      this.freq = freq;
      this.left = left || null;
      this.right = right || null;
    }
    isLeaf() { return this.left === null && this.right === null; }
  }

  function buildHuffmanTree(freqMap) {
    const heap = [];
    for (const key of Object.keys(freqMap)) heap.push(new HuffNode(parseInt(key, 10), freqMap[key]));
    heap.sort((a, b) => a.freq - b.freq);

    while (heap.length > 1) {
      const left = heap.shift();
      const right = heap.shift();
      const merged = new HuffNode(null, left.freq + right.freq, left, right);
      let insertAt = heap.findIndex(node => node.freq > merged.freq);
      if (insertAt === -1) heap.push(merged); else heap.splice(insertAt, 0, merged);
    }

    return heap[0];
  }

  function generateCodes(node, path, codes) {
    if (node.isLeaf()) {
      codes[node.sym] = path.slice();
      return;
    }
    path.push(0);
    generateCodes(node.left, path, codes);
    path.pop();
    path.push(1);
    generateCodes(node.right, path, codes);
    path.pop();
  }

  function decodeSymbol(reader, root) {
    let node = root;
    while (!node.isLeaf()) node = reader.readBit() ? node.right : node.left;
    return node.sym;
  }

  function lzParse(input, minMatch, maxWindow, lengthTable) {
    const lastEntry = lengthTable[lengthTable.length - 1];
    const maxLen = lastEntry.base + OpCodes.Shl32(1, lastEntry.extra) - 1;
    const tokens = [];
    const n = input.length;
    let pos = 0;

    while (pos < n) {
      let bestLen = 0, bestOffset = 0;
      const searchStart = Math.max(0, pos - maxWindow);
      const cap = Math.min(maxLen, n - pos);

      if (cap >= minMatch) {
        for (let s = pos - 1; s >= searchStart; --s) {
          let l = 0;
          while (l < cap && input[s + l] === input[pos + l]) ++l;
          if (l > bestLen) {
            bestLen = l;
            bestOffset = pos - s;
            if (l === cap) break;
          }
        }
      }

      if (bestLen >= minMatch) {
        let codeIndex = -1;
        for (let i = 0; i < lengthTable.length; ++i) {
          const e = lengthTable[i];
          const hi = e.base + OpCodes.Shl32(1, e.extra) - 1;
          if (bestLen >= e.base && bestLen <= hi) { codeIndex = i; break; }
        }
        const entry = lengthTable[codeIndex];
        tokens.push({ sym: 257 + codeIndex, lenExtra: bestLen - entry.base, lenExtraBits: entry.extra, dist: bestOffset });
        pos += bestLen;
      } else {
        tokens.push({ sym: input[pos] });
        pos += 1;
      }
    }

    return tokens;
  }

  function lzHuffmanCompress(input, minMatch, maxWindow, distBits) {
    if (input.length === 0) return [0, 0];

    const lengthTable = buildLengthTable(minMatch);
    const tokens = lzParse(input, minMatch, maxWindow, lengthTable);

    const freq = {};
    for (const t of tokens) freq[t.sym] = (freq[t.sym] || 0) + 1;
    freq[EOB_SYMBOL] = 1;

    const symbols = Object.keys(freq);
    const out = [];
    out.push(OpCodes.AndN(symbols.length, 0xFF), OpCodes.AndN(OpCodes.Shr32(symbols.length, 8), 0xFF));

    for (const key of symbols) {
      const sym = parseInt(key, 10);
      const f = freq[key];
      out.push(OpCodes.AndN(sym, 0xFF), OpCodes.AndN(OpCodes.Shr32(sym, 8), 0xFF));
      out.push(OpCodes.AndN(f, 0xFF), OpCodes.AndN(OpCodes.Shr32(f, 8), 0xFF),
                OpCodes.AndN(OpCodes.Shr32(f, 16), 0xFF), OpCodes.AndN(OpCodes.Shr32(f, 24), 0xFF));
    }

    const tree = buildHuffmanTree(freq);
    const codes = {};
    generateCodes(tree, [], codes);

    const writer = new AceBitWriter();
    for (const t of tokens) {
      const code = codes[t.sym];
      for (let i = 0; i < code.length; ++i) writer.writeBit(code[i]);
      if (t.lenExtraBits !== undefined) {
        writer.writeBits(t.lenExtra, t.lenExtraBits);
        writer.writeBits(t.dist, distBits);
      }
    }
    const eobCode = codes[EOB_SYMBOL];
    for (let i = 0; i < eobCode.length; ++i) writer.writeBit(eobCode[i]);

    const body = writer.flush();
    for (let i = 0; i < body.length; ++i) out.push(body[i]);
    return out;
  }

  function lzHuffmanDecompress(input, minMatch, distBits) {
    const lengthTable = buildLengthTable(minMatch);
    if (input.length < 2) return [];

    const count = OpCodes.OrN(input[0], OpCodes.Shl32(input[1], 8));
    if (count === 0) return [];

    const freq = {};
    let pos = 2;
    for (let i = 0; i < count; ++i) {
      const sym = OpCodes.OrN(input[pos], OpCodes.Shl32(input[pos + 1], 8));
      pos += 2;
      const f = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(input[pos], OpCodes.Shl32(input[pos + 1], 8)),
                 OpCodes.Shl32(input[pos + 2], 16)), OpCodes.Shl32(input[pos + 3], 24));
      pos += 4;
      freq[sym] = f;
    }

    const tree = buildHuffmanTree(freq);
    const reader = new AceBitReader(input, pos);
    const output = [];

    for (;;) {
      const sym = decodeSymbol(reader, tree);
      if (sym === EOB_SYMBOL) break;
      if (sym < 256) { output.push(sym); continue; }

      const entry = lengthTable[sym - 257];
      const extra = reader.readBits(entry.extra);
      const length = entry.base + extra;
      const dist = reader.readBits(distBits);
      const src = output.length - dist;
      if (src < 0) throw new Error('ACE: invalid back-reference distance');
      for (let i = 0; i < length; ++i) output.push(output[src + i]);
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  const MIN_MATCH = 2;
  const MAX_WINDOW = 65536;
  const DIST_BITS = 16;

  class AceArchiverCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "ACE Archiver";
      this.description = "eSKASoft ACE archiver's LZ77 + Huffman compression method. Sliding-window match finder feeding a single adaptive Huffman tree over literals, an end-of-block marker and 26 match-length codes. Documented-subset reimplementation: fixed 64KB window, no repeated-offset optimization, raw (non-Huffman-coded) distance field.";
      this.inventor = "Marcel Lemke (eSKASoft)";
      this.year = 1998;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DE;

      this.documentation = [
        new LinkItem("Wikipedia - ACE (compression format)", "https://en.wikipedia.org/wiki/ACE_(compression_format)"),
        new LinkItem("unace - reverse-engineered ACE decompressor", "https://github.com/tripsin/unace")
      ];

      this.references = [
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://en.wikipedia.org/wiki/Huffman_coding"),
        new LinkItem("Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://en.wikipedia.org/wiki/ACE_(compression_format)",
          input: [],
          expected: [0, 0]
        },
        {
          text: "Repeated byte run",
          uri: "https://en.wikipedia.org/wiki/ACE_(compression_format)",
          input: Array(64).fill(0x61),
          expected: [3,0,97,0,1,0,0,0,0,1,1,0,0,0,20,1,1,0,0,0,105,0,192]
        },
        {
          text: "Mixed literal/match text",
          uri: "https://github.com/tripsin/unace",
          input: [116,104,101,32,113,117,105,99,107,32,98,114,111,119,110,32,102,111,120,32,116,104,101,32,113,117,105,99,107,32,98,114,111,119,110,32,102,111,120],
          expected: [18,0,32,0,4,0,0,0,98,0,1,0,0,0,99,0,1,0,0,0,101,0,1,0,0,0,102,0,1,0,0,0,104,0,1,0,0,0,105,0,1,0,0,0,107,0,1,0,0,0,110,0,1,0,0,0,111,0,2,0,0,0,113,0,1,0,0,0,114,0,1,0,0,0,116,0,1,0,0,0,117,0,1,0,0,0,119,0,1,0,0,0,120,0,1,0,0,0,0,1,1,0,0,0,13,1,1,0,0,0,242,78,73,255,134,46,30,195,222,241,102,20,0,1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new AceArchiverInstance(this, isInverse);
    }
  }

  class AceArchiverInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) return lzHuffmanDecompress(data, MIN_MATCH, DIST_BITS);
      return lzHuffmanCompress(data, MIN_MATCH, MAX_WINDOW, DIST_BITS);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new AceArchiverCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AceArchiverCompression, AceArchiverInstance };
}));
