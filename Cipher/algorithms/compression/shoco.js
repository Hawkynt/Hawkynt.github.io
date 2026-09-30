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
  /** @type {string} */
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
  /** @type {int32[]} */
  const PACK_HEADER_ONES = [1, 2, 3];
  /** @type {int32[][]} */
  const PACK_FIELD_BITS = [
    [4, 2],
    [4, 3, 3, 3],
    [5, 4, 4, 4, 3, 3, 3, 2]
  ];

  /**
   * @param {int32} packIndex - Pack tier
   * @returns {int32} Header plus field bits of the tier
   */
  function totalBits(packIndex) {
    /** @type {int32[]} */
    const fieldBits = PACK_FIELD_BITS[packIndex];
    /** @type {int32} */
    let sum = PACK_HEADER_ONES[packIndex] + 1;
    for (let k = 0; k < fieldBits.length; k++) {
      sum += fieldBits[k];
    }
    return sum;
  }

  /** @type {int32} */
  const MAX_CHAIN_LENGTH = PACK_FIELD_BITS[PACK_FIELD_BITS.length - 1].length;

  /**
   * Trained alphabet and successor tables
   */
  class ShocoModel {
    constructor() {
      /** @type {uint8[]} */
      this.alphabet = [];
      /** @type {int32[]} */
      this.charIdOf = [];
      /** @type {int32[][]} */
      this.successorIdAt = [];
      /** @type {int32[][]} */
      this.successorRankOf = [];
    }
  }

  // Train alphabet: top 32 most frequent bytes in the (lowercased) corpus,
  // ties broken by ascending byte value -- matches the reference's
  // OrderByDescending(unigram).ThenBy(byteValue).Take(32).
  /**
   * @param {string} corpus - Training text
   * @returns {ShocoModel} Model
   */
  function trainModel(corpus) {
    /** @type {string} */
    const lower = corpus.toLowerCase();

    /** @type {int32[]} */
    const unigram = new Int32Array(256);
    for (let i = 0; i < lower.length; ++i) {
      /** @type {int32} */
      const code = lower.charCodeAt(i);
      if (code < 256) {
        unigram[code]++;
      }
    }

    // Candidates by descending count, equal counts by ascending byte value
    // (a total order, sorted here by insertion).
    /** @type {int32[]} */
    const candidates = [];
    for (let b = 0; b < 256; ++b) {
      if (unigram[b] > 0) {
        /** @type {int32} */
        let at = candidates.length;
        candidates.push(b);
        while (at > 0 && unigram[candidates[at - 1]] < unigram[b]) {
          candidates[at] = candidates[at - 1];
          at--;
        }
        candidates[at] = b;
      }
    }

    /** @type {ShocoModel} */
    const model = new ShocoModel();
    /** @type {int32} */
    const n = Math.min(32, candidates.length);
    for (let id = 0; id < n; ++id) {
      model.alphabet.push(candidates[id]);
    }

    for (let b = 0; b < 256; ++b) {
      model.charIdOf.push(-1);
    }
    for (let id = 0; id < n; ++id) {
      model.charIdOf[model.alphabet[id]] = id;
    }

    /** @type {int32[][]} */
    const bigram = [];
    for (let i = 0; i < n; ++i) {
      bigram.push(new Int32Array(n));
    }

    for (let i = 0; i + 1 < lower.length; ++i) {
      /** @type {int32} */
      const a = lower.charCodeAt(i);
      /** @type {int32} */
      const b = lower.charCodeAt(i + 1);
      if (a >= 256 || b >= 256) {
        continue;
      }
      /** @type {int32} */
      const aId = model.charIdOf[a];
      /** @type {int32} */
      const bId = model.charIdOf[b];
      if (aId >= 0 && bId >= 0) {
        /** @type {int32[]} */
        const row = bigram[aId];
        row[bId]++;
      }
    }

    for (let c = 0; c < n; ++c) {
      /** @type {int32[]} */
      const counts = bigram[c];
      // Successors by descending bigram count, then descending unigram count,
      // then ascending id (a total order, sorted here by insertion).
      /** @type {int32[]} */
      const order = [];
      for (let next = 0; next < n; ++next) {
        /** @type {int32} */
        let at = order.length;
        order.push(next);
        while (at > 0) {
          /** @type {int32} */
          const before = order[at - 1];
          /** @type {boolean} */
          let moves = false;
          if (counts[next] !== counts[before]) {
            moves = counts[next] > counts[before];
          } else {
            moves = unigram[model.alphabet[next]] > unigram[model.alphabet[before]];
          }
          if (!moves) {
            break;
          }
          order[at] = before;
          at--;
        }
        order[at] = next;
      }

      model.successorIdAt.push(order);
      /** @type {int32[]} */
      const rankOf = new Array(n);
      for (let rank = 0; rank < n; ++rank) {
        rankOf[rank] = 0;
      }
      for (let rank = 0; rank < n; ++rank) {
        rankOf[order[rank]] = rank;
      }
      model.successorRankOf.push(rankOf);
    }

    return model;
  }

  /** @type {ShocoModel} */
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
   * @param {Shoco} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
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
        const decoded = this._decompress(this.inputBuffer);
        /** @type {uint8[]} */
        const freshAfterDecode = [];
        this.inputBuffer = freshAfterDecode;
        return decoded;
      }

      // Even empty input produces a fixed 4-byte header (matches the
      // C# reference, which always writes the original length).
      /** @type {uint8[]} */
      const result = this._compress(this.inputBuffer);
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} Size header, packs and literals
     */
    _compress(data) {
      /** @type {uint8[]} */
      const output = OpCodes.Unpack32LE(data.length);
      if (data.length === 0) {
        return output;
      }

      /** @type {int32[]} */
      const charIdOf = MODEL.charIdOf;
      /** @type {int32[][]} */
      const successorRankOf = MODEL.successorRankOf;

      /** @type {int32} */
      let i = 0;
      while (i < data.length) {
        /** @type {uint8} */
        const b = data[i];

        if (b === 0 || b >= 0x80) {
          // Escape: byte value 0 and anything with the high bit set (which
          // would otherwise be mistaken for a pack header) is emitted
          // verbatim, behind a 0x00 sentinel.
          output.push(0x00);
          output.push(b);
          i++;
          continue;
        }

        /** @type {int32} */
        const firstId = charIdOf[b];
        if (firstId < 0) {
          // Not in the trained alphabet, but safely representable as-is (bit 7 clear).
          output.push(b);
          i++;
          continue;
        }

        // Greedily extend a chain of leader + successor ranks, exactly as
        // the reference's shoco_compress does, up to the largest pack's capacity.
        /** @type {int32[]} */
        const chain = new Int32Array(MAX_CHAIN_LENGTH);
        chain[0] = firstId;
        /** @type {int32} */
        let count = 1;
        /** @type {int32} */
        let prevId = firstId;
        /** @type {int32} */
        let j = i + 1;
        while (count < MAX_CHAIN_LENGTH && j < data.length) {
          /** @type {uint8} */
          const next = data[j];
          if (next === 0 || next >= 0x80) {
            break;
          }
          /** @type {int32} */
          const nextId = charIdOf[next];
          if (nextId < 0) {
            break;
          }
          /** @type {int32[]} */
          const ranks = successorRankOf[prevId];
          chain[count++] = ranks[nextId];
          prevId = nextId;
          j++;
        }

        /** @type {int32} */
        const packIndex = this._findBestPack(chain, count);
        if (packIndex < 0) {
          // No pack fits (including the case of a lone, unextended leader
          // character): fall back to a plain literal byte, as the reference does.
          output.push(b);
          i++;
          continue;
        }

        this._emitPack(output, packIndex, chain);
        i += PACK_FIELD_BITS[packIndex].length;
      }

      return output;
    }

    /**
     * @param {uint8[]} data - Size header, packs and literals
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(data) {
      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      /** @type {uint8[]} */
      const result = new Array(originalLength);
      if (originalLength === 0) {
        return result;
      }

      /** @type {uint8[]} */
      const alphabet = MODEL.alphabet;
      /** @type {int32[][]} */
      const successorIdAt = MODEL.successorIdAt;
      /** @type {int32} */
      let outPos = 0;
      /** @type {int32} */
      let pos = 4;

      while (outPos < originalLength) {
        /** @type {uint8} */
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

        /** @type {int32} */
        const packIndex = this._decodeHeaderTier(first);
        /** @type {int32[]} */
        const fieldBits = PACK_FIELD_BITS[packIndex];
        /** @type {int32} */
        const bytesPacked = totalBits(packIndex) / 8;

        /** @type {uint32} */
        let acc = 0;
        for (let k = 0; k < bytesPacked; k++) {
          acc = OpCodes.Or32(OpCodes.Shl32(acc, 8), data[pos + k]);
        }
        pos += bytesPacked;

        /** @type {int32} */
        let remainingBits = totalBits(packIndex) - (PACK_HEADER_ONES[packIndex] + 1);
        /** @type {int32} */
        let prevId = -1;
        for (let k = 0; k < fieldBits.length; k++) {
          remainingBits -= fieldBits[k];
          /** @type {uint32} */
          const mask = OpCodes.Shl32(1, fieldBits[k]) - 1;
          /** @type {uint32} */
          const value = OpCodes.And32(OpCodes.Shr32(acc, remainingBits), mask);

          /** @type {int32} */
          let id = value;
          if (k !== 0) {
            /** @type {int32[]} */
            const successors = successorIdAt[prevId];
            id = successors[value];
          }

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
    /**
     * @private
     * @param {int32[]} chain - Leader id and successor ranks
     * @param {int32} chainLength - Entries of chain in use
     * @returns {int32} Pack tier, or -1 when none fits
     */
    _findBestPack(chain, chainLength) {
      for (let p = PACK_FIELD_BITS.length - 1; p >= 0; p--) {
        /** @type {int32[]} */
        const fieldBits = PACK_FIELD_BITS[p];
        if (chainLength < fieldBits.length) {
          continue;
        }

        /** @type {boolean} */
        let fits = true;
        for (let k = 0; k < fieldBits.length; k++) {
          if (chain[k] < OpCodes.Shl32(1, fieldBits[k])) {
            continue;
          }
          fits = false;
          break;
        }

        if (fits) {
          return p;
        }
      }

      return -1;
    }

    /**
     * @private
     * @param {uint8[]} output - Output
     * @param {int32} packIndex - Pack tier
     * @param {int32[]} chain - Leader id and successor ranks
     */
    _emitPack(output, packIndex, chain) {
      /** @type {int32[]} */
      const fieldBits = PACK_FIELD_BITS[packIndex];
      /** @type {int32} */
      const bits = totalBits(packIndex);

      /** @type {uint32} */
      let acc = OpCodes.Shl32(OpCodes.Shl32(1, PACK_HEADER_ONES[packIndex]) - 1, 1); // e.g. 2 ones -> 0b110

      for (let k = 0; k < fieldBits.length; k++) {
        acc = OpCodes.Or32(OpCodes.Shl32(acc, fieldBits[k]), chain[k]);
      }

      /** @type {int32} */
      const byteCount = OpCodes.Shr32(bits, 3);
      for (let byteIndex = byteCount - 1; byteIndex >= 0; byteIndex--) {
        output.push(OpCodes.And32(OpCodes.Shr32(acc, 8 * byteIndex), 0xFF));
      }
    }

    // Mirrors the reference's decode_header: counts the leading one-bits of
    // the first byte of a pack (a leading zero-bit, handled by the caller
    // before this is invoked, means "plain literal").
    /**
     * @private
     * @param {uint8} first - First byte of the pack
     * @returns {int32} Pack tier
     */
    _decodeHeaderTier(first) {
      /** @type {int32} */
      let ones = 0;
      /** @type {uint32} */
      let b = OpCodes.Shl32(first, 24);
      while (OpCodes.And32(b, 0x80000000) !== 0) {
        ones++;
        b = OpCodes.Shl32(b, 1);
      }

      /** @type {int32} */
      const packIndex = ones - 1;
      if (packIndex < 0 || packIndex >= PACK_FIELD_BITS.length) {
        /** @type {string} */
        const hex = first.toString(16);
        throw new Error('Shoco: unrecognized pack header (0x' + hex + ')');
      }
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
