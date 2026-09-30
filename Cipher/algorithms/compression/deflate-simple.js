/*
 * Simplified Deflate - RFC 1951 restricted to fixed-Huffman blocks
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * This is real, legal raw DEFLATE, not a lookalike container. The encoder
 * emits exactly one block with BFINAL=1 and BTYPE=01, so the literal/length
 * and distance alphabets are the fixed code tables of RFC 1951 section 3.2.6
 * and nothing describing the code has to be transmitted. That is the whole
 * simplification against deflate.js, which also builds dynamic (BTYPE=10)
 * blocks and therefore has to emit code-length codes as well.
 *
 * Everything else follows the specification: LZ77 over a 32 KiB window with
 * match lengths 3..258, the length and distance code tables with their extra
 * bits, an explicit end-of-block symbol, Huffman codes packed most significant
 * bit first, extra bits packed least significant bit first, and the stream
 * padded to a byte boundary. Output therefore decompresses with any conforming
 * inflater, including node's zlib.inflateRawSync.
 *
 * The decoder accepts BTYPE=00 (stored) as well as BTYPE=01 and rejects
 * dynamic blocks: reading those is deflate.js's job.
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

  // ===== RFC 1951 CONSTANTS =====

  /**
   * @returns {int32[]} Powers of two 2^0 .. 2^16
   */
  function buildPowersOfTwo() {
    /** @type {int32[]} */
    const powers = new Array(17);
    powers[0] = 1;
    for (let i = 1; i < powers.length; i++) {
      powers[i] = powers[i - 1] * 2;
    }
    return powers;
  }

  /** @type {int32[]} */
  const POW2 = buildPowersOfTwo();

  // Length codes 257..285: base length and number of extra bits.
  /** @type {int32[]} */
  const LENGTH_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258
  ];
  /** @type {int32[]} */
  const LENGTH_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
    3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
  ];

  // Distance codes 0..29: base distance and number of extra bits.
  /** @type {int32[]} */
  const DISTANCE_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
  ];
  /** @type {int32[]} */
  const DISTANCE_EXTRA = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13
  ];

  /** @type {int32} */
  const END_OF_BLOCK = 256;
  /** @type {int32} */
  const WINDOW_SIZE = 32768;
  /** @type {int32} */
  const MIN_MATCH = 3;
  /** @type {int32} */
  const MAX_MATCH = 258;
  /** @type {int32} */
  const MAX_CHAIN = 32;      // bound on hash-chain probes per position
  /** @type {int32} */
  const HASH_SIZE = 65536;

  // Fixed literal/length alphabet (RFC 1951 section 3.2.6):
  //   0..143   8 bits, codes 0x30..0xBF
  //   144..255 9 bits, codes 0x190..0x1FF
  //   256..279 7 bits, codes 0x00..0x17
  //   280..287 8 bits, codes 0xC0..0xC7
  /**
   * @param {int32} symbol - Literal/length symbol
   * @returns {int32} Fixed Huffman code
   */
  function fixedLiteralCode(symbol) {
    if (symbol <= 143) {
      return 48 + symbol;
    }
    if (symbol <= 255) {
      return 400 + symbol - 144;
    }
    if (symbol <= 279) {
      return symbol - 256;
    }
    return 192 + symbol - 280;
  }

  /**
   * @param {int32} symbol - Literal/length symbol
   * @returns {int32} Length of its fixed Huffman code
   */
  function fixedLiteralBits(symbol) {
    if (symbol <= 143) {
      return 8;
    }
    if (symbol <= 255) {
      return 9;
    }
    if (symbol <= 279) {
      return 7;
    }
    return 8;
  }

  // Length 3..258 -> index into the length tables, precomputed once.
  /**
   * @returns {int32[]} Length code per match length
   */
  function buildLengthToCode() {
    /** @type {int32[]} */
    const map = new Array(MAX_MATCH + 1);
    for (let i = 0; i <= MAX_MATCH; i++) {
      map[i] = 0;
    }
    for (let code = 0; code < LENGTH_BASE.length; code++) {
      /** @type {int32} */
      const next = code + 1 < LENGTH_BASE.length ? LENGTH_BASE[code + 1] : MAX_MATCH + 1;
      for (let length = LENGTH_BASE[code]; length < next && length <= MAX_MATCH; length++) {
        map[length] = code;
      }
    }
    map[MAX_MATCH] = LENGTH_BASE.length - 1;
    return map;
  }

  /** @type {int32[]} */
  const LENGTH_TO_CODE = buildLengthToCode();

  /**
   * @param {int32} distance - Match distance
   * @returns {int32} Distance code
   */
  function distanceToCode(distance) {
    for (let code = DISTANCE_BASE.length - 1; code >= 0; code--) {
      if (distance >= DISTANCE_BASE[code]) {
        return code;
      }
    }
    return 0;
  }

  // ===== BIT PLUMBING =====

  // RFC 1951 section 3.1.1: data elements other than Huffman codes are packed
  // starting with the least significant bit; Huffman codes are packed starting
  // with the most significant bit. Bytes fill from the least significant bit.
  class BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.partial = 0;
      /** @type {int32} */
      this.used = 0;
    }

    /**
     * @param {int32} bit - Bit (any non-zero value is a 1)
     */
    writeBit(bit) {
      if (bit !== 0) {
        this.partial = OpCodes.SetBit(this.partial, this.used, true);
      }
      this.used++;
      if (this.used === 8) {
        this.bytes.push(this.partial);
        this.partial = 0;
        this.used = 0;
      }
    }

    /**
     * @param {int32} value - Value
     * @param {int32} bits - Number of bits, least significant first
     */
    writeValue(value, bits) {
      for (let i = 0; i < bits; i++) {
        this.writeBit(Math.floor(value / POW2[i]) % 2);
      }
    }

    /**
     * @param {int32} code - Huffman code
     * @param {int32} bits - Number of bits, most significant first
     */
    writeCode(code, bits) {
      for (let i = bits - 1; i >= 0; i--) {
        this.writeBit(Math.floor(code / POW2[i]) % 2);
      }
    }

    /**
     * @returns {uint8[]} All bytes, the last one zero-padded
     */
    finish() {
      if (this.used > 0) {
        this.bytes.push(this.partial);
        this.partial = 0;
        this.used = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    /**
     * @param {uint8[]} data - DEFLATE stream
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.byteIndex = 0;
      /** @type {int32} */
      this.bitIndex = 0;
    }

    /**
     * @returns {int32} Next bit
     */
    readBit() {
      if (this.byteIndex >= this.data.length) {
        throw new Error('Truncated DEFLATE stream');
      }
      /** @type {int32} */
      const bit = OpCodes.GetBit(this.data[this.byteIndex], this.bitIndex) ? 1 : 0;
      this.bitIndex++;
      if (this.bitIndex === 8) {
        this.bitIndex = 0;
        this.byteIndex++;
      }
      return bit;
    }

    /**
     * @param {int32} bits - Number of bits, least significant first
     * @returns {int32} Value read
     */
    readValue(bits) {
      /** @type {int32} */
      let value = 0;
      for (let i = 0; i < bits; i++) {
        /** @type {int32} */
        const bit = this.readBit();
        value += bit * POW2[i];
      }
      return value;
    }

    /**
     * @param {int32} bits - Number of bits, most significant first
     * @returns {int32} Code read
     */
    readCode(bits) {
      /** @type {int32} */
      let code = 0;
      for (let i = 0; i < bits; i++) {
        /** @type {int32} */
        const bit = this.readBit();
        code = code * 2 + bit;
      }
      return code;
    }

    /** Skip to the next byte boundary */
    alignToByte() {
      if (this.bitIndex !== 0) {
        this.bitIndex = 0;
        this.byteIndex++;
      }
    }
  }

  // Fixed literal/length decoding by code length, exploiting the fact that the
  // fixed alphabet is canonical and its code ranges do not overlap.
  /**
   * @param {BitReader} reader - Input bits
   * @returns {int32} Literal/length symbol
   */
  function readFixedLiteral(reader) {
    /** @type {int32} */
    let code = reader.readCode(7);
    if (code <= 23) {
      return 256 + code;
    }

    /** @type {int32} */
    const eighth = reader.readBit();
    code = code * 2 + eighth;
    if (code >= 48 && code <= 191) {
      return code - 48;
    }
    if (code >= 192 && code <= 199) {
      return 280 + code - 192;
    }

    /** @type {int32} */
    const ninth = reader.readBit();
    code = code * 2 + ninth;
    if (code >= 400 && code <= 511) {
      return 144 + code - 400;
    }

    throw new Error('Invalid fixed Huffman code in DEFLATE stream');
  }

  // ===== LZ77 =====

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} position - Position of the three hashed bytes
   * @returns {int32} Bucket
   */
  function hashAt(data, position) {
    /** @type {int32} */
    const a = data[position];
    /** @type {int32} */
    const b = data[position + 1];
    /** @type {int32} */
    const c = data[position + 2];
    return (a * 4093 + b * 257 + c) % HASH_SIZE;
  }

  /**
   * Match found by the hash-chain search
   */
  class DeflateSimpleMatch {
    /**
     * @param {int32} length - Match length (0 when none)
     * @param {int32} distance - Match distance
     */
    constructor(length, distance) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.distance = distance;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * DeflateSimpleAlgorithm - RFC 1951 with fixed Huffman blocks only
   * @class
   * @extends {CompressionAlgorithm}
   */
  class DeflateSimpleAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Simplified Deflate (Fixed Huffman)";
      this.description = "Raw RFC 1951 DEFLATE restricted to fixed-Huffman blocks. The encoder emits a single BFINAL=1, BTYPE=01 block over the fixed literal/length and distance alphabets of section 3.2.6, with LZ77 matching across a 32 KiB window; no dynamic code lengths are ever transmitted. Output is a conforming raw DEFLATE stream that any inflater reads. The decoder handles stored and fixed blocks; dynamic blocks are the full DEFLATE implementation's job.";
      this.inventor = "Phil Katz";
      this.year = 1991;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("RFC 1951 - DEFLATE Compressed Data Format", "https://www.rfc-editor.org/rfc/rfc1951"),
        new LinkItem("An Explanation of the Deflate Algorithm", "https://www.zlib.net/feldspar.html"),
        new LinkItem("LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("zlib reference implementation", "https://www.zlib.net/"),
        new LinkItem("infgen - DEFLATE stream disassembler", "https://github.com/madler/infgen"),
        new LinkItem("PKZIP APPNOTE", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT")
      ];

      // The vectors below were derived by hand from RFC 1951: BFINAL=1 then
      // BTYPE=01 packed least significant bit first, literals 0..143 as the
      // 8-bit codes 0x30+symbol packed most significant bit first, the
      // end-of-block symbol 256 as the 7-bit code 0000000, and lengths and
      // distances from the section 3.2.5 tables. Each was then put through
      // zlib.inflateRawSync, which recovers the input exactly.
      this.tests = [
        new TestCase(
          [],
          [3, 0],
          "Empty input - bare final fixed block with end-of-block only",
          "https://www.rfc-editor.org/rfc/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          [115, 4, 0],
          "Single literal - 0x30+65 then end-of-block",
          "https://www.rfc-editor.org/rfc/rfc1951"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAA"),
          [115, 132, 2, 0],
          "Literal then length 7 at distance 1 - overlapping match",
          "https://www.zlib.net/feldspar.html"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABCABC"),
          [115, 116, 114, 134, 32, 0],
          "Three literals then length 6 at distance 3",
          "https://www.rfc-editor.org/rfc/rfc1951"
        ),
        // Round-trip only: real text exercises code lengths and extra bits in
        // combinations nobody can pack by hand.
        new TestCase(OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog."), [], "Repeated phrase round-trip", "Regression test for match emission"),
        new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip", "Regression test for the 9-bit literal range"),
        new TestCase(new Array(1024).fill(0x5a), [], "Long run round-trip", "Regression test for maximum match length")
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {DeflateSimpleInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DeflateSimpleInstance(this, isInverse);
    }
  }

  class DeflateSimpleInstance extends IAlgorithmInstance {
    /**
     * @param {DeflateSimpleAlgorithm} algorithm - Parent algorithm
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
      if (this.isInverse) {
        // An empty buffer is not a valid DEFLATE stream: even an empty message
        // costs the two bytes of a final fixed block.
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decompress();
      }
      return this._compress();
    }

    /**
     * @param {BitWriter} writer - Output bits
     * @param {int32} symbol - Literal/length symbol
     */
    _writeFixedSymbol(writer, symbol) {
      writer.writeCode(fixedLiteralCode(symbol), fixedLiteralBits(symbol));
    }

    /**
     * @returns {uint8[]} Raw DEFLATE stream (one final fixed-Huffman block)
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      /** @type {BitWriter} */
      const writer = new BitWriter();

      // One final block, fixed Huffman codes.
      writer.writeBit(1);
      writer.writeValue(1, 2);

      /** @type {int32[]} */
      const head = new Int32Array(HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      const prev = new Int32Array(data.length > 0 ? data.length : 1).fill(-1);

      /** @type {int32} */
      let position = 0;
      while (position < data.length) {
        /** @type {int32} */
        let matchLength = 0;
        /** @type {int32} */
        let matchDistance = 0;

        if (position + MIN_MATCH <= data.length) {
          /** @type {DeflateSimpleMatch} */
          const found = this._findMatch(data, position, head, prev, hashAt(data, position));
          matchLength = found.length;
          matchDistance = found.distance;
        }

        if (matchLength >= MIN_MATCH) {
          /** @type {int32} */
          const lengthCode = LENGTH_TO_CODE[matchLength];
          this._writeFixedSymbol(writer, 257 + lengthCode);
          writer.writeValue(matchLength - LENGTH_BASE[lengthCode], LENGTH_EXTRA[lengthCode]);

          /** @type {int32} */
          const distanceCode = distanceToCode(matchDistance);
          writer.writeCode(distanceCode, 5);
          writer.writeValue(matchDistance - DISTANCE_BASE[distanceCode], DISTANCE_EXTRA[distanceCode]);

          for (let i = 0; i < matchLength; i++) {
            this._insert(data, position + i, head, prev);
          }
          position += matchLength;
        } else {
          this._writeFixedSymbol(writer, data[position]);
          this._insert(data, position, head, prev);
          position++;
        }
      }

      this._writeFixedSymbol(writer, END_OF_BLOCK);

      /** @type {uint8[]} */
      const stream = writer.finish();
      return stream;
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @param {int32} position - Position to insert
     * @param {int32[]} head - Chain heads
     * @param {int32[]} prev - Chain links
     */
    _insert(data, position, head, prev) {
      if (position + MIN_MATCH > data.length) {
        return;
      }
      /** @type {int32} */
      const bucket = hashAt(data, position);
      prev[position] = head[bucket];
      head[bucket] = position;
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @param {int32} position - Position to match
     * @param {int32[]} head - Chain heads
     * @param {int32[]} prev - Chain links
     * @param {int32} bucket - Hash bucket of the position
     * @returns {DeflateSimpleMatch} Longest match (length 0 when none)
     */
    _findMatch(data, position, head, prev, bucket) {
      /** @type {int32} */
      const maxLength = Math.min(MAX_MATCH, data.length - position);
      if (maxLength < MIN_MATCH) {
        return new DeflateSimpleMatch(0, 0);
      }

      /** @type {int32} */
      const oldest = position - WINDOW_SIZE;
      /** @type {int32} */
      let best = 0;
      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let candidate = head[bucket];
      /** @type {int32} */
      let probes = MAX_CHAIN;

      while (candidate >= 0 && candidate > oldest && probes > 0) {
        probes--;
        if (data[candidate + best] === data[position + best]) {
          /** @type {int32} */
          let length = 0;
          while (length < maxLength && data[candidate + length] === data[position + length]) {
            length++;
          }
          if (length > best) {
            best = length;
            bestDistance = position - candidate;
            if (length === maxLength) {
              break;
            }
          }
        }
        candidate = prev[candidate];
      }

      if (best < MIN_MATCH) {
        return new DeflateSimpleMatch(0, 0);
      }
      return new DeflateSimpleMatch(best, bestDistance);
    }

    /**
     * @returns {uint8[]} Decoded bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      /** @type {BitReader} */
      const reader = new BitReader(data);
      /** @type {uint8[]} */
      const output = [];
      /** @type {int32} */
      let last = 0;

      do {
        last = reader.readBit();
        /** @type {int32} */
        const blockType = reader.readValue(2);

        if (blockType === 0) {
          reader.alignToByte();
          /** @type {int32} */
          const storedLength = reader.readValue(16);
          reader.readValue(16); // one's complement of the length
          for (let i = 0; i < storedLength; i++) {
            /** @type {int32} */
            const value = reader.readValue(8);
            output.push(value);
          }
          continue;
        }

        if (blockType !== 1) {
          throw new Error('Simplified Deflate reads stored and fixed-Huffman blocks only');
        }

        for (;;) {
          /** @type {int32} */
          const symbol = readFixedLiteral(reader);
          if (symbol === END_OF_BLOCK) {
            break;
          }

          if (symbol < END_OF_BLOCK) {
            output.push(symbol);
            continue;
          }

          /** @type {int32} */
          const lengthCode = symbol - 257;
          if (lengthCode >= LENGTH_BASE.length) {
            throw new Error('Invalid length code in DEFLATE stream');
          }
          /** @type {int32} */
          const lengthExtra = reader.readValue(LENGTH_EXTRA[lengthCode]);
          /** @type {int32} */
          const length = LENGTH_BASE[lengthCode] + lengthExtra;

          /** @type {int32} */
          const distanceCode = reader.readCode(5);
          if (distanceCode >= DISTANCE_BASE.length) {
            throw new Error('Invalid distance code in DEFLATE stream');
          }
          /** @type {int32} */
          const distanceExtra = reader.readValue(DISTANCE_EXTRA[distanceCode]);
          /** @type {int32} */
          const distance = DISTANCE_BASE[distanceCode] + distanceExtra;
          if (distance > output.length) {
            throw new Error('Distance exceeds available history in DEFLATE stream');
          }

          /** @type {int32} */
          const start = output.length - distance;
          for (let i = 0; i < length; i++) {
            output.push(output[start + i]);
          }
        }
      } while (last === 0);

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DeflateSimpleAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DeflateSimpleAlgorithm, DeflateSimpleInstance };
}));
