/*
 * Classic McEliece Implementation
 * The code-based key encapsulation mechanism submitted to round 4 of the NIST
 * post-quantum process
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Classic McEliece is a Niederreiter key encapsulation mechanism over a binary
 * Goppa code. The private key is a monic irreducible polynomial g of degree t
 * over GF(2^m) together with an ordering of the field; the public key is the
 * parity check matrix of that code reduced to systematic form, so a ciphertext
 * is the syndrome of a weight-t error vector and only the Goppa structure makes
 * it decodable. Decapsulation runs the Berlekamp decoder: syndrome, key
 * equation by Berlekamp-Massey, then the roots of the error locator.
 *
 * All five parameter sets of the round 4 submission are implemented:
 *
 *   mceliece348864   m=12 n=3488 t=64    pk  261120  sk  6492  ct  96
 *   mceliece460896   m=13 n=4608 t=96    pk  524160  sk 13608  ct 156
 *   mceliece6688128  m=13 n=6688 t=128   pk 1044992  sk 13932  ct 208
 *   mceliece6960119  m=13 n=6960 t=119   pk 1047319  sk 13948  ct 194
 *   mceliece8192128  m=13 n=8192 t=128   pk 1357824  sk 14120  ct 208
 *
 * The "f" variants, which reduce to semi-systematic rather than systematic form
 * during key generation, are not implemented. They produce different keys from
 * the same seed and none of that is approximated by the code paths here.
 *
 * Verified against the submission's own Known Answer Tests,
 * KAT/kem/<set>/kat_kem.rsp and kat_kem.int from mceliece-kat-20221023.tar.gz:
 * for every one of the five parameter sets, all 10 records agree on the public
 * key, the secret key, the ciphertext and the shared secret, and on both of the
 * intermediate error vectors those files publish - the one encapsulation
 * generated and the one decapsulation recovered. That is 50 records and 350
 * field comparisons. Nothing committed below was produced by this file.
 *
 * Those records are keyed by a 48 byte seed driving the NIST Known Answer Test
 * AES-256 CTR_DRBG, which is implemented here and was checked on its own first:
 * started from the standard entropy input it reproduces all 10 published seeds
 * of kat_kem.req exactly.
 *
 * The committed vectors drive key generation from the published seed only for
 * mceliece348864. Key generation reduces an mt by n binary matrix and the
 * larger sets take seconds to do it, past the test engine's per-vector budget;
 * they are gated on decapsulation, which is cheap. The public key is therefore
 * asserted directly only for mceliece348864, where the ciphertext vector pins
 * it: a ciphertext is the syndrome of the published error vector under the
 * generated matrix, so a wrong matrix gives a wrong ciphertext.
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
          AsymmetricCipherAlgorithm, IAlgorithmInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== AES-256 =====
  //
  // Only the Known Answer Test generator needs a block cipher, to drive the
  // NIST CTR_DRBG. The collection's own AES is used rather than another copy.
  //
  // The load is deferred to first use rather than done at module scope: the
  // documentation and README generators attribute a registration to whichever
  // file was being loaded when it happened, so requiring the block cipher here
  // would file AES under this directory and drop it from the block cipher
  // index.
  let aesAlgorithm = null;

  function FindAes() {
    if (aesAlgorithm) return aesAlgorithm;

    aesAlgorithm = AlgorithmFramework.Find ? AlgorithmFramework.Find('Rijndael (AES)') : null;
    if (!aesAlgorithm && typeof require !== 'undefined') {
      try {
        require('../block/rijndael.js');
      } catch (e) {
        // Reported as a missing dependency below.
      }
      aesAlgorithm = AlgorithmFramework.Find ? AlgorithmFramework.Find('Rijndael (AES)') : null;
    }

    if (!aesAlgorithm)
      throw new Error('Classic McEliece key generation from a KAT seed needs AES, which is not registered');
    return aesAlgorithm;
  }

  // ===== SHAKE-256 =====
  //
  // Key generation squeezes n + 32q + 16t + 256 bits from one absorbed state:
  // almost seventeen kilobytes for m = 12 and over thirty-two for m = 13. The
  // collection's registered extendable output function refuses that - it caps a
  // squeeze at a kilobyte - so the sponge is kept here. It is checked against
  // the published Known Answer Tests, which do not agree unless every byte of
  // that stream is right.

  const KECCAK_RC_LOW = [
    0x00000001, 0x00008082, 0x0000808A, 0x80008000, 0x0000808B, 0x80000001,
    0x80008081, 0x00008009, 0x0000008A, 0x00000088, 0x80008009, 0x8000000A,
    0x8000808B, 0x0000008B, 0x00008089, 0x00008003, 0x00008002, 0x00000080,
    0x0000800A, 0x8000000A, 0x80008081, 0x00008080, 0x80000001, 0x80008008
  ];

  const KECCAK_RC_HIGH = [
    0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000,
    0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000
  ];

  const KECCAK_ROTATION = [
     0,  1, 62, 28, 27, 36, 44,  6, 55, 20,  3, 10, 43,
    25, 39, 41, 45, 15, 21,  8, 18,  2, 61, 56, 14
  ];

  const SHAKE256_RATE = 136;

  /**
   * One Keccak-f[1600] permutation over a state held as 25 pairs of 32 bit
   * halves, low half first.
   * @param {Int32Array} state - 50 words, modified in place
   */
  function KeccakPermute(state) {
    const b = new Int32Array(50);
    const c = new Int32Array(10);
    const d = new Int32Array(10);

    for (let round = 0; round < 24; ++round) {
      for (let x = 0; x < 5; ++x) {
        let low = 0, high = 0;
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
          let newLow, newHigh;
          if (rotation === 0) {
            newLow = low;
            newHigh = high;
          } else if (rotation < 32) {
            newLow = OpCodes.Or32(OpCodes.Shl32(low, rotation), OpCodes.Shr32(high, 32 - rotation));
            newHigh = OpCodes.Or32(OpCodes.Shl32(high, rotation), OpCodes.Shr32(low, 32 - rotation));
          } else if (rotation === 32) {
            newLow = high;
            newHigh = low;
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
   * SHAKE-256 over a byte string, squeezed to any length in one call.
   * @param {uint8[]} input - the message
   * @param {number} outputLength - octets wanted
   * @returns {Uint8Array} the output
   */
  function Shake256(input, outputLength) {
    const state = new Int32Array(50);
    const block = new Uint8Array(SHAKE256_RATE);

    const absorbBlock = () => {
      for (let i = 0; i < SHAKE256_RATE; ++i) {
        const word = OpCodes.Shr32(i, 3);
        const byteInWord = OpCodes.And32(i, 7);
        const index = 2 * word + OpCodes.Shr32(byteInWord, 2);
        state[index] = OpCodes.Xor32(state[index], OpCodes.Shl32(block[i], 8 * OpCodes.And32(byteInWord, 3)));
      }
      KeccakPermute(state);
    };

    let filled = 0;
    for (let i = 0; i < input.length; ++i) {
      block[filled] = OpCodes.And32(input[i], 0xFF);
      ++filled;
      if (filled === SHAKE256_RATE) {
        absorbBlock();
        block.fill(0);
        filled = 0;
      }
    }

    block.fill(0, filled);
    block[filled] = OpCodes.Xor32(block[filled], 0x1F);
    block[SHAKE256_RATE - 1] = OpCodes.Xor32(block[SHAKE256_RATE - 1], 0x80);
    absorbBlock();

    const output = new Uint8Array(outputLength);
    let produced = 0;
    while (produced < outputLength) {
      for (let i = 0; i < SHAKE256_RATE && produced < outputLength; ++i) {
        const word = OpCodes.Shr32(i, 3);
        const byteInWord = OpCodes.And32(i, 7);
        const index = 2 * word + OpCodes.Shr32(byteInWord, 2);
        output[produced] = OpCodes.And32(OpCodes.Shr32(state[index], 8 * OpCodes.And32(byteInWord, 3)), 0xFF);
        ++produced;
      }
      if (produced < outputLength) KeccakPermute(state);
    }

    return output;
  }

  // ===== the NIST Known Answer Test generator =====
  //
  // The AES-256 CTR_DRBG of the NIST reference harness. It is what turns a
  // record's 48 byte seed into the seed key generation expands and then into
  // the randomness encapsulation draws for its error vector.

  function Aes256Ecb(key, block) {
    const instance = FindAes().CreateInstance(false);
    instance.key = key;
    instance.Feed(block);
    return instance.Result();
  }

  function IncrementCounter(v) {
    for (let j = 15; j >= 0; --j) {
      if (v[j] === 0xFF) v[j] = 0;
      else { v[j] = v[j] + 1; break; }
    }
  }

  /**
   * The generator, seeded as randombytes_init does with a zero key and counter.
   * @param {uint8[]} entropy - the 48 octet seed
   * @returns {object} a reader with read(count)
   */
  function Drbg(entropy) {
    const key = new Array(32).fill(0);
    const v = new Array(16).fill(0);

    const update = function (providedData) {
      const temp = [];
      for (let i = 0; i < 3; ++i) {
        IncrementCounter(v);
        const block = Aes256Ecb(key, v);
        for (let j = 0; j < 16; ++j) temp.push(block[j]);
      }
      if (providedData)
        for (let i = 0; i < 48; ++i) temp[i] = OpCodes.XorN(temp[i], providedData[i]);
      for (let i = 0; i < 32; ++i) key[i] = temp[i];
      for (let i = 0; i < 16; ++i) v[i] = temp[32 + i];
    };

    const seed = [];
    for (let i = 0; i < 48; ++i) seed.push(entropy[i]);
    update(seed);

    return {
      read: function (count) {
        const out = [];
        while (out.length < count) {
          IncrementCounter(v);
          const block = Aes256Ecb(key, v);
          for (let j = 0; j < 16 && out.length < count; ++j) out.push(block[j]);
        }
        update(null);
        return out;
      }
    };
  }

  // ===== PARAMETER SETS =====
  //
  // m is the degree of the field, n the code length, t the number of errors
  // the Goppa code corrects. fieldPolynomial is f(z) defining GF(2^m) and
  // ringTaps is the reduction of y^t in GF(2^m)[y]/F(y), the ring whose
  // elements' minimal polynomials are the Goppa polynomials: each entry is an
  // exponent below t and the field coefficient that lands on it.

  const PARAMETER_SETS = (() => {
    const build = (name, m, n, t, fieldPolynomial, ringTaps) => {
      const q = OpCodes.Shl32(1, m);
      const mt = m * t;
      const set = {
        name: name, m: m, n: n, t: t, q: q, mt: mt, k: n - mt,
        fieldPolynomial: fieldPolynomial, ringTaps: ringTaps
      };
      set.nBytes = OpCodes.Shr32(n, 3);
      set.syndromeSize = OpCodes.Shr32(mt + 7, 3);
      set.publicKeyRowSize = OpCodes.Shr32(set.k + 7, 3);
      set.publicKeySize = mt * set.publicKeyRowSize;
      set.irreducibleSize = t * 2;
      set.conditionSize = OpCodes.Shl32(1, m - 4) * (2 * m - 1);
      set.privateKeySize = 32 + 8 + set.irreducibleSize + set.conditionSize + set.nBytes;
      set.ciphertextSize = set.syndromeSize;
      set.sharedSecretSize = 32;
      set.seedSize = 32;
      // tau is t when n is q, and 2t when n is at least half of q. Every
      // selected parameter set falls in one of those two cases.
      set.tau = (n === q) ? t : (2 * n >= q ? 2 * t : 4 * t);
      return set;
    };

    const sets = {};
    for (const set of [
      build('mceliece348864',  12, 3488, 64,  0x1009, [[3, 1], [1, 1], [0, 2]]),
      build('mceliece460896',  13, 4608, 96,  0x201B, [[10, 1], [9, 1], [6, 1], [0, 1]]),
      build('mceliece6688128', 13, 6688, 128, 0x201B, [[7, 1], [2, 1], [1, 1], [0, 1]]),
      build('mceliece6960119', 13, 6960, 119, 0x201B, [[8, 1], [0, 1]]),
      build('mceliece8192128', 13, 8192, 128, 0x201B, [[7, 1], [2, 1], [1, 1], [0, 1]])
    ]) sets[set.name] = set;
    return sets;
  })();

  function FindParameterSet(label) {
    if (label === null || label === undefined) return null;
    const text = String(label).toLowerCase();
    if (PARAMETER_SETS[text]) return PARAMETER_SETS[text];
    for (const name of Object.keys(PARAMETER_SETS))
      if (name.indexOf(text) >= 0) return PARAMETER_SETS[name];
    if (text === '3488') return PARAMETER_SETS['mceliece348864'];
    if (text === '4608') return PARAMETER_SETS['mceliece460896'];
    if (text === '6688') return PARAMETER_SETS['mceliece6688128'];
    if (text === '6960') return PARAMETER_SETS['mceliece6960119'];
    if (text === '8192') return PARAMETER_SETS['mceliece8192128'];
    return null;
  }

  function ParameterSetByLength(length, field) {
    for (const name of Object.keys(PARAMETER_SETS))
      if (PARAMETER_SETS[name][field] === length) return PARAMETER_SETS[name];
    return null;
  }

  // ===== GF(2^m) =====
  //
  // Multiplication runs in the innermost loop of both the syndrome and the root
  // search, so it goes through discrete logarithm tables rather than a shift
  // and reduce. The tables are built once per field from a carrier-free
  // multiply; z itself generates only a subgroup for f(z) = z^12 + z^3 + 1, so
  // the generator is searched for rather than assumed.

  const FIELD_CACHE = {};

  function GetField(set) {
    const cached = FIELD_CACHE[set.m];
    if (cached) return cached;

    const m = set.m;
    const q = OpCodes.Shl32(1, m);
    const mask = q - 1;
    const reduction = OpCodes.And32(set.fieldPolynomial, mask);

    const slowMultiply = (a, b) => {
      let result = 0;
      for (let i = 0; i < m; ++i)
        if (OpCodes.And32(OpCodes.Shr32(b, i), 1)) result = OpCodes.Xor32(result, OpCodes.Shl32(a, i));
      for (let i = 2 * m - 2; i >= m; --i)
        if (OpCodes.And32(OpCodes.Shr32(result, i), 1)) {
          result = OpCodes.Xor32(result, OpCodes.Shl32(1, i));
          result = OpCodes.Xor32(result, OpCodes.Shl32(reduction, i - m));
        }
      return OpCodes.And32(result, mask);
    };

    let generator = 0;
    for (let candidate = 2; candidate < q; ++candidate) {
      let value = 1, order = 0;
      do { value = slowMultiply(value, candidate); ++order; } while (value !== 1 && order <= mask);
      if (order === mask) { generator = candidate; break; }
    }
    if (!generator) throw new Error('Classic McEliece: no generator found for GF(2^' + m + ')');

    const exp = new Uint16Array(2 * mask);
    const log = new Uint16Array(q);
    let value = 1;
    for (let i = 0; i < mask; ++i) { exp[i] = value; log[value] = i; value = slowMultiply(value, generator); }
    for (let i = mask; i < 2 * mask; ++i) exp[i] = exp[i - mask];

    const field = {
      m: m, q: q, mask: mask,
      multiply: (a, b) => (a === 0 || b === 0) ? 0 : exp[log[a] + log[b]],
      invert: (a) => (a === 0) ? 0 : exp[mask - log[a]],
      exp: exp, log: log
    };
    FIELD_CACHE[m] = field;
    return field;
  }

  // ===== GF(2^m)[y] / F(y) =====

  /**
   * Multiply in the ring whose elements the Goppa polynomials are minimal
   * polynomials of.
   * @param {Uint16Array} a - first operand, t coefficients
   * @param {Uint16Array} b - second operand, t coefficients
   * @param {object} set - the parameter set
   * @param {object} field - the field
   * @returns {Uint16Array} the product
   */
  function RingMultiply(a, b, set, field) {
    const t = set.t;
    const product = new Uint16Array(2 * t - 1);

    for (let i = 0; i < t; ++i) {
      const left = a[i];
      if (left === 0) continue;
      for (let j = 0; j < t; ++j)
        product[i + j] = OpCodes.Xor32(product[i + j], field.multiply(left, b[j]));
    }

    for (let i = 2 * t - 2; i >= t; --i) {
      const high = product[i];
      if (high === 0) continue;
      for (let tap = 0; tap < set.ringTaps.length; ++tap) {
        const exponent = set.ringTaps[tap][0];
        const coefficient = set.ringTaps[tap][1];
        const contribution = (coefficient === 1) ? high : field.multiply(high, coefficient);
        product[i - t + exponent] = OpCodes.Xor32(product[i - t + exponent], contribution);
      }
    }

    const out = new Uint16Array(t);
    for (let i = 0; i < t; ++i) out[i] = product[i];
    return out;
  }

  /**
   * The minimal polynomial over GF(2^m) of the ring element the seed names.
   * Returns null when it has degree below t, which the caller answers by
   * restarting key generation from the next seed.
   * @param {Uint16Array} element - t coefficients
   * @param {object} set - the parameter set
   * @param {object} field - the field
   * @returns {Uint16Array|null} the t low coefficients of the monic result
   */
  function MinimalPolynomial(element, set, field) {
    const t = set.t;

    // column j holds the jth power of the element
    const columns = [];
    const first = new Uint16Array(t);
    first[0] = 1;
    columns.push(first);
    const second = new Uint16Array(t);
    second.set(element);
    columns.push(second);
    for (let j = 2; j <= t; ++j) columns.push(RingMultiply(columns[j - 1], element, set, field));

    for (let j = 0; j < t; ++j) {
      for (let k = j + 1; k < t; ++k)
        if (columns[j][j] === 0)
          for (let c = j; c <= t; ++c) columns[c][j] = OpCodes.Xor32(columns[c][j], columns[c][k]);

      if (columns[j][j] === 0) return null;

      const inverse = field.invert(columns[j][j]);
      for (let c = j; c <= t; ++c) columns[c][j] = field.multiply(columns[c][j], inverse);

      for (let k = 0; k < t; ++k) {
        if (k === j) continue;
        const factor = columns[j][k];
        if (factor === 0) continue;
        for (let c = j; c <= t; ++c)
          columns[c][k] = OpCodes.Xor32(columns[c][k], field.multiply(columns[c][j], factor));
      }
    }

    const out = new Uint16Array(t);
    for (let i = 0; i < t; ++i) out[i] = columns[t][i];
    return out;
  }

  // ===== small helpers =====

  function BitReverse(value, m) {
    let out = 0;
    for (let i = 0; i < m; ++i) out = OpCodes.Or32(OpCodes.Shl32(out, 1), OpCodes.And32(OpCodes.Shr32(value, i), 1));
    return out;
  }

  function LoadFieldElement(bytes, offset, mask) {
    return OpCodes.And32(OpCodes.Or32(bytes[offset], OpCodes.Shl32(bytes[offset + 1], 8)), mask);
  }

  function ReadBit(bytes, index) {
    return OpCodes.And32(OpCodes.Shr32(bytes[OpCodes.Shr32(index, 3)], OpCodes.And32(index, 7)), 1);
  }

  function SetBit(bytes, index, offset) {
    const byte = (offset || 0) + OpCodes.Shr32(index, 3);
    bytes[byte] = OpCodes.Or32(bytes[byte], OpCodes.Shl32(1, OpCodes.And32(index, 7)));
  }

  function ToArray(bytes) {
    const out = new Array(bytes.length);
    for (let i = 0; i < bytes.length; ++i) out[i] = bytes[i];
    return out;
  }

  // ===== field ordering as Benes control bits =====
  //
  // The private key stores the ordering as control bits for an in-place Benes
  // network rather than as a list of field elements. Both directions of that
  // conversion are the ones the specification fixes; any other control bits for
  // the same permutation would give a different, and wrong, private key.

  function ComposeInverse(values, permutation) {
    const out = new Int32Array(values.length);
    for (let i = 0; i < values.length; ++i) out[permutation[i]] = values[i];
    return out;
  }

  /**
   * Control bits for the permutation, as controlbits in the specification.
   * @param {Int32Array} permutation - a permutation of a power-of-two range
   * @returns {number[]} one bit per entry of the network
   */
  function ControlBits(permutation) {
    const n = permutation.length;
    let m = 1;
    while (OpCodes.Shl32(1, m) < n) ++m;
    if (m === 1) return [permutation[0]];

    const p = new Int32Array(n);
    const q = new Int32Array(n);
    for (let x = 0; x < n; ++x) {
      p[x] = permutation[OpCodes.Xor32(x, 1)];
      q[x] = OpCodes.Xor32(permutation[x], 1);
    }

    const identity = new Int32Array(n);
    for (let i = 0; i < n; ++i) identity[i] = i;
    const permutationInverse = ComposeInverse(identity, permutation);

    let left = ComposeInverse(p, q);
    let right = ComposeInverse(q, p);

    let c = new Int32Array(n);
    for (let x = 0; x < n; ++x) c[x] = Math.min(x, left[x]);

    let nextLeft = ComposeInverse(left, right);
    let nextRight = ComposeInverse(right, left);
    left = nextLeft;
    right = nextRight;

    for (let i = 1; i < m - 1; ++i) {
      const shifted = ComposeInverse(c, right);
      nextLeft = ComposeInverse(left, right);
      nextRight = ComposeInverse(right, left);
      left = nextLeft;
      right = nextRight;
      const merged = new Int32Array(n);
      for (let x = 0; x < n; ++x) merged[x] = Math.min(c[x], shifted[x]);
      c = merged;
    }

    const half = OpCodes.Shr32(n, 1);
    const front = new Int32Array(half);
    for (let j = 0; j < half; ++j) front[j] = c[2 * j] % 2;

    const folded = new Int32Array(n);
    for (let x = 0; x < n; ++x) folded[x] = OpCodes.Xor32(x, front[OpCodes.Shr32(x, 1)]);

    const composed = ComposeInverse(folded, permutationInverse);

    const back = new Int32Array(half);
    for (let k = 0; k < half; ++k) back[k] = composed[2 * k] % 2;

    const unfolded = new Int32Array(n);
    for (let y = 0; y < n; ++y) unfolded[y] = OpCodes.Xor32(y, back[OpCodes.Shr32(y, 1)]);

    const middle = ComposeInverse(composed, unfolded);

    const even = new Int32Array(half);
    const odd = new Int32Array(half);
    for (let j = 0; j < half; ++j) {
      even[j] = OpCodes.Shr32(middle[2 * j], 1);
      odd[j] = OpCodes.Shr32(middle[2 * j + 1], 1);
    }

    const evenBits = ControlBits(even);
    const oddBits = ControlBits(odd);

    const out = [];
    for (let j = 0; j < half; ++j) out.push(front[j]);
    for (let j = 0; j < evenBits.length; ++j) { out.push(evenBits[j]); out.push(oddBits[j]); }
    for (let j = 0; j < half; ++j) out.push(back[j]);
    return out;
  }

  /**
   * The permutation the control bits describe, as permutation in the
   * specification. Decapsulation reads the private key this way.
   * @param {uint8[]} conditionBytes - the control bits
   * @param {number} m - log2 of the field size
   * @returns {Int32Array} the permutation
   */
  function PermutationFromControlBits(conditionBytes, m) {
    const n = OpCodes.Shl32(1, m);
    const permutation = new Int32Array(n);
    for (let i = 0; i < n; ++i) permutation[i] = i;

    const half = OpCodes.Shr32(n, 1);
    for (let i = 0; i < 2 * m - 1; ++i) {
      const gap = OpCodes.Shl32(1, Math.min(i, 2 * m - 2 - i));
      for (let j = 0; j < half; ++j) {
        if (!ReadBit(conditionBytes, i * half + j)) continue;
        const position = (j % gap) + 2 * gap * Math.floor(j / gap);
        const swap = permutation[position];
        permutation[position] = permutation[position + gap];
        permutation[position + gap] = swap;
      }
    }
    return permutation;
  }

  /**
   * The support, that is the field ordering the private key's control bits
   * encode, restricted to the n columns the code uses.
   * @param {uint8[]} conditionBytes - the control bits
   * @param {object} set - the parameter set
   * @returns {Uint16Array} the support
   */
  function SupportFromControlBits(conditionBytes, set) {
    const permutation = PermutationFromControlBits(conditionBytes, set.m);
    const support = new Uint16Array(set.n);
    for (let i = 0; i < set.n; ++i) support[i] = BitReverse(permutation[i], set.m);
    return support;
  }

  // ===== MatGen =====

  /**
   * The public key: the parity check matrix of the Goppa code reduced to
   * systematic form, of which only the non-identity part is kept. Returns null
   * when the reduction fails, which the caller answers by restarting key
   * generation from the next seed.
   * @param {Uint16Array} goppa - the t low coefficients of the monic polynomial
   * @param {uint8[]} raw - q little-endian 32 bit values ordering the field
   * @param {object} set - the parameter set
   * @param {object} field - the field
   * @returns {object|null} { publicKey, permutation }
   */
  function GeneratePublicKey(goppa, raw, set, field) {
    const { m, n, t, q, mt, k, nBytes } = set;

    const order = new Array(q);
    for (let i = 0; i < q; ++i) order[i] = i;
    const value = new Float64Array(q);
    for (let i = 0; i < q; ++i) {
      value[i] = raw[4 * i] + raw[4 * i + 1] * 256 + raw[4 * i + 2] * 65536 + raw[4 * i + 3] * 16777216;
    }
    order.sort((x, y) => (value[x] - value[y]) || (x - y));
    for (let i = 1; i < q; ++i) if (value[order[i - 1]] === value[order[i]]) return null;

    const permutation = new Int32Array(q);
    for (let i = 0; i < q; ++i) permutation[i] = order[i];

    const support = new Uint16Array(n);
    for (let i = 0; i < n; ++i) support[i] = BitReverse(permutation[i], m);

    // the first row of the matrix is 1/g(support), the rest are that scaled by
    // increasing powers of the support
    const scaled = new Uint16Array(n);
    for (let j = 0; j < n; ++j) {
      let evaluated = 1;
      for (let i = t - 1; i >= 0; --i) evaluated = OpCodes.Xor32(field.multiply(evaluated, support[j]), goppa[i]);
      if (evaluated === 0) return null;
      scaled[j] = field.invert(evaluated);
    }

    const rowWords = Math.ceil(nBytes / 4);
    const rows = new Array(mt);
    for (let i = 0; i < mt; ++i) rows[i] = new Uint32Array(rowWords);

    for (let i = 0; i < t; ++i) {
      for (let bit = 0; bit < m; ++bit) {
        const row = rows[i * m + bit];
        for (let j = 0; j < n; ++j)
          if (OpCodes.And32(OpCodes.Shr32(scaled[j], bit), 1)) {
            const word = OpCodes.Shr32(j, 5);
            row[word] = OpCodes.Or32(row[word], OpCodes.Shl32(1, OpCodes.And32(j, 31)));
          }
      }
      if (i < t - 1)
        for (let j = 0; j < n; ++j) scaled[j] = field.multiply(scaled[j], support[j]);
    }

    // reduce to systematic form
    for (let pivot = 0; pivot < mt; ++pivot) {
      const word = OpCodes.Shr32(pivot, 5);
      const bit = OpCodes.And32(pivot, 31);

      if (!OpCodes.And32(OpCodes.Shr32(rows[pivot][word], bit), 1)) {
        let found = -1;
        for (let other = pivot + 1; other < mt; ++other)
          if (OpCodes.And32(OpCodes.Shr32(rows[other][word], bit), 1)) { found = other; break; }
        if (found < 0) return null;
        const source = rows[found];
        const target = rows[pivot];
        for (let c = 0; c < rowWords; ++c) target[c] = OpCodes.Xor32(target[c], source[c]);
      }

      const source = rows[pivot];
      for (let other = 0; other < mt; ++other) {
        if (other === pivot) continue;
        const target = rows[other];
        if (!OpCodes.And32(OpCodes.Shr32(target[word], bit), 1)) continue;
        for (let c = 0; c < rowWords; ++c) target[c] = OpCodes.Xor32(target[c], source[c]);
      }
    }

    // Each public key row is the bit range from mt to n of the reduced row,
    // repacked so that column mt lands on bit 0. mt is not a multiple of 8 for
    // every parameter set, so this is a bit extraction rather than a copy.
    const publicKey = new Uint8Array(set.publicKeySize);
    for (let i = 0; i < mt; ++i) {
      const row = rows[i];
      const base = i * set.publicKeyRowSize;
      for (let bit = 0; bit < k; ++bit) {
        const column = mt + bit;
        if (OpCodes.And32(OpCodes.Shr32(row[OpCodes.Shr32(column, 5)], OpCodes.And32(column, 31)), 1))
          SetBit(publicKey, bit, base);
      }
    }

    return { publicKey: publicKey, permutation: permutation };
  }

  // ===== SeededKeyGen =====

  /**
   * Expand a seed into a key pair, restarting from the derived seed whenever
   * the ordering, the polynomial or the reduction fails, as SeededKeyGen does.
   * @param {uint8[]} delta - the 32 octet seed
   * @param {object} set - the parameter set
   * @returns {object} { publicKey, privateKey, attempts }
   */
  function SeededKeyGen(delta, set) {
    const field = GetField(set);
    let seed = ToArray(delta);

    for (let attempt = 0; attempt < 64; ++attempt) {
      const streamLength = set.nBytes + set.q * 4 + set.t * 2 + 32;
      const input = new Array(33);
      input[0] = 64;
      for (let i = 0; i < 32; ++i) input[1 + i] = seed[i];
      const stream = Shake256(input, streamLength);

      const privateKey = new Uint8Array(set.privateKeySize);
      for (let i = 0; i < 32; ++i) privateKey[i] = seed[i];

      // the stream is consumed from its end: the next seed, then the
      // polynomial, then the ordering, then the rejection string s
      let cursor = streamLength - 32;
      const nextSeed = [];
      for (let i = 0; i < 32; ++i) nextSeed.push(stream[cursor + i]);

      cursor -= set.t * 2;
      const element = new Uint16Array(set.t);
      for (let i = 0; i < set.t; ++i) element[i] = LoadFieldElement(stream, cursor + i * 2, set.q - 1);

      const goppa = MinimalPolynomial(element, set, field);
      seed = nextSeed;
      if (!goppa) continue;

      for (let i = 0; i < set.t; ++i) {
        privateKey[40 + i * 2] = OpCodes.And32(goppa[i], 0xFF);
        privateKey[40 + i * 2 + 1] = OpCodes.And32(OpCodes.Shr32(goppa[i], 8), 0xFF);
      }

      cursor -= set.q * 4;
      const generated = GeneratePublicKey(goppa, stream.subarray(cursor, cursor + set.q * 4), set, field);
      if (!generated) continue;

      const bits = ControlBits(generated.permutation);
      const conditionOffset = 40 + set.irreducibleSize;
      for (let i = 0; i < bits.length; ++i)
        if (bits[i]) SetBit(privateKey, i, conditionOffset);

      cursor -= set.nBytes;
      const rejectionOffset = conditionOffset + set.conditionSize;
      for (let i = 0; i < set.nBytes; ++i) privateKey[rejectionOffset + i] = stream[cursor + i];

      // the column selections, fixed at 2^32 - 1 for the systematic sets
      privateKey[32] = 0xFF;
      privateKey[33] = 0xFF;
      privateKey[34] = 0xFF;
      privateKey[35] = 0xFF;

      return {
        publicKey: ToArray(generated.publicKey),
        privateKey: ToArray(privateKey),
        attempts: attempt + 1
      };
    }

    throw new Error('Classic McEliece key generation did not converge from this seed');
  }

  // ===== Encode =====

  /**
   * The syndrome of an error vector under the public key, that is a ciphertext.
   * @param {uint8[]} errorVector - n bits of weight t
   * @param {uint8[]} publicKey - the matrix
   * @param {object} set - the parameter set
   * @returns {Uint8Array} the ciphertext
   */
  function Encode(errorVector, publicKey, set) {
    const { mt, k } = set;
    const ciphertext = new Uint8Array(set.syndromeSize);

    // the tail of the error vector that multiplies the matrix, repacked so that
    // column mt is bit 0
    const tail = new Uint8Array(set.publicKeyRowSize);
    for (let bit = 0; bit < k; ++bit)
      if (ReadBit(errorVector, mt + bit)) SetBit(tail, bit);

    for (let i = 0; i < mt; ++i) {
      let parity = ReadBit(errorVector, i);
      const base = i * set.publicKeyRowSize;
      let accumulator = 0;
      for (let j = 0; j < set.publicKeyRowSize; ++j)
        accumulator = OpCodes.Xor32(accumulator, OpCodes.And32(publicKey[base + j], tail[j]));
      accumulator = OpCodes.Xor32(accumulator, OpCodes.Shr32(accumulator, 4));
      accumulator = OpCodes.Xor32(accumulator, OpCodes.Shr32(accumulator, 2));
      accumulator = OpCodes.Xor32(accumulator, OpCodes.Shr32(accumulator, 1));
      parity = OpCodes.Xor32(parity, OpCodes.And32(accumulator, 1));
      if (OpCodes.And32(parity, 1)) SetBit(ciphertext, i);
    }

    return ciphertext;
  }

  // ===== FixedWeight =====

  /**
   * Draw an error vector of weight t, as FixedWeight does: take field-sized
   * chunks of randomness, keep the ones below n, and restart when there are too
   * few or any two collide.
   * @param {object} generator - a reader with read(count)
   * @param {object} set - the parameter set
   * @returns {object} { errorVector, positions }
   */
  function FixedWeight(generator, set) {
    for (let attempt = 0; attempt < 128; ++attempt) {
      const raw = generator.read(set.tau * 2);
      const positions = [];
      for (let i = 0; i < set.tau && positions.length < set.t; ++i) {
        const candidate = LoadFieldElement(raw, i * 2, set.q - 1);
        if (candidate < set.n) positions.push(candidate);
      }
      if (positions.length < set.t) continue;

      let repeated = false;
      for (let i = 1; i < set.t && !repeated; ++i)
        for (let j = 0; j < i; ++j)
          if (positions[i] === positions[j]) { repeated = true; break; }
      if (repeated) continue;

      const errorVector = new Uint8Array(set.nBytes);
      for (let i = 0; i < positions.length; ++i) SetBit(errorVector, positions[i]);
      return { errorVector: errorVector, positions: positions };
    }

    throw new Error('Classic McEliece could not draw an error vector of weight t');
  }

  // ===== Decode =====

  function EvaluatePolynomial(coefficients, degree, at, field) {
    let result = coefficients[degree];
    for (let i = degree - 1; i >= 0; --i) result = OpCodes.Xor32(field.multiply(result, at), coefficients[i]);
    return result;
  }

  /**
   * The double-size syndrome of a received word under the Goppa code.
   * @param {Uint16Array} goppa - t + 1 coefficients, monic
   * @param {Uint16Array} support - the field ordering
   * @param {uint8[]} word - n bits
   * @param {object} set - the parameter set
   * @param {object} field - the field
   * @returns {Uint16Array} 2t field elements
   */
  function Syndrome(goppa, support, word, set, field) {
    const width = 2 * set.t;
    const out = new Uint16Array(width);

    for (let i = 0; i < set.n; ++i) {
      if (!ReadBit(word, i)) continue;
      const evaluated = EvaluatePolynomial(goppa, set.t, support[i], field);
      let term = field.invert(field.multiply(evaluated, evaluated));
      for (let j = 0; j < width; ++j) {
        out[j] = OpCodes.Xor32(out[j], term);
        term = field.multiply(term, support[i]);
      }
    }

    return out;
  }

  /**
   * The error locator, by Berlekamp-Massey over the syndrome.
   * @param {Uint16Array} syndrome - 2t field elements
   * @param {object} set - the parameter set
   * @param {object} field - the field
   * @returns {Uint16Array} t + 1 coefficients, constant term first
   */
  function BerlekampMassey(syndrome, set, field) {
    const t = set.t;
    const current = new Uint16Array(t + 1);
    const previous = new Uint16Array(t + 1);
    const saved = new Uint16Array(t + 1);

    previous[1] = 1;
    current[0] = 1;
    let length = 0;
    let lastDiscrepancy = 1;

    for (let step = 0; step < 2 * t; ++step) {
      let discrepancy = 0;
      const limit = Math.min(step, t);
      for (let i = 0; i <= limit; ++i)
        discrepancy = OpCodes.Xor32(discrepancy, field.multiply(current[i], syndrome[step - i]));

      const nonZero = discrepancy !== 0;
      const extend = nonZero && (2 * length <= step);

      saved.set(current);

      if (nonZero) {
        const factor = field.multiply(field.invert(lastDiscrepancy), discrepancy);
        for (let i = 0; i <= t; ++i)
          current[i] = OpCodes.Xor32(current[i], field.multiply(factor, previous[i]));
      }

      if (extend) {
        length = step + 1 - length;
        previous.set(saved);
        lastDiscrepancy = discrepancy;
      }

      for (let i = t; i >= 1; --i) previous[i] = previous[i - 1];
      previous[0] = 0;
    }

    const locator = new Uint16Array(t + 1);
    for (let i = 0; i <= t; ++i) locator[i] = current[t - i];
    return locator;
  }

  /**
   * Recover the error vector a ciphertext is the syndrome of. Returns null when
   * the ciphertext is not one, which decapsulation answers with the private
   * key's rejection string rather than an error.
   * @param {uint8[]} privateKeyBody - the private key from its polynomial on
   * @param {uint8[]} ciphertext - the syndrome
   * @param {object} set - the parameter set
   * @param {object} field - the field
   * @returns {Uint8Array|null} the error vector
   */
  function Decode(privateKeyBody, ciphertext, set, field) {
    const t = set.t;

    const goppa = new Uint16Array(t + 1);
    for (let i = 0; i < t; ++i) goppa[i] = LoadFieldElement(privateKeyBody, i * 2, set.q - 1);
    goppa[t] = 1;

    const conditionBytes = [];
    for (let i = 0; i < set.conditionSize; ++i) conditionBytes.push(privateKeyBody[set.irreducibleSize + i]);
    const support = SupportFromControlBits(conditionBytes, set);

    const word = new Uint8Array(set.nBytes);
    for (let i = 0; i < set.syndromeSize; ++i) word[i] = ciphertext[i];

    const syndrome = Syndrome(goppa, support, word, set, field);
    const locator = BerlekampMassey(syndrome, set, field);

    const errorVector = new Uint8Array(set.nBytes);
    let weight = 0;
    for (let i = 0; i < set.n; ++i)
      if (EvaluatePolynomial(locator, t, support[i], field) === 0) {
        SetBit(errorVector, i);
        ++weight;
      }

    if (weight !== t) return null;

    const check = Syndrome(goppa, support, errorVector, set, field);
    for (let i = 0; i < 2 * t; ++i) if (syndrome[i] !== check[i]) return null;

    return errorVector;
  }

  // ===== the KEM =====

  function SessionKey(marker, vector, ciphertext, set) {
    const input = new Array(1 + set.nBytes + set.syndromeSize);
    input[0] = marker;
    for (let i = 0; i < set.nBytes; ++i) input[1 + i] = vector[i];
    for (let i = 0; i < set.syndromeSize; ++i) input[1 + set.nBytes + i] = ciphertext[i];
    return ToArray(Shake256(input, 32));
  }

  /**
   * The padding bits of a ciphertext, where mt is not a multiple of 8, must be
   * zero. The submission clears the session key of a ciphertext whose are not.
   * @param {uint8[]} ciphertext - the syndrome
   * @param {object} set - the parameter set
   * @returns {boolean} whether the padding is well formed
   */
  function CiphertextPaddingIsZero(ciphertext, set) {
    const spare = OpCodes.And32(set.mt, 7);
    if (spare === 0) return true;
    return OpCodes.Shr32(ciphertext[set.syndromeSize - 1], spare) === 0;
  }

  function Encapsulate(publicKey, generator, set) {
    const drawn = FixedWeight(generator, set);
    const ciphertext = Encode(drawn.errorVector, publicKey, set);
    return {
      ciphertext: ToArray(ciphertext),
      sharedSecret: SessionKey(1, drawn.errorVector, ciphertext, set),
      errorVector: ToArray(drawn.errorVector)
    };
  }

  function Decapsulate(ciphertext, privateKey, set) {
    if (ciphertext.length !== set.ciphertextSize)
      throw new Error('A ' + set.name + ' ciphertext is ' + set.ciphertextSize + ' bytes, got ' + ciphertext.length);

    const field = GetField(set);
    const body = [];
    for (let i = 40; i < privateKey.length; ++i) body.push(privateKey[i]);

    const recovered = CiphertextPaddingIsZero(ciphertext, set)
      ? Decode(body, ciphertext, set, field)
      : null;

    if (recovered) return SessionKey(1, recovered, ciphertext, set);

    // A ciphertext that does not decode is answered with a secret derived from
    // the private key's own rejection string, so that failure is not
    // distinguishable from success by the caller.
    const rejectionOffset = 40 + set.irreducibleSize + set.conditionSize;
    const rejection = [];
    for (let i = 0; i < set.nBytes; ++i) rejection.push(privateKey[rejectionOffset + i]);
    return SessionKey(0, rejection, ciphertext, set);
  }

  // ===== TEST VECTORS =====
  //
  // Every value here is read from the round 4 submission's own Known Answer
  // Tests, KAT/kem/<set>/kat_kem.rsp of mceliece-kat-20221023.tar.gz. Nothing
  // here was produced by this file.
  //
  // The seed is the 48 byte entropy the record names, which the NIST generator
  // turns into the 32 byte seed key generation expands and then into the
  // randomness the error vector is drawn from, exactly as the submission's own
  // kat_kem.c drives it.

  const KAT348864_SEED = OpCodes.Hex8ToBytes("061550234D158C5EC95595FE04EF7A25767F2E24CC2BC479D09D86DC9ABCFDE7056A8C266F9EF97ED08541DBD2E1FFA1");

  const KAT348864_SK = OpCodes.Hex8ToBytes(
      "5B815C890117893D8BB8E886F63A78CE2D5F58342D703348CB95539E14B9A719FFFFFFFF00000000F7066E0E5103160E7600FE0E0300C00F670A1A039A027B0B" +
      "33074D0281094F0CDD0BD40D9A0090012909AD043803B0009400C30FDB01F40468059F097E08A20F8F06B00DD408F80761006C0838058A0F5B00940F3A0A8105" +
      "C502E40DDF0D68008E0DBA0D55089C06E5094908E105B6072C099904E701980F6C0AA50D9006510DEA55B835A7A8A1335DF7EB4C22FCF003E118DC9822B31526" +
      "68CEAFBFFED7AB269AD98B69C26A40FA83B234DF1549617783D052C2D230B025774F07CCBDCC3404B7EDDCAD177AF7849EE75F2F21C3E7C92930556BA2AEE2A4" +
      "7D667BC34404EDE05CB299C046DFB28E0ED39CD8F0401C1986B5B3433E9891966FE410A2871463CCA3994090ACE9C43FFCC8E7620C580EA0C5FEBD724A6B59C0" +
      "D9A2A59B4ED36F6C18394C1C0991715E929D6FB69BCE823519FD999E10358BDCA6B72261EDFF2CC5F031784EC779DCDA1A6AF26188A70124B43754C4C4761FF3" +
      "0A0FA3F99A588C36C3370CF6792E79F8DA769451304237E6115CE33DBC908E9C522B75015F4A6E084049797A086AC0676121CC40F1AD3FEB098056AD449F1E4A" +
      "0510B62797F5CF6FEFA9B65B2FB580E295B43F274D872A17BBB4D0A7CEEEDDF91EF0192D6281CAD39695B4E54C85A2F144833040D64DF8A480A87CE9F9A1FCE8" +
      "AC4B2C3AA65CB176A23CF0BCF1109A916C2E7AD9FDDD782F07E80DFADEE5BD963F7A20EFC9092D11A7A814958E2BF7914B7D98138F84F708ACC899BA8EB58439" +
      "2B47F6B25CC32225CE734B43BD6FDA0D5F1C4183E2845F2879C0ADDCACCBC91382662B06A64AF9B807E11C50B5082703F4F0D800F46FA869712C4C5E40D13007" +
      "5C072B8241EE0C76C1809F137FCEE85BEF9902D9AFB305945913B928297296D81BB69C9E7863D15EE02FE253AA38B6C0AFDDC84C04E612CE45ABFD152CA2D063" +
      "3502638014FE7C2A10CB50BDBE37DE5A69A0A93D3DC2BCDCE1083D18AE60184D9320834276F1E1D5B5371C1D1E9902644233591FD552FEF21B64B9803E9D15D0" +
      "6393B93820E1314037EB0DEDFCE1447487F4AD9CC709E3EC101B8A3A137890DC433C3984AB4FBB5E1F5AB94C52B001F021BE9E4F066060B3E9425CE704D30932" +
      "522C6029232405D1CD5E0B88BE733638BFE91199D67948FC809DD8FDB0F567B99ACA27F0F8429EB01EA9C2F710973D69B9C97146B7000C147BE3BFA0C35BF608" +
      "406FBA0F7294351F92A89AF0987D5148140B1E1FC278C1A1AC708CFC535C66F796FB12205E61703A001D355A6B5307FBCC6D88B574F7D7E1B7B6399879DE3D54" +
      "F6B08BB362351804F2CE40C80BAC7D921334ED469D92BD5DDD2FA584B9F5CE4A999F032A888CABE4A9C86450FAFC4B2D3A03809A8E424707744E92536AB90D11" +
      "8016BD3DC28B1ABC8ABE694F628992D98C7D884691B6D03A9034819BFDFC523AD5F70425C4317186FE68795784AF73EF6513619058A5706E16280534995371C6" +
      "82D6EAA153408731B838409B96E4FC1F7645148CD34E8506429BE3080B30BFBAB51D2AC82BDDA8FC3CE3A2A7A18AE3E24223C13D535138DE51D9340C76E340EE" +
      "DBA4C89EF409FC1DEC780AB947F32804177ED27E17BEBA86ABD21059F80B7F341C68FE31C6C0EA070000585C1480A00CF6B5A91AB2E1CD9BAE0CBAEC9EF4E4FC" +
      "31D54785A65C46B920255D10235D70FE340EAA9CB41884929D2FC3881A330D698B6CA83301DF3F12C300F3FD13A181767917EB6758675531AF047719274C47D6" +
      "214B4C19B67FD1058D7F1C6848661E3CE5D3C2FB70A4411DA40EC1E33C102199E27E1476FBABB17D4677946E5AF997918276E7745D36AF2026B7E1B44CF126DB" +
      "3A576D04669E2F97D49D2938BACCA7D08F6BD8D798C1E7B61CCCCE3692582E3052D24A07BA5E34B483B659E48C41A785D35863601686005888B70096CF55B5FB" +
      "3E8B6385E476CB7F2E7CCB3E969A8A520526C8949CDFD0316FB0176FCA3E19F1B483B03787E01C8B00000000561ACC63A2547FB4096E6CC9009D9B8A4FA0D79E" +
      "EA372E063319CA95C89ABC8907FBC142C306D6CF97040F5A443F5BCFEFF19D84F35C9EC917C9349B3C6937EF813DA0C04826ABB479CBFA62E5FC63B7B7F1FE5C" +
      "87CC5FE4B3F3B3384D974E44B2FAF0E97621B584EDE5480B31FC7AAB1C7A1419E6A5F4C6B4A5EBB049A586AC6A0C5E03AC2E8039EE035B74D7E1E921A6984AED" +
      "3CA2C90281E8F0C22632DD1BC4768ADA1F1D666B1880488BF6D780C0AA22DD8363687C0B9432AB2CCDAC57D6AC0944CC84C7D97AB559B742FA30CA2C94DAEA11" +
      "18CFEB9A44713F6B2168DDDA98F2441023A65EC5FCA919474523CB07AAA8570B16E5E043EA640D910000000000000000241A5815C089890868904F3180A083C5" +
      "20850EEC82688EA3D5B2CE2139804DF814D498CB976991C629D6BCE68D11A79B40A897EF5AF9FE603D8D1103E77001917EFBC568402C8C5CCAB5CB5D4DD127DE" +
      "94B89CA4C09342C4F02A9B1D2E5E5516BBF314521A76AB7FE3EFDCB2B2E6BB5AD09E03EBDC08A878725828E177440C76106A28639938012C099476D879B47B12" +
      "749DD89AAB5238CFA1425E61BD31B103658D7CB50A62A3DA526205A0E62FB644057B086C1BBA688C3E6875A653D652669EE64CDD0E696588FF144446D05C4649" +
      "541AFA2900A6585FF2A4AD73BE50CDCED8ACDEB880F64DDE79765B85E593E8668E95834A2C5F74C70000000000000000000000000000000010C3209251549E71" +
      "23A1A3209EEE16846D204980A069BC8D486D85D8C20C056026B780184EC00D41E82E788D0CB08F485ACCBEF19FAEC730928924270A632F51FD0895B05F43DF70" +
      "1BC24340BF60C720D346EFAB7027F90F9FBC27E2525A55FBDA8A6D95AA3E426556333B18C8A20978139FCECE809E847F7469B0A031603C628B82702CFC739A6E" +
      "51FEC502BD03D366E0C9EE8D320206B5F76D6955212DD2AF4703FE0CF92F0F3479D53520C31D54818DA0F26D207078CC4A8837C02EFF568D6D1AF761F7ABF145" +
      "F970BA7548C0CD0F6BD2CEA342EE006200148214952F25CA53BB20066547D696A5647008ABFD2FDA000000000000000000000000000000000000000000000000" +
      "0000000000000000D24107020A8AA382C8541855106B8A18D57A26716444A6774C0121E2800112CC00732174F0833D34D24160590798050585232EE0B55810BA" +
      "70570544A42EF118811F85C59309B079C980E0B3C9F92C856C447903600662ECE87455CAC0B22494A164268A3968E10F48A3131AB7097D4E6243538872DCA206" +
      "D343F13BC50A8D47A112E53886890C9824BC6A784059478C279126C3EDCE409A2CAAF9623D50B16113C483C1162ED1974186B2ACF44A30629C90DC683A56761F" +
      "FF4E3F494A4AA40AF3690B34281D76B106B141C62EA78CB0EF0D0A706563900523D9195BC85960C9000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000000000000000000064AC588065E400044250303C082842C41882240C90222CA0" +
      "C87AAB6C48C20408221E291E2663A6526CB80B08D3842991136142085204000A8641658107601A927E83199384422AC807E3DD9DA4F831A2537989254B5ECCB5" +
      "3C439B030930246D2484D95C09200246009B0F3171F021A264127BB316481B2920F1915AB322BAB18AAA6748510D089C5099EA1FE15A7D0E80823E965C01C694" +
      "71831C22B6D151846CF87104D20A4219908BE081C2665F471DF46E0368859106161F225A842D4B34000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000D0F0893564412A13E621074D08089420028089004D236254" +
      "8F2EDA878028E75C81112120CCE009800020A01300E80272065833402095302EE9A3376184008192CB30D1EA282421C801C012307A9A204048491CA0C049C896" +
      "90414411600F2B20D560241AC1C0901014A33920B22903B902012BBE3DD210774054322C2D1698D5291ED7029025B0DD731EB44F3A325B05A8A404B04366D9B3" +
      "98A62BA384391436D057AEB29D043B85735124FABC11EADECB522829F5822BDC1A0847FF42CCEF70CDE9901E217BE489052D7403141E1BBA1137B84110B11A54" +
      "794C68BABC66AFB7F9AB4DEDC963FC7397ADC572794355C8B9B5DFA8C4FF5182E10FA5FD552530C5F4E948FDF5E45A0E847B73A2436FAEAAB31DAD172ED13FE7" +
      "07C9D1741946EBE81FE619C151FAE63E73BD91A503E97828748FDBDCC81D5F32F1ABF088853940CA16926FF15A1F9343FAFB4AB3EEA16D565F5A65F9D8DAD3C2" +
      "EC212F814F89D4062C58E1162C856485A916BAC9CEFA567523266017BB0562F52DF01F83EA9A8832F55397C810092A99B95E93488D791B3B0057293DE4FB0F0F" +
      "6E10D9BF023436F8486149645F3105F3E4496A2D53F04592D67DC5282B4BE9FF97EB5BFDE35BA44288256B6F66B1923F3A807676CB65227DC8F85AE2664B2B75" +
      "564B3CC2CCC4E2F187A92569B06F7994496F349B694D103BAB2302A02DB81E12C0050D8D1621D224408AEFC720B7EA4891B43A0290CC5318473587BBE42C9D2C" +
      "D644AEFBE88D39ACAE79B1223EF11E21FA8F353E1901B8B6D9528BD7A9006360EC1E15585EB7CAA35D0391725DC8CD30A5EE84E05BAE1CEF3199F0ACFE9D91FA" +
      "1A48C7D1C173AC1F811EEAD394AC384C99F7C3874AED5606626BF7EAD226E986DB5AB2A568A04C756C2CC0AF8B116FAC0975E3F441DA9350078EA08ADA1C2852" +
      "C315E262BAAD4D898F458FFC728FD3ECE008ABDA79AA392C93F3DF71FAC7B968F80DBCC330FC65F7746049390F182BC527E1F4A4C65B1C1E9D3B6AFE346287E7" +
      "5F6F3401B1BE9678C50F201DB08BBE4DDADF6ECADA84BFB20CEC15A75AB1C80E32038E425376452FE706647470AFDC42E2DB1CFDDC805232FEC6C35B3E04451F" +
      "CAB8730AC94783F0E6B41422AF7408FF7283B52DAA3344902BC87E346C116480307F0266AA252D19EDD60336754E900075E2E0F65ECB6A580CFBCEC16223FD50" +
      "71BAB2C57DABA25C7169568D2C6F799B2B560023C3E3B8E6EBB842AA2918E70211F574131ED21572C49480F0F452E25ECCBE42AA12C6ABC0298764D1360E8328" +
      "0AE2C512EF3E1ABD0C5119577EF840A62346C4F8D4F647EFFDD220A81396351DCA4969973A1D845BE5EFB22256BFACDD5218703326F4D8E78CAEE084F6EB58AD" +
      "27B743D14389040121D50E0B6E57DE4A106A898FD7CA17A2E304B0B8B66AA87E8235A87B0FDBD699172CE514DAC57DB90584DC3546AE0EB52DADCBD0872F9037" +
      "0E0ADA907341E45B90340D1D48FAC1B61F4A52E2EFF69B61123C90FB440A91C7ABEB5B9897271D2C9B349E8A3485707E69DF8A7B957D02C3528EAA2B8AD04BCE" +
      "4F7783803A8116DE726C7CE3D9E2BFD165A3F9A5CDF356A135D40EB4E6AF1CAF3A554A7FC2B72F5733B757195FAB7ED32A2B4FBE4EABA98F9756D5FD811444A9" +
      "FD93F676E19D10C316FD90CA3237104DF85270934348231A0521C8C245328E1E7DD3A83A76D7AC9F4B36F39F5970006E6806BECD22B5484E745C0C03F3F7492D" +
      "B188EF6DBD6F15439FBBF3C5732D97191B8859AF06F03B4EE3A3E69FB514B1790E93BE018F4400EA3F3CC8E17EF1EF9E4E1DEB75DDB0116953073B9E18E12070" +
      "8C90B96637B207F8AB839885D8AF6980CDD23861DE8CA5B838F5CFFE4640F95117DFDAC36C7017C08D6544FFACB8A2AF5C85EC6E1AC3E73B5B1CD624ACCC088C" +
      "9FEE169229C231D11255CF1B5F19CE2056728D9AB70D00119080323724C22EBA227425B78C4CACFCE04C2479817F89F009909AAB0574DCDBBA97BC3D94335B36" +
      "2E82295D92A4B230DB119BD3C0EB42E9BEC44190DBF876F34E5B57A1365FC9685A775F02F8058A1FDA68C8A2459709D5D934BB15E238E3C00FE8371E2D90ED1C" +
      "58EA9FDFE0F98136AF5C6D4F2FED9CE870157B2E32C023F9708FF640FAFB52D7242683F3FF21FB5F1E60FE995202AA9646AC3865AE09402F18A46B9A660CD39F" +
      "0FFFF6E6F95CE067D9A43443B3E3049B54D14224FF54FD911EB5B81AA8AE8AF6CB7160096CF171AC73FD8832B5D5AF031BC002FF3B0C37B25FE7F31469E6E19C" +
      "F9376E785AB0B065607254DB46F4C25ED74D57D68DF91460F6FAC2D707968BFD0BC9CC15CAC1D293CCF74C20D8E017CE10C828A4BC5C3410CA3CCC0D9967385E" +
      "CF32CCEE69D81864F35813FA145764E7DE1D1BB97FE922211D8D3641EF108D80994BE477DA2249B75359DC7BD9CC3FBF55436968BFCF61C581A890E630B11181" +
      "F73859E40D1208E98820D4D872F9D9483CC0513CE785F2FA3BABB24A7B88C172B6BF267A90740819598E46D6DB92945887BA00CCC78BEC83D77B757E3C4D089F" +
      "D68125D98631FA0DE3BE6CD9B16A3AE8A6061A6C743188106CB8A9A31ED504F97273932D5742E9DB76BC4D488FD85C6805C11C226CFB7CF7F15AA775F99F3CA9" +
      "D9B157A195BE1AB3217452388D477258E823C4D36E4523263CFB0E2F085E2C2DE29F68A3C43A09E0481FC701A203C48BA8C70027DDC199387D27DD43455CD37E" +
      "B3B654BFFBE67A0266C09C0148AE790357F46FAAED08FB03C3F509ED05B120B791939C559787AFBDA6A75CE4382C60A494DCF494D87353BD8B304E77DB4B31EE" +
      "BB8605D47813724BA9487BE71096530EF04F86344AD8059FE03AD137458DC4BEE2EB1FD32A54769463465549112C9B7FA4109D616289EA3CDC614EB33D8F5FEE" +
      "BBCB41621E8A5739E3603511B3E32A96D671C94B04CAD3BE22B9303331F1A0333B937F0F877DE24A3A66982D0407E5631F76A29E0BD0E71B83A72502387871D6" +
      "0D0E7DD8FA6A3F979E74FE1E88957917B177CF042274A5A763C9937CCE8C66DE38B5C013EF6A2A7D171B23D26B6410DDC0A65CF071B4D38E3100A409A732F737" +
      "2A7B8C8E0445056A88DE2CABF9D733DF7CEE2A0F37284AAD7D99499053EFEA142FE516C2A651F3C56C4C7A2459B81F2AB6414FED90C20F1A26392C2A353E8B14" +
      "19B47EF14C4344EB8B377C2F6845986225618CB6637B6DA22AA9691F81595EA3D13A535ABA35FD4B852268AF7EBF6E5EB40B8BDED7B4FA62EB80C5432FC2593D" +
      "EDF537B3364E877D400A8AF94F81EF725C638EF37A1F7CD2530565550ECCDCE37422D5F730F4D65964E98F7BFF242904751761B24C3CFEC019DEB761BAC4225D" +
      "B44FD757453C248F74A8AC5660C062FFB714CAE17F3D1BDCDE8DFBADBE29687A1224C2051BB91F7FB948FCB12A5378B72B8418244AA50D7C4A8BA578D7C5747F" +
      "F759808F4571BB29F3140AAF760D40E6BB06FAEEDFEFF5F6170BBECF01E42903C86291B269676C13E89007CA0FCF65ED802EB3CC65226D7913887778F9318B9D" +
      "8069AA6D4636F5AE2E5833851F7C8813440CFDC3FDC65297905DB0DD805E043A9C283011A84737C027B4ED415A1E74BD9859BE1E5714875480294B91035FD751" +
      "0061224953B1377F1C1492ED3C820E6BE5A8C0F5F460E5140C71D330372741849C374578A524CBD17D2AD528B7CF2830463BA82E6659EF932F8263B630E300B0" +
      "9DE444A3A3C5A787E56CB836BD952FAA8CF0341146077250B43CFCDDF4394E89C268CA9CFD18B9DDEA9CC969D0DF9EB45EC200B7B2888D87AF8A314D9BEDCD35" +
      "DC79D4146F0EF600591419F4EDFCB6587BEF0652E0CA118C5D99D624262807F8CEA82010AFF72C447505338AF4A9AC279D427B72B2656B6B762FF0E9DF73ED27" +
      "A1E65A91E8E8A7B6C221C4A2148837284D54D821BF408F0CEEFDD3F6E1C1FE1E5A4976EF78B7C96366D1F01B3236F2A16C53B322E66FEBC355F6CFFD18D95126" +
      "7A43103BF919B8AD6695CED909FD64BCC030E2B4E3B80DAFABA1DC4D4E69D70345D8A79011AD117776CF6AC9AEC20BC06165D805EB30844EEBA16BF8A8DDDC1E" +
      "3BD132FE0CB49121FAF0D9EA4D6FAAC5EFFB175619082613A9EB6B5DD3760A81E48C137DA4DB324E7463062D673A7055A65D37DD0ECDADC1282EB0073B8EE111" +
      "69CFDD1A4D2B6E4D4C97728AA66050AB98EEFFB13BBA6FFAA7B066D08A5CD1D6DE9BC2AA46E38EDBACE267D4A8F25C1969E718ADAB0F69EE0B453F527640A5DC" +
      "7D91AFBE26AB230C78A37D3F585145B9D9010E1086604A76036DF7178CB5677C68F27F62A0B01D757BABC4EDF3830655F2FCAF1C99A3CC535BE94DFB6C6A0422" +
      "C6E740F5F61DD09B59E9C49696F9B5FDE2AB541F89B17763AAD34F008CD27785BBFDDD69B77D0E57BE11AD8D67E65D16470AD31AA5C428A678F638968FEFFAEB" +
      "4D3A2ECB208B18F9103AA04A5BD06EECFDA8D465502051B76D5000AA71E608715C1E3CA5FE18E874BA112346A328572377CE503D6456AADB9C4D89ADD3AB2EC6" +
      "0070657E7B10F6F66C45415889A1BF69890627E244CE4902EE8748A83AC7D64CDDE8B23165C900E2F7CCD9D51C21C749975F9586F07E68891FB2AC59E92E5A43" +
      "79BAD7CF3B45E1E2C97400EA854678BA8B3A44150C887E82437F25724041E61D0362C96E0DDA7EAAD6388ADBFE7ABE654B85D872E4352CECAAD51F16EC381699" +
      "A4B1E1AD70EE8B296E08818259DE1F1ECFECFFD4E470D8F56BD9F83A9106C343DFC6901D358CDF815F36A24C88759CBCE0047578C0343E5FB5A820FD2ECF821B" +
      "952EFE0740F4FB4C2A8130539E19345C17395F0B5B0709E60AC77F4C8BD1CFFC4A63DFC3E4B2DE5BE4B6B5E1FC4D739B10736EBEEAD043F1563BE73A2F8D5AC4" +
      "0037A4450FC613E6DA06A42876159EEB27B269E1583DF82C9653777CB3DCA9B517D5623D5FAF9201BCF1040F29B4EE7DCEE4DBA6A3B1B786649669723E95B18C" +
      "A2AA9F3754E014FE20535F2E2501DEFF4FCAEEFFE160D4619815A54C65E37537AAF07C6ADC5B637B30FE26E45678A817C373B1FC8E560083F6827D6235704706" +
      "5A75C523A6668926A47B250F28D387804F667477C95D8D35D2A7E27F");

  const KAT348864_CT = OpCodes.Hex8ToBytes(
      "DEF61908A70A3099E45B4D5D91957ADE70F571D210D525D655DB7294515F91D97795F2353615BC7CDF13502181E5BCC8C9ABFEF31819D66DD2760363694F7896" +
      "02264A3E24445681A0183CE343A2264FDFF96C82AB318AE888D105D52D59BC1B");

  const KAT348864_SS = OpCodes.Hex8ToBytes("B4F9FF1E4390E3BE0BBCEBFF9A525AE83B191211896AA8786CE8BC511C9F78C3");

  const KAT348864_CT_CORRUPTED = OpCodes.Hex8ToBytes(
      "DFF61908A70A3099E45B4D5D91957ADE70F571D210D525D655DB7294515F91D97795F2353615BC7CDF13502181E5BCC8C9ABFEF31819D66DD2760363694F7896" +
      "02264A3E24445681A0183CE343A2264FDFF96C82AB318AE888D105D52D59BC1B");

  const KAT348864_SK_RECORD1 = OpCodes.Hex8ToBytes(
      "738E32AD8AE9E5E096273F288B2066718B22B329B6119E5CD91647123B50A657FFFFFFFF000000006C064D0F20094E09800DE407480B280CE303ED081702680B" +
      "820CF20858054B031B095305500CD5015C0B7A02D707E3027505DE08F70E5807E00C21056D0F760E33019107730BD70EA508AE01B20C720F0C035B01BE0B660E" +
      "010A440F410E68094809C702F50145005A080B093D08130A96086E00490BB001FF02680CF209DD09360C62D3594D4CEC02D579AEB697C981390FF52DB0FA738A" +
      "6E262DF522FCC3DF41F011AFF5A6407ACD8AD407246A5C47F9809F886E9A1A691E69140FFFBE474E5315C6987768183C7CC53C5795FAF6A3B2CC96C9038B4F68" +
      "786CD34C324C0EDFB8AD544CB5C37F51735EDC40D87EC68DB00C2ADBB5E0F5617A8051BB3538C1AB814D3EE82DABE3FEC81EDFB28E86E4A85FCFA157C7C6F50E" +
      "8C6C96D0A24DB5CC6AE2A82F8FC57117BDD07FBB65B9BA56D4666503C173DC916248F67CF7923743FF95A62E5F24CD199041AA0B804FE5661BBFA489448B39E8" +
      "CD6FC86A93E207C6C9DF0A8105DD2DD8DB504D2E56750F31883035D37EEBCFE61C8FAEF5ECD647A6803F4C6CC7683D6754CC32B36E4857A8590B147FF0774F4A" +
      "4EFE6DC0EB0ECE41766929E859E6BD9D248866219CE0380F5C210F8C634D7D3B21FA499A318C92D3D217E234C47FE7DCEA9CF18E95CAA8661EDC13A85D6CA3CD" +
      "6C0D4856E91D7C8B69C9BBA5EAF27E54394264AA6F1F11EAC2D375D612930A31A00E8D7362857508D3A33315A1741724C3F1266A152732E820E4A8FD7E96AB9F" +
      "AF53F3CF3147CEBEF6A7E768110798CE06D0A9684F429408962A205A712223492B6EAFAC2E09181AE5A485A598FC88E925DC642E09DF1761C5654959908B89CB" +
      "F29B0558DD17190446B28170457A20E569F403F95FD4D53E91F0B43B213B8816411C62DA078275E8A012F9F3F50301647E12F34B406AFA22171FA69BBAFD5E3C" +
      "7EA692FBAE20446008ADE1A2F666EB23B8F00E00E7F3E4A48AF82F9A5C01A2433DDE9FAA21D4BBCCCFA3B6650743952582F46C467E6C5B420F9DF3F86B84EAE7" +
      "BEEE6E7D706773D3925AC6E443772B417ABEAC4E9611D21FF0D30AB3A05AD97530D95CE89FE292A307469B68DF1E5F33CBE337D59E904CDF5F2B5E1491C90E69" +
      "C7452A04095ABB7F970133A6F224168C84615461233F6F1BF1C4B6D6033DDE2D282E52FF06B363CE0A183C9BFEEB36E9AF8957EA8E977D79A930E871B09A8515" +
      "0DE8A8566C12D29D46C502FB0680BE704C74C0CD14E87658057B7E6D20AC4DA4E162981A81DFD03A001207C2053E7A95AF597F56366CF030C7B6C17E2868795D" +
      "3156653B93C309AD2444D444B8E8B8F91AB25EA8598C758B5138C52115ACA1698CACF6E28DB2C0B5F24A30FAFA32931E2C0F89FC5E9EA3AE4AB46CCF5AA30782" +
      "31E694634248853419683DACE2B142D07639C3AFA963ACB5DF75993EE57BC299A514DCB2EBE9B1007F0AE72D73FCB74951663BC748A5931E02F06ADC65C8F4E2" +
      "EF26C5D65CE26038D5BDB9C544E65B97C66500CAC883B25E5E1E68AC56AACD55848E8B2EBD3BB1DF128CC23137939FF3753B2A7D92A8BFCA96BEE0622700F617" +
      "B14348DF612B7936FDF315A410CC10E26FA360F62A9ADE10CBD843302510F84342AE4A77147AD695000099082850FBAEF4047528A4090A557F63155773D4C913" +
      "D80D9277DC35191847C1648D19B62A8A6DE20F299B13ABF7C1B0D5469C34399356EDFAF52E03859A5A5F34968BB965525F12F85B429AFB5B2CD35E95D1F48BA8" +
      "F31346C7A0587A60AECEA9B50D17DDD15D96776586B1AE03ECE5E57B8204798BAA7E87856850B05FCB4519739D0B845F6B9C6EE8D2C0ADE88400F8F79F48AD00" +
      "050B8D3DB1F4DA2CF93A01392DC1FDE426A9A17BA729A4C826F03BF391639832FC047BE96B576E26D1271B856EA105050ACFDA662C95393A5B2BFA3E4387B9FF" +
      "905FC36A4B20489642D571A4A05F67D26A68EB2D066367A28CE50E20F6500E307833A7F3F486F913000000001012C4DAC09E3128D9F925412024C30347A7E861" +
      "2006BA59B3C967B3496EB068195183B8F570DBC195BDD0B24DE0C35586A8FF18EB18425717AAE48157BA6E06F302DF90673B2238D21C526C42BD653ABBD24F5A" +
      "8170CE52BF0FEFE63F1583C14952D6C5175C94FDE586D4BDDB4DBAE880F842BFC3F7AD1477555FD44AB6EDF0C1B99264E8C9C147AD2596DB5600A83B24581E3E" +
      "EC18D4B449CCC7D8AB9BA1CF44C7F09F685315AC31A61E99C37A99116901AC26BDEC96ABCDF09E8A06B23D93610858B8677332A494C778E8B247281264AAC7FD" +
      "BDC7DF5CD874DA602E111EDE754D157BC4F1667B7F35D40B78AA5D35E45213D6C0C28DD36A92277400000000000000004012A2A0028622D1CE001138E1D9819A" +
      "3ECB57993C5EE5831B22F6092630680712F67BCB1630BF89E1653D1EDBB40E6A17DD83657C098BA65CD0D6325C030F076B154C360A08EB0B642CB382820E3333" +
      "06110D69950930B302218EF1037BB1C0D091FF580F313934D973BFBD5DDA6660BC216DFFCBF9BBDB2EE359E3B7D79F04041FA69F7C02454A45C4CD099E42A196" +
      "B39017A85A85794717010B87EFB4DA96C3E2BD07CA939AC27C2C5F49AC37B8A9C36B46D047C117FAA86C8141AECED22FEB5BCB70A2263FB4E8A80B2637145471" +
      "670C96CA29048A512315B14AC9C0D520300B4212D39EDE69A89E50380841BF623AC06A5FD309B44D0000000000000000000000000000000010E0C3D8328B27C2" +
      "528C332041A84406064BA59833813DFD1820A0C843F7224E69AB0A223EC5A3AC51D2288E381EF0CECAD1AE9430BF1C00D84286CCCE0E23FB9205B875D19D3C28" +
      "23B18D7958CC39E2A80890B9B009F7C45990C8CC907D939042F764A8A3970E71696F2A69DA80E993025CCF0DE0AF25AE3438270D49438945B2793CCED21AB727" +
      "38BA0F0EEA8911629D9A0E2ADCBC52F0E315D1728F56E4FD2BBC82F3A141853E56C620144030B3DDD8A72FC9EB8205D83BE9912C903A24580D35FEEFB32392BC" +
      "1F2FDD54CBC95E5715948516CA5978FF6D1F7417D7F90D8403C3F35AFD1612EF186B7E375F2B18CF000000000000000000000000000000000000000000000000" +
      "0000000000000000405B201D0E6010265256F2A822D0C471E866401FCD250666D6B2D481040001A408213403140909DA1480D670C12781CB0EC90B834EFAEC07" +
      "04405087792706190310CDE894666DAA2CB50871329123A7C485B159BFABED0A1373B17809F840A4B644FC4C6CCACAB0AB4112470672A301810D11EC51E0329E" +
      "C4923B640D0D511C38CC98E8B521C08E290D4C0AC2847DC75B8063DD4BA1BDF71C38F4900FEFC8785EB4AC37F60CDE8E9B2ACAE0C43B9DA4768355338C25ED21" +
      "9547734B4AE9F53C2120D41BB12B2CC61C30B091BA0F4CE52B27E83D6A22AAD6CF266D9F2D82618A000000000000000000000000000000000000000000000000" +
      "000000000000000000000000000000000000000000000000000000000000000000000000000000005B714F8829C1780850307101425C8C3AB9004B015040358A" +
      "678101C00C8C18800448C034642921200322003420681A00D82BD84011C397903627603A2322B1D0AA4E68739C880A67820A26A74E8842199C20C09DC12894E6" +
      "803E768641D0D82A550F3215280A1DF27620A49111984781304802C5D001C49845BA0FFD1A52C34BD0EC011819CF8166F8B6A45A84940A2AADD7089F952DF235" +
      "0DE01F422923C9643159C35009B91B988452DC727C4D32DA0922058F011413889E38544A8E939D6F000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000000000000000000021290714188A280BA4564A020C901FB074864C2C72812C88" +
      "D4106E1388CDC009614201246123D1A1930024A66D6F54A434402B0C0C38400648D4E040500A03B58CF040C5218502218B802A029C25D5414014487106413024" +
      "30E7A418C30080006E8F9041088D819803E85141833803732230802006126D0030404352A465C02511179DE4DF25D4DB96276F61F3D146EA18829761A3ECD71A" +
      "B59828B098C178732D151EDC92FEC7B3AED688AD8B02D78063797F261B1625F0EF5995DADF88172CEF3571C973DC0D8B3C9BBDBF24880BF1D36A6DBD320561F5" +
      "74E5BDDF1004475647E76CAA6B4F687B8DADCA1137EDDCF627D20CE2ECEF22CCD03E6A20F4288E6376FA5273E7DBBB70325081D7EC06F958E63DFB4E5531A8D0" +
      "638456AF053C8D28CEDF2978F195120635CB371A66FD822F950FC0CBB6AD77AF81A6752B2057CCD922C1A51EC403462CC320C7EC9937DEA2B59432C85D7A17CA" +
      "0D1A4302EBF3AC833938F5C78180E9A46A41B9F8C494770D5CA4CE44C399CD0AA67F8D5E434F581ED0524275577BF162AAB970D28BCD9C2BC93A7DDE492A0E2A" +
      "64551496BD7FE516FE3B1878C12F389F281991E0A59E31AC36E22B3907A488B68F7A6DF407ED45DB0FBEA8972DAE018353CE8EB5500005A2602A768F324AC96D" +
      "07125062F9933ED17A03DCAB54D6B3988539277DDDE7F9218EA1FD9149C7530A1292A9FF78D72E25E9E843B6C0804484584FFC7ED060DB8087DF8351E907D3A9" +
      "C102C0C37B76CEC65A7D959E8F320BCA56607E5EC4493651AA3ABDA95EE996F062A678EC9743AB548E3F642C9383675B0DC641DF600D24B6791144703C69B860" +
      "F4CA6312E84D10BB0F77A394AC492BB52C7EAE635B79C40CDF6654EA4B2621340191FD835A9CF1E68B57BBF13AD989813B893675BE8F7847D79FFEA772B7E19C" +
      "465D0D37F33C953EBAC8DBC240C79086F5F4B6046B3348DB9E79B788194EEC34501248DAF47A22F9794F04438E37C82375028BB26E75E8AEF1C45212A2BE48DF" +
      "321C63AAFE3DC0C6BCD57EC4229718F91F161C7343837D373249838BB143554C38634D5DAED5CE9AAF45AE2F7F1431C59F08AE890C2C13D5EFAB28AC2922D9BA" +
      "56215FBE8AA51847EDB9A845A123C752B6E662E81F9EE939553312AD8817A2166B99FBB3DAF4FAB3F732DBF900139D3EA475F74A4CCFFDB773E46B86D543797C" +
      "698543C3816EBBCCE80BF18EC53B8B6E409088F6F2EBEAED325A81A434FCCC242B388105C127077333FD7921E374D7D252E7B9DBBCC045C3812F8F88116A00DC" +
      "98D64066CF9BA2AE1A2F4DF3A239E6F1E043D5024C122C1EA449C310E40FBB2A30326E8929D24FCCB4EE22993F96531959047777977E218F3C087E6231973F53" +
      "B4C362B1D147605FACD803AAC6168797C40C320C0A60887514C60F65B9B0EF1787D642A8ECF09280EE2B0CB379AC5A199C2409D2E42F3FAED6C79856A1AF62BF" +
      "E64165D339E8DA295FA8CB463185ABCB1129AAE02A424B83A192647DACA7E4A773F534CA1E5A6FF33DC0C9BA937D53501DED6EDE122D208E25521F5F6D5F66B8" +
      "FF54E2195B13574F009E7E2ADA7DB6A9F5C087F9375256E0EB0AB354E1684BB09B4623087ACF8150121D95E5F033607A2B864418E9F1A5BF2F7F1475E4F662BA" +
      "9C31AECFF351306994F3A1746A3BF16E4BF19B2F401C4A1E1079A643D5AB615EBD385FA3F3012176BD275FC31ED619CAED2F1074644C89632FF8AE6FE21B6350" +
      "23C8017F99B096F2A733B6529B6ACC4D89FFFAB4E13CC077D00974DC3FB18829B996B3A540F0B138F7059518BCE5F6BD25F65E8C428DFFAEB343BA4B2171AA73" +
      "BEDD4DCF68AD2ABC6F74742999147165209FA313BF35A7F26FBD2AB102A0CDEAB1A5BB09BC3BBB2558592895DE6E80876E96328035FEDE0F14326C883E7D958A" +
      "BE80895AE727EF1299B8799271A485B1E7AC90DEFE16C6D2636CA28A83525628E8DA0E8B33839F8233D27F1A47E3B3DC64B9FECC6C129AC4D8CC9D82E62C3088" +
      "BDF35964BE0362F4091FD948D5E707F4820243CD367C54C7F2239B1C4C775672BFA449B47A56CA119F6C26720B685B11CE053452F6DDBA20A64F4A0625504AF1" +
      "A945A6C1131D8E79713CBFD85974EB18CB54BD8C7B0FFE7FC2163E282270999D1E156D7853F29EA6C97C8CC6DA553E36845EEF44278C5D119E36952AC29E51C1" +
      "F908B75FDEE54D1669F15F49E814326FFD9ACA9BF2D7C5906796018A45F7835DAF50837B3BCACEDBBEAACA56084C69160578BB3C87F7B44C7985FB87CF92C403" +
      "A93B09637DF2BA12C381F3ECDFDC23D1D0E5DFD63B513DB7A525EEC2173CDADC0A2269602C3C642EBBDB841FA0234F141AD672500EABA6CA2162F4C03944A1AA" +
      "E4E5E6FBC2D2CC399AA68A0F5CC2E2C9F57D2EE5DC1FF90F7F67CDB7B339D0A1A8D119782CFC2DC8DBD26EE12460A29F45592359135DBF298CA076667B1F8394" +
      "6BC5E8F7418947D5FD7E03FFED4C163CBC82CDAE24FB1F91F4A23DD7BD27AFEF401837C07E7ED704B40F61DC10B544DECD9B9D6E4D3F2CB7160D0056C1F503D1" +
      "1CC52845FD2F8A53D59D5AE69F0A3D862E2D01D3B99BBA39AC34805BD334460DBFF155FF6EB1C691BF24FD611677804D07FF5C34C508B4A58761A48CE575337A" +
      "5B8C14FC58090FCB846BB48CE826F84491A7336BC37C8CD12D9E33E9768FC1ECB337CCF3C06759B74E1614882A0C5ED921C26299FDAC4C8522C0A4799BEA7244" +
      "5468FD6314900B99A13713DBEEE7D3E05A728394B999A5EDFDC2F592421BAC2B61D1E27AC1380FC6508299E8398968F08212E28CE06DAB75819E5E90F13389D3" +
      "A5E8E67DBD288FF168BC1744FD6B8D53A023B316E25F13E5EFF08AADA3FF81842DF45D23801D8714FDE88D89E8E8F7184C7E0F04A62D965A6A0660BD19B14B9A" +
      "1EE9ED16F085B50F08C1DC1F13EF07821DFE8899AA0A3475954BFC7196B4D0AC696E54ED6D6EBCDAAC5CF0080C85C071723BC3C3CF19B083E52712013F72661F" +
      "B4E1FF850FA881B93CEC291479861B9AB6BB450BA6FD2235A9447DC863E138FC017822AA71E9103F22419DE4639201C127BED1205BE1847FF5670D89D4F7DEF5" +
      "D56D27610242CA893D6E3141745258621D5FF79508EB8B6B34E4A6C882F24ADB0950232B7DCD6C8314607EC35101C63F716A59B36653E70B1EC50201C0C60B0F" +
      "5877B5CBA308DD6BAF0D2F60859730D8B8532A4795D9889C319E1820E63BE8F681EBE951DC2A34347A43181098420064207E55C1180BEC48B164D09EE82D21F8" +
      "DCE95B137A2CF0A27026BA6EB6153BEEC9D6CD179FBDD288E45971D066063B0211BCF988C692D8C9751ED34A89083003C6131DE5EC8A5DAE8EC69F1EA3873C89" +
      "33D49374AB95C7D7704ADAA5753EE73D9864F9E32981FC97006D38F69E2FE4781CF104CDB5D887656EA97C2A332DF9B93A059E6481C8682C8B37A36229177A0F" +
      "9E94735CD56B600BA39F16C6B49761E03F92A75A40381600C34A7F44C79D4CE640808C5CA9BD155D833FBC2B623A1AED7EFE1B439E2CF7F468A45AB23E69A023" +
      "E6EBE076982339FCEEB27D45A06E2F94B560C313A20473F80F1CFDCC85205EEB33011E244F8C0B9DC14FC033F18C363296BBE9AA4D2DA8006F1C17F3B8421F8D" +
      "A283CA087C6EB7B05CCA0F3237D66736AE6249761D2DCA631999609C9C99FEAFE82A1FE59967A6199BD11BA1215D227FBC1E48ABF0324E49CBBEEB4C519410FA" +
      "D3C48BEB20097F24399ED35752DA4B4D93B04845903CC3529CEE1973D3B3A9DB589A664885AB430B87994748541DF9F19AB894485D0F18FE5E865286CE370CC8" +
      "167819ECE875FF39C320ADEAC9D424E4E6D7799F1C5301E9EEDD1955D349EDD2E1D658ED58E515087F11808737BF26F2304AEF49D6109D349324A76A6983D37F" +
      "BB24A891AAC95BA70486182E37AC9A4FFBEB56467AB201BA1450B4258F20EFA38BF591C05199984EAE52739215EC8A3C959CE5A486F22F963D4C6BFBE9214A46" +
      "A2AABB08AC1F63C7C5DC06D0EFA24686EA557F0454CE9344FECB6075D87F0502396F498EBFC9FD9805087A6A236C105E497D96B6E5DA930419762693CF3A9E59" +
      "BB8785D3406438BE514C44CBA06FCB7E96EB20D8D391D711B384F52E49ECA5BC12E854C0E2BC0936A3109740DDFBA2272D47B7F961260642F8B79B4C65D31A49" +
      "E62B3EAB57FE8BD02F5709FA28494402E4F47D4557C43E9A38278EB4BDFA455D9466BCF7BF93AE344DF9713C7C845A5FDF8F4DF7EE719F83E6A4A439752DDFB8" +
      "F1AEE0CE1C83D264D4E37D91300348DAEB7A8328DD61ED67094344AA7F39843FE16F670AE6ECDB8599A42F310FBA013278093458CF3DE6F8037BDB08AADB2BC1" +
      "9BF2697FC749180B4AD043482F1C847D835370D2EBC571C2778A473B118D7850A0CF5570263963C86E6F82D94DDCBFA55EA9186316E66FFF7EA1980272292BBF" +
      "9A35BE7E9FC38326897F7D6878A377FB8981A046A63FC6258D92A024C27DFD808FE3423FFA46794F0992F95E681F071424B7D6758C76923330E7C65E86BCF8AE" +
      "96A8D8F154455488C9F78959DE71B7E8D50C9C69607B01ABCBC6BAC2C46A111449381960BD2C9C58C2C6DB25922D42DC6C015D74B60A12F1A6994E7690700BC2" +
      "18972666C23BAC647CA19588951DD72846A47D1E2D1E2A26F0CD280BAEB3E02FBA2DECF40AC9D15C2D4C8A12DD4DECA592A5B38654C5FA75A4AFEECA856ABE33" +
      "F0D03E08825F6729F7A521F0DC8F62FB4824B6484AB9AEDFB01E81CE3D6E9661927A23D2089ED110D691540A49FF93F5F5BAE929C5BCB31BF28A57E69667DB4E" +
      "FFC3FBD744CF79E641A29E7E817B58906635F28AF62AC8D9297193A44F87C7FD7F00AB9ED833CD1A7F665FA40A8CB5EE828FCCC665E82CD3200F73D7E77A48FA" +
      "A6094978A7D5C159128D1D0582B8608E7D078501A5397572E8E582EAE2C76587398362F96FC09FDF1CB923FA9026265BC84AD1D0AB31E20DF1C7C86771076EFB" +
      "A76DE1BF4FCC35EAAEBDF6D355A6CF653ADF5C6DA9C752BCBBBBA624B961FCED48C3D59259919DBD68AD647A0946B4340684B9B8D5C3EFAA346E9787E3293A5A" +
      "9A4E424D40E8AE7AE52DC7FB9F8171794082B28B59F16E5CDEA665E5");

  const KAT348864_CT_RECORD1 = OpCodes.Hex8ToBytes(
      "A5137A52D79E86CD997FEF78044BBEB21DA57E32FFB02203549757FD7D056FA8C66CF8E7D311F34C67AFDE7DB9A41385D6CCFF7342A772BFCFA0F2921E913C8F" +
      "1A5AF5C10EC33A2144938B5EC9863B2B8219D98763FC1778B733E6B2F577AC0E");

  const KAT348864_SS_RECORD1 = OpCodes.Hex8ToBytes("6A6694846BBEC86323D49A3A44DAECF33889BC705A1890973831A1738BF3CFF4");

  const KAT460896_SK = OpCodes.Hex8ToBytes(
      "767E46D32BF28588A814EF76821455D00F29C723A6971D392B269626131FD97CFFFFFFFF00000000A9002C0C2A1FDB12E407FE11591D5D05C002A80748147D08" +
      "07085E0E2F072F14DD050C0FB210C213CC042A0DD004710EAE0B2D168C0BF4007B03DA0737057B0E50020E05E110C21BFE0643141E110002880F5C1AD61A9B03" +
      "C7077A1ED10EF512BB07FA10481B14199A02990F620B0F081A137D1E6900F9112312BC050314FE0E1A0B610A26025A1D19016400050C44064104260095025E03" +
      "0C0EF2068B0E061C2E12D80A2F17D80B4309B8114600B5030E0161105C081605AB1085101916E10050A18AEB87B7FA8C89583120CECF594EBD187B1A56AEE5CC" +
      "9E72543B349613FCC04E6924EE9FA4579CFD8587B1F3ECEBB88E3400D181A0DADB3CCC9B7ED884F3D6B462D4ED897CA5136E5B9668371F5F2A775B9703CBF2E9" +
      "863CC086E37635FED01BA1CFA64E4B4C47DE9DFB48D635C57C0BFBF38A5041146B7C8B6D4865D21A3BD77F25823DDFAA4FA212005A2FF31D2D9B2ED2D1D2D4E9" +
      "BEE34DD64B6F23C8049E190EF46B7EF19895D21B7E7944D1E3AF50F0D168306D5EE2B1EBD3AA45053B068C07113EB082B4F78E9690EE9D460A007DDA5F63497B" +
      "59D492E85959F67A1D4359D679F73AED21F8DDFF5BFC5D53BCA8020189611683A97F3F8A2624A510614393B78B421DC1866B17F4836420F3337F078122709836" +
      "21CAA204101E9BE728A44C894E880FB900EF2681C2EF71333770667F88D17A63D4CB9BE15080E4A74A54050CAD361E1A73B2F43FE806EDF231FB793645CFA368" +
      "4A9EDF08A41632033BD368C9821F61C95304DC159E99746EDD738CD64A2F91CF8F2F104517D2871ED9D6CACDC2ACEEE794E459673EA123CD35F643FAF61634B1" +
      "FD5CA9E6F803FF3856D4BDFBE368E59CC7A5E758753539BB78BA249E64E5E60598545A2AB6841DC393B80BAC431C1E42F535167415410B5F389FF9F9519D7240" +
      "F5524F691621BAC84DDF14F4CFFD0BFD81B77C62179D171CB9ECD5C4CEC24E5F20339DA3D16E99D58C4360A8FC0FD7086A954BE2CBBB68516048B5D41ADCD8AD" +
      "1F2AB4ACCA1483E2E64549078BD3C7AD09CBF34CC5545028AD8690F5736852278AB2D9221CCAE3BBB27514E198A2711850B2820677BE9163721E52E4E2FF92D6" +
      "766B1A5ED37A2CCA0A5B095692E85E9F692ADBF257626B8A212BEA40EAD2815DE0E66DF217BBB4754D39D897BC0851123A4456DD47D6705AC574A57E25F14712" +
      "CA0851AF917EFDAEAC20A3C55CF1D8A028C909E715642874392C2FE2079B224234D845FE75BA2B8B6D420048B7801E06131ED05862F0D6814A4FFAD0B4539CE4" +
      "CDA87EAE618D2FE1BE9DD547B92C408CE011045CD233B469795FD8CBB7CF2E1308D6F84FCFEA14C7744A0CC7D7BDEF06C9CBDF4ACE185ADAFD29CBB55EC0F065" +
      "C8BA812ECBE7466B191095B833DFCAF8AA477149C215BE96212AB39EB837950528416E8BD36DEB479B52584DAE3053B412D8D1C060020EAE7AC576AE1BCFF2C8" +
      "3829C56422896F19CCDA0D6407F412C32DAEA5133D1E0E8419FDE5C8B9710C946B1054F9E018A15F59A1CB9FB46BE3787C806D7DD9BE64D00434A3F5F814EC47" +
      "B9882EE36D15A5C9FE726174532654C843F97C70C67392D9BC2F11BA4A30C49E738853635F4B52A2DA8EEC158DE92E69D7CFB8522923A585E750B50201848503" +
      "C6BE0BC2FB35CD9D752D7CB0AEC30A848EC1D7EA20044F3E6BBF598DF3FED71062F915D79B7A824FD0D902703A7D97983D33680F935F27EEF89FA26C391FF52C" +
      "0234FE11B9A6D04BBDF743090D05D55F7CC7074BE8A59D4480E0A5822A112DD5386E95BBD2E6FDFD4DFF4CCD53A3471C57B4D115A2919BEFCADEB6936671079A" +
      "D324FE5E1AA85F2C1E87BA853E802E380400C807785177BEFD61297428263025AFEE740E3FF2F6892166380CFA619695AF996C5639CB55F54E5D62F73572CAB0" +
      "84ACAE84452F167FCBA5386FCDC1AB46D903F123F96F365389990BC051C44F8F351C4ACE107B2BD893D21B9E8198A1CE366DC5FA90E6056A3516DBA6AB8F4C5B" +
      "95A0726693A6754B7B8C1B3D82AD0B716DE260134B48F8AE5A8CAEE13CF2C0E8107E6F7126F1412B3B55C5B5FE2FF5217E646783EF14A47ADAB629F9148DA96B" +
      "D9B293D63BD5BD75669957C24317511F899C65E14D9F044A0779ED074A20FE5D0D5368D9B1E2E094ADFCB0FF61BCE86347634248A1EEDA8C9B5BA3F8FE250297" +
      "9DF95C31207F1C21B6C6E068BBD51AD5093EF59BF137F8545C8A0F99CAB27EAE481FA10E1D13F44E83CB619A83B1A3DAAD1322484D0F143852166D559A1E9CF2" +
      "399164D5A54E0637ADE8456D95F869CFD0559389EF3661F9CD415B2539E808A76685CEBCCE1F5181923160CF6E3D76DB46341BD92D64673E2CAAFF20D0F2E0BB" +
      "A0C85234C599B6C554BF88BA5634B9FE8A14437A54DC701B84E57E5D53E7DD974C6F620AFD15455A003FC422A4809ED3F146B48CE87650032B555905048D3B0A" +
      "CD104696D1309D932DEFAD13351942F02D09F986A4970AC2BFDC3A6B04F5282B9FA1485D57B48E30341AA2E43584C776F9283ACFF513DE6551824DD4ECC21B53" +
      "4091313E1ECFF10AB61BD28C9815EF8E480FF1CC1AC59DE4BC7068DA66004336CA206A96E1CC7699511037E7A2AB588D07A26401DEAD34411C0AEF8E8284CB86" +
      "2949929F52B66873216BFF40248C54566ED79F6FD38BD5F728FC54756DD3B0CD92E0237A18AAE973D1CF79F1C7817B0BC120E91EBF98A833E5B44E6C9E38CCE0" +
      "7B6FA13C290B5B7EB02A1D9359C7CB3474EE67CE8555096D2231B71F5CC058E4A7B0BA4292BA10650D7AE58CFC44DC63D9C68FEE233B05D53DE05B2DBAAD626C" +
      "87C4DD61FA30021CFDD47087192CEA911A473FC0531D549768DE7D6E9590CBCCD55810389CF4F18972F25F050B51CC94C29AD07D58F1C85CD8D383687609FB72" +
      "05A98AD62C8A9D7143B83528987ACEFE0081E6C0284EC3799007BCCFD48F8B60ED753A3BB079AB6529ACF111E719F077C68DB265A60A288617B7F7ACF2F9D721" +
      "717A132328E6FBF8CC212D063E22EEAFCCA6E165133A2D76ACB15A8ABEB404FD1196536F4C7192C6BD532352C9F0D26E1C30DC389CF67075C838CC2FC5F5C7FE" +
      "3FE76D7A51D69E304761DBE79CBAA7D49CD0545B4FECA5250AF1AD9BB0BF81AB189843EAC9EB15DD0000007231A4CA09072AF4FCB48062B242EC08BB830432C9" +
      "95F2C4A22FB3BB87FFB0C63FC60FC3939A3FAF2A91900A87C98DADD8F4AD515CEA01C58EB8EFA5E5E739B5924CAF54D8D7E253BCC54211CD5F69ABA0C173A4B6" +
      "002FE95840C0395D725C0394B1296F956CC22A085E5F1ED25BC45AA8EBFB6C7A25B16D8D5B834C8B09D1221544E113CFBBB494EA86694D89ACB619F86AC5B637" +
      "71B90E7788C5CC357EA2B4FF49849B586EA4920A99C169E8F129877035BCBF26DAF650662602BA47C23F6FE98D0133C0B7887FB6D02B9444DE553C0A1E6B8625" +
      "217B19736BAAF4754CA812B5E542CC54A47E0E7CCBAF7EEBF0F7F4725195FCFAD1C57DECD2B99D548C34541587A70BDADBE6F93D2E0FD5A03CD91EA52EFED476" +
      "A089F6A39BA3BA99E7ED93B06210C290962A33062C97EFC83AD74236C40F93130AB5E2484345ED265E9558296C0D981F2AD75DA47F22F77A270C5FC956FF3ED7" +
      "82CCCA1D551CE6E0F91CA3A8F3CBA5267FB40D01C5539F402E3A3567DA78EFB1ABC5FA3E3B546DDE6BC223C3B450CDCA008FA422F7F2F7257ECF5CFEB045167A" +
      "EF7071459449D9600D9DBC237F2729614C92D6AC3F54351D7A3CAE3D26F80233A1A1787F49F46ED82E3577247464B22D7D989B7C71F4971ECF50876D381C4C5C" +
      "472B293A266733971D287C2B0EC5FD559AFFEB74178E4AF93F0C556F6DA1615B6B18D449200B1322000000002C93453222D6B14D112823841AC44AEA11E57A37" +
      "3E8FCF0F38178ECFFD80782E99984070103E0924D49483BC32DD901D69439D32430A5203D635B3E3FBA629E7FA063DD7E3843475B07A7C9805784E74B83E498D" +
      "D5D5A22331C2065EF5BBE9B3541F925D739107DDDA41423D70B4646F8BD3DB59DC987B6DC4321B4D4A14C5859A483617175A9C95A326035D413E29FD3360554F" +
      "E7E8BB593471C4FB74D8BE09712C9299035F4C4B8C8283285BDA2C1356C13B93FB1C2EB01715B1CC850156C033EDB3525F1B1ED537E0DA396D093D81A8881918" +
      "DBF8B28FCAA22C7C527C6104721B7D3FD93A9151FCC1BFE9F87B5432EA619034586FC3D43FDF9E1DF5ED66A9C7AD2A618597C127E31500A2F44826F8E5520EAB" +
      "0328AE382A40CBFAC243023CA5610086EE198F2D0F2864AFA211A81D8233386A90F8C8A05D2EF039303A2CB3778B890CE2E90F1B25CFD33F123C4FD2556E77DB" +
      "D4C6D2E7254BA25089BC674B142D652CF29E2391D4610013A3AD7917DC5B63CA84A99CCCBD717DA0CCF00CFB4D7E4DBDFCBE366FBEFB645A0DA7A696BB0C7103" +
      "9A654708501C858E08D7B01FB06CD4F95AE132A8B3BFC42090CB3A1777C2C3BDA19005C643BF28A8CAB75105EF7283A1DC26C1D1928B9ACAD8E695F6668EC716" +
      "4E0FC1094FC37E2B2723ACCA6BF4E4DD6BF3B9DEA35D4EBBFF68274D8C298E3903A3B87F852BC0B8000000000000000084426422C1A84102D52BA56424095942" +
      "0BDDA2491A1936F08270329521644852A48828C53674CAEA967DCF5B73E6A2E1E584ED0CD41FC785507816E1B9928B78254EA4C9B04D3FCB9317507ACF6E4382" +
      "A82A05D9BF3990AD803766D5D38443AE75942982A9AA6FDBB886137544870A95E4D426C241972E6210551C19FD422F5CD3EE3A727F3C14C59694A9E817E9ECF4" +
      "2E52F76B4FD1038A25C84D52238689B9528F895BCCDD5DECDBF1A011DB039D5D831598A8FA2A8FF90700C59CFD6DE8AFF4277763CF15AEC8E4A8518FE11BEB1C" +
      "26D4C0F3E9DF27936A3224F273477DE52157655D8D17456E96FA2FEEED4C13FDCCB9193C7D6824A14550690198E850375C1D6BFD7987AE5870A8A15760F07A22" +
      "7A1E749D94299A39C682E133464E346C441EC7B56373597D380220D1D147BBA9492DD644C48879788F16FA4A3D786CD454FA1A14725C430E37F8CF20AF258AD3" +
      "5588C243EF42F621DEE53009C3E3D1B1A9BA441D5AD789B179BC8E8F48179F93607C226AC683D3190C9420606B73BD2E80E0534D522161D869F58413E615AD70" +
      "0474B9D0336BFA96E78BC9BD9242402C0902EAA4AC3B897B2BBB1ABC7A5CA8D759D17F3000428DDE0E68153DB8AADAF2ED41ACBA5768D0E5602E27C8D9BDF40F" +
      "516B02BE1B4DDAED6E9AE07651AC1E31F00B8F954672951B1897D432C0C34D0A1102F541C4BD2B30000000000000000000000000000000000EC961651089E20E" +
      "31B0445615A22E5606FE96828C0E38EF1D3F0CC344284B81BF94532E8F19DDFF1C9819D1115208B18634E53454163402AE2B2238461AFF091C61CC87DA0F12B7" +
      "016E089C1B86FDB818AB8DEBC32DE238824AF3EC6459435915421B0BFEDBEE4382511BC243ED0DA885B32D00073B90B80BA0142AA3AC2BF7E8BECD4D8912EE95" +
      "289701CA2624A0E90C6134DE9129A192B9BB9274D9CEC3E40FD91F5B1A6E8F8152B243684195242F2653D04F8D1C2B1B16C5184CB247BBD5F0C03AADF9FBB303" +
      "94F614C459434BC310CCC58D270620CBA5470647EDD0AEA0142809E243B5ECB312C205612541406EA5A26CA446601F695CDD5FE0265A95AD210D85F52788D383" +
      "4A58AF2EB339B9CBB325813EA7494104C24D3CDD94980E2C64E6141E97466F9F4C12E707A9DAD96CA893642FC3F2F2626E56D1A7E8484D12537AED1C452540F2" +
      "773020DC43C9B61A1C45E258FD52EA680494EB6AA15EE75C35247E5358BF60FEA41EA221203D75F339CF0DBA3ABEA4970A3F5DDEB113607D276D3C9EF164D6D3" +
      "18D681B761ED6B2859B838079BE40CF9D2A171DF7E272BA87D0883E88445EB249FA521F1DB9E19FE60EE486E52703130A144A7A0C16C3CFE06A66BA5A9FB119F" +
      "FA2E9196BCD341B237FE848ECC5E0EB66669842C2250721857F107C2F3A51AAD1DC458C00E14A9CF000000000000000000000000000000000000000000000000" +
      "0000000000000000051778241102A42367395031CAA44A5010140A0E0D1C811392A0052B397101CD84081642885824070020FA3661AA6024ACD800B15EB01057" +
      "BE4CB1105C27EA3284266EB414013CE42111F7544003418692279EA08AF14110EC9D3BB51EC8EA74638650204424EACD95AA05A628996BC17BC440AD8A40A681" +
      "9EA051638CA209FD13ABEB1854C29F066D70094211068491548BD4A287C88803CD804772CBFD8622DEF04000AB6AC3A3A2B14079519D18C89B4594B402630150" +
      "CDA43678084551864F96A9127314E452F549554B22CECB62690583E09936268B4F959E98C0976C238187D290F284B1B634120A47E520D673C7E782066F326870" +
      "1D2E122D33EE33D52B0ED3EDD9B5E9855C7BF149AD81D682F516805AF81318F709066F142A234BEDEF8CE06ECF3229DA6F3C62DA1E7A66FA35A7A312C1B4A1E4" +
      "17069F066925979F8831FF7EDC0180D2EFD61300F3DF96A3F36FCAF19DB796804AF9BBF87ED1F3172A880C271BAA83BF6BBCB48C518937402817963AD478E5AB" +
      "B78C8604FB3681B748A634463684A41A965BF42C46425D8D3C68350D4BC1CBF322CE2DD5A6155D56FC6A45147934DE94F62B084A3798B808C05262BC16381D44" +
      "58B577B3525A70B925117E8F0513F58D4AA046E4A51A130B0BE22874719F882DE5F013548009BFE4000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000457504083A2BA346A8159472F80C511E0B810884480B498C" +
      "106F4114BC460C1B5C00608054463504E061842076298DA0CA35B4A5540414590E030048120829C41D762273A083628CBF28C1C8499F044734818051B1A32004" +
      "C71E019E01AAA743628B542CD3C445CB49C48F0002B48013D9EB1AC6A444D082644D56CC02A377C44DA9ACD090911072700113843CE70E4B24811A96234A7398" +
      "6746118E300DE4508238DE12C1D843814B93BEAC06E27AA86A659F540D5D347B8094F411976211ADC491034AB5DD8835605C1510631C8A5E3135729FEBCA8D75" +
      "10B0432215AD0379892C895516B704FEE629A6289AC7DE2340E5DEEA9552676D46A34357284B2C0A911F83203E0F0B866200673E9CC9E3B69D84AB4120AF18BE" +
      "9916C239DA62F207C04742DCC7B29896439C5C60210C2B753051844820445F19051D843E208B983695705C55EA052DCA98210842029B2ABB1DB2ACA602F1AB68" +
      "E09E8C5114AC48AB31C664290A43A41A2002370278A8EAA4A68A7B86E5132AA306D473F9376823279D129CB5F545B00D37D13DC6610DE6E09D113B08D5D444D3" +
      "30266A8E196FB02AA2904D273F85C9EB0362712C350927B514A25C8F11D75608F259D2E62C1E8040000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "000000000000000000000000000000000000000000000000000000000000000000000000000000001010251116080A8A09341834188CC281E00392969329C205" +
      "482000849469422240B0E0580800B10AF016A82473A10F4CF34179D1660C4806EA01244273764144050C00926EB9028C18C066041C499200003A1583B03CEC02" +
      "994CA86C2883008303334E03AA400110822684006041A4D58C222021000E01548401AD1E25188A881220263F1B781E0001AAEA23DA9BE670874D061A60A19F70" +
      "67AB521AD15FE2936EA0AA9000DCE1320243034B11CFACA0589E2526E0A114DE91D5C04F20F54302464531D50A29AB03BB41026202EF34ACE10320A0020A890E" +
      "5B0439B684282802BA0925CA605400BE39F60621CBC6EFC86D35FC5BC1F893B0E28459530661A5A41FA7F2C400F198692612241B6D698680906300DDCA17A0BC" +
      "D9CC90017561CABA22569E5536A4892F726A711260BE4714582420152956144E0094146427C8CFC4A941B667B1A52438A16E76D06981D97E1CC6852E94E33901" +
      "29A028C624A461BFF1D020C64FE22A392884B7B04E8F772140A4636A8D1D3F50D0E1258420CE7C3A000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "000000000000000000000000000000000000000000000000000000000000000000000000000000006085D9406C266F4605228CF50A622AC200A0886192920E23" +
      "90022FA173209C11026E14B00948634134408F8C20E29A65D0665556FBF08CC0248A2F17FA440064416C5708069B00A5C9084002C015180901A0C22855498000" +
      "0008F1102BC026A3CB0204FE17191A108150D4CC002499091924324DA40E9523A644C1C3200C44E3508C85E008084A2B0B563558420C070583AA364432D08950" +
      "65784A243440D4B53800605DCBA4B51580C5A06141223116531402443B40612B12A63B53C0322808151AC867644A245892802AA4941080EF2000446019958469" +
      "4BA22A0B011E449812A488985868202830CC05EF0136BA10A00B310113A7E0E240A26000555509563093A46D07FF8BBB9067D95B0A333434727F9797B06F42BA" +
      "1EDA0F20BBB3143F5953AAAECCB8302A8A0B25A85167F857671E2E201030AE39CF526018CDA6C1C6444097717CC0A0E4FE5376B4C6410191ED9855FB1B91F2D7" +
      "47745F5C405BC130D486848937AB349E63C2DDA8D4BEB67E7933C308DB756600D141DE4F9CE1A75ECE2DBF2AF994B1300B78966907AEEAAFCE9BECE982B49F7D" +
      "F5238EB52FBEC2CE036658D1B0AE87D176DAA03E33C94FE318D90EFD7F67D6461C831DB79A793010995BE7C3097D37AE6A9C86C01828FCDE93A476F3278F1EA5" +
      "D328B5B739182AB37E0DF719C9DD4D342027412B2173083B8E68BD938FC3ED3F12E30E5DFBC75BC2D13E7F22E8C0E45DC5D034AEE1585FF279D22BFE2E945D09" +
      "A8D520C7480BCA24A6ACD75E77D05BC5B7C0CA06B29D06BA91F07BF6EBC751F3B8F81F2F335A0EBA39BE48DDB35B5A5323888492281E7BA8D2269FD5C4C835C4" +
      "160CA603AFBC6E8B1BB5227720D20F88843B23654ECA6FD5C65DFCE775BA9BEF770D3FB0F96FF8BD1AE010DE606D7A9B30A6A932F57335986D25DA247968160C" +
      "125B5018D85C343BBF1C24AE7B4A308EE0271053482678B4EFAC0019803F2B6D8625A2C8468F892DC6E529A47E83C0579C3339748EF0493163E991135850FAC8" +
      "28C2CBFCEA67754D69A13CE317B7F75ED8D9C6C48644B20C71A30E807C2414D84B08F20C8C12C23408D1D80E06F23F89363A9F96F15E531A86257CE8B9458DF8" +
      "5D51E839C3E2E0AAA49F74E6A874ED247234E090EEE0783674ED35926625B211D9FD11C22CDDF115530CB7B2F15863C986EF2FDD0636ADC055BEDDEA42AFAA4F" +
      "8BAFA13D26A6B9E56542100635166B752FF4F529C90B0695D0EAE84482CB679517243945BE1DE592AF2F7775F1A512463E912C114ACAA82D47C81C89623A7F52" +
      "99F179E42C9DCDC4705FAC4C934F05FB65824B23958569799B16E862C18B488026AFD0815DE29345338199ACEF603210AFB9508BFAD96E6893A12E5EB998DD60" +
      "0413B2F8E500E33C46B0EE81FD98781184E29B29377292558D620CED44013F62930214A2EF0360E1537446C4C04C0B5E40D49A27643BB251A8183E89BB22BAFB" +
      "5A9FDD7DFF39B0E5DDED07634D4011858DD4082B32159C77A66CE8DA3E8E6EB6CA2D4470D017DA16F855DC3F065D6BB85B236AF45DF6DB1C63D6902FC3705066" +
      "61F14BBA36860ADC371B9695E1FB626B7D80A31243B87668896F68955FC861921A38419925DF499066906B9B89D2BDF72930AB9BB22F3AD0CEB3C87778079445" +
      "52D84733A187868EB9100C1A9C2006A4609AA8C42D2EA0381F2850C5BB0BCB43454CE7D8D23C35C473F096B0F96AD44C73C765CD4254F9FF9CA107944897BB68" +
      "96BAFD078AE5D9957A7CC8CE4264E178C3B220224DF51CDEA3D62431EB9C0BD82E57FFE4AB6DCA2B9A8878B4D397B7CF5A72F1890A35AB664605BB9C4322E07C" +
      "FE392DA9BA621F8BE5056DEAFB7DDD6C9BC04D79B807488E4BFCB16798B75ABC3EEF4BE82AE9F4C2C1FFF22441D99B0D6AD0263DD0A81CD92BD41A0AF97B1123" +
      "202D825D84ABB7B64661C770FEB32013F36242DAE488DF94A868AE4EF879EBEBDF8F0DAE6EC7BEBF7FC471A90628A71724B44A00581D110EA6542FC36B900DBC" +
      "2D7B65BDF0C31DEF465A5E8227D679AE802F9A1FFBA32D6DFEC2365130896BD191603A27FCBBA8135C72035421ABA5A5C1A1450E3D9ACD28D3FBB3B5F0FCD737" +
      "22BA710B7CBBD01D7AF9D0ECD131BC977A5847D054A0AEEA36234FE477CBDD802AD7FB7EAF65DF956B9907FAFDCB55EAA1451B8B99D08ED24BDF5122A3DA3FD2" +
      "3FE3513260664C87C8B731901CF82300EF8E00BC25336B1B1B4CFA3CCD9D22DF27F28B73F858570E4450AF103800BDAA4F0EC89BFC69387460B946AB1B014E13" +
      "7E3A9F528FA94399C062CD8001610B63B1FF1F925457338E77B60112C12B175E00EC97E4346196FFAC8461525B0D5289101DD143F10478CE06D615D114A23D48" +
      "01B0B987F5E3AD00216478DFF880487B185561BAC6E67E37DB1B997988B51CA30D64CD97B1EC0B05AB4BAE54016AEFB71E37CC779B3771963949B0A64E419AE7" +
      "14CF12D8F2F2CB5D1425A9709F6568956A1C235358C2CF2F5258BCECF192EE8589C17FB0D69E0332DB7F5F26E03F9021F350D19E33A6305A4BC9C3C290EDF54F" +
      "B4C7C66A7ABB6B8636BF535797C8C06FB48DE71AD1B15B17A2B448E35E835DCD0ED78CF687BB023C9564879095B74C0CCBF230AE5A340EAFF0FF90732CE7B786" +
      "84C09153B9FE663CF18FDA87A545AB537CF4C7128F4EF12313BB5126696D2CBAD2741203F945558A39E6A1002761BA9651C7701957244A1B9AEBE73C4A32DB1B" +
      "8648F2DE1DFE95A7F46274C16FB106DE008F3F94A15C145B7CBB0AEE4B8B3805EA84A6AE6E67952D9CFB61FD8632CF34F4B8E694050BB6DE86B763E356760845" +
      "C9EC0D841F3554F99A5A1B5EF8BA7025A518361E10EAC8ED66C43B00F19F6327217C1103E82318C2111A60887CAF5E6E0FF56D7B28BD7A5EDCE248930170BC7E" +
      "0448E4B4D742063B05517A23CC7DE0D4945622ACAB207ABF76717487A09979C0BA8AD396C9FD6F7644CBCF3D22390ECD159C97C2269C4A71D88D489C8AEAF4AC" +
      "08ECD8BC8F423F062FFEF0A650BF2A6E48CA17237AF31DB7E26700C1AA45E261B5D3B705A3FC2EC847749F08E58D09C246CB2F854C473FEBDE29388661582962" +
      "7D6117609B5FB3CD754E84758BFDC9A977C5C9075F68F669CEDBD0FE279571343E8F389B5E4CD3F1DE22BF6A6457A8E72DE7FDCB6C9D619809150710FB13A90F" +
      "D24027F1F94522E95CEFAC3444F6C3F4DBEA47E1A4C157392AE39ACD79EB6FBC31B8B49D3359AA76B3C25C9B4325B5A3FF6DD17BB75365B68FAD488D6FFD2B18" +
      "ED11FDDCD175C8BBA305CFB8CA5B826F40AA091EEBFDD5EBB315193078D93AF56363FFFC46603E78AEFA8C1BB3823533E0B01C964018CA5AF27C93A7D86BE6F1" +
      "E655245C3203935D44B7EAB29E6D64C6541CF020564DE84390627CD1749BA410D8FD4E7DB0C275A78D390CBB47F2185AB2C5ECE127FD01181EA336FFE22872B4" +
      "467406FA02148B8140DDD03C7C628C021D02F34EF3A7FCBD3A4B62E0E7944E456AAF3F1D4955AA3F4E666B2B38BE42F91302D3EFE241D1AD591C3A4283AB821F" +
      "F49313A22701D38729EC99A8512F0B48B9DE143DCDE536F0DE33414B25A2B17D9BF9366BA18494D4DFB3D35B7F7CBA209EC6DE6886A4F0921D1D37BA8FCB5A89" +
      "5FEB62A50A71A0118EE7A56A246D4CDAC98D1E734A277F8B39DAA60ECAC83A1D00BA781C9320391A17D948281F307BBACAB2959BC9AE5C74BF6931584DADDD5A" +
      "5D2D9601BE1A72CA17010501B5ADDCA32CD1D4CE14742950D838A86D8DE8752C8F539640229E2C3FF1E9021998B6A7ACE24D0A901490B8B38B08263E6CBAC033" +
      "341D038A728FE830C1BD4890EF222463845951A99884BAD1D152C867A98E4AED1CFDF3719ADAE94D1AD94BEE315A2E9E8908459E152BBB6538863718ED880CCF" +
      "65CB302EEDB861A7978DDB6E3FC3BB7202D6B68257AE855AC92A0FC8154B785A34D80B31331795981C4717CD8F5AC1CE8B2D22108DBB1805FA749D8247FEFBF9" +
      "5C973E50EC1ADEB3274A005B9540CD5A1C78FDEE44603CA03375AF6A348BDCCF808AA75994F87DA0357D0A83F61FDF8BA9373D8635C10C9172AC98B91CF0E81E" +
      "ED457C657FAF7E95AEA6F54BF765BE5060DC58F7142E229ED54AF42FAEB9F73DE722C7D0BEE063FA7F6C4253516B356782B4212D15B9A531550D742BA03B7A57" +
      "80D477C514F5016B3B794CF8B93DDB9D1DC4E95102F67F71EEB5EC01725039952B721303182C8DF0011F318956B4DC58C9DC199DD8B3DD32CCB2A8C34FE0CB75" +
      "DF01E7192BF54439F303760CC00018B99AD31180F552F40D686B11D7D42F2F616CCC0C04BF0A1613D1FF92FF6695623C517A3F3B08A0114F237489602EE88981" +
      "EB798FD3BCFA1B47263EE7D26D63F8FD32E8201A22FD6A03F17DDB48C8DB81FF1773DA3948FA1AFFC4249F830C7D6D3177502C45D00E056B718B3F50F922E390" +
      "A5F18F4229DBE65D1E622C5677C2F260F3C09EE35FED1EAFF5BDA8C3FC569962CE9E1B0E7BF7E76B06DBC599F1C8787F73B043626B852B692E205B7F6B3DB5BD" +
      "DC9A91211E9E448B24E9B562422CCD4640A22BA3A76418235FD17A1EED5994E340658D6C794909B3618C1C2D4266A194A381AF61F4432D081A6BCEABAF2F6C21" +
      "98E90E88437B29D08E39515196F82E28615AF8844B4122D2CCBEDD5547EF7A1FE25EE76A3244D710D8822308ACE332FDF130FBFCA653BDB09AC396E35EFBBEAC" +
      "9A452A09D317F8AA9ED849B7110A617AB38A539B77B9FE1A863393C7AB5B2AD47D3D8BA5011FE4C0FF446578DF528B561EEC427052111943EEE16D75C001A944" +
      "6736B1D26FF6F0F47712DD86AECEF96A207120BBCA8599169480513E9E54051CE88A1731C5C6A344BA6F355EA6C3FC798F1F89C9002D895AD11A2CA762C9BF0E" +
      "60B50F627B8CD7AB5598F0FEE8651C72B42691A25559A8EA26806B6EB7EB3AE3133EC72FA31EBD3F701795133F8B1FA8CCA2C4E0D5D2A417A413C552E3AE1657" +
      "2A23C24A508FCFD294D2D83B0AA4F1D2D3FE11F837E8D7F230F76DDF050154F149A6D23441802525BC7E2A6ACF9E7088DCCB967BE90ADA89084C773D02034265" +
      "B8CD1BB55A597723C3755174BE91829108A684D7F1E55C45A0BD0E22C8A0C7F1A8F42CEAE2B9E97975D4E22C1420244BA23C85E2876D8F7EB584E32BDBCC9DB2" +
      "1C23D1A65B59FD7C9F0E48D95210A023E7439CFBFC7A87C00D7BDCABAB0C640A4F7EB5B3A34F50F3407B71D03B4D14653191AE1F568CB3970505BBAA5CD1D1BE" +
      "F1999560759AF7B7BEC3A81DAB97C2E71CA2790362B18830CB3FFE473B156343C0EAA0EEA5BCEB2D1373BBFB27C983AD17B71CF14202941987FA5FB79C6A0171" +
      "5C92FFCC5418484AA2431820B04C443987E858E3E46383CE0AF36DDF534B9409F42494B990EFA6FED2AE7E7A32BF61C57F5905D84B7BEE2F3DCD5B2B592B5386" +
      "DAADF6252A97E21AF1F3326D51BBFBC1E8A8633DDBC3A16FB5631E80617B72D06350D74E5BB50A867E78B14962F18DFA7F0F8EE312CD44D6BEA667E6EC18059C" +
      "686003FBDDC05FA66F71744B48A97D7E07988AC44945A79D5EAA7022661FAFCD85A38FD56E1A6B419F950F2EFEB2192D92050BA461E152F66A8201900FE7FE26" +
      "52F1D3714729C9698A73C1B143786EE6133ACABC47D1F24F52518BBCEB8650786577010C11CD3F1BE98647E1028B63F5A3DD54A3AC05C7C94C8E975424FA01FE" +
      "0B839D4F6B6C7760134BB7BDD47D4C1A4DEAE3DC6DD5E544D4D9AE336639DD32439B38EB1592DF46EBC0704922D680704DBE2DEBD85E0A7D6D8B17F7E1C8EEA3" +
      "D783EA40128FA44F1A910949A1AB18C1A27294B4558B557935D0D6E72E31DE57941C188D7B5BD680232A0C0D89FD875DA71E64E42BC346A10F9605EBEC845A19" +
      "AA28568800CA53FF16C330E76DD6E269888D869997A660BF040BF3A2FA6D34F924AD6E0A93976CA74614B8545409867A915F2F63B81B0AD3FB24033DA67E64D1" +
      "EC77CDD5EB9AA90F44C14638C95F85064B33F345479D5AF4A03189B17E3D303033C989CA4B3CAF229709D9E8E5DCD6141617F76366470C9391C0581179B439E1" +
      "9ECDF9FA93D58A47E013A359030F6B5D3203EDA26E07F3D9ED7CD363586B2AB31245EE8DAC6E7715CB722E1363E46988CE21F004C1AF10C051C72993CA5EF28E" +
      "8E63D14DBF31E851EA6211612D81967D792FC3139B006A29677B71F1586F8743622850F3ED4922C884EDDD524BD79AB668F18AAED4111434B45194527F71A921" +
      "CC30C274AE8EDEC0E24850F410E2645FF8917949B0CAB2AC05BE6A0B852C45CC86B3026DE37878659860117FD26157BDBDA224B60321CD21A62C1E6E846A0B8E" +
      "B52CADE3F85C5868B6EE82AB451A1CBF5A63024D285302979FA7F3E699453520EA416AC28BE33EEA6C76F5FD30D935A2D07AC934DDFAA6993480698C0C7508D7" +
      "F4CD18D050E193B219990A1294130A7F16E0AAB886EA540A04A2EAD33D7D3EB77494CA79F43D9AB75DB388FC3B27D45155DA92361203DCF9C79B7D8936FBA5D2" +
      "CE3C41FD4ECD1524B377BBAC20A21FA183E2AAE1FD26D51BE065A15AF946ADE420555DC528009D1B97BC735BAD1473380A55F9005F3672E06C500C162D26EF76" +
      "2A0FA0CB33A3A00405C35EB456710085A0C3A13EDA0C610AB9ED5D4239A2171D971B7FB312858674920B5EF97F031D4816B2627E2CD22A6C6DF4BF7AA3DCB173" +
      "7786622926D0FA0B99104B769205D2A88BD65A5182CEF5F479CBF126E7CA96B618E659F5FC5B08E7EF3E7FD8AAFDF925A4037A17A2C786940269C6206F301813" +
      "EBE4FC0A64251DB42DBB5E58C0A30B9F00424783A78360F5F48D128600913DE5E5CCF851F55161404A08A8675D4A93827CCC6F6CCA5627118919BAA8F0FE8F99" +
      "9C4E7511CEE36BFBD7DA78DFBF3AB723D3B627CA8478DEDF0E3226DDB342B3DF28830785B2DEE6075290427E6F8A8CCE3FAE0C4E558F7DFD6182246FB5D52C2B" +
      "42AE996FE9B5B784FA84D0D821FF60CAAE65F210239929B1D5235686778E3109C65E83D919673E288EE40021B0D99B9DDB64CB24DC4805D73107182F6D28193C" +
      "58AA07A0A30D2F36606049EBC28C7BFA397B3C0D9CBBFF5496CF6793FB7596EFE5BF672C1B1B9B63DC5A5762C5CCDCA680017F47DAB93C25808366D2969376DA" +
      "3FB9F80B914CBF41F692BF92A040D59C9400DECDD9C23B6924E7F66D42A68CF470442E2D0B7CAE20A9637C98B94D438F4980D4CB5D53AD9A31E5EBF6CF4A1A63" +
      "6E7ADC687F0B26A315EA8AD0D148A0B8020A04373F8BE68FAFFF97469C540AE69F05816772B00F76666ECB0AB979B1E3F34ED1F9B398E8D8640BD6CB51C20A2C" +
      "8317F597257E0B44B424B3285F08BBE15195FD4B96BF4533E76BAD4B1558387FBAD36B9E15F42B7E0D863B84704EB34B8D0D575AEA9895311258BE5849E4E58F" +
      "0117FC3A4C494B922D14973E5B463956F6E1DBC9DE275F6AA0419605FD84A373FA236B879DA13F87015BC6ADB6FF296A458012AF39304E205FAC6D7EF70C5F76" +
      "255AA8A2431CBFEF98501F7D32CFE701EC7DFF9CBCD39ADE395A1102453CB7AB2F7C6B22F73E40D74927E17F0B38250E8904B6311D960B3E5884B82889B8A5BD" +
      "0E910634713DDCD363796247EA92DA10C06BA0F2C2516440702F848F80EF1DC30ABAC9884733368D2326F16E2B4A1D929365ED15A32FA93C686C1427088CCC41" +
      "BDD0089D7F12BD74B0EB0DE5026A19989E7427D7ED251354F838D2013BD97CFD5D37A83B8220CADBE66266D03FDAE68DC84C83AD37AFC8D3E42503530CBEE416" +
      "C5A91F9A1F0BE04DDC021B29F5469E7454DC402BE48522B027584C6EEE9BAFA99562C299FE5C8947B3F7FE8EDF7730C79C77B38B03BCFBC3E98CEC6910CF93CB" +
      "E27D65CD639D362A25E0DD46FFEAE949DDC257D83783A47026F831CFF279D64329DF8922AEE43FC373F93538FD0EFDE6416FF5154663AE24992376BE7DE4FE06" +
      "837A0EB92F69460D4F08EB74ED14A17CD92B99E4FE5ECCA04FB8E5E6393A801BCBD980A97207A454DDC15110CA16689EAB9A938EFE3442FBCA25F7C04E05D3D8" +
      "3A1661CF391E75F26B063A404E13B0FA25E071D3B85135CFCF7E8081AEC619CFF0B859A8DF6B20964F0423B736EDA5C6F24FB4E73E239D6E7C0F6CC8E07F1417" +
      "A72927253EB2277AF912D14810B42F1C1D720C30EB4A54F80FEA2E62129ADA464AAFC253610CDD3B3EEF3B1493065715B8C0800581FFE9B9F15BB4B6DB4BA0D8" +
      "2CA0991296D85B6E49C21411B17EF600617D9071A0C80CA28E20F2B39D7796A609BF118C44B0E09B856555FBFEEA6BA3541AA1D90B969E072C9C7A6897C3E54B" +
      "BC5152408A2CF718F906EFED420AFA0B5FC56314F5A6F067734A485B5D028659C027870BE930D4F5B2D48201D9FF32BE292BBA31F1937F966D5861FA3F989A16" +
      "6A8C94B0CE30D4DE30A23548AE67FEA12D10C5FE9893AFC4A71D7402CB521FCFCBAF17A14B97EC50C5E27403A117000FB9585A5463AEAD0DC803F1F18970498B" +
      "2C2825EE2F5409F76286C023A2DB24F212D3ED3933AD4636E38CCFDFDDD0505E4B4EA606C87C396046E73A39517F0F0E51C82AFE0D2603AE3C24CD858FDC19BC" +
      "9C594E7D51409FBA832B1D6EFA2873420C7BC487DFC5E5718A74CB8CACE1E9BE3F2DDDF1909237B0DCAAAD149E68DF19B78B7412B984C4E26BD2E136275AF90B" +
      "8642244781CE0010C5E16F58C7A9D29BCF38B99B872C51CF92DB354EFAF5B525FA9F543FCC3CAC0BD2238031F6DE21756F37C6BA8A4101899242BC2D6448654A" +
      "653ADE6C9DF9756FF9FBC249F28B8EA04CC67205D0594D8EC1BECC40F2B9CF78DAC3BFC8915A8E65439D84762CC0CB57EE4651BBED6A960ACD7AB36EB6F34EBC" +
      "4CE4EF8DD839BFB8DAD55FA51E65332BEA4F721D3F94A91830D55CEBE31F948CDB8ACFBAAD6FC23C75BB2327DAFB972BC55F38F82722E0B67F0F12AD7A6A763D" +
      "C23EF0CC17570E07C6155550DD8BBC7D6C228D683EDAF3E827977B46867AC52EBD149CD714DBC04DB602708C9425632ED0C13691A6D418E5723E1A8E014A0102" +
      "0DC4A21B65CB3BB471AC162BF9848A225118A1DFE9DAC3ACCD064EC6217C96B0208DCDE32B0BC06D9B4E8056C3FD0A671DFB35D89AF2E2F53C2AB8918299123F" +
      "ADAE4C234942A193A43B57E0C194451971181659367CF1C2DF625FEA9ECABE0711077D01907BACB0FD598C24B2E00F8A427EDA8BE1885CF89DC5BB05FA10F30D" +
      "E65745E8F9356E20BF1ECD3DD42D2554C15702DF7723B8BF146BA2A0E91D9A66C38673E1444117EBCDF540FD30A4F1B455B0638CFB8CB466C1428526AC7A5E11" +
      "EE6CCE59ADEEC9690264F5F0E49B94F1FD6CDEEFA06536A0176A696027406CA5B5926AF19BD6F23FAE2F87376E5A8BD00E68A69A28DD9779B2FF79447A3F0037" +
      "5F552AD77C5505007C7D1EF4621678F54E78B0A81CB6FFBD3C8FF2F6AC7CB07A86B6ECA660F1A1E8EAC012D9F1CEE7466DCCF948A4AE61D5072CF4B5470758B1" +
      "893626B0ABAFDB284429B7F89549BAD42E3C0099473D9230E21359FB96939B49EDCE6A9EF4D79D81D38069AC5F06B129D2FEA78D4BF6ABC4FCCF6B253332D5A6" +
      "5DF4875B73AAB318B220D0864FB8A06CDCC81443A5175D94F31F8415B34EE328CD6B9A89747DB0DBAC38E04AA236116856CDAA27D2A3F57837E1C6ACD3168596" +
      "88580D03987F4B6599F5A892ADA5647E06AB6CAA8B89FFCA231D49E3A195DAC846F88219E7F85297FC0BC1EBAB258189D489076829E55915DD6AF5348F2249A4" +
      "EFAFE11B083EE33E2EFDB77D7A4482D2BB935D50D1AAC1138A266851D3E2335E0CE3759637BBD9F251FBE52DEEB9A7BA9AAAA78D46FA2961D6D3E959C219A6E0" +
      "157325AB009ED2E92CEB9BAD0D2B4167E023659147C978316D633DD5E446375A98397F9278458AB81550514C2A98412675E32FD833E5978AC36A48B2609AB1A2" +
      "3C1008F3F7E94176D5767C8CD2A7DF5659C6A292D5E79334D6893E53391A535FA1FB94009AB49CF2436C43A88E12EEB03EE20E4CB4D8DB15D5DE45B3B00ED73D" +
      "29E175635D331A01C916314BA06C35E42E904DE5D8BEA20F076C28825D0DADEFCD09AFCAD3BC0CF2C3CD4663B2EF276F698CEBE9716967805BA02F58078DB72C" +
      "61DA8D6B69FF2AAD2D4EBF36E866EC604C7DCCDBC4ACD87ED9624B0D97CBD0849D026469B30FD48EA6C3BF603036AA01C85874FD4AE0CD5CCD0564E8C94A419D" +
      "2B1325391FED59F1B30626C8F093272ABACDFF70EE29D8A522112D2D6FAAC61475F92552EE56E2DEC4A8E86A27F7A86C4AF738C62E2F6502A229C006D8B90A08" +
      "2699A0A2B18FB84339055443EAB1AA660304C4090FE972BBA703279EA228E4374D84793792F7BECDA3EFBCE128AABBEE5E416AF9551F53DC6CB7FDAF79FA0D44" +
      "BAA86AF4979140BFE8549302F59C447551F0B5402D8022201442526C2B48E23448C5C215E70E8B49A138A987E5CAB858009C54B651D94E6DA6D051715877E2D8" +
      "1D226A4F15621F221AD0BB93C9C50E82D06BA3AFBB5D49953C8B5EA3CC072AF3F6B95F05199B4BD1");

  const KAT460896_CT = OpCodes.Hex8ToBytes(
      "CF78C42A38795E0F5D6BAC38ACDEE6C4C9536F93BCC32E08B8CE0B886E737AA5AD51CC0E2E5B9176B67F0327EA117334DCD5664ADCFFB39F1932C498B210A56E" +
      "B5C9E9C7C5DB03DC46C5D2450D1F05C152533BE30AA544F20FF11CAC1FFEBB919D69B033642AC0ABC1C174AFCBE9F22433A5D3E2048621A7982CC08D5D9E37BC" +
      "65ABE96DF8A651758894B6E58A34E42CB82798BE3FD7B3D96DE27E65");

  const KAT460896_SS = OpCodes.Hex8ToBytes("132D477D0C24306181C6AD01590D39BE9B2404ED32CCBE0EB1F169680212CC1C");

  const KAT6688128_SK = OpCodes.Hex8ToBytes(
      "FD1BF592A954AC3012BB9B07C8947E5708BC44B74FCDFFA99E9696FB55E004D9FFFFFFFF00000000810B331F491BDE156619EF009D041F1B49054905880D440E" +
      "090AFB0D2007FD05FD110E07E1132B0F021EAD17A700B40FBD1E9F072918590715018802DB155B126105CF11A5038705FA08120ABA19751DCC19FE16FC0B871E" +
      "2D1F5F14F70B530E02177313D81E040557164E192419E800A2188F148006CE19031AAD104C06E817E415AE183512EE1D9616860234142B075F14CC0DE203E403" +
      "650F4D0C2D1E171032093C1B501B531E35073C04881E0E17E1163412EF1F65174514E115860C0E165017461FA81D191A4900B60AFE0CF71D6F052A045512730B" +
      "A715760C520F0A10EB16D2181E0705014F0F310A5403470E000ADA19EC01BE19280C04167A18FD1548E0708D0720AECA5606AC711C2863817F7575C990CD3C4C" +
      "12D8E251E6A04E0B888DB4A3838A6536CE751AF948C6A6970CBD1CFE420AA834F1558A6F1A524FCD4CC37F7467E74EDB4AD0557111CF371FE0EA9D0BADADC777" +
      "473AF098AA21A0E065CD4EABE5D8095DFEA6C7A848DE8CD6F1D6116369EB3055DBEE8C3F63FB12FB0B334785767DEE58632835CC34BCAAAEDAA689AFC2044433" +
      "15478A257ED4C4DFC732BABE8FD874841782286F43167C7CFB81F95D48DE3B27744BC0E7A6F0914D7C667DC18AA1258B259C9EC01F346848083712C5BBBD45A1" +
      "51715848026D10714E7AB3D57F4F472A660B0544172E837E49FC4220D840549D1041E592EA68D7A6F6EAA45957019112321BD5BC4A27E623B01E661A1BC493BC" +
      "340AF4C3100769638C4FC56F478AA47FD3A6601B72074CC203FFA8DD50DB1AAB86958EAD55851DD45B8BD5E3F124AA9FD4BAF5A01B68B14D2CC1B45F910DB916" +
      "8AA035F2E8E906AF666E49E7254C3AE071F3BD588912AF61FFB834696FD2C972C8A448177C67A59F235F24FA1039EE741793F5491D1C1B5E3055797360749FBB" +
      "C9F124672842471DF839F4CF304990CD261820F8E07887F867596150A0D98160518D49E627B7A98AED522544A6111033B69CC664C47ED0C1B010F39D5CCBACD9" +
      "60B2EB2247157E12B205F7C00612ADCCC9C40A5EAF17A2B79F8C3EC3BB56E41262DB5D475F6DF4A910BF4494332EC332B22A40CB251BE49377AE696E295F3205" +
      "42CB92DB6FD905CBEFA640BFB59FF06B2DDFBD0085D5A6CCBACD258D3D50090DD76E0A5A91609819E82BAA5F73325CCFA1236770FE20109A3CAC6E4781D900F0" +
      "E74F4E0CC982B066E3AF42D4E45218914278A1718242A1935C2A4839E981D71EF0D6B79B6FC11EE0A4C22E8A43B770B80CC7981DF2F466F5359556525DB4E8E7" +
      "92E911133FCC82C1427257C805D594372BD8862F5465D667FEC06FB5BF74F8C6C442B2549D662D9B648D6B7495FE25E7A69D63F2F51C1F3513228F0935894306" +
      "C1B879881F1E4295899B07A513D71BE9E4FF9F1FFD11E4AD58E6823BD6B290B9B427198815A8C5C00AB70F7ECA49E814D1F6FC5CDFECB11CBF0574B9E1D34F25" +
      "AD8C05A0EED88096F2EF97B63E722043D7C4F4205ABA5EC7CA24C2BDC301BBE511EB8C2707E9BF82EDB01948B52BAD903CF04C3DF5B30CF17F4A2918D7C5EE1F" +
      "0365F7F57608F4ED549DC3211F077FC34622D233D7C96086133EC6BD450938F497152D960493B18A29A11B6D9E0B9D83F8E0984E6CB61BDECAE2BAB4B8322847" +
      "0EEDE12429FBEBC1C9248A0EFBE035C5F31216A7DB7B673829A5D7CE888A5C0BF9BD383D45B23B4BFDAF6F4435D8053E44477C4149ADACFC5276CEE0E869A37F" +
      "83950201A0E24A5155D358512E62E27765BA361E275B18DD7756BD05953CB4F6FF9A1B60FA7E5C83300D4EF01AF3674180387DDEC8CA7B0FE3AD54876F482F29" +
      "367D1D95C254433AB4E387DA8C94B7888AB056E4CA4581AE8890D5C1805915A407FE4F8D56D23370845C9FB6E0C767C91A0E426FBD9002A1E35434459636FDE0" +
      "8FC72EC491A56AF0E4433A1155581C46A2A1389BE5975EA3D87D1FCB383EC3648D737C6675859A569E7C9519D60F29C10BEC70609A84FC91BC7FC9BE33B2A8D6" +
      "A2FDC4FC8BFF70DD0BAE930612AB181724D12D605A3B88B7086CB3A3E87E2C26FF121C9C70E87E5BD11697F8726E87AFE47A5D0EE61B4B5E487B7527ADB00DAC" +
      "B49A23204B3C870FECB628E8406E3061D9FF5603F98182056B0E1111ACA01304D30C7383312FC3A267746F809FCC4331A96966C2CF0C310552814E4B033D0B26" +
      "947BE4E64BD90533BC9684810E3BBD7EB50CDE768E902532170F6E87053BF3D02FE7EC2F68861BD03DB61DD47C10FEC7F98EED8880E0F407ED3000896F2904F6" +
      "3315F8DB76FC892618321A353D59590B613D23AF6CAD609034EB53A14A3C208CB1384ECFD5E3821646662C5438ADC8C5F187699FD6FDC95B729137860EA6AB14" +
      "AE6425D73BF055F1F74A429B2A03F6FD11E6326B6C2AE0FC2A0059FEC781B402C59E999ABD2605DF3B6A7C6E2EFF124B6CF003ECE7486656FAD3A374721B3308" +
      "B1B4406DFA87BF6FFFBEA1C8CA441121B51A5579084C3AABDDE42965F59347242B6E3D06659B104800181D046854CAFF820A042A7C988ECAE3A08526958D2FB9" +
      "5A48838EFB23FF386BD7EF68090361EE5DCBE6323F976C5DFF7DCBB53A1A674E501DA9F42358BBC6CD060E50684E605C079172CF2C6721B2E447FE875D0C29BE" +
      "9638D5BCB5D2CCEC2B94BA1452A60AB13294F4E17D8E460DE89B2465BF39280B48485A6CD6D90A715BCC6625DCB89E3A64DDD4C0744C530430E58FCBC3A19AEE" +
      "B31E8429A03D6B2B99642FEC5E6DAD7184245A0EE331641670A366AEF234D25BE1E18C99060B39AAEF9272927CF093BF32EA89AF9F5F39AEEA4A1F911CAEF1B9" +
      "70ABF0CE13423D4387A626601A1366B4C3AA2E6DC0222C2E45B38692C052BB4EB7CE05F8568C3E7CCEFB7844E90A39711941DF2D9EF3AC65B741E37AB3EA33FC" +
      "D87515751A6E4E96BBF28171B7CB45C72026607BEA0869D51EC1589413ABD1FE764E05D63ED34087CE7986325832F534EAB18212897068E9EDC14140BBD3CE17" +
      "9A4815486102AA4527EE89BD2A841822ED1667A0257E9C5799A04B008607B610A60E5F32A9307310D85437DB1CEFF22069427C124D4D4B452C203780DDFC870C" +
      "F2DC0896926C44240640218D0488AB30629BF85B79E88DA77DCE42020017C0833C0019310E7F8182366F0226D9D5032E106B515827F34AFD9BD51BFEDF863486" +
      "76311E2E5A781A0691AB2DBD5BDCD4CB38E94B5197DEF5B43317BBAF1808A02A493E224DCCA52153000000B039BC6210A4080BB4A702010C7619EA3706779901" +
      "D76383BEA76DFCBA775007E7753B6506CC2BC109A2ED59C13DEEFD122E327C611A4D571DCBAED2319514B708F783B0098A761617E769CF744DDFE20996393362" +
      "B6B3EF9BB08A594F0732D49E47C06FA930999D20C1FF4B4342EAE0FB18622AFB8FC7F2F0D3EAAA424ED1E4B43EA1094C4812CCECEFA694AA6809C1D2144839A1" +
      "0D2100E48842A901699035B542C0AA67F64BC2E844A8C18B6F2E0AB4BC23C8E1CC016B96B67AEEFA09BA9D4EDDEED971FA58ECEC17505FD08907D786CFAB5BEF" +
      "10DD95FAD7F71A91C9A2538C96781653E41DEA00E474D439C1AA876979BFF146A6EA92F44DC854B687D2A2E0C54D4D8C354F9B8A8D7DB17AE4C9A18B21989688" +
      "44C25C094976762CE968064690CE8400CF6E0088F265B7285677300BDE2EEAE1541E3EDB5B0D4ABDAE17D413BEA70340B94E49DC787C83E0E9B4C102CBD4E8DD" +
      "2C5928F76582610AF5903461D064B3E97780E082F5ABDC38C35D1D29A0445429448B85B150151B6789B52094C28C70AA858E4CADA96CAD707E25330CE89007A1" +
      "68F11F35EC5FE07B92B09AFE59DE274D9A1C12B529D30EB931C0E6C191B5AECB367C88FA1A50D9411983901145CDDA6EBCAA1015EA20BE35A1FB9A6C353A40D7" +
      "7255AB63ED0EF0B6200D52B44017600378542D4D99904CBCE2E711334484943EB595226C1AEFEF73000000004288509334A1AAE200D04FCB9783C365B88BE80B" +
      "718C40EE8419D803C201BB0C748844C196E63260AEEC46DD65A4146667AF62328D71FC00E9447CB7BA964973DDB384EAB5411A4F405010A96015847E2CD812D6" +
      "A0134DC81D1840874499A4B4FDA0981EC091B2202BA6B2959DC93C5AED35128CB4DE8C059E4811FA82855592DD9FB426365779F85F97487EC656C74374D69D73" +
      "A1F3FE02A2E4F19B383D8BA648EE4A61E6A08C45B67C2123008B42040814087109EEC7F566913630E453AB69780CCF289FEE59201EB8AF6F3C7F49B46FD90A17" +
      "7061252FE2BFDFA60DBD660971A0BD5689FB24253E67A37B52798DDA48A78DC14E31EB822BD1B7634A589E2577727FE48345308261896D949E8343467971FFD8" +
      "5A4DBBAB26956C9BF61B7F607DBE9DC7B92B82D557C15E2A54F349CAEFCDCABD16E1398E9B71D6C3BF05C7903FE1A0E41B66391D562772FA9E8A812D44FE6B4A" +
      "A6B1EB8606746C9BB8D33DFA1270F964FAF9EE838FA8A902068734906CB2C16F36D6EF397753B6BC977A9F40DC1E838BB47DE9D06A7265ADDB9B1F6C10068F1C" +
      "63F3B22C0937B534CB2139549017E4985539F704815F60F4D7F3EFA6ED10A4427D760B314A19523E0C93AE69BC826275DFC308EF2ECCFDE07A0D2297B70A9B18" +
      "7A6E6E200139B209904BAC851378F21FF3459B51423A44F960F31B351FDCFFF10BBFA573B207681200000000000000002041298E23340431E1167011BC4CAAAC" +
      "8BD91B3D08B18E1318723AACE6C99EC833A366863E203553E0122A8D4184160615D95242BABC77165570C22EA8D9F3FE00DE1BA9542CD09C1EB422CA9DC0A242" +
      "C8C42F0D38EE18BBBB5A4DA59C52072B84A67573157965DE9174C87B0C479F5781E158627A8540F32F837FCF7342DC625CC37503063A469B09EAB8585DCD290A" +
      "DE028472CFF4BF98E8C8D3E67FF5D64B0B991A0E34EBF926C88BE100C633A244CB2D770A0F404461D1018CD03BAB2E1A76B3368643EE7A3889BD8AA4DF09422A" +
      "80826C4E21D9A7D915CB8CCE80528CB1C0E137689233E59679E126EAE3143EA29AA5DE2BA769ADA5338EDCC6A3A13EDB4794412F506F28F470AB1BC2D1983F4E" +
      "EB47407BAC135FD538A9226CFF85B092985D4DE027B3C953B44989EF90B9C49448E9512C35D7BCD3B536680F3D18B80C64E00AEB32213B4FE7EF91956EE36204" +
      "E8210B77B82EB9140F61E5C159077A1AC79F3604DD358595BC47D3755722F8AEDFE0B18C9056C4BCAF07BCD1D055A07634D584AD7A1E229C5E00E23FDA740BDC" +
      "A414C5E33E4871237A75AF8FC65FDFCD3B39E272569A2836A6BFD9E928DE2F425528B1F3E7BDE872C4B558106D06179933485B318D182B9A6575E04EECBAEEC6" +
      "A18ED437B91722DA2B7CE70E3F0087F97F8D00B60530D41E2E300BC984E2110DE708A8C99D417A23000000000000000000000000000000004A9D8842019F7430" +
      "863F842912D40024D214BC8EC9C7486046470020B6E313C3A15C2645314486BA02982F1B30FA14422A6254AB6AE738D264222234986325C838B24F469742A71D" +
      "70768F0A5F20E6678D6B027608B3AF38621B142F23FDD1ABCE80FA31DE69C42213515906453BD39F2814AA0485694764E30EF5644D8E5151323C7C63B77CE348" +
      "172DB0DD541CB18D9C50C05B418C5871EE30043C48C46182D18A368368149FA01258235619A3D88C24A23026400017532935793200AD9A7B8ECD55E59F5B5604" +
      "747E1C625C60463E89E401D55C707C30F536E567A04F5451B64C7021910C51BADBC22E568303BE2BA1DAEE05DED9DBF18C40A05C91E9E0940C81951D9FF97604" +
      "141B58ADE42D08EA4D758D8A58A0998195974970AB97A385AB450714B879836B8C82323DA63EE9E6B906E651E63E3A03B264F650B174B6EB44F626A7F0882293" +
      "9CA4D3A02762990E4AE0C8957C2BF00D881A47CFC04C0FD2A3339DD98A3A6C91299E256A7C024966BCF952FE9E857A0D5E37D50A37983AC8CA4E9F3560CBDB91" +
      "5D0EFC90533A00B65303FD51C030D532F0C1A470603C8A2938B079BEC27510F0B013680CC329962D9855E6C033831B0A0D43405F3AF7E723DFEF82EA3CF8896B" +
      "0339E31FBD4342B02155EE92E15138F683D73F3A822422B72C8FC8B82B0C49CB0A484EB6980BCE4A000000000000000000000000000000000000000000000000" +
      "0000000000000000B6684CC11CAC00666290A461C41B852381778A143D80BCCA06CF3012007500026743F801E92734EE04646138D18CD30245C47265E9C20C81" +
      "23285B1389236394F4DB560B5C5CE2BE77CA29B56AF92004A699CAD0414DB02256BCC90EC8E007692610C70690A89934D34210C24F9C9B84B75A7A6454CA68AE" +
      "0B2499CB0D958D15215F13FDC1056D2B1BE123C0B882A50F274ED27298CA32345302D25A2407F89B301E7AF98B3066F2FAF75ED65B8034E8D2F0393B8459B505" +
      "0EC6505B9C89F67F905D3704680D9AA646AAAE512221753CD0D6EAA1368E6F1471562CDC6C5155E9D02859B513859E55379B2A7482DB305D36B4569D9AE82F78" +
      "C171CE96690D023F7CCAB0D392C406CC901ACE622BACFDEA4B19758B6C6A6A2A007390C4B79861473F87A4E6DBC7FCDB22E0437EF42ECBC9D329FA01099C1A21" +
      "96DAF2A1929AE19A67A35FB74FE80D3A37F3E32A12F42B68E5343FC3CF50A6C8FA7DF21AFACF4548FD334138C49DAA6F12AA9415C5BF18333D52B21444BF10E8" +
      "AAAD5DE42EF763651DFB10F4207C2712609F783BF8A01F30160876CEBCCAC87336B08F979112559F0980E8765D66696DCE51EFEE70C296FE44DB946BD59F34CA" +
      "F3E6EFD4F637DCCAE463A1FA7992875A3BE0408218B9D01B27398C807D3D32CE0BC83F860AB5CF38000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000CC0D8802D347219CA2482286807097015045004421FD0484" +
      "8064C1A03E028046104F0B499849D00C68219C90251C43A04F0FB49298022200A4021A11104F42E01F4005D4B43A26933BFC4D316020ECC0C88768BA2C042A43" +
      "A8290428801B88D6C21298C8800B591B88026850408372203539510D9C00EA2912256026DDF413CC004A4AD67CEA72CC2E90D002AA08845722B11D265272A47A" +
      "831C445D0F4E8DA4611A42B28595BEE1219251FA9AA30D4E1B27D7560CCC2048C00370EA8484D778D884C8406025D90E64242F82928E81CD5D48899C14D241F5" +
      "A964E6C7CC15C8263C75DA657120EC857960C5A10543A9AB08F92A96C1C3944B8A92918F2934C854C1B04674B82668B0051A649E004AD166141B929DD8C50A02" +
      "3611446499DD3686FE3BA352EA80801AE2408BAEB5B0E94AE68F9E4F32259728FE6480D11EBF118828D509BEFB2826085ED17C8174B52B4C18B0E0A6D62DB4BD" +
      "6DBF7AF4304FDE44AC27885C6AACA08460AA222594408C00FC05B255C2778B4D5E7C7355165205E075C43D65A40757DD8C219EB2470A58225D308D8A6D14EB54" +
      "4A71058694D8130AA879E17674EDEDBB9918E34F2F17A285894C48C765AAC183C74DF96785166418000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000005BF06132881400285080026011F0A1608520312333412E" +
      "78080B152702C110D88056001044E8FCC109750701008099D03019A8C45A1A0AA848E54200218DC008B1C82ED4400283160019082032A0421412CB16A8451D44" +
      "1D94C048A0200756A19A5E0440A4AC2163290844001429E060002EC000271728E21121026834C134A0036B836DCF145B661D6F7A4CCD0A03C0184610C20F4E8F" +
      "020258FAC0274E6A81F6E4480EA47320A90015909BEEB0802197A82D264F23574E9002A8671928CE40759240EDEA68208D549089BB8A3C07388740290D181872" +
      "BE0C821FC84015888B1D44373A0C126F7E14E7A0ED0D5008299910E5DA2DC241010A439D66245597324907B1637B1556403106BC18EB2631CC505CE2F601101D" +
      "78201CB829575B06AE1BF6260214A3820069201A7AA63F37DA0F17680F9C859F36BD6068074F5B305685A136032CB2DE8A00B9CC614DE041322A11529689D0A8" +
      "5649A440AAF0E8093C604601E2AC200521F01475B3221E69A01C706098822426C18D092880304E8A000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000005820975639E9343A62032B80A0D4010191C8662CD9A3D2" +
      "8210840CA10A020A331258AE88000A14843B041A5940138C8B7C50104630029F00012D22A01A9458E02640941980131C01FA102549D243E40064B42C0C508402" +
      "832D9574C846C90AA0334EC4C28B98652FB0A961695C88E5087488A1749A254200ADE64133578289239322B8643C681180A9C46194034804826440521002A890" +
      "5DC0CCA24022098E413B2C656863D246CCF090CCF439949C5A010D084A04312A1529C4034E7590005087903D81088C22588A66277405484053241E645010A846" +
      "82E140C50F54A56548990408D9803825541406549002042094D64212A902607DB60105BB8FE802181591CE82E69E4ED62D66686A85330F123A6FAD8398F12481" +
      "D256939BFBAAA3D97273B27C46DA938BFFEB1E91E3BE7DD331B55C2686E6B2583CF8A32C3969D2A6BE12DD20BE5DB1711641B019151E0A787592FEEE20B06704" +
      "6D66B1493D26A42E8E451AB7C521EA10B46157737AC274507B13E609FF7149BF25E50022176A3146362A3327EFE5F6BED092C0CBFC497DFD0692D1E93496C557" +
      "A5AD7EAC6CC55415ADBAEB18598D756550A6BF6E8461484CC5FEEDCC7019AE3646155C37F4692C54FBE7F15D5AA0AF917244E8DE9B73F4BE2D0527511597ADCB" +
      "70ADF102526B1BE3D93234A4A7EF12BFF7C3CFBB37E61DB824C912477BCACF00EA56252C4D5626D9B36A3D15B161A1E893816F916AD7FAA111DA55EC772E8F7A" +
      "716A44575C70209709E5C992DD1D7DF6701451AF1E42067E9E4B0A79C85E3487363F5E42C7D7477B4DEC91BF61D206CF7FBB0C244EECE19F5C6F0210CF4DE9E2" +
      "9E892E3FC14949107BB6745916CA53ED1B93F80A819F9ABD266D2EA289EAEE71B31AE6D5AC15B2AF099180DC03D91EAB192F0F2009D6265AD866A7BBA4983A86" +
      "7846A3028123DBBBD40557FF33628E3A8C5028A370D8FE91BB49D004BF259FC85368B2BCAA1EF000AC584B6097FA622EAEEE07E9EE9E0ED27AB999A761C6143D" +
      "965817CDAD3DE60CA5CD184C5A2CE84823B511ED8BA82057D236D9F5863CA57F54234AD782BFE90580A8995CDCE6B4FC3EC2453B36E336B45527F10D99DAF0C5" +
      "6DC7D51CA0BB55523087F1339C4B697B019F48AA75158EE0CF80A77B86EFEC47E3F4659F50706D2199A166E180FC9EB9F6B75BD32F0C8399F47B9C22C4E050CA" +
      "692BA9A6285F8C69BA8BFFEF1C0978FE09C5D4DBE23EECEC126BDD07CDB6AD708B5B19406C352E7908786BA20502BB0F4F11CA089F1FCC583542C794D2092DA8" +
      "9668CA049A7881A16AB5752BF3AF66A46232A6BFE4150A2197364A8C7F9CFA05790662C7294020BDAEEA275EEBC969E6FC9CC0498B8341B8D940CB057C8FC6B4" +
      "D6DF73B08C44251B8B7518C0B9AA76ABCD9CAF5DC06E9777E86AD1B8AF3175B8C9886A5B02A7D305D2B174CC934565F654D5D84B57C852EE16630C778666F983" +
      "AB9EA8CD4DAD3B8EC042AE15A7750FF8F6108E9A80FAF65C4D990636EB7CE5080F98E3665F3148FBC5A4EE913E90B9E7E16044EE30F5BD487E73320CE1FC6D1F" +
      "180A6DCB15565B08D703B01FC3CB789CC42AB8DFFA51A1BC0876390049F487C1904794F1607377644A05A8FE75AB39AE968083150395F8027A4AE6D6E95E7B78" +
      "5B3C3A082BB9BBF438DDC480D3DD23C030965B39921E3C45B6A83FA52BD43B30B4332FA17490B190EB7C05B1AB76DE2056F2A1E4694387A7AA967C9D0221D82B" +
      "CE24BA0389BAC92E7C8F8252B5E4BC767B7D079C7E0C239A3C2B82CE3C93B060A655A643D1A6B36A58DF414E9C0F67AE1455C38FBC0B80C586C2D34D0D856FEC" +
      "F215B53E0862199D25B1699691A1B221816010FB2F84C8756A6D5E0CD829A8970001167A5F46D9D28B39FF40F1452DB726883399678FC304A72C6FD0186117EE" +
      "54A3AE888DB71EF3BC5E8E1D53247CC13F7AB54ADCA9E35D805B54F2B0B0DEEFB8FEAA7D7FE9139A70AFD554DE8F42EFB32C90F2854A17DFEB1793363ADCDACF" +
      "F4220CE93F441E842C1029FC069467A5A10D7E2D068F6FE647FD541DBBF3672F4D0A4873EE9127A28337CA7CB21465954F13C397E09FFE305C5E34722112A07A" +
      "2CC374F637824B9E3865B0DA7BA2B939EBEBB4C213182D9082A8582FEACFA2D4FECA8BD09AF4F782D40354949A3840255DBD19672208A1AE028C7B828BF48EFC" +
      "2FBE1F18B1C99628BD0FC8A81DE6683B8AE18E35501B71F5A83F2B1CBB5C971945F8007334793B5583C0E6BEE7BCBC36E1EDFDB1DA2F8D139BDC4DE11D5DA9E0" +
      "8B40C80E0A3458FBECACBAF14B65ACB4739C1C83230B7301BC3ACEF364E527D5A79EAB6E6FB0D39FEE3B2B80415013027B0DA102487D8A5657F1A0D68B571E9A" +
      "E8CC2325769F8383F2DEE5740324FD2A150B9C33454129A402F9872291A5F50F8EE7EC9179E8557E42EB1C9FC3764BBE5C71CFDD8ED191A34C50319831FFE26A" +
      "293AAA03A1AAF4DD475BB7DE2507AAAB93111AAAFFDC74834C854554B924F2F7FE8F31928F037A7E0D95729B198631B08DEDE4ABD6740C10E14F3F2F9FA973B8" +
      "A1245C6D251F5AD5E586EFAA2A5223A35F6C55DDFD3E9F3A6ED30DFF2EC212861FA3DE1809F591D8588E1FE59942355E87792D7D48C79CC0BCD9D8CDA39EA50D" +
      "37F62E5A458B8C9DF40DF269A59969B22CE0F7C3652CFB1BBEB085315F829DCD1D2A2AEBF3EB53E96FC33426A597D4B0FB46705C93C10B705216F86877DD0D6A" +
      "59277F7E1FDB1329F5B33243EEBB48B217447DD3931E415E898513B930FBEB03D947BBFD6436D7F69C67F3E111DC89106B4D24E4F1B31AB545588D60D07339FB" +
      "424EFA1D9C4094B5B8663791E805BC206BCC12F588A99F1D59D95DF3AE0B852EB0FA10513F675C0AA9926D294D18CDD24B166F749168FDB0595FAF3F7EE3F2C4" +
      "C41104EC39AEDA42697E023ED840154B79AF4D9CCD74EA4E309E0E910EE2BD77AA42FA621D18D7ABF277B3C901B07ABC01C3820F3C81F4EBD0BFBAA8F65E1AFD" +
      "8824971AE9DAFD854017E1450BE30CA6558E9228B59F87CA5AC8DB84DD5D59FFA92AD91E6B5ED73FD55C76944A373E181338D36FF7A250EB735F52B97DD07500" +
      "AFA5BC06C69AF44D4FF31D24057A9453061780110561113F7518F00D7C4EB838466501C9E884FFC6FA6761E48E5A34AFB6DAEA8684403EDCD2E4592BEC2C3360" +
      "87248B33FFF2502FE1B92A5203ADDCBFB4662D9BFC9C18B9278DCC10E5CCF4FCEF48AF4598DD06973767D4D948BD3C59BCA71ED46E7581B29736FB5845C216CA" +
      "B1E38C8A64E759B569D40C11FF010C77BFA9DA1E85538016FCDAE1375016F220B5652EC1C5D5CB5E7E4645BCC20C6BA9D6520074B7A9AD07D84AD359D4554EF3" +
      "20B9BA76A146045E1650BF7AEE8B7E80F2D5CE7D27ADD7ABA1D839E7DB11A503035FC9F1C1CFEF363A81A780A249201F430F8DFF29F301DCB6B7CA0F92DD334D" +
      "C2889B08A20F6BA658F68A9D51E4CECE6D278FA2074D8F02542BE2C002DDF9848BCC071B8DF505FEE2D0797490880F67D64010DD503B69007572ECA079EDEC35" +
      "8623ECD796316CCE6F84B387B4C3C25F357A36677DB891221C938CC4076D8F9B2033BEBE66D24F7502128155E4163216DC6673B12BFEC26291F40AC3E3FDE822" +
      "F4D1393A533D9B37377A0BF759237C043D4D6AA597193E4D1949A2CD68916D5C0ED925148B60F7DD2EC04E16FEBB2607CC25699E4B1238F31703DC80B32D90D4" +
      "6B6D065D72610B686760B47C1A3F0E62607A20DB98E0C7FF9FD6A193DC06DE891D72B4122B86308D4C1E404F43163289EC372663E3492CABA2004C37735AA5AD" +
      "2E213C93AA264551EE9EBE8D174E2C7FB6B45CAAAB535D8AED88F4E5A4E544CCF176C605F084F3E905E0079B401DE84B522781962CF55DDC937CAB9430D76987" +
      "5B55B8FB9778E2F1B1E08D9556C0C5CB92668F665B474326D6683282FD894D7EEFBD52474FA7A72E59308923E866F1AF36A41FAD12452DD97DB90546ED79531B" +
      "3C57EC707960E3E0C4AAEEC387D842B4931656F8430C8CA6FAD76B1BFA560B490BCB8FFE56BDED81F0EA05A4D10DC71FD92FCDF166FEF7CED0249E7C342A54A3" +
      "71154D47999FBF6E8BAB53CEB2BC263758106A7EED135B257311688C44BFF0A9EB1EF4DEE99202BB18BD8AD24B944DEFB2FDAD3208E0A4D07BEC46E874311BFA" +
      "034CF564D51330E2BBCA540A5954FEB833C70296257F7F417E05D63F25AFFE892BD16DB34CE60BF651442282AF9EDD2CB8C14E178D2004EF8D5A92804B4671A4" +
      "C9C7142A45215AF0DA305A6E67854A1FCB899ED5623DC5F3337708C47743EA9EA06543B648024908310C278A425600BDE4B6B23AF57A41B56C6DE1D1128FE539" +
      "CACC93C56B493FFD88982CFCFEDCE987E0D49F31820646CEAD075AC6E99D57776F23E5E65EE9EEFD061A2C1E0906F67AAC837B35DF7E11E4DAFF5F476DDB8A89" +
      "B2D35824349822DC0E919BEB4A5500F38B6E895C1FEBE4D8EFAA76F4727E18FC7F3DDF25204134BF52BB29FF417810467E21B23C1F1F64156F62D528BADD0D3C" +
      "9C0EA3C7B1A8599F6479FD9BBE840B459E90AEFD7E1D4A22CD1013A60C3D579585EC4B233A233A62D8E51CD18A92559BA7CD72E8E319C1DA8326BF51C1D024C2" +
      "03885C6552758E993D9789722C6616B213E478F6BFCE26447899A356CDC4EC3E7EF6516F0F8A735F1A0F262CD0172018C6FD516D002CA20BDE74ECE21DFB67BD" +
      "1B4DEA9DDBFC9B4BE243BFA88805036A2D5041E51197002B5A6C12ABB1FF520431B403CFE38AD18E5730E0CAB56606048A769C3095A5493BB6DC969593E31AEA" +
      "B9758A351AAD359688A6A414D7DCC0A6C9B62C22983C4D1625FFFCA8832A25B3D707D87647D5D1E655FE9FB9B8B62B09025CF294F953407328A2A71BC0E00A2C" +
      "99F15948C3691ED059B7D021D00762A71F7BBB623AB61B7EE3C9646ABA6D52D0CFA55A27123E27D6E257605EFC18B00FDC4E552C4CBD54341A9F1050931062CE" +
      "916BD01AB61CDDD078D31DDC9391EC25AF80EA278BC8ADE12BEA6933C8B4FBC87013670A89FDAF2BC232CA29AB0AA0F73B2F57797E95118F4551123C02FAC812" +
      "A1580D53F6C8CEA8CBBD922C45670FBF9E08CDC41035677BE40F44CE0208B43455CD4D7A06DA07A4457E259F9A12EEB7AE476EDC1107F5CE4E8C4CCE1C80F87A" +
      "EF40A3B7DB1B5F693E53DC2A18D28CFC0378AC46315C86E4108A14E5EB28A47A354BB841E89189E31C8B734397880D53863C4B1F03BE4916172A0A59089610EA" +
      "5E2E1A99FEEA80454A74C662F6D599DA60BA2300CADC18824432B797DF816CD877CF855B7D5160E8CA89D0A0A46E07CDBFB7C8121F90EDF9CC77E2CC92AFE021" +
      "ED09B176A1DE285097C9A19A73F7EB8CAA94E70A3D0A277F8FD686EED8196A87924CF2813022450FB9697F597F007C62CB759B8AF889D28C955CF90062AED22A" +
      "88A9B585E25419B104416F0A05C584C0508B4FEAC2664943DE8AD573095114E4D9BC2C9E7CCEA0AD81315E89951CF5F6215672C078B8FDCE5C65E6A25DFE2F11" +
      "1547E5AEB9E90FC720B60B131DE61D8F1CC9E0E9CC5A3B0ED488E8081DE61A50CE73AED1452CBD49CAF8AB016F37F4A615ED117A1D2CC315F2D40BDADA0703B7" +
      "D4968D00F8EE4880F8DC972DF6E911916FBC9A7E19C2B57C3F68912E423606CB2DE3E5ACA9D984AA5A0CCFA87E18526E6AB013825395440828F4206644A7B361" +
      "45AF359069A02D54396540A3200ACADAF4BCB7DC3FB9ED13A71E2397F318FAF82599830880B5803971701D8A4244A4A01EB09EDDF16BF5D14B59ED13A698E95A" +
      "7E36A1DED19C1703AEA5F9B9EDD024EE2CE520431BA3757D39C81F1508A832E73BE02E9B1C700B10110F2900E705B0952F083E937EB66AA053965C054686E2C3" +
      "18588C1C6C7AA74DEC2A4F5DF64A2B4B7673EEAF82BD6EB642D812174A5F7DC88F9AAB2329CE590C7B074F7D344E803BC0E68FC33E0F4C1AEB225C01B15F6AB2" +
      "9BCB251BF44924B58340AB7627F95E1FC1D10C62E5D8484B6DE31C1E9AD115C6EF471C8A09D6A006790F74ED2DABBF12E8D628A177DB28A8C3909FE0B8477B97" +
      "DDBE68D120C8BD70DBB46C2BC6386A16D19C07BBBD7359951A1F3A0B2A875D3800BA271AEAE01A809D95845121401E3A6066E27D9708DF4728B5DCE3ABB6F531" +
      "7AD05755EC5BA8D3E42622350378F9437607ACB6ADF953904883109DAD860DF97E7F10BB82B229CE323FC6486D4AB04427B61ED3B87E76F59A06129F73E1F939" +
      "AB59173306AFA01A21E8F8C9ADA4C08BDC254C9702F940B3372CB5037AC5A42DC87FC56A215516252ADEB6295A8A59BC6C4BA81C0223B55D3E19C2374155EF34" +
      "61BDD61E5B323924F78F8F54287314D975007167AA08A903092B829679A27375D7666032209A1F34981F41C210FADEB70DBC7884A243A9C1AA0932A072F73B5C" +
      "3B48BFCAEEE33AA70FE63EE0CF6AF9AF384F0BA7FF5CB89414064EC17CBF5B9F95AF42C1180E06493499BA77370F5C4D0FF5AA94BE794122B200D5F0E680B4D5" +
      "33E8554015EF4EE78D5FB6A3AA9F30546ECA7CC37C46FE307ACDE231401DB8AAA7EAC6D174374F0C74FD54224CDC449136ADD6E05690155237F11BFB9CD733EC" +
      "BCBA3FA9C529D3F62C592C145BD9107DB73F89754F9C5457EE94BE7475F62C40E7A9ED47F5744A4A7DC2C91528265886AE740931C08769AFBA83AAB6BC3D1C76" +
      "03141102BCA8746FF902E0DC154005E7B3B9D5E040EA0F83F192D7CB0157B85C7239B42F938119A986B52F27755513245FFBDD510FB40B2FAA2A449273AB0B66" +
      "C6A65CDB91A47223CD7F612011E0C8B0BC638EC7E2AC4EA4B3805D7D7D8F12E65149E8DE66530F78A698F53578DB51DE651A430746107F46BB56B6609659B88E" +
      "AC74954114121BAACAD9209EFA32187B95700FB8F9F02D4D9C4E65243196D89C646FEDE71F3C7C1CE07CC6E10419894DDD6BDEE5BEFB819D4E35876D94004990" +
      "56F2D6FAE738FEB7D2E41BE68E62EA44EBA94C2AD90F4A0F0B6DC9AD8BEE9B6C7D2D7C4F3BFAFFFDCE7147AFDE9EC503E195A581DEB5DE246C52380149DC2754" +
      "57341E3109C59B2AB3B68A876BB0E00F0ECDFA403D000619DDD03531E5524A5EFAF22D4EF5495D9CDA13FC5BF887EDE0FE23D1D7A919CC27F2E0605576E39734" +
      "4A541658779F127DDE6F051F83AF6E69803787EE411A76A18D21D03BACB56FEDE5D5C1BB19B7F604E4EC96F20E982EBE8D3BF6228B08B2EE09B8DD238FF8A372" +
      "31F4EE76FFF66D86C2ADD95EC39892F702A7F6792B8BE4F5D5D328F0B1BB3120376FEBA50169EE4DDB72C99B145BD56D04F290DA65DFD1C724A0349D5ECD67A0" +
      "FC3E81B8FCB8450895AB5FB7902E84C4B96FEC6684741DA98496A37FC5A4447DC435D6E7D6594D4CD69FEE528A2588C0BC117CBB1C876D55D5C78299DFE917BB" +
      "78A7A678BA0C1CB8899576487036DA5518F366214057F4CD3989A6E370537BCBAD6651C5364A2194044B9BD3841B9E3DBC3FB6903F311831D5F3C21537F7850E" +
      "A40242376D8FF7F13353F91216CF0B3C32A16C5EA94C02CFA1CFBDFFB1BB3D0BFC707D3117AE92249BE8AE08610A75586D0739B34F5BC74CB80497E06F7ED839" +
      "0684F9180823A36E66EEE7E7820061ED435EB66BAAE1F27B7182596A687A1519D4C73A59366F320D0F83220F40BD1E295FCD07F054C271C0B3BF02EA80BE0953" +
      "8DB563090D839B345CA909A46B9287FAFA25D9D64706FD92599053AA96BB3DE8B11644F2C050CF75F323DC9315ADBD1B443C12398123523F95B4E172E3C65D81" +
      "6F230FC26229CB5A2820C9FAC4CEFA88E3122F31DCB673DB04ADAFA395E6543AE6A0B2D5906F5D6359465552D98EDCF19B85F8C9349B4E49B81509D1ECE2A4D0" +
      "FC23C520FDCB408DE1731FA019328F0AF2B9B8BA675A40765F29633A059F4A78D4933CD55894DD72C7F21A069A3E9BFFF248C614B3AEF634D9A7169C84B0509F" +
      "408CE60F72628A9F31D1AE76DE5418EEF82D8590644218A7C0E95D12D7320B999B550FFC2EEA08B4F358252DE4D8755CD5BF795D532652C2729AE06A4417F6CF" +
      "599E9851B6A1F0E0F7CE1A3730CE06CEE0D51920A59EC74ADD034206BB0BEEA8EDAA599EDE68588DC12030C4C3E215B255A5DAB608AA881072C92EB6C869044D" +
      "E4FE772C9B55728A7E86AF3BA21F0689A57F6431791EBA9FED732787466EA2117E0848241B65081F042E3C5925F7226D4BEA4A7D2ABB5733B7D13F6A3091FB43" +
      "3F3CB1D4B52F6111F2768ADAF92EB9AE90C8C478A4B89A9287318BABEAA03062A91BF4D802B4EB47717B08DFDEAC55A81A025C8A71A00410DF0620D5DF65C42B" +
      "D2CF44CE5F4E9967C957D4952CA8A016FE0998B8D13D179051A61C6809F41CF6F3280FEF48BE412B3706B8C38914DC48AED6E8A606CE8FEC0C805ADFC2F727C3" +
      "453C946624D8E2D5819D151DD736D098739C33AE917946AE26ED8637ED464058667A841D2324F629F72B805A19115D8F1A1C1C269EB06E236293745048B4114E" +
      "C9F4541A0B7074B197FF8913E86F12ABD15F8F7DC1226EEB0D7ED68F98D16640FD1EE8C42F84936E0EBE80BA2972C425C03A1C9CDE83DD45BA40E3B7D112E0B8" +
      "BA842FEE318CAD72A86F157789E4F16243C65F5B6C1287E238226D8042D6DFF645DB59A5B2CF5A25D93E90BEB1CF57918CAF8132EB60799CFB593E79674AEBC1" +
      "9A2C4A66FF0C0E51A920ADA5433B38B5B023AA25C68AA3F03CFA98886F166720C4241CF0229B7E553E33AAED32E0B215C2A40A72D601D03178C4F7981EE6D409" +
      "B43165B01583871B5DBEAB96754402EE9E1372B244909CF1F2B7F0B4AFFC761C0F74229A46CC9BC054C9922045BAD94CC7EEA0B95C4B3B9CA072BB6781895771" +
      "A77E1834D32EAD30DEAF1037736B7839DAF18570D2F5B01C22D51EC72E7989D4BB17ECDDF3B886DD47067970C243093B9EB67EA676DB4B506F07C725369C9534" +
      "603D4F18F10E4D3EA946FB0A5CDE47342FCF341E4B4823AC3A4C3CA59A2C930728FF8FBC5472C4F21930E2B3889C496759737EB27D541C64AFF94EA1EF230880" +
      "7A259BB94EB65117BE63DC3E2CDB4C01DD7F0E0D9E403905295331775588A060A55F82B25AA5590CE9371A6FD242F5AC7752354122FC9A8DEBCD87D171A8B80D" +
      "7F7A0D72A0E291ED12EB1CDFA0FD1DB524994DCC535757B739A3DE596A75054ABF254926772A0FAB69D98AF15C0E7C4F28342B337C36B78DC9C7CC3BFF959227" +
      "D0DD46786FA976290267D3AAEDA2BB1D84A1E4A460A3251B63E35B8F92FB362A88E8E1956C4D7711532BDB3F92D113E54FD3B13E7273C0FFECB63276A64F0CC2" +
      "BC554113FCB6A2E370FBA65969E0777F1AB2DB42FE0D4A7F701021520856FBDD512DA538B6B519B387DA12E5C72A12340063458E073982C2B16834414C4DEC49" +
      "76DB72AB67E3B3B3FF8D94C3374074A4E12DA2B8C1132FBA963059C53F4C7AC9D5970CC44F0048431D0092E5936F938897C35D65621032D75E9CA3A00B2A9BFA" +
      "1FDE6FE02AB927505D7BFD6008714197B136F3A04B3584E79C417A792ACC2CB1D444B7FB1AF315DE4160D89BFE687A894D31280B595511934828087B24CE1CCD" +
      "D998EE25F3C335F2DF9F7E29575D638F3B666F2AB9EE639E2032FF966441F0FDA8066A431C045CCDC27E825E27234F98AB58D928FB12069AA4F6321B63AF68F5" +
      "AD2B6C1DD6B372F7F2D72AECF45E971E4CAE81E6B25D5F97E6D1B936E87EBC25BEF78CA003D98A0D415268532B8175458B6D4BD561917CB886E928592C48A94D" +
      "0CA32C0EF52FD6A141B0418CC9428A71C1FF8496DD0AC8C0EF29BF01B04B736425E1C11221BF2E7B0C305AFE27D6A409A13FCD5A16A9AA3371E7629D5E656D40" +
      "EA0AF196D011C15AFD564666DA1CBB45A868FBED122EAECE4775007335455E59CF1BF674ED88C45DE8B9A402665756DE31F4356907720D68E21F3A6BE9AEC61D" +
      "11B45E7ABB700CBF67CD2007EDEE09EC8CF832F789E1901DBB6EDFA5F0D47F35F10395DB682947DA19756F0681BE1166227CA98B3B79523D831675B9D2902331" +
      "F2F2A32901DF0D460A745E7057493DD5E99564F8CCC3E4CEB5C1C7F775270072989F04B460FCA1D94AC4992CA9B9ACD52D02D5C56681FF10818C1A56A0DA9072" +
      "8F890F60ABB5FF3AF44756888A6CACB54F601B2260AD75BCC267BCCBAADF61117869A7145A153EB7638118918C23F1D1EA6609EDB6E5F8EB88E93DD3DE1EBAAB" +
      "CCAA1CF08F570626F0EC74942B38F4D8877298CFFA5F9D99D030541849E96699442F6D19F76DFC4E5C1C9A64EED5E1981EFBAB79E91850CA3DC71CA64776A80C" +
      "5A380294B5CB9CEC7F0D92654EAE08CC9A64C9FE9445644C58D7509239A646F9C8264140E295C040381A19CED3BC819BD145C9DC311FACE7473F83688BD248ED" +
      "EBCA5E392D951CD0E0318CBB13CCA3F4A80552C50DFB9A0199D7BD11517F887B425B10B47DE7BB7172D52B28A90AEEA45C0492BF9A49BCC0A6F0E4EFA40C6F36" +
      "572119AFA5FD9E4F7CB4621DEEF960D33713192FE2D546AFFAC181D6F4BD546F6B18BF3A33D1E7D489AD1EAD6435DC54D0E27BBBD462484C5755F3F361050936" +
      "B4D7B7962E8FE259BB79A6D85D888FC48D45013A4563EBC860CA004E5686731B2E4624B1CA1FF5F65D09588B3AEA57816FAB233F94470A8D6CA56E13E907BFD1" +
      "30073C8B50C662445EDCD24B47100A0ED2C004A7270D7830AE31E87AF077E565A70E140ED707E37EBB44EACCB25B640FD4E31E549CFAA1D12365F5BBA5CEEAA3" +
      "DFB1EE849FDB76023CD0C37BB5183DA4206CA2C0ABFB038B97236BD3A0EE69FE3147D0070FC3DC9D826BE6121EC469A42CCFA096B8B70AAEA92C75931AABDF43" +
      "5378A347604293B61548B1E20763C55FD74D533E38871ED4835C5C2CA6411CEEBA70FAD73968ACEB811FFA2C");

  const KAT6688128_CT = OpCodes.Hex8ToBytes(
      "01278F7400972FD05AA6368A4F8662497A5A31A3E968BF81B49EBDFB8331769EA1BB5275AD46D33F8D6624C2F305F961DC8812850B20C2FE3C7E8FB0393BBBFF" +
      "FC0458A01765EC519AB332DA952047B8A87C618D3BF28046B94F82872A75D1C090DBE768168DF6D7D6755FAFB5AE050AE520BF7ED641C90161DFB70E4A5EF9A8" +
      "D64856CAC821D98B00E8145D3462A4DB6CF2E0C002DBA11257D7716E22F18F8E28113CDF5FE7581CC82854165AB93E36D4080F8E7B8116667E9C12D515A443EA" +
      "002E609C6F5EE839FF282D8EAAF6BB8C");

  const KAT6688128_SS = OpCodes.Hex8ToBytes("7B35200A8387A2BB376394A68473E7ABE5CE392484DABE6C1EF0EE2CD9F68022");

  const KAT6960119_SK = OpCodes.Hex8ToBytes(
      "4040ADA87999CF698E6BF15460B494A3963EE1309A3DB11A7DD2429A5AA4B5D3FFFFFFFF000000004C1EE20E9603710E8518910FCA156E02590731089005EB05" +
      "6803D11E0509000C2F152F0F2E1C981DC5003F0EB50CD20C4D0385161D06C50377151E1F870EC408941B6801AA1F0008501D6A09B9084F066711331C81158B16" +
      "6E1CFB10081D79194C0ABC11CD04CB0DCB136F0E161B4E0F15169D14AA03E102B70C121C5D176D005A030F0445010516E30A420D1819D1156A006C1D8518D807" +
      "9B14491C9C0EF40E27048C16D51C931AEA14621ECC1396034C0CBF148F11F31E4115BF175D04071BFE16961DD40A6F0FEA0596089918C214220761110F1A3608" +
      "CC073D1D90039302240F440E4E151413DB1F0F07D6180A4B4E0052457032266AF1C1C904A86D7666CBD5E304D23C4C7E331CE59AC4516A3EBAC460905C971CED" +
      "1160B619E5DADBDB8AAA6DA51CE5466A12612403D0B461DF63C3A5CEC8BBA024551BD08C10CD8D0745EAEA1440D2011EA666FE7F14470C453AF88B1A10CCB778" +
      "CD0BB5EF41370853CC5E45B98C3155E243C8126FAD863DC1BB193E6E4C519E420D46FDA18D2C9887ED01C96F796A6D97EE689FD55507A3F1F15EDBAEED6A7021" +
      "EBE812C854B6C332BF85EA65E05320063E1AB3BC2F032CB15CE5CDDE12034E06318657A9DBFB4D0FD03961D44B6CDDAB43672854907743588588F9E300D55E61" +
      "8BE1906E7983E705E69CD2B2FD2FE104F16DAABBC7DD126113F31F44ADC1D6B142E7E4860B74DB44E5985E7253FFF0883A48FF0F6BD6122888B9B0064C2A9201" +
      "15A397DBB3F119BAE45E0507FF3F82DAC903B13CA8A7513C050DAC2431F129E81CA2A9CDA15AFE2E950F42CE3155458CA7F9BC87F5B0E301FE4AE449BEAFFCE9" +
      "FFADA478C85E7E271E5A1ECFDA79771DB65765B14ACE87F2DEB0F716F6D897142790414130440AA340A4E187590FD8D6B8336B08430FDFE59AC5864B9EA4AC79" +
      "EA54A6785B77461C60F5B286A0DBEFE64440AE12C97D26CF18BDB631AD9B63162B16BF708F7B6390A6EF7AD3FE718751EEAB2D54AB34514A14C79383F09744E2" +
      "DF9A4562B9CAB7F79165FF2A2C6B7D83318C240E9F49A42519536061C65EC29C2A8ACBE170F036B0B709C2D5FBCE0169C2E7DA9FDDEAE0601ADC60C0FB34C9CD" +
      "F49D3E19086B86371E24DBB3A9F9E90E8AD17F78CBA6651D1C74808A021FD333ED694652F6C5D3FB0434A2632C2EFD1D602C8688CA743F338D02968364CD5AAF" +
      "D06F6BDC6F18BD24C078EA7E1DD9665F8561F53E76633ECE6A20FCFDD8E5D47179CBD3F583BFFC234DD52104DEF1C301CC5960D10FA068491D4BA2B11F437E44" +
      "6EF9E69480D44A6DC68F23F67253B8B26BC880922A9CAB9F575333C3FD5236912B67444C4BD4509B791D0B8009F2C15FB6A1A73893969B95229029E47DB6B7C1" +
      "D2FE8237386B29A809EF363174248E2DE74CFF5B86C5415D8A4C7AE37B12C8DE691F49BC0126748C685DCD5934C0B63D13D2131311D21D60E602CAD22440724A" +
      "635F30AE731C93244782E1975CCFEC57D91B39E5F2B568FF91B9B053AB72F0ABCAAEE0C583F8408E2D614DC6728141F916CEC79A71EB654B57256281814D46BE" +
      "EF3EEBD3E425E4FFFA21754AB03798C94B8B3C7A29DF3E6AE0436EC737DFABCBC51D825757F22E1866C10845874E844455CDC3F6A8221AFD86FE6D6A2E8A3AE1" +
      "FE29CFB5A5B9A04E9AD42EA867B9562DDDE396F1B64FB6CDE2BB3731C638CA1E9F0DBE7E43E05F377D3C5B9AA0E980602B885A0A5FE275EEBAEB41DC4947B7C1" +
      "DE5764A0A3122718B8D30A0FD7BB400D23A6B8495B6530D0FC0D1AAA0846C83F3203CF674B600B652093205718155A35E58E064B7645D9F82900881FCD51E638" +
      "ED8ECFCEB3F8759C21927747AA9B726F4BD459C1FDFB482D52752018FEEFE1768A7591A9A665016D0F7F4D546544DADC29559FB2277BCAB6A7866D27DD9C873F" +
      "397E5A27B42E5541ECFD97313E7B281934487D9D8A47C5199E772468C9083312158267EEA1B200229D475C8993A4DB94FC84BE66F1ED0CFA625CF4715AFBEB3F" +
      "17F802317F76F758F9F4D9B2DBABF65F7C246D9D0C183E1CD99E4CF3AE90C2CB27AEF47057DBE0559EC2FB60DB8009F000D55B1A7FAC3CA328DE012FB4A62E65" +
      "DB08D3054166FBC5CF71B9AF6AD78114AD4631CD9588FF22B7614796BDE0BED7D90D1FE04CA260CC8B1F70B91411D1DDC00FE46955EA2708F2FF53BA712D5D59" +
      "C5983FC0ECE9B52A65C21B5EF222C59D6D1F2CA6FD244B89DD1A014DBEADDC82AEC80A00C71E9A7EC310B6825FCE2AC307220E442B6A75C9062290BBE0D19751" +
      "8C61C6E30056AF19E6B40B79FB1CC835085248108F144496509036BFAA1EB9A271C280951E7AB8CE005D5D36368122F767DB5DF4F04B8A5FAFF647DADFFE91BC" +
      "79774D712016AC132542403DD922E97E13650CB08E34B2D2033369414F362B78B30FBEA7FA121E6F93323DD52A07C06E18E0CEA6080F8A43A3FF1C9EB0C2B604" +
      "1A60FBCE5AE79471E49DAA7D35CA61CF3B98A58AC46E0074294024315545DD3EEA29402B41C8850C2B722B296A55223E1F978F0086978F60879B6ADB0790161D" +
      "C471072F78B6CB8BBCAB85592758511E019C9C879C3E528A0BE40726752F175E3361F2AAE64A9A03FE3B3A1EF4271BA648E88CFBA9A0A88C75B9695C962E9B97" +
      "C9620D51A5BD8D61FEABC5629411C76D5D91727432F57AF3BCA5A9F6DE4A5747793A1382CBD6F3CA3BE5591F433BAA2406474AB0295408C64949333077D66C37" +
      "0F86C58A20AB4F5B58A2A5F35346682D21DF82B119F2443B2924C2B0A599EEBB3003765A24F4FCA79F6E3BEE3D2DAF780960A4DF1CE7354695A6C83CB68ECC30" +
      "54970C5C9555380C8AE2E7EEB1FD48D541C82A8FAB522576F4D6F86F5C21FC02753B547B73295DA40C3C5AE51A584CE21A398A79223E211236853A14FEEEF68D" +
      "DF67CD5388F125F4BD48A3458641A41DBB79919839D0E05B37F1FBEEB4223CF7CC487446E242A2B2C1FCB9FBD9E4136EFC618236B6F0992952454ABF076B2259" +
      "4116B497C4A2B269E52B6F06ADD0E00A01F0BE181F5F735849DA334748F3AEC4B7B8E6CDAB81BC4A7FE26CC804B101DCB562E8C6BA7E2951358D4FA119E969D7" +
      "E3F7E4252890C41EF0435E7238CED440500BE63CA5593166353320198E9B2FCD991983BD38216F36763F5B7835CECC373E43B8EE029E711BA537DABB18ACEA2E" +
      "510F6672112AA3908852E0B1E79470DBC160AFF624E1000065D42C37E964EC5227363EE36A7F26831939A4E2F6DB393D39A7B205871576900B36C35A9EEEE466" +
      "C8F05861DE71965F4AAA0E671196FBCDF19F8410D9ADF1DA19B08D31253428FF0DA197E8FA4A694E0880AEA7DC6C4CE3FC8A5BBAFA155B15E61085C9F3B08651" +
      "13B8CDF43B086A5C32C8C3C47C69AF947D0AD3BFF7CD455ED037664864666659B052567DD7727CBB6C947100F25D21A97FAC61E72FD419DD5941421BAC7D94C4" +
      "7459268B1DAAE332887E5FDF438E37FF1452E2959B5AFBB5DFBAFD49B8F3D14FA9BF3DEC67FA73D6B4A8A6E42D6637D4C69C5C878EC45120C4E5E2F1C2503D6B" +
      "1CBD2FD0D9B18A64264D8A2A4C416EBE61314AB066F7ED9C10F96EF8397F70AD22DEE662404E3B3C8F691C70196A56BE02C0DD69C78C8E3F9824BDA77192D8A0" +
      "5B6697730A928D1A9A06800316F2238952787433662513F50517C73D72A52B22434DE3C0234F63BC1A0DEDE5A2BABCD1C92A1748B2390B44091FE287493FD370" +
      "96B6669C2851862D9801140A1CA904EBF68EF1135749D6AD29B5F08292B2CAB15C1DA43EB7BEA73D63081F64A8AAEBF95E2BA8D470764E0E64AD06B252E5EC46" +
      "7F1DB9BE9516BD6E6576530658E44A1A9CBD4A2FAF145BE7DDDB5D8B4447513E126945313B8A62E299C472B3ADFCD29DB335A1B59A699F781A3401AF9267E44A" +
      "9CB5833273C1448939363A0A1B9116AB7EE7E4833F580000000020780A262A6B102C02A60A5107B97A8C3C4690105786E92C258E46EC11FDED6F85962D103D84" +
      "6F318613CFB98BD82986490D390070ED03AA364CD59113C97B6A51D1351D37B4404C9FE7125AA5014808F98FDA594216F70A42FB7D1AD1BABA1B36479E47A8D8" +
      "931980EC7F2902F302A7004C61408B6854A4A819E91C76082BF2CED6BB47B0ADEA416ACD1F9BA6923952729AABE80475B922FA33F85677E3FCD2162F682996E6" +
      "74199FA86B99E08075E25953A904C8F7B8146BD01A312B6A02A5CB2EAC71960472AAA01FDD20FEA8544261B7893A18AC6FE703BA80B602C63E11244C0B9CFDAF" +
      "CFD76E3331E0499FDA0AF5643CB141FA283BFD32E93B6C5C182E8B467EE94EBD783B923B0A79E4FBCAAA7C45AFA2706F790E7EFFA44D3260D7F859240AE9B0FC" +
      "047F1CCC4664C72EED6D528858783150E5FF786F4D943ECB0677E71AC1000387CFECBEE74EFFB68F19DAD3E6A45EF613E3253B80CBEAB746D40F21FBC238F622" +
      "8A22A51EFB81F86350E7926C29DDD2A9760EA21515CB8889A8C8ED396AC82E98A93CEA682D9B530668B297F2FAE2C306E513F171FCFD661B3A521222F3A98AB6" +
      "5D1FEBD7BCCB5DE4476DC9A37E66F8D9D6B8424ECA0DAD7CA7A094E8294F56AF1AF723F8E61AA0CAD4F923C5F80089BE986A0F6D91639FDC899981AE2DC92B95" +
      "BA471AD6416AAEB61C8F37BAD33C6311CCE3D3D2DCBC0000000000000000A110C0E049001199172A78E383E84C41AAD3B111690029102439026250FE66D1F47B" +
      "571CCC130A46142708D4F615E165704C4E2FD1B513A7E58360A16C8AAD3C3B2154F99EA32DA83990B34A13415B8A70B297C077D7BEA8708530890CB2D3708B35" +
      "B3586233EBAABFE43737EF798B70ACC117B93F28B8461C8F17EAEF65495AA74594BD809B178F7862510AC0CB792D06FE56881809789C95A4929998D4835D69A9" +
      "EC1BCA9811D0B22C9703DC28F41384846D2E5589CC2E73449CD223A28F7FD80369EA0D371A984443C8B63C9B6370CF87B7080AA39F882C0CD2495E6A266000D2" +
      "181D3D1BFC56ED58DC8CC45965EF44405B6C164B762D1BCAF4B6F88B56CE5A7AE7A198336726E2B4ACD129F78FD78C185F34DCA316BF1A010C665D63D0FA1E40" +
      "F7AD046220B2188437BE96FB2962CA924CEE93F09805519034CDC0F485523C4641BFFA4D736220FE8BEBBFAD5850D2282747FA7BED321B55C45F5CB1CF62E479" +
      "DB56002D231248D6929D298AA1F55594129088D46AFC30677A633F4D52E029BAD77327415A9828919CB930BFBD322CBDC038AC2CFD89D8ABCF05A2E4EE6FE6CD" +
      "0C3D5055F91DEF60D88F94D0CFEB3715AE0B4A56AAD636FC845119D2FADC174710EABADEDCCEBFE079ABA598337EEED6B103651458EDBD120BDD62DEA484EAD9" +
      "3FBC1D957A17E8C31A78D87CABC9CB7B05C47A225DCF000000000000000000000000000000001C5D4A50A8CAE0C390084470008B20FC23ABC7C0C4D65683B842" +
      "18388803B3600B5304094129032B20936DB749A084460E24981694FA49B0122206B29807C1AA9D6711A5A96A89D3F88996784F54F6A992E855F2626B240C3FCF" +
      "B10088DE679C288C514F4A77EE8AB74D99A0686CD25160C5242B2EB918B9660A18E5970C8D3589DB65CC4CD49065FF32FB1F34204617E9A5AC25E33E9AEE6DA2" +
      "65149C3F218235FDEC3BEF7CEF3236D7BE7B7056D8D36D69B0058F8B984BA2DDD79C10B482D55C63B893BD9944C103475ADEF9930B0E26002F9FA517B022F3B6" +
      "BEC10839797CBDBFDAE8C30E7D20F567BC4E459FDF7E9C4E14697859BCE2045465FBA1D30724268E51955CBA7C9B8E4ACA3760A82F0774BDB8568E9AA4819A07" +
      "7EE28626E12A4B44722B835C52AF5953491CF05810754284A58D6E7053653B0C1455F28B5EDEDB6B3D1754364B2CCE734BFD410ED2BDF8595AD24AD00AA77C57" +
      "B7E348C4C03B36B07F9BFE277153450D5E4E46812E75B0DA2D754BCBA28DD1FFE67A3BA2C8445A7728BF9F8FB64FF6737E89BD9AD2FB443D793425E00A70421B" +
      "676DE798C0FD0581E7C90CA038C7FE13B8CE311E6048AADC1FEEA9DC20C2EAECECA213E4D9F034AE0710DC69E06681C376A57EE9DC4858C8412FFD999AE0F818" +
      "044F2EA129B845F245AFC1A69D88DE2C3203A11764710000000000000000000000000000000000000000000000000000000000000000080F1B08D01847B44228" +
      "0F40280C24515ECAC1222CE12C00394D684A2012B610C207CEA4C04309BCE50DE611D3C09EF892A4D10228650295721DA6023418920BC6263529EDC11CEA3D99" +
      "964C36784210F5913C03480E55DFF8973D04E5C670DED6AC0092020FAAC64484C93D5341F0C54C5F1FA07C0A2084CEE120365359C5F149B2B5176B48BB00AB13" +
      "C5C851FD940D4F70B6A2C3A60866C2985603D6858903B5AF63F17D3A2756244579795C1731C6EC60A3D4A86E4588F82C2C3AF5D7A01BA5CFB024A614588939B0" +
      "8DD4E8360B1F1B5741E4E87150C014024246E74449C0C5C4A4128C1F34CA4860B5316E91C00099D21554038A74D7266586F58AF3BF12D900F909176883B5CE4C" +
      "6D8890E78C7072AA829E95743C477884056698A5D5EB2BB7EB4D558D5579BE27098A8997CCA00A9FA5CBC961D44837D21CA52E39352F4D982DBB892F14925E50" +
      "E4CFB67C1F59CB0E90AD3974012494D0968FC3453D6301DE872A19E06B0366E8CC522CE9747BDD24244708B24641A6DECA7C32A51E527E36AE2A823062B71667" +
      "4F3EEE6017CF3C2662A86401B6B1D693443C2E4857E3207B8816D78AA445E25532C3D64DA5D6E2D97CDD09D0BA5BA4D911DA08EF70A8896E181721FA00418B6B" +
      "D3A5614466197E120C93C66D15C2B1F4C751C4486C3D000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000400845934A9107060053CA2EF0920264EB2199C0410CDB902073713903442A54C1C90B015047EB04B38C" +
      "58007A0114B0484868849BAC81001B736C40508320453E097749DAA01809E8015000E38288028974430B1026C89AACEBA0147A47DB41703A01D905A5849C9A0D" +
      "0AA043A4412144ED8A01403ADA30AC8868D14BCD18030C26F18F8C2A116C21E6A0DC249E34FD47242326D85616E5ED00B2A0F0E070D180F2660A9873F558CBA0" +
      "B58029C314F3A1C51A870FB591661A37F90105667F433F0BAC4D26C1402AC4DC6DE483195C046B4616DA6EB72CCE3658F1923ABA4B224C5DD25D2C7037924F45" +
      "D881047E59539F0828B4A1F89541E4F65CD80BBCE323FEC830A1989A4F53C99F5DA74329488CE4A9414B3A03FAE3C7C8D3D0A393E902D5C806CD48228F2461C4" +
      "66E641040925727A095F2818BB155DC0CB6BC0AE570B8680CE239406D3E04A425370598968D75889420996018A074C7FAB7058FDA2FA79501AE9DBF956094E94" +
      "84C85E9592DF68E7720E7ACFCBBED914C11CFC5AA80548EA86157F370A6823C3AD5D3229522C9C67108A26B9C146B07B28C6EE5F8020DD7217B53233A2809132" +
      "B013200B50CFA00C9E67EC30282E2D106888337F122B000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000031B20A3402A405675084018DE8560402F1420412162082A787A1473291350814E0A4217F75410E8AB8A" +
      "1916D8045033020366851854088442E0041280D643BC590A9E904246A5032303A280E1C40A0F01986B451705D10DA7E1492E8340284D7AD509212340A1608A40" +
      "130C534A0FD8310840814E58C84C024A90A0E90680206C63C57183C3110E70B13429CC1C86086AA5517E41408A05BE47BECD682EFBA1E57393106E694FAB3754" +
      "081552868314718C369E1C1004083C0492956EA1E480D5B4C3F1B00B6AC0294881090CDBE6EF10200C22C22CB3E12969AAB395FC17F984AB2145429321DA4F34" +
      "B0D0780EA3A06C266B4C868468BC43F4F8A231699BA0213B811FF16C6458EEA250828DCD0C210755F6B46104B3A30849EA76AF041D0518AF4E35E06D8046E973" +
      "09B46CEB1987AEA054ED0B720B0D014D208B5D4B2D8B15180B2542BB57665556D214A53F200536BC882E672CE23412A8BA5558366604695E211DB62466DA4F59" +
      "54C9748342D483B08351382D26A5D8034982069231EE000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000074AA0815E01BBAB02514E5AA380902B7832A64388C9D2000E0A05500548249690001C310BD118662114" +
      "19D505232760A0820402502511E531CC884D24421C13800018634A44810845B24948234612420021620804518280043041000CE09141395D64844C6167428BB6" +
      "1120001586D90C1927D0D346042ACCE00B6CF1053D45035904C9114200B5026C48C810288D082780AB8EAB12A841900C0F24A00726A196700411F0A842928015" +
      "400340561D1B26008A24D44183CEF13008859C9141908A0F4AE5920AA90480DE040B0AC25806684005D11880124DA9C3154201660C20A9940000F518EC346271" +
      "26735358015644442B1CA43314971006205A1500A3047550D1C6EC949CB0028C8BACA23626CE829DF102549EF7C441DDA730F4316515EB838E0DB50B20E0063C" +
      "2CFE79186B3867817344947DD02179F881E84A5F0A42B9E086799532284D519A18A0315C78353B7588FE2FE77E7AEB8ED85B3DCE37C7B1FF3680EC7C17AF58AA" +
      "0F538FF005A62D5A48D52713DB6600A94D8CB7E3A8EF0E3EA03F9402F6E61B506CC7E5A7CEE3AB1C4695A3E6DE902D26130B6047BA9D1800407E109F233BB98D" +
      "A0B502CEB69DB42D4CDD45D52DF50228B37F9E73EB94F213DDCAB36EF9BCEDBCDED4A1A976BE4026B308BDF0FD41AB9881E2AE901D7C8F08E8AD1A37F11592B6" +
      "1817F4AA537B1ED39B36DBD9378737E3D8256C194C10C22A71291335635F8975E453558793257EEB0F69EE4324D54FC688C4995BD2C35810F17E1AD43E066D8B" +
      "752914F75CCB9F1B1527ED08A3CE02343B85EE3CD73D597A1D8E7FD4C9773468D1D896926AC6B802FBD7501E94B03DF101B33223CC8E4C82D125019D78C9C71C" +
      "DC70EB05935F0221EF03D07C0E5DFC41B6F04A5ED5B229639EC66D4996517CAD941B38C851781CCCF90A48F121F79999DCACC4189D6EA6FEA663E727DDE055F0" +
      "EF46CFB0EBE6D322F6A3B01EBE0AF7D02CCA01A63E404C0C862760A11690636273CF3A628E493F6614F1A779670C426BF6A06DE6214B20950A5CEFCE0D63ED43" +
      "3FE403552A25D9BCE4883FA2AA50669CF85B33E9FF0D17319D6C55095529E903ABCAA1B45BC76C20D598C9774D50DABC54DA0CF5986A31CA223647F38F040ACE" +
      "D8A20940E044530F60A00E0CB90DF5AC24D738C935B15A6F2077CDC98C0009D3E858F11535943EFFFBF63711A2D0B0D7D3449C5330474A9F7B29A71FE49CD776" +
      "364AD885CF3C0E12A82FD2B222B6667B45B819649C1E0C44F0FBD0370ACC86470A9C3B1930132977934D18D3E6EB6BC89A016706AA585E64F88E8895D90BC8E4" +
      "AB58B4F66996F35C71F9317593153E3C88E67F08650FAB50BD272A06791237209132A82B8975EF640671BCE89E8516BA6AFB6AE053A5BDF53C0142EB1FD9C215" +
      "5BE2438B5380273D0954508AF44E65D5B6379298ED89EDA2CB37277EB74AD5E05E235F59EB76829EF50040907E3C6B1AECFA3A78C2A93C1A6097868B09C6F322" +
      "D756E15F9D81C04634DABE2907BE7A2AE732F0AFD2CABD659C2E74AC338AECC79100A5306AD7E3F37A356D14C58B0F931E4D745E701DFA3887CBAA29C55F7F79" +
      "BBECD3168BB4801BE96DCA897CF5939FDB0AF700445082BC0F09DEDF7818A58780BD81CE5F087C2946383246AD0D0605577C14213F6AA4CB1D78950555F76CDD" +
      "B2C3C7A7DDDA3775D835F5DFC56A6C51282C81F0CCF641CA1042ABDB092DCFBC37CA505F84F93D48695C3879B8C3A46E35EAF82D63D3B2AC2E9AA198C01698D1" +
      "0551F4A064C4FDEFB9DBC051C4A9E6274463D746C33C7B2CBBC0E94AA39E6FAD8FBF5F8DFE19B694A17AEBA357A889CA2422E99CFB2C8AAA36AF24526D532959" +
      "BB9882C7AC3CE8700DBF0812DBB8307B40F2F86EB0EA70A1B1B2FAD8957412E941D9FF346F947C5A48FA93D090903BE95EA1B6B1FAB8978FB5107D64883DCCE9" +
      "24F3F8F1F1BC4B5BB16D43AC48B30D21352A649A65B8E925333992B8A00E07388C5FAA84927D5071FE3B1230254882E5C7463EF633435AE32E0BD2D3ABC62C07" +
      "E57225D78B46AA566DCD2C03F35528BFB13D81BA22C29BA497D656C3BCFFD7B53534C79886FDB1701ECF9B91538594CDAAA1EC6FE260008636A809BA329BE4D0" +
      "72081D92A5B67298449C9F8A24FB7308CCCF851F46472AB329030C523512C444BB8D430E368679192E7D4F812900D63E7912C404A5B4DD711D59967A69D55318" +
      "DCE07985BE65DDACA4EF70B5784361EE9483C106A27B6E49A44B60EA201DF696F6FE603B813B376762822E1EEBC380525294B79630016ACA29F3237DD13D8239" +
      "C9B5D503C612B2EF61564ECBB2AE11B9E99AA685B3780441D4AC50D88C953AA40329D22A0B68AA28FEA5B515E424D2FE9995F0F1DC39B83C280E0488D7132517" +
      "B6FDFA2D3E7847CE841A0B5A51F138E70361DCAC78AF46DC26AAF98B638FA4EE1AA16ED1BDF5398C42036E902973ACF46EB1E6804DBA8F9F33B9ACA2FB8776BA" +
      "F62ACB4565973B65C916BC7E2B40E2D870594695875F0FA98211E262E91BDBCC235F058D57CD99F6826CE4F9C2BAA2472536A5D5FC34643CACCFB34CB1A1A0C9" +
      "B30D2EF252A05F96CDE7FF9ACA27AC272DFEC223853B8630B718884FE9EC129C1C23CF7B48B01532809F58EB647E3754A61AFDF6F8D111A2D5AB19B3499A81B8" +
      "2A7104E064ACC36D60EE1E86665F61ABA2A1333004B6E19BE64A573B38606D88722C0FE8013697F0FC4B30919741CD03B1DC9AD187D05174EE5F27020A497A31" +
      "4B6C4FABD46AF69B5E90F30D2A071A83BFE01C360F65970AB984DCCD44500670C90BA89522B9252BFB0F95792ABC61F6F0283020A789E4B0C469EBFF6405F280" +
      "A737154740B5A5CDEC0B14C099E2B83953CD4989BE47D1559982A4945155A0A6FD4DE8A291742B967642B06D9E10EA979A16E988356E6DF28FE533800B3DE430" +
      "3CD0FE45B9E6626D6C1091C3C871DE377D298EB4F8B9211EF0728C3E71501B0B8C1A73566DCEB1894A5CBC0AD923565E9B933270F9D1FCD574BD1192601ABA95" +
      "D2966932E8270F8A8B23CFF7F1A53F1A335E3A601BFAAC564F75886533580BB5D9F47BFF975413258F63A262B8BAFD50313920DD08AC3D36EF69374BEF2D170D" +
      "4BE941EFAB3DEA16249A869210C05821CE0C2E44525FDBBA03A9F1E0A947E81E8B92C24848821204060A64D01A173CC5726DF3D8C8ACB00081B65780B2DEA09F" +
      "FE1AE3820BA34445DD0994B264944E7BED1E2FF8BCF70F40DF50C9DDD0AB35302BAB6AA1A81BA664B86319AD702452DEFC4F269ED98D9B2CCCA1AD6346DB911E" +
      "D98C4CC482CABA14AA30F8D4B6DACEC120F41C77238D4DEB2E34DAC9197A8409D663E7624C51298E3E47558F8BF4740D862ADB4FCAD40790A7C974E3A299C28F" +
      "CFC36A3242A33EEA3F2BB6DA8FF7ACFC3878ADD61E9ACCF71A75F303FA7D5BD759F31B45F4B803006D1D9EF07BAED388E18F416112CF4C602FFCD448610BCADF" +
      "44A94C4AB64C93A5A951FA2867699648061BDA0F060A371730ECA144E78E88DB3B5242DD5866F7973D0736071B2327A8E403DF8D6B9AF0D93744D5449029AF8B" +
      "C3784F957571B4CE62E472736710832375E436772BF08A83D085F6A2F017D1480B8FFE51C1666554838A93444EC096912CE58E29E3FAA882BD1D05357BA0A118" +
      "770FD9AD66F33F688FBBDB2B18B450C21D451D6ECB27E33A4DA12B22D8E8F34007870D37C10ACB0133B5BA20359A1D676F1073C52D9EB92480DA6A4D72472349" +
      "0C8D67F5A3511EC269793999CF36DE6DDF018A68D4725C6913AF4B96C49FCD1D1DD3065C2122F3B35B087C729CAD8906E5898B691381CAAEBA15BCFBB444E0F1" +
      "1F0652133729DB68935AB153471A1DA3CA34D93D9297903F8D6683EE8DCDBDBEA279F867D11836B97ED8C9A7C7A1A93EC5CFA0CE874629D7510C61CD8F77C221" +
      "F0C6ACA3F09A6907581FD7B6E2BAD826178E1F0D1C869840080C73B0CC3D980FD3B5F259762AA50E36FC420941986F3D577F2DF2E14F3D8171840B99D9CA0726" +
      "42CBF9BC80F1697ED6A1062F4D80E8A5BFF2CF1C28A59279C2865E8590FE030469D3FED96B3230D902A878691FE1F340D1E4321790BE012DB7309EB2BA393A56" +
      "2939200009E2A180FA01B94736645AAAE11124F91DDF335519EB62887ACF325C13A72E724579E03D1C0603F84F16AB4198ADEC11B6C2AC7CD2B8F4551EED2383" +
      "961A01B50A350F2A747AD8108FF8697110793793B3C995223FADF229799A022369ABFD94F483BA98623BCD194A32C3E22650C6125F6F1B90F7C9CB9DC2688357" +
      "212DE0908B733E3F9EC245E473496CE38DEBF172D00D1FFE3634DBA4A173FEED1C2185E5800B56C5430790833CB182FB1E8A82163A425728970ACAA1A7DCB385" +
      "E57A428C58E021C2440913147155882F425DEFB7D1C2291613836506EE1FF0BD4DF6CBB048C8B758F478D3762FA3FC9CA07E11F3E69F764CAD3A2A881062F553" +
      "CD46B847E274AAC1F3A7E9D0D6574B3E3109E4E7926A3D40122232ECF7F52FB1A5DC2073426BC9B42024DC7ED67F75B3BFAD896C42AB024D3B660AFE0070C1C2" +
      "74FF2B1E6F81A132ABF793292F666C21B94766771B66FFD6A49E89FA5BF4F5A337966DF77A1CD1A493D3A4BB51A8F334A908DD40219B80877D1BBE0D266C14FE" +
      "C1EA3C46B2F62A1BF4C86A59440A8A31530C4518492467AC2F60352F17F03074123C890EF052F7325BA6F394732B41AD957EEBCC4252B103DC38DAF9B25C690F" +
      "2B91028FCA32269D912699D55F5DAF224BCF54994186B86EB8C56B51C4363DEA7CBB1E1CE76AE2796E83BC5CFB02F1A6FA9EB592E34870F86B84DB5DE6E21CF1" +
      "3DB6A0112BABF5F41AAB450587220CB034BE9447DE769934EEA749DD24B95AF6F319DCE091DF1903B7409070313F5914E1A3DF1F844C9FF90FF2373016F28DD9" +
      "D15C2669457042E3BF7950DE4EB250D7BDF30E5BEC5E2DD359674FD3E253F39D56BC89114C3F95BACED6670C231A2EE5FBBC42361D9565856022832E8332861C" +
      "697D4A9A2823F09B88210DA3A2836031F59A52E9A221C0B344F68BE042620A1EC81A5D54CA1D52402BBB3FD1903B73311BB4BD368FEDEB2FA5BCD5CE4B70E76D" +
      "D3408605E2ED3FA52B2CEE4E3F837E26AB7BD0F83C96724BDD54FC11C6D528FC553B5EB2B3F0B23446D5225590A34201E8937E9FC9DACE3CC7C0AA789D59C060" +
      "0F589D130B195ECAC64249B878DA1F8517B87A4F31AC08542E6256D99DD940047AA002C66270AB390308E342C75A57319AB8A26EA62A8B5A01F4EAAC6C4AAA05" +
      "29772E1BD10673EE9E93DF12ECF1C977E1B01342079B677D9767DA3E385B0E5E0A6E9B5553E2798B8E3D08A82C9321CFF06701516F7B66D74EB61BA9233E82BF" +
      "920DFEDE7E24EDC47909997245D05A86DF6AB24DFE60378D4582FD0B3C25FB7BE2436A163F2C5E0B038BE7CDFB75534838E59002C0C738FB2603F9C216E2510A" +
      "5FE67C82E6A41E10743245501212C11D1F6136ABBAC59274C226D8B117B8538D564AA49062F6BE960BB11F5ABB414835CF5441773E2E2F5CFECC59851852C8A2" +
      "FA68C34824A7ADC81FC393EB9A5AC892EE06824F5B90A1F37DA428D6045063D5903A44C5D61987E83F5A8A7B3A22410B461611219E1AB7B8E88CB6D7C86C0912" +
      "5B19D07340DFFED54377C5A1822894CCC9F37033B141F4D10CAFB9BDC785D42FFE0682A403C169168F1918A73882464BEFC79E463F2AC6E0D8139D593EDE3070" +
      "E9CCE28B9003716654213C6D0359BDFE137A0E526F0E1F92761439AC38126FB46464561F7E67A2861B3C5E2A6BF0386066E41D0C23AE4600AAF3239E8B195CA6" +
      "FF81F94DB8ACED0DF24C9BB9899CE7073FCBF7B6226E25C9DE3C3675778F4BA1B9F2402D09A8431C7132D8AE0CAB3456FD13CB9AC41DFE6C2A988E8F5B1D6094" +
      "B65B3CC7DB62129E3A1A55B94BEACB3E769BBF5C827DD5DD7212C824B89C982E76B575DC9F69B7896BED458A53C54832D314968ABDBD1593C1FF28D62FC8C382" +
      "508399AC9566AFEEF3A5D664B7925AC97C76C80FCB1A27238D0B69A6346FBD16740FF672B9B11BB7A0202E082034968DD7C991AE0B965FB905CA2A188394E739" +
      "342F57AF23752979504A00EF3F4414F92FF56C3FBE5920D03CD4D3FD30D68DCA8D8D3DA4FF76D44B7ACC5FD1FE66035880DFAB061D357A81D7A1C63894D70B7B" +
      "75B4246B7511B24A862A00702CF8AA01393A5E60F1E10C543E197FBD6C6B4D918DB375072BEA93634A748596E94D61F17B62D17DC993144C48AFB2A02E8BF661" +
      "2962D81EC0FBC4D27FEE05E1E3BED6F34B6ACB6BD4FF7AAFCB21CD65889FF1CF37EE105028065B68F3582EE3C8E72CD90A0261D81099B5561E7252AD263382E4" +
      "CAC5AC2188CFACFD22B74C73D2223656D670A36BB4FAADE026DD43282D8500E9556B41C24777119068147B8C7C1FC082A2FD8DB21728A30FFF2A617FA8CFE794" +
      "0B06D6B50E43783E9AE10BCE0529033A56ED3639EEBDBF3491328C44DCC393187EAB5E5FEB46AB04341FC3568087714A24865DB6A804ACB9CE103FB2BDC51EA6" +
      "FA6BD926E471386C19ACF4F0F75679A32409F51678B85381A32DC3E7390AAE67750EF9AFD6623626BD2B53C2336BD589A17AFF7D997FBD6766B99018823E6FD2" +
      "3A417CC7B12336F9AE5C1EC32B692285B6DD23EB59F246D536972D4A3E03505D5DA26B07D06DDF63BF61D44F0ED304D3311BF955606F99A05069A223317BA808" +
      "CA609E1095D8394584E73CE1C9042A41C4B6023CAA9386ABD84839FB71B96286F4D3856F10FA7CD378D7A428AD6A3FA5789F13F2E52BC354DDD190F69F0EC6CF" +
      "1188E9375C67C17803867928EF15E2284917C3E18D232AFB878071BDBE371D5100EEA15FBD8B30059B2E577FCD3092B45DB1F24E0B5A3487081CFD0286E0380D" +
      "B589F99AC575C968E28BEBA9187FDAD665E0FB9A8EB3BE6F31C22532F1433CFCE3D25DEF05A489C91CC0D228296EEDDAF9C836F403CEA6FB183BEA19047E24F8" +
      "59019720ECDE3239C09A550D714B8D5F3CDAEC3E2A51B9D1AF5006EA7DFD3312332E5BF0E7F584BC9B75CBBBA660DD30C3EC093C58D4D5A99DEB8932CC947DDE" +
      "B7CDF6191D5E575BED8F8B31A16C083D6D5D38DBD3ED07D74A67FE5279A43E8CAE16D70C5122541D44DAD77DFB0D9AB6BF3D2C2355523FC669A0704BEF9F5EBD" +
      "B2F5C3076CF8B215501083AD3DEB49CDB1B5D222DB251B08DA79D1D1FC67E20F789596EFFF7EBAFBB86A6D406BB33FF339506FD781200FF7EAB9AB287FB09C1B" +
      "23F3C6A8458881982E47F598782B15EE2C7DD0ED2E6CB80EBC1394829B12933B9E857693A51FF430CB0B35751AE80F7B7095DD282B11B22E9D55C90E054903FE" +
      "B6D105D485FA4E71114940EE2BAC0AE0DCC796EBFACD7A47938ADD997D0CB46653DBF004FFC3A729BB785B3BC538103C1082E37396945395740DD81FA1334ABD" +
      "8E07DF6C8B8052D8BBA530EC6E4F0647EB6066E0E796E21645D365B9510F920CC10D5965DB2117603EC4B02FCF7E8ED9F11BCBDDAD08055D8842E70D8EB91295" +
      "48348806265EAAB144F3C5DC1EB4C9A997959B8A746FB836996AA7943C8BC137DF0F0BB2A08F789CF20BC877832941BE4D8372B36C2EA399D5144F1C2BBB5F57" +
      "F40F39E5DDCD534C08285CE6ABA4DE0482E8734477B0706276C0E6372BD7703A6BCF2ACD67E940A4B987ADD405F796785D2A10EEE66DC34491C7C3DF44585EAB" +
      "C1E6BFE4F90BD32E974416ED875956C48AAC8730F81C6046343BFFAE10D2F12BD984E257D83231053B30E2A080A9CD5FD02D549E6581FD94F78FEE13988ED2DB" +
      "7EBA2192DC8A4FEA048C949EF49A4457F0BA5CCA8505B0A93A3880BB0683E74898A0BC92E486FBF0F420523D5F9B3E10A15429EF5C8B24AAC883E9D1EA65A44B" +
      "CC97BB3F93BC3BFF7F3AED4522AEF766AEE6707E73F62B251A5D29186AD292AE08B2DEFA6F4A4A05850A8C69C6EA685385C36C3A7C72F6C642F0E8C07EE12D05" +
      "995BB9AF5B24D4D483BAA706CEB515556716E97E022D681773EC6C14A89DDC8092AA08C601F7D1998EC61F77B85DE818DAD79EE8B122D37E61496B7FF61B528C" +
      "2D98C1B2CB337106E54E6BC6D1BB1D6ED250E3284B6CB712180A5C1CDBFF8FBDDDCCD906AADF9543B9B96914332190C1E137D85112A59DD8E4EE35C29F7CF136" +
      "1EA3225AD482685AC0724B5E464A93FBA2DAA8BD763F03437122094BD4C329249D766143C9EE04614E4DA819D550C7E5D3F85390C3ED3D19541AD78133389F61" +
      "00930C353013012D7285C65D1248A91AB9905FDAC59B6C164051FF3BCF09F101EF546681D5AD0BBC5E02F7A2F7931D5ED8C796A3ADEFB91AD714216691ED382D" +
      "F4EBB4932DB9889B5E9BAD483144D1C2B06DFF5ABABFBDA765AC17E1E8AC90EB143C249884A3E8228E332E1C0F557FC3A30AF10A4283C40D18A96CDB9BC68D3C" +
      "1890E052826115E5CB516C6979C2A0157DBD46939703F70E2C90AFE1D0D3ABD3382EDEFDB58C936AB60ECECAE6C00E11B9536C66ACBFFFC18F1195F4953D858F" +
      "62D496F739BFA411EF87367740CC901C6D491346A64FBD9E4FA6D906CACBC4343A4E8B79F0AE78CC45CB0CC695C48B391100449F4A5E654F5432C301F5BD9E02" +
      "BB587C86C69E82DCEBB4B1C2F2503A8EA886415FA1FCFEC37FC8B8D9BC135FFEEB923295430099D2DCFD96F7A6CEA55231D4C0676D11D189882B014D5F19D532" +
      "C0CD25F7678B2706E6CFC654D010C7D300B00F4261F86F5AAFD0428A9AEF232E7A25A6726C41C3BDEACF19EE51F62AAF4E69BBC4903A9602E1DC63D93555EA15" +
      "7DAAEA5845D67C9CDB7E1F37C714983C2E29ABDD2D37B32EEAA92A6E296972D5A9E40E3B0EADA4B5573214350CBC4B0A9C2E58F31D1188D7B0EBA694C16E8991" +
      "DA780F0F2E88FAF45801E58D90D4703AFD8BEBF3CC171ECE4A30C2F2D8CE3144753FF0CD1D7828F5D95295B4882560DB57DDBEE073CF53396D6F651CC264F8A7" +
      "BF985B604E1035EE4DD9B769BFF8C95CD8D7C011BCA0C1D5E98DDDB27D2F97674DB1D11FC86CF4FDDE3AE6A216F24D2AB31C699578772475D97E7CF59577CDC3" +
      "DB517A5F10184DD9D4A55357BC263FB6797BB5A4995EF8575060055E984A7FAFFE14584B0C698C423899A32BF827B90794370BEE53A78CB5FAA26482C01F6C7A" +
      "DD344574E5882E9BE2CC5A3332DE9F34EC3A6D7B81A635D371CE645B1092539E56ECB6AB89138F683031F2E012BDC49D7B2F8F769F8EA2EC9EE394D7CBF354C2" +
      "C438161D89332FBABAC397729C62A255F8F0674298873C0F8A1F2629E549B002CF80B48EF438A125E9457A343823FCDAB3FAEE2345B5FD9E351355CDB0188AC5" +
      "B0F5D562086E3ABAFD7BB529A7ED5D3E0E010094CF64CDB8F7F2177B387A5A5724B3AE2C4E33E4816664D8972793D23D7C348C297FC71699D7B9890DE26866A3" +
      "193BFEF98E3A86883CFC5459D51BA40876E44DD9EFA3A110814F11D31AC18203424E53CBED2B0FC34EA5D584213C22CDC00D3F545FDF174A61901C9379062ABE" +
      "D2FC7169B48FEEB8FF536F1EA2180132A23A99E4EF9F4B1F852FD48CC7DC49CE2ECFF4C9D8193E7391E833124DA5AB68FE839CD226F7758CDFD8F850D320C4DF" +
      "382347C834F3CA68D9AD007860BE95DA7F464557BFA52BE187F9415127FE94B28736A36F2975F9130A838A01D6F59C7324AFAABA02B31E667B2F3B02B2393A82" +
      "E09B58761285B7D1773B2155736D5D5D69BF40EA23AB857B7BD053DFC886A0E3B177B095A124168A2C728F050DF570240C13622E9E49219F6F5C4A048C7D82E2" +
      "4534D0BBE9FED6426E844657C122F5836D262840BAFC5459B318598B31737914C069E8B36C2B07874A4C81CFE514DC68953A1E63123F4B996E2CC10E225397F2" +
      "94F63568ADF9A5B25CF2B93010DEF9B498F82AFD01C177F9768DE69A60E3279E2377F9E24961050BECBA9CF12B942C9730ECB2253CFE2E7590D220581EF35B20" +
      "E5B557100D6A9ADEB0D9B603DE205DE473D8A420771F5C4017D37BD7B090D3CA773F7EC942395A9B37B11F02EE0DE9460C74613C7C08C9C8D0C69C2CC80439DF" +
      "ABF742D03ACF9698056657A787A480A2AB869FACB5A5AC6247F07F867D271FD57AAACBE71D204F0749D78B9BC60F5CED13F85383010CAE409130470D269776E8" +
      "38A05F44F1CEDE1914B06372E277CAB2B5FDD4F905C38FF4F67DC3F44614CBAB3FBD266B15C3EC02EFD625C2D5DBFA852125723C9E2DED5593930169C80E9E9B" +
      "349F21492B66B1C367825044B90FCC4BCA4138D3D759F0E998DC89CEE481172AD536DABD5E028304BB896309E561A69F92A64111A564B40AA981509806B9340E" +
      "A7E9B2DBBD70F236C1A4A1520FE6C21D1F029CA3DB1C6B104D7143D4FBB0E0AF57FA309E53C880FB6DA6B4CD2B6AAB8A0A8EDE165BB717047024D3F519B88ED8" +
      "0558ABB8E622CBE4E58A7E53EE721EF8C6E5150BD5273246ADDF0A4DE9912831144DFD025E25A7080F309D85AEAE158AAD6EFCA4C33D114D297ED04E7FA1EEAD" +
      "31293A254897BCFDE4BA0C1A797C8C30980299C5E03679D74BF587EE25442F22C12F271C5A94AAC91BADD2B091516D99E1793B113053AE66B02D72C4A5B8C44C" +
      "24E1FB500B64A218D8FF70AB8320BC6E4ACD11C8A68F0C059CB139B18354189BB999E0999107D4563DE0977665302EEA04CD21D73834D8FFA88F20EA7C90E030" +
      "933E2F0A0AC31D650AB913ECFD244B124DDDC9052CCD9175499BC72506C12B68BAA4D37EFC9237C7E5EC1B9A6C28B80A506378C17AB4EE382F5AF645D5437B20" +
      "D8FE0B0E3DB421ED734D2D133193D1DF88157E888D24DA298BD6D3EBB34FACB2A4707048A46CCAF19EB7459D6D1DCDA4E8FAA543890B3372D55769B5EE9B18AA" +
      "3FAB034D93ED95BC3BBC369B7F27593C1874C46E45DCE8D0621548F0230C9BB003601259AE0D2D1AC2EE95A9646A788A3A09304E1613EC833825D28E");

  const KAT6960119_CT = OpCodes.Hex8ToBytes(
      "63C39D29314866A0FE528B3D5DE37D5C6F72279EE711036198B0C2CA1F293D3541E0D1467D63D2E5C92B8060001CF002017F60B954C5DC457BA63C59BBE330BB" +
      "66BC8726E605ACD0E90CD7167376F68CC071D4F931349564EF28D7EAB3D1FF61563EE1DEFD95A548004979736AB1B39BE08D57A49F39988F23574A5A06FC4C31" +
      "7F08C1B842EF844773BE74701E57EC91107DE40C6EEB222630621A6FBF2A4CB8CCB9C395ABD85FDC03C0FBE0E56EC9F7052B90608E21653FA2DE1AD62C68C265" +
      "6C06");

  const KAT6960119_SS = OpCodes.Hex8ToBytes("ACE16B9D437E56401128EDE4EE3A1C45CFE13D8E8288A3754DB4D9B78C5A3DDF");

  const KAT8192128_SK = OpCodes.Hex8ToBytes(
      "55B9D5A28F6A2BA670726F23A7393D0B55C661AE6B6A66688696017C70B8B894FFFFFFFF0000000094198C175B1C860FAD0DF20839022F095612E0096C15EA17" +
      "281CC81FD3181C00F006521B341BE007B3067311840EEC17F90A4E13DD18A81DD70DAD1D9C0BBE03481514044B01C60F8908D01F711A3E1E400F21129D10540E" +
      "FF1BF0188B16471CB208331AD50D4219411DA70FB0026B073B04F702BF12350543076B10890A3709BC02B3182C0FEA1DC41BEA167515BC15151F19020E11571A" +
      "6A1DF0190315C5024913D71074076F035C0DCD04B80BA2137401021B2D16F0081A1EFC1B1E04320B7A0D90023A170C0B0C1CFE087B0DD2100E08B01F2909181A" +
      "AA19770D151CE617BB192512B812790C1C1C78053D036009BB1291073610EC026714220D67152A0F843F989C8E3E3064A7930FEF0BA3DDBF4C43E21A40E31BA1" +
      "CE9AD28EBA82CF811AB783D3460D837C69452B50D80ED40CA350C42B7401FB0BD5FD94686B1C8E14F97D1446B2BE7C6757DF777A1C1AB362F595B2B021B703B6" +
      "6737D11CCC89F01DBF596A33DDC4C16EB2C5441972E65B4F023FA0ACA7B5103362EE1F2497FB400ED066E6892CFB9AF95473BA46B148A485EF48521AFE118EC4" +
      "19AAD3FBA03A43E3EA7B65D62D5A189AE69A3A20BDCDAD62E8A4F82628B40BA29D58D1816306846FF595E7F0E1EE15E83286A73897D34CE1F5D2D1A91EFAC8AB" +
      "6419CA37E974D912F0F2A4F9445EBF682F9AC2284E27A051F9959A1093CADA33DFFB6D7C036C7A4A81BBDDFE4030A1F53458087D6B9D050C5C802FA69D26A8DE" +
      "C429E51ED1F0A79AC2D44ACEB380E1632A3CA3672AADBA0047D03780EDFDF6E65FF3A0E00B032B04A03BEFCEDD52659A8507D3F7E6B72576C3F0D55F63211E55" +
      "0DEF9AEDB8837D7E24E8BB36F1BF7EEABCA29B49D5033C0FFC6A8E37965055EBFE07BBA0FDAA14C4AB3CFEC430DDF52D92091F1D2677BCA823378989239DF6F8" +
      "AB876A6EE1ECD3B186CF85BD72E6FD90D090CAA2ECA0A6E9FD41019A380DD4558EBF8083433266EFBCEA2607D4F354878D40DE77AE661DCAAEADD1A0DEB5403D" +
      "2F9B995AE195DABC00BAAAF1BE7D7A8103E7EA0EE184C51F7858C60D25F02113E8B09D8E67594D44041E603DD38C7F2077981900D0657683548E0D77FBDA93F0" +
      "F2D9427895E7738A252443CD2586B16CAA5520C7B75DDF4D03C7D9F56F1FF959EE376A4E9754DD078411F64E8289EA8A612FE09327F1AA56D1101259FB2034F5" +
      "E7CA04E9CAB762EC271AC39D04BF5F31B5BD54E9569CB24F6E0F0B97BD37D5CCFD31B404D8E7F6A59A67E19BC401F6042CD568574EF5E1E75A54DA9EB3E02741" +
      "ACD34FC6DF89B75CF97663EE8D5809FD1825684AEA2D528ED0327CF15A22FAD3956313BF75B77097926C705024AAE565521046482444094C268590DD3963579C" +
      "AA44CDC175686D2DA1EFC15D8292027CCC0E9B9D164EAB756F2CEA2AA4828F196F264148AC78C45F8CB7EF8D2CA92D16874744A74BDB4D228BC1E4A5C028A330" +
      "5D5502B508698241A136A19B1A2F17E3C92FD67C1795522A8146721657F0FD2760EBFA923ABEB5C11D731B29EB9A7DBB80E407A7CEF1C0C3F5314BF4889A6219" +
      "2F18AE4D1B40A2090E4423D532E2FCDF5BA974A900027E1072A88C026A4D7F34119AF5CDEF764463A07EB43CC9352565346AFC5476745CB37B6D10003AF0FA37" +
      "B5C9B4E9BD6A7ED6E0066BD9D2B6EB6A1A20EFB6D6A3D9A6AED91E9B772CAADEFCEF8332F1090D7CE130BF01B88203EA5C25D534A2295ABE235057254537CAAB" +
      "5552A33773AABCA7B28E217816A13A148DBA4BDE7F51578F8ABB2FB95898B1C1F07DC0214394A68940C19551F792C754A134E0EA12743034B186D16B29A38C45" +
      "B58137ACE611A5F6891D374B5967D2018286A3D8C107269FCFB767DA1294E3EACB5B4CEF15E1DBB91F3109B5C5B62B9D4B69B32775FAB846EAAFA4337B5C7DA0" +
      "EF8B2444911455B4B4AFCD49C16CD700A6ECE1501BFFAB76C871F1A202197BA2B4867A0A1F3F8E6B86B7E013A68A08D3CE044C8047E9619F4F9F58CF06CCF3CA" +
      "85B268E10D74272FC591AECE4262BEC5D8BD9868EC30DC0A9E214C99053188A6004BDE8E20B6D861365B31DEAD59D2556A03BC3BF9110CAB510D29F2C4417CE4" +
      "69B3C36C959D55AA93974F094103839BD0CF2867AEEA3E034F8DBBE9473AC714AF238AC3204C2540B57F36CCDE5FDD7322A72D69FAC5FFAD5C74B8A3FD377B9D" +
      "7A38A95411FE287D244312610461A7A6B6406F287551CF99C470CEC6CD08028166C384E27E5540AC942390B14B321505A78DF13666F7F5DA55568F9C45BFD732" +
      "5CD918949F6920164E65F448EB0EBDCDA1808DFC84959F1C6DFFC32A69A6217154F2FF65866931DF446D23B2F127FF66A934E4966521D2358993E747A0BA704F" +
      "6D20BBB3DFF602E83F2BCE3C541EC0446D10C35DEDB45B9FEAE6AFBB83DB27E52A739355166EB559506617F6E131212973DC116E227B3359D8761B2C49287B7E" +
      "3E7AE2680D2928459F0F5350D6D71F9110F84BF0470CB42726CA31BDD1AE76D9B65CFEC2FD47864F008C001697EC77D7982BFAB48B8FBD086EDD78F172ACEDD0" +
      "8B28C613540C414DB240FCD84F3EBBF1890D499A2C9F3A2ED6083D6D78E46E94B4F46539A2E121766845299EC888A80F32044F304A0B88950C7543CEFB3D0212" +
      "5A28341EE6F1AA2223793A498FF08D95EEDDAB6887C0E141BC34D0B5AD392E6D25CA125D04E2C855D5FB6248E3F79216B957866E083D5DD1BB6DC98D60F93C2E" +
      "3B227A16C1FC5ABFF47A797C7DB1154FC12AB9E6C3C3A1AE3DC0AABFE92661E536417AAEB82F732E9263C29D9D53367A535F26A3B7B0197C3C4FDC119C288995" +
      "27924425CFEF19C8C6265C8D85D2E093662389011ECAE23CBB90A9132E3568975960128993E0124C3835952A8C7E3E89B7BECA5FCF136EEEF5D446682B74446C" +
      "EAAA7D0BDC75D43F2E2FA88D049CD266685EA09FD70EC5469D0562CE79E22B70A179E79AD6DC5F02D48BACC29A6E7ADF14304A3E7D85613C2C7060E8087A79E4" +
      "11FAB00A4EA0DECF98D708C531BC13011D99FB5764813DD5EF4205213532464A07F361F548B970D09F1719219BD28F8DD23F8ADBC9714AD202A58FD836320CF5" +
      "8035C97B011B7E52F0BC92199986E225B6ABE8BE631E022D514CEAED8A5115B76E80EF57D7AC22B18764FBC9A6E5D328730501DAA9A963FBC2A547A7DE85F944" +
      "EF2CB98ED5C74C9E8AB6F4909B5B5C96C4B122C019964EDD9EF83B5932A54A83F6A3CDE7403B93390000CC4D5AC712A0AEBFB1632E94417A9EA1ADC4E9150602" +
      "0261A8A9A341BD308CC5104831980FDD587750BD43AC7FDBA450E588303F5429A04B0555533CEC58676E4A273C2DD3F2CFC43041F8D5EFAB179E03883C45BDF0" +
      "B60D4E26E780D4E2BF852E7BC6CF54EAE1A4A8ED23E4857774BA05116DD9C8502A12FB5C38D36014421BE9DD64C3C10857942ABCD79DD1BA48AA3F228430E442" +
      "765E7501D97E1A0CDF91BB0F041B377DD373B9AAC22849345AAF280C1DA2C6634D658AD2B14CE63ADCB2B79077E7B095CACD57EE25AA11AB84383E2824B04DAB" +
      "3DF5D388077680223BD92BA3E32A558F4F6643E7B9C978C5E3F56EB4A5280D1AA151EDEDD0885A5824A9752D620E9A99B713BC404148022ABC211577483F2B63" +
      "C39A148DDC739402CB5A9F97396C8EEA1DB22A28F709FD7156A3429185317DF536014CA6A165D5741F81F0C50C708EB679FEE4A2E1E91C864C0670843414F377" +
      "5CB36A2A683FE2D6D43FF9E50063335ABBD763366A3C752A5C321658B7B28FA429A56B691C3CDB6673A241E31386297C57FEC95A9F944C7FE00907A924AF6F6F" +
      "A67B7A2873653A77A5AB3A7AAAD408E73FA660AEE4A40A7BAA87FDE05FB0DDCEF3D9C8AABE0FC1EA32D4C94DA1D6462AEB155BAA1B816CF0F021D9A12A62D4C2" +
      "9B70B9EDB6F8D24679B03CC8A34FB1F8B74E75564308AADDE12A108BD13580103BD99EC179CD8D6A00000000A105089048C01C5881E2082B5989EC33060A58BC" +
      "6A140A4D02E4E1935E439A2EDD5E72443AECD84C6B8AFE7D5B1B5943A00C3BFEF8D55036F346243CF5AC400C7C01E89A27ACAF479693417E39FE244AF87807AB" +
      "8317FAFE007C1D0B9612A5B75DCC07ABF987A0D3BDE191113D05475312850E89E12D660B15DC114D40E02A63DF7D5502631A91C4BFD7DB9C122F9221A6EE4A33" +
      "231BFA20F8FA2733632C3DA56570AFB1120DBBA67860CF06E4C464D839714F34E22D5A18283C02990D561BCF5EC931CB05005A1C59B6AC02902ED57F0AD40081" +
      "A59128A15A6343967AAEC21289164711670EC4E31097014085F1EBAA269FD8E248E76AB1EB98AD049C3B892A78397C933E650E434AD1F375042ECAB8205CC933" +
      "D5FDCF8C903D7401CFC1F9EF7B07C77B600BE8F0619D0570A7F750782BB47C939DD45CAC024A4CB043BD1F3A6ADC1BDFDF4750A25A8002456F799299DCD9618B" +
      "31AB6F21B191B74082056B815C4FCD2EA75BF86916F1C27F6E53C6C975198C30561A6A377DA8572A23075B047F764ED2CF17BCEF40DB5425A5D492A1174A778D" +
      "40A10F265A42B39BF4D5C65FA3F3551176C75D37C838B540210851836CE5676A0895D363A9113D9109993C8367502FC86ABB05192364C5D3C4DBDB10695F5AEF" +
      "7E266E018B5753A64D45E6807F52E332F80514DB863BB27DD2E1FE21EB4B3DB5B3C7CB4902762E4C0000000000000000491E917083406712E11014ADA9379000" +
      "8A07AE854E04163AD28E1E915DA36C5D195CE063DEA9C3CB6E4040E543B1FD50863E886C3DD4C00184A146075F57EE2942015481841429BC05BC02D21C5C1ADC" +
      "3BED64529DAC9900339BA422D1833808E10800F64D57DBB5269C04DD7DEAD4FAE6D250E7969B1554D3F152ABC01740701D08182A736590C4E594FAB1743CDCFF" +
      "C0741A0898D46E657F875A6CD5D8CB2CF406A17CC079F4B888605D5624003E7527DC43AAA9F02AC2D4ED0F1AC83C79286A4F1C4733F1082E1E9C09557D0078CA" +
      "6604E32A5B961250F0E99B4918E1EF2BF81695CA0EA80D63ADBCA269A15E18AB96AA5066299FBC19568F8964A598D1C7D3EBC548AB3E0F05A51E9D1360620FBD" +
      "447E31584C068B9F4300C1DA6FD5575482E94B6911BDCD6DE0D7B101150E6E30907522AD14929C56CC420774841BA5056A3FA16FBA36DE2A504BAABF631F9C28" +
      "D780947E3191D4FAEC85AA09C1225686A5BCBAAE17A88EA5A8A80F4FA964C45919B2953712F98FF56CFC34E734E82F5BE030C468EA6D1E20EDF31B03D83F00AE" +
      "9C24C9681027226E04C099EB40BF4343A15857F7549E7C108CBA52C158B7BF8204F2CF8A0242A44F51A79667B513A925A2C02CF6415FE53D3CD2E367484252F5" +
      "AE501DAF783D5AFCF5F4F21A50032C84917C34D662132DCAC6D7E0950EC44AB19A36BC0B5C2E6CAA00000000000000000000000000000000387230084068C600" +
      "21002A5180427905403228080102E10311AE84C22E16C4ABE2882A355D4B0A2346F582980558165B74CAAF4D65F982C008B5A0AC96C98B940A8CE02604186260" +
      "455AF8E110B7C26C3FE35B56859B1A42EAFE1D91A9393DC09325C2B73D95082427C823B475EC48262CD119BCBBB392758C77234E3737DE93D46E92A4604380CE" +
      "DE05D77B7231FE1A4B32BD3DAA14432EC6BF6E707B7DDD0CE8EDC06484F9BCDF8B8E81B483CECC34BA84AF51BF5A87D6383400AF3C985DA8FA4B9E2B085DF1EC" +
      "9E7E3BB79246CC5F0D8580D90BE836BEE09B1889E2E5142F107053C5EC43C66FF8FD59C1B52570A68726EB6401EA50E8972684CA638117E1DB45BE95B6C046C3" +
      "CA4132E012FF752C69A99C7A96FA1D964977907F98799446A97B24CA32F13977191191444ECAE0A9555378822F80ACE4B4DAC2A9F887A82D69E4E8F8A337A0DB" +
      "5B1BD6F7390F6BDCBB22E094A6730CA3BA8391EE0C35BC4B30D5E28E60C66A2E24B1B56C526A4F30C8E4E5DA01721CB75344426D08EBB740524D59F5FF9C68FE" +
      "9A026321F02862ACBD1EF1EF382E367D03AF4AF4D62570AA7EFBCEF4357FCB990AA2EE4E4380B6CAB7F46AF465AAD5574F5DEE98150BA8328F8FE27362621B45" +
      "EF77E6996E6C7CDA621CD59E138945B77EE7BB096F10D4BBA55946E9CADD6C61FFCCE5212CA08526000000000000000000000000000000000000000000000000" +
      "0000000000000000ED848622E3894184B55320412F2E3F015001400415AEBEB121DCF2585332960271D16E8209000A008A139242941D8C98A85CAEC99CD3935C" +
      "D9B30438290A22016681F32E10328209A27B6659A194762A831CBD188C271AF0230D96261A58388348233913F2B83F773EAD0B6A209193197E9F9E7959899925" +
      "8D290D52CA1E750764172014C88CEC52C082B154869EF5823D4829D7C8B74202BCBDE209BE53901CC377FCAA88223D573EBD2280E01C19780808960A539D050F" +
      "791D30415D30AD5ADCE822008D933D0652D6115496D87CA70F4D04303D64E1864311A5C8D10C114619B63A4B3CB906E4EC0E20CE2D22EBDC58A6B3BA1BD58D5E" +
      "AC44A27CB6DC1E82D0B42CE290EA80C2A84C3E942095C69396CC5C8CECBCA5450101DDB849A4341B6FAE893981349290027B7C0A82DDE66F51DC1C65D367ABCA" +
      "0FA1C289B0C01558E4A52376F9C0900B4772E97D19E5BDF351DF23DDC3C1A51DDC8665DF69400EFD2ED9662B3C968079D089A0E8F71821F1159E9B05255D0DE8" +
      "D88FBD2424F9DEAD7C03A7FCDB6D192243E4E643685B37D1C20C95E6FA85A5FC3E2307A9A9D94CFA474B3B4608B7C6B92AC1BB8E2783151F0799049D88EF91F6" +
      "E84831874570B0A0D98719D4DFB3EE46C05672A4508CF893B8272F1C947746D23959E9E492E3226F000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000000000000000000000444089B2112348200670A1408EA90808D24062A1144D72" +
      "0284484A05E46102E1E0E00C804C06A02339368081C91062400DB1840CA04CC422D5E478C0228417AC484492E74E900CA7088A808C610EE791507C2E47BB1403" +
      "C438CFF20879D90C0A0A623704E441B1E92ABD2C39274605C80C9C0C7C758C09A837200440F463394224BC11E862FB1CD91DB89850C10EECAAB656E808DF3619" +
      "94052205001CADD48885911C9F045727D600D0A46AE25C3415D2A1862B36844DF50515044B83BC91FB4D01B02C5449B78EFEE6D90B92BF00608196239DA92B2C" +
      "7C8075909CC12A37BA2B5D365CDA606550996DE8E4573E1B11358CF008708CA7CAEA168320051D52C00DC130406C0394798F319220D91BA08DFF99E627F55E64" +
      "673883425AD020D79BB70C27006B8F1894EC31F18A01B4B41C62DE294646A0682D8024C57582054C1F3DD9BA13018A5EA89C786DB5AC1B30D6F7A5A4A3D5A2A3" +
      "78036035C7F8A8C2816583BEB17348A81B3785065816152529C08982B930DEC098D5DC81E0CCAC4B6830507D867545E2C26B8B9DC9F3968A8A2B13130A2A4004" +
      "84F0E82400C959C8C955ED1C44FBF022CC4238433BF361FA7F3789D35EB214C670BA410A6A7F3AB0000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000522A001C0A46C60C24B732990B42A2801E28C00CC60A2A15" +
      "204E5F1241D860848128102914C9B16184B412C0C6A405997CA839408865E3183848A430DE08B582C00A043A0245959424116A993F4700D24201040D42379A16" +
      "4B9220904F08B4200C5C10180A4A05229C0440902C51289A4210C000132A2114A2E3271F8217364E70051C50F4504C9421B53E0680683C6610F85DF0AA0A747F" +
      "32629055EC8273FE604F18C842B43592020375668695908CEC008310E9A0242C848582A2E912B087AA987E695ABA1D9D62808647049A3A7DE4EC04BC077455AA" +
      "8A4220041347609A339B04ACA868E0E96340D08432719940823C4ABD1E563E7C230A3CE2AA42CA40D9B814C688E27AC24EB6FCEF03525041089B7A812AC5C917" +
      "4F96E6222828F12179B29E100B40430381C3BD81B80CC8ECA6A4D081F099A06A38C10C8442DE56041D44081420292AE3E4F8B8D36089297858E6A5FF260CD103" +
      "941B37105CAD1B7EA80CC886DA8905214B223523BAE24465AC7E65CA9F903FE300B391891D063012000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "000000000000000000000000000000000000000000000000000000000000000000000000000000000C553E8AE9A9800002C28214645720301D20C0AE14630B48" +
      "BA39C200B0720C4349804912A48013012C03EA0D8AC0CCA82D00968EDC813124B62AA01A9015A2F528F71232D126503840065826CD4A4C6809118168012A504C" +
      "530309A15C318D9A6C807E9C008027410104AD60B9506088905327132600C000325039C20530C92320102100D45304814EC304228E42476020300023C8884048" +
      "30043A40810C4006069085CB2D42D44CC4E25022445102300420405451490E4843721029506E7D2C6188DAC005C3CB2C00580142E0F140A10814130C55814870" +
      "9A2901203414719088B240F8D25A5A20203E664D424003059887A1F0BC819D89001046A0210E0602B69902FAB47E5B926A771FA16DD84E67FE519A94E70BA210" +
      "2AD4556E018727397CE1618A13B7575E476D25812F1BE239048EB2716182BDF5A9B79AA17CA1DEE3CBD7826048475F8414C022A2EA0E43EA9B89C96EF19457DE" +
      "08F9A12646B2DD3EED2859489B6C4AEB3DCF5617D6892D0CE83F44BD35181E795A3673E2DC8320C280E3B98377EA8B4ED7D02838F52268946DB46FA8C1B70EED" +
      "1B168FE6CB3F5CF7CF0A20A8ACD82EAE5A6EDB357DB8E40DC362FBB3963987379248CF3381DCA9A50D1F745EC21A0C2FB710A1B1116CF43A58068293FF4ABD10" +
      "BFFD5FB81BF808FF70F303D07085682BAA1164EC5AE4F224689FE8BE4BF67D8CB978706D0EE64498ABECBD155D87FA8968B4D4178A87355841A7537BD87439DA" +
      "D02B8B61FC706A6A975DBA59F707C84F38A6DB3C80DE3EC6691E0CAFBF678C5A1E192C1EE81E7D16342078DBB538A6FEEF0E7E8437611F96D2FC6A16B27B0131" +
      "5F0A0ECF9B8F508501B827D604EC25123EABE9ED2DDED1C51460BBA2DBBECA0329ECC82CB331CD79FE199C1383B926A7392F67DA4B4CA7E35E8DB4C71E7AE426" +
      "A482F5BE5A839610A0DFAD571117F060B4988C46BA614BB18DC231E4C17069C8653210D872B2D419E493ABA6DDC5D3C3DCCC9C5BF2972495E491758E20B9C661" +
      "25D6E2D26D25F765FF0C512EAA5BB75DC76E1B330D01BD39D240494BB4498065036FAED7EBC9F3579978202C59C10FD06BD2DEF5DB85B068B41B5556F4405247" +
      "49DC6F742D9290D01E03A7591E9B1BA6D080C9165164177C1622338CE7ADA6C7F062960467094EF9E70DE7ACE055C11F9BC98A1DA5F9B7179491485F109F0B5F" +
      "454FFC5E82FD2051F67CD1CF43D81A21611A322267E5F73AE0D9E6CAFA51C168F7D1607C70F7246E581706A1350C60886CA4A77BAD812AD467B2C8317E04C074" +
      "45336A4AB0493267B5FFFCF8D541B6F17E776CFCA6102CB7EAD4FFB3F9D2F45CEE9B6139590AA5310B51A31A1F6515E03F3EE344788852EE5F48FCCC7D229678" +
      "128CFFB2297A0C6CADB0E6F566DE551F9317E4DA5C1FD381B7E22BB6BB693038392C9F234EC013315A01DA478652A763472F87DCC25A41FB514DBB860C833666" +
      "F20F3F7C13832A5C75890042337C329893D7C48DA6571B0F0E604DD02CB291438F8B3606E6724C72F372BD7059FF538FF3BE8373CE838652F99CE1AC5C0B90F2" +
      "979BF9E6E71E919089C867EF498B4F6FF8F9BFA3B3ED187C8EDC02246B1A0ED0F515987EAAD8D9082099E9963021B097FD9B8F2FE91430E59C111547E00C0469" +
      "5959F0075C93AB8DB575F19D6DAFE6F6C46B06525A9185E2952B7230EEDA44BC2D0483B3B1119AA5BE91963BE9B5FE492F8FECF335AE64ED8DEE6FA307368280" +
      "BA000B16F8252922CBA4D2F960F1D04096035394ED4EA10BFD40DF1A7A64B96DA4EB61A2655F0EF279B4419DDC769BCB0C90C2AE94A74717EBD0B66F3B1EAF6B" +
      "5E5C8CF1ADCFE489D3FFC415FA4BE22D820EBEAEA2D933FA67696DC1D6A1B1C99EEF573A66C2500D04719D586A3CA558F45D93D075BAC8AB73A86C0651764059" +
      "3F82BC2943C629C7091A37E6573FE2DD48CF11720C516A87962F3DD23A9BE91DA0975AECDCC6086294D64440CD2D1889FDAD4A55D6FCF75C2680572E61889ACA" +
      "BF2449A7683437A6C0E200491353B11218731EAF23B0B789517547F37D3783F77D7C2841CA73198F753C25AEF37851EA4732AEEE2F005E0EC44CA0982C091C1B" +
      "6487D5945BBB6E04C2E0CC5273EE03EEFFAC6052F26B27ECEE415EC7759259364BB9CECB20A754C50ED4D5067A2ED0CA20C4537F121994378190353D91CD8878" +
      "98AB855D7CA7CA01B5633EDD382B25170BADF5AB43EE28A0EDD83ADE23B0290061278B0F07F3B2C519A85E8C959D458C4D5EAF0D9CFB6CD9CA16CCB63249C2A5" +
      "1B27FDB9038F63307418E7D42E54C72AF05A7EF06DD3E1F7379FD4637551324D334DF1A531957D5B331A70FB1208C088C4D6A6AA338C72616FA380D5B6988B0B" +
      "657BC8F5D45735E7EB475CAAF9A6ED66C4B2C59D5FB50B13D20B656045D643EB3B65E77043A78D395B10F5CD9DE483D7195A2D806BB0170BC10098EBD89C2CE9" +
      "3B95B98A8E1C756E85CF542FDCDE47D8872190443C289819889E276EFA06C7BC7ACDA4589044FB9B143104DFC246BE573050482D38F753B62642725225D6F359" +
      "F27CAD5C034E5B2301CB573BBF2A728F29087613926400772AE61FA6F462C5E0C93CD851B08311DB240F38246026D3D624873E29E13D7FE8B33CDD81E56D382D" +
      "8CB630C6F474797606628E767EEFA2E1DCB795C1663C5B7E7D0EB4DD203A600D1B79324A0CA382C2D1E4DAC97BF4B31D0297A33A1E3CD921005FB20BF9D69F03" +
      "01F589E816418F28C025FB7E2AE8E9077BAF8D52803C269385119A530A4904DE13201C4EE17076856C327447BBF1F6A34DB75FE606DDFEC9CBA1E25A090BCD57" +
      "284B4D814C648FD35B840784EA51730A5EFC6F0399560D753A123AC525312AD546E0E1DD9C2CAB095F96703CA51EA6CE2889345F2A989D7E2F928A94A9152EB7" +
      "065DF4F0263D40DF0A053BDE711BD1A8F6BBF64D077D7DC7696ACE56EBD2B92FF70CE3C846369B421DABEE1BD2C12268942CD9E5413D82A024DE2FB0220DBF25" +
      "61808A1AC534DD7D7BEEDE09FD128B554FC17F4BD602FA3D5C9DCFBB517C0C2D0F696DA10C4C8DBCD417484C9CFBD65941F17F8491182252086624607735EF3F" +
      "7A6BFA7A576A91AB061590A3FE43EA659EE6ED396422C44316BC001C3EBD7DE463072F3D1D9A7F77DD963DD667A048D842807565F85F44A5214D8664413E0CBB" +
      "C007E5D25E16C7F4728F0CE9083B271C5669F0AA5B68BEEE2387674DC2C36B5636FC89FEF888F7EA70BD22AAD07C419C0A94638FDDD7C7BAB272EE0AB65029ED" +
      "98C366693F658A06DC429E911394BD31AEE5487A23AFB374F04F73692455EC779797247D315F2B31C4C2BE9EF5A74DE3756800E0CBA197A31BF632ACA83C1A8B" +
      "F25B76461581CF294007072BE34656C6CE8DE966570272140FCDB34CB1D8C63DAB5D3084BF70071B46223F1C996EFA7928BD95B4015C53AF224BC00C000616A3" +
      "18DE4EFA2F3B4C3EB6DEEB524D0EAAC480EC0842BFA7976713F6916FB3B0CD409A981904C26B9A7046A78D9618AE6CEC07898D017431765C4C37B3A0E79EC4EC" +
      "FD2BAF41B5B4F1D9DBB4FF3258F46B88D73ED50FED27E089EC5152CC3D5CE08C01F9BA4E05171F20FB5D4F0A7968AF8D0BD1227805803D26B96DD0B108A0F423" +
      "DF2BE49909711C443973A1FC7C1E0B0DA7582CA2817933B5771CB6337103DDD04E9720EC72144DC616A6912398E2D16F0B0C3D3F43C376AE813A76F728C37274" +
      "B13F865BD6D241C837828177E764AC29CABC9399AF81C34EAC0B0AC5350E88E7A08C2B5FBF50E0CC343F431624C653B5F5BF7DC46D9C283B46538D427168D469" +
      "F9C61408693CDCF0494C4A1DEEBC3F5704083A9136226661063FBFB2F76688B5FC30CA997123801EBA4D91549380511EB0BC866F926F58498BEE197D37EF2F34" +
      "EC4E893F823628DF04CA310011543C7E6E739F5C01A454F9E269EF1801FF334ECA5481AB8A8A8CEC830E5D35D9F0B3007A6E996B5BB69CD2AC2C653D74B20C80" +
      "11846B9E7185A212986029D66EEAA3F54BA0E31AFF7BF57EEA47C0470451582C25E9A6F19890A3986A336067637F206F8CC1ED44AE97F6943E4BDA3ED60ABF85" +
      "595C5F5C59FB7E56B27D0266992BA7E4A775F2BE83EFE5E5287915F538510163D9D2A1BFEF5913A0ED99404F9CDABEDF40B1E7663CF06E4DE41EA9267B6AF808" +
      "42422CBB5C00EF7FC9DD7A3D1AE62628625C2AE27CCE0A40B19AD7C639ECDF10932B7104321BEF55B0D7E25D37F0A6DCD4F85F2767CA1E3F63FE7BF188754027" +
      "9C3B72B1E646CE73B1FC7C2F630A9D88FF9BCC5604930502965EE350880463E0E62FF2A5AFDE030B61830CC2669BABAE0A6B4F256AF7D001C6E3655E9CF4431D" +
      "CE1B8965ABF1884B93FAD4CFB359CABC2D11A22B6AE75A2CCBBFE4BD6262B65ED3746BCB24A5C5563A40A2C2A1977F94164C570EAC0D6153BEC2D2AE8C7D4674" +
      "1450994DAFD02286DB516279C2D92E3D14AE86FD77F2A49BF2481FBD9180CD849707CB2204B6AE0EACFA0A237FA01B58DE88DCB575799D2577016E45F8303FFC" +
      "A4583CE1FD4DCA348AC887F9A421D179603B1AEE87F662AAC932EA1F5E8C0B7BEEBB07AFA99880044C7087EB8217E3857B96CA7A11ED69D40189728D7934FAF3" +
      "AD15E218E8FA4C43C4F926E8719D344AA424BF4E7C0872877F83B272E8BCF3117ACD4DF372FD8F960D2EB2D6E0FB67566E8C523B260D6389DE489E515F1E2A06" +
      "32DE4229200AF3D93185046D0D4B1289377B1F91CAB9867207E045F8728D9C8210E4E7947112AF37D5514748460FC73E58BB4E66CE2AA27F5C18E9E6C6B3A305" +
      "6249ADD2115531089F6DB0EBD639991F33320DA5762A936E10F014874EB57FEFC4DE1F6F33C75563DBBEFBF9A3726E2E71529DBF5B77E6218D631408DE50CA42" +
      "FEBA8869C3FDF6A0ED62D32C34359E24CC799378BDCF652C484B3490EE3D99D84418B1D2C1E8DE04FAD75CCC4BCFCE945F84C34E5BDD61487E3C865C52243CCE" +
      "BDE643C557AC37CC8F8DE107F07CBD253CA487EB3588293746F40F838D86C565F790CA1760AED1243DB5CE1877BEB2628478417738BC4477C0F4F2CDC5517BE7" +
      "E6B0CCCE3E9771033583778CC6B5DDD636C67E0C5F9E8CBF314B1C0549C7D6EBB27D7871A5E30E68CED52D4CA386D439616A676F0ACF1F3B75CC7A5B09825A31" +
      "A9F8496C4D9AFBB8985B2D6B75682502A1F029F8138FBE00B51F17BDD14C6CCC03254D2FF772D7BDCF6BD768348A69ED6C2BFB048E2893B5CBDDB1E8AB7866EF" +
      "DAD95306F0254E30553898981AA678034917DE59897C20E9D3B2966B4A74969E684C7AF450AE7EE599B713B9E762FE62CAA1B9A45023BC83AE73F9623B280544" +
      "3BBE9B438D6017A0308A30CD7D16D1732DFC42B1DBC96BE3AD3D18D4A0A516D8507B8ACD475F97ECFF26B3666E2B0B1061FD06D49B6FCB48369A9F4FE69280DF" +
      "ABA18DB315AFAA3CD35EAC0CF910A30B8893643A937B5DF6CAB5E3203D39ACD286E0E6BCCE7F5F6E89430B4CD247D000391623E0E14654BCC77954F6FDBC432E" +
      "D6A99CACBB6846A2366A789C974867FB487A064CFC3812B10DC696A96B7CE3B705E593689D350C9A2D1EF098DCDBFB60DFCEA66AF635CBD7E4C881D6F72FC1F6" +
      "C70D9E33DD2494EDC5FDE448B43A2747E91EAC7CA020D64B07EC80D0C23385758CC81EBD464ED9E8F6567B669900F9B8AC066405632EFBD058B9ACB3C37EAECC" +
      "5333E7F015C067952196EBD8E63F465423978BFECED39043CA50B72E1090B161E85BA7016FE4ECD26A04A07F99D917794432033BADB007BC2124531580EA2A0F" +
      "1FEBBEDD1B4B8D3AAC0811DC683F9EE03218F64373BD008E4383D75F25B689F080F6444AA471B380289FB9DC0C30C32D979A76C93A38DB5927AD4C9F02695AEF" +
      "74760768B3C4E2BE97F1CA10137302831C86EE3B50FAEB6E606E08A2493946993118EC0FC2A17E5C334C5B32B6F6FE450442B0901BE10D4919E1A27B3C61289F" +
      "828243144109E428218EAE3FE0F4C65F40E51E01CF84B5AFCE47C1A25C56B2A6532D46A199328DD9AA763DE99112E4704E8A58EB55AC5EC1790D2FA5DDF10447" +
      "11F009C005E5C6F45E02F1F9DE6A9091B33D8905BDF65EB0FA67884FCBB6FAFDFC0391067BC2D0694CB358F511A8DDA7B55957D65EF3947DE2B290635669BFB3" +
      "CAEB363CA5DD67269DF117F9C7E2AD2A471A45F35020063F936320A8683085FE721227A778BD4B2A7876584A0A68CF35FAE54D04805C50F5DCC548FA6AD08E17" +
      "65392DC252296EB9555E729D8D181E3D890C22B5579FDCE249E598F488851BA2D07D4A72C5D29A8E4FF90574CB26AD5416EE8E6370EEFED9B186B0E3704E0601" +
      "333D246023DE99507408186739F933A4429F422546254D7F713E5A7295B9054A5F424DB73F9FF2CB49DEE4AD6BA5AE3FA72C5202C0CEBCEF17F78E0675CFE15E" +
      "59861662FD9650B409472752AE21B0244424D414CCB53AAB57F2B82D372A73E75B376F3588B388251660CE2178B44DB791BFC10DA1B602E3E218781B9FF208B1" +
      "9F9DFA2D0933302822EBB476B08C7CEF993C482625F88ED87D89C34B3F6AE4810C2EDCD83A283C753F655E8AB4B8C4F9320A9A1CB38144F5E3DC2DF64FCA7027" +
      "2390FD405F69BCB1F10D8F26617122A08490A67B460E528AD0DA0BF41631E843DC35AA143F9BFCBFA406710938C177F05DAD10D94547A37A5C72366A5D47D38B" +
      "1562A621B850443D35151E1905E8918B083A44C55A6D8555E80A8FCFB27680B024415B9C7CB835A4666C000375331EF33B234C74182F551DBAAA9210BD64275D" +
      "92E8FE5AE51286968D9FDD0C0F8FF9BAE1256A4E12BA32A0745685E9B32AE7C55DB288F1B6D1BB99F4CA78C35E3819DA12E58B20CBCA391DD8A12D8EBCD772F0" +
      "267EE2CA4A097F87E104CECC4EF9B30D71FC264A416B6E51020287E78CB6BAE749DC2DF26F0E81AE79A0C3E79908BB2A03C8CB7500E289C7D7311F0CE5F78972" +
      "04523435C3D61BDB8890A351CB459D82DD65EB0DE9F3A438B916173EA7C63D7090E74A50FE455802BB6A7D4E317A3F9964823E8E210269A5D1AF3BE75C940497" +
      "C9392920D35CF5468B4DDA5CBD75D10AE85DEDEE41E89F790E840F7C5629B94A503D11F81E666A9EC2AD3FD4276145E3BA0294A8DA78CFD63FDA6CFBA3832696" +
      "0DA241104CB3A5F271F9F7E00A162819299A8F8A436DE58CF5C5CF2FCFFA9199C7C8170F9FF6354070C45CE76C8C03A21FA8FA378E3025B1E9F7157E3A23C021" +
      "ACF8F4CD68A2FB8267731CF0BC772E3871593F1B693512D7527E9C35D39946193DEE9D75C111BBE2F7E048B41C8D43017F109F3DCA73594D4A327266D2E36D55" +
      "488701F63CCDA4442AE246AC98D620297CE86C7A1DC497BC4249E362BC119E0AE404AB3DCB30D06D91E45D541949F5AB86825C67B7724BD5EB98171B4BE2265E" +
      "A8343E3EE5415ADFF0E05B29A74322E1A5A87878F94DA7E9D148B8EB3D456D433B731B95F2794C034EC7E69574AFD587EE66725E01CBBBEA9D7AE5DAE36F488B" +
      "62C046BC4D08D074F05F3FA358E280E2E553F77B4F97582A7A5B6C27F71C3831F6D8BFEEEE377DF0F397AD155814BC1FF1C10282C93E61B21818C1C3722DC480" +
      "C164E177F56F7B9FE271352477D31910B80322DF101C005EB3F06BF613B437454F49B112C6D508C9C0804F9623DEED5F99277DBB9C54FDB8C207C9F5A7CF76B7" +
      "DE9363D1EF553D49458335BF89A0B87A7F6C9F490BB835F6550C05E14931682DD3A2C343D6577888A5F6A54BF4D4492C46E64749B10113B677B48BF3D85F857D" +
      "90CB0D6168275C99B1E51EFDEF9D9B0D83CF85148B8F1A4F103624E643EBCE264933E42D6F370D15D1BF5011EB9C750B6BE9A1EF3E8E8FBC88AA2EE9489CDC1B" +
      "71F643AA1127E450DCC530A4557A4EE6AEBCEFDE11FC83B6030ADFEE5BAB8A471D80FED2F02078B9F3AFF8A24DBC4FC71DA3E4606298EA5B055C0A556B519A63" +
      "CB924A0049BE4B53482706979C8A43F1EA5D61A1DA3B69A6691FB7557C179C8C54F79C9F300F2599ED328E36D228EBAFB6C905507933FB4CB747B0214C7E5971" +
      "CE2B81C58CE0AE5088AEFACC0723C69C583236385BE7D88BAE1791EBAD7E550264972F082AB700942C8A703A2E0BF3CB770033F4AA65424B58A9C076EB69E21F" +
      "8FEAEC9AC68275A687C03DFDB6F4B5B93C2E012BAA21D04F75D612AAF8C5A273F1A21FC86F62F65F3029BC8C6FA9A7E031F9FBD355D9C6639CC14443E4D3F748" +
      "B7BE5B5729656488FD16DC336D7A96C9FCB514A37297208A4FA382B08B9CB1977866B22B6822D2096901127CE78767145380F2079BE9884FC232F7C8C9A526FD" +
      "AD14787211BA11B060BE77BA21C47B43B75A1F7FA58C4DD058F5D2EFAAEC7D045BA4D05C2FF3FAF5DB9D884184C85D185F26D204FAD8A7DBD3B0CD0AE947DE3E" +
      "20D4F70738095E3F656C5250902B9534D32EFCF667B0A42EAA8B0470240816E49E3792E7EF3942994D9E01090F43A7A37A81603B5B68AD2851834DC1805719A8" +
      "4C64208E35F764FFBBCD0F8C9B865F81BADC493CC58F67D84085660C5DEEE775170747D26C756AB343DD7BB7DB23E5EA579F1D0EB8BC5F966728D733F2F254CB" +
      "927D23C2A6BD4436E74A09C7EA9145D6F33C882EC6EE6FBAD77CD0990F40D66FB814CEC5062CF316163A6DF478FFC816334D1B39B6D5D30FA5EE00777EC80C84" +
      "DFB8D1876A7BB00E2E6E5BD69367022D638A1EB3AB93C5D558BE4A5242AF492D84A2BACF59E8B5559BC5685ED619D131F682D10995F082F175315B292E410D95" +
      "3DA0AAB2671012123071F406DE4AEE724813B7DD7C58C599158DC4890114F37A56C74B0E856A2134D461478FEEF5B890C1051E2D1E28461F852FCEFB0C46D4BC" +
      "2CB132772B88E466CA692CE3926022B0F3A9819923E831CB95AE9B8A7032343BD69EA965948032E1E8042E620E0B67607280D2075CF713CDA6D1B866942C53B8" +
      "8AD0692C12701D1756B43F8C8C059A4CAF376DFA23CE71B2514A1A330D80E41F8E362B76FC2C14B5756DFB8190B094877CF80B1297141A3E89051E4B517B4207" +
      "20609318638A546067F892AF12926D1CCBFE2705BFCF9B8EA5023D3CF04E01FFA342CFD537160F1AB4CF22F65EF989C5CC51ABEE7233E52958719712D49BF928" +
      "2836F3C1311B849ECDB7D7DD7E5F5746976110BF4A580E6C9122E56C2BD149926DA3F03CAA7E8C05287A192C218BA852BF58E4FF77D1B831CA3227426B123A48" +
      "5858F7F3498DE9F447C45AABDE047D4F58874FADEA523C26B3313D522A9516B0F9EFB7CFD3B8D508F6161E30EFE6DA46626A7620AEBB4FD4B453293E17073279" +
      "7B3AE3A528BEE8876FCFD992255647ADC125DFF7A92B00A447DF9AFD86B662392E31264E9424114B307CF6B0663283F2B536AAC321D89E4C5CE466105993E101" +
      "3D67C2EFBE02D1A9F73361A2A9BC51A0A24D82423159DF920A780DA73C32C86D19CDF36CCCB999C43CC0913BC08B352EAA6205CF5695A7E0E9A67207B57A1BDB" +
      "681F73B53776C23C7E768101F1727C5465058033914AA6528CB719363D571AC9E6429B3401513EA4B39A8FAB41B0FA15C60F2B19A27F1D9209CD577C514014D6" +
      "1552523F711C20A0719A24E4BAE6E99B04582689C728A78B7AB4CACB724F6F6A2C552BA861F6AB462AEFD465595EECF933F29FC74B7E50EA0A4BC1C6BD71B951" +
      "85AA9E919F6479C3BD6E3B5D789D222F27D4F588120D6EFE269E5EB92AEEBC0442F4E8B2FB3195EDD4380E6BF62CA363188C7C49D44E1326C38D30690EFA612D" +
      "94A6D538E6E754E598D29667115806267FF8D1B8BDE72248A5DE887727E2E1AFF0D916E34785027D7195837831DB02B3484CC9E768236E54EEA22468D35DF8CC" +
      "AC68ED583119E8942006514D61F46F7C09264C40314B3BED61606FA66AA0B30033E5DDDF50D6BA2CA91523E1422A141B5E4E14D74517B81F56972F0C6ED9860B" +
      "35D0A56AD2BA6D976E4303443210C2DD3DDC9289C8A11BCF412D3E6714D263D57BFAFD2DBE03B0A89DF43E92C9FA4521D0AC4B1CD84F99FBA52CE66B2DF0D913" +
      "A28E7C94DB36B6181660E6758E0B89DDBC18C3CD4AC352084C557D62407CC8952A9E5D8B50E7A22C84D646CC383C641C5DDB7537105C293399BCA916522CF8A3" +
      "C3E3441EED24A68E7BD47750363F2F04BC8CDD25603B06E4EEFBAF4930D22A0DE141282CD92DC82C9C9476DC3298462C5BE06A9E75D6234E11D6CDC4E5D84363" +
      "1B1C8347A37A232891B715DF17C60D661E64E521E07C41167D46E178553AE8B2CA4335F857BBDB86E813926415E2F97EEA2F28FA58B39872006037D72577E2E8" +
      "AB460BB6596CAE3CA61E3F67A8E4A05AC043D9452CA6EA2EE0794FCEC473FFE177E782123881DECD00C103E8CB07BE82492E1FA3B1B27916FDE6FF5A1EBD9E12" +
      "C2DB8C93B6B51745377EF715D71574D9D602DC15005317AACBAC1B8FC9DD9056CD0701CE9EF7D7C5E6794D5FC7C50F1B5FD54C00894B577507162D74C956D4D1" +
      "9875C23A3EB8DEC702A84845B728178047CD3393274E7088C3FEDCB2417D7C6D66191F6A7D4E060C36802DD4C787B914E3BA1FF8EEABBA2A50EB2399173BDC15" +
      "E2F3611F7ED622E1A7EAD9C1B1CD00A1860A712D109F42D9AC2BBB64607CBBFFC4F58D5EDDA0062437D06257891C254035174F756C3C48EDE4B77E810A57B29C" +
      "0303B3CBE2E500824A574F4C1FEB053A4BDCDDA80046A33972BA43E10DE2434A647F71034CC60839256340C9C6CCB0591184D25FC0E3CC482EEC080FD71625DE" +
      "C14F70B33F8D4BA74183C0F10E918583489A5801EF5CE960250D3AB27FDEAD6F3630727C70805FA536F724E6ABE1EF017F2AA2B3B481988BE27214FC148AA27A" +
      "E768C59A70A9409A87421DD0DF7346D78EBD231555953002865824BF4280CA73A058D19F08A3A97D950F0EA5D89548B56C4AF1934F63C1572480103729C1819F" +
      "E22BBE3739922C2182C19024B0CC64B0CD989A1835D41DC3F6983D7A9BEEC386C0431E3ABD354C047DE0BB05CB7E0435D227C5DA70AEC8C77A67F5C5AC23AC9F" +
      "3510F732365224A8BFDE06F9152AA0AAED657ED0CF9FF80B5D98412946F6792DBE41C5C58274E864359DEA6204F9FFBD0F81F6A2DE44F74FE7C25CA622FF1778" +
      "4BAA384FE291907F1A6D85737CDF6A94E0F256AEA2EE1F8476AE938C251D6DBF49B3A3904EF1ECAB");

  const KAT8192128_CT = OpCodes.Hex8ToBytes(
      "AD9728E7519C5F851FDA1148CF652893C8884288930995416F95798C4F2E0151FF617828CBCBC74BA3870D04E41FB875BE651A8070E23B89D47362833D899ABB" +
      "57D25886FD9B71C2027C3F32FB5D699922053BA4E7297E9EE87838DBC06677E0B4EB4D9EDEA0945A6D0A01020BB30C33CF0498373B9AF3517DD20331FFB1F817" +
      "7946251EFA80BE477E96D8ACAF5F2AB93DE67868DE506B44E0A1FA058176450A380901A5AA0E033642A7ECCD50C77916268AD225AFB3B7A1560FAF4CF476ACFF" +
      "BBFA30D1EFF17FBD73B109CF9FF2ECC0");

  const KAT8192128_SS = OpCodes.Hex8ToBytes("82351702A2C3973644CB735FC9B6CEA8FE526D7D729EE134FC12C0201690E854");

  const VECTORS = [
    {
      text: "Classic McEliece mceliece348864 kat_kem.rsp record 0: the seed generates the published private key",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      parameterSet: 'mceliece348864',
      keyGeneration: true,
      keyGenerationOutput: 'privateKey',
      input: KAT348864_SEED,
      expected: KAT348864_SK
    },
    {
      // The ciphertext is the syndrome of the drawn error vector under the
      // generated matrix, so this is what pins the public key: a wrong matrix
      // gives a wrong ciphertext.
      text: "Classic McEliece mceliece348864 kat_kem.rsp record 0: the seed generates the published ciphertext",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      parameterSet: 'mceliece348864',
      katRecord: true,
      encapsulationOutput: 'ciphertext',
      input: KAT348864_SEED,
      expected: KAT348864_CT
    },
    {
      text: "Classic McEliece mceliece348864 kat_kem.rsp record 0: the seed generates the published shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      parameterSet: 'mceliece348864',
      katRecord: true,
      encapsulationOutput: 'sharedSecret',
      input: KAT348864_SEED,
      expected: KAT348864_SS
    },
    {
      text: "Classic McEliece mceliece348864 kat_kem.rsp record 0: decapsulation recovers the shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT348864_SK,
      input: KAT348864_CT,
      expected: KAT348864_SS
    },
    {
      // Setting sharedSecret turns the result into a verdict, so that the
      // negative cases below can assert a mismatch without naming the value the
      // rejection branch produces.
      text: "Classic McEliece mceliece348864 kat_kem.rsp record 0: the recovered secret is the published one",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT348864_SK,
      sharedSecret: KAT348864_SS,
      input: KAT348864_CT,
      expected: [1]
    },
    {
      // One bit of the ciphertext moved. Classic McEliece answers a ciphertext
      // it cannot decode with a secret derived from the private key's rejection
      // string rather than an error, so the property to assert is that the
      // published secret does not come back.
      text: "Classic McEliece mceliece348864: a modified ciphertext must not decapsulate to the published secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT348864_SK,
      sharedSecret: KAT348864_SS,
      input: KAT348864_CT_CORRUPTED,
      expected: [0]
    },
    {
      text: "Classic McEliece mceliece348864: record 0's ciphertext under record 1's private key must not recover record 0's secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT348864_SK_RECORD1,
      sharedSecret: KAT348864_SS,
      input: KAT348864_CT,
      expected: [0]
    },
    {
      text: "Classic McEliece mceliece348864 kat_kem.rsp record 1: decapsulation recovers the shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT348864_SK_RECORD1,
      input: KAT348864_CT_RECORD1,
      expected: KAT348864_SS_RECORD1
    },
    {
      text: "Classic McEliece mceliece460896 kat_kem.rsp record 0: decapsulation recovers the shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT460896_SK,
      input: KAT460896_CT,
      expected: KAT460896_SS
    },
    {
      text: "Classic McEliece mceliece6688128 kat_kem.rsp record 0: decapsulation recovers the shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT6688128_SK,
      input: KAT6688128_CT,
      expected: KAT6688128_SS
    },
    {
      // The only set whose mt is not a multiple of 8, so its ciphertext carries
      // padding bits and its matrix rows are bit shifted rather than copied.
      text: "Classic McEliece mceliece6960119 kat_kem.rsp record 0: decapsulation recovers the shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT6960119_SK,
      input: KAT6960119_CT,
      expected: KAT6960119_SS
    },
    {
      text: "Classic McEliece mceliece8192128 kat_kem.rsp record 0: decapsulation recovers the shared secret",
      uri: "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz",
      inverse: true,
      privateKey: KAT8192128_SK,
      input: KAT8192128_CT,
      expected: KAT8192128_SS
    }
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class ClassicMcElieceAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = "Classic McEliece";
      this.description = "Code-based key encapsulation submitted to round 4 of the NIST post-quantum process, and the oldest public key scheme still unbroken. The private key is a binary Goppa code - a monic irreducible polynomial of degree t over GF(2^m) and an ordering of the field - and the public key is that code's parity check matrix in systematic form, so a ciphertext is the syndrome of a weight-t error vector and decapsulation is Berlekamp decoding. Public keys are hundreds of kilobytes; ciphertexts are under two hundred bytes. All five systematic parameter sets are implemented and verified against the submission's own Known Answer Tests.";
      this.inventor = "Robert J. McEliece; round 4 submission by Bernstein, Chou, Cid, Gilcher, Lange, Maram, von Maurich, Misoczki, Niederhagen, Paiva, Persichetti, Peters, Schwabe, Sendrier, Szefer, Tjhai, Tomlinson, Wang";
      this.year = 1978;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Code-Based Post-Quantum KEM";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [
        new KeySize(6492, 6492, 0),
        new KeySize(13608, 13608, 0),
        new KeySize(13932, 13932, 0),
        new KeySize(13948, 13948, 0),
        new KeySize(14120, 14120, 0)
      ];

      this.documentation = [
        new LinkItem("Classic McEliece specification (round 4)", "https://classic.mceliece.org/mceliece-spec-20221023.pdf"),
        new LinkItem("Classic McEliece round 4 submission", "https://classic.mceliece.org/nist.html"),
        new LinkItem("McEliece's original 1978 report", "https://ipnpr.jpl.nasa.gov/progress_report2/42-44/44N.PDF"),
        new LinkItem("Niederreiter's dual formulation", "https://en.wikipedia.org/wiki/Niederreiter_cryptosystem")
      ];

      this.references = [
        new LinkItem("Round 4 Known Answer Tests", "https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz"),
        new LinkItem("Round 4 submission package", "https://classic.mceliece.org/nist/mceliece-20221023.tar.gz"),
        new LinkItem("NIST Post-Quantum Cryptography project", "https://csrc.nist.gov/projects/post-quantum-cryptography"),
        new LinkItem("Binary Goppa codes", "https://en.wikipedia.org/wiki/Goppa_code")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Key size rather than a break",
          "No attack better than generic information set decoding is known against these parameter sets after four decades. The practical obstacle is the public key, which is 261 kilobytes at the smallest set and over a megabyte at the largest.",
          "Use the parameter sets as published. Do not attempt to shrink the key by lowering t or n."),
        new Vulnerability(
          "Key generation is not constant time here",
          "This implementation sorts the field ordering and reduces the parity check matrix with data dependent branches, and rejects seeds by returning early. Timing a key generation could leak which seed was used.",
          "Treat this as a reference implementation of the scheme rather than a hardened one.")
      ];

      this.tests = VECTORS;
    }

    /**
     * @param {boolean} [isInverse=false] - decapsulation mode
     * @returns {object} a new instance
     */
    CreateInstance(isInverse = false) {
      return new ClassicMcElieceInstance(this, isInverse);
    }
  }

  class ClassicMcElieceInstance extends IAlgorithmInstance {
    /**
     * @param {object} algorithm - parent algorithm instance
     * @param {boolean} [isInverse=false] - decapsulation mode
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);

      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Declared here so that the test engine, which only assigns properties
      // that already exist on the instance, can set any of them from a vector.
      this._parameterSet = PARAMETER_SETS['mceliece348864'];
      this._publicKey = null;
      this._privateKey = null;
      this._sharedSecret = null;
      this._keyData = null;
      this.keyGeneration = false;
      this.keyGenerationOutput = 'publicKey';
      this.katRecord = false;
      this.encapsulationOutput = 'ciphertext';
    }

    // ---- configuration ----

    set parameterSet(label) {
      const found = FindParameterSet(label);
      if (!found) throw new Error('Unknown Classic McEliece parameter set: ' + label);
      this._parameterSet = found;
    }

    get parameterSet() {
      return this._parameterSet.name;
    }

    /**
     * The public key. Its length selects the parameter set, the encoded lengths
     * across the five sets being pairwise distinct.
     */
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }

      const found = ParameterSetByLength(keyBytes.length, 'publicKeySize');
      if (!found)
        throw new Error('A Classic McEliece public key is 261120, 524160, 1044992, 1047319 or 1357824 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._publicKey = ToArray(keyBytes);
    }

    get publicKey() {
      return this._publicKey ? this._publicKey.slice() : null;
    }

    /**
     * The private key. Its length selects the parameter set the same way.
     */
    set privateKey(keyBytes) {
      if (!keyBytes) {
        this._privateKey = null;
        return;
      }

      const found = ParameterSetByLength(keyBytes.length, 'privateKeySize');
      if (!found)
        throw new Error('A Classic McEliece private key is 6492, 13608, 13932, 13948 or 14120 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._privateKey = ToArray(keyBytes);
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
      this._sharedSecret = secretBytes ? ToArray(secretBytes) : null;
    }

    get sharedSecret() {
      return this._sharedSecret ? this._sharedSecret.slice() : null;
    }

    /**
     * The generic key entry point. Accepts a private key, a public key, or the
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
        throw new Error('Invalid Classic McEliece key data format');

      const bytes = ToArray(keyData);

      if (ParameterSetByLength(bytes.length, 'privateKeySize')) {
        this.privateKey = bytes;
        return;
      }
      if (ParameterSetByLength(bytes.length, 'publicKeySize')) {
        this.publicKey = bytes;
        return;
      }

      let text = '';
      for (let i = 0; i < bytes.length; ++i) text += String.fromCharCode(bytes[i]);
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
        for (let i = 0; i < data.length; ++i)
          this.inputBuffer.push(OpCodes.And32(data.charCodeAt(i), 0xFF));
        return;
      }

      if (typeof data === 'number') {
        this.inputBuffer.push(data);
        return;
      }

      for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
    }

    /**
     * Produce the key, the ciphertext, the shared secret, or the verdict.
     * @returns {number[]} the result bytes
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];
      const set = this._parameterSet;

      if (this.keyGeneration || this.katRecord) {
        const generator = this._SeedReader(input, set);
        const pair = SeededKeyGen(generator.delta, set);

        if (this.keyGeneration)
          return this.keyGenerationOutput === 'privateKey' ? pair.privateKey : pair.publicKey;

        if (!generator.reader)
          throw new Error('Driving a Known Answer Test record needs the 48 byte seed of that record');

        const encapsulated = Encapsulate(pair.publicKey, generator.reader, set);
        return this.encapsulationOutput === 'sharedSecret'
          ? encapsulated.sharedSecret
          : encapsulated.ciphertext;
      }

      if (this.isInverse) {
        if (!this._privateKey)
          throw new Error('Classic McEliece decapsulation needs a private key');

        const recovered = Decapsulate(input, this._privateKey, set);
        if (!this._sharedSecret) return recovered;
        return [OpCodes.SecureCompare(recovered, this._sharedSecret) ? 1 : 0];
      }

      if (!this._publicKey)
        throw new Error('Classic McEliece encapsulation needs a public key');

      const generator = this._SeedReader(input, set);
      if (!generator.reader)
        throw new Error('Classic McEliece encapsulation needs a 48 byte seed to draw its error vector from');

      const encapsulated = Encapsulate(this._publicKey, generator.reader, set);
      return this.encapsulationOutput === 'sharedSecret'
        ? encapsulated.sharedSecret
        : encapsulated.ciphertext;
    }

    /**
     * Read the input as either the 48 byte entropy of a Known Answer Test
     * record, which the NIST generator expands, or as the 32 byte seed key
     * generation takes directly.
     * @param {number[]} input - the fed bytes
     * @param {object} set - the parameter set
     * @returns {object} { delta, reader }
     */
    _SeedReader(input, set) {
      if (input.length === 48) {
        const reader = Drbg(input);
        return { delta: reader.read(32), reader: reader };
      }
      if (input.length === set.seedSize)
        return { delta: input, reader: null };
      throw new Error('Classic McEliece key generation takes a 48 byte Known Answer Test seed or a 32 byte seed, got ' + input.length);
    }

    // ---- convenience ----

    /**
     * Generate a key pair from a seed.
     * @param {number[]} seed - 48 byte KAT entropy or a 32 byte seed
     * @returns {object} { publicKey, privateKey }
     */
    GenerateKeyPair(seed) {
      const generator = this._SeedReader(ToArray(seed), this._parameterSet);
      const pair = SeededKeyGen(generator.delta, this._parameterSet);
      this._publicKey = pair.publicKey;
      this._privateKey = pair.privateKey;
      return { publicKey: pair.publicKey.slice(), privateKey: pair.privateKey.slice() };
    }

    /**
     * Encapsulate to the configured public key.
     * @param {number[]} seed - 48 byte entropy for the error vector
     * @returns {object} { ciphertext, sharedSecret }
     */
    Encapsulate(seed) {
      if (!this._publicKey) throw new Error('Classic McEliece encapsulation needs a public key');
      return Encapsulate(this._publicKey, Drbg(ToArray(seed)), this._parameterSet);
    }

    /**
     * Decapsulate with the configured private key.
     * @param {number[]} ciphertext - the syndrome
     * @returns {number[]} the shared secret
     */
    Decapsulate(ciphertext) {
      if (!this._privateKey) throw new Error('Classic McEliece decapsulation needs a private key');
      return Decapsulate(ToArray(ciphertext), this._privateKey, this._parameterSet);
    }

    /** Wipe the key material held by this instance. */
    ClearData() {
      if (this._privateKey) OpCodes.ClearArray(this._privateKey);
      if (this._sharedSecret) OpCodes.ClearArray(this._sharedSecret);
      this._privateKey = null;
      this._publicKey = null;
      this._sharedSecret = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ClassicMcElieceAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ClassicMcElieceAlgorithm, ClassicMcElieceInstance };
}));
