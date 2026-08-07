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

  // ===== FORMAT CONSTANTS =====

  const MIN_MATCH = 3;
  const MAX_MATCH = 258;
  const WINDOW_SIZE = 32768;
  const MAX_CHAIN = 32;
  const SYMBOL_COUNT = 256;
  const MAX_CODE_LENGTH = 15;

  // ===== LZ77 DICTIONARY STAGE =====

  /**
   * Bounded hash-chain match finder over a sliding window, serialized as a
   * flag-byte plus payload token stream: one flag bit per token, eight tokens
   * per group, bit 0 = a literal byte follows, bit 1 = a match follows as a
   * 2-byte big-endian distance plus a 1-byte (length - MinMatch). The stream is
   * self-delimiting only together with the original length, which the caller
   * carries out of band.
   */
  const ZlingLz = {
    encode(data) {
      const n = data.length;
      if (n === 0)
        return [];

      const output = [];
      let payload = [];
      const head = new Map();
      const prev = new Int32Array(n);

      let flagBits = 0;
      let flagCount = 0;

      const flushGroup = () => {
        output.push(flagBits&0xFF);
        for (let _i = 0; _i < payload.length; _i++) output.push(payload[_i]);
        payload = [];
        flagBits = 0;
        flagCount = 0;
      };

      const insertHash = pos => {
        const key = ZlingLz.hash3(data, pos);
        const existing = head.get(key);
        prev[pos] = existing === undefined ? -1 : existing;
        head.set(key, pos);
      };

      let i = 0;
      while (i < n) {
        let matchLength = 0;
        let matchDistance = 0;

        if (i + MIN_MATCH <= n) {
          const key = ZlingLz.hash3(data, i);
          let candidate = head.get(key);
          if (candidate !== undefined) {
            let chain = 0;
            while (candidate >= 0 && chain < MAX_CHAIN && i - candidate <= WINDOW_SIZE) {
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
          const insertEnd = Math.min(i + matchLength, n - MIN_MATCH + 1);
          for (let p = i; p < insertEnd; ++p)
            insertHash(p);

          flagBits = OpCodes.Or32(flagBits, OpCodes.Shl32(1, flagCount));
          payload.push(OpCodes.Shr32(matchDistance, 8)&0xFF);
          payload.push(matchDistance&0xFF);
          payload.push((matchLength - MIN_MATCH)&0xFF);
          ++flagCount;
          i += matchLength;
        } else {
          if (i + MIN_MATCH <= n)
            insertHash(i);
          payload.push(data[i]);
          ++flagCount;
          ++i;
        }

        if (flagCount === 8)
          flushGroup();
      }

      if (flagCount > 0)
        flushGroup();

      return output;
    },

    decode(intermediate, originalLength) {
      const result = new Array(originalLength);
      let outPos = 0;
      let pos = 0;

      while (outPos < originalLength) {
        const flags = intermediate[pos++];

        for (let bit = 0; bit < 8 && outPos < originalLength; ++bit) {
          if (OpCodes.And32(OpCodes.Shr32(flags, bit), 1) === 0) {
            result[outPos++] = intermediate[pos++];
            continue;
          }

          const hi = intermediate[pos++];
          const lo = intermediate[pos++];
          const lengthCode = intermediate[pos++];
          const distance = hi * 256 + lo;
          const length = lengthCode + MIN_MATCH;

          const src = outPos - distance;
          for (let k = 0; k < length; ++k)
            result[outPos + k] = result[src + k];
          outPos += length;
        }
      }

      return result;
    },

    /** Exact 24-bit key over the three bytes at pos - collision-free by design. */
    hash3(data, pos) {
      return data[pos] * 65536 + data[pos + 1] * 256 + data[pos + 2];
    },

    commonPrefixLength(data, a, b, n) {
      const max = Math.min(MAX_MATCH, n - b);
      let len = 0;
      while (len < max && data[a + len] === data[b + len])
        ++len;
      return len;
    }
  };

  // ===== HUFFMAN ENTROPY STAGE =====

  /** Leaf or internal node of a Huffman tree. */
  class HuffmanNode {
    constructor(symbol, frequency, left, right) {
      this.symbol = symbol;
      this.frequency = frequency;
      this.left = left === undefined ? null : left;
      this.right = right === undefined ? null : right;
    }

    static leaf(symbol, frequency) {
      return new HuffmanNode(symbol, frequency, null, null);
    }

    static internal(left, right) {
      return new HuffmanNode(-1, left.frequency + right.frequency, left, right);
    }

    get isLeaf() {
      return this.left === null && this.right === null;
    }

    /** Orders by frequency, breaking ties by symbol so the shape is stable. */
    compareTo(other) {
      if (this.frequency !== other.frequency)
        return this.frequency < other.frequency ? -1 : 1;
      if (this.symbol !== other.symbol)
        return this.symbol < other.symbol ? -1 : 1;
      return 0;
    }
  }

  /** Binary min-heap reproducing the reference tree-construction order exactly. */
  class MinHeap {
    constructor() {
      this.items = [];
    }

    get count() {
      return this.items.length;
    }

    insert(item) {
      this.items.push(item);
      this._siftUp(this.items.length - 1);
    }

    extractMin() {
      const min = this.items[0];
      const last = this.items.length - 1;
      this.items[0] = this.items[last];
      this.items.pop();

      if (this.items.length > 0)
        this._siftDown(0);

      return min;
    }

    _siftUp(index) {
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (this.items[index].compareTo(this.items[parent]) < 0) {
          const tmp = this.items[index];
          this.items[index] = this.items[parent];
          this.items[parent] = tmp;
          index = parent;
        } else
          break;
      }
    }

    _siftDown(index) {
      const count = this.items.length;
      for (;;) {
        const left = 2 * index + 1;
        const right = 2 * index + 2;
        let smallest = index;

        if (left < count && this.items[left].compareTo(this.items[smallest]) < 0)
          smallest = left;
        if (right < count && this.items[right].compareTo(this.items[smallest]) < 0)
          smallest = right;

        if (smallest !== index) {
          const tmp = this.items[index];
          this.items[index] = this.items[smallest];
          this.items[smallest] = tmp;
          index = smallest;
        } else
          break;
      }
    }
  }

  const HuffmanTree = {
    buildFromFrequencies(frequencies) {
      const heap = new MinHeap();

      for (let i = 0; i < frequencies.length; ++i)
        if (frequencies[i] > 0)
          heap.insert(HuffmanNode.leaf(i, frequencies[i]));

      if (heap.count === 0)
        throw new Error('Zling: at least one symbol must have a non-zero frequency');

      // Single-symbol tree: pair the only leaf with a dummy partner.
      if (heap.count === 1)
        return HuffmanNode.internal(heap.extractMin(), HuffmanNode.leaf(-2, 0));

      while (heap.count > 1) {
        const left = heap.extractMin();
        const right = heap.extractMin();
        heap.insert(HuffmanNode.internal(left, right));
      }

      return heap.extractMin();
    },

    getCodeLengths(root, maxSymbol) {
      const lengths = new Int32Array(maxSymbol);
      const assign = (node, depth) => {
        if (node.isLeaf) {
          if (node.symbol >= 0 && node.symbol < maxSymbol)
            lengths[node.symbol] = depth;
          return;
        }
        if (node.left !== null) assign(node.left, depth + 1);
        if (node.right !== null) assign(node.right, depth + 1);
      };
      assign(root, 0);
      return lengths;
    },

    /**
     * Clamps code lengths to maxLength and repairs the Kraft sum: lengthening
     * the shortest code halves its contribution until the sum fits the budget,
     * then the longest codes are shortened again while spare budget remains.
     */
    limitCodeLengths(codeLengths, maxLength) {
      let needsAdjustment = false;
      for (let i = 0; i < codeLengths.length; ++i)
        if (codeLengths[i] > maxLength) {
          needsAdjustment = true;
          break;
        }
      if (!needsAdjustment)
        return;

      const symbols = [];
      for (let i = 0; i < codeLengths.length; ++i)
        if (codeLengths[i] > 0)
          symbols.push({ symbol: i, length: codeLengths[i] });

      for (let i = 0; i < symbols.length; ++i)
        if (symbols[i].length > maxLength)
          symbols[i].length = maxLength;

      const kraftMax = Math.pow(2, maxLength);
      for (;;) {
        let kraftSum = 0;
        for (let i = 0; i < symbols.length; ++i)
          kraftSum += Math.pow(2, maxLength - symbols[i].length);

        if (kraftSum <= kraftMax)
          break;

        let shortestIdx = -1;
        let shortestLen = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < symbols.length; ++i)
          if (symbols[i].length < maxLength && symbols[i].length < shortestLen) {
            shortestLen = symbols[i].length;
            shortestIdx = i;
          }

        if (shortestIdx < 0)
          break; // every code already sits at maxLength

        symbols[shortestIdx].length += 1;
      }

      for (;;) {
        let kraftSum = 0;
        for (let i = 0; i < symbols.length; ++i)
          kraftSum += Math.pow(2, maxLength - symbols[i].length);

        const excess = kraftMax - kraftSum;
        if (excess <= 0)
          break;

        let longestIdx = -1;
        let longestLen = 0;
        for (let i = 0; i < symbols.length; ++i)
          if (symbols[i].length > longestLen) {
            longestLen = symbols[i].length;
            longestIdx = i;
          }

        if (longestIdx < 0 || longestLen <= 1)
          break;

        const added = Math.pow(2, maxLength - longestLen);
        if (added <= excess)
          symbols[longestIdx].length = longestLen - 1;
        else
          break;
      }

      codeLengths.fill(0);
      for (let i = 0; i < symbols.length; ++i)
        codeLengths[symbols[i].symbol] = symbols[i].length;
    }
  };

  /** Canonical code assignment per RFC 1951 section 3.2.2, steps 1 to 3. */
  function buildCanonicalCodes(codeLengths) {
    let maxCodeLength = 0;
    for (let i = 0; i < codeLengths.length; ++i)
      if (codeLengths[i] > maxCodeLength)
        maxCodeLength = codeLengths[i];

    const codes = new Int32Array(codeLengths.length);
    const blCount = new Int32Array(maxCodeLength + 2);
    if (maxCodeLength === 0)
      return { codes: codes, blCount: blCount, maxCodeLength: 0 };

    for (let i = 0; i < codeLengths.length; ++i)
      if (codeLengths[i] > 0)
        ++blCount[codeLengths[i]];

    const nextCode = new Int32Array(maxCodeLength + 1);
    let code = 0;
    for (let bits = 1; bits <= maxCodeLength; ++bits) {
      code = OpCodes.Shl32(code + blCount[bits - 1], 1);
      nextCode[bits] = code;
    }

    for (let symbol = 0; symbol < codeLengths.length; ++symbol) {
      const len = codeLengths[symbol];
      if (len <= 0)
        continue;
      codes[symbol] = nextCode[len];
      ++nextCode[len];
    }

    return { codes: codes, blCount: blCount, maxCodeLength: maxCodeLength };
  }

  /** MSB-first bit writer; the trailing partial byte is zero padded. */
  class BitWriter {
    constructor(output) {
      this.output = output;
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    writeBit(bit) {
      this.buffer = OpCodes.Or32(this.buffer, OpCodes.Shl32(OpCodes.And32(bit, 1), 7 - this.bitsInBuffer));
      ++this.bitsInBuffer;

      if (this.bitsInBuffer !== 8)
        return;

      this.output.push(this.buffer&0xFF);
      this.buffer = 0;
      this.bitsInBuffer = 0;
    }

    flushBits() {
      if (this.bitsInBuffer <= 0)
        return;

      this.output.push(this.buffer&0xFF);
      this.buffer = 0;
      this.bitsInBuffer = 0;
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
          expected: OpCodes.Hex8ToBytes("040000000500000001030300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f300")
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
          expected: OpCodes.Hex8ToBytes("050000000600000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000300000000000001000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000971c")
        }
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    CreateInstance(isInverse = false) {
      return new ZlingInstance(this, isInverse);
    }
  }

  class ZlingInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) return [];
        const result = this.decompress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Even empty input yields the fixed 4-byte size header.
      const result = this.compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      const src = data || [];
      const n = src.length;
      const output = [];

      this._pushUint32LE(output, n);
      if (n === 0)
        return output;

      const intermediate = ZlingLz.encode(src);
      this._pushUint32LE(output, intermediate.length);

      const freqs = new Array(SYMBOL_COUNT).fill(0);
      for (let i = 0; i < intermediate.length; ++i)
        ++freqs[intermediate[i]];

      // A one-symbol alphabet has no binary code, so borrow an unused symbol.
      let nonZero = 0;
      for (let i = 0; i < SYMBOL_COUNT; ++i)
        if (freqs[i] > 0)
          ++nonZero;
      if (nonZero < 2)
        for (let i = 0; i < SYMBOL_COUNT; ++i)
          if (freqs[i] === 0) {
            freqs[i] = 1;
            break;
          }

      const root = HuffmanTree.buildFromFrequencies(freqs);
      const codeLengths = HuffmanTree.getCodeLengths(root, SYMBOL_COUNT);
      HuffmanTree.limitCodeLengths(codeLengths, MAX_CODE_LENGTH);
      const table = buildCanonicalCodes(codeLengths);

      for (let i = 0; i < SYMBOL_COUNT; ++i)
        output.push(codeLengths[i]&0xFF);

      const writer = new BitWriter(output);
      for (let i = 0; i < intermediate.length; ++i) {
        const symbol = intermediate[i];
        const code = table.codes[symbol];
        for (let b = codeLengths[symbol] - 1; b >= 0; --b)
          writer.writeBit(OpCodes.And32(OpCodes.Shr32(code, b), 1));
      }
      writer.flushBits();

      return output;
    }

    decompress(data) {
      const bytes = data || [];
      if (bytes.length < 4)
        return [];

      const originalLength = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (originalLength === 0)
        return [];

      const intermediateLength = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);

      const codeLengths = new Int32Array(SYMBOL_COUNT);
      for (let i = 0; i < SYMBOL_COUNT; ++i)
        codeLengths[i] = bytes[8 + i];

      const table = buildCanonicalCodes(codeLengths);

      // Canonical decode: at every length the codes form one contiguous range
      // starting at that length's first code, so accumulating bits and testing
      // the running value against the range identifies the symbol directly.
      const firstCode = new Int32Array(table.maxCodeLength + 2);
      const firstIndex = new Int32Array(table.maxCodeLength + 2);
      const sortedSymbols = [];
      let code = 0;
      let index = 0;
      for (let bits = 1; bits <= table.maxCodeLength; ++bits) {
        code = OpCodes.Shl32(code + table.blCount[bits - 1], 1);
        firstCode[bits] = code;
        firstIndex[bits] = index;
        index += table.blCount[bits];
      }
      for (let bits = 1; bits <= table.maxCodeLength; ++bits)
        for (let i = 0; i < SYMBOL_COUNT; ++i)
          if (codeLengths[i] === bits)
            sortedSymbols.push(i);

      let pos = 8 + SYMBOL_COUNT;
      let bitBuffer = 0;
      let bitsInBuffer = 0;
      const readBit = () => {
        if (bitsInBuffer === 0) {
          if (pos >= bytes.length)
            throw new Error('Zling: unexpected end of the Huffman bit stream');
          bitBuffer = bytes[pos++];
          bitsInBuffer = 8;
        }
        const bit = OpCodes.And32(OpCodes.Shr32(bitBuffer, 7), 1);
        bitBuffer = OpCodes.And32(OpCodes.Shl32(bitBuffer, 1), 0xFF);
        --bitsInBuffer;
        return bit;
      };

      const intermediate = new Array(intermediateLength);
      for (let i = 0; i < intermediateLength; ++i) {
        let running = 0;
        let symbol = -1;
        for (let bits = 1; bits <= table.maxCodeLength; ++bits) {
          running = OpCodes.Or32(OpCodes.Shl32(running, 1), readBit());
          const count = table.blCount[bits];
          if (count > 0 && running >= firstCode[bits] && running - firstCode[bits] < count) {
            symbol = sortedSymbols[firstIndex[bits] + (running - firstCode[bits])];
            break;
          }
        }
        if (symbol < 0)
          throw new Error('Zling: invalid Huffman code encountered');
        intermediate[i] = symbol;
      }

      return ZlingLz.decode(intermediate, originalLength);
    }

    _pushUint32LE(output, value) {
      output.push(value&0xFF);
      output.push(OpCodes.Shr32(value, 8)&0xFF);
      output.push(OpCodes.Shr32(value, 16)&0xFF);
      output.push(OpCodes.Shr32(value, 24)&0xFF);
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
