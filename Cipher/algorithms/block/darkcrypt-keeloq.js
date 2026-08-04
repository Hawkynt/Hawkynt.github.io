/*
 * KeeLoq (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The KeeLoq block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). The 528-round NLFSR core (taps at bits
 * 1/9/20/26/31, fixed non-linear function constant 0x3A5C742E, key bit selected
 * round-robin from the 64-bit key) matches textbook KeeLoq exactly, but the
 * byte packing differs from common reference implementations:
 *   - the 32-bit block is loaded/stored little-endian
 *   - the 64-bit key is split into two little-endian 32-bit words, with the
 *     FIRST four key bytes forming the LOW word (key bits 0-31) and the LAST
 *     four key bytes forming the HIGH word (key bits 32-63)
 * Test vectors verified against the DarkCrypt implementation, including
 * encrypt/decrypt round-trip.
 * 32-bit blocks, 64-bit keys. Educational only.
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const NLF = 0x3A5C742E;
  const ROUNDS = 528;

  class DarkCryptKeeLoqAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "KeeLoq (DarkCrypt)";
      this.description = "KeeLoq variant from the DarkCrypt Total Commander plugin: standard 528-round NLFSR core, but block and key words are packed little-endian (vs. big-endian in common reference implementations). 32-bit block, 64-bit key.";
      this.inventor = "Nanoteq (Willem Smit); DarkCrypt packaging by Alexander Myasnikov";
      this.year = 1985;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(8, 8, 0)];   // fixed 64-bit
      this.SupportedBlockSizes = [new KeySize(4, 4, 0)]; // fixed 32-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Wikipedia - KeeLoq", "https://en.wikipedia.org/wiki/KeeLoq")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Cryptographically broken", "Practical key-recovery attacks exist against KeeLoq; not suitable for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Keeloq — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("00000000")
        },
        {
          text: "DarkCrypt Keeloq — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00010203"),
          key: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("24bc009e")
        },
        {
          text: "DarkCrypt Keeloq — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("10111213"),
          key: OpCodes.Hex8ToBytes("0102030405060708"),
          expected: OpCodes.Hex8ToBytes("75c2a9d9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptKeeLoqInstance(this, isInverse);
    }
  }

  class DarkCryptKeeLoqInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 4;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 8)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. KeeLoq (DarkCrypt) requires exactly 8 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
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

    _keyWords() {
      // First four key bytes -> low 32 bits (key bit index 0..31); last four -> high 32 bits (32..63). Little-endian words.
      const keyLow = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);
      const keyHigh = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
      return { keyLow, keyHigh };
    }

    _keyBit(keyLow, keyHigh, i) {
      const idx = i % 64;
      return idx < 32
        ? OpCodes.AndN(OpCodes.Shr32(keyLow, idx), 1)
        : OpCodes.AndN(OpCodes.Shr32(keyHigh, idx - 32), 1);
    }

    _nlf(idx) {
      return OpCodes.AndN(OpCodes.Shr32(NLF, idx), 1);
    }

    _encryptBlock(block) {
      let state = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const { keyLow, keyHigh } = this._keyWords();

      for (let i = 0; i < ROUNDS; ++i) {
        const b1 = OpCodes.AndN(OpCodes.Shr32(state, 1), 1);
        const b9 = OpCodes.AndN(OpCodes.Shr32(state, 9), 1);
        const b20 = OpCodes.AndN(OpCodes.Shr32(state, 20), 1);
        const b26 = OpCodes.AndN(OpCodes.Shr32(state, 26), 1);
        const b31 = OpCodes.AndN(OpCodes.Shr32(state, 31), 1);
        const nlfIdx = OpCodes.OrN(b1, OpCodes.OrN(OpCodes.Shl32(b9, 1),
          OpCodes.OrN(OpCodes.Shl32(b20, 2), OpCodes.OrN(OpCodes.Shl32(b26, 3), OpCodes.Shl32(b31, 4)))));
        const nlfOut = this._nlf(nlfIdx);

        const keyBit = this._keyBit(keyLow, keyHigh, i);
        const bit0 = OpCodes.AndN(state, 1);
        const bit16 = OpCodes.AndN(OpCodes.Shr32(state, 16), 1);
        const fb = OpCodes.XorN(keyBit, OpCodes.XorN(bit0, OpCodes.XorN(bit16, nlfOut)));

        state = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(state, 1), OpCodes.Shl32(fb, 31)));
      }

      return [...OpCodes.Unpack32LE(state)];
    }

    _decryptBlock(block) {
      let state = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const { keyLow, keyHigh } = this._keyWords();

      for (let i = ROUNDS - 1; i >= 0; --i) {
        const b0 = OpCodes.AndN(state, 1);
        const b8 = OpCodes.AndN(OpCodes.Shr32(state, 8), 1);
        const b19 = OpCodes.AndN(OpCodes.Shr32(state, 19), 1);
        const b25 = OpCodes.AndN(OpCodes.Shr32(state, 25), 1);
        const b30 = OpCodes.AndN(OpCodes.Shr32(state, 30), 1);
        const nlfIdx = OpCodes.OrN(b0, OpCodes.OrN(OpCodes.Shl32(b8, 1),
          OpCodes.OrN(OpCodes.Shl32(b19, 2), OpCodes.OrN(OpCodes.Shl32(b25, 3), OpCodes.Shl32(b30, 4)))));
        const nlfOut = this._nlf(nlfIdx);

        const keyBit = this._keyBit(keyLow, keyHigh, i);
        const bit15 = OpCodes.AndN(OpCodes.Shr32(state, 15), 1);
        const bit31 = OpCodes.AndN(OpCodes.Shr32(state, 31), 1);
        const fb = OpCodes.XorN(keyBit, OpCodes.XorN(bit15, OpCodes.XorN(bit31, nlfOut)));

        state = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(state, 1), fb));
      }

      return [...OpCodes.Unpack32LE(state)];
    }
  }

  const algorithmInstance = new DarkCryptKeeLoqAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKeeLoqAlgorithm, DarkCryptKeeLoqInstance };
}));
