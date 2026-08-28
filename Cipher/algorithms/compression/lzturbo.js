/*
 * LZTURBO Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZTURBO, by powturbo, is closed-source: its command-line tool and the
 * TurboBench harness (https://github.com/powturbo/TurboBench) document that it
 * wraps each compressed buffer in a block carrying a method byte and the
 * original/compressed lengths, and that its speed comes from a hash-based LZ77
 * front end whose output is optionally entropy-coded by a selectable back end
 * (Huffman/rANS/etc., chosen by compression level). No byte-level opcode or
 * entropy-table format has ever been published, and the reference binaries are
 * not consulted here, so only that documented outer shape - block magic,
 * method byte, original length, compressed length - is reproduced. The inner
 * token stream implemented below is a clean-room fast-LZ design (literal/match
 * token with extended-length continuation and a 3-byte window offset)
 * representing the front-end architecture; the proprietary entropy back end
 * is not reproduced, so the payload is left entropy-uncoded. This models
 * LZTURBO's documented block scheme, not a byte-compatible LZTURBO stream.
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

  // ===== FORMAT CONSTANTS =====

  const MAGIC = [0x4C, 0x5A, 0x54, 0x31]; // "LZT1"
  const METHOD = 0;
  const HEADER_SIZE = 13;
  const MIN_MATCH = 4;
  const LITERAL_EXTENDED = 15;
  const MAX_DIRECT_LITERAL = 14;
  const MATCH_EXTENDED = 14;
  const MATCH_NONE = 15;
  const MAX_DIRECT_MATCH = 13;
  const DISTANCE_BYTES = 3;
  const MAX_DISTANCE = OpCodes.Shl32(1, DISTANCE_BYTES * 8) - 1;

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

  // ===== LZTURBO CODEC =====

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
      if (posRef.pos >= data.length) throw new Error('LZTURBO extended length truncated');
      b = data[posRef.pos++];
      sum += b;
    } while (b === 255);
    return sum;
  }

  function emitToken(output, data, literalStart, literalCount, matchLength, distance) {
    const literalField = literalCount < MAX_DIRECT_LITERAL + 1 ? literalCount : LITERAL_EXTENDED;
    const matchField = matchLength - MIN_MATCH;
    const matchNibble = matchField <= MAX_DIRECT_MATCH ? matchField : MATCH_EXTENDED;

    output.push(OpCodes.Or32(OpCodes.Shl32(literalField, 4), matchNibble));

    if (literalField === LITERAL_EXTENDED) writeExtended(output, literalCount - (MAX_DIRECT_LITERAL + 1));

    for (let i = 0; i < literalCount; ++i) output.push(data[literalStart + i]);

    if (matchNibble === MATCH_EXTENDED) writeExtended(output, matchField - MATCH_EXTENDED);

    for (let i = 0; i < DISTANCE_BYTES; ++i) output.push(OpCodes.ToByte(OpCodes.Shr32(distance, 8 * i)));
  }

  function emitFinalLiteralToken(output, data, literalStart, literalCount) {
    const literalField = literalCount < MAX_DIRECT_LITERAL + 1 ? literalCount : LITERAL_EXTENDED;

    output.push(OpCodes.Or32(OpCodes.Shl32(literalField, 4), MATCH_NONE));

    if (literalField === LITERAL_EXTENDED) writeExtended(output, literalCount - (MAX_DIRECT_LITERAL + 1));

    for (let i = 0; i < literalCount; ++i) output.push(data[literalStart + i]);
  }

  function lzturboCompress(data) {
    const body = [];

    if (data.length > 0) {
      const maxDistance = Math.min(MAX_DISTANCE, data.length);
      const finder = new HashChainMatchFinder(Math.max(data.length, 1));

      let pos = 0;
      let literalStart = 0;

      while (pos < data.length) {
        if (pos + MIN_MATCH <= data.length) {
          const match = finder.findMatch(data, pos, maxDistance, data.length - pos, MIN_MATCH);
          if (match.length >= MIN_MATCH) {
            emitToken(body, data, literalStart, pos - literalStart, match.length, match.distance);
            for (let i = 1; i < match.length; ++i) finder.insertPosition(data, pos + i);
            pos += match.length;
            literalStart = pos;
            continue;
          }
        }

        ++pos;
      }

      const trailingLiteralCount = pos - literalStart;
      if (trailingLiteralCount > 0) emitFinalLiteralToken(body, data, literalStart, trailingLiteralCount);
    }

    const output = [];
    for (let _i = 0; _i < MAGIC.length; _i++) output.push(MAGIC[_i]);
    output.push(METHOD);
    { const _src = OpCodes.Unpack32LE(data.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
    { const _src = OpCodes.Unpack32LE(body.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
    for (let _i = 0; _i < body.length; _i++) output.push(body[_i]);

    return output;
  }

  function lzturboDecompress(data) {
    if (data.length < HEADER_SIZE) throw new Error('LZTURBO block too short for header');

    for (let i = 0; i < 4; ++i)
      if (data[i] !== MAGIC[i]) throw new Error('LZTURBO block has an invalid magic');

    const method = data[4];
    if (method !== METHOD) throw new Error('LZTURBO block uses an unsupported method');

    const originalLength = OpCodes.Pack32LE(data[5], data[6], data[7], data[8]);
    const bodyLength = OpCodes.Pack32LE(data[9], data[10], data[11], data[12]);

    const body = data.slice(HEADER_SIZE);
    if (bodyLength !== body.length) throw new Error('LZTURBO block body length does not match header');

    const output = new Array(originalLength);
    if (originalLength === 0) return [];

    const posRef = { pos: 0 };
    let outPos = 0;

    while (outPos < originalLength) {
      if (posRef.pos >= body.length) throw new Error('LZTURBO block truncated at token');

      const token = body[posRef.pos++];
      const literalField = OpCodes.Shr32(token, 4);
      const matchNibble = OpCodes.And32(token, 0x0F);

      const literalCount = literalField < LITERAL_EXTENDED ? literalField : MAX_DIRECT_LITERAL + 1 + readExtended(body, posRef);

      if (posRef.pos + literalCount > body.length || outPos + literalCount > originalLength)
        throw new Error('LZTURBO literal run overruns buffer');
      for (let i = 0; i < literalCount; ++i) output[outPos + i] = body[posRef.pos + i];
      posRef.pos += literalCount;
      outPos += literalCount;

      if (matchNibble === MATCH_NONE) continue;

      const matchField = matchNibble <= MAX_DIRECT_MATCH ? matchNibble : MATCH_EXTENDED + readExtended(body, posRef);
      const matchLength = matchField + MIN_MATCH;

      if (posRef.pos + DISTANCE_BYTES > body.length) throw new Error('LZTURBO match token truncated');
      let distance = 0;
      for (let i = 0; i < DISTANCE_BYTES; ++i) distance = OpCodes.Or32(distance, OpCodes.Shl32(body[posRef.pos + i], 8 * i));
      posRef.pos += DISTANCE_BYTES;

      if (distance <= 0 || distance > outPos || outPos + matchLength > originalLength)
        throw new Error('LZTURBO match references invalid distance');

      const srcPos = outPos - distance;
      for (let i = 0; i < matchLength; ++i) output[outPos + i] = output[srcPos + i];
      outPos += matchLength;
    }

    return output;
  }

  // ===== LZTURBO IMPLEMENTATION =====

  class LZTurboCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZTURBO";
      this.description = "Fast hash-matched LZ77 front end wrapped in a magic/method/length block, modelling LZTURBO's documented outer shape. LZTURBO's real bitstream is closed-source and undocumented, so only the documented block layout is reproduced; the proprietary entropy back end is not (payload is left entropy-uncoded).";
      this.inventor = "powturbo";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PT; // Portugal (powturbo)

      // Documentation and references
      this.documentation = [
        new LinkItem("powturbo Website", "https://sites.google.com/site/powturbo/"),
        new LinkItem("TurboBench Repository", "https://github.com/powturbo/TurboBench"),
        new LinkItem("Fast Compression Overview", "https://en.wikipedia.org/wiki/LZ4_(compression_algorithm)")
      ];

      this.references = [
        new LinkItem("LZ77 Foundation", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Fast Compression Techniques", "https://fastcompression.blogspot.com/"),
        new LinkItem("Compression Benchmarks", "https://github.com/inikep/lzbench")
      ];

      // Test vectors - cross-checked byte-for-byte against the CompressionWorkbench
      // (C#) BB_Lzturbo reference implementation, which this format follows.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("4c5a5431000000000000000000"),
          "Empty input",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          OpCodes.Hex8ToBytes("4c5a54310001000000020000001f41"),
          "Single byte literal",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AB"),
          OpCodes.Hex8ToBytes("4c5a54310002000000030000002f4142"),
          "Two character literals",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABC"),
          OpCodes.Hex8ToBytes("4c5a54310006000000070000006f414243414243"),
          "Repeating pattern shorter than the minimum match length",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abcdefabcdef"),
          OpCodes.Hex8ToBytes("4c5a5431000c0000000a00000062616263646566060000"),
          "Structured pattern with clear repetition",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Hello World"),
          OpCodes.Hex8ToBytes("4c5a543100" + "0b000000" + "0c000000" + "bf48656c6c6f20576f726c64"),
          "Text with no repetition - all literals",
          "https://github.com/powturbo/TurboBench"
        )
      ];

      this.tests.push(
        new TestCase(
          OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("4c5a543100b400000036000000f01074686520717569636b2062726f776e20666f78206a756d7073206f766572201f0000916c617a7920646f672e0e00000e712d0000"),
          "Repeated text sample (4x)",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(0x61); return a; })(),
          OpCodes.Hex8ToBytes("4c5a54310000010000060000001e61ed010000"),
          "256 repeated bytes",
          "https://github.com/powturbo/TurboBench"
        ),
        new TestCase(
          (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
          OpCodes.Hex8ToBytes("4c5a5431000001000002010000fff1000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          "All 256 byte values",
          "https://github.com/powturbo/TurboBench"
        )
      );

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    CreateInstance(isInverse = false) {
      return new LZTurboInstance(this, isInverse);
    }
  }

  class LZTurboInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ? lzturboDecompress(this.inputBuffer) : lzturboCompress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZTurboCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  // ===== EXPORTS =====

  return { LZTurboCompression, LZTurboInstance };
}));
