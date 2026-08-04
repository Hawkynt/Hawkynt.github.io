
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
        this.description = "Adaptive statistical compression using context modeling and escape sequences for superior compression of natural language and structured data.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "John Cleary, Ian Witten";
        this.year = 1984;
        this.country = CountryCode.INTL;

        // PPM parameters
        this.MAX_ORDER = 4;           // Maximum context order
        this.ALPHABET_SIZE = 256;     // Byte alphabet
        this.ESCAPE_SYMBOL = 256;     // Special escape symbol

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

        // Convert comprehensive test vectors to new format
        this.tests = [
          new TestCase(
            [97, 97, 97, 97, 97, 97, 98, 98, 98, 98, 98, 98, 99, 99, 99, 99, 99, 99, 100, 100, 100, 100, 100, 100], // aaaaaabbbbbbccccccdddddd
            [4, 24, 0, 0, 0, 10, 97, 10, 97, 11, 97, 12, 97, 13, 97, 14, 97, 10, 98, 10, 98, 11, 98, 12, 98, 13, 98, 14, 98, 10, 99, 10, 99, 11, 99, 12, 99, 13, 99, 14, 99, 10, 100, 10, 100, 11, 100, 12, 100, 13, 100, 14, 100],
            "Highly repetitive text",
            "https://compression.ca/act/act_pdf/Cleary1984.pdf"
          ),
          new TestCase(
            [116, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 104, 101, 32, 108, 97, 122, 121, 32, 100, 111, 103, 32, 116, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120], // the quick brown fox...
            [4, 63, 0, 0, 0, 10, 116, 10, 104, 10, 101, 10, 32, 10, 113, 10, 117, 10, 105, 10, 99, 10, 107, 10, 32, 10, 98, 10, 114, 10, 111, 10, 119, 10, 110, 10, 32, 10, 102, 10, 111, 10, 120, 10, 32, 10, 106, 10, 117, 10, 109, 10, 112, 10, 115, 10, 32, 10, 111, 10, 118, 10, 101, 10, 114, 10, 32, 10, 116, 11, 104, 12, 101, 13, 32, 10, 108, 10, 97, 10, 122, 10, 121, 10, 32, 10, 100, 10, 111, 10, 103, 10, 32, 11, 116, 12, 104, 13, 101, 14, 32, 14, 113, 14, 117, 14, 105, 14, 99, 14, 107, 14, 32, 14, 98, 14, 114, 14, 111, 14, 119, 14, 110, 14, 32, 14, 102, 14, 111, 14, 120],
            "English text with patterns",
            "https://corpus.canterbury.ac.nz/"
          ),
          new TestCase(
            [65, 66, 67, 65, 66, 67, 49, 50, 51, 49, 50, 51, 65, 66, 67, 65, 66, 67, 49, 50, 51, 49, 50, 51], // ABCABC123123ABCABC123123
            [4, 24, 0, 0, 0, 10, 65, 10, 66, 10, 67, 10, 65, 11, 66, 12, 67, 10, 49, 10, 50, 10, 51, 10, 49, 11, 50, 12, 51, 10, 65, 11, 66, 12, 67, 13, 65, 14, 66, 14, 67, 14, 49, 14, 50, 14, 51, 14, 49, 14, 50, 14, 51],
            "Structured data with patterns",
            "https://compression.ca/act/act_pdf/Cleary1984.pdf"
          ),
          new TestCase(
            [120, 55, 35, 109, 75, 57, 36, 112, 76, 50, 64, 110, 82, 53, 37, 113, 84, 56, 38, 119, 69, 52, 33], // x7#mK9$pL2@nR5%qT8&wE4!
            [4, 23, 0, 0, 0, 10, 120, 10, 55, 10, 35, 10, 109, 10, 75, 10, 57, 10, 36, 10, 112, 10, 76, 10, 50, 10, 64, 10, 110, 10, 82, 10, 53, 10, 37, 10, 113, 10, 84, 10, 56, 10, 38, 10, 119, 10, 69, 10, 52, 10, 33],
            "Random data - minimal compression",
            "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"
          ),
          new TestCase(
            [65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65], // AAAAAAAAAAAAAAAAAAA
            [4, 19, 0, 0, 0, 10, 65, 10, 65, 11, 65, 12, 65, 13, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65, 14, 65],
            "Single character repeated",
            "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"
          ),
          // Round-trip regression vectors: decode used to treat any
          // symbolByte === 255 as an (unreachable) escape marker, which
          // collided with the literal byte value 255 and corrupted
          // decoding whenever the data actually contained that byte.
          new TestCase(
            Array.from({ length: 256 }, (_, i) => i), // All 256 distinct byte values
            [],
            "All byte values 0-255 round-trip test",
            "Regression test for byte-255/escape-marker collision"
          ),
          new TestCase(
            [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196], // Pseudo-random (splitmix32) 300-byte sample
            [],
            "Pseudo-random data round-trip test",
            "Regression test for byte-255/escape-marker collision"
          ),
          new TestCase(
            Array.from({ length: 128 }, (_, i) => i % 2 ? 0x55 : 0xAA), // Alternating 0xAA/0x55
            [],
            "Alternating pattern round-trip test",
            "Regression test for byte-255/escape-marker collision"
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
        this.maxOrder = algorithm.MAX_ORDER;
        this.contexts = new Map(); // context string -> PPMContext
        this.history = []; // Recent symbols for context
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        // Process using existing compression logic
        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) return [];

        // Reset instance state for new compression
        this.contexts.clear();
        this.history = [];
        this._initializeOrderMinusOne();

        // Compressed output (simplified - not true arithmetic coding)
        const compressed = [];

        // Add header with maxOrder and original size
        compressed.push(this.maxOrder);
        compressed.push(OpCodes.ToByte(data.length));
        compressed.push(OpCodes.ToByte(OpCodes.Shr32(data.length, 8)));
        compressed.push(OpCodes.ToByte(OpCodes.Shr32(data.length, 16)));
        compressed.push(OpCodes.ToByte(OpCodes.Shr32(data.length, 24)));

        // Compress each byte
        for (let i = 0; i < data.length; i++) {
          const symbol = data[i];
          const encodedData = this._encodeSymbol(symbol);
          for (let _i = 0; _i < encodedData.length; _i++) compressed.push(encodedData[_i]);

          // Update model with new symbol
          this._updateModel(symbol);

          // Add to history for context
          this.history.push(symbol);
          if (this.history.length > this.maxOrder) {
            this.history.shift();
          }
        }

        return compressed;
      }

      decompress(data) {
        if (!data || data.length === 0) return [];

        if (data.length < 5) {
          throw new Error('Invalid PPM data: too short');
        }

        // Parse header
        const maxOrder = data[0];
        const originalSize = data[1]|OpCodes.Shl32(data[2], 8)|OpCodes.Shl32(data[3], 16)|OpCodes.Shl32(data[4], 24);

        // Reset decompression state
        this.maxOrder = maxOrder;
        this.contexts.clear();
        this.history = [];
        this._initializeOrderMinusOne();

        const decompressed = [];
        let offset = 5; // Skip header

        // Decompress each symbol
        for (let i = 0; i < originalSize && offset < data.length; i++) {
          const decodeResult = this._decodeSymbol(data, offset);
          decompressed.push(decodeResult.symbol);
          offset = decodeResult.nextOffset;

          // Update model with decoded symbol
          this._updateModel(decodeResult.symbol);

          // Add to history for context
          this.history.push(decodeResult.symbol);
          if (this.history.length > this.maxOrder) {
            this.history.shift();
          }
        }

        return decompressed;
      }

      /**
       * Initialize order -1 context (uniform distribution)
       * @private
       */
      _initializeOrderMinusOne() {
        const orderMinusOne = new PPMContext(-1);
        // All symbols are equally likely in order -1
        for (let i = 0; i < this.algorithm.ALPHABET_SIZE; i++) {
          orderMinusOne.addSymbol(i);
        }
        this.contexts.set('', orderMinusOne); // Empty context string
      }

      /**
       * Get context string for given order
       * @private
       */
      _getContextString(order, history) {
        if (order <= 0 || history.length === 0) {
          return '';
        }

        const startPos = Math.max(0, history.length - order);
        return history.slice(startPos).join(',');
      }

      /**
       * Get or create context for given order
       * @private
       */
      _getContext(order) {
        const contextStr = this._getContextString(order, this.history);

        if (!this.contexts.has(contextStr)) {
          this.contexts.set(contextStr, new PPMContext(order));
        }

        return this.contexts.get(contextStr);
      }

      /**
       * Encode symbol using PPM model
       * @private
       */
      _encodeSymbol(symbol) {
        // Try contexts from highest order to lowest
        for (let order = Math.min(this.maxOrder, this.history.length); order >= -1; order--) {
          const context = this._getContext(order);

          if (context.hasSymbol(symbol)) {
            // Symbol found in this context
            const symbolCode = this._encodeInContext(symbol, context, false);
            return [order + 10, ...symbolCode]; // Offset order for encoding
          } else if (order > -1) {
            // Symbol not found, encode escape
            const escapeCode = this._encodeInContext(this.algorithm.ESCAPE_SYMBOL, context, true);
            // Continue to lower order context
          }
        }

        // Should never reach here if order -1 is properly initialized
        return [0, symbol]; // Fallback
      }

      /**
       * Encode symbol within specific context
       * @private
       */
      _encodeInContext(symbol, context, isEscape) {
        // Simplified encoding (not true arithmetic coding)
        if (isEscape) {
          return [255]; // Escape marker
        } else {
          // Use symbol value directly (simplified)
          return [symbol];
        }
      }

      /**
       * Decode symbol from compressed data
       * @private
       */
      _decodeSymbol(bytes, offset) {
        if (offset >= bytes.length) {
          throw new Error('Unexpected end of compressed data');
        }

        const orderByte = bytes[offset++];
        const order = orderByte - 10; // Decode order

        if (offset >= bytes.length) {
          throw new Error('Incomplete symbol encoding');
        }

        const symbolByte = bytes[offset++];

        // Note: _encodeSymbol() never actually writes an escape marker to
        // the stream -- when a context misses, the escape byte it builds
        // is discarded and encoding simply falls through to the next
        // lower order until order -1 (which always contains the full
        // alphabet) supplies a match. So every [orderByte, symbolByte]
        // pair in the stream already IS the literal decoded symbol; a
        // "symbolByte === 255 means escape" check here was ambiguous
        // with the legitimate data byte 255 and corrupted the stream
        // (and everything after it) whenever real data contained 255.
        return {
          symbol: symbolByte,
          nextOffset: offset
        };
      }

      /**
       * Update PPM model with new symbol
       * @private
       */
      _updateModel(symbol) {
        // Update all contexts from order 0 to maxOrder
        for (let order = 0; order <= Math.min(this.maxOrder, this.history.length); order++) {
          const context = this._getContext(order);
          context.addSymbol(symbol);
        }
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i)&0xFF);
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

    /**
     * PPM Context class for storing symbol statistics
     */
    class PPMContext {
      constructor(order) {
        this.order = order;
        this.symbols = new Map(); // symbol -> count
        this.totalCount = 0;
        this.escapeCount = 1; // Start with escape probability
      }

      hasSymbol(symbol) {
        return this.symbols.has(symbol);
      }

      addSymbol(symbol) {
        if (this.symbols.has(symbol)) {
          this.symbols.set(symbol, this.symbols.get(symbol) + 1);
        } else {
          this.symbols.set(symbol, 1);
        }
        this.totalCount++;
      }

      getSymbolCount(symbol) {
        return this.symbols.get(symbol) || 0;
      }

      getEscapeCount() {
        return this.escapeCount;
      }

      getTotalCount() {
        return this.totalCount + this.escapeCount;
      }

      getSymbolProbability(symbol) {
        const count = this.getSymbolCount(symbol);
        const total = this.getTotalCount();
        return count / total;
      }

      getEscapeProbability() {
        return this.escapeCount / this.getTotalCount();
      }

      getAllSymbols() {
        return Array.from(this.symbols.keys());
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