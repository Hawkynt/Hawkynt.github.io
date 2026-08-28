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

  const TOP = 0xFFFFFFFF;
  const HALF = 0x80000000;
  const QUARTER = 0x40000000;
  const THREE_QUARTERS = 0xC0000000;

  // ===== CONTEXT-MODEL STATE MACHINE =====
  // Small "selector" state machine (7 states) used purely to pick which
  // adaptive model to use for the next literal/match decision, in the
  // spirit of Quantum's position/history-dependent context selection.
  const STATE_COUNT = 7;
  const LITERAL_NEXT_STATE = [0, 0, 0, 1, 2, 3, 4];
  const MATCH_NEXT_STATE = [4, 5, 6, 6, 6, 6, 6];

  const MIN_MATCH = 3;
  const WINDOW_SIZE = 65536;
  const MAX_CHAIN = 64;
  const SLOT_SYMBOLS = 40; // supports magnitudes up to 39 bits - far beyond any realistic input

  // ===== ADAPTIVE FREQUENCY MODEL =====

  class AdaptiveModel {
    constructor(symbolCount, increment, maxTotal) {
      this.freq = new Array(symbolCount).fill(1);
      this.total = symbolCount;
      this.increment = increment || 24;
      this.maxTotal = maxTotal || OpCodes.Shl32(1, 14);
    }

    cumulativeBelow(symbol) {
      let sum = 0;
      for (let i = 0; i < symbol; ++i) sum += this.freq[i];
      return sum;
    }

    update(symbol) {
      this.freq[symbol] += this.increment;
      this.total += this.increment;
      if (this.total > this.maxTotal) this._rescale();
    }

    _rescale() {
      let newTotal = 0;
      for (let i = 0; i < this.freq.length; ++i) {
        this.freq[i] = Math.floor(this.freq[i] / 2) || 1;
        newTotal += this.freq[i];
      }
      this.total = newTotal;
    }
  }

  // ===== BINARY ARITHMETIC (RANGE) CODER =====
  // Classic 32-bit register, bit-oriented arithmetic coder (Witten/Neal/Cleary
  // style renormalization with underflow "follow bit" handling), generalized
  // to accept an arbitrary adaptive frequency model per symbol, plus a
  // dedicated equal-probability bit path used for raw magnitude bits.

  class RangeEncoder {
    constructor() {
      this.low = 0;
      this.high = TOP;
      this.followBits = 0;
      this.bits = [];
    }

    encodeSymbol(model, symbol) {
      const range = this.high - this.low + 1;
      const cumLow = model.cumulativeBelow(symbol);
      const symFreq = model.freq[symbol];
      const total = model.total;

      this.high = this.low + Math.floor(range * (cumLow + symFreq) / total) - 1;
      this.low = this.low + Math.floor(range * cumLow / total);

      this._renormalize();
      model.update(symbol);
    }

    encodeEqualProbBit(bit) {
      const range = this.high - this.low + 1;
      const half = Math.floor(range / 2);

      if (bit) {
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

        this.low = OpCodes.ToUint32(OpCodes.Shl32(this.low, 1));
        this.high = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.high, 1), 1));
      }
    }

    _outputBit(bit) {
      this.bits.push(bit);
      while (this.followBits > 0) {
        this.bits.push(1 - bit);
        this.followBits--;
      }
    }

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
    constructor(bits) {
      this.bitsArr = bits;
      this.pos = 0;
      this.low = 0;
      this.high = TOP;
      this.value = 0;

      for (let i = 0; i < 32; ++i) {
        this.value = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.value, 1), this._nextBit()));
      }
    }

    _nextBit() {
      if (this.pos < this.bitsArr.length) return this.bitsArr[this.pos++];
      return 0;
    }

    decodeSymbol(model) {
      const range = this.high - this.low + 1;
      const total = model.total;
      const scaled = Math.floor(((this.value - this.low + 1) * total - 1) / range);

      let cum = 0;
      let symbol = 0;
      for (; symbol < model.freq.length; ++symbol) {
        const f = model.freq[symbol];
        if (cum + f > scaled) break;
        cum += f;
      }

      const symFreq = model.freq[symbol];
      this.high = this.low + Math.floor(range * (cum + symFreq) / total) - 1;
      this.low = this.low + Math.floor(range * cum / total);

      this._renormalize();
      model.update(symbol);
      return symbol;
    }

    decodeEqualProbBit() {
      const range = this.high - this.low + 1;
      const half = Math.floor(range / 2);
      const mid = this.low + half - 1;

      let bit;
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

        this.low = OpCodes.ToUint32(OpCodes.Shl32(this.low, 1));
        this.high = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.high, 1), 1));
        this.value = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.value, 1), this._nextBit()));
      }
    }
  }

  // ===== VARIABLE-MAGNITUDE INTEGER CODING =====
  // Encodes a positive integer n>=1 as a "slot" (its bit length, entropy
  // coded through an adaptive model - a position-dependent context in the
  // sense that its statistics reflect the current distribution of match
  // lengths/distances) followed by (slot-1) raw, equal-probability bits
  // carrying the remainder below the slot's implicit leading bit.

  function bitLength(n) {
    let len = 0;
    let v = n;
    while (v > 0) {
      v = Math.floor(v / 2);
      len++;
    }
    return len;
  }

  function encodeVarInt(encoder, model, n) {
    const slot = bitLength(n);
    encoder.encodeSymbol(model, slot);

    const extraBits = slot - 1;
    if (extraBits > 0) {
      const base = OpCodes.Shl32(1, extraBits);
      const remainder = n - base;
      for (let i = extraBits - 1; i >= 0; --i) {
        encoder.encodeEqualProbBit(OpCodes.GetBit(remainder, i) ? 1 : 0);
      }
    }
  }

  function decodeVarInt(decoder, model) {
    const slot = decoder.decodeSymbol(model);
    const extraBits = slot - 1;
    let value = OpCodes.Shl32(1, extraBits);

    for (let i = extraBits - 1; i >= 0; --i) {
      const bit = decoder.decodeEqualProbBit();
      if (bit) value = OpCodes.Or32(value, OpCodes.Shl32(1, i));
    }

    return value;
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
      let seed = 0x2A6B9E17;
      const rnd = () => {
        seed = OpCodes.AndN(seed * 1103515245 + 12345, 0x7fffffff);
        return seed % 256;
      };
      const randomBytes = [];
      for (let i = 0; i < 200; ++i) randomBytes.push(rnd());

      const repetitiveRun = new Array(300).fill(0x41);

      const alternating = [];
      for (let i = 0; i < 256; ++i) alternating.push(i % 2 === 0 ? 0x00 : 0xFF);

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
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decompression mode flag
     */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    /**
     * Get algorithm result (compressed or decompressed data)
     * @returns {uint8[]} Processed output bytes
     */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== HEADER / BIT-PACKING HELPERS =====

    _writeUint32(output, value) {
      output.push(OpCodes.And32(OpCodes.Shr32(value, 24), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF));
      output.push(OpCodes.And32(value, 0xFF));
    }

    _readUint32(data, offset) {
      return OpCodes.ToUint32(OpCodes.Or32(
        OpCodes.Or32(OpCodes.Shl32(data[offset], 24), OpCodes.Shl32(data[offset + 1], 16)),
        OpCodes.Or32(OpCodes.Shl32(data[offset + 2], 8), data[offset + 3])
      ));
    }

    _packBits(bits) {
      const bytes = [];
      for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; ++j) {
          const bit = (i + j < bits.length) ? bits[i + j] : 0;
          byte = OpCodes.Or32(OpCodes.Shl32(byte, 1), bit);
        }
        bytes.push(OpCodes.And32(byte, 0xFF));
      }
      return bytes;
    }

    _unpackBits(data, offset) {
      const bits = [];
      for (let i = offset; i < data.length; ++i) {
        for (let j = 7; j >= 0; --j) {
          bits.push(OpCodes.GetBit(data[i], j) ? 1 : 0);
        }
      }
      return bits;
    }

    // ===== CONTEXT MODELS =====

    _createModels() {
      const literalModels = [];
      const matchFlagModels = [];
      const maxTotal = OpCodes.Shl32(1, 14);
      for (let s = 0; s < STATE_COUNT; ++s) {
        literalModels.push(new AdaptiveModel(256, 24, maxTotal));
        matchFlagModels.push(new AdaptiveModel(2, 24, maxTotal));
      }
      return {
        literalModels,
        matchFlagModels,
        lengthSlotModel: new AdaptiveModel(SLOT_SYMBOLS, 24, maxTotal),
        distanceSlotModel: new AdaptiveModel(SLOT_SYMBOLS, 24, maxTotal)
      };
    }

    // ===== LZ77 MATCHER =====

    _hash3(data, pos) {
      const h = OpCodes.XorN(OpCodes.XorN(OpCodes.Shl32(data[pos], 16), OpCodes.Shl32(data[pos + 1], 8)), data[pos + 2]);
      return OpCodes.ToUint32(h);
    }

    _matchLength(data, aPos, bPos, limit) {
      let len = 0;
      const max = limit - bPos;
      while (len < max && data[aPos + len] === data[bPos + len]) ++len;
      return len;
    }

    _lz77Parse(data) {
      const n = data.length;
      const tokens = [];
      const hashTable = new Map();
      let pos = 0;

      while (pos < n) {
        let bestLen = 0;
        let bestDist = 0;

        if (pos + MIN_MATCH <= n) {
          const hash = this._hash3(data, pos);
          const chain = hashTable.get(hash);

          if (chain) {
            let tries = 0;
            for (let i = chain.length - 1; i >= 0 && tries < MAX_CHAIN; --i, ++tries) {
              const matchPos = chain[i];
              if (pos - matchPos > WINDOW_SIZE) break;

              const len = this._matchLength(data, matchPos, pos, n);
              if (len > bestLen) {
                bestLen = len;
                bestDist = pos - matchPos;
              }
            }
          }

          if (!hashTable.has(hash)) hashTable.set(hash, []);
          hashTable.get(hash).push(pos);
        }

        if (bestLen >= MIN_MATCH) {
          tokens.push({ type: 'match', length: bestLen, distance: bestDist });
          pos += bestLen;
        } else {
          tokens.push({ type: 'literal', value: data[pos] });
          ++pos;
        }
      }

      return tokens;
    }

    // ===== COMPRESSION =====

    _compress(data) {
      if (!data || data.length === 0) return [];

      const output = [];
      this._writeUint32(output, data.length);

      const tokens = this._lz77Parse(data);
      const models = this._createModels();
      const encoder = new RangeEncoder();

      let state = 0;
      for (const token of tokens) {
        if (token.type === 'literal') {
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

      const bits = encoder.finish();
      const packed = this._packBits(bits);
      for (let i = 0; i < packed.length; ++i) output.push(packed[i]);

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      if (!data || data.length < 4) return [];

      const length = this._readUint32(data, 0);
      if (length === 0) return [];

      const bits = this._unpackBits(data, 4);
      const decoder = new RangeDecoder(bits);
      const models = this._createModels();

      const output = [];
      let state = 0;

      while (output.length < length) {
        const flag = decoder.decodeSymbol(models.matchFlagModels[state]);

        if (flag === 0) {
          const byte = decoder.decodeSymbol(models.literalModels[state]);
          output.push(byte);
          state = LITERAL_NEXT_STATE[state];
        } else {
          const lengthValue = decodeVarInt(decoder, models.lengthSlotModel);
          const distance = decodeVarInt(decoder, models.distanceSlotModel);
          const matchLength = lengthValue + MIN_MATCH - 1;
          const start = output.length - distance;

          for (let i = 0; i < matchLength; ++i) output.push(output[start + i]);
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
