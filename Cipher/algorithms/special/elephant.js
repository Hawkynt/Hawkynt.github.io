/*
 * Elephant Family - Lightweight Authenticated Encryption Algorithms
 * NIST LWC Winner - Duplex Sponge Construction
 * Variants: Dumbo (Spongent-π[160]), Jumbo (Spongent-π[176]), Delirium (Keccak[200])
 * Reference: https://github.com/rweather/lwc-finalists
 * (c)2024 SynthelicZ Cipher Tools - Production Implementation
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

(function(root, factory) {
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
})(), function(AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework is required for Elephant');
  }
  if (!OpCodes) {
    throw new Error('OpCodes is required for Elephant');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Helper functions
  function leftRotate3_8(x) {
    return ((x << 3) | (x >>> 5)) & 0xFF;
  }

  function leftRotate1_8(x) {
    return ((x << 1) | (x >>> 7)) & 0xFF;
  }

  function xorBlock(dest, src, length, destOffset = 0, srcOffset = 0) {
    for (let i = 0; i < length; i++) {
      dest[destOffset + i] ^= src[srcOffset + i];
    }
  }

  function xorBlock2Src(dest, src1, src2, length, destOffset = 0) {
    for (let i = 0; i < length; i++) {
      dest[destOffset + i] = src1[i] ^ src2[i];
    }
  }

  // ===== SPONGENT PERMUTATION =====

  // Spongent S-box (4-bit) implemented as lookup table
  const SPONGENT_SBOX = new Uint8Array([
    0xE, 0xD, 0xB, 0x0, 0x2, 0x1, 0x4, 0xF,
    0x7, 0xA, 0x8, 0x5, 0x9, 0xC, 0x3, 0x6
  ]);

  // Spongent S-box applied to all nibbles in a byte array
  function spongentSboxLayer(state, length) {
    for (let i = 0; i < length; i++) {
      const highNibble = SPONGENT_SBOX[(state[i] >>> 4) & 0xF];
      const lowNibble = SPONGENT_SBOX[state[i] & 0xF];
      state[i] = (highNibble << 4) | lowNibble;
    }
  }

  // Spongent-π[160] permutation - 80 rounds, 160-bit state
  function spongent160Permute(state) {
    const RC = new Uint8Array([
      0x75, 0xae, 0x6a, 0x56, 0x54, 0x2a, 0x29, 0x94,
      0x53, 0xca, 0x27, 0xe4, 0x4f, 0xf2, 0x1f, 0xf8,
      0x3e, 0x7c, 0x7d, 0xbe, 0x7a, 0x5e, 0x74, 0x2e,
      0x68, 0x16, 0x50, 0x0a, 0x21, 0x84, 0x43, 0xc2,
      0x07, 0xe0, 0x0e, 0x70, 0x1c, 0x38, 0x38, 0x1c,
      0x71, 0x8e, 0x62, 0x46, 0x44, 0x22, 0x09, 0x90,
      0x12, 0x48, 0x24, 0x24, 0x49, 0x92, 0x13, 0xc8,
      0x26, 0x64, 0x4d, 0xb2, 0x1b, 0xd8, 0x36, 0x6c,
      0x6d, 0xb6, 0x5a, 0x5a, 0x35, 0xac, 0x6b, 0xd6,
      0x56, 0x6a, 0x2d, 0xb4, 0x5b, 0xda, 0x37, 0xec,
      0x6f, 0xf6, 0x5e, 0x7a, 0x3d, 0xbc, 0x7b, 0xde,
      0x76, 0x6e, 0x6c, 0x36, 0x58, 0x1a, 0x31, 0x8c,
      0x63, 0xc6, 0x46, 0x62, 0x0d, 0xb0, 0x1a, 0x58,
      0x34, 0x2c, 0x69, 0x96, 0x52, 0x4a, 0x25, 0xa4,
      0x4b, 0xd2, 0x17, 0xe8, 0x2e, 0x74, 0x5d, 0xba,
      0x3b, 0xdc, 0x77, 0xee, 0x6e, 0x76, 0x5c, 0x3a,
      0x39, 0x9c, 0x73, 0xce, 0x66, 0x66, 0x4c, 0x32,
      0x19, 0x98, 0x32, 0x4c, 0x65, 0xa6, 0x4a, 0x52,
      0x15, 0xa8, 0x2a, 0x54, 0x55, 0xaa, 0x2b, 0xd4,
      0x57, 0xea, 0x2f, 0xf4, 0x5f, 0xfa, 0x3f, 0xfc
    ]);

    const tmp = new Uint8Array(20);

    for (let round = 0; round < 80; round++) {
      // Add round constants
      state[0] ^= RC[round * 2];
      state[19] ^= RC[round * 2 + 1];

      // S-box layer
      spongentSboxLayer(state, 20);

      // P-layer: bit permutation - bit i moves to (40 * i) % 159, except bit 159 stays
      tmp.fill(0);
      for (let i = 0; i < 20; i++) {
        for (let bit = 0; bit < 8; bit++) {
          const bitPos = (i << 3) + bit;
          let newPos;
          if (bitPos === 159) {
            newPos = 159;
          } else {
            newPos = (bitPos * 40) % 159;
          }
          if ((state[i] >>> bit) & 1) {
            tmp[newPos >>> 3] |= 1 << (newPos & 7);
          }
        }
      }
      state.set(tmp);
    }
  }

  // Spongent-π[176] permutation - 90 rounds, 176-bit state
  function spongent176Permute(state) {
    const RC = new Uint8Array([
      0x45, 0xa2, 0x0b, 0xd0, 0x16, 0x68, 0x2c, 0x34,
      0x59, 0x9a, 0x33, 0xcc, 0x67, 0xe6, 0x4e, 0x72,
      0x1d, 0xb8, 0x3a, 0x5c, 0x75, 0xae, 0x6a, 0x56,
      0x54, 0x2a, 0x29, 0x94, 0x53, 0xca, 0x27, 0xe4,
      0x4f, 0xf2, 0x1f, 0xf8, 0x3e, 0x7c, 0x7d, 0xbe,
      0x7a, 0x5e, 0x74, 0x2e, 0x68, 0x16, 0x50, 0x0a,
      0x21, 0x84, 0x43, 0xc2, 0x07, 0xe0, 0x0e, 0x70,
      0x1c, 0x38, 0x38, 0x1c, 0x71, 0x8e, 0x62, 0x46,
      0x44, 0x22, 0x09, 0x90, 0x12, 0x48, 0x24, 0x24,
      0x49, 0x92, 0x13, 0xc8, 0x26, 0x64, 0x4d, 0xb2,
      0x1b, 0xd8, 0x36, 0x6c, 0x6d, 0xb6, 0x5a, 0x5a,
      0x35, 0xac, 0x6b, 0xd6, 0x56, 0x6a, 0x2d, 0xb4,
      0x5b, 0xda, 0x37, 0xec, 0x6f, 0xf6, 0x5e, 0x7a,
      0x3d, 0xbc, 0x7b, 0xde, 0x76, 0x6e, 0x6c, 0x36,
      0x58, 0x1a, 0x31, 0x8c, 0x63, 0xc6, 0x46, 0x62,
      0x0d, 0xb0, 0x1a, 0x58, 0x34, 0x2c, 0x69, 0x96,
      0x52, 0x4a, 0x25, 0xa4, 0x4b, 0xd2, 0x17, 0xe8,
      0x2e, 0x74, 0x5d, 0xba, 0x3b, 0xdc, 0x77, 0xee,
      0x6e, 0x76, 0x5c, 0x3a, 0x39, 0x9c, 0x73, 0xce,
      0x66, 0x66, 0x4c, 0x32, 0x19, 0x98, 0x32, 0x4c,
      0x65, 0xa6, 0x4a, 0x52, 0x15, 0xa8, 0x2a, 0x54,
      0x55, 0xaa, 0x2b, 0xd4, 0x57, 0xea, 0x2f, 0xf4,
      0x5f, 0xfa, 0x3f, 0xfc
    ]);

    const tmp = new Uint8Array(22);

    for (let round = 0; round < 90; round++) {
      // Add round constants
      state[0] ^= RC[round * 2];
      state[21] ^= RC[round * 2 + 1];

      // S-box layer
      spongentSboxLayer(state, 22);

      // P-layer: bit permutation - bit i moves to (44 * i) % 175, except bit 175 stays
      tmp.fill(0);
      for (let i = 0; i < 22; i++) {
        for (let bit = 0; bit < 8; bit++) {
          const bitPos = (i << 3) + bit;
          if (bitPos >= 176) continue;

          let newPos;
          if (bitPos === 175) {
            newPos = 175;
          } else {
            newPos = (bitPos * 44) % 175;
          }
          if ((state[i] >>> bit) & 1) {
            tmp[newPos >>> 3] |= 1 << (newPos & 7);
          }
        }
      }
      state.set(tmp);
    }
  }

  // ===== KECCAK-P[200] PERMUTATION =====

  function keccakP200Permute(state) {
    const KeccakRoundConstants = new Uint8Array([
      0x01, 0x82, 0x8a, 0x00, 0x8b, 0x01, 0x81, 0x09,
      0x8a, 0x88, 0x09, 0x0a, 0x8b, 0x8b, 0x89, 0x03,
      0x02, 0x80
    ]);

    const KeccakRhoOffsets = new Uint8Array([
      0, 1, 6, 4, 3, 4, 4, 6, 7, 4, 3, 2, 3, 1, 7, 1, 5, 7, 5, 0, 2, 2, 5, 0, 6
    ]);

    const tempA = new Uint8Array(25);

    function ROL8(a, offset) {
      return ((a << offset) | (a >>> (8 - offset))) & 0xFF;
    }

    function index(x, y) {
      return x + y * 5;
    }

    for (let round = 0; round < 18; round++) {
      // Theta
      for (let x = 0; x < 5; x++) {
        tempA[x] = 0;
        for (let y = 0; y < 5; y++) {
          tempA[x] ^= state[index(x, y)];
        }
      }
      for (let x = 0; x < 5; x++) {
        tempA[x + 5] = ROL8(tempA[(x + 1) % 5], 1) ^ tempA[(x + 4) % 5];
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[index(x, y)] ^= tempA[x + 5];
        }
      }

      // Rho
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          tempA[index(x, y)] = ROL8(state[index(x, y)], KeccakRhoOffsets[index(x, y)]);
        }
      }

      // Pi
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[index(y, (2 * x + 3 * y) % 5)] = tempA[index(x, y)];
        }
      }

      // Chi
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          tempA[x] = state[index(x, y)] ^ ((~state[index((x + 1) % 5, y)]) & state[index((x + 2) % 5, y)]);
        }
        for (let x = 0; x < 5; x++) {
          state[index(x, y)] = tempA[x];
        }
      }

      // Iota
      state[0] ^= KeccakRoundConstants[round];
    }
  }

  // ===== DUMBO ALGORITHM (Spongent-π[160]) =====

  class DumboAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Dumbo";
      this.description = "Dumbo is a member of the Elephant family, winner of NIST Lightweight Cryptography competition. Based on Spongent-π[160] permutation with duplex sponge construction for authenticated encryption.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("Elephant Family Specification", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Competition", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lwc-finalists")
      ];

      this.tests = [
        {
          text: "Dumbo KAT Count=1 - Empty PT, Empty AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/elephant_dumbo.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("99AD0D35BBB90AA7")
        }
      ];
    }

    CreateInstance(isDecryption = false) {
      return new DumboInstance(this, isDecryption);
    }
  }

  class DumboInstance extends IAlgorithmInstance {
    constructor(algorithm, isDecryption = false) {
      super(algorithm);
      this.isDecryption = isDecryption;
      this.inputBuffer = [];
      this._key = null;
      this._nonce = null;
      this._associatedData = [];

      this.KEY_SIZE = 16;
      this.NONCE_SIZE = 12;
      this.TAG_SIZE = 8;
      this.STATE_SIZE = 20;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== this.KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${this.KEY_SIZE})`);
      }
      this._key = new Uint8Array(keyBytes);
    }

    get key() { return this._key ? Array.from(this._key) : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (nonceBytes.length !== this.NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${this.NONCE_SIZE})`);
      }
      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() { return this._nonce ? Array.from(this._nonce) : null; }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? new Uint8Array(adBytes) : new Uint8Array(0);
    }

    get associatedData() { return Array.from(this._associatedData); }

    set aad(adBytes) { this.associatedData = adBytes; }
    get aad() { return this.associatedData; }

    dumboLfsr(out, inp) {
      const temp = leftRotate3_8(inp[0]) ^ (inp[3] << 7) ^ (inp[13] >>> 7);
      for (let i = 0; i < this.STATE_SIZE - 1; i++) {
        out[i] = inp[i + 1];
      }
      out[this.STATE_SIZE - 1] = temp;
    }

    processAD(state, mask, next, tag, npub, ad, adlen) {
      let posn, size;

      // Compute first two masks
      this.dumboLfsr(next, mask);
      this.dumboLfsr(next, next);

      // Absorb nonce
      xorBlock2Src(state, mask, next, this.STATE_SIZE);
      xorBlock(state, npub, this.NONCE_SIZE);

      // Absorb associated data
      posn = this.NONCE_SIZE;
      let adOff = 0;
      while (adlen > 0) {
        size = this.STATE_SIZE - posn;
        if (size <= adlen) {
          // Complete block
          xorBlock(state, ad, size, posn, adOff);
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
          this.dumboLfsr(mask, mask);
          this.dumboLfsr(next, next);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          posn = 0;
        } else {
          // Partial block
          size = adlen;
          xorBlock(state, ad, size, posn, adOff);
          posn += size;
        }
        adOff += size;
        adlen -= size;
      }

      // Pad and absorb final block
      state[posn] ^= 0x01;
      spongent160Permute(state);
      xorBlock(state, mask, this.TAG_SIZE);
      xorBlock(state, next, this.TAG_SIZE);
      xorBlock(tag, state, this.TAG_SIZE);
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const state = new Uint8Array(this.STATE_SIZE);
      const start = new Uint8Array(this.STATE_SIZE);
      const mask = new Uint8Array(this.STATE_SIZE);
      const next = new Uint8Array(this.STATE_SIZE);
      const tag = new Uint8Array(this.TAG_SIZE);

      if (this.isDecryption) {
        // Decryption
        if (this.inputBuffer.length < this.TAG_SIZE) {
          throw new Error("Ciphertext too short");
        }

        const clen = this.inputBuffer.length - this.TAG_SIZE;
        const c = new Uint8Array(this.inputBuffer);
        const m = new Uint8Array(clen);

        // Hash key and generate initial mask
        state.set(this._key);
        spongent160Permute(state);
        mask.set(state.subarray(0, this.KEY_SIZE));
        start.set(mask);

        // Process nonce and AD
        this.processAD(state, mask, next, tag, this._nonce, this._associatedData, this._associatedData.length);

        // Reset mask
        mask.set(start);

        // Decrypt payload
        let mlen = clen;
        let coff = 0;
        let moff = 0;
        while (mlen >= this.STATE_SIZE) {
          // Authenticate with next mask
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          xorBlock(state, c, this.STATE_SIZE, 0, coff);
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          // Decrypt with current mask
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent160Permute(state);
          xorBlock(state, mask, this.STATE_SIZE);
          for (let i = 0; i < this.STATE_SIZE; i++) {
            m[moff + i] = state[i] ^ c[coff + i];
          }

          mask.set(next);
          coff += this.STATE_SIZE;
          moff += this.STATE_SIZE;
          mlen -= this.STATE_SIZE;
        }

        if (mlen > 0) {
          // Authenticate last block
          const temp = mlen;
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          xorBlock(state, c, temp, 0, coff);
          state[temp] ^= 0x01;
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          // Decrypt last block
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent160Permute(state);
          xorBlock(state, mask, temp);
          for (let i = 0; i < temp; i++) {
            m[moff + i] = state[i] ^ c[coff + i];
          }
        } else if (clen !== 0) {
          // Pad when last block aligned
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          state[0] ^= 0x01;
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
        }

        // Verify tag
        const receivedTag = c.subarray(clen);
        for (let i = 0; i < this.TAG_SIZE; i++) {
          if (tag[i] !== receivedTag[i]) {
            throw new Error("Authentication failed");
          }
        }

        this.inputBuffer = [];
        return Array.from(m);

      } else {
        // Encryption
        const m = new Uint8Array(this.inputBuffer);
        const mlen = m.length;
        const c = new Uint8Array(mlen + this.TAG_SIZE);

        // Hash key and generate initial mask
        state.set(this._key);
        spongent160Permute(state);
        mask.set(state.subarray(0, this.KEY_SIZE));
        start.set(mask);

        // Process nonce and AD
        this.processAD(state, mask, next, tag, this._nonce, this._associatedData, this._associatedData.length);

        // Reset mask
        mask.set(start);

        // Encrypt payload
        let remaining = mlen;
        let moff = 0;
        let coff = 0;
        while (remaining >= this.STATE_SIZE) {
          // Encrypt with current mask
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent160Permute(state);
          xorBlock(state, m, this.STATE_SIZE, 0, moff);
          xorBlock(state, mask, this.STATE_SIZE);
          c.set(state.subarray(0, this.STATE_SIZE), coff);

          // Authenticate with next mask
          this.dumboLfsr(next, mask);
          xorBlock(state, mask, this.STATE_SIZE);
          xorBlock(state, next, this.STATE_SIZE);
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          mask.set(next);
          coff += this.STATE_SIZE;
          moff += this.STATE_SIZE;
          remaining -= this.STATE_SIZE;
        }

        if (remaining > 0) {
          // Encrypt last block
          const temp = remaining;
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent160Permute(state);
          xorBlock(state, m, temp, 0, moff);
          xorBlock(state, mask, this.STATE_SIZE);
          c.set(state.subarray(0, temp), coff);

          // Authenticate last block
          this.dumboLfsr(next, mask);
          state[temp] = 0x01;
          state.fill(0, temp + 1, this.STATE_SIZE);
          xorBlock(state, mask, this.STATE_SIZE);
          xorBlock(state, next, this.STATE_SIZE);
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
          coff += temp;
        } else if (mlen !== 0) {
          // Pad when last block aligned
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          state[0] ^= 0x01;
          spongent160Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
        }

        // Append tag
        c.set(tag, coff);

        this.inputBuffer = [];
        return Array.from(c);
      }
    }
  }

  // ===== JUMBO ALGORITHM (Spongent-π[176]) =====

  class JumboAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Jumbo";
      this.description = "Jumbo is a member of the Elephant family, winner of NIST Lightweight Cryptography competition. Based on Spongent-π[176] permutation with enhanced security margin.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("Elephant Family Specification", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Competition", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lwc-finalists")
      ];

      this.tests = [
        {
          text: "Jumbo KAT Count=1 - Empty PT, Empty AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/elephant_jumbo.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("F9F52C3201D8EE81")
        }
      ];
    }

    CreateInstance(isDecryption = false) {
      return new JumboInstance(this, isDecryption);
    }
  }

  class JumboInstance extends DumboInstance {
    constructor(algorithm, isDecryption = false) {
      super(algorithm, isDecryption);
      this.STATE_SIZE = 22;
    }

    dumboLfsr(out, inp) {
      const temp = leftRotate1_8(inp[0]) ^ (inp[3] << 7) ^ (inp[19] >>> 7);
      for (let i = 0; i < this.STATE_SIZE - 1; i++) {
        out[i] = inp[i + 1];
      }
      out[this.STATE_SIZE - 1] = temp;
    }

    processAD(state, mask, next, tag, npub, ad, adlen) {
      let posn, size;

      this.dumboLfsr(next, mask);
      this.dumboLfsr(next, next);

      xorBlock2Src(state, mask, next, this.STATE_SIZE);
      xorBlock(state, npub, this.NONCE_SIZE);

      posn = this.NONCE_SIZE;
      let adOff = 0;
      while (adlen > 0) {
        size = this.STATE_SIZE - posn;
        if (size <= adlen) {
          xorBlock(state, ad, size, posn, adOff);
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
          this.dumboLfsr(mask, mask);
          this.dumboLfsr(next, next);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          posn = 0;
        } else {
          size = adlen;
          xorBlock(state, ad, size, posn, adOff);
          posn += size;
        }
        adOff += size;
        adlen -= size;
      }

      state[posn] ^= 0x01;
      spongent176Permute(state);
      xorBlock(state, mask, this.TAG_SIZE);
      xorBlock(state, next, this.TAG_SIZE);
      xorBlock(tag, state, this.TAG_SIZE);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const state = new Uint8Array(this.STATE_SIZE);
      const start = new Uint8Array(this.STATE_SIZE);
      const mask = new Uint8Array(this.STATE_SIZE);
      const next = new Uint8Array(this.STATE_SIZE);
      const tag = new Uint8Array(this.TAG_SIZE);

      if (this.isDecryption) {
        if (this.inputBuffer.length < this.TAG_SIZE) {
          throw new Error("Ciphertext too short");
        }

        const clen = this.inputBuffer.length - this.TAG_SIZE;
        const c = new Uint8Array(this.inputBuffer);
        const m = new Uint8Array(clen);

        state.set(this._key);
        spongent176Permute(state);
        mask.set(state.subarray(0, this.KEY_SIZE));
        start.set(mask);

        this.processAD(state, mask, next, tag, this._nonce, this._associatedData, this._associatedData.length);
        mask.set(start);

        let mlen = clen;
        let coff = 0;
        let moff = 0;
        while (mlen >= this.STATE_SIZE) {
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          xorBlock(state, c, this.STATE_SIZE, 0, coff);
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent176Permute(state);
          xorBlock(state, mask, this.STATE_SIZE);
          for (let i = 0; i < this.STATE_SIZE; i++) {
            m[moff + i] = state[i] ^ c[coff + i];
          }

          mask.set(next);
          coff += this.STATE_SIZE;
          moff += this.STATE_SIZE;
          mlen -= this.STATE_SIZE;
        }

        if (mlen > 0) {
          const temp = mlen;
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          xorBlock(state, c, temp, 0, coff);
          state[temp] ^= 0x01;
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent176Permute(state);
          xorBlock(state, mask, temp);
          for (let i = 0; i < temp; i++) {
            m[moff + i] = state[i] ^ c[coff + i];
          }
        } else if (clen !== 0) {
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          state[0] ^= 0x01;
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
        }

        const receivedTag = c.subarray(clen);
        for (let i = 0; i < this.TAG_SIZE; i++) {
          if (tag[i] !== receivedTag[i]) {
            throw new Error("Authentication failed");
          }
        }

        this.inputBuffer = [];
        return Array.from(m);

      } else {
        const m = new Uint8Array(this.inputBuffer);
        const mlen = m.length;
        const c = new Uint8Array(mlen + this.TAG_SIZE);

        state.set(this._key);
        spongent176Permute(state);
        mask.set(state.subarray(0, this.KEY_SIZE));
        start.set(mask);

        this.processAD(state, mask, next, tag, this._nonce, this._associatedData, this._associatedData.length);
        mask.set(start);

        let remaining = mlen;
        let moff = 0;
        let coff = 0;
        while (remaining >= this.STATE_SIZE) {
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent176Permute(state);
          xorBlock(state, m, this.STATE_SIZE, 0, moff);
          xorBlock(state, mask, this.STATE_SIZE);
          c.set(state.subarray(0, this.STATE_SIZE), coff);

          this.dumboLfsr(next, mask);
          xorBlock(state, mask, this.STATE_SIZE);
          xorBlock(state, next, this.STATE_SIZE);
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          mask.set(next);
          coff += this.STATE_SIZE;
          moff += this.STATE_SIZE;
          remaining -= this.STATE_SIZE;
        }

        if (remaining > 0) {
          const temp = remaining;
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          spongent176Permute(state);
          xorBlock(state, m, temp, 0, moff);
          xorBlock(state, mask, this.STATE_SIZE);
          c.set(state.subarray(0, temp), coff);

          this.dumboLfsr(next, mask);
          state[temp] = 0x01;
          state.fill(0, temp + 1, this.STATE_SIZE);
          xorBlock(state, mask, this.STATE_SIZE);
          xorBlock(state, next, this.STATE_SIZE);
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
          coff += temp;
        } else if (mlen !== 0) {
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          state[0] ^= 0x01;
          spongent176Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
        }

        c.set(tag, coff);

        this.inputBuffer = [];
        return Array.from(c);
      }
    }
  }

  // ===== DELIRIUM ALGORITHM (Keccak[200]) =====

  class DeliriumAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Delirium";
      this.description = "Delirium is a member of the Elephant family, winner of NIST Lightweight Cryptography competition. Based on Keccak[200] permutation for maximum security.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.documentation = [
        new LinkItem("Elephant Family Specification", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Competition", "https://csrc.nist.gov/projects/lightweight-cryptography"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lwc-finalists")
      ];

      this.tests = [
        {
          text: "Delirium KAT Count=1 - Empty PT, Empty AD",
          uri: "https://github.com/rweather/lwc-finalists/blob/master/test/kat/elephant_delirium.txt",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          input: OpCodes.Hex8ToBytes(""),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("F15ACBDAAD35B3172B71A67F6D61743E")
        }
      ];
    }

    CreateInstance(isDecryption = false) {
      return new DeliriumInstance(this, isDecryption);
    }
  }

  class DeliriumInstance extends DumboInstance {
    constructor(algorithm, isDecryption = false) {
      super(algorithm, isDecryption);
      this.STATE_SIZE = 25;
      this.TAG_SIZE = 16;
    }

    dumboLfsr(out, inp) {
      const temp = leftRotate1_8(inp[0]) ^ leftRotate1_8(inp[2]) ^ (inp[13] << 1);
      for (let i = 0; i < this.STATE_SIZE - 1; i++) {
        out[i] = inp[i + 1];
      }
      out[this.STATE_SIZE - 1] = temp;
    }

    processAD(state, mask, next, tag, npub, ad, adlen) {
      let posn, size;

      this.dumboLfsr(next, mask);
      this.dumboLfsr(next, next);

      xorBlock2Src(state, mask, next, this.STATE_SIZE);
      xorBlock(state, npub, this.NONCE_SIZE);

      posn = this.NONCE_SIZE;
      let adOff = 0;
      while (adlen > 0) {
        size = this.STATE_SIZE - posn;
        if (size <= adlen) {
          xorBlock(state, ad, size, posn, adOff);
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
          this.dumboLfsr(mask, mask);
          this.dumboLfsr(next, next);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          posn = 0;
        } else {
          size = adlen;
          xorBlock(state, ad, size, posn, adOff);
          posn += size;
        }
        adOff += size;
        adlen -= size;
      }

      state[posn] ^= 0x01;
      keccakP200Permute(state);
      xorBlock(state, mask, this.TAG_SIZE);
      xorBlock(state, next, this.TAG_SIZE);
      xorBlock(tag, state, this.TAG_SIZE);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      const state = new Uint8Array(this.STATE_SIZE);
      const start = new Uint8Array(this.STATE_SIZE);
      const mask = new Uint8Array(this.STATE_SIZE);
      const next = new Uint8Array(this.STATE_SIZE);
      const tag = new Uint8Array(this.TAG_SIZE);

      if (this.isDecryption) {
        if (this.inputBuffer.length < this.TAG_SIZE) {
          throw new Error("Ciphertext too short");
        }

        const clen = this.inputBuffer.length - this.TAG_SIZE;
        const c = new Uint8Array(this.inputBuffer);
        const m = new Uint8Array(clen);

        state.set(this._key);
        keccakP200Permute(state);
        mask.set(state.subarray(0, this.KEY_SIZE));
        start.set(mask);

        this.processAD(state, mask, next, tag, this._nonce, this._associatedData, this._associatedData.length);
        mask.set(start);

        let mlen = clen;
        let coff = 0;
        let moff = 0;
        while (mlen >= this.STATE_SIZE) {
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          xorBlock(state, c, this.STATE_SIZE, 0, coff);
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          keccakP200Permute(state);
          xorBlock(state, mask, this.STATE_SIZE);
          for (let i = 0; i < this.STATE_SIZE; i++) {
            m[moff + i] = state[i] ^ c[coff + i];
          }

          mask.set(next);
          coff += this.STATE_SIZE;
          moff += this.STATE_SIZE;
          mlen -= this.STATE_SIZE;
        }

        if (mlen > 0) {
          const temp = mlen;
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          xorBlock(state, c, temp, 0, coff);
          state[temp] ^= 0x01;
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          keccakP200Permute(state);
          xorBlock(state, mask, temp);
          for (let i = 0; i < temp; i++) {
            m[moff + i] = state[i] ^ c[coff + i];
          }
        } else if (clen !== 0) {
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          state[0] ^= 0x01;
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
        }

        const receivedTag = c.subarray(clen);
        for (let i = 0; i < this.TAG_SIZE; i++) {
          if (tag[i] !== receivedTag[i]) {
            throw new Error("Authentication failed");
          }
        }

        this.inputBuffer = [];
        return Array.from(m);

      } else {
        const m = new Uint8Array(this.inputBuffer);
        const mlen = m.length;
        const c = new Uint8Array(mlen + this.TAG_SIZE);

        state.set(this._key);
        keccakP200Permute(state);
        mask.set(state.subarray(0, this.KEY_SIZE));
        start.set(mask);

        this.processAD(state, mask, next, tag, this._nonce, this._associatedData, this._associatedData.length);
        mask.set(start);

        let remaining = mlen;
        let moff = 0;
        let coff = 0;
        while (remaining >= this.STATE_SIZE) {
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          keccakP200Permute(state);
          xorBlock(state, m, this.STATE_SIZE, 0, moff);
          xorBlock(state, mask, this.STATE_SIZE);
          c.set(state.subarray(0, this.STATE_SIZE), coff);

          this.dumboLfsr(next, mask);
          xorBlock(state, mask, this.STATE_SIZE);
          xorBlock(state, next, this.STATE_SIZE);
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);

          mask.set(next);
          coff += this.STATE_SIZE;
          moff += this.STATE_SIZE;
          remaining -= this.STATE_SIZE;
        }

        if (remaining > 0) {
          const temp = remaining;
          state.set(mask);
          xorBlock(state, this._nonce, this.NONCE_SIZE);
          keccakP200Permute(state);
          xorBlock(state, m, temp, 0, moff);
          xorBlock(state, mask, this.STATE_SIZE);
          c.set(state.subarray(0, temp), coff);

          this.dumboLfsr(next, mask);
          state[temp] = 0x01;
          state.fill(0, temp + 1, this.STATE_SIZE);
          xorBlock(state, mask, this.STATE_SIZE);
          xorBlock(state, next, this.STATE_SIZE);
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
          coff += temp;
        } else if (mlen !== 0) {
          this.dumboLfsr(next, mask);
          xorBlock2Src(state, mask, next, this.STATE_SIZE);
          state[0] ^= 0x01;
          keccakP200Permute(state);
          xorBlock(state, mask, this.TAG_SIZE);
          xorBlock(state, next, this.TAG_SIZE);
          xorBlock(tag, state, this.TAG_SIZE);
        }

        c.set(tag, coff);

        this.inputBuffer = [];
        return Array.from(c);
      }
    }
  }

  // Register all Elephant family algorithms
  RegisterAlgorithm(new DumboAlgorithm());
  RegisterAlgorithm(new JumboAlgorithm());
  RegisterAlgorithm(new DeliriumAlgorithm());

  return {
    DumboAlgorithm,
    JumboAlgorithm,
    DeliriumAlgorithm
  };
}));
