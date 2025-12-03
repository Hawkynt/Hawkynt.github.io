/*
 * PMAC (Parallelizable MAC) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Based on LibTomCrypt reference implementation
 * A parallelizable message authentication code based on AES block cipher
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

  class PMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "PMAC";
      this.description = "Parallelizable Message Authentication Code using AES-128. Provides provably secure message authentication with parallel processing capability.";
      this.inventor = "Phillip Rogaway";
      this.year = 2002;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(16, 16, 0)  // 128-bit MAC output
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("PMAC: Parallelizable Message Authentication Code", "https://web.cs.ucdavis.edu/~rogaway/papers/pmac.pdf"),
        new LinkItem("LibTomCrypt PMAC Implementation", "https://github.com/libtom/libtomcrypt")
      ];

      // Reference links
      this.references = [
        new LinkItem("LibTomCrypt PMAC Source", "https://github.com/libtom/libtomcrypt/tree/develop/src/mac/pmac"),
        new LinkItem("PMAC Security Proof", "https://eprint.iacr.org/2002/039")
      ];

      // Test vectors from LibTomCrypt pmac_test.c
      this.tests = [
        // PMAC-AES-128-0B: Empty message
        {
          text: "LibTomCrypt PMAC-AES-128-0B (Empty)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c",
          input: [],
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("4399572cd6ea5341b8d35876a7098af7")
        },
        // PMAC-AES-128-3B: 3 bytes
        {
          text: "LibTomCrypt PMAC-AES-128-3B",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c",
          input: OpCodes.Hex8ToBytes("000102"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("256ba5193c1b991b4df0c51f388a9e27")
        },
        // PMAC-AES-128-16B: Single block (16 bytes)
        {
          text: "LibTomCrypt PMAC-AES-128-16B",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("ebbd822fa458daf6dfdad7c27da76338")
        },
        // PMAC-AES-128-20B: 20 bytes
        {
          text: "LibTomCrypt PMAC-AES-128-20B",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("0412ca150bbf79058d8c75a58c993f55")
        },
        // PMAC-AES-128-32B: Two blocks (32 bytes)
        {
          text: "LibTomCrypt PMAC-AES-128-32B",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("e97ac04e9e5e3399ce5355cd7407bc75")
        },
        // PMAC-AES-128-34B: 34 bytes (2 blocks + 2 bytes)
        {
          text: "LibTomCrypt PMAC-AES-128-34B",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("5cba7d5eb24f7c86ccc54604e53d5512")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PMAC cannot be reversed
      }
      return new PMACInstance(this);
    }
  }

  // Instance class - handles the actual PMAC computation
  /**
 * PMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.inputBuffer = [];
      this.checksum = new Array(16).fill(0);
      this.Li = new Array(16).fill(0);
      this.Ls = null; // Array of 32 L-values
      this.Lr = null; // L / x
      this.block_index = 1;
      this.blockLen = 16; // AES block size

      // AES-128 S-box (embedded for self-contained operation)
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

      this.roundKeys = null;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.Ls = null;
        this.Lr = null;
        this.roundKeys = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error("PMAC requires 128-bit (16-byte) AES key");
      }

      this._key = [...keyBytes];
      this.roundKeys = null; // Will be expanded on first use

      // Generate L-values cache
      this._generateLValues();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Feed data to the MAC
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // Get the MAC result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      // Note: Empty input is valid for PMAC

      const mac = this._computePMAC();
      this.inputBuffer = []; // Clear buffer for next use
      this.checksum.fill(0); // Reset checksum
      this.Li.fill(0); // Reset Li
      this.block_index = 1; // Reset block index
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

    // Generate L-values cache (Ls[0..31] and Lr)
    _generateLValues() {
      // Polynomial constants for 16-byte blocks (128-bit)
      const poly_mul = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x87
      ];
      const poly_div = [
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x43
      ];

      // Compute L = E[0] (encrypt zero block)
      const zeroBlock = new Array(16).fill(0);
      const L = this._aesEncrypt(zeroBlock);

      // Initialize Ls array
      this.Ls = new Array(32);
      for (let i = 0; i < 32; i++) {
        this.Ls[i] = new Array(16);
      }

      // Ls[0] = L
      for (let i = 0; i < 16; i++) {
        this.Ls[0][i] = L[i];
      }

      // Generate Ls[i] = L << i for i = 1..31
      for (let x = 1; x < 32; x++) {
        const m = OpCodes.Shr32(this.Ls[x-1][0], 7); // Get MSB

        // Left shift by 1 bit
        for (let y = 0; y < 15; y++) {
          this.Ls[x][y] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(this.Ls[x-1][y], 1), OpCodes.Shr32(this.Ls[x-1][y+1], 7)), 0xFF);
        }
        this.Ls[x][15] = OpCodes.AndN(OpCodes.Shl32(this.Ls[x-1][15], 1), 0xFF);

        // If MSB was 1, XOR with polynomial
        if (m === 1) {
          for (let y = 0; y < 16; y++) {
            this.Ls[x][y] = OpCodes.XorN(this.Ls[x][y], poly_mul[y]);
          }
        }
      }

      // Generate Lr = L / x (right shift with polynomial)
      this.Lr = new Array(16);
      const m = OpCodes.AndN(L[15], 1); // Get LSB

      // Right shift by 1 bit
      for (let x = 15; x > 0; x--) {
        this.Lr[x] = OpCodes.AndN(OpCodes.OrN(OpCodes.Shr32(L[x], 1), OpCodes.Shl32(L[x-1], 7)), 0xFF);
      }
      this.Lr[0] = OpCodes.Shr32(L[0], 1);

      // If LSB was 1, XOR with division polynomial
      if (m === 1) {
        for (let x = 0; x < 16; x++) {
          this.Lr[x] = OpCodes.XorN(this.Lr[x], poly_div[x]);
        }
      }
    }

    // PMAC shift_xor operation
    _pmac_shift_xor() {
      const y = this._pmac_ntz(this.block_index);
      this.block_index++;

      // Li ^= Ls[y]
      for (let x = 0; x < this.blockLen; x++) {
        this.Li[x] = OpCodes.XorN(this.Li[x], this.Ls[y][x]);
      }
    }

    // Number of trailing zeros (NTZ)
    _pmac_ntz(x) {
      x = OpCodes.AndN(x, 0xFFFFFFFF);
      let c = 0;
      while (OpCodes.AndN(x, 1) === 0) {
        c++;
        x = OpCodes.Shr32(x, 1);
      }
      return c;
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
          temp[0] = OpCodes.XorN(temp[0], this.RCON[Math.floor(i/Nk) - 1]);
        }

        // w[i] = w[i-Nk] XOR temp
        w[i] = [
          OpCodes.XorN(w[i-Nk][0], temp[0]),
          OpCodes.XorN(w[i-Nk][1], temp[1]),
          OpCodes.XorN(w[i-Nk][2], temp[2]),
          OpCodes.XorN(w[i-Nk][3], temp[3])
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

    // AES-128 encryption (embedded implementation)
    _aesEncrypt(plaintext) {
      if (!this.roundKeys) {
        this.roundKeys = this._expandKey(this._key);
      }

      let state = [...plaintext];

      // Initial AddRoundKey
      this._addRoundKey(state, this.roundKeys[0]);

      // 9 main rounds
      for (let round = 1; round < 10; round++) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, this.roundKeys[round]);
      }

      // Final round (no MixColumns)
      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, this.roundKeys[10]);

      return state;
    }

    _addRoundKey(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] = OpCodes.XorN(state[i], roundKey[i]);
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

        state[col * 4] = OpCodes.AndN(OpCodes.XorN(OpCodes.GF256Mul(c0, 2), OpCodes.XorN(OpCodes.GF256Mul(c1, 3), OpCodes.XorN(c2, c3))), 0xFF);
        state[col * 4 + 1] = OpCodes.AndN(OpCodes.XorN(c0, OpCodes.XorN(OpCodes.GF256Mul(c1, 2), OpCodes.XorN(OpCodes.GF256Mul(c2, 3), c3))), 0xFF);
        state[col * 4 + 2] = OpCodes.AndN(OpCodes.XorN(c0, OpCodes.XorN(c1, OpCodes.XorN(OpCodes.GF256Mul(c2, 2), OpCodes.GF256Mul(c3, 3)))), 0xFF);
        state[col * 4 + 3] = OpCodes.AndN(OpCodes.XorN(OpCodes.GF256Mul(c0, 3), OpCodes.XorN(c1, OpCodes.XorN(c2, OpCodes.GF256Mul(c3, 2)))), 0xFF);
      }
    }

    // Compute PMAC
    _computePMAC() {
      const msgLen = this.inputBuffer.length;
      let offset = 0;

      // Process all complete blocks EXCEPT possibly the last one
      // We need to handle the final block specially (complete or incomplete)
      const numCompleteBlocks = Math.floor(msgLen / this.blockLen);
      const isLastBlockComplete = (msgLen % this.blockLen === 0);

      // Process all blocks except the final one (if message is not empty)
      const blocksToProcess = msgLen === 0 ? 0 : (isLastBlockComplete ? numCompleteBlocks - 1 : numCompleteBlocks);

      for (let blockNum = 0; blockNum < blocksToProcess; blockNum++) {
        // Update Li for this block
        this._pmac_shift_xor();

        // Z = Li XOR block
        const Z = new Array(this.blockLen);
        for (let x = 0; x < this.blockLen; x++) {
          Z[x] = OpCodes.XorN(this.Li[x], this.inputBuffer[offset + x]);
        }

        // Encrypt Z
        const encZ = this._aesEncrypt(Z);

        // checksum ^= E(Z)
        for (let x = 0; x < this.blockLen; x++) {
          this.checksum[x] = OpCodes.XorN(this.checksum[x], encZ[x]);
        }

        offset += this.blockLen;
      }

      // Handle final block
      const remaining = msgLen - offset;

      if (remaining === this.blockLen) {
        // Final block is complete - XOR block with checksum and Lr
        for (let x = 0; x < this.blockLen; x++) {
          this.checksum[x] = OpCodes.XorN(this.checksum[x], OpCodes.XorN(this.inputBuffer[offset + x], this.Lr[x]));
        }
      } else {
        // Final block is incomplete (or empty message)
        // XOR partial bytes then add 0x80 padding
        for (let x = 0; x < remaining; x++) {
          this.checksum[x] = OpCodes.XorN(this.checksum[x], this.inputBuffer[offset + x]);
        }
        this.checksum[remaining] = OpCodes.XorN(this.checksum[remaining], 0x80);
      }

      // Final encryption: MAC = E(checksum)
      const mac = this._aesEncrypt(this.checksum);
      return mac;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new PMACAlgorithm());

  return { PMACAlgorithm, PMACInstance };
}));
