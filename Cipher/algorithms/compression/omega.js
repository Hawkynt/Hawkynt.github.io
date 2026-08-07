/*
 * Omega Coding Universal Integer Encoding Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Omega coding - Universal code for positive integers with self-delimiting property
 * Efficient for encoding integers with unknown distribution
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
 * OmegaCodingAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class OmegaCodingAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Omega Coding";
        this.description = "Universal code for positive integers with self-delimiting property. Efficient encoding scheme for integers with unknown probability distribution, using recursive length encoding.";
        this.inventor = "Peter Elias";
        this.year = 1975;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal Codes";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("Universal Code Wikipedia", "https://en.wikipedia.org/wiki/Universal_code_(data_compression)"),
          new LinkItem("Elias Omega Coding", "https://en.wikipedia.org/wiki/Elias_omega_coding")
        ];

        this.references = [
          new LinkItem("Universal Coding Theory", "https://web.stanford.edu/class/ee376a/files/2017-18/lecture_4.pdf"),
          new LinkItem("Information Theory Course", "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/"),
          new LinkItem("Data Compression Explained", "https://www.data-compression.com/theory.shtml"),
          new LinkItem("Coding Theory Resources", "https://michaeldipperstein.github.io/omega.html")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_Omega):
        //   4 bytes original length (little-endian); if 0, no payload follows.
        //   Otherwise, MSB-first bit-packed Elias Omega codes for (byte + 1),
        //   zero-padded to a byte boundary.
        this.tests = [
          new TestCase([], [0,0,0,0], "Empty input", "https://en.wikipedia.org/wiki/Universal_code_(data_compression)"),
          new TestCase([65], [1,0,0,0,180,32], "Single byte value", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([65, 65], [2,0,0,0,180,37,161,0], "Repeated byte values", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([65, 66], [2,0,0,0,180,37,161,128], "Two different byte values", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([65, 66, 67], [3,0,0,0,180,37,161,173,16], "Three different byte values", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([72, 101, 108, 108, 111], [5,0,0,0,180,149,179,45,181,109,171,112,0], "Hello string bytes", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([1, 2, 3, 4, 5], [5,0,0,0,154,138,172], "Sequential small values", "https://en.wikipedia.org/wiki/Elias_omega_coding")
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new OmegaCodingInstance(this, isInverse);
      }
    }

    class OmegaCodingInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decode, false = encode
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ?
          (this.inputBuffer.length === 0 ? [] : this.decode(this.inputBuffer)) :
          this.encode(this.inputBuffer); // even empty input yields the 4-byte length header

        this.inputBuffer = [];
        return result;
      }

      // Matches CompressionWorkbench's OmegaBuildingBlock.Compress:
      //   4 bytes original length (little-endian); if 0, no payload follows.
      //   Otherwise, MSB-first bit-packed Elias Omega codes for (byte + 1).
      encode(data) {
        const result = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) return result;

        let bitBuffer = 0, bitsInBuffer = 0;
        const writeBit = (bit) => {
          bitBuffer = OpCodes.OrN(bitBuffer, OpCodes.Shl32(bit, 7 - bitsInBuffer));
          ++bitsInBuffer;
          if (bitsInBuffer === 8) {
            result.push(bitBuffer);
            bitBuffer = 0;
            bitsInBuffer = 0;
          }
        };

        for (const byte of data)
          this._encodeOmega(writeBit, byte + 1);

        if (bitsInBuffer > 0)
          result.push(bitBuffer);

        return result;
      }

      // Matches CompressionWorkbench's OmegaBuildingBlock.Decompress
      decode(data) {
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) return [];

        let bytePos = 4, bitPos = 0;
        const readBit = () => {
          const bit = OpCodes.AndN(OpCodes.Shr32(data[bytePos], 7 - bitPos), 1);
          ++bitPos;
          if (bitPos === 8) {
            bitPos = 0;
            ++bytePos;
          }
          return bit;
        };

        const decodedBytes = [];
        for (let i = 0; i < originalLength; ++i) {
          const value = this._decodeOmega(readBit);
          if (value < 1 || value > 256)
            throw new Error('Invalid Omega code in compressed data');
          decodedBytes.push(value - 1);
        }

        return decodedBytes;
      }

      // Elias Omega coding: collect the chain of successive length-groups
      // (N -> bit-length(N) - 1, repeated until N == 1), then emit them from
      // the innermost (smallest) group outward, MSB-first, followed by a
      // terminating zero bit.
      _encodeOmega(writeBit, value) {
        const chain = [];
        let n = value;
        while (n > 1) {
          chain.push(n);
          n = this._bitLength(n) - 1;
        }

        for (let i = chain.length - 1; i >= 0; --i) {
          const group = chain[i];
          const length = this._bitLength(group);
          for (let b = length - 1; b >= 0; --b)
            writeBit(OpCodes.AndN(OpCodes.Shr32(group, b), 1));
        }

        writeBit(0);
      }

      // Canonical Elias Omega decode: start with N = 1; if the next bit is 0,
      // stop; otherwise read N further bits (with an implicit leading 1) to
      // form the new value of N.
      _decodeOmega(readBit) {
        let n = 1;
        for (;;) {
          const bit = readBit();
          if (bit === 0) return n;

          let group = 1;
          for (let i = 0; i < n; ++i)
            group = OpCodes.OrN(OpCodes.Shl32(group, 1), readBit());
          n = group;
        }
      }

      _bitLength(value) {
        let len = 0;
        while (value > 0) {
          ++len;
          value = OpCodes.Shr32(value, 1);
        }
        return len;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new OmegaCodingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { OmegaCodingAlgorithm, OmegaCodingInstance };
}));