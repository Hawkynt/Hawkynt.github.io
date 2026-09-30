/*
 * PackBits Run-Length Encoding Algorithm Implementation  
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * PackBits RLE - Classic run-length encoding used in TIFF, PostScript, and Apple systems
 * Simple but effective for data with runs of identical bytes
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
 * PackBitsAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class PackBitsAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "PackBits RLE";
        this.description = "Classic run-length encoding algorithm used in TIFF images, PostScript, and early Apple computer systems. Simple but effective for data with runs of identical bytes.";
        this.inventor = "Apple Computer";
        this.year = 1984;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Run-Length Encoding";
        this.securityStatus = null;
        this.complexity = ComplexityType.BASIC;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("PackBits Wikipedia", "https://en.wikipedia.org/wiki/PackBits"),
          new LinkItem("TIFF Specification", "https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf")
        ];

        this.references = [
          new LinkItem("Apple Technical Note TN1023", "http://developer.apple.com/technotes/tn/tn1023.html"),
          new LinkItem("PostScript Language Reference", "https://www.adobe.com/products/postscript/pdfs/PLRM.pdf"),
          new LinkItem("TIFF 6.0 Specification", "https://partners.adobe.com/public/developer/en/tiff/TIFF6.pdf")
        ];

        // Test vectors - based on PackBits RLE specifications
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input",
            "https://en.wikipedia.org/wiki/PackBits"
          ),
          new TestCase(
            [65],
            [0, 65],
            "Single byte literal",
            "https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf"
          ),
          new TestCase(
            [65, 65, 65],
            [254, 65],
            "Simple run of 3 identical bytes",
            "http://developer.apple.com/technotes/tn/tn1023.html"
          ),
          new TestCase(
            [65, 66, 67],
            [2, 65, 66, 67],
            "Three different literals",
            "https://www.adobe.com/products/postscript/pdfs/PLRM.pdf"
          ),
          new TestCase(
            [65, 65, 65, 65, 66, 67, 68],
            [253, 65, 2, 66, 67, 68],
            "Run followed by literals",
            "https://partners.adobe.com/public/developer/en/tiff/TIFF6.pdf"
          ),
          new TestCase(
            [65, 66, 67, 68, 68, 68, 68],
            [2, 65, 66, 67, 253, 68],
            "Literals followed by run",
            "https://en.wikipedia.org/wiki/PackBits"
          ),
          new TestCase(
            new Array(128).fill(65),
            [129, 65],
            "Maximum run length (128 bytes)",
            "https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf"
          ),
          new TestCase(
            Array.from({length: 128}, (_, i) => i),
            [127].concat(Array.from({length: 128}, (_, i) => i)),
            "Maximum literal sequence (128 bytes)",
            "http://developer.apple.com/technotes/tn/tn1023.html"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {PackBitsInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new PackBitsInstance(this, isInverse);
      }
    }

    class PackBitsInstance extends IAlgorithmInstance {
      /**
       * @param {PackBitsAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decompress, false = compress
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // PackBits parameters
        /** @type {int32} */
        this.MAX_RUN_LENGTH = 128; // Maximum run length
        /** @type {int32} */
        this.MAX_LITERAL_LENGTH = 128; // Maximum literal sequence length
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result = [];
        if (this.inputBuffer.length === 0) {
          return result;
        }

        if (this.isInverse) {
          result = this.decompress(this.inputBuffer);
        } else {
          result = this.compress(this.inputBuffer);
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} PackBits stream
       */
      compress(data) {
        /** @type {uint8[]} */
        const output = [];
        if (!data || data.length === 0) {
          return output;
        }

        /** @type {int32} */
        let i = 0;

        while (i < data.length) {
          // Check for run of identical bytes
          /** @type {int32} */
          let runLength = 1;
          while (i + runLength < data.length &&
                 data[i + runLength] === data[i] &&
                 runLength < this.MAX_RUN_LENGTH) {
            runLength++;
          }

          if (runLength >= 3) {
            // Encode as run: (257 - runLength), value
            // PackBits encodes run length as 257 - runLength
            output.push(257 - runLength);
            output.push(data[i]);
            i += runLength;
          } else {
            // Collect literal sequence
            /** @type {int32} */
            const literalStart = i;
            /** @type {int32} */
            let literalLength = 0;

            while (i < data.length && literalLength < this.MAX_LITERAL_LENGTH) {
              // Check if we're about to hit a run of 3+ identical bytes
              /** @type {int32} */
              let nextRunLength = 1;
              while (i + nextRunLength < data.length &&
                     data[i + nextRunLength] === data[i] &&
                     nextRunLength < 3) {
                nextRunLength++;
              }

              if (nextRunLength >= 3) {
                // Stop collecting literals before the run
                break;
              }

              literalLength++;
              i++;
            }

            if (literalLength > 0) {
              // Encode as literal sequence: (literalLength - 1), bytes...
              output.push(literalLength - 1);
              for (let j = 0; j < literalLength; j++) {
                output.push(data[literalStart + j]);
              }
            }
          }
        }

        return output;
      }

      /**
       * @param {uint8[]} data - PackBits stream
       * @returns {uint8[]} Expanded bytes
       */
      decompress(data) {
        /** @type {uint8[]} */
        const output = [];
        if (!data || data.length === 0) {
          return output;
        }

        /** @type {int32} */
        let i = 0;

        while (i < data.length) {
          /** @type {int32} */
          const controlByte = data[i++];

          if (controlByte >= 0 && controlByte <= 127) {
            // Literal sequence: copy next (controlByte + 1) bytes
            /** @type {int32} */
            const literalLength = controlByte + 1;
            for (let j = 0; j < literalLength && i < data.length; j++) {
              output.push(data[i++]);
            }
          } else if (controlByte >= 128 && controlByte <= 255) {
            // Run: repeat next byte (257 - controlByte) times
            if (i < data.length) {
              /** @type {int32} */
              const runLength = 257 - controlByte;
              /** @type {uint8} */
              const value = data[i++];
              for (let j = 0; j < runLength; j++) {
                output.push(value);
              }
            }
          }
          // controlByte == 128 is reserved/no-op in some implementations
        }

        return output;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new PackBitsAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PackBitsAlgorithm, PackBitsInstance };
}));