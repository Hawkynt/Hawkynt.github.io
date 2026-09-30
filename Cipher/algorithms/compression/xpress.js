/*
 * Xpress (LZ77+Huffman) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Microsoft's Xpress compression algorithm, LZ77+Huffman variant ([MS-XCA]
 * section 2.1), matching the reference CompressionWorkbench encoder/decoder
 * (Compression.Core.Dictionary.Xpress.XpressHuffmanCompressor/Decompressor)
 * byte-for-byte.
 *
 * Data is split into independent 64 KiB chunks. Each chunk starts with a
 * 256-byte table of 4-bit Huffman code lengths for a 512-symbol alphabet
 * (two nibbles per byte, low nibble = lower-indexed symbol), followed by a
 * bit-packed stream of Huffman-coded symbols, LSB-first, packed into 16-bit
 * little-endian words:
 *   - Symbols 0-255: literal bytes.
 *   - Symbols 256-511: LZ matches, encoded as
 *     256 + (offsetLog2 << 4) + min(length - 3, 15), where offsetLog2 =
 *     floor(log2(distance)). offsetLog2 raw extra bits (the low bits of
 *     distance - 2^offsetLog2) follow, packed into the same bit stream.
 *     If the length nibble is 15, one extra byte follows (raw, not
 *     Huffman-coded): length = extra + 3, unless extra == 255, in which
 *     case a raw 16-bit LE length follows instead.
 *
 * The reference decoder rewinds any 16-bit words it eagerly over-read past a
 * chunk's bit stream (the encoder pads each chunk to a 16-bit boundary, so
 * only sub-word padding bits are lost) so the next chunk's table header
 * starts at the right byte offset. This implementation wraps the whole
 * multi-chunk payload in a single self-contained 4-byte little-endian
 * original-length header (no side channel needed for Feed/Result use).
 *
 * The match finder is a hash-chain search (3-byte hash, 8192-byte window,
 * 128-candidate chain depth) and the Huffman tree is built with a
 * frequency-ordered min-heap (ties broken by symbol, where internal nodes
 * carry the sentinel symbol -1) plus a length-limiting pass that clamps
 * codes to 15 bits and repairs the Kraft inequality by lengthening the
 * shortest violating codes, then reclaims any leftover budget by shortening
 * the longest codes -- both reference-specific choices that must be
 * reproduced exactly for byte-identical output, not just a valid tree.
 *
 * References:
 * - [MS-XCA]: Xpress Compression Algorithm
 *   https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './huffman-code-lengths.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./huffman-code-lengths.data')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.HuffmanCodeLengths);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, HuffmanCodeLengths) {
  'use strict';

  if (!HuffmanCodeLengths) {
    throw new Error('HuffmanCodeLengths dependency is required');
  }

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== FORMAT CONSTANTS =====

  /** @type {int32} */
  const WINDOW_SIZE = 8192;
  /** @type {int32} */
  const MIN_MATCH = 3;
  /** @type {int32} */
  const MAX_MATCH = 65538;
  /** @type {int32} */
  const LENGTH_SENTINEL_8 = 255;
  /** @type {int32} */
  const HUFF_SYMBOL_COUNT = 512;
  /** @type {int32} */
  const HUFF_CHUNK_SIZE = 65536;
  /** @type {int32} */
  const HUFF_TABLE_HEADER_BYTES = 256;
  /** @type {int32} */
  const HUFF_MAX_CODE_LENGTH = 15;
  /** @type {int32} */
  const MAX_CHAIN_DEPTH = 128;

  // ===== HASH-CHAIN MATCH FINDER =====
  //
  // The reference finder stores `prev` in a fixed WindowSize-sized circular
  // buffer (indexed by position & (WindowSize-1)), not one slot per input
  // position, and explicitly skips a chain entry that collides with the
  // current position (a stale slot reused after the buffer wrapped around).

  /** @type {int32} */
  const MF_HASH_BITS = 15;
  /** @type {int32} */
  const MF_HASH_SIZE = OpCodes.Shl32(1, MF_HASH_BITS);

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position of the three hashed bytes
   * @returns {uint32} Bucket
   */
  function mfHash(data, pos) {
    /** @type {uint32} */
    const h1 = OpCodes.Shl32(data[pos], 10);
    /** @type {uint32} */
    const h2 = OpCodes.Shl32(data[pos + 1], 5);
    /** @type {uint8} */
    const h3 = data[pos + 2];
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), h3), MF_HASH_SIZE - 1);
  }

  /**
   * Match found by the hash-chain search
   */
  class XpressMatch {
    /**
     * @param {int32} distance - Distance back to the match source (0 when none)
     * @param {int32} length - Match length (0 when none)
     */
    constructor(distance, length) {
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Chain ring size (a power of two)
     * @param {int32} maxChainDepth - Maximum chain nodes visited per search
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32[]} */
      this.head = new Int32Array(MF_HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize);
      /** @type {int32} */
      this.mask = windowSize - 1;
    }

    /**
     * Find the longest match at position and insert the position
     * @param {uint8[]} data - Bytes
     * @param {int32} position - Position to match
     * @param {int32} maxDistance - Largest allowed distance
     * @param {int32} maxLength - Largest match length
     * @param {int32} minLength - Smallest useful match length
     * @returns {XpressMatch} Best match, or distance 0 and length 0
     */
    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new XpressMatch(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;
      /** @type {uint32} */
      const h = mfHash(data, position);
      /** @type {int32} */
      let candidate = this.head[h];
      /** @type {int32} */
      let chainCount = 0;
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.mask)];
          chainCount++;
          continue;
        }

        /** @type {int32} */
        const distance = position - candidate;
        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        // (The reference has a "quick check" pruning gate here purely for speed;
        // it never changes which candidate wins, so it's safe to always measure
        // the full match length directly.)
        /** @type {int32} */
        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) {
          length++;
        }
        if (length >= minLength && length > bestLength) {
          bestLength = length;
          bestDistance = distance;
          if (bestLength >= maxLength) {
            break;
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.mask)];
        if (candidate <= windowStart) {
          break;
        }
        chainCount++;
      }

      this.prev[OpCodes.And32(position, this.mask)] = this.head[h];
      this.head[h] = position;

      if (bestLength >= minLength) {
        return new XpressMatch(bestDistance, bestLength);
      }
      return new XpressMatch(0, 0);
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} position - Position to insert
     */
    insertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }
      /** @type {uint32} */
      const h = mfHash(data, position);
      this.prev[OpCodes.And32(position, this.mask)] = this.head[h];
      this.head[h] = position;
    }
  }

  // ===== HUFFMAN TREE CONSTRUCTION =====

  // Code lengths come from the shared deterministic builder in
  // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is a
  // written rule - lighter first, then leaves before internal nodes, leaves by
  // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
  // DeterministicHuffman follows the same rule, so the two produce the same tree
  // because the algorithm says so and not because either copies the other's heap.

  /**
   * @param {int32[]} usedLength - Code length per used symbol
   * @param {int32} maxLength - Largest allowed length
   * @returns {float64} Kraft sum scaled by 2^maxLength
   */
  function kraftSum(usedLength, maxLength) {
    /** @type {float64} */
    let sum = 0;
    for (let i = 0; i < usedLength.length; i++) {
      /** @type {uint32} */
      const weight = OpCodes.Shl32(1, maxLength - usedLength[i]);
      sum += weight;
    }
    return sum;
  }

  /**
   * @param {int32[]} codeLengths - Code lengths, limited in place
   * @param {int32} maxLength - Largest allowed length
   */
  function limitCodeLengths(codeLengths, maxLength) {
    /** @type {boolean} */
    let needsAdjustment = false;
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > maxLength) {
        needsAdjustment = true;
        break;
      }
    }
    if (!needsAdjustment) {
      return;
    }

    // The used symbols in ascending order, with their (adjusted) lengths.
    /** @type {int32[]} */
    const usedSymbol = [];
    /** @type {int32[]} */
    const usedLength = [];
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > 0) {
        usedSymbol.push(i);
        usedLength.push(codeLengths[i]);
      }
    }

    for (let i = 0; i < usedLength.length; i++) {
      if (usedLength[i] > maxLength) {
        usedLength[i] = maxLength;
      }
    }

    /** @type {uint32} */
    const kraftMax = OpCodes.Shl32(1, maxLength);
    for (;;) {
      if (kraftSum(usedLength, maxLength) <= kraftMax) {
        break;
      }

      /** @type {int32} */
      let shortestIdx = -1;
      /** @type {float64} */
      let shortestLen = Infinity;
      for (let i = 0; i < usedLength.length; i++) {
        if (usedLength[i] < maxLength && usedLength[i] < shortestLen) {
          shortestLen = usedLength[i];
          shortestIdx = i;
        }
      }
      if (shortestIdx < 0) {
        break;
      }
      usedLength[shortestIdx]++;
    }

    for (;;) {
      /** @type {float64} */
      const excess = kraftMax - kraftSum(usedLength, maxLength);
      if (excess <= 0) {
        break;
      }

      /** @type {int32} */
      let longestIdx = -1;
      /** @type {int32} */
      let longestLen = 0;
      for (let i = 0; i < usedLength.length; i++) {
        if (usedLength[i] > longestLen) {
          longestLen = usedLength[i];
          longestIdx = i;
        }
      }
      if (longestIdx < 0 || longestLen <= 1) {
        break;
      }

      /** @type {uint32} */
      const added = OpCodes.Shl32(1, maxLength - longestLen);
      if (added <= excess) {
        usedLength[longestIdx]--;
      } else {
        break;
      }
    }

    for (let i = 0; i < codeLengths.length; i++) {
      codeLengths[i] = 0;
    }
    for (let i = 0; i < usedSymbol.length; i++) {
      codeLengths[usedSymbol[i]] = usedLength[i];
    }
  }

  /**
   * @param {int32[]} freq - Frequency per symbol (a lone symbol borrows an unused one)
   * @returns {int32[]} Code length per symbol
   */
  function buildLengths(freq) {
    /** @type {int32} */
    let usedCount = 0;
    for (let i = 0; i < freq.length; i++) {
      if (freq[i] > 0) {
        usedCount++;
      }
    }
    if (usedCount === 0) {
      /** @type {int32[]} */
      const flat = new Array(HUFF_SYMBOL_COUNT);
      for (let i = 0; i < HUFF_SYMBOL_COUNT; i++) {
        flat[i] = 9;
      }
      return flat;
    }

    if (usedCount < 2) {
      for (let i = 0; i < freq.length; i++) {
        if (freq[i] === 0) {
          freq[i] = 1;
          break;
        }
      }
    }

    /** @type {int32[]} */
    const lengths = HuffmanCodeLengths.buildCodeLengths(freq, HUFF_SYMBOL_COUNT);
    limitCodeLengths(lengths, HUFF_MAX_CODE_LENGTH);
    return lengths;
  }

  /**
   * @param {uint32} code - Code
   * @param {int32} length - Number of bits
   * @returns {uint32} The length low bits in reverse order
   */
  function reverseBits(code, length) {
    /** @type {uint32} */
    let result = 0;
    /** @type {uint32} */
    let c = code;
    for (let i = 0; i < length; i++) {
      result = OpCodes.Or32(OpCodes.Shl32(result, 1), OpCodes.And32(c, 1));
      c = OpCodes.Shr32(c, 1);
    }
    return result;
  }

  /**
   * @param {int32[]} lengths - Code length per symbol
   * @returns {uint32[]} Bit-reversed canonical code per symbol
   */
  function buildCanonicalCodes(lengths) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < lengths.length; i++) {
      if (i === 0 || lengths[i] > maxLen) {
        maxLen = lengths[i];
      }
    }
    /** @type {uint32[]} */
    const codes = new Array(lengths.length);
    for (let i = 0; i < lengths.length; i++) {
      codes[i] = 0;
    }
    if (maxLen === 0) {
      return codes;
    }

    /** @type {int32[]} */
    const blCount = new Array(maxLen + 1);
    /** @type {uint32[]} */
    const nextCode = new Array(maxLen + 1);
    for (let b = 0; b <= maxLen; b++) {
      blCount[b] = 0;
      nextCode[b] = 0;
    }
    for (let i = 0; i < lengths.length; i++) {
      if (lengths[i] > 0) {
        blCount[lengths[i]]++;
      }
    }

    /** @type {uint32} */
    let code = 0;
    for (let b = 1; b <= maxLen; b++) {
      /** @type {int32} */
      const counted = blCount[b - 1];
      code = OpCodes.Shl32(code + counted, 1);
      nextCode[b] = code;
    }

    for (let i = 0; i < lengths.length; i++) {
      if (lengths[i] > 0) {
        codes[i] = reverseBits(nextCode[lengths[i]]++, lengths[i]);
      }
    }
    return codes;
  }

  /**
   * @param {int32} x - Positive value
   * @returns {int32} floor(log2(x))
   */
  function log2Floor(x) {
    /** @type {int32} */
    let result = 0;
    /** @type {uint32} */
    let v = x;
    while (v > 1) {
      v = OpCodes.Shr32(v, 1);
      result++;
    }
    return result;
  }

  // ===== CHUNK COMPRESSOR =====

  /**
   * LSB-first bit writer packing 16-bit little-endian words
   */
  class XpressBitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bitBytes = [];
      /** @type {uint32} */
      this.bitBuf = 0;
      /** @type {int32} */
      this.bitsInBuf = 0;
    }

    /** Emit the current word */
    flushWord() {
      this.bitBytes.push(OpCodes.And32(this.bitBuf, 0xFF));
      this.bitBytes.push(OpCodes.And32(OpCodes.Shr32(this.bitBuf, 8), 0xFF));
      this.bitBuf = 0;
      this.bitsInBuf = 0;
    }

    /**
     * @param {uint32} value - Value
     * @param {int32} count - Number of bits, least significant first
     */
    writeBits(value, count) {
      /** @type {int32} */
      let remaining = count;
      /** @type {uint32} */
      let v = value;
      while (remaining > 0) {
        /** @type {int32} */
        const space = 16 - this.bitsInBuf;
        /** @type {int32} */
        const take = Math.min(space, remaining);
        /** @type {int32} */
        const mask = OpCodes.Shl32(1, take) - 1;
        this.bitBuf = OpCodes.Or32(this.bitBuf, OpCodes.Shl32(OpCodes.And32(v, mask), this.bitsInBuf));
        v = OpCodes.Shr32(v, take);
        remaining -= take;
        this.bitsInBuf += take;
        if (this.bitsInBuf === 16) {
          this.flushWord();
        }
      }
    }
  }

  /**
   * @param {uint8[]} chunk - Up to 64 KiB of input
   * @param {uint8[]} out - Output (appended to)
   */
  function compressChunk(chunk, out) {
    /** @type {HashChainMatchFinder} */
    const matchFinder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
    /** @type {int32[]} */
    const tokenSymbol = [];
    /** @type {int32[]} */
    const tokenDistance = [];
    /** @type {int32[]} */
    const tokenLength = [];
    /** @type {int32[]} */
    const freq = new Array(HUFF_SYMBOL_COUNT);
    for (let i = 0; i < HUFF_SYMBOL_COUNT; i++) {
      freq[i] = 0;
    }
    /** @type {int32} */
    let pos = 0;

    while (pos < chunk.length) {
      /** @type {XpressMatch} */
      const match = matchFinder.findMatch(chunk, pos, WINDOW_SIZE, MAX_MATCH, MIN_MATCH);

      if (match.length >= MIN_MATCH) {
        /** @type {int32} */
        const offsetLog2 = log2Floor(match.distance);
        /** @type {int32} */
        const lengthHeader = Math.min(match.length - MIN_MATCH, 15);
        /** @type {int32} */
        const offsetClass = OpCodes.Shl32(offsetLog2, 4);
        /** @type {int32} */
        const symbol = 256 + offsetClass + lengthHeader;

        tokenSymbol.push(symbol);
        tokenDistance.push(match.distance);
        tokenLength.push(match.length);
        freq[symbol]++;

        for (let i = 1; i < match.length; i++) {
          matchFinder.insertPosition(chunk, pos + i);
        }
        pos += match.length;
      } else {
        tokenSymbol.push(chunk[pos]);
        tokenDistance.push(0);
        tokenLength.push(0);
        freq[chunk[pos]]++;
        pos++;
      }
    }

    /** @type {int32[]} */
    const codeLengths = buildLengths(freq);

    /** @type {uint8[]} */
    const tableHeader = new Array(HUFF_TABLE_HEADER_BYTES);
    for (let i = 0; i < HUFF_TABLE_HEADER_BYTES; i++) {
      tableHeader[i] = 0;
    }
    for (let i = 0; i < HUFF_SYMBOL_COUNT; i += 2) {
      tableHeader[i / 2] = OpCodes.Or32(OpCodes.And32(codeLengths[i], 0xF), OpCodes.Shl32(OpCodes.And32(codeLengths[i + 1], 0xF), 4));
    }
    for (let i = 0; i < tableHeader.length; i++) {
      out.push(tableHeader[i]);
    }

    /** @type {uint32[]} */
    const codes = buildCanonicalCodes(codeLengths);

    /** @type {XpressBitWriter} */
    const writer = new XpressBitWriter();

    for (let t = 0; t < tokenSymbol.length; t++) {
      /** @type {int32} */
      const symbol = tokenSymbol[t];
      /** @type {int32} */
      const distance = tokenDistance[t];
      /** @type {int32} */
      const length = tokenLength[t];
      writer.writeBits(codes[symbol], codeLengths[symbol]);
      if (symbol < 256) {
        continue;
      }

      /** @type {int32} */
      const offsetLog2 = OpCodes.Shr32(symbol - 256, 4);
      if (offsetLog2 > 0) {
        /** @type {int32} */
        const baseOffset = OpCodes.Shl32(1, offsetLog2);
        writer.writeBits(distance - baseOffset, offsetLog2);
      }

      /** @type {uint32} */
      const lengthHeader = OpCodes.And32(symbol - 256, 0xF);
      if (lengthHeader !== 15) {
        continue;
      }

      /** @type {int32} */
      const adj = length - MIN_MATCH;
      if (adj < LENGTH_SENTINEL_8) {
        writer.writeBits(adj, 8);
      } else {
        writer.writeBits(LENGTH_SENTINEL_8, 8);
        writer.writeBits(length, 16);
      }
    }

    if (writer.bitsInBuf > 0) {
      writer.flushWord();
    }
    for (let i = 0; i < writer.bitBytes.length; i++) {
      out.push(writer.bitBytes[i]);
    }
  }

  /**
   * @param {uint8[]} input - Input bytes
   * @returns {uint8[]} XPRESS Huffman chunks
   */
  function compressXpressHuffman(input) {
    /** @type {uint8[]} */
    const out = [];
    if (input.length === 0) {
      return out;
    }
    /** @type {int32} */
    let pos = 0;
    while (pos < input.length) {
      /** @type {int32} */
      const chunkSize = Math.min(HUFF_CHUNK_SIZE, input.length - pos);
      compressChunk(input.slice(pos, pos + chunkSize), out);
      pos += chunkSize;
    }
    return out;
  }

  // ===== CHUNK DECOMPRESSOR =====

  /**
   * Direct-lookup decode table: entry = symbol | (length shifted left 16), -1 unused
   */
  class XpressDecodeTable {
    /**
     * @param {int32[]} table - Entries indexed by the next maxLen bits
     * @param {int32} maxLen - Longest code length
     */
    constructor(table, maxLen) {
      /** @type {int32[]} */
      this.table = table;
      /** @type {int32} */
      this.maxLen = maxLen;
    }
  }

  /**
   * @param {int32[]} codeLengths - Code length per symbol
   * @returns {XpressDecodeTable} Decode table
   */
  function buildDecodeTable(codeLengths) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > maxLen) {
        maxLen = codeLengths[i];
      }
    }

    if (maxLen === 0) {
      /** @type {int32[]} */
      const emptyTable = [0, 0];
      return new XpressDecodeTable(emptyTable, 1);
    }

    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, maxLen);
    /** @type {int32[]} */
    const table = new Array(tableSize);
    for (let i = 0; i < tableSize; i++) {
      table[i] = -1;
    }

    /** @type {int32[]} */
    const blCount = new Array(maxLen + 1);
    /** @type {uint32[]} */
    const nextCode = new Array(maxLen + 1);
    for (let b = 0; b <= maxLen; b++) {
      blCount[b] = 0;
      nextCode[b] = 0;
    }
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > 0) {
        blCount[codeLengths[i]]++;
      }
    }

    /** @type {uint32} */
    let code = 0;
    for (let b = 1; b <= maxLen; b++) {
      /** @type {int32} */
      const counted = blCount[b - 1];
      code = OpCodes.Shl32(code + counted, 1);
      nextCode[b] = code;
    }

    for (let sym = 0; sym < codeLengths.length; sym++) {
      /** @type {int32} */
      const len = codeLengths[sym];
      if (len === 0) {
        continue;
      }

      /** @type {uint32} */
      const symCode = nextCode[len]++;
      /** @type {uint32} */
      const reversed = reverseBits(symCode, len);
      /** @type {int32} */
      const fillCount = OpCodes.Shl32(1, maxLen - len);
      /** @type {uint32} */
      const packed = OpCodes.Or32(sym, OpCodes.Shl32(len, 16));
      for (let fill = 0; fill < fillCount; fill++) {
        /** @type {uint32} */
        const step = OpCodes.Shl32(fill, len);
        table[OpCodes.Add32(reversed, step)] = packed;
      }
    }

    return new XpressDecodeTable(table, maxLen);
  }

  /**
   * LSB-first reader of 16-bit little-endian words
   */
  class XpressBitReader {
    /**
     * @param {uint8[]} input - Compressed bytes
     */
    constructor(input) {
      /** @type {uint8[]} */
      this.input = input;
      // The chunk rewind can move the position far outside the input on a
      // corrupt stream, so it is kept as an exact float64.
      /** @type {float64} */
      this.inputPos = 0;
      /** @type {uint32} */
      this.bitBuf = 0;
      /** @type {int32} */
      this.bitsAvailable = 0;
    }

    /**
     * @param {int32} count - Number of bits, least significant first
     * @returns {uint32} Value (missing bits read as 0)
     */
    readBits(count) {
      while (this.bitsAvailable < count) {
        if (this.inputPos + 1 < this.input.length) {
          /** @type {uint16} */
          const word = OpCodes.Pack16LE(this.input[this.inputPos], this.input[this.inputPos + 1]);
          this.inputPos += 2;
          this.bitBuf = OpCodes.Or32(this.bitBuf, OpCodes.Shl32(word, this.bitsAvailable));
          this.bitsAvailable += 16;
        } else if (this.inputPos < this.input.length) {
          this.bitBuf = OpCodes.Or32(this.bitBuf, OpCodes.Shl32(this.input[this.inputPos++], this.bitsAvailable));
          this.bitsAvailable += 8;
        } else {
          break;
        }
      }
      /** @type {int32} */
      const mask = OpCodes.Shl32(1, count) - 1;
      /** @type {uint32} */
      const result = OpCodes.And32(this.bitBuf, mask);
      this.bitBuf = OpCodes.Shr32(this.bitBuf, count);
      this.bitsAvailable -= count;
      return result;
    }
  }

  /**
   * @param {uint8[]} input - XPRESS Huffman chunks
   * @param {uint32} uncompressedSize - Number of bytes to produce
   * @returns {uint8[]} Decoded bytes
   */
  function decompressXpressHuffman(input, uncompressedSize) {
    /** @type {uint8[]} */
    const output = new Array(uncompressedSize);
    if (uncompressedSize === 0) {
      return output;
    }

    /** @type {XpressBitReader} */
    const reader = new XpressBitReader(input);
    /** @type {int32} */
    let outputPos = 0;

    while (outputPos < uncompressedSize) {
      reader.bitBuf = 0;
      reader.bitsAvailable = 0;

      if (reader.inputPos + HUFF_TABLE_HEADER_BYTES > input.length) {
        throw new Error("XPRESS Huffman compressed data is truncated.");
      }

      /** @type {int32[]} */
      const codeLengths = new Array(HUFF_SYMBOL_COUNT);
      for (let i = 0; i < HUFF_TABLE_HEADER_BYTES; i++) {
        /** @type {uint8} */
        const packedLengths = input[reader.inputPos + i];
        codeLengths[i * 2] = OpCodes.And32(packedLengths, 0xF);
        codeLengths[i * 2 + 1] = OpCodes.And32(OpCodes.Shr32(packedLengths, 4), 0xF);
      }
      reader.inputPos += HUFF_TABLE_HEADER_BYTES;

      /** @type {XpressDecodeTable} */
      const decode = buildDecodeTable(codeLengths);
      /** @type {int32[]} */
      const decodeTable = decode.table;
      /** @type {int32} */
      const maxCodeLength = decode.maxLen;

      /** @type {int32} */
      const chunkUncompressedSize = Math.min(HUFF_CHUNK_SIZE, OpCodes.Sub32(uncompressedSize, outputPos));
      /** @type {int32} */
      const chunkEnd = outputPos + chunkUncompressedSize;

      while (outputPos < chunkEnd) {
        while (reader.bitsAvailable < maxCodeLength && reader.inputPos + 1 < input.length) {
          /** @type {uint16} */
          const word = OpCodes.Pack16LE(input[reader.inputPos], input[reader.inputPos + 1]);
          reader.inputPos += 2;
          reader.bitBuf = OpCodes.Or32(reader.bitBuf, OpCodes.Shl32(word, reader.bitsAvailable));
          reader.bitsAvailable += 16;
        }
        /** @type {int32} */
        const peekMask = OpCodes.Shl32(1, maxCodeLength) - 1;
        /** @type {uint32} */
        const peek = OpCodes.And32(reader.bitBuf, peekMask);
        /** @type {int32} */
        const entry = decodeTable[peek];
        if (entry === undefined || entry < 0) {
          throw new Error("XPRESS Huffman compressed data contains an invalid Huffman code.");
        }
        /** @type {int32} */
        const codeLen = OpCodes.Shr32(entry, 16);
        reader.bitBuf = OpCodes.Shr32(reader.bitBuf, codeLen);
        reader.bitsAvailable -= codeLen;
        /** @type {uint32} */
        const sym = OpCodes.And32(entry, 0xFFFF);

        if (sym < 256) {
          output[outputPos++] = sym;
        } else {
          /** @type {int32} */
          const offsetLog2 = OpCodes.Shr32(sym - 256, 4);
          /** @type {uint32} */
          const lengthHeader = OpCodes.And32(sym - 256, 0xF);

          /** @type {float64} */
          let distance = 1;
          if (offsetLog2 !== 0) {
            /** @type {uint32} */
            const base = OpCodes.Shl32(1, offsetLog2);
            /** @type {uint32} */
            const extraBits = reader.readBits(offsetLog2);
            distance = base + extraBits;
          }

          /** @type {int32} */
          let length = 0;
          if (lengthHeader < 15) {
            length = lengthHeader + MIN_MATCH;
          } else {
            /** @type {uint32} */
            const extra = reader.readBits(8);
            if (extra !== LENGTH_SENTINEL_8) {
              length = extra + MIN_MATCH;
            } else {
              length = reader.readBits(16);
            }
          }

          /** @type {float64} */
          const copyFrom0 = outputPos - distance;
          if (copyFrom0 < 0) {
            throw new Error("XPRESS Huffman compressed data contains an invalid match descriptor.");
          }
          /** @type {int32} */
          let copyFrom = copyFrom0;
          /** @type {int32} */
          const copyEnd = Math.min(outputPos + length, chunkEnd);
          while (outputPos < copyEnd) {
            output[outputPos++] = output[copyFrom++];
          }
        }
      }

      /** @type {uint32} */
      const rewind = OpCodes.Shl32(Math.floor(reader.bitsAvailable / 16), 1);
      reader.inputPos -= rewind;
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class XpressCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "Xpress";
      this.description = "Microsoft's LZ77+Huffman compression algorithm ([MS-XCA]), used in WIM images, NTFS, and Hyper-V. Splits data into 64KB chunks, each with its own 512-symbol canonical Huffman table (256 literals + 256 length/offset-class match symbols) over an LSB-first, 16-bit-word-packed bit stream.";
      this.inventor = "Microsoft";
      this.year = 2014;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("[MS-XCA]: Xpress Compression Algorithm",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8")
      ];

      this.references = [
        new LinkItem("[MS-XCA] 2.1: LZ77+Huffman Compression Algorithm Details",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/",
          input: new Array(64).fill(0x41),
          roundTripOnly: true
        },
        {
          text: "Text sample",
          uri: "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          roundTripOnly: true
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {XpressInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new XpressInstance(this, isInverse);
    }
  }

  class XpressInstance extends IAlgorithmInstance {
    /**
     * @param {XpressCompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this._decompress(this.inputBuffer);
      } else {
        result = this._compress(this.inputBuffer);
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Size header and chunks
     */
    _compress(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(n);
      /** @type {uint8[]} */
      const body = compressXpressHuffman(input);
      for (let i = 0; i < body.length; i++) {
        header.push(body[i]);
      }
      return header;
    }

    /**
     * @param {uint8[]} input - Size header and chunks
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      if (input.length < 4) {
        throw new Error("Xpress: input smaller than 4-byte header.");
      }
      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalSize < 0) {
        throw new Error("Xpress: negative decompressed size.");
      }
      /** @type {uint8[]} */
      const decoded = decompressXpressHuffman(input.slice(4), originalSize);
      return decoded;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new XpressCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XpressCompression, XpressInstance };
}));
