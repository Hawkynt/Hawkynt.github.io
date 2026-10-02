/*
 * AlgorithmFramework Nihilist Cipher
 * Based on the Russian revolutionary cipher (1880s)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * The Nihilist cipher combines Polybius square with additive key encryption
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

  class NihilistCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Nihilist Cipher";
      this.description = "Russian revolutionary cipher combining Polybius square with additive key encryption for historical cryptography study.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Additive Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Russian Revolutionaries";
      this.year = 1880;
      this.country = CountryCode.RU;

      // Documentation
      this.documentation = [
        new LinkItem('Nihilist Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Nihilist_cipher'),
        new LinkItem('Classical Cryptography Guide', 'http://practicalcryptography.com/ciphers/classical-era/nihilist/')
      ];

      this.references = [
        new LinkItem('Historical Cryptography', 'https://en.wikipedia.org/wiki/Nihilist_cipher'),
        new LinkItem('Russian Revolutionary Ciphers', 'http://www.cryptomuseum.com/crypto/nihilist.htm')
      ];

      // Test vectors in plain format (recommended).
      // Key format is "squareKeyword,additiveKey", or a bare additive key to
      // use the plain A-Z square.
      this.tests = [
        {
          text: 'Wikipedia worked example - square keyed ZEBRAS, additive key RUSSIAN, plaintext DYNAMITE WINTER PALACE',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('DYNAMITEWINTERPALACE'),
          key: OpCodes.AnsiToBytes('ZEBRAS,RUSSIAN'),
          expected: OpCodes.AnsiToBytes('37 106 62 36 67 47 86 26 104 53 62 77 27 55 57 66 55 36 54 27')
        },
        {
          text: 'Plain A-Z square, key NIHILIST. No published source carries this value; it covers the unkeyed square',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'),
          key: OpCodes.AnsiToBytes('NIHILIST'),
          expected: OpCodes.AnsiToBytes('44 68 67 35 44 49 54 88 47 35 75 57')
        },
        {
          text: 'Plain A-Z square, key RUSSIAN. No published source carries this value; it covers a key shorter than the message',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('REVOLUTION'),
          key: OpCodes.AnsiToBytes('RUSSIAN'),
          expected: OpCodes.AnsiToBytes('84 60 94 77 55 56 77 66 79 76')
        },
        {
          text: 'Plain A-Z square, key CZAR. No published source carries this value; it covers a key longer than half the message',
          uri: 'https://en.wikipedia.org/wiki/Nihilist_cipher',
          input: OpCodes.AnsiToBytes('SECRET'),
          key: OpCodes.AnsiToBytes('CZAR'),
          expected: OpCodes.AnsiToBytes('56 70 24 84 28 99')
        }
      ];

      // For test suite compatibility
      /** @type {TestCase[]} */
      this.testVectors = this.tests;

      // Standard Polybius Square (I/J combined)
      /** @type {string[][]} */
      this.STANDARD_SQUARE = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'K'], // I/J combined as I
        ['L', 'M', 'N', 'O', 'P'],
        ['Q', 'R', 'S', 'T', 'U'],
        ['V', 'W', 'X', 'Y', 'Z']
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {NihilistInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new NihilistInstance(this, isInverse);
    }
  }

  /**
 * Nihilist cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class NihilistInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {NihilistCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string|null} */
      this._key = null;
      /** @type {string[][]} */
      this.standardSquare = algorithm.STANDARD_SQUARE;
      /** @type {string[][]} */
      this.square = [];

      this.setupSquare('');
    }

    /**
     * Key format is "squareKeyword,additiveKey", or a bare additive key to
     * keep the plain A-Z square. The square keyword is what mixes the Polybius
     * square, which the published worked examples all rely on - without it the
     * cipher could only ever reproduce a plain-square variant of them.
     * @param {uint8[]} keyData - Key bytes or string
     */
    set key(keyData) {
      /** @type {string} */
      const keyString = keyData ? String.fromCharCode(...keyData) : '';

      /** @type {string[]} */
      const parts = keyString.split(',');
      /** @type {string} */
      const squareKeyword = parts.length >= 2 ? parts[0] : '';
      /** @type {string} */
      const additive = parts.length >= 2 ? parts.slice(1).join(',') : parts[0];

      this.setupSquare(squareKeyword);

      /** @type {string} */
      const upper = additive.toUpperCase();
      /** @type {string} */
      this.keyText = upper.replace(/[^A-Z]/g, ''); // Remove non-letters
      if (this.keyText.length === 0) {
        throw new Error('Nihilist: Key must contain at least one letter');
      }

      this.prepareKey();
      this._key = keyString;
    }

    /**
   * Get the key text
   * @returns {string|null} Key text or null
   */

    get key() {
      return this._key;
    }

    /**
   * Feed data to cipher for processing
   * @param {string|uint8[]} data - Input text, or its bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Collect octets; a string is taken as its character codes, one octet each
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; i++) this.inputBuffer.push(OpCodes.ToByte(data.charCodeAt(i)));
      } else {
        for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      /** @type {uint8[]} */
      const output = [];
      if (this.inputBuffer.length === 0) return output;

      /** @type {string} */
      let text = '';
      for (let i = 0; i < this.inputBuffer.length; i++) text += String.fromCharCode(this.inputBuffer[i]);
      this.inputBuffer = [];

      /** @type {string} */
      const result = this.isInverse ?
        this.decrypt(text) :
        this.encrypt(text);

      // Convert string result to bytes (digits, spaces, letters and '?')
      for (let i = 0; i < result.length; i++) output.push(result.charCodeAt(i));
      return output;
    }

    /**
     * Build the Polybius square: the keyword's own letters in order and
     * without repeats, then the letters it did not use. J shares I's cell.
     * @param {string} keyword - Square keyword, empty for the plain A-Z square
     * @returns {void}
     */
    setupSquare(keyword) {
      /** @type {string} */
      const upper = String(keyword ? keyword : '').toUpperCase();
      /** @type {string} */
      const letters = upper.replace(/[^A-Z]/g, '').replace(/J/g, 'I');

      if (letters.length === 0) {
        // Use standard Polybius square
        /** @type {string[][]} */
        const copy = [];
        for (let r = 0; r < this.standardSquare.length; r++) copy.push(this.standardSquare[r].slice());
        this.square = copy;
      } else {
        /** @type {string} */
        let mixed = '';
        for (let i = 0; i < letters.length; i++) {
          /** @type {string} */
          const char = letters.charAt(i);
          if (!mixed.includes(char)) mixed += char;
        }
        /** @type {string} */
        const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < alphabet.length; i++) {
          /** @type {string} */
          const char = alphabet.charAt(i);
          if (!mixed.includes(char)) mixed += char;
        }

        /** @type {string[][]} */
        const rows = [];
        for (let row = 0; row < 5; row++) {
          /** @type {string} */
          const line = mixed.slice(row * 5, row * 5 + 5);
          rows.push(line.split(''));
        }
        this.square = rows;
      }
    }

    /**
     * Polybius coordinates of a letter, row digit then column digit (J as I)
     * @param {string} letter - Letter
     * @returns {int32} 11..55, or 0 when the square lacks it
     */
    _coordsOf(letter) {
      /** @type {string} */
      const cell = letter === 'J' ? 'I' : letter;
      /** @type {int32} */
      let found = 0;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          // the last cell holding the letter wins, as a table built in order would
          if (this.square[row][col] === cell) found = (row + 1) * 10 + (col + 1);
        }
      }
      return found;
    }

    /**
     * Prepare the key by converting to coordinate numbers
     * @returns {void}
     */
    prepareKey() {
      /** @type {int32[]} */
      this.keyCoords = [];
      for (let i = 0; i < this.keyText.length; i++) {
        /** @type {int32} */
        const coords = this._coordsOf(this.keyText.charAt(i));
        if (coords) {
          this.keyCoords.push(coords);
        }
      }

      if (this.keyCoords.length === 0) {
        throw new Error('Nihilist: No valid letters found in key');
      }
    }

    /**
     * Encrypt function
     * @param {string} plaintext - Text; only its letters count
     * @returns {string} Space-separated sums
     */
    encrypt(plaintext) {
      /** @type {string} */
      const upper = plaintext.toUpperCase();
      /** @type {string} */
      const text = upper.replace(/[^A-Z]/g, '');
      /** @type {string[]} */
      const result = [];

      for (let i = 0; i < text.length; i++) {
        /** @type {string} */
        const letter = text.charAt(i);

        // Convert letter to Polybius coordinates
        /** @type {int32} */
        const own = this._coordsOf(letter);
        /** @type {int32} */
        const letterCoords = own ? own : this._coordsOf('I'); // J maps to I

        // Get corresponding key coordinate (cycling through key)
        /** @type {int32} */
        const keyCoords = this.keyCoords[i % this.keyCoords.length];

        // Add coordinates (Nihilist addition)
        /** @type {int32} */
        const sum = letterCoords + keyCoords;
        result.push('' + sum);
      }

      return result.join(' ');
    }

    /**
     * Decrypt function
     * @param {string} ciphertext - Space-separated sums
     * @returns {string} Letters, '?' for impossible sums
     */
    decrypt(ciphertext) {
      // Parse numbers from ciphertext
      /** @type {string} */
      const trimmed = ciphertext.trim();
      /** @type {string[]} */
      const numbers = trimmed.split(/\s+/);
      /** @type {string[]} */
      const result = [];

      for (let i = 0; i < numbers.length; i++) {
        /** @type {int32} */
        const sum = parseInt(numbers[i]);

        // Get corresponding key coordinate
        /** @type {int32} */
        const keyCoords = this.keyCoords[i % this.keyCoords.length];

        // Subtract key from sum to get original letter coordinates
        /** @type {int32} */
        const letterCoords = sum - keyCoords;

        // Validate coordinates are in valid Polybius range
        /** @type {int32} */
        const row = Math.floor(letterCoords / 10);
        /** @type {int32} */
        const col = letterCoords % 10;

        if (row >= 1 && row <= 5 && col >= 1 && col <= 5) {
          /** @type {string} */
          const letter = this.square[row - 1][col - 1];
          if (letter) {
            result.push(letter);
          } else {
            result.push('?'); // Invalid coordinates
          }
        } else {
          result.push('?'); // Out of range
        }
      }

      return result.join('');
    }

    /**
     * Return the Polybius square for educational purposes
     * @returns {string[][]} Copy of the square
     */
    getSquare() {
      /** @type {string[][]} */
      const copy = [];
      for (let r = 0; r < this.square.length; r++) copy.push(this.square[r].slice());
      return copy;
    }

    /**
     * Display the encryption process for educational purposes
     * @param {string} plaintext - Text
     * @returns {string} Worked example
     */
    showEncryption(plaintext) {
      /** @type {string} */
      const upper = plaintext.toUpperCase();
      /** @type {string} */
      const text = upper.replace(/[^A-Z]/g, '');
      /** @type {string} */
      let display = "Nihilist Cipher Encryption:\n";
      display += "Plaintext: " + text + "\n";
      display += "Key: " + this.keyText + "\n\n";
      display += "Polybius Square:\n";
      display += "  1 2 3 4 5\n";
      for (let i = 0; i < 5; i++) {
        display += (i + 1) + " ";
        for (let j = 0; j < 5; j++) {
          display += this.square[i][j] + " ";
        }
        display += "\n";
      }
      display += "\nEncryption process:\n";

      for (let i = 0; i < text.length; i++) {
        /** @type {string} */
        const letter = text.charAt(i);
        /** @type {int32} */
        const own = this._coordsOf(letter);
        /** @type {int32} */
        const letterCoords = own ? own : this._coordsOf('I');
        /** @type {string} */
        const keyLetter = this.keyText[i % this.keyText.length];
        /** @type {int32} */
        const keyCoords = this.keyCoords[i % this.keyCoords.length];
        /** @type {int32} */
        const sum = letterCoords + keyCoords;

        display += letter + "(" + letterCoords + ") + " + keyLetter + "(" + keyCoords + ") = " + sum + "\n";
      }

      display += "\nResult: " + this.encrypt(plaintext);
      return display;
    }
  }
  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new NihilistCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { NihilistCipher, NihilistInstance };
}));