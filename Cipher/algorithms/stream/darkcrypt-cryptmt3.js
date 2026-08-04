/*
 * CryptMT ver.3 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CryptMT version 3 is an eSTREAM Phase-3 stream cipher by Matsumoto, Saito,
 * Nishimura and Hagita: an F2-linear generator (a variant of SFMT, the
 * SIMD-oriented Fast Mersenne Twister) combined with a nonlinear filter that
 * mixes generator output using integer multiplication ("multiplicative
 * filter with memory"). Key and IV (each a multiple of 128 bits) are packed
 * as little-endian 32-bit words into 128-bit blocks, concatenated as
 * [IV, Key], duplicated once, and whitened with the digits of pi (the last
 * 128-bit block gets +314159, +265358, +979323, +846264 added lane-wise) to
 * break symmetry. A "booter" (booter_am) then folds this array through a
 * multiplicative recurrence to seed the filter's accumulator ("lung"); the
 * filter itself (filter_16bytes) generates 16 keystream bytes per pair of
 * 128-bit input blocks.
 *
 * The DarkCrypt Total Commander plugin implements the reference algorithm
 * essentially verbatim, matching the exact pi-digit whitening constants and
 * multiplicative booter/filter recurrences from the official reference
 * implementation (magurosan/CryptMT, src/cryptmt.cpp). This port implements
 * the scalar (non-SIMD) reference code paths for a 512-bit key and 512-bit
 * IV, and the short-message fast path (genrand_bytes_first), which is what
 * the DarkCrypt implementation uses for the block sizes used here.
 * 512-bit key, 512-bit IV. Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  const MUL32 = (a, b) => OpCodes.ToUint32(Math.imul(OpCodes.ToUint32(a), OpCodes.ToUint32(b)));

  function u8to32(v, off) {
    return OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(v[off], OpCodes.Shl32(v[off + 1], 8)), OpCodes.Shl32(v[off + 2], 16)), OpCodes.Shl32(v[off + 3], 24));
  }

  function newBlock() { return [0, 0, 0, 0]; }

  // booter_am (reference cryptmt.cpp, non-SIMD path): folds pos1[]+pos2[] through a
  // multiplicative recurrence, mutating pos1 in place and writing pos2[i+2] outputs.
  function booterAm(acc, pos1, pos1Off, pos2, pos2Off, count) {
    const a = [0, 0, 0, 0], b = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 4; j++) {
        const v = OpCodes.ToUint32(pos1[pos1Off + i][j] + pos2[pos2Off + i][j]);
        pos1[pos1Off + i][j] = v;
        a[j] = v;
      }
      const tmp = a[0];
      a[0] = OpCodes.Xor32(a[3], OpCodes.Shr32(a[0], 13));
      a[3] = OpCodes.Xor32(a[2], OpCodes.Shr32(a[3], 13));
      a[2] = OpCodes.Xor32(a[1], OpCodes.Shr32(a[2], 13));
      a[1] = OpCodes.Xor32(tmp, OpCodes.Shr32(a[1], 13));
      const p2n = pos2[pos2Off + i + 1];
      b[0] = OpCodes.Xor32(p2n[3], OpCodes.Shr32(p2n[0], 11));
      b[1] = OpCodes.Xor32(p2n[2], OpCodes.Shr32(p2n[1], 11));
      b[2] = OpCodes.Xor32(p2n[0], OpCodes.Shr32(p2n[2], 11));
      b[3] = OpCodes.Xor32(p2n[1], OpCodes.Shr32(p2n[3], 11));
      for (let j = 0; j < 4; j++)
        acc[j] = OpCodes.ToUint32(MUL32(OpCodes.ToUint32(2 * b[j] + 1), acc[j]) + b[j]);
      if (!pos2[pos2Off + i + 2]) pos2[pos2Off + i + 2] = newBlock();
      for (let j = 0; j < 4; j++)
        pos2[pos2Off + i + 2][j] = OpCodes.ToUint32(a[j] - acc[j]);
    }
  }

  // filter_16bytes (reference cryptmt.cpp, non-SIMD path): the nonlinear multiplicative
  // filter with memory; generates 16 keystream bytes (XORed with plain) per input block pair.
  function filter16Bytes(sfmt, sfmtOff, accum, cipher, plain, count) {
    let ac1 = accum[0], ac2 = accum[1], ac3 = accum[2], ac4 = accum[3];
    for (let i = 0; i < count; i++) {
      const base = i * 16;
      for (let half = 0; half < 2; half++) {
        const t1 = ac1;
        ac1 = OpCodes.Xor32(ac1, OpCodes.Shr32(ac2, 1));
        ac2 = OpCodes.Xor32(ac2, OpCodes.Shr32(ac3, 1));
        ac3 = OpCodes.Xor32(ac3, OpCodes.Shr32(ac4, 1));
        ac4 = OpCodes.Xor32(ac4, OpCodes.Shr32(t1, 1));
        const blk = sfmt[sfmtOff + i * 2 + half];
        ac1 = OpCodes.ToUint32(MUL32(OpCodes.ToUint32(2 * ac1 + 1), blk[0]) + ac1);
        ac2 = OpCodes.ToUint32(MUL32(OpCodes.ToUint32(2 * ac2 + 1), blk[1]) + ac2);
        ac3 = OpCodes.ToUint32(MUL32(OpCodes.ToUint32(2 * ac3 + 1), blk[2]) + ac3);
        ac4 = OpCodes.ToUint32(MUL32(OpCodes.ToUint32(2 * ac4 + 1), blk[3]) + ac4);
        const u1 = OpCodes.Xor32(OpCodes.Shr32(ac1, 16), ac1), u2 = OpCodes.Xor32(OpCodes.Shr32(ac2, 16), ac2), u3 = OpCodes.Xor32(OpCodes.Shr32(ac3, 16), ac3), u4 = OpCodes.Xor32(OpCodes.Shr32(ac4, 16), ac4);
        const o = half === 0 ? [0, 1, 4, 5, 8, 9, 12, 13] : [2, 3, 6, 7, 10, 11, 14, 15];
        cipher[base + o[0]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[0]], OpCodes.And32(u1, 0xFF)), 0xFF);
        cipher[base + o[1]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[1]], OpCodes.And32(OpCodes.Shr32(u1, 8), 0xFF)), 0xFF);
        cipher[base + o[2]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[2]], OpCodes.And32(u2, 0xFF)), 0xFF);
        cipher[base + o[3]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[3]], OpCodes.And32(OpCodes.Shr32(u2, 8), 0xFF)), 0xFF);
        cipher[base + o[4]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[4]], OpCodes.And32(u3, 0xFF)), 0xFF);
        cipher[base + o[5]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[5]], OpCodes.And32(OpCodes.Shr32(u3, 8), 0xFF)), 0xFF);
        cipher[base + o[6]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[6]], OpCodes.And32(u4, 0xFF)), 0xFF);
        cipher[base + o[7]] = OpCodes.And32(OpCodes.Xor32(plain[base + o[7]], OpCodes.And32(OpCodes.Shr32(u4, 8), 0xFF)), 0xFF);
      }
    }
    accum[0] = ac1; accum[1] = ac2; accum[2] = ac3; accum[3] = ac4;
  }

  class DarkCryptCryptMT3Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "CryptMT3 (DarkCrypt)";
      this.description = "CryptMT version 3: an F2-linear (SFMT-family) generator combined with a nonlinear multiplicative filter with memory (Matsumoto, Saito, Nishimura, Hagita). Key and IV are packed into 128-bit blocks, concatenated, duplicated, and whitened with the digits of pi before a multiplicative 'booter' seeds the output filter. The DarkCrypt Total Commander plugin implements the published reference algorithm essentially verbatim for a 512-bit key and 512-bit IV.";
      this.inventor = "Makoto Matsumoto, Mutsuo Saito, Takuji Nishimura, Mariko Hagita";
      this.year = 2007;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(1, 1248, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("CryptMT Stream Cipher Version 3 (Hiroshima University)", "https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/cryptMT3-book1.pdf"),
        new LinkItem("Reference implementation (magurosan/CryptMT)", "https://github.com/magurosan/CryptMT")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unproven multiplicative filter", "CryptMT's security relies on an integer-multiplication-based nonlinear filter whose resistance to algebraic/statistical attack is less well understood than LFSR-only designs; it was not selected for the eSTREAM portfolio.", "Use a vetted, portfolio-selected stream cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (setup(key,iv) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt Mt3 — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("16c2831f942a0205bb448977fb9d5ecf5e94e40a3b4e4bd193c26baafbce05db6dd9b17d11ecc2ef2e49b6c1366385767def6b6c2e81cd5f1a4220b61f04d008919fcfe754964b8da34c45ef4147898565b1d2906d26c4bda7e3c753478bbc6a89cb9c30b6b1cd076d69bf1ca45c8343e8d4aad3fc339c7c7634ff34a9aa6363")
        },
        {
          text: "DarkCrypt Mt3 — incrementing key, zero IV, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("16c3811c902f0402b34d837cf79050c04e85f6192f5b5dc68bdb71b1e7d31bc44df8935e35c9e4c806609cea1a4eab594dde595f1ab4fb68227b1a8d2339ee37")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptCryptMT3Instance(this, isInverse);
    }
  }

  class DarkCryptCryptMT3Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. CryptMT3 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this._tryInitialize();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== 64)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. CryptMT3 (DarkCrypt) requires exactly 64 bytes`);
      this._iv = [...ivBytes];
      this._tryInitialize();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._state) throw new Error("Key and IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._state) throw new Error("Key and IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 16 !== 0)
        throw new Error("CryptMT3 (DarkCrypt) requires input length to be a multiple of 16 bytes");

      const plain = this.inputBuffer;
      const { sfmt, psfmtOff, lung, accum, keyAreaLength } = this._state;
      const count = Math.floor((plain.length + 7) / 8);
      const p = keyAreaLength - 2;
      booterAm(lung, sfmt, psfmtOff, sfmt, psfmtOff + p, count);
      const cipher = new Array(plain.length).fill(0);
      filter16Bytes(sfmt, psfmtOff, accum, cipher, plain, Math.floor(plain.length / 16));

      this.inputBuffer = [];
      return cipher;
    }

    _tryInitialize() {
      if (!this._key || !this._iv) return;

      const keyBlocks = this._key.length / 16; // 4
      const ivBlocks = this._iv.length / 16;    // 4
      const blockSize = keyBlocks + ivBlocks;   // 8
      const length = blockSize * 2;             // 16

      const totalBlocks = 156 + 64; // 156 (ARRAY_SIZE) plus generous padding for the booter/filter reach
      const sfmt = new Array(totalBlocks);
      for (let i = 0; i < totalBlocks; i++) sfmt[i] = newBlock();

      for (let i = 0; i < ivBlocks; i++)
        for (let j = 0; j < 4; j++)
          sfmt[i][j] = u8to32(this._iv, i * 16 + j * 4);

      for (let i = 0; i < keyBlocks; i++)
        for (let j = 0; j < 4; j++)
          sfmt[ivBlocks + i][j] = u8to32(this._key, i * 16 + j * 4);

      for (let i = 0; i < blockSize; i++)
        for (let j = 0; j < 4; j++)
          sfmt[blockSize + i][j] = sfmt[i][j];

      const p = 2 * blockSize - 1;
      sfmt[p][0] = OpCodes.ToUint32(sfmt[p][0] + 314159);
      sfmt[p][1] = OpCodes.ToUint32(sfmt[p][1] + 265358);
      sfmt[p][2] = OpCodes.ToUint32(sfmt[p][2] + 979323);
      sfmt[p][3] = OpCodes.ToUint32(sfmt[p][3] + 846264);

      const keyAreaLength = length; // 16

      const psfmtOff = keyAreaLength + 2; // 18
      const pIv = Math.floor(ivBlocks / 4);
      const lung = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) lung[i] = OpCodes.Or32(sfmt[pIv * 4][i], 1);
      const p2 = keyAreaLength - 2; // 14
      booterAm(lung, sfmt, 0, sfmt, p2, keyAreaLength + 2);
      const accum = [
        sfmt[2 * keyAreaLength + 1][0], sfmt[2 * keyAreaLength + 1][1],
        sfmt[2 * keyAreaLength + 1][2], sfmt[2 * keyAreaLength + 1][3]
      ];

      this._state = { sfmt, psfmtOff, lung, accum, keyAreaLength };
    }
  }

  const algorithmInstance = new DarkCryptCryptMT3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptCryptMT3Algorithm, DarkCryptCryptMT3Instance };
}));
