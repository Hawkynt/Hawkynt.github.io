/*
 * LZ77 Sliding Window Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZ77 dictionary-based compression using sliding window technique.
 * Encodes data as a flat stream of literal/match tokens by finding matches
 * in a history buffer via a hash-chain match finder.
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
 * LZ77Compression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZ77Compression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZ77";
        this.description = "Dictionary-based compression using sliding window technique. Encodes data as a flat, self-describing stream of literal/match tokens (1 flag byte, then either a raw byte or a little-endian distance+length pair) found via a hash-chain match finder over a sliding history buffer. Foundation for many modern compression formats like DEFLATE.";
        this.inventor = "Abraham Lempel, Jacob Ziv";
        this.year = 1977;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.IL;

        // Configuration parameters
        this.WINDOW_SIZE = 32768;     // Size of sliding window (search buffer / max match distance)
        this.MIN_MATCH_LENGTH = 3;    // Minimum match length to encode
        this.MAX_MATCH_LENGTH = 258;  // Maximum match length
        this.MAX_CHAIN_DEPTH = 64;    // Maximum hash-chain nodes visited per match search

        // Documentation and references
        this.documentation = [
          new LinkItem("Original LZ77 Paper", "https://ieeexplore.ieee.org/document/1055714"),
          new LinkItem("RFC 1951 - DEFLATE Specification", "https://tools.ietf.org/html/rfc1951"),
          new LinkItem("LZ77 and LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
        ];

        this.references = [
          new LinkItem("GZIP/zlib Implementation", "https://github.com/madler/zlib"),
          new LinkItem("Educational Implementation", "https://www.cs.duke.edu/csed/curious/compression/lz77.html"),
          new LinkItem("LZSS Variant Analysis", "https://web.archive.org/web/20070823091851/http://www.cs.bell-labs.com/who/sjk/data/lzss.ps")
        ];

        // Test vectors: flat token stream, [0,literal] or [1,distLo,distHi,lenLo,lenHi]
        // (byte-identical to CompressionWorkbench's BB_Lz77 reference implementation)
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input - zero-byte output, no header/container",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            [0x41],
            [0, 0x41],
            "Single byte - encoded as one literal token",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCD"), // "ABCD" - no repetition, all literals
            [0, 65, 0, 66, 0, 67, 0, 68], // [0,A][0,B][0,C][0,D] - all literals
            "No repeated patterns - worst case",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("AAAA"), // "AAAA" - length 4, compresses well
            [0, 65, 1, 1, 0, 3, 0], // [0,A][1,dist=1(LE),len=3(LE)] - A + match of 3 A's
            "Repetition compression - AAAA",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCABC"), // "ABCABC" - length 6, ABC repeats (len=3)
            [0, 65, 0, 66, 0, 67, 1, 3, 0, 3, 0], // [0,A][0,B][0,C][1,dist=3(LE),len=3(LE)] - ABC + match ABC
            "Pattern repetition - ABCABC",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          )
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZ77Instance(this, isInverse);
      }
    }

    // 15-bit hash table used by the match finder, independent of the sliding
    // window size (matches the reference HashChainMatchFinder's fixed HashBits).
    const HASH_TABLE_SIZE = 32768; // 2^15
    const HASH_TABLE_MASK = 32767; // HASH_TABLE_SIZE - 1

    /**
     * Hash-chain match finder: a 3-byte rolling hash indexes into a table of
     * chain heads; each position also links back to the previous position that
     * hashed to the same bucket, so a bucket can be walked newest-first.
     */
    class LZ77HashChainMatchFinder {
      constructor(windowSize, maxChainDepth) {
        this.maxChainDepth = maxChainDepth;
        this.prevSize = windowSize;
        this.head = new Int32Array(HASH_TABLE_SIZE).fill(-1);
        this.prev = new Int32Array(windowSize);
      }

      _hash(data, position) {
        const mixed = OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        );
        return OpCodes.And32(mixed, HASH_TABLE_MASK);
      }

      findMatch(data, position, maxDistance, maxLength, minLength) {
        if (position + 2 >= data.length) {
          return { distance: 0, length: 0 };
        }

        let bestDistance = 0;
        let bestLength = 0;

        const hash = this._hash(data, position);
        let candidate = this.head[hash];
        let chainCount = 0;
        const windowStart = Math.max(0, position - maxDistance);

        while (candidate >= windowStart && chainCount < this.maxChainDepth) {
          if (candidate === position) {
            candidate = this.prev[candidate % this.prevSize];
            ++chainCount;
            continue;
          }

          const distance = position - candidate;
          const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

          // Quick check against the current best before paying for a full compare
          if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
            let length = 0;
            while (length < limit && data[candidate + length] === data[position + length]) ++length;

            if (length >= minLength && length > bestLength) {
              bestLength = length;
              bestDistance = distance;
              if (bestLength >= maxLength) break;
            }
          }

          candidate = this.prev[candidate % this.prevSize];
          if (candidate <= windowStart) break;
          ++chainCount;
        }

        // Insert the current position into its hash bucket
        this.prev[position % this.prevSize] = this.head[hash];
        this.head[hash] = position;

        return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
      }

      insertPosition(data, position) {
        if (position + 2 >= data.length) return;
        const hash = this._hash(data, position);
        this.prev[position % this.prevSize] = this.head[hash];
        this.head[hash] = position;
      }
    }

    class LZ77Instance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
        this.windowSize = algorithm.WINDOW_SIZE;
        this.minMatchLength = algorithm.MIN_MATCH_LENGTH;
        this.maxMatchLength = algorithm.MAX_MATCH_LENGTH;
        this.maxChainDepth = algorithm.MAX_CHAIN_DEPTH;
      }


      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      // Flat, self-describing token stream (no length header/container):
      //   literal: [0][value]
      //   match:   [1][distanceLE16][lengthLE16]
      _compress() {
        const data = this.inputBuffer;
        const matchFinder = new LZ77HashChainMatchFinder(this.windowSize, this.maxChainDepth);
        const result = [];
        let position = 0;

        while (position < data.length) {
          const match = matchFinder.findMatch(data, position, this.windowSize, this.maxMatchLength, this.minMatchLength);

          if (match.length >= this.minMatchLength) {
            result.push(1); // Match flag
            const distanceBytes = OpCodes.Unpack16LE(match.distance);
            const lengthBytes = OpCodes.Unpack16LE(match.length);
            result.push(distanceBytes[0], distanceBytes[1], lengthBytes[0], lengthBytes[1]);

            // The match finder only inserted the match's start position into the
            // hash chain; every position it skipped over must be inserted too.
            for (let i = 1; i < match.length; ++i) matchFinder.insertPosition(data, position + i);

            position += match.length;
          } else {
            result.push(0); // Literal flag
            result.push(data[position]);
            ++position;
          }
        }

        this.inputBuffer = [];
        return result;
      }

      _decompress() {
        const data = this.inputBuffer;
        const output = [];
        let pos = 0;

        while (pos < data.length) {
          const flag = data[pos++];

          if (flag === 0) {
            output.push(data[pos++]);
          } else {
            const distance = OpCodes.Pack16LE(data[pos], data[pos + 1]);
            const length = OpCodes.Pack16LE(data[pos + 2], data[pos + 3]);
            pos += 4;

            const start = output.length - distance;
            if (start < 0) {
              throw new Error('Invalid LZ77 back-reference: distance ' + distance + ' exceeds output size ' + output.length + '.');
            }

            // Byte-at-a-time copy so overlapping (distance < length) matches work
            for (let i = 0; i < length; ++i) output.push(output[start + i]);
          }
        }

        this.inputBuffer = [];
        return output;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZ77Compression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZ77Compression, LZ77Instance };
}));