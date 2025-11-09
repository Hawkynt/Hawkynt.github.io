/*
 * Shoco (Short String Compression) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Shoco is an entropy encoder optimized for compressing short ASCII strings.
 * Created by Christian Schramm (Ed-von-Schleck) in 2014.
 * Uses character frequency models and successor prediction for efficient encoding.
 *
 * Reference: https://github.com/Ed-von-Schleck/shoco
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
          CompressionAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem } = AlgorithmFramework;

  // ===== SHOCO COMPRESSION MODEL =====
  // Generated from English language frequency analysis
  // Reference: https://github.com/Ed-von-Schleck/shoco/blob/master/shoco_model.h

  // Most frequent 32 characters by occurrence in English text
  const CHRS_BY_CHR_ID = [
    101, 97, 105, 111, 116, 104, 110, 114, 115, 108, 117, 99,
    119, 109, 100, 98, 112, 102, 103, 118, 121, 107, 45, 72,
    77, 84, 39, 66, 120, 73, 87, 76
  ]; // 'e','a','i','o','t','h','n','r','s','l','u','c','w','m','d','b','p','f','g','v','y','k','-','H','M','T',"'",'B','x','I','W','L'

  // Reverse lookup: ASCII character to ID
  const CHR_IDS_BY_CHR = new Array(256).fill(-1);
  for (let i = 0; i < CHRS_BY_CHR_ID.length; ++i) {
    CHR_IDS_BY_CHR[CHRS_BY_CHR_ID[i]] = i;
  }

  // Successor prediction model: successor_ids[current_chr_id][next_chr_id]
  // Source: https://github.com/Ed-von-Schleck/shoco/blob/master/shoco_model.h
  const SUCCESSOR_IDS_BY_CHR_ID_AND_CHR_ID = [
    [7, 4, 12, -1, 6, -1, 1, 0, 3, 5, -1, 9, -1, 8, 2, -1, 15, 14, -1, 10, 11, -1, -1, -1, -1, -1, -1, -1, 13, -1, -1, -1],
    [-1, -1, 6, -1, 1, -1, 0, 3, 2, 4, 15, 11, -1, 9, 5, 10, 13, -1, 12, 8, 7, 14, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [9, 11, -1, 4, 2, -1, 0, 8, 1, 5, -1, 6, -1, 3, 7, 15, -1, 12, 10, 13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 14, 7, 5, -1, 1, 2, 8, 9, 0, 15, 6, 4, 11, -1, 12, 3, -1, 10, -1, 13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 4, 3, 1, 5, 0, -1, 6, 10, 9, 7, 12, 11, -1, -1, -1, -1, 13, -1, -1, 8, -1, 15, -1, -1, -1, 14, -1, -1, -1, -1, -1],
    [0, 1, 2, 3, 4, -1, -1, 5, 9, 10, 6, -1, -1, 8, 15, 11, -1, 14, -1, -1, 7, -1, 13, -1, -1, -1, 12, -1, -1, -1, -1, -1],
    [2, 8, 7, 4, 3, -1, 9, -1, 6, 11, -1, 5, -1, -1, 0, -1, -1, 14, 1, 15, 10, 12, -1, -1, -1, -1, 13, -1, -1, -1, -1, -1],
    [0, 3, 1, 2, 6, -1, 9, 8, 4, 12, 13, 10, -1, 11, 7, -1, -1, 15, 14, -1, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 6, 3, 4, 1, 2, -1, -1, 5, 10, 7, 9, 11, 12, -1, -1, 8, 14, -1, -1, 15, 13, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 6, 2, 5, 9, -1, -1, -1, 10, 1, 8, -1, 12, 14, 4, -1, 15, 7, -1, 13, 3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [8, 10, 9, 15, 1, -1, 4, 0, 3, 2, -1, 6, -1, 12, 11, 13, 7, 14, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 3, 6, 0, 4, 2, -1, 7, 13, 8, 9, 11, -1, -1, 15, -1, -1, -1, -1, -1, 10, 5, 14, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [3, 0, 1, 4, -1, 2, 5, 6, 7, 8, -1, 14, -1, -1, 9, 15, -1, 12, -1, -1, -1, 10, 11, -1, -1, -1, 13, -1, -1, -1, -1, -1],
    [0, 1, 3, 2, 15, -1, 12, -1, 7, 14, 4, -1, -1, 9, -1, 8, 5, 10, -1, -1, 6, -1, 13, -1, -1, -1, 11, -1, -1, -1, -1, -1],
    [0, 3, 1, 2, -1, -1, 12, 6, 4, 9, 7, -1, -1, 14, 8, -1, -1, 15, 11, 13, 5, -1, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 5, 7, 2, 10, 13, -1, 6, 8, 1, 3, -1, -1, 14, 15, 11, -1, -1, -1, 12, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 2, 6, 3, 7, 10, -1, 1, 9, 4, 8, -1, -1, 15, -1, 12, 5, -1, -1, -1, 11, -1, 13, -1, -1, -1, 14, -1, -1, -1, -1, -1],
    [1, 3, 4, 0, 7, -1, 12, 2, 11, 8, 6, 13, -1, -1, -1, -1, -1, 5, -1, -1, 10, 15, 9, -1, -1, -1, 14, -1, -1, -1, -1, -1],
    [1, 3, 5, 2, 13, 0, 9, 4, 7, 6, 8, -1, -1, 15, -1, 11, -1, -1, 10, -1, 14, -1, 12, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 2, 1, 3, -1, -1, -1, 6, -1, -1, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [1, 11, 4, 0, 3, -1, 13, 12, 2, 7, -1, -1, 15, 10, 5, 8, 14, -1, -1, -1, -1, -1, 9, -1, -1, -1, 6, -1, -1, -1, -1, -1],
    [0, 9, 2, 14, 15, 4, 1, 13, 3, 5, -1, -1, 10, -1, -1, -1, -1, 6, 12, -1, 7, -1, 8, -1, -1, -1, 11, -1, -1, -1, -1, -1],
    [-1, 2, 14, -1, 1, 5, 8, 7, 4, 12, -1, 6, 9, 11, 13, 3, 10, 15, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [0, 1, 3, 2, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4, 3, 1, 5, -1, -1, -1, 0, -1, -1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [2, 8, 4, 1, -1, 0, -1, 6, -1, -1, 5, -1, 7, -1, -1, -1, -1, -1, -1, -1, 10, -1, -1, 9, -1, -1, -1, -1, -1, -1, -1, -1],
    [12, 5, -1, -1, 1, -1, -1, 7, 0, 3, -1, 2, -1, 4, 6, -1, -1, -1, -1, 8, -1, -1, 15, -1, 13, 9, -1, -1, -1, -1, -1, 11],
    [1, 3, 2, 4, -1, -1, -1, 5, -1, 7, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6, -1, -1, -1, -1, -1, -1, -1, -1, 8, -1, -1],
    [5, 3, 4, 12, 1, 6, -1, -1, -1, -1, 8, 2, -1, -1, -1, -1, 0, 9, -1, -1, 11, -1, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, 0, -1, 1, 12, 3, -1, -1, -1, -1, 5, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, 6, -1, 10],
    [2, 3, 1, 4, -1, 0, -1, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, -1, -1, -1, -1, -1, -1, -1, -1, 6, -1, -1],
    [5, 1, 3, 0, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, 9, -1, -1, 6, -1, 7]
  ];

  // Successor character lookup by current char and successor ID
  const CHRS_BY_CHR_AND_SUCCESSOR_ID = [
    [110,100,115,114,32,99,109,116,108,97,120,112,102,98,121,103,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [110,116,108,114,100,32,115,99,121,109,112,103,98,119,107,102,118,120,117,106,0,0,0,0,0,0,0,0,0,0,0,0],
    [110,115,116,111,99,100,108,114,109,97,103,122,112,98,102,107,118,101,120,106,0,0,0,0,0,0,0,0,0,0,0,0],
    [110,114,117,102,109,119,100,112,115,116,108,103,99,107,98,118,119,120,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,32,104,97,105,111,117,114,116,121,115,119,45,111,98,108,97,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,105,111,32,114,117,121,110,108,116,109,100,115,98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [100,101,103,116,111,32,115,97,99,105,121,115,102,110,107,45,101,119,104,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,111,97,105,121,32,115,100,117,116,103,99,109,110,108,107,98,104,102,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,116,32,105,111,117,104,97,115,99,112,121,109,119,108,110,102,105,107,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,108,105,97,32,121,111,100,116,115,102,109,107,117,99,118,119,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [115,110,114,116,108,112,100,99,101,103,109,98,115,97,102,115,105,114,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,111,97,104,116,117,99,114,105,108,107,116,121,107,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,105,111,32,104,110,114,115,97,111,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,32,111,105,112,98,117,121,111,115,101,98,112,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [32,101,105,97,111,117,121,115,114,100,108,119,103,111,98,121,102,118,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,108,121,97,32,117,114,111,105,115,111,117,98,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,114,108,97,111,32,117,105,115,116,104,121,112,111,98,121,102,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,114,97,111,111,102,32,105,116,108,117,121,115,121,117,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,32,114,97,104,111,117,108,105,116,115,121,110,109,98,103,101,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,105,111,32,114,105,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [32,101,111,97,115,32,105,108,99,116,119,112,109,117,98,115,101,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,32,105,115,110,97,116,108,111,114,121,100,115,119,98,105,101,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [97,32,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,111,105,32,117,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,105,111,117,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,104,97,111,114,32,115,119,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [100,115,32,116,109,108,114,118,101,97,108,99,110,98,111,102,119,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,114,111,121,32,105,117,108,117,108,97,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,32,112,97,99,105,116,111,117,116,99,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [110,32,103,115,100,99,116,109,111,102,98,108,116,110,97,102,119,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,104,97,105,111,111,114,32,115,97,97,100,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,111,97,108,105,32,117,115,101,100,105,116,121,97,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ];

  // Compression pack configurations
  const PACKS = [
    {
      word: 0x80000000,
      bytes_packed: 1,
      bytes_unpacked: 2,
      offsets: [26, 24, 24, 24, 24, 24, 24, 24],
      masks: [15, 3, 0, 0, 0, 0, 0, 0],
      header_mask: 0xC0,
      header: 0x80
    },
    {
      word: 0xC0000000,
      bytes_packed: 2,
      bytes_unpacked: 4,
      offsets: [25, 22, 19, 16, 16, 16, 16, 16],
      masks: [15, 7, 7, 7, 0, 0, 0, 0],
      header_mask: 0xE0,
      header: 0xC0
    },
    {
      word: 0xE0000000,
      bytes_packed: 4,
      bytes_unpacked: 8,
      offsets: [23, 19, 15, 11, 8, 5, 2, 0],
      masks: [31, 15, 15, 15, 7, 7, 7, 3],
      header_mask: 0xF0,
      header: 0xE0
    }
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class Shoco extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Shoco";
      this.description = "Short string compression optimized for English text using character frequency models and successor prediction. Guarantees compressed size never exceeds original for plain ASCII input.";
      this.inventor = "Christian Schramm (Ed-von-Schleck)";
      this.year = 2014;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Statistical";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DE;

      // Documentation and references
      this.documentation = [
        new LinkItem("Shoco GitHub Repository", "https://github.com/Ed-von-Schleck/shoco"),
        new LinkItem("Shoco Official Website", "https://ed-von-schleck.github.io/shoco/"),
        new LinkItem("MIT License", "https://github.com/Ed-von-Schleck/shoco/blob/master/LICENSE")
      ];

      this.references = [
        new LinkItem("Entropy Encoding", "https://en.wikipedia.org/wiki/Entropy_encoding"),
        new LinkItem("Character Frequency Analysis", "https://en.wikipedia.org/wiki/Letter_frequency")
      ];

      // Test vectors from official Go implementation
      // Source: https://github.com/tmthrgd/shoco/blob/master/shoco_test.go
      this.tests = [
        {
          text: "Empty string compression",
          uri: "https://github.com/tmthrgd/shoco/blob/master/shoco_test.go",
          input: OpCodes.AnsiToBytes(""),
          expected: []
        },
        {
          text: "Single word 'test'",
          uri: "https://github.com/tmthrgd/shoco/blob/master/shoco_test.go",
          input: OpCodes.AnsiToBytes("test"),
          expected: OpCodes.Hex8ToBytes("c899")
        },
        {
          text: "Algorithm name 'shoco'",
          uri: "https://github.com/tmthrgd/shoco/blob/master/shoco_test.go",
          input: OpCodes.AnsiToBytes("shoco"),
          expected: OpCodes.Hex8ToBytes("a26fac")
        },
        {
          text: "Short sentence with non-ASCII",
          uri: "https://github.com/tmthrgd/shoco/blob/master/shoco_test.go",
          input: new Uint8Array([0xC3, 0x9C, 0x62, 0x65, 0x72, 0x67, 0x72, 0xC3, 0xB6, 0xC3, 0x9F, 0x65, 0x6E, 0x74, 0x72, 0xC3, 0xA4, 0x67, 0x65, 0x72]), // "Übergrößenträger"
          expected: OpCodes.Hex8ToBytes("00c3009cbc72677200c300b600c3009fc05e00c300a46780")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ShocoInstance(this, isInverse);
    }
  }

  class ShocoInstance extends IAlgorithmInstance {
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
      const input = this.inputBuffer;
      const output = [];
      let inPos = 0;

      while (inPos < input.length) {
        const chrId = CHR_IDS_BY_CHR[input[inPos]];

        // Character not in model - use sentinel escape
        if (chrId < 0) {
          output.push(0x00);
          output.push(input[inPos]);
          ++inPos;
          continue;
        }

        // Find longest successor chain
        const indices = [chrId];
        let nextPos = inPos + 1;
        let lastChrId = chrId;

        while (nextPos < input.length && indices.length < 8) {
          const nextChr = input[nextPos];
          const nextChrId = CHR_IDS_BY_CHR[nextChr];

          if (nextChrId < 0) break;

          const successorId = SUCCESSOR_IDS_BY_CHR_ID_AND_CHR_ID[lastChrId][nextChrId];
          if (successorId < 0) break;

          indices.push(successorId);
          lastChrId = nextChrId;
          ++nextPos;
        }

        // Find suitable pack (smallest that fits)
        let packIndex = -1;
        for (let p = 0; p < PACKS.length; ++p) {
          if (indices.length <= PACKS[p].bytes_unpacked) {
            let valid = true;
            for (let i = 0; i < indices.length; ++i) {
              if (indices[i] > PACKS[p].masks[i]) {
                valid = false;
                break;
              }
            }
            if (valid) {
              packIndex = p;
              break; // Use first (smallest) pack that fits
            }
          }
        }

        // No suitable pack - output first character uncompressed
        if (packIndex < 0) {
          output.push(0x00);
          output.push(input[inPos]);
          ++inPos;
          continue;
        }

        // Pack indices into word
        const pack = PACKS[packIndex];
        let word = pack.word >>> 0;

        for (let i = 0; i < indices.length; ++i) {
          word = (word | OpCodes.Shl32(indices[i], pack.offsets[i])) >>> 0;
        }

        // Output packed bytes (big-endian)
        for (let i = 0; i < pack.bytes_packed; ++i) {
          output.push(OpCodes.Shr32(word, 24 - (i * 8)) & 0xFF);
        }

        inPos = nextPos;
      }

      this.inputBuffer = [];
      return output;
    }

    _decompress() {
      const input = this.inputBuffer;
      const output = [];
      let inPos = 0;

      while (inPos < input.length) {
        const byte = input[inPos];

        // Escape sequence - literal byte follows
        if (byte === 0x00) {
          ++inPos;
          if (inPos < input.length) {
            output.push(input[inPos]);
            ++inPos;
          }
          continue;
        }

        // Determine pack type by header bits
        let packIndex = -1;
        for (let p = 0; p < PACKS.length; ++p) {
          if ((byte & PACKS[p].header_mask) === PACKS[p].header) {
            packIndex = p;
            break;
          }
        }

        // Invalid header - treat as literal
        if (packIndex < 0) {
          output.push(byte);
          ++inPos;
          continue;
        }

        const pack = PACKS[packIndex];

        // Read packed word (big-endian)
        if (inPos + pack.bytes_packed > input.length) {
          // Insufficient data - output remaining bytes as-is
          while (inPos < input.length) {
            output.push(input[inPos]);
            ++inPos;
          }
          break;
        }

        let word = 0;
        for (let i = 0; i < pack.bytes_packed; ++i) {
          word = (word | OpCodes.Shl32(input[inPos + i], 24 - (i * 8))) >>> 0;
        }
        inPos += pack.bytes_packed;

        // Extract indices
        const chrId = OpCodes.Shr32(word, pack.offsets[0]) & pack.masks[0];
        const firstChr = CHRS_BY_CHR_ID[chrId];
        output.push(firstChr);

        let lastChr = firstChr;
        for (let i = 1; i < pack.bytes_unpacked; ++i) {
          const mask = pack.masks[i];
          if (mask === 0) break;

          const successorId = OpCodes.Shr32(word, pack.offsets[i]) & mask;
          const chr = CHRS_BY_CHR_AND_SUCCESSOR_ID[lastChr][successorId];

          if (chr === 0 || chr === undefined) break;

          output.push(chr);
          lastChr = chr;
        }
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Shoco());

  return Shoco;
}));
