/*
 * Snappy (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * "Snappy" is an obscure, undocumented block cipher bundled with the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project); no public specification
 * exists.
 *
 * Structure (64-bit block, 128-bit key, 16 rounds):
 *   The 16 key bytes are used directly (no expansion). For each round r = 0..15, each
 *   byte position i = 0..7 of the block is updated in place, left to right, as
 *   block[i] ^= F(block, key, r, i), where F folds every OTHER byte j != i of the
 *   (partially updated) block through a single 256-byte S-box, driven by two small
 *   fixed permutation tables:
 *     ah = SBOX[r*8 + i]
 *     for j = 0..7, j != i:
 *       idx = ((TABLE2[j] << 1) ^ TABLE2[i] ^ TABLE3[r]) & 0x0F
 *       ah  = SBOX[ block[j] ^ ah ^ key[idx] ]
 *     return ah
 *   Because block[i] is updated immediately (not buffered), later byte positions in the
 *   same round see the already-updated values of earlier positions -- an intentional
 *   avalanche/self-modifying design. Decryption is the exact structural inverse: replay
 *   rounds r = 15..0, and byte positions i = 7..0 within each round (also XOR, so no
 *   table inversion is needed -- only the traversal order is reversed).
 *
 * S-box (256 bytes) and both permutation tables (TABLE2: 8 bytes, TABLE3: 16 bytes)
 * are fixed constants of the cipher. As implemented in the DarkCrypt Total Commander
 * plugin.
 *
 * 64-bit blocks, 128-bit keys. Undocumented/obscure cipher, educational only.
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

  const ROUNDS = 16;
  const BLOCK_BYTES = 8;

  // Fixed 256-byte substitution box.
  const SBOX = [
    0x89, 0x56, 0xb3, 0x44, 0x5d, 0x69, 0x13, 0xc0, 0x61, 0x1e, 0xed, 0xa6, 0xcb, 0x36, 0xa2, 0x1b,
    0xe0, 0xd5, 0xba, 0xbe, 0x55, 0xfc, 0x4e, 0xcd, 0xee, 0x07, 0x9e, 0x5a, 0xdc, 0xc9, 0xfe, 0x3c,
    0x1c, 0x77, 0x85, 0x0b, 0x57, 0x70, 0xd4, 0xa1, 0xa9, 0x2d, 0xa3, 0x40, 0x42, 0x79, 0x91, 0x86,
    0x20, 0x3a, 0xca, 0xeb, 0x82, 0x94, 0x1d, 0x16, 0xb8, 0x27, 0x6a, 0xd9, 0x5b, 0x96, 0xc6, 0x21,
    0xec, 0x8d, 0x9b, 0xe6, 0x18, 0x81, 0xda, 0x92, 0x5c, 0x26, 0xc2, 0x47, 0xe5, 0x41, 0x4b, 0xaa,
    0xf6, 0xff, 0xb0, 0x29, 0x0f, 0x19, 0x66, 0xd2, 0x76, 0xbb, 0x93, 0xc8, 0xf8, 0x99, 0x39, 0x14,
    0x7e, 0xbf, 0x7a, 0xf9, 0x97, 0xc7, 0x80, 0xa0, 0x7f, 0x9f, 0x2c, 0xd6, 0x78, 0xae, 0xc4, 0x48,
    0x43, 0xb2, 0xc3, 0x23, 0x6e, 0xfb, 0x83, 0x71, 0x3b, 0xb1, 0xe8, 0x34, 0x8c, 0xb5, 0x24, 0xac,
    0xf7, 0x09, 0x8f, 0x67, 0x50, 0x4c, 0xf1, 0xe3, 0x72, 0x7d, 0x7c, 0x90, 0x1f, 0xf3, 0x15, 0x0e,
    0x64, 0xd1, 0x5f, 0xde, 0xd3, 0x45, 0xce, 0xdf, 0xf5, 0x62, 0x95, 0xa7, 0xf0, 0xf4, 0x30, 0x6d,
    0x22, 0x3f, 0x65, 0xd8, 0x2b, 0x4a, 0xab, 0x6b, 0xb4, 0x52, 0x88, 0x3d, 0x2a, 0xd0, 0x74, 0x0d,
    0x59, 0xef, 0xc5, 0xbc, 0xb9, 0xf2, 0x12, 0xfa, 0x4f, 0x17, 0x38, 0x37, 0x84, 0x2e, 0x51, 0x8e,
    0x7b, 0x6f, 0x01, 0xb7, 0x9d, 0xe4, 0x3e, 0xea, 0xcf, 0x2f, 0xa4, 0x0c, 0x63, 0x06, 0xfd, 0xe9,
    0x46, 0xad, 0x75, 0xa5, 0x05, 0x9a, 0x25, 0x03, 0x28, 0xd7, 0x54, 0x68, 0xcc, 0xc1, 0x04, 0x49,
    0x32, 0x58, 0x00, 0xa8, 0x31, 0x73, 0x9c, 0x53, 0xb6, 0x98, 0x08, 0x02, 0x8b, 0x1a, 0xdb, 0x8a,
    0x10, 0x5e, 0x11, 0x35, 0x6c, 0xe1, 0x0a, 0xe2, 0xdd, 0x33, 0x60, 0xe7, 0x4d, 0xbd, 0xaf, 0x87
  ];

  // Fixed byte-position permutation (8 entries).
  const TABLE2 = [0x00, 0x03, 0x02, 0x05, 0x04, 0x07, 0x06, 0x01];

  // Fixed round permutation (16 entries).
  const TABLE3 = [0x00, 0x03, 0x0a, 0x05, 0x04, 0x07, 0x0e, 0x09, 0x08, 0x0b, 0x02, 0x0d, 0x0c, 0x0f, 0x06, 0x01];

  // Computes the byte XORed into block[i] during round r; reads every other byte of block.
  function mix(block, key, r, i) {
    let ah = SBOX[r * 8 + i];
    for (let j = 0; j < BLOCK_BYTES; j++) {
      if (j === i) continue;
      const idx = OpCodes.And8(OpCodes.Xor8(OpCodes.Shl8(TABLE2[j], 1), OpCodes.Xor8(TABLE2[i], TABLE3[r])), 0x0F);
      ah = SBOX[OpCodes.Xor8(OpCodes.Xor8(block[j], ah), key[idx])];
    }
    return ah;
  }

  class DarkCryptSnappyAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Snappy (DarkCrypt)";
      this.description = "Undocumented 64-bit block cipher from the DarkCrypt Total Commander plugin: 16 rounds of an in-place, byte-at-a-time S-box mixing network where each byte position is XORed with a value folded from all other (partially updated) bytes of the block. No public specification is known.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / \"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented/unanalyzed design", "No public cryptanalysis exists for this cipher.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Snappy — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("e81e19d19331b4cd")
        },
        {
          text: "DarkCrypt Snappy — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("c214d81749ead2d4")
        },
        {
          text: "DarkCrypt Snappy — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("31632512e2b31965")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSnappyInstance(this, isInverse);
    }
  }

  class DarkCryptSnappyInstance extends IBlockCipherInstance {
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
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Snappy (DarkCrypt) requires exactly 16 bytes`);
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
      const b = [...block];
      const key = this._key;
      for (let r = 0; r < ROUNDS; r++)
        for (let i = 0; i < BLOCK_BYTES; i++)
          b[i] = OpCodes.Xor8(b[i], mix(b, key, r, i));
      return b;
    }

    _decryptBlock(block) {
      const b = [...block];
      const key = this._key;
      for (let r = ROUNDS - 1; r >= 0; r--)
        for (let i = BLOCK_BYTES - 1; i >= 0; i--)
          b[i] = OpCodes.Xor8(b[i], mix(b, key, r, i));
      return b;
    }
  }

  const algorithmInstance = new DarkCryptSnappyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSnappyAlgorithm, DarkCryptSnappyInstance };
}));
