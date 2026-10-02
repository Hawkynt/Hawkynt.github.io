/*
 * MUGI-inspired Stream Cipher (educational)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A simplified construction after the design principles of MUGI: a 16-byte buffer and a
 * 16-byte shift register, both seeded from the 128-bit key, mixed for 16 rounds and then
 * clocked once per keystream byte. Not the ISO/IEC 18033-4 MUGI algorithm.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  /** @type {int32} */
  const KEY_SIZE = 16;
  /** @type {int32} */
  const STATE_SIZE = 16;
  /** @type {int32} */
  const INIT_ROUNDS = 16;

  // Key used when Result() runs before any key was assigned.
  /** @type {uint8[]} */
  const DEFAULT_KEY = OpCodes.Hex8ToBytes('00010203040506070809101112131415');

  // Keystream generator state: byte buffer, byte shift register and two position counters.
  class MugiState {
    constructor() {
      /** @type {uint8[]} */
      this.buffer = OpCodes.CreateArray(STATE_SIZE, 0);
      /** @type {uint8[]} */
      this.lfsr = OpCodes.CreateArray(STATE_SIZE, 0);
      /** @type {int32} */
      this.counter = 0;   // 0..15
      /** @type {int32} */
      this.cycle = 0;     // 0..255, advanced once per 16 keystream bytes
    }
  }

  /**
   * Shift the register one byte towards index 0, feeding back taps 0, 5, 11 and 15.
   * @param {uint8[]} lfsr - Shift register (modified in place)
   */
  function clockLfsr(lfsr) {
    const feedback = OpCodes.Xor8(OpCodes.Xor8(lfsr[0], lfsr[5]), OpCodes.Xor8(lfsr[11], lfsr[15]));
    for (let j = 0; j < STATE_SIZE - 1; j++) lfsr[j] = lfsr[j + 1];
    lfsr[STATE_SIZE - 1] = feedback;
  }

  /**
   * Seed the state from a 16-byte key and run the mixing rounds.
   * @param {uint8[]} key - 16 key bytes
   * @returns {MugiState} Initialised state
   */
  function initializeState(key) {
    const state = new MugiState();
    for (let i = 0; i < STATE_SIZE; i++) {
      state.buffer[i] = key[i];
      state.lfsr[i] = key[STATE_SIZE - 1 - i];   // reversed for the register
    }

    for (let round = 0; round < INIT_ROUNDS; round++) {
      for (let i = 0; i < STATE_SIZE; i++) {
        clockLfsr(state.lfsr);
        state.buffer[i] = OpCodes.ToUint8(OpCodes.Add32(OpCodes.Add32(state.buffer[i], state.lfsr[i]), round + i));
      }
    }
    return state;
  }

  /**
   * Produce one keystream byte and advance the state.
   * @param {MugiState} state - Generator state (modified in place)
   * @returns {uint8} Keystream byte
   */
  function generateByte(state) {
    const pos = state.counter % STATE_SIZE;
    const byte = OpCodes.ToUint8(OpCodes.Xor32(OpCodes.Xor8(state.buffer[pos], state.lfsr[pos]), state.cycle * 3 + pos));

    clockLfsr(state.lfsr);
    state.buffer[pos] = OpCodes.ToUint8(OpCodes.Add32(OpCodes.Add32(state.buffer[pos], byte), 1));

    state.counter = (state.counter + 1) % STATE_SIZE;
    if (state.counter === 0) state.cycle = OpCodes.ToUint8(state.cycle + 1);
    return byte;
  }

  /**
   * MUGI-inspired educational stream cipher
   * @class
   * @extends {StreamCipherAlgorithm}
   */
  class MugiAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'MUGI Stream Cipher';
      this.description = 'Educational implementation of MUGI stream cipher. MUGI is a word-oriented stream cipher with a 128-bit key and 128-bit internal state, designed for high-speed software implementation.';
      this.inventor = 'Dai Watanabe, Soichi Furuya, Hirotaka Yoshida, Kazuo Takaragi, Bart Preneel';
      this.year = 2002;
      this.country = CountryCode.JP;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = 'MUGI is a Japanese stream cipher designed for efficient software implementation. This educational version demonstrates the basic principles.';

      this.documentation = [
        new LinkItem('Hitachi MUGI Specification and Self-Evaluation Report', 'https://www.hitachi.com/rd/yrl/crypto/mugi/'),
        new LinkItem('MUGI - Wikipedia', 'https://en.wikipedia.org/wiki/MUGI'),
        new LinkItem('ISO/IEC 18033-4:2011 Encryption algorithms - Part 4: Stream ciphers', 'https://www.iso.org/standard/54531.html')
      ];

      // No maintained public reference-implementation repository for MUGI is known to exist;
      // the most authoritative available sources are Hitachi's own specification document
      // (which includes the reference algorithm description) and the CRYPTREC evaluation
      // report, which documents and benchmarks an ANSI-C reference implementation.
      this.references = [
        new LinkItem('Hitachi MUGI Specification Ver. 1.2 (reference algorithm description, PDF)', 'https://www.hitachi.com/rd/yrl/crypto/mugi/mugi_spe.pdf'),
        new LinkItem('CRYPTREC Evaluation of the MUGI Pseudorandom Number Generator (ANSI-C reference implementation benchmark)', 'https://www.cryptrec.go.jp/exreport/cryptrec-ex-1035-2002.pdf')
      ];

      this.tests = [{
        text: 'Self-computed vector: output of this simplified educational MUGI-inspired construction, verified for self-consistency (not an official Hitachi MUGI test vector - this implementation approximates MUGI\'s design principles rather than the exact ISO/IEC 18033-4 algorithm)',
        uri: 'https://www.hitachi.com/rd/yrl/crypto/mugi/',
        input: OpCodes.Hex8ToBytes('0001020304050607'),
        key: OpCodes.Hex8ToBytes('00010203040506070809101112131415'),
        expected: OpCodes.Hex8ToBytes('519970858a85daaa') // Generated from implementation
      }];
    }

    /**
     * Create a cipher instance (encryption and decryption are identical)
     * @param {boolean} [isInverse=false] - Unused: keystream XOR is its own inverse
     * @returns {MugiInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new MugiInstance(this, isInverse);
    }
  }

  /**
   * MUGI-inspired cipher instance
   * @class
   * @extends {IAlgorithmInstance}
   */
  class MugiInstance extends IAlgorithmInstance {
    /**
     * @param {MugiAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Unused
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {MugiState|null} */
      this._state = null;
    }

    /**
     * Assign the key. A key that is not 16 bytes leaves no keystream state, so the
     * output then equals the input.
     * @param {uint8[]|null} keyData - 16-byte key
     */
    set key(keyData) {
      this._key = keyData;
      this._state = (keyData && keyData.length === KEY_SIZE) ? initializeState(keyData) : null;
    }

    /**
     * @returns {uint8[]|null} Copy of the key
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * Append message bytes
     * @param {uint8[]} data - Bytes to append
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * Encipher everything fed so far, continuing the keystream from the previous call.
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (!this._key) {
        this.key = DEFAULT_KEY;
      }

      /** @type {uint8[]} */
      const output = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const ks = this._state ? generateByte(this._state) : 0;
        output[i] = OpCodes.Xor8(this.inputBuffer[i], ks);
      }
      return output;
    }
  }

  const algorithmInstance = new MugiAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MugiAlgorithm, MugiInstance };
}));
