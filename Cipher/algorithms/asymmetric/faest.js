/*
 * FAEST - a signature from the VOLE-in-the-head proof of an AES key
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The public key is a pair (x, y) with y = AES_k(x); the secret key is k. A
 * signature is a non-interactive zero-knowledge proof that the signer knows a
 * k mapping x to y, bound to the message by Fiat-Shamir. Nothing in it is
 * number-theoretic: the security rests on AES and on the hash, SHAKE.
 *
 * The proof is VOLE-in-the-head. The signer commits to a GGM tree of seeds per
 * repetition, expands the leaves into vector oblivious linear evaluations and
 * uses them to commit to the extended witness - the key schedule and the
 * S-box inputs and outputs of the encryption - bit by bit. The AES circuit is
 * then checked as a set of degree-two constraints over GF(2^lambda), folded by
 * a universal hash into three field elements. The challenge opens every leaf
 * but one per tree, which fixes the verifier's secret evaluation point Delta,
 * and the verifier checks the folded constraints at Delta. FAEST-EM swaps the
 * roles: the secret is the plaintext of a Rijndael encryption under a public
 * key, in Even-Mansour style, which removes the key schedule from the proof.
 *
 * This file implements the second-round submission to the NIST call for
 * additional post-quantum signatures, all twelve parameter sets: FAEST and
 * FAEST-EM at the 128, 192 and 256 bit levels, each small (s) or fast (f).
 * Key generation, signing and verification are all here, and the signed
 * message layout is the one crypto_sign of the submission writes, the message
 * followed by the signature.
 *
 * The arithmetic follows the submission's reference implementation, which is
 * published under the MIT licence by the FAEST team; the structure of the
 * constraint system below is a translation of its faest_aes.c, bavc.c, vole.c
 * and universal_hashing.c into this collection's style. It is checked
 * against the submission's own Known Answer Tests; see the test vectors.
 *
 * References:
 *   FAEST specification v2.0, NIST additional signatures round 2 (faest.info)
 *   Baum, Braun, Delpech de Saint Guilhem, Kloo, Orsini, Roy, Scholl -
 *     Publicly Verifiable Zero-Knowledge and Post-Quantum Signatures From
 *     VOLE-in-the-Head, CRYPTO 2023
 *   FIPS 197 (AES) and FIPS 202 (SHAKE)
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  const XOR = OpCodes.Xor32;
  const AND = OpCodes.And32;
  const OR = OpCodes.Or32;
  const NOT = OpCodes.Not32;
  const SHL = OpCodes.Shl32;
  const SHR = OpCodes.Shr32;

  /** Bit i of a byte string, least significant bit of each byte first. */
  function GetBit(bytes, i) {
    return AND(SHR(bytes[SHR(i, 3)], AND(i, 7)), 1);
  }

  function SetBit(bytes, i, bit) {
    const index = SHR(i, 3);
    const mask = SHL(1, AND(i, 7));
    bytes[index] = bit ? OR(bytes[index], mask) : AND(bytes[index], AND(NOT(mask), 0xFF));
  }

  function XorBytes(a, aOff, b, bOff, out, outOff, len) {
    for (let i = 0; i < len; ++i) out[outOff + i] = XOR(a[aOff + i], b[bOff + i]);
  }

  // ===== KECCAK / SHAKE =====
  //
  // The state is 25 lanes of 64 bits held as 50 words, the low half of lane i
  // at word 2i. That is also the byte order of the sponge, so absorbing and
  // squeezing move whole little-endian words.

  const KECCAK_RC = [
    0x00000001, 0x00000000, 0x00008082, 0x00000000, 0x0000808A, 0x80000000,
    0x80008000, 0x80000000, 0x0000808B, 0x00000000, 0x80000001, 0x00000000,
    0x80008081, 0x80000000, 0x00008009, 0x80000000, 0x0000008A, 0x00000000,
    0x00000088, 0x00000000, 0x80008009, 0x00000000, 0x8000000A, 0x00000000,
    0x8000808B, 0x00000000, 0x0000008B, 0x80000000, 0x00008089, 0x80000000,
    0x00008003, 0x80000000, 0x00008002, 0x80000000, 0x00000080, 0x80000000,
    0x0000800A, 0x00000000, 0x8000000A, 0x80000000, 0x80008081, 0x80000000,
    0x00008080, 0x80000000, 0x80000001, 0x00000000, 0x80008008, 0x80000000
  ];

  const KECCAK_ROTATION = [
     0,  1, 62, 28, 27, 36, 44,  6, 55, 20,  3, 10, 43,
    25, 39, 41, 45, 15, 21,  8, 18,  2, 61, 56, 14
  ];

  // Where rho-pi sends lane x + 5y: to lane y + 5((2x + 3y) mod 5).
  const KECCAK_TARGET = (function () {
    const t = new Array(25);
    for (let x = 0; x < 5; ++x)
      for (let y = 0; y < 5; ++y)
        t[x + 5 * y] = y + 5 * ((2 * x + 3 * y) % 5);
    return t;
  })();

  const keccakB = new Uint32Array(50);
  const keccakC = new Uint32Array(10);

  function KeccakPermute(s) {
    const B = keccakB, C = keccakC;
    for (let round = 0; round < 24; ++round) {
      for (let x = 0; x < 5; ++x) {
        C[2 * x] = XOR(XOR(XOR(s[2 * x], s[2 * x + 10]), XOR(s[2 * x + 20], s[2 * x + 30])), s[2 * x + 40]);
        C[2 * x + 1] = XOR(XOR(XOR(s[2 * x + 1], s[2 * x + 11]), XOR(s[2 * x + 21], s[2 * x + 31])), s[2 * x + 41]);
      }
      for (let x = 0; x < 5; ++x) {
        const n = 2 * ((x + 1) % 5), p = 2 * ((x + 4) % 5);
        const dLo = XOR(C[p], OR(SHL(C[n], 1), SHR(C[n + 1], 31)));
        const dHi = XOR(C[p + 1], OR(SHL(C[n + 1], 1), SHR(C[n], 31)));
        for (let y = 0; y < 25; y += 5) {
          s[2 * (x + y)] = XOR(s[2 * (x + y)], dLo);
          s[2 * (x + y) + 1] = XOR(s[2 * (x + y) + 1], dHi);
        }
      }
      for (let i = 0; i < 25; ++i) {
        const r = KECCAK_ROTATION[i];
        const lo = s[2 * i], hi = s[2 * i + 1];
        const t = 2 * KECCAK_TARGET[i];
        if (r === 0) {
          B[t] = lo; B[t + 1] = hi;
        } else if (r < 32) {
          B[t] = OR(SHL(lo, r), SHR(hi, 32 - r));
          B[t + 1] = OR(SHL(hi, r), SHR(lo, 32 - r));
        } else if (r === 32) {
          B[t] = hi; B[t + 1] = lo;
        } else {
          const q = r - 32;
          B[t] = OR(SHL(hi, q), SHR(lo, 32 - q));
          B[t + 1] = OR(SHL(lo, q), SHR(hi, 32 - q));
        }
      }
      for (let y = 0; y < 25; y += 5) {
        for (let x = 0; x < 5; ++x) {
          const i = 2 * (x + y), n = 2 * ((x + 1) % 5 + y), a = 2 * ((x + 2) % 5 + y);
          s[i] = XOR(B[i], AND(NOT(B[n]), B[a]));
          s[i + 1] = XOR(B[i + 1], AND(NOT(B[n + 1]), B[a + 1]));
        }
      }
      s[0] = XOR(s[0], KECCAK_RC[2 * round]);
      s[1] = XOR(s[1], KECCAK_RC[2 * round + 1]);
    }
  }

  /**
   * An incremental SHAKE sponge: absorb, finalise once, then squeeze on demand.
   * @param {number} rate - 168 for SHAKE128, 136 for SHAKE256
   */
  function Shake(rate) {
    this.rate = rate;
    this.state = new Uint32Array(50);
    this.buf = new Uint8Array(rate);
    this.pos = 0;
    this.squeezing = false;
  }

  Shake.prototype._absorbBlock = function () {
    const s = this.state, b = this.buf;
    for (let i = 0; i < this.rate; i += 4)
      s[SHR(i, 2)] = XOR(s[SHR(i, 2)], OpCodes.Pack32LE(b[i], b[i + 1], b[i + 2], b[i + 3]));
    KeccakPermute(s);
  };

  Shake.prototype._extract = function () {
    const s = this.state, b = this.buf;
    for (let i = 0; i < this.rate; i += 4) {
      const w = s[SHR(i, 2)];
      b[i] = AND(w, 0xFF);
      b[i + 1] = AND(SHR(w, 8), 0xFF);
      b[i + 2] = AND(SHR(w, 16), 0xFF);
      b[i + 3] = SHR(w, 24);
    }
  };

  Shake.prototype.update = function (data, off, len) {
    if (off === undefined) { off = 0; len = data.length; }
    const b = this.buf, rate = this.rate;
    for (let i = 0; i < len; ++i) {
      b[this.pos++] = data[off + i];
      if (this.pos === rate) {
        this._absorbBlock();
        this.pos = 0;
      }
    }
    return this;
  };

  Shake.prototype.updateByte = function (value) {
    this.buf[this.pos++] = value;
    if (this.pos === this.rate) {
      this._absorbBlock();
      this.pos = 0;
    }
    return this;
  };

  Shake.prototype.finalize = function () {
    const b = this.buf;
    b.fill(0, this.pos);
    b[this.pos] = XOR(b[this.pos], 0x1F);
    b[this.rate - 1] = XOR(b[this.rate - 1], 0x80);
    this._absorbBlock();
    this._extract();
    this.pos = 0;
    this.squeezing = true;
    return this;
  };

  Shake.prototype.squeeze = function (len) {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; ++i) {
      if (this.pos === this.rate) {
        KeccakPermute(this.state);
        this._extract();
        this.pos = 0;
      }
      out[i] = this.buf[this.pos++];
    }
    return out;
  };

  Shake.prototype.clone = function () {
    const copy = new Shake(this.rate);
    copy.state.set(this.state);
    copy.buf.set(this.buf);
    copy.pos = this.pos;
    copy.squeezing = this.squeezing;
    return copy;
  };

  /** The hash every FAEST oracle is built on: SHAKE128 at lambda 128, SHAKE256 above. */
  function NewHash(lambda) {
    return new Shake(lambda === 128 ? 168 : 136);
  }

  // ===== AES AND RIJNDAEL =====
  //
  // One table-driven implementation serves every width the scheme needs: AES
  // with 128, 192 and 256 bit keys for the pseudorandom generator, the one-way
  // function and the NIST generator, and Rijndael with 192 and 256 bit blocks
  // for FAEST-EM. A column is a little-endian word, row 0 in the low byte.

  const SBOX = new Uint8Array(256);
  const T0 = new Uint32Array(256);
  const T1 = new Uint32Array(256);
  const T2 = new Uint32Array(256);
  const T3 = new Uint32Array(256);

  /** Multiplication in GF(2^8) modulo x^8 + x^4 + x^3 + x + 1. */
  function Gf8Mul(a, b) {
    let result = 0;
    for (let i = 0; i < 8; ++i) {
      if (AND(b, 1)) result = XOR(result, a);
      const carry = AND(a, 0x80);
      a = AND(SHL(a, 1), 0xFF);
      if (carry) a = XOR(a, 0x1B);
      b = SHR(b, 1);
    }
    return result;
  }

  /** Inverse in GF(2^8), with 0 mapped to 0: a^254. */
  function Gf8Inv(a) {
    let result = 1, base = a, e = 254;
    while (e > 0) {
      if (AND(e, 1)) result = Gf8Mul(result, base);
      base = Gf8Mul(base, base);
      e = SHR(e, 1);
    }
    return a === 0 ? 0 : result;
  }

  (function BuildAesTables() {
    for (let x = 0; x < 256; ++x) {
      const inv = Gf8Inv(x);
      let s = inv;
      for (let r = 1; r < 5; ++r)
        s = XOR(s, AND(OR(SHL(inv, r), SHR(inv, 8 - r)), 0xFF));
      SBOX[x] = XOR(s, 0x63);
    }
    for (let x = 0; x < 256; ++x) {
      const s = SBOX[x];
      const t = OpCodes.Pack32LE(Gf8Mul(s, 2), s, s, Gf8Mul(s, 3));
      T0[x] = t;
      T1[x] = OpCodes.RotL32(t, 8);
      T2[x] = OpCodes.RotL32(t, 16);
      T3[x] = OpCodes.RotL32(t, 24);
    }
  })();

  const RCON = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a,
    0x2f, 0x5e, 0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91
  ];

  function SubWord(w) {
    return OpCodes.Pack32LE(SBOX[AND(w, 0xFF)], SBOX[AND(SHR(w, 8), 0xFF)],
      SBOX[AND(SHR(w, 16), 0xFF)], SBOX[SHR(w, 24)]);
  }

  /**
   * The Rijndael key schedule for any key and block width, as FIPS 197 extends
   * it: nk key words, nb block words, rounds + 1 round keys of nb words each.
   * @returns {Uint32Array} the round-key words
   */
  function ExpandKey(key, keyOff, nk, nb, rounds) {
    const total = nb * (rounds + 1);
    const w = new Uint32Array(total);
    for (let i = 0; i < nk; ++i)
      w[i] = OpCodes.Pack32LE(key[keyOff + 4 * i], key[keyOff + 4 * i + 1], key[keyOff + 4 * i + 2], key[keyOff + 4 * i + 3]);
    for (let i = nk; i < total; ++i) {
      let t = w[i - 1];
      if (i % nk === 0)
        t = XOR(SubWord(OpCodes.RotR32(t, 8)), RCON[i / nk - 1]);
      else if (nk > 6 && i % nk === 4)
        t = SubWord(t);
      w[i] = XOR(w[i - nk], t);
    }
    return w;
  }

  const ROUNDS_FOR_KEY = { 4: 10, 6: 12, 8: 14 };

  /** ShiftRows offsets: 1, 2, 3 for four and six word blocks, 1, 3, 4 for eight. */
  function ShiftOffsets(nb) {
    return nb === 8 ? [0, 1, 3, 4] : [0, 1, 2, 3];
  }

  const aesState = new Uint32Array(8);
  const aesNext = new Uint32Array(8);

  /**
   * Encrypt one block of nb words in place of out.
   */
  function RijndaelEncrypt(rk, nb, rounds, input, inOff, out, outOff) {
    const s = aesState, t = aesNext;
    const sh = ShiftOffsets(nb);
    const s1 = sh[1], s2 = sh[2], s3 = sh[3];
    for (let c = 0; c < nb; ++c)
      s[c] = XOR(OpCodes.Pack32LE(input[inOff + 4 * c], input[inOff + 4 * c + 1], input[inOff + 4 * c + 2], input[inOff + 4 * c + 3]), rk[c]);
    for (let round = 1; round < rounds; ++round) {
      const base = round * nb;
      for (let c = 0; c < nb; ++c) {
        t[c] = XOR(XOR(XOR(T0[AND(s[c], 0xFF)], T1[AND(SHR(s[(c + s1) % nb], 8), 0xFF)]),
          XOR(T2[AND(SHR(s[(c + s2) % nb], 16), 0xFF)], T3[SHR(s[(c + s3) % nb], 24)])), rk[base + c]);
      }
      for (let c = 0; c < nb; ++c) s[c] = t[c];
    }
    const base = rounds * nb;
    for (let c = 0; c < nb; ++c) {
      const w = XOR(OpCodes.Pack32LE(SBOX[AND(s[c], 0xFF)], SBOX[AND(SHR(s[(c + s1) % nb], 8), 0xFF)],
        SBOX[AND(SHR(s[(c + s2) % nb], 16), 0xFF)], SBOX[SHR(s[(c + s3) % nb], 24)]), rk[base + c]);
      out[outOff + 4 * c] = AND(w, 0xFF);
      out[outOff + 4 * c + 1] = AND(SHR(w, 8), 0xFF);
      out[outOff + 4 * c + 2] = AND(SHR(w, 16), 0xFF);
      out[outOff + 4 * c + 3] = SHR(w, 24);
    }
  }

  /** AES with a lambda-bit key on one 16-byte block. */
  function AesEncryptBlock(key, keyOff, keyBits, input, inOff, out, outOff) {
    const nk = keyBits / 32;
    const rounds = ROUNDS_FOR_KEY[nk];
    RijndaelEncrypt(ExpandKey(key, keyOff, nk, 4, rounds), 4, rounds, input, inOff, out, outOff);
  }

  /**
   * The FAEST pseudorandom generator: AES-lambda in counter mode. The tweak is
   * added to the top 32-bit little-endian word of the IV, and the counter is the
   * bottom 32-bit little-endian word, incremented modulo 2^32.
   * @returns {Uint8Array} outLen pseudorandom bytes
   */
  function Prg(key, keyOff, iv, tweak, outLen, lambda, out, outOff) {
    if (!out) { out = new Uint8Array(outLen); outOff = 0; }
    const nk = lambda / 32;
    const rounds = ROUNDS_FOR_KEY[nk];
    const rk = ExpandKey(key, keyOff, nk, 4, rounds);
    const ctr = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) ctr[i] = iv[i];
    let upper = OpCodes.Pack32LE(ctr[12], ctr[13], ctr[14], ctr[15]);
    upper = OpCodes.ToUint32(upper + tweak);
    ctr[12] = AND(upper, 0xFF); ctr[13] = AND(SHR(upper, 8), 0xFF);
    ctr[14] = AND(SHR(upper, 16), 0xFF); ctr[15] = SHR(upper, 24);
    let counter = OpCodes.Pack32LE(ctr[0], ctr[1], ctr[2], ctr[3]);
    const block = new Uint8Array(16);
    let done = 0;
    while (done < outLen) {
      RijndaelEncrypt(rk, 4, rounds, ctr, 0, block, 0);
      const take = Math.min(16, outLen - done);
      for (let i = 0; i < take; ++i) out[outOff + done + i] = block[i];
      done += take;
      counter = OpCodes.ToUint32(counter + 1);
      ctr[0] = AND(counter, 0xFF); ctr[1] = AND(SHR(counter, 8), 0xFF);
      ctr[2] = AND(SHR(counter, 16), 0xFF); ctr[3] = SHR(counter, 24);
    }
    return out;
  }

  // ===== BINARY FIELDS =====
  //
  // GF(2^n) for n a multiple of 32, an element a Uint32Array of n/32 words with
  // the coefficient of X^i at bit i. The reduction polynomials are the ones the
  // specification fixes; only their low word is non-zero. Multiplication runs a
  // four-bit window over the right operand, which may be shorter than the field
  // - that is how the 64-bit universal-hash keys and the leaf-hash inputs are
  // multiplied into larger fields.

  function MakeField(bits, modulus) {
    const nw = bits / 32;
    const reduce = new Uint32Array(16);
    for (let c = 0; c < 16; ++c) {
      let r = 0;
      for (let b = 0; b < 4; ++b)
        if (AND(SHR(c, b), 1)) r = XOR(r, SHL(modulus, b));
      reduce[c] = r;
    }
    const table = new Uint32Array(16 * nw);
    const bytes = bits / 8;

    const F = {
      bits: bits,
      words: nw,
      bytes: bytes,
      zero: function () { return new Uint32Array(nw); },
      one: function () { const r = new Uint32Array(nw); r[0] = 1; return r; },
      fromBit: function (bit) { const r = new Uint32Array(nw); r[0] = AND(bit, 1); return r; },
      copy: function (a) { return new Uint32Array(a); },
      add: function (a, b) {
        const r = new Uint32Array(nw);
        for (let i = 0; i < nw; ++i) r[i] = XOR(a[i], b[i]);
        return r;
      },
      addInto: function (acc, a) {
        for (let i = 0; i < nw; ++i) acc[i] = XOR(acc[i], a[i]);
        return acc;
      },
      isZero: function (a) {
        let d = 0;
        for (let i = 0; i < nw; ++i) d = OR(d, a[i]);
        return d === 0;
      },
      equals: function (a, b) {
        let d = 0;
        for (let i = 0; i < nw; ++i) d = OR(d, XOR(a[i], b[i]));
        return d === 0;
      },
      dbl: function (a) {
        const r = new Uint32Array(nw);
        const top = SHR(a[nw - 1], 31);
        for (let i = nw - 1; i > 0; --i) r[i] = OR(SHL(a[i], 1), SHR(a[i - 1], 31));
        r[0] = SHL(a[0], 1);
        if (top) r[0] = XOR(r[0], modulus);
        return r;
      },
      mulBit: function (a, bit) {
        return AND(bit, 1) ? new Uint32Array(a) : new Uint32Array(nw);
      },
      mul: function (a, b) {
        const T = table;
        for (let i = 0; i < nw; ++i) { T[i] = 0; T[nw + i] = a[i]; }
        for (let j = 2; j < 16; j += 2) {
          // T[j] = X * T[j/2], T[j+1] = T[j] + a
          const src = (j / 2) * nw, dst = j * nw;
          const top = SHR(T[src + nw - 1], 31);
          for (let i = nw - 1; i > 0; --i) T[dst + i] = OR(SHL(T[src + i], 1), SHR(T[src + i - 1], 31));
          T[dst] = SHL(T[src], 1);
          if (top) T[dst] = XOR(T[dst], modulus);
          for (let i = 0; i < nw; ++i) T[dst + nw + i] = XOR(T[dst + i], a[i]);
        }
        const acc = new Uint32Array(nw);
        for (let wi = b.length - 1; wi >= 0; --wi) {
          const word = b[wi];
          for (let shift = 28; shift >= 0; shift -= 4) {
            const top = SHR(acc[nw - 1], 28);
            for (let i = nw - 1; i > 0; --i) acc[i] = OR(SHL(acc[i], 4), SHR(acc[i - 1], 28));
            acc[0] = XOR(SHL(acc[0], 4), reduce[top]);
            const nib = AND(SHR(word, shift), 15) * nw;
            if (nib !== 0)
              for (let i = 0; i < nw; ++i) acc[i] = XOR(acc[i], T[nib + i]);
          }
        }
        return acc;
      },
      load: function (src, off) {
        off = off || 0;
        const r = new Uint32Array(nw);
        for (let i = 0; i < nw; ++i)
          r[i] = OpCodes.Pack32LE(src[off + 4 * i], src[off + 4 * i + 1], src[off + 4 * i + 2], src[off + 4 * i + 3]);
        return r;
      },
      store: function (a, out, off) {
        if (!out) { out = new Uint8Array(bytes); off = 0; }
        for (let i = 0; i < nw; ++i) {
          const w = a[i];
          out[off + 4 * i] = AND(w, 0xFF);
          out[off + 4 * i + 1] = AND(SHR(w, 8), 0xFF);
          out[off + 4 * i + 2] = AND(SHR(w, 16), 0xFF);
          out[off + 4 * i + 3] = SHR(w, 24);
        }
        return out;
      }
    };

    /** sum_i xs[off + i] X^i over the field's width, by Horner's rule. */
    F.sumPoly = function (xs, off) {
      let r = F.copy(xs[off + bits - 1]);
      for (let i = 1; i < bits; ++i) r = F.addInto(F.dbl(r), xs[off + bits - 1 - i]);
      return r;
    };

    return F;
  }

  const GF64 = MakeField(64, 0x1B);
  const FIELDS = {
    128: MakeField(128, 0x87),
    192: MakeField(192, 0x87),
    256: MakeField(256, 0x425)
  };
  const WIDE_FIELDS = {
    128: MakeField(384, 0x100D),
    192: MakeField(576, 0x2019),
    256: MakeField(768, 0xA0011)
  };

  // The images of x^1 .. x^7 under the embedding of GF(2^8) (the AES field) into
  // GF(2^lambda) that the specification fixes, least significant byte first.
  const ALPHA_HEX = {
    128: [
      '0dce6055ace83fa11c9a97a955853d05', 'e1ae8834ca5977ec84bbbf9c43b7f44c',
      'a8463936ae02cfbfc6d2517d4f60ad35', '49982e3c4830836bfe22a2404636cb0d',
      'b4821b7b27492b25a5de881ae1109854', '22ff2125eff22bc7751f0c6c68a581d6',
      'bcf936e1948e7a7ae08fb74f1a315009'
    ],
    192: [
      '6397386fd5a3c8cceabd6e966cd765e662366b0e14c80b31', 'bb50f47c9e6133b2263f63d5191ff67b34db91d4263793da',
      '0d8a39f5132c6d9c198d320677e33282f64e753c700d3b0c', '5df72bbd7c7420dd2ed25800ab42557a5112bc949c51ec45',
      'f82bce8ae20cd5d884bede67b78c16084570a64b6a147dd6', 'bae1d5ee769c0f974820d75faef7eaf343ea6c695fbda629',
      '71850665c25d94f5d3e9063962fd1960b0c4870f54567cc7'
    ],
    256: [
      'e7fede0b42889796674e47a0388dd6be6ae1f1f8459822df3358c920cfa8c904',
      'c18922d52af55aa92f07422c8dc4a52beab0006c370d4ad1f14a5b9c694d4e06',
      '1d9d803f83b3da55570f3b531e83711710ac3fad3f5796fb8df61170dbe39561',
      'd5cd1bb0190501def6e3301a915827753fa09e48b678072a3888764fd64fc256',
      'b6308ae929f5c2988284f140d4dbc41b81a9497d9409be2ffc4f57716d0b2722',
      '0b6744deb9af759ebcaff166c666edac7e1f99f23f2501f0f329fad12f373dc0',
      '8be832b398b643ba0d6fb825d6c437524515e8f42a2b652fb87b6bd209ea3e13'
    ]
  };

  function MakeAlphas(lambda) {
    const F = FIELDS[lambda];
    return ALPHA_HEX[lambda].map(h => F.load(OpCodes.Hex8ToBytes(h), 0));
  }

  const ALPHAS = { 128: MakeAlphas(128), 192: MakeAlphas(192), 256: MakeAlphas(256) };

  /**
   * The byte-level helpers of the constraint system for one field: lifting a
   * byte, given as eight bits or as eight field elements, into GF(2^lambda),
   * with or without first squaring it in GF(2^8).
   */
  function MakeByteOps(lambda) {
    const F = FIELDS[lambda];
    const A = ALPHAS[lambda];

    function Combine(x, off) {
      let r = F.copy(x[off]);
      for (let i = 1; i < 8; ++i) r = F.addInto(r, F.mul(x[off + i], A[i - 1]));
      return r;
    }

    function CombineBits(x, off) {
      const r = F.fromBit(x[off]);
      for (let i = 1; i < 8; ++i) if (x[off + i]) F.addInto(r, A[i - 1]);
      return r;
    }

    // Squaring in GF(2^8) is linear over GF(2); these are the bit equations.
    function SquareBits(x, off) {
      const x0 = x[off], x1 = x[off + 1], x2 = x[off + 2], x3 = x[off + 3];
      const x4 = x[off + 4], x5 = x[off + 5], x6 = x[off + 6], x7 = x[off + 7];
      return [
        XOR(XOR(x0, x4), x6), XOR(XOR(x4, x6), x7), XOR(x1, x5), XOR(XOR(x4, x5), XOR(x6, x7)),
        XOR(XOR(x2, x4), x7), XOR(x5, x6), XOR(x3, x5), XOR(x6, x7)
      ];
    }

    function SquareTags(x, off) {
      const a = function (i) { return x[off + i]; };
      return [
        F.add(F.add(a(0), a(4)), a(6)), F.add(F.add(a(4), a(6)), a(7)), F.add(a(1), a(5)),
        F.add(F.add(a(4), a(5)), F.add(a(6), a(7))), F.add(F.add(a(2), a(4)), a(7)),
        F.add(a(5), a(6)), F.add(a(3), a(5)), F.add(a(6), a(7))
      ];
    }

    return {
      F: F,
      alpha: A,
      combine: Combine,
      combineBits: CombineBits,
      combineSq: function (x, off) { return Combine(SquareTags(x, off), 0); },
      combineBitsSq: function (x, off) { return CombineBits(SquareBits(x, off), 0); },
      squareBits: SquareBits,
      squareTags: SquareTags
    };
  }

  const BYTE_OPS = { 128: MakeByteOps(128), 192: MakeByteOps(192), 256: MakeByteOps(256) };

  // ===== PARAMETER SETS =====
  //
  // The second-round table. tau is the number of VOLE repetitions, w the
  // grinding width, T_open the budget of opened tree nodes, ell the witness
  // length in bits, R the rounds, Nwd the block width in words, Ske, Senc,
  // Lke and Lenc the S-box and witness counts of the key schedule and of the
  // encryption, C the number of constraints. Signature sizes are the
  // specification's; the derived values k, tau0, tau1 and L follow it.

  const PARAMETER_TABLE = [
    // name,           em,    lambda, tau, w,  T_open, ell,  R,  Nwd, Ske, Senc, Lke, Lenc, C,   sig
    ['FAEST-128s',     false, 128,    11,  7,  102,    1280, 10, 4,   40,  160,  448, 832,  321, 4506],
    ['FAEST-128f',     false, 128,    16,  8,  110,    1280, 10, 4,   40,  160,  448, 832,  321, 5924],
    ['FAEST-192s',     false, 192,    16,  12, 162,    2496, 12, 4,   32,  192,  448, 1024, 641, 11260],
    ['FAEST-192f',     false, 192,    24,  8,  163,    2496, 12, 4,   32,  192,  448, 1024, 641, 14948],
    ['FAEST-256s',     false, 256,    22,  6,  245,    3104, 14, 4,   52,  224,  672, 1216, 777, 20696],
    ['FAEST-256f',     false, 256,    32,  8,  246,    3104, 14, 4,   52,  224,  672, 1216, 777, 26548],
    ['FAEST-EM-128s',  true,  128,    11,  7,  103,    960,  10, 4,   0,   160,  128, 832,  241, 3906],
    ['FAEST-EM-128f',  true,  128,    16,  8,  112,    960,  10, 4,   0,   160,  128, 832,  241, 5060],
    ['FAEST-EM-192s',  true,  192,    16,  8,  162,    1728, 12, 6,   0,   288,  192, 1536, 433, 9340],
    ['FAEST-EM-192f',  true,  192,    24,  8,  176,    1728, 12, 6,   0,   288,  192, 1536, 433, 12380],
    ['FAEST-EM-256s',  true,  256,    22,  6,  218,    2688, 14, 8,   0,   448,  256, 2432, 673, 17984],
    ['FAEST-EM-256f',  true,  256,    32,  8,  234,    2688, 14, 8,   0,   448,  256, 2432, 673, 23476]
  ];

  const PARAMETER_SETS = {};
  for (const row of PARAMETER_TABLE) {
    const [name, em, lambda, tau, w, tOpen, ell, R, nwd, ske, senc, lke, lenc, c, sigSize] = row;
    const k = Math.floor((lambda - w) / tau) + 1;
    const tau1 = (lambda - w) % tau;
    const tau0 = tau - tau1;
    const lambdaBytes = lambda / 8;
    const owfInputSize = em ? lambdaBytes : 16;
    const owfOutputSize = em ? lambdaBytes : (lambda === 128 ? 16 : 32);
    PARAMETER_SETS[name] = {
      name: name, em: em, lambda: lambda, lambdaBytes: lambdaBytes, tau: tau, w: w, tOpen: tOpen,
      ell: ell, R: R, nwd: nwd, ske: ske, senc: senc, lke: lke, lenc: lenc, c: c, sigSize: sigSize,
      k: k, tau0: tau0, tau1: tau1,
      L: tau1 * Math.pow(2, k) + tau0 * Math.pow(2, k - 1),
      beta: em ? 1 : (lambda === 128 ? 1 : 2),
      owfInputSize: owfInputSize,
      owfOutputSize: owfOutputSize,
      pkSize: owfInputSize + owfOutputSize,
      skSize: owfInputSize + lambdaBytes,
      ellHatBytes: ell / 8 + 3 * lambdaBytes + 2,
      comSize: (em ? 2 : 3) * lambdaBytes
    };
  }

  // ===== THE RANDOM ORACLES =====
  //
  // Every oracle is the same SHAKE instance closed by a one-byte domain
  // separator: 0 for H0, 1 for H1, 8 + i for the four uses of H2, 3 for H3 and
  // 4 for H4.

  function HashOnce(lambda, parts, domain, outLen) {
    const h = NewHash(lambda);
    for (const p of parts) h.update(p, 0, p.length);
    h.updateByte(domain);
    h.finalize();
    return h.squeeze(outLen);
  }

  // ===== THE ONE-WAY FUNCTION =====

  /**
   * FAEST: y = AES_k(x), and for the 192 and 256 bit levels also AES_k(x xor 1)
   * so that the output is at least lambda bits. FAEST-EM: y = Rijndael_x(k) xor k,
   * the block as wide as the key.
   */
  function Owf(p, key, keyOff, input, inOff) {
    const out = new Uint8Array(p.owfOutputSize);
    const nk = p.lambda / 32;
    const rounds = ROUNDS_FOR_KEY[nk];
    if (p.em) {
      const rk = ExpandKey(input, inOff, nk, nk, rounds);
      RijndaelEncrypt(rk, nk, rounds, key, keyOff, out, 0);
      for (let i = 0; i < p.lambdaBytes; ++i) out[i] = XOR(out[i], key[keyOff + i]);
      return out;
    }
    const rk = ExpandKey(key, keyOff, nk, 4, rounds);
    RijndaelEncrypt(rk, 4, rounds, input, inOff, out, 0);
    if (p.beta === 2) {
      const second = new Uint8Array(16);
      for (let i = 0; i < 16; ++i) second[i] = input[inOff + i];
      second[0] = XOR(second[0], 1);
      RijndaelEncrypt(rk, 4, rounds, second, 0, out, 16);
    }
    return out;
  }

  // ===== THE BATCH ALL-BUT-ONE VECTOR COMMITMENT =====

  function MaxDepth(p, i) {
    return i < p.tau1 ? p.k : p.k - 1;
  }

  /** Which node of the one big GGM tree is leaf j of repetition i. */
  function PosInTree(p, i, j) {
    const half = Math.pow(2, p.k - 1);
    if (j < half) return p.L - 1 + p.tau * j + i;
    return p.L - 1 + p.tau * half + p.tau1 * (j % half) + i;
  }

  /** Expand a root seed into the 2L - 1 nodes of the GGM tree. */
  function GenerateTree(p, rootKey, iv) {
    const lb = p.lambdaBytes;
    const nodes = new Uint8Array((2 * p.L - 1) * lb);
    for (let i = 0; i < lb; ++i) nodes[i] = rootKey[i];
    for (let alpha = 0; alpha < p.L - 1; ++alpha)
      Prg(nodes, alpha * lb, iv, alpha, 2 * lb, p.lambda, nodes, (2 * alpha + 1) * lb);
    return nodes;
  }

  /**
   * One leaf's commitment. FAEST expands the leaf key into a seed and a
   * universal-hash input and commits with the hash; FAEST-EM keeps the key as
   * the seed and commits with the generator directly.
   */
  function LeafCommit(p, keys, keyOff, iv, tweak, uhash, sdOut, sdOff) {
    const lb = p.lambdaBytes;
    if (p.em) {
      for (let i = 0; i < lb; ++i) sdOut[sdOff + i] = keys[keyOff + i];
      return Prg(keys, keyOff, iv, tweak, 2 * lb, p.lambda);
    }
    const buffer = Prg(keys, keyOff, iv, tweak, 4 * lb, p.lambda);
    for (let i = 0; i < lb; ++i) sdOut[sdOff + i] = buffer[i];
    // com = u * x0 + x1 in GF(2^(3 lambda)), x0 the first lambda bits of the buffer
    const W = WIDE_FIELDS[p.lambda];
    const F = FIELDS[p.lambda];
    const product = W.mul(W.load(uhash, 0), F.load(buffer, 0));
    return W.store(W.addInto(product, W.load(buffer, lb)));
  }

  function BavcCommit(p, rootKey, iv) {
    const lb = p.lambdaBytes;
    const nodes = GenerateTree(p, rootKey, iv);
    const com = new Uint8Array(p.L * p.comSize);
    const sd = new Uint8Array(p.L * lb);
    let uhashCtx = null;
    if (!p.em) {
      uhashCtx = NewHash(p.lambda);
      uhashCtx.update(iv, 0, 16);
      uhashCtx.updateByte(0);
      uhashCtx.finalize();
    }
    const top = NewHash(p.lambda);
    let offset = 0;
    for (let i = 0; i < p.tau; ++i) {
      const uhash = uhashCtx ? uhashCtx.squeeze(3 * lb) : null;
      const h1 = NewHash(p.lambda);
      const n = Math.pow(2, MaxDepth(p, i));
      for (let j = 0; j < n; ++j, ++offset) {
        const alpha = PosInTree(p, i, j);
        const c = LeafCommit(p, nodes, alpha * lb, iv, i + p.L - 1, uhash, sd, offset * lb);
        com.set(c, offset * p.comSize);
        h1.update(c, 0, c.length);
      }
      h1.updateByte(1);
      h1.finalize();
      top.update(h1.squeeze(2 * lb), 0, 2 * lb);
    }
    top.updateByte(1);
    top.finalize();
    return { h: top.squeeze(2 * lb), nodes: nodes, com: com, sd: sd };
  }

  /**
   * Open every leaf but the one per repetition the challenge selects: the
   * commitment of each hidden leaf, then the co-path nodes that let the
   * verifier regrow the rest. Fails when the co-path exceeds T_open.
   * @returns {Uint8Array|null} decom_i, zero padded, or null
   */
  function BavcOpen(p, vc, iDelta) {
    const lb = p.lambdaBytes;
    const size = p.comSize * p.tau + p.tOpen * lb;
    const marked = new Uint8Array(2 * p.L - 1);
    let nh = 0;
    for (let i = 0; i < p.tau; ++i) {
      let alpha = PosInTree(p, i, iDelta[i]);
      marked[alpha] = 1;
      ++nh;
      while (alpha > 0 && marked[(alpha - 1 - (alpha - 1) % 2) / 2] === 0) {
        alpha = (alpha - 1 - (alpha - 1) % 2) / 2;
        marked[alpha] = 1;
        ++nh;
      }
    }
    if (nh - 2 * p.tau + 1 > p.tOpen) return null;

    const out = new Uint8Array(size);
    let pos = 0, comBase = 0;
    for (let i = 0; i < p.tau; ++i) {
      out.set(vc.com.subarray((comBase + iDelta[i]) * p.comSize, (comBase + iDelta[i] + 1) * p.comSize), pos);
      comBase += Math.pow(2, MaxDepth(p, i));
      pos += p.comSize;
    }
    for (let i = p.L - 2; i >= 0; --i) {
      const left = marked[2 * i + 1], right = marked[2 * i + 2];
      marked[i] = OR(left, right);
      if (XOR(left, right) === 1) {
        const alpha = 2 * i + 1 + left;
        out.set(vc.nodes.subarray(alpha * lb, (alpha + 1) * lb), pos);
        pos += lb;
      }
    }
    return out;
  }

  /**
   * Regrow every leaf but the hidden ones from decom_i and recompute the
   * commitment. Fails on a co-path of the wrong length or non-zero padding.
   * @returns {object|null} { h, s } with s the revealed seeds in leaf order
   */
  function BavcReconstruct(p, decom, decomOff, iDelta, iv) {
    const lb = p.lambdaBytes;
    const marked = new Uint8Array(2 * p.L - 1);
    const keys = new Uint8Array((2 * p.L - 1) * lb);
    let pos = decomOff + p.comSize * p.tau;
    const end = pos + p.tOpen * lb;
    for (let i = 0; i < p.tau; ++i) marked[PosInTree(p, i, iDelta[i])] = 1;
    for (let i = p.L - 2; i >= 0; --i) {
      const left = marked[2 * i + 1], right = marked[2 * i + 2];
      marked[i] = OR(left, right);
      if (XOR(left, right) === 1) {
        if (pos === end) return null;
        const alpha = 2 * i + 1 + left;
        for (let b = 0; b < lb; ++b) keys[alpha * lb + b] = decom[pos + b];
        pos += lb;
      }
    }
    for (; pos < end; ++pos) if (decom[pos] !== 0) return null;
    for (let i = 0; i < p.L - 1; ++i)
      if (!marked[i]) Prg(keys, i * lb, iv, i, 2 * lb, p.lambda, keys, (2 * i + 1) * lb);

    let uhashCtx = null;
    if (!p.em) {
      uhashCtx = NewHash(p.lambda);
      uhashCtx.update(iv, 0, 16);
      uhashCtx.updateByte(0);
      uhashCtx.finalize();
    }
    const s = new Uint8Array((p.L - p.tau) * lb);
    const top = NewHash(p.lambda);
    let offset = 0;
    for (let i = 0; i < p.tau; ++i) {
      const uhash = uhashCtx ? uhashCtx.squeeze(p.comSize) : null;
      const h1 = NewHash(p.lambda);
      const n = Math.pow(2, MaxDepth(p, i));
      for (let j = 0; j < n; ++j) {
        const alpha = PosInTree(p, i, j);
        if (marked[alpha]) {
          h1.update(decom, decomOff + i * p.comSize, p.comSize);
        } else {
          const c = LeafCommit(p, keys, alpha * lb, iv, i + p.L - 1, uhash, s, offset * lb);
          ++offset;
          h1.update(c, 0, c.length);
        }
      }
      h1.updateByte(1);
      h1.finalize();
      top.update(h1.squeeze(2 * lb), 0, 2 * lb);
    }
    top.updateByte(1);
    top.finalize();
    return { h: top.squeeze(2 * lb), s: s };
  }

  // ===== VOLE =====

  /**
   * ConvertToVole: expand the leaf seeds of one repetition and fold them
   * level by level into u and the depth rows of v. With sd0Bot the first seed
   * is unknown (the verifier's hidden leaf) and counts as zero.
   * @returns {object} { depth, u, v } with v an array of depth rows
   */
  function ConvertToVole(p, iv, sd, sdOff, sd0Bot, i, outLen) {
    const depth = MaxDepth(p, i);
    const n = Math.pow(2, depth);
    const lb = p.lambdaBytes;
    const tweak = OpCodes.ToUint32(XOR(i, 0x80000000));
    let r = new Array(n);
    r[0] = sd0Bot ? new Uint8Array(outLen) : Prg(sd, sdOff, iv, tweak, outLen, p.lambda);
    for (let j = 1; j < n; ++j) r[j] = Prg(sd, sdOff + lb * j, iv, tweak, outLen, p.lambda);
    const v = new Array(depth);
    for (let j = 0; j < depth; ++j) {
      const row = new Uint8Array(outLen);
      const half = n / Math.pow(2, j + 1);
      const next = new Array(half);
      for (let idx = 0; idx < half; ++idx) {
        const a = r[2 * idx], b = r[2 * idx + 1];
        const folded = new Uint8Array(outLen);
        for (let t = 0; t < outLen; ++t) {
          row[t] = XOR(row[t], b[t]);
          folded[t] = XOR(a[t], b[t]);
        }
        next[idx] = folded;
      }
      v[j] = row;
      r = next;
    }
    return { depth: depth, u: r[0], v: v };
  }

  function VoleCommit(p, rootKey, iv) {
    const lb = p.lambdaBytes;
    const len = p.ellHatBytes;
    const bavc = BavcCommit(p, rootKey, iv);
    const V = [];
    const c = new Uint8Array((p.tau - 1) * len);
    let u = null;
    let sdOff = 0;
    for (let i = 0; i < p.tau; ++i) {
      const cv = ConvertToVole(p, iv, bavc.sd, sdOff, false, i, len);
      for (const row of cv.v) V.push(row);
      if (i === 0) u = cv.u;
      else XorBytes(u, 0, cv.u, 0, c, (i - 1) * len, len);
      sdOff += lb * Math.pow(2, MaxDepth(p, i));
    }
    while (V.length < p.lambda) V.push(new Uint8Array(len));
    return { bavc: bavc, c: c, u: u, V: V };
  }

  /** DecodeAllChall_3: the hidden leaf of every repetition, read off the challenge bits. */
  function DecodeChallenge(p, chall) {
    const out = new Array(p.tau);
    let bit = 0;
    for (let i = 0; i < p.tau; ++i) {
      const depth = MaxDepth(p, i);
      let value = 0;
      for (let j = 0; j < depth; ++j) value += GetBit(chall, bit + j) * Math.pow(2, j);
      out[i] = value;
      bit += depth;
    }
    return out;
  }

  function VoleReconstruct(p, iv, chall3, decom, decomOff, c, cOff) {
    const lb = p.lambdaBytes;
    const len = p.ellHatBytes;
    const iDelta = DecodeChallenge(p, chall3);
    const rec = BavcReconstruct(p, decom, decomOff, iDelta, iv);
    if (!rec) return null;
    const Q = [];
    let sdOff = 0;
    for (let i = 0; i < p.tau; ++i) {
      const n = Math.pow(2, MaxDepth(p, i));
      const sd = new Uint8Array(n * lb);
      for (let j = 0; j < n; ++j) {
        if (j === iDelta[i]) continue;
        const src = j < iDelta[i] ? j : j - 1;
        const dst = XOR(j, iDelta[i]);
        for (let b = 0; b < lb; ++b) sd[dst * lb + b] = rec.s[sdOff + src * lb + b];
      }
      const cv = ConvertToVole(p, iv, sd, 0, true, i, len);
      for (let d = 0; d < cv.depth; ++d) {
        const row = cv.v[d];
        if (i > 0 && AND(SHR(iDelta[i], d), 1))
          XorBytes(row, 0, c, cOff + (i - 1) * len, row, 0, len);
        Q.push(row);
      }
      sdOff += lb * (n - 1);
    }
    while (Q.length < p.lambda) Q.push(new Uint8Array(len));
    return { h: rec.h, Q: Q };
  }

  // ===== UNIVERSAL HASHES =====

  /**
   * VOLEHash: compress an ell-hat bit row to lambda + 16 bits keyed by chall_1.
   * A polynomial hash in GF(2^lambda) and one in GF(2^64) over the first
   * ell + 2 lambda bits, combined linearly, masks the last lambda + 16 bits.
   */
  function VoleHash(p, chall1, x) {
    const lambda = p.lambda, lb = p.lambdaBytes, ell = p.ell;
    const F = FIELDS[lambda];
    const blocks = Math.floor((ell + 3 * lambda - 1) / lambda);
    const tail = (ell + lambda) % lambda === 0 ? lb : ((ell + lambda) % lambda) / 8;
    const tmp = new Uint8Array(lb);
    for (let i = 0; i < tail; ++i) tmp[i] = x[(blocks - 1) * lb + i];

    const s = F.load(chall1, 4 * lb);
    let h0 = F.load(tmp, 0);
    let running = F.copy(s);
    for (let i = 1; i < blocks; ++i) {
      F.addInto(h0, F.mul(running, F.load(x, (blocks - 1 - i) * lb)));
      running = F.mul(running, s);
    }

    const t = GF64.load(chall1, 5 * lb);
    let h1 = GF64.zero();
    let rt = GF64.one();
    let i = 0;
    for (; i < lb; i += 8) {
      GF64.addInto(h1, GF64.mul(rt, GF64.load(tmp, lb - i - 8)));
      rt = GF64.mul(rt, t);
    }
    for (; i < blocks * lb; i += 8) {
      GF64.addInto(h1, GF64.mul(rt, GF64.load(x, blocks * lb - i - 8)));
      rt = GF64.mul(rt, t);
    }

    const h2 = F.add(F.mul(F.load(chall1, 0), h0), F.mul(F.load(chall1, lb), h1));
    const h3 = F.add(F.mul(F.load(chall1, 2 * lb), h0), F.mul(F.load(chall1, 3 * lb), h1));
    const out = new Uint8Array(lb + 2);
    F.store(h2, out, 0);
    const h3Bytes = F.store(h3);
    out[lb] = h3Bytes[0];
    out[lb + 1] = h3Bytes[1];
    const x1 = (ell + 2 * lambda) / 8;
    for (let b = 0; b < lb + 2; ++b) out[b] = XOR(out[b], x[x1 + b]);
    return out;
  }

  /** ZKHash: fold the constraint values with keys r0, r1, s, t taken from chall_2. */
  function ZkHash(p, chall2, values, x1) {
    const lb = p.lambdaBytes;
    const F = FIELDS[p.lambda];
    const s = F.load(chall2, 2 * lb);
    const t = GF64.load(chall2, 3 * lb);
    let h0 = F.zero(), h1 = F.zero();
    for (let i = 0; i < values.length; ++i) {
      h0 = F.addInto(F.mul(h0, s), values[i]);
      h1 = F.addInto(F.mul(h1, t), values[i]);
    }
    const r = F.add(F.mul(F.load(chall2, 0), h0), F.mul(F.load(chall2, lb), h1));
    return F.store(F.addInto(r, x1));
  }

  // ===== THE EXTENDED WITNESS =====

  function InvNorm(x) {
    const inv = Gf8Inv(x);
    let x17 = inv;
    for (let i = 0; i < 4; ++i) x17 = Gf8Mul(x17, x17);
    x17 = Gf8Mul(x17, inv);
    return OR(OR(AND(x17, 1), SHL(AND(SHR(x17, 6), 1), 1)),
      OR(SHL(AND(SHR(x17, 7), 1), 2), SHL(AND(SHR(x17, 2), 1), 3)));
  }

  function MixColumnBytes(state, nb) {
    for (let c = 0; c < nb; ++c) {
      const a0 = state[4 * c], a1 = state[4 * c + 1], a2 = state[4 * c + 2], a3 = state[4 * c + 3];
      state[4 * c] = XOR(XOR(Gf8Mul(a0, 2), Gf8Mul(a1, 3)), XOR(a2, a3));
      state[4 * c + 1] = XOR(XOR(a0, Gf8Mul(a1, 2)), XOR(Gf8Mul(a2, 3), a3));
      state[4 * c + 2] = XOR(XOR(a0, a1), XOR(Gf8Mul(a2, 2), Gf8Mul(a3, 3)));
      state[4 * c + 3] = XOR(XOR(Gf8Mul(a0, 3), a1), XOR(a2, Gf8Mul(a3, 2)));
    }
  }

  function ShiftRowBytes(state, nb) {
    const sh = ShiftOffsets(nb);
    const old = state.slice();
    for (let c = 0; c < nb; ++c)
      for (let r = 1; r < 4; ++r) state[4 * c + r] = old[4 * ((c + sh[r]) % nb) + r];
  }

  function RoundKeyBytes(rk, round, nb) {
    const out = new Uint8Array(4 * nb);
    for (let c = 0; c < nb; ++c) {
      const w = rk[round * nb + c];
      out[4 * c] = AND(w, 0xFF); out[4 * c + 1] = AND(SHR(w, 8), 0xFF);
      out[4 * c + 2] = AND(SHR(w, 16), 0xFF); out[4 * c + 3] = SHR(w, 24);
    }
    return out;
  }

  /**
   * The witness the proof commits to: the key schedule words that pass
   * through an S-box (or, for FAEST-EM, the secret itself), then per round the
   * inverse norms of the odd rounds' S-box inputs and the even rounds' states.
   */
  function ExtendWitness(p, owfKey, owfInput) {
    const w = new Uint8Array(p.ell / 8);
    let pos = 0;
    const nk = p.lambda / 32;
    const nb = p.em ? nk : 4;
    let key = owfKey, input = owfInput;
    if (p.em) { key = owfInput; input = owfKey; }
    const rk = ExpandKey(key, 0, nk, nb, p.R);

    if (!p.em) {
      // the key itself, then every schedule word that went through SubWord
      const storeWord = function (word) {
        w[pos++] = AND(word, 0xFF); w[pos++] = AND(SHR(word, 8), 0xFF);
        w[pos++] = AND(SHR(word, 16), 0xFF); w[pos++] = SHR(word, 24);
      };
      for (let i = 0; i < nk; ++i) storeWord(rk[i]);
      let ik = nk;
      for (let j = 0; j < p.ske / 4; ++j) {
        storeWord(rk[ik]);
        ik += p.lambda === 192 ? 6 : 4;
      }
    } else {
      for (let i = 0; i < p.lambdaBytes; ++i) w[pos++] = input[i];
    }

    for (let b = 0; b < p.beta; ++b) {
      const state = new Uint8Array(4 * nb);
      for (let i = 0; i < 4 * nb; ++i) state[i] = input[i];
      if (b === 1) state[0] = XOR(state[0], 1);
      const k0 = RoundKeyBytes(rk, 0, nb);
      for (let i = 0; i < 4 * nb; ++i) state[i] = XOR(state[i], k0[i]);
      for (let round = 1; round < p.R; ++round) {
        if (round % 2 === 1) {
          for (let i = 0; i < 4 * nb; i += 2)
            w[pos++] = OR(SHL(InvNorm(state[i + 1]), 4), InvNorm(state[i]));
        }
        for (let i = 0; i < 4 * nb; ++i) state[i] = SBOX[state[i]];
        ShiftRowBytes(state, nb);
        if (round % 2 === 0)
          for (let i = 0; i < 4 * nb; ++i) w[pos++] = state[i];
        MixColumnBytes(state, nb);
        const kr = RoundKeyBytes(rk, round, nb);
        for (let i = 0; i < 4 * nb; ++i) state[i] = XOR(state[i], kr[i]);
      }
    }
    return w;
  }

  // ===== THE AES CONSTRAINT SYSTEM =====
  //
  // The prover carries every committed value as a polynomial in the verifier's
  // Delta, degree 0 being the tag from the VOLE, degree 1 the value, and after
  // one multiplication degree 2; the verifier carries the evaluation at Delta.
  // The functions come in prover and verifier pairs that mirror each other
  // line for line, so that the verifier's key is the prover's polynomial at
  // Delta whenever the witness is honest.

  const SBOX_AFFINE = [0x05, 0x09, 0xf9, 0x25, 0xf4, 0x01, 0xb5, 0x8f, 0x63];
  const SBOX_AFFINE_SQ = [0x11, 0x41, 0x07, 0x7d, 0x56, 0x01, 0xfc, 0xcf, 0xc2];

  function MakeConstraintSystem(p) {
    const B = BYTE_OPS[p.lambda];
    const F = B.F;
    const nst = p.nwd;
    const nstBits = 32 * nst;
    const nstBytes = 4 * nst;
    const lambda = p.lambda;
    const nk = lambda / 32;
    const R = p.R;

    function ByteBits(value) {
      const bits = new Uint8Array(8);
      for (let j = 0; j < 8; ++j) bits[j] = AND(SHR(value, j), 1);
      return bits;
    }

    const affineC = SBOX_AFFINE.map(v => B.combineBits(ByteBits(v), 0));
    const affineCSq = SBOX_AFFINE_SQ.map(v => B.combineBits(ByteBits(v), 0));
    const v1 = B.combineBits(ByteBits(1), 0);
    const v2 = B.combineBits(ByteBits(2), 0);
    const v3 = B.combineBits(ByteBits(3), 0);
    const mixV = [[v1, v2, v3], [F.mul(v1, v1), F.mul(v2, v2), F.mul(v3, v3)]];

    const beta4 = F.add(B.alpha[5], B.alpha[3]);
    const normBetas = (function () {
      const out = [];
      let bs = F.copy(beta4), bs1 = F.mul(beta4, beta4), bc = F.mul(F.mul(beta4, beta4), beta4);
      for (let i = 0; i < 4; ++i) {
        out.push([bs, bs1, bc]);
        bs = F.mul(bs, bs); bs1 = F.mul(bs1, bs1); bc = F.mul(bc, bc);
      }
      return out;
    })();

    // --- shared bit-level and byte-level moves ---

    function ShiftRowsIndex(r, c) {
      return (nst !== 8 || r <= 1) ? 4 * ((c + r) % nst) + r : 4 * ((c + r + 1) % nst) + r;
    }

    function InverseShiftRowsIndex(r, c) {
      return (nst !== 8 || r <= 1) ? 4 * ((c + nst - r) % nst) + r : 4 * ((c + nst - r - 1) % nst) + r;
    }

    function ShiftRows(arr) {
      const out = new Array(nstBytes);
      for (let r = 0; r < 4; ++r)
        for (let c = 0; c < nst; ++c) out[4 * c + r] = arr[ShiftRowsIndex(r, c)];
      return out;
    }

    function MixColumns(arr, sq) {
      const m = mixV[sq ? 1 : 0];
      const V1 = m[0], V2 = m[1], V3 = m[2];
      const out = new Array(nstBytes);
      for (let c = 0; c < nst; ++c) {
        const i0 = arr[4 * c], i1 = arr[4 * c + 1], i2 = arr[4 * c + 2], i3 = arr[4 * c + 3];
        out[4 * c] = F.add(F.add(F.mul(i0, V2), F.mul(i1, V3)), F.add(F.mul(i2, V1), F.mul(i3, V1)));
        out[4 * c + 1] = F.add(F.add(F.mul(i0, V1), F.mul(i1, V2)), F.add(F.mul(i2, V3), F.mul(i3, V1)));
        out[4 * c + 2] = F.add(F.add(F.mul(i0, V1), F.mul(i1, V1)), F.add(F.mul(i2, V2), F.mul(i3, V3)));
        out[4 * c + 3] = F.add(F.add(F.mul(i0, V3), F.mul(i1, V1)), F.add(F.mul(i2, V1), F.mul(i3, V2)));
      }
      return out;
    }

    function SboxAffine(inArr, sq) {
      const C = sq ? affineCSq : affineC;
      const t = sq ? 1 : 0;
      const out = new Array(nstBytes);
      for (let i = 0; i < nstBytes; ++i) {
        const acc = F.zero();
        for (let ci = 0; ci < 8; ++ci) F.addInto(acc, F.mul(C[ci], inArr[8 * i + (ci + t) % 8]));
        out[i] = acc;
      }
      return out;
    }

    function InverseShiftRowsBits(bits, tags) {
      const outBits = new Uint8Array(nstBits);
      const outTags = new Array(nstBits);
      for (let r = 0; r < 4; ++r)
        for (let c = 0; c < nst; ++c) {
          const i = InverseShiftRowsIndex(r, c);
          for (let b = 0; b < 8; ++b) {
            if (bits) outBits[8 * (4 * c + r) + b] = bits[8 * i + b];
            outTags[8 * (4 * c + r) + b] = tags[8 * i + b];
          }
        }
      return { bits: outBits, tags: outTags };
    }

    // y_i = x_{i-1} + x_{i-3} + x_{i-6} + c_i, with c = 0x05
    function InverseAffineByte(bits, bOff, tags, tOff, outBits, outTags, oOff, delta) {
      for (let i = 0; i < 8; ++i) {
        const c = (i === 0 || i === 2) ? 1 : 0;
        const a = (i + 7) % 8, b = (i + 5) % 8, d = (i + 2) % 8;
        if (bits) outBits[oOff + i] = XOR(XOR(XOR(bits[bOff + a], bits[bOff + b]), bits[bOff + d]), c);
        const tag = F.add(F.add(tags[tOff + a], tags[tOff + b]), tags[tOff + d]);
        if (delta && c) F.addInto(tag, delta);
        outTags[oOff + i] = tag;
      }
    }

    function InverseAffine(bits, tags, delta) {
      const outBits = bits ? new Uint8Array(nstBits) : null;
      const outTags = new Array(nstBits);
      for (let i = 0; i < nstBytes; ++i)
        InverseAffineByte(bits, 8 * i, tags, 8 * i, outBits, outTags, 8 * i, delta);
      return { bits: outBits, tags: outTags };
    }

    function BitwiseMixColumn(bits, tags) {
      const outBits = bits ? new Uint8Array(nstBits) : null;
      const outTags = new Array(nstBits);
      for (let c = 0; c < nst; ++c) {
        const aB = [], aT = [], bB = [], bT = [];
        for (let r = 0; r < 4; ++r) {
          const ab = [], at = [];
          for (let i = 0; i < 8; ++i) {
            if (bits) ab.push(bits[32 * c + 8 * r + i]);
            at.push(tags[32 * c + 8 * r + i]);
          }
          aB.push(ab); aT.push(at);
          if (bits)
            bB.push([ab[7], XOR(ab[0], ab[7]), ab[1], XOR(ab[2], ab[7]), XOR(ab[3], ab[7]), ab[4], ab[5], ab[6]]);
          bT.push([at[7], F.add(at[0], at[7]), at[1], F.add(at[2], at[7]), F.add(at[3], at[7]), at[4], at[5], at[6]]);
        }
        for (let i = 0; i < 8; ++i) {
          for (let r = 0; r < 4; ++r) {
            const r1 = (r + 1) % 4, r2 = (r + 2) % 4, r3 = (r + 3) % 4;
            // out_r = b_r + a_{r+3} + a_{r+2} + b_{r+1} + a_{r+1}
            if (bits)
              outBits[8 * (4 * c + r) + i] = XOR(XOR(XOR(bB[r][i], aB[r3][i]), XOR(aB[r2][i], bB[r1][i])), aB[r1][i]);
            outTags[8 * (4 * c + r) + i] = F.add(F.add(F.add(bT[r][i], aT[r3][i]), F.add(aT[r2][i], bT[r1][i])), aT[r1][i]);
          }
        }
      }
      return { bits: outBits, tags: outTags };
    }

    function ConjugatesBits(bits) {
      const out = new Array(8 * nstBytes);
      for (let i = 0; i < nstBytes; ++i) {
        let x = Array.prototype.slice.call(bits, 8 * i, 8 * i + 8);
        for (let j = 0; j < 7; ++j) {
          out[8 * i + j] = B.combineBits(x, 0);
          x = B.squareBits(x, 0);
        }
        out[8 * i + 7] = B.combineBits(x, 0);
      }
      return out;
    }

    function ConjugatesTags(tags) {
      const out = new Array(8 * nstBytes);
      for (let i = 0; i < nstBytes; ++i) {
        let x = tags.slice(8 * i, 8 * i + 8);
        for (let j = 0; j < 7; ++j) {
          out[8 * i + j] = B.combine(x, 0);
          x = B.squareTags(x, 0);
        }
        out[8 * i + 7] = B.combine(x, 0);
      }
      return out;
    }

    function InvNormToConjugates(bits, tags, off) {
      const val = new Array(4), tag = new Array(4);
      for (let i = 0; i < 4; ++i) {
        const nb = normBetas[i];
        if (bits) {
          const v = F.fromBit(bits[off]);
          if (bits[off + 1]) F.addInto(v, nb[0]);
          if (bits[off + 2]) F.addInto(v, nb[1]);
          if (bits[off + 3]) F.addInto(v, nb[2]);
          val[i] = v;
        }
        tag[i] = F.add(F.add(tags[off], F.mul(nb[0], tags[off + 1])),
          F.add(F.mul(nb[1], tags[off + 2]), F.mul(nb[2], tags[off + 3])));
      }
      return { val: val, tag: tag };
    }

    // --- the key schedule ---

    function KeyExpForward(bits, tags) {
      const size = 32 * 4 * (R + 1);
      const yBits = bits ? new Uint8Array(size) : null;
      const yTags = new Array(size);
      for (let i = 0; i < lambda; ++i) {
        if (bits) yBits[i] = bits[i];
        yTags[i] = tags[i];
      }
      let iwd = lambda;
      for (let j = nk; j < 4 * (R + 1); ++j) {
        if (j % nk === 0 || (nk > 6 && j % nk === 4)) {
          for (let b = 0; b < 32; ++b) {
            if (bits) yBits[32 * j + b] = bits[iwd + b];
            yTags[32 * j + b] = tags[iwd + b];
          }
          iwd += 32;
        } else {
          for (let b = 0; b < 32; ++b) {
            if (bits) yBits[32 * j + b] = XOR(yBits[32 * (j - nk) + b], yBits[32 * (j - 1) + b]);
            yTags[32 * j + b] = F.add(yTags[32 * (j - nk) + b], yTags[32 * (j - 1) + b]);
          }
        }
      }
      return { bits: yBits, tags: yTags };
    }

    function KeyExpBackward(xBits, xTags, xOff, kBits, kTags, delta) {
      const yBits = xBits ? new Uint8Array(8 * p.ske) : null;
      const yTags = new Array(8 * p.ske);
      let iwd = 0;
      let rmvRcon = true;
      const tb = xBits ? new Uint8Array(8) : null;
      const tt = new Array(8);
      for (let j = 0; j < p.ske; ++j) {
        const rcon = RCON[lambda === 256 ? Math.floor(j / 8) : Math.floor(j / 4)];
        for (let b = 0; b < 8; ++b) {
          const ki = iwd + (j % 4) * 8 + b;
          if (xBits) tb[b] = XOR(xBits[xOff + 8 * j + b], kBits[ki]);
          tt[b] = F.add(xTags[xOff + 8 * j + b], kTags[ki]);
          if (rmvRcon && j % 4 === 0) {
            const bit = AND(SHR(rcon, b), 1);
            if (xBits) tb[b] = XOR(tb[b], bit);
            if (delta && bit) F.addInto(tt[b], delta);
          }
        }
        InverseAffineByte(tb, 0, tt, 0, yBits, yTags, 8 * j, delta);
        if (j % 4 === 3) {
          if (lambda === 192) {
            iwd += 192;
          } else {
            iwd += 128;
            if (lambda === 256) rmvRcon = !rmvRcon;
          }
        }
      }
      return { bits: yBits, tags: yTags };
    }

    // --- prover ---

    function ExpKeyConstraintsProver(w, wTag) {
      const k = KeyExpForward(w, wTag);
      const wf = KeyExpBackward(w, wTag, lambda, k.bits, k.tags, null);
      const zDeg0 = [], zDeg1 = [];
      let iwd = 32 * (nk - 1);
      let doRotWord = true;
      for (let j = 0; j < p.ske / 4; ++j) {
        const kHat = [], kHatSq = [], wHat = [], wHatSq = [];
        const kHatTag = [], kHatTagSq = [], wHatTag = [], wHatTagSq = [];
        for (let r = 0; r < 4; ++r) {
          const rp = doRotWord ? (r + 3) % 4 : r;
          kHat[rp] = B.combineBits(k.bits, iwd + 8 * r);
          kHatSq[rp] = B.combineBitsSq(k.bits, iwd + 8 * r);
          wHat[r] = B.combineBits(wf.bits, 32 * j + 8 * r);
          wHatSq[r] = B.combineBitsSq(wf.bits, 32 * j + 8 * r);
          kHatTag[rp] = B.combine(k.tags, iwd + 8 * r);
          kHatTagSq[rp] = B.combineSq(k.tags, iwd + 8 * r);
          wHatTag[r] = B.combine(wf.tags, 32 * j + 8 * r);
          wHatTagSq[r] = B.combineSq(wf.tags, 32 * j + 8 * r);
        }
        if (lambda === 256) doRotWord = !doRotWord;
        for (let r = 0; r < 4; ++r) {
          zDeg1[8 * j + 2 * r] = F.add(F.add(F.mul(kHatSq[r], wHatTag[r]), F.mul(kHatTagSq[r], wHat[r])), kHatTag[r]);
          zDeg1[8 * j + 2 * r + 1] = F.add(F.add(F.mul(kHat[r], wHatTagSq[r]), F.mul(kHatTag[r], wHatSq[r])), wHatTag[r]);
          zDeg0[8 * j + 2 * r] = F.mul(kHatTagSq[r], wHatTag[r]);
          zDeg0[8 * j + 2 * r + 1] = F.mul(kHatTag[r], wHatTagSq[r]);
        }
        iwd += lambda === 192 ? 192 : 128;
      }
      return { zDeg0: zDeg0, zDeg1: zDeg1, k: k };
    }

    function EncConstraintsProver(inBits, inTags, outBits, outTags, outOff, w, wTag, wOff, kBits, kTags) {
      const nEnc = 3 * p.senc / 2;
      const z0 = new Array(nEnc), z1 = new Array(nEnc), z2 = new Array(nEnc);
      let stateBits = new Uint8Array(nstBits);
      let stateTags = new Array(nstBits);
      for (let i = 0; i < nstBits; ++i) {
        stateBits[i] = XOR(inBits[i], kBits[i]);
        stateTags[i] = F.add(inTags[i], kTags[i]);
      }
      for (let r = 0; r < R / 2; ++r) {
        const conj = ConjugatesBits(stateBits);
        const conjTag = ConjugatesTags(stateTags);
        const normOff = wOff + 3 * nstBits * r / 2;
        const dash2 = new Array(8 * nstBytes), dash1 = new Array(8 * nstBytes), dash0 = new Array(8 * nstBytes);
        for (let i = 0; i < nstBytes; ++i) {
          const y = InvNormToConjugates(w, wTag, normOff + 4 * i);
          const yv = y.val[0], yt = y.tag[0];
          const c1 = conj[8 * i + 1], c4 = conj[8 * i + 4], t1 = conjTag[8 * i + 1], t4 = conjTag[8 * i + 4];
          const zi = 3 * r * nstBytes + i;
          z0[zi] = F.mul(F.mul(yt, t1), t4);
          z1[zi] = F.add(F.add(F.mul(F.mul(yv, t1), t4), F.mul(F.mul(yt, t1), c4)), F.mul(F.mul(yt, c1), t4));
          z2[zi] = F.add(F.add(F.add(F.mul(F.mul(yv, c1), t4), F.mul(F.mul(yv, t1), c4)), F.mul(F.mul(yt, c1), c4)), conjTag[8 * i]);
          for (let j = 0; j < 8; ++j) {
            const ci = 8 * i + (j + 4) % 8, yi = j % 4;
            dash2[8 * i + j] = F.mul(conj[ci], y.val[yi]);
            dash1[8 * i + j] = F.add(F.mul(conj[ci], y.tag[yi]), F.mul(conjTag[ci], y.val[yi]));
            dash0[8 * i + j] = F.mul(conjTag[ci], y.tag[yi]);
          }
        }
        const k0Deg1 = new Array(nstBytes), k0Deg0 = new Array(nstBytes);
        const kOff = (2 * r + 1) * nstBits;
        for (let i = 0; i < nstBytes; ++i) {
          k0Deg1[i] = B.combineBits(kBits, kOff + 8 * i);
          k0Deg0[i] = B.combine(kTags, kOff + 8 * i);
        }
        const st = [];
        for (let b = 0; b < 2; ++b) {
          let d0 = SboxAffine(dash0, b), d1 = SboxAffine(dash1, b), d2 = SboxAffine(dash2, b);
          const cst = (b ? affineCSq : affineC)[8];
          for (let i = 0; i < nstBytes; ++i) F.addInto(d2[i], cst);
          d0 = MixColumns(ShiftRows(d0), b);
          d1 = MixColumns(ShiftRows(d1), b);
          d2 = MixColumns(ShiftRows(d2), b);
          for (let i = 0; i < nstBytes; ++i) {
            if (b === 0) {
              F.addInto(d1[i], k0Deg0[i]);
              F.addInto(d2[i], k0Deg1[i]);
            } else {
              F.addInto(d0[i], F.mul(k0Deg0[i], k0Deg0[i]));
              F.addInto(d2[i], F.mul(k0Deg1[i], k0Deg1[i]));
            }
          }
          st.push([d0, d1, d2]);
        }
        let sTildeBits, sTildeTags;
        if (r === R / 2 - 1) {
          sTildeBits = new Uint8Array(nstBits);
          sTildeTags = new Array(nstBits);
          for (let i = 0; i < nstBits; ++i) {
            sTildeBits[i] = XOR(outBits[outOff + i], kBits[R * nstBits + i]);
            sTildeTags[i] = F.add(outTags[outOff + i], kTags[R * nstBits + i]);
          }
        } else {
          const from = wOff + nstBits / 2 + (nstBits / 2) * 3 * r;
          sTildeBits = w.slice(from, from + nstBits);
          sTildeTags = wTag.slice(from, from + nstBits);
        }
        const sdd = InverseShiftRowsBits(sTildeBits, sTildeTags);
        const s = InverseAffine(sdd.bits, sdd.tags, null);
        for (let bi = 0; bi < nstBytes; ++bi) {
          const sDeg1 = B.combineBits(s.bits, 8 * bi);
          const sDeg0 = B.combine(s.tags, 8 * bi);
          const sSqDeg1 = B.combineBitsSq(s.bits, 8 * bi);
          const sSqDeg0 = B.combineSq(s.tags, 8 * bi);
          const idx = (3 * r + 1) * nstBytes + 2 * bi;
          const a0 = st[0][0][bi], a1 = st[0][1][bi], a2 = st[0][2][bi];
          const b0 = st[1][0][bi], b1 = st[1][1][bi], b2 = st[1][2][bi];
          z0[idx] = F.mul(sSqDeg0, a0);
          z1[idx] = F.add(F.mul(sSqDeg0, a1), F.mul(sSqDeg1, a0));
          z2[idx] = F.add(F.add(F.mul(sSqDeg0, a2), F.mul(sSqDeg1, a1)), sDeg0);
          z0[idx + 1] = F.mul(sDeg0, b0);
          z1[idx + 1] = F.add(F.add(F.mul(sDeg0, b1), F.mul(sDeg1, b0)), a0);
          z2[idx + 1] = F.add(F.add(F.mul(sDeg0, b2), F.mul(sDeg1, b1)), a1);
        }
        if (r !== R / 2 - 1) {
          const mixed = BitwiseMixColumn(sTildeBits, sTildeTags);
          const nOff = (2 * r + 2) * nstBits;
          stateBits = new Uint8Array(nstBits);
          stateTags = new Array(nstBits);
          for (let i = 0; i < nstBits; ++i) {
            stateBits[i] = XOR(mixed.bits[i], kBits[nOff + i]);
            stateTags[i] = F.add(mixed.tags[i], kTags[nOff + i]);
          }
        }
      }
      return { z0: z0, z1: z1, z2: z2 };
    }

    function ConstraintsProver(w, wTag, owfIn, owfOut) {
      const z0 = [], z1 = [], z2 = [];
      const blocksize = nstBits;
      z0.push(F.zero());
      z1.push(F.mul(wTag[0], wTag[1]));
      z2.push(F.add(F.mulBit(wTag[0], w[1]), F.mulBit(wTag[1], w[0])));

      let inBits, inTags, outBits, outTags, kBits, kTags;
      if (p.em) {
        const rk = ExpandKey(owfIn, 0, nk, nk, R);
        kBits = new Uint8Array((R + 1) * blocksize);
        kTags = new Array((R + 1) * blocksize);
        for (let i = 0; i < rk.length; ++i)
          for (let b = 0; b < 32; ++b) {
            kBits[32 * i + b] = AND(SHR(rk[i], b), 1);
            kTags[32 * i + b] = F.zero();
          }
        inBits = w.slice(0, blocksize);
        inTags = wTag.slice(0, blocksize);
        outBits = new Uint8Array(blocksize);
        outTags = new Array(blocksize);
        for (let i = 0; i < blocksize; ++i) {
          outBits[i] = XOR(w[i], GetBit(owfOut, i));
          outTags[i] = wTag[i];
        }
      } else {
        inBits = new Uint8Array(blocksize);
        inTags = new Array(blocksize);
        for (let i = 0; i < blocksize; ++i) { inBits[i] = GetBit(owfIn, i); inTags[i] = F.zero(); }
        outBits = new Uint8Array(p.beta * blocksize);
        outTags = new Array(p.beta * blocksize);
        for (let i = 0; i < p.beta * blocksize; ++i) { outBits[i] = GetBit(owfOut, i); outTags[i] = F.zero(); }
        const ks = ExpKeyConstraintsProver(w, wTag);
        for (let i = 0; i < 2 * p.ske; ++i) {
          z0.push(F.zero());
          z1.push(ks.zDeg0[i]);
          z2.push(ks.zDeg1[i]);
        }
        kBits = ks.k.bits;
        kTags = ks.k.tags;
      }
      for (let b = 0; b < p.beta; ++b) {
        if (b === 1) inBits[0] = XOR(inBits[0], 1);
        const e = EncConstraintsProver(inBits, inTags, outBits, outTags, b * blocksize,
          w, wTag, p.lke + b * p.lenc, kBits, kTags);
        for (let i = 0; i < e.z0.length; ++i) {
          z0.push(e.z0[i]); z1.push(e.z1[i]); z2.push(e.z2[i]);
        }
      }
      return { z0: z0, z1: z1, z2: z2 };
    }

    // --- verifier ---

    function ExpKeyConstraintsVerifier(wKey, delta) {
      const k = KeyExpForward(null, wKey);
      const wf = KeyExpBackward(null, wKey, lambda, null, k.tags, delta);
      const z = [];
      let iwd = 32 * (nk - 1);
      let doRotWord = true;
      for (let j = 0; j < p.ske / 4; ++j) {
        const kHat = [], kHatSq = [], wHat = [], wHatSq = [];
        for (let r = 0; r < 4; ++r) {
          const rp = doRotWord ? (r + 3) % 4 : r;
          kHat[rp] = B.combine(k.tags, iwd + 8 * r);
          kHatSq[rp] = B.combineSq(k.tags, iwd + 8 * r);
          wHat[r] = B.combine(wf.tags, 32 * j + 8 * r);
          wHatSq[r] = B.combineSq(wf.tags, 32 * j + 8 * r);
        }
        if (lambda === 256) doRotWord = !doRotWord;
        for (let r = 0; r < 4; ++r) {
          z[8 * j + 2 * r] = F.add(F.mul(kHatSq[r], wHat[r]), F.mul(delta, kHat[r]));
          z[8 * j + 2 * r + 1] = F.add(F.mul(kHat[r], wHatSq[r]), F.mul(delta, wHat[r]));
        }
        iwd += lambda === 192 ? 192 : 128;
      }
      return { z: z, k: k.tags };
    }

    function EncConstraintsVerifier(inKey, outKey, outOff, wKey, wOff, rkeys, delta) {
      const nEnc = 3 * p.senc / 2;
      const z = new Array(nEnc);
      const deltaSq = F.mul(delta, delta);
      let state = new Array(nstBits);
      for (let i = 0; i < nstBits; ++i) state[i] = F.add(inKey[i], rkeys[i]);
      for (let r = 0; r < R / 2; ++r) {
        const conj = ConjugatesTags(state);
        const normOff = wOff + 3 * nstBits * r / 2;
        const dash = new Array(8 * nstBytes);
        for (let i = 0; i < nstBytes; ++i) {
          const y = InvNormToConjugates(null, wKey, normOff + 4 * i).tag;
          z[3 * r * nstBytes + i] = F.add(F.mul(F.mul(y[0], conj[8 * i + 1]), conj[8 * i + 4]),
            F.mul(conj[8 * i], deltaSq));
          for (let j = 0; j < 8; ++j) dash[8 * i + j] = F.mul(conj[8 * i + (j + 4) % 8], y[j % 4]);
        }
        const kOff = (2 * r + 1) * nstBits;
        const k0 = new Array(nstBytes);
        for (let i = 0; i < nstBytes; ++i) k0[i] = B.combine(rkeys, kOff + 8 * i);
        const st = [];
        for (let b = 0; b < 2; ++b) {
          let d = SboxAffine(dash, b);
          const cst = F.mul((b ? affineCSq : affineC)[8], deltaSq);
          for (let i = 0; i < nstBytes; ++i) F.addInto(d[i], cst);
          d = MixColumns(ShiftRows(d), b);
          for (let i = 0; i < nstBytes; ++i)
            F.addInto(d[i], b === 0 ? F.mul(k0[i], delta) : F.mul(k0[i], k0[i]));
          st.push(d);
        }
        let sTilde;
        if (r === R / 2 - 1) {
          sTilde = new Array(nstBits);
          for (let i = 0; i < nstBits; ++i) sTilde[i] = F.add(outKey[outOff + i], rkeys[R * nstBits + i]);
        } else {
          const from = wOff + nstBits / 2 + (nstBits / 2) * 3 * r;
          sTilde = wKey.slice(from, from + nstBits);
        }
        const sdd = InverseShiftRowsBits(null, sTilde);
        const s = InverseAffine(null, sdd.tags, delta);
        for (let bi = 0; bi < nstBytes; ++bi) {
          const sKey = B.combine(s.tags, 8 * bi);
          const sSqKey = B.combineSq(s.tags, 8 * bi);
          const idx = (3 * r + 1) * nstBytes + 2 * bi;
          z[idx] = F.add(F.mul(sSqKey, st[0][bi]), F.mul(delta, F.mul(delta, sKey)));
          z[idx + 1] = F.add(F.mul(sKey, st[1][bi]), F.mul(delta, st[0][bi]));
        }
        if (r !== R / 2 - 1) {
          const mixed = BitwiseMixColumn(null, sTilde);
          const nOff = (2 * r + 2) * nstBits;
          state = new Array(nstBits);
          for (let i = 0; i < nstBits; ++i) state[i] = F.add(mixed.tags[i], rkeys[nOff + i]);
        }
      }
      return z;
    }

    function ConstraintsVerifier(wKey, owfIn, owfOut, delta) {
      const z = [];
      const blocksize = nstBits;
      z.push(F.mul(delta, F.mul(wKey[0], wKey[1])));
      let inKey, outKey, rkeys;
      if (p.em) {
        const rk = ExpandKey(owfIn, 0, nk, nk, R);
        rkeys = new Array((R + 1) * blocksize);
        for (let i = 0; i < rk.length; ++i)
          for (let b = 0; b < 32; ++b) rkeys[32 * i + b] = F.mulBit(delta, SHR(rk[i], b));
        inKey = wKey.slice(0, blocksize);
        outKey = new Array(blocksize);
        for (let i = 0; i < blocksize; ++i) outKey[i] = F.add(wKey[i], F.mulBit(delta, GetBit(owfOut, i)));
      } else {
        inKey = new Array(blocksize);
        for (let i = 0; i < blocksize; ++i) inKey[i] = F.mulBit(delta, GetBit(owfIn, i));
        outKey = new Array(p.beta * blocksize);
        for (let i = 0; i < p.beta * blocksize; ++i) outKey[i] = F.mulBit(delta, GetBit(owfOut, i));
        const ks = ExpKeyConstraintsVerifier(wKey, delta);
        for (let i = 0; i < 2 * p.ske; ++i) z.push(F.mul(delta, ks.z[i]));
        rkeys = ks.k;
      }
      for (let b = 0; b < p.beta; ++b) {
        if (b === 1) inKey[0] = F.add(inKey[0], delta);
        const e = EncConstraintsVerifier(inKey, outKey, b * blocksize, wKey, p.lke + b * p.lenc, rkeys, delta);
        for (let i = 0; i < e.length; ++i) z.push(e[i]);
      }
      return z;
    }

    return { ConstraintsProver: ConstraintsProver, ConstraintsVerifier: ConstraintsVerifier };
  }

  const constraintSystems = {};
  function ConstraintSystem(p) {
    if (!constraintSystems[p.name]) constraintSystems[p.name] = MakeConstraintSystem(p);
    return constraintSystems[p.name];
  }

  /** Transpose the lambda VOLE columns into one field element per witness row. */
  function RowsToField(p, columns, rows) {
    const F = FIELDS[p.lambda];
    const out = new Array(rows);
    for (let r = 0; r < rows; ++r) out[r] = F.zero();
    for (let col = 0; col < p.lambda; ++col) {
      const column = columns[col];
      const word = SHR(col, 5), mask = SHL(1, AND(col, 31));
      for (let by = 0; by < rows / 8; ++by) {
        const v = column[by];
        if (v === 0) continue;
        for (let b = 0; b < 8; ++b)
          if (AND(SHR(v, b), 1)) out[8 * by + b][word] = OR(out[8 * by + b][word], mask);
      }
    }
    return out;
  }

  function AesProve(p, w, u, V, owfIn, owfOut, chall2) {
    const F = FIELDS[p.lambda];
    const lambda = p.lambda, ell = p.ell;
    const wBits = new Uint8Array(ell);
    for (let i = 0; i < ell; ++i) wBits[i] = GetBit(w, i);
    const wTag = RowsToField(p, V, ell + 2 * lambda);
    const uBits = new Array(2 * lambda);
    for (let i = 0; i < 2 * lambda; ++i) uBits[i] = F.fromBit(GetBit(u, ell + i));
    const uStar0 = F.sumPoly(uBits, 0), uStar1 = F.sumPoly(uBits, lambda);
    const vStar0 = F.sumPoly(wTag, ell), vStar1 = F.sumPoly(wTag, ell + lambda);
    const z = ConstraintSystem(p).ConstraintsProver(wBits, wTag, owfIn, owfOut);
    return {
      a0: ZkHash(p, chall2, z.z0, vStar0),
      a1: ZkHash(p, chall2, z.z1, F.add(uStar0, vStar1)),
      a2: ZkHash(p, chall2, z.z2, uStar1)
    };
  }

  function AesVerify(p, d, Q, chall2, chall3, a1, a2, owfIn, owfOut) {
    const F = FIELDS[p.lambda];
    const lambda = p.lambda, ell = p.ell;
    const delta = F.load(chall3, 0);
    const deltaSq = F.mul(delta, delta);
    const qKey = RowsToField(p, Q, ell + 2 * lambda);
    const qStar = F.add(F.sumPoly(qKey, ell), F.mul(delta, F.sumPoly(qKey, ell + lambda)));
    const wKey = new Array(ell);
    for (let i = 0; i < ell; ++i) wKey[i] = GetBit(d, i) ? F.add(qKey[i], delta) : qKey[i];
    const z = ConstraintSystem(p).ConstraintsVerifier(wKey, owfIn, owfOut, delta);
    const qTilde = F.load(ZkHash(p, chall2, z, qStar), 0);
    F.addInto(qTilde, F.mul(F.load(a1, 0), delta));
    F.addInto(qTilde, F.mul(F.load(a2, 0), deltaSq));
    return F.store(qTilde);
  }

  // ===== SIGNING AND VERIFICATION =====

  function Layout(p) {
    const lb = p.lambdaBytes;
    const cBytes = (p.tau - 1) * p.ellHatBytes;
    const uTilde = cBytes;
    const d = uTilde + lb + 2;
    const a1 = d + p.ell / 8;
    const a2 = a1 + lb;
    const decom = a2 + lb;
    const chall3 = p.sigSize - 4 - 16 - lb;
    return { c: 0, uTilde: uTilde, d: d, a1: a1, a2: a2, decom: decom, chall3: chall3, ivPre: chall3 + lb, ctr: chall3 + lb + 16 };
  }

  function ChallengeGrindOk(p, chall3) {
    for (let i = p.lambda - p.w; i < p.lambda; ++i) if (GetBit(chall3, i)) return false;
    return true;
  }

  function HashMu(p, owfIn, owfOut, msg) {
    return HashOnce(p.lambda, [owfIn, owfOut, msg], 8, 2 * p.lambdaBytes);
  }

  function HashChall1(p, mu, hcom, sig, iv) {
    const h = NewHash(p.lambda);
    h.update(mu, 0, mu.length);
    h.update(hcom, 0, hcom.length);
    h.update(sig, 0, (p.tau - 1) * p.ellHatBytes);
    h.update(iv, 0, 16);
    h.updateByte(9);
    h.finalize();
    return h.squeeze(5 * p.lambdaBytes + 8);
  }

  function Chall3Context(p, chall2, a0, sig, lay) {
    const lb = p.lambdaBytes;
    const h = NewHash(p.lambda);
    h.update(chall2, 0, chall2.length);
    h.update(a0, 0, lb);
    h.update(sig, lay.a1, lb);
    h.update(sig, lay.a2, lb);
    return h;
  }

  /**
   * FAEST.Sign.
   * @param {object} p - parameter set
   * @param {Uint8Array} sk - owf input followed by owf key
   * @param {Uint8Array} msg - the message
   * @param {Uint8Array} rho - the signer's randomness, possibly empty
   * @returns {Uint8Array} the signature
   */
  function Sign(p, sk, msg, rho) {
    const lb = p.lambdaBytes;
    const owfIn = sk.subarray(0, p.owfInputSize);
    const owfKey = sk.subarray(p.owfInputSize, p.owfInputSize + lb);
    const owfOut = Owf(p, owfKey, 0, owfIn, 0);
    const sig = new Uint8Array(p.sigSize);
    const lay = Layout(p);

    const mu = HashMu(p, owfIn, owfOut, msg);
    const h3 = NewHash(p.lambda);
    h3.update(owfKey, 0, lb);
    h3.update(mu, 0, mu.length);
    if (rho && rho.length) h3.update(rho, 0, rho.length);
    h3.updateByte(3);
    h3.finalize();
    const rootKey = h3.squeeze(lb);
    const ivPre = h3.squeeze(16);
    sig.set(ivPre, lay.ivPre);
    const iv = HashOnce(p.lambda, [ivPre], 4, 16);

    const vc = VoleCommit(p, rootKey, iv);
    sig.set(vc.c, lay.c);
    const chall1 = HashChall1(p, mu, vc.bavc.h, sig, iv);
    sig.set(VoleHash(p, chall1, vc.u), lay.uTilde);

    const h2 = NewHash(p.lambda);
    h2.update(chall1, 0, chall1.length);
    h2.update(sig, lay.uTilde, lb + 2);
    for (let i = 0; i < p.lambda; ++i) {
      const vt = VoleHash(p, chall1, vc.V[i]);
      h2.update(vt, 0, vt.length);
    }
    const w = ExtendWitness(p, owfKey, owfIn);
    XorBytes(w, 0, vc.u, 0, sig, lay.d, p.ell / 8);
    h2.update(sig, lay.d, p.ell / 8);
    h2.updateByte(10);
    h2.finalize();
    const chall2 = h2.squeeze(3 * lb + 8);

    const a = AesProve(p, w, vc.u, vc.V, owfIn, owfOut, chall2);
    sig.set(a.a1, lay.a1);
    sig.set(a.a2, lay.a2);

    const ctx = Chall3Context(p, chall2, a.a0, sig, lay);
    const ctrBytes = new Uint8Array(4);
    for (let ctr = 0; ; ++ctr) {
      ctrBytes[0] = AND(ctr, 0xFF); ctrBytes[1] = AND(SHR(ctr, 8), 0xFF);
      ctrBytes[2] = AND(SHR(ctr, 16), 0xFF); ctrBytes[3] = SHR(ctr, 24);
      const h = ctx.clone();
      h.update(ctrBytes, 0, 4);
      h.updateByte(11);
      h.finalize();
      const chall3 = h.squeeze(lb);
      if (!ChallengeGrindOk(p, chall3)) continue;
      const decom = BavcOpen(p, vc.bavc, DecodeChallenge(p, chall3));
      if (!decom) continue;
      sig.set(chall3, lay.chall3);
      sig.set(decom, lay.decom);
      sig.set(ctrBytes, lay.ctr);
      break;
    }
    return sig;
  }

  /**
   * FAEST.Verify.
   * @returns {boolean} whether sig is a valid signature on msg under pk
   */
  function Verify(p, pk, msg, sig) {
    if (sig.length !== p.sigSize || pk.length !== p.pkSize) return false;
    const lb = p.lambdaBytes;
    const lay = Layout(p);
    const owfIn = pk.subarray(0, p.owfInputSize);
    const owfOut = pk.subarray(p.owfInputSize);
    const chall3 = sig.subarray(lay.chall3, lay.chall3 + lb);
    if (!ChallengeGrindOk(p, chall3)) return false;

    const mu = HashMu(p, owfIn, owfOut, msg);
    const iv = HashOnce(p.lambda, [sig.subarray(lay.ivPre, lay.ivPre + 16)], 4, 16);
    const rec = VoleReconstruct(p, iv, chall3, sig, lay.decom, sig, lay.c);
    if (!rec) return false;
    const chall1 = HashChall1(p, mu, rec.h, sig, iv);

    const h2 = NewHash(p.lambda);
    h2.update(chall1, 0, chall1.length);
    h2.update(sig, lay.uTilde, lb + 2);
    for (let i = 0; i < p.lambda; ++i) {
      const qt = VoleHash(p, chall1, rec.Q[i]);
      if (GetBit(chall3, i)) XorBytes(qt, 0, sig, lay.uTilde, qt, 0, lb + 2);
      h2.update(qt, 0, qt.length);
    }
    h2.update(sig, lay.d, p.ell / 8);
    h2.updateByte(10);
    h2.finalize();
    const chall2 = h2.squeeze(3 * lb + 8);

    const a0 = AesVerify(p, sig.subarray(lay.d, lay.d + p.ell / 8), rec.Q, chall2, chall3,
      sig.subarray(lay.a1, lay.a1 + lb), sig.subarray(lay.a2, lay.a2 + lb), owfIn, owfOut);
    const h = Chall3Context(p, chall2, a0, sig, lay);
    h.update(sig, lay.ctr, 4);
    h.updateByte(11);
    h.finalize();
    const expected = h.squeeze(lb);
    let diff = 0;
    for (let i = 0; i < lb; ++i) diff = OR(diff, XOR(expected[i], chall3[i]));
    return diff === 0;
  }

  /** The public key of a secret key: the OWF input followed by its image. */
  function PublicKeyOf(p, sk) {
    const pk = new Uint8Array(p.pkSize);
    pk.set(sk.subarray(0, p.owfInputSize), 0);
    pk.set(Owf(p, sk, p.owfInputSize, sk, 0), p.owfInputSize);
    return pk;
  }

  /** A secret key is usable when the first two bits of the OWF key are not both set. */
  function ValidOwfKey(p, sk) {
    const first = sk[p.owfInputSize];
    return AND(AND(first, 1), AND(SHR(first, 1), 1)) === 0;
  }

  // ===== THE NIST GENERATOR =====
  //
  // The AES-256 CTR_DRBG of the NIST reference harness, which drew every seed
  // of the Known Answer Tests: key generation draws the OWF key until it is
  // valid, then the OWF input, and signing draws rho.

  function IncrementCounter(v) {
    for (let j = 15; j >= 0; --j) {
      if (v[j] === 0xFF) v[j] = 0;
      else { v[j] = v[j] + 1; break; }
    }
  }

  function Drbg(entropy) {
    let key = new Uint8Array(32);
    const v = new Uint8Array(16);
    const block = new Uint8Array(16);
    const update = function (provided) {
      const temp = new Uint8Array(48);
      for (let i = 0; i < 3; ++i) {
        IncrementCounter(v);
        AesEncryptBlock(key, 0, 256, v, 0, temp, 16 * i);
      }
      if (provided) for (let i = 0; i < 48; ++i) temp[i] = XOR(temp[i], provided[i]);
      key = temp.slice(0, 32);
      for (let i = 0; i < 16; ++i) v[i] = temp[32 + i];
    };
    update(entropy);
    return {
      read: function (count) {
        const out = new Uint8Array(count);
        let produced = 0;
        while (produced < count) {
          IncrementCounter(v);
          AesEncryptBlock(key, 0, 256, v, 0, block, 0);
          for (let j = 0; j < 16 && produced < count; ++j) out[produced++] = block[j];
        }
        update(null);
        return out;
      }
    };
  }

  /**
   * Replay the harness: crypto_sign_keypair then the randomness of crypto_sign.
   * @returns {object} { sk, pk, rho }
   */
  function KeypairFromDrbg(p, drbg) {
    const lb = p.lambdaBytes;
    let owfKey;
    do {
      owfKey = drbg.read(lb);
    } while (AND(AND(owfKey[0], 1), AND(SHR(owfKey[0], 1), 1)) !== 0);
    const owfIn = drbg.read(p.owfInputSize);
    const sk = new Uint8Array(p.skSize);
    sk.set(owfIn, 0);
    sk.set(owfKey, p.owfInputSize);
    return { sk: sk, pk: PublicKeyOf(p, sk) };
  }

  // ===== KAT DATA =====
  //
  // The count = 0 record of each of the twelve PQCsignKAT files of the
  // second-round submission package, transcribed: the seed the NIST harness
  // was initialised with, the message, the public and secret keys, and the
  // signature, which is the signed message less its leading copy of the
  // message. Nothing here was produced by this file.

  const KAT_URL = 'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip';

  const KAT = [
    {
      set: 'FAEST-128f',
      file: 'faest_128f/PQCsignKAT_32.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208',
      sk: '91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add',
      sig: '369e002f56e47960a9c663623772bed760e6f06409266bb8a15c32cde25afdc4429c0dd8150fc5de1e57e99709652102a39cb4e2314d3c2f3df328e2ed1cf36b' +
           '73b6a9e54feb8b27187cfc2819789c04b8482f8e998abf6e2231c2597e9b4660ffab573086cb8404392d0f477a3b081d3793cb99928b18aa4525c95935e240ff' +
           '069f223c8e13475432a4bbfdd03f7c26564d1511647455006fa6724dc1660df1b30567c2962bc42a342d942e8077a58a164465c7415b9ed1e0ba5a9ba5c9e5e9' +
           '7161f736ed8a3d3bfb5effa1285caefdba7575eb84ae8ae539c182200baae03a5396f41d58f94d9c4247d1ad8d12a0b886105d2c30e433475f952dc3523454dd' +
           '518dd319a8e1650ecf7adcc5e4e197f73a62c40f09dcfc237a7f8192f9262b4c62c4665b34897e6fc56177c6a38862db9b09db0b4b7abeac5b56cf492ff63c9c' +
           'b6ae86c909d39e63e1580e57c6b5a3188a0a159944a6c652d11958e540ce29cfa159452307fe7eb9ec47a271806f71c6a83cf8cf8f64e04ebb4193450ca73132' +
           '2305f5cf62697ceba468f0d1b4bba70f04cc8a92f2888276a3620e2233ea24ea39582da123d065283c924329670e373c0971fd7f27861baa44486f4536643b6d' +
           'af3aed82d998035f23df119f591a2c2d70e543a28f8076abd653bb3af26a9954f27921706fc23349d6f2e871394e58c5e2236980ac660b3515750b123e234e75' +
           'ca159cb63a73d8591f76b9571a02a4fe3bcda87ccc75b6c6a82c54482eeb0d22a2e6afd566ba5b1b7cadd50f06b72dea84d69a08a9c084e0d2c5f0669d6c6c0b' +
           '5bf3ca56077c8cacc7fd59f3ec69f5ff74c44d2cb0d3109e4aa9cfd6fb9143009efc40060d3d8f35e4d74b2dc6530a33af980476d29f6bbe4806fd1fd7af1e75' +
           '7d4670bc3162e4d90b5cc33de11f373333e42983e1b088a9aa212d1154339016e475bf0978e9943bb983fba544a1c8c9cf3360161ffeeb6be2e58d72b22ff06b' +
           '23cd4fd7bf36858b1133002feda2ac4843a37a47885143ce02ff13f153cc2449e95354166d243357a8baf8fd557a4b647b6415fbedda8d5d145744ca2280c952' +
           'e762287a5bddaf536cb633dc331a453a4b3f407902911ece9c7343e142ea1e271168e51d2218a8d2315e43d914e9d115ffacbe991c63e9276e47a32604687728' +
           '7688827a9f67b31366846e75de6b47ca0d12eeddff6eeafc85ce6de179f57ea44b6d4fdf6091e0256019dd024293ef1f02551bfedb87e51d71b42f5b32ca9a9d' +
           '020da566cc1baa3617fdb1982b7588427e72aee25349232dae091d1f90703db0dabedfcd8b56e714a7c3186d5dc7b7f149e95284a72915bee5b4210cb671ee90' +
           'd109dd587aab154e6feb63b7cbb6512d01d0be2eddeed4c8c4846e5baee9e55fd07c0334e8dcd1e24fe9c925806fe17c9368a0b729af55341223e8201e4b7f65' +
           '3729df85ee96bba7aac6992264ee297a148237f164caec94557b51be401786ffbf269a544eacedc0545becb0de73aff6663437fc38c45b22a049d4ac1cc74f15' +
           '7e1d818397d48ea20e1a1421a1a3ed304c10404d6039b8ee4a6edb081467b55c26f095341f828f7297438fd2204bde49edd26eddf1490a51931c691f202b0863' +
           '8a29ceb4fe0740331675eee5a78f9f979e61a0a8f33af7948b03bbfc3c17c5274f7d50d7b6509e12f215a9cccf14aab9b0a09920174ba7ddcb068f51e38f900b' +
           'a4ec1da20cf02857f29982106455cdef676612a368c3b5520efdd7a903b8698b4b7e0f3a4bc5b25ce9c840da8a7a5f36eb6956e4910f07a1aa4b2d63147073ad' +
           '8306bd4ec076632e90d04064adaa7e8a645918ffeaa1011c968cb0461514d069b490ec5670852acef0f47f59936327ff16b7f61e28a5bc3305dd7a29c303ac9a' +
           '010544005bcb22bacd88419076f34254eba9d5a52264f3236f2c1cf355bef025747152d09effea1351a1f8d270ecb2c3ae17b332c2951a8b8337ccae80899aaa' +
           '0a8e0a00ed74b656cf98726919d68a2d98bf9b7e2952e9364bf8c5b787a7dd1600c3e3154945b540c959e2d87c04ede5bc11acc95734c8a12ebe1d272ad3e06b' +
           '38aa2b7ea83b992426890a4e844045daf95cb0e39a8279a64e8d078a2277ca80e29415e415ad651c4b57b659f237fc7203d3e3f2804c07ae92dddbaba8e81206' +
           '4d952b8915a2e691f2cb863dc54df3fd0456c17466e8ef104d222613059037d1573f3d05cb71b91888e364c4e17a79ffcfecb191251b376206b912f731499479' +
           'c8514c27a95e48aac2c9c1317a97482c750e863b571eedcc1e307790787a8beffa692d7335a98d493e9758731dcc01f9659124d5ec31860c4aefd13fddd25b0a' +
           '8dd425dd7ec3a0865014f73ad270324b08d779e5a0bf1847f1ccbe7d0a6b1b6279c5a9b28ebd5b857d09a2ddf66d17df4e7e308f7c6a96252e6123791784a86d' +
           '3e61f53113af41680276cc6f9d5e1bd5f664487cac2cdffa1bbc412987eb3c09ecb1314680416bcb4a578656e1bb5a0e9d06390d804436d73f8559eacdd83563' +
           '54078eb400e84b69defa873f3a03128c9a765b485404dd0837e926a4a210a2a5c480e9114d19b86208265360553b41b2e37df42a742a593a9e612133d995b28c' +
           'ccc275b78a2afd83a735e6043e3dae53731a3a741dad2b9e009c359663c52a10c68849f577aedab767f987aca9190fdc2146a2cc47fd496b6b0f7f3405889b34' +
           'effac60b261c156a48c32aa33ed11e98e7328eefbf5fb275d8a4584d28b1975bfce5b943858ec663b2ad540958f9b083b485f1f7a93f620010ab4ce2b7b72908' +
           '9370dc694e3b6b4aedfbe230cbbe6c09856250e4b4fd3a29dd2e7748d65d4139b9fb3202c2eb2b222b4111629f314281d417afc586d292f7ccae06b96e5e064a' +
           'b0fa3b676cde27202bae2c1caa848e311fe50ec10430b8e266fc28e0884e8655aa2b9e2229a15e40b926f37c870ae7319fb06e7e5a2a7612120c9ec12149b2e8' +
           '074a4d206f338d5dc88664e50e8486e6495ed461ee96a1c251bcbc785f9a860b6abba834f17191ac56d1cbd271b84eb9f8e22cfa9690a7512dea3176fb0b8679' +
           'b3bd75600997fd2ba3f4f5ead98a71de728ca05afc3f5e377ea6b6d15eec716c39c6512248ba2a6b4019bed8b99f22126af81605d7aa09f9fe33bd1bacbbbe7f' +
           'd81a37dc8ab121567b4203e03031e1c903b74310e77c0f6a2a82434801f9c5cd4971bc2d25f664f005c8b5cc86191f1f78d8a1d9948fdd388c60aa34fed961ee' +
           '24faa5ce7522086882a02e5822423d03c7a862492ab8b227e74f7da84240dac2ec522409420834ed07d6e2b69146d41fd70fdf4eb95784e0ab18f9d6e7ffbb64' +
           '27cebb875cf68b6e9e9e95dea8f3fd0e9c416c2324083f8e752483c243bf0408d849efcf3a6af379bea8d70822c4640655ea16b6c6b7fa21fa62ac2c8b79cd06' +
           'a4eeb1b9af2faa76e567e587128e66a94474b0f0c59e31c3ca02d07d33a226271217eee9fc506a8e6aafb06acfe3e377fa7aa164745b8f2f254a3e32f8f6ee32' +
           '90da94881665881f481e790b44f5955483ac6fc6aed57f26604b9371ad376ad0fd018f3bafc7311acaaf3bb4c18168dba9f71817c312af2988bd03d41b28f86a' +
           'a3d4e813590397eefd56845fb1ecb891d34878f3af14483e073b0dd215aa1975a843523a92d905d141906a0884057d56e9db11aa9a90dfb94b5c5e53323d8ee1' +
           'ff34fd7b0d70a7ed24b166711106a1c31299cc6162614414879875b1e9e144a4924edab353aec10e020d0cbea2a9cf8965f16cdf16a1e68666bb11a754250267' +
           '1c41274a08ddd7658c2aa57814b3d86343d1fc01b34b25a1413a7beaa13c1b1a0ac75a0b6e5a5b11c2a80b777f59efe99fb8ea118912f6720309326aad95577b' +
           '8be9291a9505730f120e28165fc35789c536ea046862e6cd4f6f81356ecaa9272de72d1daf72558e346fe6e09d310b6a846456012c9191f6701ded36a55fe2fa' +
           'abb829068b9e0cbd37ac08ab9bff7acc09224ce1c27bcfb779f9d53f1b99260cf9de517d4866d666e8113458891ff773f847f4ec0c312ce618baba9aa43a2e16' +
           '1e1a23b25574cd53c4639f2e4b59e2affec3373354f89b6556161beb22fe43adb571ae1e114b0a9f2b25083caf9425097b9b8750b45ecdc37db829bfb5f7ac81' +
           'c0babc0a170551593412310d88a03c781e4dc18bd2b1fb1de4b0c64e3a7699e3c93a81c2b980aa76cffd1a6be4144f0bbbfe021cf8caba4835888b0a267f7f71' +
           '52e1a4e1ab6d59cd0137de1681d0973a451386f5bd33fae25d811ee26bb0b35cc9ffad5584b8ee185978d71c0326f4eb49a170c8843ee8979a99accb15cd4f71' +
           '9dec2fb536ebe1daef9e8a36815cbc6660d30e28a0576c743786566f24d553becd1209b179eaefa98ae8f2deb2b3b4597b66c2c9558f78cdaf983adbb6882dc5' +
           '71f4e888bdd0912981efe9af276d5d59f1599596b1451a2e7c255063fa3c1382db9217d902f7a58be1613f8c870272110a97e042dc1de8b8d294c0ed2d2f4348' +
           '71b798531a6e8447afb7334753188dc159cf48f1acc4d737ee8830eb01b9a83bd5120a33fa2cf1281392f96e381cd5187f15175f809287c3d28588076c03a043' +
           '17cb3a842d76e8c7911abba777fc50af2b27593d1f62c048d12891f7ca2d77954c334e10e47e68a2856c4e35ecafce7db06e300be60005446ccaebb36ae6e8b9' +
           '89d345b16c4ef4f4dcb75b4885d5f2f56b483263a0763d1c4fb1910b01973716818175024bdbc90d33982f30bb32567037a55c62751afae24369ad32bbc5ee0c' +
           '1b11166cdc919e7d0077990df3d1db7d2c200e9f2cdf6f2997356de2cad5b1b2f6b6ee8decda313348ba14a1d45ce4096b4ce773cd55a1f56325d125d0a05a54' +
           'e0b8b971300e5a719121029409021deb29e3ec1a724b4741ce58d44aad8d65c9b62791d8359b281c8246af3c3b19066855740d83402e2cbef51a4473a9fdf2cf' +
           'b8c5f78bc94c6254f1154ee08d19f9f93b3d199134d0164265db00d455e9cea07fdc74d45c0c8bb5fe60589ba6f12987dd73f6ed5a31068a832c04a04d0dfeae' +
           'd1b572e707490a6e3e404fbeb8221de941afca7b303d412fac4441aa6792ff276053624e07f57f0ad66566df9227030a6f4f8237c81ae0ed7204e0210857ff90' +
           '8c879ca6a668a4c531355de4d23c0ee454f85700fedf4a3d43038998ee9dd3fc4ba99602ba5de9043451df823a5985884ccee7c0d56be05b50f566620d676779' +
           '3506544b9f5de9f724c38ede17d6ca7622fba4c7fb9a69a8645c5f52e382538dbb56a3dda98d18ed0e0b2688c8ff4bc4ce3e13797c9fee921871ecb64d67c706' +
           'b5e46447208ed561b578710dc9554b5abd046fb57ccb7b802b681adbc7983c25c9271ff3b0d4018c9032ca90fb56ca863c750fa027469f6644cdb67f55d53444' +
           '7b17e059fc9445f00bcc68c2db853ddc999898dd64bffd32f6ed2395cfdb0ffadd44747ef45136a51bd6f78f0975654dc61036808e87b32724e9f50de3398741' +
           'c181c25e58ab29e4df44b829f6c97461fae73c9e9db21a6fefef57dbfdfcd5fbb41f52dc8df8e6bae653882f1949b564a3d67fd955d204b653cf1801b4223769' +
           '389b3f8a7a55d48243d973abf521919d43d815ce22d42a8b748a673aa52baa97bf01dce3302226700d1a771b030a645d7b8583f391732f6afbbab97513075993' +
           'db6ff54280c02204dcaf82b780035559379250a3fb6667d345b22e67cddd539a02a9da3ff256027f2ae78fbca1a3abef032fd836edc6878f80bbb9300d70d2a0' +
           'b941e5e50aba5b49c1b347ab19767d653add5e605ca24ebca66bb3041fedd52f095a9d5fae264d5a4c6fe9a9a3ae0bc03da3e0f780ad64c724bc318216bd286b' +
           'ddbb8b402e020a6158b991d7a42ffd3c9992d699091391b8b464b8e9084968ee44026bfb540418d692786830072637fd2270219f4595153d1e4c6f87668e28e7' +
           '04a9143403661269808b774150b7e77ab8b01611388e393cfa61042673428315673047c8b00df763e77795e33142cead36bfabe5a109f3fca031c5498119b2a2' +
           '0a4269138175fb64a4835b69d7080744500bc7cfd735e6f174e37ee38d73f587df0ae1dc87bd077700b444290e1dbba8411367f1319d5537a39de62ec19edddc' +
           '8fb463f8124c1edecd0497023b3d60382efc7c753184afafe77671dad2e0b00052b64daf061217d3e36e65e58d47aa544fdb8d6199c4507142255615bf950b3a' +
           '826c683b27d2d5a5e926b96946ea76584ff7a1635285674f4d3208851048fedc6616e5b6c5736ed28057871f955f5b4505888a5a0dead05510dfebc7ae44b2e8' +
           '6f8b5f102037fbec1979cc87841f666ba56ebd93d443ac2f13ecbf51fd75428aed6805c0f96d07f83ad8c3048a31353f5fc811aaf41dfeab15b26a3febca0abd' +
           '76d984d37a889b76a91f7f9fde76308a27a98f9ff52e51683781ad4e6ad55ad9f599a6911d65c1296be65bab4e979dab50266c1290fa4cc246a385fc3e919ad6' +
           'c1be6d73c95e5d271589e056a996ea7ba08f922a9dc1a417890609ea9edd97b48f26e623d19c9afdc3c3c32fc1586f26097489e19be9fcdef37f20c2c0e11e75' +
           '4dc894cecdc6c14b427e56fa623ff1ef8895fe435122082c25613951a81d2ef387946d2dc937614bed81ef8f5518d9206774abaedd633438ffc5a50867ddd5fd' +
           '63242873712cd783d5eb25ff351d6598ba5b45680945a2e7b16ca4e6e52bcdfe5651267e493f06bca4b7453cd3316ff237ab07df92a8df081cd9241d005f3ba2' +
           '0380f080ce34b7c54341d78ca03b2f07ed653cd519d6c349b6cbc89a7e132bfc9fe31de206d20c2d8ad29a4a18d9b94ba3cb73afa0cc8f961287cb21bfa14688' +
           '0f75515197078fbdd012ef51edf9a69ad5f5399c759ef7e995c5d60358fb327b4cd73549fb226041e2e5058f9d9346ddfea17450e0d2c23d48018dbc0a28bd24' +
           '97c316608442f29e823afb57c1d2937826413b7c09e606cc7e128cc33d604d5a7e929a01f21541ffabde0b92a6873feb889c7f0ff2d8cd50d292846b5297e58c' +
           '51a29da5dd69236c46fa9b66dc5ae2b9763fc3ce038d607c8ee26ad47ababfaf052532708729898a2d96321df3687bcc7d8d57645b88511ed1b039e5bb009e12' +
           'cd46dd8a5151cd2cc20b041bf8f9836d6c43b35c85887a4046c17991481fa0d0c5e55f93f050af1bfb1fcded08170f54b4eb94dcb08eac793a9f1fdf802d0bba' +
           '0603f64810237a6422c91c42f94e9857bff5ee49823c463c37a2271057bee8f5470ea6989268288d9e58a0c12eecffcd97e541893c75a1d7de66be68d55ebc9c' +
           'b3f80fccca210e7fad6a8e4f7555fd5200117259bef25a8bfe29f0a3aed81781c7847165ac0282708e9d4d5267e958d2fe420a5da1abf8fd1eec32979de45168' +
           '5b47ee86dbbe3b2b84a26b826b93eafcd2f3aa3fbbc82748b8dac3e59f068501c9f671faa47dbcd11bab9fe7ad01bfaf2af6d417bd6cec39593b008ab4f1ad80' +
           'fe60ec9bfe3ffc281d466929fad9ef4a6295700c198f678d7a0a5d04f6792234eb57390b0f3bceb10c9e5ef86beb2f18f580aae520b4c83fe0de2de1bb332a79' +
           'e5f860f579e9a40b7012167f07412324b22dba76384b9bbe94620115fe4ac4bf40d40a1f3abd0ce8db827cc1a6d45ea21f0e4eac1cd6605e9dc02d58c06332e7' +
           '74aa64da2409eb38eec32a1f9bd41f29335203f230219e6b15cb915e7dfa5b58764bd0556bc1cc7bb9ce35c8b9a87c6d670ea7d4c086e8a9332063bbc3edacb4' +
           '302482b344e20f39add21ea4b7a48d895a74ac817173bc75b12ccb881248c61156c7e27aaafcd0e9f1481b17eb48208c1aaa4fb1f2a374a9effaf333f0e751c2' +
           '822e2d576410d65dc585d1a523628e3f61e6c591bf52621e420b65a369fa898c0b68ffdc93ccfd069628e8115768fa568d481087dce18dcd12f1f85ffee998cd' +
           'b80bbacef8976e6984f5c7badebc8ce908b58535548ca9ef0d37bd14d2755f21ab265dd49bd7f7520ca4a6eea363d871d4b1b372b23dd1ccd2285d9484554f32' +
           '5577d455779ee22547e050ec116d0146e748c0299ed273795ed22b0ecfec34c41d29f45dffc7eed3f7a596ed437ce42df79d8ad7cefb947990372fb9b9b13c4b' +
           '70af3df6e786617cbe54c98aaec6e588d45837cc1b7ae29982288c3b61e6894b03ccf7a30df4454ec971dda12cf3169a33af1d50caa7371539ad77e60b484456' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           'c5273fc15507fb6945db4df94b4d58009dce2b43d79b9a207e4b9be90c6a53c142010000'
    },
    {
      set: 'FAEST-128s',
      file: 'faest_128s/PQCsignKAT_32.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208',
      sk: '91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add',
      sig: '688d74253ac919a4e577c8dc14c3d78deadac09f3ade29592117f547bdcd2eb7d419d40735b2264261f48356472cb748aa8a4a969e24aa14e4cb2e5e450d59ed' +
           'a690e6628c1cc503f261830a92b97c368ab64bd24952aef4161b9976f0a9fb1b52f7b5f3bd1a85b92b6ce1d022bf5b80ea594091eb3b13b3b0231d97f6d5eb2b' +
           '5ef811827e3661c3574a49afd430e590751c538dc22ca4168ca01e5a7b0c780345169e91bf0a8759557029b35d82632df77938b86d54fdf5eab220479ccdcffd' +
           'ea28725dab52022d08dd202eb9e076de3f1ec3ac85558d4b4117c9e3aaa81f481ef412424741b82522b9ef30ad316496b03bd520c3043fd4733bbc7f06f0bc0a' +
           '5be371b9aa036588385118670092e99f404e685e0e6efb69e26761c907ec017865c2fd049a5096c8ab9038a45ad08c6fc98aba9a9f69dd49d7594295791f6e0b' +
           '3b9ed45101b7d23b13e4de325c352b98d1f6f379c3181680ffaf5bcdb9da92e6133be1cc2f899e44129a072debd60a1142131f5d448a14f87f5a9b2b8c75da8d' +
           '4870779bb910defc5e5be13607935ba0fb8c2491c2a3a6a799afd7789a01fe6e272e24945e10b0306e63f8d61714a59b967c1023c9761b976c43c4dbf7174f3f' +
           '5db65e2b225e3abc130350fc3cf5d427cd229503123b81bccdfe2aecb10b1e337976df8790369047afaf23fd80f770654acb82d1a0b34b4ddeb5db621d8f4324' +
           '3f2265ac7eebe35d598ae7cef007899f3d8d9f61c9ab4f0a5a6606809431c3539b69161d83a224c02e57f6997706145b5d7d087a1bbc181b15d28d772435569f' +
           'f5b30a85766f89cadc0a755592507b840395bcf5f5cd4158c26f1ac13bb5c33eaa10067b1fbbae09e2ebeed8d9c8eccb25bad67e13b4792d63f92424de75ef03' +
           '4b55ed202e6d9f37af52d5405e764d259459dcf6383a9b94564824c4eac2d9995f83263c8c236ab40880775efa1676240e911d7656b826bfe897ab39e3bca258' +
           'd8a002499c6f595d4acf88e29ec55320e60a3044a649d567c3f9d771a48903d5c372c55734b03816d30d50592298f1fe41654d686cc99c59dddf482a85da4226' +
           'a17433f8a2e88c51fe2f3cc552417956c7bbc59c9e1ddbff76f36158674b8f6d62414c70462bc3cb2daecffa4b7bbf408441e9f02679f7a8f98cfd0fa878bee4' +
           'adeb40b54abb9c33ab660ee5ebe15016b46af84ad612d6ee20f35dd23c209e1d6d9663ad1f6b70b430f7792822acf62a726e3dc07c21ab6b2a641af9087974f3' +
           'e4dd494128a6af3d8af946208eef745eb6b524d1d7e3ec8094028bfe12acac605faac1d57ef29bb6b850aad252711ac76aba8be259b4a1f357216d624e7691b8' +
           '6915404ea7a47a4404f2df60a97284920f74cfbf4d4e1d83e46af02a6c74d51b26b244cd68cb41cc1820b734df8771bf75fdff0d31a8e9b0ce138567ae259ed4' +
           '6fb465413cfaa1c3517dab6fcd5f5999eb377ee54fe58979dce2f110f72baaaf5df111c2d98146dd5ea8156101c81b78b4452354692796ad425c89c449d892f3' +
           'b6d0dd0fc5ff94b644481d7320cd0ae9bde4f89cf2e4456e7c7a1f87449be3e8e63119406c4810e803c81346eba13e6c66365ac448fe03bc2501bc9901f70f80' +
           'da723ede162c67202b8c917200271c86e0b250fa7b38a7b8db7e8a68296db305714930c4d288552d2639e0d690a1952d1f867b92b75a66e29bfd55e0c032b088' +
           '912aca36c0ee40bd7273d31a60c5441f6a04043a4cf307977ef0b67eaa2ad87d7c0d1c8b28e6e8ac08b26a0cee3315852ef725ba4ec06089a79144d18a6a3d08' +
           '5d4b4fce40de3cb89d6a3e450a68eb050f28c1b0673415b8da6f20cae5d59fd1f8787ab15f4b07682a4d042c34754d34891fdfa5c910e79f4adcaa34baa12d2b' +
           '7dda42355fdd573b9c8a7d9728abc285b606e78867afbffc5e80b5a32aeb45346e7b43aa2f3e3249f5e18f44c9392a50b9bb37e76df85fb7e6b30b3920df2156' +
           '7fd04628f59f30f9b2019db1096f1a146fe60bbe5a29552c522fc74c195b0baad561e8731aa2f7741567c4d75ad2d09f9f5b961676b463177be58ff35ce0d52c' +
           'e572ec18bc6fcfe63c647c0f543b69743c74be249fbdf41075bf17558fb24292d67a3276ec01991fed98eb0230fe1a14bb4bd0eebbc184bdda3c84f735ab22c7' +
           '88e1e2272f0ce83a41c5f393e81116eb117e12f375bc017c3697db211db0b57ca0e2f1d96dbfbc8108901c4b1591f984c7e98518b6468431588e80e7cb60507c' +
           'ac2af3631fde7426e4174c73a7b96e422ac02c623156d1448f70bd67ea0f0f5dea86c3fa0dc5beb6b0429ca2c60954663416e4a7996eb1dfa6fee6245eeff2f6' +
           '501dc975f312299e3115b063dd7aaad0e6a07b0aa0c11cab060369db60f56b9ff9d2f1806fe6804230bfd209afa6ce747167586a4736056a38bb3dbe676aac89' +
           '07cdee6a9d9779bb36e93aaf41174db2915053d17849515cb7f006d2479ef4d7173c3d6a0841d5bf7b47471175e7769ef272aaa8d37289a0d41b6cd7d30e6253' +
           '7c3c094ab931874fcaccbddb983764901cec15a1a20eb7664381205bbffedf781464a99224c8c741b921ff513e8a3080f5f93c51ca77041991a7d80a4691c056' +
           '70c45db8d55da8f57c71af3a2d1c0fa4538ccf2ebc2bea6ef851441f92b26053f04fb42ec46bbb1bce0680fa5a7e2efa3ffc7e1643d8f0e37df61218c9682d42' +
           '82e2ff0d5ad15b3494b3d0f36aa17122be4a812ea26779e74677460f571e45cba2fbd5631d504c06c7128558942f53b3583824a72fcebae3aecdae6113d6c9a2' +
           '937321bbc503522076c9ec55a8680a2d79d9612be6c8a7efc7d44c793c92e67925a1fa48f951ba28b6a953cecc733ed7d2a2b5de44023230071b4687e9e3a5c9' +
           'ec5614233fec6539f35724bb87838da9644019e8bdff5ff90ebe00e2928c1edabd62fa959238de70957499aaef93d7be0e388468b622e1ce1b2bf3bf5fa77390' +
           '9c57157c46cbc0497a42b4bb1b338123696e8b3b87df876711a953eea478b02bf068603c0d6f8dad58895b130b176b51a31069a6d03bd06fb4a7eafaa5431389' +
           '064fb660147179a58e87c6ad5c3c99818c29fd8ca87d04196d42dc12c3ce09f2c290877651112f60d530c22b5c7e39925d86fc11751359c0404eac26e31046e4' +
           '0e2c86be1ee69e4e731eb4a1db4b5067a5fe59c380c56d76849a24c979fa3884930de0db7be6231939db551e7cdf265bb50617102326276c45061df2a18816b6' +
           '41ab6e099e01683f2947aa00a1b764cb59d86b1b6687ead96f3b197975b172c8dfbd601df74cca5c69cf987ebb6dc27c62365da04684bce4e3db3b4b5def33e4' +
           '5283c4a7e2f8715bd5b553fac1a9912c322bce53308aff8408aca1a25204ab5502ff214691eb343c3821d5820591f32afa205948c9838c7666ceb2eb9b061c69' +
           'e41e1987619e0a257e7cfc5a8b1d7bab7af29c01922afe66e6f60906138153f5f00604443e0121a15c0b21f5132f4c1d1a50c3e4e30f48b98413fb43360e7b9c' +
           '4768146af7c88f23ca01f673f47d8aafc6a9446a987ea5eeef29098de32d72bc4dd588fa97749a836f44ea1f53c37188eb1f27b8c0c393d6470da80f4cd66b80' +
           '51519749a1b00e99c7fc371845778b3b677e47a720b7f971f9a5613fa22ede1b4facea34d40a2c3c71b25b4a385a18d1e7e19496d19c335ccfc1da24d04bdb68' +
           '7886a6faf45bdaf1ba6708ff3ba6ed9bc82ce9bb38495e0ca78b31e4196cdf50e236383a96738910d8195cba062d91b251b20a57f63b62a3f9efdac434466cce' +
           '5048a0690c30e268d5fa3a7370e6108e1d9a1c14ad818b3fc7320623104bd140bb4b55eda895afc8c5621aa2ab30401a7b289a91382b0e58ed9924db5b1c1b16' +
           '74a1572750c11a82dbb12d1d7c7d7ce17c713d8629822a52a210eeb527c8578a7994ee1313c13850c5d5ac0d1c9e76f494df1569d003395eb0559de1f6193b39' +
           'c6df439d8f6fda5cf72f8487b10433bd1640e728d4617c43ad5c120069826a62be17b09faa9ac2647a38019d13180bbd6eceee19301025228a65fc05b2f09fed' +
           '5a2dded1590aae9bd9477e8242c7ec762260cd23100a5bef788dbd1e61efbffb7c2b17b9bb97e024211f47e4e447a6829c38be56ca0b567258f4304fb6b1d640' +
           'c00a6f49fd8bbce164f5f33584149d6a05cd98837d81493a84fdb29109713dd805d3ee73d72cfd7ee6bb2f6f2c7302585771f52bf2368398a35e2e0458728899' +
           'f8547acd7ac7dcb856ca301782b4265a87cb5cb7e440ef32e8486ba76d85889cc57fb46e36611d60b11314febd234549cd002daf414ba3b28ece3ba8232e0430' +
           '4d418758e6475505aa857fd8ca9dd9989a1695c2c241179e59a1be62fde1ede3d99052261768c771846aee34d9bbd2f5fb6f2ad8f94a5d9036a7822499180247' +
           '9239c59a957b957d1ebb5e46e0d5ebeccd36b5cf543ea5a6c065314b8f1b42d18a34a0c8931bd3b653c4ab8dd8248beee89fb2babb44290a98325ba1320daf32' +
           '6f1ae978cf8b7d1dd3829eec7394f9479be12a6134cf2f873ed631c75df5047af754b71802e9482ef6f9de72a303b77b3e17571654faefa5cbab1339a8b6f33d' +
           '26405e4263da694fb3386daec9362381371c80927e2e65dbf31781b908454d3865dfc2deb20db5cd19c48a8c4a43f7225a77be154e9b24d89be3e0b196100a8b' +
           '0a55752ac5c4eaa10865acdb6489cf54015eff5da2ff522633f56272738c0bf7861ef963223270afe4be6f706158bfab414c5e72f6bb093d823d7a7f972ec10f' +
           '211216159d5394fb903ae23a0739dd88d4f9335e78009d1236faf7f94555dbdaf2a06b509f58d7880fd3d3c1053a529261b4686d8f7f89932fbb7dc3873b95b1' +
           'a182746d542433295230592afe1f1103f811447e7037f45eff6fa7678e2b4f117fc539a1f4350ee431bca79aebe8be3755ee3a61ec638e2f05a1f6eed6a36c1f' +
           '968cb7be45d9b50c07bc0cfe596c9c64df4df08bc04031fe1ae27d1962a3def559cc110055b623cc55a6b35bd4d0ccaf91010ca253e07fe5afbe9d66e62e0017' +
           'ccb79b1339f5f349e8f3ab3f668ddc64b2f27ae747f409c8985e4d00ad918978c230c3c9a63a506c887fde44b838bd223f1a6ff91e265707657c99715c762911' +
           '2bd03a84542e1910940d49457993ce8f3cae2579b6afd6bf1506653e7eb92e3b45672ec096607958f8d7433d95eb6f0cb07061ac45bc31ca917846764fb1ae69' +
           '6bc3e9d1b7689e25ebf57c2c76740b5d0b132900bd65044a247b6cf5d5299a99d0c552a58cc4c2990bbc99ed6c33a172e63a95f89fc53b5573aa865b60224ac5' +
           '17245de5cddcfd86438bc0a4f721103626704c6d8b4c3721ad3b68707ce0d9741cec0a35ad78699fdc5e74b97c272db4c2b1cfb0e80aa2e708df37adb56440ad' +
           '2c659b390086628da110aae74c385c3328a59b09a6636579b90611c59cf6425a66e1f65f4300d652a9da83164c60d7dcbbd936920cbcc3a7e4abe558afd1b3b1' +
           'b9107bfaa95e1ae9dfbe03cec684d5768d997701b27660700e4b519cffa8dcc1016e711a1e831c82f5b3696fac4424faff4e117b5e1b5c04faaac0c898dde2b6' +
           '127fa6b42aca9b2fec1ad0b1a755cdbd906486c9a02c489e6e74c6c4907c4ce7bf62c3cadff8ec7ce47cf77aa9f2f81238e17b7f9797060b62492376e080e014' +
           '9089790c7916575952888e406ebd345a2cd32a63e197faf9db9370eca7822f3a0f57b687871dff304332480f06983976f9b94ddacf5a2000891054fdeee90e9c' +
           '761e81e2247069096d3d14b53b59cb7d541fdfe8cf0303735b2dba0196a5fd3f47cd07cd8c37fc6a67d4f18e7761e9e2f893013d5cd932c657dfb952fb316afe' +
           'dc20a2f2e81bbbcb803761de909a5beccfcdc88c1a32cd5e132dd1d32604a83ede0a703a1c629c3008428b53344e90c275d76c728d7f286b707908193aa0145c' +
           'ab833e8f48e87a18b5dc58ff595de5b68f8cc673d3dfbbe9385385ef04e5807f13246cc220057935c05773db37431b3ed6c810167c99d84d975900c8dcbb3f6d' +
           '20f05969d3231d29f45dffc7eed3f7a596ed437ce42df79d8ad7cefb947990372fb9b9b13c4b98b65eedba5982ba50cb4b650a5516359405e47e07026e2539ed' +
           '4cac45546bf8cc97ffda2d8432577963e48d62ce955a000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007564631d0b0d61489e7e' +
           'e7b8356585019dce2b43d79b9a207e4b9be90c6a53c1e7280000'
    },
    {
      set: 'FAEST-192f',
      file: 'faest_192f/PQCsignKAT_40.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8211a18f506f7d78bdf5800c9f57f6d23e29475d6ecbdaf42cc0150f4dc9e3ee3ba',
      sk: '8626ed79d451140800e03b59b956f8217c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803',
      sig: '285b3affd827e75e6f5e1afdf1ab5b6223a063a810034c108540af1960a78bcae3c1d4ae29a3aa9956eaafaa7dce8a46e91373c8a1a17b081158b8b545fdf42d' +
           'e580a7a2ece6028b0c763c9b9d49c6e47352ee972c700d40e324d384ec8698fc99cc8705121eee2c8fc5ed43a50a0730ccdb3e3c5355bec2670ca009934710a5' +
           '5bb82606c78ac2ed114fce95b42064d2e0342a6050ea9433cee7f7b3e51894520dbb9b838d7566fa4517d37a43b445b856f3342ef7243a8b266745bdbf82746e' +
           'bae32651331a541034a47d54fc599eed29f66428969912baf9b8b8dde01919d30a9d79a6181d6660bb67495cf04f0477702be34ae60eb4650af1bdb1d14c7713' +
           '45b132853251858f463c1d18f77743104373bbb6bfade53cc46e919087c1e6c93f4d288db8128bc277d512dc9dc3aa63f2eff91f76bb6c3ff962339738e5411a' +
           '7a2a8e9553f64f0172a2c33d6d0e79a506096d383bfe37ac6ebfa1e62620bd99877127675ca0f6c529247b8dcbae42b553075e6663763ea2d3e449940b272f73' +
           'd5533a6314385e4aa70c4356899f4adc8664e6485c7ec8dc145c1e8f6145a878c57f79c879e1f8638a9e03df4cb2d7c7693ad617f7df370fdea168bc995e3c61' +
           '45d8d798e93d4c553c3d36cb2cd0edb8df03a43c28cb69b948de88055786f0d16e947c22cbd6546d50bb0e2280145eb5141fee437bbc0721b11bd14e4b85f766' +
           '417e12e737d19e131eafec46fd6fba9958f4688e079cca92cab2043c88090dfd8994366a25a65675ae6183bb0ff8b8a9768ab675af7590b0fef42eb2d6d8869f' +
           'a66df2dcd3313578760d33c82545d3bda0e8e83685bf4ee22a8f0e47abfd391683f7ab5cd3f783bcc81fbc7ed455d554ecc32affe4d7e4699db2aca3fafb6305' +
           'f328cc9160e2b8395025578eec78ea632c55a9eeffa758b4e6821ebdb9e97e5405d03d4a3b722c30524831be5892660a8e61de768e349a71f945430fdcfa1841' +
           '9af2b2de89fbf6388b43674a21f16a0e898bd8612bb75d1b3dac7188fdb5cc51f40326d13d19df72e1f665b23ee54fe39bd836e5ad0343734d6566eadad642aa' +
           'c8476f8dd3cea2d47730438be8dcbd3c1d0128b169c6f2abad90cc46196c90ab962352193c6668257e99e315eec69ed966956c26aa089df21e77516a53e24c6a' +
           '49133883fba57b990c6018fea6ee417eecd8afb60e63b2c636dc849da9b3104f62fa2bfe645f3926184caa95111bdc0fba6c2b39489da9cea1c3642f4b4ba80b' +
           '55053c68fc2b20b74c39f31ab0b1230bb4407815e716f1eaf3907ee4a16ed2d742fee2e0b44ffd4d593abb3eca12c1b39c0fe46ba4006da463e709ad160cf2a0' +
           '07c6d8925c84079cad185e161b56bd4ff342aa705c4b01eff2ea3994822b36ec5ea8dceb6a2d5e15bc67213ab2223a4fb151e6b3e7faf089f7ecd756a4f8a8ae' +
           '8b8d4d8078fea56873edb1787bdad7cc0e7197b016b071a901d191ad7634ae1225ea25a6b6df3f4db3edf23c54d8be9e23ae3df4c7a7b927990c6247f172e218' +
           '6300dec51bd51100bd18ca3050a2293fd37c91a5221d1a062fe388197474446068b42f3aa0cf86028e27f058479109191dbadb510ad05716ef430617639a37b5' +
           'c4ccf2d9fa78ab7c6c5c0284179704245aa6cdbf08a86498a211d9e29b97e11ea7d914bc726c0abe0f491106c5197c740bfe285a7e566ceba1dac54925d228e7' +
           '4eefa4cc3eb88030cc86d121598cf2422725c60ed7ea5a6be0e563c05c8f2f4f680f665ae4045cc3901d8056c17c83ce8f14f0d14a404f196a8fa22430416b33' +
           '8f172dee5afdca57c126cb8b07aa951ba1cbd3fe09e4c971303a44e0a8cfd084f49c869b912ec3f27af7e14743e96e21594682a719b11fe360e1a7cd1fac7ff9' +
           '18dea93372a21a16d27622951e7cfd364c30a2657667a4d48d93914e1b43519f81cc0dae4aa4a1bf58f916cb1826eb40cc2fa5a108094ae6e9e0bbd96e965c25' +
           '3cecf68be825d007d0487153ea3fcc9e45f44dd067ed25df361440a4c70d6ca834d6ff74a0308251c33a0b1cad9db79b2bbe450352a2e58ea035c5afa47b87b0' +
           '65cb921b2cac2d29483bb147c40095247f04d6b1daeb8ceed6c989c60364cbf6f9a3fe4c6126b4ae0ffde4f82fcb3ef4d4287eea378372988724eef4fe7d430a' +
           '382b95bf119d8afce3bc928cf455710857181afc028361ae5276cb904fb75e531013b273f64ca9b00c1d504d48fe0ce1e357bf565cce4d34af653ba71370b318' +
           '27fa489e9899d5938bba22537068ed4c5d60ddbe8d1f4503217aa50dd6257994f0b0a09d8397e395d825e70cd34aea2af39d6de1d3e5723c3b60b419b4849d23' +
           '8908ff0eb77a43c6eb3ff50877dbe38f67f777750c3a0a7c4a738b87bab337d3d90dba8cd8a9b4e637652608e2271833545c8c50127288be47239c8c71ecbfe9' +
           '8ae4748ef505ae5eb6b3fdcae33d62f28ca13f66f91fbf80422ff11cafcd6b6fd7f0ae504f6c224f62e145a2a6f8db8a57c96c09f89d4f9f23e9010571666d52' +
           'dedeaa9f44bb945069f9e37358c49a4e642f4b94ed4720525f6e7f9e9534af81d14a543272459edf18cd67ad174cc79fdb1d10fcf4dd2fb8f8f1e3c62e6e0385' +
           '68ff8978391461e99a694f97015390e4b3504453cb645af3ebb211e37506b233aed9a1184fa808e93c0f0df08844928babf7f3eb06973b4f744ac3659a42180a' +
           '5cf29aea05a8f79ec2be7dbf25632cc382c1189fea613d109577f151e2b22e16d9222959df8253a75bdb80d1efb1901ddc66ba7395808e69e6828497f2c41f89' +
           '4e978e6609b8377b87326a3040b68f440f3d74da15e7ebb369026fd63a02b2b7fc7283bc00ccb70d7aa2cc238f21e5ab70fc27cddd0a41e952512bd973f9399d' +
           '4039035055edd075a47ed0cd6f3f1d0ba6b09115b168211ec45c2dd230115b7a3373bc28f156b9f6cbcb8b0eedeff6fa3d8b1201d880bf6d6763d0b6e2e84b12' +
           'c6344d979bb8e9083f4a43e112ae215d25ad71a0fb7a852150d93808ddcfab89ed9bf8a28dee4150feeda2fc7c3b3f6536a6a90298a3cac22772d42ebe035a86' +
           'b3b70a00315c9b7f097b21d7934965219fbf1c14667b716e0ca8b519f26bf435c8e7042b9b283df367c634d1c974b5a71236ec51155524b7115e9cf036d2f14d' +
           '8ac41f844028731586c9da4012f6858b0736e7f4e4e547b29f848684a18786a8d85d7a8f6f3bdfcc8bbba654c07ed3112dcbc45e763cf515f9966e9935f3330d' +
           '0503c75e1057d8ac638d4c2ed9d989957bd12fdcd39075d5554ac224c3684465d188011bbbd64bf58a2712060b9f4854470d4bd175dd09a84b6db34c82213d36' +
           '499e9fd09cd520e4d6bf6d22d58207cd7c7fdea481c3f80406f36123a4e7e21bfbab77f995c0f276ee0e17cea95b9a0ce2bf4a3dab55e01c836dded4fe1b37db' +
           'bbe8045afb602a511c06b2568f6bc444fab7fee39e7aca8ec5e38af37c7de4cc9b70ad90318232005e621f73d54451f2b3a02e5bb158f130b68c3fe82320c6e9' +
           'e52d96c08580690cfe43c7be96dd7bf3eaaefa86c176ffabab775043b60a214d8ebbf96b0fbd797132b1a613f4251497efdcfca0ea34657d491ac13aff41e416' +
           'c5c6d1da1890f6d341310942c40be69ffcadf5ae549264e5f2b7b69e3941dd303918d164c2d086cf5ccd2efc2c547da1bd883f3fc2ab4f8c0667706d3381e452' +
           '9d81a0e8b99356fad2ca55d4d41be91b3468592712596b4fdebea0cf9a418bef43c57b6e5b6ffe874af9268c914773cbcf6531fcffe431852adde5e2e52a5c18' +
           '4cb88813fab63b3043bfbd3ba6661e7ee99d97850ca37a673b36f5af0da507cf2beec65c65ce2145ab644e156000e04b4f5515c34000133a513e5c11be9cfcc5' +
           'fc69b6b73be8d756d879148146fe704bd25fe371f9157f1bcc9420e95dffd92d990a7e4cc76e479f03e19f7f8d6a855ad291ce4706db264798e616b095dad9e7' +
           'a95c075a04b4d183b2322d133e3d6575a6f5625e293b8ca2ab790857745574fd83766265bf01d412698a001fbdfafed1eee4a7a39b2be503d570f1934ab2137c' +
           'd521d53bab2239c779ef0d9c5dae0eec4458b79db0f1b8164c466856850bb4bffc62bc56774617633d57ed8de9fdbdf27b3eb242befbe7a5a5e68261c7db2ea5' +
           '433fa3598f24a6de8b517655008602925d675f138966765d488f2459671e538464e1dcafc184682144375665cea4c10b8e7db8a410c311b98b454d573b479bfb' +
           '7da92285b3afa2676e1e76150949a176c42757311fcd8c3b66dfc42ba9fd0fdeb45f10eb7b036154d1acf809de410c7775cadec88e320e47d21f65ee6b65802a' +
           '9be4ca9611063a261cf130b46ebe89362c2dddb3270050c014bcdd626ad5ca875325ae27af9b2dd71b7d2a6f12dd448b25f3515f968ae80b2aff2302d3884523' +
           '4e312c3e77bb715bedf21571d91429875ce57fb5631af5a86a59b9860450b3bc6d78d1442e43045fa8514aadaf61e33731eeeeefcf0f156a912cef5b4dbea32c' +
           '99e534147e1bc8118cf18da1783553b5e98ba5e3cdc8d6e0a7680f5276d3f7139e668f70fc2ee7a772b9c09c39f4b2db67816bdee58347787f20f7882368cf97' +
           'fc4655733c92e22a02edb7edbf3ae01ef2f5f8b62ca552082fd9fbf774f7dfccfb9bda3b95c224ee99ec3bd40a27e6574c172d74ec9f5f5c98fd41577130f6b9' +
           '93ee1eeaa58e06118257cffb16f9be53a2137f1be3c93cc36023c65b10208edd5dbdbce70a30bc75af7d5f79e81e6dc63198b311e38d5a6a3d80070ea7f07ff1' +
           '69a7ddccf4ffc0ba2cf774af719f2eee995952ad98e2a1bce44aaf89ac42d6d397f64ed16b6f8a9128d66ec98517e768eda137f08df9a10be487ae6234b89a9b' +
           'e7d9cf82d89ef254cb7514bce7da35de3ae6804ab7fcd123ae42c097e8144d2d410249ebd02b719fb3969fa8856fd39f0b5cf7a3d3e5b475f8f76a884ee89131' +
           '5586bf70671eaaacb8a98b6e18c9358901f1ec10b3ae03c0d1edccdc94074be1e8331d679691ccfc8fe4b74c133a852d4aab23d8673d723c0b2ae7ea23e828b4' +
           'c9cf12502665067edb5277cef1e938cd399bbbc2da0581145f2476c05b0d1fba9a89f14c7fb7d3ce13b29762e5c330ff29f14e1862e8b957fe4160deb9f3c69d' +
           '774e05e441edb7a36e6a9bc85ee000b3b3d10b5252a518231c5c1ae6864b4a4ca4947bfc7db142c57b1b5dcba2b4d38c82261c40dbc49337fa7a1fed26371b6d' +
           '2c87ac54ff5fd9551077edbfd1e439ca88e73f4d6b658f1639d1b1838bb23694a9db2a3399a3c4622e446cec208bd1d0b438e2e1027059e948fbd021fa7a5590' +
           '99d7ea724dead3afd13501c693e4fef74aac430cf458e49ddfd510a8b68f0c347d591b5ae199742704a0e7e052fda79a250bc4724502d3992280e41ed0b9fe54' +
           '5a6b6bfe50cfd8f84e70033ff8056340086c61e14eb3e5c3d518e95405629d8e3a6c3e9d8162d3c2b536cf0e0bc75b06d6d9047e433c94157663a0d61a6944b6' +
           '4386ac1400e1244fd6f69281d674570a376c776d9cb385d984edc4d55c1e599867da9f7ddf20bb603937872d887122d698e5ba922bb7407e3c7840eee85b28a3' +
           'a5f2564d30f8bc15325106393d08daf53df463dff8fe56cc5fba6fa3d5361e6351be15ff977c5b1d1d3b1518b323e29ed22257292a0de6e3af173fc6ca42e9a2' +
           '0ec9c204e8fad1416aa2bdab7250f7077cc5a08a7c42c96c7eadcf202256f6842f2e38e6a0daca352f564299001c7d72d46d57d3d2e4c47f9a4c5d4564b858c5' +
           'ac1dc1172dd31bf1cbc0d5e63fe8f61a492ab9935eed3ea3fe847b504983596adb4fceb84a10437e7061df1582b5c7b8776d4a1fbd179c60bc537f575de6324b' +
           '02541d4e9e93594c9c78f4664dfffab78c4348fc8cbb3dc2ea81e9cfd88b63f62e1f768bb29deb4284e001bd5235111f1968337af088c006c403603ae738c048' +
           '3cd1740d372ed9fcaa2c76f500c2efef609365e10d52c33425f141171172916111a99a14293bf454a4c28c226e5f969521345c7c6301819779a3d290bceed552' +
           '4e40101104bf6d384cae73289917584aabbd4bf6feec9bb27b1cba22f3bc1f7d78ff8bd9092744565af710a3d2ec729730d426cb95643b31e45629e926b830b8' +
           '2c982a4159448838abffd8626e888e1379b4757b4b26d9c22242a7126561e845a02ceea855df6e4ea0944464a7a2097de13948e8c40e84601efd9b06ef9bce7d' +
           'fca354fa7bc6ca9676304ef4d6f9212a17e15886513790187d108dc4d55e75158521538b91787ba4e3959b275812b8ceadd223548c7d9f6e15fb48b731677811' +
           'a0d32b53a5a492c5c52bf286120d0a77b39f60e463eb241d76a4989e209a832a1eb194d090e671ce0f13c84bab813cf0b6d3d7ca616c233553fe1d030a347018' +
           '4a31564eb069347ddd867560c304d6fe80c48293732c0d5d53901262029b00bcc7bae38ceada45dbbf50daa4e44cb901bd9fa413a291f9dc009564174158237d' +
           'ad0eb2583a627fd655514115806cd97785435c7a8d184f6cbcc7ab0423cdcca99a953eeab84aa69daba3ffea098d02e5498a5e7c37ad1eb40ad7b19d4236739f' +
           '05f3dcdda9975aa64baa73cf1c4dbaefd45c1a43e8472c2692715e6a89f55125ec1d174278121ddaec2581844ff3ee32f69baaf2bcb4968d84b74309f030372d' +
           'da14a4f3f41e65f161d0abbb19d712ce61c4d9420405c3184f006367f30d613ef9cad43e48a23653cde5e0a52ca1f8e304cc22d1819a0334d3204be74cdfb0ac' +
           '53842ae8c5d029c2975298a4b019fa6c9944cf8c8b905a53771a7cf965938f0d7948d28cc74675d79384276d69c8c704d248262e87ed01b65f01798dd192dd83' +
           'f778bdf36507d75a9e34a272f2fc067378617086631e3fc1c64b9db9a10973f56441fe034438abc14592420c40bc715d1700048dfb2eb46f9af97920ab76e1b3' +
           'eda4ec18ae837d86486dd91e8e63eabcfb84f291c440798a873b6d250f3b26d3e4a8c04d5606c0b7dbb26062955c6e266f4ec49e321865df5d1c1d4b4361e4bb' +
           'fae25ca7e86f92371d3672165c3a297054f20611ccb02b486a42f3a2f2d90f2782832d1839f9d936acac0491bc69d478711f093757c11bbc11938f8cf635e920' +
           '2c33cd17b814ac7744b48623cd218596c2a5b843076d0fa18e05e8cb5879269a1d2e666ecbd89015c23de5f508b8c96781a05f7f4992e2306ddbc5e3c4906233' +
           'c5ead3efa7075372b39c505f550ae3309d51cbed05bfa1d675c5c087f7b7feff43fda42dac483519b8a57b201e0e037d9e19685ee53d1d39ed520ef814b31fed' +
           'd9795006afd4ef214adfec3c52ebac2448ba01fa171521efae39c498dcfa925544900abc83ff6fb74e9631be0e871ba8ca3ea8d3b14546bd06b9b2fc7bbff3b4' +
           '8f362668f4695619daec0bd13754dff4f05863e016909a2dc48d4956b52607042409fabbb7e5aecc463562064ee7feef23fa25ff4540a2c1ddfbacc9a3ab9200' +
           '0a27cd5703f5c4ece6a2b98356b05cc0c5a63a8c446ea91f7107aea3f42c39ab299f3fdf20ab0c7db79c93423026f9ace8e919f9339bc5a168dd5853ed584a35' +
           'ffc68bd7490d02808814cf967b71024a78188364f39ecd0a0bf88a06eee8c851df9f7b0004a34bc6c6ce9720eac728c31cacb13faaa5bfee184be88d9b03817b' +
           'cbf7de0eaf0759cb00a5eed62f24b79bf6b54abbf53eb751c0db768dd6c31b45da783c14b391f83929c7cc2b5c653849aa1b2d390bc5732a7f1e477f87c64c8e' +
           '910516307175a113cc55a1b9283508b92425bec0a495cb80f6c971201c05868a41cf528bea1451812d5ba53f8f5851f1aa8a885278ef2cbfba450029603445e4' +
           'c8433599a4066b3997ca82274b927ecf850fefc7a58f5736d3d5cf1dd68b7cf8a553f47a410b7c518a3f5180b137bb2ced976b079569f2b59d26fad4e598f31f' +
           '3cd3409c0bd6c14c592d8f9584ce1956353ac28f48e8dafe59df7b1cc9662c879c2e1ca3d5c3a7b10618fcf13c02daf730d8d72b4628a587cc8c72c1b88361bc' +
           '464d4dd65041941de2a5a8ffd94160e8e1fc0c279931bff73b0458844001ddf7497237f21c653f2cec75c9f13da37fcad5a80afa77f8827278b0428a03f36414' +
           'e8b96a553c58b9745a25810ec64a8d694f7b215a8cd49fe2f887c291409854157b493507dc41dfc2ce7669cd886529681e1b727e41d697c9eefb36538fe6906e' +
           '4d7795e4f98d8c9f3d5c06da8f975d36604db58fcebf96196347fc0001bfe0b4173abb6542bc2d7c67f62cf3a1b9c7014340ddb8da010959282e6086ef858389' +
           '583e8b61de4efcd2e4088036e6c89214d97034bdb9bae4f30630cbded5599bb2f8c73ab325a53603945e54137bf2bda0ae5eab9141b5c6e631d6e620be07f116' +
           '97881648035c77796c0dfb3817ab2019913574ce3d852aa268163f343fe9aba416253c93d290dc6c59871680f8b8b85d7ceceb24a69eb535dad75a55a2c4ddef' +
           '4ea02c92c561a6fe0821025a02e924be4dd92bb1403b2ebafb88177cb72d39731a08e9080ff8882785e2c7e0fc09aab0166fa74f050b53755946f8251aa3bee6' +
           'c9bbfd02edd07be4bd206f96ecb964e9b98868ce2878b202b78b3d3d39fe3e47830a26dbcae533bb48c3a598fcce164390526a8bc72027219b43480014be8c28' +
           '7f90f20969235606bad9d01eb28aa77ec27dc2d035c671f31ae7c43d6234e3862e6cb47fa5d25d98252c6aa2c1b7a7a9f14004e0e709ed17d6c04fbe95342b7b' +
           '51f721cb748386e0b87c2ad087c464cfcc4da0c611e4b835025fdcafb87fe9564d0fabad8f6bd0c90577d239982b9871fc7cee9122f8a15453c4ed0ef9248efe' +
           'a62d1e0cbe670be178c4ad71e7e69ea74840e9b70120d71095da8d3d835013b7663ebaa200873282ba7e0e58d2e732a37a8ffc7ce51c0a7ed847403aefea626b' +
           'd35367b26494ebc8bdcff9812570cd9acf94e0af80e5f0255259c54fa8983580c05649b8b9a26bac558dc3cfbb860c6de9905212b5401045394d8168cae01516' +
           '69f6c26bb1313b04522f3e590f61058c6980f61ab0165c1a7cbbe683027fb4b678b5697cbbbc49e6b766d2a4de0ee2629f956391a85abaa50e898b863095c354' +
           '00a7fa3a2510ab63d73b9b66bfe9bbe42fd0bdcb30d2e5371dc39b96ec0f4c1030c45a448480edbbc4ecc264f0d82b2aae02fe3af2c8f1d2bb2ce99a1dfc82d2' +
           '5afa90ec07b6701916827438aeca4e0f69e281bef3287110ef547ef763486e741aff45ec1517a820332f3c6271cbf88913aef110b10678aa96f2d8311ddac5be' +
           '5e8045e724f485492d359758aea00c8fdf89d3f8141fd37eb32f3a03422dd8c1cd9291f558289f36eb855a833e5da93a3ea945441c104462eb46e1c8d5c042b4' +
           '40dfacc72bbf2f814d2ff6ce1b8897698f15c27a5955d9aa0d46be185e67f8605b9d42d3658fb15796709a75b41ac23799eaa6b217e8190b7ea9275b569a82bc' +
           '78ee72180d26bc41b00b988cf478fa6b9fc746371cb36d32deea0b1f7360ef174bc3e1002ea1eda169795fa9846b1e7344e4edddcec665e9fa34d9d24adedd4a' +
           '119f95a8a28152da62684c7034b5087a1fbe0f064795d652cb2f617917508d40f8eb0373856cff0202f0eb914280c7acf3214be59dd986ca312c1afc58b6666b' +
           '392b761d7ca58da6cc9fb6f46a405e42337ae3f318c07b76537f8cd0b39670bd28c9e240b85c20f09f328260a824046cdb6991647db74b8a0dd1544d4c059c09' +
           'f9244599af52b29b07b6600f634787fbf17e490a1b88df8f16d18f36bf5e40a670890da3b01296f3ef04eb3b4d6714cfec6dc1e58fe50a3012ce8183b50cb04a' +
           '36b68c517f601a6d7dc10ca34ad2c79e401970cc2a0daf12897329217dc3699d44f7c22e77661a10a1c0ca9819b44a333fb6d6b79b8c665433e9f30dc4886893' +
           '6afeb8992ecf0352c3be853210cbfce90140ee19a7392b6c5840676b2d55acf162c1e69b8c73c60197d1a0a3f6b0735d4d58956ad0a21f73a9430aa4eb0e3675' +
           '3be59101a98c0db39bd660c0f98343f24511176aaac926c3dc0d02cdbec07724f01ce366a7bc66f248fef7a9942d220234bbb0895dd3449de072c21826483c38' +
           '210bbca94e69f6e96b71939dddff3f880ead0827aa5b32cddf2d09984ab26777f4fdfbf4416e2d9638dfebd5cc8312ac4350276830630bbd273b9fdf9459b739' +
           '0db4b92577299e3099462cebeb04cdbf50a4cad731457a942f05430649382c111af53698c3c47390042be2bc6ee85b39764c89fa9df6851bc7d9afa1657ad350' +
           '99d13e516a5a72ebc5c4cdc617e64aab06540692ce0b1fac25430bd6f58c03995b68b99fc368661288020d05505c4b6c1def46f15c895485a4ada2ab6a1dcb01' +
           '9e1ca8218d0f2d0a8f602be782a5dbe9eb47db817bcf6197b958becc7582dca672f5e6924f9ec60b4147e397a9cac4bd0c8ec6a6241c931299999e272e4632da' +
           '27e245f624f2ae85ae1f117ac55185c8cf653fff956a85ebc47fc674023182946cb205c3b2d36c147e9bc9d4c107e7417057c8c404f73eb3f8484d185efae6f4' +
           '440c89408bc7bccc550919fdff8399b61bfa759b06f635d35dcf51285fb2d38b37dbe976cf389eff03062bf9f423788417e405788863870212a613885cf68f3e' +
           'dc3c69b3794bff5ba6bebbc5e6a8da746ef5940b366cf80a16b209e41d6c6e5808ac753fd08847e79ec589ce3f8c2e15f5616d458aaae1d573f05ed0e2527c05' +
           '4989a8887bb45302cd5060df142e79ec29c495c107527d289c711d70de75284283d3662919cc93add046919ace76ad6ecf48f2a46333562d8ff379561238041c' +
           '9f62035525e6afd61f0979b0966d67678fc411f7a588fd850427910eb71a4d35dc5a65447c0719fc1d1777e4fb801528f2093644a6c1d230a7939c8d60eb9936' +
           '47fbc5069a545c513df2e2d4b09348cad1de09dd2000d37709140b228aae0196ef57d3464a433e1c93d69980d492e5b6aa510bf726e5ab3cf2c303daee144611' +
           'e757c54edce3966a13644cd1806da3e40f2f75901c235588f7dee2e17918fac93c8aec08d820355af087dcfcdf6580f1a59d8a79b106c64c95ce274d802f0847' +
           'd78e1d0761e2666b0180531733b9f5a01e70a00ea0e8586321d11da1454d1159c4d4cd6723c7e126965d0b5c8347f82d9c64f99881116a4f07be90761b209e05' +
           '09fd2be6a57a472368942ee3e9a72d15a7cc47502d8ce7e415f088af21f4c76a69d3bc779be3d46f939c0aa59783c8b003740833767228722516e15a50f5d802' +
           '12c91c9f3f2e5a8c14e1b3b0dec21a13f2043f8abe4e15bc0be90f99a10839756038439265d1b9a1e72e072586fef124b3fa299042bbd618e0fccb77a0b85baf' +
           '6e20f66745fe64be8b5649fb415ffc73792003a04fbf341066ef44b0244da6af7aa575c48c74489b9a199cc826e37fc348a0a838ae341e3d3296568d4bcb1440' +
           '6e500b99d11232005d5701c5d65ef524ea64e716332f5339ccd3ec3c251c91bd35757c8fd4db507e75578f662b9ee75981be6f90aa9092d8db80d563c0cd8697' +
           '80621283f1efc577c91fbbe33ed91af7de8e9c74f37d9dfc6c1247d42305b946db473dbd3a493c49a969f35e032ecfce8d31597c59054996801dd5e2323d4570' +
           'c607740410dec718337a575f34cf10f774aa0a8703855d5a8c99cbfbe00d42592479d29b128e5ff48200de7dc675f1a1fa07b69e5989cba1c6e0fbd7854f67e1' +
           '77d9a9a4eb7ae3ed01be6ab38ed1a7acb69a882497880d1ff803194d38609697c8b8a15f44a82b892c89a03b565e03220c309b4fe2e30d389b11c96c822505ae' +
           'e47d6a2701b640d79d6790bd5cc9553d51d058422446ef1498e042efc2dd4a9c7a975cf663bfdbf3911293a0dc8e1bcfcba817675674f4cd008b0a604ad16783' +
           '040e3edf44614bfa6c62d5406ffe3716472e78de901a296edde01553079489925d7dfcd5f7934cd871fea3d536ecc0a3513f8d89a1a9b1e2c1dee43edfaa4ff2' +
           '2f543deaee96078c17464d9f56706537240200248d8c0aee1ba8347de1e41cca773a006316a0a7916e1b38ab40f44cdf3bb2e5aafce2ea47ca3a17d520046a76' +
           '7666ed328c8b489dbbd047142f89a3e7aaeb8281388fe46aff236237b9a25a90c548371700619f9873bdaebb02ae23bd9ba502f718236f9839a155d0d6a218dc' +
           'bc669a1ddb951e6eba8987d7ea20bb96823a33300675bf2ea38a5d743ca0511cf3001a5f635ddf7aed95917f8ed445fc3039433008328cf6c84d9e8be89da469' +
           '7e8eec5a658d55a7b3ddf7d1be4928fb1f49a1b6e8c9c94d19a343fe79595adb0e9ea3ac8fa7b1834dd3ec5c4f6c269aa8d270b4dd4b0ae64e0f25fb23e45e72' +
           'e31f6a42c91b97a97b261f1f9bbc90650540beb2baee2fbb1e3707b315fbe0cdf00896b78481f9f5cff648a282f5bc3c673458152737fd9b2fbf6abee82243da' +
           '787bad11625cedc7e847883ca74d97ac6ab3ba5cae6bda8d9716cb79afdcbcde4eca555d001774c4fae3aaa508c0e8da40aef0e6b2fa7649ca1e3e213e736440' +
           '3d747fbeda2898399d736cbaef8353d2a2bea8fc9cac6fbd450bab9065665d39ed3fe6cc84b591006c97890d8ea40def3a6464ed5ffeaae8369f9423b50a57d3' +
           '54e79f8b5e7bdb1a394d0912122793273200b25d8feaa3e8cef8ced2f6bc4bab6f991058957f12ef187840bb2704256600f2ac12d602d53143fdc172be855ec6' +
           '7d5462b211ad9d68c938fe84351cde658a988a837cd2f1eeb353c9fbfa30a0acadf48b288361d237b7310eabe9097569260d7b41e27c12907f04b69dbca9de4a' +
           '5830867908e9db8b946fe97d107f89eb37ad43b576a39ae9c1db5d337fd6d7459f8661ab9cf5ada44259001dcae2aa072a6026431827c499072bd58730161423' +
           'caaabb2e0c8bc75a1c63eafd9a60b122dfddf004b19b01b0b1be3d80551f1cc57f8c90d9bdabb470bdbfb81fe9746a2d7d607333e9335d5f2943b8c17ddf5798' +
           'd3d4796abd315c5313e667b310e11e713cc91c75577ab6a049cdfee89b190c0de82d7ee84bfa343cd417ae72bf413fcec35b96c5582d666dbc177bf3795bb806' +
           '9036965e46e1cf6fb50843e5da6f6b689c131e2344f319d5ea811711d89c8d6e8510bb4b51c96d99ab98809158551479d33bb718c9354929706dc75351fa9d08' +
           'e2df3b28f05a1aa529a6502817a8892bd575cd13c7d23cadc75ade6a7ad05bb9494c91342b1f473813a5fcaddf4fa807993189812c6fc50c6f6cd961f054a834' +
           '639d4917f68c5e86e910cb9810366f3cb28040414789c6e40287e42cd2708618bfaf68ba8e2e4cd1512199325a66723e0d530a636de15b3502b343454870139c' +
           '1268f9fccc831a9bc61b0dd0ff300370eff3a693752fff2cea4214ccdfd605c04dbe7aee1df357928b211a77075b1b1a8a99bc415a57c7049864c3d04f5d3091' +
           '016c8c2e380310a396bd161b74c1adf8b135fe635f0cdb4bf7284cf7cc7e9e0cfd26667ddb7d0111a2f8676658ea7b6f0d16f3ef3115cd2ceb3fcd134155a564' +
           'cdae5e9cfd560d6f454a39af97f4e1be022721c02431a8daa8e1bcce2b94fd4248bd086ea323268197e41335bce16eb6da1da836fcb0612d4f61298d2e3c01f1' +
           '4ed2cf6595f8d3be26b87f08af203c260ce4f0b62880f1ff724df155598482f1a0c56183796980460ef4590d81a2609899cfb908c594a6977b4d95e5a932d0b8' +
           '72ee8a4c188f23394b9c1da9f4f6a7f42781a5779b234d8db7495132f318d8cf18882fe45bfdf4a79de66644bda5d8304336719719acfe27815bc4feb424284f' +
           '93ad5760b21d095a91d27233b50f8247d1303d205b8cf85ffc2420a8bba02704eaa90e42fcaa611e012f5ca7d8faf86186f2e71ea45ced6065dca1aa3b86378c' +
           '876cb3043a003820ae7cb8031ef13482ca5243c7bfe22c4acacfaa54acc3610ecd7a89740bdbeaa51ebd39f9dc01ac66bab8e523afd60019b32fa5c609ef2e8a' +
           '07aad811cfdc41f4deb580b0243c827f920fc60b516aee4f84a850ffd69e14c22edcf2c84d1334eca7e89d71522b111094bc9a52fb1002278b32c2c31d7f22c0' +
           '3b5ae07c7fc0c581bc70049fe048199f61bd60be6c143bdf8a31ead682c1c64f3942388a7a49a018f4b266bebdcea0cfd48c0f11051387ae147079b0e24ebaed' +
           'db2e6c7bcc1d006b6cd0b88f0f178a407dd6360f63c0f6ff7834f210ed312fcaf37188e4a047a13e80fe826d9da1bda4eadf47e80886eb1343b7eaa085ed77ef' +
           '46496b0aace5649f1aca1c469e1e296a7932fe001c9c87c02ccc4eaaa79ca35ed1de3613bd6b0e619ca6ebec499289e907cdf19e9eff77ccea4c3dc865eeb959' +
           '1fb9d8730517fe27df60d4e9988fb668a7714cf09d4c0a99faa00d9511ca105f46dafcd88c7d268efe9bec3cdcb38ba2f98b82b84429f7dcf5bfa6d8f30b2dd5' +
           '74f5b2f667b98d4b7c108a074c856468509ac5a7c773e89bae9135f3dc28d48eff8acfe1b7127f42529b0db7c6ccb86fd87e64b2518f603f272a5165e549e36a' +
           '64af2ad2e27ee03b3a703c824763bdc23ff9d714e5ae56e891bdbe4ad2f4e6449f1909df99343552d5c51d6f5d9ad99c53de64495052900c04f3386871b76382' +
           '2ac15458321413e23a3b7eeaf4c3ae2f8b4d56964356facdf57a51ae2a309bd894184082f8899c42ceff02d16e020dd28a10cae66da55ae61fffd86985f469e9' +
           'f6536acecb6bcaeed997e8e100413feb43f3304bce4a122c9b66625534a2701dc55b2a60738a9ac956b40657213eab790ce3ece18ab4127916c32464138fe206' +
           '3ca4afea0b6e37def74386341ce9c82b92dade9bda05e6dd92c356429084a9cd7233fccd80313e70e99989a0c7bb2fee5334241289434c32a9541a83f09a06e6' +
           '80f8555138a5adea3e51b54d3494a30d846b6aececd7260e8eafb7451d49fd831410a364edbf3462e0b29fe0f502fff3f26e9b0143ff0e27eb209f1b2565b08b' +
           '624f65ef689a9100e70090bdf6b93485685d07b27ebed8de5af49e957b9c9d65ff62095c08547c20b965b5914cb26a9c7f2b4072c7dfd92e6074552d7012c36e' +
           '20608125b9fe94bccc2df6ea6e308847ce6c8f0bcb472148b581ee13b4c04bae34bf6a674ad5b110aff22f0ff08426046129ccc5681abc23632b1e5d9b41f581' +
           '6100ff06ddff46dc3bc09aad38e8623e1b68e089596201ba95297b58a6487819f4eebc15028cc304ac1283ca874c29f2e481fc7a7f50de6682216aef55d14782' +
           'e0f91cb867a7f738410eca305a453113a398e20858d65ec5490bc1351db8156696dca84768c6a8a5464f64c1a4a8e0ab2b4663dcdb9e9c49dc347391a008f31a' +
           '6517a0145e6bed2391b9da802d955862123169e8ab3a909c1baf936bdf56a031a97d7831c8bb470b767edbb044f2c41c92ed10c3a655fc086fa8c10fee33663c' +
           'f7369844a3d2ac582e94771f3a3ea969a8b9f11ac88bcce8c4c23f109bc28875d5ceede25ccde1b368c9258391f3429e2469298707fb02b208f5ceaa1270cba3' +
           '51678451f86ea1ec65c8adfc12902402d2c3a176a5373f033272002e6935daff38b36639599a227e495bd3a32431fe70a8b39320ae704ddb23efaed37c5e9227' +
           '8b2ad4b6d7d5e758a65f30a7ba64b5ac9e3094e5aa1d8871690297dce976c34ee5ee4f8c236e59d3cb15fad08183431b6179925d3b2df732fcb6e8cc45ed9612' +
           '74b524a99614bdd549b31c31cff13ddded25c25ef12debc7f1863cd1a1c6fbaececf94418c9c83b445a48ed0608d467e037dedfc34ce4063f57bf60690c44202' +
           'cd77f560819cd11da8be18f306ab06694a05c02be40264ca113b43b381d38c2058ba4781822a2fc4051870c983e72e84e68d03c73a8135658034be7f4059fe51' +
           '500ad5ca0ba2e6783be6e81e9e4c05c3a98432c645c83af7c9ab55c3397cc7ed6a4f6d6587a9cce56f14f5af8093cb898398a74a971e84e718815f1b26cddc17' +
           '131df4e9f1ecd65ae9218c5c4190a0b43a2b8d47b095b2349d959e9c50aa1f35a538618d3769530bee914f3c968ff5e1e09ccd7d39c4612e6597d6060018f6e3' +
           'ef69d1cb2852d166f7bd3884d1de09c2990be62f0b569cba1f7dc446bc4682ca276afa7a57cf8e87f763d93b1dcf034b5935958af78ed37fb96d7839295bd836' +
           'a11812eda9d2fdefdbcecbcce4796a046b7db2e17194276325ecddb9f09d725ce340af3a5c4f01856777061f73fe07e54955afeb9f08b637d5cab76abcc88e6a' +
           '3666eda4cfd1708dbc0fc2d9ffbe7ec47dc9269cc4a098c162e74ad8beb92eab0e2c5830fb44a72cd469327ebd80c51e10525f369d8dc79ab569056b758f6268' +
           '690e693653ab3e6c977bfdb6f32acc09d67813be3260d22968647dd7e1ee47ac35e95f188dca5ec44faa583f7771e949b55fd07571f8137f3f8243bb8920f42f' +
           '7a9a0710b66d91d23b410b98709f4e69a8e9a957d2081c44953512f314937ca30878ffc9f00a267d8e8cb976309886005a52f5e49cd3b4b0c9b56ffb3c315517' +
           '85beae10bd6c5973b4d398882dfd1702cea2ca2c1867548353a8368968b40e1b273828bff515a3a64469430fc9d63490a4870e7670f4e76869c75e49c5931d69' +
           '1b77c65ca530e9910e364c2208c0fed934cbe7123076d6d80ff9365d96182ded48145201f6f1bcda6ab08415170c114e63d224b2c919a3f704d1460db5beca50' +
           'c385aaaaf4e43ed3d7e16b25e93649b9630f344c25444e31cf3f18cc411b9e24d885913e4b0c4de8fd56d006b94ea1e768898ba210142ad865b22cd5d3002258' +
           '496886ed88cfd9fa391a95e05b13ee6d8dd1de2023fe22bd84fb0ff514571fd030e573e025b66ca9db56870fbde4261b0afef8891ea46fe6ba29fd5aad8094ee' +
           'dea71d60d44f35a5830097838d970fb133a3b69a16a4807a93521aca450aea4ef64148654347c23d31b9c866c6e11710448671a131e337483b376ef41d521268' +
           '3aae15650527fbb2cee51bafce1d6f139ecd8ee00a0104764638107b7be5809239e64aecb47addaf1e4fb4edc1ab5b124bb9548c428ac1868bba0d7b0175cd51' +
           'a1693b276c304fb62508e643ae2798c9005e0318d0ccc9229eabe7b8873e00815b9aeea9c719f5c45b5d8ba74b06cf877187ff740592c267b230868157bcb9ea' +
           '256ba0a49a1c5edbbc6ea82742919fdedad80d6c1d6f9da093ec61c4c8efc539bfc902629fd503f8afa115f0c0394b7b1dfa50045d7afd1348ed465299d4be4d' +
           'bfc9460654dbe9fe9e0eda95cde46f2a861e57f951aa8a442a73c54a06d1f12d57af912f2a22934025f5b6290a6938ef29777b0e10e984bef33c8107078c3d99' +
           '81a0f030d11a8a99076fa8cb9b869577e1c71d28e7e6c9edfd72faede882bc71cf0647c8247ca89ed3d5f12ea0b4ab0d200ac4fa8df0b8bef79490a3a894fee7' +
           '706d62e2765bd463854ef79ae31d6d9185b5b64b925b76b18fde93b628500596c5fcc2347fb11320a108ac66434832d7495f1341db2eecbde7cf1efa224358fc' +
           '611d79f07edd82d8756b175ad63c85d982d89d8d84afff25d9be0384e7f98144f4d69bd0e2c65bc4058990f845a3194dae2f336e267ae0dbeab6fdf458561483' +
           'a624d577c5f604d3e198ab4b51bca7922acde22858ebf60301768259a01e3408bfb7e6c718262579a277961699d9a55ef98290df7093f252ee58d674eb77ded0' +
           '7cbbb2bdc5e775e39382da88ee918ff6f8ead387bd4ec440222879cfa3fd9cbfa8ba6783c1dfe9c95e3e82ddf2106bf5ff255c5594ad2188740a8856d1acc66a' +
           '373ce430403101670ce880aff7efa1b5b431a63c6f2d71412935d7f9e4ed3b4c3a4a3f1f7c8fde4efac2d19fa30ecc6eb4e48ad72afac2fda44787760ea16014' +
           'a4ddb8999bab5789e24df0b163f069f0860e043a4c8f0b81081257f9cb7af79ba70af52c0819ace96823c3b43d4b6feaf8b159ac3c00dca7b29a1443b2d1756d' +
           '7e4a019820e36584b891d90d7905f8eeeac5740e4d7ae2cfce752f92a3380baf576a3c8f5a22220892aa62b3bc1df6e0f6d74f11579b801060c858872a1b9cf1' +
           'ba7e1fa752ae8ef8a3e1831a92223572aec2a98756a36859ca689fcf874b15b9aa2eb2a38df70dc04955ab0e8a7991438ddbf8e4e898b85b320c6d6a5decab9c' +
           '2980422b5731cdb4b69524f83ed72ac37b5fbe5b2f2de5066f900354fad3959b4db5e3629971165bc083bd97402f03c42f51720d9fae472f7eb9d7eafb302d55' +
           'ca9002d4bfba0dea9dd5984f2d0221760fe01ec008b862e93aab231946df73c07bd6e498b70ada90084dd6ed41ab77c19fd801d89668aebf875d429a9b867a19' +
           'a1e4a1bd69b5f84aebd27e4d309fa83fb25fce1fe46a9dda9ed5beb3ff0187f5f898a8e2de4621f11b3bdca31207b41fc0af39e004f0cdb562252fd2235e473f' +
           'd6eb41a7f6ce34c0b28685ac5204f40f2f3e8c720d3d4b6505a8f49f3624d01275e8a4cc2ed956af6b62089af00d3d98ba30ccd03e7cf6fa2029ef3669a5f024' +
           '2b2c7e4f479e83c5c2c5ef2f87a0952d03f651dd4c3bea5add857644dfabceb9491fd50c97dc6fd7b40d9c0adc3a62768cc9dde9cb4f46356926d1277acbaceb' +
           '2713a17cca79db57a0bd7b2eb80a58a8ed7a4c2e3518f9ae0cf0f5363b8e730097c2b84d9ff86f3002b3d0c161cb8f9481feccaa57f12635b4466e51e11ec982' +
           'b87ae0780681207ac2cb901327771fd3f6a97ed3adb7b915079d8a41ed9802cde71a2732c04b33bd5b04fdbabe505b4ee5dae91a86fc6b6a4ebae82bb0d4ef83' +
           'ed9b34bec04a7a43d2e8dcea5d8d9b732205502095dce4dff4edfd8ba5dc269af7d13798f395e03036753037e54a7c343661872a0f5bbf9fb5de039427bd958d' +
           '0c553b47f0201a4f24e59777dec40014eee69da52733010737175223a06442237f0f7d5dabde4df1b98742bfb3de35de3fbc9f66ed7cd140e9099863f7a90133' +
           '5270ac34e28498d9860e89fd9188bd1a96f9b206875e18ba5774267f514986a6b823692184ad92c44acf06ba9c33aa406153fe06cbb325fe040c2649e7adc89e' +
           '58a3201814b89f1e26313241f49320e2d10d1f922b232a8581b2fff6b976865f060cd68cc2afbdc5095c90a7a4205e5b5d78c3f712501b1f1a42c34d944c3a17' +
           '3a15b1c68d1cb950c12b6132d765e9d49c41c1705f5fdc600f596153f25c5c9839f21acff12878b76067f87efd3add88c0444fda0790e151b12da981687ba0ec' +
           'fd28bcc01449481e1dc7b85b1289fcbc85f880d6674d00a800b265066d9a68ce3b0994f4ae43d9bd232379335b98c740eda78beee4de255cf52c78d8e45cf0da' +
           '22666326b1f4393b5b43f4e3e2e14685bc2c33d81ff4779f3b6fb763d06d615d7bf186e572f53ea833201f84baabd308e62dd867604a2fd7da3695e78f0c1ccb' +
           'd098adad41803a2e984e3fc85594388dc3e2650a3b68c7ee9385f5f01dd67f94cc7be2fc4a68e37d33a875a4eaa7d3d5d29039b496994adfc50cefd1b37187a0' +
           '61357ea22e384f07e313f95da982bb1d5659a797bceb5432f74d3e55c9e6a429569e9987a625a0bce5f91ac8974592069f9048c071215b7ef9a45f7c4f9e205a' +
           'ac6c83e32885115f25c70a2cf95e32dbd31151a597d785f118e9fc33ad6e3d679d35873f6a942ffd754e47b046008efe2ef19d7984f3413a8c84515fa63306c1' +
           'a923d3e68ffa5e766c72ef0d26bea08da93fbaed1311536b9b84770c38a31f90b97f4deda95a9cb49339ca395b400ad3ec1c867853f8b9b8752d41287b650915' +
           'c72e1892d7e3cd5e36e765e9dcb5f2c7728ba41042da5fe23834157ad68d9b5e1cb1636291352c36f3a6f72ef13cf31858b9e1f4ef419b1c4ed8407336ee2b1b' +
           '71c43882aae03ef85ad612c8f4353e146c18e24a394561d234f7ac0434688dc045bd3d6aa362fb99f9344c0c282786143357922baaf5b3f35a7ecb05d83e449c' +
           'cb485d83d042619abaf5d9ed7c4b7bbc6349b1f2b8306a351d37c5be20530f470dc59baf4b32a39b810199b44af1dca2374fc52d9809217f57c6dc59c0c27150' +
           'ce08af8d49f578ecfc18bb00038a82eaf447c15936b2e96e4a3e192e04ef6e0604a9000f036f9414b9dff6004abca2fb4070e689ea038c8f0325aceab2c8086d' +
           '8d1aabdfc16dc18c70a9086e574bb2754af76ccec1798342d123ce7bb269fb0ee7d6975c9031300f083e43a1566fab167d0bb282617d456e7e4cc1e23f974a16' +
           '78330b985e3393e61acd905f5ac983bd7aec3e9d5fa29f8a7e41579ca8179c5f132495de3eedbe7e56b2560cc495a22e4a581100842591a05880190a262683f7' +
           '88dd382eed29a27504ada48aa15863e6550b46155e8fc0ab2be0502b65663fd03621724389aa60013f668cea581ff8bee3aec9f17c5b4a98cff3892cb5aa1a4f' +
           '3c4033aa471350c8bf76f471c25bd62e75574664ccdbc7fe6c9a4b3b20b384079f7d32a0fa8327a5bffb575b248ea18d8774c9aa30635e610edbb042a65ba9d6' +
           '268b4c49da1ebd3e1e479d93801efca94999ad99ab048db2562237388b5d71384051c5f0d58b3786fd799bd01dd1ca2a276908c63ee030a9e7084d569506a7a1' +
           '7f4eda62aa7a06ad282784ff63a9534bd3af5397033d7ffdce54f06bfd23b57850aaeeeee66b67331fd9e0eb7f31605c161c71de3a7388ac55f934afcaccaf74' +
           '9bf0f30d8cdf822ec5e45540c24c3e109d32904a3713b1f59c740df185070c3f5a86c807bb790041fd0edde13304ec0615f452bcf4abc6a301f34d1e4fb850a4' +
           'c16fb8c0d6aea5ca85ca7f5c10a98826017b7dd108306b8f97f6301407cff1bc09344f06002a52fd2da84b1ef95deccfd3ef51b99696148c76ae40885e84b3b4' +
           'c9fd9aeb29b251233e8c6518a077771b9fdf012171fb2291f5f3763885ff31e1e4e63e58a8fd286dd6df8bd832460e8a5a7aed289b0ce5b41ce3c7389b0d3a93' +
           'bad70c3c41397d70afa224cf81f9a1b650c2354704bb77153a1aad94f45551d4fa2c19f8e160db1d7ce2189832897753bccd155cca3f71f0ae97bb20646d8ec9' +
           '20d8b1c9d3a80b4e138e2bb3b2519c008737eb29965e838c335f3139e02786355a010000'
    },
    {
      set: 'FAEST-192s',
      file: 'faest_192s/PQCsignKAT_40.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8211a18f506f7d78bdf5800c9f57f6d23e29475d6ecbdaf42cc0150f4dc9e3ee3ba',
      sk: '8626ed79d451140800e03b59b956f8217c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803',
      sig: '22b0f5adaea8bc7a98e3bf9b486bb0922a9007aa8a3427a0a2223cbd8d7a335e77ce4ecc88d91ffc11ed09958f4256229fb44ede0721307fd06c0fb1dc29acbb' +
           '65d9f5b1d2059956d59cb5d5faad98344b1f44e173a6cbd289c6c9f33c0d5e0eb3f137f7304490ad4ff90afbfbad6d9c889351a65cfb53797728b6f5d1acb8db' +
           'ce1db859a77209f64e137bf5467ce27fc8d2c1198910f66013b5f328d45ff417a8a1f309120c639f5b6ce6516eb1144c3f0e7f544729ac840718dc8ebcc9f465' +
           'ec45126eec6648e9b6275c868dfd647620c1d79d5e21ccb7407f0db7ac534811f46d692c1770312f3f74d6f70aa4dea6624383fc579871ed67b83253d683b34a' +
           '3406d94541f502a75f6f5adcfb25091632b66c0b32fd04f15665b334fa6d7f315a99225bf853ebca5e13cc3d673e1e3163ec8da7f40b044760969b2389503859' +
           '64f87d9f9f306d1510f0e04548e3e9188c9a3c517fc1c11ebf4028e4363bc26019b4e081063a3f8f40131869536430fa11b151f045f96cd70e311c3e46688434' +
           '3698301af2a771955e14ff6d6e9a479aa0bcb9ea06a3c75aedcc1be799ee793ca24f3ea46ad49556d1ae6a41cd183024e049112f98367d2d0b588f5d471a1f3f' +
           '1ced447dc7f301b687e81b1747ebba94dae1d2b7730419ba287c1edf73819f72b0a4e2a333778b678c9a6eed94da00751cbfe1396d2c80979b48c89e79aef94a' +
           '7a684593d12f25cd1d96b189ea6111ef8c8a06d2cabf1beedfc209b1f544b03d758a35329aa9f74b50736ddc9029e00625fda62e05677833c5c17506da54c7e4' +
           '269e03eecc5518402a425ccee9ef4a14c1a42c2ce6be5418ddc8acc189030491f025a86f3c71d341cddf17f870ac65f146acaa0c9f2ebf1653586b95877cbbaa' +
           '1907c4d63409a556bae62958408812e877012578c7526772d26e993ace03d210ee86d760e159440356d6d8ec33604beff82855e6a6a1c04b12faeb071f2a13b5' +
           '50c4a85664868121328accc1cd682bafc6cd4fa2b58ce6d95e126caf33302b8d3f429b4f3817ccb8a1df39dbf12e3e919ab373d203e50764f434a4f36ae72641' +
           '47c66fd593a3522af05feefc806b5f9dd71e8121580a6bc323c1a30c0f6808a1a39adf40b5f8df5844342e90b494433f930f35094c15b9f623c84a55d8030977' +
           '36c689bce574ee62e393552afd21b40074b55992f0c8b7576db074f599f730e3114c19d99b97ae93a31965c9552b7998f6ec8928b4c39f4b8baafde4352688d0' +
           'd8b75945ccda5b5fe66a7fa07840ac8758822951df2c04b4d475ed3a0882740bb0400512a2d9c86a3419383e3ec879a99d118e4a63cd667378e2ffcf34b99360' +
           '3b0edc3a29bcd3717df8dff3cede0ccc1daaf6c6db81a203048d22a65838f4f26330a7a449e9c129c9b1ae3f52975e9bd9115e6d025f7a7a7b7cb34c12b12800' +
           'f1a5bc2470dbe398f7e7b1b0499308d56b3e8b9683e4ce800d6e60629ff0fa4aa217c95f96c40f7936a5bfcb27232af3887e8f0fe8623cb432d7f95fae7be61e' +
           'e3c92adaaca302e0455e87317ed3dc558dfa77951b17bfd525e70d35c20472382d4a1ea938727b3efbce73bfef41e495747cc29d0552fe33cd7de741de4ab587' +
           'a527e38c898d51f45e4b1524789771c3b42f7a161a2d21f659fb3d2977bf1c1de736cb8d9cc9d84c1d65eb38b36217137e58400a4ab6e69583a273e75a0db205' +
           'bc8113c493f7863a25cbd52e81cd1e9f85b7c72bfa0204a0364ecae4559143d8f62f71c1acd229fbd6647a1d76ca70fe846c74984a62410cdc17015017e6380b' +
           'ef950a4fd1d2a8743a06e74e676a581ded7cb452682a5d223cb2fdb1fef1230a051f9b8c422a45b04af71e00d630fa40cabad2efd8c7f786a6c2a7207f40dd89' +
           'b6d50705a004ee9e43aab55f608813cb413eadda5226e3b1e3e5be3f919b06cf6121909bc4ed795cb840391d93fe5b325bd1a90bd6c467b33b9196ef579fbc6f' +
           '051f4f4de00e3717782f7c8b745b832e9c217c3171b43f2f40a1841d9448c9d4f41ea99d92132bcf72ea55b377933af8dd087c1a24591f8b18506548de2e22f8' +
           '9593288876c99d23ae55fe22b68fc11e8b9a9842a0c4c76c1d1f8841a87b0f9016d92711d1f895c0847eb50e179a0a6abe1ea2afba2f54e4afb970daa535fc4b' +
           '7153a4a08a88131f78df57d0719a0f36e76da58d001469306a306c720c0e1fb271a9028883cb17f46d554c68f4135efd3387c0d666e6d85c06851d5c06ea188a' +
           '5b8d4439e3cc4498a3a8d5bc7facc344438211f8502c083d0875feb50ac3e0e7147b8637d6aa3f6230bd7593fe0e022c83f1e7e9d949c7f2b02d76734add9a7d' +
           'dd0ede29ef4ef05a1c39b001412659f18df919549f0687faa0dba83f3375b5af24079bd0952d3f3ebbfa32eb35847cf3c9e93c8d2676f2178d319076bcd7f9d6' +
           'b20beaeacb557855a604f506897ab51e21bf06453a32dfdcb049d36e50be9f16c42fc8840517d686e69506a61a58458b33ae92446c8751ce5f4788cbb6ece084' +
           '532e97cd67e9de30c01e8e44f4195428c2d6b81a8c7128bfdd372d66412a5b46f048ff782387e8e920892860e665548c6bb1f481b6e8ff10c49aec9b7da51347' +
           'a6ab141955f9ab1605bc4c55449916b07da0c19e2abd3f40d8d0c3beff3366d28cb1d0152eb1506c79899c3ab09ce83b0049a73f63edad9ae705365408430111' +
           '0b70116a8d70a8cd8b8fa0f50397227d336cd197aba6c299704a4b53abea1ccdeb0b88a66d4803637ac65db0ce2d42fabe0bd6e619728ff982d598be6515289e' +
           '39768758f7a7cb6bd0626ea3a1b16441685fb18aa1c078e3a32170536e5c6b63877e393263c59921235ad0c741a0c77d8dcee151d84d8590e90c92b728f42bb2' +
           '9b6249aa4fda6df000845d5ea86f4a3bbac26253023865296aeeadb33d7938fd7983bd0c9fa4cb0c4714f499bf014e6884949b0ca685dd2a9055d24acb0871c4' +
           'fa5eb3c8b5eade1639a9b9d65b5c84a7673ff90163508a5fb8fdd4a3f5df362250b361bbf8f88a5014b8f8edd2f03b892f306d85aa6695544eb14f58a7821cd1' +
           '3f29a9b3dd3fac2b976ae8866696c0c14e13b837dd35998039c508f9da712b9002888848f5fa45ba285e661739a9254e949b52c7c288ce675eaebea45391de6a' +
           '2efbb6886d22ea85f722884a75f15c065871e4bace4628cb64ed8343ffb6d71000b480672bd88a0d6abbf9b5e8d858bbe811ddde48e41169140ad430aed5d226' +
           '7fe88191480f8f95b503eaf7a1f358f295d5b75876598900b275571c08d44192e53999de74d7f22ff6366912c1a38ec5b46c94f3064631e50a4a0fd1c5d87987' +
           '6428ad8fabc98c9b77ba2fa13e9c49ba131944cd9abb2a5de33bcdef4ec84ba16a8e5fc002b7ea8ecb3529d4215b03000e20dfda60014ffab2985a6d33776816' +
           '2b48fb07d37c600d059840f86fc66a1ef49df4e961ab28382f872344bb3879cc9d21190a5353721fa98fa2a92725b41f356fd16395dcad672635f67eb7165ff5' +
           'e5d42e5e2e8f4e8c9ad3b334c56066156364303d704d610d71dabca43d21fdb80f67f4e227926c52290f5bce37948561f0c0cf52f73178100a0d7900224a29c7' +
           'd5bb034e35e69eafb32f605163dadb124178d6f227460fa0ef228148e52921d5a863933549c5d072230cc6ea4292a8f225117e0fcd8a7d5eab3a13ed02e6472d' +
           '5e53361a53968f1b206d7d442c2c29b65bc8f7d6847e9a30263091e83750a17922408d35f92253225ea99c49ad5ed3b0b1d6f28d5abdd816d3ec3c73415a9ecd' +
           '475e0fade8a724f89198abfaaf9e2082e9612b4c9a836813afa1bd9d256c18502d4a6bcf8029fabe0027470e1791d98eae5b13c0d23dd984259102c7aa933a6c' +
           '608776d8178a740c3236c6f5eb06bd70cab93408da11bd43edee85871e415a135ad872c20b1e53ec4309232efb4c3e7504a5beb6d43e67a46af63a17954829d6' +
           '77c6dd572710cddfd094d9a3c81985882e8505b9e7dcedc3ce82ca0b6c55756c28dae2e8e9df3618fa087c6b0d63953a26073a6b25c558b2c768a9b101373cb8' +
           '61c27f49e8b683a36cec9c7dafe25f9cbebbc4b342026eb246a4a7bfebb611635bfb0117bd010986e29e073fb8b02ae718efe3d4fc5e57687ce8083d49a8e166' +
           'be4956bc4b87248bae0814d75803d9396419758abd3595a92b3b43a3097291cfeed3901b2f1d63ca8d5c7ae94ea111b09495cfab2d7fc9072ca84028e9bdece4' +
           '174222180f8ba72ad5bc2649d07ac1b6c0dfd3affd74318b68f42409c4af57991df1a5c75819f39b82952f9c336c41013c71505da93ca3b97c45dac5aa9fb4ee' +
           '5efb6e4aef99034a539547be2660788ef5d0bc9dd9677ebe10f0e655ed936ad4c1aa0a264a9d407be4a5130e102749540b49b47709dd23d30f44ac9e8bd2b341' +
           'f74b22033acf1893719dd14fd4c5aa4da6352da38297b8a6cb187ee43ca5e78064bc4d997a42fdd2e3e871c8d4c6a30b8358c501f600c1bccb58cf2e1eccae40' +
           '0915bda463d006c348aa6ef2e5193a11bc42a2b1126620bc3d5b7d998c3d716de0bac8d1a1aa17a872fa3fd852a7e9007c4d9c8b4a760bd3cc87792284d5eae0' +
           '98ba5780d63aa7bb88fcf3bfeebbb2eebf1192b5c0b981b33cd75806bdb148e8b40bfb18c0153f881413dbf1054fe15e941ea8ed5e6a3f07873ee2e50b1175a1' +
           '80fd052b22cb62c788718e07b7b1270ab13fed6699f71e3698ae6245f77f5f3221d677c8ba2f6bba3b1455003c82fc4ded882119396fbc1e36a68a539d4becb9' +
           'cd0d68e2e80451708d537fe7327934c96b13a74e8e3dd3887e4b26d03d15e24720d042d6ea73f6daea99458a7bc5c1e5e10dd8112b2653e5994b70ac4f03b569' +
           '16be4cf6cb3291145eb7aa3f0a8ce49c0aa92c43d6ea4d14e30e84ce6593cccfd2eb85946c40a014ff7598e3b319f79408ac0c8a0526253bd0d381c871902fca' +
           '572f0071f3a952f6af91f8ee7f1c8e75a5f028041e66708cbf5d20bc397b9c484afe91ccab798fe1f0ff5bec34d3a032b7fb479d38628bcecd3f96c3543ffb73' +
           '6549facf330eac8103f034cdf0bb90aa34b9de0278cc5bb8cd3515eaf5e9c71b49eb8cb3dba234fcb9cde3e6cd0f64a28d8ad333146c5432647d00c8635ea4cb' +
           '315298ccc9be971592af1a9ca2a6a7cf18997922faf7244360e5e71c233e0ea7edd09cc385c6dda15c87dec9aef9ceba246edb9a5cd52418e663dd777329ea84' +
           'd74d3655c2296c898249a76dfadd34d12dc1618155b0ffbff075070f65519f1a1ffcfd7c57193a19246d22140f1dd61822bf9b94cefc0d1bfc0fde3453e53ea7' +
           '2b1a2385022a8b1714287304000c30a5b60fb375db53268ea32578f90fabc70c69723bc87a45eb78e7fc86a55d6acc2b6aa6ef40d457c1c3ebcaa90ebb8025be' +
           '32ca3fdbee671f323bbc667661fc9b0050263bf75c997288d5a81b806e71f3fa767698cdef85b70942659a295687c17da8edf9d40c87f1efeec213cad6a7a5ae' +
           'a4b16e239663713ae4c9b0c355ea1d8c8aae404f7fb395fbabe2d846eb53de37e65d3e4162b597a6bae5540b27aa31f082fc35cc44584c093c7de694abd388f7' +
           '1c2f8a69d95509f6fba2e2316a8a051574576027cc8c9a72224875bcfff4ae9b1ac97906835eaf051fdcabedaaa398c26e2051e3625bd4842e2d9f65b3a8c86a' +
           '2359969d9d347f1401d4a50a5208a0914a465819414399b29192572a282cf4024aff74ab1e3ca9c034edf730f06daab4fc60398ac8cd21d919b714895ab1b86c' +
           '0b8a9b151b2108c7b62bf3378e9d5e043fd09059259727542e0334a7fd61d4a5b6d47122c043b1f546e49e7bf37b6e8cc408547131db90a62a377524e9f9152c' +
           '3f415327dbb278be1c23c15dd6cc2395593c310b7094b154a0d89cb14a190bceca9d6bdfcaa1420817276984fe83e6d1c647162bcb2817f2de92d6c0afbc209d' +
           'e1da83555b31c69b1ff2591c69e5431a23ce59fe1feaf631e7d9bfdefcd677e4f458f5672941953372788fa19120153fb261632cd7dc32a84db4411b18998994' +
           '6f20818e43cfa3eb91b7d030aa9e922d0dc78fc779c4603179603deb85386385e19c898f24f74c84de81ad7afa6ac0b142d36573a9c28fc86b3cb3af1111b4b8' +
           'f13ae4decd0e537ddf2a7fe18a39080b4ebf2e37127b0e415d2c78b00746aabc5aa4b852365cd63cfef2d6ca16ab7126944f89c82f27c84c54352713cfebc9ad' +
           '5b5d5978c4e2b4ca2cb01d3d5d92e6c9ff1a3bc94d8066c7596cba4a72929f987acf81d880e759eafbb140258c73b3f7cbb5b70e3df4153ad54d2b1e4987f93f' +
           '2990b5759dcd0eed2e65ef8d820251438179f437b9a006b3f324f54d1525682fc435f27d8a0f24e58dc68db620f731fff52edaf5c14a3249c6923b07699c7e93' +
           'b694147aed64332f701801c96d289bf5381fe09ef1f17bbe58c394a7910d0567004661eddce095488f5134129b7d27172a068cddab7de25e5fa8fa60a0ec9017' +
           '394ba2ac1c13c5122d1a2e63ec1f982457cd9e607354bc4ac6965986779616b02895c4c8f287761404752ea6ae4e8a20fc39499ba3a0d035ebf8a7770073576a' +
           '29078ddfa7fc3f61b9715b7caa05a02a20cd07d270345a35b3541617d6eeb4e58acd1cf27978697143112ccc4ce7d8567fc77a33cbe90f74dcfbeacee2034893' +
           'c701f29a75ad391a72419d41eb1dd68a742739d9a1ec72b3526faa98f8628dfe2659cee763eb195d7764f6e8d1823ba447ac5ce1088058a425f911aa06a7466f' +
           'e74acd8c3083c32a56885a4586fd211c637ded5c1205621b4c11cadda5975e276cbc9e40a3f1129dc835d979dda10faeaf8d8bff9564afc15d128d29db3f1f80' +
           '69e7078e4689d79d4a31cbf9fa8996e372479cbc13ffeacba7ce5a008e2f662fd80eea362e86460df9d03b5f0ca1ef44386530785559869555a7908aea2b71cb' +
           '523f94d7c6e7fd9875020810416289c464b4b55ba12a03839b919750f303965ff1c7bf77c3d0394b9393385ee501a0198470b875394f270a1dbe12e28c525da7' +
           '770f10e69619829e43db6ff644c14bd4badf3820f1fbbe839eb4e35b5f38541156b462fa3b3979de4d5128df5e2efff55838c50e7d52fb67075f182af563479f' +
           'c1a8010d339f5fe87a91389e10e457a6efc2ed6be0dbcdf5651dadc00b2aae485cd715b29e22117d1d04df9f759f55a8b90d67df180353b7e8f342b9430b3be3' +
           '0d8766ce171ba7f221a580dbe1e3c29413fa6e4832e28981f030ac267d8372527b51d179ccac2ea70662fbd7d214f0c39d1130ae609a045e157162a0a3b3a6dc' +
           'f40411dd096f3dab4ef5f599f488fb95579662840eba5651c00ad10d8db49167700c44bbdb3e392f250e876faad8ac5283d0782eebf087a07df8be30865496f4' +
           '57cf3a881e35c84d97cdebc549749893f973fbad66324549811fdcee9859154de4d6c89dacb6f66668fb307a3edd7269dcd61fe28003dae3d3797ae88a88888b' +
           '085b69f0ec3cebddf3a4bb0ea42ce551e26e1c1891f7cfffa1bc45abcbbc06c6f997ca32230c9298d95ae3b8a57b3ef6878ed451801f434c2c90f9e23774fab9' +
           'f688e159d8a572b02c5169dddd14fc76e41770e23a9f8736d3230ce040196849aff0e57890054bf01d21b5d2f6e048a29802e1525c78c62673064c404649d8bf' +
           '372f4db370a4e1fa3b6f70615c7599fc5bd9d459caab156be86c234d75f3a2ae95c4b51678d1da2bae08606f990541e801c2d734078d7bbe306a8dc3848a3259' +
           'cb58d47bed6486d309d862837beb2feaf4f330cc601470a58b819027542b4e4abde521c384375b6a56d46c1ee1374e9232ae438c47bf727c0492dcbb36725c6a' +
           'a878e89e32d29baa14b8244bc3b6a5ff15c595cd67b891bfb16068c7545431a1cdb995dff9980f96525fd70e112807eb6584094f7148ae5eed33ff831e29281f' +
           'ba231f059741476505e895a0e1d1b9b464d71880425629a3379443446a0e36204d6ef632df171bffb424e189bc379ad014e865445aff3d86c18f715bde1e00ea' +
           '4bf43892cbfef85a331c2567a3733dd08c1dc794c997555446751047e702d7155b89bc866d55af08fe209baddb3feaeea4a5a1df41977cca6f4721b22fa251a3' +
           '61f64ff4e5fd9d8a30bccd0f81d73781b22fcb6bfcd514c405f9e2f3194f58d68aebbe2f3d8eea5503360c1007d47d708ea77e7ce66f811852600b90bc6a9ce5' +
           'de7ed092538ede797e72ab57849a3286144f06523e66897375847bd87c0a5e6d512fa7833ccbdbb42c6ae282fcde7149d51799cf556e7cfdefd214f19696f775' +
           '9243bc55229e69303237b3b3ffd5e92ad7c66bfaa374fe256ff8ddafae6f00fad6d073f1cc773e6154e2895f50a0fc19134a3282e901cca6fc9bd8c497c0f9da' +
           'a8e04fa932e0f7aafb4cbc4c1b9fd750e7680ac0d68af9db517a52aff558edf3d655ec6f6bfe2a789a0cee8e18d2dffe9c1d6b3c89c0437fc812b1fd69cade7e' +
           '6eec732776e7000f18fba2cdcf50319186793e0cfe658f9927c2a4c3210d4c0a008e343494af88925ea5ff2cefed869176331d0186ffa697581ed8bda0b2e3e6' +
           '2822f9ee5b9928aa2e0d8253d7b80ff9406d3bd4fd39fa68883af0d15c0a1aa992e7f27ae9f8f77ab5e29e7c35867e23865524e9265a109b365f39fc3123a8b8' +
           '811133861caefa97e64c89fdc09b6882ecd13ffeaf9c72bf9cb59f872b63e4f6a07069fb448a98da091e15a1bffc731fc1097531ef5ffad5a50692d0f98252af' +
           'afc2b4ed4ec4baca2347c852718726b61c59965262c58666340a2262cbcd749fdfa42c3bfd99c302be05d4da92ff247bbe6373d65423d25d250fbe2e5d180c85' +
           'f1d20a2cbd9ea230fdb1244ad44511c9e0e54adcf8073a12b8ad4299c82eeaf6ff4adea32dce1ca590db4c5c19f31cbd8597764e92a95553b317e8e3b7cf8b6f' +
           'bd1d34d94362ead27e04973b604f6517c0ba183c0ef4352d24dfdd609c22872acb15121d3ae20c222141eb04298fff2633ba0fb8a6bc156801c943e24ac9a8a7' +
           'd3313becf46e10f6329303dd870a609251ed56d072fb5f4a0c8546bed1cdcc0023bcc296d0c49c3a0922f5513f0d69bb4d1b4b1f4d71179531afd8d682809aae' +
           'e0bfff23a41cbd1ffbc0952fb9d086401a6cbf95df540b6c6f5ac07a67337b13d466d2f1a68ac906b022e52857d1420681607a5621d71704660f3a63d8cf17f8' +
           'efd213d5e440373accc51eb1f882b0f07b70d50e6a0dbacb4b011cb0262a5b423dee6fc1fe090412c5859de31f5fb81ca2a829a49ce49361b88db65611b29e96' +
           'bcb91dd6fd01657e775914dd9f6124f0ed505a04e0fbeefb6aea809ae9b990cbcaa87a03dc5d6e9f1ed75e5c2bf255031546e7315af9f84e4b78c29213887b9c' +
           '1e0c9c79ffffa4817ed926a928165fdea8af344404f7c45c2bdc1a16068695fed2a1ae231f944c5f0e781e1845075f3533a0be7f501ad1004836d6de1d9fe8c9' +
           'a9bc3ba236d67bbb8ca1659ea2a0b2da078776722c4da73de261ac514adca4e255221144bfe0b47a362c84097f59b5a893bbb3c0f31c86d5aa0cc026982ecc24' +
           'cdc83eeef39dc4d44116801537da475c6d3c138b213faedfb71c0185f30a9be505d1062fc4206843cc89d1bcaa8ef347914e8d27007fb018354ba51b914d140b' +
           '83709866ca58c9e35d815aa9ec8cfc38c7634bbf9053cb6a29f10b1a70353f138c568ce925002501de911e2748774a90e1240b9feb35b7a8d38e03cee92eef21' +
           '8cf6e762d6b8b79e14f8487befd0754f1f29a114bbe67daa926189dd96e9285afab5eae40a17849ebb3fa21dea64bea723f7a289c285f73fabd16ce17ade5c45' +
           '6d7ff5e6622ea54f605233618d14c549579fca567dbcca8b0feb5143c4571a74ac9a7a44e95012bcbbff93743b02301ae10518fa4c08c40c4508c6da0c0819b7' +
           '24a18472e1a6a7435bc07d30278c59e2ff8d3b95ce9e1049bc210873f1eb686b4fc6cc8ed429903688319559a3dfcc0b7e1be9d9c85c5a6a7e6d4241535ca8cc' +
           '39ad0489505749fda92482d2dc9052ed6d16afbecabd3090523ded7b1222a1a29e0e515e5852ec9208dabc63716bd31df8449ee9c4ba623d820a5e2df30725cc' +
           '65adcaa0c6683c494ed5004463a652805269a037ebd5a43a5a9fd820865c06d618a39969a77eed41ebc19224e0088dec052aa0adf7b8e2f8e180369c2d1e1158' +
           '6be418968324bdd4cedd62ce16cd1cc499e9e56dcdaa03bdee096938aea6147b6d5ae6fa064e594f87e3b6a448de55d2070b59fe7e9ea1de8a5ce0020b23543a' +
           'bfecc302bf2a0928177bbdc9dd20a407ca3334dfb80472ea6fa14fa276995d8d170c7a6e1bc495b12ca08fca779e5f79812058ce9e127fce037d371f37423471' +
           '739edd4991be19a16fd6fc2c0d5387baafd9e5fc28bf053594edb00c942bb2bcabba4ecfd68f845144d3e7f2c074aee25a381dadd9f8055786436ed8f2bc2749' +
           '25b0e6b70943ce71848e2c76b17adb1f98a63ce2f06ed234830a94e63e88d541c881ba76a2e9bc0359115bbf64f5e2c59dc1ae5f34588d72cce754c2b0a542de' +
           '6b94cbd0e2737399a1d81e72852fe63d0ee0f3a33abbe82ab901482d64e0c958f9c710d6f6dfd1d6754ee5afdb22b88175aaa4f0faa35971f6494f96e61c7227' +
           'd4b84ea4657fc70d05f46e143a428c17bd468f61f8c9dd4327160bd968c9f60c14735d79250b9bc090968cba87baf2fff4021106dc00f22b3785ea95f5b847a4' +
           '8c1ea13a240a76e4df73a96061f83913a22b68d70460b6a434d6ecc740742d794908ae43db851ac0f1fccd3263c0ddec76a42244a4c1231801c1bd37860e5851' +
           '5bb294151ae8622d7438c345229ad6e01dce3ce60afb6777730afab2ca3a951459ab7db1c741b249400dbc1512c212d1971dfa0a0747770623cae4bbb6622704' +
           '79c9951c0400e7895807082f9e94d920c31cad6baaa683a6abdf840d37ec39b76d14b59b3c2099d73f7525ddd31fc7adb6d53a99a394a341fadf63cb998b327a' +
           'd8bbe24397681ba346a267f0868fb87e39ee98642f7272ec20d5ac0bc85a53a7c8ecf4b922d97fd1b16a2e608173498a757b59dadea9d61d4209f64878f41c72' +
           'c90016574df56f93bd9217c063da7cb70e7ea4b45fba6527fcb8463af7201722f651fb20d312bec8eba2ec4e912cef56e968bd3d46364010a436131634d64768' +
           '457c386aa4dd5d4b5a91526a9f6c6eed62318222098503b5519bee3f54a0204669bc087f3da27fd81b141bb5801a94f02050b2dfc2d5335fdf41ba60e5530340' +
           '7a6b454e8f4255f59c1caa3f57251f860ada3e4b843442d2b2e61d59a04107a9e99d519f0ec9f3d11b395dc891d661749b11f4783cd0c1402f4ad6f40d6042e0' +
           '0cf93341c0e178a73ddd830907cdef4180e7592286715638a784ea65584b51fed7ba5292ff2c6b62ce01d115271ee1280a8b96b4de0ed2f16b2ee2b20bc8e593' +
           'd3e73f0227adfcaa3d20b53a0799d434963ddc4eabac1e1f7f3ab6656e3aee1c3b69fe8cf8c8b9bf458e4069a7017492422efb7e27b1bfe03c2af744d4a764b1' +
           'f6af0a6b6e0f9c70d5abce3a445de690f3c6510474a3e013cd385da573c6f4474beecf058506b1cb7878b90b7d0875c0b3aae92edb56bb0970829682fa0e8f91' +
           '62bf04f64a0f6e476d01fc80babc913527550ef2c2808cc938ef32adf6f103b7691d85dff0e4e513d4a69112af03899286da113952f72962dcf2a198a1dbc0e1' +
           '7c12d91e000ba86fbe78bfa7c062c0162f3383e80e4a6756baf44ff1fe216f530a412939a9ba86f4a843edf98e54fa80e8499d206927adc64841af2e34356701' +
           'bff5100a329dd6eb8d9afe030d298e5a48600ed5968917535ba8bb373fad14942d98bd41bb383007d9b5ed0656ca9932a6c09f6e46b7c226b68b14f04c728205' +
           '8227d0fc0723029d66b5e14209e7aeb5da2abd880d5cd2a2c2656e9509e6c98c3fe10b14e02423331023e147e5fb7077e5854d6c73766de1ef93eb25b3e8114d' +
           '637d93e47dd804c42302b39a6705b33e484408391e2242a75d11ee523ec923eb903b72dca624d681ff5182bba1c4e87b9284b677e48c66010349703b626c7905' +
           'cf45a997b0c3d562afd205b4996b682797feb53d776dbbc7049253acdd859d568ba0568b4db3197f65c0649f21edfc176e5bec56da25f1777d4f1a3723db8817' +
           '542ea09d4a40b53d577f4cb2a9a2bc95787f860e7d3700beb5bc04ca0f01f920e47d5b313c8e9668dcb40f1d5f850309bb45a0c42a1969bf8cbdd6d5a782855c' +
           '67ca19b23978fc752528631804796f359e01805097cfce5aaeeba711c4345dae2c1a3b8017e61b2e289fb416a884759d6f9bec0a2712d802091e5eb310658f55' +
           '29cb76ae54951584003b419bd37bb3516eabd114247594c2fc0d0f79093b2134fa8400fc37e10cdbeeb89a8107826cb3cbf638151a4357b8909fd281f8dd9836' +
           'f5582dc4c82a5b709496eb907446c05778f1d192cd4b001f8ecf74e320a69c386129472db7df13b0bd76bffc21eb0b2115a6136fe12bd345ba2f1d5fe08090d8' +
           'b3979fc290c688eb10546f87fff5e23c10ee2071ef1cc7da34aba5f2f12ee393d02c06f5cfcd862cd5cf48109d7ae6300bd75945665b07f6bd0826ada8424a72' +
           '0e364c2208c0fed934cbe7123076d6d80ff9365d96182ded2c0b16b78d682472aa983dd6f174fe16e604e36bca9194e2c5a59a83040559e0e4a6151720dfce96' +
           '67f9c53c7eb363fbae34539ea7766afabbc94d98ea78b2035d7729eb8de342c27acada85a804b85992ebc38577f86c25d4138cb5d1b84699cc9af2065dae3bbb' +
           '0b48fed5575656f9169ec3708628ac985c74c397b8a96772b85175d24a85664790c78835b3c69362b2a5d03daf5fc912c7e4497f5b518223f4121ddc94a509f0' +
           'b2044b6b123a3270f028ea70006966b4f57ce30aab14f61c7a37c13ea60f51c5bc28049a83c226c06862df67a3eeaa742d6d073939dcde22751a4455a56b8d3a' +
           'd1a4153ad30c21775046fb78e84fc8d6ee12209f7005349b0962ca50f9329f3c2fbfd6698ee25229d42cc18e3d4992384d403b22bcb3b1a9ad635d3774ec3d24' +
           'd2f956b6ba6c1de7909f896cf5b0eeda98c461f9dc2173275025af9032de0a8ef02b11968a52674c357a77b1a3ed3b660e95d399d7b296587472381483057c69' +
           '854ef79ae31d6d9185b5b64b925b76b18fde93b628500596e3317a013c7a07e0c4f713d0438acdb038d24d3dad4215350837f0147d4ba28c7bf2805ff0f2759f' +
           '6750bcb849b9bd6aaf7941673f05e3597efda40ea07de05cad6462976ca20b1e37dd797516b0a41fb1b53e0d89ebf4d9dc29d6a6a4e50a4cb51a6450a086e3a3' +
           'b8ed5be63cdf1e40ce3fd4fe98516fe6141d513710aef3676fd72eebd0213cd34c4886a800dc41b6ca2c77b77eb71af288b5cc0b819eb937acfc3b1abcc59474' +
           'fbf4a383065514928f0d2f0daeb068e75c8a292c9d4c843808e67d05e6bd1639d344005152ca4ef4a6a72fb2b2e1964664b48fe3df3390baaef5769716dbc0e0' +
           '1b7784e3f0468407e4df0587737dcf8e34fc002e5e6fc8cc9afe5499a3064141ef34265145b8563fe70420148766f9aed8b5d9b58fefc7f3280a77356f672e95' +
           '11c25f914b50c0e8db630648c903a94c8f0b7b6a81cff9407973aa5c81c7668f42135aecd5b4535f18b772336cd182356a7b683a2630c05cadd085b5ff48069f' +
           '6f900354fad3959b4db5e3629971165bc083bd97402f03c4bff78876b717a7e383372d3f1bdbaad9d83d5bbd70976b9fb935c337e50220cfd7e8ab4d45093e6f' +
           '406e2b8e701a143e7f7527bd6a2210a827ce8e72641fa3b131992e4e454783a97fcdc4a623c508d796175174ae5510d4c741667d3edaf27e64aa00dedd8fefc4' +
           '0f41040dc38e679df84ee17c5cd50d53cadfb7aa3ad1bfb25990bd010eddf20a540ee874af5bea2d1c0c5dd01642f24484b5faa628ae749f34ad639cca657019' +
           '90f046c403d546df96bc06f462389190cd26884eb6c4d082597074b2e8a48d5021535a06b12a45fc0a1fcf2db89c3e5bf6d0c07bb793d401c21467297d4277de' +
           'ae00f62f14c87811c56a17046565770d7c092d90fdd18edabbc63acad3f6ba240120b6da3d615094acdc801a0577079424f90c0d5cb5b3927c7383a822712226' +
           '9fc311eccdc858d5285b26503ff858ceeee69da52733010737175223a06442237f0f7d5dabde4df1530e6886d8bc7d854f7770c8702dcc0c20737a22e9ef8473' +
           '7b84b5b194408942b12ed3167cad004d670d51112ef2435dd75da771d7f8a2a60ee7a99cc3f1811f1c5109007b485ae6990fb614a87ea9aec4e3bb5ac0540da3' +
           'd61fbf248fe430a8b0cb55b78f2b503e57cb1d3c85860b4ff92ba3e9472fdbf6955863b433ff4e743675124a10be52677e2910c71ab161615dd782d9feb1d0b5' +
           '5a9367630642f158b7a2926248a394783f9d7a1efc3c7bb3b4800910d58ead7bfe6697f330316eef73e18901f7c95eca742c3f797aa611cfa16bd003333ab9e7' +
           '617ddcacbb8fa0745ebc958480ed24d2e1ad1b01625509e5cbcc6565d700793efb9430a8efadf55306bc19f36e4aafaa8b53c9f376d2731ddd55b830672610cd' +
           '9826c7708fcf0a270f2884e252110a78d3f935bdcacad1a2853309265109b1a233a875a4eaa7d3d5d29039b496994adfc50cefd1b37187a004f17eb2c9d72188' +
           '7f35b22234d2729235d8a5321bf00156333691f7cd4279ce3e61f29b0f74f76beb7b07cdec6bb93377e5e98633a706674c3658717aebd3d24ceafa3b67fa27fc' +
           'cfa74f5106521216d5abc5a1e5feee3ce69d1529888565c57d9b52a1fc781b15dce7c95a09afa109f1f4b52d7235b30b3cd5c787ccd5572359b4f065828d73be' +
           'fd66f0ad96344c09afb324e6917f3928799f92787848baf1ba254bee776cfece393f3c6fa1091c8746c66a3e303f1db548f3c0417cf1f00a4a3e192e04ef6e06' +
           '04a9000f036f9414b9dff6004abca2fbe7d6975c9031300f083e43a1566fab167d0bb282617d456ed7e91c4e7283e7891f1f788a6466760a8cce4308bb197d1b' +
           '3e28e2e59dae2a073d0c018bb87c79947a3a1006e1f18662b3444c5c4bc3ec2866ff42eff772fda676629cdb39e756c0e3aec9f17c5b4a98cff3892cb5aa1a4f' +
           '3c4033aa471350c884cde1074bb406a0704e1944db7b555956417284961b983e74f73441fbc62855c6e4c78443688ffa2eb99799b642890addecf265905c88a6' +
           '4a4f8cec5c3037e4dc51c94ecc9387c20ba789394e2c1533a95f2a22600d06cc661f57ba5c503f94a3cbed21505b350d1b02e06a9c5400ab4ed8ce972c23793b' +
           'f2ab969f16dd2ceec35ca13b53967a7759b837e923bd529c21eed45e0c311da588ba28d3f415fa7c5e664232a6033fad01f34d1e4fb850a4c16fb8c0d6aea5ca' +
           '85ca7f5c10a988263f80a28331f6a98989c1658ef1a0b4f992350b67764ab7ba5d5cd947f5086c658b8e2e21a388d1871181c6d6b64a041fc04658e36fbef32a' +
           'cc4cbed991e7cd1cee30820baaa8f9d8e9130cd09f9a2deece6a1329f6e2fc63a4522340f7c5a02e6b577dbde4137457b52b2ccb9ffdc3b5ea36613f7f07d9e8' +
           'd8e1aab7531474784f60aaeeb22ad39c665124b98c368c7e5a7aed289b0ce5b41ce3c7389b0d3a93bad70c3c41397d7092336c1aae480737b511556694622529' +
           'b37790c7783c29e01e651c80a1de136723bfca67a827ead9f2c7bdf8fbe64995fa2c19f8e160db1d7ce2189832897753bccd155cca3f71f0bc081dcd1ffd01d5' +
           '587c751580f6bde27b26c125165342872168814161a9d0a7caf0da9c2a635063ce51706f86b70b008737eb29965e838c335f3139e027863574140000'
    },
    {
      set: 'FAEST-256f',
      file: 'faest_256f/PQCsignKAT_48.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8210f4fd96ccd125c5d5d5a1364a30c16a2dcc2fd677611012bbe4c7caacc4cc1ab',
      sk: '8626ed79d451140800e03b59b956f8217c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      sig: 'fba3cd899dde8a9f99c1260d949dc0cd6a3f897b1d324880ad6f274426eef0a2f239db467c6fe2063723fcb278f3626ec47a0e86890b45f725a26ded6b019be0' +
           '6357c1863675af1dfc0654fed336f3aa744122388aa9edef4e6475388cadccfb5e87da9de5566d37ac73bb5366ca828b6c8820bb55570b67841160f6df6edab5' +
           '453518c07aa04f00014a220654eb91fe81ef3cc0f82b34ee38f663a7b066781a74caae59fc25c7009a30622d3b5b569f9a2e0221803786c0290d4ac936535cf9' +
           '4e2f4966317454668bb5596231b47967aad4186cdf30b84709e1107800c91ac9aaa6f3ef96c436ed1c451fdd574178f1fa54ad92b3c74a80ecf55f8085e55bd7' +
           '51fc75a2549d81fba6bfb1466d702c273210506d5c996cee74ac1eec1a4c9485d5d827df5485526e2a7210ead7e1e67de042ebc163736a9e285dd53f69053d91' +
           '31332eaa0962b477d6116345078f6f726b9602d890c5a4e93795106466fed5571e2c393b4b9a2af17e601893bc22545350d3ee24022773a9fe9c1db611497095' +
           '1c6c3ac1859a97cc26fdb21dfa84b17e8f2c0bc5514c6912cda4a71c39ae5215ccd197c2bfbfbbdf74f2c87484bc183d647324d077d5285035f4ace48d7e8e1a' +
           '3b3e10dfb5fc50cf8b898fe2d10ff4d2103c7cea0074395e9f8425988d7d36102b647da48d261ac7a5eca49df1efef22fb9e5a8e33ce9ff9d0ff864f70215f95' +
           '4497102e67ea618b1fdc5c5ca60a9ddbc2c0233dcec475a2c03fd3aa47ca4b3bcf4dbb08d62b916a55adfd0ebf1bb3e28ca85e88090d34d7d52a6cb43d121ee9' +
           'ff7d4f5714bce69e13e8533f28edc521ad0595f9f6c4e34d7b8f9fa3ae7149f130bdf2b818ba16052c0ccb0c5221b50f53f9299cdcee0840f1469da5ce3244ad' +
           '4693d282327372bbb94b9ae62bfa6c84af637c2aa5697663510ab2354759abd81ddb5bf485ff94d883bae4f242140fd420f2f677bb89b34b62137a1d3f24ca7c' +
           '457405c449c51e932b1e94933a9fe10d8234e334e0bcf182c491c141d27737f9f0845959471929fc29c3e890526b5d446a5c1efea25b5d889a5287d6ec283c17' +
           '34867c2097b52e7f84fc2320ffeec06088d70720caebe4df067712a86d204e6afb53ce2e2d650d9dc6c63893bf8ed5672520071d99652e6c5fdd881bb470a0ba' +
           '1984650f433d5870a0964e3fd9b0dd6860d5cab905d9216c83edc21dd58bbae00b67b9985b3dd26c7b013b668da1ba3bb24fb9de4ddaa65ff18b4f10c1db8123' +
           'b64906e9c4858feeced58aedce21c33a47260444b0d98f536536980ba138364a3d718ac3c9f241fc995a0ee84070cafe23c66869d0e23ac8bf19c747ec5aeb21' +
           'd246ab0c07809d3a14b5e5b90ea6a512cf344ce3b489182d353fa09a940ed6ce563640d253704d98b3fce8e2f95e79f086b27d419c6d53ea798de7c82d3cef9f' +
           'ba78f99f3485a5bcc66a07134540578fa19cdea2dffee88cb4089aac86633ed73fb91bfc0affdc1736c3e23263eef3c0efb5c90d3f4a8a540bca9c5c01db07b8' +
           '92e8bb80d9fe3c8d57b8dc53b24ac8ece226cfe0c42357dd3647cab9433008c53bc23732f6e3192de7eb95bf21ef18a1e4b3aec3ace88034bf71a4fd38e1e5a1' +
           '0e893705b3f68241b9b072e7cb842edb18ac3210d09d2443b63aa32065ce2a1429d8281f0e01123d738ec488b4430ceca1c18b8994082b60e795d0ec18ff52ac' +
           'bfbbbef8875d53e5d0635097b9bea99835d6593ed4b20dbe79ccc9cc6a96b972989c8137edc837c77489a2550406cf289c52bc9edeacb3eae6dfc6c1a197184a' +
           '26a9c3cf1f367e81d0b261de04543f23a0b73b48b3646a6af4902fa3fa7a270fba46326c48a3b17146cf5519c3fa45295f45f1a98263d0871ad8c751ab97db38' +
           '98d06c50d9b4301871195204b60587dd5c22d4b65eabab7f99bcddd9103b1a456667c8f9a01df3717292084f6d69211fa49c46ea8720bf22a5a48c9c2a9ad8b0' +
           'c35bdcf60eab20e112c4a799e2f6d2435038ca4ce248323d724c631c8adb222bb476ac7947c84e72574ddb097a00d26a8d6193fa4c5f0c6b673d396c111e20a4' +
           '25df17a751107a77bb8c2a9354c822a509535ab6a8d0b02fc0167c9ca6a304c102bc2893e576c98064fbaac277959ace9c232233f9e675c2abb612744bd9da64' +
           '806e6fda15c7191f9d73ab967584cd49baff26b8dd3ebd61b4335b81321e1d83dab5e60e04a2decc2b5725d03815912b82e6e97d2754c2adab1b554f27cc26f7' +
           'b26b1ca5659ff5631579d4b579cc1d789e8d960a6837544aca7a1190cb013c4faa5e68f253cd936e0021ad74fc14501ad2395075d38312327f36cb2d105d8754' +
           '93733c915ce9da10bb363bb608b4b836bf94ac400c6589f3c87330c4045049fa0cd07c95f6d5461227c3cd03a8287e6a627e1108c987a570a08de477f1513821' +
           '3ae72feb852d4794245900f1a4544560a4548f4fedb87f98248d08c8394ee4ca16d4dfe179c5c812f71a72c3d6c07838ea82cee9485e1f9212f23518be4ddfc8' +
           'f5af67261f2841eaed3b6d2cf99e0356e7e90eda0076e4698749b6b75814bf1ff6830822917f265c19231fe178b623abaf43ed6d18c747d30e8f39b490bfabc3' +
           '6d68bb37c113cf2f90e7b9fe2ac85df4a2ddc5edb25686066c8f91f997780317599e4c34b635a9f6fbf113220f03e46ed94c809b432490205bd94867ce8c8ad9' +
           'ac880d7bc145fafd45fa64c7a40bbdc755a4ca801f784d85d3010f41b963badbe273fd8ae174f038ea6705f1b2d451560e0cc32127e4bfd6e44fe0bce1f17b10' +
           'c057c5a72462e2f764d954bb4192562f53c218f255684a96d859e68706df2be84c862f3eedd3d91b57d8d97242ee29f98d3835e55dc88002f490209036904631' +
           '1432d1064e3b3657b028f96567e6fe7289ec5862f23038b5ce13e3b7a4c563fb35b819cf2d8062da6048e4f3897f1c0f3c14a42422d36fb9f5904bfeb982da0c' +
           '8abdbcf0a908ebba9dc24ac23d4eb501674aaab7e2dc5d35916c21029e664e1a87dce05844c9eb77449d1d54910ee46a9174d4f296c07b4c23d8804a787d074b' +
           'f253cd195103b30e615474c047b96e34ef0cc5d985c0a846abce5b5611be76320a9c4fbbb0e28c0fb8216135d42569d0ab4971335b2caa37f0b77a275796ef3c' +
           '1b92c39ea762dfc73746419315d2e9753bbd74db8195614815af484fb1a739a5ead432cdd71bcf15e99d1de6ecaf74db7f93a5d5e70328a0b8103b68a2bf5f1f' +
           '48ffaa8a6cb1d95d780b269be7417ee1cac07249aa38b4b77a8cde60997c98105991bd234fe9213747b5e13f6f14b8aff6adb75c5e4d9c77735ecfb2ea957844' +
           '25a2ab9efe5de9515f92cfcd4fcd1c22b148c673e1edcde0f63c7ced7ca8e3eba250e1de96a580d05103658f69ff55106465b7b92954c3c5cab439349f4b6a42' +
           '5f153d6a38c2cc9d1e011770914a9efefa1d7014380e4953ac78ba6e9f8bd4937e8ebbe890c2b92ad18aa7ba0f37cd0f1697c733b14b2bbf02b5fdbeafadda96' +
           '83fda71a88d3bf69a76353005f2e6ec86a4490b9a9e714c6656d689c2976649cdb446686e119c604b93c134cda33d3feab8bb6192ad16543a9105cf299ae0423' +
           '548c6bcad38d8632f99a99a9be10f379d5165d337096c8caf1399922fcc94c6a7324dd8e06a2d4aec257ee560a79314aad56007b4bf2b03d7bb579698fa9bbce' +
           'e19f1d502a6d99ec59566757517e30af159887e3944fc1327b36a7d6e47b2eeafcf5d9fa477f3ff5cb4594f40e86bef4b80d6a5fa4b2deefe4400d483c3ed483' +
           '08dfc4d354f65ffabd98247e2fd02993b915b2c8753dd37ac3992d913c98d178f909156729eb72f656cacb0c27b9ce50bb3c89bf17e62cfcfbf33f96d6ab4764' +
           'a824cb8d7e7b4864a8a86b3e2844f6777ad62499f3838f70ac9ac72c4ef2a0a33adc844dfc6f41b6d882ac07d99dbfed9781c7183010a45c9dfde671fd317735' +
           'd979adbbc233d71ff3cf1481a271b13b8731e5f31de635acdb5b3ce78f697dfd6be7f6595acf12f034a1589f2ec0730d8c0aa232dafd21538268a81669ec79ab' +
           '9c91f966d073ec145bf48525c97828bf1635dec7bafa951ae8a30d80fb187bc4107a82cef5db183c747c1cc5872c64187a89de8be636e8a9f4ba52d8e35474e5' +
           '8c0d6245e8d9f567e7b9b5f5c3f51ea779ee1d66578ac5ea667a35ee8ef88df96ac7ed97870578fdab63dd0a88fa507efbd4a1b7149e855599a234dfc7d353d8' +
           '748ef093b5e7cfed2f5219c6081211aa73737f59047e1254017750fd480228d554da101d2686a83a9dcd5373b20eba94af93ab548601944861bbe28c8f669693' +
           '27aabfafcf7cdbb127975ad0512a818fd36591b6406972a29376d02592940dc34370b0b3d6864eaf29fd7405be7bed82202c75b00a1b3acb32d26f91347b7447' +
           'f3cf1963cfa851c24d5144008ed24e0811b3e63026b8b974749bb026712a16008d107fd574319a62ec8cc92cb9a859474992ccf94f51bbbdde2da14314bec6bd' +
           '0c8e1a41e6450d93bdc9adea33bc8232ffa43d47ba7c8e2cc6de28e8284943d3439162dd6f0d49402f8a2599d277dfa04a1134392ae5977b207f6ccd1f3acb5c' +
           '99fb67402355a2973843716111da06dc954ed27af455e7155c702ff2ba928ad4d66634e830bc81bce3a42dfb03308f88ee6eebc93852979719b5b74bfbad41ca' +
           'be784508ce6d43d9ddcfb2d42e82f8684b0bff4081aaef42f7e3de5967fb13ace2b30d484476b84c9456e5552d527b2cedc290925335141195bc5a94377f1c7d' +
           '4561af29fbc982273632951dbf78e6a0c118f0050dacd2f95ee4433d8c6b28019c68b9081d69940e6b945ca65928935caee4555469bf9241830a7f802966083f' +
           'a7b71c2a7f386e29625cf375f6b0ea353dd2f473411ac050954798a5f9e55a846ab98fe2780cd46410cdad01e40c8bd824b205c0e011a971d314cf7b05af9da2' +
           '47a526fcd6647779c87b89da2da2629bed704698e14d3291f39bbfb390d2fdfffe77028bdc8d235ba9456843b0e419b6cb0159618b664378eeb585638fd0b008' +
           'b4db48c1692286e73222dc8562367172e11a19eb2e6ff359755effed0ffb76c3f3dc203792a6ff4892da581b780c16be6799d1ec24250b2fcc0c1fed3517f35f' +
           '2cc530c795d8f805c74653e0d969139f9e21fa71797d4f2bdf86b8357db06cb2b4ba3d17c0c2619c221536b1a98b637cfe284700acb061ee70634e4cbe48b5ff' +
           'b3ced95767189cbbdeeeba66966ed970030f155bf81ff4ea3728e73ed9ad03bf4d52fcb98c044d5d7da709556ef622f88e389a181a3e85b555f0b8115eea4aa1' +
           'baa9887fbfead025a4a25a087221a154155c64405f6756cf1995b35de274e5ac78bbaa7e9478807205fd0d2c8381688744b49c62a4b7690865462b8543b54644' +
           '913112fd1b9c9913d598ca308d7ea565c5cc43ece1cb48e383429d86cef81aaac93113319f9a49e1f8a11483d3020e9a8cc59540767e41816b68d5bc2a05f8a8' +
           '52e431c73105f761be4623640fb7b9805b2a666fd202a65863932acda02eeb04758551c30bd33453c29e440db344afa9c1a49de44c1f769c96a9f1f1a30ccc42' +
           '89799c8f19769be25b88b75d028889d62ee4cebf6c2bde4c77a7aae4d128f4a1afc3dab0c49e82b0d97bb0b61730c365220f796a3c1e210a99d1c02ed03d762b' +
           'a2202f234037086772c3606cdd334f7086fede1d78d0f0ad4bfb5b7651f309ca49bd31ade437171c929d5863a5ddd7a4ea8b77e1b83ab2be5e66df7d930f9886' +
           'fe4e646f50eae8bd70c1b8941cc177588880b266889552249b22929cb2528a2b8f7d9931c909835e51e7e2bf5eec0457b40e76afd3f5c0e8d50a89047be372e1' +
           '1a35129da9a5e476fabb14ab2ae92f1c3332279aadab5071973e522505e8c98b0177b50ac8b5ab4d13f8421e99875ea9bc9e41d0d85c6b7fdd130b30c81f6bc1' +
           'e5cde513b9778e65c7754fc5c3e884c9a3dd47c06a5a56550268e4c773131a35cf37b7886d4e4efde5d1c55df809e237d93af9693f7e9e0199c2354779103019' +
           '6ad5b4b991aeb9da2d6a2f9f231767ffcb5c262289832eeeecb32728390b87ca659b81ec291f989e4b1fd6628194f4ed02ef3c71ea5f87dca000fef328efa17e' +
           'e0e94c71b2dd5798f98d9f264405f124117949de376a5095e7952f8a96ff9c4b4c0725b2fe60e21032f6e6f4df9b9e062408b71b7bf5685b2d15f52fc9aae901' +
           '42cb8085b3c36cccc1021d719ef519fee5ee7964d70c877d64fb36fc0b74470ecc483328450c0e1ca60dae735f320299d2938a4445fd7109d1763e99861cd063' +
           '7d4311f3448064279a7b361a951de7385c342eafde5cda24fd5671268ebccffd9592b0edf4bb394fadb87d1540e9c4a4f481a9d7f811d1b1b9fb5fddc9ce87db' +
           '449135e773336d72fca8690c03e1951d760f3dbc30cad6a5a4548a4aa2d3d9524b731ec10946a9b9d7507e1a8750a019655246b64bc765ea1789f2eeba2e2760' +
           'ca909e43205fc620509a97f4b2e8eabd444b0f5a37a089a8719826718a7b597126c1c074a6c290c3511853e6f4bf91e947c62b33a544d7ac0c38101225548eeb' +
           '4d407d2e1f06559a431706c747195e41bda88d0ce6d3c868eebe6bba287848bd8c43c3a37b74d5cd91f49a469a953edf86f5e0e8500b7f5e7902efc39020c9f8' +
           '3fa167139b0e98829c02ee5801c70d21ab770447e73f9e96c443841ce9d17951dc82bb4e708e3d7ccb94134766379be46a3e99731c7c78c6b0e63845eb970af9' +
           'a013722f4f85d82ddb9c10fdc3198c0237be3286180d548e48a3fd9d4df26a3dc4f57edceb100d14d83fa0920648f1b1f4c9e9340c526389292a8fe46acf0061' +
           '62b439897397bbc5d24f29ddb2d1520aeddd98ac7f5b8027b429953c956d6b35ee33b0d956bddf00a3126ede0f8196efbf066abc1e140d204d2b9843aa103147' +
           '4a1b4326fbcd44c95c10eebb3fb1610d26fd0fafc1553cba61f5b377cfb5c32c113f620eb4a20326ba74391184d7d35351db3d9e41d2fe994d5a1c2157258f18' +
           '16156000838caabee6fd631415904087ce9bd7914b0e731714a3e416d434e106e8dc5cbf784969930a8a5ff2699d58df645cda96797cfc32ab7c4ca1ef48aaaa' +
           'c194aba8612d68ea394969f34ad71c80ac04983789e0989a928aa04323a31f18fb0bb6e59e6a8326133e82f8e867ad86d1a1eedd1b4dccc96746e266cb1a62c3' +
           'b8063db2ceacd445f7b9c06ecd5fec546baccc7b9ec4e9d9eef125b9df301654965103491040dcb5cc9ad362fd754b4d31dbf11a745f57a3e78599418eca2316' +
           'f1ce8def44ee87074a11ef802e75348b04b034809e5c6882220ed73906efddce3a69c117ff0036d9d46179d4b9bd5edbc46ba7805c563867293e416023e24da5' +
           '4f53260d2c897dc7b45253b326f0f24acb515bcc50925181039a83035bd7e55e9f6cd57f2d591cf220dfeceade1713b37bf7e793d45aac74a813a821cb51d347' +
           'e5f5b990cea530955ccee701cbaa4ee5ea5bb102e9c27858dc0530e536f3b10e3e80112946346ade092c27f7d243e9dddc2c70c29aada00c7e95aeea4a9f9d5c' +
           '102e324fcd7519b5d4194b4758335117f3760caca8fe83ed27565a519999ba3a5478712db3b5817b7de2e935e79d42b154efb32cea7a2b04abb452fbb3994b05' +
           'e12d765f344c513cbb320626f0d054c80d86e843a56e432ea40d23a1190748c2400b10f432c461efa47f7c1e85e2d2a14a35dd049712e403837b1abdebf97c5f' +
           '08724653ce9f92ce7d4a6d91e1f6802c4fb17a809c5b0a1cbb8b797f9d15d1b1b6daee8e058a050a6637d7d995764dfb108d973c1256e33c6fce2ffdbebe3093' +
           '130662d67c15e2f064619c29e5d3b5ca97b6f9d6f66ed55ebda697d9b0c2d13c78d803ca64a6dbfb05b22146bb4cb3e0704294828f4d846925e817b0031bcfec' +
           'b5807e6266a0492cad18af117976ce259a01416f524bc8a1a39c17076b5469e48d9515ec42f334b4cf5c032b9722f3338c92de0a734596f1ecfd8c2763c0e88a' +
           '9f76504ac356318dfc9d5dc9ec166ca12d36da207fd9476afdd31268a0c0857b058be94a418d90378b38c19f4fdab4dc9f43bd031bb09f2063fbd0ffefbb21b0' +
           '817a461c80fef3969e5bf6afd875baae2f1f9f7d0dc29dbc1d9db93d8c8d9850462173d7b89e672bc385e678bb054667bd6fc16c87895ad1ceac6e46a98c8e42' +
           '5151bb2fe5274e7fa498373a7de26aa389c694245205554285ab2f8ed89547bbe2214d8122abb4b54ae6f30f292f265f6a8083512b1e0b6f761a89b3221cf5e8' +
           '3b23c3f28791754c7cde07863a07587eeb025b38358c425f671299b188f76c3a35da5541185641c75babd536a137679b38a4769f2993444e788bdf38f2a91ebb' +
           '83467462b7eba5534539e9ab5a9b8f54d3999e3f96a628187949e09819728ad173ba50795e9e0720252ab62dcbcec8e78073a079965892fb3bdb45eada154cd2' +
           'adc4730553e47a148dbb118cb461240cca543c3b2eab34f7fcbb022dbd5a95476b1036188a280bfb2e61516fbddb799b082d31251e4129738b0e7c00c7de5cdb' +
           '60bbc34c7cd6103993cb54e23a5dfb7c74b65c92fe673db09d351b872a1efabc58ea0b8685594650ec9abb4e2474ec51aaf63e749023be12c67496c10f287899' +
           'cb69b316b6267f0701a9530efca63668db2dcf787936a7c93eb3f87a4f011f562b4491957cb7df848b774fb7e7a95decf0517b1f37d8b602f89f763f41847952' +
           'af5ea7c4f1ac894aaad81e59c30ed70c9ee77a74046297f06df477068d5ebba8aa0336d4bfddb2b63bd8f8f952613ec16c81911b5cc80a83ec7d3d01aca1a7f8' +
           '7194685d5d469113520975e0aacfb35dd6a19483bd00a1bb0ba114a97a4085d2aace614b93096f1571b1752da3f905e5e4f6f9c5bd1e48fa239eea23b81f8963' +
           '84da463bcc53c36aa62523d191bab9d5534136a77fb36fc58df8676ebd61d0fb1960f7d30a2f59475d919e2ef4961146419469d55940e8479b428a647ea3ebc3' +
           '812030563f2b9f4c3478b52878596c1665f1704083ac4de0cbec4deea1391a7c826878c0d0e2e21d68b038ecc5f752c872d6e574c90a56bed0935ddc1f9fecd9' +
           '48942fb74990ded7db3ff4d23169ad2589249cbecb95ecdc2279227adc159ed8ec6b6c961dc4533cdd10341b6f592c4a5d46450f3b7a7c550498783fd63afd5d' +
           'b6a71663f1cee2c72ad5c94b6f81db78a082d97fb81a631d39bd377dfe4dd00b4f3dc73cc1d8591f8f1dea831a0377f409541621cb51ba74234e4dc4956f5f78' +
           '0fcdd20c4708e819b076f5a86e912ca46243c2d1d150ed55c91ff812f165b3174b997cd83790bf86307bc85a45788bfdd5f8dacd79245a7ec855fe901816e7f1' +
           '4e225c1f15cf6f4a1401aa13f18d3dafe92f917a2aab8aec8fa30107539a9d1dbdeb460b9b092d4956cb8871386a2ddc9cf01ee8e32ab4a673b66afae4c37c3e' +
           '524e5557aed7953589c00f7bf5c3491335ea1cbe9870fcf8f2cec00c360c378fb085a3a7830fcd63b31d013ff9b2d35aa91a62e57eace874d86e4fb027e191d9' +
           'd57383767d5c348f6b7efdc6c4a9db4c0bb37431c19ec2cc4b1e5089f00e87824a5934114b953f9c1297b8db14e94104383560439e1de79f2738909c93df2ba5' +
           'f323057ddc8c6b19da4948adee664f5ce02f6cecd34bbbb426215dd1fe5b9d876e13e3914d14f80ac154b975f894c9de042611834a639e377966f75ff579cc16' +
           '898c28d5e90dd7181da509192185eb9c0c5bc88e6da7455dfafb9bdf993846206b7764def68c432cc509f614ba5577ac9420da04f459ce746a7dadef9752d70d' +
           '816f32be3f640b38f09b7be6993f9cd686b934e30e5029a80d9667706414ff222382ddfb935521d4aaba44e56f23f3df24dd785079975ffded720ed196f11573' +
           'f804e14853fa7958a7bc544f1cf22e85e385ec7f231968c1acb5bb56457119de05c9c76598d95da17f12cddd16371027255035525cde75374922178f68cf010f' +
           '34af32b8255106d687ce9b5c9b593c76ac8b10df64412f91bd4571aa5549146af392b4369f5e50215121d49aec24df1d4bc538259921c54d5195a2812c662d0c' +
           '014fc1e54f1326f0f164f5797bb44fb2469baf7cf57f6320f06523971bea6140edd26ded9aec22e5c9258b11bc36923ff46d71d9b3cad40eacb0f1d46eb807dc' +
           '9859b2964a5a0a5bf1312aedb5f3b69fc683f7529eb1904c640d7bf4f8262090b43c6cb3ae16d83b978224cedb4339efd6a1200725d186a6abf4130d4b8544d5' +
           'e289bf0cec439ab410bb2565f27f368ab417c75c78cbf77ff9979660dc6aef757e5e94c29861ef2ade1e3ae93c693093def0e91a7054b45b1b918a560a036f1a' +
           'ad3c484f2443250a4c4aaaf8dd3fd597a317cef3cda13496b2e8cbf2e5c4518ac1358d99ecf65f70725d0d79f075443ff9c06e0eeee76a08af0c60a71a8f70e7' +
           '9eeb563d4bf1f12ea4f2cc913e1753133ccce96365f3096c5eaee60f463089930a3358e4eadff84e4bda6d45cf2280fde04f4d1b53446251ad82145028f5660e' +
           '323661357086ed9a0f7af7c957d402182505878905d96698df0418bcf0e4bf4a4db2b5fdab9965f334ee3f507db25bf1434069092fbde2b66df09298bcfcf840' +
           '76005c2cc230397b24aee276c5a082bb9b24e287dfa70f2d3b47da4bc773f5fc06a821ac0c54f0c7b54b26138d4b439f95f9bd34840c46d62a091fad9098aea5' +
           'bdc4f9e0e503d0eade6f7736b5b5aebbc4a3192e821be6a464b0904ab4c75baf6667ddf11ccaa74221f7e0ccd4d0af6f6a7bd542b37422c2f52cee5b96bdfddc' +
           '6d5c2bfb73e1b80280fba73b7c77027e51029f4efd7e8e8ff6a671b2c9ffbe61b7bb1763e7bf9131c3f761cbf28149e316b3abe2fd1b5224a4eff3d8c28508c7' +
           'd77144f2e7bc2f92888ce6cf21365d12012ff141a2bb86e2a488d3ffa0beea694c44044e761f2127243aa749e88fe93e941ff272c93143f13c181e88f1642b08' +
           '0bc746a7d50bdd955944f93b60f7274ba3b57302e8b77588ed6048781ba12c236fef8d13318bfa726c66ca837ce103c5d42c68597f831f7202d87cf1a149dd1d' +
           '8bec8ccf3dd7c0183810c409059d129f989d0dd3d90947ce516acb54153b953eeed61626818d8e5919c352d9bab8a8c413d6a4200d9197d9e58a0f6f31da6f30' +
           '7f8b54bbd14bf56f26b1f4204e3969a99b9812a4294387a5b7a6657c2ca8674785e8357c28ba2ffbff9fb26bff9f35e704d3020f7de9f72b84da5f73529d3b01' +
           'ecd0948c7c4963c0805217b55c9641c99c988d85060f0f047696604bd8a6199b4c6e32a4baeaa3b812493f245e375ae3810bca967624de5129cedc5f69a5cec3' +
           '3676a597eb7e8c775cdc915fa163c04f39cc70146a6f1d05986a82550d6f09b2eb84d199980c08998dbb4655c5abbcb619599c68e5d76571887d0a8624844bb9' +
           '9a62e0b11a1f7545a58c20767d3b7b8868a37d53a4053d193b68b75347b7ab0c6df0d64d5c150be73e4c139fede37bb3ad8a1d3f1d16c5e27d8f49e40f92c828' +
           '22916f7bcff0d1f8ec66ecf2b822e9524955da4e4c6e0350f05e6d0ef8c4a393d0372b2419da6907aec625a220de3a35c12b926f495b57b9f598b71131c00e8f' +
           '930b67997cfa174a3576474ee1f8647d7ea7bb4c4d975e9d35933a074efe0902c3b6e873fdb439e6382867e4645ad520e1b1e99100d5da02917e52f9919868cc' +
           '670f89c6293b5b85bb65e00e4b286de0a6a96d751bbfc16651695abd6bf183e5b3d0aad602e3bd8d4fc942cc7ce5a3025b18a097f7f9db490dfeedc85d150742' +
           '6c062c9eec4bf0e2b7fa12fb67e8ba63c526fc9d882d3384bdffb5112538b26f8109c95a0621a7418445053773cf3183942f90e8226ba15163ffd5187f3a5f4b' +
           '7fd6a3ced5ab5333e85f2abf472d4399c683fc3ae89c7d88fc41e3092c82e8e13e74204b9635e4cbfea02d9fa2973b833e8eb26bf5c6dfd81c1062b5bf2554f1' +
           'a2f359969513c14212e7c6d1b02a99b61417535c2437bf45778e347fd12c64ae5260b4c0596316d482c6c8466f4c8c7a4feefbf8bced127e969357e21b37e626' +
           '94f941765c6664b6449c29dbbf4d568f47fb4e6c6438767c20c5eb3cf8f0397b26f9f7ecb90f1334d7c4134d8d9bf9cfa765fd3ed7d3f33345a13708858d28c4' +
           'badb5b3df812042f52c3f43aa0f9e02efdc64dcfb017d2f7643a1446b781c0e7193283b43e127bb8ab0cf19fc663b983597605b9b7da4efe72a1ed1494dbf187' +
           'c9c3e800c00402b8f39ed28da02ca5ddef5bc2b3214938e4fce5c41a0510ba221705f8be87d75051d27411ceab7cd7d1f4765e10634ba7afd615b7d6f4a387bf' +
           'f674b6eb84d3cfab97be850c9e40847e30c03fe9542d90147ca6a8ac61a7eb8c16255c97b8b12a5b981d9d9da73ebb3b9cf155605fb93d97129076fc88d5a800' +
           'ddfc0e3c7106452821558f31d7fa7fd04cac7be86a24f9ae796a9b9a50f166d5718094fca2f233e6cc7c15b4d7fd63410ca031ece1926330b3563691c22b5d48' +
           '5fe19d932db6ffc2e8ff192073eed1f3c3dbecc845c49a548938354d3c010aceaa41bf5039a1ebe2b1fe8fd9bb4a058005733d195a8953b5e8c69d488fb0bec5' +
           'f7c86dbe5f0db1761a52b0e57c036ac8793104f69880a570a2659a96b0efb3ca38784f035cf0ddb9cf25f17f3f01a813b0a2e609f29d0d90d5aca1da2ed6a4e4' +
           '4499b408434e1594747d4acb7f98950022e4f2ca0493e6729280965ab1ecf02a2dff01663d79bed6a3c4af75eeedf43c68ee670d97d7b31fda9d99e4ca9eaaf3' +
           '1ece218e2a98a9376dcc542352e8a477f0ea5e3eb3ee9e47a9a05bad092911b0425faa0b5047c7bb33799dfa1dbe031d2ed8b7b3f5dc2d7e6c81cabd7573b003' +
           'f7b675aa7cecac9d190efa99763ddc1fdc4ed08cc685623ab00813d58ac7efccc59ce51dca206f524d898d342de0cf687849d9cda33ad546b9afd0055c0cb5ea' +
           '3611c55a85da09ce5723ee4142bcb1d9aa7f15f6371a531526bb954ab7a243744fd52ec4c89d21db2a12890285c24408acbff867e2f4b47c7397985ab46a0516' +
           'f37b0bafddf2808e1e5a06ffe84bb84b4ef552ab2739dc7920beab828bdd0561c1ffe345efe27c87007b848edd8975a058a760b1a055a6f442c715914dd418fd' +
           '493d95480daf630c95f2464c0c9a40f6dffc7879231def2560937e12c368ef4185121562a007d223159b1218a690c154ed0d37c100d29d6a6dd1afe489df0f79' +
           'a1cba0ec5964be98b1df29a536938875eacef88d7e13e3e4126b71ab2094ea1bc627f190c7b29c856f4b338b9d6570d850d3973873197936668974842f4a0639' +
           'faf5ce3c07784b4e8040d11d1e978f5364816c870a9d1604484cf7c4ff26c6442217e22fad1b9ad2414396326e23aaad15d14477b3fd59731a6c98f689e37255' +
           'be17a7ce5f55bac3f1dd849f864cb1544616e0cd2e8bb5049a7e8e4f236c6d0a7434b2bdcd3001ce2dc530adb4d39c02ad249ac19ccfe4324934cb8eb6ffdf7c' +
           '0b8ceb296b1ccade87c4ac94a43c3e1cd0e2e6b0369ad80f5acb384286c6ed6a81d810ab2a5eb4216906c409e073f501aa16a895f05f6eeaa9607c31d6685b5f' +
           'd5f1744b81708b9ce7ae6a7cf34ce6e8628860a0e8399cbb151bd2f11f97672933b860f1285eb2188d39c99b499e1e7ebc35c7abaf2f02ec1a610b534b86f9ca' +
           '1bfbaa00a34fed45249627e416bcba12a7cf865a1bbd5ed73c5028f183a5545063b589653ec35abbdfb0f046740a97339f3adb4b4c4cf7d90f0c28c9fe14db61' +
           '2d1db8a973fdba752c2949df021d5717c2ec4d841b1233a3a264e0223b2ceb0c88232891bc665d839eed4830c964a6181ff17b83e2e567fc84bdef7de15aa4b6' +
           '1385024a9fe8fee272b6b69550719ea32271f8e244eb3b33d9d9c3f2313fa43d9c6b280b568dbf1737908223e68d4008b2decdcce2a5dc6bbbc369d34a3daa8f' +
           '7d6fd70b19680bb67935ba9c4e61d5b39d87e1e401ac40d5c8268d3267e5b7914bf6d9be53619bd83adf2dfbbfac6ae8ca0dc67324cdaeed2293bc3e4ef3ffa3' +
           '4477a77ef7887f5692b92ba93907a43cb9b194c09fdbcaa44571b4e9fc04f4ca157e9f58b8da09ae485dcf2e8b45ea796340b497a920a5704c09f13f752258da' +
           '6d64f486e1e5820159e8058113693dcbe7ab509d00e2e12b8ee94647bb5780fb62c2f3d35321ab4053393ee0ebf34f24f51d34a92075376ab5647bd4f7ea82ca' +
           '1d4cea76a4c10b7c9e4f92e011eb200d4f2599b03bc6f737aee93e572d0e137474b9fe6d281661e422ab5554e70b9b7828d6385e2006ba79f2fe69b1ca81fd81' +
           'ac4cc53d323726233882377eb6e8f989c1b3d03b2e4166d34aa37a953c1fa9af7042d0810b2c40f7deeabc7f12e5a1caed90ab6208f2c74b83dd5c7ae7ab2048' +
           '19014422196162b377adaecdd2a03eca8093b7a54d1c36eefaf955c0f572c726b360c18c93826b3c222f38fa64f15f99b9bdbfd6d6b698df4aac0789a48e779c' +
           'f68186eb9955db57b2cfb8af27fd79becae27a02caa5853404d7f0c60a7b00581d1b9b6460924a676cdabae1cb5a7f18a85850808bf6cb97b9e8e0e73aab8052' +
           '8dca797d6d9001736a70a635ce686dcb6bcb0ebd364d2fd1facdfb112b6b241affe6d0322aff7a112439af1d12577d5341977f5bd20f562f619962ef8d7b9f94' +
           '97482f3604e4c15daacc75b65bbb6dd436ce9140a53ac51c496c5b646a5dc6936b92c9d87dc69c4f05df3536ca6105880ed9ee62151a89edd2dbc99382e01a76' +
           'bff31f509e935354ab9f8d707c3fc00264fbabf3e45c13fdb1ee9c3744c25531e2164bbc21214868b98eca3ec43bb69b7623b18562d62e900c4acfd026d8e2b9' +
           '61d7df7cf78f63dfce19b1a0cd7bd0689d7aac11f5997759de6e2e4354db9b7e32798128af0a88225c5cfa5678653cba9c13fcce38ac256848399cb13c138597' +
           '8481c52502bc670d262b62fcb1be4ea7437ec9cbbcbdac64b96cf8f0e897be0d9b332b09d3bb377770a915e891827a8b04b27c0f4637de03fdefaaf10b1bed38' +
           '4d7441e4c4cab2aca33568f68352bca0e4ce1fd06f65eabb3028ec793e989fc2d9c1db3d816744b553985c7f95547510a35f703e73c40f348e6f72b9a858a474' +
           '3df7ea12a04b7001b650055a059d11bc0c530b4363ecc90887ef2e27b36bae027867f7dd19e77ffa3505941589f1be9df3891642ba9e1b65291adfa2295ada29' +
           '5c186c77a5b38246b920d35afb9eb015180dfabef09abfc6b7ac8b96d376383a9f7a2a98484249ef2d7a57319c82ba89d63cbf3155e4023f4e9e69eabc6b60d5' +
           '0e4c23300f9d4336402eff1ff7d8c473752e9aa9e30577e6d12b143df856b2fb55f6564373408bea7d452570c80a77e7e58ac7c1a44651c4823421b8564e304d' +
           '529b144357ebf68cd00879428954a99c882f1709237467cf398ce84ce9a6a338138a86f6dcd6cc18a5ee74ccf03b32d0c0437730ecf6c9b1c7dcf94b022a1ec3' +
           '1da912a93423fc242b5ef97f6bbbdc0a02737dfe68fa8e4e4771fa9406e36516c3d2a2ae90a218cde7355ff78e5181db4ba3cb390f153feaa680515add5ce8f6' +
           '0a54244ffa4ff928b71846ba122aae15f81b7b03543d6e8d5a4cb1c4ef301066738bb68324b8843ef810b7cc440788a24e43ba8d2ca568d69900ea1cd3956277' +
           'f39bb22197be18ad867b4443c704809119fab60466444902195dd8c7d1d49bde6bbbd979e791f9a00bad3c8c6b39f4b7259f09dc7bd6158bdecf0fd449519fae' +
           'a9cb9e0fdfae8e9dfd5ef38c4eabe4f80ed3d603481f777b63a2490f20f68ac4177f4f903034f4641cb4162b0674330b0bec4d21d7395f0d357ed1f3ac60114a' +
           '833c3a161b25fb7d0fa1b1268201f6a9b29696b19fd435dd026ebd24d42f424533a39c1146c8213960f8fe42c41c446c8c3eb3726ebee5403184f50631bb9551' +
           '8b6540c861a31ef7b850af9681ffeb106eb5fa2614958ca7625e34429d7e585b8fba6fc97e83a7326101741788432fe991ed55d6d5f9f4ceed576d635ea05154' +
           '113d021ecb5ace24f87f278f0ac09e87ad8b5ad79ee723351412dbdb585ced0cfe7324c8440adcc86efff0cb809c13b8d54679f73fa367b35304eecdae98d59b' +
           '631c6d89b395eea779440022650d62d508000062e215aed34304215443eb9f65e453b49a561d0b400a974fcd3f08ac9c3682d82739a4bc873af54396594db8a2' +
           '58ef72db1baacc34ae1284913d879367271eca4cc60e9ca31053c7edb716d78f3fa3aa57d5b02a3dad55d8a292757157557af05a3724b2886c97608adab44150' +
           'e24207692dfedcfee75afdc088ad71cfcffb8aa72a86d751cc21edce2d501c457262382f6dc0e5885587d2ab647679699b1c4701fd764733ea4f42529736a3b1' +
           '5390205628e39ef938185496efb2652ffeb01ec466fb82c96e47fbebb22bc113be2d28baf247d757e7f1a38743f90e59d599651f0e426b61793411a102b4b151' +
           '5bcc48985635a7618528848ab0ae10e9817072fd737a49267369be3bc41b0f37e3ff43989f54f1fd9028b15bb6cab42618c87c0e91c028e2e4ab6ce06029a682' +
           'efa70b97eb24ede99963a535094608866824e6c3640fa5d2061925650273c405cbe2f5c83f8289cf4c78bc9caa9bd66130a3109c7703a93dad2f3dd98a99910f' +
           '15cfed57fe65ddaf41d2b9d0fa2913e90b8ce7734a1892d376ef850c76b3b25ddb22625de21b1e13a94f9f968c33ba91a01bb297eec13ec9a7d501948ad5a207' +
           'b94b2d6b16de88591d74c089e0d0a715bc30b9ab835bff43337768fefaf3426a46eca1b23f5f11dc0aa28e1b9b3218b9ed7f9c50c585156558619c6032e2b55e' +
           'c41cde63e2d9e3f858899300cf6c41aa4a814e30f3a318f6927eb8fc3cfe0e6b6824907998dace02bef85d8114f42da9f57101eb33f205d7d0276a5e1875e5f2' +
           '32157a9a496b73a55731074f96a2b84146fe4ee3a86c63c660fa276e53973cfa13238db1b65512128ddff6705cc3cf788a61b2982ec51727d9c42b09cd1a54e8' +
           'c7b77802139bed6d99095a1c413e22aaa24f8608e609b0a936ba2e6e2bc71f666403517b5ed09c75f899c23738e3a42de5304b81a49a261931b75c3191d518bd' +
           '64a9012a1a767ec0844ac6328deca6623c816cde4f9b04a362570eec0ee73a93dc7ea3db89a71092f83570753f92b54ff91cb4e8279720a5c4d4be3a27a75291' +
           'c0ae56418ebdae5db71984c5b3dcb9110769fa87a8a4eccd45816d94117d00908c8ca071e899c468be52b94c8b56b7258e86b14b0cce000d5a6176afbb61e84b' +
           'f2053177bd88f8f27e41e6d81001992107a35d8e94647dcb433d7160d979ee74459df4f7b80abbe7a549ea5005709eadd157a720c39906d41290eb98b6259fb9' +
           '04da2bccc0e626ae597a226315647e804140eca6eb5d124b07bebc3a5e49216c1c5c26a11ffcb0b0723dfb57a9546815082d64c59e29e4c6f275188d65797652' +
           'b327b531824adcc1f332f62e922cfc4b208c274510abdd32ad4ffc08cf38ad59dc203c191da80f2af1a50d22c4307ad3ee85fdd8e5244c618d4c0dc5b3eb280c' +
           '23dfa51f63f213c8bbe0934e8c173ebee20490ca63e5c8df3c4f0d27f9dbcd0365a5d82764aaf19a462518e8eec2e8f9f0d37e38c494f4c58be06a03385a6424' +
           'ad829f418ca12f47d365b256947c513044132363f528a93192032cf886d8658dbfacd4c57f1aa8b40a8604ab94e1084815515e693fcdb12f08aa7c15835b1060' +
           '4074a5f0df3c5c02a1c56eb1049f501850275964d3783ca031facfc29ac3bb98ea8f698b20e0a40f0e9ec4341bd343d209ce7977d0325a34aa41a7567d3bed57' +
           'e370938ac9dd753bc0e3300d6c592ccef9acfb8590ee72b22fd05c23ba611166dd3bbda8710b3aa4faf6e04e834236256319be60323e70d3905cbc2a71163ecd' +
           'ffdab7f25609dc2cb47edf12fd3453961821368fe23365bc0372d5d7ebaa8c8e08c0eb4e91650979cb84660ae7ab4baf33168dbc72a746ab35b783a4122895dc' +
           'f69668a8adab9c1a57e414da68ffacae54f185f4af86ea03c448b3c219f3db7eeebe16725a9001dc1e1b384726774ab1ac8f2186e731873f77822ba23e8e8916' +
           '00e42432cf5ebd0994e18732b22c9524227dae122c84c2e4c06ed72bb12ac689a097b4d702ea6f2c7b0050ed17e98afe4dd6b73f4c3aa2c948c99db1cf986138' +
           '5f507988c81a8623e2b2e583bc4759cd7d8906507ec6b5495adf0e9cf2be4f18ed09bcb28d1457322d6ee4beadd41c2891546caba23b82669967fd5cd96a6cac' +
           'ac6323cfbe7a71c2cb978c6a0dfaa2960c9fd307d6c0716950309f4120354d9f8096d226f2b85026479cb947d4e1ab57f0e3ac40f955c1d389ea7ccde1251720' +
           '6c41af96880fdcd68d204423d49909a5b5023cf2453d95726bfdeef47ef0010e3b3631c73b95d85de530fb69553b0789cab4ae84f76c0ca8dbd9084accca7fca' +
           '78bfb90dc2072f5ebae52e1eb0940b1554b761f23b796a1e8a59ffbec57f6026949a6aedcaf2e994d01c45816753f41a08817260b8b05e005f16fbdec1c664f8' +
           'b0c139525c3d0780b300b10608e81c25c82a2b889846a32aca0484fc77d6cdbaa109fc8c878bee805d183e40e368e2d745cb5a7860eb553ce386f46fa680db16' +
           '1d56968b5052d5e89032fddc65211f9d05d1fc0fcd2dbdfabfe2209b463db51c55f44325b71914b81273d54c064b76e030192a6c1442f9f07f4c99b5fef96bc0' +
           '83f0c11b0d0db15887df102d8d4a1776d2e550c4e698598f5344aea2303dc1524dc26874371c25aa3232f4142961ffd4b786221650799ffd50728da01653fe53' +
           '182595aa035132e40e9ec1654fb432dad50586d5202dc9e967a2fe24b512f0d74086a2ecaf7d9db414aa7a8b925ee529555f8be010e0655c70e7316123a16e83' +
           'bf0322ba8175540a521014b21d7cc2f5fb56d52c00eea76a6e4edab745f4e4234220a9bbe6cea48f288b31fa2dac6ad2a7638a562501982dfda6b30e4c004b76' +
           'a1c8344664452effc9341b2a3e6d1e2e74aa991fcfbe9d5345cff8d61015c2dec7efa6932532785125d4d9413115b565579eca4855f9e635dc0ecbe4437adb8a' +
           '1cc7fc0ca557a441c79dc356674f6f9048886326a653a248d2cfafe27c2bb50bd3b5c911996dc09807497dad130918cf086ee3b7dce1b7d9a4cf1d1876a93731' +
           'f299d59eb35eb5c8c85bfd14825b27cbd1446a574b2489613dbec6eb4579e46485197e40992ae4e5787d057c442d2183a244a1dfb31aeab6908c9bedfde8b01d' +
           'a41a722bc05522788342493331c1e6810c195b81932d9e96a377e28d553909d1429a8a1d6d29738dee39fd7b6b707b592c84f51cd59886ce049a25596361314a' +
           'bce7ceb703beb296f39749273787384b756bbcd88b0fd8cce4e31ad56e315f35523f98e82d21dfe6d13e688e337510127dab1194abf778dcb1ecd7f3ced4894d' +
           '92e9f1c6f6fb07c00d4f720db35edcee45095b50496cc76ab7210f789e1be9dcf349860513c07eeda165b4903f0a03374f874423b6eb2d741a98e52374349f85' +
           '395da3692029bfd37549cacc291939c490be25a5346b720e560cd08fb1f581c26cfd8871cccee67ebe293d3089f14d292d8bd2a21ef0d1c4341c2d69715dffe5' +
           '0943c083589c590f75cdea99adb90b9093d0b25c4f924cf0411f6900f4894638e056142340728b3112366b282f9289e9db9cc66633752e0aa080402790a5da3e' +
           '6cd6104fdbe71d90170819a011bf8e0ac0ec8175bc91f5462d1467a31b94e4ba1275b0c46ba197790702e88f29e009e00d7e016aafb7e45a6babb83875bc5c12' +
           '71c534061577a185f4bcb45fe6b421b231afb55d38c7b1833cf500246e71e069f439dc7061187c465c52c4ce79e46c755eac451e41d07558afbc15d60fc0057d' +
           'b5562cb6b78541823697bc809b6da0cb28133180017a6165b50c281652a2eac790ed1808d5113c93386e69f48cf224078cd0e20a78cb2de06cae629aa39cd555' +
           '1d960ebc7d702502539c535d7911dbf8fdd80698a06a6b92ab6caa88692cbe68a7b00daed036220d13d0d2af0de9e2f844f2219228f311b0abb701e498750b22' +
           '143729c98d3afe53ea99f7ee6fba90a57e4039316ad4de0ab6b1d36a35c38939153fdd8659a6944d7e1290fc5904c257e8b64e60fe01f9c88c1b55a35c899bb3' +
           '0578aa8c3d07ebc0f8715cbc2e22da7e16ae83ab452927e8283108da6e813a037f3cd8e07124032c231847e971c6da224d8864e07db7032d5f0cd5066ae8d55e' +
           '17eb04df1b29ac4dfe6fc7be84d76dfdfec02ddb3f9ddc9306ec371776eb471d4d1238fceaa1b9c3ebd5f530d1ee9daa4d79974ab242c29d8f020218707626e6' +
           'bc9b6d77cfae02af2735f421e12554b67ee39405dc5c5cbfe6e1b15a507e03d7cdebd63b2e0b68279ae87c85bd863233fd4f7f9451781dc7971259d8579d05d6' +
           '699f121fba302d82a7c4ed00064de4e85fc78ead081f40c4888708873c3d3ec91aef5fca0e13f5d359cf72079ac6f8781344a4bde3b31f0a59ce2b30ca8036b2' +
           '9dbb00b2a819317a5eacfa735bdd5b21b3a0b5af1c3a6d5cc2c208b105f4010ea80e4125537ba3801a23c24fbaf05ed5be04f2601ff6ce64ea420da1e98a0630' +
           '980ab50be7af7c7c280053b30d5fd2bdb773d98f3301d70cdf1efafb2454d01ca620c13a76865f6c6e015a69b6ad04c9b84b4ce961b1a31b15cd15845c15174d' +
           'dd719990ddc6afbc60d2141d18d8c8bc07c9626435926ad95fd3b28ce46534e14bc66fcef58549795e69e2f64f06b13321d0a894192f939f24801244fc1caa52' +
           'd6c86c3dc10d04a14040d0b130067d38fbfef52ca54fb056034d0b48f2c3bb44c4a9df3a871bd7323019547ad3757aa28219aaef656b60dbf631fe02deb18ed7' +
           '7597fc605c84c2525966b1ea0464fbf493fe22b0b32cf80e53075c62a6f126d1f75513fa6c507beebb34d98180872cf1419b91a7ee8a2a5685f1c8723113b7a3' +
           '528f03046c59705521ef6da8bc0ae9311e94849b26fe9e8499f9c0a0d0ece50cb11b24c8827ea08b9891669ed66dd80e9e2dae688b7eb7b6ba3dcd90c7a5fe8a' +
           '92b9ac255643bfaa81db5dbe921f48d1d92b3fc82e7bd066902bf93b76584046c68dfb3870895ceadf5c238e4512f13305f4f803b123d54fb088ad1dc3746889' +
           '3e3a15bc97925267580f151909dfc5d94e0c216577f83f627ffbfd0a805f65766188eb6068a5bb5c905b6a66bd905aa173e7cbf58dd0360bb2f57849a40ab824' +
           '096b15f8127a7d5cc205918d6abbb8f92f8e4ece656f9ec2e1671654fc53224f72d7c4e94ae0f9e6448b1590d0fae83b0fe15d20fdc0fc9a69319fb36639f178' +
           '7b1936ddbd700550560e0e63f8c6984ed97d3d8efb0529bd4734626247d00515132345b4e564899edda3430f2970b57a25c0673e5e2e1a4b3ef9207b6f6dc583' +
           'fe452f0d4fea0a31079e93c92f8fa10f2bffa68530cba46f448f6544af0aea2fcddf69eca9a1363f34bd8ce0b109d0a63faa4d661aee9fa7cd4413bc91e37af1' +
           '6da0be3c2d0524227fd70e1d3a9f370ae2701536826029e30b13affb7a294dbc24a02ac46b0a739b2d8532820a5c413ac5e3fefbf4d0b85243b9b82fb370b9a2' +
           'f389c83e138214fbdea1d6217bb2fcea2b21e18ebd189d10fe753afefee76d936f39a923153a08a39b5918748213c717d7aea03e43c043997ef0cda93f34fd46' +
           'f974a3cd835f369629d2d73219db965bd7a5af4099590e5fdcbc0a76578c98d162557df1e8101c17f6d6dbf37da7a19646c6d978695b5711936337f8d54fa363' +
           '5554888cd1b9467b70c1b5df5be086263e20f9d308f5297aeb5159280af1816b6fe1b172bc6d05b6648ceccae60279a4eb79e377c5de763684194400881d8e31' +
           'fbe080ad635d87bde3f7f0117d7e5098cba5ea515ebe359f68309f90dc7b0dcf8c34fd68ad409d3bc8f2a933c974c4afa5a3d22d812b84b272e862e1bc6f0e95' +
           '16666c3abdac8441b23c392e5e9cbc17162d63abf571a70fd9edd07b138798975cbee437cdb5c2ebffcad0755cdcbd48d8c291e642d299baa747637b80db5df8' +
           '81c4fcb8ecc32195acadc816bc9c8549393828b01e79cd11f907965dde355b8b3dc7e9332aba2810ca90392406ab3e5709d2741746db584cadad0c9b479c7b1f' +
           '739c70a52b280736f3495595f11b58b6bf89f9e90a4ffa05a5b3959befdd231243137c07d17807acb3fc4e0611902943c0409b8f22e28f49087e566215881cbf' +
           '98a63516a26b20cfb7325456a60b8670b43328fabdb03a642e23e2bd772474dd4766273e4a2d801c380c3c63241662338bf0bbb40e792f13e18cd41bd36ea248' +
           'b49d2b3f04115bef87d6f3456f2cdc0f03a82255772aba6b91825c35d27ec6484526ebccd28a850b36ad5658585e5021857352e2e7a45daa77ecc6ca8110c1d1' +
           'b5bf833224e8fcd47b2b062cf40bc15707c71f5b88a5ac80be6df98718fbfff673f4e3a4c404f134b76f4c29cbb6a991fb0db86d52584aaf5f1a9dfb6467a4c6' +
           '57f5019ddc6ded558c5dc3c831a459c52c106ecb046691df5ed343590c2ccc41c3c71b9af36d656d42aaee13ba4732fa59a7b65094f030bac81146ca0b51d659' +
           '8d69361b180d1bbe82e94a28a5c07cf2921a6ad1cbc42812dddc604dbd9c0e12126ab230a882bf2c68e276e2cd55e6731a3b52caa8b94723990ecd85777d77a1' +
           '91e8f69e23215605a9fefc572344c329e60010d81f8a975e223cda7fc3f957bd4e95cc3e2a5e08d73213c22732ab54c9a28ac043274f93ac87d3ca208969a071' +
           '88e5db0805aba521934032cd20aa7354f09d8273b6235716ae9ff8c824bef040845ae323cae3782e52f1aa635453cf7faf973c7ca33cc9654d6d09a15387fa43' +
           'f306830400504106fa5a49545104aed6c9a0de631f0ec33532738389a1b7a227b465d3d0e9e908cfdaa83692288554719ada4ad833d1eab04919d31d3e21af58' +
           'ef79597c359f5324019b03912e11a0750f5647d951a0cf3b59fb3f306a6a9e1b10029143466812d850f1d20d527d2ad6cbae2a968d0c80ad540cb471a9a798d5' +
           '6c142be616bcf002a9211569f1026222b4615beccc1544f544006dcfca8dea070453a707f1fde589e7017994d6e82eaa9b42bbd6f1e76f86b16ec293f588796b' +
           'adceae3283e4a7d56f556f764a09fcb9637a80d341a9a1cac4834dd6389b74807224f5efe46577f99aa5fdc0004a09b512330ced4e4506320550517ad95da380' +
           'a1e7ccec21fa048da10807d5b068ab0226e2837dbaf693dc0719115fc87e141c9fe441502c8afdc7e32ef5c41212d14cd513148688cacbc1fbe09a6bf3e5a27d' +
           '4d0c1f3385993f0b1d5b2f9e802e9925edb6d93293f1deca12d7cfe4711973721758d8a8deb875494738227c12c465f9bb6ebad0d713a3b48e2c121108a2f4b7' +
           '1a24aa640caf54fc4fc3884eb7f24e3db9af80da04d581e125bd98a1c49c6070381e3a123ecbedf2c7fe2c35b103c40f54fb60ff4d56b597a444c71989fb71de' +
           '2149e3ce893420d70116a123cb3069954b23b221d7a257b5d937d67b4b27509ed8e65dc0a4c7a792b2396084960d089c5e0be84b77ddd7f882415fcb9f2e1006' +
           '8a6a58ffc98a49c56df75b4d1f0c154ed5799a2738da7c3fc1335efd089fb4ea60d163405cb0db6feba1150251a5fee765dc03607a47d8c143306999a1740178' +
           'b41f579ef005477d528a36595c07b3dff360c958906dd8b8cebebb4a522604886f830d7b28dec0c94b2fc6f56181ec3b6e56addc78a822e0ea44dd34d1852e50' +
           '20d9971625d0e75c452a5a94f3dea9da8b816cf83f3b4a5b01e2b19d6a83637f92393d825f39e41d2ac4a7e069899063150e5fbe15473ee2daa09522b47ecc96' +
           '6ebc49cc5292d52c0608c62054dd0f44e5ebc63f1b0dc2408ab9275a6fbdd3b3e162f0674fa3165c5d5175429f8d461eb09f7d0287b5a1ab77112e3dea4572b3' +
           '8baa982db4184b32379c4038803c36cef74f3e2179de883db69e21c2817720eda861b8941b7bc71569fffa587b29e4c2ef37c2a936d6d771f126c03b9c6367ef' +
           '9a016ec66662f3454bacaf43299cd046841db454adc1b03e3d2b57578af502f1c391776f4e477c3546b9829a44049923535ddc6326a89dbda2810f289f58dffa' +
           '02490f253200fb936fc35392ebbc3ad57d61f95a6b45e90e2a0f0f216cf117717ec098ece0b1441a011f543f6ac6d66d96591cd819941d7b457bfff23106cbe8' +
           'f1cfc55b80ff7c2f3b9ba4b833dbe6af1de401e0469db14a630aeff4d368e745c505646d0dee50cbc55957caa664c4211603a6ad8f3d9b8ed8abdce791c16a07' +
           'e63b2759788cfe5e19b5fdb5ac8aacf431b9531d2e92f0c99072c1cc360adf5099a8f66274e544166c0e20ab1e4bd256f67550bd9efcdfe3f694323df50bbf3c' +
           '9e78f3e212071d13a43b6c6d58afe66435d4cf423ff2695e5b529326a3ae3f6e660372e2901d925a265c3c23c6aafd758cfc422b1283fc3ec05cfd348583e29c' +
           'b2f9c8e39cc5fd3e73a63b06f7a203847e08132208a88150f5d4a05d9850cdda578806869cf68eea13aee87b275bba2801387837656005e171a3dfe213540e84' +
           'ee8553b1a3e3b9c6f5cb4da01fc6aea0a9a816dd97b8249e434f967e77e4788391a7dc522dc2582c1156dda168923b5e4f4a28d9b7bef3fc1d5844e26bbf3d0b' +
           'dbdb3f1d6aa65ada5a783c84fa0685d4b349f814fbd9d5c34fd9d91d1e3339b6aee2498460309d026ec56f2acd06664199d5154feab6bc889a7d3f9dcd55b832' +
           'ac1443d3a0568cd3cb30bbb0bd2a89ee8dc89fe397f864ba3dd18d832fa3e2ffc1c6ec9edcf260129b0e85270948403fe4d6870bab46fd787775080477e215f3' +
           '1454102450005120e9b69d05b4dcc40b99d470e7a2c71466cfc5a72ed90bfb810ffe49fc9514693f41e76c7ed56569ce463965cf671ff73623538beae2aff632' +
           'f4796a4f5752a2e608bf116635a2243255bfb94811e04960311f4535a6fc57f2ee20a970f5f4597f9c43f150f0b1224db918f759c8b41041c4a0dce4f5b95194' +
           '82f966cc294ccf24c192a956112079bbd3777589990b19c8c72f682b35306ac48fcc8bfb4cee3b0e57a6ca35921d549c0b89707029c6406eec6d4be9ea709ec4' +
           '1fc170a6287c737371292f890cab224d09cf6c2c9eb042a8d282e5113e73ddebf194f0f2635a48cf1d6f87fa208fe450da8f18631b0fd469d5cd1541465b9f17' +
           'f07413588d7f213cbbb3f698993c2e5738f08069937e13a05b53f78edcc65ef7e4030ff4dd1ed3ed335b72f5f226b8d432fc335c49443baa9a7336ad2d308bcb' +
           'b679ab306adeeced522f4abda15bf5855ef4b909a5c8dff8aac63f5e7ff919ddf78417833f05efc4138430f9cfd1afb585cfffda6e22a95a9eb72f0e480c9f53' +
           'ef2097a446b32b88ce3754ba8d25f1041c5c778a885eb8cc085ec1c734199db76c9b520393407146e01f3a4793382e8b1f10e9f5900b5e2bf5d8c7ab39eb1406' +
           '1f0b5b660449507db86f67e07f924e377483f624e30f4c8a921807cda0c856100eb8baca0e7c54db3fe809e0d9a6c6dcb3dfa211cbb571de9b694974f9bdaccd' +
           '4a4b2fa40efc2aafcdf8d403774da6c8b5637d665795f1922916ef407738894a858728106f2a9e0a8d0c390e0f8d69b2b4508df0ec6ad06df70fef8de2bda761' +
           '6ec50d285eb8aa6e7ca893452125ecb4d14e892876c5a7ad3161b0acd94e9e3b2a145f7e51b1d250772e5bb4c36740d7846c20b88f3e368d7acd8f8daab2e0ba' +
           'd76d33afdf5b7bebe9b4d7d15c1416de1212c6aea75b7dfff24d148a134821714112244a6c7e2e38e9c974e8b0cd5fd7c9ccddb734f418a76d1c768de59cb5d9' +
           '14ede80901bf3a96b8b2be756e9489a7f4cb84fe9f32e2faede32cdf9bf42442d81db77b0152930cf9a65f478056c564a24a4da39280405238d35e8f611b70b3' +
           '74ca052c5e9bc535358072b81bdc6d953bf7ddb1af2d3033b0b615f717ad1d670570014f85d8e1f5c861487df3138fdf91ecc7b260a6c43f80a3b91cf998d9e1' +
           '75d1f75b60e3928be0324b85723c910e7db9e5b8d7ef667ebe6277f7df07341f30fae44dcb880801105a06959f2014293f88ad5d7eaa0231dd1586072689c471' +
           '0947c782db1c91f359a2b74567ecd7944915b63cf89782b53fce8ad43e60e902792cd114eaa28828f83be653070f4e4ed22c2cdfa991e1ed7548c89f63807536' +
           'e08125b34596a77c02cb0c4371ab5a78b0e6301f8ee20c661c907601e7fdbb36172d9650b35d2fc82365a12daeba827aeea789ba1fc71267fc08234855d18525' +
           'a35484a88464382065bd34eff0af117acd3309dc577bf08e8240e063e8bf170376d9eed7f0e8224b7a62ae39e2fa546baa7e2d79cbd2e54076dbe016e89aa86d' +
           'a6d676f553f8c943abc05cf476491f674c0ed26e89e7dd6f40649f8e3b491dca91cffd484cfecf9cae8cb555d7c56942efc238195dd841bde4a45002eb711a5d' +
           '68dd36e8abbbad0450a1a4b53edf3accd5606faea9d2c3b5cabe97a6cd51d1f6f7de1483a41238976b2eb2977dae4f0822c730ec7b5dd10288dd30470648b0f8' +
           '927bc8047c4de4bf46c51cbf9eee17e9194302ef866de3787a4fe386c8efebb4f5b716202474a62868eb2dd326b06233dc525469cf465baca3ef2b97ae1b6347' +
           '00cd65769c5fa25e26df303fd440fdaf7deb2bc4bfd4d7ad67c46344c5abbb9a14f2def61a5653389cad921763480eb3827f6f300b909dd5491da05ab59854f0' +
           '67efda3f53af6a5e5df4c59b6f28813456e5778b25fbdd5d9e6fb788eb5ce3137220b6f1070c47fee8befcd68c427ce9800ad2a458fbaf80e54d024dd45c69d1' +
           '81ca16ed38865b80d584cc143095456dce68cee079cbe618a5b373bfffc6b7d98f69881c8666e6d6255ea4ba1b49845f8421885fd32ed6234bf1b8814f29b585' +
           'e37f889d741a298e121fae193fe3a530710ac62c8f773f56a552529aef30ef5584591a2faaa1cd98c7d4e052f164158c76c5a769a9a142604a8f38f9bde66174' +
           '1f9997a0d0b8bfbaca3425bf6281c9a8fe97012b09efd67ba57e7ae471893d2571494cbca536d3df6c42ed515991e3ef2030fa89ec7761e6bf4c4adb0801c712' +
           '2456587bbb4d9c0c87f220ad7c976afbdc15527d8d1ae8fa7c25c6f91a44ae9815f3d38c685f33c70e98270b39c87e3d308e90576c0abb70d29f3516f75af4d7' +
           'ea308dda1e6a1c21444a8c21fa653c7a4f23a9ea1a61af854ed156f4fdf90d5e4aff74f8e31b6adb9520231c43a15a7eb197ce1be85bc1671d6c2b09a6fd5b84' +
           '6a25baa7f2549470f353c1d26baa6e6ebc8876d1c77fe3cb8c6cdc311cd6a1c7ed892d5b492c78cb0315d019f365dbf9e09507512c0934b872fe001b92a73597' +
           '3e4ce113b26fba0904130e47e75b5e053a50d6d195bab0d265d77d8a5c0b7c3bf124df197e12cc287df5b7afd7d0fc45036d5e4749638c38f1b6c046075dff57' +
           '7570f8ea96b0f7cff621d75c20ebdcfade2c244045068b7e53f74b578da45b9f29678626766a5b88bcfb550af1059119a603e6c716acde2295e4494871a1b987' +
           '572cb10b4e6dcfe387775285ab831f26284eb57deaa1d86f5d2cca3c7a73ad45de32cbf2af0b85e9ff190427ed77cd90156e74049df7b2b6c0c381b783efdc08' +
           '767f092c4aa9022e053d1ca344a5233b853cf1ad103ea44b39e1e29e82cae549d0e3df543616c3510ae893c22c1f5334b4aeb957c849b99e33447639e5f12151' +
           '3eaede8f9382890dd7e9892635f02f3e80091fddbeccc27956c4bca0f0aac3049ef2b6b1187af16c1240c815c7cb1a1fd7704b15ceed442e4a1fedae5ccf63f9' +
           'fef8180cc9c1734258695b2e9f2936086c8e4f42a362e9aaaf0ad1037142a6ca7ab22634f1c1e97d3fe9518cbd0d83c13d947398f452f4a684d97456de50d684' +
           'd20c037b615d8edb5f727f7327e418df8c424fcc718b0e63970fe697fd86be8f91f44ceda18623e625b33117cc955fe7b0aef93b094a9d29f6b72d4a158c273b' +
           '7714d71556439a19738a7623306f905921e062c4bbbd3e1aca67433258b2ab1269cc62fb8b021b6e2c723a9e47b6322be50f16b3120a601ca5db6931c196bdee' +
           '6d3914ef78f35c86c2088f74b49caecc151af5a1f58fcffcae423801b1f6432e93e39f5ca919ae5d6d91eb01b5f45d1fbd9a6be7184ebfc5881663ad9afc7378' +
           'f365dfbfbea96749243bfa78c3c2a6ce9e8620087a1a224f52f3cdf907c2deb2c477dd66d99caf4d5ac8afde1990cfc534bb83277cec3b44a380d968183f80dd' +
           '6db062c77596879d4ba638f44fda62bf3a45416ce5acaf09d35ddbf8aabeeb98fc87d27027838e62907f2a916f6028b00bdabb66ada20607845159b7c5151f0c' +
           'c41345b075b30c2d370ef51c2a01204c0c5ff5857f87631212b87d40143cea79d56bc49b8f68a03b62c56a18037d0fda959427fd30df08e5a6400f04b33ed45d' +
           'a0f8409f8e445708ceb23eb79c4c4d97f377b6ef77848cef8fad419d59e60b0c6508a84706c9050c0519bb11cf54aebf750bb2d5c6164143f1f9b1c76dc4ffa7' +
           'd13dd8078dbb3e52ff6e3c4c4ca1b312fcbcf798f233d4a6511f441fd84c2783cdaa86a1783d19f5440bbdb0402b11ffdff8d47e6f21642a4c85192ce68e6e93' +
           '8bc00d3ce3419e3bd262520d1da20e027cf0d1a3efaae38d92403a49c2e61376f26734532110ce53febd21df50461630eea963d5b771f49585ffdb2d722dfd7d' +
           '0fc0a7657247c049209e737e1486eae4599d210e104bb4f504f30a47e4c9505859f800869c576bd8c19571658b1275f6eef779e4bf5503be9837307bc9396b9c' +
           'a2164913547814a341890ed90b1cc1efa23e90e15aa1fae4d2f1bf7ef81c3a09875ee9ae5a7df02936b499a68dc1a6b2832c729aa7144b5803472409315cf095' +
           'd8fe824b589aea77309c09b658b622295b0ecf7aa1a49285b0baa565eee4dc289615e6bdff7a5168b86317861bf2f0741167804f6256cebe24c71c46f79b05bf' +
           '2e37aefcc9ce8e3b703e8ca61e386815c31d3649e7637b8e256d42f4bb89b49de275d7c070db4e9420bf35424f570f7178908e2891c76537394f7800abbd34b2' +
           'cacbd6ee4c36b34850e61e4678e4c1bb583aec527030c8e5ddab7bcd19ff2f8b5c1dc6f3e9db7686f69a8f579850cd25a1eb18b41cd21f9ee5d9d75e73cb8dd5' +
           'c454125866b15e826c5876e3ecd0d70ecc987c8430d6b399b8d1acf607957caead1fab9351c63641307b6ba3756b5bd6bebc5b2cea7a14f18dc0362f66889206' +
           '52135de7134aee3077c4765f987339a5da65fdaf6da9b563714d24c67466ad6cb96df5aa71c9ddaa0eb70ddd53654e2abd068f806ffda868338758f1122c1f28' +
           'ac39e9ae483e0b17cab98635f3e27cd8432e2c5bcf0f3205eb76a62f9ab8b282c6fe4e17f8ee9bd988ae763b17c65896ced69898b726e09ed95aee96cbeb32e9' +
           '3396bd4e85efedf9948dda21ec142b69f58af326e747cdd102568ff4efdda64d541fc678c2f139247690759a9a8349ff15aae547ac534755ef4315632623dcd6' +
           'bd9c7e06cb69ea33125ff588665264b4e3ab2a1b5b6057898ffc5923a4d3ab75dda18c72e00e5bf7e5df140cfca9d726ad69581f276fbc4b40a3fb76a95df563' +
           '727e37d29c4891dc93586249b68864974c0bdaeb61320ccd7666500a86e5559ad8846a5be809f4a6bd2441a064af3c4480edb6c0def88acc523ccb4be8ea8431' +
           '8bcf383747345cb9a3a31a7d1979f82ecbf38d62779ea9866f4e8e9070e3a7f50da3dbcb9b2cae6229bab61e69c5ac90c4395da67e92251765282cbb972a41d7' +
           'b63871ac109b985c069ca47dac31f2f1ec9ac101398a902be6ed06b29e696f317336a496ef1b9e47d5f2d1bfa7c81ee0af56cc0fa943427b4189d586151be99f' +
           '448c23d8623ed3236663e33f5b5b6fc2e4f8a940af803bb671fe90b216cd5a74c11dbbc950856a64e6361163a5ea00ef70e3231fd0ecda846741684731147cbb' +
           '6adee8b47d3fa6778066c23ecbdecd91d12ea3ec78d6e9d7bba75de00b8a3906a24a6c2f7ec2fae7904e4da4e695389e320066950abc63e02f4c39e6d5cacfb3' +
           '203955f9dcfed48fcad941d1fe0ec6c2b08b54bf3b6bbf8e29ef1b507dcd5a13dad1609dbe8c9d5110d5373bc9ccd2ab8f66a8e74821fef032f69bc4174978ac' +
           '37b27dd532abdd4dfe5d61714f3b690b8e3215326d5676789b69293de06985a4be23a15dd3166b55a4d96a66243f1fae01e37678f0ce1e17f81fdc0e82c726c1' +
           'ef2e958d32d0742f0a0ccd391d2deab4ce98ec4633d70929107a238f869bfbf5bf8d5c0c498f087f25ec8f47397ea181a66524b72be8d641a4a145cd1dd10851' +
           '41a622113b27e48bf30e27c73a4dd81b822fada381fcd0146681678b311be01677e33988e2a18cc2476a0ef37297fb1a21cdbe4ea2963d4ca2d79f80905a15a6' +
           'd45c3b1a912fb324e57b76b915f4edb1668cadc7db13998bdf57dcbd66706b80fc7c966e820643b18f4411869354b7fd872cd860523f6006205892a2eb626360' +
           'ab69b6936177cf098e306456fbf434fc9504f52917b96d4579bbf36a4ecb38d6ee80d0b0c94a35273f58e14eb14cc50da4032a3a4709cdf3e725af1406857943' +
           'a1dd526b5f84fa2a39307f9153d86e40d0e7235d5eca66fcb10d86f8feaa8cd91b1c7ab0ec1b716050cf68f217024f97e8ae3b6915d44968e2265ed3fdb33215' +
           '3ff9928fe89fd255143c02e3e9592102f386aad43a09625113f36a35a294b8aca5896b3629ff25a50dfdac34d7207fd1b248af2a96917b6ce86d7c1850cbd45d' +
           '8adfdb28665f751d419695cd7bc7bd5763839dc36ea0c1bf251806ab12ab4c86b82b99fe181c0abf3733bc28087f982751bbb81990e10c9e8ca7896d7ec3a354' +
           '80fc6570e9c006b396fea295f17086b4c0151c3041a8feaa16169b5bb9ed1195aa2bafe5b4c459a1b6e63123ebe4571f9dfa125699c2757e9deec70711c79013' +
           '05c87e97b57b358d4b81ff3233c773ca9a27a7947e2a992d75198c6bb47fd48f61428d29d9eca9c0a43b767f01e01fbc92ee84da8fef8258ee170decdceeb5fb' +
           'b6e70ee5745cb0feb69acb838d10325cc6c3129a963d6d6e67b3fa4fb38875abb2029a5a84a804ce88af2c5376efbabcfd0dfa86c40db45e17dd42f6e8ec0c7c' +
           '5a9168559463be4665bfc231c8455bcebd794bc6211aa1b62dc57d692510fa69b7209042d2324c35ec191d3ed96a248474dacf3e1e505e40014fb7d80fd0e71c' +
           'ad94f44a1fb90930ddb0a8ea77a0448cfc239307c4f1d2a6b30ebd12b1b4dbcc1cd1f63833566425de157dbdab8d2671a1d4b1af769eb798d3a3ec1eb5481c99' +
           '2800b0858fbae6d8233a45a08c64ec9260ac1910b0663b13cd5f23bea1965e85770633f543f7e71a324c17c7cdde4ba8ab4b1c8a643b690bc6dfc3ca6a54330f' +
           '505b4420e86e1163f618474472560c80e60f64632b251aafbcb3df42fbe91820babbd5b057d88fc21193fa4db1d8a4ae904259bdab6a1126cb20e9ef8e0282bd' +
           'b11321e83d4c1e29d5f14f2cd79d387242fbb65cb8c315822202b64d775fb5e2eab5eb8f6f0da2fd39d9481e29f293c565ab60e834c9187d8f196e92902ff674' +
           '26365036c72348ceb45f92f3d0875369e282c7df6d0277d3e514a55277614759d8d0ec871360ee30854af7117d38440cc1aa1b46077178fae0aa1a18f3b223e6' +
           'c52d532779682779f3d3fbdb37b9a426488447c734103d98f69b7b2968e994fe3f465cd8339391ff948b7da502dc593f45e8b4d961b14158c9f35efea3d5b2cc' +
           '52708f0d30a097d1cf5545d1436d82cc3566b1d5044762694ea4d59f9aa0322d660bc92e16affcc41011c503428dff3dc19fee45de78f11b530f7ca60e0a1d3b' +
           '7d336aedae95542d8d97d0f706df852d71a613829c0fd6cff7e68b126999088e18496df1f70c0e0c7efb3b9f8a874a9780bbfce912d19e39e315d33894193253' +
           '4ec29b47724385ba632bc921f3471e830310ebf440be1901c5f5f2f3d90a9fce2f34bd429b02dc4dd57d3c96ee4c29cb36fd765d865094e67ef69b3f948c0db8' +
           '036bf16c45a3d97bdea3359b1bbd48cc35bc3fd6d5116bac13f05fd26b5a7f32b7a1b2723ff0055646a1584b0ca7f87a73a39e9fb7881a75ece2a90dfbf1a9f3' +
           'e75663092bd35d9ad9cd6a9b19ebfb8e0d6e2f06f40f7b030f3109a41eb64ce42893620762f4bf70a88e7303ecf6913f743ccb665f09f950d819eec8b95e5899' +
           '1510bdc9159107ac8374ff0f72d95fe6f03546c526f715501071c68685b791635920bd4aab19b3d45b2efa018331d579f4025d91a40b213a3ba34aba6f866aa6' +
           '593b8cadb9ac679279fc14ff1a791a0e2031ec6835bf67f679b2f5d51881ce0434dec27bf007df9a7819d6430f97304e142fdded73e2c5391f0d5dda6f48289a' +
           'd416cf52a2c0b22d371c3f2cf2a270ff2ce9e9aa924afb11725f0e38d6c863de06e21a2b5ff57fb460136306da87f2082b11133c904f1909d6759afb32a8fbfb' +
           'fb4b73719901a0448936ce2e89d2c18e7a4c41e693d4665a00f029b2f45947b5ea2ef35bd391a70f2a6bd82b5d788960c7e97f4c0c2008126f5ff7ebd75ce9d9' +
           'b852dbc9ebc82df3a0841855e6b73df8a9c676ea9e4f6fd72654dcac202090e40c46bda9d0d40b00cf77d8621ea7b8fe71f0426d83c065e8fc8a64b1c3e24337' +
           'ad948e2d0748eda31c42990ee919e8d677e438fbdbef5f40685f975351c704d998826801bf99010c935f046bfa7a052a96d44f2d10c6da8602e842526d0edcb8' +
           '90df46d720638009cd5957010f7f791cf9a5911c99bb0e1cebb10410fe62ad722879e5a5ca9635218b2fc3aac886584e336270a5bf7ebf03a55f3ecb3243271c' +
           '3da04627d4e6c2e7b6d550074a29a673db8fc7e46b09e0b96e5f1a254e3d49707d0348bef7f3dc5c7e1c447f9df526eccd047e2d310f0adeee41a410230ce74c' +
           '282e8a4abb450a3829a990eaee9eebfd8e3c8fc8644f3a79296e6eb2dccbaf09b6c3aa247476d7495b45bc0aa57e0a682bf22f130e79c6480e24a6849a52a7a7' +
           '460baa418e2a312f86636cde78100c4aad5b61275aaaf5d907163983cf9fad666b11e988a5c0ce52760e25de4c6f6ba463ac63485198e1cc362e3c72edd7d073' +
           'ce8c5988f0630630eb451e181686c7057680b6c5fbc119e2fb4d25fa04b767ed147ff950445220872794cd7df2ec039777e23ca34c55bc26f5667ad42661aa52' +
           'a819d8723be083bc2ccea23abc8e7f2689f6f70984c225a4cbe03aef99f89c02126a0e58ca7db853e862caf0b2b64e9c56aac2b6593dff9b2229467e55ae12a3' +
           'fbb38160e9cd1e3b5f840c023722372f4c984bec7726aa8a9bf2d92d464b792032c4eb89b8bf3ccb5c6dbe7e84f96a13f27fdede15ef924a4f7bed3fcbb93a65' +
           '5915657fbe1fb944985f0e3b75e5b24551a4c389c4d2d10b1932a05218b6a3a32ba269fd6f2123269e84ee5fd4121b305ee0dc20440c837aa19722bfdd1807a3' +
           '0a2e304777f4b9d174ad42bcd96cb900679d2ba968d95cdd545acf4b85aea56aeea583bb2b1c88ada076aca24099711f3dfc69c5b50fdfc386f59d7b9ff45ddd' +
           '5b8fa0fd386221bbc6eff0d30d6ef87780b83ed08d4b0a516f136d6f286b4347443c960783dd0b8e8563c38ac3ec1306e29bf6d4ac99c4c493364ff25ffc2de1' +
           '2e8960b6da687eea45327db2ddeb46b13bfc28950441e8429a29b32d46bc073c69e613a329095c56f96c1fc6dcce1120146976db141209024c05df36d5c2ae4c' +
           '59adac90520989f4d924eeffafcf3815992e410508f32c7f98fcc86ac2ca2d8f7a27d9472644ac782ecfee5f52147e01ca04e3fa79eab905d69527bb427bbd3c' +
           '5b178eb80ac943dca0c1ac687df5b981bb43b8706dca1b2a560e82cb4afa520fbbf2730b7bb2cd051eb71db1ad10ea41434da8e6d19e43f33098e6966b31a247' +
           'aeb6c40b1310174a2a81869f03af60d0d137d679415b73086a31900da847c3bc55e8847c56284a5ef0a48b86aa9bd49358c704b0491ad6e47789c7518c0ec896' +
           '1bef9f8f21564ec5342b6009cc39fc85de41da5987bece152945b6933d3259510af3d8317170d106fe9ba22832f5c9e9a87706cfaedf3a2ec8f30a0f9d6dcfa0' +
           'b28bab363629652bd8e713bf5fad8e8204aa8481c2bfc7eb77a75181df527529bc0d58f6fc59e0d0513c9c3151f29efbca655897e69d4515536c80db1d368b93' +
           'a87a516cc8bdc4326da5d46bd551f4ac7fce053b43b50bdce8591373d8b0398b65352e9fd0b4b0e6c5ed496ef0e77c6c6bdc580ae094771d0f0e1336c3c3eba6' +
           'daaef4135836b43fc11abf13895e596674350ce521d9f586a69d2170e5507a32beef55df5adcf2cad83b9c27fcf14ed68eecdffb1d3cee7f6f976bbffbf153c8' +
           'aebad72b9a45cb5503730570b8c37e21f778e248c4eef402d35cc02fabedd6e974fb72dbf9cbef5f01a40f96bf4119415891616a97ddcf49cca36e446c5e2c19' +
           'e084ba1fee4104edcb86f38b7d7ce78cd15302266ed4d7c330c745247e0934323f785f6c1442dc2651614f34ec486fdffa421f4195afbb4294646a884fe724a7' +
           '4f69e2cdfe4173aceb4c9b09553cd4a78bab89692bf6884f39a1fbae792eb0627b080688978bb2ddac01c0d7cb48702c3d5acfda818ca6c44b225419bfc780e8' +
           '728a1117a24b972371c31f75538e2c761da632eee93e707a0057ada561e5e9db90efecee605d4c2c8544dbb5c43163962113f16d6c1dc78000913331326c7bc0' +
           '585fa3b16dad634fc2f9939d218d9e08fa7ce23ce408888e10266ca55e9eb3e04fe2b11f54edbf41db9e85f9055f2859f625e2480da4277432fa3275e0522b8e' +
           'b29d10875db8227ba90d5ccbff4d9b5b147e35cc0fa3f5bba11ed601904c9fbbd43f380ec40016c85b72c94224860de4bf92e14bb33a02bc49d0df5cfc649dcf' +
           '8b79fb2aea869e9446100f237be0a4d24e201d72883a9e5b7b2722555b5e37d94b474397389006b1275d510933ef66f77aaab4403ce23908ca83d75510bf8818' +
           '8cd956c60768bc882e702dca1727058afc956711215cfac7d50f6bdafc072c5158f4db92bd60b580f40e8285a6a99407e0a1eabb24e0ca6094aa1d8920114333' +
           '3a98a1c437529715961228853dc5602262ff2b6126b39d2514d55bf155854f62be64676cd2ac50a231cbad933eb0466a34b25236f7d6147f9ebe7f8b9f926b7a' +
           '8b8947ce6c7361074ccf1d8ffc8f69541b5b8ccdb8029066f6de034357e2326a62f01be104d24dc743a4a6ef0e43b61d24b3e3df7629deb5fa0f076d7c039e40' +
           'f33eee484734756641254449eb51dfa4aa7c9546c7a4c41e0f6f4aff74f8c8579e4d47d3326a4016cc5e4f1cf51f2295db3339bbaa766bc716274e9e82675d4e' +
           'f57ee9eacf77e243a4b21b3bbf500a63535794d384def1ce4a05183a857587bd3521d7b3857eeb8610ecbbabc6a486ed70c1edb4368d9f7b74d380b05da7a692' +
           '8488b35f452147beb2e5fd1110988ee7b17864202b3a74b490e039b91ba41b540d9d268d3f9da3371549b8b3e1032c16fb78e264bf5c883d3a4e0b4b008dced5' +
           'd1718cfd75029c63e82acafb89f9340f10a407d83e814d0c4c72b3e7d0b3765edf013a06a61f829b62c6fdd24abc7f2d6331c9619a46337bf0ed715d8e88e813' +
           '8128b8e7204a2a22cea11cb321d49b854a1fc0a100dbb60264071a32e607ff0c9114ebd2332dd702d64e8358059f19463998fb448d31ae7c0d3dc25a349a73ae' +
           'a7983a0f5753cbfb930def2c9af59f5ab9c480f5b7653f8a2fe7f1d6890b7d36e7464be8a519e93d6abc89a2d8049101a440ffb11a7a5b59df58808a349abe0b' +
           'cde329f52b20196fc37697375f80351a8f7c8719636ae0fcac7e02cfe9d40f25d6f4d12e9c09149a8d62e40206a54adb0d6a650f2d69861ab13b57295fe7515e' +
           'bf3ba909160e61f3b07c68166d70facede9b93c57ef413acef4965c6839ee61c285e15b06c1b0e0f6991f753e06e70d996e6f9418ebfb390ee416c7c46e27071' +
           'f279dff01f799f0254de8211254d79ab094c8b258572cb95dc2e4cdf587a13830000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           'ed5352dcda1f5de423a5579806841ea6a2c28ae0a275c869104c575e8c38f50082818a8b241e9a2a08e427c0cf6aea01bc000000'
    },
    {
      set: 'FAEST-256s',
      file: 'faest_256s/PQCsignKAT_48.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8210f4fd96ccd125c5d5d5a1364a30c16a2dcc2fd677611012bbe4c7caacc4cc1ab',
      sk: '8626ed79d451140800e03b59b956f8217c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      sig: 'b4081d68d0786792a9969a501d79b23faf6d2a6a65624ef371e740e5462f5deec082fb2123924470c81ab31abb4a9bbd8b9039b9548a1846aea0c41eaf893db5' +
           'd6eff4754336b9325889dcb05b13ec6f18caa5dfcac03f1aa34c7c423b21d88f08e1323fdf1bad6f330863da8f3e58aa4d9f1585d5af9b008ab3a46a57fc8e7c' +
           'f6148c8e0cab9e2d727dde72799f15948d34337b3d2259148652bb40569ffd8f37d9378572016c0fe24df96dc012ccabc8304ac00ed18602530ad1c3d8a11fa6' +
           '26c9b169829b2a89b343643188f86e6d78eb354ec2ff9f276f103115d7f57b86a366121709d77e7e446682ee0bd7ef41f69168088038b2c12a59091a3f076801' +
           'b3666ea725076597ab6245f21c6da8202c9a87140f8e17cce08e0d34c505076f1aa60bed77362837f57112fa88226dc220b0aa3f13f18857f8e3d1980b2340f2' +
           '992f347035353d71c45613b18ce0bdb575f2b7235f1a11337430c539649e5037f7f6cca29b3c03fab9726d7ab224ed32009b7067b546514c110fb234458f2953' +
           '0abc7ac7931f0852fc1675c83b854372dea84f5fa0c4e92bd1c3091de32564378597f99089f9e9daa4d52c1d2006c2c77b8c6d74e8142951cf07e50f54aab89c' +
           '68ccddea43648a3a1ada5b21e8a4404489b85aa2ae05ee1ce2db8d08322bc0f38b948b54a9a1f75d2f757b85acb8fcc15cababac57d141c883c6f4aa7a495a6e' +
           'd0c175aca665284e31f82629bb2c36f609e65e8deb22b31615c4063ff26775710e69e63b319b54b7c3bc028b314a82b5945aa8684474abe4d28fe084d9a52c8c' +
           '15bd9dd41fb74ec8b8cd9b8c55d7b76be96a3e4f59334bfe308819e6c8785a4ee1924acfcf666eb79db23420118bca84f426c46b6f4cc2dfb9d36cd46dcaba6e' +
           '23c447d3d85d1c31b12468be435252955e8728c7f1e94c43dd317bc8a466d5501d0cab482ea96382f626a366169ec9474b7c58e1b748772caaa619728879e17c' +
           'c482ecaabeee31525c911a006799f55dc4d11a0936af89cb5fd27cd530a99cb00d322ba895b6c9143bba3a768cec0e4c43ce10ffd6f1f8bd41adb86a3ef53648' +
           'b2c1ed4bb98064fd0305a3ff7d8cf6da76400ce40fdda2adef0122d4aeac864628cfc34a62d2c3e7b2eea2cc2a5fa0e1f5e8b3ac8a04869a0b9ce950bec28d71' +
           '70b8f0e66f2589aee82094ca7c189750da8ce894d77ffe2914abf6d8cb44b83c143791abcf73fe6d40fdb751a970f0f31e1150ecb0f9f6ce6c669627e1aa03d6' +
           'bd7cb4c74c3bc079994000a2b2eb17248a43c92fc75af7993172a87f6ee9e3cf025b9748057109f29b22bc54733022fe9b4e3506e33fc546451121caca7f2855' +
           '2cbe7034618f6bc50cc8c9be155f722fb76f19495e3b85f5d6fd307f7d95e02089f6eb8d2ef0f00c3ff127dfd77930604c70211c6f152f9b17b19e4dce50a9e0' +
           '21d9ca65bb03edfe744cfc22920126502fbe1e3c873e18b5425255ae4706820c0d7db6db1345ea2cabf9d9f13acf9993a86db1ae78fdc93352ea07b01b30e10d' +
           'a200f8e7e85c482e677ce4269308c756970c72d079d5e616f3e2506b9f2c0908697259c12667e979bff7e651169c77a1858cdcdd09581c9be30cc418f618253c' +
           '010d2ca4e72da57c155704ca43de4853bfdc80d290f34b0682759d08ae95007d48dca7765e1b294faf650cce44db48045ef2ef4f940366ce9605e07ad5a40245' +
           'ddf0b0af51e26d804698bd60c3a02c422a86bb44b39976583da59c63eb6e840fcb4ef737f69ce34fc0dbe599de98dc18e5f0285517b4c99760b0d70d22831eb1' +
           '45876dac9faefe03d3f5cb9ffcdf4b626a380308bd9310451856d2e8ac4219b99e7fd9878c54a1728310e9f882df5284ecafeeb0fde7b7340086631e7b695f4f' +
           '45962fca2143f73fb942c6de11b30072f4851ed2519e761dacf74921f8ccb0198a4bf6cda2e8ce42576f01e69afa71460242c540c59917e6ec3f7c48d2a5f516' +
           'd8f98acdceffe0abb91b552ef5f8ff83cba26218ff55ee3ed8bf4815618277da9e0cbdd147760316da025d401b827330f2e0635bfc1e52b6a59abde4d73abcff' +
           '3326acd52735147eeb4ba060e5afffc360afb2feeff05e723ea3b05865fb784c9ccbfbc7c75855b4c15b89c03efb7b3c6890ed9c4feb4b603e924c0fc9cfd5e8' +
           '2e4619b2d6667fca680579138104ff3872bd28bead02fd9b9f2eaac56d16f3a87c1b0ca6a51e1394e99c37e1e6a78e1f243efec433353aa33f3deeb25ecb950e' +
           '917ce7d58397d43273c3bd856c941a456e4c3c34d1b1d63d56eccf522dd521b8291eda74cf4945ea77e46be25a71aaf880fa2d547463428665d98c1d4dcbc797' +
           'bc619aa674e87e25eb6c7c8df520987a680cf9ae5e842ff9438cb746862cb47eba9aa2e72c94df430965df633567f1385f86ac2e42047c071cc513351024c8be' +
           '02ea8a960ac5e2ad0c4f9196c52e7a1cd8a69984587f03b2e1fbf763d9eb06443cf5c6e9fc07a70e6a38e5765b3bcc90be2e213c938b85ee27777d5f71fe0396' +
           '81e23dd7d30809edff2a2be631cb76eb7d4ab7358881295c567bb479eca3a42edda1607d40d1c809d5d49568644d661bd40d56de4db959907548d41fdb51ea65' +
           '64916b42a3c0a6b2fc62f0a0d49b1f987219dfd9b3e62a4f6deccbb7d91faeb74b76989d93d4919c991a9a67852ad2cfc264e0565391243f6ab33d92a7411c45' +
           'a3b814de1fc7a04720341fe9f07b4376d3860033b6925b3068fbc859c1123174503a941dd1683cd929d4a99416ccc23a9f254d010ba7a2486a45c4be7b07f082' +
           '7df75f4b854a13c36d68a0073fe58850ab54b0f81247be67a445b8260fb81ef1cbb7e0e5f31f97a9d1b3db79575497cd93f7c659424aa68240abb49d7b4658e6' +
           'ef76e52cc5c3c676e368511943f5d7427f8c114dd409fd050f915f84c375748c5688e49c719e2d0d81fda147b926ef1a3b88ae802dfbeb43a99bd8bc6193a008' +
           '3fba3b339ca9560aee68338ab4cdc13c850edd27af85695b9f84d5f2d5288b84e1b0668800018e35e2aa529a53f37c0155c9ecafee472302dcbcc7ff292a65be' +
           'f493f98e7c079a127bf5ccdcf35653a8ed40dea6669c64402adf448e33fe617509cf2bafd1878aa8b0ab296eed7867e056e62bd6da68de56cdeb84e6c68c2c3a' +
           'a8af96f671336de0f9f1a3469aa77f369d47c869f010b589fc1d412c34e3f4bad019d7ac7c76c1b2e8a06b7ab8e3d6dafdee5b71ab2731a00e774258267a6b65' +
           'f273a7919162832d99ebda59ff4ccaf64f5cdcb440f03c65ad1edba484e5dc1cd9c9cf21dce4c6395ee9fb9a350c0814e36f638333548b8713db88af53a9f2b5' +
           'b951a8c7a96ed8923ca1cebf6d0fbf19f473f08cd79c184fb245492e0895a46c94b2a59af74bc91317100ce70f07b0b8e62025536167a8db09843f1ae079f6a9' +
           '2c7381d2cae84aa9667b9aec7c963c128d3df7ded4b2ef8be0582397c5859f950d0521b0b14144b8fb8a8cdd2e3ed1f7c8a6a2803be34b9c56770d84f5ea8344' +
           'b818bcaf0472dfdcdb96942522cb24bb801c59047476c5b5ec6f14c513b4c91248f35ef1ea00147d963f5f8cbf3f30b5399f8c7465e0303683c35a40a9e090bf' +
           '8ca7120ffabd57e417502e78df79adfbd7e9c0b6f30eb2d4eb6512f2921ad906225839470ecc388edd902efb77eeb6c24028118e2be56396d4ce5dfc4001fd4a' +
           '3313f73ce56c21c645045d6ff5f41047213ddeca720ca8507c7a1237b086d2630f92253a0ff31d1da132f3607fad4ce7cb02f764913db196d58f45253c7bdf65' +
           'df52c364c4c483c4a7e7def79b7adcdd851f1ff7f753f47be2778ca2c0753dede88e0459dc737e32b92f58561fc9de50d82dd2e28a55d773e1cd58879048590b' +
           'c02a2cec3f5ba042453cafc4c7dd52fdcd22ef5ae894eba3fe3c76e3386db9d1d6507fda4ca7aecd768b2cde4f6ccc694a0b991b0c9caa9b50a348e8a2fd56c3' +
           '5b496e8b00a2a24b1502fb9f1a47ec1b85f253add995e3123f24e876629ef01ab58e0a3ba96cd601e6c18e56a2bd64593eda9711b821c3296b03f0fd5fdf0009' +
           '937ae2dd851bd88f28c4835e085afbda1a82f6da2d4d6fc5e0404950b973fbbdea0fd1eaa26db82bdc06114b2c74fd8ef4faad43c43e0a1aaf65b4e06f8b81f0' +
           '3be165954464aa22666170906be9d2aed7440fcf854a1dbe6c5af0ca30e9c098c561ddfd23f0215ce89723216e945fe109757e96c27fb8e55cd5b83c341da6a7' +
           '151505c0d598a11c348afa9b0ec4637c279d94564a41a8bdb59914ce41436889001214d3ae1757d2da760e0fc086ca586ef56db0da5c71817393591c67a0d05a' +
           '2f36e50eeece74ba889676acd5c303ebf2df5d2f04941ffcfe80527230c1f65d7c712b67b24f4f51d6dcf313319ef57a99ad2cf878c79f5b56e8ffb06aca1d81' +
           'a02cd5a5f2ce2e23dc1637a4b4d289c7e7c3b0189bb3c6cc9a158da8c1efee683823907cce3d6be9a6ef668ae55182d1fffc60ff5bb48b183395284e315ce125' +
           '86c69958642ad252ead6b3d327f9d37314be9f0d62aaa3fc8a58aed58ac1219a1d5d3825df67e29e4c67850f52ef347101117d063eb3dcbd2ef3c3c7b40c4bc1' +
           'adbc68bc82a54e30cf9323fc1fbcb8c3d9000247ab783e8de4f382220e6796bf3a3356c170df843a5ce4b21883883b844bb2cebae1723b8e9c2594290fc0c591' +
           '6955ca0df18cb78aba982d24815df6f32d03c8a682409bd4b21a19b21f51438238da684db3c548ca33abb403f78985656b6aa4a950e5519101eb8111fc12876c' +
           'a58ba3890c1ad861b539e387964cdfc1239e15948f5dba90ac78381e8b3dfea98ba104055d4d7222bcc9ad6ea13142811b3eda8f2effefd235f1c7bb2f28905e' +
           'd505d1d85570ee086c69663c15d12507da43a51cb9b6fb42aa8417c37f0d3ac40ce097d23120f50bb0d407fd65a156b2457696f2a097d2b302a1f6205bb8beb9' +
           '508b62f4645bef0083034a80659a65066d10dedb9a01aa1ee73e7a835868c789aa0ebbbd6026a318354fba72e1d09244ffd65755cf42364bd961e9aaaa03a87f' +
           '0c2cf7cf536c2840a479226720d013028ed8ea7ce090ef43f09680973e45a07adb628821d9ef7a90faec47397e2b3feaf9510436cefb04840f6b24d76773af56' +
           '2c72addf556765845ce36fd9e37e1b529af69e6df76754d2e53edccc0361c2e262f883877b9804cf1d172f50c420e74852c9bd8ae73fd1751057cbc133c7b57d' +
           '3a32ce1449c387640c43d5fa344d0ae9af298abebe161a22d80f4851458077b83416f7f60fa61038444f19108a937333be5f93d4f73c036e1cee81af22ba7f23' +
           '0a174d8b741a037684e8a9b9a30ca017890fa17de4389348eb48cc7c6bb10d29f16d634e64da7f72a2db2631faf30a94061197b95d0ba344a3b96d6b243b7890' +
           '2e040504a7ace8dd0632a0c89d31916b2142e472a829cf9e2ccb2b742138747d060c19bfc712c52d9b1a1498291dd6a06c442babf0f70d7901d188f8cf56f0b4' +
           'c9536d41331849608dbc226e8d4a3226ab106314f5bff2d35703eb54c650dcc9f001987d8084635b0dfeaedd5534cf2eb65441d6eee8896cb87a6ebcc6ffaff0' +
           '6d6b89ee43d9949ff854109628edafd75e84919ce059b6c8b7858fc32c6c4c61afa5a4a01d4e1d177a0d8ff82aaff447effe32167953389d9dd11c8d0821ce03' +
           'cd73092fe6172d2f95a9c5d3ce8f1faaf813ae8039e46a47f34921d77aa29bb0c676e81de234d45babdf1644f7a8f4aa1034c9d4d7c9bd9a3e3c762c206c4cd9' +
           'f8906674345c9663fc469aa0d98321b807afdf040bd0305654b35f01effa51065d7586d3fdc31db2babf105531a2d74e78c5c035261e1332068396f92b63b664' +
           '1733e5ef4748ec52694d62044bca1e438f4a9d35d62f7e4539782e2cba2160aaafa437b486f21ef32e8f2905d96561fa38b65d5d1b3b1f5d0c225bf7e9a95c2a' +
           '023ada42543de01fa46947c62562328f458461ac79849e1ad9509e51d8d1486edb7660641cb0239cf8db1fe3daaecc67e86b7d5388806d2cc1de22a657389bf4' +
           'bfa11231f9d106fb65dcf3bf04a0589ed158b01be283c821b0af9ff5b7aea0ee76c2676f9016a01d731b90ed1fa56831bf13f4c4651ab58bd79006059d1d2d55' +
           '75d609bd7582a7c8eecdb343286e2d993a47588090d641b1762964702793a5ff0f06d11468c4eb003373b000c08fcd14f371791fac2e41b00fc338ca5704f2bf' +
           '0289b58230645bdff0313f102932939f6b96898e10ebffcdc06420b0bfc47457ee71c054b1ccd36228b822b3ec27eef9c48f3214f681c30f335fdf6da2b34307' +
           'cb760c474f18244d1caea35e730a386317d90d798c1a24cbd6fea2569db658e9c4918990412f22ec2e9291aaa1d0d7cad54e84edccc457bdb5c08798bc55c2f3' +
           'deeb1e14ea7a6661d8687ad7eba97e1a5a3de7d8febacf9c4e3e3c49141c5e8459b3ff0fc2ae4abf49d6ea4803684959bd1a7519e05426884149e0351d3396d5' +
           'd49c005099ef5461259d8885b896f144d530172428f52bae6faccd598db1e6877226a75c1d5be254ee8db8d864d6a7430f105f897b52e96b1b232b4eb208ed78' +
           '5fe459922f1374693b5979dc14f571825d107e67acc9df6a32ae02b60f049ef65b98f39bd6b8a11bc0bfca5c6cdd2d1d799894b04f9bb4846d21c1f3b58fa5e9' +
           '757255efb9984e8297d1ddb075dec531b5cfc0725a01ecc2a931c0e63b74937268187d7fd8a9bd743e2e35a3afa35775f03b22d03832dc60ca11c7f6122daece' +
           '04237bbd5bf1052a890156b2d4356603d16467eb6c7ecd5d8c8cbd596646aa7b82807e1d47e864d43caf0223e8e741026bf0bead8615fbb04f77fdda4d99fcb0' +
           '9ab98bb4b7d82e18da3b6e7394ff5cc03f691503ee27cff4e95320a3534bc55a9a2c0e053005a68875f33d3c987c36dcbf72a56c642b126e6c1eada91bd81f2e' +
           '328cd44c2f0a7e1429d5a7a6b85ba336fe5fc01d1c2d32b7bc6538ee5589b4f8d956e771739db46e0406cf67e2d00267e9260fb77386d62fb924edba560dd1a2' +
           '64f8c31729d2431434b85020b1bb7f965eca6387e05bd33bd6b37f544e863bd80bba070f9fba5c6f9e3459a43a8b72c77bcabc4d5369bbb9cb1f6d2c45634de2' +
           '1f66f648f4871c612a8e93020c9b8649f2f7ddd50161e640f7f90ec690162e5e7f830cff529fd0b91d7c48011ddc1d6fb4f987a7029c7d7dad9f315f7d9a53df' +
           'bcd25ed0d6543c6e1baf420a36e5ae132bd44e390bae96f39aa75ad3ef60c7010586bad60d627fbcf19fa90c7f518fc59599298bae2404e868da0e35a2b38d73' +
           'fd779efe09dda9efb1ac73bc75c4113fcdd35cbdeeb2d299c2a6b7057ca298861dd6efeb73dd27d221ec59f5826364a12f856139fe757cdeed171040b51728bc' +
           '5856b9fd0820408a2364b34b12505d66c6a362a53b5801e448360482109b65dc77cb86c0e8e30cc0e2cf97aba207c6bca5c5143844963420ef17e7ddfb0bf406' +
           '5371a57956d6f9ee3d28e98c33cd01bec7fdf403ae84f0435720e3e2bdc019542319edd0144008d8c8c4469b256eac9b1725ff9fde435061c11d40c603d9836f' +
           '64f79da4d4ef7aded8394acaaceba0262040cccf7d4e7b456e3131bad69495bc263ecd3b217bd6d0bf7cfa2b7626c04b8374e559902a9bb9f64ceca0201f580c' +
           '29bd7224e87959ab9c6c5c203c6ce78adf9906605d95ac6611c91ff95a930b50c933a6b3268cd1aaff98c8a33e71cce96cad471414f4415dd8d72fc1d158d60e' +
           'c73c2b907ee60272f40fe7894ada5ae0b826c473c834cd7e2741c01ed9c7de452a70e7c1d303f1b32995058e347bae6678d938d8053bf393eafb22a1f0fed653' +
           'a014a5eb8fb7ab88773461e5fedc16cf402e3eb828240b37aeeb92d23af4fb079cc3a0a81c17bedfb19b56b2ae9011a9440556bfe1cab12cbe413a589e7b8cf1' +
           'ef34ed8a0734b62406fce8a60d596fc9fdccf83fba48c280e425bc5f67e9e938dd340aa3ccfe2c6b6c525b596dbed31c830feb606cf7e4314cbe1bd559aa6b02' +
           '649805f32de6a8a46ccb73590dc3e86577854589651c781faf8e95aba0b8cd9e6a4f330577c68fbbd2649cb8042e22e5c2a6e6eede92ba4d8ededb4e3a5dc125' +
           '6dae1e5da78f3b4d27e85e79e287c08d8a78d932502cb8d57ca6eec692b19c7b1ce19d06c8bd5722629d3e4456c1cf656e17f3dc83afeb4f34fcdbe8201458bf' +
           'be627500c24f0c38c82f8850d446262d1ec76e6c4dc85820a147d9989cefc3515989fa447303da9ce8d912ebc4e84ea23f67d7adae2c88c0060f5049bfef8dfc' +
           '7676af6e877e130ed502e93f9364db2ac8cb003f2e28954b2b9d878ad670dbb4962d7d39f10d159302bfedfbed110fea7c14d9145fb9dd232c515050273a2b13' +
           'b4f13b586371f9b835b549ca59bb36e9e35766dea1d8fa91846475d71c2306deb4e8f23910dafdfa51b2e77409e6464b55464b997d39502da7eb0ed8a00bed05' +
           '487fc10aafa14d8e1c1381412de7da801faecbcab1041a95524a15a48f593a09b85f18b2991cc615fe063dffa5f3d95c030afa425e0db1632f6861ce13e329ec' +
           '48ed02ca31b5bae85b9482d5435e88f59691e6e77a742c10e188ba312ed82c52128528240e1841e6fdc4a4a09e69f6d5014626a4c0e7f6982d73308e7ec595c0' +
           '9f75d41144a45d8dae1a9766a7c1c44c87a6aceb4ce6d45da16adc155f896a4cf3231607e4473e61a6bf6dce6fbf1e4ec8e75c18607adb9b88d5d3281f535e52' +
           '669187f02291ea1495e3b70e8b344eb2865995a9a216c5a3d49bbbd826b64fc086d3a090ef1d943c0b1f08844f45bcaf41ccbf6b8f8b1853c29633d09d8d3b4f' +
           '30e9b2e615a814fd9a78f811511c21ae55e537cb124e4d573742187986fa0d14e801bf65fca2651d391ab69cc978117573e6d00b0c6dc88387f333574237171e' +
           'b9139013724f34e0d0053dff0f8ae15862e17560b288c647062d6d22ca360f366f917a2748d7c1acaf114ba9d03865766fde010f6ff0a0a5eaff7a704c597deb' +
           'f658acdb45d141130f04e5cff28c700b27e40518eee4df00b1fd2cbd804caf246e0a2e5abd5e401f4767389cfb612611e419448823745626adb8e598aa53cdba' +
           'd28a45d6997a7c02b5a8455d46f14e92ed7961d18f477d99be096914f1dcc9af91ffb0bbb66c7fe6e97bfdb5376891be3ab353531f7ae9200decc10081474dfd' +
           '67418c714065f938110cd43adb8ebfc892874aaee687b47d487d00c2b3bff2fc5650db81a4c54ada57b0199036e41faa012705276daf597906edca9a1a5b39f4' +
           '525163368e33c884b31b4d94284900f5740d4ba90cd8e3c22fcc165478f32abbf0a839df19efa665f197665f552d182d687e77af1aa8aa46b3a73c469bc0452c' +
           '19f296752836faa0d806b1893208ded3dc116e0e62ab1869489b9b7e2ec33f907f157f25a7129c78effb7c37796b28383b751664b2787cb35ed02f3b3a6d6372' +
           '51f454a7bb993ba41289df559acbbae7636fcf51c0596010dfde02ce9820c4258d8069cd226aba1745f02007073e65a7a151dd78e97372b5ce7fd6217f35ffd3' +
           '781338455f6f393e7e24319b526e803c7c810991e3632cf8103ebc73aaaa4b3f61c612546493914ba2c5e70acb05e672069ffa21bd1ece2c9ebb5aa57e2a12ed' +
           'f2517d4721a04c06fa224719d68fba4fbedc348c167b1ac0168a72b70b065b65d80da35000089d7a31c7aad13edea925c23fe8fae82f9418622207ec5c83315e' +
           '854f5612a1037231f247c5e5f5c3819f99982e49464d9e7cd5fa01aa5ca86474021cf275c6b3840a0230517c1549e2c204802ae5a3780324e659dfe2366392b7' +
           'a95e09ebdc7a5cfb5719997d554eff1dfdca24cd6af8ecfced927bd62ddd00c64905cfc6dea40699687de2b94e8d2dec1dbe6d49f7792da77c94989c47b14f44' +
           '200a0e77b827acacde54477556eef5373f749f6c026eab7a0f1ce5eeb6ba00b124c653a70d8abf99ad464611843ff2bddc921d61ae23f06b24eeebb70e4542ab' +
           'a97b8be70196a94bc392a5337fd558eca7fa9bc587872f5d958d7a959a43c87f98fb59dcbb831a4f588734e556492082d1f9fcbd21d08966c41296902b32056f' +
           '4f1ec02cad423d333d94831017f62024a65c7b09bd7437ee1b7ead05fcaa39918d0925d70e78c027d4e26358c33cda0e26a9072dae80c1eda3b40dfef817e479' +
           '743c5b04b96bd5c76e7e9c0d8722082f77c08c5fea809c4d5fe3ffee459df63b4d0d491c8af98ea5fe644a9e7011214eb0e51b7c97c181643b744dad127e9295' +
           '09a0afcecc4ee056f413ad62b87e32a3b9b508809ba104f2ad65877ea4a18db2d214b3290fa9c202cce09bf6b686dc279663b571bc02a9ffa2446e57bec1c65a' +
           'e3e18bb0f22a67bdd463d16f0c63642a0c492705655cc3330e5f090571fd8ccabe01a749dfa68893e4c4950578aba93ffeca1594b3f27c348bbb807318b8d986' +
           'e64f906c072339751d3af68e23c622d6e8b2510971d548fe3b0829fe9ba74bb7eeab7e666637edaf610a3748bd87dce26a560d53f0d466840dc95089e793e73c' +
           'eaa1a22e64edd2e6e4f121201dac9eba52775dce1bbb005746c73d2a069d0845f9720589b210be83d3ebf8137931ed5bc36d22996561aa16f4041ac229026dd3' +
           '15bd55fcba2773517de29d8ba8f962c263a057d2c11422954e884fe4d151540962f0a4f8354f09b2d6fd6967f106106760e5cf73d38d74278b3a41de8705c3d0' +
           '73665f94ec13e50a5ca312ca40214daf9e66b5cb7e111e8f58e270fa05eeec9a947c73a5e053ff40236ef24f432632aa6003427efca70ca9d6abc21eb0a2c110' +
           'caa826b54d7d25f91261ff97ad0f1fc5510141ed3422a793637b88c5223ee76921cd27e97def22ce925a0633e411949f9d7ca298a2aa705a642430828e6a2f1e' +
           '880906db44df30228f11d0d81a0b127b26e4481b0319d2ba546bc83fe15f4b7c8a6619579e669496292ab61f50e1b8da68ac82744e03079709e462865ca7bf5d' +
           '52e356f636fcc9f53ccd9b7de4f8b0aaa1320a75bb774a2c64d29c0c604d0d5000e2f8414e9118767e5c4ebe8caaa1dfb64e6aef3bfb626f6672edbe7dbd7bdc' +
           '9ba9eb2f5913a43437221d0d2a2b882d49a882cc5ec77b5d408ffb1e01a4e3ad34ccebf393d1f676361a41b53d38ea137e5ef6c95ea5bdefa4264db2da48ce14' +
           '91c629e172061b20191c431a9c7003ac69f5ee36e758869edbc8f19843b1e4db80c3b66885c1ff8a279e86c70e1ec674004d2120871264fa7d80be5a4dbec363' +
           '388697a31ddc44923330d5de9578ca602c7237add867641eb607b9e78e9273d95686240a44631ff1d5967e2a4ef4c03ac86fdf6be59b9f00d3b83415956a7203' +
           '2411472fda80132a80fa026cc93687407b4f0689124baf761374ef744a24adca5c0375291fb306ceca03bada98b7203bf0ee4ed601c1bad24c7333e7f58dd30a' +
           '6901fcc53a51f19866983d70d4398ed4d738d75cbc33e83241f30ec51a6f1b13a1760a9e0c1952b0bfe41cd73b2365597349ab8e2f010070144d10cef6b24910' +
           '2c2a517f8ca28a5f0c8cf127f06efb3bf78ee80bb296002e965aa43ff84f621d30d4095cbecd4a63f131411248929c7038944d44827c0891eace1a38f335cd79' +
           '46b2001a80b0023473c3cfc5856111233637499d1161172aae3547d4ec88b0c2644b3f632e169df62687a2aa6f3bc90341696d8dc64bee35754aaa2a48895b72' +
           '24b0701b6a920585aa567d419dfb9597dea89d288ee15b6925bcc32a64f3967a8410490973ceb7aeca558e05dd1f67301857c41e5279245156d26516b578cd28' +
           'dc67e15ce17bf8674d3e103105760a38fcdebcab2f1136cd90b1b561e56dcedff27b231fe3b5f2e7a354d9be9fcdca652fe27b62b9991e6ff3247925c7413de4' +
           'fddb1aaf7dd09408db4de98b89735b03aa6cf88214dacccc89ec6de5a481ce13647784f8cd2616c63813d2ec4e5cb6c999fdd25f5061e3a6ab2c4bbe0b457b15' +
           'f0b3cc8d0f278af5597f52f141d1ae807b4ed0681463a3b8c9dbe1980bb65a2cd7bde53820d835a5e7853efa33a2a69c9cbbf52fc9d1d2986e11f5de4c6afe35' +
           'ef97ab621e4b6d9e5865f2f4ffff1a935ce42354c75f352b7a8332daafc06ea2e0185ddec18636a60bc5a54e548edc1054e84ceafb3d88fc1a6e0e6b55e6ed79' +
           '5ab59fdb0eaad6834312f453c4d5e2ef18731c7aae08e37f39c467e34756efd245a6109e765e6a317e6efc0551b7f046c6d77f3ade5f4c8df23c38e59517977b' +
           '5d55c02dc4c81034c8bdd08b7703481cb121a90a2fabd891817d470e7e54574130690124e6700627eb7779694f9aeec4ef3e6a5035a82536378530e9c7f5acd5' +
           '57947b9ae8b423a1c4c4300f1ee6bd82ddc1f77a0306e9fefd03bdb626f317ea09812a30805079f1da5aac3dc57b31910d4275a4d35cda69415ff8542109f72c' +
           '302b6871e2f069c605355d0d0ea10285c2e8a29dbad4f1fcaeca209326cc2b420dfa440a1254734c21b46d16a523d5a3cee98a14a3a8c1f8e042314aa9c07c97' +
           '14d21ad5a182e1296cdef9d34dc68b9cc15e870c978697b879b0985a73fb1cef02343eb8d524c73fb094e6f88b2416c550cb4516973c2eb02d27b3c530ec0323' +
           '1388223e250990129bc9226a245f81b4c2ef3ded4b5f71d2e1d640aab6c420b48fa5c20c91fe137a4a98e5e8bfb935649388800d036f164fc57b30f4d3aad3b1' +
           '0c16055bf50e614583afaa49394d3d42b824c7dc5f436a055ff33b271d11cb80012751b3c5a7e8d76408e8597001f76675d3bbbc634f4977c3d79468d24316eb' +
           '07cfd2a29c2d29213c536c6b42025f95416437767a71f9d11e761c779f7c779b07e2486391d70142c2c6c500c715e80637e0239918d46372608977da690788ae' +
           'b1b4dfad4747d72a299c03e5ce5de43239a95c1c083bbc516641537263b6e587f68e2adc24a04abedb7f6357f908cc06b3731e3663e60f49d81ce1519a70179a' +
           'fc8a6fc52f3befbdb4c701dc4fb4fab78ad1c50a2b785d4b210bc821db6100fbf4ab0a76502defcfa535d920e654dd82aad3d43d65e24b2e404dbe620b44efca' +
           '62f6d234a7ab8f4c3db0b84acc90ca236c94efcdda0fd21b4a0723d51f0930f34f5b89d10f881107a49a8643876ce74875534a93e3fe22f9821533d8f6b8980c' +
           '3843a1b94572f78e1cc5a3785dbd5b7ddd26c6c17a65b97a0215c36bf4778405cf030f6bb4d549ba98268b6b03d5c15440cdc1ff3a5694623b05e285ce859b7b' +
           '9ce52ee6f4a2ee60af549f0403986d097b62508a5dfce2447ba724b9d424e372748768dddc025595a6c2dbd0ef4fa9cef081e299a1ab6fd7cfce1168de3f10e3' +
           '0a9597c4b0a22151ef469c9959ca2508720583378d055aea24a9bffb3461cfbf4f4d3dcaacdd0cd80fe7e1386fcffceb878db88ede4dc085c07cbe49db08ae80' +
           '8d971b66f60abd7b6c374fd786dbeba882ab174219c8f606d46fb844fc506fc858289937d4a443460d0e45e36a2cec04b4938894a0edcb0246147a4f0715a49d' +
           'f90711aa5c2ede90de28eb90b57bf5642c49f1850acfb756ecc6695af86babc2da35ffffa30fdc9f45d721919ddd2afbca7351ec060860ca7d4faec453f4a316' +
           '9faece5e7bd347c584bd7a441dda0d50350c219719bd4f6893801719719e57dc307452660a42bca60d3512f64f8b3eda6780067cba4af93a5bb1442472acb24a' +
           '61d07ac866aa6ab76d119a343d14190a96c00ed164423c2e598f85c0077291890066f0c009e8177548e9abb318f62a4530ba1b5fd6483172a5618f2fa6fbf687' +
           '2100eeb84b9a196d3a95a6b9b68f175d6d163732eab5565f50a7e08bd90f5a0b1404695820da65aa5db9fec3ed0eee9136fbb0ed98a43c77000577b2edd46b64' +
           'fa986d72d4fd46935582f6e59b08ac68317633035d14883da051052cd957cd1fb1ffa36201ae0032344641db367ba77081e42ad841ed6bb7d8fc1d45a8345a96' +
           'daccb84f43ce2a8effbb8b7e9d692aa1cc431d95f946fe9a719012998b9766cfa6ba7869b413fcd6394c59aa28c31f7b036d5ac2fdb230682f6c8b298205adfd' +
           '1c10004934844a6f32544d49057f9f560d26550b742265619723e8755a96bafa80790a7c24242b66362db01b543affb23141fa68580ec5def98ab2c2901b27a7' +
           'a693c56ceb3a0656418d04416e6f0c4dbd2886de4744b5fed31524957260cbbbbbd4a7ea0d99c5540db40db20f169b19944ae2f3cb1d056e5c5e976dfffdde06' +
           '9dc9f3973e2867c78d94a088b72b3dec3c75c28645b3601e33397a54279b9bdbea8e95e1938b03e5653a4355018a9c116e0c93930e101ce36b73d58fe08b68b8' +
           '44417f433b23407346318d948c2b220506999bbf1780f1d979a931d01817fc1712d9b3352a9f7718a45cb35b27102c924decff6558ba009618a2c0f8dccd1084' +
           '57cd9cc0a31599b3b0ca84d0b1e5158de0c3b1eb41370e7ba2e82710c46110b879f2e1020d8a9b33eba6cb97d2e08bf071c90a0a9119e13a0088684aadfe6555' +
           '196d5df94e7dc1dc39208724774ddfd8289ee3bdcd3ee9c57a3da08dba5897568ac0c768817a7c5f9a163c307127dcf195028f8fd180d7a3af1adb41d6525b97' +
           'a3a63fa17785f6e413f0f7812dfbb05e4357ae4c9efdcf95aad00a660a322e8b3ed0d126ca1fc4f3830181e0887baa1fed58fc1b4c864b67a8bf2b23b86bb8b6' +
           '61066feaea5ca045fee0f2855b68a69c5233cc8d8afe3c603ce5f55df605fd31754e8707aa48367be22ce2c92df0fcc815eea1a88c695ebb0e308997f6f98be7' +
           '41af4328d70c8d8f3da5c4899f957b86fe5d006477d7d04440875c3c36f19a402474976316b2d9803516331c8026bbae48ab96ea27915f5f8096b3bf1c2366bb' +
           '2591f0f99a67e9ba9bec54ebf71daaf10ecd84c296d44ae1b3d9e2e18581ac34d4320310633dd90113ecb90cad582651422663e07277f339b75ed6eb6a48a2fc' +
           '973f3732917f393918346b967d016c55b9b04e5b11ee40098b0633a6d900a679cea798c0954bfa1460f461f96f21e508643d56d6a24c570412a4598fc6f4e432' +
           '20471a378412996b5832458ca63cea25881a4c1db03bc0f4762e43f03b435c0bd313a523bde4bfc8af3f3156ac1c9b7613d52024ff354fa595fb5f3023d4cedb' +
           '69c9256a3479a8ae77b375d93f86ef5a2f5df72f140da9cbe1d2cd87da7d791b0eb98e741198e14f0a47127cd40b1e8ebc7dbc5bd0212825718af5a53db83c5a' +
           '82f367eb1957fa10f25da83d7daabefefb65d14f771296dd96bb5f012a3f71579e3186e983d1243fd498fdec9250d6130c9be35cee59da692551be4221478a13' +
           '2db77c33c70e18e333cc2f7eef0c13e8bc9aa878b70d8f1d4fb50b12de8164789a013edc75af41d86fdab777fa9c2d909854b4909f841ef356685730f150bd13' +
           '126fbc25b9b556ee90a8902ea1f101ca327fe8c61537e20e4c27489be40e3351252adcb9d3521693862cd56d002015a7c34d17cdcdb1a222beee59ebc055ed01' +
           '10939d0cd9d5bb053ed671147eb1fe4daf2945294d0b6168ee9e6eb336543d0ce98343c9fd827f4bb4ba22b6e6d872b042bde3347ac23f652970303bd445547a' +
           '1a2c25c6aac2403c58d4b33736d796f6bfd925a95b96871b002c9f103a626fcb77a3477690a65d69c3cbfb5fad268803f60e089503eeb3f3208c93e3262abb76' +
           'b5b0d4fc780b71090b9a270c788629dbb33cb64d0479f38168b417b46543ed135925441d2d5ee5dba9b52458ed82158da5354fe5f9f83a2d3c68a1141fd3e0a2' +
           'e97a0e9dd0ffcb8bb2dd0b8e990c0d48cce56e9c45172c1f1bcee31323d87e07c9695044eeb487c6579545e09c98c179542007d5723bd2490072e7ba9fc302aa' +
           '4e0ffa53bb3f20304512aa377c06a0acd550d18d9f46791aedcfe77229bc02e968ae0f505f63423c3fea7ce7498dda64006ac3b758e338dbac0e83416259327b' +
           '59751b0e12c1ff02051bc39340f05537c2ca49135643e4845084a9b764f5ee99265f6cb1b6861fb6edddb106ab9236d71e7181efc460158b8e99e062ae5cc1f8' +
           'b0c5a8c119e535e079799a7932fa515b9d9edb6d73fe312cde189c96542aa8f119bc84f9dab6e47b234f3f13b4dad64196cb2ecfffd1598bcd87196b9b898afe' +
           'f15532acb8941fbe7fe184e61e7f82e0da425a23bb9f4be5263d7fdaf58c0252c94f13c7eb3fc93814351af83b95a1d94c35bb5d7bdc968c5092de780d791a53' +
           'ef1cd19f55b15d5f522deb3a358241eb19a9d99d96fd873d64b338a21cb405595f1efe810fcafb4e92862e0c47fb24b9fb1a6aad415edcf5b84de3fcfbd58e35' +
           '3909394781cfbd9b3e1d8cd9324b18f9fd639e58953c7b7ffc6bca2d810dad1b21367c73cc101c745dbfc99954e1756c3f3561a08797c27231946d6675d1e1cc' +
           '3347033cb5bb0f3900660a689412c27667f167e2eecef0b802d474b51f864e6a1ae12ecdc32ffd9b95ebca8b52742a6676c446feb5ccddee195adb20ee21b028' +
           '863f14dbf652816f9c513d087147debaac35d4862d04068b3c73f9f4eee1e7d2a86eb32626d09de2857182987d6fc7b9d641c34af8f9cf79397a3729ec359f9f' +
           'fe911de281809f355ba4acd6caf92921a5200574d9934c95be35547b042042f23d30a7392e2e219d2db53eca442b0d7eb0342f9101ebb278439f677349ed4d75' +
           '7b7a1a3a19f655419ad3655da733551bb20b98e5b59df4e53ee7420633473635e886117e5dffa2b30f6b492a2cb41119a3fe0608058d88d6a6df209a809ab859' +
           '7d3cf5e197e88aae10b354bdbf9a600250776b167bab3679bed5ae5bbcf4e80e009b5fa87795e97940060a8ac495a82de536ce04c3fe393b99f9ed73766283a2' +
           'a06993aeccd0dae58f02a9df95141c6a4ecf50f900c2cdb98ca303f3a72d5559b57a574ac8123af6b5503136a160b4de8f9da2356fe697f5a760cc390187700b' +
           '61a8482526a278c6ee702351456f440ba3b3745245986148f72eab16cff9e6d9b5755c97ff9f1b9148d14db0da6b0440c383ee375d441228485d35eaada6bcb7' +
           '00aa810c22a3bbf43388cd79798f7e17cba75e335024a33834e361dc95ca28f47bfd9ef5661fbfdf061338d330236334cbca30e224921e0810a40ba3ecbf6b85' +
           '5ad4a2028f68f205986b65910dd5f28cf1723b35a04e7777594029a9d94445d1703490ea999d603b7da8c4a3649f7667e7b586ec2abd5d0b1a0eceff9e63fdf7' +
           '449dae5bdb5ab82c2760b9823d1f1544389bfd42b4ee1192fd03a4eebc9afd4d80c9d1badf850661f6ba1fab0992b2158a1d1bb5b3edf966800f0e99cb121404' +
           '8cfa6a17ceec08ae617c8707675b69b2f955ca6f7f751aaa99677917088f03ca3c38eb69cf837ad158c8600331f3d6714b745842e41a24354066d951d33e6fba' +
           '335c1af26a2d87988bd0debb23c497cc8ad60708594c9f4ff8f287618dc6d47394b84c5f6cfafb94b7a30243e31379991fe3dfed1fae61faaf20e992097b7b94' +
           '8ba220a12b8f3beb592568920874d5001178d27eb43f6ede6919f84939de2076c5cdca4e884a40a654aaeee0605e3955da7ca173044ea942e45377548f04aca7' +
           '76d1335455f751d9c3f970b7c74613fb6e2244dbd9be4627bad4ce76feeaacf84159368c25b6a7f4932d7a675df50d40b7ee3de23a731683d762b730f783cd49' +
           'ae084e2034205c32b37b97922eba1815f271b582322756be8e7ccf0ecb16828a46ddbb70ba5123431c704b9a440bd5c767611800a0efc5a3761e95f453f55658' +
           'c5b1eac4ba7cb77f5f26aa504d26663cfb01e91aedc2a59762eb6d446e9a95baf2544e3d8b74c2f04583c6dec2fc197b4275e43544fb29b9fbe79d7604ba4e74' +
           '9f5b1dbcbb4806f2b1c4956b982edaabb4593d635edc630479ca16fc1bd8a518763be47929f9ae08714a5f2af4aa49cdf09a1b3e6f4cf2ae46699bfbdbc79308' +
           'c915f710a888d25986ffd77071b25df65e4b741cb3f6024d59c046549642b7f4898a3b9bc28b0879d7e5a9c63543f5c23e46402d3825c6917e408184b5228f28' +
           '9bfd4d8ddeca9a26fee3e1b0e4c5e6de1af5bbf48cb7d9f1f529d98dd2465f925daeb783b5d94a9485c99aba32f27ac00d5ce3e6b4a3af389048a7c75cb84a64' +
           'd30f232e4efa4acfaa28d1cc37ef52987f76d9c32672f613217616a1a90465167268cef32720c729d74a58cc1869a586e7fd24d8bbd78662c72aee71319c950a' +
           '2e378caef3bebc3af6b91eea2bc540ccbb2f89b11838180a063e6746765cbba6d6bf04f5e629b4d0474d5f6a9f3bc6f16aef21e17adc1ae70742ca83486f910e' +
           '216dd59bdcbe9a6ae28c6b1ccdb57ec979d8997adc783887362699749080751b61ff70c9b23bc013c9fd228f33c78b179fe1c92250a477b3f7d1021e398d708a' +
           '1032d96c32cbd24960edc1e969290eec8dec2ef931158b53487b92251209e703302947b98094106dbb63c3bcc82d19d301db60dc50113430b0112674ce5db632' +
           'e945e5e936c91c1fa3c9a14ba773dd0e60d3588daa56b967a827d2f11320fc627cd2ce81b6f53c9b2c7e973559d30f28ee7d7e6fca77903880e27b6e22a7ffa9' +
           '2accca946605ef25f0c90b48089b58df17f050aee380e556dd3fa6b94536bef2a84b816be4c0bd8d34914f7422e23022a2c6d0a781c540badf2592eeca1a5949' +
           '6ab7d8774366d9e2646753d42afc7000f37fcd6d58cc0abff2e66ac3c965f8c49b42f138215911c1913a359bc15cbb1b75d592ef726f3671c1ba400d54f4280a' +
           '8ebd716628d0fb0aa33f6c72d365ac3b2a91c0edb79610a0779bfe29808ce152ff042b0e0852b34cf80c60acd48dacdc7b9c1f5f4fa313123d28cf891255801a' +
           '26dd4acbe1e43aeeeff402a84f2bf9a7e6bf8175ac69f5f35bc17494d6a7c16a9a10500307714cfa441650dfd81102bf5628c1ee236ed6f0bb4a72969e8e6649' +
           'd39282bc092c039512120f3e788417cd0ca5de6cea8b50d42fbabb740b7acb79161dfc771a712bc7e096abb5978241c992bf0f39a7fd5c5f902b52a8c5e1b081' +
           '3097ba146c31de89cc27b0bc526da8e12bea493bbd9b8aeaf1ce047ca3f7b3b34143d10e94a10e8f950a051c01c7592404e851ac7458d81e3a81485347b3f6fc' +
           'a93cb5af72bdc9cde852668b19b5efa5436c0cf2962ced323afa6b3e45b6775d9531c66c60b57e115bd3f11bb11cce27a14f497067b474df5e13d827d8c6dfcd' +
           '866fbecab2264a78377e195dbceb18530b9d0959870e6e4e6c64f8013f53aeba581e104e4ecac9df4fedc163d3ab1aed134d2728f9e34c6725d9c2211440eb44' +
           '714350261bf4fd0291226af62eb57f567d56d8a184dc5cd8f2e37851158027e573b4a15f362a006635775f549b3bf255157cc5fdbe22935952079f47a58aa472' +
           '3f43f3b7d51aea6769d2fc584d11891566a8c59a48d9abd9d62295fe7534c1a55657fde6c821fbe1c62eeb4bfa952081ceac99e6dcb2d17e840ca0dc84cb6531' +
           '3676675351433804bdc8612a8619a9ec80f7c7fb791aad646b5ee999b362ee04d2dba70ab20c5187b88adb30956c1c9295e43409699d4c0d61f109e1a7d8390b' +
           '030a56cb2c0dcb163eb68055daf89ca9277d170991802fe6faf1f683b3571a2f57ab5b52a12db9eccfe09988a287e2eb28b7bc158926e82cb6878d84be0a2963' +
           '4f95e181732c9bb237fb4c8bacf09f2e27ab1e61f6baedc6b2aa263615c5a5338c79996fa681a6ddbe63c0d4183c8ce8e9e0fe07374adde36c00ed48730a0ecd' +
           '841cba45338c9b74905356cb0d0522c953a089c6717139ef9267c0797584dae09500c15d49abd68d697c9aaf841423083aa355a6e0c6a8b2296bdf5d19edcc69' +
           '4e80a0ed5aa02ff0f785d4cc2e555efed86581b65e215bed5c4de09244ab83c8502ab320380a9ddeb2054a17b7885737a6ffad5faba0b2616f04520b1fe5f584' +
           'a0a4bc7af577a4623fc68ceb86b4f1f4cc8cfcd0d77d597bf912dd51c49cfe8cd4935a8446d00f92c7b933494521c14f1a5f8b09909088f8f0a18f71a8be430c' +
           'ad6de8c6fa666dd6cf71e1877bee655db03612612dc8d4a31c37e39b62497ada2120981c709c5a8fe4c677a4dcbe55b12e1d57698944a18f6ad428154c4186cb' +
           '8abd86b16d2bb8984e9a210234c956119116dd725b6cae90b07c737d4d0a21140569c359530fac3dd8245459f246be2b9eedc2405ad740ac12ce8343c4864ba9' +
           '0fe1a7af7ded35c7a53b99b29732d0b4716b3b0f33d6232ee337ebd27841d71f0d59b0ccc95d0acc9eef998be4f56a47ffbd10f6f3d949c52626a62d3a2cd0f9' +
           'c0c80fcc49720339edb9c8989b0750840ead417ae649446ef2fae9a06432135c9c8ccf0cf5aed1765aa2ad6163be2242a5cb0b2f0c791fc1d5e634dc53923f6a' +
           '52323fcfef879dfca8f4607cf74a2d75469944e95ec53f1a55cefed2d1bcadf7f462b6370be44087136ba67e536ca6c0b3a49d3dfd0e1035d337bf1fe20dc71c' +
           '3cc7ae0e559da9d6b8633ab2c9057b587731de3e07a31ecde349b1262529c1add56e263b456c06a63f1adafa0341cca4272ce63a4e1172b6fe9e79e9e648faff' +
           '7d8d31bd5b50bc65191ce26cb839af7ffb2304745621d44910a8430114efbab8d22f1f72b6f2e680dc4e163caae67d2af8c86db2fef5210d0e1336ca21247baf' +
           '7c2c28315ad8a6f327b7228eed747d2f4cb66d72dd955739971af8dd95df28351132ef8c6839bcd6da3afeb9cc781ba76dfe6d6babf198f23e12409d0fc6b572' +
           '3f6bd1674b7a1d798684e6fef878a33e1c40325ae9aceebeedb76320ff639cae58a721ac58b99a7b489480e5f27b20bdeeec64b223c63447c71a862d140bb31d' +
           '0e1776eb5e9483e8c53b17974e04af0485f5831eb1b5a0c972e8063d6c7d0edd18f58043ff099832ff0ee5e15c22d36e6438fb6adcf4e7459447cf884a1befdf' +
           'ecb204ad9d24176fc24f4573529813370a54fed791f915d3228b504125e8e1b5a12bb70c3ea08c3759a187f9dd6a5b77429f329811b31bba190b08831ed5c204' +
           '62d7522dfdb495b73d79abd9bbd461cdd8ce96e356910667b35fb4a5f27668e9277d2cd1439ad68c1c6c6174c8a9d2487ec861857636dde5b407e27c154545f8' +
           '4e2cdd2dc3ec02c756acab99bbf1ce2ce80ac9d93ecf17576dfc95645749b92b311535a2a873246c4285d15acadfe03036822a8d8111783291951100e8984b17' +
           'fa432ab12c1b295053950e3566fea581f6df5e45611f5b5183f3fcbe86417315839a56107166f6848a87d391a17655216c97ac32894fe1bac479e4d3af488be3' +
           '59762f5c68dd36e8abbbad0450a1a4b53edf3accd5606faea9d2c3b5cabe97a6cd51d1f686f1f0385b05c730e42fca103f4e0bd20fd06324299b6ac6ec483057' +
           'f7666ec5010838a5b8c15c6b8fda803ac8d68c3b6506eb50c716631f27d6fc6d51d966be61756c5d0d6a70429e32c0da6a83e8b012cc0db8960ec865609cb7aa' +
           'dda44a6e13ea88e9520133bb834e157d47b7c41a51410ae8c32c1e0e362030db2013816ea2132d83b43bd3fca41b41f845fce5ad729883a6c95a4527824042e0' +
           '118a05c271d93467ae13ec469c43f7930d7091537a2aee100f0310f7e2aac9171c94a1db9bcb46fc5727888d7b94a1fec0ddfe976fc771392b6fd925681180a9' +
           'd048afd0528a921bfd34e7ceeb250ee83ece99a507f33126e43719372336425f725d8e1a9387c7493909b2efc7d77fe9801468d36f2c0c99aec737b85e2a644a' +
           'df3ad1022bc89019058e0207def94d4ab5f152593981f4db1cf8a7ebacfbeaded311c0bd43af57d090175ffdcce128f169663361ac5711d8ab90c49fff289b68' +
           '4eca113fe5c0fd512ce6896a1524156c2c368fd60b4425e30414d7c671280205768516c78ec5f2faeb2df2477a0a83d0b6fc662a92a3fdc7a24969413570a25c' +
           '96f1e3872c3970561da1ab24cea65291bcbcfa9d46a3079d4d4ff75ae294e2f3a5c4e8920f1580634513970415bb354df029a0eea4f43d939c0fdd03ac4f0b8f' +
           '919ccd73ad6e3c775631e82285bd651efea46dd5a6b6a55be9ab39c0718bf38f22dc941df105e505744b66a6b7f86ff0937260bc3c5739410eff9b81f501d809' +
           'b43556cb11549490f055746a5f09d7a3ea6f954d130e6a80dd8afdf6d6ef683792f2942ad14abc390bfc74402fc888ef7b7508695013492b007e7ff2fd1780c1' +
           '5316affc509bc18b01db71bd11f64ad92a1da531a9ca3b5db0bb6039019d709a165f33625b5340d6c81316caaa3a30ba8288ecc6abfb3a313a2d430f69ddaba1' +
           'b641a8f1d20c037b615d8edb5f727f7327e418df8c424fcc718b0e63970fe697fd86be8f6219cb5586daa0a4d085bce031ec43738c0b1345cd287401c9988a8a' +
           '7c96d450c1f35b13d87b7210598cc3889307a9b787e03b7835042e784d6d97511c4014f894ed42d3df37aaac9076b34c1d92a8e96fbd77fbcbd9bfed5da7c86c' +
           '6ee084ff625be6dcf2da8ac543c3b08b438a30b55cd1f8cb154e5042bf9a2794702dc91742fd853b894460b007683fc3ede2a7bc71f45e36a13cd7222b259a7d' +
           '2d44d326adf77bc92645c201c63de1bd8b82e4df26cd6405d6fed41e61b0c48fe7e23bca04d052238e7725c489027e3f5f6bc5de60450622a327f93cd5db8059' +
           '3d1f8cc5248395543aef8787d5cb5fbb8c177f33eb390ced7a4f566ee2242e49cfdd3cc958206bf179a8dbfbd17f6282ab053f50312076fe111b9a8078de0b67' +
           '12c3eb4159f800869c576bd8c19571658b1275f6eef779e4bf5503be9837307bc9396b9c701d5bfac49010bef5c5ded4542ebb13f02b07c63ac6705833d40bb5' +
           'dbc1a81f4953c922514d18a7b66711d652a9e426468000857f70094434bafecad3a8c1b923cbac88f41575b38ee52f56f5b9a719cc816bc51ef844651f315738' +
           '62eb57cc07c1cfcde6c425561ea3a5eb23f9e96f5e13984e59e60e79529e73c6bd0919f9603348e9368abe0695987ff51ff44db5a748040b4890b7f8e8d987bf' +
           'c6c499e0b6425537faca76548d96e62684fdc5fdf2da3dece109441e7ef94cb6c025de64167ef952629875cdb94c2538280049e37dd99f7b6fd1b7b9d0eb88f0' +
           '0fc4d62eb158f918733749e143ed940383e634e8a9be0cfe7155e6f3d6e28b648c3875cf50e9ddc089033e858c3922129ce947228c2b22cbdc3fb5b5303d2499' +
           '4641e14a22eea832009416dceb552be122c1cd0cceab126ea2dd4c25943ed30d9d56cc04d703e705de7627adb2e8f273c86fde16d676d95055bb9baade164771' +
           '27da6cc2ac39e9ae483e0b17cab98635f3e27cd8432e2c5bcf0f3205eb76a62f9ab8b282f6488ac5a3562a04eee7b5145df1a0f414be2c47d64f012c72282ab7' +
           '19f3688fb9e69916ef1728b41d928c2494a25ede8dc43e66a98765c5e8d988bb2174c602f102c607c4b4fbdee594ac1be0c46e4bc4a7f1db75791b171ac421b1' +
           '6ce6e60fc3b36800daeeb3e15cd18fed9e36e7795fcfa57d1fef3cee9b75f0472268bb05e99fd33bfcba32e6bc9533d507b41f20226715642d9838b0fa354242' +
           '8dfc89ae7d0782a640a755c85717e6b64d9fb1720fad672c43d674df3595ccc9a090c6a36ffd035655a057d13c929063db0b720ef9140f09256ce4e6871a4b37' +
           'b40cef95bc20116231a3b5c9a121ddacbc8cfcb0e8c24f492301d47d8c0b125caaa622f4b893be11e6c2c3ece9259979f1222c8325a691bfe1e93f90e126ece3' +
           'd0f90fcddad1609dbe8c9d5110d5373bc9ccd2ab8f66a8e74821fef032f69bc4174978ac48c56d3212af0497c75580cf2f29d0e247b48b4d4547947a9c56565a' +
           'f9a7855f13b81f1574a1071c6e296e5290c39b1f037f525d05cdec600eed4201c4ab5390e5a386e8eae479e6c1127afe3a15efa2742b793a2e62ad48cae7920f' +
           '05cadfcab05948e6f6c7d83b84004d31dcba6089835b878d074c567634b96ab6df8cd6716220a4d3bcdffbecf83c1c2971d3d2f53a3c23c59e5e79d9ca1a2ac1' +
           'ab3f229fa3f5afb64502baeadd11504e5563aa4c5b2b3629240eb3b5af27b96e048347d1876c1c28f6fd6769ec6674cba343b472cfe54f7cb1688bdd5ecc910e' +
           'd3aa16f28afe897b3fb1b555bf5397b464707b41daf0d41694e8ec5095fb72e972e231fc8b2d674910fd0d65ea8bce26f5207ca192f289131a48548dbb16459a' +
           '40083c4d584550cdea15f54df5fb9fc152094b93082b4a73b7cdc7c3d612b33dcf3060968b13d70af9623ee16beff45e1dd4ce899b9c39dfcc1ad4de6f1e7e9f' +
           '165f11663ff9928fe89fd255143c02e3e9592102f386aad43a09625113f36a35a294b8acd6e6abbe3a506c765c849403548678033a1b87294b23f92a3cfd09f3' +
           'e63cb573a43e6e6d14af7980c644baacb59c039f6f385cff727a37e9b5057716a0901dce06e9e2573273faa1146cfb7e14405b093c20679b0a70717786d84e15' +
           'd2dfc157739834f11c6337cf89298ac9ae03d654ecd84c7d58dcde3d1c15c4eb4ca44a2675913dfe59c33a7b9df20d2aa30d41d80038558348464b37e27f7488' +
           '0c9abd12af9fefa6e9108bde497d23f6c8122b0b1e79e3833c689102aef0f063f368c59209dde1a48ec9eca6575f6419b9928f6484c03d31c786be5b98d9c0a7' +
           'c3fe633bb11321e83d4c1e29d5f14f2cd79d387242fbb65cb8c315822202b64d775fb5e26491b626606f43d68f8f5c76dd41d2d59902ad1a843545ce514eeb4d' +
           '83ad3775b91753586264a29ba372e8b7f3baa35855ba6b5e0ea7b10d2d53e3e1aee3e7415905a2a415594d77fbf4ff473165acdb3ee86dcb41dde2123a47e97c' +
           'c2dca7c989649bcd01f64848076985179f7f6e2a41d87b51d7dc941419364f370b7a49e6a6e5acd933dd5b4badd5864a7606f024f093b9d7a3998230dbb9fe79' +
           'a4fcd8c3bbf77844c55fe06490f5649473ce0addc62e1b4b469bb3b5adc53146484c9734337087a4f6692ac701b6fb258be03d21fdc8a0a1e23fea1616b6d5cc' +
           '82dadbeeb7a1b2723ff0055646a1584b0ca7f87a73a39e9fb7881a75ece2a90dfbf1a9f31e76fd06251c5667a985ec8fa65d369be25996a63244a96824509f3f' +
           'e4de69f2a867a609112f8bb982aaf86e397273b236aa093746d3259ecfc932c50442de099d3f3b82d291d80f0af6ae921530ef4ac0c5474dc90f249d8655524d' +
           '548097dc1d493108117f4c222c9cac1adc4188211dc35472e5067881821c7e3c44c189be9faa57fb8db42d22888bb2066f81028610550f3034ac4f12653320d4' +
           '42aeccc127f9656a3137ea694975808143d7286a6c307c4436393bb6241cae77f8118acd716ea7afcaa588e44e9e91b89b0e38810b6704277f21c6109364cbf5' +
           'f1172b5731fc6619b0eb64e3c40f12efa58234bb325316d13717d169ea272790a3bf90ea98826801bf99010c935f046bfa7a052a96d44f2d10c6da8602e84252' +
           '6d0edcb89b6af45b357983cd7c6d30c469385426adb1d1cc3719f5dbf043a9bd0c041f1e4d87992ba52ca8e42cec56677be30adf26cabd011cf649a00045c71e' +
           '8ca7411475265cb0a98a013ef02b139d778de95e3f00b39258455040e3a8844e2ae8336c6599390aa5e236258c4ab85bfa5c4563e2a2da72f59ac741d1aa87e9' +
           '2d5a36a45dd4cbfa12d71bb2e316af99df52cfb8668ae641a9d8662b2dad97f234d804cfd21413dcc9b4ffd65ed57f01820cc3fed700bd297701f72782f4f881' +
           '193d6fdd7e88497a8ff5d6f4888846c58709a47a674dd042642ae4febefa2168cb31be39fbb38160e9cd1e3b5f840c023722372f4c984bec7726aa8a9bf2d92d' +
           '464b792028ac7283ccce397401cb4937461e29218f1912821bb3e645761a4577a43f60047b01e2ac81927b2e02920f030805a19c0fe2ca219b4df5efe3d233e8' +
           '5682d1652b005f5882db034ff0c22a03237aa699b1cfbef0c10d3cbd19df40bbca2db1492cbcdb915a01534bbea47f0ebfeb1563e5434625464f3c806cca908d' +
           'b2131e9215fc92af681f8c83efdbf9f9acd17dafba451d7262d071d55962742f11553e94c66a908a6bf601ada0803aef4456eb59f8a688e57f6bd1af08e0ab0c' +
           '96e25ef9fa0b876c20df0ec2374e5e775dffa57fa8d3cf9e1d2685476cc8e7e98f601d6d522eb95fbd280c39479fd5bfebfdc94f693e8fc02eb0151c14abec1b' +
           'ea11f875aeb6c40b1310174a2a81869f03af60d0d137d679415b73086a31900da847c3bc4981b16a568aa010a418c0d395463b2fcdb1b953a9bc2f5df21de59d' +
           '7f02347ffe57d8eb2b3fea1f9041722275f14d8a5ec53398cd95999a8a44ceeb0fc370d907f34b174a01594430c1f5adf3c1842b693729fbb599dcd56ff08083' +
           '27c6cc99cb631c6c853c6dd0ae2416ec4737097c4f95e5e4437473c53283fa8bbf7cd740d87377021b3cd1a31ead5e5fdbc1678ebf4df4aaa45dc7629559b2b0' +
           '960e4c7d5fdd590da9bd6b9605c943535093a715eb8a67dd07ee3a6af4b3acb5d97d1f6024ac1522613efa534218822c2c866ec2a2987b43a8721b72c0907848' +
           '2f17d139684a8d381ca258ef23851dc7f1498e45b090dbb0b5d46947d71a80ecbd2477d765352e9fd0b4b0e6c5ed496ef0e77c6c6bdc580ae094771d0f0e1336' +
           'c3c3eba63d5f862514868db2aefa06bed637b47e385d60e2a00e95d0d775c6d8fe9fe8aedad0c25acada95494c5732a7fe68db49ce836956c88c3cda678f86ce' +
           'b5db95c7f29b4ea99510188b0785325d5a3f0311b56dd6ad7d517ca471138a2a3e5b78576adf1300c0e182a9176fd4d5c9cb27bc62f09386a0b8c23b0ffd269a' +
           '32123cea585fa3b16dad634fc2f9939d218d9e08fa7ce23ce408888e10266ca55e9eb3e01bf0d61a22ca6d0ddd9c069361814725aea3f8611d6ebebdff973c86' +
           'ba5b2d458b79fb2aea869e9446100f237be0a4d24e201d72883a9e5b7b2722555b5e37d94b474397389006b1275d510933ef66f77aaab4403ce23908ca83d755' +
           '10bf8818d459e0114921ae794001fa18f7e6d69dc39b796018df5484eea82cd8d864f498848b3b4f9938ea3efd1f7934afa2f0ed06e85f8a9cf0b49067ad2eff' +
           '278158d312ed4bbe77d801a40f862ff85f7d95f62397e19485ded82c5633f5716e3183ae978498d6b3293ca4aa051e2589c2baf74f5c55ee92b80a395693ce0f' +
           '7b7cf4c659d3be8a8bf185a8e6195fa040709dfc96e0aaa77b5e4eb02157265fd0109dbda55dcd9e1e5ff4329e9da714e7a37672769320ece51b93f1c7a79474' +
           'f466088ae83e5f6d713e51a0d006de4db3519e132c635eb68abc8b979b2e367a9e0ca0375e75c6dce200bfee70f8cdb431070a291fa48e7f61245811a64d7b44' +
           '7537342d1971f92011c56f774f23cb9d8aa1739c88fedfe46c8e181dc8a461a363fa05a08ad01fd81960e9190566d8064c45d92ff0329d1e69ec57e0b729ad96' +
           '512bd823d1e2611e4f8b8e4786e4e333c47aa98a3e7deefe2b79dae8fe1bfee2db38eaf118fb6bf4e0d79d912f9703a6366c6707d8408bea5e5c41b498e3ef9f' +
           '53123fded9987785c3fb90d89268fdd68fac33b8642c44f0b1c0639f3e961982f12fc610df013a06a61f829b62c6fdd24abc7f2d6331c9619a46337bf0ed715d' +
           '8e88e8132980dfeeb0a1592fa674dd28700986af57f916f9e24520d431ca96f9167e09769114ebd2332dd702d64e8358059f19463998fb448d31ae7c0d3dc25a' +
           '349a73aec76aa03901024a73e9331ed7298401e68a4daafa5f8538551dde5ba7bafabb8877e58383d0266dc185dd0979e22826f421c7164e4753259d9d9b641b' +
           'bb9919987056d375c320b8e159cfd7056e1f44744805dcc69abffb0e47eb5dbb40595f39d6f4d12e9c09149a8d62e40206a54adb0d6a650f2d69861ab13b5729' +
           '5fe7515ed7ac0be0f43ee2cb89a102a8ed56ca7acdb565aa5ad204539160b4d239641384fb5f8e07bba661f780f16548c35447274fbd228e9fcb7403b2d13d2e' +
           '02019f90f279dff01f799f0254de8211254d79ab094c8b258572cb95dc2e4cdf587a1383bc50459057cb31b1a2c8e5be0231a365d7ad0e56b86c0997244cdb53' +
           '761123e7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000071ddf4b6b6ed41e007e4aed6456079ae91068e4e71b8eb948e82f255' +
           '11509b0182818a8b241e9a2a08e427c0cf6aea0101000000'
    },
    {
      set: 'FAEST-EM-128f',
      file: 'faest_em_128f/PQCsignKAT_32.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '91282214654cb55e7c2cacd53919604d0d059099f9081de485b4505b390bf71e',
      sk: '91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add',
      sig: '465b73c8a98d4c00e4490db1c3d4a87fdc15b24169a5b75f130f561a614ce4a40479d109bee87e99538ed95ef39b7c8a33944448b9452092e33e3006998ba6fa' +
           'f5eb08ece7be355757cedbe89a7fea93e61d324563c33817e3e74c7a150fb159414d8b78d3510e0af9c46da519668707d1249ac4e760b6d22f776f49cdae81f5' +
           '2fd6cd7a7c9634a31d1d70c2b873f43c5b87d2be7dfd7c8deeb3890368107cf916ac83ff0b95335573713f44f16eb224fd1d49ae09023ec9f3cc185e69175a8c' +
           '235de49e200ec848ea8b8ffec7140abd41f863b5782a55a46e3aa6c0ec336b9fc79e247167ac0c46c9caa3f61f12534e748c5596875f390df2ae9130c5df6336' +
           '8ee3e20fcd5f8621c03682d9989ec884a31e84bd9afce8d28f8f0f5ad7c14d9be1cfd1fbed382e21d0bbfc6bd37c0d98f62c493230386676ef10ec99a54a2b3d' +
           '098d5c9f050f0825d30f56bfc7d660931a31627b2bc8d997add78b37d7888555d0ed61f77e1317cf0f8fc4acd0478c6554ad443b0005ebaae52d8e9484f6a06c' +
           '8be68b24f3bafeec747a2818645320ac267c775cf6db0353934d27d02e9ddce11ae3871d4ba2bbbe2e51cab36ea871b52c7aeeb8e9bab2961fa1f203304723d5' +
           '41c9a64fb3fdb1c966441503746c14d2938aa6c855cccac8b9617a675e76cf6a3bb8dc0bf710410b53e434b9d69ea679fd95d89f9161773dfd4cf6503e858512' +
           '2f1443e92e9ce0a3cfc44ae3b33ba853b1a3f510fdcf7814fda9740ffcec3bc4bcad7e0ed4b72cda3ed0b72dc66f73a7fc3064d56d59611afad2685d44b379f2' +
           '087f0ea97a60a8c283259d8d07162a944a6ca697a28c909ee5e1f27bcb44ae970a4f7305b4675e0236005e2c9f49765024c595ffad21dd9be7dda5a19210ac91' +
           '9c15138ab26bdce3708c0b7a9db3ab50447785fa3c3243a58ea99fc9148ac59e954680f6cbf56b6f3302519d1e3b580f81e6fa06fc511f37220d2c627cf34106' +
           '9163b56135afa4588eb37c398a904703d517f87f68cc6753b289d4bc524a9e21453d0be8fa9e4ff460bab10a8cdb8965d47572c5bf99b3e0b6caf2e25aa457f1' +
           '20e47926d8a257ee35f754c1e418b7c6a9f63378967e3233d02240fb11a32b63b560421b849c2190f4cd7793c73010a6693cdc51a9ba53464802c55613243f4e' +
           'ca32ababe91f9290487319ec362fc9264add66f3a5e3470750e55e7478606f547fe6b8c4a43e07cd61f4a015587387315e181d9eeef7d87a464cb4640285df5d' +
           '74db87252ed8f84d53bf9d8a8691bb50982aee56bd60b887a9d2c342a7381c4b6d5f4f19d06a36778efd1800e283a9e61c81ff32aeefed273db3613f9397e5f6' +
           '4125c0ee69b551bcece2371d6f6bbb51870f764fe87e6aaaa7f710dc9416ae7cc9e0d3dbff18d481f51cefe015d77d5da6a4b95a8cc09b61332f9ca8895c26a5' +
           '1163b423b785ca6a322283bf8f8b1d30c464ba1611b7f999dca7e1ea76aec232ac80faa3a1c172ac092995261ca2b9137dbc26a8f0bfa9c977b87f7315db38b6' +
           '673d042d644efa16e39f7d865ca129e0e25d5e6f255f19dee6d64b6d72055c5cd0eb2b3b2fc495db56507939c9d1d7847053760dfc65d831ef1058a22156f5c4' +
           '8a83a3a4fc4b84c4e9759239b72baa26e1dfbabb7ec1d8484552b8345fe346ee16fd2baf32a07bcf79fc9ab098adb2739edd93d8ce89fe1e1975e59a40fafe65' +
           'd5d125fdad5c032e0d3d409ad5fee1b2b9b68900aebd88daea1c768eedc8e277f91e83cd7b0e58aeaca05c560eb16a99ed2e473475f5a9f20aff0f80f4ce738f' +
           '9bab8264ba223653c354986ea6acae0b061050fcd4621197136c73e52b18dd019df358d5c2022f968292e5b65af955826da5583dbc239df9069aad95811337ad' +
           '31f446f2e7f57a0203a3829f1cb0be313522b951696dbd4a6856834640d3f38411f817ed2aeff9c9435dbb15ece88463d38720c6c90825a16be2a598b76ee54d' +
           '6639c1e22c784bc92a9c50f158f2bab8dfc155789082f5e080d66fb166432626b8044904a3a16f0e1641ca2bf73b88c015641657e43f1272db546d9eb33055e1' +
           '9a85c2a5d069900b05ae8ad0cc2ebf144dfd0e557e86a454f3fb5752ad453bd21b53058e2ceee6332a14ef0b5a473340ca1ef1f66dcfeeb106334556b387376d' +
           '7eb6481e67dafdd0e0b8fd7d39d44a9d4c6d90ca5e15bcefab534c2c30b5a3b50f58e9f882052d734ca1f4a5da9702802cdc780611310458120fa1ff583f681c' +
           'a55d494c02a8aca8311b42fc249cf81e72b30618b36f49773318c852710636d58b1616b07fbe47ab5895df302f59a607fbd1546e6d9505a31f9e42d8f5c31665' +
           'a9d7baea5d54fc0783f26131e1dc36ad4077890edbf47cd41007d8d77e147208dfbe6a6c0af30648e66fac29d932013c2ae811b2e969d6a2fe866330c4e0df85' +
           'c0fd8506ff75e7e5afe8efbd648acd224663270234ffed0b060a6f1942109554161166ba8e81e8ad258dbb7b35f82d685ef20d2b69833edc689bfc039d6ecd19' +
           '86e4288a38b8b40443c13b695b1a7f50e8826dcb88f31c80a1e23c9ca0ee84152dffd0e64b8f21073baccd47b56c110cedba0543f3226778b97d0d8c9851aa06' +
           '00e759fb9e526e3286821cd639c4f8af4bd5e26d007edccf21751fa5fec7cc20ce1fe8d035826e1239f707427a41e45ec381ca93ade170c7348011d11c180b2d' +
           '6b4f14049ba093378b321a85cbb628052699da8fedcad71efec5b83511e221ed2464a868c53a2089ff580ded671db58fac8dd46ac459fd771713929617aebb65' +
           '6c175e6458eff753e50c4d6a8e1e3a9d7edc9e99c0bb1efa916fd71e3c1cfb4f0a0c7c425fa2434795793bc265346c7df771c839f44358761e70d3cc300c7fb2' +
           'd4d23b497eddb3ab444b8a096bdc55f0f43cb077c9e35193f9ba41a95ae30aa9ccff79db3dbe52c33059fe096ea18126477018259f14fa758bca9b2a43ad0b52' +
           'a4b0045e16cb102d4baa770e323e6ec006b441e8ea34d309de6fd09a12bffd94bfbf32ae276eeb7fc9d17103ff44132443f4e2c3a2a560c5712dc6cedfe8212e' +
           '4908beff94ded3c4027878c853422856abb702a9d3bd994a05b27f3095edc79612463c27419259bc3ddb474e01b7f2d5ef490c363f939ad3833a50ec998c3484' +
           'e435801bf8e98f0c83b847325debe1f1987a13866164b6fcc409ade1032d2a9bb52e229f1466aa6c39423973beec58c969b26469a646e58dffcf44d081ac0b0b' +
           '6dc9fda8f34746943d78048b92a75cb4fbc220d00f66bdc4001d574c20ba81422a9d3331a3b00f06cd56de73763def1b22f130ec90359cb0d60bb9fbf714e7d6' +
           'a81599bed69c96e2b6d196e9b862889410880110033d264b704e7f6eaeeca5b3fc33f6b76f4fd53ec4ee537d52ee97eee1779265ceede43f878fae58579878b7' +
           '03bcfb701c2264aee3d7cd35fe2b87ccc7c39bf38b96aaa50eae7e7170ccac03de208305f60662dd6efa6f49452bf259540da5185823b8e276399819877cff2b' +
           'e854ae7d48b2532b704d25e883759deb5828a1358b925bf43cbb5643f976eb91ef7385a0a54db4ee2304699fe1386b189cf3b7eb162005ea4698ce2572e96cfc' +
           'dddbc20a8038ec0c6c21d5b85d6fdb3637682ddb9b97fd133cd6627ab7926afa7dba2bdf0b271d52524a8779c587a7f6330b4e88ecee88b881f6b4dfc9430e6f' +
           '42a61d7e42857d5b77d41c48d24f775c8f509c2658685c06f8b4152f2937c3237a4b075d5496a9e7c9ebfbd1700b77acdb759a9bd04c621335dbc1d02038c722' +
           'f809a0989f00cc18575d3b04c91433c937db5e2b256bb9c8e4c66a2a77416634ce4ca4433e7219b3f6c6fca2069837c963bfd226cb78efb6b2fa4585dd1ac915' +
           '3588c6e93d1eb9cfcbd3504e254237e4dd48406f6693c64c9e0117e85f65fad49fc8d9d785d6856213007708aa9e09ac7f05954343a6a1b048879339fcc8ecb9' +
           '47de9673dc2a91ca1a6e8abf72aee5b8fc12c62c364188ec184519271a1aab40367fe3071de850f0a01d3854d69eb161e7c179a36dbdac247068f69e5e14f013' +
           '3d190ab0950176fb6b6a2f6b653d81398e3e87c210dc504981bf3cede07b2ec81f0eef848326ef395a1fa81db2212e09217ccd41293a0dd509e8c33c38b0cf7c' +
           '762de2ba0729ffce341c22422e581c9ad2338db4c6eb474b9c6d7cb62c85e0600cd445fd806ddf44cd936fe2047bb9d11e63907cc17472cf52c29a78fe492fbf' +
           '51167fb3bb96c4b2e94e60a2936d2012ef41bf9b0061c982da16720f9d0e0555be2133b737b8d6390ab1dd7053bf4770b040a83940acbc315aa232572afe1a94' +
           '5a9cda372c68ff8bf342503d9551cffa883721b7aa72b433ce6608ae2421f8180753c7e838c527c27463a4052708b794183a6365e5a627168bad9d76165356b5' +
           '2fe0a8f1691640447b63ad649e0284e94ad6dae20ad48625ad1fa681760ee565aac457335f912e41889e2e0514598477033f12ece3c89f88afdb7b724ac22bd7' +
           '3d9bff407228793c589463f38d5854244816f9e5db1d9e9692919c685597dc9da1ff00229feac98674cbaaffc589e78ecc7b92ff9d2af685cbcefaf59936ced9' +
           '941d95e091893b4f6f98d259af22d74fdfddbb9172a6f12dc57c36297e885d168f222e3e5bce56314f48731479151d5e70d46afd98bd1382be6bb1d2571139f3' +
           'c36c31f35a3fe6e71087f70520be01d7996fbf6e07998d3f153eb5a84b9c7656fa182bed25bf38197e3ebf238ae0b275853c3d4e18042fd072cdbb8d3c2f8eee' +
           '87e6425bf865a39af1f32b819aaf865518374bb8632ea9f5a41023f9adbcf2bc163ab608957546218862a699606ad8f9b800a5ef2ab3417805510c1c729ece20' +
           '498ad8287dab9b99dd7b497a41b824495bb916fb611113d966d566afb76f8cea4b0c415ec05dcdf530888dd69a192a5f63963cc4620df4a51b679f8ef29d6907' +
           '0dd080a5de6ac2f629040dd5ea82fc3a145109810926ab7c98dbc55438a3f271d1615506c4826c7ac1f855d2cfbbe2282b2bb7de931ff7e44ca89e1a0f9ecbf9' +
           '1ab706290e93aeed875a4e662c6f873ec580c27759945985f082616e327275bb7580daa5ca5e045f5e8b463d9c391610a0b73b6415164dfa70dc5711b44c7d5d' +
           'd0f2aa7f5a5100763c4636e26315f8bd1413c3e4dc6cd45de1a8def08f6bd19ba23beb400852ef262eac2b8b26405d1836ba0d8a6c6c50e2cb3d93cf53731e5c' +
           '6b9e9413855e77b67e128178828f58b6dcd9875ba20ad257d864cf53470ae39c9c0ddade7e6e3ee10229ed9b216bd3c78648077f7e9ba6be5afa78619ad70496' +
           'da3d13dbe637c1933a1980369a0c6a470e0a25bae355a9b8008fec23e578f54a91d3a5d317b5d626ac4b917000e10ca174e69b3308b508b171d5ac3b43626cb4' +
           '81ad67efdcdf1bce86d63214ae771c7b1101f3f7244a9fd93685aee2e6ce91ce15576bfbcd0bd2f1b66a9a201b579cb8a1e96c55c127cca080eed34444115082' +
           '9a14914bcad5efae67182cde54901b24ef98810b7d3754e100978da9ca58c22d2ce7b24176cee5fdf49787813f5b27ed3db64020663c7f4a1c099433aa09915c' +
           '17c338585f3663fa74e4f68b4a2c907c8f2bda8bf1002ef93197a01cccd5b3287880afc1a8910984e23d0263e53c8e7a96bb948ad2e2ac56791cee0431365da9' +
           '1d678465d1679421a05a97b084eea817c1314adcd8888cac9439a86698cef1a33ef4fc4646ba9317c344924e284ce9654737242847b36e3dabcf0d5f5c09af38' +
           '326dcc6c4bd96437df642798588df17cf389c75a55cc2b9d41d806113543bcad958b8a3c17f7d62d678cff657b8fd4889047b52c57daa7508b6e2b38bdb7f5ef' +
           '74e0f45ede07fa6bdb3bc7e152c3cb12c6556d2d151236994726f6fabfe7936ffc1ef59e045a7b73fc3c444c3a05decd71589872b644a48f8cd6e0178816929f' +
           '32b5f0ddac0030486b79903888cfe5c0893cca3c48e2a5cf7082bc22608477cb83747e46b946f67a87fc38c69fe19a6e68fa42da4fd531fe493968de5c45e794' +
           '9ec6e877f2d3e135b195fbdb3f3cf1ff552a7f9ad55ece0418424e971a03a7c1522e43a7471acc7238e26b48ca85d2471fb89c0d7845908f02650020c1a76a0e' +
           '71c5e79d2dec1f672a4447760a55c623891126943d0cedead14c3ff6913852ef059756cf4a663dd1eb12c28898f7ffebe90c2936782c534f2a923f6e075a3e75' +
           '7afff2bf71a177ca972a4718b0c6af39da602513611a867a6cc6c6cf44946656ad461219262093fa0e4d219edcb98584329ba30c7a9a4a09d2056659308e1ea3' +
           'ce41975019f1bbe73e3218131225ae6222155d88244185f48fad32938a6c4f82e9b610fc54c8a27ee0decd595db8b6792cc6f18e4cf5188c448b27eeb280f223' +
           '752e10a8edc29a34a88eb6028f5fd53cd13b176325e1e3234573ee22a0cef55041fe75dfe81054603076aacf01c938705e190e67f781748bc59ebf9a3c202a19' +
           'a17e91dc46296d61bfae7f94f64efed327b988bf2fa1ab427200c4362e8a43a34357bd625c9657468ea267757c3d34e68c4a4d5aac6108cd45c5662521382553' +
           'd452fabe3b8faa121088877c0cc263a973cc67a452f32a2f12e29bf46f03b5afd04a943577946d49e80c3b2befd155ec5a292c2ddd4bc78b861c687223f51082' +
           '8be18f478295bcacd854ac5012666c1a184fcf38a4f2ed968d559e8fa22c779118fd9c196c51d947a458944d6097cf0e0bd17c506bd962a881a4f3491cc7bb87' +
           '0d1e57339e4d76f30a70125d355e49010a3358c26eb15c9abb5fe4c6305a70cb0f2103b16d1d36ba9422c5ef0ac63c672ef37439b3d164d488676ab00792fe97' +
           '31291afcd518084fe31a9beafc212f97a5d6b8e3ea9aba7e2358a0f3d32f4057887b1340905ec655b70d7f32ae876bbb30e0303587afc090e84d4f28040c63b9' +
           '1940d158e95ae6f85ccb1e9fb8b94946000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000004980afdf7f25e9ee58ef7f0d52d5e3005a15e44b53378ab21300ee08e31cdf39' +
           '30000000'
    },
    {
      set: 'FAEST-EM-128s',
      file: 'faest_em_128s/PQCsignKAT_32.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '91282214654cb55e7c2cacd53919604d0d059099f9081de485b4505b390bf71e',
      sk: '91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add',
      sig: 'c6efa4877a3081d0969aaa89b7864a1e6d1e7fe4c22e7bf6030f2d12e5c5e08a02811ea4b7fdd077fa1560344c82c853aafc5aa6789da3a6a258ebad425e66ca' +
           '737bb0740ec82688299ca0c262ed2464b0e4105466b924688fb20f08b78ee198cc6faba83018503216a4b49b35c7f2f56265f14c54bf92c02877808038baaa28' +
           'ba5d8d39ee06ca41d8cefb8e3ed23128f8c3b16420f6aee0f0e2b26653c1575b548e2ad62152d649ca3fba31189aae6d15285a4ee002287589b14753bd7ee958' +
           'a7a9e12215566e84652967f67e2c0f785244ee3426a961a7e33730972e292dccce6863cf240d74ba4e8d2317f609905ed82b391f40d6c623380da4f010830d18' +
           '218c2d2fec4a726bd5b7d6aacac8d28909fdedca3ad5141f9eff5b39aeff2c22cf9e244e287112b799f6db411dcecb889ea1d9afab7d114ec72da603117286f8' +
           'ba4f6a28762dde26c1fd761575839bffccca12d961cb7c84b9754ea42d35b7bae37126bdc3ae4f54acb6437e33f371ac267b90fcbf84db27e41640b0d3449211' +
           '05d1ad8a2d9f989e1745f7d1000f2fe82ebe8d461c583e56e4d2ddce21f26c7920c79051a820755a06dbee01984ac5a86c38e6b54c81f8b8e479a4dfb4d56b7e' +
           '1875d12101269ff78188b9b8b5a4d1154ef728fbeb5a3cc8ee1c4989a00a8dae674fba184f3a24ebaaf9b22183d18b8b4ce2fca6b75318d8298311d5dd5b323c' +
           '37ca2d9562c70b9559fc69d09188c2586de646c54842bfbdb468a9d873251d730386759baa0adf84bd7f635c8250bec2d3e3013d304f23fa7f28fb5eb3d6b7af' +
           '338f34b017e3f79def13bdb4fd09d2b8bfe85399357a63d8d1695f9da9b17c2a0672a76d398acb15f1f71f45d51990a21dca255d00382886d0f70cf8738206e5' +
           '17f8e778ce1ae717fbaa79543c67643ff141ac97eba0502476436a1d2e0504f39325d3df7623e827f5300ab3691030c642ac36afd70b2baba2adf268968401d2' +
           '67e3d752298bb6ace887e0ffa33569c1d00e6d3fd61bf71230dbf9381493d86df507a584d9793a07590de52c72615645ccd13435d76813ab619323b9797be63b' +
           '6feef31de637aa941dea14cf631cb703235415ee861eb7779db9cd81e9b89f68f9d19f1df277d324a08dd575ae717bdd50cb9073e437d0257ed66c05115f8030' +
           '32a854c316ccd1718403d782593f1c79e1f973a811ea7d736d1b5cf02c9d897e8ffba6252c41f6997c825aef687b592fa8c490a7728ef5f255c16c320e223cd2' +
           'da6f8d518932c347306f3b6d5a84bdaaa7027e2abc4ce6993acb75c87b6442816994e394107a345e5e6510c9b3a941915c4e49ac67616ac47589edabc82d298d' +
           '8c68873aa175bd7b2a634ac2f5ab2f3767e02beeab3c482f01137eb050b2d59d7b929d46e31f5fd8a98fa9a470f9f3f80f6fcd56a129cfb61ff07a8f06950391' +
           'd603114d46aced2891c70200cc88c9dcedb2746ead694de342ea20272c8187040fbdb947ba431cab8182ca86b908a0a296961c95b7e5f76ee15ccee9c81acfb7' +
           '65c4e73a583a67f1e1e9995e00b1362d56247dfe72526444fed61e2c2e6dc979b261f35c630c3f2c2ca49c8182ffdf8687389fb6615d00c042d3d3fa31a510e3' +
           '02a2cec8e15584a600d06be3fcf94725d27f1ead3ff22261d81797efeb56c06a80a944bcb5f5f8b2639df767edcb5b759db3abe83dcc4793f5d4f20a8c9dce52' +
           '800c13642cc14ca2167da584f648e8aa428c85952633117929de049cb2be7329a1f14b67fc38574b5b1dfd0b2e4e08e0294ee0c6cc1999a2ceb5e05ee823a8fd' +
           'c8a4a8a63e7ac03da2399973974e3bcbf9b8efbb9a0c972ba8980b8329246fcb680409d3aad59b11f2743aed9cb6b6657e506cebfa5ff86093b52961aa5e9f8f' +
           '6f52860677e911f31229e4ded5fb25cfa8dc8202b303fa66e4a2071b0ed06c281c494897aaf7d6613212d3c695839166f44a1e0efda5d2e431fac51901dd4b2d' +
           '24ceaf7694b8184013c90621988a2ac726c9756363f9271ac61a30e859e593b3577f5702413f65a21c0986ae204a3cc7a70b3dfb9b8bccf10566c592bf22ef4a' +
           'eed31018e48520d3886ea6b8061a4a0278e23fcc3eeb47f0932ab991dac761b3cbe0d50ff5e0e73bc40a8d10e54e89d8e246a5ebcd063a14f52b766c3f446a0c' +
           '8556cef4ab9d70b6d0ef7c5cf33800f4dda5482de5bcf3f5f608b3aa140274ff33c5d07431323e33a473580e5fd94ae590d8d54a439a56e390b36c02851cdef3' +
           'f0a309f26c4fb8905cce90041de3a63b1d67ff0f6f75fe57cc7bc0d8cbfa83723cc8c46909c517a71a41d9dc870c5eb75155db4d4046779f5d231a17b1fb7f63' +
           '979a431e24c0a035975b4618e313527b3343eecc2e1d8aa315ed5ce19d7f98c6f0198cf689c88a19658a442f86ed3c8baea13fef247cd4cd21b767b878632a76' +
           'd1b34e25a5ba61fca42bca596e521c02259d32535ebcc7bf16390f215582c65e76283d27be3d291567452960bb2e6de0225a6ae6ea3949e94289ff34b2e1237f' +
           'd49cfc2dbb10eac768d407e6b4a9c9f750a1ffb096ebbced0b934faa36eb785be3b398382d49b07a866c86ca3edc63d9ab14262bbf3eed63fa60182970da2138' +
           'b973df37d61db28b5f903028f7dc1452abf259ed48827d3478bea8fc5b8640e4230481e7c53bd85ab934cfc92e1bd700c7adec87dfdea3c3e5bb6e57083cf644' +
           '266ad5e38cc51c9ab9dc1b2f87963fcb5776e42553dae8f0d1b3cdd610f0810cb8e32699affa9acccc19eb5a3740ae329a22d94c463e6bc4cd4a5c6462e67238' +
           '0b5357b75b5e429d851272f3c3f14299bac6e8ebf57caaacb41aa3fde022b5b3ebea196c5cfc47e05feefb6b027e06c4d4dc07bfc52dd41c254531610c0578b8' +
           '65e26e74c21d6e1dc810fa741cfd9d64908438d1453d439ce24c45cbbe437e3a1f217d1d70ca34b715612f26784dcdb6148f258b3da8a82f936640adcfd095b7' +
           'a53f4407f2f1b3f055b2fcec556c3e20a0ba63b267591bd31162fe66731ef938cfbe5b75a3a94c359e524630616d90375d7d8c53eb36367fa62b4ace0e9e24ce' +
           '0187e89cc845df0f9a841326cdbadf262edddd9770f9d50997f7593b1980ce7fe1966b862d458a7b3e1340f854a4d21cacecd1df2bde6e37cbfb2dbafdebc4df' +
           '1a57edfd126acad5d7e2c865431df575a8e56706066d39796559e701a7fde5276e67ded52f6e621621c1b9c73d0c13230aa638e66adf1502fb39be3a0730b6c9' +
           '3c64896dcdcf821807b88d7f651a2113136ccd6c55112fa16e4c6811e778fa4c18c131f60befc9885d7a03018eee16a7f6f1d73ab1b8e385c57cf68e877c5a9e' +
           '34a66e85347c79a7d751d18a2a2f55fc36e5fdc107a1967ac3f85538abcc943567917f1cb4e1b184753ce9c4bbac34afc7bba6806eedd09e43b500d1c01d5b69' +
           '58272ec58ec79e5b02b814cc29308d21e9aadb9dcaea57ff10a63d599273906078f563f1286c64c06633195dc22b2385c1d1b7f3ca2198b7a270d0fc59019ee9' +
           '804b722356512c8c397e5833a29d858ee5b59b0ebec6ac181878baf351ae1a7d07516f76984a305689f61c8d5b6c4e15459935bbb623b6342a7e0a686d9df434' +
           'ed8671298058e805dd096f9e3699081e19d9c136b2ef1e8edbc259b68970eef9b2eb147f05eb9035885550bad50dbdb9b8fe5ab044d0534bb843ec7654edb017' +
           'a1fd0eedccb71c7b134d5c662b9e6c600d1f2cbe15533b98be9cb43091b6d23a996ae43c76af683a3124e5b8552843e12fd44f04dcd93d2c5a4e84e433f8e959' +
           '30adef6cd9e87cc90d0522f4eea81111bc2cc3d2f6710d563a57185d8634583eb1b8f48c3c3a00f63d7a70907112a1ff00229feac98674cbaaffc589e78ec2e5' +
           'adb643e9c21379112e7e22da3d30e76977e2c588ae37a7e92d5989b179aa5bb916fb611113d966d566afb76f8ceacd31a2e5de8bba9a06615b5666f99f4e5853' +
           'a1523ad4dd1f211648aa994f8e677f3a87b9057e75aa0324280a41d6cd3a1cbc53fc0125a5a414b8af18cd18f62c11c593b4efe3cf0a9052ce1577738a6a4b0c' +
           '415ec05dcdf530888dd69a192a5f9b881800797f4b156eeec7547d6b40739e91be495d660b54e95275de56242267dcd9875ba20ad257d864cf53470ae39c3f0b' +
           '2ef6bd942f05ed83b41b263fd439c5923f4b28b1e524a566cb7743c7efa7b0fd7a109b08930a02be267cd71b4ca72c1e1cdf70fa032b28a8eef8993f11e6eed6' +
           '9f0c0d31a8b7b4783fdae11bdeba36278e85106d67aa45e6be25eb01ebdb9c0ddade7e6e3ee10229ed9b216bd3c7573c24b706b0ebcedba7c4ed46be9ff7e6e0' +
           'a01a4d66006ca22c184e892b05168f2bda8bf1002ef93197a01cccd5b3284c933b5a8436b19c44a9819131311ddc7e3e81594b374d05478adcaf09134af4a776' +
           'd22cb64ec153b6866feba5ef841393f5d96a8a9f084e678f33b32acef8b97880afc1a8910984e23d0263e53c8e7a7a63f1232cf64239adaf242d33ea31b0f28d' +
           '833a63f2ae0ea7875a0f1eab8ac071589872b644a48f8cd6e0178816929fde19bb26bc8369005a33cdddddf9f43ac772fc82ae00560a83494ba2da5d5f5c3e50' +
           'f2b6d90c5ade74faee477c8599dc32b5f0ddac0030486b79903888cfe5c0e80d61f0bda672eab9274d9afe9729950c6057ea0e17c7b8afa039a09b38d0d1ad46' +
           '1219262093fa0e4d219edcb98584a2eb6029bf85da063319f6676857b5cd502c33726876c48e3f8140f67b039f15e39edcc96bf2b7315b49f64e390d4c475efc' +
           '7063407edfb2c6ed11d59e64667d5857d896d073a2124ffb08e3e48f8b0f8c4a4d5aac6108cd45c566252138255382a7250188130edd9c44016a2f9a935d5aaf' +
           'e4a4fb98e61bd4c9597a2a30284cba0503f404e95b445c2113b664c1d9a1d452fabe3b8faa121088877c0cc263a949bf7473b6f7813c23318dfca996b08b70fa' +
           'b3d09d97ac56f3d61033112d275403d9a9f29ad745df4e84aa4402ec252a58a36ce4cbbe1129da4059dd82b11eaf0d1e57339e4d76f30a70125d355e49010f21' +
           '03b16d1d36ba9422c5ef0ac63c6731291afcd518084fe31a9beafc212f970086622935dfd6d5cd1a6699e52973bd200c8687f7fcab68961d7af0cc3d4474a665' +
           '7b309a3002bbb94b9b182db69ef2c1b2c7866e21ef206a4b841d257db02230e0303587afc090e84d4f28040c63b9f614d2ade9d8c18e4b0f8efceccd337cd7e9' +
           '34542125ca48704e7f2728465fc60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '000000000000000000000000000000000000000000000000000000000000e5b88635908b88a32cbd29e710ca8d005a15e44b53378ab21300ee08e31cdf392e0f' +
           '0000'
    },
    {
      set: 'FAEST-EM-192f',
      file: 'faest_em_192f/PQCsignKAT_48.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8210e556067407d13dc3b85aee1abd394131dde28c0c05f679a672d04b1d71dce7c',
      sk: '8626ed79d451140800e03b59b956f8210e556067407d13dc7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803',
      sig: 'c73b0509d13a467e61441de1bcc808e63b372080777a45a9d6f083d63c5d4311f6cb4bdf1e4a1fad261bcac3d8368975dffa69c53cf7e3906320b7d889e6b3c1' +
           '32ca659a8277066be89bee5b0a4431903b060abacc7ae155c026540fc8a0668be8159c1fb0cce03bdde753ad94f5e3f4a67ca43bb0608acc1d3885d93678c0fd' +
           '2b01b7ecaa395b242257d8a33792a9b9436416044b9605955851f64589a76b5a904d2c502f591187e2baba8fb1ded2a1847c46d3178f0d8f32a14740db9dd8bb' +
           '07029a69c17af62d772489e136d3c917ce1cfab267f3c0f79f82fbf616360bfa02386122469bd2093ab61af165117d2a4c8023b2dcf9300a85a839aebf9d9656' +
           'ed370f1cbb70b89fc05ffa92784cdea0773b8cd8e1460708d0ced3c556a21947094b3d5462e61c6ac2901ed17a9d637dea3acb1c9995846a8b8cbcf2bb527bc2' +
           'b86d092583ea9bf57b66be56395e0d94762a2b2091af3c89fd299861c16f9b2d8c9b90eb82d30c3cda72ecd5d6e2eeca42db3e47192843f97f16263e38686a9e' +
           '98a0cbb8294fc21dabba6028bbe027849fc8e2ecd6e118c93171c42a8a40b69056f5d5bf8f7cf01d863671fe20feebe30860c2c3b89eb39727ec6523a4944a3d' +
           'b59607952d3533bc4b904ab0f1a02172755788f2af7e6e3ec795e8113946f2edc4e97ebc6c6ecfc11e2b70933ef028880191261281da4e3ab1637580e81c76e8' +
           '286d9956f119b597685900a93221ebe6b6438fc552c66846f31d90cce14c891904ee4e44768977a34f24952b7e35ec053f26c0331083d07d737afa0d4b622b1a' +
           '1212f3ab68a0e1db7f87f9fa60927d7282ee54293be685a1edf5044d8e95cf9e7598251f63f63dbbc8656cadde642cbe12badfca258ea6614a3a126b2de28309' +
           'bcef16a6437c5ed4ce057f9903d99b53e27f080a64413b086b30ab015b2e240ca5be68c79bb2462bf07177e8288e001c448e2d01108dc80244887e6321e916e9' +
           '655c4a21d1ee30285f9caff599ed52c6da661b5e5af7d0f4f7357cdabb5961eba48c3494c5196c5107dedc061940332117fcb8e33cc6b4e24fb452b2152b6a08' +
           '5baafe3f2a48abbe63c214bfb6e577165cb7e7f6f243c22ee25f30ff060153006ab76d6278a4e5cf1b0beca0a9016f6b4ea3aa2f874d6d898f187798de79756d' +
           'a997e4e01aa114da46e25629ca3d47091b82cb9d2ebeccc155533535564cfb47da49df66af55620841e3b7e8e8d42c2ec19ad8280394d32ce9f570cb53fb28e8' +
           '0f4d2606ed2615a9bbf4a22cba0a363cbcc17c1af247b680bc7880cd80294497b182523792cb840db7ae08662b1cc4a56c73f9aa888bbca8f737226c46a5cdaa' +
           '24d6210923e41ebd95b1f88b368ff90e69aae84a87351da6722dcecfb126a02be9fdd5fe5b72bd39a613aab9d254f94dd8315151e775d4ff964c0d456f046fa1' +
           '3a94fe9cdc9d4987b74d2eaea52de5fdcfbe624e806193e75c84a73f18b65adcd313f1126fd82757b345efb9c5a6fb939e5565b6b9ab574f5af5142a7f4a2b9e' +
           '1274a5ca451a6e5f5b4725385123ff5cf43b52c31a56ed4113c79853ab39b62889697a1f7898618912a90ed98d1385c048c4038138411fc689a34b0e6c945ef4' +
           '87efb81607a8379497a0870a9f496ed52dbca543a13bf99625b1c31036c0c446b00154a38d8bf40553981724e41dd1536a63b3edbd6d171f54977d7682c8c930' +
           '4c9d67446082dc32fc78ecc477c968f84d75d508bd3e967bfbae80f3dda3e52e65b22d3d64aa21df40e591fcb7699d992a783b660c7b1db997172cc97088b1fd' +
           'c3c365ac85010559a3c634577b94263d03af60cbdc9d113ad479cc801699377bd281a4a553b6cb552f03821129f10e79c889f57eff63a6dfd9626e859580b5e7' +
           '27e38cca9306820b51681d379900409e42b4eea3f07031a2e722ede1a09792eff5d00d1245d9b8df0ef519002419db83c270ca9f97ecce6f5cbb03dfacfa65f6' +
           '48b88da64b1750d7bb1fb9362a73f292fdea06fac09d15741a477490670a6ffaa2cd7e16a07e4e67cb7550d4262ba86350bbfb070cce15869ea1e6e47e48b19c' +
           '391697fb656f7c9857f70cd91814029ef6430f356d7a3021cfc6efd900624db4655d10b31bb024e8bef30883029d638b3f772b0153460cefd0292c41cd08496b' +
           'a13479a0a6790a442a16accd6c6c7645073bf4504c548d55a57135786de490d88bc9c3f5b1a7d0c4c35a29817c3b72fc61c5eef7753ce9953501cae6ef1c1fa1' +
           'f4a83ac1b5eb75f44851390d14c3e44b6da5317cac922ff062cb9e03ccc0b8d5491d9714600fa5853c0d63e15ae6fb87dafa8c5936b2845225f32cebcf3e0115' +
           'eb42855ffcebf30190543a51508dba597f3dc5633b364d29f5dc4a07d22b362bbb860ba74f508f05cc7e4075a2d977739fa21fa438c92f1dd00875e7cf6e548b' +
           '606c64145f8503ccb48d5f8890e0dbec9cb3a8769a2a8abc5fae498166c2275341c9dcc2e792cb49a3c0536e38e2a310095136c29e3317e89688a3fe23cdc964' +
           '71f55e17ad03d581ea4c93ac42a781e3cb49da3822695a1818dbaf8510127fcc87327ff74c0b6fb76e59ae3d82800b0f9f153eedf615588c3e2fbe1b5f352623' +
           'ccb81fde3dcad21ef80cf9f898bedee7e6150d9d482faedcc1b9651c917f4c31a9ea1dae97e279c64d4a9880cb6166a6cc4b7133626eb0728bef8a6ae6c5affe' +
           '9f67bbac182a9fa23b7fc49211acc552ce66ea6cada014a14fef0de5a9753d18a3f0a01a704ff48feb616af061134d9613686c0a799505b3a47e7a84b129a17b' +
           'ab517dd8fa155c355272c22eb75a8a8068fd99121200cdcfeaeea157fea7936a3255813542f5fb6d4e72b9e4bd27825a474f81f600609be3701a1d239d0cc8cc' +
           'd49483d240163ca71ccf1284532a5c68c0d2befd036c98685f04ab1e72c32a0db02fd1ce32f133b2a1d20347cb1754c4c929a555d26bb2002224b6dbf538bcbc' +
           '8bf3830959b9dddcfbc9659cfe8a50a091839af2eb2e471b23c16bed2c2158a5d6fefcbc21e7635d78903dba6ca4cfa38a0c7eec95940663a9752c1a950d0301' +
           'c4d943d45d02171416043a4d0301e3cdd7769f5b16837d209f37e5874361dcb9ba025361db6cf020178a52bdfc2460755726777246ff36c320af6b105ccf7929' +
           'a63ddc3381e2e27a23d7a436745fd2eefb85e1eb1941dc63f1538bdd6a1d8038787093ce663c40073844187c668180f11cd81d03aed301c68aae7cdcab568ca9' +
           'fb5e8339d37d54f41cc4429080f93d370fd603fac386a4e2cd6d2213b3a8d05ca22fc8a86a83e6e9e8a341096d8c9dc596145e13e4bd31c74b438dcfd59c6fb0' +
           'af3cf2c3373ab65f6e3eabc53201346f0bd0dae0f9be15acfd24b2ad0350f9f5df2e148d79ce9bdba351ad06132da3588d58bdb74ffd54262a4d90bb5521d083' +
           '5b05ef8b1102d715f50e8d736ea06c583ac549361ee2999c0b7da303edeec36291ea306889efc8d012b112d73ecfa850e4b6706e8eb72237237befd9ee035641' +
           '2f6deb4ff82d46c8d03f2daf616aeb0f9adf9e87c1f36a99bbd0dfb35f797acc04ff9f27ebab2ac340f0cca54f4851045d61d10bea63b0c0dc88931b25ffff8d' +
           '363104053fc58451b35168bae8f7b4027302cce27cb73c3a027af5cf4588a7f1aab5bd007ac25b2ff60521d221570d1047e5a11418830abbd86eefcb7299f1a6' +
           '49606a731f90e2b7f6132399cc0bae74aa6c68dae38f9c0bcb3e882bc560a824f9d10fa456c0bab44d688b271116c968fbff083f6a5128ef8381b801dd2b0f45' +
           '3bd187762a80bb82ef2f5beae762da6b82fe93be58810a260bed7be3a7c8d1efb175aacf299954bbc9f2de2b6c2339bf62884b5b4c5a80b723be7969d89ee3b7' +
           '33c555751e413eed524c845c3b418f3438b72a8b08cc5bde9b24718944ddae6c02e32a6614f7341821dbb8ccfc77a1143a86550f4411e0fa75189ce3efc58de0' +
           '78abc79de9f22352185607c06d186e697cdec97d7158769fe249010296e2af8a4a95ae73cf6474171436c5e8b2dcde421fcaaaee71503c4f2026e66eb94d911d' +
           '6f3a5633b1841975b0af019be6fa1b64a856684f41d7e7e036e277f2da0bc03432d68b0fb5b5f2baef090a97ca5dc2456a40fb223b6fc5eb4944ae1a464f88cc' +
           '1f84b3497bb7f70c9b07d13f4b9733c1bc6f46b302d097d3da4ea7ea297587080f11a4395ba6982a15b36946f6a5298ab59e07c78dbfdd04615d3ffdd752298a' +
           '7f2b8e8ce9ee7882d1b7d08106acc52d9ac74e6c42fed817da51f49df81f59a1dd288042128a2b34b11088df7c3fbea9a56b38e25845765a9090309a7750e389' +
           '9b8231aa683c41ab31259fc2dc8e7ddabaa5088397d6ea1d3f7048713367c374423ec9361429c6d3feb860106636c8b5fbc98b6a5586777a6384e1ade2add915' +
           '5a5f7dcb833afeca69fde083c9d767ffed870a28b8cc930079d9e2c9dbc4a1060af6c5d8e25798b40df290b4bb59da4d951d624b0d731d593d4eca70cc8e671a' +
           '4dcf13af2c84ad041f0e5ae5a7fcacc3b8eb0a6f74156539f87c2e7361938e90fc0cf69237ca8260143c2ce5db10b628009add80b0d25d2724b0b429ac5e3aa2' +
           'fa5d03c881af1552b35cfa38196ed71b28bf283525b86e1674a852e37783525a90aa7e883c91281d98766bd622780e55cf5fa2457a462fc10b4cf9b8c6a645ec' +
           '78ba5b13c0576393564d721beec4a143d2cd010f77deac36dea67125d2c45bdb6959ea3a262b2b41fa95e504d32f7cb760876f691214fe9f06afbcf66384fd70' +
           'afd30f95813307e41e8262741c8d12d9e6f69bcc01c829eeb617f71f3d31d144f55fbbb68b39ba68d981a6ba55ef5bb34b61304d5d4bad2cc73aeb635ecca770' +
           '6482dbccd84e32d3277d9641d7f38f9e4cf266dedd310f5236dd791eef01de18c86183bd710563828dfff444cb1cfdb946efb4e013734783c23449eb699f6a5b' +
           '27d4b4632393ee811e7f3f2bdd14d5aeeafd573932e5a2c479fc113b46b09fca550d8fe238f4369b775d487872c780ef7a481e0ae3f318b3b813ac9e377617be' +
           '5bc527e8f1bd54a3ae13768833bae75f77c24b666816912fe08b8a0b29e2807528d295a6831e1cbc471d847f5cb653edb99abbba709b31333fcdaa6891e70801' +
           '3aa36f7983155de5757eb6eddec7242c4b7da275c8d66b8eeba4098f7bdc99c0adf6794a6467c3b4b441fcd82e1a476919b491b1742366fc6b498ffd3aace050' +
           '8d66386fe76a85f053d16b07fd8940cebe827d3049715102f596db204aaa7100fbb5721188b0e7f90a97fd27cc0bab2247e23a3811d7056e789574a17c18a836' +
           '5d1ef6829426ecc19900b151cd9bb790f5e60f895d12be3b64a9605ea97fa3e479de985390b39acceac977eadf9936fa1735122abb925c8b8938fef6f9ccecce' +
           '15475327b12be2c604fe7dba983e29c4c944c0814d74827aa33656c1bf1f4180a2e1667437edf946c7351735c48a95b80d41047b8c7a0aa209d1148a7661d95e' +
           'ab05150308ba84e5bfd078700f5472a4e4a770cb9e746a2186dde27b8e8e2e672264369f5103dac70688899b573eb0b1330078d3ade73eda1e2982534e1f9633' +
           'b14fdcc94ba5cc26871713bff5331ec9b54b47d0b416d9cf403f9aaa7f52fb39e4aa91c5294debd0186a334add7f31d47c75b59cde51ad8d90431e3cbfd4b9f8' +
           '18b821feb2f2b0152d5e061091fe6900e84bf30dfdee6d4558756753ca2f8ceeb86e3a9a03ea60ae04f6610e0c05672a60a08411296738457c2a1810f1399aaa' +
           '47709ff36e0b21dd2833bd45ec9e4643c946057c56bc41b413d58d177f44915ec0d8bd039ad1419d259a3b37edfa401927c456fdbc4d60d82659053f5b674d59' +
           'cdae0f40d02ca7396e9d25afdab42635f1c5f5fb22107e29295a501b408389e1883e92b062573bf222d12c602ddf4f799c05d7a13cb784230e3c0170398716f4' +
           '4d83dabecac63212c84dbe31ddee19cd330b1c59e5c3f690a0562ffe4368678f8fc687618c6bc413224e52d0adff248baa4cd70a9638c6574d168fc898268f96' +
           'e88f947729912dbe82057970d5504e2224176cf9bea84610b7ab2e944bc8ce89c08af0fdcea79671ffec826cddcfe37447acea4f6d89173e59fcde8686713834' +
           '4ef05ebf44c40c78b271168b762e233672426728239df5f48adcb05c7cf92ee27ef03363d6a57a21694142802ea29496c2b2c66a53466dbc2d412b2d64418f78' +
           '4139838f1157804d8b48e861d00d1e151b268ec7eb10da0cbec8300f506c3ba013d3a1231c3fddf8219090eae3613119009d98343a8101f585c933def900e866' +
           '6f83763ed2a59dc8b94c215047f279143dc3d61e3cb319df03f2e4e01e508d6af8d8bef13b44ea613050f58b65681648e680fc4a68dad632063981e00bc9443b' +
           '37dbaef53c04e70cd171575141ae50f0be3623130a5007c8f8107af4189302ce477fed109970759e33dd1bc84fda13f55bafe3eec472b5b91eeee65c88eac07f' +
           '053564cac9afaa6e7833e89f58f45f64044a1fd8b2646ce4daf54179a529ba1250c4dd4899618391d1b37098a52528cf8ef8e46902b7cf467beac397fa975fd7' +
           'e51ad0d07fb1acb4f12cb279549380fdc3882574ff72bd35bf21046b234599958e98660f7de6cd8cd1849571b9767184e864f96a7cff71682d358bf32e1a4475' +
           '3d8caefd5a2825e981ef3da1778ec2c7285eea5dbab76c9503cd8a812d261ec54ef0677e5bacb30a92223ca988ece9f06d57f9ff53cc05e11c04e0606a8ae6a0' +
           '6dfe78d3009aef5b00515708de4b1fdfb45e49c0a3c8d56bb6e7110a1740a8275efcfbf147c9d662b129257ddb4e78ceab69c8164ac57c309a246ad1b81a6691' +
           '278a99b5263bbbbc8025661edb62b0e8637b7aad863ee7a4ceb70519675390d0b5d69815e72a5bee93f92251ca46b2bb8afef15d4778c9f834cc4b6d19fe0ecc' +
           '06d1658dff42f239ef22a56fcdd55d0583dfbc5e5e7236fa54f7f8c45bca717cf8263f2d5fcb7588638a8490a2a54a761d3a92e3b2327893649ca1e32f27f6c8' +
           '7d260a673fbdcb6ed8acf611f9e08b9962c7d37ea7da8e71b3cded34bf174bc7d727a62bbf79073474ee46477182dc55456ea31ddee3578e5ff837576033305a' +
           'b78e5f54a143e75edf9962650cbd5fb96a2c2d51b49fbae773a754310e5ae1c09574227cd20d4ddf2d37e9e38d516e6d11c7ddb4fa0c8da56c43beb7c1ff9716' +
           '7d8531a4ba481c035c5a86470b6223b926cc44ae23ffb8c3658bfa059dbafceea6cc404b128fe7c92ccc8f235044a893f0aef9dc01d0cfba37aa1e4e3d9488cd' +
           'a768e95c853b29fbd9c2e2a826dfd407a83bc32ae67a4b44d5b99f6fe63c46af8f9de113d20a88ad7da3f8d2a0baa05940afbcd8e2207d7555fed3ea0e54f427' +
           '5313f0d110b469014d2a17e4404248e215eb9b12fb9a5e67ff9fbf28a21d48da270abd0a7b108877962065d27f53f398c7e1b59eaef28cfc283148fc7ec84bc5' +
           '91fe75835697cfcf93419270bd7f9f852210ca7b4a875ce23276e432d1133e94ae04dbd78fd57e6f93fb86192985d67eca97596d0e7d747c768df1c57f1937f1' +
           '4489b103e0714ad4293bfe130d9006ec9692714157961199b4c9426dcc12865fe7c705dfc8e71825cd2ab314ae95b7dc3fffbe3ca461307c9c5c74fdf8dc9e9e' +
           'b9a07bc4af9b0dae9bdd57160bc7f7534fc9074cd3c8c07de21bce133b9712807de56106fe24103232eaf49ebb47e5246a5b574152450f79c6430a7918e3312c' +
           '6532ff01b1b6ff3af41ba56ecf763005372cbc5ed77d2c4516be4c0b02726bca256214bc0657dc8e8b286f90b4d52e2dee777e0d9e522839b49287ab5c415c38' +
           'cac1b76eac4227e53604964cdb9fff24d658d41fbe9836db7063497744ad6c5c5f9c137ce5efe12616bc76a30d8904969feea3d2c94ea64fc9f7ea31cbf73b72' +
           'a1b9a6e954ba303cf44a5554df25f3ce913c763e27712d2d3534cc7b1a1a0b5683240ba5121287b459d4698d506ff48ad3203389fd17ed34ee90e9a7c36f6dff' +
           'a142d88045e0e2f12e33c4f661b4ef94598a18d222f22c273a5a20a438a642706eb970dd57051fcd06cdd3ca00574e6f50b3afe7f2ce632771fde1b8c9993590' +
           '58e34830a43d73b078f7f7ea301c2e2b60848ac8523bb478c014282fd63daf66037e8bfc1011330db00345fb8f7ae2f831c115b665437043eb0c5cb38b894b96' +
           'a3ad67b2d5ac99d8d688c818a0f213f8180a49e56ce514e9be50c7854100aff086b45aa4c84c41054d41c4043ffb886719a998352a52a5ab96b85750c6abdd2c' +
           '96a22fc706ba5994903f995ae772763e90dda9393ff3a626ab74d278d330558952d785b4890408bbf04e09b9fc3171e26577b2ae3c21f05e62a900fcca930f02' +
           '758f7f12ea291cd1b0d9b7d1a47014400e875eb65fd8d71ecef8d47deab1424c1df86c87eaca8525ccc833971ae4515436aa17f879ee3c8c83c067a779f7cb31' +
           '3f56fc3569d67715051d84ceecccf0f41f3bf3c005be069f069e5fbb72459a7bfed491d58189ee92226af2c083c5b955a72f2c429be4353e0542597ac323be05' +
           'b0eb54af5996ec33daa4bafb90f943dd4d051b76a98b3b57e6c9929374d025a969535ab3fa3445dc9ea4d00beb4ef4f4922cf7c67dcecaf787712395b023b452' +
           'eba77c980e630976250a426f1305f6e0730c7ea896080d19fd989098a37c1231c5136630200c3fffc9fe071b4570b9aeab3220b74de0f11f0a427c18f91041be' +
           'b0174557463619b638a9182c3847c65ef2e693e494feac5c4fbf3bf513a855430962b5f9e44fb7da97017295d4f933296b0a0707f47f4531503daacacde99885' +
           'a0de7f4cb990144373e8b926a0f34322afd9d0e6819bea703d15f640b2f944d53be8ea07fc12685520239da40ef0d85e746f0799a783f19236bf86c9a1b4d6b9' +
           '37ecc5b66480a3439284f2ea1ddfa6662eb6355d5f7499115f5c83e711e29400c5c21f0fa28e64e2ed203f6a28cd252acb6180e59ddb49736bd685493d974efc' +
           '1d84da9c65ff335b811085c38a4419355556700acd5b7e55b18082bbe3782f4a5d2d9cd78441e99ad1686acf705b98a1f654790833caa5f27e18524783e786d3' +
           'a0f1750dc882fa13a4622bd47ee3e69a68398c3ec1b50d13cbad02bd644317203aaa52e71a039cb30beddedc0f99de662b33764f2b1ae2c1406c01d0e464c366' +
           'd9b144994b31d849461de64ce6b1fff1700d477d5298975d6d63e320f39abdf52b3944d6c2d3ac2c5ff6e301dce0288565f538f0acb6b7339977353ea9e8150f' +
           '869d8675a833e54adc82d3d21ce77f94426671cbc48664d9eb5e0e27759bb6176acb9e5f975d8829eaaf461cb797e4b79f20c0308368a84d48c70711ecdb369b' +
           'd43531d37bb929159123c8f2667ad6ad38b8f7eca72e3964986495b1200028b4e5d0f20105eff804ebe1525fac73476e30708a9077799601f173f4c3126dbf3f' +
           '3d1d2dccf7cf360951c4e45ac8842be98d8305cb647d5a7d7bdaa18444e02688ce0ad2eddf3d3ad466acc50642d8e1703d9829d9a8277546ca34ac50a24288a8' +
           '3e8cab16cc869c3c86afa164fc239719bb5efad5d956843cc9dee7f4c9d172c3126d97d05f2c733c80b14243106ecc2b0328bc6b09ff3d1fccc8123801621853' +
           '7a93f245e0f3810e8e0c30b9bcb0f13794f6a6b85f286c7c0fd8a910008d1560e04cfbe503e5392d8599dace279b7b5ed19d1a738922ed910daf1b5dcb0171f8' +
           '625ec964c3fcbdb83f04186d829624aa952cc2da24465427fd825f5060ce93b652f55a8b2cc3c793fb4b28b9bdd9c9d21dbee9e88843b88214f07b23b6f57bac' +
           'c16429040bf0d6f2761406c5b38424565b1e2c878f11e286bf3cc0a3e55f7d97c2e1e4507454ecf75fc74884f6ff4877e4d19d718448f5336ea2cd83e623613c' +
           '6e535b579150df5b5eacb751ece67ee847cddcacca6c4812ccfb7ab4433e79443476d98ce72c00df3bdc94c368d0c26bdaf5da87461db0ea7b8f36cd01e3e9dd' +
           'bdf6246f5e6aa49d1538a4d2e9e005b15bfa55a5129aa9dc574a87dbb94606dff2522d009fdc06e739b000480ab27f2fcf7620661b1a153c63e73f8bfca1ba1b' +
           '92fcdb97a38a2006813aa2209e0b705fd12824feccfe18d412e1a61f5ec982c045166da570f90b5cf2f91b2c1a015a7750fd5060cc7be46b8d5fcbf24edd7c41' +
           '8a54466c4150cd924eab40ea3a32457182c3e25578327908e70c38594fc33adda52e40350b282090a32c5582e8dfa6119ae8d653bd90ac91342ae123096eb342' +
           '9153815a04a3481947ec8f8e37c9db832b83244c319900b1ce9c6347d5500cced479497b2e33894951300f30dc85ff70b9df8076e058073e8278b17931cac97e' +
           '2617bf277723e6d1ce4039aae7e7412f92e25653c45c09890f962fc0ddc191e2a9ade179d965a8758a92b228b82ce1dd3aab7e49d629ce5dd89c546e2f463389' +
           '9ad308d71e94c5fcb32668bd568870d65fc1ed3a19d6c87f40327216f738128f361a81cfda9fc3079fde23454d027c5997da06345769200765f4b29ee51790a6' +
           'e04d584d158987f3c7801ed2d56ee99f08768066c66360306c5fc66b062fb8743ecd6e790ca24164a14b9cb379fcfb28a37e9372272ef457fcccd48ad9b55c10' +
           '4da65d7ca14de4e9b12e0e2836a1b93b78067627d7fa3aff626dfce16cc812068f9b53414d3a54a1a143cb441eda3c24cb15ce8c476934cdb51fbb9a47a11308' +
           'b506a6ef0982156e8d5f0118246ebb641e5fd3fc92ed50371883e057c3d2217b5ce693550cde2e6de87d7f044c7d126a6c95e5d6404cae451cdebe046919e24f' +
           '2f828b9082e31572bac2374b67078f429839ac9b3fa049ccb2161ed4d10d1d74302175e39f96cfcf7346f74f19a566497012bfbcd82724abe2525c503e175720' +
           '41aeb687485d801a56c961eb9a3a41d43ef3e3d73324e1a345237644cec822034522ca88fd3dc7dba5a3961eac3c5c149edc084df4e89d8966d9326c2e97957b' +
           '876d70ec309a795c4ad05175d2265ec72c9c07c564bbcf2df62995e232d197671e0ac16cacdb88ca8f88968e4d895b94b1e9f0f1b593382594fa46f70f6c45dd' +
           'aaa97fcf50ca0fe74edaccb6bcb730ceed1047cc4b008b560f3467c1ae1426fd286ad63c9fd8746887ac12eb9879b68c4f9abb19703afd5e81b547ac9bc2e3e2' +
           '4325c3b661f7fc423f1ed661bb5baf8ed29f7832ef1a24f33e3a5dd4d7000721cacfc03be7f4907a0bb12bcaf86ed92ebc851d674e473f409e49b2e00f6d6c38' +
           '87649b96de9624ca3a675c690194d29f64b33ce3285d7f6eb6561c5bd06a7ac644fd27f614d7214747be856323b6c1871f3cf241d522ccea2332424cc5776876' +
           '858867e1d077ef8bf398c7e159c189ffac26130f7a8de1f59f8b2ebe0b5ae97c44ef7ba843c0dc777e153acf7dde7fedbc834a6ad7a8306c6df8bd9f0a549e06' +
           'df835757f171f03dc80d4951fdd58e0d7f5eb523ec5c534f2f0d015758a25929caac5756a5a1df49d5620b22db7fa92fa5da1225dfc28520eea6a94010123f7f' +
           '6d507e82edc038103b27345e1784fea135f9b539ff3bb3f2ac2fbde85ec1d74fb28c7c740126318c2b0a67caeb77e5791d1f8f9cdf01feb7b20db506cd64ecda' +
           '1d71d81793da09a43b321f1cb73a5a2cbd9563d49c7a9a4bcfbb0e5e43acec3bcdfd3fab6248a091a836b49f30bc2f0a38686bbd8539f196c2dcc14cf80d6e06' +
           '17c8877fc43616ffa3393c200efbbff118039aaee45fb7cfcfda204d6c6041f4352f6c8ae831803b1ddd166a00064577dbd2b90ec82ea6c83fcbed5f37dc0754' +
           '11af76810aa45f30ac4629242b17444fe71638b4c9d5dd05080e0f1b3b0d3c4461f5a8fbe1cc8e53e79ee2452af7d694b8a48b95ca3999de16c6b02ac80cc304' +
           'd0d52750636de303cfb0f7cdc0417536b6116d73ad34b2016cb904fa95721c442becae109f888e55b4ecf0eab371d89581c213dab1b2e154fcc016de4d609e75' +
           '519a9d2795aa7da3b64a6d730ceda5eaacea553df51012870c3fa1f6ded169e1aaf253ba1712d2ea68efdfdf8ab103e066d003bf73d68ec3e56ccfef8edd3958' +
           'b2ce98279d94d9c5c556353b116b3756fea99ee2cacc8f3fb9354b90b4d73c41e00b8b5551055eaad1c2991c6a621f6171afd13fdc14eefa72ffe44f8b00b6cd' +
           '5dc5e6cd013ac479b5193e31709fee9a1e72e3769dcac26497847422c0f5e46e077541cb326d23eb5972181ee4570e390d50ebbc4ce0595c5fd7179ef0e0285e' +
           'cb74b69b5af373764a993f7772d7492589db421e6a9b3e94ef0b2c5d5c91804506725bccaca5333c8f65f4d502e07014d0407257bac140e23d0491ad604490c8' +
           'cc81195eb601d540626b11d5123c696ab7085d1495197b479749a4589d1d8c698f467ebb1847992f528869ffc9ec6a462a272d2e809646e4e0f2f6e2bf406c4c' +
           '7970251fd0d941e1d83846fa13a028f83e7b133bad13790fde4236ec3f0baaf20a8d0bc92c1b4ab57b82fa1f41b7a64208e989e64186e31867a0318586ca942f' +
           '0bda303664ffa6d132d12b419152e1b8bf7060e1f759e9c7ccb22d551ee1a9c951275242cefbd0365904aac4e2aa95793259c1f571c94bfcfe083b94e1b00d67' +
           'ed173067576e31346a3e1a70c14b3dd7f2d8e46d42f8e33557e303380eb2381f08586de7388aa0e786265bae5fa4c674facc9b26e19d0fb5b0d0b2d13e8afe37' +
           'ce76d570873e2a061e8560f998906e3e4326475b32c079efb4d05ff65951a794989730f19071d56c4dab09f20245c93fb589ba011882e43ee0bd8e05bdb04118' +
           'c7520b2fd8fe36ead3cb30b22b8bb054bb7bb83f6d2395b096f03de40f7ec2e2a68b3aed1b21708d450050af1e6c61aa73b55f0ccb9ed69d20b5ff13098bf13c' +
           '1006c95e607665885e98aa7c0a8f33036aa3a4bca45cbc08190a8e155cdbc7d63a874b46986d49c09d9aeec1930330dbb2901746db68e1830d3dbdbad699df78' +
           'c348b4d103749d9d2cf1d55a18f76b5670e22c8dbee40ee228ac37ee6568345e90eb204c384b3ec9baf99728f2dd6472c593da1b1de04e2ee7915d070463ac7a' +
           '708d9f0ec473ddc30b0a1e5867b328f47bed4794f84596d34d483f2dc0cb18d70d0486cb414ca25fdcb63e0bcfe1c625ed765f4cca164317d4cb656bacb168b9' +
           'a669aaff3ef6fffa92bf3ef89af32f1ef5d239906eb51d9e825144f6a0ff91fe5171eddf6dda7e2757124c93e2d1665984352de1020550a2a2637077f5004d50' +
           '1b3e5ac1b6479ac3190e1e291ead283e907a52ba01fd711d043b8d17616ea2188e2b2fdca586549ad8e86f9a3cc8b3c1c06bb5c2ce9f9753593a6c1a437773ff' +
           '2a88beee3174e3c1a87fba349bd3889577f552217322869117cee7bda813e67852abe158f5ed37424269fd5f0ec5d2bbb488871060e04325a3d2dfe8f9bb1200' +
           'd0ddeddace59cbfd81d1d28355c0fa8ada26b40b97a8a27cb8952e869183a5e767c1496b5ea6b709a7e974876b474a6df4379902c0d6a840a579a7c5cd754591' +
           '90f40fc3133b53990ef7fd217632a2bf571af6e43e3be5cfac5ce6f17a8cee536aac73e7319c4bd767d2595a37ab02c2983f4e37a219a85c0c062d033dc81aab' +
           '62b68cbf2af1723563f95fa994c2eae321d7933e3d09470df3bc3a851196d26d26186acff3c25d3e71f6a5a82cb83c4a24994d139462eb2545060159e51bd4e0' +
           '50cf4c7b10544b16106649169a20c4573b3c4329ff4177be36d9868ab7501db347b0a0548dae6276f67b45392210653d9002cb7c4d0efe1421af016f5a9948df' +
           '5b2292b01045a27aff39e1fd8cba4ed8f8e3b0ed01afbc147e6f33df52478e099ce5a163e0f3e28071d58272c001172b8194c0f3576f8c453add127afdf54aec' +
           'c5ba39dec840708a71c96cdbdad2df994d9d0d08ff62090db1e6cab1a118ff6d5a93690772b4ea9f73d15ce2aa032cf3e2060bd921ddbecfa0410756efa8a977' +
           '60d94cf1de60697ecebb995ac3d4ad3f3f31b57eb5557eb83e069e1b18d1714e09baf4476f5937d2ced18f3cd65446ddfec0d03259236d6c0b88357eb092bae7' +
           '39aa1f239a9da252441cf232ba9fccdc300d5de605f0460cdc5677b108c525c455053ef9052010b8c3957a68006edf7313181c10108e68e9577ff68ba9ea8c10' +
           '9da766d79c720d9919dce28cebc703b808dd525a4ad4396758c0c67cd064d1da7e19771b611db6c9268d4c4cf94b25576563f63ccfa16bb6019ea42465072625' +
           '2cbaf20e614b94e74fab6c28e6890a32d5a82b31eb4e53f3534b421687ac11abbdf015d8ab557e23307fce384d878e926f1e0805bb320410f70dfbe76b3ba459' +
           '4d711a04a0b497302c743cc81ad67a5a2a6559a5fa4c8e0c2ab0d65a1d6be1dfb41da715f5576c27cd96ac8afe3c3ef0a6e798ef0539c20faac73d6ac72bd9a1' +
           '91bc09be0b88d3a7bcee0ce3396061ece3d788e068bb9cb0fefe0fb8e96fa1c4a19a7701331112a3ea5a60f9c3662c928d4d35fdca3933a99987d6be5a409466' +
           '83a7f6371f2e41b7f99ad8d4cedd73493ceadc118a9bbc748585f6b5302f151e427206640836efc4f5326bc1a946bb5956fa85fba57fdad018c2405f14fa0329' +
           'c9edd506b8b28efae194dd2912e1279d0fc682b7767599608edab840e2ad264316fb1492d6e930a046916fc3cebc611896af2007616056ed4ba21d63d16146cd' +
           '63d8cebfdd6ea190e348eb905a57505242a39dd358bfa4c8c326b40cb1267006ce1226c7c754f7ba59ccf3f2466110d5a9b88bbcc1826445f062961c016fb32f' +
           'e7f6c071e276327d0e1dbfd59d356566b86b1aab2ce76c255156eb0b2881961e32cf0ba739aa82f98de4ccfc0be20c01cf5eaa7ea17151c80da82a641eaebdaf' +
           '2ae744eefcddb39f6d0c87c08eb3e6c9abb95db0d8a6040a5a7e8a32bafbe773fa08e40fe92a97616e745de27d5f48be914ae9a6ff6ccbfa52fbc4b83f594cab' +
           'ea5f0c1be2398b48d029f78ac0e2ebc1873e1b9e23c9b87802eee8ded09c6a65ed4e2e3d2d1624e9efb1b0c8cbc823e30ce1f8c4a833d9405e8ee4e46ee43a74' +
           'a3b39cf1c95f74b77cd77b2b6deb850676e764f98d410b7dc7c9f3af3c0f1f70c99223fd4a13065bacb36e18d421ba02021c02220f48bbac8b8ed10c9e0e2761' +
           '39c707bcc0499c5d194235c30660919f1847a40eab0f5a5b73400e46dcf244fba7b868aed9a91b5351b84f16463737ea4e6fc932ca65be3dfaa7210ead3e47c1' +
           'ae182b25ab3ffe55a6913ff5c752d836b760cee6bebfff01355408f017ce4a44ca2d4cfd6a2342d925caf2ba191ab4d87e7e11f63b534ebe064e09bedaa9532e' +
           'a9bf9adf769531b15fa8f4c29a397489329dca7cd1967531da7d445574d6380ec6d3043601166164794c69fb8e5b4bd1eb07b328cc7a1aad828e459e3415cf10' +
           '8c84b1ad5348fbd970fa80c762c905bab68f47e96218b276f19b57e16dd38c8a47ac5f9051eabb7d37fb099128fd9a321330a8ce5b574222ae79fc5fad846d32' +
           'a2ba1d8824ef12f30f9d3389e5b613122577e0fd7846b924c36a2c81a3895f044fbc59faa71d0c3170e99f92977f7c6b097b6a6b2f30ccf8088a89ad340f09a9' +
           '8ae35a46ef9b522340863e53250bfd111d74b6967257ddf2868c1284443d4ec44df60b1200466eec7f17e0786aff1af64cdef02a11924a04ee0f27051b49f903' +
           '6204f981a2d898fef421f8e23e3c38b92b225d649626b86bf63b239f7d123694b00a97d12b657c0b4834074683c20a9b99fe6cf14fb539919c49022751a6a092' +
           '8cbab4bd059862437417a786d3c580fbe9ea13073233ff32d098e6ac7a21cd38abb3744d328421c474b7ee0fb2b50f1ec938c2dee1743dc6f27af27f0f8bfcef' +
           '2843dba571c75038842ffe3ee888a20be0458ad5c32e06b4403ae41ec5f63511420c73acdc28e0197b26d452266108c65e151fee16ca0585682e6516d9c40f16' +
           '65f996b76d5bcd6dc3232fa2ab12ed459bdfd2dc26abb6e3f2cbacfdf3733da65ce337b4277d7f07e478aa8388d7bf6bbebdd2f36b3248b5fbb0d0c97bd51fdf' +
           'b9b6a1e1953c937caa96ab09723ce1bd8e7a676424357ee36602b792b0bb5ed2716bd4fce57354444b198efccc2f9bde8cb97c138e54b7f4b337b015c335a717' +
           '9ec7cf84d3e5b14f70dc5f4fdbb65fc8ab73218f1444251acb9788e50f163a2e191b167ecf6375c55fe1d720f38b52b74a9ad033b75296b6c67fabc08bcd6047' +
           'e007997fceabe8b5a6389e89d5aa2ad23bf7efea8121c5c3f05fc2f85b03b98c35d448515d615754b62d4aa53e3eafa9a852790716bc59fa359b85e257cb73d9' +
           'a1d8e73f10dab86859a0e9d04bc0289f54a725b7916e0a8850f43402b665149ffad359c5df485cf159456009ccd98b83703ccafe8d902eddba915a29a03fd0ef' +
           'cecf5d24f88f2fd7b4f1e3bfb55ce4cecdd0ca184a00350959cbad85cf69defe673c2034ba1d46bca1018a784458a152c867e4e0a9ff05a48f4d8b4f2b8cfd9f' +
           'f78af4383f9d2214005f6a0ad94ed8efa1a5f4daec2754eeefbb56c80ad90c7c2e546eae2fb69d248131d1147ae83dfd48abf5359b41c85011542c1047e5ef56' +
           'efdd1ffbf54899f94543de1e49dee6a534402844d43a7b995ec1de4cf5a464a2b3996e5253909608329fa822f1104911e10eccdcd5545481630bee33d92a88fe' +
           '01906bd2963eb4d73ab940d9accb5952d7325ee3dcadbaececdedc80ebfdfc117b06b139e16737362d915e148a70b8192ce1685daa107605398cb13b0cbdde51' +
           'd37f83ee79c96f4d6e12a7e2a3ba268faf86d7624773bc5fd66dd3005b6ca30edbc66f902e9bf3994ee8b41b485aaac1d1f394c6ba87a2e504fe0a0dd24277a9' +
           'cfd9a126e87344c7e481dfb7aa2a7a43c251b819980854022c107e06e7f80956a22ab97962f7a51c28b3925fdf6cac000ddae273b12941889e1ffff7961d618e' +
           '43b086c05610f15c6c4c19e836356b63000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f797104961ae2f89caa96df4efa043b7' +
           '8566bae74a029a001d33f761a594e3274d0913743e3cdddea7000000'
    },
    {
      set: 'FAEST-EM-192s',
      file: 'faest_em_192s/PQCsignKAT_48.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8210e556067407d13dc3b85aee1abd394131dde28c0c05f679a672d04b1d71dce7c',
      sk: '8626ed79d451140800e03b59b956f8210e556067407d13dc7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803',
      sig: 'c9022f0e9d8ddcc24e3793ee14388cae7848566621536c214375d9f042f48d9480afd2a72226a3c9784da04b50b3469f5ccec466b3265ce9576b58ceacf0670b' +
           'a2957f316611050fe3482942693ef94a36b1295ecf90ca669cde8b8de637cd3e53e33786f571b3a9f626ec7a660118cc9dc3a70c2630706cf008dd4bb8de8f41' +
           '1e8035e1c5ebff5d787cfeac8e6543bd1333943412a2bd6291c315b9a573c5c06b7ee226ff52e5b727c0d8765fc22597a92b00c9671706a9b84edfb7c1a613b2' +
           'fb06fb4a12fbf4ae94d58c0c8ba52a0c7d99c3f8c55be9772e83f01736176c19c53259ae7bfd5785d7f41179186393e2beb878b07bc7aa7ffe9a32101daad30f' +
           '6732d4197f4d82c4bf2d473b99341ac4cb7d8c2a2e58a0fc8db1d9ffaab2412003531a97d7a44112c946202cc1df0eccbf45d8f346b5fb65dcbedede90dfc526' +
           '978a7976ca454d53d5e133a30e0ec46a57c9a82ca8dde8c5c8dbb4ef6a806991141404b9db37341fe140ee32135bf085535f0784ee8647b2cd3979d9f2acd95e' +
           'e8046a7202c833f147c26e0a0b96fbfaa48959d9df10de79409c603fa33d6849e15e8073ffa93a628f3c0530bfc9ef3197277d7c8c6dbe5f0a1433a01484a5eb' +
           'a568aca45465f16e9bbf059c0f8ef978c96298973d42e06a436e62ab8734015d1e32b5af8fc9ea54163596d08308298da5559fefab9f1b09dfd91cd99eb42212' +
           'bfa5cf3f3a77fdac4d09e86a2ea4707bed6f3891952795b3ade4179de4079cc80cca9f8fe6d0e3c65bc3b1ddda1d99cda781b35228eb49cee19c206fbc9223d4' +
           'ff3abe0ec7b59a635ade74aca9866bc5e9cb9c881ff5f25e2a13d7047f6e0505cd3a2c7ef1a199590f1156e99f67a02afaaae94065c7fd05886607bf757782af' +
           '96b6f1fb5f7ffb5c4c8d20aa48404a6819a1563734f1a2dffae7a85448970421e5f316909dcaf51c474e65c534110e65a18c4265f202cb5bbf606716cff10113' +
           'e514881d154efb749f7c41833a04fe72f1803c02df48a804da51a7dd8aee0512a1d8c9c5f83e7797f756b802162ddad2ded2a9bba9e50372b75e12b0bfcb0117' +
           '69f45eeaf117f3158ad38edf5c16937dde32640b5513524a6e1a83ea843e91980d4e78daecb97df321229726d4c298932f43412598da77fdaabbac9e877a87fe' +
           '498dd252b58f7a4410e3eeb3a5cead9c25c32dd99ce4dbe9b26341c9de77786b94243278c98c776a651c6064536f31f440f3850c0f10358d0b4274d786a8bfa5' +
           '6296749916337e96e3a78ea3e9e1af3a7e65662e86fdc12acd584ff6e88df771cc570598429e5ec0c93d1ac6747490e8e06d2081f7cfba28bb69126ceb4aaaa0' +
           '7ad2678b737e0ead373cc9fa1ca5ecf1c2e8151edd750349ab03eef5efe1814925704cc8b14225261d7a4048430928f4aa490e4f06c68aafd5d09e4dcf2a6d39' +
           '213b6fb513934bb9823ca9dc58e7fe743bda88c8217e68a4b4a54462517ef7cbcb2be93cd708c279addc5eeecdb5ea8756763c1c39ecaf3c3d963fdc6c30b4ab' +
           '2e67b17760616280ea31ae8ceac0ead3119fe932844c921a51751b61c6800baa1a20686ce5ff00ae1c472b3c782f802a9e80357eb1fd8986244890f1b0257ed0' +
           '064e45f0b76513f5ebf4a509bc149214bb9615744312333761e1c3f477e8afbaf2aa30b49d10c058d0355fe0733a3b061469bd85e9e4eb4bf36b9a2fed5ed708' +
           '5a44a40f0eea7e569f0061e6628c9b1ad142afb477abba94f1af7fc1e9b24e023c809c776bdb8917686f9fe26c9e0e19b06e65b24ff537fdd2b16246e5ffe6d6' +
           '18167bbd00a3eb5332a1e5df01ab0539a1765f660d1e8d3446dcee822557dc73f32028ebacca0fc3c3b0b50e22d673dd7b351a2c3dbd63bf99b52055d7943ba1' +
           'af296812a14750882ac1a14e63bc81f43b3c627bd4167a0fab29bf256a637c982968e6a8a15487c1c68aa53ecdf002e019cfb4300ce290f9734ee85069e3264c' +
           '69c2d6b51a4274121955d613370aa0cb6a2cdc07299d063c3ee7e125d89e31ded914224dea576dac8a2b8893256a9cfe2d7209178a1b0d231dc46e4d5ffb43fa' +
           '4fe7fcecd99ef43d5d7998c663062a7ee47064800251c9fd366dbc0c079157fb1fe2fa0d8265ef1036ebb8a3f4dcf3a832712733c86fa42d06d5d6e3166f149a' +
           '5c561450cdbdacb4362de6a9421795e89f387772b2a21a5f5fdfb79b6078480cba2f0254bbc6deb51557720d9ab927d335c6fecf03026e7375cac8b630cebe2f' +
           'cf661024f0ba38911dd1a6a54aa2fe7b58b4a1f630c8db2f9af580f35603b90d6ecc81368fbc136c42d79097ac94aaf2f3085d14e33a71b28e2ebb25105b0fbe' +
           '2443e09ab28e5fbf5b4cdcbdaf1f83a37883d06bb4c39162b323603cc6713ad8d4daf39d07f794d0f296a8f31284f68e7da39b8b04dd83c94f51f421367944f5' +
           '530bd4d318e8003282fed6597d9f07ec01247baba2d9f978b65d1015cff8ec7f7e263db1078b161477f2819ceef328d070ee35e48878ab391f9afd2e7657918c' +
           '6f2f2c13f3d301e61dc8bc2671e9b874fd513a4f7a3587dc3d008c1296614f9e3731ed5738254a91a8115a204647b448550c749e7709205945f76b61421316f8' +
           '3fe33df96b311a7011ea1ff5a2fa11e1c1c2ec5e1e344db1b2f74caad4578e96cf2d70233c324fbf90268d4764a2bb5ffc22e8647f638303b3509c238b2054f2' +
           'bfd00fad550a083185a741d38eab9c453dc0599d8acbfd57687ad22ad8f9aa8c4afdc682f87338f71c7441ebc9349edc98b44093a97901b5cf007c2a7b0b7f4f' +
           '400e0ffb6f915913c9904caff484c64ad0537249fcbf2175028f1472a47e3b32503d98af7470e0eb6c2ada1b8e84a8069ce3fb1d0b72d0822e74bc4cfec47cc0' +
           '85a9864f8f3d9ad15ee8e5bd1372a81543aa1c6da42f192d0590fa61bbbfe4aa5b2544dd6d822693bdf6a1ee27d629758254d8853cba10c03ffca3ec43f2c6b4' +
           '0f84b8e4ba6dca59b589697a2371401d13ddc6529d75f09ea2f8771076f706bd1018a2b990118e8003a1d95bd0b504594cee2dee4e2a77c9567d198a6f481ea4' +
           '2de1c9320a15016c07a1fe0f68a2c6d094f1f35ab2367a228f123d26c18e3691a99b4253a27d8d5524a9563e6abbbb4b485b599774a8941018684833b907bc32' +
           'ab5f0bd705dd190aa542dc63ed4c1a9a27a701d5e182d6a023f90df289f710292fe05be10ae549a91319e901c703e2408d768deec1bf960069bde1db928208f8' +
           'e5d95c84e736d057cb5df4ae5864bbe3c06a8d656e221be85b63c4a27268b49ee3df8fd1f27d9940144c80623f158ace60e29d94599a6df2fea99e03d8f756c5' +
           '6759b5ed796115d6b91404e875e9b09c2b13601530cf917b499e85c9e737b7f0cb6efd57b9b5572b75338699b171825546402e727b65ab43883773c8e6e8d784' +
           '9ef82351cbd18ad9e508814c2858a051cbe94cf1eb9ddf988bb12ac43207222138923f2df69499a3281664a28659d3c75d64aa1cd4c00e54ebd6c9fbafdd9fba' +
           '6de6459d1d344b069a9e6455a1107d610c6fdacc63a18a386233cdb88d43260cdbaf19396b15c8a632f7801f9a965ba3558ec45d974fd644cb2db554ce29a5fa' +
           'b44f4bdfb7bb34fb387df55e815a6a47e27922e802b867d6e4af0aa9dd67854924e3091d211eccddd3e50bc167836fc6ddcd37a34448858dab334b9ba59c2632' +
           '403e09c37aaec362a87f3c245cd2eac912243167fa6f38632660b137da7839cd823075b19cca30accb16a79fa6847997dffdbe991ec9cef8fc072ba17d6b4814' +
           '6e7f635620f3c7c9f1534d3161cf5d1ecd4baacf1cc91112f8e69a39317310103820da9015a192a8bce2ca92118903f65d88ad7cabe8cebb68b57c30af1e5255' +
           '2c41f4e70d5267fd839952f9113ffcf235f8d34e7e3995c8d7e6bc9e9a94734c30b53fdf2fd09b5ef47e0a4cab9cfe0ca3ea42e3a7b69dbcea1b439cfa7da3fe' +
           'c6989c27873e0314d23d0028e64d45d60d7631f2520b797c1fe64d2ec11cc0af6c6b189d8c915e950d8c8d6a506ab525a7188a087278e29b53888c6447eb4611' +
           '407b3974e88c8dff31174f8e88b31387abb834f4ea878768c4acec4bc66d5d09591146cd13c3e362a9454cacfbfd0fbcf0fd57a7015e56ac2697da3b239fbfdf' +
           '74abb5e94cc340bd1c331b1e2c0ae7b3e1407958f83a4328b382c181a8da472ab72142977ba9163e2731671fa56b5abfad811c39ba4849130dd7802cfa0dd5ae' +
           'fb736153b742138f0002a38035829fc436f8a97269d930ce05c4fc3a2b6ddb05b170dc33724a5a20b1e77560fd4a7c2446b06cda4025e40165557f1994723bbf' +
           '45c20aa2e49db05c335ce92a02f5d4f75edcf7843665fa2b92d871cd13a56768ea215dd390c963a553e6922eec70b4d1670fcad48fb0a54207f9e6c5a1b27b72' +
           'f519b52a2d7b67ccf54c231ec2e58663647757ebbc34d6cdee3e9efe097823096abf22d2d2260af5905f0f853c4ed2fd8f16f1f1fa19b90c513127168aa598f8' +
           '9f7fdd862032cd68cf251e2b1f81e95e015d10663009f9a4e2b5da41e4b79b3690a5bff54b946eb42834c0d92e2c2a47a1385bc23ae74193b352d8a939e3142f' +
           'f4072feb2fcec6fbfd8480bdefb3f67672956ac7f44169a583db50c56f39f599e123bff4c317e92e4ee93f51167b0325edde2107a2ea3287e5d86f3a6c316670' +
           '464b1700e4aa84ad653ec949db1e802198aace12b13b7b66b5b03dac01fa2be755f411adfd10062378baf4da5782107256d5a1cc9ead0d7b99e855ba8b7704d8' +
           '871f81ed8af61d78e3ad8e75d191e5f5187c5914760250e70b0d65c15cd0a230e1ec72b3b2a0d9103620df084c8789323ee15f6691710d282f17bf2e708d902a' +
           'a3a440828fb36c4e02102bed879c1dad3a4d6e8df7818362a32dc7a483c1d855b788f270b0f443f260e58a739ed6fb6a6bddd8c167512b2c570940d2ee95cd25' +
           '16207d2251d3af140efbbd612d86e37ad864e8eb451fcbac4bcbbc2db5efaaaa9a709b18763381758ec9379ef8e7ec4f1a16b9c446b7cd648eceec3c273f84a9' +
           'f10833643f16f6ffb722e9e17c5f6727eba4db6883bbd867b591c8e8c950d1000ba5ea3ee2a2b5e983a03ef4731d3a6fa11eaec1f5e98e84dde6ef42aed02e13' +
           'a12a0d497b52ca4d6b21388995f6e2489f6fef3cd68181892dc1d1c374c9203229d0c259860b017042aff0ba71b912292cbfd4393ebb88adb1e31b32e0518907' +
           'e779c629521bb57969ff7ff8533ef3e3d6fd8c60d59778211d3507a69c746ec532bbde16747353ef51b2b889a298a80dca8f60b5fcaf595a58cf2baaa8531720' +
           '96dd04c32296021e097515fafacb3c5a4e87103cd3385946896098753f1d9717487d693d4fd66b3d85e7dd5ed4fd70d2adcd50d2b3328642ac0853ebfe0eb79c' +
           'f3428ecc045d345ab64730847b02638e035462b983f549dd8ecc482af6fe4a021184e609a066a5e277ba35474458157f554daf75148fc6565444deb210c1db5f' +
           'ac9b123d4a9ab0cf501c9eab5beadbf194f76ff971058f7ded7f86820f255d1e982dc9bf943f741df07320bef6a3065509d2aa8362824e144caaf11990e26d59' +
           '679a46f1b5f52d70b4548ac066d16dbcd66eb8cc6390529a470fccc46bbbf52c645dedc7bae3e5e0f8565310fe4cdd216a945eecc52cd34c851443dea5dcd6c7' +
           '76d3fdf4633936fbf52b3dafb426bba5d9e0aeeea67c5d71487cd14f5f8a126200f7e2cf01f423ebef3c9369bb3b0c0590ca4458f8c468de4d8fa0ea9b9df10f' +
           '5a14d0469a5748e1c6219b74b64ed10162f0647d1640debe643185b5b659bd1b6d3fa926e0bba2a0f7ef19057a747c78967e6b1df0bed6d1e3e032ec932a42ee' +
           '01abfb66f2fd8a56180f17ec0c701daa2ba96195522a3b22b883e8ec35e8e60ddd22a55b9045749c8bbb2c8ca8d39f800ebe8c19691ff83e15118fe1363f4e88' +
           '2743295c49dfcf94659ee800f7d033bbe7167bafb0bd1d18862e4b67f0239ec3b4069e158b801fc1f0cd130ff0cacd161811b35183522f8c6ed9c113e550415b' +
           '613f89f8814cc8dcb56620d596a51268c76bbeebb1dabe8a43d57bbc660e905e849d780bd8279c713a2b7c3da9ea3fe3ecc591d7da85c9d2631007946fd49650' +
           'a3168b268a82ba328d14df13feefc2999d8918bbbc368f0bb5444a0ef7c7a51a9344670a50431a476a8cb0ab15e354ab9906ee4c4d6f6a9f55ebb4f60e52540d' +
           '0ffc1cf4392539143621c82d01dee3a516e87421a90f045ee6dbd81bce396a5d835d2754ccfd880948cbed2aeb4982f1ccd0a32d84b4229ce30c6b0355dbcb3a' +
           '8388dfb44eaaa054485e6d8105ff9f0e1a494b94618805b6cb3f407776bb7355e8dcb30cc2a7a3343e80503876b5fc3474692f47a24f5fdf89de010465a7fd71' +
           '6cb4851b8f23500ca2e18c988c3179ea92168ff3d9f048c23c94e4998c46301445a788699ace10e66e6a2352deec2213059afaf23eb03e5941fcafe01f69f68e' +
           '7f65f64b45b6efecfb6e1c97dece4e7dfe794b4c7b2bac14da7e7e5293cb76963eb6027e179bc51eeb0c4fdb711fb38012eb9cf80090c57da4babeb2a9605799' +
           'a155dd6a13afebc629b52d012b2496a507d97c0459adce5fa56f9d0f448b428248cd30135cb3f02307787202a14dd8dfd9a2879f8c154e93f6c15b378307c666' +
           '9f16aad1c84cc6dd713a00586fca9ab510cbc95ee061426782c13acb9c8b1384ace445b42089d330c243ba766a4156f0ac2021443ee1dd3844c7612b9d5e186a' +
           'e74c80917244c8caf72a7300c92294f4c1e7f59b46bfd64ee1ad6b8b7a690acab23c35bef252bfb1158cfcaaa048aed4da8a08f732a4776d19ae682da1c74955' +
           '167ac700835e3a4555d03028f90df6032af8006090f90809f168a61149acac4619171bad470832939997e8f9d340c028d587f69f4298933d92461a05905804be' +
           '59e4b74eda1e70fd0e6a06bda3a6ed1dcee9f8d0a85673ad5689e4063fdf8f251f5231f48e27d98298ec02cf1e0a5d4feb4d0a49237a53638a45b93c24c7592d' +
           'd5c5dcea3fd111363818ecded4b8888937ec669b27f1e940486670bbc6ae13ac5c0990e72a1dec3118f24fa7e557e2e26045fa7796fbfc0d8c6b21023bea425b' +
           'a056a5c57dbdd8d21bd11d077053c6da50a5ec374bb173e916830cfb486f1018ea921b7ef79a224464ad699816728f30aa5fd5cf9ad1cd7ef2bc8629a5976c2b' +
           '20564c6ee2356a30920e45027cf544923c19a0cb3008c9ef779dd84bb4aedf1b6b986dde39b5fcb340cf809c56c6f2d8fb0a94087e14ba8246f3db64dc55d53c' +
           '47c1c0dc20a9c7bfc9c9cbdff786ae405b053aa2b59ff7f733d1e6c505d096a7a4c188eb39b79181d84f7e901d0da172a9961e2067cd3bdfd5a734a7d92e26b6' +
           '959e11dd5d73368a91aa2819e60a943e69d63a7e7ae52f3a50bcca1c539a06313cc259e8d5690560b7b795e01f1e82746a9063574edd3adc4a03de837ff1310a' +
           '021a06fa7913bd0f1c8652ec394a416fddef19ec50da912e9cd117a4e9a2460926325ac292806a677d73ddc3c09f7c6466db3fa0384ba9c70da27256937bde48' +
           'd775af7cda8a3951f3bd816c5b0a151aa10c6d1678296d352b3edabf7269bba4bb6a1886f547294dd038c49fca11b2cb8df15a4e28fe5a3399dc4d0bfb73e1c5' +
           'c5cdc765be9776562fa2ca2586479db90e5e05b4258173e47b8d27b0d33c2ab10140fb4170744f080f5fdde96ec8d93b2ea0f8444034378b702c7b292505f38e' +
           '2a9204e14986392eaed5d0bcdb03283554610112f2903036613f200b75b5b419718d2c2f93c5d5bc94eab758c48ac597b27b6ce482422adf7d75c061bbcf4e99' +
           'ce42102e1717ac62690c233b83bd6ccf2233a4ddbe1cb449ea56c3b7bde2aa1c32f79a5414acdadd2284f555f0a077aa362bf9ab7768bda60f9a949198e61f97' +
           'c3f9df1d156844d285b057267bd7385776dc941cb806cfbf027620730d350c03c1640fc7fc0861c121a6366b7807605d2085508db514eae4f186ce1f62d25851' +
           'c1cf1baa8ca78f78b1183137ecf05c1fb4bde8df5fae83974bb9db3e123c6e457e5b3f516a3a9ae5ad9a38335c6c24ef031ebe5da35f6438ea2d4fceff90860d' +
           '6762429225eae5e26ed0c8f4bae1d659b9ba16b319dd424fa4344d54ab8227ffdb790db6bccc8982c385fb7ee454747a362347fd609e45c2f759e1a7fb3749cd' +
           '59428baf768da799508eab22cafaca1d2a2d58e549deeb63d80c8ff6411bf4f15604db7cf354e7a0499b2cfbff0510f5d0b69b196cec1df860086c8408582841' +
           '9334363a2db2bd0ed3184e12cf8a853291e59ae1b63d13573dce63b96c6d2af76483d67d8b06a42152a6dd05eafa9d7f6325c822b607a3543e966d6a88b0bd28' +
           'aa187b08c86508204259b65f39380ab03f2cc6d64731fcd77a2953affc01e0cade4438462d688278e1524625aa0cf94be76efd6f8d1116f1438be842a8ce731d' +
           'c8278c1b9672c1bfb8065f850a231594bbcd5331e6678c5fb3ed35272de5a6eff35dfe93056e328f46536c61205b7d0f506850d0949adac530e1415c64336d57' +
           '9a60d9d7a80750c234a8ec1c795a439e87e4d61d5c80cdf2024f25fa95486b6db3242f64a488f41839475324085313bdb7bcba4f4cbb7772b3c29711bd5791e8' +
           '1eadf84ea81f07967781268d8bb91ea6cb4ba42eeecd991d3a2eff5c09ae33f7eb009250291b5a7879402c437ace01a9d706e88859c098f3d9285e950cccda33' +
           '5a55e01f941325899e3b33cdcb19903e9762d166c022f41db86075d37d51699271ceb7ad31fb3f76aac4ad538b67840545ea538e9a973cd9d136ab3335975d4c' +
           'd2ee89fcf7e8dcfee8296d5c020f5cb155b76cd60bfebe885e7eaee0ab870c53f2962fe0c049cdec0aeec8a00d7f5f7f4155e9bc64f78eb3cfaecfa44b02753c' +
           '92ac4b9140247f2589937b5090341ee0cafc3c6655406a84c0aec9ba018fe8d6a7beca7fd454fe433f2434d1c25b795bfb2d5ad2744d61d7dc035f5060f0f405' +
           'd37442ab9c2352dc342901faab1b2f7725551378e455407ff4d30d7c29a0022002d717ffe0945a9761f71f7494e44b02262328ba5afc67b3ad4d797570b79427' +
           'a8715f98491d1b76bfe97a5b16f2137e5d7925acb7e137009231babe1a6e0adba804ba9a422d36dd59bbc022502a8821ffbddcf107dbad106b8b68bbb57a3f7e' +
           '4254920f45c2802b5f76b6211d3515650b64e80f427e6df5b5369ecb8ba6e4bb97f8d09d9541cbcb9cc05c7c8dba37199204378e163b894f11fb2fb4a62c6b6e' +
           '521416e6ad1d01c98cffb63131a758211f8bc1a5ded50125a148aedd1212576880f86fc109c3cf525c692f491efaf2c489b9c95da598f9105b9f3fd897d4e260' +
           '6164905df1780f02891987675a7059219a37275b471afa4fa412b9df90190233a5b5b1055fd4b53983bccde2772ebd01ec001ddf6d293d13f0ff12ef8de82591' +
           'ce14698bf0d5960ceeb89c85e6bd685a1f97d0ef896a8133fc31815c9891ff503c9128caf65a07de34c868bbc15fb9636a3ba3e3741957868becb54f56fed034' +
           '90907a98b69a41181e3752b08aa70c69feb66c58450f76b402060b38316c63f0079261f8ef5baf38107615d5fd7f2efc836f25b9c53683e22f54c99e3d5430ec' +
           '6e0a0d702e3e2710556d9649b3479c63a67a5003e257371e09c7baeb20394a79a6b37703f471983a71bed143628edcc75811cabdca03699853532a8c407f8bd6' +
           '75928b0973ced3e754d45504a9b7bb5dee0942dac47b0446deb55fe009ecf74a7d99ae40f0b0d8009007fd248cb216081dd0f04e8517af00b555ab09c8cf51df' +
           '0334fa1959ad85773df468441b8f7ed7faacd2bb0c7644f98d10fd1f6c734922c8298a26fb1d6696aaf04f867a37b8fb4954af809d110f89b682877151ae5596' +
           'd2e5a02cd09be323b5fcfc46a2a993823de286bab5f87eb985e9474571db3e6988daafb58b800d9071dbca28169ebb682027bd90ee8e9af3753112aead9fb794' +
           '1110ecf1c6cf2beceff6296b3357fc2433d2d972eac34d872c98460525101502916fe7d14517c4680cd8e79a480d30024a2097261543663c8c5b2289791df185' +
           '59579cf18812ec1723e160c238bc262d97ac68c47889ec054e6b8780b21442e2671d70c179db538d967a6d3f44421450a5420a65d9290b9a6023b60f1f6466a0' +
           'a7344a947455da8be792f6e541474e7e53596ec047b7fe4c2ec9b782b5e27aeb4150216561236fa082287f71606c8af845984bc70af75485698662cb1f80dbc1' +
           '3f2eb335783f39c2ccb3e807442caa6da83f6a227989eca085f0a96abf772a9ba46d9e37e2a6ca6400d1e455c3ff6c3c169bb2247edb9bd681a28ed8ba1b282b' +
           '1ba6ad0d0f95c0ab11c75287492a3c42f229c730fa1f0966e67196d224a841bf36ccdfecbe0fef2e9d4386541b00a853145a6743b9d33f05fa5720b007f26729' +
           '0fd37c36fcff25476244f640a93445f450ec7e84a106599e57c8650538a22e141be067a9dcc75e4199782bf3cf1290554e24396c4580f56d49b069647ee97e56' +
           '9e34047e9571e0863d6e8190362a72ac69f740fb78e70e7bef845c2023e3a55a49cb3881ddebd93480edfbf6ebe9c59e541a7f677f4bd1d84defa3cc1987ec12' +
           '8c367eb9c74235131c4bb3c6ce7f27759cd095137efde37fa670104785ce47c3abf0263b0b50b81805c34cb6384699621bb5540217cca4181bb4f4f26a94200f' +
           'b2ed735ba4fafc875a0b5d02f7d9c0d55ed8a02fb84bcddfc88875d0c53be72f77d8ffec8461ff095625547ea5da79f3b8d526d1c758c942e6d6113c17df05d1' +
           '4ce17a867965f5fe38380ddd44c11d573000f5ebc7b26554fece0ce7352556fa26594aaa7c58536a19d5b516bb4cf804b0f6f703d2b27f30fbaa94198be1d61c' +
           'c40cc8720c255d83443be3b58a747eb2bcacbf9c48b2703b5734cacfe40745535913e765611720b08fabb5e9309b1b7a1ad65fd220f88c8475b266c6ad71b2d1' +
           'b557e710a2338a2a6a02edcd17831f86fab9c09c4c078a96854c92a82fd82926d9ea3a4b10b361185b06a14311413f2ac4fec7fbea5fec0ccf4164284074851b' +
           '5413ecaded6c14d10765b3e59261f91e3eb6e04c82afa0ee65b8ebdca3f2641fa05900f545aad78de2986e2bf16abb5c2ddeaeb697d407b56afb0ea8b95d5a97' +
           'd3acb1b8aa5d21eb2c444472128b2dd6dc23dcd5a2ccb96866685e8431cc44421a9889267f2b2ccd1c05e8bb33e0767858813943e37fe7a1178331ccb3601bab' +
           'c7b3af11b3bd956fef70c8965899310348735f0d3e2e2499307fce384d878e926f1e0805bb320410f70dfbe76b3ba4591da331f80e94a30950c7d0e1f0f68d71' +
           'be06e8cc43ac4a1d71c5b1bce05bc4616bf6ec4acfc16d72018d0cb548c4adb9a1efae66116892231b7f2f9e021e0fbaf25f7b86603447588c7243f84f195b69' +
           '5647c64c066d78446018e63ba66fa926d3c57f31979010d8b400539bf3dd33d5b0c2c77b05385c6a188a8eac4a1be594b7991cacd1363254c3feb99194a3859f' +
           'ddd2d11a8f6ec42c0d21eeff3c6afc888b2dac3cf3d8854ca19c787204761ffe953068a16df45d8d3e2c270eb581d2161f70171c048c6b383d4dff96edce5c43' +
           '1ac939cb6c42d2cb733ee31616920f4ef4fca5046a73379db0e0f7f6d49f55c87216145f1d6f90c2530effa7db26e928105e23380751d5d58d1dbee3377bf1a2' +
           'fd2afee9d528736ed297c99365aa31ff471e8b1bcbba257395e6f7ed6301158f4474b0f474c79172dc263326e127e6651df83f406cad97d0b4ae21092589fcee' +
           'add040101a6834973c2f3d4e8ab8a66b01e03b9c247ca9d7ed4e2e3d2d1624e9efb1b0c8cbc823e30ce1f8c4a833d94028282b30888ef20018008f0f215fdec7' +
           '9e0a81320907306edb3477be54feb1bd6113fe285843059c31732dfa75a6457c0c5c67cb4b33b3761d0724dd3ae55a18b635657f21cabc999ae787eb1781e995' +
           'a35aba1aa8e8715370c3f809296673f8c967c482b6b7a05d8e34e7e75d0cee39c984647fbda38040dcebad9f952664e4d51153f4799b6ff7ffbfc710fff9a648' +
           'ad13218c2ff24209851a5e438a737355946bdf577919c847d0d98672859ed1821ea9d528073589dc0a5f823882be3ce9f29f6adaefaf44a52854c6bccd99657a' +
           'b62fbd5bd80a632f50142c7ab35ff38bdbbc7d30620646227491d7de86195d58c68d8c983cf40ce52b4a7b1b8ee2b2ee5653b18ea4797bc7e1d7ac4795982330' +
           '726a84872cf22a712a5bc888d078745636f4261e8fa4a78dbf474103fc28e9b12bdb7e0f36501cb0673cd3ef778368f231f2b38d6b1800989a1ab2fe013f6630' +
           '5ad93ef64078adf7c508342a4b60bfeb6249d100e5030c051734d07d8bd4d1975fc6bdb9b012ee44b65162e8b966e54338f5eaa448831a1e806bdacc9bc0b0d0' +
           '0e3e675ad5b3ec6de007997fceabe8b5a6389e89d5aa2ad23bf7efea8121c5c3848fe2bedfb9abc3fe7418b439b2e44975a08dbd680095381c2466159488b089' +
           '69489ccbbd680937e53fb2d27ffe202ff5775ade1779efbb81e8f1cfb3ec7337e49ed20a4b21fe2b4d74052be895abb1c26e784f5a8d9f42e535406ff7262240' +
           'b3996e5253909608329fa822f1104911e10eccdcd554548110f8391765002d36a58cbbbf8b327c0df832543ee4ab14922d915e148a70b8192ce1685daa107605' +
           '398cb13b0cbdde5112cdc743362870e74298590249edd1dada8b869539e3fcc9c206d0832eb95fccf1482d495d657fdef71e84cce2047d8d6f98b3c34e1c9cfd' +
           '755f4617a1ff8765681a3d6be1949987964ddb14052dbbc2e2f71c8bb6b2d5d60d60ee7d0386d1472ae8756944d045f4fa96fe78e95a0232e454e9c2a9116aae' +
           'a21d438423b2e650de0911c9dba0a390a8dd83735ddc26bdb26b2f59a58abb683bc9abe3a8135e0e9eff55528f7717d44a062a3d2ee6c24eb94cc181d66e71d6' +
           'abd48e9347fd5d3d8523cec601d1106cb0bb16a13e885eb608f6936930fa2059b6aabd5c5c0d8b50ca6aba8bfd142da8a17a47681fac34f10000000000000000' +
           '0000000000000000000000000000000020eff918d5a1687555b83fefd9e8a2a5712d0db7b0348d001d33f761a594e3274d0913743e3cddde9a090000'
    },
    {
      set: 'FAEST-EM-256f',
      file: 'faest_em_256f/PQCsignKAT_64.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8ff6667c05051dee8874abb448bd1a066bfc25d2d8ad816be26cbfda4b238b761c',
      sk: '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      sig: 'c1e8722a6716340711fa1ab60ffe5cbd5762ecf2a928283e79fb635112c2ac05d86c5f67e13ab305a6e91a46fc14b51422ec8fd2ef57f9edba1b3532e8dad44a' +
           'd66d2443a4c0dad03e8a2c3a77fc7e89ae2926e2ea6eab4338afae0d7d774f92208e589d1cb42705b4d94420a2483b71310fc2214497b9166007c580af3077cf' +
           'bdaaa86403628d24c47cbb05b61445f997919b6e14eaf997ab52a522b94e21b2e758ae9a438581b5fb82f6ebbfaa95fe5b4f580c4b3c03be875de568e421b7b5' +
           '3f9851c7d304a472cd9bf37c45f52f44004663e1b018e1070b8c107fb7a6cf1a5cdd46542b9174ad2759d23dc73f9e57ee290725b51e2e44bbb574068a5f4633' +
           '8e89a9de2c2d1479a3d96817a375ebabe9e2bedd550ae305f8b8c943f5030c5413bd02977d6071336a43aaf23cea1b5c4c5ab6ec4462ba896f68978351af9ed2' +
           'ef3f36b4b0656f8842b40d87016262d9856489be35f82f74abe9aaf07b34ffedbd64ff849f8d9f3615f42669a37807ec55dde80bf104fc15447fbfd9b5b88ba8' +
           '34453bf8f9f32bd0d56074ce5d58e1c8d2c9822b37665eb534c715576b6d621328d161e879567adde913165c439ce340973ce1b2c1f81deb2d67eb817aef0064' +
           '60c64b6b7c4de4492a5adccb19e5efd8560ebd764c7033c233628e6c7822d87e9b67962b992c5e0f88d80fb191a171a3ec1999e5996827286b652e767358f937' +
           'b146929e06dda30b9ac7d596f613ba955ee5b2289a6eb3feceb704b0212de4dfc72c7fd83a72f50a74658e607f2a20c7cc919f125813e74c4f13a9cf3ed7cdfa' +
           '339110731f3c45f5a9be99611527d57b930147086daa88ce32c8fecd44e9488c0bb36f4029f0291af5a1ce5629991d24166d91ee7918ac5c9abf5a189bda8188' +
           'ca08707be78eb1731a2449970ab2329fa7d77750911c4399b3e9e274308492b75dcf63d03ee6eddd11a8ffa5d2e3804eccf141031a562ce76dbd01db43afe776' +
           'cdb08f3a227da8e325029ff596c1a0656246115f525f68ec677fa61638fd01fb2959470122d1b822313a55ef29a4e9d0a5ee818f55cfd03602c8ef98ebb0904c' +
           '8aa07249f09e89e3fc6a2aac95230369ab5e444efb5ea2199e22407644e838a1a68622db63c0ef9a532bc912338904826310d37bb1f59e481391482460e29305' +
           '1a77b2f707a8d337530bc85b0f28551ffac3d699f56d8229856dc8521a5d3e8c398b084da1ff05565bb8a0c50b6242876bb8197d83c1118a84fd1e6fb205546f' +
           '124acbce9f376521d92502262c5521bb53fd84e8274ac0eafebd86e7fd6ff29e8400b2ee13fff8320a86bbb149885e5db35762dbae12caab592445bcb00a28e1' +
           'e850c5b3d1f34055139d140971d14f96265f57b21349da36e1856d21c2c0ba204076372dd33ceee8f65191313c7e47b10223a38beba331b0d128fa49e735a5f8' +
           '41d1ed1965622beb7fb0e24d88eef32f9afd02af683fa14e6a182da1c0828399224ab47b0eb186c9615db07901654b96f09fdccf4a6690e4070bffc3e0adbe14' +
           '6a3de11e163afcee63a1ecbecc12fefa169a944c2327085df9939eef484164ba23125b945af363193cfe31888b215e8eb0862c75db4d96b7605083cf5c118d86' +
           '25cd4cfb400f524158887a4184788db3a4e5c88517a4896e18dc1bfcac469f12834ee80915284d1f93b676d7685a06461acb9b781862b9a574b0e3a1262755ca' +
           '9d2018a261c93c26c1263cd9460dbfe7f0a39f901b254328209deaab280557eededbc21f65cf055fa4c5097fb530b4900cb0834640bc1e650012185fc3599c60' +
           'd063f36156662474fb7d02cbea7beed45837f9e701cc92c39c8adac384ae10f9d1a66d367e3163a876758c0b79e9f92d67c9e5f09e3647940dd03f4dcfdb28a2' +
           'aee14efe1351e067679ab09c91cc12ca64e11aa230479a787fb563c451405e60e601270941eaddf69addfafd38cc8d5f5076d1b9cb7f5bd1856e577080c91029' +
           '653988d8acf55bc7715b4d85568aae6d913d42f2606a02485bcb79ec335dc666cf4a9314d46dd3bc92ed1bdfeab0f53f9a47f664792a53f6f521e1b87ccb5242' +
           'c74b80f3364cb73aa0cf348cf344f784a8987462957041755b1272dffd00fc7cc3be2df7ce3a1fabcffaf2fe9de8f6ea211ab2e98c4856951f675480c432c15e' +
           'c00441f3c0734c59e4c65618939228a64f5a9593d33b6d7a57146af1229e55218a5aff89e98b71e24aaaeddcd088bf823c6382f00031cb3fb4cf60a5ef9670b2' +
           '4979a0961445195db74199757107a13c07291fbd6ee01f6e94d1def33dd3cd652313cec0a5f159715311bf1a253d9cad4010ff55c9058c335817f45d4ce84fc6' +
           '7dcda51ca70634a44d80b5915c2d9f3e0ccabb29fa01bc916c766b4d3c1333a9237d7473ed5a456867a8e9c208a9cdfed844fd1fb1d5c09069eeb1ddd1c68109' +
           '23dfba9b7a171d2e1531cd16e373f66824767cb8532d8d2eb552cbc96cebbe662cf99275a1a35199d4feb11f45d0b84eaa6827eda9e6e2e646b1f1c1963ba4b5' +
           '07c07e8041acf1966999781ab4246de730b4a1be414e27967e70b2381df060fb3471bd4815cec00a6acac71906dc7af14b31bf04cb91d19f26dabb21cdd22825' +
           'b0836cf69bce7bf3fd8041a9ed69432acfdc097425a91232bbf15e5f8b445df5ed6aeeb7d662b798bb3d94001425fddfb413e2a269f0a3abbefb8e1f0e9cbd69' +
           '29d557005be0844e8fed2eb2993a766691ead6bdb00a76dd96fb074d8408e095c881ce82313098fe447b7382388986e1526a57fa90af48cbd2fed547b2dcffb6' +
           '6a538640c4f70449e1f8e6c85f047541da4220fc8b8d0681ff46ea15540dab362877cf797f52c4fd391abf680e50faeca27f951909c5f6f1442320c476b339a1' +
           '2dd623643d7b6ac41899dd737ad7f9074aa4324d4e91270d05e1a620f46097c15f825bc08d37f17e931ca3432b80d163d4a290a346d35e21689c7b07e2bfb85d' +
           '3c55de40a43a85ab2608ba7faf6e24dfdf6639b7b69af2464d9458d5e980645fd42f53b12db236c0b9b2853dcb89ff94407088e6ab9fef948d6fd00dd2716a65' +
           '3837e778870d9408ce6f11e403da6341a1572c54a19784ba64e6994b07987364b07ca30753e8c03179855f80d7e4b71179768d85a3bc852f7789a33b3cf98111' +
           '89455907633136dcb6948c109e9607ebd280c75a6b3fc499e0210a7c22a414ac349c1b92774cdba9fb34d0e361e3b4198bacd4c47ce2fa33bc6cead18d87e1e7' +
           'e746246ee3aec65c27a1de6a3d8627a6d106489d810320f9dc3d2ca88f15ba873416bfb5eee39ed9e23f3844263385e4511e335fcab100abe5a3c38805cf17f9' +
           'ca9442827d2b9171ce3b3393f280e8ecfd70a055a557ec3c7996de70eae8c9b40e1adeb98c44e0785477799bc4ebcc20be5dfd5fdb542b62d0f8c834d08a43d4' +
           '6ee7926a14e79541d261c23d38435ea2f8eb86c9f74dd4d22e03c3d20f85bb4a1ae5a9d3b5af1fc9f3658282545e3147359eb6578f6a1f97258015eff145dc89' +
           '84bd5b7ee19906c1b4a1c9a7532853d8d0ce2266101d4d7de26e20334f507a1681683762f45aced1809f432f0e88c4ab1e3e5501ff325ab1f320047866d6fbef' +
           'f62dbfe098df24c5926349944c0d12a3155963a8f5f52485b1e52daf7d68a28d5b49616f50af9bf2f7d99cfe4f9cbea4e39c77709b341ff25a86feb565afd343' +
           '1592aa866dc110952bfbad5ed8462f36a9896f2606eae544e995bd71cb356f8cda56875a4ab54c0fecc9a30f11df68ac73d77afb597afd3fb5e3ff9b3492a328' +
           'e9dbb1326e40f6c47edbdc8b22d15ab59694f36925185ed84ffe91b9f07facfa7071c049286c33d222433fd3b31db2d16df3959c765429aa9bd7440db5d3b7d0' +
           '437e6daec1482c971e017112a9a77730264b94d1d6ee56893b6eb7886cad8549b1e7dc045a6e64b3bac5af3c2b8df1901050861b6d5398566661404ae1d994ba' +
           '29cae387c8b6445f8dd7380d23a8a85915dabe27b5a39a26f56d9cb0ca23966775b8d8fe769bf2617f33ab530328b6bc2b5046b1784f49604d52a49e1001e939' +
           '7d533b7c44e1f0ca8991f0c877971b71da65fbffb5a25c78ede9c08376afe28cca84d6ac22ade74b6e3adc309db863ac0f2974ad975c9890572de7b5ec93f8af' +
           'a89e864bfc6901ea843131c3d8243e5d3c5663deded753e8d28b859f876a4b631dae1872888ff811591db98d602d079d9b0fb9301fd1de2888f20e444c532293' +
           '67d7041e42ac06f01bdccea323a58ff2fb3fdb1119ec6fc7318a1121f87e81d10b63aad1bb934c0ca5d11e77d5cc4c7320a6dfa6feafba1ef0855695fc267695' +
           '3530d77fb1b4aa82a3b9eb76ad13accb0932fc002966a45ae628ca33b909b06d6121bee83dd9cba6e9aeebf8a42d695c91619a7d319ce89ac3e837cc7fd31ae7' +
           'a345ef1ed05b0ffe79722f3213d22710f00eeb073118105c52cce6ad493cf08060d06080e2a941a6d64b4edc21b3c95e9084ae06bc4e820775c0441f0d674694' +
           '4573c71bcd3ede88e4b46d6a554d724848085b136d69c20dcc156d4182cbbdacbd85aceb561cecafd77bc0649cd10293c7f9c49a76ab2088602b1b2672d475ee' +
           'd7e51365b996a3d0c915287260a021137de0ec45df86691fbbbf8d1fa53558d8d3bc79cd8d831b6ddc63a60fdc374fc7ed480b723f6088d53e844bca514490a9' +
           '47456819c740450b9c7711efd1a50ca10db58f01d2083b14c61ec71c71d7c3cf047feafacaf3012de8a24b0d1a36ab7375635728c9957a615d9942cd82feaf54' +
           'd7c9c7d11b1e7a829c5d0567c342d01be41e644eba35a682d027c6821f001ea9d730d8f1d7958511ddbc9820a2ac9105cb77c04a7500d46bd4373e81ad0920d9' +
           '0c003afa7cb905ac1ac28065188530060b91690c2c8ce401c13dc60ae0c18796de1d78fe57a1de753f0b837743c6451b58c180c096be83d5a9cf82902135f414' +
           'dcb89044ff1e63ffca21703b20dc8eefb9e05e76594fd13125b69e507add1c59b85cc0df4eaf2069fc31310bd5cc24f482a44256b55b2c3925dbfaedf2c7d1f0' +
           '131493653557f0f670863bc0434bf236b24e0056d8bab95daf8b6780571bea73049a90ad7a0aedbc25f75319b3e574aade5150f74d39a742769df0efa57e517e' +
           'dbbadc351ecaffa1dadc07338f67d4b3c63815d737cc18b49b962d9592bccc4122ef5544d82df729b7005c1ffa69d09e47b77af8b0000c06ca5ca69ba15874c4' +
           'e091e65639c634596fc2bc1dea42fb2e0119893109eeecf4775854f9dfaddb43e5bd527ad672842b2b57cd0d613d09d89f056a93d36a315c9bf03694f43042f3' +
           '82046b6b9bf0b6f461e6a26d6714d6e0b71c1279bdbe2b018061394958804d64c8b1ca1589f3aa0ea3cf956bcb9299da3c4e2c67f75e647df0a2f3e8c00ef425' +
           '37007912378bd2a1ab7a9fa9db3177da3cc6a35c308c2df9c047b317ae6a6e692aebd17c775aeb4d0f659bccea7a45015eb58a207409d289f15bed1ac3955209' +
           '128c5449ce459dd7fa10cf79bab96f632cac583a9d85a56dcd639142c8c5781282065905d1254811350d6d619350d0d06288bdf0b464162fb4bed1aec33caed4' +
           'd7aef8ba2d03168de82b816fb5359ccc079186842c0772d728981eabcade1810d71cc3799911d3d8b26f60c27e7c464cc1a65187d6922159bd3698f5f1c2244d' +
           '1e8f510626244fbfbffeb09888eebbb6c862c557127adc8b0337c7fe50da0034eb7aa58260322a884b1cf98aa6d6e6126799f2da5cebb3850f1b3a663ffbfb90' +
           '22085722c8d410ffb3a49e9aed73e5ee619b5a551377378301d64fdb3b5b260a668202942f65ca936c7dfd3a8393ba881d9baf3e75f3ee88b2f8682625c4874b' +
           '408d53f7f7643b5daa030f1e8c47e8881e99737a9d67efdafed2dc06bede5ba3bbf523637573c1c3011707ab353d5f618a0fe34d0388b0317e2c1d02dc3842f0' +
           '089725c55d9ec6d8d86a112b399ab8c29ddea18370083faa370e2bf4efbc127a1e835256c34bf9a7de5574c6eafd53893b774ca92f7bc9a1ea400f3a160dec6f' +
           '30ba4454e1014f54665ae4a1de576584d00c0d776270d6e8b6ce54291c51f2ad28cb8f79635d2f7b5768614b659dc39039660d44cf678adf2ddb521cd471567b' +
           'ef1c86ce635daa07d366c28bee7e81340d9eb4bff799a1111e60a572e79ee94bd345f0706e0a4611dfc1dab3b0a23047b6ccb217a99f20ae4a80d3ac593845d7' +
           '0b27542c3ffbc19f36c9c71d15f1e3e457c7c9c1d0f125599f40a3664c4f4bbb0e51c5e42d815b006271cdb1ba8b811fb85885b58ef1d78ca80f88c0a6de03b3' +
           '6d1e5ad4196ab80022086fcdf666cb79d5ed25d5af43f5674a008ed837318cb161d9d54cf419ac4427eb92834e94cb7a226d042ba530a25ca30bbabd7743f7d3' +
           '41bf05afe53bac0ec1ee2393671d11e0ae176aeb60a65dab739cef8ba2d3afed5c17700e374b6019d92ca6a585b8502db10f056c3b472bfafaa467e0d35bf9dc' +
           'd0419d31287dcb625950ba1e6a80263f9ff2ae51c953f6dedbdc769f47590630689a8154ecec14c74e203e32e5e08145e6e89376e30a5cb18a18500a5f8384bd' +
           'd165576100f0c587a20df0539bc9b6438ac4345f63d02ea1782fca5857e59363ac04774762cfb22dcb2fb9ed8f90b3f42cc20d8c82b0215bc6f21968172c4747' +
           'e109c5d1303651ebcbd4ed7a004eeb1c15523735de36a91c7d42dc16744449ada45f322e75d6241c09773fdfe9ea6a1862b7979a49557167464a95c2cc3d5274' +
           'f9d665671ff1d5051ad9d823c52e9dd28faa142ef0e018e8baa846fb8735c26afaf31a83802b26b22addf22a0508de2ef3ccd29838601c71ae7874611dd4f01c' +
           'ed34e1cb0305de8f6e1498932db763eea20459fad29f9034026642b2ab746759cc7b0b2f5f44cbefdf13d1c135cba7e5388d8b4ce2d4acb9eefc0c87ad1e0845' +
           'e3cf0f967399da1b8029ebab237305e35624bec7c8905f3790bd01059921e1239b2ae21fcd4e5da1886f2015b06bfb1c43ae524344f1c46468b37bb958899db1' +
           '68c4fa5a94d1292d7c5ab6f2feb796ba45dfd7ca9ad4e3fc443f98694d475d4b24a283582b1445a8ac3b38d7a9e4deb7c8298d4d81de2bedf9eea6aa115bb201' +
           'b745f3b728d0feb6a0b18bd4db62933ffb4591d02a982608a76c69467817e26ec8cfe2f425cbf66434bf7529759ebd8e976ae4d9f563b433d78b3191deb5ac8f' +
           '7830e6626c90986876a6e48aae76b2bc8f4bd752fd5b0bee6ef773b05747955e7f94de945d7ba33d6145d7f8a6cb47ec39dfe4d6ac9fd4b2266aa33db7c647e1' +
           '60c578f47f3379fd6c50af181216238e35583f0ae3ee7ec580c81817f782a308d890c853cb399914a85aacf96e06c04ee7aea48f73da062521d6f09b0ae8e93d' +
           '11c32b095a905078b53c94f98675d8d6c650b7a52eabd1aced8768e397dfb7b001640371fb5aa34221eea1183643801a402788923233216a47f24beafe9976ec' +
           '32737391952f0c121965fecca234e4d765f351be1e0f9634612751dc36c550a5d92f8ab39f865b88f92eba47f01c855608a29fcb7a767cb0d0158792013f0517' +
           'a1b33d4198a2ceae53a1eb73a0fc2ca6ffa5ac08c1c19a53781d7d91b18ed7ee3f3bd0e0f200cb41ebffa39955204e87e2c440d059bdf33cf1bfb561b2720570' +
           '0d7a9a1db74750b1c89b438448a3a10df43a79b1aa62967d6183f1afd4ac1fcd272ed178a495cd5d3cba26f09391812c60f476c5a506a3902197c807ae9f2404' +
           '2ebc8ba8e251f802a4cca1a68e2d1a1fdf27ec83342f278e0603fed45701a209e8f318b4cb8758b60b9d5eeb23756ec28fbc5a188c14d112d61943288778c33f' +
           'f8f848e1ebbb630242f53f5f0862883cf7332764033444ba88497bab45e2afd93fbe780482067e245ac7a4a506f6eb0f0b483bf2174c1a23053d5d80d1bf896d' +
           '1dd1d450f5dffd5608bc20491834a3800fba2fb1e24e06f11a348e83aaf97c61ecb149bf5830a7ed89837e2d124a87708e676104c3a66cf7cf7e4b26b6a28b21' +
           '5225799078bd3b467a57140113bb875701564d1500239f6063934743effce1d87330a6966490c771aa76a29dffd05d25cea5e528c75c21c3114bb2e374387320' +
           'f9f6504d41c038f19387a528dd63fb8464c1c808f52f199a6515967262993e87f0ed2eeb65a67b69514abf6c2aee47d2359979a6032a26981083e0e58e846a87' +
           '45745aed853d168e507190420dac537209b7417fb3ebf5fd314a2dfc77b388c5c373391737cf148b1b3366e7afd11ce729196b68b8818883a32db2cb0efef8ba' +
           '9110c55a1fe75ddf0e055b9f23260b584b81526ce976fe9f6f0a3371baa89e7528131f8216d6a48adf0a63148780a26eb72fd0a412e310b8d52b6a3e5285da3d' +
           '68f24bc3b1927527a2f5795a3319700d7629ae77110aded8392548baf40556c5d5a9a3a256d56e1c29ebe76c884df19bfea772abeb739424440b2467509b2a89' +
           '6ebc11f3ab4f668ef415934ba6e3c1bb8fbf6e673baf55865071dce96507ee50e5adeccbd30f57b9a530c6045476e166471eadcc06c71f6b0ff4215cf3bbc20e' +
           '270fb4f5624e209ca588fcced1202676821e76ccf23af8a95a0fcd91ee2fd656b91b957941a331b2814ef672619ef0dceab54c9193f836780e0ad447555f1d73' +
           'ad4f28e8f1e5eb633b451dafad27d1f89f86be58e8c5ce74398b17d15c19b8fd3b1fadbed7abcec4627a5e5bd8e8c5e0b670d46ef0e2204940c773f73b7e677a' +
           '7dd22bb805d61fa2dc2d3eb63dcdc8ee3ddb34a46be81b9c1b76831fb6a847fe9be9b50aac5bb959561c78f308c4afe1f924ef3f4142b7936c2a9dbad0eae961' +
           'db8502c57b205c4ae1d83efaddf67663b9450faaf18b17cbf81fe6a40dccfae7700326723062482d19dc2cb0f60651aa18abc481c0b4d51527378973663d36d0' +
           'cf6ae1374165d87e6ca342214c563c530d71728cb5bf0ea175c6797486f840d4d419fd61d165144899ab9644ccddfa1aa4bf6cfe708514290074528a9e20141f' +
           'e25695f50cf57b8ef8645f5874892a35fca4bf0b3c57c41dab9202dd2f5b08ec11b7d499b5cbdee4f6df62c4e800b3588fea78724a3993975737ed95f6469fad' +
           '5377562199aa2447f34ce89f6cbf858396ccbb04c0a46176e40605d1baa86b0f46e30209c3942c3190d2d8fa3c13f13c1751b184db3abbe96f2984b32ce2d3fa' +
           '1c064e8f4928389f49a2b86d51f21434bac4029f375454a68240ee23989fa2d7b0ef5fdd28b808adfb28fc43e1f86763a36092441c3ae739eeef1677c965c39c' +
           '4e97bdc7c7a55d0498df68fcad7ac0e633762575ad6a3d7c20747f4fcc989c2f544301501223af11ef55ac893dd4814f31d72573744e1aa7480158a569997894' +
           'dfae3c2adc0f0f52a191d287cda66176a66e5408f9cf5c762a14e0f0f43429dc156254e0dac1d151c3f34caf13aa637c1c3a6cfaad6e92a6aa23ddcee9629769' +
           '1f163973c6d61da4136dc956a83a9347b878ab22bbb5940f4cc36f18c66d8f9c1f79b0fa96cdc7fb5d99bd49e54aedddbcb118db47fc6c4a303d8e8a21ea9632' +
           '77e1a62cecb69336c185bebf06264cf254f36940ede199a57cbfba5d99b16adfc3c806fa41d20ae24bbeee5b353b594fa362d9f63fae25cccad4fc8513d91ad1' +
           'd6be0b1c07b4ba545cd34c1379a9fc51634cb81fff3aee91dd302372d1d1c904c1f3825760ec19b913970a35275e068e3280474ed5816b520391c16be3970d19' +
           'f08e8cdbca69f2b8676d55f31548ae821f41b5b4e5d110bd217b240f98105913524c282de3c5dd85d22a32c93bcc9386cb8f5e90455f0beff1d6d5518c9589c8' +
           '6e437aeb223136d29d1123706954e10152f0ee8c839ea522ff0aea2595b1a832397ec5fd00c4a078b491420fc9f95822f57227665d8205254f09060048358441' +
           'e30801970672d7ef83437fd4017ca03223c5cd343a50fb19b2d784ff3c7a8f9e7eaf21312a9d70a3ea2f1c9f7dd7c09ab61248a5e1bce37abe0bc942ba794d5d' +
           '43716a44bf37313f73111845ba139ab782c2fa6971ad9b27dc2a0dc100e991e71c666ffd24d4571e34a4534804b66d571ed898b40fedf7ca7067ace497a26cfe' +
           '11727753c10b14ca5fe559dabb5238bdd299754ce4e503f4df716d737311e69687bba4eee8feb2660733001618534fcfcea9ea5fc18091ce95827408b12eed25' +
           '06cc0f7599ca9e2981753d828b2fd9d463691b2269c84166ad142fd05fc8c7aa0e12b7b43a69f6976452972980c2bfe4e5afe1e4079c819512e51097de91b6f0' +
           '1c1b01a8106ed90e8a76e770e2d0fbf3217e032df137e96ca699a73729b0a712edb474f9e6c869fee10682dea540c3f311897a3ef9de7a52c1a30782234600cf' +
           '1e1450608cd6cbb21ec6addc53711b0197858c45878b470cc95971dd6d21b5b02ff381ce3dadf7bee04dff7bd9f34bf83a7477208c87f0a52317af05eee24fff' +
           '41325fa96527a8dd5204bd910a188e3f5989e8f125c602e6db7117f4ac4b0adec8fdb31b1e1a6ca7f7be83320edd398eb36ca1f5f8c88ce26e77f115d2470c6d' +
           '9cea634c9fec9ba8b722a625e50f727fe1c7512646a99b6bbddb54e9eb883ea01d317d7429ef72129c42355bf60f2371d15b8002d67170fa3174968d2b8abe7d' +
           'a22f9358fcd9490a44d4f5dad28caeb884e9edd7ed3c5d2638b04d9d67e588c469af2e83688781be4c4062bc49a1ac5b20a181885a8e61e528b539084c33cb28' +
           'cfedc4c7709aa0774c4f25935817c62290070fce91ffe6c35e4e76b8a43054cfa1196787d993a81388d2b0437aa6cf3f5cb1614d070a79ece4cae5967bd34928' +
           '1aca56c9dcc93482a7f6d1fb86588894b34e2b1aa61bdf092c25a6c3afbc33967f2472dd0dbeb39b17d498a337df37272a5821d894f80479fcad137e0850f69f' +
           'afa95dd3af15682aed121e09a5321384807c03d4852433c12d241494fab3427e45b3c7b6ac71eb7ab8d1c0357bd7d75018bd008cea56610906accc15ad5b4a7a' +
           'ac45ecaba0dac44e6e2bdb1a58840bc4ff03e85f07455ae10179637d493f0020c304cebd5adb0fafffa77f926cbcbec6ac95385bdc91b57755ba469379cf359d' +
           'fec48dff527e6510ca046a167eea8cabb2756b628806283235c622f7a23dccddf99bbd8ee331132456b16cbc362f7b123e0c7a6779b45467b8a4b3a48277d4da' +
           '000b5941847e9f2bbd52cda149697f0758d12a6302a6376f952a7a3247099a37cd1f958062b36d86f94ed2ca8ed142f354f2d459eab9d7b2aeb0c44845ca6b88' +
           '58e10ffdfca23cf2cd2a8fb724f9f967ba129de356f6c6d9de4b8c8a41dfe2fecbc2571fed0322fb2fed414b8704e60024a31b62d2fac4c402eef833fc0f15b1' +
           '110e1c488b8317dc270b4b81660fc78f114bc69998f87334f4dc6d744da7e732c44ecf4525e89b0e002f23853bd51d7188d10cc9d6bf98d1b85626e97c6dedb8' +
           'de3fb279f913e5c3d4233d992c49aec08b22cbec7aa2470e172321565204f465f2a2f33a433aa1f4fbd3bed5c5c29a4c271f0318c3dcaa6f9bacf06eafc7fefa' +
           'd4e9038132def23123eb5c0cf74490f6b39b81a3d24341e5c4b3c3aa465b099c2afb095298fe3b1e3fa5962b14d8794e603b2eef205994592f765f64f1bfa757' +
           'bc63b5494f7de304778690ef378b4e1a9d3107acbf807da0fe4c0cd57c1d512febc20e8b685db657aab2248a92f9abb3adcdda492d4d417e44e0c60d4268eb1e' +
           '63d6897fc794b9f34080b2ae2f5120802b8b2ce6fafd88ff46c88e398131c1ffa07a734baf22ea99726e959b2a1bba758002e90a0a89181b8da66cfe79cabf24' +
           '3016e13ba1560a9a9bb8aec75b3266486cec0c500a6451e49b32c8ed197d3eed48fcfffee44965e84a00003d51ea363b0639103bd7850072553a3d6bf5f469ce' +
           '0a6bea905a6bcad569dab9ce45fa4ea8fabbb2fe4b33d0f5336801a5e05f6bca194f9c1bee8ff9844ae8037ea0eb81301d65c8f002ccd7fa80e89d8f9d6cceae' +
           'c972a79abf41544596158354b0d73ca93f5c4489d3697e925ed59909a890398bb05ad6f58a4f258795620e74d790fc2ecc3e47d55a5fc922d6f287e2edbda76e' +
           '477e48474d6dd28708554661fe8dce3a8db058ef21b9f0857ff07dab26a1129f4eb242c3df58e97ca45fa8843f294bf0a304a9516d476c1011562e70d1c1e92a' +
           '6e2c01fbbdb144bbc438ad8dc2e9a79075c755731b956a771423ad6a65501bf070947b1e604f82b5d224bc3f4568df710490a9ad268a1cdbb59752997bdfd148' +
           'e4b0dbda7b9049187557e10a221b863e3b3ee344b699801aa2a0f986e64ca86394ffccf5a5a7dfb44606faaa928a3108efc9561ed9318c3f6beccc31305c7834' +
           '3b13229f157aa6719bb400ee130f4875c3c811fa2422690e3c0dd88d07bed3900d42d8d1b4dd88d4ce3a282fe657071474d8293e7549d4f37a8e6e1628eb703e' +
           '413cbca1ec34d1549c2972edd061e33e8f7fae1cf88e647ac7c4d7e00e71fc4a8fd763884458dc0145b061c0ace058e68c5420ef7ba7e3b303828dc37d3af6d1' +
           '6732277e3d827c28ece4a5348415a701fe55805d218e71aa75291e6ca34fb7b8c1525f705a6c7b8adbf7ec08efe7ac9ed25063307fb1f30301ca1884ad3bfd89' +
           '23b49d4a9fc021fc30872a5a07832ea3d336f3d655a0ff9af42097f19d79a7059898d02a69f05b73deec5316eea62d7489388f300f54280eb34ffd6df1483f86' +
           'daa8fed7e19ebb1a34a19f44e9490a7a06dde856550950dbf0bab4230bc8c9e896597f3b1d01ffb75482ff3503b23c69d06f46be917faecaf377b8b3a4d40db9' +
           'f27e2f4f5c5c09a7a2020be47191978d01314269cb9990896c136f6083ac517dc093550216e60cb71b7a593607386277f49dcba32dc1980eeccd4d44b0a1db15' +
           '797ce6001f682e235e2456c74409372568717c3804a684e30e81406c8faa33d26af1fa9699ed35354de521258d3b57fddefe9e46d90c40b3bee125412da7e54c' +
           '40ac8715c005179ef4e565ec61340f7f29e55af360044c31ec67e11a175b6aa5cb9a19633e49f9ea782f74af544a7463f648a16c7eb68b8c23812dca3bfc78bb' +
           'd51ff8754c1b393631dac7da5614057777f05fce3859e8b333372ed6c2bcc01acb12d22ed27341b34723abf50b5c87c1e0d7a44a0fe241a3061a158106314576' +
           '854281d19686add68a1226e23c79513c633eab0ac0db18496fd918452334bfde179c01d30b2ecd8d3d1b1c850b72ddee4806b18ae14bff99f22c58ddbbd8ace6' +
           '5b9852b5ac17e8082365910c504065d0e2523b70220a8216b1cc00c338b7ddc738bcfb63fe97ee0883dc166b6a96432aa8185c886a4a17b9785dd6e79d54ac87' +
           '47e757c69ff7adfacdf0ac016a6fd33fb8a60d27392fa37cbdfa6c6ae15520083276a7a76458de1a6632dbe9346cf9eaa5ab0ac12bd2b65e0404faca8c494a65' +
           '120eb6dc3f6bece32135170b3f16017f090b751df263c7768f75288740208309fc7dab9bf709c2ae980ab532a885018bc6caed0902625c55e7a8f3c11683a046' +
           '096273e7484b2b9521435d6aa9b828eadc0caa997981fbe0ea1b38551338d106e0ed0b3cda84558acb3d22bc2f170ed4ed017a624dfaffd4ce5eb3323c9923f3' +
           '4362a1f0bf6f78985dae95aa1fce5cffc6048a0b575799d54b11b18623f486559618df9176db7b2ef757030d18aa6a4eabb277823c7565403356656db0d416ab' +
           '9c88e3fa22f19b33f8303572b8e8ef01221c3fae042c11ae7764093c9b32979a654e1cd70adc13751097f43f37afd2bfa39e2375e71dde925ab04d7871d825d9' +
           'e1fc069b648867554e8905b39d7c4576f9760622232912f3a56637cdc26f52e7dd3793b24225447073d99df2abd83dfb010060f6d196d904e815966d4b0469eb' +
           '3020e4e764c1b078fa5657655c90b01438e16c8de8f5ea97dec2b8d4bfe72338ec59768fe0cbf1d673e9cdd83cadb3ff7a8803bac0f68604422e89d6548691fc' +
           '6d239fa154a670a2aa2951b3fc0713f035821c5b13c593a0f51969a0f7287517f4f244c7857b5c322b7b3c9ac08a7ddcbcde9c93e68aeedbc6ee86ac3939240f' +
           '1cbd8837b797832b759dab848f087e16177562a90e5c3bea8146b859de80fd5e7051f4c2940e3894ff265c709aa09d8798058ff74c03605b7b1855e19c58dd79' +
           '5ce258f6e656a414a333bd651fb31dbb971d40db6786cccc51b03a72d85b7881b3144db299bf5f83af3021e24d6acdbb3c916033f2f76d358c4dfe2425253465' +
           '2418e184a229563a9559a8fe00a98089d6e1ed20b114cffb31e87584a6a48aefa0111d9bdb181a10e7a654175e8853e72f9c8868d30d10a08896ef26c61a94b2' +
           'b92ea68d2d177129c9ace1a1978a3fce7fcb969664fdcacf5ecdd183503ece13f934c925f6a91381478c43ea9c928d9802a394039e49d6760829f509b4c72d17' +
           'd8320627b672d0fa1f42fd252ece0066a2c312096e404a37fcb1cda86f2519142a739b8e96413172d32e9e23a8c609527e81db107c09937486f63883f636f553' +
           '72454f11aa08d17b3ce63096269e6362f9bcfb599680d93d887bf6323939de088b00269a88381ffc930d510cbf409979e44731993786dc304362dc22f57c92cd' +
           'bbdf3d61979ac4ba5abe6ddf37ff7b6548524ea02a81fbccfa2e1091b9534ddb972e4eee05833a53e582d6a1595f8fa0f0104122d0ac03ee497035a537833903' +
           '7e489d8fd38bf9062772cc96bcdad913be64c697b4ee97036ebff08b83351670d1a354e358563cb0b465b9001c87e84e4a8bd1e5602d9cb03fa91c3de2935dc4' +
           '3c1a01670ec652a370315f848376edea8aad1618e6d84186da5b216cdaabe13a8679545a1576597960112a03b9dbc6dea7cd88dad4f1ce439ee9ee7095ca8fd5' +
           'cbf4cfa77a9508c3e3b45e02b1fa3ece1194ac72ff048915ef072a0564a6cd4917ce19b4c865da7283ab2edda266f7c7fb12608e0871d9998a32155b55b5f441' +
           '1e5b4bcc16d481bbc4add1b84e0fd265b0d78096ab4a10792ed969f46b12c9d09fb595c701633d53dbb7a85fa613f8bedfad7fd8f07eeae14651b426cd9b2e19' +
           '83003916e850e7a5289a6cac0de9764acaa3a67a96926d9a6422a86052385d4b54ebb00b1505b8e424974b16c2837700efed6ee2487d9b7908258a1486f9986d' +
           '858542fe1d5d1022483d2456ba2fcc6bf7b7396e3e64ef301fa31153d7a2e2b7ccb9bf072f442b2bddf346d9c484ea2dd7bd3a5f491e53378ae822a3981c60ba' +
           '07d28a5085fcfa46004559d7f322f302f1ce591aecb01c3186465745aa69a4f3de1e09595d21c0ab8dc573410e2c39b20d17d4b68902659db94282f978d76afe' +
           '918403ac8ec907d585eb933f0c80158623b5b470781585c3e4e647afb2af866797dc6fdab6dcd4d9e9506ec7aee2e761d65c975c5feb9ea159fd3233ce333dc3' +
           'ea9125f3027f868c84a68b82ab90bfc0a66f7df1fd5060260c0493eb9e0bb1a35371d847fe4aae7a834398777e03275939741b505c5b7895f4eddf8a4a5e3283' +
           'd06868569ae6be0262c4a278fdbb05a2c8b500329653c06c618cb0e76aa902e7b86e580ae0d73043953b446ee761af22b3e82eb67f4f3f53ad3bbc923cf1da76' +
           '79d1e7690c83362e01622dc9c9f231df9d1bf9ba7ced0ef0c20e041f8c9ffa55ea4be0f060f69986d84dd2450bcad1ff63565d48302ba6a00a71e7cf0561feca' +
           '862355e3c0ed45dbd8c1a96a7c1a44bfe1f263e4ba7b6c32c4a1a6c9261107e0aaa3a98a01678852c49b3c16300ffdb2a20ed69da72b523cda7984f3120ba997' +
           'c16cac423d34a977d6ad6552174bee42e2816e3d255f3b026730b59ad006488fb279e09c52a3059dcaf6b9451cc9befd09efdd5f92db091ecb0d062efbc5b54b' +
           '07b05546bedd0526925d558f7dae2e0c8c8e38962beea7f75c50a09a4a276ab0a4a4219cdef196d16856801b8ff861556c4c0c39f38fb272d01ad6c181666625' +
           '5341e904667a3b1e3a52ce620831d0b3483b45aaf2f98084a70dfc08529a11319752e3e729fdb99f27ef75ab533af3b3d92e7eb974aba2e4b092186e0c9f2824' +
           'd6ff18d60d31f737ca3b706b02e8aed23add1a8540beeaa0cf1d0236aa6b81f9b1e322a05550726756e6cad30d08da3e06ad48de003c6c901d9ca9ffff6031b5' +
           'beee6762a7b7341e791b0cdc598345a0fee260b93a09ccc32001e6013c61a49253592dd6c12ac985956b4f9a46933537d78c2d8c71bd9840a5676a611cb57a46' +
           '95295fa487a0bf214434ec66df50cdcff27576d27215a943cbac8504bdb5e40427d946e40a60169175e168113171f2143d2c9f0aa7824ad988d79b628016ba04' +
           'cb928e0fcd5964df6866648f0aa2a7e82d36fed2b038991dbfd875f8c289657523ab0fda8f37e3dceea0a44bb38e98b8e837c5e7e8f5a8c3dd9f5f98ee29c891' +
           '3ec013f31c4788283eb7662ce82ec6fdb78736c7b6c7351d44108ffc065f7fc2441bbad57c2d8429651099835943368bf89852ffb81a4e1e3749c2e73424cc79' +
           '86ec876b7395ee912083e79c31b55e8764eac8564a9c1a3cd5b4c03ccbd1afa9e98a3768b88a0a5549c8f8683d9b4443f54d87e005c1cd5542e36a2dc8ea8979' +
           '25855d36ca3f11c0407028d4e9e83122c59ffd53e4e9dd32cfdd9a0e958f1f9a4facfb33c398107f938d05b08b049cd67ada195d585ef49e43ef0e00b57fe1e6' +
           'b67d489d487cdc4a859cf9eea442b327d441b1ef3bb66d3a2c18aab1fa6581c4563200c242d21b1e1dd70fc09995c3eccac5a6cd39a3fd4d7103cb749ab13be6' +
           '2b37e4a7709a322cf008e28ba31a45603942019cb9c1eb52d7a2952fb3b2283a01110f992ab68718447fe05e2deebe9a2925f3334847e72704664f43f6dfda63' +
           '8f6e34aeca0f181d9870c77653c06a88a439841b12164c46440b477d24008512c6f0fc152f28c2022e72e67cc9461006c6b49d431ad6606b5b7ee6bab879f3ad' +
           '228dbe4bc0b8bf85837d2124a08854bd9f936e7331f106db9f8fa151dac183d83e8977badeeeca19dcdd4503922674f15974b229ea72fec594f7960dd56874b1' +
           '87424cfa3d6d6efbb1990ca04a98e3e4b7c8949cf9dcdbe37a1c68b575ec76ec3132a99a5cd0a0d2a083187313f2865a45fb8702030fd32c321e6a5b26933a1e' +
           'f9f61cbe73b84842f808ced6cade0be5bfeb8e0196d80f8a2566b0d87f41c35e739af9f9ecb26f59a4d91391ad295b3a7acae160199f4c36066d3e580c4e1772' +
           '7a7a69e250f24dbe99075874dca99c48a087431bf3b51f1f4c1345906cb73da486105d360e14e9218b5fbdfad24060908cbb581c5f1a6a15432683417636f73a' +
           'fcd8147313ed1c6c8eec5cbc8c32a64e3c514afabdb7287b5769170e7a910b81aeeafd57e9eb0b07eace20b8301915be62b7bca88863b982eacd8a7c69936fb1' +
           'b876db06fa1aa422fcdb85f338fd551275214f0800a5bb10b75e91ecf1d1ae334220f2b8452aa9bd26da983bcd9bc8448c89ccf3d91fe3445512fc07809f852c' +
           'd5a35578129e3fbd8cd18d107aa13fe259f3d0c17f46f5fad44800f91f71f73c3e0a54dd75cc0195a955bb9f61dda7232ea12baade3d6f9ffe1c3f3a6001cfd8' +
           '4321b2f6a32c5662676a70ae81bc20da033aa266a8e71463af6468833ae13f2ab91979280934b6c04169cc7289ba8604939dd9df810f91aee3276c6461076ff1' +
           '90e594fda8efee209bba6359991d6ad232e5d60a1ebfb72bbec826c816d2cdd3c20cc6152b01cf5e1f9d55502fc22a8fa57db9343c9aa8ac9d87b3ce8d0ad83d' +
           'b513b00cf7d4a290a24d49d553f550be10fe0bf962236212a6e563a850d09c2e6f68482ddc3e00de6c15fd0ac2dcd9e73584109f0a34ae2fa58528eec77601c6' +
           '2ff608897a5647c7cd0f1d5522b44cb6c7936a48db75e87ec2c1ce68a5827a8f8458dd3aea5829acb8ac7a9073d2ed310a194e7ecff8561e8b9f239546cce834' +
           '8d20aa53769f162de6cfcd117871d249aeff275968c77bf0f807a39603d59a197b69a060dd5515b3815437fa2fc859f1be91928172365f9d44f8beb8b73e4af7' +
           'a06afc4f1c23b688984d758c5e38cd88215530676971ba7772763c3f66d04fa6a03f99f1c289a3a6679eeb1e408ccbc9351ddce9c7488efabaee42cf52161a0d' +
           '59f90c23ff445dff4bb21bce1642367d0cb7fb3957ae0860058e1792897529848df6b0c0833fdde14a13ea50dac37f1984de10e510f0f106d2e38e2610132601' +
           '6f5c9dbada84362eaba1c35c6f09ea898cef31bcd705089474eacdecb72a10b43d2a4dc8f02f48c1ae13795940fb8d20d6fdf443199d6c761b721baa7ad0c678' +
           'aa37d35da55dbee35b6e4fbe70ab9bb92dbe9b979dc2df75a121ffce7f9bffa10e3d7408d5896d4842c652b2fe978145a5039fc6c25368c1577895736ce54c3c' +
           '9d9a9465239bad9f22bd2a664cbc9a12aeea2f7dd231f981722ef90b4316afd220c095b6757f0390038dff14af1f8bae3a4c6fd705a051c7ce55027d0ec481aa' +
           '0196d523e072b41ec79dba1a9bfd10ebd09739ebb5fc14f48d38bcc12a1e783ebf40ad7ce53532c67adbdcce63c781ba8d50027df860c0a0a8ab64c098b2cc5d' +
           'a934542acecc467937791982916538e1fe000b27c9d56567c330725f95c60f0afe7c5a69f24fc8cd1ed7a6e012f3f823b36e17dc6439b3ccac8892f2e63ef6be' +
           '5352bee0baf1815e078e050d81a23f82f4d537a13e1464132039bf2610a634824dc1db7687321caca1fe83c79b223f00e5b97f5e9eb0aef9f63859c119a9a10d' +
           '91cf06897e6cccfafdcec3bd92728e710966719301d7d44d4aec202a1bcbb0f608e32cb61886d5778307fb0a807ecf66b5f11579e29ce69cfdee1484be4ebcc8' +
           '72beef810ef669340d658b9b5e62a8555eb903ee79ba9890a9cf490f656386e95a5aac9a9f53e3fbe34e600480b2079ff280bc3c30c3534abea52897a8c9339b' +
           '43727f0544757c8862e5f603b22a8e2621aff13c5b16db1768df82f8a80812d46360c5743bc73bb27ba417513d801ec2d23fe22e0e254f7a423af1f37f58e63b' +
           '7fdbf13f160fcb4da0fc2153ab230fe75f4dc329956403e911a1b616bdcaa55f38e2404ff126d26d30c451842bd7faf5ca059af1f081e2d1d39faf177c7af318' +
           'a2eb8b2c90a4e9575672c5c4464f3c9ae3308ae4dc343f769d859240fd2421756fd4bb2b8e0793f1926bd947f4c7f50a026a41707fa47b038269a189428e3111' +
           'e0dfe82a983e2e777e3fc5061724fc76925b5ee06ec83942647be183b116f17032e89fddc7e833030ffec3e06cfb3cd6df9b477d72ed60cdf3f82e9483d4d3e8' +
           'f49bd5e51da85425afd3f4f0b350610a2214efeab8343126c54701d31cd08ee44bb80263a247620530c3bbc505e03dad0a8d79e51d49265aeac2762e74f59026' +
           '7338c72564fdc11aa82e7cfe4597dfd9baa9dcb135d8823ca6879eb900bd89868d1ba574d4699fa0f63a79294387d5589baed5a6bb80b67de5c44d0d7058c808' +
           '9624a84c588f00ec487879dcdd2ad02d8ae6b571870dbe1713378c09bf06e5b2fb0a91cf3931e2819d5a98799c593de823b5f745bc83655f7724491b6d76bc42' +
           '942fecb1b26cabf73215f9433204b7b264312ef90bd4785d47f12ea633ae12ca715c85b6ed13e3418d58359539a7acab257b1c7b1809303b0c6c17b062a8f405' +
           'def68d2700ca14ca615c97f51ff35dd65e85aa00d86d595bf809e85fb1265d97489a32de3228d504f434fd8c95579eab335df282fbedbefece86d1ca92438631' +
           'fe8d25847796be4851768a905e7be2495c68d2abca406faf48b592d8d1de947968655bf16ce337ff4daef68f1a41fc4d4852149252eda83820d83fb786a57a76' +
           'c2b00044001b4bdf1b5be70e6d61c0b1e951034df43ea0672fc55ea8730a67f37328bc7d1bb95edd7eddb3d72551705e93869e458b32c2016a18c92031b97443' +
           'e8b13589a6ed9e8afdea4bd4b3dc975d686cd1ace7ac35905deb199302e7511a1d8de30b2d5eecbec5d2709e9c169c0b0001748d7d75cced6a331fb037694db2' +
           '883b1ba1a4fc020f43881efea622cdefe16f82588ee6acdc43d1e0174936e19ec9aab7fe81887ee6e6023c2619a5f17c6917c5f64d177913d9897d5b4c12a7b4' +
           '05c42fe3402001e467c4c25de1ee394c4a32f59e795f377dfed61703cb484a5e6140580df4a8aaad616ed13ed95eee3b69b4dea47460fa73787a180f5629597a' +
           '7fc501ffcfd3433b7153e9efbf5512b65d2696241dd0eb97b0323d9e4d14a9f1b27dfdc921807d7ff35e117d413b332f319516c606f88f3c93cfbdeb9c8e5230' +
           '961a13da5e247bf1ef733c8f67287f6021dfa575074c7924049060259a357895bd587dc0b12d433337e988436006714ed6e85d469b50348f56f5f6a306cb3f77' +
           '4a1fd3707ee62d4f15970e3ffffbc721c2bea61c7c9b7ac3ff4c55c2b833f835d036c38eebffc5e791b8d283fb4cc85e7c2c636c12b233a92a2bae7d2d24b967' +
           '99d215f0d0131ec42e6ffb438b189db4296ebd9f6eeaa64ea156511156b06a5f86431417be88e4fd4530b784692904dcc0274cfee6a4ec7bd96429918d476059' +
           '697115b27eafdfdeb14fcc131f8cfca4e701d361516d23e50a6f1cc34e67326ec9c80959f7f9e1ab6c2f7e77fc3cceb6cfe39fdec0c3c7ab376d3461d09b5885' +
           '6d85d838c8a2990f15d7890617776ad42ec0f801d548930c79a3f59a813cc4cd15eeb5c063af657a614dcc6cfa11d2fa0a2d09168d3d302516e61f6983a1324c' +
           '9701fe0ecda0fdffc7e721866da4488d5d7e841c01886e4c88e270f332a32e9a350d057f5534fc437854991821c912c72d2987a303f91830098ee79ed5a0cef3' +
           'a587b6d397fd2baf0ae6dada5419b490896ab0545b4c1b6e71bbbe481610cfec65f0d6511f199e2c39fb05fae7a81f9cf938d25f3a3f0f28d7e6536f209320e6' +
           '42d31648f1316a7796aace466b89cf2f7bd96d37de90f784fd7897e1783933d686791282b6fed1e9818040f0d99d3809de9acff52f7110729c2455e74925cce4' +
           '5976f02c4960bb06c94b1a05f737ec9c03e1457edee83e3d582ef64603c85dd8170bdba6a602d1f35fb127e507242fe9dc8c4590cc1cb8231c2b76fac2575c78' +
           'b3c74a6201a4231a5ea063e4e5574278295890b6fc835f0916a58efc475749d07e8b713da8f4aa82be3f36bf6f9a70cef5e77c6facf7ba68cced2237f8c3be89' +
           '076c3e64fdf18f2473b2fe572edda8fae6736bf06e16830a0cbe7fd8b911fcc25275e46fe501ff65f575e303bb3590b072fa4b6301f23bb8ebb5097648402709' +
           '9716b64ee460bcb0742f601d12ce9c2b317625c612299f03504eacf22a2807877cf4c95a98b2e815c9957066dccdf2318987ccbaab0b613b3a40a083704fb374' +
           '6875e5363bb1991643bbd6d7ca39faedac321e6d52faef780811b4b98cb2041246b2d93d24718e5155dea9cebd87afda8288fee6b6ccb18360f1a9298af7c8cf' +
           '3e052f1c652fe310a7dd18794aa82d9d4746037a4746f7e2a3954d9cb4e38a8f62dcb68c674f6ab83ab78f752cf0cd1d189c098a80c261a39acbba147ac58a96' +
           '6b99e14e553ab720c98f0fc653cec6e69fef5b34ce6604b142bb0deb2b08e1b8430606765848a0cc5d43a4e1046fb48717fe4fd291f0e2343db9da1bfe5f7d49' +
           'be1eb51875d64ca1b3bd19705c063fb59ba8d57db1db4323943d30dfe974e76e50705f48b56c2e5000592651fcc3192400cf6f6b3b824adcb8049788fc3ba202' +
           'ef6448cf9295ca1fd77b522a428ad25c78993c48a7e61ac9b1c0e9d9c0d61d8febae182bf725d885c6c476223e7050340a0a374394f6aebf670239b8766e171e' +
           '67e2b8f999b06f51311a394a7a3aa5a3f0a80de6baee2655067d88fe83c1d470ba797ed453007b27ccf358f0fba7d40d3641ce2b6d163874182d91c685238f0a' +
           '76a3aa8c866c2b26c5b7dcf607ce25da5c138825e3c064d16616ff8918d3df2ed6a71db51f1a689475a74a65da0294168eafcd7a839e5c6a67a6bec3b0690edd' +
           'b4c030edbf45394f4bedc9e7e5db65d2ee0a7801cc9af2d7324237c8497d035fb3608c6150a2a54c1fbeb34b6893c24082a6036b544b080ec595fe831995da8d' +
           'aff2556ce7f9a412e93155826512fbb1638c32d9e1a239e0603d88405576032cc311d55510c831b018584c7a7b15728033716929f4bcc10ab18b40d51531b010' +
           '782f9dfb1c1d2ffaff787a5561040c3c98e12454f9287dfc85f257bdcaa794e8a88a6ae15791725d06c42f81e909f7ce93f1348c4d26b6d1bb020a4797b91958' +
           '6aa986d0311ab4ea39971c2ae12fb91cb9923bc056cd5cbf0a253d263f60740123eeebe416a2241f5c1e428d102ce21ea2e7d7bb17d9634a2604e55d9decb5a7' +
           '258562a68753e14fde90a64b7ed9f7ecf64631080f98f07c7fd12742caee93eac1db5830ba54807531359da7320001875685b466c76b2688cf6fe1220bd30d65' +
           '29bd44e470d91771a163274720947ab83e5d6a8f608d0d9766509580d63eccd9b3db31c5d4a83b32a015516454c961ec77a29cef5fcd267d71523e2087db5fac' +
           '414b4328faf675c589b1742c0221c285d69ccb49b171608263b3978867a07f3ca5e1dc668eb4fbfcec82960a35face7c2b95f367083b3d65ff87af55cc2e69b3' +
           'b6cd34a0d0f5c460473b6dc83ee0d2fc6b9405762d1c0180eb78e5b508deb99dcf335afd47fae2977db58171e9e0ad2a68e155607707ddaa1185d10bc6f9c57c' +
           'e220a684071c9b0df8c42c0c9e6625e05817149ddaa19e63b76b493c91bb9ae1bd9f3ab390a4387d292918aba3057210ab3cade9d918b7a8bae1ecaf9d201941' +
           '6e3ad5273a5dd827e7505755b2e147f415aca65b95e92330d43990892e0c91c2577b38ee3149227e62325e5b0828906ca5bcf106fcdab0928ab4c08b5962e4ec' +
           'c338d56f7babd6e22def3631f4923789ae867b9659d46e4534fe44a0b700cfc7588d47ae1aead0b62cac1eb0623222164d30351fc3ef663532f1b43ec25e9efc' +
           '5b4febbd45ceb8b98a2428bfc5fcfd12766f88e9b45ce02b1324ae3edda61204096bcf1078f16045f0b2895a89088bae2575a277b956ce401d179bf1f127ba00' +
           'e57e55a4e6a9b26891fc4fcbe4795f094fc6617ac63eb8604046c1ce9f72abc5c0e48f094eba1217fadfea6b0dfa90446a18588d0d652dab1ac9956721896832' +
           '03973710bfc8c7625d771650913570b189b097a05a2618d548309ae6442b0294dfc22f238d7a856d635e53c7c3b4d95381b8957ebf11076f08d31138403a71e6' +
           '72d3054453fb819f6e0134e5666237265bb7f4e37730fe3878c7f32fbe55ce36aaaa88054ab81aa0c66d71056eb5ec012cd20099dde77cd0c768b44a8fa7c51d' +
           '66ef5815766b1ecaa8b40663cb2ee7b4df73c7a48bcb856e0938f8b3c4d52f2d8f319c7ca70cf37443c9ea152858cdc4504645b3d504ec5752b9221c5d6408d2' +
           '85f748a6277edc95759aff5c35562b17b76cb402c45f5e0bc6b428cf31a1357bd546cbe452645b3a3f27c59b0acc50a0436fad73af8f5e41898df5c366e90f0b' +
           '2723f6a2ac869a28ccf171a97ddd1877aff3b798bf6614e4fbfc3890686267f21e465acdc3d8f293df25e400e66314770d0c022aedfdc90af8649217c15e17b8' +
           '00ca2bf90c85942dba8a0197cc23b4daf3d5eaf64e4b322349c3034f9b04c325274c88318aaf64f0f0d92aae6c893a11da27a9e0e1baf400be684c414de62efb' +
           'd19f179585dc56d148f25ba1dba1dcba93b5db50fa54b3e39c7c1180144386c5b8901030692702a90a433d28acc4939beb843fd6226fe30096748b29beec2696' +
           'a5c3faa56bf6a5e080dfd0e609491b83bf98a920e211fb0688e1acaeaf4af843be57c6c933a2e44e408adfdae56fe80cb3bea3760903ce98f57366f239ae138a' +
           'b60716b0f10301844dc03297c333c51c70453b46d0fb3bb04250f531b81319af1e78e08948c7fef6aa602b757bf778baa9e2c7cf49f54f476e716a0e2c30d697' +
           '7bbdcc7e24001a3dab081af1bd6f3fdedf897b79903db562cce86110303a6d7274f74a71da796c78e2c5265b86c5c11ed59f7e806b38635e48ee1f7d70068a44' +
           '5e353c4458644e30a01cf721868effce6162dbb25fa4e449fdba351c837bdff0e76d33a605796cc80d37c328ae35b04ae4f3383a13753d20c3ce4879c344f65e' +
           '3f399b172a173a0a7ffce9241ada2f1b23bed028b481cb6024ff81a6e9d7953d3b70e281882d34d90753ccc27a51962f8d275dc512042d69fe92fdd138d91aa1' +
           '4e956a2f0c486e07a7d425bca664361c6a59a6c35c8d02dbd1fa6053d526f7eb91eaf20847efd46d7d37a1667276e51ae0098d5ad587ed4b661f9a5e47715e42' +
           '826477cbc5be6334860adeab3ed0d70a684634079de2a6f3c57b72aaf7f098f462c15fce9e86d41a7f632792f04971fcda0a486ea25b2eee4e9b84b618ad025e' +
           'a7ebff90f889bad4926e3746b413c3d8c4fd518a6e57c48d5a25b0932b5b08b9d3ed520e95615f00729a9e8d532433abe13334e0284ef55d5823cbdde7af5f51' +
           '71ac1b948104170e53b9bfb11bf08c8deddb6f91f4629664c60643b33a0249b4bb620035296ba085c01faf86163dca898063ed4c52765d96ed4f73182b07fd1d' +
           'f89a646c715e9ac6c3cf6980ee37c8f1d6defc21fed48e040a53d948bf0a3caac1753beaaf17e2e9d6935d559a740d1e7e0ece23c857977ea6ed96382d141518' +
           'f716ab27230ea25434f6bd6bc0e03ebeba25fe78d03822e21f23cfb49c06d6d94e7b1d46b91284d4db2785236770da5a82855631f4c9980094de5761f9bc8d9a' +
           '5d6878b318365153239ce0c137dd2ac191b38d64cda981700219b645c04d24d939e7b02885c6cc75ae168a83f9f2654f802103040b964693d35323e0cb9d3e57' +
           '49fb8cf8bcee6ae1152578a4698562aae99329b2eed0394e37d7929f5b872caa578f3c177d74972906af354349ee274070e378c7df0afd464044b7d4b5070e93' +
           'dae4674ca2d56322038eca973114d6e114162629fbe014d013c0f2999f05b4dc92ea57046875b09f61261adae7ac8189a58e57a6c8bda254ca77da8445530bb2' +
           '3d7d12f8793188b60935b5ea57c6e268c65a19a38869d234d3e4c07a6b8641dba7f7d640c207398f4ef3fae6ad73dc04294aca9c1186ca6efc8cba19dfc61a51' +
           'c27a3e5c0587e7e45af37a4a2da62d7240f81271d1d653393e9f48ff6b55a28dacba021852289858f3f8578f0cc1b34230e83dd6d8ef30324435eede8d4694ec' +
           'd1ed232776e4d14e88258e08889286c437210c73a09a90ac4a01a0f6602165b4e570bdc2cda90d004ef10aad2c2b823b4511ac227877989d4f03ef9b102cc60a' +
           '0a5cd617906c3e61ba6249807b896108dd0c63a89785839a07074459f3c931dcafb4b3c4c545720fcd84f29098cfcaaba77e50bba5c2d0a35ede4743913edd7c' +
           '3f4570f81f9b1167f89d140e0559b5c1dc316eb240356d4378b4687c167cc06b43abf9d6b83e501dbc10e88343b0b217f038aaae9bcc6febf5adb8e8724f14d0' +
           'ef079b0aa5d5acecd151855716515a6551b344788869989df8213592a5305b93d1f7e4a500407f635c8816db2be78da6a05d5496ca8f04284c1a493ed031b9e6' +
           '1a0369362a0f9b1ea1a43e753ada69351c51ca778dfdab0a82243e5f2cfdd959998e29a95904a50cf441f6c822bf06620cda8733df967de3dd0d0c9bee1a8c3b' +
           '736c9744fc0347ffc3211abe5bbdd3754663029c0c4793a03b4557da78ce9683c4d562598041847e3e735269abfcfa8a08547ce8aaac8128f5a2d86ad3dd6078' +
           '81e270c42a2cd145aa92433040daefda1c5b8d5e017bea9654908a2fa860bd01180c4ddaa40c0593b52f1db652ac181b05474607ad6b87bb1d411215e68846c6' +
           'dfcfe1117b628106ee8df9e5dd0916640cf7e5af99c02e0476fab99f45a36385f6fb246c72ffd26a803b7b303b46d6dd7123df9dcf8b54ea7d3bf218a33574b2' +
           '69c68c3e98446bd18d1351e2f7988438066eec092b2b686abb77243a146ef7c40b451a06e63feab89d79093c05324f74e16a7af972a2c99843fedcbb2dc239de' +
           'bf5c4fc6432ea0a4b0bbf53e49b4c622a16dbf8816275449e206701c9f3a15905215fe6742e610204bed1d7ac974e19241d73e6001df09f50407196fa805e1fd' +
           'd0953234f2d203bef76ec5299521ec9867612f53dc506dd7ad0fa3a5109dcedfb117f20edfaf59c81c62c835f8db9b7a2998db9c85fbdbcc616675261734f287' +
           'bde8ea59d5bc767253de6dee3c8040923579042bcf9c0a6060ec2e7d54a49ee69f40dc189ccc1978b3ad686658ec8a8116da52091e60dcd1feead4585d0ebc39' +
           '575df95607caf64dcf5befca6a57140a87d5e97b21c718ed635b7eda3f1144477a9afa3f3e22a552addb9f61f3d50a8db9ba9a71ae46155b0a792cf7d888498c' +
           'b7d42e3bfead40251c43340effb0ba1890c8afe51447533eba28664b0085c2151b1af77fc8ec1579cfdfe8aabe81c33fc89e52843009d54f5edfea7c066db146' +
           '4f85b0bd49a5cdcfb04c60f879c3fedf94d836dd4015f3ede9ec66baf8ad0c5a1a74af6491fb40fada1f758800e3aa8df3409e795732d76bb0cfbb3326a34b4e' +
           '850423e029d2b30cd554c7256ca9cfd407e1f443498df3208497c019e80a3c26bf91ccf695dbbec73b2c74ad510f6b24aa4acb345f237ef277e4b1268ef28fda' +
           'c2a34f2e9152e3639c8ae82239a67e302a311398d12664f5fb728726411d1dab4dec65aaef5028887823c5234e86b8301c8f397b63bea607dc4449dccdd15e7f' +
           '44e270582672f84fef57c5301a9afab56143b33a84403d4862a7497fb92da99a29f3f0494a8b768401301950d7f4cf948f6148cd66506f099377285884aeb762' +
           '389941f3c237f9443c7456a65e822a072e7b227f663a63875c2e386b98f83cf8b4608a91aa06b6f414d0d777196fd3b3ebaaa788aae40daba2ca0f968216d992' +
           'd725036bb5fa2f82ee382821331e2a7d7168ae9657d21b261ab7060fba623cb575869a43fb5cef37d252aa6e4884e261b31bc9e4c0ed0ccbc22976f32708922d' +
           'f1bd463f782cca9020acdfd72162cda2c44a9d6e051e3a0f0f1cfa3045d254c1ddf13a08251f7eb0f379b812e6daad41c37c5b9d8442ee64913b8030854a1b08' +
           '72b3805807e03dee57e0c233c6c761728e3f0bb921638354aa38f23b4d9a59d06703cee3634920f96451a062b4365b24d3d8cf98179e3d72b997d3ade83a6a8f' +
           '55799759c12beab13d02473aba7b19af5b53e0a9d99e61817135e61bf6f859900a639608f9bf8169a13d4d8333d82aa74404104237ae4df1afc3a557bc82d6aa' +
           'c7445e70ffa30f29ae55399c38a92ee9630278e52a1548a4a83135631d08f348067feaf174901b9f138efb17e847f42d76daf70b38dc5dbbc78b0e497ed09042' +
           '41747c0bb5719f5d4cc69c6cde67087bb65b6e775771bbce2e68cfb27d4db038ff33ac0a02aa4de7880ac85a280151f4fba7bb8d84ca723c89bf3c7cac4aee5d' +
           '1b2b66928b50fbe73f4b9d48e67fd22f5f91576138c60e987341d51d98c50a7d8702b53100ffa54ba626531da335da93da64b72ba9b4eed03bd99c17c3ddf56d' +
           '6886bca34d548dfd3e9fc0682c8a14e2351365e576d5db175a491ade27cba826a757b87ac35f996275d0eb5cbde1ccf6bd3b748e4a644d8ee8cb957a76957fc8' +
           'b2b629aa0bc361a2437abbe83295266aa73c44bb6b4ee2bff98bd7cd6f6076c6bf75551e20b302ec171dd8f4123a0fd48db70026b311487aee20f300a212b9fc' +
           '28127f2be65bb1169c738bc2c69577a44345f86333fa0d41ed520d687f43100bb996e355642f49e9baf6f9c71fb2a5e571d4c758d30aa33bc69290b2be0f4a8b' +
           '49c576c437c92e46935f5f419c625223e98ec7b5f3b5bda5359ebf3d58c9a9e9b3deaaffaef198b24f196cfe4abbd6d87abb018e679c450765d550b0486b9a57' +
           'e24827316aa3bd4826361cc55908711bc2b2c2ae03a061051c355582deb1f793ddc09a3a3c95ee10c150ebbacd820f569c38041b6a1535af676023f2c3312c89' +
           '6bb2d71a4b1850a3fea02d71da4f6696fb9dd544fb108cf42ba8eb21da731a006c9e5a4a8d7b49228df338f1aa7f181da50eeda5d9dded7e51b62e35186b9faf' +
           'e9bcadd2a1c23056bca5ec44b4a1585e284de9b6f13cd45e6458b5a25cd1f10221d72c1269f46d8152164efcac22816a7b77e683a78016eb080b6afd8f92c7de' +
           'c5bd93661c6c8bd2ebc4603f282d65795b5f1e69ba18b69a310ed2c7cbe720685b646d0b087b3882f7f882e9119531f3df46062b638295fde259f57bcfb2f23b' +
           '78e26a49e06abdc9f884b92e1360787a5e2b0fb6a0378ecabe254ff3ab42bc077614c2ff5951215aa48201dcab566a1971bc4cdc555b06e43fc906fc530f88e0' +
           'fafc35e43038d8d83b046448080cb19fd1a74e0d8d19d9aaa470562b01681f612cfa806de7ba84d09ac6df3d96d1177f9ab7ba91e08020133f1ee8cc598988b5' +
           '8dc2a937120824b28d1b01dfd8984238e99db5b8ec36c1fc1d1e91774e0dd5200bb3d30df12d6450567fd1d2f3da8f37bd7762514e3eb98ec7de5ca06c038bea' +
           '2fd45e659b5359d5335f7f2d8434f209b252a6994c3df799671e8ef3e66461ae724446d8b8f94d3486713c21df6d9f430a3ec0f7800fb9f69c8f6894f7d2e0f4' +
           'a5cb6bb979067c4acc4820c457bdf5b822bc647f63a8c8e96e38dcea017889d8fa9057f3a8220157bb3bef15babedbfdecf483dacab6980a24753270ee058bff' +
           '56ad08959a7fb8a286231d9a4eeecc148c7c06a8defa1182da61e646d6f68d514ccf84c3bdf09717d51fa8d4f04dd88e2cd9f9ccc074e01d84174276ec035db5' +
           '308db34abe028d10906180e3ac07f11bc711bd919584bd5d27a66be0ace6afd0300c246ff6f6b5936d90512cadf20d905c9ef13629995ced85ca4ec9eff5378b' +
           '4b4f3a04e0d85190f7420859193ccec4f87b39736fe3743ab50c33439332faf9ad64a0e44eb06aea2d5437a88214f852dd1cb397dedb6e1257a2e15835a42995' +
           'bd7db0a27948d821529f7ce486dfa0c6bae95f870ef53ed13e3c9642d4c985c0d39f2002141b22b784ac1b741e73922d533bdb43c227b743a4c8da38e03951d8' +
           'eb7f07fd8d30112b935eb668aee01d7ec42c4a6809482cc4e307ab2bcd600655190aa92b97174434b9b1aef41d2b1f20aa59330e8eda7e932e373ca5e44188e9' +
           'b88b21d2cb5748b0a281f21cae580c8bfbeb5714ed9007ef166b3b60774594df03850c130a36ef636583d367e42dad7bf8174ddfc628dd6b1fd2dc58f465e955' +
           'cfa8e1f1ebb696c9da98e600d796830ede6e1781b8b2be3a5e513ce8e5d27a45b093ff93be824bc5a7b6b1bb8f4e8aac779bda7b2708ef491c0d343e99d12942' +
           '61b01a13f980f07522cd6bae66a4bfd9a53ce2f56f4b17a95905ef0fd049bd1855734d7cc6117a0172d8529d01696cbdfbb01db5a5ed1d0a04acadc4cf2efa91' +
           '592aab339ad8fa2768000e38c2469be25f1390817313ce3a2a8b947fcc6cd729cf8da721760e07cc8b45d0b06216007db5c92c7ac7f45279c3a8d90677138d22' +
           'bd72be4b0e1f0b119a9184e4a060fa8eaed744572af67db1100b7653b4509f02aff0abdaac0c0d21b17529ff81f663b6087ed2c0b76a6b4d54fb67ca3f3afef9' +
           '1b93660c945a6fb47fe5c298561f7ef61e51dabe1a4af7d8ab695b313dabb000ea1cf1ee625f7f9b76d733c5e254de6eea9571e115336da63d7fecacac48cdf6' +
           '095c42c9eca73338b85e7cf4dc43d832956e9fc7d03044bfe30ce707e732dea1a743f9ae94eec3964c5e996fc5ff7f8cb519ff73693e614ec5f1a04b3842a60b' +
           '445176384e98548488bdb46dd83e004a2ce37e39290a060e1f85966f67d9d40084ef932f8eeb166b470b16e90beeabcb545d025a69fa8f9488d7203445f1f9e6' +
           '651e23b880837833536df762e2f81ce00de43c22ec841e97c2f884642c3264a7460f365ed35b01c40bcd8784d9594ed0be418e49d8c0c3b5e7b3af94265ff055' +
           '3c4d7744d0c0c913cea2f75a3a73242bffe74aeaf748e3b5d73ac9f2dce7ded52f29f9ec49d69a2ce4e2372321db8f4ae3ad6435d72fe174831ed9095a0ec1a9' +
           'c6688114b526dae1275317cedfad5e9031946003c89c22c52180d0a2af3a97254784fbdd5dcc3cddfadbcadca37e64041f58905d152ef5561bf7f40e1a698b63' +
           '5142493d77067c2cb84ea6cb690902f79af40abf7bd650a7bb08a533834f11702be4368df50fbfafca16d96909adf7c723a81cce4028a102d628a080c39461c5' +
           'b8f92ef1ed8c21a6bb17f999b0607df41c29f30c80fbfc1c5aa2df181a406b1e69969746dd9316a5c2c523900429cc0e47d955e0e33e1d03d137f8908e720705' +
           '598801e410a9150dd7147df3e3a905b4f9b41866afd90f406bb2aafc8618ef1bd9dad834317ceabe15f46f368073c07904026fcb04d66af82134beb2b0dd1bc7' +
           'aefbe6892063f37e9b13c81fe8b9c4f6cdcc4435bab2af64530d60f2dda0da8942dfafb238a282020f154a2a395d7119c3038b84524a30c9667b62b0bbd297fd' +
           '48494b5b6cb696b71ed7f442fac0ed6a340501d390b623b80f0b8539fc9f5b75fb5084304fe9ee5652ebc9022692d7ca183e9379fca196370118337ab12835ad' +
           '5be38cda7bb5639339db55c960288d2898e2e6382f305a8a5a052372f0b8966a9beab18f7979b47414662825d1751f2d7cc62a37791e5caae0c8634371981336' +
           '43b552d14f43eef48471e79f7dd84e9146d3c67a2b0b7b00f4bccb7bf1ee9388e1cc33b00ea21007c041e89c4a9fc0ed6161a689d99ccf97e44332f2cd740325' +
           'f7a07b497e96ec75159c428dbb1ea4a968d4362dcbb3c24e822e50f1a11d5c4b013b70a249d9bf0ec022be69a2eebae8d5c510299e8635241693f665eb37b3bb' +
           'e2d11b00e04e023c6e495149313f13c773e39bbd366e3a1d355d3bdaeb8737b317fc388446dac105478d6c6735281badbbb5fef83815d7214586b06ef465aaa5' +
           'cdfc4fe996456b4c3286738c9a7f9ec7d84aa5d865ef49a253135f1e6e3effce68231ea4db0aeadcaa45363a9ed46ffbf1620ed457982dd0993c722c2fd280dd' +
           '023c9e97d737641defbe7a988964c63a5fb42408901c5b2e4af2241ec1af4450f4b0cfd8eab94a13876fb5800ce51f766da0dfd6a23545b0ea8b894016e05453' +
           '9f2a7f28169edb4eee99d10ec32acae8c4999bdcd23bbb1d799e3146c2d27cf0f179425015246f2fbffc237acd826977cb3c14f408f24cb75c5ea0c0f45f9cbf' +
           '854b178c35bbf9c844634d7a03326a81a4c96ef308a300400aa06d045c8a8986e3a0109d85d4f5f374595a11cdd5bdecf5bf9b8bc976d167ef1c44ce526843d7' +
           '84210fa7f341d96da06c5cd6845e78075ff1136ec404a13625c491a5f70a952f9695d67f9ee56e6f746ef31f7d9b74fbb94b22b40ae2d12a6358da76b4dd851f' +
           'c490535a443e8bbfa82c0c89da49b6095060747b50f8d6f3186c2a75c093e52339d886df7c7991603c5ad99612d057f55c9ccd5b6ef4598759811f6ac70ce1e1' +
           'eec76c20f8e8a9953920327cf7cde8e5682f1e5d5289048a325ca74e72e43c899e7e06240b65871d9c7ccca12a33d5eb085c6ba83fecf1be086441fe14a53889' +
           '0fa5f03d8306e0850bd00ca1acb1e4620b1551b5ad86a71a8fc53e9837c60e445b1399a8bf3ab4f52ba4657ab8497031597375c026cdb045d8fe330391522ad7' +
           '2c7a71a5ad372a6f1194f1e18267d1350979e483e77f50be233ce4c3dab5d4ff86236334b86c70358094e101c61a54854ad4cc4495b4775e9cf092865f791fdb' +
           'cec43d12f6f59de714a2559bd6a5dcfa13bf82bfb820731b014dd269a5a00e6a0bdcdd1d8831253e033004487d64f6b3dae3acba55475a2717c6adacb2cef166' +
           '3ee793715ea1588fd4a103b5acaddf7e0c07016cd1206a2cd9eff614ac97521a860bfbeea2d132ea4d9360c808b0486c98c95501c6bac01876bbfe39f6110c87' +
           '2f79dc190009222d4c608768f7b3cd93573a1c125d87058662f972a3ea8a47885fe19019ea234f3ab7f5f2bb989c78aebf2aec108478d1bf13dfeb0a11ff6d93' +
           '494561b0c5b13f3f5000824c393256def6568e235baf2427c7624b62422c267d8e6d56415f748f00138f3dae9e4305a8a84ed1f95d2e8212f7dd7646197d5924' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '7459ac40e52f0c42cc6d72b3dfc95b850ce48128507c9f8d8c18aa0793ecb20030308e0be0bfe3c21ee75d25dc06b096ca000000'
    },
    {
      set: 'FAEST-EM-256s',
      file: 'faest_em_256s/PQCsignKAT_64.rsp',
      count: 0,
      seed: '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1',
      msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      pk: '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8ff6667c05051dee8874abb448bd1a066bfc25d2d8ad816be26cbfda4b238b761c',
      sk: '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      sig: '764bc10992594a31c561af8448029f57b0e2bcf40d852ae24f5bf7d0cf1907a72afd06a467297265294d714e773c754df02e3aaa81f1d52426cb93740df3e771' +
           '7f7bc2c4ea334f6f70c093f763b26fb9d84498d9d1e10b84ab155dda9e093c420bd5b8b28200801a587329e0065edecea957494a5beaccde79a63ff59cd5c0a2' +
           'd9d2f4762794f1f1a47d0c5a36b234269bdb1418831843029c51362e825a5475ea8defc479b3b0422b24a9fe15bee3711d825ccd4b3d4a96662d87ed5bfc39ab' +
           '22858885ab72e0926cf5a801a486ca27286e9eb5ae1137fb6b83df14607288496499cb822559578150064e92deba670d46bbdf4c1e21be6619f88c0e05dca0ac' +
           '76c8d03ed98ab48027dcc6e7c29766550bd9655fa0dd7dd1134a8f73f5d220ae562b961ecea64fc9033093479edd8a5faffc09e0dc081b64e83a0c53c06f1f89' +
           '341b1a2700f2bc81e2c32e5f40a064cdebf5e08bfd96be1cf72608ad4a0a762e15e8ed268ce490290cae3b89320c8afd697a76dffc7024f77b419684a1321bb7' +
           '4b72fc2d264b565432157c613760204245b1cc21dd390122dd0e8616fa59000c51e34e2cd628c8d502c609b555d91e45729b483a0d5a2107c4977374f18611ec' +
           'fef61e7ea4649be16a451b0539a91fbc95a710f76bc0c69ad1bc6f770927beff35e764739f7e6f84b431a28c47154ea141f07d61982adcfc6732b7b8ab3a3b12' +
           '5ef405d4d5fd4233fac97687bdd08b5c907a2ad282fcc2ad389dda2049827ce871c6708bb95516eec3fd8c61f76f0f8b1e876aa61c1ef12d0f938a466eaa1605' +
           'fc306075a5f33272dc56338b59e2bf311e5a3f8a214d6b5dc0d01bee9ec5609cf0d411ac2b4d3899fc365da691847d78c08083675ae6331fa39af055274fb6f4' +
           'c8bffe7ea243f8f86834e2c3be844246fe91929c1250c360f115afd970077d9b7fba7967aae9d3618e948cc024a3955984e8ed3124da2a81a408f89a23d6680a' +
           '74209692a95495f1c6c1a5c0948e487dc0187697b8601c3b884978115ffedffae50f275f492d73ea9a60fa7136094f86fef5ea5bca2fb260ce4a45aa76db27a3' +
           'c75eebc7253f79a37bbc55a3df30f47ff078e2d18241a113b0100ee1efcb995c414e8c3725eb30b06f58d5e8cd10dd60ca06e1ccc2848861ea5b7d8930c268a0' +
           '1ce3de21c801a1b872576f712ea094dfabf44e4f9174a35c566f5930640c82419dad90d3bd3d0ab9a03f3133a3cd35b77ced9532a6ee55e8c6ecb007573af3a8' +
           'e75da093da16b5d41f750f8b5f6a17aaa08fccea889fb786f0d2086d790c74ade99a7770ebd80911ed2d5aaf22fcd73a9219325e1e0cf7540fac5beab464f5ba' +
           'e8dcfbc0d44f88df54a6cbe8406ae7f042aa17ff15d5d277f8c4f24536a162f32c4fa55385d4fc1592cc4eb82f892db23b91ebe1498c8baac8fa04d285d783ae' +
           'c73aeed0679ea0a040c884d352e0eae2a33a8d9763b12c3e3b3d0c5d007345236821ba1454f75bdf342d5fc1ea278025936892e2328642130d4c805a8b279431' +
           'b37f213b7a4fbfd8d9b7c5e1ac24d61fe60ec35ad6b99809d5a91b0bb6ad565b2de299e0f639b75a5e74546851fec978a3663cfc12d7e882f0c8fa1b44781af2' +
           '95afa1894b50f92ef8793b1f26125213cfe0b27adbaa68442ba890329364acc4c14ebdbebd4a281112c186ffe442f74d63e6ce92f7043372c22f77b506c88348' +
           '9ee2a50d0878c62ce80ac11d3eeff9a62ab17d38bad17b6cfd3bfc8effcf8ea66cddaba86304f83d265f1142078a244ceecfbfa8d5a42b35657771cb0457a98b' +
           '2ce151d0cd9dbf9e91c8454c0fe3d7d275c7cc6e6e43579f79d6063179a18d2d91402d6570a7ead6b24a87584c747b1200c32978b0dcc379a2a42764f25ed806' +
           '06e2f685325d29e359e51b4872c079ab3fe18f7986c46f3f15130baf01d7f18dc5916c5a10e3dd3bae62eaeb3eb75fa9ed459d124f4ee045e2cb8eeff77cd9dd' +
           '3d471c833a7d3400bc2a02ba9ff53a2b9bc76b3ecae50ada87887b16f174e29eb9355420821cf06be637e9e4b2f16910178e5379091c59ad1e234700fc34cd66' +
           '2f099fa4deb16e406fd0ad75f40fed3c88dfa143033664eaaa6e72871955400827b336e72abfaca0725fbf966071f67dc6c5bac2c0c0ecc816160de8de031319' +
           '5fbc8a10b04e6107af71705f4f2ba09af669cd0ddfa433b560089df72561f7f208c5711702c14c456a68e6ff1a6cf1bd378eee9c1cbcc15ffb1e04ce5c43da28' +
           '5bcc1fd2825928e3e8880a3a7210b5a3edeab610e055ce9c355d780a9eb6a37a48508283948967b70f6a1679dd5acd09686fd40c9594993e5658ca29c5fee6a6' +
           '5b2140a6a51d93023c280157b4c4abc0d7be192813ee69b6e0b43519c59f05c9ee498ed656de5b588c7c1208912af1dfd9c6c915b3b9210de940941b1066b011' +
           '1f853cd63080e284e90d37dc751da6f0676218c2b500aefbe291d918307388fcd70133455c8d2363fff39be1b0d0d248019bdae29e5c092e6b6b65ca8664a6f0' +
           '6f1330e42c8ed0967e488523ac2a7cdd51577cdd593c988a701858df04d21fc3dd0c60e2b7825ed405aa8a3f0114ab1d8a695298961411a8646b76fbcc695ffe' +
           'c04bc23f25e43457b972ebe6dc2e5d0f5c04247eee43fe6b7578b7d16421b699e6908f796f2a4aabd96913cf6b866a16e4e41087100bd60185cb65a771f62f39' +
           'f9a8a67516d493394bd4d16bce46aa7b50066d6e2a4818f15d66f4b4c66d90482dc4eed83057b0b03378f983444f5396cc71287b79ceab7bfbe0deb11ce59e5c' +
           '83e54e3f258b45fdfc5f9dba56fe36538eb20314c2c13fb9c5de6c4bcfaae4302478587d8019d31be874188f4a255f183449c64d3bc174326d66d0dfa2bccdd9' +
           'ecbc64520afe79d7dc922aadffe0280d6b51c44d02acdbee7019d0b4445061c9c4e72c0632de873ddb2a5e0bb7264fdd0cdc6c744a82681e90df5106f7b5e032' +
           '39b40e4ce3f0afeb69ea7fa84dc4836c06405743d058bfaa7d91f02f9557cc1c627cd1f9ea868280ebaa3e84bd1d62e314e795ddeefa6170ab1ae94ba83843a7' +
           '7b8adbcc7238f22f85f5791fd26e600ba33c8e0634e33299909219e366b02338c8b088ee543aadf6decbb8f8d839c2d7d40fd623fb47d833dfe6f91e32e7000f' +
           '11b679ecdd97fb7676c930441967b894efc30121ed04f4463ac7d3f23c00c7b2d9e67dd135939cb1e3abfbb33654858b5e0eea5aab4d7ce61e05dce0d2d019ca' +
           '0004ae00c25ba21abab1bce3d681fdc976b63d7ed693c17971f474b10dace97cc9cfebc93718da3aae1ed7ecb7552ebbc8acedf6de784ba44fbac9fe13e1502b' +
           'c25d68e6a10dd43723e45b6b8a0e13655f656e2388f04285d8f7989d010741a5c441c82acca9aff8b1a921867c9998770b4675c7cc849e16579bdf87f32f26fd' +
           '60e595d60b2567fa5eb15a837990f10e1be4a6aa9b502c080eb9391eac8179e50312284c48c7a449487e543b3b2db446ce99eb6ebc7d969b0e9dd24852d12954' +
           'a86231181b8fc3d784525c3233a2a4216315d8096ea97084010068efa66b5a4b794a0f1b9081214e24214338e4646e67001d798be7fd66f4f889d46db23658df' +
           '70beb72cd75b83e3e39f9bf002477afd6fc063906a7c234a853e30f78e30cffb4f70bc6be69252a2a65410d17e59eb160fc368000c5f159aa2d27a193cbc455a' +
           '528a3c267136e432d09642a15a54ceedd6397b8013890680a409e1c71d0f2fdff14f8736a60cbf14cc5820b5db10a8e5be252f3b3c68fc5468837a33c53f8772' +
           '63fa1f5411902889abc17d5d18b1bd269b2deb749c863ad5d70767628c1d8d7ab1aaf9715ace21fadaf980a593ff06cb4b4412b08f9b5578ce58336ff24daf6d' +
           '0d06b788730880a9b26adb3f37f79ff08c109a12fabab30033663cad953c574025d52bbf57f93c570f254b100467e494ba21ebb8593e3dc81b690a53b32f7ceb' +
           'aeecd1bd23f909b6e400170fa1f4707ff27cc03ea7d65d5e78d3d6f9504eb18d3105ff43037ce5cea0a7d31e4fd212535890e7891752eea264699c9b1017f9ed' +
           'dbb29be7f3af312dd6ccc153809828d3e4e84cc8da50b12fafc1c521721767a97a8f0022cad3254dcd899f427e190e797a666e7897de2bbd527b82c195ce7606' +
           'dd5e2f72d4694a2b2042d5baa2da0d448cfd5526cd4ee8d414a7f7f36a4b512f281e1be2ac14d252143b38b96dbfbecdef2f249ee5796ad2c17682499793d3b1' +
           'c9dd8ffdca0e9d8df1d204e8459977cea78645a124b82f0591b8c60f4bf21bde7c25a236600a7e5b1dc0390cec186143e3e3691aa8eb83797465164e22a4fe9f' +
           'f61ba6182d1b1862f8d1beaa771e9c621238fdb8f4ffae65838cfdf6acc06695999085eee4a34e12e0b708f43b37a7e6dd9da11c6532b7e39eff0fe77d8aa42b' +
           'dd902dc3e22e27a1e0fd6754dfd51c9415fc18bfd7ec172af90a1a4b53a0e199e5741038f728bb6c7ec388eb68b660a0217a9eb6152c7f1bb0fb70953d96ca40' +
           '304ec03ab51009a52627435257c27e78964b1ab6b97cde17b6c66136c4f144878b48636646731702c143877c4d6b657e34fbdbfaed70c08b2a962b35705db8bb' +
           '88dd5cd77d6e2f8e21df1416c689d164b1363fc54df8542532946b144d583393bc306ea6ac252adb25e74725209f4e90854f4a80d5ec55c893aaa983df8b0660' +
           'a2dbc5dda39605f36d00bc0c116364e1ca44ebf495ab518f136e4c177ddaf87e80ba54426b4775c14f08dc196e9179c8265436c67115866a1f786342268e9ec9' +
           'eb49d658ccb4a6b8ae427af68a0ac98607e2fb1b70d838aa7e24a428705c6bcb37e6f39235fb888cd0f72781055e9b8e5a2e1daddf3ccbfa18e90d5a9dbd44ee' +
           'def1bccf51874cd7bfca4e2e608587623cbaec159c6467785ae6d89fcffcd2bbba9bcdb84229c4be211e4113e6e19a5277305aa33c0ce8ee657a4d33f98235c1' +
           '72520168f5dd7527de680d8eb4dcc005488cf182d1332aff9b5467b40df6decebafd7207cd476b49d26ce43f62773a74cba49b3564e91d7accf55007f7ef0f94' +
           '3d6ef336c600a1d97eabc78327a0ddb2daaa2fb9a90e97f95678a1a365b0efdbe44c9b2f56f7b2fc70ecace6d9a48a2f17ebd4a95950b222f5dcb15637681d25' +
           '0f49b8f244c2205a660017199430716b56953eecf75cad03930f140aaf59aec78bd93c8f3cce12342945e59ba43ee2474dc9cf744183eb7884f80e344a558942' +
           'b2ac936f83ca69221a10ea29c98d847908604660c1103516fb6c740fbc537dae158ca43139870a47fc9daac36ae63967f0aaca678e72d33a24d9c7f19dff8cb9' +
           '7de073a8e78396e297b62a2c04ba0368745aa91d59078b578173b469c9fd7b5bf6faef2e5800feb55b8c4755a9647fea701b6fe9b2e86f6a8eb0820b8621aebb' +
           '9d0174abc2c3eb5a1e4f254b67254971ce70b31ed554bb9520063cd772d49a63aa649aec8efffcc63f2cfdec67e7f323298228aa76d6b8c259a467d541e8fbfc' +
           'a198274e47ad6d71c0913edba2941fc0ebf4ffeb525f68beb35966ca99cb9d2d4e65583405e4b12a50ce00693e296af3b372076156931abd4901e374969e5f2d' +
           'd7179f6a0d6a9ae5a84ad6db82f2e385fb439b84d7853bb94b6e20ec2938b5425afa8bbf2db1acb861f22578def62ea37d18bb7d9b456518285420b90426ff9e' +
           'de73424de587607b932028b95622b9635b07d8955258896d2668261d4fa591bde34615a250cda6908fe920b7b2502ef42c6c82628365c1e3bb444aa4940d7f23' +
           'de3eafdf7a324bac9e253da43b41b0d59d9ab3599ac8c619f47e95e5d3a3f32e1a6e0d26c88eb86d08886d60abbdab4284cbb82cac06a1773dba8718bc625bce' +
           '7a7fbbf9764f494524dee3e36a6b40a6b1709b20c9ca61ebc42efef9115e135caa0c2eb71672bd66d4b52754949530f95f5c11ff7bf10f2411566623070134ff' +
           'c5d7cd2a595b84cf2bf2d3cce6050b290be83cb99f746de2e31835279e2a8639371238f0d21161bef9602a70a007bc188bc340d6ba427bdbdbb27fb64d1bd370' +
           'cc9fe30eff6741b2356d777c2954c09a462a0ba1db2b7e927c2ec0f41fd31317248045777748f52f94f2b8081354a9d761300d1f7485433032d690b2d0ac056f' +
           'bd7e8936db2f9ecc1fe66696e7d841f2d9c57d33f22d6008d0ccfb27fdf029a889e14f1eacc5c17f4b9ac3a5700c3e5036ee793ba559f1b3bfca477271866699' +
           '5f7dd3603fc6a27047366bfe34fb7c974a7009490af89c12410daf4cc031e9cbb152ea144fde5b5c2253eed32f66ef722246d06044eb586466e58884243976b0' +
           'fdc0243f2814c1f80267a2ece381b3d46f8eaeb6aec6fd8fb8c9ded17c44e896c15af8bd0e2fff6c8fa5b444a9d0fb1e536464d93aefc573a2f0124d882ef025' +
           '027bdc7c0528574bb88bb44d4818147c63051a0d9e3af09003889ccecc0988ebe1bcd36c60a82c837f99c0da7afe3c71a0f5d5e3bd3e042dae76af2e09ce7b9a' +
           'c163974f9fdcc5ac09283a89d78cd443cac0ccbf07f873de102b2a1e0035ffe04971c9688994166140a25dfbd4b4387fb9f6f106896d61e0c44d8d41ee77ab08' +
           '0e4d2bb9fa3082447fc9982a1b60ce6bafea50226b8a89b7dc8cd0ac1910a06d35928b886864400e0890835780384bbd14144f67c35f2bae6245b93592acd391' +
           '79f864c2e2d97e791247dfaaa7ca9dd9e5a42afcfd071a79ab6ab2720b728f2d4313a19d08d570213d01fcf3cbdfb238f407c1a1cb35668ee33054c8276ec259' +
           '6452379c295f28a5abc8c1a3f46de55e9e018ff4dc29b1416a4af40d98e380a778c11c260f09e7d721ef22dcb35729251e61b67b5c1f4a0c117c5ebcd398145a' +
           '8fea60e3249149014b86f53028489f8b62def35c6175887b4424fb9923c78a9b6c053d299a45f92e949d70d98db98f6cbca64b0d2f52b8f24e3488aab2cf0e0c' +
           '0eb1beb77566feaeac916084065ce7df69a8ab5b80520544487d6ff77dfd19a484442212f2eb281dbae26da0e3659d798081fb4c16c696b4a070e86420017042' +
           '5c145b57502a8e013b81017890f8f645c0f48fc3b88e35e2c70c2ed3dd8328b97db6dd0387791ce94e077aac6cbaa919c762dc50dfb72b885a8d0e8aadc6f473' +
           '2829de61edeb5e086a0fe1a4d0f292469ba246d2f1246dace2987fb9bd2e7a7596b4694f97e62bdd664f2bf5cb7ff5dbb0bd8218e86cf54741724986f2fb2dbc' +
           'ded257f7e2ab5c017c52c7695480f32d8f7f0aab999eaadafb50d20a5cfd7c211eedb80d06f7778f2f09c9c935e7f53a103d6ce5b36c1fef60d383da4e4dd248' +
           '3d15207914251d486d1c8d783395ddcf0bebf97875de3985aac2d6e2641804b2014b50ad2b7917254e34809cc362b638ba970df415c8042c64e977ae79eafc24' +
           '74ccfa8eb4f39cdb34bd17ba65065637645afb42819053f5f81d353086ad68499ae66415d5b7b2a2f424bff53b4d2fa4310cf28051fa17f2d323f12a32dff709' +
           'd626d36a9c48947c342f36d5a2f19e7962a1356f48751a85e97389dde8e9dbbd83f26d6210d92a97881b978940d02a09dbb4c5fd9894e1e2be48d4da09163b69' +
           'ec1cd3983bc77b73ca081dccecde3e81ff96826644d4cab337a8336e54830368a54b6a98865102b215313ced633aeca3a4774d3a09a61d3521d5571843aa27e2' +
           '08cab465c824d7f5980bd66b121f34172bdb55c9176cad6f3334019b9c41c4ca51a4ed816ca2e7cdcbd92d61735c592dc0f8e25407225dbf2390e402413b95b1' +
           'dd9f10de978e19a5bda3960e240fe6f70dd3560a808dafd6394d34135d6b7c7c0606cb836f1a3aa74cb28e42b55f3e2f0e6fcc2c50f149af02304b30bd7fa59b' +
           '971de75e47ec553620d976bf427c1a238c1baaa2017ea96320758e7803a6cbb4193fcd971afb3d7ef1db8c43b579d36783e4fda06b77cfc12fc16f00c3be90d6' +
           '21ef68a4887747a1a1941a3058ad97483f44cf0e44a393a90a96115a7ae6e99f4ab2a54c5ad7f95267c8d3a1cd87ad2351e607cbfc752253a3ff1e2740f8b686' +
           'fc831a70acfd4380dd350edb7dfbecfae7e418ec3cb5b8eb3e0c19d5464ebbc7d473534dcd2fadf55512a3eba2cedf11604320fe8f9b1c029c9c87dde21dd33d' +
           '3019572bc2575ce5e2e425ae94b66dca3dbe1d7a8d109efbdcd0fd15a7ef02c77a8013dabdf4c93983f645aa00a3c62da72b5931c8d57ba8dbbdf394e5645e1c' +
           'f92d1c1d33551c0c5331309d294621b130169d61324a8f0029560e9d699e530d00f11cc9d10065e53c4560e39cf1258b4af965c8315e91c73175856e73d9153e' +
           '2494eedd55c68872581ed3ad94f319cf98488585706674601436d396e8871d51db0b3617eeaf9c84ebded5bc6fd9200e0ca76fc1ed7a02c7f3c379068aeb39be' +
           '4a3e019da14eb12f2010af62e50d39a13e2f16fe9bfcf3835f7db78e429f4766ac8125625f8d419c28cf39c9d7ad1296e59aef7262a3765e5296c4c162827668' +
           'aacf672c823b2d655070078eec511d2b51cf7e82c1e8ce146ad94c90f4273aeb0d0086471e298ce03c48b20bc9fff4fc8b432b0e26d204e7108810cb934dd81a' +
           'b7eb8c9fd6c8b1bbda6b67677597d0434b09b68b77c0f1cb450f84f319bfb1133dc14bc66fb7efa1000a942f24a5fb7f428e99c1fa93a9ce381046e6ac887be4' +
           'f875ca468a2951eea4d41244a0860ac0f642c0ba8b7bb3c18382781c53fdf1ed153bd1b38b33652528af2ef2fa5f5eb4bfe27e46484d240cc071c8d1506d59cc' +
           'a2b024a08b595c9813f764a3306c4a3e833d73b3f9ab116f18f32dac5459f9e642d6cef7fc6fc90bb1f3c4f9291a836f68ac649b93b64c94f6f16c1a6c8a6aa7' +
           '5e1b91151df0a3ba451754975b112368efb9c9aad6fdd5ffb8dafccb849e5c5dd421b7e06d7124502fab0123c73e2d1ff5a0c2d727c376b8cf87eeffa4ffe29e' +
           '360148432d08493cd34121e21eb08182089ef52daf9b69a698f9730d6913db00fbedf704d9d174c3feb577b2c3ac641d1fbe0cffdafe6c9e651cf1741489c13e' +
           '80e7903889f255ccc985c592a2248e5baad9b645df17d52a66b3b79413339baf2789ef0311c2eb59a2cff0dcd28cc241435642df8d61a8b6838dff1575ef0692' +
           '926b5526c76410b78b0bfb53c7c94a9d22a4a479e899b3486a9332d35b7d0e2209d53789f3417675a0b7aa0b6e08d7b4ef517691c5b3a7b2c1c7dc6b97609df8' +
           '3c46b24d77b7320e52a847921f3fa0bc387e9af41f3324801e8b2432014b5035dcd39212baa695b8ac9dd1f4aa6eb3acf717078d33f26d7515807800076430e0' +
           '4346a312f7cc4c999b59d351e25791dfccdcfd0315fef8d9036525dfa68363eb3b1173f1c55a570a5ff38acb1f38c15fbbd412377180411260d6c7a2aa95451a' +
           '4fc99b084651267da36a62bef5d66b8a279eca5ae5b8d4f67d6f78aa28a842958eb7133537565fcae00852d7582a0379e8c0d154c91f63568056f913b25a2ced' +
           'd4525ad398cd8e85d2fb0dc0330bcd7af9102ce9f7bac795231804e553b7aba95bf396094cb88a705e2e3c90d60fdb2805db2cadb35dc6912e35cd2a8180847b' +
           'e812f9e040482361efaf4b4b429f77fed604cad5a849a99e445d32000b969e4212ff30cd87f5e046f54d980570d8deedce4c8013091cf6d306878f61d9c12134' +
           'bce143a1fa8123afce15dfa5dffac745da92878894252aa542d5eecee7189aa4c75f6aff1a6edf9bae6adb8d9b3dd7e0d78e6b19bd5657e87d25c2c981d2fb63' +
           '04080dc9ea19dedf88297e40c709fc98572f270bb8c52851e147ae455a5c31f548a547e8676e21201fadf96fa81682f129349110a8bb1b239e3d67ecb2bbd462' +
           '32fad308cd3b44d535e6bb145cbb19f19c45e8b06081020fa8f173379256016f67d59749b6d2357bca80145c5380b5ad0c713ba2bd60dd422c3ac94e53f17843' +
           'cddef6c8ff171fefc267d7a525d5c13a15c5df8f2350f07a31ac955167feda881bde7953b8766372ddd485988f2aaab4c3dbdcfc78e92b54b8fec076215929c9' +
           '6873469e5afd8acb1b2bd70983f4649dc8dc2986b3407c06693b71bce207c6c9b0ade3769d444acaf5417887bbdadde7096fe38f79b9bbf142ea2f92c494429b' +
           'b6409b8b327471906ee39e0598aa6cbd74a4983d0191ab5bb5b1fdaaaba1bbdd4382c25e0c756a1da3aec98cbac9f20709817df08a597c2b03a0ec638cd42096' +
           '688d221a2efbd37661f5673015a8362ca44f6e37ff324206f43852f96fcad125d14dfccc69f72f012d98c726cebae44ea37c66b9e8914bb1ab948e64afa5bc77' +
           '13c410632864f1a17e0d2897f9a4d94ba6a3ce48eae389ddcaa31076b5db3993082e68d40d8a2c4a4ff1af57507e2e3cb51db6f93b37a1778c9a5e3a41cadd3f' +
           '152affa81f0cb28c5889a3c72364d43929b0d7c4658da4df55e805737f02189565cf84635a974de6bcd8c49b0882b6d2ec057ed0fb1f62ed8b52be52555694b8' +
           '9d85a46b6aae3c94303565f8344c0f4f4901644aebeedbcf510a5d8665f396dd9fc370a86049653aebb3bad939a1cb5d408cdf807bddbf99f6b4a3ffd81f86ca' +
           'ed0dae09a997aa94856e589bf3e4edbd46e57cd4abe3ae3c2fc6d35968824759848f7268579a908752bf702c7d257cc748d4ee2c7c538897d93509a45cdd862a' +
           '5b4c312ef87d9852f2858a4a44dad7881d8ed6f2abaa78d7a90c030768ccd51e809b8f650982fc382bc5baca260639a7a70cb2ee09e5100933ed26ab37fd1016' +
           'd3a0779ff8983962d39a5bfa7954418c7a9fc92d83eb0aaa360358babde0aa0f19b44cf76df2f0f783238b5cfd3fbe06040ba64a2263c9d7a5d5ab127184eb26' +
           '03f4c42505496f42c0a1454ec87989af5fcb5542630689dab2a6e9a595828d196b627281ccae692a26c38ab3c5a99a73c6b72f1d550d8c006ff2dce50e5151e0' +
           '415c19cbbe588d3cc68b54d7a90728d6e5c089c55eaa118c392f577cb2aa84298eabd670a3060d760e1fbe710c3db88600cb2a9921dbfcdd36a1c603d2a7659b' +
           '40b5e651fc12c8e146feb3cf6d647e513793c659872c862ffe76590f18fb99a28123c52244bd1e5b7e5bd857191254ee0dc5aef804122317eb6b9050139b1d5b' +
           '7dfbf78b0506ad8632a0e40a6b0bcd2e64c7d1680b768b0c4ef43a890502667a6f537b77cf1c3a328ea1fd8867d5b9ac45bae675ea5da85a57a542349460604e' +
           '8c7657f9d054cad5cc0fe56990d369bb6ba4808308b7f707a21c21d2f1529f9a421c87963a0c7e68b2d5cd07eb49b9e7be0d556ee0b0de1d1e84a3a4e4cfa7cc' +
           '08aa405dc7f20b5a0283795c41b8cbd34d58d9129708e64172f38387d86508c30a23122313a8901bfa4693a7c3efb839ad35b13088db9945dc4a18641d3abec7' +
           'a2732591d537b1f8a35fce6f93581f6655d7129fc5db8fd8204ae7674c9c421d3c0b7d4bb24415b7027696cc7c793ba589a7c66b53ad3e90a1a2bf2ed6134460' +
           'f1dec4d0502b70a1488e5f97ea20427129956e4dcae61849b67546d3a5bc6d740f5577c2550e49354e41377fa5c03455d230af0fd8dc3e3606dfbfd74366cd2a' +
           '12099c21784d6749bd2ddb0ce9d205ee9c577d42ba7a8e817d2d0eea4d1574760f7064b47a06837195435e790b96d191e1c3bad53b02bab683058cb2b9d7082a' +
           'e1f5052fdb518b500400590269791d6b657dc77c846d5ae4e09ecaca242f25def9753fd8c755ccf7c4ce206a68371ca0d4421977997b14ea0bba47a258518595' +
           'f1cffe1f14c2a163fc1e5877ed4048fb9eec08363c162a16c90f5a112ef37831351e26475d80f9886f3e75aaee2f46c34a515db56df6845490050e83d1d4acdd' +
           'cdb3b55a9acf8cd972e2ac14f13a9c857f92b6698ae2877323fb8053cea8c6e78d5947c37035de647f172d8604b6c0b531e2575e758ea8f9ea43f0fdfd166985' +
           '52c0532c0c72d582f2015cfbc77f1bac15bf71ac96d8eab0ff466483e2a2a796766884791ff86995a8a2d0cc19efaefbdbf4e8e95f0ee17d0fec2b115317da78' +
           'c540b2dded99230cd74586172fc49589f3d9f4aff05c2316e9fc0cf6ea229fe4ad02f14c02201d3ec6c51b79470e89129e5b9ebc165c9e13c927ccc0c3670f09' +
           'e0de5bfa03d431902e8125bc7531dbbf037dbb0e9008c066f033396002bbbabb260a8d19d10ceb06e1358ff5aa0d978e249dab1048c4817a7e2912d23274a187' +
           'e73a207982277cc53e13d3ca77d64f7f1b10f4a872e0f2c1a2bc0d5f0715c41fb9a35199d5688a36e553a2ae6474021aa6a1ac3ec4385d02ba6a13db0b35ddfa' +
           '1f84b4a7f5f9ea40c6e23a9cd84635544a4ba3a45393c68657ed9ccaa45356b4e361e4fc4141ec2d40a7aff77af90dff34f1f84d91f49dbe234af99968f74436' +
           'dc826bc61fc3c5bf48fb3eac8835c3f45801f74bc92ae3725a86df178498ebf7b7fbfe85c01833b3d3bb2237b5b2fdb855565cad0f5647ba34a3e8b601f98ebc' +
           '74360b207a5593894cc4be7bf048aa94dbd4f442e2d69d3bc69752130acd1c36799811511398a6b989ccf07d79f5036cb9571d2c5cca2651f8fa1147912f2c1d' +
           '13f0724ceb6c266c55e93c67bc7dc2723e49bddc5885772bc529100fc7ebe2e4f4082104a6abef11abede352d26486a5b0ce9c49a60b629c270a57b9028bd664' +
           'ad7e0faaa9a578086c81c39c17b04a0433b07c038b3a7389b11764995ee7920dda9f0e161bdac33c5ff0ad346332d741f4763d359cda809ffe67d30200706536' +
           '12df53ab0016633f1a839de3ef5daee461675c7473341a04d02a3da667c4eee6b59e3de9c61271207e4b48bf917856b59635c228c467382f301fa2d4046a84d5' +
           '2485fe112790745e6ce9cb4fab073b0ec3f806cfd83822cb46c9cf455ba622777e451b8769153524c822edca45adf8ee3d7a8b56751b0ddb5a88e65f42c62198' +
           '423f13b69921d86e103f2822456ff8d7ff39d837e7f1a5d1ec6eb8929b188f04c85d51f91f72c5c320bfa1f7e967ee5ef9b97e0e841912d626a9e0ec29dcb4cc' +
           '52088cf979510f5d265dc01b76f769909ec987276b2dcc4aa4a9b8bebf84c2b1ec78d482708b22a01261de1533ac57e1ac28ba99b29442dd29730065c2bef875' +
           'eb4ab2f4459bc81132deebb57fff290d594fffb4fb754ad90ada1572a48c25804ffcc8bd2894b45efdf38dd9201cdc958e89a732e8bfebca5731fb952294eadb' +
           '43f57374f36bce26c325923d428a27ccbdc5733b7d5426140bd729d5e38c7e9411135bb6c00c0feac123f3a1003d5436d11f011e7c4f985cff4632d19f1aabd5' +
           'd482a8ca0a1f86cdfece6cc5fdb37ff3226815bdd1340511f65c2efc064624d006f92629c5e293ccdb522ffba2eeff4fd28635da98c1dec905f89ca94920306e' +
           '6d704994af44b73646614b793eab70fd60e7f84daf668037edb2ced0a4367db238476b547ed33524d4a5f9eb652c857c42afb606279a34a0f61d910935c57d82' +
           '89d8aedb74f175aee9f4f2f001e00a412a6f500cb58ad20cebeb216c8a69a719746533506966502c7519e19c92ce94ae7b037da7d6781afb34ef65b105958245' +
           '22efd20c29c6145ee4919316e51f1c5e74a419a564d629a2275e8288ff21a3076e651356a16b11df6a9f2a455e2d2c243b31e184b6eb0a3c0b67e85308ebbf2c' +
           '7b785af95773f8ecd313dee7eddd802ccaa1a88c0276429d157339e5b09aa3cd07781f83dcf40bc9451a790200d734213ec5164b3b4d2e75d427644b25285fdb' +
           'ed726c16191927d983d1bebc98ea55bdcbde3cb7f63a7940aa0076bb26330ccc3536d18a479de91070279817547ccbdec618328c7ed239c94b23fb6ed11cf7ec' +
           '5f3462d733481e5a28830bbdc5963c894a0df88fba130f41aa8675ac07d635477b43a169bd37b42efae5a4445339438b1106289f599ff2bfca7692ccf7151e4a' +
           '83c8d7fc2089b61b68885b5a2b66ed5424a847c0266998f6189225b7d8162a9b409740b2963fc4f4f3ccc261cc8fad56cb578fe6eab107be7d09988c7841b642' +
           '4f47b51c7c2eca3acbf48e09db5e807479d4b6ba91bc8f306aabfcef46597b2700bca3898111f20583bfb52eab951a54fb07f03af7e8ee32869005608896f7ec' +
           '23c894c957227d7c5afde13762c66eae6447bf96dcce7ecd85a9c654bd9795a631e934580e0c8f25249810cb04bcf99ae1db4dae0939e154a9d21f7576d51e07' +
           '9461a551623b2ffb87f67448ea87b57ce6bdb953aa6ef4aff84d9279e9f5500bb7bb8d02b9814f039d962a4ca04b5f00f99eac90d5b6555b7f6e39b6a3cc20d3' +
           'e2fbbf99571d38d458d6aab9982a220a1062085f9e6e69192a265a04f250a46a78d5bcaaae32a850a3d745b3edec188bb543eadf9c22f3c64c43ad6edef901b1' +
           '932b24aa585d17f50233b66d8f6eb399a768c4c7e449ac156484e000a3445a3d1596e05e5438d1f3f443f91cedd5cb65a5b2a647e6156523d2da0720636c1618' +
           'b33da17294dc93bbc4847005e5dbea46968e4bb7eecff775658c1a4f87c6eb6cbe3c411631b12328c86125278627077b042f8994f57356bbf521d32a02122b2e' +
           '0cc6825362d9646f6be5e0b076ad68a6587c90457879e2cbb0fc6f6541fd29e026ad67a575053b522ec80d761ea1f0dbc85782bbfb58084c2140e265316ca0e6' +
           'b8d1e8f261b06015259436a2da759e2b2d3413231013d21c0d74c58eac2c579725b92da519f3682be616cc4e3497153bce18e4069f47d867eecf95f3e679cb54' +
           '870a6aa45b22702a520a56f5369d4833d448ba77a957a33003ab9975b3e3ef22c4f4daf869f48476180d5dd5c7be201e9a9c69826c6f01041b749ea8c8ac9972' +
           'a511869c32e89a7f7ae3cb362a91f9b28b6da5788b3803b40521ff3413bd00bbdd5d95be813d6fb2a05ffa7184a32c3e905558fa5ab622a03b1695caf2ee497f' +
           '3e9503c0e483629937b63227073ab240b007a00f92b5cf5db9027158a397ea054c2d3fe16ca14df0e8b8b67519c6858b3071a5f3d8fcfe81c9ece9ac46fd76fe' +
           '208ba85e5ef0ddb30b9cf53f3ec12977afdacb6b6306a37ecc0472a9500c846ecdcc65284d67652ea28a4b8aae189ceb2acb9002d1acb5f4646d04460a28bb36' +
           '73cf44c8115634b40e644800cd55feeb9e640cde345f98fabb151fb6744d14dde0d3cab26a85d6e8e459ce470b603868b99302f61f3fd3bb9b50b0cafaa6d407' +
           'fc1844a110f2bc582f1897e18c5d9f42a5345956548e8e278501c5a3900548fe470a71b04047b663ffe008f4970318cde21fdfd10cfcdbc59d18dafab302be9a' +
           '05c218a2c358ebf886f3467ce8370f7e89727931d6562fe9481645728f30eb7a45859b41ad216d4605589880cf261c69fb2e18c1d4f2e081a5e628e3a7413822' +
           '72a68b493242b1cd341820116876885ea23474b106deb1df7dd947eaa3cdfa5235466b2e0e0e2f72dfb0e72caf29f5717e9fc65b0dc6c8c0ab6744681f0181e9' +
           '9f691ebfca4267f6f2199949f032ad209e73b8ee5a7c50fa39624d72ad4668eea8115129ab7a1eb7226efb8cd0ceb7b1d671d21de274c1de19f3f302b066cdbc' +
           '9ff85da2125d6e5a5372098a08d05033b76145963fce9172141c8fb9c6f39af1c17451fc7d35d1ef8b89727aa31009e95d200b91771071d9a814c3639d20c3af' +
           '6d8036fd3941aa4ce115f9a1847db85879ab10015482657e4ea17d0f37abc88f6cd4bae6cd42ad6151a95e422e2172507a6b0cc6f7d79829af8d239ede6b81ff' +
           '262648f326bd1d3997751e5ff189a979f9826c7f3e21bff9d0ec59c225b5b9afb7c472d2a2d083b1219fa20957774bc03f54c317c56a1459970611f6de36e628' +
           '643855930ff61b5928a809f098e5ffe69ad028e9f36d13909ff38f602793465e2474e518a9aa33743850beef6c5a98ddf0da953b553f02b5682db8325ecaebcb' +
           'fa648015fcc71dc46fdf5d705f9eb10d73f8b7037caa26b41b26072babc8877884fec3b76e74e986b0997b75c8df6f4a66ce9be4ef207375640e8c5569b4bfd4' +
           '37145e3466b14a553825c796369f8de243d0363910d164d843f729c256c1407bb0a289c3e35ffced4fe2abde994ffbd6fb09d3916ccf2ff1d9b1aa80af881d67' +
           'd31f550e23250e8a878af46681413f56f2180c847b4f56f0768820c537b8d5af34ce59e97075fd9e97387b7514cc2af6e7f52c586f0ed83a1766986ad744c04c' +
           'e04ca114d580c2c6c22ba3756c2d5c2af2eb7225ea8d17a0bdfec6c9ac817c75d618cc54543a4401de7cc4824ba381f708db0b1be423bf7682fa3f6bf1563e6c' +
           '1c889e17f1887ee0da1cdb22163bf62f4869cf7577ee094431a12ab245c61e66c62767df0dcc4705d82f220f0a0ef179dcd506ff3bdb69a1c4cb29d8d1fb5023' +
           'b88c8a84b5c2255d6c8b3c18b1aac71caad5a1c92f446a0976f4be1336edd0e7f862f55ce534f30e7021eb1cd61e43a4edfb81bc5a20412b300024f918518355' +
           'c457c0fe6bd3cd3da0b76185289b7c8a4383710097fbba2338a94e1b1a5803d682cc34a243b78d856ed6ac80556f4fd9b3624168d48231a92bfcf457fc00729a' +
           '53ac5975c366553e48e214ca33dc69330dc3b134cfd910f17595316a70bcb107265d0ed3a64f48b2045841ccfbd2973a6aa99a814d2f69ad7bdb5f3a3337d39c' +
           '090d5f1388e964489c26f7e91b54beceb21357f912addb1a0794f5db378d54b5ca4f91e70874083ded585ed4e041743c9dfa319c97679573bb517b075bec9d1c' +
           '78beab7eb403b6da4ab533431db48678b245820b8be6c1960667a428c18c6e00a285e4cd04f1f7d2ee49385ff8de3eb9750c3bff0ad8c68c1ee5b3217e7eb5c0' +
           '4b2243dd84fe8e21637d4a622c3d5988ec98e83167db61621d6d3b5ced7c6de30f95d2315dd24d7bc680aeb0ff201b5eebc401f49f9aaba7fbd8cd6e96261503' +
           '2c23b29ffffa132425a27f7066f8c2f1f0e4c8ae6eb9e33708bf8f50d28c8274ad166ea38ef798a90c81e72469a21002675f1d6784ebbbd0caafe88e82ad987c' +
           '1fc0eade8d9a1f59f45ce8a78386d39e60dd2cfa1a5838e1129aa89989820463de04e2e5fce855b1410555c89cb26b6fcac6aba79e1867a442481a47bbc99c0c' +
           'dd6442b84f254e8cc1426d0926e66715596f6b6a5bb8f9c76606bf2f815aae4cca2a50a2d7cb8533a382366cf0a9136567bc9f806fcccaddcceba2af4d789cfd' +
           '95a4cff903d8d16671c1942ba7936e52e73f2d6d831da3cd10b6004cb7dc9924f34c56285c2e33c78530d23c00f46733a2a4129738dc6af868189daf9bcc91da' +
           '060697953295519c78beebfb09029ff6ee4401d3ff46cf6f98baf8439c219a3793617f5bd09758692bdd963cfc8701f78b93fb70837cd77fbb7dda9e2dc76bda' +
           '367b7839c84762ab3f13c1bb49fe8c34cb613eaaa99190f4487888625b47790ff7c8ddc225327d77c0a72aed6a1e8a63e6a64921217234f2d395f8ba25efbd6a' +
           'ce3e84d18576c83438f6142db811b410b0193feebf5b3f4ae31bf09578ae75c68a5b9df05c11ff038aa74735a1e07da2beaa91b5a8dd540dbd281182b4fc7d5e' +
           '6f353681c3a4b1fc520301cd58ec7db751e3e551da48d68dcd4aeae558317573a9de57ffaf2f66ddd29a9fb3ba07a441c287ef61c703e04bd7b02536b3e031ca' +
           'b6ef8e369efedcafe613a3d526bfc4dc4cae0254597064015f26616dfe1e38f5a785c0056c179eaa50611cf9e07038fb1f07380963b4979485777266ab7893a8' +
           '7717ae2a92411c0361106354c33432b3d3d6d8819d5905e1cdf4afcbd1c2889343391b8b26e501e18f40020118a9fa115799c87e16b9073a136027c538635c35' +
           '0627b4fa32820d64a21bbee92210641c2af376eb33e8b3ff05d24a94714822274aa0423071abff6425acba4ee57c3b21921ffa4e0774b590da088ad150aa039f' +
           'cff56c2fe4937dbcbf1d3fafd46fd478ac710518b761d6cea83f35d01ac672d4dbeed3e2156f0e7b9ad6b672f09afe5f24cfef2f347155dded2f3fdc459d70a2' +
           '52d200876dde02de2259fe20bc728132d37c14956e685fba6551778d8fa0461017fa7001d380b949cf0460f2df5dab86f3cae6e60cdaa8b98eed167d1e4f452e' +
           '97f019b11a759188400a24bc28a134acf718259e0e7dd91a8daeeadf5bb50de6c67514a4b7e93cdb50567aaa46cabb6cef56628616ec79a0b479f9e8c9e65822' +
           '3f9b95971ec92619155b45e3e57aab6a96c7d797190dafd3cd03969e430c1d9ea51f85d7af52db55503b5dbfb819f4e7e6b72f5af87a820fe9427f9f2514f5c8' +
           '609be6413175b6d4158f01fc8d3fcf643231971c9deb8721ca2635cf5be2c29a8cb03f53134fee3156283cb647936e15c0e0d1fa78aa48ba60339ac40191ad2e' +
           'b847ff69074297eb090ad06a64c8a3d20b99f9aa5bd3f4c219fdc0374330fa04b67cc97dd79dc4d8a65fbd132e8fd1d719fb2881959656410b6c533771b72aff' +
           '4416e1a09ba65651f2d99fcd73eb1bb6f4d7e9882042e45c65a73cf9f8da2f23f75c86a5010a99b4d26863baa40bc5316d28f9c2100ea6218f286389a5bbc36f' +
           '57a70b2c1666cf0a47831957b6d2df44752ba6f519591d95fd24aca546776b8132a868186ea079b0efe27a90b1b81815dbbf7aaccac306006c8dd558f884cea0' +
           'c0dba834558a08213c0297640889d0e7677fedd8744c2bb59b47aced71e8ae940415e358f923d2acdd8057703bedb2bf46287f032d7f8ed322d6718e308c8322' +
           'aec1ad88d2e6be5ad71f68fb80541fed4e36ddff79652ee7edcf82942a004a9779ae95ec143ff87e370cad735674d8754b87e00598f0b49c244d32f9dc87e396' +
           '50092aa6322c465c87016c2a557d81764908e3356a505e4b12e60e0b55e18178c67e353a5b2a8a1245e6a6c8e128a45215726086629885af31e0186f228971ce' +
           '6d9a99671caf9cfec494433e52cf458e7c224844f8676bb053448da7cfe20928a2c795157d5a91822b5c1e700ee89d304ef9f3a0bb59b9860e5dbb5b8921d23a' +
           '1db94013d7c870c84652a3a5c80c6d63ab286782ee880234481c79081ed8b89cfe3e9874169f584e5f8b9ef40b12e56e041f082e3cb974eb49efbf35ab155d6f' +
           '1bdcbe17fdbbc8640c840a637bfd06b0ba48040532a9aee1cf976616cfe3e51f4354e97201cff1aafda2cf4f54c6c6137a29eae4e2f57308d24362b301e1e997' +
           '192a08331ee9697cb88860782247b5b5a3ed2c00e90a34de7533b4cf984f483c7c43c73362858bf424dcd29a6ab6746ab3bda7bbfe043f7b0b012a6653bd7495' +
           '942579ff9bcafd48383f7a5e04252e0ced84ca75c99d95558a29ef1abdfa93585027d8d14fc52f172e444e9ab2a0399adeb90e9c794afc13f6c7958decdb7178' +
           '31f90d5580708fb24327f4c16feaace23aec771e75665c9fbc325bffa0177304ed9be1879b6bb230975e3901d03d80f5859f1d01b0484eb1a25b0d9dae02118f' +
           '3a26b259f1c90ac949c432c81f6f2c95a2952b435b83ebc990d917c91f8ddfd935e828d3e9913707bf1bde283a949b05c22830e3b6c05144cdc0c597a776bb3f' +
           '166c83bc46c2d312f6f385713846faf22b2e2c6c0ff14a5a0cfd08917bfb170a9b45c25acf78dc16f5b536460b9ea8375aa18f48c683691bc023ce89184cd5ec' +
           'b2fefe7051718fa1d88bb7de9d801cb4eb090091636b3f2e59d7397cf6345c964034fe9143ee1144d6b423a4e15eb5cba59f421c4414a443429a073101168642' +
           '09b8e662c593b1548788bc2cc882ea0bf0d7a507a67b437409128a435538d67ea0f520c0220aee0f12755eb5f299f6053769dda01e5e51ecadf10d8c34a3e1a2' +
           'e2143750171bb1c219033937f39bc85f201a96c64e88dc4d49a65d169fcb8ac5766d98e183b5a13c67e7e7c6015178d75150251c9a7ed0a1d70068abc572ac44' +
           '15e4fbdeb2916293bb3604e4f4e34af87b1ab5c8ad05a5880d9f0947d08f4bf3ee5ef407e8dfd98f739f74f2e76ea97291e2bce8b01564f7e761f2f850cc2e56' +
           'c9101291e94885afc489eac3936861af81996d21ca63e6a7930a1cd5a5b921092a65f7e8d8f4d28e5a2100b3acf479486d92ea1fd377004fe724e19cb83ca3b6' +
           '4a2828fc693feb913c812ef97a0f9c7c8e702510ef99c63ea00a0c10226dcaa49efeaf13317400d378e6e9223557a77af1347845943f3aa4bf27313e40ef60e2' +
           '07c74f6ffed6545de6d3a745fce9060e10e28c6030cd7e0c17e45f9247b0f2242e98e1ab8910dd4b3b6ba1e79ddc9ce010c9ba861bf12b81aa26509790393b9a' +
           'deebcf6af3ed1100dd2065bf053bdc6274ab9d875160cbf7d514adf8d73855a9f83517ca31eac7b7bc0d2e87beee63a699ad6121a45192cf1bc00e43d83f3f87' +
           '75b2b82420d068f3152cea353d95d5be87b5646d5f33c1f8949545b83b04ea2c7b2381ff328e253b3a010c5dd03f6693e1af832c54bad51775e4f5027bda6328' +
           '9ae0870454b07f0739a0740bec307bc7c0e57d3236694848ccc98fd45e536395944427591027b8dc54c6b286efd682f77937882b460991b723da0c20388fb9ce' +
           '58fb50d8821eef6a3497fa4808c7b06c5331fee9df9a5ac8a0c68d429c3d61645058ff99c569817f950c9be98f5597c723bdaa92406db9d5ce5f0c0047d3a2e8' +
           '5649271ad6517a23e746c00696bc4ac2a95e983dbc46e209dfc3b2122749617dfbb4dbdbec646016475629a28d3424b2e84c4a767643885be9b954fc6a591c9e' +
           '925382caaad43abf8d74e4555b42e833890daced9711e6d4d74b176fe3b4ed1ccb7a17fb582e408115af7fded03bb1f8fd65447d525bc1e176c9fd24cd47da4e' +
           '1056bd681c5d8ceb33cfb0271dbe52c6168f8e4123e57d54a003f6426c351e74a46dcba0be6f9eb70b1243051dccbd47af1c66c12c3899017b5db6866f36da44' +
           '26d7eaaf360e47e4d8a0a08076e44ceb440d9ba0c911df3945147a5c1acec9d29d590073feee31cf64fe340ab79b25843cc551e4be2c6c5ba95eadc4cee98013' +
           'cc786ba2553c684a36de81714d0e096da69d45d90fc918c6d39d948f76c7dfe199cacb4855778a59e956088528197afc9dd4e5c52e3ff1f25c3bb81c75621fb8' +
           '9c6b009e20c80a8e5e41f6f06abeb519c77ef018e7d5cc89d80dcc3de3ad6ba75ef491967f87eec3a91f7a9903dcf94c8a48ee27a7ecaa4a2c438fcbb2ed3890' +
           '3e8c0ee2808d1ba827521dafae298c7950837fccd1077cc041a84a2254bf625d44b2a68031f74725428c32cc5d1be9484ed17bcfe45d964eb9b53785e724854b' +
           'b94f2dcf646ac7c6d6d7124629b6ed4dddf29cbf11d2cb0fef63f2fd415a39d643d32cf3c9d33c7f11cda0a1bdbf8c3a19efbdfa1df1fa282837981dde53ba42' +
           '3d18209d9cdd8a3ce49a4a0072580e4f883e2b784d62665270a2e9795e540a8b2c37326a57cf907581f6e99731fe6d23dde868217f9ba3b7d1a9efdba0842104' +
           '0cc181fbe04de8cf0fc0a4f9ac66aec5c2932118530678a048e7cae1d1f86e83c3787a57b1b39819a2034f714c0de608e2d4b0ec54b811ee1e55ff63e5734e73' +
           '7312e64005358a706276d302e46da79c58434f37ccbb8250292b1d5398b903d625094cf09c3799b84df1a568ab70dd7d573102085e4bd4a288067c1472eff14a' +
           'aec5f5b633e60b5baf549e2a45b88d3838542fcc6f623b2bf878214d78e03bb230549c0a2f080c73bb1b99489b4d26b5ce3a6a5d03bf46fd71e337f5a6022684' +
           '91b74c820b2bb36c148e18e551283d138570d20324a4cf790c4dc1a1f6a449a01cf1b7e03220687ad933a4ec6b42eded978559315b304c71f34f06cdfb203411' +
           'f4bbe3f26df6e036b15cba2f029ca0d84cc4db1cdc79870098cf6bf2985e228c2df495410121caaa3a5bf259df3445b8042fa759c7cef581457054de490ebcef' +
           '363e0b8de6ff04a536f24570514d90363f66c20c2e2ff04a173d74d4ca8cdb477e371b48e6cb556b93e74dbd787f8d6138c447852191fa79fa853385e9c19099' +
           '158bba270cc7dab18f61f43856affb09956945dd72145e96e8e424726e6bf2a16e7bc605be0f22c65ddbb97a7d3ee31535c13f7f85a2f0c74f29ea1c70b0861d' +
           '6074d6654c74318ed64e0469ffad17e3260f8cfccb245a22cdcfce3f87c933e68dbe65c5390e0038b8ddd6e940e7e59c50ff5b2ea0fe40ab237b0f076680b3a3' +
           '791169bae46567819bcf0c7dd91f147c378f8179f55d94dd72c5997dc836ffa5ab03d39c981cfaa25a007576ad31c006c6c40271f6dddf5721fee75f78c124a7' +
           'd1856b0e0fc611be895b2f1a49737f8d9e85f4823574401dff7ed91afcc80d67ab2e960cc0ef3e15319e957004a343ec072af5fbdebca29dc8612f51d4cc0d7c' +
           '1652d26b4e5cbadd95858933b513f776b50b9dd370650ddca255e37bb680ee5124f01588129e4ea8e031a92a5ced1f71e8ef0d3840aa495324db297c74495a4a' +
           'b8c79e9ad53e1b7fe198d5590ecd81e3b80a725145936b983f2ec64713683511b250fa7b1cbe9df4e140a3873988efa7798ac25771c60366136b68ddc076358e' +
           '4c9a9f33b6de051ed2c94dd193d9e2516ff97c37bfaba34f566e1ef768fddce5a0234d69dccdf039df880faffc781dbb8325bb5267d1dcbe2995dd7f74a13d4f' +
           '3810e2efad68921bb965fe95adaa94c5dc6c8102f9cf10aab3eedc58f74e85b0404543f8e02b2d61f51b06e97d5e5420cfc1c048b8b3ce3fb8ad390cb8be0534' +
           'a6e5cd1861703faebf129b16a1e2f3946927eec354a29e328e8ab37a71f0fabe48cb53fcc192f4f70c0c6337db9c713f736d99cb48ea4ae16f289584d4ad752d' +
           '109c114d5af7d6d1ac72b0fd259c6c26963d237abe4ebef3a64b663b8d4f559f58e89fb1321f84bab8cef369b5c9a896769148fc526719e313ea601db436f0a7' +
           '56ae88aa14be3fe098378aa5b0e6e9268457d037ebbba5df9962d4c7c7ee5e798c97038f3d5a58cd53e067cc22ab2e96db29b67c4ad7617f596c01c5c4061051' +
           'c42ee36fd9f8bd6b5de9fcf860828d7ed3c023e07fb123ee5df4360ff6bba0ceeb33a08122d85370b1957f45edbdb7e2f863907019429df58cfaa34ffebfdc75' +
           '207926553914fd72867e5272cfa8e1f1ebb696c9da98e600d796830ede6e1781b8b2be3a5e513ce8e5d27a45bf11447757893cd86ff482a1f53248731f8d5335' +
           'fdf8c03f718dc31d1548342b8431800eee1b4a4495d964675d794dc7d0a8db273409e93d8a9e5494d50d59de4fb81715ed05d76cf3a80551acf06951a1810964' +
           '11b35088db6dbad09d9af22b8c6e041cabc80ac746d288808e1b8ecd74810132e6d029effc650ca3b6f4c2181f9fbd5b2eb95fd6c96dda042f78f0ab1da5c2ef' +
           '9e5eb920b4fcc6d1d4bc30cc46f8d955653896ee90888f465c8dca60ce8358f75ec523667137a1a3d92e890f2c2bd0d4ef3acb74bea3632d589f54a0383036f2' +
           '7f47ca95be80bf8f2b5f59bd40b203719c92dd6cd2d1909bd5a54936cad532a961ba3cc9b2349f8218caeaf05c0d2347c87795459777e01a045cce9ef2f7e28c' +
           '6b9df0e49e1ea8ec089aa8470ab974a62c22b54172e27b0948cf69ac38e1f6824b08ceb0c2485206c34ee9c141a8f206e063e2c349a92b4985f772c8337ed5fd' +
           '1171d788d03714cd8f1b3a79190b592943d3c028bc9637ce6de1b6e456c04f87a52e8993c8537e6bdcc8dc6d5a0d4537730786cf6978c699284a39b0e0eb7fc4' +
           'd4f6bbd5aa45f629fd1c6490b266323a71db748ef53106a7f5efeab30f05de7fcd3f7696984d5c2310d36ea443b552d14f43eef48471e79f7dd84e9146d3c67a' +
           '2b0b7b00f4bccb7bf1ee938878ea6f611c8b67da158bb6338bce2092f278b17720f89e66932b303bd0d30ce43daaec8d666f18eeaa320543e706c75c5289cdc9' +
           'ecd0b9146358094de16b522fbd1cc1b5f1ee8aadf3538dde7b0bbdb3f2b305ac949877fe496e05c496424348d746c87dd65a216b81fbec63176ae215b58e2098' +
           'f84432a7e28869f24021406261503b8e40b2f0a2b0b2d351aaba62a0108df28a8c018b4b1289348e921e8af476e46e72bce670abb895f232718406e7994d52b2' +
           '1e359a0bf301d83d06b06fd46186754cd16900ae273722299afc081b97a0a6c5e99e223b9e633f80f5fc4b9cca6263819dbaac0cd243a7f6c68f740147f4b65c' +
           '57c84daf703890ffd3f82cede5dbe66a6c9d05a4eef3619656d839e200ac43ba265fd652687dd6e230ec9807e101235b99169626fc8345e48138a68b6ca6196e' +
           'df954a37b740b61c90b47774a21556a8fca3412c1a34a9fa0fa78626a9d781b886bba417008ef997a7500a61ca8c1a924498b1dba953c06ac33580b78e64d79a' +
           '90d6ca66e9a9700cde9cd212546da9d841281f1a487474a5b9b2035a3bff8ebb532733d95360f98491d6cc58a9f2dbe4bc0b44bffa3596d5548d9e15a16d025b' +
           '24f3853cd27db997053c09e40ee5c51a3357b741dfb70e8e2e310ac739c3d7e02f68dade6068c6641d0e6d5ce7a36c5e1f445d4a0a69b5bb6849aa87260abb88' +
           '22c71a0e98ebc86a3837b7f2039968cd1674a3229463a6a8ee55a3a82337886e9d753b4c8d15ebe6696b96d0168a42842d9af1ca42e10fc9ae165514ca42e7ce' +
           '12a4940e1593e7d018fc72a3b4aa506e1e517e61d962cdaf66fa4762ff5db337508e3e3dad9cccd254b43973eecb2c3eb79a16b0e99b26c72ab428a75b4cc78c' +
           '580e1f689193d6ce2b736e79fa4bcb4ddc01f41119f006bed479f4c795215587830cbac1e3a121f5dfe72b634827ed667603835b46e5fd3ff4cc591a031c19d7' +
           '2db585cdaa5b95add87e19b1d182370a8ee643bad9729768b97fbfd9e4c5a2c2d0ccb81063e9d919931983ffc11cf2052173308d5374cadb254eebaccb1c55d6' +
           'ca1db7f99ef4c439a9c27b602f79dc190009222d4c608768f7b3cd93573a1c125d87058662f972a3ea8a4788494561b0c5b13f3f5000824c393256def6568e23' +
           '5baf2427c7624b62422c267d20471698d4b7b9627e2837f233f3b1a5f542aa686857cf129c3742eeb2ba1f963a62ec6a69531b3aa4bb79f89344fb176c822519' +
           'ee7c1e6c700ed9bf3969d190edece2672eaffe76b39d76f33325773c9cf1e3348d505d8ccae648a794d9bde10000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
           '000000000000000000000000b6ce1d9332337302e07317248a7453aef1bd384f2b2e76f62ea1d20e19150f0230308e0be0bfe3c21ee75d25dc06b09638300000'
    }
  ];

  // ===== ALGORITHM =====

  const SET_NAMES = Object.keys(PARAMETER_SETS);

  // Which parameter set a key of a given length selects when none is named.
  // The lengths do not tell FAEST from FAEST-EM or s from f everywhere, so the
  // fast non-EM set is the default and the parameterSet property overrides it.
  const DEFAULT_BY_SECRET_KEY = { 32: 'FAEST-128f', 40: 'FAEST-192f', 48: 'FAEST-256f', 64: 'FAEST-EM-256f' };
  const DEFAULT_BY_PUBLIC_KEY = { 32: 'FAEST-128f', 48: 'FAEST-192f', 64: 'FAEST-EM-256f' };

  function Hex(h) {
    return OpCodes.Hex8ToBytes(h);
  }

  function Concat(a, b) {
    const out = new Array(a.length + b.length);
    for (let i = 0; i < a.length; ++i) out[i] = a[i];
    for (let i = 0; i < b.length; ++i) out[a.length + i] = b[i];
    return out;
  }

  function FlipBit(bytes, index, bit) {
    const out = bytes.slice();
    out[index] = XOR(out[index], SHL(1, bit));
    return out;
  }

  function BuildVectors() {
    const vectors = [];
    for (const e of KAT) {
      const p = PARAMETER_SETS[e.set];
      const msg = Hex(e.msg);
      const sm = Concat(msg, Hex(e.sig));
      vectors.push({
        text: e.set + ' ' + e.file + ' count ' + e.count + ': key generation from the harness seed and '
          + 'signing reproduce the published signed message (' + p.sigSize + ' byte signature)',
        uri: KAT_URL,
        parameterSet: e.set,
        drbgSeed: Hex(e.seed),
        key: Hex(e.sk),
        input: msg,
        expected: sm
      });
      vectors.push({
        text: e.set + ' ' + e.file + ' count ' + e.count + ': the published signed message opens '
          + 'under the published public key',
        uri: KAT_URL,
        parameterSet: e.set,
        inverse: true,
        publicKey: Hex(e.pk),
        input: sm,
        expected: msg
      });
    }

    // Verdicts. The positives come first so that a verifier which rejects
    // everything cannot pass on the negatives alone.
    const first = KAT[0];
    const msg = Hex(first.msg);
    const sig = Hex(first.sig);
    const sm = Concat(msg, sig);
    const pk = Hex(first.pk);
    const p = PARAMETER_SETS[first.set];
    const lay = Layout(p);
    const verdict = function (text, input, publicKey, parameterSet, expected) {
      return {
        text: text, uri: KAT_URL, parameterSet: parameterSet, inverse: true,
        publicKey: publicKey, message: msg, input: input, expected: [expected]
      };
    };
    vectors.push(verdict(first.set + ' count 0: the verdict on the published signature is acceptance',
      sm, pk, first.set, 1));
    vectors.push(verdict(first.set + ' count 0: the same signature opens when the public key is derived '
      + 'from the published secret key', sm, null, first.set, 1));
    vectors[vectors.length - 1].key = Hex(first.sk);
    delete vectors[vectors.length - 1].publicKey;
    vectors.push(verdict(first.set + ': a message with one bit flipped must not verify',
      FlipBit(sm, 5, 0), pk, first.set, 0));
    // One flipped bit in each part of the signature, offsets within the signature.
    const fields = [
      ['the first VOLE correction c', lay.c + 17],
      ['the masked hash u~', lay.uTilde + 3],
      ['the masked witness d', lay.d + 40],
      ['the proof value a1', lay.a1 + 1],
      ['the proof value a2', lay.a2 + 2],
      ['an opened commitment', lay.decom + 5],
      ['a co-path seed', lay.decom + p.comSize * p.tau + 3],
      ['the challenge', lay.chall3],
      ['the IV seed', lay.ivPre + 7],
      ['the grinding counter', lay.ctr]
    ];
    for (const f of fields) {
      vectors.push(verdict(first.set + ': a signature with one bit of ' + f[0] + ' flipped must not verify',
        FlipBit(sm, msg.length + f[1], 0), pk, first.set, 0));
    }
    vectors.push(verdict(first.set + ': count 0\'s signature must not verify under count 0\'s public key '
      + 'of FAEST-EM-128f, which has the same length', sm, Hex(KAT.find(e => e.set === 'FAEST-EM-128f').pk),
      first.set, 0));
    vectors.push(verdict(first.set + ': the signature must not verify under a public key with a flipped bit '
      + 'in its OWF output', sm, FlipBit(pk, 20, 3), first.set, 0));
    vectors.push(verdict(first.set + ': the signature must not verify as FAEST-128s, whose signature is '
      + 'shorter, so the message boundary moves', sm, pk, 'FAEST-128s', 0));
    return vectors;
  }

  class FAESTAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = 'FAEST';
      this.description = 'FAEST, the VOLE-in-the-head signature of the NIST additional-signatures process: '
        + 'a zero-knowledge proof of knowledge of an AES key k with AES_k(x) = y for a public (x, y), '
        + 'made non-interactive by Fiat-Shamir over SHAKE. All twelve second-round parameter sets, '
        + 'FAEST and FAEST-EM at 128, 192 and 256 bits in small and fast variants; key generation, '
        + 'signing and verification, checked against the submission\'s Known Answer Tests.';
      this.inventor = 'Carsten Baum, Ward Beullens, Lennart Braun, Cyprien Delpech de Saint Guilhem, '
        + 'Michael Klooß, Christian Majenz, Shibam Mukherjee, Emmanuela Orsini, Sebastian Ramacher, '
        + 'Christian Rechberger, Lawrence Roy, Peter Scholl';
      this.year = 2023;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Digital Signature';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // The key is the secret key: the OWF input followed by the OWF key.
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0),
        new KeySize(40, 40, 0),
        new KeySize(48, 48, 0),
        new KeySize(64, 64, 0)
      ];

      // Every parameter set, with its sizes, for a caller choosing one.
      this.parameterSets = SET_NAMES.map(name => {
        const p = PARAMETER_SETS[name];
        return { name: name, secretKeySize: p.skSize, publicKeySize: p.pkSize, signatureSize: p.sigSize };
      });

      this.documentation = [
        new LinkItem('FAEST specification v2.0 and submission package (NIST additional signatures, round 2)', KAT_URL),
        new LinkItem('FAEST project site', 'https://faest.info/'),
        new LinkItem('NIST PQC additional digital signature schemes, round 2',
          'https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures')
      ];

      this.references = [
        new LinkItem('FAEST reference implementation', 'https://github.com/faest-sign/faest-ref'),
        new LinkItem('Publicly Verifiable Zero-Knowledge and Post-Quantum Signatures From VOLE-in-the-Head (CRYPTO 2023)',
          'https://eprint.iacr.org/2023/996'),
        new LinkItem('FIPS 197 - Advanced Encryption Standard', 'https://doi.org/10.6028/NIST.FIPS.197-upd1'),
        new LinkItem('FIPS 202 - SHA-3 and the SHAKE functions', 'https://doi.org/10.6028/NIST.FIPS.202')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Under evaluation, not standardised',
          'FAEST is a second-round candidate of the NIST call for additional signatures. Its '
          + 'parameters changed between rounds - grinding and the batch all-but-one vector commitment '
          + 'arrived in version 2 - and first-round signatures do not verify here',
          'Treat it as experimental; use ML-DSA or SLH-DSA where a standard is required',
          'https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures'),
        new Vulnerability('Deterministic signing by default',
          'Without supplied randomness this implementation signs with an empty rho, the deterministic '
          + 'mode the specification permits. Deterministic signing is sound here, but a fault or '
          + 'side-channel attacker benefits from repeated identical computations',
          'Supply fresh randomness through the randomness property when the environment is exposed',
          'https://faest.info/'),
        new Vulnerability('Published demonstration keys',
          'The secret keys in the test vectors are printed in this file and come from published '
          + 'Known Answer Test data; they confer no secrecy',
          'Generate a secret key from a proper random source for any use beyond demonstration',
          KAT_URL)
      ];

      // Test vectors.
      //
      // Every expected value comes from the count = 0 record of a PQCsignKAT
      // file of the second-round package: the signed message, or the message a
      // signed message opens to, or a verdict on those published values with
      // one bit changed. The harness seed of each record is supplied as
      // drbgSeed, so a signing vector replays the harness - key generation
      // draws the OWF key and input, and must arrive at the published secret
      // key, then signing draws rho - and so pins key generation, the one-way
      // function, the vector commitment, the VOLE, the witness and the proof.
      //
      // Measured over the whole of all twelve response files, not only the
      // entries committed here: every one of the 1200 records reproduces its
      // secret key, public key and signed message octet for octet from its
      // seed, its published signature verifies, and the same signature is
      // rejected for a message with its first bit flipped.
      this.tests = BuildVectors();
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - true to open a signed message, false to sign
     * @returns {Object} New instance
     */
    CreateInstance(isInverse = false) {
      return new FAESTInstance(this, isInverse);
    }
  }

  /**
   * FAEST instance implementing the Feed/Result pattern of the NIST API.
   *
   * The forward direction is crypto_sign: it consumes a message and produces
   * the message followed by the signature. The inverse direction is
   * crypto_sign_open: it checks the signature a signed message carries and
   * returns the message, reporting a bad signature by throwing; with the
   * message property set it returns a verdict, [1] or [0], instead.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class FAESTInstance extends IAlgorithmInstance {
    /**
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - verification mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._set = null;
      this._keyData = null;
      this._publicKey = null;
      this._drbgSeed = null;
      this._randomness = null;
      this._message = null;
      this.inputBuffer = [];
    }

    /** The parameter set by name, e.g. 'FAEST-128s' or 'FAEST-EM-256f'. */
    set parameterSet(name) {
      if (name === null || name === undefined) { this._set = null; return; }
      if (!PARAMETER_SETS[name])
        throw new Error('FAEST: unknown parameter set ' + name + '; one of ' + SET_NAMES.join(', '));
      this._set = name;
    }

    get parameterSet() {
      return this._set;
    }

    /**
     * Install a secret key: the OWF input followed by the OWF key.
     * @param {uint8[]} keyData - 32, 40, 48 or 64 octets
     */
    KeySetup(keyData) {
      if (!keyData) { this._keyData = null; return; }
      if (typeof keyData.length !== 'number' || !DEFAULT_BY_SECRET_KEY[keyData.length])
        throw new Error('FAEST: a secret key is 32, 40, 48 or 64 octets');
      const copy = new Array(keyData.length);
      for (let i = 0; i < keyData.length; ++i) copy[i] = AND(keyData[i], 0xFF);
      this._keyData = copy;
    }

    set key(keyData) {
      this.KeySetup(keyData);
    }

    get key() {
      return this._keyData;
    }

    /** Verify against a public key alone. */
    set publicKey(value) {
      if (!value) { this._publicKey = null; return; }
      if (!DEFAULT_BY_PUBLIC_KEY[value.length])
        throw new Error('FAEST: a public key is 32, 48 or 64 octets');
      this._publicKey = Array.from(value);
    }

    /**
     * The public key: the one installed, or the one derived from the secret key.
     * @returns {uint8[]|null} the octets, or null
     */
    get publicKey() {
      if (this._publicKey) return this._publicKey.slice();
      if (!this._keyData) return null;
      const p = this._resolve(this._keyData.length, DEFAULT_BY_SECRET_KEY);
      return Array.from(PublicKeyOf(p, Uint8Array.from(this._keyData)));
    }

    /** The 48-octet seed of the NIST harness, to replay a Known Answer Test. */
    set drbgSeed(value) {
      if (!value) { this._drbgSeed = null; return; }
      if (value.length !== 48) throw new Error('FAEST: the harness seed is 48 octets');
      this._drbgSeed = Array.from(value);
    }

    get drbgSeed() {
      return this._drbgSeed;
    }

    /** The signer's randomness rho; empty (deterministic signing) by default. */
    set randomness(value) {
      this._randomness = value ? Array.from(value) : null;
    }

    get randomness() {
      return this._randomness;
    }

    /** Setting the message turns the inverse direction into a verdict. */
    set message(value) {
      this._message = value ? Array.from(value) : null;
    }

    get message() {
      return this._message;
    }

    _resolve(length, defaults) {
      const name = this._set || defaults[length];
      if (!name) throw new Error('FAEST: no parameter set takes a key of ' + length + ' octets');
      return PARAMETER_SETS[name];
    }

    /**
     * Feed data for processing. Appends, so a message split across several
     * calls signs identically to the same message delivered at once.
     * @param {uint8[]|string} data - input octets
     */
    Feed(data) {
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(AND(data.charCodeAt(i), 0xFF));
      } else if (data && typeof data.length === 'number') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
      } else if (typeof data === 'number') {
        this.inputBuffer.push(data);
      }
    }

    /**
     * Sign the fed message, or open the fed signed message.
     * @returns {uint8[]} message || signature, the message, or a verdict
     */
    Result() {
      const input = Uint8Array.from(this.inputBuffer);
      this.inputBuffer = [];
      return this.isInverse ? this._open(input) : this._sign(input);
    }

    _sign(message) {
      let sk = this._keyData ? Uint8Array.from(this._keyData) : null;
      let rho = this._randomness ? Uint8Array.from(this._randomness) : new Uint8Array(0);
      let p;
      if (this._drbgSeed) {
        p = this._set ? PARAMETER_SETS[this._set]
          : this._resolve(sk ? sk.length : 32, DEFAULT_BY_SECRET_KEY);
        const drbg = Drbg(Uint8Array.from(this._drbgSeed));
        const pair = KeypairFromDrbg(p, drbg);
        if (sk) {
          let diff = sk.length !== pair.sk.length ? 1 : 0;
          for (let i = 0; i < pair.sk.length && !diff; ++i) diff = OR(diff, XOR(sk[i], pair.sk[i]));
          if (diff) throw new Error(p.name + ': the harness seed does not generate this secret key');
        }
        sk = pair.sk;
        rho = drbg.read(p.lambdaBytes);
      } else {
        if (!sk) throw new Error('FAEST: signing needs a secret key');
        p = this._resolve(sk.length, DEFAULT_BY_SECRET_KEY);
      }
      if (sk.length !== p.skSize)
        throw new Error(p.name + ': the secret key is ' + p.skSize + ' octets, not ' + sk.length);
      if (!ValidOwfKey(p, sk))
        throw new Error(p.name + ': the OWF key has its two lowest bits set, which no key pair may');
      const signature = Sign(p, sk, message, rho);
      return Concat(Array.from(message), Array.from(signature));
    }

    _open(sm) {
      let pk, p;
      if (this._publicKey) {
        pk = Uint8Array.from(this._publicKey);
        p = this._resolve(pk.length, DEFAULT_BY_PUBLIC_KEY);
      } else if (this._keyData) {
        const sk = Uint8Array.from(this._keyData);
        p = this._resolve(sk.length, DEFAULT_BY_SECRET_KEY);
        if (sk.length !== p.skSize)
          throw new Error(p.name + ': the secret key is ' + p.skSize + ' octets, not ' + sk.length);
        pk = PublicKeyOf(p, sk);
      } else {
        throw new Error('FAEST: opening needs a public key or the secret key that makes one');
      }
      let accepted = false, message = null;
      if (pk.length === p.pkSize && sm.length >= p.sigSize) {
        message = sm.subarray(0, sm.length - p.sigSize);
        accepted = Verify(p, pk, message, sm.subarray(sm.length - p.sigSize));
      }
      if (this._message) {
        let same = accepted && message.length === this._message.length;
        for (let i = 0; same && i < message.length; ++i) same = message[i] === this._message[i];
        return [same ? 1 : 0];
      }
      if (!accepted) throw new Error(p.name + ': the signature does not verify');
      return Array.from(message);
    }

    /** Wipe the data held by this instance. */
    ClearData() {
      if (this._keyData) OpCodes.ClearArray(this._keyData);
      if (this._randomness) OpCodes.ClearArray(this._randomness);
      this._keyData = null;
      this._randomness = null;
      this._publicKey = null;
      this._drbgSeed = null;
      this._message = null;
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new FAESTAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    FAESTAlgorithm, FAESTInstance, PARAMETER_SETS,
    Shake, Prg, ExpandKey, RijndaelEncrypt, AesEncryptBlock, MakeField,
    Owf, PublicKeyOf, ExtendWitness, VoleCommit, VoleHash,
    Sign, Verify, Drbg, KeypairFromDrbg
  };
}));
