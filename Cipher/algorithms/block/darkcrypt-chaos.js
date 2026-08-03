/*
 * Chaos-512/512 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Chaos-512/512 block cipher as implemented in the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project). No public
 * specification exists; this implementation follows the behavior of the
 * DarkCrypt plugin.
 *
 * Key schedule: a trivial identity copy — the 16 32-bit little-endian
 * words of the raw 512-bit key are copied verbatim into a 16-word round-
 * constant table K0..K15, with NO key-schedule mixing, expansion or
 * round-constant injection.
 *
 * The block transform operates on 16 32-bit little-endian words (a 512-bit
 * block) through a loop of 49 rounds. Each round updates exactly ONE block
 * word, functioning as a 16-word shift register / generalized Feistel
 * network:
 *   - Three word indices p, q, r advance by +1 (mod 16) every round,
 *     always three CONSECUTIVE positions (q = p+1, r = p+2, mod 16).
 *   - A fourth index (the round-constant selector) also advances by +1
 *     (mod 16) every round; every time it wraps past 15 back to 0, an
 *     accumulator "rc" (the amount K[wi] gets rotated by that round) is
 *     increased by 22. Both wi and rc start such that round 1 uses K[1]
 *     rotated left by 1 bit.
 *   - Each round computes: newWord = F(block[p], block[q], Kc, block[r])
 *     and stores it back into block[q] — i.e. only word "q" changes, while
 *     block[p] and block[r] (read-only this round) were exactly the words
 *     written by the two preceding rounds.
 *   - F chains three rounds of "y = bswap32((x + Cn) * odd(mix));
 *     mix = odd(mix ^ y ^ Cm)" across X, the rotated round constant Kc and
 *     Z, XORs the old word Y into the running value, applies one more
 *     data-dependent rotate (by the low 5 bits of the last odd-forced
 *     mixing accumulator), a fixed subtract, a fixed odd 32-bit multiply
 *     and a final bswap32.
 * Decryption runs the mirror loop backwards (indices count down, rc
 * decreases by 22 on each wrap) through the algebraic inverse of F: the
 * first three ARX/multiply/bswap steps are identical (a pure function of
 * X, Kc, Z alone), then the new word is un-bswapped, multiplied by
 * 0xA269C613 (the modular inverse of the encryption step's final multiplier
 * 0xD37AF41B mod 2^32), the fixed constant is added back, the rotate is
 * undone, and XORing with the X/Kc/Z-only intermediate recovers the
 * original word — algebraically confirmed to invert the encryption
 * primitive exactly (and validated bit-for-bit against all three DarkCrypt
 * test vectors and their round trips). 512-bit block, 512-bit key.
 * Educational only.
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

  const ROUNDS = 49;
  const C1 = 0xC4A60B29, C2 = 0xE5F8D137, C3 = 0x1DF6907A, C4 = 0x793FD1A7;
  const MUL = 0xD37AF41B, MUL_INV = 0xA269C613;

  function bswap32(x) {
    const b = OpCodes.Unpack32LE(OpCodes.ToUint32(x));
    return OpCodes.Pack32BE(b[0], b[1], b[2], b[3]);
  }

  function imul32(a, b) {
    return OpCodes.ToUint32(Math.imul(a, b));
  }

  // Shared 3-step ARX/multiply/bswap chain over (X, Kc, Z) — identical in both
  // the encryption and decryption primitives (see file header). Returns the
  // final odd-forced mixing accumulator (c3, also used as the rotate amount)
  // and the chain's output value P (XORed with the block word being
  // transformed one level up).
  function chain3(X, Kc, Z) {
    const x1 = OpCodes.Add32(X, C1);
    const k1 = OpCodes.Add32(Kc, C2);
    const z1 = OpCodes.Add32(Z, C3);
    let c = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Add32(k1, x1), z1) | 1);
    let a = imul32(x1, c);
    a = bswap32(a);
    a = OpCodes.Xor32(a, z1);
    c = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Add32(c, a), k1) | 1);
    a = imul32(a, c);
    a = bswap32(a);
    a = OpCodes.Xor32(a, k1);
    c = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Add32(c, a), x1) | 1);
    a = imul32(a, c);
    a = bswap32(a);
    return { c3: c, P: a };
  }

  function fEncrypt(X, Y, Kc, Z) {
    const { c3, P } = chain3(X, Kc, Z);
    let a = OpCodes.Xor32(P, Y);
    a = OpCodes.RotL32(a, OpCodes.And32(c3, 0x1F));
    a = OpCodes.Sub32(a, C4);
    a = imul32(a, MUL);
    a = bswap32(a);
    return a;
  }

  function fDecrypt(X, valueToInvert, Kc, Z) {
    const { c3, P } = chain3(X, Kc, Z);
    let b = bswap32(valueToInvert);
    b = imul32(b, MUL_INV);
    b = OpCodes.Add32(b, C4);
    b = OpCodes.RotR32(b, OpCodes.And32(c3, 0x1F));
    return OpCodes.Xor32(b, P);
  }

  class DarkCryptChaosAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Chaos-512/512 (DarkCrypt)";
      this.description = "Homegrown 512-bit-block ARX cipher from the DarkCrypt Total Commander plugin with no public specification: a 49-round 16-word shift-register/generalized-Feistel network where each round updates one word from its two predecessors and a rotated raw-key constant through a triple ARX/odd-multiply/byte-swap chain.";
      this.inventor = "Alexander Myasnikov (\"Zarya\" project) — DarkCrypt original design, no public specification";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(64, 64, 0)]; // fixed 512-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary design", "No public specification, cryptanalysis or design rationale exists for Chaos-512/512; the key schedule performs no mixing at all (round constants are the raw key words). Not recommended for any real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Chaos — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c2bf10da7a632b5eacd60161b6cfa7fe7ddaed84b8eabc949c041962d13e24c48b3354f9e55ce9e3a5b6fd9e9aa4012d4cc301fd3237e0e683c2513427d80d8e")
        },
        {
          text: "DarkCrypt Chaos — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("4d2487e3a4ccf9818cc1c3329cecba88bb57694b2922921f8b60226a5a89d508d67cc5327742513ff43646a4968fd1efa18fcb30d0d9002726206156d13feee1")
        },
        {
          text: "DarkCrypt Chaos — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("d687a94cb5387286445ca7e9525901c7542ac2429949d7a3e1b720ee2a1b9b22c387d6c0230f85069173993a8ef6df1b5f161fe17f0873a3d0baad24850f2451")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptChaosInstance(this, isInverse);
    }
  }

  class DarkCryptChaosInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this.inputBuffer = [];
      this.BlockSize = 64;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Chaos-512/512 (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      // setup(): identity copy of the 16 little-endian key words — see file header.
      const K = new Array(16);
      for (let i = 0; i < 16; i++)
        K[i] = OpCodes.Pack32LE(keyBytes[4 * i], keyBytes[4 * i + 1], keyBytes[4 * i + 2], keyBytes[4 * i + 3]);
      this._K = K;
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
      const K = this._K;
      const w = new Array(16);
      for (let i = 0; i < 16; i++)
        w[i] = OpCodes.Pack32LE(block[4 * i], block[4 * i + 1], block[4 * i + 2], block[4 * i + 3]);

      let esi = 15, edi = 0, ebp = 1, wi = 0, rc = 1;
      for (let round = 0; round < ROUNDS; round++) {
        esi = (esi + 1) % 16;
        edi = (edi + 1) % 16;
        ebp = (ebp + 1) % 16;
        wi = wi + 1;
        if (wi >= 16) { wi -= 16; rc = OpCodes.Add32(rc, 22); }
        const Kc = OpCodes.RotL32(K[wi], OpCodes.And32(rc, 0x1F));
        const x = w[esi], y = w[edi], z = w[ebp];
        w[edi] = fEncrypt(x, y, Kc, z);
      }

      const out = [];
      for (let i = 0; i < 16; i++) out.push(...OpCodes.Unpack32LE(w[i]));
      return out;
    }

    _decryptBlock(block) {
      const K = this._K;
      const w = new Array(16);
      for (let i = 0; i < 16; i++)
        w[i] = OpCodes.Pack32LE(block[4 * i], block[4 * i + 1], block[4 * i + 2], block[4 * i + 3]);

      let esi = 1, edi = 2, ebp = 1, wi = 0, rc = 67;
      for (let round = 0; round < ROUNDS; round++) {
        const Kc = OpCodes.RotL32(K[ebp], OpCodes.And32(rc, 0x1F));
        const xArg = w[esi], yArg = w[wi], zArg = w[edi];
        w[esi] = fDecrypt(yArg, xArg, Kc, zArg);
        wi = wi - 1; if (wi < 0) wi += 16;
        esi = esi - 1; if (esi < 0) esi += 16;
        edi = edi - 1; if (edi < 0) edi += 16;
        ebp = ebp - 1; if (ebp < 0) { ebp += 16; rc = OpCodes.Sub32(rc, 22); }
      }

      const out = [];
      for (let i = 0; i < 16; i++) out.push(...OpCodes.Unpack32LE(w[i]));
      return out;
    }
  }

  const algorithmInstance = new DarkCryptChaosAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptChaosAlgorithm, DarkCryptChaosInstance };
}));
