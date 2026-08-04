/*
 * LZWL (Syllable-Based LZW) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZWL is a 2006-era modification of LZW (attributed to Platos, Dvorsky and
 * Snasel) that builds its dictionary out of syllables instead of individual
 * bytes: the input is first decomposed into syllables, and the classic LZW
 * "longest matching dictionary phrase, then extend by one more symbol" loop
 * is run over that syllable sequence instead of over raw bytes. When no
 * dictionary phrase matches, the next syllable K is emitted literally and
 * registered as a new phrase before compression continues (mirroring the
 * base algorithm's own literal-then-extend behaviour, just with a syllable
 * as the "character").
 *
 * This implementation uses a simple, deterministic, language-agnostic
 * syllable splitter (a run of leading consonants, then a run of vowels, then
 * trailing consonants up to -- but not including -- a consonant that starts
 * the next vowel-bearing syllable; any non-letter byte is its own syllable)
 * so that arbitrary byte streams still round-trip, with syllable
 * preprocessing paying off specifically on natural-language text.
 *
 * Wire format: a sequence of tokens, each starting with a marker byte:
 *   0x00 <len> <len bytes>   - a new syllable, output literally and
 *                              registered as dictionary entry (next code)
 *   0x01 <code:16 big-endian> - reference to an existing dictionary phrase
 *
 * References:
 * - LZWL (Wikipedia): https://en.wikipedia.org/wiki/LZWL
 * - Lempel-Ziv-Welch (base algorithm): https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  const TOK_LIT = 0x00;
  const TOK_REF = 0x01;

  // ===== SYLLABLE SEGMENTATION =====

  function isLetter(b) {
    return (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A);
  }

  function isVowel(b) {
    const lower = (b >= 0x41 && b <= 0x5A) ? b + 0x20 : b;
    return lower === 0x61 || lower === 0x65 || lower === 0x69 || lower === 0x6F || lower === 0x75; // a e i o u
  }

  function segment(bytes) {
    const syllables = [];
    const n = bytes.length;
    let pos = 0;

    while (pos < n) {
      const start = pos;

      if (!isLetter(bytes[pos])) {
        pos++;
      } else {
        let sawVowel = false;
        while (pos < n && isLetter(bytes[pos])) {
          if (isVowel(bytes[pos])) {
            sawVowel = true;
            pos++;
          } else if (sawVowel && pos + 1 < n && isLetter(bytes[pos + 1]) && isVowel(bytes[pos + 1])) {
            break; // leave this consonant to start the next syllable's onset
          } else {
            pos++;
          }
        }
      }

      syllables.push(bytes.slice(start, pos));
    }

    return syllables;
  }

  // ===== DICTIONARY HELPERS =====

  function keyOf(bytes) {
    return bytes.join(',');
  }

  function concatBytes(a, b) {
    const out = new Array(a.length + b.length);
    for (let i = 0; i < a.length; ++i) out[i] = a[i];
    for (let i = 0; i < b.length; ++i) out[a.length + i] = b[i];
    return out;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZWLCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZWL";
      this.description = "Syllable-based LZW variant that runs the classic LZW dictionary-phrase-extension loop over a stream of syllables instead of individual bytes, so common sub-word units become single dictionary codes.";
      this.inventor = "Jan Platos, Jiri Dvorsky, Vaclav Snasel";
      this.year = 2006;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.UNKNOWN;

      this.documentation = [
        new LinkItem("LZWL (Wikipedia)", "https://en.wikipedia.org/wiki/LZWL"),
        new LinkItem("Lempel-Ziv-Welch (base algorithm)", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch")
      ];

      this.references = [
        new LinkItem("LZW compression overview", "https://www.geeksforgeeks.org/computer-networks/lzw-lempel-ziv-welch-compression-technique/")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: [],
          expected: []
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: new Array(64).fill(0x41),
          expected: [0, 64, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65]
        },
        {
          text: "Text sample",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [0, 3, 116, 104, 101, 0, 1, 32, 0, 5, 113, 117, 105, 99, 107, 1, 0, 1, 0, 5, 98, 114, 111, 119, 110, 1, 0, 1, 0, 3, 102, 111, 120, 1, 0, 1, 0, 5, 106, 117, 109, 112, 115, 1, 0, 1, 0, 1, 111, 0, 3, 118, 101, 114, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 4, 108, 97, 122, 121, 1, 0, 1, 0, 3, 100, 111, 103, 0, 1, 46, 1, 0, 12, 1, 0, 1, 1, 0, 2, 1, 0, 3, 1, 0, 5, 1, 0, 18]
        },
        {
          // Regression test: a strictly alternating "ab" pattern forces the
          // syllable splitter to emit single-vowel/consonant-onset syllables
          // ("a", then "ba" repeated) whose dictionary phrases immediately
          // re-occur, which used to hit the classic LZW "KwKwK" case (a code
          // referencing the dictionary entry that is still pending
          // registration) and crash the decompressor with "Cannot read
          // properties of undefined (reading 'bytes')".
          text: "Alternating 'ab' pattern (64 bytes, exercises the KwKwK dictionary case)",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: (function() { const a = []; for (let i = 0; i < 64; ++i) a.push(i % 2 === 0 ? 0x61 : 0x62); return a; })(),
          expected: [0, 1, 97, 0, 2, 98, 97, 1, 0, 1, 1, 0, 2, 1, 0, 3, 1, 0, 4, 1, 0, 5, 1, 0, 6, 1, 0, 7, 1, 0, 1, 0, 3, 98, 97, 98]
        },
        {
          // Regression test: pseudo-random bytes have no consonant/vowel
          // structure, so most of them fall through the splitter's
          // single-byte-token path. This exercises the same dictionary
          // machinery on non-text input.
          text: "Pseudo-random binary sample (128 bytes, no syllable structure)",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: [193, 103, 129, 152, 240, 33, 24, 215, 128, 45, 22, 142, 12, 157, 3, 192, 4, 51, 59, 3, 157, 43, 27, 244, 6, 113, 140, 143, 233, 231, 28, 28, 138, 247, 226, 238, 240, 38, 226, 227, 35, 53, 231, 89, 133, 124, 9, 151, 67, 229, 246, 122, 203, 86, 115, 112, 158, 1, 192, 126, 215, 249, 75, 141, 55, 69, 218, 77, 45, 155, 60, 15, 93, 97, 215, 105, 214, 178, 244, 37, 147, 242, 172, 235, 241, 219, 18, 77, 24, 42, 90, 134, 42, 43, 14, 218, 36, 84, 17, 201, 185, 43, 70, 35, 243, 110, 206, 235, 242, 82, 59, 210, 97, 23, 124, 170, 139, 21, 235, 101, 204, 143, 136, 227, 248, 94, 70, 64],
          expected: [0, 1, 193, 0, 1, 103, 0, 1, 129, 0, 1, 152, 0, 1, 240, 0, 1, 33, 0, 1, 24, 0, 1, 215, 0, 1, 128, 0, 1, 45, 0, 1, 22, 0, 1, 142, 0, 1, 12, 0, 1, 157, 0, 1, 3, 0, 1, 192, 0, 1, 4, 0, 1, 51, 0, 1, 59, 1, 0, 14, 1, 0, 13, 0, 1, 43, 0, 1, 27, 0, 1, 244, 0, 1, 6, 0, 1, 113, 0, 1, 140, 0, 1, 143, 0, 1, 233, 0, 1, 231, 0, 1, 28, 1, 0, 30, 0, 1, 138, 0, 1, 247, 0, 1, 226, 0, 1, 238, 1, 0, 4, 0, 1, 38, 1, 0, 34, 0, 1, 227, 0, 1, 35, 0, 1, 53, 1, 0, 29, 0, 1, 89, 0, 1, 133, 0, 1, 124, 0, 1, 9, 0, 1, 151, 0, 1, 67, 0, 1, 229, 0, 1, 246, 0, 1, 122, 0, 1, 203, 0, 3, 86, 115, 112, 0, 1, 158, 0, 1, 1, 1, 0, 15, 0, 1, 126, 1, 0, 7, 0, 1, 249, 0, 1, 75, 0, 1, 141, 0, 1, 55, 0, 1, 69, 0, 1, 218, 0, 1, 77, 1, 0, 9, 0, 1, 155, 0, 1, 60, 0, 1, 15, 0, 1, 93, 0, 1, 97, 1, 0, 7, 0, 1, 105, 0, 1, 214, 0, 1, 178, 1, 0, 23, 0, 1, 37, 0, 1, 147, 0, 1, 242, 0, 1, 172, 0, 1, 235, 0, 1, 241, 0, 1, 219, 0, 1, 18, 1, 0, 65, 1, 0, 6, 0, 1, 42, 0, 1, 90, 0, 1, 134, 1, 0, 87, 1, 0, 21, 0, 1, 14, 1, 0, 64, 0, 1, 36, 0, 1, 84, 0, 1, 17, 0, 1, 201, 0, 1, 185, 1, 0, 21, 0, 1, 70, 1, 0, 40, 0, 1, 243, 0, 1, 110, 0, 1, 206, 1, 0, 81, 1, 0, 79, 0, 1, 82, 1, 0, 18, 0, 1, 210, 1, 0, 71, 0, 1, 23, 1, 0, 45, 0, 1, 170, 0, 1, 139, 0, 1, 21, 1, 0, 81, 0, 1, 101, 0, 1, 204, 1, 0, 27, 0, 1, 136, 1, 0, 39, 0, 1, 248, 0, 1, 94, 1, 0, 100, 0, 1, 64]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZWLInstance(this, isInverse);
    }
  }

  class LZWLInstance extends IAlgorithmInstance {
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
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(input) {
      if (input.length === 0) return [];

      const syllables = segment(input);
      const dict = new Map(); // key -> { bytes, firstSyllable, code }
      let nextCode = 0;
      const output = [];

      let S = null;
      let i = 0;

      while (i < syllables.length) {
        const K = syllables[i];
        const candidateBytes = S ? concatBytes(S.bytes, K) : K;
        const key = keyOf(candidateBytes);
        const existing = dict.get(key);

        if (existing) {
          S = existing;
          i++;
          continue;
        }

        if (S !== null) {
          output.push(TOK_REF, ...OpCodes.Unpack16BE(S.code));
          dict.set(key, { bytes: candidateBytes, firstSyllable: S.firstSyllable, code: nextCode });
          nextCode++;
          S = null;
          // do not advance i; K is reprocessed from an empty phrase
        } else {
          output.push(TOK_LIT, K.length, ...K);
          dict.set(keyOf(K), { bytes: K, firstSyllable: K, code: nextCode });
          nextCode++;
          // K has been fully emitted and registered; S stays empty so the
          // next syllable starts matching fresh (mirrors classic LZW, where
          // a flush is always followed by an empty current phrase).
          i++;
        }
      }

      if (S !== null) output.push(TOK_REF, ...OpCodes.Unpack16BE(S.code));

      return output;
    }

    _decompress(input) {
      if (input.length === 0) return [];

      const dict = []; // code -> { bytes, firstSyllable }
      let nextCode = 0;
      const output = [];
      let pendingParent = null;
      let pos = 0;

      while (pos < input.length) {
        const marker = input[pos++];
        let curBytes, curFirstSyl, refEntry;

        if (marker === TOK_LIT) {
          const len = input[pos++];
          curBytes = input.slice(pos, pos + len);
          pos += len;
          curFirstSyl = curBytes;
        } else {
          const code = OpCodes.Pack16BE(input[pos], input[pos + 1]);
          pos += 2;
          refEntry = dict[code];

          if (refEntry === undefined) {
            // Classic LZW "KwKwK" case: the referenced code is exactly the
            // one about to be created from the still-pending registration
            // (phrase P immediately followed by another occurrence of P's
            // own first syllable). Synthesize it from the pending parent
            // instead of the not-yet-registered dictionary slot.
            refEntry = {
              bytes: concatBytes(pendingParent.bytes, pendingParent.firstSyllable),
              firstSyllable: pendingParent.firstSyllable
            };
          }

          curBytes = refEntry.bytes;
          curFirstSyl = refEntry.firstSyllable;
        }

        if (pendingParent !== null) {
          dict[nextCode] = {
            bytes: concatBytes(pendingParent.bytes, curFirstSyl),
            firstSyllable: pendingParent.firstSyllable
          };
          nextCode++;
          pendingParent = null;
        }

        for (let k = 0; k < curBytes.length; ++k) output.push(curBytes[k]);

        if (marker === TOK_LIT) {
          dict[nextCode] = { bytes: curBytes, firstSyllable: curFirstSyl };
          nextCode++;
        } else {
          pendingParent = refEntry;
        }
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZWLCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZWLCompression, LZWLInstance };
}));
