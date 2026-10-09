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

  /** @type {int32} */
  const UPPER_A = 65;
  /** @type {int32} */
  const UPPER_Z = 90;

  // The two jokers, which carry no letter and count 53 apiece
  /** @type {int32} */
  const JOKER_A = 53;
  /** @type {int32} */
  const JOKER_B = 54;

  /**
   * Printable stand-in for a byte, for use in an error message.
   * @param {uint8} byte - Offending byte
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
      /** @type {uint8} */
      const byte = message[i];
      if (byte < UPPER_A || byte > UPPER_Z) {
        /** @type {string} */
        let hex = byte.toString(16);
        while (hex.length < 2) hex = '0' + hex;
        throw new Error("SolitaireInstance.Result: byte 0x" + hex
          + " ('" + DescribeByte(byte) + "') at position " + i + " is outside the A-Z alphabet the deck encodes");
      }
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

      // Bruce Schneier's own published sample output, verbatim from the
      // "Solitaire" page: an unkeyed deck, a deck keyed with FOO, and a deck
      // keyed with CRYPTONOMICON. Schneier pads the message out to a multiple
      // of five with X before enciphering, which is why the nine letters of
      // SOLITAIRE are given here as ten.
      this.tests = [
        {
          text: "Schneier sample 1 - unkeyed deck in bridge order, ten A's",
          uri: 'https://www.schneier.com/academic/solitaire/',
          input: OpCodes.AnsiToBytes('AAAAAAAAAA'),
          expected: OpCodes.AnsiToBytes('EXKYIZSGEH')
        },
        {
          text: 'Schneier sample 2 - deck keyed with the passphrase FOO, fifteen A\'s',
          uri: 'https://www.schneier.com/academic/solitaire/',
          input: OpCodes.AnsiToBytes('AAAAAAAAAAAAAAA'),
          key: OpCodes.AnsiToBytes('FOO'),
          expected: OpCodes.AnsiToBytes('ITHZUJIWGRFARMW')
        },
        {
          text: 'Schneier sample 3 - deck keyed with CRYPTONOMICON, message SOLITAIRE padded to SOLITAIREX',
          uri: 'https://www.schneier.com/academic/solitaire/',
          input: OpCodes.AnsiToBytes('SOLITAIREX'),
          key: OpCodes.AnsiToBytes('CRYPTONOMICON'),
          expected: OpCodes.AnsiToBytes('KIRAKSFJAN')
        }
      ];

      // For test suite compatibility
      /** @type {TestCase[]} */
      this.testVectors = this.tests;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {SolitaireInstance} New cipher instance
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
   * @param {SolitaireCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {uint8[]|null} */
      this._keyBytes = null;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string|null} */
      this._key = null;
      /** @type {uint32[]} */
      this.deck = [];
      this.initializeDeck();
    }

    /**
     * Passphrase, given as a string or as its ASCII bytes
     * @param {uint8[]} keyData - Passphrase; empty keeps the unkeyed deck
     */
    set key(keyData) {
      this._keyBytes = keyData ? keyData.slice() : null;
      /** @type {string} */
      const keyString = keyData ? String.fromCharCode(...keyData) : '';

      if (keyString && keyString.length > 0) {
        this.setupWithKey(keyString);
      }
      this._key = keyString;
    }

    /**
     * Get a copy of the key bytes last set
     * @returns {uint8[]|null} Copy of the key bytes, or null when none were set
     */

    get key() {
      return this._keyBytes ? this._keyBytes.slice() : null;
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint8[]} */
      const message = this.inputBuffer;

      // Anything the deck cannot carry is refused by name and position, and
      // the whole message is checked before the first cut so a refusal does
      // not leave the deck part-way through it. The previous filter dropped
      // such bytes instead, so a five-byte binary message encrypted to nothing
      // and decrypted back to nothing with no error raised.
      RequireLetters(message);

      this.inputBuffer = [];

      // One keystream letter per message letter
      /** @type {uint8[]} */
      const output = new Array(message.length);
      for (let i = 0; i < message.length; i++) {
        /** @type {int32} */
        const byte = message[i];
        /** @type {int32} */
        const keyValue = this.nextKeystreamValue();
        /** @type {int32} */
        const letter = byte - UPPER_A;

        // Encryption adds the card value, decryption takes it away again
        /** @type {int32} */
        const result = this.isInverse
          ? (letter - keyValue + 26) % 26
          : (letter + keyValue) % 26;

        output[i] = UPPER_A + result;
      }

      return output;
    }

    /**
     * @returns {void}
     */
    initializeDeck() {
      // Standard 54-card deck (52 cards + 2 jokers)
      /** @type {uint32[]} */
      const fresh = [];
      this.deck = fresh;
      for (let i = 1; i <= 54; i++) {
        this.deck.push(i);
      }
      // 53 = Joker A, 54 = Joker B
    }

    /**
     * Move a joker down the deck, treating it as circular over the 53 cards
     * below the top: a joker at the very bottom comes back as the second card.
     * @param {uint32} joker - JOKER_A (53) or JOKER_B (54)
     * @param {int32} places - How many places to move it down
     * @returns {void}
     */
    moveJokerDown(joker, places) {
      for (let step = 0; step < places; step++) {
        /** @type {int32} */
        const at = this.deck.indexOf(joker);
        if (at === this.deck.length - 1) {
          this.deck.splice(at, 1);
          this.deck.splice(1, 0, joker);
        } else {
          this.deck[at] = this.deck[at + 1];
          this.deck[at + 1] = joker;
        }
      }
    }

    /**
     * Triple cut: swap everything above the topmost joker with everything
     * below the bottommost joker, leaving the jokers and the cards between
     * them where they are.
     * @returns {void}
     */
    tripleCut() {
      /** @type {int32} */
      const first = Math.min(this.deck.indexOf(JOKER_A), this.deck.indexOf(JOKER_B));
      /** @type {int32} */
      const last = Math.max(this.deck.indexOf(JOKER_A), this.deck.indexOf(JOKER_B));

      /** @type {uint32[]} */
      const rebuilt = [];
      for (let i = last + 1; i < this.deck.length; i++) rebuilt.push(this.deck[i]);
      for (let i = first; i <= last; i++) rebuilt.push(this.deck[i]);
      for (let i = 0; i < first; i++) rebuilt.push(this.deck[i]);

      this.deck = rebuilt;
    }

    /**
     * Count cut: take the number of cards given by 'count' off the top and
     * put them just above the bottom card, which never moves.
     * @param {int32} count - Cards to move, 0 to 53
     * @returns {void}
     */
    countCut(count) {
      if (count <= 0 || count >= this.deck.length) return;

      /** @type {uint32} */
      const bottom = this.deck[this.deck.length - 1];
      /** @type {uint32[]} */
      const rebuilt = [];
      for (let i = count; i < this.deck.length - 1; i++) rebuilt.push(this.deck[i]);
      for (let i = 0; i < count; i++) rebuilt.push(this.deck[i]);
      rebuilt.push(bottom);

      this.deck = rebuilt;
    }

    /**
     * The value a card counts for: either joker counts 53, and any other card
     * counts its own face number.
     * @param {uint32} card - Card 1 to 54
     * @returns {uint32} Counting value
     */
    cardValue(card) {
      return card >= JOKER_A ? JOKER_A : card;
    }

    /**
     * Steps 1 to 4 of the published algorithm: both joker moves, the triple
     * cut and the count cut driven by the bottom card.
     * @returns {void}
     */
    advanceDeck() {
      this.moveJokerDown(JOKER_A, 1);
      this.moveJokerDown(JOKER_B, 2);
      this.tripleCut();
      this.countCut(this.cardValue(this.deck[this.deck.length - 1]));
    }

    /**
     * One keystream letter, as a 1-26 offset. Steps the deck and reads step 5:
     * count down from the top by the top card's value and take the card found
     * there. A joker there yields no letter, so the deck is stepped again -
     * this is what keeps the keystream and the message the same length.
     *
     * The whole 5-step procedure was previously a single swap of one joker
     * with its neighbour and a read of the top card, which produced a
     * keystream unrelated to Solitaire: an unkeyed deck enciphered AAAAA to
     * BBBBB rather than Schneier's published EXKYI.
     * @returns {int32} Keystream offset 1 to 26
     */
    nextKeystreamValue() {
      for (;;) {
        this.advanceDeck();
        /** @type {uint32} */
        const output = this.deck[this.cardValue(this.deck[0])];

        // Clubs 1-13, diamonds 14-26, hearts 27-39 and spades 40-52 fold onto
        // the 26 letters in that order, so card 27 and card 1 both count A.
        if (output < JOKER_A) {
          /** @type {int32} */
          const card = output;
          return ((card - 1) % 26) + 1;
        }
      }
    }

    /**
     * Key the deck with a passphrase, which is Schneier's third keying method:
     * run steps 1 to 4 once per key letter, then follow each with a further
     * count cut by that letter's position in the alphabet.
     * @param {string} key - Passphrase, letters only are used
     * @returns {void}
     */
    setupWithKey(key) {
      this.initializeDeck();

      /** @type {string} */
      const upper = key.toUpperCase();
      /** @type {string} */
      const letters = upper.replace(/[^A-Z]/g, '');
      for (let i = 0; i < letters.length; i++) {
        this.advanceDeck();
        this.countCut(letters.charCodeAt(i) - UPPER_A + 1);
      }
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