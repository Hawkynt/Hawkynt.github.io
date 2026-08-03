/*
 * MMB (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MMB (Modular Multiplication-based Block cipher, Joan Daemen 1993) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project), matching the
 * published design: a 128-bit block treated as four 32-bit words, six rounds of [key XOR,
 * multiplication modulo 2^32-1 by fixed per-word constants, a "theta" XOR diffusion layer],
 * plus a final key-XOR-only stage. Key schedule is trivial: the four 32-bit key words are
 * used directly, cycled through the four word slots with a rotation that advances by one
 * word each round. A word is multiplicatively degenerate when odd (representing behaviour
 * tied to the additive identity of GF(2^32-1)); this implementation corrects for that by
 * XORing word 0 with the fixed constant 0x2AAAAAAA whenever it is odd, immediately after
 * multiplication (encrypt) or immediately before the inverse multiplication (decrypt).
 * 128-bit blocks, 128-bit keys. Educational only.
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

  const ROUNDS = 6;
  const ODD_CORRECTION = 0x2AAAAAAA;
  const MOD_2_32_1 = OpCodes.ShiftLn(1n, 32) - 1n;

  // Per-word multiplication constants (encrypt direction).
  const FWD_CONST = [0x025F1CDB, 0x04BE39B6, 0x12F8E6D8, 0x2F8E6D81];
  // Multiplicative inverses of FWD_CONST modulo (2^32 - 1), used for decryption.
  const INV_CONST = [0x0DAD4694, 0x06D6A34A, 0x81B5A8D2, 0x281B5A8D];

  // Multiplication modulo 2^32 - 1.
  function mulModMersenne(a, b) {
    return OpCodes.ToUint32(Number(OpCodes.MulModN(BigInt(OpCodes.ToUint32(a)), BigInt(OpCodes.ToUint32(b)), MOD_2_32_1)));
  }

  // "theta" XOR diffusion layer shared by encryption and decryption (it is its own inverse).
  function diffuse(w) {
    const e = OpCodes.Xor32(w[2], w[0]);
    const a = OpCodes.Xor32(w[1], w[3]);
    return [OpCodes.Xor32(w[0], a), OpCodes.Xor32(w[1], e), OpCodes.Xor32(w[2], a), OpCodes.Xor32(w[3], e)];
  }

  // Forward round transform: multiply-by-constant, odd correction, then diffuse.
  function roundForward(w) {
    const s = w.map((x, i) => mulModMersenne(x, FWD_CONST[i]));
    if (OpCodes.And32(s[0], 1)) s[0] = OpCodes.Xor32(s[0], ODD_CORRECTION);
    return diffuse(s);
  }

  // Inverse round transform: diffuse, odd correction, then multiply by inverse constant.
  function roundInverse(w) {
    const s = diffuse(w);
    if (OpCodes.And32(s[0], 1)) s[0] = OpCodes.Xor32(s[0], ODD_CORRECTION);
    return s.map((x, i) => mulModMersenne(x, INV_CONST[i]));
  }

  class DarkCryptMMBAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MMB (DarkCrypt)";
      this.description = "MMB (Modular Multiplication-based Block cipher) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds combining modular multiplication (mod 2^32-1) with an XOR diffusion layer.";
      this.inventor = "Joan Daemen (base MMB); DarkCrypt variant by Alexander Myasnikov";
      this.year = 1993;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("MMB (Daemen, 1993)", "https://en.wikipedia.org/wiki/MMB_(cipher)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak-key differential attack", "Biham demonstrated a weak-key class and differential attack against MMB shortly after publication.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Mmb — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "DarkCrypt Mmb — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("13d3b3fe7bc02c0dc56dc648a5ae9d32")
        },
        {
          text: "DarkCrypt Mmb — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("eaf8b8248e6a72f072dbc17e40a95c13")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMMBInstance(this, isInverse);
    }
  }

  class DarkCryptMMBInstance extends IBlockCipherInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MMB (DarkCrypt) requires exactly 16 bytes`);
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
      for (let r = 0; r < ROUNDS + 1; r++) {
        for (let j = 0; j < 4; j++) w[j] = OpCodes.Xor32(w[j], K[(r + j) % 4]);
        if (r < ROUNDS) w = roundForward(w);
      }
      return this._wordsToBlock(w);
    }

    _decryptBlock(block) {
      const K = this._K;
      let w = this._blockToWords(block);
      const rotations = [2, 1, 0, 3, 2, 1, 0];
      for (let r = 0; r < ROUNDS + 1; r++) {
        for (let j = 0; j < 4; j++) w[j] = OpCodes.Xor32(w[j], K[(rotations[r] + j) % 4]);
        if (r < ROUNDS) w = roundInverse(w);
      }
      return this._wordsToBlock(w);
    }
  }

  const algorithmInstance = new DarkCryptMMBAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMMBAlgorithm, DarkCryptMMBInstance };
}));
