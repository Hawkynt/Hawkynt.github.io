/*
 * NewDES'96-120 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The 1996-revised NewDES cipher (Robert Scott's fix for the original 1985
 * NewDES's related-key-vulnerable key schedule) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 * Same fixed 256-byte rotor S-box and 64-bit/8-register Feistel-like block
 * structure as NewDES, but the key material is drawn directly from the
 * 15-byte key cycling through a 0..14 index, mixed with an extra "ex" byte
 * (taken from Key[7]/Key[8]/Key[9] at three fixed points in the cycle) so
 * that repeating the key no longer produces a fixed periodic pattern.
 * Test vectors verified against the DarkCrypt implementation (encrypt/decrypt
 * round-trip confirmed). 64-bit blocks, 120-bit keys. Educational only.
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

  // NewDES rotor S-box (Robert Scott, 1985/1996; identical table used by both
  // the original and the 1996-revised key-schedule variant)
  const ROTOR = [
    32,137,239,188,102,125,221, 72,212, 68, 81, 37, 86,237,147,149,
    70,229, 17,124,115,207, 33, 20,122,143, 25,215, 51,183,138,142,
   146,211,110,173,  1,228,189, 14,103, 78,162, 36,253,167,116,255,
   158, 45,185, 50, 98,168,250,235, 54,141,195,247,240, 63,148,  2,
   224,169,214,180, 62, 22,117,108, 19,172,161,159,160, 47, 43,171,
   194,175,178, 56,196,112, 23,220, 89, 21,164,130,157,  8, 85,251,
   216, 44, 94,179,226, 38, 90,119, 40,202, 34,206, 35, 69,231,246,
    29,109, 74, 71,176,  6, 60,145, 65, 13, 77,151, 12,127, 95,199,
    57,101,  5,232,150,210,129, 24,181, 10,121,187, 48,193,139,252,
   219, 64, 88,233, 96,128, 80, 53,191,144,218, 11,106,132,155,104,
    91,136, 31, 42,243, 66,126,135, 30, 26, 87,186,182,154,242,123,
    82,166,208, 39,152,190,113,205,114,105,225, 84, 73,163, 99,111,
   204, 61,200,217,170, 15,198, 28,192,254,134,234,222,  7,236,248,
   201, 41,177,156, 92,131, 67,249,245,184,203,  9,241,  0, 27, 46,
   133,174, 75, 18, 93,209,100,120, 76,213, 16, 83,  4,107,140, 52,
    58, 55,  3,244, 97,197,238,227,118, 49, 79,230,223,165,153, 59
  ];

  class DarkCryptNewDES96Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "NewDES'96-120 (DarkCrypt)";
      this.description = "1996-revised NewDES cipher by Robert Scott (fixed key schedule) as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 120-bit key, same rotor S-box as NewDES but with an extra key-derived XOR term mixed in at three points of the key cycle to remove the related-key weakness.";
      this.inventor = "Robert Scott; DarkCrypt port by Alexander Myasnikov";
      this.year = 1996;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(15, 15, 0)]; // fixed 120-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("NewDES original article (Cryptologia 9(1), 1985)", "https://www.tandfonline.com/doi/abs/10.1080/0161-118591857944"),
        new LinkItem("newdes.c, revised 3-2-96 (better key expansion), released to the public domain by Robert Scott", "https://github.com/stamparm/cryptospecs/blob/master/symmetrical/sources/newdes.c")
      ];

      this.knownVulnerabilities = [];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Newdes96 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000").slice(0, 15),
          expected: OpCodes.Hex8ToBytes("a2176054f58b3458")
        },
        {
          text: "DarkCrypt Newdes96 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e"),
          expected: OpCodes.Hex8ToBytes("9f20bedbc9eb0801")
        },
        {
          text: "DarkCrypt Newdes96 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("58c0b08406d12b14")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptNewDES96Instance(this, isInverse);
    }
  }

  class DarkCryptNewDES96Instance extends IBlockCipherInstance {
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
      if (keyBytes.length !== 15)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. NewDES'96-120 (DarkCrypt) requires exactly 15 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
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

    // Direct transliteration of Robert Scott's 1996-revised encrypt()/decrypt():
    // a running index i cycles 0..14 through the 15-byte key; every time it
    // wraps, an extra "ex" byte (Key[7], then Key[8], then Key[9]) is folded
    // into the rotor input for all subsequent steps until the next wrap.
    _encryptBlock(block) {
      const B = block.slice();
      const Key = this._key;
      let ex = 0, i = 0;
      while (true) {
        B[4] = OpCodes.Xor32(B[4], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[0], Key[i]), ex)]);
        if (++i === 15) { i = 0; ex = Key[7]; }
        B[5] = OpCodes.Xor32(B[5], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[1], Key[i]), ex)]);
        if (++i === 15) { i = 0; ex = Key[8]; }
        B[6] = OpCodes.Xor32(B[6], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[2], Key[i]), ex)]);
        if (++i === 15) { i = 0; ex = Key[9]; }
        B[7] = OpCodes.Xor32(B[7], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[3], Key[i]), ex)]);
        if (++i === 15) return B;

        B[1] = OpCodes.Xor32(B[1], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[4], Key[i++]), ex)]);
        B[2] = OpCodes.Xor32(B[2], ROTOR[OpCodes.Xor32(B[4], B[5])]);
        B[3] = OpCodes.Xor32(B[3], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[6], Key[i++]), ex)]);
        B[0] = OpCodes.Xor32(B[0], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[7], Key[i++]), ex)]);
      }
    }

    _decryptBlock(block) {
      const B = block.slice();
      const Key = this._key;
      let ex = Key[9], i = 14;
      while (true) {
        B[7] = OpCodes.Xor32(B[7], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[3], Key[i]), ex)]);
        if (--i < 0) { i = 14; ex = Key[8]; }
        B[6] = OpCodes.Xor32(B[6], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[2], Key[i]), ex)]);
        if (--i < 0) { i = 14; ex = Key[7]; }
        B[5] = OpCodes.Xor32(B[5], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[1], Key[i]), ex)]);
        if (--i < 0) { i = 14; ex = 0; }
        B[4] = OpCodes.Xor32(B[4], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[0], Key[i]), ex)]);

        if (--i < 0) return B;

        B[0] = OpCodes.Xor32(B[0], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[7], Key[i--]), ex)]);
        B[3] = OpCodes.Xor32(B[3], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[6], Key[i--]), ex)]);
        B[2] = OpCodes.Xor32(B[2], ROTOR[OpCodes.Xor32(B[4], B[5])]);
        B[1] = OpCodes.Xor32(B[1], ROTOR[OpCodes.Xor32(OpCodes.Xor32(B[4], Key[i--]), ex)]);
      }
    }
  }

  const algorithmInstance = new DarkCryptNewDES96Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptNewDES96Algorithm, DarkCryptNewDES96Instance };
}));
