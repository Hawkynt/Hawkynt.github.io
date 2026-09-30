/*
 * Morse Code (International) Encoding Implementation
 * Educational implementation of International Morse Code (ITU-R M.1677-1)
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

  class MorseAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Morse Code (International)";
      this.description = "Method of transmitting text information as a series of on-off tones, lights, or clicks using standardized sequences of short and long signals called dots and dashes. Educational implementation following ITU-R M.1677-1 standard. ITU-R M.1677-1 only defines patterns for uppercase letters, digits, a fixed set of punctuation, and space; it has no case distinction and no representation for control characters or arbitrary binary data, so any other byte is rejected rather than silently mapped to '?' or case-folded.";
      this.inventor = "Samuel Morse";
      this.year = 1836;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Telegraph Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Morse only has patterns for uppercase letters/digits/punctuation/
      // space; it cannot represent case, control bytes, or arbitrary binary
      // data. Declared here so the round-trip suite scores a clean
      // rejection of out-of-domain bytes as a domain limit, not a defect.
      this.restrictedInputDomain = true;

      // Documentation and references
      this.documentation = [
        new LinkItem("ITU-R M.1677-1: International Morse Code", "https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1677-1-200910-I!!PDF-E.pdf"),
        new LinkItem("Morse Code - Wikipedia", "https://en.wikipedia.org/wiki/Morse_code"),
        new LinkItem("International Telegraph Alphabet", "https://en.wikipedia.org/wiki/Telegraph_code")
      ];

      this.references = [
        new LinkItem("Ham Radio Morse Code Standards", "https://www.arrl.org/morse-code"),
        new LinkItem("Educational Morse Code Examples", "https://morsecode.world/international/morse.html"),
        new LinkItem("GNU Radio Morse Implementation", "https://github.com/gnuradio/gnuradio/tree/master/gr-digital/lib")
      ];

      this.knownVulnerabilities = [];

      // Test vectors from ITU-R M.1677-1 standard
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes(""),
          OpCodes.AnsiToBytes(""),
          "Morse empty string test",
          "https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1677-1-200910-I!!PDF-E.pdf"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("E"),
          OpCodes.AnsiToBytes("."),
          "Single letter E test - ITU-R M.1677-1",
          "https://en.wikipedia.org/wiki/Morse_code#Letters"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("SOS"),
          OpCodes.AnsiToBytes("... --- ..."),
          "SOS distress signal test - Morse",
          "ITU-R M.1677-1 standard"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("HELLO"),
          OpCodes.AnsiToBytes(".... . .-.. .-.. ---"),
          "Basic word encoding test - Morse",
          "Educational standard"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("SOS  &=("),
          OpCodes.AnsiToBytes("... --- ... / / .-... -...- -.--."),
          "Exact-spacing and prosign-collision regression test - a doubled space must round-trip exactly (previous word-splitting collapsed runs of whitespace), and '&'/'='/'(' must decode back to themselves rather than to a same-pattern prosign",
          "https://en.wikipedia.org/wiki/Morse_code"
        )
      ];

      // International Morse Code alphabet (ITU-R M.1677-1): each symbol and
      // its pattern, at the same index of the two lists
      /** @type {string[]} */
      this.morseSymbols = [
        // Letters
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        // Numbers
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        // Punctuation
        '.', ',', '?', '\'', '!', '/', '(', ')', '&', ':', ';', '=',
        '+', '-', '_', '"', '$', '@', ' ',
        // Prosigns (procedural signals)
        '<AR>', '<AS>', '<BT>', '<CT>', '<KA>', '<KN>', '<SK>', '<SN>', '<SOS>'
      ];
      /** @type {string[]} */
      this.morseCodes = [
        // Letters
        '.-', '-...', '-.-.', '-..', '.', '..-.', '--.', '....', '..', '.---', '-.-', '.-..', '--',
        '-.', '---', '.--.', '--.-', '.-.', '...', '-', '..-', '...-', '.--', '-..-', '-.--', '--..',
        // Numbers
        '-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.',
        // Punctuation
        '.-.-.-', '--..--', '..--..', '.----.', '-.-.--', '-..-.', '-.--.', '-.--.-', '.-...', '---...', '-.-.-.', '-...-',
        '.-.-.', '-....-', '..--.-', '.-..-.', '...-..-', '.--.-.', '/',
        // Prosigns: End of message, Wait, Break, Starting signal, Attention,
        // Go ahead, End of work, Understood, Distress signal
        '.-.-.', '.-...', '-...-', '-.-.-', '-.-.-', '-.--.', '...-.-', '...-.', '...---...'
      ];

      /** @type {string[]|null} */
      this.encodeTable = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {MorseInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MorseInstance(this, isInverse);
    }

    /**
     * Build the encode table: the pattern of each character code, or '' when
     * the character has none. Only single-character symbols participate:
     * several prosigns share a pattern with an ordinary punctuation character
     * (e.g. '<AS>' and '&' are both '.-...'), and the coder only ever maps
     * single characters, so a multi-character prosign must never win that
     * collision (which made '&', '=' and '(' undecodable once).
     */
    init() {
      /** @type {string[]} */
      const table = new Array(256);
      for (let c = 0; c < 256; c++) {
        table[c] = '';
      }
      for (let i = 0; i < this.morseSymbols.length; i++) {
        /** @type {string} */
        const symbol = this.morseSymbols[i];
        if (symbol.length === 1) {
          table[symbol.charCodeAt(0)] = this.morseCodes[i];
        }
      }
      this.encodeTable = table;
    }
  }

  /**
 * Morse cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class MorseInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {MorseAlgorithm} algorithm - Parent algorithm instance
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
      this.encodeTable = algorithm.encodeTable;
      /** @type {string[]} */
      this.morseSymbols = algorithm.morseSymbols;
      /** @type {string[]} */
      this.morseCodes = algorithm.morseCodes;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('MorseInstance.Feed: Input must be byte array');
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
        throw new Error('MorseInstance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * Encode text bytes as Morse tokens separated by single spaces
     * @param {uint8[]} data - Text bytes
     * @returns {uint8[]} ASCII Morse text
     */
    encode(data) {
      /** @type {uint8[]} */
      const resultBytes = [];
      if (data.length === 0) {
        return resultBytes;
      }

      // One Morse token per input byte (including the '/' token for a
      // literal space), joined by a single space, with no case-folding and
      // no substitution of unmapped bytes with '?'. This is required for an
      // exact round trip: the previous word-splitting approach collapsed
      // runs of whitespace and any doubled/leading/trailing spaces, and
      // silently replacing an unmappable character with '?' silently
      // corrupted data instead of rejecting it.
      /** @type {string[]} */
      const tokens = [];
      for (let i = 0; i < data.length; i++) {
        /** @type {int32} */
        const ch = data[i];
        /** @type {string} */
        const morseChar = ch >= 0 && ch < 256 ? this.encodeTable[ch] : '';
        if (morseChar.length === 0) {
          /** @type {string} */
          let hex = ch.toString(16);
          while (hex.length < 2) {
            hex = '0' + hex;
          }
          /** @type {string} */
          const shown = ch < 0x20 ? '?' : String.fromCharCode(ch);
          throw new Error("MorseInstance.encode: byte 0x" + hex + " ('" + shown + "') at position " + i + " has no Morse representation");
        }
        tokens.push(morseChar);
      }

      /** @type {string} */
      const result = tokens.join(' ');

      // Convert string to byte array
      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }

    /**
     * Character of a Morse pattern (single-character symbols only)
     * @param {string} token - Morse pattern
     * @returns {string} The character, or '' for an unknown pattern
     */
    symbolOf(token) {
      for (let i = 0; i < this.morseCodes.length; i++) {
        if (this.morseSymbols[i].length === 1 && this.morseCodes[i] === token) {
          return this.morseSymbols[i];
        }
      }
      return '';
    }

    /**
     * Decode Morse text (tokens separated by single spaces) to text bytes
     * @param {uint8[]} data - ASCII Morse text
     * @returns {uint8[]} Text bytes
     */
    decode(data) {
      /** @type {uint8[]} */
      const resultBytes = [];
      if (data.length === 0) {
        return resultBytes;
      }

      /** @type {string} */
      const morse = OpCodes.BytesToChars(data);

      // Mirror encode(): split on the single-space token separator with no
      // normalization, and reject (rather than substitute '?' for) any
      // token that isn't a known Morse pattern.
      /** @type {string[]} */
      const tokens = morse.split(' ');
      /** @type {string} */
      let result = '';
      for (let i = 0; i < tokens.length; i++) {
        /** @type {string} */
        const token = tokens[i];
        /** @type {string} */
        const decodedChar = this.symbolOf(token);
        if (decodedChar.length === 0) {
          throw new Error("MorseInstance.decode: invalid Morse token '" + token + "' at position " + i);
        }
        result += decodedChar;
      }

      // Convert string to byte array
      for (let i = 0; i < result.length; i++) {
        resultBytes.push(result.charCodeAt(i));
      }
      return resultBytes;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new MorseAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MorseAlgorithm, MorseInstance };
}));