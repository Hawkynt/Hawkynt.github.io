/*
 * MICKEY Stream Cipher Implementation (MICKEY and MICKEY-128)
 * Hardware-oriented stream cipher with irregular clocking from eSTREAM portfolio
 * Universal cipher implementation compatible with Browser and Node.js
 * (c)2006-2025 Hawkynt
 *
 * MICKEY (Mutual Irregular Clocking KEYstream) is a hardware-oriented stream cipher
 * that uses two 100-bit registers (R and S) with irregular clocking control.
 * This educational implementation demonstrates the basic principles of MICKEY.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, Vulnerability } = AlgorithmFramework;

  // ============================================================================
  // MICKEY (original) - simplified bit registers
  // ============================================================================

  /** @type {int32} */
  const REGISTER_SIZE = 32;   // Simplified from 100 bits for educational purposes
  /** @type {int32} */
  const INIT_ROUNDS = 64;     // Simplified initialization rounds
  /** @type {int32} */
  const MIN_KEY_SIZE = 8;
  /** @type {int32} */
  const KEY_BYTES_USED = 16;  // longer keys are truncated, shorter ones zero-padded

  // Key used when Result() runs before any key was assigned.
  /** @type {uint8[]} */
  const MICKEY_DEFAULT_KEY = OpCodes.Hex8ToBytes('000102030405060708090A0B0C0D0E0F');

  /**
   * Simplified nonlinear function for register operations
   * @param {uint8[]} register - Register of bits
   * @returns {uint8} Nonlinear feedback bit: (s0 AND s1) XOR (s2 AND s3) XOR s0
   */
  function nonlinearFunction(register) {
    const s0 = register[0];
    const s1 = register[1];
    const s2 = register[2];
    const s3 = register[3];
    return OpCodes.And8(OpCodes.Xor8(OpCodes.Xor8(OpCodes.And8(s0, s1), OpCodes.And8(s2, s3)), s0), 1);
  }

  /**
   * Load register bits from the key, least significant bit of each byte first.
   * A register left all zero gets its first bit set.
   * @param {uint8[]} register - Register of bits (modified in place)
   * @param {uint8[]} keyBytes - Key bytes
   * @param {int32} startBit - Starting bit position in the key
   */
  function initializeRegister(register, keyBytes, startBit) {
    /** @type {int32} */
    let bitIndex = startBit;
    for (let i = 0; i < register.length && bitIndex < keyBytes.length * 8; i++) {
      const byteIndex = OpCodes.Shr32(bitIndex, 3);
      const bitPos = OpCodes.And32(bitIndex, 7);
      register[i] = OpCodes.And8(OpCodes.Shr8(keyBytes[byteIndex], bitPos), 1);
      bitIndex++;
    }

    /** @type {boolean} */
    let allZero = true;
    for (let i = 0; i < register.length; i++) {
      if (register[i] !== 0) allZero = false;
    }
    if (allZero) register[0] = 1;
  }

  /**
   * MICKEY educational stream cipher
   * @class
   * @extends {StreamCipherAlgorithm}
   */
  class MickeyAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'MICKEY';
      this.description = 'Hardware-oriented stream cipher using two 100-bit registers with irregular clocking. Part of the eSTREAM hardware portfolio. Educational implementation demonstrating clock-controlled register principles.';
      this.inventor = 'Steve Babbage, Matthew Dodd';
      this.year = 2005;
      this.country = CountryCode.GB;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = 'Hardware-oriented design with irregular clocking. This educational implementation uses simplified registers for demonstration purposes.';

      this.documentation = [
        new LinkItem('MICKEY eSTREAM Specification', 'https://www.ecrypt.eu.org/stream/mickey.html'),
        new LinkItem('eSTREAM Hardware Portfolio', 'https://www.ecrypt.eu.org/stream/')
      ];

      this.references = [
        new LinkItem('Hardware-Oriented Stream Ciphers', 'https://en.wikipedia.org/wiki/Stream_cipher')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Implementation Specific', 'This is a simplified educational implementation not suitable for security applications.', 'Use only for educational purposes to understand clock-controlled generators.')
      ];

      this.tests = [
        {
          text: 'Educational test vector with simplified initialization',
          uri: 'Educational implementation',
          input: [0x48, 0x65, 0x6C, 0x6C, 0x6F],
          key: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F],
          expected: [0x5C, 0xE1, 0xC2, 0x43, 0x0D]
        }
      ];
    }

    /**
     * Create a cipher instance (encryption and decryption are identical)
     * @param {boolean} [isInverse=false] - Unused: keystream XOR is its own inverse
     * @returns {MickeyInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new MickeyInstance(this, isInverse);
    }
  }

  /**
   * MICKEY cipher instance
   * @class
   * @extends {IAlgorithmInstance}
   */
  class MickeyInstance extends IAlgorithmInstance {
    /**
     * @param {MickeyAlgorithm} algorithm - Parent algorithm
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
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {uint8[]} */
      this._registerR = OpCodes.CreateArray(REGISTER_SIZE, 0);
      /** @type {uint8[]} */
      this._registerS = OpCodes.CreateArray(REGISTER_SIZE, 0);
    }

    /**
     * @param {uint8[]} keyData - Key of at least 8 bytes
     * @throws {Error} When the key is missing or shorter than 8 bytes
     */
    set key(keyData) {
      if (!keyData || keyData.length < MIN_KEY_SIZE) {
        throw new Error('MICKEY requires at least 64-bit (8 byte) key');
      }
      this._key = [...keyData];
      this._setup(this._key);
    }

    /**
     * @returns {uint8[]|null} Copy of the key
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * Stored for interface compatibility; MICKEY here uses no IV.
     * @param {uint8[]|null} ivData - IV bytes
     */
    set iv(ivData) { this._iv = ivData ? [...ivData] : null; }

    /**
     * @returns {uint8[]|null} Copy of the IV
     */
    get iv() { return this._iv ? [...this._iv] : null; }

    /**
     * @param {uint8[]|null} nonceData - Alias of the IV
     */
    set nonce(nonceData) { this.iv = nonceData; }

    /**
     * @returns {uint8[]|null} Copy of the IV
     */
    get nonce() { return this.iv; }

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
        this.key = MICKEY_DEFAULT_KEY;
      }

      /** @type {uint8[]} */
      const output = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i++) {
        output[i] = OpCodes.Xor8(this.inputBuffer[i], this._byte());
      }
      return output;
    }

    /**
     * Load both registers from the key and run the initialization rounds.
     * @param {uint8[]} key - Key bytes (first 16 used, zero-padded when shorter)
     */
    _setup(key) {
      this._registerR = OpCodes.CreateArray(REGISTER_SIZE, 0);
      this._registerS = OpCodes.CreateArray(REGISTER_SIZE, 0);

      /** @type {uint8[]} */
      const keyBytes = OpCodes.CreateArray(KEY_BYTES_USED, 0);
      for (let i = 0; i < KEY_BYTES_USED && i < key.length; i++) keyBytes[i] = key[i];

      initializeRegister(this._registerR, keyBytes, 0);
      initializeRegister(this._registerS, keyBytes, REGISTER_SIZE);

      for (let i = 0; i < INIT_ROUNDS; i++) this._clock();
    }

    /**
     * Clock R (linear feedback from taps 0, 7, 15) and S (nonlinear feedback).
     */
    _clock() {
      const feedbackR = OpCodes.Xor8(OpCodes.Xor8(this._registerR[0], this._registerR[7]), this._registerR[15]);
      for (let i = 0; i < REGISTER_SIZE - 1; i++) this._registerR[i] = this._registerR[i + 1];
      this._registerR[REGISTER_SIZE - 1] = feedbackR;

      const feedbackS = nonlinearFunction(this._registerS);
      for (let i = 0; i < REGISTER_SIZE - 1; i++) this._registerS[i] = this._registerS[i + 1];
      this._registerS[REGISTER_SIZE - 1] = feedbackS;
    }

    /**
     * Generate a single keystream bit
     * @returns {uint8} Output bit (0 or 1)
     */
    _bit() {
      const output = OpCodes.Xor8(this._registerR[0], this._registerS[0]);
      this._clock();
      return output;
    }

    /**
     * Generate a byte from eight bits, least significant first
     * @returns {uint8} Byte value (0-255)
     */
    _byte() {
      /** @type {uint8} */
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        byte = OpCodes.Or8(byte, OpCodes.Shl8(this._bit(), bit));
      }
      return byte;
    }
  }

  // ============================================================================
  // MICKEY-128 - byte registers with irregular clocking
  // ============================================================================

  /** @type {int32} */
  const M128_KEY_SIZE = 16;
  /** @type {int32} */
  const M128_REGISTER_SIZE = 32;
  /** @type {int32} */
  const M128_INIT_ROUNDS = 32;

  // Key used when Result() runs before any key was assigned.
  /** @type {uint8[]} */
  const M128_DEFAULT_KEY = OpCodes.Hex8ToBytes('00010203040506070809101112131415');

  /**
   * MICKEY-128 educational stream cipher
   * @class
   * @extends {StreamCipherAlgorithm}
   */
  class Mickey128Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'MICKEY-128';
      this.description = 'Educational implementation of MICKEY-128 enhanced stream cipher based on MICKEY v2 eSTREAM winner. Features 128-bit keys and irregular clocking with dual shift registers.';
      this.inventor = 'Steve Babbage, Matthew Dodd';
      this.year = 2005;
      this.country = CountryCode.GB;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = 'Based on eSTREAM Portfolio winner MICKEY v2. Enhanced version for 128-bit keys while maintaining hardware efficiency principles.';

      this.documentation = [
        new LinkItem('MICKEY eSTREAM Specification', 'https://www.ecrypt.eu.org/stream/mickey.html'),
        new LinkItem('eSTREAM Hardware Portfolio', 'https://www.ecrypt.eu.org/stream/')
      ];

      this.references = [
        new LinkItem('Hardware-Oriented Stream Ciphers', 'https://en.wikipedia.org/wiki/Stream_cipher')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Implementation Specific', 'This is an educational implementation not suitable for security applications.', 'Use only for educational purposes to understand enhanced MICKEY variants.')
      ];

      this.tests = [{
        text: 'Educational test vector for MICKEY-128',
        uri: 'Educational implementation',
        input: OpCodes.Hex8ToBytes('0001020304050607'),
        key: OpCodes.Hex8ToBytes('00010203040506070809101112131415'),
        expected: OpCodes.Hex8ToBytes('4dbc308d5236cc4c')
      }];
    }

    /**
     * Create a cipher instance (encryption and decryption are identical)
     * @param {boolean} [isInverse=false] - Unused: keystream XOR is its own inverse
     * @returns {Mickey128Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new Mickey128Instance(this, isInverse);
    }
  }

  /**
   * MICKEY-128 cipher instance
   * @class
   * @extends {IAlgorithmInstance}
   */
  class Mickey128Instance extends IAlgorithmInstance {
    /**
     * @param {Mickey128Algorithm} algorithm - Parent algorithm
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
      /** @type {boolean} */
      this._keyed = false;
      /** @type {uint8[]} */
      this._registerR = OpCodes.CreateArray(M128_REGISTER_SIZE, 0);
      /** @type {uint8[]} */
      this._registerS = OpCodes.CreateArray(M128_REGISTER_SIZE, 0);
      /** @type {uint8} */
      this._counter = 0;
      /** @type {int32} */
      this._pos = 0;
    }

    /**
     * Assign the key. A key that is not 16 bytes leaves no keystream generator, so
     * the output then equals the input.
     * @param {uint8[]|null} keyData - 16-byte key
     */
    set key(keyData) {
      this._key = keyData;
      this._keyed = keyData ? keyData.length === M128_KEY_SIZE : false;
      if (this._keyed) this._setup(keyData);
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
        this.key = M128_DEFAULT_KEY;
      }

      /** @type {uint8[]} */
      const output = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const ks = this._keyed ? this._byte() : 0;
        output[i] = OpCodes.Xor8(this.inputBuffer[i], ks);
      }
      return output;
    }

    /**
     * Seed both registers from a 16-byte key and run the mixing rounds.
     * @param {uint8[]} key - 16 key bytes
     */
    _setup(key) {
      this._registerR = OpCodes.CreateArray(M128_REGISTER_SIZE, 0);
      this._registerS = OpCodes.CreateArray(M128_REGISTER_SIZE, 0);
      this._counter = 0;
      this._pos = 0;

      for (let i = 0; i < M128_KEY_SIZE; i++) {
        this._registerR[i] = OpCodes.Xor8(this._registerR[i], key[i]);
        this._registerS[i] = OpCodes.Xor8(this._registerS[i], key[M128_KEY_SIZE - 1 - i]); // Reverse order for S
      }

      // Simple mixing inspired by MICKEY irregular clocking
      for (let round = 0; round < M128_INIT_ROUNDS; round++) {
        for (let i = 0; i < M128_REGISTER_SIZE; i++) {
          const feedbackR = OpCodes.Xor8(this._registerR[(i + 13) % M128_REGISTER_SIZE], this._registerR[(i + 29) % M128_REGISTER_SIZE]);
          const feedbackS = OpCodes.Xor8(this._registerS[(i + 17) % M128_REGISTER_SIZE], this._registerS[(i + 23) % M128_REGISTER_SIZE]);

          this._registerR[i] = OpCodes.ToUint8(OpCodes.Add32(OpCodes.Add32(this._registerR[i], feedbackR), round));
          this._registerS[i] = OpCodes.ToUint8(OpCodes.Add32(OpCodes.Add32(this._registerS[i], feedbackS), round + 1));
        }
      }
    }

    /**
     * Produce one keystream byte; each register cell advances only when the other
     * register's control bit is set.
     * @returns {uint8} Keystream byte
     */
    _byte() {
      const posR = this._pos;
      const posS = (this._pos + 17) % M128_REGISTER_SIZE;

      const controlR = OpCodes.And8(this._registerS[posS], 1);
      const controlS = OpCodes.And8(this._registerR[posR], 1);

      const byte = OpCodes.Xor8(OpCodes.Xor8(this._registerR[posR], this._registerS[posS]), this._counter);

      if (controlR !== 0) {
        this._registerR[posR] = OpCodes.ToUint8(OpCodes.Add32(OpCodes.Add32(this._registerR[posR], byte), 1));
      }
      if (controlS !== 0) {
        this._registerS[posS] = OpCodes.ToUint8(OpCodes.Add32(OpCodes.Add32(this._registerS[posS], byte), 2));
      }

      this._pos = (this._pos + 1) % M128_REGISTER_SIZE;
      this._counter = OpCodes.ToUint8(OpCodes.Add32(this._counter, 1));
      return byte;
    }
  }

  // ============================================================================
  // Registration for both variants
  // ============================================================================

  const mickey = new MickeyAlgorithm();
  if (!AlgorithmFramework.Find(mickey.name)) {
    RegisterAlgorithm(mickey);
  }

  const mickey128 = new Mickey128Algorithm();
  if (!AlgorithmFramework.Find(mickey128.name)) {
    RegisterAlgorithm(mickey128);
  }

  return { MickeyAlgorithm, MickeyInstance, Mickey128Algorithm, Mickey128Instance };
}));
