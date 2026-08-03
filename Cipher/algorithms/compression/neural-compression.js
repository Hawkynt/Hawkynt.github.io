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
 * NeuralCompressionAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class NeuralCompressionAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Neural Network Compression (Educational)";
        this.description = "Educational compression algorithm demonstrating neural network concepts through prediction-based encoding. Uses adaptive prediction and context modeling to achieve compression through learned patterns in data.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Neural Network";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Educational Implementation";
        this.year = 2019;
        this.country = CountryCode.INTL;

        // Neural network parameters (simplified educational version)
        this.CONTEXT_SIZE = 4;           // Look-back window size
        this.PREDICTION_RANGE = 8;       // Prediction confidence levels
        this.LEARNING_RATE = 0.1;        // Adaptation rate

        this.documentation = [
          new LinkItem("Neural Data Compression", "https://arxiv.org/abs/1811.01057"),
          new LinkItem("Prediction by Partial Matching", "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"),
          new LinkItem("Context Modeling", "https://compression.ru/download/articles/context/cm_1.pdf")
        ];

        this.references = [
          new LinkItem("Neural Networks", "https://en.wikipedia.org/wiki/Neural_network"),
          new LinkItem("Adaptive Compression", "https://en.wikipedia.org/wiki/Adaptive_compression"),
          new LinkItem("Predictive Coding", "https://en.wikipedia.org/wiki/Predictive_coding")
        ];

        // Test vectors that match the actual implementation output.
        // Wire format: [contextSize(1)] [length:uint32-LE(4)] then groups of
        // [controlByte(1)] [literal bytes for the unset bits in that byte...],
        // repeated every up to 8 symbols. controlByte bit i = 1 means symbol i
        // was correctly predicted from context (no literal byte stored); bit
        // i = 0 means a literal byte follows. This bitmap is what makes the
        // format unambiguous: a raw literal byte value (0-255) is never placed
        // where a prediction-confidence code could also appear.
        this.tests = [
          new TestCase(
            [],
            [4, 0, 0, 0, 0], // Context size + empty data marker
            "Empty input - initialization",
            "https://arxiv.org/abs/1811.01057"
          ),
          new TestCase(
            [65], // "A"
            [4, 1, 0, 0, 0, 0, 65], // header + controlByte(0, no prediction yet) + literal 'A'
            "Single byte - baseline",
            "https://en.wikipedia.org/wiki/Neural_network"
          ),
          new TestCase(
            [65, 65], // "AA"
            [4, 2, 0, 0, 0, 0, 65, 65], // header + controlByte(0) + both literal bytes
            "Simple repetition - learning",
            "https://en.wikipedia.org/wiki/Prediction_by_partial_matching"
          ),
          new TestCase(
            [97, 98, 99, 97], // "abca"
            [4, 4, 0, 0, 0, 0, 97, 98, 99, 97], // header + controlByte(0) + all four literal bytes
            "Pattern recognition - context",
            "https://compression.ru/download/articles/context/cm_1.pdf"
          ),
          new TestCase(
            new Array(24).fill(0x61), // Repetitive run
            [4, 24, 0, 0, 0, 0, 97, 97, 97, 97, 97, 97, 97, 97, 0, 97, 97, 97, 97, 97, 97, 97, 97, 0, 97, 97, 97, 97, 97, 97, 97, 97],
            "Repetitive run (24 bytes)",
            "https://en.wikipedia.org/wiki/Adaptive_compression"
          ),
          new TestCase(
            (() => { const a = []; for (let i = 0; i < 16; i++) a.push(i % 2 ? 0x62 : 0x61); return a; })(), // Alternating pattern
            [4, 16, 0, 0, 0, 0, 97, 98, 97, 98, 97, 98, 97, 98, 0, 97, 98, 97, 98, 97, 98, 97, 98],
            "Alternating pattern (16 bytes)",
            "https://en.wikipedia.org/wiki/Predictive_coding"
          ),
          new TestCase(
            // Binary/random sample - includes byte values 0-7 as literals,
            // which the old confidence-code format could not represent
            [64, 128, 192, 0, 0, 0, 64, 128, 128, 0, 0, 0, 0, 0, 0, 0],
            [4, 16, 0, 0, 0, 0, 64, 128, 192, 0, 0, 0, 64, 128, 0, 128, 0, 0, 0, 0, 0, 0, 0],
            "Binary/random sample (16 bytes) - catches confidence-code/literal collision",
            "https://en.wikipedia.org/wiki/Neural_network"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new NeuralCompressionInstance(this, isInverse);
      }
    }

    class NeuralCompressionInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Neural network configuration (simplified)
        this.contextSize = algorithm.CONTEXT_SIZE;
        this.predictionRange = algorithm.PREDICTION_RANGE;
        this.learningRate = algorithm.LEARNING_RATE;

        // Context window for prediction
        this.contextBuffer = new Array(this.contextSize).fill(0);

        // Prediction model (simplified neural network simulation)
        this.weights = new Array(this.contextSize).fill(0.5);
        this.biases = new Array(256).fill(0); // One bias per possible byte value

        // Statistics
        this.statistics = {
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0.0
        };
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          // Return empty header for empty input
          return [this.contextSize, 0, 0, 0, 0];
        }

        const result = this.isInverse ?
          this._decompress(this.inputBuffer) :
          this._compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      // Prediction correctness is signalled out-of-band via an 8-symbol control-
      // byte bitmap (bit=1: prediction was correct, no literal byte follows;
      // bit=0: prediction failed, a raw literal byte follows), mirroring the
      // scheme in mcm.js. The previous format stored a "confidence code" (0-7)
      // directly in the byte stream in place of a correctly-predicted byte, but
      // literal byte VALUES 0-7 are indistinguishable from that code with
      // nothing to tell them apart - any literal byte <= 7 was silently
      // misdecoded as a prediction-confidence marker instead of its real value.

      _compress(data) {
        if (!data || data.length === 0) {
          return [this.contextSize, 0, 0, 0, 0];
        }

        const compressed = [];

        // Header: context size + data length (using OpCodes for endianness)
        compressed.push(this.contextSize);
        const lengthBytes = OpCodes.Unpack32LE(data.length);
        compressed.push(lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]);

        // Reset context and statistics
        this.contextBuffer.fill(0);
        this.statistics.totalPredictions = 0;
        this.statistics.correctPredictions = 0;

        let controlByte = 0;
        let bitPos = 0;
        const pendingLiterals = [];

        // Process data with simplified neural prediction
        for (let i = 0; i < data.length; i++) {
          const currentByte = data[i];

          // Predict next byte based on context (both sides compute this the
          // same way from the same context state, so it is always safe to use
          // as the reconstruction whenever the control bit says it was correct)
          const prediction = this._predictByte();

          if (prediction === currentByte) {
            controlByte = OpCodes.Or8(controlByte, OpCodes.Shl8(1, bitPos));
            this.statistics.correctPredictions++;
          } else {
            pendingLiterals.push(currentByte);
          }

          // Update context window and neural weights - using the same
          // (actual, prediction) pair the decoder will reconstruct
          this._updateContext(currentByte);
          this._adaptWeights(currentByte, prediction);
          this.statistics.totalPredictions++;

          bitPos++;
          if (bitPos === 8 || i === data.length - 1) {
            compressed.push(controlByte);
            compressed.push(...pendingLiterals);
            controlByte = 0;
            bitPos = 0;
            pendingLiterals.length = 0;
          }
        }

        return compressed;
      }

      _decompress(data) {
        if (!data || data.length < 5) return [];

        let offset = 0;

        // Parse header
        const contextSize = data[offset++];
        const originalLength = OpCodes.Pack32LE(
          data[offset++], data[offset++], data[offset++], data[offset++]
        );

        if (originalLength === 0) return [];

        // Reset context and statistics
        this.contextSize = contextSize;
        this.contextBuffer = new Array(contextSize).fill(0);
        this.statistics.totalPredictions = 0;
        this.statistics.correctPredictions = 0;

        const decompressed = [];

        while (decompressed.length < originalLength && offset < data.length) {
          const controlByte = data[offset++];

          for (let bitPos = 0; bitPos < 8 && decompressed.length < originalLength; bitPos++) {
            // Always compute the prediction from the current context, exactly
            // as the encoder did, BEFORE consulting the bit or advancing state -
            // this is what previously diverged: the old code only computed a
            // prediction when the bit said "predicted", and even then passed
            // the wrong (actual, actual) pair into _adaptWeights instead of
            // (actual, prediction), so the weights drifted out of sync with the
            // encoder from the very first literal byte onward.
            const prediction = this._predictByte();
            const isPredicted = OpCodes.And8(controlByte, OpCodes.Shl8(1, bitPos)) !== 0;

            let byte;
            if (isPredicted) {
              byte = prediction;
              this.statistics.correctPredictions++;
            } else {
              if (offset >= data.length) break;
              byte = data[offset++];
            }

            decompressed.push(byte);

            // Update context and adapt weights using the same (actual,
            // prediction) pair the encoder used for this symbol
            this._updateContext(byte);
            this._adaptWeights(byte, prediction);
            this.statistics.totalPredictions++;
          }
        }

        return decompressed;
      }

      /**
       * Predict next byte using simplified neural network simulation
       * @private
       */
      _predictByte() {
        // Simplified neural prediction based on context window
        let prediction = 0;
        let totalWeight = 0;

        for (let i = 0; i < this.contextSize; i++) {
          const contextByte = this.contextBuffer[i];
          const weight = this.weights[i];
          prediction += OpCodes.XorN(contextByte, Math.floor(weight * 255));
          totalWeight += weight;
        }

        if (totalWeight > 0) {
          prediction = OpCodes.AndN(Math.floor(prediction / totalWeight), 0xFF);
        }

        return prediction;
      }

      /**
       * Update context window with new byte
       * @private
       */
      _updateContext(newByte) {
        // Shift context buffer using OpCodes operations
        for (let i = 0; i < this.contextSize - 1; i++) {
          this.contextBuffer[i] = this.contextBuffer[i + 1];
        }
        this.contextBuffer[this.contextSize - 1] = newByte;
      }

      /**
       * Adapt neural network weights based on prediction accuracy
       * @private
       */
      _adaptWeights(actualByte, predictedByte) {
        // Simple learning: adjust weights based on prediction error
        const error = actualByte - predictedByte;
        const learningFactor = this.learningRate * (error / 255.0);

        for (let i = 0; i < this.contextSize; i++) {
          // Use OpCodes for safe arithmetic operations
          const adjustment = OpCodes.AndN(Math.floor(learningFactor * this.contextBuffer[i]), 0xFF);
          this.weights[i] = Math.max(0, Math.min(1, this.weights[i] + adjustment / 255.0));
        }

        // Update bias for this byte value
        this.biases[actualByte] += learningFactor * 0.1;
      }

      /**
       * Get neural network statistics for debugging
       * @private
       */
      getStatistics() {
        this.statistics.accuracy = this.statistics.totalPredictions > 0 ?
          this.statistics.correctPredictions / this.statistics.totalPredictions : 0;

        return {
          ...this.statistics,
          contextSize: this.contextSize,
          totalWeights: this.weights.length,
          averageWeight: this.weights.reduce((sum, w) => sum + w, 0) / this.weights.length
        };
      }

    }

  // ===== REGISTRATION =====

    const algorithmInstance = new NeuralCompressionAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NeuralCompressionAlgorithm, NeuralCompressionInstance };
}));