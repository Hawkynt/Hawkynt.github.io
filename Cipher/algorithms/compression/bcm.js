/*
 * BCM (Block Context Mixing) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BCM is an advanced compression algorithm combining Burrows-Wheeler Transform (BWT)
 * with context mixing for very high compression ratios. Often described as the
 * "big brother of BZIP2", it uses sophisticated context modeling after BWT sorting.
 *
 * This is an educational implementation demonstrating the core concepts:
 * - Burrows-Wheeler Transform for block sorting
 * - Move-to-Front encoding
 * - Context mixing for prediction
 * - Run-length encoding
 *
 * Production BCM implementations are significantly more complex with multiple
 * context models, adaptive probability estimation, and arithmetic coding.
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
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== BCM CONSTANTS =====

  const BCM_CONSTANTS = {
    BLOCK_SIZE: 65536,        // 64KB blocks for educational version
    MAX_CONTEXT_ORDER: 4,      // Context order for mixing
    RLE_MIN_RUN: 4,           // Minimum run length for RLE
    ALPHABET_SIZE: 256        // Byte alphabet
  };

  // ===== BURROWS-WHEELER TRANSFORM =====

  class BurrowsWheelerTransform {
    static transform(data) {
      if (data.length === 0) return { transformed: [], primaryIndex: 0 };
      if (data.length === 1) return { transformed: [...data], primaryIndex: 0 };

      const n = data.length;
      const suffixes = new Uint32Array(n);

      // Initialize suffix array indices
      for (let i = 0; i < n; ++i) {
        suffixes[i] = i;
      }

      // Sort suffixes lexicographically
      suffixes.sort((a, b) => {
        for (let i = 0; i < n; ++i) {
          const byteA = data[(a + i) % n];
          const byteB = data[(b + i) % n];
          if (byteA !== byteB) return byteA - byteB;
        }
        return 0;
      });

      // Find primary index (where original string is)
      let primaryIndex = 0;
      for (let i = 0; i < n; ++i) {
        if (suffixes[i] === 0) {
          primaryIndex = i;
          break;
        }
      }

      // Extract last column (L column)
      const transformed = new Uint8Array(n);
      for (let i = 0; i < n; ++i) {
        const suffix = suffixes[i];
        transformed[i] = data[(suffix + n - 1) % n];
      }

      return { transformed: Array.from(transformed), primaryIndex };
    }

    static inverseTransform(data, primaryIndex) {
      if (data.length === 0) return [];
      if (data.length === 1) return [...data];

      const n = data.length;

      // Count frequency of each byte
      const counts = new Uint32Array(256);
      for (let i = 0; i < n; ++i) {
        ++counts[data[i]];
      }

      // Calculate cumulative counts
      const cumCounts = new Uint32Array(256);
      let sum = 0;
      for (let i = 0; i < 256; ++i) {
        cumCounts[i] = sum;
        sum += counts[i];
      }

      // Build transformation vector
      const transform = new Uint32Array(n);
      const tempCounts = new Uint32Array(256);

      for (let i = 0; i < n; ++i) {
        const byte = data[i];
        transform[cumCounts[byte] + tempCounts[byte]] = i;
        ++tempCounts[byte];
      }

      // Follow the transformation chain
      const result = new Uint8Array(n);
      let current = primaryIndex;

      for (let i = 0; i < n; ++i) {
        current = transform[current];
        result[i] = data[current];
      }

      return Array.from(result);
    }
  }

  // ===== MOVE-TO-FRONT ENCODING =====

  class MoveToFront {
    static encode(data) {
      if (data.length === 0) return [];

      // Initialize alphabet
      const alphabet = [];
      for (let i = 0; i < BCM_CONSTANTS.ALPHABET_SIZE; ++i) {
        alphabet.push(i);
      }

      const result = [];
      for (const byte of data) {
        const pos = alphabet.indexOf(byte);
        result.push(pos);

        // Move to front
        if (pos > 0) {
          alphabet.splice(pos, 1);
          alphabet.unshift(byte);
        }
      }

      return result;
    }

    static decode(data) {
      if (data.length === 0) return [];

      // Initialize alphabet
      const alphabet = [];
      for (let i = 0; i < BCM_CONSTANTS.ALPHABET_SIZE; ++i) {
        alphabet.push(i);
      }

      const result = [];
      for (const pos of data) {
        if (pos < 0 || pos >= BCM_CONSTANTS.ALPHABET_SIZE) {
          throw new Error(`Invalid MTF position: ${pos}`);
        }

        const byte = alphabet[pos];
        result.push(byte);

        // Move to front
        if (pos > 0) {
          alphabet.splice(pos, 1);
          alphabet.unshift(byte);
        }
      }

      return result;
    }
  }

  // ===== SIMPLE CONTEXT MIXER =====

  class ContextMixer {
    constructor(order = BCM_CONSTANTS.MAX_CONTEXT_ORDER) {
      this.order = order;
      this.contexts = new Map();
    }

    // Predict next symbol based on context
    predict(history) {
      if (history.length === 0) return 128; // Default prediction

      // Get context of specified order
      const contextLen = Math.min(this.order, history.length);
      const context = history.slice(-contextLen);
      const contextKey = context.join(',');

      // Return stored prediction or default
      return this.contexts.get(contextKey) || 128;
    }

    // Update context model with actual symbol
    update(history, symbol) {
      const contextLen = Math.min(this.order, history.length);
      const context = history.slice(-contextLen);
      const contextKey = context.join(',');

      // Simple averaging for educational purposes
      // Production BCM uses sophisticated probability mixing
      const oldPred = this.contexts.get(contextKey) || 128;
      const newPred = Math.floor((oldPred + symbol) / 2);
      this.contexts.set(contextKey, newPred);
    }

    // Encode symbol using context prediction
    encode(history, symbol) {
      const prediction = this.predict(history);
      this.update(history, symbol);
      // Return difference from prediction (delta encoding)
      return (symbol - prediction + 256) % 256;
    }

    // Decode symbol using context prediction
    decode(history, delta) {
      const prediction = this.predict(history);
      const symbol = (prediction + delta) % 256;
      this.update(history, symbol);
      return symbol;
    }
  }

  // ===== RUN-LENGTH ENCODING =====

  class RunLengthEncoder {
    static encode(data) {
      if (data.length === 0) return [];

      const result = [];
      let i = 0;

      while (i < data.length) {
        const currentByte = data[i];
        let runLength = 1;

        // Count consecutive identical bytes
        while (i + runLength < data.length &&
               data[i + runLength] === currentByte &&
               runLength < 255) {
          ++runLength;
        }

        if (runLength >= BCM_CONSTANTS.RLE_MIN_RUN) {
          // Encode as run: marker + length + value
          result.push(255); // RLE marker
          result.push(runLength);
          result.push(currentByte);
        } else {
          // Output bytes directly
          for (let j = 0; j < runLength; ++j) {
            result.push(currentByte);
          }
        }

        i += runLength;
      }

      return result;
    }

    static decode(data) {
      if (data.length === 0) return [];

      const result = [];
      let i = 0;

      while (i < data.length) {
        if (data[i] === 255 && i + 2 < data.length) {
          // RLE marker found
          const runLength = data[i + 1];
          const value = data[i + 2];

          for (let j = 0; j < runLength; ++j) {
            result.push(value);
          }
          i += 3;
        } else {
          result.push(data[i]);
          ++i;
        }
      }

      return result;
    }
  }

  // ===== MAIN BCM ALGORITHM =====

  class BCMCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BCM (Block Context Mixing)";
      this.description = "Advanced compression algorithm combining Burrows-Wheeler Transform with context mixing for very high compression ratios. Described as the 'big brother of BZIP2', using sophisticated context modeling after BWT sorting.";
      this.inventor = "Multiple Contributors";
      this.year = 2010;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "BWT + Context Mixing";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation with credible sources
      this.documentation = [
        new LinkItem("BCM GitHub Repository", "https://github.com/geekmaster/bcm"),
        new LinkItem("Burrows-Wheeler Transform", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"),
        new LinkItem("Context Mixing", "https://en.wikipedia.org/wiki/Context_mixing")
      ];

      this.references = [
        new LinkItem("BCM Compression Analysis", "https://encode.su/threads/1738-bcm-Big-brother-of-bzip2"),
        new LinkItem("BWT and Context Modeling", "https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf"),
        new LinkItem("Data Compression Explained", "http://mattmahoney.net/dc/dce.html")
      ];

      // Round-trip test vectors (compression algorithms use round-trip testing)
      this.tests = [
        {
          text: "Empty data test",
          uri: "https://github.com/geekmaster/bcm",
          input: []
        },
        {
          text: "Single byte test",
          uri: "https://github.com/geekmaster/bcm",
          input: [65]
        },
        {
          text: "Simple repeated pattern",
          uri: "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform",
          input: OpCodes.AnsiToBytes("AAABBBCCC")
        },
        {
          text: "Classic banana example",
          uri: "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform",
          input: OpCodes.AnsiToBytes("banana")
        },
        {
          text: "Mixed alphanumeric data",
          uri: "http://mattmahoney.net/dc/dce.html",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog")
        },
        {
          text: "Repetitive text compression",
          uri: "https://encode.su/threads/1738-bcm-Big-brother-of-bzip2",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabc")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BCMInstance(this, isInverse);
    }
  }

  /**
 * BCM cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BCMInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
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
      const result = this.isInverse ?
        this.decompress(this.inputBuffer) :
        this.compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      if (data.length === 0) return [];

      // Step 1: Apply Burrows-Wheeler Transform
      const bwtResult = BurrowsWheelerTransform.transform(data);

      // Step 2: Apply Move-to-Front encoding
      const mtfData = MoveToFront.encode(bwtResult.transformed);

      // Step 3: Apply context mixing
      const mixer = new ContextMixer(BCM_CONSTANTS.MAX_CONTEXT_ORDER);
      const contextData = [];
      const history = [];

      for (const symbol of mtfData) {
        const encoded = mixer.encode(history, symbol);
        contextData.push(encoded);
        history.push(symbol);
        if (history.length > BCM_CONSTANTS.MAX_CONTEXT_ORDER) {
          history.shift();
        }
      }

      // Step 4: Apply RLE to context-encoded data
      const rleData = RunLengthEncoder.encode(contextData);

      // Create output with header
      // Format: [primaryIndex (4 bytes), dataLength (4 bytes), compressed data]
      const output = [];

      // Write primary index (big-endian)
      const primaryIndexBytes = OpCodes.Unpack32BE(bwtResult.primaryIndex);
      output.push(...primaryIndexBytes);

      // Write original data length (big-endian)
      const dataLengthBytes = OpCodes.Unpack32BE(data.length);
      output.push(...dataLengthBytes);

      // Write compressed data
      output.push(...rleData);

      return output;
    }

    decompress(compressedData) {
      if (compressedData.length === 0) return [];

      // Need at least 8 bytes for header
      if (compressedData.length < 8) {
        throw new Error('Invalid BCM compressed data: too short');
      }

      // Read primary index (big-endian)
      const primaryIndex = OpCodes.Pack32BE(
        compressedData[0],
        compressedData[1],
        compressedData[2],
        compressedData[3]
      );

      // Read original data length (big-endian)
      const dataLength = OpCodes.Pack32BE(
        compressedData[4],
        compressedData[5],
        compressedData[6],
        compressedData[7]
      );

      // Read compressed data
      const rleData = compressedData.slice(8);

      // Step 1: Decode RLE
      const contextData = RunLengthEncoder.decode(rleData);

      // Step 2: Decode context mixing
      const mixer = new ContextMixer(BCM_CONSTANTS.MAX_CONTEXT_ORDER);
      const mtfData = [];
      const history = [];

      for (const delta of contextData) {
        const symbol = mixer.decode(history, delta);
        mtfData.push(symbol);
        history.push(symbol);
        if (history.length > BCM_CONSTANTS.MAX_CONTEXT_ORDER) {
          history.shift();
        }
      }

      // Step 3: Decode Move-to-Front
      const bwtData = MoveToFront.decode(mtfData);

      // Step 4: Apply inverse BWT
      const result = BurrowsWheelerTransform.inverseTransform(bwtData, primaryIndex);

      // Validate length
      if (result.length !== dataLength) {
        throw new Error(`BCM decompression error: expected ${dataLength} bytes, got ${result.length}`);
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BCMCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    BCMCompression,
    BCMInstance,
    BurrowsWheelerTransform,
    MoveToFront,
    ContextMixer,
    RunLengthEncoder
  };
}));
