/*
 * BCJ IA-64 Branch Converter Filter Implementation
 * Compatible with AlgorithmFramework
 * Reversible executable-code preprocessing transform for Itanium (IA-64)
 * code: rewrites the bundle-relative immediate of long-branch (brl-class)
 * instructions into an absolute form so an LZ-family compressor can find
 * more repeated byte sequences across near-identical branch instructions.
 * Spec/origin: Igor Pavlov, LZMA SDK "Branch" filters (7-Zip, IA-64 variant,
 * 2003), later adopted by the Tukaani Project's xz-utils/liblzma as filter
 * IA64.
 * Instruction encoding: Intel Itanium Architecture Software Developer's
 * Manual, Volume 3: bundle format (5-bit template + three 41-bit slots) and
 * the branch-slot template table (which of the three slots hold B-unit
 * instructions for a given template value).
 * References:
 *   https://www.7-zip.org/sdk.html
 *   https://tukaani.org/xz/xz-file-format.txt
 *   https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/ia64.c
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

  // Per-template bitmask (bit0=slot0, bit1=slot1, bit2=slot2) of which slots in a
  // 128-bit bundle hold B-unit (branch) instructions, indexed by the 5-bit template.
  const IA64_BRANCH_SLOT_MASK = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    4, 4, 6, 6, 0, 0, 7, 7, 4, 4, 0, 0, 4, 4, 0, 0
  ];

  const MASK_41_BITS = OpCodes.ShiftLn(1n, 41) - 1n;
  const MASK_20_BITS = OpCodes.ShiftLn(1n, 20) - 1n;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * BcjIa64 - Compression (transform) algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class BcjIa64 extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCJ IA-64";
      this.description = "Branch/Call/Jump filter for Itanium (IA-64) machine code. Scans 16-byte instruction bundles, uses the 5-bit template field to find slots holding B-unit branch instructions with major opcode 4, and rewrites their bundle-relative 25-bit target into an absolute address so repeated branches to the same target produce identical byte sequences.";
      this.inventor = "Igor Pavlov";
      this.year = 2003;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Transform";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      // Documentation and references
      this.documentation = [
        new LinkItem("7-Zip / LZMA SDK", "https://www.7-zip.org/sdk.html"),
        new LinkItem("xz File Format / liblzma simple filters", "https://tukaani.org/xz/xz-file-format.txt"),
        new LinkItem("liblzma IA-64 filter source", "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/ia64.c")
      ];

      this.references = [
        new LinkItem("Intel Itanium Architecture Software Developer's Manual, Vol. 3 (bundle/template format)", "https://www.intel.com/content/www/us/en/products/docs/processors/itanium/itanium-architecture-vol-3-manual.html"),
        new LinkItem("Tukaani Project (xz-utils)", "https://tukaani.org/xz/")
      ];

      // Test vectors: 16-byte-aligned bundles. Input bytes before filtering,
      // expected bytes after filtering. The first bundle (template 0) has no
      // branch slots and is left untouched; the second bundle (template 18,
      // slots 1 and 2) carries a branch instruction in slot 1.
      this.tests = [
        {
          text: "Empty buffer",
          uri: "https://tukaani.org/xz/xz-file-format.txt",
          input: [],
          expected: []
        },
        {
          text: "Padding bundle followed by a bundle with a branch in slot 1 (template 18)",
          uri: "https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/ia64.c",
          input: [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            18, 0, 0, 0, 0, 0, 0, 24, 9, 0, 32, 0, 0, 0, 0, 0
          ],
          expected: [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            18, 0, 0, 0, 0, 0, 0, 32, 9, 0, 32, 0, 0, 0, 0, 0
          ]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BcjIa64Instance(this, isInverse);
    }
  }

  class BcjIa64Instance extends IAlgorithmInstance {
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

    // Applies the IA-64 BCJ filter over 16-byte bundles, using BigInt for the
    // 128-bit bundle value since instruction slots (41 bits) do not align to
    // byte or 32-bit boundaries. The 5-bit template field is never modified,
    // so encode and decode agree on which bundles/slots carry branches.
    _transform(bytes, encode) {
      const data = bytes.slice();
      const n = data.length;

      for (let pos = 0; pos + 16 <= n; pos += 16) {
        let bundle = 0n;
        for (let j = 0; j < 16; j++) {
          bundle = OpCodes.OrN(bundle, OpCodes.ShiftLn(BigInt(data[pos + j]), 8 * j));
        }

        const template = Number(OpCodes.AndN(bundle, 0x1Fn));
        const slotMask = IA64_BRANCH_SLOT_MASK[template];
        if (slotMask === 0) continue;

        for (let slot = 0; slot < 3; slot++) {
          if (OpCodes.AndN(BigInt(slotMask), OpCodes.ShiftLn(1n, slot)) === 0n) continue;

          const bitOffset = 5 + 41 * slot;
          const instrVal = OpCodes.AndN(OpCodes.ShiftRn(bundle, bitOffset), MASK_41_BITS);

          const opcode = OpCodes.AndN(OpCodes.ShiftRn(instrVal, 37), 0xFn);
          if (opcode !== 4n) continue;

          const imm20b = OpCodes.AndN(OpCodes.ShiftRn(instrVal, 13), MASK_20_BITS);
          const signBit = OpCodes.AndN(OpCodes.ShiftRn(instrVal, 36), 1n);

          // 21-bit signed slot-count target, scaled to a byte offset (x16).
          let target = OpCodes.OrN(OpCodes.ShiftLn(signBit, 20), imm20b);
          if (signBit === 1n) target -= OpCodes.ShiftLn(1n, 21);
          target = target * 16n;

          const posValue = BigInt(pos);
          target = encode ? (target + posValue) : (target - posValue);

          const newImm20b = OpCodes.AndN(OpCodes.ShiftRn(target, 4), MASK_20_BITS);
          const newSignBit = OpCodes.AndN(OpCodes.ShiftRn(target, 24), 1n);

          const newInstrVal = instrVal
            - OpCodes.ShiftLn(imm20b, 13) - OpCodes.ShiftLn(signBit, 36)
            + OpCodes.ShiftLn(newImm20b, 13) + OpCodes.ShiftLn(newSignBit, 36);

          bundle = bundle - OpCodes.ShiftLn(instrVal, bitOffset) + OpCodes.ShiftLn(newInstrVal, bitOffset);
        }

        for (let j = 0; j < 16; j++) {
          data[pos + j] = Number(OpCodes.AndN(OpCodes.ShiftRn(bundle, 8 * j), 0xFFn));
        }
      }

      return data;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BcjIa64();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BcjIa64, BcjIa64Instance };
}));
