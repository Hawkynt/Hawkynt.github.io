/*
 * XCBC-MAC Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * XCBC-MAC is a variant of CBC-MAC that uses three keys for improved security.
 * This implementation follows RFC 3566 and the LibTomCrypt reference implementation.
 * Uses AES as the underlying block cipher.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class XCBCAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XCBC-MAC";
      this.description = "Extended Cipher Block Chaining Message Authentication Code. Uses three derived keys with AES for cryptographic authentication.";
      this.inventor = "John Black, Phillip Rogaway";
      this.year = 2000;
      this.category = CategoryType.MAC;
      this.subCategory = "XCBC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(16, 16, 0)  // 128-bit MAC output
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("RFC 3566 - The AES-XCBC-MAC-96 Algorithm", "https://tools.ietf.org/html/rfc3566"),
        new LinkItem("Black & Rogaway - CBC MACs for Arbitrary-Length Messages", "https://web.cs.ucdavis.edu/~rogaway/papers/3k.pdf")
      ];

      // Reference links
      this.references = [
        new LinkItem("LibTomCrypt XCBC Implementation", "https://github.com/libtom/libtomcrypt/tree/develop/src/mac/xcbc"),
        new LinkItem("RFC 3566 Full Specification", "https://datatracker.ietf.org/doc/html/rfc3566")
      ];

      // Test vectors from LibTomCrypt xcbc_test.c
      this.tests = [
        // Test Case 1: Empty message
        {
          text: "LibTomCrypt Test Vector 1 - Empty Message",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c",
          input: [],
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("75f0251d528ac01c4573dfd584d79f29")
        },
        // Test Case 2: 3-byte message
        {
          text: "LibTomCrypt Test Vector 2 - 3 bytes",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c",
          input: OpCodes.Hex8ToBytes("000102"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("5b376580ae2f19afe7219ceef172756f")
        },
        // Test Case 3: Single block (16 bytes)
        {
          text: "LibTomCrypt Test Vector 3 - Single Block",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("d2a246fa349b68a79998a4394ff7a263")
        },
        // Test Case 4: Two blocks (32 bytes)
        {
          text: "LibTomCrypt Test Vector 4 - Two Blocks",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("f54f0ec8d2b9f3d36807734bd5283fd4")
        },
        // Test Case 5: 34 bytes (2 complete blocks + partial)
        {
          text: "LibTomCrypt Test Vector 5 - 34 bytes",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/xcbc/xcbc_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("becbb3bccdb518a30677d5481fb6b4d8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // XCBC-MAC cannot be reversed
      }
      return new XCBCInstance(this);
    }
  }

  // Instance class - handles the actual XCBC-MAC computation
  class XCBCInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.inputBuffer = [];
      this.iv = new Array(16).fill(0); // CBC-MAC state
      this.blockSize = 16; // AES block size

      // AES-128 S-box
      this.SBOX = [
        0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
        0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
        0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
        0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
        0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
        0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
        0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
        0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
        0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
        0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
        0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
        0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
        0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
        0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
        0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
        0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
      ];

      // AES round constants
      this.RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

      this.k1RoundKeys = null;  // Round keys for K1 (main encryption key)
      this.K = [null, null, null];  // K[0]=K1, K[1]=K2, K[2]=K3
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.k1RoundKeys = null;
        this.K = [null, null, null];
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error("XCBC-MAC requires 128-bit (16-byte) AES key");
      }

      this._key = [...keyBytes];
      this._deriveKeys();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Derive K1, K2, K3 keys as per XCBC specification
    // K1 is used for encryption
    // K2 is XORed with last block when message is complete block multiple
    // K3 is XORed with last block when message needs padding
    _deriveKeys() {
      // Create temporary key schedule for initial key
      const tempRoundKeys = this._expandKey(this._key);

      // Generate K1: encrypt block of 0x01 bytes
      const k1Block = new Array(16);
      for (let i = 0; i < 16; i++) {
        k1Block[i] = 0x01;
      }
      this.K[0] = this._aesEncryptWithKeys(k1Block, tempRoundKeys);

      // Generate K2: encrypt block of 0x02 bytes
      const k2Block = new Array(16);
      for (let i = 0; i < 16; i++) {
        k2Block[i] = 0x02;
      }
      this.K[1] = this._aesEncryptWithKeys(k2Block, tempRoundKeys);

      // Generate K3: encrypt block of 0x03 bytes
      const k3Block = new Array(16);
      for (let i = 0; i < 16; i++) {
        k3Block[i] = 0x03;
      }
      this.K[2] = this._aesEncryptWithKeys(k3Block, tempRoundKeys);

      // Now create round keys for K1 (used for actual message encryption)
      this.k1RoundKeys = this._expandKey(this.K[0]);
    }

    // Feed data to the MAC
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // Get the MAC result
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      const mac = this._computeXCBC();
      this.inputBuffer = []; // Clear buffer for next use
      this.iv.fill(0); // Reset IV
      return mac;
    }

    // Compute MAC (IMacInstance interface)
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Temporarily store current buffer and replace with new data
      const originalBuffer = this.inputBuffer;
      this.inputBuffer = [...data];
      const result = this.Result();
      this.inputBuffer = originalBuffer; // Restore original buffer
      return result;
    }

    // AES key expansion for AES-128
    _expandKey(key) {
      const roundKeys = [];
      const Nk = 4; // Number of 32-bit words in key (128 bits / 32 = 4)
      const Nb = 4; // Number of columns in state (always 4 for AES)
      const Nr = 10; // Number of rounds (10 for AES-128)

      const w = new Array((Nb * (Nr + 1))); // 44 words total

      // Copy key into first Nk words
      for (let i = 0; i < Nk; i++) {
        w[i] = [key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]];
      }

      // Generate remaining words
      for (let i = Nk; i < Nb * (Nr + 1); i++) {
        let temp = [...w[i-1]];

        if (i % Nk === 0) {
          // RotWord: rotate left by one byte
          const t = temp[0];
          temp[0] = temp[1];
          temp[1] = temp[2];
          temp[2] = temp[3];
          temp[3] = t;

          // SubWord: substitute bytes using S-box
          for (let j = 0; j < 4; j++) {
            temp[j] = this.SBOX[temp[j]];
          }

          // XOR with Rcon
          temp[0] ^= this.RCON[Math.floor(i/Nk) - 1];
        }

        // w[i] = w[i-Nk] XOR temp
        w[i] = [
          w[i-Nk][0] ^ temp[0],
          w[i-Nk][1] ^ temp[1],
          w[i-Nk][2] ^ temp[2],
          w[i-Nk][3] ^ temp[3]
        ];
      }

      // Convert word array to round key array
      for (let round = 0; round <= Nr; round++) {
        const roundKey = [];
        for (let col = 0; col < Nb; col++) {
          roundKey.push(...w[round * Nb + col]);
        }
        roundKeys[round] = roundKey;
      }

      return roundKeys;
    }

    // AES-128 encryption with specific round keys
    _aesEncryptWithKeys(plaintext, roundKeys) {
      let state = [...plaintext];

      // Initial AddRoundKey
      this._addRoundKey(state, roundKeys[0]);

      // 9 main rounds
      for (let round = 1; round < 10; round++) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, roundKeys[round]);
      }

      // Final round (no MixColumns)
      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, roundKeys[10]);

      return state;
    }

    // AES-128 encryption with K1 keys
    _aesEncrypt(plaintext) {
      return this._aesEncryptWithKeys(plaintext, this.k1RoundKeys);
    }

    _addRoundKey(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] ^= roundKey[i];
      }
    }

    _subBytes(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
    }

    _shiftRows(state) {
      // Row 1: shift left by 1
      const temp1 = state[1];
      state[1] = state[5];
      state[5] = state[9];
      state[9] = state[13];
      state[13] = temp1;

      // Row 2: shift left by 2
      const temp2a = state[2], temp2b = state[6];
      state[2] = state[10];
      state[6] = state[14];
      state[10] = temp2a;
      state[14] = temp2b;

      // Row 3: shift left by 3 (equivalent to shift right by 1)
      const temp3 = state[15];
      state[15] = state[11];
      state[11] = state[7];
      state[7] = state[3];
      state[3] = temp3;
    }

    _mixColumns(state) {
      for (let col = 0; col < 4; col++) {
        const c0 = state[col * 4];
        const c1 = state[col * 4 + 1];
        const c2 = state[col * 4 + 2];
        const c3 = state[col * 4 + 3];

        state[col * 4] = OpCodes.GF256Mul(c0, 2) ^ OpCodes.GF256Mul(c1, 3) ^ c2 ^ c3;
        state[col * 4 + 1] = c0 ^ OpCodes.GF256Mul(c1, 2) ^ OpCodes.GF256Mul(c2, 3) ^ c3;
        state[col * 4 + 2] = c0 ^ c1 ^ OpCodes.GF256Mul(c2, 2) ^ OpCodes.GF256Mul(c3, 3);
        state[col * 4 + 3] = OpCodes.GF256Mul(c0, 3) ^ c1 ^ c2 ^ OpCodes.GF256Mul(c3, 2);
      }
    }

    // Core XCBC-MAC computation following LibTomCrypt implementation
    _computeXCBC() {
      const msgLen = this.inputBuffer.length;
      let pos = 0;

      // Process all complete blocks (CBC-MAC chaining)
      while (pos + this.blockSize < msgLen) {
        // XOR block with IV
        for (let i = 0; i < this.blockSize; i++) {
          this.iv[i] ^= this.inputBuffer[pos + i];
        }
        // Encrypt with K1
        this.iv = this._aesEncrypt(this.iv);
        pos += this.blockSize;
      }

      // Handle final block
      const remainingBytes = msgLen - pos;

      if (remainingBytes === this.blockSize) {
        // Complete final block: XOR with K2
        for (let i = 0; i < this.blockSize; i++) {
          this.iv[i] ^= this.inputBuffer[pos + i];
          this.iv[i] ^= this.K[1][i];  // K2
        }
      } else {
        // Incomplete final block: pad with 0x80 and XOR with K3
        for (let i = 0; i < remainingBytes; i++) {
          this.iv[i] ^= this.inputBuffer[pos + i];
        }
        // Add padding byte
        this.iv[remainingBytes] ^= 0x80;
        // XOR with K3
        for (let i = 0; i < this.blockSize; i++) {
          this.iv[i] ^= this.K[2][i];  // K3
        }
      }

      // Final encryption with K1
      return this._aesEncrypt(this.iv);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new XCBCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XCBCAlgorithm, XCBCInstance };
}));
