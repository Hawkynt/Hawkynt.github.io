/*
 * Quantum Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Quantum is the LZ77 + range/arithmetic-coding compression method that
 * Microsoft licensed from David Stafford's "Quantum" archiver for use inside
 * Cabinet (.CAB) files, alongside DEFLATE and LZX. Microsoft never published
 * an official bitstream specification; the format was reverse engineered and
 * documented in prose by Matthew Russotto ("Quantum compression format",
 * http://www.russotto.net/quantumcomp.html) and is also described at a high
 * level by Stuart Caie's libmspack project documentation
 * (https://www.cabextract.org.uk/libmspack/doc/), which credits Russotto's
 * write-up as the basis for its own Quantum decompressor.
 *
 * Note: this module was written from those prose descriptions only (no
 * decompressor source code was read or transcribed) and is a clean-room,
 * good-faith reconstruction of the general shape of Quantum: LZ77 dictionary
 * matches whose literals, match lengths and match distances are entropy
 * coded by an adaptive binary arithmetic coder driven by several small
 * position/history-dependent context models (mirroring the general idea of
 * Quantum's per-symbol-class probability models). The exact probability
 * models, model counts, and slot tables here are an original design and are
 * NOT guaranteed to be bit-compatible with real Quantum-compressed CAB data;
 * this implementation only guarantees that its own encoder and decoder agree
 * with each other on round trip.
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

  // ===== RANGE CODER CONSTANTS =====

  /** @type {uint32} */
  const TOP = 0xFFFFFFFF;
  /** @type {uint32} */
  const HALF = 0x80000000;
  /** @type {uint32} */
  const QUARTER = 0x40000000;
  /** @type {uint32} */
  const THREE_QUARTERS = 0xC0000000;

  // ===== CONTEXT-MODEL STATE MACHINE =====
  // Small "selector" state machine (7 states) used purely to pick which
  // adaptive model to use for the next literal/match decision, in the
  // spirit of Quantum's position/history-dependent context selection.
  /** @type {int32} */
  const STATE_COUNT = 7;
  /** @type {int32[]} */
  const LITERAL_NEXT_STATE = [0, 0, 0, 1, 2, 3, 4];
  /** @type {int32[]} */
  const MATCH_NEXT_STATE = [4, 5, 6, 6, 6, 6, 6];

  /** @type {int32} */
  const MIN_MATCH = 3;
  /** @type {int32} */
  const WINDOW_SIZE = 65536;
  /** @type {int32} */
  const MAX_CHAIN = 64;
  /** @type {int32} */
  const SLOT_SYMBOLS = 40; // supports magnitudes up to 39 bits - far beyond any realistic input

  // ===== ADAPTIVE FREQUENCY MODEL =====

  class AdaptiveModel {
    /**
     * @param {int32} symbolCount - Alphabet size
     * @param {int32} [increment=24] - Count added per symbol seen (0 means 24)
     * @param {int32} [maxTotal=16384] - Total above which counts are halved (0 means 16384)
     */
    constructor(symbolCount, increment = 24, maxTotal = 16384) {
      // A plain array: a corrupt stream can make the decoder address one slot
      // past the alphabet, which then simply grows the array as before.
      /** @type {float64[]} */
      this.freq = new Array(symbolCount);
      for (let i = 0; i < symbolCount; i++) {
        this.freq[i] = 1;
      }
      /** @type {float64} */
      this.total = symbolCount;
      /** @type {int32} */
      this.increment = increment === 0 ? 24 : increment;
      /** @type {int32} */
      this.maxTotal = maxTotal === 0 ? OpCodes.Shl32(1, 14) : maxTotal;
    }

    /**
     * @param {int32} symbol - Symbol
     * @returns {float64} Sum of the frequencies below it
     */
    cumulativeBelow(symbol) {
      /** @type {float64} */
      let sum = 0;
      for (let i = 0; i < symbol; ++i) {
        sum += this.freq[i];
      }
      return sum;
    }

    /**
     * @param {int32} symbol - Symbol seen
     */
    update(symbol) {
      this.freq[symbol] += this.increment;
      this.total += this.increment;
      if (this.total > this.maxTotal) {
        this._rescale();
      }
    }

    _rescale() {
      /** @type {float64} */
      let newTotal = 0;
      for (let i = 0; i < this.freq.length; ++i) {
        /** @type {float64} */
        let half = Math.floor(this.freq[i] / 2);
        if (!(half > 0)) {
          half = 1; // a zero (or a NaN from a corrupt stream) becomes 1
        }
        this.freq[i] = half;
        newTotal += half;
      }
      this.total = newTotal;
    }
  }

  // ===== BINARY ARITHMETIC (RANGE) CODER =====
  // Classic 32-bit register, bit-oriented arithmetic coder (Witten/Neal/Cleary
  // style renormalization with underflow "follow bit" handling), generalized
  // to accept an arbitrary adaptive frequency model per symbol, plus a
  // dedicated equal-probability bit path used for raw magnitude bits.
  // The registers hold 32-bit values; range times a frequency needs up to 46
  // bits and is formed in float64 (exact), as the plain arithmetic was.

  class RangeEncoder {
    constructor() {
      /** @type {float64} */
      this.low = 0;
      /** @type {float64} */
      this.high = TOP;
      /** @type {int32} */
      this.followBits = 0;
      /** @type {int32[]} */
      this.bits = [];
    }

    /**
     * @param {AdaptiveModel} model - Model of the symbol
     * @param {int32} symbol - Symbol to code
     */
    encodeSymbol(model, symbol) {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {float64} */
      const cumLow = model.cumulativeBelow(symbol);
      /** @type {float64} */
      const symFreq = model.freq[symbol];
      /** @type {float64} */
      const total = model.total;

      this.high = this.low + Math.floor(range * (cumLow + symFreq) / total) - 1;
      this.low = this.low + Math.floor(range * cumLow / total);

      this._renormalize();
      model.update(symbol);
    }

    /**
     * @param {int32} bit - Bit to code with probability 1/2
     */
    encodeEqualProbBit(bit) {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {float64} */
      const half = Math.floor(range / 2);

      if (bit !== 0) {
        this.low = this.low + half;
      } else {
        this.high = this.low + half - 1;
      }

      this._renormalize();
    }

    _renormalize() {
      for (;;) {
        if (this.high < HALF) {
          this._outputBit(0);
        } else if (this.low >= HALF) {
          this._outputBit(1);
          this.low -= HALF;
          this.high -= HALF;
        } else if (this.low >= QUARTER && this.high < THREE_QUARTERS) {
          this.followBits++;
          this.low -= QUARTER;
          this.high -= QUARTER;
        } else {
          break;
        }

        this.low = OpCodes.Shl32(OpCodes.ToUint32(this.low), 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(OpCodes.ToUint32(this.high), 1), 1);
      }
    }

    /**
     * @param {int32} bit - Bit, followed by the pending opposite bits
     */
    _outputBit(bit) {
      this.bits.push(bit);
      while (this.followBits > 0) {
        this.bits.push(1 - bit);
        this.followBits--;
      }
    }

    /**
     * @returns {int32[]} All coded bits
     */
    finish() {
      this.followBits++;
      if (this.low < QUARTER) {
        this._outputBit(0);
      } else {
        this._outputBit(1);
      }
      return this.bits;
    }
  }

  class RangeDecoder {
    /**
     * @param {int32[]} bits - Coded bits (zero past the end)
     */
    constructor(bits) {
      /** @type {int32[]} */
      this.bitsArr = bits;
      /** @type {int32} */
      this.pos = 0;
      /** @type {float64} */
      this.low = 0;
      /** @type {float64} */
      this.high = TOP;
      /** @type {float64} */
      this.value = 0;

      for (let i = 0; i < 32; ++i) {
        this.value = OpCodes.Or32(OpCodes.Shl32(OpCodes.ToUint32(this.value), 1), this._nextBit());
      }
    }

    /**
     * @returns {int32} Next bit, 0 past the end
     */
    _nextBit() {
      if (this.pos < this.bitsArr.length) {
        return this.bitsArr[this.pos++];
      }
      return 0;
    }

    /**
     * @param {AdaptiveModel} model - Model of the symbol
     * @returns {int32} Decoded symbol
     */
    decodeSymbol(model) {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {float64} */
      const total = model.total;
      /** @type {float64} */
      const scaled = Math.floor(((this.value - this.low + 1) * total - 1) / range);

      /** @type {float64} */
      let cum = 0;
      /** @type {int32} */
      let symbol = 0;
      for (; symbol < model.freq.length; ++symbol) {
        /** @type {float64} */
        const f = model.freq[symbol];
        if (cum + f > scaled) {
          break;
        }
        cum += f;
      }

      /** @type {float64} */
      const symFreq = model.freq[symbol];
      this.high = this.low + Math.floor(range * (cum + symFreq) / total) - 1;
      this.low = this.low + Math.floor(range * cum / total);

      this._renormalize();
      model.update(symbol);
      return symbol;
    }

    /**
     * @returns {int32} Bit coded with probability 1/2
     */
    decodeEqualProbBit() {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {float64} */
      const half = Math.floor(range / 2);
      /** @type {float64} */
      const mid = this.low + half - 1;

      /** @type {int32} */
      let bit = 0;
      if (this.value <= mid) {
        bit = 0;
        this.high = mid;
      } else {
        bit = 1;
        this.low = mid + 1;
      }

      this._renormalize();
      return bit;
    }

    _renormalize() {
      for (;;) {
        if (this.high < HALF) {
          // no state change, just shift in the next bit below
        } else if (this.low >= HALF) {
          this.low -= HALF;
          this.high -= HALF;
          this.value -= HALF;
        } else if (this.low >= QUARTER && this.high < THREE_QUARTERS) {
          this.low -= QUARTER;
          this.high -= QUARTER;
          this.value -= QUARTER;
        } else {
          break;
        }

        this.low = OpCodes.Shl32(OpCodes.ToUint32(this.low), 1);
        this.high = OpCodes.Or32(OpCodes.Shl32(OpCodes.ToUint32(this.high), 1), 1);
        this.value = OpCodes.Or32(OpCodes.Shl32(OpCodes.ToUint32(this.value), 1), this._nextBit());
      }
    }
  }

  // ===== VARIABLE-MAGNITUDE INTEGER CODING =====
  // Encodes a positive integer n>=1 as a "slot" (its bit length, entropy
  // coded through an adaptive model - a position-dependent context in the
  // sense that its statistics reflect the current distribution of match
  // lengths/distances) followed by (slot-1) raw, equal-probability bits
  // carrying the remainder below the slot's implicit leading bit.

  /**
   * @param {int32} n - Non-negative value
   * @returns {int32} Number of significant bits
   */
  function bitLength(n) {
    /** @type {int32} */
    let len = 0;
    /** @type {int32} */
    let v = n;
    while (v > 0) {
      v = Math.floor(v / 2);
      len++;
    }
    return len;
  }

  /**
   * @param {RangeEncoder} encoder - Output coder
   * @param {AdaptiveModel} model - Slot model
   * @param {int32} n - Value, at least 1
   */
  function encodeVarInt(encoder, model, n) {
    /** @type {int32} */
    const slot = bitLength(n);
    encoder.encodeSymbol(model, slot);

    /** @type {int32} */
    const extraBits = slot - 1;
    if (extraBits > 0) {
      /** @type {int32} */
      const base = OpCodes.Shl32(1, extraBits);
      /** @type {int32} */
      const remainder = n - base;
      for (let i = extraBits - 1; i >= 0; --i) {
        encoder.encodeEqualProbBit(OpCodes.GetBit(remainder, i) ? 1 : 0);
      }
    }
  }

  /**
   * @param {RangeDecoder} decoder - Input coder
   * @param {AdaptiveModel} model - Slot model
   * @returns {uint32} Decoded value
   */
  function decodeVarInt(decoder, model) {
    /** @type {int32} */
    const slot = decoder.decodeSymbol(model);
    /** @type {int32} */
    const extraBits = slot - 1;
    /** @type {uint32} */
    let value = OpCodes.Shl32(1, extraBits);

    for (let i = extraBits - 1; i >= 0; --i) {
      /** @type {int32} */
      const bit = decoder.decodeEqualProbBit();
      if (bit !== 0) {
        value = OpCodes.Or32(value, OpCodes.Shl32(1, i));
      }
    }

    return value;
  }

  /**
   * Latest position per exact 24-bit three-byte key (an open-addressing
   * table; it only answers lookups, so its layout cannot influence matches)
   */
  class QuantumHeadTable {
    constructor() {
      /** @type {int32[]} */
      this.keys = new Int32Array(1024).fill(-1);
      /** @type {int32[]} */
      this.positions = new Int32Array(1024);
      /** @type {int32} */
      this.mask = 1023;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {int32} key - 24-bit key
     * @returns {int32} Slot holding the key, or the empty slot where it belongs
     */
    _slot(key) {
      /** @type {int32} */
      let slot = OpCodes.And32(OpCodes.Shr32(OpCodes.Mul32(key, 0x9E3779B1), 8), this.mask);
      while (this.keys[slot] !== -1 && this.keys[slot] !== key) {
        slot = OpCodes.And32(slot + 1, this.mask);
      }
      return slot;
    }

    /**
     * @param {int32} key - 24-bit key
     * @returns {int32} Latest position with this key, or -1
     */
    get(key) {
      /** @type {int32} */
      const slot = this._slot(key);
      if (this.keys[slot] === -1) {
        return -1;
      }
      return this.positions[slot];
    }

    /**
     * @param {int32} key - 24-bit key
     * @param {int32} position - Latest position with this key
     */
    set(key, position) {
      /** @type {int32} */
      const slot = this._slot(key);
      if (this.keys[slot] === -1) {
        this.keys[slot] = key;
        ++this.count;
      }
      this.positions[slot] = position;
      if (this.count * 2 > this.mask) {
        this._grow();
      }
    }

    /** Double the table and re-insert every key */
    _grow() {
      /** @type {int32[]} */
      const oldKeys = this.keys;
      /** @type {int32[]} */
      const oldPositions = this.positions;
      /** @type {int32} */
      const size = (this.mask + 1) * 2;
      this.keys = new Int32Array(size).fill(-1);
      this.positions = new Int32Array(size);
      this.mask = size - 1;
      for (let i = 0; i < oldKeys.length; i++) {
        if (oldKeys[i] !== -1) {
          /** @type {int32} */
          const slot = this._slot(oldKeys[i]);
          this.keys[slot] = oldKeys[i];
          this.positions[slot] = oldPositions[i];
        }
      }
    }
  }

  /**
   * One parsed token: a literal byte or a (length, distance) match
   */
  class QuantumToken {
    /**
     * @param {boolean} isMatch - True for a match
     * @param {uint8} value - Literal byte (0 for a match)
     * @param {int32} length - Match length (0 for a literal)
     * @param {int32} distance - Match distance (0 for a literal)
     */
    constructor(isMatch, value, length, distance) {
      /** @type {boolean} */
      this.isMatch = isMatch;
      /** @type {uint8} */
      this.value = value;
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distance = distance;
    }
  }

  /**
   * The adaptive models of one stream
   */
  class QuantumModels {
    constructor() {
      /** @type {int32} */
      const maxTotal = OpCodes.Shl32(1, 14);
      /** @type {AdaptiveModel[]} */
      this.literalModels = [];
      /** @type {AdaptiveModel[]} */
      this.matchFlagModels = [];
      for (let s = 0; s < STATE_COUNT; ++s) {
        this.literalModels.push(new AdaptiveModel(256, 24, maxTotal));
        this.matchFlagModels.push(new AdaptiveModel(2, 24, maxTotal));
      }
      /** @type {AdaptiveModel} */
      this.lengthSlotModel = new AdaptiveModel(SLOT_SYMBOLS, 24, maxTotal);
      /** @type {AdaptiveModel} */
      this.distanceSlotModel = new AdaptiveModel(SLOT_SYMBOLS, 24, maxTotal);
    }
  }

  /**
   * Reproducible pseudo-random bytes for a test vector. The LCG product is
   * formed in float64 exactly as it always was (it can exceed 2^53, so its
   * low bits are those of the rounded double), then masked to 31 bits.
   * @param {int32} count - Number of bytes
   * @returns {uint8[]} Bytes
   */
  function pseudoRandomTestBytes(count) {
    /** @type {int32} */
    let seed = 0x2A6B9E17;
    /** @type {uint8[]} */
    const out = [];
    for (let i = 0; i < count; ++i) {
      /** @type {float64} */
      const product = seed * 1103515245 + 12345;
      seed = OpCodes.And32(OpCodes.ToUint32(product), 0x7fffffff);
      out.push(seed % 256);
    }
    return out;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class QuantumAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Quantum";
      this.description = "LZ77 dictionary matching combined with an adaptive arithmetic coder; the compression method Microsoft licensed from David Stafford's Quantum archiver for use inside Cabinet (.CAB) files alongside DEFLATE and LZX.";
      this.inventor = "David Stafford (licensed by Microsoft Corporation)";
      this.year = 1995;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Quantum compression format - Matthew Russotto", "http://www.russotto.net/quantumcomp.html"),
        new LinkItem("libmspack documentation (CAB/Quantum/LZX formats) - Stuart Caie", "https://www.cabextract.org.uk/libmspack/doc/")
      ];

      this.references = [
        new LinkItem("libmspack source repository", "https://github.com/kyz/libmspack"),
        new LinkItem("Cabinet (file format) - Wikipedia", "https://en.wikipedia.org/wiki/Cabinet_(file_format)"),
        new LinkItem("LZX - Wikipedia", "https://en.wikipedia.org/wiki/LZX")
      ];

      // Deterministic pseudo-random generator for a reproducible binary test vector
      /** @type {uint8[]} */
      const randomBytes = pseudoRandomTestBytes(200);

      /** @type {uint8[]} */
      const repetitiveRun = [];
      for (let i = 0; i < 300; ++i) {
        repetitiveRun.push(0x41);
      }

      /** @type {uint8[]} */
      const alternating = [];
      for (let i = 0; i < 256; ++i) {
        alternating.push(i % 2 === 0 ? 0x00 : 0xFF);
      }

      // Test vectors - round-trip compression tests only (no specific compressed outputs)
      this.tests = [
        new TestCase(
          [],
          [],
          "Quantum round-trip - empty input",
          "http://www.russotto.net/quantumcomp.html"
        ),
        new TestCase(
          [0x51],
          [],
          "Quantum round-trip - single byte",
          "http://www.russotto.net/quantumcomp.html"
        ),
        new TestCase(
          repetitiveRun,
          [],
          "Quantum round-trip - long repetitive run (300 bytes of 0x41)",
          "http://www.russotto.net/quantumcomp.html"
        ),
        new TestCase(
          alternating,
          [],
          "Quantum round-trip - alternating byte pattern (0x00/0xFF)",
          "http://www.russotto.net/quantumcomp.html"
        ),
        new TestCase(
          randomBytes,
          [],
          "Quantum round-trip - pseudo-random binary sample",
          "http://www.russotto.net/quantumcomp.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Microsoft Cabinet Quantum compression - LZ77 matches entropy coded with an adaptive arithmetic coder, licensed from David Stafford for CAB files circa 1995."),
          [],
          "Quantum round-trip - spec-flavoured text vector",
          "https://www.cabextract.org.uk/libmspack/doc/"
        )
      ];
    }

    /**
     * Create new algorithm instance
     * @param {boolean} [isInverse=false] - True for decompression, false for compression
     * @returns {Object} New algorithm instance
     */

    CreateInstance(isInverse = false) {
      return new QuantumInstance(this, isInverse);
    }
  }

  /**
   * Quantum algorithm instance implementing Feed/Result pattern
   * @class
   * @extends {IAlgorithmInstance}
   */

  class QuantumInstance extends IAlgorithmInstance {
    /**
     * Initialize algorithm instance
     * @param {QuantumAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decompression mode flag
     */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }


    /**
     * Get algorithm result (compressed or decompressed data)
     * @returns {uint8[]} Processed output bytes
     */

    Result() {
      if (this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

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

    // ===== HEADER / BIT-PACKING HELPERS =====

    /**
     * @param {uint8[]} output - Output
     * @param {uint32} value - Value appended big-endian
     */
    _writeUint32(output, value) {
      output.push(OpCodes.And32(OpCodes.Shr32(value, 24), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF));
      output.push(OpCodes.And32(value, 0xFF));
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} offset - Position of the value
     * @returns {uint32} Big-endian 32-bit value
     */
    _readUint32(data, offset) {
      return OpCodes.Or32(
        OpCodes.Or32(OpCodes.Shl32(data[offset], 24), OpCodes.Shl32(data[offset + 1], 16)),
        OpCodes.Or32(OpCodes.Shl32(data[offset + 2], 8), data[offset + 3])
      );
    }

    /**
     * @param {int32[]} bits - Bits, most significant first
     * @returns {uint8[]} Packed bytes, last one zero-padded
     */
    _packBits(bits) {
      /** @type {uint8[]} */
      const bytes = [];
      for (let i = 0; i < bits.length; i += 8) {
        /** @type {uint32} */
        let byte = 0;
        for (let j = 0; j < 8; ++j) {
          /** @type {int32} */
          const bit = (i + j < bits.length) ? bits[i + j] : 0;
          byte = OpCodes.Or32(OpCodes.Shl32(byte, 1), bit);
        }
        bytes.push(OpCodes.And32(byte, 0xFF));
      }
      return bytes;
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} offset - First byte
     * @returns {int32[]} Bits, most significant first
     */
    _unpackBits(data, offset) {
      /** @type {int32[]} */
      const bits = [];
      for (let i = offset; i < data.length; ++i) {
        for (let j = 7; j >= 0; --j) {
          bits.push(OpCodes.GetBit(data[i], j) ? 1 : 0);
        }
      }
      return bits;
    }

    // ===== CONTEXT MODELS =====

    /**
     * @returns {QuantumModels} Fresh models
     */
    _createModels() {
      return new QuantumModels();
    }

    // ===== LZ77 MATCHER =====

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the three hashed bytes
     * @returns {uint32} Exact 24-bit key
     */
    _hash3(data, pos) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(data[pos], 16), OpCodes.Shl32(data[pos + 1], 8)), data[pos + 2]);
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} aPos - Earlier position
     * @param {int32} bPos - Current position
     * @param {int32} limit - End of the data
     * @returns {int32} Common prefix length
     */
    _matchLength(data, aPos, bPos, limit) {
      /** @type {int32} */
      let len = 0;
      /** @type {int32} */
      const max = limit - bPos;
      while (len < max && data[aPos + len] === data[bPos + len]) {
        ++len;
      }
      return len;
    }

    /**
     * Greedy parse; each hashed position's earlier positions are searched
     * newest first, as the per-key position lists always were.
     * @param {uint8[]} data - Input bytes
     * @returns {QuantumToken[]} Tokens
     */
    _lz77Parse(data) {
      /** @type {int32} */
      const n = data.length;
      /** @type {QuantumToken[]} */
      const tokens = [];
      /** @type {QuantumHeadTable} */
      const head = new QuantumHeadTable();
      /** @type {int32[]} */
      const prev = new Int32Array(n);
      /** @type {int32} */
      let pos = 0;

      while (pos < n) {
        /** @type {int32} */
        let bestLen = 0;
        /** @type {int32} */
        let bestDist = 0;

        if (pos + MIN_MATCH <= n) {
          /** @type {uint32} */
          const hash = this._hash3(data, pos);
          /** @type {int32} */
          let matchPos = head.get(hash);
          /** @type {int32} */
          let tries = 0;
          while (matchPos >= 0 && tries < MAX_CHAIN) {
            if (pos - matchPos > WINDOW_SIZE) {
              break;
            }

            /** @type {int32} */
            const len = this._matchLength(data, matchPos, pos, n);
            if (len > bestLen) {
              bestLen = len;
              bestDist = pos - matchPos;
            }
            matchPos = prev[matchPos];
            ++tries;
          }

          /** @type {int32} */
          const previous = head.get(hash);
          prev[pos] = previous;
          head.set(hash, pos);
        }

        if (bestLen >= MIN_MATCH) {
          tokens.push(new QuantumToken(true, 0, bestLen, bestDist));
          pos += bestLen;
        } else {
          tokens.push(new QuantumToken(false, data[pos], 0, 0));
          ++pos;
        }
      }

      return tokens;
    }

    // ===== COMPRESSION =====

    /**
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Size header and range-coded bits
     */
    _compress(data) {
      /** @type {uint8[]} */
      const output = [];
      if (!data || data.length === 0) {
        return output;
      }

      this._writeUint32(output, data.length);

      /** @type {QuantumToken[]} */
      const tokens = this._lz77Parse(data);
      /** @type {QuantumModels} */
      const models = this._createModels();
      /** @type {RangeEncoder} */
      const encoder = new RangeEncoder();

      /** @type {int32} */
      let state = 0;
      for (let t = 0; t < tokens.length; t++) {
        /** @type {QuantumToken} */
        const token = tokens[t];
        if (!token.isMatch) {
          encoder.encodeSymbol(models.matchFlagModels[state], 0);
          encoder.encodeSymbol(models.literalModels[state], token.value);
          state = LITERAL_NEXT_STATE[state];
        } else {
          encoder.encodeSymbol(models.matchFlagModels[state], 1);
          encodeVarInt(encoder, models.lengthSlotModel, token.length - MIN_MATCH + 1);
          encodeVarInt(encoder, models.distanceSlotModel, token.distance);
          state = MATCH_NEXT_STATE[state];
        }
      }

      /** @type {int32[]} */
      const bits = encoder.finish();
      /** @type {uint8[]} */
      const packed = this._packBits(bits);
      for (let i = 0; i < packed.length; ++i) {
        output.push(packed[i]);
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    /**
     * @param {uint8[]} data - Size header and range-coded bits
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(data) {
      /** @type {uint8[]} */
      const output = [];
      if (!data || data.length < 4) {
        return output;
      }

      /** @type {uint32} */
      const length = this._readUint32(data, 0);
      if (length === 0) {
        return output;
      }

      /** @type {int32[]} */
      const bits = this._unpackBits(data, 4);
      /** @type {RangeDecoder} */
      const decoder = new RangeDecoder(bits);
      /** @type {QuantumModels} */
      const models = this._createModels();

      /** @type {int32} */
      let state = 0;

      while (output.length < length) {
        /** @type {int32} */
        const flag = decoder.decodeSymbol(models.matchFlagModels[state]);

        if (flag === 0) {
          /** @type {int32} */
          const byte = decoder.decodeSymbol(models.literalModels[state]);
          output.push(byte);
          state = LITERAL_NEXT_STATE[state];
        } else {
          /** @type {uint32} */
          const lengthValue = decodeVarInt(decoder, models.lengthSlotModel);
          /** @type {uint32} */
          const distance = decodeVarInt(decoder, models.distanceSlotModel);
          /** @type {float64} */
          const wideLength = lengthValue;
          /** @type {float64} */
          const matchLength = wideLength + MIN_MATCH - 1;
          /** @type {float64} */
          const start = output.length - distance;

          for (let i = 0; i < matchLength; ++i) {
            output.push(output[start + i]);
          }
          state = MATCH_NEXT_STATE[state];
        }
      }

      return output;
    }
  }


  // ===== REGISTRATION =====

  const algorithmInstance = new QuantumAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { QuantumAlgorithm, QuantumInstance };
}));
