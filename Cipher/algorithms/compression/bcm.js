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

        if (runLength >= BCM_CONSTANTS.RLE_MIN_RUN || currentByte === 255) {
          // Encode as run: marker + length + value. The marker byte
          // (255) must ALWAYS be escaped this way, even for a run of
          // just one, otherwise a literal 255 byte in the data (which
          // the context mixer's delta output produces regularly, since
          // it spans the full 0..255 range) would be indistinguishable
          // from a real run marker during decode.
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
        },
        // Round-trip regression vectors: RunLengthEncoder only escaped its
        // 255 marker byte for runs >= RLE_MIN_RUN, so a short/isolated
        // literal 255 (which the context mixer's full-range delta output
        // produces regularly) was indistinguishable from a real run
        // marker on decode and corrupted the whole stream after it.
        {
          text: "All byte values 0-255 round-trip test",
          uri: "Regression test for unescaped RLE marker byte",
          input: Array.from({ length: 256 }, (_, i) => i)
        },
        {
          text: "Pseudo-random data round-trip test",
          uri: "Regression test for unescaped RLE marker byte",
          input: [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196]
        },
        {
          text: "Alternating pattern round-trip test",
          uri: "Regression test for unescaped RLE marker byte",
          input: Array.from({ length: 128 }, (_, i) => i % 2 ? 0x55 : 0xAA)
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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
      for (let _i = 0; _i < primaryIndexBytes.length; _i++) output.push(primaryIndexBytes[_i]);

      // Write original data length (big-endian)
      const dataLengthBytes = OpCodes.Unpack32BE(data.length);
      for (let _i = 0; _i < dataLengthBytes.length; _i++) output.push(dataLengthBytes[_i]);

      // Write compressed data
      for (let _i = 0; _i < rleData.length; _i++) output.push(rleData[_i]);

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
