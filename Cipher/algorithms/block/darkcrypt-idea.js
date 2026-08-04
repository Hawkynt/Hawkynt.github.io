/*
 * IDEA (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The standard International Data Encryption Algorithm (Lai/Massey, 1991) as
 * implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). The DarkCrypt implementation matches textbook IDEA exactly:
 * 8.5 rounds of the Lai-Massey structure with 16-bit XOR, addition mod 2^16
 * and multiplication mod (2^16+1), big-endian 16-bit words, standard 52-word
 * key schedule (25-bit left rotation every 8 subkeys) and its inverse for
 * decryption.
 * Implemented independently (not derived from the repository's existing
 * `IDEA` algorithm, whose multiplication-mod routine has a masking bug that
 * only happens to cancel out for the all-zero-key case); validated against
 * both the classic published IDEA test vector and the 3 DarkCrypt vectors
 * verified against the DarkCrypt implementation.
 * 64-bit blocks, 128-bit keys. Educational only.
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

  const BASE = 0x10001; // 2^16 + 1
  const ROUNDS = 8;
  const SUBKEYS = 52; // 8 rounds * 6 + 4 (final half-round)

  // Multiplication modulo 2^16+1, with 0 representing 2^16 (IDEA's special case)
  function mulMod(x, y) {
    x = OpCodes.ToUint16(x);
    y = OpCodes.ToUint16(y);
    if (x === 0) return OpCodes.ToUint16(BASE - y);
    if (y === 0) return OpCodes.ToUint16(BASE - x);

    const p = x * y;               // at most 0xFFFE0001, safe in a JS double
    const lo = OpCodes.AndN(p, 0xFFFF);
    const hi = OpCodes.Shr32(p, 16);
    let r = lo - hi;
    if (r < 0) r += BASE;
    return OpCodes.ToUint16(r);
  }

  // Multiplicative inverse modulo 2^16+1 (extended Euclid)
  function mulInv(x) {
    if (x <= 1) return OpCodes.ToUint16(x);

    let t0 = 1, t1 = Math.floor(BASE / x);
    let y = BASE % x;
    while (y !== 1) {
      const q = Math.floor(x / y);
      x = x % y;
      t0 = OpCodes.ToUint16(t0 + t1 * q);
      if (x === 1) return t0;
      const q2 = Math.floor(y / x);
      y = y % x;
      t1 = OpCodes.ToUint16(t1 + t0 * q2);
    }
    return OpCodes.ToUint16(BASE - t1);
  }

  // Additive inverse modulo 2^16
  function addInv(x) {
    return OpCodes.ToUint16(OpCodes.And32(OpCodes.ToUint32(0x10000 - OpCodes.ToUint16(x)), 0xFFFF));
  }

  class DarkCryptIDEAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "IDEA (DarkCrypt)";
      this.description = "Standard International Data Encryption Algorithm (Lai/Massey) as implemented in the DarkCrypt Total Commander plugin: textbook 8.5-round Lai-Massey structure, big-endian 16-bit words. 64-bit block, 128-bit key. Validated against the DarkCrypt implementation and the classic published IDEA test vector.";
      this.inventor = "Xuejia Lai, James L. Massey";
      this.year = 1991;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CH;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];  // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("IDEA (base algorithm)", "https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak keys", "IDEA has a small class of weak keys detectable in known-plaintext scenarios.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Idea — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0001000100000000")
        },
        {
          text: "DarkCrypt Idea — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("864c9d7d208a0e65")
        },
        {
          text: "DarkCrypt Idea — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("f9698f89bb4969fe")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptIDEAInstance(this, isInverse);
    }
  }

  class DarkCryptIDEAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
      this.encryptKeys = null;
      this.decryptKeys = null;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null; this.encryptKeys = null; this.decryptKeys = null; this.KeySize = 0;
        return;
      }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. IDEA (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.encryptKeys = this._expandKey(keyBytes);
      this.decryptKeys = this._invertKey(this.encryptKeys);
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
        output.push(...this._crypt(this.isInverse ? this.decryptKeys : this.encryptKeys, block));
      }
      this.inputBuffer = [];
      return output;
    }

    // Standard IDEA key schedule: the first 8 subkeys are taken directly from
    // the user key (big-endian 16-bit words); each subsequent subkey is the
    // 16-bit window obtained by rotating the 128-bit key register left by 25
    // bits, expressed compactly via a 9/7 bit split of the two source words
    // 7 and 6 positions back (equivalent to, but avoiding, maintaining an
    // explicit 128-bit rotating register).
    _expandKey(keyBytes) {
      const key = new Array(SUBKEYS);
      for (let i = 0; i < 8; i++)
        key[i] = OpCodes.Pack16BE(keyBytes[i * 2], keyBytes[i * 2 + 1]);

      for (let i = 8; i < SUBKEYS; i++) {
        const m = OpCodes.And32(i, 7);
        if (m < 6) {
          key[i] = OpCodes.ToUint16(OpCodes.Shl16(key[i - 7], 9) | OpCodes.Shr16(key[i - 6], 7));
        } else if (m === 6) {
          key[i] = OpCodes.ToUint16(OpCodes.Shl16(key[i - 7], 9) | OpCodes.Shr16(key[i - 14], 7));
        } else {
          key[i] = OpCodes.ToUint16(OpCodes.Shl16(key[i - 15], 9) | OpCodes.Shr16(key[i - 14], 7));
        }
      }
      return key;
    }

    // Derive the 52 decryption subkeys from the encryption subkeys
    _invertKey(ek) {
      const dk = new Array(SUBKEYS);
      let inOff = 0, p = SUBKEYS;

      let t1 = mulInv(ek[inOff++]);
      let t2 = addInv(ek[inOff++]);
      let t3 = addInv(ek[inOff++]);
      let t4 = mulInv(ek[inOff++]);
      dk[--p] = t4; dk[--p] = t3; dk[--p] = t2; dk[--p] = t1;

      for (let round = 1; round < ROUNDS; round++) {
        t1 = ek[inOff++]; t2 = ek[inOff++];
        dk[--p] = t2; dk[--p] = t1;

        t1 = mulInv(ek[inOff++]);
        t2 = addInv(ek[inOff++]);
        t3 = addInv(ek[inOff++]);
        t4 = mulInv(ek[inOff++]);
        dk[--p] = t4; dk[--p] = t2; dk[--p] = t3; dk[--p] = t1;
      }

      t1 = ek[inOff++]; t2 = ek[inOff++];
      dk[--p] = t2; dk[--p] = t1;

      t1 = mulInv(ek[inOff++]);
      t2 = addInv(ek[inOff++]);
      t3 = addInv(ek[inOff++]);
      t4 = mulInv(ek[inOff]);
      dk[--p] = t4; dk[--p] = t3; dk[--p] = t2; dk[--p] = t1;

      return dk;
    }

    _crypt(subkeys, block) {
      let x0 = OpCodes.Pack16BE(block[0], block[1]);
      let x1 = OpCodes.Pack16BE(block[2], block[3]);
      let x2 = OpCodes.Pack16BE(block[4], block[5]);
      let x3 = OpCodes.Pack16BE(block[6], block[7]);

      let k = 0;
      for (let round = 0; round < ROUNDS; round++) {
        x0 = mulMod(x0, subkeys[k++]);
        x1 = OpCodes.ToUint16(x1 + subkeys[k++]);
        x2 = OpCodes.ToUint16(x2 + subkeys[k++]);
        x3 = mulMod(x3, subkeys[k++]);

        const t0 = x1;
        const t1 = x2;
        x2 = OpCodes.Xor32(x2, x0);
        x1 = OpCodes.Xor32(x1, x3);
        x2 = mulMod(x2, subkeys[k++]);
        x1 = OpCodes.ToUint16(x1 + x2);
        x1 = mulMod(x1, subkeys[k++]);
        x2 = OpCodes.ToUint16(x2 + x1);

        x0 = OpCodes.Xor32(x0, x1);
        x3 = OpCodes.Xor32(x3, x2);
        x1 = OpCodes.Xor32(x1, t1);
        x2 = OpCodes.Xor32(x2, t0);
      }

      // final half-round output transformation (note x1/x2 swapped back)
      const y0 = mulMod(x0, subkeys[k++]);
      const y1 = OpCodes.ToUint16(x2 + subkeys[k++]);
      const y2 = OpCodes.ToUint16(x1 + subkeys[k++]);
      const y3 = mulMod(x3, subkeys[k]);

      return [
        ...OpCodes.Unpack16BE(y0), ...OpCodes.Unpack16BE(y1),
        ...OpCodes.Unpack16BE(y2), ...OpCodes.Unpack16BE(y3)
      ];
    }
  }

  const algorithmInstance = new DarkCryptIDEAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptIDEAAlgorithm, DarkCryptIDEAInstance };
}));
