/*
 * Zling Compression Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Zling - Fast LZMA-like compression using order-1 ROLZ + Huffman encoding
 * Created by Zhang Li (richox) as a lightweight high-performance compressor
 *
 * This is an educational implementation demonstrating the core concepts:
 * - Order-1 ROLZ (Reduced Offset Lempel-Ziv) dictionary compression
 * - Context-based matching using previous byte as context
 * - Huffman encoding for entropy coding
 * - Simplified parameters for learning purposes
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

  class ZlingCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zling";
      this.description = "Fast LZMA-like compression using order-1 ROLZ (Reduced Offset Lempel-Ziv) followed by Huffman encoding. Achieves 3x faster compression than gzip with competitive ratios.";
      this.inventor = "Zhang Li (richox)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Educational implementation
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN; // China

      // Documentation and references
      this.documentation = [
        new LinkItem("Zling GitHub Repository", "https://github.com/richox/libzling"),
        new LinkItem("ROLZ Algorithm Overview", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("libzling Source Code", "https://github.com/richox/libzling/tree/master/src"),
        new LinkItem("ROLZ Paper", "https://ieeexplore.ieee.org/document/8801741/"),
        new LinkItem("Huffman Coding", "https://en.wikipedia.org/wiki/Huffman_coding"),
        new LinkItem("Successor: orz Compressor", "https://encode.su/threads/2923-orz-an-optimized-ROLZ-data-compressor-written-in-rust")
      ];

      // Test vectors - Educational compression tests with actual outputs
      // Note: These are test cases for the educational implementation
      // Production Zling uses different parameters and encoding format
      // These test vectors match the actual educational implementation output
      this.tests = [
        {
          text: "Empty input test",
          uri: "https://github.com/richox/libzling",
          input: [],
          expected: []
        },
        {
          text: "Single byte - educational format output",
          uri: "Educational implementation test",
          input: [65],
          expected: OpCodes.Hex8ToBytes("03000500010100410100090000009e80")
        },
        {
          text: "Two different bytes - educational format output",
          uri: "Educational implementation test",
          input: [65, 66],
          expected: OpCodes.Hex8ToBytes("040006000201004101004201000e000000af70")
        },
        {
          text: "Simple repetition AAAA - educational format output",
          uri: "Educational implementation test",
          input: [65, 65, 65, 65],
          expected: OpCodes.Hex8ToBytes("03000800040100410400120000009edb40")
        },
        {
          text: "Pattern ABAB - educational format output",
          uri: "Educational implementation test",
          input: [65, 66, 65, 66],
          expected: OpCodes.Hex8ToBytes("0400080004010041020042020015000000af72e0")
        },
        {
          text: "Hello string - educational format output",
          uri: "Educational implementation test",
          input: OpCodes.AnsiToBytes("Hello"),
          expected: OpCodes.Hex8ToBytes("060009000501004801006501006c02006f01001d000000b7bc5548")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ZlingInstance(this, isInverse);
    }
  }

  // Zling compression instance
  /**
 * Zling cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZlingInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Educational Zling Parameters (simplified from production)
      // Production: 16MB block, 10MB dictionary
      // Educational: smaller sizes for clarity
      this.BLOCK_SIZE = 4096;         // Simplified block size
      this.DICTIONARY_SIZE = 2048;     // Simplified dictionary size
      this.MIN_MATCH_LENGTH = 3;       // Minimum match length
      this.MAX_MATCH_LENGTH = 258;     // Maximum match length
      this.HASH_SIZE = 256;            // Hash table size for order-1 context
      this.MAX_OFFSET_COUNT = 16;      // Reduced offset set size (ROLZ key feature)
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    // ===== COMPRESSION =====

    _compress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length === 0) {
        return [];
      }

      // Stage 1: ROLZ compression (order-1 context-based dictionary)
      const rolzCompressed = this._rolzEncode(data);

      // Stage 2: Huffman encoding (entropy coding)
      const huffmanEncoded = this._huffmanEncode(rolzCompressed);

      return huffmanEncoded;
    }

    _rolzEncode(data) {
      const output = [];
      const dictionary = new Array(this.DICTIONARY_SIZE).fill(0);
      let dictPos = 0;

      // Context hash tables - each context maintains recent match positions
      // Order-1 ROLZ: context is the previous byte
      const contextHashes = new Array(256);
      for (let i = 0; i < 256; ++i) {
        contextHashes[i] = [];
      }

      // Header: format version and data length
      output.push(0); // Format version
      output.push(data.length&0xFF);
      output.push(OpCodes.Shr8(data.length, 8));
      output.push(OpCodes.Shr16(data.length, 16));
      output.push(OpCodes.Shr32(data.length, 24));

      let pos = 0;
      let prevByte = 0; // Previous byte for order-1 context

      while (pos < data.length) {
        const currentByte = data[pos];

        // Try to find match in context-specific reduced offset set
        const match = this._findBestMatch(data, pos, prevByte, contextHashes, dictionary);

        if (match && match.length >= this.MIN_MATCH_LENGTH) {
          // Encode match: [1 = match flag, offset high, offset low, length]
          output.push(1); // Match flag
          output.push(OpCodes.Shr8(match.offset, 8));
          output.push(match.offset&0xFF);
          output.push(match.length&0xFF);

          // Add match bytes to dictionary and update context hashes
          for (let i = 0; i < match.length; ++i) {
            const byte = data[pos + i];
            dictionary[dictPos] = byte;

            // Update context hash for this byte
            const context = i === 0 ? prevByte : data[pos + i - 1];
            contextHashes[context].push(dictPos);

            // Keep only recent MAX_OFFSET_COUNT positions (ROLZ reduced offset)
            if (contextHashes[context].length > this.MAX_OFFSET_COUNT) {
              contextHashes[context].shift();
            }

            dictPos = (dictPos + 1) % this.DICTIONARY_SIZE;
          }

          prevByte = data[pos + match.length - 1];
          pos += match.length;
        } else {
          // Encode literal: [0 = literal flag, byte value]
          output.push(0); // Literal flag
          output.push(currentByte);

          // Add to dictionary and update context hash
          dictionary[dictPos] = currentByte;
          contextHashes[prevByte].push(dictPos);

          if (contextHashes[prevByte].length > this.MAX_OFFSET_COUNT) {
            contextHashes[prevByte].shift();
          }

          dictPos = (dictPos + 1) % this.DICTIONARY_SIZE;
          prevByte = currentByte;
          ++pos;
        }
      }

      return output;
    }

    _findBestMatch(data, pos, context, contextHashes, dictionary) {
      if (pos + this.MIN_MATCH_LENGTH > data.length) {
        return null;
      }

      // ROLZ: Only search positions in the reduced offset set for this context
      const candidates = contextHashes[context];
      if (!candidates || candidates.length === 0) {
        return null;
      }

      let bestMatch = null;
      let bestLength = this.MIN_MATCH_LENGTH - 1;

      // Search through reduced offset set (ROLZ key optimization)
      for (const dictPos of candidates) {
        let matchLength = 0;
        const maxLen = Math.min(
          this.MAX_MATCH_LENGTH,
          data.length - pos,
          this.DICTIONARY_SIZE
        );

        // Count matching bytes
        while (matchLength < maxLen) {
          const dataIdx = pos + matchLength;
          const dictIdx = (dictPos + matchLength) % this.DICTIONARY_SIZE;

          if (data[dataIdx] !== dictionary[dictIdx]) {
            break;
          }
          ++matchLength;
        }

        // Keep best match
        if (matchLength > bestLength) {
          bestLength = matchLength;
          bestMatch = {
            offset: dictPos,
            length: matchLength
          };
        }
      }

      return bestMatch;
    }

    // ===== HUFFMAN ENCODING =====

    _huffmanEncode(data) {
      if (data.length === 0) {
        return [];
      }

      // Build frequency table
      const frequencies = {};
      for (const byte of data) {
        frequencies[byte] = (frequencies[byte] || 0) + 1;
      }

      // Handle special case: single unique byte
      const uniqueBytes = Object.keys(frequencies);
      if (uniqueBytes.length === 1) {
        const byte = parseInt(uniqueBytes[0]);
        const count = data.length;
        return [255, byte, count&0xFF, OpCodes.Shr32(count, 8)&0xFF, OpCodes.Shr32(count, 16)&0xFF];
      }

      // Build Huffman tree and generate codes
      const tree = this._buildHuffmanTree(frequencies);
      const codes = {};
      this._generateHuffmanCodes(tree, '', codes);

      // Encode data to bit string
      let bitString = '';
      for (const byte of data) {
        bitString += codes[byte];
      }

      // Pack to bytes with tree header
      return this._packHuffmanData(frequencies, bitString);
    }

    _buildHuffmanTree(frequencies) {
      const nodes = [];

      // Create leaf nodes
      for (const [byte, freq] of Object.entries(frequencies)) {
        nodes.push({
          byte: parseInt(byte),
          freq: freq,
          left: null,
          right: null
        });
      }

      // Build tree bottom-up
      while (nodes.length > 1) {
        // Sort by frequency
        nodes.sort((a, b) => a.freq - b.freq);

        // Take two lowest frequency nodes
        const left = nodes.shift();
        const right = nodes.shift();

        // Create parent node
        const parent = {
          byte: null,
          freq: left.freq + right.freq,
          left: left,
          right: right
        };

        nodes.push(parent);
      }

      return nodes[0];
    }

    _generateHuffmanCodes(node, code, codes) {
      if (!node) return;

      // Leaf node - assign code
      if (node.byte !== null) {
        codes[node.byte] = code || '0';
        return;
      }

      // Traverse tree
      this._generateHuffmanCodes(node.left, code + '0', codes);
      this._generateHuffmanCodes(node.right, code + '1', codes);
    }

    _packHuffmanData(frequencies, bitString) {
      const output = [];

      // Number of unique symbols
      const symbolCount = Object.keys(frequencies).length;
      output.push(symbolCount&0xFF);

      // Write frequency table
      for (const [byte, freq] of Object.entries(frequencies)) {
        output.push(parseInt(byte));
        output.push(freq&0xFF);
        output.push(OpCodes.Shr8(freq, 8));
      }

      // Write bit length
      output.push(bitString.length&0xFF);
      output.push(OpCodes.Shr8(bitString.length, 8));
      output.push(OpCodes.Shr16(bitString.length, 16));
      output.push(OpCodes.Shr32(bitString.length, 24));

      // Pack bits into bytes
      for (let i = 0; i < bitString.length; i += 8) {
        const chunk = bitString.substring(i, i + 8).padEnd(8, '0');
        const byte = parseInt(chunk, 2);
        output.push(byte);
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length === 0) {
        return [];
      }

      // Stage 1: Huffman decoding
      const huffmanDecoded = this._huffmanDecode(data);

      // Stage 2: ROLZ decoding
      const rolzDecoded = this._rolzDecode(huffmanDecoded);

      return rolzDecoded;
    }

    _huffmanDecode(data) {
      if (data.length === 0) {
        return [];
      }

      // Handle special single-byte case
      if (data[0] === 255) {
        const byte = data[1];
        const count = OpCodes.OrN(data[2], OpCodes.Shl32(data[3], 8), OpCodes.Shl32(data[4], 16));
        return new Array(count).fill(byte);
      }

      let pos = 0;

      // Read symbol count
      const symbolCount = data[pos++];

      // Read frequency table
      const frequencies = {};
      for (let i = 0; i < symbolCount; ++i) {
        const byte = data[pos++];
        const freq = OpCodes.OrN(data[pos++], OpCodes.Shl32(data[pos++], 8));
        frequencies[byte] = freq;
      }

      // Read bit length
      const bitLength = OpCodes.OrN(data[pos++], OpCodes.Shl32(data[pos++], 8), OpCodes.Shl32(data[pos++], 16), OpCodes.Shl32(data[pos++], 24));

      // Rebuild Huffman tree
      const tree = this._buildHuffmanTree(frequencies);

      // Unpack bits
      let bitString = '';
      while (pos < data.length) {
        const byte = data[pos++];
        bitString += byte.toString(2).padStart(8, '0');
      }
      bitString = bitString.substring(0, bitLength);

      // Decode using tree
      const output = [];
      let node = tree;
      for (const bit of bitString) {
        node = bit === '0' ? node.left : node.right;

        if (node.byte !== null) {
          output.push(node.byte);
          node = tree;
        }
      }

      return output;
    }

    _rolzDecode(data) {
      if (data.length === 0) {
        return [];
      }

      let pos = 0;

      // Read header
      const version = data[pos++];
      const originalLength = OpCodes.OrN(data[pos++], OpCodes.Shl32(data[pos++], 8), OpCodes.Shl32(data[pos++], 16), OpCodes.Shl32(data[pos++], 24));

      const output = [];
      const dictionary = new Array(this.DICTIONARY_SIZE).fill(0);
      let dictPos = 0;

      while (pos < data.length && output.length < originalLength) {
        const flag = data[pos++];

        if (flag === 1) {
          // Match
          const offsetHigh = data[pos++];
          const offsetLow = data[pos++];
          const length = data[pos++];
          const offset = OpCodes.OrN(OpCodes.Shl32(offsetHigh, 8), offsetLow);

          // Copy from dictionary
          for (let i = 0; i < length; ++i) {
            const byte = dictionary[(offset + i) % this.DICTIONARY_SIZE];
            output.push(byte);
            dictionary[dictPos] = byte;
            dictPos = (dictPos + 1) % this.DICTIONARY_SIZE;
          }
        } else {
          // Literal
          const byte = data[pos++];
          output.push(byte);
          dictionary[dictPos] = byte;
          dictPos = (dictPos + 1) % this.DICTIONARY_SIZE;
        }
      }

      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new ZlingCompression());

  return ZlingCompression;
}));
