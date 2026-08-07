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
        const testInput1 = OpCodes.AnsiToBytes("A");
        const testExpected1 = [1, 0, 0, 0, 32, 128];

        const testInput2 = OpCodes.AnsiToBytes("AB");
        const testExpected2 = [2, 0, 0, 0, 32, 144, 128];

        const testInput3 = OpCodes.AnsiToBytes("ABAB");
        const testExpected3 = [4, 0, 0, 0, 32, 144, 136, 36, 32];

        const testInput4 = OpCodes.AnsiToBytes("ABCABC");
        const testExpected4 = [6, 0, 0, 0, 32, 144, 136, 100, 18, 17, 12];

        const testInput5 = OpCodes.AnsiToBytes("Hello World");
        const testExpected5 = [11, 0, 0, 0, 36, 25, 77, 134, 195, 120, 128, 174, 111, 57, 27, 12, 128];

        const testInput6 = OpCodes.AnsiToBytes("aaabbbcccaaa");
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

      CreateInstance(isInverse = false) {
        return new ROLZInstance(this, isInverse);
      }
    }

    class ROLZInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // Matches CompressionWorkbench's BB_ROLZ
        this.WINDOW_SIZE = 32768;
        this.MIN_MATCH = 3;
        this.MAX_MATCH = 255;
        this.NUM_CONTEXTS = 256;
        this.TABLE_SIZE = 256;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) return [];
          const result = this.decompress(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }

        // Even empty input produces a fixed 4-byte header (matches the
        // C# reference, which always writes the uncompressed size).
        const result = this.compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Context-based match tables: the previous byte selects which of 256
      // offset tables to search. Each context keeps a circular buffer of up
      // to 256 recent positions. Matches are encoded as (table index,
      // length - MIN_MATCH) rather than a raw offset, which is cheaper when
      // the context predicts the match well.
      compress(data) {
        const compressed = OpCodes.Unpack32LE(data.length);
        if (data.length === 0) return compressed;

        const tables = this._createTables();
        const bits = [];

        let pos = 0;
        while (pos < data.length) {
          const ctx = pos > 0 ? data[pos - 1] : 0;
          const table = tables.positions[ctx];
          const count = tables.count[ctx];

          let bestLen = 0;
          let bestIdx = 0;
          const maxLen = Math.min(this.MAX_MATCH, data.length - pos);

          for (let i = 0; i < count; i++) {
            const candidate = table[i];
            if (pos - candidate > this.WINDOW_SIZE) continue;
            if (candidate >= pos) continue;

            let len = 0;
            while (len < maxLen && data[candidate + len] === data[pos + len])
              len++;

            if (len >= this.MIN_MATCH && len > bestLen) {
              bestLen = len;
              bestIdx = i;
              if (bestLen === maxLen) break;
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

        { const _src = this._bitsToBytes(bits); for (let _i = 0; _i < _src.length; _i++) compressed.push(_src[_i]); }
        return compressed;
      }

      decompress(data) {
        const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (uncompressedSize === 0) return [];

        const reader = this._createBitReader(data, 4);
        const tables = this._createTables();
        const dst = [];

        while (dst.length < uncompressedSize) {
          const ctx = dst.length > 0 ? dst[dst.length - 1] : 0;

          if (reader.readBit() === 0) {
            const b = reader.readBits(8);
            this._updateTable(tables, ctx, dst.length);
            dst.push(b);
          } else {
            const idx = reader.readBits(8);
            const length = reader.readBits(8) + this.MIN_MATCH;

            if (idx >= tables.count[ctx])
              throw new Error('ROLZ: invalid table index ' + idx + ' for context ' + ctx);

            const matchPos = tables.positions[ctx][idx];
            this._updateTable(tables, ctx, dst.length);

            for (let i = 0; i < length; i++) {
              if (dst.length >= uncompressedSize)
                throw new Error('ROLZ: decompressed data exceeds expected size.');
              dst.push(dst[matchPos + i]);
            }
          }
        }

        return dst;
      }

      /** @private */
      _createTables() {
        const positions = [];
        for (let i = 0; i < this.NUM_CONTEXTS; i++)
          positions.push(new Array(this.TABLE_SIZE).fill(0));
        return {
          positions,
          writePos: new Array(this.NUM_CONTEXTS).fill(0),
          count: new Array(this.NUM_CONTEXTS).fill(0)
        };
      }

      /** @private */
      _updateTable(tables, ctx, position) {
        const wp = tables.writePos[ctx];
        tables.positions[ctx][wp] = position;
        tables.writePos[ctx] = (wp + 1) % this.TABLE_SIZE;
        if (tables.count[ctx] < this.TABLE_SIZE)
          tables.count[ctx]++;
      }

      /** @private */
      _pushBits(bits, value, count) {
        for (let i = count - 1; i >= 0; i--)
          bits.push(OpCodes.AndN(OpCodes.Shr32(value, i), 1));
      }

      /** @private */
      _bitsToBytes(bits) {
        const bytes = [];
        let currentByte = 0;
        let bitsUsed = 0;
        for (const bit of bits) {
          currentByte = OpCodes.OrN(OpCodes.Shl32(currentByte, 1), bit);
          bitsUsed++;
          if (bitsUsed === 8) {
            bytes.push(currentByte);
            currentByte = 0;
            bitsUsed = 0;
          }
        }
        if (bitsUsed > 0)
          bytes.push(OpCodes.Shl32(currentByte, 8 - bitsUsed));
        return bytes;
      }

      /** @private */
      _createBitReader(data, startOffset) {
        let bytePos = startOffset;
        let bitPos = 8;
        return {
          readBit: () => {
            if (bitPos >= 8) {
              bitPos = 0;
              bytePos++;
            }
            const bit = OpCodes.AndN(OpCodes.Shr32(data[bytePos - 1], 7 - bitPos), 1);
            bitPos++;
            return bit;
          },
          readBits: function(count) {
            let value = 0;
            for (let i = 0; i < count; i++)
              value = OpCodes.OrN(OpCodes.Shl32(value, 1), this.readBit());
            return value;
          }
        };
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