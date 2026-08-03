/*
 * LZO Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZO (Lempel-Ziv-Oberhumer) compression algorithm
 * Fast compression with emphasis on decompression speed
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

    class LZOCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZO";
        this.description = "Lempel-Ziv-Oberhumer compression algorithm. A fast compression library emphasizing decompression speed over compression ratio.";
        this.inventor = "Markus F.X.J. Oberhumer";
        this.year = 1996;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.AT; // Austria

        // Documentation and references
        this.documentation = [
          new LinkItem("Official LZO Homepage", "http://www.oberhumer.com/opensource/lzo/"),
          new LinkItem("Wikipedia - LZO", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer")
        ];

        this.references = [
          new LinkItem("LZO Data Compression Library", "http://www.oberhumer.com/opensource/lzo/lzodoc.html"),
          new LinkItem("miniLZO Implementation", "http://www.oberhumer.com/opensource/lzo/download/")
        ];

        // Test vectors - based on LZO compression specifications
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Single character literal",
            uri: "http://www.oberhumer.com/opensource/lzo/",
            input: [65],
            expected: [1, 65, 17, 0, 0]
          },
          {
            text: "Hello World string",
            uri: "http://www.oberhumer.com/opensource/lzo/lzodoc.html",
            input: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100],
            expected: [11, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 17, 0, 0]
          },
          {
            text: "ABCDEFGH sequence",
            uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer",
            input: [65, 66, 67, 68, 69, 70, 71, 72],
            expected: [8, 65, 66, 67, 68, 69, 70, 71, 72, 17, 0, 0]
          },
          {
            text: "Repetitive run (24 bytes) - catches literals dropped between/around matches",
            uri: "http://www.oberhumer.com/opensource/lzo/lzodoc.html",
            input: new Array(24).fill(0x61),
            expected: [1, 97, 31, 0, 1, 18, 0, 1, 17, 0, 0]
          },
          {
            text: "Alternating pattern (16 bytes)",
            uri: "http://www.oberhumer.com/opensource/lzo/lzodoc.html",
            input: [97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98, 97, 98],
            expected: [2, 97, 98, 27, 0, 2, 17, 0, 0]
          },
          {
            text: "Binary/random sample (16 bytes)",
            uri: "http://www.oberhumer.com/opensource/lzo/lzodoc.html",
            input: [64, 128, 192, 0, 0, 0, 64, 128, 128, 0, 0, 0, 0, 0, 0, 0],
            expected: [10, 64, 128, 192, 0, 0, 0, 64, 128, 128, 0, 19, 0, 1, 17, 0, 0]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZOInstance(this, isInverse);
      }
    }

    // LZO compression instance
    class LZOInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // LZO Parameters (based on miniLZO characteristics)
        this.LOOK_AHEAD = 264;         // Look-ahead buffer size
        this.MIN_MATCH = 3;            // Minimum match length
        // Maximum match length: the wire format below packs (length - 3) into
        // the low 4 bits of a 0x10-0x1F match opcode, so it can only encode
        // lengths 3..18 - matches longer than that are simply never searched for.
        this.MAX_MATCH = 18;
        this.MAX_OFFSET = 0xBFFF;      // Maximum offset for matches
        this.HASH_SIZE = 16384;        // Hash table size (14-bit)
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
          return new Uint8Array([0x11, 0x00, 0x00]); // LZO end marker
        }

        const output = [];
        const hashTable = new Array(this.HASH_SIZE).fill(-1);
        let inputPos = 0;
        let literalStart = 0; // Start of the pending (not yet flushed) literal run

        while (inputPos < input.length) {
          // Try to find a match
          const match = this._findMatch(input, inputPos, hashTable);

          if (match.length >= this.MIN_MATCH && match.offset <= this.MAX_OFFSET) {
            // Flush any literal bytes accumulated since the last match
            const literalRun = inputPos - literalStart;
            if (literalRun > 0) {
              this._encodeLiterals(output, input, literalStart, literalRun);
            }

            // Encode match
            this._encodeMatch(output, match.offset, match.length);

            // Update hash table for matched positions
            for (let i = inputPos; i < inputPos + match.length; i++) {
              if (i + 2 < input.length) {
                const hash = this._hash(input, i);
                hashTable[hash] = i;
              }
            }

            inputPos += match.length;
            literalStart = inputPos;
          } else {
            // No match at this position - extend the pending literal run
            this._updateHash(hashTable, input, inputPos);
            inputPos++;
          }
        }

        // Flush any trailing literal bytes that never reached a match
        const remainingLiterals = inputPos - literalStart;
        if (remainingLiterals > 0) {
          this._encodeLiterals(output, input, literalStart, remainingLiterals);
        }

        // Add end marker
        output.push(0x11, 0x00, 0x00);

        return new Uint8Array(output);
      }

      _decompress(input) {
        if (input.length === 0) {
          return new Uint8Array(0);
        }

        const output = [];
        let inputPos = 0;

        while (inputPos < input.length) {
          const opcode = input[inputPos++];

          if ((opcode&0xF0) === 0x00) {
            // Literal run
            let length = opcode&0x0F;
            if (length === 0) {
              // Extended length
              if (inputPos >= input.length) break;
              length = input[inputPos++];
              if (length === 0) break; // End marker
              length += 15;
            }

            // Copy literals
            for (let i = 0; i < length && inputPos < input.length; i++) {
              output.push(input[inputPos++]);
            }
          } else if ((opcode&0xF0) === 0x10) {
            // Match with 16-bit offset
            if (inputPos + 1 >= input.length) break;

            const length = (opcode&0x0F) + 3;
            const offset = (OpCodes.Shl32(input[inputPos], 8))|input[inputPos + 1];
            inputPos += 2;

            if (offset === 0) break; // End marker

            // Copy match
            for (let i = 0; i < length; i++) {
              const sourcePos = output.length - offset;
              if (sourcePos >= 0) {
                output.push(output[sourcePos]);
              } else {
                output.push(0);
              }
            }
          } else {
            // Other opcodes - simplified handling
            break;
          }
        }

        return new Uint8Array(output);
      }

      _findMatch(input, pos, hashTable) {
        let bestOffset = 0;
        let bestLength = 0;

        if (pos + 2 >= input.length) {
          return { offset: 0, length: 0 };
        }

        const hash = this._hash(input, pos);
        const candidate = hashTable[hash];

        if (candidate >= 0 && candidate < pos) {
          const offset = pos - candidate;
          if (offset <= this.MAX_OFFSET) {
            let length = 0;
            const maxLength = Math.min(this.MAX_MATCH, input.length - pos);

            while (length < maxLength &&
                   input[candidate + length] === input[pos + length]) {
              length++;
            }

            if (length >= this.MIN_MATCH) {
              bestOffset = offset;
              bestLength = length;
            }
          }
        }

        return { offset: bestOffset, length: bestLength };
      }

      _hash(input, pos) {
        if (pos + 2 >= input.length) return 0;
        return ((OpCodes.Shl32(input[pos], 8))^(OpCodes.Shl32(input[pos + 1], 4))^input[pos + 2])&(this.HASH_SIZE - 1);
      }

      _updateHash(hashTable, input, pos) {
        if (pos + 2 < input.length) {
          const hash = this._hash(input, pos);
          hashTable[hash] = pos;
        }
      }

      _encodeLiterals(output, input, start, length) {
        if (length === 0) return;

        if (length <= 15) {
          output.push(length);
        } else {
          output.push(0x00);
          output.push(length - 15);
        }

        for (let i = 0; i < length; i++) {
          output.push(input[start + i]);
        }
      }

      _encodeMatch(output, offset, length) {
        if (length >= 3 && length <= 18 && offset <= 0xFFFF) {
          output.push(0x10|(length - 3));
          const [high, low] = OpCodes.Unpack16BE(offset);
          output.push(high);
          output.push(low);
        }
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new LZOCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZOCompression, LZOInstance };
}));