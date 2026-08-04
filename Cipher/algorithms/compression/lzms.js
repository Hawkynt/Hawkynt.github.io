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
 * LZMS. Everything publicly known about its bitstream comes from clean-room reverse
 * engineering, most notably Eric Biggers' `wimlib` project (https://wimlib.net/ and
 * https://github.com/ebiggers/wimlib), whose documentation describes LZMS as LZ77
 * matching combined with an adaptive binary range coder conceptually similar to
 * LZMA's: separate adaptively-updated probability contexts drive the "literal vs.
 * match" decision, literal byte coding, match-length coding, and match-offset /
 * repeat-offset-slot coding, with an optional x86 call/jmp address post-filter
 * applied ahead of the main stage (the x86 filter is out of scope here; this file
 * only implements the LZ77 + range-coding core).
 *
 * This implementation follows that general, publicly-documented LZMS design
 * (LZ77 + adaptive binary range coding with literal/length/offset contexts and a
 * repeat-offset cache) but its exact bitstream layout is a clean-room design of
 * this file's own making: it has NOT been checked against, and is not intended to
 * be bit-compatible with, Microsoft's actual encoder or wimlib's decoder. Encoder
 * and decoder below only need to agree with each other.
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

  const TOP_VALUE = 16777216;      // 2^24 renormalization threshold
  const PROB_BITS = 11;            // probability resolution
  const PROB_MAX = 2048;           // 2^PROB_BITS
  const PROB_INIT = 1024;          // PROB_MAX / 2 - initial "50/50" probability
  const MOVE_DIVISOR = 32;         // adaptation rate divisor (2^5, LZMA-style)

  // ===== LZ77 / MODEL CONSTANTS =====

  const MIN_MATCH = 2;             // minimum encodable match length
  const MAX_MATCH = 273;           // maximum encodable match length (MIN_MATCH + 271)
  const MIN_NORMAL_MATCH = 3;      // minimum length to bother emitting a fresh-offset match
  const MIN_REP_MATCH = 2;         // minimum length to bother reusing a recent offset
  const NUM_REPS = 3;              // size of the repeat-offset cache
  const NUM_LEN_STATES = 4;        // number of length-dependent offset-slot contexts
  const OFFSET_SLOT_BITS = 5;      // offset "exponent" slot tree depth (covers offsets < 2^31)
  const LITERAL_CONTEXTS = 8;      // number of literal probability contexts (top 3 bits of prev byte)
  const WINDOW_SIZE = 65536;       // maximum look-back distance considered by the match finder

  // ===== VARINT HELPERS (plain bytes, outside the range-coded stream) =====

  function writeVarint(bytes, value) {
    let v = value;
    while (v >= 128) {
      bytes.push((v % 128) + 128);
      v = Math.floor(v / 128);
    }
    bytes.push(v);
  }

  function readVarint(bytes, posState) {
    let value = 0;
    let shift = 1;
    let b;
    do {
      b = posState.pos < bytes.length ? bytes[posState.pos] : 0;
      posState.pos++;
      value += (b % 128) * shift;
      shift *= 128;
    } while (b >= 128);
    return value;
  }

  // ===== ADAPTIVE BINARY RANGE CODER =====
  //
  // Standard LZMA-style carry-propagating range coder. Implemented with plain
  // arithmetic (+, -, *, /, Math.floor) instead of bit-shift/mask operators so the
  // 33-bit-wide intermediate "low" register (which can briefly carry beyond 32
  // bits while additions settle) is never accidentally truncated by JavaScript's
  // 32-bit bitwise operator semantics.

  class RangeEncoder {
    constructor() {
      this.low = 0;
      this.range = 0xFFFFFFFF;
      this.cacheSize = 1;
      this.cache = 0;
      this.bytes = [];
    }

    _shiftLow() {
      if (this.low < 0xFF000000 || this.low > 0xFFFFFFFF) {
        const carry = this.low > 0xFFFFFFFF ? 1 : 0;
        let temp = this.cache;
        do {
          this.bytes.push((temp + carry) % 256);
          temp = 255;
          this.cacheSize--;
        } while (this.cacheSize !== 0);
        this.cache = Math.floor(this.low / 0x1000000) % 256;
      }
      this.cacheSize++;
      this.low = (this.low % 0x1000000) * 256;
    }

    encodeBit(probs, index, bit) {
      const prob = probs[index];
      const bound = Math.floor(this.range / PROB_MAX) * prob;
      if (bit === 0) {
        this.range = bound;
        probs[index] = prob + Math.floor((PROB_MAX - prob) / MOVE_DIVISOR);
      } else {
        this.low += bound;
        this.range -= bound;
        probs[index] = prob - Math.floor(prob / MOVE_DIVISOR);
      }
      while (this.range < TOP_VALUE) {
        this.range *= 256;
        this._shiftLow();
      }
    }

    encodeDirectBit(bit) {
      this.range = Math.floor(this.range / 2);
      if (bit) this.low += this.range;
      while (this.range < TOP_VALUE) {
        this.range *= 256;
        this._shiftLow();
      }
    }

    encodeDirectBits(value, numBits) {
      for (let i = numBits - 1; i >= 0; i--) {
        const bit = Math.floor(value / Math.pow(2, i)) % 2;
        this.encodeDirectBit(bit);
      }
    }

    flush() {
      for (let i = 0; i < 5; i++) this._shiftLow();
      return this.bytes;
    }
  }

  class RangeDecoder {
    constructor(bytes, startPos) {
      this.bytes = bytes;
      this.pos = startPos;
      this.code = 0;
      this.range = 0xFFFFFFFF;
      this.pos++; // skip the always-zero lead byte produced by the encoder's initial cache
      for (let i = 0; i < 4; i++) this.code = this.code * 256 + this._readByte();
    }

    _readByte() {
      return this.pos < this.bytes.length ? this.bytes[this.pos++] : 0;
    }

    decodeBit(probs, index) {
      const prob = probs[index];
      const bound = Math.floor(this.range / PROB_MAX) * prob;
      let bit;
      if (this.code < bound) {
        this.range = bound;
        probs[index] = prob + Math.floor((PROB_MAX - prob) / MOVE_DIVISOR);
        bit = 0;
      } else {
        this.code -= bound;
        this.range -= bound;
        probs[index] = prob - Math.floor(prob / MOVE_DIVISOR);
        bit = 1;
      }
      while (this.range < TOP_VALUE) {
        this.range *= 256;
        this.code = this.code * 256 + this._readByte();
      }
      return bit;
    }

    decodeDirectBit() {
      this.range = Math.floor(this.range / 2);
      let bit = 0;
      if (this.code >= this.range) {
        this.code -= this.range;
        bit = 1;
      }
      while (this.range < TOP_VALUE) {
        this.range *= 256;
        this.code = this.code * 256 + this._readByte();
      }
      return bit;
    }

    decodeDirectBits(numBits) {
      let value = 0;
      for (let i = 0; i < numBits; i++) value = value * 2 + this.decodeDirectBit();
      return value;
    }
  }

  // ===== BIT-TREE HELPERS (MSB-first, adaptive) =====

  function encodeBitTree(rc, probs, numBits, value) {
    let m = 1;
    for (let i = numBits - 1; i >= 0; i--) {
      const bit = Math.floor(value / Math.pow(2, i)) % 2;
      rc.encodeBit(probs, m, bit);
      m = m * 2 + bit;
    }
  }

  function decodeBitTree(rc, probs, numBits) {
    let m = 1;
    for (let i = 0; i < numBits; i++) {
      const bit = rc.decodeBit(probs, m);
      m = m * 2 + bit;
    }
    return m - Math.pow(2, numBits);
  }

  function newProbArray(size) {
    return new Array(size).fill(PROB_INIT);
  }

  // ===== LZMS PROBABILITY MODEL =====
  //
  // Adaptive contexts, grouped the way the publicly-documented LZMS design describes:
  // an is-literal/is-match decision, an is-repeat-offset decision (plus which of the
  // cached repeat offsets), literal-byte contexts keyed by the previous byte's high
  // bits, a length model, and length-dependent offset-slot contexts.

  class LZMSModel {
    constructor() {
      this.isMatch = newProbArray(2);      // indexed by state (0 = after literal, 1 = after match)
      this.isRep = newProbArray(1);        // is this match a reused (repeat) offset?
      this.repG0 = newProbArray(1);        // repeat-offset selector: slot 0 vs. {1,2}
      this.repG1 = newProbArray(1);        // repeat-offset selector: slot 1 vs. 2

      this.literal = [];
      for (let i = 0; i < LITERAL_CONTEXTS; i++) this.literal.push(newProbArray(256));

      this.lengthChoice = newProbArray(1);
      this.lengthChoice2 = newProbArray(1);
      this.lengthLow = newProbArray(8);
      this.lengthMid = newProbArray(8);
      this.lengthHigh = newProbArray(256);

      this.offsetSlot = [];
      for (let i = 0; i < NUM_LEN_STATES; i++) this.offsetSlot.push(newProbArray(Math.pow(2, OFFSET_SLOT_BITS)));
    }
  }

  function literalContext(prevByte) {
    return Math.floor(prevByte / 32); // top 3 bits of an 8-bit byte
  }

  function encodeLiteral(rc, model, prevByte, byteValue) {
    encodeBitTree(rc, model.literal[literalContext(prevByte)], 8, byteValue);
  }

  function decodeLiteral(rc, model, prevByte) {
    return decodeBitTree(rc, model.literal[literalContext(prevByte)], 8);
  }

  // lenValue is zero-based: actual match length minus MIN_MATCH (range 0..271)
  function encodeLength(rc, model, lenValue) {
    if (lenValue < 8) {
      rc.encodeBit(model.lengthChoice, 0, 0);
      encodeBitTree(rc, model.lengthLow, 3, lenValue);
    } else if (lenValue < 16) {
      rc.encodeBit(model.lengthChoice, 0, 1);
      rc.encodeBit(model.lengthChoice2, 0, 0);
      encodeBitTree(rc, model.lengthMid, 3, lenValue - 8);
    } else {
      rc.encodeBit(model.lengthChoice, 0, 1);
      rc.encodeBit(model.lengthChoice2, 0, 1);
      encodeBitTree(rc, model.lengthHigh, 8, lenValue - 16);
    }
  }

  function decodeLength(rc, model) {
    if (rc.decodeBit(model.lengthChoice, 0) === 0) {
      return decodeBitTree(rc, model.lengthLow, 3);
    }
    if (rc.decodeBit(model.lengthChoice2, 0) === 0) {
      return 8 + decodeBitTree(rc, model.lengthMid, 3);
    }
    return 16 + decodeBitTree(rc, model.lengthHigh, 8);
  }

  function bitLength(n) {
    let bits = 0;
    let v = n;
    while (v > 0) {
      v = Math.floor(v / 2);
      bits++;
    }
    return bits;
  }

  // Offsets are 1-based. slot = index of the offset's highest set bit (0-based).
  // slot 0 encodes offset 1 exactly; slot > 0 is followed by `slot` equal-probability
  // "direct" bits giving the remainder below that top bit.
  function encodeOffset(rc, model, lenState, offset) {
    const slot = bitLength(offset) - 1;
    encodeBitTree(rc, model.offsetSlot[lenState], OFFSET_SLOT_BITS, slot);
    if (slot > 0) {
      const remainder = offset - Math.pow(2, slot);
      rc.encodeDirectBits(remainder, slot);
    }
  }

  function decodeOffset(rc, model, lenState) {
    const slot = decodeBitTree(rc, model.offsetSlot[lenState], OFFSET_SLOT_BITS);
    if (slot === 0) return 1;
    const remainder = rc.decodeDirectBits(slot);
    return Math.pow(2, slot) + remainder;
  }

  function lengthState(lenValue) {
    return Math.min(lenValue, NUM_LEN_STATES - 1);
  }

  // ===== LZ77 MATCH FINDER =====

  function findNormalMatch(input, pos, n) {
    const maxLen = Math.min(MAX_MATCH, n - pos);
    let bestLen = 0;
    let bestOffset = 0;
    if (maxLen < MIN_NORMAL_MATCH) return { length: 0, offset: 0 };

    const windowStart = Math.max(1, pos - WINDOW_SIZE + 1);
    for (let offset = windowStart; offset <= pos; offset++) {
      let len = 0;
      while (len < maxLen && input[pos - offset + len] === input[pos + len]) len++;
      if (len > bestLen) {
        bestLen = len;
        bestOffset = offset;
        if (len >= maxLen) break;
      }
    }
    return { length: bestLen, offset: bestOffset };
  }

  function findRepMatch(input, pos, n, reps) {
    const maxLen = Math.min(MAX_MATCH, n - pos);
    let bestLen = 0;
    let bestIndex = -1;
    for (let r = 0; r < reps.length; r++) {
      const offset = reps[r];
      if (offset <= 0 || offset > pos) continue;
      let len = 0;
      while (len < maxLen && input[pos - offset + len] === input[pos + len]) len++;
      if (len > bestLen) {
        bestLen = len;
        bestIndex = r;
      }
    }
    return { length: bestLen, index: bestIndex };
  }

  // ===== LZMS ALGORITHM =====

  class LZMSAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZMS";
      this.description = "Microsoft's LZ77 + adaptive binary range coding compression format, introduced with Windows 8 for the WIM (Windows Imaging Format) archiver and msdelta, succeeding LZX/Xpress-Huffman in that lineage. Clean-room implementation: no official Microsoft specification exists.";
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

      // Round-trip-only test vectors (this format has no public reference bitstream to
      // compare against - encoder/decoder self-consistency is what is verified).
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
          [],
          "LZMS round-trip - empty input",
          "https://wimlib.net/"
        ),
        new TestCase(
          [0x21],
          [],
          "LZMS round-trip - single byte",
          "https://wimlib.net/"
        ),
        new TestCase(
          repetitive,
          [],
          "LZMS round-trip - long repetitive run (300x 0x42)",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          alternating,
          [],
          "LZMS round-trip - alternating byte pattern (0xAA/0x55)",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          pseudoRandom,
          [],
          "LZMS round-trip - pseudo-random binary sample",
          "https://github.com/ebiggers/wimlib"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("This WIM (Windows Imaging Format) image uses LZMS compression for maximum ratio."),
          [],
          "LZMS round-trip - WIM-flavoured text",
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

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress(input) {
      const n = input.length;
      const out = [];
      writeVarint(out, n);
      if (n === 0) return out;

      const rc = new RangeEncoder();
      const model = new LZMSModel();
      const reps = [1, 1, 1];
      let pos = 0;
      let prevByte = 0;
      let state = 0; // 0 = previous symbol was a literal, 1 = previous symbol was a match

      while (pos < n) {
        const normal = findNormalMatch(input, pos, n);
        const rep = findRepMatch(input, pos, n, reps);

        let useMatch = false;
        let useRep = false;
        let matchLen = 0;
        let repIndex = -1;
        let offset = 0;

        if (rep.length >= MIN_REP_MATCH && rep.length >= normal.length) {
          useMatch = true;
          useRep = true;
          matchLen = rep.length;
          repIndex = rep.index;
        } else if (normal.length >= MIN_NORMAL_MATCH) {
          useMatch = true;
          matchLen = normal.length;
          offset = normal.offset;
        }

        rc.encodeBit(model.isMatch, state, useMatch ? 1 : 0);

        if (useMatch) {
          rc.encodeBit(model.isRep, 0, useRep ? 1 : 0);

          // Length is always coded right after the isRep decision, before the offset,
          // because the offset-slot context is selected using the (by-then-known)
          // match length - this keeps the encoder and decoder symbol order identical.
          const lenValue = matchLen - MIN_MATCH;
          encodeLength(rc, model, lenValue);

          if (useRep) {
            rc.encodeBit(model.repG0, 0, repIndex === 0 ? 0 : 1);
            if (repIndex !== 0) rc.encodeBit(model.repG1, 0, repIndex === 1 ? 0 : 1);
            const usedOffset = reps[repIndex];
            reps.splice(repIndex, 1);
            reps.unshift(usedOffset);
          } else {
            const lenState = lengthState(lenValue);
            encodeOffset(rc, model, lenState, offset);
            reps.unshift(offset);
            reps.length = NUM_REPS;
          }

          prevByte = input[pos + matchLen - 1];
          pos += matchLen;
          state = 1;
        } else {
          const b = input[pos];
          encodeLiteral(rc, model, prevByte, b);
          prevByte = b;
          pos++;
          state = 0;
        }
      }

      rc.flush();
      for (let i = 0; i < rc.bytes.length; i++) out.push(rc.bytes[i]);
      return out;
    }

    // ===== DECOMPRESSION =====

    _decompress(input) {
      const posState = { pos: 0 };
      const n = readVarint(input, posState);
      const out = [];
      if (n === 0) return out;

      const rc = new RangeDecoder(input, posState.pos);
      const model = new LZMSModel();
      const reps = [1, 1, 1];
      let prevByte = 0;
      let state = 0;

      while (out.length < n) {
        const isMatch = rc.decodeBit(model.isMatch, state);

        if (isMatch) {
          const isRep = rc.decodeBit(model.isRep, 0);

          // Length is decoded right after isRep, mirroring the encoder's order, so
          // the offset-slot context (which depends on the length) is already known
          // by the time the offset itself is decoded.
          const lenValue = decodeLength(rc, model);
          const length = lenValue + MIN_MATCH;
          let offset;

          if (isRep) {
            const g0 = rc.decodeBit(model.repG0, 0);
            let repIndex = 0;
            if (g0) {
              const g1 = rc.decodeBit(model.repG1, 0);
              repIndex = g1 ? 2 : 1;
            }
            offset = reps[repIndex];
            reps.splice(repIndex, 1);
            reps.unshift(offset);
          } else {
            const lenState = lengthState(lenValue);
            offset = decodeOffset(rc, model, lenState);
            reps.unshift(offset);
            reps.length = NUM_REPS;
          }

          for (let i = 0; i < length; i++) out.push(out[out.length - offset]);
          prevByte = out[out.length - 1];
          state = 1;
        } else {
          const b = decodeLiteral(rc, model, prevByte);
          out.push(b);
          prevByte = b;
          state = 0;
        }
      }

      return out;
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
