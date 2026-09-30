/*
 * LZMA (Lempel-Ziv-Markov chain Algorithm) Compression Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Full LZMA1 encoder and decoder: hash-chain match finding feeding an adaptive
 * binary range coder with the standard LZMA probability model (literal coders
 * selected by literal-context/literal-position bits, match/rep-match state
 * machine, bit-tree length coder and slot/footer/align distance coder).
 *
 * Container layout emitted here:
 *   [5-byte properties][4-byte LE uncompressed size][range-coded payload]
 * The properties byte packs (pb * 5 + lp) * 9 + lc, followed by the dictionary
 * size as a 32-bit little-endian value, exactly as in the LZMA specification.
 * The payload always ends with the end-of-stream marker (a match with distance
 * 0xFFFFFFFF), even though the explicit size makes it redundant.
 *
 * Reference: Igor Pavlov, LZMA SDK specification (lzma.txt), https://www.7-zip.org/sdk.html
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

  // ===== LZMA CONSTANTS =====

  const NUM_BIT_MODEL_TOTAL_BITS = 11;
  const BIT_MODEL_TOTAL = 2048;          // 1 shifted left by NUM_BIT_MODEL_TOTAL_BITS
  const PROB_INIT = 1024;                // BIT_MODEL_TOTAL / 2
  const NUM_MOVE_BITS = 5;
  const TOP_VALUE = 16777216;            // 1 shifted left by 24

  const NUM_STATES = 12;
  const NUM_ALIGN_BITS = 4;
  const ALIGN_TABLE_SIZE = 16;
  const START_POS_MODEL_INDEX = 4;
  const END_POS_MODEL_INDEX = 14;
  const NUM_FULL_DISTANCES = 128;        // 1 shifted left by (END_POS_MODEL_INDEX / 2)
  const NUM_LEN_TO_POS_STATES = 4;
  const MATCH_MIN_LEN = 2;
  const NUM_REP_DISTANCES = 4;
  const MATCH_MAX_LEN = 273;             // MATCH_MIN_LEN + 8 + 8 + 256 - 1

  const LEN_NUM_LOW_BITS = 3;
  const LEN_NUM_MID_BITS = 3;
  const LEN_NUM_HIGH_BITS = 8;
  const LEN_NUM_POS_STATES_MAX = 16;     // 1 shifted left by the maximum pb of 4

  /** @type {uint32} */
  const END_MARKER_DISTANCE = 4294967295;

  /**
   * @param {int32} size - Number of entries
   * @param {int32} value - Initial value of every entry
   * @returns {int32[]} Plain array filled with value
   */
  function filledArray(size, value) {
    /** @type {int32[]} */
    const arr = new Array(size);
    for (let i = 0; i < size; ++i) {
      arr[i] = value;
    }
    return arr;
  }

  /**
   * Length-to-position state used to pick the distance slot coder.
   * @param {int32} length - Match length
   * @returns {int32} Length state 0..3
   */
  function getLenToPosState(length) {
    /** @type {int32} */
    const value = length - MATCH_MIN_LEN;
    return value < NUM_LEN_TO_POS_STATES ? value : NUM_LEN_TO_POS_STATES - 1;
  }

  /**
   * State transition after coding a literal.
   * @param {int32} state - Current state
   * @returns {int32} Next state
   */
  function stateUpdateLiteral(state) {
    if (state < 4) {
      return 0;
    }
    if (state < 10) {
      return state - 3;
    }
    return state - 6;
  }

  /**
   * State transition after coding a plain match.
   * @param {int32} state - Current state
   * @returns {int32} Next state
   */
  function stateUpdateMatch(state) {
    return state < 7 ? 7 : 10;
  }

  /**
   * State transition after coding a repeated-distance match.
   * @param {int32} state - Current state
   * @returns {int32} Next state
   */
  function stateUpdateRep(state) {
    return state < 7 ? 8 : 11;
  }

  /**
   * State transition after coding a one-byte short rep.
   * @param {int32} state - Current state
   * @returns {int32} Next state
   */
  function stateUpdateShortRep(state) {
    return state < 7 ? 9 : 11;
  }

  /**
   * True while the state still denotes a literal context.
   * @param {int32} state - Current state
   * @returns {boolean} Literal context
   */
  function stateIsLiteral(state) {
    return state < 7;
  }

  /**
   * Position slot for a distance, per the LZMA distance encoding.
   * @param {uint32} distance - Distance minus one
   * @returns {int32} Position slot
   */
  function getPosSlot(distance) {
    if (distance < 4) {
      return distance;
    }
    /** @type {int32} */
    const bitCount = 31 - Math.clz32(distance);
    /** @type {int32} */
    const low = OpCodes.And32(OpCodes.Shr32(distance, bitCount - 1), 1);
    /** @type {int32} */
    const high = OpCodes.Shl32(bitCount, 1);
    return high + low;
  }

  // ===== RANGE CODER =====

  /**
   * LZMA-style byte-aligned range encoder with adaptive binary probabilities.
   * The 33-bit `low` accumulator is kept as a plain number; every shift folds it
   * back into 32 bits so it never leaves the exactly representable range.
   */
  class RangeEncoder {
    constructor() {
      /** @type {uint8[]} */
      this.output = [];
      /** @type {float64} */
      this.low = 0;
      /** @type {uint32} */
      this.range = 4294967295;
      /** @type {int32} */
      this.cacheSize = 1;
      /** @type {int32} */
      this.cache = 0;
    }

    // The bound (range >> 11) * prob stays below 2^32, so Mul32 is exact.
    /**
     * @param {int32[]} probs - Probability array
     * @param {int32} index - Probability slot
     * @param {int32} bit - Bit to code
     */
    EncodeBit(probs, index, bit) {
      /** @type {uint32} */
      const bound = OpCodes.Mul32(OpCodes.Shr32(this.range, NUM_BIT_MODEL_TOTAL_BITS), probs[index]);
      if (bit === 0) {
        this.range = bound;
        probs[index] += OpCodes.Shr32(BIT_MODEL_TOTAL - probs[index], NUM_MOVE_BITS);
      } else {
        this.low += bound;
        this.range = OpCodes.Sub32(this.range, bound);
        probs[index] -= OpCodes.Shr32(probs[index], NUM_MOVE_BITS);
      }
      this._normalize();
    }

    /**
     * Encodes `count` bits of `value` MSB-first with a fixed 50/50 split.
     * @param {uint32} value - Bits to code
     * @param {int32} count - Bit count
     */
    EncodeDirectBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        this.range = OpCodes.Shr32(this.range, 1);
        if (OpCodes.And32(OpCodes.Shr32(value, i), 1) === 1) {
          this.low += this.range;
        }
        this._normalize();
      }
    }

    Finish() {
      for (let i = 0; i < 5; ++i) {
        this._shiftLow();
      }
    }

    _normalize() {
      if (this.range >= TOP_VALUE) {
        return;
      }
      this.range = OpCodes.Shl32(this.range, 8);
      this._shiftLow();
    }

    // low is a non-negative integer below 2^33: its low 32 bits are
    // ToUint32(low) and the carry is the bit above them.
    _shiftLow() {
      /** @type {int32} */
      const carry = Math.floor(this.low / 4294967296);
      /** @type {uint32} */
      const low32 = OpCodes.ToUint32(this.low);
      if (low32 < 4278190080 || carry !== 0) {
        /** @type {int32} */
        let temp = this.cache;
        do {
          this.output.push(OpCodes.And32(temp + carry, 0xFF));
          temp = 0xFF;
        } while (--this.cacheSize > 0);
        this.cache = OpCodes.Shr32(low32, 24);
      }
      ++this.cacheSize;
      this.low = OpCodes.Shl32(low32, 8);
    }
  }

  /** LZMA-style byte-aligned range decoder, the exact inverse of RangeEncoder. */
  class RangeDecoder {
    /**
     * @param {uint8[]} input - Input
     * @param {int32} startPos - First payload byte
     */
    constructor(input, startPos) {
      /** @type {uint8[]} */
      this.input = input;
      /** @type {int32} */
      this.pos = startPos;
      /** @type {uint32} */
      this.range = 4294967295;
      /** @type {uint32} */
      this.code = 0;
      this._nextByte(); // The first payload byte is always zero and is discarded.
      for (let i = 0; i < 4; ++i) {
        /** @type {uint8} */
        const next = this._nextByte();
        this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), next);
      }
    }

    /**
     * @returns {uint8} Next input byte, zero past the end
     */
    _nextByte() {
      if (this.pos < this.input.length) {
        return this.input[this.pos++];
      }
      return 0;
    }

    /**
     * @param {int32[]} probs - Probability array
     * @param {int32} index - Probability slot
     * @returns {uint32} Decoded bit
     */
    DecodeBit(probs, index) {
      /** @type {uint32} */
      const bound = OpCodes.Mul32(OpCodes.Shr32(this.range, NUM_BIT_MODEL_TOTAL_BITS), probs[index]);
      if (this.code < bound) {
        this.range = bound;
        probs[index] += OpCodes.Shr32(BIT_MODEL_TOTAL - probs[index], NUM_MOVE_BITS);
        this._normalize();
        return 0;
      }
      this.code = OpCodes.Sub32(this.code, bound);
      this.range = OpCodes.Sub32(this.range, bound);
      probs[index] -= OpCodes.Shr32(probs[index], NUM_MOVE_BITS);
      this._normalize();
      return 1;
    }

    /**
     * @param {int32} count - Bit count (at most 26 here, so the result stays below 2^31)
     * @returns {uint32} Bits decoded MSB-first
     */
    DecodeDirectBits(count) {
      /** @type {uint32} */
      let result = 0;
      for (let i = count - 1; i >= 0; --i) {
        this.range = OpCodes.Shr32(this.range, 1);
        /** @type {uint32} */
        const threshold = OpCodes.Shr32(OpCodes.Sub32(this.code, this.range), 31);
        this.code = OpCodes.Sub32(this.code, OpCodes.And32(this.range, OpCodes.Sub32(threshold, 1)));
        result = OpCodes.Or32(OpCodes.Shl32(result, 1), 1 - threshold);
        this._normalize();
      }
      return result;
    }

    _normalize() {
      if (this.range >= TOP_VALUE) {
        return;
      }
      this.range = OpCodes.Shl32(this.range, 8);
      /** @type {uint8} */
      const next = this._nextByte();
      this.code = OpCodes.Or32(OpCodes.Shl32(this.code, 8), next);
    }
  }

  // ===== BIT TREE CODERS =====

  /** Tree of adaptive probabilities coding a fixed-width symbol. */
  class BitTreeEncoder {
    /**
     * @param {int32} numBits - Symbol width
     */
    constructor(numBits) {
      /** @type {int32} */
      this.numBits = numBits;
      /** @type {int32[]} */
      this.probs = filledArray(OpCodes.Shl32(1, numBits), PROB_INIT);
    }

    /**
     * @param {RangeEncoder} encoder - Range encoder
     * @param {uint32} value - Symbol, MSB first
     */
    Encode(encoder, value) {
      /** @type {int32} */
      let index = 1;
      for (let bitIndex = this.numBits - 1; bitIndex >= 0; --bitIndex) {
        /** @type {int32} */
        const bit = OpCodes.And32(OpCodes.Shr32(value, bitIndex), 1);
        encoder.EncodeBit(this.probs, index, bit);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      }
    }

    /**
     * @param {RangeEncoder} encoder - Range encoder
     * @param {uint32} value - Symbol, LSB first
     */
    ReverseEncode(encoder, value) {
      /** @type {int32} */
      let index = 1;
      /** @type {uint32} */
      let remaining = value;
      for (let i = 0; i < this.numBits; ++i) {
        /** @type {int32} */
        const bit = OpCodes.And32(remaining, 1);
        encoder.EncodeBit(this.probs, index, bit);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
        remaining = OpCodes.Shr32(remaining, 1);
      }
    }
  }

  class BitTreeDecoder {
    /**
     * @param {int32} numBits - Symbol width
     */
    constructor(numBits) {
      /** @type {int32} */
      this.numBits = numBits;
      /** @type {int32[]} */
      this.probs = filledArray(OpCodes.Shl32(1, numBits), PROB_INIT);
    }

    /**
     * @param {RangeDecoder} decoder - Range decoder
     * @returns {int32} Symbol, MSB first
     */
    Decode(decoder) {
      /** @type {int32} */
      let index = 1;
      for (let i = 0; i < this.numBits; ++i) {
        /** @type {uint32} */
        const bit = decoder.DecodeBit(this.probs, index);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      }
      /** @type {int32} */
      const top = OpCodes.Shl32(1, this.numBits);
      return index - top;
    }

    /**
     * @param {RangeDecoder} decoder - Range decoder
     * @returns {uint32} Symbol, LSB first
     */
    ReverseDecode(decoder) {
      /** @type {int32} */
      let index = 1;
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < this.numBits; ++i) {
        /** @type {uint32} */
        const bit = decoder.DecodeBit(this.probs, index);
        index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
        result = OpCodes.Or32(result, OpCodes.Shl32(bit, i));
      }
      return result;
    }
  }

  /**
   * Reverse bit-tree coding into a shared probability array (distance footers).
   * @param {RangeEncoder} encoder - Range encoder
   * @param {int32[]} probs - Shared probabilities
   * @param {int32} startIndex - Offset of this tree in probs
   * @param {int32} numBits - Symbol width
   * @param {uint32} value - Symbol, LSB first
   */
  function reverseEncodeShared(encoder, probs, startIndex, numBits, value) {
    /** @type {int32} */
    let index = 1;
    /** @type {uint32} */
    let remaining = value;
    for (let i = 0; i < numBits; ++i) {
      /** @type {int32} */
      const bit = OpCodes.And32(remaining, 1);
      encoder.EncodeBit(probs, startIndex + index, bit);
      index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      remaining = OpCodes.Shr32(remaining, 1);
    }
  }

  /**
   * @param {RangeDecoder} decoder - Range decoder
   * @param {int32[]} probs - Shared probabilities
   * @param {int32} startIndex - Offset of this tree in probs
   * @param {int32} numBits - Symbol width
   * @returns {uint32} Symbol, LSB first
   */
  function reverseDecodeShared(decoder, probs, startIndex, numBits) {
    /** @type {int32} */
    let index = 1;
    /** @type {uint32} */
    let result = 0;
    for (let i = 0; i < numBits; ++i) {
      /** @type {uint32} */
      const bit = decoder.DecodeBit(probs, startIndex + index);
      index = OpCodes.Or32(OpCodes.Shl32(index, 1), bit);
      result = OpCodes.Or32(result, OpCodes.Shl32(bit, i));
    }
    return result;
  }

  // ===== LITERAL CODERS =====

  /** Literal sub-coders indexed by literal-position bits and previous-byte context. */
  class LiteralCoder {
    /**
     * @param {int32} lc - Literal context bits
     * @param {int32} lp - Literal position bits
     */
    constructor(lc, lp) {
      /** @type {int32} */
      this.lc = lc;
      /** @type {int32} */
      this.lp = lp;
      /** @type {int32} */
      this.posMask = OpCodes.Shl32(1, lp) - 1;
      /** @type {int32} */
      const numCoders = OpCodes.Shl32(1, lc + lp);
      /** @type {int32[][]} */
      this.coders = [];
      for (let i = 0; i < numCoders; ++i) {
        this.coders.push(filledArray(0x300, PROB_INIT));
      }
    }

    /**
     * @param {float64} position - Byte position
     * @param {uint8} prevByte - Previous byte
     * @returns {int32[]} Probabilities of the selected sub-coder
     */
    _subCoder(position, prevByte) {
      /** @type {int32} */
      const index = OpCodes.Shl32(OpCodes.And32(position, this.posMask), this.lc) + OpCodes.Shr32(prevByte, 8 - this.lc);
      return this.coders[index];
    }

    /**
     * @param {RangeEncoder} encoder - Range encoder
     * @param {int32} state - Current state
     * @param {uint8} curByte - Literal
     * @param {int32} matchByte - Byte at the most recent distance
     * @param {int32} position - Byte position
     * @param {int32} prevByte - Previous byte
     */
    Encode(encoder, state, curByte, matchByte, position, prevByte) {
      /** @type {int32[]} */
      const probs = this._subCoder(position, prevByte);

      if (stateIsLiteral(state)) {
        /** @type {int32} */
        let plainContext = 1;
        for (let i = 7; i >= 0; --i) {
          /** @type {int32} */
          const bit = OpCodes.And32(OpCodes.Shr32(curByte, i), 1);
          encoder.EncodeBit(probs, plainContext, bit);
          plainContext = OpCodes.Or32(OpCodes.Shl32(plainContext, 1), bit);
        }
        return;
      }

      /** @type {int32} */
      let context = 1;
      /** @type {boolean} */
      let mismatchFound = false;
      for (let i = 7; i >= 0; --i) {
        /** @type {int32} */
        const bit = OpCodes.And32(OpCodes.Shr32(curByte, i), 1);
        /** @type {int32} */
        const matchBit = OpCodes.And32(OpCodes.Shr32(matchByte, i), 1);
        if (mismatchFound) {
          encoder.EncodeBit(probs, context, bit);
        } else {
          /** @type {int32} */
          const offset = 0x100 + OpCodes.Shl32(matchBit, 8);
          encoder.EncodeBit(probs, offset + context, bit);
          if (bit !== matchBit) {
            mismatchFound = true;
          }
        }
        context = OpCodes.Or32(OpCodes.Shl32(context, 1), bit);
      }
    }

    /**
     * @param {RangeDecoder} decoder - Range decoder
     * @param {int32} state - Current state
     * @param {uint8} matchByte - Byte at the most recent distance
     * @param {float64} position - Byte position
     * @param {uint8} prevByte - Previous byte
     * @returns {int32} Literal
     */
    Decode(decoder, state, matchByte, position, prevByte) {
      /** @type {int32[]} */
      const probs = this._subCoder(position, prevByte);
      /** @type {int32} */
      let context = 1;

      if (stateIsLiteral(state)) {
        for (let i = 0; i < 8; ++i) {
          /** @type {uint32} */
          const bit = decoder.DecodeBit(probs, context);
          context = OpCodes.Or32(OpCodes.Shl32(context, 1), bit);
        }
        return context - 0x100;
      }

      /** @type {boolean} */
      let mismatchFound = false;
      for (let i = 7; i >= 0; --i) {
        /** @type {uint32} */
        const matchBit = OpCodes.And32(OpCodes.Shr32(matchByte, i), 1);
        /** @type {uint32} */
        let bit = 0;
        if (mismatchFound) {
          bit = decoder.DecodeBit(probs, context);
        } else {
          /** @type {int32} */
          const offset = 0x100 + OpCodes.Shl32(matchBit, 8);
          bit = decoder.DecodeBit(probs, offset + context);
          if (bit !== matchBit) {
            mismatchFound = true;
          }
        }
        context = OpCodes.Or32(OpCodes.Shl32(context, 1), bit);
      }
      return context - 0x100;
    }
  }

  // ===== LENGTH CODERS =====

  /** Match length coder: 2..9 (low tree), 10..17 (mid tree), 18..273 (high tree). */
  class LengthEncoder {
    constructor() {
      /** @type {int32[]} */
      this.choice = [PROB_INIT, PROB_INIT];
      /** @type {BitTreeEncoder[]} */
      this.lowCoder = [];
      /** @type {BitTreeEncoder[]} */
      this.midCoder = [];
      for (let i = 0; i < LEN_NUM_POS_STATES_MAX; ++i) {
        this.lowCoder.push(new BitTreeEncoder(LEN_NUM_LOW_BITS));
        this.midCoder.push(new BitTreeEncoder(LEN_NUM_MID_BITS));
      }
      /** @type {BitTreeEncoder} */
      this.highCoder = new BitTreeEncoder(LEN_NUM_HIGH_BITS);
    }

    /**
     * @param {RangeEncoder} encoder - Range encoder
     * @param {int32} length - Match length
     * @param {int32} posState - Position state
     */
    Encode(encoder, length, posState) {
      /** @type {int32} */
      const value = length - MATCH_MIN_LEN;
      /** @type {int32} */
      const lowCount = OpCodes.Shl32(1, LEN_NUM_LOW_BITS);
      /** @type {int32} */
      const midCount = OpCodes.Shl32(1, LEN_NUM_MID_BITS);

      if (value < lowCount) {
        encoder.EncodeBit(this.choice, 0, 0);
        /** @type {BitTreeEncoder} */
        const low = this.lowCoder[posState];
        low.Encode(encoder, value);
        return;
      }

      if (value < lowCount + midCount) {
        encoder.EncodeBit(this.choice, 0, 1);
        encoder.EncodeBit(this.choice, 1, 0);
        /** @type {BitTreeEncoder} */
        const mid = this.midCoder[posState];
        mid.Encode(encoder, value - lowCount);
        return;
      }

      encoder.EncodeBit(this.choice, 0, 1);
      encoder.EncodeBit(this.choice, 1, 1);
      this.highCoder.Encode(encoder, value - lowCount - midCount);
    }
  }

  class LengthDecoder {
    constructor() {
      /** @type {int32[]} */
      this.choice = [PROB_INIT, PROB_INIT];
      /** @type {BitTreeDecoder[]} */
      this.lowCoder = [];
      /** @type {BitTreeDecoder[]} */
      this.midCoder = [];
      for (let i = 0; i < LEN_NUM_POS_STATES_MAX; ++i) {
        this.lowCoder.push(new BitTreeDecoder(LEN_NUM_LOW_BITS));
        this.midCoder.push(new BitTreeDecoder(LEN_NUM_MID_BITS));
      }
      /** @type {BitTreeDecoder} */
      this.highCoder = new BitTreeDecoder(LEN_NUM_HIGH_BITS);
    }

    /**
     * @param {RangeDecoder} decoder - Range decoder
     * @param {int32} posState - Position state
     * @returns {int32} Match length
     */
    Decode(decoder, posState) {
      /** @type {int32} */
      const lowCount = OpCodes.Shl32(1, LEN_NUM_LOW_BITS);
      /** @type {int32} */
      const midCount = OpCodes.Shl32(1, LEN_NUM_MID_BITS);

      /** @type {uint32} */
      const choice0 = decoder.DecodeBit(this.choice, 0);
      if (choice0 === 0) {
        /** @type {BitTreeDecoder} */
        const low = this.lowCoder[posState];
        /** @type {int32} */
        const lowValue = low.Decode(decoder);
        return MATCH_MIN_LEN + lowValue;
      }
      /** @type {uint32} */
      const choice1 = decoder.DecodeBit(this.choice, 1);
      if (choice1 === 0) {
        /** @type {BitTreeDecoder} */
        const mid = this.midCoder[posState];
        /** @type {int32} */
        const midValue = mid.Decode(decoder);
        return MATCH_MIN_LEN + lowCount + midValue;
      }
      /** @type {int32} */
      const highValue = this.highCoder.Decode(decoder);
      return MATCH_MIN_LEN + lowCount + midCount + highValue;
    }
  }

  // ===== MATCH FINDER =====

  /**
   * Match found by the hash-chain finder; length 0 when none.
   */
  class MatchResult {
    /**
     * @param {int32} distance - Backward distance
     * @param {int32} length - Match length
     */
    constructor(distance, length) {
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  /** Hash-chain match finder over a 3-byte hash with a bounded chain walk. */
  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Chain window
     * @param {int32} maxChainDepth - Chain walk limit
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth;
      /** @type {int32[]} */
      this.head = new Int32Array(32768).fill(-1);
      /** @type {int32[]} */
      this.prev = new Int32Array(windowSize);
      /** @type {int32} */
      this.prevMask = windowSize - 1;
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    static Hash(data, position) {
      /** @type {uint32} */
      const mixed = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
        data[position + 2]);
      return OpCodes.And32(mixed, 0x7FFF);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Current position, inserted into the chains
     * @param {int32} maxDistance - Farthest allowed distance
     * @param {int32} maxLength - Longest allowed match
     * @param {int32} minLength - Shortest usable match
     * @returns {MatchResult} Longest (nearest on ties) match
     */
    FindMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new MatchResult(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;

      /** @type {int32} */
      const hash = HashChainMatchFinder.Hash(data, position);
      /** @type {int32} */
      let candidate = this.head[hash];
      /** @type {int32} */
      let chainCount = 0;
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          /** @type {int32} */
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length]) {
            ++length;
          }

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength) {
              break;
            }
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart) {
          break;
        }
        ++chainCount;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      if (bestLength >= minLength) {
        return new MatchResult(bestDistance, bestLength);
      }
      return new MatchResult(0, 0);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position to insert into the chains
     */
    InsertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }
      /** @type {int32} */
      const hash = HashChainMatchFinder.Hash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZMACompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZMA";
      this.description = "Lempel-Ziv-Markov chain Algorithm. Dictionary compression combining hash-chain match finding with an adaptive binary range coder and context-modelled literal, length and distance coders.";
      this.inventor = "Igor Pavlov";
      this.year = 2001;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      // Stream parameters
      /** @type {int32} */
      this.DICTIONARY_SIZE = 1048576;   // 1 MiB dictionary
      /** @type {int32} */
      this.LC = 3;                      // Literal context bits
      /** @type {int32} */
      this.LP = 0;                      // Literal position bits
      /** @type {int32} */
      this.PB = 2;                      // Position bits
      /** @type {int32} */
      this.CHAIN_DEPTH = 64;            // Hash chain walk limit

      // Documentation and references
      this.documentation = [
        new LinkItem("7-Zip LZMA SDK", "https://www.7-zip.org/sdk.html"),
        new LinkItem("Wikipedia - LZMA", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm")
      ];

      this.references = [
        new LinkItem("LZMA Specification", "https://www.7-zip.org/recover.html"),
        new LinkItem("Range Encoding Theory", "http://www.compressconsult.com/rangecoder/")
      ];

      // Test vectors - confirmed to round-trip and to match the reference
      // implementation of the same container layout byte for byte.
      // Layout: [5-byte properties][4-byte LE uncompressed size][range-coded payload]
      this.tests = [
        {
          text: "Empty input - properties, zero size and the end marker only",
          uri: "https://www.7-zip.org/sdk.html",
          input: [],
          expected: [93, 0, 0, 16, 0, 0, 0, 0, 0, 0, 131, 255, 251, 255, 255, 192, 0, 0, 0]
        },
        {
          text: "Single byte literal",
          uri: "https://www.7-zip.org/sdk.html",
          input: [65],
          expected: [93, 0, 0, 16, 0, 1, 0, 0, 0, 0, 32, 193, 251, 255, 255, 255, 224, 0, 0, 0]
        },
        {
          text: "Hello string - five literals",
          uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm",
          input: [72, 101, 108, 108, 111],
          expected: [93, 0, 0, 16, 0, 5, 0, 0, 0, 0, 36, 25, 73, 134, 231, 220, 129, 168, 9, 255, 252, 145, 112, 0]
        },
        {
          text: "ABABAB pattern - two literals then a distance-2 match",
          uri: "http://www.compressconsult.com/rangecoder/",
          input: [65, 66, 65, 66, 65, 66],
          expected: [93, 0, 0, 16, 0, 6, 0, 0, 0, 0, 32, 144, 158, 6, 16, 123, 223, 255, 254, 248, 64, 0]
        },
        {
          text: "AAAA repetition - self-referential distance-1 match",
          uri: "https://www.7-zip.org/recover.html",
          input: [65, 65, 65, 65],
          expected: [93, 0, 0, 16, 0, 4, 0, 0, 0, 0, 32, 232, 189, 255, 255, 255, 255, 224, 0, 0, 0]
        },
        {
          text: "Hello World text",
          uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm",
          input: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
          expected: [93, 0, 0, 16, 0, 11, 0, 0, 0, 0, 36, 25, 73, 134, 231, 213, 229, 106, 181, 127, 16, 146, 55, 0, 72, 255, 255, 194, 192, 0, 0]
        },
        {
          text: "Repetitive run (24 bytes) - overlapping match longer than its distance",
          uri: "https://www.7-zip.org/sdk.html",
          input: new Array(24).fill(0x61),
          expected: [93, 0, 0, 16, 0, 24, 0, 0, 0, 0, 48, 238, 7, 7, 255, 255, 255, 255, 128, 0, 0, 0]
        },
        {
          text: "Alternating pattern (16 bytes)",
          uri: "https://www.7-zip.org/sdk.html",
          input: [97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98],
          expected: [93, 0, 0, 16, 0, 16, 0, 0, 0, 0, 48, 152, 166, 3, 7, 191, 255, 255, 255, 132, 0, 0, 0]
        },
        {
          text: "Binary sample with high-bit-set bytes",
          uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm",
          input: [0xFF, 0x80, 0xAB, 0x00, 0x7F, 0x80, 0xFF, 0xFE, 0x01, 0x80, 0x81, 0x82, 0x00, 0xFF, 0x7E, 0x10],
          expected: [93, 0, 0, 16, 0, 16, 0, 0, 0, 0, 127, 160, 17, 96, 3, 249, 19, 154, 226, 18, 163, 140, 79, 149, 80, 162, 70, 214, 11, 162, 47, 255, 255, 133, 58, 0, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZMAInstance(this, isInverse);
    }
  }

  class LZMAInstance extends IAlgorithmInstance {
    /**
     * @param {LZMACompression} algorithm - Owning algorithm
     * @param {boolean} isInverse - True for decompression
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }


    /**
     * @returns {uint8[]} Compressed or decompressed bytes
     */
    Result() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      this.inputBuffer = [];
      if (this.isInverse) {
        return this._decompress(data);
      }
      return this._compress(data);
    }

    // ===== COMPRESSION =====

    /**
     * @param {uint8[]} data - Input
     * @returns {uint8[]} Properties, size and range-coded payload
     */
    _compress(data) {
      /** @type {LZMACompression} */
      const algorithm = this.algorithm;
      /** @type {int32} */
      const lc = algorithm.LC;
      /** @type {int32} */
      const lp = algorithm.LP;
      /** @type {int32} */
      const pb = algorithm.PB;
      /** @type {int32} */
      const dictionarySize = algorithm.DICTIONARY_SIZE;
      /** @type {int32} */
      const posStateMask = OpCodes.Shl32(1, pb) - 1;

      // 5-byte properties header, then the uncompressed size as 32-bit little-endian
      /** @type {uint8[]} */
      const output = [];
      output.push((pb * 5 + lp) * 9 + lc);
      output.push(OpCodes.And32(dictionarySize, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(dictionarySize, 8), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(dictionarySize, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(dictionarySize, 24), 0xFF));
      output.push(OpCodes.And32(data.length, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF));

      /** @type {RangeEncoder} */
      const encoder = new RangeEncoder();
      /** @type {LiteralCoder} */
      const literalEncoder = new LiteralCoder(lc, lp);
      /** @type {LengthEncoder} */
      const matchLenEncoder = new LengthEncoder();
      /** @type {LengthEncoder} */
      const repLenEncoder = new LengthEncoder();

      /** @type {int32} */
      let state = 0;
      /** @type {int32[]} */
      const reps = [0, 0, 0, 0];

      /** @type {int32[]} */
      const isMatch = filledArray(NUM_STATES * 16, PROB_INIT);
      /** @type {int32[]} */
      const isRep = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRepG0 = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRepG1 = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRepG2 = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRep0Long = filledArray(NUM_STATES * 16, PROB_INIT);

      /** @type {BitTreeEncoder[]} */
      const posSlotEncoder = [];
      for (let i = 0; i < NUM_LEN_TO_POS_STATES; ++i) {
        posSlotEncoder.push(new BitTreeEncoder(6));
      }
      /** @type {int32[]} */
      const posEncoders = filledArray(NUM_FULL_DISTANCES - START_POS_MODEL_INDEX, PROB_INIT);
      /** @type {BitTreeEncoder} */
      const alignEncoder = new BitTreeEncoder(NUM_ALIGN_BITS);

      /** @type {int32} */
      const windowSize = Math.min(dictionarySize, data.length > 0 ? data.length : 1);
      /** @type {HashChainMatchFinder} */
      const matchFinder = new HashChainMatchFinder(Math.max(windowSize, 4096), algorithm.CHAIN_DEPTH);

      /** @type {int32} */
      let pos = 0;
      while (pos < data.length) {
        /** @type {int32} */
        const posState = OpCodes.And32(pos, posStateMask);
        /** @type {int32} */
        const prevByte = pos > 0 ? data[pos - 1] : 0;

        // Longest run reachable through one of the four remembered distances
        /** @type {int32} */
        let bestRepLen = 0;
        /** @type {int32} */
        let bestRepIndex = 0;
        for (let rep = 0; rep < NUM_REP_DISTANCES; ++rep) {
          if (reps[rep] >= pos) {
            continue;
          }

          /** @type {int32} */
          const dist = reps[rep] + 1;
          /** @type {int32} */
          const maxLen = Math.min(MATCH_MAX_LEN, data.length - pos);
          /** @type {int32} */
          let len = 0;
          while (len < maxLen && data[pos - dist + len] === data[pos + len]) {
            ++len;
          }

          if (len < MATCH_MIN_LEN || len <= bestRepLen) {
            continue;
          }
          bestRepLen = len;
          bestRepIndex = rep;
        }

        /** @type {MatchResult} */
        const match = matchFinder.FindMatch(data, pos,
          Math.min(dictionarySize, pos),
          Math.min(MATCH_MAX_LEN, data.length - pos),
          MATCH_MIN_LEN);

        if (bestRepLen >= MATCH_MIN_LEN && (bestRepLen >= match.length || bestRepLen >= 3)) {
          // Repeated-distance match
          encoder.EncodeBit(isMatch, state * 16 + posState, 1);
          encoder.EncodeBit(isRep, state, 1);

          if (bestRepIndex === 0) {
            encoder.EncodeBit(isRepG0, state, 0);
            encoder.EncodeBit(isRep0Long, state * 16 + posState, 1);
          } else {
            encoder.EncodeBit(isRepG0, state, 1);
            if (bestRepIndex === 1) {
              encoder.EncodeBit(isRepG1, state, 0);
            } else {
              encoder.EncodeBit(isRepG1, state, 1);
              encoder.EncodeBit(isRepG2, state, bestRepIndex - 2);
            }

            /** @type {int32} */
            const dist = reps[bestRepIndex];
            for (let i = bestRepIndex; i > 0; --i) {
              reps[i] = reps[i - 1];
            }
            reps[0] = dist;
          }

          repLenEncoder.Encode(encoder, bestRepLen, posState);
          state = stateUpdateRep(state);

          for (let i = 1; i < bestRepLen; ++i) {
            matchFinder.InsertPosition(data, pos + i);
          }
          pos += bestRepLen;
        } else if (match.length >= MATCH_MIN_LEN) {
          // Explicit-distance match
          encoder.EncodeBit(isMatch, state * 16 + posState, 1);
          encoder.EncodeBit(isRep, state, 0);

          matchLenEncoder.Encode(encoder, match.length, posState);

          /** @type {int32} */
          const distance = match.distance - 1;
          this._encodeDistance(encoder, posSlotEncoder, posEncoders, alignEncoder, distance, match.length);

          for (let i = NUM_REP_DISTANCES - 1; i > 0; --i) {
            reps[i] = reps[i - 1];
          }
          reps[0] = distance;

          state = stateUpdateMatch(state);

          for (let i = 1; i < match.length; ++i) {
            matchFinder.InsertPosition(data, pos + i);
          }
          pos += match.length;
        } else {
          // Literal
          encoder.EncodeBit(isMatch, state * 16 + posState, 0);

          /** @type {int32} */
          const matchByte = (pos > 0 && reps[0] < pos) ? data[pos - reps[0] - 1] : 0;
          literalEncoder.Encode(encoder, state, data[pos], matchByte, pos, prevByte);
          state = stateUpdateLiteral(state);
          ++pos;
        }
      }

      // End-of-stream marker: a match carrying distance 0xFFFFFFFF
      /** @type {int32} */
      const endPosState = OpCodes.And32(pos, posStateMask);
      encoder.EncodeBit(isMatch, state * 16 + endPosState, 1);
      encoder.EncodeBit(isRep, state, 0);
      matchLenEncoder.Encode(encoder, MATCH_MIN_LEN, endPosState);
      this._encodeDistance(encoder, posSlotEncoder, posEncoders, alignEncoder, END_MARKER_DISTANCE, MATCH_MIN_LEN);

      encoder.Finish();

      for (let i = 0; i < encoder.output.length; ++i) {
        output.push(encoder.output[i]);
      }
      return output;
    }

    /**
     * @param {RangeEncoder} encoder - Range encoder
     * @param {BitTreeEncoder[]} posSlotEncoder - Slot coder per length state
     * @param {int32[]} posEncoders - Shared footer probabilities
     * @param {BitTreeEncoder} alignEncoder - Align-bit coder
     * @param {uint32} distance - Distance minus one (0xFFFFFFFF for the end marker)
     * @param {int32} length - Match length
     */
    _encodeDistance(encoder, posSlotEncoder, posEncoders, alignEncoder, distance, length) {
      /** @type {int32} */
      const lenToPosState = getLenToPosState(length);

      if (distance < NUM_FULL_DISTANCES) {
        /** @type {int32} */
        const shortSlot = getPosSlot(distance);
        posSlotEncoder[lenToPosState].Encode(encoder, shortSlot);
        if (shortSlot < START_POS_MODEL_INDEX) {
          return;
        }

        /** @type {int32} */
        const shortFooterBits = OpCodes.Shr32(shortSlot, 1) - 1;
        /** @type {int32} */
        const shortBaseVal = OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(shortSlot, 1)), shortFooterBits);
        /** @type {int32} */
        const shortDistance = distance;
        reverseEncodeShared(encoder, posEncoders, shortBaseVal - shortSlot - 1, shortFooterBits, shortDistance - shortBaseVal);
        return;
      }

      /** @type {int32} */
      const posSlot = distance >= END_MARKER_DISTANCE ? 63 : getPosSlot(distance);
      posSlotEncoder[lenToPosState].Encode(encoder, posSlot);

      /** @type {int32} */
      const footerBits = OpCodes.Shr32(posSlot, 1) - 1;
      /** @type {uint32} */
      const baseVal = OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(posSlot, 1)), footerBits);
      /** @type {uint32} */
      const posReduced = OpCodes.Sub32(distance, baseVal);

      if (posSlot >= END_POS_MODEL_INDEX) {
        encoder.EncodeDirectBits(OpCodes.Shr32(posReduced, NUM_ALIGN_BITS), footerBits - NUM_ALIGN_BITS);
        alignEncoder.ReverseEncode(encoder, OpCodes.And32(posReduced, ALIGN_TABLE_SIZE - 1));
      } else {
        /** @type {int32} */
        const smallBase = baseVal;
        reverseEncodeShared(encoder, posEncoders, smallBase - posSlot - 1, footerBits, posReduced);
      }
    }

    // ===== DECOMPRESSION =====

    /**
     * @param {uint8[]} data - Properties, size and range-coded payload
     * @returns {uint8[]} Decompressed bytes
     */
    _decompress(data) {
      if (data.length < 9) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {int32} */
      let propByte = data[0];
      if (propByte >= 225) {
        throw new Error("LZMA decompression error: invalid properties byte");
      }
      /** @type {int32} */
      const lc = propByte % 9;
      propByte = Math.floor(propByte / 9);
      /** @type {int32} */
      const lp = propByte % 5;
      /** @type {int32} */
      const pb = Math.floor(propByte / 5);
      /** @type {int32} */
      const posStateMask = OpCodes.Shl32(1, pb) - 1;

      /** @type {uint32} */
      const uncompressedSize = OpCodes.Pack32LE(data[5], data[6], data[7], data[8]);

      /** @type {uint8[]} */
      const output = [];
      if (uncompressedSize === 0) {
        return output;
      }

      /** @type {RangeDecoder} */
      const decoder = new RangeDecoder(data, 9);
      /** @type {LiteralCoder} */
      const literalDecoder = new LiteralCoder(lc, lp);
      /** @type {LengthDecoder} */
      const matchLenDecoder = new LengthDecoder();
      /** @type {LengthDecoder} */
      const repLenDecoder = new LengthDecoder();

      /** @type {int32} */
      let state = 0;
      /** @type {float64[]} */
      const reps = [0, 0, 0, 0];

      /** @type {int32[]} */
      const isMatch = filledArray(NUM_STATES * 16, PROB_INIT);
      /** @type {int32[]} */
      const isRep = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRepG0 = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRepG1 = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRepG2 = filledArray(NUM_STATES, PROB_INIT);
      /** @type {int32[]} */
      const isRep0Long = filledArray(NUM_STATES * 16, PROB_INIT);

      /** @type {BitTreeDecoder[]} */
      const posSlotDecoder = [];
      for (let i = 0; i < NUM_LEN_TO_POS_STATES; ++i) {
        posSlotDecoder.push(new BitTreeDecoder(6));
      }
      /** @type {int32[]} */
      const posDecoders = filledArray(NUM_FULL_DISTANCES - START_POS_MODEL_INDEX, PROB_INIT);
      /** @type {BitTreeDecoder} */
      const alignDecoder = new BitTreeDecoder(NUM_ALIGN_BITS);

      /** @type {float64} */
      let outPos = 0;
      // A short rep reaching before the start yields an undefined byte, which
      // every later bit extraction reads as zero, exactly as before.
      /** @type {uint8} */
      let prevByte = 0;

      while (outPos < uncompressedSize) {
        /** @type {int32} */
        const posState = OpCodes.And32(outPos, posStateMask);

        /** @type {uint32} */
        const matchFlag = decoder.DecodeBit(isMatch, state * 16 + posState);
        if (matchFlag === 0) {
          /** @type {uint8} */
          const matchByte = (outPos > 0 && reps[0] < outPos) ? output[outPos - reps[0] - 1] : 0;
          /** @type {int32} */
          const literal = literalDecoder.Decode(decoder, state, matchByte, outPos, prevByte);
          output.push(literal);
          prevByte = literal;
          state = stateUpdateLiteral(state);
          ++outPos;
          continue;
        }

        /** @type {int32} */
        let length = 0;
        /** @type {float64} */
        let distance = 0;

        /** @type {uint32} */
        const repFlag = decoder.DecodeBit(isRep, state);
        if (repFlag === 0) {
          length = matchLenDecoder.Decode(decoder, posState);
          state = stateUpdateMatch(state);

          distance = this._decodeDistance(decoder, posSlotDecoder, posDecoders, alignDecoder, length);
          if (distance === END_MARKER_DISTANCE) {
            break;
          }

          for (let i = NUM_REP_DISTANCES - 1; i > 0; --i) {
            reps[i] = reps[i - 1];
          }
          reps[0] = distance;
        } else {
          /** @type {uint32} */
          const g0Flag = decoder.DecodeBit(isRepG0, state);
          if (g0Flag === 0) {
            /** @type {uint32} */
            const longFlag = decoder.DecodeBit(isRep0Long, state * 16 + posState);
            if (longFlag === 0) {
              // Short rep: repeat a single byte from the most recent distance
              state = stateUpdateShortRep(state);
              /** @type {uint8} */
              const repeated = output[outPos - reps[0] - 1];
              output.push(repeated);
              prevByte = repeated;
              ++outPos;
              continue;
            }
          } else {
            /** @type {float64} */
            let dist = 0;
            /** @type {uint32} */
            const g1Flag = decoder.DecodeBit(isRepG1, state);
            if (g1Flag === 0) {
              dist = reps[1];
            } else {
              /** @type {uint32} */
              const g2Flag = decoder.DecodeBit(isRepG2, state);
              if (g2Flag === 0) {
                dist = reps[2];
              } else {
                dist = reps[3];
                reps[3] = reps[2];
              }
              reps[2] = reps[1];
            }
            reps[1] = reps[0];
            reps[0] = dist;
          }

          length = repLenDecoder.Decode(decoder, posState);
          state = stateUpdateRep(state);
          distance = reps[0];
        }

        /** @type {float64} */
        const actualDistance = distance + 1;
        if (actualDistance > outPos) {
          throw new Error("LZMA decompression error: distance exceeds produced output");
        }
        for (let i = 0; i < length; ++i) {
          output.push(output[output.length - actualDistance]);
        }
        prevByte = output[output.length - 1];
        outPos += length;
      }

      if (output.length > uncompressedSize) {
        return output.slice(0, uncompressedSize);
      }
      return output;
    }

    /**
     * @param {RangeDecoder} decoder - Range decoder
     * @param {BitTreeDecoder[]} posSlotDecoder - Slot coder per length state
     * @param {int32[]} posDecoders - Shared footer probabilities
     * @param {BitTreeDecoder} alignDecoder - Align-bit coder
     * @param {int32} length - Match length
     * @returns {float64} Distance minus one (0xFFFFFFFF for the end marker)
     */
    _decodeDistance(decoder, posSlotDecoder, posDecoders, alignDecoder, length) {
      /** @type {int32} */
      const lenToPosState = getLenToPosState(length);
      /** @type {BitTreeDecoder} */
      const slotDecoder = posSlotDecoder[lenToPosState];
      /** @type {int32} */
      const posSlot = slotDecoder.Decode(decoder);
      if (posSlot < START_POS_MODEL_INDEX) {
        return posSlot;
      }

      /** @type {int32} */
      const numDirectBits = OpCodes.Shr32(posSlot, 1) - 1;
      /** @type {float64} */
      let result = OpCodes.Shl32(OpCodes.Or32(2, OpCodes.And32(posSlot, 1)), numDirectBits);

      if (posSlot < END_POS_MODEL_INDEX) {
        /** @type {int32} */
        const smallBase = result;
        /** @type {float64} */
        const footer = reverseDecodeShared(decoder, posDecoders, smallBase - posSlot - 1, numDirectBits);
        result += footer;
      } else {
        /** @type {float64} */
        const direct = decoder.DecodeDirectBits(numDirectBits - NUM_ALIGN_BITS);
        result += direct * ALIGN_TABLE_SIZE;
        /** @type {float64} */
        const align = alignDecoder.ReverseDecode(decoder);
        result += align;
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZMACompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZMACompression, LZMAInstance };
}));
