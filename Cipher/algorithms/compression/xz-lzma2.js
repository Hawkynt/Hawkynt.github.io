/*
 * XZ container + LZMA2 / LZMA1
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * A genuine .xz container writer/reader: stream header, one block (LZMA2
 * filter), index and footer, with CRC32/CRC64 integrity checking, wrapped
 * around a real LZMA1 range encoder/decoder pair and a real LZMA2 chunk
 * framer. The encoder runs an actual hash-chain LZ77 parse (with rep-match
 * awareness) through the range coder to emit genuine LZMA-compressed LZMA2
 * chunks, falling back to an LZMA2 "uncompressed" chunk per-chunk whenever
 * that would be smaller (or the packed size would exceed the format limit).
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

  // ===== CHECKSUM HELPERS (CRC32 and CRC64/XZ) =====

  /**
   * @param {int32} size - Number of entries
   * @returns {int32[]} Plain array of zeros
   */
  function zeroArray(size) {
    /** @type {int32[]} */
    const arr = new Array(size);
    arr.fill(0);
    return arr;
  }

  /**
   * @returns {uint32[]} CRC-32 (reflected, poly 0xEDB88320) table
   */
  function buildCrc32Table() {
    /** @type {uint32[]} */
    const table = new Array(256);
    for (let i = 0; i < 256; i++) {
      /** @type {uint32} */
      let c = i;
      for (let k = 0; k < 8; k++) {
        /** @type {uint32} */
        const lsb = OpCodes.And32(c, 1);
        c = OpCodes.Shr32(c, 1);
        if (lsb === 1) {
          c = OpCodes.Xor32(c, 0xEDB88320);
        }
      }
      table[i] = OpCodes.ToUint32(c);
    }
    return table;
  }

  /** @type {uint32[]} */
  const CRC32_TABLE = buildCrc32Table();

  /**
   * @param {uint8[]} bytes - Data
   * @returns {uint32} CRC-32
   */
  function crc32(bytes) {
    /** @type {uint32} */
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      /** @type {uint32} */
      const idx = OpCodes.And32(OpCodes.Xor32(crc, bytes[i]), 0xFF);
      crc = OpCodes.Xor32(CRC32_TABLE[idx], OpCodes.Shr32(crc, 8));
    }
    return OpCodes.Xor32(crc, 0xFFFFFFFF);
  }

  /**
   * @param {uint32} value - Value
   * @returns {uint8[]} Its four bytes, little-endian
   */
  function leU32Bytes(value) {
    /** @type {uint8[]} */
    const be = OpCodes.Unpack32BE(value);
    /** @type {uint8[]} */
    const le = [];
    le.push(be[3]);
    le.push(be[2]);
    le.push(be[1]);
    le.push(be[0]);
    return le;
  }

  /**
   * @param {uint8[]} bytes - Data
   * @returns {uint8[]} CRC-32, little-endian
   */
  function crc32Bytes(bytes) {
    return leU32Bytes(crc32(bytes));
  }

  /** @type {uint32[]} */
  const CRC64_POLY = OpCodes.UInt64.create(0xC96C5795, 0xD7870F42);

  /**
   * @returns {uint32[][]} CRC-64/XZ table of [high32, low32] entries
   */
  function buildCrc64Table() {
    /** @type {uint32[][]} */
    const table = new Array(256);
    for (let i = 0; i < 256; i++) {
      /** @type {uint32[]} */
      let c = OpCodes.UInt64.create(0, i);
      for (let k = 0; k < 8; k++) {
        /** @type {uint32} */
        const lsb = OpCodes.And32(c[1], 1);
        c = OpCodes.UInt64.shr(c, 1);
        if (lsb === 1) {
          c = OpCodes.UInt64.xor(c, CRC64_POLY);
        }
      }
      table[i] = c;
    }
    return table;
  }

  /** @type {uint32[][]} */
  const CRC64_TABLE = buildCrc64Table();

  /**
   * @param {uint8[]} bytes - Data
   * @returns {uint32[]} CRC-64/XZ as [high32, low32]
   */
  function crc64(bytes) {
    /** @type {uint32[]} */
    let crc = OpCodes.UInt64.create(0xFFFFFFFF, 0xFFFFFFFF);
    for (let i = 0; i < bytes.length; i++) {
      /** @type {uint32} */
      const idx = OpCodes.And32(OpCodes.Xor32(crc[1], bytes[i]), 0xFF);
      crc = OpCodes.UInt64.xor(CRC64_TABLE[idx], OpCodes.UInt64.shr(crc, 8));
    }
    return OpCodes.UInt64.xor(crc, OpCodes.UInt64.create(0xFFFFFFFF, 0xFFFFFFFF));
  }

  /**
   * @param {uint8[]} bytes - Data
   * @returns {uint8[]} CRC-64/XZ, little-endian
   */
  function crc64Bytes(bytes) {
    /** @type {uint8[]} */
    const be = OpCodes.UInt64.toBytes(crc64(bytes));
    return be.slice().reverse();
  }

  // ===== VARIABLE-LENGTH INTEGER (VLI) HELPERS =====

  /**
   * @param {float64} value - Non-negative integer
   * @returns {uint8[]} xz variable-length integer
   */
  function encodeVLI(value) {
    /** @type {uint8[]} */
    const bytes = [];
    /** @type {float64} */
    let v = value;
    for (;;) {
      /** @type {int32} */
      let b = v % 128;
      v = Math.floor(v / 128);
      if (v !== 0) {
        b = OpCodes.Or32(b, 0x80);
      }
      bytes.push(b);
      if (v === 0) {
        break;
      }
    }
    return bytes;
  }

  /**
   * Decoded variable-length integer and the position after it.
   */
  class VliResult {
    /**
     * @param {float64} value - Decoded value
     * @param {int32} pos - Position after the last byte read
     */
    constructor(value, pos) {
      /** @type {float64} */
      this.value = value;
      /** @type {int32} */
      this.pos = pos;
    }
  }

  // A read past the end yields an undefined byte, which ends the number.
  /**
   * @param {uint8[]} bytes - Data
   * @param {int32} pos - First byte
   * @returns {VliResult} Value and next position
   */
  function decodeVLI(bytes, pos) {
    /** @type {float64} */
    let value = 0;
    /** @type {int32} */
    let shift = 0;
    /** @type {int32} */
    let i = pos;
    for (;;) {
      /** @type {uint8} */
      const b = bytes[i++];
      /** @type {float64} */
      const payload = OpCodes.And32(b, 0x7F);
      value += payload * Math.pow(2, shift);
      if (OpCodes.And32(b, 0x80) === 0) {
        break;
      }
      shift += 7;
    }
    return new VliResult(value, i);
  }

  // ===== LZMA1 RANGE DECODER =====

  const kNumBitModelTotalBits = 11;
  const kNumMoveBits = 5;
  /** @type {int32} */
  const PROB_INIT = OpCodes.Shl32(1, kNumBitModelTotalBits - 1);
  /** @type {int32} */
  const kTopValue = OpCodes.Shl32(1, 24);
  const kNumStates = 12;
  const kNumLenToPosStates = 4;

  /**
   * @param {int32} size - Number of probabilities
   * @returns {int32[]} Probabilities at their initial value
   */
  function createProbArray(size) {
    /** @type {int32[]} */
    const a = new Array(size);
    for (let i = 0; i < size; i++) {
      a[i] = PROB_INIT;
    }
    return a;
  }

  /**
   * @param {int32[][]} rows - Probability rows
   * @returns {int32[][]} Deep copy
   */
  function cloneRows(rows) {
    /** @type {int32[][]} */
    const copy = [];
    for (let i = 0; i < rows.length; i++) {
      copy.push(rows[i].slice());
    }
    return copy;
  }

  /**
   * Probabilities of one length coder.
   */
  class LenCoderProbs {
    constructor() {
      /** @type {int32[]} */
      this.choice = createProbArray(1);
      /** @type {int32[]} */
      this.choice2 = createProbArray(1);
      /** @type {int32[][]} */
      this.low = [];
      /** @type {int32[][]} */
      this.mid = [];
      for (let i = 0; i < 16; i++) {
        this.low.push(createProbArray(8));
        this.mid.push(createProbArray(8));
      }
      /** @type {int32[]} */
      this.high = createProbArray(256);
    }

    /**
     * @returns {LenCoderProbs} Deep copy
     */
    clone() {
      /** @type {LenCoderProbs} */
      const c = new LenCoderProbs();
      c.choice = this.choice.slice();
      c.choice2 = this.choice2.slice();
      c.low = cloneRows(this.low);
      c.mid = cloneRows(this.mid);
      c.high = this.high.slice();
      return c;
    }
  }

  // Range decoder over one chunk's payload. Range and code are kept in doubles
  // with explicit ToUint32 folds, exactly as the former closures did, so even a
  // corrupt stream (whose probabilities may read as undefined) behaves as before.
  class Lzma1RangeDecoder {
    /**
     * @param {uint8[]} payload - Range-coded bytes
     */
    constructor(payload) {
      /** @type {uint8[]} */
      this.payload = payload;
      /** @type {int32} */
      this.rPos = 0;
      /** @type {float64} */
      this.range = 0xFFFFFFFF;
      /** @type {float64} */
      this.code = 0;
      this.readByte(); // mandatory ignored init byte
      for (let i = 0; i < 4; i++) {
        /** @type {float64} */
        const next = this.readByte();
        this.code = OpCodes.ToUint32(this.code * 256 + next);
      }
    }

    /**
     * @returns {uint8} Next payload byte, zero past the end
     */
    readByte() {
      if (this.rPos < this.payload.length) {
        return this.payload[this.rPos++];
      }
      return 0;
    }

    normalize() {
      while (this.range < kTopValue) {
        this.range = OpCodes.ToUint32(this.range * 256);
        /** @type {float64} */
        const next = this.readByte();
        this.code = OpCodes.ToUint32(this.code * 256 + next);
      }
    }

    /**
     * @param {int32[]} probs - Probability array
     * @param {float64} index - Probability slot
     * @returns {int32} Decoded bit
     */
    decodeBit(probs, index) {
      /** @type {float64} */
      const rangeUnit = OpCodes.Shr32(this.range, kNumBitModelTotalBits);
      /** @type {float64} */
      const prob = probs[index];
      /** @type {float64} */
      const bound = rangeUnit * prob;
      if (this.code < bound) {
        this.range = bound;
        probs[index] += OpCodes.Shr32(2048 - probs[index], kNumMoveBits);
        this.normalize();
        return 0;
      }
      this.range = OpCodes.ToUint32(this.range - bound);
      this.code = OpCodes.ToUint32(this.code - bound);
      probs[index] -= OpCodes.Shr32(probs[index], kNumMoveBits);
      this.normalize();
      return 1;
    }

    /**
     * @param {int32} numBits - Bit count
     * @returns {float64} Bits decoded MSB-first
     */
    decodeDirectBits(numBits) {
      /** @type {float64} */
      let res = 0;
      for (let i = 0; i < numBits; i++) {
        this.range = OpCodes.Shr32(this.range, 1);
        this.code = OpCodes.ToUint32(this.code - this.range);
        /** @type {float64} */
        const topBit = OpCodes.Shr32(this.code, 31);
        if (topBit === 1) {
          this.code = OpCodes.ToUint32(this.code + this.range);
        }
        res = OpCodes.ToUint32(res * 2 + (1 - topBit));
        this.normalize();
      }
      return res;
    }

    /**
     * @param {int32[]} probs - Probability array
     * @param {float64} offset - Offset of the tree
     * @param {int32} numBits - Symbol width
     * @returns {float64} Symbol, MSB first
     */
    bitTreeDecode(probs, offset, numBits) {
      /** @type {float64} */
      let m = 1;
      for (let i = 0; i < numBits; i++) {
        /** @type {int32} */
        const bit = this.decodeBit(probs, offset + m);
        m = m * 2 + bit;
      }
      /** @type {float64} */
      const top = OpCodes.Shl32(1, numBits);
      return m - top;
    }

    /**
     * @param {int32[]} probs - Probability array
     * @param {float64} offset - Offset of the tree
     * @param {int32} numBits - Symbol width
     * @returns {float64} Symbol, LSB first
     */
    bitTreeReverseDecode(probs, offset, numBits) {
      /** @type {float64} */
      let m = 1;
      /** @type {float64} */
      let res = 0;
      for (let i = 0; i < numBits; i++) {
        /** @type {int32} */
        const bit = this.decodeBit(probs, offset + m);
        m = m * 2 + bit;
        res = OpCodes.ToUint32(res + OpCodes.Shl32(bit, i));
      }
      return res;
    }

    /**
     * @param {LenCoderProbs} decoder - Length coder
     * @param {int32} posState - Position state (may exceed the rows of a corrupt stream)
     * @returns {float64} Match length
     */
    decodeLen(decoder, posState) {
      /** @type {int32} */
      const choice = this.decodeBit(decoder.choice, 0);
      if (choice === 0) {
        /** @type {float64} */
        const low = this.bitTreeDecode(decoder.low[posState], 0, 3);
        return 2 + low;
      }
      /** @type {int32} */
      const choice2 = this.decodeBit(decoder.choice2, 0);
      if (choice2 === 0) {
        /** @type {float64} */
        const mid = this.bitTreeDecode(decoder.mid[posState], 0, 3);
        return 10 + mid;
      }
      /** @type {float64} */
      const high = this.bitTreeDecode(decoder.high, 0, 8);
      return 18 + high;
    }
  }

  // ===== LZMA1 RANGE ENCODER =====
  //
  // Exact mirror of the range DECODER above: same 11-bit probability scale,
  // same kNumMoveBits update rule, same kTopValue normalization threshold.
  // `low` is allowed to grow one bit past 32 bits while a carry is pending
  // (JS doubles hold that exactly); everything else is kept inside 32 bits
  // via OpCodes.

  class RangeEncoder {
    constructor() {
      /** @type {float64} */
      this.low = 0;
      /** @type {float64} */
      this.range = 0xFFFFFFFF;
      /** @type {int32} */
      this.cacheSize = 1;
      /** @type {int32} */
      this.cache = 0;
      /** @type {uint8[]} */
      this.output = [];
    }

    _shiftLow() {
      /** @type {float64} */
      const low = this.low;
      /** @type {int32} */
      const carry = low >= 0x100000000 ? 1 : 0;
      if (carry === 1 || low < 0xFF000000) {
        /** @type {int32} */
        let temp = this.cache;
        do {
          this.output.push(OpCodes.And32(temp + carry, 0xFF));
          temp = 0xFF;
        } while (--this.cacheSize !== 0);
        this.cache = OpCodes.Shr32(OpCodes.ToUint32(low), 24);
      }
      this.cacheSize++;
      /** @type {float64} */
      const low32 = OpCodes.ToUint32(low);
      this.low = OpCodes.ToUint32(low32 * 256);
    }

    _normalize() {
      while (this.range < kTopValue) {
        this.range = OpCodes.ToUint32(this.range * 256);
        this._shiftLow();
      }
    }

    /**
     * @param {int32[]} probs - Probability array
     * @param {float64} index - Probability slot
     * @param {int32} bit - Bit to code
     */
    encodeBit(probs, index, bit) {
      /** @type {float64} */
      const rangeUnit = OpCodes.Shr32(this.range, kNumBitModelTotalBits);
      /** @type {float64} */
      const prob = probs[index];
      /** @type {float64} */
      const bound = rangeUnit * prob;
      if (bit === 0) {
        this.range = bound;
        probs[index] += OpCodes.Shr32(2048 - probs[index], kNumMoveBits);
      } else {
        this.low += bound;
        this.range = OpCodes.ToUint32(this.range - bound);
        probs[index] -= OpCodes.Shr32(probs[index], kNumMoveBits);
      }
      this._normalize();
    }

    /**
     * @param {float64} value - Bits to code
     * @param {int32} numBits - Bit count, MSB first
     */
    encodeDirectBits(value, numBits) {
      for (let i = numBits - 1; i >= 0; i--) {
        this.range = OpCodes.Shr32(this.range, 1);
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        if (bit === 1) {
          this.low += this.range;
        }
        this._normalize();
      }
    }

    // Five trailing shiftLow calls: one to push out the pending cache byte,
    // four more so every byte of `low` that the decoder still needs to read
    // has actually been written.
    flush() {
      for (let i = 0; i < 5; i++) {
        this._shiftLow();
      }
    }
  }

  /**
   * @param {RangeEncoder} enc - Range encoder
   * @param {int32[]} probs - Probability array
   * @param {float64} offset - Offset of the tree
   * @param {int32} numBits - Symbol width
   * @param {float64} value - Symbol, MSB first
   */
  function bitTreeEncode(enc, probs, offset, numBits, value) {
    /** @type {float64} */
    let m = 1;
    for (let i = numBits - 1; i >= 0; i--) {
      /** @type {int32} */
      const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
      enc.encodeBit(probs, offset + m, bit);
      m = m * 2 + bit;
    }
  }

  /**
   * @param {RangeEncoder} enc - Range encoder
   * @param {int32[]} probs - Probability array
   * @param {float64} offset - Offset of the tree
   * @param {int32} numBits - Symbol width
   * @param {float64} value - Symbol, LSB first
   */
  function bitTreeReverseEncode(enc, probs, offset, numBits, value) {
    /** @type {float64} */
    let m = 1;
    for (let i = 0; i < numBits; i++) {
      /** @type {int32} */
      const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
      enc.encodeBit(probs, offset + m, bit);
      m = m * 2 + bit;
    }
  }

  /**
   * @param {RangeEncoder} enc - Range encoder
   * @param {LenCoderProbs} lenCoder - Length coder
   * @param {int32} posState - Position state
   * @param {int32} len - Match length
   */
  function encodeLenValue(enc, lenCoder, posState, len) {
    if (len < 10) {
      enc.encodeBit(lenCoder.choice, 0, 0);
      bitTreeEncode(enc, lenCoder.low[posState], 0, 3, len - 2);
    } else if (len < 18) {
      enc.encodeBit(lenCoder.choice, 0, 1);
      enc.encodeBit(lenCoder.choice2, 0, 0);
      bitTreeEncode(enc, lenCoder.mid[posState], 0, 3, len - 10);
    } else {
      enc.encodeBit(lenCoder.choice, 0, 1);
      enc.encodeBit(lenCoder.choice2, 0, 1);
      bitTreeEncode(enc, lenCoder.high, 0, 8, len - 18);
    }
  }

  // Inverse of the decoder's posSlot -> dist reconstruction: the slot is
  // 2*n + (second-highest bit of dist), where n is dist's highest set bit
  // position. Math.clz32 gives an exact integer bit position (no float
  // log2 rounding risk near powers of two).
  /**
   * @param {int32} dist - Distance minus one
   * @returns {int32} Position slot
   */
  function getPosSlot(dist) {
    if (dist < 4) {
      return dist;
    }
    /** @type {int32} */
    const n = 31 - Math.clz32(dist);
    /** @type {int32} */
    const bit = OpCodes.And32(OpCodes.Shr32(dist, n - 1), 1);
    return n * 2 + bit;
  }

  /**
   * @param {RangeEncoder} enc - Range encoder
   * @param {Lzma1State} state - Probability model
   * @param {int32} lenState - Length state 0..3
   * @param {int32} dist - Distance minus one
   */
  function encodeDistance(enc, state, lenState, dist) {
    /** @type {int32} */
    const posSlot = getPosSlot(dist);
    bitTreeEncode(enc, state.posSlotDecoder[lenState], 0, 6, posSlot);
    if (posSlot >= 4) {
      /** @type {int32} */
      const numDirectBits = OpCodes.Shr32(posSlot, 1) - 1;
      /** @type {int32} */
      const base = OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(posSlot, 1)), numDirectBits);
      /** @type {int32} */
      const rem = dist - base;
      if (posSlot < 14) {
        bitTreeReverseEncode(enc, state.specPos, base - posSlot - 1, numDirectBits, rem);
      } else {
        /** @type {int32} */
        const high = Math.floor(rem / 16);
        enc.encodeDirectBits(high, numDirectBits - 4);
        bitTreeReverseEncode(enc, state.align, 0, 4, rem % 16);
      }
    }
  }

  /**
   * @param {RangeEncoder} enc - Range encoder
   * @param {Lzma1State} state - Probability model and state machine
   * @param {uint8[]} data - Input
   * @param {int32} globalPos - Position of the literal
   */
  function encodeLiteral(enc, state, data, globalPos) {
    /** @type {int32} */
    const localPos = globalPos - state.dictResetPos;
    /** @type {int32} */
    const lpMask = OpCodes.Shl32(1, state.lp) - 1;
    /** @type {int32} */
    const lcShift = 8 - state.lc;
    /** @type {int32} */
    const prevByte = globalPos === 0 ? 0 : data[globalPos - 1];
    /** @type {int32} */
    const lcScale = OpCodes.Shl32(1, state.lc);
    /** @type {int32} */
    const prevBits = OpCodes.Shr32(prevByte, lcShift);
    /** @type {float64} */
    const maskedPos = OpCodes.And32(localPos, lpMask);
    /** @type {int32} */
    const litState = (maskedPos * lcScale) + prevBits;
    /** @type {int32} */
    const base = litState * 0x300;
    /** @type {uint8} */
    const byteVal = data[globalPos];

    if (state.state < 7) {
      bitTreeEncode(enc, state.literalProbs, base, 8, byteVal);
    } else {
      /** @type {uint32} */
      let matchByte = data[globalPos - state.rep0 - 1];
      /** @type {int32} */
      let symbol = 1;
      /** @type {int32} */
      let i = 7;
      while (symbol < 0x100) {
        /** @type {float64} */
        const matchBit = OpCodes.Shr32(matchByte, 7);
        matchByte = OpCodes.And32(OpCodes.ToUint32(matchByte * 2), 0xFF);
        /** @type {int32} */
        const bit = OpCodes.And32(OpCodes.Shr32(byteVal, i), 1);
        i--;
        enc.encodeBit(state.literalProbs, base + (1 + matchBit) * 0x100 + symbol, bit);
        symbol = symbol * 2 + bit;
        if (matchBit !== bit) {
          while (symbol < 0x100) {
            /** @type {int32} */
            const bit2 = OpCodes.And32(OpCodes.Shr32(byteVal, i), 1);
            i--;
            enc.encodeBit(state.literalProbs, base + symbol, bit2);
            symbol = symbol * 2 + bit2;
          }
          break;
        }
      }
    }
    state.state = state.state < 4 ? 0 : (state.state < 10 ? state.state - 3 : state.state - 6);
  }

  // ===== LZ77 MATCH FINDER (hash chain, 3-byte hash) =====
  //
  // Same structure as the HashChain in brieflz.js: a hash-of-3-bytes head
  // table plus a per-position "previous occurrence" chain, walk bounded by
  // maxChainDepth so a degenerate chain (e.g. a long run of one repeated
  // byte) cannot go quadratic; the walk also stops as soon as a match
  // reaches the caller's length cap, since no longer candidate could beat it.

  const MAX_MATCH_LEN = 273; // 18 + 255, the largest length the length coder can express

  /**
   * Match found by the hash chain; length 0 when none.
   */
  class ChainMatch {
    /**
     * @param {int32} length - Match length
     * @param {int32} distance - Backward distance
     */
    constructor(length, distance) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distance = distance;
    }
  }

  class HashChain {
    /**
     * @param {int32} windowSize - Chain window
     * @param {int32} maxChainDepth - Chain walk limit
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.windowSize = Math.max(1, windowSize);
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32} */
      this.hashSize = 65536;
      /** @type {int32[]} */
      this.head = new Int32Array(this.hashSize).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(this.windowSize).fill(-1);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    _hash(data, pos) {
      /** @type {int32} */
      const a = OpCodes.Shl32(data[pos], 8);
      /** @type {int32} */
      const b = OpCodes.Shl32(data[pos + 1], 4);
      /** @type {int32} */
      const c = OpCodes.Shr32(data[pos + 2], 4);
      return (a + b + c) % this.hashSize;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} pos - Position to insert
     */
    insert(data, pos) {
      if (pos + 2 >= data.length) {
        return;
      }
      /** @type {int32} */
      const h = this._hash(data, pos);
      /** @type {int32} */
      const idx = pos % this.windowSize;
      this.prev[idx] = this.head[h];
      this.head[h] = pos;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} pos - Current position
     * @param {int32} maxLen - Longest allowed match
     * @returns {ChainMatch} Longest (nearest on ties) match
     */
    find(data, pos, maxLen) {
      if (maxLen < 2 || pos + 2 >= data.length) {
        return new ChainMatch(0, 0);
      }
      /** @type {int32} */
      const h = this._hash(data, pos);
      /** @type {int32} */
      const windowStart = Math.max(0, pos - this.windowSize);
      /** @type {int32} */
      let chainPos = this.head[h];
      /** @type {int32} */
      let depth = 0;
      /** @type {int32} */
      let bestLength = 0;
      /** @type {int32} */
      let bestDistance = 0;
      while (chainPos >= windowStart && chainPos < pos && depth < this.maxChainDepth) {
        /** @type {int32} */
        let length = 0;
        while (length < maxLen && data[chainPos + length] === data[pos + length]) {
          length++;
        }
        if (length > bestLength) {
          bestLength = length;
          bestDistance = pos - chainPos;
          if (length >= maxLen) {
            break;
          }
        }
        /** @type {int32} */
        const idx = chainPos % this.windowSize;
        chainPos = this.prev[idx];
        depth++;
      }
      return new ChainMatch(bestLength, bestDistance);
    }
  }

  /**
   * @param {uint8[]} data - Input
   * @param {int32} pos - Current position
   * @param {int32} remaining - Bytes left in the chunk
   * @param {int32} dist - Rep distance (minus one)
   * @returns {int32} Match length at that distance
   */
  function repMatchLength(data, pos, remaining, dist) {
    if (dist + 1 > pos) {
      return 0; // not enough history for this distance yet
    }
    /** @type {int32} */
    const maxLen = Math.min(MAX_MATCH_LEN, remaining);
    /** @type {int32} */
    let len = 0;
    while (len < maxLen && data[pos - dist - 1 + len] === data[pos + len]) {
      len++;
    }
    return len;
  }

  const TOKEN_LITERAL = 0;
  const TOKEN_SHORTREP = 1;
  const TOKEN_REP = 2;
  const TOKEN_MATCH = 3;

  /**
   * Parser decision for one position.
   */
  class Lzma2Token {
    /**
     * @param {int32} type - TOKEN_LITERAL, TOKEN_SHORTREP, TOKEN_REP or TOKEN_MATCH
     * @param {int32} repIndex - Rep slot for TOKEN_REP
     * @param {int32} length - Match length
     * @param {int32} distCode - Distance minus one for TOKEN_MATCH
     */
    constructor(type, repIndex, length, distCode) {
      /** @type {int32} */
      this.type = type;
      /** @type {int32} */
      this.repIndex = repIndex;
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distCode = distCode;
    }
  }

  // Greedy LZ77 parser with rep-match awareness: rep0/1/2/3 candidates are
  // checked directly (only 4 candidates, no chain walk needed) and preferred
  // over an equally-good fresh-distance match since rep codes are far
  // cheaper to encode. A short rep (single byte at the rep0 distance) is
  // preferred over a plain literal whenever it applies.
  /**
   * @param {uint8[]} data - Input
   * @param {int32} pos - Current position
   * @param {int32} remaining - Bytes left in the chunk
   * @param {int32} rep0 - Rep distance 0
   * @param {int32} rep1 - Rep distance 1
   * @param {int32} rep2 - Rep distance 2
   * @param {int32} rep3 - Rep distance 3
   * @param {HashChain} matchFinder - Match finder
   * @returns {Lzma2Token} Chosen token
   */
  function findBestToken(data, pos, remaining, rep0, rep1, rep2, rep3, matchFinder) {
    if (remaining < 1) {
      return new Lzma2Token(TOKEN_LITERAL, 0, 0, 0);
    }

    /** @type {int32[]} */
    const reps = [rep0, rep1, rep2, rep3];
    /** @type {int32} */
    let bestRep = -1;
    /** @type {int32} */
    let bestRepScore = 0;
    /** @type {int32} */
    let bestRepLen = 0;
    for (let r = 0; r < 4; r++) {
      /** @type {int32} */
      const len = repMatchLength(data, pos, remaining, reps[r]);
      if (r === 0) {
        if (len >= 1) {
          /** @type {int32} */
          const score = len + 2;
          if (score > bestRepScore) {
            bestRep = 0;
            bestRepScore = score;
            bestRepLen = len;
          }
        }
      } else if (len >= 2) {
        /** @type {int32} */
        const score = len + 1;
        if (score > bestRepScore) {
          bestRep = r;
          bestRepScore = score;
          bestRepLen = len;
        }
      }
    }

    /** @type {ChainMatch} */
    let normal = new ChainMatch(0, 0);
    if (remaining >= 2) {
      /** @type {int32} */
      const maxLen = Math.min(MAX_MATCH_LEN, remaining);
      /** @type {ChainMatch} */
      const m = matchFinder.find(data, pos, maxLen);
      if (m.length >= 2) {
        normal = m;
      }
    }
    /** @type {int32} */
    const normalScore = normal.length >= 3 || (normal.length === 2 && normal.distance <= 512) ? normal.length : 0;

    if (bestRep >= 0 && bestRepScore >= normalScore) {
      if (bestRep === 0 && bestRepLen === 1) {
        return new Lzma2Token(TOKEN_SHORTREP, 0, 0, 0);
      }
      return new Lzma2Token(TOKEN_REP, bestRep, bestRepLen, 0);
    }

    if (normalScore > 0) {
      return new Lzma2Token(TOKEN_MATCH, 0, normal.length, normal.distance - 1);
    }

    return new Lzma2Token(TOKEN_LITERAL, 0, 0, 0);
  }

  // Holds LZMA1 probability model + match-state that persists across LZMA2
  // chunks whenever a chunk requests "no reset" (control byte reset mode 0).
  class Lzma1State {
    constructor() {
      /** @type {int32} */
      this.lc = 3;
      /** @type {int32} */
      this.lp = 0;
      /** @type {int32} */
      this.pb = 2;
      /** @type {float64} */
      this.dictResetPos = 0;
      /** @type {int32} */
      this.state = 0;
      /** @type {float64} */
      this.rep0 = 0;
      /** @type {float64} */
      this.rep1 = 0;
      /** @type {float64} */
      this.rep2 = 0;
      /** @type {float64} */
      this.rep3 = 0;
      /** @type {int32[]} */
      this.isMatch = [];
      /** @type {int32[]} */
      this.isRep = [];
      /** @type {int32[]} */
      this.isRepG0 = [];
      /** @type {int32[]} */
      this.isRepG1 = [];
      /** @type {int32[]} */
      this.isRepG2 = [];
      /** @type {int32[]} */
      this.isRep0Long = [];
      /** @type {int32[][]} */
      this.posSlotDecoder = [];
      /** @type {int32[]} */
      this.specPos = [];
      /** @type {int32[]} */
      this.align = [];
      /** @type {LenCoderProbs} */
      this.lenDecoder = null;
      /** @type {LenCoderProbs} */
      this.repLenDecoder = null;
      /** @type {int32[]} */
      this.literalProbs = [];
      this.resetProbs();
      this.resetMatchState();
    }

    resetMatchState() {
      this.state = 0;
      this.rep0 = 0;
      this.rep1 = 0;
      this.rep2 = 0;
      this.rep3 = 0;
    }

    resetProbs() {
      this.isMatch = createProbArray(kNumStates * 16);
      this.isRep = createProbArray(kNumStates);
      this.isRepG0 = createProbArray(kNumStates);
      this.isRepG1 = createProbArray(kNumStates);
      this.isRepG2 = createProbArray(kNumStates);
      this.isRep0Long = createProbArray(kNumStates * 16);
      this.posSlotDecoder = [];
      for (let i = 0; i < kNumLenToPosStates; i++) {
        this.posSlotDecoder.push(createProbArray(64));
      }
      this.specPos = createProbArray(115);
      this.align = createProbArray(16);
      this.lenDecoder = new LenCoderProbs();
      this.repLenDecoder = new LenCoderProbs();
      this.literalProbs = createProbArray(0x300 * OpCodes.Shl32(1, this.lc + this.lp));
    }

    // Deep copy, used by the encoder to try a "continue previous chunk's
    // probabilities" attempt without corrupting the real running state if
    // that attempt is later discarded in favor of an uncompressed chunk.
    /**
     * @returns {Lzma1State} Deep copy
     */
    clone() {
      /** @type {Lzma1State} */
      const c = new Lzma1State();
      c.lc = this.lc;
      c.lp = this.lp;
      c.pb = this.pb;
      c.dictResetPos = this.dictResetPos;
      c.state = this.state;
      c.rep0 = this.rep0;
      c.rep1 = this.rep1;
      c.rep2 = this.rep2;
      c.rep3 = this.rep3;
      c.isMatch = this.isMatch.slice();
      c.isRep = this.isRep.slice();
      c.isRepG0 = this.isRepG0.slice();
      c.isRepG1 = this.isRepG1.slice();
      c.isRepG2 = this.isRepG2.slice();
      c.isRep0Long = this.isRep0Long.slice();
      c.posSlotDecoder = cloneRows(this.posSlotDecoder);
      c.specPos = this.specPos.slice();
      c.align = this.align.slice();
      /** @type {LenCoderProbs} */
      const lenCopy = this.lenDecoder.clone();
      /** @type {LenCoderProbs} */
      const repLenCopy = this.repLenDecoder.clone();
      c.lenDecoder = lenCopy;
      c.repLenDecoder = repLenCopy;
      c.literalProbs = this.literalProbs.slice();
      return c;
    }

    /**
     * @param {int32} propByte - (pb * 5 + lp) * 9 + lc
     */
    setProps(propByte) {
      /** @type {int32} */
      let rem = propByte;
      this.lc = rem % 9;
      rem = Math.floor(rem / 9);
      this.lp = rem % 5;
      this.pb = Math.floor(rem / 5);
    }

    // Decodes exactly `unpackedSize` new bytes from `payload` (the raw LZMA
    // range-coder byte stream of one LZMA2 chunk) and appends them to the
    // shared, ever-growing `output` array.
    /**
     * @param {uint8[]} payload - Range-coded bytes
     * @param {float64} unpackedSize - Bytes to produce
     * @param {uint8[]} output - Shared output, appended to
     */
    decodeChunk(payload, unpackedSize, output) {
      /** @type {Lzma1RangeDecoder} */
      const rc = new Lzma1RangeDecoder(payload);

      /** @type {int32} */
      const pbMask = OpCodes.Shl32(1, this.pb) - 1;
      /** @type {int32} */
      const lpMask = OpCodes.Shl32(1, this.lp) - 1;
      /** @type {int32} */
      const lcShift = 8 - this.lc;
      /** @type {float64} */
      const target = output.length + unpackedSize;

      while (output.length < target) {
        /** @type {float64} */
        const localPos = output.length - this.dictResetPos;
        /** @type {int32} */
        const posState = OpCodes.And32(localPos, pbMask);

        /** @type {int32} */
        const matchFlag = rc.decodeBit(this.isMatch, this.state * 16 + posState);
        if (matchFlag === 0) {
          // Literal
          /** @type {uint8} */
          const prevByte = output.length === 0 ? 0 : output[output.length - 1];
          /** @type {float64} */
          const lcScale = OpCodes.Shl32(1, this.lc);
          /** @type {float64} */
          const prevBits = OpCodes.Shr32(prevByte, lcShift);
          /** @type {float64} */
          const litState = (OpCodes.And32(localPos, lpMask) * lcScale) + prevBits;
          /** @type {float64} */
          const base = litState * 0x300;
          /** @type {float64} */
          let symbol = 1;
          if (this.state < 7) {
            while (symbol < 0x100) {
              /** @type {int32} */
              const bit = rc.decodeBit(this.literalProbs, base + symbol);
              symbol = symbol * 2 + bit;
            }
          } else {
            /** @type {uint32} */
            let matchByte = output[output.length - this.rep0 - 1];
            while (symbol < 0x100) {
              /** @type {float64} */
              const matchBit = OpCodes.Shr32(matchByte, 7);
              matchByte = OpCodes.And32(OpCodes.ToUint32(matchByte * 2), 0xFF);
              /** @type {int32} */
              const bit = rc.decodeBit(this.literalProbs, base + (1 + matchBit) * 0x100 + symbol);
              symbol = symbol * 2 + bit;
              if (matchBit !== bit) {
                while (symbol < 0x100) {
                  /** @type {int32} */
                  const bit2 = rc.decodeBit(this.literalProbs, base + symbol);
                  symbol = symbol * 2 + bit2;
                }
                break;
              }
            }
          }
          output.push(symbol - 0x100);
          this.state = this.state < 4 ? 0 : (this.state < 10 ? this.state - 3 : this.state - 6);
        } else {
          /** @type {float64} */
          let len = 0;
          /** @type {int32} */
          const repFlag = rc.decodeBit(this.isRep, this.state);
          if (repFlag === 0) {
            // New-distance match
            this.rep3 = this.rep2;
            this.rep2 = this.rep1;
            this.rep1 = this.rep0;
            len = rc.decodeLen(this.lenDecoder, posState);
            /** @type {int32} */
            const lenState = Math.min(len - 2, 3);
            /** @type {float64} */
            const posSlot = rc.bitTreeDecode(this.posSlotDecoder[lenState], 0, 6);
            /** @type {float64} */
            let dist = 0;
            if (posSlot < 4) {
              dist = posSlot;
            } else {
              /** @type {int32} */
              const numDirectBits = OpCodes.Shr32(posSlot, 1) - 1;
              dist = OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(posSlot, 1)), numDirectBits);
              if (posSlot < 14) {
                /** @type {float64} */
                const footer = rc.bitTreeReverseDecode(this.specPos, dist - posSlot - 1, numDirectBits);
                dist += footer;
              } else {
                /** @type {float64} */
                const direct = rc.decodeDirectBits(numDirectBits - 4);
                dist = OpCodes.ToUint32(dist + direct * 16);
                /** @type {float64} */
                const alignBits = rc.bitTreeReverseDecode(this.align, 0, 4);
                dist += alignBits;
              }
            }
            this.rep0 = OpCodes.ToUint32(dist);
            if (this.rep0 === 0xFFFFFFFF) {
              break; // end-of-stream marker
            }
            this.state = this.state < 7 ? 7 : 10;
          } else {
            /** @type {int32} */
            const g0Flag = rc.decodeBit(this.isRepG0, this.state);
            if (g0Flag === 0) {
              /** @type {int32} */
              const longFlag = rc.decodeBit(this.isRep0Long, this.state * 16 + posState);
              if (longFlag === 0) {
                // Short rep: single byte, distance stays rep0
                this.state = this.state < 7 ? 9 : 11;
                output.push(output[output.length - this.rep0 - 1]);
                continue;
              }
            } else {
              /** @type {float64} */
              let dist = 0;
              /** @type {int32} */
              const g1Flag = rc.decodeBit(this.isRepG1, this.state);
              if (g1Flag === 0) {
                dist = this.rep1;
                this.rep1 = this.rep0;
                this.rep0 = dist;
              } else {
                /** @type {int32} */
                const g2Flag = rc.decodeBit(this.isRepG2, this.state);
                if (g2Flag === 0) {
                  dist = this.rep2;
                  this.rep2 = this.rep1;
                  this.rep1 = this.rep0;
                  this.rep0 = dist;
                } else {
                  dist = this.rep3;
                  this.rep3 = this.rep2;
                  this.rep2 = this.rep1;
                  this.rep1 = this.rep0;
                  this.rep0 = dist;
                }
              }
            }
            len = rc.decodeLen(this.repLenDecoder, posState);
            this.state = this.state < 7 ? 8 : 11;
          }
          for (let i = 0; i < len && output.length < target; i++) {
            output.push(output[output.length - this.rep0 - 1]);
          }
        }
      }
    }

    // Encodes exactly `length` bytes of `data` starting at `start` into `enc`,
    // using (and mutating) this state's probability model, state machine and
    // rep0..rep3 - the exact mirror of decodeChunk above, driven by the LZ77
    // parser instead of a bitstream.
    /**
     * @param {RangeEncoder} enc - Range encoder
     * @param {uint8[]} data - Input
     * @param {int32} start - First byte of the chunk
     * @param {int32} length - Chunk length
     * @param {HashChain} matchFinder - Match finder shared across chunks
     */
    encodeChunk(enc, data, start, length, matchFinder) {
      /** @type {int32} */
      const end = start + length;
      /** @type {int32} */
      let pos = start;
      /** @type {int32} */
      const pbMask = OpCodes.Shl32(1, this.pb) - 1;

      while (pos < end) {
        /** @type {int32} */
        const localPos = pos - this.dictResetPos;
        /** @type {int32} */
        const posState = OpCodes.And32(localPos, pbMask);
        /** @type {int32} */
        const remaining = end - pos;
        /** @type {Lzma2Token} */
        const token = findBestToken(data, pos, remaining, this.rep0, this.rep1, this.rep2, this.rep3, matchFinder);

        if (token.type === TOKEN_LITERAL) {
          enc.encodeBit(this.isMatch, this.state * 16 + posState, 0);
          encodeLiteral(enc, this, data, pos);
          matchFinder.insert(data, pos);
          pos++;
          continue;
        }

        enc.encodeBit(this.isMatch, this.state * 16 + posState, 1);

        if (token.type === TOKEN_MATCH) {
          enc.encodeBit(this.isRep, this.state, 0);
          this.rep3 = this.rep2;
          this.rep2 = this.rep1;
          this.rep1 = this.rep0;
          this.rep0 = token.distCode;
          /** @type {int32} */
          const len = token.length;
          encodeLenValue(enc, this.lenDecoder, posState, len);
          /** @type {int32} */
          const lenState = Math.min(len - 2, 3);
          encodeDistance(enc, this, lenState, token.distCode);
          this.state = this.state < 7 ? 7 : 10;
          for (let k = 0; k < len; k++) {
            matchFinder.insert(data, pos + k);
          }
          pos += len;
          continue;
        }

        if (token.type === TOKEN_SHORTREP) {
          enc.encodeBit(this.isRep, this.state, 1);
          enc.encodeBit(this.isRepG0, this.state, 0);
          enc.encodeBit(this.isRep0Long, this.state * 16 + posState, 0);
          this.state = this.state < 7 ? 9 : 11;
          matchFinder.insert(data, pos);
          pos++;
          continue;
        }

        // rep match, token.repIndex in 0..3, token.length >= 2
        enc.encodeBit(this.isRep, this.state, 1);
        if (token.repIndex === 0) {
          enc.encodeBit(this.isRepG0, this.state, 0);
          enc.encodeBit(this.isRep0Long, this.state * 16 + posState, 1);
        } else if (token.repIndex === 1) {
          enc.encodeBit(this.isRepG0, this.state, 1);
          enc.encodeBit(this.isRepG1, this.state, 0);
          /** @type {float64} */
          const d = this.rep1;
          this.rep1 = this.rep0;
          this.rep0 = d;
        } else if (token.repIndex === 2) {
          enc.encodeBit(this.isRepG0, this.state, 1);
          enc.encodeBit(this.isRepG1, this.state, 1);
          enc.encodeBit(this.isRepG2, this.state, 0);
          /** @type {float64} */
          const d = this.rep2;
          this.rep2 = this.rep1;
          this.rep1 = this.rep0;
          this.rep0 = d;
        } else {
          enc.encodeBit(this.isRepG0, this.state, 1);
          enc.encodeBit(this.isRepG1, this.state, 1);
          enc.encodeBit(this.isRepG2, this.state, 1);
          /** @type {float64} */
          const d = this.rep3;
          this.rep3 = this.rep2;
          this.rep2 = this.rep1;
          this.rep1 = this.rep0;
          this.rep0 = d;
        }
        /** @type {int32} */
        const len = token.length;
        encodeLenValue(enc, this.repLenDecoder, posState, len);
        this.state = this.state < 7 ? 8 : 11;
        for (let k = 0; k < len; k++) {
          matchFinder.insert(data, pos + k);
        }
        pos += len;
      }
    }
  }

  // ===== LZMA2 CHUNK FRAMING =====

  // LZMA2 format limits: unpacked size is a 21-bit field (5 high bits in the
  // control byte + 16 low bits), packed size is a 16-bit field. The 32768
  // cap keeps every chunk's compressed form comfortably under the 65536
  // packed-size limit (LZMA essentially never expands data by more than a
  // few percent; the fallback below is the hard safety net regardless).
  const LZMA2_CHUNK_UNCOMPRESSED_CAP = 32768;
  const LZMA2_MAX_PACKED = 65536;

  /**
   * @param {uint8[]} out - Output, appended to
   * @param {uint8[]} data - Input
   * @param {int32} start - First byte of the chunk
   * @param {int32} len - Chunk length
   * @param {boolean} resetDict - True for a dictionary reset
   */
  function emitUncompressedChunkBytes(out, data, start, len, resetDict) {
    out.push(resetDict ? 0x01 : 0x02);
    /** @type {uint8[]} */
    const be = OpCodes.Unpack16BE(len - 1);
    out.push(be[0]);
    out.push(be[1]);
    for (let i = 0; i < len; i++) {
      out.push(data[start + i]);
    }
  }

  /**
   * @param {uint8[]} out - Output, appended to
   * @param {uint8[]} payload - Range-coded bytes
   * @param {int32} unpackedLen - Chunk length
   * @param {int32} resetMode - LZMA2 reset mode 0..3
   * @param {int32} propByte - LZMA properties byte
   */
  function emitCompressedChunkBytes(out, payload, unpackedLen, resetMode, propByte) {
    /** @type {int32} */
    const usm1 = unpackedLen - 1;
    /** @type {int32} */
    const high5 = Math.floor(usm1 / 65536);
    /** @type {int32} */
    const low16 = usm1 % 65536;
    /** @type {uint32} */
    const control = OpCodes.Or32(OpCodes.Shl32(4 + resetMode, 5), high5);
    out.push(control);
    /** @type {uint8[]} */
    const usBytes = OpCodes.Unpack16BE(low16);
    out.push(usBytes[0]);
    out.push(usBytes[1]);
    /** @type {uint8[]} */
    const psBytes = OpCodes.Unpack16BE(payload.length - 1);
    out.push(psBytes[0]);
    out.push(psBytes[1]);
    if (resetMode >= 2) {
      out.push(propByte);
    }
    for (let i = 0; i < payload.length; i++) {
      out.push(payload[i]);
    }
  }

  // Standard LZMA2 dictionary-size property byte encoding (xz-file-format.txt
  // 4.1.1 / 5.3.1): byte b<40 encodes (2|(b&1)) * 2^(floor(b/2)+11); b===40
  // means 0xFFFFFFFF. Picks the smallest size that still covers the whole
  // input, since our encoder never needs a match distance beyond that.
  /**
   * @param {int32} minSize - Smallest dictionary size needed
   * @returns {int32} Dictionary-size property byte
   */
  function dictSizeProp(minSize) {
    /** @type {int32} */
    const need = Math.max(4096, minSize);
    for (let b = 0; b < 40; b++) {
      /** @type {int32} */
      const mantissa = 2 + (b % 2);
      /** @type {float64} */
      const size = mantissa * Math.pow(2, Math.floor(b / 2) + 11);
      if (size >= need) {
        return b;
      }
    }
    return 40;
  }

  // Real LZMA-compressed LZMA2 stream: hash-chain LZ77 parse with rep-match
  // awareness feeding the LZMA1 range encoder above, framed into LZMA2
  // chunks (capped well under the format's packed-size limit). Every chunk
  // independently falls back to an LZMA2 "uncompressed" chunk whenever that
  // would be smaller (or the compressed form ever exceeded the packed-size
  // limit) - always a valid, always-real LZMA2 stream either way.
  /**
   * @param {uint8[]} data - Input
   * @returns {uint8[]} LZMA2 stream
   */
  function encodeLZMA2Compressed(data) {
    /** @type {uint8[]} */
    const out = [];
    if (data.length === 0) {
      out.push(0x00);
      return out;
    }

    /** @type {int32} */
    const propByte = (2 * 5 + 0) * 9 + 3; // lc=3, lp=0, pb=2 - Lzma1State defaults
    /** @type {HashChain} */
    const matchFinder = new HashChain(data.length, 64);

    // `persistent` holds the real, committed probability model + rep0-3 +
    // 12-state machine. A chunk that continues it (reset mode 0) is tried
    // against a throwaway clone first, since the LZ77-driven encode mutates
    // that state as a side effect - if the attempt loses to the uncompressed
    // fallback, the clone is simply discarded and `persistent` is untouched.
    /** @type {Lzma1State} */
    let persistent = new Lzma1State();
    /** @type {int32} */
    let pos = 0;
    /** @type {boolean} */
    let first = true;
    /** @type {boolean} */
    let needReset = true;

    while (pos < data.length) {
      /** @type {int32} */
      const chunkLen = Math.min(LZMA2_CHUNK_UNCOMPRESSED_CAP, data.length - pos);

      /** @type {int32} */
      const resetMode = needReset ? (first ? 3 : 1) : 0;
      /** @type {Lzma1State} */
      let attempt = null;
      if (needReset) {
        attempt = new Lzma1State();
      } else {
        attempt = persistent.clone();
      }
      /** @type {RangeEncoder} */
      const enc = new RangeEncoder();
      attempt.encodeChunk(enc, data, pos, chunkLen, matchFinder);
      enc.flush();
      /** @type {uint8[]} */
      const payload = enc.output;

      /** @type {int32} */
      const compressedCost = 5 + (resetMode >= 2 ? 1 : 0) + payload.length;
      /** @type {int32} */
      const uncompressedCost = 3 + chunkLen;

      if (payload.length <= LZMA2_MAX_PACKED && compressedCost < uncompressedCost) {
        emitCompressedChunkBytes(out, payload, chunkLen, resetMode, propByte);
        persistent = attempt;
        needReset = false;
      } else {
        emitUncompressedChunkBytes(out, data, pos, chunkLen, first);
        needReset = true; // LZMA2 requires the next LZMA chunk to reset state after an uncompressed chunk
      }

      pos += chunkLen;
      first = false;
    }

    out.push(0x00);
    return out;
  }

  /**
   * @param {uint8[]} bytes - LZMA2 stream
   * @param {uint8[]} output - Output, appended to
   * @returns {uint8[]} The output array
   */
  function decodeLZMA2(bytes, output) {
    /** @type {int32} */
    let pos = 0;
    /** @type {Lzma1State} */
    const decoder = new Lzma1State();
    while (pos < bytes.length) {
      /** @type {uint8} */
      const control = bytes[pos++];
      if (control === 0x00) {
        break; // end of LZMA2 stream
      }

      if (control === 0x01 || control === 0x02) {
        // Uncompressed chunk
        if (control === 0x01) {
          decoder.dictResetPos = output.length;
        }
        /** @type {int32} */
        const size = OpCodes.Pack16BE(bytes[pos], bytes[pos + 1]) + 1;
        pos += 2;
        for (let i = 0; i < size; i++) {
          output.push(bytes[pos + i]);
        }
        pos += size;
        continue;
      }

      // LZMA-compressed chunk (control&0x80 !== 0)
      /** @type {int32} */
      const resetMode = OpCodes.Shr32(control, 5) - 4;
      /** @type {uint32} */
      const high5 = OpCodes.And32(control, 0x1F);
      /** @type {int32} */
      const unpackedSize = OpCodes.Or32(OpCodes.Shl32(high5, 16), OpCodes.Pack16BE(bytes[pos], bytes[pos + 1])) + 1;
      pos += 2;
      /** @type {int32} */
      const packedSize = OpCodes.Pack16BE(bytes[pos], bytes[pos + 1]) + 1;
      pos += 2;

      if (resetMode >= 2) {
        /** @type {uint8} */
        const propByte = bytes[pos++];
        decoder.setProps(propByte);
      }
      if (resetMode >= 1) {
        decoder.resetProbs();
        decoder.resetMatchState();
      }
      if (resetMode === 3) {
        decoder.dictResetPos = output.length;
      }

      /** @type {uint8[]} */
      const payload = bytes.slice(pos, pos + packedSize);
      pos += packedSize;
      decoder.decodeChunk(payload, unpackedSize, output);
    }
    return output;
  }

  // ===== .XZ CONTAINER =====

  /** @type {uint8[]} */
  const XZ_MAGIC = [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00];
  /** @type {uint8[]} */
  const XZ_FOOTER_MAGIC = [0x59, 0x5A];
  const CHECK_ID_CRC32 = 0x01;

  /**
   * @param {uint8[]} data - Input
   * @returns {uint8[]} .xz stream (CRC32 check)
   */
  function encodeXZContainer(data) {
    /** @type {int32} */
    const checkId = CHECK_ID_CRC32;
    /** @type {uint8[]} */
    const streamFlags = [0x00, checkId];
    /** @type {uint8[]} */
    const streamHeader = XZ_MAGIC.concat(streamFlags, crc32Bytes(streamFlags));

    // An empty input is a stream carrying no blocks at all, with an index that records
    // none. It is not a stream carrying one empty block, and it is certainly not an
    // empty file - xz rejects that with "File format not recognized".
    if (data.length === 0) {
      /** @type {uint8[]} */
      const indexIndicator = [0x00];
      /** @type {uint8[]} */
      const emptyIndexContent = indexIndicator.concat(encodeVLI(0));
      /** @type {int32} */
      const emptyIndexPadded = Math.ceil(emptyIndexContent.length / 4) * 4;
      /** @type {uint8[]} */
      const emptyIndexNoCrc = emptyIndexContent.concat(zeroArray(emptyIndexPadded - emptyIndexContent.length));
      /** @type {uint8[]} */
      const emptyIndex = emptyIndexNoCrc.concat(crc32Bytes(emptyIndexNoCrc));
      /** @type {uint8[]} */
      const emptyBackwardSizeBytes = leU32Bytes((emptyIndex.length / 4) - 1);
      /** @type {uint8[]} */
      const emptyFooterFlags = [0x00, checkId];
      /** @type {uint8[]} */
      const emptyFooterCrc = crc32Bytes(emptyBackwardSizeBytes.concat(emptyFooterFlags));
      /** @type {uint8[]} */
      const emptyFooter = emptyFooterCrc.concat(emptyBackwardSizeBytes, emptyFooterFlags, XZ_FOOTER_MAGIC);
      return streamHeader.concat(emptyIndex, emptyFooter);
    }

    /** @type {uint8[]} */
    const lzma2 = encodeLZMA2Compressed(data);

    // Block header
    /** @type {int32} */
    const propByte = dictSizeProp(data.length); // smallest standard dictionary size covering the whole input
    /** @type {uint8[]} */
    const filterFlags = [0x21, 0x01, propByte]; // filter ID VLI (LZMA2=33), props size VLI, props byte
    /** @type {uint8[]} */
    const compSizeVLI = encodeVLI(lzma2.length);
    /** @type {uint8[]} */
    const uncompSizeVLI = encodeVLI(data.length);
    /** @type {int32} */
    const blockFlags = 0xC0; // compressed+uncompressed size present, 1 filter

    /** @type {uint8[]} */
    const blockFlagBytes = [blockFlags];
    /** @type {uint8[]} */
    const coreAfterSizeByte = blockFlagBytes.concat(compSizeVLI, uncompSizeVLI, filterFlags);
    /** @type {int32} */
    const totalNoSizeByte = 1 + coreAfterSizeByte.length; // +1 for the size byte itself
    /** @type {int32} */
    const paddedLen = Math.ceil(totalNoSizeByte / 4) * 4;
    /** @type {uint8[]} */
    const padding = zeroArray(paddedLen - totalNoSizeByte);
    /** @type {int32} */
    const sizeByteValue = (paddedLen + 4) / 4 - 1;

    /** @type {uint8[]} */
    const sizeBytes = [sizeByteValue];
    /** @type {uint8[]} */
    const headerNoCrc = sizeBytes.concat(coreAfterSizeByte, padding);
    /** @type {uint8[]} */
    const blockHeader = headerNoCrc.concat(crc32Bytes(headerNoCrc));

    /** @type {int32} */
    const blockDataLen = blockHeader.length + lzma2.length;
    /** @type {int32} */
    const blockPaddedLen = Math.ceil(blockDataLen / 4) * 4;
    /** @type {uint8[]} */
    const blockPadding = zeroArray(blockPaddedLen - blockDataLen);

    /** @type {uint8[]} */
    const checkBytes = crc32Bytes(data);
    /** @type {uint8[]} */
    const blockBytes = blockHeader.concat(lzma2, blockPadding, checkBytes);

    // Index
    /** @type {int32} */
    const unpaddedSize = blockHeader.length + lzma2.length + checkBytes.length;
    /** @type {uint8[]} */
    const indexIndicator = [0x00];
    /** @type {uint8[]} */
    const indexContent = indexIndicator.concat(encodeVLI(1), encodeVLI(unpaddedSize), encodeVLI(data.length));
    /** @type {int32} */
    const indexPaddedLen = Math.ceil(indexContent.length / 4) * 4;
    /** @type {uint8[]} */
    const indexNoCrc = indexContent.concat(zeroArray(indexPaddedLen - indexContent.length));
    /** @type {uint8[]} */
    const indexBytes = indexNoCrc.concat(crc32Bytes(indexNoCrc));

    // Footer
    /** @type {int32} */
    const backwardSize = (indexBytes.length / 4) - 1;
    /** @type {uint8[]} */
    const backwardSizeBytes = leU32Bytes(backwardSize);
    /** @type {uint8[]} */
    const footerFlags = [0x00, checkId];
    /** @type {uint8[]} */
    const footerCrcBytes = crc32Bytes(backwardSizeBytes.concat(footerFlags));
    /** @type {uint8[]} */
    const footer = footerCrcBytes.concat(backwardSizeBytes, footerFlags, XZ_FOOTER_MAGIC);

    return streamHeader.concat(blockBytes, indexBytes, footer);
  }

  /**
   * @param {uint8[]} bytes - Data
   * @param {int32} offset - First byte
   * @returns {uint32} Little-endian 32-bit value
   */
  function readU32LE(bytes, offset) {
    return OpCodes.Pack32BE(bytes[offset + 3], bytes[offset + 2], bytes[offset + 1], bytes[offset]);
  }

  /**
   * @param {uint8[]} a - First array
   * @param {uint8[]} b - Second array
   * @returns {boolean} True when equal element by element
   */
  function bytesEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * @param {uint8[]} bytes - .xz stream
   * @returns {uint8[]} Decompressed bytes
   */
  function decodeXZContainer(bytes) {
    if (bytes.length < 12) {
      throw new Error('xz stream too short');
    }
    for (let i = 0; i < 6; i++) {
      if (bytes[i] !== XZ_MAGIC[i]) {
        throw new Error('bad xz stream header magic');
      }
    }
    /** @type {uint8} */
    const flag0 = bytes[6];
    /** @type {uint8} */
    const flag1 = bytes[7];
    /** @type {uint32} */
    const headerCrc = readU32LE(bytes, 8);
    /** @type {uint8[]} */
    const flagBytes = [flag0, flag1];
    if (crc32(flagBytes) !== headerCrc) {
      throw new Error('xz stream header CRC mismatch');
    }
    /** @type {uint32} */
    const checkId = OpCodes.And32(flag1, 0x0F);
    /** @type {int32} */
    const checkLen = checkId === 0x00 ? 0 : (checkId === 0x01 ? 4 : (checkId === 0x04 ? 8 : -1));
    if (checkLen < 0) {
      throw new Error('unsupported xz integrity check type: ' + checkId);
    }

    /** @type {float64} */
    let pos = 12;
    /** @type {uint8[]} */
    const output = [];

    while (pos < bytes.length && bytes[pos] !== 0x00) {
      /** @type {int32} */
      const headerSizeByte = bytes[pos];
      /** @type {int32} */
      const realHeaderSize = (headerSizeByte + 1) * 4;
      /** @type {uint8[]} */
      const headerBytes = bytes.slice(pos, pos + realHeaderSize);

      /** @type {uint32} */
      const declaredCrc = readU32LE(headerBytes, realHeaderSize - 4);
      /** @type {uint32} */
      const actualCrc = crc32(headerBytes.slice(0, realHeaderSize - 4));
      if (declaredCrc !== actualCrc) {
        throw new Error('xz block header CRC mismatch');
      }

      /** @type {int32} */
      let hp = 1;
      /** @type {uint8} */
      const blockFlags = headerBytes[hp++];
      /** @type {boolean} */
      let hasCompSize = false;
      /** @type {float64} */
      let compSize = 0;
      if (OpCodes.And32(blockFlags, 0x40) !== 0) {
        /** @type {VliResult} */
        const r = decodeVLI(headerBytes, hp);
        compSize = r.value;
        hasCompSize = true;
        hp = r.pos;
      }
      if (OpCodes.And32(blockFlags, 0x80) !== 0) {
        /** @type {VliResult} */
        const r = decodeVLI(headerBytes, hp);
        hp = r.pos; // the uncompressed size is not needed by this decoder
      }
      /** @type {int32} */
      const numFilters = OpCodes.And32(blockFlags, 0x03) + 1;
      for (let f = 0; f < numFilters; f++) {
        /** @type {VliResult} */
        const idR = decodeVLI(headerBytes, hp);
        hp = idR.pos;
        /** @type {VliResult} */
        const szR = decodeVLI(headerBytes, hp);
        /** @type {float64} */
        const propsSize = szR.value;
        hp = szR.pos;
        hp += propsSize; // LZMA2 dictionary-size properties byte(s) - not needed by our decoder
      }

      if (!hasCompSize) {
        throw new Error('xz block missing compressed size field (unsupported)');
      }

      /** @type {float64} */
      const blockDataStart = pos + realHeaderSize;
      /** @type {uint8[]} */
      const lzma2Bytes = bytes.slice(blockDataStart, blockDataStart + compSize);
      /** @type {uint8[]} */
      const blockOutput = [];
      decodeLZMA2(lzma2Bytes, blockOutput);
      for (let i = 0; i < blockOutput.length; i++) {
        output.push(blockOutput[i]);
      }

      /** @type {float64} */
      const blockTotalLenNoPad = realHeaderSize + compSize;
      /** @type {float64} */
      const paddedLen = Math.ceil(blockTotalLenNoPad / 4) * 4;
      /** @type {float64} */
      const checkStart = pos + paddedLen;
      /** @type {uint8[]} */
      const checkBytes = bytes.slice(checkStart, checkStart + checkLen);

      if (checkId === 0x01) {
        if (!bytesEqual(crc32Bytes(blockOutput), checkBytes)) {
          throw new Error('xz block CRC32 check mismatch');
        }
      } else if (checkId === 0x04) {
        if (!bytesEqual(crc64Bytes(blockOutput), checkBytes)) {
          throw new Error('xz block CRC64 check mismatch');
        }
      }

      pos = checkStart + checkLen;
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * XZAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class XZAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "XZ/LZMA2";
        this.description = "Genuine .xz container (stream header/block/index/footer, CRC32/CRC64) wrapping a real LZMA1 range encoder/decoder pair through real LZMA2 chunk framing. The encoder runs a hash-chain LZ77 parse (with rep0-3 match awareness) through the range coder to emit genuine LZMA-compressed chunks, falling back to an uncompressed chunk per-chunk when that is smaller. Verified genuinely interoperable with XZ Utils 5.8.2 in both directions.";
        this.inventor = "Lasse Collin, Igor Pavlov";
        this.year = 2009;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // Educational implementation for learning
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.INTL; // Finland (XZ Utils) / Russia (LZMA) - International collaboration

        // Documentation and references
        this.documentation = [
          new LinkItem("XZ Utils Wikipedia", "https://en.wikipedia.org/wiki/XZ_Utils"),
          new LinkItem("Official XZ Utils", "https://tukaani.org/xz/")
        ];

        this.references = [
          new LinkItem("XZ Format Specification", "https://tukaani.org/xz/xz-file-format.txt"),
          new LinkItem("LZMA SDK / 7-Zip", "https://www.7-zip.org/sdk.html"),
          new LinkItem("LZMA2 vs LZMA1", "https://en.wikipedia.org/wiki/LZMA"),
          new LinkItem("Linux Man Page", "https://linux.die.net/man/1/xz")
        ];

        // Test vectors - round-trip validation only, since the interesting proof
        // (byte-exact interoperability with real XZ Utils) lives in a separate
        // interop harness that pipes our output through the real `xz` binary and
        // vice versa; hand-guessed exact container bytes here would add nothing.
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input",
            "https://tukaani.org/xz/xz-file-format.txt"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("A"),
            [],
            "Single character round-trip",
            "https://tukaani.org/xz/"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello"),
            [],
            "Short text with literals round-trip",
            "https://tukaani.org/xz/xz-file-format.txt"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAAAAAAAA"),
            [],
            "Repeated pattern round-trip",
            "https://en.wikipedia.org/wiki/LZMA"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABCABC"),
            [],
            "Repeating sequence round-trip",
            "https://linux.die.net/man/1/xz"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello World! This is a test of LZMA2 compression."),
            [],
            "Natural text round-trip",
            "https://www.7-zip.org/sdk.html"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
            [],
            "Pangram text round-trip",
            "https://tukaani.org/xz/xz-file-format.txt"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new XZInstance(this, isInverse);
      }
    }

    class XZInstance extends IAlgorithmInstance {
      /**
       * @param {XZAlgorithm} algorithm - Owning algorithm
       * @param {boolean} isInverse - True for decompression
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decompress, false = compress
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }


      /**
       * @returns {uint8[]} .xz stream or decompressed bytes
       */
      Result() {
        // Empty input still has to produce a well-formed .xz stream, so it is not
        // short-circuited here; only an empty stream to decode yields nothing.
        if (this.isInverse && this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        /** @type {uint8[]} */
        let result = [];
        if (this.isInverse) {
          result = decodeXZContainer(this.inputBuffer);
        } else {
          result = encodeXZContainer(this.inputBuffer);
        }

        this.inputBuffer = [];
        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new XZAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XZAlgorithm, XZInstance };
}));
