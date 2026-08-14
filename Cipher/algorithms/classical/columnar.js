/*
 * Columnar Transposition Cipher Implementation
 * Classical transposition cipher using keyword-ordered columns
 * Educational Implementation - For learning purposes only
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

  // The letter the final row of the grid is filled out with, and the letter
  // stripped from the end again on the way back.
  const PAD_LETTER = 88; // 'X'

  /**
   * Printable stand-in for a byte, for use in an error message.
   * @param {number} byte - Offending byte
   * @returns {string} The character itself when it is printable ASCII, else '?'
   */
  function DescribeByte(byte) {
    return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '?';
  }

  /**
   * Reject the first byte the cipher has no cell for, naming it and its place.
   * @param {uint8[]} message - Bytes about to be transposed
   * @throws {Error} On the first byte outside A-Z
   */
  function RequireLetters(message) {
    for (let i = 0; i < message.length; i++) {
      const byte = message[i];
      if (byte < UPPER_A || byte > UPPER_Z)
        throw new Error(`ColumnarInstance.Result: byte 0x${byte.toString(16).padStart(2, '0')}`
          + ` ('${DescribeByte(byte)}') at position ${i} is outside the A-Z alphabet the grid holds`);
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ColumnarCipher extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = 'Columnar Transposition';
        this.description = 'Classical transposition cipher that arranges plaintext in a grid and reads columns in keyword-alphabetical order. Input domain: uppercase A-Z only. This is the complete form of the cipher, in which the final row of the grid is filled out with the letter X before the columns are read, so the alphabet has to be the one the padding letter belongs to and anything else is refused by name and position rather than dropped. Decryption removes trailing X again, which means a message that genuinely ends in X comes back short - the same ambiguity as zero padding, and the one thing here that is not an exact round trip.';
        this.category = CategoryType.CLASSICAL;
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = 'Unknown (Classical)';
        this.year = 1500;
        this.country = CountryCode.INTERNATIONAL;

        this.keySize = { min: 1, max: 50, step: 1 };
        this.blockSize = { variable: true };

        // The grid is padded out with the letter X, so the message has to be
        // drawn from the alphabet X belongs to. Declared here so the
        // round-trip suite scores a rejection of anything else as a domain
        // limit, not a defect.
        this.restrictedInputDomain = true;

        this.documentation = [
          new LinkItem('Wikipedia: Transposition Cipher', 'https://en.wikipedia.org/wiki/Transposition_cipher'),
          new LinkItem('Educational Tool', 'https://www.dcode.fr/columnar-transposition-cipher'),
          new LinkItem('Crypto Corner: Columnar Transposition Cipher', 'https://crypto.interactive-maths.com/columnar-transposition-cipher.html')
        ];

        this.references = [
          new LinkItem('pycipher columnartransposition.py (Python reference implementation)', 'https://github.com/jameslyons/pycipher/blob/master/pycipher/columnartransposition.py'),
          new LinkItem('Practical Cryptography: Columnar Transposition Cipher', 'http://practicalcryptography.com/ciphers/columnar-transposition-cipher/')
        ];

        // Test vectors using byte arrays
        this.tests = [
          {
            text: "Basic Test",
            uri: "https://en.wikipedia.org/wiki/Transposition_cipher",
            input: global.OpCodes.AnsiToBytes("HELLO"),
            key: global.OpCodes.AnsiToBytes("KEY"),
            expected: global.OpCodes.AnsiToBytes("EOHLLX")
          },
          {
            text: "Longer Text",
            uri: "https://www.dcode.fr/columnar-transposition-cipher",
            input: global.OpCodes.AnsiToBytes("ATTACKATDAWN"),
            key: global.OpCodes.AnsiToBytes("SECRET"),
            expected: global.OpCodes.AnsiToBytes("TTXTANADXAKWCAX")
          },
          {
            text: "Edge Case", 
            uri: "https://en.wikipedia.org/wiki/Transposition_cipher",
            input: global.OpCodes.AnsiToBytes("A"),
            key: global.OpCodes.AnsiToBytes("Z"),
            expected: global.OpCodes.AnsiToBytes("A")
          }
        ];

        // For the test suite compatibility 
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse) {
        return new ColumnarInstance(this, isInverse);
      }
    }

    class ColumnarInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse) {
        super(algorithm);
        this.isInverse = isInverse || false;
        this._key = '';
        this._cleanKey = '';
        this._columnOrder = [];
      }

      set key(keyData) {
        if (typeof keyData === 'string') {
          this._key = keyData;
          this.setupKey(keyData);
        } else if (Array.isArray(keyData)) {
          // Convert byte array to string
          const keyString = String.fromCharCode(...keyData);
          this._key = keyString;
          this.setupKey(keyString);
        } else if (keyData && keyData.key) {
          this.key = keyData.key;
        }
      }

      get key() {
        return this._key;
      }

      setupKey(keyString) {
        // Clean keyword: remove non-letters, convert to uppercase, remove duplicates
        let cleanKeyword = '';
        const used = {};
        for (let i = 0; i < keyString.length; i++) {
          const char = keyString.charAt(i).toUpperCase();
          if (char >= 'A' && char <= 'Z' && !used[char]) {
            cleanKeyword += char;
            used[char] = true;
          }
        }

        if (cleanKeyword.length === 0) {
          cleanKeyword = 'KEYWORD'; // Default keyword
        }

        this._cleanKey = cleanKeyword;
        this._columnOrder = this.generateColumnOrder(cleanKeyword);
      }

      generateColumnOrder(keyword) {
        const columns = [];

        // Create array of {letter, position} objects
        for (let i = 0; i < keyword.length; i++) {
          columns.push({
            letter: keyword.charAt(i),
            originalPos: i,
            sortedPos: 0
          });
        }

        // Sort by letter, then by original position for duplicates
        columns.sort((a, b) => {
          if (a.letter === b.letter) {
            return a.originalPos - b.originalPos;
          }
          return a.letter.localeCompare(b.letter);
        });

        // Assign sorted positions
        for (let i = 0; i < columns.length; i++) {
          columns[i].sortedPos = i;
        }

        // Create ordering array
        const order = new Array(keyword.length);
        for (let i = 0; i < columns.length; i++) {
          order[columns[i].originalPos] = columns[i].sortedPos;
        }

        return order;
      }

      /**
       * Find the grid column whose keyword letter sorts into a given place.
       * @param {number} sortedPosition - Place in keyword-alphabetical order
       * @returns {number} Index of that column in the grid
       */
      columnAt(sortedPosition) {
        for (let col = 0; col < this._columnOrder.length; col++)
          if (this._columnOrder[col] === sortedPosition) return col;
        return -1;
      }

      /**
       * Write the message across the grid and read the columns off in
       * keyword-alphabetical order. The last row is filled out with X first,
       * so the ciphertext is a whole number of rows.
       * @param {uint8[]} plaintext - Message bytes, all A-Z
       * @returns {uint8[]} Transposed bytes
       */
      EncryptBlock(blockIndex, plaintext) {
        // With no keyword there are no columns to read, so the message stands
        if (!this._cleanKey || this._cleanKey.length === 0) return plaintext;

        const columns = this._cleanKey.length;
        const rows = Math.ceil(plaintext.length / columns);
        const result = new Array(rows * columns);

        let position = 0;
        for (let sortedPosition = 0; sortedPosition < columns; sortedPosition++) {
          const originalCol = this.columnAt(sortedPosition);
          for (let row = 0; row < rows; row++) {
            const index = row * columns + originalCol;
            result[position++] = index < plaintext.length ? plaintext[index] : PAD_LETTER;
          }
        }

        return result;
      }

      /**
       * Refill the grid column by column and read it back row by row, then
       * drop the trailing X the padding put there. A message that genuinely
       * ended in X is indistinguishable from padding and comes back short -
       * the same ambiguity as zero padding, and it is stated in the
       * description rather than hidden.
       * @param {uint8[]} ciphertext - Transposed bytes, all A-Z
       * @returns {uint8[]} Original bytes, less any trailing X
       */
      DecryptBlock(blockIndex, ciphertext) {
        // With no keyword there are no columns to refill, so the message stands
        if (!this._cleanKey || this._cleanKey.length === 0) return ciphertext;

        const columns = this._cleanKey.length;
        const rows = Math.ceil(ciphertext.length / columns);
        const baseHeight = Math.floor(ciphertext.length / columns);
        const remainder = ciphertext.length % columns;

        // -1 marks a cell of a ragged final row, which only a ciphertext this
        // cipher did not produce can have; those cells are skipped on the way
        // out rather than emitted as a byte.
        const grid = new Array(rows * columns).fill(-1);

        let position = 0;
        for (let sortedPosition = 0; sortedPosition < columns; sortedPosition++) {
          const originalCol = this.columnAt(sortedPosition);
          const height = baseHeight + (sortedPosition < remainder ? 1 : 0);
          for (let row = 0; row < height && position < ciphertext.length; row++)
            grid[row * columns + originalCol] = ciphertext[position++];
        }

        const result = [];
        for (let i = 0; i < grid.length; i++)
          if (grid[i] >= 0) result.push(grid[i]);

        while (result.length > 0 && result[result.length - 1] === PAD_LETTER) result.pop();

        return result;
      }

      // Modern AlgorithmFramework interface - Feed/Result pattern
      Feed(data) {
        if (!data || data.length === 0) return;

        // Store input data as buffer
        if (!this.inputBuffer) {
          this.inputBuffer = [];
        }
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          return [];
        }

        const message = this.inputBuffer;
        this.inputBuffer = [];

        // The grid is padded with X, so the message has to be letters. It used
        // to be filtered down to A-Z instead, which meant a five-byte binary
        // message encrypted to nothing and decrypted back to nothing with no
        // error raised.
        RequireLetters(message);

        return this.isInverse
          ? this.DecryptBlock(0, message)
          : this.EncryptBlock(0, message);
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new ColumnarCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ColumnarCipher, ColumnarInstance };
}));