/*
 * BCJ x86 Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform: rewrites relative x86
 * CALL/JMP targets into absolute form so an LZ-family compressor can find more
 * repeated byte sequences across near-identical call/jump instructions.
 * Spec/origin: Igor Pavlov, "Branch converter for x86" (LZMA SDK, 7-Zip, 2001),
 * later adopted by the Tukaani Project's xz-utils/liblzma as filter x86.
 * References:
 *   https://www.7-zip.org/sdk.html
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://tukaani.org/xz/ (liblzma simple filters: src/liblzma/simple/x86.c)
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
   * BcjX86 - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjX86 extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ x86";
      this.description = "Branch/Call/Jump filter for 32/64-bit x86 machine code. Scans for CALL (0xE8) and JMP (0xE9) opcodes and rewrites their 32-bit little-endian relative displacement into an absolute value relative to the start of the buffer, making repeated calls to the same target produce identical byte sequences that an LZ-family compressor can match.";
      this.inventor = "Igor Pavlov";
      this.year = 2001;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("7-Zip / LZMA SDK", "https://www.7-zip.org/sdk.html"),
        new LinkItem("xz File Format / liblzma simple filters", "https://tukaani.org/xz/xz-file-format.txt"),
        new LinkItem("liblzma x86 filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/x86.c")
      ];

      this.references = [
        new LinkItem("Tukaani Project (xz-utils)", "https://tukaani.org/xz/"),
        new LinkItem("7-Zip source browser", "https://sourceforge.net/projects/sevenzip/")
      ];

      // Test vectors: input bytes before filtering, expected bytes after filtering.
      // Round-trip (decode(encode(x)) === x) is verified automatically by the test engine.
      this.tests = [
        {
          text: "Empty buffer",
          uri: "https://tukaani.org/xz/xz-file-format.txt",
          input: [],
          expected: []
        },
        {
          text: "CALL rel32 immediately followed by NOP padding",
          uri: "https://www.7-zip.org/sdk.html",
          input: [0xE8, 0x00, 0x00, 0x00, 0x00, 0x90, 0x90, 0x90],
          expected: [232, 5, 0, 0, 0, 144, 144, 144]
        },
        {
          text: "Typical function prologue with CALL and JMP",
          uri: "https://www.7-zip.org/sdk.html",
          input: [0x55, 0x89, 0xE5, 0xE8, 0x10, 0x00, 0x00, 0x00, 0xE9, 0x20, 0x00, 0x00, 0x00, 0xC3],
          expected: [85, 137, 229, 232, 24, 0, 0, 0, 233, 45, 0, 0, 0, 195]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjX86Instance(this, isInverse);
    }
  }

  class BcjX86Instance extends IAlgorithmInstance {
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

    // Applies the x86 BCJ filter. encode=true rewrites relative to absolute,
    // encode=false reverses absolute back to relative. Both directions scan for
    // the same 0xE8/0xE9 opcode bytes, which are never modified by the address
    // rewrite, so the scan finds matches at identical positions in both directions.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;
      let i = 0;

      while (i + 5 <= n) {
        if (data[i] === 0xE8 || data[i] === 0xE9) {
          let addr = OpCodes.Pack32LE(data[i + 1], data[i + 2], data[i + 3], data[i + 4]);
          const pos = OpCodes.ToUint32(i + 5);
          addr = encode ? OpCodes.ToUint32(addr + pos) : OpCodes.ToUint32(addr - pos);
          const b = OpCodes.Unpack32LE(addr);
          data[i + 1] = b[0];
          data[i + 2] = b[1];
          data[i + 3] = b[2];
          data[i + 4] = b[3];
          i += 5;
        } else {
          i += 1;
        }
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjX86();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjX86, BcjX86Instance };
}));
