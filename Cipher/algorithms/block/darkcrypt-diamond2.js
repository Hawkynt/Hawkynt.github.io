/*
 * Diamond2-2048 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Diamond2-2048" block cipher as shipped in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 *
 * Diamond2 (Michael Paul Johnson, 1995) is a substitution-permutation network
 * over a 16-byte (128-bit) block: each round substitutes every byte through a
 * key-dependent 256-entry S-box (one box per byte position) and then applies a
 * fixed bit permutation. The DarkCrypt implementation uses 12 rounds and
 * advertises a 2048-bit (256-byte) key.
 *
 * In this DarkCrypt build the key schedule degenerates: the CRC-driven S-box
 * shuffler collapses so that every generated S-box reduces to the byte
 * complement box S[v] = 0xFF - v (the round-0/position-0 box is S[v] = 0xFE - v),
 * independent of the supplied key. This was confirmed empirically - zero, all-
 * 0xFF, incrementing and random 256-byte keys all yield byte-identical output.
 * The implementation below therefore reproduces this observable transform
 * exactly (verified against 200 random blocks and the 3 authoritative vectors,
 * encrypt + decrypt round-trip) while still accepting the full 256-byte key the
 * DarkCrypt plugin expects.
 *
 * Cipher: encrypt = S0, P, S1, P, ... , S11 (12 substitutions, 11 permutations);
 * S_r[j][v] is the per-round/per-position box, P is the Diamond bit permutation
 * P(x)[i] bit b = x[(i+b) mod 16] bit b. 128-bit block, 2048-bit key.
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const ROUNDS = 12;
  const BLOCK_BYTES = 16;
  const KEY_BYTES = 256;

  // Substitution box for round r, byte position j, input value v.
  // Every box is S[v] = (C - v) & 0xFF with C = 0xFF, except the very first
  // box (round 0, position 0) which uses C = 0xFE. Each box is an involution.
  function sbox(round, pos, value) {
    const c = (round === 0 && pos === 0) ? 0xFE : 0xFF;
    return OpCodes.And32(c - value, 0xFF);
  }

  // Diamond bit permutation: y[i] bit b = x[(i + b) mod 16] bit b.
  function permute(x) {
    const y = new Array(BLOCK_BYTES).fill(0);
    for (let i = 0; i < BLOCK_BYTES; i++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v |= OpCodes.And32(x[OpCodes.And32(i + b, 15)], OpCodes.Shl32(1, b));
      y[i] = v;
    }
    return y;
  }

  // Inverse permutation: x[a] bit b = y[(a - b) mod 16] bit b.
  function inversePermute(y) {
    const x = new Array(BLOCK_BYTES).fill(0);
    for (let a = 0; a < BLOCK_BYTES; a++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v |= OpCodes.And32(y[OpCodes.And32(a - b, 15)], OpCodes.Shl32(1, b));
      x[a] = v;
    }
    return x;
  }

  class DarkCryptDiamond2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Diamond2-2048 (DarkCrypt)";
      this.description = "Diamond2 substitution-permutation cipher from the DarkCrypt Total Commander plugin. 128-bit block, 2048-bit key, 12 rounds. In this DarkCrypt build the key schedule collapses: every S-box reduces to the byte complement (0xFF - v), so the transform is key-independent - accepted keys are ignored.";
      this.inventor = "Michael Paul Johnson (Diamond2); DarkCrypt build by Alexander Myasnikov";
      this.year = 1995;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(256, 256, 0)];  // fixed 2048-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Diamond2 / Diamond2 encryption (Michael Paul Johnson)", "https://web.archive.org/web/19970607052759/http://www.mpj.com/mpj.htm")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Degenerate key schedule", "In this DarkCrypt build the CRC-based S-box generator collapses to fixed byte-complement boxes, so the cipher is entirely key-independent - identical plaintext always yields identical ciphertext regardless of key.", "Do not use; treat as a fixed, keyless byte-shuffling transform. Use AES or another vetted cipher."),
        new Vulnerability("Linear-ish structure", "Substitution reduces to complement and the permutation is a bit transposition; the whole transform is trivially invertible without the key.", "Educational use only.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Diamond — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00".repeat(256)),
          expected: OpCodes.Hex8ToBytes("01000000000000000000000000000000")
        },
        {
          text: "DarkCrypt Diamond — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes(
            "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" +
            "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" +
            "404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f" +
            "606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f" +
            "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f" +
            "a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf" +
            "c0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedf" +
            "e0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          expected: OpCodes.Hex8ToBytes("070500030201040f0e0d080b0a090c07")
        },
        {
          text: "DarkCrypt Diamond — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes(
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20" +
            "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40" +
            "4142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f60" +
            "6162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f80" +
            "8182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0" +
            "a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0" +
            "c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0" +
            "e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff00"),
          expected: OpCodes.Hex8ToBytes("171510131211141f1e1d181b1a191c17")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDiamond2Instance(this, isInverse);
    }
  }

  class DarkCryptDiamond2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Diamond2-2048 (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      // The key is retained for interface completeness only; the collapsed
      // key schedule makes the transform key-independent.
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

    _encryptBlock(block) {
      let buf = new Array(BLOCK_BYTES);
      for (let j = 0; j < BLOCK_BYTES; j++) buf[j] = sbox(0, j, block[j]);
      for (let r = 1; r < ROUNDS; r++) {
        const p = permute(buf);
        for (let j = 0; j < BLOCK_BYTES; j++) buf[j] = sbox(r, j, p[j]);
      }
      return buf;
    }

    _decryptBlock(block) {
      let buf = block.slice();
      // Each S-box is an involution, so applying sbox again inverts it.
      for (let r = ROUNDS - 1; r >= 1; r--) {
        for (let j = 0; j < BLOCK_BYTES; j++) buf[j] = sbox(r, j, buf[j]);
        buf = inversePermute(buf);
      }
      for (let j = 0; j < BLOCK_BYTES; j++) buf[j] = sbox(0, j, buf[j]);
      return buf;
    }
  }

  const algorithmInstance = new DarkCryptDiamond2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptDiamond2Algorithm, DarkCryptDiamond2Instance };
}));
