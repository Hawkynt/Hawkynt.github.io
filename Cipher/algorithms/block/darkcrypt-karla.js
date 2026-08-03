/*
 * KARLA (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The KARLA block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). 64-bit block (4x16-bit words), 160-bit key
 * (10x16-bit words). An unbalanced generalized Feistel structure in the style of
 * MD4/SHA-1: 32 rounds, each round applies a per-round-range boolean mixing function
 * (choose/parity/majority, selected exactly as in MD4/SHA-1) to three of the four
 * 16-bit words, folds the result into the fourth word together with two 16-bit
 * subkey words, and rotates the 4-word state.
 *   Per round i (0-31), state = [w0,w1,w2,w3]:
 *     w1 = ROL16(w1, 1)
 *     g  = G(w1, w3, w2, i)     where G is CHOOSE for i<10, PARITY for 10<=i<20,
 *                                MAJORITY for 20<=i<29, PARITY for i>=29
 *     t  = ROR16(w0 XOR K[i] XOR g, 3)  XOR K2[i]
 *     state = [w1, w2, w3, t]            (rotate left, new word appended)
 *   K[i] = schedule[i], K2[i] = schedule[32+i] (a 64-word round-key schedule).
 *   Decryption undoes each round exactly in reverse (rotate right, ROL16 by 3,
 *   un-rotate w1 with ROR16).
 * Key schedule: schedule[0..9] = the 10 raw key words. For i=10..63, schedule[i] is
 * derived from six earlier schedule words via three chained 16-bit multiplications
 * (each operand is itself a 16-bit sum of two schedule words plus one of four MD5-style
 * magic-number halves: 0x6745/0x2301, 0xEFCD/0xAB89, 0x0F1E, with one operand byte-
 * swapped each stage), the final 16-bit product is rotated right by 1 bit.
 * Test vectors were verified against the DarkCrypt implementation, including
 * encrypt/decrypt round-trip and additional single-bit differential checks.
 * 64-bit blocks, 160-bit keys. Educational only.
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

  const ROUNDS = 32;
  const SCHEDULE_LEN = 64; // 16-bit words

  function rol16(x, n) {
    return OpCodes.RotL16(x, n);
  }

  function ror16(x, n) {
    return OpCodes.RotR16(x, n);
  }

  function byteSwap16(x) {
    return OpCodes.Pack16BE(...OpCodes.Unpack16LE(x));
  }

  // Round boolean core (MD4/SHA-1 style): choose / parity / majority selected by round index.
  function roundG(x, y, z, round) {
    x &= 0xFFFF; y &= 0xFFFF; z &= 0xFFFF;
    if (round < 10) return OpCodes.And32(OpCodes.Or32(OpCodes.And32(x, z), OpCodes.And32(y, ~x)), 0xFFFF);      // choose
    if (round < 20) return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(x, y), z), 0xFFFF);                  // parity
    if (round < 29) return OpCodes.And32(OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(x, z)), OpCodes.And32(y, z)), 0xFFFF); // majority
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(x, y), z), 0xFFFF);                                   // parity
  }

  class DarkCryptKarlaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "KARLA (DarkCrypt)";
      this.description = "64-bit block, 160-bit key cipher from the DarkCrypt Total Commander plugin. Unbalanced generalized Feistel over four 16-bit words, 32 rounds using MD4/SHA-1-style choose/parity/majority round functions and a multiply-based key schedule.";
      this.inventor = "Alexander Myasnikov (DarkCrypt \"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(20, 20, 0)];  // fixed 160-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary design", "Custom cipher with no public cryptanalysis.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Karla — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c7bdb02ebf088d20")
        },
        {
          text: "DarkCrypt Karla — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          expected: OpCodes.Hex8ToBytes("7b9603d49fe463d3")
        },
        {
          text: "DarkCrypt Karla — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f1011121314"),
          expected: OpCodes.Hex8ToBytes("5ba154dec94695d3")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptKarlaInstance(this, isInverse);
    }
  }

  class DarkCryptKarlaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._schedule = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._schedule = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 20)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. KARLA (DarkCrypt) requires exactly 20 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._schedule = this._buildSchedule(this._key);
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

    // Key schedule: 10 raw key words, then 54 derived words via three chained
    // 16-bit multiplications seeded with MD5-style magic-number halves.
    _buildSchedule(keyBytes) {
      const T = new Array(SCHEDULE_LEN);
      for (let i = 0; i < 10; i++)
        T[i] = OpCodes.Pack16LE(keyBytes[2 * i], keyBytes[2 * i + 1]);

      for (let i = 10; i < SCHEDULE_LEN; i++) {
        const a = OpCodes.And32(T[i - 9] + T[i - 2] + 0x6745, 0xFFFF);
        const b = byteSwap16(OpCodes.And32(T[i - 10] + T[i - 8] + 0x2301, 0xFFFF));
        const p1 = OpCodes.ToUint32(a * b);

        const c = byteSwap16(OpCodes.And32(T[i - 5] + T[i - 3] + 0xEFCD, 0xFFFF));
        const d = OpCodes.And32(OpCodes.And32(p1, 0xFFFF) + T[i - 4] + T[i - 7] + 0xAB89, 0xFFFF);
        const p2 = OpCodes.ToUint32(d * c);

        const e = byteSwap16(OpCodes.And32(T[i - 6] + T[i - 1] + 0x0F1E, 0xFFFF));
        const p3 = OpCodes.ToUint32(OpCodes.And32(p2, 0xFFFF) * e);

        T[i] = ror16(OpCodes.And32(p3, 0xFFFF), 1);
      }
      return T;
    }

    _encryptBlock(block) {
      const T = this._schedule;
      let buf = [
        OpCodes.Pack16LE(block[0], block[1]),
        OpCodes.Pack16LE(block[2], block[3]),
        OpCodes.Pack16LE(block[4], block[5]),
        OpCodes.Pack16LE(block[6], block[7])
      ];
      for (let round = 0; round < ROUNDS; round++) {
        buf[1] = rol16(buf[1], 1);
        const g = roundG(buf[1], buf[3], buf[2], round);
        let nw0 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(buf[0], T[round]), g), 0xFFFF);
        nw0 = ror16(nw0, 1);
        nw0 = ror16(nw0, 1);
        nw0 = ror16(nw0, 1);
        nw0 = OpCodes.And32(OpCodes.Xor32(nw0, T[ROUNDS + round]), 0xFFFF);
        buf = [buf[1], buf[2], buf[3], nw0];
      }
      return [
        ...OpCodes.Unpack16LE(buf[0]), ...OpCodes.Unpack16LE(buf[1]),
        ...OpCodes.Unpack16LE(buf[2]), ...OpCodes.Unpack16LE(buf[3])
      ];
    }

    _decryptBlock(block) {
      const T = this._schedule;
      let buf = [
        OpCodes.Pack16LE(block[0], block[1]),
        OpCodes.Pack16LE(block[2], block[3]),
        OpCodes.Pack16LE(block[4], block[5]),
        OpCodes.Pack16LE(block[6], block[7])
      ];
      for (let round = ROUNDS - 1; round >= 0; round--) {
        buf = [buf[3], buf[0], buf[1], buf[2]]; // rotate right
        let nw0 = OpCodes.And32(OpCodes.Xor32(buf[0], T[ROUNDS + round]), 0xFFFF);
        nw0 = rol16(nw0, 1);
        nw0 = rol16(nw0, 1);
        nw0 = rol16(nw0, 1);
        const g = roundG(buf[1], buf[3], buf[2], round);
        nw0 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(nw0, T[round]), g), 0xFFFF);
        buf[0] = nw0;
        buf[1] = ror16(buf[1], 1);
      }
      return [
        ...OpCodes.Unpack16LE(buf[0]), ...OpCodes.Unpack16LE(buf[1]),
        ...OpCodes.Unpack16LE(buf[2]), ...OpCodes.Unpack16LE(buf[3])
      ];
    }
  }

  const algorithmInstance = new DarkCryptKarlaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKarlaAlgorithm, DarkCryptKarlaInstance };
}));
