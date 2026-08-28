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

  const END_MARKER_DISTANCE = 4294967295;

  /** Length-to-position state used to pick the distance slot coder. */
  function getLenToPosState(length) {
    const value = length - MATCH_MIN_LEN;
    return value < NUM_LEN_TO_POS_STATES ? value : NUM_LEN_TO_POS_STATES - 1;
  }

  /** State transition after coding a literal. */
  function stateUpdateLiteral(state) {
    if (state < 4) return 0;
    if (state < 10) return state - 3;
    return state - 6;
  }

  /** State transition after coding a plain match. */
  function stateUpdateMatch(state) {
    return state < 7 ? 7 : 10;
  }

  /** State transition after coding a repeated-distance match. */
  function stateUpdateRep(state) {
    return state < 7 ? 8 : 11;
  }

  /** State transition after coding a one-byte short rep. */
  function stateUpdateShortRep(state) {
    return state < 7 ? 9 : 11;
  }

  /** True while the state still denotes a literal context. */
  function stateIsLiteral(state) {
    return state < 7;
  }

  /** Position slot for a distance, per the LZMA distance encoding. */
  function getPosSlot(distance) {
    if (distance < 4) return distance;
    const bitCount = 31 - Math.clz32(distance);
    return OpCodes.Shl32(bitCount, 1) + (OpCodes.Shr32(distance, bitCount - 1)&1);
  }

  // ===== RANGE CODER =====

  /**
   * LZMA-style byte-aligned range encoder with adaptive binary probabilities.
   * The 33-bit `low` accumulator is kept as a plain number; every shift folds it
   * back into 32 bits so it never leaves the exactly representable range.
   */
  class RangeEncoder {
    constructor() {
      this.output = [];
      this.low = 0;
      this.range = 4294967295;
      this.cacheSize = 1;
      this.cache = 0;
    }

    EncodeBit(probs, index, bit) {
      const bound = OpCodes.Shr32(this.range, NUM_BIT_MODEL_TOTAL_BITS) * probs[index];
      if (bit === 0) {
        this.range = bound;
        probs[index] += OpCodes.Shr32(BIT_MODEL_TOTAL - probs[index], NUM_MOVE_BITS);
      } else {
        this.low += bound;
        this.range = this.range - bound;
        probs[index] -= OpCodes.Shr32(probs[index], NUM_MOVE_BITS);
      }
      this._normalize();
    }

    /** Encodes `count` bits of `value` MSB-first with a fixed 50/50 split. */
    EncodeDirectBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        this.range = OpCodes.Shr32(this.range, 1);
        if ((OpCodes.Shr32(value, i)&1) === 1) {
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
      if (this.range >= TOP_VALUE) return;
      this.range = OpCodes.Shl32(this.range, 8);
      this._shiftLow();
    }

    _shiftLow() {
      const carry = Math.floor(this.low / 4294967296);
      const low32 = this.low - carry * 4294967296;
      if (low32 < 4278190080 || carry !== 0) {
        let temp = this.cache;
        do {
          this.output.push((temp + carry)&0xFF);
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
    constructor(input, startPos) {
      this.input = input;
      this.pos = startPos;
      this.range = 4294967295;
      this.code = 0;
      this._nextByte(); // The first payload byte is always zero and is discarded.
      for (let i = 0; i < 4; ++i) {
        this.code = OpCodes.ToUint32(OpCodes.Shl32(this.code, 8) | this._nextByte());
      }
    }

    _nextByte() {
      return this.pos < this.input.length ? this.input[this.pos++] : 0;
    }

    DecodeBit(probs, index) {
      const bound = OpCodes.Shr32(this.range, NUM_BIT_MODEL_TOTAL_BITS) * probs[index];
      if (this.code < bound) {
        this.range = bound;
        probs[index] += OpCodes.Shr32(BIT_MODEL_TOTAL - probs[index], NUM_MOVE_BITS);
        this._normalize();
        return 0;
      }
      this.code = this.code - bound;
      this.range = this.range - bound;
      probs[index] -= OpCodes.Shr32(probs[index], NUM_MOVE_BITS);
      this._normalize();
      return 1;
    }

    DecodeDirectBits(count) {
      let result = 0;
      for (let i = count - 1; i >= 0; --i) {
        this.range = OpCodes.Shr32(this.range, 1);
        const threshold = OpCodes.Shr32(OpCodes.ToUint32(this.code - this.range), 31);
        this.code = OpCodes.ToUint32(this.code - OpCodes.And32(this.range, OpCodes.ToUint32(threshold - 1)));
        result = OpCodes.Shl32(result, 1) | (1 - threshold);
        this._normalize();
      }
      return result;
    }

    _normalize() {
      if (this.range >= TOP_VALUE) return;
      this.range = OpCodes.Shl32(this.range, 8);
      this.code = OpCodes.ToUint32(OpCodes.Shl32(this.code, 8) | this._nextByte());
    }
  }

  // ===== BIT TREE CODERS =====

  /** Tree of adaptive probabilities coding a fixed-width symbol. */
  class BitTreeEncoder {
    constructor(numBits) {
      this.numBits = numBits;
      this.probs = new Array(OpCodes.Shl32(1, numBits)).fill(PROB_INIT);
    }

    Encode(encoder, value) {
      let index = 1;
      for (let bitIndex = this.numBits - 1; bitIndex >= 0; --bitIndex) {
        const bit = OpCodes.Shr32(value, bitIndex)&1;
        encoder.EncodeBit(this.probs, index, bit);
        index = OpCodes.Shl32(index, 1) | bit;
      }
    }

    ReverseEncode(encoder, value) {
      let index = 1;
      let remaining = value;
      for (let i = 0; i < this.numBits; ++i) {
        const bit = remaining&1;
        encoder.EncodeBit(this.probs, index, bit);
        index = OpCodes.Shl32(index, 1) | bit;
        remaining = OpCodes.Shr32(remaining, 1);
      }
    }
  }

  class BitTreeDecoder {
    constructor(numBits) {
      this.numBits = numBits;
      this.probs = new Array(OpCodes.Shl32(1, numBits)).fill(PROB_INIT);
    }

    Decode(decoder) {
      let index = 1;
      for (let i = 0; i < this.numBits; ++i) {
        index = OpCodes.Shl32(index, 1) | decoder.DecodeBit(this.probs, index);
      }
      return index - OpCodes.Shl32(1, this.numBits);
    }

    ReverseDecode(decoder) {
      let index = 1;
      let result = 0;
      for (let i = 0; i < this.numBits; ++i) {
        const bit = decoder.DecodeBit(this.probs, index);
        index = OpCodes.Shl32(index, 1) | bit;
        result = result | OpCodes.Shl32(bit, i);
      }
      return result;
    }
  }

  /** Reverse bit-tree coding into a shared probability array (distance footers). */
  function reverseEncodeShared(encoder, probs, startIndex, numBits, value) {
    let index = 1;
    let remaining = value;
    for (let i = 0; i < numBits; ++i) {
      const bit = remaining&1;
      encoder.EncodeBit(probs, startIndex + index, bit);
      index = OpCodes.Shl32(index, 1) | bit;
      remaining = OpCodes.Shr32(remaining, 1);
    }
  }

  function reverseDecodeShared(decoder, probs, startIndex, numBits) {
    let index = 1;
    let result = 0;
    for (let i = 0; i < numBits; ++i) {
      const bit = decoder.DecodeBit(probs, startIndex + index);
      index = OpCodes.Shl32(index, 1) | bit;
      result = result | OpCodes.Shl32(bit, i);
    }
    return result;
  }

  // ===== LITERAL CODERS =====

  /** Literal sub-coders indexed by literal-position bits and previous-byte context. */
  class LiteralCoder {
    constructor(lc, lp) {
      this.lc = lc;
      this.lp = lp;
      this.posMask = OpCodes.Shl32(1, lp) - 1;
      const numCoders = OpCodes.Shl32(1, lc + lp);
      this.coders = [];
      for (let i = 0; i < numCoders; ++i) {
        this.coders.push(new Array(0x300).fill(PROB_INIT));
      }
    }

    _subCoder(position, prevByte) {
      const index = OpCodes.Shl32(position&this.posMask, this.lc) + OpCodes.Shr32(prevByte, 8 - this.lc);
      return this.coders[index];
    }

    Encode(encoder, state, curByte, matchByte, position, prevByte) {
      const probs = this._subCoder(position, prevByte);

      if (stateIsLiteral(state)) {
        let plainContext = 1;
        for (let i = 7; i >= 0; --i) {
          const bit = OpCodes.Shr32(curByte, i)&1;
          encoder.EncodeBit(probs, plainContext, bit);
          plainContext = OpCodes.Shl32(plainContext, 1) | bit;
        }
        return;
      }

      let context = 1;
      let mismatchFound = false;
      for (let i = 7; i >= 0; --i) {
        const bit = OpCodes.Shr32(curByte, i)&1;
        const matchBit = OpCodes.Shr32(matchByte, i)&1;
        if (mismatchFound) {
          encoder.EncodeBit(probs, context, bit);
        } else {
          const offset = 0x100 + OpCodes.Shl32(matchBit, 8);
          encoder.EncodeBit(probs, offset + context, bit);
          if (bit !== matchBit) mismatchFound = true;
        }
        context = OpCodes.Shl32(context, 1) | bit;
      }
    }

    Decode(decoder, state, matchByte, position, prevByte) {
      const probs = this._subCoder(position, prevByte);
      let context = 1;

      if (stateIsLiteral(state)) {
        for (let i = 0; i < 8; ++i) {
          context = OpCodes.Shl32(context, 1) | decoder.DecodeBit(probs, context);
        }
        return context - 0x100;
      }

      let mismatchFound = false;
      for (let i = 7; i >= 0; --i) {
        const matchBit = OpCodes.Shr32(matchByte, i)&1;
        let bit;
        if (mismatchFound) {
          bit = decoder.DecodeBit(probs, context);
        } else {
          const offset = 0x100 + OpCodes.Shl32(matchBit, 8);
          bit = decoder.DecodeBit(probs, offset + context);
          if (bit !== matchBit) mismatchFound = true;
        }
        context = OpCodes.Shl32(context, 1) | bit;
      }
      return context - 0x100;
    }
  }

  // ===== LENGTH CODERS =====

  /** Match length coder: 2..9 (low tree), 10..17 (mid tree), 18..273 (high tree). */
  class LengthEncoder {
    constructor() {
      this.choice = [PROB_INIT, PROB_INIT];
      this.lowCoder = [];
      this.midCoder = [];
      for (let i = 0; i < LEN_NUM_POS_STATES_MAX; ++i) {
        this.lowCoder.push(new BitTreeEncoder(LEN_NUM_LOW_BITS));
        this.midCoder.push(new BitTreeEncoder(LEN_NUM_MID_BITS));
      }
      this.highCoder = new BitTreeEncoder(LEN_NUM_HIGH_BITS);
    }

    Encode(encoder, length, posState) {
      const value = length - MATCH_MIN_LEN;
      const lowCount = OpCodes.Shl32(1, LEN_NUM_LOW_BITS);
      const midCount = OpCodes.Shl32(1, LEN_NUM_MID_BITS);

      if (value < lowCount) {
        encoder.EncodeBit(this.choice, 0, 0);
        this.lowCoder[posState].Encode(encoder, value);
        return;
      }

      if (value < lowCount + midCount) {
        encoder.EncodeBit(this.choice, 0, 1);
        encoder.EncodeBit(this.choice, 1, 0);
        this.midCoder[posState].Encode(encoder, value - lowCount);
        return;
      }

      encoder.EncodeBit(this.choice, 0, 1);
      encoder.EncodeBit(this.choice, 1, 1);
      this.highCoder.Encode(encoder, value - lowCount - midCount);
    }
  }

  class LengthDecoder {
    constructor() {
      this.choice = [PROB_INIT, PROB_INIT];
      this.lowCoder = [];
      this.midCoder = [];
      for (let i = 0; i < LEN_NUM_POS_STATES_MAX; ++i) {
        this.lowCoder.push(new BitTreeDecoder(LEN_NUM_LOW_BITS));
        this.midCoder.push(new BitTreeDecoder(LEN_NUM_MID_BITS));
      }
      this.highCoder = new BitTreeDecoder(LEN_NUM_HIGH_BITS);
    }

    Decode(decoder, posState) {
      const lowCount = OpCodes.Shl32(1, LEN_NUM_LOW_BITS);
      const midCount = OpCodes.Shl32(1, LEN_NUM_MID_BITS);

      if (decoder.DecodeBit(this.choice, 0) === 0) {
        return MATCH_MIN_LEN + this.lowCoder[posState].Decode(decoder);
      }
      if (decoder.DecodeBit(this.choice, 1) === 0) {
        return MATCH_MIN_LEN + lowCount + this.midCoder[posState].Decode(decoder);
      }
      return MATCH_MIN_LEN + lowCount + midCount + this.highCoder.Decode(decoder);
    }
  }

  // ===== MATCH FINDER =====

  /** Hash-chain match finder over a 3-byte hash with a bounded chain walk. */
  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(32768).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
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
      this.DICTIONARY_SIZE = 1048576;   // 1 MiB dictionary
      this.LC = 3;                      // Literal context bits
      this.LP = 0;                      // Literal position bits
      this.PB = 2;                      // Position bits
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

    // ===== COMPRESSION =====

    _compress(data) {
      const lc = this.algorithm.LC;
      const lp = this.algorithm.LP;
      const pb = this.algorithm.PB;
      const dictionarySize = this.algorithm.DICTIONARY_SIZE;
      const posStateMask = OpCodes.Shl32(1, pb) - 1;

      // 5-byte properties header, then the uncompressed size as 32-bit little-endian
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

      const encoder = new RangeEncoder();
      const literalEncoder = new LiteralCoder(lc, lp);
      const matchLenEncoder = new LengthEncoder();
      const repLenEncoder = new LengthEncoder();

      let state = 0;
      const reps = [0, 0, 0, 0];

      const isMatch = new Array(NUM_STATES * 16).fill(PROB_INIT);
      const isRep = new Array(NUM_STATES).fill(PROB_INIT);
      const isRepG0 = new Array(NUM_STATES).fill(PROB_INIT);
      const isRepG1 = new Array(NUM_STATES).fill(PROB_INIT);
      const isRepG2 = new Array(NUM_STATES).fill(PROB_INIT);
      const isRep0Long = new Array(NUM_STATES * 16).fill(PROB_INIT);

      const posSlotEncoder = [];
      for (let i = 0; i < NUM_LEN_TO_POS_STATES; ++i) {
        posSlotEncoder.push(new BitTreeEncoder(6));
      }
      const posEncoders = new Array(NUM_FULL_DISTANCES - START_POS_MODEL_INDEX).fill(PROB_INIT);
      const alignEncoder = new BitTreeEncoder(NUM_ALIGN_BITS);

      const windowSize = Math.min(dictionarySize, data.length > 0 ? data.length : 1);
      const matchFinder = new HashChainMatchFinder(Math.max(windowSize, 4096), this.algorithm.CHAIN_DEPTH);

      let pos = 0;
      while (pos < data.length) {
        const posState = pos&posStateMask;
        const prevByte = pos > 0 ? data[pos - 1] : 0;

        // Longest run reachable through one of the four remembered distances
        let bestRepLen = 0;
        let bestRepIndex = 0;
        for (let rep = 0; rep < NUM_REP_DISTANCES; ++rep) {
          if (reps[rep] >= pos) continue;

          const dist = reps[rep] + 1;
          const maxLen = Math.min(MATCH_MAX_LEN, data.length - pos);
          let len = 0;
          while (len < maxLen && data[pos - dist + len] === data[pos + len]) {
            ++len;
          }

          if (len < MATCH_MIN_LEN || len <= bestRepLen) continue;
          bestRepLen = len;
          bestRepIndex = rep;
        }

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

          const matchByte = (pos > 0 && reps[0] < pos) ? data[pos - reps[0] - 1] : 0;
          literalEncoder.Encode(encoder, state, data[pos], matchByte, pos, prevByte);
          state = stateUpdateLiteral(state);
          ++pos;
        }
      }

      // End-of-stream marker: a match carrying distance 0xFFFFFFFF
      const endPosState = pos&posStateMask;
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

    _encodeDistance(encoder, posSlotEncoder, posEncoders, alignEncoder, distance, length) {
      const lenToPosState = getLenToPosState(length);

      if (distance < NUM_FULL_DISTANCES) {
        const shortSlot = getPosSlot(distance);
        posSlotEncoder[lenToPosState].Encode(encoder, shortSlot);
        if (shortSlot < START_POS_MODEL_INDEX) return;

        const shortFooterBits = OpCodes.Shr32(shortSlot, 1) - 1;
        const shortBaseVal = OpCodes.Shl32(2 | (shortSlot&1), shortFooterBits);
        reverseEncodeShared(encoder, posEncoders, shortBaseVal - shortSlot - 1, shortFooterBits, distance - shortBaseVal);
        return;
      }

      const posSlot = distance >= END_MARKER_DISTANCE ? 63 : getPosSlot(distance);
      posSlotEncoder[lenToPosState].Encode(encoder, posSlot);

      const footerBits = OpCodes.Shr32(posSlot, 1) - 1;
      const baseVal = OpCodes.Shl32(2 | (posSlot&1), footerBits);
      const posReduced = OpCodes.ToUint32(distance - baseVal);

      if (posSlot >= END_POS_MODEL_INDEX) {
        encoder.EncodeDirectBits(OpCodes.Shr32(posReduced, NUM_ALIGN_BITS), footerBits - NUM_ALIGN_BITS);
        alignEncoder.ReverseEncode(encoder, posReduced&(ALIGN_TABLE_SIZE - 1));
      } else {
        reverseEncodeShared(encoder, posEncoders, baseVal - posSlot - 1, footerBits, posReduced);
      }
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      if (data.length < 9) return [];

      let propByte = data[0];
      if (propByte >= 225) {
        throw new Error("LZMA decompression error: invalid properties byte");
      }
      const lc = propByte % 9;
      propByte = Math.floor(propByte / 9);
      const lp = propByte % 5;
      const pb = Math.floor(propByte / 5);
      const posStateMask = OpCodes.Shl32(1, pb) - 1;

      const uncompressedSize = OpCodes.Pack32LE(data[5], data[6], data[7], data[8]);

      const output = [];
      if (uncompressedSize === 0) return output;

      const decoder = new RangeDecoder(data, 9);
      const literalDecoder = new LiteralCoder(lc, lp);
      const matchLenDecoder = new LengthDecoder();
      const repLenDecoder = new LengthDecoder();

      let state = 0;
      const reps = [0, 0, 0, 0];

      const isMatch = new Array(NUM_STATES * 16).fill(PROB_INIT);
      const isRep = new Array(NUM_STATES).fill(PROB_INIT);
      const isRepG0 = new Array(NUM_STATES).fill(PROB_INIT);
      const isRepG1 = new Array(NUM_STATES).fill(PROB_INIT);
      const isRepG2 = new Array(NUM_STATES).fill(PROB_INIT);
      const isRep0Long = new Array(NUM_STATES * 16).fill(PROB_INIT);

      const posSlotDecoder = [];
      for (let i = 0; i < NUM_LEN_TO_POS_STATES; ++i) {
        posSlotDecoder.push(new BitTreeDecoder(6));
      }
      const posDecoders = new Array(NUM_FULL_DISTANCES - START_POS_MODEL_INDEX).fill(PROB_INIT);
      const alignDecoder = new BitTreeDecoder(NUM_ALIGN_BITS);

      let outPos = 0;
      let prevByte = 0;

      while (outPos < uncompressedSize) {
        const posState = outPos&posStateMask;

        if (decoder.DecodeBit(isMatch, state * 16 + posState) === 0) {
          const matchByte = (outPos > 0 && reps[0] < outPos) ? output[outPos - reps[0] - 1] : 0;
          const literal = literalDecoder.Decode(decoder, state, matchByte, outPos, prevByte);
          output.push(literal);
          prevByte = literal;
          state = stateUpdateLiteral(state);
          ++outPos;
          continue;
        }

        let length;
        let distance;

        if (decoder.DecodeBit(isRep, state) === 0) {
          length = matchLenDecoder.Decode(decoder, posState);
          state = stateUpdateMatch(state);

          distance = this._decodeDistance(decoder, posSlotDecoder, posDecoders, alignDecoder, length);
          if (distance === END_MARKER_DISTANCE) break;

          for (let i = NUM_REP_DISTANCES - 1; i > 0; --i) {
            reps[i] = reps[i - 1];
          }
          reps[0] = distance;
        } else {
          if (decoder.DecodeBit(isRepG0, state) === 0) {
            if (decoder.DecodeBit(isRep0Long, state * 16 + posState) === 0) {
              // Short rep: repeat a single byte from the most recent distance
              state = stateUpdateShortRep(state);
              const repeated = output[outPos - reps[0] - 1];
              output.push(repeated);
              prevByte = repeated;
              ++outPos;
              continue;
            }
          } else {
            let dist;
            if (decoder.DecodeBit(isRepG1, state) === 0) {
              dist = reps[1];
            } else {
              if (decoder.DecodeBit(isRepG2, state) === 0) {
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

      return output.length > uncompressedSize ? output.slice(0, uncompressedSize) : output;
    }

    _decodeDistance(decoder, posSlotDecoder, posDecoders, alignDecoder, length) {
      const lenToPosState = getLenToPosState(length);
      const posSlot = posSlotDecoder[lenToPosState].Decode(decoder);
      if (posSlot < START_POS_MODEL_INDEX) return posSlot;

      const numDirectBits = OpCodes.Shr32(posSlot, 1) - 1;
      let result = OpCodes.Shl32(2 | (posSlot&1), numDirectBits);

      if (posSlot < END_POS_MODEL_INDEX) {
        result += reverseDecodeShared(decoder, posDecoders, result - posSlot - 1, numDirectBits);
      } else {
        result += decoder.DecodeDirectBits(numDirectBits - NUM_ALIGN_BITS) * ALIGN_TABLE_SIZE;
        result += alignDecoder.ReverseDecode(decoder);
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
