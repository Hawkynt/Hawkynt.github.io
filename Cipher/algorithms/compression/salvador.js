/*
 * Salvador (inverted-offset ZX0-format) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Salvador is Emmanuel Marty's free, open-source, high-speed optimal parser
 * for the ZX0 compressed format. Per Salvador's own source ("Implements the
 * ZX0 encoding designed by Einar Saukas"), this is not an independent format
 * but a ZX0-compatible LZ77 encoder retargeted for Amiga memory layouts.
 *
 * This implementation matches the reference CompressionWorkbench encoder
 * (Compression.Core.Dictionary.Salvador, which literally calls into
 * Zx0BuildingBlock.CompressBare with an inverted-offset flag) byte-for-byte.
 * It shares zx0.js's exact bit-stream shape -- flag-byte-packed indicator
 * bits, byte-aligned literal/offset bytes, and the offset-LSB-byte "backtrack"
 * trick that folds the length Elias-gamma's first bit into the offset byte's
 * reserved low bit -- with exactly one difference: the offset-MSB
 * Elias-gamma's DATA bits (not its continuation bits) are XOR'd with 1. See
 * zx0.js for the full block grammar and bit-packing description.
 *
 * IMPORTANT: the reference building block reuses ZX0's own MinMatchLength=2
 * rather than Salvador's documented format.h MIN_MATCH_SIZE=1 --
 * CompressionWorkbench is authoritative, so this port does the same. Do not
 * "fix" it to Salvador's real-world constant; that would break the
 * byte-for-byte match with the reference. MaxOffset, on the other hand, is
 * 0x7F80 on both sides: any larger offset would encode an offset-MSB Elias
 * value of 256, which the decoder reads as end-of-stream.
 *
 * References:
 * - Salvador repository: https://github.com/emmanuel-marty/salvador
 * - Reference encoder: https://raw.githubusercontent.com/emmanuel-marty/salvador/master/src/shrink.c
 * - Reference decoder: https://raw.githubusercontent.com/emmanuel-marty/salvador/master/src/expand.c
 * - ZX0 format (shared block grammar): https://github.com/einar-saukas/ZX0
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // Salvador's "FLG_IS_INVERTED" (default forward mode) inverts the offset-MSB
  // Elias-gamma data bits. Everything else, including the constants below, is
  // shared verbatim with zx0.js's reference building block.
  const INVERT_MODE = true;
  const INITIAL_OFFSET = 1;
  // Largest offset whose Elias-coded MSB stays below the 256 end-of-stream
  // sentinel: (32640-1)/128+1 === 255. This is the reference MAX_OFFSET.
  const MAX_OFFSET = 0x7F80;
  const MIN_MATCH_LENGTH = 2;
  const HASH_BITS = 16;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const CHAIN_LIMIT = 64;

  function hash(data, pos) {
    if (pos + 1 >= data.length) return OpCodes.And32(data[pos], 0xFFFF);
    const h1 = OpCodes.Shl32(data[pos], 8);
    const h2 = OpCodes.Shl32(data[pos + 1], 4);
    const h3 = pos + 2 < data.length ? data[pos + 2] : 0;
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), h3), 0xFFFF);
  }

  // ── Encoder ─────────────────────────────────────────────────────────────
  //
  // See zx0.js for the full description of the flag-byte packing and the
  // offset-LSB-byte "backtrack" trick; this class is identical except that
  // invertMode also applies to the offset-MSB Elias-gamma's data bits.

  class Zx0Encoder {
    constructor(invertMode) {
      this.out = [];
      this.invertMode = invertMode;
      this.bitMask = 0;
      this.bitIndex = 0;
      this.backtrack = true;
    }

    emitLiterals(data, start, length) {
      if (length <= 0) return;
      this.writeBit(0);
      this._writeInterlacedEliasGamma(length, false);
      for (let i = 0; i < length; i++) this.writeByte(data[start + i]);
    }

    emitRepMatch(length) {
      this.writeBit(0);
      this._writeInterlacedEliasGamma(length, false);
    }

    emitNewOffsetMatch(offset, length) {
      this.writeBit(1);
      this._writeInterlacedEliasGamma(Math.floor((offset - 1) / 128) + 1, this.invertMode);
      // LSB byte: bit 0 reserved for the length Elias-gamma's first bit (patched by backtrack).
      this.writeByte(OpCodes.And32(OpCodes.Shl32(127 - (offset - 1) % 128, 1), 0xFF));
      this.backtrack = true;
      this._writeInterlacedEliasGamma(length - 1, false);
    }

    emitEnd() {
      this.writeBit(1);
      this._writeInterlacedEliasGamma(256, this.invertMode);
    }

    writeBit(value) {
      if (this.backtrack) {
        if (value !== 0) this.out[this.out.length - 1] = OpCodes.Or32(this.out[this.out.length - 1], 1);
        this.backtrack = false;
        return;
      }
      if (this.bitMask === 0) {
        this.bitMask = 128;
        this.bitIndex = this.out.length;
        this.out.push(0);
      }
      if (value !== 0) this.out[this.bitIndex] = OpCodes.Or32(this.out[this.bitIndex], this.bitMask);
      this.bitMask = OpCodes.Shr32(this.bitMask, 1);
    }

    writeByte(value) { this.out.push(value); }

    _writeInterlacedEliasGamma(value, invertMode) {
      let i = 2;
      while (i <= value) i = OpCodes.Shl32(i, 1);
      i = OpCodes.Shr32(i, 1);
      for (;;) {
        i = OpCodes.Shr32(i, 1);
        if (i === 0) break;
        this.writeBit(0);
        const dataBit = OpCodes.And32(value, i) !== 0 ? 1 : 0;
        this.writeBit(invertMode ? 1 - dataBit : dataBit);
      }
      this.writeBit(1);
    }
  }

  // ── Decoder ─────────────────────────────────────────────────────────────

  class Zx0Decoder {
    constructor(data) {
      this.data = data;
      this.pos = 0;
      this.bits = 0;
      this.bitMask = 0;
    }

    readBit() {
      if (this.bitMask === 0) {
        if (this.pos >= this.data.length) throw new Error("Salvador: unexpected end of bit stream.");
        this.bits = this.data[this.pos++];
        this.bitMask = 128;
      }
      const bit = OpCodes.And32(this.bits, 128) !== 0 ? 1 : 0;
      this.bits = OpCodes.And32(OpCodes.Shl32(this.bits, 1), 0xFF);
      this.bitMask = OpCodes.Shr32(this.bitMask, 1);
      return bit;
    }

    readByte() {
      if (this.pos >= this.data.length) throw new Error("Salvador: unexpected end of byte stream.");
      return this.data[this.pos++];
    }

    readElias(initial, invertMode) {
      let value = initial;
      while (this.readBit() === 0) {
        let dataBit = this.readBit();
        if (invertMode) dataBit = 1 - dataBit;
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), dataBit);
      }
      return value;
    }

    // Elias-gamma read where the caller supplies the first control bit
    // (usually bit 0 of the offset LSB byte).
    readEliasPrefix(initial, invertMode, firstBit) {
      let value = initial;
      if (firstBit === 0) {
        let dataBit = this.readBit();
        if (invertMode) dataBit = 1 - dataBit;
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), dataBit);
        while (this.readBit() === 0) {
          dataBit = this.readBit();
          if (invertMode) dataBit = 1 - dataBit;
          value = OpCodes.Or32(OpCodes.Shl32(value, 1), dataBit);
        }
      }
      return value;
    }
  }

  // ── Bare stream compress/decompress (shared shape with zx0.js) ───────────

  function compressBare(data, invertMode) {
    const enc = new Zx0Encoder(invertMode);
    const n = data.length;
    const head = new Int32Array(HASH_SIZE).fill(-1);
    const prev = new Int32Array(n);

    let pos = 0;
    let literalStart = 0;
    let lastOffset = INITIAL_OFFSET;

    while (pos < n) {
      let bestLen = 0, bestOff = 0;

      if (pos + MIN_MATCH_LENGTH <= n) {
        const h = hash(data, pos);
        let chainLen = 0;
        const minPos = Math.max(0, pos - MAX_OFFSET);
        let idx = head[h];
        while (idx >= minPos && chainLen < CHAIN_LIMIT) {
          const off = pos - idx;
          if (off >= 1 && off <= MAX_OFFSET && data[idx] === data[pos]) {
            const maxLen = Math.min(n - pos, 0x10000);
            let len = 0;
            while (len < maxLen && data[idx + len] === data[pos + len]) len++;
            if (len >= MIN_MATCH_LENGTH && len > bestLen) {
              bestLen = len;
              bestOff = off;
            }
          }
          idx = prev[idx];
          chainLen++;
        }
        prev[pos] = head[h];
        head[h] = pos;
      }

      // Rep-match opportunity: reusing the last offset is cheaper than a
      // fresh one, so prefer it whenever it ties or beats the best new match.
      let repLen = 0;
      if (pos >= lastOffset && lastOffset >= 1) {
        const maxRep = Math.min(n - pos, 0x10000);
        while (repLen < maxRep && data[pos - lastOffset + repLen] === data[pos + repLen]) repLen++;
      }

      if (repLen >= MIN_MATCH_LENGTH && repLen >= bestLen) {
        if (pos > literalStart) {
          enc.emitLiterals(data, literalStart, pos - literalStart);
          literalStart = pos;
          enc.emitRepMatch(repLen);
        } else {
          // A rep-match is only decodable directly after a literal block: at the
          // start of a command the leading 0 bit already means "literal run", so
          // a rep-match emitted there would be mis-read as a literal count. With
          // no pending literals the same distance is re-encoded as a new-offset
          // match, which is legal in every state.
          enc.emitNewOffsetMatch(lastOffset, repLen);
        }
        for (let j = 1; j < repLen && pos + j + MIN_MATCH_LENGTH <= n; j++) {
          const h = hash(data, pos + j);
          prev[pos + j] = head[h];
          head[h] = pos + j;
        }
        pos += repLen;
        literalStart = pos;
      } else if (bestLen >= MIN_MATCH_LENGTH) {
        if (pos > literalStart) {
          enc.emitLiterals(data, literalStart, pos - literalStart);
          literalStart = pos;
        }
        enc.emitNewOffsetMatch(bestOff, bestLen);
        lastOffset = bestOff;
        for (let j = 1; j < bestLen && pos + j + MIN_MATCH_LENGTH <= n; j++) {
          const h = hash(data, pos + j);
          prev[pos + j] = head[h];
          head[h] = pos + j;
        }
        pos += bestLen;
        literalStart = pos;
      } else {
        pos++;
      }
    }

    if (pos > literalStart) enc.emitLiterals(data, literalStart, pos - literalStart);
    enc.emitEnd();
    return enc.out;
  }

  function decompressCore(compressed, targetSize, invertMode) {
    const output = new Array(targetSize);
    const dec = new Zx0Decoder(compressed);
    let op = 0;
    let lastOffset = INITIAL_OFFSET;
    let isFirstCommand = true;

    while (op < output.length) {
      let isMatchWithOffset;
      if (isFirstCommand) {
        isFirstCommand = false;
        isMatchWithOffset = false; // first command is always literals.
      } else {
        isMatchWithOffset = dec.readBit() !== 0;
      }

      if (!isMatchWithOffset) {
        const nLiterals = dec.readElias(1, false);
        for (let i = 0; i < nLiterals; i++) {
          if (op >= output.length) throw new Error("Salvador: literal run exceeds output size.");
          output[op++] = dec.readByte();
        }
        if (op >= output.length) return output;
        isMatchWithOffset = dec.readBit() !== 0;
      }

      let matchLen;
      if (isMatchWithOffset) {
        const hiValue = dec.readElias(1, invertMode);
        if (hiValue === 256) break; // end marker.
        const hi = hiValue - 1; // 0-based MSB.

        const lo = dec.readByte();
        let offset = OpCodes.Or32(OpCodes.Shl32(hi, 7), 127 - OpCodes.Shr32(lo, 1));
        offset++;
        if (offset <= 0) throw new Error("Salvador: non-positive offset.");

        // Length Elias-gamma starts with lo&1 as its prefix bit.
        matchLen = dec.readEliasPrefix(1, false, OpCodes.And32(lo, 1));
        matchLen += 1;

        lastOffset = offset;
      } else {
        matchLen = dec.readElias(1, false);
      }

      if (lastOffset > op) throw new Error("Salvador: offset points before start of output.");
      const src = op - lastOffset;
      for (let i = 0; i < matchLen && op < output.length; i++) output[op++] = output[src + i];
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  // Builds `length` bytes of a repeating pangram, for the large round-trip vector.
  function repeatText(length) {
    const unit = OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ");
    const out = new Array(length);
    for (let i = 0; i < length; i++) out[i] = unit[i % unit.length];
    return out;
  }

  class SalvadorCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "Salvador";
      this.description = "Emmanuel Marty's high-speed optimal parser for the ZX0 compressed format. Shares ZX0's three-block LZ77 grammar (literal, last-offset match, new-offset match) and bit packing, but XORs the offset-MSB Elias-gamma's data bits with 1.";
      this.inventor = "Emmanuel Marty";
      this.year = 2021;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      this.documentation = [
        new LinkItem("Salvador repository", "https://github.com/emmanuel-marty/salvador"),
        new LinkItem("ZX0 official repository (shared block grammar)", "https://github.com/einar-saukas/ZX0")
      ];

      this.references = [
        new LinkItem("Reference encoder (shrink.c)", "https://raw.githubusercontent.com/emmanuel-marty/salvador/master/src/shrink.c"),
        new LinkItem("Reference decoder (expand.c)", "https://raw.githubusercontent.com/emmanuel-marty/salvador/master/src/expand.c")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/emmanuel-marty/salvador",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://github.com/emmanuel-marty/salvador",
          input: new Array(64).fill(0x41),
          roundTripOnly: true
        },
        {
          text: "Text sample",
          uri: "https://github.com/emmanuel-marty/salvador",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          roundTripOnly: true
        },
        {
          // Past ~64 KB a second match follows the first with no literal block
          // between them, which is exactly where a rep-match becomes
          // undecodable.
          text: "Repetitive text beyond a single maximum-length match (90 KB)",
          uri: "https://github.com/emmanuel-marty/salvador",
          input: repeatText(90000),
          roundTripOnly: true
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SalvadorInstance(this, isInverse);
    }
  }

  class SalvadorInstance extends IAlgorithmInstance {
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
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      const n = input.length;
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) return header;
      return header.concat(compressBare(input, INVERT_MODE));
    }

    _decompress(input) {
      if (input.length < 4) throw new Error("Salvador: input smaller than 4-byte header.");
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize < 0) throw new Error("Salvador: negative decompressed size.");
      if (targetSize === 0) return [];
      return decompressCore(input.slice(4), targetSize, INVERT_MODE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SalvadorCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SalvadorCompression, SalvadorInstance };
}));
