(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

class A51 extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "A5/1";
    this.description = "GSM stream cipher using three irregularly clocked LFSRs with majority voting. Educational implementation demonstrating telecommunications security algorithms from cellular networks.";
    this.inventor = "ETSI SAGE";
    this.year = 1987;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.INTERNATIONAL;

    this.SupportedKeySizes = [new KeySize(8, 8, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("Wikipedia: A5/1", "https://en.wikipedia.org/wiki/A5/1"),
      new LinkItem("ETSI TS 155 226 - A5/1 Encryption Algorithm", "https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/"),
      new LinkItem("3GPP TS 55.216 - A5/1 Algorithm Specification", "https://www.3gpp.org/DynaReport/55216.htm")
    ];

    this.vulnerabilities = [
      new Vulnerability("Time-Memory Tradeoff Attack", "Practical real-time key recovery attacks demonstrated by Biryukov-Shamir-Wagner"),
      new Vulnerability("Correlation Attack", "Exploits linear properties of LFSRs to recover internal state")
    ];

    this.tests = [
      {
        text: "A5/1 Test Vector - Key 1",
        uri: "A5/1 reference implementation with frame=0",
        input: OpCodes.Hex8ToBytes("000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("123456789abcdef0"),
        expected: OpCodes.Hex8ToBytes("b7d37880be862cdbf6d401fae7ffa2")
      },
      {
        text: "A5/1 Test Vector - Key 2",
        uri: "A5/1 reference implementation with different key",
        input: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f"),
        key: OpCodes.Hex8ToBytes("fedcba9876543210"),
        expected: OpCodes.Hex8ToBytes("6a97039a899deca7df5a3f722e7bff")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new A51Instance(this, isInverse);
  }
}

class A51Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._frameNumber = 0;
    this._lfsr1 = 0;
    this._lfsr2 = 0;
    this._lfsr3 = 0;
    this._initialized = false;

    // A5/1 Constants from C reference
    this.R1MASK = 0x07FFFF;  // 19 bits
    this.R2MASK = 0x3FFFFF;  // 22 bits
    this.R3MASK = 0x7FFFFF;  // 23 bits
    this.R1TAPS = 0x072000;  // bits 18,17,16,13
    this.R2TAPS = 0x300000;  // bits 21,20
    this.R3TAPS = 0x700080;  // bits 22,21,20,7
    this.R1MID = 0x000100;   // bit 8
    this.R2MID = 0x000400;   // bit 10
    this.R3MID = 0x000400;   // bit 10
    this.R1OUT = 0x040000;   // bit 18
    this.R2OUT = 0x200000;   // bit 21
    this.R3OUT = 0x400000;   // bit 22
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this._initialize();
  }

  get key() { return this._key ? [...this._key] : null; }

  set frame(frameNumber) {
    this._frameNumber = frameNumber || 0;
    if (this._key) {
      this._initialize();
    }
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._generateKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _initialize() {
    if (!this._key) return;

    // Initialize registers to zero
    this._lfsr1 = 0;
    this._lfsr2 = 0;
    this._lfsr3 = 0;

    // Load 64-bit secret key
    for (let i = 0; i < 64; i++) {
      this._clockAllRegisters();

      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      if (this._key[byteIdx] & (1 << bitIdx)) {
        this._lfsr1 ^= 1;
        this._lfsr2 ^= 1;
        this._lfsr3 ^= 1;
      }
    }

    // Load 22-bit frame number
    for (let i = 0; i < 22; i++) {
      this._clockAllRegisters();

      if (this._frameNumber & (1 << i)) {
        this._lfsr1 ^= 1;
        this._lfsr2 ^= 1;
        this._lfsr3 ^= 1;
      }
    }

    // Mix for 100 cycles
    for (let i = 0; i < 100; i++) {
      this._clockRegisters();
    }

    this._initialized = true;
  }

  _parity(x) {
    return OpCodes.PopCountFast(x) & 1;
  }

  _clockone(reg, mask, taps) {
    const t = reg & taps;
    reg = (reg << 1) & mask;
    reg |= this._parity(t);
    return reg;
  }

  _clockAllRegisters() {
    this._lfsr1 = this._clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
    this._lfsr2 = this._clockone(this._lfsr2, this.R2MASK, this.R2TAPS);
    this._lfsr3 = this._clockone(this._lfsr3, this.R3MASK, this.R3TAPS);
  }

  _clockRegisters() {
    const c1 = (this._lfsr1 & this.R1MID) !== 0 ? 1 : 0;
    const c2 = (this._lfsr2 & this.R2MID) !== 0 ? 1 : 0;
    const c3 = (this._lfsr3 & this.R3MID) !== 0 ? 1 : 0;

    const maj = (c1 + c2 + c3) >= 2 ? 1 : 0;

    if (c1 === maj) {
      this._lfsr1 = this._clockone(this._lfsr1, this.R1MASK, this.R1TAPS);
    }
    if (c2 === maj) {
      this._lfsr2 = this._clockone(this._lfsr2, this.R2MASK, this.R2TAPS);
    }
    if (c3 === maj) {
      this._lfsr3 = this._clockone(this._lfsr3, this.R3MASK, this.R3TAPS);
    }
  }

  _generateKeystreamBit() {
    this._clockRegisters();

    return ((this._lfsr1 & this.R1OUT) ? 1 : 0) ^
           ((this._lfsr2 & this.R2OUT) ? 1 : 0) ^
           ((this._lfsr3 & this.R3OUT) ? 1 : 0);
  }

  _generateKeystreamByte() {
    let byte = 0;
    for (let i = 0; i < 8; i++) {
      const bit = this._generateKeystreamBit();
      if (bit) {
        byte = OpCodes.SetBit(byte, 7 - i, 1);
      }
    }
    return byte;
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new A51();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { A51, A51Instance };
}));
