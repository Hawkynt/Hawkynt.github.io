/*
 * Universal Shannon-Fano Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Shannon-Fano algorithm - predecessor to Huffman
 * (c)2006-2025 Hawkynt
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
 * ShannonFanoAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ShannonFanoAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Shannon-Fano Coding";
        this.description = "Variable-length prefix-free coding algorithm that predates Huffman coding. Divides symbols recursively by frequency to create binary codes, though not always optimal.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Claude Shannon, Robert Fano";
        this.year = 1948;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem("A Mathematical Theory of Communication", "https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf"),
          new LinkItem("Shannon-Fano Coding - Wikipedia", "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding"),
          new LinkItem("Information Theory Primer", "https://web.stanford.edu/class/ee276/"),
          new LinkItem("Data Compression History", "https://www.data-compression.com/theory.shtml")
        ];

        this.references = [
          new LinkItem("MIT Information Theory Course", "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/"),
          new LinkItem("Shannon-Fano vs Huffman Analysis", "https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf"),
          new LinkItem("Rosetta Code Implementation", "https://rosettacode.org/wiki/Shannon-Fano_coding"),
          new LinkItem("Educational Examples", "https://www2.cs.duke.edu/csed/poop/huff/info/")
        ];

        this.knownVulnerabilities = [];

        // Wire format (matches CompressionWorkbench's BB_ShannonFano building
        // block): a 4-byte little-endian original length, a fixed 256-entry
        // frequency table (2-byte little-endian counts), then the coded
        // bitstream. The fixed-size table makes even tiny inputs expand to
        // 512+ header bytes; expected vectors are given as hex for this reason.
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes("AAABBC"),
            OpCodes.Hex8ToBytes("0600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030002000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001580"),
            "Basic frequency encoding",
            "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCDEF"),
            OpCodes.Hex8ToBytes("06000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100010001000100010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013B7"),
            "Alphabet frequency test",
            "https://www2.cs.duke.edu/csed/poop/huff/info/"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABABAB"),
            OpCodes.Hex8ToBytes("06000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000300030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000054"),
            "Repeated pattern encoding",
            "https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {ShannonFanoInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new ShannonFanoInstance(this, isInverse);
      }
    }

    /**
     * Decode-tree node; a leaf has no children
     */
    class SfNode {
      /**
       * @param {int32} symbol - Symbol of a leaf (0 for inner nodes)
       * @param {SfNode} left - Child for a 0-bit
       * @param {SfNode} right - Child for a 1-bit
       */
      constructor(symbol, left, right) {
        /** @type {int32} */
        this.symbol = symbol;
        /** @type {SfNode} */
        this.left = left;
        /** @type {SfNode} */
        this.right = right;
      }
    }

    /**
     * Used symbols with their frequencies, in the split order: frequency
     * descending, equal frequencies by ascending symbol. The order is total,
     * so it is one fixed sequence however it is produced.
     */
    class SfSymbolList {
      /**
       * @param {int32[]} freq - Frequency per byte value
       */
      constructor(freq) {
        /** @type {int32[]} */
        this.symbol = [];
        /** @type {int32[]} */
        this.weight = [];
        for (let i = 0; i < 256; i++) {
          if (freq[i] > 0) {
            this.symbol.push(i);
            this.weight.push(freq[i]);
          }
        }
        this._sort();
      }

      /**
       * @param {int32} a - Index
       * @param {int32} b - Index
       * @returns {boolean} True when entry a comes before entry b
       */
      _before(a, b) {
        if (this.weight[a] !== this.weight[b]) {
          return this.weight[a] > this.weight[b];
        }
        return this.symbol[a] < this.symbol[b];
      }

      /** Insertion sort into the split order (at most 256 entries) */
      _sort() {
        for (let i = 1; i < this.symbol.length; i++) {
          /** @type {int32} */
          let j = i;
          while (j > 0 && this._before(j, j - 1)) {
            /** @type {int32} */
            const s = this.symbol[j];
            this.symbol[j] = this.symbol[j - 1];
            this.symbol[j - 1] = s;
            /** @type {int32} */
            const w = this.weight[j];
            this.weight[j] = this.weight[j - 1];
            this.weight[j - 1] = w;
            j--;
          }
        }
      }

      // Shared split-point search: minimize |2*runningSum - total| over the
      // first count-1 candidate cut points, breaking ties toward the first
      // minimal index (matches the reference's linear scan with strict '<').
      /**
       * @param {int32} lo - First entry of the range
       * @param {int32} hi - End of the range (exclusive)
       * @returns {int32} Number of entries that go to the left part
       */
      splitIndex(lo, hi) {
        /** @type {float64} */
        let total = 0;
        for (let i = lo; i < hi; i++) {
          total += this.weight[i];
        }

        /** @type {float64} */
        let runningSum = 0;
        /** @type {int32} */
        let splitIndex = 0;
        /** @type {float64} */
        let minDiff = Infinity;
        for (let i = 0; i < hi - lo - 1; i++) {
          runningSum += this.weight[lo + i];
          /** @type {float64} */
          const diff = Math.abs(2 * runningSum - total);
          if (diff < minDiff) {
            minDiff = diff;
            splitIndex = i + 1;
          }
        }
        return splitIndex;
      }
    }

    class ShannonFanoInstance extends IAlgorithmInstance {
      /**
       * @param {ShannonFanoAlgorithm} algorithm - Parent algorithm
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

      // Wire format (matches CompressionWorkbench's BB_ShannonFano building
      // block): a 4-byte little-endian original length, then a fixed
      // 256-entry frequency table (2-byte little-endian counts, scaled to
      // fit uint16 only if the true maximum exceeds it), followed by the
      // Shannon-Fano-coded bitstream (MSB-first, zero-padded to a byte
      // boundary). Codes are rebuilt independently on encode and decode
      // from the same frequency table by recursively splitting the
      // freq-sorted symbol list at the point that minimizes the imbalance
      // between the two halves.
      /**
       * @param {uint8[]} data - Input bytes
       * @returns {uint8[]} Header, frequency table and code bits
       */
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);

        /** @type {int32[]} */
        const freq = new Array(256);
        for (let i = 0; i < 256; i++) {
          freq[i] = 0;
        }
        for (let i = 0; i < data.length; i++) {
          freq[data[i]]++;
        }

        /** @type {int32} */
        let maxFreq = 0;
        for (let i = 0; i < freq.length; i++) {
          if (freq[i] > maxFreq) {
            maxFreq = freq[i];
          }
        }

        /** @type {int32[]} */
        const scaledFreq = new Array(256);
        for (let i = 0; i < 256; i++) {
          scaledFreq[i] = 0;
        }
        if (maxFreq > 0xFFFF) {
          for (let i = 0; i < 256; i++) {
            if (freq[i] > 0) {
              /** @type {float64} */
              const scaled = freq[i] * 0xFFFF / maxFreq;
              scaledFreq[i] = Math.max(1, Math.floor(scaled));
            }
          }
        } else {
          for (let i = 0; i < 256; i++) {
            scaledFreq[i] = freq[i];
          }
        }
        for (let i = 0; i < 256; i++) {
          bitStream.writeUint16LE(scaledFreq[i]);
        }

        if (data.length === 0) {
          /** @type {uint8[]} */
          const headerOnly = bitStream.toArray();
          return headerOnly;
        }

        // Codes are built from the table that was actually written, never from
        // the raw counts. Once the largest count exceeds 0xFFFF the table is
        // rescaled, and the rescaled values are all the decoder will ever see;
        // deriving the encoder's codes from the raw counts gives the two sides
        // different split points, so the stream decodes to garbage of exactly
        // the right length without anything throwing. Below the scaling point
        // the two tables are equal, so short outputs are unchanged.
        /** @type {uint32[]} */
        const codeOf = new Array(256);
        /** @type {int32[]} */
        const lengthOf = new Array(256);
        this._buildCodes(scaledFreq, codeOf, lengthOf);
        for (let n = 0; n < data.length; n++) {
          /** @type {uint8} */
          const b = data[n];
          /** @type {uint32} */
          const code = codeOf[b];
          for (let i = lengthOf[b] - 1; i >= 0; i--) {
            bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(code, i), 1));
          }
        }

        /** @type {uint8[]} */
        const packed = bitStream.toArray();
        return packed;
      }

      /**
       * @param {uint8[]} data - Header, frequency table and code bits
       * @returns {uint8[]} Decoded bytes
       */
      _decompress(data) {
        /** @type {uint8[]} */
        const result = [];
        if (data.length < 4) {
          return result;
        }

        const bitStream = OpCodes.CreateBitStream(data);
        /** @type {uint8} */
        const s0 = bitStream.readByte();
        /** @type {uint8} */
        const s1 = bitStream.readByte();
        /** @type {uint8} */
        const s2 = bitStream.readByte();
        /** @type {uint8} */
        const s3 = bitStream.readByte();
        /** @type {uint32} */
        const originalSize = OpCodes.Pack32LE(s0, s1, s2, s3);
        if (originalSize === 0) {
          return result;
        }

        /** @type {int32[]} */
        const freq = new Array(256);
        for (let i = 0; i < 256; i++) {
          /** @type {uint8} */
          const lo = bitStream.readByte();
          /** @type {uint8} */
          const hi = bitStream.readByte();
          freq[i] = OpCodes.Pack16LE(lo, hi);
        }

        /** @type {SfNode} */
        const root = this._buildTree(freq);

        for (let i = 0; i < originalSize; i++) {
          /** @type {SfNode} */
          let node = root;
          while (node.left || node.right) {
            /** @type {int32} */
            const bit = bitStream.readBit();
            if (bit === 0) {
              node = node.left;
            } else {
              node = node.right;
            }
            if (!node) {
              throw new Error('Invalid Shannon-Fano bitstream.');
            }
          }
          result.push(node.symbol);
        }

        return result;
      }

      /**
       * Fill in the code and length of every symbol with freq > 0, by
       * recursively splitting the freq-sorted symbol list at the index that
       * minimizes |2*runningSum - total|.
       * @private
       * @param {int32[]} freq - Frequency per byte value
       * @param {uint32[]} codeOf - Receives the code per symbol
       * @param {int32[]} lengthOf - Receives the code length per symbol
       */
      _buildCodes(freq, codeOf, lengthOf) {
        /** @type {SfSymbolList} */
        const list = new SfSymbolList(freq);
        /** @type {int32} */
        const count = list.symbol.length;

        if (count === 0) {
          return;
        }
        if (count === 1) {
          codeOf[list.symbol[0]] = 0;
          lengthOf[list.symbol[0]] = 1;
          return;
        }

        this._assignCodes(list, 0, count, codeOf, lengthOf, 0, 0);
      }

      /**
       * @private
       * @param {SfSymbolList} list - Sorted symbols
       * @param {int32} lo - First entry of the range
       * @param {int32} hi - End of the range (exclusive)
       * @param {uint32[]} codeOf - Receives the code per symbol
       * @param {int32[]} lengthOf - Receives the code length per symbol
       * @param {uint32} currentCode - Code prefix of the range
       * @param {int32} depth - Prefix length
       */
      _assignCodes(list, lo, hi, codeOf, lengthOf, currentCode, depth) {
        if (hi - lo === 1) {
          codeOf[list.symbol[lo]] = currentCode;
          lengthOf[list.symbol[lo]] = Math.max(1, depth);
          return;
        }
        if (hi - lo === 0) {
          return;
        }

        /** @type {int32} */
        const splitIndex = list.splitIndex(lo, hi);

        this._assignCodes(list, lo, lo + splitIndex, codeOf, lengthOf, OpCodes.Shl32(currentCode, 1), depth + 1);
        this._assignCodes(list, lo + splitIndex, hi, codeOf, lengthOf, OpCodes.Or32(OpCodes.Shl32(currentCode, 1), 1), depth + 1);
      }

      /**
       * Build the decode tree for the given frequency table, matching the
       * split structure used by _buildCodes/_assignCodes on the encode side.
       * @private
       * @param {int32[]} freq - Frequency per byte value
       * @returns {SfNode} Root
       */
      _buildTree(freq) {
        /** @type {SfSymbolList} */
        const list = new SfSymbolList(freq);
        /** @type {int32} */
        const count = list.symbol.length;

        if (count === 0) {
          return new SfNode(0, null, null);
        }
        if (count === 1) {
          /** @type {SfNode} */
          const leaf = new SfNode(list.symbol[0], null, null);
          return new SfNode(0, leaf, leaf);
        }

        return this._buildSubTree(list, 0, count);
      }

      /**
       * @private
       * @param {SfSymbolList} list - Sorted symbols
       * @param {int32} lo - First entry of the range
       * @param {int32} hi - End of the range (exclusive)
       * @returns {SfNode} Subtree for the range
       */
      _buildSubTree(list, lo, hi) {
        if (hi - lo === 1) {
          return new SfNode(list.symbol[lo], null, null);
        }

        /** @type {int32} */
        const splitIndex = list.splitIndex(lo, hi);
        /** @type {SfNode} */
        const left = this._buildSubTree(list, lo, lo + splitIndex);
        /** @type {SfNode} */
        const right = this._buildSubTree(list, lo + splitIndex, hi);
        return new SfNode(0, left, right);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ShannonFanoAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ShannonFanoAlgorithm, ShannonFanoInstance };
}));