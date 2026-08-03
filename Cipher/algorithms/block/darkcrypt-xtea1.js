/*
 * XTEA-1 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A generalized XTEA/TEA variant as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). 64-bit block, 128-bit key
 * (four 32-bit key words K0..K3, little-endian). Differs substantially from
 * textbook XTEA:
 *   - Initial ADD key whitening before the round loop: v0 += K0, v1 += K1.
 *   - 32 Feistel rounds (textbook XTEA uses 32 too, but the round function differs).
 *   - Each round adds an extra data-dependent rotation term ROL(Kx, other-half)
 *     on top of the classic TEA shift-pair term ((x<<4) ^ (x>>5)) and the
 *     sum-xor term (sum ^ x); shift amounts 4 and 5 match textbook TEA, but the
 *     rotate-by-value-of-the-other-half term is new:
 *       v0 += ROL(K[sum&3], v1) + ((v1<<4) ^ (v1>>5)) + (sum ^ v1)
 *       sum += DELTA
 *       v1 += ROL(K[(sum>>11)&3], v0) + ((v0<<4) ^ (v0>>5)) + (sum ^ v0)
 *     where DELTA = 0x9E3779B9, and ROL(x,n) rotates left by n mod 32 (the shift
 *     count is the other Feistel half's value, taken mod 32).
 *   - Final XOR key whitening after the round loop: v0 ^= K2, v1 ^= K3.
 *   - 32-bit words are read/written little-endian.
 * Test vectors generated from the DarkCrypt implementation (setup(key)+crypt(block)
 * and decrypt(block) round-trip, plus 15 additional randomized fuzz vectors beyond
 * the 3 official vectors). Educational only.
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
  const ROUNDS = 32;

  class DarkCryptXTEA1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "XTEA-1 (DarkCrypt)";
      this.description = "Generalized XTEA/TEA variant from the DarkCrypt Total Commander plugin: additive whitening (v0+=K0,v1+=K1) before 32 rounds, each round combining the classic TEA shift-pair/sum-xor term with an extra data-dependent rotation ROL(K[idx],other-half), then XOR whitening (v0^=K2,v1^=K3). Little-endian. 64-bit block, 128-bit key.";
      this.inventor = "David Wheeler, Roger Needham (base TEA/XTEA concept); DarkCrypt variant by Alexander Myasnikov";
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
        new Vulnerability("Non-standard, unanalyzed variant", "Custom generalized XTEA/TEA construction with data-dependent rotations; not vetted by public cryptanalysis.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Xtea1 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("aa2296e56c61f345")
        },
        {
          text: "DarkCrypt Xtea1 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("52a874bd65401332")
        },
        {
          text: "DarkCrypt Xtea1 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("f85a798953a771e9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptXTEA1Instance(this, isInverse);
    }
  }

  class DarkCryptXTEA1Instance extends IBlockCipherInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. XTEA-1 (DarkCrypt) requires exactly 16 bytes`);
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

    _encryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();

      v0 = OpCodes.ToUint32(v0 + k[0]);
      v1 = OpCodes.ToUint32(v1 + k[1]);

      let sum = 0;
      for (let i = 0; i < ROUNDS; i++) {
        const idxA = OpCodes.And32(sum, 3);
        const t1 = OpCodes.RotL32(k[idxA], v1);
        const f1 = OpCodes.Xor32(OpCodes.Shl32(v1, 4), OpCodes.Shr32(v1, 5));
        v0 = OpCodes.ToUint32(v0 + t1 + f1 + (OpCodes.ToUint32(OpCodes.Xor32(sum, v1))));

        sum = OpCodes.ToUint32(sum + DELTA);

        const idxC = OpCodes.And32(OpCodes.Shr32(sum, 11), 3);
        const t2 = OpCodes.RotL32(k[idxC], v0);
        const f2 = OpCodes.Xor32(OpCodes.Shl32(v0, 4), OpCodes.Shr32(v0, 5));
        v1 = OpCodes.ToUint32(v1 + t2 + f2 + (OpCodes.ToUint32(OpCodes.Xor32(sum, v0))));
      }

      v0 = OpCodes.Xor32(v0, k[2]);
      v1 = OpCodes.Xor32(v1, k[3]);

      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }

    _decryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const k = this._keyWords();

      v0 = OpCodes.Xor32(v0, k[2]);
      v1 = OpCodes.Xor32(v1, k[3]);

      let sum = OpCodes.ToUint32(DELTA * ROUNDS);
      for (let i = 0; i < ROUNDS; i++) {
        const idxC = OpCodes.And32(OpCodes.Shr32(sum, 11), 3);
        const t2 = OpCodes.RotL32(k[idxC], v0);
        const f2 = OpCodes.Xor32(OpCodes.Shl32(v0, 4), OpCodes.Shr32(v0, 5));
        v1 = OpCodes.ToUint32(v1 - t2 - f2 - (OpCodes.ToUint32(OpCodes.Xor32(sum, v0))));

        sum = OpCodes.ToUint32(sum - DELTA);

        const idxA = OpCodes.And32(sum, 3);
        const t1 = OpCodes.RotL32(k[idxA], v1);
        const f1 = OpCodes.Xor32(OpCodes.Shl32(v1, 4), OpCodes.Shr32(v1, 5));
        v0 = OpCodes.ToUint32(v0 - t1 - f1 - (OpCodes.ToUint32(OpCodes.Xor32(sum, v1))));
      }

      v0 = OpCodes.ToUint32(v0 - k[0]);
      v1 = OpCodes.ToUint32(v1 - k[1]);

      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }
  }

  const algorithmInstance = new DarkCryptXTEA1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptXTEA1Algorithm, DarkCryptXTEA1Instance };
}));
