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
        this.description = "Lossless 2-bit-per-base packing for raw DNA sequences. Accepts ONLY the four canonical uppercase nucleotide bytes A, C, G, T; any other byte (including lowercase, 'N', whitespace, or FASTA/FASTQ headers) is rejected with an error rather than silently dropped, since 2-bit packing has no room to represent a fifth symbol losslessly.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Bioinformatics";
        // Declares that this codec accepts only part of the byte space, so the
        // round-trip suite scores a clean rejection as a domain limit rather
        // than a defect. A wrong-bytes result still counts as a failure.
        this.restrictedInputDomain = true;
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Bioinformatics Compression Research";
        this.year = 2010;
        this.country = CountryCode.INTL;

        this.documentation = [
          new LinkItem("DNA Compression Survey", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3834842/"),
          new LinkItem("Genomic Data Compression", "https://doi.org/10.1093/bioinformatics/btu513"),
          new LinkItem("FASTA Format Spec", "https://en.wikipedia.org/wiki/FASTA_format")
        ];

        this.references = [
          new LinkItem("BioPython DNA Tools", "https://biopython.org/"),
          new LinkItem("K-mer Analysis", "https://en.wikipedia.org/wiki/K-mer"),
          new LinkItem("2-bit DNA encoding (UCSC .2bit format)", "https://genome.ucsc.edu/FAQ/FAQformat.html#format7")
        ];

        // DNA compression test vectors. Format: [Length(4 bytes BE)][2-bit
        // packed nucleotides, 4 per byte, MSB-first; A=0,T=1,G=2,C=3].
        this.tests = [
          new TestCase(
            [], // Empty sequence
            [],
            "Empty DNA sequence",
            "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3834842/"
          ),
          new TestCase(
            [65, 84, 71, 67], // "ATGC" - basic nucleotides, exactly 1 packed byte
            [0, 0, 0, 4, 0x1B], // A(00) T(01) G(10) C(11) -> 00_01_10_11
            "Basic nucleotides - 2-bit encoding",
            "https://doi.org/10.1093/bioinformatics/btu513"
          ),
          new TestCase(
            [65, 84, 71, 67, 71, 67], // "ATGCGC" - not a multiple of 4 bases
            [0, 0, 0, 6, 0x1B, 0xB0], // ATGC -> 0x1B; GC + pad(0,0) -> 10_11_00_00
            "Length not a multiple of the 4-base packing unit",
            "https://en.wikipedia.org/wiki/FASTA_format"
          ),
          new TestCase(
            [65, 84, 71, 67, 65, 84, 71, 67, 65, 84, 71, 67], // "ATGCATGCATGC"
            [0, 0, 0, 12, 0x1B, 0x1B, 0x1B],
            "Repeating pattern",
            "https://biopython.org/"
          ),
          new TestCase(
            [71, 65, 84, 67], // "GATC"
            [0, 0, 0, 4, 0x87], // G(10) A(00) T(01) C(11) -> 10_00_01_11
            "Alternative nucleotide sequence",
            "https://en.wikipedia.org/wiki/K-mer"
          ),
          new TestCase(
            // All 4 nucleotides in every rotation, 37 bases (not a multiple of 4)
            OpCodes.AnsiToBytes("ACGTACGTACGTACGTACGTACGTACGTACGTACGTA"),
            [0, 0, 0, 37, 57, 57, 57, 57, 57, 57, 57, 57, 57, 0],
            "Long non-aligned sequence, length not a multiple of 4",
            "https://en.wikipedia.org/wiki/FASTA_format"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new DNACompressionInstance(this, isInverse);
      }
    }

    // Canonical nucleotide <-> 2-bit code mapping. Only these four uppercase
    // ASCII bytes are accepted; there is no fifth code point available in a
    // 2-bit field, so anything else (lowercase, 'N', whitespace, FASTA/FASTQ
    // headers, ...) must be rejected rather than silently dropped.
    const NUCLEOTIDE_TO_CODE = new Map([
      [65, 0], // A
      [84, 1], // T
      [71, 2], // G
      [67, 3]  // C
    ]);
    const CODE_TO_NUCLEOTIDE = [65, 84, 71, 67]; // A, T, G, C

    class DNACompressionInstance extends IAlgorithmInstance {
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
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ?
          this.decompress(this.inputBuffer) :
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      /**
       * Compress a raw ACGT nucleotide sequence into a 2-bit-per-base
       * packed representation: [Length(4 bytes BE)][packed bytes, 4 bases
       * per byte, MSB-first].
       *
       * Throws if any byte is not one of A/C/G/T - this codec is honest
       * about only supporting the four canonical nucleotides rather than
       * silently discarding unrecognized bytes (as the previous FASTA/
       * repeat-table implementation did, corrupting anything that wasn't
       * pure uppercase ACGT).
       */
      compress(data) {
        if (!data || data.length === 0) return [];

        const codes = new Array(data.length);
        for (let i = 0; i < data.length; i++) {
          const code = NUCLEOTIDE_TO_CODE.get(data[i]);
          if (code === undefined) {
            throw new Error(
              `DNA Sequence Compression only supports uppercase A/C/G/T nucleotides; ` +
              `invalid byte 0x${data[i].toString(16).padStart(2, '0')} at position ${i}`
            );
          }
          codes[i] = code;
        }

        const compressed = OpCodes.Words32ToBytesBE([data.length]);

        for (let i = 0; i < codes.length; i += 4) {
          let packedByte = 0;
          for (let j = 0; j < 4; j++) {
            const code = (i + j < codes.length) ? codes[i + j] : 0;
            packedByte = OpCodes.Or32(packedByte, OpCodes.Shl32(code, (3 - j) * 2));
          }
          compressed.push(OpCodes.ToByte(packedByte));
        }

        return compressed;
      }

      /**
       * Reverse compress(): unpack the 2-bit codes back into ACGT bytes.
       */
      decompress(data) {
        if (!data || data.length === 0) return [];
        if (data.length < 4) {
          throw new Error('Invalid DNA compressed data: missing length header');
        }

        const length = OpCodes.BytesToWords32BE(data.slice(0, 4))[0];
        if (length === 0) return [];

        const packedLength = Math.ceil(length / 4);
        if (data.length < 4 + packedLength) {
          throw new Error('Invalid DNA compressed data: truncated packed payload');
        }

        const result = new Array(length);
        for (let i = 0; i < length; i++) {
          const byteIndex = 4 + Math.floor(i / 4);
          const posInByte = i % 4;
          const shiftAmount = (3 - posInByte) * 2;
          const code = OpCodes.And32(OpCodes.Shr32(data[byteIndex], shiftAmount), 3);
          result[i] = CODE_TO_NUCLEOTIDE[code];
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