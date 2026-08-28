/*
 * LZG (Lempel-Ziv-Geelnard) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZG is a minimal LZ77-class codec designed by Marcus Geelnard for embedded
 * systems: the decoder is deliberately tiny and needs no tables.
 *
 * Wire format implemented here (the LZG1 escape-token method):
 *   - 4-byte little-endian uncompressed length header
 *   - payload of bytes, each of which is either a literal or the escape byte
 *     0xFF introducing a token:
 *       0xFF 0x00                -> an escaped literal 0xFF
 *       0xFF len offHi offLo     -> back-reference; len is (length - 2) so
 *                                   lengths 3..257 are expressible (len is
 *                                   never 0, which would collide with the
 *                                   escaped-literal form), and offHi:offLo is
 *                                   a big-endian 16-bit distance
 *
 * Matches come from a hash-chain over 3-byte hashes inside a 2 KiB window,
 * minimum match length 3, maximum 257 (what one len byte can express).
 *
 * The liblzg container (16-byte magic header with an Adler-32 checksum and a
 * raw-copy fallback method) is a separate layer and is not produced here; the
 * uncompressed length travels in the 4-byte little-endian header instead.
 *
 * Reference documentation:
 * - https://github.com/mbitsnbites/liblzg
 * - https://liblzg.bitsnbites.eu/
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const ESCAPE = 0xFF;
  const WINDOW_SIZE = 2048;
  const MIN_MATCH = 3;
  const MAX_MATCH = 257;
  const HASH_BITS = 12;
  const HASH_SIZE = 4096;   // 2^HASH_BITS
  const HASH_MASK = 4095;   // HASH_SIZE - 1
  const MAX_CHAIN_STEPS = 32;
  const MAX_DISTANCE = 65535;

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZGCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZG";
      this.description = "Minimal LZ77-based compression with a deliberately tiny decoder. Literals pass through untouched; the escape byte 0xFF introduces either an escaped literal or a back-reference over a 2 KiB window. Designed for embedded systems that need fast decompression with minimal memory.";
      this.inventor = "Marcus Geelnard";
      this.year = 2004;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SE;

      // Documentation and references
      this.documentation = [
        new LinkItem("liblzg GitHub Repository", "https://github.com/mbitsnbites/liblzg"),
        new LinkItem("liblzg Project Site", "https://liblzg.bitsnbites.eu/")
      ];

      this.references = [
        new LinkItem("GitLab Mirror", "https://gitlab.com/mbitsnbites/liblzg"),
        new LinkItem("LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      // Test vectors cross-checked byte-for-byte against CompressionWorkbench's
      // BB_Lzg building block (Compression.Core.Dictionary.Lzg), which is the
      // authoritative wire format.
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "https://liblzg.bitsnbites.eu/",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal",
          uri: "https://liblzg.bitsnbites.eu/",
          input: [0x41],
          expected: [0x01, 0x00, 0x00, 0x00, 0x41]
        },
        {
          text: "All literals - no match of length 3 exists (ABCD)",
          uri: "https://liblzg.bitsnbites.eu/",
          input: OpCodes.AnsiToBytes("ABCD"),
          expected: [0x04, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0x44]
        },
        {
          text: "Simple repetition - AAAA (literal plus 3-byte back-reference at distance 1)",
          uri: "https://liblzg.bitsnbites.eu/",
          input: OpCodes.AnsiToBytes("AAAA"),
          expected: [0x04, 0x00, 0x00, 0x00, 0x41, 0xFF, 0x01, 0x00, 0x01]
        },
        {
          text: "Pattern ABCABC - 3 literals plus a back-reference at distance 3",
          uri: "https://liblzg.bitsnbites.eu/",
          input: OpCodes.AnsiToBytes("ABCABC"),
          expected: [0x06, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43, 0xFF, 0x01, 0x00, 0x03]
        },
        {
          text: "Escaped literal - the escape byte 0xFF appearing in the data",
          uri: "https://liblzg.bitsnbites.eu/",
          input: [0xFF, 0x41, 0xFF],
          expected: [0x03, 0x00, 0x00, 0x00, 0xFF, 0x00, 0x41, 0xFF, 0x00]
        },
        {
          text: "Long run - 256 bytes of 'a' (match length capped at 257, then 255)",
          uri: "https://liblzg.bitsnbites.eu/",
          input: new Array(256).fill(0x61),
          expected: [0x00, 0x01, 0x00, 0x00, 0x61, 0xFF, 0xFD, 0x00, 0x01]
        },
        {
          text: "Alternating pattern - 200x 'ab'",
          uri: "https://liblzg.bitsnbites.eu/",
          input: (() => { const a = []; for (let i = 0; i < 400; ++i) a.push(i % 2 ? 0x62 : 0x61); return a; })(),
          expected: [
            0x90, 0x01, 0x00, 0x00, 0x61, 0x62, 0xFF, 0xFF, 0x00, 0x02, 0xFF, 0x8B,
            0x00, 0x02
          ]
        },
        {
          text: "Binary sample - all 256 byte values in order (no repeats)",
          uri: "https://liblzg.bitsnbites.eu/",
          input: (() => { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
          expected: [
            0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13,
            0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
            0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B,
            0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
            0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F, 0x40, 0x41, 0x42, 0x43,
            0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,
            0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B,
            0x5C, 0x5D, 0x5E, 0x5F, 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,
            0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x71, 0x72, 0x73,
            0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F,
            0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B,
            0x8C, 0x8D, 0x8E, 0x8F, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
            0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F, 0xA0, 0xA1, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
            0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB,
            0xBC, 0xBD, 0xBE, 0xBF, 0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7,
            0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF, 0xD0, 0xD1, 0xD2, 0xD3,
            0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xDB, 0xDC, 0xDD, 0xDE, 0xDF,
            0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB,
            0xEC, 0xED, 0xEE, 0xEF, 0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7,
            0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF, 0x00
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
      return new LZGInstance(this, isInverse);
    }
  }

  /**
 * LZG instance implementing the Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class LZGInstance extends IAlgorithmInstance {
    /**
   * Initialize LZG instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decompression mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    /**
   * Get the processed result
   * @returns {uint8[]} Processed output bytes
   */

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0)
          return [];
        const decoded = this._decompress();
        this.inputBuffer = [];
        return decoded;
      }

      // Compression always emits the 4-byte length header, even for empty
      // input (matching the reference building block).
      const encoded = this._compress();
      this.inputBuffer = [];
      return encoded;
    }

    _compress() {
      const src = this.inputBuffer;
      const length = src.length;
      const out = OpCodes.Unpack32LE(length);

      if (length === 0)
        return out;

      const hashHead = new Int32Array(HASH_SIZE).fill(-1);
      const chain = new Int32Array(length);

      let pos = 0;
      while (pos < length) {
        let bestLen = 0;
        let bestOff = 0;
        if (pos + MIN_MATCH <= length) {
          const found = this._findMatch(src, pos, hashHead, chain);
          bestLen = found.length;
          bestOff = found.offset;
        }

        if (pos + 2 < length)
          this._insertHash(src, pos, hashHead, chain);

        if (bestLen >= MIN_MATCH) {
          out.push(ESCAPE);
          out.push(bestLen - 2);
          out.push(OpCodes.And32(OpCodes.Shr32(bestOff, 8), 0xFF));
          out.push(OpCodes.And32(bestOff, 0xFF));

          for (let i = 1; i < bestLen && pos + i + 2 < length; ++i)
            this._insertHash(src, pos + i, hashHead, chain);

          pos += bestLen;
        } else {
          if (src[pos] === ESCAPE) {
            out.push(ESCAPE);
            out.push(0x00);
          } else {
            out.push(src[pos]);
          }
          ++pos;
        }
      }

      return out;
    }

    _decompress() {
      const data = this.inputBuffer;
      if (data.length < 4)
        throw new Error('LZG: input too small for header');

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0)
        return [];

      const dst = new Array(originalSize);
      let pos = 0;
      let i = 4;

      while (pos < originalSize) {
        if (i >= data.length)
          throw new Error('LZG: unexpected end of stream');

        if (data[i] === ESCAPE) {
          ++i;
          if (i >= data.length)
            throw new Error('LZG: truncated escape sequence');

          if (data[i] === 0x00) {
            dst[pos++] = ESCAPE;
            ++i;
          } else {
            if (i + 2 >= data.length)
              throw new Error('LZG: truncated match token');

            const matchLength = data[i] + 2;
            const offset = OpCodes.Or32(OpCodes.Shl32(data[i + 1], 8), data[i + 2]);
            i += 3;

            if (offset <= 0 || offset > pos)
              throw new Error('LZG: invalid offset ' + offset + ' at position ' + pos);

            for (let k = 0; k < matchLength && pos < originalSize; ++k, ++pos)
              dst[pos] = dst[pos - offset];
          }
        } else {
          dst[pos++] = data[i++];
        }
      }

      return dst;
    }

    _hash3(data, pos) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)),
          data[pos + 2]
        ),
        HASH_MASK
      );
    }

    _insertHash(data, pos, hashHead, chain) {
      const h = this._hash3(data, pos);
      chain[pos] = hashHead[h];
      hashHead[h] = pos;
    }

    _findMatch(data, pos, hashHead, chain) {
      const h = this._hash3(data, pos);
      let candidate = hashHead[h];
      const minPos = Math.max(0, pos - WINDOW_SIZE);
      const maxLen = Math.min(MAX_MATCH, data.length - pos);
      let bestLen = 0;
      let bestOff = 0;
      let steps = MAX_CHAIN_STEPS;

      while (candidate >= minPos && steps-- > 0) {
        if (candidate < pos) {
          let len = 0;
          while (len < maxLen && data[candidate + len] === data[pos + len])
            ++len;

          if (len >= MIN_MATCH && len > bestLen) {
            const dist = pos - candidate;
            if (dist <= MAX_DISTANCE) {
              bestLen = len;
              bestOff = dist;
              if (bestLen === maxLen)
                break;
            }
          }
        }

        const prev = chain[candidate];
        if (prev >= candidate)
          break;
        candidate = prev;
      }

      return { length: bestLen, offset: bestOff };
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZGCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZGCompression, LZGInstance };
}));
