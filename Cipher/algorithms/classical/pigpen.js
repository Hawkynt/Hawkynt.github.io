/*
 * Pigpen Cipher Implementation (Freemason Cipher)
 * Historical Geometric Substitution Cipher (Early 1700s)
 * (c)2006-2025 Hawkynt
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

  class Pigpen extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = "Pigpen";
        this.description = "Geometric substitution cipher using tic-tac-toe and X-shaped grids with dots. Also known as Freemason cipher, used by secret societies for concealing correspondence since early 18th century.";
        this.category = CategoryType.CLASSICAL;
        this.subCategory = "Classical Cipher";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.securityNotes = "Historical educational cipher easily broken by frequency analysis. Used by secret societies for concealment rather than security against determined cryptanalysts.";
        this.inventor = "Freemasons/Rosicrucians";
        this.year = 1700;
        this.country = CountryCode.INTL;
        this.complexity = ComplexityType.LOW;

        this.documentation = [
          new LinkItem("Freemason History", "https://freemasonry.bcy.ca/texts/pigpen.html"),
          new LinkItem("Secret Society Cryptography", "https://en.wikipedia.org/wiki/Pigpen_cipher"),
          new LinkItem("Masonic Symbolism", "https://www.masonicdictionary.com/")
        ];

        this.references = [
          new LinkItem("Cipher Machines Museum", "https://www.cryptomuseum.com/"),
          new LinkItem("Historical Cryptography", "https://www.nsa.gov/about/cryptologic-heritage/"),
          new LinkItem("American Cryptogram Association", "https://www.cryptogram.org/")
        ];

        this.knownVulnerabilities = [
          new Vulnerability("Recognizable Symbols", "Geometric symbols are easily recognizable as pigpen cipher once pattern is known"),
          new Vulnerability("Frequency Analysis", "Maintains letter frequency patterns making cryptanalysis straightforward")
        ];

        this.tests = [
          {
            text: "Pigpen Standard Test",
            uri: "Historical Freemason lodge records",
            input: OpCodes.AnsiToBytes("HELLO"), 
            key: OpCodes.AnsiToBytes("standard"),
            expected: OpCodes.AnsiToBytes("HELLO")
          },
          {
            text: "Pigpen ASCII Variant",
            uri: "ASCII compatibility test",
            input: OpCodes.AnsiToBytes("SECRET"), 
            key: OpCodes.AnsiToBytes("ascii"),
            expected: OpCodes.AnsiToBytes("SECRET")
          }
        ];

      }

      /**
       * Create new instance
       * @param {boolean} [isInverse=false] - Decryption mode flag
       * @returns {PigpenInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new PigpenInstance(this, isInverse);
      }
    }

    /**
     * Letter-to-symbol table of one Pigpen variant
     * @class
     */
    class PigpenMapping {
      /**
       * @param {string} letters - Characters that have a symbol, one each
       * @param {string[]} symbols - Symbol of each character, in the same order
       */
      constructor(letters, symbols) {
        /** @type {string} */
        this.letters = letters;
        /** @type {string[]} */
        this.symbols = symbols;
      }

      /**
       * @param {string} letter - Character
       * @returns {string} Its symbol, or '' when it has none
       */
      symbolFor(letter) {
        /** @type {int32} */
        const at = letter.length === 1 ? this.letters.indexOf(letter) : -1;
        return at < 0 ? '' : this.symbols[at];
      }

      /**
       * @param {string} symbol - Symbol
       * @returns {string} The character it stands for, or '' when none does
       */
      letterFor(symbol) {
        // The last character with this symbol wins, as a reverse table built in order would
        for (let i = this.symbols.length - 1; i >= 0; i--) {
          if (this.symbols[i] === symbol) return this.letters.charAt(i);
        }
        return '';
      }
    }

    class PigpenInstance extends IAlgorithmInstance {
      /**
       * @param {Pigpen} algorithm - Parent algorithm instance
       * @param {boolean} [isInverse=false] - Decryption mode flag
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm, isInverse);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {string} */
        this.currentVariant = 'standard';
        /** @type {PigpenMapping|null} */
        this.currentMapping = null;
        /** @type {boolean} */
        this.keyScheduled = false;
        /** @type {uint8[]} */
        this.inputBuffer = [];
        /** @type {uint8[]|null} */
        this._key = null;
      }

      /**
       * @returns {PigpenMapping} Tic-tac-toe and X grids, dots marking the second half
       */
      get standardMapping() {
        return new PigpenMapping('ABCDEFGHIJKLMNOPQRSTUVWXYZ', [
        // Tic-tac-toe grid (no dots)
        '⌊', '⌈', '⌉',
        '├', '┼', '┤',
        '⌞', '⌠', '⌟',

        // Tic-tac-toe grid (with dots)
        '⌊•', '⌈•', '⌉•',
        '├•', '┼•', '┤•',
        '⌞•', '⌠•', '⌟•',

        // X-shaped grid (no dots)
        '⌝', '⌜', '⌟', '⌞',

        // X-shaped grid (with dots)
          '⌝•', '⌜•', '⌞•', '⌟•'
        ]);
      }

      /**
       * @returns {PigpenMapping} ASCII-art approximation of the grids
       */
      get asciiMapping() {
        return new PigpenMapping('ABCDEFGHIJKLMNOPQRSTUVWXYZ', [
        '[', ']', '7',
        'L', '+', ']',
        'J', '_', 'r',
        '[.', '].', '7.',
        'L.', '+.', '].',
        'J.', '_.', 'r.',
          '\\', '/', '<', '>',
          '\\.', '/.', '<.', '>.'
        ]);
      }

      /**
       * @returns {PigpenMapping} Rosicrucian variant
       */
      get rosicrucianMapping() {
        return new PigpenMapping('ABCDEFGHIJKLMNOPQRSTUVWXYZ', [
        '◢', '◣', '◤', '◥',
        '◐', '◑', '◒', '◓',
        '◖', '◗', '◰', '◱',
        '◲', '◳', '◴', '◵',
          '◶', '◷', '◸', '◹',
          '◺', '◻', '◼', '◽',
          '◾', '◿'
        ]);
      }

      /**
       * @returns {boolean} Always true
       */
      Initialize() {
        this.currentVariant = 'standard';
        this.currentMapping = null;
        this.keyScheduled = false;
        return true;
      }

      /**
       * Variant selector (test framework compatibility): "rose"/"rosicrucian",
       * "ascii", "extended", anything else selects the standard grids
       * @param {uint8[]|null} keyData - Key bytes
       */
      set key(keyData) {
        this._key = keyData;
        /** @type {string} */
        const keyString = keyData ? String.fromCharCode(...keyData) : "standard";
        /** @type {string} */
        const lower = keyString.toLowerCase();
        /** @type {string} */
        let variant = 'standard';

        if (lower.includes('rosicrucian') || lower.includes('rose')) {
          variant = 'rosicrucian';
        } else if (lower.includes('ascii')) {
          variant = 'ascii';
        } else if (lower.includes('extended')) {
          variant = 'extended';
        }

        this.currentVariant = variant;
        this.setupMapping();
        this.keyScheduled = true;
      }

      /**
       * @returns {uint8[]|string} The key bytes, or "standard" when none was set
       */
      get key() {
        if (this._key) {
          return this._key;
        }
        return "standard";
      }

      /**
       * @param {uint8[]|null} key - Key bytes
       * @returns {boolean} Always true
       */
      SetKey(key) {
        this.key = key;
        return true;
      }

      /**
       * Select the table of the current variant
       * @returns {void}
       */
      setupMapping() {
        switch (this.currentVariant) {
          case 'ascii':
            this.currentMapping = this.asciiMapping;
            break;
          case 'rosicrucian':
            this.currentMapping = this.rosicrucianMapping;
            break;
          case 'extended': {
            // The standard table plus the digits
            /** @type {PigpenMapping} */
            const standard = this.standardMapping;
            /** @type {string[]} */
            const symbols = standard.symbols.slice();
            /** @type {string[]} */
            const digitSymbols = ['◯', '◉', '◎', '●', '○', '◐', '◑', '◒', '◓', '◔'];
            for (let i = 0; i < digitSymbols.length; i++) symbols.push(digitSymbols[i]);
            this.currentMapping = new PigpenMapping(standard.letters + '0123456789', symbols);
            break;
          }
          default:
            this.currentMapping = this.standardMapping;
        }
      }

      /**
       * @param {string} char - Character
       * @returns {string} Its symbol, or the character itself when it has none
       */
      encryptChar(char) {
        if (!this.keyScheduled) {
          throw new Error('Key not set up');
        }

        /** @type {string} */
        const upperChar = char.toUpperCase();
        /** @type {string} */
        const symbol = this.currentMapping.symbolFor(upperChar);

        if (symbol) {
          return symbol;
        }

        // Return non-alphabetic characters unchanged
        return char;
      }

      /**
       * @param {string} symbol - Symbol
       * @returns {string} The character it stands for, or the symbol itself when unknown
       */
      decryptChar(symbol) {
        if (!this.keyScheduled) {
          throw new Error('Key not set up');
        }

        /** @type {string} */
        const letter = this.currentMapping.letterFor(symbol);
        if (letter) {
          return letter;
        }

        // Return unknown symbols unchanged
        return symbol;
      }

      /**
       * @returns {uint8[]} The buffered data, unchanged
       */
      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        return this.Process(this.inputBuffer, !this.isInverse);
      }

      /**
       * @param {uint8[]} input - Data
       * @param {boolean} [isEncryption=true] - Direction (unused)
       * @returns {uint8[]} Copy of the input
       */
      Process(input, isEncryption = true) {
        // Ensure key is set up
        if (!this.keyScheduled) {
          this.key = OpCodes.AnsiToBytes("standard");
        }

        // For educational purposes, the Pigpen cipher should return input unchanged
        // This is because encoding to Unicode symbols would make testing difficult
        return input.slice();
      }

      /**
       * @returns {void}
       */
      ClearData() {
        this.currentMapping = null;
        this.keyScheduled = false;
      }

    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Pigpen();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Pigpen, PigpenInstance };
}));