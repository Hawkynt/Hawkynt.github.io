/*
 * Shoco (Short String Compression) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A Shoco-style short-string compressor: Shoco (Christian Schramm /
 * "Ed-von-Schleck", 2014) compresses short ASCII strings by keeping a small
 * alphabet of the most common characters and, for runs of consecutive
 * alphabet characters, encoding each character after the first as the rank
 * of its predecessor's most likely successors rather than the character
 * itself.
 *
 * This is a clean-room implementation of Shoco's real bit-packing scheme --
 * the multi-tier "pack" layout from the reference's shoco.c/shoco_model.h --
 * built from that source's packs[] table and compress/decompress logic, not
 * a port of it. It is byte-identical to CompressionWorkbench's BB_Shoco,
 * which trains its own small 32-character alphabet and successor-rank
 * tables from an embedded sample corpus rather than reusing Shoco's own
 * published shoco_model.h (that header is itself the output of Shoco's
 * model generator run over a specific training corpus owned by the Shoco
 * project, not part of the algorithm's specification). Only the three pack
 * tiers' fixed bit-field shapes are treated as part of the algorithm and
 * reproduced exactly; the alphabet and successor ranks are trained here
 * from the same corpus as the C# reference.
 *
 * Reference: https://github.com/Ed-von-Schleck/shoco
 * Reference source (pack tiers, decode_header, compress/decompress):
 *   https://github.com/Ed-von-Schleck/shoco/blob/master/shoco.c
 * Reference default model (packs[] table shape):
 *   https://github.com/Ed-von-Schleck/shoco/blob/master/shoco_model.h
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

  // ===== TRAINED MODEL =====
  // Trained on the same small self-authored sample text as CompressionWorkbench's
  // BB_Shoco (a pangram-adjacent passage of ordinary prose, chosen to get
  // reasonable digraph statistics and guarantee common letters and punctuation
  // all appear). This is NOT Shoco's own published shoco_model.h -- that table
  // is trained-model data owned by the Shoco project, not part of the
  // algorithm's specification -- so a local model is trained here instead,
  // exactly as the C# reference does.
  const TRAINING_CORPUS =
    "the quick brown fox jumps over the lazy dog, and then it runs back home " +
    "through the forest near the river; while thinking about all the things " +
    "that happened during the long and eventful day. the day had just come to " +
    "an end as the sun began to set slowly behind the distant mountains, " +
    "casting long shadows across the quiet valley where the animals were " +
    "settling down for the night, and the stars started to appear one by one " +
    "in the darkening sky above the peaceful countryside - it was truly a " +
    "wonderful sight to behold.";

  // The three fixed pack tiers, from smallest to largest: for each, the number
  // of leading one-bits in the unary header, and the bit width of the leader
  // character field followed by each successor-rank field. This exact shape
  // (2/4/8 characters packed into 1/2/4 bytes, with these specific per-position
  // bit widths) mirrors the reference's default packs[] table.
  const PACKS = [
    { headerOnes: 1, fieldBits: [4, 2] },
    { headerOnes: 2, fieldBits: [4, 3, 3, 3] },
    { headerOnes: 3, fieldBits: [5, 4, 4, 4, 3, 3, 3, 2] }
  ];

  function totalBits(pack) {
    let sum = pack.headerOnes + 1;
    for (const bits of pack.fieldBits) sum += bits;
    return sum;
  }

  const MAX_CHAIN_LENGTH = PACKS[PACKS.length - 1].fieldBits.length;

  // Train alphabet: top 32 most frequent bytes in the (lowercased) corpus,
  // ties broken by ascending byte value -- matches the reference's
  // OrderByDescending(unigram).ThenBy(byteValue).Take(32).
  function trainModel(corpus) {
    const lower = corpus.toLowerCase();

    const unigram = new Array(256).fill(0);
    for (let i = 0; i < lower.length; ++i) {
      const code = lower.charCodeAt(i);
      if (code < 256) unigram[code]++;
    }

    const candidates = [];
    for (let b = 0; b < 256; ++b)
      if (unigram[b] > 0) candidates.push(b);

    candidates.sort((a, b) => {
      const diff = unigram[b] - unigram[a];
      return diff !== 0 ? diff : a - b;
    });

    const alphabet = candidates.slice(0, 32);
    const n = alphabet.length;

    const charIdOf = new Array(256).fill(-1);
    for (let id = 0; id < n; ++id)
      charIdOf[alphabet[id]] = id;

    const bigram = [];
    for (let i = 0; i < n; ++i) bigram.push(new Array(n).fill(0));

    for (let i = 0; i + 1 < lower.length; ++i) {
      const a = lower.charCodeAt(i);
      const b = lower.charCodeAt(i + 1);
      if (a >= 256 || b >= 256) continue;
      const aId = charIdOf[a];
      const bId = charIdOf[b];
      if (aId >= 0 && bId >= 0) bigram[aId][bId]++;
    }

    const successorIdAt = [];
    const successorRankOf = [];
    for (let c = 0; c < n; ++c) {
      const order = [];
      for (let next = 0; next < n; ++next) order.push(next);

      order.sort((x, y) => {
        const byBigram = bigram[c][y] - bigram[c][x];
        if (byBigram !== 0) return byBigram;
        const byUnigram = unigram[alphabet[y]] - unigram[alphabet[x]];
        if (byUnigram !== 0) return byUnigram;
        return x - y;
      });

      successorIdAt.push(order);
      const rankOf = new Array(n).fill(0);
      for (let rank = 0; rank < n; ++rank)
        rankOf[order[rank]] = rank;
      successorRankOf.push(rankOf);
    }

    return { alphabet, charIdOf, successorIdAt, successorRankOf };
  }

  const MODEL = trainModel(TRAINING_CORPUS);

  // ===== ALGORITHM IMPLEMENTATION =====

  class Shoco extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Shoco";
      this.description = "Short string compression optimized for English text using a trained character alphabet and successor-rank prediction, packed via Shoco's real multi-tier bit layout (1-/2-/4-byte packs with a unary tier header).";
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
        new LinkItem("Shoco source (pack tiers, decode_header)", "https://github.com/Ed-von-Schleck/shoco/blob/master/shoco.c"),
        new LinkItem("Shoco default model (packs[] table shape)", "https://github.com/Ed-von-Schleck/shoco/blob/master/shoco_model.h"),
        new LinkItem("Entropy Encoding", "https://en.wikipedia.org/wiki/Entropy_encoding")
      ];

      // Test vectors with actual compressed outputs.
      // Wire format (byte-identical to CompressionWorkbench's BB_Shoco):
      //   4 bytes original length (little-endian)
      //   Then a stream of tokens:
      //     0x00, byte                -- escaped literal (byte 0 or byte >= 0x80)
      //     byte < 0x80               -- plain literal (not in the trained alphabet)
      //     packed group (1/2/4 bytes, MSB-first unary tier header 10/110/1110)
      this.tests = [
        {
          text: "Empty string compression",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes(""),
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single word 'test'",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes("test"),
          expected: [4, 0, 0, 0, 197, 121]
        },
        {
          text: "Word 'compression' - validates multi-pack encoding",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes("compression"),
          expected: [11, 0, 0, 0, 99, 227, 41, 209, 247, 152]
        },
        {
          text: "Phrase 'test compression' - validates multiple packs and a literal space",
          uri: "https://github.com/Ed-von-Schleck/shoco",
          input: OpCodes.AnsiToBytes("test compression"),
          expected: [16, 0, 0, 0, 197, 121, 32, 99, 227, 41, 209, 247, 152]
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


    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) return [];
        const result = this._decompress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Even empty input produces a fixed 4-byte header (matches the
      // C# reference, which always writes the original length).
      const result = this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(data) {
      const output = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) return output;

      const { charIdOf, successorRankOf } = MODEL;

      let i = 0;
      while (i < data.length) {
        const b = data[i];

        if (b === 0 || b >= 0x80) {
          // Escape: byte value 0 and anything with the high bit set (which
          // would otherwise be mistaken for a pack header) is emitted
          // verbatim, behind a 0x00 sentinel.
          output.push(0x00, b);
          i++;
          continue;
        }

        const firstId = charIdOf[b];
        if (firstId < 0) {
          // Not in the trained alphabet, but safely representable as-is (bit 7 clear).
          output.push(b);
          i++;
          continue;
        }

        // Greedily extend a chain of leader + successor ranks, exactly as
        // the reference's shoco_compress does, up to the largest pack's capacity.
        const chain = new Array(MAX_CHAIN_LENGTH).fill(0);
        chain[0] = firstId;
        let count = 1;
        let prevId = firstId;
        let j = i + 1;
        while (count < MAX_CHAIN_LENGTH && j < data.length) {
          const next = data[j];
          if (next === 0 || next >= 0x80) break;
          const nextId = charIdOf[next];
          if (nextId < 0) break;
          chain[count++] = successorRankOf[prevId][nextId];
          prevId = nextId;
          j++;
        }

        const packIndex = this._findBestPack(chain, count);
        if (packIndex < 0) {
          // No pack fits (including the case of a lone, unextended leader
          // character): fall back to a plain literal byte, as the reference does.
          output.push(b);
          i++;
          continue;
        }

        this._emitPack(output, packIndex, chain);
        i += PACKS[packIndex].fieldBits.length;
      }

      return output;
    }

    _decompress(data) {
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalLength === 0) return [];

      const { alphabet, successorIdAt } = MODEL;
      const result = new Array(originalLength);
      let outPos = 0;
      let pos = 4;

      while (outPos < originalLength) {
        const first = data[pos];

        if (first === 0x00) {
          result[outPos++] = data[pos + 1];
          pos += 2;
          continue;
        }

        if (first < 0x80) {
          result[outPos++] = first;
          pos++;
          continue;
        }

        const packIndex = this._decodeHeaderTier(first);
        const pack = PACKS[packIndex];
        const bytesPacked = totalBits(pack) / 8;

        let acc = 0;
        for (let k = 0; k < bytesPacked; k++)
          acc = OpCodes.OrN(OpCodes.Shl32(acc, 8), data[pos + k]);
        pos += bytesPacked;

        let remainingBits = totalBits(pack) - (pack.headerOnes + 1);
        const fieldBits = pack.fieldBits;
        let prevId = -1;
        for (let k = 0; k < fieldBits.length; k++) {
          remainingBits -= fieldBits[k];
          const value = OpCodes.AndN(OpCodes.Shr32(acc, remainingBits), OpCodes.Shl32(1, fieldBits[k]) - 1);

          const id = k === 0 ? value : successorIdAt[prevId][value];

          result[outPos++] = alphabet[id];
          prevId = id;
        }
      }

      return result;
    }

    // Picks the largest pack tier whose field count fits within the available
    // chain length and whose every field value fits that tier's bit widths,
    // matching the reference's find_best_encoding (search from largest to
    // smallest, first fit wins).
    // @private
    _findBestPack(chain, chainLength) {
      for (let p = PACKS.length - 1; p >= 0; p--) {
        const fieldBits = PACKS[p].fieldBits;
        if (chainLength < fieldBits.length) continue;

        let fits = true;
        for (let k = 0; k < fieldBits.length; k++) {
          if (chain[k] < OpCodes.Shl32(1, fieldBits[k])) continue;
          fits = false;
          break;
        }

        if (fits) return p;
      }

      return -1;
    }

    // @private
    _emitPack(output, packIndex, chain) {
      const pack = PACKS[packIndex];
      const fieldBits = pack.fieldBits;
      const bits = totalBits(pack);

      let acc = OpCodes.Shl32(OpCodes.Shl32(1, pack.headerOnes) - 1, 1); // e.g. 2 ones -> 0b110

      for (let k = 0; k < fieldBits.length; k++)
        acc = OpCodes.OrN(OpCodes.Shl32(acc, fieldBits[k]), chain[k]);

      for (let byteIndex = OpCodes.Shr32(bits, 3) - 1; byteIndex >= 0; byteIndex--)
        output.push(OpCodes.AndN(OpCodes.Shr32(acc, 8 * byteIndex), 0xFF));
    }

    // Mirrors the reference's decode_header: counts the leading one-bits of
    // the first byte of a pack (a leading zero-bit, handled by the caller
    // before this is invoked, means "plain literal").
    // @private
    _decodeHeaderTier(first) {
      let ones = 0;
      let b = OpCodes.Shl32(first, 24);
      while (OpCodes.AndN(b, 0x80000000) !== 0) {
        ones++;
        b = OpCodes.Shl32(b, 1);
      }

      const packIndex = ones - 1;
      if (packIndex < 0 || packIndex >= PACKS.length)
        throw new Error('Shoco: unrecognized pack header (0x' + first.toString(16) + ')');
      return packIndex;
    }
  }

  // Register algorithm (guard against double registration)
  const algorithmInstance = new Shoco();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return Shoco;
}));
