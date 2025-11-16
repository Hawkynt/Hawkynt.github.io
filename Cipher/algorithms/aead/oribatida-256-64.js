/*
 * Oribatida-256-64 AEAD - NIST LWC Round 2 Candidate
 * Professional implementation following official specification
 * (c)2006-2025 Hawkynt
 *
 * Oribatida-256-64 is a lightweight AEAD cipher based on the SimP-256 permutation,
 * which itself is built on a reduced-round Simon-128-128 block cipher. The cipher
 * provides authenticated encryption with 128-bit keys, 128-bit nonces, and 64-bit tags.
 *
 * Key features:
 * - 256-bit state (SimP-256 permutation)
 * - 128-bit (16-byte) rate for message processing
 * - 64-bit (8-byte) authentication tag
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

  // Constants for Oribatida-256-64
  const SIMP_256_STATE_SIZE = 32;
  const ORIBATIDA_256_KEY_SIZE = 16;
  const ORIBATIDA_256_NONCE_SIZE = 16;
  const ORIBATIDA_256_TAG_SIZE = 16; // 128-bit tag
  const ORIBATIDA_256_RATE = 16;
  const ORIBATIDA_256_MASK_SIZE = 8;
  const SIMP_256_ROUNDS = 34;
  const SIMP_RC = 0x3369F885192C0EF5n; // 62-bit round constant

  // Domain separation constants
  const ORIBATIDA_DOMAIN_NONCE = 0;
  const ORIBATIDA_DOMAIN_AD = 1;
  const ORIBATIDA_DOMAIN_MSG = 2;

  // 64-bit rotation helpers using BigInt
  function rotl64(value, positions) {
    positions = positions % 64;
    if (positions === 0) return value;
    const mask = (1n << 64n) - 1n;
    return ((value << BigInt(positions)) | (value >> BigInt(64 - positions))) & mask;
  }

  function rotr64(value, positions) {
    positions = positions % 64;
    if (positions === 0) return value;
    const mask = (1n << 64n) - 1n;
    return ((value >> BigInt(positions)) | (value << BigInt(64 - positions))) & mask;
  }

  // Load 64-bit big-endian word from byte array
  function load64BE(bytes, offset) {
    return (
      (BigInt(bytes[offset]) << 56n) |
      (BigInt(bytes[offset + 1]) << 48n) |
      (BigInt(bytes[offset + 2]) << 40n) |
      (BigInt(bytes[offset + 3]) << 32n) |
      (BigInt(bytes[offset + 4]) << 24n) |
      (BigInt(bytes[offset + 5]) << 16n) |
      (BigInt(bytes[offset + 6]) << 8n) |
      BigInt(bytes[offset + 7])
    );
  }

  // Store 64-bit big-endian word to byte array
  function store64BE(bytes, offset, value) {
    bytes[offset] = Number((value >> 56n) & 0xFFn);
    bytes[offset + 1] = Number((value >> 48n) & 0xFFn);
    bytes[offset + 2] = Number((value >> 40n) & 0xFFn);
    bytes[offset + 3] = Number((value >> 32n) & 0xFFn);
    bytes[offset + 4] = Number((value >> 24n) & 0xFFn);
    bytes[offset + 5] = Number((value >> 16n) & 0xFFn);
    bytes[offset + 6] = Number((value >> 8n) & 0xFFn);
    bytes[offset + 7] = Number(value & 0xFFn);
  }

  // SimP-256 permutation (based on Simon-128-128)
  class SimP256 {
    constructor() {
      this.state = new Array(SIMP_256_STATE_SIZE).fill(0);
    }

    // Load state from byte array
    loadState(bytes) {
      if (bytes.length !== SIMP_256_STATE_SIZE) {
        throw new Error('Invalid state size for SimP-256');
      }
      for (let i = 0; i < SIMP_256_STATE_SIZE; ++i) {
        this.state[i] = bytes[i];
      }
    }

    // Extract state to byte array
    extractState() {
      return this.state.slice();
    }

    // SimP-256 permutation with specified number of steps
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
          let t1 = x3 ^ (rotl64(x2, 1) & rotl64(x2, 8)) ^ rotl64(x2, 2) ^ x1;
          let t0 = x1 ^ rotr64(x0, 3) ^ rotr64(x0, 4) ^ 0xFFFFFFFFFFFFFFFCn ^ (z & 1n);

          z = (z >> 1n) | (z << 61n); // Rotate round constant

          // Second round of pair
          x2 = x2 ^ (rotl64(t1, 1) & rotl64(t1, 8)) ^ rotl64(t1, 2) ^ x0;
          x0 = x0 ^ rotr64(t0, 3) ^ rotr64(t0, 4) ^ 0xFFFFFFFFFFFFFFFCn ^ (z & 1n);

          x1 = t0;
          x3 = t1;

          z = (z >> 1n) | (z << 61n); // Rotate round constant
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

    // Get mask from end of state
    getMask() {
      return this.state.slice(SIMP_256_STATE_SIZE - ORIBATIDA_256_MASK_SIZE, SIMP_256_STATE_SIZE);
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
      if (adlen % ORIBATIDA_256_RATE === 0) {
        domains[ORIBATIDA_DOMAIN_AD] = 12;
      } else {
        domains[ORIBATIDA_DOMAIN_AD] = 14;
      }
    } else {
      if (adlen % ORIBATIDA_256_RATE === 0) {
        domains[ORIBATIDA_DOMAIN_AD] = 4;
      } else {
        domains[ORIBATIDA_DOMAIN_AD] = 6;
      }
    }

    // Domain separation for message
    if (mlen % ORIBATIDA_256_RATE === 0) {
      domains[ORIBATIDA_DOMAIN_MSG] = 13;
    } else {
      domains[ORIBATIDA_DOMAIN_MSG] = 15;
    }

    return domains;
  }

  // Oribatida-256-64 algorithm class
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
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Oribatida256_64Instance(this, isInverse);
    }
  }

  // Oribatida-256-64 instance class
  /**
 * Oribatida256_64 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Oribatida256_64Instance extends IAeadInstance {
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

    // Nonce property
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
      const simp = new SimP256();
      const state = new Array(SIMP_256_STATE_SIZE);

      // Copy nonce and key into state
      for (let i = 0; i < ORIBATIDA_256_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      for (let i = 0; i < ORIBATIDA_256_KEY_SIZE; ++i) {
        state[ORIBATIDA_256_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      // Get initial mask for zero-length AD
      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      // Add domain separation for nonce
      simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);

      // Run permutation
      simp.permute(4);

      // Process associated data if present
      if (adlen > 0) {
        // Get mask after first permutation
        mask = simp.getMask();

        let adPos = 0;
        // Process full blocks
        while (adlen - adPos > ORIBATIDA_256_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_256_RATE);
          simp.permute(2);
          adPos += ORIBATIDA_256_RATE;
        }

        // Process final block
        const remaining = adlen - adPos;
        if (remaining === ORIBATIDA_256_RATE) {
          simp.xorBytes(associatedData, adPos, ORIBATIDA_256_RATE);
        } else {
          simp.xorBytes(associatedData, adPos, remaining);
          simp.xorByte(remaining, 0x80); // Padding
        }
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_AD]);
        simp.permute(4);
      }

      // Encrypt plaintext
      const ciphertext = [];
      let mPos = 0;

      while (mlen - mPos > ORIBATIDA_256_RATE) {
        // XOR state with plaintext to get ciphertext
        const stateBytes = simp.getBytes(0, ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          ciphertext.push(stateBytes[i] ^ plaintext[mPos + i]);
        }

        // XOR mask into last 8 bytes of ciphertext block
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_256_MASK_SIZE + i] ^= mask[i];
        }

        // Absorb plaintext into state
        simp.xorBytes(plaintext, mPos, ORIBATIDA_256_RATE);

        // Get new mask
        mask = simp.getMask();

        // Run permutation
        simp.permute(4);

        mPos += ORIBATIDA_256_RATE;
      }

      // Process final message block
      const remaining = mlen - mPos;
      if (remaining === ORIBATIDA_256_RATE) {
        const stateBytes = simp.getBytes(0, ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          ciphertext.push(stateBytes[i] ^ plaintext[mPos + i]);
        }
        // XOR mask into last 8 bytes
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          ciphertext[ciphertext.length - ORIBATIDA_256_MASK_SIZE + i] ^= mask[i];
        }
        // Absorb plaintext into state
        simp.xorBytes(plaintext, mPos, ORIBATIDA_256_RATE);
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      } else if (remaining > 0) {
        const stateBytes = simp.getBytes(0, remaining);
        for (let i = 0; i < remaining; ++i) {
          ciphertext.push(stateBytes[i] ^ plaintext[mPos + i]);
        }
        // XOR mask if ciphertext extends into mask region
        if (remaining > ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE) {
          const maskStart = ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE;
          const maskLen = remaining - maskStart;
          for (let i = 0; i < maskLen; ++i) {
            ciphertext[ciphertext.length - maskLen + i] ^= mask[i];
          }
        }
        // Absorb plaintext into state
        simp.xorBytes(plaintext, mPos, remaining);
        simp.xorByte(remaining, 0x80); // Padding
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      // Generate authentication tag
      const tag = simp.getBytes(0, ORIBATIDA_256_TAG_SIZE);
      ciphertext.push(...tag);

      return ciphertext;
    }

    // Decryption implementation
    _decrypt(ciphertext, associatedData) {
      // Validate ciphertext length
      if (ciphertext.length < ORIBATIDA_256_TAG_SIZE) {
        throw new Error("Invalid ciphertext: too short for authentication tag");
      }

      const clen = ciphertext.length - ORIBATIDA_256_TAG_SIZE;
      const adlen = associatedData.length;
      const domains = getDomains(adlen, clen);

      // Initialize state with key and nonce
      const simp = new SimP256();
      const state = new Array(SIMP_256_STATE_SIZE);

      // Copy nonce and key into state
      for (let i = 0; i < ORIBATIDA_256_NONCE_SIZE; ++i) {
        state[i] = this._nonce[i];
      }
      for (let i = 0; i < ORIBATIDA_256_KEY_SIZE; ++i) {
        state[ORIBATIDA_256_NONCE_SIZE + i] = this._key[i];
      }

      simp.loadState(state);

      // Get initial mask for zero-length AD
      let mask;
      if (adlen === 0) {
        mask = simp.getMask();
      }

      // Add domain separation for nonce
      simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_NONCE]);

      // Run permutation
      simp.permute(4);

      // Process associated data if present (same as encryption)
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

      // Decrypt ciphertext
      const plaintext = [];
      let cPos = 0;

      while (clen - cPos > ORIBATIDA_256_RATE) {
        // Copy ciphertext block and remove mask
        const block = new Array(ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        // Remove mask from last 8 bytes
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          block[ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE + i] ^= mask[i];
        }

        // XOR with state to get plaintext and update state
        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          plaintext.push(stateBytes[i] ^ block[i]);
          stateBytes[i] = block[i];
        }
        simp.loadState(stateBytes);

        // Get new mask
        mask = simp.getMask();

        // Run permutation
        simp.permute(4);

        cPos += ORIBATIDA_256_RATE;
      }

      // Process final ciphertext block
      const remaining = clen - cPos;
      if (remaining === ORIBATIDA_256_RATE) {
        const block = new Array(ORIBATIDA_256_RATE);
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          block[i] = ciphertext[cPos + i];
        }
        for (let i = 0; i < ORIBATIDA_256_MASK_SIZE; ++i) {
          block[ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE + i] ^= mask[i];
        }

        const stateBytes = simp.extractState();
        for (let i = 0; i < ORIBATIDA_256_RATE; ++i) {
          plaintext.push(stateBytes[i] ^ block[i]);
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
        // Remove mask if ciphertext extends into mask region
        if (remaining > ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE) {
          const maskStart = ORIBATIDA_256_RATE - ORIBATIDA_256_MASK_SIZE;
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
        simp.xorByte(SIMP_256_STATE_SIZE - 1, domains[ORIBATIDA_DOMAIN_MSG]);
        simp.permute(4);
      }

      // Verify authentication tag
      const computedTag = simp.getBytes(0, ORIBATIDA_256_TAG_SIZE);
      const receivedTag = ciphertext.slice(clen, clen + ORIBATIDA_256_TAG_SIZE);

      // Constant-time comparison
      let tagMatch = 0;
      for (let i = 0; i < ORIBATIDA_256_TAG_SIZE; ++i) {
        tagMatch |= computedTag[i] ^ receivedTag[i];
      }

      if (tagMatch !== 0) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Oribatida256_64());

  return Oribatida256_64;
}));
