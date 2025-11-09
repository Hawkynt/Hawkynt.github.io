/*
 * ACE AEAD - NIST Lightweight Cryptography Round 2 Candidate
 * Professional implementation following official specification
 * (c)2006-2025 Hawkynt
 *
 * ACE is an authenticated encryption with associated data (AEAD) algorithm
 * based on a duplex sponge construction with the sLiSCP-light-320 permutation.
 * - 128-bit key
 * - 128-bit nonce
 * - 128-bit authentication tag
 * - 8-byte rate (64 bits)
 * - 320-bit state (40 bytes)
 *
 * Reference: https://uwaterloo.ca/communications-security-lab/lwc/ace
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

  // sLiSCP-light-320 permutation constants
  const SLISCP320_ROUNDS = 16;
  const ACE_STATE_SIZE = 40; // 320 bits
  const ACE_RATE = 8; // 64-bit rate
  const ACE_KEY_SIZE = 16;
  const ACE_NONCE_SIZE = 16;
  const ACE_TAG_SIZE = 16;

  // Round constants for sLiSCP-light-320
  const SLISCP320_RC = [
    0x07, 0x53, 0x43, 0x50, 0x28, 0x14, 0x0a, 0x5d,
    0xe4, 0x5c, 0xae, 0x57, 0x9b, 0x49, 0x5e, 0x91,
    0x48, 0x24, 0xe0, 0x7f, 0xcc, 0x8d, 0xc6, 0x63,
    0xd1, 0xbe, 0x32, 0x53, 0xa9, 0x54, 0x1a, 0x1d,
    0x4e, 0x60, 0x30, 0x18, 0x22, 0x28, 0x75, 0x68,
    0x34, 0x9a, 0xf7, 0x6c, 0x25, 0xe1, 0x70, 0x38,
    0x62, 0x82, 0xfd, 0xf6, 0x7b, 0xbd, 0x96, 0x47,
    0xf9, 0x9d, 0xce, 0x67, 0x71, 0x6b, 0x76, 0x40,
    0x20, 0x10, 0xaa, 0x88, 0xa0, 0x4f, 0x27, 0x13,
    0x2b, 0xdc, 0xb0, 0xbe, 0x5f, 0x2f, 0xe9, 0x8b,
    0x09, 0x5b, 0xad, 0xd6, 0xcf, 0x59, 0x1e, 0xe9,
    0x74, 0xba, 0xb7, 0xc6, 0xad, 0x7f, 0x3f, 0x1f
  ];

  // Simeck-64 box function for sLiSCP-light-320
  // Performs 8 rounds of Simeck-64 with alternating Feistel structure
  function simeck64Box(x, y, rc) {
    let rcBit = rc;

    // The simeck64_round macro modifies one value then swaps
    // We alternate which value gets modified: y, x, y, x...
    for (let i = 0; i < 8; ++i) {
      if ((i & 1) === 0) {
        // Even rounds: modify y
        y = (y ^ (OpCodes.RotL32(x, 5) & x) ^ OpCodes.RotL32(x, 1) ^ 0xFFFFFFFE ^ (rcBit & 1)) >>> 0;
      } else {
        // Odd rounds: modify x
        x = (x ^ (OpCodes.RotL32(y, 5) & y) ^ OpCodes.RotL32(y, 1) ^ 0xFFFFFFFE ^ (rcBit & 1)) >>> 0;
      }
      rcBit >>>= 1;
    }

    return [x, y];
  }

  // sLiSCP-light-320 permutation
  // State is 320 bits = 10 x 32-bit words
  // Pre-swapped for contiguous rate bytes at positions 0-7
  function sliscp320Permute(state) {
    // Load state as 32-bit words (big-endian)
    let x0 = OpCodes.Pack32BE(state[0], state[1], state[2], state[3]);
    let x1 = OpCodes.Pack32BE(state[16], state[17], state[18], state[19]); // Pre-swapped position
    let x2 = OpCodes.Pack32BE(state[8], state[9], state[10], state[11]);
    let x3 = OpCodes.Pack32BE(state[12], state[13], state[14], state[15]);
    let x4 = OpCodes.Pack32BE(state[4], state[5], state[6], state[7]);
    let x5 = OpCodes.Pack32BE(state[20], state[21], state[22], state[23]);
    let x6 = OpCodes.Pack32BE(state[24], state[25], state[26], state[27]);
    let x7 = OpCodes.Pack32BE(state[28], state[29], state[30], state[31]);
    let x8 = OpCodes.Pack32BE(state[32], state[33], state[34], state[35]);
    let x9 = OpCodes.Pack32BE(state[36], state[37], state[38], state[39]);

    let rcIndex = 0;
    for (let round = 0; round < SLISCP320_ROUNDS; ++round) {
      // Apply Simeck-64 to three 64-bit sub-blocks
      let result = simeck64Box(x0, x1, SLISCP320_RC[rcIndex++]);
      x0 = result[0]; x1 = result[1];

      result = simeck64Box(x4, x5, SLISCP320_RC[rcIndex++]);
      x4 = result[0]; x5 = result[1];

      result = simeck64Box(x8, x9, SLISCP320_RC[rcIndex++]);
      x8 = result[0]; x9 = result[1];

      x6 = (x6 ^ x8) >>> 0;
      x7 = (x7 ^ x9) >>> 0;
      x2 = (x2 ^ x4) >>> 0;
      x3 = (x3 ^ x5) >>> 0;
      x8 = (x8 ^ x0) >>> 0;
      x9 = (x9 ^ x1) >>> 0;

      // Add step constants
      x2 = (x2 ^ 0xFFFFFFFF) >>> 0;
      x3 = (x3 ^ (0xFFFFFF00 ^ SLISCP320_RC[rcIndex++])) >>> 0;
      x6 = (x6 ^ 0xFFFFFFFF) >>> 0;
      x7 = (x7 ^ (0xFFFFFF00 ^ SLISCP320_RC[rcIndex++])) >>> 0;
      x8 = (x8 ^ 0xFFFFFFFF) >>> 0;
      x9 = (x9 ^ (0xFFFFFF00 ^ SLISCP320_RC[rcIndex++])) >>> 0;

      // Rotate sub-blocks
      const t0 = x8, t1 = x9;
      x8 = x2; x9 = x3;
      x2 = x4; x3 = x5;
      x4 = x0; x5 = x1;
      x0 = x6; x1 = x7;
      x6 = t0; x7 = t1;
    }

    // Store back to state (big-endian)
    const bytes0 = OpCodes.Unpack32BE(x0);
    const bytes1 = OpCodes.Unpack32BE(x1);
    const bytes2 = OpCodes.Unpack32BE(x2);
    const bytes3 = OpCodes.Unpack32BE(x3);
    const bytes4 = OpCodes.Unpack32BE(x4);
    const bytes5 = OpCodes.Unpack32BE(x5);
    const bytes6 = OpCodes.Unpack32BE(x6);
    const bytes7 = OpCodes.Unpack32BE(x7);
    const bytes8 = OpCodes.Unpack32BE(x8);
    const bytes9 = OpCodes.Unpack32BE(x9);

    state[0] = bytes0[0]; state[1] = bytes0[1]; state[2] = bytes0[2]; state[3] = bytes0[3];
    state[16] = bytes1[0]; state[17] = bytes1[1]; state[18] = bytes1[2]; state[19] = bytes1[3];
    state[8] = bytes2[0]; state[9] = bytes2[1]; state[10] = bytes2[2]; state[11] = bytes2[3];
    state[12] = bytes3[0]; state[13] = bytes3[1]; state[14] = bytes3[2]; state[15] = bytes3[3];
    state[4] = bytes4[0]; state[5] = bytes4[1]; state[6] = bytes4[2]; state[7] = bytes4[3];
    state[20] = bytes5[0]; state[21] = bytes5[1]; state[22] = bytes5[2]; state[23] = bytes5[3];
    state[24] = bytes6[0]; state[25] = bytes6[1]; state[26] = bytes6[2]; state[27] = bytes6[3];
    state[28] = bytes7[0]; state[29] = bytes7[1]; state[30] = bytes7[2]; state[31] = bytes7[3];
    state[32] = bytes8[0]; state[33] = bytes8[1]; state[34] = bytes8[2]; state[35] = bytes8[3];
    state[36] = bytes9[0]; state[37] = bytes9[1]; state[38] = bytes9[2]; state[39] = bytes9[3];
  }

  // Swap bytes for contiguous rate access
  function sliscp320Swap(state) {
    // Swap bytes 4-7 with bytes 16-19
    for (let i = 0; i < 4; ++i) {
      const t = state[4 + i];
      state[4 + i] = state[16 + i];
      state[16 + i] = t;
    }
  }

  // ACE AEAD Algorithm
  class ACE extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "ACE";
      this.description = "Lightweight authenticated encryption using sLiSCP-light-320 permutation in duplex sponge construction. NIST LWC Round 2 candidate with 128-bit security.";
      this.inventor = "Ismail Adomnitei, Thomas Peyrin";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SINGAPORE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // Rate
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "ACE Specification",
          "https://uwaterloo.ca/communications-security-lab/lwc/ace"
        ),
        new LinkItem(
          "NIST LWC Submission",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Reference Implementation",
          "https://github.com/rweather/lightweight-crypto"
        )
      ];

      // Official test vectors from NIST LWC KAT
      this.tests = [
        {
          text: "NIST LWC KAT Count 1 (empty PT, empty AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("02CF96DC6F171976F9FF4C3FC88E5BBE")
        },
        {
          text: "NIST LWC KAT Count 2 (empty PT, 1-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("B61B4E1ABCB1898AE58D1AEC18CD131F")
        },
        {
          text: "NIST LWC KAT Count 9 (empty PT, 8-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("9616086EE453BAB73F4069B13D0067B6")
        },
        {
          text: "NIST LWC KAT Count 17 (empty PT, 16-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("1BB495CB9D4CFF617F9F53519666B0D1")
        },
        {
          text: "NIST LWC KAT Count 34 (1-byte PT, empty AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("971C19196F86A7B77647D55156E8BE3ED3")
        },
        {
          text: "NIST LWC KAT Count 35 (1-byte PT, 1-byte AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("2ADC76D04EB5F3DAE2DCACC9D5B27A52D5")
        },
        {
          text: "NIST LWC KAT Count 265 (8-byte PT, empty AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("97B9353FE3B7D4A15E7090EBE5B80DD491BCFFF0D698E1C2")
        },
        {
          text: "NIST LWC KAT Count 529 (16-byte PT, empty AD)",
          uri: "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("97B9353FE3B7D4A1309D5A4CE3FD599432715F7128AA9858E39E89DDEF90E996")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ACEInstance(this, isInverse);
    }
  }

  // ACE AEAD Instance
  class ACEInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._nonce = null;
      this._aad = [];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== ACE_KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${ACE_KEY_SIZE})`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== ACE_NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${ACE_NONCE_SIZE})`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set aad(aadBytes) {
      this._aad = aadBytes ? [...aadBytes] : [];
    }

    get aad() {
      return [...this._aad];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        return this._decrypt();
      }
      return this._encrypt();
    }

    _encrypt() {
      const state = new Array(ACE_STATE_SIZE);
      const plaintext = this.inputBuffer;
      const ciphertext = [];

      // Initialize ACE state
      this._aceInit(state);

      // Encrypt plaintext
      let ptIndex = 0;
      while (ptIndex + ACE_RATE <= plaintext.length) {
        // XOR plaintext with state, update state, output ciphertext
        for (let i = 0; i < ACE_RATE; ++i) {
          state[i] ^= plaintext[ptIndex + i];
          ciphertext.push(state[i]);
        }
        state[ACE_STATE_SIZE - 1] ^= 0x02; // Domain separation
        sliscp320Permute(state);
        ptIndex += ACE_RATE;
      }

      // Handle remaining plaintext bytes (including padding for complete blocks)
      const remaining = plaintext.length - ptIndex;
      for (let i = 0; i < remaining; ++i) {
        state[i] ^= plaintext[ptIndex + i];
        ciphertext.push(state[i]);
      }
      state[remaining] ^= 0x80; // Padding
      state[ACE_STATE_SIZE - 1] ^= 0x02; // Domain separation
      sliscp320Permute(state);

      // Generate authentication tag
      const tag = this._aceFinalize(state);
      ciphertext.push(...tag);

      this.inputBuffer = [];
      return ciphertext;
    }

    _decrypt() {
      if (this.inputBuffer.length < ACE_TAG_SIZE) {
        throw new Error("Ciphertext too short (missing authentication tag)");
      }

      const state = new Array(ACE_STATE_SIZE);
      const ciphertext = this.inputBuffer.slice(0, -ACE_TAG_SIZE);
      const receivedTag = this.inputBuffer.slice(-ACE_TAG_SIZE);
      const plaintext = [];

      // Initialize ACE state
      this._aceInit(state);

      // Decrypt ciphertext
      let ctIndex = 0;
      while (ctIndex + ACE_RATE <= ciphertext.length) {
        // XOR ciphertext with state to produce plaintext
        for (let i = 0; i < ACE_RATE; ++i) {
          const pt = state[i] ^ ciphertext[ctIndex + i];
          plaintext.push(pt);
          state[i] = ciphertext[ctIndex + i];
        }
        state[ACE_STATE_SIZE - 1] ^= 0x02; // Domain separation
        sliscp320Permute(state);
        ctIndex += ACE_RATE;
      }

      // Handle remaining ciphertext bytes (including padding for complete blocks)
      const remaining = ciphertext.length - ctIndex;
      for (let i = 0; i < remaining; ++i) {
        const pt = state[i] ^ ciphertext[ctIndex + i];
        plaintext.push(pt);
        state[i] = ciphertext[ctIndex + i];
      }
      state[remaining] ^= 0x80; // Padding
      state[ACE_STATE_SIZE - 1] ^= 0x02; // Domain separation
      sliscp320Permute(state);

      // Verify authentication tag
      const computedTag = this._aceFinalize(state);

      // Constant-time tag comparison
      let tagMatch = 0;
      for (let i = 0; i < ACE_TAG_SIZE; ++i) {
        tagMatch |= computedTag[i] ^ receivedTag[i];
      }

      if (tagMatch !== 0) {
        // Clear plaintext on authentication failure
        OpCodes.ClearArray(plaintext);
        throw new Error("Authentication tag verification failed");
      }

      this.inputBuffer = [];
      return plaintext;
    }

    _aceInit(state) {
      // Initialize state by interleaving key and nonce
      // state[0..7] = key[0..7]
      for (let i = 0; i < 8; ++i) {
        state[i] = this._key[i];
      }
      // state[8..15] = nonce[0..7]
      for (let i = 0; i < 8; ++i) {
        state[8 + i] = this._nonce[i];
      }
      // state[16..23] = key[8..15]
      for (let i = 0; i < 8; ++i) {
        state[16 + i] = this._key[8 + i];
      }
      // state[24..31] = 0
      for (let i = 0; i < 8; ++i) {
        state[24 + i] = 0;
      }
      // state[32..39] = nonce[8..15]
      for (let i = 0; i < 8; ++i) {
        state[32 + i] = this._nonce[8 + i];
      }

      // Swap bytes for contiguous rate
      sliscp320Swap(state);

      // Run permutation to scramble initial state
      sliscp320Permute(state);

      // Absorb key in two permutation operations
      for (let i = 0; i < 8; ++i) {
        state[i] ^= this._key[i];
      }
      sliscp320Permute(state);

      for (let i = 0; i < 8; ++i) {
        state[i] ^= this._key[8 + i];
      }
      sliscp320Permute(state);

      // Absorb associated data
      if (this._aad.length > 0) {
        let adIndex = 0;
        while (adIndex + ACE_RATE <= this._aad.length) {
          for (let i = 0; i < ACE_RATE; ++i) {
            state[i] ^= this._aad[adIndex + i];
          }
          state[ACE_STATE_SIZE - 1] ^= 0x01; // Domain separation
          sliscp320Permute(state);
          adIndex += ACE_RATE;
        }

        // Handle remaining AD bytes (including padding for complete blocks)
        const remaining = this._aad.length - adIndex;
        for (let i = 0; i < remaining; ++i) {
          state[i] ^= this._aad[adIndex + i];
        }
        state[remaining] ^= 0x80; // Padding
        state[ACE_STATE_SIZE - 1] ^= 0x01; // Domain separation
        sliscp320Permute(state);
      }
    }

    _aceFinalize(state) {
      // Absorb key again
      for (let i = 0; i < 8; ++i) {
        state[i] ^= this._key[i];
      }
      sliscp320Permute(state);

      for (let i = 0; i < 8; ++i) {
        state[i] ^= this._key[8 + i];
      }
      sliscp320Permute(state);

      // Swap back to canonical order
      sliscp320Swap(state);

      // Extract authentication tag
      const tag = [];
      for (let i = 0; i < 8; ++i) {
        tag.push(state[i]);
      }
      for (let i = 0; i < 8; ++i) {
        tag.push(state[16 + i]);
      }

      return tag;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new ACE());
}));
