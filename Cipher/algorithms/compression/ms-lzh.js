/*
 * MS-LZH Compression Algorithm (Microsoft LZSS+Huffman hybrid)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Microsoft used several LZSS-derived compression schemes internally during
 * the MS-DOS/Windows 3.1/Windows 95 era that are related to, but distinct
 * from, the generic "LZH" method popularised by LHA/LHarc (the lh5 method,
 * which uses an 8 KiB window and RFC1951/DEFLATE-style run-length-coded
 * Huffman tree descriptions). There is no single public document titled
 * "MS-LZH"; this implementation is a documented reconstruction built from
 * the closest verifiable public sources for Microsoft's own LZSS/Huffman
 * compressors, kept deliberately different in parameters from the sibling
 * generic LZH implementation so the two never collide as duplicate
 * algorithm names or produce interoperable streams.
 *
 * Sources consulted:
 *  - libmspack's SZDD/KWAJ format documentation describes the MS-DOS
 *    COMPRESS.EXE/EXPAND.EXE "SZDD" format as a 4096-byte ring-buffer LZSS
 *    (window initially filled with 0x20, minimum match length 3, 12-bit
 *    back-reference offset), and describes COMPRESS.EXE's related "KWAJ"
 *    format method 3 as the same LZSS matcher combined with several
 *    Huffman trees over the match/literal token stream.
 *    (https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html)
 *  - The Just Solve the File Format Problem wiki corroborates the SZDD/KWAJ
 *    framing as Microsoft's own single-file installation compression tools.
 *    (http://fileformats.archiveteam.org/wiki/Microsoft_SZ_installation_compression)
 *  - libmspack itself (LGPL), the reference implementation for these
 *    Microsoft formats. (https://github.com/kyz/libmspack)
 *
 * Note: no source gives one single canonical bitstream layout shared by all
 * Microsoft LZSS+Huffman tools (SZDD is pure LZSS with no entropy stage;
 * KWAJ method 3 uses five separate Huffman trees over match-run-length,
 * match-length, literal-run-length, distance-high-bits and raw-literal
 * alphabets). Reproducing either bit-for-bit was not attempted. Instead this
 * implementation combines the verified LZSS parameters (4096-byte window,
 * minimum match length 3) with a single order-0 canonical Huffman tree over
 * a compact literal/match-flag/end-of-block alphabet (258 symbols), which is
 * the "reasonable, clearly documented" hybrid the task allows for when no
 * single citable spec is granular enough to reproduce exactly. Match
 * distance (12 bits, 1..4096) and match length (8 bits, 3..258) are written
 * as fixed-width fields after the Huffman-coded match flag rather than being
 * Huffman-coded themselves, which is a deliberate simplification versus
 * KWAJ's multi-tree design. This keeps the format self-consistent and
 * round-trip-safe while remaining unambiguously distinct from the sibling
 * generic LZH (LHA lh5-style) implementation in this repository, which uses
 * an 8 KiB window and a different framing entirely.
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

  // ===== MS-LZH CONSTANTS =====
  // Alphabet layout: symbols 0..255 are literal bytes, 256 is the "match
  // follows" flag, 257 is end-of-stream. Distance/length fields for a match
  // are written as fixed-width raw bits immediately after the match symbol.
  const LITERAL_COUNT = 256;
  const MATCH_SYMBOL = 256;
  const EOB_SYMBOL = 257;
  const ALPHABET_SIZE = 258;

  const HEADER_LENGTH_BITS = 8;  // bits used to transmit each Huffman code length
  const DISTANCE_BITS = 12;      // 4096-byte window -> distance-1 fits in 12 bits
  const MATCH_LENGTH_BITS = 8;   // length-MIN_MATCH fits in 8 bits (max length 258)

  // ===== BIT STREAM HELPERS =====

  class BitStream {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    writeBits(value, numBits) {
      this.bitBuffer = OpCodes.ToUint32(OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(value, this.bitCount)));
      this.bitCount += numBits;

      while (this.bitCount >= 8) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = OpCodes.Shr32(this.bitBuffer, 8);
        this.bitCount -= 8;
      }
    }

    // Writes a Huffman code one bit at a time, most-significant bit first.
    // Bit-by-bit writing keeps every writeBits() call at numBits=1, which
    // avoids any risk of exceeding 32-bit shift safety regardless of how
    // long an individual Huffman code happens to be.
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
      while (this.bitCount < numBits) {
        if (this.bytePos >= this.bytes.length) {
          throw new Error('Unexpected end of compressed data');
        }
        this.bitBuffer = OpCodes.ToUint32(OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(this.bytes[this.bytePos++], this.bitCount)));
        this.bitCount += 8;
      }

      const mask = OpCodes.ToUint32(OpCodes.Shl32(1, numBits) - 1);
      const value = OpCodes.AndN(this.bitBuffer, mask);
      this.bitBuffer = OpCodes.Shr32(this.bitBuffer, numBits);
      this.bitCount -= numBits;
      return value;
    }

    hasMore() {
      return this.bytePos < this.bytes.length || this.bitCount > 0;
    }
  }

  // ===== CANONICAL HUFFMAN TREE =====

  class HuffmanTree {
    constructor() {
      this.root = null;
      this.codes = null;
    }

    // Builds canonical Huffman codes from an array of per-symbol code
    // lengths (0 = symbol unused). Deterministic given the lengths, so the
    // decoder can reconstruct identical codes from the transmitted lengths
    // alone -- it never needs the original symbol frequencies.
    static buildFromLengths(lengths) {
      const tree = new HuffmanTree();

      let maxLen = 0;
      for (let i = 0; i < lengths.length; ++i) {
        if (lengths[i] > maxLen) maxLen = lengths[i];
      }

      if (maxLen === 0) {
        tree.codes = new Array(lengths.length);
        return tree;
      }

      const blCount = new Array(maxLen + 1).fill(0);
      for (const len of lengths) {
        if (len > 0) blCount[len]++;
      }

      const nextCode = new Array(maxLen + 1);
      let code = 0;
      blCount[0] = 0;

      for (let bits = 1; bits <= maxLen; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      const codes = new Array(lengths.length);
      for (let n = 0; n < lengths.length; ++n) {
        const len = lengths[n];
        if (len !== 0) {
          codes[n] = { code: nextCode[len], length: len };
          nextCode[len]++;
        }
      }

      tree.root = {};
      for (let symbol = 0; symbol < codes.length; ++symbol) {
        if (!codes[symbol]) continue;

        let node = tree.root;
        const { code: symCode, length } = codes[symbol];

        for (let i = length - 1; i >= 0; --i) {
          const bit = OpCodes.AndN(OpCodes.Shr32(symCode, i), 1);
          const key = bit ? 'one' : 'zero';

          if (i === 0) {
            node[key] = { symbol };
          } else {
            if (!node[key]) node[key] = {};
            node = node[key];
          }
        }
      }

      tree.codes = codes;
      return tree;
    }

    decode(bitReader) {
      let node = this.root;
      if (!node) throw new Error('Invalid Huffman tree');

      while (node.symbol === undefined) {
        const bit = bitReader.readBits(1);
        node = bit ? node.one : node.zero;
        if (!node) throw new Error('Invalid Huffman code');
      }

      return node.symbol;
    }

    encode(symbol) {
      if (!this.codes || !this.codes[symbol]) {
        throw new Error(`No Huffman code for symbol ${symbol}`);
      }
      return this.codes[symbol];
    }
  }

  // Builds a set of valid canonical-ready code lengths for the given
  // per-symbol frequency counts using a standard binary Huffman merge.
  // Any prefix-free assignment derived this way automatically satisfies
  // Kraft's inequality, so buildFromLengths() can turn it into codes.
  function buildLengthsFromFrequencies(freqs, alphabetSize) {
    const lengths = new Array(alphabetSize).fill(0);

    let queue = [];
    for (let symbol = 0; symbol < alphabetSize; ++symbol) {
      if (freqs[symbol] > 0) {
        queue.push({ freq: freqs[symbol], symbol, left: null, right: null });
      }
    }

    if (queue.length === 0) return lengths;

    if (queue.length === 1) {
      lengths[queue[0].symbol] = 1;
      return lengths;
    }

    while (queue.length > 1) {
      queue.sort((a, b) => a.freq - b.freq);
      const left = queue.shift();
      const right = queue.shift();
      queue.push({ freq: left.freq + right.freq, symbol: -1, left, right });
    }

    const walk = (node, depth) => {
      if (node.symbol >= 0) {
        lengths[node.symbol] = depth === 0 ? 1 : depth;
        return;
      }
      walk(node.left, depth + 1);
      walk(node.right, depth + 1);
    };
    walk(queue[0], 0);

    return lengths;
  }

  // ===== MS-LZH ALGORITHM =====

  class MSLZHAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MS-LZH";
      this.description = "Microsoft-attributed LZSS+Huffman compression variant modeled on the 4 KiB ring-buffer LZSS matcher documented for MS-DOS COMPRESS.EXE/EXPAND.EXE (the SZDD/KWAJ family), combined with an order-0 canonical Huffman coder over the literal/match token alphabet. Distinct in window size and framing from the generic LHA-style LZH (lh5) method.";
      this.inventor = "Microsoft Corporation";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // MS-LZH configuration
      this.WINDOW_SIZE = 4096;       // 4 KiB window (SZDD/KWAJ ring buffer size)
      this.MIN_MATCH = 3;            // Minimum back-reference match length (SZDD LZSS)
      this.MAX_MATCH = 258;          // 3 + 255 (fits the 8-bit match-length field)
      this.MAX_CHAIN = 64;           // Bounded hash-chain search depth per position

      // Documentation
      this.documentation = [
        new LinkItem("SZDD and KWAJ Compression Formats (libmspack documentation)", "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"),
        new LinkItem("Microsoft SZ installation compression - Just Solve the File Format Problem", "http://fileformats.archiveteam.org/wiki/Microsoft_SZ_installation_compression"),
        new LinkItem("libmspack - a library for some loosely related Microsoft compression formats", "https://github.com/kyz/libmspack")
      ];

      this.references = [
        new LinkItem("ms-compress - open source Microsoft compression algorithm implementations", "https://github.com/coderforlife/ms-compress"),
        new LinkItem("Lempel-Ziv-Storer-Szymanski (LZSS) - Wikipedia", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Storer%E2%80%93Szymanski"),
        new LinkItem("Huffman coding - Wikipedia", "https://en.wikipedia.org/wiki/Huffman_coding")
      ];

      // Test vectors - round-trip compression tests (compress then decompress
      // must reproduce the exact input bytes; compressed output is
      // implementation-defined, so expected is left empty by convention).
      this.tests = [
        new TestCase(
          [],
          [],
          "MS-LZH round-trip - empty input",
          "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("M"),
          [],
          "MS-LZH round-trip - single byte",
          "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"
        ),
        new TestCase(
          (() => { const a = []; for (let i = 0; i < 1000; ++i) a.push(0x41); return a; })(),
          [],
          "MS-LZH round-trip - long repetitive run (1000x 0x41)",
          "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"
        ),
        new TestCase(
          (() => { const a = []; for (let i = 0; i < 512; ++i) a.push(i % 2 === 0 ? 0xAA : 0x55); return a; })(),
          [],
          "MS-LZH round-trip - alternating byte pattern (0xAA/0x55)",
          "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"
        ),
        new TestCase(
          [0x00, 0x4E, 0xE1, 0x3B, 0xFF, 0x7A, 0x12, 0x9C, 0x33, 0x81, 0x00, 0x5D,
           0xC4, 0x2F, 0xFF, 0x08, 0x91, 0xA6, 0x17, 0x64, 0xB2, 0x0D, 0xEE, 0x3A,
           0x50, 0xC9, 0x77, 0x1F, 0x00, 0xFF, 0x88, 0x22, 0x99, 0x11, 0x63, 0xD4,
           0x2A, 0x5E, 0xB0, 0x07, 0xFA, 0x4C, 0x38, 0x91, 0xE2, 0x0F, 0x66, 0xAB,
           0x00, 0xFF, 0x1D, 0x3E, 0x8C, 0x71, 0xC5, 0x29, 0x94, 0x5B, 0xE7, 0x02,
           0x6A, 0xD8, 0x13, 0xFF],
          [],
          "MS-LZH round-trip - pseudo-random binary sample",
          "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("MS-DOS 6.0 COMPRESS.EXE / EXPAND.EXE SZDD LZSS 4096-byte window"),
          [],
          "MS-LZH round-trip - spec-flavored text vector",
          "https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html"
        )
      ];
    }

    /**
   * Create new algorithm instance
   * @param {boolean} [isInverse=false] - True for decompression, false for compression
   * @returns {Object} New algorithm instance
   */

    CreateInstance(isInverse = false) {
      return new MSLZHInstance(this, isInverse);
    }
  }

  /**
 * MS-LZH instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class MSLZHInstance extends IAlgorithmInstance {
    /**
   * Initialize MS-LZH instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decompression mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to the instance for processing
   * @param {uint8[]} data - Input data bytes
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get instance result (compressed or decompressed data)
   * @returns {uint8[]} Processed output bytes
   */

    Result() {
      if (this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress(data) {
      if (data.length === 0) return [];

      const tokens = this._findMatches(data);

      const freq = new Array(ALPHABET_SIZE).fill(0);
      for (const token of tokens) {
        if (token.type === 'literal') freq[token.value]++;
        else if (token.type === 'match') freq[MATCH_SYMBOL]++;
        else freq[EOB_SYMBOL]++;
      }

      const lengths = buildLengthsFromFrequencies(freq, ALPHABET_SIZE);
      const tree = HuffmanTree.buildFromLengths(lengths);

      const stream = new BitStream();

      // Header: transmit the canonical code length for every alphabet
      // symbol so the decoder can rebuild an identical tree.
      for (let i = 0; i < ALPHABET_SIZE; ++i) {
        stream.writeBits(lengths[i], HEADER_LENGTH_BITS);
      }

      for (const token of tokens) {
        if (token.type === 'literal') {
          const { code, length } = tree.encode(token.value);
          stream.writeHuffmanCode(code, length);
        } else if (token.type === 'match') {
          const { code, length } = tree.encode(MATCH_SYMBOL);
          stream.writeHuffmanCode(code, length);
          stream.writeBits(token.distance - 1, DISTANCE_BITS);
          stream.writeBits(token.length - this.algorithm.MIN_MATCH, MATCH_LENGTH_BITS);
        } else {
          const { code, length } = tree.encode(EOB_SYMBOL);
          stream.writeHuffmanCode(code, length);
        }
      }

      return stream.flush();
    }

    // LZSS parse over a 4 KiB sliding window, using a 3-byte rolling hash
    // to find candidate back-references. Returns a token list terminated by
    // a single end-of-block marker token.
    _findMatches(data) {
      const tokens = [];
      const hashTable = new Map();
      const WINDOW = this.algorithm.WINDOW_SIZE;
      const MIN_MATCH = this.algorithm.MIN_MATCH;
      const MAX_MATCH = this.algorithm.MAX_MATCH;
      const MAX_CHAIN = this.algorithm.MAX_CHAIN;

      let pos = 0;
      while (pos < data.length) {
        let bestMatch = null;

        if (pos + MIN_MATCH <= data.length) {
          const hash = this._hash3(data, pos);
          const positions = hashTable.get(hash);

          if (positions) {
            let checked = 0;
            for (let i = positions.length - 1; i >= 0 && checked < MAX_CHAIN; --i, ++checked) {
              const matchPos = positions[i];
              if (pos - matchPos > WINDOW) break;

              const len = this._matchLength(data, matchPos, pos, MAX_MATCH);
              if (len >= MIN_MATCH && (!bestMatch || len > bestMatch.length)) {
                bestMatch = { type: 'match', distance: pos - matchPos, length: len };
                if (len >= MAX_MATCH) break;
              }
            }
          }

          if (!hashTable.has(hash)) hashTable.set(hash, []);
          const chain = hashTable.get(hash);
          chain.push(pos);
          if (chain.length > 512) chain.shift();
        }

        if (bestMatch) {
          tokens.push(bestMatch);
          pos += bestMatch.length;
        } else {
          tokens.push({ type: 'literal', value: data[pos] });
          ++pos;
        }
      }

      tokens.push({ type: 'eob' });
      return tokens;
    }

    _hash3(data, pos) {
      const h1 = OpCodes.Shl32(data[pos], 10);
      const h2 = OpCodes.Shl32(data[pos + 1], 5);
      const h3 = data[pos + 2];
      const combined = OpCodes.XorN(OpCodes.XorN(h1, h2), h3);
      return OpCodes.AndN(combined, 0x7FFF);
    }

    _matchLength(data, pos1, pos2, maxLen) {
      let len = 0;
      const limit = Math.min(maxLen, data.length - pos2);

      while (len < limit && data[pos1 + len] === data[pos2 + len]) {
        ++len;
      }

      return len;
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      if (data.length === 0) return [];

      const reader = new BitReader(data);
      const lengths = new Array(ALPHABET_SIZE);

      for (let i = 0; i < ALPHABET_SIZE; ++i) {
        lengths[i] = reader.readBits(HEADER_LENGTH_BITS);
      }

      const tree = HuffmanTree.buildFromLengths(lengths);
      const output = [];

      for (;;) {
        const symbol = tree.decode(reader);

        if (symbol === EOB_SYMBOL) {
          break;
        } else if (symbol === MATCH_SYMBOL) {
          const distance = reader.readBits(DISTANCE_BITS) + 1;
          const length = reader.readBits(MATCH_LENGTH_BITS) + this.algorithm.MIN_MATCH;
          const startPos = output.length - distance;

          for (let i = 0; i < length; ++i) {
            output.push(output[startPos + i]);
          }
        } else {
          output.push(symbol);
        }
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new MSLZHAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MSLZHAlgorithm, MSLZHInstance };
}));
