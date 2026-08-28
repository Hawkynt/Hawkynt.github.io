/*
 * Lizard (formerly LZ5) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Lizard is an efficient compressor with very fast decompression, achieving compression
 * ratios comparable to zip/zlib at low/medium levels with fast decompression speed.
 * It belongs to the LZ77 family with improved entropy utilization over LZ4.
 * Developed by Przemysław Skibiński (2016-2017) based on Yann Collet's LZ4 (2011-2015).
 *
 * This implementation focuses on Lizard Level 10 (fast mode) compression.
 * Format specification: https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md
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

  if (!AlgorithmFramework)
    throw new Error('AlgorithmFramework dependency is required');

  if (!OpCodes)
    throw new Error('OpCodes dependency is required');

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== LIZARD ALGORITHM IMPLEMENTATION =====

  class LizardCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Lizard";
      this.description = "Efficient compressor with very fast decompression and compression ratios comparable to zip/zlib at fast decompression speed. Successor to LZ4 with improved entropy utilization and four compression levels (10, 20, 30, 40).";
      this.inventor = "Przemysław Skibiński, Yann Collet";
      this.year = 2016;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PL;

      // Lizard Block format constants, matching CompressionWorkbench's LizardBuildingBlock
      // (the authoritative reference): an LZ4-style token stream with a 65536-byte window.
      this.MIN_MATCH = 4;              // Minimum match length
      this.HASH_SIZE_U32 = 65536;      // Hash table size (must be power of 2)
      this.HASH_LOG = 16;              // Log2 of hash size
      this.LAST_LITERALS_MIN = 5;      // Match search may not start within this many bytes of the end
      this.MAX_WINDOW = 65536;         // Maximum backward distance

      // Documentation and references
      this.documentation = [
        new LinkItem("Lizard GitHub Repository", "https://github.com/inikep/lizard"),
        new LinkItem("Lizard Block Format Specification", "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md"),
        new LinkItem("Lizard Frame Format Specification", "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Frame_format.md")
      ];

      this.references = [
        new LinkItem("Official Lizard Implementation", "https://github.com/inikep/lizard/tree/lizard/lib"),
        new LinkItem("LZ4 Compression (predecessor)", "https://github.com/lz4/lz4"),
        new LinkItem("Compression Benchmark", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
      // LizardBuildingBlock (BB_Lizard), which is the authoritative reference for
      // this container: 4-byte little-endian original length, then an LZ4-style
      // token stream (token byte: high nibble = literal length, low nibble = match
      // length - MIN_MATCH; a match search may not start within the last 5 bytes
      // of input, but an accepted match may still extend into them).
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "All literals - no matches (ABCD)",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [0x04, 0x00, 0x00, 0x00, 0x40, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Simple repetition - AAAAA (5 A's, too short to search for a match)",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("AAAAA"),
          expected: [0x05, 0x00, 0x00, 0x00, 0x50, 0x41, 0x41, 0x41, 0x41, 0x41]
        },
        {
          text: "Pattern ABCABC (6 bytes, too short to search for a match)",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("ABCABC"),
          expected: [0x06, 0x00, 0x00, 0x00, 0x60, 0x41, 0x42, 0x43, 0x41, 0x42, 0x43]
        },
        {
          text: "Text sample with a real match - 'the quick brown fox...' x4",
          uri: "https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [
            0xb4, 0x00, 0x00, 0x00, 0xf0, 0x10, 0x74, 0x68, 0x65, 0x20, 0x71, 0x75, 0x69, 0x63, 0x6b, 0x20,
            0x62, 0x72, 0x6f, 0x77, 0x6e, 0x20, 0x66, 0x6f, 0x78, 0x20, 0x6a, 0x75, 0x6d, 0x70, 0x73, 0x20,
            0x6f, 0x76, 0x65, 0x72, 0x20, 0x1f, 0x00, 0x91, 0x6c, 0x61, 0x7a, 0x79, 0x20, 0x64, 0x6f, 0x67,
            0x2e, 0x0e, 0x00, 0x0f, 0x2d, 0x00, 0x70
          ]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LizardInstance(this, isInverse);
    }
  }

  // ===== LIZARD INSTANCE IMPLEMENTATION =====

  /**
 * Lizard cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LizardInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Lizard parameters from algorithm
      this.MIN_MATCH = algorithm.MIN_MATCH;
      this.HASH_SIZE_U32 = algorithm.HASH_SIZE_U32;
      this.HASH_LOG = algorithm.HASH_LOG;
      this.LAST_LITERALS_MIN = algorithm.LAST_LITERALS_MIN;
      this.MAX_WINDOW = algorithm.MAX_WINDOW;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const result = this.isInverse ? this._decompress() : this._compress();
      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION (LZ4-compatible fast parser) =====

    _compress() {
      const input = this.inputBuffer;
      const inputLength = input.length;

      // Container: 4-byte little-endian original length, then the payload
      const header = OpCodes.Unpack32LE(inputLength);
      const payload = inputLength === 0 ? [] : this._compressBlock(input);
      return header.concat(payload);
    }

    _compressBlock(input) {
      const n = input.length;
      const output = [];
      const hashHead = new Int32Array(this.HASH_SIZE_U32);
      hashHead.fill(-1);

      let anchor = 0;
      let pos = 0;
      const matchLimit = n - this.LAST_LITERALS_MIN;

      while (pos < matchLimit) {
        const match = this._findMatch(input, pos, hashHead, matchLimit + this.LAST_LITERALS_MIN);

        if (match.length < this.MIN_MATCH) {
          this._insertHash(input, pos, hashHead);
          ++pos;
          continue;
        }

        this._emitSequence(output, input, anchor, pos, match.offset, match.length);

        const end = pos + match.length;
        for (let i = pos; i < end && i + 3 < n; ++i)
          this._insertHash(input, i, hashHead);

        pos = end;
        anchor = pos;
      }

      this._emitFinalLiterals(output, input, anchor, n);
      return output;
    }

    _findMatch(src, pos, hashHead, limit) {
      if (pos + this.MIN_MATCH > src.length)
        return { length: 0, offset: 0 };

      const h = this._hash(src, pos);
      const candidate = hashHead[h];

      if (candidate < 0 || (pos - candidate) > this.MAX_WINDOW ||
          src[candidate] !== src[pos] || src[candidate + 1] !== src[pos + 1] ||
          src[candidate + 2] !== src[pos + 2] || src[candidate + 3] !== src[pos + 3])
        return { length: 0, offset: 0 };

      const maxLen = Math.min(limit, src.length) - pos;
      let len = this.MIN_MATCH;
      while (len < maxLen && src[candidate + len] === src[pos + len])
        ++len;

      return { length: len, offset: pos - candidate };
    }

    _insertHash(src, pos, hashHead) {
      if (pos + 4 > src.length)
        return;
      hashHead[this._hash(src, pos)] = pos;
    }

    _hash(data, pos) {
      const val = OpCodes.Pack32LE(
        OpCodes.ToByte(data[pos]),
        OpCodes.ToByte(data[pos+1]),
        OpCodes.ToByte(data[pos+2]),
        OpCodes.ToByte(data[pos+3])
      );
      return OpCodes.Shr32(OpCodes.Mul32(val, 2654435761), 32 - this.HASH_LOG);
    }

    _emitSequence(output, src, litStart, matchStart, offset, matchLen) {
      const litLen = matchStart - litStart;
      const mlCode = matchLen - this.MIN_MATCH;

      const litNibble = Math.min(litLen, 15);
      const mlNibble = Math.min(mlCode, 15);
      output.push(OpCodes.ToByte(OpCodes.Shl8(litNibble, 4)|mlNibble));

      this._writeExtendedLength(output, litLen, litNibble);
      for (let i = 0; i < litLen; ++i)
        output.push(OpCodes.ToByte(src[litStart + i]));

      output.push(OpCodes.ToByte(offset));
      output.push(OpCodes.ToByte(OpCodes.Shr16(offset, 8)));

      this._writeExtendedLength(output, mlCode, mlNibble);
    }

    _emitFinalLiterals(output, src, start, end) {
      const litLen = end - start;
      if (litLen === 0)
        return;

      const litNibble = Math.min(litLen, 15);
      output.push(OpCodes.ToByte(OpCodes.Shl8(litNibble, 4)));
      this._writeExtendedLength(output, litLen, litNibble);
      for (let i = 0; i < litLen; ++i)
        output.push(OpCodes.ToByte(src[start + i]));
    }

    _writeExtendedLength(output, actual, nibble) {
      if (nibble < 15)
        return;

      let remaining = actual - 15;
      while (remaining >= 255) {
        output.push(255);
        remaining -= 255;
      }
      output.push(OpCodes.ToByte(remaining));
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const input = this.inputBuffer;
      if (input.length < 4)
        return [];

      const originalLength = OpCodes.Pack32LE(
        OpCodes.ToByte(input[0]), OpCodes.ToByte(input[1]),
        OpCodes.ToByte(input[2]), OpCodes.ToByte(input[3])
      );
      if (originalLength === 0)
        return [];

      const output = this._decompressBlock(input.slice(4));
      return output.length === originalLength ? output : output.slice(0, originalLength);
    }

    _decompressBlock(input) {
      const inputLength = input.length;
      const output = [];
      let ip = 0;

      while (ip < inputLength) {
        const token = OpCodes.ToByte(input[ip++]);

        let literalLength = OpCodes.ToByte(OpCodes.Shr8(token, 4));
        if (literalLength === 15) {
          let len;
          do {
            if (ip >= inputLength) break;
            len = OpCodes.ToByte(input[ip++]);
            literalLength += len;
          } while (len === 255);
        }

        for (let i = 0; i < literalLength; ++i) {
          if (ip >= inputLength) break;
          output.push(OpCodes.ToByte(input[ip++]));
        }

        // Final, match-less sequence: no more input follows the literals.
        if (ip >= inputLength)
          break;

        if (ip + 1 >= inputLength) break;
        const offset = OpCodes.Pack16LE(OpCodes.ToByte(input[ip]), OpCodes.ToByte(input[ip+1]));
        ip += 2;

        const matchLenField = OpCodes.And8(token, 0x0F);
        let matchLength = matchLenField + this.MIN_MATCH;
        if (matchLenField === 15) {
          let len;
          do {
            if (ip >= inputLength) break;
            len = OpCodes.ToByte(input[ip++]);
            matchLength += len;
          } while (len === 255);
        }

        const matchPos = output.length - offset;
        if (matchPos < 0)
          break;

        for (let i = 0; i < matchLength; ++i)
          output.push(OpCodes.ToByte(output[matchPos + i]));
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LizardCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LizardCompression, LizardInstance };
}));
