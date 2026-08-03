/*
 * NewDES-120 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The original 1985 NewDES cipher (Robert Scott, Cryptologia Vol. 9 No. 1) as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). This matches Mark Riordan's public-domain 1990 reference
 * implementation exactly:
 *   - 64-bit block, split into 8 one-byte registers B0..B7
 *   - 120-bit (15-byte) key, "unravelled" into a 60-byte schedule by simply
 *     repeating the 15-byte key 4 times (the original, pre-1996 key schedule)
 *   - 8 main loop iterations of 7 rotor-substitution/XOR steps each, plus one
 *     final 4-step tail (8*7+4 = 60 key bytes consumed, matching the schedule
 *     size), using a fixed 256-byte "rotor" S-box
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

  // NewDES rotor S-box (Robert Scott, 1985 / Mark Riordan reference, 1990)
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

  class DarkCryptNewDESAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "NewDES-120 (DarkCrypt)";
      this.description = "Original 1985 NewDES cipher by Robert Scott as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 120-bit key, 8 loop iterations plus a 4-step tail over a fixed 256-byte rotor S-box, simple 4x-repeated key schedule.";
      this.inventor = "Robert Scott; DarkCrypt port by Alexander Myasnikov";
      this.year = 1985;
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
        new LinkItem("Mark Riordan's public-domain reference implementation (1990)", "https://www.nic.funet.fi/pub/crypt/cryptography/rpem/rpem/newdes.c")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Related-key weakness", "The original (pre-1996) key schedule simply repeats the 15-byte key, which was later shown to be vulnerable to related-key attacks; superseded by NewDES'96.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Newdes — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000").slice(0, 15),
          expected: OpCodes.Hex8ToBytes("a2176054f58b3458")
        },
        {
          text: "DarkCrypt Newdes — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e"),
          expected: OpCodes.Hex8ToBytes("255cc7953fee5aeb")
        },
        {
          text: "DarkCrypt Newdes — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("48fbd180b8f4cd1a")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptNewDESInstance(this, isInverse);
    }
  }

  class DarkCryptNewDESInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._schedule = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._schedule = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 15)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. NewDES-120 (DarkCrypt) requires exactly 15 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      // Original (1985) key schedule: 60-byte "unravelled" key, formed by
      // simply repeating the 15-byte key 4 times.
      this._schedule = new Array(60);
      for (let i = 0; i < 60; i++) this._schedule[i] = this._key[i % 15];
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

    // Build the flat, ordered list of the 68 elementary "register ^= rotor[...]"
    // steps that make up one full NewDES block transform (8 loop iterations of
    // 7 steps + a 4-step tail). Encryption applies them in this order;
    // decryption applies the identical steps in exact reverse order (each step
    // is a self-inverse XOR of one register as a function of others, so
    // reversing the whole sequence inverts the transform).
    _steps() {
      const s = this._schedule;
      const steps = [];
      let idx = 0;
      for (let iter = 0; iter < 8; iter++) {
        steps.push({ t: 4, src: 0, k: s[idx++] });
        steps.push({ t: 5, src: 1, k: s[idx++] });
        steps.push({ t: 6, src: 2, k: s[idx++] });
        steps.push({ t: 7, src: 3, k: s[idx++] });
        steps.push({ t: 1, src: 4, k: s[idx++] });
        steps.push({ t: 2, special: true });
        steps.push({ t: 3, src: 6, k: s[idx++] });
        steps.push({ t: 0, src: 7, k: s[idx++] });
      }
      steps.push({ t: 4, src: 0, k: s[idx++] });
      steps.push({ t: 5, src: 1, k: s[idx++] });
      steps.push({ t: 6, src: 2, k: s[idx++] });
      steps.push({ t: 7, src: 3, k: s[idx++] });
      return steps;
    }

    _mask(b, step) {
      if (step.special) return ROTOR[OpCodes.Xor32(b[4], b[5])];
      return ROTOR[OpCodes.Xor32(b[step.src], step.k)];
    }

    _encryptBlock(block) {
      const b = block.slice();
      const steps = this._steps();
      for (const st of steps) b[st.t] = OpCodes.Xor32(b[st.t], this._mask(b, st));
      return b;
    }

    _decryptBlock(block) {
      const b = block.slice();
      const steps = this._steps();
      for (let i = steps.length - 1; i >= 0; i--) {
        const st = steps[i];
        b[st.t] = OpCodes.Xor32(b[st.t], this._mask(b, st));
      }
      return b;
    }
  }

  const algorithmInstance = new DarkCryptNewDESAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptNewDESAlgorithm, DarkCryptNewDESInstance };
}));
