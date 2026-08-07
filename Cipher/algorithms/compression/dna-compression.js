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

      CreateInstance(isInverse = false) {
        return new DNACompressionInstance(this, isInverse);
      }
    }

    class DNACompressionInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // A=0, C=1, G=2, T=3; anything else becomes an exception escape.
        this.codeByByte = new Map([
          [65, 0], [67, 1], [71, 2], [84, 3] // A, C, G, T
        ]);
        this.byteByCode = [65, 67, 71, 84]; // A, C, G, T
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) return [];
          const result = this._decompress(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }

        // Even empty input produces a fixed 8-byte header (matches the
        // C# reference, which always writes length + exception count).
        const result = this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Matches CompressionWorkbench's DnaBuildingBlock.Compress: every byte
      // outside {A,C,G,T} is recorded as an exception (position + original
      // value) and packed as the placeholder code 0, so arbitrary input
      // round-trips exactly while pure nucleotide data still packs 4:1.
      _compress(data) {
        const result = OpCodes.Unpack32LE(data.length);

        if (data.length === 0) {
          const emptyCount = OpCodes.Unpack32LE(0); // exception count
          for (let _i = 0; _i < emptyCount.length; _i++) result.push(emptyCount[_i]);
          return result;
        }

        const exceptionPositions = [];
        for (let i = 0; i < data.length; i++)
          if (!this.codeByByte.has(data[i]))
            exceptionPositions.push(i);

        const exceptionCount = OpCodes.Unpack32LE(exceptionPositions.length);
        for (let _i = 0; _i < exceptionCount.length; _i++) result.push(exceptionCount[_i]);

        for (let e = 0; e < exceptionPositions.length; e++) {
          const position = exceptionPositions[e];
          const positionBytes = OpCodes.Unpack32LE(position);
          for (let _i = 0; _i < positionBytes.length; _i++) result.push(positionBytes[_i]);
          result.push(data[position]);
        }

        let packed = 0;
        let bitsInByte = 0;
        for (let i = 0; i < data.length; i++) {
          // Exception positions pack code 0; the decoder overwrites them.
          const code = this.codeByByte.has(data[i]) ? this.codeByByte.get(data[i]) : 0;
          packed = OpCodes.OrN(OpCodes.Shl32(packed, 2), code);
          bitsInByte += 2;
          if (bitsInByte === 8) {
            result.push(OpCodes.And32(packed, 0xFF));
            packed = 0;
            bitsInByte = 0;
          }
        }
        if (bitsInByte > 0)
          result.push(OpCodes.And32(OpCodes.Shl32(packed, 8 - bitsInByte), 0xFF));

        return result;
      }

      // Matches CompressionWorkbench's DnaBuildingBlock.Decompress, including
      // full exception splicing, so any well-formed stream the C# reference
      // produces (ACGT-only or otherwise) decodes correctly.
      _decompress(data) {
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) return [];

        const exceptionCount = OpCodes.Pack32LE(data[4], data[5], data[6], data[7]);
        const bodyStart = 8 + exceptionCount * 5;

        const result = new Array(originalLength);

        let bodyIndex = bodyStart;
        let bitsAvailable = 0;
        let buffer = 0;
        for (let i = 0; i < originalLength; i++) {
          if (bitsAvailable === 0) {
            buffer = data[bodyIndex++];
            bitsAvailable = 8;
          }
          const code = OpCodes.AndN(OpCodes.Shr32(buffer, bitsAvailable - 2), 0x3);
          bitsAvailable -= 2;
          result[i] = this.byteByCode[code];
        }

        let pos = 8;
        for (let i = 0; i < exceptionCount; i++) {
          const position = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
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
