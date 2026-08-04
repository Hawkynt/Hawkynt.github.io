/*
 * Huffman Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Huffman coding for lossless data compression
 * Uses frequency-based optimal prefix codes
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
 * HuffmanCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class HuffmanCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Huffman";
        this.description = "Lossless data compression using optimal prefix codes based on symbol frequencies. Developed by David Huffman in 1952 for minimum-redundancy coding.";
        this.inventor = "David Albert Huffman";
        this.year = 1952;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Original Paper", "https://en.wikipedia.org/wiki/Huffman_coding"),
          new LinkItem("Information Theory Tutorial", "https://web.stanford.edu/class/ee378a/")
        ];

        this.references = [
          new LinkItem("Huffman's 1952 Paper", "https://ieeexplore.ieee.org/document/4051119"),
          new LinkItem("Data Compression Book", "https://www.data-compression.com/huffman.html")
        ];

        // Test vectors with actual compressed outputs.
        // Wire format (byte-identical to CompressionWorkbench's BB_Huffman):
        //   4 bytes original length (little-endian)
        //   256 bytes canonical code length per symbol (0 = unused)
        //   MSB-first bit-packed canonical Huffman codes, zero-padded to a byte
        this.tests = [
          {
            text: "Empty input",
            uri: "https://csrc.nist.gov/",
            input: [],
            expected: [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
          },
          {
            text: "Single byte 0x41",
            uri: "https://csrc.nist.gov/",
            input: [0x41],
            expected: [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new HuffmanInstance(this, isInverse);
      }
    }

    // Huffman tree node, mirroring CompressionWorkbench's HuffmanNode:
    // symbol >= 0 for leaves, -1 for internal nodes, -2 for the dummy sibling
    // used to complete a single-symbol tree. Ties in the min-heap are broken
    // by symbol, matching CompareTo in the reference implementation.
    class HuffmanNode {
      constructor(symbol, frequency, left = null, right = null) {
        this.symbol = symbol;
        this.left = left;
        this.right = right;
        this.frequency = left === null ? frequency : left.frequency + right.frequency;
      }

      isLeaf() {
        return this.left === null && this.right === null;
      }

      compareTo(other) {
        const cmp = this.frequency - other.frequency;
        return cmp !== 0 ? cmp : this.symbol - other.symbol;
      }
    }

    // Binary min-heap, structurally identical to CompressionWorkbench's
    // MinHeap<T> (array-backed, same sift-up/sift-down comparisons), so that
    // tie-breaking among equal-frequency internal nodes matches exactly.
    class MinHeap {
      constructor() {
        this._items = [];
      }

      get count() {
        return this._items.length;
      }

      insert(item) {
        this._items.push(item);
        this._siftUp(this._items.length - 1);
      }

      extractMin() {
        const items = this._items;
        const min = items[0];
        const last = items.length - 1;
        items[0] = items[last];
        items.pop();
        if (items.length > 0)
          this._siftDown(0);
        return min;
      }

      _siftUp(index) {
        const items = this._items;
        while (index > 0) {
          const parent = OpCodes.Shr32(index - 1, 1);
          if (items[index].compareTo(items[parent]) < 0) {
            const tmp = items[index];
            items[index] = items[parent];
            items[parent] = tmp;
            index = parent;
          } else
            break;
        }
      }

      _siftDown(index) {
        const items = this._items;
        const count = items.length;
        for (;;) {
          const left = 2 * index + 1;
          const right = 2 * index + 2;
          let smallest = index;

          if (left < count && items[left].compareTo(items[smallest]) < 0)
            smallest = left;
          if (right < count && items[right].compareTo(items[smallest]) < 0)
            smallest = right;

          if (smallest === index)
            break;

          const tmp = items[index];
          items[index] = items[smallest];
          items[smallest] = tmp;
          index = smallest;
        }
      }
    }

    class HuffmanInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.isInverse) {
          if (this.inputBuffer.length === 0) return [];
          return this._decompress();
        }

        // Even empty input produces a fixed 260-byte header (matches the
        // C# reference, which always writes the length + code-length table).
        return this._compress();
      }

      _compress() {
        const data = this.inputBuffer;

        // Build frequency table over all 256 symbols
        const freqs = new Array(256).fill(0);
        for (const byte of data)
          ++freqs[byte];

        // Ensure at least 2 symbols so a tree can be built
        let nonZero = 0;
        for (const f of freqs) if (f > 0) ++nonZero;
        if (nonZero < 2) {
          for (let i = 0; i < 256; ++i) {
            if (freqs[i] === 0) {
              freqs[i] = 1;
              break;
            }
          }
        }

        const root = this._buildHuffmanTree(freqs);
        const codeLengths = this._getCodeLengths(root, 256);
        this._limitCodeLengths(codeLengths, 15);
        const table = this._buildCanonicalTable(codeLengths);

        const result = [];

        // Header: 4-byte LE original size, then 256 bytes of code lengths
        result.push(...OpCodes.Unpack32LE(data.length));
        for (let i = 0; i < 256; ++i)
          result.push(codeLengths[i]);

        // Encode symbols, MSB-first, into a growing bit buffer
        let bitBuffer = 0;
        let bitsInBuffer = 0;
        for (const byte of data) {
          const code = table.code[byte];
          const length = table.length[byte];
          for (let i = length - 1; i >= 0; --i) {
            const bit = OpCodes.AndN(OpCodes.Shr32(code, i), 1);
            bitBuffer = OpCodes.OrN(bitBuffer, OpCodes.Shl32(bit, 7 - bitsInBuffer));
            ++bitsInBuffer;
            if (bitsInBuffer === 8) {
              result.push(bitBuffer);
              bitBuffer = 0;
              bitsInBuffer = 0;
            }
          }
        }
        if (bitsInBuffer > 0)
          result.push(bitBuffer);

        this.inputBuffer = [];
        return result;
      }

      _decompress() {
        const data = this.inputBuffer;

        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        const codeLengths = new Array(256);
        for (let i = 0; i < 256; ++i)
          codeLengths[i] = data[4 + i];

        const table = this._buildCanonicalTable(codeLengths);
        const maxCodeLength = table.maxCodeLength;

        // Build a decode trie from the canonical codes (MSB-first)
        const trieRoot = { symbol: -1, zero: null, one: null };
        for (let symbol = 0; symbol < 256; ++symbol) {
          const length = codeLengths[symbol];
          if (length <= 0) continue;
          let node = trieRoot;
          const code = table.code[symbol];
          for (let i = length - 1; i >= 0; --i) {
            const bit = OpCodes.AndN(OpCodes.Shr32(code, i), 1);
            if (bit === 0) {
              if (node.zero === null) node.zero = { symbol: -1, zero: null, one: null };
              node = node.zero;
            } else {
              if (node.one === null) node.one = { symbol: -1, zero: null, one: null };
              node = node.one;
            }
          }
          node.symbol = symbol;
        }

        let bytePos = 260;
        let bitPos = 0; // next bit index (0 = MSB) within data[bytePos]

        const result = [];
        for (let i = 0; i < originalSize; ++i) {
          let node = trieRoot;
          while (node.symbol < 0) {
            const currentByte = data[bytePos];
            const bit = OpCodes.AndN(OpCodes.Shr32(currentByte, 7 - bitPos), 1);
            node = bit === 0 ? node.zero : node.one;
            ++bitPos;
            if (bitPos === 8) {
              bitPos = 0;
              ++bytePos;
            }
          }
          result.push(node.symbol);
        }

        this.inputBuffer = [];
        return result;
      }

      // Mirrors HuffmanTree.BuildFromFrequencies
      _buildHuffmanTree(frequencies) {
        const heap = new MinHeap();
        for (let i = 0; i < frequencies.length; ++i)
          if (frequencies[i] > 0)
            heap.insert(new HuffmanNode(i, frequencies[i]));

        if (heap.count === 0)
          throw new Error('At least one symbol must have a non-zero frequency.');

        if (heap.count === 1) {
          const single = heap.extractMin();
          return new HuffmanNode(-1, 0, single, new HuffmanNode(-2, 0));
        }

        while (heap.count > 1) {
          const left = heap.extractMin();
          const right = heap.extractMin();
          heap.insert(new HuffmanNode(-1, 0, left, right));
        }

        return heap.extractMin();
      }

      // Mirrors HuffmanTree.GetCodeLengths / AssignLengths
      _getCodeLengths(root, maxSymbol) {
        const lengths = new Array(maxSymbol).fill(0);
        const assign = (node, depth) => {
          if (node.isLeaf()) {
            if (node.symbol >= 0 && node.symbol < lengths.length)
              lengths[node.symbol] = depth;
            return;
          }
          if (node.left !== null) assign(node.left, depth + 1);
          if (node.right !== null) assign(node.right, depth + 1);
        };
        assign(root, 0);
        return lengths;
      }

      // Mirrors HuffmanTree.LimitCodeLengths (package-merge-style redistribution)
      _limitCodeLengths(codeLengths, maxLength) {
        let needsAdjustment = false;
        for (const len of codeLengths)
          if (len > maxLength) { needsAdjustment = true; break; }
        if (!needsAdjustment) return;

        const symbols = [];
        for (let i = 0; i < codeLengths.length; ++i)
          if (codeLengths[i] > 0)
            symbols.push({ symbol: i, length: codeLengths[i] });

        for (let i = 0; i < symbols.length; ++i)
          if (symbols[i].length > maxLength)
            symbols[i].length = maxLength;

        const kraftMax = OpCodes.Shl32(1, maxLength);
        for (;;) {
          let kraftSum = 0;
          for (const s of symbols)
            kraftSum += OpCodes.Shl32(1, maxLength - s.length);
          if (kraftSum <= kraftMax) break;

          let shortestIdx = -1;
          let shortestLen = Infinity;
          for (let i = 0; i < symbols.length; ++i)
            if (symbols[i].length < maxLength && symbols[i].length < shortestLen) {
              shortestLen = symbols[i].length;
              shortestIdx = i;
            }
          if (shortestIdx < 0) break;
          ++symbols[shortestIdx].length;
        }

        for (;;) {
          let kraftSum = 0;
          for (const s of symbols)
            kraftSum += OpCodes.Shl32(1, maxLength - s.length);
          const excess = kraftMax - kraftSum;
          if (excess <= 0) break;

          let longestIdx = -1;
          let longestLen = 0;
          for (let i = 0; i < symbols.length; ++i)
            if (symbols[i].length > longestLen) {
              longestLen = symbols[i].length;
              longestIdx = i;
            }
          if (longestIdx < 0 || longestLen <= 1) break;

          const added = OpCodes.Shl32(1, maxLength - longestLen);
          if (added <= excess)
            --symbols[longestIdx].length;
          else
            break;
        }

        codeLengths.fill(0);
        for (const s of symbols)
          codeLengths[s.symbol] = s.length;
      }

      // Mirrors CanonicalCodeAssigner.ComputeNextCodes + CanonicalHuffman's code assignment
      _buildCanonicalTable(codeLengths) {
        let maxCodeLength = 0;
        for (const len of codeLengths)
          if (len > maxCodeLength) maxCodeLength = len;

        const code = new Array(256).fill(0);
        const length = new Array(256).fill(0);
        if (maxCodeLength === 0)
          return { code, length, maxCodeLength };

        const blCount = new Array(maxCodeLength + 1).fill(0);
        for (const len of codeLengths)
          if (len > 0) ++blCount[len];

        const nextCode = new Array(maxCodeLength + 1).fill(0);
        let c = 0;
        for (let bits = 1; bits <= maxCodeLength; ++bits) {
          c = OpCodes.Shl32(c + blCount[bits - 1], 1);
          nextCode[bits] = c;
        }

        for (let symbol = 0; symbol < 256; ++symbol) {
          const len = codeLengths[symbol];
          if (len <= 0) continue;
          code[symbol] = nextCode[len];
          length[symbol] = len;
          ++nextCode[len];
        }

        return { code, length, maxCodeLength };
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new HuffmanCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HuffmanCompression, HuffmanInstance };
}));