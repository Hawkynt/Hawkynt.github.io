/*
 * ORANGE-Zest AEAD - NIST Lightweight Cryptography Candidate
 * Professional Implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * ORANGE is a family of lightweight authenticated encryption algorithms based on the
 * PHOTON-256 permutation. This file implements ORANGE-Zest, the main AEAD variant.
 *
 * Features:
 * - 128-bit key and nonce
 * - 128-bit authentication tag
 * - PHOTON-256 permutation (32-byte state)
 * - Domain separation for AD and message processing
 * - Efficient keystream generation with rho function
 * - GF(128) multiplication for state updates
 *
 * References:
 * - https://www.isical.ac.in/~lightweight/Orange/
 * - NIST LWC Submission: https://csrc.nist.gov/Projects/lightweight-cryptography
 *
 * This implementation uses the PHOTON-256 permutation with custom ORANGE-specific
 * modes for authenticated encryption with associated data.
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== PHOTON-256 PERMUTATION =====
  // Implementation based on bit-sliced approach from reference code

  const ROUND = 12;

  // PHOTON S-box (4-bit)
  /** @type {uint8[]} */
  const sbox = [12, 5, 6, 11, 9, 0, 10, 13, 3, 14, 15, 8, 4, 7, 1, 2];

  // MixColumn matrix for PHOTON permutation
  /** @type {uint8[][]} */
  const MixColMatrix = [
    [  2,  4,  2, 11,  2,  8,  5,  6 ],
    [ 12,  9,  8, 13,  7,  7,  5,  2 ],
    [  4,  4, 13, 13,  9,  4, 13,  9 ],
    [  1,  6,  5,  1, 12, 13, 15, 14 ],
    [ 15, 12,  9, 13, 14,  5, 14, 13 ],
    [  9, 14,  5, 15,  4, 12,  9,  6 ],
    [ 12,  2,  2, 10,  3,  1,  1, 14 ],
    [ 15,  1, 13, 10,  5, 10,  2,  3 ]
  ];

  // PHOTON-256 permutation - nibble-based approach
  /**
   * @param {uint8[]} state
   */
  function photon256Permute(state) {
    // Convert byte array to 2D nibble array (8x8)
    /** @type {uint8[][]} */
    const state2d = new Array(8);
    for (let i = 0; i < 8; ++i) {
      /** @type {uint8[]} */
      const row = new Array(8);
      state2d[i] = row;
    }

    for (let i = 0; i < 64; ++i) {
      state2d[OpCodes.Shr32(i, 3)][OpCodes.And32(i, 7)] = OpCodes.And32(OpCodes.Shr32(OpCodes.And32(state[OpCodes.Shr32(i, 1)], 0xFF), 4 * OpCodes.And32(i, 1)), 0xf);
    }

    // 12 rounds of PHOTON permutation
    /** @type {uint8[]} */
    const RC_constants = [
       1,  0,  2,  6, 14, 15, 13,  9,
       3,  2,  0,  4, 12, 13, 15, 11,
       7,  6,  4,  0,  8,  9, 11, 15,
      14, 15, 13,  9,  1,  0,  2,  6,
      13, 12, 14, 10,  2,  3,  1,  5,
      11, 10,  8, 12,  4,  5,  7,  3,
       6,  7,  5,  1,  9,  8, 10, 14,
      12, 13, 15, 11,  3,  2,  0,  4,
       9,  8, 10, 14,  6,  7,  5,  1,
       2,  3,  1,  5, 13, 12, 14, 10,
       5,  4,  6,  2, 10, 11,  9, 13,
      10, 11,  9, 13,  5,  4,  6,  2
    ];

    for (let round = 0; round < ROUND; ++round) {
      // AddConstant
      const rcOffset = round * 8;
      for (let i = 0; i < 8; ++i) {
        state2d[i][0] = OpCodes.Xor32(state2d[i][0], RC_constants[rcOffset + i]);
      }

      // SubCells (S-box layer)
      for (let i = 0; i < 8; ++i) {
        for (let j = 0; j < 8; ++j) {
          state2d[i][j] = sbox[state2d[i][j]];
        }
      }

      // ShiftRows
      for (let i = 1; i < 8; ++i) {
        /** @type {uint8[]} */
        const temp = new Array(8);
        for (let j = 0; j < 8; ++j) {
          temp[j] = state2d[i][j];
        }
        for (let j = 0; j < 8; ++j) {
          state2d[i][j] = temp[(j + i) % 8];
        }
      }

      // MixColumnSerial
      /** @type {uint8[]} */
      const tempCol = new Array(8);
      for (let j = 0; j < 8; ++j) {
        for (let i = 0; i < 8; ++i) {
          /** @type {uint32} */
          let sum = 0;
          for (let k = 0; k < 8; ++k) {
            /** @type {uint8} */
            const x = MixColMatrix[i][k];
            /** @type {uint8} */
            const b = state2d[k][j];

            // GF(16) multiplication
            sum = OpCodes.Xor32(sum, OpCodes.Mul32(x, OpCodes.And32(b, 1)));
            sum = OpCodes.Xor32(sum, OpCodes.Mul32(x, OpCodes.And32(b, 2)));
            sum = OpCodes.Xor32(sum, OpCodes.Mul32(x, OpCodes.And32(b, 4)));
            sum = OpCodes.Xor32(sum, OpCodes.Mul32(x, OpCodes.And32(b, 8)));
          }

          // Reduction modulo x^4 + x + 1
          /** @type {uint32} */
          let t0 = OpCodes.Shr32(sum, 4);
          sum = OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(sum, 15), t0), OpCodes.Shl32(t0, 1));

          /** @type {uint32} */
          let t1 = OpCodes.Shr32(sum, 4);
          sum = OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(sum, 15), t1), OpCodes.Shl32(t1, 1));

          tempCol[i] = OpCodes.And32(sum, 0xf);
        }
        for (let i = 0; i < 8; ++i) {
          state2d[i][j] = tempCol[i];
        }
      }
    }

    // Convert 2D nibble array back to byte array
    for (let i = 0; i < 64; i += 2) {
      state[OpCodes.Shr32(i, 1)] = OpCodes.Or32(OpCodes.And32(state2d[OpCodes.Shr32(i, 3)][OpCodes.And32(i, 7)], 0xf), OpCodes.Shl32(OpCodes.And32(state2d[OpCodes.Shr32(i, 3)][OpCodes.And32(i + 1, 7)], 0xf), 4));
    }
  }

  // ===== ORANGE HELPER FUNCTIONS =====

  // Doubles a block in GF(128) field
  /**
   * @param {uint8[]} block
   * @param {int32} value
   */
  function orangeBlockDouble(block, value) {
    for (let v = 0; v < value; ++v) {
      const mask = (OpCodes.And32(block[15], 0x80) !== 0) ? 0x87 : 0x00;
      for (let i = 15; i > 0; --i) {
        block[i] = OpCodes.Or32(OpCodes.Shl32(block[i], 1), OpCodes.Shr32(block[i - 1], 7));
      }
      block[0] = OpCodes.Xor32(OpCodes.Shl32(block[0], 1), mask);
    }
  }

  // Rotates a block left by 1 bit
  /**
   * @param {uint8[]} out
   * @param {uint8[]} input
   */
  function orangeBlockRotate(out, input) {
    for (let i = 15; i > 0; --i) {
      out[i] = OpCodes.Or32(OpCodes.Shl32(input[i], 1), OpCodes.Shr32(input[i - 1], 7));
    }
    out[0] = OpCodes.Or32(OpCodes.Shl32(input[0], 1), OpCodes.Shr32(input[15], 7));
  }

  // ORANGE rho function
  /**
   * @param {uint8[]} KS
   * @param {uint8[]} S
   * @param {uint8[]} state
   */
  function orangeRho(KS, S, state) {
    orangeBlockDouble(S, 1);
    orangeBlockRotate(KS.subarray(0, 16), state.subarray(0, 16));
    for (let i = 0; i < 16; ++i) {
      KS[16 + i] = OpCodes.Xor32(state[16 + i], S[i]);
    }
    S.set(state.subarray(16, 32));
  }

  // ===== ORANGE-ZEST AEAD ALGORITHM =====

  class OrangeZestAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ORANGE-Zest";
      this.description = "NIST Lightweight Cryptography candidate using PHOTON-256 permutation with efficient keystream generation and GF(128) operations for authenticated encryption.";
      this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation
      this.documentation = [
        new LinkItem(
          "ORANGE Official Website",
          "https://www.isical.ac.in/~lightweight/Orange/"
        ),
        new LinkItem(
          "NIST LWC Project Page",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "ORANGE Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/orange-spec-round2.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "ORANGE Reference Software Package (ISI Kolkata)",
          "https://www.isical.ac.in/~lightweight/Orange/ORANGE.tar.gz"
        ),
        new LinkItem(
          "rweather lightweight-crypto ORANGE Source",
          "https://github.com/rweather/lightweight-crypto/tree/master/src/individual/ORANGE"
        )
      ];

      // Test vectors from NIST KAT file
      this.tests = [
        {
          text: "NIST KAT Vector #1 - Empty PT and AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("F315BF7B2779EF4B99F8CC33B7155755")
        },
        {
          text: "NIST KAT Vector #2 - Empty PT, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("3E23CE190D4C8FCA425D39A3776341B2")
        },
        {
          text: "NIST KAT Vector #5 - Empty PT, 4-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: [],
          expected: OpCodes.Hex8ToBytes("AB63B2ADE8E854BCB72DBE00A29EBBC6")
        },
        {
          text: "NIST KAT Vector #34 - 1-byte PT, empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("BC3791431F6A798A76AE57A5177D909210")
        },
        {
          text: "NIST KAT Vector #35 - 1-byte PT, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("CBA400078FAC89A39288303677E5A08984")
        },
        {
          text: "NIST KAT Vector #38 - 1-byte PT, 4-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00010203"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("4ED50A9171537DAAD559B399342FDCE743")
        },
        {
          text: "NIST KAT Vector #169 - 5-byte PT, 3-byte AD (partial block)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ORANGE-Zest.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102"),
          input: OpCodes.Hex8ToBytes("0001020304"),
          expected: OpCodes.Hex8ToBytes("98973390F20AB5083C9DD60B822162A7978BC2E2E5")
        },
        {
          text: "NIST KAT Vector #1089 - 32-byte PT, 32-byte AD (full block boundary)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ORANGE-Zest.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("B0991C016366C43F3CF727A44410DF56525F4A7BE395B05DB3DFB3BFCD4AAFB912A8537D95006A47D43DF8EA8A7C10FB")
        }
      ];
    }

    CreateInstance(isInverse) {
      if (isInverse === false) {
        return new OrangeZestInstance(this, false);
      }
      if (isInverse === true) {
        return new OrangeZestInstance(this, true);
      }
      return new OrangeZestInstance(this, false);
    }
  }

  // ===== ORANGE-ZEST INSTANCE =====

  /**
 * OrangeZest cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class OrangeZestInstance extends IAeadInstance {
    /**
     * @param {AeadAlgorithm} algorithm - Parent algorithm
     * @param {boolean} isInverse - Decryption mode flag
     */
    constructor(algorithm, isInverse) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._nonce = null;
      /** @type {uint8[]} */
      this._plaintext = [];
      /** @type {uint8[]} */
      this._associatedData = [];
      /** @type {uint8[]} */
      this._ciphertext = [];
    }

    // Property setters with validation
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

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16)");
      }

      this._key = new Uint8Array(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (must be 16)");
      }

      this._nonce = new Uint8Array(nonceBytes);
    }

    /**
     * @returns {uint8[]|null}
     */
    get nonce() {
      return this._nonce ? Array.from(this._nonce) : null;
    }

    /**
     * @param {uint8[]|null} data
     */
    set plaintext(data) {
      if (!data) {
        this._plaintext = [];
        return;
      }
      this._plaintext = Array.isArray(data) ? data : Array.from(data);
    }

    /**
     * @returns {uint8[]}
     */
    get plaintext() {
      return this._plaintext.slice();
    }

    /**
     * @param {uint8[]|null} data
     */
    set associatedData(data) {
      if (!data) {
        this._associatedData = [];
        return;
      }
      this._associatedData = Array.isArray(data) ? data : Array.from(data);
    }

    /**
     * @returns {uint8[]|null}
     */
    get associatedData() {
      return this._associatedData.slice();
    }

    // Canonical AEAD interface property (alias for associatedData)
    /**
     * @param {uint8[]|null} data
     */
    set aad(data) {
      this.associatedData = data;
    }

    /**
     * @returns {uint8[]|null}
     */
    get aad() {
      return this._associatedData.slice();
    }

    /**
     * @param {uint8[]|null} data
     */
    set ciphertext(data) {
      if (!data) {
        this._ciphertext = [];
        return;
      }
      this._ciphertext = Array.isArray(data) ? data : Array.from(data);
    }

    /**
     * @returns {uint8[]}
     */
    get ciphertext() {
      return this._ciphertext.slice();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (this.isInverse) {
        for (let _i = 0; _i < data.length; _i++) this._ciphertext.push(data[_i]);
      } else {
        for (let _i = 0; _i < data.length; _i++) this._plaintext.push(data[_i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set");
      }

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    /**
     * @returns {uint8[]}
     */
    _encrypt() {
      const state = new Uint8Array(32);
      const mlen = this._plaintext.length;
      const adlen = this._associatedData.length;
      const output = new Uint8Array(mlen + 16);

      // Initialize state with nonce and key
      state.set(this._nonce, 0);
      state.set(this._key, 16);

      // Handle associated data and message payload
      if (adlen === 0) {
        if (mlen === 0) {
          // Empty message and AD
          state[16] = OpCodes.Xor32(state[16], 2);
          photon256Permute(state);
          output.set(state.subarray(0, 16), mlen);
        } else {
          // Message only
          state[16] = OpCodes.Xor32(state[16], 1);
          this._orangeEncrypt(state, this._key, output, this._plaintext, mlen);
          this._orangeGenerateTag(state);
          output.set(state.subarray(0, 16), mlen);
        }
      } else {
        // Process associated data
        this._orangeProcessHash(state, this._associatedData, adlen, 1, 2);
        if (mlen !== 0) {
          this._orangeEncrypt(state, this._key, output, this._plaintext, mlen);
        }
        this._orangeGenerateTag(state);
        output.set(state.subarray(0, 16), mlen);
      }

      return Array.from(output);
    }

    /**
     * @returns {uint8[]}
     */
    _decrypt() {
      const clen = this._ciphertext.length;
      if (clen < 16) {
        throw new Error("Ciphertext too short (must include 16-byte tag)");
      }

      const state = new Uint8Array(32);
      const mlen = clen - 16;
      const adlen = this._associatedData.length;
      const output = new Uint8Array(mlen);

      // Initialize state with nonce and key
      state.set(this._nonce, 0);
      state.set(this._key, 16);

      // Handle associated data and message payload - this must mirror _encrypt()
      // exactly, including which branches run the tag finalisation.
      if (adlen === 0) {
        if (mlen === 0) {
          // Empty message and AD: the permutation output is already the tag,
          // no half-swap finalisation is applied in this branch.
          state[16] = OpCodes.Xor32(state[16], 2);
          photon256Permute(state);
        } else {
          // Message only
          state[16] = OpCodes.Xor32(state[16], 1);
          this._orangeDecrypt(state, this._key, output, this._ciphertext, mlen);
          this._orangeGenerateTag(state);
        }
      } else {
        // Process associated data
        this._orangeProcessHash(state, this._associatedData, adlen, 1, 2);
        if (mlen !== 0) {
          this._orangeDecrypt(state, this._key, output, this._ciphertext, mlen);
        }
        this._orangeGenerateTag(state);
      }

      // Verify authentication tag
      /** @type {uint8[]} */
      const computedTag = state.subarray(0, 16);
      /** @type {uint8[]} */
      const receivedTag = this._ciphertext.slice(mlen, mlen + 16);

      if (!OpCodes.SecureCompare(Array.from(computedTag), receivedTag)) {
        throw new Error("Authentication tag verification failed");
      }

      return Array.from(output);
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} data
     * @param {int32} len
     * @param {int32} domain0
     * @param {int32} domain1
     */
    _orangeProcessHash(state, data, len, domain0, domain1) {
      let offset = 0;
      while (len > 32) {
        photon256Permute(state);
        for (let i = 0; i < 32; ++i) {
          state[i] = OpCodes.Xor32(state[i], data[offset + i]);
        }
        offset += 32;
        len -= 32;
      }

      photon256Permute(state);
      if (len < 32) {
        /** @type {uint8[]} */
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, domain1);
        state[len] = OpCodes.Xor32(state[len], 0x01);
      } else {
        /** @type {uint8[]} */
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, domain0);
      }

      for (let i = 0; i < len; ++i) {
        state[i] = OpCodes.Xor32(state[i], data[offset + i]);
      }
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} k
     * @param {uint8[]} c
     * @param {uint8[]} m
     * @param {int32} len
     */
    _orangeEncrypt(state, k, c, m, len) {
      const S = new Uint8Array(16);
      const KS = new Uint8Array(32);
      S.set(k);

      let offset = 0;
      while (len > 32) {
        photon256Permute(state);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          c[offset + i] = OpCodes.Xor32(m[offset + i], KS[i]);
          state[i] = OpCodes.Xor32(state[i], c[offset + i]);
        }
        offset += 32;
        len -= 32;
      }

      photon256Permute(state);
      if (len < 32) {
        /** @type {uint8[]} */
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 2);
        orangeRho(KS, S, state);
        for (let i = 0; i < len; ++i) {
          c[offset + i] = OpCodes.Xor32(m[offset + i], KS[i]);
          state[i] = OpCodes.Xor32(state[i], c[offset + i]);
        }
        state[len] = OpCodes.Xor32(state[len], 0x01);
      } else {
        /** @type {uint8[]} */
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 1);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          c[offset + i] = OpCodes.Xor32(m[offset + i], KS[i]);
          state[i] = OpCodes.Xor32(state[i], c[offset + i]);
        }
      }
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} k
     * @param {uint8[]} m
     * @param {uint8[]} c
     * @param {int32} len
     */
    _orangeDecrypt(state, k, m, c, len) {
      const S = new Uint8Array(16);
      const KS = new Uint8Array(32);
      S.set(k);

      let offset = 0;
      while (len > 32) {
        photon256Permute(state);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          state[i] = OpCodes.Xor32(state[i], c[offset + i]);
          m[offset + i] = OpCodes.Xor32(c[offset + i], KS[i]);
        }
        offset += 32;
        len -= 32;
      }

      photon256Permute(state);
      if (len < 32) {
        /** @type {uint8[]} */
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 2);
        orangeRho(KS, S, state);
        for (let i = 0; i < len; ++i) {
          state[i] = OpCodes.Xor32(state[i], c[offset + i]);
          m[offset + i] = OpCodes.Xor32(c[offset + i], KS[i]);
        }
        state[len] = OpCodes.Xor32(state[len], 0x01);
      } else {
        /** @type {uint8[]} */
        const stateSecondHalf = state.subarray(16, 32);
        orangeBlockDouble(stateSecondHalf, 1);
        orangeRho(KS, S, state);
        for (let i = 0; i < 32; ++i) {
          state[i] = OpCodes.Xor32(state[i], c[offset + i]);
          m[offset + i] = OpCodes.Xor32(c[offset + i], KS[i]);
        }
      }
    }

    /**
     * @param {uint8[]} state
     */
    _orangeGenerateTag(state) {
      // Swap two halves of state
      for (let i = 0; i < 16; ++i) {
        /** @type {uint8} */
        const temp = state[i];
        state[i] = state[i + 16];
        state[i + 16] = temp;
      }
      photon256Permute(state);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new OrangeZestAlgorithm());

  return {
    OrangeZestAlgorithm: OrangeZestAlgorithm,
    OrangeZestInstance: OrangeZestInstance
  };
}));
