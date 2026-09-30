/*
 * LZS (Stac Lempel-Ziv-Stac) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZS as specified for PPP by RFC 1974 "PPP Stac LZS Compression Protocol"
 * (Friend & Simpson, August 1996), originally developed by Stac Electronics.
 * A single, continuous bit stream (MSB first) with no byte alignment between
 * fields:
 *
 *   <Compressed Stream>  := [<Compressed String>]* <End Marker>
 *   <Compressed String>  := 0 <Raw Byte>            (8-bit literal)
 *                         | 1 <Offset> <Length>      (back-reference)
 *   <Offset>             := 1 <7 bits>                (7-bit offset, 1..127)
 *                         | 0 <11 bits>               (11-bit offset, 1..2047)
 *   <End Marker>         := 110000000                 (9 bits; a "match" whose
 *                                                       7-bit offset is zero)
 *
 * Length is coded as a 2-bit code (00=2, 01=3, 10=4) with 11 escaping
 * straight to an unbounded nibble tier: length = 5 + nibble, and a nibble
 * of 1111 means "add 15 and read another nibble" (matching the reference
 * CompressionWorkbench encoder rather than RFC 1974's own nested 2+2+4-bit
 * tiering, which reserves a middle tier for lengths 5-7).
 *
 * The sliding window covers the last 2 KB of data, matching the 11-bit
 * maximum offset.
 *
 * References:
 * - RFC 1974, "PPP Stac LZS Compression Protocol": https://www.rfc-editor.org/rfc/rfc1974
 * - Lempel-Ziv-Stac (Wikipedia): https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Stac
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== FORMAT CONSTANTS =====

  /** @type {int32} */
  const MIN_MATCH = 2;
  /** @type {int32} */
  const MAX_OFFSET = 2047;     // 11-bit maximum offset (last 2 KB of history)
  /** @type {int32} */
  const MAX_SHORT_LENGTH = 4;  // longest length reachable without the escape code
  /** @type {int32} */
  const HASH_BITS = 14;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const CHAIN_LIMIT = 128;     // hash-chain search depth cap (matches the reference encoder)

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position of the two hashed bytes
   * @returns {uint32} Hash chain head index
   */
  function hashAt(data, pos) {
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(data[pos], 6), data[pos + 1]), HASH_SIZE - 1);
  }

  // ===== BIT-LEVEL STREAM HELPERS (MSB first) =====

  class BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.cur = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @param {uint32} bit - Bit (any non-zero value writes 1)
     */
    writeBit(bit) {
      this.cur = OpCodes.Or32(OpCodes.Shl32(this.cur, 1), bit ? 1 : 0);
      this.nBits++;
      if (this.nBits === 8) {
        this.bytes.push(OpCodes.And32(this.cur, 0xFF));
        this.cur = 0;
        this.nBits = 0;
      }
    }

    /**
     * @param {uint32} value - Value
     * @param {int32} count - Number of low bits written, most significant first
     */
    writeBits(value, count) {
      for (let i = count - 1; i >= 0; --i) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
      }
    }

    /**
     * @returns {uint8[]} All bytes written, the last one zero-padded
     */
    finish() {
      if (this.nBits > 0) {
        this.cur = OpCodes.Shl32(this.cur, 8 - this.nBits);
        this.bytes.push(OpCodes.And32(this.cur, 0xFF));
        this.cur = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    /**
     * @param {uint8[]} bytes - Bytes to read (zero bits past the end)
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint8} */
      this.cur = 0;
      /** @type {int32} */
      this.nBits = 0;
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      if (this.nBits === 0) {
        this.cur = this.pos < this.bytes.length ? this.bytes[this.pos++] : 0;
        this.nBits = 8;
      }
      this.nBits--;
      return OpCodes.And32(OpCodes.Shr32(this.cur, this.nBits), 1);
    }

    /**
     * @param {int32} count - Number of bits
     * @returns {uint32} Their value, first bit most significant
     */
    readBits(count) {
      /** @type {uint32} */
      let value = 0;
      for (let i = 0; i < count; ++i) {
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
      }
      return value;
    }
  }

  // ===== LENGTH CODE (RFC 1974 section 2.5.5) =====

  /**
   * @param {BitWriter} bw - Output bits
   * @param {int32} length - Match length (at least 2)
   */
  function writeLength(bw, length) {
    if (length <= 4) {
      // Lengths 2-4: 2-bit code (00=2, 01=3, 10=4).
      bw.writeBits(length - 2, 2);
      return;
    }

    // Length 5+: 2-bit escape (11), then (length-5) as a nibble; a nibble
    // of 15 means "add 15 and read another nibble" (unbounded tier).
    bw.writeBits(3, 2);
    /** @type {int32} */
    let remaining = length - 5;
    while (remaining >= 15) {
      bw.writeBits(15, 4);
      remaining -= 15;
    }
    bw.writeBits(remaining, 4);
  }

  /**
   * @param {BitReader} br - Input bits
   * @returns {int32} Match length
   */
  function readLength(br) {
    /** @type {int32} */
    const v = br.readBits(2);
    if (v < 3) {
      return 2 + v;
    }

    /** @type {int32} */
    let length = 5;
    /** @type {int32} */
    let nibble = 0;
    do {
      nibble = br.readBits(4);
      length += nibble;
    } while (nibble === 15);
    return length;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZSCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZS";
      this.description = "Stac Lempel-Ziv-Stac compression as specified for PPP by RFC 1974. A continuous MSB-first bit stream mixes 8-bit literals with back-references whose offset is coded as either 7 or 11 bits and whose length uses a nested nibble/escape code, terminated by a fixed 9-bit end marker.";
      this.inventor = "Stac Electronics";
      this.year = 1996;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 1974 - PPP Stac LZS Compression Protocol", "https://www.rfc-editor.org/rfc/rfc1974"),
        new LinkItem("Lempel-Ziv-Stac (Wikipedia)", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Stac")
      ];

      this.references = [
        new LinkItem("RFC 1974 text", "https://www.ietf.org/rfc/rfc1974.txt"),
        new LinkItem("RFC Editor info page", "https://www.rfc-editor.org/info/rfc1974")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://www.rfc-editor.org/rfc/rfc1974",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Highly repetitive input (40 'A' bytes)",
          uri: "https://www.rfc-editor.org/rfc/rfc1974",
          input: new Array(40).fill(0x41),
          expected: [40, 0, 0, 0, 32, 144, 112, 63, 249, 224, 0]
        },
        {
          text: "Text sample",
          uri: "https://www.rfc-editor.org/rfc/rfc1974",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [65, 0, 0, 0, 58, 26, 12, 162, 3, 137, 212, 210, 99, 53, 136, 12, 71, 35, 121, 220, 220, 32, 51, 27, 207, 2, 3, 81, 212, 218, 112, 57, 136, 13, 231, 99, 41, 200, 65, 159, 141, 134, 19, 209, 228, 64, 100, 55, 153, 197, 216, 236, 53, 189, 11, 176, 0]
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {LZSInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new LZSInstance(this, isInverse);
    }
  }

  class LZSInstance extends IAlgorithmInstance {
    /**
     * @param {LZSCompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this._decompress(this.inputBuffer);
      } else {
        result = this._compress(this.inputBuffer);
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} 4-byte LE size followed by the LZS bit stream
     */
    _compress(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) {
        return header;
      }

      /** @type {BitWriter} */
      const bw = new BitWriter();
      /** @type {int32[]} */
      const hashHead = new Int32Array(HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      const hashPrev = new Int32Array(n);
      /** @type {int32} */
      let pos = 0;

      while (pos < n) {
        // Find best match using a hash chain (mirrors the reference encoder
        // exactly, including its chain-length cap and hash function, so
        // encoder decisions on ties/limits match byte-for-byte).
        /** @type {int32} */
        let bestLen = 0;
        /** @type {int32} */
        let bestOff = 0;

        if (pos >= MIN_MATCH && pos + MIN_MATCH <= n) {
          /** @type {uint32} */
          const hash = hashAt(input, pos);
          /** @type {int32} */
          let chainLen = 0;
          /** @type {int32} */
          let idx = hashHead[hash];
          /** @type {int32} */
          const minPos = Math.max(0, pos - MAX_OFFSET);
          /** @type {int32} */
          const maxLen = Math.min(n - pos, 255 + MAX_SHORT_LENGTH);

          while (idx >= minPos && chainLen < CHAIN_LIMIT) {
            /** @type {int32} */
            let len = 0;
            while (len < maxLen && input[idx + len] === input[pos + len]) {
              len++;
            }

            if (len >= MIN_MATCH && len > bestLen) {
              bestLen = len;
              bestOff = pos - idx;
            }

            chainLen++;
            idx = hashPrev[idx];
          }
        }

        // Update the hash chain for the current position.
        if (pos + 2 <= n) {
          /** @type {uint32} */
          const h = hashAt(input, pos);
          hashPrev[pos] = hashHead[h];
          hashHead[h] = pos;
        }

        if (bestLen >= MIN_MATCH) {
          bw.writeBit(1);

          if (bestOff <= 127) {
            bw.writeBit(1);
            bw.writeBits(bestOff, 7);
          } else {
            bw.writeBit(0);
            bw.writeBits(bestOff, 11);
          }

          writeLength(bw, bestLen);

          // Update the hash chain for positions skipped by the match.
          for (let j = 1; j < bestLen && pos + j + 2 <= n; j++) {
            /** @type {uint32} */
            const h = hashAt(input, pos + j);
            hashPrev[pos + j] = hashHead[h];
            hashHead[h] = pos + j;
          }

          pos += bestLen;
        } else {
          bw.writeBit(0);
          bw.writeBits(input[pos], 8);
          pos += 1;
        }
      }

      // End Marker: 1 <match> 1 <7-bit offset selector> 0000000 (offset = 0)
      bw.writeBit(1);
      bw.writeBit(1);
      bw.writeBits(0, 7);

      /** @type {uint8[]} */
      const body = bw.finish();
      return header.concat(body);
    }

    /**
     * @param {uint8[]} input - 4-byte LE size followed by the LZS bit stream
     * @returns {uint8[]} Decoded bytes (up to the end marker)
     */
    _decompress(input) {
      /** @type {uint8[]} */
      const output = [];
      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalSize === 0) {
        return output;
      }

      /** @type {BitReader} */
      const br = new BitReader(input.slice(4));

      for (;;) {
        /** @type {uint32} */
        const type = br.readBit();

        if (type === 0) {
          /** @type {uint32} */
          const literal = br.readBits(8);
          output.push(literal);
          continue;
        }

        /** @type {uint32} */
        const sel = br.readBit();
        /** @type {int32} */
        let distance = 0;

        if (sel === 1) {
          distance = br.readBits(7);
          if (distance === 0) {
            break; // End Marker
          }
        } else {
          distance = br.readBits(11);
        }

        /** @type {int32} */
        const length = readLength(br);
        /** @type {int32} */
        const start = output.length - distance;

        for (let k = 0; k < length; ++k) {
          output.push(output[start + k]);
        }
      }

      return output;
    }

  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZSCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZSCompression, LZSInstance };
}));
