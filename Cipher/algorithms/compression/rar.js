/*
 * RAR-style LZ77+Huffman (documented subset) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RAR (Eugene Roshal) is a proprietary archiver; its exact bitstream has
 * never been openly specified and the reference unrar source carries a
 * license explicitly forbidding reuse in a competing archiver, so it is not
 * a usable clean-room reference here. What is reliably, publicly documented
 * (e.g. Wikipedia's RAR article) is coarse: RAR 2.0 supported dictionaries
 * up to 1MB, RAR 3.x up to 4MB, and the classic (pre-RAR5) "block coder" mode
 * combines LZSS-style matching with Huffman entropy coding - separate from
 * RAR3's optional PPMII mode, which this file does not implement.
 *
 * This file does NOT read or produce archives in the real RAR format. It is
 * one instance of the generic LZ77 + single-Huffman-tree engine this
 * repository shares across ace-archiver.js, arj.js, rar.js and sqx.js, built
 * only from those coarse public facts: an LZ77 parser feeding a single
 * Huffman tree over a 257+26-symbol alphabet (256 literals, one end-of-block
 * symbol, 26 match-length codes with a base/extra-bit growth pattern), a
 * fixed 1MB (20-bit) match window matching the documented RAR 2.0 dictionary
 * size, and a minimum match length of 2 bytes. Match distances are
 * transmitted as raw fixed-width fields rather than RAR's multiple internal
 * Huffman tables (main/distance/align/low-distance trees) or its
 * repeat-distance slots - those internals are not part of any source
 * consulted here. The Huffman table is transmitted as an explicit (symbol,
 * frequency) list so the decoder can rebuild an identical tree. This is not
 * a byte-exact or wire-compatible clone of any real RAR archive. The real
 * RAR format - with its four version-specific coders (RAR1/2/3/5), real
 * Huffman main/distance/align/low-distance trees and filters - is
 * implemented in the sibling CompressionWorkbench (C#) project.
 *
 * References:
 * - Wikipedia, "RAR (file format)"
 *   https://en.wikipedia.org/wiki/RAR_(file_format)
 * - Storer and Szymanski, "Data compression via textual substitution", 1982
 * - Huffman, "A Method for the Construction of Minimum-Redundancy Codes", 1952
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

  class RarBitWriter {
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

  class RarBitReader {
    constructor(bytes, pos) {
      this.bytes = bytes;
      this.pos = pos;
      this.buf = 0;
      this.n = 0;
    }

    readBit() {
      if (this.n === 0) {
        if (this.pos >= this.bytes.length) throw new Error('RAR: unexpected end of stream');
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

    const writer = new RarBitWriter();
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
    const reader = new RarBitReader(input, pos);
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
      if (src < 0) throw new Error('RAR: invalid back-reference distance');
      for (let i = 0; i < length; ++i) output.push(output[src + i]);
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  const MIN_MATCH = 2;
  const MAX_WINDOW = 1048575; // 2^20 - 1, fits exactly in the 20-bit distance field
  const DIST_BITS = 20;

  class RarCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "RAR-style LZ77+Huffman (documented subset)";
      this.description = "Shared generic LZ77 + single-Huffman-tree compression engine (also used by the ACE-style, ARJ-style and SQX-style entries in this repository), parameterized here with a fixed 1MB window and raw fixed-width distance fields to approximate the coarse, publicly documented facts about the classic (pre-RAR5) RAR block coder (LZSS-style matching with Huffman entropy coding; excludes RAR3's optional PPMII mode). It does NOT read or produce archives in the real RAR format - RAR's internal multi-tree/repeat-distance structure is proprietary and not reproduced. The real RAR format is implemented in the sibling CompressionWorkbench (C#) project.";
      this.inventor = "Eugene Roshal";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.documentation = [
        new LinkItem("Wikipedia - RAR (file format)", "https://en.wikipedia.org/wiki/RAR_(file_format)")
      ];

      this.references = [
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346"),
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://en.wikipedia.org/wiki/Huffman_coding")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: [],
          expected: [0, 0]
        },
        {
          text: "Repeated byte run",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: Array(64).fill(0x61),
          expected: [3,0,97,0,1,0,0,0,0,1,1,0,0,0,20,1,1,0,0,0,105,0,0,12]
        },
        {
          text: "Mixed literal/match text",
          uri: "https://en.wikipedia.org/wiki/RAR_(file_format)",
          input: [116,104,101,32,113,117,105,99,107,32,98,114,111,119,110,32,102,111,120,32,116,104,101,32,113,117,105,99,107,32,98,114,111,119,110,32,102,111,120],
          expected: [18,0,32,0,4,0,0,0,98,0,1,0,0,0,99,0,1,0,0,0,101,0,1,0,0,0,102,0,1,0,0,0,104,0,1,0,0,0,105,0,1,0,0,0,107,0,1,0,0,0,110,0,1,0,0,0,111,0,2,0,0,0,113,0,1,0,0,0,114,0,1,0,0,0,116,0,1,0,0,0,117,0,1,0,0,0,119,0,1,0,0,0,120,0,1,0,0,0,0,1,1,0,0,0,13,1,1,0,0,0,242,78,73,255,134,46,30,195,222,241,102,20,0,16]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RarInstance(this, isInverse);
    }
  }

  class RarInstance extends IAlgorithmInstance {
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
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) return lzHuffmanDecompress(data, MIN_MATCH, DIST_BITS);
      return lzHuffmanCompress(data, MIN_MATCH, MAX_WINDOW, DIST_BITS);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RarCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RarCompression, RarInstance };
}));
