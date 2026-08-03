/*
 * A5 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A5-family stream cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). It resembles the GSM A5/1 stop/go
 * three-LFSR generator but differs from the textbook algorithm:
 *   - the 64-bit key is packed directly into the three registers (no bit-by-bit
 *     clock-and-XOR key loading, no frame number, no 100-cycle discard/warm-up)
 *   - the per-register majority/clock-control bit is one position higher than
 *     standard A5/1 (bit 9/11/11 instead of bit 8/10/10)
 *   - register 2 and register 3 use different feedback tap positions than
 *     standard A5/1 (bits 21,20,16,12 and 22,21,18,17 respectively)
 *   - the output bit is the XOR of bit 0 (not a high "output" bit) of all three
 *     registers after each conditional clock
 * Test vectors generated from the DarkCrypt implementation (setup(key) takes
 * a single argument; crypt(buf,len) XORs the keystream into the buffer in place).
 * 64-bit key, no IV. Educational only.
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

  // Register 1: 19 bits, clock-control bit 9, feedback taps 18,17,16,13
  const R1_MASK = 0x7FFFF;
  const R1_BIT = 9;
  const R1_TAPS = [18, 17, 16, 13];

  // Register 2: 22 bits, clock-control bit 11, feedback taps 21,20,16,12
  const R2_MASK = 0x3FFFFF;
  const R2_BIT = 11;
  const R2_TAPS = [21, 20, 16, 12];

  // Register 3: 23 bits, clock-control bit 11, feedback taps 22,21,18,17
  const R3_MASK = 0x7FFFFF;
  const R3_BIT = 11;
  const R3_TAPS = [22, 21, 18, 17];

  function tapXor(reg, taps) {
    let f = 0;
    for (let i = 0; i < taps.length; i++)
      f = OpCodes.XorN(f, OpCodes.AndN(OpCodes.Shr32(reg, taps[i]), 1));
    return OpCodes.AndN(f, 1);
  }

  function clockRegister(reg, taps, mask) {
    const feedback = tapXor(reg, taps);
    const shifted = OpCodes.AndN(OpCodes.Shl32(reg, 1), mask);
    return OpCodes.OrN(shifted, feedback);
  }

  class DarkCryptA5Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "A5 (DarkCrypt)";
      this.description = "A5-family stop/go three-LFSR stream cipher from the DarkCrypt Total Commander plugin. Loads the 64-bit key directly into the registers (no frame number, no discard rounds) and uses non-standard clock-control/tap positions.";
      this.inventor = "ETSI SAGE (base A5/1 design); DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(8, 8, 0)];   // fixed 64-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Wikipedia: A5/1 (base algorithm)", "https://en.wikipedia.org/wiki/A5/1")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Modified A5/1 with a trivial direct key-load and altered tap positions; unanalyzed and not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (setup(key) then crypt(buf,len) in-place XOR).
      this.tests = [
        {
          text: "DarkCrypt A5 — keystream from incrementing key, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("fd65ae4da3a3dcbc8e1c52a8c7fb387af2644f41e2f17eee773c526206c56dcb50c51d253501f6959bb1b3572df82b8d93b40aa3b907ce02e6d9bdcf5975e5b28762ee187a9c71e40c5db01eca4136cd74acbd1779e1301edc07ebf25300a9f4c327f5806c2065ad0d6a32aa6f2589d3e040888e0ccb7d683ad91905e99dcadb")
        },
        {
          text: "DarkCrypt A5 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("fd64ac4ea7a6dabb861558a3cbf63675e2755d52f6e468f96f2548791ad873d470e43f061124d0b2b398997c01d505a2a38538908d32f835dee087f46548db8d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptA5Instance(this, isInverse);
    }
  }

  class DarkCryptA5Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._r1 = 0;
      this._r2 = 0;
      this._r3 = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 8)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. A5 (DarkCrypt) requires exactly 8 bytes`);
      this._key = [...keyBytes];
      this._initialize();
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

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._generateKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _initialize() {
      const k = this._key;
      this._r1 = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(k[0], 11), OpCodes.Shl32(k[1], 3)), OpCodes.Shr32(k[2], 5));
      this._r2 = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(k[2], 17), OpCodes.Shl32(k[3], 9)), OpCodes.Shl32(k[4], 1)), OpCodes.Shr32(k[5], 7));
      this._r3 = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(k[5], 15), OpCodes.Shl32(k[6], 8)), k[7]);
    }

    _generateKeystreamBit() {
      const c1 = OpCodes.AndN(OpCodes.Shr32(this._r1, R1_BIT), 1);
      const c2 = OpCodes.AndN(OpCodes.Shr32(this._r2, R2_BIT), 1);
      const c3 = OpCodes.AndN(OpCodes.Shr32(this._r3, R3_BIT), 1);
      const majority = (c1 + c2 + c3 > 1) ? 1 : 0;

      if (c1 === majority) this._r1 = clockRegister(this._r1, R1_TAPS, R1_MASK);
      if (c2 === majority) this._r2 = clockRegister(this._r2, R2_TAPS, R2_MASK);
      if (c3 === majority) this._r3 = clockRegister(this._r3, R3_TAPS, R3_MASK);

      return OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(this._r1, this._r2), this._r3), 1);
    }

    _generateKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte = OpCodes.AndN(OpCodes.Shl32(byte, 1), 0xFF);
        byte = OpCodes.OrN(byte, this._generateKeystreamBit());
      }
      return byte;
    }
  }

  const algorithmInstance = new DarkCryptA5Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptA5Algorithm, DarkCryptA5Instance };
}));
