/*
 * MCM (Modified Context Mixing) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MCM combines LZP (Lempel-Ziv with Prediction) with context mixing for
 * balanced compression ratio and speed. Uses hash-based prediction with
 * multiple context models and arithmetic-style probability estimation.
 *
 * References:
 * - https://github.com/mathieuchartier/mcm
 * - Original MCM development by Mathieu Chartier (2013)
 * - Combines ideas from LZP, PPM, and modern context mixing
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

  class MCMCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MCM";
      this.description = "Modified Context Mixing with LZP for balanced compression speed and ratio. Uses context-based prediction combined with dictionary compression for efficient handling of repetitive and structured data.";
      this.inventor = "Mathieu Chartier";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Context Mixing + LZP";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // MCM compression parameters (educational simplified version)
      this.CONTEXT_SIZES = [1, 2, 3]; // Multiple context orders
      this.HASH_TABLE_SIZE = 262144;  // 18-bit hash table (2^18) - larger to reduce collisions
      this.MAX_MATCH_LENGTH = 255;    // Maximum match length
      this.MIN_MATCH_LENGTH = 3;      // Minimum match to encode
      this.NUM_CONTEXTS = 8;          // Number of parallel context models

      // Documentation and references
      this.documentation = [
        new LinkItem("MCM GitHub Repository", "https://github.com/mathieuchartier/mcm"),
        new LinkItem("MCM Algorithm Overview", "https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier"),
        new LinkItem("Large Text Benchmark - MCM", "https://www.mattmahoney.net/dc/text.html")
      ];

      this.references = [
        new LinkItem("Context Mixing - Wikipedia", "https://en.wikipedia.org/wiki/Context_mixing"),
        new LinkItem("LZP Algorithm Paper", "https://ieeexplore.ieee.org/document/488353/"),
        new LinkItem("MCM Discussion on encode.su", "https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier"),
        new LinkItem("Compression Benchmark Results", "https://www.mattmahoney.net/dc/")
      ];

      // Test vectors - round-trip compression tests
      // MCM uses educational implementation combining LZP and context mixing
      // Expected values left empty for round-trip testing (compress then decompress)
      this.tests = [
        new TestCase(
          [], // Empty input
          [], // Round-trip test (no expected value)
          "Empty input - minimal header",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"), // Single byte
          [], // Round-trip test
          "Single character - no context available",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AB"), // Two bytes
          [], // Round-trip test
          "Two characters - building initial context",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAA"), // Three identical
          [], // Round-trip test
          "Repeated character - context learning",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABAB"), // Alternating pattern
          [], // Round-trip test
          "Alternating pattern - basic context prediction",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAABBBBBB"), // Runs of identical bytes
          [], // Round-trip test
          "Character runs - LZP prediction efficiency",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello World!"), // Real text
          [], // Round-trip test
          "Natural language text - context mixing",
          "https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABCABC"), // Repeated pattern
          [], // Round-trip test
          "Pattern repetition - LZP dictionary matching",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("test data"), // Short text
          [], // Round-trip test
          "Short text - basic context mixing",
          "https://github.com/mathieuchartier/mcm"
        ),
        new TestCase(
          new Array(100).fill(65), // 100 A's
          [], // Round-trip test
          "Long repetitive sequence - maximum LZP efficiency",
          "https://github.com/mathieuchartier/mcm"
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MCMInstance(this, isInverse);
    }
  }

  /**
 * MCM cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MCMInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // MCM configuration
      this.contextSizes = algorithm.CONTEXT_SIZES;
      this.hashTableSize = algorithm.HASH_TABLE_SIZE;
      this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
      this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
      this.numContexts = algorithm.NUM_CONTEXTS;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [1, 0, 0, 0, 0]; // Empty with header
      }

      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    /**
     * Compute hash from context bytes using polynomial rolling hash
     * Uses modulo instead of bit masking for hash table size
     */
    _computeHash(context, size) {
      let hash = 0;
      const end = Math.min(context.length, size);
      for (let i = 0; i < end; ++i) {
        // Polynomial rolling hash: hash = (hash * 37 + byte) mod table_size
        hash = ((hash * 37) + context[i]) % this.hashTableSize;
      }
      return hash;
    }

    /**
     * Set a bit in control byte (educational helper to avoid direct bitwise ops)
     */
    _setBit(value, position) {
      return value|OpCodes.Shl8(1, position);
    }

    /**
     * Test a bit in control byte (educational helper to avoid direct bitwise ops)
     */
    _testBit(value, position) {
      return (value&OpCodes.Shl8(1, position)) !== 0;
    }


    /**
     * Compress data using MCM algorithm
     * Format: [version(1)] [original_size(4)] [control_byte] [literals/matches]...
     * Educational simplified version: uses LZP-style context prediction
     * Control byte: bit pattern indicating literal (0) or predicted byte (1)
     */
    _compress() {
      const result = [];
      const input = this.inputBuffer;

      // Header: version (1 byte) + original size (4 bytes, big-endian)
      result.push(1); // MCM version 1
      const sizeBytes = OpCodes.Unpack32BE(input.length);
      result.push(...sizeBytes);

      if (input.length === 0) {
        this.inputBuffer = [];
        return result;
      }

      // Initialize context models (hash table mapping context hash -> predicted byte)
      const contextModels = new Array(this.hashTableSize).fill(-1);

      let pos = 0;
      let controlByte = 0;
      let bitPos = 0;
      const pendingData = [];

      while (pos < input.length) {
        const currentByte = input[pos];
        let predicted = false;

        // Try to predict using different context sizes
        for (let ctxSize of this.contextSizes) {
          if (pos < ctxSize) continue;

          const context = input.slice(pos - ctxSize, pos);
          const hash = this._computeHash(context, ctxSize);
          const predictedByte = contextModels[hash];

          if (predictedByte === currentByte) {
            // Successful prediction - set control bit
            controlByte = this._setBit(controlByte, bitPos);
            predicted = true;
            break;
          }
        }

        if (!predicted) {
          // Prediction failed - output literal
          pendingData.push(currentByte);
        }

        // Update all context models with current byte
        for (let ctxSize of this.contextSizes) {
          if (pos < ctxSize) continue;
          const context = input.slice(pos - ctxSize, pos);
          const hash = this._computeHash(context, ctxSize);
          contextModels[hash] = currentByte;
        }

        ++pos;
        ++bitPos;

        // Flush control byte after 8 predictions or end of input
        if (bitPos === 8 || pos === input.length) {
          result.push(controlByte);
          result.push(...pendingData);
          controlByte = 0;
          bitPos = 0;
          pendingData.length = 0;
        }
      }

      this.inputBuffer = [];
      return result;
    }

    /**
     * Decompress MCM compressed data
     * Reads control bytes and processes literals/predictions
     */
    _decompress() {
      const input = this.inputBuffer;

      if (input.length < 5) {
        throw new Error('Invalid MCM data: too short for header');
      }

      // Parse header
      const version = input[0];
      if (version !== 1) {
        throw new Error(`Unsupported MCM version: ${version}`);
      }

      const originalSize = OpCodes.Pack32BE(input[1], input[2], input[3], input[4]);

      if (originalSize === 0) {
        this.inputBuffer = [];
        return [];
      }

      const result = [];
      const contextModels = new Array(this.hashTableSize).fill(-1);
      let pos = 5; // Skip header

      while (result.length < originalSize && pos < input.length) {
        // Read control byte
        const controlByte = input[pos++];
        if (pos > input.length) break;

        // Process up to 8 bits
        for (let bitPos = 0; bitPos < 8 && result.length < originalSize; ++bitPos) {
          const isPredicted = this._testBit(controlByte, bitPos);

          let byte;
          if (isPredicted) {
            // Prediction - get predicted byte from context models
            let predictedByte = -1;

            // Try different context sizes
            for (let ctxSize of this.contextSizes) {
              if (result.length < ctxSize) continue;

              const context = result.slice(result.length - ctxSize);
              const hash = this._computeHash(context, ctxSize);
              predictedByte = contextModels[hash];

              if (predictedByte !== -1) {
                break;
              }
            }

            if (predictedByte === -1) {
              throw new Error('Prediction failed - corrupted data');
            }
            byte = predictedByte;
          } else {
            // Literal: read byte directly
            if (pos >= input.length) break;
            byte = input[pos++];
          }

          // Update all context models with decoded byte (BEFORE pushing)
          for (let ctxSize of this.contextSizes) {
            if (result.length < ctxSize) continue;
            const context = result.slice(result.length - ctxSize);
            const hash = this._computeHash(context, ctxSize);
            contextModels[hash] = byte;
          }

          result.push(byte);
        }
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new MCMCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MCMCompression, MCMInstance };
}));
