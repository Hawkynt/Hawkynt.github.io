/*
 * AlgorithmFramework Scytale Cipher
 * Compatible with both Browser and Node.js environments
 * Ancient Spartan transposition cipher using a staff
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class ScytaleCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Scytale Cipher";
      this.description = "Ancient Spartan transposition cipher using a staff for military communications in classical antiquity. A scytale reorders the marks on a strip of parchment and never looks at what they are, so this implementation accepts every byte: the message is written across a grid of 'circumference' columns and read off column by column, and the inverse puts it back. No byte is dropped, altered, case-folded or padded, and the round trip is exact for arbitrary input of any length.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Transposition Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.inventor = "Ancient Spartans";
      this.year = -500; // 5th century BC
      this.country = CountryCode.ANCIENT;

      // Documentation
      this.documentation = [
        new LinkItem('Scytale Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Scytale'),
        new LinkItem('Ancient Cryptography', 'http://practicalcryptography.com/ciphers/classical-era/scytale/')
      ];

      this.references = [
        new LinkItem('CrypTool 2 Scytale Plugin (open-source reference implementation)', 'https://github.com/CrypToolProject/CrypTool-2')
      ];

      // Test vectors in plain format (recommended)
      this.tests = [
        {
          text: 'Basic Scytale example with circumference 3',
          uri: 'https://en.wikipedia.org/wiki/Scytale',
          input: OpCodes.AnsiToBytes('WEAREFOUNDOUT'), 
          key: OpCodes.AnsiToBytes('3'),
          expected: OpCodes.AnsiToBytes('WRODTEEUOAFNU')
        },
        {
          text: 'Military message with circumference 4',
          uri: 'https://en.wikipedia.org/wiki/Scytale',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'),
          key: OpCodes.AnsiToBytes('4'),
          expected: OpCodes.AnsiToBytes('ACDTKATAWATN')
        }
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
      return new ScytaleInstance(this, isInverse);
    }
  }

  /**
 * Scytale cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ScytaleInstance extends IAlgorithmInstance {
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
      this.circumference = 3; // Default circumference
    }

    set key(keyData) {
      let keyString = '';
      if (typeof keyData === 'string') {
        keyString = keyData;
      } else if (Array.isArray(keyData)) {
        keyString = String.fromCharCode(...keyData);
      }

      const circumference = parseInt(keyString) || 3;
      this.circumference = Math.max(1, circumference);
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

      // The strip is wound round the staff as it is, so the bytes are buffered
      // as bytes. Converting the message to a string here was what let the
      // A-Z filter downstream throw most of it away.
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
      this.inputBuffer = [];

      return this.isInverse ? this.unwind(message) : this.wind(message);
    }

    /**
     * Wind the message round the staff: write it across the rows of a grid
     * 'circumference' columns wide, then read it off column by column. The
     * last row may be short and is simply left short - no padding is added,
     * so the ciphertext is exactly as long as the plaintext.
     * @param {uint8[]} plaintext - Message bytes
     * @returns {uint8[]} Transposed bytes
     */
    wind(plaintext) {
      const columns = this.circumference;
      const rows = Math.ceil(plaintext.length / columns);
      const result = new Array(plaintext.length);

      let position = 0;
      for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows; r++) {
          const index = r * columns + c;
          if (index < plaintext.length) result[position++] = plaintext[index];
        }
      }

      return result;
    }

    /**
     * Unwind the message from the staff. Column c holds one byte per full row
     * plus one more when c is among the first (length mod circumference)
     * columns, which is exactly the shape wind() produced.
     * @param {uint8[]} ciphertext - Transposed bytes
     * @returns {uint8[]} Original bytes
     */
    unwind(ciphertext) {
      const columns = this.circumference;
      const fullRows = Math.floor(ciphertext.length / columns);
      const remainder = ciphertext.length % columns;
      const result = new Array(ciphertext.length);

      let position = 0;
      for (let c = 0; c < columns; c++) {
        const height = fullRows + (c < remainder ? 1 : 0);
        for (let r = 0; r < height; r++) result[r * columns + c] = ciphertext[position++];
      }

      return result;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ScytaleCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ScytaleCipher, ScytaleInstance };
}));