/*
 * Cartman-2X (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Cartman-2X is a block cipher shipped as a block-plugin of the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project). It uses a 1024-bit
 * (128-byte) key and a 128-bit (16-byte) block. No public specification exists;
 * this implementation follows the behavior of the DarkCrypt plugin. Test
 * vectors verified against the DarkCrypt implementation (crypt/decrypt
 * round-trip verified).
 *
 * Structure (all 32-bit little-endian words):
 *   - The 128-byte key is split into two 64-byte halves. The first half derives
 *     a set of small key-dependent index/rotation tables and seeds a keystream
 *     generator (the cipher itself run in OFB mode over a fixed bootstrap
 *     S-box) that produces 64 key-dependent 256-byte derangement S-boxes.
 *   - The second half derives the small tables actually used for encryption.
 *   - The round function operates on four 32-bit words for 8 outer x 8 inner
 *     iterations. Each iteration: permute the four words by bytes of their XOR,
 *     apply four byte-wise S-box substitutions, mix with two XTEA-like ARX
 *     stages (shifts 6/9 and 4/5) whose rotations and key words are selected by
 *     the small tables, then swap the two 64-bit halves.
 *
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ---- primitive helpers ----------------------------------------------------
  const U = x => OpCodes.ToUint32(x);
  const rol32 = (v, n) => OpCodes.RotL32(v, n);
  const ror32 = (v, n) => OpCodes.RotR32(v, n);
  const rol8 = (v, n) => OpCodes.RotL8(v, n);
  const ror8 = (v, n) => OpCodes.RotR8(v, n);
  const f69 = x => OpCodes.Add32(OpCodes.Xor32(OpCodes.Shl32(x, 6), OpCodes.Shr32(x, 9)), x);
  const g45 = x => OpCodes.Add32(OpCodes.Xor32(OpCodes.Shl32(x, 4), OpCodes.Shr32(x, 5)), x);
  const g59 = x => OpCodes.Add32(OpCodes.Xor32(OpCodes.Shl32(x, 5), OpCodes.Shr32(x, 9)), x);
  const mulmod32 = (a, b) => Number(OpCodes.AndN(BigInt(OpCodes.ToUint32(a)) * BigInt(OpCodes.ToUint32(b)), 0xFFFFFFFFn));

  // Static bootstrap S-box bank used only during key setup to seed the
  // key-dependent S-box generator; never used directly for data.
  const BOOT_B64 = "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";

  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function base64ToBytes(str) {
    const lut = new Int16Array(256).fill(-1);
    for (let i = 0; i < B64.length; i++) lut[B64.charCodeAt(i)] = i;
    let len = str.length;
    while (len > 0 && str[len - 1] === '=') len--;
    const outLen = OpCodes.Shr32(len * 3, 2);
    const out = new Uint8Array(outLen);
    let acc = 0, bits = 0, oi = 0;
    for (let i = 0; i < len; i++) {
      const v = lut[str.charCodeAt(i)];
      if (v < 0) continue;
      acc = OpCodes.Shl32(acc, 6) | v;
      bits += 6;
      if (bits >= 8) { bits -= 8; out[oi++] = OpCodes.And32(OpCodes.Shr32(acc, bits), 0xFF); }
    }
    return out;
  }
  const BOOT = base64ToBytes(BOOT_B64);

  const COL = [0x000, 0x900, 0x100, 0x800];

  // Build the small key-dependent tables from a 64-byte key half.
  function buildTables(K8) {
    const K = new Array(16);
    for (let i = 0; i < 16; i++)
      K[i] = OpCodes.Pack32LE(K8[i * 4], K8[i * 4 + 1], K8[i * 4 + 2], K8[i * 4 + 3]);

    const t = {
      A: new Array(8), B: new Array(8), C: new Array(8), D: new Array(8),
      E: new Array(16), AA: new Array(7), AB: new Array(7),
      B18: new Array(8), B38: new Array(8),
      B58: new Array(64), C58: new Array(64),
      g0: 0, g1: 0, g2: 0
    };
    for (let i = 0; i < 8; i++) { t.B18[i] = K[i]; t.B38[i] = K[i + 8]; }

    let g0 = 0, g1 = 0, g2 = 0;
    for (let i = 0; i < 8; i++) {
      t.A[i] = ror32(g45(K[i]), (i % 31) + 1) % 7;
      g0 = OpCodes.Add32(OpCodes.Shr32(mulmod32(g0 + 1, g0), 1), K[i]);
    }
    for (let i = 8; i < 16; i++) {
      t.B[15 - i] = rol32(g45(K[i]), (i % 31) + 1) % 7;
      g1 = OpCodes.Add32(OpCodes.Shr32(mulmod32(g1 + 1, g1), 1), K[i]);
    }
    for (let i = 0; i < 16; i++) {
      t.E[i] = (rol32(OpCodes.Xor32(K[i], i + 1), ((15 - i) % 31) + 1) % 31) + 1;
      g2 = U(g2 + mulmod32(K[i], i + 1));
    }
    t.g0 = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(g0, 16), g0), 7);
    t.g1 = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(g1, 16), g1), 7);
    t.g2 = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(g2, 16), g2), 7);

    for (let i = 0; i < 7; i++) {
      t.AA[i] = (t.B38[7 - i] % 31) + 1;
      t.AB[i] = (t.B18[7 - i] % 31) + 1;
    }
    for (let i = 0; i < 8; i++)
      t.C[i] = rol32(g59(K[i]), (i % 31) + 1) % 7;
    for (let i = 8; i < 16; i++)
      t.D[15 - i] = ror32(g59(K[i]), (i % 31) + 1) % 7;

    for (let esi = 0; esi < 64; esi++) {
      const outer = (esi / 8) | 0, inner = esi % 8;
      const p = rol8(K8[esi], (outer % 7) + 1);
      const q = ror8(K8[esi], (inner % 7) + 1);
      t.B58[esi] = (p * (q + 1) + esi) % 7;
    }
    let acc = 0;
    for (let outer = 0; outer < 8; outer++) {
      for (let inner = 0; inner < 8; inner++) {
        const esi = outer * 8 + inner;
        acc = OpCodes.Add32(OpCodes.Add32(rol8(K8[esi], (esi % 7) + 1), OpCodes.Xor32(OpCodes.Shl32(acc, outer), OpCodes.Shr32(acc, inner))), esi);
        t.C58[inner * 8 + outer] = acc % 7;
      }
    }
    return t;
  }

  // Encrypt four 32-bit words in place using tables t and forward S-box bank SB.
  function cryptWords(X, t, SB) {
    for (let outer = 0; outer < 8; outer++) {
      const A0 = t.A[outer], B0 = t.B[outer], C0 = t.C[outer], D0 = t.D[outer];
      for (let inner = 0; inner < 8; inner++) {
        const sel = t.B58[outer * 8 + inner], e = t.C58[outer * 8 + inner];
        const a = (A0 + inner) % 7, b = (B0 + inner) % 7, c = (C0 + inner) % 7, d = (D0 + inner) % 7;

        let tt = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X[0], X[1]), X[2]), X[3]);
        for (let i = 0; i < 4; i++) {
          const j = OpCodes.And32(OpCodes.Shr32(tt, 8 * i), 3);
          const tmp = X[i]; X[i] = X[j]; X[j] = tmp;
        }

        const base = sel * 0x800 + e * 0x100;
        for (let w = 0; w < 4; w++) {
          const off = base + COL[w], v = X[w];
          X[w] = OpCodes.ToUint32(SB[off + OpCodes.And32(v, 0xFF)]
                | OpCodes.Shl32(SB[off + OpCodes.And32(OpCodes.Shr32(v, 8), 0xFF)], 8)
                | OpCodes.Shl32(SB[off + OpCodes.And32(OpCodes.Shr32(v, 16), 0xFF)], 16)
                | OpCodes.Shl32(SB[off + OpCodes.And32(OpCodes.Shr32(v, 24), 0xFF)], 24));
        }

        const s0 = t.B18[a], s1 = t.B18[a + 1], u0 = t.B38[b], u1 = t.B38[b + 1];
        const r0 = t.E[a + b], r1 = t.E[a + b + 1], rc = t.AA[c], rd = t.AB[d];

        if (a === t.g0) X[0] = U(X[0] + U(s0 + U(ror32(f69(X[1]), r0) + X[3])));
        else            X[0] = U(X[0] + U(ror32(U(f69(X[1]) + s0), r0) + X[3]));

        if (b === t.g1) X[1] = U(X[1] + U(s1 + U(ror32(f69(X[0]), r1) + X[2])));
        else            X[1] = U(X[1] + U(ror32(U(f69(X[0]) + s1), r1) + X[2]));

        const c2 = rol32(U(U(g45(X[0]) + u0) * 8), rc);
        const c3 = rol32(U(U(g45(X[1]) + u1) * 8), rd);
        if (inner === t.g2) { X[2] = U(X[2] + c2); X[3] = U(X[3] + c3); }
        else                { X[2] = OpCodes.Xor32(X[2], c2); X[3] = OpCodes.Xor32(X[3], c3); }

        const x0 = X[0], x1 = X[1]; X[0] = X[2]; X[1] = X[3]; X[2] = x0; X[3] = x1;
      }
    }
  }

  // Decrypt four 32-bit words in place using tables t and inverse S-box bank IV.
  function decryptWords(X, t, IV) {
    for (let outer = 7; outer >= 0; outer--) {
      const A0 = t.A[outer], B0 = t.B[outer], C0 = t.C[outer], D0 = t.D[outer];
      for (let inner = 7; inner >= 0; inner--) {
        const sel = t.B58[outer * 8 + inner], e = t.C58[outer * 8 + inner];
        const a = (A0 + inner) % 7, b = (B0 + inner) % 7, c = (C0 + inner) % 7, d = (D0 + inner) % 7;
        const s0 = t.B18[a], s1 = t.B18[a + 1], u0 = t.B38[b], u1 = t.B38[b + 1];
        const r0 = t.E[a + b], r1 = t.E[a + b + 1], rc = t.AA[c], rd = t.AB[d];

        let x0 = X[0], x1 = X[1]; X[0] = X[2]; X[1] = X[3]; X[2] = x0; X[3] = x1;

        const c2 = rol32(U(U(g45(X[0]) + u0) * 8), rc);
        const c3 = rol32(U(U(g45(X[1]) + u1) * 8), rd);
        if (inner === t.g2) { X[2] = U(X[2] - c2); X[3] = U(X[3] - c3); }
        else                { X[2] = OpCodes.Xor32(X[2], c2); X[3] = OpCodes.Xor32(X[3], c3); }

        if (b === t.g1) X[1] = U(X[1] - U(s1 + U(ror32(f69(X[0]), r1) + X[2])));
        else            X[1] = U(X[1] - U(ror32(U(f69(X[0]) + s1), r1) + X[2]));

        if (a === t.g0) X[0] = U(X[0] - U(s0 + U(ror32(f69(X[1]), r0) + X[3])));
        else            X[0] = U(X[0] - U(ror32(U(f69(X[1]) + s0), r0) + X[3]));

        const base = sel * 0x800 + e * 0x100;
        for (let w = 0; w < 4; w++) {
          const off = base + COL[w], v = X[w];
          X[w] = OpCodes.ToUint32(IV[off + OpCodes.And32(v, 0xFF)]
                | OpCodes.Shl32(IV[off + OpCodes.And32(OpCodes.Shr32(v, 8), 0xFF)], 8)
                | OpCodes.Shl32(IV[off + OpCodes.And32(OpCodes.Shr32(v, 16), 0xFF)], 16)
                | OpCodes.Shl32(IV[off + OpCodes.And32(OpCodes.Shr32(v, 24), 0xFF)], 24));
        }

        let tt = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(X[0], X[1]), X[2]), X[3]);
        for (let i = 3; i >= 0; i--) {
          const j = OpCodes.And32(OpCodes.Shr32(tt, 8 * i), 3);
          const tmp = X[i]; X[i] = X[j]; X[j] = tmp;
        }
      }
    }
  }

  // Generate the 64 key-dependent derangement S-boxes from the first key half.
  function buildSboxes(K8first, tFirst) {
    const state = new Uint8Array(16).fill(0xFF);
    for (let esi = 0; esi < 64; esi++) {
      const p = rol8(K8first[esi], (esi % 7) + 1);
      const edi = OpCodes.And32(esi, 0xF);
      state[edi] = OpCodes.And32(OpCodes.Xor32(p, state[edi]) + 3 * esi, 0xFF);
    }
    function cryptState() {
      const X = [
        OpCodes.Pack32LE(state[0], state[1], state[2], state[3]),
        OpCodes.Pack32LE(state[4], state[5], state[6], state[7]),
        OpCodes.Pack32LE(state[8], state[9], state[10], state[11]),
        OpCodes.Pack32LE(state[12], state[13], state[14], state[15])
      ];
      cryptWords(X, tFirst, BOOT);
      for (let i = 0; i < 4; i++) {
        const b = OpCodes.Unpack32LE(X[i]);
        state[i * 4] = b[0]; state[i * 4 + 1] = b[1]; state[i * 4 + 2] = b[2]; state[i * 4 + 3] = b[3];
      }
    }
    cryptState();
    let avail = 0;
    function getByte() {
      if (avail === 0) { cryptState(); avail = 16; }
      const b = state[16 - avail];
      avail--;
      return b;
    }
    const fwd = new Uint8Array(0x4000);
    const inv = new Uint8Array(0x4000);
    for (let sel = 0; sel < 8; sel++) {
      for (let e = 0; e < 8; e++) {
        const base = sel * 0x800 + e * 0x100;
        const used = new Uint8Array(256);
        let esi = 0;
        while (esi < 256) {
          const bl = getByte();
          if (used[bl]) continue;
          if (esi === bl) {
            if (esi !== 255) continue;
            esi = 0; used.fill(0); continue;
          }
          used[bl] = 1;
          fwd[base + esi] = bl;
          inv[base + bl] = esi;
          esi++;
        }
      }
    }
    return { fwd, inv };
  }

  function expandKey(keyBytes) {
    const k1 = keyBytes.slice(0, 64), k2 = keyBytes.slice(64, 128);
    const tFirst = buildTables(k1);
    const boxes = buildSboxes(k1, tFirst);
    const t = buildTables(k2);
    return { t, fwd: boxes.fwd, inv: boxes.inv };
  }

  class DarkCryptCartman2XAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Cartman-2X (DarkCrypt)";
      this.description = "Block cipher from the DarkCrypt Total Commander plugin. 1024-bit key, 128-bit block. The key seeds 64 key-dependent derangement S-boxes (generated by running the cipher in OFB mode over a fixed bootstrap S-box) plus small index/rotation tables driving an 8x8-iteration substitution/ARX round function.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / Zarya project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(128, 128, 0)];  // fixed 1024-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard / unanalyzed", "Proprietary construction with key-dependent S-boxes; never subjected to public cryptanalysis. Not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Cartman2x - zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("43cf861e141491ee0baf5f0a7f9838e1")
        },
        {
          text: "DarkCrypt Cartman2x - incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f"),
          expected: OpCodes.Hex8ToBytes("95924004119c03a401ccf3bc3fb66a6a")
        },
        {
          text: "DarkCrypt Cartman2x - shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f80"),
          expected: OpCodes.Hex8ToBytes("07d2ff9135ad9a8520b4a6ba580a90ae")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptCartman2XInstance(this, isInverse);
    }
  }

  class DarkCryptCartman2XInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._ctx = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._ctx = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 128)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Cartman-2X (DarkCrypt) requires exactly 128 bytes`);
      this._ctx = expandKey(keyBytes);
      this.KeySize = keyBytes.length;
    }

    get key() { return this._ctx ? true : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._ctx) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._ctx) throw new Error("Key not set");
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
      const X = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
      cryptWords(X, this._ctx.t, this._ctx.fwd);
      return [...OpCodes.Unpack32LE(X[0]), ...OpCodes.Unpack32LE(X[1]),
              ...OpCodes.Unpack32LE(X[2]), ...OpCodes.Unpack32LE(X[3])];
    }

    _decryptBlock(block) {
      const X = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
      decryptWords(X, this._ctx.t, this._ctx.inv);
      return [...OpCodes.Unpack32LE(X[0]), ...OpCodes.Unpack32LE(X[1]),
              ...OpCodes.Unpack32LE(X[2]), ...OpCodes.Unpack32LE(X[3])];
    }
  }

  const algorithmInstance = new DarkCryptCartman2XAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptCartman2XAlgorithm, DarkCryptCartman2XInstance };
}));
