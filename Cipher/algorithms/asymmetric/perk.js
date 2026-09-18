/*
 * PERK Implementation
 * Permuted Kernel Problem signatures by MPC-in-the-Head
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PERK proves knowledge of a secret permutation pi solving an instance of the
 * Permuted Kernel Problem - given a matrix H over F_1021, vectors x_j and
 * targets y_j, find pi with H * pi(x_j) = y_j - and turns that proof into a
 * signature with the Fiat-Shamir transform. The proof is MPC-in-the-Head: each
 * of tau rounds splits pi into N random shares whose composition is pi, commits
 * to every share, is challenged for a random linear combination of the x_j,
 * and then opens all shares but one.
 *
 * This file implements the twelve parameter sets of version 2.0.0 of the
 * submission, all over F_1021:
 *
 *   perk-128-fast-3   n 79   m 35  t 3  tau 30  N 32    pk 148  sk 164  sig 8345
 *   perk-128-fast-5   n 83   m 36  t 5  tau 28  N 32    pk 241  sk 257
 *   perk-128-short-3  n 79   m 35  t 3  tau 20  N 256   pk 148  sk 164
 *   perk-128-short-5  n 83   m 36  t 5  tau 18  N 256   pk 241  sk 257
 *   perk-192-fast-3   n 112  m 54  t 3  tau 46  N 32
 *   perk-192-fast-5   n 116  m 55  t 5  tau 43  N 32
 *   perk-192-short-3  n 112  m 54  t 3  tau 31  N 256
 *   perk-192-short-5  n 116  m 55  t 5  tau 28  N 256
 *   perk-256-fast-3   n 146  m 75  t 3  tau 61  N 32
 *   perk-256-fast-5   n 150  m 76  t 5  tau 57  N 32
 *   perk-256-short-3  n 146  m 75  t 3  tau 41  N 256
 *   perk-256-short-5  n 150  m 76  t 5  tau 37  N 256
 *
 * Verified against the submission's own Known Answer Tests: every one of the
 * twelve PQCsignKAT files is reproduced record for record - the public key,
 * the secret key and the signed message of all 100 counts, byte for byte.
 * Those records are keyed by a 48 byte seed driving the NIST KAT AES-256
 * CTR_DRBG; the vectors committed below name the drawn randomness directly so
 * that they can be driven without one.
 *
 * Version 2.2.0 of PERK is a different construction - VOLE-in-the-head over a
 * tower of binary fields - and none of it is approximated by the code here.
 *
 * The submission's reference implementation, released into the public domain
 * by its authors, was used as the reference for the sampling order, the
 * commitment layout and the signature encoding.
 */

