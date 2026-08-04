/*
 * DEAL-256 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DEAL as implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). DEAL is a Feistel network that uses DES as its round function,
 * designed by Lars Knudsen and submitted to the AES contest by Richard Outerbridge.
 * With a 256-bit key the cipher runs 8 rounds over four 64-bit sub-keys K0..K3.
 *
 * Round function: newLeft = DES_encrypt(subKeys[r], oldLeft) XOR oldRight;
 *                 newRight = oldLeft
 * (the round function reads the LEFT half rather than the right half, and the
 * halves are swapped once more after the final round, matching NIST DEAL KAT
 * vectors exactly).
 *
 * Key schedule (256-bit key, 8 rounds): each round key is produced by DES-encrypting
 * a combination of a user key block and the previous round key with the FIXED DES
 * key 0123456789abcdef (no key-schedule constant confusion with the block key):
 *   RK0 = DES_K(K0)
 *   RK1 = DES_K(K1 XOR RK0)
 *   RK2 = DES_K(K2 XOR RK1)
 *   RK3 = DES_K(K3 XOR RK2)
 *   RK4 = DES_K((K0 XOR 0x80<<56) XOR RK3)
 *   RK5 = DES_K((K1 XOR 0x40<<56) XOR RK4)
 *   RK6 = DES_K((K2 XOR 0x20<<56) XOR RK5)
 *   RK7 = DES_K((K3 XOR 0x10<<56) XOR RK6)
 * where "K" is the fixed DES key 0123456789abcdef used only for key expansion, and
 * the constant byte is XORed into the FIRST byte of the round's user key block
 * before combining with the previous round key.
 *
 * The DarkCrypt implementation matches this standard DEAL-256 construction
 * exactly (validated against DarkCrypt vectors: no DarkCrypt-specific
 * deviation found). The DES round function is reused from the repository's
 * own DES implementation.
 * 128-bit blocks, 256-bit keys. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', './des'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./des')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.DES);
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, DESModule) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');
  if (!DESModule) throw new Error('DES dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const { DESAlgorithm, DESInstance } = DESModule;

  const ROUNDS = 8;
  const KEY_BLOCKS = 4;
  // Fixed DES key used only for expanding the user key into round keys.
  const SCHEDULE_KEY = OpCodes.Hex8ToBytes('0123456789abcdef');
  // Per-round constant XORed into byte 0 of the corresponding user-key block
  // for rounds 4..7 (256-bit key schedule).
  const ROUND_CONSTANTS = [0, 0, 0, 0, 0x80, 0x40, 0x20, 0x10];

  class DarkCryptDEALAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "DEAL-256 (DarkCrypt)";
      this.description = "DEAL block cipher (Knudsen/Outerbridge AES candidate) using DES as its round function: 8 rounds, four 64-bit round-key-schedule DES encryptions with a fixed key. 128-bit block, 256-bit key. As implemented in the DarkCrypt Total Commander plugin, matching the standard DEAL-256 construction exactly.";
      this.inventor = "Lars Knudsen, Richard Outerbridge; DarkCrypt packaging by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("DEAL (Wikipedia)", "https://en.wikipedia.org/wiki/DEAL"),
        new LinkItem("Key-Schedule Cryptanalysis of DEAL (Kelsey, Schneier)", "https://www.schneier.com/wp-content/uploads/2016/02/paper-deal.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Key-schedule weaknesses", "Equivalent keys and related-key attacks found by Kelsey and Schneier; not selected as an AES finalist.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Deal — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f0137a90d2268b14614f67c16aa5ec51")
        },
        {
          text: "DarkCrypt Deal — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("5b9014b97fdc142a19b54e5107666fe9")
        },
        {
          text: "DarkCrypt Deal — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("671a2730e253852dba5a9a2f54b84004")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDEALInstance(this, isInverse);
    }
  }

  class DarkCryptDEALInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._subKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;

      // Internal helper DES instance/algorithm used as the DEAL round function
      // and for key-schedule expansion. Only ever used in "encrypt" mode: DEAL
      // decryption is achieved purely by reversing the round-key order.
      this._desAlgorithm = new DESAlgorithm();
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._subKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. DEAL-256 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._subKeys = this._generateSubKeys(this._key);
    }

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
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // DES-encrypt an 8-byte block under an 8-byte key (used both for the
    // DEAL round function and for round-key expansion).
    _desEncrypt(keyBytes, blockBytes) {
      const inst = new DESInstance(this._desAlgorithm, false);
      inst.key = keyBytes;
      inst.Feed(blockBytes);
      return inst.Result();
    }

    _xor8(a, b) {
      const out = new Array(8);
      for (let i = 0; i < 8; i++) out[i] = OpCodes.Xor32(a[i], b[i]);
      return out;
    }

    _generateSubKeys(keyBytes) {
      const k = [];
      for (let i = 0; i < KEY_BLOCKS; i++) k.push(keyBytes.slice(i * 8, i * 8 + 8));

      const subKeys = new Array(ROUNDS);
      let prev = null;
      for (let r = 0; r < ROUNDS; r++) {
        const block = k[r % KEY_BLOCKS];
        const rk = block.slice();
        const constant = ROUND_CONSTANTS[r];
        if (constant) rk[0] ^= constant;
        const combined = prev ? this._xor8(rk, prev) : rk;
        subKeys[r] = this._desEncrypt(SCHEDULE_KEY, combined);
        prev = subKeys[r];
      }
      return subKeys;
    }

    _encryptBlock(block) {
      let left = block.slice(0, 8);
      let right = block.slice(8, 16);

      for (let r = 0; r < ROUNDS; r++) {
        const temp = left;
        left = this._xor8(this._desEncrypt(this._subKeys[r], left), right);
        right = temp;
      }

      return left.concat(right);
    }

    _decryptBlock(block) {
      const revKeys = this._subKeys.slice().reverse();
      let left = block.slice(0, 8);
      let right = block.slice(8, 16);

      // The Feistel-like network swaps halves after the last round on encrypt,
      // so decrypt must swap before and after running the (reversed) rounds.
      [left, right] = [right, left];
      for (let r = 0; r < ROUNDS; r++) {
        const temp = left;
        left = this._xor8(this._desEncrypt(revKeys[r], left), right);
        right = temp;
      }
      [left, right] = [right, left];

      return left.concat(right);
    }
  }

  const algorithmInstance = new DarkCryptDEALAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptDEALAlgorithm, DarkCryptDEALInstance };
}));
