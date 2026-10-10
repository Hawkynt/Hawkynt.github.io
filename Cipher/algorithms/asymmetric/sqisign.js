/*
 * SQIsign - Short Quaternion and Isogeny Signature
 * Verification of the NIST additional-signatures round 2 submission (v2.0)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WHAT THIS FILE DOES AND DOES NOT DO
 *
 * This file verifies SQIsign signatures. It does not produce them.
 *
 * A SQIsign public key is a supersingular elliptic curve E_pk, one of the
 * curves 2^e-isogenous to others over GF(p^2), and a signature proves
 * knowledge of E_pk's endomorphism ring by exhibiting an isogeny from a
 * challenge curve back to a commitment curve. Producing that isogeny means
 * translating between ideals of a maximal order in a quaternion algebra and
 * isogenies: lattice reduction, norm equations, the KLPT-style search for an
 * ideal of suitable norm, and a two-dimensional isogeny that embeds its
 * answer. None of that can be checked piecewise against anything published -
 * the signer's randomness is spent inside those searches - so signing is left
 * out rather than approximated, and CreateInstance(false) returns null, the
 * way this collection already signals a direction an algorithm does not
 * offer. Verification is the whole of the interface.
 *
 * Verification is implemented in full, following the round 2 specification
 * and its reference implementation:
 *
 *   1. decode the public curve A and its torsion hint, and the signature: the
 *      auxiliary curve A, the backtracking and the length of the small
 *      2-isogeny, the 2x2 basis-change matrix and the challenge scalar;
 *   2. rebuild the canonical basis of E_pk[2^f] from the hint and walk the
 *      challenge isogeny of degree 2^(f - backtracking) whose kernel is
 *      P + [chall]Q, landing on the challenge curve;
 *   3. rebuild the canonical bases of the challenge and auxiliary curves,
 *      apply the basis-change matrix with a two-scalar ladder, and walk the
 *      small 2^r response isogeny when there is one;
 *   4. glue E_chall x E_aux into an abelian surface in the theta model, walk
 *      the chain of (2,2)-isogenies whose kernel the two bases generate, and
 *      require that the chain splits into a product again: the first factor
 *      is the commitment curve;
 *   5. hash the j-invariants of E_pk and the commitment curve with the
 *      message through SHAKE256, iterated, and accept only when the result is
 *      the challenge scalar the signature carried.
 *
 * Arithmetic is exact over GF(p^2) = GF(p)[i]/(i^2 + 1) with BigInt, for the
 * three primes of the submission:
 *
 *   SQIsign-I    p = 5 * 2^248 - 1    public key  65   signature 148
 *   SQIsign-III  p = 65 * 2^376 - 1   public key  97   signature 224
 *   SQIsign-V    p = 27 * 2^500 - 1   public key 129   signature 292
 *
 * A signed message is laid out as the submission's crypto_sign writes it: the
 * signature followed by the message. The public key's length selects the
 * level.
 *
 * Every formula that fixes a projective representative - the ladders, the
 * doubling and isogeny formulas, the square roots that pick P - Q from x(P)
 * and x(Q), the lifting of x-only points to Jacobian coordinates - is the
 * reference's formula, because the canonical basis is defined by those
 * choices and a different but equivalent formula would verify nothing.
 *
 * KNOWN ANSWER TESTS
 *
 * The expected values below are records of the three PQCsignKAT response
 * files of the round 2 submission package, nothing else:
 *
 *   KAT/PQCsignKAT_353_SQIsign_lvl1.rsp
 *   KAT/PQCsignKAT_529_SQIsign_lvl3.rsp
 *   KAT/PQCsignKAT_701_SQIsign_lvl5.rsp
 *
 * Measured over the whole of all three files, not only the records committed
 * here: every one of the 100 signed messages of each level opens under its
 * record's public key and yields the record's message, 300 of 300, and every
 * one of them is rejected once a single bit of its message is flipped.
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== SHAKE256 =====
  //
  // The challenge is SHAKE256 iterated up to five hundred times over a few
  // dozen bytes, so a small sponge is kept here rather than borrowing the
  // collection's extendable output function, which would have to be loaded at
  // module scope and would then be credited to this directory.

  /** @type {uint32[]} */
  const KECCAK_RC_LOW = [
    0x00000001, 0x00008082, 0x0000808A, 0x80008000, 0x0000808B, 0x80000001,
    0x80008081, 0x00008009, 0x0000008A, 0x00000088, 0x80008009, 0x8000000A,
    0x8000808B, 0x0000008B, 0x00008089, 0x00008003, 0x00008002, 0x00000080,
    0x0000800A, 0x8000000A, 0x80008081, 0x00008080, 0x80000001, 0x80008008
  ];

  /** @type {uint32[]} */
  const KECCAK_RC_HIGH = [
    0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000,
    0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000
  ];

  /** @type {int32[]} */
  const KECCAK_ROTATION = [
     0,  1, 62, 28, 27, 36, 44,  6, 55, 20,  3, 10, 43,
    25, 39, 41, 45, 15, 21,  8, 18,  2, 61, 56, 14
  ];

  const SHAKE256_RATE = 136;

  /**
   * One Keccak-f[1600] permutation over a state held as 25 pairs of 32 bit
   * halves, low half first.
   * @param {int32[]} state - 50 words, modified in place
   */
  function KeccakPermute(state) {
    const b = new Int32Array(50);
    const c = new Int32Array(10);
    const d = new Int32Array(10);

    for (let round = 0; round < 24; ++round) {
      for (let x = 0; x < 5; ++x) {
        /** @type {uint32} */
        let low = 0;
        /** @type {uint32} */
        let high = 0;
        for (let y = 0; y < 5; ++y) {
          low = OpCodes.Xor32(low, state[2 * (x + 5 * y)]);
          high = OpCodes.Xor32(high, state[2 * (x + 5 * y) + 1]);
        }
        c[2 * x] = low;
        c[2 * x + 1] = high;
      }

      for (let x = 0; x < 5; ++x) {
        const low = c[2 * ((x + 1) % 5)];
        const high = c[2 * ((x + 1) % 5) + 1];
        const rotatedLow = OpCodes.Or32(OpCodes.Shl32(low, 1), OpCodes.Shr32(high, 31));
        const rotatedHigh = OpCodes.Or32(OpCodes.Shl32(high, 1), OpCodes.Shr32(low, 31));
        d[2 * x] = OpCodes.Xor32(c[2 * ((x + 4) % 5)], rotatedLow);
        d[2 * x + 1] = OpCodes.Xor32(c[2 * ((x + 4) % 5) + 1], rotatedHigh);
      }

      for (let x = 0; x < 5; ++x)
        for (let y = 0; y < 5; ++y) {
          const i = x + 5 * y;
          state[2 * i] = OpCodes.Xor32(state[2 * i], d[2 * x]);
          state[2 * i + 1] = OpCodes.Xor32(state[2 * i + 1], d[2 * x + 1]);
        }

      for (let x = 0; x < 5; ++x)
        for (let y = 0; y < 5; ++y) {
          const i = x + 5 * y;
          const rotation = KECCAK_ROTATION[i];
          const low = state[2 * i];
          const high = state[2 * i + 1];
          /** @type {uint32} */
          let newLow = 0;
          /** @type {uint32} */
          let newHigh = 0;
          if (rotation === 0) {
            newLow = OpCodes.ToDWord(low);
            newHigh = OpCodes.ToDWord(high);
          } else if (rotation < 32) {
            newLow = OpCodes.Or32(OpCodes.Shl32(low, rotation), OpCodes.Shr32(high, 32 - rotation));
            newHigh = OpCodes.Or32(OpCodes.Shl32(high, rotation), OpCodes.Shr32(low, 32 - rotation));
          } else if (rotation === 32) {
            newLow = OpCodes.ToDWord(high);
            newHigh = OpCodes.ToDWord(low);
          } else {
            const shift = rotation - 32;
            newLow = OpCodes.Or32(OpCodes.Shl32(high, shift), OpCodes.Shr32(low, 32 - shift));
            newHigh = OpCodes.Or32(OpCodes.Shl32(low, shift), OpCodes.Shr32(high, 32 - shift));
          }
          const target = y + 5 * ((2 * x + 3 * y) % 5);
          b[2 * target] = newLow;
          b[2 * target + 1] = newHigh;
        }

      for (let x = 0; x < 5; ++x)
        for (let y = 0; y < 5; ++y) {
          const i = x + 5 * y;
          const next = ((x + 1) % 5) + 5 * y;
          const after = ((x + 2) % 5) + 5 * y;
          state[2 * i] = OpCodes.Xor32(b[2 * i], OpCodes.And32(OpCodes.Not32(b[2 * next]), b[2 * after]));
          state[2 * i + 1] = OpCodes.Xor32(b[2 * i + 1], OpCodes.And32(OpCodes.Not32(b[2 * next + 1]), b[2 * after + 1]));
        }

      state[0] = OpCodes.Xor32(state[0], KECCAK_RC_LOW[round]);
      state[1] = OpCodes.Xor32(state[1], KECCAK_RC_HIGH[round]);
    }
  }

  /**
   * @param {int32[]} state - state
   * @param {int32} position - position
   * @param {int32} value - value
   */
  function StateXorByte(state, position, value) {
    const word = Math.floor(position / 8);
    const byteInWord = position % 8;
    const index = 2 * word + Math.floor(byteInWord / 4);
    state[index] = OpCodes.Xor32(state[index], OpCodes.Shl32(value, 8 * (byteInWord % 4)));
  }

  /**
   * @param {int32[]} state - state
   * @param {int32} position - position
   * @returns {int32} Result
   */
  function StateReadByte(state, position) {
    const word = Math.floor(position / 8);
    const byteInWord = position % 8;
    const index = 2 * word + Math.floor(byteInWord / 4);
    return OpCodes.And32(OpCodes.Shr32(state[index], 8 * (byteInWord % 4)), 0xFF);
  }

  /**
   * SHAKE256 over the concatenation of the given byte strings.
   * @param {uint8[][]} parts - byte arrays, absorbed in order
   * @param {int32} outputLength - bytes to squeeze
   * @returns {uint8[]} the output
   */
  function Shake256(parts, outputLength) {
    const state = new Int32Array(50);
    let filled = 0;

    for (let p = 0; p < parts.length; ++p) {
      const part = parts[p];
      for (let i = 0; i < part.length; ++i) {
        StateXorByte(state, filled, OpCodes.And32(part[i], 0xFF));
        if (++filled === SHAKE256_RATE) {
          KeccakPermute(state);
          filled = 0;
        }
      }
    }

    StateXorByte(state, filled, 0x1F);
    StateXorByte(state, SHAKE256_RATE - 1, 0x80);
    KeccakPermute(state);

    /** @type {uint8[]} */
    const out = new Array(outputLength);
    let offset = 0;
    for (let i = 0; i < outputLength; ++i) {
      if (offset === SHAKE256_RATE) {
        KeccakPermute(state);
        offset = 0;
      }
      out[i] = StateReadByte(state, offset++);
    }
    return out;
  }

  // ===== integers =====
  //
  // Scalars and field elements travel as BigInt. Bits are read by division
  // rather than by shifting, and powers of two are tabulated.

  /**
   * @param {int32} e - e
   * @returns {BigInt} Result
   */
  function PowerOfTwo(e) {
    return 2n ** BigInt(e);
  }

  /**
   * Little-endian bits of a non-negative BigInt, `count` of them.
   * @param {BigInt} value - value
   * @param {int32} count - count
   * @returns {int32[]} Result
   */
  function BitsOf(value, count) {
    /** @type {int32[]} */
    const bits = new Array(count);
    let v = value;
    for (let i = 0; i < count; ++i) {
      /** @type {int32} */
      const bit = Number(v % 2n);
      bits[i] = bit;
      v = v / 2n;
    }
    return bits;
  }

  /**
   * Little-endian bytes to BigInt.
   * @param {uint8[]} bytes - bytes
   * @param {int32} offset - offset
   * @param {int32} length - length
   * @returns {BigInt} Result
   */
  function DecodeLittleEndian(bytes, offset, length) {
    /** @type {BigInt} */
    let v = 0n;
    for (let i = length - 1; i >= 0; --i) v = v * 256n + BigInt(bytes[offset + i]);
    return v;
  }

  /**
   * BigInt to `length` little-endian bytes.
   * @param {BigInt} value - value
   * @param {int32} length - length
   * @returns {uint8[]} Result
   */
  function EncodeLittleEndian(value, length) {
    /** @type {uint8[]} */
    const out = new Array(length);
    let v = value;
    for (let i = 0; i < length; ++i) {
      /** @type {uint8} */
      const octet = Number(v % 256n);
      out[i] = octet;
      v = v / 256n;
    }
    return out;
  }

  // ===== the field GF(p^2) =====

  /**
   * Arithmetic of GF(p) and GF(p^2) = GF(p)[i]/(i^2 + 1) for one prime
   * p = 3 mod 4. Elements of GF(p) are BigInt in [0, p); elements of GF(p^2)
   * are Fp2 pairs of them.
   */
  class SqiField {
    /**
     * @param {BigInt} P - the prime
     * @param {int32} encodedBytes - bytes of an encoded element of GF(p)
     */
    constructor(P, encodedBytes) {
      /** @type {BigInt} */
      this.P = P;
      /** @type {int32} */
      this.bytes = encodedBytes;
      /** @type {BigInt} */
      this.PP = P * P;
      /** @type {BigInt} */
      this.INV2 = (P + 1n) / 2n;
      /** @type {BigInt} */
      const twoPPlus1 = 2n * P + 1n;
      /** @type {BigInt} */
      this.INV3 = (twoPPlus1 % 3n === 0n) ? twoPPlus1 / 3n : (P + 1n) / 3n;
      // Exponents, as bit strings consumed from the top.
      /** @type {int32[]} */
      this.E_SQRT = SqiField.exponentBits((P + 1n) / 4n);
      /** @type {int32[]} */
      this.E_PRO = SqiField.exponentBits((P - 3n) / 4n);
      /** @type {int32[]} */
      this.E_INV = SqiField.exponentBits(P - 2n);
      /** @type {int32[]} */
      this.E_LEG = SqiField.exponentBits((P - 1n) / 2n);
    }

    /**
     * @param {BigInt} e - a positive exponent
     * @returns {int32[]} its bits, least significant first
     */
    static exponentBits(e) {
      return BitsOf(e, OpCodes.BitCountN(e));
    }

    /**
     * @param {BigInt} a - a
     * @param {int32[]} bits - bits
     * @returns {BigInt} Result
     */
    _pow(a, bits) {
      const P = this.P;
      /** @type {BigInt} */
      let r = 1n;
      for (let i = bits.length - 1; i >= 0; --i) {
        r = r * r % P;
        if (bits[i]) r = r * a % P;
      }
      return r;
    }

    /**
     * @param {BigInt} a - a
     * @param {BigInt} b - b
     * @returns {BigInt} a + b
     */
    fpAdd(a, b) { const s = a + b; return s >= this.P ? s - this.P : s; }
    /**
     * @param {BigInt} a - a
     * @param {BigInt} b - b
     * @returns {BigInt} a - b
     */
    fpSub(a, b) { const s = a - b; return s < 0n ? s + this.P : s; }
    /**
     * @param {BigInt} a - a
     * @returns {BigInt} -a
     */
    fpNeg(a) { return (a === 0n ? a : this.P - a); }
    /**
     * @param {BigInt} a - a
     * @param {BigInt} b - b
     * @returns {BigInt} a b
     */
    fpMul(a, b) { return a * b % this.P; }
    /**
     * @param {BigInt} a - a
     * @returns {BigInt} 1 / a
     */
    fpInv(a) { return this._pow(a, this.E_INV); }
    /**
     * @param {BigInt} a - a
     * @returns {BigInt} a^((p + 1) / 4)
     */
    fpSqrt(a) { return this._pow(a, this.E_SQRT); }
    /**
     * @param {BigInt} a - a
     * @returns {BigInt} a^((p - 3) / 4)
     */
    fpExp3Div4(a) { return this._pow(a, this.E_PRO); }
    /**
     * @param {BigInt} a - a
     * @returns {boolean} whether a is a square
     */
    fpIsSquare(a) { return (a === 0n) || (this._pow(a, this.E_LEG) === 1n); }
    /**
     * @param {BigInt} a - a
     * @returns {BigInt} a / 2
     */
    fpHalf(a) { return a * this.INV2 % this.P; }
    /**
     * @param {BigInt} a - a
     * @returns {BigInt} a / 3
     */
    fpDiv3(a) { return a * this.INV3 % this.P; }
    // --- GF(p^2) ---
    /**
     * @returns {Fp2} zero
     */
    zero() { return new Fp2(0n, 0n); }
    /**
     * @returns {Fp2} one
     */
    one() { return new Fp2(1n, 0n); }
    /**
     * @param {BigInt} re - the real part
     * @param {BigInt} im - the imaginary part
     * @returns {Fp2} re + i im
     */
    fromParts(re, im) { return new Fp2(re, im); }
    /**
     * @param {int32} n - a small integer
     * @returns {Fp2} n
     */
    small(n) { return new Fp2(BigInt(n) % this.P, 0n); }
    /**
     * @param {Fp2} a - a
     * @param {Fp2} b - b
     * @returns {Fp2} a + b
     */
    add(a, b) {
      const P = this.P;
      let re = a.re + b.re; if (re >= P) re -= P;
      let im = a.im + b.im; if (im >= P) im -= P;
      return new Fp2(re, im);
    }
    /**
     * @param {Fp2} a - a
     * @param {Fp2} b - b
     * @returns {Fp2} a - b
     */
    sub(a, b) {
      const P = this.P;
      let re = a.re - b.re; if (re < 0n) re += P;
      let im = a.im - b.im; if (im < 0n) im += P;
      return new Fp2(re, im);
    }
    /**
     * @param {Fp2} a - a
     * @returns {Fp2} -a
     */
    neg(a) { return new Fp2(a.re === 0n ? 0n : this.P - a.re, a.im === 0n ? 0n : this.P - a.im); }
    /**
     * @param {Fp2} a - a
     * @param {Fp2} b - b
     * @returns {Fp2} a b
     */
    mul(a, b) {
      const P = this.P;
      return new Fp2(
        (a.re * b.re + this.PP - a.im * b.im) % P,
        (a.re * b.im + a.im * b.re) % P
      );
    }
    /**
     * @param {Fp2} a - a
     * @returns {Fp2} a^2
     */
    sqr(a) {
      const P = this.P;
      return new Fp2(
        (a.re + a.im) * (a.re + P - a.im) % P,
        2n * a.re * a.im % P
      );
    }
    /**
     * @param {Fp2} a - a
     * @param {int32} n - a small integer
     * @returns {Fp2} n a
     */
    mulSmall(a, n) { return new Fp2(a.re * BigInt(n) % this.P, a.im * BigInt(n) % this.P); }
    /**
     * @param {Fp2} a - a
     * @returns {Fp2} a / 2
     */
    half(a) { return new Fp2(a.re * this.INV2 % this.P, a.im * this.INV2 % this.P); }
    /**
     * @param {Fp2} a - a
     * @returns {Fp2} a / 3
     */
    div3(a) { return new Fp2(a.re * this.INV3 % this.P, a.im * this.INV3 % this.P); }
    /**
     * @param {Fp2} a - a
     * @returns {boolean} whether a is zero
     */
    isZero(a) { return a.re === 0n && a.im === 0n; }
    /**
     * @param {Fp2} a - a
     * @returns {boolean} whether a is one
     */
    isOne(a) { return a.re === 1n && a.im === 0n; }
    /**
     * @param {Fp2} a - a
     * @param {Fp2} b - b
     * @returns {boolean} whether a equals b
     */
    equal(a, b) { return a.re === b.re && a.im === b.im; }
    /**
     * @param {Fp2} a - a
     * @returns {Fp2} a copy of a
     */
    copy(a) { return new Fp2(a.re, a.im); }
    /**
     * @param {Fp2} a - a
     * @returns {Fp2} 1 / a
     */
    inv(a) {
      const P = this.P;
      const norm = (a.re * a.re + a.im * a.im) % P;
      const t = this._pow(norm, this.E_INV);
      return new Fp2(a.re * t % P, (P - a.im * t % P) % P);
    }
    /**
     * @param {Fp2} a - a
     * @returns {boolean} whether a is a square
     */
    isSquare(a) {
      const norm = (a.re * a.re + a.im * a.im) % this.P;
      return (norm === 0n) || (this._pow(norm, this.E_LEG) === 1n);
    }
    // The canonical square root of the reference (Aardal et al.,
    // eprint 2024/1563): the root whose real part is even, or whose
    // imaginary part is even when the real part is zero.
    /**
     * @param {Fp2} a - a square
     * @returns {Fp2} its canonical root
     */
    sqrt(a) {
      const P = this.P;
      /** @type {BigInt} */
      let x0 = this._pow((a.re * a.re + a.im * a.im) % P, this.E_SQRT);
      if (a.im === 0n) x0 = a.re;
      x0 = this.fpAdd(x0, a.re);
      const t0 = this.fpAdd(x0, x0);
      /** @type {BigInt} */
      let x1 = this._pow(t0, this.E_PRO);
      x0 = x0 * x1 % P;
      x1 = x1 * a.im % P;
      /** @type {BigInt} */
      let t1 = this.fpAdd(x0, x0);
      t1 = t1 * t1 % P;
      const f = (t0 === t1);
      /** @type {BigInt} */
      let r0;
      /** @type {BigInt} */
      let r1;
      if (f) { r0 = x0; r1 = x1; } else { r0 = x1; r1 = this.fpNeg(x0); }
      const negate = (r0 % 2n === 1n) || (r0 === 0n && r1 % 2n === 1n);
      if (negate) { r0 = this.fpNeg(r0); r1 = this.fpNeg(r1); }
      return new Fp2(r0, r1);
    }
    /**
     * Encode an element of GF(p^2): real part, then imaginary, little-endian.
     * @param {Fp2} a - a
     * @returns {uint8[]} its encoding
     */
    encode(a) { return EncodeLittleEndian(a.re, this.bytes).concat(EncodeLittleEndian(a.im, this.bytes)); }
    /**
     * Decode; a non-canonical half decodes to zero, as the reference does.
     * @param {uint8[]} bytes - the encoding
     * @param {int32} offset - where it starts
     * @returns {Fp2} the element
     */
    decode(bytes, offset) {
      let re = DecodeLittleEndian(bytes, offset, this.bytes);
      let im = DecodeLittleEndian(bytes, offset + this.bytes, this.bytes);
      if (re >= this.P) re = 0n;
      if (im >= this.P) im = 0n;
      return new Fp2(re, im);
    }
    /**
     * Invert every element at once; a zero among them zeroes them all.
     * @param {Fp2[]} xs - the elements
     * @returns {Fp2[]} their inverses
     */
    batchedInv(xs) {
      const len = xs.length;
      /** @type {Fp2[]} */
      const t1 = new Array(len);
      t1[0] = xs[0];
      for (let i = 1; i < len; ++i) t1[i] = this.mul(t1[i - 1], xs[i]);
      const inverse = this.inv(t1[len - 1]);
      /** @type {Fp2[]} */
      const t2 = new Array(len);
      t2[0] = inverse;
      for (let i = 1; i < len; ++i) t2[i] = this.mul(t2[i - 1], xs[len - i]);
      /** @type {Fp2[]} */
      const out = new Array(len);
      out[0] = t2[len - 1];
      for (let i = 1; i < len; ++i) out[i] = this.mul(t1[i - 1], t2[len - i - 1]);
      return out;
    }
  }

  // ===== value classes =====

  /** An element re + i im of GF(p^2). */
  class Fp2 {
    /**
     * @param {BigInt} re - the real part
     * @param {BigInt} im - the imaginary part
     */
    constructor(re, im) {
      /** @type {BigInt} */
      this.re = re;
      /** @type {BigInt} */
      this.im = im;
    }
  }

  /** One parameter set, in the order the object literal held its fields. */
  class SqiParams {
    /**
     * @param {string} name - the set name
     * @param {SqiField} F - its field
     * @param {BigInt} cofactor - the cofactor of p + 1
     * @param {int32} cofactorBits - its bit length
     * @param {int32} torsionPower - the power of two dividing p + 1
     * @param {int32} responseLength - the response length
     * @param {int32} securityBits - the security level in bits
     * @param {int32} hashIterations - the SHAKE256 iterations of the challenge
     * @param {int32} fpBytes - octets of an element of GF(p)
     * @param {int32} fp2Bytes - octets of an element of GF(p^2)
     * @param {int32} publicKeyBytes - octets of a public key
     * @param {int32} signatureBytes - octets of a signature
     * @param {int32} matrixEntryBytes - octets of a matrix entry
     * @param {Fp2} e0P - x(P) of the basis of E0
     * @param {Fp2} e0Q - x(Q) of the basis of E0
     */
    constructor(name, F, cofactor, cofactorBits, torsionPower, responseLength, securityBits, hashIterations,
                fpBytes, fp2Bytes, publicKeyBytes, signatureBytes, matrixEntryBytes, e0P, e0Q) {
      /** @type {string} */
      this.name = name;
      /** @type {SqiField} */
      this.F = F;
      /** @type {BigInt} */
      this.cofactor = cofactor;
      /** @type {int32} */
      this.cofactorBits = cofactorBits;
      /** @type {int32} */
      this.torsionPower = torsionPower;
      /** @type {int32} */
      this.responseLength = responseLength;
      /** @type {int32} */
      this.securityBits = securityBits;
      /** @type {int32} */
      this.hashIterations = hashIterations;
      /** @type {int32} */
      this.fpBytes = fpBytes;
      /** @type {int32} */
      this.fp2Bytes = fp2Bytes;
      /** @type {int32} */
      this.publicKeyBytes = publicKeyBytes;
      /** @type {int32} */
      this.signatureBytes = signatureBytes;
      /** @type {int32} */
      this.matrixEntryBytes = matrixEntryBytes;
      /** @type {Fp2} */
      this.e0P = e0P;
      /** @type {Fp2} */
      this.e0Q = e0Q;
    }
  }

  /** A point (x : z) of the Kummer line. */
  class XzPoint {
    /**
     * @param {Fp2} x - X
     * @param {Fp2} z - Z
     */
    constructor(x, z) {
      /** @type {Fp2} */
      this.x = x;
      /** @type {Fp2} */
      this.z = z;
    }
  }

  /** A Montgomery curve (A : C) with its (A + 2C : 4C). */
  class MontCurve {
    /**
     * @param {Fp2} A - A
     * @param {Fp2} C - C
     * @param {XzPoint} A24 - (A + 2C : 4C)
     * @param {boolean} normalized - whether A24 has z = 1
     */
    constructor(A, C, A24, normalized) {
      /** @type {Fp2} */
      this.A = A;
      /** @type {Fp2} */
      this.C = C;
      /** @type {XzPoint} */
      this.A24 = A24;
      /** @type {boolean} */
      this.normalized = normalized;
    }
  }

  /** x(P), x(Q) and x(P - Q). */
  class XzBasis {
    /**
     * @param {XzPoint} P - P
     * @param {XzPoint} Q - Q
     * @param {XzPoint} PmQ - P - Q
     */
    constructor(P, Q, PmQ) {
      /** @type {XzPoint} */
      this.P = P;
      /** @type {XzPoint} */
      this.Q = Q;
      /** @type {XzPoint} */
      this.PmQ = PmQ;
    }
  }

  /** A 2-isogeny: the codomain's (A + 2C : 4C) and the evaluation constants. */
  class Isogeny2 {
    /**
     * @param {XzPoint} A24 - the codomain
     * @param {XzPoint} K - the evaluation constants
     */
    constructor(A24, K) {
      /** @type {XzPoint} */
      this.A24 = A24;
      /** @type {XzPoint} */
      this.K = K;
    }
  }

  /** A 4-isogeny: the codomain's (A + 2C : 4C) and the evaluation constants. */
  class Isogeny4 {
    /**
     * @param {XzPoint} A24 - the codomain
     * @param {Fp2[]} K - the three evaluation constants
     */
    constructor(A24, K) {
      /** @type {XzPoint} */
      this.A24 = A24;
      /** @type {Fp2[]} */
      this.K = K;
    }
  }

  /** A Jacobian point (X : Y : Z). */
  class JacPoint {
    /**
     * @param {Fp2} x - X
     * @param {Fp2} y - Y
     * @param {Fp2} z - Z
     */
    constructor(x, y, z) {
      /** @type {Fp2} */
      this.x = x;
      /** @type {Fp2} */
      this.y = y;
      /** @type {Fp2} */
      this.z = z;
    }
  }

  /** P and Q lifted to Jacobian points, and whether P lifted. */
  class LiftedBasis {
    /**
     * @param {boolean} ok - whether y(P) exists
     * @param {JacPoint} P - P
     * @param {JacPoint} Q - Q
     */
    constructor(ok, P, Q) {
      /** @type {boolean} */
      this.ok = ok;
      /** @type {JacPoint} */
      this.P = P;
      /** @type {JacPoint} */
      this.Q = Q;
    }
  }

  /** A point in modified Jacobian coordinates of the short Weierstrass model. */
  class WsPoint {
    /**
     * @param {JacPoint} Q - the point
     * @param {Fp2} t - a Z^4
     * @param {Fp2} ao3 - A / 3
     */
    constructor(Q, t, ao3) {
      /** @type {JacPoint} */
      this.Q = Q;
      /** @type {Fp2} */
      this.t = t;
      /** @type {Fp2} */
      this.ao3 = ao3;
    }
  }

  /** A doubled point in modified Jacobian coordinates. */
  class WsDouble {
    /**
     * @param {JacPoint} Q - the point
     * @param {Fp2} u - the new a Z^4
     */
    constructor(Q, u) {
      /** @type {JacPoint} */
      this.Q = Q;
      /** @type {Fp2} */
      this.u = u;
    }
  }

  /** u, v, w with x(P + Q) = (u - v : w) and x(P - Q) = (u + v : w). */
  class AddComponents {
    /**
     * @param {Fp2} u - u
     * @param {Fp2} v - v
     * @param {Fp2} w - w
     */
    constructor(u, v, w) {
      /** @type {Fp2} */
      this.u = u;
      /** @type {Fp2} */
      this.v = v;
      /** @type {Fp2} */
      this.w = w;
    }
  }

  /** A couple of Jacobian points on E1 x E2. */
  class JacCouple {
    /**
     * @param {JacPoint} P1 - on E1
     * @param {JacPoint} P2 - on E2
     */
    constructor(P1, P2) {
      /** @type {JacPoint} */
      this.P1 = P1;
      /** @type {JacPoint} */
      this.P2 = P2;
    }
  }

  /** A couple of x-only points on E1 x E2. */
  class XzCouple {
    /**
     * @param {XzPoint} P1 - on E1
     * @param {XzPoint} P2 - on E2
     */
    constructor(P1, P2) {
      /** @type {XzPoint} */
      this.P1 = P1;
      /** @type {XzPoint} */
      this.P2 = P2;
    }
  }

  /** The kernel of the dimension-two isogeny: T1, T2 and T1 - T2 on E1 x E2. */
  class CoupleKernel {
    /**
     * @param {XzCouple} T1 - T1
     * @param {XzCouple} T2 - T2
     * @param {XzCouple} T1m2 - T1 - T2
     */
    constructor(T1, T2, T1m2) {
      /** @type {XzCouple} */
      this.T1 = T1;
      /** @type {XzCouple} */
      this.T2 = T2;
      /** @type {XzCouple} */
      this.T1m2 = T1m2;
    }
  }

  /** A product E1 x E2. */
  class CurvePair {
    /**
     * @param {MontCurve} E1 - E1
     * @param {MontCurve} E2 - E2
     */
    constructor(E1, E2) {
      /** @type {MontCurve} */
      this.E1 = E1;
      /** @type {MontCurve} */
      this.E2 = E2;
    }
  }

  /** A theta point (x : y : z : t). */
  class ThetaPoint {
    /**
     * @param {Fp2} x - x
     * @param {Fp2} y - y
     * @param {Fp2} z - z
     * @param {Fp2} t - t
     */
    constructor(x, y, z, t) {
      /** @type {Fp2} */
      this.x = x;
      /** @type {Fp2} */
      this.y = y;
      /** @type {Fp2} */
      this.z = z;
      /** @type {Fp2} */
      this.t = t;
    }
  }

  /** The products of theta constants doubling needs. */
  class ThetaPrecomputation {
    /**
     * @param {Fp2} XYZ0 - XYZ0
     * @param {Fp2} XYT0 - XYT0
     * @param {Fp2} YZT0 - YZT0
     * @param {Fp2} XZT0 - XZT0
     */
    constructor(XYZ0, XYT0, YZT0, XZT0) {
      /** @type {Fp2} */
      this.XYZ0 = XYZ0;
      /** @type {Fp2} */
      this.XYT0 = XYT0;
      /** @type {Fp2} */
      this.YZT0 = YZT0;
      /** @type {Fp2} */
      this.XZT0 = XZT0;
    }
  }

  /** A theta structure: its null point and, once computed, its precomputation. */
  class ThetaStructure {
    /**
     * @param {ThetaPoint} nul - the null point
     * @param {ThetaPrecomputation} pre - the precomputation, or null
     */
    constructor(nul, pre) {
      /** @type {ThetaPoint} */
      this.null = nul;
      /** @type {ThetaPrecomputation} */
      this.pre = pre;
    }
  }

  /** The action of a 4-torsion point by translation. */
  class TranslationMatrix {
    /**
     * @param {Fp2} g00 - g00
     * @param {Fp2} g01 - g01
     * @param {Fp2} g10 - g10
     * @param {Fp2} g11 - g11
     */
    constructor(g00, g01, g10, g11) {
      /** @type {Fp2} */
      this.g00 = g00;
      /** @type {Fp2} */
      this.g01 = g01;
      /** @type {Fp2} */
      this.g10 = g10;
      /** @type {Fp2} */
      this.g11 = g11;
    }
  }

  /** A projective pair (x : y). */
  class ProjectivePair {
    /**
     * @param {Fp2} x - x
     * @param {Fp2} y - y
     */
    constructor(x, y) {
      /** @type {Fp2} */
      this.x = x;
      /** @type {Fp2} */
      this.y = y;
    }
  }

  /** The gluing isogeny E1 x E2 -> A. */
  class GluingIsogeny {
    /**
     * @param {Fp2[][]} M - the change of basis
     * @param {JacCouple} xyK1_8 - the 8-torsion couple
     * @param {CurvePair} domain - E1 x E2
     * @param {ThetaPoint} codomain - the codomain's null point
     * @param {ProjectivePair} imageK1_8 - the image of K1_8
     */
    constructor(M, xyK1_8, domain, codomain, imageK1_8) {
      /** @type {Fp2[][]} */
      this.M = M;
      /** @type {JacCouple} */
      this.xyK1_8 = xyK1_8;
      /** @type {CurvePair} */
      this.domain = domain;
      /** @type {ThetaPoint} */
      this.codomain = codomain;
      /** @type {ProjectivePair} */
      this.imageK1_8 = imageK1_8;
    }
  }

  /** A (2,2)-isogeny of the theta model. */
  class ThetaIsogeny {
    /**
     * @param {boolean} hadamard1 - whether the domain is in the dual coordinates
     * @param {boolean} hadamard2 - whether the codomain is
     * @param {ThetaPoint} pre - the evaluation constants
     * @param {ThetaStructure} codomain - the codomain
     */
    constructor(hadamard1, hadamard2, pre, codomain) {
      /** @type {boolean} */
      this.hadamard1 = hadamard1;
      /** @type {boolean} */
      this.hadamard2 = hadamard2;
      /** @type {ThetaPoint} */
      this.pre = pre;
      /** @type {ThetaStructure} */
      this.codomain = codomain;
    }
  }

  /** The base change that puts the splitting in product position. */
  class Splitting {
    /**
     * @param {Fp2[][]} M - the base change
     * @param {ThetaStructure} B - the structure after it
     */
    constructor(M, B) {
      /** @type {Fp2[][]} */
      this.M = M;
      /** @type {ThetaStructure} */
      this.B = B;
    }
  }

  /** A decoded public key. */
  class SqiPublicKey {
    /**
     * @param {Fp2} A - the curve coefficient
     * @param {int32} hint - the basis hint
     */
    constructor(A, hint) {
      /** @type {Fp2} */
      this.A = A;
      /** @type {int32} */
      this.hint = hint;
    }
  }

  /** A decoded signature, its fields in the order decoding fills them. */
  class SqiSignature {
    constructor() {
      /** @type {Fp2} */
      this.auxA = null;
      /** @type {int32} */
      this.backtracking = 0;
      /** @type {int32} */
      this.twoRespLength = 0;
      /** @type {BigInt[][]} */
      this.mat = null;
      /** @type {BigInt} */
      this.challenge = 0n;
      /** @type {int32} */
      this.hintAux = 0;
      /** @type {int32} */
      this.hintChall = 0;
    }
  }

  /** What opening a signed message gives. */
  class SqiOpenResult {
    /**
     * @param {boolean} accepted - whether the signature verified
     * @param {uint8[]} message - the message, or null
     * @param {string} reason - why it was rejected, or empty
     */
    constructor(accepted, message, reason) {
      /** @type {boolean} */
      this.accepted = accepted;
      /** @type {uint8[]} */
      this.message = message;
      /** @type {string} */
      this.reason = reason;
    }
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @param {BigInt} b - b
   * @returns {BigInt} F.fpAdd(a, b)
   */
  function FieldFpAdd(F, a, b) {
    /** @type {BigInt} */
    const r = F.fpAdd(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @param {BigInt} b - b
   * @returns {BigInt} F.fpSub(a, b)
   */
  function FieldFpSub(F, a, b) {
    /** @type {BigInt} */
    const r = F.fpSub(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {BigInt} F.fpNeg(a)
   */
  function FieldFpNeg(F, a) {
    /** @type {BigInt} */
    const r = F.fpNeg(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @param {BigInt} b - b
   * @returns {BigInt} F.fpMul(a, b)
   */
  function FieldFpMul(F, a, b) {
    /** @type {BigInt} */
    const r = F.fpMul(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {BigInt} F.fpInv(a)
   */
  function FieldFpInv(F, a) {
    /** @type {BigInt} */
    const r = F.fpInv(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {BigInt} F.fpSqrt(a)
   */
  function FieldFpSqrt(F, a) {
    /** @type {BigInt} */
    const r = F.fpSqrt(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {BigInt} F.fpExp3Div4(a)
   */
  function FieldFpExp3Div4(F, a) {
    /** @type {BigInt} */
    const r = F.fpExp3Div4(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {boolean} F.fpIsSquare(a)
   */
  function FieldFpIsSquare(F, a) {
    /** @type {boolean} */
    const r = F.fpIsSquare(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {BigInt} F.fpHalf(a)
   */
  function FieldFpHalf(F, a) {
    /** @type {BigInt} */
    const r = F.fpHalf(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} a - a
   * @returns {BigInt} F.fpDiv3(a)
   */
  function FieldFpDiv3(F, a) {
    /** @type {BigInt} */
    const r = F.fpDiv3(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @returns {Fp2} F.zero()
   */
  function FieldZero(F) {
    /** @type {Fp2} */
    const r = F.zero();
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @returns {Fp2} F.one()
   */
  function FieldOne(F) {
    /** @type {Fp2} */
    const r = F.one();
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {BigInt} re - re
   * @param {BigInt} im - im
   * @returns {Fp2} F.fromParts(re, im)
   */
  function FieldOf(F, re, im) {
    /** @type {Fp2} */
    const r = F.fromParts(re, im);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {int32} n - n
   * @returns {Fp2} F.small(n)
   */
  function FieldSmall(F, n) {
    /** @type {Fp2} */
    const r = F.small(n);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @param {Fp2} b - b
   * @returns {Fp2} F.add(a, b)
   */
  function FieldAdd(F, a, b) {
    /** @type {Fp2} */
    const r = F.add(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @param {Fp2} b - b
   * @returns {Fp2} F.sub(a, b)
   */
  function FieldSub(F, a, b) {
    /** @type {Fp2} */
    const r = F.sub(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.neg(a)
   */
  function FieldNeg(F, a) {
    /** @type {Fp2} */
    const r = F.neg(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @param {Fp2} b - b
   * @returns {Fp2} F.mul(a, b)
   */
  function FieldMul(F, a, b) {
    /** @type {Fp2} */
    const r = F.mul(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.sqr(a)
   */
  function FieldSqr(F, a) {
    /** @type {Fp2} */
    const r = F.sqr(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @param {int32} n - n
   * @returns {Fp2} F.mulSmall(a, n)
   */
  function FieldMulSmall(F, a, n) {
    /** @type {Fp2} */
    const r = F.mulSmall(a, n);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.half(a)
   */
  function FieldHalf(F, a) {
    /** @type {Fp2} */
    const r = F.half(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.div3(a)
   */
  function FieldDiv3(F, a) {
    /** @type {Fp2} */
    const r = F.div3(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {boolean} F.isZero(a)
   */
  function FieldIsZero(F, a) {
    /** @type {boolean} */
    const r = F.isZero(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {boolean} F.isOne(a)
   */
  function FieldIsOne(F, a) {
    /** @type {boolean} */
    const r = F.isOne(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @param {Fp2} b - b
   * @returns {boolean} F.equal(a, b)
   */
  function FieldEqual(F, a, b) {
    /** @type {boolean} */
    const r = F.equal(a, b);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.copy(a)
   */
  function FieldCopy(F, a) {
    /** @type {Fp2} */
    const r = F.copy(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.inv(a)
   */
  function FieldInv(F, a) {
    /** @type {Fp2} */
    const r = F.inv(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {boolean} F.isSquare(a)
   */
  function FieldIsSquare(F, a) {
    /** @type {boolean} */
    const r = F.isSquare(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {Fp2} F.sqrt(a)
   */
  function FieldSqrt(F, a) {
    /** @type {Fp2} */
    const r = F.sqrt(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2} a - a
   * @returns {uint8[]} F.encode(a)
   */
  function FieldEncode(F, a) {
    /** @type {uint8[]} */
    const r = F.encode(a);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {uint8[]} bytes - bytes
   * @param {int32} offset - offset
   * @returns {Fp2} F.decode(bytes, offset)
   */
  function FieldDecode(F, bytes, offset) {
    /** @type {Fp2} */
    const r = F.decode(bytes, offset);
    return r;
  }

  /**
   * @param {SqiField} F - the field
   * @param {Fp2[]} xs - xs
   * @returns {Fp2[]} F.batchedInv(xs)
   */
  function FieldBatchedInv(F, xs) {
    /** @type {Fp2[]} */
    const r = F.batchedInv(xs);
    return r;
  }

  // ===== parameter sets =====

  /**
   * @param {string} name - name
   * @param {int32} cofactor - cofactor
   * @param {int32} power - power
   * @param {int32} responseLength - responseLength
   * @param {int32} securityBits - securityBits
   * @param {int32} hashIterations - hashIterations
   * @param {int32} publicKeyBytes - publicKeyBytes
   * @param {int32} signatureBytes - signatureBytes
   * @param {string[]} e0 - e0
   * @returns {SqiParams} Result
   */
  function Params(name, cofactor, power, responseLength, securityBits, hashIterations,
                  publicKeyBytes, signatureBytes, e0) {
    /** @type {BigInt} */
    const P = BigInt(cofactor) * PowerOfTwo(power) - 1n;
    const fpBytes = Math.floor((OpCodes.BitCountN(P) + 7) / 8);
    const F = new SqiField(P, fpBytes);
    return new SqiParams(
      name,
      F,
      BigInt(cofactor),
      OpCodes.BitCountN(BigInt(cofactor)),
      power,
      responseLength,
      securityBits,
      hashIterations,
      fpBytes,
      2 * fpBytes,
      publicKeyBytes,
      signatureBytes,
      Math.floor((responseLength + 9) / 8),
      FieldOf(F, BigInt('0x' + e0[0]), BigInt('0x' + e0[1])),
      FieldOf(F, BigInt('0x' + e0[2]), BigInt('0x' + e0[3]))
    );
  }

  // The canonical basis of E0[2^f], precomputed by the submission because the
  // entangled-basis construction below needs A != 0.
  /** @type {SqiParams[]} */
  const PARAMETER_SET_LIST = [
    Params('SQIsign-I', 5, 248, 126, 128, 64, 65, 148, [
      '19b877fca82b12483cc04c3a66216c444be991a59bfa78b2119d95eaeb40078',
      '4442adb49eae04252150aaa9867e92fb2cfddae514292748e04133dc3f9d275',
      '45ffd477d5c0b719fdf2717050d041d878678f7a54be1f37c16252a5593eb1f',
      '487d4e9df1873dc4465a8fb3676b39a39ff054b6f8ea5aefde228b7a0cdaaee'
    ]),
    Params('SQIsign-III', 65, 376, 192, 192, 256, 97, 224, [
      '1798a1c27fb6dbff48e2f771d26ec456d059a73a5b5d2c853fb73a87d77bc2c5dbd311c20c76dbc43ea2ed69d1d24317',
      '2cb19c5d827d348a69cd0e002c4665c2aed0cf6c1fcdf1a1afa3773ad7512fddf4b5201c5623521faafc461b9ddd11f0',
      '129213ad6e31d1c94a24ad066819aff34be5b9ecf412164a24d8d0bc9570ff6cd67adb66e57db8685bc56017c110a723',
      '32a595cb10fd42a35f44f05ea57dc0431817aba97f782a74cb79a068d58e35e22f24b1bfb2677cd995fcb7e977b9335'
    ]),
    Params('SQIsign-V', 27, 500, 253, 256, 512, 129, 292, [
      '9fafe5085fcb1f13d5e487f010c8026abe233871b01f4a3587f06737f9bc686ba009922e2d459ec8f149c4c4083604e7842a612b6fdf8180025cdeb187b4c0',
      'c42a516ef3cf80d3e2e7a2d88faba1e46785ddce14f150ff4d204a43d47ad8d01940b2eba9aaac28b7198e48ed9281128f5782cdd197f48cddfbffe867063d',
      'bce91be61859cd3ddcd3f8408657d1d43c6f2764437e66e96371e74bc4b725f0cb99b58b09a91e872afcebb4608219f68aa3572c70ef5e6e654099bfc8aa09',
      'a48c9987de3810adbf0813505a561e134f31d64466875f90e21dd7c6b44eb81bed0e58d70ebd39fd9443a7523049993bd75145d72ec8f52be58b7086fffbe8'
    ])
  ];

  /**
   * @param {string} name - 'SQIsign-I', 'SQIsign-III' or 'SQIsign-V'
   * @returns {SqiParams|null} the set of that name
   */
  function ParameterSetEntry(name) {
    for (let i = 0; i < PARAMETER_SET_LIST.length; ++i)
      if (PARAMETER_SET_LIST[i].name === name) return PARAMETER_SET_LIST[i];
    return null;
  }

  /**
   * @param {int32} length - length
   * @returns {SqiParams} Result
   */
  function ParameterSetByPublicKeyLength(length) {
    for (let i = 0; i < PARAMETER_SET_LIST.length; ++i)
      if (PARAMETER_SET_LIST[i].publicKeyBytes === length) return PARAMETER_SET_LIST[i];
    return null;
  }

  /**
   * @param {string} label - label
   * @returns {SqiParams} Result
   */
  function FindParameterSet(label) {
    if (label === null || label === undefined) {
      return null;
    }
    /** @type {string} */
    const wanted = String(label).toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i < PARAMETER_SET_LIST.length; ++i) {
      const name = PARAMETER_SET_LIST[i].name;
      /** @type {string} */
      const short = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      /** @type {string} */
      const level = name.substring(name.indexOf('-') + 1);
      const levelNumber = level === 'I' ? 1 : (level === 'III' ? 3 : 5);
      if (wanted === short || wanted === level || wanted === 'LVL' + levelNumber
          || wanted === 'SQISIGNLVL' + levelNumber)
        return PARAMETER_SET_LIST[i];
    }
    return null;
  }

  // ===== verification =====
  //
  // Montgomery curves y^2 = x^3 + (A/C) x^2 + x, x-only points (X : Z), and
  // Jacobian points (X : Y : Z) for the gluing step. Everything below follows
  // the reference implementation formula for formula.

  /**
   * crypto_sign_open at one level.
   * @param {SqiParams} prm - the level
   * @param {uint8[]} signedMessage - signature || message
   * @param {uint8[]} publicKey - the encoded public key
   * @returns {SqiOpenResult} the outcome
   */
  function OpenSigned(prm, signedMessage, publicKey) {
    const F = prm.F;
    const TORSION = prm.torsionPower;
    const HD_EXTRA_TORSION = 2;

    /**
     * @param {Fp2} x - X
     * @param {Fp2} z - Z
     * @returns {XzPoint} (X : Z)
     */
    function point(x, z) {
      return new XzPoint(x, z);
    }

    /**
     * @param {Fp2} x - X
     * @param {Fp2} y - Y
     * @param {Fp2} z - Z
     * @returns {JacPoint} (X : Y : Z)
     */
    function jac(x, y, z) {
      return new JacPoint(x, y, z);
    }

    /**
     * @param {Fp2} x - x
     * @param {Fp2} y - y
     * @param {Fp2} z - z
     * @param {Fp2} t - t
     * @returns {ThetaPoint} (x : y : z : t)
     */
    function theta(x, y, z, t) {
      return new ThetaPoint(x, y, z, t);
    }


    /**
     * @param {XzPoint} Q - a point
     * @returns {XzPoint} a copy of it
     */
    function copyPoint(Q) {
      return new XzPoint(Q.x, Q.z);
    }

    /**
     * @returns {XzPoint} the point at infinity
     */
    function pointInfinity() {
      return new XzPoint(FieldOne(F), FieldZero(F));
    }

    /**
     * @param {MontCurve} E - a curve
     * @returns {MontCurve} a copy of it
     */
    function copyCurve(E) {
      return new MontCurve(E.A, E.C, copyPoint(E.A24), E.normalized);
    }

    /**
     * @param {Fp2} A - the coefficient
     * @returns {MontCurve} the curve (A : 1)
     */
    function curveFromA(A) {
      return new MontCurve(A, FieldOne(F), pointInfinity(), false);
    }

    // --- curve bookkeeping ---

    /**
     * @param {XzPoint} Q - Q
     * @returns {XzPoint} Result
     */
    function normalizePoint(Q) {
      const zi = FieldInv(F, Q.z);
      return point(FieldMul(F, Q.x, zi), FieldOne(F));
    }

    /**
     * @param {MontCurve} E - E
     * @returns {XzPoint} Result
     */
    function acToA24(E) {
      if (E.normalized) return copyPoint(E.A24);
      const c2 = FieldAdd(F, E.C, E.C);
      return point(FieldAdd(F, E.A, c2), FieldAdd(F, c2, c2));
    }

    /**
     * @param {MontCurve} E - E
     * @param {XzPoint} A24 - A24
     */
    function a24ToAC(E, A24) {
      let A = FieldAdd(F, A24.x, A24.x);
      A = FieldSub(F, A, A24.z);
      A = FieldAdd(F, A, A);
      E.A = A;
      E.C = A24.z;
    }

    /**
     * @param {MontCurve} E - E
     */
    function normalizeCurve(E) {
      const ci = FieldInv(F, E.C);
      E.A = FieldMul(F, E.A, ci);
      E.C = FieldOne(F);
    }

    /**
     * @param {MontCurve} E - E
     */
    function normalizeA24(E) {
      if (!E.normalized) {
        E.A24 = normalizePoint(acToA24(E));
        E.normalized = true;
      }
    }

    /**
     * @param {MontCurve} E - E
     */
    function normalizeCurveAndA24(E) {
      if (!FieldIsOne(F, E.C)) normalizeCurve(E);
      if (!E.normalized) {
        let x = FieldOf(F, FieldFpAdd(F, FieldFpAdd(F, E.A.re, 1n), 1n), E.A.im);
        x = FieldHalf(F, FieldHalf(F, x));
        E.A24 = point(x, FieldOne(F));
        E.normalized = true;
      }
    }

    /**
     * @param {Fp2} A - A
     * @returns {boolean} Result
     */
    function curveVerifyA(A) {
      const two = FieldOf(F, 2n, 0n);
      if (FieldEqual(F, A, two)) return false;
      if (FieldEqual(F, A, FieldNeg(F, two))) return false;
      return true;
    }

    /**
     * @param {MontCurve} E - E
     * @returns {Fp2} Result
     */
    function jInvariant(E) {
      let t1 = FieldSqr(F, E.C);
      let j = FieldSqr(F, E.A);
      let t0 = FieldAdd(F, t1, t1);
      t0 = FieldSub(F, j, t0);
      t0 = FieldSub(F, t0, t1);
      j = FieldSub(F, t0, t1);
      t1 = FieldSqr(F, t1);
      j = FieldMul(F, j, t1);
      t0 = FieldAdd(F, t0, t0);
      t0 = FieldAdd(F, t0, t0);
      t1 = FieldSqr(F, t0);
      t0 = FieldMul(F, t0, t1);
      t0 = FieldAdd(F, t0, t0);
      t0 = FieldAdd(F, t0, t0);
      j = FieldInv(F, j);
      return FieldMul(F, t0, j);
    }

    // --- x-only arithmetic ---

    /**
     * @param {XzPoint} Q - a point
     * @returns {boolean} whether it is the point at infinity
     */
    function isZeroPoint(Q) {
      return FieldIsZero(F, Q.z);
    }

    /**
     * @param {XzPoint} Q - a point
     * @returns {boolean} whether x or z is zero
     */
    function hasZeroCoordinate(Q) {
      return FieldIsZero(F, Q.x) || FieldIsZero(F, Q.z);
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {XzPoint} Q - Q
     * @returns {boolean} Result
     */
    function pointsEqual(Pt, Q) {
      const lz = isZeroPoint(Pt), rz = isZeroPoint(Q);
      if (lz || rz) return lz && rz;
      return FieldEqual(F, FieldMul(F, Pt.x, Q.z), FieldMul(F, Pt.z, Q.x));
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {MontCurve} E - E
     * @returns {boolean} Result
     */
    function isTwoTorsion(Pt, E) {
      if (isZeroPoint(Pt)) return false;
      let t0 = FieldSqr(F, FieldAdd(F, Pt.x, Pt.z));
      let t1 = FieldSqr(F, FieldSub(F, Pt.x, Pt.z));
      let t2 = FieldSub(F, t0, t1);
      t1 = FieldAdd(F, t0, t1);
      t2 = FieldMul(F, t2, E.A);
      t1 = FieldMul(F, t1, E.C);
      t1 = FieldAdd(F, t1, t1);
      t0 = FieldAdd(F, t1, t2);
      return FieldIsZero(F, Pt.x) || FieldIsZero(F, t0);
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {XzPoint} A24 - A24
     * @param {boolean} normalized - normalized
     * @returns {XzPoint} Result
     */
    function xDblA24(Pt, A24, normalized) {
      const t0 = FieldSqr(F, FieldAdd(F, Pt.x, Pt.z));
      let t1 = FieldSqr(F, FieldSub(F, Pt.x, Pt.z));
      const t2 = FieldSub(F, t0, t1);
      if (!normalized) t1 = FieldMul(F, t1, A24.z);
      const x = FieldMul(F, t0, t1);
      const u = FieldAdd(F, FieldMul(F, t2, A24.x), t1);
      return point(x, FieldMul(F, u, t2));
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {Fp2} A - A
     * @param {Fp2} C - C
     * @returns {XzPoint} Result
     */
    function xDbl(Pt, A, C) {
      let t0 = FieldSqr(F, FieldAdd(F, Pt.x, Pt.z));
      let t1 = FieldSqr(F, FieldSub(F, Pt.x, Pt.z));
      const t2 = FieldSub(F, t0, t1);
      const t3 = FieldAdd(F, C, C);
      t1 = FieldMul(F, t1, t3);
      t1 = FieldAdd(F, t1, t1);
      const x = FieldMul(F, t0, t1);
      t0 = FieldAdd(F, t3, A);
      t0 = FieldMul(F, t0, t2);
      t0 = FieldAdd(F, t0, t1);
      return point(x, FieldMul(F, t0, t2));
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @returns {XzPoint} Result
     */
    function xDblE0(Pt) {
      const t0 = FieldSqr(F, FieldAdd(F, Pt.x, Pt.z));
      let t1 = FieldSqr(F, FieldSub(F, Pt.x, Pt.z));
      const t2 = FieldSub(F, t0, t1);
      t1 = FieldAdd(F, t1, t1);
      return point(FieldMul(F, t0, t1), FieldMul(F, FieldAdd(F, t1, t2), t2));
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {XzPoint} Q - Q
     * @param {XzPoint} PQ - PQ
     * @returns {XzPoint} Result
     */
    function xAdd(Pt, Q, PQ) {
      let t0 = FieldAdd(F, Pt.x, Pt.z);
      let t1 = FieldSub(F, Pt.x, Pt.z);
      let t2 = FieldAdd(F, Q.x, Q.z);
      let t3 = FieldSub(F, Q.x, Q.z);
      t0 = FieldMul(F, t0, t3);
      t1 = FieldMul(F, t1, t2);
      t2 = FieldSqr(F, FieldAdd(F, t0, t1));
      t3 = FieldSqr(F, FieldSub(F, t0, t1));
      return point(FieldMul(F, PQ.z, t2), FieldMul(F, PQ.x, t3));
    }

    /**
     * Simultaneous doubling of P and differential addition P + Q.
     * @param {XzPoint} Pt - Pt
     * @param {XzPoint} Q - Q
     * @param {XzPoint} PQ - PQ
     * @param {XzPoint} A24 - A24
     * @param {boolean} normalized - normalized
     * @returns {XzPoint[]} Result
     */
    function xDblAdd(Pt, Q, PQ, A24, normalized) {
      let t0 = FieldAdd(F, Pt.x, Pt.z);
      let t1 = FieldSub(F, Pt.x, Pt.z);
      let Rx = FieldSqr(F, t0);
      let t2 = FieldSub(F, Q.x, Q.z);
      let Sx = FieldAdd(F, Q.x, Q.z);
      t0 = FieldMul(F, t0, t2);
      let Rz = FieldSqr(F, t1);
      t1 = FieldMul(F, t1, Sx);
      t2 = FieldSub(F, Rx, Rz);
      if (!normalized) Rz = FieldMul(F, Rz, A24.z);
      Rx = FieldMul(F, Rx, Rz);
      Sx = FieldMul(F, A24.x, t2);
      let Sz = FieldSub(F, t0, t1);
      Rz = FieldAdd(F, Rz, Sx);
      Sx = FieldAdd(F, t0, t1);
      Rz = FieldMul(F, Rz, t2);
      Sz = FieldSqr(F, Sz);
      Sx = FieldSqr(F, Sx);
      Sz = FieldMul(F, Sz, PQ.x);
      Sx = FieldMul(F, Sx, PQ.z);
      return [point(Rx, Rz), point(Sx, Sz)];
    }

    /**
     * The Montgomery ladder, k of kbits bits.
     * @param {XzPoint} Pt - Pt
     * @param {BigInt} k - k
     * @param {int32} kbits - kbits
     * @param {MontCurve} E - E
     * @returns {XzPoint} Result
     */
    function xMul(Pt, k, kbits, E) {
      /** @type {XzPoint} */
      let A24;
      if (!E.normalized) {
        let x = FieldAdd(F, E.C, E.C);
        const z = FieldAdd(F, x, x);
        x = FieldAdd(F, x, E.A);
        A24 = point(x, z);
      } else {
        A24 = copyPoint(E.A24);
      }
      let R0 = pointInfinity();
      let R1 = copyPoint(Pt);
      const bits = BitsOf(k, kbits);
      let prevbit = 0;
      for (let i = kbits - 1; i >= 0; --i) {
        const bit = bits[i];
        if (bit !== prevbit) { const t = R0; R0 = R1; R1 = t; }
        prevbit = bit;
        const r = xDblAdd(R0, R1, Pt, A24, true);
        R0 = r[0]; R1 = r[1];
      }
      if (prevbit) { const t = R0; R0 = R1; R1 = t; }
      return R0;
    }

    /**
     * The Montgomery biladder: k P + l Q from P, Q and P - Q.
     * @param {XzPoint} Pt - Pt
     * @param {BigInt} k - k
     * @param {XzPoint} Q - Q
     * @param {BigInt} l - l
     * @param {XzPoint} PQ - PQ
     * @param {int32} kbits - kbits
     * @param {MontCurve} E - E
     * @returns {XzPoint|null} Result
     */
    function xDblMul(Pt, k, Q, l, PQ, kbits, E) {
      if (hasZeroCoordinate(Pt) || hasZeroCoordinate(Q) || hasZeroCoordinate(PQ)) return null;

      const wrap = PowerOfTwo(64 * 8);
      /** @type {int32} */
      const bitk0 = Number(k % 2n);
      /** @type {int32} */
      const bitl0 = Number(l % 2n);
      const sigma = [1 - bitk0, 1 - bitl0];
      const evens = sigma[0] + sigma[1];
      const mevens = (evens % 2 === 1);
      if (!mevens) { sigma[0] = 0; sigma[1] = 1; }
      let preSigma = 0;

      // even scalars become odd by subtracting one, wrapping as unsigned words do
      let kt = bitk0 ? k : (k - 1n + wrap) % wrap;
      let lt = bitl0 ? l : (l - 1n + wrap) % wrap;

      /** @type {int32[]} */
      const r = new Array(2 * kbits);
      for (let i = 0; i < kbits; ++i) {
        if (sigma[0] !== preSigma) { const t = kt; kt = lt; lt = t; }
        /** @type {int32} */
        let b1;
        /** @type {int32} */
        let b2;
        if (i === kbits - 1) {
          b1 = 0; b2 = 0;
        } else {
          b1 = Number(kt % 2n); kt = kt / 2n;
          b2 = Number(lt % 2n); lt = lt / 2n;
        }
        /** @type {int32} */
        const c1 = Number(kt % 2n);
        /** @type {int32} */
        const c2 = Number(lt % 2n);
        r[2 * i] = (c1 + b1) % 2;
        r[2 * i + 1] = (c2 + b2) % 2;
        preSigma = sigma[0];
        if (r[2 * i + 1]) { const t = sigma[0]; sigma[0] = sigma[1]; sigma[1] = t; }
      }

      const R = [pointInfinity(), null, null];
      R[1] = copyPoint(sigma[0] ? Q : Pt);
      R[2] = copyPoint(sigma[0] ? Pt : Q);
      let diff1a = copyPoint(R[1]);
      let diff1b = copyPoint(R[2]);

      R[2] = xAdd(R[1], R[2], PQ);
      if (hasZeroCoordinate(R[2])) return null;
      let diff2a = copyPoint(R[2]);
      let diff2b = copyPoint(PQ);

      const aIsZero = FieldIsZero(F, E.A);

      for (let i = kbits - 1; i >= 0; --i) {
        const h = r[2 * i] + r[2 * i + 1];
        let T0 = (h % 2) ? R[1] : R[0];
        if (h === 2) T0 = R[2];
        T0 = aIsZero ? xDblE0(T0) : xDblA24(T0, E.A24, true);

        const sel = r[2 * i + 1];
        let T1 = sel ? R[1] : R[0];
        let T2 = sel ? R[2] : R[1];
        if (sel) { const t = diff1a; diff1a = diff1b; diff1b = t; }
        T1 = xAdd(T1, T2, diff1a);
        T2 = xAdd(R[0], R[2], diff2a);
        if (h % 2) { const t = diff2a; diff2a = diff2b; diff2b = t; }

        R[0] = T0; R[1] = T1; R[2] = T2;
      }

      let S = mevens ? R[1] : R[0];
      if (bitk0 && bitl0) S = R[2];
      return S;
    }

    /**
     * P + [m]Q from x(P), x(Q), x(P - Q), the ladder of the reference.
     * @param {BigInt} m - m
     * @param {XzPoint} Pt - Pt
     * @param {XzPoint} Q - Q
     * @param {XzPoint} PQ - PQ
     * @param {MontCurve} E - E
     * @returns {XzPoint|null} Result
     */
    function ladder3pt(m, Pt, Q, PQ, E) {
      if (!FieldIsOne(F, E.A24.z)) return null;
      if (hasZeroCoordinate(PQ)) return null;
      let X0 = copyPoint(Q), X1 = copyPoint(Pt), X2 = copyPoint(PQ);
      const bits = BitsOf(m, 64 * Math.ceil(prm.securityBits / 64));
      for (let i = 0; i < bits.length; ++i) {
        if (!bits[i]) { const t = X1; X1 = X2; X2 = t; }
        const r = xDblAdd(X0, X1, X2, E.A24, true);
        X0 = r[0]; X1 = r[1];
        if (!bits[i]) { const t = X1; X1 = X2; X2 = t; }
      }
      return X1;
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {MontCurve} E - E
     * @returns {XzPoint} Result
     */
    function ecDbl(Pt, E) {
      return E.normalized ? xDblA24(Pt, E.A24, true) : xDbl(Pt, E.A, E.C);
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {int32} n - n
     * @param {MontCurve} E - E
     * @returns {XzPoint} Result
     */
    function ecDblIter(Pt, n, E) {
      if (n === 0) return copyPoint(Pt);
      if (n > 50) normalizeA24(E);
      let R = Pt;
      if (E.normalized) {
        for (let i = 0; i < n; ++i) R = xDblA24(R, E.A24, true);
      } else {
        for (let i = 0; i < n; ++i) R = xDbl(R, E.A, E.C);
      }
      return R;
    }

    /**
     * @param {XzBasis} B - B
     * @param {int32} n - n
     * @param {MontCurve} E - E
     * @returns {XzBasis} Result
     */
    function ecDblIterBasis(B, n, E) {
      return new XzBasis(ecDblIter(B.P, n, E), ecDblIter(B.Q, n, E), ecDblIter(B.PmQ, n, E));
    }

    /**
     * @param {BigInt} k - k
     * @param {BigInt} l - l
     * @param {int32} kbits - kbits
     * @param {XzBasis} B - B
     * @param {MontCurve} E - E
     * @returns {XzPoint|null} Result
     */
    function biscalarMul(k, l, kbits, B, E) {
      if (FieldIsZero(F, B.PmQ.z)) return null;
      if (kbits === 1) {
        if (!isTwoTorsion(B.P, E) || !isTwoTorsion(B.Q, E) || !isTwoTorsion(B.PmQ, E)) {
          return null;
        }
        /** @type {int32} */
        const bP = Number(k % 2n);
        /** @type {int32} */
        const bQ = Number(l % 2n);
        if (!bP && !bQ) return pointInfinity();
        if (bP && !bQ) return copyPoint(B.P);
        if (!bP && bQ) return copyPoint(B.Q);
        return copyPoint(B.PmQ);
      }
      const E2 = copyCurve(E);
      if (!FieldIsZero(F, E.A)) normalizeA24(E2);
      return xDblMul(B.P, k, B.Q, l, B.PmQ, kbits, E2);
    }

    // --- bases of E[2^f] ---

    /**
     * The difference P - Q the reference picks from x(P) and x(Q).
     * @param {XzPoint} Pt - Pt
     * @param {XzPoint} Q - Q
     * @param {MontCurve} E - E
     * @returns {XzPoint} Result
     */
    function differencePoint(Pt, Q, E) {
      let t0 = FieldMul(F, Pt.x, Q.x);
      let t1 = FieldMul(F, Pt.z, Q.z);
      let Bxx = FieldSqr(F, FieldSub(F, t0, t1));
      Bxx = FieldMul(F, Bxx, E.C);
      let Bxz = FieldAdd(F, t0, t1);
      t0 = FieldMul(F, Pt.x, Q.z);
      t1 = FieldMul(F, Pt.z, Q.x);
      let Bzz = FieldAdd(F, t0, t1);
      Bxz = FieldMul(F, Bxz, Bzz);
      Bzz = FieldSqr(F, FieldSub(F, t0, t1));
      Bzz = FieldMul(F, Bzz, E.C);
      Bxz = FieldMul(F, Bxz, E.C);
      t0 = FieldMul(F, t0, t1);
      t0 = FieldMul(F, t0, E.A);
      t0 = FieldAdd(F, t0, t0);
      Bxz = FieldAdd(F, Bxz, t0);

      // Normalise by C * conj(C)^2 * conj(Pz)^2 * conj(Qz)^2 so that the
      // denominator is a fourth power in GF(p), which makes the root below
      // canonical.
      /**
       * @param {Fp2} a - an element
       * @returns {Fp2} its conjugate
       */
      function conj(a) {
        return FieldOf(F, a.re, FieldFpNeg(F, a.im));
      }
      t0 = FieldSqr(F, conj(E.C));
      t0 = FieldMul(F, t0, E.C);
      t1 = FieldSqr(F, conj(Pt.z));
      t0 = FieldMul(F, t0, t1);
      t1 = FieldSqr(F, conj(Q.z));
      t0 = FieldMul(F, t0, t1);
      Bxx = FieldMul(F, Bxx, t0);
      Bxz = FieldMul(F, Bxz, t0);
      Bzz = FieldMul(F, Bzz, t0);

      t0 = FieldSqr(F, Bxz);
      t1 = FieldMul(F, Bxx, Bzz);
      t0 = FieldSub(F, t0, t1);
      t0 = FieldSqrt(F, t0);
      return point(FieldAdd(F, Bxz, t0), Bzz);
    }

    /**
     * @param {Fp2} x - x
     * @param {MontCurve} E - E
     * @returns {boolean} Result
     */
    function isOnCurve(x, E) {
      let t0 = FieldAdd(F, x, E.A);
      t0 = FieldMul(F, t0, x);
      t0 = FieldAdd(F, t0, FieldOne(F));
      t0 = FieldMul(F, t0, x);
      return FieldIsSquare(F, t0);
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @param {MontCurve} E - E
     * @param {int32} f - f
     * @returns {XzPoint} Result
     */
    function clearCofactor(Pt, E, f) {
      let R = xMul(Pt, prm.cofactor, prm.cofactorBits, E);
      for (let i = 0; i < TORSION - f; ++i) R = xDblA24(R, E.A24, E.normalized);
      return R;
    }

    /**
     * @param {MontCurve} E - E
     * @param {int32} start - start
     * @returns {Fp2} Result
     */
    function findNqrFactor(E, start) {
      let n = start;
      let qr = true;
      /** @type {Fp2} */
      let z;
      for (;;) {
        while (qr) {
          qr = FieldFpIsSquare(F, BigInt(n * n + 1) % F.P);
          ++n;
        }
        const b = BigInt(n - 1);
        z = FieldOf(F, 1n, b);
        let t0 = FieldOf(F, 0n, b);
        t0 = FieldMul(F, t0, FieldSqr(F, E.A));
        t0 = FieldSub(F, t0, FieldSqr(F, z));
        const found = !FieldIsSquare(F, t0);
        qr = true;
        if (found) break;
      }
      return FieldNeg(F, FieldMul(F, FieldInv(F, z), E.A));
    }

    /**
     * @param {MontCurve} E - E
     * @param {int32} start - start
     * @returns {Fp2} Result
     */
    function findNAxCoord(E, start) {
      let x = (start === 1) ? FieldCopy(F, E.A) : FieldMulSmall(F, E.A, start);
      while (!isOnCurve(x, E)) x = FieldAdd(F, x, E.A);
      return x;
    }

    /**
     * @param {MontCurve} E - E
     * @param {int32} f - f
     * @returns {XzBasis} Result
     */
    function basisE0(E, f) {
      let Pt = point(prm.e0P, FieldOne(F));
      let Q = point(prm.e0Q, FieldOne(F));
      for (let i = 0; i < TORSION - f; ++i) {
        Pt = xDblE0(Pt);
        Q = xDblE0(Q);
      }
      return new XzBasis(Pt, Q, differencePoint(Pt, Q, E));
    }

    /**
     * The canonical basis of E[2^f] rebuilt from its one-byte hint.
     * @param {MontCurve} E - E
     * @param {int32} f - f
     * @param {int32} hint - hint
     * @returns {XzBasis} Result
     */
    function basisFromHint(E, f, hint) {
      normalizeCurveAndA24(E);
      if (FieldIsZero(F, E.A)) return basisE0(E, f);

      const hintA = hint % 2;
      const hintP = Math.floor(hint / 2);
      /** @type {Fp2} */
      let px;
      if (!hintP) {
        px = hintA ? findNqrFactor(E, 128) : findNAxCoord(E, 128);
      } else if (!hintA) {
        px = FieldMulSmall(F, E.A, hintP);
      } else {
        px = FieldNeg(F, FieldMul(F, FieldInv(F, FieldOf(F, 1n, BigInt(hintP))), E.A));
      }
      let Pt = point(px, FieldOne(F));
      let Q = point(FieldNeg(F, FieldAdd(F, E.A, px)), FieldOne(F));
      Pt = clearCofactor(Pt, E, f);
      Q = clearCofactor(Q, E, f);
      return new XzBasis(Pt, differencePoint(Pt, Q, E), Q);
    }

    // --- isogenies of degree 2 and 4 ---

    /**
     * @param {XzPoint} K - K
     * @returns {Isogeny2} Result
     */
    function xIsog2(K) {
      const bx = FieldSqr(F, K.x);
      const bz = FieldSqr(F, K.z);
      return new Isogeny2(point(FieldSub(F, bz, bx), bz), point(FieldAdd(F, K.x, K.z), FieldSub(F, K.x, K.z)));
    }

    /**
     * @param {XzPoint} Q - Q
     * @param {XzPoint} K - K
     * @returns {XzPoint} Result
     */
    function xEval2(Q, K) {
      let t0 = FieldAdd(F, Q.x, Q.z);
      let t1 = FieldSub(F, Q.x, Q.z);
      const t2 = FieldMul(F, K.x, t1);
      t1 = FieldMul(F, K.z, t0);
      t0 = FieldAdd(F, t2, t1);
      t1 = FieldSub(F, t2, t1);
      return point(FieldMul(F, Q.x, t0), FieldMul(F, Q.z, t1));
    }

    /**
     * @param {XzPoint} Pt - Pt
     * @returns {Isogeny4} Result
     */
    function xIsog4(Pt) {
      const k0x = FieldSqr(F, Pt.x);
      const k0z = FieldSqr(F, Pt.z);
      const k1x = FieldAdd(F, k0z, k0x);
      const k1z = FieldSub(F, k0z, k0x);
      const B = point(FieldMul(F, k1x, k1z), FieldSqr(F, k0z));
      const K2x = FieldAdd(F, Pt.x, Pt.z);
      const K1x = FieldSub(F, Pt.x, Pt.z);
      let K0x = FieldAdd(F, k0z, k0z);
      K0x = FieldAdd(F, K0x, K0x);
      return new Isogeny4(B, [K0x, K1x, K2x]);
    }

    /**
     * @param {XzPoint} Q - Q
     * @param {Fp2[]} K - K
     * @returns {XzPoint} Result
     */
    function xEval4(Q, K) {
      let t0 = FieldAdd(F, Q.x, Q.z);
      let t1 = FieldSub(F, Q.x, Q.z);
      let x = FieldMul(F, t0, K[1]);
      let z = FieldMul(F, t1, K[2]);
      t0 = FieldMul(F, t0, t1);
      t0 = FieldMul(F, t0, K[0]);
      t1 = FieldAdd(F, x, z);
      z = FieldSub(F, x, z);
      t1 = FieldSqr(F, t1);
      z = FieldSqr(F, z);
      x = FieldAdd(F, t0, t1);
      t0 = FieldSub(F, t0, z);
      x = FieldMul(F, x, t1);
      z = FieldMul(F, z, t0);
      return point(x, z);
    }

    /**
     * A 2^n-isogeny from its kernel, as a chain of 4-isogenies.
     * @param {MontCurve} E - E
     * @param {XzPoint[]} points - points
     * @param {XzPoint} kernel - kernel
     * @param {int32} isogLen - isogLen
     * @returns {boolean} Result
     */
    function evalEvenStrategy(E, points, kernel, isogLen) {
      normalizeA24(E);
      let A24 = copyPoint(E.A24);

      const splits = [copyPoint(kernel)];
      const todo = [isogLen];
      let current = 0;

      for (let j = 0; j < Math.floor(isogLen / 2); ++j) {
        while (todo[current] !== 2) {
          ++current;
          splits[current] = copyPoint(splits[current - 1]);
          let dbls = Math.floor(todo[current - 1] / 4) * 2 + todo[current - 1] % 2;
          todo[current] = todo[current - 1] - dbls;
          while (dbls--) splits[current] = xDblA24(splits[current], A24, false);
        }

        if (j === 0) {
          const test = xDblA24(splits[current], E.A24, E.normalized);
          if (!isTwoTorsion(test, E)) return false;
          const T = xDblA24(splits[current], A24, false);
          if (FieldIsZero(F, T.x)) return false;
        }

        const iso = xIsog4(splits[current]);
        A24 = iso.A24;
        for (let i = 0; i < current; ++i) {
          splits[i] = xEval4(splits[i], iso.K);
          todo[i] -= 2;
        }
        for (let i = 0; i < points.length; ++i) points[i] = xEval4(points[i], iso.K);
        --current;
      }

      if (isogLen % 2) {
        if (isogLen === 1 && !isTwoTorsion(splits[0], E)) return false;
        if (FieldIsZero(F, splits[0].x)) return false;
        const iso = xIsog2(splits[0]);
        A24 = iso.A24;
        for (let i = 0; i < points.length; ++i) points[i] = xEval2(points[i], iso.K);
      }

      a24ToAC(E, A24);
      E.normalized = false;
      return true;
    }

    /**
     * A short 2^len-isogeny, one 2-isogeny at a time.
     * @param {MontCurve} E - E
     * @param {XzPoint} kernel - kernel
     * @param {int32} len - len
     * @param {XzPoint[]} points - points
     * @returns {boolean} Result
     */
    function evalSmallChain(E, kernel, len, points) {
      let A24 = acToA24(E);
      let bigK = copyPoint(kernel);
      for (let i = 0; i < len; ++i) {
        let smallK = copyPoint(bigK);
        for (let j = 0; j < len - i - 1; ++j) smallK = xDblA24(smallK, A24, false);
        if (i === 0 && !isTwoTorsion(smallK, E)) return false;
        if (FieldIsZero(F, smallK.x)) return false;
        const iso = xIsog2(smallK);
        A24 = iso.A24;
        bigK = xEval2(bigK, iso.K);
        for (let k = 0; k < points.length; ++k) points[k] = xEval2(points[k], iso.K);
      }
      a24ToAC(E, A24);
      E.normalized = false;
      return true;
    }

    // --- Jacobian points ---


    /**
     * y of a point from x, as the reference picks it; null off the curve.
     * @param {Fp2} px - px
     * @param {MontCurve} E - E
     * @returns {Fp2|null} Result
     */
    function recoverY(px, E) {
      let t0 = FieldSqr(F, px);
      let y = FieldMul(F, t0, E.A);
      y = FieldAdd(F, y, px);
      t0 = FieldMul(F, t0, px);
      y = FieldAdd(F, y, t0);
      const root = FieldSqrt(F, y);
      return FieldEqual(F, FieldSqr(F, root), y) ? root : null;
    }

    /**
     * Lift x(P), x(Q), x(P - Q) to Jacobian P and Q, normalising E.
     * @param {XzBasis} B - B
     * @param {MontCurve} E - E
     * @returns {LiftedBasis} Result
     */
    function liftBasis(B, E) {
      const inverses = FieldBatchedInv(F, [B.P.z, E.C]);
      const Px = FieldMul(F, B.P.x, inverses[0]);
      E.A = FieldMul(F, E.A, inverses[1]);
      E.C = FieldOne(F);
      const PmQ = B.PmQ;

      const Py = recoverY(Px, E);
      const PyValue = Py !== null ? Py : FieldSqrt(F, FieldAdd(F, FieldAdd(F, FieldMul(F, FieldSqr(F, Px), E.A), Px), FieldMul(F, FieldSqr(F, Px), Px)));

      let Qx = B.Q.x, Qz = B.Q.z;
      let v1 = FieldMul(F, Px, Qz);
      let v2 = FieldAdd(F, Qx, v1);
      let v3 = FieldSqr(F, FieldSub(F, Qx, v1));
      v3 = FieldMul(F, v3, PmQ.x);
      v1 = FieldAdd(F, E.A, E.A);
      v1 = FieldMul(F, v1, Qz);
      v2 = FieldAdd(F, v2, v1);
      let v4 = FieldMul(F, Px, Qx);
      v4 = FieldAdd(F, v4, Qz);
      v2 = FieldMul(F, v2, v4);
      v1 = FieldMul(F, v1, Qz);
      v2 = FieldSub(F, v2, v1);
      v2 = FieldMul(F, v2, PmQ.z);
      let Qy = FieldSub(F, v3, v2);
      v1 = FieldAdd(F, PyValue, PyValue);
      v1 = FieldMul(F, v1, Qz);
      v1 = FieldMul(F, v1, PmQ.z);
      Qx = FieldMul(F, Qx, v1);
      Qz = FieldMul(F, Qz, v1);
      v1 = FieldSqr(F, Qz);
      Qy = FieldMul(F, Qy, v1);
      Qx = FieldMul(F, Qx, Qz);

      return new LiftedBasis(Py !== null, jac(Px, PyValue, FieldOne(F)), jac(Qx, Qy, Qz));
    }

    /**
     * @param {JacPoint} Pt - Pt
     * @returns {XzPoint} Result
     */
    function jacToXZ(Pt) {
      let x = Pt.x;
      const z = FieldSqr(F, Pt.z);
      if (FieldIsZero(F, x) && FieldIsZero(F, z)) x = FieldOne(F);
      return point(x, z);
    }

    /**
     * @param {JacPoint} Pt - Pt
     * @param {MontCurve} E - E
     * @returns {JacPoint} Result
     */
    function jacDbl(Pt, E) {
      if (FieldIsZero(F, Pt.x) && FieldIsZero(F, Pt.z)) return jac(Pt.x, Pt.y, Pt.z);
      let t0 = FieldSqr(F, Pt.x);
      let t1 = FieldAdd(F, t0, t0);
      t0 = FieldAdd(F, t0, t1);
      t1 = FieldSqr(F, Pt.z);
      let t2 = FieldMul(F, Pt.x, E.A);
      t2 = FieldAdd(F, t2, t2);
      t2 = FieldAdd(F, t1, t2);
      t2 = FieldMul(F, t1, t2);
      t2 = FieldAdd(F, t0, t2);
      let z = FieldMul(F, Pt.y, Pt.z);
      z = FieldAdd(F, z, z);
      t0 = FieldSqr(F, z);
      t0 = FieldMul(F, t0, E.A);
      t1 = FieldSqr(F, Pt.y);
      t1 = FieldAdd(F, t1, t1);
      let t3 = FieldAdd(F, Pt.x, Pt.x);
      t3 = FieldMul(F, t1, t3);
      let x = FieldSqr(F, t2);
      x = FieldSub(F, x, t0);
      x = FieldSub(F, x, t3);
      x = FieldSub(F, x, t3);
      let y = FieldSub(F, t3, x);
      y = FieldMul(F, y, t2);
      t1 = FieldSqr(F, t1);
      y = FieldSub(F, y, t1);
      y = FieldSub(F, y, t1);
      return jac(x, y, z);
    }

    /**
     * To the modified Jacobian coordinates of the short Weierstrass model.
     * @param {JacPoint} Pt - Pt
     * @param {MontCurve} E - E
     * @returns {WsPoint} Result
     */
    function jacToWS(Pt, E) {
      /** @type {Fp2} */
      let t;
      /** @type {Fp2} */
      let ao3 = FieldZero(F);
      /** @type {Fp2} */
      let x;
      if (!FieldIsZero(F, E.A)) {
        ao3 = FieldDiv3(F, E.A);
        t = FieldSqr(F, Pt.z);
        x = FieldAdd(F, FieldMul(F, ao3, t), Pt.x);
        t = FieldSqr(F, t);
        let a = FieldMul(F, ao3, E.A);
        a = FieldOf(F, FieldFpSub(F, 1n, a.re), FieldFpNeg(F, a.im));
        t = FieldMul(F, t, a);
      } else {
        x = Pt.x;
        t = FieldSqr(F, FieldSqr(F, Pt.z));
      }
      return new WsPoint(jac(x, Pt.y, Pt.z), t, ao3);
    }

    /**
     * @param {JacPoint} Pt - Pt
     * @param {Fp2} ao3 - ao3
     * @param {MontCurve} E - E
     * @returns {JacPoint} Result
     */
    function jacFromWS(Pt, ao3, E) {
      let x = Pt.x;
      if (!FieldIsZero(F, E.A)) x = FieldSub(F, Pt.x, FieldMul(F, FieldSqr(F, Pt.z), ao3));
      return jac(x, Pt.y, Pt.z);
    }

    /**
     * @param {JacPoint} Pt - Pt
     * @param {Fp2} t - t
     * @returns {WsDouble} Result
     */
    function jacDblW(Pt, t) {
      if (FieldIsZero(F, Pt.x) && FieldIsZero(F, Pt.z)) return new WsDouble(jac(Pt.x, Pt.y, Pt.z), t);
      const xx = FieldSqr(F, Pt.x);
      let c = FieldSqr(F, Pt.y);
      c = FieldAdd(F, c, c);
      const cc = FieldSqr(F, c);
      const r = FieldAdd(F, cc, cc);
      let s = FieldSqr(F, FieldAdd(F, Pt.x, c));
      s = FieldSub(F, s, xx);
      s = FieldSub(F, s, cc);
      let m = FieldAdd(F, xx, xx);
      m = FieldAdd(F, m, xx);
      m = FieldAdd(F, m, t);
      let x = FieldSqr(F, m);
      x = FieldSub(F, x, s);
      x = FieldSub(F, x, s);
      let z = FieldMul(F, Pt.y, Pt.z);
      z = FieldAdd(F, z, z);
      let y = FieldSub(F, s, x);
      y = FieldMul(F, y, m);
      y = FieldSub(F, y, r);
      let u = FieldMul(F, t, r);
      u = FieldAdd(F, u, u);
      return new WsDouble(jac(x, y, z), u);
    }

    /**
     * u, v, w with x(P + Q) = (u - v : w) and x(P - Q) = (u + v : w).
     * @param {JacPoint} Pt - Pt
     * @param {JacPoint} Q - Q
     * @param {MontCurve} E - E
     * @returns {AddComponents} Result
     */
    function jacAddComponents(Pt, Q, E) {
      let t0 = FieldSqr(F, Pt.z);
      let t1 = FieldSqr(F, Q.z);
      const t2 = FieldMul(F, Pt.x, t1);
      const t3 = FieldMul(F, t0, Q.x);
      let t4 = FieldMul(F, Pt.y, Q.z);
      t4 = FieldMul(F, t4, t1);
      let t5 = FieldMul(F, Pt.z, Q.y);
      t5 = FieldMul(F, t5, t0);
      t0 = FieldMul(F, t0, t1);
      let t6 = FieldMul(F, t4, t5);
      const v = FieldAdd(F, t6, t6);
      t4 = FieldSqr(F, t4);
      t5 = FieldSqr(F, t5);
      t4 = FieldAdd(F, t4, t5);
      t5 = FieldAdd(F, t2, t3);
      t6 = FieldAdd(F, t3, t3);
      t6 = FieldSub(F, t5, t6);
      t6 = FieldSqr(F, t6);
      t1 = FieldMul(F, E.A, t0);
      t1 = FieldAdd(F, t5, t1);
      t1 = FieldMul(F, t1, t6);
      const u = FieldSub(F, t4, t1);
      const w = FieldMul(F, t6, t0);
      return new AddComponents(u, v, w);
    }

    // --- couples of points on E1 x E2 ---

    /**
     * @param {JacCouple} T - T
     * @param {CurvePair} E12 - E12
     * @returns {JacCouple} Result
     */
    function doubleCoupleJac(T, E12) {
      return new JacCouple(jacDbl(T.P1, E12.E1), jacDbl(T.P2, E12.E2));
    }

    /**
     * @param {JacCouple} T - T
     * @param {int32} n - n
     * @param {CurvePair} E12 - E12
     * @returns {JacCouple} Result
     */
    function doubleCoupleJacIter(T, n, E12) {
      if (n === 0) return new JacCouple(T.P1, T.P2);
      if (n === 1) return doubleCoupleJac(T, E12);
      const w1 = jacToWS(T.P1, E12.E1);
      const w2 = jacToWS(T.P2, E12.E2);
      let Q1 = w1.Q, t1 = w1.t, Q2 = w2.Q, t2 = w2.t;
      for (let i = 0; i < n; ++i) {
        const d1 = jacDblW(Q1, t1); Q1 = d1.Q; t1 = d1.u;
        const d2 = jacDblW(Q2, t2); Q2 = d2.Q; t2 = d2.u;
      }
      return new JacCouple(jacFromWS(Q1, w1.ao3, E12.E1), jacFromWS(Q2, w2.ao3, E12.E2));
    }

    // --- the theta model ---

    /**
     * @param {ThetaPoint} T - a theta point
     * @param {int32} i - 0 to 3
     * @returns {Fp2} its coordinate i
     */
    function thetaCoord(T, i) {
      return (i === 0 ? T.x : i === 1 ? T.y : i === 2 ? T.z : T.t);
    }

    /**
     * @param {ThetaPoint} T - T
     * @returns {ThetaPoint} Result
     */
    function hadamard(T) {
      const t1 = FieldAdd(F, T.x, T.y);
      const t2 = FieldSub(F, T.x, T.y);
      const t3 = FieldAdd(F, T.z, T.t);
      const t4 = FieldSub(F, T.z, T.t);
      return theta(FieldAdd(F, t1, t3), FieldAdd(F, t2, t4), FieldSub(F, t1, t3), FieldSub(F, t2, t4));
    }

    /**
     * @param {ThetaPoint} T - a theta point
     * @returns {ThetaPoint} its coordinates squared
     */
    function pointwiseSquare(T) {
      return theta(FieldSqr(F, T.x), FieldSqr(F, T.y), FieldSqr(F, T.z), FieldSqr(F, T.t));
    }

    /**
     * @param {ThetaPoint} T - a theta point
     * @returns {ThetaPoint} the Hadamard transform of its squares
     */
    function toSquaredTheta(T) {
      return hadamard(pointwiseSquare(T));
    }

    /**
     * @param {Fp2[][]} M - M
     * @param {ThetaPoint} T - T
     * @returns {ThetaPoint} Result
     */
    function applyIsomorphism(M, T) {
      /**
       * @param {int32} r - the row
       * @returns {Fp2} row r of M applied to T
       */
      function row(r) {
        return FieldAdd(F, FieldAdd(F, FieldMul(F, T.x, M[r][0]), FieldMul(F, T.y, M[r][1])),
                     FieldAdd(F, FieldMul(F, T.z, M[r][2]), FieldMul(F, T.t, M[r][3])));
      }
      return theta(row(0), row(1), row(2), row(3));
    }

    /**
     * @param {ThetaStructure} A - A
     * @returns {ThetaPrecomputation} Result
     */
    function thetaPrecomputation(A) {
      if (A.pre) return A.pre;
      const d = toSquaredTheta(A.null);
      let t1 = FieldMul(F, d.x, d.y);
      let t2 = FieldMul(F, d.z, d.t);
      const pre = new ThetaPrecomputation(FieldMul(F, t1, d.z), FieldMul(F, t1, d.t), FieldMul(F, t2, d.y), FieldMul(F, t2, d.x));
      const n = A.null;
      t1 = FieldMul(F, n.x, n.y);
      t2 = FieldMul(F, n.z, n.t);
      pre.xyz0 = FieldMul(F, t1, n.z);
      pre.xyt0 = FieldMul(F, t1, n.t);
      pre.yzt0 = FieldMul(F, t2, n.y);
      pre.xzt0 = FieldMul(F, t2, n.x);
      A.pre = pre;
      return pre;
    }

    /**
     * @param {ThetaStructure} A - A
     * @param {ThetaPoint} T - T
     * @returns {ThetaPoint} Result
     */
    function thetaDouble(A, T) {
      const pre = thetaPrecomputation(A);
      let o = pointwiseSquare(toSquaredTheta(T));
      o = theta(FieldMul(F, o.x, pre.YZT0), FieldMul(F, o.y, pre.XZT0), FieldMul(F, o.z, pre.XYT0), FieldMul(F, o.t, pre.XYZ0));
      o = hadamard(o);
      return theta(FieldMul(F, o.x, pre.yzt0), FieldMul(F, o.y, pre.xzt0), FieldMul(F, o.z, pre.xyt0), FieldMul(F, o.t, pre.xyz0));
    }

    /**
     * @param {ThetaStructure} A - A
     * @param {ThetaPoint} T - T
     * @param {int32} e - e
     * @returns {ThetaPoint} Result
     */
    function thetaDoubleIter(A, T, e) {
      let o = T;
      for (let i = 0; i < e; ++i) o = thetaDouble(A, o);
      return o;
    }

    // Action by translation of the 4-torsion, for the gluing change of basis.
    /**
     * @param {XzPoint} P4 - P4
     * @param {XzPoint} P2 - P2
     * @param {Fp2} zInv - zInv
     * @param {Fp2} detInv - detInv
     * @returns {TranslationMatrix} Result
     */
    function translationMatrix(P4, P2, zInv, detInv) {
      const tmp = FieldMul(F, P4.x, zInv);
      let g10 = FieldMul(F, P4.x, P2.x);
      g10 = FieldMul(F, g10, detInv);
      g10 = FieldSub(F, g10, tmp);
      let g11 = FieldMul(F, P2.x, detInv);
      g11 = FieldMul(F, g11, P4.z);
      const g00 = FieldNeg(F, g11);
      let g01 = FieldMul(F, P2.z, detInv);
      g01 = FieldMul(F, g01, P4.z);
      return new TranslationMatrix(g00, FieldNeg(F, g01), g10, g11);
    }

    /**
     * @param {XzCouple} K1_4 - K1_4
     * @param {XzCouple} K2_4 - K2_4
     * @param {CurvePair} E12 - E12
     * @returns {Fp2[][]|null} Result
     */
    function gluingChangeOfBasis(K1_4, K2_4, E12) {
      const K1_2 = new XzCouple(ecDbl(K1_4.P1, E12.E1), ecDbl(K1_4.P2, E12.E2));
      const K2_2 = new XzCouple(ecDbl(K2_4.P1, E12.E1), ecDbl(K2_4.P2, E12.E2));

      // verify_two_torsion
      if (isZeroPoint(K1_2.P1) || isZeroPoint(K1_2.P2) || isZeroPoint(K2_2.P1) || isZeroPoint(K2_2.P2))
        return null;
      if (pointsEqual(K1_2.P1, K2_2.P1) || pointsEqual(K1_2.P2, K2_2.P2)) return null;
      const O1 = [ecDbl(K1_2.P1, E12.E1), ecDbl(K1_2.P2, E12.E2)];
      const O2 = [ecDbl(K2_2.P1, E12.E1), ecDbl(K2_2.P2, E12.E2)];
      if (!(isZeroPoint(O1[0]) && isZeroPoint(O1[1]) && isZeroPoint(O2[0]) && isZeroPoint(O2[1]))) {
        return null;
      }

      /**
       * @param {XzPoint} P4 - a 4-torsion point
       * @param {XzPoint} P2 - its double
       * @returns {Fp2} the determinant of the two
       */
      function det(P4, P2) {
        return FieldSub(F, FieldMul(F, P4.x, P2.z), FieldMul(F, P4.z, P2.x));
      }
      const inv = FieldBatchedInv(F, [
        K1_4.P1.z, K1_4.P2.z, K2_4.P1.z, K2_4.P2.z,
        det(K1_4.P1, K1_2.P1), det(K1_4.P2, K1_2.P2), det(K2_4.P1, K2_2.P1), det(K2_4.P2, K2_2.P2)
      ]);
      if (FieldIsZero(F, inv[0])) return null;

      const G = [
        translationMatrix(K1_4.P1, K1_2.P1, inv[0], inv[4]),
        translationMatrix(K1_4.P2, K1_2.P2, inv[1], inv[5]),
        translationMatrix(K2_4.P1, K2_2.P1, inv[2], inv[6]),
        translationMatrix(K2_4.P2, K2_2.P2, inv[3], inv[7])
      ];

      const t001 = FieldAdd(F, FieldMul(F, G[0].g00, G[2].g00), FieldMul(F, G[0].g01, G[2].g10));
      const t101 = FieldAdd(F, FieldMul(F, G[0].g10, G[2].g00), FieldMul(F, G[0].g11, G[2].g10));
      const t002 = FieldAdd(F, FieldMul(F, G[1].g00, G[3].g00), FieldMul(F, G[1].g01, G[3].g10));
      const t102 = FieldAdd(F, FieldMul(F, G[1].g10, G[3].g00), FieldMul(F, G[1].g11, G[3].g10));

      /** @type {Fp2[][]} */
      const M = [[], [], [], []];
      M[0][0] = FieldAdd(F, FieldAdd(F, FieldAdd(F, FieldOne(F), FieldMul(F, t001, t002)), FieldMul(F, G[2].g00, G[3].g00)), FieldMul(F, G[0].g00, G[1].g00));
      M[0][1] = FieldAdd(F, FieldAdd(F, FieldMul(F, t001, t102), FieldMul(F, G[2].g00, G[3].g10)), FieldMul(F, G[0].g00, G[1].g10));
      M[0][2] = FieldAdd(F, FieldAdd(F, FieldMul(F, t101, t002), FieldMul(F, G[2].g10, G[3].g00)), FieldMul(F, G[0].g10, G[1].g00));
      M[0][3] = FieldAdd(F, FieldAdd(F, FieldMul(F, t101, t102), FieldMul(F, G[2].g10, G[3].g10)), FieldMul(F, G[0].g10, G[1].g10));

      M[1][0] = FieldAdd(F, FieldMul(F, G[3].g00, M[0][0]), FieldMul(F, G[3].g01, M[0][1]));
      M[1][1] = FieldAdd(F, FieldMul(F, G[3].g10, M[0][0]), FieldMul(F, G[3].g11, M[0][1]));
      M[1][2] = FieldAdd(F, FieldMul(F, G[3].g00, M[0][2]), FieldMul(F, G[3].g01, M[0][3]));
      M[1][3] = FieldAdd(F, FieldMul(F, G[3].g10, M[0][2]), FieldMul(F, G[3].g11, M[0][3]));

      M[2][0] = FieldAdd(F, FieldMul(F, G[0].g00, M[0][0]), FieldMul(F, G[0].g01, M[0][2]));
      M[2][1] = FieldAdd(F, FieldMul(F, G[0].g00, M[0][1]), FieldMul(F, G[0].g01, M[0][3]));
      M[2][2] = FieldAdd(F, FieldMul(F, G[0].g10, M[0][0]), FieldMul(F, G[0].g11, M[0][2]));
      M[2][3] = FieldAdd(F, FieldMul(F, G[0].g10, M[0][1]), FieldMul(F, G[0].g11, M[0][3]));

      M[3][0] = FieldAdd(F, FieldMul(F, G[0].g00, M[1][0]), FieldMul(F, G[0].g01, M[1][2]));
      M[3][1] = FieldAdd(F, FieldMul(F, G[0].g00, M[1][1]), FieldMul(F, G[0].g01, M[1][3]));
      M[3][2] = FieldAdd(F, FieldMul(F, G[0].g10, M[1][0]), FieldMul(F, G[0].g11, M[1][2]));
      M[3][3] = FieldAdd(F, FieldMul(F, G[0].g10, M[1][1]), FieldMul(F, G[0].g11, M[1][3]));
      return M;
    }

    /**
     * @param {Fp2[][]} M - M
     * @param {XzCouple} T - T
     * @returns {ThetaPoint} Result
     */
    function baseChange(M, T) {
      const nul = theta(FieldMul(F, T.P1.x, T.P2.x), FieldMul(F, T.P1.x, T.P2.z), FieldMul(F, T.P2.x, T.P1.z), FieldMul(F, T.P1.z, T.P2.z));
      return applyIsomorphism(M, nul);
    }

    /**
     * The gluing isogeny E1 x E2 -> A with kernel [4](K1_8, K2_8).
     * @param {CurvePair} E12 - E12
     * @param {JacCouple} xyK1_8 - xyK1_8
     * @param {JacCouple} xyK2_8 - xyK2_8
     * @returns {GluingIsogeny|null} Result
     */
    function gluingCompute(E12, xyK1_8, xyK2_8) {
      const xyK1_4 = doubleCoupleJac(xyK1_8, E12);
      const xyK2_4 = doubleCoupleJac(xyK2_8, E12);
      /**
       * @param {JacCouple} T - a couple of Jacobian points
       * @returns {XzCouple} their x-only forms
       */
      function toXZ(T) {
        return new XzCouple(jacToXZ(T.P1), jacToXZ(T.P2));
      }
      const K1_8 = toXZ(xyK1_8), K2_8 = toXZ(xyK2_8);
      const K1_4 = toXZ(xyK1_4), K2_4 = toXZ(xyK2_4);

      const M = gluingChangeOfBasis(K1_4, K2_4, E12);
      if (!M) return null;

      const TT1 = toSquaredTheta(baseChange(M, K1_8));
      const TT2 = toSquaredTheta(baseChange(M, K2_8));

      if (!(FieldIsZero(F, TT1.t) && FieldIsZero(F, TT2.t))) return null;
      if (FieldIsZero(F, TT1.x) || FieldIsZero(F, TT2.x) || FieldIsZero(F, TT1.y) || FieldIsZero(F, TT2.z) || FieldIsZero(F, TT1.z))
        return null;

      let codomain = theta(FieldMul(F, TT1.x, TT2.x), FieldMul(F, TT1.y, TT2.x), FieldMul(F, TT1.x, TT2.z), FieldZero(F));
      const precomputation = theta(FieldMul(F, TT1.y, TT2.z), codomain.z, codomain.y, FieldZero(F));
      const imageK1_8 = new ProjectivePair(FieldMul(F, TT1.x, precomputation.x), FieldMul(F, TT1.z, precomputation.z));

      // the 4-torsion points [2]K1_8 and [2]K2_8 have to be isotropic
      if (!FieldEqual(F, imageK1_8.x, FieldMul(F, TT1.y, precomputation.y))) return null;
      if (!FieldEqual(F, FieldMul(F, TT2.z, precomputation.z), FieldMul(F, TT2.x, precomputation.x))) return null;

      codomain = hadamard(codomain);
      return new GluingIsogeny(M, xyK1_8, E12, codomain, imageK1_8);
    }

    /**
     * @param {JacCouple} Pc - Pc
     * @param {GluingIsogeny} phi - phi
     * @returns {ThetaPoint} Result
     */
    function gluingEvalPoint(Pc, phi) {
      const c1 = jacAddComponents(Pc.P1, phi.xyK1_8.P1, phi.domain.E1);
      const c2 = jacAddComponents(Pc.P2, phi.xyK1_8.P2, phi.domain.E2);

      const T2t = FieldMul(F, c1.v, c2.v);
      const T1x = FieldAdd(F, FieldMul(F, c1.u, c2.u), T2t);
      let T1 = theta(T1x, FieldMul(F, c1.u, c2.w), FieldMul(F, c1.w, c2.u), FieldMul(F, c1.w, c2.w));
      let T2x = FieldMul(F, FieldAdd(F, c1.u, c1.v), FieldAdd(F, c2.u, c2.v));
      T2x = FieldSub(F, T2x, T1x);
      let T2 = theta(T2x, FieldMul(F, c1.v, c2.w), FieldMul(F, c1.w, c2.v), FieldZero(F));

      T1 = pointwiseSquare(applyIsomorphism(phi.M, T1));
      T2 = pointwiseSquare(applyIsomorphism(phi.M, T2));
      T1 = hadamard(theta(FieldSub(F, T1.x, T2.x), FieldSub(F, T1.y, T2.y), FieldSub(F, T1.z, T2.z), FieldSub(F, T1.t, T2.t)));

      const image = theta(FieldMul(F, T1.x, phi.imageK1_8.y), FieldMul(F, T1.y, phi.imageK1_8.y),
                          FieldMul(F, T1.z, phi.imageK1_8.x), FieldMul(F, T1.t, phi.imageK1_8.x));
      return hadamard(image);
    }

    /**
     * A (2,2)-isogeny of the theta model with kernel [4](T1_8, T2_8).
     * @param {ThetaStructure} A - A
     * @param {ThetaPoint} T1_8 - T1_8
     * @param {ThetaPoint} T2_8 - T2_8
     * @param {boolean} hadamard1 - hadamard1
     * @param {boolean} hadamard2 - hadamard2
     * @param {boolean} verify - verify
     * @returns {ThetaIsogeny|null} Result
     */
    function thetaIsogenyCompute(A, T1_8, T2_8, hadamard1, hadamard2, verify) {
      /** @type {ThetaPoint} */
      let TT1;
      /** @type {ThetaPoint} */
      let TT2;
      if (hadamard1) {
        TT1 = toSquaredTheta(hadamard(T1_8));
        TT2 = toSquaredTheta(hadamard(T2_8));
      } else {
        TT1 = toSquaredTheta(T1_8);
        TT2 = toSquaredTheta(T2_8);
      }

      if (FieldIsZero(F, TT2.x) || FieldIsZero(F, TT2.y) || FieldIsZero(F, TT2.z) || FieldIsZero(F, TT2.t)
          || FieldIsZero(F, TT1.x) || FieldIsZero(F, TT1.y))
        return null;

      const t1 = FieldMul(F, TT1.x, TT2.y);
      const t2 = FieldMul(F, TT1.y, TT2.x);
      let nul = theta(FieldMul(F, TT2.x, t1), FieldMul(F, TT2.y, t2), FieldMul(F, TT2.z, t1), FieldMul(F, TT2.t, t2));
      const t3 = FieldMul(F, TT2.z, TT2.t);
      const pre = theta(FieldMul(F, t3, TT1.y), FieldMul(F, t3, TT1.x), nul.t, nul.z);

      if (verify) {
        if (!FieldEqual(F, FieldMul(F, TT1.x, pre.x), FieldMul(F, TT1.y, pre.y))) return null;
        if (!FieldEqual(F, FieldMul(F, TT1.z, pre.z), FieldMul(F, TT1.t, pre.t))) return null;
        if (!FieldEqual(F, FieldMul(F, TT2.x, pre.x), FieldMul(F, TT2.z, pre.z))) return null;
        if (!FieldEqual(F, FieldMul(F, TT2.y, pre.y), FieldMul(F, TT2.t, pre.t))) return null;
      }

      if (hadamard2) nul = hadamard(nul);
      return new ThetaIsogeny(hadamard1, hadamard2, pre, new ThetaStructure(nul, null));
    }

    /**
     * @param {ThetaIsogeny} phi - phi
     * @param {ThetaPoint} T - T
     * @returns {ThetaPoint} Result
     */
    function thetaIsogenyEval(phi, T) {
      let o = phi.hadamard1 ? toSquaredTheta(hadamard(T)) : toSquaredTheta(T);
      o = theta(FieldMul(F, o.x, phi.pre.x), FieldMul(F, o.y, phi.pre.y), FieldMul(F, o.z, phi.pre.z), FieldMul(F, o.t, phi.pre.t));
      return phi.hadamard2 ? hadamard(o) : o;
    }

    // The ten even theta characteristics, and the base changes that move the
    // vanishing one to the product position.
    /** @type {int32[][]} */
    const EVEN_INDEX = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 2], [2, 0], [2, 1], [3, 0], [3, 3]];
    /** @type {int32[][]} */
    const CHI_EVAL = [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
    // 0 = zero, 1 = one, 2 = i, 3 = -1, 4 = -i
    /** @type {int32[][][]} */
    const SPLITTING_TRANSFORMS = [
      [[1, 2, 1, 2], [1, 4, 3, 2], [1, 2, 3, 4], [3, 2, 3, 2]],
      [[1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0], [0, 3, 0, 0]],
      [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 3, 0]],
      [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 3]],
      [[1, 1, 1, 1], [1, 3, 3, 1], [1, 1, 3, 3], [3, 1, 3, 1]],
      [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]],
      [[1, 1, 1, 1], [1, 3, 1, 3], [1, 3, 3, 1], [3, 3, 1, 1]],
      [[1, 1, 1, 1], [1, 3, 1, 3], [1, 3, 3, 1], [1, 1, 3, 3]],
      [[1, 1, 1, 1], [1, 3, 1, 3], [1, 1, 3, 3], [3, 1, 1, 3]],
      [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    ];
    /** @type {Fp2[]} */
    const FP2_CONSTANTS = [FieldZero(F), FieldOne(F), FieldOf(F, 0n, 1n), FieldNeg(F, FieldOne(F)), FieldNeg(F, FieldOf(F, 0n, 1n))];

    /**
     * @param {ThetaStructure} A - A
     * @param {int32} zeroIndex - zeroIndex
     * @returns {Splitting|null} Result
     */
    function splittingCompute(A, zeroIndex) {
      /** @type {Fp2[][]|null} */
      let M = null;
      let count = 0;
      for (let i = 0; i < 10; ++i) {
        let U = FieldZero(F);
        for (let t = 0; t < 4; ++t) {
          const t2 = thetaCoord(A.null, t);
          let t1 = thetaCoord(A.null, OpCodes.Xor32(t, EVEN_INDEX[i][1]));
          t1 = FieldMul(F, t1, t2);
          if (CHI_EVAL[EVEN_INDEX[i][0]][t] < 0) t1 = FieldNeg(F, t1);
          U = FieldAdd(F, U, t1);
        }
        const vanishes = FieldIsZero(F, U);
        if (vanishes) {
          ++count;
          const transform = SPLITTING_TRANSFORMS[i];
          M = new Array(transform.length);
          for (let row = 0; row < transform.length; ++row) {
            /** @type {Fp2[]} */
            const entries = new Array(transform[row].length);
            for (let col = 0; col < transform[row].length; ++col) entries[col] = FP2_CONSTANTS[transform[row][col]];
            M[row] = entries;
          }
        }
        if (zeroIndex !== -1 && i === zeroIndex && !vanishes) return null;
      }
      if (count !== 1) return null;
      return new Splitting(M, new ThetaStructure(applyIsomorphism(M, A.null), null));
    }

    /**
     * @param {ThetaStructure} A - A
     * @returns {CurvePair|null} Result
     */
    function productStructureToEllipticProduct(A) {
      const n = A.null;
      if (!FieldEqual(F, FieldMul(F, n.x, n.t), FieldMul(F, n.y, n.z))) return null;
      if (FieldIsZero(F, n.x) || FieldIsZero(F, n.y) || FieldIsZero(F, n.z)) {
        return null;
      }

      /**
       * @param {Fp2} a - a theta constant
       * @param {Fp2} b - another
       * @returns {MontCurve} the curve they define
       */
      function curveOf(a, b) {
        const aa = FieldSqr(F, FieldSqr(F, a));
        const bb = FieldSqr(F, FieldSqr(F, b));
        let A2 = FieldAdd(F, aa, bb);
        A2 = FieldNeg(F, FieldAdd(F, A2, A2));
        return new MontCurve(A2, FieldSub(F, aa, bb), pointInfinity(), false);
      }
      const E2 = curveOf(n.x, n.y);
      const E1 = curveOf(n.x, n.z);
      if (FieldIsZero(F, E1.C) || FieldIsZero(F, E2.C)) return null;
      return new CurvePair(E1, E2);
    }

    /**
     * The chain of n (2,2)-isogenies from E1 x E2 whose kernel the bases
     * generate, with the two extra bits of torsion the signature provides.
     * Returns the codomain product, or null when the chain does not split.
     * @param {int32} n - n
     * @param {CurvePair} E12 - E12
     * @param {CoupleKernel} ker - ker
     * @returns {CurvePair|null} Result
     */
    function thetaChainVerify(n, E12, ker) {
      const lift1 = liftBasis(new XzBasis(ker.T1.P1, ker.T2.P1, ker.T1m2.P1), E12.E1);
      if (!lift1.ok) return null;
      const lift2 = liftBasis(new XzBasis(ker.T1.P2, ker.T2.P2, ker.T1m2.P2), E12.E2);
      if (!lift2.ok) return null;

      const xyT1 = new JacCouple(lift1.P, lift2.P);
      const xyT2 = new JacCouple(lift1.Q, lift2.Q);

      /** @type {int32[]} */
      const todo = [n];
      let current = 0;
      /** @type {JacCouple[]} */
      const jacQ1 = [xyT1];
      /** @type {JacCouple[]} */
      const jacQ2 = [xyT2];
      while (todo[current] !== 1) {
        ++current;
        const prev = todo[current - 1];
        const dbls = prev >= 16 ? Math.floor(prev / 2) : prev - 1;
        jacQ1[current] = doubleCoupleJacIter(jacQ1[current - 1], dbls, E12);
        jacQ2[current] = doubleCoupleJacIter(jacQ2[current - 1], dbls, E12);
        todo[current] = prev - dbls;
      }

      const gluing = gluingCompute(E12, jacQ1[current], jacQ2[current]);
      if (!gluing) {
        return null;
      }

      /** @type {ThetaPoint[]} */
      const thetaQ1 = [];
      /** @type {ThetaPoint[]} */
      const thetaQ2 = [];
      for (let j = 0; j < current; ++j) {
        thetaQ1[j] = gluingEvalPoint(jacQ1[j], gluing);
        thetaQ2[j] = gluingEvalPoint(jacQ2[j], gluing);
        --todo[j];
      }
      --current;

      let A = new ThetaStructure(gluing.codomain, null);

      for (let i = 1; current >= 0 && todo[current]; ++i) {
        while (todo[current] !== 1) {
          ++current;
          const prev = todo[current - 1];
          const dbls = Math.floor(prev / 2);
          thetaQ1[current] = thetaDoubleIter(A, thetaQ1[current - 1], dbls);
          thetaQ2[current] = thetaDoubleIter(A, thetaQ2[current - 1], dbls);
          todo[current] = prev - dbls;
        }

        /** @type {ThetaIsogeny} */
        let step;
        if (i === n - 2)
          step = thetaIsogenyCompute(A, thetaQ1[current], thetaQ2[current], false, false, true);
        else if (i === n - 1)
          step = thetaIsogenyCompute(A, thetaQ1[current], thetaQ2[current], true, false, false);
        else
          step = thetaIsogenyCompute(A, thetaQ1[current], thetaQ2[current], false, true, true);
        if (!step) return null;

        A = step.codomain;
        for (let j = 0; j < current; ++j) {
          thetaQ1[j] = thetaIsogenyEval(step, thetaQ1[j]);
          thetaQ2[j] = thetaIsogenyEval(step, thetaQ2[j]);
          --todo[j];
        }
        --current;
      }

      const split = splittingCompute(A, 8);
      if (!split) return null;
      return productStructureToEllipticProduct(split.B);
    }

    // --- the protocol ---

    /**
     * @param {uint8[]} bytes - bytes
     * @returns {SqiPublicKey} Result
     */
    function decodePublicKey(bytes) {
      return new SqiPublicKey(FieldDecode(F, bytes, 0), bytes[prm.fp2Bytes]);
    }

    /**
     * @param {uint8[]} bytes - bytes
     * @returns {SqiSignature} Result
     */
    function decodeSignature(bytes) {
      let offset = 0;
      const sig = new SqiSignature();
      sig.auxA = FieldDecode(F, bytes, offset);
      offset += prm.fp2Bytes;
      sig.backtracking = bytes[offset++];
      sig.twoRespLength = bytes[offset++];
      const nb = prm.matrixEntryBytes;
      /**
       * @returns {BigInt} the next matrix entry
       */
      function entry() {
        const v = DecodeLittleEndian(bytes, offset, nb);
        offset += nb;
        return v;
      }
      const m00 = entry();
      const m01 = entry();
      const m10 = entry();
      const m11 = entry();
      sig.mat = [[m00, m01], [m10, m11]];
      const cb = prm.securityBits / 8;
      sig.challenge = DecodeLittleEndian(bytes, offset, cb);
      offset += cb;
      sig.hintAux = bytes[offset++];
      sig.hintChall = bytes[offset++];
      return sig;
    }

    /**
     * The challenge: SHAKE256 of j(E_pk), j(E_com) and the message, iterated.
     * @param {MontCurve} pkCurve - pkCurve
     * @param {MontCurve} comCurve - comCurve
     * @param {uint8[]} message - message
     * @returns {BigInt} Result
     */
    function hashToChallenge(pkCurve, comCurve, message) {
      const buf = FieldEncode(F, jInvariant(pkCurve)).concat(FieldEncode(F, jInvariant(comCurve)));
      const hashBytes = Math.floor((2 * prm.securityBits + 7) / 8);
      let scalar = Shake256([buf, message], hashBytes);
      for (let i = 2; i < prm.hashIterations; ++i) scalar = Shake256([scalar], hashBytes);
      const bits = TORSION - prm.responseLength;
      const outBytes = Math.floor((bits + 7) / 8);
      const out = Shake256([scalar], outBytes);
      let value = DecodeLittleEndian(out, 0, outBytes) % PowerOfTwo(bits);
      return value % PowerOfTwo(prm.securityBits);
    }

    /**
     * @param {SqiSignature} sig - sig
     * @param {SqiPublicKey} pk - pk
     * @param {uint8[]} message - message
     * @returns {boolean} Result
     */
    function verify(sig, pk, message) {
      // the matrix entries have to be canonical below 2^(response + 2 - backtracking)
      const bound = prm.responseLength + HD_EXTRA_TORSION - sig.backtracking;
      if (bound < 0) return false;
      const limit = PowerOfTwo(bound);
      for (let i = 0; i < 2; ++i)
        for (let j = 0; j < 2; ++j)
          if (sig.mat[i][j] >= limit) return false;

      const powDim2 = prm.responseLength - sig.twoRespLength - sig.backtracking;
      if (powDim2 < 0) return false;
      // a dimension-two isogeny embedding one of odd degree is never of length 1
      if (powDim2 === 1) return false;

      if (!curveVerifyA(pk.A)) return false;
      const Eaux = curveFromA(sig.auxA);
      if (!curveVerifyA(sig.auxA)) return false;
      const Epk = curveFromA(pk.A);

      // the challenge isogeny
      const phiCurve = copyCurve(Epk);
      const basisPk = basisFromHint(phiCurve, TORSION, pk.hint);
      let kernel = ladder3pt(sig.challenge, basisPk.P, basisPk.Q, basisPk.PmQ, phiCurve);
      if (!kernel) return false;
      kernel = ecDblIter(kernel, sig.backtracking, phiCurve);
      const Echall = copyCurve(phiCurve);
      if (!evalEvenStrategy(Echall, [], kernel, TORSION - sig.backtracking)) return false;

      // the canonical bases of the challenge and auxiliary curves
      let Bchall = basisFromHint(Echall, TORSION, sig.hintChall);
      Bchall = ecDblIterBasis(Bchall, TORSION - powDim2 - HD_EXTRA_TORSION - sig.twoRespLength, Echall);
      let Baux = basisFromHint(Eaux, TORSION, sig.hintAux);
      Baux = ecDblIterBasis(Baux, TORSION - powDim2 - HD_EXTRA_TORSION, Eaux);

      const f = powDim2 + HD_EXTRA_TORSION + sig.twoRespLength;
      const modF = PowerOfTwo(f);
      const m = sig.mat;
      const tmp = new XzBasis(Bchall.P, Bchall.Q, Bchall.PmQ);
      const nP = biscalarMul(m[0][0], m[1][0], f, tmp, Echall);
      if (!nP) return false;
      const nQ = biscalarMul(m[0][1], m[1][1], f, tmp, Echall);
      if (!nQ) return false;
      const s0 = ((m[0][0] - m[0][1]) % modF + modF) % modF;
      const s1 = ((m[1][0] - m[1][1]) % modF + modF) % modF;
      const nPmQ = biscalarMul(s0, s1, f, tmp, Echall);
      if (!nPmQ) return false;
      Bchall = new XzBasis(nP, nQ, nPmQ);

      // the short 2^r response isogeny
      if (sig.twoRespLength > 0) {
        let ker = (m[0][0] % 2n === 0n && m[1][0] % 2n === 0n) ? Bchall.Q : Bchall.P;
        ker = ecDblIter(ker, powDim2 + HD_EXTRA_TORSION, Echall);
        const pts = [Bchall.P, Bchall.Q, Bchall.PmQ];
        if (!evalSmallChain(Echall, ker, sig.twoRespLength, pts)) return false;
        Bchall = new XzBasis(pts[0], pts[1], pts[2]);
      }

      // the commitment curve, from the dimension-two isogeny
      /** @type {MontCurve} */
      let Ecom;
      if (powDim2 === 0) {
        const P2 = xDblA24(Bchall.P, Echall.A24, Echall.normalized);
        const Q2 = xDblA24(Bchall.Q, Echall.A24, Echall.normalized);
        if (!(isTwoTorsion(P2, Echall) && isTwoTorsion(Q2, Echall) && !pointsEqual(P2, Q2))) return false;
        Ecom = copyCurve(Echall);
      } else {
        const E12 = new CurvePair(copyCurve(Echall), copyCurve(Eaux));
        const ker = new CoupleKernel(
          new XzCouple(Bchall.P, Baux.P),
          new XzCouple(Bchall.Q, Baux.Q),
          new XzCouple(Bchall.PmQ, Baux.PmQ)
        );
        const codomain = thetaChainVerify(powDim2, E12, ker);
        if (!codomain) return false;
        Ecom = codomain.E1;
      }

      return hashToChallenge(Epk, Ecom, message) === sig.challenge;
    }

    if (publicKey.length !== prm.publicKeyBytes)
      return new SqiOpenResult(false, null, 'a ' + prm.name + ' public key is ' + prm.publicKeyBytes + ' bytes');
    if (signedMessage.length < prm.signatureBytes)
      return new SqiOpenResult(false, null, 'a ' + prm.name + ' signed message carries a ' + prm.signatureBytes + ' byte signature');
    const sig = decodeSignature(signedMessage);
    const message = signedMessage.slice(prm.signatureBytes);
    const accepted = verify(sig, decodePublicKey(publicKey), message);
    return new SqiOpenResult(accepted, accepted ? message : null, accepted ? '' : 'the signature does not verify');
  }

  /**
   * Open a signed message under a public key; the key's length picks the level.
   * @param {uint8[]} signedMessage - signature || message
   * @param {uint8[]} publicKey - the encoded public key
   * @returns {SqiOpenResult} the outcome
   */
  function SignOpen(signedMessage, publicKey) {
    const prm = ParameterSetByPublicKeyLength(publicKey.length);
    if (!prm) {
      return new SqiOpenResult(false, null, 'no SQIsign level has a ' + publicKey.length + ' byte public key');
    }
    /** @type {uint8[]} */
    const sm = [];
    for (let i = 0; i < signedMessage.length; ++i) sm.push(OpCodes.And32(signedMessage[i], 0xFF));
    /** @type {uint8[]} */
    const pk = [];
    for (let i = 0; i < publicKey.length; ++i) pk.push(OpCodes.And32(publicKey[i], 0xFF));
    return OpenSigned(prm, sm, pk);
  }

  // ===== KAT DATA =====
  //
  // Records of the PQCsignKAT response files of the round 2 submission package,
  // transcribed as published: the public key, the message and the signed
  // message. Nothing here was produced by this file.
  //
  // The records were chosen for what their signatures make verification do, so
  // that between them the positive vectors drive every branch the published
  // signatures reach:
  //
  //   SQIsign-I    count  1  backtracking 1, a 2^2 response isogeny on P
  //                count  7  no backtracking, no response isogeny
  //                count 14  backtracking 1, a response isogeny on Q
  //   SQIsign-III  count  2  backtracking 1, a 2^1 response isogeny on Q
  //                count  4  no backtracking, no response isogeny
  //                count  8  backtracking 1, a 2^3 response isogeny on P
  //   SQIsign-V    count  1  backtracking 1, a 2^1 response isogeny on P
  //                count  2  no backtracking, no response isogeny
  //                count 13  backtracking 1, a response isogeny on Q
  //
  // and their hints cover both constructions of a canonical basis, the one for
  // a curve coefficient that is a square in GF(p^2) and the one for a
  // non-square. Three branches are reached by no published signature, in any
  // of the 300 records: the fallback search when a basis hint is zero, the
  // precomputed basis of the curve with A = 0, and a response with no
  // two-dimensional part. They follow the reference line for line and are
  // unverified.

  const KAT_URI = 'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip';

  /** One record of a PQCsignKAT response file. */
  class SqiKatRecord {
    /**
     * @param {string} level - the parameter set
     * @param {string} file - the response file
     * @param {int32} count - the record's count
     * @param {string} pk - hex of the public key
     * @param {string} msg - hex of the message
     * @param {string} sm - hex of the signed message
     */
    constructor(level, file, count, pk, msg, sm) {
      /** @type {string} */
      this.level = level;
      /** @type {string} */
      this.file = file;
      /** @type {int32} */
      this.count = count;
      /** @type {string} */
      this.pk = pk;
      /** @type {string} */
      this.msg = msg;
      /** @type {string} */
      this.sm = sm;
    }
  }

  /** @type {SqiKatRecord[]} */
  const KAT = [
      new SqiKatRecord(
        'SQIsign-I', 'PQCsignKAT_353_SQIsign_lvl1.rsp', 1,
        // pk
        '8fe148717389e48c123c9aa09fb17c5c6f0cef7e3471ef400296e3ec18e59901e7bfbd3aaab48cb49e7198d5543ae786' +
            '727d904425f343a64bc03513b09472010b',
        // msg
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
            'b2568209e46dba961869c6f83983b17dcd49',
        // sm
        '410e68d74d44a5ce60ec0c05232c9e08a12afbc5c4584f3cf9dbf3e235774d01d420a17eba5c5b2ba8b853f5bc66670d' +
            'b2e3bbf8b11944e1d82b22896e76ca040102e9356a08d41768e8b250b54c33de5a3f07f5a5f1667bbfb84e8b68e10b07' +
            '077fddc9268b4267e5ce42c8c04f17412e200f7b59038d18600d95c2a7c84e54312fa59abf9342169f4a4d7faceab486' +
            '6b030204225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227' +
            'eba38c1ab2568209e46dba961869c6f83983b17dcd49'
      ),
      new SqiKatRecord(
        'SQIsign-I', 'PQCsignKAT_353_SQIsign_lvl1.rsp', 7,
        // pk
        'bb1ed0183d5192fd52fcf31315cc92632e443acd6a4377010310498419b9f4012d924db8d9847862cbd0a6f920da91ac' +
            '258d2b11f09c08b699e16cfadbc1f60402',
        // msg
        'a1586245d81f96bd8ee81aa30f10c0adb343d74cf72c4dff71550c12873af89fa1874d4731c996243c3749af3f6188ff' +
            'e9fa45430549045134eb29ef3cec37e72904aa082b1c6161e6b52361e49af4933a8d8c0734f21cafd7467b0c02876f43' +
            '211d6122e3e735fe36064df7a0c91449237c2bc7c3a78ac7bb0f9567f2576f05802c872adf183a87aa3b8217188f2f35' +
            '35f877724f35b29e545de4bcf258f13bbc7edd8c6587f733c9691f74b4151cf8c060c3ae9e8d49fe7c77bf477dc9f23f' +
            'd0f0b67320275529034b84f94176730923c03aa50f9584d9c2d60b8dccf85a13f243f30a51abefbbf2cda602bf3d75e8' +
            '49eb92422b808416c7e56b046ce38e4677ad24d23d7237a9',
        // sm
        '25750d798e050ed506b37fd67a1d5cc74b3b84239acc1fac04c4165156d8e50103be1240850cade72f97bc9ca9a56987' +
            'b19ad960e65c4989fa4ae77dec52eb0100006147a2ffe1448119857be09619d50fe0e0a04a8118fef32b35c97fd6bda8' +
            '4ca9f5344dc3d7c73770db27a3669979670b5f2fdf0a02779a7eedb51adf94dc278f788adffbd3e7311034742a22d5df' +
            '8202020ba1586245d81f96bd8ee81aa30f10c0adb343d74cf72c4dff71550c12873af89fa1874d4731c996243c3749af' +
            '3f6188ffe9fa45430549045134eb29ef3cec37e72904aa082b1c6161e6b52361e49af4933a8d8c0734f21cafd7467b0c' +
            '02876f43211d6122e3e735fe36064df7a0c91449237c2bc7c3a78ac7bb0f9567f2576f05802c872adf183a87aa3b8217' +
            '188f2f3535f877724f35b29e545de4bcf258f13bbc7edd8c6587f733c9691f74b4151cf8c060c3ae9e8d49fe7c77bf47' +
            '7dc9f23fd0f0b67320275529034b84f94176730923c03aa50f9584d9c2d60b8dccf85a13f243f30a51abefbbf2cda602' +
            'bf3d75e849eb92422b808416c7e56b046ce38e4677ad24d23d7237a9'
      ),
      new SqiKatRecord(
        'SQIsign-I', 'PQCsignKAT_353_SQIsign_lvl1.rsp', 14,
        // pk
        '2ffc0e8fed091ae82c2fb18a662772de22fddfa4bae6e6ad4b17cec22c69d80254e447611a108a126de83acf74dedeab' +
            'aea4d4b84073915ae7e9570a1ebdd1010b',
        // msg
        '8cb18850e27d8416b88a9a71f4a66bdf447814db6c82098c371b53f61600ef5dfd88e4fb34200207c3f6f55166af4878' +
            'd38fca7e2dc18fe662e3ea491b58a86246cae16090fb7ada53b9a67b3d0e3787d3323ea921274c60cffb19a889bcf030' +
            '0fe10e242aae025f374dd83fbe9d007c8b9d9d75574c74146331ddec6f0e49c10dbaf15654897e33e2b4780dba484224' +
            'aa6fac79015d5792faa2d532bb7d239b11d91420b98690b1fbde9632223927e0804bfb284368a426c414c3db8ea82f0d' +
            '246413861475ed2dca9e80fb4f3c34fef7528069ae1975afc52ac5ad2cdbca1459e140f655556093210d7905a1a1e6ce' +
            'eaef0194a0b2eab2c1ee853484e715d2a1db551fdc620d5331164c74ca4848b61d408d2f2a943fa09efeb63d524691c9' +
            '9dcc0b22cc61b98e6fb8039e5e0b2d7de2caaa900a44184bd56c9f02141a3ae8afc661e3e898ecd3004fdb0704272ba7' +
            '80cd5de35153b6fe223843024273642dcf8e4b58be2ab1f61668680084aa0b75a32e766c8ae5eb30d4e02a12e6798dea' +
            '40f80d8ddfad2041a52922701c689f46f49f84cfc05eca6d7d4c356d50b6a0ba61966245d45134d6a1f5197540a1c39c' +
            '36bb0b78831af3f5156e669fd9213b64e0cf1c5a31e88ae79ad61757ec67b551b9f0a760f646bf81f6b92403a62840cc' +
            '29fa4f3949b3a9f0a9a4286ee7808a',
        // sm
        '1acbe3fbb26b8c020dd11dab10262f631ef20863480a8582b2f3adffa01c4b02a86d4e6ac0f239fb42d59fdfc5dd867a' +
            '5e477657e9bec19cecf987e97e9aed00010226560da2eb9a3c6aed4755f1d93c1805995e863ba186bc564d6cd303c3d2' +
            '5433aef7efb81490dc21593195b3010fde51872d9dd8814f1d3c3935770d36f7d006501678c3f441b9d0e598d9973022' +
            '1d02190b8cb18850e27d8416b88a9a71f4a66bdf447814db6c82098c371b53f61600ef5dfd88e4fb34200207c3f6f551' +
            '66af4878d38fca7e2dc18fe662e3ea491b58a86246cae16090fb7ada53b9a67b3d0e3787d3323ea921274c60cffb19a8' +
            '89bcf0300fe10e242aae025f374dd83fbe9d007c8b9d9d75574c74146331ddec6f0e49c10dbaf15654897e33e2b4780d' +
            'ba484224aa6fac79015d5792faa2d532bb7d239b11d91420b98690b1fbde9632223927e0804bfb284368a426c414c3db' +
            '8ea82f0d246413861475ed2dca9e80fb4f3c34fef7528069ae1975afc52ac5ad2cdbca1459e140f655556093210d7905' +
            'a1a1e6ceeaef0194a0b2eab2c1ee853484e715d2a1db551fdc620d5331164c74ca4848b61d408d2f2a943fa09efeb63d' +
            '524691c99dcc0b22cc61b98e6fb8039e5e0b2d7de2caaa900a44184bd56c9f02141a3ae8afc661e3e898ecd3004fdb07' +
            '04272ba780cd5de35153b6fe223843024273642dcf8e4b58be2ab1f61668680084aa0b75a32e766c8ae5eb30d4e02a12' +
            'e6798dea40f80d8ddfad2041a52922701c689f46f49f84cfc05eca6d7d4c356d50b6a0ba61966245d45134d6a1f51975' +
            '40a1c39c36bb0b78831af3f5156e669fd9213b64e0cf1c5a31e88ae79ad61757ec67b551b9f0a760f646bf81f6b92403' +
            'a62840cc29fa4f3949b3a9f0a9a4286ee7808a'
      ),
      new SqiKatRecord(
        'SQIsign-III', 'PQCsignKAT_529_SQIsign_lvl3.rsp', 2,
        // pk
        'eb728ce5e8a421f40bfe8880ecab2a240ee04f7a225e59b71c4f7fd7a454958e3b0bd76b85f77ff8105b9af50c4c0d19' +
            'da1da62884f73f7f594dc20f645ebd98ee6dfdb697e78725c1bd9db18b1cfe3800390f5d36e0daeb99b294695c23202b' +
            '08',
        // msg
        '2b8c4b0f29363eaee469a7e33524538aa066ae98980eaa19d1f10593203da2143b9e9e1973f7ff0e6c6aaa3c0b900e50' +
            'd003412efe96deece3046d8c46bc7709228789775abdf56aed6416c90033780cb7a4984815da1b14660dcf34aa34bf82' +
            'cebbcf',
        // sm
        'da3af5395ad7bbb673824e96917ea1c19b670f7d0739b34631cc9dc5eb02f5b1128f8c53af12527b9cc4e117bca0af20' +
            '172cb6628c16ea99d3e142307a5b7bb739e00abe6e491ed3cccf5d7669a096758e42227696193ce199b835a9131ac43c' +
            '0101b458a1078af34eea2ac093fec66718d06774c5e0020eee3b00e7e9c2bc0854b1dc524d30043807e4de36287fbfab' +
            '91e611013ecb989371b91f930b454238bb18dab6294a29a84d3e22be00e67c853b1b23db69186b09ef2a85f127c09a08' +
            '663887a436003a3253bcdbcacc23c3e0c5792261181db808303b1b4a750006022b8c4b0f29363eaee469a7e33524538a' +
            'a066ae98980eaa19d1f10593203da2143b9e9e1973f7ff0e6c6aaa3c0b900e50d003412efe96deece3046d8c46bc7709' +
            '228789775abdf56aed6416c90033780cb7a4984815da1b14660dcf34aa34bf82cebbcf'
      ),
      new SqiKatRecord(
        'SQIsign-III', 'PQCsignKAT_529_SQIsign_lvl3.rsp', 4,
        // pk
        'f5e50cb53363976ceb633e49c7efab26ad1bab13e2b678aade4f20692c9d37075e3cd3ed463949811257ab4dd36beb3d' +
            'a475dac1d2bd235dbf8253719600b769b7b0c54f7fcdde8c7218f082cf5430f9e782629973e4ba480a2291d629131102' +
            '08',
        // msg
        '1cdf0ae1124780a8ff00318f779a3b86b3504d059ca7ab3fe4d6eae9fd46428d1dabb704c0735a8fe8708f409741017b' +
            '723d9a304e54fdc5789a7b0748c2464b7308ac9665115644c569ae253d5205751342574c03346dddc1950a6273546616' +
            'b96d0c5ece0a044af0edefbe445f9ae37da5afb8d22a56d9fd1801425a0a276f48431d7af039521e549551481391fe5f' +
            '4ebfb7644d9f9782d83a95137e84ea3aeb3c2f8099',
        // sm
        '6285d7bf636914656ac4e9ccb92b0af197c87f97b29e92ac08030970b13c86bbdaef9fe677b22b3072768ecc99d24902' +
            '32ce57e3c229dde967e241dd53d6f69dbf0c3aeef510a75c46f95accdd2715bc61fbb40905b9f99d1c8abc65b085fb01' +
            '0000baaca3f9e8b4829af53d2bd47e62f16fecb2838f1e2639e2038b25de72576acc19bc4a78b255b217e551dc1e344f' +
            '6dd16802bd2d74e37dfc542ffa658ef4193e6c1778351bfe1c2dcce000b31da58478bd4dee10e99c430c66faf1a6c834' +
            '418289be3601377d94bb978b30e85ef6f2f88fb9b2932b2f389a686ffd000d1d1cdf0ae1124780a8ff00318f779a3b86' +
            'b3504d059ca7ab3fe4d6eae9fd46428d1dabb704c0735a8fe8708f409741017b723d9a304e54fdc5789a7b0748c2464b' +
            '7308ac9665115644c569ae253d5205751342574c03346dddc1950a6273546616b96d0c5ece0a044af0edefbe445f9ae3' +
            '7da5afb8d22a56d9fd1801425a0a276f48431d7af039521e549551481391fe5f4ebfb7644d9f9782d83a95137e84ea3a' +
            'eb3c2f8099'
      ),
      new SqiKatRecord(
        'SQIsign-III', 'PQCsignKAT_529_SQIsign_lvl3.rsp', 8,
        // pk
        'cf617023c07fe87c73f88a258f218cb1c7a661fef55788eb28cbc2da0226ffcab1a6dceb73011455b9f6f2053227dd40' +
            '64836dd9b1dd0561d75cb143d683beabc113114b7714658fc0492806c38d56c365e5ed06b71d4b84a8f269467e0f2b25' +
            '0d',
        // msg
        '9366ed7b3b623c411448b634446f1a3faabdd163a6cc1e2bcae4a98703cd8cee441405892fba051be2a586a6950a5ef7' +
            '3a255e5f86b0d7212e0c51c3bc79be4b88e76ed6f043fef3204faf044bfb1ed722d61eb5d0b74c66a257e8ac3a220627' +
            '3c80d2ec2123a4dbb715d60118d99ed7322e38f1562f82379138da3ddb8baa7ce61ab729afc3748c0134633cf45a9973' +
            'c05c75d04e82f631845427626b5799dc07ddf830ba01e8bc6236bb6d03b37d949dbb29eec7dfe60fbc17ea590956d251' +
            '539792016e2a8b01e70476961bc9ada43cda682d0caa4fcc58810bba1a673ef8f6bc90baee701e8e4f7c04a346ca56c7' +
            'b2862ff57756ce6cd1ee22d677bcdaa896eae96f87870e032c18b6c6a0c1a191fae2ed487ce55296cc4b6339eac9e8a7' +
            '42bd0a44c3525cc750',
        // sm
        'e10e935cbbc3b7b548b565f207f95daaa655959a95f630360c17e6d56a61c29101da728b6893c73d08791bf6afadc433' +
            '7bfbc64c52961cbc4ce4aee971bf66f67940cd1e4d0b9b3ec67919c34d8c7b9e05b9ed89c257ab050c3fb61e60f16b1a' +
            '010353bbb23066a3b7cb5da03bb0fce8e3f7db8199fdf4bd507600a7068b42246afb70ca57eb4bfd8740c8d13b7f81cc' +
            'e089ed01eac7f688a16490f8fcee33ba88964a3219c8d394d4d0c46f00da6729e38b28c4aad3ce2ea547c859fb92a8ed' +
            '6298f172cc010c97ae896db94812a525829b56816ed27a7e7f67f58f1c00170d9366ed7b3b623c411448b634446f1a3f' +
            'aabdd163a6cc1e2bcae4a98703cd8cee441405892fba051be2a586a6950a5ef73a255e5f86b0d7212e0c51c3bc79be4b' +
            '88e76ed6f043fef3204faf044bfb1ed722d61eb5d0b74c66a257e8ac3a2206273c80d2ec2123a4dbb715d60118d99ed7' +
            '322e38f1562f82379138da3ddb8baa7ce61ab729afc3748c0134633cf45a9973c05c75d04e82f631845427626b5799dc' +
            '07ddf830ba01e8bc6236bb6d03b37d949dbb29eec7dfe60fbc17ea590956d251539792016e2a8b01e70476961bc9ada4' +
            '3cda682d0caa4fcc58810bba1a673ef8f6bc90baee701e8e4f7c04a346ca56c7b2862ff57756ce6cd1ee22d677bcdaa8' +
            '96eae96f87870e032c18b6c6a0c1a191fae2ed487ce55296cc4b6339eac9e8a742bd0a44c3525cc750'
      ),
      new SqiKatRecord(
        'SQIsign-V', 'PQCsignKAT_701_SQIsign_lvl5.rsp', 1,
        // pk
        'ddbf05b82d61dd94c4d04534d013c668524642505f0d674e0c10006bf6b45c87dc49b2e3055d9c1ee4c277598a60c295' +
            'e174d52f6c4a938bb67730c50d409c015bd74fba5c590e0b9eda468865b3eeba914ac1ff5cbd1e68502dbc7f72b9e5fe' +
            'c5a593538f641215473cc5441a2fc3770723b7380bb6664967bbec6a94b64a0108',
        // msg
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
            'b2568209e46dba961869c6f83983b17dcd49',
        // sm
        '2fe69d4c312452982e2b0911544d65ee17554adbecb2a03860a180af5b8964044f1bae37d60ebef295f7334574007b99' +
            '09e8b9d5976a54801394ae59c762a300f67507792b1282b65dc7423bb49577ba5f904a276019694db0c14201e589b015' +
            '7e2b0eb2018e2060df6cfc7c90ee2037c2344712d38f7eebe13d2b79a1933b010101af2bc85cb1642d01a69264da9401' +
            'dd3725c31ecb056d60f857ef6a4fd6500017e967f6a6948d1a6e047a557e87bde88147a5291c8ddfada35958aaf1edd4' +
            'e52320a8b309f58e8c43608dd70a39f62e36275cd4d0e0b07d319cb4c4ba9509b60c222a75c8ffc4b14f8562d98444d7' +
            '46e883586481ac539827913d3feefb6dc803ecd2209764ab4b483b952a021efecc29452724fc981cd00f95848a3741e6' +
            '7f00090b225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227' +
            'eba38c1ab2568209e46dba961869c6f83983b17dcd49'
      ),
      new SqiKatRecord(
        'SQIsign-V', 'PQCsignKAT_701_SQIsign_lvl5.rsp', 2,
        // pk
        '4703985adea9f41a6cbcc98227e662690352617bbb05d5406297b8a12bebdb1bbaaff7c9b69bf5fc5351bdcb3664ad4f' +
            '5160c188a390a41b2f36eaefc2c63e01475746aabc99cd5a8fe6fd0d12c94a7585fe0b8551d82f83c6c7089a4fa9b057' +
            '35ba15f77bc05d9eebcb7628c2491a58f0768cea699c19603a23e5eb75ceaf0004',
        // msg
        '2b8c4b0f29363eaee469a7e33524538aa066ae98980eaa19d1f10593203da2143b9e9e1973f7ff0e6c6aaa3c0b900e50' +
            'd003412efe96deece3046d8c46bc7709228789775abdf56aed6416c90033780cb7a4984815da1b14660dcf34aa34bf82' +
            'cebbcf',
        // sm
        'f0de30a68ffc1d912bec7a314d61ba53d6f31db502cda21ec8bda753478d14f6d43d18474faa819616390823177287bf' +
            '7a1c847925b6cda81e69fdcf6157190098ca36e386dee1b6a23c6a477a29d89a9f72a6edccac71e7bd033e789dd540f2' +
            'd17a861c2dd8683687380aff21dca83cd8139b216b68b47db65c5a93ddb8820000008278e96a3fd471af02aa36bb548d' +
            'a75e179daedb9033151b257e3d59a96aeb54490d68a9da03bcaef327ba5587dced533541473debdd67eb75559b670df9' +
            '64590df7af6912d1e4c5b7147ba4a0483f719c7c37f9520d9f16ad07c047f4aded35a881bdca495bc6c77514bb545608' +
            '12ddc23a28fc209b3678ba5fd966d755ae3214efdfd44fb557252398c68801ec227ca857dca93cf0b7d9714ba04e1bdd' +
            '460009022b8c4b0f29363eaee469a7e33524538aa066ae98980eaa19d1f10593203da2143b9e9e1973f7ff0e6c6aaa3c' +
            '0b900e50d003412efe96deece3046d8c46bc7709228789775abdf56aed6416c90033780cb7a4984815da1b14660dcf34' +
            'aa34bf82cebbcf'
      ),
      new SqiKatRecord(
        'SQIsign-V', 'PQCsignKAT_701_SQIsign_lvl5.rsp', 13,
        // pk
        '37018d6d0c3c5e4d9471f7bfaa0ccfadff5c2b308522e6135abb974443069af69e0f0500cc9e0cce1ea3065b5ce89687' +
            '1306fe288e0e54fc86fb73b4822c40019ba3daa475b1e71ba878a7580d069d26b58814ab982354df25b350f2540360d6' +
            '21a5d1c693ef36154f62f8978da2cc923b6ad80e43e5fd5bfe3b18cfbcff91000b',
        // msg
        '439529df1864297e33956afee00a60099b658a67830a6a6abddc329e87831d9f9b647917fedf1ae182a4040214328551' +
            '6fcab83f447354c72fae81ac26e7005c2aa561763c152e66bd80f14565f47defa440dbb491e7994ab9fe35995d5fbb38' +
            '00ca030b43df611141637a5246ab9d9cac02efe14af60736b6bdb2babb97cf21e831e5d04d41c00f090b154977900efa' +
            'dd3a9313389a3f84cb3ac38e8b57b70a43dd08a8243f8154013fd5cf29de5a8df0b197c12b17e0610fcfe3625cc94067' +
            'e01e23d23a243ad1c1f805cc50e1447d1df93c25b8d76396bb7199e64129522462c5fc8b30c132d4ee9e0bf6f52961fc' +
            'e7ecf650647e7064aa5a6574649a323e144d7c5491de4c0a1a76d08f93f87a2fc7f6955fef86991e62e2cb42908e83b0' +
            'c0a8bc180b7453ced293f1e20f300431ec1d395e8a537f0bc36a673d491f14381dea90d8f176d06031b0a7afb40ea8f7' +
            '6d37fa82e2572b9799a5fc7cf4c49bc20ad78efa8cd989a84d72ed680ac3c0f64155c56acbfd7c7d628b418a489f9613' +
            '57f77bd62204adb079dd3106485a37fee535c9cf82e832d8aadcbf686976b806b02ae733db46db0bf162e973931c3e33' +
            '8cc86db38c66262d1b2ebc7691b8281e0b20bf36305fba996d20ecfdc695',
        // sm
        '435430153ecd491b58c7afbea99b501b05c0733e71bfaa7036a4af523d97761a07f727aeecadb01d26cf084bc48851f9' +
            'cfabd3b60fd70f115d7b480500342f01f8797285e73ef857d9a4d3673195974aa187f91c95e0581f4d77058e068be409' +
            '142b563a07b70013a88ee0fdac17f53c3ca6c2410ee12c52c77f9a36e7e2890101018a919353d43022ed505fc1fefafa' +
            '94c28516122162eea752b3543778a9dc79018370d8907d4a9df8b6c6e058dfbe80ddf24d4540495ef90e38a92d8c8eb1' +
            '531d8ccdba9766aa41dd6dcfd7f84cf7ad0ce57c1bc88c1fbd8b42fc2313a586c22929a463d991bf26f3f6c6d6cff53d' +
            'e1f51cbb2b092284ab8459e157a30adbdf06bae95287d74f0324aa442a6401b089bc3e7a3a95db4be7679f66ccf4ecad' +
            '6b000619439529df1864297e33956afee00a60099b658a67830a6a6abddc329e87831d9f9b647917fedf1ae182a40402' +
            '143285516fcab83f447354c72fae81ac26e7005c2aa561763c152e66bd80f14565f47defa440dbb491e7994ab9fe3599' +
            '5d5fbb3800ca030b43df611141637a5246ab9d9cac02efe14af60736b6bdb2babb97cf21e831e5d04d41c00f090b1549' +
            '77900efadd3a9313389a3f84cb3ac38e8b57b70a43dd08a8243f8154013fd5cf29de5a8df0b197c12b17e0610fcfe362' +
            '5cc94067e01e23d23a243ad1c1f805cc50e1447d1df93c25b8d76396bb7199e64129522462c5fc8b30c132d4ee9e0bf6' +
            'f52961fce7ecf650647e7064aa5a6574649a323e144d7c5491de4c0a1a76d08f93f87a2fc7f6955fef86991e62e2cb42' +
            '908e83b0c0a8bc180b7453ced293f1e20f300431ec1d395e8a537f0bc36a673d491f14381dea90d8f176d06031b0a7af' +
            'b40ea8f76d37fa82e2572b9799a5fc7cf4c49bc20ad78efa8cd989a84d72ed680ac3c0f64155c56acbfd7c7d628b418a' +
            '489f961357f77bd62204adb079dd3106485a37fee535c9cf82e832d8aadcbf686976b806b02ae733db46db0bf162e973' +
            '931c3e338cc86db38c66262d1b2ebc7691b8281e0b20bf36305fba996d20ecfdc695'
      )
  ];

  /**
   * @param {string} text - text
   * @returns {uint8[]} Result
   */
  function Hex(text) {
    return OpCodes.Hex8ToBytes(text);
  }

  /**
   * @param {string} level - the parameter set
   * @param {int32} count - the record's count
   * @returns {SqiKatRecord} the committed record
   */
  function Record(level, count) {
    for (let i = 0; i < KAT.length; ++i)
      if (KAT[i].level === level && KAT[i].count === count) return KAT[i];
    throw new Error('no committed SQIsign record ' + level + ' ' + count);
  }

  /**
   * A copy of the bytes with one bit flipped.
   * @param {uint8[]} bytes - bytes
   * @param {int32} offset - offset
   * @param {int32} mask - mask
   * @returns {uint8[]} Result
   */
  function FlipBit(bytes, offset, mask) {
    const out = bytes.slice();
    out[offset] = OpCodes.Xor32(out[offset], mask);
    return out;
  }

  // What each committed record's signature makes verification do, by
  // "level:count".
  /** @type {string[]} */
  const WHAT_KEYS = [
    'SQIsign-I:1', 'SQIsign-I:7', 'SQIsign-I:14',
    'SQIsign-III:2', 'SQIsign-III:4', 'SQIsign-III:8',
    'SQIsign-V:1', 'SQIsign-V:2', 'SQIsign-V:13'
  ];
  /** @type {string[]} */
  const WHAT_TEXTS = [
    'backtracking and a 2^2 response isogeny on P',
    'no backtracking and no response isogeny',
    'backtracking and a response isogeny on Q',
    'backtracking and a 2^1 response isogeny on Q',
    'no backtracking and no response isogeny',
    'backtracking and a 2^3 response isogeny on P',
    'backtracking and a 2^1 response isogeny on P',
    'no backtracking and no response isogeny',
    'backtracking and a response isogeny on Q'
  ];

  /**
   * @param {SqiKatRecord} r - a committed record
   * @returns {string} what its signature makes verification do
   */
  function What(r) {
    const key = r.level + ':' + r.count;
    for (let i = 0; i < WHAT_KEYS.length; ++i)
      if (WHAT_KEYS[i] === key) return WHAT_TEXTS[i];
    throw new Error('no description of SQIsign record ' + key);
  }

  /**
   * A rejection vector. The message named for the verdict is the one the
   * modified input itself carries, so that [0] can only come from the
   * signature being rejected and never from the message comparison.
   * @param {TestCase[]} vectors - where the vector goes
   * @param {string} what - its description
   * @param {uint8[]} publicKey - the public key
   * @param {uint8[]} input - the modified signed message
   */
  function Negative(vectors, what, publicKey, input) {
    const prm = ParameterSetByPublicKeyLength(publicKey.length);
    /** @type {uint8[]} */
    const rejected = [0];
    const vector = new TestCase(input, rejected, what, KAT_URI);
    vector.inverse = true;
    vector.publicKey = publicKey;
    vector.message = input.slice(Math.min(prm.signatureBytes, input.length));
    vectors.push(vector);
  }

  /**
   * @param {SqiKatRecord} r - a committed record
   * @returns {TestCase} the vector: its signed message opens to its message
   */
  function OpensVector(r) {
    const vector = new TestCase(Hex(r.sm), Hex(r.msg),
      r.level + ' ' + r.file + ' count ' + r.count + ' (' + What(r)
        + '): the published signed message opens and yields its message', KAT_URI);
    vector.inverse = true;
    vector.publicKey = Hex(r.pk);
    return vector;
  }

  /**
   * @param {string} level - the parameter set
   * @param {int32} count - the record's count
   * @returns {TestCase} the vector: the verdict on its signature is acceptance
   */
  function AcceptVector(level, count) {
    const r = Record(level, count);
    /** @type {uint8[]} */
    const accepted = [1];
    const vector = new TestCase(Hex(r.sm), accepted,
      level + ' ' + r.file + ' count ' + count + ': the verdict on the published signature is acceptance', KAT_URI);
    vector.inverse = true;
    vector.publicKey = Hex(r.pk);
    vector.message = Hex(r.msg);
    return vector;
  }

  /**
   * @returns {TestCase[]} the test vectors
   */
  function BuildVectors() {
    /** @type {TestCase[]} */
    const vectors = [];

    // Every committed record opens and yields its published message.
    for (let i = 0; i < KAT.length; ++i) vectors.push(OpensVector(KAT[i]));

    // The verdict form, once per level.
    vectors.push(AcceptVector('SQIsign-I', 7));
    vectors.push(AcceptVector('SQIsign-III', 4));
    vectors.push(AcceptVector('SQIsign-V', 2));

    // Rejections. Each takes a published signed message and changes one thing.
    // A SQIsign-I signature is E_aux (64 bytes), backtracking, the response
    // length, four 16 byte matrix entries, the 16 byte challenge and two hints.
    const r1 = Record('SQIsign-I', 1);
    const pk1 = Hex(r1.pk);
    const sm1 = Hex(r1.sm);

    Negative(vectors, 'SQIsign-I count 1: a modified message must not verify', pk1, FlipBit(sm1, sm1.length - 1, 0x01));
    Negative(vectors, 'SQIsign-I count 1: a modified auxiliary curve must not verify', pk1, FlipBit(sm1, 0, 0x01));
    Negative(vectors, 'SQIsign-I count 1: a modified backtracking length must not verify', pk1, FlipBit(sm1, 64, 0x01));
    Negative(vectors, 'SQIsign-I count 1: a modified response isogeny length must not verify', pk1, FlipBit(sm1, 65, 0x01));
    Negative(vectors, 'SQIsign-I count 1: a modified basis-change matrix must not verify', pk1, FlipBit(sm1, 66 + 16, 0x04));
    Negative(vectors, 'SQIsign-I count 1: a modified challenge must not verify', pk1, FlipBit(sm1, 66 + 64, 0x01));
    Negative(vectors, 'SQIsign-I count 1: a modified auxiliary basis hint must not verify', pk1, FlipBit(sm1, 146, 0x02));
    Negative(vectors, 'SQIsign-I count 1: a modified challenge basis hint must not verify', pk1, FlipBit(sm1, 147, 0x02));
    Negative(vectors, 'SQIsign-I count 1: the signature must not verify under count 7\'s public key',
      Hex(Record('SQIsign-I', 7).pk), sm1);
    Negative(vectors, 'SQIsign-I count 1: the signature must not verify under a modified public curve',
      FlipBit(pk1, 0, 0x01), sm1);
    Negative(vectors, 'SQIsign-I count 1: the signature must not verify under a modified public key hint',
      FlipBit(pk1, 64, 0x02), sm1);
    Negative(vectors, 'SQIsign-I count 1: a SQIsign-I signature must not verify under a SQIsign-III public key',
      Hex(Record('SQIsign-III', 2).pk), sm1);

    const r3 = Record('SQIsign-III', 8);
    Negative(vectors, 'SQIsign-III count 8: a modified basis-change matrix must not verify',
      Hex(r3.pk), FlipBit(Hex(r3.sm), 96 + 2, 0x01));
    const r5 = Record('SQIsign-V', 13);
    Negative(vectors, 'SQIsign-V count 13: a modified message must not verify',
      Hex(r5.pk), FlipBit(Hex(r5.sm), 292, 0x80));

    return vectors;
  }

  /** @type {TestCase[]} */
  const VECTORS = BuildVectors();

  // ===== ALGORITHM =====

  class SQIsignAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = 'SQIsign';
      this.description = 'Short Quaternion and Isogeny Signature, the NIST additional-signatures round 2 '
        + 'candidate with the smallest combined public key and signature of any post-quantum scheme: 65 and '
        + '148 bytes at the first level. A signature is an isogeny between supersingular curves that only '
        + 'the holder of the public curve\'s endomorphism ring can find; verification rebuilds it as a '
        + 'chain of 4-isogenies and a two-dimensional isogeny in the theta model. This file verifies '
        + 'signatures for all three levels and does not produce them.';
      this.inventor = 'Marius A. Aardal, Gora Adj, Diego F. Aranha, Andrea Basso, Isaac Andrés Canales Martínez, '
        + 'Jorge Chávez-Saab, Maria Corte-Real Santos, Pierrick Dartois, Luca De Feo, Max Duparc, '
        + 'Jonathan Komada Eriksen, Tako Boris Fouotsa, Décio Luiz Gazzoni Filho, Basil Hess, David Kohel, '
        + 'Antonin Leroux, Patrick Longa, Luciano Maino, Michael Meyer, Kohei Nakagawa, Hiroshi Onuki, '
        + 'Lorenz Panny, Sikhar Patranabis, Christophe Petit, Giacomo Pope, Krijn Reijnders, Damien Robert, '
        + 'Francisco Rodríguez-Henríquez, Sina Schaeffler, Benjamin Wesolowski';
      this.year = 2020;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Post-Quantum Digital Signature';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      /** @type {string[]} */
      this.parameterSets = [];
      for (let i = 0; i < PARAMETER_SET_LIST.length; ++i) this.parameterSets.push(PARAMETER_SET_LIST[i].name);

      // A verifier holds the public key, and its length names the level.
      /** @type {KeySize[]} */
      const keySizes = [];
      for (let i = 0; i < PARAMETER_SET_LIST.length; ++i) {
        const size = PARAMETER_SET_LIST[i].publicKeyBytes;
        keySizes.push(new KeySize(size, size, 0));
      }
      this.SupportedKeySizes = keySizes;

      this.documentation = [
        new LinkItem('SQIsign round 2 specification', 'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/sqisign-spec-round2-web.pdf'),
        new LinkItem('SQIsign project site', 'https://sqisign.org/'),
        new LinkItem('NIST PQC additional digital signature schemes, round 2', 'https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures'),
        new LinkItem('SQIsign: compact post-quantum signatures from quaternions and isogenies (2020)', 'https://eprint.iacr.org/2020/1240'),
        new LinkItem('SQIsign2D-West: the two-dimensional verification (2024)', 'https://eprint.iacr.org/2024/760')
      ];

      this.references = [
        new LinkItem('Round 2 submission package and Known Answer Tests', KAT_URI),
        new LinkItem('SQIsign reference implementation', 'https://github.com/SQISign/the-sqisign'),
        new LinkItem('Optimized one-dimensional SQIsign verification (the square root used here)', 'https://eprint.iacr.org/2024/1563')
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          'Signing is not implemented here',
          'This file verifies signatures and cannot produce them: CreateInstance(false) returns null. Signing needs '
            + 'ideal-to-isogeny translation in a quaternion algebra, which is not carried.',
          'Use the reference implementation to sign. This one checks the result.',
          'https://sqisign.org/'),
        new Vulnerability(
          'Under evaluation, not standardised',
          'SQIsign is a round 2 candidate of the NIST additional-signatures process and its verification changed '
            + 'completely between rounds, from a one-dimensional to a two-dimensional isogeny. Its security rests on '
            + 'the hardness of computing the endomorphism ring of a supersingular curve, which is younger than the '
            + 'assumptions behind the standardised schemes.',
          'Treat it as experimental. Round 1 signatures do not verify here.',
          'https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures'),
        new Vulnerability(
          'Verification here is not constant time',
          'The BigInt arithmetic and the early exits make the running time depend on the signature. Verification '
            + 'handles public data only.',
          'Treat this as a reference for the verification algorithm rather than a hardened implementation.',
          'https://sqisign.org/')
      ];

      this.tests = VECTORS;
    }

    /**
     * Only the verifying direction exists.
     * @param {boolean} [isInverse=false] - true for verification
     * @returns {SQIsignInstance|null} a verifying instance, or null for signing
     */
    CreateInstance(isInverse = false) {
      if (!isInverse) return null;
      return new SQIsignInstance(this);
    }
  }

  /**
   * SQIsign verification implementing the Feed/Result pattern: Feed the
   * signed message, Result returns the message it carries or throws.
   * @class
   * @extends {IAlgorithmInstance}
   */
  class SQIsignInstance extends IAlgorithmInstance {
    /**
     * @param {SQIsignAlgorithm} algorithm - parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      this.isInverse = true;
      this.inputBuffer = [];

      // Declared here so that the test engine, which only assigns properties
      // that already exist on the instance, can set any of them from a vector.
      /** @type {SqiParams} */
      this._parameterSet = ParameterSetEntry('SQIsign-I');
      /** @type {uint8[]|null} */
      this._publicKey = null;
      /** @type {uint8[]|null} */
      this._message = null;
      /** @type {uint8[]|null} */
      this._keyData = null;
    }

    /**
     * @param {string} label - a set name, level or KAT label
     */
    set parameterSet(label) {
      const found = FindParameterSet(label);
      if (!found) throw new Error('Unknown SQIsign parameter set: ' + label);
      this._parameterSet = found;
    }

    /**
     * @returns {string} the name of the level in use
     */
    get parameterSet() {
      return this._parameterSet.name;
    }

    /**
     * The public key; its length selects the level.
     * @param {uint8[]} keyBytes - the key, or null
     */
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }
      const found = ParameterSetByPublicKeyLength(keyBytes.length);
      if (!found) throw new Error('A SQIsign public key is 65, 97 or 129 bytes, got ' + keyBytes.length);
      this._parameterSet = found;
      /** @type {uint8[]} */
      const copy = [];
      for (let i = 0; i < keyBytes.length; ++i) copy.push(keyBytes[i]);
      this._publicKey = copy;
    }

    /**
     * @returns {uint8[]|null} a copy of the public key
     */
    get publicKey() {
      return this._publicKey ? this._publicKey.slice() : null;
    }

    /**
     * A message to compare the verified one against. Setting it makes Result
     * report a verdict as [1] or [0] instead of returning the message.
     * @param {uint8[]} messageBytes - the message, or null
     */
    set message(messageBytes) {
      if (!messageBytes) {
        this._message = null;
        return;
      }
      /** @type {uint8[]} */
      const copy = [];
      for (let i = 0; i < messageBytes.length; ++i) copy.push(messageBytes[i]);
      this._message = copy;
    }

    /**
     * @returns {uint8[]|null} a copy of the message
     */
    get message() {
      return this._message ? this._message.slice() : null;
    }

    /**
     * The generic key entry point: the public key.
     * @param {uint8[]} keyData - the key, or null
     */
    set key(keyData) {
      this._keyData = keyData;
      if (keyData === null || keyData === undefined) {
        this._publicKey = null;
        return;
      }
      this.publicKey = keyData;
    }

    /**
     * @returns {uint8[]|null} the key as it was set
     */
    get key() {
      return this._keyData;
    }

    /**
     * Verify the fed signed message.
     * @returns {uint8[]} the message, or the verdict when a message was set
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];

      if (!this._publicKey) throw new Error('SQIsign verification needs a public key');

      const outcome = SignOpen(input, this._publicKey);

      if (this._message)
        return [(outcome.accepted && OpCodes.SecureCompare(outcome.message, this._message)) ? 1 : 0];

      if (!outcome.accepted) throw new Error('SQIsign signature rejected: ' + outcome.reason);
      return outcome.message;
    }

    /**
     * Verify a signed message against a public key.
     * @param {uint8[]} signedMessage - signature || message
     * @param {uint8[]} [publicKey] - the key, defaulting to the configured one
     * @returns {SqiOpenResult} { accepted, message, reason }
     */
    Verify(signedMessage, publicKey) {
      const key = publicKey ? publicKey : this._publicKey;
      if (!key) throw new Error('SQIsign verification needs a public key');
      return SignOpen(signedMessage, key);
    }

    /** Wipe the data held by this instance. */
    ClearData() {
      if (this._message) OpCodes.ClearArray(this._message);
      this._publicKey = null;
      this._message = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SQIsignAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SQIsignAlgorithm, SQIsignInstance, PARAMETER_SET_LIST, SignOpen };
}));
