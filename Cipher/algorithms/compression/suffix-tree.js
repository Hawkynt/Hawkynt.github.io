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
 * SuffixTreeAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class SuffixTreeAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Suffix Tree Compression";
        this.description = "Advanced lossless compression using suffix tree construction and longest common substring analysis. Exploits repetitive structure through efficient substring matching and reference-based encoding with optimal space utilization.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Suffix Structure";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "Edward McCreight, Esko Ukkonen";
        this.year = 1976;
        this.country = CountryCode.US;

        // Suffix Tree parameters (matches CompressionWorkbench's BB_SuffixTree)
        this.MIN_MATCH_LENGTH = 3;      // Minimum substring length for compression
        this.MAX_MATCH_LENGTH = 255;    // Maximum match length (fits a single control byte)

        this.documentation = [
          new LinkItem("Suffix Trees", "https://en.wikipedia.org/wiki/Suffix_tree"),
          new LinkItem("Ukkonen's Algorithm", "https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf"),
          new LinkItem("Suffix Tree Applications", "https://web.stanford.edu/~mjkay/suffix_trees.pdf")
        ];

        this.references = [
          new LinkItem("Linear Time Suffix Trees", "https://doi.org/10.1145/74073.74089"),
          new LinkItem("McCreight Suffix Trees", "https://dl.acm.org/doi/10.1145/321879.321884"),
          new LinkItem("Practical Suffix Trees", "https://github.com/kvh/suffix-trees"),
          new LinkItem("String Algorithms", "https://www.cambridge.org/core/books/string-algorithms/")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_SuffixTree):
        //   4 bytes original length (little-endian); if 0, no payload follows.
        //   Then a stream of tokens:
        //     0x00, count, <count raw bytes>        -- literal run (count <= 255)
        //     length (1-255), 4-byte LE offset       -- back-reference match
        this.tests = [
          new TestCase(
            [],
            [0, 0, 0, 0],
            "Empty input",
            "https://en.wikipedia.org/wiki/Suffix_tree"
          ),
          new TestCase(
            [97, 98, 97, 98, 97, 98], // "ababab"
            [6, 0, 0, 0, 0, 2, 97, 98, 4, 2, 0, 0, 0],
            "Repetitive pattern - optimal for suffix tree",
            "https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf"
          ),
          new TestCase(
            [98, 97, 110, 97, 110, 97], // "banana"
            [6, 0, 0, 0, 0, 3, 98, 97, 110, 3, 2, 0, 0, 0],
            "Classic suffix tree example",
            "https://web.stanford.edu/~mjkay/suffix_trees.pdf"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new SuffixTreeInstance(this, isInverse);
      }
    }

    class SuffixTreeInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Matches CompressionWorkbench's BB_SuffixTree
        this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
        this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.isInverse) {
          const result = this.decompress(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }

        // Even empty input produces a fixed 4-byte header (matches the
        // C# reference, which always writes the original length).
        const result = this.compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // LZ factorization driven by an incremental suffix trie: at every
      // position, descend the trie built from previously-seen data to find
      // the longest previously-seen prefix (a "longest previous factor"
      // query), then extend the trie with the remainder of this suffix.
      // Wire format:
      //   4 bytes original length (LE); if 0, no payload follows.
      //   0x00, count, <count raw bytes>   -- literal run (count <= 255)
      //   length (1-255), 4-byte LE offset -- back-reference match
      compress(data) {
        const compressed = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) return compressed;

        const root = { position: -1, children: null };
        let i = 0;
        let literalRun = [];

        const flushLiteralRun = () => {
          if (literalRun.length === 0) return;
          compressed.push(0, literalRun.length);
          compressed.push(...literalRun);
          literalRun = [];
        };

        while (i < data.length) {
          const match = this._findAndInsert(root, data, i);

          if (match.length >= this.minMatchLength) {
            flushLiteralRun();
            compressed.push(match.length);
            compressed.push(...OpCodes.Unpack32LE(i - match.position));
            i += match.length;
          } else {
            literalRun.push(data[i]);
            i++;
            if (literalRun.length === 255) flushLiteralRun();
          }
        }

        flushLiteralRun();
        return compressed;
      }

      decompress(data) {
        const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) return [];

        const result = new Array(originalLength);
        let outPos = 0;
        let pos = 4;

        while (outPos < originalLength) {
          const control = data[pos++];

          if (control === 0) {
            const count = data[pos++];
            for (let k = 0; k < count; k++)
              result[outPos++] = data[pos++];
            continue;
          }

          const length = control;
          const offset = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
          pos += 4;

          const srcPos = outPos - offset;
          for (let k = 0; k < length; k++)
            result[outPos + k] = result[srcPos + k];
          outPos += length;
        }

        return result;
      }

      /**
       * Descends the suffix trie from the root along data[i..], returning the
       * longest previously-recorded match found along the way (length + start
       * position), then extends the trie with the remainder of this suffix
       * (bounded by maxMatchLength) so later lookups can match deeper than any
       * single previous insertion reached. Every prefix node walked during the
       * match phase has its "most recent occurrence" position refreshed to i.
       * @private
       */
      _findAndInsert(root, data, i) {
        let node = root;
        let depth = 0;
        let bestLength = 0;
        let bestPosition = -1;
        const maxDepth = Math.min(this.maxMatchLength, data.length - i);

        // Phase 1: follow existing trie structure, recording the deepest match found.
        while (depth < maxDepth) {
          const b = data[i + depth];
          if (!node.children) node.children = new Map();

          const child = node.children.get(b);
          if (!child) break;

          if (child.position >= 0) {
            bestLength = depth + 1;
            bestPosition = child.position;
          }
          child.position = i;
          node = child;
          depth++;
        }

        // Phase 2: extend the trie with brand-new nodes for the rest of this
        // suffix, so a future occurrence of this longer prefix can be matched
        // in one lookup instead of needing to be rebuilt one level at a time.
        while (depth < maxDepth) {
          const newNode = { position: i, children: null };
          if (!node.children) node.children = new Map();
          node.children.set(data[i + depth], newNode);
          node = newNode;
          depth++;
        }

        return { length: bestLength, position: bestPosition };
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new SuffixTreeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SuffixTreeAlgorithm, SuffixTreeInstance };
}));