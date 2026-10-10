/*
 * AlgorithmFramework Trifid Cipher
 * Compatible with both Browser and Node.js environments
 * Félix Delastelle's three-dimensional fractionating cipher (1901)
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

  class TrifidCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Trifid Cipher";
      this.description = "Félix Delastelle's three-dimensional fractionating cipher extending the Bifid concept to three dimensions for enhanced security.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Fractionating Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.inventor = "Félix Marie Delastelle";
      this.year = 1901;
      this.country = CountryCode.FR;

      // Documentation
      this.documentation = [
        new LinkItem('Trifid Cipher Wikipedia', 'https://en.wikipedia.org/wiki/Trifid_cipher'),
        new LinkItem('Delastelle Ciphers', 'http://practicalcryptography.com/ciphers/classical-era/trifid/')
      ];

      this.references = [
        new LinkItem('CrypTool 2 Trifid Cipher Plugin (open-source reference implementation)', 'https://github.com/CrypToolProject/CrypTool-2')
      ];

      // Test vectors in plain format (recommended)
      this.tests = [
        {
          text: "Delastelle's own example as reproduced on Wikipedia - key alphabet from FELIX MARIE DELASTELLE, group size 5",
          uri: 'https://en.wikipedia.org/wiki/Trifid_cipher',
          input: OpCodes.AnsiToBytes('AIDETOILECIELTAIDERA'),
          key: OpCodes.AnsiToBytes('FELIXMARIEDELASTELLE,5'),
          expected: OpCodes.AnsiToBytes('FMJFVOISSUFTFPUFEQQC')
        },
        {
          text: 'Basic Trifid example with period 5',
          uri: 'https://en.wikipedia.org/wiki/Trifid_cipher',
          input: OpCodes.AnsiToBytes('HELLO'),
          key: OpCodes.AnsiToBytes('5'),
          expected: OpCodes.AnsiToBytes('BOJN+')
        },
        {
          text: 'Military message with period 6',
          uri: 'https://en.wikipedia.org/wiki/Trifid_cipher',
          input: OpCodes.AnsiToBytes('ATTACKATDAWN'),
          key: OpCodes.AnsiToBytes('6'),
          expected: OpCodes.AnsiToBytes('IBAAEHGHBEDE')
        }
      ];

      // For test suite compatibility
      /** @type {TestCase[]} */
      this.testVectors = this.tests;

      // The cube holds 27 cells, which is the 26 letters plus one extra sign.
      // Nothing is merged: unlike a 5x5 Polybius square the trifid cube has
      // room for J in its own right.
      /** @type {string} */
      this.STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ+';
      /** @type {string[][][]} */
      this.STANDARD_CUBE = this.createCube(this.STANDARD_ALPHABET);
    }

    /**
     * Fold a 27-character alphabet into three 3x3 layers, reading across.
     * @param {string} alphabet - Exactly 27 distinct cube characters
     * @returns {string[][][]} layer/row/column cube
     */
    createCube(alphabet) {
      /** @type {string[][][]} */
      const cube = [];
      /** @type {int32} */
      let index = 0;

      for (let layer = 0; layer < 3; layer++) {
        /** @type {string[][]} */
        const rows = [];
        cube.push(rows);
        for (let row = 0; row < 3; row++) {
          /** @type {string[]} */
          const cells = [];
          rows.push(cells);
          for (let col = 0; col < 3; col++) {
            /** @type {string} */
            const cell = alphabet[index++];
            cells.push(cell);
          }
        }
      }
      return cube;
    }

    /**
     * Build a mixed cube alphabet from a keyword: the keyword's own letters in
     * order and without repeats, then the letters it did not use, then the
     * 27th sign.
     * @param {string} keyword - Key phrase, letters only are taken
     * @returns {string} 27-character alphabet
     */
    buildAlphabet(keyword) {
      /** @type {string} */
      const upper = String(keyword).toUpperCase();
      /** @type {string} */
      const letters = upper.replace(/[^A-Z]/g, '');
      /** @type {string} */
      let mixed = '';
      for (let i = 0; i < letters.length; i++) {
        /** @type {string} */
        const char = letters.charAt(i);
        if (!mixed.includes(char)) mixed += char;
      }
      /** @type {string} */
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < alphabet.length; i++) {
        /** @type {string} */
        const char = alphabet.charAt(i);
        if (!mixed.includes(char)) mixed += char;
      }
      return mixed + '+';
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {TrifidInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new TrifidInstance(this, isInverse);
    }
  }

  /**
   * Position of a character in the cube
   * @class
   */
  class CubePosition {
    /**
     * @param {int32} layer - Layer 0..2
     * @param {int32} row - Row 0..2
     * @param {int32} col - Column 0..2
     */
    constructor(layer, row, col) {
      /** @type {int32} */
      this.layer = layer;
      /** @type {int32} */
      this.row = row;
      /** @type {int32} */
      this.col = col;
    }
  }

  /**
 * Trifid cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TrifidInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {TrifidCipher} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {TrifidCipher} */
      this.trifid = algorithm;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string|null} */
      this._key = null;
      /** @type {int32} */
      this.period = 5; // Default period
      /** @type {string} */
      this.alphabet = algorithm.STANDARD_ALPHABET;
      /** @type {string[][][]} */
      this.cube = algorithm.createCube(algorithm.STANDARD_ALPHABET);
    }

    /**
     * Key format: "keyword,period", a bare period, or a bare keyword.
     * @param {uint8[]} keyData - Key bytes or string
     */
    set key(keyData) {
      this._keyBytes = keyData ? Array.from(keyData) : null;
      /** @type {string} */
      const keyString = keyData ? String.fromCharCode(...keyData) : '';

      /** @type {string[]} */
      const parts = keyString.split(',');
      /** @type {string} */
      let keyword = '';
      /** @type {int32} */
      let period = 5;

      if (parts.length >= 2) {
        keyword = parts[0];
        /** @type {int32} */
        const parsed = parseInt(parts[1], 10);
        period = parsed ? parsed : 5;
      } else {
        /** @type {int32} */
        const asNumber = parseInt(parts[0], 10);
        /** @type {boolean} */
        const notANumber = isNaN(asNumber);
        if (notANumber) keyword = parts[0] ? parts[0] : '';
        else period = asNumber;
      }

      this.period = Math.max(1, Math.min(period, 25));
      /** @type {string} */
      const keyLetters = keyword.replace(/[^A-Za-z]/g, '');
      if (keyLetters.length > 0) {
        /** @type {string} */
        const mixed = this.trifid.buildAlphabet(keyword);
        this.alphabet = mixed;
      } else {
        this.alphabet = this.trifid.STANDARD_ALPHABET;
      }
      this.cube = this.trifid.createCube(this.alphabet);
      this._key = keyString;
    }

    /**
   * @returns {uint8[]|null} The key bytes as set
   */

    get key() {
      return this._keyBytes || null;
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
        this.decryptText(text) :
        this.encryptText(text);

      // Convert string result to bytes (all cube characters are ASCII)
      for (let i = 0; i < result.length; i++) output.push(result.charCodeAt(i));
      return output;
    }

    /**
     * @param {string} char - Character
     * @returns {CubePosition|null} Its position, or null when the cube lacks it
     */
    findPosition(char) {
      for (let layer = 0; layer < 3; layer++) {
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            if (this.cube[layer][row][col] === char) {
              return new CubePosition(layer, row, col);
            }
          }
        }
      }
      return null;
    }

    /**
     * Keep only the characters the cube actually holds. The cube has a cell for
     * every letter including J and one for the 27th sign, so neither is folded
     * away or discarded.
     * @param {string} text - Raw input
     * @returns {string} Input restricted to cube characters
     */
    restrictToCube(text) {
      /** @type {string} */
      let result = '';
      /** @type {string} */
      const upper = text.toUpperCase();
      for (let i = 0; i < upper.length; i++) {
        /** @type {string} */
        const char = upper.charAt(i);
        if (this.alphabet.includes(char)) result += char;
      }
      return result;
    }

    /**
     * @param {string} plaintext - Text
     * @returns {string} Ciphertext
     */
    encryptText(plaintext) {
      // The cube is 27 cells for 26 letters and one sign, so J keeps its own
      // cell; folding J onto I here, as a 5x5 Polybius square must, left J
      // unreachable and contradicted the cube this file builds.
      /** @type {string} */
      const text = this.restrictToCube(plaintext);
      /** @type {string} */
      let result = '';

      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < text.length; blockStart += this.period) {
        /** @type {string} */
        const block = text.substring(blockStart, Math.min(blockStart + this.period, text.length));
        result += this.processBlock(block, true);
      }

      return result;
    }

    /**
     * @param {string} ciphertext - Text
     * @returns {string} Plaintext
     */
    decryptText(ciphertext) {
      // The 27th sign is a perfectly ordinary ciphertext character. Stripping
      // it here, as "[^A-Z]" did, shortened the block and broke the round trip:
      // HELLO enciphered to BOJN+ and came back as DHNK.
      /** @type {string} */
      const text = this.restrictToCube(ciphertext);
      /** @type {string} */
      let result = '';

      // Process text in blocks of 'period' length
      for (let blockStart = 0; blockStart < text.length; blockStart += this.period) {
        /** @type {string} */
        const block = text.substring(blockStart, Math.min(blockStart + this.period, text.length));
        result += this.processBlock(block, false);
      }

      return result;
    }

    /**
     * The cube character at a position, or 'A' when there is none
     * @param {int32} layer - Layer
     * @param {int32} row - Row
     * @param {int32} col - Column
     * @returns {string} Character
     */
    _cellOrA(layer, row, col) {
      if (this.cube[layer] && this.cube[layer][row] && this.cube[layer][row][col]) {
        return this.cube[layer][row][col];
      }
      return 'A'; // Fallback
    }

    /**
     * @param {string} block - Cube characters
     * @param {boolean} encrypt - True to encrypt
     * @returns {string} Transformed block
     */
    processBlock(block, encrypt) {
      /** @type {string} */
      let result = '';

      if (encrypt) {
        // Encryption: separate layers, rows, and columns, then combine
        /** @type {int32[]} */
        const layers = [];
        /** @type {int32[]} */
        const rows = [];
        /** @type {int32[]} */
        const cols = [];
        for (let i = 0; i < block.length; i++) {
          /** @type {CubePosition|null} */
          const pos = this.findPosition(block.charAt(i));
          layers.push(pos ? pos.layer : 0); // Default
          rows.push(pos ? pos.row : 0);
          cols.push(pos ? pos.col : 0);
        }
        /** @type {int32[]} */
        const combined = layers.concat(rows).concat(cols);

        // Group into triplets
        for (let i = 0; i < combined.length; i += 3) {
          /** @type {int32} */
          const layer = combined[i] ? combined[i] : 0;
          /** @type {int32} */
          const row = combined[i + 1] ? combined[i + 1] : 0;
          /** @type {int32} */
          const col = combined[i + 2] ? combined[i + 2] : 0;
          result += this._cellOrA(layer, row, col);
        }
      } else {
        // Decryption: convert back to coordinates and separate
        /** @type {int32[]} */
        const combined = [];

        for (let i = 0; i < block.length; i++) {
          /** @type {CubePosition|null} */
          const pos = this.findPosition(block.charAt(i));
          if (pos) {
            combined.push(pos.layer);
            combined.push(pos.row);
            combined.push(pos.col);
          } else {
            combined.push(0);
            combined.push(0);
            combined.push(0);
          }
        }

        // Split back into layers, rows, cols
        /** @type {int32} */
        const third = Math.ceil(combined.length / 3);
        /** @type {int32[]} */
        const layers = combined.slice(0, third);
        /** @type {int32[]} */
        const rows = combined.slice(third, third * 2);
        /** @type {int32[]} */
        const cols = combined.slice(third * 2);

        // Recombine
        for (let i = 0; i < layers.length; i++) {
          /** @type {int32} */
          const layer = layers[i] ? layers[i] : 0;
          /** @type {int32} */
          const row = (i < rows.length) ? rows[i] : 0;
          /** @type {int32} */
          const col = (i < cols.length) ? cols[i] : 0;
          result += this._cellOrA(layer, row, col);
        }
      }

      return result;
    }
  }


  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new TrifidCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TrifidCipher, TrifidInstance };
}));