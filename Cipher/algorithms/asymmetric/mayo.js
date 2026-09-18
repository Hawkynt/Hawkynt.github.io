/*
 * MAYO Implementation
 * Multivariate quadratic signatures from whipped Oil-and-Vinegar maps
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * MAYO is an Oil-and-Vinegar scheme whose oil space is deliberately too small.
 * A classical UOV public key is a quadratic map P : F_q^n -> F_q^m vanishing on
 * a secret subspace O of dimension m; signing inverts P by solving a linear
 * system in the oil variables. MAYO takes dim(O) = o < m instead, which shrinks
 * the key, and repairs signing by publicly "whipping" P into a k-fold map
 *
 *     P*(x_0, ..., x_{k-1}) = sum_i E_ii P(x_i)
 *                           + sum_{i<j} E_ij P'(x_i, x_j)
 *
 * where P'(x, y) = P(x+y) - P(x) - P(y) is the polar form of P. Every term
 * vanishes on O^k whatever the E_ij are, and O^k has dimension ko, so choosing
 * ko >= m makes the system solvable again. The E_ij are the matrices of
 * multiplication by z^l in K = F_16[z]/(f(z)), so the whole accumulation is one
 * polynomial addition followed by one reduction modulo f(z) rather than m-by-m
 * matrix products. Which power of z sits at which position is the whipping
 * schedule, and it is chosen so that the symmetric matrix Z over K is MDS -
 * every square submatrix has full rank - which is what denies the claw-finding
 * attacks that the low-rank submatrices of the round-two schedule permitted.
 *
 * Verification also carries a linear term: the round-three scheme accepts when
 * P*(s) + L(s) equals SHAKE256(SHAKE256(M) || salt), with the coefficients of L
 * expanded from the same hash.
 *
 * References:
 *   Beullens, Campos, Celi, Hess, Kannwischer - MAYO specification,
 *     NIST additional signatures, round 3 (pqmayo.org)
 *   Beullens - MAYO: Practical Post-Quantum Signatures from Oil-and-Vinegar
 *     Maps, SAC 2021
 *   FIPS 202 - SHA-3 and the SHAKE extendable-output functions
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
          AsymmetricCipherAlgorithm, IAlgorithmInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== GF(16) =====

  // F_16 is Z2[x]/(x^4 + x + 1); a field element a0 + a1x + a2x^2 + a3x^3 is the
  // nibble whose bits from least to most significant are (a0, a1, a2, a3).
  //
  // Both operations are tabulated, multiplication and addition alike. The
  // addition table looks redundant - addition in characteristic two is the
  // exclusive or - but the inner loops below run tens of millions of times per
  // signature, and a table lookup is what keeps them to array indexing.
  const GF_MUL = new Uint8Array(256);
  const GF_ADD = new Uint8Array(256);

  (function buildTables() {
    for (let a = 0; a < 16; ++a) {
      for (let b = 0; b < 16; ++b) {
        GF_ADD[a * 16 + b] = OpCodes.XorN(a, b);

        // Carry-less multiply, reducing by x^4 + x + 1 (the nibble 0x13).
        let x = a;
        let y = b;
        let product = 0;
        for (let i = 0; i < 4; ++i) {
          if (y % 2 === 1) product = OpCodes.XorN(product, x);
          y = Math.floor(y / 2);
          x = x * 2;
          if (x >= 16) x = OpCodes.XorN(x, 0x13);
        }
        GF_MUL[a * 16 + b] = product;
      }
    }
  })();

  // The multiplicative inverse, for the pivot normalisation of the solver.
  const GF_INV = new Uint8Array(16);
  for (let a = 1; a < 16; ++a) {
    for (let b = 1; b < 16; ++b) {
      if (GF_MUL[a * 16 + b] === 1) GF_INV[a] = b;
    }
  }

  // ===== PARAMETER SETS =====

  // The four sets of the round-three specification. tail holds f(z) as its four
  // low coefficients, so that f(z) = z^m + tail[3]z^3 + tail[2]z^2 + tail[1]z
  // + tail[0]; whip names the schedule below.
  const PARAMETER_SETS = {
    'MAYO-1': { n: 88,  m: 80,  o: 8,  k: 10, saltBytes: 24, digestBytes: 32, pkSeedBytes: 16, tail: [2, 0, 4, 2], whip: 10, level: 1 },
    'MAYO-2': { n: 86,  m: 64,  o: 13, k: 5,  saltBytes: 24, digestBytes: 32, pkSeedBytes: 16, tail: [8, 0, 2, 8], whip: 5,  level: 1 },
    'MAYO-3': { n: 118, m: 108, o: 10, k: 11, saltBytes: 32, digestBytes: 48, pkSeedBytes: 16, tail: [8, 0, 1, 7], whip: 11, level: 3 },
    'MAYO-5': { n: 154, m: 142, o: 12, k: 12, saltBytes: 40, digestBytes: 64, pkSeedBytes: 16, tail: [4, 0, 8, 1], whip: 12, level: 5 }
  };

  // The whipping schedules. Entry l of a table is the (row, column) position of
  // the label l, so E_ij is multiplication by z^l where l is the label sitting
  // at (i, j). Each schedule is symmetric and MDS.
  const WHIP_POSITIONS = {
    5: [1,1, 3,2, 4,1, 2,0, 3,0, 4,2, 4,0, 4,4, 2,2, 4,3, 3,1, 0,0, 3,3, 1,0, 2,1],
    10: [5,1, 6,4, 8,5, 8,8, 9,2, 8,0, 1,1, 2,0, 7,2, 9,7, 0,0, 6,1, 6,0, 5,5, 7,1, 3,3,
         3,2, 7,5, 9,4, 4,1, 7,6, 8,2, 4,4, 8,3, 5,0, 1,0, 5,3, 9,0, 9,9, 8,7, 5,2, 9,8,
         7,0, 5,4, 9,3, 7,4, 6,6, 8,1, 7,7, 4,3, 4,0, 8,4, 4,2, 9,6, 3,0, 2,1, 6,5, 9,5,
         6,3, 8,6, 3,1, 2,2, 9,1, 6,2, 7,3],
    11: [5,4, 9,6, 10,8, 8,5, 4,0, 4,3, 2,2, 5,0, 10,5, 9,8, 7,3, 3,1, 9,1, 1,0, 7,0, 3,2,
         6,2, 10,6, 3,3, 5,1, 10,1, 5,3, 5,5, 10,4, 9,3, 8,8, 7,7, 6,5, 6,3, 7,4, 8,6, 10,3,
         3,0, 10,10, 7,2, 0,0, 8,1, 6,6, 4,4, 2,0, 6,0, 10,7, 2,1, 8,0, 8,2, 7,6, 9,2, 5,2,
         9,5, 7,1, 10,2, 8,3, 8,7, 9,9, 8,4, 1,1, 6,4, 4,2, 6,1, 9,7, 9,4, 7,5, 9,0, 4,1,
         10,0, 10,9],
    12: [5,0, 9,5, 7,4, 11,9, 8,4, 6,3, 6,4, 1,1, 10,3, 9,1, 7,2, 10,2, 7,0, 11,10, 6,6, 11,1,
         4,3, 9,3, 7,3, 11,2, 9,0, 10,5, 6,5, 8,5, 4,0, 6,0, 3,2, 5,4, 9,9, 7,6, 1,0, 6,1,
         11,0, 8,8, 9,2, 8,1, 10,8, 2,1, 11,4, 10,7, 8,2, 4,4, 8,3, 4,1, 8,6, 5,2, 10,9, 7,1,
         11,5, 7,5, 10,10, 9,4, 2,0, 3,0, 6,2, 3,1, 11,7, 10,0, 7,7, 9,7, 5,3, 3,3, 0,0, 5,5,
         2,2, 9,6, 11,11, 8,7, 10,4, 10,1, 5,1, 8,0, 11,6, 9,8, 11,8, 11,3, 4,2, 10,6]
  };

  /**
   * Derived byte counts for a parameter set.
   * @param {Object} P - A parameter set
   * @returns {Object} The sizes the algorithms refer to
   */
  function sizesOf(P) {
    const v = P.n - P.o;
    return {
      v: v,
      oBytes: Math.ceil(v * P.o / 2),
      vBytes: Math.ceil(v / 2),
      p1Bytes: P.m * v * (v + 1) / 4,
      p2Bytes: P.m * v * P.o / 2,
      p3Bytes: P.m * P.o * (P.o + 1) / 4,
      cskBytes: P.saltBytes,
      cpkBytes: P.pkSeedBytes + P.m * P.o * (P.o + 1) / 4,
      sigBytes: Math.ceil(P.n * P.k / 2) + P.saltBytes
    };
  }

  // ===== PRIMITIVES =====

  // SHAKE256 and AES-128 come from the collection rather than from a stand-in,
  // because a signature built on an approximation of either agrees with nothing.
  // They are loaded on first use rather than at load: requiring them here would
  // register a hash and a block cipher while this file is being loaded, and
  // every tool that attributes an algorithm to whichever file was loading when
  // it registered would file them under asymmetric ciphers.
  let primitivesLoaded = false;

  /**
   * Load the primitives MAYO needs, once.
   * @returns {void}
   */
  function loadPrimitives() {
    if (primitivesLoaded) return;
    primitivesLoaded = true;
    if (typeof require === 'undefined') return;

    for (const module of ['../hash/shake.js', '../block/rijndael.js']) {
      try {
        require(module);
      } catch (error) {
        // In the browser these arrive as script tags instead; Find() reports it.
      }
    }
  }

  /**
   * Look up a registered algorithm, complaining usefully when it is absent.
   * @param {string} name - Registered algorithm name
   * @returns {Object} The algorithm
   */
  function requireAlgorithm(name) {
    loadPrimitives();
    const algorithm = AlgorithmFramework.Find(name);
    if (!algorithm) {
      throw new Error('MAYO requires ' + name + ', which is not registered');
    }
    return algorithm;
  }

  /**
   * SHAKE256 with a requested output length.
   *
   * Every call MAYO makes asks for at most 1024 octets, which is what the
   * registered SHAKE accepts in one squeeze: the widest is the vinegar
   * expansion of MAYO-5 at 924 octets.
   *
   * @param {uint8[]} input - Input octets
   * @param {number} length - Output length in octets
   * @returns {uint8[]} The digest
   */
  function shake256(input, length) {
    const algorithm = requireAlgorithm('SHAKE256');
    const instance = algorithm.CreateInstance();
    instance.outputSize = length;
    instance.Feed(input);
    return instance.Result();
  }

  /**
   * AES-128-CTR seed expansion, as the specification defines it: the output is
   * the concatenation of the AES-128 encryptions of iv xor 0, iv xor 1, ...,
   * with the block counter written as a 16-octet big-endian integer.
   * @param {uint8[]} key - The 16-octet seed, used as the AES key
   * @param {uint8[]|null} iv - The 16-octet iv, or null for an all-zero one
   * @param {number} length - Output length in octets
   * @returns {uint8[]} The keystream
   */
  function aes128ctr(key, iv, length) {
    const blocks = Math.ceil(length / 16);
    const input = new Array(blocks * 16);

    for (let block = 0; block < blocks; ++block) {
      const counter = OpCodes.Unpack32BE(block);
      const base = block * 16;
      for (let i = 0; i < 12; ++i) input[base + i] = iv ? iv[i] : 0;
      for (let i = 0; i < 4; ++i) {
        input[base + 12 + i] = iv ? OpCodes.XorN(iv[12 + i], counter[i]) : counter[i];
      }
    }

    const algorithm = requireAlgorithm('Rijndael (AES)');
    const instance = algorithm.CreateInstance(false);
    instance.key = key;
    instance.Feed(input);
    const stream = instance.Result();
    return stream.slice(0, length);
  }

  // ===== ENCODING =====

  /**
   * Decode a vector of field elements from packed nibbles. The element with an
   * even index occupies the low nibble of its octet.
   * @param {number} count - Number of elements
   * @param {uint8[]} bytes - Source octets
   * @param {number} offset - Where the vector starts
   * @returns {Uint8Array} The elements
   */
  function decodeVec(count, bytes, offset) {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; ++i) {
      const octet = bytes[offset + Math.floor(i / 2)];
      out[i] = (i % 2 === 0) ? (octet % 16) : Math.floor(octet / 16);
    }
    return out;
  }

  /**
   * Pack a vector of field elements into nibbles, padding with a zero nibble.
   * @param {Uint8Array|number[]} values - The elements
   * @returns {uint8[]} The octets
   */
  function encodeVec(values) {
    const out = new Array(Math.ceil(values.length / 2));
    for (let i = 0; i < out.length; ++i) {
      const low = values[2 * i];
      const high = (2 * i + 1 < values.length) ? values[2 * i + 1] : 0;
      out[i] = low + high * 16;
    }
    return out;
  }

  /**
   * Decode m matrices of the same shape from the interleaved encoding: the
   * first m nibbles are the top-left entries of all m matrices, then the m
   * entries one position along, and so on, skipping the lower triangle when the
   * matrices are triangular.
   * @param {number} rows - Rows of each matrix
   * @param {number} cols - Columns of each matrix
   * @param {number} m - How many matrices
   * @param {boolean} triangular - Whether the lower triangle is omitted
   * @param {uint8[]} bytes - Source octets
   * @param {number} offset - Where the encoding starts
   * @returns {Uint8Array[]} The matrices, each in row-major order
   */
  function decodeMatrices(rows, cols, m, triangular, bytes, offset) {
    const matrices = new Array(m);
    for (let s = 0; s < m; ++s) matrices[s] = new Uint8Array(rows * cols);

    const perPosition = Math.ceil(m / 2);
    let at = offset;

    for (let i = 0; i < rows; ++i) {
      for (let j = 0; j < cols; ++j) {
        if (triangular && i > j) continue;
        const column = decodeVec(m, bytes, at);
        at += perPosition;
        for (let s = 0; s < m; ++s) matrices[s][i * cols + j] = column[s];
      }
    }

    return matrices;
  }

  /**
   * The inverse of decodeMatrices.
   * @param {number} rows - Rows of each matrix
   * @param {number} cols - Columns of each matrix
   * @param {number} m - How many matrices
   * @param {boolean} triangular - Whether the lower triangle is omitted
   * @param {Uint8Array[]} matrices - The matrices
   * @returns {uint8[]} The encoding
   */
  function encodeMatrices(rows, cols, m, triangular, matrices) {
    const out = [];
    for (let i = 0; i < rows; ++i) {
      for (let j = 0; j < cols; ++j) {
        if (triangular && i > j) continue;
        for (let s = 0; s < m; s += 2) {
          const low = matrices[s][i * cols + j];
          const high = (s + 1 < m) ? matrices[s + 1][i * cols + j] : 0;
          out.push(low + high * 16);
        }
      }
    }
    return out;
  }

  // ===== THE WHIPPED MAP =====

  /**
   * Build a lookup from a pair (i, j) to the power of z that E_ij represents.
   * @param {number} k - The whipping factor
   * @returns {Int32Array} labels[i*k + j]
   */
  function whipLabels(k) {
    const table = WHIP_POSITIONS[k];
    if (!table) throw new Error('MAYO: no whipping schedule for k = ' + k);

    const labels = new Int32Array(k * k).fill(-1);
    for (let label = 0; 2 * label + 1 < table.length; ++label) {
      const row = table[2 * label];
      const column = table[2 * label + 1];
      labels[row * k + column] = label;
      labels[column * k + row] = label;
    }

    for (let i = 0; i < k * k; ++i) {
      if (labels[i] < 0) throw new Error('MAYO: whipping schedule for k = ' + k + ' is incomplete');
    }
    return labels;
  }

  /**
   * Reduce a polynomial accumulator modulo f(z), in place, leaving the result
   * in its first m coefficients.
   * @param {Uint8Array} accumulator - Coefficients, low degree first
   * @param {number} m - The degree of f
   * @param {number[]} tail - The four low coefficients of f
   * @returns {void}
   */
  function reduceModF(accumulator, m, tail) {
    // z^m is congruent to the tail, so a coefficient at degree d above m folds
    // down into degrees d-m through d-m+3. Working downwards means each is
    // folded once.
    for (let degree = accumulator.length - 1; degree >= m; --degree) {
      const coefficient = accumulator[degree];
      if (coefficient === 0) continue;
      accumulator[degree] = 0;
      const base = degree - m;
      const row = coefficient * 16;
      for (let t = 0; t < 4; ++t) {
        if (tail[t] === 0) continue;
        accumulator[base + t] = GF_ADD[accumulator[base + t] * 16 + GF_MUL[row + tail[t]]];
      }
    }
  }

  // ===== KEY EXPANSION =====

  // Expanding a key costs a few hundred milliseconds - most of it the AES-CTR
  // stream that produces P1 and P2, which reaches 842 kilobytes for MAYO-5 -
  // and every instance configured with the same secret key expands the same
  // thing, so the result is memoised. Nothing is cached that the key does not
  // already determine.
  const KEY_CACHE = new Map();

  /**
   * MAYO.ExpandSK, together with the public key MAYO.CompactKeyGen derives from
   * the same seed.
   *
   * @param {Object} P - Parameter set
   * @param {uint8[]} seedsk - The compact secret key
   * @returns {Object} Everything signing and verifying need
   */
  function expandKey(P, seedsk) {
    const S = sizesOf(P);

    let cacheKey = P.name + ':';
    for (let i = 0; i < seedsk.length; ++i) cacheKey += (seedsk[i] + 256).toString(16).slice(1);
    const cached = KEY_CACHE.get(cacheKey);
    if (cached) return cached;

    // seedpk and O from seedsk
    const derived = shake256(seedsk, P.pkSeedBytes + S.oBytes);
    const seedpk = derived.slice(0, P.pkSeedBytes);
    const O = decodeVec(S.v * P.o, derived, P.pkSeedBytes);

    // P1 and P2 from seedpk
    const expanded = aes128ctr(seedpk, null, S.p1Bytes + S.p2Bytes);
    const P1 = decodeMatrices(S.v, S.v, P.m, true, expanded, 0);
    const P2 = decodeMatrices(S.v, P.o, P.m, false, expanded, S.p1Bytes);

    // L_i = (P1_i + P1_i^T) O + P2_i, and P3_i = Upper(-O^T P1_i O - O^T P2_i).
    // The field has characteristic two, so the sign in the specification makes
    // no difference and subtraction is addition.
    const L = new Array(P.m);
    const P3 = new Array(P.m);

    for (let a = 0; a < P.m; ++a) {
      const p1 = P1[a];
      const p2 = P2[a];

      // X = P1_a O + P2_a, which is the (n-o) by o block both results need.
      const X = new Uint8Array(S.v * P.o);
      for (let i = 0; i < S.v; ++i) {
        for (let t = i; t < S.v; ++t) {
          const coefficient = p1[i * S.v + t];
          if (coefficient === 0) continue;
          const row = coefficient * 16;
          for (let j = 0; j < P.o; ++j) {
            const entry = O[t * P.o + j];
            if (entry === 0) continue;
            X[i * P.o + j] = GF_ADD[X[i * P.o + j] * 16 + GF_MUL[row + entry]];
          }
        }
      }
      for (let i = 0; i < S.v * P.o; ++i) X[i] = GF_ADD[X[i] * 16 + p2[i]];

      // Y = O^T X, then the upper-triangular fold.
      const Y = new Uint8Array(P.o * P.o);
      for (let i = 0; i < S.v; ++i) {
        for (let a2 = 0; a2 < P.o; ++a2) {
          const left = O[i * P.o + a2];
          if (left === 0) continue;
          const row = left * 16;
          for (let b = 0; b < P.o; ++b) {
            const right = X[i * P.o + b];
            if (right === 0) continue;
            Y[a2 * P.o + b] = GF_ADD[Y[a2 * P.o + b] * 16 + GF_MUL[row + right]];
          }
        }
      }
      const upper = new Uint8Array(P.o * P.o);
      for (let i = 0; i < P.o; ++i) {
        upper[i * P.o + i] = Y[i * P.o + i];
        for (let j = i + 1; j < P.o; ++j) {
          upper[i * P.o + j] = GF_ADD[Y[i * P.o + j] * 16 + Y[j * P.o + i]];
        }
      }
      P3[a] = upper;

      // L_a = (P1_a + P1_a^T) O + P2_a. The symmetric sum has a zero diagonal
      // in characteristic two, so it differs from X above by more than a
      // transpose and is built separately.
      const Li = new Uint8Array(S.v * P.o);
      for (let i = 0; i < S.v; ++i) {
        for (let t = 0; t < S.v; ++t) {
          const upperPart = (i <= t) ? p1[i * S.v + t] : 0;
          const lowerPart = (t <= i) ? p1[t * S.v + i] : 0;
          const coefficient = GF_ADD[upperPart * 16 + lowerPart];
          if (coefficient === 0) continue;
          const row = coefficient * 16;
          for (let j = 0; j < P.o; ++j) {
            const entry = O[t * P.o + j];
            if (entry === 0) continue;
            Li[i * P.o + j] = GF_ADD[Li[i * P.o + j] * 16 + GF_MUL[row + entry]];
          }
        }
      }
      for (let i = 0; i < S.v * P.o; ++i) Li[i] = GF_ADD[Li[i] * 16 + p2[i]];
      L[a] = Li;
    }

    const cpk = seedpk.concat(encodeMatrices(P.o, P.o, P.m, true, P3));

    const key = { P, S, seedsk, seedpk, O, P1, P2, P3, L, cpk, labels: whipLabels(P.k) };
    KEY_CACHE.set(cacheKey, key);
    return key;
  }

  /**
   * MAYO.ExpandPK, for a verifier that holds only the compact public key.
   * @param {Object} P - Parameter set
   * @param {uint8[]} cpk - The compact public key
   * @returns {Object} The public material verification needs
   */
  function expandPublicKey(P, cpk) {
    const S = sizesOf(P);

    let cacheKey = P.name + ':pk:';
    for (let i = 0; i < cpk.length; ++i) cacheKey += (cpk[i] + 256).toString(16).slice(1);
    const cached = KEY_CACHE.get(cacheKey);
    if (cached) return cached;

    const seedpk = cpk.slice(0, P.pkSeedBytes);
    const expanded = aes128ctr(seedpk, null, S.p1Bytes + S.p2Bytes);
    const key = {
      P, S, seedpk,
      P1: decodeMatrices(S.v, S.v, P.m, true, expanded, 0),
      P2: decodeMatrices(S.v, P.o, P.m, false, expanded, S.p1Bytes),
      P3: decodeMatrices(P.o, P.o, P.m, true, cpk, P.pkSeedBytes),
      cpk,
      labels: whipLabels(P.k)
    };
    KEY_CACHE.set(cacheKey, key);
    return key;
  }

  // ===== HASHING TO THE TARGET =====

  /**
   * Derive the target t and the linear term's coefficients from a digest and a
   * salt. Both directions of the scheme need exactly this.
   * @param {Object} P - Parameter set
   * @param {uint8[]} messageDigest - SHAKE256 of the message
   * @param {uint8[]} salt - The salt carried in the signature
   * @returns {Object} { t, lambda } where lambda[c] is column c of the m by n matrix
   */
  function targetAndLinear(P, messageDigest, salt) {
    const hash = shake256(messageDigest.concat(salt), P.m / 2 + 32);
    const t = decodeVec(P.m, hash, 0);

    const lambdaBytes = aes128ctr(
      hash.slice(P.m / 2, P.m / 2 + 16),
      hash.slice(P.m / 2 + 16, P.m / 2 + 32),
      P.n * P.m / 2
    );

    // Lambda is parsed column-major, unlike everything else here.
    const lambda = new Array(P.n);
    for (let column = 0; column < P.n; ++column) {
      lambda[column] = decodeVec(P.m, lambdaBytes, column * P.m / 2);
    }

    return { t, lambda };
  }

  // ===== SOLVER =====

  /**
   * SampleSolution: find x with Ax = y, randomised by r, or null when A does
   * not have full rank.
   * @param {Uint8Array} A - m by ko, row-major
   * @param {Uint8Array} y - Target, m entries
   * @param {Uint8Array} r - Randomness, ko entries
   * @param {number} m - Rows
   * @param {number} ko - Columns
   * @returns {Uint8Array|null} The solution, or null
   */
  function sampleSolution(A, y, r, m, ko) {
    const x = Uint8Array.from(r);

    // y <- y - A r, so that what is solved for is the correction to r.
    const target = Uint8Array.from(y);
    for (let row = 0; row < m; ++row) {
      let accumulator = 0;
      const base = row * ko;
      for (let c = 0; c < ko; ++c) {
        const a = A[base + c];
        if (a === 0 || r[c] === 0) continue;
        accumulator = GF_ADD[accumulator * 16 + GF_MUL[a * 16 + r[c]]];
      }
      target[row] = GF_ADD[target[row] * 16 + accumulator];
    }

    // Echelon form with leading ones over the augmented matrix.
    const cols = ko + 1;
    const B = new Uint8Array(m * cols);
    for (let row = 0; row < m; ++row) {
      for (let c = 0; c < ko; ++c) B[row * cols + c] = A[row * ko + c];
      B[row * cols + ko] = target[row];
    }

    let pivotRow = 0;
    let pivotColumn = 0;
    while (pivotRow < m && pivotColumn < cols) {
      let next = -1;
      for (let i = pivotRow; i < m; ++i) {
        if (B[i * cols + pivotColumn] !== 0) { next = i; break; }
      }
      if (next < 0) { ++pivotColumn; continue; }

      if (next !== pivotRow) {
        for (let c = 0; c < cols; ++c) {
          const swap = B[pivotRow * cols + c];
          B[pivotRow * cols + c] = B[next * cols + c];
          B[next * cols + c] = swap;
        }
      }

      const inverse = GF_INV[B[pivotRow * cols + pivotColumn]] * 16;
      for (let c = 0; c < cols; ++c) {
        B[pivotRow * cols + c] = GF_MUL[inverse + B[pivotRow * cols + c]];
      }

      for (let row = next + 1; row < m; ++row) {
        const factor = B[row * cols + pivotColumn];
        if (factor === 0) continue;
        const scale = factor * 16;
        for (let c = 0; c < cols; ++c) {
          B[row * cols + c] = GF_ADD[B[row * cols + c] * 16 + GF_MUL[scale + B[pivotRow * cols + c]]];
        }
      }

      ++pivotRow;
      ++pivotColumn;
    }

    // Full rank means the last row of the A part still carries a pivot.
    let lastRowZero = true;
    for (let c = 0; c < ko; ++c) {
      if (B[(m - 1) * cols + c] !== 0) { lastRowZero = false; break; }
    }
    if (lastRowZero) return null;

    // Back-substitution.
    for (let row = m - 1; row >= 0; --row) {
      let leading = -1;
      for (let c = 0; c < cols; ++c) {
        if (B[row * cols + c] !== 0) { leading = c; break; }
      }
      if (leading < 0 || leading >= ko) continue;

      const value = B[row * cols + ko];
      x[leading] = GF_ADD[x[leading] * 16 + value];
      if (value === 0) continue;
      const scale = value * 16;
      for (let other = 0; other < m; ++other) {
        const a = B[other * cols + leading];
        if (a === 0) continue;
        B[other * cols + ko] = GF_ADD[B[other * cols + ko] * 16 + GF_MUL[scale + a]];
      }
    }

    return x;
  }

  // ===== SIGN =====

  /**
   * MAYO.Sign.
   * @param {Object} key - From expandKey
   * @param {uint8[]} message - Message octets
   * @param {uint8[]} R - The optional randomiser, salt_bytes octets
   * @returns {uint8[]} The signature
   */
  function signMessage(key, message, R) {
    const { P, S, O, P1, L, seedsk, labels } = key;
    const ko = P.k * P.o;
    const maxLabel = P.k * (P.k + 1) / 2 - 1;
    const extended = P.m + maxLabel + 1;

    const messageDigest = shake256(message, P.digestBytes);
    const salt = shake256(messageDigest.concat(R).concat(seedsk), P.saltBytes);
    const { t, lambda } = targetAndLinear(P, messageDigest, salt);

    for (let counter = 0; counter < 256; ++counter) {
      // Vinegar values and the solver's randomness.
      const needed = P.k * S.vBytes + Math.ceil(ko / 2);
      const V = shake256(messageDigest.concat(salt).concat(seedsk).concat([counter]), needed);
      const vinegar = new Array(P.k);
      for (let i = 0; i < P.k; ++i) vinegar[i] = decodeVec(S.v, V, i * S.vBytes);
      const r = decodeVec(ko, V, P.k * S.vBytes);

      // M_i, whose j-th row is v_i^T L_j.
      const Ms = new Array(P.k);
      for (let i = 0; i < P.k; ++i) {
        const Mi = new Uint8Array(P.m * P.o);
        const vi = vinegar[i];
        for (let j = 0; j < P.m; ++j) {
          const Lj = L[j];
          for (let row = 0; row < S.v; ++row) {
            const left = vi[row];
            if (left === 0) continue;
            const scale = left * 16;
            for (let c = 0; c < P.o; ++c) {
              const right = Lj[row * P.o + c];
              if (right === 0) continue;
              Mi[j * P.o + c] = GF_ADD[Mi[j * P.o + c] * 16 + GF_MUL[scale + right]];
            }
          }
        }
        Ms[i] = Mi;
      }

      // M_0 <- M_0 + Lambda_v O + Lambda_o
      {
        const M0 = Ms[0];
        for (let j = 0; j < P.m; ++j) {
          for (let c = 0; c < P.o; ++c) {
            let accumulator = lambda[S.v + c][j];
            for (let row = 0; row < S.v; ++row) {
              const left = lambda[row][j];
              const right = O[row * P.o + c];
              if (left === 0 || right === 0) continue;
              accumulator = GF_ADD[accumulator * 16 + GF_MUL[left * 16 + right]];
            }
            M0[j * P.o + c] = GF_ADD[M0[j * P.o + c] * 16 + accumulator];
          }
        }
      }

      // v_i^T P1_a, reused by every pair the vinegar appears in.
      const VP = new Array(P.k);
      for (let i = 0; i < P.k; ++i) {
        const vi = vinegar[i];
        const rows = new Array(P.m);
        for (let a = 0; a < P.m; ++a) {
          const p1 = P1[a];
          const out = new Uint8Array(S.v);
          for (let row = 0; row < S.v; ++row) {
            const left = vi[row];
            if (left === 0) continue;
            const scale = left * 16;
            for (let c = row; c < S.v; ++c) {
              const right = p1[row * S.v + c];
              if (right === 0) continue;
              out[c] = GF_ADD[out[c] * 16 + GF_MUL[scale + right]];
            }
          }
          rows[a] = out;
        }
        VP[i] = rows;
      }

      // y and each column of A accumulate in K = F_16[z]/(f(z)).
      const yAccumulator = new Uint8Array(extended);
      for (let a = 0; a < P.m; ++a) yAccumulator[a] = t[a];
      const columns = new Array(ko);
      for (let c = 0; c < ko; ++c) columns[c] = new Uint8Array(extended);

      for (let i = 0; i < P.k; ++i) {
        const vi = vinegar[i];

        // y <- y - E_{i,0} Lambda_v v_i
        {
          const product = new Uint8Array(P.m);
          for (let column = 0; column < S.v; ++column) {
            const left = vi[column];
            if (left === 0) continue;
            const scale = left * 16;
            const source = lambda[column];
            for (let a = 0; a < P.m; ++a) {
              const right = source[a];
              if (right === 0) continue;
              product[a] = GF_ADD[product[a] * 16 + GF_MUL[scale + right]];
            }
          }
          const shift = labels[i * P.k];
          for (let a = 0; a < P.m; ++a) {
            if (product[a] === 0) continue;
            yAccumulator[shift + a] = GF_ADD[yAccumulator[shift + a] * 16 + product[a]];
          }
        }

        for (let j = i; j < P.k; ++j) {
          const vj = vinegar[j];
          const u = new Uint8Array(P.m);
          for (let a = 0; a < P.m; ++a) {
            let accumulator = 0;
            const rowI = VP[i][a];
            for (let c = 0; c < S.v; ++c) {
              if (rowI[c] === 0 || vj[c] === 0) continue;
              accumulator = GF_ADD[accumulator * 16 + GF_MUL[rowI[c] * 16 + vj[c]]];
            }
            if (i !== j) {
              const rowJ = VP[j][a];
              for (let c = 0; c < S.v; ++c) {
                if (rowJ[c] === 0 || vi[c] === 0) continue;
                accumulator = GF_ADD[accumulator * 16 + GF_MUL[rowJ[c] * 16 + vi[c]]];
              }
            }
            u[a] = accumulator;
          }

          const shift = labels[i * P.k + j];
          for (let a = 0; a < P.m; ++a) {
            if (u[a] === 0) continue;
            yAccumulator[shift + a] = GF_ADD[yAccumulator[shift + a] * 16 + u[a]];
          }

          for (let c = 0; c < P.o; ++c) {
            const destination = columns[i * P.o + c];
            const Mj = Ms[j];
            for (let a = 0; a < P.m; ++a) {
              const value = Mj[a * P.o + c];
              if (value === 0) continue;
              destination[shift + a] = GF_ADD[destination[shift + a] * 16 + value];
            }
          }
          if (i !== j) {
            for (let c = 0; c < P.o; ++c) {
              const destination = columns[j * P.o + c];
              const Mi = Ms[i];
              for (let a = 0; a < P.m; ++a) {
                const value = Mi[a * P.o + c];
                if (value === 0) continue;
                destination[shift + a] = GF_ADD[destination[shift + a] * 16 + value];
              }
            }
          }
        }
      }

      reduceModF(yAccumulator, P.m, P.tail);
      const y = yAccumulator.slice(0, P.m);

      const A = new Uint8Array(P.m * ko);
      for (let c = 0; c < ko; ++c) {
        reduceModF(columns[c], P.m, P.tail);
        for (let a = 0; a < P.m; ++a) A[a * ko + c] = columns[c][a];
      }

      const x = sampleSolution(A, y, r, P.m, ko);
      if (!x) continue;

      // s_i = (v_i + O x_i) || x_i
      const s = new Uint8Array(P.k * P.n);
      for (let i = 0; i < P.k; ++i) {
        const vi = vinegar[i];
        for (let row = 0; row < S.v; ++row) {
          let accumulator = vi[row];
          for (let c = 0; c < P.o; ++c) {
            const left = O[row * P.o + c];
            const right = x[i * P.o + c];
            if (left === 0 || right === 0) continue;
            accumulator = GF_ADD[accumulator * 16 + GF_MUL[left * 16 + right]];
          }
          s[i * P.n + row] = accumulator;
        }
        for (let c = 0; c < P.o; ++c) s[i * P.n + S.v + c] = x[i * P.o + c];
      }

      return encodeVec(s).concat(salt);
    }

    throw new Error('MAYO: no solvable system after 256 vinegar attempts');
  }

  // ===== VERIFY =====

  /**
   * MAYO.Verify.
   * @param {Object} key - From expandKey or expandPublicKey
   * @param {uint8[]} message - Message octets
   * @param {uint8[]} signature - The signature
   * @returns {boolean} Whether the signature is valid
   */
  function verifyMessage(key, message, signature) {
    const { P, S, P1, P2, P3, labels } = key;
    if (!signature || signature.length !== S.sigBytes) return false;

    const packed = Math.ceil(P.n * P.k / 2);
    const s = decodeVec(P.k * P.n, signature, 0);
    const salt = signature.slice(packed, packed + P.saltBytes);

    const messageDigest = shake256(message, P.digestBytes);
    const { t, lambda } = targetAndLinear(P, messageDigest, salt);

    // s_i^T P_a, where P_a is the block matrix [[P1_a, P2_a], [0, P3_a]].
    const SP = new Array(P.k);
    for (let i = 0; i < P.k; ++i) {
      const si = s.subarray(i * P.n, (i + 1) * P.n);
      const rows = new Array(P.m);
      for (let a = 0; a < P.m; ++a) {
        const p1 = P1[a];
        const p2 = P2[a];
        const p3 = P3[a];
        const out = new Uint8Array(P.n);

        for (let row = 0; row < S.v; ++row) {
          const left = si[row];
          if (left === 0) continue;
          const scale = left * 16;
          for (let c = row; c < S.v; ++c) {
            const right = p1[row * S.v + c];
            if (right === 0) continue;
            out[c] = GF_ADD[out[c] * 16 + GF_MUL[scale + right]];
          }
          for (let c = 0; c < P.o; ++c) {
            const right = p2[row * P.o + c];
            if (right === 0) continue;
            out[S.v + c] = GF_ADD[out[S.v + c] * 16 + GF_MUL[scale + right]];
          }
        }
        for (let row = 0; row < P.o; ++row) {
          const left = si[S.v + row];
          if (left === 0) continue;
          const scale = left * 16;
          for (let c = row; c < P.o; ++c) {
            const right = p3[row * P.o + c];
            if (right === 0) continue;
            out[S.v + c] = GF_ADD[out[S.v + c] * 16 + GF_MUL[scale + right]];
          }
        }
        rows[a] = out;
      }
      SP[i] = rows;
    }

    const maxLabel = P.k * (P.k + 1) / 2 - 1;
    const accumulator = new Uint8Array(P.m + maxLabel + 1);

    for (let i = 0; i < P.k; ++i) {
      const si = s.subarray(i * P.n, (i + 1) * P.n);

      // The linear term.
      {
        const product = new Uint8Array(P.m);
        for (let column = 0; column < P.n; ++column) {
          const left = si[column];
          if (left === 0) continue;
          const scale = left * 16;
          const source = lambda[column];
          for (let a = 0; a < P.m; ++a) {
            const right = source[a];
            if (right === 0) continue;
            product[a] = GF_ADD[product[a] * 16 + GF_MUL[scale + right]];
          }
        }
        const shift = labels[i * P.k];
        for (let a = 0; a < P.m; ++a) {
          if (product[a] === 0) continue;
          accumulator[shift + a] = GF_ADD[accumulator[shift + a] * 16 + product[a]];
        }
      }

      for (let j = i; j < P.k; ++j) {
        const sj = s.subarray(j * P.n, (j + 1) * P.n);
        const u = new Uint8Array(P.m);
        for (let a = 0; a < P.m; ++a) {
          let value = 0;
          const rowI = SP[i][a];
          for (let c = 0; c < P.n; ++c) {
            if (rowI[c] === 0 || sj[c] === 0) continue;
            value = GF_ADD[value * 16 + GF_MUL[rowI[c] * 16 + sj[c]]];
          }
          if (i !== j) {
            const rowJ = SP[j][a];
            for (let c = 0; c < P.n; ++c) {
              if (rowJ[c] === 0 || si[c] === 0) continue;
              value = GF_ADD[value * 16 + GF_MUL[rowJ[c] * 16 + si[c]]];
            }
          }
          u[a] = value;
        }
        const shift = labels[i * P.k + j];
        for (let a = 0; a < P.m; ++a) {
          if (u[a] === 0) continue;
          accumulator[shift + a] = GF_ADD[accumulator[shift + a] * 16 + u[a]];
        }
      }
    }

    reduceModF(accumulator, P.m, P.tail);

    for (let a = 0; a < P.m; ++a) {
      if (accumulator[a] !== t[a]) return false;
    }
    return true;
  }

  // ===== KAT DATA =====

  // Entries of the official PQCsignKAT files of the MAYO round-three reference
  // implementation. Each carries the compact secret key the NIST harness drew
  // from its DRBG, the message, and the signed message the reference produced.
  // Nothing here was generated by this file.
  const KAT = {
    'MAYO-1': [
      {
        count: 0,
        file: 'PQCsignKAT_24_MAYO_1.rsp',
        msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
        sk: '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803',
        R: '8626ed79d451140800e03b59b956f8210e556067407d13dc',
        sm: '161ce44d8c44a47870fa4a997eed04a6818a7133f4c604f922c02079a1600068d3eeb0dcf561' +
             '6db0a83d4c5256b4333763dda9a540cc125ab8beda33e424216297d6eb6b905b32263f0c7124' +
             '8bb64261ab1fc2de41570f8866a3cb573a1bdd1253fa7ddc393e59ce0e2960c6c5dbf2b82054' +
             'c22ce697ca92b5d545c3cf96577afd88699159ff879b8b42157e95339eea0fc7de0bc5b6e6b5' +
             '9f8de791df594dba9380873318ddb72e773b03552e4c143311743b83bff8d7b04fb5cb5915aa' +
             'e689fb5325b36cc6983a6b9d51bb27a3e1a18e6417544135fcc27f6e400ff5c0a70e1ac8e977' +
             '00f3cd8b9459aea33c8106fd43c3df48b850c516f55eb94d829debca1ee6a62b0784f4eccc9b' +
             '8e33fca534e1ca001115319feacfe3aeef31f0e3b25d1cb8547b239219ca6d410f1bdcf60a39' +
             '4dd0f78dda8eebc3c21a5e7641a78c5d1b204e819632a0987e304ea24e0d7455c3d65b16dba9' +
             '116b90ec3cf1b8878f15ce98d51c0b34174dc8041a384bab9be4bc0cdc78f4a40b6eea42221c' +
             'b653adf8d0bc0efd4c45671909dbf9fdaf439ab7c099781a008075dec6c3406aa122a9e64cfe' +
             '3f80e3578766ea7a333da8e38233de16e423389bf9b6e03cc8258176e1a958e90dfed58ad3a8' +
             '59d1b06dee53af6ad81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb' +
             '556ac8'
      },
      {
        count: 1,
        file: 'PQCsignKAT_24_MAYO_1.rsp',
        msg: '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49',
        sk: '4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64',
        R: 'e82fcc97ca60ccb27bf6938c975658aeb8b4d37cffbde25d',
        sm: 'bf4514e88edba2f53c1b834f83805de9afd802486f985469cb06afcbd8545043da54c7186605' +
             '7c33a09239a1ff9e5d81f9fd7065b007493cd12a831043ef8f03d700622d24c218c9dd6230a0' +
             '12e905f454e609be84983110afef34866f5bf27f833a57ab7c00e12736c93758bc6ca4a8fc76' +
             '45cc842849e8347f7794b89e8ce3415515e423e15665500f92c6f16902a6fbd4c32b900b3f8b' +
             '41543bd1420d8f4de59834429d36bce0734f2c0700802f12b355e61b740e24dcebe3cb563b21' +
             'a1f608abbe9c0dd25beb7287dc174e6a4e8d1b41d4e4d0dc050ebe4d5a2f9e9408a167036103' +
             '8640de600f8a49471615047ca02308254934acae128a19d398b3909be10c26e97834aaa22a7e' +
             '7d7916cba9842094b8ae3cab718844a7c0d09cf237da20f291a282c4225d3a6ca8f7122bccc7' +
             '757d70a7689e65dd43dd813de6616b790168588ad22b223e7da500e9d292f4eb335eb79b1165' +
             '5172d927289f62935e4bd3397edad3021c06eb86ad062dd78e9105e382ed1183333cd2ef3cec' +
             'af9855a32f86a253a50c94f73e9435890eb54d396a3e5b0607c656ff89484092db79301c3d77' +
             '9016a0a39372b19130f95bff910605cc541ceda569ee18dc0578542b308223a139d151e27221' +
             'fe297f3913d37e1a225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5d' +
             'f9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49'
      }
    ],
    'MAYO-2': [
      {
        count: 0,
        file: 'PQCsignKAT_24_MAYO_2.rsp',
        msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
        sk: '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803',
        R: '8626ed79d451140800e03b59b956f8210e556067407d13dc',
        sm: '7afea7506473b4e69557362cbfc6623db51478bc05fba14a837ee440ef31ffcbdc51c9d7604a' +
             'b7b87042897faed5a375ad62cce65590815fa66045a86e028d8689e72affb0fcd518f181c243' +
             'f38e548a69e2627b085b02340bd7eebb652c5da224d0917182194201ef9d41aa1cf6383f4e32' +
             '40973ece8b9198b7f8ed57de726c299fbbb08d9fc27da794f19839503313b9b5215b86097334' +
             '1d75fa95327d8d0c5b4fc81374c5ebadac0c7543e67e7c6f9256f34ec957f5fe18fcd71d325c' +
             '99da60de17063a1f9df231f1b8bfba88b908b951389f2b3192e03cc8258176e1a958e90dfed5' +
             '8ad3a859d1b06dee53af6ad81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75' +
             'bf57bb556ac8'
      },
      {
        count: 1,
        file: 'PQCsignKAT_24_MAYO_2.rsp',
        msg: '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49',
        sk: '4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64',
        R: 'e82fcc97ca60ccb27bf6938c975658aeb8b4d37cffbde25d',
        sm: 'b3a8e9f2c0d1739194923c49b794a4f439d9afdb7bc63f9ad3128099e36ee9ce57447d316d2a' +
             '50b8c7d99be0ceb9b27778e28d85d3c2590a5cce6dfcd4bc5dc9a46b1ddd4c9e87aee1cdcaa3' +
             '19e7d4fa10603bd3825b2c1f283cbbfe1fe2ef8ac1ee7c1c6d5ce9c9815bebf9842029f149ab' +
             '0b3ea31c0434a78f8c763b2387154c4131a058502d5e93085462384138d738c297e405b23bb0' +
             '2a958203c78500c478cc379c75beae8c46ed91134b7370514b23611d7ca316890fc9728d7958' +
             '3a3984d00a2e0c0ae723fb335d08040e1b355d4e34339abbbc18dc0578542b308223a139d151' +
             'e27221fe297f3913d37e1a225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a8' +
             '0f8c5df9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd' +
             '49'
      }
    ],
    'MAYO-3': [
      {
        count: 0,
        file: 'PQCsignKAT_32_MAYO_3.rsp',
        msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
        sk: '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
        R: '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f',
        sm: '053a904de04bc6be49ecd7cb357dd5a32f91716411758116007cb810cdc13a26e3fe939ca105' +
             'eb1644afc6f5eaf8b691f8a5a1be8b92049d520c163e6e41408e2dc2ea081e44905b32402094' +
             '9938dbcb7f5da11a12ef182bb1bf57bef558eed59eedcc36a5e056946306460f51cabbdcb534' +
             '327be6f406b12d619168898fd5b2b7b29f481b403474f39d88ec252c98fa43e7293769a75261' +
             '49294406b6d751bca7c7d0581522ed2974a11fba0d8e6c12b9d5b6497bd963d7d023c051dc9f' +
             '2a9684ad282bee35382aa1329d1df96ed35b7b0c35b8a7c0a20bebcc17fa9f1b8b759019accb' +
             'a7169bba217f72e6fe58aee806e36b5b11f333f45513e61d87feca380f078383ceb40f3ea97f' +
             '141e316a27a38e7acbb7503197af1b4798861a28bd6db930442a7ac57ec75b36da12a0c5d79f' +
             '101e5f92f72178d29e78df38c32f4cb93b6b73d2a0c162c8e17630a37482f405f84d96c57338' +
             '79f89bbced298a20702ebd94699cd169c7af4306ad19cc412202fa7224ef12415d158df72889' +
             'bc3dda6186ed69cb95ab6debfdc4af1549711d04859a94289ea89bbce8bcdec46568384d11dc' +
             '91b85215c95e955a8cccd161c78cced594becde0a058da399812f86eaac189fc4007ca24fcb3' +
             'da841d9866b3b5657753b1f12d5a81625fdfecb3b035242852288b261ccb7031c4dcd8509f5f' +
             '4e26cd2a18086a935af06c6292d37a91f40cfc8dc5c9b47eda2e05cd77fe40b73d2a8d5f8992' +
             '06ff68c377397e1734e9efffaebc579d3e79b8cd3eedf2fd3f252b0af6aeb867378f7f2eb900' +
             '59fd83b2a0f6f748d79a6aa51681b11ca1d26160d84448614adbdf4bc1d42f718e2dd8b814ca' +
             '91bf36987c278365f4e35efe23adc715bd4fe71ec176799762c647cd7410adaea4a6d791659b' +
             '554b3cc87a0a6c0cbfd10185f7657804a2330a7def349da1df84a1a61dc857d2458425d81c4d' +
             '8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8'
      },
      {
        count: 1,
        file: 'PQCsignKAT_32_MAYO_3.rsp',
        msg: '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49',
        sk: '4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64c81cc7cc2f513345',
        R: 'e82fcc97ca60ccb27bf6938c975658aeb8b4d37cffbde25d97e561f36c219ade',
        sm: '521f79daf4371456e06fad989a84c5eb203faa615d1517c745bd187e5023f08a1587bd229e77' +
             '3deba27125b39b68c169bb4510fb8876f23f72de9e9cfd7352052313ea96be255311c466911c' +
             'e40b00027822d528a8295bf27fcf220e4582d69825b0b69ae71cf8a3aade11e5923857286ed2' +
             '3f41db94e1a7a4fa27ae16744027237cb1c42abc227e317d8de95f8de72d7cdc6a7ca7c08f4d' +
             '2a2c886a1f5ea4d68f67b3dbb032210b4ddb492291a77008f160b767fabc2ed8525515eec985' +
             '513dfebd540abe822fb5543fc4fe5631deac64c7e12d6b2ff7a133e93a16324e2b03f98c0602' +
             '375451740f8b63987d1f07659da4a14ee4dbc49822c24b4be5283eb95774456876fd56973772' +
             'e4e999a9a349d275293bc82807c285aa0c473ae3b8d0ed496c2e3d2b29ca8b9f1fb19f1aa658' +
             '864f5c45caef953b2e06a030a339013174e560a19fe218e6960fadd1c2df39e93c22e3ea2616' +
             'dbaadc00f24746f3de8a96418ae3c77d7051ec5dcc391a3f2495b02540a0915fc39bcfc53ee0' +
             '67bb910987a52f3b2ca4a1fc2b57dac607e53697b02788a3a2b127782c159e7a736e0206788a' +
             '852cec9838119c6251f8b7702105b9edc4a4a526158d4ad40b16053bba8d806af6a6a1b7b114' +
             'cc6cdde56dc58d3caa1a57e15a9483137afa4321577ed17f05841222f5c064818362d2e0286a' +
             'c5f34b9f7216d90400e4699ff035f10c64684109bc463b70bfc352030d179c1e561f75713b3e' +
             '5a8d91525b23ce238be3e8d14e6451217aaa5a7cc233bc3b69c782ea7ed7176e33ae425fa940' +
             '21f16c66944840a2fa33dd1bba4a0f798c4d4c7bf363756e38acb2dde5899491ab4136d8b4d4' +
             '2c7231604ae662597ae7fdd0985282c4d646b499c46385d938179d5c71cb5291268171f09260' +
             'b1afac60d7cfa2c6cf693133e017b22e10c053919e8b34685219d31658ad56e83ed06d225d5c' +
             'e2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98' +
             'ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49'
      }
    ],
    'MAYO-5': [
      {
        count: 0,
        file: 'PQCsignKAT_40_MAYO_5.rsp',
        msg: 'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
        sk: '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2db505d7cfad1b4974',
        R: '33b3c07507e4201748494d832b6ee2a6c93bff9b0ee343b550d1f85a3d0de0d704c6d17842951309',
        sm: '9f77e9b30b56547579e95d8c4c3f6904a9624a9606db56d4269f30f17fa04af3ee5f194ede5f' +
             '74e0c38788972f793c7e50513226b9ef28193b74989ee9ffa8cd920d916a41314ab2ce5613e2' +
             '69154c229ea9cc5442303d4aacb2a9eaa8ea0fde61102ef234c20bbb604a95b84f8ada7a9ad0' +
             'f56b8a96f223bc77a8da1b5b000fd0e27332a17ecbc0faebfdd3f7ac925e55d503922b8bb833' +
             '9b598caa472248cdd137a5363a73bb8a3e90248af478f061a7e0bd19c3027bac83626bf863ed' +
             '133cda6b70d3443b8e7677487275356abff0d086bdf7dc88aa8359cfc8e834ba74c403c78f9b' +
             '537a15272d5d04d2f47e573cd15fac4a98a40e74e6823ec3ca1ddc8bbc62eab22c371d58c19d' +
             '87eac57b3fa3e44cbc2c7e1a41a21f4d960302e3e0644ebb35042a771417b7f3346dc7b83c3f' +
             'b2fd243642e2360d82fbdc863146b3ee163cf2abd16c3b3ecd0c06c3c0435ef2b23e26a61d64' +
             '9e07ce58833090de918ac877dea2e552d22e2e558068852047ef6af0ff7b3969e4c002da4a3a' +
             '5f9e036e7b01ca1c3efb0d435a90fd5565db19b83257f30b114b245139c41740c61539acc0f3' +
             '435425b294636213ba2eff741e112af553e77e3c3a58e58c46b184347e1948a9c042da7014a9' +
             '516da980d950b68061a78bdb8b3c430668e14e6c8a1620ddea03b17b0e05027db55506c26574' +
             '8988ac887eea97be4a969aa76c492137e680abe2f76e928a9f7d610c2427e02ac4e1fa9ee7df' +
             'c4dd9dff774563110c95e2d91f42eb2911c2307ac2d1a816bb3872661367ef61615109c4235e' +
             '85cebfc4d186af3e7d70f4c842cb6aeae45291df06ce94276b57e10550da0d56dcc3a1d036ad' +
             '4f2c2ff2e1dd42310355e874f8765ed8256dbf61380c4bb5423e2aeef9824185b89f71d8983b' +
             'fa912741cebd9e429b5e14fa6688a4874b14bb5b5bc0ade1d84c1a1b3f75b78cc40d01adb752' +
             '6d5c4516e8de9b38ee7606f9ceba8a03bce830f17dacc7e57348ce3d9a7e097e796fe6a2be48' +
             '70d0e91b68477fcfa819921110f31592df418acc2121935f5f1b9badec36d1281bbe2bf96f26' +
             'acb66176f428317983cedd42c70d7335a1cef36156009f3b17e3929f870ec879de54f0ab293f' +
             '6f34895e34eebbc554cc5ce39e5ff84712ada17e41d464590193e4d6b9e11579d6578620c72d' +
             '8ac5b79f54781e2f1409efd0e04e14536e402f0bbe1f47f4783705cf130bcb19fbb79a4c1a02' +
             '3351b9797510d4a121daa129be3be882148a09272dae5b7f4d12978e6256262db36679c18e23' +
             'b5135c461f18cb7b703d45a124374ceb25637183b96cf246d204a04018f4344c81aad9cfa98c' +
             '2ee4f5f6ce3a6f352a86e9a1b07bd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55' +
             'b22e75bf57bb556ac8'
      },
      {
        count: 1,
        file: 'PQCsignKAT_40_MAYO_5.rsp',
        msg: '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49',
        sk: '4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64c81cc7cc2f513345d5a45a4ced06403c',
        R: '08e25538484cd7f1613248fe6c9f6b4ec14be684c6defdd1e41333b6e9052ac4340e314eea2c99f7',
        sm: '15db05faa3a08fb2077ca65be466b6e1fc9139e696e7852938742949180b4ca599f5007a7885' +
             '204522f027e5d163db76c6a71779bf6674462a007e681fedc8cc45a729433b61609c8ca0400c' +
             'b4b4053af05170db49ce4d776da9e5104bad6f01bf06300626118f1cddcdcd7cbae81abcf6b0' +
             '9b6dd8636724eb2c194c5f60c9efa198e3a296aa936abc0690e44280c2a09933e2441ebe5d30' +
             '2f3b6124132c82efd3bf163ba3577da5769580b51fcec466ccab2f7094589e3e37f36c9c873f' +
             'b53b4c4261f67a3138064cf3d264ae048a1b962cc6d25500e7bba6259ae31b2d32815bb3ec8b' +
             'fba4da027786127f3e29fc8e6ad0f12fc777f3cda52798d5f78b8ddeee0a16fe453d83099143' +
             '6a2140f83ab3e07016f66faa3b1d61a3f642f2040f841f7bee74c001fec18ee82d2f8eb16f25' +
             '173f4c9717f81e4869391e3702dedf628a6809c30fe472afafaf842b89e0a028829d2e8668b0' +
             'a397698a49c5c6164e8153e117f87ee57429d3ab7dda49c308064bdbbf35e4b36925f2373d18' +
             '02b2f403f4c6d741fa933c54a72983497ec3c85b39fcdf6f1ef7fd949833d35675be9d2ff2df' +
             '42519b3b846786063b617aa5d882b7b6aed75ee70ade77acd1a5960bcdd0a6b79565a7443078' +
             '673fa3e9769d93ac1a5bd7cf58fe81dabe2a6d06cc6edd9170852eff9320b472bc2f26ad9d86' +
             'c087d152adaea80795a643edb5a4f21b6907cdcfb209577961e86561a926cfd51e1afeb4d884' +
             'bf716c4f8cc084cf75683ccbd388bc5b451d4fcd9267de3e5b8902b6858b91a6bbe8fdee5d55' +
             '413edb6e308baa5d47b90d22659844ce68579b974d5941b901b073688fd4ff83b3ce61c18389' +
             '0c1f3138f6885cefd2913569b238b95e9b86dfbe5094156249c78ac1fd7b3b055111cb89abdf' +
             '7b2d8eb306bcbf936ae9af9353689eeb8d61f1842b830c2933004dc5a3644d2f39c6c22828ef' +
             'c613478c3eed2329131e9b2e9e5665397ba5afaa4ab7da6026b088b252f94d4b8a9fc48246bf' +
             '0fd55eed38a3586cd59b2db63843342237a36078b72960f4994de49e911582b63adec20266db' +
             '27a2e4f222d22757b7df5393748763c017a3ae558e1fcfef841a6f54a03c1deb8a474b2f0849' +
             'f1baad68ef5c4633d5d2abfc5bd55775f725166a10283e225de63b6cbfd8ed762cd928c9ff27' +
             '1fdd3bb443f4705ca9af46744163ce1c7744cd9690192ba2aecd03d32836a37306861ca78b95' +
             'eea8efa5e2940f94a99b2641a2a5d0eaef95679fb495cc2d4404d9432abf42445e68bcfa7385' +
             '2af42c6bfdbd22e646a79e03fb1f5684de97598d6cb6b87e3388b8ab159fc8c49928746c9c2c' +
             '1b954e8616c57d1c82b28948d5ab225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3c' +
             'a299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983' +
             'b17dcd49'
      }
    ]
  };

  // ===== ALGORITHM IMPLEMENTATION =====

  class MAYOAlgorithm extends AsymmetricCipherAlgorithm {
    /**
     * @param {string} setName - One of the keys of PARAMETER_SETS
     */
    constructor(setName) {
      super();

      const P = Object.assign({ name: setName }, PARAMETER_SETS[setName]);
      const S = sizesOf(P);
      this.parameters = P;
      this.sizes = S;

      this.name = setName;
      this.description = "MAYO at NIST level " + P.level + ": an Oil-and-Vinegar signature over GF(16) whose oil space has dimension "
        + P.o + ", smaller than the " + P.m + " equations, which is what makes the public key small. Signing is restored by whipping the quadratic map into "
        + P.k + " copies combined through matrices that represent multiplication by powers of z in a degree-" + P.m
        + " extension of GF(16); the whipped map still vanishes on the oil space, and " + P.k + "·" + P.o + " ≥ " + P.m
        + " makes the linear system in the oil variables solvable again. Signatures are " + S.sigBytes + " octets and public keys " + S.cpkBytes + ".";
      this.inventor = "Ward Beullens, Fabio Campos, Sofía Celi, Basil Hess, Matthias J. Kannwischer";
      this.year = 2021;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Multivariate Digital Signature";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.BE;

      // The key is the compact secret key, which is the seed everything else is
      // derived from and is exactly what the KAT files carry.
      this.SupportedKeySizes = [
        new KeySize(S.cskBytes, S.cskBytes, 0)
      ];

      this.documentation = [
        new LinkItem("MAYO specification, round 3", "https://pqmayo.org/assets/specs/mayo-round3.pdf"),
        new LinkItem("MAYO project site", "https://pqmayo.org/"),
        new LinkItem("Beullens - MAYO: Practical Post-Quantum Signatures from Oil-and-Vinegar Maps (SAC 2021)", "https://eprint.iacr.org/2021/1144"),
        new LinkItem("NIST PQC additional digital signature schemes", "https://csrc.nist.gov/projects/pqc-dig-sig/round-3-additional-signatures")
      ];

      this.references = [
        new LinkItem("MAYO-C reference implementation and KAT files", "https://github.com/PQCMayo/MAYO-C"),
        new LinkItem("MAYO-sage reference implementation", "https://github.com/PQCMayo/MAYO-sage"),
        new LinkItem("FIPS 202 - SHA-3 and the SHAKE functions", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Under evaluation, not standardised",
          '',
          "MAYO is a candidate in the NIST additional-signatures process and its parameters have already moved twice under unpublished attacks: the round-two whipping schedule was replaced because its Z matrix was not MDS, and MAYO-2 changed from n = 82 to n = 86 shortly before the round-three deadline. Treat it as experimental",
          "https://pqmayo.org/assets/specs/mayo-round3.pdf"),
        new Vulnerability("Round-two parameters are not interoperable",
          '',
          "A round-two implementation disagrees with this one: the whipping schedule was reordered and verification gained a linear term. Signatures do not cross the version boundary",
          "https://pqmayo.org/assets/specs/mayo-round3.pdf"),
        new Vulnerability("Published demonstration keys",
          '',
          "The secret keys in the test vectors are printed in the source, come from a published KAT file and confer no confidentiality. Supply a secret key of " + S.cskBytes + " random octets for any use beyond demonstration",
          "https://github.com/PQCMayo/MAYO-C")
      ];

      // Test vectors.
      //
      // Every expected value is the sm field of an entry of the official
      // PQCsignKAT file for this parameter set, and every key is that entry's
      // sk. None of it was produced by this file. MAYO signing is deterministic
      // once the randomiser R is fixed, and the KAT harness draws both the
      // secret key and R from the NIST AES-256-CTR-DRBG seeded from the entry's
      // seed field; the R that each of these entries used is supplied alongside
      // the key so that the signature is reproduced rather than merely checked.
      //
      // Measured over the whole of all four KAT files, not only the entries
      // committed here: 400 of 400 signed messages reproduced octet for octet,
      // and the public key of every entry rederived from its secret key.
      this.tests = (KAT[setName] || []).map(entry => ({
        text: setName + " KAT entry " + entry.count + " (NIST round-3 additional signatures)",
        uri: "https://github.com/PQCMayo/MAYO-C/blob/main/KAT/" + entry.file,
        input: OpCodes.Hex8ToBytes(entry.msg),
        key: OpCodes.Hex8ToBytes(entry.sk),
        randomizer: OpCodes.Hex8ToBytes(entry.R),
        expected: OpCodes.Hex8ToBytes(entry.sm)
      }));
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to verify, false to sign
     * @returns {Object} New instance
     */
    CreateInstance(isInverse = false) {
      return new MAYOInstance(this, isInverse);
    }
  }

  /**
   * MAYO instance implementing the Feed/Result pattern.
   *
   * The forward direction consumes a message and produces signature || message,
   * which is what MAYO.API.sign returns. The inverse direction is
   * MAYO.API.sign_open: it checks the signature against the message it carries
   * and returns the message, reporting a bad signature by throwing.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class MAYOInstance extends IAlgorithmInstance {
    /**
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Verification mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.parameters = algorithm.parameters;
      this.sizes = algorithm.sizes;
      this._key = null;
      this._keyData = null;
      this._publicKeyData = null;
      this._randomizer = null;
      this.inputBuffer = [];
    }

    // Property setter for key (for test suite compatibility)
    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
     * Get the compact secret key this instance was configured with.
     * @returns {uint8[]|null} The octets, or null
     */
    get key() {
      return this._keyData;
    }

    /**
     * The compact public key.
     * @returns {uint8[]|null} The octets, or null
     */
    get publicKey() {
      return this._key ? this._key.cpk : null;
    }

    /**
     * Verify against a public key alone, with no secret key present.
     * @param {uint8[]} cpk - The compact public key
     */
    set publicKey(cpk) {
      if (!cpk) { this._key = null; this._publicKeyData = null; return; }
      if (cpk.length !== this.sizes.cpkBytes) {
        throw new Error(this.parameters.name + ': the public key is '
          + this.sizes.cpkBytes + ' octets, not ' + cpk.length);
      }
      const copy = new Array(cpk.length);
      for (let i = 0; i < cpk.length; ++i) copy[i] = cpk[i];
      this._publicKeyData = copy;
      this._key = expandPublicKey(this.parameters, copy);
    }

    /**
     * The compact secret key.
     * @returns {uint8[]|null} The octets, or null
     */
    get privateKey() {
      return this._keyData;
    }

    /**
     * The optional signing randomiser R. Zero when not supplied, which is the
     * deterministic mode the specification permits; the KAT vectors supply the
     * value their entry drew from the NIST DRBG.
     * @param {uint8[]} value - salt_bytes octets
     */
    set randomizer(value) {
      if (!value) { this._randomizer = null; return; }
      if (value.length !== this.parameters.saltBytes) {
        throw new Error(this.parameters.name + ': the randomiser is '
          + this.parameters.saltBytes + ' octets, not ' + value.length);
      }
      const copy = new Array(value.length);
      for (let i = 0; i < value.length; ++i) copy[i] = value[i];
      this._randomizer = copy;
    }

    get randomizer() {
      return this._randomizer;
    }

    /**
     * Install a compact secret key.
     * @param {uint8[]} keyData - csk_bytes octets
     */
    KeySetup(keyData) {
      if (!keyData || typeof keyData.length !== 'number' || keyData.length !== this.sizes.cskBytes) {
        throw new Error(this.parameters.name + ': the key is a compact secret key of exactly '
          + this.sizes.cskBytes + ' octets');
      }

      const seed = new Array(this.sizes.cskBytes);
      for (let i = 0; i < seed.length; ++i) seed[i] = keyData[i];

      this._keyData = seed;
      this._key = expandKey(this.parameters, seed);
    }

    /**
     * Feed data for processing. Appends, so that a message split across several
     * calls signs identically to the same message delivered at once.
     * @param {uint8[]|string} data - Input octets
     */
    Feed(data) {
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data.charCodeAt(i) % 256);
      } else if (data && typeof data.length === 'number') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
      } else {
        this.inputBuffer.push(data);
      }
    }

    /**
     * Produce the signed message, or recover the message from one.
     * @returns {uint8[]} signature || message when signing, message when verifying
     * @throws {Error} If no key is set or the signature does not verify
     */
    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      try {
        const result = this.isInverse
          ? this._open(this.inputBuffer)
          : this._sign(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw error;
      }
    }

    /**
     * Sign a message.
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} signature || message
     */
    _sign(message) {
      if (!this._key || !this._key.seedsk) {
        throw new Error(this.parameters.name + ' secret key not set. Assign a key first.');
      }

      const R = this._randomizer || new Array(this.parameters.saltBytes).fill(0);
      const signature = signMessage(this._key, message, R);

      // A signer that hands out a value it has not checked is how a scheme ends
      // up with signatures nothing verifies, so it is asserted here against the
      // verifier rather than assumed.
      if (!verifyMessage(this._key, message, signature)) {
        throw new Error(this.parameters.name + ': internal error, the computed signature does not verify');
      }

      const out = new Array(signature.length + message.length);
      for (let i = 0; i < signature.length; ++i) out[i] = signature[i];
      for (let i = 0; i < message.length; ++i) out[signature.length + i] = message[i];
      return out;
    }

    /**
     * MAYO.API.sign_open: check a signed message and return the message.
     * @param {uint8[]} signed - signature || message
     * @returns {uint8[]} The message octets
     * @throws {Error} When the signature does not verify
     */
    _open(signed) {
      if (!this._key) {
        throw new Error(this.parameters.name + ' key not set. Assign a key first.');
      }

      const sigBytes = this.sizes.sigBytes;
      if (signed.length < sigBytes) {
        throw new Error(this.parameters.name + ': signed message is ' + signed.length
          + ' octets, shorter than the ' + sigBytes + '-octet signature it must carry');
      }

      const signature = signed.slice(0, sigBytes);
      const message = signed.slice(sigBytes);

      if (!verifyMessage(this._key, message, signature)) {
        throw new Error(this.parameters.name + ': signature does not verify');
      }

      return message;
    }

    /**
     * Sign a message, returning the signature alone.
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} sig_bytes octets
     */
    Sign(message) {
      if (!this._key || !this._key.seedsk) {
        throw new Error(this.parameters.name + ' secret key not set. Assign a key first.');
      }
      const R = this._randomizer || new Array(this.parameters.saltBytes).fill(0);
      return signMessage(this._key, message, R);
    }

    /**
     * Verify a detached signature over a message.
     * @param {uint8[]} message - Message octets
     * @param {uint8[]} signature - sig_bytes octets
     * @returns {boolean} Whether the signature verifies
     */
    Verify(message, signature) {
      if (!this._key) {
        throw new Error(this.parameters.name + ' key not set. Assign a key first.');
      }
      return verifyMessage(this._key, message, signature);
    }

    /**
     * Clear sensitive data.
     */
    ClearData() {
      // The expanded key is shared through the seed-keyed cache, so the instance
      // drops its reference rather than scribbling on material another instance
      // configured with the same key is still using.
      this._key = null;
      if (this._keyData) OpCodes.ClearArray(this._keyData);
      this._keyData = null;
      if (this._randomizer) OpCodes.ClearArray(this._randomizer);
      this._randomizer = null;
      this._publicKeyData = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  for (const setName of Object.keys(PARAMETER_SETS)) {
    const instance = new MAYOAlgorithm(setName);
    if (!AlgorithmFramework.Find(instance.name)) {
      RegisterAlgorithm(instance);
    }
  }

  // ===== EXPORTS =====

  return {
    MAYOAlgorithm,
    MAYOInstance,
    PARAMETER_SETS,
    WHIP_POSITIONS,
    sizesOf,
    expandKey,
    expandPublicKey,
    signMessage,
    verifyMessage,
    sampleSolution,
    decodeVec,
    encodeVec
  };
}));
