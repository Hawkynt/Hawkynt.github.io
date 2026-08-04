/*
 * aPLib Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * aPLib is Joergen Ibsen's LZSS-based compression library (Ibsen Software,
 * first released 1998), well known for extremely small and fast decompressors
 * and widely reused in executable packers and malware. Its bit stream is a
 * single MSB-first sequence of control bits interleaved with literal bytes
 * and back-references:
 *
 *   - The very first output byte is always a literal, written unconditionally
 *     before any control bit is read.
 *   - Every following symbol starts with a capped unary command selector
 *     (count the leading 1-bits, stopping either at a 0-bit or after the
 *     third 1-bit, whichever comes first):
 *       0        -> Literal:      one literal byte follows.
 *       10       -> Block:        LZ77 match; a variable-length number picks
 *                                  the offset (value 2 reuses the previous
 *                                  match's offset, but only if the previous
 *                                  command was a Literal or Single-byte
 *                                  command; otherwise offset = (n-3)*256 +
 *                                  next byte), followed by a variable-length
 *                                  number for the length, biased by +0/+1/+2
 *                                  depending on the offset's magnitude.
 *       110      -> Short block:  one byte; its top 7 bits are a 1..127
 *                                  offset (0 signals end of stream) and its
 *                                  low bit selects a length of 2 or 3.
 *       111      -> Single byte:  4 bits pick an offset 0..15; 0 emits a
 *                                  literal zero byte, otherwise one byte is
 *                                  copied from that offset.
 *   - The variable-length numbers use interlaced/universal-code style
 *     bits: value = 1; while (continue-bit) { value = value*2 + data-bit }.
 *
 * This is a from-specification reconstruction (not a port of Ibsen's C
 * source): the compressor here only emits Literal and (non-reusing) Block
 * commands, plus a final Short-block end marker, while the decompressor
 * implements the full grammar above, including offset reuse, short blocks
 * and single-byte copies, for completeness.
 *
 * References:
 * - Ibsen Software aPLib product page: https://ibsensoftware.com/products_aPLib.html
 * - "The malware analyst's guide to aPLib decompression" (independent format
 *   write-up): https://0xc0decafe.com/malware-analysts-guide-to-aplib-decompression
 * - aPLib Wikipedia-style overview via malduck's decompressor: https://malduck.readthedocs.io/en/v4.0.0/_modules/malduck/compression/aplib.html
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

  const CMD_LITERAL = 0;
  const CMD_BLOCK = 1;
  const CMD_SHORT_BLOCK = 2;
  const CMD_SINGLE_BYTE = 3;

  const MAX_MATCH = 65536;

  // ===== BIT-LEVEL STREAM HELPERS (MSB first) =====

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.nBits = 0;
    }

    writeBit(bit) {
      this.cur = OpCodes.Or32(OpCodes.Shl32(this.cur, 1), bit ? 1 : 0);
      this.nBits++;
      if (this.nBits === 8) {
        this.bytes.push(OpCodes.And32(this.cur, 0xFF));
        this.cur = 0;
        this.nBits = 0;
      }
    }

    writeBits(value, count) {
      for (let i = count - 1; i >= 0; --i)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }

    finish() {
      if (this.nBits > 0) {
        this.cur = OpCodes.Shl32(this.cur, 8 - this.nBits);
        this.bytes.push(OpCodes.And32(this.cur, 0xFF));
        this.cur = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
      this.cur = 0;
      this.nBits = 0;
    }

    readBit() {
      if (this.nBits === 0) {
        this.cur = this.pos < this.bytes.length ? this.bytes[this.pos++] : 0;
        this.nBits = 8;
      }
      this.nBits--;
      return OpCodes.And32(OpCodes.Shr32(this.cur, this.nBits), 1);
    }

    readBits(count) {
      let value = 0;
      for (let i = 0; i < count; ++i)
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
      return value;
    }
  }

  // ===== CAPPED UNARY COMMAND SELECTOR =====

  function writeCommand(bw, type) {
    for (let i = 0; i < type; ++i) bw.writeBit(1);
    if (type < 3) bw.writeBit(0);
  }

  function readCommand(br) {
    let count = 0;
    while (count < 3) {
      if (br.readBit() === 0) break;
      count++;
    }
    return count;
  }

  // ===== VARIABLE-LENGTH NUMBER (value >= 1) =====

  function writeVarNum(bw, value) {
    let bitLen = 0;
    let v = value;
    while (v > 1) { bitLen++; v = OpCodes.Shr32(v, 1); }

    for (let i = bitLen - 1; i >= 0; --i) {
      bw.writeBit(1); // continue
      bw.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }
    bw.writeBit(0); // stop
  }

  function readVarNum(br) {
    let value = 1;
    for (;;) {
      if (br.readBit() === 0) break;
      value = OpCodes.Or32(OpCodes.Shl32(value, 1), br.readBit());
    }
    return value;
  }

  function lengthDelta(distance) {
    if (distance < 128 || distance >= 32000) return 2;
    if (distance >= 1280 && distance <= 31999) return 1;
    return 0;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class APLibCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "aPLib";
      this.description = "Joergen Ibsen's LZSS-based compression library, known for very small and fast decompressors. A single MSB-first bit stream mixes literals with three kinds of back-references (full block, short block, single byte) selected by a capped unary command code, with variable-length (gamma-style) numbers for offsets and lengths.";
      this.inventor = "Joergen Ibsen";
      this.year = 1998;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DK;

      this.documentation = [
        new LinkItem("Ibsen Software - aPLib product page", "https://ibsensoftware.com/products_aPLib.html"),
        new LinkItem("The malware analyst's guide to aPLib decompression", "https://0xc0decafe.com/malware-analysts-guide-to-aplib-decompression")
      ];

      this.references = [
        new LinkItem("malduck aplib decompressor (independent reimplementation)", "https://malduck.readthedocs.io/en/v4.0.0/_modules/malduck/compression/aplib.html"),
        new LinkItem("apultra (aPLib-compatible optimal-parse compressor)", "https://github.com/emmanuel-marty/apultra")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: [],
          expected: []
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: new Array(64).fill(0x41),
          expected: [65, 176, 15, 246, 192, 0]
        },
        {
          text: "Text sample",
          uri: "https://ibsensoftware.com/products_aPLib.html",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [116, 52, 25, 68, 7, 19, 169, 164, 198, 107, 16, 24, 142, 70, 243, 185, 184, 64, 102, 55, 158, 4, 6, 163, 169, 180, 224, 115, 16, 27, 206, 198, 83, 144, 130, 195, 240, 216, 97, 61, 30, 68, 6, 67, 121, 156, 93, 96, 237, 98, 222, 194, 236, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new APLibInstance(this, isInverse);
    }
  }

  class APLibInstance extends IAlgorithmInstance {
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
      if (n === 0) return [];

      const bw = new BitWriter();
      bw.writeBits(input[0], 8); // first byte is always a raw literal

      let pos = 1;

      while (pos < n) {
        const match = this._findMatch(input, pos);

        if (match) {
          writeCommand(bw, CMD_BLOCK);
          const rawOff = OpCodes.Shr32(match.distance, 8) + 3;
          writeVarNum(bw, rawOff);
          bw.writeBits(OpCodes.And32(match.distance, 0xFF), 8);
          writeVarNum(bw, match.length - lengthDelta(match.distance));
          pos += match.length;
        } else {
          writeCommand(bw, CMD_LITERAL);
          bw.writeBits(input[pos], 8);
          pos += 1;
        }
      }

      // End of stream: short block with a zero offset field
      writeCommand(bw, CMD_SHORT_BLOCK);
      bw.writeBits(0, 8);

      return bw.finish();
    }

    _decompress(input) {
      if (input.length === 0) return [];

      const br = new BitReader(input);
      const output = [];

      output.push(br.readBits(8));
      let lastOffset = 0;
      let prevCmd = CMD_LITERAL;

      for (;;) {
        const cmd = readCommand(br);

        if (cmd === CMD_LITERAL) {
          output.push(br.readBits(8));
          prevCmd = CMD_LITERAL;
        } else if (cmd === CMD_BLOCK) {
          const offVal = readVarNum(br);
          let distance;

          if (offVal === 2 && (prevCmd === CMD_LITERAL || prevCmd === CMD_SINGLE_BYTE) && lastOffset !== 0) {
            distance = lastOffset;
          } else {
            distance = OpCodes.Shl32(offVal - 3, 8) + br.readBits(8);
            lastOffset = distance;
          }

          const length = readVarNum(br) + lengthDelta(distance);
          const start = output.length - distance;
          for (let k = 0; k < length; ++k) output.push(output[start + k]);
          prevCmd = CMD_BLOCK;
        } else if (cmd === CMD_SHORT_BLOCK) {
          const byte = br.readBits(8);
          const offset = OpCodes.Shr32(byte, 1);
          if (offset === 0) break; // end of stream

          const length = 2 + OpCodes.And32(byte, 1);
          const start = output.length - offset;
          for (let k = 0; k < length; ++k) output.push(output[start + k]);
          lastOffset = offset;
          prevCmd = CMD_SHORT_BLOCK;
        } else { // CMD_SINGLE_BYTE
          const offset = br.readBits(4);
          if (offset === 0) {
            output.push(0);
          } else {
            output.push(output[output.length - offset]);
          }
          prevCmd = CMD_SINGLE_BYTE;
        }
      }

      return output;
    }

    _findMatch(input, pos) {
      const n = input.length;
      const maxLen = Math.min(MAX_MATCH, n - pos);
      let bestLen = 0;
      let bestDist = 0;

      if (maxLen < 2) return null;

      for (let cand = 0; cand < pos; ++cand) {
        let len = 0;
        while (len < maxLen && input[cand + len] === input[pos + len]) ++len;

        if (len > bestLen) {
          bestLen = len;
          bestDist = pos - cand;
        }
      }

      if (bestLen < 2) return null;

      const delta = lengthDelta(bestDist);
      if (bestLen - delta < 1) return null; // length code cannot represent it

      return { length: bestLen, distance: bestDist };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new APLibCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { APLibCompression, APLibInstance };
}));
