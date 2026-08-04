/*
 * LZSS Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZSS (Lempel-Ziv-Storer-Szymanski) compression algorithm
 * An improved variant of LZ77 that omits short matches
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

  // ===== WIRE FORMAT CONSTANTS =====

  // Container: 4-byte little-endian original-length header followed by the LZSS body.
  const DISTANCE_BITS = 12;              // 12-bit match distance field
  const LENGTH_BITS = 4;                 // 4-bit match length field
  const MIN_MATCH_LENGTH = 3;            // Minimum encodable match length
  const MAX_DISTANCE = 4096;             // 1 shifted left by DISTANCE_BITS
  const MAX_LENGTH = 18;                 // (1 shifted left by LENGTH_BITS) - 1 + MIN_MATCH_LENGTH
  const HASH_BITS = 15;                  // Hash-chain table address width
  const HASH_SIZE = 32768;               // 1 shifted left by HASH_BITS
  const HASH_MASK = 32767;               // HASH_SIZE - 1
  const MAX_CHAIN_DEPTH = MAX_LENGTH;    // Reference driver wires the chain depth to MaxLength (18), not a separate constant

  // ===== HASH-CHAIN MATCH FINDER =====

  /**
   * 3-byte hash-chain match finder mirroring HashChainMatchFinder from the reference
   * implementation: a 15-bit hash table over the 3-byte prefix, chains walked newest-first,
   * strictly-greater-length acceptance (nearest/most-recent match wins ties).
   */
  class LzssHashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.windowSize = windowSize;
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize); // zero-initialized, matching the reference's default array
    }

    static computeHash(data, pos) {
      const term1 = OpCodes.Shl32(data[pos], 10);
      const term2 = OpCodes.Shl32(data[pos + 1], 5);
      const term3 = data[pos + 2];
      return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(term1, term2), term3), HASH_MASK);
    }

    static matchLength(data, pos1, pos2, limit) {
      let matched = 0;
      while (matched < limit && data[pos1 + matched] === data[pos2 + matched]) ++matched;
      return matched;
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
      const hash = LzssHashChainMatchFinder.computeHash(data, position);
      const slot = position % this.windowSize;
      this.prev[slot] = this.head[hash];
      this.head[hash] = position;
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = LzssHashChainMatchFinder.computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[candidate % this.windowSize];
          ++chainCount;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));

        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          const length = LzssHashChainMatchFinder.matchLength(data, candidate, position, limit);

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = distance;

            if (bestLength >= maxLength) break;
          }
        }

        candidate = this.prev[candidate % this.windowSize];
        if (candidate <= windowStart) break;
        ++chainCount;
      }

      const slot = position % this.windowSize;
      this.prev[slot] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }
  }

  // ===== ENCODE / DECODE HELPERS =====

  /**
   * Encodes the LZSS body: groups of up to 8 tokens, each group preceded by a flag byte
   * (bit i = 1 -> token i is a literal, bit i = 0 -> token i is a match), tokens written
   * in order after the flag byte.
   */
  function lzssEncodeBody(data) {
    const output = [];
    const matchFinder = new LzssHashChainMatchFinder(MAX_DISTANCE, MAX_CHAIN_DEPTH);
    let position = 0;

    while (position < data.length) {
      let flags = 0;
      let flagBit = 0;
      const tokens = [];

      while (flagBit < 8 && position < data.length) {
        const match = matchFinder.findMatch(data, position, MAX_DISTANCE, MAX_LENGTH, MIN_MATCH_LENGTH);

        if (match.length >= MIN_MATCH_LENGTH) {
          const encodedDistance = match.distance - 1;   // 0-based
          const encodedLength = match.length - MIN_MATCH_LENGTH;

          const highByte = OpCodes.And8(OpCodes.Shr32(encodedDistance, DISTANCE_BITS - 8), 0xFF);
          const lowNibble = OpCodes.And8(encodedDistance, 0x0F);
          const lengthNibble = OpCodes.And8(encodedLength, 0x0F);
          const lowByte = OpCodes.Or8(OpCodes.Shl32(lowNibble, LENGTH_BITS), lengthNibble);

          tokens.push(highByte, lowByte);

          // Index every position the match covered (not just the final one)
          for (let i = 1; i < match.length; ++i) matchFinder.insertPosition(data, position + i);

          position += match.length;
        } else {
          flags = OpCodes.SetBit(flags, flagBit, true);
          tokens.push(data[position]);
          ++position;
        }

        ++flagBit;
      }

      output.push(flags);
      for (let i = 0; i < tokens.length; ++i) output.push(tokens[i]);
    }

    return output;
  }

  /**
   * Decodes an LZSS body into exactly expectedLength output bytes (or fewer, if the
   * stream runs out early). Matches copy directly from the growing output buffer, which
   * naturally reproduces overlapping self-referential copies (distance < length).
   */
  function lzssDecodeBody(body, expectedLength) {
    const output = [];
    let pos = 0;

    while (output.length < expectedLength) {
      if (pos >= body.length) break;
      const flagByte = body[pos++];

      for (let bit = 0; bit < 8; ++bit) {
        if (output.length >= expectedLength) break;

        if (OpCodes.GetBit(flagByte, bit)) {
          // Literal
          if (pos >= body.length) return output;
          output.push(body[pos++]);
        } else {
          // Match
          if (pos + 1 >= body.length) return output;
          const b1 = body[pos];
          const b2 = body[pos + 1];
          pos += 2;

          const encodedDistance = OpCodes.Or32(OpCodes.Shl32(b1, DISTANCE_BITS - 8), OpCodes.Shr32(b2, LENGTH_BITS));
          const encodedLength = OpCodes.And8(b2, 0x0F);

          const distance = encodedDistance + 1;
          const length = encodedLength + MIN_MATCH_LENGTH;

          if (distance > output.length) {
            // Distance exceeds available data: emit zeros (defensive, matches reference)
            for (let i = 0; i < length; ++i) output.push(0);
          } else {
            const srcStart = output.length - distance;
            for (let i = 0; i < length; ++i) output.push(output[srcStart + i]);
          }
        }
      }
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * LZSSCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZSSCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZSS";
        this.description = "Lempel-Ziv-Storer-Szymanski compression algorithm. An improved variant of LZ77 that omits short matches and uses bit flags to distinguish literals from references. Wire format: a 4-byte little-endian original-length header, then groups of up to 8 tokens each preceded by a flag byte (bit=1 literal, bit=0 match); matches are 2 bytes encoding a 12-bit distance and 4-bit length (3-18) found via a 3-byte hash-chain match finder.";
        this.inventor = "James A. Storer and Thomas G. Szymanski";
        this.year = 1982;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Wikipedia - LZSS", "https://en.wikipedia.org/wiki/LZSS"),
          new LinkItem("Original Paper", "https://dl.acm.org/doi/10.1145/322344.322346")
        ];

        this.references = [
          new LinkItem("Data Compression Techniques", "http://www.data-compression.info/Algorithms/LZSS/"),
          new LinkItem("LZSS Implementation Guide", "https://oku.edu.mie-u.ac.jp/~okumura/compression/lzss.c")
        ];

        // Test vectors - regenerated against the byte-identical port of
        // CompressionWorkbench's BB_Lzss reference (4-byte LE length header,
        // hash-chain match finder, flag+token body). Cross-verified against the
        // C# reference driver's compress() output.
        this.tests = [
          {
            text: "AAAAAAAAAA repetition",
            uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78",
            input: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65],
            expected: [10, 0, 0, 0, 1, 65, 0, 6]
          },
          {
            text: "Random data - no matches",
            uri: "https://sites.google.com/view/datacompressionguide/dictionary-based-compression/lempel-ziv-lz77lzss-coding",
            input: [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
            expected: [16, 0, 0, 0, 255, 65, 66, 67, 68, 69, 70, 71, 72, 255, 73, 74, 75, 76, 77, 78, 79, 80]
          },
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: [0, 0, 0, 0]
          },
          {
            text: "Highly repetitive data - 300 bytes",
            uri: "https://en.wikipedia.org/wiki/LZSS",
            input: new Array(300).fill(0x58),
            expected: [44, 1, 0, 0, 1, 88, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 15, 0, 0, 15, 0, 8]
          },
          {
            text: "Alternating pattern - 300 bytes",
            uri: "https://en.wikipedia.org/wiki/LZSS",
            input: Array.from({ length: 300 }, (_, i) => (i % 2 ? 0x59 : 0x5A)),
            expected: [44, 1, 0, 0, 3, 90, 89, 0, 31, 0, 31, 0, 31, 0, 31, 0, 31, 0, 31, 0, 0, 31, 0, 31, 0, 31, 0, 31, 0, 31, 0, 31, 0, 31, 0, 31, 0, 0, 31, 0, 31, 0, 23]
          },
          {
            text: "English text sample - repeated sentence",
            uri: "https://en.wikipedia.org/wiki/LZSS",
            input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog. ".repeat(10)),
            expected: [194, 1, 0, 0, 255, 84, 104, 101, 32, 113, 117, 105, 99, 255, 107, 32, 98, 114, 111, 119, 110, 32, 255, 102, 111, 120, 32, 106, 117, 109, 112, 255, 115, 32, 111, 118, 101, 114, 32, 116, 254, 1, 224, 108, 97, 122, 121, 32, 100, 111, 15, 103, 46, 32, 84, 2, 207, 2, 207, 2, 207, 2, 207, 0, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 0, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 2, 207, 0, 2, 207, 2, 207, 2, 197]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LZSSInstance(this, isInverse);
      }
    }

    // LZSS compression instance
    class LZSSInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) {
            return [];
          }

          const result = this._decompress(new Uint8Array(this.inputBuffer));
          this.inputBuffer = [];
          return Array.from(result);
        }

        // Compress: even an empty input must still emit the 4-byte length header.
        const result = this._compress(new Uint8Array(this.inputBuffer));
        this.inputBuffer = [];
        return Array.from(result);
      }

      _compress(inputBytes) {
        const header = OpCodes.Unpack32LE(inputBytes.length);
        const body = lzssEncodeBody(inputBytes);
        return new Uint8Array(header.concat(body));
      }

      _decompress(compressedBytes) {
        if (!compressedBytes || compressedBytes.length < 4) {
          return new Uint8Array(0);
        }

        const originalLength = OpCodes.Pack32LE(compressedBytes[0], compressedBytes[1], compressedBytes[2], compressedBytes[3]);
        const body = compressedBytes.subarray(4);
        const output = lzssDecodeBody(body, originalLength);
        return new Uint8Array(output);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZSSCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZSSCompression, LZSSInstance };
}));