/*
 * Fibonacci Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * Educational implementation of Fibonacci number representation coding
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
 * FibonacciCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class FibonacciCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Fibonacci Coding";
        this.description = "Universal integer encoding using Fibonacci number representation. Each number is represented as a sum of non-consecutive Fibonacci numbers, terminated with '11'. More efficient than unary for larger numbers.";
        this.inventor = "Edouard Zeckendorf";
        this.year = 1972;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.BE;

        // Pre-computed Fibonacci numbers for efficiency (first 32 numbers)
        this.fibNumbers = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 
                           2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 
                           196418, 317811, 514229, 832040, 1346269, 2178309, 3524578];

        // Documentation and references
        this.documentation = [
          new LinkItem("Fibonacci Coding - Wikipedia", "https://en.wikipedia.org/wiki/Fibonacci_coding"),
          new LinkItem("Zeckendorf's Theorem", "https://en.wikipedia.org/wiki/Zeckendorf%27s_theorem"),
          new LinkItem("Universal Codes Tutorial", "https://web.stanford.edu/class/ee398a/handouts/lectures/05-UniversalCoding.pdf")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Data Compression Book", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-809474-7"),
          new LinkItem("Fibonacci Applications", "https://www.mathsisfun.com/numbers/fibonacci-sequence.html")
        ];

        // Test vectors with proper Fibonacci/Zeckendorf coding representations
        // (as byte arrays). Wire format (matches CompressionWorkbench's
        // BB_Fibonacci building block): a 4-byte little-endian original
        // length, followed by the coded bitstream. Fibonacci coding only
        // represents positive integers (n >= 1), so each byte value b
        // (0..255) is encoded as Zeckendorf(b+1); the decoder subtracts 1
        // back out. Without this shift, byte 0 and byte 1 would both encode
        // to "11" and be indistinguishable on decode.
        this.tests = [
          new TestCase(
            [1], // byte value 1 -> Zeckendorf(2) = "011"
            [1, 0, 0, 0, 0x60], // length header + Fibonacci code "011" padded to byte
            "Fibonacci coding of byte value 1 (Zeckendorf 2)",
            "https://en.wikipedia.org/wiki/Fibonacci_coding"
          ),
          new TestCase(
            [2], // byte value 2 -> Zeckendorf(3) = "0011"
            [1, 0, 0, 0, 0x30], // length header + Fibonacci code "0011" padded to byte
            "Fibonacci coding of byte value 2 (Zeckendorf 3)",
            "https://en.wikipedia.org/wiki/Fibonacci_coding"
          ),
          new TestCase(
            [6], // byte value 6 -> Zeckendorf(7) = F₄+F₂ = 5+2 -> "01011"
            [1, 0, 0, 0, 0x58], // length header + Fibonacci code "01011" padded to byte
            "Fibonacci coding of byte value 6 (Zeckendorf 7 = 5+2)",
            "https://cp-algorithms.com/algebra/fibonacci-numbers.html"
          ),
          new TestCase(
            [8], // byte value 8 -> Zeckendorf(9) = F₆+F₁ = 8+1 -> "100011"
            [1, 0, 0, 0, 0x8C], // length header + Fibonacci code "100011" padded to byte
            "Fibonacci coding of byte value 8 (Zeckendorf 9 = 8+1)",
            "https://cp-algorithms.com/algebra/fibonacci-numbers.html"
          ),
          new TestCase(
            [11], // byte value 11 -> Zeckendorf(12) = F₆+F₃ = 8+3 -> "101011"
            [1, 0, 0, 0, 0xAC], // length header + Fibonacci code "101011" padded to byte
            "Fibonacci coding of byte value 11 (Zeckendorf 12 = 8+3)",
            "https://www.geeksforgeeks.org/fibonacci-coding/"
          ),
          // Round-trip regression vectors: previously byte 0 and byte 1
          // collided onto the same "11" codeword and any message mixing
          // both (or containing byte 0 at all) failed to round-trip.
          new TestCase(
            Array.from({ length: 256 }, (_, i) => i), // All 256 distinct byte values
            [],
            "All byte values 0-255 round-trip test",
            "Regression test for byte 0/1 codeword collision"
          ),
          new TestCase(
            [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196], // Pseudo-random (splitmix32) 300-byte sample
            [],
            "Pseudo-random data round-trip test",
            "Regression test for byte 0/1 codeword collision"
          ),
          new TestCase(
            Array.from({ length: 128 }, (_, i) => i % 2 ? 0x55 : 0xAA), // Alternating 0xAA/0x55
            [],
            "Alternating pattern round-trip test",
            "Regression test for byte 0/1 codeword collision"
          )
        ];
      }

      CreateInstance(isInverse = false) {
        return new FibonacciInstance(this, isInverse);
      }
    }

    class FibonacciInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.fibNumbers = algorithm.fibNumbers;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ? this._decompress() : this._compress();
        this.inputBuffer = [];
        return result;
      }

      // Wire format (matches CompressionWorkbench's BB_Fibonacci building
      // block): a 4-byte little-endian original length, followed by the
      // Fibonacci/Zeckendorf-coded bitstream (each codeword's Fibonacci
      // digits least-significant-first, terminated by an extra 1-bit, all
      // packed MSB-first into bytes). Fibonacci coding only represents
      // positive integers (n >= 1), so bytes (0..255) are shifted to
      // (1..256) before encoding; without this shift, byte 0 and byte 1
      // would both encode to "11" and be indistinguishable on decode.
      _compress() {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(this.inputBuffer.length);
        for (const byte of this.inputBuffer) this._encodeFibonacci(bitStream, byte + 1);
        return bitStream.toArray();
      }

      _decompress() {
        if (this.inputBuffer.length < 4) return [];

        const bitStream = OpCodes.CreateBitStream(this.inputBuffer);
        const uncompressedSize = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());
        if (uncompressedSize === 0) return [];

        const result = [];
        let prevBit = 0, sum = 0, fibIndex = 0;

        while (result.length < uncompressedSize) {
          const bit = bitStream.readBit();

          if (bit === 1 && prevBit === 1) {
            // "11" terminator found -- emit symbol (undo the +1 encode shift).
            result.push(sum - 1);
            sum = 0;
            fibIndex = 0;
            prevBit = 0;
          } else {
            if (bit === 1) sum += this.fibNumbers[fibIndex];
            fibIndex++;
            prevBit = bit;
          }
        }

        return result;
      }

      // Greedy Zeckendorf decomposition of a positive integer into
      // non-consecutive Fibonacci numbers, written least-significant-digit
      // first, followed by a terminating 1-bit.
      _encodeFibonacci(bitStream, num) {
        const bits = [];
        let remaining = num;
        let maxBitSet = -1;

        for (let i = this.fibNumbers.length - 1; i >= 0; i--) {
          if (this.fibNumbers[i] <= remaining) {
            bits[i] = 1;
            remaining -= this.fibNumbers[i];
            if (i > maxBitSet) maxBitSet = i;
          }
        }

        for (let i = 0; i <= maxBitSet; i++) bitStream.writeBit(bits[i] || 0);
        bitStream.writeBit(1); // terminator
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new FibonacciCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FibonacciCompression, FibonacciInstance };
}));