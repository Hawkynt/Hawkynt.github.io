/*
 * Golomb Coding Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Golomb coding - Optimal prefix coding for geometric distributions
 * Includes Rice coding (power-of-2 parameters) as a special case
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
 * GolombCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class GolombCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Golomb";
        this.description = "Golomb coding is a lossless data compression method using prefix codes optimized for geometric distributions. Rice coding (power-of-2 parameters) is included as a special case.";
        this.inventor = "Solomon W. Golomb";
        this.year = 1966;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.BASIC;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("Wikipedia - Golomb Coding", "https://en.wikipedia.org/wiki/Golomb_coding"),
          new LinkItem("Wikipedia - Rice Coding", "https://en.wikipedia.org/wiki/Rice_coding")
        ];

        this.references = [
          new LinkItem("Run-length encodings", "https://ieeexplore.ieee.org/document/1054904"),
          new LinkItem("Information Theory Foundations", "https://web.stanford.edu/class/ee376a/")
        ];

        // Test vectors - wire format (matches CompressionWorkbench's BB_Golomb
        // building block): [parameter M (1 byte)] [originalLength (4 bytes,
        // little-endian)] [packed bits...]. M is not fixed - it is
        // auto-selected per input as M = max(1, round(mean(data) * ln 2)),
        // clamped to 255, so it changes with the data's mean byte value.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: [1, 0, 0, 0, 0]
          },
          {
            text: "Golomb parameter auto-selects m=1 for input=0",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [0],
            expected: [1, 1, 0, 0, 0, 0]
          },
          {
            text: "Golomb parameter auto-selects m=2 for input=3",
            uri: "https://rosettacode.org/wiki/Rice_coding",
            input: [3],
            expected: [2, 1, 0, 0, 0, 160]
          },
          {
            text: "Sequential integers 0-4",
            uri: "https://unix4lyfe.org/rice-coding/",
            input: [0, 1, 2, 3, 4],
            expected: [1, 5, 0, 0, 0, 91, 188]
          },
          {
            text: "Geometric distribution pattern",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [0, 0, 1, 0, 2, 1, 0, 3],
            expected: [1, 8, 0, 0, 0, 38, 156]
          },
          {
            text: "Powers of 2 sequence",
            uri: "https://en.wikipedia.org/wiki/Rice_coding",
            input: [1, 2, 4, 8],
            expected: [3, 4, 0, 0, 0, 78, 182]
          },
          {
            text: "Repetitive run (10 bytes) - auto-selected M tracks the mean, keeping the code compact",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [97, 97, 97, 97, 97, 97, 97, 97, 97, 97],
            expected: [67, 10, 0, 0, 0, 158, 158, 158, 158, 158, 158, 158, 158, 158, 158]
          },
          {
            text: "Alternating pattern (16 bytes) - two distinct byte values",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98],
            expected: [68, 16, 0, 0, 0, 157, 158, 157, 158, 157, 158, 157, 158, 157, 158, 157, 158, 157, 158, 157, 158]
          },
          {
            text: "Binary/random sample (16 bytes) - non-geometric distribution stress test",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [64, 128, 192, 0, 0, 0, 64, 128, 128, 0, 0, 0, 0, 0, 0, 0],
            expected: [30, 16, 0, 0, 0, 198, 242, 191, 56, 0, 6, 55, 149, 229, 0, 0, 0, 0, 0]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new GolombInstance(this, isInverse);
      }
    }

    // Golomb coding instance - matches CompressionWorkbench's BB_Golomb
    // building block: the parameter M is auto-selected from the input's
    // mean (M = max(1, round(mean * ln 2)), clamped to 255), the header is
    // [M:1 byte][originalLength:4 bytes little-endian], and each raw byte
    // value (no offset shift) is coded as a unary quotient plus a truncated
    // binary remainder, MSB-first, zero-padded to a byte boundary.
    class GolombInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.parameter = 1; // M parameter, auto-selected on compress or read from the header on decompress
      }


      Result() {
        const result = this.isInverse ? this._decode(this.inputBuffer) : this._encode(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      _encode(values) {
        let m = 1;
        if (values.length > 0) {
          let sum = 0;
          for (const b of values) sum += b;
          const mean = sum / values.length;
          m = Math.max(1, this._roundHalfToEven(mean * Math.LN2));
          if (m > 255) m = 255;
        }
        this.parameter = m;

        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeByte(m);
        bitStream.writeUint32LE(values.length);

        for (const value of values) {
          if (value < 0) throw new Error("Golomb coding requires non-negative integers");
          this._encodeValue(bitStream, value, m);
        }

        return bitStream.toArray();
      }

      _decode(data) {
        if (data.length < 5) return [];

        const bitStream = OpCodes.CreateBitStream(data);
        const m = bitStream.readByte();
        const length = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());
        this.parameter = m;

        if (length === 0) return [];

        const values = [];
        for (let i = 0; i < length; i++) values.push(this._decodeValue(bitStream, m));

        return values;
      }

      _encodeValue(bitStream, value, m) {
        const quotient = Math.floor(value / m);
        const remainder = value % m;

        // Unary: quotient 1-bits followed by a zero-bit.
        for (let i = 0; i < quotient; i++) bitStream.writeBit(1);
        bitStream.writeBit(0);

        // Truncated binary encoding of the remainder.
        if (m === 1) return;

        const k = this._floorLog2(m);
        const c = OpCodes.Shl32(1, k + 1) - m;

        if (remainder < c) {
          for (let i = k - 1; i >= 0; i--) bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(remainder, i), 1));
        } else {
          const adjusted = remainder + c;
          for (let i = k; i >= 0; i--) bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(adjusted, i), 1));
        }
      }

      _decodeValue(bitStream, m) {
        // Unary quotient: count 1-bits until a 0-bit.
        let quotient = 0;
        while (bitStream.readBit() === 1) quotient++;

        // Truncated binary remainder.
        let remainder;
        if (m === 1) {
          remainder = 0;
        } else {
          const k = this._floorLog2(m);
          const c = OpCodes.Shl32(1, k + 1) - m;

          remainder = 0;
          for (let i = 0; i < k; i++) remainder = OpCodes.Or32(OpCodes.Shl32(remainder, 1), bitStream.readBit());
          if (remainder >= c) {
            remainder = OpCodes.Or32(OpCodes.Shl32(remainder, 1), bitStream.readBit());
            remainder -= c;
          }
        }

        return quotient * m + remainder;
      }

      _floorLog2(value) {
        let result = 0, v = value;
        while (v > 1) { result++; v = Math.floor(v / 2); }
        return result;
      }

      // Matches .NET's Math.Round default (MidpointRounding.ToEven / banker's
      // rounding), which the reference implementation relies on for M selection.
      _roundHalfToEven(x) {
        const floor = Math.floor(x);
        const diff = x - floor;
        if (diff < 0.5) return floor;
        if (diff > 0.5) return floor + 1;
        return (floor % 2 === 0) ? floor : floor + 1;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new GolombCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GolombCompression, GolombInstance };
}));