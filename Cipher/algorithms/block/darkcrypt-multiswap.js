/*
 * Multiswap (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MultiSwap is the block cipher/MAC Microsoft built for Windows Media DRM (also used
 * to protect Microsoft Reader ".lit" e-books). It was publicly documented in 2001 by
 * an anonymous researcher under the pseudonym "Beale Screamer" and later cryptanalyzed
 * by Borisov, Chew, Johnson and Wagner ("Multiplicative Differentials", FSE 2002), who
 * broke it with a multiplicative differential attack (about 2^14 chosen plaintexts).
 *
 * The core primitive processes a 64-bit block as two 32-bit halves x0,x1 chained
 * through a running state (s0,s1) normally initialized to zero:
 *   f(v, k0..k5) = ((((( (v*k0) swap16 )*k1) swap16 )*k2) swap16 )*k3) swap16 )*k4 + k5
 *   s0' = f(x0+s0, k0..k5);  s1' = s1 + s0'
 *   s0'' = f(x1+s0', k6..k11); s1'' = s1' + s0''
 *   ciphertext = (s0'', s1'')
 * (swap16 exchanges the upper/lower 16-bit halves of a 32-bit word; all arithmetic is
 * mod 2^32.) Keys k0..k4 and k6..k10 must be odd so the multiplications are invertible;
 * k5 and k11 are unconstrained additive constants.
 *
 * The DarkCrypt Total Commander plugin wraps this primitive with a fixed 448-bit
 * (56-byte) key: the first 48 bytes hold the 12 subkey words k0..k11 (least-significant
 * bit forced to 1 for the 10 multiplicative subkeys via a plain OR, matching the original
 * DRM key-derivation behavior of forcing odd subkeys), and the final 8 bytes supply the
 * initial chaining state (s0,s1) instead of the zero IV used by the textbook MAC
 * construction -- this turns the MultiSwap MAC primitive into a standalone single-block
 * cipher. decrypt is the exact mathematical inverse (multiplicative inverses of the odd
 * subkeys mod 2^32), matching the DarkCrypt implementation's own decrypt() byte-for-byte.
 *
 * 64-bit blocks, 448-bit keys. Broken/educational only -- do not use for security.
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

  // Multiplicative inverse of an odd 32-bit number modulo 2^32 (extended Euclid, exact via BigInt).
  function modInverse32(a) {
    let oldR = BigInt(OpCodes.ToUint32(a));
    let r = OpCodes.ShiftLn(1n, 32);
    let oldS = 1n, s = 0n;
    while (r !== 0n) {
      const q = oldR / r;
      [oldR, r] = [r, oldR - q * r];
      [oldS, s] = [s, oldS - q * s];
    }
    const m = OpCodes.ShiftLn(1n, 32);
    return Number(((oldS % m) + m) % m);
  }

  function swap16(x) { return OpCodes.RotL32(x, 16); }

  // f(v) = swap(swap(swap(swap(v*k0)*k1)*k2)*k3)*k4 + k5  (4 swaps, 5 multiplies, mod 2^32)
  function forwardStage(v, k0, k1, k2, k3, k4, k5) {
    let t = OpCodes.ToUint32(v);
    t = OpCodes.Mul32(t, k0); t = swap16(t);
    t = OpCodes.Mul32(t, k1); t = swap16(t);
    t = OpCodes.Mul32(t, k2); t = swap16(t);
    t = OpCodes.Mul32(t, k3); t = swap16(t);
    t = OpCodes.Mul32(t, k4);
    t = OpCodes.ToUint32(t + k5);
    return t;
  }

  // Mathematical inverse of forwardStage: subtract k5, undo the 5 multiply/swap steps in reverse.
  function inverseStage(r, ik0, ik1, ik2, ik3, ik4, k5) {
    let t = OpCodes.ToUint32(r - k5);
    t = OpCodes.Mul32(t, ik4); t = swap16(t);
    t = OpCodes.Mul32(t, ik3); t = swap16(t);
    t = OpCodes.Mul32(t, ik2); t = swap16(t);
    t = OpCodes.Mul32(t, ik1); t = swap16(t);
    t = OpCodes.Mul32(t, ik0);
    return t;
  }

  class DarkCryptMultiswapAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Multiswap (DarkCrypt)";
      this.description = "Microsoft's MultiSwap block cipher/MAC (from Windows Media DRM / MS Reader .lit DRM), as wrapped into a standalone 64-bit block cipher by the DarkCrypt Total Commander plugin: the 56-byte key supplies 12 odd multiplicative subkeys plus a non-zero initial chaining state.";
      this.inventor = "Microsoft (documented/named by 'Beale Screamer'); DarkCrypt wrapper by Alexander Myasnikov";
      this.year = 1999;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(56, 56, 0)];  // fixed 448-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("MultiSwap (Wikipedia)", "https://en.wikipedia.org/wiki/MultiSwap"),
        new LinkItem("Cryptanalysis of MultiSwap (Borisov, Chew, Johnson, Wagner)", "https://web.archive.org/web/20011031200331/http://www.cs.berkeley.edu:80/~rtjohnso/multiswap/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Multiplicative differential cryptanalysis", "Broken with about 2^14 chosen plaintexts or 2^22.5 known plaintexts (Borisov et al., FSE 2002).", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Ms — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0200000003000000")
        },
        {
          text: "DarkCrypt Ms — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f3031323334353637"),
          expected: OpCodes.Hex8ToBytes("d0ad5c3a7eb8411c")
        },
        {
          text: "DarkCrypt Ms — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738"),
          expected: OpCodes.Hex8ToBytes("3a20b566b726024c")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMultiswapInstance(this, isInverse);
    }
  }

  class DarkCryptMultiswapInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._sched = null; return; }
      if (keyBytes.length !== 56)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Multiswap (DarkCrypt) requires exactly 56 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._sched = this._buildSchedule(this._key);
    }

    get key() { return this._key ? [...this._key] : null; }

    _buildSchedule(key) {
      const w = [];
      for (let i = 0; i < 14; i++)
        w.push(OpCodes.Pack32LE(key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]));

      const k = [];
      for (let i = 0; i < 12; i++) k.push(OpCodes.ToUint32(w[i] | 1));

      const s0 = w[12], s1 = w[13];

      // Only the 10 multiplicative subkeys (k0..k4, k6..k10) need inverses; k5/k11 are additive.
      const ik = new Array(12);
      for (const i of [0, 1, 2, 3, 4, 6, 7, 8, 9, 10]) ik[i] = modInverse32(k[i]);

      return { k, ik, s0, s1 };
    }

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
      const { k, s0, s1 } = this._sched;
      const x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);

      const s0p = forwardStage(OpCodes.ToUint32(x0 + s0), k[0], k[1], k[2], k[3], k[4], k[5]);
      const s1p = OpCodes.ToUint32(s1 + s0p);
      const c0 = forwardStage(OpCodes.ToUint32(x1 + s0p), k[6], k[7], k[8], k[9], k[10], k[11]);
      const c1 = OpCodes.ToUint32(s1p + c0);

      return [...OpCodes.Unpack32LE(c0), ...OpCodes.Unpack32LE(c1)];
    }

    _decryptBlock(block) {
      const { k, ik, s0, s1 } = this._sched;
      const c0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      const c1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);

      const s1p = OpCodes.ToUint32(c1 - c0);
      const u = inverseStage(c0, ik[6], ik[7], ik[8], ik[9], ik[10], k[11]); // = x1 + s0p
      const s0p = OpCodes.ToUint32(s1p - s1);
      const x1 = OpCodes.ToUint32(u - s0p);

      const v = inverseStage(s0p, ik[0], ik[1], ik[2], ik[3], ik[4], k[5]); // = x0 + s0
      const x0 = OpCodes.ToUint32(v - s0);

      return [...OpCodes.Unpack32LE(x0), ...OpCodes.Unpack32LE(x1)];
    }
  }

  const algorithmInstance = new DarkCryptMultiswapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMultiswapAlgorithm, DarkCryptMultiswapInstance };
}));
