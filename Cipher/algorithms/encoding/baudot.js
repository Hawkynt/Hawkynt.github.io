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
      this.description = "5-bit character encoding used in early teleprinters and telegraph systems. Uses two modes (LETTERS and FIGURES) selected by special shift characters. Educational implementation of International Telegraph Alphabet No. 2 (ITA2/CCITT-2).";
      this.inventor = "Émile Baudot";
      this.year = 1874;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Telegraph Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.FR;

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
        )
      ];

      // ITA2 character sets - indexed by 5-bit value (0-31)
      this.lettersSet = [
        '\0',  'E',  '\n', 'A',  ' ',  'S',  'I',  'U',    // 00-07
        '\r', 'D',  'R',   'J',  'N',  'F',  'C',  'K',    // 08-15
        'T',   'Z',  'L',   'W',  'H',  'Y',  'P',  'Q',    // 16-23
        'O',   'B',  'G',   'FIG', 'M', 'X',  'V',  'LET'   // 24-31
      ];

      this.figuresSet = [
        '\0',  '3',  '\n', '-',  ' ',  "'", '8',  '7',    // 00-07
        '\r', '$',  '4',   ',', '.',  '!',  ':',  '(',    // 08-15
        '5',   '+',  ')',   '2',  '#',  '6',  '0',  '1',    // 16-23
        '9',   '?',  '&',   'FIG', '.',  '/',  ';',  'LET'   // 24-31
      ];

      // Special control codes
      this.LTRS = 31;  // Letters shift (code 31)
      this.FIGS = 27;  // Figures shift (code 27)

      this.lettersToCode = null;
      this.figuresToCode = null;
    }

    CreateInstance(isInverse = false) {
      return new BaudotInstance(this, isInverse);
    }

    init() {
      // Build reverse lookup tables
      this.lettersToCode = {};
      this.figuresToCode = {};

      for (let i = 0; i < 32; i++) {
        const letter = this.lettersSet[i];
        const figure = this.figuresSet[i];

        if (letter && letter !== 'LET' && letter !== 'FIG') {
          this.lettersToCode[letter] = i;
        }

        if (figure && figure !== 'LET' && figure !== 'FIG') {
          this.figuresToCode[figure] = i;
        }
      }
    }
  }

  class BaudotInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.processedData = null;
      this.currentMode = 'LETTERS';

      this.algorithm.init();
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('BaudotInstance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        this.processedData = this.decode(data);
      } else {
        this.processedData = this.encode(data);
      }
    }

    Result() {
      if (this.processedData === null) {
        throw new Error('BaudotInstance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      const text = String.fromCharCode(...data);
      const codes = [];
      let currentMode = 'LETTERS';

      for (let i = 0; i < text.length; i++) {
        const char = text[i].toUpperCase();
        let code = null;
        let requiredMode = null;

        // Determine which mode the character belongs to
        if (this.algorithm.lettersToCode.hasOwnProperty(char)) {
          code = this.algorithm.lettersToCode[char];
          requiredMode = 'LETTERS';
        } else if (this.algorithm.figuresToCode.hasOwnProperty(char)) {
          code = this.algorithm.figuresToCode[char];
          requiredMode = 'FIGURES';
        } else {
          // Unknown character - skip
          continue;
        }

        // Switch modes if necessary
        if (requiredMode !== currentMode) {
          if (requiredMode === 'LETTERS') {
            codes.push(this.algorithm.LTRS);
          } else {
            codes.push(this.algorithm.FIGS);
          }
          currentMode = requiredMode;
        }

        codes.push(code);
      }

      return codes;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      let result = '';
      let currentMode = 'LETTERS';

      for (const code of data) {
        if (code === this.algorithm.LTRS) {
          currentMode = 'LETTERS';
          continue;
        } else if (code === this.algorithm.FIGS) {
          currentMode = 'FIGURES';
          continue;
        }

        if (code >= 0 && code < 32) {
          const char = currentMode === 'LETTERS' ? 
            this.algorithm.lettersSet[code] : this.algorithm.figuresSet[code];

          if (char && char !== 'LET' && char !== 'FIG') {
            if (char === '\\n') {
              result += '\n';
            } else if (char === '\\r') {
              result += '\r';
            } else if (char === '\\0') {
              result += '\0';
            } else {
              result += char;
            }
          }
        }
      }

      // Convert string to byte array
      const resultBytes = [];
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