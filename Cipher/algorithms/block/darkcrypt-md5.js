/*
 * MD5-512 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MD5 compression function used as a raw block cipher, as implemented in the DarkCrypt
 * Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 *
 * This runs the unmodified, standard MD5 compression function (64 steps, standard
 * F/G/H/I functions, standard shift amounts 7/12/17/22, 5/9/14/20, 4/11/16/23, 6/10/15/21,
 * and the standard sine-derived additive constants) but WITHOUT the Davies-Meyer feedback
 * addition and WITHOUT a fixed IV: the 128-bit plaintext block is loaded directly into the
 * working registers (A,B,C,D) and the 512-bit key is used directly as the one-block
 * message schedule (16 x 32-bit words, little-endian). Since every internal MD5 step
 * (modular addition, boolean function, left rotation) is invertible given the message
 * words, this makes the compression function a genuine keyed permutation of the 128-bit
 * state, which is exactly what decryption reverses. 128-bit blocks, 512-bit keys.
 * Educational only.
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

  // Standard MD5 per-step additive constants, K[i] = floor(abs(sin(i+1)) * 2^32) (RFC 1321).
  const T = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  function stepInfo(i) {
    let f, g;
    if (i < 16) { f = (B, C, D) => OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(B, C), OpCodes.And32(~B, D))); g = i; }
    else if (i < 32) { f = (B, C, D) => OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(D, B), OpCodes.And32(~D, C))); g = (5 * i + 1) % 16; }
    else if (i < 48) { f = (B, C, D) => OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(B, C), D)); g = (3 * i + 5) % 16; }
    else { f = (B, C, D) => OpCodes.ToUint32(OpCodes.Xor32(C, OpCodes.Or32(B, OpCodes.ToUint32(~D)))); g = (7 * i) % 16; }
    return { f, g };
  }

  function md5Encrypt(block, M) {
    let [A, B, C, D] = block;
    for (let i = 0; i < 64; i++) {
      const { f, g } = stepInfo(i);
      const tmp = OpCodes.ToUint32(f(B, C, D) + A + T[i] + M[g]);
      A = D; D = C; C = B;
      B = OpCodes.ToUint32(B + OpCodes.RotL32(tmp, S[i]));
    }
    return [A, B, C, D];
  }

  // Inverse: replay the 64 steps back to front. At step i the forward transform was
  // (A,B,C,D) -> (D, B+rotl(f+A+T+M,S), B, C); given the post-state we recover B_old = C_new,
  // C_old = D_new, D_old = A_new, and A_old by undoing the rotate/add on B_new.
  function md5Decrypt(block, M) {
    let [A, B, C, D] = block;
    for (let i = 63; i >= 0; i--) {
      const { f, g } = stepInfo(i);
      const bOld = C, cOld = D, dOld = A;
      const rotated = OpCodes.ToUint32(B - bOld);
      const tmp = OpCodes.RotR32(rotated, S[i]);
      const aOld = OpCodes.ToUint32(tmp - f(bOld, cOld, dOld) - T[i] - M[g]);
      A = aOld; B = bOld; C = cOld; D = dOld;
    }
    return [A, B, C, D];
  }

  class DarkCryptMD5Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "MD5-512 (DarkCrypt)";
      this.description = "MD5-512 as implemented in the DarkCrypt Total Commander plugin: the standard MD5 compression function used as an unkeyed-IV, non-feedback block permutation, with the 512-bit key supplying the message schedule directly. 128-bit block, 512-bit key.";
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
        new LinkItem("RFC 1321: The MD5 Message-Digest Algorithm", "https://www.ietf.org/rfc/rfc1321.txt")
      ];
      this.tests = [
        {
          text: "DarkCrypt MD5-512 - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("971ccdf7813648a532d8682b39a60cf9")
        },
        {
          text: "DarkCrypt MD5-512 - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("6d210fba8457fd414a30c8e0c470ae14")
        },
        {
          text: "DarkCrypt MD5-512 - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("dcdb82ce51a0561b5d040a1df4aad95f")
        }
      ];
    }

    CreateInstance(isInverse = false) { return new DarkCryptMD5Instance(this, isInverse); }
  }

  class DarkCryptMD5Instance extends IBlockCipherInstance {
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
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MD5-512 (DarkCrypt) requires exactly 64 bytes`);
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
      const out = md5Encrypt(this._blockToWords(block), this._M);
      return this._wordsToBlock(out);
    }

    _decryptBlock(block) {
      const out = md5Decrypt(this._blockToWords(block), this._M);
      return this._wordsToBlock(out);
    }
  }

  const algorithmInstance = new DarkCryptMD5Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMD5Algorithm, DarkCryptMD5Instance };
}));
