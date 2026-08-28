/*
 * LZMS Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZMS ("LZ" + "MS") is Microsoft's dictionary-compression format introduced with
 * Windows 8 / WIMGAPI, used by the WIM (Windows Imaging Format) archiver and by
 * msdelta as the successor, in that product lineage, to LZX and Xpress-Huffman.
 *
 * Note: Microsoft has never published an [MS-XXXX] Open Specifications document for
 * LZMS. Everything publicly known about its bitstream comes from clean-room work,
 * most notably Eric Biggers' `wimlib` project (https://wimlib.net/ and
 * https://github.com/ebiggers/wimlib), whose documentation describes LZMS as LZ77
 * matching combined with two interleaved streams: a forward Huffman-coded stream
 * carrying literals, length symbols and offset slots, and a backward range-coded
 * stream carrying the binary literal/match, LZ/delta and repeat-offset decisions.
 * An optional x86 call/jmp address post-filter sits ahead of the main stage; the
 * filter is out of scope here and this file implements only the LZ77 core.
 *
 * This implementation follows that general, publicly-documented LZMS design but its
 * exact bitstream layout is a clean-room design of its own: it has NOT been checked
 * against, and is not intended to be bit-compatible with, Microsoft's encoder or
 * wimlib's decoder. Encoder and decoder below only need to agree with each other.
 *
 * Stream layout: [4-byte LE uncompressed size][forward Huffman bytes][range-coded
 * 16-bit words written backwards from the end of the buffer].
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

  // ===== CONSTANTS =====

  const NUM_LZ_OFFSET_SLOTS = 799;
  const NUM_RECENT_LZ_OFFSETS = 3;
  const NUM_RECENT_DELTA_OFFSETS = 3;
  const NUM_PROB_BITS = 6;
  const INITIAL_PROB = 32;              // 1 shifted left by (NUM_PROB_BITS - 1)
  const PROB_DENOMINATOR = 64;          // 1 shifted left by NUM_PROB_BITS
  const PROB_ADAPT_SHIFT = 4;

  const LITERAL_REBUILD_INTERVAL = 1024;
  const LZ_OFFSET_REBUILD_INTERVAL = 1024;
  const LENGTH_REBUILD_INTERVAL = 512;
  const DELTA_POWER_REBUILD_INTERVAL = 1024;
  const DELTA_OFFSET_REBUILD_INTERVAL = 1024;

  const NUM_LITERAL_SYMBOLS = 256;
  const NUM_LENGTH_SYMBOLS = 27;
  const NUM_DELTA_POWER_SYMBOLS = 8;
  const NUM_DELTA_OFFSET_SLOTS = 799;

  const MIN_MATCH_LENGTH = 2;
  const MAX_MATCH_LENGTH = 224;
  const MAX_CODE_LENGTH = 15;
  const MAX_TABLE_BITS = 12;
  const CHAIN_DEPTH = 64;

  const LENGTH_BASE = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24, 28, 32,
    40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224
  ];

  const LENGTH_EXTRA_BITS = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 0
  ];

  // ===== HUFFMAN HELPERS =====

  /**
   * Assigns code lengths in symbol order from the set of symbols with non-zero
   * frequency: the shortest possible uniform width, with the first
   * (2^width - count) symbols one bit shorter so the Kraft sum stays exactly 1.
   */
  function buildCodeLengths(freqs, numSymbols, maxLen) {
    const codeLens = new Array(numSymbols).fill(0);

    let nonZero = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (freqs[i] > 0) ++nonZero;
    }

    if (nonZero <= 1) {
      for (let i = 0; i < numSymbols; ++i) {
        if (freqs[i] > 0) codeLens[i] = 1;
      }
      return codeLens;
    }

    let bitsNeeded = 1;
    while (OpCodes.Shl32(1, bitsNeeded) < nonZero) ++bitsNeeded;
    bitsNeeded = Math.min(bitsNeeded, maxLen);

    const shortCount = OpCodes.Shl32(1, bitsNeeded) - nonZero;
    let assigned = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (freqs[i] <= 0) continue;
      codeLens[i] = (assigned < shortCount && bitsNeeded > 1) ? bitsNeeded - 1 : bitsNeeded;
      ++assigned;
    }

    return codeLens;
  }

  function maxCodeLength(codeLens, numSymbols) {
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLens[i] > maxLen) maxLen = codeLens[i];
    }
    return maxLen;
  }

  /** First code of each length for a canonical code, per the DEFLATE construction. */
  function firstCodes(codeLens, numSymbols, maxLen) {
    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLens[i] > 0) ++blCount[codeLens[i]];
    }

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxLen; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }
    return nextCode;
  }

  /** Canonical code value for every symbol, assigned in increasing symbol order. */
  function buildCanonicalCodes(codeLens, numSymbols) {
    const maxLen = maxCodeLength(codeLens, numSymbols);
    const codes = new Array(numSymbols).fill(0);
    if (maxLen === 0) return codes;

    const nextCode = firstCodes(codeLens, numSymbols, maxLen);
    for (let sym = 0; sym < numSymbols; ++sym) {
      const len = codeLens[sym];
      if (len <= 0) continue;
      codes[sym] = nextCode[len];
      nextCode[len] = nextCode[len] + 1;
    }
    return codes;
  }

  /** Flat lookup table mapping a peeked prefix to a packed (length, symbol) entry. */
  function buildDecodeTable(codeLens, numSymbols) {
    const maxLen = maxCodeLength(codeLens, numSymbols);
    if (maxLen === 0) return { table: [0, 0], tableBits: 1 };

    const tableBits = Math.min(maxLen, MAX_TABLE_BITS);
    const tableSize = OpCodes.Shl32(1, tableBits);
    const table = new Array(tableSize).fill(0);
    const nextCode = firstCodes(codeLens, numSymbols, maxLen);

    for (let sym = 0; sym < numSymbols; ++sym) {
      const len = codeLens[sym];
      if (len <= 0 || len > tableBits) continue;

      const code = nextCode[len];
      nextCode[len] = code + 1;

      const prefix = OpCodes.Shl32(code, tableBits - len);
      const fill = OpCodes.Shl32(1, tableBits - len);
      const entry = sym | OpCodes.Shl32(len, 16);
      for (let j = 0; j < fill && prefix + j < tableSize; ++j) {
        table[prefix + j] = entry;
      }
    }

    return { table: table, tableBits: tableBits };
  }

  function halveFrequencies(freqs, count) {
    for (let i = 0; i < count; ++i) {
      freqs[i] = Math.max(1, OpCodes.Shr32(freqs[i] + 1, 1));
    }
  }

  // ===== OFFSET AND LENGTH SLOTS =====

  /** Maps a match distance onto its offset slot (exponent plus one mantissa bit). */
  function offsetToSlot(offset) {
    if (offset <= 0) return 0;
    if (offset <= 2) return offset - 1;

    const value = offset - 1;
    let highBit = 0;
    let tmp = value;
    while (tmp > 1) {
      tmp = OpCodes.Shr32(tmp, 1);
      ++highBit;
    }

    const secondBit = OpCodes.Shr32(value, highBit - 1)&1;
    const slot = 2 * (highBit - 1) + secondBit + 2;
    return slot >= NUM_LZ_OFFSET_SLOTS ? NUM_LZ_OFFSET_SLOTS - 1 : slot;
  }

  function slotExtraBits(slot) {
    return slot < 2 ? 0 : Math.floor((slot - 2) / 2);
  }

  function slotBaseOffset(slot, extraBits) {
    return OpCodes.Shl32(2 + (slot&1), extraBits);
  }

  function lengthToSymbol(length) {
    for (let i = LENGTH_BASE.length - 1; i >= 0; --i) {
      if (length < LENGTH_BASE[i]) continue;
      return i;
    }
    return 0;
  }

  // ===== MATCH FINDER =====

  /** Hash-chain match finder over a 3-byte hash with a bounded chain walk. */
  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(32768).fill(-1);
      this.prev = new Int32Array(Math.max(1, windowSize));
      this.prevMask = Math.max(1, windowSize) - 1;
    }

    static Hash(data, position) {
      const mixed = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
        data[position + 2]);
      return OpCodes.And32(mixed, 0x7FFF);
    }

    FindMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = HashChainMatchFinder.Hash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[candidate&this.prevMask];
          ++chainCount;
          continue;
        }

        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) {
            ++length;
          }

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength) break;
          }
        }

        candidate = this.prev[candidate&this.prevMask];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      this.prev[position&this.prevMask] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }

    InsertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const hash = HashChainMatchFinder.Hash(data, position);
      this.prev[position&this.prevMask] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== COMPRESSOR =====

  /**
   * Produces the two interleaved streams. The range coder emits 16-bit words that
   * are laid down backwards from the end of the buffer, with carries propagated
   * into the words already emitted; the Huffman coder writes MSB-first bytes
   * forward from the start.
   */
  class LzmsCompressor {
    constructor() {
      this.fwdBytes = [];
      this.fwdAcc = 0;
      this.fwdAccBits = 0;

      this.rcWords = [];
      this.rcRange = 4294967295;
      this.rcLow = 0;

      this.probLzMatch = INITIAL_PROB;
      this.probDeltaMatch = INITIAL_PROB;
      this.probLzRepeat = new Array(NUM_RECENT_LZ_OFFSETS).fill(INITIAL_PROB);
      this.recentLzOffsets = [1, 1, 1];
    }

    Compress(data) {
      if (data.length === 0) return [];

      this.literalFreqs = new Array(NUM_LITERAL_SYMBOLS).fill(1);
      this.literalCount = 0;
      this._rebuildLiteral();

      this.lzOffsetFreqs = new Array(NUM_LZ_OFFSET_SLOTS).fill(1);
      this.lzOffsetCount = 0;
      this._rebuildLzOffset();

      this.lengthFreqs = new Array(NUM_LENGTH_SYMBOLS).fill(1);
      this.lengthCount = 0;
      this._rebuildLength();

      const matchFinder = new HashChainMatchFinder(data.length, CHAIN_DEPTH);
      let pos = 0;

      while (pos < data.length) {
        let best = { distance: 0, length: 0 };
        if (pos + 3 <= data.length) {
          best = matchFinder.FindMatch(data, pos,
            Math.min(pos, data.length),
            Math.min(MAX_MATCH_LENGTH, data.length - pos),
            MIN_MATCH_LENGTH);
        }

        if (best.length >= MIN_MATCH_LENGTH) {
          let recentIndex = -1;
          for (let i = 0; i < NUM_RECENT_LZ_OFFSETS; ++i) {
            if (this.recentLzOffsets[i] !== best.distance) continue;
            recentIndex = i;
            break;
          }

          this._encodeBit('probLzMatch', 1);
          this._encodeBit('probDeltaMatch', 0);

          if (recentIndex >= 0) {
            for (let i = 0; i < recentIndex; ++i) {
              this._encodeRepeatBit(i, 0);
            }
            this._encodeRepeatBit(recentIndex, 1);

            const offset = this.recentLzOffsets[recentIndex];
            for (let j = recentIndex; j > 0; --j) {
              this.recentLzOffsets[j] = this.recentLzOffsets[j - 1];
            }
            this.recentLzOffsets[0] = offset;
          } else {
            for (let i = 0; i < NUM_RECENT_LZ_OFFSETS; ++i) {
              this._encodeRepeatBit(i, 0);
            }

            const slot = offsetToSlot(best.distance);
            this._writeHuffman(slot, this.lzOffsetCodeLens, this.lzOffsetCodes, NUM_LZ_OFFSET_SLOTS);
            this._writeOffsetExtraBits(best.distance, slot);

            ++this.lzOffsetFreqs[slot];
            if (++this.lzOffsetCount >= LZ_OFFSET_REBUILD_INTERVAL) {
              this._rebuildLzOffset();
              halveFrequencies(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS);
              this.lzOffsetCount = 0;
            }

            this.recentLzOffsets[2] = this.recentLzOffsets[1];
            this.recentLzOffsets[1] = this.recentLzOffsets[0];
            this.recentLzOffsets[0] = best.distance;
          }

          this._encodeMatchLength(best.length);

          for (let i = 1; i < best.length && pos + i + 2 < data.length; ++i) {
            matchFinder.InsertPosition(data, pos + i);
          }
          pos += best.length;
        } else {
          this._encodeBit('probLzMatch', 0);
          this._writeLiteral(data[pos]);
          ++pos;
        }
      }

      this._flushRangeEncoder();
      this._flushForwardBits();
      return this._mergeStreams();
    }

    _rebuildLiteral() {
      this.literalCodeLens = buildCodeLengths(this.literalFreqs, NUM_LITERAL_SYMBOLS, MAX_CODE_LENGTH);
      this.literalCodes = buildCanonicalCodes(this.literalCodeLens, NUM_LITERAL_SYMBOLS);
    }

    _rebuildLzOffset() {
      this.lzOffsetCodeLens = buildCodeLengths(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS, MAX_CODE_LENGTH);
      this.lzOffsetCodes = buildCanonicalCodes(this.lzOffsetCodeLens, NUM_LZ_OFFSET_SLOTS);
    }

    _rebuildLength() {
      this.lengthCodeLens = buildCodeLengths(this.lengthFreqs, NUM_LENGTH_SYMBOLS, MAX_CODE_LENGTH);
      this.lengthCodes = buildCanonicalCodes(this.lengthCodeLens, NUM_LENGTH_SYMBOLS);
    }

    _writeLiteral(value) {
      this._writeHuffman(value, this.literalCodeLens, this.literalCodes, NUM_LITERAL_SYMBOLS);
      ++this.literalFreqs[value];
      if (++this.literalCount >= LITERAL_REBUILD_INTERVAL) {
        this._rebuildLiteral();
        halveFrequencies(this.literalFreqs, NUM_LITERAL_SYMBOLS);
        this.literalCount = 0;
      }
    }

    _encodeMatchLength(length) {
      const sym = lengthToSymbol(length);
      this._writeHuffman(sym, this.lengthCodeLens, this.lengthCodes, NUM_LENGTH_SYMBOLS);

      const extraBits = LENGTH_EXTRA_BITS[sym];
      if (extraBits > 0) {
        this._writeForwardBits(length - LENGTH_BASE[sym], extraBits);
      }

      ++this.lengthFreqs[sym];
      if (++this.lengthCount >= LENGTH_REBUILD_INTERVAL) {
        this._rebuildLength();
        halveFrequencies(this.lengthFreqs, NUM_LENGTH_SYMBOLS);
        this.lengthCount = 0;
      }
    }

    _writeOffsetExtraBits(offset, slot) {
      const extraBits = slotExtraBits(slot);
      if (extraBits <= 0) return;
      const base = slotBaseOffset(slot, extraBits);
      const extra = (offset - 1) - base;
      this._writeForwardBits(extra < 0 ? 0 : extra, extraBits);
    }

    _writeHuffman(symbol, codeLens, codes, numSymbols) {
      const sym = symbol >= numSymbols ? 0 : symbol;
      const len = codeLens[sym] <= 0 ? 1 : codeLens[sym];
      this._writeForwardBits(codes[sym], len);
    }

    // --- forward (Huffman) bitstream, MSB first ---

    _writeForwardBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        const bit = OpCodes.Shr32(value, i)&1;
        this.fwdAcc = this.fwdAcc * 2 + bit;
        ++this.fwdAccBits;
        if (this.fwdAccBits === 8) {
          this.fwdBytes.push(this.fwdAcc);
          this.fwdAcc = 0;
          this.fwdAccBits = 0;
        }
      }
    }

    _flushForwardBits() {
      if (this.fwdAccBits === 0) return;
      this.fwdBytes.push(OpCodes.Shl32(this.fwdAcc, 8 - this.fwdAccBits)&0xFF);
      this.fwdAcc = 0;
      this.fwdAccBits = 0;
    }

    // --- backward range-coded bitstream ---

    _encodeBit(probName, bit) {
      const prob = this[probName];
      const bound = OpCodes.Shr32(this.rcRange, NUM_PROB_BITS) * prob;
      if (bit === 0) {
        this.rcRange = bound;
        this[probName] = prob + OpCodes.Shr32(PROB_DENOMINATOR - prob, PROB_ADAPT_SHIFT);
      } else {
        this.rcLow += bound;
        this.rcRange = this.rcRange - bound;
        this[probName] = prob - OpCodes.Shr32(prob, PROB_ADAPT_SHIFT);
      }
      this._normalizeRangeEncoder();
    }

    _encodeRepeatBit(index, bit) {
      const prob = this.probLzRepeat[index];
      const bound = OpCodes.Shr32(this.rcRange, NUM_PROB_BITS) * prob;
      if (bit === 0) {
        this.rcRange = bound;
        this.probLzRepeat[index] = prob + OpCodes.Shr32(PROB_DENOMINATOR - prob, PROB_ADAPT_SHIFT);
      } else {
        this.rcLow += bound;
        this.rcRange = this.rcRange - bound;
        this.probLzRepeat[index] = prob - OpCodes.Shr32(prob, PROB_ADAPT_SHIFT);
      }
      this._normalizeRangeEncoder();
    }

    _normalizeRangeEncoder() {
      while (this.rcRange <= 0xFFFF) {
        this._emitRangeWord();
        this.rcRange = OpCodes.Shl32(this.rcRange, 16);
      }
    }

    _emitRangeWord() {
      const carry = Math.floor(this.rcLow / 4294967296);
      const word = Math.floor(this.rcLow / 65536) % 65536;

      if (carry !== 0) {
        for (let i = this.rcWords.length - 1; i >= 0; --i) {
          this.rcWords[i] = (this.rcWords[i] + 1) % 65536;
          if (this.rcWords[i] !== 0) break;
        }
      }

      this.rcWords.push(word);
      this.rcLow = (this.rcLow % 65536) * 65536;
    }

    _flushRangeEncoder() {
      for (let i = 0; i < 2; ++i) {
        this._emitRangeWord();
      }
      while (this.rcWords.length < 2) {
        this.rcWords.push(0);
      }
    }

    _mergeStreams() {
      const result = new Array(this.fwdBytes.length + this.rcWords.length * 2).fill(0);
      for (let i = 0; i < this.fwdBytes.length; ++i) {
        result[i] = this.fwdBytes[i];
      }

      // Word 0 occupies the final two bytes, word 1 the two before it, and so on.
      let pos = result.length;
      for (let i = 0; i < this.rcWords.length; ++i) {
        pos -= 2;
        result[pos] = this.rcWords[i]&0xFF;
        result[pos + 1] = OpCodes.Shr32(this.rcWords[i], 8)&0xFF;
      }

      return result;
    }
  }

  // ===== DECOMPRESSOR =====

  class LzmsDecompressor {
    constructor() {
      this.probLzMatch = INITIAL_PROB;
      this.probDeltaMatch = INITIAL_PROB;
      this.probLzRepeat = new Array(NUM_RECENT_LZ_OFFSETS).fill(INITIAL_PROB);
      this.probDeltaRepeat = new Array(NUM_RECENT_DELTA_OFFSETS).fill(INITIAL_PROB);
      this.recentLzOffsets = [1, 1, 1];
      this.recentDeltaPower = [0, 0, 0];
      this.recentDeltaOffset = [1, 1, 1];
    }

    Decompress(input, uncompressedSize) {
      if (uncompressedSize === 0) return [];
      if (input.length === 0) {
        throw new Error("LZMS decompression error: compressed data is empty");
      }

      this.input = input;
      const output = [];

      // Range decoder reads 16-bit words backwards from the end of the buffer.
      this.rcPos = input.length;
      this.rcRange = 4294967295;
      this.rcCode = 0;
      for (let i = 0; i < 4; ++i) {
        const next = this.rcPos > 0 ? input[--this.rcPos] : 0;
        this.rcCode = OpCodes.ToUint32(OpCodes.Shl32(this.rcCode, 8) | next);
      }

      // Forward Huffman bitstream reads MSB-first from the start of the buffer.
      this.fwdPos = 0;
      this.fwdAcc = 0;
      this.fwdAccBits = 0;

      this.literalFreqs = new Array(NUM_LITERAL_SYMBOLS).fill(1);
      this.literalCount = 0;
      this._rebuildLiteral();

      this.lzOffsetFreqs = new Array(NUM_LZ_OFFSET_SLOTS).fill(1);
      this.lzOffsetCount = 0;
      this._rebuildLzOffset();

      this.lengthFreqs = new Array(NUM_LENGTH_SYMBOLS).fill(1);
      this.lengthCount = 0;
      this._rebuildLength();

      this.deltaPowerFreqs = new Array(NUM_DELTA_POWER_SYMBOLS).fill(1);
      this.deltaPowerCount = 0;
      this._rebuildDeltaPower();

      this.deltaOffsetFreqs = new Array(NUM_DELTA_OFFSET_SLOTS).fill(1);
      this.deltaOffsetCount = 0;
      this._rebuildDeltaOffset();

      while (output.length < uncompressedSize) {
        if (this._decodeBit('probLzMatch') === 0) {
          const sym = this._decodeHuffman(this.literalTable, NUM_LITERAL_SYMBOLS);
          output.push(sym);

          ++this.literalFreqs[sym];
          if (++this.literalCount >= LITERAL_REBUILD_INTERVAL) {
            this._rebuildLiteral();
            halveFrequencies(this.literalFreqs, NUM_LITERAL_SYMBOLS);
            this.literalCount = 0;
          }
          continue;
        }

        if (this._decodeBit('probDeltaMatch') === 0) {
          this._decodeLzMatch(output, uncompressedSize);
        } else {
          this._decodeDeltaMatch(output, uncompressedSize);
        }
      }

      return output;
    }

    _decodeLzMatch(output, limit) {
      for (let i = 0; i < NUM_RECENT_LZ_OFFSETS; ++i) {
        if (this._decodeRepeatBit(this.probLzRepeat, i) === 0) continue;

        const offset = this.recentLzOffsets[i];
        for (let j = i; j > 0; --j) {
          this.recentLzOffsets[j] = this.recentLzOffsets[j - 1];
        }
        this.recentLzOffsets[0] = offset;

        this._copyMatch(output, offset, this._decodeMatchLength(), limit);
        return;
      }

      const slot = this._decodeHuffman(this.lzOffsetTable, NUM_LZ_OFFSET_SLOTS);
      const offset = this._decodeOffsetFromSlot(slot);

      ++this.lzOffsetFreqs[slot];
      if (++this.lzOffsetCount >= LZ_OFFSET_REBUILD_INTERVAL) {
        this._rebuildLzOffset();
        halveFrequencies(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS);
        this.lzOffsetCount = 0;
      }

      this.recentLzOffsets[2] = this.recentLzOffsets[1];
      this.recentLzOffsets[1] = this.recentLzOffsets[0];
      this.recentLzOffsets[0] = offset;

      this._copyMatch(output, offset, this._decodeMatchLength(), limit);
    }

    _decodeDeltaMatch(output, limit) {
      for (let i = 0; i < NUM_RECENT_DELTA_OFFSETS; ++i) {
        if (this._decodeRepeatBit(this.probDeltaRepeat, i) === 0) continue;

        const power = this.recentDeltaPower[i];
        const deltaOffset = this.recentDeltaOffset[i];
        for (let j = i; j > 0; --j) {
          this.recentDeltaPower[j] = this.recentDeltaPower[j - 1];
          this.recentDeltaOffset[j] = this.recentDeltaOffset[j - 1];
        }
        this.recentDeltaPower[0] = power;
        this.recentDeltaOffset[0] = deltaOffset;

        this._copyDeltaMatch(output, power, deltaOffset, this._decodeMatchLength(), limit);
        return;
      }

      const power = this._decodeHuffman(this.deltaPowerTable, NUM_DELTA_POWER_SYMBOLS);
      ++this.deltaPowerFreqs[power];
      if (++this.deltaPowerCount >= DELTA_POWER_REBUILD_INTERVAL) {
        this._rebuildDeltaPower();
        halveFrequencies(this.deltaPowerFreqs, NUM_DELTA_POWER_SYMBOLS);
        this.deltaPowerCount = 0;
      }

      const slot = this._decodeHuffman(this.deltaOffsetTable, NUM_DELTA_OFFSET_SLOTS);
      const deltaOffset = this._decodeOffsetFromSlot(slot);
      ++this.deltaOffsetFreqs[slot];
      if (++this.deltaOffsetCount >= DELTA_OFFSET_REBUILD_INTERVAL) {
        this._rebuildDeltaOffset();
        halveFrequencies(this.deltaOffsetFreqs, NUM_DELTA_OFFSET_SLOTS);
        this.deltaOffsetCount = 0;
      }

      this.recentDeltaPower[2] = this.recentDeltaPower[1];
      this.recentDeltaPower[1] = this.recentDeltaPower[0];
      this.recentDeltaPower[0] = power;
      this.recentDeltaOffset[2] = this.recentDeltaOffset[1];
      this.recentDeltaOffset[1] = this.recentDeltaOffset[0];
      this.recentDeltaOffset[0] = deltaOffset;

      this._copyDeltaMatch(output, power, deltaOffset, this._decodeMatchLength(), limit);
    }

    _decodeMatchLength() {
      const sym = this._decodeHuffman(this.lengthTable, NUM_LENGTH_SYMBOLS);

      ++this.lengthFreqs[sym];
      if (++this.lengthCount >= LENGTH_REBUILD_INTERVAL) {
        this._rebuildLength();
        halveFrequencies(this.lengthFreqs, NUM_LENGTH_SYMBOLS);
        this.lengthCount = 0;
      }

      let length = LENGTH_BASE[sym];
      const extraBits = LENGTH_EXTRA_BITS[sym];
      if (extraBits > 0) {
        length += this._readForwardBits(extraBits);
      }
      return length;
    }

    _decodeOffsetFromSlot(slot) {
      if (slot < 2) return slot + 1;
      const extraBits = slotExtraBits(slot);
      const base = slotBaseOffset(slot, extraBits);
      const extra = extraBits > 0 ? this._readForwardBits(extraBits) : 0;
      return base + extra + 1;
    }

    _copyMatch(output, offset, length, limit) {
      const srcStart = output.length - offset;
      if (srcStart < 0) {
        throw new Error("LZMS decompression error: match offset exceeds output buffer");
      }
      for (let i = 0; i < length && output.length < limit; ++i) {
        output.push(output[srcStart + i]);
      }
    }

    /**
     * Delta match: the byte-level differences at stride 2^power repeat at the
     * given offset, so each byte is the previous byte one span back plus the
     * difference observed one offset earlier.
     */
    _copyDeltaMatch(output, power, deltaOffset, length, limit) {
      const span = OpCodes.Shl32(1, power);
      const srcOffset = deltaOffset + span;
      for (let i = 0; i < length && output.length < limit; ++i) {
        const outPos = output.length;
        const prevAtSpan = outPos - span >= 0 ? output[outPos - span] : 0;
        const srcPos = outPos - srcOffset;
        const srcPrev = srcPos - span;
        const matchByte = srcPos >= 0 ? output[srcPos] : 0;
        const matchPrev = srcPrev >= 0 ? output[srcPrev] : 0;
        output.push((prevAtSpan + matchByte - matchPrev)&0xFF);
      }
    }

    _rebuildLiteral() {
      this.literalTable = buildDecodeTable(
        buildCodeLengths(this.literalFreqs, NUM_LITERAL_SYMBOLS, MAX_CODE_LENGTH), NUM_LITERAL_SYMBOLS);
    }

    _rebuildLzOffset() {
      this.lzOffsetTable = buildDecodeTable(
        buildCodeLengths(this.lzOffsetFreqs, NUM_LZ_OFFSET_SLOTS, MAX_CODE_LENGTH), NUM_LZ_OFFSET_SLOTS);
    }

    _rebuildLength() {
      this.lengthTable = buildDecodeTable(
        buildCodeLengths(this.lengthFreqs, NUM_LENGTH_SYMBOLS, MAX_CODE_LENGTH), NUM_LENGTH_SYMBOLS);
    }

    _rebuildDeltaPower() {
      this.deltaPowerTable = buildDecodeTable(
        buildCodeLengths(this.deltaPowerFreqs, NUM_DELTA_POWER_SYMBOLS, MAX_CODE_LENGTH), NUM_DELTA_POWER_SYMBOLS);
    }

    _rebuildDeltaOffset() {
      this.deltaOffsetTable = buildDecodeTable(
        buildCodeLengths(this.deltaOffsetFreqs, NUM_DELTA_OFFSET_SLOTS, MAX_CODE_LENGTH), NUM_DELTA_OFFSET_SLOTS);
    }

    // --- backward range-coded bitstream ---

    _decodeBit(probName) {
      const prob = this[probName];
      const bound = OpCodes.Shr32(this.rcRange, NUM_PROB_BITS) * prob;
      let bit;
      if (this.rcCode < bound) {
        this.rcRange = bound;
        this[probName] = prob + OpCodes.Shr32(PROB_DENOMINATOR - prob, PROB_ADAPT_SHIFT);
        bit = 0;
      } else {
        this.rcCode = this.rcCode - bound;
        this.rcRange = this.rcRange - bound;
        this[probName] = prob - OpCodes.Shr32(prob, PROB_ADAPT_SHIFT);
        bit = 1;
      }
      this._normalizeRangeDecoder();
      return bit;
    }

    _decodeRepeatBit(probs, index) {
      const prob = probs[index];
      const bound = OpCodes.Shr32(this.rcRange, NUM_PROB_BITS) * prob;
      let bit;
      if (this.rcCode < bound) {
        this.rcRange = bound;
        probs[index] = prob + OpCodes.Shr32(PROB_DENOMINATOR - prob, PROB_ADAPT_SHIFT);
        bit = 0;
      } else {
        this.rcCode = this.rcCode - bound;
        this.rcRange = this.rcRange - bound;
        probs[index] = prob - OpCodes.Shr32(prob, PROB_ADAPT_SHIFT);
        bit = 1;
      }
      this._normalizeRangeDecoder();
      return bit;
    }

    _normalizeRangeDecoder() {
      while (this.rcRange < 65536) {
        this.rcRange = OpCodes.Shl32(this.rcRange, 16);
        this.rcCode = OpCodes.Shl32(this.rcCode, 16);
        if (this.rcPos >= 2) {
          this.rcCode = OpCodes.ToUint32(
            this.rcCode | this.input[this.rcPos - 2] | OpCodes.Shl32(this.input[this.rcPos - 1], 8));
          this.rcPos -= 2;
        }
      }
    }

    // --- forward (Huffman) bitstream, MSB first ---

    _fillForwardBits(count) {
      while (this.fwdAccBits < count) {
        const next = this.fwdPos < this.input.length ? this.input[this.fwdPos++] : 0;
        this.fwdAcc = this.fwdAcc * 256 + next;
        this.fwdAccBits += 8;
      }
    }

    _peekForwardBits(count) {
      this._fillForwardBits(count);
      return Math.floor(this.fwdAcc / Math.pow(2, this.fwdAccBits - count));
    }

    _consumeForwardBits(count) {
      this.fwdAcc = this.fwdAcc % Math.pow(2, this.fwdAccBits - count);
      this.fwdAccBits -= count;
    }

    _readForwardBits(count) {
      const value = this._peekForwardBits(count);
      this._consumeForwardBits(count);
      return value;
    }

    _decodeHuffman(decodeTable, numSymbols) {
      const table = decodeTable.table;
      const tableBits = decodeTable.tableBits;
      if (table.length === 0 || tableBits === 0) return 0;

      const peek = this._peekForwardBits(tableBits);
      const entry = table[peek];
      const sym = entry&0xFFFF;
      let len = OpCodes.Shr32(entry, 16);
      if (len < 1) len = tableBits;
      this._consumeForwardBits(len);
      return sym < numSymbols ? sym : 0;
    }
  }

  // ===== LZMS ALGORITHM =====

  class LZMSAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZMS";
      this.description = "Microsoft's LZ77 compression format, introduced with Windows 8 for the WIM (Windows Imaging Format) archiver and msdelta, succeeding LZX/Xpress-Huffman in that lineage. Interleaves a forward Huffman stream for literals, lengths and offset slots with a backward range-coded stream for the binary decisions. Clean-room implementation: no official Microsoft specification exists.";
      this.inventor = "Microsoft Corporation";
      this.year = 2012;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("wimlib - free implementation of the WIM/SWM/ESD formats (documents the reverse-engineered LZMS design)", "https://wimlib.net/"),
        new LinkItem("wimlib source repository", "https://github.com/ebiggers/wimlib")
      ];

      this.references = [
        new LinkItem("Windows Imaging Format (WIM) overview", "https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-imaging-file-format-wim"),
        new LinkItem("LZMA SDK - adaptive binary range coder reference design", "https://www.7-zip.org/sdk.html")
      ];

      // Test vectors - confirmed to round-trip and to match the reference
      // implementation of the same stream layout byte for byte.
      const repetitive = new Array(300).fill(0x42);

      const alternating = [];
      for (let i = 0; i < 256; i++) alternating.push(i % 2 === 0 ? 0xAA : 0x55);

      // Deterministic pseudo-random binary sample (no Math.random - keeps the vector stable).
      const pseudoRandom = [];
      let seed = 0x2A6F11C3;
      for (let i = 0; i < 512; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        pseudoRandom.push(seed % 256);
      }

      this.tests = [
        new TestCase(
          [],
          [0, 0, 0, 0],
          "LZMS - empty input (header only)",
          "https://wimlib.net/"
        ),
        new TestCase(
          [0x21],
          [1, 0, 0, 0, 33, 0, 0, 0, 0],
          "LZMS - single byte",
          "https://wimlib.net/"
        ),
        new TestCase(
          repetitive,
          [44, 1, 0, 0, 66, 254, 44, 222, 31, 94, 92],
          "LZMS - long repetitive run (300x 0x42)",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          alternating,
          [0, 1, 0, 0, 170, 85, 0, 254, 112, 223, 152, 113, 38],
          "LZMS - alternating byte pattern (0xAA/0x55)",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          pseudoRandom,
          [0, 2, 0, 0, 0, 0, 64, 128, 0, 64, 0, 16, 32, 142, 0, 164, 64, 128, 128, 32, 69, 32, 62, 32, 18, 3, 197, 128, 10, 116, 5, 75, 0, 12, 6, 5, 64, 154, 160, 92, 176, 224, 21, 238, 2, 192, 193, 151, 48, 65, 88, 12, 65, 61, 96, 191, 32, 94, 176, 24, 151, 1, 90, 232, 36, 176, 15, 152, 49, 70, 14, 141, 96, 230, 196, 24, 245, 130, 133, 64, 18, 7, 0, 64, 187, 108, 23, 173, 3, 135, 96, 52, 14, 130, 169, 64, 173, 64, 81, 8, 50, 98, 8, 11, 6, 157, 1, 37, 1, 252, 172, 25, 85, 131, 131, 112, 25, 39, 1, 61, 96, 173, 124, 16, 157, 6, 104, 193, 110, 96, 142, 64, 163, 130, 12, 32, 131, 56, 32, 226, 132, 28, 99, 1, 220, 176, 33, 57, 1, 96, 224, 62, 242, 5, 235, 96, 224, 20, 11, 5, 160, 60, 130, 177, 96, 220, 168, 25, 49, 2, 200, 194, 222, 108, 47, 156, 115, 188, 186, 16, 195, 72, 155, 255, 38, 211, 163, 170, 255, 57, 41, 7, 126, 131, 80, 100, 3],
          "LZMS - pseudo-random binary sample",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("This WIM (Windows Imaging Format) image uses LZMS compression for maximum ratio."),
          [80, 0, 0, 0, 84, 104, 105, 115, 32, 87, 73, 77, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 73, 109, 97, 103, 105, 110, 103, 32, 70, 111, 114, 109, 97, 116, 41, 32, 105, 3, 226, 202, 64, 234, 230, 202, 230, 64, 152, 180, 154, 166, 64, 198, 222, 218, 224, 228, 202, 230, 230, 210, 222, 220, 64, 204, 222, 228, 64, 218, 194, 240, 210, 218, 234, 218, 64, 228, 194, 232, 210, 222, 92, 0, 0, 79, 18, 87, 46, 0, 0],
          "LZMS - WIM-flavoured text",
          "https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-imaging-file-format-wim"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZMSInstance(this, isInverse);
    }
  }

  // ===== LZMS INSTANCE =====

  class LZMSInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? this._decompress(data) : this._compress(data);
    }

    _compress(data) {
      // 4-byte little-endian uncompressed size header
      const output = [
        OpCodes.And32(data.length, 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF)
      ];

      const payload = new LzmsCompressor().Compress(data);
      for (let i = 0; i < payload.length; ++i) {
        output.push(payload[i]);
      }
      return output;
    }

    _decompress(data) {
      if (data.length < 4) return [];
      const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (uncompressedSize === 0) return [];
      return new LzmsDecompressor().Decompress(data.slice(4), uncompressedSize);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZMSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZMSAlgorithm, LZMSInstance };
}));
