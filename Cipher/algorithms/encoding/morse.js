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
      this.description = "Method of transmitting text information as a series of on-off tones, lights, or clicks using standardized sequences of short and long signals called dots and dashes. Educational implementation following ITU-R M.1677-1 standard.";
      this.inventor = "Samuel Morse";
      this.year = 1836;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Telegraph Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

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
        )
      ];

      // International Morse Code alphabet (ITU-R M.1677-1)
      this.morseTable = {
        // Letters
        'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',   'E': '.',
        'F': '..-.',  'G': '--.',   'H': '....',  'I': '..',    'J': '.---',
        'K': '-.-',   'L': '.-..',  'M': '--',    'N': '-.',    'O': '---',
        'P': '.--.',  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
        'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',  'Y': '-.--',
        'Z': '--..',

        // Numbers
        '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
        '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',

        // Punctuation
        '.': '.-.-.-',  ',': '--..--',  '?': '..--..',  '\'': '.----.',
        '!': '-.-.--',  '/': '-..-.',   '(': '-.--.',   ')': '-.--.-',
        '&': '.-...',   ':': '---...',  ';': '-.-.-.',  '=': '-...-',
        '+': '.-.-.',   '-': '-....-',  '_': '..--.-',  '"': '.-..-.',
        '$': '...-..-', '@': '.--.-.',  ' ': '/',       

        // Prosigns (procedural signals)
        '<AR>': '.-.-.',    // End of message
        '<AS>': '.-...',    // Wait
        '<BT>': '-...-',    // Break
        '<CT>': '-.-.-',    // Starting signal
        '<KA>': '-.-.-',    // Attention
        '<KN>': '-.--.',    // Go ahead
        '<SK>': '...-.-',   // End of work
        '<SN>': '...-.',    // Understood
        '<SOS>': '...---...' // Distress signal
      };

      this.reverseTable = null;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MorseInstance(this, isInverse);
    }

    init() {
      // Build reverse lookup table
      this.reverseTable = {};
      for (const [char, morse] of Object.entries(this.morseTable)) {
        this.reverseTable[morse] = char;
      }
    }
  }

  /**
 * Morse cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MorseInstance extends IAlgorithmInstance {
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
        throw new Error('MorseInstance.Feed: Input must be byte array');
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
        throw new Error('MorseInstance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      const text = String.fromCharCode(...data);
      const upperData = text.toUpperCase();
      const morseWords = [];

      // Split into words
      const words = upperData.split(/\s+/);

      for (const word of words) {
        if (word.length === 0) continue;

        const morseLetters = [];

        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          const morseChar = this.algorithm.morseTable[char];

          if (morseChar) {
            morseLetters.push(morseChar);
          } else {
            // Unknown character - represent as question mark
            morseLetters.push(this.algorithm.morseTable['?']);
          }
        }

        morseWords.push(morseLetters.join(' '));
      }

      const result = morseWords.join('  /  ');

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

      const morse = String.fromCharCode(...data);

      // Ensure reverse table is built
      if (!this.algorithm.reverseTable) {
        this.algorithm.init();
      }

      // Clean up input - normalize spaces and separators
      let cleanData = morse.trim()
        .replace(/\s*\/\s*/g, ' / ')  // Normalize word separators
        .replace(/\s+/g, ' ')          // Normalize multiple spaces
        .replace(/[^.\-\s/]/g, '');     // Remove invalid characters

      // Split by word separators
      const morseWords = cleanData.split(' / ');
      const decodedWords = [];

      for (const morseWord of morseWords) {
        if (morseWord.trim().length === 0) continue;

        // Split by letter separators (single space)
        const morseLetters = morseWord.trim().split(' ');
        const decodedLetters = [];

        for (const morseLetter of morseLetters) {
          if (morseLetter.length === 0) continue;

          const decodedChar = this.algorithm.reverseTable[morseLetter];
          if (decodedChar) {
            decodedLetters.push(decodedChar);
          } else {
            // Unknown Morse pattern
            decodedLetters.push('?');
          }
        }

        decodedWords.push(decodedLetters.join(''));
      }

      const result = decodedWords.join(' ');

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

    const algorithmInstance = new MorseAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MorseAlgorithm, MorseInstance };
}));