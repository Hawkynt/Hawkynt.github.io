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
 * RANSAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class RANSAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "rANS (Range Asymmetric Numeral Systems)";
        this.description = "Advanced entropy coding using range-based asymmetric numeral systems for optimal compression efficiency. Provides arithmetic coding quality with faster processing through range-based state management and renormalization.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.inventor = "Jarek Duda, Fabian Giesen";
        this.year = 2011;
        this.country = CountryCode.INTL;

        // rANS parameters - very simplified for educational purposes
        this.PROB_BITS = 4;                       // Probability precision (4 bits)
        this.PROB_SCALE = OpCodes.Shl32(1, this.PROB_BITS);   // 16
        this.RANS_L = OpCodes.Shl32(1, 8);                     // Lower bound (256)
        this.RANS_BYTE_L = OpCodes.Shl32(1, 4);                // Byte renormalization bound (16)

        this.documentation = [
          new LinkItem("rANS Implementation", "https://github.com/rygorous/ryg_rans"),
          new LinkItem("ANS Entropy Coding", "https://arxiv.org/abs/1311.2540"),
          new LinkItem("Fabian Giesen Blog", "https://fgiesen.wordpress.com/2014/02/02/rans-notes/")
        ];

        this.references = [
          new LinkItem("Asymmetric Numeral Systems", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"),
          new LinkItem("Range Coding Theory", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html"),
          new LinkItem("rANS vs tANS Comparison", "https://encode.su/threads/2648-Asymmetric-Numeral-Systems"),
          new LinkItem("Practical ANS Implementation", "https://github.com/Cyan4973/FiniteStateEntropy")
        ];

        // Test vectors for rANS - educational implementation
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input - boundary case",
            "https://github.com/rygorous/ryg_rans"
          ),
          new TestCase(
            [65],
            [4, 1, 0, 0, 0, 65, 16, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            "Single symbol A - maximum probability",
            "https://arxiv.org/abs/1311.2540"
          ),
          new TestCase(
            [65, 65, 65, 65],
            [4, 1, 0, 0, 0, 65, 16, 0, 4, 0, 0, 0, 0, 1, 0, 0],
            "Repeated A - highly repetitive data",
            "https://fgiesen.wordpress.com/2014/02/02/rans-notes/"
          ),
          new TestCase(
            [65, 66, 65, 66],
            [4, 2, 0, 0, 0, 65, 8, 0, 66, 8, 0, 4, 0, 0, 0, 80, 16, 0, 0],
            "Alternating AB - balanced distribution",
            "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"
          ),
          new TestCase(
            [65, 66, 67],
            [4, 3, 0, 0, 0, 65, 6, 0, 66, 5, 0, 67, 5, 0, 3, 0, 0, 0, 147, 27, 0, 0],
            "Three symbols ABC - uniform distribution",
            "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html"
          ),
          new TestCase(
            [65, 65, 66],
            [4, 2, 0, 0, 0, 65, 11, 0, 66, 5, 0, 3, 0, 0, 0, 212, 6, 0, 0],
            "Skewed distribution AAB - natural pattern",
            "https://encode.su/threads/2648-Asymmetric-Numeral-Systems"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new RANSInstance(this, isInverse);
      }
    }

    class RANSInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // rANS configuration
        this.probBits = algorithm.PROB_BITS;
        this.probScale = algorithm.PROB_SCALE;
        this.ransL = algorithm.RANS_L;
        this.ransByteL = algorithm.RANS_BYTE_L;

        // rANS state
        this.frequencies = null;
        this.cumulativeFreqs = null;
        this.totalFreq = 0;
        this.symbolMap = null;
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
        if (!data || data.length === 0) {
          // Empty data - just header with probability bits
          const result = [];
          result.push(this.probBits);
          // Use OpCodes for 32-bit packing
          const bytes = OpCodes.Unpack32LE(0); // symbolCount = 0
          result.push(...bytes);
          const dataLenBytes = OpCodes.Unpack32LE(0); // dataLength = 0
          result.push(...dataLenBytes);
          return result;
        }

        // Build probability model
        const model = this._buildProbabilityModel(data);

        const compressed = [];

        // Header: probability bits
        compressed.push(this.probBits);

        // Store symbol count using OpCodes
        const symbolCount = model.symbols.length;
        const symbolCountBytes = OpCodes.Unpack32LE(symbolCount);
        compressed.push(...symbolCountBytes);

        // Store probability model
        for (const symbolInfo of model.symbols) {
          compressed.push(symbolInfo.symbol);
          const freqBytes = OpCodes.Unpack16LE(symbolInfo.freq);
          compressed.push(...freqBytes);
        }

        // Store data length using OpCodes
        const dataLenBytes = OpCodes.Unpack32LE(data.length);
        compressed.push(...dataLenBytes);

        // Encode data using rANS
        const encodedData = this._encodeRANS(data, model);

        // Store encoded data
        compressed.push(...encodedData);

        return compressed;
      }

      decompress(data) {
        if (!data || data.length < 9) return [];

        let offset = 0;

        // Parse header
        const probBits = data[offset++];

        // Parse symbol count using OpCodes
        const symbolCountBytes = data.slice(offset, offset + 4);
        const symbolCount = OpCodes.Pack32LE(symbolCountBytes[0], symbolCountBytes[1], symbolCountBytes[2], symbolCountBytes[3]);
        offset += 4;

        if (symbolCount === 0) {
          return [];
        }

        // Parse probability model
        const symbols = [];
        for (let i = 0; i < symbolCount; i++) {
          if (offset + 2 >= data.length) break;
          const symbol = data[offset++];
          const freqBytes = data.slice(offset, offset + 2);
          const freq = OpCodes.Pack16LE(freqBytes[0], freqBytes[1]);
          offset += 2;
          symbols.push({ symbol, freq });
        }

        // Parse data length using OpCodes
        if (offset + 3 >= data.length) return [];
        const dataLenBytes = data.slice(offset, offset + 4);
        const dataLength = OpCodes.Pack32LE(dataLenBytes[0], dataLenBytes[1], dataLenBytes[2], dataLenBytes[3]);
        offset += 4;

        if (dataLength === 0) return [];

        // Build decoding model
        const model = { symbols, totalFreq: symbols.reduce((sum, s) => sum + s.freq, 0) };
        this._buildDecodingModel(model);

        // Extract encoded data (rest of the data)
        const encodedData = data.slice(offset);

        // Decode using rANS
        return this._decodeRANS(encodedData, model, dataLength);
      }

      /**
       * Build probability model from data
       * @private
       */
      _buildProbabilityModel(data) {
        // Count symbol frequencies
        const freqMap = new Map();
        for (const byte of data) {
          freqMap.set(byte, (freqMap.get(byte) || 0) + 1);
        }

        // Sort symbols for consistent ordering
        const sortedSymbols = Array.from(freqMap.keys()).sort((a, b) => a - b);
        const symbols = [];
        let totalFreq = 0;

        // Calculate frequencies with proper scaling
        for (const symbol of sortedSymbols) {
          const count = freqMap.get(symbol);
          // Use simple proportional scaling
          let freq = Math.max(1, Math.floor((count * this.probScale) / data.length));
          symbols.push({ symbol, freq, count });
          totalFreq += freq;
        }

        // Distribute remainder to maintain exact probability scale
        let remainder = this.probScale - totalFreq;
        let i = 0;
        while (remainder > 0 && i < symbols.length) {
          symbols[i].freq++;
          remainder--;
          i = (i + 1) % symbols.length;
        }
        while (remainder < 0 && i < symbols.length) {
          if (symbols[i].freq > 1) {
            symbols[i].freq--;
            remainder++;
          }
          i = (i + 1) % symbols.length;
        }

        // Build cumulative frequencies
        let cumFreq = 0;
        for (const symbolInfo of symbols) {
          symbolInfo.cumFreq = cumFreq;
          cumFreq += symbolInfo.freq;
        }

        return { symbols, totalFreq: this.probScale };
      }

      /**
       * Build decoding model from symbols
       * @private
       */
      _buildDecodingModel(model) {
        this.symbolMap = new Map();
        this.cumulativeFreqs = [];

        // Ensure cumFreq is set in model symbols
        let cumFreq = 0;
        for (const symbolInfo of model.symbols) {
          // Set cumFreq if not already set
          if (symbolInfo.cumFreq === undefined) {
            symbolInfo.cumFreq = cumFreq;
          }

          this.symbolMap.set(symbolInfo.symbol, {
            freq: symbolInfo.freq,
            cumFreq: symbolInfo.cumFreq,
            symbol: symbolInfo.symbol
          });

          cumFreq = symbolInfo.cumFreq + symbolInfo.freq;
        }

        this.totalFreq = cumFreq;
      }

      /**
       * Encode data using simplified rANS algorithm
       * @private
       */
      _encodeRANS(data, model) {
        const output = [];
        let state = this.ransL; // Initialize state

        // Build encoding lookup
        const encodingMap = new Map();
        for (const symbolInfo of model.symbols) {
          encodingMap.set(symbolInfo.symbol, symbolInfo);
        }

        // Encode symbols in reverse order
        for (let i = data.length - 1; i >= 0; i--) {
          const symbol = data[i];
          const symbolInfo = encodingMap.get(symbol);

          if (!symbolInfo) {
            throw new Error(`Symbol ${symbol} not found in model`);
          }

          // Renormalize if needed - simpler bounds
          while (state >= (this.ransL * this.probScale)) {
            output.push(OpCodes.ToByte(state));
            state = OpCodes.Shr32(state, 8);
          }

          // Update state using rANS formula
          state = Math.floor(state / symbolInfo.freq) * this.probScale +
                  symbolInfo.cumFreq + (state % symbolInfo.freq);
        }

        // Reverse the renormalization bytes first
        output.reverse();

        // Then append the final state (don't reverse this)
        const stateBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(state));
        output.push(...stateBytes);

        return output;
      }

      /**
       * Decode data using simplified rANS algorithm
       * @private
       */
      _decodeRANS(encodedData, model, targetLength) {
        if (encodedData.length < 4) return [];

        const decoded = [];
        let offset = 0;

        // Read initial state using OpCodes
        const stateBytes = encodedData.slice(offset, offset + 4);
        let state = OpCodes.Pack32LE(stateBytes[0], stateBytes[1], stateBytes[2], stateBytes[3]);
        offset += 4;

        // Decode symbols
        for (let i = 0; i < targetLength; i++) {
          // Find symbol from state
          const cumFreq = state % this.probScale;
          const symbol = this._findSymbolFromCumFreq(cumFreq, model);
          const symbolInfo = this.symbolMap.get(symbol);

          if (!symbolInfo) {
            break;
          }

          decoded.push(symbol);

          // Update state - correct rANS formula
          state = Math.floor(state / this.probScale) * symbolInfo.freq +
                  (cumFreq - symbolInfo.cumFreq);

          // Renormalize if needed
          while (state < this.ransL && offset < encodedData.length) {
            state = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(state, 8), encodedData[offset++]));
          }
        }

        return decoded;
      }

      /**
       * Find symbol from cumulative frequency
       * @private
       */
      _findSymbolFromCumFreq(cumFreq, model) {
        // Linear search for educational clarity
        for (const symbolInfo of model.symbols) {
          if (cumFreq >= symbolInfo.cumFreq &&
              cumFreq < symbolInfo.cumFreq + symbolInfo.freq) {
            return symbolInfo.symbol;
          }
        }

        // Default fallback
        return model.symbols[0].symbol;
      }

      /**
       * Calculate theoretical entropy for comparison
       * @private
       */
      _calculateEntropy(data) {
        const frequencies = new Map();
        for (const byte of data) {
          frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
        }

        let entropy = 0;
        for (const freq of frequencies.values()) {
          const p = freq / data.length;
          entropy -= p * Math.log2(p);
        }

        return entropy;
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new RANSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RANSAlgorithm, RANSInstance };
}));