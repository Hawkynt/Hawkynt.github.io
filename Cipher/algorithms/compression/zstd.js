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

  // ===== ENCODER SUPPORT: BIT WRITER, FSE/HUFFMAN ENCODE, LZ77 MATCHER =====
  //
  // Builds genuine Compressed_Block output: an LZ77 hash-chain match finder
  // feeding FSE-coded sequences (Predefined_Mode tables only - RFC 8878
  // 3.1.1.3.2.1.1 Table 20, no table transmission needed) and a length-limited
  // Huffman code for the literals section (direct weight description only,
  // RFC 8878 4.2.1.1). All three encoders share the same trick: RFC 8878's
  // Huffman/FSE bitstreams are read *backward* (BwdBitCursor above, "first bit
  // added is last bit read"); the mirror-image encoding technique is to
  // process symbols in REVERSE output order, feeding each one's bits directly
  // (no separate reversal pass needed) into a plain forward-growing bit
  // writer - this exact call order/bit-layout combination was verified
  // independently (encode->our BwdBitCursor-based decode round trip) before
  // being wired in here.

  // Forward-growing ("low bit first") bit writer: bit 0 of the first value
  // written lands at absolute bit 0, later values are appended at increasing
  // bit positions - the mirror of getBitsLE's reading convention, matching
  // libzstd's BIT_addBits/BIT_flushBits (which RFC 8878's backward-reading
  // bitstreams are defined against). FSE state values and Huffman codes stay
  // small (well under 2^20), but the running accumulator can transiently need
  // more than 32 bits of headroom, so - like the "large literals-header"
  // fields noted above - this uses plain multiply/divide/modulo rather than
  // OpCodes' 32-bit-truncating shifts.
  class LowBitWriter {
    constructor() { this.bytes = []; this.acc = 0; this.bitPos = 0; }
    addBits(value, nbBits) {
      if (nbBits === 0) return;
      this.acc += value * Math.pow(2, this.bitPos);
      this.bitPos += nbBits;
      while (this.bitPos >= 8) {
        this.bytes.push(this.acc % 256);
        this.acc = Math.floor(this.acc / 256);
        this.bitPos -= 8;
      }
    }
    finish() {
      if (this.bitPos > 0) this.bytes.push(this.acc % 256);
      return this.bytes;
    }
  }

  // ----- FSE encode table (mirrors libzstd's FSE_buildCTable: RFC 8878 4.1's
  // spread/position assignment run twice - once to place symbols, once to
  // derive the per-symbol (deltaNbBits, deltaFindState) transform used by
  // FSE_encodeSymbol) -----
  function buildFseEncodeTable(normCounts, maxSymbolValue, accuracyLog) {
    const tableSize = OpCodes.Shl32(1, accuracyLog);
    const spread = new Array(tableSize);
    let highThreshold = tableSize - 1;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      if (normCounts[s] === -1) { spread[highThreshold] = s; highThreshold--; }
    }
    const tableMask = tableSize - 1;
    const step = OpCodes.Add32(OpCodes.Add32(OpCodes.Shr32(tableSize, 1), OpCodes.Shr32(tableSize, 3)), 3);
    let position = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) {
      const freq = normCounts[s] > 0 ? normCounts[s] : 0;
      for (let i = 0; i < freq; ++i) {
        spread[position] = s;
        position = OpCodes.And32(position + step, tableMask);
        while (position > highThreshold) position = OpCodes.And32(position + step, tableMask);
      }
    }

    const cumul = new Array(maxSymbolValue + 2).fill(0);
    {
      let total = 0;
      for (let s = 0; s <= maxSymbolValue; ++s) {
        cumul[s] = total;
        const c = normCounts[s];
        total += (c === -1 || c === 1) ? 1 : (c > 0 ? c : 0);
      }
      cumul[maxSymbolValue + 1] = total;
    }

    const stateTable = new Array(tableSize);
    const localCumul = cumul.slice();
    for (let u = 0; u < tableSize; ++u) {
      const s = spread[u];
      stateTable[localCumul[s]++] = tableSize + u;
    }

    const symbolTT = new Array(maxSymbolValue + 1);
    for (let s = 0; s <= maxSymbolValue; ++s) {
      const c = normCounts[s];
      if (c === 0) {
        symbolTT[s] = { deltaNbBits: OpCodes.Shl32(accuracyLog + 1, 16) - tableSize, deltaFindState: 0 };
      } else if (c === -1 || c === 1) {
        symbolTT[s] = { deltaNbBits: OpCodes.Shl32(accuracyLog, 16) - tableSize, deltaFindState: cumul[s] - 1 };
      } else {
        const maxBitsOut = accuracyLog - highBitPos(c - 1);
        const minStatePlus = OpCodes.Shl32(c, maxBitsOut);
        symbolTT[s] = { deltaNbBits: OpCodes.Shl32(maxBitsOut, 16) - minStatePlus, deltaFindState: cumul[s] - c };
      }
    }

    return { accuracyLog, tableSize, stateTable, symbolTT };
  }

  // FSE_initCState2: seeds a state directly from the LAST symbol of a run
  // (no bits produced - this becomes the accuracyLog-bit value written by
  // the FINAL flush, which decode reads FIRST as its initial state).
  function fseInitCState2(ct, symbol) {
    const tt = ct.symbolTT[symbol];
    const nbBitsOut = OpCodes.Shr32(tt.deltaNbBits + 32768, 16);
    const value = OpCodes.Shl32(nbBitsOut, 16) - tt.deltaNbBits;
    return ct.stateTable[OpCodes.Shr32(value, nbBitsOut) + tt.deltaFindState];
  }

  // FSE_encodeSymbol: transitions the running state backward through the
  // symbol stream, appending the bits this transition needs directly to
  // `writer` (call order == write order, see LowBitWriter comment above).
  function fseEncodeSymbol(writer, ct, statePtr, symbol) {
    const tt = ct.symbolTT[symbol];
    const nbBitsOut = OpCodes.Shr32(statePtr.value + tt.deltaNbBits, 16);
    const lowBits = nbBitsOut > 0 ? OpCodes.And32(statePtr.value, OpCodes.Shl32(1, nbBitsOut) - 1) : 0;
    writer.addBits(lowBits, nbBitsOut);
    statePtr.value = ct.stateTable[OpCodes.Shr32(statePtr.value, nbBitsOut) + tt.deltaFindState];
  }

  // RFC 8878 3.1.1.3.2: FSE-encode one block's sequences using Predefined_Mode
  // tables for LL/OF/ML. Processes sequences from LAST to FIRST (FSE's "first
  // encoded = last decoded" property, verified independently against
  // _decodeSequencesSection's exact read order: init reads LL,OF,ML; per
  // sequence extra bits read OF,ML,LL; per-sequence state updates read
  // LL,ML,OF) so every call below is the deliberate mirror of a specific
  // decoder read, in reverse.
  function encodeSequencesFSE(seqs) {
    const n = seqs.length;
    const writer = new LowBitWriter();

    const stateLL = { value: 0 }, stateOF = { value: 0 }, stateML = { value: 0 };
    stateLL.value = fseInitCState2(LL_ENC_TABLE, seqs[n - 1].llCode);
    stateOF.value = fseInitCState2(OF_ENC_TABLE, seqs[n - 1].ofCode);
    stateML.value = fseInitCState2(ML_ENC_TABLE, seqs[n - 1].mlCode);

    for (let i = n - 1; i >= 0; --i) {
      if (i < n - 1) {
        fseEncodeSymbol(writer, OF_ENC_TABLE, stateOF, seqs[i].ofCode);
        fseEncodeSymbol(writer, ML_ENC_TABLE, stateML, seqs[i].mlCode);
        fseEncodeSymbol(writer, LL_ENC_TABLE, stateLL, seqs[i].llCode);
      }
      writer.addBits(seqs[i].llExtraValue, seqs[i].llExtraBits);
      writer.addBits(seqs[i].mlExtraValue, seqs[i].mlExtraBits);
      writer.addBits(seqs[i].ofExtraValue, seqs[i].ofExtraBits);
    }

    writer.addBits(OpCodes.And32(stateML.value, ML_ENC_TABLE.tableSize - 1), ML_DEFAULT_ACCLOG);
    writer.addBits(OpCodes.And32(stateOF.value, OF_ENC_TABLE.tableSize - 1), OF_DEFAULT_ACCLOG);
    writer.addBits(OpCodes.And32(stateLL.value, LL_ENC_TABLE.tableSize - 1), LL_DEFAULT_ACCLOG);
    writer.addBits(1, 1); // end-mark sentinel bit (RFC 8878 4.1)
    return writer.finish();
  }

  // Predefined_Mode encode tables are fixed - build them once.
  const LL_ENC_TABLE = buildFseEncodeTable(LL_DEFAULT_NORM, LL_DEFAULT_NORM.length - 1, LL_DEFAULT_ACCLOG);
  const OF_ENC_TABLE = buildFseEncodeTable(OF_DEFAULT_NORM, OF_DEFAULT_NORM.length - 1, OF_DEFAULT_ACCLOG);
  const ML_ENC_TABLE = buildFseEncodeTable(ML_DEFAULT_NORM, ML_DEFAULT_NORM.length - 1, ML_DEFAULT_ACCLOG);

  // Find the LL/ML code covering `value` (baseline tables are monotonic and
  // gap-free, so the highest code whose baseline doesn't exceed value is it).
  function findLengthCode(baselineTable, extraBitsTable, value) {
    for (let code = baselineTable.length - 1; code >= 0; --code) {
      if (value >= baselineTable[code]) {
        return { code, extraBits: extraBitsTable[code], extraValue: value - baselineTable[code] };
      }
    }
    throw new Error('Zstd: value below minimum baseline');
  }

  // RFC 8878 3.1.1.5 repeat-offset rules, run forward (as an encoder needs):
  // given the real match distance and whether this sequence's literals length
  // is zero (which shifts what "repeat offset 1" even means), choose the
  // cheapest legal Offset_Code and mutate the recent-offsets history exactly
  // as the decoder's inverse logic would. Verified independently against
  // _decodeSequencesSection's offset-resolution branch.
  function resolveSequenceOffset(rep, realOffset, literalsLength) {
    const ll0 = literalsLength === 0;
    let ofCode, extraBits = 0, extraValue = 0;
    if (ll0 && realOffset === rep[1]) { ofCode = 0; }
    else if (!ll0 && realOffset === rep[0]) { ofCode = 0; }
    else if (ll0 && realOffset === rep[2]) { ofCode = 1; extraBits = 1; extraValue = 0; }
    else if (!ll0 && realOffset === rep[1]) { ofCode = 1; extraBits = 1; extraValue = 0; }
    else if (ll0 && rep[0] > 1 && realOffset === rep[0] - 1) { ofCode = 1; extraBits = 1; extraValue = 1; }
    else if (!ll0 && realOffset === rep[2]) { ofCode = 1; extraBits = 1; extraValue = 1; }
    else {
      const offsetValue = realOffset + 3;
      ofCode = highBitPos(offsetValue);
      extraBits = ofCode;
      extraValue = offsetValue - OpCodes.Shl32(1, ofCode);
    }

    if (ofCode >= 2) {
      rep[2] = rep[1]; rep[1] = rep[0]; rep[0] = realOffset;
    } else if (ofCode === 1) {
      const selector = 1 + (ll0 ? 1 : 0) + extraValue;
      let temp;
      if (selector === 1) temp = rep[1];
      else if (selector === 3) temp = rep[0] - 1;
      else temp = rep[2];
      if (temp === 0) temp = -1;
      const newRep2 = (selector === 1) ? rep[2] : rep[1];
      rep[2] = newRep2; rep[1] = rep[0]; rep[0] = temp;
    } else if (ll0) {
      const old1 = rep[1]; rep[1] = rep[0]; rep[0] = old1;
    }

    return { ofCode, extraBits, extraValue };
  }

  // ----- Length-limited Huffman code construction (package-merge / "coin
  // collector's" algorithm, RFC 8878 4.2.1's Max_Number_of_Bits=11 constraint)
  // -----
  // Produces optimal code lengths bounded by maxLen; for n>=2 symbols the
  // result is always Kraft-complete (verified independently: every symbol is
  // covered and sum(2^-length) is exactly 1, even for pathological
  // Fibonacci-weighted inputs that would need depth >11 unbounded).
  function packageMergeLengths(weights, maxLen) {
    const n = weights.length;
    if (n === 1) { const m = new Map(); m.set(weights[0].symbol, 1); return m; }
    const base = weights.slice().sort((a, b) => a.weight - b.weight).map(w => ({ weight: w.weight, symbols: [w.symbol] }));
    let prevLevel = base;
    for (let level = 2; level <= maxLen; ++level) {
      const packages = [];
      for (let i = 0; i + 1 < prevLevel.length; i += 2) {
        packages.push({ weight: prevLevel[i].weight + prevLevel[i + 1].weight, symbols: prevLevel[i].symbols.concat(prevLevel[i + 1].symbols) });
      }
      prevLevel = packages.concat(base).sort((a, b) => a.weight - b.weight);
    }
    const selected = prevLevel.slice(0, 2 * (n - 1));
    const lengthCount = new Map();
    for (const item of selected) for (const s of item.symbols) lengthCount.set(s, (lengthCount.get(s) || 0) + 1);
    return lengthCount;
  }

  // Huffman encode table: mirrors buildHuffmanTable's canonical assignment
  // (same rank/position bookkeeping) but records one {codeBits, nbBits} pair
  // per symbol instead of a flat decode-lookup array.
  function buildHuffmanEncodeTable(weights) {
    const numSymbols = weights.length;
    let weightTotal = 0;
    for (let i = 0; i < numSymbols; ++i) if (weights[i] > 0) weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, weights[i]), 1);
    const maxBits = highBitPos(weightTotal);
    const rankCount = new Array(maxBits + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i) rankCount[weights[i]]++;
    const rankStart = new Array(maxBits + 2).fill(0);
    { let next = 0; for (let w = 0; w <= maxBits; ++w) { rankStart[w] = next; next += rankCount[w]; } }
    const symbolsByRank = new Array(numSymbols);
    { const cursor = rankStart.slice(); for (let sym = 0; sym < numSymbols; ++sym) { const w = weights[sym]; symbolsByRank[cursor[w]++] = sym; } }
    const codes = new Array(numSymbols);
    let symbolIdx = rankCount[0], pos = 0;
    for (let w = 1; w <= maxBits; ++w) {
      const count = rankCount[w];
      const length = OpCodes.Shl32(1, w - 1);
      const nbBits = maxBits + 1 - w;
      for (let s = 0; s < count; ++s) {
        const sym = symbolsByRank[symbolIdx + s];
        codes[sym] = { codeBits: pos / length, nbBits };
        pos += length;
      }
      symbolIdx += count;
    }
    return { maxBits, codes };
  }

  // Builds a length-limited Huffman code for one block's literal bytes.
  // Returns null when entropy coding isn't applicable (fewer than 2 distinct
  // byte values - RLE/raw already optimal) or, defensively, if the resulting
  // weights somehow fail the Kraft-completeness check (falls back to Raw
  // rather than ever emit a non-conformant tree description).
  function buildLiteralHuffman(literalBytes) {
    const counts = new Array(256).fill(0);
    for (let i = 0; i < literalBytes.length; ++i) counts[literalBytes[i]]++;
    let maxSymbolValue = -1;
    const symbolWeights = [];
    for (let s = 0; s < 256; ++s) if (counts[s] > 0) { symbolWeights.push({ symbol: s, weight: counts[s] }); maxSymbolValue = s; }
    if (symbolWeights.length < 2) return null;

    const lengthMap = packageMergeLengths(symbolWeights, HUF_MAX_BITS);
    let maxLenUsed = 0;
    for (const w of symbolWeights) { const len = lengthMap.get(w.symbol); if (len > maxLenUsed) maxLenUsed = len; }

    const outWeights = new Array(maxSymbolValue + 1).fill(0);
    for (const w of symbolWeights) outWeights[w.symbol] = maxLenUsed + 1 - lengthMap.get(w.symbol);

    let weightTotal = 0;
    for (let s = 0; s <= maxSymbolValue; ++s) if (outWeights[s] > 0) weightTotal += OpCodes.Shr32(OpCodes.Shl32(1, outWeights[s]), 1);
    if (weightTotal !== OpCodes.Shl32(1, maxLenUsed)) return null;

    return { maxSymbolValue, weights: outWeights, encTable: buildHuffmanEncodeTable(outWeights) };
  }

  // Single-stream Huffman literal bitstream: symbols in reverse output order,
  // appended directly (see LowBitWriter comment).
  function encodeHuffmanStream(literalBytes, encTable) {
    const writer = new LowBitWriter();
    for (let i = literalBytes.length - 1; i >= 0; --i) {
      const c = encTable.codes[literalBytes[i]];
      writer.addBits(c.codeBits, c.nbBits);
    }
    writer.addBits(1, 1);
    return writer.finish();
  }

  // RFC 8878 4.2.1.1 direct weight representation: Header_Byte = 127 +
  // Number_of_Symbols, then each symbol's weight as a 4-bit nibble (high
  // nibble first). Only legal when Number_of_Symbols <= 128.
  function writeHuffmanTreeDescriptionDirect(weights) {
    const numSymbols = weights.length;
    const bytes = [OpCodes.AndN(127 + numSymbols, 0xFF)];
    for (let i = 0; i < numSymbols; i += 2) {
      const hi = weights[i];
      const lo = (i + 1 < numSymbols) ? weights[i + 1] : 0;
      bytes.push(OpCodes.Or32(OpCodes.Shl32(hi, 4), lo));
    }
    return bytes;
  }

  // Raw_Literals_Block / RLE_Literals_Block header (RFC 8878 3.1.1.3.1.1):
  // picks the smallest Size_Format that can hold regenSize.
  function buildRawOrRleLiteralsHeader(blockType, regenSize) {
    if (regenSize <= 31) {
      return [OpCodes.Or32(blockType, OpCodes.Shl32(regenSize, 3))];
    } else if (regenSize <= 4095) {
      const b0 = OpCodes.Or32(OpCodes.Or32(blockType, OpCodes.Shl32(1, 2)), OpCodes.Shl32(OpCodes.AndN(regenSize, 0xF), 4));
      const b1 = OpCodes.AndN(Math.floor(regenSize / 16), 0xFF);
      return [b0, b1];
    }
    const b0 = OpCodes.Or32(OpCodes.Or32(blockType, OpCodes.Shl32(3, 2)), OpCodes.Shl32(OpCodes.AndN(regenSize, 0xF), 4));
    const b1 = OpCodes.AndN(Math.floor(regenSize / 16), 0xFF);
    const b2 = OpCodes.AndN(Math.floor(regenSize / 4096), 0xFF);
    return [b0, b1, b2];
  }

  // Builds the smallest legal Literals_Section for one block's literal bytes,
  // choosing among RLE / single-stream Huffman-Compressed / Raw. Huffman-
  // Compressed is only attempted when it's legal for this decoder's header
  // grammar: single-stream mode's 3-byte header caps BOTH regenSize and
  // compSize at 1023, and the direct tree-weight representation caps
  // Number_of_Symbols (maxSymbolValue+1) at 128 - outside those bounds this
  // falls back to Raw_Literals_Block, still leaving FSE-coded sequences to do
  // the compression work for that block.
  function buildLiteralsSection(literalBytes) {
    const regenSize = literalBytes.length;

    let rleCandidate = null;
    if (regenSize > 1) {
      let allSame = true;
      for (let i = 1; i < regenSize; ++i) if (literalBytes[i] !== literalBytes[0]) { allSame = false; break; }
      if (allSame) rleCandidate = buildRawOrRleLiteralsHeader(1, regenSize).concat([literalBytes[0]]);
    }

    const rawCandidate = buildRawOrRleLiteralsHeader(0, regenSize).concat(literalBytes);

    let hufCandidate = null;
    if (regenSize >= 2 && regenSize < 1024) {
      const huf = buildLiteralHuffman(literalBytes);
      if (huf && huf.maxSymbolValue <= 127) {
        const treeDesc = writeHuffmanTreeDescriptionDirect(huf.weights);
        const stream = encodeHuffmanStream(literalBytes, huf.encTable);
        const compSize = treeDesc.length + stream.length;
        if (compSize < 1024) {
          const raw24 = 2 + regenSize * 16 + compSize * 16384; // blockType=2 (Compressed), Size_Format=0
          const header = [OpCodes.AndN(raw24, 0xFF), OpCodes.AndN(Math.floor(raw24 / 256), 0xFF), OpCodes.AndN(Math.floor(raw24 / 65536), 0xFF)];
          hufCandidate = header.concat(treeDesc).concat(stream);
        }
      }
    }

    let best = rawCandidate;
    if (rleCandidate && rleCandidate.length < best.length) best = rleCandidate;
    if (hufCandidate && hufCandidate.length < best.length) best = hufCandidate;
    return best;
  }

  // ===== LZ77 MATCH FINDING =====

  const MAX_MATCH_LEN = 100000;                          // stays under ML table's representable range
  const LZ_HASH_BITS = 16;
  const LZ_CHAIN_DEPTH = 64;
  const LITERAL_RUN_CAP = MAX_BLOCK_SIZE - MAX_MATCH_LEN; // forces a literal-only token before a single
                                                           // run could overflow a block's regen-size budget

  // Hash-chain match finder (3-byte hash, matching Zstd's minimum match
  // length), modeled after crush.js's HashTable but sized for whole-file
  // (up to window-size) back-references rather than a fixed ring buffer,
  // since Zstd's Single_Segment framing lets matches reach any earlier
  // position in the same frame.
  class Lz77Matcher {
    constructor(data) {
      this.data = data;
      const hashSize = OpCodes.Shl32(1, LZ_HASH_BITS);
      this.hashMask = hashSize - 1;
      this.head = new Array(hashSize).fill(-1);
      this.prev = new Array(data.length).fill(-1);
    }
    _hash(pos) {
      const d = this.data;
      const h = OpCodes.Xor32(OpCodes.Shl32(d[pos], 9), OpCodes.Xor32(OpCodes.Shl32(d[pos + 1], 5), d[pos + 2]));
      return OpCodes.And32(h, this.hashMask);
    }
    insert(pos) {
      if (pos + 2 >= this.data.length) return;
      const h = this._hash(pos);
      this.prev[pos] = this.head[h];
      this.head[h] = pos;
    }
    findMatch(pos, maxLen) {
      const d = this.data;
      if (pos + 2 >= d.length) return null;
      const h = this._hash(pos);
      let candidate = this.head[h];
      let bestLen = 0, bestOffset = 0, chain = 0;
      while (candidate >= 0 && chain < LZ_CHAIN_DEPTH) {
        let len = 0;
        while (len < maxLen && d[candidate + len] === d[pos + len]) len++;
        if (len > bestLen) {
          bestLen = len; bestOffset = pos - candidate;
          if (len >= maxLen) break;
        }
        candidate = this.prev[candidate];
        chain++;
      }
      if (bestLen < 3) return null;
      // Predefined OF table caps codes at 28 (OF_DEFAULT_NORM.length-1); reject
      // matches that would need a larger code (defensive bound, far beyond any
      // practical input size here).
      if (highBitPos(bestOffset + 3) > OF_DEFAULT_NORM.length - 1) return null;
      // Economic-viability check: a sequence costs a roughly-fixed overhead
      // (three FSE state transitions plus the offset's own extra bits, all
      // Predefined-Mode so there's no per-symbol table cost) regardless of
      // match length, while literal bytes cost ~8 bits each. Reject matches
      // whose length can't plausibly pay for their own encoding - otherwise
      // greedy matching on data with only sparse, distant accidental repeats
      // (e.g. a handful of 3-byte coincidences in otherwise-random bytes)
      // spends more bits than it saves. Purely a selection heuristic: it can
      // only make the matcher more conservative, never change how a chosen
      // match is encoded or decoded.
      const minProfitable = Math.max(3, Math.ceil((18 + highBitPos(bestOffset + 3) + 1) / 8));
      if (bestLen < minProfitable) return null;
      return { length: bestLen, offset: bestOffset };
    }
  }

  // Produces a flat token list {literalStart, literalLength, matchLength,
  // offset} spanning the whole input; matchLength===0 marks a literal-only
  // token (no match found, or a forced cut once a run reaches
  // LITERAL_RUN_CAP so no single token can ever overflow a block).
  function tokenize(data) {
    const tokens = [];
    const n = data.length;
    if (n === 0) return tokens;
    const matcher = new Lz77Matcher(data);
    let literalStart = 0, pos = 0;
    while (pos < n) {
      const remaining = n - pos;
      const match = remaining >= 3 ? matcher.findMatch(pos, Math.min(MAX_MATCH_LEN, remaining)) : null;
      if (match) {
        tokens.push({ literalStart, literalLength: pos - literalStart, matchLength: match.length, offset: match.offset });
        const end = pos + match.length;
        for (let i = pos; i < end; ++i) matcher.insert(i);
        pos = end;
        literalStart = pos;
      } else {
        matcher.insert(pos);
        pos++;
        if (pos - literalStart >= LITERAL_RUN_CAP) {
          tokens.push({ literalStart, literalLength: pos - literalStart, matchLength: 0, offset: 0 });
          literalStart = pos;
        }
      }
    }
    if (pos > literalStart) tokens.push({ literalStart, literalLength: pos - literalStart, matchLength: 0, offset: 0 });
    return tokens;
  }

  // Groups tokens into blocks no larger than MAX_BLOCK_SIZE regen bytes,
  // never mixing literal-only tokens (matchLength===0, destined for an
  // nbSeq=0 block) with real-match tokens in the same group - each token's
  // own regen size is already bounded (LITERAL_RUN_CAP / MAX_MATCH_LEN), so
  // grouping never needs to split a token mid-way.
  function groupTokensIntoBlocks(tokens) {
    const groups = [];
    let cur = [], curSize = 0, curIsLiteralOnly = null;
    for (const t of tokens) {
      const isLiteralOnly = t.matchLength === 0;
      const size = t.literalLength + t.matchLength;
      if (cur.length > 0 && (curIsLiteralOnly !== isLiteralOnly || curSize + size > MAX_BLOCK_SIZE)) {
        groups.push(cur); cur = []; curSize = 0;
      }
      cur.push(t); curSize += size; curIsLiteralOnly = isLiteralOnly;
    }
    if (cur.length > 0) groups.push(cur);
    return groups;
  }

  // Builds the Compressed_Block PAYLOAD (Literals_Section + Sequences_Section,
  // not including the 3-byte block header) for one group of tokens, using and
  // mutating a WORKING COPY of the recent-offsets so the caller can discard it
  // without side effects if Raw/RLE turns out smaller for this block.
  function buildCompressedBlockCandidate(data, tokens, repWorking) {
    const literalBytes = [];
    const realSeqs = [];
    for (const t of tokens) {
      for (let i = 0; i < t.literalLength; ++i) literalBytes.push(data[t.literalStart + i]);
      if (t.matchLength > 0) realSeqs.push(t);
    }

    const literalsSection = buildLiteralsSection(literalBytes);

    if (realSeqs.length === 0) {
      return literalsSection.concat([0]); // Sequences_Section header byte 0 = nbSeq 0
    }

    const seqs = new Array(realSeqs.length);
    for (let i = 0; i < realSeqs.length; ++i) {
      const t = realSeqs[i];
      const ll = findLengthCode(LL_BASELINE, LL_EXTRABITS, t.literalLength);
      const ml = findLengthCode(ML_BASELINE, ML_EXTRABITS, t.matchLength);
      const of = resolveSequenceOffset(repWorking, t.offset, t.literalLength);
      seqs[i] = {
        llCode: ll.code, llExtraBits: ll.extraBits, llExtraValue: ll.extraValue,
        mlCode: ml.code, mlExtraBits: ml.extraBits, mlExtraValue: ml.extraValue,
        ofCode: of.ofCode, ofExtraBits: of.extraBits, ofExtraValue: of.extraValue
      };
    }

    const nbSeq = seqs.length;
    let nbSeqHeader;
    if (nbSeq < 128) nbSeqHeader = [nbSeq];
    else if (nbSeq <= 32511) nbSeqHeader = [128 + Math.floor(nbSeq / 256), OpCodes.AndN(nbSeq, 0xFF)];
    else { const v = nbSeq - 32512; nbSeqHeader = [255, OpCodes.AndN(v, 0xFF), Math.floor(v / 256)]; }

    const modesByte = 0; // Predefined_Mode for LL, OF and ML (RFC 8878 3.1.1.3.2.1.1)
    const sequencesSection = nbSeqHeader.concat([modesByte]).concat(encodeSequencesFSE(seqs));

    return literalsSection.concat(sequencesSection);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZstdCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zstandard";
      this.description = "Zstandard (Zstd), RFC 8878. Encoder performs genuine LZ77 compression: a hash-chain match finder produces sequences that are FSE-coded (Predefined_Mode distribution tables) with correct repeat-offset resolution, and literals are Huffman-coded (single-stream, direct tree-weight description) where the literals-section header grammar allows it; each block independently falls back to RLE or Raw when that would be smaller, or when Huffman/FSE isn't applicable (e.g. literal alphabets spanning byte values >=128, or literal counts >=1024, use Raw_Literals so FSE-coded sequences still carry the compression). Decoder reads full frames produced by real Zstd encoders, including Huffman-coded literals (raw/RLE/compressed/treeless) and FSE-coded sequences (predefined/RLE/FSE-compressed/repeat distribution tables) with repeat-offset resolution.";
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
      // sets Last_Block. Each block independently picks the smallest of
      // Raw_Block, RLE_Block or a genuine Compressed_Block (LZ77 sequences,
      // FSE-coded via Predefined_Mode, with Huffman-coded literals where the
      // literals-section header grammar allows it - see buildLiteralsSection).
      // Recent-offsets (repOffsets) persist across blocks within the frame
      // exactly like the decoder's `state.repOffsets`, and are only committed
      // when a block is actually emitted as Compressed - a block that falls
      // back to Raw/RLE leaves them untouched, since the decoder never
      // applies sequence updates for those block types either.
      const tokens = tokenize(data);
      const groups = groupTokensIntoBlocks(tokens);
      const repOffsets = [1, 4, 8];

      let cursor = 0;
      for (let gi = 0; gi < groups.length; ++gi) {
        const groupTokens = groups[gi];
        const isLast = (gi === groups.length - 1) ? 1 : 0;
        let regenSize = 0;
        for (const t of groupTokens) regenSize += t.literalLength + t.matchLength;
        const rawBytes = data.slice(cursor, cursor + regenSize);
        cursor += regenSize;

        const repCandidate = repOffsets.slice();
        const compressedPayload = buildCompressedBlockCandidate(data, groupTokens, repCandidate);

        // Block_Size in the header means "regenerated size" for RLE but "payload
        // byte count" for Raw/Compressed (RFC 8878 3.1.1.2) - track both fields
        // per candidate rather than assuming they're the same.
        const candidates = [
          { type: BLOCK_TYPE_RAW, payload: rawBytes, headerSize: rawBytes.length },
          { type: BLOCK_TYPE_COMPRESSED, payload: compressedPayload, headerSize: compressedPayload.length }
        ];
        if (this._isRepetitive(rawBytes) && rawBytes.length > 1) candidates.push({ type: BLOCK_TYPE_RLE, payload: [rawBytes[0]], headerSize: rawBytes.length });

        let chosen = candidates[0];
        for (let ci = 1; ci < candidates.length; ++ci) if (candidates[ci].payload.length < chosen.payload.length) chosen = candidates[ci];

        if (chosen.type === BLOCK_TYPE_COMPRESSED) {
          repOffsets[0] = repCandidate[0]; repOffsets[1] = repCandidate[1]; repOffsets[2] = repCandidate[2];
        }

        const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(chosen.headerSize, 3), OpCodes.Shl32(chosen.type, 1)), isLast);
        result.push(OpCodes.AndN(blockHeader, 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));
        for (let _i = 0; _i < chosen.payload.length; ++_i) result.push(chosen.payload[_i]);
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
