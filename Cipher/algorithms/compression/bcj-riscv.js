/*
 * BCJ RISC-V Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for RISC-V code: rewrites
 * the byte-relative immediates of JAL (Jump and Link) instructions - and of
 * AUIPC-led pc-relative register pairs - into an absolute form so an
 * LZ-family compressor can find more repeated byte sequences across
 * near-identical call and jump instructions.
 * Spec/origin: Lasse Collin / Tukaani Project, liblzma RISC-V filter, added in
 * xz-utils 5.6.0 (2024). Only JAL with rd = x1 (ra) or rd = x5 (t0) - the
 * calling-convention link registers - is rewritten, matching the reference
 * filter exactly; JAL with any other rd (e.g. plain unconditional jumps with
 * rd = x0) is left untouched. The AUIPC register-pair form is also
 * implemented, including its bijective "fake" encoding for AUIPC rd = x0/x2,
 * needed so the filter never loses information on arbitrary binary data.
 * Instruction encoding: The RISC-V Instruction Set Manual, Volume I: Unprivileged
 * ISA, J-type instruction format (JAL) and U-type format (AUIPC).
 * References:
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c
 *   https://github.com/riscv/riscv-isa-manual
 * (c)2006-2025 Hawkynt
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
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ----- RISC-V BCJ core -----
  // Faithful port of liblzma's riscv.c riscv_encode/riscv_decode (xz 5.6,
  // 0BSD license), as reproduced by CompressionWorkbench's
  // BcjFilter.RiscVEncode/RiscVDecode - the authoritative reference for this
  // filter's exact byte-level behavior. Two distinct instruction shapes are
  // rewritten:
  //  - JAL with rd = x1 (ra) or rd = x5 (t0): the byte-relative 21-bit
  //    J-type immediate is rewritten to an absolute byte address.
  //  - AUIPC + a second word forming a pc-relative register pair: rewritten
  //    to a canonical absolute form (with a bijective "fake" encoding for
  //    AUIPC rd = x0/x2, needed so the filter never loses information on
  //    data that only coincidentally looks like this instruction pair).
  // All arithmetic is unsigned 32-bit with wraparound, matching the C
  // reference; NotAuipcPair/NotSpecialAuipc are the same bit-trick guards
  // used there to recognize which of the two AUIPC forms is present.

  function _riscvReadLE(data, pos) {
    return OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
  }
  function _riscvReadBE(data, pos) {
    return OpCodes.Pack32BE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
  }
  function _riscvWriteLE(data, pos, value) {
    const b = OpCodes.Unpack32LE(value);
    data[pos] = b[0]; data[pos + 1] = b[1]; data[pos + 2] = b[2]; data[pos + 3] = b[3];
  }
  function _riscvWriteBE(data, pos, value) {
    const b = OpCodes.Unpack32BE(value);
    data[pos] = b[0]; data[pos + 1] = b[1]; data[pos + 2] = b[2]; data[pos + 3] = b[3];
  }

  // Combines auipc shifted left 8 bits, XORed with (inst2 - 3), masked to
  // 0xF8003; a non-zero result means this is not a valid AUIPC pair.
  function _riscvNotAuipcPair(auipc, inst2) {
    const left = OpCodes.Shl32(auipc, 8);
    const right = OpCodes.ToUint32(inst2 - 3);
    return OpCodes.And32(OpCodes.Xor32(left, right), 0xF8003);
  }

  // Compares (auipc - 0x3117) shifted left 18 bits against rs1 masked to
  // 0x1D; true means this is not the special bijective AUIPC form.
  function _riscvNotSpecialAuipc(auipc, rs1) {
    const left = OpCodes.Shl32(OpCodes.ToUint32(auipc - 0x3117), 18);
    const right = OpCodes.And32(rs1, 0x1D);
    return left >= right;
  }

  function _riscvEncode(bytes) {
    const data = bytes.slice();
    const n = data.length;
    if (n < 8) return data;

    const size = n - 8;
    let i = 0;
    while (i <= size) {
      let advance = 2;
      const b0 = data[i];

      if (b0 === 0xEF) {
        const b1 = data[i + 1];
        if (OpCodes.And32(b1, 0x0D) === 0) {
          const b2 = data[i + 2], b3 = data[i + 3];
          const pc = i;

          let addr = OpCodes.Or32(OpCodes.Or32(
            OpCodes.Shl32(OpCodes.And32(b1, 0xF0), 8),
            OpCodes.Shl32(OpCodes.And32(b2, 0x0F), 16)),
            OpCodes.Or32(OpCodes.Or32(
              OpCodes.Shl32(OpCodes.And32(b2, 0x10), 7),
              OpCodes.Shr32(OpCodes.And32(b2, 0xE0), 4)),
              OpCodes.Or32(
                OpCodes.Shl32(OpCodes.And32(b3, 0x7F), 4),
                OpCodes.Shl32(OpCodes.And32(b3, 0x80), 13))));
          addr = OpCodes.ToUint32(addr + pc);

          data[i + 1] = OpCodes.ToByte(OpCodes.Or32(OpCodes.And32(b1, 0x0F), OpCodes.And32(OpCodes.Shr32(addr, 13), 0xF0)));
          data[i + 2] = OpCodes.ToByte(OpCodes.Shr32(addr, 9));
          data[i + 3] = OpCodes.ToByte(OpCodes.Shr32(addr, 1));
          advance = 4;
        }
      } else if (OpCodes.And32(b0, 0x7F) === 0x17) {
        const inst = _riscvReadLE(data, i);
        const pc = i;

        if (OpCodes.And32(inst, 0xE80) !== 0) {
          const inst2 = _riscvReadLE(data, i + 4);
          if (_riscvNotAuipcPair(inst, inst2) !== 0)
            advance = 6;
          else {
            const diff = OpCodes.ToUint32(OpCodes.Shr32(inst2, 20) - OpCodes.And32(OpCodes.Shr32(inst2, 19), 0x1000));
            const addr = OpCodes.ToUint32(OpCodes.And32(inst, 0xFFFFF000) + diff + pc);
            const newInst = OpCodes.Or32(0x17, OpCodes.Or32(OpCodes.Shl32(2, 7), OpCodes.Shl32(inst2, 12)));
            _riscvWriteLE(data, i, newInst);
            _riscvWriteBE(data, i + 4, addr);
            advance = 8;
          }
        } else {
          const rs1 = OpCodes.Shr32(inst, 27);
          if (_riscvNotSpecialAuipc(inst, rs1))
            advance = 4;
          else {
            const fakeAddr = _riscvReadLE(data, i + 4);
            const fakeInst2 = OpCodes.Or32(OpCodes.Shr32(inst, 12), OpCodes.Shl32(fakeAddr, 20));
            const newInst = OpCodes.Or32(0x17, OpCodes.Or32(OpCodes.Shl32(rs1, 7), OpCodes.And32(fakeAddr, 0xFFFFF000)));
            _riscvWriteLE(data, i, newInst);
            _riscvWriteLE(data, i + 4, fakeInst2);
            advance = 8;
          }
        }
      }

      i += advance;
    }

    return data;
  }

  function _riscvDecode(bytes) {
    const data = bytes.slice();
    const n = data.length;
    if (n < 8) return data;

    const size = n - 8;
    let i = 0;
    while (i <= size) {
      let advance = 2;
      const b0 = data[i];

      if (b0 === 0xEF) {
        const b1 = data[i + 1];
        if (OpCodes.And32(b1, 0x0D) === 0) {
          const b2 = data[i + 2], b3 = data[i + 3];
          const pc = i;

          let addr = OpCodes.Or32(OpCodes.Or32(
            OpCodes.Shl32(OpCodes.And32(b1, 0xF0), 13),
            OpCodes.Shl32(b2, 9)),
            OpCodes.Shl32(b3, 1));
          addr = OpCodes.ToUint32(addr - pc);

          data[i + 1] = OpCodes.ToByte(OpCodes.Or32(OpCodes.And32(b1, 0x0F), OpCodes.And32(OpCodes.Shr32(addr, 8), 0xF0)));
          data[i + 2] = OpCodes.ToByte(OpCodes.Or32(OpCodes.Or32(
            OpCodes.And32(OpCodes.Shr32(addr, 16), 0x0F),
            OpCodes.And32(OpCodes.Shr32(addr, 7), 0x10)),
            OpCodes.And32(OpCodes.Shl32(addr, 4), 0xE0)));
          data[i + 3] = OpCodes.ToByte(OpCodes.Or32(OpCodes.And32(OpCodes.Shr32(addr, 4), 0x7F), OpCodes.And32(OpCodes.Shr32(addr, 13), 0x80)));
          advance = 4;
        }
      } else if (OpCodes.And32(b0, 0x7F) === 0x17) {
        const inst = _riscvReadLE(data, i);
        const pc = i;

        if (OpCodes.And32(inst, 0xE80) !== 0) {
          const inst2 = _riscvReadLE(data, i + 4);
          if (_riscvNotAuipcPair(inst, inst2) !== 0)
            advance = 6;
          else {
            const addr = OpCodes.ToUint32(OpCodes.And32(inst, 0xFFFFF000) + OpCodes.Shr32(inst2, 20));
            const newInst = OpCodes.Or32(0x17, OpCodes.Or32(OpCodes.Shl32(2, 7), OpCodes.Shl32(inst2, 12)));
            _riscvWriteLE(data, i, newInst);
            _riscvWriteLE(data, i + 4, addr);
            advance = 8;
          }
        } else {
          const rs1 = OpCodes.Shr32(inst, 27);
          if (_riscvNotSpecialAuipc(inst, rs1))
            advance = 4;
          else {
            let addr = _riscvReadBE(data, i + 4);
            addr = OpCodes.ToUint32(addr - pc);
            const inst2 = OpCodes.Or32(OpCodes.Shr32(inst, 12), OpCodes.Shl32(addr, 20));
            const newInst = OpCodes.Or32(0x17, OpCodes.Or32(OpCodes.Shl32(rs1, 7), OpCodes.And32(OpCodes.ToUint32(addr + 0x800), 0xFFFFF000)));
            _riscvWriteLE(data, i, newInst);
            _riscvWriteLE(data, i + 4, inst2);
            advance = 8;
          }
        }
      }

      i += advance;
    }

    return data;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * BcjRiscV - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjRiscV extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ RISC-V";
      this.description = "Branch/Call/Jump filter for RISC-V machine code. Rewrites JAL (Jump and Link) instructions with rd = ra or rd = t0, and AUIPC-led pc-relative register pairs, from byte-relative immediates into an absolute byte address so repeated calls and jumps to the same target produce identical byte sequences.";
      this.inventor = "Lasse Collin (Tukaani Project)";
      this.year = 2024;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("xz File Format / liblzma simple filters", "https://tukaani.org/xz/xz-file-format.txt"),
        new LinkItem("liblzma RISC-V filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c")
      ];

      this.references = [
        new LinkItem("The RISC-V Instruction Set Manual, Volume I (J-type / JAL)", "https://github.com/riscv/riscv-isa-manual"),
        new LinkItem("Tukaani Project (xz-utils)", "https://tukaani.org/xz/")
      ];

      // Test vectors verified against CompressionWorkbench's BB_BcjRiscV
      // (Compression.Core.Transforms.BcjFilter.EncodeRiscV), the authoritative
      // C# reference this JS port is faithful to byte-for-byte.
      this.tests = [
        {
          text: "Empty buffer",
          uri: "https://tukaani.org/xz/xz-file-format.txt",
          input: [],
          expected: []
        },
        {
          text: "JAL rd=x0 (plain jump) - opcode 0x6F byte is NOT filtered, only rd=ra/t0 are",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c",
          input: [0x6F, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0],
          expected: [0x6F, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "JAL rd=ra, imm=0, at a nonzero pc - byte-relative immediate rewritten to absolute",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c",
          input: [0, 0, 0, 0, 0xEF, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0],
          expected: [0, 0, 0, 0, 0xEF, 0x00, 0x00, 0x02, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "AUIPC register-pair, 'real' form (rd != x0, x2) rewritten to canonical form",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c",
          input: [151, 0, 0, 0, 3, 128, 0, 0, 0, 0, 0, 0],
          expected: [23, 49, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "AUIPC register-pair, 'fake' bijective form (rd = x0/x2) rewritten back",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c",
          input: [23, 49, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0],
          expected: [151, 0, 0, 0, 3, 128, 0, 0, 0, 0, 0, 0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjRiscVInstance(this, isInverse);
    }
  }

  class BcjRiscVInstance extends IAlgorithmInstance {
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
      const output = this.isInverse ? _riscvDecode(this.inputBuffer) : _riscvEncode(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjRiscV();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjRiscV, BcjRiscVInstance };
}));
