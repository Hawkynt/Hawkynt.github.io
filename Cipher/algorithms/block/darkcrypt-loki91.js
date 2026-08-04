/*
 * LOKI'91-512 (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LOKI'91 (Brown, Pieprzyk, Seberry, 1991) as implemented in the DarkCrypt
 * Total Commander plugin (Alexander Myasnikov, "Zarya" project): a 64-bit
 * Feistel cipher with 16 rounds. The round function f(R,K) = P(S(E(R XOR K)))
 * is standard textbook LOKI'91 (12-bit-to-8-bit S-boxes built from GF(2^8)
 * exponentiation x^31 mod Gen(row), and a fixed 32-bit bit permutation) —
 * confirmed bit-exact against the DarkCrypt implementation's S-box
 * generator/exponent table and P-permutation table.
 *
 * The only deviation from the standard 64-bit-key LOKI'91 is the key
 * schedule: standard LOKI'91 derives 16 round subkeys from a single 64-bit
 * key via repeated 12.5-byte rotation. This implementation instead accepts
 * a 512-bit (64-byte) key and uses it AS the 16 round subkeys directly —
 * one raw 32-bit key word per round, in key order for encryption and
 * reverse order for decryption — with no rotation/schedule step at all.
 *
 * The DarkCrypt implementation exposes a 128-bit (16-byte) block interface,
 * but the underlying cipher primitive is only 64-bit: crypt()/decrypt()
 * transform bytes 0-7 of the caller's buffer and leave bytes 8-15 completely
 * untouched. This port reproduces that exact pass-through behavior for both
 * directions.
 *
 * Test vectors verified against the DarkCrypt implementation, including
 * encrypt/decrypt round-trip. 512-bit key, 128-bit external block (64-bit
 * real block + 64-bit pass-through). Educational only.
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

  // Standard LOKI'91 S-box parameters: 16 rows, each an irreducible-polynomial-like
  // GF(2^8) modulus (Gen) and a fixed exponent (Exp=31), matching the DarkCrypt
  // implementation's S-box generator/exponent table.
  const GEN = [0x177, 0x17b, 0x187, 0x18b, 0x18d, 0x19f, 0x1a3, 0x1a9,
               0x1b1, 0x1bd, 0x1c3, 0x1cf, 0x1d7, 0x1dd, 0x1e7, 0x1f3];
  const EXP = [31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31];

  // Standard LOKI'91 32-bit P-permutation table (output bit (31-i) = input bit P_TABLE[i]),
  // matching the DarkCrypt implementation's permutation table.
  const P_TABLE = [31, 23, 15, 7, 30, 22, 14, 6, 29, 21, 13, 5, 28, 20, 12, 4,
                   27, 19, 11, 3, 26, 18, 10, 2, 25, 17, 9, 1, 24, 16, 8, 0];

  // GF(2^8) multiply modulo the given generator polynomial (Russian-peasant algorithm).
  function gfMultiply(a, b, gen) {
    let result = 0;
    a = OpCodes.And32(a, 0xFFFF);
    b = OpCodes.And32(b, 0xFFFF);
    while (b !== 0) {
      if (OpCodes.And32(b, 1)) result ^= a;
      a = OpCodes.And32(OpCodes.Shl32(a, 1), 0xFFFF);
      if (OpCodes.And32(a, 0x100)) a ^= gen;
      b = OpCodes.Shr32(b, 1);
    }
    return OpCodes.And32(result, 0xFFFF);
  }

  // GF(2^8) modular exponentiation via square-and-multiply.
  function gfPow(base, exp, gen) {
    if (base === 0) return 0;
    let result = 1;
    let b = OpCodes.And32(base, 0xFFFF);
    let e = exp;
    while (e !== 0) {
      if (OpCodes.And32(e, 1)) result = gfMultiply(result, b, gen);
      b = gfMultiply(b, b, gen);
      e = OpCodes.Shr32(e, 1);
    }
    return OpCodes.And32(result, 0xFF);
  }

  // LOKI'91 S-box: 12-bit input -> row (4 bits from input[11,10,1,0]) selects the
  // GF(2^8) modulus/exponent; column = ((input>>2)&0xFF) - 17*row - 1 (mod 256);
  // output = column^Exp(row) mod Gen(row) in GF(2^8).
  function sBox(x) {
    const row = OpCodes.And32(OpCodes.Or32(OpCodes.And32(OpCodes.Shr32(x, 8), 0xC), OpCodes.And32(x, 3)), 0xF);
    const col8 = OpCodes.And32(OpCodes.Shr32(x, 2), 0xFF);
    const adj = OpCodes.And32(~(row * 17), 0xFF);
    const col = OpCodes.And32(col8 + adj, 0xFF);
    return gfPow(col, EXP[row], GEN[row]);
  }

  function permuteP(x) {
    let out = 0;
    for (let i = 0; i < 32; i++) {
      const bit = OpCodes.And32(OpCodes.Shr32(x, P_TABLE[i]), 1);
      if (bit) out = OpCodes.ToUint32(out | OpCodes.Shr32(0x80000000, i));
    }
    return out;
  }

  // LOKI'91 round function: f(R,K) = P(S(E(R XOR K))), with the standard overlapping
  // 12-bit E-expansion (bits [0-11], [8-19], [16-27], and the wrap-around [24-31,0-3]).
  function roundF(R, K) {
    const t = OpCodes.XorN(R, K);
    const e0 = OpCodes.And32(t, 0xFFF);
    const e1 = OpCodes.And32(OpCodes.Shr32(t, 8), 0xFFF);
    const e2 = OpCodes.And32(OpCodes.Shr32(t, 16), 0xFFF);
    const e3 = OpCodes.And32(OpCodes.RotL32(t, 8), 0xFFF);
    const s = OpCodes.ToUint32(sBox(e0) | OpCodes.Shl32(sBox(e1), 8) | OpCodes.Shl32(sBox(e2), 16) | OpCodes.Shl32(sBox(e3), 24));
    return permuteP(s);
  }

  class DarkCryptLOKI91Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "LOKI'91-512 (DarkCrypt)";
      this.description = "LOKI'91 variant from the DarkCrypt Total Commander plugin: standard 16-round Feistel network with the textbook LOKI'91 S-P round function, extended to a 512-bit (64-byte) key used directly as the 16 round subkeys (no key-rotation schedule). The external interface is 128 bits; only the first 8 bytes are transformed, the last 8 pass through unchanged.";
      this.inventor = "Lawrie Brown, Josef Pieprzyk, Jennifer Seberry; DarkCrypt variant by Alexander Myasnikov";
      this.year = 1991;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit external interface (64-bit real + 64-bit pass-through)

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("LOKI91 Specification", "https://www.unsw.adfa.edu.au/~lpb/papers/loki91.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard key schedule and block truncation", "The 512-bit key is used directly as 16 round subkeys with no rotation schedule, and only the first 8 of 16 declared block bytes are actually transformed (the remaining 8 pass through unchanged, unauthenticated). Unanalyzed variant, not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Loki91 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("bd84a2085ef609c70000000000000000")
        },
        {
          text: "DarkCrypt Loki91 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("ec14f4dd6d1c49bc08090a0b0c0d0e0f")
        },
        {
          text: "DarkCrypt Loki91 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("8a8ae6452c77f35b18191a1b1c1d1e1f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLOKI91Instance(this, isInverse);
    }
  }

  class DarkCryptLOKI91Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. LOKI'91-512 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      // The 512-bit key is used directly as 16 raw 32-bit round subkeys (native byte order),
      // one word per round -- no key-rotation schedule (unlike standard 64-bit-key LOKI'91).
      this.roundKeys = new Array(ROUNDS);
      for (let i = 0; i < ROUNDS; i++) {
        this.roundKeys[i] = OpCodes.Pack32LE(
          this._key[4 * i], this._key[4 * i + 1], this._key[4 * i + 2], this._key[4 * i + 3]
        );
      }
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

    // Only bytes 0-7 are transformed by the real 64-bit LOKI'91 Feistel cipher;
    // bytes 8-15 pass through unchanged. Data words are big-endian internally.
    _encryptBlock(block) {
      let X = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let Y = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      for (let i = 0; i < ROUNDS; i += 2) {
        X = OpCodes.XorN(X, roundF(Y, this.roundKeys[i]));
        Y = OpCodes.XorN(Y, roundF(X, this.roundKeys[i + 1]));
      }

      return [...OpCodes.Unpack32BE(Y), ...OpCodes.Unpack32BE(X), ...block.slice(8, 16)];
    }

    _decryptBlock(block) {
      let X = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let Y = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      for (let i = ROUNDS - 1; i > 0; i -= 2) {
        X = OpCodes.XorN(X, roundF(Y, this.roundKeys[i]));
        Y = OpCodes.XorN(Y, roundF(X, this.roundKeys[i - 1]));
      }

      return [...OpCodes.Unpack32BE(Y), ...OpCodes.Unpack32BE(X), ...block.slice(8, 16)];
    }
  }

  const algorithmInstance = new DarkCryptLOKI91Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLOKI91Algorithm, DarkCryptLOKI91Instance };
}));
