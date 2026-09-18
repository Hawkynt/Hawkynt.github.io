/*
 * NTRU Implementation
 * N-th Degree Truncated Polynomial Ring Units - the NIST PQC round 3 KEM
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The round 3 NTRU submission is a key encapsulation mechanism built on the
 * truncated polynomial ring Z[x]/(x^n - 1). This file implements the three
 * NTRU-HPS parameter sets of that submission:
 *
 *   ntruhps2048509  n = 509  q = 2048   pk 699   sk 935   ct 699
 *   ntruhps2048677  n = 677  q = 2048   pk 930   sk 1234  ct 930
 *   ntruhps4096821  n = 821  q = 4096   pk 1230  sk 1590  ct 1230
 *
 * Verified against the submission's own Known Answer Tests, PQCkemKAT_935.rsp,
 * PQCkemKAT_1234.rsp and PQCkemKAT_1590.rsp from
 * NIST-PQ-Submission-NTRU-20201016: all 100 records of each file agree on the
 * public key, the secret key, the ciphertext, the encapsulated shared secret
 * and the decapsulated shared secret, 300 records and 1500 field comparisons
 * in total. Those records are keyed by a 48 byte seed driving the NIST KAT
 * AES-256 CTR_DRBG; the vectors committed below name the expanded seed
 * directly so that they can be driven without one.
 *
 * NTRU-HRSS is not implemented here. It shares the ring but differs in the
 * sampler, the lifting map and the key equation, and none of that is
 * approximated by the HPS code paths.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SHA3-256 =====
  //
  // The KEM derives its shared secret with SHA3-256 and nothing else. The
  // collection's FIPS 202 module already agrees with the published digests, so
  // it is reused rather than duplicated.

  const globalScope = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof self !== 'undefined' ? self : {}));

  let sha3Algorithm = null;

  /**
   * SHA3-256 over a byte array.
   *
   * The dependency is resolved on first use rather than while this file loads,
   * and it is deliberate. Both the README generator and the browser script-tag
   * checker attribute an algorithm to whichever source file was being loaded
   * when it registered, so a top-level require of the SHA-3 module files the
   * four SHA-3 digests under this directory and drops them from the hash index.
   * Resolving on demand leaves sha3.js to register itself when the walk
   * reaches it.
   *
   * @param {number[]} data - input bytes
   * @returns {number[]} 32 digest bytes
   */
  function sha3_256(data) {
    if (!sha3Algorithm) {
      sha3Algorithm = AlgorithmFramework.Find ? AlgorithmFramework.Find('SHA-3-256') : null;

      if (!sha3Algorithm) {
        let SHA3AlgorithmClass = globalScope.SHA3Algorithm;
        if (!SHA3AlgorithmClass && typeof require !== 'undefined') {
          try {
            SHA3AlgorithmClass = require('../hash/sha3.js').SHA3Algorithm;
          } catch (e) {
            // Reported as a missing dependency below.
          }
        }
        if (SHA3AlgorithmClass) sha3Algorithm = new SHA3AlgorithmClass(256);
      }

      if (!sha3Algorithm) throw new Error('SHA3-256 is required by NTRU and was not found');
    }

    const instance = sha3Algorithm.CreateInstance();
    instance.Feed(data);
    return instance.Result();
  }

  // ===== PARAMETER SETS =====

  const PARAMETER_SETS = (() => {
    const build = (name, n, logq) => {
      const P = { name: name, n: n, logq: logq };
      P.q = Math.pow(2, logq);
      P.weight = P.q / 8 - 2;                             // number of non-zero coefficients
      P.packDeg = n - 1;
      P.trinaryBytes = Math.floor((P.packDeg + 4) / 5);   // five trits to a byte
      P.messageBytes = 2 * P.trinaryBytes;
      P.publicKeySize = Math.floor((logq * P.packDeg + 7) / 8);
      P.ciphertextSize = P.publicKeySize;
      P.owcpaSecretKeySize = 2 * P.trinaryBytes + P.publicKeySize;
      P.prfKeyBytes = 32;
      P.privateKeySize = P.owcpaSecretKeySize + P.prfKeyBytes;
      P.sharedSecretSize = 32;
      P.iidBytes = n - 1;
      P.fixedTypeBytes = Math.floor((30 * (n - 1) + 7) / 8);
      P.keySeedSize = P.iidBytes + P.fixedTypeBytes;      // Sample_fg input
      P.messageSeedSize = P.keySeedSize;                  // Sample_rm input
      return P;
    };

    const sets = {};
    for (const set of [build('ntruhps2048509', 509, 11),
                       build('ntruhps2048677', 677, 11),
                       build('ntruhps4096821', 821, 12)])
      sets[set.name] = set;
    return sets;
  })();

  const PARAMETER_SET_ALIASES = (() => {
    const map = {};
    for (const set of Object.values(PARAMETER_SETS)) {
      map[set.name] = set;
      map[String(set.n)] = set;
      map['NTRU-HPS-' + set.q + '-' + set.n] = set;
    }
    return map;
  })();

  /**
   * Look a parameter set up by any of its accepted names.
   * @param {string|number} label - 'ntruhps2048509', 'NTRU-HPS-2048-509', 509
   * @returns {object|null} The parameter set, or null when unrecognised
   */
  function findParameterSet(label) {
    if (label === null || label === undefined) return null;
    const key = String(label).trim();
    return PARAMETER_SET_ALIASES[key] || PARAMETER_SET_ALIASES[key.toLowerCase()] || null;
  }

  /**
   * Identify a parameter set from the length of one of its encoded values.
   * @param {number} length - byte length
   * @param {string} field - 'publicKeySize', 'privateKeySize' or 'ciphertextSize'
   * @returns {object|null} The parameter set, or null
   */
  function parameterSetByLength(length, field) {
    for (const set of Object.values(PARAMETER_SETS))
      if (set[field] === length) return set;
    return null;
  }

  // ===== ARRAY HELPERS =====
  //
  // Keys and ciphertexts run to kilobytes, so nothing here spreads an array
  // into a call.

  /**
   * Append every element of source to target.
   * @param {number[]} target - array appended to, modified in place
   * @param {number[]} source - array read from
   * @returns {number[]} target
   */
  function appendAll(target, source) {
    for (let i = 0; i < source.length; i++) target.push(source[i]);
    return target;
  }

  /** @param {number} count - length @returns {number[]} a zero-filled array */
  function zeros(count) {
    return new Array(count).fill(0);
  }

  const POW2 = (() => {
    const table = new Array(33);
    table[0] = 1;
    for (let i = 1; i < 33; i++) table[i] = table[i - 1] * 2;
    return table;
  })();

  // ===== COEFFICIENT ARITHMETIC =====

  /**
   * Least non-negative residue modulo 3.
   * @param {number} a - any integer
   * @returns {number} a mod 3
   */
  function mod3(a) {
    const r = a % 3;
    return r < 0 ? r + 3 : r;
  }

  /**
   * Least non-negative residue modulo q.
   * @param {number} a - any integer
   * @param {object} P - parameter set
   * @returns {number} a mod q
   */
  function modQ(a, P) {
    const r = a % P.q;
    return r < 0 ? r + P.q : r;
  }

  // ===== RING ARITHMETIC =====
  //
  // R_q is Z_q[x]/(x^n - 1); S_q and S_3 add a reduction modulo
  // Phi_n = 1 + x + ... + x^(n-1). Reduction modulo Phi_n is a single
  // subtraction of the top coefficient because x^n - 1 = (x - 1) * Phi_n and
  // Phi_n * x = Phi_n in this ring.

  /**
   * Product in R_q = Z_q[x]/(x^n - 1).
   * @param {number[]} a - n coefficients
   * @param {number[]} b - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} the product
   */
  function rqMultiply(a, b, P) {
    const n = P.n;
    const r = zeros(n);

    for (let i = 0; i < n; i++) {
      if (a[i] === 0) continue;
      const ai = a[i];
      for (let j = 0; j < n; j++) {
        const k = i + j >= n ? i + j - n : i + j;
        r[k] = (r[k] + ai * b[j]) % P.q;
      }
    }

    for (let i = 0; i < n; i++) r[i] = modQ(r[i], P);
    return r;
  }

  /**
   * Reduce modulo Phi_n with coefficients modulo q, in place.
   * @param {number[]} r - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} r
   */
  function modQPhiN(r, P) {
    const last = r[P.n - 1];
    for (let i = 0; i < P.n; i++) r[i] = modQ(r[i] - last, P);
    return r;
  }

  /**
   * Reduce modulo Phi_n with coefficients modulo 3, in place.
   * @param {number[]} r - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} r
   */
  function mod3PhiN(r, P) {
    const last = r[P.n - 1];
    for (let i = 0; i < P.n; i++) r[i] = mod3(r[i] + 2 * last);
    return r;
  }

  /**
   * Product in S_q = Z_q[x]/Phi_n.
   * @param {number[]} a - n coefficients
   * @param {number[]} b - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} the product
   */
  function sqMultiply(a, b, P) {
    return modQPhiN(rqMultiply(a, b, P), P);
  }

  /**
   * Product in S_3 = Z_3[x]/Phi_n.
   * @param {number[]} a - n coefficients
   * @param {number[]} b - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} the product
   */
  function s3Multiply(a, b, P) {
    const n = P.n;
    const r = zeros(n);

    for (let i = 0; i < n; i++) {
      if (a[i] === 0) continue;
      const ai = a[i];
      for (let j = 0; j < n; j++) {
        const k = i + j >= n ? i + j - n : i + j;
        r[k] = mod3(r[k] + ai * b[j]);
      }
    }

    return mod3PhiN(r, P);
  }

  // ===== INVERSION =====
  //
  // The extended Euclidean algorithm in the polynomial ring, which is the part
  // of NTRU that has to be got exactly right: key generation needs 1/f modulo
  // 3 and modulo Phi_n, and 1/(g*f) modulo q.

  /**
   * Degree of a polynomial over a prime field, or -1 when it is zero.
   * @param {number[]} p - coefficients
   * @param {number} modulus - 2 or 3
   * @returns {number} the degree
   */
  function degreeOf(p, modulus) {
    for (let i = p.length - 1; i >= 0; i--)
      if (p[i] % modulus !== 0) return i;
    return -1;
  }

  /**
   * Inverse in F_2[x]/Phi_n, by the extended Euclidean algorithm.
   * @param {number[]} a - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]|null} the inverse, or null when a is not invertible
   */
  function r2Inverse(a, P) {
    const n = P.n;

    let remainderHigh = zeros(n + 1);
    for (let i = 0; i < n; i++) remainderHigh[i] = 1;      // Phi_n over F_2

    let remainderLow = zeros(n + 1);
    for (let i = 0; i < n - 1; i++)
      remainderLow[i] = (a[i] + a[n - 1]) % 2;             // a reduced modulo Phi_n

    let cofactorHigh = zeros(n + 1);
    let cofactorLow = zeros(n + 1);
    cofactorLow[0] = 1;

    const addShifted = (destination, source, shift) => {
      for (let i = 0; i + shift < destination.length && i < source.length; i++)
        destination[i + shift] = (destination[i + shift] + source[i]) % 2;
    };

    while (degreeOf(remainderLow, 2) > 0) {
      const lowDegree = degreeOf(remainderLow, 2);
      let highDegree = degreeOf(remainderHigh, 2);

      while (highDegree >= lowDegree) {
        addShifted(remainderHigh, remainderLow, highDegree - lowDegree);
        addShifted(cofactorHigh, cofactorLow, highDegree - lowDegree);
        const reduced = degreeOf(remainderHigh, 2);
        if (reduced >= highDegree) return null;            // no progress: not invertible
        highDegree = reduced;
        if (highDegree < 0) break;
      }

      let swap = remainderHigh; remainderHigh = remainderLow; remainderLow = swap;
      swap = cofactorHigh; cofactorHigh = cofactorLow; cofactorLow = swap;
    }

    if (degreeOf(remainderLow, 2) !== 0) return null;

    const out = cofactorLow.slice(0, n);
    out[n - 1] = 0;
    return out;
  }

  /**
   * Inverse modulo q and Phi_n, computed with R_q arithmetic: Newton iteration
   * lifts the inverse modulo 2 returned by r2Inverse, and each step squares the
   * error, so four steps carry an error that is zero modulo 2 up to zero modulo
   * 2^16 - more than the largest q used here.
   *
   * The result is an inverse modulo Phi_n and not in R_q itself: the product
   * a * r comes out as 1 plus some multiple of Phi_n rather than exactly 1.
   * That is what the scheme wants. h is only ever determined up to a multiple
   * of Phi_n, and the representative is pinned at the point of encoding, where
   * only the first n-1 coefficients are written and the last is recovered from
   * the requirement that they all sum to zero. Adding c*Phi_n to h adds c*n to
   * that sum, and n is odd while q is a power of two, so exactly one
   * representative of the coset sums to zero and both parties compute it.
   *
   * @param {number[]} a - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]|null} the inverse, or null when a is not invertible
   */
  function rqInverse(a, P) {
    const seed = r2Inverse(a, P);
    if (!seed) return null;

    const negated = zeros(P.n);
    for (let i = 0; i < P.n; i++) negated[i] = modQ(-a[i], P);

    let r = seed.slice();
    for (let step = 0; step < 4; step++) {
      const correction = rqMultiply(r, negated, P);
      correction[0] = modQ(correction[0] + 2, P);          // 2 - a*r
      r = rqMultiply(correction, r, P);
    }

    return r;
  }

  /**
   * Inverse in S_3 = Z_3[x]/Phi_n, by the extended Euclidean algorithm.
   * @param {number[]} a - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]|null} the inverse, or null when a is not invertible
   */
  function s3Inverse(a, P) {
    const n = P.n;

    let remainderHigh = zeros(n + 1);
    for (let i = 0; i < n; i++) remainderHigh[i] = 1;      // Phi_n over F_3

    let remainderLow = zeros(n + 1);
    for (let i = 0; i < n - 1; i++)
      remainderLow[i] = mod3(a[i] + 2 * a[n - 1]);         // a reduced modulo Phi_n

    let cofactorHigh = zeros(n + 1);
    let cofactorLow = zeros(n + 1);
    cofactorLow[0] = 1;

    const inverseOf = v => (mod3(v) === 1 ? 1 : 2);        // 1 and 2 are self-inverse modulo 3
    const addScaledShifted = (destination, source, factor, shift) => {
      for (let i = 0; i + shift < destination.length && i < source.length; i++)
        destination[i + shift] = mod3(destination[i + shift] + factor * source[i]);
    };

    while (degreeOf(remainderLow, 3) > 0) {
      const lowDegree = degreeOf(remainderLow, 3);
      const lowLeading = mod3(remainderLow[lowDegree]);
      let highDegree = degreeOf(remainderHigh, 3);

      while (highDegree >= lowDegree) {
        const factor = mod3(-mod3(remainderHigh[highDegree]) * inverseOf(lowLeading));
        addScaledShifted(remainderHigh, remainderLow, factor, highDegree - lowDegree);
        addScaledShifted(cofactorHigh, cofactorLow, factor, highDegree - lowDegree);
        const reduced = degreeOf(remainderHigh, 3);
        if (reduced >= highDegree) return null;            // no progress: not invertible
        highDegree = reduced;
        if (highDegree < 0) break;
      }

      let swap = remainderHigh; remainderHigh = remainderLow; remainderLow = swap;
      swap = cofactorHigh; cofactorHigh = cofactorLow; cofactorLow = swap;
    }

    if (degreeOf(remainderLow, 3) !== 0) return null;

    const scale = inverseOf(remainderLow[0]);
    const out = zeros(n);
    for (let i = 0; i < n; i++) out[i] = mod3(cofactorLow[i] * scale);
    return mod3PhiN(out, P);
  }

  // ===== REPRESENTATION CONVERSIONS =====

  /**
   * Map ternary coefficients {0, 1, 2} onto {0, 1, q-1}, in place.
   * @param {number[]} r - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} r
   */
  function z3ToZq(r, P) {
    for (let i = 0; i < P.n; i++)
      if (r[i] === 2) r[i] = P.q - 1;
    return r;
  }

  /**
   * Map coefficients {0, 1, q-1} back onto {0, 1, 2}, in place.
   * @param {number[]} r - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} r
   */
  function trinaryZqToZ3(r, P) {
    for (let i = 0; i < P.n; i++) {
      const c = modQ(r[i], P);
      r[i] = OpCodes.AndN(OpCodes.XorN(c, OpCodes.Shr32(c, P.logq - 1)), 3);
    }
    return r;
  }

  /**
   * Centre R_q coefficients about zero and reduce modulo 3 and Phi_n.
   * @param {number[]} a - n coefficients
   * @param {object} P - parameter set
   * @returns {number[]} the S_3 element
   */
  function rqToS3(a, P) {
    const r = zeros(P.n);
    // Centring subtracts q from any coefficient at or above q/2, and
    // -q = -2^logq is 1 modulo 3 when logq is odd and 2 when it is even.
    const carry = POW2[1 - (P.logq % 2)];

    for (let i = 0; i < P.n; i++) {
      const c = modQ(a[i], P);
      r[i] = c + OpCodes.Shr32(c, P.logq - 1) * carry;
    }

    return mod3PhiN(r, P);
  }

  /**
   * The lifting map. For NTRU-HPS it is the identity on ternary coefficients,
   * read into Z_q.
   * @param {number[]} a - n ternary coefficients
   * @param {object} P - parameter set
   * @returns {number[]} the lift
   */
  function lift(a, P) {
    return z3ToZq(a.slice(), P);
  }

  // ===== PACKING =====

  /**
   * Pack ternary coefficients, five to a byte, base three.
   * @param {number[]} a - n coefficients in {0, 1, 2}
   * @param {object} P - parameter set
   * @returns {number[]} trinaryBytes bytes
   */
  function s3ToBytes(a, P) {
    const out = zeros(P.trinaryBytes);
    const whole = Math.floor(P.packDeg / 5);

    for (let i = 0; i < whole; i++) {
      let c = mod3(a[5 * i + 4]);
      for (let j = 3; j >= 0; j--) c = 3 * c + mod3(a[5 * i + j]);
      out[i] = c;
    }

    if (P.packDeg > whole * 5) {
      let c = 0;
      for (let j = P.packDeg - 5 * whole - 1; j >= 0; j--) c = 3 * c + mod3(a[5 * whole + j]);
      out[whole] = c;
    }

    return out;
  }

  /**
   * Unpack ternary coefficients written by s3ToBytes.
   * @param {number[]} msg - packed bytes
   * @param {object} P - parameter set
   * @returns {number[]} n coefficients
   */
  function s3FromBytes(msg, P) {
    const r = zeros(P.n);
    const whole = Math.floor(P.packDeg / 5);

    for (let i = 0; i < whole; i++) {
      let c = msg[i];
      for (let j = 0; j < 5; j++) {
        r[5 * i + j] = mod3(c);
        c = Math.floor(c / 3);
      }
    }

    if (P.packDeg > whole * 5) {
      let c = msg[whole];
      for (let j = 0; 5 * whole + j < P.packDeg; j++) {
        r[5 * whole + j] = mod3(c);
        c = Math.floor(c / 3);
      }
    }

    r[P.n - 1] = 0;
    return r;
  }

  /**
   * Pack coefficients as a little-endian bit stream of fixed width.
   * @param {number[]} a - coefficients
   * @param {number} count - how many to write
   * @param {number} bits - width of each
   * @returns {number[]} the packed bytes
   */
  function packCoefficients(a, count, bits) {
    const out = zeros(Math.floor((count * bits + 7) / 8));
    let bitPosition = 0;

    for (let i = 0; i < count; i++) {
      for (let t = 0; t < bits; t++) {
        if (OpCodes.AndN(OpCodes.Shr32(a[i], t), 1) === 1) {
          const index = Math.floor(bitPosition / 8);
          out[index] = OpCodes.OrN(out[index], POW2[bitPosition % 8]);
        }
        bitPosition++;
      }
    }

    return out;
  }

  /**
   * Read back a bit stream written by packCoefficients.
   * @param {number[]} bytes - packed bytes
   * @param {number} count - how many coefficients to read
   * @param {number} bits - width of each
   * @returns {number[]} the coefficients
   */
  function unpackCoefficients(bytes, count, bits) {
    const out = zeros(count);
    let bitPosition = 0;

    for (let i = 0; i < count; i++) {
      let value = 0;
      for (let t = 0; t < bits; t++) {
        const index = Math.floor(bitPosition / 8);
        if (OpCodes.AndN(OpCodes.Shr32(bytes[index], bitPosition % 8), 1) === 1)
          value += POW2[t];
        bitPosition++;
      }
      out[i] = value;
    }

    return out;
  }

  const sqToBytes = (a, P) => packCoefficients(a, P.packDeg, P.logq);

  /**
   * Unpack an S_q element.
   * @param {number[]} bytes - packed bytes
   * @param {object} P - parameter set
   * @returns {number[]} n coefficients, the last zero
   */
  function sqFromBytes(bytes, P) {
    const r = zeros(P.n);
    const c = unpackCoefficients(bytes, P.packDeg, P.logq);
    for (let i = 0; i < P.packDeg; i++) r[i] = c[i];
    r[P.n - 1] = 0;
    return r;
  }

  const rqSumZeroToBytes = (a, P) => packCoefficients(a, P.packDeg, P.logq);

  /**
   * Unpack an R_q element whose coefficients are known to sum to zero, so that
   * the final coefficient need not be transmitted.
   * @param {number[]} bytes - packed bytes
   * @param {object} P - parameter set
   * @returns {number[]} n coefficients
   */
  function rqSumZeroFromBytes(bytes, P) {
    const r = zeros(P.n);
    const c = unpackCoefficients(bytes, P.packDeg, P.logq);
    let sum = 0;

    for (let i = 0; i < P.packDeg; i++) {
      r[i] = c[i];
      sum += c[i];
    }

    r[P.n - 1] = modQ(-sum, P);
    return r;
  }

  // ===== SAMPLING =====

  /**
   * Sample_iid: a ternary polynomial, one coefficient per input byte.
   * @param {number[]} bytes - source bytes
   * @param {number} offset - where to start reading
   * @param {object} P - parameter set
   * @returns {number[]} n coefficients, the last zero
   */
  function sampleIid(bytes, offset, P) {
    const r = zeros(P.n);
    for (let i = 0; i < P.n - 1; i++) r[i] = mod3(bytes[offset + i]);
    r[P.n - 1] = 0;
    return r;
  }

  /**
   * Sample_fixed_type: a ternary polynomial with exactly weight/2 coefficients
   * equal to 1 and weight/2 equal to -1, obtained by tagging the low two bits
   * of thirty bit random words and sorting.
   * @param {number[]} u - source bytes
   * @param {number} offset - where to start reading
   * @param {object} P - parameter set
   * @returns {number[]} n coefficients, the last zero
   */
  function sampleFixedType(u, offset, P) {
    const count = P.n - 1;
    const s = new Array(count);

    // Four words out of every fifteen bytes, thirty bits each. The words are
    // assembled as unsigned 32 bit quantities and then read as signed, because
    // the sort that follows is a signed one.
    const toSigned = v => (v >= POW2[31] ? v - POW2[32] : v);
    const groups = Math.floor(count / 4);

    for (let i = 0; i < groups; i++) {
      const b = offset + 15 * i;
      s[4 * i + 0] = toSigned((OpCodes.Shl32(u[b + 0], 2) + OpCodes.Shl32(u[b + 1], 10)
        + OpCodes.Shl32(u[b + 2], 18) + OpCodes.Shl32(u[b + 3], 26)) % POW2[32]);
      s[4 * i + 1] = toSigned((OpCodes.Shr32(OpCodes.AndN(u[b + 3], 0xc0), 4) + OpCodes.Shl32(u[b + 4], 4)
        + OpCodes.Shl32(u[b + 5], 12) + OpCodes.Shl32(u[b + 6], 20)
        + OpCodes.Shl32(u[b + 7], 28)) % POW2[32]);
      s[4 * i + 2] = toSigned((OpCodes.Shr32(OpCodes.AndN(u[b + 7], 0xf0), 2) + OpCodes.Shl32(u[b + 8], 6)
        + OpCodes.Shl32(u[b + 9], 14) + OpCodes.Shl32(u[b + 10], 22)
        + OpCodes.Shl32(u[b + 11], 30)) % POW2[32]);
      s[4 * i + 3] = toSigned((OpCodes.AndN(u[b + 11], 0xfc) + OpCodes.Shl32(u[b + 12], 8)
        + OpCodes.Shl32(u[b + 13], 16) + OpCodes.Shl32(u[b + 14], 24)) % POW2[32]);
    }

    for (let i = 0; i < P.weight / 2; i++) s[i] = OpCodes.OrN(s[i], 1);
    for (let i = P.weight / 2; i < P.weight; i++) s[i] = OpCodes.OrN(s[i], 2);

    s.sort((x, y) => x - y);

    const r = zeros(P.n);
    for (let i = 0; i < count; i++) r[i] = OpCodes.AndN(s[i], 3);
    r[P.n - 1] = 0;
    return r;
  }

  /**
   * Sample_fg: the two key polynomials.
   * @param {number[]} bytes - keySeedSize bytes
   * @param {object} P - parameter set
   * @returns {object} { f, g }
   */
  function sampleFg(bytes, P) {
    return { f: sampleIid(bytes, 0, P), g: sampleFixedType(bytes, P.iidBytes, P) };
  }

  /**
   * Sample_rm: the blinding polynomial and the message polynomial.
   * @param {number[]} bytes - messageSeedSize bytes
   * @param {object} P - parameter set
   * @returns {object} { r, m }
   */
  function sampleRm(bytes, P) {
    return { r: sampleIid(bytes, 0, P), m: sampleFixedType(bytes, P.iidBytes, P) };
  }

  // ===== ONE-WAY CPA SCHEME =====

  /**
   * Generate an NTRU key pair from an expanded seed.
   *
   * h = g/f and its inverse f/g are both formed from one inversion of g*f,
   * which is why a single modular inverse in R_q suffices.
   *
   * @param {number[]} seed - keySeedSize bytes
   * @param {object} P - parameter set
   * @returns {object|null} { publicKey, secretKey }, or null when f or g*f is
   *                        not invertible and the seed must be rejected
   */
  function owcpaKeypair(seed, P) {
    if (seed.length !== P.keySeedSize)
      throw new Error('NTRU key generation needs ' + P.keySeedSize + ' seed bytes, got ' + seed.length);

    const sampled = sampleFg(seed, P);
    const f = sampled.f;
    const g = sampled.g;

    const fInverse3 = s3Inverse(f, P);
    if (!fInverse3) return null;

    const secretKey = s3ToBytes(f, P);
    appendAll(secretKey, s3ToBytes(fInverse3, P));

    const fq = z3ToZq(f.slice(), P);
    const gq = z3ToZq(g.slice(), P);
    for (let i = 0; i < P.n; i++) gq[i] = modQ(3 * gq[i], P);

    const gf = rqMultiply(gq, fq, P);
    const gfInverse = rqInverse(gf, P);
    if (!gfInverse) return null;

    const hInverse = sqMultiply(rqMultiply(gfInverse, fq, P), fq, P);
    appendAll(secretKey, sqToBytes(hInverse, P));

    const h = rqMultiply(rqMultiply(gfInverse, gq, P), gq, P);

    return { publicKey: rqSumZeroToBytes(h, P), secretKey: secretKey };
  }

  /**
   * Encrypt under the one-way CPA scheme: c = r*h + Lift(m).
   * @param {number[]} r - blinding polynomial, already in Z_q
   * @param {number[]} m - message polynomial, ternary
   * @param {number[]} pk - public key bytes
   * @param {object} P - parameter set
   * @returns {number[]} the ciphertext
   */
  function owcpaEncrypt(r, m, pk, P) {
    const h = rqSumZeroFromBytes(pk, P);
    const ct = rqMultiply(r, h, P);
    const lifted = lift(m, P);

    for (let i = 0; i < P.n; i++) ct[i] = modQ(ct[i] + lifted[i], P);
    return rqSumZeroToBytes(ct, P);
  }

  /**
   * Are the bits past the last packed coefficient of the final ciphertext byte
   * clear? A ciphertext that carries anything there is not a valid encoding.
   * @param {number[]} ciphertext - the ciphertext
   * @param {object} P - parameter set
   * @returns {number} 0 when well formed, 1 otherwise
   */
  function checkCiphertext(ciphertext, P) {
    const usedBits = (P.logq * P.packDeg) % 8;
    if (usedBits === 0) return 0;
    return OpCodes.AndN(ciphertext[P.ciphertextSize - 1], OpCodes.AndN(OpCodes.Shl32(0xff, 8 - usedBits), 0xff)) === 0 ? 0 : 1;
  }

  /**
   * Is m in the message space, that is exactly weight/2 coefficients equal to
   * 1 and weight/2 equal to 2?
   * @param {number[]} m - n coefficients
   * @param {object} P - parameter set
   * @returns {number} 0 when in the space, 1 otherwise
   */
  function checkMessage(m, P) {
    let ones = 0;
    let twos = 0;

    for (let i = 0; i < P.n; i++) {
      ones += OpCodes.AndN(m[i], 1);
      twos += OpCodes.AndN(m[i], 2) / 2;
    }

    return ones === P.weight / 2 && twos === P.weight / 2 ? 0 : 1;
  }

  /**
   * Does r have coefficients in {0, 1, q-1} with a zero final coefficient?
   * @param {number[]} r - n coefficients
   * @param {object} P - parameter set
   * @returns {number} 0 when valid, 1 otherwise
   */
  function checkBlinder(r, P) {
    let bad = 0;

    for (let i = 0; i < P.n - 1; i++) {
      const c = r[i];
      if (OpCodes.AndN(c + 1, P.q - 4) !== 0) bad = 1;
      if (OpCodes.AndN(c + 2, 4) !== 0) bad = 1;
    }

    if (r[P.n - 1] !== 0) bad = 1;
    return bad;
  }

  /**
   * Decrypt under the one-way CPA scheme and report whether the ciphertext was
   * a genuine encryption. Recovering r as (c - Lift(m))/h modulo Phi_n and
   * checking that r and m lie in their spaces is equivalent to re-encrypting,
   * which is what makes the KEM around it chosen-ciphertext secure.
   * @param {number[]} ciphertext - the ciphertext
   * @param {number[]} secretKey - the secret key
   * @param {object} P - parameter set
   * @returns {object} { rm, fail }
   */
  function owcpaDecrypt(ciphertext, secretKey, P) {
    const c = rqSumZeroFromBytes(ciphertext, P);
    const f = s3FromBytes(secretKey.slice(0, P.trinaryBytes), P);
    const fq = z3ToZq(f.slice(), P);

    const mf = rqToS3(rqMultiply(c, fq, P), P);
    const fInverse3 = s3FromBytes(secretKey.slice(P.trinaryBytes, 2 * P.trinaryBytes), P);
    const m = s3Multiply(mf, fInverse3, P);

    let fail = checkCiphertext(ciphertext, P);
    if (checkMessage(m, P)) fail = 1;

    const lifted = lift(m, P);
    const b = zeros(P.n);
    for (let i = 0; i < P.n; i++) b[i] = modQ(c[i] - lifted[i], P);

    const hInverse = sqFromBytes(secretKey.slice(2 * P.trinaryBytes, 2 * P.trinaryBytes + P.publicKeySize), P);
    const r = sqMultiply(b, hInverse, P);
    if (checkBlinder(r, P)) fail = 1;

    const rm = s3ToBytes(trinaryZqToZ3(r, P), P);
    appendAll(rm, s3ToBytes(m, P));

    return { rm: rm, fail: fail };
  }

  // ===== KEY ENCAPSULATION =====

  /**
   * Generate a KEM key pair.
   * @param {number[]} seed - keySeedSize bytes
   * @param {number[]} prfKey - 32 bytes used for implicit rejection
   * @param {object} P - parameter set
   * @returns {object|null} { publicKey, secretKey }, or null for a rejected seed
   */
  function kemKeypair(seed, prfKey, P) {
    const pair = owcpaKeypair(seed, P);
    if (!pair) return null;

    if (prfKey.length !== P.prfKeyBytes)
      throw new Error('NTRU rejection key must be ' + P.prfKeyBytes + ' bytes, got ' + prfKey.length);

    const secretKey = pair.secretKey.slice();
    appendAll(secretKey, prfKey);
    return { publicKey: pair.publicKey, secretKey: secretKey };
  }

  /**
   * Encapsulate to a ciphertext and a shared secret.
   * @param {number[]} pk - the public key
   * @param {number[]} seed - messageSeedSize bytes
   * @param {object} P - parameter set
   * @returns {object} { ciphertext, sharedSecret }
   */
  function kemEncapsulate(pk, seed, P) {
    if (pk.length !== P.publicKeySize)
      throw new Error('NTRU public key must be ' + P.publicKeySize + ' bytes, got ' + pk.length);
    if (seed.length !== P.messageSeedSize)
      throw new Error('NTRU encapsulation needs ' + P.messageSeedSize + ' seed bytes, got ' + seed.length);

    const sampled = sampleRm(seed, P);
    const rm = s3ToBytes(sampled.r, P);
    appendAll(rm, s3ToBytes(sampled.m, P));

    const sharedSecret = sha3_256(rm);
    const rq = z3ToZq(sampled.r.slice(), P);

    return { ciphertext: owcpaEncrypt(rq, sampled.m, pk, P), sharedSecret: sharedSecret };
  }

  /**
   * Decapsulate a ciphertext.
   *
   * A ciphertext that was not produced by encapsulation yields a secret
   * derived from the rejection key instead of an error, so that a decapsulating
   * party reveals nothing about why it failed.
   *
   * @param {number[]} ciphertext - the ciphertext
   * @param {number[]} secretKey - the secret key
   * @param {object} P - parameter set
   * @returns {number[]} the 32 byte shared secret
   */
  function kemDecapsulate(ciphertext, secretKey, P) {
    if (secretKey.length !== P.privateKeySize)
      throw new Error('NTRU secret key must be ' + P.privateKeySize + ' bytes, got ' + secretKey.length);
    if (ciphertext.length !== P.ciphertextSize)
      throw new Error('NTRU ciphertext must be ' + P.ciphertextSize + ' bytes, got ' + ciphertext.length);

    const decrypted = owcpaDecrypt(ciphertext, secretKey, P);
    const genuine = sha3_256(decrypted.rm);

    const rejectionInput = secretKey.slice(P.owcpaSecretKeySize, P.owcpaSecretKeySize + P.prfKeyBytes);
    appendAll(rejectionInput, ciphertext);
    const rejected = sha3_256(rejectionInput);

    return decrypted.fail ? rejected : genuine;
  }


  // ===== TEST VECTORS =====
  //
  // Every expected value below is taken verbatim from the NTRU submission's
  // own Known Answer Tests, record 0 (and record 1 where a second key is
  // needed) of PQCkemKAT_935.rsp, PQCkemKAT_1234.rsp and PQCkemKAT_1590.rsp in
  // NIST-PQ-Submission-NTRU-20201016. Nothing here was produced by this file.
  //
  // Those records are keyed by a 48 byte seed that drives the NIST KAT
  // AES-256 CTR_DRBG, and the scheme then draws its Sample_fg input, its
  // 32 byte rejection key and its Sample_rm input from that generator in turn.
  // This file implements NTRU rather than the KAT generator, so the vectors
  // name those three drawn byte strings directly. The generator used to expand
  // them was itself checked against published data first: started from the
  // standard entropy input it reproduces all 100 published seeds of each file
  // exactly, and the expanded strings below reproduce the published public
  // key, secret key, ciphertext and shared secret.

  const KAT509_KEYSEED = OpCodes.Hex8ToBytes(
      "7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2DB505D7CFAD1B497499323C8686325E4792F267AAFA3F87CA60D01CB54F29202A" +
      "3E784CCB7EBCDCFD45542B7F6AF778742E0F4479175084AA488B3B74340678AA38E22E9628B0A161FDEB0BD252173B9C4E4CD0DBBD9CD3F10EF5FE5E4B034745" +
      "4E69CDFD6C36BEE2C3CF47F23EDA52A8A95F7DBC384BF1B09967401738B817CB724198BC30E7358B1A12D94004D612274642A0989854F369FA991110D1FED15E" +
      "C070458CDF48193FA81551585E81702AAA6B154FDFF41CAC304F3900DFB66AC652C59FA3B78333FC6CB70138D94294F6DCC5244CE0269B8EE6973BB1B154EC58" +
      "414313BFDD47DEF51BB7E38EABDCABB64E7FA4793B44DFC051B4F041230740A8224C35CFAD7F09D550C46C424FB85B10A6DEF6A8C277685714DE995768567818" +
      "9DC4FD930B5F7CDF7ADCB1C1E3A48ECF938578EC32F022131F256B189D66D68D38621DE9C1F353B9E71605D9A5CA0B3CEC6225B1FA9F485617016B1B565571D4" +
      "195C9CBF27069F0A4E8A5404C1D75E083472BA23602372C199A10EB143D18BF83836D4009331D681F7680889AEAD3CE51DF81AB17D387A72802C24926BD5ABB0" +
      "503CC3FA999239143CC9FF3CE1D4CD180F597243581F9CED4BBA0775D9D8703BA54E1CA32E74DB4E8DECB078BD8F0184EF288E72D2F073B7593A98C5AE8C5C13" +
      "C4BD1EDEA548AE2714385CBA5760147A12B644708244D6CCB7276064D0436DBA7348BAC99AF371C3688D79AE361640146C867BA1003517F868AE37D1ABB3F9E2" +
      "0B76C26D439D5BB0B693225A0475BB4922F0CB50C4AAFCADA34BB5A8C89F52011AD6DBB3493C2742D240F9CAA47B543166988F3EC917E737385AD73E471F71B6" +
      "C8C6F9B0DB3AC7C977E54F496748EE8E714D3898F0321FE60ED6F134DBFA6527C6860AEC837274BAC681B17390EEFA0730F4D3EABC53B489437F2C8582074C9F" +
      "4C78C002134941146FCEB1270174267B8CEADE1460F7D13E7287306112DAFECD1D09392FF02DFEB64A4C88B9E68B9811A8F7180BF7162168D71D31477C393A21" +
      "DFBEDF9137C60F3CBAA86C1AD47B3ADBEC101A4B980245E98F4732B2B1E4B7EC5B2F6AAECF8C6B604E43E278D20055B2F7E354F1BC231A00FBA971899CA1DDC7" +
      "F40A348D74E23467581F442B995F3EF009A126111B6619F58978D3354435F58DE0D793D63673513ADBDACADAF981F3C18446537CE3012E6693C465C06846B8EA" +
      "44F0C821692769A7CC5D19086BA268908944ABD00641D894FFE8E4191493ACC87315B6EA4BAF0CBC1BE5B98CDF712321F025C27103D4C599FCBDC9561A846E6A" +
      "3FFEB373BD075750096D0CC1DE48517FE65BB77D62A23B73250476DE1276CBB1F60A82A7884B3F3F88CBCBA9C21D2DA8917C373B0F9F7E0B7E88CED12E641CA5" +
      "237FC701DAF5DEBCD63BAAAE6DF5EB017CC8881B2EDCF31D84791F326596FFE3368C68878426C04AAB634B20DE20EFBBD055CF215FA531A3E13D2A8A7D742A29" +
      "83A9FC1B73668D97D49036AC7BD927D8619F28195412D2EE179B503263372667769064D148D7CF86CD46DCB3D0C13E6BE8994DDAE1CE4CFD13259DAE7C590C5B" +
      "503A1E62AB84C7657F19D3A4DAC8ABE015574344A7153493AFB634BE46ED51F41E2329BB782807310246EDF666CDBE2FC3B059384197280787B0F640AD6757F5" +
      "76E588D42C2620C2E26F5F7221DC4FB009CA0982F4CE9D9B966BD198E73DB6E62DA6C2018C45C8090A1BB86820202FB208EB33306FDCEC831A110189D52D58B5" +
      "49EAC72CAAA8EBF1DD3F48545215455F2220B0C8750415DEB8DBC2B31644FD8D14274880281035BB447C2B97E75F1CB25158F31FEC29C40E2B2AAD526B3BF6B5" +
      "C847B7FFB684D4F5704BF2EB5C0E1EC6253B01C4B17EAB9E0F6384027FBAB6DC617FE39FD47BE738E8A9431515C95F613B39831D1FBF297BB443829F46FD8222" +
      "1EEC2ED02A4C67F56C95D1C05E700A75F3579B6FA51A5AB97895599610E4C1666992B5A80FBC27BFC2FE41F57A9C429E7B5C946B2D7C727BEB1679DC08EF9BE9" +
      "B195C5117AE36FC1E717615AF5FD464CC48B16305B17E0718818EFF181DFEB906504AC7F3261003DB3B1B5F24026A7D8AF8BD42C703E79FED5B1030CA051075E" +
      "006D64E2F0280419997BA93679A7224A909CC92C82155E82AD04DC2ECA485094BC04F0D244671E6994B666240F98807E6B3DF0AE26FF181C6F95A32A028DA7A6" +
      "4C52700405864E6A1778337C123274C449CC2C3CE2F51A452A22DA2746C97658866761BD5DCAED57A443CD97523523A9A5412BE1AFFFC0A8B41A7DEE7F6A8B4D" +
      "7A13F7DBB6E9A331B478A635B99CD107A4632D6DF952F2F25308095EB2C70CBA577679B59B7E650C4EFC9462B08A91DB4BAB5499C7066AD3AD1CCE9E4D31BF9E" +
      "9A81A0FE20E0B6F44726DF3713FA5814E2D6ECEB4DEED26C1A77433C4D957A066F2D9DB6B27FC1281DA66438CE7BC9510C9A79D6F89C5965601B25677C7CF272" +
      "082BA7F6F20F200CD50C016DE0BBC1E881A31AFA318BCC83D6A3519CA5A031CCAE301DB4A0C5485EE956ADBD8E8C051A96F86A0CE6C689BD8B5BC22CEE6BDCF7" +
      "6DCF7D53FBE63367FA0550EB21F76980900A73661EAE0D99E8C24D639EFA6922FCB6C478A3B1771023F700FAFA4813FEFFBEF1B6B046D4A6ED46C275BB0DDAC8" +
      "3E4FDEFE511868F66AEA2BEC33DA99CC03EA1848E395A15BADC822F12890900D1C3A887AD0A1B24DA06B1CEA154770970F792B685FE68E38EEBC0EA8323286D6" +
      "A5696F060AC6C5728C973C7B5D545D4253A45B4B9F3C1B2879ECB761152CAB2F489D8EB160A4EEAEF055C61750852C6CA4C416F81BD75C9AEAB1BD821A2A17E2" +
      "283BF82735CF23A1F8DE5D261FD86FCAE37F7F1A75B40DFBFA9957AA998AAD1DA74714C43E24E2CF5CBB9AC30191150DA9AE1C21C0765FFFA2357B9983ABF62C" +
      "C5B55FFBF28049FE2A6A96018BE0D87F233A30F85022D4961FBB827A6E30DF2F8B95E78E55BA49E52EEA34AD34E1EFBC6A1D6740DED118711D1B49DD66254760" +
      "414E88EC70AEF2E2A57475A55E3C4AFDBEF616065C56AD779B1ED437AC1FE24DDECF4E315DCFD005325B184426CB8D768AD9F80171F4E1C2DDD7E2612AF09091" +
      "DBA05B15042F0D3BF93B8B10C7EED6E72C36DB91CF7CE2A8BC299594E5C6A66263187DF6DAABDF98809B29276D5838563A86E0BD27E15E1D083481E30425F378" +
      "0AEECDAFFB7DA979391B6917C8E5236E1A1327E018397FEBF83980869AE063DD28F0E2DFCEA282B55A38AB273F2C1DF7FA1463E75AF2D5F0CAD40C71C90A2320" +
      "58AEFF8FE6972D734605A35EF1F4006245D5BC5694BB33D5C1BD0C4C1E7799CF02281BE328A8B470AA21C572CB");

  const KAT509_REJECTIONKEY = OpCodes.Hex8ToBytes("1DAB0317F0CE5A41CE7672953D301CFFD710F80BEAC3F19C0E96E68CF8FDAB81");

  const KAT509_PK = OpCodes.Hex8ToBytes(
      "EAD4D1AFF780D5AEAF590D73B44B01C8E45BC3B9EEC0B90290C7BCEED33849F3FDD6BA3D2C34EF5652FCAB9F76930EE49B448AC494DFBC182A78F10DD70014EF" +
      "9A61822D02497A1874452EF32DF3D7AD56BD52188F50FC21D3B782A90BF39276DF359A380BD0D92AFF9D926C44C3427731CF65F0955636C0E843A3AB04BD9043" +
      "D0319D8B44817DD974514E73F0993C82BF01CA361DB7A201F9403391A2EDF959DE5E48980936C87D8801F7448F4453C07DC85BFE92DD6DBC94C0A45C69E81751" +
      "17536BBE70D2C8E1F860B25AAF609402AA80DBED53610A75C238AB812082A937A46C4BF042A1809AF8A2B405DBC079AB7F731895A63C45328DF92BD6F262D17B" +
      "BBA5857882762A25B58D806FEFB43455834028DBDE7F2C78B32A25B9EE4B144CA9F632F48E4DF6E8D082D7795D6175CC4A571E26884E630A7E734DDD522D9359" +
      "2BF9E2A55470E12226E5E4B03DCB0723C9912027E52298B3977A88B6342583BBFD0AC8C6503035AF0FC29E25EAA3C544F3B0F2C1C98C06F20372C59519CE3075" +
      "0DD555FD112A3E407D91C4131A411CC69329DE22971F1C746250DC5BD75F478AE18BC4E60F520296D9578187886DE64EE0BC2D506888AFB23C5E3638C6D87CA9" +
      "3E9ED9354D1515B41CA2CD9FA1E03059F5D369EFCFBE1F77A87607AC102DD8971ECB933D7C1AFE5570805E39E64DA0A273561914D270642112E5B3AF6F6B306F" +
      "C79F75FE4460284212E48692A40F2462A069D527D2E283972686318934B090A7D257D98B139BFDA4031067F111065A202B3495554EBC87681802A8F18012AE24" +
      "4DF8AE4E59D97AE911D32018DDFD451BD67D8A331CA1240DEB2F6D3F6F5D726F79946AD5248F362266BEA333DD1FCA1B9067185DC78900860414505A32431434" +
      "E6F7CC86C068F872DEACC9D239DDC1C9863193C9A13B91492BA23B13E4C6D33BBA43E050910A6796109B4DC4198728750943A5CA6A6B7613AC400E");

  const KAT509_SK = OpCodes.Hex8ToBytes(
      "D067D98F0055E2C3DEEF1076BBB755AFD065112C85C46E6C350655D9625073E94E4528C053E720206CDB780A61AD5120C498A4CD3E60C334D8702F0F79D81418" +
      "AF959CAB7722EBDD30DF0A479E1403D337AD923E5DBCED4EE04839020F7751C075A4892AAB19DC7BD2AE9127B241831D1837B9E22430CE19259F78A5C5BFD0E5" +
      "365E5BAEE52918CCABE583B50F00126D042CBCDC386299EE68EE4EECD860E6131422AEE6B200733758C82DC4BE234F6C46356F017E7D07E45BDCC9ACD1AFDDDD" +
      "5C91388052CE0A536B921606B5EAA6902CA4EF39142611F9BB566D4FD7541443550D8C60B2F6991073C9A1F8043AA469E9127B6A2F5EBD96800D24B8B9D5861F" +
      "1196B1C805676EA4678B1243738F9AE97AC568BC5B6AE078C7BD4F6156817208613C8B59CF7B7AF2A8FBE9637C5B76434E65F1B361A4F6BBF7E1FDE47DD6DD2A" +
      "53201D910E62C3E11AB0C23D8877DEC71D27F78146EED399A4E063BEC0C175E3AB418E08ED21875DA25FA67BC03643D3B70B7C1A118C153B3AF58ED5C4CD1A7F" +
      "32364D1334A44D3499104FAADA5555B86694772EF0065FC673B07576B53085C271ADB3065A6C2A5D9E774ABE94AFBEB8B601AB6F0B619A7F8558D1A824FF4FB9" +
      "46E85C6D1B9C8F55644FD1B32F8E8C8F9CE5475D904F1B1E01763111F4D20D22927955CE6CF2ADC293CA4B869F95107E950EED95088AF862A61EC9CDD2FA33E2" +
      "C3270CB8C89C3A42D7FB2D9CE3DAFD7B6BE9AC16CBFDDA050B255BC5064D4FEA8E80228A533CE53D6C49FF8FDACBE11DB8E162C0A1FAB924FBBA41BAC4F87E59" +
      "CBF9EC28B2CFE3C85EE14C1EED15AE0824FD6BC39FB458F39A8BD06BB052F7A0E37AA73A50F1630FEA418A9D70916CF368A551C2FB4741505585A86C312AE789" +
      "C7DD9023124816F9209317F3BCDE008A9F30C7DC9BBD047E5358F7BBB687D6D61C49E956D6F716DBB8DCF8445976566F3A30808FBA5F584064198A9D8ACCB042" +
      "0D5B0E51A21A1AED64DFB37662C637F83EFC547529588F5D346BA598FDF370A4D5FF8CA9BC2A9E3405EF5ADCE14EDC2A9A5B9F50216B37706D561D7E4CF629EB" +
      "AD712BE2CA575F0C15B65B46A743D6DBC5567F545B485E2F0906A2D05AA2EA56FD3D9765960BDA0D3A5B1A05382670D901B53B6F44AB9240DA7F1BEAE81CA8C2" +
      "790D1DF2A8B18812F1B2F77C838EC1789758A5B6FF681621FB73589AEDEF43062C0F99C15FB779F69EBCA39444EB97BC8802F626C8B15DE666CCB5CA52612EA1" +
      "D594E8AED62C041DAB0317F0CE5A41CE7672953D301CFFD710F80BEAC3F19C0E96E68CF8FDAB81");

  const KAT509_MSGSEED = OpCodes.Hex8ToBytes(
      "1B70B064D09425D8431417974C8C02F78A4F61B3B475837C51A6AA1EC4850AC35C4445D03BBE358399BACAE1B776AE486181755D2675C5E64222E63FA342B1DE" +
      "B5398766927F4EF3771F5B67E2E8EED0ECB7BA33DC39DB6CA1AB6BEABA4DEFEB4677A6C09F10B579802CF4CCF9EAE9A80F72C864853B21F48D2BF322F880B219" +
      "495A2EE0D6BBF9E2B86ED002D09807E0FB53F05694C4F1728027BC4773E5AFE35201B7BC00AC7278315052C337563CF6F44BE5AC8924FCFFCD57A1996D0818CF" +
      "0FC87BC891FDF56321F37EDBA3498CCA05B3980358A0A29701FEE42794EF32A783BC2AB65BC6D41C89A24DF2FC00A6A37FE8B19FA1536D1AD1AC150AF37F5CDD" +
      "8E0E254079641ACB941B19D127ECD8D64F333D0310749AAC25D561F16FF47D8A4F1AE7579CFA2BFEB37D79C86C944828D420B7C67BC724711F9422B4B390B235" +
      "EA9ADBA8155EFC375F1714351AF97836B06E1D0A39D32F58F1B8CB564C6CE7ABE18AF05A78B9C33B70C270A19F14BF8D026381F7FD11B8FD86A3AA6EFD30396A" +
      "D58D0AB81119BF80378ECA75E600C31691799F89A0CD62446F961969FC2119ED44883DCEB7E83CFC4F1C28060A567ED0A665CCC50702DAA47E045ED429E601F2" +
      "A786DCAFD5FEE18690D93696488F8F015590FC8E27F216F8ACA6C3A509D784CBC1896756E0C39AB69A393E211EC6FDB32B55FE3AE9404F903FAD4C03C9E03614" +
      "53A94909B225F97CC3708D7B2AC7D86EAA149209B86ED7FB6D38B1489C43E6B2D3892885A106F73A73348FCFCF4202111614F7FF4CCA56677C890D7E5C02D2AC" +
      "B926426EFA4AB05F085C30A3A5F04DBCCCC2DE8652DC9CA0E32A760E40388CDBE35DEC41A3DFEC049EC334C9BA15AC18454F8F7A68AFE6509802191C92176CE8" +
      "E472FC0F15F0DA0DF3DE67097BB3D7E73B224C4B1BDB165D8941622997819B3B65DE9C0325D9151E4F285E8C899B8C80577E7FFCE40B445156ECD8B1E3EDF280" +
      "89AE1A1B160055BC85804126247F68A7878FD85E6479A38A50F53B8FD4ECE64298EC5C89FC8D1F1258C85676D967B2061A28FC05AF739B1DBC03351A4A78A3CF" +
      "BA4395260B95B30400FD8036FF1CA43C86A6D29DCB103D0E4F83B72D8CCA05B7752E05D6F967C6514A65EE17EE287219728F54DE47AF2DC54DBBD1F8ACE62A31" +
      "7814C76CCF50A31DCD82906DE340A27585A83EB5941BA4783320009525ED306081D085D2328D12629516BDE80D8EB7049C03BFE934CA88FDBA6B1214188A7308" +
      "22D2DA7CDCBDFC8A15165B2C57A852BAFA4FBDD9AE9F19E457A5A8D1B318D8DFDB533317C143184D92749AC7B8D34BE707F6FC6C7108B3732588D905603078BC" +
      "7035EC39E8A607BBA42FA35B4EED25B45E2C08F5CF172DEEFF6595959198AFDDC1E35C4CC0EB31027AFA230D703A04552D5BB8A13561F9A7F02FCC75AADB1F0C" +
      "BDF2522544AED1653264E6365DC8282F300E06376FBBCB7FABB0D5800F8A3B506E7E73A035975217B366F06D6BF3B1EC1D32E71120744FFD1ADDC584DA30D40A" +
      "0FE2D0BEEFD3947F4CC0CA4D6DD17E4A4858FA5A7BCB65E0D0E93E31A0DA2A09B423146428BC2268E5E4ED661B229E46F3D1155C32E64A78E73FD6E928E3ED8F" +
      "54288335F481EBDB63345AF3B531EA8CAF4A8CD510C69EC20FEF1B1B0158ACBABBF09AAEB930AF1462B52E1F202E368314AD514B54DC878164D1108D26E48525" +
      "1B705846CFBAB48E077A55762C49CCF89A0C6B62C4F890B637C372D01EF1DECF6ED8AF99884A08497A8DF29AA9202FA70D717C6A0613320367F6FA130D07FC92" +
      "FC1C587074EF5C71B90E8CC3AEB20DC710EE33010CF5258D183B4FDFE9ABB5AFB3ACDB30C81F3D96D24B357AE098DC2B7E2E1EE831F0DEE2B4E6F151845A591A" +
      "71EAB2392EDC20E1FEC392135890DFEAC509E632787F99A0DCD982088E04BD088FD2BAB6916FACDB4ACF329D2B40BCFFB6E6C738A28A30E42D268FC9451CF62D" +
      "8F6D1242F74B3B77EDBD4C7AD54B012F8BBFEBFF5BA3FC896B97D040F92590CADE63BCEE67E72A250FC1E6F6BFDAAD141C33212BD111E682234E52ED4C151D07" +
      "1D51224D8A00BAF4FF0E1BF7E1767AA25AE39248154D8128F86F544701BC3EAB84EEFB17B20C2ACC28987497959173B8DE3D2A9765708706A00026D73B5E31A9" +
      "20C247218F6B634F775079D01201E766EE2ACB31C2CCE8B16535B4D8A54EBDFE65261CF907620BAC4DA6C1872BC2E439DAF769427D0864FE285B53E9CA54125C" +
      "67762FBF7FF908BA90687372C5F30A012A83E9A27250F196F0FCE0BC94046D6D7C231265E9F5DD6206E3D4D97F7A430D5D4E6EB22D857DCB3BBC655D36561AB0" +
      "41EFC42B9165FF677F4071D23776A910AA4E63F73971AE2673AA6BC94F289318EFE62B6737FC53A127F26683B188043058FCBE8873B51DEB5561EB99DE17A02A" +
      "989B3A20E2504CFC7EB9EE662CD34BAF5C172F38636DFCF5E945C7FA2B6C3515F669F65E0B8A0092F2043013B53C239F33ECE3154F255BCCEB7B1C19B490C256" +
      "2C0DB79DEC0BE0CF58C27D872A9D475F3DB65B85006F124E7FB9B1B9A702191B978BFF5BBD9F463F687AC48E6067FCB62354957AE050741E905F14E41287BD9B" +
      "02FB105BFE1A88C3A2BFFE735B36596519376E2041B9CEAEC3E533365CC8A4E9521368765A96C979607455073BA2CD25C8E3E55225F71109B2FDF38A0ED04E63" +
      "E7A66C9EA95E49672C0E6EB820D0744CBA3133770DAA084067B7F52BC6AF97034FEB0A6E0A95CF1398A5A99B16BA0E4D6BA5BCD0B645E7CFD8DB4C12251908E3" +
      "B054F35BD5E2A14C9CEC39B329677D4F7860AB332B0B055FE302FF0F33B0EAB3BDA16F85D39E733C96CB5F4C2B943604AE377F2CCECFC203920E25807BD46C66" +
      "3B6DC6A58409205F3B7DB7A2F6D42C8DC609F4E4DEDC45E7CC90D544F5871128C7BB7214B524826ED8A1863B8ED1A06438AC32E27A1DBE39C4C2BA37B72C90DE" +
      "6065C4A238BB3AB6AE0E20E41884C4825B321A6FA3C700208C178D21717857635DD5AFB30509A08EF293978EA7C6A3B8AAFA4D79223AAB37C090958FA543719E" +
      "222ED61C5ECBF12DF53C27AAA10A384E8E0F8641B36199435B0A52E4038D7FB2CFF180A28C36951216B6CF2391612413ABA6C277E2A1F6EFE86D6B653E50A0CB" +
      "26698EA10F8EAC36DE48CF58A9E9BBD5D7DAA8E7FC6457867D3C7ECF880EB3B4F1C9E7B56795AF649245ADD842297B513AB0B5B2CC846B2BA357FCFF94600F42" +
      "26EB85B544DF3C5BCB78F43D066C718A90CCA01BBF36FCEBB6E399C080B6FADC6786713D69F1BD2F91F96AE7A750E7C20A362DB3751034C068B026E774618E05" +
      "058E3B489C7445B9CC8E48D640AB423DEA989278C309403F828BC7CFCB2D5750C05DA28F612A309E88931604D7");

  const KAT509_CT = OpCodes.Hex8ToBytes(
      "B934872B0469349CC3C88AE57AF98D6E2330E666CE889E3707523224891C0685933F0314B28E1D6E1C3559C8695EF26AB6BA3AF701F63FE2B0642E896D17F71E" +
      "EA86F8C1AD18C2B4B5F7F4D2F4ECA491550D099717783560DFC4CAE9B74351E71A4B1A2BE001B8C5FF69ACF25E8AEB01039C15C7A29BAE63BA6749DD6CB83B3C" +
      "26258F55F11429D91FE90C4388B5237B0A2EB7143A31A9E50CA16082C61D1B531AEAC9060D5D7DB75B0DFB7A586967B0474F9E54D69167F9F1C1461189941C6F" +
      "BCB0FBEA0FC9755E3DE609D785C9B8D071FD6A90C827ED0D8350B507052C8C2C43663F81CF3684D42841B51DC707859818BCBB53462D1F13ECA541D106CA5B75" +
      "6A6FF482E6E0F655A0DF7FBB558430E95FBBB6D58EF07AE6BE2A24B0771943B9E6813994A0A03D4CF76029ABA1CB1EA390469F944D7A23B50B8163E0B4281E2B" +
      "769E8E36A3C16385CEAF9481B6C15CF602C79AEDA0CBC26278CC904448B360B1B32C595EA7E13EA72D5DEE3A0BBFE801481E276139B1663AC1F7E7A2AD87F617" +
      "F903DD4CA3D24D887702435FBDEB149F5595F276A5F16C6E3B5BFD63F1FCE5F83219779CCB14B3A34CEE18C5DA1863596B4054FA263A6C9464ECD246E8ECEE8A" +
      "9D2142004255BAFB059D687E82C7F5B250E0AF388CF65F358EC53833B8DFF6A0952D443C18929A5889F4A0352F3F01BF512FE37360B5ECD7CAF4055301B66B35" +
      "2A58A199E79364B69571ACD64402DC82F0DB002BC567595787E966ACBD8EB0D73A494A66217967ECA7C11FE480FBB342D2FDA73CCC2CBDB915815A4F815F6174" +
      "9D4F7812E89248AA84E9FC2330113381C05D05D7818EB888CD603115BF609AA0DF47BD1362456493272FAFB2DFF05F3BFA9BCC591D2A989354E4022F611D03FB" +
      "001FA23878C423E2794A974DDC3488CD97938052FE71CFC5F93EAF96F6B670094C0D3B294340E5C73A3CBAB806A9803A8A40DA788C7E997BD21B02");

  const KAT509_SS = OpCodes.Hex8ToBytes("176FDBB009DD3F848B365AB7F18D9C0C91721931C8594C2C6F043C8600791A6C");

  const KAT509_SK_OTHER = OpCodes.Hex8ToBytes(
      "22627B1EDC147AC45554273783748C64731652DB85D80C6FD5223F06D733D038B0075B54052C7342624D879B3BD998A7E2B51682ACDD0B81C876E91BD14C9697" +
      "95E044286F88265EAE3C7774ABBEE08B4646109FE0A5E51C8B02DF6D91AD559EB3A2033B1411A7F0B3DB02CD1C2D52C6CC2F508D9A074FA042C5372D7BB3914B" +
      "225737CF1DC53207C14A38CF28418E308CDA434AA8C8083884D4E204CBD6D33515C5CC071761894E82B328B8D9461DD79D7C8410A41C05BACC9BF0102E6F4CD0" +
      "BAE0460588B6254317C2020282648D525CAA26390BF2B70A116D523F4717854F34031EC703E971A4E8B0BE5C9C4A6B663C4592F618162CD134A8FEC8A42F997E" +
      "35ADD8C4CFB01E68021E2B3FC2B76143B95E9C1B10D4007A65A5D96202B89765D0402FD2CA8D611C7723119D67EB7C986F46CBBD923C8FFB46614CD4E5092907" +
      "C8DA0ACF5A441D4FA069B9D4DCA07E7158D4DE33BE360B294179F96F57EE0510867B1F3FCB05CBF55C2BF95FD41FA6F5A0AA91DEBAAEDEB5CB8EA833773F395F" +
      "7B758E8BA60713A801A99C6800816FC97A871DAC4B86EE3C3801D4B377C56FE2F3EC9BD7C2C56BAF01B4A3F2FE41E895D9A8B3D75EDEF77447B9AC33E3DB74B1" +
      "C0175032EC3CF33FA7E2D02C4B4E29EAF87C5FD783BE3DBEC05A883179A54ABAACD85803976B14523FF97018DF21D9A89E631800BAE74B5DA4A8A03748F8B660" +
      "250B072AD0C87A85DFCE594F80895E31F66881B1165ED2A2720E73FE22C6997FC23F78E5E0A01993B7DA21122B443C6BA3AC5EE15594B8863C505D68D75CA54D" +
      "0991BAC479FE4321AC3062768E3B46CC7AF57BD51241BC2F7712739BB15C31F58A5451285EE5CC68B88B08E4B6CE1F76C1F8847A45A2D70B70A1882BD159A3A5" +
      "392EEF9DFF942DBF624A1CBE17194B44022BB0560900ABC795FFB85A3EDA42950AF3CD2842A0A2D87BCFF1CE220F01FAC0E61C0573CDD93A4ABA25A56A2C1942" +
      "DAAACBE388518D86B103F2C635551C8B51F7B17BAAC1F59B6141707AD218A4DEBAAA07FA858C48AEEECCD9A722CDF37D08083453166D919D3C76ABAA2F27F7AA" +
      "50995F79655AD8A784AAACB7CCE86B0CA99F3475E45FCCAD4E70BA05FC40C9EF88256186620BF01D399ADF3C1131046465D3AAA3173DAF3CF765A9EAA7C87748" +
      "ACD8F781E7DD41D58D7E751E77B134D55C670AF997508F6AD59345ACC6E60CCD63DB3EB0BCBDC1DBCD1EFFB9C55C35D7C1EB0C0F4CFDAFAE1A4EDE9DABB56662" +
      "C917C24C305404E886214E69BD0B4966AE8458E99F646EE3FE645098E44D69F012515CF9BAA4E4");

  const KAT509_CT_CORRUPTED = OpCodes.Hex8ToBytes(
      "B934872B0469349CC3C88AE57AF98D6E2331E666CE889E3707523224891C0685933F0314B28E1D6E1C3559C8695EF26AB6BA3AF701F63FE2B0642E896D17F71E" +
      "EA86F8C1AD18C2B4B5F7F4D2F4ECA491550D099717783560DFC4CAE9B74351E71A4B1A2BE001B8C5FF69ACF25E8AEB01039C15C7A29BAE63BA6749DD6CB83B3C" +
      "26258F55F11429D91FE90C4388B5237B0A2EB7143A31A9E50CA16082C61D1B531AEAC9060D5D7DB75B0DFB7A586967B0474F9E54D69167F9F1C1461189941C6F" +
      "BCB0FBEA0FC9755E3DE609D785C9B8D071FD6A90C827ED0D8350B507052C8C2C43663F81CF3684D42841B51DC707859818BCBB53462D1F13ECA541D106CA5B75" +
      "6A6FF482E6E0F655A0DF7FBB558430E95FBBB6D58EF07AE6BE2A24B0771943B9E6813994A0A03D4CF76029ABA1CB1EA390469F944D7A23B50B8163E0B4281E2B" +
      "769E8E36A3C16385CEAF9481B6C15CF602C79AEDA0CBC26278CC904448B360B1B32C595EA7E13EA72D5DEE3A0BBFE801481E276139B1663AC1F7E7A2AD87F617" +
      "F903DD4CA3D24D887702435FBDEB149F5595F276A5F16C6E3B5BFD63F1FCE5F83219779CCB14B3A34CEE18C5DA1863596B4054FA263A6C9464ECD246E8ECEE8A" +
      "9D2142004255BAFB059D687E82C7F5B250E0AF388CF65F358EC53833B8DFF6A0952D443C18929A5889F4A0352F3F01BF512FE37360B5ECD7CAF4055301B66B35" +
      "2A58A199E79364B69571ACD64402DC82F0DB002BC567595787E966ACBD8EB0D73A494A66217967ECA7C11FE480FBB342D2FDA73CCC2CBDB915815A4F815F6174" +
      "9D4F7812E89248AA84E9FC2330113381C05D05D7818EB888CD603115BF609AA0DF47BD1362456493272FAFB2DFF05F3BFA9BCC591D2A989354E4022F611D03FB" +
      "001FA23878C423E2794A974DDC3488CD97938052FE71CFC5F93EAF96F6B670094C0D3B294340E5C73A3CBAB806A9803A8A40DA788C7E997BD21B02");

  const KAT677_KEYSEED = OpCodes.Hex8ToBytes(
      "7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2DB505D7CFAD1B497499323C8686325E4792F267AAFA3F87CA60D01CB54F29202A" +
      "3E784CCB7EBCDCFD45542B7F6AF778742E0F4479175084AA488B3B74340678AA38E22E9628B0A161FDEB0BD252173B9C4E4CD0DBBD9CD3F10EF5FE5E4B034745" +
      "4E69CDFD6C36BEE2C3CF47F23EDA52A8A95F7DBC384BF1B09967401738B817CB724198BC30E7358B1A12D94004D612274642A0989854F369FA991110D1FED15E" +
      "C070458CDF48193FA81551585E81702AAA6B154FDFF41CAC304F3900DFB66AC652C59FA3B78333FC6CB70138D94294F6DCC5244CE0269B8EE6973BB1B154EC58" +
      "414313BFDD47DEF51BB7E38EABDCABB64E7FA4793B44DFC051B4F041230740A8224C35CFAD7F09D550C46C424FB85B10A6DEF6A8C277685714DE995768567818" +
      "9DC4FD930B5F7CDF7ADCB1C1E3A48ECF938578EC32F022131F256B189D66D68D38621DE9C1F353B9E71605D9A5CA0B3CEC6225B1FA9F485617016B1B565571D4" +
      "195C9CBF27069F0A4E8A5404C1D75E083472BA23602372C199A10EB143D18BF83836D4009331D681F7680889AEAD3CE51DF81AB17D387A72802C24926BD5ABB0" +
      "503CC3FA999239143CC9FF3CE1D4CD180F597243581F9CED4BBA0775D9D8703BA54E1CA32E74DB4E8DECB078BD8F0184EF288E72D2F073B7593A98C5AE8C5C13" +
      "C4BD1EDEA548AE2714385CBA5760147A12B644708244D6CCB7276064D0436DBA7348BAC99AF371C3688D79AE361640146C867BA1003517F868AE37D1ABB3F9E2" +
      "0B76C26D439D5BB0B693225A0475BB4922F0CB50C4AAFCADA34BB5A8C89F52011AD6DBB3493C2742D240F9CAA47B543166988F3EC917E737385AD73E471F71B6" +
      "C8C6F9B0DB3AC7C977E54F496748EE8E714D3898F0321FE60ED6F134DBFA6527C6860AEC837274BAC681B17390EEFA0730F4D3EABC53B489437F2C8582074C9F" +
      "4C78C002134941146FCEB1270174267B8CEADE1460F7D13E7287306112DAFECD1D09392FF02DFEB64A4C88B9E68B9811A8F7180BF7162168D71D31477C393A21" +
      "DFBEDF9137C60F3CBAA86C1AD47B3ADBEC101A4B980245E98F4732B2B1E4B7EC5B2F6AAECF8C6B604E43E278D20055B2F7E354F1BC231A00FBA971899CA1DDC7" +
      "F40A348D74E23467581F442B995F3EF009A126111B6619F58978D3354435F58DE0D793D63673513ADBDACADAF981F3C18446537CE3012E6693C465C06846B8EA" +
      "44F0C821692769A7CC5D19086BA268908944ABD00641D894FFE8E4191493ACC87315B6EA4BAF0CBC1BE5B98CDF712321F025C27103D4C599FCBDC9561A846E6A" +
      "3FFEB373BD075750096D0CC1DE48517FE65BB77D62A23B73250476DE1276CBB1F60A82A7884B3F3F88CBCBA9C21D2DA8917C373B0F9F7E0B7E88CED12E641CA5" +
      "237FC701DAF5DEBCD63BAAAE6DF5EB017CC8881B2EDCF31D84791F326596FFE3368C68878426C04AAB634B20DE20EFBBD055CF215FA531A3E13D2A8A7D742A29" +
      "83A9FC1B73668D97D49036AC7BD927D8619F28195412D2EE179B503263372667769064D148D7CF86CD46DCB3D0C13E6BE8994DDAE1CE4CFD13259DAE7C590C5B" +
      "503A1E62AB84C7657F19D3A4DAC8ABE015574344A7153493AFB634BE46ED51F41E2329BB782807310246EDF666CDBE2FC3B059384197280787B0F640AD6757F5" +
      "76E588D42C2620C2E26F5F7221DC4FB009CA0982F4CE9D9B966BD198E73DB6E62DA6C2018C45C8090A1BB86820202FB208EB33306FDCEC831A110189D52D58B5" +
      "49EAC72CAAA8EBF1DD3F48545215455F2220B0C8750415DEB8DBC2B31644FD8D14274880281035BB447C2B97E75F1CB25158F31FEC29C40E2B2AAD526B3BF6B5" +
      "C847B7FFB684D4F5704BF2EB5C0E1EC6253B01C4B17EAB9E0F6384027FBAB6DC617FE39FD47BE738E8A9431515C95F613B39831D1FBF297BB443829F46FD8222" +
      "1EEC2ED02A4C67F56C95D1C05E700A75F3579B6FA51A5AB97895599610E4C1666992B5A80FBC27BFC2FE41F57A9C429E7B5C946B2D7C727BEB1679DC08EF9BE9" +
      "B195C5117AE36FC1E717615AF5FD464CC48B16305B17E0718818EFF181DFEB906504AC7F3261003DB3B1B5F24026A7D8AF8BD42C703E79FED5B1030CA051075E" +
      "006D64E2F0280419997BA93679A7224A909CC92C82155E82AD04DC2ECA485094BC04F0D244671E6994B666240F98807E6B3DF0AE26FF181C6F95A32A028DA7A6" +
      "4C52700405864E6A1778337C123274C449CC2C3CE2F51A452A22DA2746C97658866761BD5DCAED57A443CD97523523A9A5412BE1AFFFC0A8B41A7DEE7F6A8B4D" +
      "7A13F7DBB6E9A331B478A635B99CD107A4632D6DF952F2F25308095EB2C70CBA577679B59B7E650C4EFC9462B08A91DB4BAB5499C7066AD3AD1CCE9E4D31BF9E" +
      "9A81A0FE20E0B6F44726DF3713FA5814E2D6ECEB4DEED26C1A77433C4D957A066F2D9DB6B27FC1281DA66438CE7BC9510C9A79D6F89C5965601B25677C7CF272" +
      "082BA7F6F20F200CD50C016DE0BBC1E881A31AFA318BCC83D6A3519CA5A031CCAE301DB4A0C5485EE956ADBD8E8C051A96F86A0CE6C689BD8B5BC22CEE6BDCF7" +
      "6DCF7D53FBE63367FA0550EB21F76980900A73661EAE0D99E8C24D639EFA6922FCB6C478A3B1771023F700FAFA4813FEFFBEF1B6B046D4A6ED46C275BB0DDAC8" +
      "3E4FDEFE511868F66AEA2BEC33DA99CC03EA1848E395A15BADC822F12890900D1C3A887AD0A1B24DA06B1CEA154770970F792B685FE68E38EEBC0EA8323286D6" +
      "A5696F060AC6C5728C973C7B5D545D4253A45B4B9F3C1B2879ECB761152CAB2F489D8EB160A4EEAEF055C61750852C6CA4C416F81BD75C9AEAB1BD821A2A17E2" +
      "283BF82735CF23A1F8DE5D261FD86FCAE37F7F1A75B40DFBFA9957AA998AAD1DA74714C43E24E2CF5CBB9AC30191150DA9AE1C21C0765FFFA2357B9983ABF62C" +
      "C5B55FFBF28049FE2A6A96018BE0D87F233A30F85022D4961FBB827A6E30DF2F8B95E78E55BA49E52EEA34AD34E1EFBC6A1D6740DED118711D1B49DD66254760" +
      "414E88EC70AEF2E2A57475A55E3C4AFDBEF616065C56AD779B1ED437AC1FE24DDECF4E315DCFD005325B184426CB8D768AD9F80171F4E1C2DDD7E2612AF09091" +
      "DBA05B15042F0D3BF93B8B10C7EED6E72C36DB91CF7CE2A8BC299594E5C6A66263187DF6DAABDF98809B29276D5838563A86E0BD27E15E1D083481E30425F378" +
      "0AEECDAFFB7DA979391B6917C8E5236E1A1327E018397FEBF83980869AE063DD28F0E2DFCEA282B55A38AB273F2C1DF7FA1463E75AF2D5F0CAD40C71C90A2320" +
      "58AEFF8FE6972D734605A35EF1F4006245D5BC5694BB33D5C1BD0C4C1E7799CF02281BE328A8B470AA21C572CBD18D036C543031C8AB6DF70AF37E3DAF15E039" +
      "EB60E1BDD5960B3D9E457264362F3D5AD0E21195303272E6933C3D73A3DD46F5E1672A37BBD23545629B77C3AADCE396FEC94A5546DCD58681786850A8F1FF09" +
      "98314A3C0257C0FAD63A80CCF68F6E6E6D49082C35AAED267A31B978526EE3B53373E2202CA37E8022AA3D284EA863D94FE65171A4D1B4BE3EDD5B2CE36AECDD" +
      "35F720A3ACA7F157FA09D51DACBDA152DDCF0D81521C6D3D35A8B463FE57C85E89EFCF064E500800785B2531B2702A5055DF5FE852EE9F377602C683623ED731" +
      "8AFA45E60B31341CDE1F97FCAD803C8B309A0D52ADA46DEE93ECA01998CB243FFAE2689DC2C9434B9CA021C69AEF4C5A281793056DB7FE2412E30546464221FC" +
      "FAF075778A526EBFCFA46658F480C910DA47B5DE2845CA23BEE2468FE374FC1655D90E194B792356BCFC04309B81C71B714D67F9F0388D001345F8C92823DF95" +
      "468A5B38A31F1879E9922FECCCEB6717E8768779372A91E90B534180989CF01921E45F36CB84DA005C8718A2564CB2A3978D502A0145C076B6E5EB189C0DD35B" +
      "0EB9EDC3963A694C7690029D283925AC2F6DF89743F3DAC1C6D2781255CA80D4E6E704BC5115DB8C5CB03CE959D8800BC4DB46B794668FBDA24C5DF5666BAE39" +
      "789595B8793D98EE2E2D66D3AD7E9AF3D446413952F51F03176C6AF3C1E34165518A6D993EF2886117049A76AB14D8CE5CCC36E0722F0B4580CA8A2CD200A00A" +
      "9F3531B0CF4A111EC31802DA9DB46C30BCE35DB6767EB899FA50D035F050B958B9695CA1D04A4D70015CCF0602564507821EC9DBE3C58ED479AE92A420FA0660" +
      "D6A8A0A46A124C6B154F959DEEDE5C6A73878B2D558DDBE4CFA08F82996D0437938010B06DE929DBA44531D8A2D5C289EDE2EBD7F21B738C2AEEB3C9D6C0A8EF" +
      "6D86F9558CC0963746FFFDB5FF8175C4659029AA70B316E51DEF01BB36340B6295945F9E323FA65D01A6B092A56735FC0203AD27DEBDBD5D54C24CB10316ED9F" +
      "5EB5D7A0A9C814FC63A7F256BB39AE0BC31798B42EDCB1AD95B6B59BBEE52E2D39169D12471986E531CD1D8B84E97C4C9BBA005A213FC845C06DAD61ADFE33C5" +
      "FC6F81237560C56DAEB9A4");

  const KAT677_PK = OpCodes.Hex8ToBytes(
      "57EEE113D3506F111CA9F253D1035C2ACCF68212488724FA9EB144F5D3532E6914DFDE79861D843A26F0A8D43371EE273D53B90879FD8C2F985F53C59B338784" +
      "B88095284EB5A49DC6B5018CCA0806247BD69EB62E1C1431947A90ED8549F79183B27B1F4A81CACB7B3F42D631484423516A86FBD49965E7863D06D1347317F0" +
      "F6E9DB8B9E23AA5FED16125ED59A9D27CCF7C5BB77FD02ACFF8E9812F0045011022627789D679E30B0DC2AFB558316A1714A6958FE9178F7BD8F045F97A5C134" +
      "C9D7F816EF5B987C441CB56A88543678F1965F2F5D4E3A6B2940DEC16DE78AF74DB0F8545ACA3F656B6701AB6CE28541C98F7F72C8FAA26B01D3DBC9F1393163" +
      "80F8816C28FC5254CCED591DFD58690D2BE2B1ED2F37E7439977BB379B9F4ECF5C8DEC407131321FAFD45AB9DDC4EFA8ABD28B3F81F7FFC8D7AB707B1418F703" +
      "5521D59ECF0271E96FCC41FAB7C6E9C5EAD20C8A770E4B8DFDC950D36884EAD3004FC878C5418A3CEF0A61A2678B9691F97D89951BD874907BBEF6DEEC410690" +
      "EC961182645277A747E2C0FB8F7A6742104DA572C05C8F9BB17BCA5BC9FBFC5268B3FC49E620E1A1732B0E914EB49DF377CD3A496D5FA2B9070F818C034F01AD" +
      "EE14768F37D4BD26F4A8C1C8822C79A2F5E85689D8B3758CCE34ABB5680C20FA49F997D5C882AB4F77C10584F7BCFAF72FC7CE0405F4FE106C53AF063739D81D" +
      "794C7D19C458AE2F98FDB3EDF5D5AED7EC7F8826558EF6D7176A92E4B0130EB03F8081B0D1468F4158A9A534923C825D339ADB60AB6DE9F339BD87279D29E481" +
      "CCF6DE733E6181E229B2EE65731B7240206C9AD0E167BBBD44BF706E26FC2AF74FD3C8975DD73343B1718A9F13428DE4699196E69348A8FC709F820E09836550" +
      "8B4D222C51D4475E3557D1DA96C99FEAE9AE55E149FC987A987DACE81CEE2097AB48742025E64277030D49F1262AFEB6C74EC9C4843DF9B6BA124AC99AFFA94D" +
      "F662A8E23535EDC001545F6FC8D8CD1D87DDC3B50C4BAE74C004BCC8249CA12E353C0B86AE65D0E676B0A9817404D6047A359A3246819D185DAA114A878B43B0" +
      "3A3BFC000D1E779B41486CF0066EAD68E297CEA9280CF4BBA50F9637718F3FBAFA0687AE5501A1634BE8F318A842C235E5D149BC50ED51377360D27A60B2EB64" +
      "36635A656A2A7B7B879DB9F5CE817729E8249D1A6BBE70092D989E1A23CCE2E040190B7794E2798518D29B75AC10CDC9FBE897BA489228853F7AFCEC4A71B356" +
      "33A9CFB58429A62C9BEC7DACF66E94EF62010E98128C6361C5A8C51067E1FF45CA02");

  const KAT677_SK = OpCodes.Hex8ToBytes(
      "D067D98F0055E2C3DEEF1076BBB755AFD065112C85C46E6C350655D9625073E94E4528C053E720206CDB780A61AD5120C498A4CD3E60C334D8702F0F79D81418" +
      "AF959CAB7722EBDD30DF0A479E1403D337AD923E5DBCED4EE04839020F7751C075A4892AABBB0E001ABA95515E1B65C63C503D97E51EAFB9AC930F5A1DBCB7E9" +
      "388B5EF1E75E89020D1E5181B4D12060B6A8A8143F275E38D559D5F18A150F49E0CB73A2972DB84F57DA46EF4D8AD11F2B4F5A9526A77901BA600FC6E9C9E6F0" +
      "7AC2D9AD2440BC2BB171439AED3296435D3B7F102CE3135D0D51C4DA052E9163C6A1646ED80FCA390960E3C402241F5FC053BC5703558AD9E9CCDB5AC4284B6A" +
      "69D36C042E297C9C48C61A85735D8C020D2F43774368CC183538FFE6D7021029A3E5F1EC56F5EE9ECBC09F5FE092F87657D3412B3F66F05C99CA6F2704B43FE5" +
      "422D342B4817CF3A51E62FAE2821D7A0CBA8351879451120058BD863D189EC80750489F8DEB435D39EA10347F7D0D0419D4A9ADD5B24402DAA99B55C94C5B71C" +
      "5B35DD7FAC204B984DE339690D6DF89E276E855A635677BBEE380A1C21751B6D0F13145FE4769A0103720AFF6F14181A42492303553EFF4690BC397D4D43BFBF" +
      "309A58906F32FD549A6BE55AAD7E1229CAAAD718214C6FEE3690A45532B2C4E82BC4B54F2D8CA43020A2F166306860D301D563F01CA3BDE59A3FC79DBC7A6220" +
      "FF77933E2E5B59BC938CB86B31D74163B4F37A0BD9C58082F1EDC89FD52DDCB633C0010C01E0993DF867FE63299C010AF0767899B45B05B9BD8A76487D582839" +
      "1DE2579B7B653CC0CC4C1E694F7180F3B1209F27C6E7EBE367E6271667B2E164C94D0DDE36E32552DDC01355B36D86572D8208573F0A2C309121328E56A6A50F" +
      "0B6ACE202C376C937376F642F269279923373681DE9F9FC7375E75F3433333D58D721FBBEC08CB99DD82977F4B3DF907D640EFDC19DDD5C2C6374B6FB2C6734B" +
      "8508DDBCB82E6926AD126F34739A62E5B0F66F3CA20C42E8DC0EDF4BB97227334E5C3A90D1A5A392D7341B3707F02459D12FFF1208D0C88A2B7C6178887E42D8" +
      "2AD7021C0930CF6723332DD20BB4AB8142BBF5D7969F2B962058E78FC871A33E530026DE2490405DD44084D1300CF98702EB5382402F81A4BDD3B8514F0E7638" +
      "260AB418A4673F7DF3595B96170B41BB87595A41C5BEF56CDDA831781E13CBEB3CAE756C6CDC73BC2AF82F7EA1D1821B2F5597A7561367E14AA513BA9FC71382" +
      "3810B8C7A5D7AAB81E5FFF6249F80342C7E573A6C60C8E82CF39947BC820F0C7710CB3201C17891EEFCD89E3B1CC5065993B4D48BEC3F298C4F3EB23125A4EEC" +
      "F5D1A29DCDFC60C96B40F584996D0B91154AFDDFBA2C19DA34D82389F7361FCBBAC69F2A88336539B020403F3A19B92D5BB65610116CED92151CE2D176C27778" +
      "B08A7D4AAF6DA474D1B33CA0C13905483B0AC84C5351FC3B7ABECD57DADC126A6210C45288F569577A52F299192B1B6F414B2923719E7838532E4DA6C35BAFDE" +
      "5620CFD2AB751D4652DB3D062477B5C962630123D68016D8D7ABE325EF4D20118F217C74666CB1421E7456958F25D2349429B1243280CDB0D0F22E8FDEC6E91E" +
      "5145D4A0085C077EAE0EB3B5CD73DAF3D1F05C2970F3E962B665A604DCB58887A083CC5A911F40EF6B78009B1431C15CCE02B8C0841DAF4D39750FD73EB8A500" +
      "42BCA6139F764481FC96CEB468CDAC1576AE");

  const KAT677_CT = OpCodes.Hex8ToBytes(
      "A1D9CE5958DACA0F9799C9AE5D4395CB6368371BB9F93F906DAE552F529B1CA5DFEF9BFCBCED6C74F3F189F1A165EE30A90B246DC729FA08D14DC82647E2EDDC" +
      "FB9BB242DB2EDFBD70F555241028A80A666ADFE7E597E71D4B43C072EDB54390E9D8F5A76EB85FB1CFE562DCCFE333C3FA8ED2222998A583284E75A65E5FFF9D" +
      "F51F0549B5C8C0C12D4089A2121D9DA1DACFEBA4E6919ABBC580AAB4EFB9FA341A073CFFA40E5EBCCB7ED84C8597147BB888B50EBCB4A0618E81D73A64BBC546" +
      "5DA64A525098E27647627BFD0F91D5D636754A4310F5D34E3BBE3502BADAAF0A589855F3AB64E1F2DBF7BE8F7A257B553F4A1BC12DABA163420D1782FE4830E0" +
      "13E17397FF012F5F6988BAF89FDBE61EB1150300309C00DEF1F055B90D1F59AC349528FE94EBFA2DF6DBDFB83A6178F5F22E7CAD8FC44ED46A9C582235D62AB5" +
      "D750F82CD731AC5E30ED691DAFD0BF0512571C5A39C1F627202F46CB5EE7F6CD8CD4D4FD3A68E6996B9AB77FA686AB596570AEE23ABB0521CD04185731141AE1" +
      "FCFBE618924AC762BFD0524A5108D1447AA48ACC956FD06970F8D7BF90C424E6F1437903233A91FEC3BE1064F853C47DF5E5622F68A317D84B770A114942DCF7" +
      "7C6200CE8D7557633DD9605581CC3BFC79170044F7E212FFA64AD8307D73F6D8929A3854FAA32129962C9FCFAF3EB1F2F3B4B83DD7EB2825920D0BC9C9C9E6C8" +
      "E129CC09730D421E403AC5A9843BE7F40EEC25DE144BAF756904FDF86C867420B9D6F068720369524F4CAA53CEA85AF17F50CFCC554DB287B15F134E642FB14B" +
      "431A0089087CFA47ACD8985B56346EB859CD3D2C9F9B14E0F9E5C8248D7534D8DC5029FED01AB201B27BF1B903EA198592DAA27ACA9CE9BDF28B4831B22C9E22" +
      "0EB25D556215C234761F0A96B0856AE26FD92E4B40F7E13C3C3587C60AF3D5C49430F768949D6E0C2439EDE3409858CA4055E5CAC325E21CE1BFBB2BBD3BBA13" +
      "6E59C7E1DA2598975189111F0730B69E7E1B5477D13884ADD70B3CA8A95575620347CF50AFA72EDE635EE70C62B566F5B6D2031F3CDABBE2DC9500DDEBE760B4" +
      "D80158835C2B00E6BC514F2A762BD699EA97E7324CFA5A9EEC11426396DC2E93C943C209AF1525490EF3F1F05EFE797731C9AFF61858FB92F4D0C9B34EA6AA18" +
      "87501D7D961F1E7D1256F77E84BBBF5381EFD57610EC4ECC3900B3A377BE302F0F633F1C6C0E38ED9327C743D2EC4D7A2B06449FAA5F9D5D152908325DC77F7C" +
      "2674975B662D8AC7F67C78D58F74C8C018D77BFAF447CF55A46F790599E99CCAF40E");

  const KAT677_SS = OpCodes.Hex8ToBytes("49AC4D5D1634C6AFFA5A08C2B228EC806D7870B1517990728663D2D8BBC184F2");

  const KAT821_KEYSEED = OpCodes.Hex8ToBytes(
      "7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2DB505D7CFAD1B497499323C8686325E4792F267AAFA3F87CA60D01CB54F29202A" +
      "3E784CCB7EBCDCFD45542B7F6AF778742E0F4479175084AA488B3B74340678AA38E22E9628B0A161FDEB0BD252173B9C4E4CD0DBBD9CD3F10EF5FE5E4B034745" +
      "4E69CDFD6C36BEE2C3CF47F23EDA52A8A95F7DBC384BF1B09967401738B817CB724198BC30E7358B1A12D94004D612274642A0989854F369FA991110D1FED15E" +
      "C070458CDF48193FA81551585E81702AAA6B154FDFF41CAC304F3900DFB66AC652C59FA3B78333FC6CB70138D94294F6DCC5244CE0269B8EE6973BB1B154EC58" +
      "414313BFDD47DEF51BB7E38EABDCABB64E7FA4793B44DFC051B4F041230740A8224C35CFAD7F09D550C46C424FB85B10A6DEF6A8C277685714DE995768567818" +
      "9DC4FD930B5F7CDF7ADCB1C1E3A48ECF938578EC32F022131F256B189D66D68D38621DE9C1F353B9E71605D9A5CA0B3CEC6225B1FA9F485617016B1B565571D4" +
      "195C9CBF27069F0A4E8A5404C1D75E083472BA23602372C199A10EB143D18BF83836D4009331D681F7680889AEAD3CE51DF81AB17D387A72802C24926BD5ABB0" +
      "503CC3FA999239143CC9FF3CE1D4CD180F597243581F9CED4BBA0775D9D8703BA54E1CA32E74DB4E8DECB078BD8F0184EF288E72D2F073B7593A98C5AE8C5C13" +
      "C4BD1EDEA548AE2714385CBA5760147A12B644708244D6CCB7276064D0436DBA7348BAC99AF371C3688D79AE361640146C867BA1003517F868AE37D1ABB3F9E2" +
      "0B76C26D439D5BB0B693225A0475BB4922F0CB50C4AAFCADA34BB5A8C89F52011AD6DBB3493C2742D240F9CAA47B543166988F3EC917E737385AD73E471F71B6" +
      "C8C6F9B0DB3AC7C977E54F496748EE8E714D3898F0321FE60ED6F134DBFA6527C6860AEC837274BAC681B17390EEFA0730F4D3EABC53B489437F2C8582074C9F" +
      "4C78C002134941146FCEB1270174267B8CEADE1460F7D13E7287306112DAFECD1D09392FF02DFEB64A4C88B9E68B9811A8F7180BF7162168D71D31477C393A21" +
      "DFBEDF9137C60F3CBAA86C1AD47B3ADBEC101A4B980245E98F4732B2B1E4B7EC5B2F6AAECF8C6B604E43E278D20055B2F7E354F1BC231A00FBA971899CA1DDC7" +
      "F40A348D74E23467581F442B995F3EF009A126111B6619F58978D3354435F58DE0D793D63673513ADBDACADAF981F3C18446537CE3012E6693C465C06846B8EA" +
      "44F0C821692769A7CC5D19086BA268908944ABD00641D894FFE8E4191493ACC87315B6EA4BAF0CBC1BE5B98CDF712321F025C27103D4C599FCBDC9561A846E6A" +
      "3FFEB373BD075750096D0CC1DE48517FE65BB77D62A23B73250476DE1276CBB1F60A82A7884B3F3F88CBCBA9C21D2DA8917C373B0F9F7E0B7E88CED12E641CA5" +
      "237FC701DAF5DEBCD63BAAAE6DF5EB017CC8881B2EDCF31D84791F326596FFE3368C68878426C04AAB634B20DE20EFBBD055CF215FA531A3E13D2A8A7D742A29" +
      "83A9FC1B73668D97D49036AC7BD927D8619F28195412D2EE179B503263372667769064D148D7CF86CD46DCB3D0C13E6BE8994DDAE1CE4CFD13259DAE7C590C5B" +
      "503A1E62AB84C7657F19D3A4DAC8ABE015574344A7153493AFB634BE46ED51F41E2329BB782807310246EDF666CDBE2FC3B059384197280787B0F640AD6757F5" +
      "76E588D42C2620C2E26F5F7221DC4FB009CA0982F4CE9D9B966BD198E73DB6E62DA6C2018C45C8090A1BB86820202FB208EB33306FDCEC831A110189D52D58B5" +
      "49EAC72CAAA8EBF1DD3F48545215455F2220B0C8750415DEB8DBC2B31644FD8D14274880281035BB447C2B97E75F1CB25158F31FEC29C40E2B2AAD526B3BF6B5" +
      "C847B7FFB684D4F5704BF2EB5C0E1EC6253B01C4B17EAB9E0F6384027FBAB6DC617FE39FD47BE738E8A9431515C95F613B39831D1FBF297BB443829F46FD8222" +
      "1EEC2ED02A4C67F56C95D1C05E700A75F3579B6FA51A5AB97895599610E4C1666992B5A80FBC27BFC2FE41F57A9C429E7B5C946B2D7C727BEB1679DC08EF9BE9" +
      "B195C5117AE36FC1E717615AF5FD464CC48B16305B17E0718818EFF181DFEB906504AC7F3261003DB3B1B5F24026A7D8AF8BD42C703E79FED5B1030CA051075E" +
      "006D64E2F0280419997BA93679A7224A909CC92C82155E82AD04DC2ECA485094BC04F0D244671E6994B666240F98807E6B3DF0AE26FF181C6F95A32A028DA7A6" +
      "4C52700405864E6A1778337C123274C449CC2C3CE2F51A452A22DA2746C97658866761BD5DCAED57A443CD97523523A9A5412BE1AFFFC0A8B41A7DEE7F6A8B4D" +
      "7A13F7DBB6E9A331B478A635B99CD107A4632D6DF952F2F25308095EB2C70CBA577679B59B7E650C4EFC9462B08A91DB4BAB5499C7066AD3AD1CCE9E4D31BF9E" +
      "9A81A0FE20E0B6F44726DF3713FA5814E2D6ECEB4DEED26C1A77433C4D957A066F2D9DB6B27FC1281DA66438CE7BC9510C9A79D6F89C5965601B25677C7CF272" +
      "082BA7F6F20F200CD50C016DE0BBC1E881A31AFA318BCC83D6A3519CA5A031CCAE301DB4A0C5485EE956ADBD8E8C051A96F86A0CE6C689BD8B5BC22CEE6BDCF7" +
      "6DCF7D53FBE63367FA0550EB21F76980900A73661EAE0D99E8C24D639EFA6922FCB6C478A3B1771023F700FAFA4813FEFFBEF1B6B046D4A6ED46C275BB0DDAC8" +
      "3E4FDEFE511868F66AEA2BEC33DA99CC03EA1848E395A15BADC822F12890900D1C3A887AD0A1B24DA06B1CEA154770970F792B685FE68E38EEBC0EA8323286D6" +
      "A5696F060AC6C5728C973C7B5D545D4253A45B4B9F3C1B2879ECB761152CAB2F489D8EB160A4EEAEF055C61750852C6CA4C416F81BD75C9AEAB1BD821A2A17E2" +
      "283BF82735CF23A1F8DE5D261FD86FCAE37F7F1A75B40DFBFA9957AA998AAD1DA74714C43E24E2CF5CBB9AC30191150DA9AE1C21C0765FFFA2357B9983ABF62C" +
      "C5B55FFBF28049FE2A6A96018BE0D87F233A30F85022D4961FBB827A6E30DF2F8B95E78E55BA49E52EEA34AD34E1EFBC6A1D6740DED118711D1B49DD66254760" +
      "414E88EC70AEF2E2A57475A55E3C4AFDBEF616065C56AD779B1ED437AC1FE24DDECF4E315DCFD005325B184426CB8D768AD9F80171F4E1C2DDD7E2612AF09091" +
      "DBA05B15042F0D3BF93B8B10C7EED6E72C36DB91CF7CE2A8BC299594E5C6A66263187DF6DAABDF98809B29276D5838563A86E0BD27E15E1D083481E30425F378" +
      "0AEECDAFFB7DA979391B6917C8E5236E1A1327E018397FEBF83980869AE063DD28F0E2DFCEA282B55A38AB273F2C1DF7FA1463E75AF2D5F0CAD40C71C90A2320" +
      "58AEFF8FE6972D734605A35EF1F4006245D5BC5694BB33D5C1BD0C4C1E7799CF02281BE328A8B470AA21C572CBD18D036C543031C8AB6DF70AF37E3DAF15E039" +
      "EB60E1BDD5960B3D9E457264362F3D5AD0E21195303272E6933C3D73A3DD46F5E1672A37BBD23545629B77C3AADCE396FEC94A5546DCD58681786850A8F1FF09" +
      "98314A3C0257C0FAD63A80CCF68F6E6E6D49082C35AAED267A31B978526EE3B53373E2202CA37E8022AA3D284EA863D94FE65171A4D1B4BE3EDD5B2CE36AECDD" +
      "35F720A3ACA7F157FA09D51DACBDA152DDCF0D81521C6D3D35A8B463FE57C85E89EFCF064E500800785B2531B2702A5055DF5FE852EE9F377602C683623ED731" +
      "8AFA45E60B31341CDE1F97FCAD803C8B309A0D52ADA46DEE93ECA01998CB243FFAE2689DC2C9434B9CA021C69AEF4C5A281793056DB7FE2412E30546464221FC" +
      "FAF075778A526EBFCFA46658F480C910DA47B5DE2845CA23BEE2468FE374FC1655D90E194B792356BCFC04309B81C71B714D67F9F0388D001345F8C92823DF95" +
      "468A5B38A31F1879E9922FECCCEB6717E8768779372A91E90B534180989CF01921E45F36CB84DA005C8718A2564CB2A3978D502A0145C076B6E5EB189C0DD35B" +
      "0EB9EDC3963A694C7690029D283925AC2F6DF89743F3DAC1C6D2781255CA80D4E6E704BC5115DB8C5CB03CE959D8800BC4DB46B794668FBDA24C5DF5666BAE39" +
      "789595B8793D98EE2E2D66D3AD7E9AF3D446413952F51F03176C6AF3C1E34165518A6D993EF2886117049A76AB14D8CE5CCC36E0722F0B4580CA8A2CD200A00A" +
      "9F3531B0CF4A111EC31802DA9DB46C30BCE35DB6767EB899FA50D035F050B958B9695CA1D04A4D70015CCF0602564507821EC9DBE3C58ED479AE92A420FA0660" +
      "D6A8A0A46A124C6B154F959DEEDE5C6A73878B2D558DDBE4CFA08F82996D0437938010B06DE929DBA44531D8A2D5C289EDE2EBD7F21B738C2AEEB3C9D6C0A8EF" +
      "6D86F9558CC0963746FFFDB5FF8175C4659029AA70B316E51DEF01BB36340B6295945F9E323FA65D01A6B092A56735FC0203AD27DEBDBD5D54C24CB10316ED9F" +
      "5EB5D7A0A9C814FC63A7F256BB39AE0BC31798B42EDCB1AD95B6B59BBEE52E2D39169D12471986E531CD1D8B84E97C4C9BBA005A213FC845C06DAD61ADFE33C5" +
      "FC6F81237560C56DAEB9A41011F320BBCEA9F98F30B27586F940B52661B95A487A9EAB3BB45DA7A23B8D9F9653F397AF5C893A203A89B2295D62C2F6A649E3FD" +
      "E71BDFBC82B267D485DB32D75AE77E1D21C770F08CBAEC6A110650861F1B533C28DFBE16140E900DAA33FE17A898A0D8619119EBE24645718BF90324AAB62ACE" +
      "17FE93E61F049D166E66E48FD0EDD74B1F85E46FFE30D655E479B146CC5568581E582783E6609BC56773C8AB46CAE0997E53C1F7CD09A56CF0BAB87124D98EBA" +
      "6CF89BB50B334A3D150A5464CA71A8C97459E73C84CB7CAB58852C2526D890B025783BEDD2150EC2EEDDB6BAEA8CFDCDC134FF189CE2B3AD9B9C0BE5E7282F2D" +
      "BAC347AD0B3101F47E3DCF0CDD1A304D268C52D5C23A5FA8C9A21E69EC7A9D193EB3C159827A7F016F9ED9ED48F4FB8161A5169A8F61B9A711D0D4675E2EF905" +
      "28B0488C662045129C7F44F3383028FC628BC77F03874741771C4B71C8EF9CDEAFAADB911D5EB2C8D955501D1E7C7E0B10C32D0CCA826B9734A2A26B506EF37A" +
      "40C3165978967B4E8FCA1E7EF904F1DD939EC3F25A787B47EDD6CFBCB01A85EEB1CFE55E3F44E727D59B15EF66393CCC5F5F7290EBB6716F53AF5AF5DC517C7C" +
      "2914DDB1E45E5555014B4950A0E73E64CB8ED633CC17BCC96958C3E152215409CE821B4E05A6D0F5FDF8E6F254234D827B62BD1697C28BC905A0C44CAF3A596C" +
      "95AD5F9D764708274D4CEA035FFDE35E7D2B7B0F97C9B93F54417C1C107757150E5DCA249368C4413015C8686D07DCDA6F236075A5F913313C5A8CADDA63457F" +
      "C7A05199246E00FE14A5E6D2F65B74657CD7CCA18860E84B456967B07DC864DAB98888C6DA0FEB7FFF9A99462C55959E9A77D2B37D41B62054A52363C4540C02" +
      "E021139B5E433C78C4390B7E0E2CA69A6C7A4D5F37F10ACBE043512F77AB482866E0A52E6B3953A0C6F26CB62F4B0B68AB23D5554DE4B3");

  const KAT821_PK = OpCodes.Hex8ToBytes(
      "5C613A66185D153995ED00F800682F17CB11D38146A07081BCEB403B42DE8BEA93AF382E8402E7B68A9DD46A1A208A0579F650A589452B78890D0E0BE79929E8" +
      "6F97B307C7984924FC70F4715BDF5AC5C2D2291F565BC5D1EFB2FC6E956093186491714CCA6FD5F403E6B27488207A4BA7F72EB3C000CE0757084FC63325056E" +
      "D60F5A338285687A830B9403DB3219DFE27C627808DE7CA2ECDF62645CFA0922225A61A3E0D56DF346C052F9339A562F8AD1AAFDBA3B814A22A09407061AA923" +
      "410F2ADE2CCCB3A6D2246F57A9B3451E7E5E1AFAE22A15E1E114FD0AA4EEEADA1292CAC8EC99E53722D92FFCE5A7D611CD5F4175644BD80248B8D7EB8C4FB97C" +
      "BB4431C03C5CB01B7F3CCACE17B8407182487662558F36A5462AC7B164277925EDE918FF5AD787D6FDF4183CAB33EE354E615AABA00C87D3ADE9CA264AB0F1CE" +
      "37D0573E67259962ADD977610BD51714E350F14159BA34E52BC01B2530EB6CD419CF00ABA5C0217D705641537B17D19A0FEE2731B6068741E0672D1624259184" +
      "DBF1D2150572C838327A5B2F85508971C559F679DB62B2D13D8EB0EE589EB19D528E01421C0304D2847E8D6609F43D0455405ACDAF6F979B4A991E2BB0E15E45" +
      "A269866861BE50238057F0B2F4F7E2C09AD437D638DD0343B0BD0B8D3D03F8DE3F0617C023604603106C2BE14DE726231B1C64EC45E6DC21AC1526359888CD4D" +
      "559FE4327748018230D03668446FC4ABFB70801122D408AEEAE4D0282051609B987DFE0D5BF1481B85F472D746BA01D6AAF53D9019B127BCE150AB941B65FADB" +
      "F21F3A752869FA813D631B2BD9DEE1F2A3875866CC8D5694878C66FACD5D993F381C3808809E992FA023C0F3F142D5DDE99DCE345353A019CE498597EF665AB4" +
      "0019841BBC1AEBAC15E4AA6D70F21CEA5ED5C5E890828DAED4BF30B94B5C69CDF9CECFB69EC59C03F3FFE57EF90570879ACE4C412113F5E1DCDA9D7859BB28A0" +
      "92FBB70358D9861B14F962920280177E5F341464510FEF36DEE8A8B61A7F94512C7C1652ECEED0F8C960A2B59C025C21894EB26362C9678D1672E7F4A67E12D6" +
      "9AEDCB4CD8736862B7BDB8D25863C5BF7CB37167116BF780CF76778920BF09349B66FF1B4A62BA472B8E382BE85C45B568B432A78DD7E69CE28A9B3C455B1030" +
      "311F92D6AD5F03D0CF06B31CE620262B3E5D3636D5A4607CF0FEC5D0024C296386D7F424E40C0C45B5E7F33089430212998864BBF3F448F9A6994EFFE90AC5A4" +
      "A2D339F1700AFC67B96127BDC1CB8FF00D91B80108DC9EFAA684164E5BA85E14A07765282903554D582889EAB6190A6DE5072ABC23A6A72211D1335E14B7DE77" +
      "E3A7BF339BA38403A85889ABAC506BEF51B572F84AC1F1DB1BBED01A98AD4660A187EE109642A2763619BF74B0A477CD109CEA74AAD6B083DFB6181C36101433" +
      "8E4791E837C94C343C941910F414C1DC3613AE440108EC23E4569CE8DE573CD8C1880753F88D7E488566A3C16F0FF85C70704AA52B410E1D8AF8694BB746EBC2" +
      "5D3D0B18EF567CCC4E1A5764D96EAF3F34396AEA73C30857685F54B1D916DE38E01104ADE118D9683777D89B5300E41292CB5A67ED64F3A9A82854435AB0C36F" +
      "10A82B5552EF1D0EF9312CC24476E4B88A892DBEDC7A5402996C922826CD88E4C5D3C9A08A1AF233AA559E934DA68E6FC16036C8A17267B695FDE343F4C894C0" +
      "5BBBFEC05928AF9C3A4D7E83CD13");

  const KAT821_SK = OpCodes.Hex8ToBytes(
      "D067D98F0055E2C3DEEF1076BBB755AFD065112C85C46E6C350655D9625073E94E4528C053E720206CDB780A61AD5120C498A4CD3E60C334D8702F0F79D81418" +
      "AF959CAB7722EBDD30DF0A479E1403D337AD923E5DBCED4EE04839020F7751C075A4892AABBB0E001ABA95515E1B65C63C503D97E51EAFB9AC930F5A1DBCB7E9" +
      "388B5EF1E75E893E1B5E49955E7E3E4B3819DBA9EA9D23B0986F0DA2ADDFF0A310595267560829BCAC325D3E5CD1755D2BAFBA02D35C4E426A93BDAF184CB66F" +
      "78E28F5C7C8CA66B877B5D06DBAFA485597366B214EBD08581A8219FE93DB6A3679598B561007E58B07F13B53ACBAC3F1A42AAD8828766B8B9B43AA84EC6AD1D" +
      "66293F8822767B2AC7D9A1D8B471590B5B253045BB5C622112A0F2C0C5DB11BF749C82BC86B93F92DF3167066C9D7B0FCCB9CDD45336DD74669A6551D2059228" +
      "E2B0DB8174756099B25FD41D5BEB342E1D3A2E5566ACEDAF9F6CF9827789438FC8C2B98C6C06EF888DBF016773BD340BB6CF89673F07F93F89DFC853C2402739" +
      "B7291E8CD765D76324DD1A1BE1761561B29E91EDA39C49E18B382C3AC0830618F5550B6EC719F70D510F8749D2518C2711D44925AA5CEE7DAF64A3411C00489E" +
      "D5A5DDC1E3F46964B5E257417FEA5C68F15651D66604C4A3C376B7D73DC7AC10104CCAA6949AC3546C140FCD398066C2EBDE9B467557CA00C125D30FFCF2B378" +
      "872B0B8C064B1917E179DC13E000714B3E8058F5F3A2F582C50A783D3CF3F3A3F8564A19E75CDA2A1F62C4ACFDF34AFE021EA2D4243A0737B712A8C1ED04558F" +
      "B400A6BA1D0206BC72EAD95259C66CD2DCE5683BC7CDBCF92588BEF64499A8EDE1E6F6C86C97388A20AD2FF7136A135A895AF18E27D2DE5823D3C5A17415282C" +
      "6B1BDD59C4C4D94D94D521AF151AC70C0854FA3C18079F30F925967EE00325FCD6629AD35F0FC5E15AE7B1E43C38070987EAD6287921992E7065A170B30E1AD7" +
      "794E7E8660E2F9C6108A53E17743EB278876C920F23D9BE6FEA0CDA7DA05881565059829A84FC0F233554861130888595CC050FBEEB7E7189F02385A81454F9D" +
      "EFF0A89B13CCABF2970CD395DD0DEDC8C3332AD17B6CFF2C1E2BA867E4743947AE90EB89B72D9A3F5E1AB12A9755CD3B575C7E5A1524608762A788D923DE233E" +
      "8110E584C2D450308ADA06CCA1B6D56A222AE93ED601DAA429D12C11EAE0DAAEEE36B8C7D972C229BD59988726CA90BFF09D995B42F01A69FCD4BA10FBEF43C1" +
      "C874B493E83B904ECC50657F6BE4B554A5331CEE26EA9F33D2A37A8312D229EA5CA55CAFCD1BC6F49E15C1C05591AE746B22F07C9D33A8B79A9D7E0B32BE800B" +
      "02CCCB2BD80686560AA396F879B150A5784F892052864BA9CFF1414A03A0BEA2DCF1125A3441F0A62599911064FC31EC6449B1F1730BF3378049B9A70EFFE49D" +
      "9573B89D7144ADB6FD6586318081BB6EAD9F20D6210026AE5F8C1E4E6DFBF334650964CD62B3DC73A179D9FEEB39767377D7664C76B568C7F85A0BBE65AAB61F" +
      "2C20726D433296048EBE64AB0496CADF3847E10B91329534234D8E7B8F2868647369CDF0FF5707BED8EDB58F25DD68159FC8A0162A85BBEA35312351E508631F" +
      "BD70F158ACE9DEC73A5ABE2A0472C819152CF7CFA16D7B7A43489A5E48A4C2A1793B61FA5C3C9F02D072DE4EED0CB3FE789BAEFA401004646B1B9C9D5C63CF2C" +
      "E7AB91C3C69C1D97E81E6B2B14120335DB22045697D7BB7F1E6765AF8FD7E5D8ABCBD6598E7B1B3FEC7970E200F62267A162E9DA909CAE1A93E88EBB82B7378C" +
      "3306A9DDEF07FF137DCACF4B6B0912B65B43711F27EEBFE2C560069BA05A0C48D06EFDAAEEAB06309C125A051BD796AAA0EC756CEC8A2E41AA5A4EE36856EEB4" +
      "83C1BD91CA5304C6A1626B54C4AD4942269DBBC1E82BD3C16831B8FBB4E8449245C076082904D756BF195ACBD7C2309796D9458693AB541E204595C4CB0B1392" +
      "A851CD7183DF5C0256C0599C1891453E3A95E77B8D9A5B2DFC0B3FF438BA0CEF61CF97C29B99E16D6BCDDAE81F4E4C0555F81012E1823F36A0D85C0B7D80112E" +
      "949956162F9755EC809026CF9BDC1AA391108D05C043174B7A1050E08D41BE4DD86C22ED4A8E5AF78D2C8B5F0C2A35FF442BF22A9195631B713D3135800AF23A" +
      "4E298F955D2D0A629A75803A21EFAE699D2919753F189832A45D71665F71BAC96F48528D97E70EE5794493F010D3504F5BD329DB165A");

  const KAT821_CT = OpCodes.Hex8ToBytes(
      "C31A29034AEEF0469718549DFF4F838023A19ABA55BFB249B4059D37F879219B0A22F17DAB3FF16BA05B3DFD44E9FD43118A41D4317EA35407AAE247E31E90CD" +
      "9E96BC1179C337E45C343DC7C783DF7C330F832988F0DFCA9233E2842A45DBFBADF2F6BE8B4CCFC2E5AFB1BABCC22A7808E5D66167E63410C3127C0869A9969E" +
      "5C1094ACCBFD2F6FFFEDE2517187F73A6A63B39A9E09A1778E2CF16292465DA1FFDE8EEA45BF9961C48CEB3EF3703C546960549FF197A04B59C8A2521C22A171" +
      "E8B214C697484383939A3E4DCF5452E7E4179022DB5246344C19FFDD2523F8B3AACDB341A3D08AECB3AA42D44655B4F8B0DEB88839EEE386B52DB3A635191455" +
      "F928EAE7535B45B5D13539B5FF0331D09FE0D5FD0C455369B3869212D5D59E1794F680DE7DC80426B396579E706E35501222AE1F141DD8EFE7C9F4791225A438" +
      "62AF0C42067F69C5B668A69CFCC27BA36AC227D5C4A5FC7C873FBABB604B27145A56D0FD0741B19E930416B2AB1F213D7B0944CA8BEAA861445ABCF59B217F30" +
      "9F6DA8A2E39C583F0EE2AE018C81B9379EED51AC0B9AD627B3870E5F8981A2A0F06D153D23A03257F69A42C3650F8CCBC0A1083D37A02413FDF36435A1FAE0E4" +
      "8B6ED00330D02106119A830A9C0E0DF76B0B96C187B17243BE11E35A2C847F6FF3F6D8537D42CB63E6E6F89B262B7E7B9246A49A334622E65EC8B77870AA3440" +
      "EAC77058BD1373D12AEC34348A12E74E657FEB5921F1967EB15548FF3CB97DF8DDC735BD20D99F930DE962173B4ED05CF03FDF53BD3CE72E7A1B2A0CE2F71C64" +
      "502CD530C509CE1642044E1B4F3DC4BC79E9CB818C93E68035872E7C2A95A5C50CDB84397540CEB74EF4171A1FB9C775113B68F8E41ACC11B63FCF9D5A95CF84" +
      "0FF53F3440AA4E7F064544DE4528F034A828877B2A11CC5BB3DA6ECD100EAD0D839CF8B37904EEBD7DB2F9BDB913BF3A351CAEA601330DDF97F9EDE498FA5CC2" +
      "B109699E43A9C98699A187DB24A595537EB22BA89B58E08624D7419A06F23CA5AF5997EEE495C2BF3DEADA613F60FC3B9C342250541BB00B19B96A6A65EC1A0D" +
      "D4DDCED734AE0E7FD1244EA14EFDC150BF3B55C0D5F2596469C575CCE35BF9872B0D14DD2296BA76915F6DA5D341D8A3B808D346A07D6FBEA5DB0C0CB0332DD5" +
      "240DC0105680EC3C80A1E8E7275337BDFA3203CCC386C93D9C5127132933993FCB2D50F16DC0302BC55E8B72E06C914264299020C25351F5E07CE4E726E94D96" +
      "347AF8F04A5E59E266246E8D9CB22D7C6B8C42259DACECF10CF75851FB5909B7BFB444C26AC801E9C1743D514ABBE73B69298D8F4DED587627A44471270AFC43" +
      "E5791F71D699AE36C898FEF4686F940C0C63364A040840D8022DC0A53EA4F24602CC360E724A9F08F7C7614D1BD91208C789E199B3EEFABD1AC407F2478892F1" +
      "20288AA00C9825B106AA4940C4463745FB0F7399B570DBFD75AAFDA2217C9B529F327DBBC4F7923B17ACEE60DFB8105C46C9309EA18C847F25D3256726C411A0" +
      "E173E70F79C04C6FAD60F1E3C152CE7DA900D9044BC4E97FD2FC83EE2EB059416F5BBD6B242AE89AFF3A48D49ACC397AD3083C758E1EDED79FE8EF4FDE6F208B" +
      "1C6E9614BDA68063D8C7C95842D8A10E4538876E2053037106AF38FFB12F0AC966643063A0F1674C57209933FD61FDD25FA2CC5E9F7D662412D998E0788CDF87" +
      "ED76F115D8F545247DC82741EEB6");

  const KAT821_SS = OpCodes.Hex8ToBytes("293992000DC288E8152F9451F06DD835C75EA008662BACE0FB97A97B3AFB54E4");

  const VECTORS = [
    {
      text: "NTRU PQCkemKAT_935.rsp record 0: expanded seed to public key (ntruhps2048509)",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      keyGeneration: true,
      parameterSet: 'ntruhps2048509',
      keyGenerationOutput: 'publicKey',
      input: KAT509_KEYSEED,
      expected: KAT509_PK
    },
    {
      text: "NTRU PQCkemKAT_935.rsp record 0: expanded seed and rejection key to secret key",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      keyGeneration: true,
      parameterSet: 'ntruhps2048509',
      keyGenerationOutput: 'privateKey',
      rejectionKey: KAT509_REJECTIONKEY,
      input: KAT509_KEYSEED,
      expected: KAT509_SK
    },
    {
      text: "NTRU PQCkemKAT_935.rsp record 0: encapsulation ciphertext",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      publicKey: KAT509_PK,
      encapsulationOutput: 'ciphertext',
      input: KAT509_MSGSEED,
      expected: KAT509_CT
    },
    {
      text: "NTRU PQCkemKAT_935.rsp record 0: encapsulated shared secret",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      publicKey: KAT509_PK,
      encapsulationOutput: 'sharedSecret',
      input: KAT509_MSGSEED,
      expected: KAT509_SS
    },
    {
      text: "NTRU PQCkemKAT_935.rsp record 0: decapsulation recovers the shared secret",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      inverse: true,
      privateKey: KAT509_SK,
      input: KAT509_CT,
      expected: KAT509_SS
    },
    {
      // Setting sharedSecret turns the result into a verdict, so that the
      // rejection cases below can assert a mismatch without naming the value
      // the rejection branch produces.
      text: "NTRU PQCkemKAT_935.rsp record 0: the recovered secret is the published one",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      inverse: true,
      privateKey: KAT509_SK,
      sharedSecret: KAT509_SS,
      input: KAT509_CT,
      expected: [1]
    },
    {
      // One byte of the ciphertext moved. NTRU answers a ciphertext it did not
      // produce with a secret derived from the rejection key instead of an
      // error, so the property to assert is that the published secret does not
      // come back.
      text: "NTRU PQCkemKAT_935.rsp record 0: a modified ciphertext must not decapsulate to the published secret",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      inverse: true,
      privateKey: KAT509_SK,
      sharedSecret: KAT509_SS,
      input: KAT509_CT_CORRUPTED,
      expected: [0]
    },
    {
      text: "NTRU PQCkemKAT_935.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      inverse: true,
      privateKey: KAT509_SK_OTHER,
      sharedSecret: KAT509_SS,
      input: KAT509_CT,
      expected: [0]
    },
    {
      text: "NTRU PQCkemKAT_1234.rsp record 0: expanded seed to public key (ntruhps2048677)",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      keyGeneration: true,
      parameterSet: 'ntruhps2048677',
      keyGenerationOutput: 'publicKey',
      input: KAT677_KEYSEED,
      expected: KAT677_PK
    },
    {
      text: "NTRU PQCkemKAT_1234.rsp record 0: decapsulation recovers the shared secret (ntruhps2048677)",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      inverse: true,
      privateKey: KAT677_SK,
      input: KAT677_CT,
      expected: KAT677_SS
    },
    {
      text: "NTRU PQCkemKAT_1590.rsp record 0: expanded seed to public key (ntruhps4096821)",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      keyGeneration: true,
      parameterSet: 'ntruhps4096821',
      keyGenerationOutput: 'publicKey',
      input: KAT821_KEYSEED,
      expected: KAT821_PK
    },
    {
      text: "NTRU PQCkemKAT_1590.rsp record 0: decapsulation recovers the shared secret (ntruhps4096821)",
      uri: "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz",
      inverse: true,
      privateKey: KAT821_SK,
      input: KAT821_CT,
      expected: KAT821_SS
    }
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class NTRUCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "NTRU";
      this.description = "NTRU, the truncated polynomial ring lattice scheme, in the key encapsulation form submitted to round 3 of the NIST post-quantum process. Works over Z[x]/(x^n - 1): the public key is g/f for a short f and a fixed-weight g, and decapsulation recovers the message by multiplying by f and reducing modulo 3. The three NTRU-HPS parameter sets are implemented; NTRU-HRSS is not.";
      this.inventor = "Jeffrey Hoffstein, Jill Pipher, Joseph Silverman";
      this.year = 1996;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Post-Quantum Key Encapsulation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(509, 509, 0), // ntruhps2048509
        new KeySize(677, 677, 0), // ntruhps2048677
        new KeySize(821, 821, 0)  // ntruhps4096821
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("NTRU Round 3 Specification", "https://ntru.org/f/ntru-20190330.pdf"),
        new LinkItem("NTRU Original Paper", "https://www.ntru.com/resources/NTRUTech014.pdf"),
        new LinkItem("IEEE P1363.1 NTRU Standard", "https://standards.ieee.org/ieee/1363.1/3028/"),
        new LinkItem("Post-Quantum Cryptography", "https://en.wikipedia.org/wiki/Post-quantum_cryptography")
      ];

      this.references = [
        new LinkItem("NTRU Submission Package and Known Answer Tests", "https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz"),
        new LinkItem("NIST PQC Round 3 Submissions", "https://csrc.nist.gov/Projects/post-quantum-cryptography/post-quantum-cryptography-standardization/round-3-submissions"),
        new LinkItem("Schanck, Improving NTRU", "https://eprint.iacr.org/2018/1174")
      ];

      this.tests = VECTORS;
    }

    /**
     * Create new algorithm instance
     * @param {boolean} [isInverse=false] - true for decapsulation
     * @returns {object} New instance
     */
    CreateInstance(isInverse = false) {
      return new NTRUInstance(this, isInverse);
    }
  }

  /**
   * NTRU instance implementing the Feed/Result pattern.
   *
   * A key encapsulation mechanism has three operations rather than two, so the
   * one that runs is selected by which properties are present:
   *
   *   keyGeneration     Feed the expanded seed, Result is the public or the
   *                     secret key depending on keyGenerationOutput
   *   forward direction Feed the encapsulation seed, Result is the ciphertext
   *                     or the shared secret depending on encapsulationOutput
   *   inverse direction Feed the ciphertext, Result is the shared secret, or
   *                     [1] / [0] when sharedSecret says what to compare against
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class NTRUInstance extends IAlgorithmInstance {
    /**
     * @param {object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - decapsulation mode
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);

      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Declared here so that the test engine, which only assigns properties
      // that already exist on the instance, can set any of them from a vector.
      this._parameterSet = PARAMETER_SETS['ntruhps2048509'];
      this._publicKey = null;
      this._privateKey = null;
      this._sharedSecret = null;
      this._keyData = null;
      this.keyGeneration = false;
      this.keyGenerationOutput = 'publicKey';
      this.encapsulationOutput = 'ciphertext';
      this.rejectionKey = zeros(32);
    }

    // ---- configuration ----

    set parameterSet(label) {
      const found = findParameterSet(label);
      if (!found) throw new Error('Unknown NTRU parameter set: ' + label);
      this._parameterSet = found;
    }

    get parameterSet() {
      return this._parameterSet.name;
    }

    /**
     * The public key. Its length selects the parameter set, the encoded
     * lengths across the three sets being pairwise distinct.
     */
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }

      const found = parameterSetByLength(keyBytes.length, 'publicKeySize');
      if (!found)
        throw new Error('An NTRU public key is 699, 930 or 1230 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._publicKey = keyBytes.slice();
    }

    get publicKey() {
      return this._publicKey ? this._publicKey.slice() : null;
    }

    set privateKey(keyBytes) {
      if (!keyBytes) {
        this._privateKey = null;
        return;
      }

      const found = parameterSetByLength(keyBytes.length, 'privateKeySize');
      if (!found)
        throw new Error('An NTRU secret key is 935, 1234 or 1590 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._privateKey = keyBytes.slice();
    }

    get privateKey() {
      return this._privateKey ? this._privateKey.slice() : null;
    }

    /**
     * A shared secret to compare the decapsulated one against. Setting it makes
     * Result report agreement as [1] or [0] rather than returning the secret,
     * so that a vector can assert a rejection without naming the value the
     * rejection produces.
     */
    set sharedSecret(secretBytes) {
      this._sharedSecret = secretBytes ? secretBytes.slice() : null;
    }

    get sharedSecret() {
      return this._sharedSecret ? this._sharedSecret.slice() : null;
    }

    /**
     * The generic key entry point. Accepts a secret key, a public key, or the
     * name of a parameter set.
     */
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
        throw new Error('Invalid NTRU key data format');

      const bytes = Array.from(keyData);

      if (parameterSetByLength(bytes.length, 'privateKeySize')) {
        this.privateKey = bytes;
        return;
      }
      if (parameterSetByLength(bytes.length, 'publicKeySize')) {
        this.publicKey = bytes;
        return;
      }

      // Anything else is read as a parameter set label, which is how the older
      // interface selected the size.
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
          this.inputBuffer.push(OpCodes.AndN(data.charCodeAt(i), 0xFF));
        return;
      }

      if (typeof data === 'number') {
        this.inputBuffer.push(data);
        return;
      }

      appendAll(this.inputBuffer, data);
    }

    /**
     * Produce the key, the ciphertext, the shared secret, or the verdict.
     * @returns {number[]} the result bytes
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];

      if (this.keyGeneration) {
        const pair = kemKeypair(input, this.rejectionKey, this._parameterSet);
        if (!pair)
          throw new Error('NTRU key generation seed rejected: the sampled f is not invertible');
        return this.keyGenerationOutput === 'privateKey' ? pair.secretKey : pair.publicKey;
      }

      if (this.isInverse) {
        if (!this._privateKey)
          throw new Error('NTRU decapsulation needs a secret key');

        const recovered = kemDecapsulate(input, this._privateKey, this._parameterSet);
        if (!this._sharedSecret) return recovered;
        return [OpCodes.SecureCompare(recovered, this._sharedSecret) ? 1 : 0];
      }

      if (!this._publicKey)
        throw new Error('NTRU encapsulation needs a public key');

      const encapsulated = kemEncapsulate(this._publicKey, input, this._parameterSet);
      return this.encapsulationOutput === 'sharedSecret'
        ? encapsulated.sharedSecret
        : encapsulated.ciphertext;
    }

    // ---- convenience ----

    /**
     * Generate a key pair from an expanded seed.
     * @param {number[]} seed - keySeedSize bytes
     * @param {number[]} [prfKey] - 32 byte rejection key
     * @returns {object} { publicKey, secretKey }
     */
    GenerateKeyPair(seed, prfKey) {
      const pair = kemKeypair(Array.from(seed), prfKey ? Array.from(prfKey) : this.rejectionKey, this._parameterSet);
      if (!pair) throw new Error('NTRU key generation seed rejected: the sampled f is not invertible');

      this._publicKey = pair.publicKey;
      this._privateKey = pair.secretKey;
      return { publicKey: pair.publicKey.slice(), secretKey: pair.secretKey.slice() };
    }

    /**
     * Encapsulate to the configured public key.
     * @param {number[]} seed - messageSeedSize bytes
     * @returns {object} { ciphertext, sharedSecret }
     */
    Encapsulate(seed) {
      if (!this._publicKey) throw new Error('NTRU encapsulation needs a public key');
      return kemEncapsulate(this._publicKey, Array.from(seed), this._parameterSet);
    }

    /**
     * Decapsulate with the configured secret key.
     * @param {number[]} ciphertext - the ciphertext
     * @returns {number[]} the shared secret
     */
    Decapsulate(ciphertext) {
      if (!this._privateKey) throw new Error('NTRU decapsulation needs a secret key');
      return kemDecapsulate(Array.from(ciphertext), this._privateKey, this._parameterSet);
    }

    /** Wipe the key material held by this instance. */
    ClearData() {
      if (this._privateKey) OpCodes.ClearArray(this._privateKey);
      if (this._sharedSecret) OpCodes.ClearArray(this._sharedSecret);
      if (this.rejectionKey) OpCodes.ClearArray(this.rejectionKey);
      this._privateKey = null;
      this._publicKey = null;
      this._sharedSecret = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new NTRUCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    NTRUCipher, NTRUInstance, PARAMETER_SETS,
    rqMultiply, sqMultiply, s3Multiply, rqInverse, r2Inverse, s3Inverse,
    s3ToBytes, s3FromBytes, sqToBytes, sqFromBytes, rqSumZeroToBytes, rqSumZeroFromBytes,
    sampleFg, sampleRm, sampleFixedType, owcpaKeypair, owcpaEncrypt, owcpaDecrypt,
    kemKeypair, kemEncapsulate, kemDecapsulate
  };
}));
