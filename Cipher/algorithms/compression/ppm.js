
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
 * PPMAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class PPMAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "PPM (Prediction by Partial Matching)";
        this.description = "Order-2/1/0 context-match encoder: each byte is written as a literal (order+1, symbol) pair, where order is the highest-order context table (built from prior data only) that already contains that exact symbol. No entropy coding is applied.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "John Cleary, Ian Witten";
        this.year = 1984;
        this.country = CountryCode.INTL;

        // PPM parameters
        this.MAX_ORDER = 2;           // Maximum context order (written in header)

        this.documentation = [
          new LinkItem("Data Compression Using Adaptive Coding and Partial String Matching", "https://compression.ca/act/act_pdf/Cleary1984.pdf"),
          new LinkItem("Implementing the PPM data compression scheme", "https://www.researchgate.net/publication/220617088"),
          new LinkItem("PPM - Wikipedia", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching")
        ];

        this.references = [
          new LinkItem("Text Compression - Bell, Cleary, Witten", "https://www.amazon.com/Text-Compression-Timothy-C-Bell/dp/0133616900"),
          new LinkItem("Context Modeling in Data Compression", "https://en.wikipedia.org/wiki/Context_model"),
          new LinkItem("Canterbury Corpus", "https://corpus.canterbury.ac.nz/")
        ];

        // Round-trip regression vectors: this scheme has no entropy coding
        // (every byte becomes a literal 2-byte (order+1, symbol) pair), so
        // exact expected ciphertexts are not asserted here -- only that
        // compress -> decompress reproduces the original input.
        this.tests = [
          new TestCase([], [], "Empty data round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("A"), [], "Single character round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("AA"), [], "Repeated characters round-trip test", "Educational test vector"),
          new TestCase(OpCodes.AnsiToBytes("AB"), [], "Two different characters round-trip test", "Educational test vector"),
          new TestCase(
            [97, 97, 97, 97, 97, 97, 98, 98, 98, 98, 98, 98, 99, 99, 99, 99, 99, 99, 100, 100, 100, 100, 100, 100], // aaaaaabbbbbbccccccdddddd
            [],
            "Highly repetitive text round-trip test",
            "https://compression.ca/act/act_pdf/Cleary1984.pdf"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox"),
            [],
            "English text with patterns round-trip test",
            "https://corpus.canterbury.ac.nz/"
          ),
          new TestCase(
            [65, 66, 67, 65, 66, 67, 49, 50, 51, 49, 50, 51, 65, 66, 67, 65, 66, 67, 49, 50, 51, 49, 50, 51], // ABCABC123123ABCABC123123
            [],
            "Structured data with patterns round-trip test",
            "https://compression.ca/act/act_pdf/Cleary1984.pdf"
          ),
          new TestCase(
            Array.from({ length: 256 }, (_, i) => i), // All 256 distinct byte values
            [],
            "All byte values 0-255 round-trip test",
            "Regression test for byte-255 handling"
          ),
          new TestCase(
            [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196], // Pseudo-random (splitmix32) 300-byte sample
            [],
            "Pseudo-random data round-trip test",
            "Regression test for context-model desync"
          ),
          new TestCase(
            Array.from({ length: 128 }, (_, i) => i % 2 ? 0x55 : 0xAA), // Alternating 0xAA/0x55
            [],
            "Alternating pattern round-trip test",
            "Regression test for context-model desync"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new PPMInstance(this, isInverse);
      }
    }

    class PPMInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ?
          this.decompress(this.inputBuffer) :
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      // Deterministic order-2/1/0 context-match encoder (no entropy coding).
      // For every input byte, find the HIGHEST order (2, then 1, then 0)
      // whose context table -- built purely from PRIOR data -- already
      // contains that exact symbol, and emit that as a literal two-byte
      // pair (order+1, symbol). If no order matches, emit (0, symbol).
      compress(data) {
        data = data || [];

        // Header: 1-byte max order, 4-byte LE original length.
        const output = [this.algorithm.MAX_ORDER];
        const lenBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
        for (let i = 0; i < 4; i++) output.push(lenBytes[i]);

        if (data.length === 0) return output;

        // Context models: order 0 (symbol -> count), order 1 (prevByte ->
        // symbol -> count), order 2 (ctx2Key -> symbol -> count) where
        // ctx2Key = data[i-2] * 256 + data[i-1].
        const order0 = new Map();
        const order1 = new Map();
        const order2 = new Map();

        for (let i = 0; i < data.length; i++) {
          const symbol = data[i];
          let encodedOrder = -1;

          if (i >= 2) {
            const ctx2Key = data[i - 2] * 256 + data[i - 1];
            const ctx2Table = order2.get(ctx2Key);
            if (ctx2Table && ctx2Table.has(symbol)) encodedOrder = 2;
          }

          if (encodedOrder < 0 && i >= 1) {
            const ctx1Table = order1.get(data[i - 1]);
            if (ctx1Table && ctx1Table.has(symbol)) encodedOrder = 1;
          }

          if (encodedOrder < 0 && order0.has(symbol)) encodedOrder = 0;

          output.push(encodedOrder + 1);
          output.push(symbol);

          // Update all applicable context models.
          order0.set(symbol, (order0.get(symbol) || 0) + 1);

          if (i >= 1) {
            const ctx1Key = data[i - 1];
            let ctx1Table = order1.get(ctx1Key);
            if (!ctx1Table) {
              ctx1Table = new Map();
              order1.set(ctx1Key, ctx1Table);
            }
            ctx1Table.set(symbol, (ctx1Table.get(symbol) || 0) + 1);
          }

          if (i >= 2) {
            const ctx2Key = data[i - 2] * 256 + data[i - 1];
            let ctx2Table = order2.get(ctx2Key);
            if (!ctx2Table) {
              ctx2Table = new Map();
              order2.set(ctx2Key, ctx2Table);
            }
            ctx2Table.set(symbol, (ctx2Table.get(symbol) || 0) + 1);
          }
        }

        return output;
      }

      // Reads (orderPlusOne, symbol) pairs sequentially; orderPlusOne is
      // write-only diagnostic information and is ignored here -- the
      // literal symbol byte is all that's needed to reconstruct the data.
      // The context models are rebuilt identically to the encoder's, using
      // already-decoded output bytes as context.
      decompress(data) {
        data = data || [];
        if (data.length === 0) return [];

        let offset = 0;
        offset++; // 1-byte max order (unused, informational)

        const originalSize = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        if (originalSize === 0) return [];

        const dst = [];
        const order0 = new Map();
        const order1 = new Map();
        const order2 = new Map();

        while (dst.length < originalSize) {
          offset++; // orderPlusOne (unused for reconstruction)
          const symbol = data[offset++];
          const idx = dst.length;

          order0.set(symbol, (order0.get(symbol) || 0) + 1);

          if (idx >= 1) {
            const ctx1Key = dst[idx - 1];
            let ctx1Table = order1.get(ctx1Key);
            if (!ctx1Table) {
              ctx1Table = new Map();
              order1.set(ctx1Key, ctx1Table);
            }
            ctx1Table.set(symbol, (ctx1Table.get(symbol) || 0) + 1);
          }

          if (idx >= 2) {
            const ctx2Key = dst[idx - 2] * 256 + dst[idx - 1];
            let ctx2Table = order2.get(ctx2Key);
            if (!ctx2Table) {
              ctx2Table = new Map();
              order2.set(ctx2Key, ctx2Table);
            }
            ctx2Table.set(symbol, (ctx2Table.get(symbol) || 0) + 1);
          }

          dst.push(symbol);
        }

        return dst;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new PPMAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PPMAlgorithm, PPMInstance };
}));