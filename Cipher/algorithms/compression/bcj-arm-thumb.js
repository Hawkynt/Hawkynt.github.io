/*
 * BCJ ARM-Thumb Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for 16-bit Thumb (T32) code:
 * rewrites the halfword-scaled relative offset of the two-halfword BL (Branch
 * with Link) instruction into an absolute form so an LZ-family compressor can
 * find more repeated byte sequences across near-identical call instructions.
 * Spec/origin: Igor Pavlov, LZMA SDK "Branch" filters (7-Zip, ARM-Thumb variant,
 * 2003), later adopted by the Tukaani Project's xz-utils/liblzma as filter ARMT.
 * Instruction encoding: ARM Architecture Reference Manual, Thumb BL (immediate).
 * References:
 *   https://www.7-zip.org/sdk.html
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/armthumb.c
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
   * BcjArmThumb - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjArmThumb extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ ARM-Thumb";
      this.description = "Branch/Call/Jump filter for 16-bit ARM Thumb (T32) machine code. Detects the two-halfword BL (Branch with Link) instruction, identified by the 0xF0xx/0xF8xx halfword pattern, and rewrites its halfword-scaled 22-bit relative offset into an absolute address so repeated calls to the same target produce identical byte sequences.";
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
        new LinkItem("liblzma ARM-Thumb filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/armthumb.c")
      ];

      this.references = [
        new LinkItem("ARM Architecture Reference Manual (Thumb branch instructions)", "https://developer.arm.com/documentation/ddi0406/latest/"),
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
          text: "Two consecutive Thumb BL instructions (halfword pair F0xx/F8xx)",
          uri: "https://www.7-zip.org/sdk.html",
          input: [0x00, 0xF0, 0x00, 0xF8, 0x01, 0xF1, 0x02, 0xF9],
          expected: [0, 240, 2, 248, 1, 241, 6, 249]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjArmThumbInstance(this, isInverse);
    }
  }

  class BcjArmThumbInstance extends IAlgorithmInstance {
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

    // Applies the Thumb BCJ filter. A BL instruction is two little-endian
    // halfwords: halfword 1 has its top 5 bits equal to 11110 (byte[i+1]&0xF8===0xF0)
    // and halfword 2 has its top 5 bits equal to 11111 (byte[i+3]&0xF8===0xF8).
    // Neither identifying nibble is touched by the offset rewrite, so encode and
    // decode agree on which halfword pairs are BL instructions.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;
      let i = 0;

      while (i + 4 <= n) {
        if (OpCodes.And32(data[i + 1], 0xF8) === 0xF0 && OpCodes.And32(data[i + 3], 0xF8) === 0xF8) {
          const hi = OpCodes.And32(data[i + 1], 0x07);
          const lo = OpCodes.And32(data[i + 3], 0x07);

          let src = OpCodes.Or32(
            OpCodes.Or32(OpCodes.Shl32(hi, 19), OpCodes.Shl32(data[i], 11)),
            OpCodes.Or32(OpCodes.Shl32(lo, 8), data[i + 2])
          );
          src = OpCodes.Shl32(src, 1); // halfword-scaled -> byte-scaled

          const here = OpCodes.ToUint32(i + 4);
          let dest = encode ? OpCodes.ToUint32(here + src) : OpCodes.ToUint32(src - here);
          dest = OpCodes.Shr32(dest, 1); // byte-scaled -> halfword-scaled

          data[i + 1] = OpCodes.Or32(0xF0, OpCodes.And32(OpCodes.Shr32(dest, 19), 0x07));
          data[i]     = OpCodes.And32(OpCodes.Shr32(dest, 11), 0xFF);
          data[i + 3] = OpCodes.Or32(0xF8, OpCodes.And32(OpCodes.Shr32(dest, 8), 0x07));
          data[i + 2] = OpCodes.And32(dest, 0xFF);

          i += 4;
        } else {
          i += 2;
        }
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjArmThumb();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjArmThumb, BcjArmThumbInstance };
}));
