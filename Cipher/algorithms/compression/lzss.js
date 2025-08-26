/*
 * LZSS Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZSS (Lempel-Ziv-Storer-Szymanski) compression algorithm
 * An improved variant of LZ77 that omits short matches
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

  class LZSSCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZSS";
        this.description = "Lempel-Ziv-Storer-Szymanski compression algorithm. An improved variant of LZ77 that omits short matches and uses bit flags to distinguish literals from references.";
        this.inventor = "James A. Storer and Thomas G. Szymanski";
        this.year = 1982;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Wikipedia - LZSS", "https://en.wikipedia.org/wiki/LZSS"),
          new LinkItem("Original Paper", "https://dl.acm.org/doi/10.1145/322344.322346")
        ];

        this.references = [
          new LinkItem("Data Compression Techniques", "http://www.data-compression.info/Algorithms/LZSS/"),
          new LinkItem("LZSS Implementation Guide", "https://oku.edu.mie-u.ac.jp/~okumura/compression/lzss.c")
        ];

        // Test vectors - based on LZSS compression specifications
        this.tests = [
          {
            text: "AAAAAAAAAA repetition",
            uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78",
            input: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65],
            expected: [0, 65, 0, 65, 0, 65, 1, 0, 3, 3, 1, 0, 4, 4]
          },
          {
            text: "Random data - no matches",
            uri: "https://sites.google.com/view/datacompressionguide/dictionary-based-compression/lempel-ziv-lz77lzss-coding",
            input: [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
            expected: [0, 65, 0, 66, 0, 67, 0, 68, 0, 69, 0, 70, 0, 71, 0, 72, 0, 73, 0, 74, 0, 75, 0, 76, 0, 77, 0, 78, 0, 79, 0, 80]
          },
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZSSInstance(this, isInverse);
      }
    }

    // LZSS compression instance
    class LZSSInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // LZSS Parameters (typical values based on research)
        this.WINDOW_SIZE = 4096;        // Look-back window size (2^12)
        this.LOOKAHEAD_SIZE = 18;       // Look-ahead buffer size
        this.MIN_MATCH_LENGTH = 3;      // Minimum match length to encode
        this.MAX_MATCH_LENGTH = 18;     // Maximum match length
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          const result = this._decompress(new Uint8Array(this.inputBuffer));
          this.inputBuffer = [];
          return Array.from(result);
        } else {
          const result = this._compress(new Uint8Array(this.inputBuffer));
          this.inputBuffer = [];
          return Array.from(result);
        }
      }

      _compress(inputBytes) {
        if (!inputBytes || inputBytes.length === 0) {
          return new Uint8Array(0);
        }

        const output = [];
        let pos = 0;
        const inputLen = inputBytes.length;
        const window = new Array(this.WINDOW_SIZE);
        let windowPos = 0;

        // Initialize window with spaces (common practice)
        for (let i = 0; i < this.WINDOW_SIZE; i++) {
          window[i] = 0x20; // Space character
        }

        while (pos < inputLen) {
          const match = this._findLongestMatch(inputBytes, pos, window, windowPos);

          if (match.length >= this.MIN_MATCH_LENGTH) {
            // Encode match as reference (flag=1, offset, length)
            output.push(0x01); // Flag byte indicating match
  // TODO: use OpCodes for unpacking
            output.push((match.offset >> 8) & 0xFF); // High byte of offset
            output.push(match.offset & 0xFF);        // Low byte of offset  
            output.push(match.length);               // Match length

            // Add matched characters to window
            for (let i = 0; i < match.length; i++) {
              window[windowPos] = inputBytes[pos + i];
              windowPos = (windowPos + 1) % this.WINDOW_SIZE;
            }
            pos += match.length;
          } else {
            // Encode literal character (flag=0, character)
            output.push(0x00); // Flag byte indicating literal
            output.push(inputBytes[pos]);

            // Add literal to window
            window[windowPos] = inputBytes[pos];
            windowPos = (windowPos + 1) % this.WINDOW_SIZE;
            pos++;
          }
        }

        return new Uint8Array(output);
      }

      _decompress(compressedBytes) {
        if (!compressedBytes || compressedBytes.length === 0) {
          return new Uint8Array(0);
        }

        const output = [];
        let pos = 0;
        const window = new Array(this.WINDOW_SIZE);
        let windowPos = 0;

        // Initialize window with spaces
        for (let i = 0; i < this.WINDOW_SIZE; i++) {
          window[i] = 0x20;
        }

        while (pos < compressedBytes.length) {
          const flag = compressedBytes[pos++];

          if (flag === 0x01) {
            // Match reference
            if (pos + 2 >= compressedBytes.length) break;

  // TODO: use OpCodes for packing
            const offset = (compressedBytes[pos] << 8) | compressedBytes[pos + 1];
            const length = compressedBytes[pos + 2];
            pos += 3;

            // Copy from window
            for (let i = 0; i < length; i++) {
              const sourcePos = (windowPos - offset + this.WINDOW_SIZE) % this.WINDOW_SIZE;
              const char = window[(sourcePos + i) % this.WINDOW_SIZE];
              output.push(char);
              window[windowPos] = char;
              windowPos = (windowPos + 1) % this.WINDOW_SIZE;
            }
          } else if (flag === 0x00) {
            // Literal character
            if (pos >= compressedBytes.length) break;

            const char = compressedBytes[pos++];
            output.push(char);
            window[windowPos] = char;
            windowPos = (windowPos + 1) % this.WINDOW_SIZE;
          } else {
            throw new Error(`Invalid flag byte: ${flag}`);
          }
        }

        return new Uint8Array(output);
      }

      // Find longest match in sliding window
      _findLongestMatch(input, pos, window, windowPos) {
        let bestOffset = 0;
        let bestLength = 0;
        const maxSearch = Math.min(this.LOOKAHEAD_SIZE, input.length - pos);

        if (maxSearch < this.MIN_MATCH_LENGTH) {
          return { offset: 0, length: 0 };
        }

        // Search in sliding window
        for (let i = 1; i <= this.WINDOW_SIZE; i++) {
          const searchPos = (windowPos - i + this.WINDOW_SIZE) % this.WINDOW_SIZE;
          let matchLen = 0;

          // Count matching characters
          while (matchLen < maxSearch && 
                 matchLen < this.MAX_MATCH_LENGTH &&
                 window[(searchPos + matchLen) % this.WINDOW_SIZE] === input[pos + matchLen]) {
            matchLen++;
          }

          // Update best match if this is longer
          if (matchLen >= this.MIN_MATCH_LENGTH && matchLen > bestLength) {
            bestOffset = i;
            bestLength = matchLen;
          }
        }

        return { offset: bestOffset, length: bestLength };
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZSSCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZSSCompression, LZSSInstance };
}));