/*
 * Koremutake Encoding Implementation  
 * Educational implementation of Koremutake memorable phonetic encoding
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

  class KoremutakeAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Koremutake Encoding";
      this.description = "Memorable phonetic string encoding system that converts large numbers into pronounceable words using consonant-vowel patterns. Designed to create human-readable representations of binary data. Treats the whole byte string as a single unsigned big-endian integer and re-expresses it in base 128 (one syllable per digit), with leading zero bytes each represented by their own leading 'ba' syllable (the same convention Base58Check uses for leading zero bytes) so the byte count is always recoverable. Encodes any byte sequence of any length losslessly - there is no restricted input domain.";
      this.inventor = "Shorl.com";
      this.year = 2007;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Phonetic Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Koremutake Specification", "http://shorl.com/koremutake.php"),
        new LinkItem("Phonetic Encoding Systems", "https://en.wikipedia.org/wiki/Phonetic_algorithm"),
        new LinkItem("Human-readable Identifiers", "https://tools.ietf.org/html/draft-hallambaker-mesh-udf-03")
      ];

      this.references = [
        new LinkItem("Memorable String Generation", "https://www.npmjs.com/package/koremutake"),
        new LinkItem("Base Conversion Algorithms", "https://en.wikipedia.org/wiki/Radix"),
        new LinkItem("Pronunciation Systems", "https://www.internationalphoneticalphabet.org/")
      ];

      this.knownVulnerabilities = [];

      // Test vectors for Koremutake. Empty input encodes to an empty string
      // (not the single syllable "ba" the original placeholder used) -
      // "ba" is the correct encoding of a *single zero byte* ([0]) under
      // the leading-zero-byte convention, and reusing it for the empty
      // string as well would make the two inputs indistinguishable on
      // decode.
      this.tests = [
        new TestCase(
          [],
          [],
          "Koremutake empty data test",
          "http://shorl.com/koremutake.php"
        ),
        new TestCase(
          [1],
          OpCodes.AnsiToBytes("be"),
          "Single byte encoding test - Koremutake",
          "Educational example"
        ),
        new TestCase(
          [0],
          OpCodes.AnsiToBytes("ba"),
          "Single zero byte encoding test - Koremutake (leading-zero-byte marker, distinct from empty input)",
          "Educational example"
        ),
        new TestCase(
          [0, 0],
          OpCodes.AnsiToBytes("baba"),
          "Two zero bytes encoding test - Koremutake",
          "Shorl.com specification"
        ),
        new TestCase(
          [200, 1],
          OpCodes.AnsiToBytes("bofube"),
          "High-bit-set byte regression test - the old 'byte % 128' scheme discarded the 8th bit, so 200 and 200-128=72 encoded identically",
          "Educational example"
        ),
        new TestCase(
          Array.from({length: 256}, (_, i) => i),
          OpCodes.AnsiToBytes("babububobibejixanijigadubyrebetiblupajifydobuxipykuvuluhafaruremexabripajefudikajuhefusikigesibygatolivulogydyzabodosazamuhisyrubrepyxubrinyjafokoxodribebirajotodivamihyfusekegazorizunojatikuvasimyjuvelivoligulekewablynuwulyvufagugefesaxymohebledasokyviblanawesybryboroxubrenuhyluzenyxebradripewyfovobrefrabebepyjiblusalihifodirixitonixunahyfosakamikyhutulegusozagehevablinohytekobridufedurykatuzovadrirokivelevilemyzudryraxomivybleguwemywublynowolubrysobledrifrepuxabluvupakigyferyxuminoliwumohotazebrihihygutekyvezymydrofetazynewiblibrywefradederoxobranopablipojytyzubrodrohywubrypoxeblydrepafratelyweblodradrufrawypozebrydryfre"),
          "All 256 byte values regression test - exercises the full big-integer base-128 conversion path",
          "Educational example"
        )
      ];

      // Koremutake syllables (128 total)
      this.syllables = [
        "ba", "be", "bi", "bo", "bu", "by", "da", "de", "di", "do", "du", "dy", "fa", "fe", "fi", "fo",
        "fu", "fy", "ga", "ge", "gi", "go", "gu", "gy", "ha", "he", "hi", "ho", "hu", "hy", "ja", "je",
        "ji", "jo", "ju", "jy", "ka", "ke", "ki", "ko", "ku", "ky", "la", "le", "li", "lo", "lu", "ly",
        "ma", "me", "mi", "mo", "mu", "my", "na", "ne", "ni", "no", "nu", "ny", "pa", "pe", "pi", "po",
        "pu", "py", "ra", "re", "ri", "ro", "ru", "ry", "sa", "se", "si", "so", "su", "sy", "ta", "te",
        "ti", "to", "tu", "ty", "va", "ve", "vi", "vo", "vu", "vy", "wa", "we", "wi", "wo", "wu", "wy",
        "xa", "xe", "xi", "xo", "xu", "xy", "za", "ze", "zi", "zo", "zu", "zy", "bla", "ble", "bli", "blo",
        "blu", "bly", "bra", "bre", "bri", "bro", "bru", "bry", "dra", "dre", "dri", "dro", "dru", "dry",
        "fra", "fre", "fri", "fro", "fru", "fry", "gra", "gre", "gri", "gro", "gru", "gry", "pra", "pre"
      ];

      this.decodeTable = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KoremutakeInstance(this, isInverse);
    }

    init() {
      // Build decode lookup table
      this.decodeTable = {};
      for (let i = 0; i < this.syllables.length; i++) {
        this.decodeTable[this.syllables[i]] = i;
      }
    }
  }

  /**
 * Koremutake cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KoremutakeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;

      this.algorithm.init();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('KoremutakeInstance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        this.processedData = this.decode(data);
      } else {
        this.processedData = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.processedData === null) {
        throw new Error('KoremutakeInstance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    /**
   * Encode arbitrary bytes losslessly: strip any leading 0x00 bytes,
   * remember how many there were (each becomes its own leading syllable
   * 0, "ba"), then treat the remaining bytes as one big-endian unsigned
   * integer and re-express it in base 128 - one syllable per digit, most
   * significant digit first. Big-integer arithmetic (not byte-by-byte
   * modulo) is required: the previous "byte % 128" scheme discarded the
   * 8th bit of every byte >= 128, which is not reversible.
   */

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      let zeroByteCount = 0;
      while (zeroByteCount < data.length && data[zeroByteCount] === 0) zeroByteCount++;

      const digits = new Array(zeroByteCount).fill(0);

      if (zeroByteCount < data.length) {
        let value = 0n;
        for (let i = zeroByteCount; i < data.length; i++) value = value * 256n + BigInt(data[i]);

        const valueDigits = [];
        while (value > 0n) {
          valueDigits.unshift(Number(value % 128n));
          value = value / 128n;
        }
        digits.push(...valueDigits);
      }

      let result = "";
      for (let i = 0; i < digits.length; i++) result += this.algorithm.syllables[digits[i]];

      // Convert string to byte array
      const resultBytes = [];
      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }

    /**
   * Reverse encode(): parse the syllable string back into base-128
   * digits, split off the leading run of digit-0 syllables as the
   * zero-byte-count prefix (a nonzero integer's minimal base-128
   * representation never starts with digit 0, so this split is always
   * unambiguous), then convert the remaining digits back to the minimal
   * big-endian byte string for that integer.
   */

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const encoded = OpCodes.BytesToLatin1(data);
      const digits = [];
      let i = 0;

      while (i < encoded.length) {
        // Try to match longest syllable first (3 characters)
        let found = false;

        if (i + 3 <= encoded.length) {
          const syllable3 = encoded.substring(i, i + 3);
          if (this.algorithm.decodeTable.hasOwnProperty(syllable3)) {
            digits.push(this.algorithm.decodeTable[syllable3]);
            i += 3;
            found = true;
          }
        }

        // Try 2 character syllable
        if (!found && i + 2 <= encoded.length) {
          const syllable2 = encoded.substring(i, i + 2);
          if (this.algorithm.decodeTable.hasOwnProperty(syllable2)) {
            digits.push(this.algorithm.decodeTable[syllable2]);
            i += 2;
            found = true;
          }
        }

        if (!found) {
          throw new Error(`KoremutakeInstance.decode: unknown syllable at position ${i}`);
        }
      }

      let zeroByteCount = 0;
      while (zeroByteCount < digits.length && digits[zeroByteCount] === 0) zeroByteCount++;

      const result = new Array(zeroByteCount).fill(0);

      if (zeroByteCount < digits.length) {
        let value = 0n;
        for (let j = zeroByteCount; j < digits.length; j++) value = value * 128n + BigInt(digits[j]);

        const valueBytes = [];
        while (value > 0n) {
          valueBytes.unshift(Number(value % 256n));
          value = value / 256n;
        }
        result.push(...valueBytes);
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new KoremutakeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { KoremutakeAlgorithm, KoremutakeInstance };
}));