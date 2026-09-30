/*
 * Zling Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Zling (libzling, by Zhang Li / "richox") pairs a dictionary stage with
 * Huffman entropy coding to reach most of LZMA's ratio at a fraction of its
 * cost. This implementation follows the same two-stage shape: a windowed LZ77
 * pass over a bounded hash chain, serialized as a flag-byte plus payload token
 * stream, followed by canonical Huffman coding of that byte stream. Plain LZ77
 * stands in for libzling's order-1 ROLZ offset-reduction scheme.
 *
 * References:
 *   libzling                  - https://github.com/richox/libzling
 *   D. A. Huffman, "A Method for the Construction of Minimum-Redundancy
 *   Codes", Proceedings of the IRE 40(9), 1952
 *   Canonical code assignment - RFC 1951 section 3.2.2
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './huffman-code-lengths.data'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./huffman-code-lengths.data')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.HuffmanCodeLengths);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, HuffmanCodeLengths) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!HuffmanCodeLengths) {
    throw new Error('HuffmanCodeLengths dependency is required');
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

  /** @type {int32} */
  const MIN_MATCH = 3;
  /** @type {int32} */
  const MAX_MATCH = 258;
  /** @type {int32} */
  const WINDOW_SIZE = 32768;
  /** @type {int32} */
  const MAX_CHAIN = 32;
  /** @type {int32} */
  const SYMBOL_COUNT = 256;
  /** @type {int32} */
  const MAX_CODE_LENGTH = 15;

  // ===== LZ77 DICTIONARY STAGE =====

  /**
   * Latest position per exact 24-bit three-byte key (an open-addressing
   * table; it only answers lookups, so its layout cannot influence matches)
   */
  class ZlingHeadTable {
    constructor() {
      /** @type {int32[]} */
      this.keys = new Int32Array(1024).fill(-1);
      /** @type {int32[]} */
      this.positions = new Int32Array(1024);
      /** @type {int32} */
      this.mask = 1023;
      /** @type {int32} */
      this.count = 0;
    }

    /**
     * @param {int32} key - 24-bit key
     * @returns {int32} Slot holding the key, or the empty slot where it belongs
     */
    _slot(key) {
      /** @type {int32} */
      let slot = OpCodes.And32(OpCodes.Shr32(OpCodes.Mul32(key, 0x9E3779B1), 8), this.mask);
      while (this.keys[slot] !== -1 && this.keys[slot] !== key) {
        slot = OpCodes.And32(slot + 1, this.mask);
      }
      return slot;
    }

    /**
     * @param {int32} key - 24-bit key
     * @returns {int32} Latest position with this key, or -1
     */
    get(key) {
      /** @type {int32} */
      const slot = this._slot(key);
      if (this.keys[slot] === -1) {
        return -1;
      }
      return this.positions[slot];
    }

    /**
     * @param {int32} key - 24-bit key
     * @param {int32} position - Latest position with this key
     */
    set(key, position) {
      /** @type {int32} */
      const slot = this._slot(key);
      if (this.keys[slot] === -1) {
        this.keys[slot] = key;
        ++this.count;
      }
      this.positions[slot] = position;
      if (this.count * 2 > this.mask) {
        this._grow();
      }
    }

    /** Double the table and re-insert every key */
    _grow() {
      /** @type {int32[]} */
      const oldKeys = this.keys;
      /** @type {int32[]} */
      const oldPositions = this.positions;
      /** @type {int32} */
      const size = (this.mask + 1) * 2;
      this.keys = new Int32Array(size).fill(-1);
      this.positions = new Int32Array(size);
      this.mask = size - 1;
      for (let i = 0; i < oldKeys.length; i++) {
        if (oldKeys[i] !== -1) {
          /** @type {int32} */
          const slot = this._slot(oldKeys[i]);
          this.keys[slot] = oldKeys[i];
          this.positions[slot] = oldPositions[i];
        }
      }
    }
  }

  /**
   * Bounded hash-chain match finder over a sliding window, serialized as a
   * flag-byte plus payload token stream: one flag bit per token, eight tokens
   * per group, bit 0 = a literal byte follows, bit 1 = a match follows as a
   * 2-byte big-endian distance plus a 1-byte (length - MinMatch). The stream is
   * self-delimiting only together with the original length, which the caller
   * carries out of band.
   */
  class ZlingLz {
    /**
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Flag-grouped token stream
     */
    static encode(data) {
      /** @type {int32} */
      const n = data.length;
      /** @type {uint8[]} */
      const output = [];
      if (n === 0) {
        return output;
      }

      /** @type {uint8[]} */
      const payload = [];
      /** @type {ZlingHeadTable} */
      const head = new ZlingHeadTable();
      /** @type {int32[]} */
      const prev = new Int32Array(n);

      /** @type {uint32} */
      let flagBits = 0;
      /** @type {int32} */
      let flagCount = 0;

      /** @type {int32} */
      let i = 0;
      while (i < n) {
        /** @type {int32} */
        let matchLength = 0;
        /** @type {int32} */
        let matchDistance = 0;

        if (i + MIN_MATCH <= n) {
          /** @type {int32} */
          const key = ZlingLz.hash3(data, i);
          /** @type {int32} */
          let candidate = head.get(key);
          if (candidate !== -1) {
            /** @type {int32} */
            let chain = 0;
            while (candidate >= 0 && chain < MAX_CHAIN && i - candidate <= WINDOW_SIZE) {
              /** @type {int32} */
              const len = ZlingLz.commonPrefixLength(data, candidate, i, n);
              if (len > matchLength) {
                matchLength = len;
                matchDistance = i - candidate;
              }
              candidate = prev[candidate];
              ++chain;
            }
          }
        }

        if (matchLength >= MIN_MATCH) {
          /** @type {int32} */
          const insertEnd = Math.min(i + matchLength, n - MIN_MATCH + 1);
          for (let p = i; p < insertEnd; ++p) {
            ZlingLz._insertHash(data, p, head, prev);
          }

          flagBits = OpCodes.Or32(flagBits, OpCodes.Shl32(1, flagCount));
          payload.push(OpCodes.And32(OpCodes.Shr32(matchDistance, 8), 0xFF));
          payload.push(OpCodes.And32(matchDistance, 0xFF));
          payload.push(OpCodes.And32(matchLength - MIN_MATCH, 0xFF));
          ++flagCount;
          i += matchLength;
        } else {
          if (i + MIN_MATCH <= n) {
            ZlingLz._insertHash(data, i, head, prev);
          }
          payload.push(data[i]);
          ++flagCount;
          ++i;
        }

        if (flagCount === 8) {
          ZlingLz._flushGroup(output, flagBits, payload);
          flagBits = 0;
          flagCount = 0;
        }
      }

      if (flagCount > 0) {
        ZlingLz._flushGroup(output, flagBits, payload);
      }

      return output;
    }

    /**
     * Append a flag byte and its tokens, and empty the token list
     * @param {uint8[]} output - Token stream
     * @param {uint32} flagBits - Flags of the group
     * @param {uint8[]} payload - Token bytes of the group (emptied)
     */
    static _flushGroup(output, flagBits, payload) {
      output.push(OpCodes.And32(flagBits, 0xFF));
      for (let k = 0; k < payload.length; k++) {
        output.push(payload[k]);
      }
      payload.length = 0;
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @param {int32} pos - Position to insert
     * @param {ZlingHeadTable} head - Latest position per key
     * @param {int32[]} prev - Chain links
     */
    static _insertHash(data, pos, head, prev) {
      /** @type {int32} */
      const key = ZlingLz.hash3(data, pos);
      /** @type {int32} */
      const previous = head.get(key);
      prev[pos] = previous;
      head.set(key, pos);
    }

    /**
     * @param {uint8[]} intermediate - Flag-grouped token stream
     * @param {uint32} originalLength - Number of bytes to produce
     * @returns {uint8[]} Decoded bytes
     */
    static decode(intermediate, originalLength) {
      /** @type {uint8[]} */
      const result = new Array(originalLength);
      // A truncated stream yields undefined bytes and NaN lengths, which end the
      // loop exactly as the plain arithmetic always did.
      /** @type {float64} */
      let outPos = 0;
      /** @type {int32} */
      let pos = 0;

      while (outPos < originalLength) {
        /** @type {uint8} */
        const flags = intermediate[pos++];

        for (let bit = 0; bit < 8 && outPos < originalLength; ++bit) {
          if (OpCodes.And32(OpCodes.Shr32(flags, bit), 1) === 0) {
            result[outPos++] = intermediate[pos++];
            continue;
          }

          /** @type {float64} */
          const hi = intermediate[pos++];
          /** @type {float64} */
          const lo = intermediate[pos++];
          /** @type {float64} */
          const lengthCode = intermediate[pos++];
          /** @type {float64} */
          const distance = hi * 256 + lo;
          /** @type {float64} */
          const length = lengthCode + MIN_MATCH;

          /** @type {float64} */
          const src = outPos - distance;
          for (let k = 0; k < length; ++k) {
            result[outPos + k] = result[src + k];
          }
          outPos += length;
        }
      }

      return result;
    }

    /**
     * Exact 24-bit key over the three bytes at pos - collision-free by design.
     * @param {uint8[]} data - Bytes
     * @param {int32} pos - Position of the three bytes
     * @returns {int32} Key
     */
    static hash3(data, pos) {
      /** @type {int32} */
      const a = data[pos];
      /** @type {int32} */
      const b = data[pos + 1];
      /** @type {int32} */
      const c = data[pos + 2];
      return a * 65536 + b * 256 + c;
    }

    /**
     * @param {uint8[]} data - Bytes
     * @param {int32} a - Earlier position
     * @param {int32} b - Current position
     * @param {int32} n - Input length
     * @returns {int32} Common prefix length (at most MAX_MATCH)
     */
    static commonPrefixLength(data, a, b, n) {
      /** @type {int32} */
      const max = Math.min(MAX_MATCH, n - b);
      /** @type {int32} */
      let len = 0;
      while (len < max && data[a + len] === data[b + len]) {
        ++len;
      }
      return len;
    }
  }

  // ===== HUFFMAN ENTROPY STAGE =====

  // Code lengths come from the shared deterministic builder in
  // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is a
  // written rule - lighter first, then leaves before internal nodes, leaves by
  // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
  // DeterministicHuffman follows the same rule, so the two produce the same tree
  // because the algorithm says so and not because either copies the other's heap.
  class HuffmanTree {
    /**
     * Clamps code lengths to maxLength and repairs the Kraft sum: lengthening
     * the shortest code halves its contribution until the sum fits the budget,
     * then the longest codes are shortened again while spare budget remains.
     * @param {int32[]} codeLengths - Code lengths, limited in place
     * @param {int32} maxLength - Largest allowed length
     */
    static limitCodeLengths(codeLengths, maxLength) {
      /** @type {boolean} */
      let needsAdjustment = false;
      for (let i = 0; i < codeLengths.length; ++i) {
        if (codeLengths[i] > maxLength) {
          needsAdjustment = true;
          break;
        }
      }
      if (!needsAdjustment) {
        return;
      }

      // The used symbols in ascending order, with their (adjusted) lengths.
      /** @type {int32[]} */
      const usedSymbol = [];
      /** @type {int32[]} */
      const usedLength = [];
      for (let i = 0; i < codeLengths.length; ++i) {
        if (codeLengths[i] > 0) {
          usedSymbol.push(i);
          usedLength.push(codeLengths[i]);
        }
      }

      for (let i = 0; i < usedLength.length; ++i) {
        if (usedLength[i] > maxLength) {
          usedLength[i] = maxLength;
        }
      }

      /** @type {float64} */
      const kraftMax = Math.pow(2, maxLength);
      for (;;) {
        /** @type {float64} */
        const kraftSum = HuffmanTree._kraftSum(usedLength, maxLength);

        if (kraftSum <= kraftMax) {
          break;
        }

        /** @type {int32} */
        let shortestIdx = -1;
        /** @type {float64} */
        let shortestLen = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < usedLength.length; ++i) {
          if (usedLength[i] < maxLength && usedLength[i] < shortestLen) {
            shortestLen = usedLength[i];
            shortestIdx = i;
          }
        }

        if (shortestIdx < 0) {
          break; // every code already sits at maxLength
        }

        usedLength[shortestIdx] += 1;
      }

      for (;;) {
        /** @type {float64} */
        const kraftSum = HuffmanTree._kraftSum(usedLength, maxLength);

        /** @type {float64} */
        const excess = kraftMax - kraftSum;
        if (excess <= 0) {
          break;
        }

        /** @type {int32} */
        let longestIdx = -1;
        /** @type {int32} */
        let longestLen = 0;
        for (let i = 0; i < usedLength.length; ++i) {
          if (usedLength[i] > longestLen) {
            longestLen = usedLength[i];
            longestIdx = i;
          }
        }

        if (longestIdx < 0 || longestLen <= 1) {
          break;
        }

        /** @type {float64} */
        const added = Math.pow(2, maxLength - longestLen);
        if (added <= excess) {
          usedLength[longestIdx] = longestLen - 1;
        } else {
          break;
        }
      }

      for (let i = 0; i < codeLengths.length; ++i) {
        codeLengths[i] = 0;
      }
      for (let i = 0; i < usedSymbol.length; ++i) {
        codeLengths[usedSymbol[i]] = usedLength[i];
      }
    }

    /**
     * @param {int32[]} usedLength - Code length per used symbol
     * @param {int32} maxLength - Largest allowed length
     * @returns {float64} Kraft sum scaled by 2^maxLength
     */
    static _kraftSum(usedLength, maxLength) {
      /** @type {float64} */
      let kraftSum = 0;
      for (let i = 0; i < usedLength.length; ++i) {
        kraftSum += Math.pow(2, maxLength - usedLength[i]);
      }
      return kraftSum;
    }
  }

  /**
   * Canonical code table: code per symbol, code count per length, longest length
   */
  class ZlingCodeTable {
    /**
     * @param {int32[]} codes - Code per symbol
     * @param {int32[]} blCount - Number of codes per length
     * @param {int32} maxCodeLength - Longest code length
     */
    constructor(codes, blCount, maxCodeLength) {
      /** @type {int32[]} */
      this.codes = codes;
      /** @type {int32[]} */
      this.blCount = blCount;
      /** @type {int32} */
      this.maxCodeLength = maxCodeLength;
    }
  }

  /**
   * Canonical code assignment per RFC 1951 section 3.2.2, steps 1 to 3.
   * @param {int32[]} codeLengths - Code length per symbol
   * @returns {ZlingCodeTable} Canonical codes
   */
  function buildCanonicalCodes(codeLengths) {
    /** @type {int32} */
    let maxCodeLength = 0;
    for (let i = 0; i < codeLengths.length; ++i) {
      if (codeLengths[i] > maxCodeLength) {
        maxCodeLength = codeLengths[i];
      }
    }

    /** @type {int32[]} */
    const codes = new Int32Array(codeLengths.length);
    /** @type {int32[]} */
    const blCount = new Int32Array(maxCodeLength + 2);
    if (maxCodeLength === 0) {
      return new ZlingCodeTable(codes, blCount, 0);
    }

    for (let i = 0; i < codeLengths.length; ++i) {
      if (codeLengths[i] > 0) {
        ++blCount[codeLengths[i]];
      }
    }

    /** @type {int32[]} */
    const nextCode = new Int32Array(maxCodeLength + 1);
    /** @type {uint32} */
    let code = 0;
    for (let bits = 1; bits <= maxCodeLength; ++bits) {
      /** @type {int32} */
      const counted = blCount[bits - 1];
      code = OpCodes.Shl32(code + counted, 1);
      nextCode[bits] = code;
    }

    for (let symbol = 0; symbol < codeLengths.length; ++symbol) {
      /** @type {int32} */
      const len = codeLengths[symbol];
      if (len <= 0) {
        continue;
      }
      codes[symbol] = nextCode[len];
      ++nextCode[len];
    }

    return new ZlingCodeTable(codes, blCount, maxCodeLength);
  }

  /** MSB-first bit writer; the trailing partial byte is zero padded. */
  class BitWriter {
    /**
     * @param {uint8[]} output - Destination
     */
    constructor(output) {
      /** @type {uint8[]} */
      this.output = output;
      /** @type {uint32} */
      this.buffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @param {uint32} bit - Bit (only bit 0 is used)
     */
    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;

      if (this.bitsInBuffer !== 8) {
        return;
      }

      this.output.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    /** Output the partial last byte */
    flushBits() {
      if (this.bitsInBuffer <= 0) {
        return;
      }

      this.output.push(OpCodes.And32(this.buffer, 0xFF));
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }
  }

  /** MSB-first bit reader over the Huffman stream */
  class ZlingBitReader {
    /**
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} start - Position of the first bit's byte
     */
    constructor(bytes, start) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = start;
      /** @type {uint32} */
      this.bitBuffer = 0;
      /** @type {int32} */
      this.bitsInBuffer = 0;
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      if (this.bitsInBuffer === 0) {
        if (this.pos >= this.bytes.length) {
          throw new Error('Zling: unexpected end of the Huffman bit stream');
        }
        this.bitBuffer = this.bytes[this.pos++];
        this.bitsInBuffer = 8;
      }
      /** @type {uint32} */
      const bit = OpCodes.And32(OpCodes.Shr32(this.bitBuffer, 7), 1);
      this.bitBuffer = OpCodes.And32(OpCodes.Shl32(this.bitBuffer, 1), 0xFF);
      --this.bitsInBuffer;
      return bit;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZlingCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zling";
      this.description = "LZ77 dictionary matching followed by canonical Huffman entropy coding, after Zhang Li's libzling. A bounded hash-chain parser emits flag-byte grouped literal and match tokens; the resulting byte stream is Huffman coded with code lengths limited to 15 bits.";
      this.inventor = "Zhang Li (richox)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN; // China

      this.documentation = [
        new LinkItem("Zling GitHub Repository", "https://github.com/richox/libzling"),
        new LinkItem("Huffman Coding", "https://en.wikipedia.org/wiki/Huffman_coding"),
        new LinkItem("Canonical Huffman codes (RFC 1951)", "https://www.rfc-editor.org/rfc/rfc1951#section-3.2.2")
      ];

      this.references = [
        new LinkItem("libzling Source Code", "https://github.com/richox/libzling/tree/master/src"),
        new LinkItem("LZ77 and LZ78", "https://en.wikipedia.org/wiki/LZ77_and_LZ78"),
        new LinkItem("Successor: orz Compressor", "https://encode.su/threads/2923-orz-an-optimized-ROLZ-data-compressor-written-in-rust")
      ];

      // Wire format (byte-identical to CompressionWorkbench's BB_Zling):
      //   4 bytes uncompressed size (little-endian); if 0, no payload follows.
      //   4 bytes token-stream length (little-endian)
      //   256 bytes of Huffman code lengths, one per symbol value
      //   the token stream, Huffman coded MSB first, zero padded to a byte
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "https://github.com/richox/libzling",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte",
          uri: "https://github.com/richox/libzling",
          input: [65],
          expected: OpCodes.Hex8ToBytes("01000000020000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040")
        },
        {
          text: "Two different bytes",
          uri: "https://github.com/richox/libzling",
          input: [65, 66],
          expected: OpCodes.Hex8ToBytes("020000000300000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000201000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b0")
        },
        {
          text: "Simple repetition AAAA",
          uri: "https://github.com/richox/libzling",
          input: [65, 65, 65, 65],
          expected: OpCodes.Hex8ToBytes("040000000500000002020200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b100")
        },
        {
          text: "Pattern ABAB",
          uri: "https://github.com/richox/libzling",
          input: [65, 66, 65, 66],
          expected: OpCodes.Hex8ToBytes("040000000500000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000201000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b6")
        },
        {
          text: "Hello string",
          uri: "https://github.com/richox/libzling",
          input: OpCodes.AnsiToBytes("Hello"),
          expected: OpCodes.Hex8ToBytes("050000000600000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000200000000000002000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000dc58")
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {ZlingInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new ZlingInstance(this, isInverse);
    }
  }

  class ZlingInstance extends IAlgorithmInstance {
    /**
     * @param {ZlingCompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse; // true = decompress, false = compress
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        /** @type {uint8[]} */
        const decoded = this.decompress(this.inputBuffer);
        /** @type {uint8[]} */
        const freshAfterDecode = [];
        this.inputBuffer = freshAfterDecode;
        return decoded;
      }

      // Even empty input yields the fixed 4-byte size header.
      /** @type {uint8[]} */
      const result = this.compress(this.inputBuffer);
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} data - Input bytes (a missing array counts as empty)
     * @returns {uint8[]} Sizes, code lengths and Huffman-coded token stream
     */
    compress(data) {
      /** @type {uint8[]} */
      let src = data;
      if (!src) {
        src = [];
      }
      /** @type {int32} */
      const n = src.length;
      /** @type {uint8[]} */
      const output = [];

      this._pushUint32LE(output, n);
      if (n === 0) {
        return output;
      }

      /** @type {uint8[]} */
      const intermediate = ZlingLz.encode(src);
      this._pushUint32LE(output, intermediate.length);

      /** @type {int32[]} */
      const freqs = new Array(SYMBOL_COUNT);
      for (let i = 0; i < SYMBOL_COUNT; ++i) {
        freqs[i] = 0;
      }
      for (let i = 0; i < intermediate.length; ++i) {
        ++freqs[intermediate[i]];
      }

      // A one-symbol alphabet has no binary code, so borrow an unused symbol.
      /** @type {int32} */
      let nonZero = 0;
      for (let i = 0; i < SYMBOL_COUNT; ++i) {
        if (freqs[i] > 0) {
          ++nonZero;
        }
      }
      if (nonZero < 2) {
        for (let i = 0; i < SYMBOL_COUNT; ++i) {
          if (freqs[i] === 0) {
            freqs[i] = 1;
            break;
          }
        }
      }

      /** @type {int32[]} */
      const codeLengths = HuffmanCodeLengths.buildCodeLengths(freqs, SYMBOL_COUNT);
      HuffmanTree.limitCodeLengths(codeLengths, MAX_CODE_LENGTH);
      /** @type {ZlingCodeTable} */
      const table = buildCanonicalCodes(codeLengths);

      for (let i = 0; i < SYMBOL_COUNT; ++i) {
        output.push(OpCodes.And32(codeLengths[i], 0xFF));
      }

      /** @type {BitWriter} */
      const writer = new BitWriter(output);
      for (let i = 0; i < intermediate.length; ++i) {
        /** @type {uint8} */
        const symbol = intermediate[i];
        /** @type {int32} */
        const code = table.codes[symbol];
        for (let b = codeLengths[symbol] - 1; b >= 0; --b) {
          writer.writeBit(OpCodes.And32(OpCodes.Shr32(code, b), 1));
        }
      }
      writer.flushBits();

      return output;
    }

    /**
     * @param {uint8[]} data - Sizes, code lengths and Huffman-coded token stream
     * @returns {uint8[]} Decoded bytes
     */
    decompress(data) {
      /** @type {uint8[]} */
      let bytes = data;
      if (!bytes) {
        bytes = [];
      }
      if (bytes.length < 4) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (originalLength === 0) {
        /** @type {uint8[]} */
        const none = [];
        return none;
      }

      /** @type {uint32} */
      const intermediateLength = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);

      /** @type {int32[]} */
      const codeLengths = new Int32Array(SYMBOL_COUNT);
      for (let i = 0; i < SYMBOL_COUNT; ++i) {
        codeLengths[i] = bytes[8 + i];
      }

      /** @type {ZlingCodeTable} */
      const table = buildCanonicalCodes(codeLengths);

      // Canonical decode: at every length the codes form one contiguous range
      // starting at that length's first code, so accumulating bits and testing
      // the running value against the range identifies the symbol directly.
      /** @type {int32[]} */
      const firstCode = new Int32Array(table.maxCodeLength + 2);
      /** @type {int32[]} */
      const firstIndex = new Int32Array(table.maxCodeLength + 2);
      /** @type {int32[]} */
      const sortedSymbols = [];
      /** @type {uint32} */
      let code = 0;
      /** @type {int32} */
      let index = 0;
      for (let bits = 1; bits <= table.maxCodeLength; ++bits) {
        /** @type {int32} */
        const counted = table.blCount[bits - 1];
        code = OpCodes.Shl32(code + counted, 1);
        firstCode[bits] = code;
        firstIndex[bits] = index;
        index += table.blCount[bits];
      }
      for (let bits = 1; bits <= table.maxCodeLength; ++bits) {
        for (let i = 0; i < SYMBOL_COUNT; ++i) {
          if (codeLengths[i] === bits) {
            sortedSymbols.push(i);
          }
        }
      }

      /** @type {ZlingBitReader} */
      const reader = new ZlingBitReader(bytes, 8 + SYMBOL_COUNT);

      /** @type {uint8[]} */
      const intermediate = new Array(intermediateLength);
      for (let i = 0; i < intermediateLength; ++i) {
        /** @type {uint32} */
        let running = 0;
        /** @type {int32} */
        let symbol = -1;
        for (let bits = 1; bits <= table.maxCodeLength; ++bits) {
          /** @type {uint32} */
          const bit = reader.readBit();
          running = OpCodes.Or32(OpCodes.Shl32(running, 1), bit);
          /** @type {int32} */
          const count = table.blCount[bits];
          /** @type {int32} */
          const first = firstCode[bits];
          if (count > 0 && running >= first) {
            /** @type {float64} */
            const offset = running - first;
            if (offset < count) {
              symbol = sortedSymbols[firstIndex[bits] + offset];
              break;
            }
          }
        }
        if (symbol < 0) {
          throw new Error('Zling: invalid Huffman code encountered');
        }
        intermediate[i] = symbol;
      }

      /** @type {uint8[]} */
      const decoded = ZlingLz.decode(intermediate, originalLength);
      return decoded;
    }

    /**
     * @param {uint8[]} output - Output
     * @param {uint32} value - Value
     */
    _pushUint32LE(output, value) {
      output.push(OpCodes.And32(value, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 16), 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(value, 24), 0xFF));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZlingCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZlingCompression, ZlingInstance };
}));
