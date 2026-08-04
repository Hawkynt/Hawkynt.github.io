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
        this.description = "2-bit packing for the four canonical DNA nucleotide symbols (A, C, G, T), four symbols per byte. Only pure ACGT input is accepted; any other byte is rejected rather than silently corrupted, since 2-bit codes have no code point for a fifth symbol.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Bioinformatics";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "W. James Kent (UCSC 2bit format)";
        this.year = 2002;
        this.country = CountryCode.US;

        // This codec only accepts A/C/G/T input; it rejects everything else
        // loudly instead of silently corrupting it. See tests/RoundTripSuite.js.
        this.restrictedInputDomain = true;

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
        //   4 bytes exception count (little-endian) -- always 0 here, since
        //     Cipher rejects non-ACGT input up front rather than escaping it
        //   MSB-first 2-bit-per-symbol packed data (A=0, C=1, G=2, T=3),
        //   zero-padded to a byte boundary
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

        // A=0, C=1, G=2, T=3; anything else is out of domain on encode.
        this.codeByByte = new Map([
          [65, 0], [67, 1], [71, 2], [84, 3] // A, C, G, T
        ]);
        this.byteByCode = [65, 67, 71, 84]; // A, C, G, T
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
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

      // Matches CompressionWorkbench's DnaBuildingBlock.Compress, restricted
      // to pure ACGT input: any byte outside {A,C,G,T} is rejected explicitly
      // rather than packed as a silently-corrupting exception escape.
      _compress(data) {
        const result = OpCodes.Unpack32LE(data.length);

        if (data.length === 0) {
          result.push(...OpCodes.Unpack32LE(0)); // exception count
          return result;
        }

        for (const byte of data)
          if (!this.codeByByte.has(byte))
            throw new Error('DNA Sequence Compression only accepts A, C, G, T bytes (got 0x' + byte.toString(16) + ')');

        result.push(...OpCodes.Unpack32LE(0)); // exception count (always 0: no out-of-domain bytes)

        let packed = 0;
        let bitsInByte = 0;
        for (const byte of data) {
          const code = this.codeByByte.get(byte);
          packed = OpCodes.OrN(OpCodes.Shl32(packed, 2), code);
          bitsInByte += 2;
          if (bitsInByte === 8) {
            result.push(packed);
            packed = 0;
            bitsInByte = 0;
          }
        }
        if (bitsInByte > 0)
          result.push(OpCodes.Shl32(packed, 8 - bitsInByte));

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
