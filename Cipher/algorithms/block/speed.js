/*
 * SPEED Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SPEED, by Yuliang Zheng, presented at Financial Cryptography '97 (Anguilla,
 * February 1997; LNCS 1318, pages 71-89). An unbalanced Feistel network over a
 * queue of eight words: each round derives one new word from a nonlinear
 * Boolean combination of the other seven, rotates it by an amount computed from
 * itself, adds the discarded tail word and a round key, and shifts the queue.
 *
 * Parameters (paper, section 2):
 *   - block width w of 64, 128 or 256 bits, always eight words of w/8 bits;
 *   - key length l, any multiple of 16 bits from 48 to 256;
 *   - round count r, any multiple of 4 that is at least 32. The paper's Table 1
 *     recommends r = 64 for w = 64 and r = 48 for w = 128 and w = 256; those are
 *     the defaults here, and both are overridable.
 * The rounds are split into four equal passes P1..P4, each with its own round
 * keys and its own Boolean function F1..F4.
 *
 * Round function (paper, section 2.1), with FULL = 2^(w/8)-1, HALF = 2^(w/16)-1:
 *     t7  = ROTR(t7, w/16 - 1)
 *     tmp = Fi(t6, t5, t4, t3, t2, t1, t0)
 *     vv  = SHR(SHR(tmp, w/16) + tmp AND HALF, VV_SHIFT)
 *     tmp = ROTR(tmp, vv)
 *     tmp = (t7 + tmp + Ki[j]) AND FULL
 *     (t7,t6,t5,t4,t3,t2,t1,t0) = (t6,t5,t4,t3,t2,t1,t0,tmp)
 * VV_SHIFT is 1, 4 and 11 for w = 64, 128 and 256, so vv covers the full 0..w/8-1
 * rotation range. All rotations are to the right.
 *
 * The four Boolean functions (paper, section 4.2), juxtaposition meaning AND and
 * every operation applied bit-slice across the word:
 *     f1 = x6x3 + x5x1 + x4x2 + x1x0 + x0
 *     f2 = x6x4x0 + x4x3x0 + x5x2 + x4x3 + x4x1 + x3x0 + x1
 *     f3 = x5x4x0 + x6x4 + x5x2 + x3x0 + x1x0 + x3
 *     f4 = x6x4x2x0 + x6x5 + x4x3 + x3x2 + x1x0 + x2
 *
 * Key schedule (paper, section 2.2): the key fills a run of 16-bit double-bytes
 * which is extended by a three-word nonlinear register seeded from constants
 * Q(l,0..2) taken from the fractional part of sqrt(15):
 *     T = majority(S2,S1,S0); T = ROTL16(T, 5); T = T + S2 + kb[i mod ldb]
 *     kb[i] = T; (S2,S1,S0) = (S1,S0,T)
 * NOTE: section 2.2 step 2(b) of the paper says "rotate T to the right by 5
 * bits" while the legend of its Figure 3 says a cyclic left shift by 5. The
 * figure is right: only the left rotation reproduces the paper's own
 * certification vectors. The double-bytes are then packed into round keys in
 * order and handed out as K1..K4, a quarter of the rounds each.
 *
 * BYTE ORDER: SPEED numbers everything from the least significant end while the
 * paper prints hex most significant first. So t7 is the FIRST word group of a
 * displayed block and t0 the last, bytes within a word are big-endian, and
 * kb[0] is the LAST double-byte of the key.
 *
 * Decryption runs the passes and their rounds backwards, recovering the
 * discarded tail word from the new head: subtract instead of add, and rotate
 * left instead of right. The key schedule is unchanged.
 *
 * Broken by Hall, Kelsey, Rijmen, Schneier and Wagner (SAC'98); educational only.
 */

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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====

  // Key-schedule seed constants Q(l, 0..2), from the fractional part of
  // sqrt(15), one triple per key length 48, 64, 80, ... 256 bits.
  const Q_CONSTANTS = [
    [0xDF7B, 0xD629, 0xE9DB], // l = 48
    [0x362F, 0x5D00, 0xF20F], // l = 64
    [0xC3D1, 0x1FD2, 0x589B], // l = 80
    [0x4312, 0x91EB, 0x718E], // l = 96
    [0xBF2A, 0x1E7D, 0xB257], // l = 112
    [0x77A6, 0x1654, 0x6B2A], // l = 128
    [0x0D9B, 0xA9D3, 0x668F], // l = 144
    [0x19BE, 0xF855, 0x6D98], // l = 160
    [0x022D, 0xE4E2, 0xD017], // l = 176
    [0xEA2F, 0x7572, 0xC3B5], // l = 192
    [0x1086, 0x480C, 0x3AA6], // l = 208
    [0x9CA0, 0x98F7, 0xD0E4], // l = 224
    [0x253C, 0xC901, 0x55F3], // l = 240
    [0x9BF4, 0xF659, 0xD76C]  // l = 256
  ];

  // Recommended round counts (paper, Table 1) keyed by block width in bits.
  const DEFAULT_ROUNDS = { 64: 64, 128: 48, 256: 48 };

  // ===== WORD HELPERS =====

  function rotL(value, amount, wordBits, fullMask) {
    const n = ((amount % wordBits) + wordBits) % wordBits;
    const masked = OpCodes.And32(value, fullMask);
    if (n === 0) return masked;
    return OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(masked, n), OpCodes.Shr32(masked, wordBits - n)), fullMask);
  }

  function rotR(value, amount, wordBits, fullMask) {
    const n = ((amount % wordBits) + wordBits) % wordBits;
    return rotL(value, wordBits - n, wordBits, fullMask);
  }

  // ===== BOOLEAN COMBINING FUNCTIONS (paper, section 4.2) =====
  // t[i] is x_i; t[7] never participates, it is folded in separately.

  function f1(t) {
    let r = OpCodes.And32(t[6], t[3]);
    r = OpCodes.Xor32(r, OpCodes.And32(t[5], t[1]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[4], t[2]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[1], t[0]));
    return OpCodes.Xor32(r, t[0]);
  }

  function f2(t) {
    let r = OpCodes.And32(OpCodes.And32(t[6], t[4]), t[0]);
    r = OpCodes.Xor32(r, OpCodes.And32(OpCodes.And32(t[4], t[3]), t[0]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[5], t[2]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[4], t[3]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[4], t[1]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[3], t[0]));
    return OpCodes.Xor32(r, t[1]);
  }

  function f3(t) {
    let r = OpCodes.And32(OpCodes.And32(t[5], t[4]), t[0]);
    r = OpCodes.Xor32(r, OpCodes.And32(t[6], t[4]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[5], t[2]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[3], t[0]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[1], t[0]));
    return OpCodes.Xor32(r, t[3]);
  }

  function f4(t) {
    let r = OpCodes.And32(OpCodes.And32(OpCodes.And32(t[6], t[4]), t[2]), t[0]);
    r = OpCodes.Xor32(r, OpCodes.And32(t[6], t[5]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[4], t[3]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[3], t[2]));
    r = OpCodes.Xor32(r, OpCodes.And32(t[1], t[0]));
    return OpCodes.Xor32(r, t[2]);
  }

  const PASS_FUNCTIONS = [f1, f2, f3, f4];

  // ===== ALGORITHM IMPLEMENTATION =====

  class SPEED extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SPEED";
      this.description = "Unbalanced Feistel network by Yuliang Zheng over a queue of eight words. Each round builds one new word from a nonlinear Boolean combination of the other seven, rotates it by an amount derived from itself, and folds in the discarded tail word and a round key. Block width 64, 128 or 256 bits; key any multiple of 16 bits from 48 to 256; round count any multiple of 4 from 32 up.";
      this.inventor = "Yuliang Zheng";
      this.year = 1997;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(6, 32, 2)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 1), new KeySize(16, 16, 1), new KeySize(32, 32, 1)];

      this.documentation = [
        new LinkItem("The SPEED Cipher (Financial Cryptography '97, LNCS 1318)", "https://ifca.ai/pub/fc97/m6.pdf")
      ];

      this.references = [
        new LinkItem("Cryptanalysis of SPEED (Hall, Kelsey, Rijmen, Schneier, Wagner; SAC'98)", "https://www.schneier.com/wp-content/uploads/2016/02/paper-speed-sac.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Broken by differential and related-key attacks", "Hall, Kelsey, Rijmen, Schneier and Wagner broke the cipher at every published parameter set, including a differential attack on the full 48-round 128-bit version.", "Use AES or another vetted cipher.")
      ];

      // The three certification vectors printed in the paper's own appendix,
      // "Certification Data for SPEED". Note the round counts: they use
      // r = w rather than the recommended values, so each vector sets its own.
      this.tests = [
        {
          text: "Paper certification data — w=64, l=64, r=64",
          uri: "https://ifca.ai/pub/fc97/m6.pdf",
          input: OpCodes.Hex8ToBytes('0000000000000000'),
          key: OpCodes.Hex8ToBytes('0000000000000000'),
          blockSize: 8,
          rounds: 64,
          expected: OpCodes.Hex8ToBytes('2e008019bc26856d')
        },
        {
          text: "Paper certification data — w=128, l=128, r=128",
          uri: "https://ifca.ai/pub/fc97/m6.pdf",
          input: OpCodes.Hex8ToBytes('ffffffffffffffffffffffffffffffff'),
          key: OpCodes.Hex8ToBytes('ffffffffffffffffffffffffffffffff'),
          blockSize: 16,
          rounds: 128,
          expected: OpCodes.Hex8ToBytes('6c13e4b9c3171571ab54d816915bc4e8')
        },
        {
          text: "Paper certification data — w=256, l=256, r=256",
          uri: "https://ifca.ai/pub/fc97/m6.pdf",
          input: OpCodes.Hex8ToBytes('1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100'),
          key: OpCodes.Hex8ToBytes('605f5e5d5c5b5a595857565554535251504f4e4d4c4b4a494847464544434241'),
          blockSize: 32,
          rounds: 256,
          expected: OpCodes.Hex8ToBytes('3de16cfa9a626847434e1574693fec1b3faa558a296b61d708b131ccba311068')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SPEEDInstance(this, isInverse);
    }
  }

  class SPEEDInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._blockSize = 16;   // bytes; w = 128 bits
      this._rounds = null;    // null means "use the recommended count for w"
      this._roundKeys = null;
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._roundKeys = null;
        this.KeySize = 0;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
        && (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = null; // rebuilt lazily: it depends on blockSize and rounds too
    }

    get key() { return this._key ? [...this._key] : null; }

    set blockSize(bytes) {
      if (bytes !== 8 && bytes !== 16 && bytes !== 32)
        throw new Error(`Invalid block size: ${bytes} bytes. SPEED supports 8, 16 or 32`);
      this._blockSize = bytes;
      this.BlockSize = bytes;
      this._roundKeys = null;
    }

    get blockSize() { return this._blockSize; }

    set rounds(count) {
      if (count === null || count === undefined) { this._rounds = null; this._roundKeys = null; return; }
      if (count < 32 || count % 4 !== 0)
        throw new Error(`Invalid round count: ${count}. SPEED requires a multiple of 4, at least 32`);
      this._rounds = count;
      this._roundKeys = null;
    }

    get rounds() { return this._rounds === null ? DEFAULT_ROUNDS[this._blockSize * 8] : this._rounds; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this._blockSize !== 0)
        throw new Error(`Input length must be a multiple of ${this._blockSize} bytes`);

      if (!this._roundKeys) this._roundKeys = this._expandKey();

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this._blockSize) {
        const block = this.inputBuffer.slice(i, i + this._blockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    // Geometry of the current parameter set.
    _shape() {
      const blockBits = this._blockSize * 8;
      const wordBits = blockBits / 8;            // 8, 16 or 32
      const wordBytes = wordBits / 8;            // 1, 2 or 4
      const fullMask = wordBits === 32 ? 0xFFFFFFFF : OpCodes.Shl32(1, wordBits) - 1;
      const halfBits = wordBits / 2;             // 4, 8 or 16
      const halfMask = OpCodes.Shl32(1, halfBits) - 1;
      // vv must span the whole 0..wordBits-1 rotation range, so the half-word is
      // shifted down to leave exactly log2(wordBits) bits: 1, 4 and 11.
      const vvShift = halfBits - Math.log2(wordBits);
      return { blockBits, wordBits, wordBytes, fullMask, halfBits, halfMask, vvShift, fixedRotate: halfBits - 1 };
    }

    _expandKey() {
      const { blockBits, wordBits, fullMask } = this._shape();
      const rounds = this.rounds;
      const keyBits = this._key.length * 8;
      const ldb = keyBits / 16;                  // key length in 16-bit double-bytes
      const q = Q_CONSTANTS[(keyBits - 48) / 16];
      if (!q) throw new Error(`No key-schedule constants for a ${keyBits}-bit key`);

      // Number of double-bytes the round keys consume.
      const last = blockBits === 64 ? rounds / 2 : (blockBits === 128 ? rounds : rounds * 2);

      // Step 1: the key itself, read from the least significant end - kb[0] is
      // the LAST double-byte printed, kb[ldb-1] the first.
      const kb = new Array(Math.max(last, ldb));
      for (let i = 0; i < ldb; ++i) {
        const at = (ldb - 1 - i) * 2;
        kb[i] = OpCodes.Or32(OpCodes.Shl32(this._key[at], 8), this._key[at + 1]);
      }

      // Step 2: extend with the nonlinear register.
      let s0 = q[0], s1 = q[1], s2 = q[2];
      for (let i = ldb; i < last; ++i) {
        const majority = OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(s2, s1), OpCodes.And32(s1, s0)), OpCodes.And32(s0, s2));
        const rotated = rotL(majority, 5, 16, 0xFFFF);
        const next = OpCodes.And32(OpCodes.Add32(OpCodes.Add32(rotated, s2), kb[i % ldb]), 0xFFFF);
        kb[i] = next;
        s2 = s1; s1 = s0; s0 = next;
      }

      // Step 3: pack the double-byte stream into round keys, least significant
      // double-byte first within a word.
      const rk = new Array(rounds);
      if (wordBits === 8) {
        for (let i = 0; i < rounds / 2; ++i) {
          rk[2 * i] = OpCodes.And32(kb[i], 0xFF);
          rk[2 * i + 1] = OpCodes.And32(OpCodes.Shr32(kb[i], 8), 0xFF);
        }
      } else if (wordBits === 16) {
        for (let i = 0; i < rounds; ++i) rk[i] = kb[i];
      } else {
        for (let i = 0; i < rounds; ++i)
          rk[i] = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(kb[2 * i + 1], 16), kb[2 * i]), fullMask);
      }
      return rk;
    }

    // t7 is the FIRST word group of the block and t0 the last; bytes within a
    // word are big-endian.
    _loadBlock(block) {
      const { wordBytes, fullMask } = this._shape();
      const t = new Array(8);
      for (let i = 0; i < 8; ++i) {
        const at = (7 - i) * wordBytes;
        let value = 0;
        for (let b = 0; b < wordBytes; ++b) value = OpCodes.Or32(OpCodes.Shl32(value, 8), block[at + b]);
        t[i] = OpCodes.And32(value, fullMask);
      }
      return t;
    }

    _storeBlock(t) {
      const { wordBytes } = this._shape();
      const out = new Array(this._blockSize);
      for (let i = 0; i < 8; ++i) {
        const at = (7 - i) * wordBytes;
        for (let b = 0; b < wordBytes; ++b)
          out[at + b] = OpCodes.And32(OpCodes.Shr32(t[i], (wordBytes - 1 - b) * 8), 0xFF);
      }
      return out;
    }

    _encryptBlock(block) {
      const { wordBits, fullMask, halfBits, halfMask, vvShift, fixedRotate } = this._shape();
      const rk = this._roundKeys;
      const rounds = this.rounds;
      const perPass = rounds / 4;
      let t = this._loadBlock(block);

      for (let n = 0; n < rounds; ++n) {
        const combine = PASS_FUNCTIONS[Math.floor(n / perPass)];
        const tail = rotR(t[7], fixedRotate, wordBits, fullMask);
        let tmp = OpCodes.And32(combine(t), fullMask);
        const vv = OpCodes.Shr32(OpCodes.And32(OpCodes.Add32(OpCodes.Shr32(tmp, halfBits), tmp), halfMask), vvShift);
        tmp = rotR(tmp, vv, wordBits, fullMask);
        const head = OpCodes.And32(OpCodes.Add32(OpCodes.Add32(tail, tmp), rk[n]), fullMask);
        t = [head, t[0], t[1], t[2], t[3], t[4], t[5], t[6]];
      }

      return this._storeBlock(t);
    }

    _decryptBlock(block) {
      const { wordBits, fullMask, halfBits, halfMask, vvShift, fixedRotate } = this._shape();
      const rk = this._roundKeys;
      const rounds = this.rounds;
      const perPass = rounds / 4;
      let t = this._loadBlock(block);

      for (let n = rounds - 1; n >= 0; --n) {
        // Everything except the tail word is simply the queue shifted back one
        // place; the tail is what the round consumed into the new head.
        const previous = [t[1], t[2], t[3], t[4], t[5], t[6], t[7], 0];
        const combine = PASS_FUNCTIONS[Math.floor(n / perPass)];
        let tmp = OpCodes.And32(combine(previous), fullMask);
        const vv = OpCodes.Shr32(OpCodes.And32(OpCodes.Add32(OpCodes.Shr32(tmp, halfBits), tmp), halfMask), vvShift);
        tmp = rotR(tmp, vv, wordBits, fullMask);
        const tail = OpCodes.And32(OpCodes.Sub32(OpCodes.Sub32(t[0], tmp), rk[n]), fullMask);
        previous[7] = rotL(tail, fixedRotate, wordBits, fullMask);
        t = previous;
      }

      return this._storeBlock(t);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SPEED();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SPEED, SPEEDInstance };
}));
