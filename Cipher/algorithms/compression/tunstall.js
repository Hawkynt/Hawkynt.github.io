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

  /** @type {int32} */
  const CODE_BITS = 12; // fixed codeword width -> up to 4096 dictionary entries
  /** @type {int32} */
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

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {TunstallInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new TunstallInstance(this, isInverse);
      }
    }

    /**
     * One dictionary phrase and its probability
     */
    class TunstallEntry {
      /**
       * @param {uint8[]} phrase - Input bytes the codeword stands for
       * @param {float64} prob - Probability of the phrase
       */
      constructor(phrase, prob) {
        /** @type {uint8[]} */
        this.phrase = phrase;
        /** @type {float64} */
        this.prob = prob;
      }
    }

    /**
     * Phrase order: shorter first, equal lengths lexicographically by content
     * @param {uint8[]} a - First phrase
     * @param {uint8[]} b - Second phrase
     * @returns {int32} Negative, zero or positive as a sorts before, with or after b
     */
    function comparePhrases(a, b) {
      /** @type {int32} */
      const lenCmp = a.length - b.length;
      if (lenCmp !== 0) {
        return lenCmp;
      }
      for (let i = 0; i < a.length; i++) {
        /** @type {int32} */
        const cmp = a[i] - b[i];
        if (cmp !== 0) {
          return cmp;
        }
      }
      return 0;
    }

    /**
     * Sort entries by phrase (stable merge sort). The phrases are distinct and
     * the order is total, so the result is the one any correct sort yields.
     * @param {TunstallEntry[]} entries - Entries, sorted in place
     */
    function sortEntriesByPhrase(entries) {
      /** @type {int32} */
      const n = entries.length;
      /** @type {TunstallEntry[]} */
      let src = entries.slice();
      /** @type {TunstallEntry[]} */
      let dst = new Array(n);
      for (let width = 1; width < n; width *= 2) {
        for (let lo = 0; lo < n; lo += 2 * width) {
          /** @type {int32} */
          const mid = Math.min(lo + width, n);
          /** @type {int32} */
          const hi = Math.min(lo + 2 * width, n);
          /** @type {int32} */
          let i = lo;
          /** @type {int32} */
          let j = mid;
          /** @type {int32} */
          let k = lo;
          while (i < mid && j < hi) {
            if (comparePhrases(src[j].phrase, src[i].phrase) < 0) {
              dst[k++] = src[j++];
            } else {
              dst[k++] = src[i++];
            }
          }
          while (i < mid) {
            dst[k++] = src[i++];
          }
          while (j < hi) {
            dst[k++] = src[j++];
          }
        }
        /** @type {TunstallEntry[]} */
        const swap = src;
        src = dst;
        dst = swap;
      }
      for (let i = 0; i < n; i++) {
        entries[i] = src[i];
      }
    }

    class TunstallInstance extends IAlgorithmInstance {
      /**
       * @param {TunstallCompression} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result;
        if (this.isInverse) {
          result = this._decompress(this.inputBuffer);
        } else {
          result = this._compress(this.inputBuffer);
        }
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
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

      /**
       * @param {float64[]} prob - Probability of every byte value
       * @returns {uint8[][]} Phrases, indexed by codeword
       */
      _buildDictionary(prob) {
        // Start with 256 single-byte phrases (one per symbol).
        /** @type {TunstallEntry[]} */
        const entries = [];
        for (let i = 0; i < 256; i++) {
          /** @type {uint8[]} */
          const single = [];
          single.push(i);
          entries.push(new TunstallEntry(single, prob[i]));
        }

        // Extend the highest-probability leaf until we reach MAX_ENTRIES.
        while (entries.length + 255 <= MAX_ENTRIES) {
          /** @type {int32} */
          let bestIdx = 0;
          /** @type {float64} */
          let bestProb = entries[0].prob;
          for (let i = 1; i < entries.length; i++) {
            if (entries[i].prob > bestProb) {
              bestProb = entries[i].prob;
              bestIdx = i;
            }
          }

          if (bestProb <= 0) {
            break;
          }

          // Replace the leaf with 256 children (leaf + each possible next byte).
          /** @type {TunstallEntry} */
          const parent = entries[bestIdx];
          entries.splice(bestIdx, 1);

          for (let c = 0; c < 256; c++) {
            /** @type {uint8[]} */
            const extended = parent.phrase.slice();
            extended.push(c);
            entries.push(new TunstallEntry(extended, parent.prob * prob[c]));
          }
        }

        // Ensure all 256 single-byte entries exist (splitting may have removed some).
        /** @type {boolean[]} */
        const hasSingleByte = new Array(256);
        for (let i = 0; i < 256; i++) {
          hasSingleByte[i] = false;
        }
        for (let k = 0; k < entries.length; k++) {
          if (entries[k].phrase.length === 1) {
            hasSingleByte[entries[k].phrase[0]] = true;
          }
        }
        for (let i = 0; i < 256; i++) {
          if (!hasSingleByte[i]) {
            /** @type {uint8[]} */
            const single = [];
            single.push(i);
            entries.push(new TunstallEntry(single, prob[i]));
          }
        }

        // Sort by phrase for deterministic ordering: lexicographic on (length, content).
        sortEntriesByPhrase(entries);

        /** @type {uint8[][]} */
        const phrases = [];
        for (let k = 0; k < entries.length; k++) {
          phrases.push(entries[k].phrase);
        }
        return phrases;
      }

      // ----- Compression -----

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Length, frequency table and codewords
       */
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);

        if (data.length === 0) {
          /** @type {uint8[]} */
          const headerOnly = bitStream.toArray();
          return headerOnly;
        }

        /** @type {int32[]} */
        const freq = new Array(256);
        for (let i = 0; i < 256; i++) {
          freq[i] = 0;
        }
        for (let k = 0; k < data.length; k++) {
          freq[data[k]]++;
        }

        /** @type {float64[]} */
        const prob = new Array(256);
        for (let i = 0; i < 256; i++) {
          prob[i] = freq[i] / data.length;
        }

        for (let i = 0; i < 256; i++) {
          bitStream.writeUint32LE(freq[i]);
        }

        /** @type {uint8[][]} */
        const dictionary = this._buildDictionary(prob);

        // Encode: greedily match the longest dictionary phrase at each position.
        /** @type {int32} */
        let pos = 0;
        while (pos < data.length) {
          /** @type {int32} */
          let bestCode = -1;
          /** @type {int32} */
          let bestLen = 0;

          for (let d = 0; d < dictionary.length; d++) {
            /** @type {uint8[]} */
            const phrase = dictionary[d];
            if (phrase.length <= bestLen || pos + phrase.length > data.length) {
              continue;
            }

            /** @type {boolean} */
            let match = true;
            for (let j = 0; j < phrase.length; j++) {
              if (data[pos + j] !== phrase[j]) {
                match = false;
                break;
              }
            }

            if (match) {
              bestCode = d;
              bestLen = phrase.length;
            }
          }

          if (bestCode < 0) {
            // Fallback: single-byte entry must always exist.
            bestCode = data[pos];
            bestLen = 1;
          }

          bitStream.writeBits(bestCode, CODE_BITS);
          pos += bestLen;
        }

        /** @type {uint8[]} */
        const packed = bitStream.toArray();
        return packed;
      }

      // ----- Decompression -----

      /**
       * @param {uint8[]} data - Length, frequency table and codewords
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        /** @type {uint8[]} */
        const result = [];
        if (data.length < 4) {
          return result;
        }

        const bitStream = OpCodes.CreateBitStream(data);
        /** @type {uint32} */
        const originalSize = this._readUint32LE(bitStream);
        if (originalSize === 0) {
          return result;
        }

        /** @type {float64[]} */
        const freq = new Array(256);
        for (let i = 0; i < 256; i++) {
          freq[i] = this._readUint32LE(bitStream);
        }

        /** @type {float64} */
        let total = 0;
        for (let i = 0; i < 256; i++) {
          total += freq[i];
        }

        /** @type {float64[]} */
        const prob = new Array(256);
        for (let i = 0; i < 256; i++) {
          prob[i] = 0;
        }
        if (total > 0) {
          for (let i = 0; i < 256; i++) {
            prob[i] = freq[i] / total;
          }
        }

        /** @type {uint8[][]} */
        const dictionary = this._buildDictionary(prob);

        while (result.length < originalSize) {
          /** @type {uint32} */
          const code = bitStream.readBits(CODE_BITS);
          if (code >= dictionary.length) {
            throw new Error("Tunstall codeword " + code + " exceeds dictionary size " + dictionary.length + ".");
          }

          /** @type {uint8[]} */
          const phrase = dictionary[code];
          for (let j = 0; j < phrase.length && result.length < originalSize; j++) {
            result.push(phrase[j]);
          }
        }

        return result;
      }

      /**
       * @param {_BitStream} bitStream - Input bits
       * @returns {uint32} Next four bytes as a little-endian value
       */
      _readUint32LE(bitStream) {
        /** @type {uint8} */
        const c0 = bitStream.readByte();
        /** @type {uint8} */
        const c1 = bitStream.readByte();
        /** @type {uint8} */
        const c2 = bitStream.readByte();
        /** @type {uint8} */
        const c3 = bitStream.readByte();
        return OpCodes.Pack32LE(c0, c1, c2, c3);
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
