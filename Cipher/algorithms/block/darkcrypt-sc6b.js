/*
 * SC6B (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SC6B is one of the block ciphers bundled with the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). It is a non-standard design:
 *   - 128-bit block (four 32-bit little-endian words), 320-bit key (ten words)
 *   - Key schedule is a 4-stage nonlinear feedback shift register (NLFSR) driven
 *     by the key words. Register combiner alternates per output group between a
 *     bitwise majority, an OR-dominated boolean, and a linear XOR (groups 4 and 9).
 *     It emits 40 words: 32 round-mixing constants (8 rounds x 4) plus 8 whitening
 *     words. Feedback uses ror-7 of the combiner output plus a ror-11 shift state.
 *   - Encryption: additive pre-whitening, two passes of a 4-word nonlinear
 *     substitution layer (mux/multiplexer boolean + ror-8), 8 rounds of a keyed
 *     multiply/rotate mixing function G with a b<->c swap and data-dependent
 *     rotations, two passes of the inverse substitution layer (rol-8), additive
 *     post-whitening (subtraction).
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation.
 * Educational only.
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

  // Key-schedule NLFSR seed constant (0xB3E18DA7) and shift amounts.
  const SEED = 0xB3E18DA7;

  // Bitwise multiplexer: for each bit, select x where s=1 else y.
  function mux(s, x, y) {
    return OpCodes.Or32(OpCodes.And32(s, x), OpCodes.And32((~s), y));
  }

  class DarkCryptSC6BAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "SC6B (DarkCrypt)";
      this.description = "Non-standard 128-bit block cipher from the DarkCrypt Total Commander plugin. 320-bit key expanded by a nonlinear feedback shift register into round constants and whitening words; 8 rounds of a keyed multiply/rotate mixing function wrapped by nonlinear multiplexer substitution layers.";
      this.inventor = "Alexander Myasnikov (DarkCrypt/Zarya project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(40, 40, 0)];  // fixed 320-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed design", "Ad-hoc NLFSR key schedule and bespoke round function with no public cryptanalysis or security proof.", "Use AES or another vetted cipher for real applications.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Sc6b — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("30f26746fb9474a5d5baa162df6dd787")
        },
        {
          text: "DarkCrypt Sc6b — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324252627"),
          expected: OpCodes.Hex8ToBytes("dd134a99433c5d912d6ce2e860703b42")
        },
        {
          text: "DarkCrypt Sc6b — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728"),
          expected: OpCodes.Hex8ToBytes("0dadbc81e665001ffc24bf83e79e7b33")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSC6BInstance(this, isInverse);
    }
  }

  class DarkCryptSC6BInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._sched = null;   // 40 expanded words: [0..31] round table, [32..39] whitening
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._sched = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 40)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SC6B (DarkCrypt) requires exactly 40 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._sched = this._expandKey(this._key);
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

    // NLFSR key schedule: emit 40 words = 8 rounds x 4 constants + 8 whitening words.
    _expandKey(key) {
      // Ten little-endian key words, padded with zeros to a 40-entry injection table.
      const kw = new Array(40).fill(0);
      for (let j = 0; j < 10; j++)
        kw[j] = OpCodes.Pack32LE(key[4 * j], key[4 * j + 1], key[4 * j + 2], key[4 * j + 3]);

      // Four register stages: shift state S, and the B/A/P feedback chain.
      let S = OpCodes.ToUint32(SEED);
      let B = OpCodes.ToUint32(1);
      let A = OpCodes.ToUint32(~SEED);
      let P = OpCodes.ToUint32(~1);

      const out = [];
      for (let i = 0; i < 10; i++) {
        const odd = OpCodes.And32(i, 1) !== 0;
        for (let j = 0; j < 80; j++) {
          let C;
          if (i === 4 || i === 9)
            C = OpCodes.Xor32(OpCodes.Xor32(A, B), P);                       // linear combiner
          else if (!odd)
            C = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(A, B), OpCodes.And32(B, P)), OpCodes.And32(A, P));      // majority
          else
            C = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(A, B), (~B)), P);               // OR-dominated boolean

          const F = OpCodes.ToUint32(kw[j % 40] + OpCodes.RotR32(C, 7) + S);

          const nS = OpCodes.RotR32(B, 11);
          S = nS;
          B = A;
          A = P;
          P = F;
        }
        out.push(OpCodes.ToUint32(S), OpCodes.ToUint32(B), OpCodes.ToUint32(A), OpCodes.ToUint32(P));
      }
      return out;
    }

    // Keyed mixing function used inside each round (returns [out0, out1]).
    _G(round, in0, in1) {
      const s = this._sched;
      const base = round * 4;
      const t0 = s[base], t1 = s[base + 1], t2 = s[base + 2], t3 = s[base + 3];

      const A = OpCodes.Mul32(in0, t0);
      const Braw = OpCodes.ToUint32((OpCodes.Xor32(in1, A)) + OpCodes.RotL32(in1, 13));
      const B = OpCodes.Mul32(Braw, t1);
      const out0 = (OpCodes.ToUint32((OpCodes.Xor32(A, B)) + OpCodes.RotL32(A, 21)));
      return [
        OpCodes.ToUint32(out0 + t2),
        OpCodes.ToUint32(B + t3)
      ];
    }

    _encryptBlock(block) {
      const s = this._sched;
      let a = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let b = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let c = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let d = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // Additive pre-whitening.
      a = OpCodes.ToUint32(a + s[32]);
      b = OpCodes.ToUint32(b + s[33]);
      c = OpCodes.ToUint32(c + s[34]);
      d = OpCodes.ToUint32(d + s[35]);

      // Two passes of the forward substitution layer (xor mux, then ror-8).
      for (let p = 0; p < 2; p++) {
        a = OpCodes.RotR32(OpCodes.Xor32(a, mux(b, c, d)), 8);
        b = OpCodes.RotR32(OpCodes.Xor32(b, mux(c, d, a)), 8);
        c = OpCodes.RotR32(OpCodes.Xor32(c, mux(d, a, b)), 8);
        d = OpCodes.RotR32(OpCodes.Xor32(d, mux(a, b, c)), 8);
      }

      // Eight mixing rounds.
      for (let round = 0; round < 8; round++) {
        const [o0, o1] = this._G(round, OpCodes.Xor32(b, d), OpCodes.Xor32(a, c));
        a = OpCodes.Xor32(a, o0);
        b = OpCodes.Xor32(b, o1);
        c = OpCodes.Xor32(c, o0);
        d = OpCodes.Xor32(d, o1);

        const t = b; b = c; c = t;                  // swap b<->c

        if (round < 7) {
          a = OpCodes.RotL32(a, 5);
          d = OpCodes.RotL32(d, 5);
          b = OpCodes.RotR32(b, OpCodes.And32(a, 31));
          c = OpCodes.RotR32(c, OpCodes.And32(d, 31));
        }
      }

      // Two passes of the inverse substitution layer (rol-8, then xor mux).
      for (let p = 0; p < 2; p++) {
        d = OpCodes.Xor32(OpCodes.RotL32(d, 8), mux(a, b, c));
        c = OpCodes.Xor32(OpCodes.RotL32(c, 8), mux(d, a, b));
        b = OpCodes.Xor32(OpCodes.RotL32(b, 8), mux(c, d, a));
        a = OpCodes.Xor32(OpCodes.RotL32(a, 8), mux(b, c, d));
      }

      // Additive post-whitening (subtraction).
      a = OpCodes.ToUint32(a - s[36]);
      b = OpCodes.ToUint32(b - s[37]);
      c = OpCodes.ToUint32(c - s[38]);
      d = OpCodes.ToUint32(d - s[39]);

      return [
        ...OpCodes.Unpack32LE(a), ...OpCodes.Unpack32LE(b),
        ...OpCodes.Unpack32LE(c), ...OpCodes.Unpack32LE(d)
      ];
    }

    _decryptBlock(block) {
      const s = this._sched;
      let a = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let b = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let c = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let d = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // Undo post-whitening (add back words 36..39).
      a = OpCodes.ToUint32(a + s[36]);
      b = OpCodes.ToUint32(b + s[37]);
      c = OpCodes.ToUint32(c + s[38]);
      d = OpCodes.ToUint32(d + s[39]);

      // Forward substitution layer x2 (same as encryption prologue).
      for (let p = 0; p < 2; p++) {
        a = OpCodes.RotR32(OpCodes.Xor32(a, mux(b, c, d)), 8);
        b = OpCodes.RotR32(OpCodes.Xor32(b, mux(c, d, a)), 8);
        c = OpCodes.RotR32(OpCodes.Xor32(c, mux(d, a, b)), 8);
        d = OpCodes.RotR32(OpCodes.Xor32(d, mux(a, b, c)), 8);
      }

      // Eight mixing rounds in reverse order.
      for (let round = 7; round >= 0; round--) {
        const t = b; b = c; c = t;                  // undo swap first

        const [o0, o1] = this._G(round, OpCodes.Xor32(b, d), OpCodes.Xor32(a, c));
        a = OpCodes.Xor32(a, o0);
        b = OpCodes.Xor32(b, o1);
        c = OpCodes.Xor32(c, o0);
        d = OpCodes.Xor32(d, o1);

        if (round > 0) {
          b = OpCodes.RotL32(b, OpCodes.And32(a, 31));
          c = OpCodes.RotL32(c, OpCodes.And32(d, 31));
          a = OpCodes.RotR32(a, 5);
          d = OpCodes.RotR32(d, 5);
        }
      }

      // Inverse substitution layer x2 (same as encryption epilogue).
      for (let p = 0; p < 2; p++) {
        d = OpCodes.Xor32(OpCodes.RotL32(d, 8), mux(a, b, c));
        c = OpCodes.Xor32(OpCodes.RotL32(c, 8), mux(d, a, b));
        b = OpCodes.Xor32(OpCodes.RotL32(b, 8), mux(c, d, a));
        a = OpCodes.Xor32(OpCodes.RotL32(a, 8), mux(b, c, d));
      }

      // Undo pre-whitening (subtract words 32..35).
      a = OpCodes.ToUint32(a - s[32]);
      b = OpCodes.ToUint32(b - s[33]);
      c = OpCodes.ToUint32(c - s[34]);
      d = OpCodes.ToUint32(d - s[35]);

      return [
        ...OpCodes.Unpack32LE(a), ...OpCodes.Unpack32LE(b),
        ...OpCodes.Unpack32LE(c), ...OpCodes.Unpack32LE(d)
      ];
    }
  }

  const algorithmInstance = new DarkCryptSC6BAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSC6BAlgorithm, DarkCryptSC6BInstance };
}));
