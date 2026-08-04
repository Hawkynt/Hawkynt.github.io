/*
 * Raiden (DarkCrypt variant, 16 rounds) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Raiden as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project), which reports itself as "Raiden-K128-R16".
 * 64-bit block, 128-bit key, 16 rounds.
 *
 * Structure: TEA/XTEA-family Feistel network, but with a mutating 4-word key
 * state (rather than a fixed key schedule plus additive DELTA accumulator).
 * Each round derives a round value F from the CURRENT key state, then folds
 * F back into the state before advancing the Feistel halves:
 *
 *   L = [k0, k1, k2, k3]                          (initial state = key words, little-endian)
 *   for round r = 0 .. ROUNDS-1:
 *     F         = (L0 << L2) XOR (L2 + L3) + L0 + L1     (32-bit, mod 2^32; shift amount is L2 mod 32)
 *     L[r & 3]  = F                                       (state feedback)
 *     v0        = v0 + g(F, v1)
 *     v1        = v1 + g(F, v0)                           (uses the just-updated v0)
 *   where g(F, x) = ((F + x) << 9) XOR ((F + x) >>> 14) XOR (F - x)
 *
 * Decryption recomputes the same F sequence in a forward pass (independent of
 * the block halves), then undoes the Feistel updates in reverse round order.
 * No separate DELTA constant is used; diffusion comes entirely from the
 * self-referential key state. Cross-checked against the DarkCrypt
 * implementation (encrypt/decrypt round-trip, plus additional single-key-byte
 * probes). Educational only.
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

  const ROUNDS = 16;

  class DarkCryptRaidenAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Raiden-16 (DarkCrypt)";
      this.description = "Raiden cipher, 16-round variant, from the DarkCrypt Total Commander plugin. TEA/XTEA-family Feistel network with a self-mutating 4-word key state (no separate DELTA accumulator). 64-bit block, 128-bit key.";
      this.inventor = "Unknown (Raiden cipher); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard / unanalyzed", "Non-standard TEA-family variant with an unusual self-mutating key state; not analyzed in the cryptographic literature and not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (raw primitive: key setup + single-block encryption).
      this.tests = [
        {
          text: "DarkCrypt Raiden — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0000000000000000")
        },
        {
          text: "DarkCrypt Raiden — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("3e7ff369dad916bc")
        },
        {
          text: "DarkCrypt Raiden — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("44d5e9b829102175")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRaidenInstance(this, isInverse);
    }
  }

  class DarkCryptRaidenInstance extends IBlockCipherInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Raiden-16 (DarkCrypt) requires exactly 16 bytes`);
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

    // Round value derived from the current key state: (L0 << L2) ^ (L2 + L3) + L0 + L1
    _roundF(L) {
      const t = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(L[0], L[2]), OpCodes.ToUint32(L[2] + L[3])));
      return OpCodes.ToUint32(t + L[0] + L[1]);
    }

    // g(F, x) = ((F+x) << 9) XOR ((F+x) >>> 14) XOR (F - x)
    _g(F, x) {
      const s = OpCodes.ToUint32(F + x);
      return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(s, 9), OpCodes.Shr32(s, 14))), OpCodes.ToUint32(F - x)));
    }

    _encryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const L = this._keyWords();

      for (let r = 0; r < ROUNDS; r++) {
        const F = this._roundF(L);
        L[OpCodes.And32(r, 3)] = F;
        v0 = OpCodes.ToUint32(v0 + this._g(F, v1));
        v1 = OpCodes.ToUint32(v1 + this._g(F, v0));
      }

      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }

    _decryptBlock(block) {
      let v0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let v1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      const L = this._keyWords();

      // Recompute the round-value sequence with a forward pass (state evolution
      // is independent of the block halves), then undo the Feistel updates
      // in reverse round order.
      const Fhist = new Array(ROUNDS);
      for (let r = 0; r < ROUNDS; r++) {
        const F = this._roundF(L);
        Fhist[r] = F;
        L[OpCodes.And32(r, 3)] = F;
      }

      for (let r = ROUNDS - 1; r >= 0; r--) {
        const F = Fhist[r];
        v1 = OpCodes.ToUint32(v1 - this._g(F, v0));
        v0 = OpCodes.ToUint32(v0 - this._g(F, v1));
      }

      return [...OpCodes.Unpack32LE(v0), ...OpCodes.Unpack32LE(v1)];
    }
  }

  const algorithmInstance = new DarkCryptRaidenAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptRaidenAlgorithm, DarkCryptRaidenInstance };
}));
