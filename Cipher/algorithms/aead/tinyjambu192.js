/*
 * TinyJAMBU-192 AEAD - NIST LWC Finalist
 * Professional implementation following NIST Lightweight Cryptography Competition specification
 * (c)2006-2025 Hawkynt
 *
 * TinyJAMBU is a family of lightweight authenticated encryption algorithms designed for
 * resource-constrained environments. It was a finalist in the NIST Lightweight Cryptography
 * Competition. This implementation provides the 192-bit key variant.
 *
 * Algorithm Parameters:
 * - Key: 192 bits (24 bytes)
 * - Nonce: 96 bits (12 bytes)
 * - Tag: 64 bits (8 bytes)
 * - State: 128 bits (4 x 32-bit words)
 *
 * The core permutation uses a keyed feedback shift register with nonlinear feedback
 * function combining XOR, AND, and NOT operations. Domain separators distinguish
 * different phases: 0x10 (nonce), 0x30 (associated data), 0x50 (plaintext/ciphertext),
 * 0x70 (finalization).
 *
 * Reference: https://csrc.nist.gov/projects/lightweight-cryptography
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/tinyjambu-spec-final.pdf
 * C Reference: https://github.com/rweather/lwc-finalists
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

  // TinyJAMBU-192 AEAD Algorithm
  class TinyJAMBU192 extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "TinyJAMBU-192 AEAD";
      this.description = "Lightweight authenticated encryption finalist in NIST LWC. Features 192-bit keyed permutation with 4-word state, 96-bit nonce, and 64-bit authentication tag. Optimized for constrained environments.";
      this.inventor = "Hongjun Wu, Tao Huang";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [new KeySize(24, 24, 1)];
      this.SupportedTagSizes = [new KeySize(8, 8, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Finalist Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/tinyjambu-spec-final.pdf"
        ),
        new LinkItem(
          "NIST Lightweight Cryptography Project",
          "https://csrc.nist.gov/projects/lightweight-cryptography"
        ),
        new LinkItem(
          "Reference Implementation (C)",
          "https://github.com/rweather/lwc-finalists"
        )
      ];

      // Official test vectors from NIST LWC KAT files
      this.tests = [
        {
          text: "TinyJAMBU-192: Empty message, empty AAD (Count 1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("7A0775B5021A22A6")
        },
        {
          text: "TinyJAMBU-192: Empty message with 1-byte AAD (Count 2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("CE89A55740C8B4E3")
        },
        {
          text: "TinyJAMBU-192: Empty message with 4-byte AAD (Count 5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes("00010203"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("BB87C0583A6DD75A")
        },
        {
          text: "TinyJAMBU-192: 1-byte message, empty AAD (Count 34)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("6017F2D006DCC66569")
        },
        {
          text: "TinyJAMBU-192: 1-byte message with 1-byte AAD (Count 35)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("803A2659C516B939AB")
        },
        {
          text: "TinyJAMBU-192: 4-byte message with 4-byte AAD (Count 73)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes("00010203"),
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("86EBFBED7FB13ACB11A58A5E")
        },
        {
          text: "TinyJAMBU-192: 8-byte message with 8-byte AAD (Count 297)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("0C8F824F8B6FC46A32E1DD2D64F93BD2")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new TinyJAMBU192Instance(this, isInverse);
    }
  }

  // TinyJAMBU-192 AEAD Instance
  class TinyJAMBU192Instance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._aad = [];
      this.inputBuffer = [];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 24) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 24)`);
      }

      this._key = [...keyBytes];
    }

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 12) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 12)`);
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

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        // Decrypt mode
        if (this.inputBuffer.length < 8) {
          throw new Error("Ciphertext too short (must include 8-byte tag)");
        }
        return this._decrypt();
      } else {
        // Encrypt mode
        return this._encrypt();
      }
    }

    // TinyJAMBU keyed permutation for 192-bit key
    // Performs rounds*128 steps using the 6-word key schedule
    // Matches the C reference implementation in internal-tinyjambu.c
    _permutation192(state, key, rounds) {
      // Load state into local variables for performance (matches C code)
      let s0 = state[0];
      let s1 = state[1];
      let s2 = state[2];
      let s3 = state[3];
      let t1, t2, t3, t4;

      // Perform all permutation rounds 128 at a time
      for (; rounds > 0; ) {
        // First set of 128 steps (key[0,1,2,3])
        // The C code calls tiny_jambu_steps_32 32 times per key word
        // Each call updates one state element once, rotating through all 4 elements
        for (let r = 0; r < 32; ++r) {
          // Update s0 using s1,s2,s3 and key[0]
          t1 = (s1 >>> 15) | (s2 << 17);
          t2 = (s2 >>> 6) | (s3 << 26);
          t3 = (s2 >>> 21) | (s3 << 11);
          t4 = (s2 >>> 27) | (s3 << 5);
          s0 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[0];

          // Update s1 using s2,s3,s0 and key[1]
          t1 = (s2 >>> 15) | (s3 << 17);
          t2 = (s3 >>> 6) | (s0 << 26);
          t3 = (s3 >>> 21) | (s0 << 11);
          t4 = (s3 >>> 27) | (s0 << 5);
          s1 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[1];

          // Update s2 using s3,s0,s1 and key[2]
          t1 = (s3 >>> 15) | (s0 << 17);
          t2 = (s0 >>> 6) | (s1 << 26);
          t3 = (s0 >>> 21) | (s1 << 11);
          t4 = (s0 >>> 27) | (s1 << 5);
          s2 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[2];

          // Update s3 using s0,s1,s2 and key[3]
          t1 = (s0 >>> 15) | (s1 << 17);
          t2 = (s1 >>> 6) | (s2 << 26);
          t3 = (s1 >>> 21) | (s2 << 11);
          t4 = (s1 >>> 27) | (s2 << 5);
          s3 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[3];
        }

        // Bail out if this is the last round
        if ((--rounds) === 0) break;

        // Second set of 128 steps (key[4,5,0,1])
        for (let r = 0; r < 32; ++r) {
          t1 = (s1 >>> 15) | (s2 << 17);
          t2 = (s2 >>> 6) | (s3 << 26);
          t3 = (s2 >>> 21) | (s3 << 11);
          t4 = (s2 >>> 27) | (s3 << 5);
          s0 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[4];

          t1 = (s2 >>> 15) | (s3 << 17);
          t2 = (s3 >>> 6) | (s0 << 26);
          t3 = (s3 >>> 21) | (s0 << 11);
          t4 = (s3 >>> 27) | (s0 << 5);
          s1 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[5];

          t1 = (s3 >>> 15) | (s0 << 17);
          t2 = (s0 >>> 6) | (s1 << 26);
          t3 = (s0 >>> 21) | (s1 << 11);
          t4 = (s0 >>> 27) | (s1 << 5);
          s2 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[0];

          t1 = (s0 >>> 15) | (s1 << 17);
          t2 = (s1 >>> 6) | (s2 << 26);
          t3 = (s1 >>> 21) | (s2 << 11);
          t4 = (s1 >>> 27) | (s2 << 5);
          s3 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[1];
        }

        // Bail out if this is the last round
        if ((--rounds) === 0) break;

        // Third set of 128 steps (key[2,3,4,5])
        for (let r = 0; r < 32; ++r) {
          t1 = (s1 >>> 15) | (s2 << 17);
          t2 = (s2 >>> 6) | (s3 << 26);
          t3 = (s2 >>> 21) | (s3 << 11);
          t4 = (s2 >>> 27) | (s3 << 5);
          s0 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[2];

          t1 = (s2 >>> 15) | (s3 << 17);
          t2 = (s3 >>> 6) | (s0 << 26);
          t3 = (s3 >>> 21) | (s0 << 11);
          t4 = (s3 >>> 27) | (s0 << 5);
          s1 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[3];

          t1 = (s3 >>> 15) | (s0 << 17);
          t2 = (s0 >>> 6) | (s1 << 26);
          t3 = (s0 >>> 21) | (s1 << 11);
          t4 = (s0 >>> 27) | (s1 << 5);
          s2 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[4];

          t1 = (s0 >>> 15) | (s1 << 17);
          t2 = (s1 >>> 6) | (s2 << 26);
          t3 = (s1 >>> 21) | (s2 << 11);
          t4 = (s1 >>> 27) | (s2 << 5);
          s3 ^= t1 ^ (~(t2 & t3)) ^ t4 ^ key[5];
        }

        // Decrement for next iteration
        --rounds;
      }

      // Store local variables back to state
      state[0] = s0;
      state[1] = s1;
      state[2] = s2;
      state[3] = s3;
    }

    // Setup TinyJAMBU state with key, nonce, and associated data
    _setup192(state, key, nonce, ad, adlen) {
      // Initialize state to zero
      state[0] = 0;
      state[1] = 0;
      state[2] = 0;
      state[3] = 0;

      // Initial permutation with key (1152 steps = 9 rounds)
      this._permutation192(state, key, 9);

      // Absorb the three 32-bit words of the 96-bit nonce
      state[1] = (state[1] ^ 0x10) >>> 0; // Domain separator for nonce
      this._permutation192(state, key, 3); // 384 steps = 3 rounds
      state[3] = (state[3] ^ OpCodes.Pack32LE(nonce[0], nonce[1], nonce[2], nonce[3])) >>> 0;

      state[1] = (state[1] ^ 0x10) >>> 0;
      this._permutation192(state, key, 3);
      state[3] = (state[3] ^ OpCodes.Pack32LE(nonce[4], nonce[5], nonce[6], nonce[7])) >>> 0;

      state[1] = (state[1] ^ 0x10) >>> 0;
      this._permutation192(state, key, 3);
      state[3] = (state[3] ^ OpCodes.Pack32LE(nonce[8], nonce[9], nonce[10], nonce[11])) >>> 0;

      // Process as many full 32-bit words of associated data as we can
      let adPos = 0;
      while (adlen >= 4) {
        state[1] = (state[1] ^ 0x30) >>> 0; // Domain separator for associated data
        this._permutation192(state, key, 3);
        state[3] = (state[3] ^ OpCodes.Pack32LE(ad[adPos], ad[adPos + 1], ad[adPos + 2], ad[adPos + 3])) >>> 0;
        adPos += 4;
        adlen -= 4;
      }

      // Handle the left-over associated data bytes, if any
      if (adlen === 1) {
        state[1] = (state[1] ^ 0x30) >>> 0;
        this._permutation192(state, key, 3);
        state[3] = (state[3] ^ ad[adPos]) >>> 0;
        state[1] = (state[1] ^ 0x01) >>> 0;
      } else if (adlen === 2) {
        state[1] = (state[1] ^ 0x30) >>> 0;
        this._permutation192(state, key, 3);
        state[3] = (state[3] ^ OpCodes.Pack16LE(ad[adPos], ad[adPos + 1])) >>> 0;
        state[1] = (state[1] ^ 0x02) >>> 0;
      } else if (adlen === 3) {
        state[1] = (state[1] ^ 0x30) >>> 0;
        this._permutation192(state, key, 3);
        const word = OpCodes.Pack16LE(ad[adPos], ad[adPos + 1]) | (ad[adPos + 2] << 16);
        state[3] = (state[3] ^ word) >>> 0;
        state[1] = (state[1] ^ 0x03) >>> 0;
      }
    }

    // Generate authentication tag
    _generateTag192(state, key) {
      const tag = new Array(8);

      state[1] = (state[1] ^ 0x70) >>> 0; // Domain separator for finalization
      this._permutation192(state, key, 9); // 1152 steps = 9 rounds
      const tag1 = OpCodes.Unpack32LE(state[2]);
      tag[0] = tag1[0];
      tag[1] = tag1[1];
      tag[2] = tag1[2];
      tag[3] = tag1[3];

      state[1] = (state[1] ^ 0x70) >>> 0;
      this._permutation192(state, key, 3); // 384 steps = 3 rounds
      const tag2 = OpCodes.Unpack32LE(state[2]);
      tag[4] = tag2[0];
      tag[5] = tag2[1];
      tag[6] = tag2[2];
      tag[7] = tag2[3];

      return tag;
    }

    _encrypt() {
      const plaintext = this.inputBuffer;
      const output = [];
      const state = [0, 0, 0, 0];

      // Unpack key to 32-bit words (little-endian)
      const key = [
        OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]),
        OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]),
        OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23])
      ];

      // Setup state with key, nonce, and associated data
      this._setup192(state, key, this._nonce, this._aad, this._aad.length);

      // Encrypt plaintext to produce ciphertext
      let mlen = plaintext.length;
      let mPos = 0;

      while (mlen >= 4) {
        state[1] = (state[1] ^ 0x50) >>> 0; // Domain separator for message data
        this._permutation192(state, key, 9); // 1152 steps = 9 rounds
        const data = OpCodes.Pack32LE(plaintext[mPos], plaintext[mPos + 1], plaintext[mPos + 2], plaintext[mPos + 3]);
        state[3] = (state[3] ^ data) >>> 0;
        const ctWord = (data ^ state[2]) >>> 0;
        const ctBytes = OpCodes.Unpack32LE(ctWord);
        output.push(ctBytes[0], ctBytes[1], ctBytes[2], ctBytes[3]);
        mPos += 4;
        mlen -= 4;
      }

      if (mlen === 1) {
        state[1] = (state[1] ^ 0x50) >>> 0;
        this._permutation192(state, key, 9);
        const data = plaintext[mPos];
        state[3] = (state[3] ^ data) >>> 0;
        state[1] = (state[1] ^ 0x01) >>> 0;
        output.push((state[2] ^ data) & 0xFF);
      } else if (mlen === 2) {
        state[1] = (state[1] ^ 0x50) >>> 0;
        this._permutation192(state, key, 9);
        const data = OpCodes.Pack16LE(plaintext[mPos], plaintext[mPos + 1]);
        state[3] = (state[3] ^ data) >>> 0;
        state[1] = (state[1] ^ 0x02) >>> 0;
        const ctWord = (data ^ state[2]) >>> 0;
        output.push(ctWord & 0xFF, (ctWord >>> 8) & 0xFF);
      } else if (mlen === 3) {
        state[1] = (state[1] ^ 0x50) >>> 0;
        this._permutation192(state, key, 9);
        const data = OpCodes.Pack16LE(plaintext[mPos], plaintext[mPos + 1]) | (plaintext[mPos + 2] << 16);
        state[3] = (state[3] ^ data) >>> 0;
        state[1] = (state[1] ^ 0x03) >>> 0;
        const ctWord = (data ^ state[2]) >>> 0;
        output.push(ctWord & 0xFF, (ctWord >>> 8) & 0xFF, (ctWord >>> 16) & 0xFF);
      }

      // Generate authentication tag
      const tag = this._generateTag192(state, key);
      output.push(...tag);

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _decrypt() {
      const ciphertext = this.inputBuffer;
      const output = [];
      const state = [0, 0, 0, 0];

      // Extract tag from end of ciphertext
      const ctLen = ciphertext.length - 8;
      const providedTag = ciphertext.slice(ctLen);

      // Unpack key to 32-bit words (little-endian)
      const key = [
        OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15]),
        OpCodes.Pack32LE(this._key[16], this._key[17], this._key[18], this._key[19]),
        OpCodes.Pack32LE(this._key[20], this._key[21], this._key[22], this._key[23])
      ];

      // Setup state with key, nonce, and associated data
      this._setup192(state, key, this._nonce, this._aad, this._aad.length);

      // Decrypt ciphertext to produce plaintext
      let clen = ctLen;
      let cPos = 0;

      while (clen >= 4) {
        state[1] = (state[1] ^ 0x50) >>> 0; // Domain separator for message data
        this._permutation192(state, key, 9); // 1152 steps = 9 rounds
        const ctWord = OpCodes.Pack32LE(ciphertext[cPos], ciphertext[cPos + 1], ciphertext[cPos + 2], ciphertext[cPos + 3]);
        const data = (ctWord ^ state[2]) >>> 0;
        state[3] = (state[3] ^ data) >>> 0;
        const ptBytes = OpCodes.Unpack32LE(data);
        output.push(ptBytes[0], ptBytes[1], ptBytes[2], ptBytes[3]);
        cPos += 4;
        clen -= 4;
      }

      if (clen === 1) {
        state[1] = (state[1] ^ 0x50) >>> 0;
        this._permutation192(state, key, 9);
        const data = ((ciphertext[cPos] ^ state[2]) & 0xFF) >>> 0;
        state[3] = (state[3] ^ data) >>> 0;
        state[1] = (state[1] ^ 0x01) >>> 0;
        output.push(data);
      } else if (clen === 2) {
        state[1] = (state[1] ^ 0x50) >>> 0;
        this._permutation192(state, key, 9);
        const ctWord = OpCodes.Pack16LE(ciphertext[cPos], ciphertext[cPos + 1]);
        const data = ((ctWord ^ state[2]) & 0xFFFF) >>> 0;
        state[3] = (state[3] ^ data) >>> 0;
        state[1] = (state[1] ^ 0x02) >>> 0;
        output.push(data & 0xFF, (data >>> 8) & 0xFF);
      } else if (clen === 3) {
        state[1] = (state[1] ^ 0x50) >>> 0;
        this._permutation192(state, key, 9);
        const ctWord = OpCodes.Pack16LE(ciphertext[cPos], ciphertext[cPos + 1]) | (ciphertext[cPos + 2] << 16);
        const data = ((ctWord ^ state[2]) & 0xFFFFFF) >>> 0;
        state[3] = (state[3] ^ data) >>> 0;
        state[1] = (state[1] ^ 0x03) >>> 0;
        output.push(data & 0xFF, (data >>> 8) & 0xFF, (data >>> 16) & 0xFF);
      }

      // Generate expected tag
      const expectedTag = this._generateTag192(state, key);

      // Verify tag (constant-time comparison)
      if (!OpCodes.ConstantTimeCompare(expectedTag, providedTag)) {
        throw new Error("Authentication tag verification failed");
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }
  }

  // Register algorithms
  RegisterAlgorithm(new TinyJAMBU192());

  return {
    TinyJAMBU192
  };
}));
