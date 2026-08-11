/*
 * Implode (PKWARE DCL / ZIP Method 6) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PKWARE's "Imploding" method combines an LZ77-style sliding dictionary
 * match finder (8K window, minimum match length 3, distance split into a
 * raw low part and a Huffman-coded high part) with three canonical Huffman
 * trees - literal, match length, and distance high bits - built from a
 * classic frequency-merge (every symbol, including unused ones, gets a
 * length so all 256/64/64 alphabet slots are always codeable). Each tree is
 * transmitted as a run-length list of code lengths (one byte per run: low
 * nibble = length-1, high nibble = run-count-1) directly inside the same
 * LSB-first bit stream as the token data - there is no separate byte-aligned
 * header section for the trees. Canonical codes are bit-reversed before
 * being packed, so that reading the LSB-first stream front-to-back yields
 * the same prefix-free traversal as the MSB-first canonical assignment.
 * A literal/match flag bit precedes every token; for a match, the raw
 * distance low bits come first, then the Huffman-coded distance high
 * symbol, then the Huffman-coded length symbol (with an 8-bit raw extension
 * when the length code saturates at 63).
 *
 * Reference:
 *   PKWARE, Inc., ".ZIP File Format Specification" (APPNOTE.TXT), section
 *   describing compression method 6 "Imploding", and general purpose bit
 *   flag bits 1-2 for that method.
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

  const USE_LITERAL_TREE = true;
  const USE_8K_DICTIONARY = true;
  const LITERAL_SYMBOLS = 256;
  const LENGTH_SYMBOLS = 64;
  const DISTANCE_SYMBOLS = 64;

  // ----- Bit-level stream helpers (LSB-first) -----

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.bitPos = 0;
    }

    writeBits(value, count) {
      for (let i = 0; i < count; ++i) {
        const bit = OpCodes.AndN(OpCodes.Shr32(value, i), 1);
        if (bit === 1) this.cur = OpCodes.OrN(this.cur, OpCodes.Shl32(1, this.bitPos));
        ++this.bitPos;
        if (this.bitPos === 8) {
          this.bytes.push(this.cur);
          this.cur = 0;
          this.bitPos = 0;
        }
      }
    }

    finish() {
      if (this.bitPos > 0) {
        this.bytes.push(this.cur);
        this.cur = 0;
        this.bitPos = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
    }

    readBit() {
      const byteIdx = Math.floor(this.pos / 8);
      if (byteIdx >= this.bytes.length) { ++this.pos; return 0; }
      const bitIdx = this.pos % 8;
      ++this.pos;
      return OpCodes.AndN(OpCodes.Shr32(this.bytes[byteIdx], bitIdx), 1);
    }

    readBits(count) {
      let result = 0;
      for (let i = 0; i < count; ++i) result = OpCodes.OrN(result, OpCodes.Shl32(this.readBit(), i));
      return result;
    }
  }

  // ----- Priority queue for Huffman merging -----
  // A binary min-heap ordered by ascending frequency and, for equal
  // frequencies, by ascending node number. Node numbers are unique, so no two
  // entries ever compare equal: the merge order - and with it the shape of the
  // tree and the code lengths - follows from the frequencies alone, whatever
  // internal shape the heap happens to take.

  class HuffmanQueue {
    constructor() { this.nodes = []; }
    get count() { return this.nodes.length; }

    static _before(a, b) { return a.freq !== b.freq ? a.freq < b.freq : a.node < b.node; }

    enqueue(node, freq) {
      const items = this.nodes;
      const entry = { node: node, freq: freq };
      let i = items.length;
      items.push(entry);
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (!HuffmanQueue._before(entry, items[parent])) break;
        items[i] = items[parent];
        i = parent;
      }
      items[i] = entry;
    }

    dequeue() {
      const items = this.nodes;
      const root = items[0];
      const last = items.pop();
      const size = items.length;
      if (size > 0) {
        let i = 0;
        for (;;) {
          const left = 2 * i + 1;
          if (left >= size) break;
          const right = left + 1;
          const child = right < size && HuffmanQueue._before(items[right], items[left]) ? right : left;
          if (!HuffmanQueue._before(items[child], last)) break;
          items[i] = items[child];
          i = child;
        }
        items[i] = last;
      }
      return root;
    }
  }

  // ----- Canonical Huffman code-length / code construction -----

  function buildCodeLengths(freq, numSymbols) {
    if (numSymbols === 1) return [1];

    const nodes = [];
    const pq = new HuffmanQueue();
    for (let i = 0; i < numSymbols; ++i) {
      const f = Math.max(freq[i], 1);
      nodes.push({ freq: f, sym: i, left: -1, right: -1 });
      pq.enqueue(i, f);
    }

    while (pq.count > 1) {
      const a = pq.dequeue();
      const b = pq.dequeue();
      const combined = a.freq + b.freq;
      const newIdx = nodes.length;
      nodes.push({ freq: combined, sym: -1, left: a.node, right: b.node });
      pq.enqueue(newIdx, combined);
    }

    const root = pq.dequeue().node;
    const lengths = new Array(numSymbols).fill(0);

    const walk = (idx, depth) => {
      const node = nodes[idx];
      if (node.sym >= 0) { lengths[node.sym] = Math.max(depth, 1); return; }
      walk(node.left, depth + 1);
      walk(node.right, depth + 1);
    };
    walk(root, 0);

    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) if (lengths[i] > maxLen) maxLen = lengths[i];
    if (maxLen > 16) {
      let bits = 1;
      while (OpCodes.Shl32(1, bits) < numSymbols) ++bits;
      for (let i = 0; i < numSymbols; ++i) lengths[i] = bits;
    }

    return lengths;
  }

  function reverseBits(value, count) {
    let result = 0;
    for (let i = 0; i < count; ++i) {
      result = OpCodes.OrN(OpCodes.Shl32(result, 1), OpCodes.AndN(value, 1));
      value = OpCodes.Shr32(value, 1);
    }
    return result;
  }

  // Canonical assignment (MSB-first code order), then each code is
  // bit-reversed so it reads correctly from the LSB-first stream.
  function buildCodes(codeLengths, numSymbols) {
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) if (codeLengths[i] > maxLen) maxLen = codeLengths[i];
    if (maxLen === 0) maxLen = 1;

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i) if (codeLengths[i] > 0) ++blCount[codeLengths[i]];

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      code = OpCodes.Shl32(code + blCount[b - 1], 1);
      nextCode[b] = code;
    }

    const codes = new Array(numSymbols);
    for (let sym = 0; sym < numSymbols; ++sym) {
      const len = codeLengths[sym];
      if (len === 0) { codes[sym] = { code: 0, bits: 0 }; continue; }
      const raw = nextCode[len]++;
      codes[sym] = { code: reverseBits(raw, len), bits: len };
    }
    return codes;
  }

  class DecodeTrie {
    constructor(codes, numSymbols) {
      this.root = { sym: -1, c0: null, c1: null };
      for (let s = 0; s < numSymbols; ++s) {
        const entry = codes[s];
        if (!entry || entry.bits === 0) continue;
        let node = this.root;
        // Codes were bit-reversed for LSB-first transmission, so walking the
        // trie bit-by-bit as each bit is *read* means consuming the reversed
        // code's bits from bit 0 upward - i.e. in the same order they were written.
        for (let i = 0; i < entry.bits; ++i) {
          const bit = OpCodes.AndN(OpCodes.Shr32(entry.code, i), 1);
          if (bit === 0) {
            if (!node.c0) node.c0 = { sym: -1, c0: null, c1: null };
            node = node.c0;
          } else {
            if (!node.c1) node.c1 = { sym: -1, c0: null, c1: null };
            node = node.c1;
          }
        }
        node.sym = s;
      }
    }

    decode(reader) {
      let node = this.root;
      while (node.sym === -1) node = reader.readBit() === 0 ? node.c0 : node.c1;
      return node.sym;
    }
  }

  // ----- Code-length table (run-length) serialization, inline in the bitstream -----

  function writeSfTree(writer, lengths, numSymbols) {
    const runs = [];
    let i = 0;
    while (i < numSymbols) {
      const len = lengths[i];
      let count = 1;
      while (i + count < numSymbols && lengths[i + count] === len && count < 16) ++count;
      runs.push([len > 0 ? len - 1 : 0, count]);
      i += count;
    }
    writer.writeBits(runs.length - 1, 8);
    for (const [adjLen, count] of runs) writer.writeBits(OpCodes.OrN(adjLen, OpCodes.Shl32(count - 1, 4)), 8);
  }

  function readSfTree(reader, numSymbols) {
    const numEntries = reader.readBits(8) + 1;
    const lengths = new Array(numSymbols).fill(0);
    let idx = 0;
    for (let i = 0; i < numEntries && idx < numSymbols; ++i) {
      const val = reader.readBits(8);
      const len = OpCodes.AndN(val, 0x0F) + 1;
      const count = OpCodes.Shr32(val, 4) + 1;
      for (let j = 0; j < count && idx < numSymbols; ++j) lengths[idx++] = len;
    }
    return lengths;
  }

  /**
 * ImplodeCompression - PKWARE "Imploding" (LZ77 + canonical Huffman) algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ImplodeCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Implode";
        this.description = "PKWARE DCL/ZIP method 6 (Imploding): an 8K sliding-dictionary LZ77 matcher (minimum match length 3) whose literal, length, and distance-high symbols are entropy-coded with three canonical Huffman trees (a raw distance-low field is sent separately).";
        this.inventor = "PKWARE, Inc.";
        this.year = 1989;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary + Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.EXPERT;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
          new LinkItem("ZIP (file format) - Wikipedia (Imploding method)", "https://en.wikipedia.org/wiki/ZIP_(file_format)"),
          new LinkItem("Shannon-Fano coding - Wikipedia", "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding")
        ];

        this.references = [
          new LinkItem("StormLib / implode-decoder (historical decoder notes)", "https://github.com/ShieldBattery/implode-decoder"),
          new LinkItem("LZ77 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
        ];

        this.tests = [
          {
            text: "Empty input",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [],
            expected: [0, 0, 0, 0, 3]
          },
          {
            text: "Single byte",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [0x41],
            expected: [1,0,0,0,3,15,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,3,245,245,245,245,3,245,245,245,245,5,1]
          },
          {
            text: "256 repeated bytes",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: new Array(256).fill(0x61),
            expected: [0,1,0,0,3,15,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,3,245,245,245,245,3,245,245,245,245,13,1,128,191,23]
          },
          {
            text: "Text sample repeated 4x",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
            expected: [180,0,0,0,3,18,120,247,119,5,247,247,247,247,215,6,247,247,247,247,247,247,247,247,247,3,245,245,245,245,5,4,22,245,245,245,197,29,154,54,10,180,237,216,172,65,139,64,253,118,65,157,91,7,26,7,117,9,52,239,216,170,77,251,64,80,167,70,237,2,60,0,108,89,175,91,215,64,195,160,38,169,53,0,132,5,254,32]
          },
          {
            text: "All 256 byte values",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: Array.from({ length: 256 }, (_, i) => i),
            expected: [0,1,0,0,3,15,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,3,245,245,245,245,3,245,245,245,245,1,2,6,10,28,36,104,176,224,33,66,134,10,29,38,108,184,240,17,34,70,138,28,37,106,180,232,49,98,198,138,29,39,110,188,248,9,18,38,74,156,36,105,178,228,41,82,166,74,157,38,109,186,244,25,50,102,202,156,37,107,182,236,57,114,230,202,157,39,111,190,252,5,10,22,42,92,164,104,177,226,37,74,150,42,93,166,108,185,242,21,42,86,170,92,165,106,181,234,53,106,214,170,93,167,110,189,250,13,26,54,106,220,164,105,179,230,45,90,182,106,221,166,109,187,246,29,58,118,234,220,165,107,183,238,61,122,246,234,221,167,111,191,254,3,6,14,26,60,100,232,176,225,35,70,142,26,61,102,236,184,241,19,38,78,154,60,101,234,180,233,51,102,206,154,61,103,238,188,249,11,22,46,90,188,100,233,178,229,43,86,174,90,189,102,237,186,245,27,54,110,218,188,101,235,182,237,59,118,238,218,189,103,239,190,253,7,14,30,58,124,228,232,177,227,39,78,158,58,125,230,236,185,243,23,46,94,186,124,229,234,181,235,55,110,222,186,125,231,238,189,251,15,30,62,122,252,228,233,179,231,47,94,190,122,253,230,237,187,247,31,62,126,250,252,229,235,183,239,63,126,254,250,253,231,239,191,255]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new ImplodeInstance(this, isInverse);
      }
    }

    class ImplodeInstance extends IAlgorithmInstance {
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
        return this.isInverse ? this._decompress(data) : this._compress(data);
      }

      // ----- LZ77 parse over the sliding dictionary -----

      _parse(data, windowSize, minMatchLen, maxMatchLen) {
        const tokens = [];
        let i = 0;
        while (i < data.length) {
          let bestLen = 0, bestDist = 0;
          const searchStart = Math.max(0, i - windowSize);
          for (let j = searchStart; j < i; ++j) {
            let len = 0;
            const maxLen = Math.min(data.length - i, maxMatchLen);
            const span = i - j;
            while (len < maxLen && data[j + (len % span)] === data[i + len]) ++len;
            if (len > bestLen && len >= minMatchLen) { bestLen = len; bestDist = i - j - 1; }
          }
          if (bestLen >= minMatchLen) {
            tokens.push({ isLit: false, lit: 0, len: bestLen, dist: bestDist });
            i += bestLen;
          } else {
            tokens.push({ isLit: true, lit: data[i], len: 0, dist: 0 });
            i += 1;
          }
        }
        return tokens;
      }

      // ----- Compression -----

      _encode(data, useLiteralTree, use8kDictionary) {
        const distanceBits = use8kDictionary ? 7 : 6;
        const minMatchLen = useLiteralTree ? 3 : 2;
        const windowSize = use8kDictionary ? 8192 : 4096;
        const maxMatchLen = Math.min(data.length, 63 + 255 + minMatchLen);

        const tokens = this._parse(data, windowSize, minMatchLen, 63 + 255 + minMatchLen);

        const literalFreq = new Array(LITERAL_SYMBOLS).fill(0);
        const lengthFreq = new Array(LENGTH_SYMBOLS).fill(0);
        const distanceFreq = new Array(DISTANCE_SYMBOLS).fill(0);

        for (const t of tokens) {
          if (t.isLit) {
            literalFreq[t.lit]++;
          } else {
            const lenCode = Math.min(t.len - minMatchLen, 63);
            const distHigh = OpCodes.Shr32(t.dist, distanceBits);
            lengthFreq[lenCode]++;
            if (distHigh < 64) distanceFreq[distHigh]++;
          }
        }

        const literalLengths = useLiteralTree ? buildCodeLengths(literalFreq, LITERAL_SYMBOLS) : null;
        const lengthLengths = buildCodeLengths(lengthFreq, LENGTH_SYMBOLS);
        const distanceLengths = buildCodeLengths(distanceFreq, DISTANCE_SYMBOLS);

        const literalCodes = useLiteralTree ? buildCodes(literalLengths, LITERAL_SYMBOLS) : null;
        const lengthCodes = buildCodes(lengthLengths, LENGTH_SYMBOLS);
        const distanceCodes = buildCodes(distanceLengths, DISTANCE_SYMBOLS);

        const writer = new BitWriter();

        if (useLiteralTree) writeSfTree(writer, literalLengths, LITERAL_SYMBOLS);
        writeSfTree(writer, lengthLengths, LENGTH_SYMBOLS);
        writeSfTree(writer, distanceLengths, DISTANCE_SYMBOLS);

        for (const t of tokens) {
          if (t.isLit) {
            writer.writeBits(1, 1);
            if (useLiteralTree) {
              const c = literalCodes[t.lit];
              writer.writeBits(c.code, c.bits);
            } else {
              writer.writeBits(t.lit, 8);
            }
          } else {
            writer.writeBits(0, 1);
            const distLow = OpCodes.AndN(t.dist, OpCodes.Shl32(1, distanceBits) - 1);
            const distHigh = OpCodes.Shr32(t.dist, distanceBits);
            const lenCode = Math.min(t.len - minMatchLen, 63);

            writer.writeBits(distLow, distanceBits);
            const dc = distanceCodes[distHigh < 64 ? distHigh : 0];
            writer.writeBits(dc.code, dc.bits);
            const lc = lengthCodes[lenCode];
            writer.writeBits(lc.code, lc.bits);
            if (lenCode === 63) {
              const extra = Math.min(t.len - minMatchLen - 63, 255);
              writer.writeBits(extra, 8);
            }
          }
        }

        return writer.finish();
      }

      _compress(data) {
        const body = data.length === 0 ? [] : this._encode(data, USE_LITERAL_TREE, USE_8K_DICTIONARY);
        const output = [];
        const len32 = OpCodes.ToUint32(data.length);
        output.push(OpCodes.AndN(len32, 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(len32, 8), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(len32, 16), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(len32, 24), 0xFF));
        output.push(OpCodes.OrN(USE_LITERAL_TREE ? 1 : 0, USE_8K_DICTIONARY ? 2 : 0));
        for (let i = 0; i < body.length; ++i) output.push(body[i]);
        return output;
      }

      // ----- Decompression -----

      _decode(compressed, originalSize, hasLiteralTree, is8kDictionary) {
        const distanceBits = is8kDictionary ? 7 : 6;
        const minMatchLen = hasLiteralTree ? 3 : 2;

        const reader = new BitReader(compressed);

        let literalTrie = null;
        if (hasLiteralTree) {
          const literalLengths = readSfTree(reader, LITERAL_SYMBOLS);
          literalTrie = new DecodeTrie(buildCodes(literalLengths, LITERAL_SYMBOLS), LITERAL_SYMBOLS);
        }
        const lengthLengths = readSfTree(reader, LENGTH_SYMBOLS);
        const lengthTrie = new DecodeTrie(buildCodes(lengthLengths, LENGTH_SYMBOLS), LENGTH_SYMBOLS);
        const distanceLengths = readSfTree(reader, DISTANCE_SYMBOLS);
        const distanceTrie = new DecodeTrie(buildCodes(distanceLengths, DISTANCE_SYMBOLS), DISTANCE_SYMBOLS);

        const out = [];
        while (out.length < originalSize) {
          const flag = reader.readBit();
          if (flag === 1) {
            const b = hasLiteralTree ? literalTrie.decode(reader) : reader.readBits(8);
            out.push(b);
          } else {
            const distLow = reader.readBits(distanceBits);
            const distHigh = distanceTrie.decode(reader);
            const distance = OpCodes.OrN(OpCodes.Shl32(distHigh, distanceBits), distLow);

            const lenCode = lengthTrie.decode(reader);
            let length = lenCode + minMatchLen;
            if (lenCode === 63) length += reader.readBits(8);

            const srcPos = out.length - distance - 1;
            for (let k = 0; k < length && out.length < originalSize; ++k) {
              const src = srcPos + k;
              out.push(src >= 0 && src < out.length ? out[src] : 0);
            }
          }
        }

        return out;
      }

      _decompress(data) {
        if (data.length < 5) throw new Error('Implode: input smaller than 5-byte header');
        const size = OpCodes.OrN(
          OpCodes.OrN(OpCodes.OrN(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)),
          OpCodes.Shl32(data[3], 24)
        );
        const flags = data[4];
        if (size === 0) return [];
        const hasLiteralTree = OpCodes.AndN(flags, 1) !== 0;
        const is8kDictionary = OpCodes.AndN(flags, 2) !== 0;
        return this._decode(data.slice(5), size, hasLiteralTree, is8kDictionary);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ImplodeCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ImplodeCompression, ImplodeInstance };
}));
