/*
 * LZH (-lh5- style) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZH is the classic LHA/LHarc "-lh5-" method: an LZSS sliding-window
 * matcher (8 KiB window, minimum match length 3) whose output symbol
 * stream is entropy-coded with two Huffman trees built from the actual
 * symbol statistics of the file:
 *   - a combined literal/length tree (symbols 0-255 are literal bytes,
 *     symbols 256-509 are match-length codes for lengths 3-256), whose
 *     509 code lengths are themselves transmitted compactly using a
 *     small run-length-coded "code length alphabet" (direct lengths plus
 *     "repeat previous" / "repeat zero" codes), conceptually the same
 *     trick RFC 1951 DEFLATE uses for its dynamic Huffman tables;
 *   - a small position (offset) tree of 14 symbols, one per "slot" of
 *     the 13-bit sliding-window offset, each slot carrying a number of
 *     raw extra bits (the classic "slot + extra bits" scheme).
 *
 * Documentation and background:
 *   - Haruhiko Okumura, "LZHUF" (1989) - the adaptive LZSS + Huffman
 *     encoder that established the lh-family design (dictionary match
 *     finder feeding a Huffman-coded length/literal alphabet plus a
 *     separate position alphabet).
 *   - https://en.wikipedia.org/wiki/LHA_(file_format) - overview of the
 *     -lh5- method: 8 KiB window, minimum match length 3, dynamic
 *     Huffman coding of the literal/length and position alphabets.
 *   - https://en.wikipedia.org/wiki/LZ77_and_LZ78 - background on the
 *     LZSS sliding-window matching this method is built on.
 *
 * This implementation is written from the conceptual description of the
 * method (not transliterated from any decompressor source). Compressed
 * output is a self-contained bitstream produced by this implementation;
 * it is not byte-for-byte compatible with real .lzh archive files.
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

  // ===== LH5-STYLE CONSTANTS =====

  const WINDOW_SIZE = 8192;      // 8 KiB sliding window (-lh5-)
  const MIN_MATCH = 3;           // Minimum LZSS match length
  const MAX_MATCH = 256;         // Maximum LZSS match length
  const NUM_LITERALS = 256;      // Literal byte symbols 0-255
  const NUM_LENGTH_CODES = MAX_MATCH - MIN_MATCH + 1; // 254 length symbols
  const NUM_MAIN_SYMBOLS = NUM_LITERALS + NUM_LENGTH_CODES; // 510
  const NUM_POSITION_SYMBOLS = 14; // Slots covering offsets 1..8192

  const MAIN_CODE_LENGTH_LIMIT = 15; // Direct code-length values fit 0-15 (4 bits)
  const POSITION_CODE_LENGTH_LIMIT = 15;

  // Code-length alphabet for RLE-coding the main tree's 510 code lengths
  // (same conceptual layout as RFC 1951's code-length alphabet).
  const CL_REPEAT_PREV = 16;  // + 2 extra bits, repeat previous length 3-6 times
  const CL_REPEAT_ZERO_SHORT = 17; // + 3 extra bits, repeat zero 3-10 times
  const CL_REPEAT_ZERO_LONG = 18;  // + 7 extra bits, repeat zero 11-138 times
  const NUM_CL_SYMBOLS = 19;

  // Position slot table: slot 0 covers offset 1, slot i (i>=1) covers the
  // range [2^(i-1)+1, 2^i] using (i-1) extra raw bits. With 14 slots
  // (0..13) this exactly spans offsets 1..8192 (the 8 KiB window).
  const POSITION_SLOTS = (() => {
    const slots = [{base: 1, extra: 0}];
    for (let i = 1; i < NUM_POSITION_SYMBOLS; ++i) {
      const base = OpCodes.ToUint32(OpCodes.Shl32(1, i - 1)) + 1;
      slots.push({base: base, extra: i - 1});
    }
    return slots;
  })();

  // ===== BIT STREAM HELPERS =====

  class BitStream {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    writeBits(value, numBits) {
      let remaining = numBits;
      let v = OpCodes.ToUint32(value);
      while (remaining > 0) {
        const take = Math.min(remaining, 8 - this.bitCount);
        const chunkMask = OpCodes.ToUint32(OpCodes.Shl32(1, take) - 1);
        const chunk = OpCodes.AndN(v, chunkMask);
        this.bitBuffer = OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(chunk, this.bitCount));
        this.bitCount += take;
        v = OpCodes.Shr32(v, take);
        remaining -= take;

        if (this.bitCount === 8) {
          this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
          this.bitBuffer = 0;
          this.bitCount = 0;
        }
      }
    }

    // Writes a Huffman code MSB-first (bit `length-1` of `code` goes out first).
    writeHuffmanCode(code, length) {
      for (let i = length - 1; i >= 0; --i) {
        const bit = OpCodes.AndN(OpCodes.Shr32(code, i), 1);
        this.writeBits(bit, 1);
      }
    }

    flush() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.bytePos = 0;
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    readBits(numBits) {
      let result = 0;
      let gotBits = 0;
      while (gotBits < numBits) {
        if (this.bitCount === 0) {
          if (this.bytePos >= this.bytes.length) {
            throw new Error('Unexpected end of compressed data');
          }
          this.bitBuffer = this.bytes[this.bytePos++];
          this.bitCount = 8;
        }
        const take = Math.min(numBits - gotBits, this.bitCount);
        const chunkMask = OpCodes.ToUint32(OpCodes.Shl32(1, take) - 1);
        const chunk = OpCodes.AndN(this.bitBuffer, chunkMask);
        result = OpCodes.ToUint32(OpCodes.OrN(result, OpCodes.Shl32(chunk, gotBits)));
        this.bitBuffer = OpCodes.Shr32(this.bitBuffer, take);
        this.bitCount -= take;
        gotBits += take;
      }
      return result;
    }

    // Reads a single bit of a MSB-first Huffman code.
    readBit() {
      return this.readBits(1);
    }
  }

  // ===== HUFFMAN CODE-LENGTH CONSTRUCTION =====

  // Builds a set of valid prefix code lengths (bounded by maxLen) from a
  // frequency table using a classic bottom-up Huffman merge. Falls back to
  // a flat equal-length code (always well within maxLen for our alphabet
  // sizes) on the extremely rare occasions that unrestricted Huffman would
  // exceed the bit-width used to transmit lengths.
  function buildLengths(freqs, maxLen) {
    const n = freqs.length;
    const used = [];
    for (let i = 0; i < n; ++i) {
      if (freqs[i] > 0) used.push(i);
    }

    const lengths = new Array(n).fill(0);
    if (used.length === 0) return lengths;
    if (used.length === 1) {
      lengths[used[0]] = 1;
      return lengths;
    }

    let nodes = used.map(sym => ({freq: freqs[sym], symbol: sym}));
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.freq - b.freq);
      const a = nodes.shift();
      const b = nodes.shift();
      nodes.push({freq: a.freq + b.freq, left: a, right: b});
    }

    const root = nodes[0];
    const stack = [{node: root, depth: 0}];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.node.symbol !== undefined) {
        lengths[item.node.symbol] = Math.max(item.depth, 1);
      } else {
        stack.push({node: item.node.left, depth: item.depth + 1});
        stack.push({node: item.node.right, depth: item.depth + 1});
      }
    }

    let maxComputed = 0;
    for (const len of lengths) {
      if (len > maxComputed) maxComputed = len;
    }

    if (maxComputed > maxLen) {
      // Flat fallback: every used symbol gets the same length, which
      // trivially satisfies the Kraft inequality (k <= 2^L).
      const k = used.length;
      const flatLen = Math.max(1, Math.ceil(Math.log2(k)));
      lengths.fill(0);
      for (const sym of used) lengths[sym] = flatLen;
    }

    return lengths;
  }

  // ===== HUFFMAN TREE (canonical codes, per-symbol lookup + decode trie) =====

  class HuffmanTree {
    constructor() {
      this.root = null;
      this.codes = null;
    }

    static buildFromLengths(lengths) {
      const tree = new HuffmanTree();

      let maxLen = 0;
      for (const len of lengths) {
        if (len > maxLen) maxLen = len;
      }
      if (maxLen === 0) return tree;

      const blCount = new Array(maxLen + 1).fill(0);
      for (const len of lengths) {
        if (len > 0) blCount[len]++;
      }

      const nextCode = new Array(maxLen + 1).fill(0);
      let code = 0;
      blCount[0] = 0;
      for (let bits = 1; bits <= maxLen; ++bits) {
        code = OpCodes.ToUint32(OpCodes.Shl32(code + blCount[bits - 1], 1));
        nextCode[bits] = code;
      }

      const codes = new Array(lengths.length).fill(null);
      for (let symbol = 0; symbol < lengths.length; ++symbol) {
        const len = lengths[symbol];
        if (len === 0) continue;
        codes[symbol] = {code: nextCode[len], length: len};
        nextCode[len]++;
      }

      tree.root = {};
      for (let symbol = 0; symbol < codes.length; ++symbol) {
        const entry = codes[symbol];
        if (!entry) continue;

        let node = tree.root;
        for (let i = entry.length - 1; i >= 0; --i) {
          const bit = OpCodes.AndN(OpCodes.Shr32(entry.code, i), 1);
          const key = bit ? 'one' : 'zero';
          if (i === 0) {
            node[key] = {symbol: symbol};
          } else {
            if (!node[key]) node[key] = {};
            node = node[key];
          }
        }
      }

      tree.codes = codes;
      return tree;
    }

    encode(symbol) {
      const entry = this.codes && this.codes[symbol];
      if (!entry) throw new Error(`No Huffman code for symbol ${symbol}`);
      return entry;
    }

    decode(reader) {
      let node = this.root;
      if (!node) throw new Error('Invalid or empty Huffman tree');

      while (node.symbol === undefined) {
        const bit = reader.readBit();
        node = bit ? node.one : node.zero;
        if (!node) throw new Error('Invalid Huffman code in stream');
      }
      return node.symbol;
    }
  }

  // ===== POSITION SLOT LOOKUP =====

  function offsetToSlot(offset) {
    // Highest slot whose base is <= offset.
    let slot = 0;
    for (let i = POSITION_SLOTS.length - 1; i >= 0; --i) {
      if (offset >= POSITION_SLOTS[i].base) {
        slot = i;
        break;
      }
    }
    return slot;
  }

  // ===== CODE-LENGTH TABLE (RLE) ENCODING / DECODING =====

  // Converts an array of code lengths into a sequence of {symbol, extra,
  // extraBits} events using the DEFLATE-style code-length alphabet
  // (16 = repeat previous, 17/18 = repeat zero short/long).
  function rleEncodeLengths(lengths) {
    const events = [];
    let i = 0;
    const n = lengths.length;
    while (i < n) {
      const value = lengths[i];
      let runLength = 1;
      while (i + runLength < n && lengths[i + runLength] === value) runLength++;

      if (value === 0) {
        let remaining = runLength;
        while (remaining > 0) {
          if (remaining >= 11) {
            const take = Math.min(remaining, 138);
            events.push({symbol: CL_REPEAT_ZERO_LONG, extra: take - 11, extraBits: 7});
            remaining -= take;
          } else if (remaining >= 3) {
            const take = Math.min(remaining, 10);
            events.push({symbol: CL_REPEAT_ZERO_SHORT, extra: take - 3, extraBits: 3});
            remaining -= take;
          } else {
            events.push({symbol: 0, extra: 0, extraBits: 0});
            remaining -= 1;
          }
        }
      } else {
        events.push({symbol: value, extra: 0, extraBits: 0});
        let remaining = runLength - 1;
        while (remaining > 0) {
          const take = Math.min(remaining, 6);
          if (take >= 3) {
            events.push({symbol: CL_REPEAT_PREV, extra: take - 3, extraBits: 2});
            remaining -= take;
          } else {
            events.push({symbol: value, extra: 0, extraBits: 0});
            remaining -= 1;
          }
        }
      }
      i += runLength;
    }
    return events;
  }

  // ===== LZH ALGORITHM =====

  class LZHAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZH";
      this.description = "Classic LHA/LHarc \"-lh5-\" method: LZSS sliding-window matching (8 KiB window, minimum match 3) followed by Huffman coding of a combined literal/length alphabet and a separate position alphabet.";
      this.inventor = "Haruhiko Okumura";
      this.year = 1989;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.documentation = [
        new LinkItem("LHA file format (Wikipedia)", "https://en.wikipedia.org/wiki/LHA_(file_format)"),
        new LinkItem("LZ77 and LZ78 background (Wikipedia)", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("RFC 1951 - DEFLATE Specification (comparable code-length RLE trick)", "https://www.rfc-editor.org/rfc/rfc1951")
      ];

      this.references = [
        new LinkItem("LHA for UNIX project", "https://github.com/jca02266/lha"),
        new LinkItem("7-Zip LZH references", "https://www.7-zip.org/")
      ];

      // Round-trip test vectors (compression may legitimately produce
      // different valid outputs across implementations, so tests check
      // round-trip correctness rather than a fixed compressed byte string).
      this.tests = [
        new TestCase(
          [],
          [],
          "LZH round-trip - empty input",
          "https://en.wikipedia.org/wiki/LHA_(file_format)"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          [],
          "LZH round-trip - single byte",
          "https://en.wikipedia.org/wiki/LHA_(file_format)"
        ),
        new TestCase(
          (() => { const a = []; for (let i = 0; i < 600; ++i) a.push(0x61); return a; })(),
          [],
          "LZH round-trip - long repetitive run (600 x 'a')",
          "https://en.wikipedia.org/wiki/LHA_(file_format)"
        ),
        new TestCase(
          (() => { const a = []; for (let i = 0; i < 300; ++i) a.push(i % 2 === 0 ? 0x58 : 0x59); return a; })(),
          [],
          "LZH round-trip - alternating byte pattern (XYXY...)",
          "https://en.wikipedia.org/wiki/LHA_(file_format)"
        ),
        new TestCase(
          (() => {
            let s = 0x2A7F;
            const a = [];
            for (let i = 0; i < 400; ++i) {
              s = OpCodes.ToUint32((s * 1103515245 + 12345)) % 2147483648;
              a.push(s % 256);
            }
            return a;
          })(),
          [],
          "LZH round-trip - pseudo-random binary sample",
          "https://en.wikipedia.org/wiki/LHA_(file_format)"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Haruhiko Okumura's LZHUF combines LZSS matching with adaptive Huffman coding of the literal, length and position alphabets. "),
          [],
          "LZH round-trip - LZHUF-flavoured description text",
          "https://en.wikipedia.org/wiki/LHA_(file_format)"
        )
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
      this.inputBuffer.push(...data);
    }

    Result() {
      if (this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== LZSS MATCHING =====

    _findTokens(data) {
      const tokens = [];
      const hashTable = new Map();
      const n = data.length;
      let pos = 0;

      const hashAt = (p) => {
        // Simple rolling-free 3-byte hash, good enough for match candidacy.
        const h = OpCodes.ToUint32(
          OpCodes.XorN(
            OpCodes.XorN(OpCodes.Shl32(data[p], 9), OpCodes.Shl32(data[p + 1], 4)),
            data[p + 2]
          )
        );
        return h % 65536;
      };

      while (pos < n) {
        let bestLen = 0;
        let bestDist = 0;

        if (pos + MIN_MATCH <= n) {
          const h = hashAt(pos);
          const candidates = hashTable.get(h);
          if (candidates) {
            for (let ci = candidates.length - 1; ci >= 0; --ci) {
              const cpos = candidates[ci];
              const dist = pos - cpos;
              if (dist > WINDOW_SIZE) break;

              const maxLen = Math.min(MAX_MATCH, n - pos);
              let len = 0;
              while (len < maxLen && data[cpos + len] === data[pos + len]) ++len;

              if (len > bestLen) {
                bestLen = len;
                bestDist = dist;
                if (len >= MAX_MATCH) break;
              }
            }
          }

          if (!hashTable.has(h)) hashTable.set(h, []);
          const list = hashTable.get(h);
          list.push(pos);
          if (list.length > 64) list.shift(); // bound chain length for performance
        }

        if (bestLen >= MIN_MATCH) {
          tokens.push({isMatch: true, length: bestLen, distance: bestDist});

          // Insert hash entries for the skipped positions so later matches
          // can still reference into the interior of this match.
          for (let k = 1; k < bestLen && pos + k + MIN_MATCH <= n; ++k) {
            const hk = hashAt(pos + k);
            if (!hashTable.has(hk)) hashTable.set(hk, []);
            const lk = hashTable.get(hk);
            lk.push(pos + k);
            if (lk.length > 64) lk.shift();
          }

          pos += bestLen;
        } else {
          tokens.push({isMatch: false, value: data[pos]});
          ++pos;
        }
      }

      return tokens;
    }

    // ===== COMPRESSION =====

    _compress(data) {
      const tokens = this._findTokens(data);

      // Gather frequency statistics for both alphabets.
      const mainFreqs = new Array(NUM_MAIN_SYMBOLS).fill(0);
      const posFreqs = new Array(NUM_POSITION_SYMBOLS).fill(0);

      for (const t of tokens) {
        if (t.isMatch) {
          mainFreqs[NUM_LITERALS + (t.length - MIN_MATCH)]++;
          posFreqs[offsetToSlot(t.distance)]++;
        } else {
          mainFreqs[t.value]++;
        }
      }

      const mainLengths = buildLengths(mainFreqs, MAIN_CODE_LENGTH_LIMIT);
      const posLengths = buildLengths(posFreqs, POSITION_CODE_LENGTH_LIMIT);

      const mainTree = HuffmanTree.buildFromLengths(mainLengths);
      const posTree = HuffmanTree.buildFromLengths(posLengths);

      const stream = new BitStream();

      // Header: number of tokens (32 bits).
      stream.writeBits(tokens.length, 32);

      // ---- Transmit the main tree's 510 code lengths via RLE + cl-tree ----
      const clEvents = rleEncodeLengths(mainLengths);
      const clFreqs = new Array(NUM_CL_SYMBOLS).fill(0);
      for (const ev of clEvents) clFreqs[ev.symbol]++;

      const clLengths = buildLengths(clFreqs, 7); // cl-tree codes fit in 3 bits (0-7)
      const clTree = HuffmanTree.buildFromLengths(clLengths);

      // cl-tree's own 19 lengths, sent directly as fixed 3-bit values.
      for (let i = 0; i < NUM_CL_SYMBOLS; ++i) {
        stream.writeBits(clLengths[i], 3);
      }

      // Number of RLE events, then the events themselves via the cl-tree.
      stream.writeBits(clEvents.length, 16);
      for (const ev of clEvents) {
        const {code, length} = clTree.encode(ev.symbol);
        stream.writeHuffmanCode(code, length);
        if (ev.extraBits > 0) stream.writeBits(ev.extra, ev.extraBits);
      }

      // ---- Transmit the position tree's 14 code lengths directly ----
      for (let i = 0; i < NUM_POSITION_SYMBOLS; ++i) {
        stream.writeBits(posLengths[i], 4);
      }

      // ---- Encode the token stream ----
      for (const t of tokens) {
        if (t.isMatch) {
          const symbol = NUM_LITERALS + (t.length - MIN_MATCH);
          const {code, length} = mainTree.encode(symbol);
          stream.writeHuffmanCode(code, length);

          const slot = offsetToSlot(t.distance);
          const slotInfo = POSITION_SLOTS[slot];
          const {code: pCode, length: pLen} = posTree.encode(slot);
          stream.writeHuffmanCode(pCode, pLen);
          if (slotInfo.extra > 0) {
            stream.writeBits(t.distance - slotInfo.base, slotInfo.extra);
          }
        } else {
          const {code, length} = mainTree.encode(t.value);
          stream.writeHuffmanCode(code, length);
        }
      }

      return stream.flush();
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      const reader = new BitReader(data);
      const output = [];

      const tokenCount = reader.readBits(32);

      // ---- Read cl-tree lengths, build cl-tree ----
      const clLengths = new Array(NUM_CL_SYMBOLS);
      for (let i = 0; i < NUM_CL_SYMBOLS; ++i) {
        clLengths[i] = reader.readBits(3);
      }
      const clTree = HuffmanTree.buildFromLengths(clLengths);

      // ---- Read RLE events, reconstruct the 510 main code lengths ----
      const eventCount = reader.readBits(16);
      const mainLengths = new Array(NUM_MAIN_SYMBOLS).fill(0);
      let outIdx = 0;
      let lastValue = 0;

      for (let e = 0; e < eventCount && outIdx < NUM_MAIN_SYMBOLS; ++e) {
        const symbol = clTree.decode(reader);
        if (symbol <= 15) {
          mainLengths[outIdx++] = symbol;
          lastValue = symbol;
        } else if (symbol === CL_REPEAT_PREV) {
          const repeat = reader.readBits(2) + 3;
          for (let r = 0; r < repeat && outIdx < NUM_MAIN_SYMBOLS; ++r) mainLengths[outIdx++] = lastValue;
        } else if (symbol === CL_REPEAT_ZERO_SHORT) {
          const repeat = reader.readBits(3) + 3;
          for (let r = 0; r < repeat && outIdx < NUM_MAIN_SYMBOLS; ++r) mainLengths[outIdx++] = 0;
        } else if (symbol === CL_REPEAT_ZERO_LONG) {
          const repeat = reader.readBits(7) + 11;
          for (let r = 0; r < repeat && outIdx < NUM_MAIN_SYMBOLS; ++r) mainLengths[outIdx++] = 0;
        }
      }

      const mainTree = HuffmanTree.buildFromLengths(mainLengths);

      // ---- Read position tree lengths, build position tree ----
      const posLengths = new Array(NUM_POSITION_SYMBOLS);
      for (let i = 0; i < NUM_POSITION_SYMBOLS; ++i) {
        posLengths[i] = reader.readBits(4);
      }
      const posTree = HuffmanTree.buildFromLengths(posLengths);

      // ---- Decode the token stream ----
      for (let t = 0; t < tokenCount; ++t) {
        const symbol = mainTree.decode(reader);
        if (symbol < NUM_LITERALS) {
          output.push(symbol);
        } else {
          const length = (symbol - NUM_LITERALS) + MIN_MATCH;
          const slot = posTree.decode(reader);
          const slotInfo = POSITION_SLOTS[slot];
          const extra = slotInfo.extra > 0 ? reader.readBits(slotInfo.extra) : 0;
          const distance = slotInfo.base + extra;

          const start = output.length - distance;
          for (let i = 0; i < length; ++i) {
            output.push(output[start + i]);
          }
        }
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZHAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZHAlgorithm, LZHInstance };
}));
