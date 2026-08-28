/*
 * LZVN (Lempel-Ziv Variable-length iNteger) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZVN is Apple's fast, low-ratio compression codec shipped alongside LZFSE for
 * small buffers and Mach-O pages. Apple never published a format specification
 * for LZVN; the only authoritative description of its opcode table lives in the
 * closed-source encoder/decoder shipped inside the (also Apple-published) lzfse
 * repository (https://github.com/lzfse/lzfse), and reverse-engineering write-ups
 * describe its general shape: single-byte opcodes that combine a literal run
 * with a following match, and a match distance encoded in 1, 2 or 5 bytes
 * depending on magnitude so nearby matches cost less than far ones.
 * Reproducing Apple's exact opcode table byte-for-byte would require
 * transcribing their source, which a clean-room policy forbids. This
 * implementation instead follows the same documented shape - a single-byte
 * token combining literal-run and match-length nibbles, tiered 1/2/5-byte
 * distance encoding - so it demonstrates the same class of format without
 * claiming bit-for-bit compatibility with Apple's real LZVN bitstream.
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

  // ===== FORMAT CONSTANTS =====

  const MIN_MATCH = 3;
  const LITERAL_EXTENDED = 15;
  const MATCH_EXTENDED = 14;
  const MATCH_NONE = 15;
  const MAX_DIRECT_LITERAL = 14;
  const MAX_DIRECT_MATCH = 13;
  const DISTANCE_TIER1_MAX = 128;
  const DISTANCE_TIER2_MAX = 32640;
  const DISTANCE_TIER3_MARKER = 0xFF;

  // ===== HASH CHAIN MATCH FINDER =====
  // Ported from Compression.Core.Dictionary.MatchFinders.HashChainMatchFinder
  // to guarantee byte-identical parses. Note: the modulus used to index the
  // "prev" chain array is the window size itself (not rounded to a power of
  // two), so the bitwise AND used for indexing can alias distinct positions
  // onto the same slot when the window size is not a power of two. That
  // aliasing is part of the reference behavior and is reproduced faithfully.

  const HASH_BITS = 15;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const HASH_MASK = HASH_SIZE - 1;

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth || 128;
      this.head = new Array(HASH_SIZE).fill(-1);
      this.prevMask = (windowSize > 0 ? windowSize : 1) - 1;
      this.prev = new Array(windowSize > 0 ? windowSize : 1).fill(0);
    }

    _computeHash(data, position) {
      const h = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
        data[position + 2]
      );
      return OpCodes.And32(h, HASH_MASK);
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = this._computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          chainCount++;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) length++;

        if (length >= minLength && length > bestLength) {
          bestLength = length;
          bestDistance = distance;
          if (bestLength >= maxLength) break;
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart) break;
        chainCount++;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const hash = this._computeHash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== LZVN CODEC =====

  function writeExtended(output, remainder) {
    while (remainder >= 255) {
      output.push(255);
      remainder -= 255;
    }
    output.push(remainder);
  }

  function readExtended(data, posRef) {
    let sum = 0;
    let b;
    do {
      if (posRef.pos >= data.length) throw new Error('LZVN extended length truncated');
      b = data[posRef.pos++];
      sum += b;
    } while (b === 255);
    return sum;
  }

  function writeDistance(output, distance) {
    if (distance <= DISTANCE_TIER1_MAX) {
      output.push(distance - 1);
      return;
    }

    if (distance <= DISTANCE_TIER2_MAX) {
      const rem = distance - (DISTANCE_TIER1_MAX + 1);
      const hi = OpCodes.Shr32(rem, 8);
      const lo = OpCodes.And32(rem, 0xFF);
      output.push(0x80 + hi);
      output.push(lo);
      return;
    }

    output.push(DISTANCE_TIER3_MARKER);
    output.push(OpCodes.ToByte(distance));
    output.push(OpCodes.ToByte(OpCodes.Shr32(distance, 8)));
    output.push(OpCodes.ToByte(OpCodes.Shr32(distance, 16)));
    output.push(OpCodes.ToByte(OpCodes.Shr32(distance, 24)));
  }

  function readDistance(data, posRef) {
    if (posRef.pos >= data.length) throw new Error('LZVN distance truncated');
    const b0 = data[posRef.pos++];
    if (b0 < 0x80) return b0 + 1;

    if (b0 !== DISTANCE_TIER3_MARKER) {
      if (posRef.pos >= data.length) throw new Error('LZVN distance truncated');
      const b1 = data[posRef.pos++];
      const hi = b0 - 0x80;
      return DISTANCE_TIER1_MAX + 1 + OpCodes.Or32(OpCodes.Shl32(hi, 8), b1);
    }

    if (posRef.pos + 4 > data.length) throw new Error('LZVN distance truncated');
    const distance = OpCodes.Pack32LE(data[posRef.pos], data[posRef.pos + 1], data[posRef.pos + 2], data[posRef.pos + 3]);
    posRef.pos += 4;
    return distance;
  }

  function emitToken(output, data, literalStart, literalCount, matchLength, distance) {
    const literalField = literalCount < MAX_DIRECT_LITERAL + 1 ? literalCount : LITERAL_EXTENDED;
    const matchField = matchLength - MIN_MATCH;
    const matchNibble = matchField <= MAX_DIRECT_MATCH ? matchField : MATCH_EXTENDED;

    output.push(OpCodes.Or32(OpCodes.Shl32(literalField, 4), matchNibble));

    if (literalField === LITERAL_EXTENDED) writeExtended(output, literalCount - (MAX_DIRECT_LITERAL + 1));

    for (let i = 0; i < literalCount; ++i) output.push(data[literalStart + i]);

    if (matchNibble === MATCH_EXTENDED) writeExtended(output, matchField - MATCH_EXTENDED);

    writeDistance(output, distance);
  }

  function emitFinalLiteralToken(output, data, literalStart, literalCount) {
    const literalField = literalCount < MAX_DIRECT_LITERAL + 1 ? literalCount : LITERAL_EXTENDED;

    output.push(OpCodes.Or32(OpCodes.Shl32(literalField, 4), MATCH_NONE));

    if (literalField === LITERAL_EXTENDED) writeExtended(output, literalCount - (MAX_DIRECT_LITERAL + 1));

    for (let i = 0; i < literalCount; ++i) output.push(data[literalStart + i]);
  }

  function lzvnCompress(data) {
    const output = [];
    { const _src = OpCodes.Unpack32LE(data.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }

    if (data.length === 0) return output;

    const finder = new HashChainMatchFinder(Math.max(data.length, 1));

    let pos = 0;
    let literalStart = 0;

    while (pos < data.length) {
      if (pos + MIN_MATCH <= data.length) {
        const match = finder.findMatch(data, pos, data.length, data.length - pos, MIN_MATCH);
        if (match.length >= MIN_MATCH) {
          emitToken(output, data, literalStart, pos - literalStart, match.length, match.distance);
          for (let i = 1; i < match.length; ++i) finder.insertPosition(data, pos + i);
          pos += match.length;
          literalStart = pos;
          continue;
        }
      }

      ++pos;
    }

    const trailingLiteralCount = pos - literalStart;
    if (trailingLiteralCount > 0) emitFinalLiteralToken(output, data, literalStart, trailingLiteralCount);

    return output;
  }

  function lzvnDecompress(data) {
    if (data.length < 4) throw new Error('LZVN stream too short for header');

    const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
    const output = new Array(originalLength);
    if (originalLength === 0) return [];

    const posRef = { pos: 4 };
    let outPos = 0;

    while (outPos < originalLength) {
      if (posRef.pos >= data.length) throw new Error('LZVN stream truncated at token');

      const token = data[posRef.pos++];
      const literalField = OpCodes.Shr32(token, 4);
      const matchNibble = OpCodes.And32(token, 0x0F);

      const literalCount = literalField < LITERAL_EXTENDED ? literalField : MAX_DIRECT_LITERAL + 1 + readExtended(data, posRef);

      if (posRef.pos + literalCount > data.length || outPos + literalCount > originalLength)
        throw new Error('LZVN literal run overruns buffer');
      for (let i = 0; i < literalCount; ++i) output[outPos + i] = data[posRef.pos + i];
      posRef.pos += literalCount;
      outPos += literalCount;

      if (matchNibble === MATCH_NONE) continue;

      const matchField = matchNibble <= MAX_DIRECT_MATCH ? matchNibble : MATCH_EXTENDED + readExtended(data, posRef);
      const matchLength = matchField + MIN_MATCH;

      const distance = readDistance(data, posRef);
      if (distance <= 0 || distance > outPos || outPos + matchLength > originalLength)
        throw new Error('LZVN match references invalid distance');

      const srcPos = outPos - distance;
      for (let i = 0; i < matchLength; ++i) output[outPos + i] = output[srcPos + i];
      outPos += matchLength;
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * LZVNAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZVNAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZVN";
        this.description = "Byte-oriented opcode LZ77 in the spirit of Apple's fast LZVN codec, with tiered distance encoding. Follows LZVN's documented single-byte-opcode shape but is not a byte-exact reproduction of Apple's undocumented real bitstream.";
        this.inventor = "Apple Inc.";
        this.year = 2015;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("Apple Compression Documentation", "https://developer.apple.com/documentation/compression/algorithm"),
          new LinkItem("LZVN Technical Analysis", "https://blog.yossarian.net/2021/06/01/Playing-with-Apples-weird-compression-formats")
        ];

        this.references = [
          new LinkItem("LZFSE Repository (includes LZVN)", "https://github.com/lzfse/lzfse"),
          new LinkItem("Apple StackExchange Discussion", "https://apple.stackexchange.com/questions/378319/what-is-the-full-name-for-lzvn-the-compression-algorithm"),
          new LinkItem("Reverse Engineering Analysis", "https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression")
        ];

        // Test vectors - cross-checked byte-for-byte against the CompressionWorkbench
        // (C#) BB_Lzvn reference implementation, which this format follows.
        this.tests = [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("00000000"),
            "Empty input",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("A"),
            OpCodes.Hex8ToBytes("010000001f41"),
            "Single byte literal",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AB"),
            OpCodes.Hex8ToBytes("020000002f4142"),
            "Two character literals",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABC"),
            OpCodes.Hex8ToBytes("060000003041424302"),
            "Repeating pattern - dictionary reference",
            "https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello World"),
            OpCodes.Hex8ToBytes("0b000000bf48656c6c6f20576f726c64"),
            "Text with no repetition - all literals",
            "https://github.com/lzfse/lzfse/blob/master/README.md"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abcdefabcdef"),
            OpCodes.Hex8ToBytes("0c0000006361626364656605"),
            "Structured pattern with clear repetition",
            "https://blog.yossarian.net/2021/06/01/Playing-with-Apples-weird-compression-formats"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
            OpCodes.Hex8ToBytes("b4000000f11074686520717569636b2062726f776e20666f78206a756d7073206f766572201e926c617a7920646f672e0d0e722c"),
            "Repeated text sample (4x)",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(0x61); return a; })(),
            OpCodes.Hex8ToBytes("000100001e61ee00"),
            "256 repeated bytes",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
            OpCodes.Hex8ToBytes("00010000fff1000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
            "All 256 byte values",
            "https://github.com/lzfse/lzfse"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new LZVNInstance(this, isInverse);
      }
    }

    class LZVNInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }


      Result() {
        const result = this.isInverse ?
          lzvnDecompress(this.inputBuffer) :
          lzvnCompress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZVNAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZVNAlgorithm, LZVNInstance };
}));
