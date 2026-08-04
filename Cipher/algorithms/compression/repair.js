/*
 * RePair (Recursive Pairing) Grammar Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RePair builds a context-free grammar that generates exactly the input
 * sequence once and only once, by repeatedly replacing the most frequent
 * pair of adjacent symbols with a new grammar rule.
 *
 * Reference:
 *   N. J. Larsson and A. Moffat, "Off-Line Dictionary-Based Compression",
 *   Proceedings of the IEEE, Vol. 88, No. 11, November 2000, pp. 1722-1732.
 *   (Originally presented at Data Compression Conference, 1999.)
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
 * RePairCompression - Recursive pairing grammar compression algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class RePairCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "RePair";
        this.description = "Recursive pairing grammar compression. Repeatedly replaces the most frequent adjacent symbol pair with a new grammar rule until no pair repeats, producing a straight-line context-free grammar that generates the input exactly once.";
        this.inventor = "N. Jesper Larsson, Alistair Moffat";
        this.year = 1999;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Grammar-based";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.SE;

        // Documentation and references
        this.documentation = [
          new LinkItem("Off-Line Dictionary-Based Compression (IEEE Proceedings)", "https://ieeexplore.ieee.org/document/892708"),
          new LinkItem("RePair - Wikipedia (Grammar-based codes)", "https://en.wikipedia.org/wiki/Grammar-based_code"),
          new LinkItem("Data Compression Conference 1999 paper", "https://doi.org/10.1109/DCC.1999.755678")
        ];

        this.references = [
          new LinkItem("Larsson and Moffat original DCC'99 slides/paper", "https://people.eng.unimelb.edu.au/ammoffat/abstracts/lm99dcc.html"),
          new LinkItem("Grammar-based compression survey", "https://en.wikipedia.org/wiki/Straight-line_grammar")
        ];

        // Test vectors - round-trip compression tests only. The serialized byte
        // layout matches CompressionWorkbench's RePairBuildingBlock (the reference
        // implementation this port is verified against byte-for-byte), but is
        // otherwise implementation-defined, so vectors here only assert round-trip
        // correctness rather than fixed compressed bytes.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Single repeated pair - 'aaaa' (RePair Wikipedia style example)",
            uri: "https://en.wikipedia.org/wiki/Grammar-based_code",
            input: OpCodes.AsciiToBytes("aaaa"),
            expected: []
          },
          {
            text: "Repetitive text - 'abcabcabc'",
            uri: "https://en.wikipedia.org/wiki/Grammar-based_code",
            input: OpCodes.AsciiToBytes("abcabcabc"),
            expected: []
          },
          {
            text: "No repeated pairs - 'abcdef'",
            uri: "Edge case - grammar reduces to zero rules",
            input: OpCodes.AsciiToBytes("abcdef"),
            expected: []
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new RePairInstance(this, isInverse);
      }
    }

    class RePairInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.isInverse) {
          // A compressed stream always carries at least the 4-byte header, so an
          // empty buffer here is not a valid compressed empty message.
          if (this.inputBuffer.length === 0) return [];
          return this._decompress();
        }

        // Compressing empty input still emits the header (matches
        // CompressionWorkbench, which never skips the container).
        return this._compress();
      }

      // ----- Compression: build a straight-line grammar via recursive pairing -----
      //
      // Matches CompressionWorkbench's RePairBuildingBlock.Compress byte-for-byte:
      // pair frequencies are tallied into an insertion-order map every pass, the
      // most frequent pair wins ties by having been inserted (first encountered)
      // earlier, and replacement is a non-overlapping left-to-right scan that
      // re-checks the same position after every substitution.

      _compress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        const FIRST_NON_TERMINAL = 256;
        const MAX_RULES = 65536;
        // Packs (left, right) into one Number key. Both symbols are always
        // < 2^17, so this is exact (no precision loss) and preserves distinctness
        // the same way the reference's 64-bit `(left << 32) | right` key does.
        const PACK_BASE = 131072;

        const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));

        if (data.length === 0) return output;

        const symbols = data.slice();
        const rules = [];

        while (rules.length < MAX_RULES) {
          const pairFreq = new Map();
          for (let i = 0; i < symbols.length - 1; i++) {
            const key = symbols[i] * PACK_BASE + symbols[i + 1];
            pairFreq.set(key, (pairFreq.get(key) || 0) + 1);
          }

          let bestKey = 0, bestCount = 1;
          for (const [key, count] of pairFreq) {
            if (count > bestCount) {
              bestCount = count;
              bestKey = key;
            }
          }

          if (bestCount < 2) break;

          const left = Math.floor(bestKey / PACK_BASE);
          const right = bestKey - left * PACK_BASE;
          const newSymbol = FIRST_NON_TERMINAL + rules.length;
          rules.push([left, right]);

          let i2 = 0;
          while (i2 < symbols.length - 1) {
            if (symbols[i2] === left && symbols[i2 + 1] === right) {
              symbols[i2] = newSymbol;
              symbols.splice(i2 + 1, 1);
              // Don't advance i2 - check for further replacement starting at this position.
            } else {
              i2++;
            }
          }
        }

        // Serialize: rule count (4-byte LE); each rule as (left,right), both
        // 2-byte LE; final sequence length (4-byte LE); each symbol, 2-byte LE.
        { const rc = OpCodes.Unpack32LE(rules.length); output.push(rc[0], rc[1], rc[2], rc[3]); }

        for (const rule of rules) {
          const lb = OpCodes.Unpack16LE(rule[0]);
          const rb = OpCodes.Unpack16LE(rule[1]);
          output.push(lb[0], lb[1], rb[0], rb[1]);
        }

        { const sc = OpCodes.Unpack32LE(symbols.length); output.push(sc[0], sc[1], sc[2], sc[3]); }

        for (const sym of symbols) {
          const sb = OpCodes.Unpack16LE(sym);
          output.push(sb[0], sb[1]);
        }

        return output;
      }

      // ----- Decompression: expand the grammar rules back into the byte sequence -----

      _decompress() {
        const data = this.inputBuffer;
        this.inputBuffer = [];

        const FIRST_NON_TERMINAL = 256;

        const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
        if (originalSize === 0) return [];

        let offset = 4;

        const ruleCount = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        const rules = new Array(ruleCount);
        for (let i = 0; i < ruleCount; i++) {
          const left = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          const right = OpCodes.Pack16LE(data[offset + 2], data[offset + 3]);
          rules[i] = [left, right];
          offset += 4;
        }

        const seqLength = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
        offset += 4;

        const result = [];
        const stack = [];

        for (let i = 0; i < seqLength; i++) {
          const sym = OpCodes.Pack16LE(data[offset], data[offset + 1]);
          offset += 2;

          // Expand symbol iteratively via an explicit stack: pushing right then
          // left means left pops (and expands) first, giving correct left-to-right
          // grammar expansion.
          stack.push(sym);
          while (stack.length > 0) {
            const s = stack.pop();
            if (s < FIRST_NON_TERMINAL) {
              result.push(s);
            } else {
              const rule = rules[s - FIRST_NON_TERMINAL];
              stack.push(rule[1]);
              stack.push(rule[0]);
            }
          }
        }

        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RePairCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RePairCompression, RePairInstance };
}));
