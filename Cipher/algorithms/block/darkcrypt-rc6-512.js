/*
 * RC6-512 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RC6 (Rivest, Robshaw, Sidney, Yin — AES finalist) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project):
 * standard 128-bit block, 20 rounds, magic constants P32/Q32, extended here
 * with a 512-bit (64-byte) key (standard RC6 only defines 128/192/256-bit
 * keys). The key schedule mixing loop is textbook RC6, but the raw key
 * bytes are packed into 32-bit key-schedule words BIG-ENDIAN (first byte of
 * each 4-byte group becomes the most significant byte) rather than the
 * little-endian packing textbook RC5/RC6 use; the 128-bit data block itself
 * is still loaded little-endian. This is a genuine full 128-bit-block
 * transform — no truncation or pass-through quirk (unlike this plugin's
 * RC5 and LOKI'91 siblings).
 *
 * As implemented in the DarkCrypt Total Commander plugin; test vectors
 * verified against the DarkCrypt implementation. 512-bit key, 128-bit
 * block. Educational only.
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

  const P32 = 0xB7E15163;
  const Q32 = 0x9E3779B9;
  const ROUNDS = 20;
  const TABLE_SIZE = 2 * ROUNDS + 4; // 44

  function rotL(value, positions) {
    return OpCodes.RotL32(OpCodes.ToUint32(value), OpCodes.And32(positions, 31));
  }

  function rotR(value, positions) {
    return OpCodes.RotR32(OpCodes.ToUint32(value), OpCodes.And32(positions, 31));
  }

  class DarkCryptRC6_512Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "RC6-512 (DarkCrypt)";
      this.description = "RC6 variant from the DarkCrypt Total Commander plugin: standard 128-bit block, 20 rounds, extended to a 512-bit (64-byte) key. The key schedule packs each 4-byte key group big-endian (vs. textbook little-endian); the data block itself remains little-endian. As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Ron Rivest, Matt Robshaw, Ray Sidney, Yiqun Lisa Yin; DarkCrypt variant by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("RC6 Algorithm Specification", "https://people.csail.mit.edu/rivest/Rivest-rc6.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key extension", "512-bit key size and big-endian key-byte packing are a non-standard, unanalyzed extension of RC6.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Rc6-512 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("89353321da8ac0abf854ded7d845134b")
        },
        {
          text: "DarkCrypt Rc6-512 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("896e6b581c0d1a85607052b240b2f707")
        },
        {
          text: "DarkCrypt Rc6-512 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("9f384a095e48086ebdb02763ad0e66c4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptRC6_512Instance(this, isInverse);
    }
  }

  class DarkCryptRC6_512Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.keySchedule = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.keySchedule = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. RC6-512 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._generateKeySchedule();
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

    // Standard RC6 key-schedule mixing, but key bytes are packed big-endian per 4-byte word
    // (each L[j] word is built from key bytes in ascending index order, i.e. Pack32BE,
    // unlike textbook RC5/RC6's little-endian packing).
    _generateKeySchedule() {
      const c = Math.max(1, Math.floor(this.KeySize / 4));
      const L = new Array(c);
      for (let j = 0; j < c; j++) {
        L[j] = OpCodes.Pack32BE(
          this._key[4 * j], this._key[4 * j + 1], this._key[4 * j + 2], this._key[4 * j + 3]
        );
      }

      this.keySchedule = new Array(TABLE_SIZE);
      this.keySchedule[0] = P32;
      for (let k = 1; k < TABLE_SIZE; k++)
        this.keySchedule[k] = OpCodes.ToUint32(this.keySchedule[k - 1] + Q32);

      const iterations = 3 * Math.max(c, TABLE_SIZE);
      let A = 0, B = 0, i = 0, j = 0;

      for (let k = 0; k < iterations; k++) {
        A = this.keySchedule[i] = rotL(OpCodes.ToUint32(this.keySchedule[i] + A + B), 3);
        B = L[j] = rotL(OpCodes.ToUint32(L[j] + A + B), OpCodes.AndN(A + B, 31));

        i = (i + 1) % TABLE_SIZE;
        j = (j + 1) % c;
      }

      OpCodes.ClearArray(L);
    }

    _encryptBlock(block) {
      let A = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let B = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let C = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let D = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      B = OpCodes.ToUint32(B + this.keySchedule[0]);
      D = OpCodes.ToUint32(D + this.keySchedule[1]);

      for (let i = 1; i <= ROUNDS; i++) {
        const t = rotL(Math.imul(B, OpCodes.ToUint32(2 * B + 1)), 5);
        const u = rotL(Math.imul(D, OpCodes.ToUint32(2 * D + 1)), 5);

        A = rotL(OpCodes.XorN(A, t), OpCodes.AndN(u, 31));
        A = OpCodes.ToUint32(A + this.keySchedule[2 * i]);

        C = rotL(OpCodes.XorN(C, u), OpCodes.AndN(t, 31));
        C = OpCodes.ToUint32(C + this.keySchedule[2 * i + 1]);

        const tmp = A; A = B; B = C; C = D; D = tmp;
      }

      A = OpCodes.ToUint32(A + this.keySchedule[2 * ROUNDS + 2]);
      C = OpCodes.ToUint32(C + this.keySchedule[2 * ROUNDS + 3]);

      return [
        ...OpCodes.Unpack32LE(A), ...OpCodes.Unpack32LE(B),
        ...OpCodes.Unpack32LE(C), ...OpCodes.Unpack32LE(D)
      ];
    }

    _decryptBlock(block) {
      let A = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let B = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let C = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let D = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      C = OpCodes.ToUint32(C - this.keySchedule[2 * ROUNDS + 3]);
      A = OpCodes.ToUint32(A - this.keySchedule[2 * ROUNDS + 2]);

      for (let i = ROUNDS; i >= 1; i--) {
        const tmp = D; D = C; C = B; B = A; A = tmp;

        const t = rotL(Math.imul(B, OpCodes.ToUint32(2 * B + 1)), 5);
        const u = rotL(Math.imul(D, OpCodes.ToUint32(2 * D + 1)), 5);

        C = OpCodes.ToUint32(C - this.keySchedule[2 * i + 1]);
        C = rotR(C, OpCodes.AndN(t, 31));
        C = OpCodes.XorN(C, u);

        A = OpCodes.ToUint32(A - this.keySchedule[2 * i]);
        A = rotR(A, OpCodes.AndN(u, 31));
        A = OpCodes.XorN(A, t);
      }

      D = OpCodes.ToUint32(D - this.keySchedule[1]);
      B = OpCodes.ToUint32(B - this.keySchedule[0]);

      return [
        ...OpCodes.Unpack32LE(A), ...OpCodes.Unpack32LE(B),
        ...OpCodes.Unpack32LE(C), ...OpCodes.Unpack32LE(D)
      ];
    }
  }

  const algorithmInstance = new DarkCryptRC6_512Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptRC6_512Algorithm, DarkCryptRC6_512Instance };
}));
