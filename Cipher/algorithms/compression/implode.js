/*
 * Implode (PKWARE DCL / ZIP Method 6) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PKWARE's "Imploding" method combines an LZ77-style sliding dictionary
 * match finder (8K window, minimum match length 3, distance split into a
 * raw low part and a Huffman-coded high part) with three canonical Huffman
 * trees - literal, match length, and distance high bits - built from a
 * classic frequency-merge (every symbol, including unused ones, gets a
 * length so all 256/64/64 alphabet slots are always codeable). Each tree is
 * transmitted as a run-length list of code lengths (one byte per run: low
 * nibble = length-1, high nibble = run-count-1) directly inside the same
 * LSB-first bit stream as the token data - there is no separate byte-aligned
 * header section for the trees. Canonical codes are bit-reversed before
 * being packed, so that reading the LSB-first stream front-to-back yields
 * the same prefix-free traversal as the MSB-first canonical assignment.
 * A literal/match flag bit precedes every token; for a match, the raw
 * distance low bits come first, then the Huffman-coded distance high
 * symbol, then the Huffman-coded length symbol (with an 8-bit raw extension
 * when the length code saturates at 63).
 *
 * Reference:
 *   PKWARE, Inc., ".ZIP File Format Specification" (APPNOTE.TXT), section
 *   describing compression method 6 "Imploding", and general purpose bit
 *   flag bits 1-2 for that method.
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

  // ===== ALGORITHM IMPLEMENTATION =====

  /** @type {boolean} */
  const USE_LITERAL_TREE = true;
  /** @type {boolean} */
  const USE_8K_DICTIONARY = true;
  /** @type {int32} */
  const LITERAL_SYMBOLS = 256;
  /** @type {int32} */
  const LENGTH_SYMBOLS = 64;
  /** @type {int32} */
  const DISTANCE_SYMBOLS = 64;

  // ----- Bit-level stream helpers (LSB-first) -----

  class BitWriter {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint32} */
      this.cur = 0;
      /** @type {int32} */
      this.bitPos = 0;
    }

    /**
     * @param {uint32} value - Value
     * @param {int32} count - Number of bits, least significant first
     */
    writeBits(value, count) {
      for (let i = 0; i < count; ++i) {
        /** @type {uint32} */
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        if (bit === 1) {
          this.cur = OpCodes.Or32(this.cur, OpCodes.Shl32(1, this.bitPos));
        }
        ++this.bitPos;
        if (this.bitPos === 8) {
          this.bytes.push(this.cur);
          this.cur = 0;
          this.bitPos = 0;
        }
      }
    }

    /**
     * @returns {uint8[]} All bytes, the last one zero-padded
     */
    finish() {
      if (this.bitPos > 0) {
        this.bytes.push(this.cur);
        this.cur = 0;
        this.bitPos = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    /**
     * @param {uint8[]} bytes - Source bytes (zero bits past the end)
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.pos = 0;
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      /** @type {int32} */
      const byteIdx = Math.floor(this.pos / 8);
      if (byteIdx >= this.bytes.length) {
        ++this.pos;
        return 0;
      }
      /** @type {int32} */
      const bitIdx = this.pos % 8;
      ++this.pos;
      return OpCodes.And32(OpCodes.Shr32(this.bytes[byteIdx], bitIdx), 1);
    }

    /**
     * @param {int32} count - Number of bits, least significant first
     * @returns {uint32} Value read
     */
    readBits(count) {
      /** @type {uint32} */
      let result = 0;
      for (let i = 0; i < count; ++i) {
        result = OpCodes.Or32(result, OpCodes.Shl32(this.readBit(), i));
      }
      return result;
    }
  }

  // ----- Canonical Huffman code-length / code construction -----

  /**
   * @param {int32[]} freq - Frequency per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {int32[]} Code length per symbol
   */
  function buildCodeLengths(freq, numSymbols) {
    // Every symbol must be codeable in this format, so unused ones are floored to
    // weight 1 and take part in the tree. Ties between equally weighted symbols are
    // broken by the total order documented in huffman-code-lengths.data.js.
    /** @type {int32[]} */
    const weights = new Array(numSymbols);
    for (let i = 0; i < numSymbols; ++i) {
      weights[i] = Math.max(freq[i], 1);
    }

    /** @type {int32[]} */
    const lengths = HuffmanCodeLengths.buildCodeLengths(weights, numSymbols);

    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (lengths[i] > maxLen) {
        maxLen = lengths[i];
      }
    }
    if (maxLen > 16) {
      /** @type {int32} */
      let bits = 1;
      while (OpCodes.Shl32(1, bits) < numSymbols) {
        ++bits;
      }
      for (let i = 0; i < numSymbols; ++i) {
        lengths[i] = bits;
      }
    }

    return lengths;
  }

  /**
   * @param {uint32} value - Code
   * @param {int32} count - Number of bits
   * @returns {uint32} The count low bits in reverse order
   */
  function reverseBits(value, count) {
    /** @type {uint32} */
    let result = 0;
    /** @type {uint32} */
    let rest = value;
    for (let i = 0; i < count; ++i) {
      result = OpCodes.Or32(OpCodes.Shl32(result, 1), OpCodes.And32(rest, 1));
      rest = OpCodes.Shr32(rest, 1);
    }
    return result;
  }

  /**
   * Canonical codes of one alphabet, bit-reversed for the LSB-first stream
   */
  class ImplodeCodes {
    /**
     * @param {int32} numSymbols - Alphabet size
     */
    constructor(numSymbols) {
      /** @type {uint32[]} */
      this.code = new Array(numSymbols);
      /** @type {int32[]} */
      this.bits = new Array(numSymbols);
    }
  }

  // Canonical assignment (MSB-first code order), then each code is
  // bit-reversed so it reads correctly from the LSB-first stream.
  /**
   * @param {int32[]} codeLengths - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   * @returns {ImplodeCodes} Codes
   */
  function buildCodes(codeLengths, numSymbols) {
    /** @type {int32} */
    let maxLen = 0;
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLengths[i] > maxLen) {
        maxLen = codeLengths[i];
      }
    }
    if (maxLen === 0) {
      maxLen = 1;
    }

    /** @type {int32[]} */
    const blCount = new Array(maxLen + 1);
    /** @type {uint32[]} */
    const nextCode = new Array(maxLen + 1);
    for (let b = 0; b <= maxLen; ++b) {
      blCount[b] = 0;
      nextCode[b] = 0;
    }
    for (let i = 0; i < numSymbols; ++i) {
      if (codeLengths[i] > 0) {
        ++blCount[codeLengths[i]];
      }
    }

    /** @type {uint32} */
    let code = 0;
    for (let b = 1; b <= maxLen; ++b) {
      /** @type {int32} */
      const counted = blCount[b - 1];
      code = OpCodes.Shl32(code + counted, 1);
      nextCode[b] = code;
    }

    /** @type {ImplodeCodes} */
    const codes = new ImplodeCodes(numSymbols);
    for (let sym = 0; sym < numSymbols; ++sym) {
      /** @type {int32} */
      const len = codeLengths[sym];
      if (len === 0) {
        codes.code[sym] = 0;
        codes.bits[sym] = 0;
        continue;
      }
      /** @type {uint32} */
      const raw = nextCode[len]++;
      codes.code[sym] = reverseBits(raw, len);
      codes.bits[sym] = len;
    }
    return codes;
  }

  /**
   * Decode-trie node; a missing branch is null
   */
  class ImplodeTrieNode {
    constructor() {
      /** @type {int32} */
      this.sym = -1;
      /** @type {ImplodeTrieNode} */
      this.c0 = null;
      /** @type {ImplodeTrieNode} */
      this.c1 = null;
    }
  }

  class DecodeTrie {
    /**
     * @param {ImplodeCodes} codes - Codes of the alphabet
     * @param {int32} numSymbols - Alphabet size
     */
    constructor(codes, numSymbols) {
      /** @type {ImplodeTrieNode} */
      this.root = new ImplodeTrieNode();
      for (let s = 0; s < numSymbols; ++s) {
        /** @type {int32} */
        const bits = codes.bits[s];
        if (bits === 0) {
          continue;
        }
        /** @type {uint32} */
        const code = codes.code[s];
        /** @type {ImplodeTrieNode} */
        let node = this.root;
        // Codes were bit-reversed for LSB-first transmission, so walking the
        // trie bit-by-bit as each bit is *read* means consuming the reversed
        // code's bits from bit 0 upward - i.e. in the same order they were written.
        for (let i = 0; i < bits; ++i) {
          /** @type {uint32} */
          const bit = OpCodes.And32(OpCodes.Shr32(code, i), 1);
          if (bit === 0) {
            if (node.c0 === null) {
              node.c0 = new ImplodeTrieNode();
            }
            node = node.c0;
          } else {
            if (node.c1 === null) {
              node.c1 = new ImplodeTrieNode();
            }
            node = node.c1;
          }
        }
        node.sym = s;
      }
    }

    /**
     * @param {BitReader} reader - Input bits
     * @returns {int32} Decoded symbol
     */
    decode(reader) {
      /** @type {ImplodeTrieNode} */
      let node = this.root;
      while (node.sym === -1) {
        /** @type {uint32} */
        const bit = reader.readBit();
        if (bit === 0) {
          node = node.c0;
        } else {
          node = node.c1;
        }
      }
      return node.sym;
    }
  }

  // ----- Code-length table (run-length) serialization, inline in the bitstream -----

  /**
   * @param {BitWriter} writer - Output bits
   * @param {int32[]} lengths - Code length per symbol
   * @param {int32} numSymbols - Alphabet size
   */
  function writeSfTree(writer, lengths, numSymbols) {
    /** @type {int32[]} */
    const runLength = [];
    /** @type {int32[]} */
    const runCount = [];
    /** @type {int32} */
    let i = 0;
    while (i < numSymbols) {
      /** @type {int32} */
      const len = lengths[i];
      /** @type {int32} */
      let count = 1;
      while (i + count < numSymbols && lengths[i + count] === len && count < 16) {
        ++count;
      }
      runLength.push(len > 0 ? len - 1 : 0);
      runCount.push(count);
      i += count;
    }
    writer.writeBits(runLength.length - 1, 8);
    for (let r = 0; r < runLength.length; r++) {
      writer.writeBits(OpCodes.Or32(runLength[r], OpCodes.Shl32(runCount[r] - 1, 4)), 8);
    }
  }

  /**
   * @param {BitReader} reader - Input bits
   * @param {int32} numSymbols - Alphabet size
   * @returns {int32[]} Code length per symbol (0 past the last run)
   */
  function readSfTree(reader, numSymbols) {
    /** @type {int32} */
    const numEntries = OpCodes.Add32(reader.readBits(8), 1);
    /** @type {int32[]} */
    const lengths = new Array(numSymbols);
    for (let k = 0; k < numSymbols; k++) {
      lengths[k] = 0;
    }
    /** @type {int32} */
    let idx = 0;
    for (let i = 0; i < numEntries && idx < numSymbols; ++i) {
      /** @type {uint32} */
      const val = reader.readBits(8);
      /** @type {int32} */
      const len = OpCodes.And32(val, 0x0F) + 1;
      /** @type {int32} */
      const count = OpCodes.Shr32(val, 4) + 1;
      for (let j = 0; j < count && idx < numSymbols; ++j) {
        lengths[idx++] = len;
      }
    }
    return lengths;
  }

  /**
   * One parsed token: a literal byte or a (length, distance - 1) match
   */
  class ImplodeToken {
    /**
     * @param {boolean} isLit - True for a literal
     * @param {uint8} lit - Literal byte (0 for a match)
     * @param {int32} len - Match length (0 for a literal)
     * @param {int32} dist - Match distance minus one (0 for a literal)
     */
    constructor(isLit, lit, len, dist) {
      /** @type {boolean} */
      this.isLit = isLit;
      /** @type {uint8} */
      this.lit = lit;
      /** @type {int32} */
      this.len = len;
      /** @type {int32} */
      this.dist = dist;
    }
  }

  /**
 * ImplodeCompression - PKWARE "Imploding" (LZ77 + canonical Huffman) algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ImplodeCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Implode";
        this.description = "PKWARE DCL/ZIP method 6 (Imploding): an 8K sliding-dictionary LZ77 matcher (minimum match length 3) whose literal, length, and distance-high symbols are entropy-coded with three canonical Huffman trees (a raw distance-low field is sent separately).";
        this.inventor = "PKWARE, Inc.";
        this.year = 1989;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary + Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.EXPERT;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
          new LinkItem("ZIP (file format) - Wikipedia (Imploding method)", "https://en.wikipedia.org/wiki/ZIP_(file_format)"),
          new LinkItem("Shannon-Fano coding - Wikipedia", "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding")
        ];

        this.references = [
          new LinkItem("StormLib / implode-decoder (historical decoder notes)", "https://github.com/ShieldBattery/implode-decoder"),
          new LinkItem("LZ77 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
        ];

        this.tests = [
          {
            text: "Empty input",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [],
            expected: [0, 0, 0, 0, 3]
          },
          {
            text: "Single byte",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: [0x41],
            expected: [1,0,0,0,3,15,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,3,245,245,245,245,3,245,245,245,245,5,1]
          },
          {
            text: "256 repeated bytes",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: new Array(256).fill(0x61),
            expected: [0,1,0,0,3,15,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,3,245,245,245,245,3,245,245,245,245,13,1,128,191,23]
          },
          {
            text: "Text sample repeated 4x",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
            expected: [180,0,0,0,3,18,120,247,119,5,247,247,247,247,215,6,247,247,247,247,247,247,247,247,247,3,245,245,245,245,5,4,22,245,245,245,197,29,154,54,10,180,237,216,172,65,139,64,253,118,65,157,91,7,26,7,117,9,52,239,216,170,77,251,64,80,167,70,237,2,60,0,108,89,175,91,215,64,195,160,38,169,53,0,132,5,254,32]
          },
          {
            text: "All 256 byte values",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: Array.from({ length: 256 }, (_, i) => i),
            expected: [0,1,0,0,3,15,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,247,3,245,245,245,245,3,245,245,245,245,1,2,6,10,28,36,104,176,224,33,66,134,10,29,38,108,184,240,17,34,70,138,28,37,106,180,232,49,98,198,138,29,39,110,188,248,9,18,38,74,156,36,105,178,228,41,82,166,74,157,38,109,186,244,25,50,102,202,156,37,107,182,236,57,114,230,202,157,39,111,190,252,5,10,22,42,92,164,104,177,226,37,74,150,42,93,166,108,185,242,21,42,86,170,92,165,106,181,234,53,106,214,170,93,167,110,189,250,13,26,54,106,220,164,105,179,230,45,90,182,106,221,166,109,187,246,29,58,118,234,220,165,107,183,238,61,122,246,234,221,167,111,191,254,3,6,14,26,60,100,232,176,225,35,70,142,26,61,102,236,184,241,19,38,78,154,60,101,234,180,233,51,102,206,154,61,103,238,188,249,11,22,46,90,188,100,233,178,229,43,86,174,90,189,102,237,186,245,27,54,110,218,188,101,235,182,237,59,118,238,218,189,103,239,190,253,7,14,30,58,124,228,232,177,227,39,78,158,58,125,230,236,185,243,23,46,94,186,124,229,234,181,235,55,110,222,186,125,231,238,189,251,15,30,62,122,252,228,233,179,231,47,94,190,122,253,230,237,187,247,31,62,126,250,252,229,235,183,239,63,126,254,250,253,231,239,191,255]
          }
        ];
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {ImplodeInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new ImplodeInstance(this, isInverse);
      }
    }

    class ImplodeInstance extends IAlgorithmInstance {
      /**
       * @param {ImplodeCompression} algorithm - Parent algorithm
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
        const data = this.inputBuffer;
        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        if (this.isInverse) {
          return this._decompress(data);
        }
        return this._compress(data);
      }

      // ----- LZ77 parse over the sliding dictionary -----

      /**
       * @param {uint8[]} data - Input bytes
       * @param {int32} windowSize - Largest distance
       * @param {int32} minMatchLen - Smallest match length
       * @param {int32} maxMatchLen - Largest match length
       * @returns {ImplodeToken[]} Tokens
       */
      _parse(data, windowSize, minMatchLen, maxMatchLen) {
        /** @type {ImplodeToken[]} */
        const tokens = [];
        /** @type {int32} */
        let i = 0;
        while (i < data.length) {
          /** @type {int32} */
          let bestLen = 0;
          /** @type {int32} */
          let bestDist = 0;
          /** @type {int32} */
          const searchStart = Math.max(0, i - windowSize);
          for (let j = searchStart; j < i; ++j) {
            /** @type {int32} */
            let len = 0;
            /** @type {int32} */
            const maxLen = Math.min(data.length - i, maxMatchLen);
            /** @type {int32} */
            const span = i - j;
            while (len < maxLen && data[j + (len % span)] === data[i + len]) {
              ++len;
            }
            if (len > bestLen && len >= minMatchLen) {
              bestLen = len;
              bestDist = i - j - 1;
            }
          }
          if (bestLen >= minMatchLen) {
            tokens.push(new ImplodeToken(false, 0, bestLen, bestDist));
            i += bestLen;
          } else {
            tokens.push(new ImplodeToken(true, data[i], 0, 0));
            i += 1;
          }
        }
        return tokens;
      }

      // ----- Compression -----

      /**
       * @param {uint8[]} data - Input bytes
       * @param {boolean} useLiteralTree - Code literals with their own tree
       * @param {boolean} use8kDictionary - Use the 8 KiB window
       * @returns {uint8[]} Trees and coded tokens
       */
      _encode(data, useLiteralTree, use8kDictionary) {
        /** @type {int32} */
        const distanceBits = use8kDictionary ? 7 : 6;
        /** @type {int32} */
        const minMatchLen = useLiteralTree ? 3 : 2;
        /** @type {int32} */
        const windowSize = use8kDictionary ? 8192 : 4096;

        /** @type {ImplodeToken[]} */
        const tokens = this._parse(data, windowSize, minMatchLen, 63 + 255 + minMatchLen);

        /** @type {int32[]} */
        const literalFreq = new Int32Array(LITERAL_SYMBOLS);
        /** @type {int32[]} */
        const lengthFreq = new Int32Array(LENGTH_SYMBOLS);
        /** @type {int32[]} */
        const distanceFreq = new Int32Array(DISTANCE_SYMBOLS);

        for (let n = 0; n < tokens.length; n++) {
          /** @type {ImplodeToken} */
          const t = tokens[n];
          if (t.isLit) {
            literalFreq[t.lit]++;
          } else {
            /** @type {int32} */
            const lenCode = Math.min(t.len - minMatchLen, 63);
            /** @type {int32} */
            const distHigh = OpCodes.Shr32(t.dist, distanceBits);
            lengthFreq[lenCode]++;
            if (distHigh < 64) {
              distanceFreq[distHigh]++;
            }
          }
        }

        /** @type {int32[]} */
        let literalLengths = null;
        /** @type {ImplodeCodes} */
        let literalCodes = null;
        if (useLiteralTree) {
          literalLengths = buildCodeLengths(literalFreq, LITERAL_SYMBOLS);
        }
        /** @type {int32[]} */
        const lengthLengths = buildCodeLengths(lengthFreq, LENGTH_SYMBOLS);
        /** @type {int32[]} */
        const distanceLengths = buildCodeLengths(distanceFreq, DISTANCE_SYMBOLS);

        if (useLiteralTree) {
          literalCodes = buildCodes(literalLengths, LITERAL_SYMBOLS);
        }
        /** @type {ImplodeCodes} */
        const lengthCodes = buildCodes(lengthLengths, LENGTH_SYMBOLS);
        /** @type {ImplodeCodes} */
        const distanceCodes = buildCodes(distanceLengths, DISTANCE_SYMBOLS);

        /** @type {BitWriter} */
        const writer = new BitWriter();

        if (useLiteralTree) {
          writeSfTree(writer, literalLengths, LITERAL_SYMBOLS);
        }
        writeSfTree(writer, lengthLengths, LENGTH_SYMBOLS);
        writeSfTree(writer, distanceLengths, DISTANCE_SYMBOLS);

        for (let n = 0; n < tokens.length; n++) {
          /** @type {ImplodeToken} */
          const t = tokens[n];
          if (t.isLit) {
            writer.writeBits(1, 1);
            if (useLiteralTree) {
              writer.writeBits(literalCodes.code[t.lit], literalCodes.bits[t.lit]);
            } else {
              writer.writeBits(t.lit, 8);
            }
          } else {
            writer.writeBits(0, 1);
            /** @type {uint32} */
            const distLow = OpCodes.And32(t.dist, OpCodes.Shl32(1, distanceBits) - 1);
            /** @type {int32} */
            const distHigh = OpCodes.Shr32(t.dist, distanceBits);
            /** @type {int32} */
            const lenCode = Math.min(t.len - minMatchLen, 63);

            writer.writeBits(distLow, distanceBits);
            /** @type {int32} */
            const distanceSymbol = distHigh < 64 ? distHigh : 0;
            writer.writeBits(distanceCodes.code[distanceSymbol], distanceCodes.bits[distanceSymbol]);
            writer.writeBits(lengthCodes.code[lenCode], lengthCodes.bits[lenCode]);
            if (lenCode === 63) {
              /** @type {int32} */
              const extra = Math.min(t.len - minMatchLen - 63, 255);
              writer.writeBits(extra, 8);
            }
          }
        }

        /** @type {uint8[]} */
        const bits = writer.finish();
        return bits;
      }

      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Size, flags and body
       */
      _compress(data) {
        /** @type {uint8[]} */
        let body = [];
        if (data.length !== 0) {
          body = this._encode(data, USE_LITERAL_TREE, USE_8K_DICTIONARY);
        }
        /** @type {uint8[]} */
        const output = [];
        /** @type {uint32} */
        const len32 = OpCodes.ToUint32(data.length);
        output.push(OpCodes.And32(len32, 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(len32, 8), 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(len32, 16), 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(len32, 24), 0xFF));
        output.push(OpCodes.Or32(USE_LITERAL_TREE ? 1 : 0, USE_8K_DICTIONARY ? 2 : 0));
        for (let i = 0; i < body.length; ++i) {
          output.push(body[i]);
        }
        return output;
      }

      // ----- Decompression -----

      /**
       * @param {uint8[]} compressed - Trees and coded tokens
       * @param {int32} originalSize - Size from the header (negative decodes nothing)
       * @param {boolean} hasLiteralTree - Literals have their own tree
       * @param {boolean} is8kDictionary - The 8 KiB window is used
       * @returns {uint8[]} Decoded bytes
       */
      _decode(compressed, originalSize, hasLiteralTree, is8kDictionary) {
        /** @type {int32} */
        const distanceBits = is8kDictionary ? 7 : 6;
        /** @type {int32} */
        const minMatchLen = hasLiteralTree ? 3 : 2;

        /** @type {BitReader} */
        const reader = new BitReader(compressed);

        /** @type {DecodeTrie} */
        let literalTrie = null;
        if (hasLiteralTree) {
          /** @type {int32[]} */
          const literalLengths = readSfTree(reader, LITERAL_SYMBOLS);
          literalTrie = new DecodeTrie(buildCodes(literalLengths, LITERAL_SYMBOLS), LITERAL_SYMBOLS);
        }
        /** @type {int32[]} */
        const lengthLengths = readSfTree(reader, LENGTH_SYMBOLS);
        /** @type {DecodeTrie} */
        const lengthTrie = new DecodeTrie(buildCodes(lengthLengths, LENGTH_SYMBOLS), LENGTH_SYMBOLS);
        /** @type {int32[]} */
        const distanceLengths = readSfTree(reader, DISTANCE_SYMBOLS);
        /** @type {DecodeTrie} */
        const distanceTrie = new DecodeTrie(buildCodes(distanceLengths, DISTANCE_SYMBOLS), DISTANCE_SYMBOLS);

        /** @type {uint8[]} */
        const out = [];
        while (out.length < originalSize) {
          /** @type {uint32} */
          const flag = reader.readBit();
          if (flag === 1) {
            /** @type {int32} */
            let b = 0;
            if (hasLiteralTree) {
              b = literalTrie.decode(reader);
            } else {
              b = reader.readBits(8);
            }
            out.push(b);
          } else {
            /** @type {uint32} */
            const distLow = reader.readBits(distanceBits);
            /** @type {int32} */
            const distHigh = distanceTrie.decode(reader);
            /** @type {int32} */
            const distance = OpCodes.Or32(OpCodes.Shl32(distHigh, distanceBits), distLow);

            /** @type {int32} */
            const lenCode = lengthTrie.decode(reader);
            /** @type {int32} */
            let length = lenCode + minMatchLen;
            if (lenCode === 63) {
              /** @type {int32} */
              const extra = reader.readBits(8);
              length += extra;
            }

            /** @type {int32} */
            const srcPos = out.length - distance - 1;
            for (let k = 0; k < length && out.length < originalSize; ++k) {
              /** @type {int32} */
              const src = srcPos + k;
              out.push(src >= 0 && src < out.length ? out[src] : 0);
            }
          }
        }

        return out;
      }

      /**
       * @param {uint8[]} data - Size, flags and body
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        if (data.length < 5) {
          throw new Error('Implode: input smaller than 5-byte header');
        }
        // The size is read as a signed 32-bit value, as in the reference.
        /** @type {int32} */
        const size = OpCodes.ToInt(OpCodes.Or32(
          OpCodes.Or32(OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Shl32(data[2], 16)),
          OpCodes.Shl32(data[3], 24)
        ));
        /** @type {uint8} */
        const flags = data[4];
        if (size === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        /** @type {boolean} */
        const hasLiteralTree = OpCodes.And32(flags, 1) !== 0;
        /** @type {boolean} */
        const is8kDictionary = OpCodes.And32(flags, 2) !== 0;
        /** @type {uint8[]} */
        const decoded = this._decode(data.slice(5), size, hasLiteralTree, is8kDictionary);
        return decoded;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ImplodeCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ImplodeCompression, ImplodeInstance };
}));
