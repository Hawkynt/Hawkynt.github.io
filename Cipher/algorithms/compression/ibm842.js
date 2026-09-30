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
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.cur = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {uint32} value - Value
     * @param {int32} width - Number of bits, most significant first
     */
    writeBits(value, width) {
      for (let i = width - 1; i >= 0; --i) {
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        this.cur = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(this.cur, 1), bit), 0xFF);
        this.nBits++;
        if (this.nBits === 8) {
          this.bytes.push(this.cur);
          this.cur = 0;
          this.nBits = 0;
        }
      }
    }

    /**
     * @returns {uint8[]} All bytes, the last one zero-padded
     */
    flush() {
      if (this.nBits > 0) {
        /** @type {int32} */
        const pad = 8 - this.nBits;
        this.cur = OpCodes.And32(OpCodes.Shl32(this.cur, pad), 0xFF);
        this.bytes.push(this.cur);
        this.cur = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader842 {
    /**
     * @param {uint8[]} bytes - Source bytes
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint32} */
      this.cur = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {int32} width - Number of bits, most significant first
     * @returns {uint32} Value read
     */
    readBits(width) {
      /** @type {uint32} */
      let value = 0;
      for (let i = 0; i < width; ++i) {
        if (this.nBits === 0) {
          if (this.pos >= this.bytes.length) {
            throw new Error('842: unexpected end of stream');
          }
          this.cur = this.bytes[this.pos++];
          this.nBits = 8;
        }
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(this.cur, 7), 1);
        this.cur = OpCodes.And32(OpCodes.Shl32(this.cur, 1), 0xFF);
        this.nBits--;
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), bit);
      }
      return value;
    }
  }

  // ===== TEMPLATE OPCODES (5-bit) =====
  // Mirrors CompressionWorkbench's Ibm842BuildingBlock template numbering.

  /** @type {int32} */
  const OP_D8         = 0x00; // one 8-byte dictionary reference
  /** @type {int32} */
  const OP_D4D4        = 0x01; // two 4-byte dictionary references
  /** @type {int32} */
  const OP_D4D2D2       = 0x02; // 4-byte ref + two 2-byte refs (covering bytes 4..8)
  /** @type {int32} */
  const OP_D2D2D4       = 0x03; // two 2-byte refs (covering bytes 0..4) + 4-byte ref
  /** @type {int32} */
  const OP_D2D2D2D2      = 0x04; // four 2-byte dictionary references
  /** @type {int32} */
  const OP_D4L4         = 0x05; // 4-byte ref + 4 literal bytes
  /** @type {int32} */
  const OP_L4D4         = 0x06; // 4 literal bytes + 4-byte ref
  /** @type {int32} */
  const OP_L8          = 0x07; // 8 literal bytes
  /** @type {int32} */
  const OP_END         = 0x1F; // end of stream

  /** @type {int32} */
  const OPCODE_BITS = 5;
  /** @type {int32} */
  const IDX_BITS = 8; // all three ring buffers hold 256 entries

  /** @type {int32} */
  const DICT2_SIZE = 256;
  /** @type {int32} */
  const DICT4_SIZE = 256;
  /** @type {int32} */
  const DICT8_SIZE = 256;

  // Big-endian field readers built from arithmetic only (no raw bit operators).
  /**
   * @param {uint8[]} bytes - Bytes
   * @param {int32} offset - Position of the field
   * @returns {uint32} Big-endian 16-bit value
   */
  function be16(bytes, offset) {
    return OpCodes.Or32(OpCodes.Shl32(bytes[offset], 8), bytes[offset + 1]);
  }

  /**
   * @param {uint8[]} bytes - Bytes
   * @param {int32} offset - Position of the field
   * @returns {uint32} Big-endian 32-bit value
   */
  function be32(bytes, offset) {
    return OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(bytes[offset], 24), OpCodes.Shl32(bytes[offset + 1], 16)),
      OpCodes.Or32(OpCodes.Shl32(bytes[offset + 2], 8), bytes[offset + 3])
    );
  }

  // Ring-buffer value dictionary: maps recently-seen N-byte values to their
  // circular slot index, evicting the value that previously occupied a slot
  // when it is overwritten (mirrors the reference's Dictionary+reverse-array
  // eviction, including that a duplicate value inserted at a later slot can
  // shadow an older slot holding the same value). A value is a pair of 32-bit
  // halves (the high half is 0 for 2- and 4-byte values); "mapped" marks the
  // one slot the value -> slot map points at, if any.
  class RingDict {
    /**
     * @param {int32} size - Number of slots
     */
    constructor(size) {
      /** @type {int32} */
      this.size = size;
      /** @type {uint32[]} */
      this.hi = new Array(size);
      /** @type {uint32[]} */
      this.lo = new Array(size);
      /** @type {boolean[]} */
      this.used = new Array(size);
      /** @type {boolean[]} */
      this.mapped = new Array(size);
      for (let i = 0; i < size; i++) {
        this.hi[i] = 0;
        this.lo[i] = 0;
        this.used[i] = false;
        this.mapped[i] = false;
      }
      /** @type {int32} */
      this.next = 0;
    }

    /**
     * @param {uint32} hi - High half of the value
     * @param {uint32} lo - Low half of the value
     * @returns {int32} Slot the value maps to, or -1
     */
    find(hi, lo) {
      for (let s = 0; s < this.size; s++) {
        if (this.mapped[s] && this.hi[s] === hi && this.lo[s] === lo) {
          return s;
        }
      }
      return -1;
    }

    /**
     * @param {uint32} hi - High half of the value
     * @param {uint32} lo - Low half of the value
     * @returns {int32} Slot written
     */
    insert(hi, lo) {
      /** @type {int32} */
      const slot = this.next;
      if (this.used[slot]) {
        // forget the evicted value, wherever its mapping points
        /** @type {int32} */
        const oldMapped = this.find(this.hi[slot], this.lo[slot]);
        if (oldMapped >= 0) {
          this.mapped[oldMapped] = false;
        }
      }
      // the value now maps to this slot only
      /** @type {int32} */
      const previous = this.find(hi, lo);
      if (previous >= 0) {
        this.mapped[previous] = false;
      }
      this.hi[slot] = hi;
      this.lo[slot] = lo;
      this.used[slot] = true;
      this.mapped[slot] = true;
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

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {IBM842Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new IBM842Instance(this, isInverse);
    }
  }

  /**
   * Slot-indexed value store of the decoder (value halves plus a presence flag)
   */
  class SlotValues {
    /**
     * @param {int32} size - Number of slots
     */
    constructor(size) {
      /** @type {uint32[]} */
      this.hi = new Array(size);
      /** @type {uint32[]} */
      this.lo = new Array(size);
      /** @type {boolean[]} */
      this.present = new Array(size);
      for (let i = 0; i < size; i++) {
        this.hi[i] = 0;
        this.lo[i] = 0;
        this.present[i] = false;
      }
      /** @type {int32} */
      this.size = size;
      /** @type {int32} */
      this.next = 0;
    }

    /**
     * @param {uint32} hi - High half of the value
     * @param {uint32} lo - Low half of the value
     */
    push(hi, lo) {
      this.hi[this.next] = hi;
      this.lo[this.next] = lo;
      this.present[this.next] = true;
      this.next = (this.next + 1) % this.size;
    }
  }

  class IBM842Instance extends IAlgorithmInstance {
    /**
     * @param {IBM842Compression} algorithm - Parent algorithm
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
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      if (this.isInverse) {
        return this._decompress(data);
      }
      return this._compress(data);
    }

    /**
     * @param {BitWriter842} writer - Output bits
     * @param {uint8[]} input - Source bytes
     * @param {int32} start - First literal
     * @param {int32} count - Number of literals
     */
    _writeLiterals(writer, input, start, count) {
      for (let j = 0; j < count; ++j) {
        writer.writeBits(input[start + j], 8);
      }
    }

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Size header and template stream
     */
    _compress(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const out = [];
      /** @type {uint32} */
      const len32 = OpCodes.ToUint32(n);
      out.push(OpCodes.And32(len32, 0xFF));
      out.push(OpCodes.And32(OpCodes.Shr32(len32, 8), 0xFF));
      out.push(OpCodes.And32(OpCodes.Shr32(len32, 16), 0xFF));
      out.push(OpCodes.And32(OpCodes.Shr32(len32, 24), 0xFF));

      if (n === 0) {
        return out;
      }

      /** @type {BitWriter842} */
      const writer = new BitWriter842();
      /** @type {RingDict} */
      const dict2 = new RingDict(DICT2_SIZE);
      /** @type {RingDict} */
      const dict4 = new RingDict(DICT4_SIZE);
      /** @type {RingDict} */
      const dict8 = new RingDict(DICT8_SIZE);

      /** @type {int32} */
      let pos = 0;
      while (pos < n) {
        /** @type {int32} */
        const remaining = n - pos;

        if (remaining >= 8) {
          /** @type {uint32} */
          const v4a = be32(input, pos);
          /** @type {uint32} */
          const v4b = be32(input, pos + 4);
          /** @type {uint32} */
          const v2a = be16(input, pos);
          /** @type {uint32} */
          const v2b = be16(input, pos + 2);
          /** @type {uint32} */
          const v2c = be16(input, pos + 4);
          /** @type {uint32} */
          const v2d = be16(input, pos + 6);

          /** @type {int32} */
          const i8 = dict8.find(v4a, v4b);
          /** @type {int32} */
          const i4a = dict4.find(0, v4a);
          /** @type {int32} */
          const i4b = dict4.find(0, v4b);
          /** @type {int32} */
          const i2a = dict2.find(0, v2a);
          /** @type {int32} */
          const i2b = dict2.find(0, v2b);
          /** @type {int32} */
          const i2c = dict2.find(0, v2c);
          /** @type {int32} */
          const i2d = dict2.find(0, v2d);

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
            this._writeLiterals(writer, input, pos + 4, 4);
          } else if (i4b >= 0) {
            writer.writeBits(OP_L4D4, OPCODE_BITS);
            this._writeLiterals(writer, input, pos, 4);
            writer.writeBits(i4b, IDX_BITS);
          } else {
            writer.writeBits(OP_L8, OPCODE_BITS);
            this._writeLiterals(writer, input, pos, 8);
          }

          dict8.insert(v4a, v4b);
          dict4.insert(0, v4a);
          dict4.insert(0, v4b);
          dict2.insert(0, v2a);
          dict2.insert(0, v2b);
          dict2.insert(0, v2c);
          dict2.insert(0, v2d);

          pos += 8;
        } else {
          // Trailing partial chunk: literal template, zero-padded to 8 bytes.
          // The reference does not update the dictionaries for this tail chunk.
          writer.writeBits(OP_L8, OPCODE_BITS);
          for (let j = 0; j < 8; ++j) {
            writer.writeBits(j < remaining ? input[pos + j] : 0, 8);
          }
          pos += remaining;
        }
      }

      writer.writeBits(OP_END, OPCODE_BITS);
      /** @type {uint8[]} */
      const body = writer.flush();
      for (let i = 0; i < body.length; ++i) {
        out.push(body[i]);
      }
      return out;
    }

    /**
     * @param {BitReader842} reader - Input bits
     * @returns {uint8} Next 8-bit field
     */
    _readByte(reader) {
      /** @type {uint8} */
      const value = reader.readBits(8);
      return value;
    }

    /**
     * @param {uint8[]} chunk - Eight output bytes
     * @param {int32} offset - Position of the field
     * @param {uint32} value - 16-bit value written big-endian
     */
    _put16(chunk, offset, value) {
      chunk[offset] = OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF);
      chunk[offset + 1] = OpCodes.And32(value, 0xFF);
    }

    /**
     * @param {uint8[]} chunk - Eight output bytes
     * @param {int32} offset - Position of the field
     * @param {uint32} value - 32-bit value written big-endian
     */
    _put32(chunk, offset, value) {
      chunk[offset] = OpCodes.And32(OpCodes.Shr32(value, 24), 0xFF);
      chunk[offset + 1] = OpCodes.And32(OpCodes.Shr32(value, 16), 0xFF);
      chunk[offset + 2] = OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF);
      chunk[offset + 3] = OpCodes.And32(value, 0xFF);
    }

    /**
     * @param {uint8[]} input - Size header and template stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      /** @type {uint8[]} */
      const result = [];
      if (input.length < 4) {
        return result;
      }
      // The size is read as a signed 32-bit value, as in the reference.
      /** @type {int32} */
      const originalSize = OpCodes.ToInt(OpCodes.Or32(
        OpCodes.Or32(OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)), OpCodes.Shl32(input[2], 16)),
        OpCodes.Shl32(input[3], 24)
      ));
      if (originalSize === 0) {
        return result;
      }

      /** @type {BitReader842} */
      const reader = new BitReader842(input.slice(4));

      // Reverse dictionaries: slot index -> value (no reverse-lookup needed).
      /** @type {SlotValues} */
      const dict2 = new SlotValues(DICT2_SIZE);
      /** @type {SlotValues} */
      const dict4 = new SlotValues(DICT4_SIZE);
      /** @type {SlotValues} */
      const dict8 = new SlotValues(DICT8_SIZE);

      while (result.length < originalSize) {
        /** @type {uint32} */
        const op = reader.readBits(OPCODE_BITS);
        if (op === OP_END) {
          break;
        }

        /** @type {uint8[]} */
        const chunk = [0, 0, 0, 0, 0, 0, 0, 0];

        if (op === OP_D8) {
          /** @type {uint32} */
          const idx = reader.readBits(IDX_BITS);
          if (!dict8.present[idx]) {
            throw new Error('842: invalid 8-byte dictionary reference');
          }
          this._put32(chunk, 0, dict8.hi[idx]);
          this._put32(chunk, 4, dict8.lo[idx]);
        } else if (op === OP_D4D4) {
          /** @type {uint32} */
          const ia = reader.readBits(IDX_BITS);
          /** @type {uint32} */
          const ib = reader.readBits(IDX_BITS);
          if (!dict4.present[ia] || !dict4.present[ib]) {
            throw new Error('842: invalid 4-byte dictionary reference');
          }
          this._put32(chunk, 0, dict4.lo[ia]);
          this._put32(chunk, 4, dict4.lo[ib]);
        } else if (op === OP_D4D2D2) {
          /** @type {uint32} */
          const ia = reader.readBits(IDX_BITS);
          /** @type {uint32} */
          const ic = reader.readBits(IDX_BITS);
          /** @type {uint32} */
          const id = reader.readBits(IDX_BITS);
          if (!dict4.present[ia] || !dict2.present[ic] || !dict2.present[id]) {
            throw new Error('842: invalid dictionary reference');
          }
          this._put32(chunk, 0, dict4.lo[ia]);
          this._put16(chunk, 4, dict2.lo[ic]);
          this._put16(chunk, 6, dict2.lo[id]);
        } else if (op === OP_D2D2D4) {
          /** @type {uint32} */
          const ia = reader.readBits(IDX_BITS);
          /** @type {uint32} */
          const ib = reader.readBits(IDX_BITS);
          /** @type {uint32} */
          const ic = reader.readBits(IDX_BITS);
          if (!dict2.present[ia] || !dict2.present[ib] || !dict4.present[ic]) {
            throw new Error('842: invalid dictionary reference');
          }
          this._put16(chunk, 0, dict2.lo[ia]);
          this._put16(chunk, 2, dict2.lo[ib]);
          this._put32(chunk, 4, dict4.lo[ic]);
        } else if (op === OP_D2D2D2D2) {
          /** @type {uint32[]} */
          const idx = [0, 0, 0, 0];
          for (let g = 0; g < 4; ++g) {
            /** @type {uint32} */
            const index = reader.readBits(IDX_BITS);
            idx[g] = index;
          }
          for (let g = 0; g < 4; ++g) {
            if (!dict2.present[idx[g]]) {
              throw new Error('842: invalid 2-byte dictionary reference');
            }
            this._put16(chunk, g * 2, dict2.lo[idx[g]]);
          }
        } else if (op === OP_D4L4) {
          /** @type {uint32} */
          const ia = reader.readBits(IDX_BITS);
          if (!dict4.present[ia]) {
            throw new Error('842: invalid 4-byte dictionary reference');
          }
          this._put32(chunk, 0, dict4.lo[ia]);
          for (let j = 4; j < 8; ++j) {
            chunk[j] = this._readByte(reader);
          }
        } else if (op === OP_L4D4) {
          for (let j = 0; j < 4; ++j) {
            chunk[j] = this._readByte(reader);
          }
          /** @type {uint32} */
          const ib = reader.readBits(IDX_BITS);
          if (!dict4.present[ib]) {
            throw new Error('842: invalid 4-byte dictionary reference');
          }
          this._put32(chunk, 4, dict4.lo[ib]);
        } else if (op === OP_L8) {
          for (let j = 0; j < 8; ++j) {
            chunk[j] = this._readByte(reader);
          }
        } else {
          throw new Error('842: unsupported template opcode ' + op);
        }

        // Update dictionaries from the decoded chunk (mirrors the reference,
        // which always refreshes them - harmless for the padded tail chunk
        // since no further chunks follow it).
        /** @type {uint32} */
        const v4a = be32(chunk, 0);
        /** @type {uint32} */
        const v4b = be32(chunk, 4);

        dict8.push(v4a, v4b);
        dict4.push(0, v4a);
        dict4.push(0, v4b);
        dict2.push(0, be16(chunk, 0));
        dict2.push(0, be16(chunk, 2));
        dict2.push(0, be16(chunk, 4));
        dict2.push(0, be16(chunk, 6));

        /** @type {int32} */
        const toAdd = Math.min(8, originalSize - result.length);
        for (let j = 0; j < toAdd; ++j) {
          result.push(chunk[j]);
        }
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
