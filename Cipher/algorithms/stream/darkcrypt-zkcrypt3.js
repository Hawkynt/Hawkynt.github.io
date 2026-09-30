/*
 * ZK-Crypt v3 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ZK-Crypt v3 as implemented in the DarkCrypt Total Commander plugin.
 * ZK-Crypt is the eSTREAM Profile II (hardware) "Variable
 * Clocking Mechanism" (VCM) stream cipher submitted by Carmi Gressel et al.
 * (FortressGB). It combines four irregularly-clocked non-linear feedback
 * shift register (nLFSR) banks — "top" (13+19 bit), "middle" (18+14 bit) and
 * "bottom" (15+17 bit) data banks plus three independent small nLFSR clock
 * generators (3, 5 and 6 bit) and a 9-bit "long" / 2-bit "short" pseudo-random
 * clock — with two 32-entry substitution/permutation hash matrices and a
 * cipher/MAC feedback network to produce a 32-bit keystream word per cycle.
 *
 * Cross-checked line-by-line against the public eSTREAM ZK-Crypt v3 reference
 * source (ZKengine.c/ZKdef.h/ZKengine.h, ver 3.00, 25 Jun 2006). Three
 * deviations from a literal transcription of that reference source were
 * needed to reproduce the DarkCrypt keystream exactly:
 *
 *  1. The "Super tier" nLFSR bank (a third, 16-bit, optionally-mixed-in
 *     hash-domain generator gated by a compile-time ZK_OPTI_SUPER flag in
 *     the reference source) is not enabled in this variant: its state field
 *     stays permanently zero and it never contributes to the keystream.
 *     This build therefore only ever runs the "2 tiers always on" mode
 *     without the Super tier, and that code path is omitted here.
 *  2. Two boolean-looking expressions in the reference's clock-control
 *     logic ("fInvBrnMaj" and "fNotPRandom") are written as a bitwise NOT
 *     combined with C's truthiness-based logical AND, over an operand that
 *     is always exactly 0 or 1. Because bitwise-NOT of a 0/1 value is never
 *     the all-zero-bits pattern, both expressions are — bit for bit, as
 *     actually compiled — permanently 1, not the naive "flip the low bit"
 *     interpretation a literal-bitwise translation would produce.
 *  3. The per-cycle "delayedBuffer" latch (control bits telling each bank
 *     whether to clock/perform a Brownian step/slip next cycle) is never
 *     cleared once the context is created — its bits only ever accumulate
 *     via bitwise-OR across the lifetime of a key/IV session, saturating
 *     to all-ones after a handful of cycles. There is no per-cycle reset.
 *
 * 160-bit (20-byte) key, 128-bit (16-byte) IV: key setup uses a fixed
 * keysize=160/ivsize=128, and bytes 16..19 of the IV buffer are never read
 * regardless of their contents. Educational only.
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

  // ======================================================================
  // ZK-Crypt v3 engine constants (from the eSTREAM reference ZKengine.h)
  // ======================================================================

  // nLFSR register bit-lengths: [R1,1(13), R1,2(19), R2,1(18), R2,2(14), R3,1(15), R3,2(17)]
  /** @type {uint8[]} */
  const NLFSR_LEN = [13, 19, 18, 14, 15, 17];
  const DEF_13 = 0, DEF_19 = 1, DEF_18 = 2, DEF_14 = 3, DEF_15 = 4, DEF_17 = 5;

  // Feedback tap masks, one per register above
  /** @type {uint32[]} */
  const NLFSR_MASK = [
    OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(1, 0), OpCodes.Shl32(1, 3)), OpCodes.Shl32(1, 4)), OpCodes.Shl32(1, 6)), OpCodes.Shl32(1, 9)), OpCodes.Shl32(1, 10)),
    OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(1, 0), OpCodes.Shl32(1, 2)), OpCodes.Shl32(1, 5)), OpCodes.Shl32(1, 7)), OpCodes.Shl32(1, 8)), OpCodes.Shl32(1, 9)), OpCodes.Shl32(1, 10)), OpCodes.Shl32(1, 12)), OpCodes.Shl32(1, 15)), OpCodes.Shl32(1, 17)),
    OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(1, 0), OpCodes.Shl32(1, 3)), OpCodes.Shl32(1, 5)), OpCodes.Shl32(1, 7)), OpCodes.Shl32(1, 8)), OpCodes.Shl32(1, 11)), OpCodes.Shl32(1, 12)), OpCodes.Shl32(1, 13)), OpCodes.Shl32(1, 14)), OpCodes.Shl32(1, 16)),
    OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(1, 0), OpCodes.Shl32(1, 2)), OpCodes.Shl32(1, 5)), OpCodes.Shl32(1, 6)), OpCodes.Shl32(1, 9)), OpCodes.Shl32(1, 11)),
    OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(1, 0), OpCodes.Shl32(1, 1)), OpCodes.Shl32(1, 2)), OpCodes.Shl32(1, 6)), OpCodes.Shl32(1, 7)), OpCodes.Shl32(1, 11)),
    OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(1, 0), OpCodes.Shl32(1, 2)), OpCodes.Shl32(1, 5)), OpCodes.Shl32(1, 8)), OpCodes.Shl32(1, 10)), OpCodes.Shl32(1, 11)), OpCodes.Shl32(1, 13)), OpCodes.Shl32(1, 14))
  ];

  // Hash-matrix bit-permutation tables and the MAC-feedback nibble mixer
  /** @type {uint8[]} */
  const HASH_TABLE_A = [9, 18, 5, 11, 22, 12, 30, 19, 7, 15, 31, 25, 28, 24, 6, 3, 17, 13, 27, 23, 1, 2, 26, 21, 4, 20, 8, 16, 0, 14, 10, 29];
  /** @type {uint8[]} */
  const HASH_TABLE_B = [30, 15, 6, 12, 25, 18, 16, 9, 19, 7, 3, 31, 0, 29, 27, 21, 14, 28, 24, 17, 23, 5, 10, 2, 11, 22, 13, 26, 20, 8, 4, 1];
  /** @type {uint8[]} */
  const HASH_TABLE_C = [19, 7, 14, 29, 3, 27, 0, 13, 25, 16, 15, 30, 20, 1, 26, 31, 8, 6, 2, 4, 9, 18, 12, 10, 21, 11, 22, 5, 24, 23, 28, 17];
  /** @type {uint8[]} */
  const MAC_NIB_MIX = [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8, 15, 14, 13, 12, 19, 18, 17, 16, 23, 22, 21, 20, 27, 26, 25, 24, 31, 30, 29, 28];

  // nLFSR bank control bits
  const CTRL_NLFSR_CLOCK = 0x01, CTRL_NLFSR_LOAD = 0x02, CTRL_NLFSR_SLIP_LEFT = 0x04, CTRL_NLFSR_SLIP_RIGHT = 0x08,
        CTRL_NLFSR_BROWN = 0x10, CTRL_NLFSR_FB = 0x20;
  // feedback-network control bits
  const CTRL_FEEDBACK_ENABLE = 0x01, CTRL_FEEDBACK_RESET = 0x02, CTRL_FEEDBACK_MAC = 0x04,
        CTRL_FEEDBACK_CIPH = 0x08, CTRL_FEEDBACK_OUTPUT = 0x80;
  // hash-matrix selector/odd-nibble-mask control bits
  const CTRL_HASH_VECTOR_A = 0x01, CTRL_HASH_VECTOR_B = 0x02, CTRL_HASH_VECTOR_C = 0x04, CTRL_HASH_VECTOR_D = 0x08,
        CTRL_HASH_ODDN_TOP = 0x10, CTRL_HASH_ODDN_MID = 0x20, CTRL_HASH_ODDN_BOT = 0x40, CTRL_HASH_ODDN_4TH = 0x80;
  // top-level clocking control bits
  const CTRL_CLOCKS_LOAD = 0x02, CTRL_PRND_CLOCK = 0x01, CTRL_CLOCKS_SLIP = 0x20;
  // sticky "clock feedback" bit assignments (carried from one cycle into the next)
  const CTRL_CLOCKS_FB_Q12 = 0x0001, CTRL_CLOCKS_FB_Q18 = 0x0002, CTRL_CLOCKS_FB_Q13 = 0x0004, CTRL_CLOCKS_FB_Q17 = 0x0008,
        CTRL_CLOCKS_FB_Q14 = 0x0010, CTRL_CLOCKS_FB_Q16 = 0x0020, CTRL_CLOCKS_FB_THSH08 = 0x0040, CTRL_CLOCKS_FB_THSH15 = 0x0080,
        CTRL_CLOCKS_FB_THSH18 = 0x0100, CTRL_CLOCKS_FB_THSH31 = 0x0200, CTRL_CLOCKS_FB_JUGG = 0x0400, CTRL_CLOCKS_FB_DAS = 0x0800,
        CTRL_CLOCKS_FB_4TH = 0x1000, CTRL_CLOCKS_FB_ODDN_MID = 0x2000, CTRL_CLOCKS_FB_QTA = 0x4000;
  // small nLFSR-clock-generator output bits
  const OUTP_CLOCKS_BRN = 0x01, OUTP_CLOCKS_LFT_SLP = 0x02, OUTP_CLOCKS_RGT_SLP = 0x04, OUTP_CLOCKS_CTRL = 0x08;
  // next-cycle "delayed buffer" latch bits (see file header, deviation #3: only ever OR'd, never cleared)
  const DELAY_TOP_CLOCKS = 0x0001, DELAY_MID_CLOCKS = 0x0002, DELAY_BOT_CLOCKS = 0x0004, DELAY_TOP_BROWN = 0x0008,
        DELAY_MID_BROWN = 0x0010, DELAY_BOT_BROWN = 0x0020, DELAY_LH_SLIP = 0x0040, DELAY_RH_SLIP = 0x0080, DELAY_PR_SLIP = 0x0100;

  const KEY_SIZE_BITS = 160;
  const IV_SIZE_BITS = 128;

  // ======================================================================
  // Bit-twiddling helpers
  // ======================================================================

  /**
   * @param {uint32} x
   * @returns {uint32}
   */
  function u32(x) { return OpCodes.ToUint32(x); }
  /**
   * @param {uint32} a
   * @param {uint32} b
   * @param {uint32} c
   * @returns {uint32}
   */
  function maj32(a, b, c) { return u32(OpCodes.Or32(OpCodes.Or32(OpCodes.And32(a, b), OpCodes.And32(b, c)), OpCodes.And32(c, a))); }

  // True (1) when all tested bits [0 .. len-2] of value are zero (the "not fixed" test)
  /**
   * @param {uint32} value
   * @param {int32} len
   * @returns {uint32}
   */
  function nfix(value, len) {
    const mask = OpCodes.Sub32(OpCodes.Shl32(1, (len - 1)), 1);
    return OpCodes.And32(value, mask) === 0 ? 1 : 0;
  }

  /**
   * @param {uint32} value
   * @param {uint32} mask
   * @returns {uint32}
   */
  function bitAt(value, mask) { return OpCodes.And32(value, mask) !== 0 ? 1 : 0; }

  // 1-based single-bit getter matching the reference's GETBIT_ONE..GETBIT_NINE macros
  /**
   * @param {uint32} value
   * @param {int32} n
   * @returns {uint32}
   */
  function bit(value, n) { return OpCodes.And32(OpCodes.Shr32(value, (n - 1)), 1); }

  /**
   * @param {uint32} value
   * @returns {uint32}
   */
  function reverseBits32(value) {
    /** @type {uint32} */
    let res = 0;
    for (let i = 0; i < 32; i++) {
      res = u32(OpCodes.Shl32(res, 1));
      res = OpCodes.Or32(res, OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }
    return u32(res);
  }

  // ======================================================================
  // Engine state and core routines (module-private, operate on a plain
  // state object so the intricate bit-level logic stays a direct,
  // auditable transcription of the reference algorithm)
  // ======================================================================

  // Selectors for the three nLFSR data banks
  const BANK_TOP = 0, BANK_MID = 1, BANK_BOT = 2;

  // Complete engine state; every field is a 32-bit register or flag word
  class ZKCryptState {
    constructor() {
      /** @type {uint32} */
      this.upCphWrd_1 = 0;
      /** @type {uint32} */
      this.upCphWrd_2 = 0;
      /** @type {uint32} */
      this.upCphWrd_3 = 0;
      /** @type {uint32} */
      this.upCphWrd_4 = 0;
      /** @type {uint32} */
      this.upCphWrd_5 = 0;
      /** @type {uint32} */
      this.upIV_1 = 0;
      /** @type {uint32} */
      this.upIV_2 = 0;
      /** @type {uint32} */
      this.upIV_3 = 0;
      /** @type {uint32} */
      this.upIV_4 = 0;
      /** @type {uint32} */
      this.upIV_5 = 0;
      /** @type {int32} */
      this.keysize = 0;
      /** @type {int32} */
      this.ivsize = 0;
      /** @type {uint32} */
      this.sttTopBank = 0;
      /** @type {uint32} */
      this.sttMidBank = 0;
      /** @type {uint32} */
      this.sttBotBank = 0;
      /** @type {uint32} */
      this.sttFeedBack = 0;
      /** @type {uint32} */
      this.sttST_FeedBack = 0;
      /** @type {uint32} */
      this.fbA = 0;
      /** @type {uint32} */
      this.fbB = 0;
      /** @type {uint32} */
      this.fbC = 0;
      /** @type {uint32} */
      this.fbD = 0;
      /** @type {uint32} */
      this.sttTopXorNStore = 0;
      /** @type {uint32} */
      this.sttIntrXorNStore = 0;
      /** @type {uint32} */
      this.sttBotXorNStore = 0;
      /** @type {uint32} */
      this.sttTopHash = 0;
      /** @type {uint32} */
      this.sttBotHash = 0;
      /** @type {uint32} */
      this.sttClockFeedBack = 0;
      /** @type {uint32} */
      this.sttClockFeedBack_next = 0;
      /** @type {uint32} */
      this.ctrlTopBank = 0;
      /** @type {uint32} */
      this.ctrlMidBank = 0;
      /** @type {uint32} */
      this.ctrlBotBank = 0;
      /** @type {uint32} */
      this.ctrlFeedBack = 0;
      /** @type {uint32} */
      this.ctrlTopHashMatrix = 0;
      /** @type {uint32} */
      this.ctrlBotHashMatrix = 0;
      /** @type {uint32} */
      this.ctrlClocks = 0;
      /** @type {uint32} */
      this.topBankClock_nLFR = 0;
      /** @type {uint32} */
      this.topBankClockCounter = 0;
      /** @type {uint32} */
      this.topBankClock_MC = 0;
      /** @type {uint32} */
      this.midBankClock_nLFR = 0;
      /** @type {uint32} */
      this.midBankClockCounter = 0;
      /** @type {uint32} */
      this.midBankClock_MC = 0;
      /** @type {uint32} */
      this.botBankClock_nLFR = 0;
      /** @type {uint32} */
      this.botBankClockCounter = 0;
      /** @type {uint32} */
      this.botBankClock_MC = 0;
      /** @type {uint32} */
      this.hashCounter = 0;
      /** @type {uint32} */
      this.longPClock = 0;
      /** @type {uint32} */
      this.shortPClock = 0;
      /** @type {uint32} */
      this.lclMACstorage = 0;
      /** @type {uint32} */
      this.delayedBuffer = 0;
      /** @type {uint32} */
      this.F3 = 0;
      /** @type {uint32} */
      this.F4 = 0;
      /** @type {uint32} */
      this.F5 = 0;
      /** @type {uint32} */
      this.F6 = 0;
      /** @type {uint32} */
      this.F7 = 0;
      /** @type {uint32} */
      this.F8 = 0;
    }

    /**
     * @param {int32} bank - BANK_TOP, BANK_MID or BANK_BOT
     * @returns {uint32} that data bank's register
     */
    getBank(bank) {
      if (bank === BANK_TOP) return this.sttTopBank;
      if (bank === BANK_MID) return this.sttMidBank;
      return this.sttBotBank;
    }

    /**
     * @param {int32} bank - BANK_TOP, BANK_MID or BANK_BOT
     * @param {uint32} value - new register contents
     */
    setBank(bank, value) {
      if (bank === BANK_TOP) this.sttTopBank = value;
      else if (bank === BANK_MID) this.sttMidBank = value;
      else this.sttBotBank = value;
    }
  }

  /**
   * @returns {ZKCryptState}
   */
  function createState() {
    return new ZKCryptState();
  }

  // ZKengine(): resets all working (non-key, non-delayedBuffer, non-MAC-storage)
  // state. fZeroKeys additionally clears the loaded key/IV words.
  /**
   * @param {ZKCryptState} st
   * @param {boolean} fZeroKeys
   */
  function resetEngine(st, fZeroKeys) {
    if (fZeroKeys) {
      st.upCphWrd_1 = 0; st.upCphWrd_2 = 0; st.upCphWrd_3 = 0; st.upCphWrd_4 = 0; st.upCphWrd_5 = 0;
      st.upIV_1 = 0; st.upIV_2 = 0; st.upIV_3 = 0; st.upIV_4 = 0; st.upIV_5 = 0;
      st.keysize = 0;
    }
    st.sttTopBank = 0; st.sttMidBank = 0; st.sttBotBank = 0; st.sttFeedBack = 0; st.sttST_FeedBack = 0;
    st.fbA = 0; st.fbB = 0; st.fbC = 0; st.fbD = 0;
    st.sttTopXorNStore = 0; st.sttIntrXorNStore = 0; st.sttBotXorNStore = 0; st.sttTopHash = 0; st.sttBotHash = 0;
    st.sttClockFeedBack = 0; st.sttClockFeedBack_next = 0;
    st.ctrlTopBank = 0; st.ctrlMidBank = 0; st.ctrlBotBank = 0;
    st.ctrlFeedBack = 0; st.ctrlTopHashMatrix = 0; st.ctrlBotHashMatrix = 0; st.ctrlClocks = 0;
    st.topBankClock_nLFR = 0; st.topBankClockCounter = 0; st.topBankClock_MC = 0;
    st.midBankClock_nLFR = 0; st.midBankClockCounter = 0; st.midBankClock_MC = 0;
    st.botBankClock_nLFR = 0; st.botBankClockCounter = 0; st.botBankClock_MC = 0;
    st.hashCounter = 0; st.longPClock = 0; st.shortPClock = 0;
    // NOTE: delayedBuffer and lclMACstorage are deliberately NOT touched here —
    // see file header, deviation #3. lclMACstorage is only cleared by
    // feedbackStorage()'s CTRL_FEEDBACK_RESET branch.
  }

  /**
   * @param {ZKCryptState} st
   * @param {uint32} value
   * @returns {uint32}
   */
  function topXorNStore(st, value) {
    const stored = u32(OpCodes.Xor32(value, OpCodes.RotR32(st.sttFeedBack, 13)));
    const res = u32(OpCodes.Xor32(st.sttTopXorNStore, stored));
    st.sttTopXorNStore = stored;
    return res;
  }
  /**
   * @param {ZKCryptState} st
   * @param {uint32} value
   * @returns {uint32}
   */
  function intrXorNStore(st, value) {
    const stored = u32(OpCodes.Xor32(value, OpCodes.RotL32(st.sttFeedBack, 7)));
    const res = u32(OpCodes.Xor32(st.sttIntrXorNStore, stored));
    st.sttIntrXorNStore = stored;
    return res;
  }
  /**
   * @param {ZKCryptState} st
   * @param {uint32} value
   * @returns {uint32}
   */
  function botXorNStore(st, value) {
    const res = u32(OpCodes.Xor32(st.sttBotXorNStore, value));
    st.sttBotXorNStore = value;
    return res;
  }

  /**
   * @param {uint32} value
   * @param {uint8[]} table
   * @returns {uint32}
   */
  function hashMix(value, table) {
    /** @type {uint32} */
    let res = 0;
    for (let i = 31; i >= 0; i--) {
      res = u32(OpCodes.Shl32(res, 1));
      res = OpCodes.Or32(res, OpCodes.And32(OpCodes.Shr32(value, table[i]), 1));
    }
    return u32(res);
  }

  // "EVNN" odd-nibble-masked majority filter shared by topHash()/botHash()
  /**
   * @param {ZKCryptState} st
   * @param {uint32} value
   * @param {boolean} isTop
   * @returns {uint32}
   */
  function runEVNN(st, value, isTop) {
    const rot30 = OpCodes.RotL32(value, 2);
    const rot31 = OpCodes.RotL32(value, 1);
    const rot01 = OpCodes.RotR32(value, 1);
    const ctrl = isTop ? st.ctrlTopHashMatrix : st.ctrlBotHashMatrix;

    /** @type {uint32} */
    let mask = 0;
    if (OpCodes.And32(ctrl, CTRL_HASH_ODDN_TOP)) mask = OpCodes.Or32(mask, 0x11111111);
    if (OpCodes.And32(ctrl, CTRL_HASH_ODDN_MID)) mask = OpCodes.Or32(mask, 0x22222222);
    if (OpCodes.And32(ctrl, CTRL_HASH_ODDN_BOT)) mask = OpCodes.Or32(mask, 0x44444444);
    if (OpCodes.And32(ctrl, CTRL_HASH_ODDN_4TH)) mask = OpCodes.Or32(mask, 0x88888888);
    mask = u32(mask);

    return u32(OpCodes.Xor32(OpCodes.Xor32(maj32(mask, rot30, rot31), value), rot01));
  }

  /**
   * @param {ZKCryptState} st
   * @param {uint32} value
   * @returns {uint32}
   */
  function topHash(st, value) {
    if (OpCodes.And32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_A)) value = hashMix(value, HASH_TABLE_A);
    else if (OpCodes.And32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_B)) value = hashMix(value, HASH_TABLE_B);
    else if (OpCodes.And32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_C)) value = hashMix(value, HASH_TABLE_C);

    if (OpCodes.And32(OpCodes.Shr32(value, 8), 1)) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_THSH08);
    if (OpCodes.And32(OpCodes.Shr32(value, 15), 1)) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_THSH15);
    if (OpCodes.And32(OpCodes.Shr32(value, 18), 1)) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_THSH18);
    if (OpCodes.And32(OpCodes.Shr32(value, 31), 1)) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_THSH31);

    return st.sttTopHash = runEVNN(st, value, true);
  }

  /**
   * @param {ZKCryptState} st
   * @param {uint32} value
   * @returns {uint32}
   */
  function botHash(st, value) {
    if (OpCodes.And32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_A)) value = hashMix(value, HASH_TABLE_A);
    else if (OpCodes.And32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_B)) value = hashMix(value, HASH_TABLE_B);
    else if (OpCodes.And32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_C)) value = hashMix(value, HASH_TABLE_C);

    return st.sttBotHash = runEVNN(st, value, false);
  }

  /**
   * @param {ZKCryptState} st
   * @param {uint32} outCipher
   * @returns {uint32}
   */
  function feedbackStorage(st, outCipher) {
    st.sttST_FeedBack = OpCodes.RotR32(hashMix(u32(OpCodes.Xor32(st.fbC, st.fbD)), MAC_NIB_MIX), 8);

    if (OpCodes.And32(st.ctrlFeedBack, CTRL_FEEDBACK_RESET)) {
      st.sttFeedBack = 0;
      st.sttST_FeedBack = 0;
      st.lclMACstorage = 0;
      st.ctrlFeedBack = OpCodes.And32(st.ctrlFeedBack, OpCodes.Not32(CTRL_FEEDBACK_RESET));
      return 0;
    }
    if (OpCodes.And32(st.ctrlFeedBack, CTRL_FEEDBACK_ENABLE) === 0) {
      st.sttFeedBack = 0;
      st.sttST_FeedBack = 0;
      return 0;
    }
    if (OpCodes.And32(st.ctrlFeedBack, CTRL_FEEDBACK_MAC)) {
      st.sttFeedBack = u32(OpCodes.Xor32(outCipher, st.lclMACstorage));
      st.lclMACstorage = outCipher;
      st.sttST_FeedBack = u32(OpCodes.Xor32(st.sttST_FeedBack, hashMix(outCipher, MAC_NIB_MIX)));
      return st.sttFeedBack;
    }
    if (OpCodes.And32(st.ctrlFeedBack, CTRL_FEEDBACK_CIPH)) {
      return st.sttFeedBack = u32(OpCodes.And32(OpCodes.And32(st.fbA, st.fbB), OpCodes.Xor32(st.fbC, st.fbD)));
    }
    return 0;
  }

  // Clocks (or, if not asked to clock, just reads out) one half of an
  // nLFSR data bank register.
  /**
   * @param {ZKCryptState} st
   * @param {int32} bank
   * @param {uint32} control
   * @param {boolean} isLeft
   * @param {int32} index
   * @returns {uint32}
   */
  function nLfsrIterate(st, bank, control, isLeft, index) {
    const len = NLFSR_LEN[index];
    const mask = u32(OpCodes.Sub32(OpCodes.Shl32(1, len), 1));
    /** @type {uint32} */
    const full = st.getBank(bank);
    let local = isLeft ? OpCodes.And32(full, mask) : OpCodes.Shr32(full, len);

    if (!OpCodes.And32(control, CTRL_NLFSR_CLOCK)) return local;

    const topmost = OpCodes.And32(OpCodes.Shr32(local, (len - 1)), 1);
    const fixBit = nfix(local, len);
    const slip = isLeft
      ? (OpCodes.And32(control, CTRL_NLFSR_SLIP_LEFT) !== 0 ? 1 : 0)
      : (OpCodes.And32(control, CTRL_NLFSR_SLIP_RIGHT) !== 0 ? 1 : 0);
    const feedbackTap = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(topmost, fixBit), slip), 1);

    local = OpCodes.And32(u32(OpCodes.Shl32(local, 1)), mask);
    if (feedbackTap) local = OpCodes.Or32(u32(OpCodes.Xor32(local, NLFSR_MASK[index])), 1);

    return local;
  }

  // Runs one of the three data banks (top/mid/bot): loads, clocks its two
  // halves and combines them, then optionally applies the Brownian filter.
  /**
   * @param {ZKCryptState} st
   * @param {int32} bank
   * @param {uint32} control
   * @param {int32} leftIndex
   * @param {int32} rightIndex
   * @param {int32} rotateNum
   * @param {uint32} cipherWord
   * @param {uint32} maskLeftClockFB
   * @param {uint32} maskRightClockFB
   * @returns {uint32}
   */
  function runBank(st, bank, control, leftIndex, rightIndex, rotateNum, cipherWord, maskLeftClockFB, maskRightClockFB) {
    const lenLeft = NLFSR_LEN[leftIndex];
    const lenRight = NLFSR_LEN[rightIndex];

    if (OpCodes.And32(control, CTRL_NLFSR_LOAD)) {
      // Loads are bit-reversed (LSB becomes MSB); the loaded pattern is
      // inverted apart from the LSB of each half.
      const reversedCipher = reverseBits32(cipherWord);
      const mask = u32(OpCodes.Add32(OpCodes.Shl32(1, lenLeft), 1));
      st.setBank(bank, u32(OpCodes.Xor32((OpCodes.Not32(reversedCipher)), mask)));
      return 0;
    }

    /** @type {uint32} */
    let res;
    if (OpCodes.And32(control, CTRL_NLFSR_CLOCK)) {
      if (OpCodes.And32(control, CTRL_NLFSR_FB)) st.setBank(bank, u32(OpCodes.Xor32(st.getBank(bank), st.sttFeedBack)));

      const left = nLfsrIterate(st, bank, control, true, leftIndex);
      const right = nLfsrIterate(st, bank, control, false, rightIndex);

      st.sttClockFeedBack_next = OpCodes.And32(st.sttClockFeedBack_next, OpCodes.Not32(maskLeftClockFB));
      st.sttClockFeedBack_next = OpCodes.And32(st.sttClockFeedBack_next, OpCodes.Not32(maskRightClockFB));
      if (OpCodes.And32(OpCodes.And32(left, (lenLeft - 1)), 1) === 1) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, maskLeftClockFB);
      if (OpCodes.And32(OpCodes.And32(right, (lenRight - 1)), 1) === 1) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, maskRightClockFB);

      res = u32(OpCodes.Or32(left, OpCodes.Shl32(right, lenLeft)));
      st.setBank(bank, res);
    } else {
      res = st.getBank(bank);
    }

    if (!OpCodes.And32(control, CTRL_NLFSR_BROWN)) return res;

    const image = OpCodes.RotL32(res, rotateNum);
    return u32(OpCodes.Xor32(res, (OpCodes.Not32(image))));
  }

  // Combines the three data banks into the raw pre-hash 32-bit word.
  // NOTE: the reference algorithm also XORs in a fourth "Super tier" bank
  // here when compiled with ZK_OPTI_SUPER — see file header, deviation #1.
  // This variant does not enable it, so it is omitted entirely.
  /**
   * @param {ZKCryptState} st
   * @returns {uint32}
   */
  function nLfsrBank(st) {
    const top = runBank(st, BANK_TOP, OpCodes.Or32(st.ctrlTopBank, CTRL_NLFSR_FB), DEF_13, DEF_19, 1, st.upCphWrd_2, CTRL_CLOCKS_FB_Q12, CTRL_CLOCKS_FB_Q18);
    const mid = runBank(st, BANK_MID, OpCodes.Or32(st.ctrlMidBank, CTRL_NLFSR_FB), DEF_18, DEF_14, 3, st.upCphWrd_3, CTRL_CLOCKS_FB_Q17, CTRL_CLOCKS_FB_Q13);
    const bot = runBank(st, BANK_BOT, OpCodes.Or32(st.ctrlBotBank, CTRL_NLFSR_FB), DEF_15, DEF_17, 5, st.upCphWrd_4, CTRL_CLOCKS_FB_Q14, CTRL_CLOCKS_FB_Q16);

    const majority = maj32(top, mid, bot);
    return u32(OpCodes.Xor32(majority, OpCodes.RotR32(majority, 5)));
  }

  /**
   * @param {ZKCryptState} st
   */
  function setHashVector(st) {
    st.ctrlTopHashMatrix = OpCodes.And32(st.ctrlTopHashMatrix, 0xF0);
    st.ctrlBotHashMatrix = OpCodes.And32(st.ctrlBotHashMatrix, 0xF0);
    switch (st.hashCounter) {
      default:
      case 0: st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_A); st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_B); break;
      case 1: st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_B); st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_C); break;
      case 2: st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_C); st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_D); break;
      case 3: st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_VECTOR_D); st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_VECTOR_A); break;
    }
  }

  /**
   * @param {ZKCryptState} st
   */
  function cycleHashCounter(st) {
    const bit26 = OpCodes.And32(st.hashCounter, 1);
    const bit27 = OpCodes.And32(OpCodes.Shr32(st.hashCounter, 1), 1);
    let hc = OpCodes.And32(OpCodes.Xor32((OpCodes.Not32(bit27)), OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_THSH15), bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_THSH31))), 1);
    hc = OpCodes.Or32(hc, OpCodes.Shl32(OpCodes.Xor32(bit26, bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_JUGG)), 1));
    st.hashCounter = OpCodes.And32(hc, 0x03);
    setHashVector(st);
  }

  /**
   * @param {ZKCryptState} st
   * @param {boolean} clean
   */
  function cyclePRandomClock(st, clean) {
    if (clean) { st.F3 = st.F4 = st.F5 = st.F6 = st.F7 = st.F8 = 0; return; }

    const prevLong = st.longPClock;

    let tap = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(st.longPClock, 9), nfix(st.longPClock, 9)), bitAt(st.ctrlClocks, CTRL_CLOCKS_SLIP)), 1);
    st.longPClock = OpCodes.And32(OpCodes.Shl32(st.longPClock, 1), 0xFFFFFFFF);
    st.longPClock = OpCodes.And32(OpCodes.Or32(st.longPClock, OpCodes.And32(tap, 1)), 0x01FF);
    if (tap === 1) st.longPClock = OpCodes.And32(OpCodes.Xor32(st.longPClock, 0x01B4), 0xFFFF);

    const notLow3 = OpCodes.And32((OpCodes.Not32(OpCodes.Or32(OpCodes.Or32(bit(st.longPClock, 1), bit(st.longPClock, 2)), bit(st.longPClock, 3)))), 0xFF);
    const shortBit1 = bit(st.shortPClock, 1);
    const shortMix = OpCodes.And32(OpCodes.Or32((OpCodes.Not32(OpCodes.And32(bit(st.shortPClock, 1), bit(st.shortPClock, 2)))), notLow3), 0xFF);
    st.shortPClock = OpCodes.And32(OpCodes.And32(shortMix, OpCodes.Shl32(shortBit1, 1)), 0x03);

    const qtaBit = bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_QTA);

    st.F6 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(qtaBit, st.F5), st.F3), st.F6), 1);
    if (st.F6) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_JUGG);

    st.F7 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(qtaBit, st.F5), st.F3), st.F7), 1);
    if (st.F7) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_4TH);

    st.F8 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(qtaBit, st.F3), st.F4), st.F8), 1);
    if (st.F8) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_DAS);

    st.F3 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(prevLong, 2), bit(prevLong, 5)), bit(prevLong, 8)), 1);
    st.F4 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(prevLong, 3), bit(prevLong, 6)), bit(prevLong, 9)), 1);
    st.F5 = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(prevLong, 1), bit(prevLong, 4)), bit(prevLong, 7)), 1);

    if (OpCodes.And32(OpCodes.Or32(OpCodes.Or32(st.F4, st.F5), OpCodes.And32(st.shortPClock, 2)), 1) !== 0) st.ctrlClocks = OpCodes.Or32(st.ctrlClocks, CTRL_PRND_CLOCK);
  }

  // The three small irregular nLFSR clock generators that decide, once
  // every OpCodes.Not32(15) pseudo-random-clock cycles, whether/which way their
  // corresponding data bank should "slip". They are structurally similar
  // but NOT parameterizably identical (bit-width, tap positions and which
  // sticky Q-flag each one reads all differ in bank-specific ways), so each
  // is written out directly rather than generated from a shared template.

  // Top clock: 3-bit nLFSR; reads Q17/Q13, i.e. the MIDDLE data bank's flags.
  /**
   * @param {ZKCryptState} st
   * @returns {uint32}
   */
  function cycleTopBankClock(st) {
    /** @type {uint32} */
    let res = 0;
    const prev = st.topBankClock_nLFR;

    const tapBit = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(bit(prev, 3), bit(prev, 1)), nfix(prev, 3)), OpCodes.And32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q17), bit(st.topBankClockCounter, 1))), 1);
    st.topBankClock_nLFR = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(prev, 1), OpCodes.And32(tapBit, 1)), 0x07);

    st.topBankClockCounter = OpCodes.And32(OpCodes.Add32(st.topBankClockCounter, 1), 0xFF);
    let slip = false;
    if (st.topBankClockCounter === 15) {
      let tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(prev, 1), bit(prev, 2)), OpCodes.Xor32(st.topBankClock_MC, bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_JUGG))), 0xFF);
      st.topBankClockCounter = OpCodes.And32(OpCodes.Shl32(tb, 1), 0xFF);

      tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q17), bit(prev, 1)), bit(prev, 2)), 0xFF);
      st.topBankClockCounter = OpCodes.And32(OpCodes.Shl32(st.topBankClockCounter, 1), 0xFF);
      st.topBankClockCounter = OpCodes.And32(OpCodes.Add32(st.topBankClockCounter, tb), 0xFF);

      tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q17), bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q13)), bit(prev, 1)), 0xFF);
      st.topBankClockCounter = OpCodes.And32(OpCodes.Shl32(st.topBankClockCounter, 1), 0xFF);
      st.topBankClockCounter = OpCodes.And32(OpCodes.Add32(st.topBankClockCounter, tb), 0xFF);

      if (tb === 1) st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_QTA);

      st.topBankClock_MC = OpCodes.And32((OpCodes.Not32(st.topBankClock_MC)), 1);
      slip = true;
    }

    if (OpCodes.Xor32(OpCodes.Xor32(bit(prev, 1), bit(prev, 2)), bit(prev, 3)) > 0) res = OpCodes.Or32(res, OUTP_CLOCKS_BRN);

    if (slip) {
      const tb = OpCodes.And32(st.sttClockFeedBack, CTRL_CLOCKS_FB_DAS) ? OpCodes.Xor32(1, bit(prev, 3)) : OpCodes.Xor32(0, bit(prev, 3));
      res = OpCodes.Or32(res, (tb === 0) ? OUTP_CLOCKS_RGT_SLP : OUTP_CLOCKS_LFT_SLP);
    }

    if (OpCodes.And32(st.topBankClock_MC, 1)) res = OpCodes.Or32(res, OUTP_CLOCKS_CTRL);
    return res;
  }

  // Mid clock: 5-bit nLFSR; reads Q12/Q18, i.e. the TOP data bank's flags.
  /**
   * @param {ZKCryptState} st
   * @returns {uint32}
   */
  function cycleMidBankClock(st) {
    /** @type {uint32} */
    let res = 0;
    const prev = st.midBankClock_nLFR;

    const tapBit = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(bit(prev, 5), bit(prev, 2)), nfix(prev, 5)), OpCodes.And32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q12), bit(st.midBankClockCounter, 1))), 1);
    st.midBankClock_nLFR = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(prev, 1), OpCodes.And32(tapBit, 1)), 0x1F);

    st.midBankClockCounter = OpCodes.And32(OpCodes.Add32(st.midBankClockCounter, 1), 0xFF);
    let slip = false;
    if (st.midBankClockCounter === 15) {
      let tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(prev, 3), bit(prev, 4)), OpCodes.Xor32(st.midBankClock_MC, bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_JUGG))), 0xFF);
      st.midBankClockCounter = OpCodes.And32(OpCodes.Shl32(tb, 1), 0xFF);

      tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q12), bit(prev, 1)), bit(prev, 2)), 0xFF);
      st.midBankClockCounter = OpCodes.And32(OpCodes.Shl32(st.midBankClockCounter, 1), 0xFF);
      st.midBankClockCounter = OpCodes.And32(OpCodes.Add32(st.midBankClockCounter, tb), 0xFF);

      tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q12), bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q18)), bit(prev, 1)), 0xFF);
      st.midBankClockCounter = OpCodes.And32(OpCodes.Shl32(st.midBankClockCounter, 1), 0xFF);
      st.midBankClockCounter = OpCodes.And32(OpCodes.Add32(st.midBankClockCounter, tb), 0xFF);

      st.midBankClock_MC = OpCodes.And32((OpCodes.Not32(st.midBankClock_MC)), 1);
      slip = true;
    }

    if (OpCodes.Xor32(OpCodes.Xor32(bit(prev, 1), bit(prev, 2)), bit(prev, 3)) > 0) res = OpCodes.Or32(res, OUTP_CLOCKS_BRN);

    if (slip) {
      const tb = OpCodes.And32(st.sttClockFeedBack, CTRL_CLOCKS_FB_DAS) ? OpCodes.Xor32(1, bit(prev, 5)) : OpCodes.Xor32(0, bit(prev, 5));
      res = OpCodes.Or32(res, (tb === 0) ? OUTP_CLOCKS_RGT_SLP : OUTP_CLOCKS_LFT_SLP);
    }

    if (OpCodes.And32(st.midBankClock_MC, 1)) res = OpCodes.Or32(res, OUTP_CLOCKS_CTRL);
    return res;
  }

  // Bot clock: 6-bit nLFSR; reads Q14/Q16, i.e. its own (BOTTOM) data bank's flags.
  /**
   * @param {ZKCryptState} st
   * @returns {uint32}
   */
  function cycleBotBankClock(st) {
    /** @type {uint32} */
    let res = 0;
    const prev = st.botBankClock_nLFR;

    const tapBit = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(bit(prev, 6), bit(prev, 1)), nfix(prev, 6)), OpCodes.And32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q14), bit(st.botBankClockCounter, 1))), 1);
    st.botBankClock_nLFR = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(prev, 1), OpCodes.And32(tapBit, 1)), 0x3F);

    st.botBankClockCounter = OpCodes.And32(OpCodes.Add32(st.botBankClockCounter, 1), 0xFF);
    let slip = false;
    if (st.botBankClockCounter === 15) {
      let tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bit(prev, 4), bit(prev, 5)), OpCodes.Xor32(st.botBankClock_MC, bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_JUGG))), 0xFF);
      st.botBankClockCounter = OpCodes.And32(OpCodes.Shl32(tb, 1), 0xFF);

      tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q14), bit(prev, 1)), bit(prev, 2)), 0xFF);
      st.botBankClockCounter = OpCodes.And32(OpCodes.Shl32(st.botBankClockCounter, 1), 0xFF);
      st.botBankClockCounter = OpCodes.And32(OpCodes.Add32(st.botBankClockCounter, tb), 0xFF);

      tb = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q14), bitAt(st.sttClockFeedBack, CTRL_CLOCKS_FB_Q16)), bit(prev, 1)), 0xFF);
      st.botBankClockCounter = OpCodes.And32(OpCodes.Shl32(st.botBankClockCounter, 1), 0xFF);
      st.botBankClockCounter = OpCodes.And32(OpCodes.Add32(st.botBankClockCounter, tb), 0xFF);

      st.botBankClock_MC = OpCodes.And32((OpCodes.Not32(st.botBankClock_MC)), 1);
      slip = true;
    }

    if (OpCodes.Xor32(OpCodes.Xor32(bit(prev, 1), bit(prev, 2)), bit(prev, 3)) > 0) res = OpCodes.Or32(res, OUTP_CLOCKS_BRN);

    if (slip) {
      const tb = OpCodes.And32(st.sttClockFeedBack, CTRL_CLOCKS_FB_DAS) ? OpCodes.Xor32(1, bit(prev, 6)) : OpCodes.Xor32(0, bit(prev, 6));
      res = OpCodes.Or32(res, (tb === 0) ? OUTP_CLOCKS_RGT_SLP : OUTP_CLOCKS_LFT_SLP);
    }

    if (OpCodes.And32(st.botBankClock_MC, 1)) res = OpCodes.Or32(res, OUTP_CLOCKS_CTRL);
    return res;
  }

  /**
   * @param {ZKCryptState} st
   */
  function cycleClock(st) {
    if (OpCodes.And32(st.ctrlClocks, CTRL_CLOCKS_LOAD)) {
      const reversedKey1 = reverseBits32(st.upCphWrd_1);

      st.topBankClock_nLFR = OpCodes.And32(OpCodes.Shr32(reversedKey1, 29), 0x07);
      st.topBankClockCounter = OpCodes.And32(OpCodes.Shr32(reversedKey1, 25), 0x0F);
      st.topBankClock_MC = 0;

      st.midBankClock_nLFR = OpCodes.And32(OpCodes.Shr32(reversedKey1, 20), 0x1F);
      st.midBankClockCounter = OpCodes.And32(OpCodes.Shr32(reversedKey1, 16), 0x0F);
      st.midBankClock_MC = 0;

      st.botBankClock_nLFR = OpCodes.And32(OpCodes.Shr32(reversedKey1, 10), 0x3F);
      st.botBankClockCounter = OpCodes.And32(OpCodes.Shr32(reversedKey1, 6), 0x0F);
      st.botBankClock_MC = 0;

      st.hashCounter = OpCodes.And32(OpCodes.Shr32(reversedKey1, 4), 0x03);
      setHashVector(st);

      st.longPClock = OpCodes.Or32(0x0105, OpCodes.Shl32(OpCodes.And32(reversedKey1, 0x0F), 4));
      st.shortPClock = 0x03;

      cyclePRandomClock(st, true);
      return;
    }

    /** @type {uint32} */
    let topRes = 0;
    /** @type {uint32} */
    let midRes = 0;
    /** @type {uint32} */
    let botRes = 0;
    if (OpCodes.And32(st.ctrlClocks, CTRL_PRND_CLOCK)) {
      topRes = cycleTopBankClock(st);
      midRes = cycleMidBankClock(st);
      botRes = cycleBotBankClock(st);
    }

    cycleHashCounter(st);
    cyclePRandomClock(st, false);

    st.ctrlTopHashMatrix = OpCodes.And32(st.ctrlTopHashMatrix, 0x0F);
    st.ctrlBotHashMatrix = OpCodes.And32(st.ctrlBotHashMatrix, 0x0F);

    const mc1 = bitAt(topRes, OUTP_CLOCKS_CTRL);
    const mc2 = bitAt(midRes, OUTP_CLOCKS_CTRL);
    const mc3 = bitAt(botRes, OUTP_CLOCKS_CTRL);

    // See file header, deviation #2: this is permanently 1 as actually
    // compiled (bitwise-NOT of a 0/1 value is never zero).
    const invBrnMaj = 1;

    if (OpCodes.Xor32(mc1, invBrnMaj) !== 0) {
      st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_ODDN_TOP);
      st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_ODDN_4TH);
    }
    if (OpCodes.Xor32(mc2, invBrnMaj) !== 0) {
      st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_ODDN_MID);
      st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_ODDN_TOP);
      st.sttClockFeedBack_next = OpCodes.Or32(st.sttClockFeedBack_next, CTRL_CLOCKS_FB_ODDN_MID);
    }
    if (OpCodes.Xor32(mc3, invBrnMaj) !== 0) {
      st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_ODDN_BOT);
      st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_ODDN_MID);
    }
    if (OpCodes.And32(st.sttClockFeedBack, CTRL_CLOCKS_FB_4TH)) {
      st.ctrlTopHashMatrix = OpCodes.Or32(st.ctrlTopHashMatrix, CTRL_HASH_ODDN_4TH);
      st.ctrlBotHashMatrix = OpCodes.Or32(st.ctrlBotHashMatrix, CTRL_HASH_ODDN_BOT);
    }

    // Apply the delayed (previous-cycle-computed) bank control bits.
    st.ctrlTopBank = OpCodes.And32(st.delayedBuffer, DELAY_TOP_CLOCKS) ? OpCodes.Or32(st.ctrlTopBank, CTRL_NLFSR_CLOCK) : OpCodes.And32(st.ctrlTopBank, OpCodes.Not32(CTRL_NLFSR_CLOCK));
    st.ctrlMidBank = OpCodes.And32(st.delayedBuffer, DELAY_MID_CLOCKS) ? OpCodes.Or32(st.ctrlMidBank, CTRL_NLFSR_CLOCK) : OpCodes.And32(st.ctrlMidBank, OpCodes.Not32(CTRL_NLFSR_CLOCK));
    st.ctrlBotBank = OpCodes.And32(st.delayedBuffer, DELAY_BOT_CLOCKS) ? OpCodes.Or32(st.ctrlBotBank, CTRL_NLFSR_CLOCK) : OpCodes.And32(st.ctrlBotBank, OpCodes.Not32(CTRL_NLFSR_CLOCK));

    st.ctrlTopBank = OpCodes.And32(st.delayedBuffer, DELAY_TOP_BROWN) ? OpCodes.Or32(st.ctrlTopBank, CTRL_NLFSR_BROWN) : OpCodes.And32(st.ctrlTopBank, OpCodes.Not32(CTRL_NLFSR_BROWN));
    st.ctrlMidBank = OpCodes.And32(st.delayedBuffer, DELAY_MID_BROWN) ? OpCodes.Or32(st.ctrlMidBank, CTRL_NLFSR_BROWN) : OpCodes.And32(st.ctrlMidBank, OpCodes.Not32(CTRL_NLFSR_BROWN));
    st.ctrlBotBank = OpCodes.And32(st.delayedBuffer, DELAY_BOT_BROWN) ? OpCodes.Or32(st.ctrlBotBank, CTRL_NLFSR_BROWN) : OpCodes.And32(st.ctrlBotBank, OpCodes.Not32(CTRL_NLFSR_BROWN));

    if (OpCodes.And32(st.delayedBuffer, DELAY_LH_SLIP)) {
      st.ctrlTopBank = OpCodes.Or32(st.ctrlTopBank, CTRL_NLFSR_SLIP_LEFT); st.ctrlMidBank = OpCodes.Or32(st.ctrlMidBank, CTRL_NLFSR_SLIP_LEFT); st.ctrlBotBank = OpCodes.Or32(st.ctrlBotBank, CTRL_NLFSR_SLIP_LEFT);
    } else {
      st.ctrlTopBank = OpCodes.And32(st.ctrlTopBank, OpCodes.Not32(CTRL_NLFSR_SLIP_LEFT)); st.ctrlMidBank = OpCodes.And32(st.ctrlMidBank, OpCodes.Not32(CTRL_NLFSR_SLIP_LEFT)); st.ctrlBotBank = OpCodes.And32(st.ctrlBotBank, OpCodes.Not32(CTRL_NLFSR_SLIP_LEFT));
    }
    if (OpCodes.And32(st.delayedBuffer, DELAY_RH_SLIP)) {
      st.ctrlTopBank = OpCodes.Or32(st.ctrlTopBank, CTRL_NLFSR_SLIP_RIGHT); st.ctrlMidBank = OpCodes.Or32(st.ctrlMidBank, CTRL_NLFSR_SLIP_RIGHT); st.ctrlBotBank = OpCodes.Or32(st.ctrlBotBank, CTRL_NLFSR_SLIP_RIGHT);
    } else {
      st.ctrlTopBank = OpCodes.And32(st.ctrlTopBank, OpCodes.Not32(CTRL_NLFSR_SLIP_RIGHT)); st.ctrlMidBank = OpCodes.And32(st.ctrlMidBank, OpCodes.Not32(CTRL_NLFSR_SLIP_RIGHT)); st.ctrlBotBank = OpCodes.And32(st.ctrlBotBank, OpCodes.Not32(CTRL_NLFSR_SLIP_RIGHT));
    }

    if (OpCodes.And32(st.delayedBuffer, DELAY_PR_SLIP)) st.ctrlClocks = OpCodes.Or32(st.ctrlClocks, CTRL_CLOCKS_SLIP); else st.ctrlClocks = OpCodes.And32(st.ctrlClocks, OpCodes.Not32(CTRL_CLOCKS_SLIP));

    // One-hot select among {bottom, top, middle} based on the (mc1,mc2,mc3) pattern.
    let selBot = false, selTop = false, selMid = false;
    if (!mc1 && !mc2 && !mc3) selBot = true;
    else if (mc1 && !mc2 && !mc3) selMid = true;
    else if (!mc1 && mc2 && !mc3) selMid = true;
    else if (mc1 && mc2 && !mc3) selBot = true;
    else if (!mc1 && !mc2 && mc3) selTop = true;
    else if (mc1 && !mc2 && mc3) selBot = true;
    else if (!mc1 && mc2 && mc3) selMid = true;
    else selTop = true; // mc1 && mc2 && mc3

    if (OpCodes.And32(st.ctrlClocks, CTRL_PRND_CLOCK)) {
      st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, OpCodes.Or32(OpCodes.Or32(DELAY_TOP_CLOCKS, DELAY_MID_CLOCKS), DELAY_BOT_CLOCKS));
    } else {
      if (!(selTop && invBrnMaj)) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_TOP_CLOCKS);
      if (!(selMid && invBrnMaj)) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_MID_CLOCKS);
      if (!(selBot && invBrnMaj)) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_BOT_CLOCKS);
    }

    // See file header, deviation #2: also permanently 1 as actually compiled.
    // NOTE: the reference source pairs {top/mid/bot}ClockRes with the
    // {bot/top/mid}-selector (a one-position rotation), NOT the same
    // top<->top pairing used for the CLOCKS gating above.
    const notPRandom = 1;
    const brn7 = OpCodes.Or32(bitAt(topRes, OUTP_CLOCKS_BRN), OpCodes.Or32((selBot ? 1 : 0), notPRandom));
    const brn8 = OpCodes.Or32(bitAt(midRes, OUTP_CLOCKS_BRN), OpCodes.Or32((selTop ? 1 : 0), notPRandom));
    const brn9 = OpCodes.Or32(bitAt(botRes, OUTP_CLOCKS_BRN), OpCodes.Or32((selMid ? 1 : 0), notPRandom));
    const allBrn = (brn7 && brn8 && brn9) ? 1 : 0;

    if (OpCodes.Xor32(brn7, (allBrn && selMid ? 1 : 0)) === 1) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_TOP_BROWN);
    if (OpCodes.Xor32(brn8, (allBrn && selBot ? 1 : 0)) === 1) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_MID_BROWN);
    if (OpCodes.Xor32(brn9, (allBrn && selTop ? 1 : 0)) === 1) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_BOT_BROWN);

    let lhSlip = false;
    if (!(bitAt(topRes, OUTP_CLOCKS_LFT_SLP) && bitAt(midRes, OUTP_CLOCKS_LFT_SLP) && bitAt(botRes, OUTP_CLOCKS_RGT_SLP))) {
      st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_LH_SLIP);
      lhSlip = true;
    }
    let rhSlip = false;
    if (!(bitAt(topRes, OUTP_CLOCKS_RGT_SLP) && bitAt(midRes, OUTP_CLOCKS_RGT_SLP) && bitAt(botRes, OUTP_CLOCKS_LFT_SLP))) {
      st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_RH_SLIP);
      rhSlip = true;
    }

    if ((invBrnMaj && lhSlip) || (!invBrnMaj && rhSlip)) st.delayedBuffer = OpCodes.Or32(st.delayedBuffer, DELAY_PR_SLIP);
    else st.delayedBuffer = OpCodes.And32(st.delayedBuffer, OpCodes.Not32(DELAY_PR_SLIP));
  }

  // Runs one full engine cycle; returns the 32-bit keystream/ciphertext word.
  /**
   * @param {ZKCryptState} st
   * @param {uint32} inputWord
   * @returns {uint32}
   */
  function cycleZKengine(st, inputWord) {
    let mixed = nLfsrBank(st);

    st.fbA = mixed = topXorNStore(st, mixed);
    st.fbB = mixed = topHash(st, mixed);
    st.fbC = mixed = intrXorNStore(st, mixed);
    st.fbD = mixed = botHash(st, mixed);
    mixed = botXorNStore(st, mixed);

    let out = u32(OpCodes.Xor32(inputWord, mixed));
    feedbackStorage(st, out);

    cycleClock(st);

    st.sttClockFeedBack = st.sttClockFeedBack_next;
    st.sttClockFeedBack_next = 0;

    return OpCodes.And32(st.ctrlFeedBack, CTRL_FEEDBACK_OUTPUT) === 0 ? 0 : out;
  }

  // setupZKengine(): loads the key/IV into all nLFSR banks and clocks, then
  // MAC-feeds the key/IV words through the engine and diffuses for 16 more
  // cycles before switching to cipher-feedback output mode.
  /**
   * @param {ZKCryptState} st
   */
  function setupZKengine(st) {
    st.ctrlFeedBack = CTRL_FEEDBACK_RESET;
    feedbackStorage(st, 0);
    st.ctrlTopHashMatrix = 0;
    st.ctrlBotHashMatrix = 0;

    st.ctrlTopBank = OpCodes.Or32(st.ctrlTopBank, OpCodes.Or32(CTRL_NLFSR_LOAD, CTRL_NLFSR_CLOCK));
    st.ctrlMidBank = OpCodes.Or32(st.ctrlMidBank, OpCodes.Or32(CTRL_NLFSR_LOAD, CTRL_NLFSR_CLOCK));
    st.ctrlBotBank = OpCodes.Or32(st.ctrlBotBank, OpCodes.Or32(CTRL_NLFSR_LOAD, CTRL_NLFSR_CLOCK));
    st.ctrlClocks = OpCodes.Or32(st.ctrlClocks, CTRL_CLOCKS_LOAD);

    st.ctrlFeedBack = OpCodes.Or32(CTRL_FEEDBACK_ENABLE, CTRL_FEEDBACK_MAC);

    nLfsrBank(st);
    cycleClock(st);
    st.ctrlTopBank = OpCodes.Xor32(st.ctrlTopBank, OpCodes.Or32(CTRL_NLFSR_LOAD, CTRL_NLFSR_CLOCK));
    st.ctrlMidBank = OpCodes.Xor32(st.ctrlMidBank, OpCodes.Or32(CTRL_NLFSR_LOAD, CTRL_NLFSR_CLOCK));
    st.ctrlBotBank = OpCodes.Xor32(st.ctrlBotBank, OpCodes.Or32(CTRL_NLFSR_LOAD, CTRL_NLFSR_CLOCK));
    st.ctrlClocks = OpCodes.And32(st.ctrlClocks, OpCodes.Not32(CTRL_CLOCKS_LOAD));

    const keyBlockCount = (st.keysize - 128) / 32;
    if (keyBlockCount === 1) cycleZKengine(st, st.upCphWrd_5);

    for (let i = 0; i < 4; i++) cycleZKengine(st, 0);

    cycleZKengine(st, st.upIV_1);
    cycleZKengine(st, st.upIV_2);
    cycleZKengine(st, st.upIV_3);
    cycleZKengine(st, st.upIV_4);
    const ivBlockCount = (st.ivsize - 128) / 32;
    if (ivBlockCount === 1) cycleZKengine(st, st.upIV_5);

    for (let i = 0; i < 16; i++) cycleZKengine(st, 0);

    st.ctrlFeedBack = OpCodes.Or32(OpCodes.Or32(CTRL_FEEDBACK_ENABLE, CTRL_FEEDBACK_CIPH), CTRL_FEEDBACK_OUTPUT);
  }

  /**
   * @param {ZKCryptState} st
   * @param {uint8[]} keyBytes
   */
  function loadKey(st, keyBytes) {
    resetEngine(st, true);
    st.keysize = KEY_SIZE_BITS;
    st.upCphWrd_1 = OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
    st.upCphWrd_2 = OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]);
    st.upCphWrd_3 = OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]);
    st.upCphWrd_4 = OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15]);
    st.upCphWrd_5 = OpCodes.Pack32LE(keyBytes[16], keyBytes[17], keyBytes[18], keyBytes[19]);
  }

  /**
   * @param {ZKCryptState} st
   * @param {uint8[]} ivBytes
   */
  function loadIV(st, ivBytes) {
    resetEngine(st, false);
    st.ivsize = IV_SIZE_BITS;
    st.upIV_1 = OpCodes.Pack32LE(ivBytes[0], ivBytes[1], ivBytes[2], ivBytes[3]);
    st.upIV_2 = OpCodes.Pack32LE(ivBytes[4], ivBytes[5], ivBytes[6], ivBytes[7]);
    st.upIV_3 = OpCodes.Pack32LE(ivBytes[8], ivBytes[9], ivBytes[10], ivBytes[11]);
    st.upIV_4 = OpCodes.Pack32LE(ivBytes[12], ivBytes[13], ivBytes[14], ivBytes[15]);
    setupZKengine(st);
  }

  // ======================================================================
  // AlgorithmFramework wiring
  // ======================================================================

  class DarkCryptZKCrypt3Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "ZK-Crypt v3 (DarkCrypt)";
      this.description = "eSTREAM Profile II (hardware) 'Variable Clocking Mechanism' stream cipher: three irregularly-clocked nLFSR data banks with independent small nLFSR clock generators, a pseudo-random long/short clock, dual substitution hash matrices and a cipher/MAC feedback network, as implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Carmi Gressel, Orr Dunkelman, Gabi Vago, Ran Granot, Aviad Kipnis, Michael Rimon, Yaakov Belenky (FortressGB); DarkCrypt port by Alexander Myasnikov";
      this.year = 2006;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.IL;

      this.SupportedKeySizes = [new KeySize(20, 20, 0)];   // fixed 160-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("eSTREAM: ZK-Crypt (base algorithm)", "https://www.ecrypt.eu.org/stream/zkcrypt.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Reduced configuration", "This build of the engine has the reference algorithm's optional 'Super tier' nLFSR bank compiled out, and several literal C expressions in the reference source evaluate to a constant rather than their apparent intent. The resulting keystream is bit-exact to the DarkCrypt implementation but is a specific, non-configurable instance of the general ZK-Crypt v3 design.", "Use a vetted, actively analyzed stream cipher.")
      ];

      // Test vector verified against the DarkCrypt implementation: key/IV setup
      // followed by a keystream XOR against 128 zero bytes.
      //
      // NOTE: only one vector is shipped. A second recorded scenario re-keys the
      // SAME engine instance without resetting it. Because ctx.delayedBuffer
      // (see file header, deviation #3) is architecturally never cleared, that
      // second run inherits leftover state from the first — replaying the same
      // two-setup-calls-on-one-context sequence through this engine reproduces
      // the recorded value exactly. A single AlgorithmFramework instance uses a
      // fresh state per CreateInstance()/key assignment, as this file implements
      // and as every other cipher in this repo does, so it cannot reproduce that
      // carried-over state. The second vector is therefore intentionally omitted
      // rather than shipped as an unverifiable value.
      this.tests = [
        {
          text: "DarkCrypt ZK-Crypt v3 — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f10111213"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("bb3a598264069344c7a3d1c0d6b6eb4f7eb4098e7fb2135053c9edde467f33c5cd2d8364a1f38307ade7a8a365b589fee90c2d0ee81e790d06875b6c7d6d867accaea351d4819026740ebe2e4cd31837458b48d77fa991823defb988a7602e2be25815cded92720379bfa7709f80926ff5153a5f8b2c6c05f95c4d1e07fb8ed2")
        },
        {
          text: "DarkCrypt ZK-Crypt v3 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("03203d5a7794b1ceeb0825425f7c99b6d3f00d2a4764819ebbd8f5122f4c6986a3c0ddfa1734516e8ba8c5e2ff1c3956"),
          key: OpCodes.Hex8ToBytes("0b30557a9fc4e90e33587da2c7ec11365b80a5ca"),
          iv: OpCodes.Hex8ToBytes("073c71a6db10457aafe4194e83b8ed22578cc1f6"),
          expected: OpCodes.Hex8ToBytes("4404bd80ff85e990ecb75ea0007e84abac45c680890392bf5fcacfb60cf478c05a22e3e5845f33ce30f44ba9fc31f2ca")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptZKCrypt3Instance(this, isInverse);
    }
  }

  class DarkCryptZKCrypt3Instance extends IAlgorithmInstance {
    /**
     * @param {DarkCryptZKCrypt3Algorithm} algorithm
     * @param {boolean} [isInverse=false]
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {ZKCryptState|null} */
      this._state = null;
      /** @type {uint8[]} */
      this._pendingBytes = [];
    }

    /**
     * @param {uint8[]|null} keyBytes
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 20)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. ZK-Crypt v3 (DarkCrypt) requires exactly 20 bytes");
      this._key = [...keyBytes];
      this._tryInit();
    }
    /**
     * @returns {uint8[]|null}
     */
    get key() { return this._key ? [...this._key] : null; }

    /**
     * @param {uint8[]|null} ivBytes
     */
    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      // The plugin hands over a 20-byte IV buffer but reads only its first 16 bytes
      if (ivBytes.length < 16 || ivBytes.length > 20)
        throw new Error("Invalid IV size: " + ivBytes.length + " bytes. ZK-Crypt v3 (DarkCrypt) requires 16 to 20 bytes");
      this._iv = ivBytes.slice(0, 16);
      this._tryInit();
    }
    /**
     * @returns {uint8[]|null}
     */
    get iv() { return this._iv ? [...this._iv] : null; }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) { this.iv = nonceBytes; }
    /**
     * @returns {uint8[]|null}
     */
    get nonce() { return this.iv; }

    /**
     * @param {uint8[]} data
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._state) throw new Error("Key/IV not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * @returns {uint8[]}
     */
    Result() {
      if (!this._state) throw new Error("Key/IV not set");
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.Xor8(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _tryInit() {
      if (!this._key || !this._iv) { this._state = null; return; }

      const st = createState();
      loadKey(st, this._key);
      loadIV(st, this._iv);

      this._state = st;
      this._pendingBytes = [];
    }

    /**
     * @returns {uint8}
     */
    _nextKeystreamByte() {
      if (this._pendingBytes.length === 0) {
        const word = cycleZKengine(this._state, 0);
        this._pendingBytes.push(...OpCodes.Unpack32LE(word));
      }
      return this._pendingBytes.shift();
    }
  }

  const algorithmInstance = new DarkCryptZKCrypt3Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptZKCrypt3Algorithm, DarkCryptZKCrypt3Instance };
}));
