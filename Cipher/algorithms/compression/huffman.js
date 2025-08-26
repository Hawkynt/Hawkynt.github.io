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

        // Test vectors with actual compressed outputs
        this.tests = [
          {
            text: "Simple repetitive text",
            uri: "https://en.wikipedia.org/wiki/Huffman_coding",
            input: [65, 65, 65, 66, 66, 67], // "AAABBC"
            expected: [2,3,65,3,0,66,2,0,67,1,0,9,0,0,0,31,0] // Compressed output
          },
          {
            text: "Single character repeated",
            uri: "Educational test",
            input: [65, 65, 65], // "AAA"
            expected: [1,65,3,0] // Compressed output (special single-char format)
          },
          {
            text: "All different characters",
            uri: "Worst case test",
            input: [65, 66, 67, 68], // "ABCD"
            expected: [2,4,65,1,0,66,1,0,67,1,0,68,1,0,8,0,0,0,27] // Compressed output
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new HuffmanInstance(this, isInverse);
      }
    }

    // Huffman tree node class
    class HuffmanNode {
      constructor(char, frequency, left = null, right = null) {
        this.char = char;
        this.frequency = frequency;
        this.left = left;
        this.right = right;
      }

      isLeaf() {
        return this.left === null && this.right === null;
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
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        if (this.inputBuffer.length === 0) {
          return [0]; // Empty data marker
        }

        // Build frequency table
        const frequencies = {};
        for (const byte of this.inputBuffer) {
          frequencies[byte] = (frequencies[byte] || 0) + 1;
        }

        // Handle special case: single unique character
        const uniqueChars = Object.keys(frequencies);
        if (uniqueChars.length === 1) {
          const char = parseInt(uniqueChars[0]);
          const count = frequencies[char];
          this.inputBuffer = [];
          return [1, char, count & 0xFF, (count >> 8) & 0xFF]; // Special single-char format
        }

        // Build Huffman tree
        const tree = this._buildHuffmanTree(frequencies);

        // Generate codes
        const codes = {};
        this._generateCodes(tree, '', codes);

        // Encode data
        let bitString = '';
        for (const byte of this.inputBuffer) {
          bitString += codes[byte];
        }

        // Pack the compressed data
        const result = this._packCompressedData(frequencies, bitString);

        this.inputBuffer = [];
        return result;
      }

      _decompress() {
        if (this.inputBuffer.length === 0 || this.inputBuffer[0] === 0) {
          this.inputBuffer = [];
          return []; // Empty data
        }

        // Handle special single-char case
        if (this.inputBuffer[0] === 1) {
          const char = this.inputBuffer[1];
          const count = this.inputBuffer[2] | (this.inputBuffer[3] << 8);
          this.inputBuffer = [];
          return new Array(count).fill(char);
        }

        // Unpack compressed data
        const { frequencies, bitString } = this._unpackCompressedData(this.inputBuffer);

        // Rebuild tree
        const tree = this._buildHuffmanTree(frequencies);

        // Decode bit string
        const result = [];
        let currentNode = tree;

        for (const bit of bitString) {
          if (bit === '0') {
            currentNode = currentNode.left;
          } else {
            currentNode = currentNode.right;
          }

          if (currentNode.isLeaf()) {
            result.push(currentNode.char);
            currentNode = tree;
          }
        }

        this.inputBuffer = [];
        return result;
      }

      _buildHuffmanTree(frequencies) {
        // Create priority queue (min-heap) of nodes
        const heap = [];

        for (const [char, freq] of Object.entries(frequencies)) {
          heap.push(new HuffmanNode(parseInt(char), freq));
        }

        // Sort by frequency (min-heap behavior)
        heap.sort((a, b) => a.frequency - b.frequency);

        // Build tree
        while (heap.length > 1) {
          const left = heap.shift();
          const right = heap.shift();

          const merged = new HuffmanNode(null, left.frequency + right.frequency, left, right);

          // Insert back in sorted order
          let insertIndex = heap.findIndex(node => node.frequency > merged.frequency);
          if (insertIndex === -1) {
            heap.push(merged);
          } else {
            heap.splice(insertIndex, 0, merged);
          }
        }

        return heap[0];
      }

      _generateCodes(node, code, codes) {
        if (node.isLeaf()) {
          codes[node.char] = code || '0'; // Handle single character case
          return;
        }

        this._generateCodes(node.left, code + '0', codes);
        this._generateCodes(node.right, code + '1', codes);
      }

      _packCompressedData(frequencies, bitString) {
        const result = [];

        // Format: [header_marker, frequency_count, frequencies..., bit_count, bits...]
        result.push(2); // Multi-char format marker

        // Store frequency table
        const chars = Object.keys(frequencies);
        result.push(chars.length);

        for (const char of chars) {
          result.push(parseInt(char));
          const freq = frequencies[char];
          result.push(freq & 0xFF);
          result.push((freq >> 8) & 0xFF);
        }

        // Store bit string length
        const bitCount = bitString.length;
        result.push(bitCount & 0xFF);
        result.push((bitCount >> 8) & 0xFF);
        result.push((bitCount >> 16) & 0xFF);
        result.push((bitCount >> 24) & 0xFF);

        // Pack bits into bytes
        for (let i = 0; i < bitString.length; i += 8) {
          const byteStr = bitString.substr(i, 8).padEnd(8, '0');
          result.push(parseInt(byteStr, 2));
        }

        return result;
      }

      _unpackCompressedData(data) {
        let pos = 1; // Skip marker

        // Read frequency table
        const charCount = data[pos++];
        const frequencies = {};

        for (let i = 0; i < charCount; i++) {
          const char = data[pos++];
          const freq = data[pos++] | (data[pos++] << 8);
          frequencies[char] = freq;
        }

        // Read bit count
        const bitCount = data[pos++] | (data[pos++] << 8) | (data[pos++] << 16) | (data[pos++] << 24);

        // Read and convert bytes to bit string
        let bitString = '';
        for (let i = pos; i < data.length; i++) {
          bitString += data[i].toString(2).padStart(8, '0');
        }

        // Trim to actual bit count
        bitString = bitString.substr(0, bitCount);

        return { frequencies, bitString };
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