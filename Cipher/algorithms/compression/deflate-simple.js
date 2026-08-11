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

  const POW2 = (() => {
    const powers = new Array(17);
    powers[0] = 1;
    for (let i = 1; i < powers.length; i++) powers[i] = powers[i - 1] * 2;
    return powers;
  })();

  // Length codes 257..285: base length and number of extra bits.
  const LENGTH_CODES = [
    { base: 3, extra: 0 }, { base: 4, extra: 0 }, { base: 5, extra: 0 }, { base: 6, extra: 0 },
    { base: 7, extra: 0 }, { base: 8, extra: 0 }, { base: 9, extra: 0 }, { base: 10, extra: 0 },
    { base: 11, extra: 1 }, { base: 13, extra: 1 }, { base: 15, extra: 1 }, { base: 17, extra: 1 },
    { base: 19, extra: 2 }, { base: 23, extra: 2 }, { base: 27, extra: 2 }, { base: 31, extra: 2 },
    { base: 35, extra: 3 }, { base: 43, extra: 3 }, { base: 51, extra: 3 }, { base: 59, extra: 3 },
    { base: 67, extra: 4 }, { base: 83, extra: 4 }, { base: 99, extra: 4 }, { base: 115, extra: 4 },
    { base: 131, extra: 5 }, { base: 163, extra: 5 }, { base: 195, extra: 5 }, { base: 227, extra: 5 },
    { base: 258, extra: 0 }
  ];

  // Distance codes 0..29: base distance and number of extra bits.
  const DISTANCE_CODES = [
    { base: 1, extra: 0 }, { base: 2, extra: 0 }, { base: 3, extra: 0 }, { base: 4, extra: 0 },
    { base: 5, extra: 1 }, { base: 7, extra: 1 }, { base: 9, extra: 2 }, { base: 13, extra: 2 },
    { base: 17, extra: 3 }, { base: 25, extra: 3 }, { base: 33, extra: 4 }, { base: 49, extra: 4 },
    { base: 65, extra: 5 }, { base: 97, extra: 5 }, { base: 129, extra: 6 }, { base: 193, extra: 6 },
    { base: 257, extra: 7 }, { base: 385, extra: 7 }, { base: 513, extra: 8 }, { base: 769, extra: 8 },
    { base: 1025, extra: 9 }, { base: 1537, extra: 9 }, { base: 2049, extra: 10 }, { base: 3073, extra: 10 },
    { base: 4097, extra: 11 }, { base: 6145, extra: 11 }, { base: 8193, extra: 12 }, { base: 12289, extra: 12 },
    { base: 16385, extra: 13 }, { base: 24577, extra: 13 }
  ];

  const END_OF_BLOCK = 256;
  const WINDOW_SIZE = 32768;
  const MIN_MATCH = 3;
  const MAX_MATCH = 258;
  const MAX_CHAIN = 32;      // bound on hash-chain probes per position
  const HASH_SIZE = 65536;

  // Fixed literal/length alphabet (RFC 1951 section 3.2.6):
  //   0..143   8 bits, codes 0x30..0xBF
  //   144..255 9 bits, codes 0x190..0x1FF
  //   256..279 7 bits, codes 0x00..0x17
  //   280..287 8 bits, codes 0xC0..0xC7
  function fixedLiteralCode(symbol) {
    if (symbol <= 143) return { code: 48 + symbol, bits: 8 };
    if (symbol <= 255) return { code: 400 + symbol - 144, bits: 9 };
    if (symbol <= 279) return { code: symbol - 256, bits: 7 };
    return { code: 192 + symbol - 280, bits: 8 };
  }

  // Length 3..258 -> index into LENGTH_CODES, precomputed once.
  const LENGTH_TO_CODE = (() => {
    const map = new Array(MAX_MATCH + 1).fill(0);
    for (let code = 0; code < LENGTH_CODES.length; code++) {
      const next = code + 1 < LENGTH_CODES.length ? LENGTH_CODES[code + 1].base : MAX_MATCH + 1;
      for (let length = LENGTH_CODES[code].base; length < next && length <= MAX_MATCH; length++) {
        map[length] = code;
      }
    }
    map[MAX_MATCH] = LENGTH_CODES.length - 1;
    return map;
  })();

  function distanceToCode(distance) {
    for (let code = DISTANCE_CODES.length - 1; code >= 0; code--) {
      if (distance >= DISTANCE_CODES[code].base) return code;
    }
    return 0;
  }

  // ===== BIT PLUMBING =====

  // RFC 1951 section 3.1.1: data elements other than Huffman codes are packed
  // starting with the least significant bit; Huffman codes are packed starting
  // with the most significant bit. Bytes fill from the least significant bit.
  class BitWriter {
    constructor() {
      this.bytes = [];
      this.partial = 0;
      this.used = 0;
    }

    writeBit(bit) {
      if (bit) this.partial = OpCodes.SetBit(this.partial, this.used, true);
      this.used++;
      if (this.used === 8) {
        this.bytes.push(this.partial);
        this.partial = 0;
        this.used = 0;
      }
    }

    writeValue(value, bits) {
      for (let i = 0; i < bits; i++) this.writeBit(Math.floor(value / POW2[i]) % 2);
    }

    writeCode(code, bits) {
      for (let i = bits - 1; i >= 0; i--) this.writeBit(Math.floor(code / POW2[i]) % 2);
    }

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
    constructor(data) {
      this.data = data;
      this.byteIndex = 0;
      this.bitIndex = 0;
    }

    readBit() {
      if (this.byteIndex >= this.data.length) throw new Error('Truncated DEFLATE stream');
      const bit = OpCodes.GetBit(this.data[this.byteIndex], this.bitIndex) ? 1 : 0;
      this.bitIndex++;
      if (this.bitIndex === 8) {
        this.bitIndex = 0;
        this.byteIndex++;
      }
      return bit;
    }

    readValue(bits) {
      let value = 0;
      for (let i = 0; i < bits; i++) value += this.readBit() * POW2[i];
      return value;
    }

    readCode(bits) {
      let code = 0;
      for (let i = 0; i < bits; i++) code = code * 2 + this.readBit();
      return code;
    }

    alignToByte() {
      if (this.bitIndex !== 0) {
        this.bitIndex = 0;
        this.byteIndex++;
      }
    }
  }

  // Fixed literal/length decoding by code length, exploiting the fact that the
  // fixed alphabet is canonical and its code ranges do not overlap.
  function readFixedLiteral(reader) {
    let code = reader.readCode(7);
    if (code <= 23) return 256 + code;

    code = code * 2 + reader.readBit();
    if (code >= 48 && code <= 191) return code - 48;
    if (code >= 192 && code <= 199) return 280 + code - 192;

    code = code * 2 + reader.readBit();
    if (code >= 400 && code <= 511) return 144 + code - 400;

    throw new Error('Invalid fixed Huffman code in DEFLATE stream');
  }

  // ===== LZ77 =====

  function hashAt(data, position) {
    return (data[position] * 4093 + data[position + 1] * 257 + data[position + 2]) % HASH_SIZE;
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

    CreateInstance(isInverse = false) {
      return new DeflateSimpleInstance(this, isInverse);
    }
  }

  class DeflateSimpleInstance extends IAlgorithmInstance {
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
        // An empty buffer is not a valid DEFLATE stream: even an empty message
        // costs the two bytes of a final fixed block.
        if (this.inputBuffer.length === 0) return [];
        return this._decompress();
      }
      return this._compress();
    }

    _compress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      const writer = new BitWriter();

      // One final block, fixed Huffman codes.
      writer.writeBit(1);
      writer.writeValue(1, 2);

      const head = new Int32Array(HASH_SIZE).fill(-1);
      const prev = new Int32Array(data.length > 0 ? data.length : 1).fill(-1);

      let position = 0;
      while (position < data.length) {
        let matchLength = 0;
        let matchDistance = 0;

        if (position + MIN_MATCH <= data.length) {
          const found = this._findMatch(data, position, head, prev, hashAt(data, position));
          matchLength = found.length;
          matchDistance = found.distance;
        }

        if (matchLength >= MIN_MATCH) {
          const lengthCode = LENGTH_TO_CODE[matchLength];
          const lengthSymbol = fixedLiteralCode(257 + lengthCode);
          writer.writeCode(lengthSymbol.code, lengthSymbol.bits);
          writer.writeValue(matchLength - LENGTH_CODES[lengthCode].base, LENGTH_CODES[lengthCode].extra);

          const distanceCode = distanceToCode(matchDistance);
          writer.writeCode(distanceCode, 5);
          writer.writeValue(matchDistance - DISTANCE_CODES[distanceCode].base, DISTANCE_CODES[distanceCode].extra);

          for (let i = 0; i < matchLength; i++) this._insert(data, position + i, head, prev);
          position += matchLength;
        } else {
          const literal = fixedLiteralCode(data[position]);
          writer.writeCode(literal.code, literal.bits);
          this._insert(data, position, head, prev);
          position++;
        }
      }

      const terminator = fixedLiteralCode(END_OF_BLOCK);
      writer.writeCode(terminator.code, terminator.bits);

      return writer.finish();
    }

    _insert(data, position, head, prev) {
      if (position + MIN_MATCH > data.length) return;
      const bucket = hashAt(data, position);
      prev[position] = head[bucket];
      head[bucket] = position;
    }

    _findMatch(data, position, head, prev, bucket) {
      const maxLength = Math.min(MAX_MATCH, data.length - position);
      if (maxLength < MIN_MATCH) return { length: 0, distance: 0 };

      const oldest = position - WINDOW_SIZE;
      let best = 0;
      let bestDistance = 0;
      let candidate = head[bucket];
      let probes = MAX_CHAIN;

      while (candidate >= 0 && candidate > oldest && probes > 0) {
        probes--;
        if (data[candidate + best] === data[position + best]) {
          let length = 0;
          while (length < maxLength && data[candidate + length] === data[position + length]) length++;
          if (length > best) {
            best = length;
            bestDistance = position - candidate;
            if (length === maxLength) break;
          }
        }
        candidate = prev[candidate];
      }

      if (best < MIN_MATCH) return { length: 0, distance: 0 };
      return { length: best, distance: bestDistance };
    }

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      const reader = new BitReader(data);
      const output = [];
      let last = 0;

      do {
        last = reader.readBit();
        const blockType = reader.readValue(2);

        if (blockType === 0) {
          reader.alignToByte();
          const storedLength = reader.readValue(16);
          reader.readValue(16); // one's complement of the length
          for (let i = 0; i < storedLength; i++) output.push(reader.readValue(8));
          continue;
        }

        if (blockType !== 1) {
          throw new Error('Simplified Deflate reads stored and fixed-Huffman blocks only');
        }

        for (;;) {
          const symbol = readFixedLiteral(reader);
          if (symbol === END_OF_BLOCK) break;

          if (symbol < END_OF_BLOCK) {
            output.push(symbol);
            continue;
          }

          const lengthCode = symbol - 257;
          if (lengthCode >= LENGTH_CODES.length) {
            throw new Error('Invalid length code in DEFLATE stream');
          }
          const length = LENGTH_CODES[lengthCode].base + reader.readValue(LENGTH_CODES[lengthCode].extra);

          const distanceCode = reader.readCode(5);
          if (distanceCode >= DISTANCE_CODES.length) {
            throw new Error('Invalid distance code in DEFLATE stream');
          }
          const distance = DISTANCE_CODES[distanceCode].base + reader.readValue(DISTANCE_CODES[distanceCode].extra);
          if (distance > output.length) {
            throw new Error('Distance exceeds available history in DEFLATE stream');
          }

          const start = output.length - distance;
          for (let i = 0; i < length; i++) output.push(output[start + i]);
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
