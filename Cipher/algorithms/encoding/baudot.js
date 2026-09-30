/*
 * Baudot Code (ITA2) Encoding Implementation
 * Educational implementation of 5-bit telegraph encoding used in early teleprinters
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

  class BaudotAlgorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Baudot Code (ITA2)";
      this.description = "5-bit character encoding used in early teleprinters and telegraph systems. Uses two modes (LETTERS and FIGURES) selected by special shift characters. Educational implementation of International Telegraph Alphabet No. 2 (ITA2/CCITT-2). ITA2 has only 32 five-bit code points per mode and no concept of letter case, so it can only represent the exact uppercase letters, digits, and punctuation listed in its LETTERS/FIGURES tables (plus space, CR, LF and NUL) - any other byte, including lowercase letters and arbitrary binary data, is rejected rather than silently folded or dropped.";
      this.inventor = "Émile Baudot";
      this.year = 1874;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Telegraph Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.FR;

      // ITA2 has exactly 32 letters-mode and 32 figures-mode code points and
      // is inherently case-insensitive, so it cannot represent arbitrary
      // bytes. Declared here so the round-trip suite scores a clean
      // rejection of out-of-domain bytes as a domain limit, not a defect.
      this.restrictedInputDomain = true;

      // Documentation and references
      this.documentation = [
        new LinkItem("ITU-T Recommendation F.1", "https://www.itu.int/rec/T-REC-F.1/"),
        new LinkItem("CCITT-2 (ITA2) Specification", "https://en.wikipedia.org/wiki/Baudot_code"),
        new LinkItem("Telegraph History", "https://en.wikipedia.org/wiki/Electrical_telegraph")
      ];

      this.references = [
        new LinkItem("International Telegraph Alphabet", "https://en.wikipedia.org/wiki/Telegraph_code"),
        new LinkItem("Early Teleprinter Systems", "https://www.computerhistory.org/revolution/computer-communications/"),
        new LinkItem("Baudot Code Analysis", "https://www.dcode.fr/baudot-code")
      ];

      this.knownVulnerabilities = [];

      // Test vectors from ITA2 standard
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes(""),
          [],
          "Baudot empty string test",
          "https://en.wikipedia.org/wiki/Baudot_code"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("A"),
          [3], // Binary: 00011 (A in letters mode)
          "Single letter A test - Baudot ITA2",
          "https://www.dcode.fr/baudot-code"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("E"),
          [1], // Binary: 00001 (E in letters mode)
          "Letter E encoding test - Baudot",
          "ITU-T F.1 standard"
        ),
        new TestCase(
          [0, 65, 0],
          [0, 3, 0],
          "NUL-A-NUL regression test - code point 0 ('\\0') must round-trip; it was previously unencodable because '\\0' is falsy in JavaScript",
          "https://en.wikipedia.org/wiki/Baudot_code"
        )
      ];

      // ITA2 character sets - indexed by 5-bit value (0-31)
      /** @type {string[]} */
      this.lettersSet = [
        '\0',  'E',  '\n', 'A',  ' ',  'S',  'I',  'U',    // 00-07
        '\r', 'D',  'R',   'J',  'N',  'F',  'C',  'K',    // 08-15
        'T',   'Z',  'L',   'W',  'H',  'Y',  'P',  'Q',    // 16-23
        'O',   'B',  'G',   'FIG', 'M', 'X',  'V',  'LET'   // 24-31
      ];

      /** @type {string[]} */
      this.figuresSet = [
        '\0',  '3',  '\n', '-',  ' ',  "'", '8',  '7',    // 00-07
        '\r', '$',  '4',   ',', '.',  '!',  ':',  '(',    // 08-15
        '5',   '+',  ')',   '2',  '#',  '6',  '0',  '1',    // 16-23
        '9',   '?',  '&',   'FIG', '.',  '/',  ';',  'LET'   // 24-31
      ];

      // Special control codes
      /** @type {uint8} */
      this.LTRS = 31;  // Letters shift (code 31)
      /** @type {uint8} */
      this.FIGS = 27;  // Figures shift (code 27)

      // Reverse lookup tables, indexed by character code: the ITA2 code of
      // that character in the mode, or -1 when the mode cannot spell it
      /** @type {int32[]|null} */
      this.lettersToCode = null;
      /** @type {int32[]|null} */
      this.figuresToCode = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {BaudotInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BaudotInstance(this, isInverse);
    }

    /**
     * Reverse lookup of one character set: character code -> ITA2 code.
     * A character listed twice keeps its later code point.
     * @param {string[]} set - 32-entry character set
     * @returns {int32[]} 256-entry table, -1 for characters the set lacks
     */
    buildReverse(set) {
      /** @type {int32[]} */
      const table = new Array(256);
      for (let c = 0; c < 256; c++) {
        table[c] = -1;
      }
      for (let i = 0; i < 32; i++) {
        /** @type {string} */
        const ch = set[i];
        // Code point 0 maps to '\0' in both tables and must stay encodable,
        // so only the two shift pseudo-entries are skipped.
        if (ch !== 'LET' && ch !== 'FIG') {
          table[ch.charCodeAt(0)] = i;
        }
      }
      return table;
    }

    /** Build the reverse lookup tables */
    init() {
      this.lettersToCode = this.buildReverse(this.lettersSet);
      this.figuresToCode = this.buildReverse(this.figuresSet);
    }
  }

  /** @type {int32} */
  const MODE_LETTERS = 0;
  /** @type {int32} */
  const MODE_FIGURES = 1;

  /**
 * Baudot cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class BaudotInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {BaudotAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this.processedData = null;
      /** @type {string} */
      this.currentMode = 'LETTERS';
      /** @type {uint8[]|null} */
      this._feedBuffer = null;
      algorithm.init();
      /** @type {string[]} */
      this.lettersSet = algorithm.lettersSet;
      /** @type {string[]} */
      this.figuresSet = algorithm.figuresSet;
      /** @type {int32[]} */
      this.lettersToCode = algorithm.lettersToCode;
      /** @type {int32[]} */
      this.figuresToCode = algorithm.figuresToCode;
      /** @type {uint8} */
      this.LTRS = algorithm.LTRS;
      /** @type {uint8} */
      this.FIGS = algorithm.FIGS;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BaudotInstance.Feed: Input must be byte array');
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
        throw new Error('BaudotInstance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * Encode text bytes as ITA2 codes, inserting shift codes as needed
     * @param {uint8[]} data - Text bytes
     * @returns {uint8[]} 5-bit ITA2 codes
     */
    encode(data) {
      /** @type {uint8[]} */
      const codes = [];
      if (data.length === 0) {
        return codes;
      }

      /** @type {int32} */
      let currentMode = MODE_LETTERS;

      for (let i = 0; i < data.length; i++) {
        // No case folding: ITA2 has no notion of case, so silently
        // upper-casing here (as this code used to do) would make 'a' and
        // 'A' encode identically and decode back as only 'A' - a lossy
        // transformation that breaks round-trip fidelity for byte 0x61-0x7A.
        // Lower-case bytes are simply outside this codec's domain.
        /** @type {int32} */
        const ch = data[i];
        /** @type {int32} */
        const letter = ch >= 0 && ch < 256 ? this.lettersToCode[ch] : -1;
        /** @type {int32} */
        const figure = ch >= 0 && ch < 256 ? this.figuresToCode[ch] : -1;
        /** @type {int32} */
        let code = 0;
        /** @type {int32} */
        let requiredMode = MODE_LETTERS;

        // Determine which mode the character belongs to
        if (letter >= 0) {
          code = letter;
          requiredMode = MODE_LETTERS;
        } else if (figure >= 0) {
          code = figure;
          requiredMode = MODE_FIGURES;
        } else {
          // Unknown character - reject rather than silently dropping it
          // (dropping bytes is silent data corruption, not a domain limit).
          /** @type {string} */
          let hex = ch.toString(16);
          while (hex.length < 2) {
            hex = '0' + hex;
          }
          /** @type {string} */
          const shown = ch < 0x20 ? '?' : String.fromCharCode(ch);
          throw new Error("BaudotInstance.encode: byte 0x" + hex + " ('" + shown + "') at position " + i + " has no ITA2 representation");
        }

        // Switch modes if necessary
        if (requiredMode !== currentMode) {
          if (requiredMode === MODE_LETTERS) {
            codes.push(this.LTRS);
          } else {
            codes.push(this.FIGS);
          }
          currentMode = requiredMode;
        }

        codes.push(code);
      }

      return codes;
    }

    /**
     * Decode ITA2 codes to text bytes, following the shift codes
     * @param {uint8[]} data - 5-bit ITA2 codes
     * @returns {uint8[]} Text bytes
     */
    decode(data) {
      /** @type {uint8[]} */
      const resultBytes = [];
      if (data.length === 0) {
        return resultBytes;
      }

      /** @type {string} */
      let result = '';
      /** @type {int32} */
      let currentMode = MODE_LETTERS;

      for (let i = 0; i < data.length; i++) {
        /** @type {int32} */
        const code = data[i];
        if (code === this.LTRS) {
          currentMode = MODE_LETTERS;
          continue;
        } else if (code === this.FIGS) {
          currentMode = MODE_FIGURES;
          continue;
        }

        if (code >= 0 && code < 32) {
          /** @type {string} */
          const ch = currentMode === MODE_LETTERS ? this.lettersSet[code] : this.figuresSet[code];
          if (ch !== 'LET' && ch !== 'FIG') {
            result += ch;
          }
        }
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

    const algorithmInstance = new BaudotAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BaudotAlgorithm, BaudotInstance };
}));