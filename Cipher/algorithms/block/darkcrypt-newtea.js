/*
 * NewTEA-128 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NewTEA-128 as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). No public specification exists for this variant.
 * 128-bit block, 128-bit key, 16 rounds.
 *
 * A 4-word (v0..v3) generalization of TEA: the 128-bit key maps directly onto
 * four 32-bit subkeys K0..K3 (no sum-indexed key schedule, unlike TEA/XTEA),
 * and each round updates all four block words in place, sequentially, each
 * combining the OTHER three words with a fixed shift (6 or 9), a running
 * TEA-style "sum" accumulator (sum += DELTA every round, DELTA=0x4F1BBCDC),
 * and one of the four subkeys:
 *
 *   sum = sum + DELTA
 *   v0 += ((v1<<6)+K0) XOR (v2+sum)      XOR ((v3>>>9)+K1)
 *   v1 += (v3+sum)      XOR ((v0<<6)+K2) XOR ((v2>>>9)+K3)     (uses updated v0)
 *   v2 += (v0+sum)      XOR ((v3<<6)+K0) XOR ((v1>>>9)+K3)     (uses updated v0, v1)
 *   v3 += (v1+sum)      XOR ((v2<<6)+K2) XOR ((v0>>>9)+K1)     (uses updated v0, v1, v2)
 *
 * repeated for 16 rounds (all arithmetic mod 2^32). Decryption recomputes the
 * final sum value directly (DELTA*(ROUNDS+1)) and undoes the four per-round
 * updates in reverse order (v3, v2, v1, v0), decrementing sum by DELTA between
 * rounds. Little-endian 32-bit words. Test vectors verified against the
 * DarkCrypt implementation (crypt and decrypt round-trip confirmed).
 * Educational only.
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

  const DELTA = 0x4F1BBCDC;
  const ROUNDS = 16;

  class DarkCryptNewTEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "NewTEA-128 (DarkCrypt)";
      this.description = "4-word (128-bit block) generalization of TEA from the DarkCrypt Total Commander plugin. Direct key-to-subkey mapping (no sum-indexed schedule), fixed shifts 6/9, running DELTA-sum accumulator, 16 rounds. 128-bit block, 128-bit key.";
      this.inventor = "Unknown (NewTEA cipher); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("TEA (base family)", "https://www.cix.co.uk/~klockstone/xtea.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard / unanalyzed", "Undocumented TEA-family generalization; not analyzed in the cryptographic literature and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Newtea — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e277e788010ee2f65c61f29d69cf2021")
        },
        {
          text: "DarkCrypt Newtea — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("0c7ca4be6dd5ad490c99e8b84259f9ad")
        },
        {
          text: "DarkCrypt Newtea — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("a7a2d5e121901c68293c0dc891a015e3")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptNewTEAInstance(this, isInverse);
    }
  }

  class DarkCryptNewTEAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. NewTEA-128 (DarkCrypt) requires exactly 16 bytes`);
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

    _encryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let v2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let v3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
      const K = this._keyWords();
      let sum = DELTA;

      for (let r = 0; r < ROUNDS; r++) {
        sum = OpCodes.ToUint32(sum + DELTA);
        v0 = OpCodes.ToUint32(v0 + OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(OpCodes.Shl32(v1, 6) + K[0]), OpCodes.ToUint32(v2 + sum)), OpCodes.ToUint32(OpCodes.Shr32(v3, 9) + K[1])));
        v1 = OpCodes.ToUint32(v1 + OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(v3 + sum), OpCodes.ToUint32(OpCodes.Shl32(v0, 6) + K[2])), OpCodes.ToUint32(OpCodes.Shr32(v2, 9) + K[3])));
        v2 = OpCodes.ToUint32(v2 + OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(v0 + sum), OpCodes.ToUint32(OpCodes.Shl32(v3, 6) + K[0])), OpCodes.ToUint32(OpCodes.Shr32(v1, 9) + K[3])));
        v3 = OpCodes.ToUint32(v3 + OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(v1 + sum), OpCodes.ToUint32(OpCodes.Shl32(v2, 6) + K[2])), OpCodes.ToUint32(OpCodes.Shr32(v0, 9) + K[1])));
      }

      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1), ...OpCodes.Unpack32LE(v2), ...OpCodes.Unpack32LE(v3)];
    }

    _decryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let v2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let v3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
      const K = this._keyWords();
      let sum = OpCodes.ToUint32(DELTA * (ROUNDS + 1));

      for (let r = ROUNDS - 1; r >= 0; r--) {
        v3 = OpCodes.ToUint32(v3 - OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(v1 + sum), OpCodes.ToUint32(OpCodes.Shl32(v2, 6) + K[2])), OpCodes.ToUint32(OpCodes.Shr32(v0, 9) + K[1])));
        v2 = OpCodes.ToUint32(v2 - OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(v0 + sum), OpCodes.ToUint32(OpCodes.Shl32(v3, 6) + K[0])), OpCodes.ToUint32(OpCodes.Shr32(v1, 9) + K[3])));
        v1 = OpCodes.ToUint32(v1 - OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(v3 + sum), OpCodes.ToUint32(OpCodes.Shl32(v0, 6) + K[2])), OpCodes.ToUint32(OpCodes.Shr32(v2, 9) + K[3])));
        v0 = OpCodes.ToUint32(v0 - OpCodes.Xor32(OpCodes.Xor32(OpCodes.ToUint32(OpCodes.Shl32(v1, 6) + K[0]), OpCodes.ToUint32(v2 + sum)), OpCodes.ToUint32(OpCodes.Shr32(v3, 9) + K[1])));
        sum = OpCodes.ToUint32(sum - DELTA);
      }

      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1), ...OpCodes.Unpack32LE(v2), ...OpCodes.Unpack32LE(v3)];
    }
  }

  const algorithmInstance = new DarkCryptNewTEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptNewTEAAlgorithm, DarkCryptNewTEAInstance };
}));
