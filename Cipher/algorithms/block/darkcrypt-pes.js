/*
 * PES (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PES ("Proposed Encryption Standard", Xuejia Lai and James Massey, 1990) as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). PES is the direct historical predecessor of IDEA: the
 * same Lai-Massey structure operating on four 16-bit sub-blocks with
 * multiplication modulo 2^16+1, addition modulo 2^16 and XOR, but with a
 * simpler round-key derivation than IDEA's — every subkey is taken directly
 * from a single 55-word bit-rotating expansion of the 128-bit key (the same
 * 9/7-bit-split recurrence IDEA itself later reused), with no per-round
 * variation in which mixing operation a given key word feeds. 8 full rounds
 * plus a final half-round output transformation (9 rounds total, mirroring
 * IDEA's 8.5). 128-bit key, 64-bit block. Educational only.
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

  const MOD = 0x10001; // 2^16 + 1
  const ROUNDS = 8;

  // Multiplication modulo 2^16+1, where 0 represents 2^16 (IDEA/PES special case).
  function mulMod(a, b) {
    a = OpCodes.ToUint16(a);
    b = OpCodes.ToUint16(b);
    if (a === 0) return OpCodes.ToUint16(MOD - b);
    if (b === 0) return OpCodes.ToUint16(MOD - a);
    const p = a * b;
    return OpCodes.ToUint16(p % MOD);
  }

  // Multiplicative inverse modulo 2^16+1 (extended Euclid).
  function mulInv(x) {
    x = OpCodes.ToUint16(x);
    const kk = (x === 0) ? 65536 : x;
    let t = 0, newt = 1, r = MOD, newr = kk;
    while (newr !== 0) {
      const q = Math.floor(r / newr);
      const t2 = t - q * newt; t = newt; newt = t2;
      const r2 = r - q * newr; r = newr; newr = r2;
    }
    let inv = ((t % MOD) + MOD) % MOD;
    return inv === 65536 ? 0 : inv;
  }

  function invMul(v, k) { return mulMod(v, mulInv(k)); }

  // Additive inverse modulo 2^16.
  function addInv(x) { return OpCodes.ToUint16(0x10000 - OpCodes.ToUint16(x)); }

  // Bit-rotating 55-word key expansion (same recurrence family later reused
  // by IDEA): the 8 little-endian 16-bit words of the 128-bit key seed the
  // schedule, and each subsequent word is derived by a 9/7-bit split of
  // earlier words (equivalent to rotating a 128-bit register left by 25 bits
  // and re-slicing it into 16-bit windows).
  function expandKey(keyBytes) {
    const w = new Array(55);
    for (let i = 0; i < 8; i++) w[i] = OpCodes.Pack16LE(keyBytes[i * 2], keyBytes[i * 2 + 1]);
    for (let i = 8; i < 55; i++) {
      const phase = i % 8;
      let v;
      if (phase === 6) v = OpCodes.Xor32(OpCodes.Shl32(w[i-7], 9), OpCodes.Shr32(w[i-14], 7));
      else if (phase === 7) v = OpCodes.Xor32(OpCodes.Shl32(w[i-15], 9), OpCodes.Shr32(w[i-14], 7));
      else v = OpCodes.Shl32(w[i-7], 9) - OpCodes.Shr32(w[i-6], 7);
      w[i] = OpCodes.ToUint16(v);
    }
    return w;
  }

  // Round-key tables Ka..Kf for rounds 1..9 (1-based), sourced directly from
  // consecutive groups of 6 expanded words with no further transformation.
  function buildTables(w) {
    const Ka = [0], Kb = [0], Kc = [0], Ke = [0], Kd = [0], Kf = [0];
    for (let r = 1; r <= 9; r++) {
      const base = (r - 1) * 6;
      Ka[r] = w[base]; Kb[r] = w[base+1]; Kc[r] = w[base+2];
      Ke[r] = w[base+3]; Kd[r] = w[base+4]; Kf[r] = w[base+5];
    }
    return { Ka, Kb, Kc, Ke, Kd, Kf };
  }

  class DarkCryptPESAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "PES (DarkCrypt)";
      this.description = "PES (Proposed Encryption Standard, Lai/Massey 1990), the direct historical predecessor of IDEA, as implemented in the DarkCrypt Total Commander plugin. Same Lai-Massey structure and multiplication-mod-65537 arithmetic as IDEA over four 16-bit sub-blocks, but with a simpler bit-rotating round-key derivation lacking IDEA's stronger key mixing. 8 full rounds plus a final half-round.";
      this.inventor = "Xuejia Lai, James L. Massey";
      this.year = 1990;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)]; // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("IDEA (successor to PES)", "https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak key schedule", "PES's simpler round-key derivation (relative to its IDEA successor) was shown to be cryptanalytically weak, which is precisely why IDEA replaced it.", "Use IDEA, AES, or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Pes — incrementing key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("e8f608b37a36627a")
        },
        {
          text: "DarkCrypt Pes — incrementing key, incrementing plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("722ddbe59d2ad932")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPESInstance(this, isInverse);
    }
  }

  class DarkCryptPESInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._T = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._T = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. PES (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._T = buildTables(expandKey(keyBytes));
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
      const T = this._T;
      let X1 = OpCodes.Pack16LE(block[0], block[1]);
      let X2 = OpCodes.Pack16LE(block[2], block[3]);
      let X3 = OpCodes.Pack16LE(block[4], block[5]);
      let X4 = OpCodes.Pack16LE(block[6], block[7]);

      for (let r = 1; r <= ROUNDS; r++) {
        const A = mulMod(X1, T.Ka[r]);
        const B = mulMod(X2, T.Kb[r]);
        const X3p = OpCodes.ToUint16(X3 + T.Kc[r]);
        const X4p = OpCodes.ToUint16(X4 + T.Ke[r]);
        const C = mulMod(OpCodes.Xor32(A, X3p), T.Kd[r]);
        const D = OpCodes.ToUint16(OpCodes.Xor32(B, X4p) + C);
        const E = mulMod(D, T.Kf[r]);
        const F = OpCodes.ToUint16(C + E);

        X1 = OpCodes.Xor32(E, X3p);
        X2 = OpCodes.Xor32(F, X4p);
        X3 = OpCodes.Xor32(A, E);
        X4 = OpCodes.Xor32(B, F);
      }

      const Y1 = mulMod(X1, T.Ka[9]);
      const Y2 = mulMod(X2, T.Kb[9]);
      const Y3 = OpCodes.ToUint16(X3 + T.Kc[9]);
      const Y4 = OpCodes.ToUint16(X4 + T.Ke[9]);

      return [
        ...OpCodes.Unpack16LE(Y1), ...OpCodes.Unpack16LE(Y2),
        ...OpCodes.Unpack16LE(Y3), ...OpCodes.Unpack16LE(Y4)
      ];
    }

    _decryptBlock(block) {
      const T = this._T;
      let X1 = OpCodes.Pack16LE(block[0], block[1]);
      let X2 = OpCodes.Pack16LE(block[2], block[3]);
      let X3 = OpCodes.Pack16LE(block[4], block[5]);
      let X4 = OpCodes.Pack16LE(block[6], block[7]);

      X1 = invMul(X1, T.Ka[9]);
      X2 = invMul(X2, T.Kb[9]);
      X3 = OpCodes.ToUint16(X3 - T.Kc[9]);
      X4 = OpCodes.ToUint16(X4 - T.Ke[9]);

      for (let r = ROUNDS; r >= 1; r--) {
        const G = X3, H = X1;
        const C = mulMod(OpCodes.Xor32(G, H), T.Kd[r]);
        const D = OpCodes.ToUint16(OpCodes.Xor32(X4, X2) + C);
        const E = mulMod(D, T.Kf[r]);
        const F = OpCodes.ToUint16(C + E);

        const X4p = OpCodes.Xor32(F, X2);
        const X4n = OpCodes.ToUint16(X4p - T.Ke[r]);
        const B = OpCodes.Xor32(X4, F);
        const X2n = invMul(B, T.Kb[r]);
        const A = OpCodes.Xor32(G, E);
        const X3p = OpCodes.Xor32(H, E);
        const X3n = OpCodes.ToUint16(X3p - T.Kc[r]);
        const X1n = invMul(A, T.Ka[r]);

        X1 = X1n; X2 = X2n; X3 = X3n; X4 = X4n;
      }

      return [
        ...OpCodes.Unpack16LE(X1), ...OpCodes.Unpack16LE(X2),
        ...OpCodes.Unpack16LE(X3), ...OpCodes.Unpack16LE(X4)
      ];
    }
  }

  const algorithmInstance = new DarkCryptPESAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPESAlgorithm, DarkCryptPESInstance };
}));
