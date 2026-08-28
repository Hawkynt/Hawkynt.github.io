/*
 * Tunstall Coding Algorithm Implementation (Variable-to-Fixed Length Coding)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Tunstall coding is the classical variable-to-fixed length code: it builds a
 * complete binary parse tree over the *bit* stream of the source so that every
 * leaf carries (approximately) equal probability, then replaces each variable
 * length bit-string leaf with a single fixed-width codeword. This is the dual
 * of Huffman coding (which is fixed-to-variable).
 *
 * Reference:
 *   B. P. Tunstall, "Synthesis of Noiseless Compression Codes",
 *   Ph.D. dissertation, Georgia Institute of Technology, 1967.
 *   See also: T. J. Ferguson and J. H. Rabinowitz, "Self-synchronizing Huffman
 *   codes", IEEE Transactions on Information Theory, 1984 (background on
 *   variable-to-fixed codes and complete prefix trees).
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

  const CODE_BITS = 12; // fixed codeword width -> up to 4096 dictionary entries
  const MAX_ENTRIES = OpCodes.Shl32(1, CODE_BITS);

  /**
 * TunstallCompression - Variable-to-fixed length coding algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class TunstallCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Tunstall Coding";
        this.description = "Variable-to-fixed length source code. Builds a byte-alphabet dictionary by repeatedly splitting the highest-probability phrase into its 256 one-byte extensions, producing a set of variable-length input phrases that are each mapped to one fixed-width codeword.";
        this.inventor = "Brian Parker Tunstall";
        this.year = 1967;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Variable-to-Fixed Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Tunstall coding - Wikipedia", "https://en.wikipedia.org/wiki/Tunstall_coding"),
          new LinkItem("B.P. Tunstall PhD dissertation abstract (Georgia Tech, 1967)", "https://en.wikipedia.org/wiki/Tunstall_coding#History"),
          new LinkItem("Introduction to Data Compression (Sayood) - Variable-to-fixed codes", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory (Cover and Thomas)", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Self-synchronizing Huffman codes (Ferguson and Rabinowitz, 1984)", "https://doi.org/10.1109/TIT.1984.1056980")
        ];

        // Test vectors - matches CompressionWorkbench's BB_Tunstall building
        // block. The dictionary is rebuilt deterministically from the
        // transmitted 256-entry byte-frequency table, so the exact codeword
        // stream is fully reproducible. Expected vectors are given as hex
        // due to the fixed 1024-byte frequency table dominating the output
        // for small inputs.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: [0, 0, 0, 0]
          },
          {
            text: "Repetitive input - all zero bytes",
            uri: "https://en.wikipedia.org/wiki/Tunstall_coding",
            input: [0, 0, 0, 0, 0, 0, 0, 0],
            expected: OpCodes.Hex8ToBytes("0800000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000")
          },
          {
            text: "Text sample - 'ABAAAB'",
            uri: "https://en.wikipedia.org/wiki/Tunstall_coding",
            input: OpCodes.AsciiToBytes("ABAAAB"),
            expected: OpCodes.Hex8ToBytes("0600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000E34042")
          },
          {
            text: "Text sample - pangram sentence",
            uri: "https://en.wikipedia.org/wiki/Tunstall_coding",
            input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog"),
            expected: OpCodes.Hex8ToBytes("2B00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000100000001000000010000000300000001000000010000000200000001000000010000000100000001000000010000000100000004000000010000000100000002000000010000000200000002000000010000000100000001000000010000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000D6761F071E6846A161C6E07706E165B77169E6C07007316E07667117396416B279079163B660")
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new TunstallInstance(this, isInverse);
      }
    }

    class TunstallInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }


      Result() {
        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Wire format (matches CompressionWorkbench's BB_Tunstall building
      // block): a 4-byte little-endian original length, then (unless the
      // input is empty) a fixed 256-entry byte-frequency table (4-byte
      // little-endian counts), followed by a stream of fixed CODE_BITS-wide
      // codewords (MSB-first, zero-padded to a byte boundary). Each
      // codeword indexes a byte-alphabet dictionary of variable-length
      // input phrases, rebuilt independently and deterministically on both
      // sides from the transmitted frequency table.

      // ----- Shared: build a byte-alphabet Tunstall dictionary -----

      _buildDictionary(prob) {
        // Start with 256 single-byte phrases (one per symbol).
        let entries = [];
        for (let i = 0; i < 256; i++) entries.push({ phrase: [i], prob: prob[i] });

        // Extend the highest-probability leaf until we reach MAX_ENTRIES.
        while (entries.length + 255 <= MAX_ENTRIES) {
          let bestIdx = 0;
          let bestProb = entries[0].prob;
          for (let i = 1; i < entries.length; i++) {
            if (entries[i].prob > bestProb) { bestProb = entries[i].prob; bestIdx = i; }
          }

          if (bestProb <= 0) break;

          // Replace the leaf with 256 children (leaf + each possible next byte).
          const parent = entries[bestIdx];
          entries.splice(bestIdx, 1);

          for (let c = 0; c < 256; c++)
            entries.push({ phrase: parent.phrase.concat([c]), prob: parent.prob * prob[c] });
        }

        // Ensure all 256 single-byte entries exist (splitting may have removed some).
        const hasSingleByte = new Array(256).fill(false);
        for (const e of entries) if (e.phrase.length === 1) hasSingleByte[e.phrase[0]] = true;
        for (let i = 0; i < 256; i++)
          if (!hasSingleByte[i]) entries.push({ phrase: [i], prob: prob[i] });

        // Sort by phrase for deterministic ordering: lexicographic on (length, content).
        entries.sort((a, b) => {
          const lenCmp = a.phrase.length - b.phrase.length;
          if (lenCmp !== 0) return lenCmp;
          for (let i = 0; i < a.phrase.length; i++) {
            const cmp = a.phrase[i] - b.phrase[i];
            if (cmp !== 0) return cmp;
          }
          return 0;
        });

        return entries.map(e => e.phrase);
      }

      // ----- Compression -----

      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);

        if (data.length === 0) return bitStream.toArray();

        const freq = new Array(256).fill(0);
        for (const b of data) freq[b]++;

        const prob = new Array(256);
        for (let i = 0; i < 256; i++) prob[i] = freq[i] / data.length;

        for (let i = 0; i < 256; i++) bitStream.writeUint32LE(freq[i]);

        const dictionary = this._buildDictionary(prob);

        // Encode: greedily match the longest dictionary phrase at each position.
        let pos = 0;
        while (pos < data.length) {
          let bestCode = -1, bestLen = 0;

          for (let d = 0; d < dictionary.length; d++) {
            const phrase = dictionary[d];
            if (phrase.length <= bestLen || pos + phrase.length > data.length) continue;

            let match = true;
            for (let j = 0; j < phrase.length; j++) {
              if (data[pos + j] !== phrase[j]) { match = false; break; }
            }

            if (match) { bestCode = d; bestLen = phrase.length; }
          }

          if (bestCode < 0) {
            // Fallback: single-byte entry must always exist.
            bestCode = data[pos];
            bestLen = 1;
          }

          bitStream.writeBits(bestCode, CODE_BITS);
          pos += bestLen;
        }

        return bitStream.toArray();
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 4) return [];

        const bitStream = OpCodes.CreateBitStream(data);
        const originalSize = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());
        if (originalSize === 0) return [];

        const freq = new Array(256);
        for (let i = 0; i < 256; i++)
          freq[i] = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());

        let total = 0;
        for (let i = 0; i < 256; i++) total += freq[i];

        const prob = new Array(256).fill(0);
        if (total > 0) for (let i = 0; i < 256; i++) prob[i] = freq[i] / total;

        const dictionary = this._buildDictionary(prob);

        const result = [];
        while (result.length < originalSize) {
          const code = bitStream.readBits(CODE_BITS);
          if (code >= dictionary.length)
            throw new Error(`Tunstall codeword ${code} exceeds dictionary size ${dictionary.length}.`);

          const phrase = dictionary[code];
          for (let j = 0; j < phrase.length && result.length < originalSize; j++) result.push(phrase[j]);
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new TunstallCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TunstallCompression, TunstallInstance };
}));