// Load AlgorithmFramework (REQUIRED)

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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  //#region ===== FIPS 202 =====
  //
  // PERK's every symmetric primitive is Keccak: a SHAKE for the pseudorandom
  // generators and a fixed-length SHA-3 for the commitments and the challenge
  // hashes, both chosen by the security level. The collection's FIPS 202
  // modules already agree with the published digests, so they are reused.

  const hashAlgorithms = {};

  /**
   * Resolve one of the collection's Keccak algorithms by name.
   *
   * The dependency is resolved on first use rather than while this file loads,
   * and that is deliberate. Both the README generator and the browser
   * script-tag checker attribute an algorithm to whichever source file was
   * being loaded when it registered, so a top-level require of the Keccak
   * modules would file the SHA-3 digests and the two SHAKEs under this
   * directory and drop them from the hash index.
   *
   * @param {string} name - the registered name
   * @returns {object} the algorithm
   */
  function findHash(name) {
    if (hashAlgorithms[name]) return hashAlgorithms[name];

    let found = AlgorithmFramework.Find ? AlgorithmFramework.Find(name) : null;

    if (!found && typeof require !== 'undefined') {
      for (const module of ['sha3', 'shake']) {
        try {
          require('../hash/' + module + '.js');
        } catch (e) {
          // already loaded, or a bundler without CommonJS
        }
      }
      found = AlgorithmFramework.Find ? AlgorithmFramework.Find(name) : null;
    }

    if (!found) throw new Error(name + ' is required by PERK and was not found');
    hashAlgorithms[name] = found;
    return found;
  }

  /**
   * A fixed-length SHA-3 digest.
   * @param {string} name - SHA-3-256, SHA-3-384 or SHA-3-512
   * @param {number[]} data - the input
   * @returns {number[]} the digest
   */
  function sha3(name, data) {
    const instance = findHash(name).CreateInstance();
    instance.Feed(data);
    return Array.from(instance.Result());
  }

  //#endregion

  //#region ===== A SHAKE THAT KEEPS SQUEEZING =====
  //
  // The collection's SHAKE module fixes the output length before the squeeze
  // starts and refuses anything above a kilobyte, which is ample for every
  // other caller and far too little here: expanding a PERK public seed alone
  // draws tens of thousands of bytes from one generator, and the rejection
  // samplers do not know in advance how many they will need. So the sponge is
  // carried here, as a state that can be squeezed again rather than as a
  // second implementation of the digests - the fixed-length SHA-3 calls above
  // still go to the shared module, and the sponge below is checked against it.
  //
  // State is 25 lanes of 64 bits held as two 32 bit halves, low and high.

  const KECCAK_ROUNDS = 24;

  // Rho offsets and the destination of the pi permutation, both indexed by the
  // lane number x + 5y. Pi sends (x, y) to (y, 2x + 3y).
  const RHO_OFFSETS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43,
                       25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

  const PI_DESTINATION = (() => {
    const table = new Array(25);
    for (let i = 0; i < 25; i++) {
      const x = i % 5;
      const y = Math.floor(i / 5);
      table[i] = y + 5 * ((2 * x + 3 * y) % 5);
    }
    return table;
  })();

  // The round constants are the standard FIPS 202 ones, derived from the
  // eight bit linear feedback shift register the standard defines rather than
  // transcribed, so the table cannot disagree with its own definition.
  const ROUND_CONSTANTS = (() => {
    const bit = t => {
      const steps = t % 255;
      if (steps === 0) return 1;
      let register = 1;
      for (let i = 1; i <= steps; i++) {
        register = register * 2;
        if (register >= 0x100) register = OpCodes.Xor32(register, 0x171);
      }
      return OpCodes.And32(register, 1);
    };

    const low = new Array(KECCAK_ROUNDS);
    const high = new Array(KECCAK_ROUNDS);
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      let lo = 0;
      let hi = 0;
      for (let j = 0; j <= 6; j++) {
        if (!bit(j + 7 * round)) continue;
        const position = Math.pow(2, j) - 1;
        if (position < 32) lo = OpCodes.Or32(lo, OpCodes.Shl32(1, position));
        else hi = OpCodes.Or32(hi, OpCodes.Shl32(1, position - 32));
      }
      low[round] = lo;
      high[round] = hi;
    }
    return { low: low, high: high };
  })();

  /**
   * The Keccak-f[1600] permutation, in place.
   * @param {number[]} lo - the 25 low halves
   * @param {number[]} hi - the 25 high halves
   */
  function keccakPermute(lo, hi) {
    const columnLo = new Array(5);
    const columnHi = new Array(5);
    const rotatedLo = new Array(25);
    const rotatedHi = new Array(25);

    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // theta
      for (let x = 0; x < 5; x++) {
        let l = lo[x];
        let h = hi[x];
        for (let y = 1; y < 5; y++) {
          l = OpCodes.Xor32(l, lo[x + 5 * y]);
          h = OpCodes.Xor32(h, hi[x + 5 * y]);
        }
        columnLo[x] = l;
        columnHi[x] = h;
      }

      for (let x = 0; x < 5; x++) {
        const left = (x + 4) % 5;
        const right = (x + 1) % 5;
        const dLo = OpCodes.Xor32(columnLo[left],
          OpCodes.Or32(OpCodes.Shl32(columnLo[right], 1), OpCodes.Shr32(columnHi[right], 31)));
        const dHi = OpCodes.Xor32(columnHi[left],
          OpCodes.Or32(OpCodes.Shl32(columnHi[right], 1), OpCodes.Shr32(columnLo[right], 31)));
        for (let y = 0; y < 5; y++) {
          lo[x + 5 * y] = OpCodes.Xor32(lo[x + 5 * y], dLo);
          hi[x + 5 * y] = OpCodes.Xor32(hi[x + 5 * y], dHi);
        }
      }

      // rho and pi
      for (let i = 0; i < 25; i++) {
        const shift = RHO_OFFSETS[i];
        const destination = PI_DESTINATION[i];
        if (shift === 0) {
          rotatedLo[destination] = lo[i];
          rotatedHi[destination] = hi[i];
        } else if (shift < 32) {
          rotatedLo[destination] = OpCodes.Or32(OpCodes.Shl32(lo[i], shift), OpCodes.Shr32(hi[i], 32 - shift));
          rotatedHi[destination] = OpCodes.Or32(OpCodes.Shl32(hi[i], shift), OpCodes.Shr32(lo[i], 32 - shift));
        } else if (shift === 32) {
          rotatedLo[destination] = hi[i];
          rotatedHi[destination] = lo[i];
        } else {
          const rest = shift - 32;
          rotatedLo[destination] = OpCodes.Or32(OpCodes.Shl32(hi[i], rest), OpCodes.Shr32(lo[i], 32 - rest));
          rotatedHi[destination] = OpCodes.Or32(OpCodes.Shl32(lo[i], rest), OpCodes.Shr32(hi[i], 32 - rest));
        }
      }

      // chi
      for (let y = 0; y < 5; y++) {
        const base = 5 * y;
        for (let x = 0; x < 5; x++) {
          const next = base + (x + 1) % 5;
          const after = base + (x + 2) % 5;
          lo[base + x] = OpCodes.Xor32(rotatedLo[base + x],
            OpCodes.And32(OpCodes.Xor32(rotatedLo[next], 0xFFFFFFFF), rotatedLo[after]));
          hi[base + x] = OpCodes.Xor32(rotatedHi[base + x],
            OpCodes.And32(OpCodes.Xor32(rotatedHi[next], 0xFFFFFFFF), rotatedHi[after]));
        }
      }

      // iota
      lo[0] = OpCodes.Xor32(lo[0], ROUND_CONSTANTS.low[round]);
      hi[0] = OpCodes.Xor32(hi[0], ROUND_CONSTANTS.high[round]);
    }
  }

  /**
   * A SHAKE sponge that has already absorbed its whole input and can be
   * squeezed as often as the caller likes.
   */
  class ShakeStream {
    /**
     * @param {number} rate - the rate in bytes, 168 for SHAKE128 and 136 for SHAKE256
     * @param {number[]} input - the message, absorbed in full
     */
    constructor(rate, input) {
      this.rate = rate;
      this.lo = zeros(25);
      this.hi = zeros(25);

      const padded = input.slice();
      padded.push(0x1F);
      while (padded.length % rate !== 0) padded.push(0x00);
      padded[padded.length - 1] = OpCodes.Or32(padded[padded.length - 1], 0x80);

      for (let block = 0; block < padded.length; block += rate) {
        for (let i = 0; i < rate; i += 8) {
          const laneIndex = Math.floor(i / 8);
          let l = 0;
          let h = 0;
          for (let j = 3; j >= 0; j--) l = OpCodes.Or32(OpCodes.Shl32(l, 8), padded[block + i + j]);
          for (let j = 7; j >= 4; j--) h = OpCodes.Or32(OpCodes.Shl32(h, 8), padded[block + i + j]);
          this.lo[laneIndex] = OpCodes.Xor32(this.lo[laneIndex], l);
          this.hi[laneIndex] = OpCodes.Xor32(this.hi[laneIndex], h);
        }
        keccakPermute(this.lo, this.hi);
      }

      this.block = this._extract();
      this.offset = 0;
    }

    /** The current state's first `rate` bytes. */
    _extract() {
      const out = new Array(this.rate);
      for (let i = 0; i < this.rate; i += 8) {
        const laneIndex = Math.floor(i / 8);
        const l = this.lo[laneIndex];
        const h = this.hi[laneIndex];
        for (let j = 0; j < 4 && i + j < this.rate; j++)
          out[i + j] = OpCodes.And32(OpCodes.Shr32(l, 8 * j), 0xFF);
        for (let j = 0; j < 4 && i + 4 + j < this.rate; j++)
          out[i + 4 + j] = OpCodes.And32(OpCodes.Shr32(h, 8 * j), 0xFF);
      }
      return out;
    }

    /**
     * Squeeze the next `count` bytes.
     * @param {number} count - how many bytes
     * @returns {number[]} the bytes
     */
    Squeeze(count) {
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        if (this.offset === this.rate) {
          keccakPermute(this.lo, this.hi);
          this.block = this._extract();
          this.offset = 0;
        }
        out[i] = this.block[this.offset++];
      }
      return out;
    }
  }

  //#endregion

  //#region ===== PARAMETER SETS =====

  const PARAM_Q = 1021;
  const PARAM_Q_BITS = 10;

  // Domain separators. Each is the last byte absorbed before the digest is
  // taken, or before a generator starts squeezing.
  const DOMAIN_H0 = 0x00;   // commitments
  const DOMAIN_H1 = 0x01;   // first challenge hash
  const DOMAIN_H2 = 0x02;   // second challenge hash
  const DOMAIN_H3 = 0x03;   // seed tree expansion
  const DOMAIN_PRG1 = 0x04;
  const DOMAIN_PRG2 = 0x05;

  // The two families differ in how the opened permutation is written down:
  // the fast sets pack two coefficients into one small field, while the short
  // sets - which run many more rounds and so pay for every byte - rank the
  // permutation into a factorial-base integer.
  const RAW_PARAMETERS = {
    'perk-128-fast-3':  { security: 16, n1: 79,  m: 35, t: 3, tau: 30, N: 32,  permBits: 13 },
    'perk-128-fast-5':  { security: 16, n1: 83,  m: 36, t: 5, tau: 28, N: 32,  permBits: 13 },
    'perk-128-short-3': { security: 16, n1: 79,  m: 35, t: 3, tau: 20, N: 256, ranked: true },
    'perk-128-short-5': { security: 16, n1: 83,  m: 36, t: 5, tau: 18, N: 256, ranked: true },
    'perk-192-fast-3':  { security: 24, n1: 112, m: 54, t: 3, tau: 46, N: 32,  permBits: 14 },
    'perk-192-fast-5':  { security: 24, n1: 116, m: 55, t: 5, tau: 43, N: 32,  permBits: 14 },
    'perk-192-short-3': { security: 24, n1: 112, m: 54, t: 3, tau: 31, N: 256, ranked: true },
    'perk-192-short-5': { security: 24, n1: 116, m: 55, t: 5, tau: 28, N: 256, ranked: true },
    'perk-256-fast-3':  { security: 32, n1: 146, m: 75, t: 3, tau: 61, N: 32,  permBits: 15 },
    'perk-256-fast-5':  { security: 32, n1: 150, m: 76, t: 5, tau: 57, N: 32,  permBits: 15 },
    'perk-256-short-3': { security: 32, n1: 146, m: 75, t: 3, tau: 41, N: 256, ranked: true },
    'perk-256-short-5': { security: 32, n1: 150, m: 76, t: 5, tau: 37, N: 256, ranked: true }
  };

  // Two permutation coefficients share one field of permBits bits, written as
  // c1 * radix + c0. Fourteen bits is the one case where the two halves are
  // simply seven bits each, which is the same rule with a radix of 128.
  const PERM_RADIX = { 13: 90, 14: 128, 15: 181 };

  /** Fill in everything the specification leaves implicit for one set. */
  function deriveParameters(name) {
    const raw = RAW_PARAMETERS[name];
    const P = {
      name: name,
      securityBytes: raw.security,
      n1: raw.n1,
      m: raw.m,
      t: raw.t,
      tau: raw.tau,
      N: raw.N,
      ranked: raw.ranked === true,
      permBits: raw.permBits,
      permRadix: PERM_RADIX[raw.permBits]
    };

    if (P.ranked) {
      // The rank is a number below n1!, and the counting tree it is built with
      // is a complete binary tree with at least n1 leaves.
      P.factorials = new Array(P.n1 + 1);
      P.factorials[0] = 1n;
      for (let i = 1; i <= P.n1; i++) P.factorials[i] = P.factorials[i - 1] * BigInt(i);
      P.rankBits = Math.ceil(Math.log(P.n1) / Math.log(2));
      P.rankedBytes = Math.floor((P.factorials[P.n1].toString(2).length - 1) / 8) + 1;
    }

    P.seedBytes = P.securityBytes;
    P.saltBytes = 2 * P.securityBytes;
    P.hashBytes = 2 * P.securityBytes;
    P.commitmentBytes = P.hashBytes;
    P.treeLevels = Math.round(Math.log(P.N) / Math.log(2));
    P.nMask = P.N - 1;

    // SHAKE128 at the lowest level, SHAKE256 above it; the SHA-3 digest is the
    // one whose output is exactly two seeds wide.
    P.shakeRate = P.securityBytes === 16 ? 168 : 136;
    P.sha3 = P.securityBytes === 16 ? 'SHA-3-256' : (P.securityBytes === 24 ? 'SHA-3-384' : 'SHA-3-512');

    P.publicKeyBytes = P.seedBytes + Math.floor((P.m * PARAM_Q_BITS * P.t + 7) / 8);
    P.privateKeyBytes = P.seedBytes + P.publicKeyBytes;

    P.z1Bytes = Math.floor((P.tau * P.n1 * PARAM_Q_BITS + 7) / 8);
    P.z2Bytes = P.ranked
      ? P.rankedBytes * P.tau
      : Math.floor((P.tau * P.n1 * P.permBits / 2 + 7) / 8);
    P.signatureBytes = P.saltBytes + 2 * P.commitmentBytes
      + (P.commitmentBytes + P.seedBytes * P.treeLevels) * P.tau
      + P.z1Bytes + P.z2Bytes;

    // The encoder writes whole bytes, so the last byte of each packed block
    // carries bits the decoder must see as zero.
    P.z1UnusedMask = 0xFF - (Math.pow(2, ((P.tau * P.n1 * PARAM_Q_BITS + 7) % 8) + 1) - 1);
    P.z2UnusedMask = P.ranked
      ? 0
      : 0xFF - (Math.pow(2, ((P.tau * P.n1 * P.permBits / 2 + 7) % 8) + 1) - 1);

    return P;
  }

  const PARAMETER_SETS = {};
  for (const name of Object.keys(RAW_PARAMETERS)) PARAMETER_SETS[name] = deriveParameters(name);

  /**
   * Look up a parameter set by name, tolerating the spellings people use.
   * @param {string|number} label - a set name
   * @returns {object|null} the parameter set
   */
  function findParameterSet(label) {
    const text = String(label).trim();
    if (PARAMETER_SETS[text]) return PARAMETER_SETS[text];

    const lower = text.toLowerCase().replace(/^perk[-_]?/, '');
    for (const name of Object.keys(PARAMETER_SETS)) {
      if (name.slice(5) === lower) return PARAMETER_SETS[name];
    }
    return null;
  }

  /**
   * Look up a parameter set by the encoded length of one of its objects.
   * @param {number} length - the byte length seen
   * @param {string} field - which size to match
   * @returns {object|null} the parameter set
   */
  function parameterSetByLength(length, field) {
    for (const name of Object.keys(PARAMETER_SETS)) {
      if (PARAMETER_SETS[name][field] === length) return PARAMETER_SETS[name];
    }
    return null;
  }

  //#endregion

  //#region ===== SMALL HELPERS =====

  /** An array of `n` zeros. */
  function zeros(n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = 0;
    return out;
  }

  /** Append every element of `source` to `target`. */
  function appendAll(target, source) {
    for (let i = 0; i < source.length; i++) target.push(source[i]);
    return target;
  }

  /** Encode an array of values below 65536 as little-endian 16 bit words. */
  function toLittleEndian16(values) {
    const out = new Array(values.length * 2);
    for (let i = 0; i < values.length; i++) {
      out[2 * i] = values[i] % 256;
      out[2 * i + 1] = Math.floor(values[i] / 256) % 256;
    }
    return out;
  }

  /**
   * Read the `index`-th field of `bits` bits from an LSB-first bit stream.
   * @param {number[]} bytes - the packed bytes
   * @param {number} offset - where the stream starts
   * @param {number} index - which field
   * @param {number} bits - the field width
   * @returns {number} the value
   */
  function getBits(bytes, offset, index, bits) {
    let position = index * bits;
    let remaining = bits;
    let value = 0;
    let scale = 1;

    while (remaining > 0) {
      const byteIndex = offset + Math.floor(position / 8);
      const bitInByte = position % 8;
      const take = Math.min(8 - bitInByte, remaining);
      const chunk = Math.floor(bytes[byteIndex] / Math.pow(2, bitInByte)) % Math.pow(2, take);
      value += chunk * scale;
      scale *= Math.pow(2, take);
      remaining -= take;
      position += take;
    }

    return value;
  }

  /**
   * Write the `index`-th field of `bits` bits into an LSB-first bit stream.
   * Fields must be written in increasing order into a zeroed buffer.
   * @param {number[]} bytes - the packed bytes
   * @param {number} offset - where the stream starts
   * @param {number} index - which field
   * @param {number} bits - the field width
   * @param {number} value - the value to store
   */
  function putBits(bytes, offset, index, bits, value) {
    let position = index * bits;
    let remaining = bits;
    let rest = value % Math.pow(2, bits);

    while (remaining > 0) {
      const byteIndex = offset + Math.floor(position / 8);
      const bitInByte = position % 8;
      const take = Math.min(8 - bitInByte, remaining);
      const chunk = rest % Math.pow(2, take);
      bytes[byteIndex] += chunk * Math.pow(2, bitInByte);
      rest = Math.floor(rest / Math.pow(2, take));
      remaining -= take;
      position += take;
    }
  }

  //#endregion

  //#region ===== PSEUDORANDOM GENERATORS AND HASHES =====

  /**
   * A PERK pseudorandom generator: a SHAKE over the optional salt, the
   * optional seed and a domain byte, squeezed on demand.
   *
   * SHAKE output is a stream whose prefixes are stable, so an exhausted buffer
   * is refilled by asking for more of the same stream rather than by chaining.
   *
   * @param {object} P - parameter set
   * @param {number} domain - the domain separator byte
   * @param {number[]|null} salt - absorbed first when present
   * @param {number[]|null} seed - absorbed next when present
   * @returns {object} a generator with bytes(n) and word16()
   */
  function makeGenerator(P, domain, salt, seed) {
    const input = [];
    if (salt) appendAll(input, salt);
    if (seed) appendAll(input, seed);
    input.push(domain);

    const stream = new ShakeStream(P.shakeRate, input);

    return {
      /**
       * Take the next `count` bytes of the stream.
       * @param {number} count - how many bytes
       * @returns {number[]} the bytes
       */
      bytes: function(count) {
        return stream.Squeeze(count);
      },

      /**
       * Take the next little-endian 16 bit word of the stream.
       * @returns {number} the word
       */
      word16: function() {
        const pair = stream.Squeeze(2);
        return pair[0] + 256 * pair[1];
      }
    };
  }

  /**
   * Take one of PERK's keyed digests.
   *
   * Every one of them absorbs the salt, then up to two counter bytes, then the
   * message, then the domain byte.
   *
   * @param {object} P - parameter set
   * @param {number[]} salt - the salt
   * @param {number[]} counters - zero, one or two counter bytes
   * @param {number[][]} parts - the message pieces
   * @param {number} domain - the domain separator byte
   * @returns {number[]} the digest
   */
  function keyedDigest(P, salt, counters, parts, domain) {
    const input = salt.slice();
    appendAll(input, counters);
    for (let i = 0; i < parts.length; i++) appendAll(input, parts[i]);
    input.push(domain);
    return sha3(P.sha3, input);
  }

  //#endregion

  //#region ===== PERMUTATIONS =====
  //
  // A permutation is an array p with p[i] the image of i. The reference sorts
  // 32 bit words whose high half is the sort key and whose low half is the
  // payload; sorting index pairs by (key, index) is the same order and is
  // written out directly here.

  /** Sort the indices 0..n-1 by key, ties broken by the index itself. */
  function rankByKey(keys) {
    const order = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) order[i] = i;
    order.sort((a, b) => (keys[a] - keys[b]) || (a - b));
    return order;
  }

  /**
   * Turn n1 sampled 16 bit words into a permutation, refusing the draw when
   * two of them collide.
   * @param {number[]} words - the sampled words
   * @param {object} P - parameter set
   * @returns {number[]|null} the permutation, or null when the draw collided
   */
  function permutationFromWords(words, P) {
    const order = rankByKey(words);
    for (let i = 1; i < P.n1; i++) {
      if (words[order[i - 1]] === words[order[i]]) return null;
    }
    return order;
  }

  /**
   * Draw a permutation from a generator, redrawing on a collision.
   * @param {object} generator - the generator to draw from
   * @param {object} P - parameter set
   * @returns {number[]} the permutation
   */
  function samplePermutation(generator, P) {
    for (;;) {
      const words = new Array(P.n1);
      for (let i = 0; i < P.n1; i++) words[i] = generator.word16();
      const permutation = permutationFromWords(words, P);
      if (permutation) return permutation;
    }
  }

  /** Apply a permutation to a vector: out[p[i]] = in[i]. */
  function permuteVector(p, input) {
    const out = new Array(input.length);
    for (let i = 0; i < input.length; i++) out[p[i]] = input[i];
    return out;
  }

  /** The inverse permutation. */
  function invertPermutation(p) {
    const out = new Array(p.length);
    for (let i = 0; i < p.length; i++) out[p[i]] = i;
    return out;
  }

  /** The composition p1 after p2: out[i] = p1[p2[i]]. */
  function composePermutations(p1, p2) {
    const out = new Array(p1.length);
    for (let i = 0; i < p1.length; i++) out[i] = p1[p2[i]];
    return out;
  }

  /** The composition p1 after the inverse of p2: out[p2[i]] = p1[i]. */
  function composeWithInverse(p1, p2) {
    const out = new Array(p1.length);
    for (let i = 0; i < p1.length; i++) out[p2[i]] = p1[i];
    return out;
  }

  /** The identity permutation on n1 points. */
  function identityPermutation(P) {
    const out = new Array(P.n1);
    for (let i = 0; i < P.n1; i++) out[i] = i;
    return out;
  }

  /** Is this array a permutation of 0..n1-1? */
  function permutationValid(p, P) {
    const seen = zeros(P.n1);
    for (let i = 0; i < P.n1; i++) {
      if (p[i] >= P.n1) return false;
      if (seen[p[i]]) return false;
      seen[p[i]] = 1;
    }
    return true;
  }

  /**
   * Rank a permutation into a factorial-base integer, the encoding the short
   * parameter sets use for the opened share.
   *
   * The i-th digit counts how many of the still unused points lie below p[i],
   * and a complete binary counting tree over the points supplies that count in
   * logarithmic time. The digits are then read as a mixed-radix number.
   *
   * @param {number[]} p - the permutation
   * @param {object} P - parameter set
   * @returns {number[]} the ranked bytes, little endian
   */
  function rankPermutation(p, P) {
    const counts = zeros(Math.pow(2, P.rankBits + 1) - 1);
    let code = 0n;

    for (let i = 0; i < P.n1; i++) {
      let digit = p[i];
      let node = Math.pow(2, P.rankBits) + p[i];
      for (let j = 0; j < P.rankBits; j++) {
        if (node % 2 === 1) digit -= counts[2 * Math.floor(node / 2)];
        counts[node] += 1;
        node = Math.floor(node / 2);
      }
      counts[node] += 1;
      code = code * BigInt(P.n1 - i) + BigInt(digit);
    }

    const out = new Array(P.rankedBytes);
    let rest = code;
    for (let i = 0; i < P.rankedBytes; i++) {
      out[i] = Number(OpCodes.AndN(rest, 0xFFn));
      rest = OpCodes.ShiftRn(rest, 8);
    }
    return out;
  }

  /**
   * Recover a permutation from its factorial-base rank.
   * @param {number[]} bytes - the ranked bytes
   * @param {number} offset - where they start
   * @param {object} P - parameter set
   * @returns {number[]|null} the permutation, or null when the rank is too big
   */
  function unrankPermutation(bytes, offset, P) {
    let code = 0n;
    for (let i = P.rankedBytes - 1; i >= 0; i--) {
      code = OpCodes.OrN(OpCodes.ShiftLn(code, 8), BigInt(OpCodes.And8(bytes[offset + i], 0xFF)));
    }
    if (code >= P.factorials[P.n1]) return null;

    const digits = new Array(P.n1);
    for (let i = 0; i < P.n1; i++) {
      const radix = P.factorials[P.n1 - 1 - i];
      digits[i] = Number(code / radix);
      code = code % radix;
    }

    const counts = new Array(Math.pow(2, P.rankBits + 1) - 1);
    for (let level = 0; level <= P.rankBits; level++) {
      const width = Math.pow(2, level);
      for (let j = 0; j < width; j++) counts[width + j - 1] = Math.pow(2, P.rankBits - level);
    }

    const out = new Array(P.n1);
    for (let i = 0; i < P.n1; i++) {
      let digit = digits[i];
      let node = 1;
      for (let j = 0; j < P.rankBits; j++) {
        counts[node] -= 1;
        node *= 2;
        if (digit >= counts[node]) {
          digit -= counts[node];
          node += 1;
        }
      }
      counts[node] = 0;
      out[i] = node - Math.pow(2, P.rankBits);
    }

    return out;
  }

  /**
   * Derive pi_1 so that the composition of all N shares is the secret pi.
   * @param {number[][]} shares - the N share permutations, entry 0 unset
   * @param {number[]} pi - the secret permutation
   */
  function derivateFirstShare(shares, pi) {
    let first = invertPermutation(shares[1]);
    for (let i = 2; i < shares.length; i++) first = composeWithInverse(first, shares[i]);
    shares[0] = composePermutations(first, pi);
  }

  //#endregion

  //#region ===== ARITHMETIC OVER F_1021 =====

  /** Componentwise sum of two reduced vectors. */
  function vectorAdd(a, b) {
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const s = a[i] + b[i];
      out[i] = s >= PARAM_Q ? s - PARAM_Q : s;
    }
    return out;
  }

  /** Componentwise difference of two reduced vectors. */
  function vectorSubtract(a, b) {
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      out[i] = d < 0 ? d + PARAM_Q : d;
    }
    return out;
  }

  /** A vector scaled by a field element. */
  function vectorScale(scalar, v) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = (scalar * v[i]) % PARAM_Q;
    return out;
  }

  /** The matrix-vector product H * v over F_1021. */
  function matrixVectorMultiply(H, v, P) {
    const out = new Array(P.m);
    for (let i = 0; i < P.m; i++) {
      let accumulator = 0;
      const row = H[i];
      for (let j = 0; j < P.n1; j++) accumulator += row[j] * v[j];
      out[i] = accumulator % PARAM_Q;
    }
    return out;
  }

  /** The inverse of a non-zero field element. */
  function fieldInverse(a) {
    let result = 1;
    let base = a;
    let exponent = PARAM_Q - 2;
    while (exponent > 0) {
      if (exponent % 2 === 1) result = (result * base) % PARAM_Q;
      base = (base * base) % PARAM_Q;
      exponent = Math.floor(exponent / 2);
    }
    return result;
  }

  /**
   * The rank test the sampler uses to reject a dependent set of x vectors.
   *
   * The elimination is carried out the way the reference carries it out, in
   * 16 bit words that are allowed to wrap rather than being reduced, because
   * what has to agree with the submission is which draws it rejects rather
   * than the rank of anything.
   *
   * @param {number[][]} vectors - the t vectors
   * @param {object} P - parameter set
   * @returns {number} the computed rank
   */
  function computeRank(vectors, P) {
    const x = [];
    for (let i = 0; i < P.t; i++) x.push(vectors[i].slice());

    let rank = 0;
    for (let col = 0; col < P.n1; col++) {
      let pivot = -1;
      for (let i = rank; i < P.t; i++) {
        if (x[i][col] !== 0) {
          pivot = i;
          break;
        }
      }

      if (pivot >= 0) {
        const swap = x[rank];
        x[rank] = x[pivot];
        x[pivot] = swap;

        const inverse = fieldInverse(x[rank][col]);
        for (let row = rank + 1; row < P.t; row++) {
          const multiplier = (x[row][col] * inverse) % PARAM_Q;
          for (let i = col; i < P.n1; i++) {
            x[row][i] = OpCodes.And16(x[row][i] - (multiplier * x[rank][i]) % PARAM_Q, 0xFFFF);
          }
        }
        rank++;
      }

      if (rank === P.t) break;
    }

    return rank;
  }

  /**
   * Draw one field element by rejection from a generator.
   * @param {object} generator - the generator
   * @returns {number} a value below 1021
   */
  function sampleFieldElement(generator) {
    for (;;) {
      const candidate = OpCodes.And16(generator.word16(), 0x3FF);
      if (candidate < PARAM_Q) return candidate;
    }
  }

  /**
   * Draw `count` field elements the way the reference draws them: a whole
   * generator block at a time, rejecting the words that land outside the
   * field, and abandoning whatever is left of the last block once the count is
   * reached. The abandoned tail matters - the next thing drawn from the same
   * generator starts on a block boundary, not where this left off.
   *
   * @param {object} generator - the generator
   * @param {number} count - how many elements
   * @param {object} P - parameter set
   * @returns {number[]} the elements
   */
  function sampleBlockwise(generator, count, P) {
    const wordsPerBlock = Math.floor(P.shakeRate / 2);
    const out = new Array(count);
    let produced = 0;

    while (produced < count) {
      const block = generator.bytes(P.shakeRate);
      let word = 0;
      while (produced < count && word < wordsPerBlock) {
        const candidate = OpCodes.And16(block[2 * word] + 256 * block[2 * word + 1], 0x3FF);
        word++;
        if (candidate < PARAM_Q) out[produced++] = candidate;
      }
    }

    return out;
  }

  /** Cut a flat run of elements into rows of n1. */
  function intoRows(values, rows, P) {
    const out = new Array(rows);
    for (let i = 0; i < rows; i++) out[i] = values.slice(i * P.n1, (i + 1) * P.n1);
    return out;
  }

  /**
   * Expand a public seed into the matrix H and the t vectors x.
   * @param {number[]} seed - the public seed
   * @param {object} P - parameter set
   * @returns {object} { H, x }
   */
  function expandPublicSeed(seed, P) {
    const generator = makeGenerator(P, DOMAIN_PRG1, null, seed);

    const H = intoRows(sampleBlockwise(generator, P.m * P.n1, P), P.m, P);

    // The x vectors are redrawn until they are linearly independent. The
    // reference's retry keeps the vectors it already has, so a set that failed
    // could never be replaced; it has never had to be, and a draw that did
    // fail is reported rather than looped on forever.
    const x = intoRows(sampleBlockwise(generator, P.t * P.n1, P), P.t, P);

    if (computeRank(x, P) !== P.t)
      throw new Error('PERK: the sampled x vectors are not independent');

    return { H: H, x: x };
  }

  //#endregion

  //#region ===== SEED TREE =====
  //
  // The N leaf seeds of one round are the leaves of a binary tree grown from a
  // single root, so that opening all but one of them costs one seed per level
  // rather than N-1 seeds. A node's two children are the two halves of one
  // digest, the digest being exactly twice a seed wide at every security level.

  /**
   * Grow the whole tree from its root.
   * @param {number[]} salt - the signature salt
   * @param {number[]} root - the root seed
   * @param {object} P - parameter set
   * @returns {number[][]} the 2N-1 nodes, leaves last
   */
  function expandSeedTree(salt, root, P) {
    const tree = new Array(2 * P.N - 1);
    tree[0] = root.slice();

    for (let i = 0; i < P.N - 1; i++) {
      const digest = keyedDigest(P, salt, [OpCodes.And8(i, 0xFF)], [tree[i]], DOMAIN_H3);
      tree[2 * i + 1] = digest.slice(0, P.seedBytes);
      tree[2 * i + 2] = digest.slice(P.seedBytes, 2 * P.seedBytes);
    }

    return tree;
  }

  /**
   * The sibling seeds that let a verifier rebuild every leaf but `alpha`.
   * @param {number[][]} tree - the complete tree
   * @param {number} alpha - the withheld leaf, counted from zero
   * @param {object} P - parameter set
   * @returns {number[][]} one seed per level
   */
  function siblingSeeds(tree, alpha, P) {
    const out = new Array(P.treeLevels);
    for (let i = 0; i < P.treeLevels; i++) {
      const levelStart = Math.pow(2, i + 1) - 1;
      const node = OpCodes.Xor32(Math.floor(alpha / Math.pow(2, P.treeLevels - 1 - i)), 1);
      out[i] = tree[levelStart + node].slice();
    }
    return out;
  }

  /**
   * Rebuild every leaf but `alpha` from the sibling seeds.
   * @param {number[]} salt - the signature salt
   * @param {number[][]} seeds - one seed per level
   * @param {number} alpha - the withheld leaf, counted from zero
   * @param {object} P - parameter set
   * @returns {number[][]} the partially filled tree
   */
  function expandPartialSeedTree(salt, seeds, alpha, P) {
    const tree = new Array(2 * P.N - 1);
    for (let i = 0; i < tree.length; i++) tree[i] = zeros(P.seedBytes);

    let level = 0;
    let position = 0;
    for (let i = 0; i < P.N - 1; i++, position++) {
      if (position >= Math.pow(2, level)) {
        level++;
        position = 0;
      }

      const to = 2 * i + 1;
      const missing = Math.floor(alpha / Math.pow(2, P.treeLevels - level));
      const isRight = 1 - OpCodes.And8(Math.floor(alpha / Math.pow(2, P.treeLevels - 1 - level)), 1);

      if (position === missing) {
        tree[to + isRight] = seeds[level].slice();
      } else {
        const digest = keyedDigest(P, salt, [OpCodes.And8(i, 0xFF)], [tree[i]], DOMAIN_H3);
        tree[to] = digest.slice(0, P.seedBytes);
        tree[to + 1] = digest.slice(P.seedBytes, 2 * P.seedBytes);
      }
    }

    return tree;
  }

  //#endregion

  //#region ===== ONE ROUND OF THE PROOF =====

  /** The offset at which the leaf seeds start inside a tree. */
  function leafOffset(P) {
    return P.N - 1;
  }

  /**
   * Draw the N share permutations and the N masking vectors of one round.
   * Share 0's permutation is not drawn: it is derived from the secret.
   * @param {number[]} salt - the signature salt
   * @param {number[][]} tree - the round's seed tree
   * @param {object} P - parameter set
   * @returns {object} { shares, masks }
   */
  function expandRoundShares(salt, tree, P) {
    const shares = new Array(P.N);
    const masks = new Array(P.N);
    const offset = leafOffset(P);

    for (let i = 0; i < P.N; i++) {
      if (i !== 0) {
        const permutationGenerator = makeGenerator(P, DOMAIN_PRG1, salt, tree[offset + i]);
        shares[i] = samplePermutation(permutationGenerator, P);
      }
      // The masks come from a separately seeded generator so that a batched
      // implementation can draw the two kinds independently.
      const maskGenerator = makeGenerator(P, DOMAIN_PRG2, salt, tree[offset + i]);
      masks[i] = sampleBlockwise(maskGenerator, P.n1, P);
    }

    return { shares: shares, masks: masks };
  }

  /**
   * The aggregate masking vector the prover commits to.
   * @param {number[][]} shares - the N share permutations
   * @param {number[][]} masks - the N masking vectors
   * @param {number[]} pi - the secret permutation
   * @param {object} P - parameter set
   * @returns {number[]} the aggregate
   */
  function aggregateMask(shares, masks, pi, P) {
    let composed = composeWithInverse(pi, shares[0]);
    let out = permuteVector(composed, masks[0]);

    for (let i = 1; i < P.N - 1; i++) {
      composed = composeWithInverse(composed, shares[i]);
      out = vectorAdd(out, permuteVector(composed, masks[i]));
    }

    return vectorAdd(out, masks[P.N - 1]);
  }

  /**
   * Commit to each of the N shares.
   *
   * The commitments are stored in reverse order, from share N-1 down to share
   * 0, which is the order the challenge hash absorbs them in.
   *
   * @param {number[]} salt - the signature salt
   * @param {number} round - which round
   * @param {number[][]} tree - the round's seed tree
   * @param {number[]} firstShare - the derived permutation of share 0
   * @param {object} P - parameter set
   * @returns {number[][]} the N commitments, reversed
   */
  function commitToShares(salt, round, tree, firstShare, P) {
    const out = new Array(P.N);
    const offset = leafOffset(P);

    for (let i = 0; i < P.N; i++) {
      const counters = [OpCodes.And8(round, 0xFF), OpCodes.And8(i, 0xFF)];
      if (i === 0) {
        const permutationBytes = new Array(P.n1);
        for (let j = 0; j < P.n1; j++) permutationBytes[j] = OpCodes.And8(firstShare[j], 0xFF);
        out[P.N - 1] = keyedDigest(P, salt, counters, [permutationBytes, tree[offset]], DOMAIN_H0);
      } else {
        out[P.N - 1 - i] = keyedDigest(P, salt, counters, [tree[offset + i]], DOMAIN_H0);
      }
    }

    return out;
  }

  //#endregion

  //#region ===== KEYS =====

  /**
   * Build a key pair from the two drawn seeds.
   * @param {number[]} publicSeed - seedBytes of randomness
   * @param {number[]} privateSeed - seedBytes of randomness
   * @param {object} P - parameter set
   * @returns {object} { publicKey, privateKey }
   */
  function generateKeyPair(publicSeed, privateSeed, P) {
    if (publicSeed.length !== P.seedBytes || privateSeed.length !== P.seedBytes)
      throw new Error('PERK ' + P.name + ' needs two seeds of ' + P.seedBytes + ' bytes');

    const pi = samplePermutation(makeGenerator(P, DOMAIN_PRG1, null, privateSeed), P);
    const expanded = expandPublicSeed(publicSeed, P);

    const y = new Array(P.t);
    for (let i = 0; i < P.t; i++) {
      y[i] = matrixVectorMultiply(expanded.H, permuteVector(pi, expanded.x[i]), P);
    }

    const publicKey = publicSeed.slice();
    const packed = zeros(P.publicKeyBytes - P.seedBytes);
    for (let i = 0; i < P.m * P.t; i++) {
      putBits(packed, 0, i, PARAM_Q_BITS, y[Math.floor(i / P.m)][i % P.m]);
    }
    appendAll(publicKey, packed);

    const privateKey = privateSeed.slice();
    appendAll(privateKey, publicKey);

    return { publicKey: publicKey, privateKey: privateKey };
  }

  /**
   * Expand an encoded public key.
   * @param {number[]} bytes - the encoded key
   * @param {object} P - parameter set
   * @returns {object|null} { seed, H, x, y }, or null when it is malformed
   */
  function decodePublicKey(bytes, P) {
    const seed = bytes.slice(0, P.seedBytes);
    const y = new Array(P.t);
    for (let i = 0; i < P.t; i++) y[i] = new Array(P.m);

    for (let i = 0; i < P.m * P.t; i++) {
      const value = getBits(bytes, P.seedBytes, i, PARAM_Q_BITS);
      if (value >= PARAM_Q) return null;
      y[Math.floor(i / P.m)][i % P.m] = value;
    }

    const expanded = expandPublicSeed(seed, P);
    return { seed: seed, H: expanded.H, x: expanded.x, y: y };
  }

  //#endregion

  //#region ===== CHALLENGES =====

  /**
   * Derive the first challenge - a non-zero coefficient vector per round -
   * from the first challenge hash.
   * @param {number[]} h1 - the hash
   * @param {object} P - parameter set
   * @returns {number[][]} tau coefficient vectors
   */
  function firstChallenge(h1, P) {
    // Only the first seedBytes of the hash seed the generator. The hash is
    // twice that wide, and the submission's generator takes a seed rather than
    // a digest, so the second half never reaches the sponge; reproducing the
    // published challenges means reproducing that truncation.
    const generator = makeGenerator(P, DOMAIN_PRG1, null, h1.slice(0, P.seedBytes));
    const out = new Array(P.tau);

    for (let i = 0; i < P.tau; i++) {
      let kappa;
      let nonZero;
      do {
        kappa = new Array(P.t);
        nonZero = 0;
        for (let j = 0; j < P.t; j++) {
          kappa[j] = sampleFieldElement(generator);
          nonZero = OpCodes.Or16(nonZero, kappa[j]);
        }
      } while (nonZero === 0);
      out[i] = kappa;
    }

    return out;
  }

  /**
   * Derive the second challenge - which share each round withholds - from the
   * second challenge hash.
   * @param {number[]} h2 - the hash
   * @param {object} P - parameter set
   * @returns {number[]} tau indices in 1..N
   */
  function secondChallenge(h2, P) {
    // Truncated to a seed for the same reason as the first challenge.
    const generator = makeGenerator(P, DOMAIN_PRG1, null, h2.slice(0, P.seedBytes));
    const out = new Array(P.tau);
    for (let i = 0; i < P.tau; i++) out[i] = OpCodes.And16(generator.word16(), P.nMask) + 1;
    return out;
  }

  /**
   * The hash that fixes the first challenge.
   * @param {number[]} salt - the signature salt
   * @param {number[]} message - the message
   * @param {number[]} publicKeyBytes - the encoded public key
   * @param {object[]} rounds - the tau rounds, each with commitments and cmt1
   * @param {object} P - parameter set
   * @returns {object} { h1, prefix }
   */
  function computeFirstHash(salt, message, publicKeyBytes, rounds, P) {
    const prefix = salt.slice();
    appendAll(prefix, message);
    appendAll(prefix, publicKeyBytes);

    const input = prefix.slice();
    for (let i = 0; i < P.tau; i++) {
      for (let j = 0; j < P.N; j++) appendAll(input, rounds[i].commitments[j]);
      appendAll(input, rounds[i].aggregateCommitment);
    }
    input.push(DOMAIN_H1);

    return { h1: sha3(P.sha3, input), prefix: prefix };
  }

  /**
   * The hash that fixes the second challenge.
   * @param {number[]} prefix - salt, message and public key, already absorbed
   * @param {number[]} h1 - the first hash
   * @param {object[]} rounds - the tau rounds, each with its state chain
   * @param {object} P - parameter set
   * @returns {number[]} the hash
   */
  function computeSecondHash(prefix, h1, rounds, P) {
    const input = prefix.slice();
    appendAll(input, h1);
    for (let i = 0; i < P.tau; i++) {
      for (let j = 1; j <= P.N; j++) appendAll(input, toLittleEndian16(rounds[i].states[j]));
    }
    input.push(DOMAIN_H2);
    return sha3(P.sha3, input);
  }

  //#endregion

  //#region ===== SIGNING =====

  /**
   * Sign a message.
   * @param {number[]} message - the message
   * @param {number[]} privateKey - the encoded private key
   * @param {number[]} randomness - seedBytes + saltBytes of drawn randomness
   * @param {object} P - parameter set
   * @returns {number[]} the encoded signature
   */
  function sign(message, privateKey, randomness, P) {
    if (privateKey.length !== P.privateKeyBytes)
      throw new Error('A PERK ' + P.name + ' private key is ' + P.privateKeyBytes + ' bytes, got ' + privateKey.length);
    if (randomness.length !== P.seedBytes + P.saltBytes)
      throw new Error('PERK ' + P.name + ' signing needs ' + (P.seedBytes + P.saltBytes) + ' random bytes, got ' + randomness.length);

    const privateSeed = privateKey.slice(0, P.seedBytes);
    const publicKeyBytes = privateKey.slice(P.seedBytes);
    const pi = samplePermutation(makeGenerator(P, DOMAIN_PRG1, null, privateSeed), P);

    const publicKey = decodePublicKey(publicKeyBytes, P);
    if (!publicKey) throw new Error('PERK: the private key carries a malformed public key');

    const masterSeed = randomness.slice(0, P.seedBytes);
    const salt = randomness.slice(P.seedBytes);
    const rootGenerator = makeGenerator(P, DOMAIN_PRG1, salt, masterSeed);

    // --- commitment ---
    const rounds = new Array(P.tau);
    for (let i = 0; i < P.tau; i++) {
      const tree = expandSeedTree(salt, rootGenerator.bytes(P.seedBytes), P);
      const expanded = expandRoundShares(salt, tree, P);
      derivateFirstShare(expanded.shares, pi);

      const commitments = commitToShares(salt, i, tree, expanded.shares[0], P);
      const v = aggregateMask(expanded.shares, expanded.masks, pi, P);
      const aggregateCommitment = keyedDigest(P, salt, [OpCodes.And8(i, 0xFF)],
        [toLittleEndian16(matrixVectorMultiply(publicKey.H, v, P))], DOMAIN_H0);

      rounds[i] = {
        tree: tree,
        shares: expanded.shares,
        masks: expanded.masks,
        commitments: commitments,
        aggregateCommitment: aggregateCommitment,
        states: null
      };
    }

    // --- first challenge and first response ---
    const first = computeFirstHash(salt, message, publicKeyBytes, rounds, P);
    const kappa = firstChallenge(first.h1, P);

    for (let i = 0; i < P.tau; i++) {
      const states = new Array(P.N + 1);
      states[0] = vectorScale(kappa[i][0], publicKey.x[0]);
      for (let j = 1; j < P.t; j++) {
        states[0] = vectorAdd(states[0], vectorScale(kappa[i][j], publicKey.x[j]));
      }
      for (let j = 0; j < P.N; j++) {
        states[j + 1] = vectorAdd(permuteVector(rounds[i].shares[j], states[j]), rounds[i].masks[j]);
      }
      rounds[i].states = states;
    }

    // --- second challenge and second response ---
    const h2 = computeSecondHash(first.prefix, first.h1, rounds, P);
    const alpha = secondChallenge(h2, P);

    const responses = new Array(P.tau);
    for (let i = 0; i < P.tau; i++) {
      responses[i] = {
        z1: rounds[i].states[alpha[i]],
        z2Permutation: alpha[i] !== 1 ? rounds[i].shares[0] : identityPermutation(P),
        z2Seeds: siblingSeeds(rounds[i].tree, alpha[i] - 1, P),
        commitment: rounds[i].commitments[P.N - 1 - (alpha[i] - 1)]
      };
    }

    return encodeSignature(salt, first.h1, h2, responses, P);
  }

  //#endregion

  //#region ===== VERIFICATION =====

  /**
   * Check a signature.
   * @param {number[]} message - the message
   * @param {number[]} signatureBytes - the encoded signature
   * @param {number[]} publicKeyBytes - the encoded public key
   * @param {object} P - parameter set
   * @returns {boolean} whether the signature is valid
   */
  function verify(message, signatureBytes, publicKeyBytes, P) {
    if (publicKeyBytes.length !== P.publicKeyBytes) return false;
    if (signatureBytes.length !== P.signatureBytes) return false;

    const signature = decodeSignature(signatureBytes, P);
    if (!signature) return false;

    const kappa = firstChallenge(signature.h1, P);
    const alpha = secondChallenge(signature.h2, P);

    // A round that withheld share 1 opens the identity in its place, so the
    // permutation carried in the response has to be the identity.
    for (let i = 0; i < P.tau; i++) {
      if (alpha[i] !== 1) continue;
      for (let j = 0; j < P.n1; j++) {
        if (signature.responses[i].z2Permutation[j] !== j) return false;
      }
    }

    const publicKey = decodePublicKey(publicKeyBytes, P);
    if (!publicKey) return false;

    const rounds = new Array(P.tau);
    for (let i = 0; i < P.tau; i++) {
      const response = signature.responses[i];
      const tree = expandPartialSeedTree(signature.salt, response.z2Seeds, alpha[i] - 1, P);
      const expanded = expandRoundShares(signature.salt, tree, P);
      expanded.shares[0] = alpha[i] !== 1 ? response.z2Permutation : zeros(P.n1);

      const states = new Array(P.N + 1);
      states[0] = vectorScale(kappa[i][0], publicKey.x[0]);
      for (let j = 1; j < P.t; j++) {
        states[0] = vectorAdd(states[0], vectorScale(kappa[i][j], publicKey.x[j]));
      }
      states[alpha[i]] = response.z1;

      // Every step but the withheld one is replayed. The withheld share's own
      // state is the one the response supplies, and the chain runs on from it.
      for (let j = 0; j < P.N; j++) {
        if (j + 1 === alpha[i]) continue;
        const scattered = new Array(P.n1);
        for (let k = 0; k < P.n1; k++) scattered[expanded.shares[j][k]] = states[j][k];
        states[j + 1] = vectorAdd(scattered, expanded.masks[j]);
      }

      const commitments = commitToShares(signature.salt, i, tree, expanded.shares[0], P);
      commitments[P.N - 1 - (alpha[i] - 1)] = response.commitment;

      let combined = vectorScale(kappa[i][0], publicKey.y[0]);
      for (let j = 1; j < P.t; j++) {
        combined = vectorAdd(combined, vectorScale(kappa[i][j], publicKey.y[j]));
      }
      const difference = vectorSubtract(matrixVectorMultiply(publicKey.H, states[P.N], P), combined);
      const aggregateCommitment = keyedDigest(P, signature.salt, [OpCodes.And8(i, 0xFF)],
        [toLittleEndian16(difference)], DOMAIN_H0);

      rounds[i] = { commitments: commitments, aggregateCommitment: aggregateCommitment, states: states };
    }

    const first = computeFirstHash(signature.salt, message, publicKeyBytes, rounds, P);
    if (!OpCodes.SecureCompare(first.h1, signature.h1)) return false;

    const h2 = computeSecondHash(first.prefix, first.h1, rounds, P);
    return OpCodes.SecureCompare(h2, signature.h2);
  }

  //#endregion

  //#region ===== SIGNATURE ENCODING =====

  /**
   * Encode a signature.
   * @param {number[]} salt - the salt
   * @param {number[]} h1 - the first challenge hash
   * @param {number[]} h2 - the second challenge hash
   * @param {object[]} responses - the tau responses
   * @param {object} P - parameter set
   * @returns {number[]} the encoded signature
   */
  function encodeSignature(salt, h1, h2, responses, P) {
    const out = [];
    appendAll(out, salt);
    appendAll(out, h1);
    appendAll(out, h2);

    for (let i = 0; i < P.tau; i++) {
      appendAll(out, responses[i].commitment);
      for (let j = 0; j < P.treeLevels; j++) appendAll(out, responses[i].z2Seeds[j]);
    }

    const z1 = zeros(P.z1Bytes);
    for (let i = 0; i < P.tau * P.n1; i++) {
      putBits(z1, 0, i, PARAM_Q_BITS, responses[Math.floor(i / P.n1)].z1[i % P.n1]);
    }
    appendAll(out, z1);

    if (P.ranked) {
      for (let i = 0; i < P.tau; i++) appendAll(out, rankPermutation(responses[i].z2Permutation, P));
      return out;
    }

    const z2 = zeros(P.z2Bytes);
    for (let i = 0; i < (P.tau * P.n1) / 2; i++) {
      const first = 2 * i;
      const second = 2 * i + 1;
      const c0 = responses[Math.floor(first / P.n1)].z2Permutation[first % P.n1];
      const c1 = responses[Math.floor(second / P.n1)].z2Permutation[second % P.n1];
      putBits(z2, 0, i, P.permBits, c1 * P.permRadix + c0);
    }
    appendAll(out, z2);

    return out;
  }

  /**
   * Decode a signature.
   * @param {number[]} bytes - the encoded signature
   * @param {object} P - parameter set
   * @returns {object|null} the signature, or null when it is malformed
   */
  function decodeSignature(bytes, P) {
    let offset = 0;
    const salt = bytes.slice(offset, offset + P.saltBytes);
    offset += P.saltBytes;
    const h1 = bytes.slice(offset, offset + P.hashBytes);
    offset += P.hashBytes;
    const h2 = bytes.slice(offset, offset + P.hashBytes);
    offset += P.hashBytes;

    const responses = new Array(P.tau);
    for (let i = 0; i < P.tau; i++) {
      const commitment = bytes.slice(offset, offset + P.commitmentBytes);
      offset += P.commitmentBytes;
      const z2Seeds = new Array(P.treeLevels);
      for (let j = 0; j < P.treeLevels; j++) {
        z2Seeds[j] = bytes.slice(offset, offset + P.seedBytes);
        offset += P.seedBytes;
      }
      responses[i] = { commitment: commitment, z2Seeds: z2Seeds, z1: new Array(P.n1), z2Permutation: new Array(P.n1) };
    }

    for (let i = 0; i < P.tau * P.n1; i++) {
      const value = getBits(bytes, offset, i, PARAM_Q_BITS);
      if (value >= PARAM_Q) return null;
      responses[Math.floor(i / P.n1)].z1[i % P.n1] = value;
    }
    if (OpCodes.And8(bytes[offset + P.z1Bytes - 1], P.z1UnusedMask) !== 0) return null;
    offset += P.z1Bytes;

    if (P.ranked) {
      for (let i = 0; i < P.tau; i++) {
        const recovered = unrankPermutation(bytes, offset + i * P.rankedBytes, P);
        if (!recovered) return null;
        responses[i].z2Permutation = recovered;
      }
      return { salt: salt, h1: h1, h2: h2, responses: responses };
    }

    for (let i = 0; i < (P.tau * P.n1) / 2; i++) {
      const value = getBits(bytes, offset, i, P.permBits);
      const c0 = value % P.permRadix;
      const c1 = Math.floor(value / P.permRadix);
      const first = 2 * i;
      const second = 2 * i + 1;
      responses[Math.floor(first / P.n1)].z2Permutation[first % P.n1] = c0;
      responses[Math.floor(second / P.n1)].z2Permutation[second % P.n1] = c1;
    }
    if (OpCodes.And8(bytes[offset + P.z2Bytes - 1], P.z2UnusedMask) !== 0) return null;

    for (let i = 0; i < P.tau; i++) {
      if (!permutationValid(responses[i].z2Permutation, P)) return null;
    }

    return { salt: salt, h1: h1, h2: h2, responses: responses };
  }

  //#endregion

  //#region ===== TEST VECTORS =====
  //
  // Every expected value below is taken verbatim from the submission's own
  // Known Answer Tests, record 0 - and record 1 where a second key is needed -
  // of the twelve PQCsignKAT files of version 2.0.0. Nothing here was produced
  // by this file.
  //
  // Those records are keyed by a 48 byte seed driving the NIST KAT AES-256
  // CTR_DRBG: key generation draws the public seed and then the private seed
  // from it, and signing draws a master seed followed by the salt. This file
  // implements PERK rather than the KAT generator, so the vectors name those
  // drawn byte strings directly. The generator used to expand them was itself
  // checked against published data first - started from the standard entropy
  // input it reproduces the published seeds exactly - and the expanded strings
  // below reproduce the published public key, private key and signed message.
  //
  // What one file can carry is narrower than what was checked. All twelve sets
  // reproduce their published key pair and signed message; the three sets whose
  // signatures are named below are the ones cheap enough to re-derive inside a
  // test run, and the other nine are gated here on key generation alone.

  const PERK_128_FAST_3 = {
    katFile: 'PQCsignKAT_164.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD91282214654CB55E7C2CACD53919604D',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADDAB066E720DB3A9DF62AD80C8F24BFE9040ACA485C56C4A0B4E71733C44BD4782887D601D57DE29D6' +
      'C8A8F7C7CAF177077A11BB3F14024390B448632BAFAA0F1F86AEBDA57B7A703C83260265118735E79DAB33649E9199B5D187C02435C69DB3' +
      '6918EF7DE373C0A5451C86B901B884648010499D95B9802D7ACB2E53CEF16E7CFE7DB001',
    signRandomness: '4249E0458B874D2CF0EE707DE4068E75F217BB8E877219832DFCEDF6AB029AE7D0B4E078D60D8467D1884563CCFD66D8',
    privateKey:
      '91282214654CB55E7C2CACD53919604D7C9935A0B07694AA0C6D10E4DB6B1ADDAB066E720DB3A9DF62AD80C8F24BFE9040ACA485C56C4A0B' +
      '4E71733C44BD4782887D601D57DE29D6C8A8F7C7CAF177077A11BB3F14024390B448632BAFAA0F1F86AEBDA57B7A703C83260265118735E7' +
      '9DAB33649E9199B5D187C02435C69DB36918EF7DE373C0A5451C86B901B884648010499D95B9802D7ACB2E53CEF16E7CFE7DB001',
    message: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
    signature:
      'F217BB8E877219832DFCEDF6AB029AE7D0B4E078D60D8467D1884563CCFD66D8C09C9219A82FA6F896D0E9DDEB0D7E276418A3BD9AF3D904' +
      'CD8F520023B040A5CAB48695A7039189FBB25D8F88EB113B374AF696DCF4C8B7D9BBBAF2E425F9BCFD1CAF79910A686100325FBE301AACD4' +
      'A7055D66C73015B4A929FC4B203A0AC3F19FACD11B155A75382F6856616C7CC43897257D3B1939D5618BEA4D87B096161F7B7E0C2262B6B8' +
      'AEECB5F12D92E58DF1F979AA478BD6A875A43270C0591E149EC3E8A261D230304AF5BD75268ED0F5506C1EF372CA3E7D87D3F4D582BCDA4D' +
      '7C6B0950291F14E0AF6D6D1A936759A29F1B5F3089BE254BE3C9736068F691092BBD7B4E81479D33802FCEE67A4B83485110C739ADF7EEBE' +
      '8295869105DA077875259525925FBE1F3EB8220DAB3FDBF47722F582A5FEAFCE0293F0320C1292915C42387655D9DA4E9B1404B1819F4CC0' +
      '094FA7EF68C5474A286FE93DF3EE110D25F7163ED833A44526137A2BDFD1BC9DDE75610E721BB94485D38AF5CC7AF09A32BA061F33413FAF' +
      'C5B0C5BD20797D54FE7DED1F9BB78E11AD81504D81D354F23DD1A1CAC8CA66638A4FD383E544E684CFCFC5C295E0317F6DD91992BA94317F' +
      '6B42941BA5FA049160C4FB41864E937CA47D7579D5F78BF7BDA4C96ADAFC6033F5DF89A1C1A9C3E6000AA699342CB10854B01D3E4B7B557A' +
      '38A304F2DFD812A1460A38C4C32015DBDE985BBD1050A59B7AAD061A88867B6C5F1A971EA2FDB80D6D80E79EE8A1E1363BEA6C55531A684A' +
      'EB6476469C0C09C6F6BBC3503A4C52C393596F85876827DE3BB06DA675B43DFC018A79B8E734E79286B6752A094A8B8EF6E970A3C7D6CBD8' +
      'CE14C3AB079B7D1A2DACC155131F2631D5718A9ED303B131905220E2E1B2880CE07A869376DAAA046DEDBB15C730B11D9A35E9B4B7B1426B' +
      '6C7B25330A40450EF85B5942E5FBD58BCC53BD3476C2D32DF45F928E899ED9A5E4386B283BD11973F150C674A7AD046B1416DD2724CCB989' +
      'BE0CC32AF4F87BE6505D07D557A952C62B01628609C3307E4B84C116009694768B2F1534F0F0DCBD57711578A8E38DB36666A44E8AE30339' +
      '9BBE6712318C735A303D8D5F8617926448B88E2F8681A31DF0DD7A509024A4C5EAB26BD827F7782F7CB42748B0F2EB2B2FC4E21ACB77F5CE' +
      '67ABBB1BEE9E8A4523AD4FCBDC2C21FAACAC932230D25B4044BF4DA143C6D2D60D8CF4EF4D4FBA0204623123D3AE04D5CE306D9378D50D2B' +
      '9006536C69A477F961EF05F0B0746342B89C6ED8811478243CD53DCE0579E32FBF4052F61F04BD0FFFB6263F19E1E1B870AC9FB29642FD1D' +
      '24D2CEEFD9B7744AEA8DE3E1ACCAA24686A6A9A5F25757B0DA88629371D79B52F74B4D71CF26EFF8C2A552C23B5FCA64A8F0B0C7869864DF' +
      'E239839C4C9897DB8CED431008C08C058BFA9F1371AE5B292A5AB23483E34DFD3A4AF0ACD8FE092DF441CD914C312904412220D454E0164C' +
      'A08E716D27C56E0C09E59019B59BEF0E4736DDDB509B2EA19371D20918489D9BE8B442F3094B2A747CC0AEF96444F844D118061716217AE4' +
      '7D4959F2F921ABA2F0A3B6ACC21C5685D3C753FDD4E5BC9AD6F727D1F00733E31AAE693726443E7733330407AEE15DC129C96BED1034EF86' +
      '2B8BBD9338CFD2025B62A9603F0EC75F9AAEE9D4F3FEC80E84E821CA8D5FB1EBEEC1EC6F301FD48BEC1842C02CF05782AB180E5E325D1BE7' +
      '0AC29B669A4EFF974F23500E89977DD5B04B48C628119824E599A4A8D531224C139DEBA34D91A597E492564998D932CD0E1271E8D33C11F8' +
      'B15189007B2AC94961C3CE9C4D07BD70BC5A622DA70AB2451A04F7BD6C8D6CC6233836849A92784DF1C28B4C06FF250C5C7F96BF89E7041C' +
      '1B9F213A912DDC16AE083DBF7FC1431207685FEED20D6AF202F5FADF4580DCC7549B0A9C871466C3E64DF1E8E31BE9C5FF248177C4B112F3' +
      '4ABF40E3947B3A2DD01ED4A9F8CA9AFD99D44DAD4E3347E5FCA23B7B627F2AB2A426D66DDABB9A3830CEF490174F0DCDC8E0E901A1FD2D75' +
      'C34122B9E620C22AD279BD706BD0BB79974C7E53593FFD9DCB51E7E09392C022E17A504AF028320780807E030A5EED2DF31D89A9DFBEAF4A' +
      '55A914835B99E99548716F523FE2816AF25D40564FDD5793444C2C1C1545F754AAA46B7B49D650704F0F2A7549EDF8CF8DCFF3F249E0F6F0' +
      'D3015034A45D29B59E21F8CDE382810B93D5EE603136FF1C8D1FFE4D5A8B953D95C43563E749570F4B405099C2BA9ED91A6E3B65AABB32C8' +
      '06F31F3709B5D5F2DDC518A37D101A21BCA6FCFCEC819F192986325C1993678EAE755E0282477DFE293ACE0D0AA9DCB57C2DE2748112D4BE' +
      '6D81772C49AE61036ED7D516C9F14895C5443757829325A248A4FFF4390ED85701BDF2B43817219CB8403513B3C0E6F2231FBA3B86000526' +
      '76EAE649E1684EC3A0FB6E1F16A7E10C34E04BE0582803B8CC6C36FE35C1F6016E58BF2E523688065E27850E9FA85DC999680FCE5A0160AE' +
      '1CE8AFDEA71816AF07F6CC816C5F9D6843B8D7BEFA6E79B0D0219C342512004985B0D85213E37AE5F97BD5F1FA3D78D052533DB8723DD759' +
      '7D453AF25A575AA0AE6E266E7A773EE4250891EBE88B4D0DD462DD04965F04D92DE3BDF7F263B654E630015FF3AF8EAFBEBF63BDBB7A2945' +
      '3E1EBD33267FE87C945D6CE3C4834FDC20DD2FF53FF03DEC07173220CCD530795A34A8A72B4A0869DAE0624D0D23F0D588E09FD8B23D95E7' +
      'BE191B5892300629FE9DE2AF2006EE222C14388CE5967E4A01B6E999D667502C65816870EE9DE89B4D77A4E0C73A4E1E8D713F7B1F905EA3' +
      '237084F5F2864D1BA34D2C3905CF971CCDD90341EB5A057CFEF525EBC79E2FC5BB3FF63FDE54977ACA6F33906E303FEC196C0C22976DE2AD' +
      'EF580171F6EDD107B8D5F68A18E890D7493D75FEDCC3C614602316349E426B520BB64EBA0DCBE742A17FE61196C6ECDE5815DC0CEA40EB41' +
      'FC88C036A0CBF7044F7EEB28854FBA902C823E2BFC1A94A25CA11A13FAE6DD52351868D643E1A30BDF132DD88D0E6CA855F47DE944F1DD7F' +
      '8E08FB05E1EC15C96BD2361DA615FDC6362293A0FCF970645671E46C5F7E4D9F97457193B9D6AC7F05C3E8B2A3C894D805074CFC8B77EE9C' +
      '6F6C52968083DEFE0557F0299478B85B0501F0A51DDF06D462855EB9D7E70E0181E1786A516E295EF28E489E02F4A0A01E3B9CAD1D4E38B1' +
      '93A611220884BC01309743CB631D63DC6168235DA0D881DCF9AF52FD8839B5AB242D0A7D5983AAEAAF66310CF8DA8511B76AF55B81443D2C' +
      '01B6FB21E89E1A858F1920E03E373B8033EC49F70C1F4D66E6C81EDEAF74FE18D9539D52B51F894AD494842CF1531E1168B1CF692E849D61' +
      '8998F5FDC03F6617DF9F66501ED92FE548A0F919D84707C9A8F02CBB6FC832CEF0D42B2A930D3D27189BD2B42B29968DC7C8E45354D439E3' +
      '35A171E628C8497D83550A4BA34B13980749F446EE0A28D56D681043DEA18C11A81992B42B923A8A12933715ADA86FBCB168CC85D4D74C8E' +
      '50F6A6D19E1773CEDB684FE62E498C18348E578860775991727F67ADD4193081FC2B6B043857DC20FBDC63BCFD3A3EB1FAEF351C122C2BC6' +
      '63B1A7087C3A275494EB4A604C4F5A3C54A1BCF49F31C62AA5888BE0F7594C6B64FDEAD832311FE241F6308178A91017628BBF450D0EA4FB' +
      '3D1027894D41C039C69B92FE2F918224A2BA69611320529665D9D061AA77651EB9AAB5FA17E0C58BDFC1D5FFBADB78E9A432F4E4C9C55DBE' +
      '803D6598D2E6C7096B2890B83E7E4B0817B863FC301613E08D8C5D4A6CD3D43EE120835FD52068AD11EAD5690AF5E9104BD2795348AB8CB2' +
      '4B2796C06E2C4C28C098407719F9C397C17B6777A15EE4C24C32F893FA84A35FEBEFA55C5F1A12BD6382093862D8D16BB459BEB25B12A725' +
      '0F043D0A201940ED5272C13179BE7579363C302391D907E33814A3CED487DCF039286569F7A3F5FD82761EA82C7978F09E8C681975A672A7' +
      '887E765D820CD06549CC0B4249D8944A700EF98DAB1CC296994E216E8453E476426ABB45D4B27361ACEE5714565C134F4A150A9D23840773' +
      '1F50313729D5716F5335680BE14804A5A4918405F9DF32C59030021762A2D90A811365A7DFD57CDA591E99579D94684022F90ED4BD32BABA' +
      '6F58D2F4D5769497115A8265BD96EF5C154251481E829359D6CAD7CD0FEE4E13C015B20A6ADD6261B15D806BEDB902FFBC6405E8737FCF99' +
      '8FBCB40B7AF1B3CE22570C562727EB06418A3EB4003227F03B3B8E97AE3DA1B7828F05D53B140487AAB117A83F4334F56C1E19B100ED8E13' +
      '291A2FC992E753484A4EE59CA4679203445496C586AFF0F57CC6CD9D04242E32B1F2A5F50830C467292F74E8A4F34DCF5D6D3011A9DB4CD4' +
      'BA3EE585A8AFC4AA3A044791441FAA627D9AA549B0D0BABDC1C3332B47B8BB64166EB0F196ED5EC2526076AAA44FA5C9BA0D4A714C9BB6D7' +
      'DB94017A48D066F332667710EF38AB51D5E3F3CFFF6CBE26FF25C6C961B293530D25EA52B6827CCD3163ECE99006F55C5765FFB0E45D7AED' +
      '9941EE55FEA94590AD3B6B2149114CC32EB71CEB2FB626D146F9AE40CB285E49A22ABC838650A89E8C4ED142265B3688C11CB1B7E5A92F97' +
      '5E2090AC89E893038F9A6044C5BAD8F3EC0A9FCDFA28A86FA173488ECB8E4EB89A3FE3AB96BD3AD51D0B74712774F025A0EA36286A47A4BE' +
      '787D55628C620701C6A97E5FB0E6CF417D40F7EFDCD51440E17B1041996428D3B17264E4E96D5041020189B386ACDC350D3FD6E933DA19A8' +
      '1B020E3269AF25B76C281FD1D1AB710EB8CC7572FA11BF67A052AF1C6C75FD5099C551EAAB36802971BE38343BF29041372BF0B99CD6BDEB' +
      '50F38D278AD765E93C0D53E810645EF7521CEA5523A67D82A9D5EC8E05F3DB17E815D0145348DA8C2D498092D2AEA7BF0639C4BF6D1A2740' +
      '6F3D69251EE6E39D7C186D5F052D9CE44613491FB5B359A2CE16ACB31A2B02A17FE0D1165CCFFF6DB0AE532B42DDB698BFDDD13980C08E51' +
      '5BCBCE05D356961C3664A1501088C34A4423F7F7924DDAEAE1A4B99A76C30255260D1DBB07DC28C7EDE8F2B54F419DC882992A2A8C8A0071' +
      'F34592F72A05DED719176D5B246102AE4732893DCF7B78E0EAF3BF0AF905D1FCAB19E0E4E294574ED1BD8E5FDF48FA897B2A4FF728B7A8DD' +
      'AA39E38619B33FB7CB045F119F4B47F0A772612592266E0E288C9F2723A9116777F7ADDE6E0A2B27BA3F793A7D9EF061E385623DA980A532' +
      '2ACE51D054775DB2F58D21163684DECE42F5F71AA21A81DD62427FDF191343105BF306990F45451711F1B49B8E3EBF9BDFDD414CDAF5B9BD' +
      '93862164090998282B6456EC5ADAA14BC26FD2CAD567E9994CD593ACAEF781DD8ED87D4FAF6DFD70C045A80984D0C37F84C11E4C568534C5' +
      '7F9489A0B14F8BBCBBEA928D671B2EAB49AD4D6D0AC0FD7986B372CD6E140CEEA23935498E3170AA28612AFA0945C67094D5156D5ACCB763' +
      '97E8E70F0D7B729486111675EF2B44D6F28A315AD5A8B18F685B8B51D534314348AB5D662DE6C538050B24E762F3CBB373D582CA35B63208' +
      'C284D964881006D8F185AAB54F8D46D3E3ECAD6BFC98EEDE7A183FD230EE3E1782CD6C238B661E7DD7EE5B612D119E406E19FC0FE572B29F' +
      '3522C08DFFFD4B83DCD6445BC565735AE35B0EF7F32DEB8E2C6B756FC5B67287FFDFDC8DCE09834702E23B31B442A2655DA93ED61270BC4D' +
      '6F7931B80C0D48EF92C6EC514E4901752CBCFD047E04F795245BBB0F9A5946E425D31C6791C795EC0CBA74FFDD022AA6418AA504F246A927' +
      'ED6812B1296DF8EC3EFE43749620F70B8DDE77C4235C96872CEF1364306D2E280BD92DDED9A0808F98E54650E0D0398B67BC7093618AB085' +
      '329AC103706E2D5ABF0376E345CD6486D9718C15D0865ED7AE7A73F33C5711945D035641A97028A2897340519D2B26CF96F5A89938B9DEAB' +
      '9EFC5E3C2F4C1DE2980C1F65EEC058390DC04BD77A235F2F03BBC9DA9F39C153CAA32E798BC4A9422495549E52C9D13D3474BB2AB536083F' +
      '82660F8C72030CE6477E112E7B7D99D0C7412479A8783D27B5CC386F0CB38273DC4F0325E70016A0BB83CFD56FE8AC498564699C2777E716' +
      '1BDCED826E9E9E3FBDE056C41E9A1568513A158C98D114F006723B72B3C6669B46E8AB967F53135AAD15A255DFFD5CEC66418FA6BB0B9FEA' +
      'D10590387E32A751A781C8C890AA77241480D025581586F58CF3D2B63369659350CCEC9A5366C53FBC7F63BECD791FC878941B496E426597' +
      'F1C6C815F4EA98980F7B45691F1D454DAB54815ACDE04DAD819EE756B0F013ACD88BC55F123343D6B4F8D71B79EFDDE7EEC5D1DAC3508CA4' +
      '8B7B220D71523DAC14DD8E6B4A42AF8B66FB7179522727D568C5DDAA75D9EC5935E8A0D15FE4C16C80DC85A75229CFA09D4862828CEE8634' +
      '8F74E89A5AF4A41F96555159692703B41A770318A809CB0A836482D7252CFD3B74C92041F94CA903AC88544246320C3DF6C07ADE1ED88B54' +
      'FE9BD8DC371FF5194BE58F415473ABFE29BAE2FA83F26581DDD416B6048FBFC5AC1357DD1BDF8C222308D9919EC5E688A900042F9F84540A' +
      '2A53C411AD7114CC56449472E8AD0830E0A4181B4E1DFBD43589801656BBA4D4CC821F786E737E2AB009E9ABB42291FADE069CE84F339FFF' +
      '281144A189CD2D161568E2E85552D27C9A31DAA61B761C26C3B7F802383AFCEAD149F32AB74911D8388A13FEE95DB9E9D24BC4D24AB3F44F' +
      '9CD328D6CDF3D048A202B3DEED6E055B21F65DFD1A4ACEA2EE379DD2E1B4AC08DA30633743B529A70B2D065F839329581614607F4BD58351' +
      '24EC76CD222F862664AB78412141D85EDB7B2CFA401AA8AFA517BFBE37D043A46FCEE958A0E0DF65C78834D49E96F5879D638D48C3BA5150' +
      'C5F620DB8A498B0449F93AC8E5FCCD9C50A405DFDB6E8A333F1359579862A4FB022DF1F3125F8031CC55DF42A501430E1A94B12509BD84DC' +
      '2F248DA0C77F031AEE98AAC37FB2B6C67072A339D46A5217AF240B455910E53476BD151BFE2A32F0458A6EBA36BDB92035DA894FF07FBEE6' +
      'B5800B684355B1B8754620ECAF01766396429355E41C81E9FC131F81128CF419B33D20E6A3F0B9A3CECF74B41F04BCB485400E5D48663B86' +
      'AF7AB23AF1D808744A74D29212C5AE0616189E9C46C05A630462135E405977C16B35167DE4D5F4DFCD2739D2A72F6BC9CBFE8935043B0F66' +
      '52EA90CC1C7D1C05A792F0D1770459D3A10BE0D36AF4A43E782AA4C41B46B0B06D0438F11B97BEF7E6AAD4EDE7412C43C93ADED1DE61BE33' +
      '37A1E5BC58F4A7D51855495E4553839FB882F7C6D336B8492FAF8028C1D5C02FD99E393FCD830FEE6792BEF639511A49D488615E4AF4CEA3' +
      '797082C1264EB7A74E8C69D5D801DB9CF83B417F0C0A6FCAEEDD74AB645F974FE267A9A0EA9FC0155D2561E100249B0E348D929AEF030592' +
      '1ED8F37AD2B0502E107205B16C0290D6F0ED2D5187928097A9BF274FB28839F32F69537F0836077B80A9ECF2D0DFC3F0A7A2D244625B3A3E' +
      'CF359E0E5A823F55D4D45D4854DBACA5DBE3BC5FD3D64EF8B680E3D9715245D12EEBE3CFFE662AD13FCA78ADCBF8FF18D0A401D748E7AAEB' +
      '8618A9BACD750B2971FB4494333159AD725F989039116ABA3BF668999DF01A431F4E75ABDB2C3008592FDCEF0CD173D46A87E90E827292FC' +
      '993984E8A5A01CE7B20E8F13E7ADD51288B24E823EC476DD8A29C5365CEBCF9815B963E677D9FC203B83102DE9BA93B3086C09582C7731C6' +
      'D2A8471955D73CD1A06911DB49E44EFAEA42DE2027AE3E1480BBA9620FD09EA1C6A4BD012EB176C1CBDE6E928FF5B21FCCC39D7BDBFB4E37' +
      '63C38FA2A875A9307F82BB4E75943281DFE6843287E2504DE7BCB4FFAC76BD1A3DC7749CAF526CBC3196E19BDF73663747EBA8015CBA7ED7' +
      '9F59E93ECAE72399EDD4F6892A2F7E42232D393EBC230F5A4B2D9507B4F2070F74B49BCBBB7C8F02FB2E40F89C1FB659085C44162B107757' +
      '751CC875C766C22B74173A56C1BA668C981CCE76BB1242AD12B00173A4EEDF6D50F02CD9BFB4C847331711F4D80F7EFCF59911FCEE200459' +
      '8D87490655112F159A4FEFD19DDAE611FB2036577D39C84D8FA8601C1E598AAFF1CB0B45F7BDF6E68E1013E2651A1CE14BFE2ADCD18E7407' +
      'B4927A2C4FA7BE24B157D3DF71DAAD4EF4C40343AFF3097544D8B536CBBF0A649E450460A829643C3CD86943663392D44240E7B88A47D4A9' +
      'E2E0CC4462EA375CD30BEF10CC6D014202AF4495229DA5B2661E26A3E3F568FAE304FFD8C3070211E52FAE2C4D9B7E8997EB5B2A63D5DBC3' +
      '81FD5ABC810CBD07D5C7630185581BBB5BF00D07D7A850CCA51CB12DBF20EC27EF18A3FC6F632B6EA856D06C3DB78068886A2C74F0B97389' +
      'C00C6B6129D5236E8FB97B5EABC386FC472BF6EBA8776D90034F2826D3D84FC461C7FA826F02C05F42CFE4DFA2B303BF0B6C3D911DC6436F' +
      '8C04C03C011B5FA702C267F903D1F8181E37CBA35E075AF1E26358569C4C6138449FD10E95FC185AE3D8968DF3BD6D1AC4F4E04A54119763' +
      'CA5ED72DB4073EF0C58F072B3D8783AD9BFCAF8DAD9D31BD9E1E06BF4985FC621217B725B2EA5E4C284BE690BE6BD613FE318B6D0230ABEC' +
      'A1B75866A6ED44BAD17B5516F77B678D2F8593BC0283D6455C619B789F6FD7AB8E9AF8C44531E0C64463457F7C48A2D20D9172A0CF69B946' +
      '988756B628710ED9A1C1B081608F734338F1D4A81C07460C6F62A69C299C6DB824B76EAE8647FE4072E9D5739B5293100648A6FD70EC4D20' +
      'F0D3B3901951BF048CA1D61274CA74CAA2E17740C65D3E79586ABED6A4D2277DBC6E0B6135A2218D2AA2116B2C0F2A933AE8754A5420A34B' +
      '8ECEB6B6923899C6E3043234FFA3FE85E71980A6F461C774930BC4C4084BF81BF5C146785DEA8C49114AA18AC8619394FF5D69D0834188ED' +
      'CFE442D71E810910ABB0CBBD530B722C80A3364278646DB0E87849853346063145AA0D5EC56D78BDF863FE4CD384D5228414AFC18FEE3545' +
      'FF9D9850020363B3F26D7A0DC5C026544089713A2D8DCCE1A81F3CCC55BC1376E1F6A5128DD506DFD1C98652E5E7222586237D53FDE1B748' +
      '33CA39E4ADCA17F95D34DA4C91B0D6B19D19C161DD07DA290B784FE6136F5B03A7F880BBF2F55372ABF5D7704D532B273F47B0F88F1489A4' +
      'C40866C21A0473C4D50001039D0EB0F236521BF7779D566DC4D0598A48B69A761E1A9E4203DB13278E13AB76295A92633E5EA31761679633' +
      '0E4D96596C06A8152BD4ABE928026690BDA6117AA4E1B1B2B1E9A72BCDC2D07F136538D05EE3D426458EEDD215ECB324C6C2592BAD1ACCB6' +
      'FCC7584C08FAECE4F24603F78B531FC1C4F7D28B392D6BD7411B6C697B94643FCCE80A501B148898CE5ACB4EACEECF0443B9EA7D7CC8BD0F' +
      'A468686C478EF35FF08C0982958141954550ADBD16075CDD0F930D035CC4E99B28C73BE2733615568686C98ACDD253CE718359A8C529D4A5' +
      '640D0025D6EB03BE2FEE1C9F7F9C2A725156C8AEF0D719B2AB02E0B17DEE49F445C7A91E45D72F1D6ECE1B1D31214033B4E900ECFB0E421F' +
      '35D60C57A5B7CCC0F5C3EE0EA09CF13BF5ECE4788D5C3B39F56DBCA8252521A238B02DA19CD42DAED58AAE032B7DCB36C745FA9B058E68CD' +
      '5A6B62D026C0A127969FC06C39374E83829AC1F676669BE96378143E06B0EBEB119B0F8B83520615092189316C61E61BA636CF42CAF8BD38' +
      'C0AB92FC0AD2D1657DC85A62854A3738B72F5C88842D380788C62D12ABFAA9EB90825C686B4C447BB30BD4D17858C810D7FBF0A62AB3DB60' +
      'CF0F20099B7531FFDB6C790FA40814662C2A5A93044A2B08C7E4AEC459CDE47A433A1B2C210A33F0C6FE797B74602522EB026B691C04D1C7' +
      '94A2C2EC4FE813270B9F3DBE494BE87194340F69CBC28124FDD48ACB1ACD8DCF101FA65BF134B41B6A73DDAA1727D932B6DEF52EA8E9A43E' +
      'E62B23614AF0132D8E1C43885D36E9A9832CD97BA83233C5DB3CE2BE6AB877208CD0AAD694BDB6378C25347197EC43D2F016E2994ADB3CA4' +
      '9ADED348B17F8E1EA0E91E0A01529CAA584CE0A92F3AD102390E0D527ED0515C20A09A152A2360D78F50DAB2067979FD89A5A7EC3A98D6B5' +
      '0B5BF93E69385DD4ADC189E3B9A3BB55E34E4103438DE9F030E392357B9058C241F0A90463D94CA437997909E358219E34E44FEABF4BA7D9' +
      'A93FA14D03CC6A2623B5F4246AA192D8006AAEA7DCD5AC19734BA48327D4F37802197ED0CF081D9092D1D44F1630E3110D5F7080CD918883' +
      'AA7684A563950B493A94640F785BB9D2D67E7A5F8DEB82A272D38B1D73F3F58E52EA97494CF9D6B6ABA807811633F0BAE81D8B9D75694922' +
      '5B47D8869819A028A7484BEB4F222192B0D8629505FB21C4804ED9582FE7E931CA30E4003D23D23802E2C15400BFDD6C7CC3F59A520783D3' +
      '6C358761E891ABAE1C4BC388F29DE0E71A5BA4C12B44628D7E1498BA29D8AB387676BA16D350B9DFB52BB0817C0C53E5316ABEC5DBF440CA' +
      '372A95C99F1982914D2B88A7372CB139438EF1841D9AB9DD4C6966BA74CB00F1879ED53481D43F5125E8EEE2DE9F16B92FDAAF2CC34A6B8A' +
      'BC79253A27434EE3AD4285B66DA3DBBFB34A361951F8A88FF04EAE7E7428F76AFBE56E4A555EEF0DA81684B5BB06D2AFBB38D4B4FE808620' +
      '8295B466BBE58484315954393E762583B8FAD719D1197EFD34AB176048BEF08239E2022BCCCCCE2B8A36394DD02AA3F0256A474F16A7C91B' +
      '3D4AEC46B41ED95A1C480E8EEEA7F8B121580154AABFFABF102B8830CD98E9ED4A06A0FBCBB8CC20CD34B28AF999888B7A8E945241D751B9' +
      '26439195D0CC5E3898DB9C27B010058EC8D0C3BEF557B6240AD142EB0DC6F5F3E351D9577545379A0F6007D54DD7C21DDFC249FCCFEBFB8D' +
      '6F06AC515E79B7879ACE30A4B3A28084CDE0755A8AD9E4ED82C85D255CCF188611C830E6AD289582A43A4CC52CD7B89446A6461DB9C512EC' +
      'EB4123E3F26EE5D329343A29412AB428BAB68907659C3599B586915F9C1CE92799507F24E1D0E2BB0233204B14C0F578B9806495A6145428' +
      '3013A73A2195D66DFC9E46B78C3007802D613D7518F3D61D2930C5EE61C37002A195A54F551248C5509C35A81530C300C407E04FDA886FEC' +
      '856E983084AF765B3FA5DD7DE8DC54CF14EE1A8DA099120B8C9406B8F1507A4E07A3A01132FF82B5278092E1ECD0456EB7D42FF54AE7795F' +
      'DD16FA1A05E910BF364813B4032A10F4076022D69BDC4E0CC0373AB9DF21B265D1793EB7A4784247EE972993F0E7FED1A1572CD001EAC5F9' +
      'D67285DD51BF93B47055EBD4E7A96659444A0CBE29A3C64093EC58B6AEEDD6D9B5CB889A847817F59875A3F81E7523D216CAB7D81730965C' +
      '03676B6C0C4E0CEE40C1A2A96C11136F16DD7E422A62A91A008405754498A7C1680F836C2588EF59ACE17366728CC4504DA616C9C685F4B5' +
      '11E9B7C60789C731C5E20E1F852298BFACBA9F3E22FDD219687A3CE38131D254C8E9122A746E97A52D3758B71DBDB378FA26C941C7462282' +
      '4B8805A2675A72383466C55449060AA3056ADD1F67862E78BE644D979FA5FA4C00088DF59204096D8258375229914F4F86D18B3682744E21' +
      '48C97F6DF843E835E029018E52A5B65843135A8FA1F41A331A6E1EBDBBCDE307921FC4F8E6A216705CACCD243B59E609DD5311DE3CA8A083' +
      '01',
    publicKeyOfRecord1:
      '4B622DE1350119C45A9F2E2EF3DC5DF507F763D0E573CC275A30483C17AD2EF9692B40593B0D87E2931812832C223C7F0CD53B798C4D98E0' +
      'C12A12E54129C8B0AB4405ED448B1A5C1EAE2D351281FE0A8584DA5EF8A06DE853E472384C8E5916CDCD17E2B966D18711CC3F5B55A960D7' +
      '180BB86F9F3525B2506A549F73377086A097C8049851F1C0BC6B1B0D121506CC10085C02'
  };

  const PERK_128_FAST_5 = {
    katFile: 'PQCsignKAT_257.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD91282214654CB55E7C2CACD53919604D',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD59BCFF353C091F9C56165035E67CBA7A9A175C360357D2450BBBF2CE13133992A2E8F6DB40255FD9' +
      '7D0B5A4115CC6A1B36B26B63AFB32B4A1F97C996A920F1633DED3D856C33B4378547545FF86264E6F81D123DC49218367EDF45D76F933A60' +
      '2DF68CDA3FF13FBC58AD246746C03CDAB06AC518B22260E5F79F2ED12B3F39EA4DF8946A53CE4184F970BF66FBFD7824574EE4090634A301' +
      '26064B4858EF3773438381EF847B61CF1717B2A326C503617C940E80F016995B04B7CB42351F4DB7DF5A5DD655DC3CD90930BDEE008F2293' +
      'C5A7C116F7D2E1B3785BC6383661EDE8B8',
    signRandomness: '4249E0458B874D2CF0EE707DE4068E75F217BB8E877219832DFCEDF6AB029AE7D0B4E078D60D8467D1884563CCFD66D8',
    privateKey:
      '91282214654CB55E7C2CACD53919604D7C9935A0B07694AA0C6D10E4DB6B1ADD59BCFF353C091F9C56165035E67CBA7A9A175C360357D245' +
      '0BBBF2CE13133992A2E8F6DB40255FD97D0B5A4115CC6A1B36B26B63AFB32B4A1F97C996A920F1633DED3D856C33B4378547545FF86264E6' +
      'F81D123DC49218367EDF45D76F933A602DF68CDA3FF13FBC58AD246746C03CDAB06AC518B22260E5F79F2ED12B3F39EA4DF8946A53CE4184' +
      'F970BF66FBFD7824574EE4090634A30126064B4858EF3773438381EF847B61CF1717B2A326C503617C940E80F016995B04B7CB42351F4DB7' +
      'DF5A5DD655DC3CD90930BDEE008F2293C5A7C116F7D2E1B3785BC6383661EDE8B8',
    message: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
    signature:
      'F217BB8E877219832DFCEDF6AB029AE7D0B4E078D60D8467D1884563CCFD66D8A8F57A24FE26180F7A4B690F7C38155585A5A94BA7A7C1DC' +
      'F738B9ED9C24D8D22FF84FDDC0381D302922A3BDAD33A8DBEFFBE099FFA717658C39D554D98F50EA14552310758F38287CE9E9A503E8EE35' +
      '9D7C3989CA9FB253E92BAC2A73DE197AF19FACD11B155A75382F6856616C7CC4195CE892A368B645C465598DB06D8656AA6D8E52C5600CA9' +
      '18D5DE59A14A12610D542A9A925559295C324D67A05D83B2102436CA4017E06E141DE5AFE942FD7047E01AC1EC095357A8DD03B9FDD42C8E' +
      '20E0FC6A35B295B799909101B22F6CBF9F1B5F3089BE254BE3C9736068F691093EBB7F6301C947637A1DA292742F7E1A0A6AED3E07D45762' +
      '0210968A85374AD6A90EC06D138A35C8A83664E93483C079DDCE9BCD34360B5C22198DD037ABFBAFB61E0A5335DF686FD9B1291E3C783AA2' +
      '9FD9B9F2D0F241671A7FC547BA26B538471B31A597054FFE40AD4A879CB1CE1F525AF9292F7A2AF39FC09DC912A4EE5C7576A07333EE580C' +
      '3D23600D64740CD4E60D3970EE2E620BA0BF2D4E3849D447B5546BA359C45993EA43DFDC2A13342552B17F8F75EB1920027EE5ACFEE2D210' +
      '0411C74C8654A79E59CD5DD89D39F2E93926C785820273572C491F443BDB5B5A5F1C4EF225428EA93FA04286D0CA1FD67FB29349106E19DE' +
      '030A002215D46A18158552A440AA1CECC3B12CB20BA96D9E8CDE43DA4545A112E3F5D946E09B9AF53A521C467398A8F5F466DB8529CD2492' +
      '0E5D9887B049CEDE561A447D0E36BFCC93596F85876827DE3BB06DA675B43DFC018A79B8E734E79286B6752A094A8B8EF6E970A3C7D6CBD8' +
      'CE14C3AB079B7D1A991D858825861A58943D952DD4205EDB11C55446C65FC53425E93C6CABC9DED1AC8A0A8F1BFD04577148FFF6759C3AA3' +
      '0A1718749128E5D2D5822B8A809F6BA0CC53BD3476C2D32DF45F928E899ED9A5E4386B283BD11973F150C674A7AD046B1416DD2724CCB989' +
      'BE0CC32AF4F87BE676A5059C288E276E79458D7BB5134E784169E125C9B21B07BFC31FEA81B0953657B39E8FD2016C8E2F2928926ED1A7EB' +
      'B7430F621B6AF036D8E87930247EAA72F044769DFD63A7A1664EFB3BA49E5FED1FF0F6FAD68690EC50B1630C504B9C274E784E9499C899A6' +
      '12EC8CDF7463EF458ECCA5AF9259251E62D98E20C44EB9ACEEF64B107F8F5F94B9CEE6EC103E32DCAFE5F76FF97D669D6EABBFAFF019A040' +
      '989EE4DF74DC0A536E6BDDE2FF62E72C36549F9FE9719ED61A4678D28417686C589A29F4ED696589C9BEB710446874A868FFDFC19984FA98' +
      'EB798DC9DBF68855407DA96C6DD83B30114CC311DB3D759D444F8E437951212A8A00909C68E3831177732966190C6F47B4DCC095466A4CF6' +
      'D0FE891CFE6E479A099455B32F8E80E90B2DBAE4190BC444EDEE4BBC5DAC6D3931D1E4A5AF7AA01A958CFDD6942E562017633C9C03F8482F' +
      '7FAE238703F2AB142D24C4AFF6AB7FE5DE82356F646A409F21CF1C3D7A7DE12C88B7E591A19C745A9114A9E53CBFA40336852AD1F92F8E94' +
      '411E58DB832CED8CC5BFC0378EEFA35D121BDDFECF0ED205F6A4785F93C6C28451B0ADD385498FC47F0266E9951562C77A4FAFDA2D0E78AB' +
      'F63CB6FD8AF8BA07A8410B95E62FC4301808D7311DC5CE8A9E005C16858917D112442DCA66B595CEBB99432EB5168F254642CA7CAA2C4E8F' +
      'D638D98EC1F9C2F0383570ED5C6152DCB04B48C628119824E599A4A8D531224C3FC7AA32FA732B638BCDF8CF72800FB447EAA751333E03DF' +
      '8CD3F7E359C98E69DF62AC6CDCAE0256D08E8FCFBD1BB97A7E7755045D27B45FE578F8559BFCD1E44CC003E78C205BA1B7434B4F937314EA' +
      '071A3F6F68846FEFC3FE4E2A43D5A75507685FEED20D6AF202F5FADF4580DCC7549B0A9C871466C3E64DF1E8E31BE9C5CD8AF8857EC3881D' +
      'AE6CBA06A322A3EA126211F8A9499DFEFF7FC578398B3C3632F62D0706085E51070698DEB2EC76C9452652C4E593D38371A40345E30915F4' +
      '0BB708870F32F9EC2946AE8B429E3D27974C7E53593FFD9DCB51E7E09392C022E17A504AF028320780807E030A5EED2D6A1BB48FC44B01AE' +
      '906E78EEBEB0D4C54AD1B4D327979D957E08BBBCACC1CD7C41468EE278CE16977F5ABE159944152CD38F9591D82E6EC66963771258684C94' +
      '740C095DCFA3DAA30B009A3DB37F08D593D5EE603136FF1C8D1FFE4D5A8B953DFF2797A1987BE50A377B778E2F0DC85D1B402E0229881128' +
      '58FD1775EE1F0FB1A32A98A74884B211DAA6BE652179904F34618E75E8EA7DDB3FB8FCE3A15F7CA7459CD40AB2E761AD920F815E696FFA21' +
      '99D8C597372BEE03C1A128C9CE02BA05C5443757829325A248A4FFF4390ED85701BDF2B43817219CB8403513B3C0E6F2231FBA3B86000526' +
      '76EAE649E1684EC3A0FB6E1F16A7E10C34E04BE0582803B8C29DAE36A5CFD4C1714507B54D970360487DD785E097E45428E6A4DB8D10B4FF' +
      'A71DEA305D362FFDB0323A94A8ADD9D1F0F43608F0913251FB04650A82A684068AE3300D057B352C606977EC0C6C23618172E860BC122634' +
      '694EBFFE4905040C3667277FED881F2925ECB9A313542B1CA2ED8EC566C0F472FDF9E1E37806283C00744753FE65FB5A2EE058969B7626CC' +
      '5BA3D9A91580161F51C207BB9F9A88FB20DD2FF53FF03DEC07173220CCD530795A34A8A72B4A0869DAE0624D0D23F0D554FB8BE380F5B894' +
      '7771FEDB219D50BEA9BC0DB0C8F74607813E3DFF7A44F61572ECB52AE18B97646C40DB61635F28615B722C0BBA62123E389F92E5A23FCD15' +
      '79309F57AB0F75381DF480663D0155C4CDD90341EB5A057CFEF525EBC79E2FC5BB3FF63FDE54977ACA6F33906E303FEC66CA94172E438EC4' +
      '986A6E0841605F62F8757272302E56F23226FE049629E33BC05D1D48802535011D0A3098D691B90E7F768BDD2C964C16A84F47AE4EBEB5F8' +
      'E758E38FF8C8AD891A970C3CBE9AD0CDF248A2F20E36B1CF6895EA444F9DFBE899D132D12B35AD7D5561571347826D9E10EB3D289B8330AF' +
      '2CB1C4367B2B55CDEC8D57B3175082012E6C9CC2F94A96233E84252C73ED4B23485081B2CCFA0BD2C91ABB8C8F9B743E3F066AB8E925FECA' +
      '592DDF3587C8A8964F7C00116B7F667E300611D0A47163BDBDC40C138ABEBADE7124E41A099A1356C94A43D02AB05947F279247B3AB0B536' +
      'B749406B68CA2F9EF1187C25C949BEFF624CE57061EE73F3CB7E48A66EEB660A881CCEC34655BF07AF36C99827E7513E3212854071C23F18' +
      '9FF1E2024521C3224131EAAC5C5F2F947BCF70D68A0E456433306A366DD35F68D1C6D7BAABE8435DBFD810AB127828598010D26A8132457F' +
      'E8A30B96EF827175432E7801B81906429B06EA26397235CB6D7C230A9B367A3F40002889565470ABA055DF83C3432434F5CCA0AE4BF0C73A' +
      '9028D0629E048BFF00E2CEE9ED7DBFD60749F446EE0A28D56D681043DEA18C11E8CD61D11767F5DCC0FCDDC161B0560B50E67443A8313847' +
      '1BA45742B8361806F99213BBF6205A55E908F2B338CB5688E2382E9050E78A1B867D70530983379628471C4AEDAD7FECFD85248330289DC5' +
      '5F6F74A170EA6744BA4CC8186021DCE154A1BCF49F31C62AA5888BE0F7594C6B50B4A8028505E7A8B6E35CDB57B445B598973FB3B238C776' +
      '5BAA32206A850F2AE110E4DC41992AE0C63A5D788BA51944EC58C9446B42975E266C518FCCB79DB68C0A7D9F1CB066A81072F9C3B40E12A2' +
      'AE16275C0FD90A797D5B530C4405973B7772822FCFFD5CB820FAB61161C382BDC0443048BB99CA5D74AB37861ECBFFE44CE3DDF2E2E48CAC' +
      '2E45DC88D6815BE01D39ED79D1CC472690486F084C423A841D2CAA21094C1F6F541906FB432FC237908AF68623FEEE1165218FE91670B061' +
      '635A81A60592916F482B5A0F9DD826D4363C302391D907E33814A3CED487DCF039286569F7A3F5FD82761EA82C7978F07AFF8DA5C5321150' +
      '64520A1BCD536FF6306D1FE009520FE53489D4F3E59A7D6D879BE79AAEB1C66FF39107F9308BCC97C6C826820DF466742050B86894D6CD67' +
      '0A867C47DA06EFA7E3AD550A18FCD71EEC0A65F262BA08D8F8D85B9AEADEE731C397F602C3FCD4A50B4328CEFF4649602465694783767BF5' +
      'D39225447B464BAFCEAA4CC04CFC83B9D627F9BCFFD977D4E6F27751A102BB45A95170CC1DA1BF59329EBBD616A24403897D1EB6B43C65FE' +
      '1E63F78FDCDD67CF136A4CB32D8A87F0E5ABFACF38572851934A6F5C29AD61661BFC20350776506308439DE42FAF6F35DD4AA5E9EFD1AF02' +
      '75C573D199EC67C1B5F81EB0D31F0706F8D9BB912DF43181F7EC7CAA2935582CE6FE5439C2A701C4742C300E02C1CB5AEFE56147245FC62D' +
      '9A51880A648D75E5496229679B26A5E17D9AA549B0D0BABDC1C3332B47B8BB64CD1154D9AD890F9BB125502610584F7ADF75E40B7D4C7990' +
      'B479627A52574A83D315448EB011CF5DD46710741B429BF7AF44E330D3FF1D66CDE6426B7D39A34CE03B25E69CE0926337F8DBCE9197CF99' +
      '56B135248FBB31A31EE412FD064F0F3CDB21B34F6FBEDFF1B66DF54D141319D8CC1EC34F05C63353EE078EE26753119F898692ED88700073' +
      'EAA6B86BDC40FBB2CBD18688011FC49D65EE673A6EB4C0B0491342640D63FB93334B93D00251AB040801BB43794B2C55E1162F6FB8D59B03' +
      'D75942E4972F8E443C5DD9D4E035B2851DD19E23A0C6588731841503BFB24F48ABEDD8EBB7D064A1E9F21CBB7A05C4D37345E6DF6B06B6EA' +
      '69358B0DC83DEA7C0D27837EB4AF2B982A41A5804E6CF7F7AF832BEBCCFA6656C00BB5355A95AAD3EF6D0D43C9CBE8E14A1FFAB4704D024A' +
      '255918C6F5F4184A759466B5826D7EC810F82FD71E828FD780D91DC0D5377EC74FC30A670CA1535D54AAF54FFC2E23273E82E7AB5B85EAD6' +
      '9E7F95B33ACE430A960A5353CBA1CB3FBACC4BA901A48FC60E6F923675652061C59428F257B907350CF298CA20FA062E26E436571B8367D7' +
      '07A009F803AE28C9BD80AA160F6DB8B406AA9A85A950451B9691B4F9278E4D6B44BAB88CE814C360B78323D8160432C0E93E10932BB8CC88' +
      '2AFBC3A507454F71224EBDCBDA71B81BE487258A143B946EC1478933D9E7DA1560C0424C22EA54AC0D1DCF8B485C6BE3CF0667E1614BBC89' +
      'D318E388AE232E68E511882DFF3C0AF930F60CED14DDD1D502585428BB990766F11F8CA1A220AE94036063DFCAAE98A12CF093AC55C1685A' +
      'B29C1207E05DD98C196609543CF52C7124A16CD14C921CC48F8CA642AFD35F7136F48104101E78F015BF9984B3BF35E4059AC50EB44767B8' +
      'DD56366925BEC0D8BED4F16C6BC3374751F60B775A5ADDBDD2FC0C907963F274D9B2151F6212599B6A262E0F9B6C17BFF958BFF34620AF6C' +
      'CBA9DE3CD860FC060CB0DFD57433BE98605C240F48AF0F95119A9CE98081469AFD9D9529E7FEC0BB1BDDC9C32DB5CA5E9D99D1D459C6FE65' +
      '146D1569B40B38D2FEE05BC011CEBB066AF3D6A7516F25EC9E3D112CC2C36428B52DA7051F3465843E733B14EF439D581821149F4D0F27B9' +
      '51B40A32DCD0F24953B5DCF3AF5BF7643A0A5271BFF1C1225C50A9303E913B7314982EE335DC1B48E86FBB7B1DE72EF88D0BF1DD72D0E916' +
      'F5339CDBEAC65544679F73C1E9D5AF5D8BEE9597411546CE2C4614D04A639C92E89A8DA6519B4ED0AE5AF773C767EE13995635F6E60ED8A3' +
      'F4DB621901D6FBB5596CA9E7BE234D0E1740CFE817FAB69A3152601CBB4DD2BF1DCED30FB1F25AD0C5B0159FF2CB845405A505DE9E8126E7' +
      'F61E126ECE986B11736145959E55AD8324DD65AFA2E8BC29647069E7A08F1B989CA0133F8D0DCA455686094022C7DF893A93B54179FE4984' +
      '13E531DA89BBF21FB9B2074EDEF8CE743539BF1B38ECC9167FEB3DF04679E78FCA3533B3CC8073D42958A3E137335E2F72CD53242BA5E620' +
      '666B359D7BCA1F9B478B550FEF84413E2A1908568B5337641C97BE657AD3714DF24F925177FDCD95F83BD35F244F5AC66FFF93BB5438A42E' +
      'FED0DFE0EA5D7605F58182DB4863154931EEDA60D11106AA44AC3F92A08EEB49A5003C3F3D14A6ABEFBD72C13A16B3CE1336A48C6F0BECFB' +
      'F7FE7177DB853D15790358B09CA4F5A05D190AD4949B69959BF1E9E921B3F47B483DE931FBF10F82DDFC9E704EAECAD107DECCF02AEC6498' +
      'AD2A26F4735AAF03CFA8C00549075E8F4750B04AF69AA5BB243F767A645FD0390F3E71BDD46877B4AE96A09B606A9EF3CEF35351445173EB' +
      '9B3E154F642829974EBA42A0285548C6C7212F2F6386A9A4811A848D1B8E1D82FD9D97C3D3D1662AAE55865FC27B912D9AD95D4BFCF4F855' +
      'A3B3EE2C5E22BBBFBC12DD6859BE268A52002860F8F0ACCC5DE6AEE2E7FC27B058D3DAB05E089827393F107E1481606F810494131D41852E' +
      'DE34DF9709A2A6FF2490D6860F2EC608F97036A0C2FFBD38754A557BA0E824AEFC55A1EA6C3D96B4182B2B61AE03F0ED6DA39A55D3296EF9' +
      '10A88F2A5EE08A594FA3FDE9800534E0BB8F9AE0CA82D56F06DBAECC5F6CF8383615EF8B707C926EC2DAFBCD685189F0DD94BBE3A11E2048' +
      '960911BFBDA5156AF469BA637FAADCFE5D1A2D71DF00EB7FDDFAC73E9676B67CD3EC5F87955A67FEBE9665B61EE4CB9DDB5CB6DE54B15AD9' +
      'D7A13FDA933B7E667E314EA3ADEA0D3EF607222329264DE484DA7321C0306AE7A0E0D447EAF01B135BE9AE29EBF35593779DD5523697FED6' +
      '93E5731E8F20AC2070D21D810F0D044E5CC2B299FB18F0DCAED5F17A9B60F63BF05B19177FF58C3BA5BFEB774781F4A12E5CCE979E2B027A' +
      '3D599C4AF9BEB3B6862AC7CABC7337E41DAE8F933EDDBCA4ACAFF6E56C7A917667CBBB6E35043A7F8DEABEB8A71071F3F7FE334F35312B9F' +
      'B6876D6C6F862510D8C0423F34DC70622FDDE7BDA3F8EE3C755311B4B886F5D95EA209D30DF630A3D2D6C514A073AB432EE279090AEC4184' +
      'DC4741C1E2F9A815607047B0E129890F69E47F73563356BE12A64FBD7C8186E7CD1510B6569C175C3E3709E516FBFCAB36C7BFEDCC1EAAC7' +
      'BF0EC33DD061E09CE714508E8369D6A9017949CAD5171E4C65C9F3AD675251CAB0238FCDD16426281EF260D46AC822A6E4C0E4BAD063039B' +
      '6A9EDC8F209D96A6AAC6B851B17803DA00EB071509F6F8100778FD3AC8CAB6A86B8466A2DDC91EA69F331482C85FAE03362E9147F8599713' +
      '70A396783401F0F919B20BB252C8427611234AAEB9B93F51E20603308B9C786A2B4B9FEF1236ABB46B998E66BC6ED6243B997094597F4377' +
      '615254F8D5A07039D100AA8FC2C63088270B7B422841FEF7C8C1B8846D1D37B5AC7ABBA09B3240087FA915A8D439CAF5F4620CAC0C5A2892' +
      '38F0490321CCF3DDA074D9D99D69732D7A1C436208F5BD2D151B2954EBC50AE5DD448F86D456A2A119D142302EC47EEDB7A6D6ACFD418D07' +
      '196E87EB9C93540FB474EF6CE9EB2592DEE403A153FD38D3E38354E44321AA6F9FDAB45BF8D9DF93CA0DD03FB777324D32232AB266B6F12B' +
      '36571012549D3C044724DE68BEE85D799305A53234241EA3821B07B33D9F93EC3BA4EFF85538D8CBBF74C9C4F623BA676D05D692310F8C44' +
      'BF8035AECA8E54164BF82C6FDE73EA8E41F8477C11B9F2E085FC4F99F49925DB0E8FB170D81A06E4FECA96D8AEE4575C7AA5C9CE56B23B27' +
      'D976F94A1A998A15F66D0E083378F438604C466F05E973229D8162475BF72AD0A06B0E9264E1E97557286A2A4CCD3909FFA2EECD7B48286F' +
      '5CA5CF5AB740C3DD5A1EBF8396D7CE62C2D308A81D58032C76678427542D344EC4B1411CC4463792E418194210C549C7C1A78A82F26B6893' +
      '187C665ED279D74052FCDD983A11D2049DD0DB3D549194B847A6B86FDB570EE9E9EE624494E04257C00FD704278B066898A2D65DA36737E4' +
      'C51C46506C8A74C1784C5D52F7626394EE787D3B88679867D5ACECA153A9E50FB8B7C8ABD8056CB02E88F40AEAB034B083E81AAC455EB87B' +
      '08DFC5E5F86B82FDB1B5675F42A808163582F6D46AD2D88B0E98B2E3481CE26488822677D5EA144627A270750B5E768470F6A89C5EC69309' +
      '4498F663AEBE5DAA58BB50E6928872AA04C28B06761FF423442D7009E086B8992F32B3E89A5104C02B1C476CB97D517081E35050AB64E2A0' +
      '251E005A8ED102F487D12EAF6388946DE5048FACFBF2B318C1C9E86E318FD222D73CA5CAB355231D7E477EDFC2C270F7E2A1C16C181B63A8' +
      'AC9945DC452CDEC86174826B7B0701F8922DC15F6954A4E8C4B8CEDCC5A2E09A8201B63551CE13DB8C74FCCDCF73D274080CBCDBB661DEED' +
      '0DE8BD405C6B28DC4BFB7F549B854FD5F4DA0588542DC72B0E493B1576E8D763D85D97665CFAF4A69D150D2FC0C26EDF596B46998830E065' +
      '0A215A502F5CC10EE7D2C026022309EB220E86D11A770E3585E2158FC45BD53115B079F028ACF921BDC1BC742A3171C9CA587AFB69F541BA' +
      'E63CF24499E4F0EC419A16D5982031EB25C44BCA6CB06FF9271CFA1416F48B5A52BC5E008482221E1E2A32D787FF80003262BAC0E48733DF' +
      'FA11F3F097BFD978E502B22AB0329C0E212CE9A91F9528233C4E263CB002FA8BD291EE384630C414362B21E3FABF252AC5A655BAEB46AEC9' +
      '4D013005C957E0AE3A287A954B3A9458D698A2511B36092E2BBA43A6792230C219E81DAA2EA6985CB50DFFB3E3B80AE0E2511654BF843552' +
      'F582CF05BF5D82634983A84776B246955E8137C7AE2860AEBB1CEC9D4E8DE7C591E93330166F8E10FB954DBFC4635D9284F1B4351CA43BE1' +
      '4EC8352D6D365351A5A9F3C5831ECD0626F5742CBA5481EDE013779AE53E457DA0585627C332BBAE35892C9B325A2CED1650EA8C56F592AC' +
      '9FD6E3D7BD9C8765132B1E2F676A25248EDA8190B483637622A4EE98B5BF37C046A670A8782E1CCF402BC7E71B63C29C636B00BD6DBE097B' +
      '4D1B25F8AD134D39EC0C3D42E69294C94C373DCC2976C91A07E92A3B658A576C07CA2972940B151C152542B5D03B10445DD45D2C4409186B' +
      'E0EE1285FC97A30958B5B641FF31571236DD4EEC6B919BEB05580B7FC4138EDB82702DCC930999D187B2904CDAE4417B789BE9C08F46C40C' +
      '17D06A928E4CD562D186BCBCAC149BB2B3156FC32813E774934BE48A0A2DE633807D716C9E3B79FDE6FD3AADFB25F2216BD9D9B94658A901' +
      '81D791FF5CC4B1F7E198B699340D53379DA50D6B2A323F4EC6C8A2B85841188BE816D10B7046C52409D9453B34A258939C161F738F97E750' +
      '474243CB3EC748C4D50E70C3A625AE3B900F5A5BBCCE83FAA9B5E83E6E55FDB039C628E0DBF50011BA0560CBDEA26845332C19B86DE87473' +
      '1C2559B97B710469EEE48AC39D7A5F8D68CB293F99579A471DA90A61429C7556C2B3DC550D0B9889FC6A62C63A4AD2797431F40A6A8FE2F1' +
      'D36D56820A16807784BA4F1684619C33E85AC497647A7A2C5600E64FB03216173B918EBC4543FB716A8313A34ECAB7A1B143737C2CA88F76' +
      '3D47D708F6A0DD1BD3651295B77218564FA5420FDB1DA382363661D62E98F4C49190B699264B42619C1C346B8E219BF53314C3D7AFB00F8D' +
      'BA86A98F7E346AF5BA9E15F313246099D7CBC079AB2788B200494BBE4DD33D5F78DAD4BAF54497D88D9C3895621E3557BF343A3B45822E92' +
      'C6D1CCDB6D1C7C69332C91A9645E119956B57C3BDFFB93240EE7288509354378F94F727EB4FAC2B8A63725BC3C864453F52DCBA02F29CEDC' +
      '4E5B74BE33BA4FA3E4089145DB990434CC9B17F11CB5DC64B1149A0A89034AC39C0E2EBC3A5CDFC1E5981DDF792C7235C81086D518F51AB1' +
      '6753E03A302C492B92EEFD70472DD6ABEB68E710E05CC9F1DCB080F89D88AEB44A9C2073635B006FEB6A5BA114DD11B632CF10EEB3E7B47C' +
      'D048DE25F7F74D05591D42D62C5E307DD2CA7CDE9481E20860095A87F030E1E8AE4DE86909F99429DAB251456C0F2AE6BCD97F1B48C90394' +
      'ADD7FA686C99B214042431491CEAF55B7F7487B99E88F2DC98B21C71858271294CE9828091462F0DF0897EB16EDBDCB05223A536CC71DE59' +
      '19A08AFC64E02F728993095375D674E99AE7ECF340529AC406EC13515B37DBE2544366CBA86DE4A7EBAAAFF9AF464F0E7333E2E8193FCC58' +
      '25E064385CFD2377D795EC6B0329EC8D148BA8C49EDE431AA0817DC8B8E05D6CEE0D48F29E89C786F4283670F93CA468A6BD57ACD4D9F79E' +
      '0E741420A8377B01BDF9AE490B29D056C1CC29547A35455126CF87124027C4581EB959473264782CE3E176BE2A80C7770ED0CA9B118C110F' +
      '0F1DE244C182B6905E4F389490B40D1781AB64D8BA08E48492DC30011F53D9C042BC8ADC24E5372BDBF332F292C963A84F4F2C31BEDDC932' +
      'BA0824A36E45E188178BF0E251E5F6C824A54A1AD0CF6D59DCE80D6A020FCDE1634B3E7DB8CA410195B52A35AC68A7C396687577208AECE8' +
      'DE263030B42C3E7351AA6FDA49A9BC994EE496D52615BD83080E334288F265122B38F4CFBDE2AD0BA8BC0AB7EABE9D4C1D43C2948063E6AB' +
      '8ADB1C439D06AEC66EF345E13B60DCC8A627B9CE64B88BAAD6C85020E911045D7D473F119EFAA3209024A2D9CC100F8FBD6FF3FBBAA20E29' +
      'ACA0E168BA79411402306D8610A55B5F305F31E5BCD207E62818E04D385D84E3B51E8B8825519C6029A5EEC94E7BAFB7FD4CB69BA3D00211' +
      '17EBC64AA336FCB508FA628D3908E15C426EAD503D51BC55BBC5437C6612B7E63491495D8459C09B8B42D7BBF748DB1C2E96128A848ACFFB' +
      '8E66C9190EA9991F1896EC5B97C32F325D3CE562E3389CC96F563025D42D590377421023B09AF1803F586B57247C88AA9B7E38E30CED6D8D' +
      'C86D6A7F21A373C2FAB0629E490D179F7B64BF3D5F2706B3D04F6D02009BE528BC9D657CE72CD2EDB3E4E6056A3813C6192763F02E02651B' +
      'B72F413463C87910141CF66BB66A6A153C7BDC9C7D62B8A801A468395A75F2E1B598036F5D336850174E5AE8109D26E7AFC016915F0853DD' +
      '177B4507EA14736629A82A1A98F7E4E6D1B8B83C8D69432AE89D41A94D2A1C7A19EB660B5A7B3FB63554895D2EC103CE13E855B32CD952D0' +
      'A073ABD8B69F129F9C23AAE4E86BC6526BBDC5C34A3C0F713C9C904069C4A02BE48E4CA1E5483CD43C233B8D625C82DE40DAF49E842AC702' +
      '4A232B25633D74307C8F037D3BA1B18C1222909945AABE2648AF056A290CE65D76E9FAEEABD3B678783E1C2F8CD499F1E63F74B263121BAE' +
      '368CEEC5081F82D66FD974AFDAAB0473E401'
  };

  const PERK_128_SHORT_3 = {
    katFile: 'PQCsignKAT_164.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD91282214654CB55E7C2CACD53919604D',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADDAB066E720DB3A9DF62AD80C8F24BFE9040ACA485C56C4A0B4E71733C44BD4782887D601D57DE29D6' +
      'C8A8F7C7CAF177077A11BB3F14024390B448632BAFAA0F1F86AEBDA57B7A703C83260265118735E79DAB33649E9199B5D187C02435C69DB3' +
      '6918EF7DE373C0A5451C86B901B884648010499D95B9802D7ACB2E53CEF16E7CFE7DB001',
    signRandomness: '4249E0458B874D2CF0EE707DE4068E75F217BB8E877219832DFCEDF6AB029AE7D0B4E078D60D8467D1884563CCFD66D8',
    privateKey:
      '91282214654CB55E7C2CACD53919604D7C9935A0B07694AA0C6D10E4DB6B1ADDAB066E720DB3A9DF62AD80C8F24BFE9040ACA485C56C4A0B' +
      '4E71733C44BD4782887D601D57DE29D6C8A8F7C7CAF177077A11BB3F14024390B448632BAFAA0F1F86AEBDA57B7A703C83260265118735E7' +
      '9DAB33649E9199B5D187C02435C69DB36918EF7DE373C0A5451C86B901B884648010499D95B9802D7ACB2E53CEF16E7CFE7DB001',
    message: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
    signature:
      'F217BB8E877219832DFCEDF6AB029AE7D0B4E078D60D8467D1884563CCFD66D8D80641754000787F27FC012140D5F8705BC52514F6E33554' +
      'A9C522A7BBC0B7788B466D190DF308603791068377C5CDEA24B43803E535C37B080ADBA28A2152C0B9077FED52E570D9F9A63204063CF86A' +
      'A02198CE76D11671F1A618649768C49876233830EDDD1BF4DB0B71B38B61DE639ACCF32C82478C437247A73735E2DA8F5203BED37395E07A' +
      'E29C67B840792284FE46D51C19C0A94BD1C4B280A903293B410C8471520EE1D5F034656FACF51696DB687FB24AD2B3BB0A9F68D8083AA74F' +
      'B2C1DBC604DD80CFE30B4C9C3C9C79C5D81C1A47337C8E90BCAF7128B98B2BC01B9C44D35320D36DD6A8CE24E30C48C1B08C261C3B03A413' +
      '19AC1A50F09C9F369F1B5F3089BE254BE3C9736068F691093EBB7F6301C947637A1DA292742F7E1A0A6AED3E07D457620210968A85374AD6' +
      'D0FD3F966AAB170F8B26EE52A68F74953FF8E91CA853AC796A3AFD7F56B18CB024EA9456E105A8BC4B4D9D0F7E9F8117D38C4BC99089D548' +
      '3FF741069F9ABF99E552EED0C834D6B457E5EE6B7304A59CDC42AFC6CD3F42F59CA4916E7CF778F68B0C747165E5CA6096999AD8B4D5B8C0' +
      '25F7163ED833A44526137A2BDFD1BC9DAFADB51A81B5DB2824E256E503CAB07191D6AD03BD31627026F3666102BAE0DD87ACEC5AA2C4B4D1' +
      '9A632F48310C9FAFA2C18E618AEEAD5B853D298AA240288EE3A5D263B495E953BE9B628E5A21BE7027E636A767F3B2F277DDDD10FB0FC710' +
      '8766A75011184B49382B19BBBB4323EA0D92C0D8599F5F07DF7464365E4CC7D38D3D870A05263EB2511700BA2AEBC243A47D7579D5F78BF7' +
      'BDA4C96ADAFC603369A0EBDF61C73FC7BEDB98B287326E0F2E473ABB7C1469840A9C2AEB0A76554B05528DEB5D9EC16C905F7211A729A44E' +
      '1C0E747732E2F5DCE85F2BC08A1870DA91D1B0C0A206A32412FB3136D8210AD32D60381E4BEAEF8A53EB58AE5D7FAB9B3C68EF95CD3FB2FB' +
      '2B1777B0DEE27CFFB7171890730874E6B27282DDA54EF3B48AC83A9773A861AEAC625143CCD29CF83E51D413BA5FF8D75C22519A0A18FB7E' +
      '1989EC6841F433A8978AAD02B98BCCD230F4B198267D2BAFF4C4187BC1BDDA7C84586C835A0D0EDB131ECC2FA0884AD26BCFCF9031943751' +
      '8FA4F40874E2C77D95B19C54C69CBC46DABB1EAE45D60125AC94B99BD5942B2F9F42D32D0F4BC8D46ECF62DAFBD2791BE8A5682F086FA6AD' +
      '09C7E0A594A8BC4702CE24DE190868A7B74D253308D7DFF601B7A6BE82CD9F1ECC53BD3476C2D32DF45F928E899ED9A5E4386B283BD11973' +
      'F150C674A7AD046B1416DD2724CCB989BE0CC32AF4F87BE6505D07D557A952C62B01628609C3307E4B84C116009694768B2F1534F0F0DCBD' +
      '75B800B17433406D9C8CBDBB43760AAD9CC2A5DC7449247D66AE54F4611D8B5C0F536307054A710D0E6E5BF56118B1D91FCA9BF954BFC4FA' +
      '77118E3550D3A4011C744EA2F5741D9B6F9F44771D95F3E2F044769DFD63A7A1664EFB3BA49E5FED1FF0F6FAD68690EC50B1630C504B9C27' +
      '4E784E9499C899A612EC8CDF7463EF458ECCA5AF9259251E62D98E20C44EB9ACDC68C30E4A155539101782181DED5824B7CDB55AAC4B0428' +
      'BF50ACAD1B2C829BADD0A18BDF0D0DA0857C6F744562E60EB037112C255850F90047229BA68E20BE7021F69B39DC7F2B6C9C9E871F40C422' +
      'AE00D958CE0ABD027134910D1700639BB89C6ED8811478243CD53DCE0579E32FF1EB5F7394DEBE550A2AACD36C8C43872B06644010A9DBF2' +
      'F4B0E740C2CEA14EB86D9DE4E31D99C1C59299BADED32225EA7B63102129EA1114F3C604319CDFACF95A4C230F94AD63947FA38DF8EFD862' +
      '503D7CDE8F56C99A2E6E975DD8CDA05A97A65AB3C4F24AFC58E1E8A285A1B718C1FB2A5A8372772C4FEE9C4590D51326337C8038D64B1478' +
      'D626EB3A1045FADF8BFA9F1371AE5B292A5AB23483E34DFD3A4AF0ACD8FE092DF441CD914C3129044B6CE3A6D7AD088C37A73568212E1BD4' +
      'D27F95D2F7EF631D945DFA5C42B6CF4979CFAF1BF3A102662380A87D2308BFEF2CDF0F4901CFC020441F4962A54FBC7C56AF13C1F207E14E' +
      'F0B260A2FA33924858A7D831225584791AC1FE76574C67E730643BBAB526E3D9955C5F1E8872C9064373F718ACB1F292391A76AD1E6ABEF9' +
      '121BDDFECF0ED205F6A4785F93C6C28451B0ADD385498FC47F0266E9951562C77A4FAFDA2D0E78ABF63CB6FD8AF8BA07BEFA41448DB40863' +
      '011915EB163EE177A798217A335DCB4FEA83D508EFE3E75237D594593BEB8B9B995847072C195237AB64E7A68A2BB02BEC7D227C45724677' +
      '1B3497DFD73C9C2D60248BCA18447E72CCD2F2A54D0405FE7DC12D941D8AEC32CB0A0B208155F092D4B8EA1DE6D4E3C971881749363288F1' +
      '79DEA6D0CFF06F456E75A0DD48B25773F269C5289917AD8B95EC29D96D86A3CF3ABECBDBED4370E7BAC114BAD05A2A9FCB6607D7EB8DAE08' +
      '10B9EBF639B6C7A27B603B9FE00F553F8E8D94B1811C32773306B54FC17E870C3EB95EC78FABF1D38335D3313C1B44EC42E13A0F19048C87' +
      'E2D6981093D9032D8F997945914908D463854CDEF3A87F104DC9B4DE0942B4D26E0D88A023F12B281BF8F8A52E711CFD8092A54989599ED7' +
      '6FD832504306DBE690F14BE95DD8177755ABE7CE20DC6DA987D3E3EC6D1DC8712EC23817E6408084967A3EDCBD3016B7634BDB49B1ACF574' +
      '3D63A199ABB55B873513FAFA97BC13A48D3AE4FCC71FDA655F4E4240A31D384CE703D441C4F6AEA4438B734076727F0A2C2CA2E68EA17A38' +
      '7812F425AF018850657E000B21907AFD643FC5943AA07BD9E35DAB40822F9E6C974C7E53593FFD9DCB51E7E09392C0220B401200818E8476' +
      '3E74AB83FC69958CA31CA1ED147B628DC610A9C2F14CDE9784DA720B0A3207B84DD958A0088C9F0865E5D89E60A9B8A3C73AD61FF08DC7A4' +
      'D72E5E1A9634926C8AE6FCBC2FA6F3D36637E24A2561C448D491E2652132EC1C6B6CB03A13D92922719C41EBCFB09CBD25E2DE88DB871C87' +
      '63197DF96BFBE198B573FB990B7620851D5ABEF4D8F05DDF0C0F5ACB4452C2BE7DF8AD8DA4BD8B126C9A334081BADA50C3D736D46D5DE29E' +
      'D2CA1FD8A7F53D1E63398E473066EA65AEE670AE4CF95420809DD350FCD35A220A487AFD66CD73DDD8942D5AEB0E177235BAA5EA74ED6F56' +
      '05FE66E87BB63F359A6206ADEFEDE179553AD83C4E3960DD1FFD82C06CBCE99A6B77532E4CDA45F727E4EED842FA9B9F4A5460305D495523' +
      '92A90A9059D5B8FF59D55DED0C9CBC8417209708D9E9EE09436B51DED3B5358F4577889E974875EE28928C701B2C27F0B4F13242CD9FCDDA' +
      '0F279DAAB0449D4ABE0DF7FC03E7C8F503F553A2C76F7CFCD45127EB2215E2D38BD3469C1A04DD0BF88732372039285A328E32AC8DB9789F' +
      '4008A68AC37BC0BB6A1F6C3A29C1A3950EA2130B63BE8B551934642F51C91A7E29E545C31C1D1AD36ABB0F4028AF54B2B336B0878CCD6C45' +
      '1DFF47C7B166FFF0F0F43608F0913251FB04650A82A6840612DC553D88D31EB88CEA2291039C26FFACC8A16C3F12770EC14337FB436B1647' +
      '40D87E6FF1A17DD259B24347E569B8B13AA61C43A94C58AF971EB9B555E53C91E7408DF8FB28A71835B0FD146775EB153E8E724382B0F73B' +
      '57CA8A61074B9A42AEDD176F80144D651425F244709FC61FD58D221A33CC2C51B54C3F63BAE016E69873459AB9C962E4FC55D023574190C4' +
      'C5ED01919366D21E9CF15D0ABA5F6BE075ABCE8DC22502B22A656F522817083F9AED6AE46CB72F9CB760E9EBC9E1CE746072059D3D200CF0' +
      '878A9E6F46049F5EC607C3432AB516F5F44F5F46DB69056F27706E33397226F6912116B8978BF43F9C28BE7A987FC971B5C9FCD9FE681E37' +
      'DBCC8588C10791851CFFEF356FFB972CEC51547D0860A5D123307895FB9231A1ECE9112989D67895DDA373A4F1FEA8832B27310EACCB0A39' +
      '225CF8A52BCA30EFFFD989CF9C03E96CBDE21C19E5F7FB0C287E165A99ED1B4C2F3FA70C644C8F4912789C79409FA395F3D53B1BAD57FD30' +
      '213A63FDD6E47603F890D847F52A9D84E6D9B665DE9A7FF45A6B714DAF14AED345B78A24CF7D02CD8AE5C6116CA4553EEAC6F50626057D1B' +
      'B8D3AA8692A57E2C38F3E47CBDECE24E5CF2DAFE9A514451FF840F637624157AA71170F856AC2CB4F248A2F20E36B1CF6895EA444F9DFBE8' +
      '2F2B789668ADBCE27AC57D74B0B63B543758A63A34375DB34CC2B516574FCF47FCFA92B8DD5D3578A42685BA570E900EB5E278B82D2DB060' +
      'B1E4BF361067C260A195894DED699706D5007E1D30D015CBA162475AD1B8B2BCF61E651194F6E01E54407F458CF325B0EA78E8D6F1EB8F31' +
      '72BAE8B3281C8A1AF21E9F09DCF5388858EFACA969181AB45FA7B9F433F732F0300611D0A47163BDBDC40C138ABEBADE89D00A0AD5217317' +
      '5ABC01AB29EEB525F9E9616E49D53E6D21480E892AEC6FAAA249B4175DFA029F300DA7095A45F0EB5DF7F64443549FC280D72F55B63FCBFA' +
      '6C59D2D9C74689C9D71E5F31363CDAA7852F0E859B7C556CB3CA957D131FC63AFB8CECF23C78A1ABAB36907CAFE671A3204C0DFFC7B7F394' +
      'D66699AB274DB388C1C688FE40431E18910639B84FB039366B522E379DCE9146CC2E29477A24A554F0F3A095709E83D92063BF2E9026DC50' +
      'BBF9D65304756BB4172D555FB15588756F434F1C91842A004CCD87E8BDE23862DA3E8BD47AD9DBF6625AC27E43704582245A90ABAC88A9CC' +
      '46A0EE772F1F9D2ADC0BBD52C399A958CF5DECA0096AC1CDAA6CF7D11D48BB7B5D19B1C43E600C5C503D365A2E4E2B7ECA19555319E96255' +
      'A531F904F27F233A6CE472FD3B8F13F1BB9DDF2201998DECE9351983709A3B7DD227D1DBD96A86D3D51FE11C718FE09272497C25D3593424' +
      '7285DD099D11E2E2AF688555CD62B52AF861349EC0BF1A1043C2251EB5EA6F3E0DB649B84AAB4AFD05599F2FE0ED67744D0529743AA3B1B6' +
      'FE78995BBCBA37BF30F34988435F33BA1D4BB27DF11443154522885332C34E659355D6CDE6CA117C33A02E337BD3B81F1FA87CC4F5F4BAD6' +
      'DE542AD0CF2749FB5129EB89E13338577731CC6EB479202EB11621B2DB9C1D3811F542DBDB4468F6F50E08BDDAED478376294CC3AAEC25D7' +
      'EF5CD856EB783E1FEF3A7A3EE80DBC82B0A768978003C485D7924DB23D98D96370955F9E6649227975E7252FEAF9DE67D5FA29AAC56D3FE3' +
      '20856A44F880426FE23E021F7703A885B63337E83ED0575DC64110A8DF6DBD5D0755B107FB6BFE6B6660434B7CC3EDF66DFE8DC58916A6DA' +
      '48B0A4FF82DD863DE2DF02DD2979D85F8313718A591958CEB967355705F98A1A90F4B3D64BBA0CA22F9B05C21A84968A8C9244DBF50FABD2' +
      'B13D80579A3831D85737F53ED643FC643053996A03DD176507E0C0054B2F355B04BFDBCA5A30D132F2898A0330B1C449C069EDDDFDCEE8F3' +
      '9F8E838CE2146A684B0A9B3A7AE7C62F5ADE8AB0C8F2F26C955E9AC1DFE95EF2CDF9323F13C329D11D293FB11EA5E8EAC4594E154F3FC3EF' +
      '0420458107741EF98F51AAF486E198FD420991198407FF8909423F09E94D92D0E8514F395E303A9FCF14154167E547B50D317CC14E7D3DCD' +
      'CFDA466F843A0EF360071AF19D693A994228F74352D4E3CC9E173B523B8A610D6F0C5484E208E4D6118B5F6179B90F4680B03E6723579BF3' +
      '48F484508926018FF25EA9A5D560C504F01014CAAC09D6A79326ACE37470DF8AD105CFB4484A89FB485F3E48852E007A7DB2AE930AAF46D0' +
      'F9495AB9396C712F363157BF76B18C2225DA3DDF1F6B312B318E73C94B396AE539B1AF0AE42FB97463461AD2E367AAF5D1273203BB105082' +
      'B65A0460BB57D27E8BC7984AAB17D1E6AF9010BE68091FF3E6A32A011E572814A1A6621FB501472A10E3688AB39A4F9E2001309627BFFCE0' +
      '83CA3A25A7F86D234E4052FB03DF03F210EC929DAC87756530DDDBCD36D1CD8D3F8C2D648B3FA61194B937F250A34897293564B0D313E6FA' +
      'A0F2CE3BF32E66A11E249C5BBC189EB148C7AC529286AAB3457F5D7133779CF20051A2FA73F9E48715E38F8BA732916C537E60A7A0854A4E' +
      '75888EE8D3EAB7189547623B056493127F5DD19E11CEEB0E3D702E1184536FF49F224716C9DD59EAB2A6797AFA5A4EC728E376F0FC637F3F' +
      '712E12DB3EA495482D5AAFD4D5E1669022A5274ABC80EC1BC121BF94E2CF63D4D481364A0D11FE8862EC81BC886EBBE05FC1746927F737D3' +
      'CC5CAF9074327FB5DB86668652313C243C767E77C74D2E0EC49336AC9BF8AE4A83A2FB3DC886E95781A28BAE48E76EFAA447C692A70377EE' +
      'F07BB03FB97F56417CC21620A637917B3FC9262B24C48B77C2EE13014B7FF00B910D86EA562C86E11FCCACCF19E525D26D1D8986968C8A1B' +
      '0029200E7A6298AC9895C71FC285D1BCAA225240B3397D8D7F66E6B539D00C481A5E208AFF30021A9B3A35D76D5565410C3AA6721A1D2A77' +
      '3F5A46E4310C311E4315A9B4DCC72011DE8CC648DF1AEF7551FE7CD324E6BCE65E2D705131E71FDB3EF421330CBC49BB27E785E27C6B2604' +
      'B24073D5AE647AC9C1CD240351E33A5B24BEA33F9C54BF0E7CFE41B76ED217B044F3D8135CCD9627A55DAF50043C003D67D2C65021731C2B' +
      '6788796CC7455189091D461C1C928CD8B3E87D9EE56D19E39A71EE87F2A4028F7271D5838F52D3CB5EE5A77BFDBE8FCA2C95A3A9E1F4CF35' +
      'BCA30DE5AE3FCA1A23E9D46F9FD225D35F29AC2F8537C06050DBCE36421980CFD3667325375756B545A2E5E0187E40B871A8ADA9E8B3237E' +
      '300F95A79E1C368814A79BA106318B6FA90E19735963E8092C04F11BAF620557CFECE233E120F36E1A6FBF6D4058E40AC359E75EE58ED7DE' +
      '980F234FAF938A823715DAEF7DA718C4552A24332D6630485FACDAF411AA7D16D7946B93579592B54CE3F3515C41D25219819CF59E73A121' +
      'A66CC0A4D7EA755EE1D4FD4FE4BF536649531DB6E590FB8BAC970D329F0A227748CC0E8CA3AB5468A0E1949B58236FA9BF04DBB28BC5ACEF' +
      '6199C386CE55644C9219CC52368AE43438B50FEF1982773EBEA1A63325BBD1F12E1ACC2BFFF81D638C96E46D9E7C0C6358C6DFE5E28EE960' +
      '4458664376893DA9880B69EA516041390475C332BB6EBE9648CC88DB363CE19F861DB8429EF4B28C4BEC25557A4E72803C3C0145AC8BBB97' +
      '862A7DE85852D77CB247DAD4532311491E732AC0C57CC8AC15A8864558BD2255399922A2816CB62AAABDF6E0F0D8EA67E62B68421DEB0D20' +
      '3A12DA2A08D9CE90190DCDC792C6BF9552AFBE2EDBA65392874655541BA8DEA4C9C8C6C0221725971F25BE30D8170D17F13CEB516436168F' +
      'BF62D011F505C1D76CCA55FEF9E264EAC29C538391D9005A4663BBE1595DEE23F4F0626642990EE18F17432FBFE1D7F634A7194343DE5204' +
      'AF9ABCAADF47737F03CC9176AF848ED3F26D2F073A5935A8EC337C1B29CD668E28A5AFBD3D5CE4F33479B504E40E058E08B0BC756203FC84' +
      'FB51A6EA2DBA4256230C669B846DA231428F38AE95A802EEC68261973E87DF508297AB3FA64F2A5663033CBD1507A7107CF68323A8CDF901' +
      'C03C881FEF74A82E721CDC7E959B03D40632FFB3330DCC6E387E71ECDE7EE31CC1E215477F70BE107C66E76E890F4630EE8CD14335393B39' +
      '7D1BE997D29CC9EA382CE5F6C595E87F48E1AE6C92BB11AB6875990B0E5EAAF730C10980F81CB9CAF7E3312F922F6A774E9A373CCAC1AEFA' +
      'A5E5C260EE10031A5C571B7138B78184DFBF8EEC06FABDF1C1728C7D13DF9D45812431F90FF0A00138A131CC2B32BF5DFCFD8F4AD9441EC2' +
      'BF0F80439C2BA05A66CD8F06261109342C3B408EE6384CD94195650B0F4E694B753F85A93343292EA8DE91A0C3097D3F67B4424C6F26D055' +
      '9A648F1793691061477679424FEC126FC7D1F87FD923866DBFD05CA0B7A0B948D7EADAC78F292AAAEB10DC306E5D72DF7AF9A59CB8C9570A' +
      '5F374B4B0DE248E7EBD868E942D4BD87A6E36AB3606B65533087CCB304531DD2B4E6CD80CF833C63F17EF1BE036871241382EA4149292F1E' +
      'B95ED6665C192A1F017E3D8D85F1535BD7B3241C544FCF7DF0414FB04443880E91982EC6B4B7093B020BB50B05A2A3D9726BB678BA6A3BAD' +
      'BC0C32AF44F09D584A26F7EF867758BBE1E4D0264B36F6BA8841BC6458E06D0E29860976EC67E3F10084C094C51553132225D243FD389D30' +
      '20233B7E1B66324ECD30B74AEC3512BF767E76C1133D46E29335A9151528B29A877C02F9EC89C2C630E46A2C5B8E924577A532CFE455A2F4' +
      'B55D174A8B5EE1642714C6F93C06FB3502570BA60FD794F4D7C2CE3238540FFDCC1D976C52E290D696607608E2CE8DF35BA114B555602755' +
      '38A14811D8E1050C45B656CAA1139749EB5A4BCF5124288D22CD4DA10E235B67C036FCCF790CBBAB240754987CCE1B12C0E9ACC39349306F' +
      'DBCBF6E58B0E16ED7B2D6926DE4AB6C3CA5E93D51319FF9E44093B8F75CD306E37B4157E6E581D21CDBFD0912D95768CB937286FE4BA0D03' +
      'E10F33C6DE03B68A741701B697FC08D54096DFBFB7807F2265FBC6DEC556D8309D25263B1E3C56F41DFEC13C14C52C6B09DF260EE3156355' +
      '8A2183217F3A722A84D441A1BDD5E56E964047F9A55E3898FC2649EBBC718606F50BA3A0D7C8BDC8B7069CA4D53A99EF8EE06586509066A7' +
      '8FBE719B0AC56AD787F1E034D4C4278E5929395A0ECFDA86FA480BCED02DEFDF786008'
  };

  const PERK_128_SHORT_5 = {
    katFile: 'PQCsignKAT_257.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD91282214654CB55E7C2CACD53919604D',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD59BCFF353C091F9C56165035E67CBA7A9A175C360357D2450BBBF2CE13133992A2E8F6DB40255FD9' +
      '7D0B5A4115CC6A1B36B26B63AFB32B4A1F97C996A920F1633DED3D856C33B4378547545FF86264E6F81D123DC49218367EDF45D76F933A60' +
      '2DF68CDA3FF13FBC58AD246746C03CDAB06AC518B22260E5F79F2ED12B3F39EA4DF8946A53CE4184F970BF66FBFD7824574EE4090634A301' +
      '26064B4858EF3773438381EF847B61CF1717B2A326C503617C940E80F016995B04B7CB42351F4DB7DF5A5DD655DC3CD90930BDEE008F2293' +
      'C5A7C116F7D2E1B3785BC6383661EDE8B8'
  };

  const PERK_192_FAST_3 = {
    katFile: 'PQCsignKAT_251.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB14803E92380F3DC00284E8067C4BB0A24FD733CBF502F9B338A4A8C1EA4DEE6924452' +
      'B526B061E87ECC0C0A8C8A67627F319B536DED4051CF5308319C8D5DF3149306D5F77D7DEFC4863302CE71685BC990C92EF73DF7009794F3' +
      '63188B23967715D29AC7AA2902DCFA12E496AC605CA8F9E1F8543A472EADA917E9B30D5D3DC12093D1296B258E499BC24730526EFA138A30' +
      'D73FE3E817319EE68FBFAD4F878DC9F776B3B6026C3909F07ED186AB2545E890AFA492A0EF1E5DDD8F2E267BC105021D083332C1DE51AF6F' +
      'C8770C'
  };

  const PERK_192_FAST_5 = {
    katFile: 'PQCsignKAT_392.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB14803F73F0EBACA0109202EC4211BD22C6C6F84C6B1C28B523113AFBBC29E7ABD514F' +
      'CE33572EB295E0F4A186E1A0E75624257E242DE91A18133F3FB83E878AB11B0309069B84D1570C11FB9A0046A1F6C5507016AC520B785644' +
      'EFC99D658C34F89C5F5283D0745600D7B3A113AFE1E210CD8030170D2FC5C9B5F88F77D69E050B909B34D9A93052C6AC7EE1C7E1F63DA5B5' +
      'A1EC00145ED2D11533CB07CCF12F1FFC7CB04FC75376B39BF44F6E5D0B7906F39B5F5EFA6437F9C5C33BA3BC029522E88D3322FA9F0827BF' +
      '58E9B0A39A1928D20106A7E755999245FA875243B37933BA3C63F90E3F489F24117FC790632A9EE558249F16508BF71EAC89150CBC07EF2F' +
      'D5B82ACAE225605D698E2A943EFB3F2768F6CB8AFC41D8B5FCBDDB5F3A058745D6548C17AF3D17A26D6BF994F46EED3B06C7EC10772D28E2' +
      '5389FB428BCAD7765BC5A0EF247A2F3C2F1E5AC0A23D7DB18D8E4D2DED2B1D0A'
  };

  const PERK_192_SHORT_3 = {
    katFile: 'PQCsignKAT_251.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB14803E92380F3DC00284E8067C4BB0A24FD733CBF502F9B338A4A8C1EA4DEE6924452' +
      'B526B061E87ECC0C0A8C8A67627F319B536DED4051CF5308319C8D5DF3149306D5F77D7DEFC4863302CE71685BC990C92EF73DF7009794F3' +
      '63188B23967715D29AC7AA2902DCFA12E496AC605CA8F9E1F8543A472EADA917E9B30D5D3DC12093D1296B258E499BC24730526EFA138A30' +
      'D73FE3E817319EE68FBFAD4F878DC9F776B3B6026C3909F07ED186AB2545E890AFA492A0EF1E5DDD8F2E267BC105021D083332C1DE51AF6F' +
      'C8770C'
  };

  const PERK_192_SHORT_5 = {
    katFile: 'PQCsignKAT_392.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB14803F73F0EBACA0109202EC4211BD22C6C6F84C6B1C28B523113AFBBC29E7ABD514F' +
      'CE33572EB295E0F4A186E1A0E75624257E242DE91A18133F3FB83E878AB11B0309069B84D1570C11FB9A0046A1F6C5507016AC520B785644' +
      'EFC99D658C34F89C5F5283D0745600D7B3A113AFE1E210CD8030170D2FC5C9B5F88F77D69E050B909B34D9A93052C6AC7EE1C7E1F63DA5B5' +
      'A1EC00145ED2D11533CB07CCF12F1FFC7CB04FC75376B39BF44F6E5D0B7906F39B5F5EFA6437F9C5C33BA3BC029522E88D3322FA9F0827BF' +
      '58E9B0A39A1928D20106A7E755999245FA875243B37933BA3C63F90E3F489F24117FC790632A9EE558249F16508BF71EAC89150CBC07EF2F' +
      'D5B82ACAE225605D698E2A943EFB3F2768F6CB8AFC41D8B5FCBDDB5F3A058745D6548C17AF3D17A26D6BF994F46EED3B06C7EC10772D28E2' +
      '5389FB428BCAD7765BC5A0EF247A2F3C2F1E5AC0A23D7DB18D8E4D2DED2B1D0A'
  };

  const PERK_256_FAST_3 = {
    katFile: 'PQCsignKAT_346.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8F',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8A8E11FA43A9E54DC3A97B684DF755ECA1FB75E272CF97BF' +
      '5A663A8C961AF7EF6721970EAD6CCD5CC78BD728AA7741A2B06C6894367F0E0FFC28AA180CD3E88278A94BAB5D8CB67841ACA5235BDF5542' +
      '9C6F3FB482E057DBF1B028EF8C7880E3D33D03D351BEA85F86A45E0579FD9DCA4B9337B48D14A4211C1B920C78C9025196CA00EB2AD0BC64' +
      'F07D6F0E58B791E45B234989E3A77CBC1C28135E5D482FBE920004C0519007C373C9349C7D3BCC8A64AFB4114F7C67002F2938F02EDCECAB' +
      '2DD66D80A72A32A1FC4FE451CFEA492ED3D59E83C849A077C5FBAAB03C984C98F27799A5751C4E15707CE42DE717CC05C9C95B3909938638' +
      '372750036897AE893F4C74A113F045DA39D5FD797EB4BBA103064733AA6771802100'
  };

  const PERK_256_FAST_5 = {
    katFile: 'PQCsignKAT_539.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8F',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D52983C39C13E764E56329D2894E1B44EBE4C20364E34A0E8' +
      '0AAFB13EC47DD37C4528BAD6C4285BC7CDF55536BD1E02F6B887D3DDDA71CC4FE93C2F9EE9BE93C18F923E91BFC6AE7047832EFF703DBBD6' +
      '1DE6E84DCBDCF7190DB137E627573C110F51AD8EF4171C484C88C5BBCAAE6CC6917E84B1F453FE1DAF055AD780CD6B27CBB9D98ED4B29979' +
      'E5CA1F4858736AD87EC567D715632BD161AB8F7D72A4CAF03BC119F1F7B6AC72D005D316B31577804B911AF8B2F997DB7F8481D35CCDA8F7' +
      '5A8CAEDB30BA23B4C04FCD77D28381A0E61FC360D3566D3C92788E1EA74805F4F60729CF5B67BEE6F7B8EF11E496108811DBCAE6488F5AC0' +
      '62BC415840D9F3A189B7313D8AFA5491D999AF9A648A153B18113FD6716E5D08AE8A86268EBEB3B1D008A504C3A16EA8B65510845EEB5F89' +
      'CAD1F90B31479F5216041909F58709F86A2BE9562146CD169E6556914C1E381CC2C748B6872D138451AFFC88C2A73E3EB0F6B1CA921A6E44' +
      'B8648EC7D5B17CB099163B5300A93FC1273FFE9264AC25472CDA60FE08EF59A4D2256FBE20D2C66C3D150049277C6C6746E2CA0CF5090DE1' +
      '119EB9EEF90F613F78906C293D685727F2F1D545BEDEB17B798B47CA700511FA23CEFC3CE114B5052A6ECDB25105D90D29C6AB92B12FB405' +
      '867E86'
  };

  const PERK_256_SHORT_3 = {
    katFile: 'PQCsignKAT_346.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8F',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8A8E11FA43A9E54DC3A97B684DF755ECA1FB75E272CF97BF' +
      '5A663A8C961AF7EF6721970EAD6CCD5CC78BD728AA7741A2B06C6894367F0E0FFC28AA180CD3E88278A94BAB5D8CB67841ACA5235BDF5542' +
      '9C6F3FB482E057DBF1B028EF8C7880E3D33D03D351BEA85F86A45E0579FD9DCA4B9337B48D14A4211C1B920C78C9025196CA00EB2AD0BC64' +
      'F07D6F0E58B791E45B234989E3A77CBC1C28135E5D482FBE920004C0519007C373C9349C7D3BCC8A64AFB4114F7C67002F2938F02EDCECAB' +
      '2DD66D80A72A32A1FC4FE451CFEA492ED3D59E83C849A077C5FBAAB03C984C98F27799A5751C4E15707CE42DE717CC05C9C95B3909938638' +
      '372750036897AE893F4C74A113F045DA39D5FD797EB4BBA103064733AA6771802100'
  };

  const PERK_256_SHORT_5 = {
    katFile: 'PQCsignKAT_539.rsp',
    keySeeds: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8F',
    publicKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D52983C39C13E764E56329D2894E1B44EBE4C20364E34A0E8' +
      '0AAFB13EC47DD37C4528BAD6C4285BC7CDF55536BD1E02F6B887D3DDDA71CC4FE93C2F9EE9BE93C18F923E91BFC6AE7047832EFF703DBBD6' +
      '1DE6E84DCBDCF7190DB137E627573C110F51AD8EF4171C484C88C5BBCAAE6CC6917E84B1F453FE1DAF055AD780CD6B27CBB9D98ED4B29979' +
      'E5CA1F4858736AD87EC567D715632BD161AB8F7D72A4CAF03BC119F1F7B6AC72D005D316B31577804B911AF8B2F997DB7F8481D35CCDA8F7' +
      '5A8CAEDB30BA23B4C04FCD77D28381A0E61FC360D3566D3C92788E1EA74805F4F60729CF5B67BEE6F7B8EF11E496108811DBCAE6488F5AC0' +
      '62BC415840D9F3A189B7313D8AFA5491D999AF9A648A153B18113FD6716E5D08AE8A86268EBEB3B1D008A504C3A16EA8B65510845EEB5F89' +
      'CAD1F90B31479F5216041909F58709F86A2BE9562146CD169E6556914C1E381CC2C748B6872D138451AFFC88C2A73E3EB0F6B1CA921A6E44' +
      'B8648EC7D5B17CB099163B5300A93FC1273FFE9264AC25472CDA60FE08EF59A4D2256FBE20D2C66C3D150049277C6C6746E2CA0CF5090DE1' +
      '119EB9EEF90F613F78906C293D685727F2F1D545BEDEB17B798B47CA700511FA23CEFC3CE114B5052A6ECDB25105D90D29C6AB92B12FB405' +
      '867E86'
  };

  /**
   * Flip one bit of a published hex string, for the rejection cases.
   * @param {string} hex - the published value
   * @param {number} index - which byte to disturb
   * @returns {number[]} the disturbed bytes
   */
  function disturb(hex, index) {
    const bytes = OpCodes.Hex8ToBytes(hex);
    bytes[index] = OpCodes.Xor8(bytes[index], 0x01);
    return bytes;
  }

  const KAT_URI = 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip';

  const VECTORS = [
    {
      text: 'PERK PQCsignKAT_164.rsp record 0: drawn seeds to public key (perk-128-fast-3)',
      uri: KAT_URI,
      keyGeneration: true,
      parameterSet: 'perk-128-fast-3',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_128_FAST_3.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_164.rsp record 0: drawn seeds to private key (perk-128-fast-3)',
      uri: KAT_URI,
      keyGeneration: true,
      parameterSet: 'perk-128-fast-3',
      keyGenerationOutput: 'privateKey',
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_128_FAST_3.privateKey)
    },
    {
      text: 'PERK PQCsignKAT_164.rsp record 0: the published signed message (perk-128-fast-3)',
      uri: KAT_URI,
      parameterSet: 'perk-128-fast-3',
      privateKey: OpCodes.Hex8ToBytes(PERK_128_FAST_3.privateKey),
      signingRandomness: OpCodes.Hex8ToBytes(PERK_128_FAST_3.signRandomness),
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_3.message),
      expected: OpCodes.Hex8ToBytes(PERK_128_FAST_3.signature + PERK_128_FAST_3.message)
    },
    {
      // Setting a signature alongside the public key turns the result into a
      // verdict, so the rejections below can assert a refusal rather than
      // naming what a refusal produces.
      text: 'PERK PQCsignKAT_164.rsp record 0: the published signature verifies (perk-128-fast-3)',
      uri: KAT_URI,
      parameterSet: 'perk-128-fast-3',
      publicKey: OpCodes.Hex8ToBytes(PERK_128_FAST_3.publicKey),
      signature: OpCodes.Hex8ToBytes(PERK_128_FAST_3.signature),
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_3.message),
      expected: [1]
    },
    {
      text: 'PERK PQCsignKAT_164.rsp record 0: one bit of the message flipped must not verify',
      uri: KAT_URI,
      parameterSet: 'perk-128-fast-3',
      publicKey: OpCodes.Hex8ToBytes(PERK_128_FAST_3.publicKey),
      signature: OpCodes.Hex8ToBytes(PERK_128_FAST_3.signature),
      input: disturb(PERK_128_FAST_3.message, 7),
      expected: [0]
    },
    {
      text: 'PERK PQCsignKAT_164.rsp record 0: one bit of the opened share must not verify',
      uri: KAT_URI,
      parameterSet: 'perk-128-fast-3',
      publicKey: OpCodes.Hex8ToBytes(PERK_128_FAST_3.publicKey),
      signature: disturb(PERK_128_FAST_3.signature, 5000),
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_3.message),
      expected: [0]
    },
    {
      text: "PERK PQCsignKAT_164.rsp: record 0's signature must not verify under record 1's public key",
      uri: KAT_URI,
      parameterSet: 'perk-128-fast-3',
      publicKey: OpCodes.Hex8ToBytes(PERK_128_FAST_3.publicKeyOfRecord1),
      signature: OpCodes.Hex8ToBytes(PERK_128_FAST_3.signature),
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_3.message),
      expected: [0]
    },

    {
      text: 'PERK PQCsignKAT_257.rsp record 0: drawn seeds to public key (perk-128-fast-5)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-128-fast-5',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_5.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_128_FAST_5.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_257.rsp record 0: the published signature verifies (perk-128-fast-5)',
      uri: KAT_URI,
      parameterSet: 'perk-128-fast-5',
      publicKey: OpCodes.Hex8ToBytes(PERK_128_FAST_5.publicKey),
      signature: OpCodes.Hex8ToBytes(PERK_128_FAST_5.signature),
      input: OpCodes.Hex8ToBytes(PERK_128_FAST_5.message),
      expected: [1]
    },

    {
      text: 'PERK PQCsignKAT_164.rsp record 0: drawn seeds to public key (perk-128-short-3)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-128-short-3',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_128_SHORT_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_128_SHORT_3.publicKey)
    },
    {
      // The short sets rank the opened permutation into a factorial-base
      // integer rather than packing pairs of coefficients, so this case is
      // what gates that encoding inside a test run.
      text: 'PERK PQCsignKAT_164.rsp record 0: the published signature verifies (perk-128-short-3)',
      uri: KAT_URI,
      parameterSet: 'perk-128-short-3',
      publicKey: OpCodes.Hex8ToBytes(PERK_128_SHORT_3.publicKey),
      signature: OpCodes.Hex8ToBytes(PERK_128_SHORT_3.signature),
      input: OpCodes.Hex8ToBytes(PERK_128_SHORT_3.message),
      expected: [1]
    },

    {
      text: 'PERK PQCsignKAT_257.rsp record 0: drawn seeds to public key (perk-128-short-5)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-128-short-5',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_128_SHORT_5.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_128_SHORT_5.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_251.rsp record 0: drawn seeds to public key (perk-192-fast-3)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-192-fast-3',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_192_FAST_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_192_FAST_3.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_392.rsp record 0: drawn seeds to public key (perk-192-fast-5)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-192-fast-5',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_192_FAST_5.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_192_FAST_5.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_251.rsp record 0: drawn seeds to public key (perk-192-short-3)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-192-short-3',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_192_SHORT_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_192_SHORT_3.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_392.rsp record 0: drawn seeds to public key (perk-192-short-5)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-192-short-5',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_192_SHORT_5.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_192_SHORT_5.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_346.rsp record 0: drawn seeds to public key (perk-256-fast-3)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-256-fast-3',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_256_FAST_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_256_FAST_3.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_539.rsp record 0: drawn seeds to public key (perk-256-fast-5)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-256-fast-5',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_256_FAST_5.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_256_FAST_5.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_346.rsp record 0: drawn seeds to public key (perk-256-short-3)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-256-short-3',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_256_SHORT_3.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_256_SHORT_3.publicKey)
    },
    {
      text: 'PERK PQCsignKAT_539.rsp record 0: drawn seeds to public key (perk-256-short-5)',
      uri: 'https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip',
      keyGeneration: true,
      parameterSet: 'perk-256-short-5',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(PERK_256_SHORT_5.keySeeds),
      expected: OpCodes.Hex8ToBytes(PERK_256_SHORT_5.publicKey)
    }
  ];

  //#endregion

  //#region ===== ALGORITHM =====

  class PERKAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = 'PERK';
      this.description = 'Digital signature scheme submitted to the NIST additional signatures project, proving knowledge of a permutation that solves an instance of the Permuted Kernel Problem over F_1021. The proof is MPC-in-the-Head: each round splits the secret permutation into N shares, commits to all of them and opens all but one. Version 2.0.0, all twelve parameter sets, verified against the submission Known Answer Tests.';
      this.inventor = 'Najwa Aaraj, Slim Bettaieb, Loic Bidoux, Alessandro Budroni, Victor Dyseryn, Andre Esser, Thibauld Feneuil, Philippe Gaborit, Mukul Kulkarni, Victor Mateu, Marco Palumbi, Lucas Perin, Matthieu Rivain, Jean-Pierre Tillich, Keita Xagawa';
      this.year = 2023;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Post-Quantum Digital Signature';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [
        new KeySize(164, 164, 0),
        new KeySize(257, 257, 0)
      ];

      this.documentation = [
        new LinkItem('PERK specification and submission package', 'https://pqc-perk.org/resources.html'),
        new LinkItem('NIST additional signatures project', 'https://csrc.nist.gov/projects/pqc-dig-sig'),
        new LinkItem('PERK: compact signature scheme based on a new variant of the permuted kernel problem', 'https://eprint.iacr.org/2024/748')
      ];

      this.references = [
        new LinkItem('PERK project page', 'https://pqc-perk.org/'),
        new LinkItem('The permuted kernel problem (Shamir, CRYPTO 1989)', 'https://link.springer.com/chapter/10.1007/0-387-34805-0_54')
      ];

      this.tests = VECTORS;
    }

    CreateInstance(isInverse = false) {
      return new PERKInstance(this, isInverse);
    }
  }

  /**
   * PERK instance implementing the Feed/Result pattern.
   *
   * The forward direction signs and returns signature || message, which is the
   * shape the NIST signature API prescribes; the inverse direction checks a
   * signed message and returns the message it carries, or refuses.
   */
  class PERKInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._parameterSet = PARAMETER_SETS['perk-128-fast-3'];
      this._publicKey = null;
      this._privateKey = null;
      this._keyData = null;
      this._signature = null;
      this.keyGeneration = false;
      this.keyGenerationOutput = 'publicKey';
      this.signingRandomness = null;
      this.signatureOutput = 'signedMessage';
    }

    // ---- configuration ----

    set parameterSet(label) {
      const found = findParameterSet(label);
      if (!found) throw new Error('Unknown PERK parameter set: ' + label);
      this._parameterSet = found;
    }

    get parameterSet() {
      return this._parameterSet.name;
    }

    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }
      // Several sets share a key size, so a set already chosen by name is kept
      // whenever it agrees with the length seen; only an inconsistent length
      // goes looking for another set.
      if (this._parameterSet.publicKeyBytes !== keyBytes.length) {
        const found = parameterSetByLength(keyBytes.length, 'publicKeyBytes');
        if (found) this._parameterSet = found;
      }
      this._publicKey = Array.from(keyBytes);
    }

    get publicKey() {
      return this._publicKey ? this._publicKey.slice() : null;
    }

    set privateKey(keyBytes) {
      if (!keyBytes) {
        this._privateKey = null;
        return;
      }
      if (this._parameterSet.privateKeyBytes !== keyBytes.length) {
        const found = parameterSetByLength(keyBytes.length, 'privateKeyBytes');
        if (found) this._parameterSet = found;
      }
      this._privateKey = Array.from(keyBytes);
    }

    get privateKey() {
      return this._privateKey ? this._privateKey.slice() : null;
    }

    /** A signature to check, when the message rather than the pair is fed. */
    set signature(signatureBytes) {
      this._signature = signatureBytes ? Array.from(signatureBytes) : null;
    }

    get signature() {
      return this._signature ? this._signature.slice() : null;
    }

    set key(keyData) {
      this._keyData = keyData;

      if (keyData === null || keyData === undefined) {
        this._publicKey = null;
        this._privateKey = null;
        return;
      }

      if (typeof keyData === 'string' || typeof keyData === 'number') {
        this.parameterSet = keyData;
        return;
      }

      if (!Array.isArray(keyData) && !ArrayBuffer.isView(keyData))
        throw new Error('Invalid PERK key data format');

      const bytes = Array.from(keyData);
      if (parameterSetByLength(bytes.length, 'privateKeyBytes')) {
        this.privateKey = bytes;
        return;
      }
      if (parameterSetByLength(bytes.length, 'publicKeyBytes')) {
        this.publicKey = bytes;
        return;
      }

      let text = '';
      for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
      this.parameterSet = text;
    }

    get key() {
      return this._keyData;
    }

    // ---- streaming ----

    /**
     * Feed input bytes. Repeated calls append, so feeding in pieces is the same
     * as feeding whole.
     * @param {number[]} data - input bytes
     */
    Feed(data) {
      if (data === null || data === undefined) return;

      if (typeof data === 'string') {
        for (let i = 0; i < data.length; i++)
          this.inputBuffer.push(OpCodes.And8(data.charCodeAt(i), 0xFF));
        return;
      }

      if (typeof data === 'number') {
        this.inputBuffer.push(data);
        return;
      }

      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * Produce the key, the signed message, or the message a signed message
     * carries.
     * @returns {number[]} the result bytes
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];
      const P = this._parameterSet;

      if (this.keyGeneration) {
        if (input.length !== 2 * P.seedBytes)
          throw new Error('PERK ' + P.name + ' key generation needs ' + (2 * P.seedBytes) + ' random bytes, got ' + input.length);
        const pair = generateKeyPair(input.slice(0, P.seedBytes), input.slice(P.seedBytes), P);
        return this.keyGenerationOutput === 'privateKey' ? pair.privateKey : pair.publicKey;
      }

      // A signature set alongside a public key turns the instance into a
      // checker: the fed bytes are the message and the answer is the verdict,
      // which is how a vector asserts that a tampered input is refused without
      // naming what the refusal produces.
      if (this._signature && this._publicKey) {
        return [verify(input, this._signature, this._publicKey, P) ? 1 : 0];
      }

      if (this.isInverse) {
        if (!this._publicKey) throw new Error('PERK verification needs a public key');

        const signatureBytes = input.slice(0, P.signatureBytes);
        const message = input.slice(P.signatureBytes);

        if (!verify(message, signatureBytes, this._publicKey, P))
          throw new Error('PERK signature verification failed');

        return message;
      }

      if (!this._privateKey) throw new Error('PERK signing needs a private key');
      if (!this.signingRandomness)
        throw new Error('PERK signing needs ' + (P.seedBytes + P.saltBytes) + ' bytes of randomness');

      const signatureBytes = sign(input, this._privateKey, Array.from(this.signingRandomness), P);
      if (this.signatureOutput === 'signature') return signatureBytes;

      const out = signatureBytes.slice();
      appendAll(out, input);
      return out;
    }

    // ---- convenience ----

    /**
     * Generate a key pair from drawn randomness.
     * @param {number[]} randomness - two seeds, public then private
     * @returns {object} { publicKey, privateKey }
     */
    GenerateKeyPair(randomness) {
      const P = this._parameterSet;
      const bytes = Array.from(randomness);
      const pair = generateKeyPair(bytes.slice(0, P.seedBytes), bytes.slice(P.seedBytes, 2 * P.seedBytes), P);
      this._publicKey = pair.publicKey;
      this._privateKey = pair.privateKey;
      return { publicKey: pair.publicKey.slice(), privateKey: pair.privateKey.slice() };
    }

    /**
     * Sign a message with the configured private key.
     * @param {number[]} message - the message
     * @param {number[]} randomness - seedBytes + saltBytes of randomness
     * @returns {number[]} the signature
     */
    Sign(message, randomness) {
      if (!this._privateKey) throw new Error('PERK signing needs a private key');
      return sign(Array.from(message), this._privateKey, Array.from(randomness), this._parameterSet);
    }

    /**
     * Check a signature with the configured public key.
     * @param {number[]} message - the message
     * @param {number[]} signatureBytes - the signature
     * @returns {boolean} whether it verifies
     */
    Verify(message, signatureBytes) {
      if (!this._publicKey) throw new Error('PERK verification needs a public key');
      return verify(Array.from(message), Array.from(signatureBytes), this._publicKey, this._parameterSet);
    }

    /** Wipe the key material held by this instance. */
    ClearData() {
      if (this._privateKey) OpCodes.ClearArray(this._privateKey);
      if (this.signingRandomness) OpCodes.ClearArray(this.signingRandomness);
      this._privateKey = null;
      this._publicKey = null;
      this.signingRandomness = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  //#endregion

  // ===== REGISTRATION =====

  const algorithmInstance = new PERKAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    PERKAlgorithm, PERKInstance, PARAMETER_SETS, ShakeStream,
    generateKeyPair, sign, verify, decodePublicKey, decodeSignature, encodeSignature
  };
}));
