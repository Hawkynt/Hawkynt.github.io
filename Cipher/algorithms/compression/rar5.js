/*
 * RAR5 (LZ + multi-table Huffman) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RAR 5.0 is the archive format introduced with WinRAR 5 in 2013. Its default
 * compression method is an LZ77 stage over a power-of-two dictionary (128KB
 * minimum) whose tokens are entropy coded with four Huffman tables, all of
 * which are serialised at the head of every block through a 20-symbol
 * "pre-code" tree:
 *   - main table (306 symbols): literals 0-255, four repeated-offset symbols,
 *     a filter symbol, an end-of-block symbol, and match-length slots from 262
 *   - offset table (64 symbols): distance slots, each with a number of extra
 *     bits derived from the slot index
 *   - low-offset table (16 symbols): the low four bits of long distances
 *   - length table (44 symbols): match lengths for repeated-offset matches
 * Bits are written most-significant-first. Each block is preceded by a
 * byte-aligned header carrying flags (padding bits in the last byte, size
 * field width, last-block and table-present markers), a checksum byte
 * (0x5A xor flags xor the size bytes) and a 1-3 byte little-endian block size.
 *
 * This building block additionally prefixes a 4-byte little-endian
 * uncompressed size so a bare block round-trips without archive framing.
 *
 * This is a documented-subset implementation of the RAR5 block coding: the
 * encoder emits literals and plain matches only - no PPM modelling and no
 * delta/E8E9/ARM filter blocks - while the decoder tolerates the repeated
 * offset, filter and end-of-block symbols. Distances carry an implicit match
 * length bonus (+1 above 256, +2 above 8192, +3 above 262144) that the encoder
 * subtracts and the decoder adds back.
 *
 * References:
 * - RARLAB, "RAR 5.0 archive format" technical note
 * - Wikipedia, RAR (file format)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', './huffman-code-lengths.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./huffman-code-lengths.data')
    );
  } else {
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  if (!HuffmanCodeLengths)
    throw new Error('HuffmanCodeLengths dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const MAX_CODE_LENGTH = 15;
  const MAIN_TABLE_SIZE = 306;
  const OFFSET_TABLE_SIZE = 64;
  const LOW_OFFSET_TABLE_SIZE = 16;
  const LENGTH_TABLE_SIZE = 44;
  const CODE_LENGTH_TABLE_SIZE = 20;

  const LITERAL_COUNT = 256;
  const REPEAT_OFFSET0 = 256;
  const REPEAT_OFFSET3 = 259;
  const END_OF_BLOCK = 261;
  const MATCH_BASE = 262;

  const MIN_DICTIONARY_SIZE = 128 * 1024;
  const MAX_MATCH_LENGTH = 0x101 + 8;
  const MIN_MATCH_LENGTH = 2;

  function distanceExtraBits(slot) {
    return slot < 4 ? 0 : OpCodes.Shr32(slot - 2, 1);
  }

  function distanceBase(slot) {
    if (slot < 4) return slot;
    return OpCodes.Shl32(2 + OpCodes.AndN(slot, 1), OpCodes.Shr32(slot - 2, 1));
  }

  // RAR5 grants extra length to matches at large distances.
  function lengthBonus(distance) {
    let bonus = 0;
    if (distance > 0x100) ++bonus;
    if (distance > 0x2000) ++bonus;
    if (distance > 0x40000) ++bonus;
    return bonus;
  }

  function distanceSlot(distance) {
    if (distance < 4) return distance;
    const p = 31 - Math.clz32(distance);
    return 2 * p + OpCodes.AndN(OpCodes.Shr32(distance, p - 1), 1);
  }

  function lengthSlotBase(slot) {
    const lBits = Math.floor(slot / 4) - 1;
    return { lBits: lBits, baseLen: 2 + OpCodes.Shl32(OpCodes.OrN(4, OpCodes.AndN(slot, 3)), lBits) };
  }

  function lengthSlot(length) {
    if (length <= 9) return length - 2;
    for (let slot = 43; slot >= 8; --slot) {
      const info = lengthSlotBase(slot);
      if (length >= info.baseLen && length <= info.baseLen + OpCodes.Shl32(1, info.lBits) - 1)
        return slot;
    }
    return 43;
  }

  // ===== BIT I/O (MSB-first) =====

  class Rar5BitWriter {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitsUsed = 0;
      this.bitCount = 0;
    }

    writeBits(value, count) {
      if (count > 0) {
        const masked = OpCodes.AndN(value, OpCodes.BitMask(count));
        this.bitBuffer = OpCodes.ToUint32(
          OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(masked, 32 - this.bitsUsed - count))
        );
      }
      this.bitsUsed += count;
      this.bitCount += count;
      while (this.bitsUsed >= 8) {
        this.bytes.push(OpCodes.AndN(OpCodes.Shr32(this.bitBuffer, 24), 0xFF));
        this.bitBuffer = OpCodes.Shl32(this.bitBuffer, 8);
        this.bitsUsed -= 8;
      }
    }

    // Copies bitCount bits out of an MSB-first packed byte array.
    writeBytes(data, bitCount) {
      let remaining = bitCount;
      let index = 0;
      while (remaining >= 8) {
        this.writeBits(data[index++], 8);
        remaining -= 8;
      }
      if (remaining > 0)
        this.writeBits(OpCodes.Shr32(data[index], 8 - remaining), remaining);
    }

    toArray() {
      const out = this.bytes.slice();
      if (this.bitsUsed > 0)
        out.push(OpCodes.AndN(OpCodes.Shr32(this.bitBuffer, 24), 0xFF));
      return out;
    }
  }

  class Rar5BitReader {
    constructor(data) {
      this.data = data;
      this.bytePos = 0;
      this.bitBuffer = 0;
      this.bitsAvailable = 0;
    }

    get isAtEnd() {
      return this.bytePos >= this.data.length && this.bitsAvailable === 0;
    }

    fill(count) {
      while (this.bitsAvailable < count && this.bytePos < this.data.length) {
        this.bitBuffer = OpCodes.ToUint32(
          OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(this.data[this.bytePos++], 24 - this.bitsAvailable))
        );
        this.bitsAvailable += 8;
      }
    }

    readBits(count) {
      if (count <= 0) return 0;
      this.fill(count);
      const value = OpCodes.Shr32(this.bitBuffer, 32 - count);
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, count);
      this.bitsAvailable -= count;
      return value;
    }

    peekBits(count) {
      this.fill(count);
      return OpCodes.Shr32(this.bitBuffer, 32 - count);
    }

    dropBits(count) {
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, count);
      this.bitsAvailable -= count;
    }

    alignToByte() {
      const drop = OpCodes.AndN(this.bitsAvailable, 7);
      if (drop <= 0) return;
      this.bitBuffer = OpCodes.Shl32(this.bitBuffer, drop);
      this.bitsAvailable -= drop;
    }
  }

  // ===== HUFFMAN CODE CONSTRUCTION =====

  function clampAndFixKraft(lengths, numSymbols, maxBits) {
    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > maxBits) lengths[i] = maxBits;

    const kraftMax = OpCodes.Shl32(1, maxBits);
    let kraftSum = 0;
    for (let i = 0; i < numSymbols; ++i)
      if (lengths[i] > 0) kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);

    while (kraftSum > kraftMax) {
      for (let i = numSymbols - 1; i >= 0; --i) {
        if (lengths[i] > 0 && lengths[i] < maxBits) {
          kraftSum -= OpCodes.Shr32(kraftMax, lengths[i]);
          ++lengths[i];
          kraftSum += OpCodes.Shr32(kraftMax, lengths[i]);
          if (kraftSum <= kraftMax) break;
        }
      }
    }
  }

  function buildCodeLengths(frequencies, numSymbols, maxBits) {
    // Ties between equally frequent symbols are broken by the total order documented
    // in huffman-code-lengths.data.js, so the tree shape follows from the frequencies
    // alone rather than from any container's ordering of equal keys.
    const lengths = HuffmanCodeLengths.buildCodeLengths(frequencies, numSymbols);
    clampAndFixKraft(lengths, numSymbols, maxBits);
    return lengths;
  }

  function buildCanonicalCodes(lengths, numSymbols) {
    let maxLen = 0;
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > maxLen) maxLen = lengths[i];

    const codes = new Array(numSymbols).fill(0);
    if (maxLen === 0) return codes;

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < lengths.length; ++i)
      if (lengths[i] > 0) ++blCount[lengths[i]];

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxLen; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }

    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] <= 0) continue;
      codes[i] = nextCode[lengths[i]]++;
    }

    return codes;
  }

  class Rar5HuffmanEncoder {
    build(frequencies, numSymbols) {
      this.codeLengths = buildCodeLengths(frequencies, numSymbols, MAX_CODE_LENGTH);
      this.codes = buildCanonicalCodes(this.codeLengths, numSymbols);
    }

    encodeSymbol(writer, symbol) {
      writer.writeBits(this.codes[symbol], this.codeLengths[symbol]);
    }
  }

  // ===== HUFFMAN DECODING =====

  const QUICK_BITS = 10;
  const QUICK_SIZE = OpCodes.Shl32(1, QUICK_BITS);
  const SLOW_FLAG = 0x80000000;

  class Rar5HuffmanDecoder {
    constructor() {
      this.quickTable = null;
      this.maxCodeLength = 0;
      this.slowSymbols = null;
      this.slowCodes = null;
      this.slowLengths = null;
      this.slowCount = 0;
    }

    build(codeLengths, numSymbols) {
      this.maxCodeLength = 0;
      this.slowCount = 0;

      let numUsed = 0;
      for (let i = 0; i < numSymbols; ++i) {
        if (codeLengths[i] <= 0) continue;
        this.maxCodeLength = Math.max(this.maxCodeLength, codeLengths[i]);
        ++numUsed;
      }

      if (numUsed === 0) {
        this.quickTable = new Int32Array(QUICK_SIZE).fill(-1);
        return;
      }

      if (numUsed === 1) {
        let singleSymbol = 0;
        for (let i = 0; i < numSymbols; ++i)
          if (codeLengths[i] > 0) { singleSymbol = i; break; }
        const entry = OpCodes.OrN(singleSymbol, OpCodes.Shl32(1, 16));
        this.quickTable = new Int32Array(QUICK_SIZE).fill(entry);
        return;
      }

      if (this.maxCodeLength > MAX_CODE_LENGTH)
        this.maxCodeLength = MAX_CODE_LENGTH;

      const blCount = new Array(this.maxCodeLength + 1).fill(0);
      for (let i = 0; i < numSymbols; ++i) {
        const len = codeLengths[i];
        if (len > 0 && len <= this.maxCodeLength) ++blCount[len];
      }

      const nextCode = new Array(this.maxCodeLength + 1).fill(0);
      let code = 0;
      for (let bits = 1; bits <= this.maxCodeLength; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      this.quickTable = new Int32Array(QUICK_SIZE).fill(-1);

      for (let sym = 0; sym < numSymbols; ++sym) {
        const len = codeLengths[sym];
        if (len === 0 || len > this.maxCodeLength) continue;

        const c = nextCode[len]++;
        const entry = OpCodes.OrN(sym, OpCodes.Shl32(len, 16));

        if (len <= QUICK_BITS) {
          const prefix = OpCodes.Shl32(c, QUICK_BITS - len);
          const suffixCount = OpCodes.Shl32(1, QUICK_BITS - len);
          for (let j = 0; j < suffixCount; ++j) this.quickTable[prefix + j] = entry;
        } else {
          const prefix = OpCodes.Shr32(c, len - QUICK_BITS);
          if (this.quickTable[prefix] === -1)
            this.quickTable[prefix] = OpCodes.OrN(entry, SLOW_FLAG);
        }
      }

      this._buildSlowTable(codeLengths, numSymbols);
    }

    _buildSlowTable(codeLengths, numSymbols) {
      let count = 0;
      for (let i = 0; i < numSymbols; ++i)
        if (codeLengths[i] > QUICK_BITS && codeLengths[i] <= this.maxCodeLength) ++count;

      if (count === 0) {
        this.slowCount = 0;
        return;
      }

      this.slowSymbols = new Array(count).fill(0);
      this.slowCodes = new Array(count).fill(0);
      this.slowLengths = new Array(count).fill(0);
      this.slowCount = count;

      const blCount = new Array(this.maxCodeLength + 1).fill(0);
      for (let i = 0; i < numSymbols; ++i) {
        const len = codeLengths[i];
        if (len > 0 && len <= this.maxCodeLength) ++blCount[len];
      }

      const nextCode = new Array(this.maxCodeLength + 1).fill(0);
      let code = 0;
      for (let bits = 1; bits <= this.maxCodeLength; ++bits) {
        code = OpCodes.Shl32(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      let index = 0;
      for (let sym = 0; sym < numSymbols; ++sym) {
        const len = codeLengths[sym];
        const c = nextCode[len]++;
        if (len <= QUICK_BITS || len > this.maxCodeLength) continue;
        this.slowSymbols[index] = sym;
        this.slowCodes[index] = c;
        this.slowLengths[index] = len;
        ++index;
      }
    }

    decodeSymbol(reader) {
      if (this.quickTable === null) throw new Error('RAR5: Huffman table has not been built');

      reader.fill(this.maxCodeLength);
      const bits = reader.peekBits(QUICK_BITS);
      const entry = this.quickTable[bits];

      if (entry >= 0) {
        const symbol = OpCodes.AndN(entry, 0xFFFF);
        const length = OpCodes.AndN(OpCodes.Shr32Signed(entry, 16), 0x7FFF);
        reader.dropBits(length);
        return symbol;
      }

      if (entry !== -1 && OpCodes.AndN(entry, SLOW_FLAG) !== 0)
        return this._decodeSlowPath(reader);

      reader.dropBits(1);
      return 0;
    }

    _decodeSlowPath(reader) {
      if (this.slowCount === 0) return 0;

      const bits = reader.peekBits(this.maxCodeLength);
      for (let i = 0; i < this.slowCount; ++i) {
        const len = this.slowLengths[i];
        const topBits = OpCodes.Shr32(bits, this.maxCodeLength - len);
        if (topBits !== this.slowCodes[i]) continue;
        reader.dropBits(len);
        return this.slowSymbols[i];
      }

      reader.dropBits(1);
      return 0;
    }
  }

  // ===== MATCH FINDER =====

  const HASH_BITS = 15;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const HASH_MASK = HASH_SIZE - 1;
  const MAX_CHAIN_DEPTH = 128;

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
    }

    _hash(data, position) {
      return OpCodes.AndN(
        OpCodes.XorN(
          OpCodes.XorN(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = this._hash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.AndN(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        if (bestLength === 0 ||
            (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) ++length;

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;
            if (bestLength >= maxLength) break;
          }
        }

        candidate = this.prev[OpCodes.AndN(candidate, this.prevMask)];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      this.prev[OpCodes.AndN(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength
        ? { distance: bestDistance, length: bestLength }
        : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const hash = this._hash(data, position);
      this.prev[OpCodes.AndN(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== ENCODER =====

  function ensureAtLeastTwo(frequencies) {
    let count = 0;
    for (let i = 0; i < frequencies.length; ++i)
      if (frequencies[i] > 0) ++count;

    // A single-symbol table would let the decoder consume zero bits, so pad to
    // at least two used symbols.
    if (count === 0) {
      frequencies[0] = 1;
      frequencies[1] = 1;
      return;
    }
    if (count === 1) {
      for (let i = 0; i < frequencies.length; ++i)
        if (frequencies[i] === 0) { frequencies[i] = 1; break; }
    }
  }

  // Pre-code RLE alphabet: 0-15 direct lengths, 16 repeat previous (3 extra
  // bits, +3), 17 repeat previous (7 extra bits, +11), 18 zero run (3 extra
  // bits, +3), 19 zero run (7 extra bits, +11).
  function computeRleSequence(codeLengths, numSymbols) {
    const rle = [];
    let i = 0;

    while (i < numSymbols) {
      if (codeLengths[i] === 0) {
        let run = 1;
        while (i + run < numSymbols && codeLengths[i + run] === 0) ++run;
        i += run;

        while (run > 0) {
          if (run >= 11) {
            const count = Math.min(run, 138);
            rle.push({ sym: 19, extraBits: 7, extraValue: count - 11 });
            run -= count;
          } else if (run >= 3) {
            const count = Math.min(run, 10);
            rle.push({ sym: 18, extraBits: 3, extraValue: count - 3 });
            run -= count;
          } else {
            rle.push({ sym: 0, extraBits: 0, extraValue: 0 });
            --run;
          }
        }
        continue;
      }

      const value = codeLengths[i];
      rle.push({ sym: value, extraBits: 0, extraValue: 0 });
      ++i;

      let repeat = 0;
      while (i < numSymbols && codeLengths[i] === value) { ++repeat; ++i; }

      while (repeat > 0) {
        if (repeat >= 11) {
          const count = Math.min(repeat, 138);
          rle.push({ sym: 17, extraBits: 7, extraValue: count - 11 });
          repeat -= count;
        } else if (repeat >= 3) {
          const count = Math.min(repeat, 10);
          rle.push({ sym: 16, extraBits: 3, extraValue: count - 3 });
          repeat -= count;
        } else {
          rle.push({ sym: value, extraBits: 0, extraValue: 0 });
          --repeat;
        }
      }
    }

    return rle;
  }

  function writeLengthExtra(writer, slot, length) {
    if (slot < 8) return;
    const info = lengthSlotBase(slot);
    writer.writeBits(length - info.baseLen, info.lBits);
  }

  function encodeDistance(writer, distance, offsetEncoder, lowOffsetEncoder) {
    const dist0 = distance - 1;
    const slot = distanceSlot(dist0);
    offsetEncoder.encodeSymbol(writer, slot);

    const extraBits = distanceExtraBits(slot);
    if (extraBits <= 0) return;

    const extra = dist0 - distanceBase(slot);
    if (extraBits >= 4) {
      if (extraBits > 4) writer.writeBits(OpCodes.Shr32(extra, 4), extraBits - 4);
      lowOffsetEncoder.encodeSymbol(writer, OpCodes.AndN(extra, 0xF));
      return;
    }

    writer.writeBits(extra, extraBits);
  }

  function writeBlockHeader(writer, blockBitSize, tablePresent, lastBlock) {
    const bitsToAlign = (8 - (writer.bitCount % 8)) % 8;
    if (bitsToAlign > 0) writer.writeBits(0, bitsToAlign);

    const blockSize = Math.floor((blockBitSize + 7) / 8);
    const paddingBits = blockSize * 8 - blockBitSize;

    let byteCount;
    if (blockSize <= 0xFF) byteCount = 1;
    else if (blockSize <= 0xFFFF) byteCount = 2;
    else byteCount = 3;

    const blockFlags = OpCodes.AndN(
      OpCodes.OrN(
        OpCodes.OrN(OpCodes.AndN(7 - paddingBits, 0x07), OpCodes.Shl32(OpCodes.AndN(byteCount - 1, 0x03), 3)),
        OpCodes.OrN(lastBlock ? 0x40 : 0x00, tablePresent ? 0x80 : 0x00)
      ),
      0xFF
    );

    let checkSum = OpCodes.AndN(OpCodes.XorN(0x5A, blockFlags), 0xFF);
    for (let i = 0; i < byteCount; ++i)
      checkSum = OpCodes.AndN(OpCodes.XorN(checkSum, OpCodes.AndN(OpCodes.Shr32(blockSize, i * 8), 0xFF)), 0xFF);

    writer.writeBits(blockFlags, 8);
    writer.writeBits(checkSum, 8);
    for (let i = 0; i < byteCount; ++i)
      writer.writeBits(OpCodes.AndN(OpCodes.Shr32(blockSize, i * 8), 0xFF), 8);
  }

  function rar5Compress(data) {
    if (data.length === 0) return [];

    const dictionarySize = MIN_DICTIONARY_SIZE;
    const matchFinder = new HashChainMatchFinder(dictionarySize, MAX_CHAIN_DEPTH);

    // ---- LZ token collection ----
    const tokens = [];
    let pos = 0;
    while (pos < data.length) {
      const match = matchFinder.findMatch(data, pos, dictionarySize, MAX_MATCH_LENGTH, MIN_MATCH_LENGTH);
      const bonus = lengthBonus(match.distance);

      if (match.length >= MIN_MATCH_LENGTH + bonus) {
        const useLength = match.length;
        tokens.push({ isLiteral: false, literal: 0, length: useLength - bonus, distance: match.distance });
        for (let i = 1; i < useLength && pos + i < data.length; ++i)
          matchFinder.insertPosition(data, pos + i);
        pos += useLength;
        continue;
      }

      tokens.push({ isLiteral: true, literal: data[pos], length: 0, distance: 0 });
      ++pos;
    }

    // ---- frequency tables ----
    const mainFreq = new Array(MAIN_TABLE_SIZE).fill(0);
    const offsetFreq = new Array(OFFSET_TABLE_SIZE).fill(0);
    const lowOffsetFreq = new Array(LOW_OFFSET_TABLE_SIZE).fill(0);
    const lengthFreq = new Array(LENGTH_TABLE_SIZE).fill(0);

    for (let i = 0; i < tokens.length; ++i) {
      const token = tokens[i];
      if (token.isLiteral) {
        ++mainFreq[token.literal];
        continue;
      }
      ++mainFreq[MATCH_BASE + lengthSlot(token.length)];
      const slot = distanceSlot(token.distance - 1);
      ++offsetFreq[slot];
      if (distanceExtraBits(slot) >= 4)
        ++lowOffsetFreq[OpCodes.AndN((token.distance - 1) - distanceBase(slot), 0xF)];
    }

    ensureAtLeastTwo(mainFreq);
    ensureAtLeastTwo(offsetFreq);
    ensureAtLeastTwo(lowOffsetFreq);
    ensureAtLeastTwo(lengthFreq);

    const mainEncoder = new Rar5HuffmanEncoder();
    const offsetEncoder = new Rar5HuffmanEncoder();
    const lowOffsetEncoder = new Rar5HuffmanEncoder();
    const lengthEncoder = new Rar5HuffmanEncoder();

    mainEncoder.build(mainFreq, MAIN_TABLE_SIZE);
    offsetEncoder.build(offsetFreq, OFFSET_TABLE_SIZE);
    lowOffsetEncoder.build(lowOffsetFreq, LOW_OFFSET_TABLE_SIZE);
    lengthEncoder.build(lengthFreq, LENGTH_TABLE_SIZE);

    // ---- block body: serialised tables, then tokens ----
    const blockWriter = new Rar5BitWriter();

    const rleSequences = [
      computeRleSequence(mainEncoder.codeLengths, MAIN_TABLE_SIZE),
      computeRleSequence(offsetEncoder.codeLengths, OFFSET_TABLE_SIZE),
      computeRleSequence(lowOffsetEncoder.codeLengths, LOW_OFFSET_TABLE_SIZE),
      computeRleSequence(lengthEncoder.codeLengths, LENGTH_TABLE_SIZE)
    ];

    const preCodeFreq = new Array(CODE_LENGTH_TABLE_SIZE).fill(0);
    for (let s = 0; s < rleSequences.length; ++s)
      for (let i = 0; i < rleSequences[s].length; ++i)
        ++preCodeFreq[rleSequences[s][i].sym];

    const preCodeEncoder = new Rar5HuffmanEncoder();
    preCodeEncoder.build(preCodeFreq, CODE_LENGTH_TABLE_SIZE);

    // Pre-code lengths, 4 bits each. A literal 15 is escaped by a following
    // zero nibble so it cannot be read as a zero-fill directive.
    for (let i = 0; i < CODE_LENGTH_TABLE_SIZE; ++i) {
      blockWriter.writeBits(preCodeEncoder.codeLengths[i], 4);
      if (preCodeEncoder.codeLengths[i] === 15) blockWriter.writeBits(0, 4);
    }

    for (let s = 0; s < rleSequences.length; ++s) {
      const sequence = rleSequences[s];
      for (let i = 0; i < sequence.length; ++i) {
        preCodeEncoder.encodeSymbol(blockWriter, sequence[i].sym);
        if (sequence[i].extraBits > 0)
          blockWriter.writeBits(sequence[i].extraValue, sequence[i].extraBits);
      }
    }

    for (let i = 0; i < tokens.length; ++i) {
      const token = tokens[i];
      if (token.isLiteral) {
        mainEncoder.encodeSymbol(blockWriter, token.literal);
        continue;
      }
      const slot = lengthSlot(token.length);
      mainEncoder.encodeSymbol(blockWriter, MATCH_BASE + slot);
      writeLengthExtra(blockWriter, slot, token.length);
      encodeDistance(blockWriter, token.distance, offsetEncoder, lowOffsetEncoder);
    }

    const blockBitSize = blockWriter.bitCount;
    const blockBytes = blockWriter.toArray();

    const writer = new Rar5BitWriter();
    writeBlockHeader(writer, blockBitSize, true, true);
    writer.writeBytes(blockBytes, blockBitSize);
    return writer.toArray();
  }

  // ===== DECODER =====

  function slotToLength(reader, slot) {
    if (slot < 8) return slot + 2;
    const info = lengthSlotBase(slot);
    let length = info.baseLen;
    if (info.lBits > 0) length += reader.readBits(info.lBits);
    return length;
  }

  function readCodeLengths(reader, preCodeDecoder, count) {
    const lengths = new Array(count).fill(0);
    let i = 0;

    while (i < count) {
      const sym = preCodeDecoder.decodeSymbol(reader);

      if (sym < 16) { lengths[i++] = sym; continue; }

      if (sym === 16 || sym === 17) {
        if (i === 0) throw new Error('RAR5: code length repeat at start of table');
        const repeat = sym === 16 ? reader.readBits(3) + 3 : reader.readBits(7) + 11;
        const previous = lengths[i - 1];
        for (let j = 0; j < repeat && i < count; ++j) lengths[i++] = previous;
        continue;
      }

      if (sym === 18 || sym === 19) {
        const repeat = sym === 18 ? reader.readBits(3) + 3 : reader.readBits(7) + 11;
        for (let j = 0; j < repeat && i < count; ++j) lengths[i++] = 0;
        continue;
      }

      throw new Error('RAR5: invalid pre-code symbol');
    }

    return lengths;
  }

  class Rar5Decoder {
    constructor(dictionarySize) {
      let size = 1;
      while (size < dictionarySize) size = OpCodes.Shl32(size, 1);
      this.window = new Uint8Array(size);
      this.windowMask = size - 1;
      this.windowPos = 0;
      this.repDist = [0, 0, 0, 0];
      this.lastLength = 0;
      this.mainDecoder = new Rar5HuffmanDecoder();
      this.offsetDecoder = new Rar5HuffmanDecoder();
      this.lowOffsetDecoder = new Rar5HuffmanDecoder();
      this.lengthDecoder = new Rar5HuffmanDecoder();
      this.tablesRead = false;
    }

    _readTables(reader) {
      const preCodeLengths = new Array(CODE_LENGTH_TABLE_SIZE).fill(0);

      // A raw 15 followed by a non-zero nibble means "fill count+2 zeros";
      // followed by a zero nibble it is a literal length of 15.
      for (let i = 0; i < CODE_LENGTH_TABLE_SIZE;) {
        const len = reader.readBits(4);
        if (len === 15) {
          const count = reader.readBits(4);
          if (count !== 0) {
            for (let j = 0; j < count + 2 && i < CODE_LENGTH_TABLE_SIZE; ++j) preCodeLengths[i++] = 0;
            continue;
          }
        }
        preCodeLengths[i++] = len;
      }

      const preCodeDecoder = new Rar5HuffmanDecoder();
      preCodeDecoder.build(preCodeLengths, CODE_LENGTH_TABLE_SIZE);

      this.mainDecoder.build(readCodeLengths(reader, preCodeDecoder, MAIN_TABLE_SIZE), MAIN_TABLE_SIZE);
      this.offsetDecoder.build(readCodeLengths(reader, preCodeDecoder, OFFSET_TABLE_SIZE), OFFSET_TABLE_SIZE);
      this.lowOffsetDecoder.build(readCodeLengths(reader, preCodeDecoder, LOW_OFFSET_TABLE_SIZE), LOW_OFFSET_TABLE_SIZE);
      this.lengthDecoder.build(readCodeLengths(reader, preCodeDecoder, LENGTH_TABLE_SIZE), LENGTH_TABLE_SIZE);
    }

    _decodeDistance(reader) {
      const slot = this.offsetDecoder.decodeSymbol(reader);
      if (slot < 4) return slot + 1;

      const extraBits = OpCodes.Shr32(slot - 2, 1);
      const baseDist = OpCodes.Shl32(2 + OpCodes.AndN(slot, 1), extraBits);

      if (extraBits >= 4) {
        const highBits = extraBits > 4 ? reader.readBits(extraBits - 4) : 0;
        const lowBits = this.lowOffsetDecoder.decodeSymbol(reader);
        return baseDist + OpCodes.Shl32(highBits, 4) + lowBits + 1;
      }

      return baseDist + reader.readBits(extraBits) + 1;
    }

    _copyMatch(output, outputPos, maxOutput, distance, length) {
      let copied = 0;
      for (let i = 0; i < length && outputPos + copied < maxOutput; ++i) {
        const b = this.window[OpCodes.AndN(this.windowPos - distance, this.windowMask)];
        output[outputPos + copied] = b;
        this.window[OpCodes.AndN(this.windowPos, this.windowMask)] = b;
        ++this.windowPos;
        ++copied;
      }
      return copied;
    }

    decompress(compressed, uncompressedSize) {
      if (uncompressedSize === 0) return [];

      const reader = new Rar5BitReader(compressed);
      const output = new Array(uncompressedSize).fill(0);
      let outputPos = 0;

      this.tablesRead = false;

      while (outputPos < uncompressedSize && !reader.isAtEnd) {
        if (!this.tablesRead) {
          reader.alignToByte();

          const blockFlags = reader.readBits(8);
          reader.readBits(8); // header checksum byte

          const byteCount = OpCodes.AndN(OpCodes.Shr32(blockFlags, 3), 3) + 1;
          if (byteCount === 4) throw new Error('RAR5: invalid block header size field');

          for (let b = 0; b < byteCount; ++b) reader.readBits(8); // block size, unused here

          if (OpCodes.AndN(blockFlags, 0x80) !== 0) this._readTables(reader);
          this.tablesRead = true;
        }

        const sym = this.mainDecoder.decodeSymbol(reader);

        if (sym < LITERAL_COUNT) {
          output[outputPos] = sym;
          this.window[OpCodes.AndN(this.windowPos, this.windowMask)] = sym;
          ++this.windowPos;
          ++outputPos;
          continue;
        }

        if (sym >= MATCH_BASE && sym < MAIN_TABLE_SIZE) {
          let matchLength = slotToLength(reader, sym - MATCH_BASE);
          let distance = this._decodeDistance(reader);
          if (distance < 0) distance = 0;

          matchLength += lengthBonus(distance);

          this.repDist[3] = this.repDist[2];
          this.repDist[2] = this.repDist[1];
          this.repDist[1] = this.repDist[0];
          this.repDist[0] = distance;
          this.lastLength = matchLength;

          outputPos += this._copyMatch(output, outputPos, uncompressedSize, distance, matchLength);
          continue;
        }

        if (sym >= REPEAT_OFFSET0 && sym <= REPEAT_OFFSET3) {
          const repIndex = sym - REPEAT_OFFSET0;
          const distance = this.repDist[repIndex];
          for (let i = repIndex; i > 0; --i) this.repDist[i] = this.repDist[i - 1];
          this.repDist[0] = distance;

          let matchLength;
          if (sym === REPEAT_OFFSET0) {
            matchLength = this.lastLength;
            if (matchLength === 0) matchLength = 2;
          } else {
            matchLength = slotToLength(reader, this.lengthDecoder.decodeSymbol(reader));
          }

          this.lastLength = matchLength;
          outputPos += this._copyMatch(output, outputPos, uncompressedSize, distance, matchLength);
          continue;
        }

        if (sym === END_OF_BLOCK) this.tablesRead = false;
      }

      return output;
    }
  }

  // ===== BUILDING BLOCK CONTAINER =====

  function blockCompress(data) {
    const compressed = rar5Compress(data);
    const size = OpCodes.ToUint32(data.length);
    const out = [
      OpCodes.AndN(size, 0xFF),
      OpCodes.AndN(OpCodes.Shr32(size, 8), 0xFF),
      OpCodes.AndN(OpCodes.Shr32(size, 16), 0xFF),
      OpCodes.AndN(OpCodes.Shr32(size, 24), 0xFF)
    ];
    for (let i = 0; i < compressed.length; ++i) out.push(compressed[i]);
    return out;
  }

  function blockDecompress(data) {
    if (data.length < 4) return [];

    const originalSize = OpCodes.ToUint32(
      OpCodes.OrN(
        OpCodes.OrN(OpCodes.OrN(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)),
        OpCodes.Shl32(data[3], 24)
      )
    );

    const decoder = new Rar5Decoder(MIN_DICTIONARY_SIZE);
    return decoder.decompress(data.slice(4), originalSize);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class Rar5Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "RAR5";
      this.description = "Block compression stage of the RAR 5.0 archive format: LZ77 over a 128KB dictionary whose literals, match-length slots, distance slots and low-distance nibbles are entropy coded with four Huffman tables, themselves serialised through a 20-symbol pre-code with run-length escapes. Bits are most-significant-first and each block carries a byte-aligned flags/checksum/size header. Documented-subset implementation covering literals and plain matches; PPM modelling and the delta/E8E9/ARM filters are out of scope.";
      this.inventor = "Eugene Roshal";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.documentation = [
        new LinkItem("RARLAB - RAR 5.0 archive format technical note", "https://www.rarlab.com/technote.htm"),
        new LinkItem("Wikipedia - RAR (file format)", "https://en.wikipedia.org/wiki/RAR_(file_format)"),
        new LinkItem("Wikipedia - LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("RARLAB - UnRAR source distribution", "https://www.rarlab.com/rar_add.htm"),
        new LinkItem("7-Zip - contains an independent RAR5 decoder", "https://www.7-zip.org/"),
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://ieeexplore.ieee.org/document/4051119")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Rar reference implementation (4-byte LE size prefix + one RAR5 block).
      this.tests = [
        new TestCase(
          [],
          [0x00, 0x00, 0x00, 0x00],
          "Empty input - size prefix only, no block emitted",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          [0x41],
          [
            0x01, 0x00, 0x00, 0x00, 0xc0, 0x88, 0x12, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, 0x5a, 0xbf, 0xf6, 0xcb, 0x32, 0x0c, 0x9f, 0x80
          ],
          "Single byte - one literal plus the four Huffman tables",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          [
            0xb4, 0x00, 0x00, 0x00, 0xc2, 0xa5, 0x3d, 0x53, 0x45, 0x43, 0x40, 0x00, 0x00, 0x00, 0x00, 0x30,
            0x32, 0x0a, 0xfc, 0x05, 0xc2, 0x7e, 0x81, 0xf3, 0x93, 0x5c, 0xe7, 0xfa, 0x1b, 0x04, 0xb0, 0x45,
            0x99, 0xec, 0x42, 0xa4, 0x00, 0x54, 0x24, 0x1f, 0x9a, 0x0c, 0x21, 0x44, 0xfa, 0xb1, 0xe4, 0x4a,
            0xce, 0x1f, 0x95, 0xc2, 0xa8, 0xd7, 0xc8, 0x15, 0x4d, 0x11, 0xaf, 0x33, 0xbc, 0xe0, 0x7c, 0x47,
            0xeb, 0x73, 0xc0, 0xa0
          ],
          "Text sample repeated 4x",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          new Array(256).fill(0x61),
          [
            0x00, 0x01, 0x00, 0x00, 0xc7, 0x8e, 0x13, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, 0xd6, 0x7f, 0xd5, 0x21, 0x4b, 0x32, 0x0c, 0x9f, 0x7a
          ],
          "Long repetitive run - 256 identical bytes",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          [0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42, 0x41, 0x42],
          [
            0x0c, 0x00, 0x00, 0x00, 0xc0, 0x8f, 0x15, 0x02, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01, 0x36, 0xf7, 0xf3, 0x68, 0x62, 0x8c, 0xe8, 0x0e, 0x87, 0xec, 0x80
          ],
          "Alternating two-byte pattern - ABABABABABAB",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          [
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x21, 0x55, 0xbe, 0x08, 0x3d, 0xc4, 0x71, 0xaa,
            0x9e, 0x1f, 0xd2, 0x4b, 0x6a, 0x0c, 0xf7, 0x83, 0x11, 0x62, 0xef, 0x90, 0x4d, 0x7c, 0x38, 0xa1
          ],
          [
            0x20, 0x00, 0x00, 0x00, 0xc0, 0xa4, 0x3e, 0x44, 0x00, 0x32, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x22, 0x68, 0x81, 0x24, 0x08, 0xe2, 0x16, 0x24, 0x81, 0x1c, 0x30, 0x80, 0x8c, 0x16, 0x3c, 0x59,
            0x01, 0x20, 0x47, 0x70, 0xdd, 0x08, 0xca, 0xd0, 0x2d, 0x11, 0xcc, 0xd0, 0x9d, 0x1a, 0xf5, 0xfc,
            0xb7, 0xfe, 0x07, 0xff, 0x1f, 0xf4, 0x4e, 0xb9, 0x7a, 0xf2, 0x57, 0x17, 0x50, 0xb4, 0x0d, 0xe1,
            0x84, 0xed, 0xb7, 0x3f, 0x80
          ],
          "Pseudo-random binary sample with one repeated run",
          "https://www.rarlab.com/technote.htm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Optimal parsing minimises the total token cost, not the local match length."),
          [
            0x4b, 0x00, 0x00, 0x00, 0xc7, 0xda, 0x47, 0x33, 0x05, 0x33, 0x30, 0x00, 0x00, 0x00, 0x00, 0x50,
            0x42, 0x0a, 0xf8, 0x01, 0x96, 0x0a, 0xe0, 0x35, 0x55, 0x45, 0x64, 0x5a, 0x7c, 0x55, 0xa7, 0x8f,
            0xfd, 0x6a, 0xc1, 0xd7, 0xd5, 0x8a, 0xdb, 0x01, 0xb6, 0x1f, 0xf3, 0x65, 0xa3, 0x0e, 0x37, 0x8f,
            0xad, 0xa7, 0x42, 0x1a, 0x5a, 0x1a, 0xd2, 0xc1, 0x54, 0x06, 0x8f, 0x2c, 0xd7, 0xa9, 0x23, 0x35,
            0x67, 0xa1, 0x34, 0x7f, 0x97, 0xac, 0xf2, 0x63, 0x07, 0x2a, 0x1d, 0x27, 0x45, 0x7b
          ],
          "English text with short interior repeats",
          "https://www.rarlab.com/technote.htm"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new Rar5Instance(this, isInverse);
    }
  }

  class Rar5Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) return blockDecompress(data);
      return blockCompress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Rar5Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { Rar5Compression, Rar5Instance };
}));
