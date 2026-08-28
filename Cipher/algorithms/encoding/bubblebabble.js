/*
 * BubbleBabble Encoding Implementation
 * Educational implementation of BubbleBabble encoding for SSH fingerprints
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

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

  class BubbleBabbleAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BubbleBabble Encoding";
      this.description = "Binary-to-text encoding scheme that produces pronounceable words, commonly used for SSH fingerprints. Creates human-readable representations of binary data using consonant-vowel patterns and an embedded checksum, per Antti Huima's draft-huima-01 specification. Encodes any byte sequence of any length - there is no restricted input domain.";
      this.inventor = "Antti Huima";
      this.year = 2000;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Fingerprint Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FI;

      // Documentation and references
      this.documentation = [
        new LinkItem("BubbleBabble Specification", "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"),
        new LinkItem("SSH Fingerprint Format", "https://en.wikipedia.org/wiki/Public_key_fingerprint"),
        new LinkItem("OpenSSH BubbleBabble Implementation", "https://github.com/openssh/openssh-portable")
      ];

      this.references = [
        new LinkItem("SSH Protocol Documentation", "https://www.openssh.com/specs.html"),
        new LinkItem("Fingerprint Verification Methods", "https://tools.ietf.org/html/rfc4716"),
        new LinkItem("BubbleBabble in Practice", "https://www.ssh.com/ssh/keygen/")
      ];

      this.knownVulnerabilities = [];

      // Test vectors: the first three are the spec's own worked examples
      // (draft-huima-01.txt section 5, "Test Vectors"); the rest are
      // regressions verified against a from-scratch reimplementation of the
      // spec algorithm (see encode()/decode() below).
      this.tests = [
        new TestCase(
          [],
          OpCodes.AnsiToBytes("xexax"),
          "BubbleBabble empty data test (spec section 5)",
          "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("1234567890"),
          OpCodes.AnsiToBytes("xesef-disof-gytuf-katof-movif-baxux"),
          "BubbleBabble '1234567890' test (spec section 5)",
          "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("Pineapple"),
          OpCodes.AnsiToBytes("xigak-nyryk-humil-bosek-sonax"),
          "BubbleBabble 'Pineapple' test (spec section 5)",
          "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"
        ),
        new TestCase(
          [65], // Single byte, odd length -> exercises the odd-K partial-tuple path
          OpCodes.AnsiToBytes("xibex"),
          "Single byte encoding test - BubbleBabble",
          "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"
        ),
        new TestCase(
          [0x00, 0xFF],
          OpCodes.AnsiToBytes("xebaz-zixex"),
          "Even-length two-byte test with 0x00/0xFF - exercises the even-K capstone-tuple path",
          "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"
        ),
        new TestCase(
          Array.from({length: 256}, (_, i) => i),
          OpCodes.AnsiToBytes("xebab-cabob-fyceb-hucub-lodob-nidab-refyb-tafib-zygac-cugoc-fohic-hihyc-lekuc-nakec-rylyc-tulic-zomed-cimud-fenod-hanad-lypud-nuped-rorad-tirod-zesif-casyf-fytof-hutaf-lovyf-nivif-rezef-tazuf-zabig-cybyg-fucug-hoceg-lidag-nedog-rafeg-tyfug-zugoh-cogah-fihyh-hehih-lakah-nykoh-rulih-tolyh-zimuk-cemek-fanyk-hynik-lupek-nopuk-rirok-terak-zasul-cysel-futal-hotol-livil-nevyl-razol-tyzal-zybym-cubim-focem-hicum-ledim-nadym-ryfum-tufem-zogan-cigon-fehen-hahun-lykon-nukan-rolyn-tilin-zemap-camop-fynip-hunyp-lopup-nipep-reryp-tarip-zyser-cusur-fotor-hitar-levur-naver-ryzar-tuzor-zubis-cobys-ficos-hecas-ladys-nydis-rufes-tofus-zigit-cegyt-fahut-hyhet-lukat-nokot-rilet-telut-zamov-cymav-funyv-honiv-lipav-nepov-rariv-tyryv-zusuz-cosez-fityz-hetiz-lavez-nyvuz-ruzoz-tozaz-zyxux"),
          "All 256 byte values regression test (128 full tuples) - exercises the checksum chain and every consonant/vowel index",
          "https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt"
        )
      ];

      // BubbleBabble character sets, per draft-huima-01.txt section 2.
      this.consonants = "bcdfghklmnprstvzx";  // 17 consonants, indices 0-16 (index 16 = 'x', reserved as the even-length capstone marker)
      this.vowels = "aeiouy";                 // 6 vowels, indices 0-5
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BubbleBabbleInstance(this, isInverse);
    }
  }

  /**
 * BubbleBabble cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BubbleBabbleInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BubbleBabbleInstance.Feed: Input must be byte array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk also cannot be converted on its
      // own, because the coder groups whole units of input and emits padding and
      // framing at the end of the message, so the bytes are collected here and
      // converted once, in Result().
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('BubbleBabbleInstance.Result: No data processed. Call Feed() first.');
      }
      this.processedData = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.processedData;
    }

    /**
   * Real implementation of the draft-huima-01 Bubble Babble algorithm.
   * Data D[1..K] (1-indexed in the spec) is grouped into floor(K/2) full
   * tuples of 2 bytes each, plus one trailing "partial tuple" that either
   * encodes the odd (K+1)th byte or, when K is even, is a pure checksum
   * capstone with no data. A running checksum (seed 1) is folded into
   * every tuple and updated from each tuple's own two raw bytes, so a
   * single-bit corruption anywhere in the encoded string is very likely
   * to fail the a/c validity check on decode.
   */

    encode(data) {
      const V = this.algorithm.vowels;
      const C = this.algorithm.consonants;
      const K = data.length;
      const numPairs = Math.floor(K / 2);

      let result = "x";
      let checksum = 1; // C[1] = 1

      for (let i = 0; i < numPairs; i++) {
        const d1 = data[2 * i];
        const d2 = data[2 * i + 1];

        const a = (OpCodes.And32(OpCodes.Shr32(d1, 6), 3) + checksum) % 6;
        const b = OpCodes.And32(OpCodes.Shr32(d1, 2), 15);
        const c = (OpCodes.And32(d1, 3) + Math.floor(checksum / 6)) % 6;
        const d = OpCodes.And32(OpCodes.Shr32(d2, 4), 15);
        const e = OpCodes.And32(d2, 15);

        result += V[a] + C[b] + V[c] + C[d] + '-' + C[e];

        // Next checksum uses this pair's own raw bytes, per spec:
        // C[n] = (C[n-1]*5 + (D[2n-3]*7 + D[2n-2])) mod 36.
        checksum = (checksum * 5 + (d1 * 7 + d2)) % 36;
      }

      if (K % 2 === 0) {
        // Capstone partial tuple: no data byte remains. b is the reserved
        // "end of data" marker - consonant index 16 ('x') - which a real
        // byte-derived b (always 0-15) can never produce, so decode can
        // tell the two partial-tuple forms apart unambiguously.
        const a = checksum % 6;
        const c = Math.floor(checksum / 6);
        result += V[a] + C[16] + V[c];
      } else {
        const d1 = data[K - 1];
        const a = (OpCodes.And32(OpCodes.Shr32(d1, 6), 3) + checksum) % 6;
        const b = OpCodes.And32(OpCodes.Shr32(d1, 2), 15);
        const c = (OpCodes.And32(d1, 3) + Math.floor(checksum / 6)) % 6;
        result += V[a] + C[b] + V[c];
      }

      result += "x";

      // Convert string to byte array
      const resultBytes = [];
      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const encoded = OpCodes.BytesToChars(data);
      const V = this.algorithm.vowels;
      const C = this.algorithm.consonants;

      if (this.vowelIndex === undefined) {
        this.vowelIndex = {};
        for (let i = 0; i < V.length; i++) this.vowelIndex[V[i]] = i;
        this.consonantIndex = {};
        for (let i = 0; i < C.length; i++) this.consonantIndex[C[i]] = i;
      }

      if (encoded.length < 5 || encoded[0] !== 'x' || encoded[encoded.length - 1] !== 'x') {
        throw new Error("BubbleBabbleInstance.decode: encoded string must start and end with 'x'");
      }

      const core = encoded.slice(1, -1);
      const coreLen = core.length;
      if (coreLen < 3 || (coreLen - 3) % 6 !== 0) {
        throw new Error(`BubbleBabbleInstance.decode: invalid encoded length ${encoded.length} for Bubble Babble`);
      }
      const numPairs = (coreLen - 3) / 6;

      const readVowel = (ch, where) => {
        const v = this.vowelIndex[ch];
        if (v === undefined) throw new Error(`BubbleBabbleInstance.decode: invalid vowel character '${ch}' at ${where}`);
        return v;
      };
      const readConsonant = (ch, where) => {
        const c = this.consonantIndex[ch];
        if (c === undefined) throw new Error(`BubbleBabbleInstance.decode: invalid consonant character '${ch}' at ${where}`);
        return c;
      };
      // Proper (always non-negative) modulo - JS's % keeps the dividend's
      // sign, but (a - checksum) is routinely negative here.
      const mod6 = n => ((n % 6) + 6) % 6;

      const result = [];
      let checksum = 1;
      let pos = 0;

      for (let i = 0; i < numPairs; i++) {
        const a = readVowel(core[pos], pos);
        const b = readConsonant(core[pos + 1], pos + 1);
        const c = readVowel(core[pos + 2], pos + 2);
        const d = readConsonant(core[pos + 3], pos + 3);
        if (core[pos + 4] !== '-') {
          throw new Error(`BubbleBabbleInstance.decode: expected '-' separator at position ${pos + 4}`);
        }
        const e = readConsonant(core[pos + 5], pos + 5);
        pos += 6;

        const top2 = mod6(a - checksum);
        const bottom2 = mod6(c - Math.floor(checksum / 6));
        if (top2 >= 4 || bottom2 >= 4) {
          throw new Error(`BubbleBabbleInstance.decode: checksum validation failed on tuple ${i + 1}`);
        }

        const d1 = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(top2, 6), OpCodes.Shl32(b, 2)), bottom2);
        const d2 = OpCodes.Or32(OpCodes.Shl32(d, 4), e);
        result.push(d1, d2);

        checksum = (checksum * 5 + (d1 * 7 + d2)) % 36;
      }

      // Partial tuple: consonant index 16 ('x') means "capstone, no data";
      // any other consonant index means the odd trailing data byte.
      const a = readVowel(core[pos], pos);
      const b = readConsonant(core[pos + 1], pos + 1);
      const c = readVowel(core[pos + 2], pos + 2);

      if (b === 16) {
        if (a !== checksum % 6 || c !== Math.floor(checksum / 6)) {
          throw new Error('BubbleBabbleInstance.decode: checksum validation failed on final capstone tuple');
        }
      } else {
        const top2 = mod6(a - checksum);
        const bottom2 = mod6(c - Math.floor(checksum / 6));
        if (top2 >= 4 || bottom2 >= 4) {
          throw new Error('BubbleBabbleInstance.decode: checksum validation failed on final tuple');
        }
        const d1 = OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(top2, 6), OpCodes.Shl32(b, 2)), bottom2);
        result.push(d1);
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new BubbleBabbleAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BubbleBabbleAlgorithm, BubbleBabbleInstance };
}));