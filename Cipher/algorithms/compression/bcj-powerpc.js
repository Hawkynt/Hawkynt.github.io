/*
 * BCJ PowerPC Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for big-endian PowerPC
 * code: rewrites the word-aligned relative offset of B/BL (Branch, Branch
 * with Link) instructions into an absolute form so an LZ-family compressor
 * can find more repeated byte sequences across near-identical instructions.
 * Spec/origin: Igor Pavlov, LZMA SDK "Branch" filters (7-Zip, PowerPC variant,
 * 2003), later adopted by the Tukaani Project's xz-utils/liblzma as filter
 * PowerPC.
 * Instruction encoding: Power ISA, I-form branch instructions (opcode 18).
 * References:
 *   https://www.7-zip.org/sdk.html
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/powerpc.c
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
   * BcjPowerPc - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjPowerPc extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ PowerPC";
      this.description = "Branch/Call/Jump filter for big-endian PowerPC machine code. Detects B/BL (Branch, Branch with Link) instructions, identified by opcode 18 with the absolute-address bit clear, and rewrites their word-aligned 24-bit relative offset into an absolute byte address so repeated branches to the same target produce identical byte sequences.";
      this.inventor = "Igor Pavlov";
      this.year = 2003;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("7-Zip / LZMA SDK", "https://www.7-zip.org/sdk.html"),
        new LinkItem("xz File Format / liblzma simple filters", "https://tukaani.org/xz/xz-file-format.txt"),
        new LinkItem("liblzma PowerPC filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/powerpc.c")
      ];

      this.references = [
        new LinkItem("Power ISA specification (branch instructions)", "https://openpowerfoundation.org/specifications/isa/"),
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
          text: "Two consecutive B/BL instructions (big-endian words, opcode 18)",
          uri: "https://www.7-zip.org/sdk.html",
          input: [0x48, 0x00, 0x00, 0x01, 0x48, 0x00, 0x10, 0x01],
          expected: [72, 0, 0, 1, 72, 0, 16, 5]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjPowerPcInstance(this, isInverse);
    }
  }

  class BcjPowerPcInstance extends IAlgorithmInstance {
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
      const output = this._transform(this.inputBuffer, !this.isInverse);
      this.inputBuffer = [];
      return output;
    }

    // Applies the PowerPC BCJ filter. Words are big-endian and 4-byte aligned.
    // The opcode field (bits 0-5) and link bit (bit 31) are preserved by the
    // rewrite, so encode and decode agree on which words are B/BL instructions.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;

      for (let i = 0; i + 4 <= n; i += 4) {
        const instr = OpCodes.Pack32BE(data[i], data[i + 1], data[i + 2], data[i + 3]);
        if (OpCodes.And32(instr, 0xFC000003) !== 0x48000001) continue;

        const raw = OpCodes.And32(instr, 0x03FFFFFC);
        let offset = signExtend32(raw, 26);

        offset = encode ? (offset + i) : (offset - i);

        const preserved = OpCodes.And32(instr, 0xFC000003);
        const newField = OpCodes.And32(OpCodes.ToUint32(offset), 0x03FFFFFC);
        const newInstr = OpCodes.Or32(preserved, newField);

        const b = OpCodes.Unpack32BE(newInstr);
        data[i] = b[0]; data[i + 1] = b[1]; data[i + 2] = b[2]; data[i + 3] = b[3];
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjPowerPc();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjPowerPc, BcjPowerPcInstance };
}));
