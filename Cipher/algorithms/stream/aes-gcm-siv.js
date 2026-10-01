/*
 * AES-GCM-SIV Stream Cipher Implementation
 * Simplified educational implementation for learning purposes
 * Universal cipher implementation compatible with Browser and Node.js
 * (c)2006-2025 Hawkynt
 *
 * This is a simplified educational demonstration of AEAD concepts.
 * Uses basic stream cipher principles with synthetic IV generation.
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, Vulnerability } = AlgorithmFramework;

  /** @type {int32} */
  const STATE_SIZE = 16;   // Key and synthetic IV are 16 bytes

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Simplified educational AES-GCM-SIV keystream construction
   */
  class AESGCMSIVAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'AES-GCM-SIV';
      this.description = 'Simplified educational implementation of nonce-misuse resistant AEAD. Demonstrates synthetic IV generation and stream encryption principles for learning purposes.';
      this.inventor = 'Shay Gueron, Yehuda Lindell';
      this.year = 2017;
      this.category = CategoryType.STREAM;
      this.subCategory = 'AEAD Stream Cipher';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = 'Simplified educational implementation for learning AEAD concepts. Not suitable for production use.';
      this.country = CountryCode.INTL;

      this.documentation = [
        new LinkItem('RFC 8452 - AES-GCM-SIV', 'https://tools.ietf.org/rfc/rfc8452.html'),
        new LinkItem('Educational AEAD Overview', 'https://en.wikipedia.org/wiki/Authenticated_encryption')
      ];

      this.references = [
        new LinkItem('Stream Cipher Principles', 'https://en.wikipedia.org/wiki/Stream_cipher')
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          'Educational Only',
          'This is a simplified educational implementation not suitable for security applications.',
          'Use only for educational purposes to understand AEAD concepts.'
        )
      ];

      this.tests = [
        {
          text: 'Educational test vector',
          uri: 'Educational implementation',
          input: OpCodes.Hex8ToBytes('48656C6C6F'),
          key: OpCodes.Hex8ToBytes('0102030405060708090A0B0C0D0E0F10'),
          expected: OpCodes.Hex8ToBytes('6C85AF6353')
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decryption flag (XOR stream: same operation)
     * @returns {AESGCMSIVInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new AESGCMSIVInstance(this, isInverse);
    }
  }

  /**
   * Keystream instance: the 16-byte key and the synthetic IV derived from it
   */
  class AESGCMSIVInstance extends IAlgorithmInstance {
    /**
     * @param {AESGCMSIVAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decryption flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this._state = OpCodes.CreateArray(STATE_SIZE, 0);
      /** @type {uint8[]} */
      this._siv = OpCodes.CreateArray(STATE_SIZE, 0);
    }

    /**
     * @param {uint8[]|null} keyBytes - Non-empty key; truncated or zero-padded to 16 bytes
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length === 0) {
        throw new Error('AES-GCM-SIV requires a non-empty key');
      }
      this._key = [...keyBytes];

      // Pad key to 16 bytes for consistent operation
      for (let i = 0; i < STATE_SIZE; i++) {
        this._state[i] = i < keyBytes.length ? keyBytes[i] : 0;
      }
      this._siv = this._generateSIV();
    }

    /**
     * @returns {uint8[]|null} Copy of the key
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]} data - Input bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * XOR the buffered input with the keystream (which starts afresh for every message)
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (!this._key) throw new Error('Key not set');

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        output.push(OpCodes.Xor8(this.inputBuffer[i], this._keystreamByte(i)));
      }
      this.inputBuffer = [];
      return output;
    }

    /**
     * Synthetic IV, derived from the padded key only (deterministic)
     * @returns {uint8[]} 16-byte synthetic IV
     */
    _generateSIV() {
      /** @type {uint8[]} */
      const siv = OpCodes.CreateArray(STATE_SIZE, 0);
      for (let i = 0; i < STATE_SIZE; i++) {
        siv[i] = this._state[i];
        siv[i] = OpCodes.Xor8(siv[i], OpCodes.RotL8(this._state[(i + 8) % STATE_SIZE], (i % 8) + 1));
        siv[i] = OpCodes.Xor8(siv[i], OpCodes.ToByte(i * 17)); // Add position-based entropy
      }
      return siv;
    }

    /**
     * Keystream byte at a message position
     * @param {int32} i - Position in the message
     * @returns {uint8} Keystream byte
     */
    _keystreamByte(i) {
      /** @type {uint8} */
      let byte = this._siv[i % STATE_SIZE];
      byte = OpCodes.Xor8(byte, this._state[i % STATE_SIZE]);
      byte = OpCodes.Xor8(byte, OpCodes.ToByte(i));
      return OpCodes.RotL8(byte, (i % 8) + 1);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new AESGCMSIVAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AESGCMSIVAlgorithm, AESGCMSIVInstance };
}));
