/*
 * UCL (Universal Compression Library) NRV2B Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * UCL - NRV2B (Not Really Vanished 2B) compression algorithm
 * Created by Markus F.X.J. Oberhumer (same author as LZO)
 * Used in UPX (Ultimate Packer for eXecutables)
 *
 * NOTE: This is an educational simplification demonstrating NRV2B concepts.
 * For production use, see the official UCL library at www.oberhumer.com/opensource/ucl/
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

    class UCLCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "UCL (NRV2B)";
        this.description = "Universal Compression Library implementing NRV2B algorithm. LZ77-based compression with bit-aligned encoding, offering better compression than LZO while maintaining fast decompression speed. Used extensively in UPX executable packer.";
        this.inventor = "Markus F.X.J. Oberhumer";
        this.year = 2004;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.AT; // Austria

        // Documentation and references
        this.documentation = [
          new LinkItem("Official UCL Homepage", "http://www.oberhumer.com/opensource/ucl/"),
          new LinkItem("UCL Wikipedia", "https://en.wikipedia.org/wiki/UCL_(data_compression_software)"),
          new LinkItem("UPX Homepage", "https://upx.github.io/")
        ];

        this.references = [
          new LinkItem("UCL Source Code Repository", "https://github.com/korczis/ucl"),
          new LinkItem("NRV2B Decompression Implementation", "https://github.com/korczis/ucl/blob/master/src/n2b_d.c"),
          new LinkItem("UPX Source Code", "https://github.com/upx/upx"),
          new LinkItem("Educational NRV Implementation", "https://github.com/pts/pts-decompress-nrv")
        ];

        // Test vectors - Educational round-trip tests
        // Note: Authentic NRV2B test vectors require the full UCL library
        // This educational implementation uses round-trip verification
        this.tests = [
          {
            text: "Empty input - Educational test",
            uri: "https://github.com/korczis/ucl",
            input: [],
            expected: []
          },
          {
            text: "Single byte 'A' - Educational round-trip",
            uri: "https://github.com/korczis/ucl/blob/master/src/n2b_d.c",
            input: OpCodes.AnsiToBytes("A"),
            roundTripOnly: true
          },
          {
            text: "Hello World - Educational round-trip",
            uri: "http://www.oberhumer.com/opensource/ucl/",
            input: OpCodes.AnsiToBytes("Hello World"),
            roundTripOnly: true
          },
          {
            text: "Repeated pattern AAABBBCCC - Educational round-trip",
            uri: "https://github.com/korczis/ucl",
            input: OpCodes.AnsiToBytes("AAABBBCCC"),
            roundTripOnly: true
          },
          {
            text: "Lorem ipsum text - Educational round-trip",
            uri: "http://www.oberhumer.com/opensource/ucl/",
            input: OpCodes.AnsiToBytes("Lorem ipsum dolor sit amet"),
            roundTripOnly: true
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new UCLInstance(this, isInverse);
      }
    }

    // UCL NRV2B compression instance
    // Educational simplified implementation demonstrating core concepts
    class UCLInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // NRV2B-inspired parameters (simplified for educational purposes)
        this.MIN_MATCH = 3;            // Minimum match length
        this.MAX_MATCH = 273;          // Maximum match length (simplified)
        this.MAX_OFFSET = 8192;        // Maximum offset for matches
        this.HASH_SIZE = 8192;         // Hash table size
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
          return new Uint8Array(0);
        }

        // Simplified LZ77-style compression (educational)
        const output = [];
        const hashTable = new Map();
        let inputPos = 0;

        while (inputPos < input.length) {
          const match = this._findBestMatch(input, inputPos, hashTable);

          if (match && match.length >= this.MIN_MATCH) {
            // Encode match: flag byte (0x00-0x7F for match), then offset (2 bytes), then length
            const lengthCode = Math.min(match.length - this.MIN_MATCH, 127);
            output.push(lengthCode); // Match flag + length

            // Encode offset using OpCodes
            const offsetBytes = OpCodes.Unpack16BE(match.offset);
            output.push(offsetBytes[0], offsetBytes[1]);

            // Update hash table for all positions in match
            for (let i = 0; i < match.length; i++) {
              this._updateHash(hashTable, input, inputPos + i);
            }

            inputPos += match.length;
          } else {
            // Encode literal: flag byte (0x80-0xFF), then the literal byte
            output.push(0x80); // Literal flag
            output.push(input[inputPos]);

            this._updateHash(hashTable, input, inputPos);
            inputPos++;
          }
        }

        // End marker
        output.push(0xFF, 0xFF); // End of stream marker

        return new Uint8Array(output);
      }

      _decompress(input) {
        if (input.length === 0) {
          return new Uint8Array(0);
        }

        const output = [];
        let inputPos = 0;

        while (inputPos < input.length) {
          const flag = input[inputPos];
          inputPos += 1;

          if (inputPos > input.length) break;

          // Check for end marker
          if (flag === 0xFF) {
            if (inputPos < input.length && input[inputPos] === 0xFF) {
              break; // End of stream
            }
          }

          if (OpCodes.AndN(flag, 0x80, 8) !== 0) {
            // Literal byte
            if (inputPos >= input.length) break;
            output.push(input[inputPos]);
            inputPos += 1;
          } else {
            // Match reference
            if (inputPos + 1 >= input.length) break;

            const offset = OpCodes.Pack16BE(input[inputPos], input[inputPos + 1]);
            inputPos += 2;

            const length = flag + this.MIN_MATCH;

            // Copy match using OpCodes operations
            for (let i = 0; i < length; i++) {
              const sourcePos = output.length - offset;
              if (sourcePos >= 0 && sourcePos < output.length) {
                output.push(output[sourcePos]);
              } else {
                break; // Safety check
              }
            }
          }
        }

        return new Uint8Array(output);
      }

      _findBestMatch(input, pos, hashTable) {
        if (pos + this.MIN_MATCH > input.length) {
          return null;
        }

        const hash = this._hash(input, pos);
        const candidates = hashTable.get(hash) || [];

        let bestMatch = null;
        let bestLength = this.MIN_MATCH - 1;

        for (const candidatePos of candidates) {
          if (candidatePos >= pos) continue;

          const offset = pos - candidatePos;
          if (offset > this.MAX_OFFSET) continue;

          let length = 0;
          const maxLength = Math.min(this.MAX_MATCH, input.length - pos);

          while (length < maxLength && input[candidatePos + length] === input[pos + length]) {
            length += 1;
          }

          if (length > bestLength) {
            bestLength = length;
            bestMatch = { offset: offset, length: length };
          }
        }

        return bestMatch;
      }

      _hash(input, pos) {
        if (pos + 2 >= input.length) {
          return OpCodes.AndN(input[pos], this.HASH_SIZE - 1, 16);
        }

        // 3-byte hash using OpCodes
        const h1 = OpCodes.Shl16(input[pos], 8);
        const h2 = OpCodes.Shl16(input[pos + 1], 4);
        const h3 = input[pos + 2];
        const combined = OpCodes.XorN(OpCodes.XorN(h1, h2, 16), h3, 16);
        return OpCodes.AndN(combined, this.HASH_SIZE - 1, 16);
      }

      _updateHash(hashTable, input, pos) {
        if (pos + this.MIN_MATCH - 1 >= input.length) return;

        const hash = this._hash(input, pos);
        if (!hashTable.has(hash)) {
          hashTable.set(hash, []);
        }

        const list = hashTable.get(hash);

        // Keep hash chains limited to prevent memory issues
        if (list.length < 64) {
          list.push(pos);
        } else {
          // Replace oldest entry (FIFO)
          list.shift();
          list.push(pos);
        }
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new UCLCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { UCLCompression, UCLInstance };
}));
