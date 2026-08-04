/*
 * BCJ ARM64 Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for AArch64 (ARM64) code:
 * rewrites the word-relative immediates of BL (Branch with Link) and ADRP
 * (Address of Page) instructions into an absolute form so an LZ-family
 * compressor can find more repeated byte sequences across near-identical
 * call and page-address instructions.
 * Spec/origin: Lasse Collin / Tukaani Project, liblzma ARM64 filter, added
 * experimentally in xz 5.3.x and stabilized in xz-utils 5.4.0 (2022).
 * Instruction encoding: Arm Architecture Reference Manual for A-profile
 * architecture, BL and ADRP.
 * References:
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/releases/tag/v5.4.0
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * BcjArm64 - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjArm64 extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ ARM64";
      this.description = "Branch/Call/Jump filter for AArch64 (ARM64) machine code. Detects BL instructions (top 6 bits equal to 100101) and ADRP instructions (bits 31,28-24 equal to 1001x) and rewrites their word- or page-relative immediates into an absolute form so repeated calls and page references produce identical byte sequences.";
      this.inventor = "Lasse Collin (Tukaani Project)";
      this.year = 2022;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("xz File Format / liblzma simple filters", "https://tukaani.org/xz/xz-file-format.txt"),
        new LinkItem("XZ Utils 5.4.0 release notes (ARM64 filter stabilized)", "https://github.com/tukaani-project/xz/releases/tag/v5.4.0"),
        new LinkItem("liblzma ARM64 filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c")
      ];

      this.references = [
        new LinkItem("Arm Architecture Reference Manual for A-profile architecture", "https://developer.arm.com/documentation/ddi0487/latest/"),
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
          text: "Two consecutive BL instructions (top 6 bits 100101, little-endian words)",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c",
          input: [0x00, 0x00, 0x00, 0x94, 0x01, 0x00, 0x00, 0x95],
          expected: [0, 0, 0, 148, 2, 0, 0, 149]
        },
        {
          text: "ADRP instructions within one 4 KiB page (guard leaves them unchanged)",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c",
          input: [0x00, 0x00, 0x00, 0x90, 0x01, 0x00, 0x00, 0x91],
          expected: [0, 0, 0, 144, 1, 0, 0, 145]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjArm64Instance(this, isInverse);
    }
  }

  class BcjArm64Instance extends IAlgorithmInstance {
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

    // Applies the ARM64 BCJ filter. Words are scanned 4-byte aligned. The
    // identifying opcode bits (top 6 bits for BL, bits 31/28-24 for ADRP) are
    // preserved by the rewrite, so encode and decode agree on which words match.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const size = data.length - (data.length % 4);

      for (let i = 0; i < size; i += 4) {
        const pc = OpCodes.ToUint32(i);
        let instr = OpCodes.Pack32LE(data[i], data[i + 1], data[i + 2], data[i + 3]);

        if (OpCodes.Shr32(instr, 26) === 0x25) {
          // BL: 26-bit word-relative immediate, +/-128 MiB range.
          const src = instr;
          let pcWords = Math.floor(pc / 4);
          if (!encode) pcWords = OpCodes.ToUint32(-pcWords);

          const dest = OpCodes.ToUint32(src + pcWords);
          instr = OpCodes.Or32(0x94000000, OpCodes.And32(dest, 0x03FFFFFF));

          const b = OpCodes.Unpack32LE(instr);
          data[i] = b[0]; data[i + 1] = b[1]; data[i + 2] = b[2]; data[i + 3] = b[3];
        } else if (OpCodes.And32(instr, 0x9F000000) === 0x90000000) {
          // ADRP: 21-bit split immediate, page (4 KiB) relative.
          const part1 = OpCodes.And32(OpCodes.Shr32(instr, 29), 0x03);
          const part2 = OpCodes.And32(OpCodes.Shr32(instr, 3), 0x001FFFFC);
          const src = OpCodes.Or32(part1, part2);

          // Only convert values within the liblzma +/-512 MiB range guard.
          if (OpCodes.And32(OpCodes.ToUint32(src + 0x00020000), 0x001C0000) !== 0) continue;

          let pcPages = Math.floor(pc / 4096);
          if (!encode) pcPages = OpCodes.ToUint32(-pcPages);

          const dest = OpCodes.ToUint32(src + pcPages);

          let newInstr = OpCodes.And32(instr, 0x9000001F);
          newInstr = OpCodes.Or32(newInstr, OpCodes.Shl32(OpCodes.And32(dest, 0x03), 29));
          newInstr = OpCodes.Or32(newInstr, OpCodes.Shl32(OpCodes.And32(dest, 0x0003FFFC), 3));
          const negPage = OpCodes.ToUint32(-OpCodes.And32(dest, 0x00020000));
          newInstr = OpCodes.Or32(newInstr, OpCodes.And32(negPage, 0x00E00000));

          const b = OpCodes.Unpack32LE(newInstr);
          data[i] = b[0]; data[i + 1] = b[1]; data[i + 2] = b[2]; data[i + 3] = b[3];
        }
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjArm64();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjArm64, BcjArm64Instance };
}));
