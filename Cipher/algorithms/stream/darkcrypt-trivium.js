/*
 * Trivium (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Trivium as implemented in the DarkCrypt Total Commander plugin. The
 * internal 288-bit NLFSR state (three shift registers of 93, 84 and 111
 * bits), the key/IV loading (80-bit key into the first register, 80-bit
 * IV into the second, three fixed "1" tail bits into the third), the
 * feedback/filter taps and the 1152-round warm-up are all BIT-EXACT to
 * the standard eSTREAM Trivium specification (De Canniere & Preneel).
 * The one genuine deviation is in how generated keystream bits are
 * packed into bytes: the implementation produces keystream 32 bits at a
 * time and REVERSES the bit order within each 32-bit group before XORing
 * it with the plaintext word and writing it out little-endian, instead
 * of using the bits in their natural generation order. Concretely, if
 * b0,b1,...,b31 are the 32 successively generated Trivium output bits of
 * a block, they are emitted (LSB-first per byte) in the order
 * b31,b30,...,b1,b0 rather than b0,b1,...,b31.
 * 80-bit key, 80-bit IV. Educational only.
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

  const WARMUP_ROUNDS = 1152; // 4 * 288, standard Trivium initialization

  class DarkCryptTriviumAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Trivium (DarkCrypt)";
      this.description = "Standard eSTREAM Trivium NLFSR (93+84+111 bit state, 80-bit key, 80-bit IV, 1152-round warm-up) as implemented in the DarkCrypt Total Commander plugin, with one deviation: the 32-bit-word keystream generator emits each 32-bit group of output bits in reversed order before packing into bytes.";
      this.inventor = "Christophe De Canniere, Bart Preneel (base Trivium design); DarkCrypt port by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(10, 10, 0)];   // fixed 80-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("eSTREAM: Trivium (base algorithm)", "https://www.ecrypt.eu.org/stream/e2-trivium.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard output packing", "Reverses the bit order within each 32-bit keystream word before use; produces a different (but equally structured) keystream than standard Trivium. Unanalyzed variant, not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) then crypt(in,out,len) XOR).
      this.tests = [
        {
          text: "DarkCrypt Trivium — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00010203040506070809"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("4e96d199fe4c6ae13b3b616dcbfa0b2df36df09d38ef2951a0df7c5214c07e66611200d0b88baf0032e18d3f67449869c942445af2ec268bcf8e1861e9940ea8df0792f8f02e9fa9403fff520ce3f762f756e59a1038071f294511c05330383db49cb83d3f205c81d406fa193494f7436842aa1735f0a05887dc730834530eac")
        },
        {
          text: "DarkCrypt Trivium — incrementing key/plaintext, zero IV",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("00010203040506070809"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000"),
          expected: OpCodes.Hex8ToBytes("4e97d39afa496ce633326b66c7f70522e37ce28e2cfa3f46b8c6664908dd6079413322f39cae89271ac8a7144b69b646f9737669c6d910bcf7b7225ad5a93097")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptTriviumInstance(this, isInverse);
    }
  }

  class DarkCryptTriviumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this._state = null; // 288-entry bit array (0/1), s[0..92]=A, s[93..176]=B, s[177..287]=C
      this._pendingBits = []; // leftover un-consumed keystream bits (reversed-per-32 order)
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 10)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Trivium (DarkCrypt) requires exactly 10 bytes`);
      this._key = [...keyBytes];
      this._tryInit();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== 10)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Trivium (DarkCrypt) requires exactly 10 bytes`);
      this._iv = [...ivBytes];
      this._tryInit();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._state) throw new Error("Key/IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._state) throw new Error("Key/IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _tryInit() {
      if (!this._key || !this._iv) { this._state = null; return; }

      const s = new Array(288).fill(0);
      for (let i = 0; i < 80; i++)
        s[i] = OpCodes.AndN(OpCodes.Shr32(this._key[OpCodes.Shr32(i, 3)], OpCodes.And32(i, 7)), 1);
      for (let i = 0; i < 80; i++)
        s[93 + i] = OpCodes.AndN(OpCodes.Shr32(this._iv[OpCodes.Shr32(i, 3)], OpCodes.And32(i, 7)), 1);
      s[285] = 1; s[286] = 1; s[287] = 1;

      this._state = s;
      this._pendingBits = [];
      for (let i = 0; i < WARMUP_ROUNDS; i++) this._clock();
    }

    // one standard Trivium clock: updates state in place, returns the raw output bit
    _clock() {
      const s = this._state;
      const t1 = OpCodes.XorN(s[65], s[92]);
      const a1 = OpCodes.AndN(s[90], s[91]);
      const f1 = OpCodes.XorN(OpCodes.XorN(t1, a1), s[170]);

      const t2 = OpCodes.XorN(s[161], s[176]);
      const a2 = OpCodes.AndN(s[174], s[175]);
      const f2 = OpCodes.XorN(OpCodes.XorN(t2, a2), s[263]);

      const t3 = OpCodes.XorN(s[242], s[287]);
      const a3 = OpCodes.AndN(s[285], s[286]);
      const f3 = OpCodes.XorN(OpCodes.XorN(t3, a3), s[68]);

      for (let i = 287; i > 177; i--) s[i] = s[i - 1];
      s[177] = f2;
      for (let i = 176; i > 93; i--) s[i] = s[i - 1];
      s[93] = f1;
      for (let i = 92; i > 0; i--) s[i] = s[i - 1];
      s[0] = f3;

      return OpCodes.XorN(OpCodes.XorN(t1, t2), t3);
    }

    // Produces the next 32 keystream bits and stores them, bit order REVERSED
    // within the 32-bit group (matching this implementation's word-parallel output packing).
    _fillPending() {
      const block = [];
      for (let i = 0; i < 32; i++) block.push(this._clock());
      block.reverse();
      for (let _i = 0; _i < block.length; _i++) this._pendingBits.push(block[_i]);
    }

    _nextKeystreamByte() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        if (this._pendingBits.length === 0) this._fillPending();
        const bit = this._pendingBits.shift();
        byte = OpCodes.OrN(byte, OpCodes.Shl32(bit, i));
      }
      return byte;
    }
  }

  const algorithmInstance = new DarkCryptTriviumAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptTriviumAlgorithm, DarkCryptTriviumInstance };
}));
