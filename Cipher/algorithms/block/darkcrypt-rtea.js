/*
 * RTEA (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A TEA-family block cipher from the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). Unlike XTEA/XXTEA it does not use
 * an accumulated DELTA-derived sum; instead the round index itself is added
 * directly, and an 8-word (256-bit) key is cycled through by round-index
 * modulo 8:
 *   G(x) = (x >>> 8) ^ (x << 6)
 *   round i = 0..63:
 *     i even: v1 = v1 + v0 + key[i mod 8] + i + G(v0)
 *     i odd:  v0 = v0 + v1 + key[i mod 8] + i + G(v1)
 * 64 rounds total (32 updates of each word), 64-bit block, 256-bit key,
 * 32-bit words read/written little-endian. As implemented in the DarkCrypt
 * Total Commander plugin; test vectors verified against the DarkCrypt
 * implementation. Educational only.
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

  const ROUNDS = 64;

  class DarkCryptRTEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "RTEA (DarkCrypt)";
      this.description = "TEA-family block cipher from the DarkCrypt Total Commander plugin: round index used directly as the additive constant (no DELTA-derived sum), 8-word (256-bit) key cycled by round index mod 8, 64 rounds. 64-bit block, 256-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt \"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];  // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed construction", "TEA-family variant with a linear (non-DELTA) round constant; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Rtea — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("84a025cf2f126e6f")
        },
        {
          text: "DarkCrypt Rtea — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("dcebdac1481e6e22")
        },
        {
          text: "DarkCrypt Rtea — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("784ac367c38dc08d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRTEAInstance(this, isInverse);
    }
  }

  class DarkCryptRTEAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. RTEA (DarkCrypt) requires exactly 32 bytes`);
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
      const k = [];
      for (let i = 0; i < 8; i++) {
        const o = i * 4;
        k.push(OpCodes.Pack32LE(this._key[o], this._key[o + 1], this._key[o + 2], this._key[o + 3]));
      }
      return k;
    }

    // G(x) = (x >>> 8) ^ (x << 6)
    _G(x) {
      return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shr32(x, 8), OpCodes.Shl32(x, 6)));
    }

    _encryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();
      for (let i = 0; i < ROUNDS; i++) {
        if (OpCodes.And32(i, 1) === 0)
          v1 = OpCodes.ToUint32(v1 + v0 + k[OpCodes.And32(i, 7)] + i + this._G(v0));
        else
          v0 = OpCodes.ToUint32(v0 + v1 + k[OpCodes.And32(i, 7)] + i + this._G(v1));
      }
      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }

    _decryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();
      for (let i = ROUNDS - 1; i >= 0; i--) {
        if (OpCodes.And32(i, 1) === 1)
          v0 = OpCodes.ToUint32(v0 - (v1 + k[OpCodes.And32(i, 7)] + i + this._G(v1)));
        else
          v1 = OpCodes.ToUint32(v1 - (v0 + k[OpCodes.And32(i, 7)] + i + this._G(v0)));
      }
      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }
  }

  const algorithmInstance = new DarkCryptRTEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptRTEAAlgorithm, DarkCryptRTEAInstance };
}));
