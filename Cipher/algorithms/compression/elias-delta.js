/*
 * Universal Elias Delta Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Peter Elias's improved universal integer encoding
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
 * EliasDeltaAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class EliasDeltaAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Elias Delta Coding";
        this.description = "Peter Elias improved universal integer encoding, more efficient than Gamma for larger numbers using variable-length prefix codes.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Peter Elias";
        this.year = 1975;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem("Universal codeword sets and representations of the integers", "https://ieeexplore.ieee.org/document/1054906"),
          new LinkItem("Elias Delta Coding - Wikipedia", "https://en.wikipedia.org/wiki/Elias_delta_coding"),
          new LinkItem("Information Theory and Coding", "https://web.stanford.edu/class/ee376a/")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Introduction to Data Compression", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
        ];

        // Wire format (matches CompressionWorkbench's BB_EliasDelta building
        // block): a 4-byte little-endian original length, followed by the
        // Delta-coded bitstream (MSB-first, zero-padded to a byte boundary).
        this.tests = [
          new TestCase(
            [0x01, 0x02, 0x03, 0x04, 0x05],
            [5, 0, 0, 0, 69, 99, 92],
            "Small integer sequence",
            "https://en.wikipedia.org/wiki/Elias_delta_coding"
          ),
          new TestCase(
            [0x7F, 0x80, 0x81, 0xFF],
            [4, 0, 0, 0, 16, 0, 64, 17, 0, 132, 128, 0],
            "Mixed small and large values",
            "Boundary value test"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new EliasDeltaInstance(this, isInverse);
      }
    }

    class EliasDeltaInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ?
          this._decompress(this.inputBuffer) :
          this._compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      // Wire format (matches CompressionWorkbench's BB_EliasDelta building
      // block): a 4-byte little-endian original length, followed by the
      // Delta-coded bitstream (MSB-first, zero-padded to a byte boundary).
      // Elias Delta cannot encode 0, so byte values are mapped to (value + 1).
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);
        for (const byte of data) this._encodeDelta(bitStream, byte + 1);
        return bitStream.toArray();
      }

      _decompress(data) {
        if (data.length < 4) return [];

        const bitStream = OpCodes.CreateBitStream(data);
        const originalLength = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());
        if (originalLength === 0) return [];

        const result = [];
        for (let i = 0; i < originalLength; i++)
          result.push(this._decodeDelta(bitStream) - 1);

        return result;
      }

      /**
       * Encode a positive integer using Elias Delta coding: Gamma-code the
       * bit length (N+1) of value, then append the lower N bits of value
       * (without its leading 1), MSB first.
       * @private
       */
      _encodeDelta(bitStream, value) {
        let n = 0, v = value;
        while (v > 1) { n++; v = Math.floor(v / 2); }

        // Gamma-encode (n + 1): floor(log2(n+1)) zero-bits, then binary of (n+1).
        const lenBits = n + 1;
        let lenLen = 0, tmp = lenBits;
        while (tmp > 1) { lenLen++; tmp = Math.floor(tmp / 2); }

        for (let i = 0; i < lenLen; i++) bitStream.writeBit(0);
        for (let i = lenLen; i >= 0; i--) bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(lenBits, i), 1));

        // Lower n bits of value (without the implicit leading 1).
        for (let i = n - 1; i >= 0; i--) bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
      }

      /**
       * Decode an Elias Delta code: Gamma-decode the bit length (n+1), then
       * read n more bits with an implicit leading 1.
       * @private
       */
      _decodeDelta(bitStream) {
        let lenLen = 0;
        while (bitStream.readBit() === 0) lenLen++;

        let lenBits = 1;
        for (let i = 0; i < lenLen; i++) lenBits = OpCodes.Or32(OpCodes.Shl32(lenBits, 1), bitStream.readBit());

        const n = lenBits - 1;

        let value = 1;
        for (let i = 0; i < n; i++) value = OpCodes.Or32(OpCodes.Shl32(value, 1), bitStream.readBit());

        return value;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new EliasDeltaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { EliasDeltaAlgorithm, EliasDeltaInstance };
}));