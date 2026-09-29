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
 * Because end-of-stream is signalled by an offset-MSB Elias value of 256, the
 * encoder may only pick offsets up to MAX_OFFSET = 32640 (0x7F80), the same
 * bound the reference encoder uses: offset 32641 would encode MSB value 256 and
 * be read back as end-of-stream.
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
  /** @type {int32} */
  const INITIAL_OFFSET = 1;
  // Largest offset whose Elias-coded MSB stays below the 256 end-of-stream
  // sentinel: (32640-1)/128+1 === 255. This is the reference MAX_OFFSET.
  /** @type {int32} */
  const MAX_OFFSET = 0x7F80;
  /** @type {int32} */
  const MIN_MATCH_LENGTH = 2;
  /** @type {int32} */
  const HASH_BITS = 16;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const CHAIN_LIMIT = 64;

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position hashed
   * @returns {uint32} 16-bit hash of up to three bytes
   */
  function hash(data, pos) {
    if (pos + 1 >= data.length) {
      return OpCodes.And32(data[pos], 0xFFFF);
    }
    /** @type {uint32} */
    const h1 = OpCodes.Shl32(data[pos], 8);
    /** @type {uint32} */
    const h2 = OpCodes.Shl32(data[pos + 1], 4);
    /** @type {uint8} */
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
    /**
     * @param {boolean} invertMode - Invert the offset-MSB Elias data bits
     */
    constructor(invertMode) {
      /** @type {uint8[]} */
      this.out = [];
      /** @type {boolean} */
      this.invertMode = invertMode;
      /** @type {uint32} */
      this.bitMask = 0;
      /** @type {int32} */
      this.bitIndex = 0;
      /** @type {boolean} */
      this.backtrack = true;
    }

    /**
     * @param {uint8[]} data - Source bytes
     * @param {int32} start - First literal
     * @param {int32} length - Number of literals
     */
    emitLiterals(data, start, length) {
      if (length <= 0) {
        return;
      }
      this.writeBit(0);
      this._writeInterlacedEliasGamma(length, false);
      for (let i = 0; i < length; i++) {
        this.writeByte(data[start + i]);
      }
    }

    /**
     * @param {int32} length - Match length at the last offset
     */
    emitRepMatch(length) {
      this.writeBit(0);
      this._writeInterlacedEliasGamma(length, false);
    }

    /**
     * @param {int32} offset - Match distance
     * @param {int32} length - Match length
     */
    emitNewOffsetMatch(offset, length) {
      this.writeBit(1);
      this._writeInterlacedEliasGamma(Math.floor((offset - 1) / 128) + 1, this.invertMode);
      // LSB byte: bit 0 reserved for the length Elias-gamma's first bit (patched by backtrack).
      /** @type {int32} */
      const lowPart = 127 - (offset - 1) % 128;
      this.writeByte(OpCodes.And32(OpCodes.Shl32(lowPart, 1), 0xFF));
      this.backtrack = true;
      this._writeInterlacedEliasGamma(length - 1, false);
    }

    /** Write the end-of-stream marker */
    emitEnd() {
      this.writeBit(1);
      this._writeInterlacedEliasGamma(256, this.invertMode);
    }

    /**
     * @param {int32} value - Bit (any non-zero value is a 1)
     */
    writeBit(value) {
      if (this.backtrack) {
        if (value !== 0) {
          this.out[this.out.length - 1] = OpCodes.Or32(this.out[this.out.length - 1], 1);
        }
        this.backtrack = false;
        return;
      }
      if (this.bitMask === 0) {
        this.bitMask = 128;
        this.bitIndex = this.out.length;
        this.out.push(0);
      }
      if (value !== 0) {
        this.out[this.bitIndex] = OpCodes.Or32(this.out[this.bitIndex], this.bitMask);
      }
      this.bitMask = OpCodes.Shr32(this.bitMask, 1);
    }

    /**
     * @param {uint8} value - Byte appended at the current position
     */
    writeByte(value) {
      this.out.push(value);
    }

    /**
     * @param {int32} value - Value (at least 1)
     * @param {boolean} invertMode - Invert the data bits
     */
    _writeInterlacedEliasGamma(value, invertMode) {
      /** @type {uint32} */
      let i = 2;
      while (i <= value) {
        i = OpCodes.Shl32(i, 1);
      }
      i = OpCodes.Shr32(i, 1);
      for (;;) {
        i = OpCodes.Shr32(i, 1);
        if (i === 0) {
          break;
        }
        this.writeBit(0);
        /** @type {int32} */
        const dataBit = OpCodes.And32(value, i) !== 0 ? 1 : 0;
        this.writeBit(invertMode ? 1 - dataBit : dataBit);
      }
      this.writeBit(1);
    }
  }

  // ── Decoder ─────────────────────────────────────────────────────────────

  class Zx0Decoder {
    /**
     * @param {uint8[]} data - Compressed stream (without the size header)
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint32} */
      this.bits = 0;
      /** @type {uint32} */
      this.bitMask = 0;
    }

    /**
     * @returns {int32} Next bit
     */
    readBit() {
      if (this.bitMask === 0) {
        if (this.pos >= this.data.length) {
          throw new Error("ZX0: unexpected end of bit stream.");
        }
        this.bits = this.data[this.pos++];
        this.bitMask = 128;
      }
      /** @type {int32} */
      const bit = OpCodes.And32(this.bits, 128) !== 0 ? 1 : 0;
      this.bits = OpCodes.And32(OpCodes.Shl32(this.bits, 1), 0xFF);
      this.bitMask = OpCodes.Shr32(this.bitMask, 1);
      return bit;
    }

    /**
     * @returns {uint8} Next byte
     */
    readByte() {
      if (this.pos >= this.data.length) {
        throw new Error("ZX0: unexpected end of byte stream.");
      }
      return this.data[this.pos++];
    }

    /**
     * @param {int32} initial - Starting value
     * @param {boolean} invertMode - Invert the data bits
     * @returns {uint32} Decoded value
     */
    readElias(initial, invertMode) {
      /** @type {uint32} */
      let value = initial;
      while (this.readBit() === 0) {
        /** @type {int32} */
        let dataBit = this.readBit();
        if (invertMode) {
          dataBit = 1 - dataBit;
        }
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), dataBit);
      }
      return value;
    }

    // Elias-gamma read where the caller supplies the first control bit
    // (usually bit 0 of the offset LSB byte).
    /**
     * @param {int32} initial - Starting value
     * @param {boolean} invertMode - Invert the data bits
     * @param {uint32} firstBit - First control bit
     * @returns {uint32} Decoded value
     */
    readEliasPrefix(initial, invertMode, firstBit) {
      /** @type {uint32} */
      let value = initial;
      if (firstBit === 0) {
        /** @type {int32} */
        let dataBit = this.readBit();
        if (invertMode) {
          dataBit = 1 - dataBit;
        }
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), dataBit);
        while (this.readBit() === 0) {
          dataBit = this.readBit();
          if (invertMode) {
            dataBit = 1 - dataBit;
          }
          value = OpCodes.Or32(OpCodes.Shl32(value, 1), dataBit);
        }
      }
      return value;
    }
  }

  // ── Bare stream compress/decompress (shared shape with salvador.js) ──────

  /**
   * @param {uint8[]} data - Input bytes
   * @param {int32} pos - Position of the match
   * @param {int32} count - Match length
   * @param {int32[]} head - Hash chain heads
   * @param {int32[]} prev - Hash chain links
   * @param {int32} n - Input length
   */
  function insertCovered(data, pos, count, head, prev, n) {
    for (let j = 1; j < count && pos + j + MIN_MATCH_LENGTH <= n; j++) {
      /** @type {uint32} */
      const h = hash(data, pos + j);
      prev[pos + j] = head[h];
      head[h] = pos + j;
    }
  }

  /**
   * @param {uint8[]} data - Input bytes
   * @param {boolean} invertMode - Invert the offset-MSB Elias data bits
   * @returns {uint8[]} Bare compressed stream
   */
  function compressBare(data, invertMode) {
    /** @type {Zx0Encoder} */
    const enc = new Zx0Encoder(invertMode);
    /** @type {int32} */
    const n = data.length;
    /** @type {int32[]} */
    const head = new Int32Array(HASH_SIZE).fill(-1);
    /** @type {int32[]} */
    const prev = new Int32Array(n);

    /** @type {int32} */
    let pos = 0;
    /** @type {int32} */
    let literalStart = 0;
    /** @type {int32} */
    let lastOffset = INITIAL_OFFSET;

    while (pos < n) {
      /** @type {int32} */
      let bestLen = 0;
      /** @type {int32} */
      let bestOff = 0;

      if (pos + MIN_MATCH_LENGTH <= n) {
        /** @type {uint32} */
        const h = hash(data, pos);
        /** @type {int32} */
        let chainLen = 0;
        /** @type {int32} */
        const minPos = Math.max(0, pos - MAX_OFFSET);
        /** @type {int32} */
        let idx = head[h];
        while (idx >= minPos && chainLen < CHAIN_LIMIT) {
          /** @type {int32} */
          const off = pos - idx;
          if (off >= 1 && off <= MAX_OFFSET && data[idx] === data[pos]) {
            /** @type {int32} */
            const maxLen = Math.min(n - pos, 0x10000);
            /** @type {int32} */
            let len = 0;
            while (len < maxLen && data[idx + len] === data[pos + len]) {
              len++;
            }
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
      /** @type {int32} */
      let repLen = 0;
      if (pos >= lastOffset && lastOffset >= 1) {
        /** @type {int32} */
        const maxRep = Math.min(n - pos, 0x10000);
        while (repLen < maxRep && data[pos - lastOffset + repLen] === data[pos + repLen]) {
          repLen++;
        }
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
        insertCovered(data, pos, repLen, head, prev, n);
        pos += repLen;
        literalStart = pos;
      } else if (bestLen >= MIN_MATCH_LENGTH) {
        if (pos > literalStart) {
          enc.emitLiterals(data, literalStart, pos - literalStart);
          literalStart = pos;
        }
        enc.emitNewOffsetMatch(bestOff, bestLen);
        lastOffset = bestOff;
        insertCovered(data, pos, bestLen, head, prev, n);
        pos += bestLen;
        literalStart = pos;
      } else {
        pos++;
      }
    }

    if (pos > literalStart) {
      enc.emitLiterals(data, literalStart, pos - literalStart);
    }
    enc.emitEnd();
    return enc.out;
  }

  /**
   * @param {uint8[]} compressed - Bare compressed stream
   * @param {uint32} targetSize - Decompressed size
   * @param {boolean} invertMode - Invert the offset-MSB Elias data bits
   * @returns {uint8[]} Decoded bytes
   */
  function decompressCore(compressed, targetSize, invertMode) {
    /** @type {uint8[]} */
    const output = new Array(targetSize);
    /** @type {Zx0Decoder} */
    const dec = new Zx0Decoder(compressed);
    /** @type {int32} */
    let op = 0;
    // A corrupt offset can reach 2^32, so the offset is kept as an exact float64.
    /** @type {float64} */
    let lastOffset = INITIAL_OFFSET;
    /** @type {boolean} */
    let isFirstCommand = true;

    while (op < output.length) {
      /** @type {boolean} */
      let isMatchWithOffset = false;
      if (isFirstCommand) {
        isFirstCommand = false;
        isMatchWithOffset = false; // first command is always literals.
      } else {
        /** @type {int32} */
        const flag = dec.readBit();
        isMatchWithOffset = flag !== 0;
      }

      if (!isMatchWithOffset) {
        /** @type {uint32} */
        const nLiterals = dec.readElias(1, false);
        for (let i = 0; i < nLiterals; i++) {
          if (op >= output.length) {
            throw new Error("ZX0: literal run exceeds output size.");
          }
          /** @type {uint8} */
          const literal = dec.readByte();
          output[op++] = literal;
        }
        if (op >= output.length) {
          return output;
        }
        /** @type {int32} */
        const afterLiterals = dec.readBit();
        isMatchWithOffset = afterLiterals !== 0;
      }

      /** @type {float64} */
      let matchLen = 0;
      if (isMatchWithOffset) {
        /** @type {uint32} */
        const hiValue = dec.readElias(1, invertMode);
        if (hiValue === 256) {
          break; // end marker.
        }
        /** @type {int32} */
        const hi = hiValue - 1; // 0-based MSB.

        /** @type {uint8} */
        const lo = dec.readByte();
        /** @type {int32} */
        const lowPart = 127 - OpCodes.Shr32(lo, 1);
        /** @type {float64} */
        let offset = OpCodes.Or32(OpCodes.Shl32(hi, 7), lowPart);
        offset++;
        if (offset <= 0) {
          throw new Error("ZX0: non-positive offset.");
        }

        // Length Elias-gamma starts with lo&1 as its prefix bit.
        matchLen = dec.readEliasPrefix(1, false, OpCodes.And32(lo, 1));
        matchLen += 1;

        lastOffset = offset;
      } else {
        matchLen = dec.readElias(1, false);
      }

      if (lastOffset > op) {
        throw new Error("ZX0: offset points before start of output.");
      }
      /** @type {int32} */
      const src = op - lastOffset;
      for (let i = 0; i < matchLen && op < output.length; i++) {
        output[op++] = output[src + i];
      }
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  // Builds `length` bytes of a repeating pangram, for the large round-trip vector.
  /**
   * @param {int32} length - Number of bytes
   * @returns {uint8[]} Repeated pangram
   */
  function repeatText(length) {
    /** @type {uint8[]} */
    const unit = OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ");
    /** @type {uint8[]} */
    const out = new Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = unit[i % unit.length];
    }
    return out;
  }

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
        },
        {
          // Past ~64 KB a second match follows the first with no literal block
          // between them, which is exactly where a rep-match becomes
          // undecodable.
          text: "Repetitive text beyond a single maximum-length match (90 KB)",
          uri: "https://github.com/einar-saukas/ZX0",
          input: repeatText(90000),
          roundTripOnly: true
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {ZX0Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new ZX0Instance(this, isInverse);
    }
  }

  class ZX0Instance extends IAlgorithmInstance {
    /**
     * @param {ZX0Compression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
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

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Size header and compressed stream
     */
    _compress(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) {
        return header;
      }
      /** @type {uint8[]} */
      const body = compressBare(input, INVERT_MODE);
      for (let i = 0; i < body.length; i++) {
        header.push(body[i]);
      }
      return header;
    }

    /**
     * @param {uint8[]} input - Size header and compressed stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      if (input.length < 4) {
        throw new Error("ZX0: input smaller than 4-byte header.");
      }
      /** @type {uint32} */
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize < 0) {
        throw new Error("ZX0: negative decompressed size.");
      }
      if (targetSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }
      /** @type {uint8[]} */
      const decoded = decompressCore(input.slice(4), targetSize, INVERT_MODE);
      return decoded;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZX0Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ZX0Compression, ZX0Instance };
}));
