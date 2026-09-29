/*
 * MBC2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The MBC2 block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). This appears to be an
 * original/obscure design, not a published cipher: it operates on the
 * 64-bit block as 64 individual bits (MSB-first per 32-bit little-endian
 * word) and applies 16 rounds of a bit-oriented substitution/diffusion
 * network driven by a large 588-byte table expanded from the 128-bit key.
 *
 * Key schedule (setup): the 16-byte key is viewed as four 32-bit
 * little-endian words; for each of the four byte "columns" (bit positions
 * 24, 16, 8, 0 of the words) a 4-byte group is extracted and combined into
 * a 16-byte buffer S via chained pairwise XORs (S is progressively rebuilt
 * per column, each column folding in the previous column's combinations).
 * A 588-byte table is then seeded with a mod-256 ramp (BT[i] = i & 0xFF)
 * and mutated in two full passes: the first replaces BT[i] with
 * ramp[i] XOR ((T[i&3] + S[i&0xF]) & 0xFF), evolving a 4-byte feedback
 * register T; the second replaces BT[i] with (BT[i] + (T[i&3] ^ S[i&0xF]))
 * & 0xFF, evolving T again — using a freshly re-derived S/T pair built from
 * the remaining two key columns.
 *
 * Round function (crypt, applied 16 times, table window sliding by 36
 * bytes with a 48-byte read span per round — the 588-byte table exactly
 * covers 16 rounds at that stride/span): each round reads a 48-byte table
 * window and derives a 64-entry index/selection array (48 values = table
 * byte >> 2, plus 16 values = adjacent-pair sums mod 64) and a 48-entry
 * parity array (bit1 XOR bit0 of each table byte); it then (1) permutes all
 * 64 state bits via a sequence of index-driven swaps, (2) runs a
 * carry-chained XOR cascade over the first 48 state bits using the parity
 * array, and (3) diffuses the upper 16 state bits with the lower ones
 * (state[j] ^= state[j-36] for j=48..63). Decryption reverses the round
 * order and undoes each step in reverse (self-inverse diffusion; a
 * carry-chained cascade read from the not-yet-updated neighbor; swaps
 * replayed in reverse sequence).
 *
 * As implemented in the DarkCrypt Total Commander plugin; test vectors
 * verified against the DarkCrypt implementation. 64-bit blocks, 128-bit
 * keys. Educational only.
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
}((function () {
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  /** @type {int32} */
  const TABLE_SIZE = 588;      // 0x24C bytes
  /** @type {int32} */
  const ROUNDS = 16;
  /** @type {int32} */
  const ROUND_STRIDE = 36;     // 0x24
  /** @type {int32} */
  const ROUND_SPAN = 48;       // 0x30 table bytes read per round
  /** @type {int32} */
  const STATE_BITS = 64;

  class DarkCryptMBC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MBC2 (DarkCrypt)";
      this.description = "Bit-oriented block cipher from the DarkCrypt Total Commander plugin: 16 rounds of table-driven bit substitution, cascade and permutation over a 64-bit state, keyed via a 588-byte table expanded from a 128-bit key. Original/obscure design (not a published algorithm).";
      this.inventor = "Alexander Myasnikov (\"Zarya\" project, DarkCrypt)";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary design", "MBC2 has no public specification, security proofs, or third-party cryptanalysis; its bit-level structure has not been vetted.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Mbc — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8481f5180a7dee0a")
        },
        {
          text: "DarkCrypt Mbc — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("adcb42a8ed9f9c2a")
        },
        {
          text: "DarkCrypt Mbc — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("493ab155c3194059")
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptMBC2Instance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptMBC2Instance(this, isInverse);
    }
  }

  class DarkCryptMBC2Instance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptMBC2Algorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._table = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._table = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. MBC2 (DarkCrypt) requires exactly 16 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._table = this._scheduleKey(this._key);
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Build the 588-byte key-dependent table from the 128-bit key.
    /**
     * @param {uint8[]} key - 16 key bytes
     * @returns {uint8[]} The 588-byte key-dependent table
     */
    _scheduleKey(key) {
      // Four "columns" of the 16-byte key viewed as four 32-bit little-endian words:
      // byte-position 3 (MSB), 2, 1, 0 (LSB) of each of the four words.
      /** @type {uint8[]} */
      const col3 = [key[3], key[7], key[11], key[15]];
      /** @type {uint8[]} */
      const col2 = [key[2], key[6], key[10], key[14]];
      /** @type {uint8[]} */
      const col1 = [key[1], key[5], key[9], key[13]];
      /** @type {uint8[]} */
      const col0 = [key[0], key[4], key[8], key[12]];

      /** @type {uint8[]} */
      const mix = new Array(16);
      mix[0] = OpCodes.Xor32(col3[0], col3[1]); mix[1] = OpCodes.Xor32(col3[0], col3[2]); mix[2] = OpCodes.Xor32(col3[0], col3[3]);
      mix[3] = OpCodes.Xor32(col3[1], col3[2]); mix[4] = OpCodes.Xor32(col3[1], col3[3]); mix[5] = OpCodes.Xor32(col3[2], col3[3]);
      mix[6] = col3[0]; mix[7] = col3[1]; mix[8] = col3[2]; mix[9] = col3[3];
      mix[0xA] = OpCodes.Xor32(mix[0], col2[0]); mix[0xB] = OpCodes.Xor32(mix[1], col2[1]); mix[0xC] = OpCodes.Xor32(mix[2], col2[2]); mix[0xD] = OpCodes.Xor32(mix[3], col2[3]);
      mix[0xE] = OpCodes.Xor32(col2[0], col2[1]); mix[0xF] = OpCodes.Xor32(col2[2], col2[3]);

      /** @type {uint8[]} */
      let fb = [col2[0], col2[1], col2[2], col2[3]];

      /** @type {uint8[]} */
      const table = new Array(TABLE_SIZE);
      table.fill(0);

      // Pass 1: XOR-combine a mod-256 ramp with a key/table-fed feedback register.
      for (let i = 0; i < TABLE_SIZE; i++) {
        const s = mix[OpCodes.And32(i, 0xF)];
        const idx2 = OpCodes.And32(i, 3);
        const t = fb[idx2];
        const mid = OpCodes.And32(t + s, 0xFF);
        const ramp = OpCodes.And32(i, 0xFF);
        const newval = OpCodes.Xor32(ramp, mid);
        table[i] = newval;
        fb[idx2] = newval;
      }

      // Re-derive S from the evolved feedback register, then fold in the remaining key columns.
      mix[0] = OpCodes.Xor32(fb[0], fb[1]); mix[1] = OpCodes.Xor32(fb[0], fb[2]); mix[2] = OpCodes.Xor32(fb[0], fb[3]);
      mix[3] = OpCodes.Xor32(fb[1], fb[2]); mix[4] = OpCodes.Xor32(fb[1], fb[3]); mix[5] = OpCodes.Xor32(fb[2], fb[3]);

      /** @type {uint8[]} */
      const t1 = [col1[0], col1[1], col1[2], col1[3]];
      fb = t1;
      mix[6] = OpCodes.Xor32(col1[0], mix[2]); mix[7] = OpCodes.Xor32(col1[1], mix[3]); mix[8] = OpCodes.Xor32(col1[2], mix[4]); mix[9] = OpCodes.Xor32(col1[3], mix[5]);

      /** @type {uint8[]} */
      const t0 = [col0[0], col0[1], col0[2], col0[3]];
      fb = t0;
      mix[0xA] = OpCodes.Xor32(col0[0], mix[6]); mix[0xB] = OpCodes.Xor32(col0[1], mix[7]); mix[0xC] = OpCodes.Xor32(col0[2], mix[8]); mix[0xD] = OpCodes.Xor32(col0[3], mix[9]);
      mix[0xE] = OpCodes.Xor32(col0[0], col0[2]); mix[0xF] = OpCodes.Xor32(col0[1], col0[3]);

      fb[1] = OpCodes.Xor32(fb[1], fb[0]);
      fb[2] = mix[0xE];
      fb[3] = OpCodes.Xor32(fb[3], fb[0]);
      // fb[0] unchanged (= col0[0])

      // Pass 2: additive mix of the (now XOR-combined) feedback register into the table.
      for (let i = 0; i < TABLE_SIZE; i++) {
        const s = mix[OpCodes.And32(i, 0xF)];
        const idx2 = OpCodes.And32(i, 3);
        const t = fb[idx2];
        const x = OpCodes.Xor32(t, s);
        const sum = OpCodes.And32(table[i] + x, 0xFF);
        table[i] = sum;
        fb[idx2] = sum;
      }

      return table;
    }

    // Unpack an 8-byte block into 64 bits, MSB-first within each little-endian 32-bit word.
    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} 64 bits (0/1)
     */
    _blockToBits(block) {
      /** @type {uint8[]} */
      const bits = new Array(STATE_BITS);
      const w0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const w1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      for (let b = 0; b < 32; b++) {
        bits[b] = OpCodes.GetBit(w0, 31 - b) ? 1 : 0;
        bits[32 + b] = OpCodes.GetBit(w1, 31 - b) ? 1 : 0;
      }
      return bits;
    }

    /**
     * @param {uint8[]} bits - 64 bits (0/1)
     * @returns {uint8[]} 8 bytes
     */
    _bitsToBlock(bits) {
      /** @type {uint32} */
      let w0 = 0;
      /** @type {uint32} */
      let w1 = 0;
      for (let b = 0; b < 32; b++) {
        w0 = OpCodes.Or32(w0, OpCodes.Shl32(bits[b] !== 0 ? 1 : 0, 31 - b));
        w1 = OpCodes.Or32(w1, OpCodes.Shl32(bits[32 + b] !== 0 ? 1 : 0, 31 - b));
      }
      return [...OpCodes.Unpack32LE(w0), ...OpCodes.Unpack32LE(w1)];
    }

    // Derive the per-round selection array (64 entries) and parity array (48 entries) from the
    // table window, returned as one array: selection at [0..64), parity at [64..112).
    /**
     * @param {uint8[]} table - Key-dependent table
     * @param {int32} winBase - Round window offset
     * @returns {uint8[]} Selection entries followed by parity bits
     */
    _roundArrays(table, winBase) {
      /** @type {uint8[]} */
      const top6 = new Array(ROUND_SPAN);
      /** @type {uint8[]} */
      const parity = new Array(ROUND_SPAN);
      for (let i = 0; i < ROUND_SPAN; i++) {
        const tb = table[winBase + i];
        top6[i] = OpCodes.Shr32(tb, 2);
        const bit1 = OpCodes.Shr32(OpCodes.And32(tb, 2), 1);
        const bit0 = OpCodes.And32(tb, 1);
        parity[i] = OpCodes.Xor32(bit1, bit0);
      }
      /** @type {uint8[]} */
      const sums = new Array(16);
      for (let i = 0; i < 16; i++) sums[i] = OpCodes.And32(top6[i] + top6[i + 1], 0x3F);
      return top6.concat(sums).concat(parity);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const state = this._blockToBits(block);
      for (let winBase = 0; winBase < ROUNDS * ROUND_STRIDE; winBase += ROUND_STRIDE) {
        const arrs = this._roundArrays(this._table, winBase);

        // Index-driven bit permutation.
        for (let i = 0; i < 64; i++) {
          const idx = arrs[i];
          const tmp = state[i]; state[i] = state[idx]; state[idx] = tmp;
        }

        // Carry-chained XOR cascade over the first 48 state bits.
        /** @type {uint8} */
        let carry = 0;
        for (let i = 0; i < 48; i++) {
          const s2 = OpCodes.And32(arrs[64 + i] + carry, 1);
          state[i] = OpCodes.Xor32(state[i], s2);
          carry = state[i];
        }

        // Diffuse the upper 16 state bits with the lower ones.
        for (let j = 48; j < 64; j++) state[j] = OpCodes.Xor32(state[j], state[j - 36]);
      }
      return this._bitsToBlock(state);
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const state = this._blockToBits(block);
      for (let winBase = (ROUNDS - 1) * ROUND_STRIDE; winBase >= 0; winBase -= ROUND_STRIDE) {
        const arrs = this._roundArrays(this._table, winBase);

        // Undo the diffusion (self-inverse XOR).
        for (let j = 48; j < 64; j++) state[j] = OpCodes.Xor32(state[j], state[j - 36]);

        // Undo the cascade: process descending, reading the not-yet-updated neighbor as carry.
        for (let i = 47; i >= 0; i--) {
          const carry = (i === 0) ? 0 : state[i - 1];
          const s2 = OpCodes.And32(arrs[64 + i] + carry, 1);
          state[i] = OpCodes.Xor32(state[i], s2);
        }

        // Undo the permutation: replay the same swaps in reverse sequence.
        for (let i = 63; i >= 0; i--) {
          const idx = arrs[i];
          const tmp = state[i]; state[i] = state[idx]; state[idx] = tmp;
        }
      }
      return this._bitsToBlock(state);
    }
  }

  const algorithmInstance = new DarkCryptMBC2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMBC2Algorithm, DarkCryptMBC2Instance };
}));
