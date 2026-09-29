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

      /**
       * Create a new instance
       * @param {boolean} [isInverse=false] - True to decompress
       * @returns {HuffmanInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new HuffmanInstance(this, isInverse);
      }
    }

    // Code lengths come from the shared deterministic builder in
    // huffman-code-lengths.data.js. Its tie-break among equally likely symbols is
    // a written rule - lighter first, then leaves before internal nodes, leaves by
    // ascending symbol, internal nodes oldest first - and CompressionWorkbench's
    // DeterministicHuffman follows the same rule, so the two produce the same tree
    // because the algorithm says so and not because either copies the other's heap.

    /**
     * Node of the MSB-first decode trie
     */
    class TrieNode {
      constructor() {
        /** @type {int32} */
        this.symbol = -1;
        /** @type {TrieNode} */
        this.zero = null;
        /** @type {TrieNode} */
        this.one = null;
      }
    }

    class HuffmanInstance extends IAlgorithmInstance {
      /**
       * @param {HuffmanCompression} algorithm - Parent algorithm
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
          if (this.inputBuffer.length === 0) {
            /** @type {uint8[]} */
            const empty = [];
            return empty;
          }
          /** @type {uint8[]} */
          const decoded = this._decompress();
          return decoded;
        }

        // Even empty input produces a fixed 260-byte header (matches the
        // C# reference, which always writes the length + code-length table).
        /** @type {uint8[]} */
        const encoded = this._compress();
        return encoded;
      }

      /**
       * @returns {uint8[]} Size, code-length table and packed codes
       */
      _compress() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;

        // Build frequency table over all 256 symbols
        /** @type {int32[]} */
        const freqs = new Array(256);
        for (let i = 0; i < 256; ++i) {
          freqs[i] = 0;
        }
        for (let i = 0; i < data.length; ++i) {
          ++freqs[data[i]];
        }

        // Ensure at least 2 symbols so a tree can be built
        /** @type {int32} */
        let nonZero = 0;
        for (let i = 0; i < freqs.length; ++i) {
          if (freqs[i] > 0) {
            ++nonZero;
          }
        }
        if (nonZero < 2) {
          for (let i = 0; i < 256; ++i) {
            if (freqs[i] === 0) {
              freqs[i] = 1;
              break;
            }
          }
        }

        /** @type {int32[]} */
        const codeLengths = HuffmanCodeLengths.buildCodeLengths(freqs, 256);
        this._limitCodeLengths(codeLengths, 15);
        /** @type {uint32[]} */
        const codeOf = this._newCodeTable();
        /** @type {int32[]} */
        const lengthOf = this._newLengthTable();
        this._buildCanonicalTable(codeLengths, codeOf, lengthOf);

        // Header: 4-byte LE original size, then 256 bytes of code lengths
        /** @type {uint8[]} */
        const result = OpCodes.Unpack32LE(data.length);
        for (let i = 0; i < 256; ++i) {
          result.push(codeLengths[i]);
        }

        // Encode symbols, MSB-first, into a growing bit buffer
        /** @type {uint32} */
        let bitBuffer = 0;
        /** @type {int32} */
        let bitsInBuffer = 0;
        for (let n = 0; n < data.length; ++n) {
          /** @type {uint8} */
          const byte = data[n];
          /** @type {uint32} */
          const code = codeOf[byte];
          /** @type {int32} */
          const length = lengthOf[byte];
          for (let i = length - 1; i >= 0; --i) {
            /** @type {uint32} */
            const bit = OpCodes.And32(OpCodes.Shr32(code, i), 1);
            bitBuffer = OpCodes.Or32(bitBuffer, OpCodes.Shl32(bit, 7 - bitsInBuffer));
            ++bitsInBuffer;
            if (bitsInBuffer === 8) {
              result.push(bitBuffer);
              bitBuffer = 0;
              bitsInBuffer = 0;
            }
          }
        }
        if (bitsInBuffer > 0) {
          result.push(bitBuffer);
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      /**
       * @returns {uint8[]} Decoded bytes
       */
      _decompress() {
        /** @type {uint8[]} */
        const data = this.inputBuffer;

        /** @type {uint32} */
        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        /** @type {int32[]} */
        const codeLengths = new Array(256);
        for (let i = 0; i < 256; ++i) {
          codeLengths[i] = data[4 + i];
        }

        /** @type {uint32[]} */
        const codeOf = this._newCodeTable();
        /** @type {int32[]} */
        const lengthOf = this._newLengthTable();
        this._buildCanonicalTable(codeLengths, codeOf, lengthOf);

        // Build a decode trie from the canonical codes (MSB-first)
        /** @type {TrieNode} */
        const trieRoot = new TrieNode();
        for (let symbol = 0; symbol < 256; ++symbol) {
          /** @type {int32} */
          const length = codeLengths[symbol];
          if (length <= 0) {
            continue;
          }
          /** @type {TrieNode} */
          let node = trieRoot;
          /** @type {uint32} */
          const code = codeOf[symbol];
          for (let i = length - 1; i >= 0; --i) {
            /** @type {uint32} */
            const bit = OpCodes.And32(OpCodes.Shr32(code, i), 1);
            if (bit === 0) {
              if (node.zero === null) {
                node.zero = new TrieNode();
              }
              node = node.zero;
            } else {
              if (node.one === null) {
                node.one = new TrieNode();
              }
              node = node.one;
            }
          }
          node.symbol = symbol;
        }

        /** @type {int32} */
        let bytePos = 260;
        /** @type {int32} */
        let bitPos = 0; // next bit index (0 = MSB) within data[bytePos]

        /** @type {uint8[]} */
        const result = [];
        for (let i = 0; i < originalSize; ++i) {
          /** @type {TrieNode} */
          let node = trieRoot;
          while (node.symbol < 0) {
            /** @type {uint8} */
            const currentByte = data[bytePos];
            /** @type {uint32} */
            const bit = OpCodes.And32(OpCodes.Shr32(currentByte, 7 - bitPos), 1);
            if (bit === 0) {
              node = node.zero;
            } else {
              node = node.one;
            }
            ++bitPos;
            if (bitPos === 8) {
              bitPos = 0;
              ++bytePos;
            }
          }
          result.push(node.symbol);
        }

        /** @type {uint8[]} */
        const fresh = [];
        this.inputBuffer = fresh;
        return result;
      }

      // Mirrors HuffmanTree.LimitCodeLengths (package-merge-style redistribution)
      /**
       * @param {int32[]} codeLengths - Code lengths, limited in place
       * @param {int32} maxLength - Largest allowed length
       */
      _limitCodeLengths(codeLengths, maxLength) {
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

        /** @type {uint32} */
        const kraftMax = OpCodes.Shl32(1, maxLength);
        for (;;) {
          /** @type {float64} */
          const kraftSum = this._kraftSum(usedLength, maxLength);
          if (kraftSum <= kraftMax) {
            break;
          }

          /** @type {int32} */
          let shortestIdx = -1;
          /** @type {float64} */
          let shortestLen = Infinity;
          for (let i = 0; i < usedLength.length; ++i) {
            if (usedLength[i] < maxLength && usedLength[i] < shortestLen) {
              shortestLen = usedLength[i];
              shortestIdx = i;
            }
          }
          if (shortestIdx < 0) {
            break;
          }
          ++usedLength[shortestIdx];
        }

        for (;;) {
          /** @type {float64} */
          const kraftSum = this._kraftSum(usedLength, maxLength);
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

          /** @type {uint32} */
          const added = OpCodes.Shl32(1, maxLength - longestLen);
          if (added <= excess) {
            --usedLength[longestIdx];
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
       * @private
       * @param {int32[]} usedLength - Code length per used symbol
       * @param {int32} maxLength - Largest allowed length
       * @returns {float64} Kraft sum scaled by 2^maxLength
       */
      _kraftSum(usedLength, maxLength) {
        /** @type {float64} */
        let kraftSum = 0;
        for (let i = 0; i < usedLength.length; ++i) {
          /** @type {uint32} */
          const weight = OpCodes.Shl32(1, maxLength - usedLength[i]);
          kraftSum += weight;
        }
        return kraftSum;
      }

      /**
       * @private
       * @returns {uint32[]} 256 zero codes
       */
      _newCodeTable() {
        /** @type {uint32[]} */
        const table = new Array(256);
        for (let i = 0; i < 256; ++i) {
          table[i] = 0;
        }
        return table;
      }

      /**
       * @private
       * @returns {int32[]} 256 zero lengths
       */
      _newLengthTable() {
        /** @type {int32[]} */
        const table = new Array(256);
        for (let i = 0; i < 256; ++i) {
          table[i] = 0;
        }
        return table;
      }

      // Mirrors CanonicalCodeAssigner.ComputeNextCodes + CanonicalHuffman's code assignment
      /**
       * Fill in the canonical code and length of every used symbol
       * @param {int32[]} codeLengths - Code length per symbol
       * @param {uint32[]} codeOf - Receives the code per symbol (entries start at 0)
       * @param {int32[]} lengthOf - Receives the length per symbol (entries start at 0)
       * @returns {int32} Longest code length
       */
      _buildCanonicalTable(codeLengths, codeOf, lengthOf) {
        /** @type {int32} */
        let maxCodeLength = 0;
        for (let i = 0; i < codeLengths.length; ++i) {
          if (codeLengths[i] > maxCodeLength) {
            maxCodeLength = codeLengths[i];
          }
        }

        if (maxCodeLength === 0) {
          return maxCodeLength;
        }

        /** @type {int32[]} */
        const blCount = new Array(maxCodeLength + 1);
        /** @type {uint32[]} */
        const nextCode = new Array(maxCodeLength + 1);
        for (let i = 0; i <= maxCodeLength; ++i) {
          blCount[i] = 0;
          nextCode[i] = 0;
        }
        for (let i = 0; i < codeLengths.length; ++i) {
          /** @type {int32} */
          const len = codeLengths[i];
          if (len > 0) {
            ++blCount[len];
          }
        }

        /** @type {uint32} */
        let c = 0;
        for (let bits = 1; bits <= maxCodeLength; ++bits) {
          /** @type {uint32} */
          const counted = blCount[bits - 1];
          c = OpCodes.Shl32(c + counted, 1);
          nextCode[bits] = c;
        }

        for (let symbol = 0; symbol < 256; ++symbol) {
          /** @type {int32} */
          const len = codeLengths[symbol];
          if (len <= 0) {
            continue;
          }
          codeOf[symbol] = nextCode[len];
          lengthOf[symbol] = len;
          ++nextCode[len];
        }

        return maxCodeLength;
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