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

        // Test vectors - self-computed round-trip verification vectors produced by
        // this implementation (RePair output is implementation-defined at the byte
        // level; there is no external canonical byte-exact reference stream). The
        // grammar-construction rule (most frequent adjacent pair, ties broken by
        // leftmost first occurrence) follows the Larsson & Moffat description.
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
            expected: [0,0,0,4, 0,1, 0,2, 0,97,0,97, 1,0,1,0]
          },
          {
            text: "Repetitive text - 'abcabcabc'",
            uri: "https://en.wikipedia.org/wiki/Grammar-based_code",
            input: OpCodes.AsciiToBytes("abcabcabc"),
            expected: [0,0,0,9, 0,3, 0,2, 0,97,0,98, 1,0,0,99, 1,1,1,1, 1,2,1,1]
          },
          {
            text: "No repeated pairs - 'abcdef'",
            uri: "Edge case - grammar reduces to zero rules",
            input: OpCodes.AsciiToBytes("abcdef"),
            expected: [0,0,0,6, 0,0, 0,6, 0,97,0,98,0,99,0,100,0,101,0,102]
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
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // ----- Compression: build a straight-line grammar via recursive pairing -----

      _compress(data) {
        let S = data.slice();
        let nextId = 256;
        const rules = [];

        while (S.length >= 2) {
          const freq = new Map();
          const firstIdx = new Map();

          for (let i = 0; i < S.length - 1; i++) {
            const key = S[i] * 65536 + S[i + 1];
            freq.set(key, (freq.get(key) || 0) + 1);
            if (!firstIdx.has(key)) firstIdx.set(key, i);
          }

          let bestKey = null, bestCount = 0, bestFirst = Infinity;
          for (const [key, count] of freq) {
            if (count < 2) continue;
            const first = firstIdx.get(key);
            if (bestKey === null || count > bestCount || (count === bestCount && first < bestFirst)) {
              bestKey = key;
              bestCount = count;
              bestFirst = first;
            }
          }

          if (bestKey === null) break;

          const a = Math.floor(bestKey / 65536);
          const b = bestKey % 65536;

          if (nextId > 0xFFFF) break; // safety guard against symbol-id overflow

          const X = nextId++;
          rules.push([a, b]);

          const newS = [];
          let i = 0;
          while (i < S.length) {
            if (i < S.length - 1 && S[i] === a && S[i + 1] === b) {
              newS.push(X);
              i += 2;
            } else {
              newS.push(S[i]);
              i += 1;
            }
          }
          S = newS;
        }

        return this._pack(data.length, rules, S);
      }

      _pack(originalLength, rules, S) {
        const bytes = [];
        bytes.push(...OpCodes.Unpack32BE(originalLength));
        bytes.push(...OpCodes.Unpack16BE(rules.length));
        bytes.push(...OpCodes.Unpack16BE(S.length));

        for (const rule of rules) {
          bytes.push(...OpCodes.Unpack16BE(rule[0]));
          bytes.push(...OpCodes.Unpack16BE(rule[1]));
        }

        for (const sym of S) {
          bytes.push(...OpCodes.Unpack16BE(sym));
        }

        return bytes;
      }

      // ----- Decompression: expand the grammar rules back into the byte sequence -----

      _decompress(data) {
        if (data.length < 8) return [];

        let pos = 0;
        const originalLength = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        pos += 4;
        const ruleCount = OpCodes.Pack16BE(data[pos], data[pos + 1]);
        pos += 2;
        const seqLength = OpCodes.Pack16BE(data[pos], data[pos + 1]);
        pos += 2;

        if (originalLength === 0) return [];

        const rules = [];
        for (let i = 0; i < ruleCount; i++) {
          const l = OpCodes.Pack16BE(data[pos], data[pos + 1]);
          pos += 2;
          const r = OpCodes.Pack16BE(data[pos], data[pos + 1]);
          pos += 2;
          rules.push([l, r]);
        }

        const S = [];
        for (let i = 0; i < seqLength; i++) {
          const sym = OpCodes.Pack16BE(data[pos], data[pos + 1]);
          pos += 2;
          S.push(sym);
        }

        const cache = new Map();
        const expand = (sym) => {
          if (sym < 256) return [sym];
          if (cache.has(sym)) return cache.get(sym);
          const rule = rules[sym - 256];
          const result = expand(rule[0]).concat(expand(rule[1]));
          cache.set(sym, result);
          return result;
        };

        const out = [];
        for (const sym of S) out.push(...expand(sym));
        return out;
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
