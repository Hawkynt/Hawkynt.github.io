/*
 * LZRLE (LZO-RLE) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZO-RLE Version 1: Dictionary-based compression with run-length encoding for zero sequences.
 * Used in Linux kernel zram since 5.1 as default compressor.
 * Combines LZ77 sliding window with efficient RLE encoding for zero-heavy data.
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

  class LZRLECompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZRLE";
      this.description = "LZO-RLE compression combining LZ77 dictionary-based compression with run-length encoding for zero sequences. Default zram compressor in Linux kernel 5.1+, optimized for zero-heavy data common in RAM compression.";
      this.inventor = "Markus F.X.J. Oberhumer, Dave Rodgman";
      this.year = 2018;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + RLE";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria (LZO origin)

      // LZRLE parameters, matching CompressionWorkbench's LzrleBuildingBlock (the
      // authoritative reference): a clean-room literal/match/run token design, NOT
      // a reproduction of LZO1X's opcode table (see LzrleConstants.cs remarks).
      this.MIN_MATCH = 4;           // Minimum dictionary match length
      this.MIN_RUN = 4;             // Minimum repeated-byte run length
      this.TYPE_LITERAL = 0;
      this.TYPE_MATCH = 1;
      this.TYPE_RUN = 2;
      this.LENGTH_FIELD_BITS = 6;
      this.LENGTH_FIELD_MAX = OpCodes.Shl32(1, this.LENGTH_FIELD_BITS) - 1; // 63
      this.HASH_BITS = 15;
      this.HASH_SIZE = OpCodes.Shl32(1, this.HASH_BITS);
      this.MAX_CHAIN_DEPTH = 128;

      // Documentation and references
      this.documentation = [
        new LinkItem("Linux Kernel LZO Documentation", "https://docs.kernel.org/staging/lzo.html"),
        new LinkItem("Kernel.org LZO Specification", "https://www.kernel.org/doc/Documentation/lzo.txt"),
        new LinkItem("LZO-RLE Patch Discussion", "https://lwn.net/Articles/778510/"),
        new LinkItem("LZO-RLE Kernel Patch", "https://lore.kernel.org/lkml/20181127161913.23863-7-dave.rodgman@arm.com/")
      ];

      this.references = [
        new LinkItem("Official LZO Homepage", "http://www.oberhumer.com/opensource/lzo/"),
        new LinkItem("Wikipedia - LZO", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer"),
        new LinkItem("ZRAM Default to LZO-RLE", "https://lore.kernel.org/lkml/20181130114715.27523-9-dave.rodgman@arm.com/")
      ];

      // Test vectors - cross-checked byte-for-byte against CompressionWorkbench's
      // LzrleBuildingBlock (BB_Lzrle), the authoritative reference: a 4-byte
      // little-endian original-length header, then a token stream where each
      // token byte is [type:2][length field:6] - type 0 literal run, type 1
      // dictionary match (4-byte LE distance follows), type 2 repeated-byte run
      // (1 value byte follows). A length field of 63 means "read base-255
      // continuation bytes".
      this.tests = [
        new TestCase(
          [0x00, 0x00, 0x00, 0x00], // 4 zeros - minimum run length
          [0x04, 0x00, 0x00, 0x00, 0x80, 0x00], // header(4) + run token(type2,field0=len-4) + value 0
          "Minimum zero run (4 bytes)",
          "https://github.com/Hawkynt (CompressionWorkbench LzrleBuildingBlock)"
        ),
        new TestCase(
          [0x41, 0x42, 0x43], // "ABC" - no repetition, too short for a match
          [0x03, 0x00, 0x00, 0x00, 0x03, 0x41, 0x42, 0x43], // header(3) + literal token(len=3) + data
          "Literals only - no compression",
          "https://github.com/Hawkynt (CompressionWorkbench LzrleBuildingBlock)"
        ),
        new TestCase(
          [], // Empty input
          [0x00, 0x00, 0x00, 0x00], // Just the header (length 0), no payload
          "Empty input",
          "https://github.com/Hawkynt (CompressionWorkbench LzrleBuildingBlock)"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LZRLEInstance(this, isInverse);
    }
  }

  /**
 * LZRLE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LZRLEInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.MIN_MATCH = algorithm.MIN_MATCH;
      this.MIN_RUN = algorithm.MIN_RUN;
      this.TYPE_LITERAL = algorithm.TYPE_LITERAL;
      this.TYPE_MATCH = algorithm.TYPE_MATCH;
      this.TYPE_RUN = algorithm.TYPE_RUN;
      this.LENGTH_FIELD_BITS = algorithm.LENGTH_FIELD_BITS;
      this.LENGTH_FIELD_MAX = algorithm.LENGTH_FIELD_MAX;
      this.HASH_BITS = algorithm.HASH_BITS;
      this.HASH_SIZE = algorithm.HASH_SIZE;
      this.MAX_CHAIN_DEPTH = algorithm.MAX_CHAIN_DEPTH;
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
      const result = this.isInverse ? this._decompress() : this._compress();
      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress() {
      const data = this.inputBuffer;
      const output = OpCodes.Unpack32LE(data.length);

      if (data.length === 0)
        return output;

      const finder = new LZRLEHashChainFinder(Math.max(data.length, 1), this.HASH_BITS, this.MAX_CHAIN_DEPTH);

      let pos = 0;
      let literalStart = 0;

      while (pos < data.length) {
        // 1. Repeated-byte run detection (cheapest to encode when it applies)
        const runValue = data[pos];
        let runLen = 1;
        while (pos + runLen < data.length && data[pos + runLen] === runValue)
          ++runLen;

        if (runLen >= this.MIN_RUN) {
          this._flushLiterals(output, data, literalStart, pos - literalStart);
          this._writeToken(output, this.TYPE_RUN, runLen, this.MIN_RUN);
          output.push(OpCodes.ToByte(runValue));
          for (let i = 1; i < runLen; ++i)
            finder.insertPosition(data, pos + i);
          pos += runLen;
          literalStart = pos;
          continue;
        }

        // 2. Dictionary match search
        if (pos + this.MIN_MATCH <= data.length) {
          const match = finder.findMatch(data, pos, data.length, data.length - pos, this.MIN_MATCH);
          if (match.length >= this.MIN_MATCH) {
            this._flushLiterals(output, data, literalStart, pos - literalStart);
            this._writeToken(output, this.TYPE_MATCH, match.length, this.MIN_MATCH);
            { const _src = OpCodes.Unpack32LE(match.distance); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
            for (let i = 1; i < match.length; ++i)
              finder.insertPosition(data, pos + i);
            pos += match.length;
            literalStart = pos;
            continue;
          }
        }

        // 3. No run or match: accumulate as a literal
        ++pos;
      }

      this._flushLiterals(output, data, literalStart, pos - literalStart);
      return output;
    }

    _flushLiterals(output, data, start, count) {
      if (count === 0)
        return;

      this._writeToken(output, this.TYPE_LITERAL, count, 0);
      for (let i = 0; i < count; ++i)
        output.push(OpCodes.ToByte(data[start + i]));
    }

    _writeToken(output, type, length, baseValue) {
      const field = length - baseValue;
      if (field < this.LENGTH_FIELD_MAX) {
        output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Shl32(type, this.LENGTH_FIELD_BITS), field)));
        return;
      }

      output.push(OpCodes.ToByte(OpCodes.Or32(OpCodes.Shl32(type, this.LENGTH_FIELD_BITS), this.LENGTH_FIELD_MAX)));
      let remainder = field - this.LENGTH_FIELD_MAX;
      while (remainder >= 255) {
        output.push(255);
        remainder -= 255;
      }
      output.push(OpCodes.ToByte(remainder));
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const compressed = this.inputBuffer;
      if (compressed.length < 4)
        return [];

      const originalLength = OpCodes.Pack32LE(
        OpCodes.ToByte(compressed[0]), OpCodes.ToByte(compressed[1]),
        OpCodes.ToByte(compressed[2]), OpCodes.ToByte(compressed[3])
      );
      const output = [];
      if (originalLength === 0)
        return output;

      const data = compressed.slice(4);
      let pos = 0;

      while (output.length < originalLength) {
        const token = OpCodes.ToByte(data[pos++]);
        const type = OpCodes.Shr8(token, this.LENGTH_FIELD_BITS);
        const field = OpCodes.And8(token, this.LENGTH_FIELD_MAX);

        let raw;
        if (field < this.LENGTH_FIELD_MAX)
          raw = field;
        else {
          let sum = 0;
          let b;
          do {
            b = OpCodes.ToByte(data[pos++]);
            sum += b;
          } while (b === 255);
          raw = this.LENGTH_FIELD_MAX + sum;
        }

        if (type === this.TYPE_LITERAL) {
          const count = raw;
          for (let i = 0; i < count; ++i)
            output.push(OpCodes.ToByte(data[pos++]));
        } else if (type === this.TYPE_MATCH) {
          const length = raw + this.MIN_MATCH;
          const distance = OpCodes.Pack32LE(
            OpCodes.ToByte(data[pos]), OpCodes.ToByte(data[pos + 1]),
            OpCodes.ToByte(data[pos + 2]), OpCodes.ToByte(data[pos + 3])
          );
          pos += 4;
          if (distance === 0 || distance > output.length)
            throw new Error(`LZRLE: match references invalid distance ${distance}.`);
          const srcPos = output.length - distance;
          for (let i = 0; i < length; ++i)
            output.push(output[srcPos + i]);
        } else if (type === this.TYPE_RUN) {
          const length = raw + this.MIN_RUN;
          const value = OpCodes.ToByte(data[pos++]);
          for (let i = 0; i < length; ++i)
            output.push(value);
        } else
          throw new Error(`LZRLE: stream contains reserved token type ${type}.`);
      }

      return output;
    }
  }

  // Hash-chain match finder mirroring CompressionWorkbench's HashChainMatchFinder:
  // a 3-byte multiplicative-free XOR hash with a 128-step chain walk, and a
  // deliberately non-power-of-two-safe index mask (candidate & (prev.length-1))
  // that must be reproduced bit-for-bit, not "fixed" to a true modulo.
  class LZRLEHashChainFinder {
    constructor(windowSize, hashBits, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.hashMask = OpCodes.Shl32(1, hashBits) - 1;
      this.head = new Int32Array(OpCodes.Shl32(1, hashBits)).fill(-1);
      this.prev = new Int32Array(windowSize);
    }

    _hash(data, pos) {
      const v = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)), data[pos + 2]);
      return OpCodes.And32(v, this.hashMask);
    }

    _prevIndex(pos) {
      return OpCodes.And32(pos, this.prev.length - 1);
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length)
        return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = this._hash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[this._prevIndex(candidate)];
          ++chainCount;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length])
            ++length;

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;
            if (bestLength >= maxLength)
              break;
          }
        }

        candidate = this.prev[this._prevIndex(candidate)];
        if (candidate <= windowStart)
          break;
        ++chainCount;
      }

      this.prev[this._prevIndex(position)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length)
        return;

      const hash = this._hash(data, position);
      this.prev[this._prevIndex(position)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZRLECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZRLECompression, LZRLEInstance };
}));
