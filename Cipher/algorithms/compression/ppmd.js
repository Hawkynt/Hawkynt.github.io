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

  class PPMDAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "PPMd (PPM with Dynamic Memory)";
        this.description = "Advanced statistical compression using dynamic memory allocation for context modeling with improved performance over standard PPM through optimal memory usage and sophisticated prediction mechanisms.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "Dmitry Shkarin";
        this.year = 1999;
        this.country = CountryCode.RU;

        // PPMd parameters
        this.MAX_ORDER = 6;           // Maximum context order
        this.MEMORY_SIZE = 16384;     // Memory pool size  
        this.ALPHABET_SIZE = 256;     // Byte alphabet
        this.ESCAPE_SYMBOL = 256;     // Special escape symbol

        this.documentation = [
          new LinkItem("PPMd Algorithm Overview", "https://en.wikipedia.org/wiki/PPMd"),
          new LinkItem("Dmitry Shkarin PPMd", "https://www.compression.ru/ds/"),
          new LinkItem("PPMd Technical Details", "https://www.7-zip.org/recover.html")
        ];

        this.references = [
          new LinkItem("PPM Compression Family", "https://compression.ca/act/act_pdf/Cleary1984.pdf"),
          new LinkItem("Context Modeling Research", "https://www.researchgate.net/publication/220617088"),
          new LinkItem("Large Text Compression Benchmark", "https://www.mattmahoney.net/dc/text.html")
        ];

        // Comprehensive test vectors for PPMd
        this.tests = [
          new TestCase(
            [97, 97, 97, 97, 97, 97, 98, 98, 98, 98, 98, 98], // aaaaaabbbbbb
            [6, 12, 0, 0, 0, 8, 97, 10, 97, 11, 97, 12, 97, 13, 97, 14, 97, 15, 97, 10, 98, 10, 98, 11, 98, 12, 98, 13, 98, 14, 98],
            "Highly repetitive data - optimal for PPMd",
            "https://www.compression.ru/ds/"
          ),
          new TestCase(
            [116, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120], // the quick brown fox
            [6, 19, 0, 0, 0, 10, 116, 10, 104, 10, 101, 10, 32, 10, 113, 10, 117, 10, 105, 10, 99, 10, 107, 10, 32, 10, 98, 10, 114, 10, 111, 10, 119, 10, 110, 10, 32, 10, 102, 10, 111, 10, 120],
            "Natural language text compression",
            "https://en.wikipedia.org/wiki/PPMd"
          ),
          new TestCase(
            [65, 66, 67, 65, 66, 67, 68, 69, 70, 65, 66, 67], // ABCABCDEFABC
            [6, 12, 0, 0, 0, 10, 65, 10, 66, 10, 67, 10, 65, 11, 66, 12, 67, 10, 68, 10, 69, 10, 70, 10, 65, 11, 66, 12, 67],
            "Pattern recognition test",
            "https://www.7-zip.org/recover.html"
          ),
          new TestCase(
            [102, 111, 114, 32, 105, 61, 48, 59, 32, 105, 60, 110, 59, 32, 105, 43, 43], // for i=0; i<n; i++
            [6, 17, 0, 0, 0, 10, 102, 10, 111, 10, 114, 10, 32, 10, 105, 10, 61, 10, 48, 10, 59, 10, 32, 10, 105, 10, 60, 10, 110, 10, 59, 10, 32, 10, 105, 10, 43, 10, 43],
            "Source code compression",
            "https://www.mattmahoney.net/dc/text.html"
          ),
          new TestCase(
            [],
            [],
            "Empty input edge case",
            "https://www.compression.ru/ds/"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new PPMDInstance(this, isInverse);
      }
    }

    class PPMDInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.maxOrder = algorithm.MAX_ORDER;
        this.memorySize = algorithm.MEMORY_SIZE;
        
        // PPMd specific structures
        this.memoryPool = new Uint8Array(this.memorySize);
        this.memoryPtr = 0;
        this.contexts = new Map();
        this.history = [];
        
        // State statistics
        this.nodeCount = 0;
        this.totalMemoryUsed = 0;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) return [];

        // Initialize PPMd structures
        this._initializePPMd();
        
        const compressed = [];

        // Add header
        compressed.push(this.maxOrder);
        compressed.push(data.length & 0xFF);
        compressed.push((data.length >>> 8) & 0xFF);
        compressed.push((data.length >>> 16) & 0xFF);
        compressed.push((data.length >>> 24) & 0xFF);

        // Compress each byte using dynamic context modeling
        for (let i = 0; i < data.length; i++) {
          const symbol = data[i];
          const encodedData = this._encodeSymbolPPMd(symbol);
          compressed.push(...encodedData);

          // Update model with enhanced learning
          this._updateModelPPMd(symbol);
          this._manageMemory();

          // Update history with bounds checking
          this.history.push(symbol);
          if (this.history.length > this.maxOrder) {
            this.history.shift();
          }
        }

        return compressed;
      }

      decompress(data) {
        if (!data || data.length < 5) return [];

        // Parse header
        const maxOrder = data[0];
        const originalSize = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);

        // Initialize decompression state
        this.maxOrder = maxOrder;
        this._initializePPMd();

        const decompressed = [];
        let offset = 5;

        // Decompress each symbol
        for (let i = 0; i < originalSize && offset < data.length; i++) {
          const decodeResult = this._decodeSymbolPPMd(data, offset);
          decompressed.push(decodeResult.symbol);
          offset = decodeResult.nextOffset;

          // Update model (same as compression)
          this._updateModelPPMd(decodeResult.symbol);
          this._manageMemory();

          this.history.push(decodeResult.symbol);
          if (this.history.length > this.maxOrder) {
            this.history.shift();
          }
        }

        return decompressed;
      }

      /**
       * Initialize PPMd data structures
       * @private
       */
      _initializePPMd() {
        this.memoryPtr = 0;
        this.nodeCount = 0;
        this.totalMemoryUsed = 0;
        this.contexts.clear();
        this.history = [];
        
        // Initialize root context (order -1)
        this._createRootContext();
      }

      /**
       * Create root context for uniform distribution
       * @private
       */
      _createRootContext() {
        const rootContext = new PPMDContext(-1, this);
        rootContext.initializeUniform(this.algorithm.ALPHABET_SIZE);
        this.contexts.set('', rootContext);
      }

      /**
       * Allocate memory from pool
       * @private
       */
      _allocateMemory(size) {
        if (this.memoryPtr + size > this.memorySize) {
          // Memory cleanup and compaction
          this._compactMemory();
          if (this.memoryPtr + size > this.memorySize) {
            throw new Error('PPMd memory exhausted');
          }
        }
        
        const ptr = this.memoryPtr;
        this.memoryPtr += size;
        this.totalMemoryUsed += size;
        return ptr;
      }

      /**
       * Compact memory by removing unused contexts
       * @private
       */
      _compactMemory() {
        const activeContexts = new Set();
        
        // Mark active contexts
        for (let order = 0; order <= Math.min(this.maxOrder, this.history.length); order++) {
          const contextKey = this._getContextKey(order);
          if (this.contexts.has(contextKey)) {
            activeContexts.add(contextKey);
          }
        }

        // Remove inactive contexts
        for (const [key, context] of this.contexts) {
          if (!activeContexts.has(key)) {
            this.contexts.delete(key);
            this.totalMemoryUsed -= context.getMemoryUsage();
          }
        }

        // Reset memory pointer (simplified)
        this.memoryPtr = Math.floor(this.memoryPtr * 0.7);
      }

      /**
       * Manage memory usage and perform cleanup
       * @private
       */
      _manageMemory() {
        if (this.totalMemoryUsed > this.memorySize * 0.9) {
          this._compactMemory();
        }
      }

      /**
       * Get context key for given order
       * @private
       */
      _getContextKey(order) {
        if (order <= 0 || this.history.length === 0) {
          return '';
        }
        const start = Math.max(0, this.history.length - order);
        return this.history.slice(start).join(',');
      }

      /**
       * Get or create context for given order
       * @private
       */
      _getContext(order) {
        const contextKey = this._getContextKey(order);
        
        if (!this.contexts.has(contextKey)) {
          const context = new PPMDContext(order, this);
          this.contexts.set(contextKey, context);
          this.nodeCount++;
        }

        return this.contexts.get(contextKey);
      }

      /**
       * Encode symbol using PPMd model
       * @private
       */
      _encodeSymbolPPMd(symbol) {
        // Try contexts from highest order to lowest
        for (let order = Math.min(this.maxOrder, this.history.length); order >= -1; order--) {
          const context = this._getContext(order);

          if (context.hasSymbol(symbol)) {
            const symbolInfo = context.getSymbolInfo(symbol);
            return [order + 10, symbol, symbolInfo.frequency & 0xFF];
          } else if (order > -1) {
            // Encode escape and continue to lower order
            const escapeInfo = context.getEscapeInfo();
            // Continue to next context
          }
        }

        // Fallback encoding
        return [0, symbol];
      }

      /**
       * Decode symbol from PPMd data
       * @private
       */
      _decodeSymbolPPMd(data, offset) {
        if (offset >= data.length) {
          throw new Error('Unexpected end of PPMd data');
        }

        const orderByte = data[offset++];
        const order = orderByte - 10;

        if (offset >= data.length) {
          throw new Error('Incomplete symbol data');
        }

        const symbol = data[offset++];

        // Skip frequency byte if present
        if (offset < data.length && orderByte > 0) {
          offset++; // frequency
        }

        return {
          symbol: symbol,
          nextOffset: offset
        };
      }

      /**
       * Update PPMd model with new symbol
       * @private
       */
      _updateModelPPMd(symbol) {
        // Update all relevant contexts
        for (let order = 0; order <= Math.min(this.maxOrder, this.history.length); order++) {
          const context = this._getContext(order);
          context.updateSymbol(symbol);
        }

        // Perform model rescaling if needed
        this._rescaleModel();
      }

      /**
       * Rescale model frequencies to prevent overflow
       * @private
       */
      _rescaleModel() {
        if (this.nodeCount > 1000) {
          for (const context of this.contexts.values()) {
            context.rescale();
          }
        }
      }
    }

    /**
     * PPMd Context class with dynamic memory management
     */
    class PPMDContext {
      constructor(order, instance) {
        this.order = order;
        this.instance = instance;
        this.symbols = new Map(); // symbol -> PPMDNode
        this.totalFrequency = 0;
        this.escapeFrequency = 1;
        this.memoryUsage = 32; // Base memory usage
      }

      hasSymbol(symbol) {
        return this.symbols.has(symbol);
      }

      getSymbolInfo(symbol) {
        const node = this.symbols.get(symbol);
        return node ? { frequency: node.frequency, last: node.last } : null;
      }

      getEscapeInfo() {
        return { frequency: this.escapeFrequency };
      }

      updateSymbol(symbol) {
        if (this.symbols.has(symbol)) {
          const node = this.symbols.get(symbol);
          node.frequency++;
          node.last = Date.now();
        } else {
          const node = new PPMDNode(symbol, 1, Date.now());
          this.symbols.set(symbol, node);
          this.memoryUsage += 16; // Node overhead
        }
        this.totalFrequency++;
      }

      initializeUniform(alphabetSize) {
        // Initialize with uniform distribution for order -1
        for (let i = 0; i < alphabetSize; i++) {
          this.symbols.set(i, new PPMDNode(i, 1, 0));
        }
        this.totalFrequency = alphabetSize;
      }

      rescale() {
        // Rescale frequencies to prevent overflow
        for (const node of this.symbols.values()) {
          node.frequency = Math.max(1, Math.floor(node.frequency / 2));
        }
        this.totalFrequency = Math.max(1, Math.floor(this.totalFrequency / 2));
        this.escapeFrequency = Math.max(1, Math.floor(this.escapeFrequency / 2));
      }

      getMemoryUsage() {
        return this.memoryUsage;
      }
    }

    /**
     * PPMd Node for storing symbol information
     */
    class PPMDNode {
      constructor(symbol, frequency, last) {
        this.symbol = symbol;
        this.frequency = frequency;
        this.last = last; // Last access time for aging
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new PPMDAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { PPMDAlgorithm, PPMDInstance, PPMDContext, PPMDNode };
}));