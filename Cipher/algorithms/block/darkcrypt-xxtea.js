/*
 * XXTEA (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * XXTEA / "Corrected Block TEA" (Wheeler & Needham) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project),
 * compiled for a FIXED block of n=30 32-bit words (960-bit block). Follows
 * the standard XXTEA structure exactly (MX() round function, sum accumulated
 * by DELTA=0x9E3779B9, e=(sum>>>2)&3, key index (p&3)^e, z threaded through
 * the word chain, wraparound at the last word) but differs from the textbook
 * reference in two ways:
 *   - MX() uses shift amounts 9/2 and 3/6 (textbook XXTEA MX uses 5/2 and 3/4)
 *   - 12 rounds (textbook formula rounds=6+52/n gives 7 for n=30; DarkCrypt
 *     uses a fixed, larger round count of 12 instead)
 * 32-bit words are read/written little-endian. Test vectors generated from
 * the DarkCrypt implementation (crypt/decrypt round-trip verified). 960-bit
 * blocks, 128-bit keys. Educational only.
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
  const ROUNDS = 12;
  const N = 30; // words per block (960-bit block)

  class DarkCryptXXTEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "XXTEA (DarkCrypt)";
      this.description = "XXTEA / Corrected Block TEA fixed to a 30-word (960-bit) block, as implemented in the DarkCrypt Total Commander plugin. Follows the standard MX()-based structure but with non-standard shifts (9/2, 3/6 vs textbook 5/2, 3/4) and 12 rounds (vs textbook formula's 7 for n=30). 128-bit key.";
      this.inventor = "David Wheeler, Roger Needham (base XXTEA); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];     // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(120, 120, 0)]; // fixed 960-bit (30 words)

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("XXTEA / Correction to XTEA", "http://www.movable-type.co.uk/scripts/xxtea.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "XXTEA fixed to a single block size with unusual shift amounts and round count; unanalyzed and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Xxtea30 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("11d1a19de7a3be1c9aae815df67d4f1bec800c8cbd24b5d4935aad1040e448e972b0ebed01a6b8df10c1ce47cf108ba9199670cb2917d8ab2340d1be675a77f96b589b5ee5de5940b52ddb230372240a9845113adbfe407c1e3cbeb2e087e8607716cf873ff520647c87f8eea714f4b0fe85c822b8efbbc3")
        },
        {
          text: "DarkCrypt Xxtea30 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f7071727374757677"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("3057ac052bfd1a5c1e21ac3cb1f2061a38f9a294a7be9f20bd663d384d033d12d8d9e1806224031437f978262ef1615a0114bce2b9f8a690f5370ab60e46e6cabe6376ef7ec3b7606b510624f0bd9011d33c66c368a0d6e700d1451d673787aa24d0d31a31c0abc2114f87531cd86da375e12a2bc2b112de")
        },
        {
          text: "DarkCrypt Xxtea30 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f8081828384858687"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("2b936df03d617f3f0348038a3fe39b7a4698e9203614461e4eefe40f5a0d8c25e2ec73cb2b3d7caad61bc8eaaf84cdc358028c5a8691f693948467d33a90c2d875173b42c1accbce8dde564c59c86d41b50a1e9faf0b2b52237b8a4c18c68c04a149a1f70e64457e1b5506e056e31dba0c0fa7d3fa9450b8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptXXTEAInstance(this, isInverse);
    }
  }

  class DarkCryptXXTEAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = N * 4; // 120 bytes
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. XXTEA (DarkCrypt) requires exactly 16 bytes`);
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

    // MX(y,z,sum,p,e) = ((z>>>9 ^ y<<2) + (y>>>3 ^ z<<6)) ^ ((sum^y) + (key[(p&3)^e]^z))
    // (DarkCrypt uses shifts 9/2 and 3/6 instead of the textbook 5/2 and 3/4)
    _MX(y, z, sum, p, e, k) {
      const t1 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shr32(z, 9), OpCodes.Shl32(y, 2)));
      const t2 = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shr32(y, 3), OpCodes.Shl32(z, 6)));
      const a = OpCodes.ToUint32(t1 + t2);
      const b = OpCodes.ToUint32(OpCodes.ToUint32(OpCodes.Xor32(sum, y)) + OpCodes.ToUint32(OpCodes.Xor32(k[OpCodes.Xor32(OpCodes.And32(p, 3), e)], z)));
      return OpCodes.ToUint32(OpCodes.Xor32(a, b));
    }

    _wordsFromBlock(block) {
      const v = new Array(N);
      for (let i = 0; i < N; i++) {
        const o = i * 4;
        v[i] = OpCodes.Pack32LE(block[o], block[o + 1], block[o + 2], block[o + 3]);
      }
      return v;
    }

    _blockFromWords(v) {
      const out = [];
      for (let i = 0; i < N; i++) out.push(...OpCodes.Unpack32LE(v[i]));
      return out;
    }

    _encryptBlock(block) {
      const v = this._wordsFromBlock(block);
      const k = this._keyWords();
      let sum = 0;
      let z = v[N - 1];
      for (let r = 0; r < ROUNDS; r++) {
        sum = OpCodes.ToUint32(sum + DELTA);
        const e = OpCodes.And32(OpCodes.Shr32(sum, 2), 3);
        let p;
        for (p = 0; p < N - 1; p++) {
          const y = v[p + 1];
          v[p] = OpCodes.ToUint32(v[p] + this._MX(y, z, sum, p, e, k));
          z = v[p];
        }
        p = N - 1;
        const y = v[0];
        v[p] = OpCodes.ToUint32(v[p] + this._MX(y, z, sum, p, e, k));
        z = v[p];
      }
      return this._blockFromWords(v);
    }

    _decryptBlock(block) {
      const v = this._wordsFromBlock(block);
      const k = this._keyWords();
      let sum = OpCodes.ToUint32(DELTA * ROUNDS);
      let y = v[0];
      for (let r = 0; r < ROUNDS; r++) {
        const e = OpCodes.And32(OpCodes.Shr32(sum, 2), 3);
        let p;
        for (p = N - 1; p > 0; p--) {
          const z = v[p - 1];
          v[p] = OpCodes.ToUint32(v[p] - this._MX(y, z, sum, p, e, k));
          y = v[p];
        }
        p = 0;
        const z = v[N - 1];
        v[p] = OpCodes.ToUint32(v[p] - this._MX(y, z, sum, p, e, k));
        y = v[p];
        sum = OpCodes.ToUint32(sum - DELTA);
      }
      return this._blockFromWords(v);
    }
  }

  const algorithmInstance = new DarkCryptXXTEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptXXTEAAlgorithm, DarkCryptXXTEAInstance };
}));
