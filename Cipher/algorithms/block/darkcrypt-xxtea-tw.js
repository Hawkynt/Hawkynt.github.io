/*
 * XXTEA-TW (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A fixed 64-bit-block cipher from the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project), built from the same MX() round
 * function as the standard XXTEA / "Corrected Block TEA" (Wheeler & Needham),
 * but applied to a FIXED 2-word block (like TEA/XTEA) rather than to an
 * n-word variable-length block. Differs from the textbook MX() function:
 *   - shift amounts are 9/2 and 3/6 (textbook XXTEA MX uses 5/2 and 3/4)
 *   - 40 rounds, sum accumulated by DELTA=0x9E3779B9 once per round
 *   - each round updates v0 using v1 (with key index p=(sum>>2)&3), then
 *     updates v1 using the NEW v0 (with key index p^1)
 *   - 32-bit words are read/written little-endian
 * Test vectors generated from the DarkCrypt implementation (crypt/decrypt
 * round-trip verified). 64-bit blocks, 128-bit keys. Educational only.
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
  const ROUNDS = 40;

  class DarkCryptXXTEATWAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "XXTEA-TW (DarkCrypt)";
      this.description = "Fixed 64-bit-block cipher from the DarkCrypt Total Commander plugin, built from the XXTEA MX() round function with non-standard shifts (9/2, 3/6 vs textbook 5/2, 3/4) applied to a fixed 2-word block, 40 rounds. 64-bit block, 128-bit key.";
      this.inventor = "David Wheeler, Roger Needham (XXTEA MX round function); DarkCrypt variant by Alexander Myasnikov";
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
        new LinkItem("XXTEA / Correction to XTEA (base MX round function)", "http://www.movable-type.co.uk/scripts/xxtea.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Fixed-block XXTEA-derived construction with unusual shift amounts; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Xxtea-tw — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0ad350bb85878953")
        },
        {
          text: "DarkCrypt Xxtea-tw — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("1368421f3d8d4bf6")
        },
        {
          text: "DarkCrypt Xxtea-tw — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("8d047c2569514ca9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptXXTEATWInstance(this, isInverse);
    }
  }

  class DarkCryptXXTEATWInstance extends IBlockCipherInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. XXTEA-TW (DarkCrypt) requires exactly 16 bytes`);
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
      return [
        OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]),
        OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32LE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32LE(this._key[12], this._key[13], this._key[14], this._key[15])
      ];
    }

    // F(x) = ((x<<2) ^ (x>>>9)) + ((x>>>3) ^ (x<<6))   (XXTEA MX terms with DarkCrypt shifts 9/2, 3/6)
    _F(x) {
      const t1 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(x, 2), OpCodes.Shr32(x, 9)));
      const t2 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shr32(x, 3), OpCodes.Shl32(x, 6)));
      return OpCodes.ToUint32(t1 + t2);
    }

    _encryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();
      let sum = 0;
      for (let i = 0; i < ROUNDS; i++) {
        sum = OpCodes.ToUint32(sum + DELTA);
        const p = OpCodes.And32(OpCodes.Shr32(sum, 2), 3);
        v0 = OpCodes.ToUint32(v0 + OpCodes.Xor32(this._F(v1), OpCodes.ToUint32(OpCodes.ToUint32(OpCodes.Xor32(v1, k[p])) + OpCodes.ToUint32(OpCodes.Xor32(v1, sum)))));
        const p1 = OpCodes.Xor32(p, 1);
        v1 = OpCodes.ToUint32(v1 + OpCodes.Xor32(this._F(v0), OpCodes.ToUint32(OpCodes.ToUint32(OpCodes.Xor32(v0, k[p1])) + OpCodes.ToUint32(OpCodes.Xor32(v0, sum)))));
      }
      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }

    _decryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();
      let sum = OpCodes.ToUint32(DELTA * ROUNDS);
      for (let i = 0; i < ROUNDS; i++) {
        const p = OpCodes.And32(OpCodes.Shr32(sum, 2), 3);
        const p1 = OpCodes.Xor32(p, 1);
        v1 = OpCodes.ToUint32(v1 - OpCodes.Xor32(this._F(v0), OpCodes.ToUint32(OpCodes.ToUint32(OpCodes.Xor32(v0, k[p1])) + OpCodes.ToUint32(OpCodes.Xor32(v0, sum)))));
        v0 = OpCodes.ToUint32(v0 - OpCodes.Xor32(this._F(v1), OpCodes.ToUint32(OpCodes.ToUint32(OpCodes.Xor32(v1, k[p])) + OpCodes.ToUint32(OpCodes.Xor32(v1, sum)))));
        sum = OpCodes.ToUint32(sum - DELTA);
      }
      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }
  }

  const algorithmInstance = new DarkCryptXXTEATWAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptXXTEATWAlgorithm, DarkCryptXXTEATWInstance };
}));
