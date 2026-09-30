/*
 * ROLZ (Reduced Offset LZ) Compression Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * ROLZ - Context-aware dictionary compression using reduced offset sets
 * Combines LZ77 dictionary matching with context modeling for efficiency
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

  /**
 * ROLZAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ROLZAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "ROLZ (Reduced Offset LZ)";
        this.description = "Context-aware dictionary compression using reduced offset sets. Combines LZ77 dictionary matching with context modeling to reduce active offsets and improve compression efficiency.";
        this.inventor = "Malcolm Taylor";
        this.year = 1999;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.GB; // Great Britain

        // Documentation and references
        this.documentation = [
          new LinkItem("ROLZ Algorithm Paper", "https://ieeexplore.ieee.org/document/8801741/"),
          new LinkItem("ResearchGate ROLZ Study", "https://www.researchgate.net/publication/335200832_RoLZ_-_The_Reduced_Offset_LZ_Data_Compression_Algorithm")
        ];

        this.references = [
          new LinkItem("Large Text Compression Benchmark", "https://www.mattmahoney.net/dc/text.html"),
          new LinkItem("ROLZ Wikipedia (Russian)", "https://ru.wikipedia.org/wiki/ROLZ"),
          new LinkItem("Context Modeling in Compression", "https://en.wikipedia.org/wiki/Context_mixing"),
          new LinkItem("Dictionary Compression Methods", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_ROLZ):
        //   4 bytes uncompressed size (little-endian); if 0, no payload follows.
        //   Otherwise an MSB-first bitstream, one token per position:
        //     bit 0, 8-bit literal byte                      -- literal
        //     bit 1, 8-bit table index, 8-bit (length - 3)    -- match
        //   Match candidates are looked up in a per-context (previous byte)
        //   circular table of up to 256 recent positions.
        /** @type {uint8[]} */
        const testInput1 = OpCodes.AnsiToBytes("A");
        /** @type {uint8[]} */
        const testExpected1 = [1, 0, 0, 0, 32, 128];

        /** @type {uint8[]} */
        const testInput2 = OpCodes.AnsiToBytes("AB");
        /** @type {uint8[]} */
        const testExpected2 = [2, 0, 0, 0, 32, 144, 128];

        /** @type {uint8[]} */
        const testInput3 = OpCodes.AnsiToBytes("ABAB");
        /** @type {uint8[]} */
        const testExpected3 = [4, 0, 0, 0, 32, 144, 136, 36, 32];

        /** @type {uint8[]} */
        const testInput4 = OpCodes.AnsiToBytes("ABCABC");
        /** @type {uint8[]} */
        const testExpected4 = [6, 0, 0, 0, 32, 144, 136, 100, 18, 17, 12];

        /** @type {uint8[]} */
        const testInput5 = OpCodes.AnsiToBytes("Hello World");
        /** @type {uint8[]} */
        const testExpected5 = [11, 0, 0, 0, 36, 25, 77, 134, 195, 120, 128, 174, 111, 57, 27, 12, 128];

        /** @type {uint8[]} */
        const testInput6 = OpCodes.AnsiToBytes("aaabbbcccaaa");
        /** @type {uint8[]} */
        const testExpected6 = [12, 0, 0, 0, 48, 152, 76, 38, 35, 17, 136, 198, 99, 49, 152, 76, 38, 16];

        this.tests = [
          new TestCase(
            [],
            [0, 0, 0, 0],
            "Empty input test",
            "https://ieeexplore.ieee.org/document/8801741/"
          ),
          {
            input: testInput1,
            expected: testExpected1,
            text: "Single character - no context established",
            uri: "https://ieeexplore.ieee.org/document/8801741/"
          },
          {
            input: testInput2,
            expected: testExpected2,
            text: "Two characters - building context",
            uri: "https://ieeexplore.ieee.org/document/8801741/"
          },
          {
            input: testInput3,
            expected: testExpected3,
            text: "Alternating pattern - context-aware matching",
            uri: "https://ieeexplore.ieee.org/document/8801741/"
          },
          {
            input: testInput4,
            expected: testExpected4,
            text: "Repeating sequence - reduced offset advantage",
            uri: "https://ieeexplore.ieee.org/document/8801741/"
          },
          {
            input: testInput5,
            expected: testExpected5,
            text: "Natural text with character repetition",
            uri: "https://ieeexplore.ieee.org/document/8801741/"
          },
          {
            input: testInput6,
            expected: testExpected6,
            text: "Structured runs with repetition - optimal case",
            uri: "https://ieeexplore.ieee.org/document/8801741/"
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {ROLZInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new ROLZInstance(this, isInverse);
      }
    }

    /**
     * Per-context circular tables of recent positions
     */
    class RolzTables {
      /**
       * @param {int32} numContexts - Number of contexts
       * @param {int32} tableSize - Positions kept per context
       */
      constructor(numContexts, tableSize) {
        /** @type {int32[][]} */
        this.positions = [];
        for (let i = 0; i < numContexts; i++) {
          this.positions.push(new Int32Array(tableSize));
        }
        /** @type {int32[]} */
        this.writePos = new Int32Array(numContexts);
        /** @type {int32[]} */
        this.count = new Int32Array(numContexts);
      }
    }

    /**
     * MSB-first bit reader; bits past the end read as 0
     */
    class RolzBitReader {
      /**
       * @param {uint8[]} data - Source bytes
       * @param {int32} startOffset - Position of the first bit's byte
       */
      constructor(data, startOffset) {
        /** @type {uint8[]} */
        this.data = data;
        /** @type {int32} */
        this.bytePos = startOffset;
        /** @type {int32} */
        this.bitPos = 8;
      }

      /**
       * @returns {uint32} Next bit
       */
      readBit() {
        if (this.bitPos >= 8) {
          this.bitPos = 0;
          this.bytePos++;
        }
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(this.data[this.bytePos - 1], 7 - this.bitPos), 1);
        this.bitPos++;
        return bit;
      }

      /**
       * @param {int32} count - Number of bits, most significant first
       * @returns {uint32} Value read
       */
      readBits(count) {
        /** @type {uint32} */
        let value = 0;
        for (let i = 0; i < count; i++) {
          value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
        }
        return value;
      }
    }

    class ROLZInstance extends IAlgorithmInstance {
      /**
       * @param {ROLZAlgorithm} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - True to decompress
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decompress, false = compress
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // Matches CompressionWorkbench's BB_ROLZ
        /** @type {int32} */
        this.WINDOW_SIZE = 32768;
        /** @type {int32} */
        this.MIN_MATCH = 3;
        /** @type {int32} */
        this.MAX_MATCH = 255;
        /** @type {int32} */
        this.NUM_CONTEXTS = 256;
        /** @type {int32} */
        this.TABLE_SIZE = 256;
      }

      /**
       * Compress or decompress the collected input
       * @returns {uint8[]} Output bytes
       */
      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          /** @type {uint8[]} */
          const decoded = this.decompress(this.inputBuffer);
          /** @type {uint8[]} */
          const freshAfterDecode = [];
          this.inputBuffer = freshAfterDecode;
          return decoded;
        }

        // Even empty input produces a fixed 4-byte header (matches the
        // C# reference, which always writes the uncompressed size).
        /** @type {uint8[]} */
        const result = this.compress(this.inputBuffer);
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      // Context-based match tables: the previous byte selects which of 256
      // offset tables to search. Each context keeps a circular buffer of up
      // to 256 recent positions. Matches are encoded as (table index,
      // length - MIN_MATCH) rather than a raw offset, which is cheaper when
      // the context predicts the match well.
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Size header and token bitstream
       */
      compress(data) {
        /** @type {uint8[]} */
        const compressed = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) {
          return compressed;
        }

        /** @type {RolzTables} */
        const tables = this._createTables();
        /** @type {uint8[]} */
        const bits = [];

        /** @type {int32} */
        let pos = 0;
        while (pos < data.length) {
          /** @type {uint8} */
          const ctx = pos > 0 ? data[pos - 1] : 0;
          /** @type {int32[]} */
          const table = tables.positions[ctx];
          /** @type {int32} */
          const count = tables.count[ctx];

          /** @type {int32} */
          let bestLen = 0;
          /** @type {int32} */
          let bestIdx = 0;
          /** @type {int32} */
          const maxLen = Math.min(this.MAX_MATCH, data.length - pos);

          for (let i = 0; i < count; i++) {
            /** @type {int32} */
            const candidate = table[i];
            if (pos - candidate > this.WINDOW_SIZE) {
              continue;
            }
            if (candidate >= pos) {
              continue;
            }

            /** @type {int32} */
            let len = 0;
            while (len < maxLen && data[candidate + len] === data[pos + len]) {
              len++;
            }

            if (len >= this.MIN_MATCH && len > bestLen) {
              bestLen = len;
              bestIdx = i;
              if (bestLen === maxLen) {
                break;
              }
            }
          }

          if (bestLen >= this.MIN_MATCH) {
            bits.push(1);
            this._pushBits(bits, bestIdx, 8);
            this._pushBits(bits, bestLen - this.MIN_MATCH, 8);
            this._updateTable(tables, ctx, pos);
            pos += bestLen;
          } else {
            bits.push(0);
            this._pushBits(bits, data[pos], 8);
            this._updateTable(tables, ctx, pos);
            pos++;
          }
        }

        /** @type {uint8[]} */
        const packed = this._bitsToBytes(bits);
        for (let i = 0; i < packed.length; i++) {
          compressed.push(packed[i]);
        }
        return compressed;
      }

      /**
       * @param {uint8[]} data - Size header and token bitstream
       * @returns {uint8[]} Decoded bytes
       */
      decompress(data) {
        /** @type {uint32} */
        const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        /** @type {uint8[]} */
        const dst = [];
        if (uncompressedSize === 0) {
          return dst;
        }

        /** @type {RolzBitReader} */
        const reader = new RolzBitReader(data, 4);
        /** @type {RolzTables} */
        const tables = this._createTables();

        while (dst.length < uncompressedSize) {
          /** @type {uint8} */
          const ctx = dst.length > 0 ? dst[dst.length - 1] : 0;

          /** @type {uint32} */
          const flag = reader.readBit();
          if (flag === 0) {
            /** @type {uint8} */
            const b = reader.readBits(8);
            this._updateTable(tables, ctx, dst.length);
            dst.push(b);
          } else {
            /** @type {int32} */
            const idx = reader.readBits(8);
            /** @type {int32} */
            const lengthCode = reader.readBits(8);
            /** @type {int32} */
            const length = lengthCode + this.MIN_MATCH;

            /** @type {int32} */
            const filled = tables.count[ctx];
            if (idx >= filled) {
              throw new Error('ROLZ: invalid table index ' + idx + ' for context ' + ctx);
            }

            /** @type {int32} */
            const matchPos = tables.positions[ctx][idx];
            this._updateTable(tables, ctx, dst.length);

            for (let i = 0; i < length; i++) {
              if (dst.length >= uncompressedSize) {
                throw new Error('ROLZ: decompressed data exceeds expected size.');
              }
              dst.push(dst[matchPos + i]);
            }
          }
        }

        return dst;
      }

      /**
       * @private
       * @returns {RolzTables} Empty context tables
       */
      _createTables() {
        return new RolzTables(this.NUM_CONTEXTS, this.TABLE_SIZE);
      }

      /**
       * @private
       * @param {RolzTables} tables - Context tables
       * @param {uint8} ctx - Context (previous byte)
       * @param {int32} position - Position to record
       */
      _updateTable(tables, ctx, position) {
        /** @type {int32} */
        const wp = tables.writePos[ctx];
        tables.positions[ctx][wp] = position;
        tables.writePos[ctx] = (wp + 1) % this.TABLE_SIZE;
        /** @type {int32} */
        const filled = tables.count[ctx];
        if (filled < this.TABLE_SIZE) {
          tables.count[ctx] = filled + 1;
        }
      }

      /**
       * @private
       * @param {uint8[]} bits - Bit list to extend
       * @param {uint32} value - Value
       * @param {int32} count - Number of bits, most significant first
       */
      _pushBits(bits, value, count) {
        for (let i = count - 1; i >= 0; i--) {
          bits.push(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        }
      }

      /**
       * @private
       * @param {uint8[]} bits - Bits, most significant first
       * @returns {uint8[]} Packed bytes, last one zero-padded
       */
      _bitsToBytes(bits) {
        /** @type {uint8[]} */
        const bytes = [];
        /** @type {uint32} */
        let currentByte = 0;
        /** @type {int32} */
        let bitsUsed = 0;
        for (let i = 0; i < bits.length; i++) {
          currentByte = OpCodes.Or32(OpCodes.Shl32(currentByte, 1), bits[i]);
          bitsUsed++;
          if (bitsUsed === 8) {
            bytes.push(currentByte);
            currentByte = 0;
            bitsUsed = 0;
          }
        }
        if (bitsUsed > 0) {
          bytes.push(OpCodes.Shl32(currentByte, 8 - bitsUsed));
        }
        return bytes;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ROLZAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ROLZAlgorithm, ROLZInstance };
}));