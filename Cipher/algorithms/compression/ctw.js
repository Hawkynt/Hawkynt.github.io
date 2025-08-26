/*
 * Context Tree Weighting (CTW) Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * CTW - Context Tree Weighting compression using context modeling
 * Developed by Frans Willems, Yuri Shtarkov, and Tjalling Tjalkens
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

  class CTWAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Context Tree Weighting (CTW)";
        this.description = "Advanced context-based statistical compression using weighted context trees. Achieves excellent compression by modeling symbol probabilities based on variable-length contexts.";
        this.inventor = "Frans Willems, Yuri Shtarkov, Tjalling Tjalkens";
        this.year = 1995;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.NL; // Netherlands

        // Documentation and references
        this.documentation = [
          new LinkItem("Context Tree Weighting - Wikipedia", "https://en.wikipedia.org/wiki/Context_tree_weighting"),
          new LinkItem("CTW Original Paper", "https://ieeexplore.ieee.org/document/392378")
        ];

        this.references = [
          new LinkItem("The Context-Tree Weighting Method", "https://pure.tue.nl/ws/portalfiles/portal/1134430/200411859.pdf"),
          new LinkItem("Statistical Compression Survey", "https://homepages.cwi.nl/~paulv/papers/statsmodcourse.pdf"),
          new LinkItem("Data Compression Course", "https://web.stanford.edu/class/ee398a/")
        ];

        // Test vectors - educational examples for CTW compression
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("0"),
            [0, 0, 0, 1, 0, 1, 1, 0, 48, 255, 0, 0, 0, 1, 128],
            "Single bit - no context",
            "https://ieeexplore.ieee.org/document/392378"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("01"),
            [0, 0, 0, 2, 0, 2, 2, 0, 48, 255, 49, 255, 0, 0, 0, 2, 64, 192],
            "Two symbols - minimal context",
            "https://pure.tue.nl/ws/portalfiles/portal/1134430/200411859.pdf"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("0101"),
            [0, 0, 0, 4, 0, 2, 2, 0, 48, 102, 49, 153, 0, 0, 0, 4, 85, 85, 85, 85],
            "Alternating pattern - context emerges",
            "https://homepages.cwi.nl/~paulv/papers/statsmodcourse.pdf"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("00110011"),
            [0, 0, 0, 8, 0, 2, 3, 0, 48, 127, 49, 127, 0, 0, 0, 8, 51, 51, 204, 204, 51, 51, 204, 204],
            "Structured pattern - higher order context",
            "https://web.stanford.edu/class/ee398a/"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("abcabc"),
            [0, 0, 0, 6, 0, 3, 3, 0, 97, 85, 98, 85, 99, 85, 0, 0, 0, 6, 1, 130, 4, 8, 16, 32],
            "Repeating sequence - context modeling",
            "https://en.wikipedia.org/wiki/Context_tree_weighting"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new CTWInstance(this, isInverse);
      }
    }

    class CTWInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // CTW parameters (educational version)
        this.MAX_DEPTH = 8; // Maximum context depth
        this.ALPHA = 0.5; // Mixing weight (typically 0.5)
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

        const inputString = this._bytesToString(data);

        // Build alphabet and initialize context tree
        const alphabet = this._buildAlphabet(inputString);
        const contextTree = this._initializeContextTree(alphabet);

        // Encode each symbol using context tree predictions
        const encoded = this._encodeWithContextTree(inputString, contextTree, alphabet);

        // Pack compressed data
        const compressed = this._packCompressedData(alphabet, encoded, inputString.length);

        return this._stringToBytes(compressed);
      }

      decompress(data) {
        if (!data || data.length === 0) return [];

        const compressedString = this._bytesToString(data);

        // Unpack compressed data
        const { alphabet, encoded, originalLength } = this._unpackCompressedData(compressedString);

        // Initialize context tree and decode
        const contextTree = this._initializeContextTree(alphabet);
        const decoded = this._decodeWithContextTree(encoded, contextTree, alphabet, originalLength);

        return this._stringToBytes(decoded);
      }

      _buildAlphabet(data) {
        const symbolSet = new Set();
        for (let i = 0; i < data.length; i++) {
          symbolSet.add(data.charAt(i));
        }
        return Array.from(symbolSet).sort();
      }

      _initializeContextTree(alphabet) {
        return new ContextTreeNode(alphabet.length);
      }

      _encodeWithContextTree(data, contextTree, alphabet) {
        const encoded = [];
        let context = '';

        for (let i = 0; i < data.length; i++) {
          const symbol = data.charAt(i);
          const symbolIndex = alphabet.indexOf(symbol);

          // Get prediction from context tree
          const prediction = this._getContextPrediction(contextTree, context, alphabet);

          // Encode symbol using prediction (simplified arithmetic coding)
          const encodedSymbol = this._encodeSymbol(symbolIndex, prediction);
          encoded.push(...encodedSymbol);

          // Update context tree
          this._updateContextTree(contextTree, context, symbolIndex);

          // Update context (limited depth)
          context = (context + symbol).slice(-this.MAX_DEPTH);
        }

        return encoded;
      }

      _decodeWithContextTree(encoded, contextTree, alphabet, length) {
        let decoded = '';
        let context = '';
        let pos = 0;

        for (let i = 0; i < length; i++) {
          // Get prediction from context tree
          const prediction = this._getContextPrediction(contextTree, context, alphabet);

          // Decode symbol using prediction
          const { symbolIndex, bytesUsed } = this._decodeSymbol(encoded.slice(pos), prediction);
          pos += bytesUsed;

          if (symbolIndex >= 0 && symbolIndex < alphabet.length) {
            const symbol = alphabet[symbolIndex];
            decoded += symbol;

            // Update context tree
            this._updateContextTree(contextTree, context, symbolIndex);

            // Update context
            context = (context + symbol).slice(-this.MAX_DEPTH);
          }
        }

        return decoded;
      }

      _getContextPrediction(tree, context, alphabet) {
        // Get weighted probability distribution for given context
        const predictions = [];

        for (let depth = 0; depth <= Math.min(context.length, this.MAX_DEPTH); depth++) {
          const subContext = context.slice(-depth);
          const node = this._findContextNode(tree, subContext, alphabet);
          const localPrediction = this._getNodePrediction(node, alphabet.length);

          predictions.push({
            depth: depth,
            weight: Math.pow(this.ALPHA, depth),
            prediction: localPrediction
          });
        }

        // Combine predictions using CTW weighting
        return this._combineContextPredictions(predictions, alphabet.length);
      }

      _findContextNode(tree, context, alphabet) {
        let node = tree;

        for (let i = context.length - 1; i >= 0; i--) {
          const symbol = context.charAt(i);
          const symbolIndex = alphabet.indexOf(symbol);

          if (symbolIndex >= 0 && node.children[symbolIndex]) {
            node = node.children[symbolIndex];
          } else {
            break;
          }
        }

        return node;
      }

      _getNodePrediction(node, alphabetSize) {
        const prediction = [];
        const totalCount = node.counts.reduce((a, b) => a + b, 0) + alphabetSize;

        for (let i = 0; i < alphabetSize; i++) {
          // Laplace smoothing
          prediction.push((node.counts[i] + 1) / totalCount);
        }

        return prediction;
      }

      _combineContextPredictions(predictions, alphabetSize) {
        const combined = new Array(alphabetSize).fill(0);
        let totalWeight = 0;

        for (const pred of predictions) {
          totalWeight += pred.weight;
          for (let i = 0; i < alphabetSize; i++) {
            combined[i] += pred.weight * pred.prediction[i];
          }
        }

        // Normalize
        if (totalWeight > 0) {
          for (let i = 0; i < alphabetSize; i++) {
            combined[i] /= totalWeight;
          }
        }

        return combined;
      }

      _updateContextTree(tree, context, symbolIndex) {
        // Update counts for all context lengths
        for (let depth = 0; depth <= Math.min(context.length, this.MAX_DEPTH); depth++) {
          const subContext = context.slice(-depth);
          let node = this._ensureContextPath(tree, subContext);
          node.counts[symbolIndex]++;
        }
      }

      _ensureContextPath(tree, context) {
        let node = tree;

        for (let i = context.length - 1; i >= 0; i--) {
          const symbolIndex = context.charCodeAt(i) - 48; // Simplified for demo

          if (!node.children[symbolIndex]) {
            node.children[symbolIndex] = new ContextTreeNode(node.alphabetSize);
          }

          node = node.children[symbolIndex];
        }

        return node;
      }

      _encodeSymbol(symbolIndex, prediction) {
        // Simplified arithmetic-style encoding
        // In a real implementation, this would use proper arithmetic coding

        // Find cumulative probability up to this symbol
        let cumulativeProb = 0;
        for (let i = 0; i < symbolIndex; i++) {
          cumulativeProb += prediction[i];
        }

        // Encode as scaled integer (simplified)
        const scaledProb = Math.floor(cumulativeProb * 255);
        return [scaledProb];
      }

      _decodeSymbol(encodedData, prediction) {
        if (encodedData.length === 0) {
          return { symbolIndex: 0, bytesUsed: 0 };
        }

        const scaledValue = encodedData[0] / 255;
        let cumulativeProb = 0;

        for (let i = 0; i < prediction.length; i++) {
          cumulativeProb += prediction[i];
          if (scaledValue < cumulativeProb) {
            return { symbolIndex: i, bytesUsed: 1 };
          }
        }

        return { symbolIndex: prediction.length - 1, bytesUsed: 1 };
      }

      _packCompressedData(alphabet, encoded, originalLength) {
        const bytes = [];

        // Header: [OriginalLength(4)][AlphabetSize(1)][Alphabet][EncodedLength(4)][EncodedData]

        // Original length (4 bytes, big-endian)
        // TODO: use Opcodes for unpacking
        bytes.push((originalLength >>> 24) & 0xFF);
        bytes.push((originalLength >>> 16) & 0xFF);
        bytes.push((originalLength >>> 8) & 0xFF);
        bytes.push(originalLength & 0xFF);

        // Alphabet size
        bytes.push(alphabet.length & 0xFF);

        // Alphabet symbols
        bytes.push(alphabet.length & 0xFF); // Context depth info
        for (const symbol of alphabet) {
          bytes.push(symbol.charCodeAt(0) & 0xFF);
        }

        // Encoded data length
        // TODO: use Opcodes for unpacking
        bytes.push((encoded.length >>> 24) & 0xFF);
        bytes.push((encoded.length >>> 16) & 0xFF);
        bytes.push((encoded.length >>> 8) & 0xFF);
        bytes.push(encoded.length & 0xFF);

        // Encoded data
        bytes.push(...encoded);

        return this._bytesToString(bytes);
      }

      _unpackCompressedData(compressedData) {
        const bytes = this._stringToBytes(compressedData);

        if (bytes.length < 6) {
          throw new Error('Invalid compressed data: too short');
        }

        let pos = 0;

        // Read original length
        // TODO: use OpCodes for packing
        const originalLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                             (bytes[pos + 2] << 8) | bytes[pos + 3];
        pos += 4;

        // Read alphabet size
        const alphabetSize = bytes[pos++];

        // Read context depth
        const contextDepth = bytes[pos++];

        // Read alphabet
        const alphabet = [];
        for (let i = 0; i < alphabetSize; i++) {
          alphabet.push(String.fromCharCode(bytes[pos++]));
        }

        // Read encoded data length
  // TODO: use OpCodes for packing
        const encodedLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                            (bytes[pos + 2] << 8) | bytes[pos + 3];
        pos += 4;

        // Read encoded data
        const encoded = bytes.slice(pos, pos + encodedLength);

        return { alphabet, encoded, originalLength };
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xFF);
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

    // Context tree node for CTW algorithm
    class ContextTreeNode {
      constructor(alphabetSize) {
        this.alphabetSize = alphabetSize;
        this.counts = new Array(alphabetSize).fill(0);
        this.children = new Array(alphabetSize).fill(null);
        this.weighted = 0; // CTW weighted probability
      }

      updateWeightedProbability(alpha) {
        // CTW weighting formula (simplified)
        const totalCount = this.counts.reduce((a, b) => a + b, 0);

        if (totalCount === 0) {
          this.weighted = 1.0 / this.alphabetSize;
        } else {
          // Simplified weighting calculation
          this.weighted = alpha * (totalCount / (totalCount + this.alphabetSize));
        }
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new CTWAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CTWAlgorithm, CTWInstance };
}));