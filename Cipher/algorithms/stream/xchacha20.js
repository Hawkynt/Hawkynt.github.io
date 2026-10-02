/*
 * XChaCha20 Stream Cipher
 * Compatible with both Browser and Node.js environments
 *
 * XChaCha20 as specified in draft-irtf-cfrg-xchacha-03, section 2.3:
 * - HChaCha20 (section 2.2) derives a 256-bit subkey from the key and the
 *   first 16 bytes of the 24-byte nonce;
 * - ChaCha20 (RFC 8439) then runs under that subkey with the 12-byte nonce
 *   4 zero bytes || last 8 nonce bytes, from block counter 0 unless set.
 *
 * References:
 * - draft-irtf-cfrg-xchacha-03: https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03
 * - libsodium XChaCha20: https://doc.libsodium.org/advanced/stream_ciphers/xchacha20
 * - ChaCha20 RFC 8439: https://www.rfc-editor.org/rfc/rfc8439
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

  const { RegisterAlgorithm, CategoryType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  /** @type {int32} */
  const XCHACHA20_KEY_SIZE = 32;     // 256-bit keys
  /** @type {int32} */
  const XCHACHA20_NONCE_SIZE = 24;   // 192-bit nonces
  /** @type {int32} */
  const XCHACHA20_BLOCK_SIZE = 64;   // 64-byte keystream blocks
  /** @type {int32} */
  const HCHACHA20_NONCE_SIZE = 16;   // HChaCha20 nonce size

  // "expand 32-byte k" as four little-endian words (RFC 8439 section 2.3)
  /** @type {uint32[]} */
  const CHACHA20_CONSTANTS = [
    OpCodes.Pack32LE(0x65, 0x78, 0x70, 0x61), // "expa"
    OpCodes.Pack32LE(0x6e, 0x64, 0x20, 0x33), // "nd 3"
    OpCodes.Pack32LE(0x32, 0x2d, 0x62, 0x79), // "2-by"
    OpCodes.Pack32LE(0x74, 0x65, 0x20, 0x6b)  // "te k"
  ];

  /** @type {uint32} */
  const MAX_BLOCK_COUNTER = 0xFFFFFFFF; // RFC 8439: the 32-bit counter must not wrap

  /** @type {string} */
  const DEFAULT_NONCE_HEX = '000102030405060708090a0b0c0d0e0f1011121314151617';

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * XChaCha20 extended-nonce stream cipher (draft-irtf-cfrg-xchacha-03)
   */
  class XChaCha20Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'XChaCha20 Extended-Nonce Stream Cipher';
      this.description = 'Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. HChaCha20 derives a subkey from the key and the first 16 nonce bytes; ChaCha20 then runs under that subkey with the remaining 8 nonce bytes, so nonces can be chosen at random.';
      this.inventor = 'Daniel J. Bernstein (ChaCha20), Frank Denis (XChaCha20)';
      this.year = 2018;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = null;
      /** @type {string} */
      this.securityNotes = 'Random 192-bit nonces are safe under a single key (a collision is expected only after about 2^96 messages). Provides no integrity on its own: pair it with a MAC, as XChaCha20-Poly1305 does.';
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(XCHACHA20_KEY_SIZE, XCHACHA20_KEY_SIZE, 1)];

      this.documentation = [
        new LinkItem('draft-irtf-cfrg-xchacha-03: XChaCha', 'https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03'),
        new LinkItem('RFC 8439: ChaCha20 and Poly1305 for IETF Protocols', 'https://www.rfc-editor.org/rfc/rfc8439')
      ];

      this.references = [
        new LinkItem('libsodium XChaCha20 Implementation', 'https://github.com/jedisct1/libsodium/blob/master/src/libsodium/crypto_stream/xchacha20/stream_xchacha20.c'),
        new LinkItem('libsodium XChaCha20 Test Vectors', 'https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c')
      ];

      // The draft's plaintext for A.3.2 ("The dhole (pronounced "dole") ...", 304 bytes)
      /** @type {string} */
      const dholePlaintext =
        '5468652064686f6c65202870726f6e6f756e6365642022646f6c652229206973' +
        '20616c736f206b6e6f776e2061732074686520417369617469632077696c6420' +
        '646f672c2072656420646f672c20616e642077686973746c696e6720646f672e' +
        '2049742069732061626f7574207468652073697a65206f662061204765726d61' +
        '6e20736865706865726420627574206c6f6f6b73206d6f7265206c696b652061' +
        '206c6f6e672d6c656767656420666f782e205468697320686967686c7920656c' +
        '757369766520616e6420736b696c6c6564206a756d70657220697320636c6173' +
        '736966696564207769746820776f6c7665732c20636f796f7465732c206a6163' +
        '6b616c732c20616e6420666f78657320696e20746865207461786f6e6f6d6963' +
        '2066616d696c792043616e696461652e';

      this.tests = [
        {
          text: 'draft-irtf-cfrg-xchacha-03 A.3.2.1 XChaCha20 (block counter 0)',
          uri: 'https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03#appendix-A.3.2.1',
          input: OpCodes.Hex8ToBytes(dholePlaintext),
          key: OpCodes.Hex8ToBytes('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f'),
          nonce: OpCodes.Hex8ToBytes('404142434445464748494a4b4c4d4e4f5051525354555658'),
          expected: OpCodes.Hex8ToBytes(
            '4559abba4e48c16102e8bb2c05e6947f50a786de162f9b0b7e592a9b53d0d4e9' +
            '8d8d6410d540a1a6375b26d80dace4fab52384c731acbf16a5923c0c48d3575d' +
            '4d0d2c673b666faa731061277701093a6bf7a158a8864292a41c48e3a9b4c0da' +
            'ece0f8d98d0d7e05b37a307bbb66333164ec9e1b24ea0d6c3ffddcec4f68e744' +
            '3056193a03c810e11344ca06d8ed8a2bfb1e8d48cfa6bc0eb4e2464b74814240' +
            '7c9f431aee769960e15ba8b96890466ef2457599852385c661f752ce20f9da0c' +
            '09ab6b19df74e76a95967446f8d0fd415e7bee2a12a114c20eb5292ae7a349ae' +
            '577820d5520a1f3fb62a17ce6a7e68fa7c79111d8860920bc048ef43fe84486c' +
            'cb87c25f0ae045f0cce1e7989a9aa220a28bdd4827e751a24a6d5c62d790a663' +
            '93b93111c1a55dd7421a10184974c7c5')
        },
        // libsodium tv_stream_xchacha20: crypto_stream_xchacha20 keystream, i.e. the encryption of zero bytes
        {
          text: 'libsodium tv_stream_xchacha20 #1 (29 bytes)',
          uri: 'https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c',
          input: OpCodes.CreateArray(29, 0),
          key: OpCodes.Hex8ToBytes('79c99798ac67300bbb2704c95c341e3245f3dcb21761b98e52ff45b24f304fc4'),
          nonce: OpCodes.Hex8ToBytes('b33ffd3096479bcfbc9aee49417688a0a2554f8d95389419'),
          expected: OpCodes.Hex8ToBytes('c6e9758160083ac604ef90e712ce6e75d7797590744e0cf060f013739c')
        },
        {
          text: 'libsodium tv_stream_xchacha20 #3 (22 bytes)',
          uri: 'https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c',
          input: OpCodes.CreateArray(22, 0),
          key: OpCodes.Hex8ToBytes('3d12800e7b014e88d68a73f0a95b04b435719936feba60473f02a9e61ae60682'),
          nonce: OpCodes.Hex8ToBytes('56bed2599eac99fb27ebf4ffcb770a64772dec4d5849ea2d'),
          expected: OpCodes.Hex8ToBytes('a2c3c1406f33c054a92760a8e0666b84f84fa3a618f0')
        },
        {
          text: 'libsodium tv_stream_xchacha20 #8 (76 bytes, two blocks)',
          uri: 'https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c',
          input: OpCodes.CreateArray(76, 0),
          key: OpCodes.Hex8ToBytes('d45e56368ebc7ba9be7c55cfd2da0feb633c1d86cab67cd5627514fd20c2b391'),
          nonce: OpCodes.Hex8ToBytes('fd37da2db31e0c738754463edadc7dafb0833bd45da497fc'),
          expected: OpCodes.Hex8ToBytes(
            '47950efa8217e3dec437454bd6b6a80a287e2570f0a48b3fa1ea3eb868be3d48' +
            '6f6516606d85e5643becc473b370871ab9ef8e2a728f73b92bd98e6e26ea7c8f' +
            'f96ec5a9e8de95e1eee9300c')
        },
        {
          text: 'libsodium tv_stream_xchacha20 #10 (91 bytes, two blocks)',
          uri: 'https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c',
          input: OpCodes.CreateArray(91, 0),
          key: OpCodes.Hex8ToBytes('9d23bd4149cb979ccf3c5c94dd217e9808cb0e50cd0f67812235eaaf601d6232'),
          nonce: OpCodes.Hex8ToBytes('c047548266b7c370d33566a2425cbf30d82d1eaf5294109e'),
          expected: OpCodes.Hex8ToBytes(
            'a21209096594de8c5667b1d13ad93f744106d054df210e4782cd396fec692d35' +
            '15a20bf351eec011a92c367888bc464c32f0807acd6c203a247e0db854148468' +
            'e9f96bee4cf718d68d5f637cbd5a376457788e6fae90fc31097cfc')
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
   * XChaCha20 instance; every message starts at the initial block counter (default 0)
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
      /** @type {uint32} */
      this._counter = 0;
    }

    /**
     * @param {uint32|null} value - Initial ChaCha20 block counter; null restores 0
     */
    set counter(value) {
      if (value === null || value === undefined) {
        this._counter = 0;
        return;
      }
      if (value < 0 || value > MAX_BLOCK_COUNTER || value !== Math.floor(value)) {
        throw new Error('XChaCha20 block counter must be an integer from 0 to 2^32-1');
      }
      this._counter = value;
    }

    /**
     * @returns {uint32} Initial ChaCha20 block counter
     */
    get counter() {
      return this._counter;
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

      // Step 2: inner nonce = 4 zero bytes, then the last 8 nonce bytes
      /** @type {uint8[]} */
      const innerNonce = OpCodes.CreateArray(12, 0);
      for (let i = 0; i < 8; i++) {
        innerNonce[4 + i] = this._nonce[16 + i];
      }

      // Step 3: ChaCha20 keystream from the initial block counter
      /** @type {uint8[]} */
      const output = [];
      /** @type {uint8[]} */
      let keystream = [];
      /** @type {uint32} */
      let blockCounter = this._counter;
      /** @type {boolean} */
      let counterExhausted = false;
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const offset = i % XCHACHA20_BLOCK_SIZE;
        if (offset === 0) {
          if (counterExhausted) {
            this.inputBuffer = [];
            throw new Error('XChaCha20 block counter would wrap past 2^32-1');
          }
          keystream = this._chacha20Block(subkey, blockCounter, innerNonce);
          if (blockCounter === MAX_BLOCK_COUNTER) {
            counterExhausted = true;
          } else {
            blockCounter = OpCodes.Add32(blockCounter, 1);
          }
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
