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

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decode
       * @returns {OmegaCodingInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new OmegaCodingInstance(this, isInverse);
      }
    }

    /**
     * MSB-first bit writer appending to a byte array
     */
    class OmegaBitWriter {
      /**
       * @param {uint8[]} output - Byte array the completed bytes are appended to
       */
      constructor(output) {
        /** @type {uint8[]} */
        this.output = output;
        /** @type {uint32} */
        this.bitBuffer = 0;
        /** @type {int32} */
        this.bitsInBuffer = 0;
      }

      /**
       * Append one bit
       * @param {uint32} bit - 0 or 1
       */
      writeBit(bit) {
        this.bitBuffer = OpCodes.Or32(this.bitBuffer, OpCodes.Shl32(bit, 7 - this.bitsInBuffer));
        ++this.bitsInBuffer;
        if (this.bitsInBuffer === 8) {
          this.output.push(this.bitBuffer);
          this.bitBuffer = 0;
          this.bitsInBuffer = 0;
        }
      }

      /** Append the partial last byte, if any */
      flush() {
        if (this.bitsInBuffer > 0) {
          this.output.push(this.bitBuffer);
        }
      }
    }

    /**
     * MSB-first bit reader over a byte array; bits past the end read as 0
     */
    class OmegaBitReader {
      /**
       * @param {uint8[]} data - Bytes to read
       * @param {int32} bytePos - Index of the first byte
       */
      constructor(data, bytePos) {
        /** @type {uint8[]} */
        this.data = data;
        /** @type {int32} */
        this.bytePos = bytePos;
        /** @type {int32} */
        this.bitPos = 0;
      }

      /**
       * Read one bit
       * @returns {uint32} 0 or 1
       */
      readBit() {
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(this.data[this.bytePos], 7 - this.bitPos), 1);
        ++this.bitPos;
        if (this.bitPos === 8) {
          this.bitPos = 0;
          ++this.bytePos;
        }
        return bit;
      }
    }

    class OmegaCodingInstance extends IAlgorithmInstance {
      /**
       * @param {OmegaCodingAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decode
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decode, false = encode
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }

      /**
       * Encode or decode the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            result = empty;
          } else {
            result = this.decode(this.inputBuffer);
          }
        } else {
          result = this.encode(this.inputBuffer); // even empty input yields the 4-byte length header
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      // Matches CompressionWorkbench's OmegaBuildingBlock.Compress:
      //   4 bytes original length (little-endian); if 0, no payload follows.
      //   Otherwise, MSB-first bit-packed Elias Omega codes for (byte + 1).
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length header and Omega codes
       */
      encode(data) {
        /** @type {uint8[]} */
        const result = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) {
          return result;
        }

        /** @type {OmegaBitWriter} */
        const writer = new OmegaBitWriter(result);

        for (let k = 0; k < data.length; k++) {
          /** @type {int32} */
          const value = data[k] + 1;
          this._encodeOmega(writer, value);
        }

        writer.flush();

        return result;
      }

      // Matches CompressionWorkbench's OmegaBuildingBlock.Decompress
      /**
       * @param {uint8[]} data - Length header and Omega codes
       * @returns {uint8[]} Decoded bytes
       */
      decode(data) {
        /** @type {uint8[]} */
        const decodedBytes = [];
        /** @type {uint32} */
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) {
          return decodedBytes;
        }

        /** @type {OmegaBitReader} */
        const reader = new OmegaBitReader(data, 4);

        for (let i = 0; i < originalLength; ++i) {
          /** @type {int32} */
          const value = this._decodeOmega(reader);
          if (value < 1 || value > 256) {
            throw new Error('Invalid Omega code in compressed data');
          }
          decodedBytes.push(value - 1);
        }

        return decodedBytes;
      }

      // Elias Omega coding: collect the chain of successive length-groups
      // (N -> bit-length(N) - 1, repeated until N == 1), then emit them from
      // the innermost (smallest) group outward, MSB-first, followed by a
      // terminating zero bit.
      /**
       * @param {OmegaBitWriter} writer - Output bits
       * @param {int32} value - Positive integer
       */
      _encodeOmega(writer, value) {
        /** @type {int32[]} */
        const chain = [];
        /** @type {int32} */
        let n = value;
        while (n > 1) {
          chain.push(n);
          n = this._bitLength(n) - 1;
        }

        for (let i = chain.length - 1; i >= 0; --i) {
          /** @type {int32} */
          const group = chain[i];
          /** @type {int32} */
          const length = this._bitLength(group);
          for (let b = length - 1; b >= 0; --b) {
            writer.writeBit(OpCodes.And32(OpCodes.Shr32(group, b), 1));
          }
        }

        writer.writeBit(0);
      }

      // Canonical Elias Omega decode: start with N = 1; if the next bit is 0,
      // stop; otherwise read N further bits (with an implicit leading 1) to
      // form the new value of N. The group is kept as a signed 32-bit value.
      /**
       * @param {OmegaBitReader} reader - Input bits
       * @returns {int32} Decoded value
       */
      _decodeOmega(reader) {
        /** @type {int32} */
        let n = 1;
        for (;;) {
          /** @type {uint32} */
          const bit = reader.readBit();
          if (bit === 0) {
            return n;
          }

          /** @type {int32} */
          let group = 1;
          for (let i = 0; i < n; ++i) {
            group = OpCodes.ToInt(OpCodes.Or32(OpCodes.Shl32(group, 1), reader.readBit()));
          }
          n = group;
        }
      }

      /**
       * @param {int32} value - Non-negative value
       * @returns {int32} Number of significant bits
       */
      _bitLength(value) {
        /** @type {int32} */
        let len = 0;
        /** @type {uint32} */
        let v = value;
        while (v > 0) {
          ++len;
          v = OpCodes.Shr32(v, 1);
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