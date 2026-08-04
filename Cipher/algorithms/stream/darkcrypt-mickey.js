/*
 * MICKEY 2.0 (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MICKEY 2.0 (Mutual Irregular Clocking KEYstream generator) is an
 * eSTREAM Profile 2 (hardware) finalist by Steve Babbage and Matthew
 * Dodd, built from two interlocking shift registers R and S that clock
 * each other irregularly.
 *
 * This file implements the 128-bit variant used by the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project). As
 * implemented there, every step below (register layout, feedback taps,
 * clock-control formulas and the fixed tap-constant tables) differs from
 * the textbook MICKEY 2.0 in the register sizes used.
 *
 * Register sizing: rather than the textbook MICKEY 2.0's 100-bit R/S
 * registers, this variant (matching DarkCrypt's own "Mickey 128 bit"
 * naming) uses R and S as five 32-bit words each (160 bits), with a
 * 128-bit key and a 128-bit IV (16 bytes each). Key/IV bits are consumed
 * one byte at a time, most-significant-bit first.
 *
 * Per clock, both R and S are always updated (never just one), matching
 * the classical MICKEY structure:
 *   - a keystream/output bit is taken as bit 0 of R XOR bit 0 of S,
 *     read BEFORE the registers are clocked;
 *   - each register independently selects one of two update rules
 *     (a plain left shift, or a self-XOR "R ^= R<<1" style shift) based
 *     on a control bit derived from comparing a tap of R against a tap
 *     of S (and vice versa for S's control bit);
 *   - after shifting, a fixed per-register tap-constant vector is
 *     conditionally XORed in, gated by the bit that overflowed out of
 *     the register's top word XORed with the (optional) input bit;
 *   - S's update additionally XORs in the top bit of the previous word
 *     as an inter-word carry (word 0 has no such carry: instead, bit 0
 *     of its AND-mask term is forced to 0, matching the published
 *     MICKEY 2.0 S-register construction);
 *   - during key/IV loading and the post-load blank rounds ("mixing"
 *     mode), the bit fed into R's overflow computation is additionally
 *     XORed with bit 16 of S's third word; during keystream generation
 *     (mixing off) it is used unmodified. S's overflow computation
 *     always uses the raw input bit, mixing or not.
 *
 * Setup sequence (all "mixing" mode): 128 clocks consuming the IV bits,
 * then 128 clocks consuming the key bits, then 160 blank clocks (zero
 * input bit) -- i.e. IV-load, key-load, then one blank round per bit of
 * register state, exactly mirroring the textbook MICKEY 2.0 procedure
 * scaled to the 160-bit registers used here.
 *
 * Test vectors verified against the DarkCrypt implementation:
 * setup(key, iv) followed by crypt(buffer, buffer, len) (in-place
 * keystream XOR).
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

  const WORDS = 5; // 5 x 32-bit words = 160-bit R and S registers

  // Fixed tap-constant vector XORed into R when its top-word overflow bit fires.
  // Used for both of R's shift-rule branches (only the shift rule itself differs).
  const FB_R = [0x42114D31, 0xF3EC4C59, 0x9C679626, 0x803BBE32, 0x375253AF];

  // Per-word masks used in S's "chi"-style update term: (S[i] ^ CT_B[i]) & (rot[i] ^ CT_A[i])
  const CT_B = [0x5DD6F25E, 0x79260955, 0x79007062, 0x37AFD931, 0x0FBE06BE];
  const CT_A = [0x7D191F30, 0xFEB63C98, 0x7C00C3E0, 0x6660E345, 0x7FF45BB5];

  // Fixed tap-constant vectors XORed into S when its top-word overflow bit fires,
  // selected by S's own shift-rule control bit.
  const S_FB1 = [0x9BF477AB, 0x70798C90, 0x6F9A18B6, 0x6C4B7EE7, 0x11A780EF]; // control bit set
  const S_FB0 = [0xC43C1FAF, 0x0E2FA322, 0x66E54D81, 0xD4544B91, 0x83630BC1]; // control bit clear

  class DarkCryptMickeyAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "MICKEY 2.0 (DarkCrypt)";
      this.description = "MICKEY 2.0 mutual irregular-clocking stream cipher, 128-bit key / 128-bit IV variant with 160-bit R and S registers (DarkCrypt's \"Mickey 128 bit\"). Both registers clock every step, each choosing between two shift rules via cross-register control bits, matching the published MICKEY 2.0 construction scaled up. As implemented in the DarkCrypt Total Commander plugin.";
      this.inventor = "Steve Babbage, Matthew Dodd (Vodafone Group R&D); DarkCrypt build by Alexander Myasnikov";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.GB;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("eSTREAM MICKEY Page", "https://www.ecrypt.eu.org/stream/mickeypf.html"),
        new LinkItem("The Stream Cipher MICKEY 2.0 (Babbage and Dodd)", "https://www.ecrypt.eu.org/stream/p3ciphers/mickey/mickey_p3.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt / Zarya Total Commander plugin", "https://totalcmd.ru/plugring/darkcryptTC.html")
      ];

      this.knownVulnerabilities = [];

      // Test vectors verified against the DarkCrypt implementation
      // (setup(key,iv) + crypt(buf,buf,len) in-place XOR keystream).
      this.tests = [
        {
          text: "DarkCrypt Mickey -- sequential key, zero IV, 128 zero bytes",
          uri: "https://totalcmd.ru/plugring/darkcryptTC.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("ca56d02c4ce8ce73d6d4c006eed71bd45e4127655d6436243dffa66725c88d85a226bce37d9163b0a97359c1363a7208504d5ece00d6f92865c7abadd32dbb1611e6f343329cab72c22efef487cfd7088ca91049c0ebf143ed90bedecb4903f1bce8be313eb3203a0fbf727de4f01da051074a46b3fdae6456d5bdc112cb6ffe")
        },
        {
          text: "DarkCrypt Mickey -- sequential key, zero IV, incrementing 64-byte input (fresh setup)",
          uri: "https://totalcmd.ru/plugring/darkcryptTC.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: (() => { const a = []; for (let i = 0; i < 64; i++) a.push(i); return a; })(),
          expected: OpCodes.Hex8ToBytes("ca57d22f48edc874deddca0de2da15db4e5035764971203325e6bc7c39d5939a82079ec059b44597815a73ea1a175c27607c6cfd34e3cf1f5dfe9196ef108529")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMickeyInstance(this, isInverse);
    }
  }

  class DarkCryptMickeyInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      this.R = new Array(WORDS).fill(0);
      this.S = new Array(WORDS).fill(0);
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.initialized = false; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MICKEY 2.0 (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      if (this._iv) this._initialize();
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this.initialized = false; return; }
      if (ivBytes.length !== 16)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. MICKEY 2.0 (DarkCrypt) requires exactly 16 bytes`);
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
      if (!this.initialized) throw new Error("MICKEY 2.0 (DarkCrypt) not properly initialized");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));
      }
      this.inputBuffer = [];
      return output;
    }

    // ===== MICKEY 2.0 (128-bit / 160-bit-register variant) core =====

    _initialize() {
      if (!this._key || !this._iv) return;

      for (let i = 0; i < WORDS; i++) { this.R[i] = 0; this.S[i] = 0; }

      const ivBits = this._bitsMSBFirst(this._iv, 128);
      for (let i = 0; i < 128; i++) this._clock(ivBits[i], true);

      const keyBits = this._bitsMSBFirst(this._key, 128);
      for (let i = 0; i < 128; i++) this._clock(keyBits[i], true);

      for (let i = 0; i < 160; i++) this._clock(0, true);

      this.initialized = true;
    }

    // Extract the first nbits bits of bytes, most-significant-bit first per byte.
    _bitsMSBFirst(bytes, nbits) {
      const bits = new Array(nbits);
      for (let i = 0; i < nbits; i++) {
        const byteIndex = OpCodes.Shr32(i, 3);
        const shift = 7 - OpCodes.And32(i, 7);
        bits[i] = OpCodes.And32(OpCodes.Shr32(bytes[byteIndex], shift), 1);
      }
      return bits;
    }

    // Clock R (shift-with-taps, optionally self-XOR) using the given control bit
    // and the (already-mixed) input bit for R's top-word overflow computation.
    _clockR(ctrl, inputBit) {
      const R = this.R;
      const msbR4 = OpCodes.And32(OpCodes.Shr32(R[4], 31), 1);
      const carryOut = OpCodes.Xor32(msbR4, OpCodes.And32(inputBit, 1));
      const msb0 = OpCodes.And32(OpCodes.Shr32(R[0], 31), 1);
      const msb1 = OpCodes.And32(OpCodes.Shr32(R[1], 31), 1);
      const msb2 = OpCodes.And32(OpCodes.Shr32(R[2], 31), 1);
      const msb3 = OpCodes.And32(OpCodes.Shr32(R[3], 31), 1);

      if (ctrl === 0) {
        const n0 = OpCodes.Shl32(R[0], 1);
        const n1 = OpCodes.Xor32(OpCodes.Shl32(R[1], 1), msb0);
        const n2 = OpCodes.Xor32(OpCodes.Shl32(R[2], 1), msb1);
        const n3 = OpCodes.Xor32(OpCodes.Shl32(R[3], 1), msb2);
        const n4 = OpCodes.Xor32(OpCodes.Shl32(R[4], 1), msb3);
        R[0] = n0; R[1] = n1; R[2] = n2; R[3] = n3; R[4] = n4;
      } else {
        const o0 = R[0], o1 = R[1], o2 = R[2], o3 = R[3], o4 = R[4];
        R[0] = OpCodes.Xor32(o0, OpCodes.Shl32(o0, 1));
        R[1] = OpCodes.Xor32(OpCodes.Xor32(o1, OpCodes.Shl32(o1, 1)), msb0);
        R[2] = OpCodes.Xor32(OpCodes.Xor32(o2, OpCodes.Shl32(o2, 1)), msb1);
        R[3] = OpCodes.Xor32(OpCodes.Xor32(o3, OpCodes.Shl32(o3, 1)), msb2);
        R[4] = OpCodes.Xor32(OpCodes.Xor32(o4, OpCodes.Shl32(o4, 1)), msb3);
      }

      if (carryOut) {
        for (let i = 0; i < WORDS; i++) R[i] = OpCodes.Xor32(R[i], FB_R[i]);
      }
    }

    // Clock S using the given control bit (selects the tail tap-constant table)
    // and the raw input bit.
    _clockS(ctrl, inputBit) {
      const S = this.S;
      const o0 = S[0], o1 = S[1], o2 = S[2], o3 = S[3], o4 = S[4];

      const msbS4 = OpCodes.And32(OpCodes.Shr32(o4, 31), 1);
      const carryOut = OpCodes.Xor32(msbS4, OpCodes.And32(inputBit, 1));

      const rot0 = OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(o1, 1), 31), OpCodes.Shr32(o0, 1));
      let chi0 = OpCodes.And32(OpCodes.Xor32(o0, CT_B[0]), OpCodes.Xor32(CT_A[0], rot0));
      chi0 &= 0xFFFFFFFE; // word 0 has no inter-word carry: its chi-term bit 0 is forced to 0
      const n0 = OpCodes.Xor32(OpCodes.Shl32(o0, 1), chi0);

      const rot1 = OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(o2, 1), 31), OpCodes.Shr32(o1, 1));
      const chi1 = OpCodes.And32(OpCodes.Xor32(o1, CT_B[1]), OpCodes.Xor32(CT_A[1], rot1));
      const n1 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(o1, 1), chi1), OpCodes.And32(OpCodes.Shr32(o0, 31), 1));

      const rot2 = OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(o3, 1), 31), OpCodes.Shr32(o2, 1));
      const chi2 = OpCodes.And32(OpCodes.Xor32(o2, CT_B[2]), OpCodes.Xor32(CT_A[2], rot2));
      const n2 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(o2, 1), chi2), OpCodes.And32(OpCodes.Shr32(o1, 31), 1));

      const rot3 = OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(o4, 1), 31), OpCodes.Shr32(o3, 1));
      const chi3 = OpCodes.And32(OpCodes.Xor32(o3, CT_B[3]), OpCodes.Xor32(CT_A[3], rot3));
      const n3 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(o3, 1), chi3), OpCodes.And32(OpCodes.Shr32(o2, 31), 1));

      const rot4 = OpCodes.Shr32(o4, 1); // no 6th word to rotate a bit in from
      let chi4 = OpCodes.And32(OpCodes.Xor32(o4, CT_B[4]), OpCodes.Xor32(CT_A[4], rot4));
      chi4 &= 0x7FFFFFFF;
      const n4 = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(o4, 1), chi4), OpCodes.And32(OpCodes.Shr32(o3, 31), 1));

      S[0] = n0; S[1] = n1; S[2] = n2; S[3] = n3; S[4] = n4;

      if (carryOut) {
        const tbl = ctrl !== 0 ? S_FB1 : S_FB0;
        for (let i = 0; i < WORDS; i++) S[i] = OpCodes.Xor32(S[i], tbl[i]);
      }
    }

    // One combined MICKEY clock: emits the pre-clock output bit, then clocks
    // both R and S. mixing=true during key/IV loading and the blank rounds;
    // mixing=false during keystream generation.
    _clock(inputBit, mixing) {
      const R = this.R, S = this.S;
      const outputBit = OpCodes.And32(OpCodes.Xor32(R[0], S[0]), 1);

      const rCtrl = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(R[3], 10), OpCodes.Shr32(S[1], 22)), 1);
      const sCtrl = OpCodes.And32(OpCodes.Xor32(OpCodes.Shr32(R[1], 21), OpCodes.Shr32(S[3], 10)), 1);

      const rInput = mixing ? OpCodes.And32(OpCodes.Xor32(OpCodes.And32(OpCodes.Shr32(S[2], 16), 1), OpCodes.And32(inputBit, 1)), 1) : OpCodes.And32(inputBit, 1);

      this._clockR(rCtrl, rInput);
      this._clockS(sCtrl, OpCodes.And32(inputBit, 1));

      return outputBit;
    }

    _nextKeystreamByte() {
      let b = 0;
      for (let bitpos = 7; bitpos >= 0; bitpos--) {
        b ^= OpCodes.Shl32(this._clock(0, false), bitpos);
      }
      return OpCodes.And32(b, 0xFF);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptMickeyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptMickeyAlgorithm, DarkCryptMickeyInstance };
}));
