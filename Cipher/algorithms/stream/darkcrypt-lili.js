/*
 * LILI-128 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LILI-128 clock-controlled keystream generator, as implemented in the
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project).
 * This matches the public LILI-128 design (Simpson, Dawson, Golic, Millan,
 * SAC 2000): a 39-bit LFSRc feeds a 2-tap clock-control function fc that
 * irregularly clocks an 89-bit LFSRd by 1-4 steps per output bit; 10 taps
 * from LFSRd select an entry in a 1024-entry balanced nonlinear Boolean
 * function table (fd) which supplies each keystream bit, MSB-first per byte.
 * The 128-bit key is split bit-serially (MSB first) into the first 39 bits
 * (LFSRc) and the remaining 89 bits (LFSRd); there is no separate IV.
 *
 * DarkCrypt-specific implementation detail: the high 7 "overflow" bits of
 * LFSRc and the register words are kept as plain 32-bit words without
 * re-masking to their nominal bit width after each shift (relying on
 * native 32-bit wraparound instead of explicit masks); this is reproduced
 * exactly since it is part of the DarkCrypt implementation's observable
 * behavior. setup(key) takes a single argument; crypt(buf,len) XORs the
 * keystream into the buffer in place. The 1024-entry fd table is embedded
 * verbatim below.
 * 128-bit key, no IV. Educational only.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // fd: 1024-entry nonlinear Boolean function table (10-bit LFSRd tap
  // selection -> 1 output bit), as implemented in the DarkCrypt Total Commander plugin.
  const FD_TABLE = [
    0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,
    0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,
    0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,
    1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,
    0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,
    0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,
    0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,
    1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,
    0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,
    0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,
    0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,
    0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,
    0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,
    1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
    0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,
    1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,
    0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,
    1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,
    0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,
    1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,1,1,0,0,
    0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,
    1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,
    0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,
    1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,
    0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,
    1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,
    0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,
    1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,
    0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,
    1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,0,1,1,0,
    0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,
    1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,
  ];

  if (FD_TABLE.length !== 1024) throw new Error('LILI fd table must have 1024 entries');

  function u32(x) { return OpCodes.ToUint32(x); }

  class DarkCryptLiliAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "LILI-128 (DarkCrypt)";
      this.description = "Clock-controlled LFSR keystream generator matching the public LILI-128 design (Simpson/Dawson/Golic/Millan, SAC 2000): a 39-bit LFSRc irregularly clocks an 89-bit LFSRd (1-4 times per bit) whose taps drive a 1024-entry nonlinear Boolean function.";
      this.inventor = "Simpson, Dawson, Golic, Millan (base LILI-128 design); DarkCrypt port by Alexander Myasnikov";
      this.year = 2000;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("LILI Keystream Generator (SAC 2000 paper)", "https://www.researchgate.net/publication/2528091_LILI_Keystream_Generator")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Known cryptanalytic attacks", "LILI-128 is subject to published distinguishing and algebraic attacks; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (setup(key) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt Lili — keystream from incrementing key, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("612cca9a6cd85262a7232e4e636bb12591244ada79631ed367c0c09422bbe4549bb92dea46bb75096c01d8a2ff3c2444ed5389894c6e738ca710ce03aeb52473063f554bfb63ce58d6b0a7c651276e8dc2210c73ef0737035d863658ec8749535c87c9338412bf8b16f2228cd54317c2a0be7f888b995cc88ec7fae592ffd044")
        },
        {
          text: "DarkCrypt Lili — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("612dc89968dd5465af2a24456f66bf2a813558c96d7608c47fd9da8f3ea6fa4bbb980fc9629e532e4428f289d3110a6bdd62bbba785b45bb9f29f43892881a4c")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLiliInstance(this, isInverse);
    }
  }

  class DarkCryptLiliInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      // LFSRc: c0 = low 32 bits, c1 = high (7 significant bits, but kept
      // unmasked exactly like the DarkCrypt implementation, which never re-masks it after a shift).
      this._c0 = 0;
      this._c1 = 0;
      // LFSRd: d0 = low 32 bits, d1 = middle 32 bits, d2 = high 25 significant bits.
      this._d0 = 0;
      this._d1 = 0;
      this._d2 = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. LILI-128 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this._initialize();
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

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._generateKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      const k = this._key;

      // LFSRc <- first 39 bits of the key, MSB first.
      let c1 = OpCodes.Shr32(k[0], 1);
      let c0 = OpCodes.And32(k[0], 1);
      c0 = OpCodes.Or32(OpCodes.Shl32(c0, 8), k[1]);
      c0 = OpCodes.Or32(OpCodes.Shl32(c0, 8), k[2]);
      c0 = OpCodes.Or32(OpCodes.Shl32(c0, 8), k[3]);
      c0 = OpCodes.Or32(OpCodes.Shl32(c0, 7), OpCodes.Shr32(k[4], 1));
      this._c0 = c0; this._c1 = c1;

      // LFSRd <- remaining 89 bits of the key, MSB first.
      let d2 = OpCodes.And32(k[4], 1);
      d2 = OpCodes.Or32(OpCodes.Shl32(d2, 8), k[5]);
      d2 = OpCodes.Or32(OpCodes.Shl32(d2, 8), k[6]);
      d2 = OpCodes.Or32(OpCodes.Shl32(d2, 8), k[7]);

      let d1 = k[8];
      d1 = OpCodes.Or32(OpCodes.Shl32(d1, 8), k[9]);
      d1 = OpCodes.Or32(OpCodes.Shl32(d1, 8), k[10]);
      d1 = OpCodes.Or32(OpCodes.Shl32(d1, 8), k[11]);

      let d0 = k[12];
      d0 = OpCodes.Or32(OpCodes.Shl32(d0, 8), k[13]);
      d0 = OpCodes.Or32(OpCodes.Shl32(d0, 8), k[14]);
      d0 = OpCodes.Or32(OpCodes.Shl32(d0, 8), k[15]);

      this._d0 = d0; this._d1 = d1; this._d2 = d2;
    }

    _generateKeystreamBit() {
      // fc: 2-tap clock control value (0-3), read before this bit's C-clock.
      const t26 = OpCodes.Shr32(OpCodes.And32(this._c0, 0x4000000), 25);
      const t18 = OpCodes.Shr32(OpCodes.And32(this._c0, 0x40000), 18);
      const k = OpCodes.OrN(t26, t18);

      // Clock LFSRc by exactly 1 (regular clock).
      const newC1 = OpCodes.Or32(OpCodes.Shl32(this._c1, 1), OpCodes.Shr32(this._c0, 31));
      const newC0 = OpCodes.Shl32(this._c0, 1);
      this._c1 = newC1; this._c0 = newC0;
      let fbC = OpCodes.Xor32(OpCodes.Shr32(this._c1, 7), OpCodes.Shr32(this._c1, 3));
      fbC = OpCodes.Xor32(fbC, OpCodes.Shr32(this._c1, 1));
      fbC = OpCodes.Xor32(fbC, OpCodes.Shr32(this._c0, 31));
      fbC = OpCodes.Xor32(fbC, OpCodes.Shr32(this._c0, 17));
      fbC = OpCodes.Xor32(fbC, OpCodes.Shr32(this._c0, 15));
      fbC = OpCodes.Xor32(fbC, OpCodes.Shr32(this._c0, 14));
      fbC = OpCodes.Xor32(fbC, OpCodes.Shr32(this._c0, 2));
      fbC = OpCodes.And32(fbC, 1);
      this._c0 = u32(this._c0 | fbC);

      // fd: assemble the 10-bit LFSRd tap selector, read before this bit's D-clocking.
      let idx = 0;
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d2, 24), 1), 9);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d2, 23), 1), 8);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d2, 21), 1), 7);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d2, 17), 1), 6);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d2, 12), 1), 5);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d2, 4), 1), 4);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d1, 26), 1), 3);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d1, 12), 1), 2);
      idx |= OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(this._d0, 23), 1), 1);
      idx |= OpCodes.And32(OpCodes.Shr32(this._d0, 8), 1);
      const bit = FD_TABLE[idx];

      // Clock LFSRd irregularly, k+1 times (1 to 4 clocks).
      for (let i = 0; i <= k; i++) {
        const nd2 = OpCodes.Or32(OpCodes.Shl32(this._d2, 1), OpCodes.Shr32(this._d1, 31));
        const nd1 = OpCodes.Or32(OpCodes.Shl32(this._d1, 1), OpCodes.Shr32(this._d0, 31));
        const nd0 = OpCodes.Shl32(this._d0, 1);
        this._d2 = nd2; this._d1 = nd1; this._d0 = nd0;
        let fbD = OpCodes.Xor32(OpCodes.Shr32(this._d2, 25), OpCodes.Shr32(this._d2, 19));
        fbD = OpCodes.Xor32(fbD, OpCodes.Shr32(this._d2, 16));
        fbD = OpCodes.Xor32(fbD, OpCodes.Shr32(this._d1, 23));
        fbD = OpCodes.Xor32(fbD, OpCodes.Shr32(this._d1, 21));
        fbD = OpCodes.Xor32(fbD, OpCodes.Shr32(this._d1, 10));
        fbD = OpCodes.Xor32(fbD, OpCodes.Shr32(this._d1, 7));
        fbD = OpCodes.Xor32(fbD, OpCodes.Shr32(this._d0, 1));
        fbD = OpCodes.And32(fbD, 1);
        this._d0 = u32(this._d0 | fbD);
      }

      return bit;
    }

    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++)
        byte = OpCodes.OrN(OpCodes.AndN(OpCodes.Shl32(byte, 1), 0xFF), this._generateKeystreamBit());
      return byte;
    }
  }

  const algorithmInstance = new DarkCryptLiliAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLiliAlgorithm, DarkCryptLiliInstance };
}));
