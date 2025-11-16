/*
 * SPIX AEAD - NIST Lightweight Cryptography Candidate
 * Professional implementation following official C reference
 * (c)2006-2025 Hawkynt
 *
 * SPIX is a lightweight authenticated encryption algorithm using the MonkeyDuplex
 * construction on top of the sLiSCP-light-256 permutation. It provides:
 * - 128-bit key
 * - 128-bit nonce
 * - 128-bit authentication tag
 * - 8-byte rate for data absorption/squeezing
 *
 * The sLiSCP-light permutation uses Simeck-64 as its round function component.
 *
 * Reference: https://uwaterloo.ca/communications-security-lab/lwc/spix
 * C Reference: https://github.com/rweather/lightweight-crypto
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

  // sLiSCP-light-256 permutation constants
  const SLISCP_LIGHT256_RC = [
    0x0f, 0x47, 0x08, 0x64, 0x04, 0xb2, 0x86, 0x6b,
    0x43, 0xb5, 0xe2, 0x6f, 0xf1, 0x37, 0x89, 0x2c,
    0x44, 0x96, 0xe6, 0xdd, 0x73, 0xee, 0xca, 0x99,
    0xe5, 0x4c, 0x17, 0xea, 0x0b, 0xf5, 0x8e, 0x0f,
    0x47, 0x07, 0x64, 0x04, 0xb2, 0x82, 0x6b, 0x43,
    0xb5, 0xa1, 0x6f, 0xf1, 0x37, 0x78, 0x2c, 0x44,
    0x96, 0xa2, 0xdd, 0x73, 0xee, 0xb9, 0x99, 0xe5,
    0x4c, 0xf2, 0xea, 0x0b, 0xf5, 0x85, 0x0f, 0x47,
    0x07, 0x23, 0x04, 0xb2, 0x82, 0xd9, 0x43, 0xb5
  ];

  // Simeck-64 operations (used in sLiSCP-light-256)
  function simeck64Round(x, y, rcBit) {
    const rotLeft5 = OpCodes.RotL32(x, 5);
    const rotLeft1 = OpCodes.RotL32(x, 1);
    y = (y ^ (rotLeft5 & x) ^ rotLeft1 ^ 0xFFFFFFFE ^ rcBit) >>> 0;
    return [x, y];
  }

  function simeck64Box(x, y, rc) {
    let _x = x, _y = y;
    for (let i = 0; i < 8; ++i) {
      const rcBit = (rc >> i) & 1;
      if (i % 2 === 0) {
        [_x, _y] = simeck64Round(_x, _y, rcBit);
      } else {
        [_y, _x] = simeck64Round(_y, _x, rcBit);
      }
    }
    return [_x, _y];
  }

  // sLiSCP-light-256 permutation for SPIX
  // State is 256 bits = 8 x 32-bit words
  function sliscpLight256PermuteSpix(state, rounds) {
    // Load state as 8 x 32-bit big-endian words
    // Pre-swapped layout: words at positions 0,1,2,3,4,5,6,7
    // map to bytes: 0-3, 4-7, 8-11, 24-27, 16-19, 20-23, 12-15, 28-31
    let x0 = OpCodes.Pack32BE(state[0], state[1], state[2], state[3]);
    let x1 = OpCodes.Pack32BE(state[4], state[5], state[6], state[7]);
    let x2 = OpCodes.Pack32BE(state[8], state[9], state[10], state[11]);
    let x3 = OpCodes.Pack32BE(state[24], state[25], state[26], state[27]); // Pre-swapped
    let x4 = OpCodes.Pack32BE(state[16], state[17], state[18], state[19]);
    let x5 = OpCodes.Pack32BE(state[20], state[21], state[22], state[23]);
    let x6 = OpCodes.Pack32BE(state[12], state[13], state[14], state[15]);
    let x7 = OpCodes.Pack32BE(state[28], state[29], state[30], state[31]);

    let rcIndex = 0;
    for (let r = 0; r < rounds; ++r) {
      // Apply Simeck-64 to two 64-bit sub-blocks
      [x2, x3] = simeck64Box(x2, x3, SLISCP_LIGHT256_RC[rcIndex]);
      [x6, x7] = simeck64Box(x6, x7, SLISCP_LIGHT256_RC[rcIndex + 1]);

      // Add step constants
      x0 = (x0 ^ 0xFFFFFFFF) >>> 0;
      x1 = (x1 ^ (0xFFFFFF00 ^ SLISCP_LIGHT256_RC[rcIndex + 2])) >>> 0;
      x4 = (x4 ^ 0xFFFFFFFF) >>> 0;
      x5 = (x5 ^ (0xFFFFFF00 ^ SLISCP_LIGHT256_RC[rcIndex + 3])) >>> 0;

      // Mix the sub-blocks
      const t0 = (x0 ^ x2) >>> 0;
      const t1 = (x1 ^ x3) >>> 0;
      x0 = x2;
      x1 = x3;
      x2 = (x4 ^ x6) >>> 0;
      x3 = (x5 ^ x7) >>> 0;
      x4 = x6;
      x5 = x7;
      x6 = t0;
      x7 = t1;

      rcIndex += 4;
    }

    // Store state back (with pre-swapped layout)
    const bytes0 = OpCodes.Unpack32BE(x0);
    const bytes1 = OpCodes.Unpack32BE(x1);
    const bytes2 = OpCodes.Unpack32BE(x2);
    const bytes3 = OpCodes.Unpack32BE(x3);
    const bytes4 = OpCodes.Unpack32BE(x4);
    const bytes5 = OpCodes.Unpack32BE(x5);
    const bytes6 = OpCodes.Unpack32BE(x6);
    const bytes7 = OpCodes.Unpack32BE(x7);

    state[0] = bytes0[0]; state[1] = bytes0[1]; state[2] = bytes0[2]; state[3] = bytes0[3];
    state[4] = bytes1[0]; state[5] = bytes1[1]; state[6] = bytes1[2]; state[7] = bytes1[3];
    state[8] = bytes2[0]; state[9] = bytes2[1]; state[10] = bytes2[2]; state[11] = bytes2[3];
    state[24] = bytes3[0]; state[25] = bytes3[1]; state[26] = bytes3[2]; state[27] = bytes3[3]; // Pre-swapped
    state[16] = bytes4[0]; state[17] = bytes4[1]; state[18] = bytes4[2]; state[19] = bytes4[3];
    state[20] = bytes5[0]; state[21] = bytes5[1]; state[22] = bytes5[2]; state[23] = bytes5[3];
    state[12] = bytes6[0]; state[13] = bytes6[1]; state[14] = bytes6[2]; state[15] = bytes6[3];
    state[28] = bytes7[0]; state[29] = bytes7[1]; state[30] = bytes7[2]; state[31] = bytes7[3];
  }

  // Swap bytes for SPIX state layout
  function sliscpLight256SwapSpix(state) {
    // Swap words at positions 12-15 and 24-27
    for (let i = 0; i < 4; ++i) {
      const temp = state[12 + i];
      state[12 + i] = state[24 + i];
      state[24 + i] = temp;
    }
  }

  // SPIX algorithm class
  class Spix extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "SPIX";
      this.description = "Lightweight AEAD cipher using MonkeyDuplex construction with sLiSCP-light-256 permutation. Features 128-bit key/nonce/tag with 8-byte rate for efficient authenticated encryption.";
      this.inventor = "Tao Huang, Junjie Bi, Zhenzhen Bao, Jiale Guo";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "SPIX Specification",
          "https://uwaterloo.ca/communications-security-lab/lwc/spix"
        ),
        new LinkItem(
          "NIST LWC Project",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "C Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from NIST KAT file
      this.tests = [
        {
          text: "SPIX: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("74D5A923739B1F893C7C005DF8349B62")
        },
        {
          text: "SPIX: Empty message, 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("8206DFCB92D667F617328EBCC6A38AC9")
        },
        {
          text: "SPIX: Empty message, 2-byte AAD (Count 3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("A012DDF1716623239F7813D122C7C42C")
        },
        {
          text: "SPIX: 1-byte plaintext, empty AAD (Count 34)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("2A071D7DE31A45DDDAD7D2B3086E41950F")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SpixInstance(this, isInverse);
    }
  }

  // SPIX instance implementing Feed/Result pattern
  /**
 * Spix cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SpixInstance extends IAeadInstance {
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
      this.inputBuffer = [];
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

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16)`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 16)`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set aad(aadBytes) {
      if (!aadBytes) {
        this._aad = [];
        return;
      }
      this._aad = [...aadBytes];
    }

    get aad() { return [...this._aad]; }

    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    get associatedData() {
      return this.aad;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        // Decrypt and verify
        if (this.inputBuffer.length < 16) {
          throw new Error("Ciphertext too short (must include 16-byte tag)");
        }
        return this._decrypt();
      } else {
        // Encrypt and generate tag
        return this._encrypt();
      }
    }

    // Initialize SPIX state
    _init(state) {
      // Initialize state by interleaving key and nonce
      // state[0..7] = nonce[0..7]
      // state[8..15] = key[0..7]
      // state[16..23] = nonce[8..15]
      // state[24..31] = key[8..15]
      for (let i = 0; i < 8; ++i) {
        state[i] = this._nonce[i];
        state[i + 8] = this._key[i];
        state[i + 16] = this._nonce[i + 8];
        state[i + 24] = this._key[i + 8];
      }

      sliscpLight256SwapSpix(state);

      // Run permutation to scramble initial state
      sliscpLight256PermuteSpix(state, 18);

      // Absorb key in two permutation operations
      // XOR first half of key into rate (bytes 8-15)
      for (let i = 0; i < 8; ++i) {
        state[i + 8] ^= this._key[i];
      }
      sliscpLight256PermuteSpix(state, 18);

      // XOR second half of key into rate
      for (let i = 0; i < 8; ++i) {
        state[i + 8] ^= this._key[i + 8];
      }
      sliscpLight256PermuteSpix(state, 18);

      // Absorb associated data
      if (this._aad.length > 0) {
        let offset = 0;
        const RATE = 8;

        // Process full blocks
        while (offset + RATE <= this._aad.length) {
          for (let i = 0; i < RATE; ++i) {
            state[i + 8] ^= this._aad[offset + i];
          }
          state[31] ^= 0x01; // Domain separation for AD
          sliscpLight256PermuteSpix(state, 9);
          offset += RATE;
        }

        // Process final partial block
        if (offset < this._aad.length) {
          const remaining = this._aad.length - offset;
          for (let i = 0; i < remaining; ++i) {
            state[i + 8] ^= this._aad[offset + i];
          }
          state[8 + remaining] ^= 0x80; // Padding
          state[31] ^= 0x01; // Domain separation for AD
          sliscpLight256PermuteSpix(state, 9);
        }
      }
    }

    // Finalize and extract tag
    _finalize(state) {
      // Absorb key again
      for (let i = 0; i < 8; ++i) {
        state[i + 8] ^= this._key[i];
      }
      sliscpLight256PermuteSpix(state, 18);

      for (let i = 0; i < 8; ++i) {
        state[i + 8] ^= this._key[i + 8];
      }
      sliscpLight256PermuteSpix(state, 18);

      // Extract tag
      sliscpLight256SwapSpix(state);
      const tag = [];
      for (let i = 0; i < 8; ++i) {
        tag.push(state[i + 8]);
      }
      for (let i = 0; i < 8; ++i) {
        tag.push(state[i + 24]);
      }
      return tag;
    }

    _encrypt() {
      const state = new Array(32).fill(0);
      this._init(state);

      const plaintext = this.inputBuffer;
      const output = [];
      const RATE = 8;
      let offset = 0;

      // Encrypt plaintext blocks
      while (offset + RATE <= plaintext.length) {
        for (let i = 0; i < RATE; ++i) {
          const ct = (state[i + 8] ^ plaintext[offset + i]) & 0xFF;
          output.push(ct);
          state[i + 8] = ct; // Update state with ciphertext
        }
        state[31] ^= 0x02; // Domain separation for message
        sliscpLight256PermuteSpix(state, 9);
        offset += RATE;
      }

      // Process final partial block (including empty message case)
      const remaining = plaintext.length - offset;
      for (let i = 0; i < remaining; ++i) {
        const ct = (state[i + 8] ^ plaintext[offset + i]) & 0xFF;
        output.push(ct);
        state[i + 8] = ct;
      }
      state[8 + remaining] ^= 0x80; // Padding
      state[31] ^= 0x02; // Domain separation for message
      sliscpLight256PermuteSpix(state, 9);

      // Generate and append tag
      const tag = this._finalize(state);
      output.push(...tag);

      this.inputBuffer = [];
      return output;
    }

    _decrypt() {
      const ciphertext = this.inputBuffer;
      const ctLen = ciphertext.length - 16; // Remove tag length
      const receivedTag = ciphertext.slice(ctLen);

      const state = new Array(32).fill(0);
      this._init(state);

      const output = [];
      const RATE = 8;
      let offset = 0;

      // Decrypt ciphertext blocks
      while (offset + RATE <= ctLen) {
        for (let i = 0; i < RATE; ++i) {
          const ct = ciphertext[offset + i];
          const pt = (state[i + 8] ^ ct) & 0xFF;
          output.push(pt);
          state[i + 8] = ct; // Update state with ciphertext
        }
        state[31] ^= 0x02; // Domain separation for message
        sliscpLight256PermuteSpix(state, 9);
        offset += RATE;
      }

      // Process final partial block (including empty message case)
      const remaining = ctLen - offset;
      for (let i = 0; i < remaining; ++i) {
        const ct = ciphertext[offset + i];
        const pt = (state[i + 8] ^ ct) & 0xFF;
        output.push(pt);
        state[i + 8] = ct;
      }
      state[8 + remaining] ^= 0x80; // Padding
      state[31] ^= 0x02; // Domain separation for message
      sliscpLight256PermuteSpix(state, 9);

      // Verify tag
      const computedTag = this._finalize(state);
      let tagMatch = true;
      for (let i = 0; i < 16; ++i) {
        if (computedTag[i] !== receivedTag[i]) {
          tagMatch = false;
        }
      }

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Spix());

  return {
    Spix,
    SpixInstance
  };
}));
