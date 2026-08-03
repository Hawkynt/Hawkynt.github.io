/*
 * Lja1 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Lja1" block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project).
 *   - 128-bit block (16 bytes), 2048-bit key (256 bytes).
 *   - The 256-byte key is loaded verbatim as a byte substitution table S (S[i]=key[i]).
 *   - 16 cycles. Each cycle rewrites all 16 block bytes in order (index m = 0..15).
 *     For byte m an 8-bit accumulator A is folded over the OTHER 15 bytes in
 *     rotational order (m+1 .. m+15 mod 16):
 *         A = 0; for e in (m+1 .. m+15): A = S[(A + S[b[e mod 16]]) mod 256]
 *     then  b[m] ^= (A ^ (C mod 256))   with C a running counter = 16*cycle + m.
 * The whole cipher is byte-oriented; there is no endianness or word packing.
 * Because the per-byte update is a pure XOR, decryption uses the same primitive
 * run in reverse order (cycle 15..0, byte 15..0), recomputing A from the current
 * state — the accumulator never reads the byte it is about to change.
 * Test vectors verified against the DarkCrypt implementation, including
 * encrypt/decrypt round-trip. Educational only.
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

  const CYCLES = 16;
  const BLOCK_BYTES = 16;
  const KEY_BYTES = 256;

  class DarkCryptLja1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Lja1 (DarkCrypt)";
      this.description = "Byte-oriented block cipher from the DarkCrypt Total Commander plugin. The 256-byte key becomes a substitution table; 16 cycles rewrite each of the 16 block bytes by folding a nonlinear accumulator over the other 15 bytes and XORing in a running counter. 128-bit block, 2048-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / Zarya)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_BYTES, KEY_BYTES, 0)];   // fixed 2048-bit
      this.SupportedBlockSizes = [new KeySize(BLOCK_BYTES, BLOCK_BYTES, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard hobbyist design", "Unanalyzed proprietary construction with a purely XOR-based per-byte update; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Lja1 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00".repeat(KEY_BYTES)),
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "DarkCrypt Lja1 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          expected: OpCodes.Hex8ToBytes("ee0fd0b112737435b65778b9da8bb469")
        },
        {
          text: "DarkCrypt Lja1 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff00"),
          expected: OpCodes.Hex8ToBytes("fe5fc0c1e243048546e748c95ab38067")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLja1Instance(this, isInverse);
    }
  }

  class DarkCryptLja1Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._sbox = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._sbox = null; this.KeySize = 0; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Lja1 (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      // setup() copies the key verbatim into a 256-byte substitution table.
      this._sbox = keyBytes.slice(0, KEY_BYTES);
      this.KeySize = keyBytes.length;
    }

    get key() { return this._sbox ? this._sbox.slice() : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._sbox) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._sbox) throw new Error("Key not set");
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

    // 8-bit accumulator folded over the 15 bytes other than index m,
    // in rotational order (m+1 .. m+15 mod 16). Never reads b[m].
    _accumulate(b, m) {
      const S = this._sbox;
      let a = 0;
      for (let k = 1; k <= 15; k++) {
        a = S[OpCodes.And32(a + S[b[OpCodes.And32(m + k, 15)]], 0xFF)];
      }
      return a;
    }

    _encryptBlock(block) {
      const b = block.slice();
      let c = 0;
      for (let cycle = 0; cycle < CYCLES; cycle++) {
        for (let m = 0; m < BLOCK_BYTES; m++) {
          const a = this._accumulate(b, m);
          b[m] = OpCodes.And32(OpCodes.Xor32(b[m], OpCodes.Xor32(a, OpCodes.And32(c, 0xFF))), 0xFF);
          c++;
        }
      }
      return b;
    }

    _decryptBlock(block) {
      const b = block.slice();
      // Reverse the cycle/byte order; the counter for (cycle,m) is 16*cycle+m.
      for (let cycle = CYCLES - 1; cycle >= 0; cycle--) {
        for (let m = BLOCK_BYTES - 1; m >= 0; m--) {
          const c = OpCodes.And32(CYCLES * cycle + m, 0xFF);
          const a = this._accumulate(b, m);
          b[m] = OpCodes.And32(OpCodes.Xor32(b[m], OpCodes.Xor32(a, c)), 0xFF);
        }
      }
      return b;
    }
  }

  const algorithmInstance = new DarkCryptLja1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLja1Algorithm, DarkCryptLja1Instance };
}));
