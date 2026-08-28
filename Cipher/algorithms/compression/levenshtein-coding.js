/*
 * Levenshtein Coding Algorithm Implementation (Universal Code for Integers)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Levenshtein coding is a universal prefix code for non-negative integers. It
 * recursively encodes the bit-length of the value, then the bit-length of that
 * bit-length, and so on, terminating at zero, so it can represent arbitrarily
 * large integers with a code whose length grows with the iterated logarithm of
 * the value (similar in spirit to, and a predecessor of, Elias omega coding).
 *
 * Reference:
 *   V. I. Levenshtein, "On the Redundancy and Delay of Separable Codes for the
 *   Natural Numbers", Problems of Cybernetics, Vol. 20, 1968, pp. 173-179.
 *   See also: P. Fenwick, "Punctured Elias Codes for variable-length coding of
 *   the integers", Technical Report 137, University of Auckland, 1996 (survey
 *   describing the Levenshtein code construction).
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
 * LevenshteinCodingAlgorithm - Universal integer coding algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LevenshteinCodingAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Levenshtein Coding";
        this.description = "Universal prefix code for non-negative integers. Recursively encodes the bit-length of the bit-length (an iterated-logarithm chain) terminated by zero, so arbitrarily large integers can be represented with a self-delimiting code.";
        this.inventor = "Vladimir I. Levenshtein";
        this.year = 1968;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal Codes";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.RU;

        // Documentation and references
        this.documentation = [
          new LinkItem("Levenshtein coding - Wikipedia", "https://en.wikipedia.org/wiki/Levenshtein_coding"),
          new LinkItem("Punctured Elias Codes for variable-length coding of the integers (Fenwick, 1996)", "https://www.cs.auckland.ac.nz/~peter-f/FTPfiles/TechRep137.ps"),
          new LinkItem("Universal code (data compression) - Wikipedia", "https://en.wikipedia.org/wiki/Universal_code_(data_compression)")
        ];

        this.references = [
          new LinkItem("V.I. Levenshtein, 'On the Redundancy and Delay of Separable Codes for the Natural Numbers' (1968)", "https://en.wikipedia.org/wiki/Levenshtein_coding#History"),
          new LinkItem("Elias omega coding (related recursive universal code)", "https://en.wikipedia.org/wiki/Elias_omega_coding")
        ];

        // Wire format (matches CompressionWorkbench's BB_Levenshtein building
        // block): a 4-byte little-endian original length, followed by the
        // Levenshtein-coded bitstream (MSB-first, zero-padded to a byte
        // boundary). Byte values are mapped to (value + 1) before coding,
        // so the raw bit patterns no longer match the canonical Wikipedia
        // worked examples for values 0,1,2,3,7,8 directly (those are the
        // patterns for value+1 = 1,2,3,4,8,9).
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: [0, 0, 0, 0]
          },
          {
            text: "Single small value - byte 1 (encodes value 2, code '1100')",
            uri: "https://en.wikipedia.org/wiki/Levenshtein_coding",
            input: [1],
            expected: [1, 0, 0, 0, 192]
          },
          {
            text: "Canonical worked examples - byte values 0,1,2,3,7,8",
            uri: "https://en.wikipedia.org/wiki/Levenshtein_coding",
            input: [0, 1, 2, 3, 7, 8],
            expected: [6, 0, 0, 0, 179, 120, 116, 116, 128]
          },
          {
            text: "Text sample - 'AB3'",
            uri: "https://en.wikipedia.org/wiki/Levenshtein_coding",
            input: OpCodes.AsciiToBytes("AB3"),
            expected: [3, 0, 0, 0, 242, 11, 200, 63, 26, 0]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LevenshteinCodingInstance(this, isInverse);
      }
    }

    class LevenshteinCodingInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // ----- Levenshtein code for a single non-negative integer -----

      _floorLog2(value) {
        let result = 0, v = value;
        while (v > 1) { result++; v = Math.floor(v / 2); }
        return result;
      }

      // Writes the Levenshtein code for a non-negative integer: the chain of
      // iterated bit-lengths value -> floorLog2(value) -> ... -> 0, written as
      // a unary step count C (C ones then a zero) followed by each chain
      // entry from smallest to largest with its implicit leading 1 omitted.
      _encodeValue(bitStream, value) {
        if (value === 0) { bitStream.writeBit(0); return; }

        const chain = [];
        let v = value;
        while (v > 0) {
          chain.push(v);
          v = this._floorLog2(v);
        }

        const c = chain.length;
        for (let i = 0; i < c; i++) bitStream.writeBit(1);
        bitStream.writeBit(0);

        for (let i = chain.length - 1; i >= 0; i--) {
          const n = i < chain.length - 1 ? chain[i + 1] : 0;
          const entry = chain[i];
          for (let b = n - 1; b >= 0; b--) bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(entry, b), 1));
        }
      }

      // Reads one Levenshtein-coded value: a unary step count C, then C
      // chained length-prefixed reads, each with an implicit leading 1.
      _decodeValue(bitStream) {
        let c = 0;
        while (bitStream.readBit() === 1) c++;

        if (c === 0) return 0;

        let n = 0;
        for (let i = 0; i < c; i++) {
          let value = 1;
          for (let b = 0; b < n; b++) value = OpCodes.Or32(OpCodes.Shl32(value, 1), bitStream.readBit());
          n = value;
        }

        return n;
      }

      // ----- Compression -----

      // Wire format (matches CompressionWorkbench's BB_Levenshtein building
      // block): a 4-byte little-endian original length, followed by the
      // Levenshtein-coded bitstream (MSB-first, zero-padded to a byte
      // boundary). Byte values are mapped to (value + 1) before encoding.
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);
        for (let i = 0; i < data.length; i++) this._encodeValue(bitStream, data[i] + 1);
        return bitStream.toArray();
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 4) return [];

        const bitStream = OpCodes.CreateBitStream(data);
        const originalLength = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());
        if (originalLength === 0) return [];

        const out = [];
        for (let i = 0; i < originalLength; i++)
          out.push(this._decodeValue(bitStream) - 1);
        return out;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LevenshteinCodingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LevenshteinCodingAlgorithm, LevenshteinCodingInstance };
}));
