/*
 * Beth-Piper Stop-and-Go Generator Stream Cipher
 * Universal cipher implementation compatible with Browser and Node.js
 * (c)2006-2025 Hawkynt
 *
 * Implementation of the stop-and-go generator by Thomas Beth and Fred Piper (EUROCRYPT 1984).
 * Uses clock-controlled LFSRs where one LFSR controls the clocking of another.
 * This educational implementation demonstrates irregular clocking techniques in stream ciphers.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // LFSR parameters (coprime lengths)
  /** @type {int32} */
  const CLOCK_LFSR_LENGTH = 19;   // Clock control LFSR length
  /** @type {int32} */
  const DATA_LFSR_LENGTH = 23;    // Data output LFSR length
  /** @type {int32} */
  const KEY_BITS = 128;           // 16-byte key

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Beth-Piper stop-and-go generator: a clock LFSR decides whether the data LFSR steps
   */
  class BethPiperAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'Beth-Piper Stop-and-Go Generator';
      this.description = 'Clock-controlled LFSR stream cipher using stop-and-go clocking strategy. One LFSR controls the irregular clocking of a second LFSR to introduce nonlinearity. Educational implementation for understanding clock-controlled generators.';
      this.inventor = 'Thomas Beth, Fred Piper';
      this.year = 1984;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = 'Clock-controlled generators can be vulnerable to correlation attacks and algebraic attacks. Modern cryptanalysis has shown weaknesses in simple stop-and-go generators.';
      this.country = CountryCode.DE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem('EUROCRYPT 1984 Paper', 'https://link.springer.com/chapter/10.1007/3-540-39757-4_17'),
        new LinkItem('Stream Ciphers Overview', 'https://en.wikipedia.org/wiki/Stream_cipher')
      ];

      this.references = [
        new LinkItem('Clock-Controlled Generators', 'https://link.springer.com/chapter/10.1007/978-3-030-12850-0_1')
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          'Correlation Attack',
          'Clock-controlled generators can be vulnerable to correlation attacks that exploit dependencies between control and data sequences.',
          'Use only for educational purposes, not in production systems.'
        )
      ];

      this.tests = [
        {
          text: 'Basic functionality test with known key',
          uri: 'Educational test vector',
          input: OpCodes.Hex8ToBytes('48656C6C6F20576F726C64'),
          key: OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F'),
          expected: OpCodes.Hex8ToBytes('D99A8F65AFFFD6ACBE039B')
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decryption flag (XOR stream: same operation)
     * @returns {BethPiperInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new BethPiperInstance(this, isInverse);
    }
  }

  /**
   * Beth-Piper keystream instance
   */
  class BethPiperInstance extends IAlgorithmInstance {
    /**
     * @param {BethPiperAlgorithm} algorithm - Parent algorithm
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
      this.clockLFSR = OpCodes.CreateArray(CLOCK_LFSR_LENGTH, 0);
      /** @type {uint8[]} */
      this.dataLFSR = OpCodes.CreateArray(DATA_LFSR_LENGTH, 0);
    }

    /**
     * @param {uint8[]|null} keyBytes - 16-byte key
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== 16) {
        throw new Error('Beth-Piper generator requires 128-bit (16 byte) key');
      }
      this._key = [...keyBytes];
      this._setupKey(this._key);
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
     * XOR the buffered input with the keystream
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (!this._key) throw new Error('Key not set');

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        output.push(OpCodes.Xor8(this.inputBuffer[i], this._generateByte()));
      }
      this.inputBuffer = [];
      return output;
    }

    /**
     * Distribute the key bits across both LFSRs
     * @param {uint8[]} key - 16-byte key
     */
    _setupKey(key) {
      this.clockLFSR = OpCodes.CreateArray(CLOCK_LFSR_LENGTH, 0);
      this.dataLFSR = OpCodes.CreateArray(DATA_LFSR_LENGTH, 0);

      /** @type {int32} */
      let bitIndex = 0;

      // Initialize clock LFSR
      for (let i = 0; i < CLOCK_LFSR_LENGTH && bitIndex < KEY_BITS; i++) {
        this.clockLFSR[i] = this._keyBit(key, bitIndex);
        bitIndex++;
      }

      // Initialize data LFSR
      for (let i = 0; i < DATA_LFSR_LENGTH && bitIndex < KEY_BITS; i++) {
        this.dataLFSR[i] = this._keyBit(key, bitIndex);
        bitIndex++;
      }

      // Use remaining key bits to modify existing LFSR states, alternately
      while (bitIndex < KEY_BITS) {
        const keyBit = this._keyBit(key, bitIndex);
        if ((bitIndex % 2) === 0) {
          const c = bitIndex % CLOCK_LFSR_LENGTH;
          this.clockLFSR[c] = OpCodes.Xor8(this.clockLFSR[c], keyBit);
        } else {
          const d = bitIndex % DATA_LFSR_LENGTH;
          this.dataLFSR[d] = OpCodes.Xor8(this.dataLFSR[d], keyBit);
        }
        bitIndex++;
      }

      // Ensure no LFSR is all zeros
      if (this._isAllZero(this.clockLFSR)) this.clockLFSR[0] = 1;
      if (this._isAllZero(this.dataLFSR)) this.dataLFSR[0] = 1;
    }

    /**
     * Bit of the key at a bit position (LSB-first within each byte)
     * @param {uint8[]} key - Key bytes
     * @param {int32} bitIndex - Bit position
     * @returns {uint8} 0 or 1
     */
    _keyBit(key, bitIndex) {
      return OpCodes.And8(OpCodes.Shr8(key[OpCodes.Shr32(bitIndex, 3)], bitIndex % 8), 1);
    }

    /**
     * @param {uint8[]} bits - LFSR cells
     * @returns {boolean} true when every cell is 0
     */
    _isAllZero(bits) {
      for (let i = 0; i < bits.length; i++) {
        if (bits[i] !== 0) return false;
      }
      return true;
    }

    /**
     * Step the clock LFSR (taps 0, 1, 2, 5)
     * @returns {uint8} Output bit for clock control
     */
    _updateClockLFSR() {
      const output = this.clockLFSR[0];
      const feedback = OpCodes.Xor8(OpCodes.Xor8(OpCodes.Xor8(this.clockLFSR[0], this.clockLFSR[1]), this.clockLFSR[2]), this.clockLFSR[5]);

      for (let i = 0; i < CLOCK_LFSR_LENGTH - 1; i++) {
        this.clockLFSR[i] = this.clockLFSR[i + 1];
      }
      this.clockLFSR[CLOCK_LFSR_LENGTH - 1] = feedback;

      return output;
    }

    /**
     * Step the data LFSR (taps 0 and 5)
     * @returns {uint8} Output bit for the keystream
     */
    _updateDataLFSR() {
      const output = this.dataLFSR[0];
      const feedback = OpCodes.Xor8(this.dataLFSR[0], this.dataLFSR[5]);

      for (let i = 0; i < DATA_LFSR_LENGTH - 1; i++) {
        this.dataLFSR[i] = this.dataLFSR[i + 1];
      }
      this.dataLFSR[DATA_LFSR_LENGTH - 1] = feedback;

      return output;
    }

    /**
     * One output bit with stop-and-go clocking: the data LFSR steps only on a clock bit of 1
     * @returns {uint8} Output bit (0 or 1)
     */
    _generateBit() {
      const clockBit = this._updateClockLFSR();
      if (clockBit === 1) {
        return this._updateDataLFSR();
      }
      return this.dataLFSR[0];
    }

    /**
     * Eight output bits, LSB first
     * @returns {uint8} Keystream byte
     */
    _generateByte() {
      /** @type {uint8} */
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        byte = OpCodes.Or8(byte, OpCodes.Shl8(this._generateBit(), bit));
      }
      return byte;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BethPiperAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BethPiperAlgorithm, BethPiperInstance };
}));
