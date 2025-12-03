/*
 * DEFLATE Compression Algorithm (RFC 1951)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Production-quality DEFLATE implementation combining LZ77 and Huffman coding.
 * Full RFC 1951 compliance with dynamic/fixed Huffman codes.
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== RFC 1951 CONSTANTS =====

  // Length codes 257-285 (extra bits)
  const LENGTH_CODES = [
    {base: 3, extra: 0},    // 257
    {base: 4, extra: 0},    // 258
    {base: 5, extra: 0},    // 259
    {base: 6, extra: 0},    // 260
    {base: 7, extra: 0},    // 261
    {base: 8, extra: 0},    // 262
    {base: 9, extra: 0},    // 263
    {base: 10, extra: 0},   // 264
    {base: 11, extra: 1},   // 265
    {base: 13, extra: 1},   // 266
    {base: 15, extra: 1},   // 267
    {base: 17, extra: 1},   // 268
    {base: 19, extra: 2},   // 269
    {base: 23, extra: 2},   // 270
    {base: 27, extra: 2},   // 271
    {base: 31, extra: 2},   // 272
    {base: 35, extra: 3},   // 273
    {base: 43, extra: 3},   // 274
    {base: 51, extra: 3},   // 275
    {base: 59, extra: 3},   // 276
    {base: 67, extra: 4},   // 277
    {base: 83, extra: 4},   // 278
    {base: 99, extra: 4},   // 279
    {base: 115, extra: 4},  // 280
    {base: 131, extra: 5},  // 281
    {base: 163, extra: 5},  // 282
    {base: 195, extra: 5},  // 283
    {base: 227, extra: 5},  // 284
    {base: 258, extra: 0}   // 285
  ];

  // Distance codes 0-29 (extra bits)
  const DISTANCE_CODES = [
    {base: 1, extra: 0},     // 0
    {base: 2, extra: 0},     // 1
    {base: 3, extra: 0},     // 2
    {base: 4, extra: 0},     // 3
    {base: 5, extra: 1},     // 4
    {base: 7, extra: 1},     // 5
    {base: 9, extra: 2},     // 6
    {base: 13, extra: 2},    // 7
    {base: 17, extra: 3},    // 8
    {base: 25, extra: 3},    // 9
    {base: 33, extra: 4},    // 10
    {base: 49, extra: 4},    // 11
    {base: 65, extra: 5},    // 12
    {base: 97, extra: 5},    // 13
    {base: 129, extra: 6},   // 14
    {base: 193, extra: 6},   // 15
    {base: 257, extra: 7},   // 16
    {base: 385, extra: 7},   // 17
    {base: 513, extra: 8},   // 18
    {base: 769, extra: 8},   // 19
    {base: 1025, extra: 9},  // 20
    {base: 1537, extra: 9},  // 21
    {base: 2049, extra: 10}, // 22
    {base: 3073, extra: 10}, // 23
    {base: 4097, extra: 11}, // 24
    {base: 6145, extra: 11}, // 25
    {base: 8193, extra: 12}, // 26
    {base: 12289, extra: 12},// 27
    {base: 16385, extra: 13},// 28
    {base: 24577, extra: 13} // 29
  ];

  // Fixed Huffman code lengths (RFC 1951 section 3.2.6)
  const FIXED_LITERAL_LENGTHS = (() => {
    const lengths = new Array(288);
    for (let i = 0; i <= 143; ++i) lengths[i] = 8;
    for (let i = 144; i <= 255; ++i) lengths[i] = 9;
    for (let i = 256; i <= 279; ++i) lengths[i] = 7;
    for (let i = 280; i <= 287; ++i) lengths[i] = 8;
    return lengths;
  })();

  const FIXED_DISTANCE_LENGTHS = new Array(32).fill(5);

  // ===== BIT STREAM HELPER =====

  class BitStream {
    constructor() {
      this.bytes = [];
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    writeBits(value, numBits) {
      this.bitBuffer = OpCodes.ToUint32(OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(value, this.bitCount)));
      this.bitCount += numBits;

      while (this.bitCount >= 8) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = OpCodes.Shr32(this.bitBuffer, 8);
        this.bitCount -= 8;
      }
    }

    // Write Huffman code in reversed bit order (RFC 1951 requirement)
    writeHuffmanCode(code, length) {
      let reversed = 0;
      for (let i = 0; i < length; ++i) {
        const bit = OpCodes.AndN(OpCodes.Shr16(code, i), 1);
        reversed = OpCodes.AndN(OpCodes.OrN(reversed, OpCodes.Shl16(bit, length - 1 - i)), 0xFFFF);
      }
      this.writeBits(reversed, length);
    }

    flush() {
      if (this.bitCount > 0) {
        this.bytes.push(OpCodes.AndN(this.bitBuffer, 0xFF));
        this.bitBuffer = 0;
        this.bitCount = 0;
      }
      return this.bytes;
    }

    getBytes() {
      return this.bytes.slice();
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.bytePos = 0;
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    readBits(numBits) {
      while (this.bitCount < numBits) {
        if (this.bytePos >= this.bytes.length) {
          throw new Error('Unexpected end of compressed data');
        }
        this.bitBuffer = OpCodes.ToUint32(OpCodes.OrN(this.bitBuffer, OpCodes.Shl32(this.bytes[this.bytePos++], this.bitCount)));
        this.bitCount += 8;
      }

      const mask = OpCodes.ToUint32(OpCodes.Shl32(1, numBits) - 1);
      const value = OpCodes.AndN(this.bitBuffer, mask);
      this.bitBuffer = OpCodes.Shr32(this.bitBuffer, numBits);
      this.bitCount -= numBits;
      return value;
    }

    alignToByte() {
      this.bitBuffer = 0;
      this.bitCount = 0;
    }

    hasMore() {
      return this.bytePos < this.bytes.length || this.bitCount > 0;
    }
  }

  // ===== HUFFMAN TREE =====

  class HuffmanTree {
    constructor() {
      this.root = null;
    }

    static buildFromLengths(lengths) {
      const tree = new HuffmanTree();
      const maxLen = Math.max(...lengths.filter(l => l > 0));
      if (maxLen === 0) return tree;

      // RFC 1951 algorithm for generating codes from lengths
      const blCount = new Array(maxLen + 1).fill(0);
      for (const len of lengths) {
        if (len > 0) blCount[len]++;
      }

      const nextCode = new Array(maxLen + 1);
      let code = 0;
      blCount[0] = 0;

      for (let bits = 1; bits <= maxLen; ++bits) {
        code = OpCodes.Shl16(code + blCount[bits - 1], 1);
        nextCode[bits] = code;
      }

      // Assign codes to symbols
      const codes = new Array(lengths.length);
      for (let n = 0; n < lengths.length; ++n) {
        const len = lengths[n];
        if (len !== 0) {
          codes[n] = {code: nextCode[len], length: len};
          nextCode[len]++;
        }
      }

      // Build tree from codes
      tree.root = {};
      for (let symbol = 0; symbol < codes.length; ++symbol) {
        if (!codes[symbol]) continue;

        let node = tree.root;
        const {code, length} = codes[symbol];

        for (let i = length - 1; i >= 0; --i) {
          const bit = OpCodes.AndN(OpCodes.Shr16(code, i), 1);
          const key = bit ? 'one' : 'zero';

          if (i === 0) {
            node[key] = {symbol: symbol};
          } else {
            if (!node[key]) node[key] = {};
            node = node[key];
          }
        }
      }

      tree.codes = codes;
      return tree;
    }

    decode(bitReader) {
      let node = this.root;
      if (!node) throw new Error('Invalid Huffman tree');

      while (node.symbol === undefined) {
        const bit = bitReader.readBits(1);
        node = bit ? node.one : node.zero;
        if (!node) throw new Error('Invalid Huffman code');
      }

      return node.symbol;
    }

    encode(symbol) {
      if (!this.codes || !this.codes[symbol]) {
        throw new Error(`No Huffman code for symbol ${symbol}`);
      }
      return this.codes[symbol];
    }
  }

  // ===== DEFLATE ALGORITHM =====

  class DeflateAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DEFLATE";
      this.description = "Industry-standard lossless compression combining LZ77 and Huffman coding. Used in ZIP, gzip, PNG, and HTTP compression. Full RFC 1951 implementation.";
      this.inventor = "Phil Katz";
      this.year = 1993;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // DEFLATE configuration (RFC 1951 limits)
      this.WINDOW_SIZE = 32768;      // 32K window
      this.MAX_MATCH = 258;          // Maximum match length
      this.MIN_MATCH = 3;            // Minimum match length
      this.HASH_BITS = 15;           // Hash table size
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      this.HASH_MASK = OpCodes.ToUint32(this.HASH_SIZE - 1);

      // Documentation
      this.documentation = [
        new LinkItem("RFC 1951 - DEFLATE Specification", "https://www.rfc-editor.org/rfc/rfc1951"),
        new LinkItem("RFC 1950 - zlib Format", "https://www.rfc-editor.org/rfc/rfc1950"),
        new LinkItem("RFC 1952 - gzip Format", "https://www.rfc-editor.org/rfc/rfc1952")
      ];

      this.references = [
        new LinkItem("zlib Library", "https://github.com/madler/zlib"),
        new LinkItem("DEFLATE Wikipedia", "https://en.wikipedia.org/wiki/Deflate"),
        new LinkItem("PNG Specification", "https://www.w3.org/TR/PNG/")
      ];

      // Test vectors - Round-trip compression tests
      // Note: Compression may produce different valid outputs, so we test round-trip behavior
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          [], // Empty expected for round-trip test
          "RFC 1951 DEFLATE round-trip - hello",
          "https://www.rfc-editor.org/rfc/rfc1951.txt"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"),
          [], // Empty expected for round-trip test
          "RFC 1951 DEFLATE round-trip - AAAA",
          "https://www.rfc-editor.org/rfc/rfc1951.txt"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [], // Empty expected for round-trip test
          "RFC 1951 DEFLATE round-trip - ABCABCABC",
          "https://www.rfc-editor.org/rfc/rfc1951.txt"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DeflateInstance(this, isInverse);
    }
  }

  /**
 * Deflate cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DeflateInstance extends IAlgorithmInstance {
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
      if (this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress(data) {
      if (data.length === 0) return [];

      const stream = new BitStream();

      // Write final block with fixed Huffman codes
      stream.writeBits(1, 1); // BFINAL = 1 (last block)
      stream.writeBits(1, 2); // BTYPE = 01 (fixed Huffman)

      // Build fixed Huffman trees
      const literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
      const distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);

      // LZ77 compression with hash table
      const matches = this._findMatches(data);

      // Encode matches
      for (const match of matches) {
        if (match.type === 'literal') {
          // Encode literal byte
          const {code, length} = literalTree.encode(match.value);
          stream.writeHuffmanCode(code, length);
        } else {
          // Encode length
          const lengthCode = this._getLengthCode(match.length);
          const lengthInfo = LENGTH_CODES[lengthCode - 257];
          const {code: lenCode, length: lenCodeLen} = literalTree.encode(lengthCode);
          stream.writeHuffmanCode(lenCode, lenCodeLen);

          if (lengthInfo.extra > 0) {
            const extraBits = match.length - lengthInfo.base;
            stream.writeBits(extraBits, lengthInfo.extra);
          }

          // Encode distance
          const distCode = this._getDistanceCode(match.distance);
          const distInfo = DISTANCE_CODES[distCode];
          const {code: dstCode, length: dstCodeLen} = distanceTree.encode(distCode);
          stream.writeHuffmanCode(dstCode, dstCodeLen);

          if (distInfo.extra > 0) {
            const extraBits = match.distance - distInfo.base;
            stream.writeBits(extraBits, distInfo.extra);
          }
        }
      }

      // Write end-of-block symbol (256)
      const {code, length} = literalTree.encode(256);
      stream.writeHuffmanCode(code, length);

      return stream.flush();
    }

    _findMatches(data) {
      const matches = [];
      const hashTable = new Map();
      let pos = 0;

      while (pos < data.length) {
        let bestMatch = null;

        // Try to find match
        if (pos + this.algorithm.MIN_MATCH <= data.length) {
          const hash = this._hash3(data, pos);
          const positions = hashTable.get(hash);

          if (positions) {
            for (let i = positions.length - 1; i >= 0; --i) {
              const matchPos = positions[i];
              if (pos - matchPos > this.algorithm.WINDOW_SIZE) break;

              const len = this._matchLength(data, matchPos, pos);
              if (len >= this.algorithm.MIN_MATCH) {
                if (!bestMatch || len > bestMatch.length) {
                  bestMatch = {
                    type: 'match',
                    distance: pos - matchPos,
                    length: len
                  };
                  if (len >= this.algorithm.MAX_MATCH) break;
                }
              }
            }
          }

          // Update hash table
          if (!hashTable.has(hash)) hashTable.set(hash, []);
          hashTable.get(hash).push(pos);
        }

        if (bestMatch) {
          matches.push(bestMatch);
          pos += bestMatch.length;
        } else {
          matches.push({type: 'literal', value: data[pos]});
          ++pos;
        }
      }

      return matches;
    }

    _hash3(data, pos) {
      if (pos + 3 > data.length) return 0;
      const hash1 = OpCodes.Shl16(data[pos], 10);
      const hash2 = OpCodes.Shl16(data[pos + 1], 5);
      const hash3 = data[pos + 2];
      const combined = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(hash1, hash2), hash3), 0xFFFF);
      return OpCodes.AndN(combined, this.algorithm.HASH_MASK);
    }

    _matchLength(data, pos1, pos2) {
      let len = 0;
      const maxLen = Math.min(this.algorithm.MAX_MATCH, data.length - pos2);

      while (len < maxLen && data[pos1 + len] === data[pos2 + len]) {
        ++len;
      }

      return len;
    }

    _getLengthCode(length) {
      for (let i = 0; i < LENGTH_CODES.length; ++i) {
        const info = LENGTH_CODES[i];
        const maxLen = i < LENGTH_CODES.length - 1 ?
          LENGTH_CODES[i + 1].base - 1 : info.base;
        if (length <= maxLen) return 257 + i;
      }
      return 285;
    }

    _getDistanceCode(distance) {
      for (let i = 0; i < DISTANCE_CODES.length; ++i) {
        const info = DISTANCE_CODES[i];
        const maxDist = i < DISTANCE_CODES.length - 1 ?
          DISTANCE_CODES[i + 1].base - 1 : OpCodes.ToUint32(info.base + OpCodes.Shl32(1, info.extra) - 1);
        if (distance <= maxDist) return i;
      }
      return 29;
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      const reader = new BitReader(data);
      const output = [];

      while (reader.hasMore()) {
        // Read block header
        const bfinal = reader.readBits(1);
        const btype = reader.readBits(2);

        if (btype === 0) {
          // Uncompressed block
          reader.alignToByte();
          const len = reader.readBits(16);
          const nlen = reader.readBits(16);

          if (OpCodes.XorN(len, nlen) !== 0xFFFF) {
            throw new Error('Invalid uncompressed block length');
          }

          for (let i = 0; i < len; ++i) {
            output.push(reader.readBits(8));
          }
        } else if (btype === 1 || btype === 2) {
          // Fixed or dynamic Huffman
          let literalTree, distanceTree;

          if (btype === 1) {
            // Fixed Huffman codes
            literalTree = HuffmanTree.buildFromLengths(FIXED_LITERAL_LENGTHS);
            distanceTree = HuffmanTree.buildFromLengths(FIXED_DISTANCE_LENGTHS);
          } else {
            // Dynamic Huffman codes
            const trees = this._readDynamicTrees(reader);
            literalTree = trees.literal;
            distanceTree = trees.distance;
          }

          // Decode compressed data
          while (true) {
            const symbol = literalTree.decode(reader);

            if (symbol === 256) {
              // End of block
              break;
            } else if (symbol < 256) {
              // Literal byte
              output.push(symbol);
            } else {
              // Length/distance pair
              const lengthCode = symbol - 257;
              const lengthInfo = LENGTH_CODES[lengthCode];
              let length = lengthInfo.base;

              if (lengthInfo.extra > 0) {
                length += reader.readBits(lengthInfo.extra);
              }

              const distCode = distanceTree.decode(reader);
              const distInfo = DISTANCE_CODES[distCode];
              let distance = distInfo.base;

              if (distInfo.extra > 0) {
                distance += reader.readBits(distInfo.extra);
              }

              // Copy from history
              const startPos = output.length - distance;
              for (let i = 0; i < length; ++i) {
                output.push(output[startPos + i]);
              }
            }
          }
        } else {
          throw new Error('Invalid block type');
        }

        if (bfinal) break;
      }

      return output;
    }

    _readDynamicTrees(reader) {
      const hlit = reader.readBits(5) + 257;
      const hdist = reader.readBits(5) + 1;
      const hclen = reader.readBits(4) + 4;

      // Code length alphabet order (RFC 1951 section 3.2.7)
      const clOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

      // Read code length codes
      const codeLengthLengths = new Array(19).fill(0);
      for (let i = 0; i < hclen; ++i) {
        codeLengthLengths[clOrder[i]] = reader.readBits(3);
      }

      const codeLengthTree = HuffmanTree.buildFromLengths(codeLengthLengths);

      // Decode literal/length and distance code lengths
      const lengths = [];
      while (lengths.length < hlit + hdist) {
        const symbol = codeLengthTree.decode(reader);

        if (symbol < 16) {
          lengths.push(symbol);
        } else if (symbol === 16) {
          const repeat = reader.readBits(2) + 3;
          const value = lengths[lengths.length - 1] || 0;
          for (let i = 0; i < repeat; ++i) lengths.push(value);
        } else if (symbol === 17) {
          const repeat = reader.readBits(3) + 3;
          for (let i = 0; i < repeat; ++i) lengths.push(0);
        } else if (symbol === 18) {
          const repeat = reader.readBits(7) + 11;
          for (let i = 0; i < repeat; ++i) lengths.push(0);
        }
      }

      const literalLengths = lengths.slice(0, hlit);
      const distanceLengths = lengths.slice(hlit, hlit + hdist);

      return {
        literal: HuffmanTree.buildFromLengths(literalLengths),
        distance: HuffmanTree.buildFromLengths(distanceLengths)
      };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DeflateAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DeflateAlgorithm, DeflateInstance };
}));
