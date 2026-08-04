/*
 * ZX0 Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ZX0 is a modern LZ77 compressor for 8-bit targets (Z80, 6502, etc.)
 * designed by Einar Saukas. This implementation matches the reference
 * CompressionWorkbench encoder/decoder (Compression.Core.Dictionary.Zx0)
 * byte-for-byte: the "v2 forward, non-inverted" bit stream compatible with
 * Saukas's Z80 decoder (dzx0_standard.asm). See salvador.js for the sibling
 * "classic"/inverted-offset variant, which shares this exact bit-stream
 * shape but XORs the offset-MSB Elias-gamma data bits with 1.
 *
 *   <Stream>            := <size:4 LE> [<bare ZX0 stream>]
 *   Literal block        : [0] elias(length) byte[1..length]   (leading 0
 *                             omitted for the very first block)
 *   Rep-match (last off) : [0] elias(length)     (only directly after a
 *                                                   literal block)
 *   New-offset match     : [1] elias(MSB(offset-1)+1) LSB-byte elias(length-1)
 *   End of stream        : a new-offset match whose Elias-coded MSB value is
 *                           the sentinel 256 (overflowing the 1..255 range)
 *
 * The LSB byte is (127-((offset-1)&127))<<1 with bit 0 reserved: after the
 * byte is written, the encoder "backtracks" and patches that bit with the
 * very first bit of the length Elias-gamma that follows, so the decoder can
 * read the offset byte and the length's leading bit in one fetch.
 *
 * Elias-gamma coding (interlaced, forward): for msb_pos pairs emit
 * (control=0, data_bit), then a final control=1 terminator; value=1 emits
 * only the terminator. All fields are non-inverted here (data_bit as-is);
 * salvador.js's offset-MSB field inverts data_bit.
 *
 * References:
 * - ZX0 official repository: https://github.com/einar-saukas/ZX0
 * - Reference encoder: https://raw.githubusercontent.com/einar-saukas/ZX0/main/src/compress.c
 * - Z80 reference decoder: https://github.com/einar-saukas/ZX0/blob/main/z80/dzx0_standard.asm
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

  // ZX0 v2 forward, non-inverted. Salvador uses INVERT_MODE = true.
  const INVERT_MODE = false;
  const INITIAL_OFFSET = 1;
  const MAX_OFFSET = 0xFFFFFF;
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
  // Flag bytes hold up to 8 indicator/elias bits MSB-first, allocated lazily
  // in the output stream when the bit mask rolls to 0. Literal and
  // offset-LSB bytes are appended directly at the current position. The very
  // first indicator bit is implicit (the decoder assumes command #0 is a
  // literal run), modelled by starting with backtrack=true so that bit is
  // simply discarded (there is no previous byte to patch it into yet).

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
        if (this.pos >= this.data.length) throw new Error("ZX0: unexpected end of bit stream.");
        this.bits = this.data[this.pos++];
        this.bitMask = 128;
      }
      const bit = OpCodes.And32(this.bits, 128) !== 0 ? 1 : 0;
      this.bits = OpCodes.And32(OpCodes.Shl32(this.bits, 1), 0xFF);
      this.bitMask = OpCodes.Shr32(this.bitMask, 1);
      return bit;
    }

    readByte() {
      if (this.pos >= this.data.length) throw new Error("ZX0: unexpected end of byte stream.");
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

  // ── Bare stream compress/decompress (shared shape with salvador.js) ──────

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
        }
        enc.emitRepMatch(repLen);
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
          if (op >= output.length) throw new Error("ZX0: literal run exceeds output size.");
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
        if (offset <= 0) throw new Error("ZX0: non-positive offset.");

        // Length Elias-gamma starts with lo&1 as its prefix bit.
        matchLen = dec.readEliasPrefix(1, false, OpCodes.And32(lo, 1));
        matchLen += 1;

        lastOffset = offset;
      } else {
        matchLen = dec.readElias(1, false);
      }

      if (lastOffset > op) throw new Error("ZX0: offset points before start of output.");
      const src = op - lastOffset;
      for (let i = 0; i < matchLen && op < output.length; i++) output[op++] = output[src + i];
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZX0Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "ZX0";
      this.description = "LZ77 compressor for 8-bit targets designed by Einar Saukas. Uses only three block types (literal, last-offset match, new-offset match) distinguished by a single context-dependent bit, with interlaced Elias gamma coding for offsets and lengths.";
      this.inventor = "Einar Saukas";
      this.year = 2021;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BR;

      this.documentation = [
        new LinkItem("ZX0 official repository", "https://github.com/einar-saukas/ZX0"),
        new LinkItem("ZX0 README (format overview)", "https://github.com/einar-saukas/ZX0/blob/main/README.md")
      ];

      this.references = [
        new LinkItem("dzx0_standard.asm reference decompressor", "https://github.com/einar-saukas/ZX0/blob/main/z80/dzx0_standard.asm"),
        new LinkItem("Reference compress.c", "https://raw.githubusercontent.com/einar-saukas/ZX0/main/src/compress.c")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/einar-saukas/ZX0",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://github.com/einar-saukas/ZX0",
          input: new Array(64).fill(0x41),
          roundTripOnly: true
        },
        {
          text: "Text sample",
          uri: "https://github.com/einar-saukas/ZX0",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          roundTripOnly: true
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ZX0Instance(this, isInverse);
    }
  }

  class ZX0Instance extends IAlgorithmInstance {
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
      if (input.length < 4) throw new Error("ZX0: input smaller than 4-byte header.");
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize < 0) throw new Error("ZX0: negative decompressed size.");
      if (targetSize === 0) return [];
      return decompressCore(input.slice(4), targetSize, INVERT_MODE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZX0Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ZX0Compression, ZX0Instance };
}));
