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
 * DNACompressionAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class DNACompressionAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "DNA Sequence Compression";
        this.description = "2-bit packing for the four canonical DNA nucleotide symbols (A, C, G, T), four symbols per byte, giving 4:1 on pure nucleotide data. Bytes outside that alphabet are recorded in an exception list (position plus original value) and packed as a placeholder code, so arbitrary byte streams still round-trip exactly. Byte-for-byte identical to CompressionWorkbench's BB_Dna reference block.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Bioinformatics";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "W. James Kent (UCSC 2bit format)";
        this.year = 2002;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem("UCSC 2bit Sequence Format", "https://genome.ucsc.edu/FAQ/FAQformat.html#format7"),
          new LinkItem("FASTA Format Spec", "https://en.wikipedia.org/wiki/FASTA_format")
        ];

        this.references = [
          new LinkItem("BioPython DNA Tools", "https://biopython.org/"),
          new LinkItem("Genomic Data Compression Survey", "https://doi.org/10.1093/bioinformatics/btu513")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_Dna):
        //   4 bytes original length (little-endian)
        //   4 bytes exception count (little-endian)
        //   exceptionCount x 5 bytes: 4-byte little-endian position + original byte
        //   MSB-first 2-bit-per-symbol packed data (A=0, C=1, G=2, T=3),
        //   zero-padded to a byte boundary; exception positions carry the
        //   placeholder code 0 and are overwritten from the list on decode
        this.tests = [
          new TestCase(
            [],
            [0, 0, 0, 0, 0, 0, 0, 0],
            "Empty DNA sequence",
            "https://genome.ucsc.edu/FAQ/FAQformat.html#format7"
          ),
          new TestCase(
            [65, 67, 71, 84], // "ACGT"
            [4, 0, 0, 0, 0, 0, 0, 0, 27],
            "Basic nucleotides - 2-bit encoding",
            "https://doi.org/10.1093/bioinformatics/btu513"
          ),
          new TestCase(
            [65, 67, 71, 84, 71, 67], // "ACGTGC"
            [6, 0, 0, 0, 0, 0, 0, 0, 27, 144],
            "Simple nucleotide sequence",
            "https://en.wikipedia.org/wiki/FASTA_format"
          ),
          new TestCase(
            [65, 67, 71, 84, 78, 65, 67, 71, 84, 78], // "ACGTNACGTN" - N is not a 2-bit code point
            [10, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 78, 9, 0, 0, 0, 78, 27, 6, 192],
            "Ambiguity code N escaped through the exception list",
            "https://genome.ucsc.edu/FAQ/FAQformat.html#format7"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {DNACompressionInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new DNACompressionInstance(this, isInverse);
      }
    }

    class DNACompressionInstance extends IAlgorithmInstance {
      /**
       * @param {DNACompressionAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // A=0, C=1, G=2, T=3; anything else becomes an exception escape.
        // Indexed by byte value; -1 marks a byte that is not a nucleotide.
        /** @type {int32[]} */
        this.codeByByte = new Array(256);
        for (let b = 0; b < 256; b++) {
          this.codeByByte[b] = -1;
        }
        this.codeByByte[65] = 0; // A
        this.codeByByte[67] = 1; // C
        this.codeByByte[71] = 2; // G
        this.codeByByte[84] = 3; // T
        /** @type {uint8[]} */
        this.byteByCode = [65, 67, 71, 84]; // A, C, G, T
      }

      /**
       * 2-bit code of a nucleotide byte
       * @param {uint8} value - Byte
       * @returns {int32} Its code 0..3, or -1 when it is not A, C, G or T
       */
      _codeOf(value) {
        if (value >= 0 && value < 256) {
          return this.codeByByte[value];
        }
        return -1;
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          /** @type {uint8[]} */
          const decoded = this._decompress(this.inputBuffer);
          /** @type {uint8[]} */
          const freshInput = [];
          this.inputBuffer = freshInput;
          return decoded;
        }

        // Even empty input produces a fixed 8-byte header (matches the
        // C# reference, which always writes length + exception count).
        /** @type {uint8[]} */
        const result = this._compress(this.inputBuffer);
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      // Matches CompressionWorkbench's DnaBuildingBlock.Compress: every byte
      // outside {A,C,G,T} is recorded as an exception (position + original
      // value) and packed as the placeholder code 0, so arbitrary input
      // round-trips exactly while pure nucleotide data still packs 4:1.
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length, exception list and packed 2-bit codes
       */
      _compress(data) {
        /** @type {uint8[]} */
        const result = OpCodes.Unpack32LE(data.length);

        if (data.length === 0) {
          /** @type {uint8[]} */
          const emptyCount = OpCodes.Unpack32LE(0); // exception count
          for (let k = 0; k < emptyCount.length; k++) {
            result.push(emptyCount[k]);
          }
          return result;
        }

        /** @type {int32[]} */
        const exceptionPositions = [];
        for (let i = 0; i < data.length; i++) {
          if (this._codeOf(data[i]) < 0) {
            exceptionPositions.push(i);
          }
        }

        /** @type {uint8[]} */
        const exceptionCount = OpCodes.Unpack32LE(exceptionPositions.length);
        for (let k = 0; k < exceptionCount.length; k++) {
          result.push(exceptionCount[k]);
        }

        for (let e = 0; e < exceptionPositions.length; e++) {
          /** @type {int32} */
          const position = exceptionPositions[e];
          /** @type {uint8[]} */
          const positionBytes = OpCodes.Unpack32LE(position);
          for (let k = 0; k < positionBytes.length; k++) {
            result.push(positionBytes[k]);
          }
          result.push(data[position]);
        }

        /** @type {uint32} */
        let packed = 0;
        /** @type {int32} */
        let bitsInByte = 0;
        for (let i = 0; i < data.length; i++) {
          // Exception positions pack code 0; the decoder overwrites them.
          /** @type {int32} */
          const known = this._codeOf(data[i]);
          /** @type {int32} */
          const code = known >= 0 ? known : 0;
          packed = OpCodes.Or32(OpCodes.Shl32(packed, 2), code);
          bitsInByte += 2;
          if (bitsInByte === 8) {
            result.push(OpCodes.And32(packed, 0xFF));
            packed = 0;
            bitsInByte = 0;
          }
        }
        if (bitsInByte > 0) {
          result.push(OpCodes.And32(OpCodes.Shl32(packed, 8 - bitsInByte), 0xFF));
        }

        return result;
      }

      // Matches CompressionWorkbench's DnaBuildingBlock.Decompress, including
      // full exception splicing, so any well-formed stream the C# reference
      // produces (ACGT-only or otherwise) decodes correctly.
      /**
       * @param {uint8[]} data - Length, exception list and packed 2-bit codes
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        /** @type {uint32} */
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        /** @type {float64} */
        const exceptionCount = OpCodes.Pack32LE(data[4], data[5], data[6], data[7]);
        // Five bytes per exception; a corrupt count can make this exceed 2^32,
        // so the count and the offset are exact float64 values
        /** @type {float64} */
        const bodyStart = 8 + exceptionCount * 5;

        /** @type {uint8[]} */
        const result = new Array(originalLength);

        /** @type {float64} */
        let bodyIndex = bodyStart;
        /** @type {int32} */
        let bitsAvailable = 0;
        /** @type {uint8} */
        let buffer = 0;
        for (let i = 0; i < originalLength; i++) {
          if (bitsAvailable === 0) {
            buffer = data[bodyIndex++];
            bitsAvailable = 8;
          }
          /** @type {uint32} */
          const code = OpCodes.And32(OpCodes.Shr32(buffer, bitsAvailable - 2), 0x3);
          bitsAvailable -= 2;
          result[i] = this.byteByCode[code];
        }

        /** @type {int32} */
        let pos = 8;
        for (let i = 0; i < exceptionCount; i++) {
          /** @type {uint32} */
          const position = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
          /** @type {uint8} */
          const value = data[pos + 4];
          result[position] = value;
          pos += 5;
        }

        return result;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new DNACompressionAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DNACompressionAlgorithm, DNACompressionInstance };
}));
