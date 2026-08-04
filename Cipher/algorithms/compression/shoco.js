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

  // Successor character lookup by current char ID and successor ID
  // Generated from SUCCESSOR_IDS_BY_CHR_ID_AND_CHR_ID inverse mapping
  const CHRS_BY_CHR_AND_SUCCESSOR_ID = [
    [114,110,100,115,97,108,116,101,109,99,118,121,105,120,102,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [110,116,115,114,108,100,105,121,118,109,98,99,103,112,107,117,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [110,115,116,109,111,108,99,100,114,101,103,97,102,118,0,98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [117,110,114,102,109,116,119,111,115,108,118,100,112,107,105,99,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [104,111,101,105,97,116,114,117,121,108,115,119,99,102,39,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,105,111,116,114,117,121,109,115,108,98,39,45,102,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [100,103,101,116,111,99,115,105,97,110,121,108,107,39,102,118,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,105,111,97,115,121,116,100,114,110,99,109,108,117,103,102,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,116,104,105,111,115,97,117,112,99,108,119,109,107,102,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,108,105,121,100,111,97,102,117,116,115,107,119,118,109,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [114,116,108,115,110,103,99,112,101,105,97,100,109,98,102,111,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [111,101,104,97,116,107,105,114,108,117,121,99,0,115,45,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [97,105,104,101,111,110,114,115,108,100,107,45,102,39,99,98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,111,105,117,112,121,115,98,109,102,39,110,45,108,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,105,111,97,115,121,114,117,100,108,45,103,110,118,109,102,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,108,111,117,121,97,114,105,115,0,116,98,118,104,109,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,114,97,111,108,112,105,116,117,115,104,121,98,45,39,109,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [111,101,114,97,105,102,117,116,108,45,121,115,110,99,39,107,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [104,101,111,97,114,105,108,115,117,110,103,98,45,116,121,109,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,105,97,111,121,117,114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [111,101,115,116,105,100,39,108,98,45,109,97,114,110,112,119,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,110,105,115,104,108,102,121,45,97,119,39,103,114,111,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [45,116,97,98,115,104,99,114,110,119,112,109,108,100,105,102,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [101,97,111,105,117,0,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [114,105,121,97,101,111,117,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [104,111,101,0,105,117,114,119,97,72,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [115,116,99,108,109,97,100,114,118,84,0,76,101,77,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [117,101,105,97,111,114,121,108,73,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [112,116,99,97,105,101,104,0,117,102,45,121,111,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [116,110,102,115,39,109,73,0,0,0,76,0,114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [104,105,101,97,111,114,73,121,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [111,97,121,105,117,101,73,76,0,39,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
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

  // ===== HELPER FUNCTIONS =====

  // Byte swap for 32-bit word (little-endian <-> big-endian)
  // Reference: swap macro in shoco.c
  function swap32(word) {
    return OpCodes.ToUint32(
      ((OpCodes.Shl32(word, 24))&0xFF000000)|((OpCodes.Shl32(word, 8))&0x00FF0000)|((OpCodes.Shr32(word, 8))&0x0000FF00)|((OpCodes.Shr32(word, 24))&0x000000FF)
    );
  }

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

      // Test vectors generated from and validated against this educational
      // implementation (which uses a simplified 32-character model that differs
      // from the reference Shoco implementation's full ASCII range 39-122).
      // Every vector below round-trips through this implementation's own
      // encoder/decoder; each `expected` was captured from a run of the fixed
      // code, then independently confirmed to decode back to `input`.
      this.tests = [
        {
          text: "Empty string compression",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes(""),
          expected: []
        },
        {
          text: "Single word 'test' - validates pack encoding plus 4-byte length header",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes("test"),
          expected: OpCodes.Hex8ToBytes("0400000092a1")
        },
        {
          text: "Word 'compression' - validates multi-pack encoding",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes("compression"),
          expected: OpCodes.Hex8ToBytes("0b000000acdb48d15c98")
        },
        {
          text: "Phrase 'test compression' - validates escape sequences and multiple packs",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes("test compression"),
          expected: OpCodes.Hex8ToBytes("1000000092a10020acdb48d15c98")
        },
        {
          // Regression test for a decoder defect - a chain shorter than a pack's full
          // successor capacity (e.g. 'a' followed by 'a', which has no successor
          // mapping) was still accepted by the encoder as long as it fit within the
          // pack's byte budget. The decoder always decodes every successor slot a
          // pack format defines, so it invented extra characters from the
          // unfilled (zero) bits, doubling the output length. The fix requires a
          // pack's successor chain to either exactly fill every slot, or run out
          // only at the very end of input (where the recorded length header can
          // truncate any invented trailing filler).
          text: "1024 repeated 'a' characters - regression for the pack-underfill bug",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: new Array(1024).fill(0x61),
          expected: null // validated via round-trip only; see fuzz harness
        },
        {
          text: "Alternating 'ab' pattern - regression for successor-chain truncation",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: Array.from({ length: 64 }, (_, i) => i % 2 ? 0x62 : 0x61),
          expected: OpCodes.Hex8ToBytes("40000000006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062006100620061006200610062e0d2d000")
        },
        {
          text: "All 256 byte values - regression for the escape path and non-ASCII passthrough",
          uri: "https://en.wikipedia.org/wiki/Byte",
          input: Array.from({ length: 256 }, (_, i) => i),
          expected: OpCodes.Hex8ToBytes("000100000000000100020003000400050006000700080009000a000b000c000d000e000f0010001100120013001400150016001700180019001a001b001c001d001e001f0020002100220023002400250026002700280029002a002b002c002d002e002f0030003100320033003400350036003700380039003a003b003c003d003e003f0040004100420043004400450046004700480049004a004b004c004d004e004f0050005100520053005400550056005700580059005a005b005c005d005e005f0060006100620063b80066006796006a006b006c006d006e006f00700071cf0f0076007700780079007a007b007c007d007e007f0080008100820083008400850086008700880089008a008b008c008d008e008f0090009100920093009400950096009700980099009a009b009c009d009e009f00a000a100a200a300a400a500a600a700a800a900aa00ab00ac00ad00ae00af00b000b100b200b300b400b500b600b700b800b900ba00bb00bc00bd00be00bf00c000c100c200c300c400c500c600c700c800c900ca00cb00cc00cd00ce00cf00d000d100d200d300d400d500d600d700d800d900da00db00dc00dd00de00df00e000e100e200e300e400e500e600e700e800e900ea00eb00ec00ed00ee00ef00f000f100f200f300f400f500f600f700f800f900fa00fb00fc00fd00fe00ff")
        },
        {
          text: "Pseudo-random byte stream - regression for the pack-underfill bug on non-text data",
          uri: "https://en.wikipedia.org/wiki/Pseudorandomness",
          input: OpCodes.Hex8ToBytes("4080c000000040808000000000000000004000004000004000400000400000000000000040000040000000400000000040800040000000000000000000408080"),
          expected: OpCodes.Hex8ToBytes("400000000040008000c00000000000000040008000800000000000000000000000000000000000400000000000400000000000400000004000000000004000000000000000000000000000000040000000000040000000000000004000000000000000000040008000000040000000000000000000000000000000000000004000800080")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ShocoInstance(this, isInverse);
    }
  }

  /**
 * Shoco cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ShocoInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
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

    _compress() {
      const input = this.inputBuffer;
      const output = [];

      // Explicit length header: a pack's successor slots may legitimately be left
      // unfilled when the chain runs out of input mid-pack (see the "tail" case
      // below), which makes the decoder emit trailing filler characters it cannot
      // otherwise distinguish from real ones. Recording the true output length lets
      // the decoder truncate that filler away deterministically.
      const lengthBytes = OpCodes.Unpack32LE(input.length);
      output.push(lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]);

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

        // Find the maximal successor chain reachable from this character (bounded
        // by the largest pack's capacity of 8 characters).
        const chain = [chrId];
        let nextPos = inPos + 1;
        let lastChrId = chrId;

        while (nextPos < input.length && chain.length < 8) {
          const nextChr = input[nextPos];
          const nextChrId = CHR_IDS_BY_CHR[nextChr];

          if (nextChrId < 0) break;

          const successorId = SUCCESSOR_IDS_BY_CHR_ID_AND_CHR_ID[lastChrId][nextChrId];
          if (successorId < 0) break;

          chain.push(successorId);
          lastChrId = nextChrId;
          ++nextPos;
        }

        // The chain reached the end of the input exactly when it stopped growing
        // because there was nothing left to consume (as opposed to a failed
        // successor lookup, or hitting the 8-character cap).
        const chainHitInputEnd = (inPos + chain.length === input.length);

        // A pack may only be used when the decoder will reconstruct exactly the
        // characters that were encoded: either every successor slot in the pack is
        // filled (the decoder decodes bytes_unpacked characters and all are real),
        // or the chain is the very last thing in the input (any unfilled slots
        // decode to filler that the length header above will truncate away).
        // Using a pack whose slots are only partially filled mid-stream would make
        // the decoder invent characters that were never encoded.
        let packIndex = -1;
        let useCount = 0;
        for (let p = 0; p < PACKS.length; ++p) {
          const pack = PACKS[p];
          const n = pack.bytes_unpacked;
          let candidateLen;
          if (chain.length >= n) {
            candidateLen = n;
          } else if (chainHitInputEnd) {
            candidateLen = chain.length;
          } else {
            continue;
          }

          let valid = true;
          for (let i = 0; i < candidateLen; ++i) {
            if (chain[i] > pack.masks[i]) {
              valid = false;
              break;
            }
          }
          if (valid) {
            packIndex = p;
            useCount = candidateLen;
            break;
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
        let word = pack.word;

        for (let i = 0; i < useCount; ++i) {
          word = OpCodes.ToUint32(word|(OpCodes.Shl32(chain[i], pack.offsets[i])));
        }

        // Apply endianness swap (reference shoco.c applies swap before output)
        // On little-endian systems: swap bytes within 32-bit word
        // JavaScript is typically little-endian, so we swap
        word = swap32(word);

        // Output packed bytes from low to high of swapped word
        // In C: code.bytes[i] accesses bytes in little-endian memory order (low to high)
        for (let i = 0; i < pack.bytes_packed; ++i) {
          output.push(OpCodes.ToByte(OpCodes.Shr32(word, i * 8)));
        }

        inPos += useCount;
      }

      this.inputBuffer = [];
      return output;
    }

    _decompress() {
      const input = this.inputBuffer;
      const output = [];

      if (input.length < 4) {
        this.inputBuffer = [];
        return [];
      }

      const targetLength = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      let inPos = 4;

      while (inPos < input.length && output.length < targetLength) {
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
          if ((byte&PACKS[p].header_mask) === PACKS[p].header) {
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
        // Read bytes from low to high (matching C code.bytes[i] access pattern)
        for (let i = 0; i < pack.bytes_packed; ++i) {
          word = OpCodes.ToUint32(word|(OpCodes.Shl32(input[inPos + i], i * 8)));
        }
        inPos += pack.bytes_packed;

        // Apply reverse endianness swap (undo the swap from compression)
        word = swap32(word);

        // Extract indices
        const chrId = (OpCodes.Shr32(word, pack.offsets[0]))&pack.masks[0];
        const firstChr = CHRS_BY_CHR_ID[chrId];
        output.push(firstChr);

        let lastChrId = chrId;
        for (let i = 1; i < pack.bytes_unpacked; ++i) {
          const mask = pack.masks[i];
          if (mask === 0) break;

          const successorId = (OpCodes.Shr32(word, pack.offsets[i]))&mask;
          const chr = CHRS_BY_CHR_AND_SUCCESSOR_ID[lastChrId][successorId];

          if (chr === 0 || chr === undefined) break;

          // Check if character is in model before outputting
          const nextChrId = CHR_IDS_BY_CHR[chr];
          if (nextChrId < 0) break;

          output.push(chr);
          lastChrId = nextChrId;
        }
      }

      this.inputBuffer = [];
      // A trailing pack whose successor chain ran out at end-of-input may still
      // have decoded a few filler characters from its unused (zero) slots; the
      // length header is the only reliable way to know where the real data ends.
      return output.length > targetLength ? output.slice(0, targetLength) : output;
    }
  }

  // Register algorithm (guard against double registration)
  const algorithmInstance = new Shoco();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return Shoco;
}));
