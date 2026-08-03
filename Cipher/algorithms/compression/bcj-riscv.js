/*
 * BCJ RISC-V Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for RISC-V code: rewrites
 * the byte-relative immediate of JAL (Jump and Link) instructions into an
 * absolute form so an LZ-family compressor can find more repeated byte
 * sequences across near-identical call and jump instructions.
 * Spec/origin: Lasse Collin / Tukaani Project, liblzma RISC-V filter, added in
 * xz-utils 5.6.0 (2024). This implementation targets the JAL instruction, used
 * for both direct calls (rd=ra) and unconditional jumps (rd=x0); the AUIPC
 * register-pair form used by the reference filter for long-range calls is a
 * distinct, separately reversible transform and is out of scope here.
 * Instruction encoding: The RISC-V Instruction Set Manual, Volume I: Unprivileged
 * ISA, J-type instruction format (JAL).
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

  // Sign-extends the low `bits` bits of an unsigned value to a signed 32-bit int.
  function signExtend32(value, bits) {
    const shift = 32 - bits;
    return OpCodes.Shr32Signed(OpCodes.Shl32(value, shift), shift);
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
      this.description = "Branch/Call/Jump filter for RISC-V machine code. Detects JAL (Jump and Link) instructions, identified by the low 7 opcode bits equal to 0x6F, and rewrites their byte-relative 21-bit J-type immediate into an absolute byte address so repeated calls and jumps to the same target produce identical byte sequences.";
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

      // Test vectors: input bytes before filtering, expected bytes after filtering.
      this.tests = [
        {
          text: "Empty buffer",
          uri: "https://tukaani.org/xz/xz-file-format.txt",
          input: [],
          expected: []
        },
        {
          text: "Two consecutive JAL instructions (little-endian words, opcode 0x6F)",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c",
          input: [0x6F, 0x00, 0x00, 0x00, 0xEF, 0x00, 0x40, 0x00],
          expected: [111, 0, 0, 0, 239, 0, 128, 0]
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
      this.inputBuffer.push(...data);
    }

    Result() {
      const output = this._transform(this.inputBuffer, !this.isInverse);
      this.inputBuffer = [];
      return output;
    }

    // Applies the RISC-V BCJ filter (JAL only). Because the RISC-V C extension
    // allows 32-bit instructions to start on any halfword boundary, candidates
    // are scanned every 2 bytes. The opcode field (low 7 bits, fixed to 0x6F)
    // and the destination register field are preserved by the rewrite, so
    // encode and decode agree on which words are JAL instructions.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;
      let i = 0;

      while (i + 4 <= n) {
        const word = OpCodes.Pack32LE(data[i], data[i + 1], data[i + 2], data[i + 3]);

        if (OpCodes.And32(word, 0x7F) === 0x6F) {
          const rd = OpCodes.And32(OpCodes.Shr32(word, 7), 0x1F);

          // J-type immediate: imm[20|10:1|11|19:12] packed across the word.
          const bit20   = OpCodes.And32(OpCodes.Shr32(word, 31), 1);
          const bits1912 = OpCodes.And32(OpCodes.Shr32(word, 12), 0xFF);
          const bit11   = OpCodes.And32(OpCodes.Shr32(word, 20), 1);
          const bits101 = OpCodes.And32(OpCodes.Shr32(word, 21), 0x3FF);

          const raw = OpCodes.Or32(
            OpCodes.Or32(OpCodes.Shl32(bit20, 20), OpCodes.Shl32(bits1912, 12)),
            OpCodes.Or32(OpCodes.Shl32(bit11, 11), OpCodes.Shl32(bits101, 1))
          );
          const imm = signExtend32(raw, 21);

          let target = encode ? (imm + i) : (imm - i);
          target = OpCodes.And32(OpCodes.ToUint32(target), 0x1FFFFF);

          const newBit20   = OpCodes.And32(OpCodes.Shr32(target, 20), 1);
          const newBits1912 = OpCodes.And32(OpCodes.Shr32(target, 12), 0xFF);
          const newBit11   = OpCodes.And32(OpCodes.Shr32(target, 11), 1);
          const newBits101 = OpCodes.And32(OpCodes.Shr32(target, 1), 0x3FF);

          let newWord = OpCodes.Or32(0x6F, OpCodes.Shl32(rd, 7));
          newWord = OpCodes.Or32(newWord, OpCodes.Shl32(newBits1912, 12));
          newWord = OpCodes.Or32(newWord, OpCodes.Shl32(newBit11, 20));
          newWord = OpCodes.Or32(newWord, OpCodes.Shl32(newBits101, 21));
          newWord = OpCodes.Or32(newWord, OpCodes.Shl32(newBit20, 31));

          const b = OpCodes.Unpack32LE(newWord);
          data[i] = b[0]; data[i + 1] = b[1]; data[i + 2] = b[2]; data[i + 3] = b[3];
          i += 4;
        } else {
          i += 2;
        }
      }

      return data;
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
