/*
 * Unary Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of unary number representation
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
 * UnaryCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class UnaryCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Unary Coding";
        this.description = "Universal integer coding where number n is represented by n-1 ones followed by a zero. Simple but inefficient for large numbers, mainly used in combination with other codes or for very small values.";
        this.inventor = "Information Theory (fundamental)";
        this.year = 1940;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal";
        this.securityStatus = null;
        this.complexity = ComplexityType.ELEMENTARY;
        this.country = CountryCode.UNKNOWN;

        // Documentation and references
        this.documentation = [
          new LinkItem("Unary Coding - Wikipedia", "https://en.wikipedia.org/wiki/Unary_coding"),
          new LinkItem("Universal Codes Tutorial", "https://web.stanford.edu/class/ee398a/handouts/lectures/05-UniversalCoding.pdf"),
          new LinkItem("Information Theory Basics", "https://www.inference.org.uk/itprnn/book.pdf")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Data Compression Book", "https://www.data-compression.com/theory.html"),
          new LinkItem("Coding Theory Reference", "https://www.cambridge.org/core/books/introduction-to-coding-theory/")
        ];

        // Test vectors with expected compressed output.
        // Wire format (matches CompressionWorkbench's BB_Unary building block):
        // a 4-byte little-endian symbol count, followed by the bit-packed unary
        // codes (byte b encoded directly as b ones then a terminating zero),
        // MSB-first, zero-padded to a byte boundary.
        this.tests = [
          {
            text: "Small values - optimal for unary",
            uri: "https://en.wikipedia.org/wiki/Unary_coding",
            input: [1, 2, 3, 4], // Small numbers
            expected: [4, 0, 0, 0, 183, 120]
          },
          {
            text: "Single small value",
            uri: "Educational test",
            input: [5], // Single number: 11111 0
            expected: [1, 0, 0, 0, 248]
          },
          {
            text: "Mixed small values",
            uri: "Educational test",
            input: [1, 3, 2, 1], // Various small numbers
            expected: [4, 0, 0, 0, 187, 64]
          },
          {
            text: "Large repetitive block (1024x 0x61) - regression for symbol-count header overflow",
            uri: "https://en.wikipedia.org/wiki/Unary_coding",
            input: new Array(1024).fill(0x61),
            roundTripOnly: true
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new UnaryInstance(this, isInverse);
      }
    }

    class UnaryInstance extends IAlgorithmInstance {
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
        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        // Header: 4-byte little-endian symbol count, so the decoder knows
        // exactly how many codewords to decode and never has to guess where
        // end-of-stream padding bits stop.
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(this.inputBuffer.length);

        // Encode each byte value b (0-255) directly as b one-bits followed
        // by a terminating zero-bit. Every byte maps to a distinct,
        // self-terminating, prefix-free codeword.
        for (const byte of this.inputBuffer) {
          for (let i = 0; i < byte; i++) bitStream.writeBit(1);
          bitStream.writeBit(0);
        }

        const bytes = bitStream.toArray();

        // Clear input buffer
        this.inputBuffer = [];

        return bytes;
      }

      _decompress() {
        if (this.inputBuffer.length < 4) {
          this.inputBuffer = [];
          return [];
        }

        const bitStream = OpCodes.CreateBitStream(this.inputBuffer);
        const symbolCount = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());

        const result = [];
        while (result.length < symbolCount) {
          let ones = 0;
          while (bitStream.readBit() === 1) ones++;
          result.push(ones);
        }

        // Clear input buffer
        this.inputBuffer = [];

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new UnaryCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { UnaryCompression, UnaryInstance };
}));