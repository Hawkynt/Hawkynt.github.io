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

        // Test vectors with actual compressed outputs
        this.tests = [
          new TestCase([], [], "Empty input", "https://en.wikipedia.org/wiki/Universal_code_(data_compression)"),
          new TestCase([65], [0,0,0,1,0,0,0,13,180,32], "Single byte value", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([65, 65], [0,0,0,2,0,0,0,26,180,37,161,0], "Repeated byte values", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([65, 66], [0,0,0,2,0,0,0,26,180,37,161,128], "Two different byte values", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([65, 66, 67], [0,0,0,3,0,0,0,39,180,37,161,173,16], "Three different byte values", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([72, 101, 108, 108, 111], [0,0,0,5,0,0,0,65,180,149,179,45,181,109,171,112,0], "Hello string bytes", "https://en.wikipedia.org/wiki/Elias_omega_coding"),
          new TestCase([1, 2, 3, 4, 5], [0,0,0,5,0,0,0,24,154,138,172], "Sequential small values", "https://en.wikipedia.org/wiki/Elias_omega_coding")
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
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? 
          this.decode(this.inputBuffer) : 
          this.encode(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      encode(data) {
        if (!data || data.length === 0) return [];

        let bitStream = '';

        // Encode each byte using Omega coding
        for (const byte of data) {
          // Omega coding cannot encode 0, so we use byte + 1
          const value = byte + 1;
          const omegaCode = this._encodeOmega(value);
          bitStream += omegaCode;
        }

        // Store original length and convert to bytes
        const compressed = this._packBitStream(bitStream, data.length);

        return this._stringToBytes(compressed);
      }

      decode(data) {
        if (!data || data.length === 0) return [];

        const compressedString = this._bytesToString(data);

        // Unpack bit stream and get original length
        const { bitStream, originalLength } = this._unpackBitStream(compressedString);

        const decodedBytes = [];
        let pos = 0;

        // Decode until we have the expected number of bytes
        while (decodedBytes.length < originalLength && pos < bitStream.length) {
          const { value, bitsConsumed } = this._decodeOmega(bitStream, pos);

          if (value === null) {
            throw new Error('Invalid Omega code in compressed data');
          }

          // Convert back to byte (subtract 1 since we added 1 during encoding)
          const byte = value - 1;
          if (byte < 0 || byte > 255) {
            throw new Error('Invalid byte value in compressed data');
          }

          decodedBytes.push(byte);
          pos += bitsConsumed;
        }

        if (decodedBytes.length !== originalLength) {
          throw new Error('Decompressed length mismatch');
        }

        return decodedBytes;
      }

      _encodeOmega(value) {
        // Elias Omega coding algorithm:
        // 1. Place a "0" at the end
        // 2. If N = 1, stop
        // 3. Prepend binary representation of N
        // 4. Let N = length of binary representation - 1
        // 5. Return to step 2

        let code = '0';
        let n = value;

        while (n > 1) {
          const binaryStr = n.toString(2);
          code = binaryStr + code;
          n = binaryStr.length - 1;
        }

        return code;
      }

      _decodeOmega(bitStream, startPos) {
        if (startPos >= bitStream.length) {
          return { value: null, bitsConsumed: 0 };
        }

        let pos = startPos;
        let n = 1;

        // Read codes until we can't continue
        while (pos < bitStream.length) {
          // If we see a '0', we're done
          if (bitStream[pos] === '0') {
            return { value: n, bitsConsumed: pos + 1 - startPos };
          }

          // Otherwise, read (n+1) bits
          const bitsToRead = n + 1;
          if (pos + bitsToRead > bitStream.length) {
            return { value: null, bitsConsumed: 0 };
          }

          const valueBits = bitStream.substring(pos, pos + bitsToRead);
          n = parseInt(valueBits, 2);
          pos += bitsToRead;
        }

        // If we ran out of bits, it's invalid
        return { value: null, bitsConsumed: 0 };
      }

      /**
       * Pack bit stream into bytes with header
       * @private
       */
      _packBitStream(bitStream, originalLength) {
        const bytes = [];

        // Store original length (4 bytes, big-endian)
        const lengthBytes = OpCodes.Unpack32BE(originalLength);
        bytes.push(lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]);

        // Store bit stream length (4 bytes, big-endian)
        const bitLength = bitStream.length;
        const bitLengthBytes = OpCodes.Unpack32BE(bitLength);
        bytes.push(bitLengthBytes[0], bitLengthBytes[1], bitLengthBytes[2], bitLengthBytes[3]);

        // Pad bit stream to byte boundary
        const padding = (8 - (bitStream.length % 8)) % 8;
        const paddedBits = bitStream + '0'.repeat(padding);

        // Convert to bytes
        for (let i = 0; i < paddedBits.length; i += 8) {
          const byte = paddedBits.substring(i, i + 8);
          bytes.push(parseInt(byte, 2));
        }

        return this._bytesToString(bytes);
      }

      /**
       * Unpack bit stream from bytes
       * @private
       */
      _unpackBitStream(compressedData) {
        const bytes = this._stringToBytes(compressedData);

        if (bytes.length < 8) {
          throw new Error('Invalid compressed data: header too short');
        }

        // Read original length
        const originalLength = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);

        // Read bit stream length
        const bitLength = OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);

        // Convert bytes back to bit stream
        let bitStream = '';
        for (let i = 8; i < bytes.length; i++) {
          bitStream += bytes[i].toString(2).padStart(8, '0');
        }

        // Trim to actual bit length
        bitStream = bitStream.substring(0, bitLength);

        return { bitStream, originalLength };
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xFF);
        }
        return bytes;
      }

      _bytesToString(bytes) {
        let str = "";
        for (let i = 0; i < bytes.length; i++) {
          str += String.fromCharCode(bytes[i]);
        }
        return str;
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