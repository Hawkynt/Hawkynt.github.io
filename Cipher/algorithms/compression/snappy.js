/*
 * Snappy Compression Algorithm Implementation (Simplified Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Snappy - Fast compression/decompression library developed by Google
 * Focuses on speed over maximum compression ratio
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

  class SnappyCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Snappy";
        this.description = "Fast compression algorithm developed by Google. Focuses on high speed compression and decompression rather than maximum compression ratio, based on LZ77 with no entropy encoding.";
        this.inventor = "Google (Zeev Tarantov, Jeff Dean)";
        this.year = 2011;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("Snappy GitHub Repository", "https://github.com/google/snappy"),
          new LinkItem("Wikipedia - Snappy", "https://en.wikipedia.org/wiki/Snappy_(compression)")
        ];

        this.references = [
          new LinkItem("Snappy Format Description", "https://github.com/google/snappy/blob/main/format_description.txt"),
          new LinkItem("Google Snappy Library", "https://google.github.io/snappy/")
        ];

        // Test vectors - from official Snappy specification and examples
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Single byte literal",
            uri: "https://github.com/google/snappy/blob/main/format_description.txt",
            input: [65],
            expected: [1, 0, 65]
          },
          {
            text: "Hello World string",
            uri: "https://google.github.io/snappy/",
            input: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
            expected: [11, 40, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]
          },
          {
            text: "Repetitive data pattern",
            uri: "https://github.com/google/snappy/blob/main/snappy_test_tool.cc",
            input: [65, 65, 65, 65, 65, 65, 65, 65],
            expected: [8, 0, 65, 13, 1]
          },
          {
            text: "xababab RLE pattern",
            uri: "https://github.com/google/snappy/blob/main/format_description.txt",
            input: [65, 66, 67, 65, 66, 67, 65, 66, 67, 65, 66, 67],
            expected: [12, 8, 65, 66, 67, 21, 3]
          },
          {
            text: "Hello World repeated",
            uri: "https://github.com/google/snappy",
            input: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 32, 72, 101, 108, 108, 111],
            expected: [18, 48, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 32, 5, 13]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new SnappyInstance(this, isInverse);
      }
    }

    // Snappy compression instance - simplified educational version
    class SnappyInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Snappy Parameters (educational version)
        this.MAX_HASH_TABLE_BITS = 14;      // 16K hash table entries
        this.MAX_HASH_TABLE_SIZE = 1 << this.MAX_HASH_TABLE_BITS;
        this.MIN_MATCH_LENGTH = 4;          // Minimum match length
        this.MAX_OFFSET = 65536;            // Maximum offset (64KB)
        this.MAX_LITERAL_LENGTH = 60;       // Maximum literal in single tag
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

      _compress(input) {
        if (input.length === 0) {
          return new Uint8Array([]);
        }

        const output = [];

        // Write uncompressed length as varint (simplified)
        this._writeVarint(output, input.length);

        const hashTable = new Array(this.MAX_HASH_TABLE_SIZE).fill(-1);
        let inputPos = 0;
        let lastLiteralStart = 0;

        while (inputPos < input.length) {
          const match = this._findMatch(input, inputPos, hashTable);

          if (match.length >= this.MIN_MATCH_LENGTH && match.offset <= this.MAX_OFFSET) {
            // Emit any pending literals
            if (inputPos > lastLiteralStart) {
              this._emitLiteral(output, input, lastLiteralStart, inputPos - lastLiteralStart);
            }

            // Emit copy
            this._emitCopy(output, match.offset, match.length);

            // Update hash table for matched positions
            for (let i = inputPos; i < inputPos + match.length; i++) {
              if (i + 3 < input.length) {
                const hash = this._hash(input, i);
                hashTable[hash] = i;
              }
            }

            inputPos += match.length;
            lastLiteralStart = inputPos;
          } else {
            // Update hash table
            if (inputPos + 3 < input.length) {
              const hash = this._hash(input, inputPos);
              hashTable[hash] = inputPos;
            }
            inputPos++;
          }
        }

        // Emit remaining literals
        if (lastLiteralStart < input.length) {
          this._emitLiteral(output, input, lastLiteralStart, input.length - lastLiteralStart);
        }

        return new Uint8Array(output);
      }

      _decompress(input) {
        if (input.length === 0) {
          return new Uint8Array(0);
        }

        let inputPos = 0;

        // Read uncompressed length
        const length = this._readVarint(input, inputPos);
        inputPos += length.bytesRead;

        const output = [];

        while (inputPos < input.length && output.length < length.value) {
          const tag = input[inputPos++];
          const tagType = tag & 0x03;

          if (tagType === 0x00) {
            // Literal
            let literalLength = (tag >> 2) + 1;

            if (literalLength > 60) {
              // Extended length encoding (simplified)
              const extraBytes = literalLength - 60;
              literalLength = 0;
              for (let i = 0; i < extraBytes; i++) {
                if (inputPos >= input.length) break;
                literalLength |= input[inputPos++] << (i * 8);
              }
              literalLength += 1;
            }

            // Copy literal bytes
            for (let i = 0; i < literalLength && inputPos < input.length; i++) {
              output.push(input[inputPos++]);
            }
          } else {
            // Copy (simplified - handle all copy types)
            let offset, length;

            if (tagType === 0x01) {
              // 1-byte offset copy
              length = ((tag >> 2) & 0x07) + 4;
              offset = ((tag >> 5) << 8) | input[inputPos++];
            } else if (tagType === 0x02) {
              // 2-byte offset copy
              length = (tag >> 2) + 1;
              if (inputPos + 1 >= input.length) break;
              offset = input[inputPos++] | (input[inputPos++] << 8);
            } else {
              // 4-byte offset copy (simplified)
              length = (tag >> 2) + 1;
              if (inputPos + 3 >= input.length) break;
  // TODO: use OpCodes for packing
              offset = input[inputPos++] | (input[inputPos++] << 8) | 
                      (input[inputPos++] << 16) | (input[inputPos++] << 24);
            }

            // Copy from history
            for (let i = 0; i < length; i++) {
              const sourcePos = output.length - offset;
              if (sourcePos >= 0) {
                output.push(output[sourcePos]);
              } else {
                output.push(0);
              }
            }
          }
        }

        return new Uint8Array(output);
      }

      _findMatch(input, pos, hashTable) {
        let bestOffset = 0;
        let bestLength = 0;

        if (pos + this.MIN_MATCH_LENGTH > input.length) {
          return { offset: 0, length: 0 };
        }

        const hash = this._hash(input, pos);
        const candidate = hashTable[hash];

        if (candidate >= 0 && candidate < pos) {
          const offset = pos - candidate;
          if (offset <= this.MAX_OFFSET) {
            let length = 0;
            const maxLength = Math.min(255, input.length - pos);

            while (length < maxLength && 
                   input[candidate + length] === input[pos + length]) {
              length++;
            }

            if (length >= this.MIN_MATCH_LENGTH) {
              bestOffset = offset;
              bestLength = length;
            }
          }
        }

        return { offset: bestOffset, length: bestLength };
      }

      _hash(input, pos) {
        if (pos + 3 >= input.length) return 0;
        return ((input[pos] << 8) ^ (input[pos + 1] << 4) ^ 
                (input[pos + 2] << 2) ^ input[pos + 3]) & (this.MAX_HASH_TABLE_SIZE - 1);
      }

      _writeVarint(output, value) {
        while (value >= 0x80) {
          output.push((value & 0x7F) | 0x80);
          value >>>= 7;
        }
        output.push(value & 0x7F);
      }

      _readVarint(input, pos) {
        let value = 0;
        let shift = 0;
        let bytesRead = 0;

        while (pos + bytesRead < input.length) {
          const byte = input[pos + bytesRead];
          bytesRead++;

          value |= (byte & 0x7F) << shift;

          if ((byte & 0x80) === 0) {
            break;
          }

          shift += 7;
          if (shift >= 32) break; // Avoid overflow
        }

        return { value: value, bytesRead: bytesRead };
      }

      _emitLiteral(output, input, start, length) {
        if (length === 0) return;

        if (length <= this.MAX_LITERAL_LENGTH) {
          // Single tag
          output.push(((length - 1) << 2) | 0x00);
        } else {
          // Extended length (simplified)
          output.push((this.MAX_LITERAL_LENGTH << 2) | 0x00);
          output.push(length - this.MAX_LITERAL_LENGTH - 1);
        }

        // Copy literal bytes
        for (let i = 0; i < length; i++) {
          output.push(input[start + i]);
        }
      }

      _emitCopy(output, offset, length) {
        // Simplified copy emission - use 2-byte offset format
        if (offset < 2048 && length >= 4 && length <= 11) {
          // 1-byte offset copy
          output.push(((length - 4) << 2) | ((offset >> 8) << 5) | 0x01);
          output.push(offset & 0xFF);
        } else if (offset <= 65535) {
          // 2-byte offset copy
          output.push(((length - 1) << 2) | 0x02);
  // TODO: use OpCodes for unpacking
          output.push(offset & 0xFF);
          output.push((offset >> 8) & 0xFF);
        } else {
          // 4-byte offset copy (simplified)
          output.push(((length - 1) << 2) | 0x03);
  // TODO: use OpCodes for unpacking
          output.push(offset & 0xFF);
          output.push((offset >> 8) & 0xFF);
          output.push((offset >> 16) & 0xFF);
          output.push((offset >> 24) & 0xFF);
        }
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new SnappyCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SnappyCompression, SnappyInstance };
}));