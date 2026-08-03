/*
 * XTEA-TW (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The XTEA-TW block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). Verified byte-for-byte identical (all 3
 * official vectors + fuzz vectors + decrypt round-trip) to the "XTEA (DarkCrypt)"
 * variant implemented elsewhere in this project: shift amounts 6 and 9 (not
 * textbook XTEA's 4/5), 38 rounds (not textbook 32), 32-bit words read/written
 * little-endian. XTEA-TW appears to be a differently-named build of the same
 * cipher core. 64-bit blocks, 128-bit keys. Educational only.
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

  const DELTA = 0x9E3779B9;
  const ROUNDS = 38;

  class DarkCryptXTEATWAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "XTEA-TW (DarkCrypt)";
      this.description = "XTEA variant from the DarkCrypt Total Commander plugin: shift amounts 6/9 (vs textbook 4/5), 38 rounds, little-endian words. Byte-identical output to the \"XTEA (DarkCrypt)\" variant. 64-bit block, 128-bit key.";
      this.inventor = "David Wheeler, Roger Needham (base XTEA); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("XTEA (base algorithm)", "https://www.cix.co.uk/~klockstone/xtea.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Modified XTEA with unusual shift amounts and round count; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Xtea-tw — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("b659242021c436b1")
        },
        {
          text: "DarkCrypt Xtea-tw — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("30563f3a0e225695")
        },
        {
          text: "DarkCrypt Xtea-tw — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("d4384999399f1fb0")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptXTEATWInstance(this, isInverse);
    }
  }

  class DarkCryptXTEATWInstance extends IBlockCipherInstance {
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
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. XTEA-TW (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
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
      return [
        OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15])
      ];
    }

    // f(x) = ((x<<6) ^ (x>>>9)) + x       (DarkCrypt uses shifts 6 and 9)
    _f(x) {
      return OpCodes.ToUint32(OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(x, 6), OpCodes.Shr32(x, 9))) + x);
    }

    _encryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();
      let sum = 0;
      for (let i = 0; i < ROUNDS; i++) {
        v0 = OpCodes.ToUint32(v0 + OpCodes.Xor32(this._f(v1), OpCodes.ToUint32(sum + k[OpCodes.And32(sum, 3)])));
        sum = OpCodes.ToUint32(sum + DELTA);
        v1 = OpCodes.ToUint32(v1 + OpCodes.Xor32(this._f(v0), OpCodes.ToUint32(sum + k[OpCodes.And32(OpCodes.Shr32(sum, 11), 3)])));
      }
      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }

    _decryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();
      let sum = OpCodes.ToUint32(DELTA * ROUNDS);
      for (let i = 0; i < ROUNDS; i++) {
        v1 = OpCodes.ToUint32(v1 - OpCodes.Xor32(this._f(v0), OpCodes.ToUint32(sum + k[OpCodes.And32(OpCodes.Shr32(sum, 11), 3)])));
        sum = OpCodes.ToUint32(sum - DELTA);
        v0 = OpCodes.ToUint32(v0 - OpCodes.Xor32(this._f(v1), OpCodes.ToUint32(sum + k[OpCodes.And32(sum, 3)])));
      }
      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }
  }

  const algorithmInstance = new DarkCryptXTEATWAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptXTEATWAlgorithm, DarkCryptXTEATWInstance };
}));
