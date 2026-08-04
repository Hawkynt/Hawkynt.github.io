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
        // Wire format: a varint symbol count (OpCodes BitStream.writeVarInt),
        // followed by the bit-packed unary codes (byte b -> n = b+1 -> (n-1)
        // ones then a zero), MSB-first, zero-padded to a byte boundary.
        this.tests = [
          {
            text: "Small values - optimal for unary",
            uri: "https://en.wikipedia.org/wiki/Unary_coding",
            input: [1, 2, 3, 4], // Small numbers
            expected: global.OpCodes.Hex8ToBytes("04B778") // Compressed form
          },
          {
            text: "Single small value",
            uri: "Educational test",
            input: [5], // Single number: 11110
            expected: global.OpCodes.Hex8ToBytes("01F8") // Compressed form
          },
          {
            text: "Mixed small values",
            uri: "Educational test",
            input: [1, 3, 2, 1], // Various small numbers
            expected: global.OpCodes.Hex8ToBytes("04BB40") // Compressed form
          },
          {
            text: "Large repetitive block (1024x 0x61) - regression for symbol-count header overflow beyond a 16-bit bit-length field",
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
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        // Header: number of symbols, as a self-delimiting varint (OpCodes
        // BitStream.writeVarInt), so the decoder knows exactly how many
        // codewords to decode and never has to guess where end-of-stream
        // padding bits stop. A fixed-width header would eventually wrap
        // around for large/high-value inputs (unary blows up to N+1 bits
        // per byte of value N), silently truncating the decode.
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeVarInt(this.inputBuffer.length);

        // Encode each byte value b (0-255) as the unary code for n = b + 1:
        // (n-1) ones followed by a terminating zero. Every byte therefore
        // maps to a distinct, self-terminating, prefix-free codeword (unlike
        // an ad-hoc "encode 0 as two zero bits" special case, which collides
        // with the codeword for the value below it and makes the stream not
        // uniquely decodable).
        for (const byte of this.inputBuffer) {
          const ones = byte; // n - 1 ones, where n = byte + 1
          for (let i = 0; i < ones; i++) bitStream.writeBit(1);
          bitStream.writeBit(0);
        }

        const bytes = bitStream.toArray();

        // Clear input buffer
        this.inputBuffer = [];

        return bytes;
      }

      _decompress() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        const bitStream = OpCodes.CreateBitStream(this.inputBuffer);
        const symbolCount = bitStream.readVarInt();

        const result = [];
        while (result.length < symbolCount) {
          let ones = 0;
          while (bitStream.hasMoreBits() && bitStream.readBit() === 1) ones++;
          // n = ones + 1 was encoded from byte = n - 1, i.e. byte = ones
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