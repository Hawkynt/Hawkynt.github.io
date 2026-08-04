/*
 * Zstandard (Zstd) Codec — RFC 8878
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Genuinely interoperable implementation of the Zstandard frame format.
 *
 * Encoder: emits a fully standard-compliant frame using only Raw_Block and
 * RLE_Block (RFC 8878 Section 3.1.1.2.2). This is legal, spec-compliant
 * Zstandard output — the standard explicitly permits storing literal bytes
 * uncompressed inside a valid frame — and is read correctly by facebook/zstd,
 * the zstd CLI, and Node's zlib.zstdDecompressSync.
 *
 * Decoder: implements the full block/section grammar needed to read frames
 * produced by real Zstd encoders (Node's zlib.zstdCompressSync, the zstd
 * CLI, etc.), including:
 *  - Frame_Header parsing (descriptor, window descriptor, dictionary ID,
 *    frame content size)
 *  - Raw_Block, RLE_Block and Compressed_Block
 *  - Literals_Section: Raw, RLE, Huffman-Compressed (1 or 4 streams) and
 *    Treeless (reusing the previous block's Huffman tree) literal modes,
 *    including Huffman tree description decoding (direct 4-bit weights and
 *    FSE-compressed weights)
 *  - Sequences_Section: FSE-coded literals-length/match-length/offset codes
 *    with Predefined, RLE, FSE_Compressed and Repeat_Mode distribution
 *    tables, and the repeat-offset ("recent offsets") rules
 *  - Sequence execution (literal copy + back-reference copy)
 *
 * The entropy-coding primitives here are zstd-specific (matching RFC 8878's
 * exact bitstream and table-description formats): the FSE/Huffman modules
 * elsewhere in this repository (fse.js, huffman.js) use their own,
 * non-standard framing and are not wire-compatible with Zstandard's actual
 * bitstream layout, so they are not reused for the entropy stages here.
 *
 * All shift/mask/pack arithmetic uses OpCodes (Shl32/Shr32/And32/Or32/...);
 * a handful of bit-field extractions that can exceed 32 bits (large
 * literals-section headers) use plain arithmetic (multiply/divide/modulo)
 * instead, since JavaScript's native bitwise operators truncate to 32 bits.
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== ZSTD CONSTANTS =====

  const ZSTD_MAGIC_NUMBER = 0xFD2FB528;
  const ZSTD_MAGIC_SKIPPABLE_START = 0x184D2A50;
  const ZSTD_MAGIC_SKIPPABLE_MASK = 0xFFFFFFF0;

  const BLOCK_TYPE_RAW = 0;
  const BLOCK_TYPE_RLE = 1;
  const BLOCK_TYPE_COMPRESSED = 2;
  const BLOCK_TYPE_RESERVED = 3;

  const MAX_BLOCK_SIZE = 128 * 1024; // 128 KB
  const MIN_WINDOW_LOG = 10;
  const MAX_WINDOW_LOG = 31;

  const HUF_MAX_BITS = 11;           // RFC 8878 4.2.1 "limits the maximum code length to 11 bits"
  const HUF_WEIGHTS_MAX_ACCLOG = 6;  // RFC 8878 4.2.1.2

  // Predefined literals length codes (RFC 8878 Appendix A.1 / 3.1.1.3.2.2.1)
  const LL_DEFAULT_NORM = [
    4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1,
    -1, -1, -1, -1
  ];
  const LL_DEFAULT_ACCLOG = 6;

  // Predefined match length codes (RFC 8878 Appendix A.2 / 3.1.1.3.2.2.2)
  const ML_DEFAULT_NORM = [
    1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1,
    -1, -1, -1, -1, -1
  ];
  const ML_DEFAULT_ACCLOG = 6;

  // Predefined offset codes (RFC 8878 Appendix A.3 / 3.1.1.3.2.2.3)
  const OF_DEFAULT_NORM = [
    1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1
  ];
  const OF_DEFAULT_ACCLOG = 5;

  // Literals-length code -> {baseline, extra bits} (RFC 8878 Table 16)
  const LL_BASELINE = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    16, 18, 20, 22, 24, 28, 32, 40, 48, 64, 128, 256, 512, 1024, 2048, 4096,
    8192, 16384, 32768, 65536
  ];
  const LL_EXTRABITS = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16
  ];

  // Match-length code -> {baseline, extra bits} (RFC 8878 Table 17)
  const ML_BASELINE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
    35, 37, 39, 41, 43, 47, 51, 59, 67, 83, 99, 131, 259, 515, 1027, 2051,
    4099, 8195, 16387, 32771, 65539
  ];
  const ML_EXTRABITS = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16
  ];

  // ===== LOW-LEVEL BIT PRIMITIVES =====
  //
  // Zstd's FSE/Huffman bitstreams and its forward table-description bitstreams
  // both use the same "little-endian bit" convention: given an absolute bit
  // index i (bit 0 = LSB of the first byte in range), extracting n bits
  // starting at i yields a number where bit i has weight 1 and bit i+n-1 has
  // weight 2^(n-1). This one convention, applied either with an increasing
  // cursor (forward table descriptions) or a decreasing cursor (backward
  // Huffman/FSE streams), reproduces the exact semantics of libzstd's
  // BIT_addBits / BIT_lookBits and the forward NCount reader.

  function highBitPos(byteVal) {
    // 0-based index of the highest set bit of a byte (byteVal must be > 0)
    let v = byteVal, p = 0;
    while (v > 1) { v = Math.floor(v / 2); ++p; }
    return p;
  }

  function bitAtAbs(bytes, base, absBit) {
    if (absBit < 0) return 0;
    const byteOffset = Math.floor(absBit / 8);
    const byteIdx = base + byteOffset;
    if (byteIdx < 0 || byteIdx >= bytes.length) return 0;
    const bitIdx = absBit - byteOffset * 8; // 0..7
    return OpCodes.And32(OpCodes.Shr32(bytes[byteIdx], bitIdx), 1);
  }

  function getBitsLE(bytes, base, absBitStart, n) {
    let result = 0, weight = 1;
    for (let i = 0; i < n; ++i) {
      if (bitAtAbs(bytes, base, absBitStart + i)) result += weight;
      weight *= 2;
    }
    return result;
  }

  // Forward bit cursor: used for FSE table descriptions (NCount) and Huffman
  // weight-table descriptions, which are read forward, byte-aligned start.
  class FwdBitCursor {
    constructor(bytes, byteOffset) {
      this.bytes = bytes;
      this.base = byteOffset;
      this.pos = 0; // bits consumed, relative to base
    }
    peekBits(n) { return getBitsLE(this.bytes, this.base, this.pos, n); }
    readBits(n) { const v = this.peekBits(n); this.pos += n; return v; }
    byteLength() { return Math.ceil(this.pos / 8); }
  }

  // Backward bit cursor: used for Huffman-coded streams and FSE-coded
  // bitstreams (sequences, Huffman weights), which are written forward but
  // read backward (RFC 8878 4.1 / 4.2).
  class BwdBitCursor {
    constructor(bytes, start, end) {
      if (end <= start) throw new Error('Zstd: empty bitstream');
      const lastByte = bytes[end - 1];
      if (lastByte === 0) throw new Error('Zstd: corrupt bitstream (missing end mark)');
      this.bytes = bytes;
      this.base = start;
      this.cursor = (end - start - 1) * 8 + highBitPos(lastByte); // position of the sentinel '1' bit
    }
    peekBits(n) { return getBitsLE(this.bytes, this.base, this.cursor - n, n); }
    readBits(n) { this.cursor -= n; return getBitsLE(this.bytes, this.base, this.cursor, n); }
  }

  // ===== FSE TABLE CONSTRUCTION (RFC 8878 4.1 / 4.1.1) =====

  function buildFseTable(normCounts, maxSymbolValue, accuracyLog) {
    const tableSize = OpCodes.Shl32(1, accuracyLog);
    const entries = new Array(tableSize);
    const symbolNext = new Array(maxSymbolValue + 1);
    let highThreshold = tableSize - 1;

    for (let s = 0; s <= maxSymbolValue; ++s) {
      if (normCounts[s] === -1) {
        entries[highThreshold] = { symbol: s };
        highThreshold--;
        symbolNext[s] = 1;
      } else {
        symbolNext[s] = normCounts[s];
      }
    }

    const tableMask = tableSize - 1;
    const step = OpCodes.Add32(OpCodes.Add32(OpCodes.Shr32(tableSize, 1), OpCodes.Shr32(tableSize, 3)), 3);
    let position = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      const freq = normCounts[s] > 0 ? normCounts[s] : 0;
      for (let i = 0; i < freq; ++i) {
        entries[position] = { symbol: s };
        position = OpCodes.And32(position + step, tableMask);
        while (position > highThreshold) position = OpCodes.And32(position + step, tableMask);
      }
    }

    for (let u = 0; u < tableSize; ++u) {
      const symbol = entries[u].symbol;
      const nextState = symbolNext[symbol]++;
      const nbBits = accuracyLog - highBitPos(nextState);
      entries[u].nbBits = nbBits;
      entries[u].baseline = OpCodes.Shl32(nextState, nbBits) - tableSize;
    }

    return { accuracyLog, entries };
  }

  // RLE distribution mode: a degenerate one-state table whose sole state
  // always resolves to `symbol` and never consumes bits.
  function buildRleFseTable(symbol) {
    return { accuracyLog: 0, entries: [{ symbol, nbBits: 0, baseline: 0 }] };
  }

  // FSE table description (RFC 8878 4.1.1): reads Accuracy_Log then a
  // normalized-count list, forward, from a byte-aligned start.
  function readNCount(cur, maxSymbolValue) {
    const accuracyLog = cur.readBits(4) + 5;
    if (accuracyLog < 5 || accuracyLog > 15) throw new Error('Zstd: invalid FSE accuracy log');

    let remaining = OpCodes.Shl32(1, accuracyLog) + 1;
    let threshold = OpCodes.Shl32(1, accuracyLog);
    let nbBits = accuracyLog + 1;
    let charnum = 0;
    let previous0 = false;
    const maxSV1 = maxSymbolValue + 1;
    const counts = new Array(maxSymbolValue + 1).fill(0);

    for (;;) {
      if (previous0) {
        let n0 = charnum;
        for (;;) {
          const v2 = cur.readBits(2);
          n0 += v2;
          if (v2 !== 3) break;
        }
        while (charnum < n0) counts[charnum++] = 0;
        if (charnum >= maxSV1) break;
        previous0 = false;
      }

      const max = 2 * threshold - 1 - remaining;
      const low = cur.peekBits(nbBits - 1);
      let count;
      if (low < max) {
        count = low;
        cur.readBits(nbBits - 1);
      } else {
        const full = cur.peekBits(nbBits);
        count = full >= threshold ? full - max : full;
        cur.readBits(nbBits);
      }
      count -= 1;
      if (count >= 0) remaining -= count; else remaining += count;
      counts[charnum++] = count;
      previous0 = (count === 0);

      if (remaining < threshold) {
        if (remaining <= 1) break;
        while (remaining < threshold) { nbBits--; threshold = Math.floor(threshold / 2); }
      }
      if (charnum >= maxSV1) break;
    }

    if (remaining !== 1) throw new Error('Zstd: corrupt FSE table description');
    if (charnum > maxSV1) throw new Error('Zstd: FSE table has too many symbols');

    return { accuracyLog, counts, maxSymbol: charnum - 1 };
  }

  // Decode a symbol stream from an interleaved 2-state generic FSE bitstream
  // (RFC 8878 4.2.1.2 — used only for FSE-compressed Huffman weight lists).
  // Mirrors libzstd's FSE_decompress_usingDTable_generic tail loop: keep
  // decoding+updating both states until the bitstream is exhausted (treating
  // any shortfall as zero-padding), then take one final symbol from each.
  // Mirrors libzstd's FSE_decodeSymbol: read the CURRENT state's symbol from
  // the table, then unconditionally consume nbBits and advance the state —
  // the read and the update are one inseparable step, every time (including
  // for the "final" symbol of each state; only whether we take ANOTHER step
  // afterwards is conditional on the bitstream being exhausted).
  function fseDecodeSymbol(cur, table, s) {
    const info = table.entries[s.state];
    const lowBits = info.nbBits > 0 ? cur.readBits(info.nbBits) : 0;
    s.state = info.baseline + lowBits;
    return info.symbol;
  }

  function decodeFseInterleaved2(cur, table, maxCount) {
    const s1 = { state: cur.readBits(table.accuracyLog) };
    const s2 = { state: cur.readBits(table.accuracyLog) };
    const out = [];
    for (;;) {
      if (out.length >= maxCount) break;
      out.push(fseDecodeSymbol(cur, table, s1));
      if (cur.cursor < 0) { out.push(fseDecodeSymbol(cur, table, s2)); break; }

      if (out.length >= maxCount) break;
      out.push(fseDecodeSymbol(cur, table, s2));
      if (cur.cursor < 0) { out.push(fseDecodeSymbol(cur, table, s1)); break; }
    }
    return out;
  }

  // ===== HUFFMAN TABLE CONSTRUCTION (RFC 8878 4.2) =====

  // Build a direct-lookup decode table from a weight list: table[window] =
  // {symbol, nbBits}, where `window` is the maxBits-wide value obtained by
  // peeking the next maxBits bits (RFC 8878 4.2.1.3 canonical assignment,
  // matching libzstd's HUF_fillDTableX1 cumulative-slot construction).
  function buildHuffmanTable(weights) {
    const numSymbols = weights.length;

    // Max_Number_of_Bits (tree depth) is NOT the largest individual weight —
    // it is derived from the Kraft-equality weight total over the COMPLETE
    // weight list (including the implied last symbol, already resolved by
    // the caller): weightTotal = sum(2^(w-1)) over all symbols with w>0.
    // For a valid, complete canonical tree this is exactly 2^maxBits, so
    // maxBits is just its highest set bit position (no +1 here — that +1
    // only applies when summing a PARTIAL list that excludes one symbol,
    // as done while resolving the implied last weight in
    // readHuffmanTreeDescription).
    let weightTotal = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (weights[i] > 0) weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, weights[i]), 1);
    }
    if (weightTotal === 0) throw new Error('Zstd: invalid Huffman tree (no symbols)');
    const maxBits = highBitPos(weightTotal);
    if (maxBits > HUF_MAX_BITS) throw new Error('Zstd: invalid Huffman tree (too deep)');
    if (OpCodes.Shl32(1, maxBits) !== weightTotal) throw new Error('Zstd: invalid Huffman tree (weights do not sum to a power of 2)');

    const rankCount = new Array(maxBits + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i) rankCount[weights[i]]++;

    const rankStart = new Array(maxBits + 2).fill(0);
    { let next = 0; for (let w = 0; w <= maxBits; ++w) { rankStart[w] = next; next += rankCount[w]; } }

    const symbolsByRank = new Array(numSymbols);
    { const cursor = rankStart.slice();
      for (let sym = 0; sym < numSymbols; ++sym) { const w = weights[sym]; symbolsByRank[cursor[w]++] = sym; } }

    const tableSize = OpCodes.Shl32(1, maxBits);
    const table = new Array(tableSize);
    let symbolIdx = rankCount[0];
    let pos = 0;
    for (let w = 1; w <= maxBits; ++w) {
      const count = rankCount[w];
      const length = OpCodes.Shl32(1, w - 1);
      const nbBits = maxBits + 1 - w;
      for (let s = 0; s < count; ++s) {
        const sym = symbolsByRank[symbolIdx + s];
        for (let k = 0; k < length; ++k) table[pos + k] = { symbol: sym, nbBits };
        pos += length;
      }
      symbolIdx += count;
    }

    return { maxBits, table };
  }

  // RFC 8878 4.2.1.1 / 4.2.1.2: parse the Huffman_Tree_Description and return
  // the weight list plus the number of header bytes consumed.
  function readHuffmanTreeDescription(bytes, offset) {
    const headerByte = bytes[offset];
    if (headerByte >= 128) {
      const numSymbols = headerByte - 127;
      const weights = new Array(numSymbols);
      for (let i = 0; i < numSymbols; ++i) {
        const b = bytes[offset + 1 + Math.floor(i / 2)];
        weights[i] = (i % 2 === 0) ? OpCodes.Shr32(b, 4) : OpCodes.And32(b, 0xF);
      }
      const numBytes = Math.ceil(numSymbols / 2);
      return { weights, bytesUsed: 1 + numBytes };
    }

    const fseSize = headerByte;
    const fseBase = offset + 1;
    const cur = new FwdBitCursor(bytes, fseBase);
    const nc = readNCount(cur, HUF_WEIGHTS_MAX_ACCLOG > 0 ? 255 : 255);
    const table = buildFseTable(nc.counts, nc.maxSymbol, nc.accuracyLog);
    const streamStart = fseBase + cur.byteLength();
    const streamEnd = fseBase + fseSize;
    const bwd = new BwdBitCursor(bytes, streamStart, streamEnd);
    const decoded = decodeFseInterleaved2(bwd, table, 255);

    // Last symbol's weight is implied: complete the power-of-2 sum.
    let weightTotal = 0;
    for (let i = 0; i < decoded.length; ++i) weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, decoded[i]), 1);
    if (weightTotal === 0) throw new Error('Zstd: corrupt Huffman weight stream');
    const tableLog = highBitPos(weightTotal) + 1;
    const total = OpCodes.Shl32(1, tableLog);
    const rest = total - weightTotal;
    const lastWeight = highBitPos(rest) + 1;
    if (OpCodes.Shl32(1, highBitPos(rest)) !== rest) throw new Error('Zstd: corrupt Huffman weight stream (bad last weight)');

    const weights = decoded.slice();
    weights.push(lastWeight);
    return { weights, bytesUsed: 1 + fseSize };
  }

  // Decode exactly `count` symbols from a single Huffman-coded stream.
  function decodeHuffmanStream(bytes, start, end, huf, count) {
    const cur = new BwdBitCursor(bytes, start, end);
    const out = new Array(count);
    const mask = huf.table.length - 1;
    for (let i = 0; i < count; ++i) {
      const window = OpCodes.And32(cur.peekBits(huf.maxBits), mask);
      const entry = huf.table[window];
      out[i] = entry.symbol;
      cur.readBits(entry.nbBits);
    }
    return out;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZstdCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zstandard";
      this.description = "Zstandard (Zstd), RFC 8878. Encodes standard-compliant frames using Raw/RLE blocks; decodes full frames produced by real Zstd encoders, including Huffman-coded literals (raw/RLE/compressed/treeless) and FSE-coded sequences (predefined/RLE/FSE-compressed/repeat distribution tables) with repeat-offset resolution.";
      this.inventor = "Yann Collet";
      this.year = 2016;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + Entropy";
      this.securityStatus = null; // Not a security primitive
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 8878: Zstandard Compression and the 'application/zstd' Media Type", "https://www.rfc-editor.org/rfc/rfc8878"),
        new LinkItem("Official Zstd Repository", "https://github.com/facebook/zstd"),
        new LinkItem("Zstd Format Specification", "https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md"),
        new LinkItem("FSE Documentation", "https://github.com/Cyan4973/FiniteStateEntropy")
      ];

      this.references = [
        new LinkItem("Facebook Zstd", "https://github.com/facebook/zstd"),
        new LinkItem("RFC 8878 Full Text", "https://www.rfc-editor.org/rfc/rfc8878.txt"),
        new LinkItem("Finite State Entropy", "https://github.com/Cyan4973/FiniteStateEntropy"),
        new LinkItem("LZ4 (by same author)", "https://github.com/lz4/lz4")
      ];

      // Test vectors: the encoder emits Raw/RLE-only frames (byte-exact,
      // self-consistent), verified byte-for-byte against RFC 8878's frame and
      // block header layout. Round-trip-only cases exercise multi-block
      // splitting. Interoperability with real Zstd encoders/decoders
      // (Node's zlib.zstdCompressSync/zstdDecompressSync) is verified
      // separately, since TestCase vectors here must be self-contained.
      this.tests = [
        // Test 1: Simple uncompressed frame (Raw block)
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          // Raw block frame: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3) + Data(5)
          // Magic: 0xFD2FB528 (LE) = 28 B5 2F FD
          // Descriptor: 0x20 (Single_Segment=1, Content_Size_Flag=0)
          // Content Size: 5 (for "hello")
          // Block Header: Size=5 shifted 3 bits, OR Type=Raw shifted 1 bit, OR Last=1 = 0x29 = 29 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD200529000068656C6C6F"),
          "Self-consistent - Raw block, short input",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 2: RLE block frame
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAA"),
          // RLE block: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3) + RepeatedByte(1)
          // Content Size: 10 (ten 'A's)
          // Block Header: Size=10 shifted 3 bits, OR Type=RLE shifted 1 bit, OR Last=1 = 0x53 = 53 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD200A53000041"),
          "Self-consistent - RLE block, repeated byte",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 3: Empty frame
        new TestCase(
          [],
          // Empty frame: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3)
          // Content Size: 0
          // Block Header: Size=0 shifted 3 bits, OR Type=Raw shifted 1 bit, OR Last=1 = 0x01 = 01 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD2000010000"),
          "Self-consistent - Empty frame",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 4: >=256 bytes, exercises the 2-byte content-size-flag path and a
        // non-repetitive payload (raw block).
        new TestCase(
          (() => {
            let seed = 0x2468ACE0, a = [];
            for (let i = 0; i < 300; ++i) { seed = OpCodes.AndN(seed * 1103515245 + 12345, 0x7fffffff); a.push(OpCodes.AndN(seed, 0xFF)); }
            return a;
          })(),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 300 bytes pseudo-random (2-byte content size)",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 5: >MAX_BLOCK_SIZE (128 KiB), non-repetitive - exercises multi-block
        // splitting with the 4-byte content-size-flag path.
        new TestCase(
          (() => {
            const a = new Array(200000);
            for (let i = 0; i < 200000; ++i) a[i] = OpCodes.AndN(i * 37 + 11, 0xFF);
            return a;
          })(),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 200000 bytes pseudo-random, spans multiple blocks",
          "https://www.rfc-editor.org/rfc/rfc8878"
        ),
        // Test 6: >MAX_BLOCK_SIZE, fully repetitive - exercises multi-block RLE
        // splitting, where only the final block sets Last_Block.
        new TestCase(
          new Array(150000).fill(0x61),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 150000 repeated bytes, spans multiple RLE blocks",
          "https://www.rfc-editor.org/rfc/rfc8878"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ZstdInstance(this, isInverse);
    }
  }

  // ===== ZSTD DECOMPRESSION IMPLEMENTATION =====

  /**
 * Zstd cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZstdInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          return [];
        }
        return this._decompress();
      } else {
        // Compression: even empty input should produce a valid frame
        return this._compress();
      }
    }

    // ===== DECOMPRESSION (Production Quality) =====

    _decompress() {
      try {
        const reader = new BitReader(this.inputBuffer);
        const result = [];

        // Read and validate magic number
        const magic = reader.readU32LE();

        if (magic === ZSTD_MAGIC_NUMBER) {
          // Standard Zstd frame
          const frame = this._decodeFrame(reader);
          for (let _i = 0; _i < frame.length; _i++) result.push(frame[_i]);
        } else if (OpCodes.AndN(magic, ZSTD_MAGIC_SKIPPABLE_MASK) === ZSTD_MAGIC_SKIPPABLE_START) {
          // Skippable frame - read size and skip
          const frameSize = reader.readU32LE();
          reader.skipBytes(frameSize);
        } else {
          throw new Error(`Invalid Zstd magic number: 0x${magic.toString(16)}`);
        }

        this.inputBuffer = [];
        return result;
      } catch (e) {
        this.inputBuffer = [];
        throw new Error(`Zstd decompression failed: ${e.message}`);
      }
    }

    _decodeFrame(reader) {
      // Read frame header descriptor
      const descriptor = reader.readU8();

      const frameContentSizeFlag = OpCodes.AndN(OpCodes.Shr32(descriptor, 6), 3);
      const singleSegmentFlag = OpCodes.AndN(OpCodes.Shr32(descriptor, 5), 1);
      const checksumFlag = OpCodes.AndN(OpCodes.Shr32(descriptor, 2), 1);
      const dictIdFlag = OpCodes.AndN(descriptor, 3);

      // Read window descriptor (if not single segment)
      let windowSize = 0;
      if (!singleSegmentFlag) {
        const windowDescriptor = reader.readU8();
        const exponent = OpCodes.Shr32(windowDescriptor, 3);
        const mantissa = OpCodes.AndN(windowDescriptor, 7);
        const windowLog = MIN_WINDOW_LOG + exponent;
        const windowBase = OpCodes.Shl32(1, windowLog);
        windowSize = windowBase + OpCodes.Shr32(windowBase, 3) * mantissa;
      }

      // Read dictionary ID if present
      if (dictIdFlag) {
        const dictIdSize = [0, 1, 2, 4][dictIdFlag];
        reader.skipBytes(dictIdSize);
      }

      // Read frame content size if present
      let frameContentSize = 0;
      if (singleSegmentFlag || frameContentSizeFlag) {
        let sizeBytes;
        if (singleSegmentFlag) {
          // Single segment: size bytes determined by frameContentSizeFlag
          sizeBytes = frameContentSizeFlag === 0 ? 1 : [1, 2, 4, 8][frameContentSizeFlag];
        } else {
          // Multi-segment: size bytes from frameContentSizeFlag
          sizeBytes = [1, 2, 4, 8][frameContentSizeFlag];
        }

        if (sizeBytes === 1) {
          frameContentSize = reader.readU8();
        } else if (sizeBytes === 2) {
          frameContentSize = reader.readU16LE() + 256;
        } else if (sizeBytes === 4) {
          frameContentSize = reader.readU32LE();
        } else if (sizeBytes === 8) {
          const low = reader.readU32LE();
          const high = reader.readU32LE();
          frameContentSize = low + high * 0x100000000;
        }
      }

      // Per-frame decode state: recent-offsets history, previous Huffman
      // tree (for Treeless_Literals_Block) and previous FSE tables (for
      // Repeat_Mode) all persist across blocks within a frame.
      const state = {
        repOffsets: [1, 4, 8],
        huffTable: null,
        llTable: null,
        ofTable: null,
        mlTable: null
      };

      // Decode blocks
      const decoded = [];
      let lastBlock = false;

      while (!lastBlock) {
        const blockHeader = reader.readU24LE();
        lastBlock = OpCodes.AndN(blockHeader, 1) !== 0;
        const blockType = OpCodes.AndN(OpCodes.Shr32(blockHeader, 1), 3);
        const blockSize = OpCodes.Shr32(blockHeader, 3);

        if (blockSize > MAX_BLOCK_SIZE) {
          throw new Error(`Block size ${blockSize} exceeds maximum ${MAX_BLOCK_SIZE}`);
        }

        // Every block type pushes its bytes directly onto `decoded`, which
        // spans the WHOLE frame: Compressed_Block back-references (matches)
        // must be able to reach into data decoded by earlier blocks in the
        // same frame (RFC 8878 3.1.1.3: "Previous decoded data, up to a
        // distance of Window_Size, or the beginning of the Frame"), so the
        // sequence executor is given the real, growing output buffer rather
        // than a fresh array per block.
        this._decodeBlock(reader, blockType, blockSize, state, decoded);
      }

      // Skip checksum if present
      if (checksumFlag) {
        reader.skipBytes(4);
      }

      return decoded;
    }

    _decodeBlock(reader, blockType, blockSize, state, decoded) {
      switch (blockType) {
        case BLOCK_TYPE_RAW: {
          // Raw uncompressed block
          const bytes = reader.readBytes(blockSize);
          for (let _i = 0; _i < bytes.length; ++_i) decoded.push(bytes[_i]);
          return;
        }

        case BLOCK_TYPE_RLE: {
          // RLE block - single byte repeated blockSize times
          const byte = reader.readU8();
          for (let _i = 0; _i < blockSize; ++_i) decoded.push(byte);
          return;
        }

        case BLOCK_TYPE_COMPRESSED:
          // Compressed block - full Zstd entropy decoding
          this._decodeCompressedBlock(reader, blockSize, state, decoded);
          return;

        case BLOCK_TYPE_RESERVED:
          throw new Error('Reserved block type encountered');

        default:
          throw new Error(`Unknown block type: ${blockType}`);
      }
    }

    // Full RFC 8878 3.1.1.3 Compressed_Block decode: Literals_Section +
    // Sequences_Section, combined via Sequence Execution (3.1.1.4).
    _decodeCompressedBlock(reader, blockSize, state, decoded) {
      const bytes = reader.data;
      const blockStart = reader.pos;
      const blockEnd = blockStart + blockSize;

      const lit = this._decodeLiteralsSection(bytes, blockStart, blockEnd, state);
      const seqSectionStart = lit.contentEnd;

      this._decodeSequencesSection(bytes, seqSectionStart, blockEnd, lit.literals, state, decoded);

      reader.pos = blockEnd;
    }

    // RFC 8878 3.1.1.3.1: Literals_Section_Header, [Huffman_Tree_Description],
    // [Jump_Table], Stream_1..4.
    _decodeLiteralsSection(bytes, pos, blockEnd, state) {
      const b0 = bytes[pos];
      const blockType = OpCodes.And32(b0, 3);
      const sizeFormat = OpCodes.And32(OpCodes.Shr32(b0, 2), 3);

      let regenSize, compSize = -1, headerBytes, streamCount = 1;

      if (blockType === 0 || blockType === 1) {
        // Raw_Literals_Block / RLE_Literals_Block
        if (sizeFormat === 0 || sizeFormat === 2) {
          regenSize = Math.floor(b0 / 8);
          headerBytes = 1;
        } else if (sizeFormat === 1) {
          regenSize = Math.floor(b0 / 16) + bytes[pos + 1] * 16;
          headerBytes = 2;
        } else {
          regenSize = Math.floor(b0 / 16) + bytes[pos + 1] * 16 + bytes[pos + 2] * 4096;
          headerBytes = 3;
        }
      } else {
        // Compressed_Literals_Block / Treeless_Literals_Block
        if (sizeFormat === 0 || sizeFormat === 1) {
          const raw = b0 + bytes[pos + 1] * 256 + bytes[pos + 2] * 65536;
          regenSize = Math.floor(raw / 16) % 1024;
          compSize = Math.floor(raw / 16384) % 1024;
          headerBytes = 3;
          streamCount = sizeFormat === 0 ? 1 : 4;
        } else if (sizeFormat === 2) {
          const raw = b0 + bytes[pos + 1] * 256 + bytes[pos + 2] * 65536 + bytes[pos + 3] * 16777216;
          regenSize = Math.floor(raw / 16) % 16384;
          compSize = Math.floor(raw / 262144) % 16384;
          headerBytes = 4;
          streamCount = 4;
        } else {
          const raw = b0 + bytes[pos + 1] * 256 + bytes[pos + 2] * 65536 + bytes[pos + 3] * 16777216 + bytes[pos + 4] * 4294967296;
          regenSize = Math.floor(raw / 16) % 262144;
          compSize = Math.floor(raw / 4194304) % 262144;
          headerBytes = 5;
          streamCount = 4;
        }
      }

      let contentStart = pos + headerBytes;
      let literals;

      if (blockType === 0) {
        // Raw
        literals = bytes.slice(contentStart, contentStart + regenSize);
        return { literals, contentEnd: contentStart + regenSize };
      }
      if (blockType === 1) {
        // RLE
        literals = new Array(regenSize).fill(bytes[contentStart]);
        return { literals, contentEnd: contentStart + 1 };
      }

      // Compressed / Treeless
      let huf;
      if (blockType === 2) {
        const desc = readHuffmanTreeDescription(bytes, contentStart);
        huf = buildHuffmanTable(desc.weights);
        state.huffTable = huf;
        contentStart += desc.bytesUsed;
      } else {
        if (!state.huffTable) throw new Error('Zstd: Treeless_Literals_Block without a previous Huffman table');
        huf = state.huffTable;
      }

      const contentEnd = pos + headerBytes + compSize;

      if (streamCount === 1) {
        literals = decodeHuffmanStream(bytes, contentStart, contentEnd, huf, regenSize);
      } else {
        const s1 = bytes[contentStart] + bytes[contentStart + 1] * 256;
        const s2 = bytes[contentStart + 2] + bytes[contentStart + 3] * 256;
        const s3 = bytes[contentStart + 4] + bytes[contentStart + 5] * 256;
        const jumpTableEnd = contentStart + 6;
        // `totalStreamsSize` here is bytes AFTER the jump table (contentEnd -
        // jumpTableEnd), i.e. it already equals RFC 8878's
        // "Total_Streams_Size - 6" (Total_Streams_Size there includes the
        // 6-byte Jump_Table itself) — so no further "-6" is needed here.
        const totalStreamsSize = contentEnd - jumpTableEnd;
        const s4 = totalStreamsSize - s1 - s2 - s3;
        if (s4 < 0) throw new Error('Zstd: corrupt literals Jump_Table');

        const perStream = Math.floor((regenSize + 3) / 4);
        const sizes = [s1, s2, s3, s4];
        const counts = [perStream, perStream, perStream, regenSize - perStream * 3];
        literals = [];
        let sp = jumpTableEnd;
        for (let i = 0; i < 4; ++i) {
          const decoded = decodeHuffmanStream(bytes, sp, sp + sizes[i], huf, counts[i]);
          for (let k = 0; k < decoded.length; ++k) literals.push(decoded[k]);
          sp += sizes[i];
        }
      }

      return { literals, contentEnd };
    }

    // RFC 8878 3.1.1.3.2 Sequences_Section + 3.1.1.4 Sequence Execution.
    // `decoded` is the FULL frame output accumulated so far (shared across
    // blocks) — matches are appended to it directly so back-references can
    // reach data decoded by earlier blocks in the same frame.
    _decodeSequencesSection(bytes, pos, blockEnd, literals, state, decoded) {
      const byte0 = bytes[pos];
      let nbSeq, headerBytes;
      if (byte0 === 0) {
        for (let _i = 0; _i < literals.length; ++_i) decoded.push(literals[_i]);
        return;
      } else if (byte0 < 128) {
        nbSeq = byte0; headerBytes = 1;
      } else if (byte0 < 255) {
        nbSeq = (byte0 - 128) * 256 + bytes[pos + 1]; headerBytes = 2;
      } else {
        nbSeq = bytes[pos + 1] + bytes[pos + 2] * 256 + 0x7F00; headerBytes = 3;
      }

      const modesByte = bytes[pos + headerBytes];
      const llMode = OpCodes.And32(OpCodes.Shr32(modesByte, 6), 3);
      const ofMode = OpCodes.And32(OpCodes.Shr32(modesByte, 4), 3);
      const mlMode = OpCodes.And32(OpCodes.Shr32(modesByte, 2), 3);

      let tp = pos + headerBytes + 1;
      const resolve = (mode, defNorm, defAccLog, maxSym, prevTable) => {
        if (mode === 0) return buildFseTable(defNorm, defNorm.length - 1, defAccLog);
        if (mode === 1) { const s = bytes[tp]; tp += 1; return buildRleFseTable(s); }
        if (mode === 2) {
          const cur = new FwdBitCursor(bytes, tp);
          const nc = readNCount(cur, maxSym);
          tp += cur.byteLength();
          return buildFseTable(nc.counts, nc.maxSymbol, nc.accuracyLog);
        }
        if (!prevTable) throw new Error('Zstd: Repeat_Mode without a previous table');
        return prevTable;
      };

      const llTable = resolve(llMode, LL_DEFAULT_NORM, LL_DEFAULT_ACCLOG, 35, state.llTable);
      const ofTable = resolve(ofMode, OF_DEFAULT_NORM, OF_DEFAULT_ACCLOG, 31, state.ofTable);
      const mlTable = resolve(mlMode, ML_DEFAULT_NORM, ML_DEFAULT_ACCLOG, 52, state.mlTable);
      state.llTable = llTable; state.ofTable = ofTable; state.mlTable = mlTable;

      const cur = new BwdBitCursor(bytes, tp, blockEnd);
      let stateLL = cur.readBits(llTable.accuracyLog);
      let stateOF = cur.readBits(ofTable.accuracyLog);
      let stateML = cur.readBits(mlTable.accuracyLog);

      const rep = state.repOffsets;
      const output = decoded;
      let litPos = 0;

      for (let i = 0; i < nbSeq; ++i) {
        const llCode = llTable.entries[stateLL].symbol;
        const ofCode = ofTable.entries[stateOF].symbol;
        const mlCode = mlTable.entries[stateML].symbol;

        // Resolve offset first (needs only the LL *code*, RFC 8878 3.1.1.3.2.1.2 / 3.1.1.5)
        let offset;
        if (ofCode >= 2) {
          const extra = cur.readBits(ofCode);
          const offsetValue = Math.pow(2, ofCode) + extra;
          offset = offsetValue - 3;
          rep[2] = rep[1]; rep[1] = rep[0]; rep[0] = offset;
        } else if (ofCode === 1) {
          const ll0 = (llCode === 0) ? 1 : 0;
          const extra = cur.readBits(1);
          const selector = 1 + ll0 + extra;
          let temp;
          if (selector === 1) temp = rep[1];
          else if (selector === 3) temp = rep[0] - 1;
          else temp = rep[2];
          if (temp === 0) temp = -1;
          const newRep2 = (selector === 1) ? rep[2] : rep[1];
          offset = temp;
          rep[2] = newRep2; rep[1] = rep[0]; rep[0] = temp;
        } else {
          const ll0 = (llCode === 0);
          if (ll0) {
            offset = rep[1];
            rep[1] = rep[0]; rep[0] = offset; // rep[2] unchanged
          } else {
            offset = rep[0]; // no change
          }
        }

        const mlExtraBits = ML_EXTRABITS[mlCode];
        const mlExtra = mlExtraBits > 0 ? cur.readBits(mlExtraBits) : 0;
        const matchLength = ML_BASELINE[mlCode] + mlExtra;

        const llExtraBits = LL_EXTRABITS[llCode];
        const llExtra = llExtraBits > 0 ? cur.readBits(llExtraBits) : 0;
        const literalsLength = LL_BASELINE[llCode] + llExtra;

        for (let k = 0; k < literalsLength; ++k) output.push(literals[litPos++]);
        for (let k = 0; k < matchLength; ++k) output.push(output[output.length - offset]);

        if (i < nbSeq - 1) {
          { const e = llTable.entries[stateLL]; stateLL = e.baseline + (e.nbBits > 0 ? cur.readBits(e.nbBits) : 0); }
          { const e = mlTable.entries[stateML]; stateML = e.baseline + (e.nbBits > 0 ? cur.readBits(e.nbBits) : 0); }
          { const e = ofTable.entries[stateOF]; stateOF = e.baseline + (e.nbBits > 0 ? cur.readBits(e.nbBits) : 0); }
        }
      }

      while (litPos < literals.length) output.push(literals[litPos++]);
    }

    // ===== COMPRESSION (RFC 8878-compliant Raw/RLE framing) =====

    _compress() {
      const data = [...this.inputBuffer];
      const result = [];
      const len = data.length;

      // Magic number (little-endian)
      const [b0, b1, b2, b3] = OpCodes.Unpack32LE(ZSTD_MAGIC_NUMBER);
      result.push(b0, b1, b2, b3);

      // Frame header descriptor + content size (Single_Segment_Flag=1).
      // The Content_Size_Flag (descriptor bits 7-6) MUST reflect how many size
      // bytes are actually written, per RFC 8878 §3.1.1.1.1 - decided up front
      // from the real data length, not patched in afterwards.
      let sizeFlag, sizeBytes;
      if (len < 256) {
        sizeFlag = 0;
        sizeBytes = [len];
      } else if (len <= 256 + 0xFFFF) {
        sizeFlag = 1;
        const v = len - 256;
        sizeBytes = [OpCodes.AndN(v, 0xFF), OpCodes.AndN(OpCodes.Shr32(v, 8), 0xFF)];
      } else if (len <= 0xFFFFFFFF) {
        sizeFlag = 2;
        sizeBytes = OpCodes.Unpack32LE(len);
      } else {
        sizeFlag = 3;
        const high = Math.floor(len / 0x100000000);
        const low = len - high * 0x100000000;
        sizeBytes = OpCodes.Unpack32LE(low).concat(OpCodes.Unpack32LE(high));
      }

      const descriptor = OpCodes.OrN(OpCodes.Shl32(sizeFlag, 6), 0x20); // Single_Segment=1
      result.push(descriptor);
      for (let _i = 0; _i < sizeBytes.length; _i++) result.push(sizeBytes[_i]);

      if (len === 0) {
        // Empty frame - just header + empty block
        const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(0, 3), OpCodes.Shl32(BLOCK_TYPE_RAW, 1)), 1); // Last block, raw, size=0
        result.push(OpCodes.AndN(blockHeader, 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));

        this.inputBuffer = [];
        return result;
      }

      // Split into blocks no larger than MAX_BLOCK_SIZE; only the final block
      // sets Last_Block. Each block independently picks RLE (fully repetitive
      // chunk) or raw.
      let offset = 0;
      while (offset < len) {
        const chunkSize = Math.min(MAX_BLOCK_SIZE, len - offset);
        const chunk = data.slice(offset, offset + chunkSize);
        const isLast = (offset + chunkSize === len) ? 1 : 0;
        const isRepetitive = this._isRepetitive(chunk);

        if (isRepetitive && chunk.length > 1) {
          // RLE block
          const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(chunk.length, 3), OpCodes.Shl32(BLOCK_TYPE_RLE, 1)), isLast);
          result.push(OpCodes.AndN(blockHeader, 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));
          result.push(chunk[0]); // The repeated byte
        } else {
          // Raw block
          const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(chunk.length, 3), OpCodes.Shl32(BLOCK_TYPE_RAW, 1)), isLast);
          result.push(OpCodes.AndN(blockHeader, 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));
          for (let _i = 0; _i < chunk.length; _i++) result.push(chunk[_i]);
        }

        offset += chunkSize;
      }

      this.inputBuffer = [];
      return result;
    }

    _isRepetitive(data) {
      if (data.length === 0) return false;
      const first = data[0];
      for (let i = 1; i < data.length; ++i) {
        if (data[i] !== first) return false;
      }
      return true;
    }
  }

  // ===== BIT READER UTILITY =====

  class BitReader {
    constructor(data) {
      this.data = data;
      this.pos = 0;
    }

    readU8() {
      if (this.pos >= this.data.length) {
        throw new Error('Unexpected end of data');
      }
      return this.data[this.pos++];
    }

    readU16LE() {
      const b0 = this.readU8();
      const b1 = this.readU8();
      return OpCodes.Pack16LE(b0, b1);
    }

    readU24LE() {
      const b0 = this.readU8();
      const b1 = this.readU8();
      const b2 = this.readU8();
      return OpCodes.OrN(OpCodes.OrN(b0, OpCodes.Shl32(b1, 8)), OpCodes.Shl32(b2, 16));
    }

    readU32LE() {
      const b0 = this.readU8();
      const b1 = this.readU8();
      const b2 = this.readU8();
      const b3 = this.readU8();
      return OpCodes.Pack32LE(b0, b1, b2, b3);
    }

    readBytes(count) {
      if (this.pos + count > this.data.length) {
        throw new Error('Unexpected end of data');
      }
      const result = this.data.slice(this.pos, this.pos + count);
      this.pos += count;
      return result;
    }

    skipBytes(count) {
      if (this.pos + count > this.data.length) {
        throw new Error('Unexpected end of data');
      }
      this.pos += count;
    }

    hasMore() {
      return this.pos < this.data.length;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZstdCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZstdCompression, ZstdInstance };
}));
