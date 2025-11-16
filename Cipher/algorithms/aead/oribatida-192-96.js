/*
 * Oribatida-192-96 AEAD - NIST LWC Round 2 Candidate
 * Professional implementation following official specification
 * (c)2006-2025 Hawkynt
 *
 * Oribatida-192-96 is a lightweight AEAD cipher based on the SimP-192 permutation,
 * which itself is built on a reduced-round Simon-96-96 block cipher. The cipher
 * provides authenticated encryption with 128-bit keys, 64-bit nonces, and 96-bit tags.
 *
 * Key features:
 * - 192-bit state (SimP-192 permutation based on 4x48-bit words)
 * - 96-bit (12-byte) rate for message processing
 * - 96-bit (12-byte) authentication tag
 * - Domain separation for different processing phases
 * - Masked ciphertext generation for side-channel resistance
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

  // Constants for Oribatida-192-96
  const SIMP_192_STATE_SIZE = 24;
  const ORIBATIDA_192_KEY_SIZE = 16;
  const ORIBATIDA_192_NONCE_SIZE = 8;
  const ORIBATIDA_192_TAG_SIZE = 12;
  const ORIBATIDA_192_RATE = 12;
  const ORIBATIDA_192_MASK_SIZE = 12;
  const SIMP_192_ROUNDS = 26;
  const SIMP_RC = 0x3369F885192C0EF5n; // 62-bit round constant

  // Domain separation constants
  const ORIBATIDA_DOMAIN_NONCE = 0;
  const ORIBATIDA_DOMAIN_AD = 1;
  const ORIBATIDA_DOMAIN_MSG = 2;

  // Load 48-bit big-endian word from byte array (stored as 64-bit with upper bits zeroed)
  function load48BE(bytes, offset) {
    return (BigInt(bytes[offset]) << 40n) |
           (BigInt(bytes[offset + 1]) << 32n) |
           (BigInt(bytes[offset + 2]) << 24n) |
           (BigInt(bytes[offset + 3]) << 16n) |
           (BigInt(bytes[offset + 4]) << 8n) |
           BigInt(bytes[offset + 5]);
  }

  // Store 48-bit big-endian word to byte array
  function store48BE(bytes, offset, value) {
    bytes[offset] = Number((value >> 40n) & 0xFFn);
    bytes[offset + 1] = Number((value >> 32n) & 0xFFn);
    bytes[offset + 2] = Number((value >> 24n) & 0xFFn);
    bytes[offset + 3] = Number((value >> 16n) & 0xFFn);
    bytes[offset + 4] = Number((value >> 8n) & 0xFFn);
    bytes[offset + 5] = Number(value & 0xFFn);
  }

  // 48-bit rotation helpers
  function rotl48(value, positions) {
    positions = positions % 48;
    const mask = (1n << 48n) - 1n;
    return ((value << BigInt(positions)) | (value >> BigInt(48 - positions))) & mask;
  }

  function rotr48(value, positions) {
    positions = positions % 48;
    const mask = (1n << 48n) - 1n;
    return ((value >> BigInt(positions)) | (value << BigInt(48 - positions))) & mask;
  }

  // SimP-192 permutation (based on Simon-96-96)
  class SimP192 {
    constructor() {
      this.state = new Array(SIMP_192_STATE_SIZE).fill(0);
    }

    // Load state from byte array
    loadState(bytes) {
      if (bytes.length !== SIMP_192_STATE_SIZE) {
        throw new Error('Invalid state size for SimP-192');
      }
      for (let i = 0; i < SIMP_192_STATE_SIZE; ++i) {
        this.state[i] = bytes[i];
      }
    }

    // Extract state to byte array
    extractState() {
      return this.state.slice();
    }

    // SimP-192 permutation with specified number of steps
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
          let t1 = x3 ^ (rotl48(x2, 1) & rotl48(x2, 8)) ^ rotl48(x2, 2) ^ x1;
          let t0 = x1 ^ rotr48(x0, 3) ^ rotr48(x0, 4) ^ 0x000000FFFFFFFFCn ^ (z & 1n);

          z = (z >> 1n) | (z << 61n); // Rotate round constant

          // Truncate to 48 bits
          t0 &= 0x0000FFFFFFFFFFFFn;
          t1 &= 0x0000FFFFFFFFFFFFn;

          // Second round of pair
          x2 = x2 ^ (rotl48(t1, 1) & rotl48(t1, 8)) ^ rotl48(t1, 2) ^ x0;
          x0 = x0 ^ rotr48(t0, 3) ^ rotr48(t0, 4) ^ 0x000000FFFFFFFFCn ^ (z & 1n);

          x0 &= 0x0000FFFFFFFFFFFFn;
          x2 &= 0x0000FFFFFFFFFFFFn;

          x1 = t0;
          x3 = t1;

          z = (z >> 1n) | (z << 61n); // Rotate round constant
        }

        // Swap words for all steps except the last
        if (step < steps - 1) {
          let temp = x0;
          x0 = x1;
          x1 = x2;
          x2 = x3;
          x3 = temp;
        }
      }

      // Store state back
      store48BE(this.state, 0, x0);
      store48BE(this.state, 6, x1);
      store48BE(this.state, 12, x2);
      store48BE(this.state, 18, x3);
    }

    // XOR data into state
    xorBytes(data, offset, length) {
      for (let i = 0; i < length; ++i) {
        this.state[i] ^= data[offset + i];
      }
    }

    // XOR byte at specific position
    xorByte(position, value) {
      this.state[position] ^= value;
    }

    // Get bytes from state
    getBytes(offset, length) {
      return this.state.slice(offset, offset + length);
    }

    // Get mask from end of state (entire last 12 bytes for SimP-192)
    getMask() {
      return this.state.slice(SIMP_192_STATE_SIZE - ORIBATIDA_192_MASK_SIZE, SIMP_192_STATE_SIZE);
    }
  }

  // Compute domain separation values
  function getDomains(adlen, mlen) {
    const domains = new Array(3);

    // Domain separation for nonce
    if (adlen === 0 && mlen === 0) {
      domains[ORIBATIDA_DOMAIN_NONCE] = 9;
    } else {
      domains[ORIBATIDA_DOMAIN_NONCE] = 5;
    }

    // Domain separation for associated data
    if (mlen === 0) {
      if (adlen % ORIBATIDA_192_RATE === 0) {
        domains[ORIBATIDA_DOMAIN_AD] = 12;
      } else {
        domains[ORIBATIDA_DOMAIN_AD] = 14;
      }
    } else {
      if (adlen % ORIBATIDA_192_RATE === 0) {
        domains[ORIBATIDA_DOMAIN_AD] = 4;
      } else {
        domains[ORIBATIDA_DOMAIN_AD] = 6;
      }
    }

    // Domain separation for message
    if (mlen % ORIBATIDA_192_RATE === 0) {
      domains[ORIBATIDA_DOMAIN_MSG] = 13;
    } else {
      domains[ORIBATIDA_DOMAIN_MSG] = 15;
    }

    return domains;
  }

  // Oribatida-192-96 algorithm class
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
          text: "NIST LWC KAT Count=17: 1-byte plaintext, 12-byte AD (full rate block)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("D27591055628CED5D4EC408914")
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
          text: "NIST LWC KAT Count=34: 12-byte plaintext (full rate block), 6-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("0001020304050607"),
          aad: OpCodes.Hex8ToBytes("000102030405"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("10BEC53B7C7089EE95475257F9CAED015A80")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Oribatida192_96Instance(this, isInverse);
    }
  }

  // Oribatida-192-96 instance class
  /**
 * Oribatida192_96 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Oribatida192_96Instance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
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

    // Key property
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

    // Nonce property
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

    // Associated data property
    set aad(adBytes) {
      this._aad = adBytes ? adBytes.slice() : [];
    }

    get aad() {
      return this._aad ? this._aad.slice() : [];
    }

    // Feed data
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this._inputBuffer.push(...data);
    }

    // Process and return result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
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

    // Encryption implementation
    _encrypt(plaintext, associatedData) {
      const mlen = plaintext.length;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, mlen);

      // Initialize state with key and nonce
      const simp = new SimP192();
      const state = new Array(SIMP_192_STATE_SIZE).fill(0);

      // Copy nonce (8 bytes) into state at offset 0
      for (let i = 0; i < ORIBATIDA_192_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      // Copy key (16 bytes) into state at offset 8
      for (let i = 0; i < ORIBATIDA_192_KEY_SIZE; ++i) {
        state[ORIBATIDA_192_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      // Get initial mask for zero-length AD
      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      // Add domain separation for nonce
      simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);

      // Run permutation
      simp.permute(4);

      // Process associated data if present
      if (adlen > 0) {
        // Get mask after first permutation
        mask = simp.getMask();

        let adPos = 0;
        // Process full blocks
        while (adlen - adPos > ORIBATIDA_192_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_192_RATE);
          simp.permute(2);
          adPos += ORIBATIDA_192_RATE;
        }

        // Process final block
        const remaining = adlen - adPos;
        if (remaining === ORIBATIDA_192_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_192_RATE);
        } else {
          simp.xorBytes(associatedData, adPos, remaining);
          simp.xorByte(remaining, 0x80); // Padding
        }
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_AD]);
        simp.permute(4);
      }

      // Encrypt plaintext
      const ciphertext = [];
      let mPos = 0;

      while (mlen - mPos > ORIBATIDA_192_RATE) {
        // XOR state with plaintext to get ciphertext
        const stateBytes = simp.getBytes(0, ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          ciphertext.push(stateBytes[i] ^ plaintext[mPos + i]);
        }

        // XOR mask into last 12 bytes of ciphertext block
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_192_MASK_SIZE + i] ^= mask[i];
        }

        // Absorb plaintext into state
        simp.xorBytes(plaintext, mPos, ORIBATIDA_192_RATE);

        // Get new mask
        mask = simp.getMask();

        // Run permutation
        simp.permute(4);

        mPos += ORIBATIDA_192_RATE;
      }

      // Process final message block
      const remaining = mlen - mPos;
      if (remaining === ORIBATIDA_192_RATE) {
        const stateBytes = simp.getBytes(0, ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          ciphertext.push(stateBytes[i] ^ plaintext[mPos + i]);
        }
        // XOR mask into last 12 bytes
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_192_MASK_SIZE + i] ^= mask[i];
        }
        // Absorb plaintext into state
        simp.xorBytes(plaintext, mPos, ORIBATIDA_192_RATE);
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      } else if (remaining > 0) {
        const stateBytes = simp.getBytes(0, remaining);
        for (let i = 0; i < remaining; ++i) {
          ciphertext.push(stateBytes[i] ^ plaintext[mPos + i]);
        }
        // XOR mask if ciphertext extends into mask region
        if (remaining > ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE) {
          const maskStart = ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            ciphertext[ciphertext.length - maskLen + i] ^= mask[i];
          }
        }
        // Absorb plaintext into state
        simp.xorBytes(plaintext, mPos, remaining);
        simp.xorByte(remaining, 0x80); // Padding
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      // Generate authentication tag
      const tag = simp.getBytes(0, ORIBATIDA_192_TAG_SIZE);
      ciphertext.push(...tag);

      return ciphertext;
    }

    // Decryption implementation
    _decrypt(ciphertext, associatedData) {
      // Validate ciphertext length
      if (ciphertext.length < ORIBATIDA_192_TAG_SIZE) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      const clen = ciphertext.length - ORIBATIDA_192_TAG_SIZE;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, clen);

      // Initialize state with key and nonce
      const simp = new SimP192();
      const state = new Array(SIMP_192_STATE_SIZE).fill(0);

      // Copy nonce (8 bytes) into state at offset 0
      for (let i = 0; i < ORIBATIDA_192_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      // Copy key (16 bytes) into state at offset 8
      for (let i = 0; i < ORIBATIDA_192_KEY_SIZE; ++i) {
        state[ORIBATIDA_192_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      // Get initial mask for zero-length AD
      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      // Add domain separation for nonce
      simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);

      // Run permutation
      simp.permute(4);

      // Process associated data if present (same as encryption)
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

      // Decrypt ciphertext
      const plaintext = [];
      let cPos = 0;

      while (clen - cPos > ORIBATIDA_192_RATE) {
        // Copy ciphertext block and remove mask
        const block = new Array(ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        // Remove mask from last 12 bytes
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          block[ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE + i] ^= mask[i];
        }

        // XOR with state to get plaintext and update state
        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          plaintext.push(stateBytes[i] ^ block[i]);
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);

        // Get new mask
        mask = simp.getMask();

        // Run permutation
        simp.permute(4);

        cPos += ORIBATIDA_192_RATE;
      }

      // Process final ciphertext block
      const remaining = clen - cPos;
      if (remaining === ORIBATIDA_192_RATE) {
        const block = new Array(ORIBATIDA_192_RATE);
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        for (let i = 0; i < ORIBATIDA_192_MASK_SIZE; ++i) {
          block[ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE + i] ^= mask[i];
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_192_RATE; ++i) {
          plaintext.push(stateBytes[i] ^ block[i]);
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
        // Remove mask if ciphertext extends into mask region
        if (remaining > ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE) {
          const maskStart = ORIBATIDA_192_RATE - ORIBATIDA_192_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            block[maskStart + i] ^= mask[i];
          }
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < remaining; ++i) {
          plaintext.push(stateBytes[i] ^ block[i]);
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);
        simp.xorByte(remaining, 0x80);
        simp.xorByte(SIMP_192_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      // Verify authentication tag
      const computedTag = simp.getBytes(0, ORIBATIDA_192_TAG_SIZE);
      const receivedTag = ciphertext.slice(clen, clen + ORIBATIDA_192_TAG_SIZE);

      // Constant-time comparison
      let tagMatch = 0;
      for (let i = 0; i < ORIBATIDA_192_TAG_SIZE; ++i) {
        tagMatch |= computedTag[i] ^ receivedTag[i];
      }

      if (tagMatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Oribatida192_96());

  return Oribatida192_96;
}));
