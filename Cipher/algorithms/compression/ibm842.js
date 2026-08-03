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
 * separate ring-buffer dictionaries that hold recently seen 2-, 4- and 8-byte
 * values (a hash/value dictionary, not an LZ77 sliding-window offset).
 *
 * This implementation reproduces the documented block structure (5-bit MSB-first
 * template opcode, 8/9/8-bit dictionary indices for the 2/4/8-byte ring buffers,
 * a 3-bit length field for the final partial-chunk "short data" tail template)
 * and a representative subset of the full 26-entry template table sufficient for
 * a self-consistent, always-invertible encoder/decoder pair: full-literal, full
 * 8-byte reference, two 4-byte references, four 2-byte references, and the two
 * 4+4 literal/reference mixes. The complete permutation table (all 26 templates)
 * and the optional OP_REPEAT/OP_ZEROS run-length templates from the reference
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

  // ===== TEMPLATE OPCODES (5-bit, subset of the 26-entry reference table) =====

  const TPL_LIT8       = 0;  // 8 literal bytes
  const TPL_REF8        = 1;  // one 8-byte dictionary reference
  const TPL_REF4_REF4   = 2;  // two 4-byte dictionary references
  const TPL_REF2x4      = 3;  // four 2-byte dictionary references
  const TPL_REF4_LIT4   = 4;  // 4-byte reference + 4 literal bytes
  const TPL_LIT4_REF4   = 5;  // 4 literal bytes + 4-byte reference
  const TPL_END         = 6;  // end of stream
  const TPL_SHORT       = 7;  // tail template: 3-bit length (1..7) + literal bytes

  const OPCODE_BITS = 5;
  const IDX2_BITS = 8;   // 256-entry 2-byte dictionary
  const IDX4_BITS = 9;   // 512-entry 4-byte dictionary
  const IDX8_BITS = 8;   // 256-entry 8-byte dictionary
  const SHORT_LEN_BITS = 3;

  const DICT2_SIZE = OpCodes.Shl32(1, IDX2_BITS);
  const DICT4_SIZE = OpCodes.Shl32(1, IDX4_BITS);
  const DICT8_SIZE = OpCodes.Shl32(1, IDX8_BITS);

  // Ring-buffer value dictionary shared shape for the 2/4/8-byte tables
  class RingDict {
    constructor(size, width) {
      this.size = size;
      this.width = width;
      this.slots = new Array(size).fill(null);
      this.next = 0;
    }

    find(bytes, offset) {
      for (let i = 0; i < this.size; ++i) {
        const slot = this.slots[i];
        if (!slot) continue;
        let match = true;
        for (let j = 0; j < this.width; ++j) {
          if (slot[j] !== bytes[offset + j]) { match = false; break; }
        }
        if (match) return i;
      }
      return -1;
    }

    insert(bytes, offset) {
      const value = new Array(this.width);
      for (let j = 0; j < this.width; ++j) value[j] = bytes[offset + j];
      this.slots[this.next] = value;
      this.next = (this.next + 1) % this.size;
    }

    get(index) {
      return this.slots[index];
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class IBM842Compression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "IBM 842";
      this.description = "Fixed-block dictionary compression built for IBM POWER hardware accelerators. Encodes data in 8-byte chunks as a template opcode selecting a mix of literal bytes and back-references into 2/4/8-byte ring-buffer dictionaries. This implementation covers a representative subset of the documented template table.";
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
          expected: [48]
        },
        {
          text: "Single byte tail-only chunk",
          uri: "https://en.wikipedia.org/wiki/842_(compression_algorithm)",
          input: [65],
          expected: [56, 65, 48]
        },
        {
          text: "Repeated 8-byte pattern (dictionary hits)",
          uri: "https://github.com/torvalds/linux/tree/master/lib/842",
          input: [1,2,3,4,5,6,7,8, 1,2,3,4,5,6,7,8, 1,2,3,4,5,6,7,8],
          expected: [0,8,16,24,32,40,48,56,64,64,2,0,96]
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
      this.inputBuffer.push(...data);
    }

    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (this.isInverse) return this._decompress(data);
      return this._compress(data);
    }

    _compress(input) {
      const writer = new BitWriter842();
      const dict2 = new RingDict(DICT2_SIZE, 2);
      const dict4 = new RingDict(DICT4_SIZE, 4);
      const dict8 = new RingDict(DICT8_SIZE, 8);

      let pos = 0;
      const fullChunks = Math.floor(input.length / 8);

      for (let c = 0; c < fullChunks; ++c) {
        this._encodeChunk(input, pos, writer, dict2, dict4, dict8);
        this._updateDictionaries(input, pos, dict2, dict4, dict8);
        pos += 8;
      }

      const remaining = input.length - pos;
      if (remaining > 0) {
        writer.writeBits(TPL_SHORT, OPCODE_BITS);
        writer.writeBits(remaining - 1, SHORT_LEN_BITS);
        for (let i = 0; i < remaining; ++i) writer.writeBits(input[pos + i], 8);
      }

      writer.writeBits(TPL_END, OPCODE_BITS);
      return writer.flush();
    }

    _encodeChunk(input, pos, writer, dict2, dict4, dict8) {
      const ref8 = dict8.find(input, pos);
      if (ref8 >= 0) {
        writer.writeBits(TPL_REF8, OPCODE_BITS);
        writer.writeBits(ref8, IDX8_BITS);
        return;
      }

      const ref4a = dict4.find(input, pos);
      const ref4b = dict4.find(input, pos + 4);
      if (ref4a >= 0 && ref4b >= 0) {
        writer.writeBits(TPL_REF4_REF4, OPCODE_BITS);
        writer.writeBits(ref4a, IDX4_BITS);
        writer.writeBits(ref4b, IDX4_BITS);
        return;
      }

      const r2 = [dict2.find(input, pos), dict2.find(input, pos + 2), dict2.find(input, pos + 4), dict2.find(input, pos + 6)];
      if (r2[0] >= 0 && r2[1] >= 0 && r2[2] >= 0 && r2[3] >= 0) {
        writer.writeBits(TPL_REF2x4, OPCODE_BITS);
        for (let i = 0; i < 4; ++i) writer.writeBits(r2[i], IDX2_BITS);
        return;
      }

      if (ref4a >= 0) {
        writer.writeBits(TPL_REF4_LIT4, OPCODE_BITS);
        writer.writeBits(ref4a, IDX4_BITS);
        for (let i = 4; i < 8; ++i) writer.writeBits(input[pos + i], 8);
        return;
      }

      if (ref4b >= 0) {
        writer.writeBits(TPL_LIT4_REF4, OPCODE_BITS);
        for (let i = 0; i < 4; ++i) writer.writeBits(input[pos + i], 8);
        writer.writeBits(ref4b, IDX4_BITS);
        return;
      }

      writer.writeBits(TPL_LIT8, OPCODE_BITS);
      for (let i = 0; i < 8; ++i) writer.writeBits(input[pos + i], 8);
    }

    _updateDictionaries(bytes, pos, dict2, dict4, dict8) {
      dict2.insert(bytes, pos);
      dict2.insert(bytes, pos + 2);
      dict2.insert(bytes, pos + 4);
      dict2.insert(bytes, pos + 6);
      dict4.insert(bytes, pos);
      dict4.insert(bytes, pos + 4);
      dict8.insert(bytes, pos);
    }

    _decompress(input) {
      const reader = new BitReader842(input);
      const dict2 = new RingDict(DICT2_SIZE, 2);
      const dict4 = new RingDict(DICT4_SIZE, 4);
      const dict8 = new RingDict(DICT8_SIZE, 8);
      const output = [];

      for (;;) {
        const op = reader.readBits(OPCODE_BITS);

        if (op === TPL_END) break;

        if (op === TPL_SHORT) {
          const len = reader.readBits(SHORT_LEN_BITS) + 1;
          for (let i = 0; i < len; ++i) output.push(reader.readBits(8));
          continue;
        }

        const chunk = new Array(8);

        if (op === TPL_REF8) {
          const idx = reader.readBits(IDX8_BITS);
          const value = dict8.get(idx);
          if (!value) throw new Error('842: invalid 8-byte dictionary reference');
          for (let i = 0; i < 8; ++i) chunk[i] = value[i];
        } else if (op === TPL_REF4_REF4) {
          const idxA = reader.readBits(IDX4_BITS);
          const idxB = reader.readBits(IDX4_BITS);
          const a = dict4.get(idxA), b = dict4.get(idxB);
          if (!a || !b) throw new Error('842: invalid 4-byte dictionary reference');
          for (let i = 0; i < 4; ++i) { chunk[i] = a[i]; chunk[4 + i] = b[i]; }
        } else if (op === TPL_REF2x4) {
          for (let g = 0; g < 4; ++g) {
            const idx = reader.readBits(IDX2_BITS);
            const value = dict2.get(idx);
            if (!value) throw new Error('842: invalid 2-byte dictionary reference');
            chunk[g * 2] = value[0];
            chunk[g * 2 + 1] = value[1];
          }
        } else if (op === TPL_REF4_LIT4) {
          const idx = reader.readBits(IDX4_BITS);
          const a = dict4.get(idx);
          if (!a) throw new Error('842: invalid 4-byte dictionary reference');
          for (let i = 0; i < 4; ++i) chunk[i] = a[i];
          for (let i = 4; i < 8; ++i) chunk[i] = reader.readBits(8);
        } else if (op === TPL_LIT4_REF4) {
          for (let i = 0; i < 4; ++i) chunk[i] = reader.readBits(8);
          const idx = reader.readBits(IDX4_BITS);
          const b = dict4.get(idx);
          if (!b) throw new Error('842: invalid 4-byte dictionary reference');
          for (let i = 0; i < 4; ++i) chunk[4 + i] = b[i];
        } else if (op === TPL_LIT8) {
          for (let i = 0; i < 8; ++i) chunk[i] = reader.readBits(8);
        } else {
          throw new Error(`842: unsupported template opcode ${op}`);
        }

        for (let i = 0; i < 8; ++i) output.push(chunk[i]);
        this._updateDictionaries(chunk, 0, dict2, dict4, dict8);
      }

      return output;
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
