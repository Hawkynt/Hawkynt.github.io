/*
 * MD5-Karn (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A 256-bit block cipher built from three standard MD5 hash-compression calls (Phil Karn's
 * technique for widening a hash compression function into a larger-block cipher), as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya"
 * project).
 *
 * The 768-bit key is split into two 384-bit (48-byte) halves K1, K2. The 256-bit plaintext
 * is split into two 128-bit halves P1, P2. Each of the three internal calls is a full,
 * unmodified, standard MD5 compression (with its normal Davies-Meyer feedback and the
 * standard MD5 IV as its starting state; see darkcrypt-md5.js's underlying compress
 * primitive) over a full 64-byte one-block message P||K:
 *
 *   S1 = MD5compress(IV, P1 || K1)
 *   X1 = P2 XOR S1
 *   S2 = MD5compress(IV, X1 || K2)
 *   X2 = P1 XOR S2
 *   S3 = MD5compress(IV, X2 || K1)
 *   X3 = X1 XOR S3
 *   ciphertext = X3 || X2
 *
 * This is a 3-round unbalanced Feistel-like network over two 128-bit halves, each round
 * keyed by K1 or K2 and driven by a full MD5 compression as the round function. It is
 * invertible because each MD5 compression call in the forward direction only ever needs
 * values that are already known to an entity holding the ciphertext and the key (decrypt
 * simply replays the three compressions in the order S3, S1's message reconstruction, S2,
 * recovering P1 then P2 - see _decryptBlock). 256-bit blocks, 768-bit keys.
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
  const MD5_IV = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];

  function stepFG(i, B, C, D) {
    if (i < 16) return { f: OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(B, C), OpCodes.And32(~B, D))), g: i };
    if (i < 32) return { f: OpCodes.ToUint32(OpCodes.Or32(OpCodes.And32(D, B), OpCodes.And32(~D, C))), g: (5 * i + 1) % 16 };
    if (i < 48) return { f: OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(B, C), D)), g: (3 * i + 5) % 16 };
    return { f: OpCodes.ToUint32(OpCodes.Xor32(C, OpCodes.Or32(B, OpCodes.ToUint32(~D)))), g: (7 * i) % 16 };
  }

  // Standard MD5 compression: 4-word state + 64-byte (16-word) message -> new 4-word state
  // (full Davies-Meyer feedback included, exactly like ordinary MD5 hashing).
  function md5Compress(state, M) {
    const [a0, b0, c0, d0] = state;
    let [A, B, C, D] = state;
    for (let i = 0; i < 64; i++) {
      const { f, g } = stepFG(i, B, C, D);
      const tmp = OpCodes.ToUint32(f + A + T[i] + M[g]);
      A = D; D = C; C = B;
      B = OpCodes.ToUint32(B + OpCodes.RotL32(tmp, S[i]));
    }
    return [OpCodes.ToUint32(a0 + A), OpCodes.ToUint32(b0 + B), OpCodes.ToUint32(c0 + C), OpCodes.ToUint32(d0 + D)];
  }

  function bytesToWords(bytes) {
    const w = [];
    for (let i = 0; i < bytes.length; i += 4)
      w.push(OpCodes.Pack32LE(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]));
    return w;
  }

  function wordsToBytes(words) {
    const out = [];
    for (const w of words) out.push(...OpCodes.Unpack32LE(w));
    return out;
  }

  function xorBytes(a, b) { return a.map((x, i) => OpCodes.Xor32(x, b[i])); }

  function mdcKarnEncrypt(P1, P2, K1, K2) {
    const state1 = md5Compress(MD5_IV, bytesToWords([...P1, ...K1]));
    const X1 = xorBytes(P2, wordsToBytes(state1));
    const state2 = md5Compress(MD5_IV, bytesToWords([...X1, ...K2]));
    const X2 = xorBytes(P1, wordsToBytes(state2));
    const state3 = md5Compress(MD5_IV, bytesToWords([...X2, ...K1]));
    const X3 = xorBytes(X1, wordsToBytes(state3));
    return [...X3, ...X2];
  }

  function mdcKarnDecrypt(C1, C2, K1, K2) {
    const state3 = md5Compress(MD5_IV, bytesToWords([...C2, ...K1]));
    const X1 = xorBytes(C1, wordsToBytes(state3));
    const state2 = md5Compress(MD5_IV, bytesToWords([...X1, ...K2]));
    const P1 = xorBytes(C2, wordsToBytes(state2));
    const state1 = md5Compress(MD5_IV, bytesToWords([...P1, ...K1]));
    const P2 = xorBytes(X1, wordsToBytes(state1));
    return [...P1, ...P2];
  }

  class DarkCryptMDCKarnAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "MD5-Karn (DarkCrypt)";
      this.description = "MD5-Karn as implemented in the DarkCrypt Total Commander plugin: a 3-round unbalanced Feistel-like network over two 128-bit halves, using full standard MD5 compressions (with Davies-Meyer feedback) as the round function. 256-bit block, 768-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt plugin)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;
      this.SupportedKeySizes = [new KeySize(96, 96, 0)];
      this.SupportedBlockSizes = [new KeySize(32, 32, 0)];
      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("RFC 1321: The MD5 Message-Digest Algorithm", "https://www.ietf.org/rfc/rfc1321.txt")
      ];
      this.tests = [
        {
          text: "DarkCrypt MD5-Karn - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("452acc3a076ef6fd75da6abbfc31a513d85b25d31090fa2fb34475086902748b")
        },
        {
          text: "DarkCrypt MD5-Karn - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          expected: OpCodes.Hex8ToBytes("0606ccc436fabe0f4bf8c063af689e809ef6381e01659ec52da0972954f94f2c")
        },
        {
          text: "DarkCrypt MD5-Karn - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f60"),
          expected: OpCodes.Hex8ToBytes("91e968de04795d5eb92b3bcb32cb57550f5dc79886427010fea8633b037feffa")
        }
      ];
    }

    CreateInstance(isInverse = false) { return new DarkCryptMDCKarnInstance(this, isInverse); }
  }

  class DarkCryptMDCKarnInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K1 = null;
      this._K2 = null;
      this.inputBuffer = [];
      this.BlockSize = 32;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K1 = null; this._K2 = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 96)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MD5-Karn (DarkCrypt) requires exactly 96 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._K1 = keyBytes.slice(0, 48);
      this._K2 = keyBytes.slice(48, 96);
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

    _encryptBlock(block) {
      const P1 = block.slice(0, 16), P2 = block.slice(16, 32);
      return mdcKarnEncrypt(P1, P2, this._K1, this._K2);
    }

    _decryptBlock(block) {
      const C1 = block.slice(0, 16), C2 = block.slice(16, 32);
      return mdcKarnDecrypt(C1, C2, this._K1, this._K2);
    }
  }

  const algorithmInstance = new DarkCryptMDCKarnAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMDCKarnAlgorithm, DarkCryptMDCKarnInstance };
}));
