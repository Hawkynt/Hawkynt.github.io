/*
 * BCJ SPARC Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for big-endian SPARC
 * code: rewrites the word-aligned relative displacement of CALL instructions
 * into an absolute form so an LZ-family compressor can find more repeated
 * byte sequences across near-identical call instructions.
 * Spec/origin: Igor Pavlov, LZMA SDK "Branch" filters (7-Zip, SPARC variant,
 * 2003), later adopted by the Tukaani Project's xz-utils/liblzma as filter
 * SPARC.
 * Instruction encoding: The SPARC Architecture Manual, Format 1 (CALL).
 * References:
 *   https://www.7-zip.org/sdk.html
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/sparc.c
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
   * BcjSparc - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjSparc extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ SPARC";
      this.description = "Branch/Call/Jump filter for big-endian SPARC machine code. Detects CALL instructions, identified by their top two format bits equal to 01, and rewrites their word-aligned 30-bit relative displacement into an absolute word address so repeated calls to the same target produce identical byte sequences.";
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
        new LinkItem("liblzma SPARC filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/sparc.c")
      ];

      this.references = [
        new LinkItem("The SPARC Architecture Manual (CALL instruction, Format 1)", "https://www.gaisler.com/doc/sparcv8.pdf"),
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
          text: "Two consecutive CALL instructions (big-endian words, format bits 01)",
          uri: "https://www.7-zip.org/sdk.html",
          input: [0x40, 0x00, 0x00, 0x10, 0x40, 0x00, 0x01, 0x00],
          expected: [64, 0, 0, 16, 64, 0, 1, 1]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjSparcInstance(this, isInverse);
    }
  }

  class BcjSparcInstance extends IAlgorithmInstance {
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

    // Applies the SPARC BCJ filter. Words are big-endian and 4-byte aligned.
    // The format bits (top 2 bits, fixed to 01 for CALL) are preserved by the
    // rewrite, so encode and decode agree on which words are CALL instructions.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;

      for (let i = 0; i + 4 <= n; i += 4) {
        const instr = OpCodes.Pack32BE(data[i], data[i + 1], data[i + 2], data[i + 3]);
        if (OpCodes.Shr32(instr, 30) !== 1) continue;

        const raw = OpCodes.And32(instr, 0x3FFFFFFF);
        let disp = signExtend32(raw, 30);

        const currentWord = Math.floor(i / 4);
        disp = encode ? (disp + currentWord) : (disp - currentWord);

        const newInstr = OpCodes.Or32(0x40000000, OpCodes.And32(OpCodes.ToUint32(disp), 0x3FFFFFFF));

        const b = OpCodes.Unpack32BE(newInstr);
        data[i] = b[0]; data[i + 1] = b[1]; data[i + 2] = b[2]; data[i + 3] = b[3];
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjSparc();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjSparc, BcjSparcInstance };
}));
