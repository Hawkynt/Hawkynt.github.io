/*
 * Fubuki (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Fubuki is a stream/block cipher published in 2005 by Makoto Matsumoto,
 * Takuji Nishimura, Mariko Hagita and Mutsuo Saito (the same team behind the
 * Mersenne Twister PRNG), submitted alongside CryptMT to the eSTREAM project.
 * Its "mother generator" is an untempered Mersenne Twister (MT19937): the
 * key and initial value are concatenated and fed through MT19937's
 * array-seeding procedure, and the raw (untempered) 32-bit words it produces
 * drive every random choice made by the cipher -- which primitive encryption
 * function to apply, and its parameters.
 *
 * Each 128-bit block (four 32-bit words) is transformed by four rounds. Each
 * round applies one of four word-wise primitive functions (multiply-based
 * diffusion within a word, combined with a small feedback into a neighboring
 * word), one of four inter-word primitive functions (which mix pairs of
 * words together through multiplication and exclusive-or), and a fixed
 * vertical-rotate step that permutes bit rows across the whole block. Every
 * primitive function draws its own parameters from the Mersenne Twister, so
 * a single block consumes many times its own size in generator output --
 * the design's main defense against reconstructing the generator's state
 * from known plaintext/ciphertext pairs.
 *
 * This file follows the cipher's published reference description exactly
 * (word offsets, bit-shift amounts, the untempered generator, and the
 * table-preparation quirks it defines) with the block size fixed at four
 * words and four rounds per block, as in the reference default. The
 * DarkCrypt Total Commander plugin (Alexander Myasnikov, "Zarya" project)
 * ships this cipher under the name "Fubuki (512 bit)" with both the key and
 * the initial value fixed at 512 bits (64 bytes) -- both are concatenated
 * and passed to the generator's seeding procedure exactly as the reference
 * description specifies for arbitrary-length keys and initial values.
 *
 * Unlike a plain exclusive-or stream cipher, Fubuki's "encrypt" operation
 * mixes the plaintext directly into the primitive functions of each block
 * (it is explicitly designed to double as a block cipher); running it over
 * an all-zero buffer reproduces the keystream in the ordinary sense, which
 * is how the test vectors below were captured.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== Mersenne Twister (MT19937) parameters, untempered output =====
  const MT_N = 624, MT_M = 397;
  const MT_MATRIX_A = 0x9908B0DF;
  const MT_UPPER_MASK = 0x80000000;
  const MT_LOWER_MASK = 0x7FFFFFFF;

  // ===== Fubuki block/round parameters (reference defaults) =====
  const TUPLE = 4;          // words per block (128-bit block)
  const LOG_TUPLE = 2;
  const LOW_MASK = TUPLE - 1;
  const ITERATION = 4;      // rounds per block
  const MULTI_SIZE = 32;    // size of the multiplier table
  const LOG_ADD_SIZE = 5;
  const ADD_SIZE = 32;      // size of the additive-feedback table

  class MersenneTwister19937 {
    constructor() {
      this.mt = new Uint32Array(MT_N);
      this.mti = MT_N + 1;
    }

    initGenrand(seed) {
      this.mt[0] = OpCodes.ToUint32(seed);
      for (this.mti = 1; this.mti < MT_N; this.mti++) {
        const prev = this.mt[this.mti - 1];
        this.mt[this.mti] = OpCodes.ToUint32(OpCodes.Mul32(1812433253, OpCodes.Xor32(prev, OpCodes.Shr32(prev, 30))) + this.mti);
      }
    }

    // Array-seeding scheme (2002 revision): accepts a key of arbitrary word length.
    initByArray(initKey) {
      const keyLength = initKey.length;
      this.initGenrand(19650218);
      let i = 1, j = 0;
      let k = (MT_N > keyLength ? MT_N : keyLength);
      for (; k; k--) {
        const prev = this.mt[i - 1];
        this.mt[i] = OpCodes.Xor32(this.mt[i], OpCodes.Mul32(OpCodes.Xor32(prev, OpCodes.Shr32(prev, 30)), 1664525));
        this.mt[i] = OpCodes.ToUint32(this.mt[i] + initKey[j] + j);
        i++; j++;
        if (i >= MT_N) { this.mt[0] = this.mt[MT_N - 1]; i = 1; }
        if (j >= keyLength) j = 0;
      }
      for (k = MT_N - 1; k; k--) {
        const prev = this.mt[i - 1];
        this.mt[i] = OpCodes.Xor32(this.mt[i], OpCodes.Mul32(OpCodes.Xor32(prev, OpCodes.Shr32(prev, 30)), 1566083941));
        this.mt[i] = OpCodes.ToUint32(this.mt[i] - i);
        i++;
        if (i >= MT_N) { this.mt[0] = this.mt[MT_N - 1]; i = 1; }
      }
      this.mt[0] = 0x80000000;
    }

    // Raw 32-bit output word, WITHOUT the tempering transform: Fubuki's authors
    // removed tempering, relying on the cipher's own nonlinear mixing instead.
    nextRaw() {
      const mt = this.mt;
      if (this.mti >= MT_N) {
        let kk;
        for (kk = 0; kk < MT_N - MT_M; kk++) {
          const y = OpCodes.Or32(OpCodes.And32(mt[kk], MT_UPPER_MASK), OpCodes.And32(mt[kk + 1], MT_LOWER_MASK));
          mt[kk] = OpCodes.Xor32(OpCodes.Xor32(mt[kk + MT_M], OpCodes.Shr32(y, 1)), (OpCodes.And32(y, 1) ? MT_MATRIX_A : 0));
        }
        for (; kk < MT_N - 1; kk++) {
          const y = OpCodes.Or32(OpCodes.And32(mt[kk], MT_UPPER_MASK), OpCodes.And32(mt[kk + 1], MT_LOWER_MASK));
          mt[kk] = OpCodes.Xor32(OpCodes.Xor32(mt[kk + (MT_M - MT_N)], OpCodes.Shr32(y, 1)), (OpCodes.And32(y, 1) ? MT_MATRIX_A : 0));
        }
        const y = OpCodes.Or32(OpCodes.And32(mt[MT_N - 1], MT_UPPER_MASK), OpCodes.And32(mt[0], MT_LOWER_MASK));
        mt[MT_N - 1] = OpCodes.Xor32(OpCodes.Xor32(mt[MT_M - 1], OpCodes.Shr32(y, 1)), (OpCodes.And32(y, 1) ? MT_MATRIX_A : 0));
        this.mti = 0;
      }
      return mt[this.mti++];
    }

    nextTuple(len) {
      const out = new Uint32Array(len);
      for (let i = 0; i < len; i++) out[i] = this.nextRaw();
      return out;
    }
  }

  // Multiplicative inverse modulo 2^32 (needed to invert the multiply step of
  // each word-wise primitive function when decoding).
  function invMod32(m) {
    m = OpCodes.ToUint32(m);
    let inv = OpCodes.ToUint32(1);
    for (let i = 30; i >= 0; i--) {
      const t = OpCodes.ToUint32(OpCodes.Mul32(inv, m) - 1);
      if ((OpCodes.Shl32(t, i)) !== 0) inv = OpCodes.Or32(inv, OpCodes.Shl32(1, (32 - i - 1)));
    }
    return OpCodes.ToUint32(inv);
  }

  class DarkCryptFubukiAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Fubuki (DarkCrypt)";
      this.description = "Fubuki stream/block cipher built on an untempered Mersenne Twister (MT19937) generator: the key and initial value seed MT19937, whose raw output words pseudorandomly select and parameterize nine primitive encryption functions (four word-wise, four inter-word, one vertical-rotate) applied over four rounds per 128-bit block. DarkCrypt's \"Fubuki (512 bit)\" build fixes both the key and the initial value at 512 bits.";
      this.inventor = "Makoto Matsumoto, Takuji Nishimura, Mariko Hagita, Mutsuo Saito; DarkCrypt build by Alexander Myasnikov";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedNonceSizes = [new KeySize(64, 64, 0)]; // fixed 512-bit initial value

      this.documentation = [
        new LinkItem("Mersenne Twister and Fubuki Stream/Block Cipher (original eSTREAM submission)", "https://cr.yp.to/streamciphers/fubuki/desc.pdf"),
        new LinkItem("Cryptographic Mersenne Twister and Fubuki Stream/Block Cipher (extended version, IACR ePrint 2005/165)", "https://eprint.iacr.org/2005/165.pdf"),
        new LinkItem("eSTREAM CryptMT/Fubuki submission page", "https://www.ecrypt.eu.org/stream/cryptmtfubuki.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt / Zarya Total Commander plugin", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [];

      // Test vectors generated from the published DarkCrypt "Fubuki (512 bit)" build
      // (raw primitive: setup(key,iv) + crypt(buf,buf,len), an in-place block encoding).
      this.tests = [
        {
          text: "DarkCrypt Fubuki - 512-bit key, zero initial value, 128 zero bytes",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: new Array(64).fill(0),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("e7a824ba3c50c8a7d88a534fae0aeacf32a9e53a484b1ffd549ad8c24a1538e44ca2fcbc3d3d07d4f66238ec0786188ad559f1865b4d15937667934eef3dd1e283597c6c1792b3c0ac235173e4099100617534faf737aa1bcdbe8c3e2cdcf6dd8491da13d6b8da73868d5398f794d5eac3df453d348b4efcec187694bbd13882")
        },
        {
          text: "DarkCrypt Fubuki - 512-bit key, zero initial value, incrementing 64-byte input (fresh setup)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: new Array(64).fill(0),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("f8876dc89d3331a7bef5e9dcf2860402b6a9a38864cbf13d65df3c30e312a643c33516aa4d26eb44a44680d36582da86de579aea2e88eeb788343c2991b9f07f")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptFubukiInstance(this, isInverse);
    }
  }

  class DarkCryptFubukiInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Fubuki (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length !== 64)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Fubuki (DarkCrypt) requires exactly 64 bytes`);
      this._iv = [...ivBytes];
      if (this._key) this._initialize();
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._iv) throw new Error("IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data to process");
      if (!this.initialized) throw new Error("Fubuki (DarkCrypt) not properly initialized");

      const output = this._process(this.inputBuffer, this.isInverse);
      this.inputBuffer = [];
      return output;
    }

    // ===== Fubuki core =====

    _initialize() {
      if (!this._key || !this._iv) return;

      this.mt = new MersenneTwister19937();
      this.multiTable = new Uint32Array(MULTI_SIZE);
      this.invTable = new Uint32Array(MULTI_SIZE);
      this.addTable = new Uint32Array(ADD_SIZE);
      this.jump = 0;

      const initWords = this._bytesToWordsLE(this._key).concat(this._bytesToWordsLE(this._iv));
      this.mt.initByArray(Uint32Array.from(initWords));

      this._prepareMultiTable();
      this._prepareInvTable();
      this._prepareAddTable();

      this.initialized = true;
    }

    _bytesToWordsLE(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 4)
        words.push(OpCodes.Pack32LE(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]));
      return words;
    }

    _prepareMultiTable() {
      const w = this.mt.nextTuple(MULTI_SIZE);
      for (let i = 0; i < MULTI_SIZE; i++) this.multiTable[i] = w[i];
      for (let i = 0; i < MULTI_SIZE; i += 2) {
        let a = this.multiTable[i];
        a = OpCodes.Or32(OpCodes.And32(a, 0xfffffff8), 0x3);
        a = OpCodes.Or32(a, OpCodes.Shr32(0x80000000, (i % 8)));
        a = OpCodes.And32(a, (~OpCodes.Shr32(0x40000000, (i % 8))));
        this.multiTable[i] = a;

        // The odd-indexed multiplier's shift amount is i+1 (not (i+1) mod 8) --
        // preserved exactly as the published reference computes it.
        let b = this.multiTable[i + 1];
        const shiftOdd = i + 1;
        b = OpCodes.Or32(OpCodes.And32(b, 0xfffffff0), 0x7);
        b = OpCodes.Or32(b, OpCodes.Shr32(0x80000000, shiftOdd));
        b = OpCodes.And32(b, (~OpCodes.Shr32(0x40000000, shiftOdd)));
        this.multiTable[i + 1] = b;
      }
    }

    _prepareInvTable() {
      for (let i = 0; i < MULTI_SIZE; i++) this.invTable[i] = invMod32(this.multiTable[i]);
    }

    _prepareAddTable() {
      const w = this.mt.nextTuple(ADD_SIZE);
      for (let i = 0; i < ADD_SIZE; i++) this.addTable[i] = w[i];
      for (let i = 0; i < ADD_SIZE; i++) {
        let s = OpCodes.And32(i * 1103515245 + 12345, ADD_SIZE - 1);
        s ^= OpCodes.Shr32(s, Math.floor(LOG_ADD_SIZE / 2));
        let at = this.addTable[i];
        at = OpCodes.Shl32(at, LOG_ADD_SIZE);
        at = OpCodes.Or32(at, s);
        this.addTable[i] = at;
      }
    }

    // ---- word-wise primitive encryption functions ----

    _empr(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], param[i]);
        block[i] = OpCodes.Mul32(block[i], this.multiTable[OpCodes.Shr32(param[(i + 1) % TUPLE], 27)]);
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.ToUint32(block[idx] + this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Or32(OpCodes.Shl32((~block[i]), (32 - s)), OpCodes.Shr32(block[i], s));
      }
    }
    _emprInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Or32(OpCodes.Shr32((~block[i]), (32 - s)), OpCodes.Shl32(block[i], s));
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.ToUint32(block[idx] - this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Mul32(block[i], this.invTable[OpCodes.Shr32(param[(i + 1) % TUPLE], 27)]);
        block[i] = OpCodes.Xor32(block[i], param[i]);
      }
    }

    _emer(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], param[i]);
        block[i] = OpCodes.Mul32(block[i], this.multiTable[OpCodes.Shr32(param[(i + 2) % TUPLE], 27)]);
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.Xor32(block[idx], this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Or32(OpCodes.Shl32((~block[i]), (32 - s)), OpCodes.Shr32(block[i], s));
      }
    }
    _emerInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Or32(OpCodes.Shr32((~block[i]), (32 - s)), OpCodes.Shl32(block[i], s));
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.Xor32(block[idx], this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Mul32(block[i], this.invTable[OpCodes.Shr32(param[(i + 2) % TUPLE], 27)]);
        block[i] = OpCodes.Xor32(block[i], param[i]);
      }
    }

    _emps(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], param[i]);
        block[i] = OpCodes.Mul32(block[i], this.multiTable[OpCodes.Shr32(param[(i + 2) % TUPLE], 27)]);
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.ToUint32(block[idx] + this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32((~block[i]), s));
      }
    }
    _empsInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32((~block[i]), s));
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.ToUint32(block[idx] - this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Mul32(block[i], this.invTable[OpCodes.Shr32(param[(i + 2) % TUPLE], 27)]);
        block[i] = OpCodes.Xor32(block[i], param[i]);
      }
    }

    _emes(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], param[i]);
        block[i] = OpCodes.Mul32(block[i], this.multiTable[OpCodes.Shr32(param[(i + 3) % TUPLE], 27)]);
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.Xor32(block[idx], this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32((~block[i]), s));
      }
    }
    _emesInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[i], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32((~block[i]), s));
        const idx = OpCodes.And32((i + this.jump), LOW_MASK);
        block[idx] = OpCodes.Xor32(block[idx], this.addTable[OpCodes.Shr32(block[i], 32 - LOG_ADD_SIZE)]);
        block[i] = OpCodes.Mul32(block[i], this.invTable[OpCodes.Shr32(param[(i + 3) % TUPLE], 27)]);
        block[i] = OpCodes.Xor32(block[i], param[i]);
      }
    }

    // ---- inter-word primitive encryption functions ----

    _ma(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[j], 28), 0x10), 0x17);
        block[i] = OpCodes.ToUint32(block[i] + OpCodes.Mul32(block[j], param[i]));
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32((~block[i]), s));
      }
    }
    _maInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        const s = OpCodes.And32(OpCodes.Or32(OpCodes.Shr32(param[j], 28), 0x10), 0x17);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32((~block[i]), s));
        block[i] = OpCodes.ToUint32(block[i] - OpCodes.Mul32(block[j], param[i]));
      }
    }

    _mem(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        let k = OpCodes.Shr32(param[j], 32 - LOG_TUPLE);
        if (k === i) k = OpCodes.And32((k - 1), LOW_MASK);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Mul32(block[j], block[k]));
        block[i] = OpCodes.ToUint32(block[i] - param[i]);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32(block[i], 16));
      }
    }
    _memInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        let k = OpCodes.Shr32(param[j], 32 - LOG_TUPLE);
        if (k === i) k = OpCodes.And32((k - 1), LOW_MASK);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32(block[i], 16));
        block[i] = OpCodes.ToUint32(block[i] + param[i]);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Mul32(block[j], block[k]));
      }
    }

    _ome(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        let k = OpCodes.Shr32(param[j], 32 - LOG_TUPLE);
        if (k === i) k = OpCodes.And32((k - 1), LOW_MASK);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Mul32(OpCodes.Or32(block[k], param[i]), block[j]));
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32(block[i], 16));
      }
    }
    _omeInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        let k = OpCodes.Shr32(param[j], 32 - LOG_TUPLE);
        if (k === i) k = OpCodes.And32((k - 1), LOW_MASK);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32(block[i], 16));
        block[i] = OpCodes.Xor32(block[i], OpCodes.Mul32(OpCodes.Or32(block[k], param[i]), block[j]));
      }
    }

    _eme(block) {
      const param = this.mt.nextTuple(TUPLE);
      for (let i = 0; i < TUPLE; i++) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        let k = OpCodes.Shr32(param[j], 32 - LOG_TUPLE);
        if (k === i) k = OpCodes.And32((k - 1), LOW_MASK);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Mul32(OpCodes.Xor32(block[k], param[i]), block[j]));
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32(block[i], 17));
      }
    }
    _emeInv(block, param) {
      for (let i = TUPLE - 1; i >= 0; i--) {
        const j = OpCodes.And32((i - this.jump), LOW_MASK);
        let k = OpCodes.Shr32(param[j], 32 - LOG_TUPLE);
        if (k === i) k = OpCodes.And32((k - 1), LOW_MASK);
        block[i] = OpCodes.Xor32(block[i], OpCodes.Shr32(block[i], 17));
        block[i] = OpCodes.Xor32(block[i], OpCodes.Mul32(OpCodes.Xor32(block[k], param[i]), block[j]));
      }
    }

    // ---- vertical-rotate primitive (cuts off within-word bit relations) ----

    _vertRotate(block) {
      const jumpOdd = OpCodes.Or32((this.jump - 1), 0x1);
      const param = this.mt.nextTuple(TUPLE);
      const key = OpCodes.ToUint32(OpCodes.Shl32((param[0] + param[TUPLE - 1]), 2) + 1);
      const rkey = OpCodes.ToUint32(~key);
      const s0 = block[0];
      let j = 0;
      for (let i = 0; i < TUPLE; i++) {
        const u = OpCodes.And32((j - jumpOdd), LOW_MASK);
        block[j] = OpCodes.Or32(OpCodes.And32(block[j], rkey), OpCodes.And32(OpCodes.ToUint32(~block[u]), key));
        j = u;
      }
      block[j] = OpCodes.Or32(OpCodes.And32(block[j], rkey), OpCodes.And32(OpCodes.ToUint32(~s0), key));
      for (let i = 0; i < TUPLE; i++) block[i] = OpCodes.ToUint32(block[i] + param[i]);
    }

    _vertRotateInv(block, param) {
      const jumpOdd = OpCodes.Or32((this.jump - 1), 0x1);
      for (let i = 0; i < TUPLE; i++) block[i] = OpCodes.ToUint32(block[i] - param[i]);
      const key = OpCodes.ToUint32(OpCodes.Shl32((param[0] + param[TUPLE - 1]), 2) + 1);
      const rkey = OpCodes.ToUint32(~key);
      const s0 = block[0];
      let j = 0;
      for (let i = 0; i < TUPLE; i++) {
        const u = OpCodes.And32((j + jumpOdd), LOW_MASK);
        block[j] = OpCodes.Or32(OpCodes.And32(block[j], rkey), OpCodes.And32(OpCodes.ToUint32(~block[u]), key));
        j = u;
      }
      block[j] = OpCodes.Or32(OpCodes.And32(block[j], rkey), OpCodes.And32(OpCodes.ToUint32(~s0), key));
    }

    _applyWord(c, block) {
      switch (c) {
        case 0: this._empr(block); break;
        case 1: this._emer(block); break;
        case 2: this._emps(block); break;
        case 3: this._emes(block); break;
      }
    }
    _applyInter(c, block) {
      switch (c) {
        case 0: this._ma(block); break;
        case 1: this._mem(block); break;
        case 2: this._ome(block); break;
        case 3: this._eme(block); break;
      }
    }
    _applyWordInv(c, block, param) {
      switch (c) {
        case 0: this._emprInv(block, param); break;
        case 1: this._emerInv(block, param); break;
        case 2: this._empsInv(block, param); break;
        case 3: this._emesInv(block, param); break;
      }
    }
    _applyInterInv(c, block, param) {
      switch (c) {
        case 0: this._maInv(block, param); break;
        case 1: this._memInv(block, param); break;
        case 2: this._omeInv(block, param); break;
        case 3: this._emeInv(block, param); break;
      }
    }

    // Draws the four-word function-choice tuple, mixes it, and returns the
    // array whose most significant 16 bits select all eight (word/inter-word)
    // primitives used over the block's four rounds.
    _drawFuncChoice() {
      const funcChoice = this.mt.nextTuple(4);
      funcChoice[2] = OpCodes.Mul32(funcChoice[2], OpCodes.Or32(funcChoice[0], 1));
      funcChoice[3] = OpCodes.Mul32(funcChoice[3], OpCodes.Or32(funcChoice[1], 1));
      funcChoice[0] = OpCodes.Xor32(funcChoice[0], OpCodes.Shr32(funcChoice[3], 5));
      funcChoice[1] = OpCodes.Xor32(funcChoice[1], OpCodes.Shr32(funcChoice[2], 5));
      return funcChoice;
    }

    _encryptBlock(block) {
      const funcChoice = this._drawFuncChoice();
      this.jump = 1;

      let j = 0;
      while (j < 2 * ITERATION) {
        let t = OpCodes.Shr32(j, 4);
        let c = OpCodes.And32(OpCodes.Shr32(funcChoice[t], (OpCodes.And32(j, 0xf) * 2)), 0x3);
        j++;
        this._applyWord(c, block);
        this._bumpJump();

        t = OpCodes.Shr32(j, 4);
        c = OpCodes.And32(OpCodes.Shr32(funcChoice[t], (OpCodes.And32(j, 0xf) * 2)), 0x3);
        j++;
        this._applyInter(c, block);
        this._bumpJump();

        this._vertRotate(block);
        this._bumpJump();
      }
    }

    _decryptBlock(block) {
      const funcChoice = this._drawFuncChoice();

      const tempRand = [];
      for (let n = 0; n < 3 * ITERATION; n++) tempRand.push(this.mt.nextTuple(TUPLE));

      let k = 3 * ITERATION;
      this.jump = OpCodes.Shl32(1, ((3 * ITERATION - 1) % LOG_TUPLE));

      for (let j = 2 * ITERATION - 1; j >= 0; ) {
        let t = OpCodes.Shr32(j, 4);
        let c = OpCodes.And32(OpCodes.Shr32(funcChoice[t], (OpCodes.And32(j, 0xf) * 2)), 0x3);
        j--;

        this._vertRotateInv(block, tempRand[--k]);
        this._dropJump();

        this._applyInterInv(c, block, tempRand[--k]);
        this._dropJump();

        t = OpCodes.Shr32(j, 4);
        c = OpCodes.And32(OpCodes.Shr32(funcChoice[t], (OpCodes.And32(j, 0xf) * 2)), 0x3);
        j--;

        this._applyWordInv(c, block, tempRand[--k]);
        this._dropJump();
      }
    }

    _bumpJump() {
      this.jump = OpCodes.Shl32(this.jump, 1);
      if (this.jump >= TUPLE) this.jump = 1;
    }
    _dropJump() {
      this.jump = OpCodes.Shr32(this.jump, 1);
      if (this.jump === 0) this.jump = OpCodes.Shr32(TUPLE, 1);
    }

    _process(bytesIn, isInverse) {
      const blockBytes = 4 * TUPLE;
      const repeat = Math.ceil(bytesIn.length / blockBytes);
      const out = [];
      let pos = 0;
      for (let r = 0; r < repeat; r++) {
        const block = new Uint32Array(TUPLE);
        for (let i = 0; i < TUPLE; i++) {
          const b0 = bytesIn[pos + i * 4] || 0;
          const b1 = bytesIn[pos + i * 4 + 1] || 0;
          const b2 = bytesIn[pos + i * 4 + 2] || 0;
          const b3 = bytesIn[pos + i * 4 + 3] || 0;
          block[i] = OpCodes.Pack32LE(b0, b1, b2, b3);
        }
        if (isInverse) this._decryptBlock(block); else this._encryptBlock(block);
        for (let i = 0; i < TUPLE; i++) out.push(...OpCodes.Unpack32LE(block[i]));
        pos += blockBytes;
      }
      return out.slice(0, bytesIn.length);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptFubukiAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptFubukiAlgorithm, DarkCryptFubukiInstance };
}));
