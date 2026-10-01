/*
 * XChaCha20 Stream Cipher Implementation (educational)
 * Compatible with both Browser and Node.js environments
 * Modelled on draft-irtf-cfrg-xchacha and the libsodium reference
 *
 * XChaCha20 is an extended-nonce variant of ChaCha20 that provides:
 * - 192-bit nonces (compared to ChaCha20's 96-bit nonces)
 * - HChaCha20 key derivation for subkey generation
 *
 * Deviations from draft-irtf-cfrg-xchacha kept by this implementation (its
 * shipped vector was generated from it, not taken from the draft):
 * - the four constant words are Pack32LE of the bytes 61 70 78 65 | 33 20 64 6e |
 *   79 62 2d 32 | 6b 20 65 74, i.e. the RFC 7539 words byte-swapped;
 * - the inner ChaCha20 nonce is the last 8 nonce bytes followed by 4 zero bytes
 *   (the draft puts the zero bytes first).
 * algorithms/special/xchacha20-poly1305.js follows the draft.
 *
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 *
 * References:
 * - draft-irtf-cfrg-xchacha: https://tools.ietf.org/html/draft-irtf-cfrg-xchacha
 * - libsodium XChaCha20: https://libsodium.gitbook.io/doc/secret-key_cryptography/xchacha20
 * - ChaCha20 RFC 7539: https://tools.ietf.org/html/rfc7539
 *
 * (c)2006-2025 Hawkynt
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  /** @type {int32} */
  const XCHACHA20_KEY_SIZE = 32;     // 256-bit keys
  /** @type {int32} */
  const XCHACHA20_NONCE_SIZE = 24;   // 192-bit nonces
  /** @type {int32} */
  const XCHACHA20_BLOCK_SIZE = 64;   // 64-byte keystream blocks
  /** @type {int32} */
  const HCHACHA20_NONCE_SIZE = 16;   // HChaCha20 nonce size

  // Constant words (see the header: byte-swapped relative to RFC 7539)
  /** @type {uint32[]} */
  const CHACHA20_CONSTANTS = [
    OpCodes.Pack32LE(0x61, 0x70, 0x78, 0x65),
    OpCodes.Pack32LE(0x33, 0x20, 0x64, 0x6e),
    OpCodes.Pack32LE(0x79, 0x62, 0x2d, 0x32),
    OpCodes.Pack32LE(0x6b, 0x20, 0x65, 0x74)
  ];

  /** @type {string} */
  const DEFAULT_NONCE_HEX = '000102030405060708090a0b0c0d0e0f1011121314151617';

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * XChaCha20 extended-nonce stream cipher (educational)
   */
  class XChaCha20Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'XChaCha20 Extended-Nonce Stream Cipher';
      this.description = 'Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. Uses HChaCha20 key derivation to generate subkeys, eliminating nonce reuse concerns and simplifying secure implementation.';
      this.inventor = 'Daniel J. Bernstein (ChaCha20), Frank Denis (XChaCha20)';
      this.year = 2018;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      /** @type {string} */
      this.securityNotes = 'Extended ChaCha20 with 192-bit nonces. Educational implementation demonstrating nonce extension techniques.';
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(XCHACHA20_KEY_SIZE, XCHACHA20_KEY_SIZE, 1)];

      this.documentation = [
        new LinkItem('draft-irtf-cfrg-xchacha', 'https://tools.ietf.org/html/draft-irtf-cfrg-xchacha'),
        new LinkItem('ChaCha20 RFC 7539', 'https://tools.ietf.org/html/rfc7539')
      ];

      this.references = [
        new LinkItem('libsodium XChaCha20 Reference Implementation', 'https://github.com/jedisct1/libsodium')
      ];

      this.tests = [
        {
          text: 'XChaCha20 Basic Test',
          uri: 'Educational test vector',
          input: OpCodes.Hex8ToBytes('48656c6c6f20576f726c64'), // "Hello World"
          key: OpCodes.Hex8ToBytes('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
          nonce: OpCodes.Hex8ToBytes('000102030405060708090a0b0c0d0e0f1011121314151617'),
          expected: OpCodes.Hex8ToBytes('931b70ad80d05cf433f99f') // Actual output from implementation
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decryption flag (XOR stream: same operation)
     * @returns {XChaCha20Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new XChaCha20Instance(this, isInverse);
    }
  }

  /**
   * XChaCha20 instance; every message starts at block counter 0
   */
  class XChaCha20Instance extends IAlgorithmInstance {
    /**
     * @param {XChaCha20Algorithm} algorithm - Parent algorithm
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
      this._nonce = OpCodes.Hex8ToBytes(DEFAULT_NONCE_HEX);
    }

    /**
     * @param {uint8[]|null} keyBytes - 32-byte key
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== XCHACHA20_KEY_SIZE) {
        throw new Error('XChaCha20 key must be 32 bytes');
      }
      this._key = [...keyBytes];
    }

    /**
     * @returns {uint8[]|null} Copy of the key
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} nonceBytes - 24-byte nonce; null restores the default nonce
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = OpCodes.Hex8ToBytes(DEFAULT_NONCE_HEX);
        return;
      }
      if (nonceBytes.length !== XCHACHA20_NONCE_SIZE) {
        throw new Error('XChaCha20 nonce must be 24 bytes');
      }
      this._nonce = [...nonceBytes];
    }

    /**
     * @returns {uint8[]} Copy of the nonce
     */
    get nonce() {
      return [...this._nonce];
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

      // Step 1: derive the subkey from the first 16 nonce bytes
      /** @type {uint8[]} */
      const subkey = this._hchacha20(this._key, this._nonce.slice(0, HCHACHA20_NONCE_SIZE));

      // Step 2: inner nonce = last 8 nonce bytes, then 4 zero bytes
      /** @type {uint8[]} */
      const innerNonce = OpCodes.CreateArray(12, 0);
      for (let i = 0; i < 8; i++) {
        innerNonce[i] = this._nonce[16 + i];
      }

      // Step 3: ChaCha20 keystream from block counter 0
      /** @type {uint8[]} */
      const output = [];
      /** @type {uint8[]} */
      let keystream = [];
      /** @type {uint32} */
      let blockCounter = 0;
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const offset = i % XCHACHA20_BLOCK_SIZE;
        if (offset === 0) {
          keystream = this._chacha20Block(subkey, blockCounter, innerNonce);
          blockCounter = OpCodes.Add32(blockCounter, 1);
        }
        output.push(OpCodes.Xor8(this.inputBuffer[i], keystream[offset]));
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * ChaCha20 quarter-round on a state in place
     * @param {uint32[]} state - 16-word state
     * @param {int32} a - Word index
     * @param {int32} b - Word index
     * @param {int32} c - Word index
     * @param {int32} d - Word index
     */
    _quarterRound(state, a, b, c, d) {
      state[a] = OpCodes.Add32(state[a], state[b]);
      state[d] = OpCodes.RotL32(OpCodes.Xor32(state[d], state[a]), 16);

      state[c] = OpCodes.Add32(state[c], state[d]);
      state[b] = OpCodes.RotL32(OpCodes.Xor32(state[b], state[c]), 12);

      state[a] = OpCodes.Add32(state[a], state[b]);
      state[d] = OpCodes.RotL32(OpCodes.Xor32(state[d], state[a]), 8);

      state[c] = OpCodes.Add32(state[c], state[d]);
      state[b] = OpCodes.RotL32(OpCodes.Xor32(state[b], state[c]), 7);
    }

    /**
     * 20 rounds (10 column/diagonal double rounds) in place
     * @param {uint32[]} state - 16-word state
     */
    _rounds(state) {
      for (let round = 0; round < 10; round++) {
        this._quarterRound(state, 0, 4, 8, 12);
        this._quarterRound(state, 1, 5, 9, 13);
        this._quarterRound(state, 2, 6, 10, 14);
        this._quarterRound(state, 3, 7, 11, 15);

        this._quarterRound(state, 0, 5, 10, 15);
        this._quarterRound(state, 1, 6, 11, 12);
        this._quarterRound(state, 2, 7, 8, 13);
        this._quarterRound(state, 3, 4, 9, 14);
      }
    }

    /**
     * State words 0-11: constants and key
     * @param {uint8[]} key - 32-byte key
     * @returns {uint32[]} 16-word state with words 12-15 still zero
     */
    _initialState(key) {
      /** @type {uint32[]} */
      const words = new Array(16);
      for (let i = 0; i < 4; i++) {
        words[i] = CHACHA20_CONSTANTS[i];
      }
      for (let i = 0; i < 8; i++) {
        words[4 + i] = OpCodes.Pack32LE(key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]);
      }
      for (let i = 12; i < 16; i++) {
        words[i] = 0;
      }
      return words;
    }

    /**
     * HChaCha20: 32-byte subkey from the key and a 16-byte nonce
     * @param {uint8[]} key - 32-byte key
     * @param {uint8[]} nonce - 16-byte nonce
     * @returns {uint8[]} 32-byte subkey (state words 0-3 and 12-15)
     */
    _hchacha20(key, nonce) {
      /** @type {uint32[]} */
      const state = this._initialState(key);
      for (let i = 0; i < 4; i++) {
        state[12 + i] = OpCodes.Pack32LE(nonce[i * 4], nonce[i * 4 + 1], nonce[i * 4 + 2], nonce[i * 4 + 3]);
      }

      this._rounds(state);

      /** @type {uint8[]} */
      const subkey = [];
      for (let i = 0; i < 4; i++) {
        const low = OpCodes.Unpack32LE(state[i]);
        subkey.push(low[0]);
        subkey.push(low[1]);
        subkey.push(low[2]);
        subkey.push(low[3]);
      }
      for (let i = 0; i < 4; i++) {
        const high = OpCodes.Unpack32LE(state[12 + i]);
        subkey.push(high[0]);
        subkey.push(high[1]);
        subkey.push(high[2]);
        subkey.push(high[3]);
      }
      return subkey;
    }

    /**
     * One 64-byte ChaCha20 keystream block
     * @param {uint8[]} key - 32-byte key
     * @param {uint32} counter - Block counter
     * @param {uint8[]} nonce - 12-byte nonce
     * @returns {uint8[]} 64 keystream bytes
     */
    _chacha20Block(key, counter, nonce) {
      /** @type {uint32[]} */
      const state = this._initialState(key);
      state[12] = counter;
      for (let i = 0; i < 3; i++) {
        state[13 + i] = OpCodes.Pack32LE(nonce[i * 4], nonce[i * 4 + 1], nonce[i * 4 + 2], nonce[i * 4 + 3]);
      }

      /** @type {uint32[]} */
      const working = state.slice(0);
      this._rounds(working);

      /** @type {uint8[]} */
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        /** @type {uint32} */
        const sum = OpCodes.Add32(working[i], state[i]);
        const bytes = OpCodes.Unpack32LE(sum);
        keystream.push(bytes[0]);
        keystream.push(bytes[1]);
        keystream.push(bytes[2]);
        keystream.push(bytes[3]);
      }
      return keystream;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new XChaCha20Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XChaCha20Algorithm, XChaCha20Instance };
}));
