/*
 * MD4-512 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MD4 compression function used as a raw block cipher, as implemented in the DarkCrypt
 * Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 *
 * This runs the unmodified, standard MD4 compression function (three 16-step rounds,
 * standard F/G/H functions, standard shift amounts 3/7/11/19, 3/5/9/13, 3/9/11/15, standard
 * round constants 0, 0x5A827999, 0x6ED9EBA1, and the standard message-word schedules for
 * rounds 2 and 3) but WITHOUT the Davies-Meyer feedback addition and WITHOUT a fixed IV that
 * hashing normally uses: the 128-bit plaintext block is loaded directly into the working
 * registers (A,B,C,D) and the 512-bit key is used directly as the one-block message
 * schedule (16 x 32-bit words, little-endian). Since every internal MD4 step (modular
 * addition, XOR/AND, left rotation) is invertible given the message words, this makes the
 * compression function a genuine keyed permutation of the 128-bit state, which is exactly
 * what decryption reverses. 128-bit blocks, 512-bit keys. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([
        '../../AlgorithmFramework', '../../OpCodes'], factory);
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

  const S1 = [3, 7, 11, 19];
  const S2 = [3, 5, 9, 13];
  const S3 = [3, 9, 11, 15];
  const K2 = 0x5A827999;
  const K3 = 0x6ED9EBA1;
  const R2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
  const R3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
  // Inverse permutation of R2/R3 (step index -> message-word index) used by decrypt to
  // walk the round back to front while looking up which lane (A/D/C/B) each step touched.
  const LANE = ['A', 'D', 'C', 'B'];

  function F(x, y, z) { return OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(~x, z))); }
  function G(x, y, z) { return OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(x, z)), OpCodes.And32(y, z))); }
  function H(x, y, z) { return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(x, y), z)); }

  function md4Encrypt(block, M) {
    let [A, B, C, D] = block;
    for (let i = 0; i < 16; i++) {
      const s = S1[i % 4];
      const w = M[i];
      if (i % 4 === 0) A = OpCodes.RotL32(OpCodes.ToUint32(A + F(B, C, D) + w), s);
      else if (i % 4 === 1) D = OpCodes.RotL32(OpCodes.ToUint32(D + F(A, B, C) + w), s);
      else if (i % 4 === 2) C = OpCodes.RotL32(OpCodes.ToUint32(C + F(D, A, B) + w), s);
      else B = OpCodes.RotL32(OpCodes.ToUint32(B + F(C, D, A) + w), s);
    }
    for (let i = 0; i < 16; i++) {
      const s = S2[i % 4];
      const w = M[R2[i]];
      if (i % 4 === 0) A = OpCodes.RotL32(OpCodes.ToUint32(A + G(B, C, D) + w + K2), s);
      else if (i % 4 === 1) D = OpCodes.RotL32(OpCodes.ToUint32(D + G(A, B, C) + w + K2), s);
      else if (i % 4 === 2) C = OpCodes.RotL32(OpCodes.ToUint32(C + G(D, A, B) + w + K2), s);
      else B = OpCodes.RotL32(OpCodes.ToUint32(B + G(C, D, A) + w + K2), s);
    }
    for (let i = 0; i < 16; i++) {
      const s = S3[i % 4];
      const w = M[R3[i]];
      if (i % 4 === 0) A = OpCodes.RotL32(OpCodes.ToUint32(A + H(B, C, D) + w + K3), s);
      else if (i % 4 === 1) D = OpCodes.RotL32(OpCodes.ToUint32(D + H(A, B, C) + w + K3), s);
      else if (i % 4 === 2) C = OpCodes.RotL32(OpCodes.ToUint32(C + H(D, A, B) + w + K3), s);
      else B = OpCodes.RotL32(OpCodes.ToUint32(B + H(C, D, A) + w + K3), s);
    }
    return [A, B, C, D];
  }

  // Inverse: replay the 48 steps back to front, undoing each rotate/add in turn.
  function md4Decrypt(block, M) {
    let [A, B, C, D] = block;
    for (let i = 15; i >= 0; i--) {
      const s = S3[i % 4];
      const w = M[R3[i]];
      if (i % 4 === 0) A = OpCodes.ToUint32(OpCodes.RotR32(A, s) - H(B, C, D) - w - K3);
      else if (i % 4 === 1) D = OpCodes.ToUint32(OpCodes.RotR32(D, s) - H(A, B, C) - w - K3);
      else if (i % 4 === 2) C = OpCodes.ToUint32(OpCodes.RotR32(C, s) - H(D, A, B) - w - K3);
      else B = OpCodes.ToUint32(OpCodes.RotR32(B, s) - H(C, D, A) - w - K3);
    }
    for (let i = 15; i >= 0; i--) {
      const s = S2[i % 4];
      const w = M[R2[i]];
      if (i % 4 === 0) A = OpCodes.ToUint32(OpCodes.RotR32(A, s) - G(B, C, D) - w - K2);
      else if (i % 4 === 1) D = OpCodes.ToUint32(OpCodes.RotR32(D, s) - G(A, B, C) - w - K2);
      else if (i % 4 === 2) C = OpCodes.ToUint32(OpCodes.RotR32(C, s) - G(D, A, B) - w - K2);
      else B = OpCodes.ToUint32(OpCodes.RotR32(B, s) - G(C, D, A) - w - K2);
    }
    for (let i = 15; i >= 0; i--) {
      const s = S1[i % 4];
      const w = M[i];
      if (i % 4 === 0) A = OpCodes.ToUint32(OpCodes.RotR32(A, s) - F(B, C, D) - w);
      else if (i % 4 === 1) D = OpCodes.ToUint32(OpCodes.RotR32(D, s) - F(A, B, C) - w);
      else if (i % 4 === 2) C = OpCodes.ToUint32(OpCodes.RotR32(C, s) - F(D, A, B) - w);
      else B = OpCodes.ToUint32(OpCodes.RotR32(B, s) - F(C, D, A) - w);
    }
    return [A, B, C, D];
  }

  class DarkCryptMD4Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "MD4-512 (DarkCrypt)";
      this.description = "MD4-512 as implemented in the DarkCrypt Total Commander plugin: the standard MD4 compression function used as an unkeyed-IV, non-feedback block permutation, with the 512-bit key supplying the message schedule directly. 128-bit block, 512-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt plugin)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;
      this.SupportedKeySizes = [new KeySize(64, 64, 0)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];
      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("RFC 1320: The MD4 Message-Digest Algorithm", "https://www.ietf.org/rfc/rfc1320.txt")
      ];
      this.tests = [
        {
          text: "DarkCrypt MD4-512 - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("3648c833d15291c1dfd962e7bd2700a2")
        },
        {
          text: "DarkCrypt MD4-512 - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("23ee5ffec80aaacca3a67d2eb23ade94")
        },
        {
          text: "DarkCrypt MD4-512 - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("b41ec8731d7562c1bfb558a06022d20a")
        }
      ];
    }

    CreateInstance(isInverse = false) { return new DarkCryptMD4Instance(this, isInverse); }
  }

  class DarkCryptMD4Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._M = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._M = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MD4-512 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._M = [];
      for (let i = 0; i < 16; i++)
        this._M.push(OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]));
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
      const out = md4Encrypt(this._blockToWords(block), this._M);
      return this._wordsToBlock(out);
    }

    _decryptBlock(block) {
      const out = md4Decrypt(this._blockToWords(block), this._M);
      return this._wordsToBlock(out);
    }
  }

  const algorithmInstance = new DarkCryptMD4Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMD4Algorithm, DarkCryptMD4Instance };
}));
