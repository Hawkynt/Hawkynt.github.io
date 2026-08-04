/*
 * REDOC II (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The genuine REDOC II cipher (Michael Wood, Cryptech Inc, 1985/1990) as implemented
 * in the DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 * 80-bit (10-byte) blocks, 160-bit (20-byte) keys, 10 rounds of key/data-dependent
 * permutations, substitutions and "enclave" operations, as described by Cusick and
 * Wood, "The REDOC II Cryptosystem", CRYPTO '90.
 *
 * This is a faithful implementation of the published algorithm using
 * single-byte table storage throughout. Two structural details worth noting:
 *   - the running "current row" used while building the 256-entry key table advances
 *     through keystable itself each of the 256 iterations (not a fixed row that gets
 *     repeatedly snapshotted), so keystable[i] ends up holding the state after i+1
 *     rounds of the chained key-schedule transform;
 *   - the PRNG reseed counter ("cimp") used while building the permutation/
 *     substitution/enclave tables is a single 32-bit integer (not a byte array):
 *     it starts at 32, is incremented by 1 in place on each reseed, and that same
 *     running value is threaded across all three table generators in sequence
 *     (never reset in between). The RNG itself is the classic Borland/Turbo runtime
 *     rand()/srand() (seed = seed*0x41C64E6D + 0x3039; value = (seed>>16) & 0x7FFF).
 * Test vectors verified against the DarkCrypt implementation. Educational only.
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

  const PEN = 10;   // permutation table row size / entries per row
  const SUN = 256;  // substitution table row size
  const ENN = 15;   // enclave table entry size (3 groups of 5)
  const KEN = 10;   // key table row size

  // Borland/Turbo runtime rand()/srand(): seed = seed*0x41C64E6D + 0x3039 (mod 2^32);
  // rand() returns (seed >> 16) & 0x7FFF.
  function makeRng() {
    let seed = 0;
    return {
      srand(s) { seed = OpCodes.ToUint32(s); },
      rand() { seed = OpCodes.ToUint32(Math.imul(seed, 0x41C64E6D) + 0x3039); return OpCodes.And32(OpCodes.Shr32(seed, 16), 0x7FFF); }
    };
  }

  // randy(lo,hi,arr,pos): writes a random permutation of [lo,hi] into arr starting at
  // pos (rejection sampling for uniqueness), returns the count written.
  function randy(rng, lo, hi, arr, pos) {
    const fnum = hi - lo + 1;
    let fcnt = 0, cu = pos;
    while (fcnt < fnum) {
      const v = rng.rand() % fnum + lo;
      arr[cu] = v;
      if (fcnt > 0) {
        let dup = false;
        for (let k = 0; k < fcnt; k++) if (arr[pos + k] === v) { dup = true; break; }
        if (!dup) { fcnt++; cu++; }
      } else { fcnt++; cu++; }
    }
    return fnum;
  }

  function createPermutations(rng, num, arr, pen, cimp) {
    let ccnt = 0;
    rng.srand(OpCodes.ToUint32(cimp.value));
    let pos = 0;
    for (let fi = 0; fi < num; fi++) {
      pos += randy(rng, 0, pen - 1, arr, pos);
      ccnt++;
      if (ccnt === 6) { ccnt = 0; cimp.value = OpCodes.ToUint32(cimp.value + 1); rng.srand(cimp.value); }
    }
  }
  function createSubstitutions(rng, num, arr, sun, cimp) {
    rng.srand(OpCodes.ToUint32(cimp.value));
    let pos = 0;
    for (let fi = 0; fi < num; fi++) {
      pos += randy(rng, 0, sun - 1, arr, pos);
      cimp.value = OpCodes.ToUint32(cimp.value + 1);
      rng.srand(cimp.value);
    }
  }
  function createInverseSubstitutions(num, esub, isub, sun) {
    for (let fi = 0; fi < num; fi++) {
      const off = fi * sun;
      for (let i = 0; i < sun; i++) isub[off + esub[off + i]] = i;
    }
  }
  function createEnclaveTable(rng, arr, pos) {
    let fg = true;
    while (fg) {
      let p = pos;
      for (let fi = 0; fi < 3; fi++) p += randy(rng, 0, 4, arr, p);
      fg = false;
      for (let fi = 0; fi < 5; fi++) {
        const v0 = arr[pos + fi], v1 = arr[pos + 5 + fi], v2 = arr[pos + 10 + fi];
        if (v0 === v1 || v0 === v2 || v1 === v2) fg = true;
      }
    }
  }
  function createEnclaves(rng, num, arr, cimp) {
    let ccnt = 0;
    rng.srand(OpCodes.ToUint32(cimp.value));
    let pos = 0;
    for (let fi = 0; fi < num; fi++) {
      createEnclaveTable(rng, arr, pos);
      pos += 15;
      ccnt++;
      if (ccnt === 6) { ccnt = 0; cimp.value = OpCodes.ToUint32(cimp.value + 1); rng.srand(cimp.value); }
    }
  }

  function permutate(permArr, permOff, dataArr, dataOff) {
    const ws = new Uint8Array(10);
    for (let i = 0; i < 10; i++) ws[permArr[permOff + i]] = dataArr[dataOff + i];
    for (let i = 0; i < 10; i++) dataArr[dataOff + i] = ws[i];
  }
  function inversePermutate(permArr, permOff, dataArr, dataOff) {
    const ws = new Uint8Array(10);
    for (let i = 0; i < 10; i++) ws[i] = dataArr[dataOff + permArr[permOff + i]];
    for (let i = 0; i < 10; i++) dataArr[dataOff + i] = ws[i];
  }
  function substitute(skip, subArr, subOff, dataArr, dataOff) {
    for (let i = 0; i < 10; i++) if (i !== skip) dataArr[dataOff + i] = subArr[subOff + dataArr[dataOff + i]];
  }
  function keyXor(skip, kArr, kOff, dataArr, dataOff) {
    for (let i = 0; i < 10; i++) if (i !== skip) dataArr[dataOff + i] ^= kArr[kOff + i];
  }
  function addClave(enc, encOff, data, base) {
    for (let fi = 0; fi < 5; fi++) {
      const i1 = enc[encOff + fi], i2 = enc[encOff + 5 + fi], i3 = enc[encOff + 10 + fi];
      data[base + i1] = (data[base + i1] + data[base + i2] + data[base + i3]) % 256;
    }
  }
  function subClave(enc, encOff, data, base) {
    for (let col = 4; col >= 0; col--) {
      const i1 = enc[encOff + col], i2 = enc[encOff + 5 + col], i3 = enc[encOff + 10 + col];
      let diff = (data[base + i1] - data[base + i2] - data[base + i3]) % 256;
      if (diff < 0) diff += 256;
      data[base + i1] = diff;
    }
  }
  function leftEnclave(enb, fOff, sOff, data, dataOff) {
    addClave(enb, fOff, data, dataOff);
    addClave(enb, sOff, data, dataOff);
    for (let i = 0; i < 5; i++) data[dataOff + i] ^= data[dataOff + 5 + i];
  }
  function inverseLeftEnclave(enb, fOff, sOff, data, dataOff) {
    for (let i = 0; i < 5; i++) data[dataOff + i] ^= data[dataOff + 5 + i];
    subClave(enb, sOff, data, dataOff);
    subClave(enb, fOff, data, dataOff);
  }
  function rightEnclave(enb, fOff, sOff, data, dataOff) {
    const base = dataOff + 5;
    addClave(enb, fOff, data, base);
    addClave(enb, sOff, data, base);
    for (let i = 0; i < 5; i++) data[dataOff + 5 + i] ^= data[dataOff + i];
  }
  function inverseRightEnclave(enb, fOff, sOff, data, dataOff) {
    for (let i = 0; i < 5; i++) data[dataOff + 5 + i] ^= data[dataOff + i];
    const base = dataOff + 5;
    subClave(enb, sOff, data, base);
    subClave(enb, fOff, data, base);
  }

  // keystable[fi] ends up holding the chained key-schedule state after fi+1 transform
  // rounds: the "current row" pointer advances through keystable each iteration
  // rather than a single fixed row being snapshotted.
  function createKeyTable(kx, ky, keystable, peb, sub, enb, pen, sun, enn) {
    const keyxxx = Uint8Array.from(kx);
    const cur = Uint8Array.from(ky);
    for (let fi = 0; fi <= 255; fi++) {
      const a = OpCodes.Xor32(keyxxx[0], cur[0]);
      const b = OpCodes.Xor32(keyxxx[1], cur[1]);
      const c = OpCodes.Xor32(keyxxx[2], cur[2]);
      const d = OpCodes.Xor32(keyxxx[3], cur[3]);
      const m = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(keyxxx[4], cur[4]), keyxxx[5]), cur[5]), 0xFF);
      const n = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(keyxxx[6], cur[6]), keyxxx[7]), cur[7]), 0xFF);
      const z = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(keyxxx[8], cur[8]), OpCodes.And32(keyxxx[9] + cur[9], 0xFF)), 0xFF);

      permutate(peb, n * pen, cur, 0);
      substitute(10, sub, (m % 16) * sun, cur, 0);
      leftEnclave(enb, a * enn, b * enn, cur, 0);
      rightEnclave(enb, c * enn, d * enn, cur, 0);
      permutate(peb, z * pen, keyxxx, 0);

      for (let i = 0; i < 10; i++) keystable[fi * 10 + i] = cur[i];
    }
  }

  // Folds keystable (2560 bytes) cyclically XOR'd 26 times over 100 bytes; the 26th
  // pass runs 40 bytes past the end of keystable into the first 40 bytes of the
  // enclave table (an out-of-bounds read that is deterministic given the fixed
  // table layout used here, and reproduced intentionally for compatibility).
  function createMaskTable(keystable, encltable, masktable) {
    masktable.fill(0);
    for (let i = 0; i < 2600; i++) {
      const srcByte = i < 2560 ? keystable[i] : encltable[i - 2560];
      masktable[i % 100] ^= srcByte;
    }
  }

  function enclaveWZ(round) {
    const w = ((round - 1) % 5 + 5) % 5;
    return [w, (w + 1) % 5];
  }

  function encryptBlock(dataval, keystable, masktable, permtable, esub, encl) {
    function doRound(round, skip1, skip2, mb) {
      let table = OpCodes.And32(OpCodes.Xor32(dataval[skip1], masktable[mb]), 15);
      substitute(skip1, esub, table * SUN, dataval, 0);
      table = OpCodes.And32(OpCodes.Xor32(dataval[skip2], masktable[mb + 10]), 15);
      substitute(skip2, esub, table * SUN, dataval, 0);
      table = OpCodes.Xor32(dataval[skip1], masktable[mb + 20]);
      keyXor(skip1, keystable, table * KEN, dataval, 0);
      const [w, z] = enclaveWZ(round);
      const a = OpCodes.Xor32(dataval[5 + w], masktable[mb + 30]);
      const b = OpCodes.Xor32(dataval[5 + z], masktable[mb + 40]);
      leftEnclave(encl, a * ENN, b * ENN, dataval, 0);
      const c = OpCodes.Xor32(dataval[w], masktable[mb + 50]);
      const d = OpCodes.Xor32(dataval[z], masktable[mb + 60]);
      rightEnclave(encl, c * ENN, d * ENN, dataval, 0);
      table = OpCodes.Xor32(dataval[skip2], masktable[mb + 70]);
      keyXor(skip2, keystable, table * 10, dataval, 0);
      let acc = 0;
      for (let i = 0; i < 10; i++) acc ^= dataval[i];
      acc ^= masktable[mb + 80];
      permutate(permtable, acc * PEN, dataval, 0);
    }
    for (let round = 0; round <= 8; round++) doRound(round, round, round + 1, round);
    doRound(9, 9, 0, 9);
  }

  function decryptBlock(dataval, keystable, masktable, permtable, isub, encl) {
    function doRoundDecrypt(round, skip1, skip2, mb) {
      let acc = 0;
      for (let i = 0; i < 10; i++) acc ^= dataval[i];
      acc ^= masktable[mb + 80];
      inversePermutate(permtable, acc * PEN, dataval, 0);

      let table = OpCodes.Xor32(dataval[skip2], masktable[mb + 70]);
      keyXor(skip2, keystable, table * 10, dataval, 0);

      const [w, z] = enclaveWZ(round);
      const d = OpCodes.Xor32(dataval[z], masktable[mb + 60]);
      const c = OpCodes.Xor32(dataval[w], masktable[mb + 50]);
      inverseRightEnclave(encl, c * ENN, d * ENN, dataval, 0);

      const b = OpCodes.Xor32(dataval[5 + z], masktable[mb + 40]);
      const a = OpCodes.Xor32(dataval[5 + w], masktable[mb + 30]);
      inverseLeftEnclave(encl, a * ENN, b * ENN, dataval, 0);

      table = OpCodes.Xor32(dataval[skip1], masktable[mb + 20]);
      keyXor(skip1, keystable, table * KEN, dataval, 0);

      table = OpCodes.And32(OpCodes.Xor32(dataval[skip2], masktable[mb + 10]), 15);
      substitute(skip2, isub, table * SUN, dataval, 0);

      table = OpCodes.And32(OpCodes.Xor32(dataval[skip1], masktable[mb]), 15);
      substitute(skip1, isub, table * SUN, dataval, 0);
    }
    doRoundDecrypt(9, 9, 0, 9);
    for (let round = 8; round >= 0; round--) doRoundDecrypt(round, round, round + 1, round);
  }

  function buildTables(keyBytes) {
    const kx = keyBytes.slice(0, 10);
    const ky = keyBytes.slice(10, 20);
    const permtable = new Uint8Array(2560); // [256][10]
    const esub = new Uint8Array(4096);      // [16][256]
    const isub = new Uint8Array(4096);      // [16][256]
    const encl = new Uint8Array(3840);      // [256][15]
    const keystable = new Uint8Array(2560); // [256][10]
    const masktable = new Uint8Array(100);  // [10][10]

    const rng = makeRng();
    // cimp: single running seed integer, starts at 32, threaded across all three
    // table generator calls in sequence (see file header note).
    const cimp = { value: 32 };
    createPermutations(rng, 256, permtable, PEN, cimp);
    createSubstitutions(rng, 16, esub, SUN, cimp);
    createInverseSubstitutions(16, esub, isub, SUN);
    createEnclaves(rng, 256, encl, cimp);

    createKeyTable(kx, ky, keystable, permtable, esub, encl, PEN, SUN, ENN);
    createMaskTable(keystable, encl, masktable);

    return { permtable, esub, isub, encl, keystable, masktable };
  }

  class DarkCryptREDOC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "REDOC II (DarkCrypt)";
      this.description = "The genuine REDOC II cipher (Michael Wood, 1985) as implemented in the DarkCrypt Total Commander plugin: 80-bit blocks, 160-bit keys, 10 rounds of key- and data-dependent permutations, substitutions and enclave operations.";
      this.inventor = "Michael Wood (Cryptech Inc); DarkCrypt port by Alexander Myasnikov";
      this.year = 1985;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(20, 20, 0)];   // fixed 160-bit
      this.SupportedBlockSizes = [new KeySize(10, 10, 0)]; // fixed 80-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Cusick, Wood - \"The REDOC II Cryptosystem\", CRYPTO '90", "https://link.springer.com/chapter/10.1007/3-540-38424-3_38")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Differential cryptanalysis", "Biham and Shamir demonstrated a differential attack recovering masks for reduced-round REDOC II; the full cipher is unanalyzed by modern standards.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Redoc2 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("b9b2dc11796e8df016ff")
        },
        {
          text: "DarkCrypt Redoc2 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00010203040506070809"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("7db36c42fdaf58a43778")
        },
        {
          text: "DarkCrypt Redoc2 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("10111213141516171819"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f1011121314"),
          expected: OpCodes.Hex8ToBytes("66a4676a026633d2842d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptREDOC2Instance(this, isInverse);
    }
  }

  class DarkCryptREDOC2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 10;
      this.KeySize = 0;
      this._tables = null;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._tables = null; return; }
      if (keyBytes.length !== 20)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. REDOC II (DarkCrypt) requires exactly 20 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._tables = buildTables(Uint8Array.from(this._key));
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
      const t = this._tables;
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = Uint8Array.from(this.inputBuffer.slice(i, i + this.BlockSize));
        if (this.isInverse) decryptBlock(block, t.keystable, t.masktable, t.permtable, t.isub, t.encl);
        else encryptBlock(block, t.keystable, t.masktable, t.permtable, t.esub, t.encl);
        for (let _i = 0; _i < block.length; _i++) output.push(block[_i]);
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptREDOC2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptREDOC2Algorithm, DarkCryptREDOC2Instance };
}));
