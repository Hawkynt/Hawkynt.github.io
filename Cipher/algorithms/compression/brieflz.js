/*
 * BriefLZ - Small Fast Lempel-Ziv Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BriefLZ is a small and fast LZ77-based compression algorithm created by
 * Joergen Ibsen. This implementation is a byte-for-byte port of the
 * CompressionWorkbench (C#) clean-room BriefLZ building block, so it is
 * NOT bit-compatible with the original Ibsen `blz` container format (which
 * additionally wraps the stream in a checksummed header) - only round trips
 * against this port (and CompressionWorkbench's own building block) are
 * guaranteed.
 *
 * Wire format:
 * - 4-byte little-endian header holding the original (uncompressed) length.
 *   If that length is 0, the header is the entire output (no body follows).
 * - A byte-oriented bit stream, MSB-first within each byte, with one tag
 *   bit per token:
 *   - 0: literal token - the next 8 bits (MSB-first) are a raw byte.
 *   - 1: match token - followed by two Elias-gamma coded values: the match
 *     length (encoded as length - MinMatch + 1, MinMatch = 3) and the match
 *     offset (the raw back-reference distance, >= 1).
 *   The final partial byte is zero-padded (MSB side) after the last token.
 * - Matches are found with a hash chain over a 3-byte Knuth-style
 *   multiplicative hash, resolved greedily (longest match at each
 *   position, no lazy/optimal parsing).
 *
 * References:
 * - Original C implementation: https://github.com/jibsen/brieflz
 * - Elias gamma coding: https://en.wikipedia.org/wiki/Elias_gamma_coding
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

  // ===== ALGORITHM CONSTANTS =====

  const MIN_MATCH = 3;
  const MAX_MATCH = 2147483647 - MIN_MATCH; // gamma coding has no practical upper bound
  const HASH_BITS = 16;
  const HASH_SIZE = 65536; // 2^HASH_BITS
  const MAX_CHAIN_STEPS = 128;
  const MAX_WINDOW = 1048576; // 2^20

  // ===== BIT STREAM (byte-oriented, MSB-first) =====

  class GammaBitWriter {
    constructor() {
      this.bytes = [];
      this.current = 0;
      this.bitCount = 0;
    }

    writeBit(bit) {
      this.current = OpCodes.Or32(OpCodes.Shl32(this.current, 1), bit ? 1 : 0);
      this.bitCount++;

      if (this.bitCount === 8) {
        this.bytes.push(OpCodes.And32(this.current, 0xFF));
        this.current = 0;
        this.bitCount = 0;
      }
    }

    writeByteBits(value) {
      // MSB-first: bit 7 down to bit 0
      for (let i = 7; i >= 0; i--)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }

    writeGamma(value) {
      // Elias-gamma, MSB-first, value >= 1.
      // bits = position of the highest set bit (floor(log2(value)))
      let bits = 0;
      let v = value;
      while (v > 1) {
        v = OpCodes.Shr32(v, 1);
        bits++;
      }

      for (let i = 0; i < bits; i++)
        this.writeBit(0);

      for (let i = bits; i >= 0; i--)
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }

    getBytes() {
      if (this.bitCount > 0) {
        const shift = 8 - this.bitCount;
        this.bytes.push(OpCodes.And32(OpCodes.Shl32(this.current, shift), 0xFF));
        this.current = 0;
        this.bitCount = 0;
      }

      return this.bytes;
    }
  }

  class GammaBitReader {
    constructor(data) {
      this.data = data;
      this.pos = 0;
      this.current = 0;
      this.bitCount = 0;
    }

    readBit() {
      if (this.bitCount === 0) {
        this.current = this.pos < this.data.length ? this.data[this.pos++] : 0;
        this.bitCount = 8;
      }

      this.bitCount--;
      return OpCodes.And32(OpCodes.Shr32(this.current, this.bitCount), 1);
    }

    readByteBits() {
      let value = 0;
      for (let i = 0; i < 8; i++)
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());

      return value;
    }

    readGamma() {
      let zeros = 0;
      while (this.readBit() === 0)
        zeros++;

      let value = 1;
      for (let i = 0; i < zeros; i++)
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());

      return value;
    }
  }

  // ===== HASH-CHAIN MATCH FINDER =====

  /**
   * 3-byte Knuth-style multiplicative hash of data[pos..pos+2], matching
   * CompressionWorkbench's BriefLZ building block exactly: combine the
   * three bytes into a 24-bit big-endian value (byte0 shifted up 16,
   * byte1 shifted up 8, byte2 as-is, OR'd together), multiply unsigned
   * 32-bit by 2654435761, then take the top HASH_BITS bits of the product
   * (logical right shift by 32 - HASH_BITS).
   */
  function hash3(data, pos) {
    const triple = OpCodes.Or32(
      OpCodes.Or32(OpCodes.Shl32(data[pos], 16), OpCodes.Shl32(data[pos + 1], 8)),
      data[pos + 2]
    );
    const product = OpCodes.Mul32(triple, 2654435761);
    return OpCodes.Shr32(product, 32 - HASH_BITS);
  }

  function insertHash(data, pos, hashHead, chain) {
    const h = hash3(data, pos);
    chain[pos] = hashHead[h];
    hashHead[h] = pos;
  }

  /**
   * Hash-chain search: `chain` is indexed BY POSITION (one slot per input
   * byte, not a fixed hash-size prev array). Walk stops after
   * MAX_CHAIN_STEPS candidates, or once a `prev >= candidate` link is seen
   * (defensive cycle guard), or once the maximum encodable length for this
   * position is reached.
   */
  function findMatch(data, pos, hashHead, chain) {
    const length = data.length;

    if (pos + MIN_MATCH > length)
      return { length: 0, offset: 0 };

    const h = hash3(data, pos);
    let candidate = hashHead[h];
    const minPos = Math.max(0, pos - MAX_WINDOW);
    const maxLen = Math.min(MAX_MATCH, length - pos);
    let bestLen = 0;
    let bestOff = 0;
    let steps = MAX_CHAIN_STEPS;

    while (candidate >= minPos && steps-- > 0) {
      if (data[candidate + bestLen] === data[pos + bestLen] || bestLen === 0) {
        let len = 0;
        while (len < maxLen && data[candidate + len] === data[pos + len])
          len++;

        if (len > bestLen) {
          bestLen = len;
          bestOff = pos - candidate;
          if (len >= maxLen)
            break;
        }
      }

      const prev = chain[candidate];
      if (prev >= candidate)
        break;
      candidate = prev;
    }

    return bestLen >= MIN_MATCH ? { length: bestLen, offset: bestOff } : { length: 0, offset: 0 };
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class BriefLZCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BriefLZ";
      this.description = "Byte-for-byte port of CompressionWorkbench's clean-room BriefLZ building block: byte-oriented LZ77 with a single tag bit per token (0=literal, 1=match) and Elias-gamma coded match length/offset, matched via a 3-byte multiplicative hash chain. Not bit-compatible with the original Ibsen blz container format (which adds a checksummed header) - only this port's own round trip and CompressionWorkbench's building block are guaranteed to interoperate.";
      this.inventor = "Joergen Ibsen";
      this.year = 2002;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DK; // Denmark

      // Documentation and references
      this.documentation = [
        new LinkItem("BriefLZ GitHub Repository", "https://github.com/jibsen/brieflz"),
        new LinkItem("BriefLZ Format Description", "https://www.ibsensoftware.com/"),
        new LinkItem("Elias Gamma Coding - Wikipedia", "https://en.wikipedia.org/wiki/Elias_gamma_coding")
      ];

      this.references = [
        new LinkItem("Original C Implementation", "https://github.com/jibsen/brieflz/blob/master/src/depack.c"),
        new LinkItem("BriefLZ README", "https://github.com/jibsen/brieflz/blob/master/README.md"),
        new LinkItem("Gamma Coding", "https://en.wikipedia.org/wiki/Elias_gamma_coding")
      ];

      // Test vectors: 4-byte LE original-length header, then a byte-oriented
      // MSB-first bit stream of tag bits / literal bytes / gamma-coded
      // match length+offset pairs. Expected outputs were generated by this
      // implementation and cross-verified against the CompressionWorkbench
      // (C#) BB_BriefLz building block byte-for-byte.
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/jibsen/brieflz",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single literal byte",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("A"),
          expected: [0x01, 0x00, 0x00, 0x00, 0x20, 0x80]
        },
        {
          text: "Two literal bytes",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("AB"),
          expected: [0x02, 0x00, 0x00, 0x00, 0x20, 0x90, 0x80]
        },
        {
          text: "Three literal bytes",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("ABC"),
          expected: [0x03, 0x00, 0x00, 0x00, 0x20, 0x90, 0x88, 0x60]
        },
        {
          text: "256 repeated bytes - exercises long matches and multi-bit gamma codes",
          uri: "https://github.com/jibsen/brieflz",
          input: Array(256).fill(0x61)
        },
        {
          text: "1024 repeated bytes - exercises long matches and multi-bit gamma codes",
          uri: "https://github.com/jibsen/brieflz",
          input: Array(1024).fill(0x61)
        },
        {
          text: "All 256 byte values 0..255",
          uri: "https://github.com/jibsen/brieflz",
          input: (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })()
        },
        {
          text: "Repeated phrase - exercises literals and matches together",
          uri: "https://github.com/jibsen/brieflz",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. ")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BriefLZInstance(this, isInverse);
    }
  }

  /**
 * BriefLZ cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BriefLZInstance extends IAlgorithmInstance {
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
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          return [];
        }
        return this._decompress();
      }

      // Compression always emits at least the 4-byte length header, even
      // for empty input (matching the CompressionWorkbench reference).
      return this._compress();
    }

    _decompress() {
      if (this.inputBuffer.length < 4) {
        this.inputBuffer = [];
        return [];
      }

      // Read the 4-byte little-endian original-length header.
      const targetSize = OpCodes.Pack32LE(
        this.inputBuffer[0], this.inputBuffer[1], this.inputBuffer[2], this.inputBuffer[3]
      );

      if (targetSize === 0) {
        this.inputBuffer = [];
        return [];
      }

      const reader = new GammaBitReader(this.inputBuffer.slice(4));
      const output = [];

      while (output.length < targetSize) {
        const tag = reader.readBit();

        if (tag === 0) {
          output.push(reader.readByteBits());
        } else {
          const len = reader.readGamma() + MIN_MATCH - 1;
          const off = reader.readGamma();

          if (off <= 0 || off > output.length)
            throw new Error("BriefLZ: match offset " + off + " invalid at position " + output.length + ".");

          for (let i = 0; i < len && output.length < targetSize; i++)
            output.push(output[output.length - off]);
        }
      }

      this.inputBuffer = [];
      return output;
    }

    _compress() {
      const src = this.inputBuffer;
      const originalLength = src.length;
      const header = OpCodes.Unpack32LE(originalLength);

      if (originalLength === 0) {
        this.inputBuffer = [];
        return header;
      }

      const writer = new GammaBitWriter();
      const hashHead = new Int32Array(HASH_SIZE).fill(-1);
      const chain = new Int32Array(originalLength);

      let pos = 0;
      while (pos < originalLength) {
        const match = findMatch(src, pos, hashHead, chain);

        if (match.length >= MIN_MATCH) {
          writer.writeBit(1);
          writer.writeGamma(match.length - MIN_MATCH + 1);
          writer.writeGamma(match.offset);

          const end = Math.min(pos + match.length, originalLength - 2);
          for (let i = pos; i < end; i++)
            insertHash(src, i, hashHead, chain);

          pos += match.length;
        } else {
          writer.writeBit(0);
          writer.writeByteBits(src[pos]);

          if (pos < originalLength - 2)
            insertHash(src, pos, hashHead, chain);

          pos++;
        }
      }

      this.inputBuffer = [];
      return header.concat(writer.getBytes());
    }
  }

  // Register algorithm
  RegisterAlgorithm(new BriefLZCompression());

  return BriefLZCompression;
}));
