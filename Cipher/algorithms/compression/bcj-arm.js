/*
 * BCJ ARM Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for 32-bit ARM (A32) code:
 * rewrites the word-aligned relative offset of BL (Branch with Link) instructions
 * into an absolute form so an LZ-family compressor can find more repeated
 * byte sequences across near-identical call instructions.
 * Spec/origin: Igor Pavlov, LZMA SDK "Branch" filters (7-Zip, ARM variant, 2003),
 * later adopted by the Tukaani Project's xz-utils/liblzma as filter ARM.
 * Instruction encoding: ARM Architecture Reference Manual, BL/BLX (immediate).
 * References:
 *   https://www.7-zip.org/sdk.html
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm.c
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
   * BcjArm - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjArm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ ARM";
      this.description = "Branch/Call/Jump filter for 32-bit ARM (A32) machine code. Detects BL (Branch with Link) instructions, identified by the 0xEB opcode byte, and rewrites their word-aligned 24-bit relative offset into an absolute word address so repeated calls to the same target produce identical byte sequences.";
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
        new LinkItem("liblzma ARM filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm.c")
      ];

      this.references = [
        new LinkItem("ARM Architecture Reference Manual (branch instructions)", "https://developer.arm.com/documentation/ddi0406/latest/"),
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
          text: "Two consecutive BL instructions (little-endian words, opcode byte 0xEB)",
          uri: "https://www.7-zip.org/sdk.html",
          input: [0x00, 0x00, 0x00, 0xEB, 0x01, 0x02, 0x03, 0xEB],
          expected: [0, 0, 0, 235, 2, 2, 3, 235]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjArmInstance(this, isInverse);
    }
  }

  class BcjArmInstance extends IAlgorithmInstance {
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

    // Applies the ARM BCJ filter. Instructions are scanned word-aligned (4 bytes);
    // the opcode byte (data[i+3] === 0xEB) is never modified by the offset rewrite,
    // so encode and decode agree on which words are BL instructions.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;

      for (let i = 0; i + 4 <= n; i += 4) {
        if (data[i + 3] !== 0xEB) continue;

        const raw = OpCodes.Pack32LE(data[i], data[i + 1], data[i + 2], 0);
        let offset = signExtend32(raw, 24);

        // Word address of the current instruction (ARM PC-relative branches are word-scaled).
        const currentWord = Math.floor(i / 4);
        offset = encode ? (offset + currentWord) : (offset - currentWord);

        const masked = OpCodes.And32(OpCodes.ToUint32(offset), 0xFFFFFF);
        const b = OpCodes.Unpack32LE(masked);
        data[i] = b[0];
        data[i + 1] = b[1];
        data[i + 2] = b[2];
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjArm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjArm, BcjArmInstance };
}));
