/*
 * Oribatida Family - NIST LWC Round 2 Candidate
 * Professional implementation following official specification
 * (c)2006-2025 Hawkynt
 *
 * Oribatida is a family of lightweight AEAD ciphers based on SimP permutations,
 * which are built on reduced-round Simon block ciphers. This file contains both:
 * - Oribatida-192-96: SimP-192 (48-bit words, 26 rounds)
 * - Oribatida-256-64: SimP-256 (64-bit words, 34 rounds)
 *
 * Both variants provide authenticated encryption with 128-bit keys and support
 * masked ciphertext generation for side-channel resistance.
 *
 * Reference: https://www.isical.ac.in/~lightweight/oribatida/
 * C Reference: Southern Storm Software lightweight crypto library
 * Test Vectors: NIST LWC submission KAT files
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
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SHARED CONSTANTS =====

  const SIMP_RC = 0x3369F885192C0EF5n; // 62-bit round constant (shared by both variants)

  // Domain separation constants (shared by both variants)
  const ORIBATIDA_DOMAIN_NONCE = 0;
  const ORIBATIDA_DOMAIN_AD = 1;
  const ORIBATIDA_DOMAIN_MSG = 2;

  // ===== VARIANT-SPECIFIC CONSTANTS =====

  // Oribatida-192-96 constants
  const SIMP_192_STATE_SIZE = 24;
  const ORIBATIDA_192_KEY_SIZE = 16;
  const ORIBATIDA_192_NONCE_SIZE = 8;
  const ORIBATIDA_192_TAG_SIZE = 12;
  const ORIBATIDA_192_RATE = 12;
  const ORIBATIDA_192_MASK_SIZE = 12;
  const SIMP_192_ROUNDS = 26;

  // Oribatida-256-64 constants
  const SIMP_256_STATE_SIZE = 32;
  const ORIBATIDA_256_KEY_SIZE = 16;
  const ORIBATIDA_256_NONCE_SIZE = 16;
  const ORIBATIDA_256_TAG_SIZE = 16; // 128-bit tag
  const ORIBATIDA_256_RATE = 16;
  const ORIBATIDA_256_MASK_SIZE = 8;
  const SIMP_256_ROUNDS = 34;

  // ===== 48-BIT HELPER FUNCTIONS (for SimP-192) =====

  function load48BE(bytes, offset) {
    return (BigInt(bytes[offset]) << 40n)|(BigInt(bytes[offset + 1]) << 32n)|(BigInt(bytes[offset + 2]) << 24n)|(BigInt(bytes[offset + 3]) << 16n)|(BigInt(bytes[offset + 4]) << 8n)|BigInt(bytes[offset + 5]);
  }

  function store48BE(bytes, offset, value) {
    bytes[offset] = Number((value >> 40n)&0xFFn);
    bytes[offset + 1] = Number((value >> 32n)&0xFFn);
    bytes[offset + 2] = Number((value >> 24n)&0xFFn);
    bytes[offset + 3] = Number((value >> 16n)&0xFFn);
    bytes[offset + 4] = Number((value >> 8n)&0xFFn);
    bytes[offset + 5] = Number(value&0xFFn);
  }

  function rotl48(value, positions) {
    positions = positions % 48;
    const mask = (1n << 48n) - 1n;
    return ((value << BigInt(positions))|(value >> BigInt(48 - positions)))&mask;
  }

  function rotr48(value, positions) {
    positions = positions % 48;
    const mask = (1n << 48n) - 1n;
    return ((value >> BigInt(positions))|(value << BigInt(48 - positions)))&mask;
  }

  // ===== 64-BIT HELPER FUNCTIONS (for SimP-256) =====

  function rotl64(value, positions) {
    positions = positions % 64;
    if (positions === 0) return value;
    const mask = (1n << 64n) - 1n;
    return ((value << BigInt(positions))|(value >> BigInt(64 - positions)))&mask;
  }

  function rotr64(value, positions) {
    positions = positions % 64;
    if (positions === 0) return value;
    const mask = (1n << 64n) - 1n;
    return ((value >> BigInt(positions))|(value << BigInt(64 - positions)))&mask;
  }

  function load64BE(bytes, offset) {
    return (
      (BigInt(bytes[offset]) << 56n)|(BigInt(bytes[offset + 1]) << 48n)|(BigInt(bytes[offset + 2]) << 40n)|(BigInt(bytes[offset + 3]) << 32n)|(BigInt(bytes[offset + 4]) << 24n)|(BigInt(bytes[offset + 5]) << 16n)|(BigInt(bytes[offset + 6]) << 8n)|BigInt(bytes[offset + 7])
    );
  }

  function store64BE(bytes, offset, value) {
    bytes[offset] = Number((value >> 56n)&0xFFn);
    bytes[offset + 1] = Number((value >> 48n)&0xFFn);
    bytes[offset + 2] = Number((value >> 40n)&0xFFn);
    bytes[offset + 3] = Number((value >> 32n)&0xFFn);
    bytes[offset + 4] = Number((value >> 24n)&0xFFn);
    bytes[offset + 5] = Number((value >> 16n)&0xFFn);
    bytes[offset + 6] = Number((value >> 8n)&0xFFn);
    bytes[offset + 7] = Number(value&0xFFn);
  }

  // ===== SimP-192 PERMUTATION (48-bit words, 26 rounds) =====

  class SimP192 {
    constructor() {
      this.state = new Array(SIMP_192_STATE_SIZE).fill(0);
    }

    loadState(bytes) {
      if (bytes.length !== SIMP_192_STATE_SIZE) {
        throw new Error('Invalid state size for SimP-192');
      }
      for (let i = 0; i < SIMP_192_STATE_SIZE; ++i) {
        this.state[i] = bytes[i];
      }
    }

    extractState() {
      return this.state.slice();
    }

    permute(steps) {
      let z = SIMP_RC;

      // Load state as four 48-bit words
      let x0 = load48BE(this.state, 0);
      let x1 = load48BE(this.state, 6);
      let x2 = load48BE(this.state, 12);
      let x3 = load48BE(this.state, 18);

      // Perform all steps
      for (let step = 0; step < steps; ++step) {
        // Perform all rounds for this step (two at a time)
        for (let round = 0; round < SIMP_192_ROUNDS / 2; ++round) {
          // First round of pair
          let t1 = x3^(rotl48(x2, 1)&rotl48(x2, 8))^rotl48(x2, 2)^x1;
          let t0 = x1^rotr48(x0, 3)^rotr48(x0, 4)^0x0000FFFFFFFFFFFCn^(z&1n);

          z = (z >> 1n)|(z << 61n); // Rotate round constant

          // Truncate to 48 bits
          t0 &= 0x0000FFFFFFFFFFFFn;
          t1 &= 0x0000FFFFFFFFFFFFn;

          // Second round of pair
          x2 = x2^(rotl48(t1, 1)&rotl48(t1, 8))^rotl48(t1, 2)^x0;
          x0 = x0^rotr48(t0, 3)^rotr48(t0, 4)^0x0000FFFFFFFFFFFCn^(z&1n);

          x0 &= 0x0000FFFFFFFFFFFFn;
          x2 &= 0x0000FFFFFFFFFFFFn;

          x1 = t0;
          x3 = t1;

          z = (z >> 1n)|(z << 61n); // Rotate round constant
        }

        // Swap words for all steps except the last
        // Reference: swap (x0,x2) and (x1,x3)
        if (step < steps - 1) {
          let temp0 = x0;
          let temp1 = x1;
          x0 = x2;
          x1 = x3;
          x2 = temp0;
          x3 = temp1;
        }
      }

      // Store state back
      store48BE(this.state, 0, x0);
      store48BE(this.state, 6, x1);
      store48BE(this.state, 12, x2);
      store48BE(this.state, 18, x3);
    }

    xorBytes(data, offset, length) {
      for (let i = 0; i < length; ++i) {
        this.state[i] = OpCodes.Xor32(this.state[i], data[offset + i]);
      }
    }

    xorByte(position, value) {
      this.state[position] = OpCodes.Xor32(this.state[position], value);
    }

    getBytes(offset, length) {
      return this.state.slice(offset, offset + length);
    }

    getMask() {
      return this.state.slice(SIMP_192_STATE_SIZE - ORIBATIDA_192_MASK_SIZE, SIMP_192_STATE_SIZE);
    }
  }

  // ===== SimP-256 PERMUTATION (64-bit words, 34 rounds) =====

  class SimP256 {
    constructor() {
      this.state = new Array(SIMP_256_STATE_SIZE).fill(0);
    }

    loadState(bytes) {
      if (bytes.length !== SIMP_256_STATE_SIZE) {
        throw new Error('Invalid state size for SimP-256');
      }
      for (let i = 0; i < SIMP_256_STATE_SIZE; ++i) {
        this.state[i] = bytes[i];
      }
    }

    extractState() {
      return this.state.slice();
    }

    permute(steps) {
      let z = SIMP_RC;

      // Load state as four 64-bit words
      let x0 = load64BE(this.state, 0);
      let x1 = load64BE(this.state, 8);
      let x2 = load64BE(this.state, 16);
      let x3 = load64BE(this.state, 24);

      // Perform all steps
      for (let step = 0; step < steps; ++step) {
        // Perform all rounds for this step (two at a time)
        for (let round = 0; round < SIMP_256_ROUNDS / 2; ++round) {
          // First round of pair
          let t1 = x3^(rotl64(x2, 1)&rotl64(x2, 8))^rotl64(x2, 2)^x1;
          let t0 = x1^rotr64(x0, 3)^rotr64(x0, 4)^0xFFFFFFFFFFFFFFFCn^(z&1n);

          z = (z >> 1n)|(z << 61n); // Rotate round constant

          // Second round of pair
          x2 = x2^(rotl64(t1, 1)&rotl64(t1, 8))^rotl64(t1, 2)^x0;
          x0 = x0^rotr64(t0, 3)^rotr64(t0, 4)^0xFFFFFFFFFFFFFFFCn^(z&1n);

          x1 = t0;
          x3 = t1;

          z = (z >> 1n)|(z << 61n); // Rotate round constant
        }

        // Swap words for all steps except the last
        if (step < steps - 1) {
          let temp0 = x0;
          let temp1 = x1;
          x0 = x2;
          x1 = x3;
          x2 = temp0;
          x3 = temp1;
        }
      }

      // Store state back
      store64BE(this.state, 0, x0);
      store64BE(this.state, 8, x1);
      store64BE(this.state, 16, x2);
      store64BE(this.state, 24, x3);
    }

    xorBytes(data, offset, length) {
      for (let i = 0; i < length; ++i) {
        this.state[i] = OpCodes.Xor32(this.state[i], data[offset + i]);
      }
    }

    xorByte(position, value) {
      this.state[position] = OpCodes.Xor32(this.state[position], value);
    }

    getBytes(offset, length) {
      return this.state.slice(offset, offset + length);
    }

    getMask() {
      return this.state.slice(SIMP_256_STATE_SIZE - ORIBATIDA_256_MASK_SIZE, SIMP_256_STATE_SIZE);
    }
  }

  // ===== DOMAIN SEPARATION FUNCTION (parameterized) =====

  function getDomains(adlen, mlen, RATE) {
    const domains = new Array(3);

    // Domain separation for nonce
    if (adlen === 0 && mlen === 0) {
      domains[ORIBATIDA_DOMAIN_NONCE] = 9;
    } else {
      domains[ORIBATIDA_DOMAIN_NONCE] = 5;
    }

    // Domain separation for associated data
    if (mlen === 0) {
      if (adlen % RATE === 0) {
        domains[ORIBATIDA_DOMAIN_AD] = 12;
      } else {
        domains[ORIBATIDA_DOMAIN_AD] = 14;
      }
    } else {
      if (adlen % RATE === 0) {
        domains[ORIBATIDA_DOMAIN_AD] = 4;
      } else {
        domains[ORIBATIDA_DOMAIN_AD] = 6;
      }
    }

    // Domain separation for message
    if (mlen % RATE === 0) {
      domains[ORIBATIDA_DOMAIN_MSG] = 13;
    } else {
      domains[ORIBATIDA_DOMAIN_MSG] = 15;
    }

    return domains;
  }

  // ===== ORIBATIDA-192-96 ALGORITHM =====

  /**
   * Oribatida-192-96 AEAD - Lightweight authenticated encryption
   * @class
   * @extends {AeadAlgorithm}
   */
  class Oribatida192_96 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Oribatida-192-96";
      this.description = "Lightweight AEAD cipher based on SimP-192 permutation (reduced-round Simon-96-96). Features 128-bit keys, 64-bit nonces, and 96-bit tags with masked ciphertext generation. Optimized for constrained environments.";
      this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(ORIBATIDA_192_KEY_SIZE, ORIBATIDA_192_KEY_SIZE, 1)];
      this.SupportedNonceSizes = [new KeySize(ORIBATIDA_192_NONCE_SIZE, ORIBATIDA_192_NONCE_SIZE, 1)];
      this.SupportedTagSizes = [new KeySize(ORIBATIDA_192_TAG_SIZE, ORIBATIDA_192_TAG_SIZE, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "Oribatida Official Website",
          "https://www.isical.ac.in/~lightweight/oribatida/"
        ),
        new LinkItem(
          "NIST LWC Round 2 Submission",
          "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists"
        ),
        new LinkItem(
          "SimP Permutation Specification",
          "https://eprint.iacr.org/2019/1492.pdf"
        )
      ];

      // Test vectors from NIST LWC KAT file
      this.tests = [
        {
          text: "NIST LWC KAT Count=1: Empty plaintext, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("83DCC3E7DF9986ADC38358CD")
        },
        {
          text: "NIST LWC KAT Count=2: Empty plaintext, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("2CA7F3D7AC0074E649A768A5")
        },
        {
          text: "NIST LWC KAT Count=46: 1-byte plaintext, 12-byte AD (full rate block)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("5DF32FD38E0D3E2A6482DD055D")
        },
        {
          text: "NIST LWC KAT Count=18: 0-byte plaintext, 13-byte AD (partial rate block)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("685C11CA5529E306030FD98F")
        },
        {
          text: "NIST LWC KAT Count=403: 12-byte plaintext (full rate block), 6-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("000102030405"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          expected: OpCodes.Hex8ToBytes("A1315D1F07AA2B5BFA676B5CBED7374A962CD217373CCE64")
        }
      ];
    }

    /**
     * Create new cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {Oribatida192_96Instance} New cipher instance
     */
    CreateInstance(isInverse = false) {
      return new Oribatida192_96Instance(this, isInverse);
    }
  }

  /**
   * Oribatida-192-96 cipher instance
   * @class
   * @extends {IAeadInstance}
   */
  class Oribatida192_96Instance extends IAeadInstance {
    /**
     * Initialize cipher instance
     * @param {Oribatida192_96} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this._inputBuffer = [];
    }

    /**
     * Set encryption/decryption key
     * @param {uint8[]|null} keyBytes - Encryption key or null to clear
     * @throws {Error} If key size is invalid
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== ORIBATIDA_192_KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${ORIBATIDA_192_KEY_SIZE})`);
      }
      this._key = keyBytes.slice();
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? this._key.slice() : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== ORIBATIDA_192_NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${ORIBATIDA_192_NONCE_SIZE})`);
      }
      this._nonce = nonceBytes.slice();
    }

    get nonce() {
      return this._nonce ? this._nonce.slice() : null;
    }

    set aad(adBytes) {
      this._aad = adBytes ? adBytes.slice() : [];
    }

    get aad() {
      return this._aad ? this._aad.slice() : [];
    }

    /**
     * Feed data for processing
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this._inputBuffer.push(...data);
    }

    /**
     * Get cipher result
     * @returns {uint8[]} Processed output bytes
     * @throws {Error} If key or nonce not set
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const result = this.isInverse
        ? this._decrypt(this._inputBuffer, this._aad)
        : this._encrypt(this._inputBuffer, this._aad);

      // Clear buffers
      this._inputBuffer = [];
      this._aad = [];

      return result;
    }

    _encrypt(plaintext, associatedData) {
      const mlen = plaintext.length;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, mlen, ORIBATIDA_192_RATE);

      const simp = new SimP192();
      const state = new Array(SIMP_192_STATE_SIZE).fill(0);

      for (let i = 0; i < ORIBATIDA_192_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      for (let i = 0; i < ORIBATIDA_192_KEY_SIZE; ++i) {
        state[ORIBATIDA_192_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);
      simp.permute(4);

      if (adlen > 0) {
        mask = simp.getMask();

        let adPos = 0;
        while (adlen - adPos > ORIBATIDA_192_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_192_RATE);
          simp.permute(2);
          adPos += ORIBATIDA_192_RATE;
        }

        const remaining = adlen - adPos;
        if (remaining === ORIBATIDA_192_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_192_RATE);
        } else {
          simp.xorBytes(associatedData, adPos, remaining);
          simp.xorByte(remaining, 0x80);
        }
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_AD]);
        simp.permute(4);
      }

      const ciphertext = [];
      let mPos = 0;

      while (mlen - mPos > ORIBATIDA_192_RATE) {
        const stateBytes = simp.getBytes(0, ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], plaintext[mPos + i]));
        }

        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_192_MASK_SIZE + i] = OpCodes.Xor32(ciphertext[ciphertext.length - ORIBATIDA_192_MASK_SIZE + i], mask[i]);
        }

        simp.xorBytes(plaintext, mPos, ORIBATIDA_192_RATE);
        mask = simp.getMask();
        simp.permute(4);

        mPos += ORIBATIDA_192_RATE;
      }

      const remaining = mlen - mPos;
      if (remaining === ORIBATIDA_192_RATE) {
        const stateBytes = simp.getBytes(0, ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], plaintext[mPos + i]));
        }
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_192_MASK_SIZE + i] = OpCodes.Xor32(ciphertext[ciphertext.length - ORIBATIDA_192_MASK_SIZE + i], mask[i]);
        }
        simp.xorBytes(plaintext, mPos, ORIBATIDA_192_RATE);
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      } else if (remaining > 0) {
        const stateBytes = simp.getBytes(0, remaining);
        for (let i = 0; i < remaining; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], plaintext[mPos + i]));
        }
        if (remaining > ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE) {
          const maskStart = ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            ciphertext[ciphertext.length - maskLen + i] = OpCodes.Xor32(ciphertext[ciphertext.length - maskLen + i], mask[i]);
          }
        }
        simp.xorBytes(plaintext, mPos, remaining);
        simp.xorByte(remaining, 0x80);
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      const tag = simp.getBytes(0, ORIBATIDA_192_TAG_SIZE);
      ciphertext.push(...tag);

      return ciphertext;
    }

    _decrypt(ciphertext, associatedData) {
      if (ciphertext.length < ORIBATIDA_192_TAG_SIZE) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      const clen = ciphertext.length - ORIBATIDA_192_TAG_SIZE;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, clen, ORIBATIDA_192_RATE);

      const simp = new SimP192();
      const state = new Array(SIMP_192_STATE_SIZE).fill(0);

      for (let i = 0; i < ORIBATIDA_192_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      for (let i = 0; i < ORIBATIDA_192_KEY_SIZE; ++i) {
        state[ORIBATIDA_192_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);
      simp.permute(4);

      if (adlen > 0) {
        mask = simp.getMask();

        let adPos = 0;
        while (adlen - adPos > ORIBATIDA_192_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_192_RATE);
          simp.permute(2);
          adPos += ORIBATIDA_192_RATE;
        }

        const remaining = adlen - adPos;
        if (remaining === ORIBATIDA_192_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_192_RATE);
        } else {
          simp.xorBytes(associatedData, adPos, remaining);
          simp.xorByte(remaining, 0x80);
        }
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_AD]);
        simp.permute(4);
      }

      const plaintext = [];
      let cPos = 0;

      while (clen - cPos > ORIBATIDA_192_RATE) {
        const block = new Array(ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          block[ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE + i] = OpCodes.Xor32(block[ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE + i], mask[i]);
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          plaintext.push(OpCodes.Xor32(stateBytes[i], block[i]));
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);

        mask = simp.getMask();
        simp.permute(4);

        cPos += ORIBATIDA_192_RATE;
      }

      const remaining = clen - cPos;
      if (remaining === ORIBATIDA_192_RATE) {
        const block = new Array(ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          block[ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE + i] = OpCodes.Xor32(block[ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE + i], mask[i]);
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          plaintext.push(OpCodes.Xor32(stateBytes[i], block[i]));
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      } else if (remaining > 0) {
        const block = new Array(remaining);
        for (let i = 0; i < remaining; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        if (remaining > ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE) {
          const maskStart = ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            block[maskStart + i] = OpCodes.Xor32(block[maskStart + i], mask[i]);
          }
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < remaining; ++i) {
          plaintext.push(OpCodes.Xor32(stateBytes[i], block[i]));
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);
        simp.xorByte(remaining, 0x80);
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      const computedTag = simp.getBytes(0, ORIBATIDA_192_TAG_SIZE);
      const receivedTag = ciphertext.slice(clen, clen + ORIBATIDA_192_TAG_SIZE);

      let tagMatch = 0;
      for (let i = 0; i < ORIBATIDA_192_TAG_SIZE; ++i) {
        tagMatch = OpCodes.Or32(tagMatch, OpCodes.Xor32(computedTag[i], receivedTag[i]));
      }

      if (tagMatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }
  }

  // ===== ORIBATIDA-256-64 ALGORITHM =====

  /**
   * Oribatida-256-64 AEAD - Lightweight authenticated encryption
   * @class
   * @extends {AeadAlgorithm}
   */
  class Oribatida256_64 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Oribatida-256-64";
      this.description = "Lightweight AEAD cipher based on SimP-256 permutation (reduced-round Simon-128-128). Features 128-bit keys, 128-bit nonces, and 128-bit tags with masked ciphertext generation. The '64' indicates 64-bit security level.";
      this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(ORIBATIDA_256_KEY_SIZE, ORIBATIDA_256_KEY_SIZE, 1)];
      this.SupportedNonceSizes = [new KeySize(ORIBATIDA_256_NONCE_SIZE, ORIBATIDA_256_NONCE_SIZE, 1)];
      this.SupportedTagSizes = [new KeySize(ORIBATIDA_256_TAG_SIZE, ORIBATIDA_256_TAG_SIZE, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "Oribatida Official Website",
          "https://www.isical.ac.in/~lightweight/oribatida/"
        ),
        new LinkItem(
          "NIST LWC Round 2 Submission",
          "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists"
        ),
        new LinkItem(
          "SimP Permutation Specification",
          "https://eprint.iacr.org/2019/1492.pdf"
        )
      ];

      // Test vectors from NIST LWC KAT file
      this.tests = [
        {
          text: "NIST LWC KAT Count=1: Empty plaintext, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("21065EB73FFF09A323253F97971A1167")
        },
        {
          text: "NIST LWC KAT Count=34: 1-byte plaintext, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("56F962072AC37ED49DFB53977F2092993B")
        },
        {
          text: "NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("2F246A9091E193F0807F525D247B352EA2")
        },
        {
          text: "NIST LWC KAT Count=50: 1-byte plaintext, 16-byte AD (full block)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("C9F8E6974574513FB8E5BC6BF1716FC391")
        },
        {
          text: "NIST LWC KAT Count=172: 5-byte plaintext, 6-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("000102030405"),
          input: OpCodes.Hex8ToBytes("0001020304"),
          expected: OpCodes.Hex8ToBytes("10BEC53B7C7089EE95475257F9CAED015A8064E4B7")
        }
      ];
    }

    /**
     * Create new cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {Oribatida256_64Instance} New cipher instance
     */
    CreateInstance(isInverse = false) {
      return new Oribatida256_64Instance(this, isInverse);
    }
  }

  /**
   * Oribatida-256-64 cipher instance
   * @class
   * @extends {IAeadInstance}
   */
  class Oribatida256_64Instance extends IAeadInstance {
    /**
     * Initialize cipher instance
     * @param {Oribatida256_64} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this._inputBuffer = [];
    }

    /**
     * Set encryption/decryption key
     * @param {uint8[]|null} keyBytes - Encryption key or null to clear
     * @throws {Error} If key size is invalid
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== ORIBATIDA_256_KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${ORIBATIDA_256_KEY_SIZE})`);
      }
      this._key = keyBytes.slice();
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? this._key.slice() : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== ORIBATIDA_256_NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${ORIBATIDA_256_NONCE_SIZE})`);
      }
      this._nonce = nonceBytes.slice();
    }

    get nonce() {
      return this._nonce ? this._nonce.slice() : null;
    }

    set aad(adBytes) {
      this._aad = adBytes ? adBytes.slice() : [];
    }

    get aad() {
      return this._aad ? this._aad.slice() : [];
    }

    /**
     * Feed data for processing
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this._inputBuffer.push(...data);
    }

    /**
     * Get cipher result
     * @returns {uint8[]} Processed output bytes
     * @throws {Error} If key or nonce not set
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const result = this.isInverse
        ? this._decrypt(this._inputBuffer, this._aad)
        : this._encrypt(this._inputBuffer, this._aad);

      // Clear buffers
      this._inputBuffer = [];
      this._aad = [];

      return result;
    }

    _encrypt(plaintext, associatedData) {
      const mlen = plaintext.length;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, mlen, ORIBATIDA_256_RATE);

      const simp = new SimP256();
      const state = new Array(SIMP_256_STATE_SIZE);

      for (let i = 0; i < ORIBATIDA_256_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      for (let i = 0; i < ORIBATIDA_256_KEY_SIZE; ++i) {
        state[ORIBATIDA_256_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);
      simp.permute(4);

      if (adlen > 0) {
        mask = simp.getMask();

        let adPos = 0;
        while (adlen - adPos > ORIBATIDA_256_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_256_RATE);
          simp.permute(2);
          adPos += ORIBATIDA_256_RATE;
        }

        const remaining = adlen - adPos;
        if (remaining === ORIBATIDA_256_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_256_RATE);
        } else {
          simp.xorBytes(associatedData, adPos, remaining);
          simp.xorByte(remaining, 0x80);
        }
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_AD]);
        simp.permute(4);
      }

      const ciphertext = [];
      let mPos = 0;

      while (mlen - mPos > ORIBATIDA_256_RATE) {
        const stateBytes = simp.getBytes(0, ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], plaintext[mPos + i]));
        }

        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_256_MASK_SIZE + i] = OpCodes.Xor32(ciphertext[ciphertext.length - ORIBATIDA_256_MASK_SIZE + i], mask[i]);
        }

        simp.xorBytes(plaintext, mPos, ORIBATIDA_256_RATE);
        mask = simp.getMask();
        simp.permute(4);

        mPos += ORIBATIDA_256_RATE;
      }

      const remaining = mlen - mPos;
      if (remaining === ORIBATIDA_256_RATE) {
        const stateBytes = simp.getBytes(0, ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], plaintext[mPos + i]));
        }
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_256_MASK_SIZE + i] = OpCodes.Xor32(ciphertext[ciphertext.length - ORIBATIDA_256_MASK_SIZE + i], mask[i]);
        }
        simp.xorBytes(plaintext, mPos, ORIBATIDA_256_RATE);
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      } else if (remaining > 0) {
        const stateBytes = simp.getBytes(0, remaining);
        for (let i = 0; i < remaining; ++i) {
          ciphertext.push(OpCodes.Xor32(stateBytes[i], plaintext[mPos + i]));
        }
        if (remaining > ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE) {
          const maskStart = ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            ciphertext[ciphertext.length - maskLen + i] = OpCodes.Xor32(ciphertext[ciphertext.length - maskLen + i], mask[i]);
          }
        }
        simp.xorBytes(plaintext, mPos, remaining);
        simp.xorByte(remaining, 0x80);
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      const tag = simp.getBytes(0, ORIBATIDA_256_TAG_SIZE);
      ciphertext.push(...tag);

      return ciphertext;
    }

    _decrypt(ciphertext, associatedData) {
      if (ciphertext.length < ORIBATIDA_256_TAG_SIZE) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      const clen = ciphertext.length - ORIBATIDA_256_TAG_SIZE;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, clen, ORIBATIDA_256_RATE);

      const simp = new SimP256();
      const state = new Array(SIMP_256_STATE_SIZE);

      for (let i = 0; i < ORIBATIDA_256_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      for (let i = 0; i < ORIBATIDA_256_KEY_SIZE; ++i) {
        state[ORIBATIDA_256_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);
      simp.permute(4);

      if (adlen > 0) {
        mask = simp.getMask();

        let adPos = 0;
        while (adlen - adPos > ORIBATIDA_256_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_256_RATE);
          simp.permute(2);
          adPos += ORIBATIDA_256_RATE;
        }

        const remaining = adlen - adPos;
        if (remaining === ORIBATIDA_256_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_256_RATE);
        } else {
          simp.xorBytes(associatedData, adPos, remaining);
          simp.xorByte(remaining, 0x80);
        }
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_AD]);
        simp.permute(4);
      }

      const plaintext = [];
      let cPos = 0;

      while (clen - cPos > ORIBATIDA_256_RATE) {
        const block = new Array(ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          block[ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE + i] = OpCodes.Xor32(block[ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE + i], mask[i]);
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          plaintext.push(OpCodes.Xor32(stateBytes[i], block[i]));
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);

        mask = simp.getMask();
        simp.permute(4);

        cPos += ORIBATIDA_256_RATE;
      }

      const remaining = clen - cPos;
      if (remaining === ORIBATIDA_256_RATE) {
        const block = new Array(ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          block[ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE + i] = OpCodes.Xor32(block[ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE + i], mask[i]);
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          plaintext.push(OpCodes.Xor32(stateBytes[i], block[i]));
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      } else if (remaining > 0) {
        const block = new Array(remaining);
        for (let i = 0; i < remaining; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        if (remaining > ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE) {
          const maskStart = ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            block[maskStart + i] = OpCodes.Xor32(block[maskStart + i], mask[i]);
          }
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < remaining; ++i) {
          plaintext.push(OpCodes.Xor32(stateBytes[i], block[i]));
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);
        simp.xorByte(remaining, 0x80);
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      const computedTag = simp.getBytes(0, ORIBATIDA_256_TAG_SIZE);
      const receivedTag = ciphertext.slice(clen, clen + ORIBATIDA_256_TAG_SIZE);

      let tagMatch = 0;
      for (let i = 0; i < ORIBATIDA_256_TAG_SIZE; ++i) {
        tagMatch = OpCodes.Or32(tagMatch, OpCodes.Xor32(computedTag[i], receivedTag[i]));
      }

      if (tagMatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }
  }

  // ===== REGISTRATION =====

  RegisterAlgorithm(new Oribatida192_96());
  RegisterAlgorithm(new Oribatida256_64());

  return { Oribatida192_96, Oribatida256_64, Oribatida192_96Instance, Oribatida256_64Instance };
}));
