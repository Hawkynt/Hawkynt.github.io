/*
 * Implode (PKWARE DCL / ZIP Method 6) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PKWARE's "Imploding" method combines an LZ77-style sliding dictionary
 * match finder with static Shannon-Fano entropy coding. Three independent
 * Shannon-Fano trees are used: one for literal bytes, one for match
 * lengths, and one for the high bits of match distances; the low bits of
 * a distance are sent as raw bits. Each tree is transmitted as a canonical
 * code-length table (a run-length list of "how many consecutive symbols
 * share this bit length") so the decoder can rebuild the same codes.
 *
 * Note: PKWARE packs each code-length run into a single byte (high nibble
 * = run length - 1, low nibble = bit length - 1) and derives the distance
 * low-bit width from an 8K/4K window flag. This implementation keeps the
 * same two-tree/three-tree run-length table structure and 8K-window,
 * 6-tree-bits/7-raw-bits distance split described in APPNOTE.TXT, but uses
 * a simpler two-byte (run, length) pair per table entry for robustness.
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

  const WINDOW_SIZE = 8192;
  const MIN_MATCH = 3;
  const DIST_LOW_BITS = 7; // 8K window: 6 tree bits + 7 raw bits = 13 bits
  const LENGTH_SYMBOLS = 64;
  const DISTANCE_SYMBOLS = 64;
  const LITERAL_SYMBOLS = 256;
  const MAX_MATCH = MIN_MATCH + 63 + 255; // length code 63 + extended byte

  // ----- Bit-level stream helpers (MSB-first) -----

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.nbits = 0;
    }

    writeBit(bit) {
      this.cur = OpCodes.Or32(OpCodes.Shl32(this.cur, 1), OpCodes.And32(bit, 1));
      this.nbits++;
      if (this.nbits === 8) {
        this.bytes.push(OpCodes.ToByte(this.cur));
        this.cur = 0;
        this.nbits = 0;
      }
    }

    writeBits(value, width) {
      for (let i = width - 1; i >= 0; i--) this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }

    finish() {
      if (this.nbits > 0) {
        this.cur = OpCodes.Shl32(this.cur, 8 - this.nbits);
        this.bytes.push(OpCodes.ToByte(this.cur));
        this.cur = 0;
        this.nbits = 0;
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
      const byteIndex = Math.floor(this.pos / 8);
      const bitIndex = 7 - (this.pos % 8);
      const byteVal = byteIndex < this.bytes.length ? this.bytes[byteIndex] : 0;
      this.pos++;
      return OpCodes.And32(OpCodes.Shr32(byteVal, bitIndex), 1);
    }

    readBits(width) {
      let value = 0;
      for (let i = 0; i < width; i++) value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
      return value;
    }
  }

  // ----- Canonical Shannon-Fano code construction -----

  // Recursively splits the symbol list (sorted by descending frequency at
  // each step) into two halves of the most nearly-equal total frequency,
  // assigning one extra bit of depth per split, until every symbol is alone.
  function buildShannonFanoLengths(freqs, alphabetSize) {
    const lengths = new Array(alphabetSize).fill(0);
    const present = [];
    for (let s = 0; s < alphabetSize; s++) if (freqs[s] > 0) present.push({ sym: s, freq: freqs[s] });

    if (present.length === 0) return lengths;
    if (present.length === 1) { lengths[present[0].sym] = 1; return lengths; }

    const recurse = (list, depth) => {
      if (list.length === 1) { lengths[list[0].sym] = depth; return; }
      list.sort((a, b) => b.freq - a.freq || a.sym - b.sym);
      const total = list.reduce((s, x) => s + x.freq, 0);
      let bestIdx = 1, bestDiff = Infinity, cum = 0;
      for (let i = 0; i < list.length - 1; i++) {
        cum += list[i].freq;
        const diff = Math.abs(2 * cum - total);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i + 1; }
      }
      recurse(list.slice(0, bestIdx), depth + 1);
      recurse(list.slice(bestIdx), depth + 1);
    };

    recurse(present, 0);
    return lengths;
  }

  // Assigns canonical (uniquely decodable, sorted-by-length-then-symbol) bit
  // patterns for a set of code lengths, matching the standard technique used
  // to serialize Huffman/Shannon-Fano trees compactly.
  function assignCanonicalCodes(lengths, alphabetSize) {
    const order = [];
    for (let s = 0; s < alphabetSize; s++) if (lengths[s] > 0) order.push(s);
    order.sort((a, b) => lengths[a] - lengths[b] || a - b);

    const codes = new Array(alphabetSize).fill(null);
    let code = 0, prevLen = 0;
    for (const s of order) {
      const len = lengths[s];
      code = OpCodes.Shl32(code, len - prevLen);
      codes[s] = { code: code, len: len };
      code++;
      prevLen = len;
    }
    return codes;
  }

  class DecodeTrie {
    constructor(codes, alphabetSize) {
      this.root = { sym: -1, c0: null, c1: null };
      for (let s = 0; s < alphabetSize; s++) {
        const entry = codes[s];
        if (!entry) continue;
        let node = this.root;
        for (let i = entry.len - 1; i >= 0; i--) {
          const bit = OpCodes.And32(OpCodes.Shr32(entry.code, i), 1);
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
      while (node.sym === -1) {
        node = reader.readBit() === 0 ? node.c0 : node.c1;
      }
      return node.sym;
    }
  }

  // ----- Code-length table (run-length) serialization -----

  function writeLengthTable(out, lengths) {
    const pairs = [];
    let i = 0;
    while (i < lengths.length) {
      let run = 1;
      while (i + run < lengths.length && lengths[i + run] === lengths[i] && run < 256) run++;
      pairs.push([run - 1, lengths[i]]);
      i += run;
    }
    out.push(OpCodes.ToByte(pairs.length - 1));
    for (const p of pairs) { out.push(OpCodes.ToByte(p[0])); out.push(OpCodes.ToByte(p[1])); }
  }

  function readLengthTable(data, pos, alphabetSize) {
    const pairCount = data[pos++] + 1;
    const lengths = [];
    for (let i = 0; i < pairCount; i++) {
      const run = data[pos++] + 1;
      const len = data[pos++];
      for (let k = 0; k < run; k++) lengths.push(len);
    }
    while (lengths.length < alphabetSize) lengths.push(0);
    return { lengths: lengths, pos: pos };
  }

  /**
 * ImplodeCompression - PKWARE "Imploding" (LZ77 + Shannon-Fano) algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ImplodeCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Implode";
        this.description = "PKWARE DCL/ZIP method 6 (Imploding): an 8K sliding-dictionary LZ77 matcher (minimum match length 3) whose literal, length, and distance symbols are entropy-coded with three independent static Shannon-Fano trees.";
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

        // Test vectors - self-computed round-trip verification vectors produced by
        // this implementation (the exact bit layout is implementation-defined;
        // see the file header note on simplifications versus PKWARE's packed
        // nibble table format).
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Repetitive input - 'AAAAAAAAAAAAAAAA'",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("AAAAAAAAAAAAAAAA"),
            expected: [0,0,0,16,2,64,0,0,1,189,0,2,11,0,0,1,50,0,1,0,1,62,0,128,0]
          },
          {
            text: "Text sample - 'abcabcabcabc'",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("abcabcabcabc"),
            expected: [0,0,0,12,3,96,0,0,1,1,2,155,0,2,5,0,0,1,56,0,1,0,1,62,0,183,1,0]
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
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // ----- LZ77 parse over the sliding dictionary -----

      _parse(data) {
        const tokens = [];
        let i = 0;
        while (i < data.length) {
          const start = Math.max(0, i - WINDOW_SIZE);
          let bestLen = 0, bestDist = 0;
          for (let j = i - 1; j >= start; j--) {
            let len = 0;
            const maxLen = Math.min(MAX_MATCH, data.length - i);
            while (len < maxLen && data[j + len] === data[i + len]) len++;
            if (len > bestLen) { bestLen = len; bestDist = i - j; }
          }
          if (bestLen >= MIN_MATCH) {
            tokens.push({ type: 1, len: bestLen, dist: bestDist });
            i += bestLen;
          } else {
            tokens.push({ type: 0, byte: data[i] });
            i += 1;
          }
        }
        return tokens;
      }

      // ----- Compression -----

      _compress(data) {
        const tokens = this._parse(data);

        const litFreq = new Array(LITERAL_SYMBOLS).fill(0);
        const lenFreq = new Array(LENGTH_SYMBOLS).fill(0);
        const distFreq = new Array(DISTANCE_SYMBOLS).fill(0);

        for (const t of tokens) {
          if (t.type === 0) {
            litFreq[t.byte]++;
          } else {
            const rawLen = t.len - MIN_MATCH;
            const lenCode = Math.min(rawLen, 63);
            lenFreq[lenCode]++;
            const distVal = t.dist - 1;
            const distCode = OpCodes.Shr32(distVal, DIST_LOW_BITS);
            distFreq[distCode]++;
          }
        }

        const litLengths = buildShannonFanoLengths(litFreq, LITERAL_SYMBOLS);
        const lenLengths = buildShannonFanoLengths(lenFreq, LENGTH_SYMBOLS);
        const distLengths = buildShannonFanoLengths(distFreq, DISTANCE_SYMBOLS);

        const litCodes = assignCanonicalCodes(litLengths, LITERAL_SYMBOLS);
        const lenCodes = assignCanonicalCodes(lenLengths, LENGTH_SYMBOLS);
        const distCodes = assignCanonicalCodes(distLengths, DISTANCE_SYMBOLS);

        const header = [];
        header.push(...OpCodes.Unpack32BE(data.length));
        writeLengthTable(header, litLengths);
        writeLengthTable(header, lenLengths);
        writeLengthTable(header, distLengths);

        const writer = new BitWriter();
        for (const t of tokens) {
          if (t.type === 0) {
            writer.writeBit(1);
            const c = litCodes[t.byte];
            writer.writeBits(c.code, c.len);
          } else {
            writer.writeBit(0);

            const distVal = t.dist - 1;
            const distCode = OpCodes.Shr32(distVal, DIST_LOW_BITS);
            const distLow = OpCodes.And32(distVal, OpCodes.Shl32(1, DIST_LOW_BITS) - 1);
            const dc = distCodes[distCode];
            writer.writeBits(dc.code, dc.len);
            writer.writeBits(distLow, DIST_LOW_BITS);

            const rawLen = t.len - MIN_MATCH;
            const lenCode = Math.min(rawLen, 63);
            const lc = lenCodes[lenCode];
            writer.writeBits(lc.code, lc.len);
            if (lenCode === 63) writer.writeBits(rawLen - 63, 8);
          }
        }

        return header.concat(writer.finish());
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 4) return [];
        const originalLength = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) return [];

        let pos = 4;
        const lit = readLengthTable(data, pos, LITERAL_SYMBOLS); pos = lit.pos;
        const len = readLengthTable(data, pos, LENGTH_SYMBOLS); pos = len.pos;
        const dist = readLengthTable(data, pos, DISTANCE_SYMBOLS); pos = dist.pos;

        const litCodes = assignCanonicalCodes(lit.lengths, LITERAL_SYMBOLS);
        const lenCodes = assignCanonicalCodes(len.lengths, LENGTH_SYMBOLS);
        const distCodes = assignCanonicalCodes(dist.lengths, DISTANCE_SYMBOLS);

        const litTrie = new DecodeTrie(litCodes, LITERAL_SYMBOLS);
        const lenTrie = new DecodeTrie(lenCodes, LENGTH_SYMBOLS);
        const distTrie = new DecodeTrie(distCodes, DISTANCE_SYMBOLS);

        const reader = new BitReader(data.slice(pos));
        const out = [];

        while (out.length < originalLength) {
          const flag = reader.readBit();
          if (flag === 1) {
            out.push(litTrie.decode(reader));
          } else {
            const distCode = distTrie.decode(reader);
            const distLow = reader.readBits(DIST_LOW_BITS);
            const distVal = OpCodes.Or32(OpCodes.Shl32(distCode, DIST_LOW_BITS), distLow);
            const distance = distVal + 1;

            let lenCode = lenTrie.decode(reader);
            let rawLen = lenCode;
            if (lenCode === 63) {
              const extra = reader.readBits(8);
              rawLen = 63 + extra;
            }
            const matchLen = rawLen + MIN_MATCH;

            for (let k = 0; k < matchLen; k++) {
              out.push(out[out.length - distance]);
            }
          }
        }

        return out.slice(0, originalLength);
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
