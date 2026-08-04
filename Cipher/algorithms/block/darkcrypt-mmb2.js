/*
 * MMB2 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MMB2, a revision of Daemen's MMB cipher, as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 *
 * Structure: a 128-bit block treated as four 32-bit words, seven key-XOR stages (rotating
 * which key word lands in which word slot, advancing by one word per stage) interleaved with
 * six applications of a round function F, plus a final key-XOR-only stage (mirroring MMB's
 * 6-round-plus-whitening shape). Each key-XOR stage additionally XORs word 0 with a round
 * constant that doubles every stage (0x0DAE << round). F itself is: [multiply each word by a
 * fixed per-word constant modulo 2^32-1] -> [if word 0 is odd, XOR it with 0x2AAAAAAA] ->
 * [theta XOR diffusion layer, identical to MMB's].
 *
 * IMPORTANT IMPLEMENTATION QUIRK (faithfully reproduced here, not "fixed"): the DarkCrypt
 * implementation's modular-multiply step computes value*constant mod (2^32-1) but then
 * discards the result and keeps the original input value unchanged, confirmed by matching
 * all three DarkCrypt test vectors only when the multiplication step is treated as a no-op.
 * The net effect is that DarkCrypt's MMB2 never actually performs the GF(2^32-1)
 * multiplication step; only the round constants, key mixing, odd-correction, and theta
 * diffusion contribute to the transform. 128-bit blocks, 128-bit keys. Educational only.
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

  const STAGES = 7;
  const ODD_CORRECTION = 0x2AAAAAAA;

  // Per-stage round constants XORed into word 0 only; each is the previous one doubled.
  const EXTRA = [0x0DAE, 0x1B5C, 0x36B8, 0x6D70, 0xDAE0, 0x1B5C0, 0x36B80];

  // "theta" XOR diffusion layer shared by encryption and decryption (it is its own inverse).
  function diffuse(w) {
    const e = OpCodes.Xor32(w[2], w[0]);
    const a = OpCodes.Xor32(w[1], w[3]);
    return [OpCodes.Xor32(w[0], a), OpCodes.Xor32(w[1], e), OpCodes.Xor32(w[2], a), OpCodes.Xor32(w[3], e)];
  }

  // Forward round transform. The multiplication step is intentionally omitted: see the
  // implementation-quirk note above (computed but discarded in the original).
  function roundForward(w) {
    const s = w.slice();
    if (OpCodes.And32(s[0], 1)) s[0] = OpCodes.Xor32(s[0], ODD_CORRECTION);
    return diffuse(s);
  }

  // Inverse round transform: diffuse first, then the same odd correction (both are self-inverse).
  function roundInverse(w) {
    const s = diffuse(w);
    if (OpCodes.And32(s[0], 1)) s[0] = OpCodes.Xor32(s[0], ODD_CORRECTION);
    return s;
  }

  class DarkCryptMMB2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MMB2 (DarkCrypt)";
      this.description = "MMB2 (revision of Daemen's MMB) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds of key mixing plus theta diffusion, plus a final whitening stage. This implementation carries a quirk where the intended modular multiplication step is computed but discarded (a no-op in practice).";
      this.inventor = "Joan Daemen (base MMB/MMB2 lineage); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1997;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("MMB (Daemen, 1993) — base lineage", "https://en.wikipedia.org/wiki/MMB_(cipher)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Multiplication step is a no-op in this implementation", "The DarkCrypt implementation computes the intended modular multiplication but discards the result before returning, so this variant provides only key-XOR and linear (theta) diffusion — materially weaker than the intended MMB2 design.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Mmb2 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("9a490200ecc3010000000000ecc30100")
        },
        {
          text: "DarkCrypt Mmb2 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("9e4d0604e0cf0d0c04040404e0cf0d0c")
        },
        {
          text: "DarkCrypt Mmb2 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("25f4bd21f1dc1c0b1517151bf1dc1c0b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMMB2Instance(this, isInverse);
    }
  }

  class DarkCryptMMB2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MMB2 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._K = [
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
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

    _blockToWords(block) {
      return [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
    }

    _wordsToBlock(w) {
      return [
        ...OpCodes.Unpack32LE(w[0]), ...OpCodes.Unpack32LE(w[1]),
        ...OpCodes.Unpack32LE(w[2]), ...OpCodes.Unpack32LE(w[3])
      ];
    }

    _encryptBlock(block) {
      const K = this._K;
      let w = this._blockToWords(block);
      for (let r = 0; r < STAGES; r++) {
        const rot = r % 4;
        w[0] = OpCodes.Xor32(OpCodes.Xor32(w[0], K[rot]), EXTRA[r]);
        w[1] = OpCodes.Xor32(w[1], K[(rot + 1) % 4]);
        w[2] = OpCodes.Xor32(w[2], K[(rot + 2) % 4]);
        w[3] = OpCodes.Xor32(w[3], K[(rot + 3) % 4]);
        if (r < STAGES - 1) w = roundForward(w);
      }
      return this._wordsToBlock(w);
    }

    _decryptBlock(block) {
      const K = this._K;
      let w = this._blockToWords(block);
      const encRounds = [6, 5, 4, 3, 2, 1, 0];
      for (let idx = 0; idx < STAGES; idx++) {
        const r = encRounds[idx];
        const rot = r % 4;
        w[0] = OpCodes.Xor32(OpCodes.Xor32(w[0], K[rot]), EXTRA[r]);
        w[1] = OpCodes.Xor32(w[1], K[(rot + 1) % 4]);
        w[2] = OpCodes.Xor32(w[2], K[(rot + 2) % 4]);
        w[3] = OpCodes.Xor32(w[3], K[(rot + 3) % 4]);
        if (idx < STAGES - 1) w = roundInverse(w);
      }
      return this._wordsToBlock(w);
    }
  }

  const algorithmInstance = new DarkCryptMMB2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMMB2Algorithm, DarkCryptMMB2Instance };
}));
