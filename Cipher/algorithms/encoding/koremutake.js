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

  // ===== BASE 128 REGROUPING =====

  // Re-expressing the input in base 128 looks like a big-integer conversion, and
  // it used to be implemented as one: build a BigInt from the bytes, then divide
  // it by 128 once per syllable. Both halves of that are quadratic - the build
  // multiplies a growing accumulator by 256 per byte, and each division walks the
  // whole remaining number - so a megabyte would have taken tens of minutes.
  //
  // None of it is necessary. 128 is 2^7, so base 256 to base 128 is not a
  // division problem at all: it is a regrouping of the same bit string from
  // 8-bit groups into 7-bit groups. Walking the bytes from the least significant
  // end through a small accumulator emits exactly the digits the big-integer
  // conversion produced, in one linear pass over the input, and the reverse
  // regroups 7-bit digits back into bytes the same way.

  // Indexed by a digit width (the radix of the target digits), so it has to
  // reach at least eight.
  /** @type {int32[]} */
  const POWERS_OF_TWO = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];

  /**
   * Regroup a big-endian bit string from digits of one power-of-two radix into
   * digits of another. Both sides are most significant first; the caller must
   * have stripped leading zero digits, and the result likewise carries none, so
   * it is the minimal representation of the same integer.
   * @param {uint8[]} source - Source digits, most significant first
   * @param {int32} from - First index to read
   * @param {int32} sourceBits - Bits per source digit
   * @param {int32} targetBits - Bits per target digit
   * @returns {uint8[]} Target digits, most significant first
   */
  function Regroup(source, from, sourceBits, targetBits) {
    /** @type {int32} */
    const targetRadix = POWERS_OF_TWO[targetBits];
    /** @type {uint8[]} */
    const reversed = [];

    // The accumulator never holds more than sourceBits + targetBits bits
    /** @type {int32} */
    let accumulator = 0;
    /** @type {int32} */
    let bits = 0;
    for (let i = source.length - 1; i >= from; i--) {
      accumulator += OpCodes.Shl32(source[i], bits);
      bits += sourceBits;

      while (bits >= targetBits) {
        /** @type {int32} */
        const digit = accumulator % targetRadix;
        reversed.push(digit);
        accumulator = (accumulator - digit) / targetRadix;
        bits -= targetBits;
      }
    }

    // Whatever is left is the most significant digit; if it is zero the digit
    // string is already minimal and nothing more belongs at the front.
    if (accumulator > 0) {
      reversed.push(accumulator);
    }

    /** @type {uint8[]} */
    const result = new Array(reversed.length);
    for (let i = 0; i < reversed.length; i++) {
      result[i] = reversed[reversed.length - 1 - i];
    }

    return result;
  }

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
      /** @type {string[]} */
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

      // Character codes per syllable, built by init(), so the encoder can
      // write its output bytes straight out instead of building a
      // multi-megabyte intermediate string
      /** @type {uint8[][]|null} */
      this.syllableCodes = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {KoremutakeInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KoremutakeInstance(this, isInverse);
    }

    /** Build the per-syllable character codes (once) */
    init() {
      if (this.syllableCodes !== null) {
        return;
      }

      /** @type {uint8[][]} */
      const table = new Array(this.syllables.length);
      for (let i = 0; i < this.syllables.length; i++) {
        /** @type {string} */
        const syllable = this.syllables[i];
        /** @type {uint8[]} */
        const codes = new Array(syllable.length);
        for (let j = 0; j < syllable.length; j++) {
          codes[j] = syllable.charCodeAt(j);
        }
        table[i] = codes;
      }
      this.syllableCodes = table;
    }
  }

  /**
 * Koremutake cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class KoremutakeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {KoremutakeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.processedData = null;
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      algorithm.init();
      /** @type {string[]} */
      this.syllables = algorithm.syllables;
      /** @type {uint8[][]} */
      this.syllableCodes = algorithm.syllableCodes;
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

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk also cannot be converted on its
      // own, because the coder groups whole units of input and emits padding and
      // framing at the end of the message, so the bytes are collected here and
      // converted once, in Result().
      if (!this._feedBuffer) {
        /** @type {uint8[]} */
        const fresh = [];
        this._feedBuffer = fresh;
      }
      for (let i = 0; i < data.length; i++) {
        this._feedBuffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('KoremutakeInstance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
   * Encode arbitrary bytes losslessly: strip any leading 0x00 bytes,
   * remember how many there were (each becomes its own leading syllable
   * 0, "ba"), then treat the remaining bytes as one big-endian unsigned
   * integer and re-express it in base 128 - one syllable per digit, most
   * significant digit first. Per-byte arithmetic on the bytes themselves is
   * not enough: the previous "byte % 128" scheme discarded the 8th bit of
   * every byte >= 128, which is not reversible. Because 128 is a power of
   * two, though, the conversion is a regrouping of the input bits from
   * 8-bit into 7-bit groups and needs no big-integer arithmetic at all.
   * @param {uint8[]} data - Input bytes
   * @returns {uint8[]} ASCII syllables
   */

    encode(data) {
      /** @type {uint8[]} */
      const digits = [];
      if (data.length === 0) {
        return digits;
      }

      /** @type {int32} */
      let zeroByteCount = 0;
      while (zeroByteCount < data.length && data[zeroByteCount] === 0) {
        zeroByteCount++;
      }

      for (let i = 0; i < zeroByteCount; i++) {
        digits.push(0);
      }
      if (zeroByteCount < data.length) {
        /** @type {uint8[]} */
        const valueDigits = Regroup(data, zeroByteCount, 8, 7);
        for (let i = 0; i < valueDigits.length; i++) {
          digits.push(valueDigits[i]);
        }
      }

      /** @type {int32} */
      let length = 0;
      for (let i = 0; i < digits.length; i++) {
        length += this.syllableCodes[digits[i]].length;
      }

      /** @type {uint8[]} */
      const resultBytes = new Array(length);
      /** @type {int32} */
      let at = 0;
      for (let i = 0; i < digits.length; i++) {
        /** @type {uint8[]} */
        const codes = this.syllableCodes[digits[i]];
        for (let j = 0; j < codes.length; j++) {
          resultBytes[at++] = codes[j];
        }
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
   * @param {uint8[]} data - ASCII syllables
   * @returns {uint8[]} Decoded bytes
   */

    decode(data) {
      /** @type {uint8[]} */
      const result = [];
      if (data.length === 0) {
        return result;
      }

      /** @type {string} */
      const encoded = OpCodes.BytesToChars(data);
      /** @type {uint8[]} */
      const digits = [];
      /** @type {int32} */
      let i = 0;

      while (i < encoded.length) {
        // Try to match longest syllable first (3 characters)
        /** @type {boolean} */
        let found = false;

        if (i + 3 <= encoded.length) {
          /** @type {int32} */
          const digit3 = this.syllables.indexOf(encoded.substring(i, i + 3));
          if (digit3 >= 0) {
            digits.push(digit3);
            i += 3;
            found = true;
          }
        }

        // Try 2 character syllable
        if (!found && i + 2 <= encoded.length) {
          /** @type {int32} */
          const digit2 = this.syllables.indexOf(encoded.substring(i, i + 2));
          if (digit2 >= 0) {
            digits.push(digit2);
            i += 2;
            found = true;
          }
        }

        if (!found) {
          throw new Error("KoremutakeInstance.decode: unknown syllable at position " + i);
        }
      }

      /** @type {int32} */
      let zeroByteCount = 0;
      while (zeroByteCount < digits.length && digits[zeroByteCount] === 0) {
        zeroByteCount++;
      }

      for (let k = 0; k < zeroByteCount; k++) {
        result.push(0);
      }
      if (zeroByteCount < digits.length) {
        /** @type {uint8[]} */
        const valueBytes = Regroup(digits, zeroByteCount, 7, 8);
        for (let k = 0; k < valueBytes.length; k++) {
          result.push(valueBytes[k]);
        }
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