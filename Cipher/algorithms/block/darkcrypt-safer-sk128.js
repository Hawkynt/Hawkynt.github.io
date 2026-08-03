/*
 * SAFER SK-128 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SAFER SK-128 (Strengthened Key schedule, James Massey 1993, key schedule
 * strengthened per Lars Knudsen's 1995 proposal) as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 * 64-bit block, 128-bit key, 8 rounds (this build uses 8, the SK-64
 * recommendation, rather than the SK-128-standard 10).
 * Uses the classic SAFER exponential/logarithm S-boxes over GF(257) (base 45)
 * and Pseudo-Hadamard Transform diffusion, identical round function to
 * SAFER K-64/K-128; only the key schedule differs (adds a parity byte per
 * key half and cyclically offsets which rotated key byte feeds each round
 * subkey position, per J.L. Massey's "Strengthened Key Schedule" announcement).
 * Test vectors verified against the DarkCrypt implementation.
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

  const BLOCK_LEN = 8;
  const ROUNDS = 8;
  const TAB_LEN = 256;

  // GF(257) exponential/logarithm tables, primitive element 45
  const EXP_TAB = new Array(TAB_LEN);
  const LOG_TAB = new Array(TAB_LEN);
  (function initTables() {
    let exp = 1;
    for (let i = 0; i < TAB_LEN; i++) {
      EXP_TAB[i] = OpCodes.And32(exp, 0xFF);
      LOG_TAB[EXP_TAB[i]] = i;
      exp = (exp * 45) % 257;
    }
  })();

  class DarkCryptSaferSK128Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SAFER-SK128 (DarkCrypt)";
      this.description = "SAFER SK-128 block cipher (James Massey, strengthened key schedule by Lars Knudsen). 64-bit block, 128-bit key. This DarkCrypt build uses 8 rounds (the SK-64 recommendation) rather than the SK-128-standard 10.";
      this.inventor = "James Massey (SAFER); strengthened key schedule by Lars Knudsen";
      this.year = 1995;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SAFER (Wikipedia)", "https://en.wikipedia.org/wiki/SAFER"),
        new LinkItem("Announcement of a Strengthened Key Schedule for the Cipher SAFER (J.L. Massey)", "https://www.researchgate.net/publication/2334323")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Small block size", "64-bit block size is vulnerable to birthday-bound attacks on large volumes of data.", "Avoid encrypting large amounts of data with a single key.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Safer128 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("62c4803deb82506d")
        },
        {
          text: "DarkCrypt Safer128 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("f9820c2fd85d91b6")
        },
        {
          text: "DarkCrypt Safer128 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("4334e11aac2fdd2c")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSaferSK128Instance(this, isInverse);
    }
  }

  class DarkCryptSaferSK128Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.expandedKey = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_LEN;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.expandedKey = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SAFER-SK128 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.expandedKey = this._expandKey(this._key);
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

    // Strengthened (SK) key schedule per J.L. Massey / Lars Knudsen:
    // each key half gets a parity ("checksum") byte at index BLOCK_LEN, and
    // the rotated key byte feeding a given round-subkey position cycles with
    // the round index (offsets 2*i-1 for ka, 2*i for kb, mod BLOCK_LEN+1).
    _expandKey(keyBytes) {
      const keyLen = 1 + BLOCK_LEN * (1 + 2 * ROUNDS);
      const key = new Array(keyLen);
      let keyIndex = 0;
      key[keyIndex++] = ROUNDS;

      const ka = new Array(BLOCK_LEN + 1);
      const kb = new Array(BLOCK_LEN + 1);
      ka[BLOCK_LEN] = 0;
      kb[BLOCK_LEN] = 0;

      for (let j = 0; j < BLOCK_LEN; j++) {
        const uk1 = keyBytes[j];
        const uk2 = keyBytes[j + 8];
        ka[j] = OpCodes.RotL8(uk1, 5);
        ka[BLOCK_LEN] ^= ka[j];
        kb[j] = uk2;
        key[keyIndex++] = uk2;
        kb[BLOCK_LEN] ^= kb[j];
      }

      for (let i = 1; i <= ROUNDS; i++) {
        for (let j = 0; j < BLOCK_LEN + 1; j++) {
          ka[j] = OpCodes.RotL8(ka[j], 6);
          kb[j] = OpCodes.RotL8(kb[j], 6);
        }

        for (let j = 0; j < BLOCK_LEN; j++) {
          const idx = (j + 2 * i - 1) % (BLOCK_LEN + 1);
          key[keyIndex++] = OpCodes.And32(ka[idx] + EXP_TAB[EXP_TAB[OpCodes.And32(18 * i + j + 1, 0xFF)]], 0xFF);
        }
        for (let j = 0; j < BLOCK_LEN; j++) {
          const idx = (j + 2 * i) % (BLOCK_LEN + 1);
          key[keyIndex++] = OpCodes.And32(kb[idx] + EXP_TAB[EXP_TAB[OpCodes.And32(18 * i + j + 10, 0xFF)]], 0xFF);
        }
      }

      return key;
    }

    _pht(x, y) {
      const newY = OpCodes.And32(y + x, 0xFF);
      const newX = OpCodes.And32(x + newY, 0xFF);
      return [newX, newY];
    }

    _ipht(x, y) {
      const newX = OpCodes.And32(x - y, 0xFF);
      const newY = OpCodes.And32(y - newX, 0xFF);
      return [newX, newY];
    }

    _encryptBlock(block) {
      let [a, b, c, d, e, f, g, h] = block;
      const ek = this.expandedKey;
      let keyIndex = 0;

      for (let round = 0; round < ROUNDS; round++) {
        a ^= ek[++keyIndex]; b = OpCodes.And32(b + ek[++keyIndex], 0xFF); c = OpCodes.And32(c + ek[++keyIndex], 0xFF); d ^= ek[++keyIndex];
        e ^= ek[++keyIndex]; f = OpCodes.And32(f + ek[++keyIndex], 0xFF); g = OpCodes.And32(g + ek[++keyIndex], 0xFF); h ^= ek[++keyIndex];

        a = OpCodes.And32(EXP_TAB[OpCodes.And32(a, 0xFF)] + ek[++keyIndex], 0xFF);
        b = OpCodes.Xor32(LOG_TAB[OpCodes.And32(b, 0xFF)], ek[++keyIndex]);
        c = OpCodes.Xor32(LOG_TAB[OpCodes.And32(c, 0xFF)], ek[++keyIndex]);
        d = OpCodes.And32(EXP_TAB[OpCodes.And32(d, 0xFF)] + ek[++keyIndex], 0xFF);
        e = OpCodes.And32(EXP_TAB[OpCodes.And32(e, 0xFF)] + ek[++keyIndex], 0xFF);
        f = OpCodes.Xor32(LOG_TAB[OpCodes.And32(f, 0xFF)], ek[++keyIndex]);
        g = OpCodes.Xor32(LOG_TAB[OpCodes.And32(g, 0xFF)], ek[++keyIndex]);
        h = OpCodes.And32(EXP_TAB[OpCodes.And32(h, 0xFF)] + ek[++keyIndex], 0xFF);

        [a, b] = this._pht(a, b); [c, d] = this._pht(c, d);
        [e, f] = this._pht(e, f); [g, h] = this._pht(g, h);
        [a, c] = this._pht(a, c); [e, g] = this._pht(e, g);
        [b, d] = this._pht(b, d); [f, h] = this._pht(f, h);
        [a, e] = this._pht(a, e); [b, f] = this._pht(b, f);
        [c, g] = this._pht(c, g); [d, h] = this._pht(d, h);

        let t = b; b = e; e = c; c = t;
        t = d; d = f; f = g; g = t;
      }

      a ^= ek[++keyIndex]; b = OpCodes.And32(b + ek[++keyIndex], 0xFF); c = OpCodes.And32(c + ek[++keyIndex], 0xFF); d ^= ek[++keyIndex];
      e ^= ek[++keyIndex]; f = OpCodes.And32(f + ek[++keyIndex], 0xFF); g = OpCodes.And32(g + ek[++keyIndex], 0xFF); h ^= ek[++keyIndex];

      return [OpCodes.And32(a, 0xFF), OpCodes.And32(b, 0xFF), OpCodes.And32(c, 0xFF), OpCodes.And32(d, 0xFF), OpCodes.And32(e, 0xFF), OpCodes.And32(f, 0xFF), OpCodes.And32(g, 0xFF), OpCodes.And32(h, 0xFF)];
    }

    _decryptBlock(block) {
      let [a, b, c, d, e, f, g, h] = block;
      const ek = this.expandedKey;
      let keyIndex = BLOCK_LEN * (1 + 2 * ROUNDS);

      h ^= ek[keyIndex]; g = OpCodes.And32(g - ek[--keyIndex], 0xFF); f = OpCodes.And32(f - ek[--keyIndex], 0xFF); e ^= ek[--keyIndex];
      d ^= ek[--keyIndex]; c = OpCodes.And32(c - ek[--keyIndex], 0xFF); b = OpCodes.And32(b - ek[--keyIndex], 0xFF); a ^= ek[--keyIndex];

      for (let round = 0; round < ROUNDS; round++) {
        let t = e; e = b; b = c; c = t;
        t = f; f = d; d = g; g = t;

        [a, e] = this._ipht(a, e); [b, f] = this._ipht(b, f);
        [c, g] = this._ipht(c, g); [d, h] = this._ipht(d, h);
        [a, c] = this._ipht(a, c); [e, g] = this._ipht(e, g);
        [b, d] = this._ipht(b, d); [f, h] = this._ipht(f, h);
        [a, b] = this._ipht(a, b); [c, d] = this._ipht(c, d);
        [e, f] = this._ipht(e, f); [g, h] = this._ipht(g, h);

        h = OpCodes.And32(h - ek[--keyIndex], 0xFF);
        g ^= ek[--keyIndex];
        f ^= ek[--keyIndex];
        e = OpCodes.And32(e - ek[--keyIndex], 0xFF);
        d = OpCodes.And32(d - ek[--keyIndex], 0xFF);
        c ^= ek[--keyIndex];
        b ^= ek[--keyIndex];
        a = OpCodes.And32(a - ek[--keyIndex], 0xFF);

        h = OpCodes.Xor32(LOG_TAB[OpCodes.And32(h, 0xFF)], ek[--keyIndex]);
        g = OpCodes.And32(EXP_TAB[OpCodes.And32(g, 0xFF)] - ek[--keyIndex], 0xFF);
        f = OpCodes.And32(EXP_TAB[OpCodes.And32(f, 0xFF)] - ek[--keyIndex], 0xFF);
        e = OpCodes.Xor32(LOG_TAB[OpCodes.And32(e, 0xFF)], ek[--keyIndex]);
        d = OpCodes.Xor32(LOG_TAB[OpCodes.And32(d, 0xFF)], ek[--keyIndex]);
        c = OpCodes.And32(EXP_TAB[OpCodes.And32(c, 0xFF)] - ek[--keyIndex], 0xFF);
        b = OpCodes.And32(EXP_TAB[OpCodes.And32(b, 0xFF)] - ek[--keyIndex], 0xFF);
        a = OpCodes.Xor32(LOG_TAB[OpCodes.And32(a, 0xFF)], ek[--keyIndex]);
      }

      return [OpCodes.And32(a, 0xFF), OpCodes.And32(b, 0xFF), OpCodes.And32(c, 0xFF), OpCodes.And32(d, 0xFF), OpCodes.And32(e, 0xFF), OpCodes.And32(f, 0xFF), OpCodes.And32(g, 0xFF), OpCodes.And32(h, 0xFF)];
    }
  }

  const algorithmInstance = new DarkCryptSaferSK128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSaferSK128Algorithm, DarkCryptSaferSK128Instance };
}));
