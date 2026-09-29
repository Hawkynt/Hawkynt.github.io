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
   * @returns {PMACInstance} New MAC instance (null for the inverse)
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
 * PMAC instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class PMACInstance extends IMacInstance {
    /**
     * @param {PMACAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]} */
      this.checksum = OpCodes.CreateArray(16, 0);
      /** @type {uint8[]} */
      this.Li = OpCodes.CreateArray(16, 0);
      /** @type {uint8[][]} */
      this.Ls = null; // Array of 32 L-values
      /** @type {uint8[]} */
      this.Lr = null; // L / x
      /** @type {uint32} */
      this.block_index = 1;
      /** @type {int32} */
      this.blockLen = 16; // AES block size

      // AES-128 S-box (embedded for self-contained operation)
      /** @type {uint8[]} */
      this.SBOX = OpCodes.Hex8ToBytes(
        "637c777bf26b6fc53001672bfed7ab76" +
        "ca82c97dfa5947f0add4a2af9ca472c0" +
        "b7fd9326363ff7cc34a5e5f171d83115" +
        "04c723c31896059a071280e2eb27b275" +
        "09832c1a1b6e5aa0523bd6b329e32f84" +
        "53d100ed20fcb15b6acbbe394a4c58cf" +
        "d0efaafb434d338545f9027f503c9fa8" +
        "51a3408f929d38f5bcb6da2110fff3d2" +
        "cd0c13ec5f974417c4a77e3d645d1973" +
        "60814fdc222a908846eeb814de5e0bdb" +
        "e0323a0a4906245cc2d3ac629195e479" +
        "e7c8376d8dd54ea96c56f4ea657aae08" +
        "ba78252e1ca6b4c6e8dd741f4bbd8b8a" +
        "703eb5664803f60e613557b986c11d9e" +
        "e1f8981169d98e949b1e87e9ce5528df" +
        "8ca1890dbfe6426841992d0fb054bb16"
      );

      // AES round constants
      /** @type {uint8[]} */
      this.RCON = OpCodes.Hex8ToBytes("01020408102040801b36");

      /** @type {uint8[][]} */
      this.roundKeys = null;
    }

    // Property setter for key
    /**
   * Set the AES-128 key
   * @param {uint8[]} keyBytes - 16-byte key or null to clear
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

      this._key = keyBytes.slice();
      this.roundKeys = null; // Will be expanded on first use

      // Generate L-values cache
      this._generateLValues();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    // Feed data to the MAC
    /**
   * Feed data to the MAC
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the data is not a byte array
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the MAC result
    /**
   * Get the MAC of everything fed so far
   * @returns {uint8[]} 16-byte MAC
   * @throws {Error} If key not set
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

    /**
     * Compute MAC (IMacInstance interface)
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} 16-byte MAC
     */
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Temporarily store current buffer and replace with new data
      const originalBuffer = this.inputBuffer;
      this.inputBuffer = data.slice();
      const result = this.Result();
      this.inputBuffer = originalBuffer; // Restore original buffer
      return result;
    }

    /**
     * Generate L-values cache (Ls[0..31] and Lr)
     * @returns {void}
     */
    _generateLValues() {
      // Polynomial constants for 16-byte blocks (128-bit)
      /** @type {uint8[]} */
      const poly_mul = OpCodes.Hex8ToBytes("00000000000000000000000000000087");
      /** @type {uint8[]} */
      const poly_div = OpCodes.Hex8ToBytes("80000000000000000000000000000043");

      // Compute L = E[0] (encrypt zero block)
      /** @type {uint8[]} */
      const zeroBlock = OpCodes.CreateArray(16, 0);
      const L = this._aesEncrypt(zeroBlock);

      // Initialize Ls array
      /** @type {uint8[][]} */
      const Ls = new Array(32);
      for (let i = 0; i < 32; i++) {
        /** @type {uint8[]} */
        const row = new Array(16);
        Ls[i] = row;
      }
      this.Ls = Ls;

      // Ls[0] = L
      for (let i = 0; i < 16; i++) {
        Ls[0][i] = L[i];
      }

      // Generate Ls[i] = L << i for i = 1..31
      for (let x = 1; x < 32; x++) {
        /** @type {uint8[]} */
        const prev = Ls[x-1];
        /** @type {uint8[]} */
        const cur = Ls[x];
        const m = OpCodes.Shr8(prev[0], 7); // Get MSB

        // Left shift by 1 bit
        for (let y = 0; y < 15; y++) {
          cur[y] = OpCodes.Or8(OpCodes.Shl8(prev[y], 1), OpCodes.Shr8(prev[y+1], 7));
        }
        cur[15] = OpCodes.Shl8(prev[15], 1);

        // If MSB was 1, XOR with polynomial
        if (m === 1) {
          for (let y = 0; y < 16; y++) {
            cur[y] = OpCodes.Xor8(cur[y], poly_mul[y]);
          }
        }
      }

      // Generate Lr = L / x (right shift with polynomial)
      /** @type {uint8[]} */
      const Lr = new Array(16);
      this.Lr = Lr;
      const m = OpCodes.And8(L[15], 1); // Get LSB

      // Right shift by 1 bit
      for (let x = 15; x > 0; x--) {
        Lr[x] = OpCodes.Or8(OpCodes.Shr8(L[x], 1), OpCodes.Shl8(L[x-1], 7));
      }
      Lr[0] = OpCodes.Shr8(L[0], 1);

      // If LSB was 1, XOR with division polynomial
      if (m === 1) {
        for (let x = 0; x < 16; x++) {
          Lr[x] = OpCodes.Xor8(Lr[x], poly_div[x]);
        }
      }
    }

    /**
     * PMAC shift_xor operation: Li ^= Ls[ntz(block_index++)]
     * @returns {void}
     */
    _pmac_shift_xor() {
      const y = this._pmac_ntz(this.block_index);
      this.block_index++;

      /** @type {uint8[]} */
      const Ly = this.Ls[y];
      for (let x = 0; x < this.blockLen; x++) {
        this.Li[x] = OpCodes.Xor8(this.Li[x], Ly[x]);
      }
    }

    /**
     * Number of trailing zeros (NTZ)
     * @param {uint32} x - Nonzero value
     * @returns {int32} Count of trailing zero bits
     */
    _pmac_ntz(x) {
      /** @type {int32} */
      let c = 0;
      while (OpCodes.And32(x, 1) === 0) {
        c++;
        x = OpCodes.Shr32(x, 1);
      }
      return c;
    }

    /**
     * AES key expansion for AES-128
     * @param {uint8[]} key - 16-byte key
     * @returns {uint8[][]} 11 round keys of 16 bytes
     */
    _expandKey(key) {
      /** @type {uint8[][]} */
      const roundKeys = [];
      const Nk = 4; // Number of 32-bit words in key (128 bits / 32 = 4)
      const Nb = 4; // Number of columns in state (always 4 for AES)
      const Nr = 10; // Number of rounds (10 for AES-128)

      /** @type {uint8[][]} */
      const w = new Array((Nb * (Nr + 1))); // 44 words total

      // Copy key into first Nk words
      for (let i = 0; i < Nk; i++) {
        w[i] = key.slice(4 * i, 4 * i + 4);
      }

      // Generate remaining words
      for (let i = Nk; i < Nb * (Nr + 1); i++) {
        const temp = w[i-1].slice();

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
          temp[0] = OpCodes.Xor8(temp[0], this.RCON[Math.floor(i/Nk) - 1]);
        }

        // w[i] = w[i-Nk] XOR temp
        /** @type {uint8[]} */
        const prev = w[i-Nk];
        /** @type {uint8[]} */
        const next = new Array(4);
        for (let j = 0; j < 4; j++) {
          next[j] = OpCodes.Xor8(prev[j], temp[j]);
        }
        w[i] = next;
      }

      // Convert word array to round key array
      for (let round = 0; round <= Nr; round++) {
        /** @type {uint8[]} */
        const roundKey = [];
        for (let col = 0; col < Nb; col++) {
          /** @type {uint8[]} */
          const column = w[round * Nb + col];
          for (let j = 0; j < 4; j++) roundKey.push(column[j]);
        }
        roundKeys[round] = roundKey;
      }

      return roundKeys;
    }

    /**
     * AES-128 encryption (embedded implementation)
     * @param {uint8[]} plaintext - 16-byte block
     * @returns {uint8[]} 16-byte ciphertext block
     */
    _aesEncrypt(plaintext) {
      if (!this.roundKeys) {
        this.roundKeys = this._expandKey(this._key);
      }

      const state = plaintext.slice();

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

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @param {uint8[]} roundKey - 16-byte round key
     * @returns {void}
     */
    _addRoundKey(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] = OpCodes.Xor8(state[i], roundKey[i]);
      }
    }

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @returns {void}
     */
    _subBytes(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
    }

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @returns {void}
     */
    _shiftRows(state) {
      // Row 1: shift left by 1
      const temp1 = state[1];
      state[1] = state[5];
      state[5] = state[9];
      state[9] = state[13];
      state[13] = temp1;

      // Row 2: shift left by 2
      const temp2a = state[2];
      const temp2b = state[6];
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

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @returns {void}
     */
    _mixColumns(state) {
      for (let col = 0; col < 4; col++) {
        const c0 = state[col * 4];
        const c1 = state[col * 4 + 1];
        const c2 = state[col * 4 + 2];
        const c3 = state[col * 4 + 3];

        state[col * 4] = OpCodes.Xor8(OpCodes.GF256Mul(c0, 2), OpCodes.Xor8(OpCodes.GF256Mul(c1, 3), OpCodes.Xor8(c2, c3)));
        state[col * 4 + 1] = OpCodes.Xor8(c0, OpCodes.Xor8(OpCodes.GF256Mul(c1, 2), OpCodes.Xor8(OpCodes.GF256Mul(c2, 3), c3)));
        state[col * 4 + 2] = OpCodes.Xor8(c0, OpCodes.Xor8(c1, OpCodes.Xor8(OpCodes.GF256Mul(c2, 2), OpCodes.GF256Mul(c3, 3))));
        state[col * 4 + 3] = OpCodes.Xor8(OpCodes.GF256Mul(c0, 3), OpCodes.Xor8(c1, OpCodes.Xor8(c2, OpCodes.GF256Mul(c3, 2))));
      }
    }

    /**
     * Compute PMAC over inputBuffer
     * @returns {uint8[]} 16-byte MAC
     */
    _computePMAC() {
      const msgLen = this.inputBuffer.length;
      let offset = 0;

      // Process all complete blocks EXCEPT possibly the last one
      // We need to handle the final block specially (complete or incomplete)
      const numCompleteBlocks = Math.floor(msgLen / this.blockLen);
      const isLastBlockComplete = (msgLen % this.blockLen === 0);

      // Process all blocks except the final one (if message is not empty)
      /** @type {int32} */
      let blocksToProcess = numCompleteBlocks;
      if (msgLen === 0) blocksToProcess = 0;
      else if (isLastBlockComplete) blocksToProcess = numCompleteBlocks - 1;

      for (let blockNum = 0; blockNum < blocksToProcess; blockNum++) {
        // Update Li for this block
        this._pmac_shift_xor();

        // Z = Li XOR block
        /** @type {uint8[]} */
        const Z = new Array(this.blockLen);
        for (let x = 0; x < this.blockLen; x++) {
          Z[x] = OpCodes.Xor8(this.Li[x], this.inputBuffer[offset + x]);
        }

        // Encrypt Z
        const encZ = this._aesEncrypt(Z);

        // checksum ^= E(Z)
        for (let x = 0; x < this.blockLen; x++) {
          this.checksum[x] = OpCodes.Xor8(this.checksum[x], encZ[x]);
        }

        offset += this.blockLen;
      }

      // Handle final block
      const remaining = msgLen - offset;

      if (remaining === this.blockLen) {
        // Final block is complete - XOR block with checksum and Lr
        for (let x = 0; x < this.blockLen; x++) {
          this.checksum[x] = OpCodes.Xor8(this.checksum[x], OpCodes.Xor8(this.inputBuffer[offset + x], this.Lr[x]));
        }
      } else {
        // Final block is incomplete (or empty message)
        // XOR partial bytes then add 0x80 padding
        for (let x = 0; x < remaining; x++) {
          this.checksum[x] = OpCodes.Xor8(this.checksum[x], this.inputBuffer[offset + x]);
        }
        this.checksum[remaining] = OpCodes.Xor8(this.checksum[remaining], 0x80);
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
