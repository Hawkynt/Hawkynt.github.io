/*
 * AlgorithmFramework Solitaire Cipher (Pontifex)
 * Compatible with both Browser and Node.js environments
 * Bruce Schneier's card-based stream cipher from Cryptonomicon (1999)
 * (c)2025 Hawkynt - Educational Implementation
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

  const UPPER_A = 65, UPPER_Z = 90;

  /**
   * Printable stand-in for a byte, for use in an error message.
   * @param {number} byte - Offending byte
   * @returns {string} The character itself when it is printable ASCII, else '?'
   */
  function DescribeByte(byte) {
    return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '?';
  }

  /**
   * Reject the first byte the deck cannot encode, naming it and its place.
   * @param {uint8[]} message - Bytes about to be enciphered
   * @throws {Error} On the first byte outside A-Z
   */
  function RequireLetters(message) {
    for (let i = 0; i < message.length; i++) {
      const byte = message[i];
      if (byte < UPPER_A || byte > UPPER_Z)
        throw new Error(`SolitaireInstance.Result: byte 0x${byte.toString(16).padStart(2, '0')}`
          + ` ('${DescribeByte(byte)}') at position ${i} is outside the A-Z alphabet the deck encodes`);
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class SolitaireCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Solitaire Cipher";
      this.description = "Bruce Schneier's card-based stream cipher designed for manual use without computer assistance from Neal Stephenson's Cryptonomicon. Input domain: uppercase A-Z only. The deck yields a keystream value of 1 to 26 which is added to a letter of the alphabet modulo 26; the pencil-and-paper procedure has the operator strip punctuation and case from the message before starting, and there is no card value that could carry a digit, a space or a high-bit byte. Anything outside A-Z is therefore refused by name and position rather than dropped, and A-Z round-trips exactly.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.inventor = "Bruce Schneier";
      this.year = 1999;
      this.country = CountryCode.US;

      // The keystream is a card value of 1 to 26 added to a letter modulo 26.
      // Nothing outside A-Z has a place in that arithmetic, so it is rejected
      // instead. Declared here so the round-trip suite scores that rejection
      // as a domain limit, not a defect.
      this.restrictedInputDomain = true;

      // Documentation
      this.documentation = [
        new LinkItem('Solitaire Cipher Specification', 'https://www.schneier.com/academic/solitaire/'),
        new LinkItem('Cryptonomicon Reference', 'https://en.wikipedia.org/wiki/Solitaire_(cipher)')
      ];

      // Reference implementations
      this.references = [
        new LinkItem("Schneier's Solitaire (Pontifex) Algorithm Description", 'https://www.schneier.com/academic/solitaire/'),
        new LinkItem('kisom/solitaire - Pontifex Reference Implementation (C, GitHub)', 'https://github.com/kisom/solitaire/blob/master/src/pontifex.c')
      ];

      // Convert test vectors to new format (strings to byte arrays)
      // These vectors do NOT match Bruce Schneier's official worked examples (e.g. an
      // unkeyed deck encrypting "AAAAAAAAAA" to "EXKYIZSGEH" per schneier.com/academic/solitaire/)
      // because this file implements a simplified educational keystream (not the real
      // 5-step card algorithm). They are self-computed against this implementation for
      // self-consistency/round-trip verification only.
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes('HELLO'),
          OpCodes.AnsiToBytes('IFMMP'),
          'Self-computed vector using this simplified educational implementation (does not match Schneier\'s official Solitaire test vectors)',
          'https://www.schneier.com/academic/solitaire/'
        ),
        new TestCase(
          OpCodes.AnsiToBytes('WORLD'),
          OpCodes.AnsiToBytes('XPSME'),
          'Self-computed vector using this simplified educational implementation (does not match Schneier\'s official Solitaire test vectors)',
          'https://www.schneier.com/academic/solitaire/'
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SolitaireInstance(this, isInverse);
    }
  }

  /**
 * Solitaire cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SolitaireInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.initializeDeck();
    }

    set key(keyData) {
      let keyString = '';
      if (typeof keyData === 'string') {
        keyString = keyData;
      } else if (Array.isArray(keyData)) {
        keyString = String.fromCharCode(...keyData);
      }

      if (keyString && keyString.length > 0) {
        this.setupWithKey(keyString);
      }
      this._key = keyString;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Buffered as bytes: converting to a string here was what let the A-Z
      // filter downstream throw most of the message away.
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) return [];

      const message = this.inputBuffer;

      // Anything the deck cannot carry is refused by name and position, and
      // the whole message is checked before the first cut so a refusal does
      // not leave the deck part-way through it. The previous filter dropped
      // such bytes instead, so a five-byte binary message encrypted to nothing
      // and decrypted back to nothing with no error raised.
      RequireLetters(message);

      this.inputBuffer = [];

      // One card value per letter
      const output = new Array(message.length);
      for (let i = 0; i < message.length; i++) {
        const byte = message[i];
        const keyValue = this.stepDeck();
        const letter = byte - UPPER_A;

        // Encryption adds the card value, decryption takes it away again
        const result = this.isInverse
          ? (letter - keyValue + 1 + 26) % 26
          : (letter + keyValue - 1) % 26;

        output[i] = UPPER_A + result;
      }

      return output;
    }

    initializeDeck() {
      // Standard 54-card deck (52 cards + 2 jokers)
      this.deck = [];
      for (let i = 1; i <= 54; i++) {
        this.deck.push(i);
      }
      // 53 = Joker A, 54 = Joker B
    }

    setupWithKey(key) {
      // For educational implementation - simplified key setup
      this.initializeDeck();

      // In real Solitaire, key would be used to shuffle deck
      // This is a simplified version for demonstration
      const keySum = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      for (let i = 0; i < keySum % 10; i++) {
        this.stepDeck();
      }
    }

    stepDeck() {
      // Simplified Solitaire step for educational purposes
      // Real Solitaire has 5 steps with specific joker movements

      // Move first joker down one position
      let aPos = this.deck.indexOf(53);
      if (aPos === 53) aPos = 0;
      else {
        [this.deck[aPos], this.deck[aPos + 1]] = [this.deck[aPos + 1], this.deck[aPos]];
      }

      // Simplified for demonstration
      return this.deck[0] % 26 + 1;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new SolitaireCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SolitaireCipher, SolitaireInstance };
}));