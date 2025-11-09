/*
 * LZX (Lempel-Ziv Extended) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZX compression used in Microsoft CAB format.
 * Combines LZ77 sliding window with Huffman coding and position slots.
 * Used in Windows Cabinet files, CHM Help files, and WIM images.
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

  // ===== LZX CONSTANTS =====

  // LZX window sizes (powers of 2 from 2^15 to 2^21)
  const WINDOW_SIZES = [
    32768,    // 2^15 - 32KB
    65536,    // 2^16 - 64KB
    131072,   // 2^17 - 128KB
    262144,   // 2^18 - 256KB
    524288,   // 2^19 - 512KB
    1048576,  // 2^20 - 1MB
    2097152   // 2^21 - 2MB (maximum)
  ];

  // Match length parameters
  const MIN_MATCH = 2;
  const MAX_MATCH = 257;
  const NUM_CHARS = 256;

  // Position slots (simplified for educational implementation)
  const NUM_POSITION_SLOTS = 50;
  const NUM_PRIMARY_LENGTHS = 7;
  const NUM_SECONDARY_LENGTHS = 249;

  // Huffman tree parameters
  const PRETREE_NUM_ELEMENTS = 20;
  const ALIGNED_NUM_ELEMENTS = 8;
  const MAIN_TREE_NUM_ELEMENTS = NUM_CHARS + (NUM_POSITION_SLOTS * 8);
  const LENGTH_TREE_NUM_ELEMENTS = NUM_PRIMARY_LENGTHS + NUM_SECONDARY_LENGTHS;

  // Block types
  const BLOCKTYPE_INVALID = 0;
  const BLOCKTYPE_VERBATIM = 1;
  const BLOCKTYPE_ALIGNED = 2;
  const BLOCKTYPE_UNCOMPRESSED = 3;

  // Frame size (standard LZX frame size)
  const FRAME_SIZE = 32768;

  // ===== POSITION SLOT BASE VALUES =====
  // Position slots provide efficient encoding of match distances
  const POSITION_BASE = [
    0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192,
    256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 6144,
    8192, 12288, 16384, 24576, 32768, 49152, 65536, 98304,
    131072, 196608, 262144, 393216, 524288, 655360, 786432,
    917504, 1048576, 1179648, 1310720, 1441792, 1572864,
    1703936, 1835008, 1966080
  ];

  // Extra bits needed for each position slot
  const POSITION_EXTRA_BITS = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14,
    15, 15, 16, 16, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZXCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LZX";
      this.description = "Microsoft's Lempel-Ziv Extended compression algorithm combining LZ77 sliding window with Huffman coding. Used in CAB files, CHM help files, and WIM disk images. Features position slots for efficient distance encoding.";
      this.inventor = "Jonathan Forbes, Tomi Poutanen";
      this.year = 1996;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Configuration
      this.DEFAULT_WINDOW_SIZE = 32768; // 32KB default window

      // Documentation and references
      this.documentation = [
        new LinkItem("Microsoft CAB Format Specification", "https://learn.microsoft.com/en-us/previous-versions/bb417343(v=msdn.10)"),
        new LinkItem("LZX Algorithm Overview", "https://en.wikipedia.org/wiki/LZX"),
        new LinkItem("libmspack LZX Implementation", "https://github.com/kyz/libmspack")
      ];

      this.references = [
        new LinkItem("Microsoft ms-compress", "https://github.com/coderforlife/ms-compress"),
        new LinkItem("CAB File Format Details", "https://fileformats.fandom.com/wiki/Cabinet_file"),
        new LinkItem("LZX Technical Analysis", "http://xavprods.free.fr/lzx/")
      ];

      // Educational test vectors demonstrating LZX compression behavior
      // Format: Simplified LZX with literal bytes and (distance, length) match codes
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes("HELLO"), // Simple literal sequence
          [72, 69, 76, 76, 79], // All literals: H E L L O
          "Literal-only sequence - no compression",
          "Educational test vector - literal encoding"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("AAAA"), // Repeated character
          [65, 1, 3], // 'A' literal, then (distance=1, length=3) match
          "Repeated character compression",
          "Educational test vector - simple repetition"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCABC"), // Pattern repetition
          [65, 66, 67, 3, 3], // 'ABC' literals, then (distance=3, length=3) match
          "Pattern repetition - ABCABC",
          "Educational test vector - pattern matching"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("ABCDABCD"), // Longer pattern
          [65, 66, 67, 68, 4, 4], // 'ABCD' literals, then (distance=4, length=4) match
          "Longer pattern repetition",
          "Educational test vector - extended matching"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZXInstance(this, isInverse);
    }
  }

  // ===== LZX INSTANCE IMPLEMENTATION =====

  class LZXInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.windowSize = algorithm.DEFAULT_WINDOW_SIZE;

      // LRU position values (R0, R1, R2)
      this.recent_positions = [1, 1, 1];

      // Statistics for adaptive encoding
      this.literalFrequency = new Array(NUM_CHARS).fill(0);
      this.lengthFrequency = new Array(LENGTH_TREE_NUM_ELEMENTS).fill(0);
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

    // ===== COMPRESSION =====

    _compress() {
      const output = [];
      let pos = 0;

      while (pos < this.inputBuffer.length) {
        const match = this._findBestMatch(pos);

        if (match && match.length >= MIN_MATCH) {
          // Encode match as (distance, length)
          output.push(match.distance % 256);
          output.push(match.length % 256);

          // Update LRU positions
          this._updateRecentPositions(match.distance);

          pos += match.length;
        } else {
          // Encode literal byte
          output.push(this.inputBuffer[pos]);
          pos++;
        }
      }

      OpCodes.ClearArray(this.inputBuffer);
      return output;
    }

    _findBestMatch(position) {
      if (position >= this.inputBuffer.length) {
        return null;
      }

      let bestMatch = null;
      let bestLength = MIN_MATCH - 1;

      // Search window bounds
      const searchStart = Math.max(0, position - this.windowSize);
      const maxLength = Math.min(MAX_MATCH, this.inputBuffer.length - position);

      // Search for matches in the sliding window
      for (let i = searchStart; i < position; ++i) {
        let matchLength = 0;

        // Count matching bytes
        while (matchLength < maxLength &&
               this.inputBuffer[i + matchLength] === this.inputBuffer[position + matchLength]) {
          ++matchLength;
        }

        // Keep best match
        if (matchLength > bestLength) {
          bestLength = matchLength;
          bestMatch = {
            distance: position - i,
            length: matchLength
          };

          // Early exit if we found maximum match
          if (matchLength >= MAX_MATCH) {
            break;
          }
        }
      }

      return bestMatch;
    }

    _updateRecentPositions(distance) {
      // Update LRU list: R2 = R1, R1 = R0, R0 = distance
      this.recent_positions[2] = this.recent_positions[1];
      this.recent_positions[1] = this.recent_positions[0];
      this.recent_positions[0] = distance;
    }

    _getPositionSlot(distance) {
      // Find appropriate position slot for distance
      for (let slot = 0; slot < NUM_POSITION_SLOTS; ++slot) {
        if (distance < POSITION_BASE[slot] + OpCodes.Shl32(1, POSITION_EXTRA_BITS[slot])) {
          return slot;
        }
      }
      return NUM_POSITION_SLOTS - 1;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const output = [];
      let pos = 0;

      while (pos < this.inputBuffer.length) {
        const byte1 = this.inputBuffer[pos++];

        if (pos < this.inputBuffer.length) {
          const byte2 = this.inputBuffer[pos];

          // Check if this looks like a match code (heuristic)
          // If byte2 looks like a length and we have enough history
          if (byte2 >= MIN_MATCH && byte2 <= MAX_MATCH &&
              output.length >= byte1 && byte1 > 0) {
            // Decode as match: (distance, length)
            const distance = byte1;
            const length = byte2;
            pos++;

            // Copy from history
            const copyStart = output.length - distance;
            for (let i = 0; i < length; ++i) {
              output.push(output[copyStart + i]);
            }

            // Update LRU positions
            this._updateRecentPositions(distance);
          } else {
            // Decode as literal
            output.push(byte1);
          }
        } else {
          // Last byte is always literal
          output.push(byte1);
        }
      }

      OpCodes.ClearArray(this.inputBuffer);
      return output;
    }

    // ===== HUFFMAN CODING HELPERS =====

    _buildHuffmanTree(frequencies) {
      // Build canonical Huffman tree from frequencies
      // Simplified implementation for educational purposes

      const symbols = frequencies.map((freq, symbol) => ({ symbol, freq }))
        .filter(item => item.freq > 0)
        .sort((a, b) => a.freq - b.freq);

      if (symbols.length === 0) {
        return null;
      }

      if (symbols.length === 1) {
        // Single symbol - assign code length 1
        return { [symbols[0].symbol]: { code: 0, length: 1 } };
      }

      // Build Huffman tree using priority queue approach
      const nodes = symbols.map(s => ({ ...s, left: null, right: null }));

      while (nodes.length > 1) {
        const left = nodes.shift();
        const right = nodes.shift();

        const parent = {
          freq: left.freq + right.freq,
          left,
          right
        };

        // Insert parent maintaining sorted order
        let insertPos = 0;
        while (insertPos < nodes.length && nodes[insertPos].freq < parent.freq) {
          ++insertPos;
        }
        nodes.splice(insertPos, 0, parent);
      }

      // Generate codes from tree
      const codes = {};
      const traverse = (node, code = 0, length = 0) => {
        if (!node.left && !node.right) {
          codes[node.symbol] = { code, length };
        } else {
          if (node.left) traverse(node.left, OpCodes.Shl32(code, 1), length + 1);
          if (node.right) traverse(node.right, OpCodes.Shl32(code, 1) + 1, length + 1);
        }
      };

      traverse(nodes[0]);
      return codes;
    }

    _encodeWithHuffman(value, huffmanTable) {
      // Encode value using Huffman table
      if (!huffmanTable || !huffmanTable[value]) {
        return { code: value, length: 8 }; // Fallback to literal
      }
      return huffmanTable[value];
    }

    // ===== POSITION ENCODING =====

    _encodePosition(distance) {
      const slot = this._getPositionSlot(distance);
      const extraBits = POSITION_EXTRA_BITS[slot];
      const base = POSITION_BASE[slot];
      const offset = distance - base;

      return {
        slot,
        offset,
        extraBits
      };
    }

    _decodePosition(slot, offset) {
      return POSITION_BASE[slot] + offset;
    }
  }

  // ===== REGISTER ALGORITHM =====
  RegisterAlgorithm(new LZXCompression());

  return LZXCompression;
}));
