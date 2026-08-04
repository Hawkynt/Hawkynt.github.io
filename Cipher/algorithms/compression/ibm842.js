/*
 * IBM 842 Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * IBM's "842" algorithm is a fixed-block, template/dictionary based compressor
 * originally built into the POWER7+ "on-chip accelerator" and later shipped as a
 * software fallback in the Linux kernel (lib/842, crypto/842.c, drivers/crypto/nx).
 * Data is processed in 8-byte chunks; each chunk is emitted as a 5-bit template
 * opcode followed by a mix of literal fields and back-references into three
 * separate ring-buffer dictionaries that hold the 256 most recently seen 2-, 4-
 * and 8-byte values (a hash/value dictionary, not an LZ77 sliding-window offset).
 *
 * This implementation reproduces the eight core chunk templates - full 8-byte
 * reference, two 4-byte references, 4-byte+two 2-byte references (both orders),
 * four 2-byte references, 4-byte reference+4 literal bytes (both orders), and
 * full 8-byte literal - plus a 5-bit end-of-stream marker and a trailing
 * zero-padded literal chunk for input lengths that are not a multiple of 8.
 * The optional OP_REPEAT/OP_ZEROS run-length templates from the reference
 * decoder are not implemented; this is a documented subset, not a byte-exact
 * clone of the hardware/kernel bitstream.
 *
 * References:
 * - Wikipedia: "842 (compression algorithm)"
 * - Linux kernel lib/842 (lib842.h, 842_compress.c, 842_decompress.c) - reference
 *   describing the template/opcode table and dictionary structure
 * - plauth/lib842 (userspace/GPU port, documents the wire format)
 * - Blaner et al., "IBM POWER7+ processor on-chip accelerators for cryptography
 *   and active memory expansion", IBM J. Res. Dev., Nov 2013
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== BIT STREAM HELPERS (MSB-first, matches the 842 wire format) =====

  class BitWriter842 {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.nBits = 0;
    }

    writeBits(value, width) {
      for (let i = width - 1; i >= 0; --i) {
        const bit = OpCodes.AndN(OpCodes.Shr32(value, i), 1);
        this.cur = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(this.cur, 1), bit), 0xFF);
        this.nBits++;
        if (this.nBits === 8) {
          this.bytes.push(this.cur);
          this.cur = 0;
          this.nBits = 0;
        }
      }
    }

    flush() {
      if (this.nBits > 0) {
        const pad = 8 - this.nBits;
        this.cur = OpCodes.AndN(OpCodes.Shl32(this.cur, pad), 0xFF);
        this.bytes.push(this.cur);
        this.cur = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader842 {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
      this.cur = 0;
      this.nBits = 0;
    }

    readBits(width) {
      let value = 0;
      for (let i = 0; i < width; ++i) {
        if (this.nBits === 0) {
          if (this.pos >= this.bytes.length) throw new Error('842: unexpected end of stream');
          this.cur = this.bytes[this.pos++];
          this.nBits = 8;
        }
        const bit = OpCodes.AndN(OpCodes.Shr32(this.cur, 7), 1);
        this.cur = OpCodes.AndN(OpCodes.Shl32(this.cur, 1), 0xFF);
        this.nBits--;
        value = OpCodes.OrN(OpCodes.Shl32(value, 1), bit);
      }
      return value;
    }
  }

  // ===== TEMPLATE OPCODES (5-bit) =====
  // Mirrors CompressionWorkbench's Ibm842BuildingBlock template numbering.

  const OP_D8         = 0x00; // one 8-byte dictionary reference
  const OP_D4D4        = 0x01; // two 4-byte dictionary references
  const OP_D4D2D2       = 0x02; // 4-byte ref + two 2-byte refs (covering bytes 4..8)
  const OP_D2D2D4       = 0x03; // two 2-byte refs (covering bytes 0..4) + 4-byte ref
  const OP_D2D2D2D2      = 0x04; // four 2-byte dictionary references
  const OP_D4L4         = 0x05; // 4-byte ref + 4 literal bytes
  const OP_L4D4         = 0x06; // 4 literal bytes + 4-byte ref
  const OP_L8          = 0x07; // 8 literal bytes
  const OP_END         = 0x1F; // end of stream

  const OPCODE_BITS = 5;
  const IDX_BITS = 8; // all three ring buffers hold 256 entries

  const DICT2_SIZE = 256;
  const DICT4_SIZE = 256;
  const DICT8_SIZE = 256;

  // Big-endian field readers built from arithmetic only (no raw bit operators).
  function be16(bytes, offset) {
    return OpCodes.OrN(OpCodes.Shl32(bytes[offset], 8), bytes[offset + 1]);
  }

  function be32(bytes, offset) {
    return OpCodes.ToUint32(OpCodes.OrN(
      OpCodes.OrN(OpCodes.Shl32(bytes[offset], 24), OpCodes.Shl32(bytes[offset + 1], 16)),
      OpCodes.OrN(OpCodes.Shl32(bytes[offset + 2], 8), bytes[offset + 3])
    ));
  }

  // 8-byte values only need to support equality/keying, so they are represented
  // as a "hi:lo" string built from two 32-bit big-endian halves.
  function be64Key(bytes, offset) {
    return be32(bytes, offset) + ':' + be32(bytes, offset + 4);
  }

  // Ring-buffer value dictionary: maps recently-seen N-byte values to their
  // circular slot index, evicting the value that previously occupied a slot
  // when it is overwritten (mirrors the reference's Dictionary+reverse-array
  // eviction, including that a duplicate value inserted at a later slot can
  // shadow an older slot holding the same value).
  class RingDict {
    constructor(size) {
      this.size = size;
      this.forward = new Map(); // value -> slot index
      this.reverse = new Array(size).fill(undefined); // slot index -> value
      this.next = 0;
    }

    find(value) {
      const idx = this.forward.get(value);
      return idx === undefined ? -1 : idx;
    }

    insert(value) {
      const slot = this.next;
      const old = this.reverse[slot];
      if (old !== undefined) this.forward.delete(old);
      this.reverse[slot] = value;
      this.forward.set(value, slot);
      this.next = (this.next + 1) % this.size;
      return slot;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class IBM842Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "IBM 842";
      this.description = "Fixed-block dictionary compression built for IBM POWER hardware accelerators. Encodes data in 8-byte chunks as a template opcode selecting a mix of literal bytes and back-references into 2/4/8-byte ring-buffer dictionaries. This implementation covers the eight core chunk templates plus end-of-stream and padded-tail handling.";
      this.inventor = "IBM Corporation";
      this.year = 2010;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("Wikipedia - 842 (compression algorithm)", "https://en.wikipedia.org/wiki/842_(compression_algorithm)"),
        new LinkItem("Linux kernel lib/842 reference decoder", "https://github.com/torvalds/linux/tree/master/lib/842")
      ];

      this.references = [
        new LinkItem("plauth/lib842 (userspace/GPU port, format notes)", "https://github.com/plauth/lib842"),
        new LinkItem("Blaner et al., IBM J. Res. Dev. 57(6), 2013", "https://doi.org/10.1147/JRD.2013.2280090")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://en.wikipedia.org/wiki/842_(compression_algorithm)",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte",
          uri: "https://en.wikipedia.org/wiki/842_(compression_algorithm)",
          input: [0x41],
          expected: [1, 0, 0, 0, 58, 8, 0, 0, 0, 0, 0, 0, 7, 192]
        },
        {
          text: "256 repeated bytes",
          uri: "https://github.com/torvalds/linux/tree/master/lib/842",
          input: new Array(256).fill(0x61),
          expected: [0, 1, 0, 0, 59, 11, 11, 11, 11, 11, 11, 11, 8, 0, 0, 2, 0, 32, 1, 128, 16, 0, 160, 6, 0, 56, 2, 0, 18, 0, 160, 5, 128, 48, 1, 160, 14, 0, 120, 4, 0, 34, 1, 32, 9, 128, 80, 2, 160, 22, 0, 184, 6, 0, 50, 1, 160, 13, 128, 112, 3, 160, 30, 248]
        },
        {
          text: "Text sample repeated 4x",
          uri: "https://en.wikipedia.org/wiki/842_(compression_algorithm)",
          input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [180, 0, 0, 0, 59, 163, 67, 41, 3, 139, 171, 75, 25, 218, 200, 24, 156, 155, 221, 219, 136, 14, 204, 222, 240, 64, 212, 234, 218, 224, 119, 50, 6, 247, 102, 87, 34, 7, 67, 180, 50, 144, 54, 48, 189, 60, 144, 29, 145, 189, 156, 184, 129, 209, 161, 148, 228, 14, 46, 173, 44, 109, 100, 12, 71, 114, 111, 119, 110, 32, 102, 111, 120, 57, 3, 83, 171, 107, 131, 153, 3, 121, 157, 153, 92, 136, 0, 14, 216, 194, 244, 242, 64, 200, 222, 206, 114, 226, 7, 70, 134, 82, 7, 23, 82, 1, 130, 2, 131, 16, 28, 32, 36, 40, 129, 97, 129, 161, 194, 11, 17, 18, 32, 152, 160, 169, 225, 15, 70, 6, 70, 136, 54, 56, 58, 60, 65, 242, 2, 18, 34, 17, 146, 18, 150, 144, 184, 160, 164, 168, 237, 236, 229, 196, 0, 0, 0, 0, 31]
        },
        {
          text: "All 256 byte values",
          uri: "https://en.wikipedia.org/wiki/842_(compression_algorithm)",
          input: Array.from({ length: 256 }, (_, i) => i),
          expected: [0, 1, 0, 0, 56, 0, 8, 16, 24, 32, 40, 48, 57, 194, 2, 66, 130, 195, 3, 67, 131, 206, 32, 34, 36, 38, 40, 42, 44, 46, 113, 129, 145, 161, 177, 193, 209, 225, 243, 144, 16, 145, 17, 146, 18, 147, 19, 156, 160, 164, 168, 172, 176, 180, 184, 188, 230, 6, 38, 70, 102, 134, 166, 198, 231, 56, 57, 58, 59, 60, 61, 62, 63, 58, 2, 10, 18, 26, 34, 42, 50, 57, 210, 18, 82, 146, 211, 19, 83, 147, 206, 160, 162, 164, 166, 168, 170, 172, 174, 117, 133, 149, 165, 181, 197, 213, 229, 243, 176, 48, 177, 49, 178, 50, 179, 51, 157, 161, 165, 169, 173, 177, 181, 185, 188, 238, 14, 46, 78, 110, 142, 174, 206, 231, 120, 121, 122, 123, 124, 125, 126, 127, 60, 4, 12, 20, 28, 36, 44, 52, 57, 226, 34, 98, 162, 227, 35, 99, 163, 207, 33, 35, 37, 39, 41, 43, 45, 46, 121, 137, 153, 169, 185, 201, 217, 233, 243, 208, 80, 209, 81, 210, 82, 211, 83, 158, 162, 166, 170, 174, 178, 182, 186, 188, 246, 22, 54, 86, 118, 150, 182, 214, 231, 184, 185, 186, 187, 188, 189, 190, 191, 62, 6, 14, 22, 30, 38, 46, 54, 57, 242, 50, 114, 178, 243, 51, 115, 179, 207, 161, 163, 165, 167, 169, 171, 173, 174, 125, 141, 157, 173, 189, 205, 221, 237, 243, 240, 112, 241, 113, 242, 114, 243, 115, 159, 163, 167, 171, 175, 179, 183, 187, 188, 254, 30, 62, 94, 126, 158, 190, 222, 231, 248, 249, 250, 251, 252, 253, 254, 255, 248]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new IBM842Instance(this, isInverse);
    }
  }

  class IBM842Instance extends IAlgorithmInstance {
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
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (this.isInverse) return this._decompress(data);
      return this._compress(data);
    }

    _compress(input) {
      const n = input.length;
      const out = [];
      const len32 = OpCodes.ToUint32(n);
      out.push(OpCodes.AndN(len32, 0xFF));
      out.push(OpCodes.AndN(OpCodes.Shr32(len32, 8), 0xFF));
      out.push(OpCodes.AndN(OpCodes.Shr32(len32, 16), 0xFF));
      out.push(OpCodes.AndN(OpCodes.Shr32(len32, 24), 0xFF));

      if (n === 0) return out;

      const writer = new BitWriter842();
      const dict2 = new RingDict(DICT2_SIZE);
      const dict4 = new RingDict(DICT4_SIZE);
      const dict8 = new RingDict(DICT8_SIZE);

      let pos = 0;
      while (pos < n) {
        const remaining = n - pos;

        if (remaining >= 8) {
          const v8 = be64Key(input, pos);
          const v4a = be32(input, pos), v4b = be32(input, pos + 4);
          const v2a = be16(input, pos), v2b = be16(input, pos + 2);
          const v2c = be16(input, pos + 4), v2d = be16(input, pos + 6);

          const i8 = dict8.find(v8);
          const i4a = dict4.find(v4a), i4b = dict4.find(v4b);
          const i2a = dict2.find(v2a), i2b = dict2.find(v2b);
          const i2c = dict2.find(v2c), i2d = dict2.find(v2d);

          if (i8 >= 0) {
            writer.writeBits(OP_D8, OPCODE_BITS);
            writer.writeBits(i8, IDX_BITS);
          } else if (i4a >= 0 && i4b >= 0) {
            writer.writeBits(OP_D4D4, OPCODE_BITS);
            writer.writeBits(i4a, IDX_BITS);
            writer.writeBits(i4b, IDX_BITS);
          } else if (i4a >= 0 && i2c >= 0 && i2d >= 0) {
            writer.writeBits(OP_D4D2D2, OPCODE_BITS);
            writer.writeBits(i4a, IDX_BITS);
            writer.writeBits(i2c, IDX_BITS);
            writer.writeBits(i2d, IDX_BITS);
          } else if (i2a >= 0 && i2b >= 0 && i4b >= 0) {
            writer.writeBits(OP_D2D2D4, OPCODE_BITS);
            writer.writeBits(i2a, IDX_BITS);
            writer.writeBits(i2b, IDX_BITS);
            writer.writeBits(i4b, IDX_BITS);
          } else if (i2a >= 0 && i2b >= 0 && i2c >= 0 && i2d >= 0) {
            writer.writeBits(OP_D2D2D2D2, OPCODE_BITS);
            writer.writeBits(i2a, IDX_BITS);
            writer.writeBits(i2b, IDX_BITS);
            writer.writeBits(i2c, IDX_BITS);
            writer.writeBits(i2d, IDX_BITS);
          } else if (i4a >= 0) {
            writer.writeBits(OP_D4L4, OPCODE_BITS);
            writer.writeBits(i4a, IDX_BITS);
            for (let j = 4; j < 8; ++j) writer.writeBits(input[pos + j], 8);
          } else if (i4b >= 0) {
            writer.writeBits(OP_L4D4, OPCODE_BITS);
            for (let j = 0; j < 4; ++j) writer.writeBits(input[pos + j], 8);
            writer.writeBits(i4b, IDX_BITS);
          } else {
            writer.writeBits(OP_L8, OPCODE_BITS);
            for (let j = 0; j < 8; ++j) writer.writeBits(input[pos + j], 8);
          }

          dict8.insert(v8);
          dict4.insert(v4a);
          dict4.insert(v4b);
          dict2.insert(v2a);
          dict2.insert(v2b);
          dict2.insert(v2c);
          dict2.insert(v2d);

          pos += 8;
        } else {
          // Trailing partial chunk: literal template, zero-padded to 8 bytes.
          // The reference does not update the dictionaries for this tail chunk.
          writer.writeBits(OP_L8, OPCODE_BITS);
          for (let j = 0; j < 8; ++j) writer.writeBits(j < remaining ? input[pos + j] : 0, 8);
          pos += remaining;
        }
      }

      writer.writeBits(OP_END, OPCODE_BITS);
      const body = writer.flush();
      for (let i = 0; i < body.length; ++i) out.push(body[i]);
      return out;
    }

    _decompress(input) {
      if (input.length < 4) return [];
      const originalSize = OpCodes.OrN(
        OpCodes.OrN(OpCodes.OrN(input[0], OpCodes.Shl32(input[1], 8)), OpCodes.Shl32(input[2], 16)),
        OpCodes.Shl32(input[3], 24)
      );
      if (originalSize === 0) return [];

      const reader = new BitReader842(input.slice(4));

      // Reverse dictionaries: slot index -> value (no reverse-lookup needed).
      const dict2 = new Array(DICT2_SIZE);
      const dict4 = new Array(DICT4_SIZE);
      const dict8 = new Array(DICT8_SIZE);
      let dict2Next = 0, dict4Next = 0, dict8Next = 0;

      const result = [];

      const put16 = (chunk, offset, value) => {
        chunk[offset] = OpCodes.AndN(OpCodes.Shr32(value, 8), 0xFF);
        chunk[offset + 1] = OpCodes.AndN(value, 0xFF);
      };
      const put32 = (chunk, offset, value) => {
        chunk[offset] = OpCodes.AndN(OpCodes.Shr32(value, 24), 0xFF);
        chunk[offset + 1] = OpCodes.AndN(OpCodes.Shr32(value, 16), 0xFF);
        chunk[offset + 2] = OpCodes.AndN(OpCodes.Shr32(value, 8), 0xFF);
        chunk[offset + 3] = OpCodes.AndN(value, 0xFF);
      };

      while (result.length < originalSize) {
        const op = reader.readBits(OPCODE_BITS);
        if (op === OP_END) break;

        const chunk = new Array(8).fill(0);

        if (op === OP_D8) {
          const idx = reader.readBits(IDX_BITS);
          const value = dict8[idx];
          if (value === undefined) throw new Error('842: invalid 8-byte dictionary reference');
          const [hi, lo] = value.split(':').map(Number);
          put32(chunk, 0, hi);
          put32(chunk, 4, lo);
        } else if (op === OP_D4D4) {
          const ia = reader.readBits(IDX_BITS), ib = reader.readBits(IDX_BITS);
          if (dict4[ia] === undefined || dict4[ib] === undefined) throw new Error('842: invalid 4-byte dictionary reference');
          put32(chunk, 0, dict4[ia]);
          put32(chunk, 4, dict4[ib]);
        } else if (op === OP_D4D2D2) {
          const ia = reader.readBits(IDX_BITS), ic = reader.readBits(IDX_BITS), id = reader.readBits(IDX_BITS);
          if (dict4[ia] === undefined || dict2[ic] === undefined || dict2[id] === undefined) throw new Error('842: invalid dictionary reference');
          put32(chunk, 0, dict4[ia]);
          put16(chunk, 4, dict2[ic]);
          put16(chunk, 6, dict2[id]);
        } else if (op === OP_D2D2D4) {
          const ia = reader.readBits(IDX_BITS), ib = reader.readBits(IDX_BITS), ic = reader.readBits(IDX_BITS);
          if (dict2[ia] === undefined || dict2[ib] === undefined || dict4[ic] === undefined) throw new Error('842: invalid dictionary reference');
          put16(chunk, 0, dict2[ia]);
          put16(chunk, 2, dict2[ib]);
          put32(chunk, 4, dict4[ic]);
        } else if (op === OP_D2D2D2D2) {
          const idx = [reader.readBits(IDX_BITS), reader.readBits(IDX_BITS), reader.readBits(IDX_BITS), reader.readBits(IDX_BITS)];
          for (let g = 0; g < 4; ++g) {
            if (dict2[idx[g]] === undefined) throw new Error('842: invalid 2-byte dictionary reference');
            put16(chunk, g * 2, dict2[idx[g]]);
          }
        } else if (op === OP_D4L4) {
          const ia = reader.readBits(IDX_BITS);
          if (dict4[ia] === undefined) throw new Error('842: invalid 4-byte dictionary reference');
          put32(chunk, 0, dict4[ia]);
          for (let j = 4; j < 8; ++j) chunk[j] = reader.readBits(8);
        } else if (op === OP_L4D4) {
          for (let j = 0; j < 4; ++j) chunk[j] = reader.readBits(8);
          const ib = reader.readBits(IDX_BITS);
          if (dict4[ib] === undefined) throw new Error('842: invalid 4-byte dictionary reference');
          put32(chunk, 4, dict4[ib]);
        } else if (op === OP_L8) {
          for (let j = 0; j < 8; ++j) chunk[j] = reader.readBits(8);
        } else {
          throw new Error(`842: unsupported template opcode ${op}`);
        }

        // Update dictionaries from the decoded chunk (mirrors the reference,
        // which always refreshes them - harmless for the padded tail chunk
        // since no further chunks follow it).
        const v8 = be64Key(chunk, 0);
        const v4a = be32(chunk, 0), v4b = be32(chunk, 4);
        const v2a = be16(chunk, 0), v2b = be16(chunk, 2), v2c = be16(chunk, 4), v2d = be16(chunk, 6);

        dict8[dict8Next] = v8; dict8Next = (dict8Next + 1) % DICT8_SIZE;
        dict4[dict4Next] = v4a; dict4Next = (dict4Next + 1) % DICT4_SIZE;
        dict4[dict4Next] = v4b; dict4Next = (dict4Next + 1) % DICT4_SIZE;
        dict2[dict2Next] = v2a; dict2Next = (dict2Next + 1) % DICT2_SIZE;
        dict2[dict2Next] = v2b; dict2Next = (dict2Next + 1) % DICT2_SIZE;
        dict2[dict2Next] = v2c; dict2Next = (dict2Next + 1) % DICT2_SIZE;
        dict2[dict2Next] = v2d; dict2Next = (dict2Next + 1) % DICT2_SIZE;

        const toAdd = Math.min(8, originalSize - result.length);
        for (let j = 0; j < toAdd; ++j) result.push(chunk[j]);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new IBM842Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { IBM842Compression, IBM842Instance };
}));
