/*
 * 3NewDE (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * "3NewDE" from the DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya"
 * project). No public specification exists; this implementation follows the behavior
 * of the DarkCrypt plugin. The cipher declares a 192-bit key, but only the first 16
 * key bytes actually feed the key schedule, and within those, only the HIGH nibble of
 * each byte is used -- the low nibble is discarded during key expansion, leaving 64 bits
 * (16 nibbles) of real key material. The remaining 8 declared key bytes have no effect
 * on the ciphertext.
 *
 * Core transform: a single DES round structure (standard S-boxes/E-expansion/P-permutation)
 * applied for 16 rounds WITHOUT the DES initial/final permutation (IP/FP) -- this
 * is the "New DES" referred to in the name (some literature uses "NewDES" for Robert
 * Scott's unrelated cipher, and separately for "DES without IP/FP"; DarkCrypt's "3NewDE"
 * is the latter). "3" in the name reflects the plugin's general 3-key-schedule-slot design,
 * though for this cipher only one 64-bit-equivalent effective key survives per the above.
 * Decryption reuses the same round-key schedule in reverse round order (standard Feistel
 * network inversion).
 *
 * 64-bit blocks, 192-bit declared key (only first 16 bytes' high nibbles are effective).
 * Educational only; unofficial construction, not independently analyzed.
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

  // Classic DES SPtrans tables (S-box substitution combined with the P-permutation);
  // these match the standard DES tables. Indexed by a direct 6-bit value (no byte-mask trick).
  const T0 = [
    0x01010400,0x00000000,0x00010000,0x01010404,0x01010004,0x00010404,0x00000004,0x00010000,
    0x00000400,0x01010400,0x01010404,0x00000400,0x01000404,0x01010004,0x01000000,0x00000004,
    0x00000404,0x01000400,0x01000400,0x00010400,0x00010400,0x01010000,0x01010000,0x01000404,
    0x00010004,0x01000004,0x01000004,0x00010004,0x00000000,0x00000404,0x00010404,0x01000000,
    0x00010000,0x01010404,0x00000004,0x01010000,0x01010400,0x01000000,0x01000000,0x00000400,
    0x01010004,0x00010000,0x00010400,0x01000004,0x00000400,0x00000004,0x01000404,0x00010404,
    0x01010404,0x00010004,0x01010000,0x01000404,0x01000004,0x00000404,0x00010404,0x01010400,
    0x00000404,0x01000400,0x01000400,0x00000000,0x00010004,0x00010400,0x00000000,0x01010004
  ];
  const T1 = [
    0x80108020,0x80008000,0x00008000,0x00108020,0x00100000,0x00000020,0x80100020,0x80008020,
    0x80000020,0x80108020,0x80108000,0x80000000,0x80008000,0x00100000,0x00000020,0x80100020,
    0x00108000,0x00100020,0x80008020,0x00000000,0x80000000,0x00008000,0x00108020,0x80100000,
    0x00100020,0x80000020,0x00000000,0x00108000,0x00008020,0x80108000,0x80100000,0x00008020,
    0x00000000,0x00108020,0x80100020,0x00100000,0x80008020,0x80100000,0x80108000,0x00008000,
    0x80100000,0x80008000,0x00000020,0x80108020,0x00108020,0x00000020,0x00008000,0x80000000,
    0x00008020,0x80108000,0x00100000,0x80000020,0x00100020,0x80008020,0x80000020,0x00100020,
    0x00108000,0x00000000,0x80008000,0x00008020,0x80000000,0x80100020,0x80108020,0x00108000
  ];
  const T2 = [
    0x00000208,0x08020200,0x00000000,0x08020008,0x08000200,0x00000000,0x00020208,0x08000200,
    0x00020008,0x08000008,0x08000008,0x00020000,0x08020208,0x00020008,0x08020000,0x00000208,
    0x08000000,0x00000008,0x08020200,0x00000200,0x00020200,0x08020000,0x08020008,0x00020208,
    0x08000208,0x00020200,0x00020000,0x08000208,0x00000008,0x08020208,0x00000200,0x08000000,
    0x08020200,0x08000000,0x00020008,0x00000208,0x00020000,0x08020200,0x08000200,0x00000000,
    0x00000200,0x00020008,0x08020208,0x08000200,0x08000008,0x00000200,0x00000000,0x08020008,
    0x08000208,0x00020000,0x08000000,0x08020208,0x00000008,0x00020208,0x00020200,0x08000008,
    0x08020000,0x08000208,0x00000208,0x08020000,0x00020208,0x00000008,0x08020008,0x00020200
  ];
  const T3 = [
    0x00802001,0x00002081,0x00002081,0x00000080,0x00802080,0x00800081,0x00800001,0x00002001,
    0x00000000,0x00802000,0x00802000,0x00802081,0x00000081,0x00000000,0x00800080,0x00800001,
    0x00000001,0x00002000,0x00800000,0x00802001,0x00000080,0x00800000,0x00002001,0x00002080,
    0x00800081,0x00000001,0x00002080,0x00800080,0x00002000,0x00802080,0x00802081,0x00000081,
    0x00800080,0x00800001,0x00802000,0x00802081,0x00000081,0x00000000,0x00000000,0x00802000,
    0x00002080,0x00800080,0x00800081,0x00000001,0x00802001,0x00002081,0x00002081,0x00000080,
    0x00802081,0x00000081,0x00000001,0x00002000,0x00800001,0x00002001,0x00802080,0x00800081,
    0x00002001,0x00002080,0x00800000,0x00802001,0x00000080,0x00800000,0x00002000,0x00802080
  ];
  const T4 = [
    0x00000100,0x02080100,0x02080000,0x42000100,0x00080000,0x00000100,0x40000000,0x02080000,
    0x40080100,0x00080000,0x02000100,0x40080100,0x42000100,0x42080000,0x00080100,0x40000000,
    0x02000000,0x40080000,0x40080000,0x00000000,0x40000100,0x42080100,0x42080100,0x02000100,
    0x42080000,0x40000100,0x00000000,0x42000000,0x02080100,0x02000000,0x42000000,0x00080100,
    0x00080000,0x42000100,0x00000100,0x02000000,0x40000000,0x02080000,0x42000100,0x40080100,
    0x02000100,0x40000000,0x42080000,0x02080100,0x40080100,0x00000100,0x02000000,0x42080000,
    0x42080100,0x00080100,0x42000000,0x42080100,0x02080000,0x00000000,0x40080000,0x42000000,
    0x00080100,0x02000100,0x40000100,0x00080000,0x00000000,0x40080000,0x02080100,0x40000100
  ];
  const T5 = [
    0x20000010,0x20400000,0x00004000,0x20404010,0x20400000,0x00000010,0x20404010,0x00400000,
    0x20004000,0x00404010,0x00400000,0x20000010,0x00400010,0x20004000,0x20000000,0x00004010,
    0x00000000,0x00400010,0x20004010,0x00004000,0x00404000,0x20004010,0x00000010,0x20400010,
    0x20400010,0x00000000,0x00404010,0x20404000,0x00004010,0x00404000,0x20404000,0x20000000,
    0x20004000,0x00000010,0x20400010,0x00404000,0x20404010,0x00400000,0x00004010,0x20000010,
    0x00400000,0x20004000,0x20000000,0x00004010,0x20000010,0x20404010,0x00404000,0x20400000,
    0x00404010,0x20404000,0x00000000,0x20400010,0x00000010,0x00004000,0x20400000,0x00404010,
    0x00004000,0x00400010,0x20004010,0x00000000,0x20404000,0x20000000,0x00400010,0x20004010
  ];
  const T6 = [
    0x00200000,0x04200002,0x04000802,0x00000000,0x00000800,0x04000802,0x00200802,0x04200800,
    0x04200802,0x00200000,0x00000000,0x04000002,0x00000002,0x04000000,0x04200002,0x00000802,
    0x04000800,0x00200802,0x00200002,0x04000800,0x04000002,0x04200000,0x04200800,0x00200002,
    0x04200000,0x00000800,0x00000802,0x04200802,0x00200800,0x00000002,0x04000000,0x00200800,
    0x04000000,0x00200800,0x00200000,0x04000802,0x04000802,0x04200002,0x04200002,0x00000002,
    0x00200002,0x04000000,0x04000800,0x00200000,0x04200800,0x00000802,0x00200802,0x04200800,
    0x00000802,0x04000002,0x04200802,0x04200000,0x00200800,0x00000000,0x00000002,0x04200802,
    0x00000000,0x00200802,0x04200000,0x00000800,0x04000002,0x04000800,0x00000800,0x00200002
  ];
  const T7 = [
    0x10001040,0x00001000,0x00040000,0x10041040,0x10000000,0x10001040,0x00000040,0x10000000,
    0x00040040,0x10040000,0x10041040,0x00041000,0x10041000,0x00041040,0x00001000,0x00000040,
    0x10040000,0x10000040,0x10001000,0x00001040,0x00041000,0x00040040,0x10040040,0x10041000,
    0x00001040,0x00000000,0x00000000,0x10040040,0x10000040,0x10001000,0x00041040,0x00040000,
    0x00041040,0x00040000,0x10041000,0x00001000,0x00000040,0x10040040,0x00001000,0x00041040,
    0x10001000,0x00000040,0x10000040,0x10040000,0x10040040,0x10000000,0x00040000,0x10001040,
    0x00000000,0x10041040,0x00040040,0x10000040,0x10040000,0x10001000,0x10001040,0x00000000,
    0x10041040,0x00041000,0x00041000,0x00001040,0x00001040,0x00040040,0x10000000,0x10041000
  ];

  class DarkCrypt3NewDEAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "3NewDE (DarkCrypt)";
      this.description = "DarkCrypt Total Commander plugin cipher: 16 rounds of the standard DES Feistel round function (real DES S-boxes/E/P) without the DES initial/final permutation. Declared 192-bit key but only the high nibble of each of the first 16 key bytes (64 bits) is effective; the remaining declared key material has no effect on the output. 64-bit block. As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Alexander Myasnikov (DarkCrypt/\"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(24, 24, 0)];  // declared 192-bit (only first 16 bytes' high nibbles are effective)
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("DES (base round function/S-boxes)", "https://csrc.nist.gov/csrc/media/publications/fips/46/3/archive/1999-10-25/documents/fips46-3.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Reduced effective key", "The declared 192-bit key collapses to 64 bits of real entropy (only 16 nibbles are used); the round function additionally omits DES's IP/FP.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt 3newde — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("1c2087fcbbea0dc2")
        },
        {
          text: "DarkCrypt 3newde — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("fe73f3967b3a7d6f")
        },
        {
          text: "DarkCrypt 3newde — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718"),
          expected: OpCodes.Hex8ToBytes("b7361e976d0f6e00")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCrypt3NewDEInstance(this, isInverse);
    }
  }

  class DarkCrypt3NewDEInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 24)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. 3NewDE (DarkCrypt) requires exactly 24 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = this._buildRoundKeys(this._key);
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

    // Only the HIGH nibble of each of the first 16 key bytes is effective (see file header).
    _buildRoundKeys(keyBytes) {
      const N = new Array(16);
      for (let i = 0; i < 16; i++) N[i] = OpCodes.And32(OpCodes.Shr32(keyBytes[i], 4), 0xF);

      const idx = (base, r) => N[OpCodes.And32(base + r, 0xF)];
      const roundKeys = [];
      for (let r = 0; r < 16; r++) {
        const g1 = OpCodes.And32(OpCodes.Shl32(idx(13, r), 2) | OpCodes.Shr32(N[r], 2), 0x3F);
        const g2 = OpCodes.And32(OpCodes.Shl32(idx(6, r), 2) | OpCodes.Shr32(idx(11, r), 2), 0x3F);
        const g3 = OpCodes.And32(OpCodes.Shl32(idx(10, r), 2) | OpCodes.Shr32(idx(3, r), 2), 0x3F);
        const g4 = OpCodes.And32(OpCodes.Shl32(idx(1, r), 2) | OpCodes.Shr32(idx(8, r), 2), 0x3F);
        const dword0 = OpCodes.ToUint32(g1 | OpCodes.Shl32(g2, 8) | OpCodes.Shl32(g3, 16) | OpCodes.Shl32(g4, 24));

        const g5 = OpCodes.And32(OpCodes.Shl32(OpCodes.And32(N[r], 0x3), 4) | idx(9, r), 0x3F);
        const g6 = OpCodes.And32(OpCodes.Shl32(OpCodes.And32(idx(11, r), 0x3), 4) | idx(2, r), 0x3F);
        const g7 = OpCodes.And32(OpCodes.Shl32(OpCodes.And32(idx(3, r), 0x3), 4) | idx(14, r), 0x3F);
        const g8 = OpCodes.And32(OpCodes.Shl32(OpCodes.And32(idx(8, r), 0x3), 4) | idx(5, r), 0x3F);
        const dword1 = OpCodes.ToUint32(g5 | OpCodes.Shl32(g6, 8) | OpCodes.Shl32(g7, 16) | OpCodes.Shl32(g8, 24));

        roundKeys.push(dword0, dword1);
      }
      return roundKeys;
    }

    // f(R,k0,k1): classic DES E-expansion+S-box+P-permutation via the ROR(R,4) trick.
    _feistelF(R, k0, k1) {
      const a = OpCodes.Xor32(OpCodes.RotR32(R, 4), k0);
      const b = OpCodes.Xor32(R, k1);
      let r = 0;
      r |= T6[OpCodes.And32(a, 0x3F)];
      r |= T4[OpCodes.And32(OpCodes.Shr32(a, 8), 0x3F)];
      r |= T2[OpCodes.And32(OpCodes.Shr32(a, 16), 0x3F)];
      r |= T0[OpCodes.And32(OpCodes.Shr32(a, 24), 0x3F)];
      r |= T7[OpCodes.And32(b, 0x3F)];
      r |= T5[OpCodes.And32(OpCodes.Shr32(b, 8), 0x3F)];
      r |= T3[OpCodes.And32(OpCodes.Shr32(b, 16), 0x3F)];
      r |= T1[OpCodes.And32(OpCodes.Shr32(b, 24), 0x3F)];
      return OpCodes.ToUint32(r);
    }

    // DES-style Feistel core, WITHOUT IP/FP (initial/final rotate-by-1 replaces the
    // standard IP/FP interaction with the ROR(R,4) round-function trick).
    _core(L, R, roundKeys) {
      L = OpCodes.RotL32(L, 1);
      R = OpCodes.RotL32(R, 1);
      for (let i = 0; i < 8; i++) {
        const f1 = this._feistelF(R, roundKeys[4 * i], roundKeys[4 * i + 1]);
        L = OpCodes.Xor32(L, f1);
        const f2 = this._feistelF(L, roundKeys[4 * i + 2], roundKeys[4 * i + 3]);
        R = OpCodes.Xor32(R, f2);
      }
      return [OpCodes.RotR32(R, 1), OpCodes.RotR32(L, 1)];
    }

    _encryptBlock(block) {
      let L = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let R = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      const [outL, outR] = this._core(L, R, this._roundKeys);
      return [...OpCodes.Unpack32BE(outL), ...OpCodes.Unpack32BE(outR)];
    }

    _decryptBlock(block) {
      let L = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let R = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      const reversed = [];
      for (let r = 15; r >= 0; r--) reversed.push(this._roundKeys[2 * r], this._roundKeys[2 * r + 1]);
      const [outL, outR] = this._core(L, R, reversed);
      return [...OpCodes.Unpack32BE(outL), ...OpCodes.Unpack32BE(outR)];
    }
  }

  const algorithmInstance = new DarkCrypt3NewDEAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCrypt3NewDEAlgorithm, DarkCrypt3NewDEInstance };
}));
