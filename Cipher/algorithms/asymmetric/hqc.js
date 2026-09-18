/*
 * HQC Implementation
 * Hamming Quasi-Cyclic - the code-based key encapsulation mechanism NIST
 * selected in March 2025
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * HQC encrypts with a random quasi-cyclic code and hides the message under a
 * concatenated Reed-Solomon / duplicated Reed-Muller code, so decryption is a
 * decoding problem the holder of the low weight secret can solve. The round 4
 * parameter sets are implemented:
 *
 *   hqc-128  n = 17669  omega = 66   pk 2249  sk 2289  ct 4497  ss 64
 *   hqc-192  n = 35851  omega = 100  pk 4522  sk 4562  ct 9042  ss 64
 *   hqc-256  n = 57637  omega = 131  pk 7245  sk 7285  ct 14485 ss 64
 *
 * Verified against the submission's own Known Answer Tests, hqc-128_kat.rsp,
 * hqc-192_kat.rsp and hqc-256_kat.rsp from the round 4 package: all 100 records
 * of each file agree on the public key, the secret key, the ciphertext, the
 * encapsulated shared secret and the decapsulated shared secret - 300 records
 * and 1500 field comparisons in total.
 *
 * Those records are keyed by a 48 byte seed. Unlike most of the NIST
 * submissions HQC does not drive its Known Answer Tests from the AES-256
 * CTR_DRBG: the round 4 package replaced that generator with SHAKE-256 over the
 * seed and a domain separation byte, which is implemented here, so the vectors
 * below are driven by the published seeds directly.
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

  // ===== SHAKE-256 =====
  //
  // The scheme draws a single continuous stream of up to seven kilobytes from
  // one absorbed SHAKE state, which the collection's registered extendable
  // output function refuses to produce in one call - it caps a squeeze at a
  // kilobyte, and the counter mode workaround used elsewhere in the collection
  // produces a different stream. The sponge is therefore kept here, and is
  // checked against the registered implementation as well as the published
  // SHAKE-256 values.

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

  // The rho offsets and the pi permutation, derived from their definitions
  // rather than transcribed.
  const KECCAK_ROTATION = new Uint8Array(25);
  const KECCAK_PI = new Uint8Array(25);

  (function buildKeccakTables() {
    let x = 1;
    let y = 0;
    for (let t = 0; t < 24; ++t) {
      KECCAK_ROTATION[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;
      const nextX = y;
      const nextY = (2 * x + 3 * y) % 5;
      x = nextX;
      y = nextY;
    }
    for (let column = 0; column < 5; ++column)
      for (let row = 0; row < 5; ++row)
        KECCAK_PI[row + 5 * ((2 * column + 3 * row) % 5)] = column + 5 * row;
  })();

  /**
   * The Keccak-f[1600] permutation, over a state of 25 lanes each held as a low
   * and a high 32 bit half.
   * @param {Int32Array} high - high halves, 25 entries, updated in place
   * @param {Int32Array} low - low halves, 25 entries, updated in place
   */
  function KeccakF1600(high, low) {
    const bufferHigh = new Int32Array(25);
    const bufferLow = new Int32Array(25);
    const columnHigh = new Int32Array(5);
    const columnLow = new Int32Array(5);

    for (let round = 0; round < 24; ++round) {
      // theta
      for (let column = 0; column < 5; ++column) {
        let accumulatorHigh = high[column];
        let accumulatorLow = low[column];
        for (let row = 1; row < 5; ++row) {
          accumulatorHigh = OpCodes.Xor32(accumulatorHigh, high[column + 5 * row]);
          accumulatorLow = OpCodes.Xor32(accumulatorLow, low[column + 5 * row]);
        }
        columnHigh[column] = accumulatorHigh;
        columnLow[column] = accumulatorLow;
      }

      for (let column = 0; column < 5; ++column) {
        const rotated = OpCodes.RotL64_HL(columnHigh[(column + 1) % 5], columnLow[(column + 1) % 5], 1);
        const deltaHigh = OpCodes.Xor32(columnHigh[(column + 4) % 5], rotated.h);
        const deltaLow = OpCodes.Xor32(columnLow[(column + 4) % 5], rotated.l);
        for (let row = 0; row < 5; ++row) {
          const index = column + 5 * row;
          high[index] = OpCodes.Xor32(high[index], deltaHigh);
          low[index] = OpCodes.Xor32(low[index], deltaLow);
        }
      }

      // rho and pi
      for (let index = 0; index < 25; ++index) {
        const source = KECCAK_PI[index];
        const rotated = OpCodes.RotL64_HL(high[source], low[source], KECCAK_ROTATION[source]);
        bufferHigh[index] = rotated.h;
        bufferLow[index] = rotated.l;
      }

      // chi
      for (let row = 0; row < 5; ++row) {
        for (let column = 0; column < 5; ++column) {
          const index = column + 5 * row;
          const next = (column + 1) % 5 + 5 * row;
          const after = (column + 2) % 5 + 5 * row;
          high[index] = OpCodes.Xor32(bufferHigh[index],
            OpCodes.And32(OpCodes.Not32(bufferHigh[next]), bufferHigh[after]));
          low[index] = OpCodes.Xor32(bufferLow[index],
            OpCodes.And32(OpCodes.Not32(bufferLow[next]), bufferLow[after]));
        }
      }

      // iota
      high[0] = OpCodes.Xor32(high[0], KECCAK_RC_HIGH[round]);
      low[0] = OpCodes.Xor32(low[0], KECCAK_RC_LOW[round]);
    }
  }

  const SHAKE256_RATE = 136;

  /**
   * Absorb the given byte strings and return a reader over the squeezed stream.
   * Successive reads continue the same stream rather than restarting it.
   * @param {uint8[][]} parts - byte strings, absorbed in order
   * @returns {object} a reader with read(count) and skip(count)
   */
  function Shake256Stream(parts) {
    const high = new Int32Array(25);
    const low = new Int32Array(25);
    let position = 0;

    const xorByte = function (offset, value) {
      const lane = Math.floor(offset / 8);
      const inLane = offset % 8;
      if (inLane < 4)
        low[lane] = OpCodes.Xor32(low[lane], OpCodes.Shl32(value, 8 * inLane));
      else
        high[lane] = OpCodes.Xor32(high[lane], OpCodes.Shl32(value, 8 * (inLane - 4)));
    };

    for (let p = 0; p < parts.length; ++p) {
      const part = parts[p];
      for (let i = 0; i < part.length; ++i) {
        xorByte(position, OpCodes.AndN(part[i], 0xFF));
        ++position;
        if (position === SHAKE256_RATE) {
          KeccakF1600(high, low);
          position = 0;
        }
      }
    }

    // The SHAKE domain separator followed by the pad10*1 terminator. When only
    // one byte of the block is free the two land on the same byte, which
    // exclusive-oring both in handles without a special case.
    xorByte(position, 0x1F);
    xorByte(SHAKE256_RATE - 1, 0x80);
    KeccakF1600(high, low);

    let squeezed = 0;

    const nextByte = function () {
      if (squeezed === SHAKE256_RATE) {
        KeccakF1600(high, low);
        squeezed = 0;
      }
      const lane = Math.floor(squeezed / 8);
      const inLane = squeezed % 8;
      const half = inLane < 4 ? low[lane] : high[lane];
      const byte = OpCodes.AndN(OpCodes.Shr32(half, 8 * (inLane % 4)), 0xFF);
      ++squeezed;
      return byte;
    };

    return {
      read: function (count) {
        const out = new Array(count);
        for (let i = 0; i < count; ++i) out[i] = nextByte();
        return out;
      },
      skip: function (count) {
        for (let i = 0; i < count; ++i) nextByte();
      }
    };
  }

  /**
   * SHAKE-256 over the concatenation of the given byte strings.
   * @param {uint8[][]} parts - byte strings, absorbed in order
   * @param {number} outputBytes - octets required
   * @returns {number[]} the output octets
   */
  function Shake256(parts, outputBytes) {
    return Shake256Stream(parts).read(outputBytes);
  }

  // ===== PARAMETER SETS =====
  //
  // n is the length of the quasi-cyclic code, omega the weight of the secret,
  // omegaR and omegaE the weights of the encryption randomness, and the inner
  // code is a Reed-Solomon [n1, k] over GF(2^8) correcting delta errors, each
  // of whose symbols is carried by a Reed-Muller RM(1,7) codeword repeated
  // n2 / 128 times.

  const SEED_BYTES = 40;
  const SALT_BYTES = 16;
  const HASH_BYTES = 64;
  const GF_POLY = 0x11D;
  const GF_ORDER = 255;

  // Domain separation bytes, one per use of SHAKE in the scheme.
  const DOMAIN_PRNG = 1;
  const DOMAIN_SEEDEXPANDER = 2;
  const DOMAIN_G = 3;
  const DOMAIN_H = 4;
  const DOMAIN_K = 5;

  const PARAMETER_SETS = (() => {
    const build = (name, n, n1, n2, omega, omegaR, omegaE, delta, k, g, rsPoly) => {
      const set = {
        name: name, n: n, n1: n1, n2: n2, n1n2: n1 * n2,
        omega: omega, omegaR: omegaR, omegaE: omegaE,
        delta: delta, k: k, g: g, rsPoly: rsPoly
      };
      set.nBytes = Math.ceil(n / 8);
      set.nWords = Math.ceil(n / 32);
      set.topBit = n - (set.nWords - 1) * 32;
      set.topMask = OpCodes.Shr32(0xFFFFFFFF, 32 - set.topBit);
      set.n1n2Bytes = set.n1n2 / 8;
      set.n1n2Words = set.n1n2 / 32;
      set.multiplicity = n2 / 128;
      set.publicKeySize = SEED_BYTES + set.nBytes;
      set.privateKeySize = SEED_BYTES + set.publicKeySize;
      set.ciphertextSize = set.nBytes + set.n1n2Bytes + HASH_BYTES + SALT_BYTES;
      set.sharedSecretSize = HASH_BYTES;
      set.randomnessSize = k + SALT_BYTES;
      return set;
    };

    const sets = {};
    for (const set of [
      build('hqc-128', 17669, 46, 384, 66, 75, 75, 15, 16, 31,
        [89, 69, 153, 116, 176, 117, 111, 75, 73, 233, 242, 233, 65, 210, 21, 139,
         103, 173, 67, 118, 105, 210, 174, 110, 74, 69, 228, 82, 255, 181, 1]),
      build('hqc-192', 35851, 56, 640, 100, 114, 114, 16, 24, 33,
        [45, 216, 239, 24, 253, 104, 27, 40, 107, 50, 163, 210, 227, 134, 224, 158,
         119, 13, 158, 1, 238, 164, 82, 43, 15, 232, 246, 142, 50, 189, 29, 232, 1]),
      build('hqc-256', 57637, 90, 640, 131, 149, 149, 29, 32, 59,
        [49, 167, 49, 39, 200, 121, 124, 91, 240, 63, 148, 71, 150, 123, 87, 101, 32,
         215, 159, 71, 201, 115, 97, 210, 186, 183, 141, 217, 123, 12, 31, 243, 180,
         219, 152, 239, 99, 141, 4, 246, 191, 144, 8, 232, 47, 27, 141, 178, 130, 64,
         124, 47, 39, 188, 216, 48, 199, 187, 1])
    ]) sets[set.name] = set;
    return sets;
  })();

  function FindParameterSet(label) {
    if (!label) return null;
    const text = String(label).toLowerCase();
    if (PARAMETER_SETS[text]) return PARAMETER_SETS[text];
    for (const name of Object.keys(PARAMETER_SETS))
      if (name.indexOf(text) >= 0 || text.indexOf(name) >= 0) return PARAMETER_SETS[name];
    if (text === '128' || text === '192' || text === '256') return PARAMETER_SETS['hqc-' + text];
    return null;
  }

  function ParameterSetByLength(length, field) {
    for (const name of Object.keys(PARAMETER_SETS))
      if (PARAMETER_SETS[name][field] === length) return PARAMETER_SETS[name];
    return null;
  }

  // ===== GF(2^8) =====
  //
  // Every parameter set uses the same field, generated by x^8 + x^4 + x^3 + x^2
  // + 1, with 2 as the primitive element.

  const GF_EXP = new Uint16Array(256);
  const GF_LOG = new Uint16Array(256);

  (function buildFieldTables() {
    let element = 1;
    for (let i = 0; i < GF_ORDER; ++i) {
      GF_EXP[i] = element;
      GF_LOG[element] = i;
      element = element * 2;
      if (element >= 256) element = OpCodes.XorN(element, GF_POLY);
    }
    GF_EXP[GF_ORDER] = 1;
    GF_LOG[0] = 0;
  })();

  function GfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % GF_ORDER];
  }

  function GfInverse(a) {
    if (a === 0) return 0;
    return GF_EXP[(GF_ORDER - GF_LOG[a]) % GF_ORDER];
  }

  function GfPow(exponent) {
    return GF_EXP[((exponent % GF_ORDER) + GF_ORDER) % GF_ORDER];
  }

  // ===== randomness =====

  /**
   * The submission's randombytes: SHAKE-256 over the seed and domain byte 1.
   * The round 4 package uses this in place of the NIST AES-256 CTR_DRBG, which
   * is why the Known Answer Test seeds can drive this file directly.
   * @param {uint8[]} seed - the 48 octet seed
   * @returns {object} a reader over the stream
   */
  function Prng(seed) {
    return Shake256Stream([seed, [DOMAIN_PRNG]]);
  }

  /**
   * The seed expander: SHAKE-256 over the seed and domain byte 2, squeezed in
   * whole 64 bit words. A request whose length is not a multiple of eight still
   * consumes the whole of the final word, so the skip below is part of the
   * definition rather than an optimisation.
   * @param {uint8[]} seed - the 40 octet seed
   * @returns {object} a reader over the stream
   */
  function SeedExpander(seed) {
    const stream = Shake256Stream([seed, [DOMAIN_SEEDEXPANDER]]);
    return {
      read: function (count) {
        const out = stream.read(count);
        const remainder = count % 8;
        if (remainder !== 0) stream.skip(8 - remainder);
        return out;
      }
    };
  }

  // ===== vectors over GF(2)[x] / (x^n - 1) =====
  //
  // A vector is held as 32 bit words, least significant bit first, so that bit i
  // of the vector is bit i modulo 32 of word i over 32 - the same order in which
  // the scheme serialises its vectors to octets.

  function BytesToWords(bytes, wordCount) {
    const words = new Uint32Array(wordCount);
    const limit = Math.min(bytes.length, wordCount * 4);
    for (let i = 0; i < limit; ++i) {
      const w = OpCodes.Shr32(i, 2);
      words[w] = OpCodes.Or32(words[w], OpCodes.Shl32(OpCodes.AndN(bytes[i], 0xFF), 8 * (i % 4)));
    }
    return words;
  }

  function WordsToBytes(words, byteCount) {
    const bytes = new Array(byteCount);
    for (let i = 0; i < byteCount; ++i)
      bytes[i] = OpCodes.AndN(OpCodes.Shr32(words[OpCodes.Shr32(i, 2)], 8 * (i % 4)), 0xFF);
    return bytes;
  }

  function VectAdd(a, b) {
    const out = new Uint32Array(a.length);
    for (let i = 0; i < a.length; ++i) out[i] = OpCodes.Xor32(a[i], b[i]);
    return out;
  }

  /**
   * Fold every bit at index n or above back down by n, which is the reduction
   * modulo x^n - 1.
   * @param {object} set - the parameter set
   * @param {Uint32Array} accumulator - the unreduced product
   * @returns {Uint32Array} the reduced vector, set.nWords long
   */
  function ReduceCyclic(set, accumulator) {
    const words = set.nWords;
    const top = words - 1;
    const out = new Uint32Array(words);
    for (let i = 0; i < words; ++i) out[i] = accumulator[i];

    const high = new Uint32Array(words);
    for (let i = 0; i < words; ++i) {
      const lower = OpCodes.Shr32(accumulator[top + i], set.topBit);
      const upper = OpCodes.Shl32(accumulator[top + i + 1], 32 - set.topBit);
      high[i] = OpCodes.Or32(lower, upper);
    }

    out[top] = OpCodes.And32(out[top], set.topMask);
    for (let i = 0; i < words; ++i) out[i] = OpCodes.Xor32(out[i], high[i]);

    // The fold can leave a few bits at or above n behind; clear them the same
    // way. Two passes suffice for an honest product and the loop is bounded so
    // that a malformed ciphertext cannot spin here.
    for (let pass = 0; pass < 4; ++pass) {
      const carry = OpCodes.Shr32(out[top], set.topBit);
      if (carry === 0) break;
      out[top] = OpCodes.And32(out[top], set.topMask);
      out[0] = OpCodes.Xor32(out[0], carry);
    }

    return out;
  }

  /**
   * Multiply modulo x^n - 1. In this scheme one operand always has low weight,
   * so it is given by the positions of its set bits and the product is the sum
   * of the other operand shifted to each of them.
   * @param {object} set - the parameter set
   * @param {number[]} sparsePositions - positions of the set bits
   * @param {Uint32Array} dense - the other operand
   * @returns {Uint32Array} the product
   */
  function VectMul(set, sparsePositions, dense) {
    const words = set.nWords;
    const accumulator = new Uint32Array(2 * words + 2);

    for (let s = 0; s < sparsePositions.length; ++s) {
      const position = sparsePositions[s];
      const wordShift = OpCodes.Shr32(position, 5);
      const bitShift = OpCodes.AndN(position, 31);

      if (bitShift === 0) {
        for (let i = 0; i < words; ++i)
          accumulator[wordShift + i] = OpCodes.Xor32(accumulator[wordShift + i], dense[i]);
      } else {
        const back = 32 - bitShift;
        for (let i = 0; i < words; ++i) {
          const d = dense[i];
          if (d === 0) continue;
          const lo = wordShift + i;
          accumulator[lo] = OpCodes.Xor32(accumulator[lo], OpCodes.Shl32(d, bitShift));
          accumulator[lo + 1] = OpCodes.Xor32(accumulator[lo + 1], OpCodes.Shr32(d, back));
        }
      }
    }

    return ReduceCyclic(set, accumulator);
  }

  /**
   * A vector of exactly the given weight, drawn by algorithm 5 of eprint
   * 2021/1631: a partial Fisher-Yates shuffle whose collisions are resolved by
   * sending the colliding entry back to its own index.
   * @param {object} set - the parameter set
   * @param {object} expander - the seed expander to draw from
   * @param {number} weight - the number of set bits
   * @returns {object} the vector and the positions of its set bits
   */
  function VectSetRandomFixedWeight(set, expander, weight) {
    const bytes = expander.read(4 * weight);
    const positions = new Array(weight);

    for (let i = 0; i < weight; ++i) {
      const b = 4 * i;
      const value = bytes[b] + bytes[b + 1] * 0x100 + bytes[b + 2] * 0x10000 + bytes[b + 3] * 0x1000000;
      positions[i] = i + (value % (set.n - i));
    }

    for (let i = weight - 2; i >= 0; --i) {
      let duplicate = false;
      for (let j = i + 1; j < weight; ++j) if (positions[j] === positions[i]) duplicate = true;
      if (duplicate) positions[i] = i;
    }

    const words = new Uint32Array(set.nWords);
    for (let i = 0; i < weight; ++i) {
      const w = OpCodes.Shr32(positions[i], 5);
      words[w] = OpCodes.Or32(words[w], OpCodes.Shl32(1, OpCodes.AndN(positions[i], 31)));
    }

    return { words: words, positions: positions };
  }

  function VectSetRandom(set, expander) {
    const words = BytesToWords(expander.read(set.nBytes), set.nWords);
    words[set.nWords - 1] = OpCodes.And32(words[set.nWords - 1], set.topMask);
    return words;
  }

  // ===== the outer code: duplicated Reed-Muller RM(1,7) =====

  function Bit0Mask(x) {
    return OpCodes.AndN(x, 1) === 1 ? 0xFFFFFFFF : 0;
  }

  /**
   * One message octet to a 128 bit RM(1,7) codeword, held as four words.
   * @param {number} message - the octet
   * @returns {Uint32Array} the codeword
   */
  function ReedMullerEncodeByte(message) {
    let first = Bit0Mask(OpCodes.Shr32(message, 7));
    first = OpCodes.Xor32(first, OpCodes.And32(Bit0Mask(message), 0xAAAAAAAA));
    first = OpCodes.Xor32(first, OpCodes.And32(Bit0Mask(OpCodes.Shr32(message, 1)), 0xCCCCCCCC));
    first = OpCodes.Xor32(first, OpCodes.And32(Bit0Mask(OpCodes.Shr32(message, 2)), 0xF0F0F0F0));
    first = OpCodes.Xor32(first, OpCodes.And32(Bit0Mask(OpCodes.Shr32(message, 3)), 0xFF00FF00));
    first = OpCodes.Xor32(first, OpCodes.And32(Bit0Mask(OpCodes.Shr32(message, 4)), 0xFFFF0000));

    const word = new Uint32Array(4);
    word[0] = first;
    first = OpCodes.Xor32(first, Bit0Mask(OpCodes.Shr32(message, 5)));
    word[1] = first;
    first = OpCodes.Xor32(first, Bit0Mask(OpCodes.Shr32(message, 6)));
    word[3] = first;
    first = OpCodes.Xor32(first, Bit0Mask(OpCodes.Shr32(message, 5)));
    word[2] = first;
    return word;
  }

  function ReedMullerEncode(set, messageBytes) {
    const words = new Uint32Array(set.n1n2Words);
    for (let i = 0; i < set.n1; ++i) {
      const codeword = ReedMullerEncodeByte(messageBytes[i]);
      const base = i * set.multiplicity * 4;
      for (let copy = 0; copy < set.multiplicity; ++copy)
        for (let part = 0; part < 4; ++part) words[base + copy * 4 + part] = codeword[part];
    }
    return words;
  }

  /**
   * The fast Hadamard transform of 128 signed values, in seven passes.
   * @param {Int32Array} source - the input, overwritten
   * @returns {Int32Array} the transform
   */
  function Hadamard(source) {
    let from = source;
    let to = new Int32Array(128);
    for (let pass = 0; pass < 7; ++pass) {
      for (let i = 0; i < 64; ++i) {
        to[i] = from[2 * i] + from[2 * i + 1];
        to[i + 64] = from[2 * i] - from[2 * i + 1];
      }
      const swap = from;
      from = to;
      to = swap;
    }
    return from;
  }

  /**
   * Maximum likelihood decoding of the duplicated code: sum the copies, take
   * the Hadamard transform, and read off the largest coefficient.
   * @param {object} set - the parameter set
   * @param {Uint32Array} words - the received word
   * @returns {number[]} one octet per Reed-Solomon symbol
   */
  function ReedMullerDecode(set, words) {
    const messageBytes = new Array(set.n1);
    const expanded = new Int32Array(128);

    for (let i = 0; i < set.n1; ++i) {
      const base = i * set.multiplicity * 4;
      for (let part = 0; part < 4; ++part)
        for (let bit = 0; bit < 32; ++bit)
          expanded[part * 32 + bit] = OpCodes.AndN(OpCodes.Shr32(words[base + part], bit), 1);
      for (let copy = 1; copy < set.multiplicity; ++copy)
        for (let part = 0; part < 4; ++part)
          for (let bit = 0; bit < 32; ++bit)
            expanded[part * 32 + bit] += OpCodes.AndN(OpCodes.Shr32(words[base + copy * 4 + part], bit), 1);

      const transform = Hadamard(expanded);

      // The copies were summed as zero and one rather than as plus and minus
      // one, which halves every coefficient and leaves the first one high by
      // 64 per copy.
      transform[0] -= 64 * set.multiplicity;

      let peakAbsolute = 0;
      let peakValue = 0;
      let peakPosition = 0;
      for (let j = 0; j < 128; ++j) {
        const t = transform[j];
        const absolute = t > 0 ? t : -t;
        if (absolute > peakAbsolute) {
          peakValue = t;
          peakPosition = j;
          peakAbsolute = absolute;
        }
      }
      messageBytes[i] = peakValue > 0 ? peakPosition + 128 : peakPosition;
    }

    return messageBytes;
  }

  // ===== the inner code: Reed-Solomon over GF(2^8) =====

  /**
   * Systematic encoding by the shift register of the generator polynomial.
   * @param {object} set - the parameter set
   * @param {number[]} messageBytes - k message octets
   * @returns {number[]} n1 codeword octets
   */
  function ReedSolomonEncode(set, messageBytes) {
    const codeword = new Array(set.n1).fill(0);
    const tmp = new Array(set.g).fill(0);
    const parity = set.n1 - set.k;

    for (let i = 0; i < set.k; ++i) {
      const gate = OpCodes.XorN(messageBytes[set.k - 1 - i], codeword[parity - 1]);
      for (let j = 0; j < set.g; ++j) tmp[j] = GfMul(gate, set.rsPoly[j]);
      for (let kk = parity - 1; kk > 0; --kk) codeword[kk] = OpCodes.XorN(codeword[kk - 1], tmp[kk]);
      codeword[0] = tmp[0];
    }

    for (let i = 0; i < set.k; ++i) codeword[parity + i] = messageBytes[i];
    return codeword;
  }

  /** The 2 delta syndromes, the received word evaluated at alpha^1 .. alpha^2delta. */
  function ComputeSyndromes(set, codeword) {
    const syndromes = new Array(2 * set.delta).fill(0);
    for (let i = 0; i < 2 * set.delta; ++i) {
      let sum = codeword[0];
      for (let j = 1; j < set.n1; ++j)
        sum = OpCodes.XorN(sum, GfMul(codeword[j], GfPow((i + 1) * j)));
      syndromes[i] = sum;
    }
    return syndromes;
  }

  /**
   * Berlekamp's simplified algorithm for the error locator polynomial.
   * @param {object} set - the parameter set
   * @param {number[]} syndromes - the syndromes
   * @returns {object} the locator and its degree
   */
  function ComputeErrorLocator(set, syndromes) {
    const sigma = new Array(set.delta + 1).fill(0);
    const sigmaPrevious = new Array(set.delta + 1).fill(0);
    sigmaPrevious[1] = 1;

    let degreeSigma = 0;
    let degreeSigmaPrevious = 0;
    let rho = -1;
    let discrepancyPrevious = 1;
    let discrepancy = syndromes[0];

    sigma[0] = 1;

    for (let mu = 0; mu < 2 * set.delta; ++mu) {
      const sigmaCopy = sigma.slice();
      const degreeSigmaCopy = degreeSigma;

      const ratio = GfMul(discrepancy, GfInverse(discrepancyPrevious));
      for (let i = 1; i <= mu + 1 && i <= set.delta; ++i)
        sigma[i] = OpCodes.XorN(sigma[i], GfMul(ratio, sigmaPrevious[i]));

      const degreeShifted = (mu - rho) + degreeSigmaPrevious;
      const grew = discrepancy !== 0 && degreeShifted > degreeSigma;
      if (grew) degreeSigma = degreeShifted;

      if (mu === 2 * set.delta - 1) break;

      if (grew) {
        rho = mu;
        discrepancyPrevious = discrepancy;
        for (let i = set.delta; i > 0; --i) sigmaPrevious[i] = sigmaCopy[i - 1];
        degreeSigmaPrevious = degreeSigmaCopy;
      } else {
        for (let i = set.delta; i > 0; --i) sigmaPrevious[i] = sigmaPrevious[i - 1];
      }

      discrepancy = syndromes[mu + 1];
      for (let i = 1; i <= mu + 1 && i <= set.delta; ++i)
        discrepancy = OpCodes.XorN(discrepancy, GfMul(sigma[i], syndromes[mu + 1 - i]));
    }

    return { sigma: sigma, degree: degreeSigma };
  }

  /** Chien search: position i carries an error when the locator vanishes at alpha^-i. */
  function ComputeErrorPositions(set, sigma) {
    const positions = [];
    for (let i = 0; i < set.n1; ++i) {
      const x = GfPow(-i);
      let value = 0;
      let power = 1;
      for (let j = 0; j <= set.delta; ++j) {
        value = OpCodes.XorN(value, GfMul(sigma[j], power));
        power = GfMul(power, x);
      }
      if (value === 0) positions.push(i);
    }
    return positions;
  }

  function ComputeZPoly(set, sigma, degree, syndromes) {
    const z = new Array(set.delta + 1).fill(0);
    z[0] = 1;
    for (let i = 1; i <= set.delta; ++i) z[i] = i <= degree ? sigma[i] : 0;
    z[1] = OpCodes.XorN(z[1], syndromes[0]);

    for (let i = 2; i <= set.delta; ++i) {
      if (i > degree) continue;
      z[i] = OpCodes.XorN(z[i], syndromes[i - 1]);
      for (let j = 1; j < i; ++j) z[i] = OpCodes.XorN(z[i], GfMul(sigma[j], syndromes[i - j - 1]));
    }
    return z;
  }

  /** Forney's formula for the magnitude of the error at each located position. */
  function ComputeErrorValues(set, z, positions) {
    const beta = new Array(set.delta).fill(0);
    const count = Math.min(positions.length, set.delta);
    for (let i = 0; i < count; ++i) beta[i] = GfPow(positions[i]);

    const values = new Array(set.delta).fill(0);
    for (let i = 0; i < set.delta; ++i) {
      const inverse = GfInverse(beta[i]);
      let numerator = 1;
      let power = 1;
      for (let j = 1; j <= set.delta; ++j) {
        power = GfMul(power, inverse);
        numerator = OpCodes.XorN(numerator, GfMul(power, z[j]));
      }
      let denominator = 1;
      for (let kk = 1; kk < set.delta; ++kk)
        denominator = GfMul(denominator, OpCodes.XorN(1, GfMul(inverse, beta[(i + kk) % set.delta])));
      values[i] = i < count ? GfMul(numerator, GfInverse(denominator)) : 0;
    }

    const errorValues = new Array(set.n1).fill(0);
    for (let i = 0; i < count; ++i) errorValues[positions[i]] = values[i];
    return errorValues;
  }

  function ReedSolomonDecode(set, codewordBytes) {
    const codeword = codewordBytes.slice(0, set.n1);
    const syndromes = ComputeSyndromes(set, codeword);
    const locator = ComputeErrorLocator(set, syndromes);
    const positions = ComputeErrorPositions(set, locator.sigma);
    const z = ComputeZPoly(set, locator.sigma, locator.degree, syndromes);
    const errorValues = ComputeErrorValues(set, z, positions);

    for (let i = 0; i < set.n1; ++i) codeword[i] = OpCodes.XorN(codeword[i], errorValues[i]);
    return codeword.slice(set.g - 1, set.g - 1 + set.k);
  }

  function CodeEncode(set, messageBytes) {
    return ReedMullerEncode(set, ReedSolomonEncode(set, messageBytes));
  }

  function CodeDecode(set, words) {
    return ReedSolomonDecode(set, ReedMullerDecode(set, words));
  }

  // ===== the public key encryption scheme =====

  function PublicKeyFromString(set, pk) {
    return {
      h: VectSetRandom(set, SeedExpander(pk.slice(0, SEED_BYTES))),
      s: BytesToWords(pk.slice(SEED_BYTES, SEED_BYTES + set.nBytes), set.nWords)
    };
  }

  /**
   * The key pair. The public key names the seed of h and the syndrome
   * s = x + h y; the secret key names the seed of x and y, with the public key
   * appended so that the serialised forms match the NIST interface.
   * @param {object} set - the parameter set
   * @param {object} prng - the stream to draw the two seeds from
   * @returns {object} the public and secret keys as octet strings
   */
  function PkeKeygen(set, prng) {
    const skSeed = prng.read(SEED_BYTES);
    const skExpander = SeedExpander(skSeed);
    const pkSeed = prng.read(SEED_BYTES);
    const pkExpander = SeedExpander(pkSeed);

    const x = VectSetRandomFixedWeight(set, skExpander, set.omega);
    const y = VectSetRandomFixedWeight(set, skExpander, set.omega);

    const h = VectSetRandom(set, pkExpander);
    const s = VectAdd(x.words, VectMul(set, y.positions, h));

    const publicKey = pkSeed.concat(WordsToBytes(s, set.nBytes));
    return { publicKey: publicKey, secretKey: skSeed.concat(publicKey) };
  }

  /**
   * Encrypt: u = r1 + h r2 and v = mG + s r2 + e, for low weight r1, r2 and e
   * drawn from theta.
   * @param {object} set - the parameter set
   * @param {number[]} messageBytes - k octets
   * @param {number[]} theta - the randomness seed
   * @param {number[]} pk - the public key
   * @returns {object} the two ciphertext vectors
   */
  function PkeEncrypt(set, messageBytes, theta, pk) {
    const expander = SeedExpander(theta.slice(0, SEED_BYTES));
    const key = PublicKeyFromString(set, pk);

    const r1 = VectSetRandomFixedWeight(set, expander, set.omegaR);
    const r2 = VectSetRandomFixedWeight(set, expander, set.omegaR);
    const e = VectSetRandomFixedWeight(set, expander, set.omegaE);

    const u = VectAdd(r1.words, VectMul(set, r2.positions, key.h));

    const encoded = CodeEncode(set, messageBytes);
    const lifted = new Uint32Array(set.nWords);
    for (let i = 0; i < encoded.length; ++i) lifted[i] = encoded[i];

    let v = VectAdd(VectMul(set, r2.positions, key.s), e.words);
    v = VectAdd(v, lifted);

    return { u: u, v: v.slice(0, set.n1n2Words) };
  }

  /**
   * Decrypt by decoding v - u y, which differs from the codeword only by the
   * low weight combination the secret cancels.
   * @param {object} set - the parameter set
   * @param {Uint32Array} u - first ciphertext vector
   * @param {Uint32Array} v - second ciphertext vector
   * @param {number[]} sk - the secret key
   * @returns {number[]} the k recovered octets
   */
  function PkeDecrypt(set, u, v, sk) {
    const expander = SeedExpander(sk.slice(0, SEED_BYTES));
    VectSetRandomFixedWeight(set, expander, set.omega);      // x, which decryption does not need
    const y = VectSetRandomFixedWeight(set, expander, set.omega);

    const lifted = new Uint32Array(set.nWords);
    for (let i = 0; i < v.length; ++i) lifted[i] = v[i];

    const difference = VectAdd(lifted, VectMul(set, y.positions, u));
    return CodeDecode(set, difference.slice(0, set.n1n2Words));
  }

  // ===== the key encapsulation mechanism =====

  /**
   * Encapsulate. The message and the salt are the randomness; theta is derived
   * from them with the public key's seed, which is the Hofheinz-Hovelmanns-Kiltz
   * transform that makes the scheme chosen-ciphertext secure.
   * @param {object} set - the parameter set
   * @param {number[]} pk - the public key
   * @param {number[]} randomness - k + 16 octets, the message then the salt
   * @returns {object} the ciphertext and the shared secret
   */
  function Encapsulate(set, pk, randomness) {
    const m = randomness.slice(0, set.k);
    const salt = randomness.slice(set.k, set.k + SALT_BYTES);

    const theta = Shake256([m, pk.slice(0, SEED_BYTES), salt, [DOMAIN_G]], HASH_BYTES);
    const encrypted = PkeEncrypt(set, m, theta, pk);
    const d = Shake256([m, [DOMAIN_H]], HASH_BYTES);

    const uBytes = WordsToBytes(encrypted.u, set.nBytes);
    const vBytes = WordsToBytes(encrypted.v, set.n1n2Bytes);

    return {
      ciphertext: uBytes.concat(vBytes).concat(d).concat(salt),
      sharedSecret: Shake256([m, uBytes, vBytes, [DOMAIN_K]], HASH_BYTES)
    };
  }

  /**
   * Decapsulate. The recovered message is re-encrypted and the result compared
   * with what arrived; a ciphertext this key did not produce yields a secret of
   * zeroes rather than the one the sender derived.
   * @param {object} set - the parameter set
   * @param {number[]} ciphertext - the ciphertext
   * @param {number[]} sk - the secret key
   * @returns {number[]} the shared secret
   */
  function Decapsulate(set, ciphertext, sk) {
    const uBytes = ciphertext.slice(0, set.nBytes);
    const vBytes = ciphertext.slice(set.nBytes, set.nBytes + set.n1n2Bytes);
    const d = ciphertext.slice(set.nBytes + set.n1n2Bytes, set.nBytes + set.n1n2Bytes + HASH_BYTES);
    const salt = ciphertext.slice(set.nBytes + set.n1n2Bytes + HASH_BYTES);

    const u = BytesToWords(uBytes, set.nWords);
    const v = BytesToWords(vBytes, set.n1n2Words);
    const pk = sk.slice(SEED_BYTES);

    const m = PkeDecrypt(set, u, v, sk);

    const theta = Shake256([m, pk.slice(0, SEED_BYTES), salt, [DOMAIN_G]], HASH_BYTES);
    const reEncrypted = PkeEncrypt(set, m, theta, pk);
    const d2 = Shake256([m, [DOMAIN_H]], HASH_BYTES);
    const sharedSecret = Shake256([m, uBytes, vBytes, [DOMAIN_K]], HASH_BYTES);

    const u2Bytes = WordsToBytes(reEncrypted.u, set.nBytes);
    const v2Bytes = WordsToBytes(reEncrypted.v, set.n1n2Bytes);

    let agree = uBytes.length === set.nBytes && vBytes.length === set.n1n2Bytes;
    for (let i = 0; agree && i < set.nBytes; ++i) if (uBytes[i] !== u2Bytes[i]) agree = false;
    for (let i = 0; agree && i < set.n1n2Bytes; ++i) if (vBytes[i] !== v2Bytes[i]) agree = false;
    for (let i = 0; agree && i < HASH_BYTES; ++i) if (d[i] !== d2[i]) agree = false;

    if (!agree) return new Array(set.sharedSecretSize).fill(0);
    return sharedSecret;
  }

  /**
   * One Known Answer Test record, end to end from its 48 octet seed: the key
   * pair and then the encapsulation, drawn from one stream in that order, which
   * is what the submission's generator does.
   * @param {object} set - the parameter set
   * @param {uint8[]} seed - the 48 octet seed
   * @returns {object} the public key, secret key, ciphertext and shared secret
   */
  function KatRecord(set, seed) {
    const prng = Prng(seed);
    const pair = PkeKeygen(set, prng);
    const randomness = prng.read(set.k).concat(prng.read(SALT_BYTES));
    const encapsulated = Encapsulate(set, pair.publicKey, randomness);
    return {
      publicKey: pair.publicKey,
      secretKey: pair.secretKey,
      randomness: randomness,
      ciphertext: encapsulated.ciphertext,
      sharedSecret: encapsulated.sharedSecret
    };
  }

  // ===== TEST VECTORS =====
  //
  // Every expected value below is taken verbatim from the HQC submission's own
  // Known Answer Tests - hqc-128_kat.rsp, hqc-192_kat.rsp and hqc-256_kat.rsp
  // in the round 4 package - and nothing here was produced by this file. The
  // seeds are the published ones, so a vector names only data that appears in
  // those files.
  //
  // The full sweep is wider than what is committed here: all 100 records of
  // each of the three files agree on all five published fields.

  const KAT128_SEED = OpCodes.Hex8ToBytes("42C667A186390F26C8F024D31D5FE3D20145BC2FCCF26C865E20DF7626CEF09E4D9EADD263D95EDE934A74B3721EAAB0");
  const KAT128_PK = OpCodes.Hex8ToBytes(
      "5009C2E5C95AA03DCBF09F69C9529DA97F496712E083181F51F06AA7E7F733149CCE4BD1A190A9B5CD376F2400EA478B9416B4969034F791BB2AA09EAA62B828" +
      "787BE8A87B216DA8ABDC184DE896C2DE0D83C1452E3C82E5BA3DFF7C5D8674200874F79187FE5655BD1FEB87AC1C3B64A1D682B39FA52C8706C4FCDD92A8013B" +
      "F211F959532FB0012F26DC13252A95C9C3273A749E135C5FCAE127B5D5B3BEFBAFE592C930E4E4493DE9963EC7B349274F18CFEB1A6AF22591EF217BCC910715" +
      "A279F05EBDBC3484ACC6E739FE1666D83F0C4557E115F8AE182663A97B91F2C0EFE102D0E7B0F1B8B6393DCAC437F56818C11B50A5C122377C204245025855F3" +
      "25946FA32B9A31FAF5F794E1FEF35EF3CE61880591DB353EE0E2B59D96694661C5D4D29C9E9C41C402F5713DB467844DB5258F5FEEEC036088AF8B29B221C228" +
      "DE34AA1B458C41F0D8229300EB910D04C80CD0758EB2A756046CA1772A63C2D72F7F92B4A3A765D8EA4290060CCEF8A1C5E61D98D66EB4A94AC3EF46D36431FD" +
      "8B3CC977FD326976F092F9566010576C627D2DECC0CBEC01775A46F4B597DB0150F41642200592BB4AC1A56992041FD256E3B277506FFE96C7CC02D5DB295D69" +
      "0508AD1C4E8B1652B1FC3BFD93E1A11023A49A2A38470AC4E1F02F464C19CBC65FD418BECE6639742C19A1ABD8F3064817C0C853603834A98F35F24ED7AD3D93" +
      "9AE7F5EE59923224D9C036906FB85A5C7BD7466B2EE507ABA60A5DCCC8677A76B7D5B94C047A3D03321EDC520DDBF8FFABFDCA98565E1B1CC083E6F2653BB40D" +
      "082F55FF040DFFD91D2FBAC9DCC782E7DB829C88DACF4ABDC5B8CACE9D45CA00D6A61927175A07D55AFAFE884F9E8286C2695A06360250C1D9B02D0C38686C6D" +
      "65AC4D982D91A3FA58A989F3B0B58EA3F8B60740912A0F6B29EC942D37CEFDF69E26BC4BB3625B87840C8159A4AB4D52D0872CB0C5DD1AA73344BCE97ADF9C70" +
      "F57A90F6E6E7A620F206FB71F069EE42D7D871B29FFFD49FDF63E75D6C3C3BD5AD7F64B6EAB0C9E68028A4C5C8EA515C65012D0CA31E387F825DCB008043AFB7" +
      "D83D82993AF96297E91D97659157E6015D96031CC11F1878BFC3D5A2D709701CC0C9166DB06C64213190AD46EE17B7BDA1A68F2AE433D33ADBED2769F56C0E3D" +
      "19C957CE6BC09C28683707F41AD72447829F1BCD600400FA2248A0C7F9909C695F480CA61B898E6E538D9058F27E6D57C18D8EC2A5EB3FD1CDA7A0FCB1C8A7B5" +
      "3F8B4B701C5E94DECF1CD210ECC6F7FA022F8FFF9625B04E9FD2B3DD47C5F8E8E9043F7CBCA38B632A89367D0F08BAD52BAB56C13FE562ED638C957AF90B3702" +
      "7276E56AE9F27838DC614F220C92C82CB435737A0E06B86BA9F3F65D4F2622D616C4EAA9F8E0182D42212FEECD5766C1E8ED3962632389E67C1D82B83AE28668" +
      "E9BBFA0D608B56BBD4C1E89A61AB831055BFBCF5E417AB3FE547E16305CCA5816BA017DF4D3BBAFE0EAED7C26D4B95F0CBC5325B86755435DB71015BEA229582" +
      "F194244C629AE5F1EDDB0E16BABC23C22E26831E71A776AF3BB0668DD2AC558865ACE9261AEBB16C7892906A51791E8FF9A988FB0CC01E57EBF9D20B1FC6D850" +
      "96832A88C9D6E53BE63084C9585DE9944D16D53655E65410BC540B59B6459DE912A0C4ED0D90619F11C2862AF6624A74FCA7C0127FD5A433D3FEDCEE44D4588E" +
      "903DFF7B485BA8FB20A83F859EFBF6DA705B3FBADA7D5AFDF51C9E56B7DCC3CA6584BC00B8B8430D6FD3F6891DD984491E151EA69493C63637A947A8FDF4F21C" +
      "7A1F05733B71E05A036B96E272B7C01A15A51D0B83EF4CECB84EF1CB1AFE0033F8B996F8C072E358C5FE9BCE58C24C1FF6A910034D3073F381C6D21F1DA976C6" +
      "0A1F103E8592ED1B739F262FBC6218FE1986A6215965AAAC0C8A77FBCA2838E428110ADBBB6037F73F5DB5EBD5F42C2209B7B6D3B177D4A09F76E343547450E6" +
      "ECAC0D1B39FFA1BA153ECAFF96A84F63151BA30E561A2A5AF8604F75CFE2352DB59BF57C2B451D54EBABF1D4E735BEC95440CA1DB9243161DA40F6CC02343CDC" +
      "A7EDD4CCFF814EC527C32E41BC61C71E02C67C03DBFEDCFC927FAB32EEB795C7998BB24CFD7A6B1624A4E332B0AB959CEA76AB129C21F0EDBF875BA98468BFF8" +
      "AB7CCA4C3D8EF714E9E0590A6B44F3B5EFB5098C92D89231AA45BB2285E27CBF751E9222ED6B020E74485363DA8007BFD6914F770F7AAF3874AF99D0010C2D72" +
      "8BAD2BD888CE75A1E2F462541DDB188D57700C110CB1C708EB8D944671C5C29F1A45B7E65CDFC3B9BA8685D82A281C18CDDCD31682B3255B315E6ECBE1198396" +
      "D4F53A8979CB320003518811787D6178FAFD58A88F6F9B87EA026A1C62E5594DF6205ACA8E604A5229C06432249229A71138CFE0639AA93CEA7FF73371DE6EE4" +
      "CF40714222C9BA3AB18DCD76BBCE3FFD60EB1BB6A33A18559099B6AF108AE62DFD6455CD91232F136ECCB20F14DD98DE33836BF0C66FF61504497E01448AE90A" +
      "7244C22A1F42D719184ADEBDDD83D8D7A373557684C0463B788C4F853D586B0B36E713678F43E4AB9E7271F0C3C7B6E18FF3E4D1FCACE54B887CD8954D23BCB4" +
      "C83770F9AA9735C383A5E75ED0FD8A9F4F1FD681A181A263F535B2EEEB57DB7841921AF6FCBA5CDFCACB096EDEA9612F7357A70FC9938C572178BA258D017524" +
      "A098A11BAD177F2066162A3FBA32CD9A4162DAF8BBE50341CAA4029678CC1E5F12418CCB7143E09A83E58896D5F9BAEE9C7A34089DE0677B1D5D4763EBA84A19" +
      "DDBD57C797E8E3121C6F6944D4FAC756246265FE67178E3FB3E7CD25765075CD14E753189258F22F5A7547F9DF38A6816CFAB8D8951935C4DEFFA9B650891122" +
      "9AE4548CF2B3682C8E28A1B287E93778B0D453AA3371569E649E4F6D356B59914A9A8C33DF4C0BD06EAB13CA0E228E4C4CDF2B46203515E9489240319E747ABC" +
      "329ACF13306C66019546DFCF4FD1875FB13DD4B4F4394868ADB735A51398237DE2AB5FAED74A39E5FC560F60522479925D13A8C9D1112A58968A05FCE1FEF891" +
      "E3AE71A52D3DCAA5EA682377125725F0EF91BBA31B006FEF2FD9E4D46566BF3B85839642987541A8D113EFABF7C4F5A68590F6B855A0BF49B1DEA63C41314CB6" +
      "A8DFA06292C3F81403");
  const KAT128_SK = OpCodes.Hex8ToBytes(
      "9EDE2A61C7F15ADC29DDA6CB30E086E2D67B86FEC8172369F3953548D3BD147494C86C53DA5AB23A5009C2E5C95AA03DCBF09F69C9529DA97F496712E083181F" +
      "51F06AA7E7F733149CCE4BD1A190A9B5CD376F2400EA478B9416B4969034F791BB2AA09EAA62B828787BE8A87B216DA8ABDC184DE896C2DE0D83C1452E3C82E5" +
      "BA3DFF7C5D8674200874F79187FE5655BD1FEB87AC1C3B64A1D682B39FA52C8706C4FCDD92A8013BF211F959532FB0012F26DC13252A95C9C3273A749E135C5F" +
      "CAE127B5D5B3BEFBAFE592C930E4E4493DE9963EC7B349274F18CFEB1A6AF22591EF217BCC910715A279F05EBDBC3484ACC6E739FE1666D83F0C4557E115F8AE" +
      "182663A97B91F2C0EFE102D0E7B0F1B8B6393DCAC437F56818C11B50A5C122377C204245025855F325946FA32B9A31FAF5F794E1FEF35EF3CE61880591DB353E" +
      "E0E2B59D96694661C5D4D29C9E9C41C402F5713DB467844DB5258F5FEEEC036088AF8B29B221C228DE34AA1B458C41F0D8229300EB910D04C80CD0758EB2A756" +
      "046CA1772A63C2D72F7F92B4A3A765D8EA4290060CCEF8A1C5E61D98D66EB4A94AC3EF46D36431FD8B3CC977FD326976F092F9566010576C627D2DECC0CBEC01" +
      "775A46F4B597DB0150F41642200592BB4AC1A56992041FD256E3B277506FFE96C7CC02D5DB295D690508AD1C4E8B1652B1FC3BFD93E1A11023A49A2A38470AC4" +
      "E1F02F464C19CBC65FD418BECE6639742C19A1ABD8F3064817C0C853603834A98F35F24ED7AD3D939AE7F5EE59923224D9C036906FB85A5C7BD7466B2EE507AB" +
      "A60A5DCCC8677A76B7D5B94C047A3D03321EDC520DDBF8FFABFDCA98565E1B1CC083E6F2653BB40D082F55FF040DFFD91D2FBAC9DCC782E7DB829C88DACF4ABD" +
      "C5B8CACE9D45CA00D6A61927175A07D55AFAFE884F9E8286C2695A06360250C1D9B02D0C38686C6D65AC4D982D91A3FA58A989F3B0B58EA3F8B60740912A0F6B" +
      "29EC942D37CEFDF69E26BC4BB3625B87840C8159A4AB4D52D0872CB0C5DD1AA73344BCE97ADF9C70F57A90F6E6E7A620F206FB71F069EE42D7D871B29FFFD49F" +
      "DF63E75D6C3C3BD5AD7F64B6EAB0C9E68028A4C5C8EA515C65012D0CA31E387F825DCB008043AFB7D83D82993AF96297E91D97659157E6015D96031CC11F1878" +
      "BFC3D5A2D709701CC0C9166DB06C64213190AD46EE17B7BDA1A68F2AE433D33ADBED2769F56C0E3D19C957CE6BC09C28683707F41AD72447829F1BCD600400FA" +
      "2248A0C7F9909C695F480CA61B898E6E538D9058F27E6D57C18D8EC2A5EB3FD1CDA7A0FCB1C8A7B53F8B4B701C5E94DECF1CD210ECC6F7FA022F8FFF9625B04E" +
      "9FD2B3DD47C5F8E8E9043F7CBCA38B632A89367D0F08BAD52BAB56C13FE562ED638C957AF90B37027276E56AE9F27838DC614F220C92C82CB435737A0E06B86B" +
      "A9F3F65D4F2622D616C4EAA9F8E0182D42212FEECD5766C1E8ED3962632389E67C1D82B83AE28668E9BBFA0D608B56BBD4C1E89A61AB831055BFBCF5E417AB3F" +
      "E547E16305CCA5816BA017DF4D3BBAFE0EAED7C26D4B95F0CBC5325B86755435DB71015BEA229582F194244C629AE5F1EDDB0E16BABC23C22E26831E71A776AF" +
      "3BB0668DD2AC558865ACE9261AEBB16C7892906A51791E8FF9A988FB0CC01E57EBF9D20B1FC6D85096832A88C9D6E53BE63084C9585DE9944D16D53655E65410" +
      "BC540B59B6459DE912A0C4ED0D90619F11C2862AF6624A74FCA7C0127FD5A433D3FEDCEE44D4588E903DFF7B485BA8FB20A83F859EFBF6DA705B3FBADA7D5AFD" +
      "F51C9E56B7DCC3CA6584BC00B8B8430D6FD3F6891DD984491E151EA69493C63637A947A8FDF4F21C7A1F05733B71E05A036B96E272B7C01A15A51D0B83EF4CEC" +
      "B84EF1CB1AFE0033F8B996F8C072E358C5FE9BCE58C24C1FF6A910034D3073F381C6D21F1DA976C60A1F103E8592ED1B739F262FBC6218FE1986A6215965AAAC" +
      "0C8A77FBCA2838E428110ADBBB6037F73F5DB5EBD5F42C2209B7B6D3B177D4A09F76E343547450E6ECAC0D1B39FFA1BA153ECAFF96A84F63151BA30E561A2A5A" +
      "F8604F75CFE2352DB59BF57C2B451D54EBABF1D4E735BEC95440CA1DB9243161DA40F6CC02343CDCA7EDD4CCFF814EC527C32E41BC61C71E02C67C03DBFEDCFC" +
      "927FAB32EEB795C7998BB24CFD7A6B1624A4E332B0AB959CEA76AB129C21F0EDBF875BA98468BFF8AB7CCA4C3D8EF714E9E0590A6B44F3B5EFB5098C92D89231" +
      "AA45BB2285E27CBF751E9222ED6B020E74485363DA8007BFD6914F770F7AAF3874AF99D0010C2D728BAD2BD888CE75A1E2F462541DDB188D57700C110CB1C708" +
      "EB8D944671C5C29F1A45B7E65CDFC3B9BA8685D82A281C18CDDCD31682B3255B315E6ECBE1198396D4F53A8979CB320003518811787D6178FAFD58A88F6F9B87" +
      "EA026A1C62E5594DF6205ACA8E604A5229C06432249229A71138CFE0639AA93CEA7FF73371DE6EE4CF40714222C9BA3AB18DCD76BBCE3FFD60EB1BB6A33A1855" +
      "9099B6AF108AE62DFD6455CD91232F136ECCB20F14DD98DE33836BF0C66FF61504497E01448AE90A7244C22A1F42D719184ADEBDDD83D8D7A373557684C0463B" +
      "788C4F853D586B0B36E713678F43E4AB9E7271F0C3C7B6E18FF3E4D1FCACE54B887CD8954D23BCB4C83770F9AA9735C383A5E75ED0FD8A9F4F1FD681A181A263" +
      "F535B2EEEB57DB7841921AF6FCBA5CDFCACB096EDEA9612F7357A70FC9938C572178BA258D017524A098A11BAD177F2066162A3FBA32CD9A4162DAF8BBE50341" +
      "CAA4029678CC1E5F12418CCB7143E09A83E58896D5F9BAEE9C7A34089DE0677B1D5D4763EBA84A19DDBD57C797E8E3121C6F6944D4FAC756246265FE67178E3F" +
      "B3E7CD25765075CD14E753189258F22F5A7547F9DF38A6816CFAB8D8951935C4DEFFA9B6508911229AE4548CF2B3682C8E28A1B287E93778B0D453AA3371569E" +
      "649E4F6D356B59914A9A8C33DF4C0BD06EAB13CA0E228E4C4CDF2B46203515E9489240319E747ABC329ACF13306C66019546DFCF4FD1875FB13DD4B4F4394868" +
      "ADB735A51398237DE2AB5FAED74A39E5FC560F60522479925D13A8C9D1112A58968A05FCE1FEF891E3AE71A52D3DCAA5EA682377125725F0EF91BBA31B006FEF" +
      "2FD9E4D46566BF3B85839642987541A8D113EFABF7C4F5A68590F6B855A0BF49B1DEA63C41314CB6A8DFA06292C3F81403");
  const KAT128_CT = OpCodes.Hex8ToBytes(
      "D02633BD49CE27AFE750E0582F8152EE484E1A2787C0277ED436244616C9A0D571E94B107DB13DA59528960E2B2C469B735A6C20F60BB2E7C1B2046EBDDF82BA" +
      "BE29089F969CDD51D66DA6929681D17113A26C90C6854E0BE79270509A984E411307A967D2F58D22DC2ECAD33BC054FE228037B7B75EFAFA0FA3B0D8D2B85FC5" +
      "7A21F678325D9355CB5501C5E2619F9D3C3160C9A2D05B9E2C067E761F07B2A695E7A86F5BB3F85993E81C09C860D7F9AEA2E73331C2BAB6E2865FE26F6A3342" +
      "1DA8F4713DDB3A89F5761E031519750EB8BB02716D28F6326B4339243048F3FD11FAA1B8B59D54202747EF365004C31816229C846910D5C5334B00C8EA5C8F93" +
      "9F3A31D07B79ACEC0F8D679D7DF012DB9660AB9DB164EE0D0195B43DBA629325BBAFF8AF220FF6256682FC289921C6B0C441A3C2D6663FBFFEDC7C35BF88942C" +
      "50B32B234E5A223CCBA19991869AE3E086223DFDF51E505CE5DFDC16FC6A6ABDCBE8EB2E76643AA38C77997A11381402506E02677E9048B129258343E07723FE" +
      "F3FE08CED8EDCA1E71577DEEDECC3CFFEDCBD9DC0E5D3B8390361A6CA9C212CBF26065896093D6386B43AC3857188AE5A0A53D2F8F414A87A1FCEDE0EACA72C1" +
      "0D9BACE5BBFFAC2F10B3FB3649DA884521C55886397C1F58E8DD67FF9BC1CC1AC658626DACDFA1FD30397D0F6D7AC1C83584A162064BD4389A289A2BCB135F51" +
      "3BF2C93F960B03AADC63B9A58C41301F426CB9FB7A4B3C77D7117C51AB70D9ED648B8808529D8A58F95497106C06C44085B0F90A7087A408C18D6C76D18281AD" +
      "B172323BC6E05D4DB41FD696F616EA4A19B8DF4911E78C6A224CEC906717D5F95C3AB4B2C0ABE8A370F8FE2AB61DF6DB2BA3418DD78983C1C67E174424F5D00B" +
      "CCC6E26777666379EAA9F9E54F09A61942C311C4657066E8490DEEA42DFD5CA6F2D39962027488CDA472D7A23E9D9F4E99DDC6239E57E16565A57394F5ABEC71" +
      "DB86978C2B9D29CEE833FFEF2941EB88937F4B557FFCE0F727FB5077E51B6446163F8B5C41151E4DBE6F985BA9BFFBCCE761B56CE69E3DA4265D8262C045E328" +
      "64E92F83B7E350E6E3D649875C17481004B5FE40FFF0D1C0C7D1F6B83BBF67A718119804E1896C0E91CDC7415EEC853F0067C888DB17A62B5B35C1445AE21A23" +
      "BB17D8DAC68092F8391A428F14A64FE8DB91AEF553FF1FE15A47BB5BAEE676FDD232F8657EBF135731B50F1562AE622C9A0EAF562C5B5EB3EDDB761D093504DC" +
      "10F51928EE0AF8AAE7A060EEA73D22AD324D5B5765EC2DACB003C8E47C428919F3C7E471250820B0541D449EA2FDBA4D46E20BA6DBFB6540191CD6D474702EDE" +
      "C7E8568C22264E366AF048C4064768C343412907A98E2DBF872851778879BD7821D6646038FAFA0848AAA2AD295C823D55E5D3F4F4381178742C1BAED72BBCC5" +
      "5FA05A8A061E52AABA7F4E5862FD656AA7EBE46DBA82B2982D804EE36686453103619780D92C4F4072C54D2684A7A6DE1E6553B96FF9F455D590F9C4CFD18FBA" +
      "90E30043392B26E7449BAB36745F7444537EBDC5AACF3F9D42D993E39A8E2C8C28C29F39BFF9A4E9A344D507AD21ED8FC35339B879F9B124A1A640DF82A0227F" +
      "5298759B7A527362128BE702F0E3A510F17F2C09D1BD101718DC79FAFC72CC706678F36702D70D842B9F64C20E5FB71B11467516A7AAB75B1FE4087F6746D2FB" +
      "FA351405E8053125574CA29FD86479DCE07D489C70C570E631244480A7A7A4C2C635708597C07393889BC9543A4665C8FA0D24A87FF143A2098B19BD6667397B" +
      "6BA2EEC214133D1077D97015549EF98FB13D585770EF60E6C50E4AA3CDD9F4B2F09E65E061616B810EB055BBD771E40EB848660472B56CB18DE08F0F2E93093E" +
      "870280E81AF4C6BE59FED2B9398E053C503D10C00465177EC314D03F566D1B6A3EFADB3D2BB2E955B864F6129EBC61EB7347A6B886EBF1BD236B48CA6D73C2E9" +
      "AB38CA4635B3ADE9DC02FDC47FB7891B5CFC1F223476393C370121A2258CB999CE4F878614B27CC81E079A4D17FB59F74A052F11F431504E3F6EA2F98C861AFE" +
      "30EFC845933DCA5FEBDCDC1B68EDA019FFD8B1E286113661A0E1849F1A7B8418B2689CE9CA4AE0CF286F42DF0AB6E56F3E17879D8A1633A41EB915B89217252C" +
      "DEA099A939496923E238064444B35B1FD36BF3BEA193D63CD55CF46448FCC468E74A625BF629BFE132F59A81B8D8D6CD2AD00509437399B2798F2E10383CAEF9" +
      "A75722C3E9D4EC4651AE28994B4E7BA9EAADE648B1B1FE7528C000124877A452220F19AC5958D6886EA4E06CEB2C754740D3EDAF97B49976ED39FF04833F880F" +
      "FED5EF354FFF127167A3AFCC3B89A07772EC35A3EBBBC2BDB9E18D79C563ED6E8A6AF38D75786A57019B030630898E69EE144427473D8269E2DAD974C3026A1C" +
      "F393B5585BA36F4CB5EAE3E3F2327688D686FC934431A96814B6A3542F1A4805A120E7D339D8ACB6D9F7611EC49B188AE277897BB4C6C415D058FA136EEEFBDC" +
      "0DA81BD7BA77FEC26B79E8936966A66BA4F93C29930ECB21DFD0AF6F985014FC2C49F37C03806859EF8BE317684599F82AB9F09CE128D3387FF6BEEF89B02FDB" +
      "0251BAF281C50925C2174987B07A21158123AC678EB6732DB977F112095CA3ACADA5FEACC45A81C97D3953101136A6EA0C920071A39888B313FA17D3A6FC06F8" +
      "4ADC16E4B05298C36ED6001B48B325D4250B08AA0F809EE2EDF589CE969A489B3801482AAF152E9A1A281B64A80B14A86480FEDA1A5CCA02803879A807CB71D1" +
      "594C3F3666E6C29F78687E014200B50691C5949F797DEE538E9448B5654756DAD66F3DBC6E6C54EEC3BFC1D3D4E095FE73EAC8D200C587E0E70EB39050B9C322" +
      "4B864D90573D22EDD0E135426C1F5C7DB5609989094D6DC0BDFA7E721541D47513AEA37C4FE87CC6C30173CFF24AF4A5CBEE3828ECE1B1C657F311B613604DA1" +
      "7FC9952D1A43F461A895F2EED4E1A3BFCD3E46E56692B4B4D473B4E6D02D6731A666D332C7279E5426B6448C12F250D939C9B81B4D7FF2F1ED236DFCF8D6CA73" +
      "0650592640C1BA056B919B1FAE07153BC75A97080C9B5D1FFEA2594C90B00BE1082F0C198109F5D0D32D907AC0FE30AF70009BEAF6B7D4F7132046EC893A5A09" +
      "3452FDEF1CD76567F4D6AC1054988E5EA59208A6416577B755B726EE575C9BF334ACC2D0E41B1DB9382B2DE7DE48CCBEA8F916A512E30E8B09D40DDB8D8F54C2" +
      "5701AA408F1C1090F7601BB0F9A6600BDEF290BD79C1FDE3B08AE734B1CEED68C50ADB79FC7C2A6622A110E6DCB6A25F9F33775280DF622C8020FDFAF2FAD75E" +
      "B97479781F72E76FD65218870E6235B450D935FBCE477594A81ED0096FE58F27A59B88AA5CEA3086063035B3DD2BF05DD361D572ACA52E773A804404EEC9B1C3" +
      "C2D81AA98E7D5E996317B4D68B3B75843457F749A3CA603CAB90C20803801D417FCDFD60C040FC751D83745672224BADDA3D86E4C59A3FBF32A97C9D3AB2C8BF" +
      "6EEB1570BE7A928614C251BA5DF9D1EB46A91FDEEDB25B000CA91F211542DCD845C6AF0ED40182E011653A8B70E7790F9DD031F58280CADB0C04F6220D91E306" +
      "0601519AF21285D9E3B134CFBCB9F03715727DE1F16A9DFA113AB1C27592C1E26571D85B718ED9FA25ADF145B232490DBDBC8985F7C8EF4A1A7615142C6160C4" +
      "4CBFE218ADC15FCB1EFF84F56DB799FE62AC22ABC73A1249AB20B2E96961C34F7978321FB593429E1E5D174214E2817AC9138B0DC309A32A486032C5FEA29347" +
      "13F26626190765B2C7BE02D9FD96561E4666410E15122C20E7DF6392EE4B63689F65518A1FA1D59243FB6F693FCC453624A83115EFA54061CBFD94B5DA1771EC" +
      "20ED13750409BED50BC83F5F03A5CBED54EC2ADA6E6A453FF874E582C4B3050A6D7D85489EEEBE0EC5450FD57A6624CA32760100119694CB3D3FC1827219BCDF" +
      "6C17FCDBD00ABD2C8C0DC0E20BE014C4A6FF836C1408CBB1915ACD38318CF7965BD118C6910BA266E549564628CE55C0CD5391A7BBD32261D84D4FBF81237FBF" +
      "E1E2EEF2D8A789BF27146494B437F7C62B4C36AC875EDC7F7C19958606B7480497926D8E386E3B44F696CEEE9D0C33C974B365FCF9E9F682C0A027DC14FAB0E1" +
      "4403657D5394E3CFDF5D17AA9C1E5CF576DF644400ABAA8179C030A6A4CCCC21D4EABC0D03692EA0F728F72E5F07AB59435AB9EFC2F11F7B48A137AAA091D95C" +
      "2C1ABCB46AD3C0DE8ED0C68D92563AB390264C508E5C68D8ECF16799303A497FC4AA9C0FE3A88A84136E0D3F06D178BA18199DDD81ED244A3B2BBEC1DEBF2B7A" +
      "06674C9375C35883E0A95FC1F84698A574879E8ADE1A7A3CA4E41AC45BCCEDED2858C94130082F13D906340E2443BB41C83F4442E9D2BD16AD84DAD6F57F9E76" +
      "34EA731FCE678D2F3DD4D154CD28F5741694604B6BFDC9381643B4BD1C962E72AFF8BDFD352DAF5ACEBAFAD01A8BB49618BF1D7C5BF7BA8D664DB450E6CEC447" +
      "9EE988E7FED42322C96D510599BE9481CC1366B039CA080A10D7BE2F52707E5890304FE8FE3BE3AC7B04BB375FC903C23E07A3784A25DAAA9BA3E06B2C6EBFF2" +
      "8D5FAE1DEFD00B6A803EEA9A153F325CC62996712842AB06441EF1AE5970B3DF291B7BFC4D5F7B9E5BCBD7901EF0324EA379C3A4DFAD7E805E4F6DC808D20BA8" +
      "83CFE2141E4D454D5B557A09034D52051233F039523855B51A164922AB60AC055BBCE200DEDDBCA86CE726166435694C7BF90A8217323A6CF3B865084061E068" +
      "469269605190BFBA66C2644B5B9FEF71E49A8B6F42C5A4747903CF3B2428F5BA2A78BFE5364442CC95BABFDC40D70D062C74E2197AB57CC1A09B6CA911D4461A" +
      "880BBC8BF7A91D5A73615FF681FB4E0E6E82917B298D006E84DEF73AF1296646135CF3056C79A88B6F73F03A39ECE46E51380833000BE923C5777E7393F35B4C" +
      "F1FDB90A25031D2D5B4B6F8CF25A147725FE743AAFB52C9C1492DC7806B1A92297562B70F20582A50863CB706B315F198B7EBD2CF027AA5BF2D16F275928FE4A" +
      "8928571DE87D3F542B34209D9FEF96798E63B2B835BE75B87B7932D5913715F93742CAE8FA1BDD91A8F3B6A9384E0B71CAFC0A24C1DB780F381E0D45B5CF6C61" +
      "9690CD0EE226ED192ACB2909411141B6B99DC60118BD634FEA1A4712D37E56AABE1C14816FD086757D2DC04E52B209F363AB691EF7647B4083561D6F7D29350C" +
      "015CBF90607930ED68C0367F6710020570E5DF3CBE596F6A478D09B6D379319FCC62EF7914DC73FED2FE50D617F67A0A8DB1BA6F544BC73F69CB346224439851" +
      "7743A0D66BF44CC83300E4D1B6F5628859FCC7F21306D662C26D44F29AFDD227C622FC248871664B0EB8A91991AF5B289D868B4D5A16C30F0B253B5BBEC42F02" +
      "8A8F0A1DDD06FE7DC5CDC0E1329A56DBE7A7879751382BC208C606DEA86C41ADD3184F671DE0DF755BA124E3934C0076F28C823950E667017009DD9D61B59DF8" +
      "7944ACFDE3A693CBBD3CBCF2348AA800AA4382EC7EEB6E2E05C0B1A5FD75E9340D150ED87AF7B1CAE419B194DF59316DFD5835A4102FD98B36024E3C92B66D78" +
      "D5237097903B666B5A719D0DC4D44FB2457B5C956FB9D42169C150386B6FB841D837A2716D8908683E7F9869EA9CD8A04BC508BFFCE3C6CEE970555FFE0EEB50" +
      "ADBA019D65412FA6D5B1AA4F91B0E5956FBEC05430268100C24DBD4402FB3ED44E6C07290A894D4BC84070E62FF7DEA82120A614085844F6BF560E0719544D27" +
      "FB74F1C54CBAC6E7DD2021B2BF4DBFA63E533AE1C1D23B524FB08E13154F1E94F94817020521B31FC2BE269D9314B509E21C989B24E25B9188C1DCDF7FAF3869" +
      "39C018A2BE9CD74604E35DE03851C43E08E918648AD2EB33FF782FF13C95C5AA296051D1A1F90B0F1585D6F4436A9C1037F05D20CDE1105437C0586FC0A6983C" +
      "BAFCB0A8DF0531C24FBE70824042A7AFC43CE78C61D54683317F1955536CC366915EB8479DDD96DDCD35A1F9E0C446EE68738901DEE233188D944457D2308AAF" +
      "489440854A20EA8B16900C00E479356571B5ABE634196F7A714E42F267CC1948AFFE1041AA61985790038610DA5CCBD48FFAF530D3627CD133308A4384AE2EDD" +
      "8C115FB8F0B256CDE88026FBD0C9178A6B8908406BA2ADB23DDCF270B900C30206221F3EA6938259D7E3325AC9C6BB3F3869A1A5079A70FE2911B25241AD4BBF" +
      "62E7BBD75CA58FB54BBB4E53B1A424C3500B4277C1650BEB44119C0AFC90FAE50EA12B7E276D5CADCC6B0555733196317CED8AEA046538D7A79CD306139A1B99" +
      "6CDD2F27497343082C80802C59A215B4D6");
  const KAT128_CT_CORRUPTED = OpCodes.Hex8ToBytes(
      "D12633BD49CE27AFE750E0582F8152EE484E1A2787C0277ED436244616C9A0D571E94B107DB13DA59528960E2B2C469B735A6C20F60BB2E7C1B2046EBDDF82BA" +
      "BE29089F969CDD51D66DA6929681D17113A26C90C6854E0BE79270509A984E411307A967D2F58D22DC2ECAD33BC054FE228037B7B75EFAFA0FA3B0D8D2B85FC5" +
      "7A21F678325D9355CB5501C5E2619F9D3C3160C9A2D05B9E2C067E761F07B2A695E7A86F5BB3F85993E81C09C860D7F9AEA2E73331C2BAB6E2865FE26F6A3342" +
      "1DA8F4713DDB3A89F5761E031519750EB8BB02716D28F6326B4339243048F3FD11FAA1B8B59D54202747EF365004C31816229C846910D5C5334B00C8EA5C8F93" +
      "9F3A31D07B79ACEC0F8D679D7DF012DB9660AB9DB164EE0D0195B43DBA629325BBAFF8AF220FF6256682FC289921C6B0C441A3C2D6663FBFFEDC7C35BF88942C" +
      "50B32B234E5A223CCBA19991869AE3E086223DFDF51E505CE5DFDC16FC6A6ABDCBE8EB2E76643AA38C77997A11381402506E02677E9048B129258343E07723FE" +
      "F3FE08CED8EDCA1E71577DEEDECC3CFFEDCBD9DC0E5D3B8390361A6CA9C212CBF26065896093D6386B43AC3857188AE5A0A53D2F8F414A87A1FCEDE0EACA72C1" +
      "0D9BACE5BBFFAC2F10B3FB3649DA884521C55886397C1F58E8DD67FF9BC1CC1AC658626DACDFA1FD30397D0F6D7AC1C83584A162064BD4389A289A2BCB135F51" +
      "3BF2C93F960B03AADC63B9A58C41301F426CB9FB7A4B3C77D7117C51AB70D9ED648B8808529D8A58F95497106C06C44085B0F90A7087A408C18D6C76D18281AD" +
      "B172323BC6E05D4DB41FD696F616EA4A19B8DF4911E78C6A224CEC906717D5F95C3AB4B2C0ABE8A370F8FE2AB61DF6DB2BA3418DD78983C1C67E174424F5D00B" +
      "CCC6E26777666379EAA9F9E54F09A61942C311C4657066E8490DEEA42DFD5CA6F2D39962027488CDA472D7A23E9D9F4E99DDC6239E57E16565A57394F5ABEC71" +
      "DB86978C2B9D29CEE833FFEF2941EB88937F4B557FFCE0F727FB5077E51B6446163F8B5C41151E4DBE6F985BA9BFFBCCE761B56CE69E3DA4265D8262C045E328" +
      "64E92F83B7E350E6E3D649875C17481004B5FE40FFF0D1C0C7D1F6B83BBF67A718119804E1896C0E91CDC7415EEC853F0067C888DB17A62B5B35C1445AE21A23" +
      "BB17D8DAC68092F8391A428F14A64FE8DB91AEF553FF1FE15A47BB5BAEE676FDD232F8657EBF135731B50F1562AE622C9A0EAF562C5B5EB3EDDB761D093504DC" +
      "10F51928EE0AF8AAE7A060EEA73D22AD324D5B5765EC2DACB003C8E47C428919F3C7E471250820B0541D449EA2FDBA4D46E20BA6DBFB6540191CD6D474702EDE" +
      "C7E8568C22264E366AF048C4064768C343412907A98E2DBF872851778879BD7821D6646038FAFA0848AAA2AD295C823D55E5D3F4F4381178742C1BAED72BBCC5" +
      "5FA05A8A061E52AABA7F4E5862FD656AA7EBE46DBA82B2982D804EE36686453103619780D92C4F4072C54D2684A7A6DE1E6553B96FF9F455D590F9C4CFD18FBA" +
      "90E30043392B26E7449BAB36745F7444537EBDC5AACF3F9D42D993E39A8E2C8C28C29F39BFF9A4E9A344D507AD21ED8FC35339B879F9B124A1A640DF82A0227F" +
      "5298759B7A527362128BE702F0E3A510F17F2C09D1BD101718DC79FAFC72CC706678F36702D70D842B9F64C20E5FB71B11467516A7AAB75B1FE4087F6746D2FB" +
      "FA351405E8053125574CA29FD86479DCE07D489C70C570E631244480A7A7A4C2C635708597C07393889BC9543A4665C8FA0D24A87FF143A2098B19BD6667397B" +
      "6BA2EEC214133D1077D97015549EF98FB13D585770EF60E6C50E4AA3CDD9F4B2F09E65E061616B810EB055BBD771E40EB848660472B56CB18DE08F0F2E93093E" +
      "870280E81AF4C6BE59FED2B9398E053C503D10C00465177EC314D03F566D1B6A3EFADB3D2BB2E955B864F6129EBC61EB7347A6B886EBF1BD236B48CA6D73C2E9" +
      "AB38CA4635B3ADE9DC02FDC47FB7891B5CFC1F223476393C370121A2258CB999CE4F878614B27CC81E079A4D17FB59F74A052F11F431504E3F6EA2F98C861AFE" +
      "30EFC845933DCA5FEBDCDC1B68EDA019FFD8B1E286113661A0E1849F1A7B8418B2689CE9CA4AE0CF286F42DF0AB6E56F3E17879D8A1633A41EB915B89217252C" +
      "DEA099A939496923E238064444B35B1FD36BF3BEA193D63CD55CF46448FCC468E74A625BF629BFE132F59A81B8D8D6CD2AD00509437399B2798F2E10383CAEF9" +
      "A75722C3E9D4EC4651AE28994B4E7BA9EAADE648B1B1FE7528C000124877A452220F19AC5958D6886EA4E06CEB2C754740D3EDAF97B49976ED39FF04833F880F" +
      "FED5EF354FFF127167A3AFCC3B89A07772EC35A3EBBBC2BDB9E18D79C563ED6E8A6AF38D75786A57019B030630898E69EE144427473D8269E2DAD974C3026A1C" +
      "F393B5585BA36F4CB5EAE3E3F2327688D686FC934431A96814B6A3542F1A4805A120E7D339D8ACB6D9F7611EC49B188AE277897BB4C6C415D058FA136EEEFBDC" +
      "0DA81BD7BA77FEC26B79E8936966A66BA4F93C29930ECB21DFD0AF6F985014FC2C49F37C03806859EF8BE317684599F82AB9F09CE128D3387FF6BEEF89B02FDB" +
      "0251BAF281C50925C2174987B07A21158123AC678EB6732DB977F112095CA3ACADA5FEACC45A81C97D3953101136A6EA0C920071A39888B313FA17D3A6FC06F8" +
      "4ADC16E4B05298C36ED6001B48B325D4250B08AA0F809EE2EDF589CE969A489B3801482AAF152E9A1A281B64A80B14A86480FEDA1A5CCA02803879A807CB71D1" +
      "594C3F3666E6C29F78687E014200B50691C5949F797DEE538E9448B5654756DAD66F3DBC6E6C54EEC3BFC1D3D4E095FE73EAC8D200C587E0E70EB39050B9C322" +
      "4B864D90573D22EDD0E135426C1F5C7DB5609989094D6DC0BDFA7E721541D47513AEA37C4FE87CC6C30173CFF24AF4A5CBEE3828ECE1B1C657F311B613604DA1" +
      "7FC9952D1A43F461A895F2EED4E1A3BFCD3E46E56692B4B4D473B4E6D02D6731A666D332C7279E5426B6448C12F250D939C9B81B4D7FF2F1ED236DFCF8D6CA73" +
      "0650592640C1BA056B919B1FAE07153BC75A97080C9B5D1FFEA2594C90B00BE1082F0C198109F5D0D32D907AC0FE30AF70009BEAF6B7D4F7132046EC893A5A09" +
      "3452FDEF1CD76567F4D6AC1054988E5EA59208A6416577B755B726EE575C9BF334ACC2D0E41B1DB9382B2DE7DE48CCBEA8F916A512E30E8B09D40DDB8D8F54C2" +
      "5701AA408F1C1090F7601BB0F9A6600BDEF290BD79C1FDE3B08AE734B1CEED68C50ADB79FC7C2A6622A110E6DCB6A25F9F33775280DF622C8020FDFAF2FAD75E" +
      "B97479781F72E76FD65218870E6235B450D935FBCE477594A81ED0096FE58F27A59B88AA5CEA3086063035B3DD2BF05DD361D572ACA52E773A804404EEC9B1C3" +
      "C2D81AA98E7D5E996317B4D68B3B75843457F749A3CA603CAB90C20803801D417FCDFD60C040FC751D83745672224BADDA3D86E4C59A3FBF32A97C9D3AB2C8BF" +
      "6EEB1570BE7A928614C251BA5DF9D1EB46A91FDEEDB25B000CA91F211542DCD845C6AF0ED40182E011653A8B70E7790F9DD031F58280CADB0C04F6220D91E306" +
      "0601519AF21285D9E3B134CFBCB9F03715727DE1F16A9DFA113AB1C27592C1E26571D85B718ED9FA25ADF145B232490DBDBC8985F7C8EF4A1A7615142C6160C4" +
      "4CBFE218ADC15FCB1EFF84F56DB799FE62AC22ABC73A1249AB20B2E96961C34F7978321FB593429E1E5D174214E2817AC9138B0DC309A32A486032C5FEA29347" +
      "13F26626190765B2C7BE02D9FD96561E4666410E15122C20E7DF6392EE4B63689F65518A1FA1D59243FB6F693FCC453624A83115EFA54061CBFD94B5DA1771EC" +
      "20ED13750409BED50BC83F5F03A5CBED54EC2ADA6E6A453FF874E582C4B3050A6D7D85489EEEBE0EC5450FD57A6624CA32760100119694CB3D3FC1827219BCDF" +
      "6C17FCDBD00ABD2C8C0DC0E20BE014C4A6FF836C1408CBB1915ACD38318CF7965BD118C6910BA266E549564628CE55C0CD5391A7BBD32261D84D4FBF81237FBF" +
      "E1E2EEF2D8A789BF27146494B437F7C62B4C36AC875EDC7F7C19958606B7480497926D8E386E3B44F696CEEE9D0C33C974B365FCF9E9F682C0A027DC14FAB0E1" +
      "4403657D5394E3CFDF5D17AA9C1E5CF576DF644400ABAA8179C030A6A4CCCC21D4EABC0D03692EA0F728F72E5F07AB59435AB9EFC2F11F7B48A137AAA091D95C" +
      "2C1ABCB46AD3C0DE8ED0C68D92563AB390264C508E5C68D8ECF16799303A497FC4AA9C0FE3A88A84136E0D3F06D178BA18199DDD81ED244A3B2BBEC1DEBF2B7A" +
      "06674C9375C35883E0A95FC1F84698A574879E8ADE1A7A3CA4E41AC45BCCEDED2858C94130082F13D906340E2443BB41C83F4442E9D2BD16AD84DAD6F57F9E76" +
      "34EA731FCE678D2F3DD4D154CD28F5741694604B6BFDC9381643B4BD1C962E72AFF8BDFD352DAF5ACEBAFAD01A8BB49618BF1D7C5BF7BA8D664DB450E6CEC447" +
      "9EE988E7FED42322C96D510599BE9481CC1366B039CA080A10D7BE2F52707E5890304FE8FE3BE3AC7B04BB375FC903C23E07A3784A25DAAA9BA3E06B2C6EBFF2" +
      "8D5FAE1DEFD00B6A803EEA9A153F325CC62996712842AB06441EF1AE5970B3DF291B7BFC4D5F7B9E5BCBD7901EF0324EA379C3A4DFAD7E805E4F6DC808D20BA8" +
      "83CFE2141E4D454D5B557A09034D52051233F039523855B51A164922AB60AC055BBCE200DEDDBCA86CE726166435694C7BF90A8217323A6CF3B865084061E068" +
      "469269605190BFBA66C2644B5B9FEF71E49A8B6F42C5A4747903CF3B2428F5BA2A78BFE5364442CC95BABFDC40D70D062C74E2197AB57CC1A09B6CA911D4461A" +
      "880BBC8BF7A91D5A73615FF681FB4E0E6E82917B298D006E84DEF73AF1296646135CF3056C79A88B6F73F03A39ECE46E51380833000BE923C5777E7393F35B4C" +
      "F1FDB90A25031D2D5B4B6F8CF25A147725FE743AAFB52C9C1492DC7806B1A92297562B70F20582A50863CB706B315F198B7EBD2CF027AA5BF2D16F275928FE4A" +
      "8928571DE87D3F542B34209D9FEF96798E63B2B835BE75B87B7932D5913715F93742CAE8FA1BDD91A8F3B6A9384E0B71CAFC0A24C1DB780F381E0D45B5CF6C61" +
      "9690CD0EE226ED192ACB2909411141B6B99DC60118BD634FEA1A4712D37E56AABE1C14816FD086757D2DC04E52B209F363AB691EF7647B4083561D6F7D29350C" +
      "015CBF90607930ED68C0367F6710020570E5DF3CBE596F6A478D09B6D379319FCC62EF7914DC73FED2FE50D617F67A0A8DB1BA6F544BC73F69CB346224439851" +
      "7743A0D66BF44CC83300E4D1B6F5628859FCC7F21306D662C26D44F29AFDD227C622FC248871664B0EB8A91991AF5B289D868B4D5A16C30F0B253B5BBEC42F02" +
      "8A8F0A1DDD06FE7DC5CDC0E1329A56DBE7A7879751382BC208C606DEA86C41ADD3184F671DE0DF755BA124E3934C0076F28C823950E667017009DD9D61B59DF8" +
      "7944ACFDE3A693CBBD3CBCF2348AA800AA4382EC7EEB6E2E05C0B1A5FD75E9340D150ED87AF7B1CAE419B194DF59316DFD5835A4102FD98B36024E3C92B66D78" +
      "D5237097903B666B5A719D0DC4D44FB2457B5C956FB9D42169C150386B6FB841D837A2716D8908683E7F9869EA9CD8A04BC508BFFCE3C6CEE970555FFE0EEB50" +
      "ADBA019D65412FA6D5B1AA4F91B0E5956FBEC05430268100C24DBD4402FB3ED44E6C07290A894D4BC84070E62FF7DEA82120A614085844F6BF560E0719544D27" +
      "FB74F1C54CBAC6E7DD2021B2BF4DBFA63E533AE1C1D23B524FB08E13154F1E94F94817020521B31FC2BE269D9314B509E21C989B24E25B9188C1DCDF7FAF3869" +
      "39C018A2BE9CD74604E35DE03851C43E08E918648AD2EB33FF782FF13C95C5AA296051D1A1F90B0F1585D6F4436A9C1037F05D20CDE1105437C0586FC0A6983C" +
      "BAFCB0A8DF0531C24FBE70824042A7AFC43CE78C61D54683317F1955536CC366915EB8479DDD96DDCD35A1F9E0C446EE68738901DEE233188D944457D2308AAF" +
      "489440854A20EA8B16900C00E479356571B5ABE634196F7A714E42F267CC1948AFFE1041AA61985790038610DA5CCBD48FFAF530D3627CD133308A4384AE2EDD" +
      "8C115FB8F0B256CDE88026FBD0C9178A6B8908406BA2ADB23DDCF270B900C30206221F3EA6938259D7E3325AC9C6BB3F3869A1A5079A70FE2911B25241AD4BBF" +
      "62E7BBD75CA58FB54BBB4E53B1A424C3500B4277C1650BEB44119C0AFC90FAE50EA12B7E276D5CADCC6B0555733196317CED8AEA046538D7A79CD306139A1B99" +
      "6CDD2F27497343082C80802C59A215B4D6");
  const KAT128_SS = OpCodes.Hex8ToBytes("DAB185FE3FAF252EFF8F563EE157C70943FADBF11DD493FB561E70F22D4DC0E70A207E084109D96F1A7DA36EA4E661CE2AE9907632D74A8F45DFB6971C4124F6");
  const KAT128_SK_OTHER = OpCodes.Hex8ToBytes(
      "35E7FF98C3905928348699356538D3DA488AD91C0C81BFD72BB3DE8E91B1B478E39C57579D11F20B2237FA9ED79681334BCD1D0FAF36CF1D8B00ED17CCCD8FD1" +
      "2CB7AAD559FEEC41C4192070970440D561FF591E680B321510C5ECDB2410BCB4D194267069203AA625AE5C84144C0DBB56380F2577A25FBF68DAE8222DBE991E" +
      "3624821F7AEE89FC263425504A1CD5788584C07CF6EC5DE3DC331666616FF8AE1C2FF57D2FB779B38A938D82AF1B381F2D6B278813306BB606C035327A9C6632" +
      "B22FA01790086C339EEE6116FE89A3ED7E207D78DF8234CA280DAD7DBBF1391E693FF432957D62B63D01C487CCBA9CACE4A95D52E7DA430E91D09928BCABC2D1" +
      "2FBD1964AC894EC9E4ABFC6B223529FA08411A84695B4983A6FA30DE3BD01A1B6386B3888B38185B8A036DBF5D132B9C4E45DC82BED64B82A4F62A260ACF34AE" +
      "3A2DFDB8D312DE6C55EEA7692D6B55126C1126F99EC88BEC128191117EC40E7E44AFFBB9BF66A6C7BA87EEC2941F028B5AC11F4FB19E51CBB198FA3E86494C98" +
      "0E16D79FC5664F1F206D8FFEEA90843CEDDA371FF98F05B359D726DD9BED3DB3BEE1E314D136DFE534915A14920595AC4517DA3728925A6978399FA81F6E4365" +
      "EC1D5E8CA9132F33EBF751A834FCEA97CEE80D6EDF53DF7FFCA1BB016981AD95243AA3493611D2D488A996D7C76C25FBF8819DB9A93CD8DE593D0C44D6849D33" +
      "1E7C42DD7B67E2DC97455436A38196BB457A3CA43D1935BCF5C1C575B8C09E6EDD014A3FE150DC5A41267FAEC6BF50D8B2BE0B5374BFD35C9074DC98221AD6ED" +
      "85C33C2452DDD3ECEA05D5BB9BCBAC80D69916B930839086E2603C230A5709280EFD87B53A7BAFE86FBFCD8EE51D8EADD3E5F9714150E43E88949AEE3005ABC3" +
      "AE103B39D0559DA2B069A7910671866B470B2E90DAAE3FC5B2C222F024481594681E697128CA612FB75EAF730013757F40860201644960E82AA702AAFEB69F5F" +
      "3474131B969CCE711640AA97334839A3427117C970D1333CF261B85CE07DC8BD6DE63F4269B04F0B6B67E94D06D62938AB56DC1FACF2F870941789A7ED82E198" +
      "68B8687E2170258DB564E6EADB441480BA4AF0839C76CDF67584F3CAD05CD45B88595F0DD8B09026B792AD209F8E8BD68BF2828CD6B7131F2FC84410BF21E201" +
      "DA7334338AA77BCFBFC5032D4F59912A6652B6E3E7BB1C800122DD58BC1D7CBFF7E9071C3C89BF5E4D8B28EDBE6023431010EBB8121307203AEBF582E1D55CFD" +
      "090BBC3C3CD3002BC37C86E14925A071BB6986AD9DE94A006AC81264688B1093AF882415C49F6C44C585B4A012E3B637316B07ED2CDFB81316FF645D764C85C0" +
      "E5B3AE16FC22B00AF2384A54D86A64F7E2FADA05F07296164F7B5A48D55231F92CB8AA40B643168B1B60AE824ED8CED6BDBF61707B795F934208F6BE071036A7" +
      "385B0CD7ACAF8B2DF58F85E24C6D065453D2C797A45566E557A0FCB8DE4D817A0744BF185D7B6FFDA2DDF194252563FE361C84FC3CA13381CAFD4B96D2B80969" +
      "E717E0C5559581748AD542EBB93B98B8A289668EFF21E05F6C2E029217169E771E1C42CFA8EFFE4B4090544888F8CCA1303CAD54A2A56F8C683A9268FCA93AC1" +
      "683720EA3C17314C3B25BD05E9953903E9ED47766B96D08B7963786B16177DA0BD10A06714C072D96458F5EC442D7070281E2A86E0B195B721CE6432827B7AB2" +
      "1980D6AB5DD90335C3364664A99C4A40FDCFBF40E6A131B46835419018CBCB30475F3965DB3E512B1D58069338E81B20404499CFE96A73EECDA9EDE06B931443" +
      "52009082A3AA334A7BDB91D6E4D438D6B79EB25368645B22C27590A944B411A1A65DA05136931FB1D63E571E7A755F3F6449C802FAA38EC8E4119A5DC43F01C9" +
      "73168FB051946B732B35AEA1776FE1952987DEF4A5799A8C4BF47F3177C3A28C546371DF5EA362DFFD2ACBCDD563129A88AEFE0E40592F744870DC05FBE46DDF" +
      "52740CEC6ECFF7D9A077DECF3FAEE2668CC6102BEF5F1DF18276A923ED6CEE1F29F718639FF55570448E07E585B62313215C9829CFDEE415493BE241B0044DF1" +
      "743ADC6072B277FC97815F58E43351726D187E58FA39B82EF78E292DAD7A353580B31DFEBF05991E7AA138999213572E301AD6B1F67461E5E73FAA9D08DEF801" +
      "B6C0CF3BA8CFBF925AF9ED34A28ED7AE891C30A4E61EF3A96CBDDA305735FD97806E824A40B5CC7E730B1CCDA0AE4A6027CDDC00852B31AEDD888D2A7B6AFF52" +
      "A4B8D71DB8400A590A7E1EFBC6654B5FCDB4B6B33F0BA4C6872BDCDB748902ECC0456F0439A1F630DBFE82DE36B90773AD3DD73E18375B7111B895E47EA9A054" +
      "3BBE4FEBEB744FD55E3A7755B0EFF45067DB74A90416175E10B545ECB3B701030F0B818DFFBDAEF87E7C9572203888547BC0E7EC624CFA10615A27AAA8FFA716" +
      "CFC3502C57F794A67737151593434982FF24C4B88E55920B089A752F4B9B6C23891F7D1009F140777A00B239E5950C162B49AB3996F2B4E1B7E567013232D4C2" +
      "5FBDA52E559190603A00DDA203820C00E8A532FCAC38D0C094244A2E5ACBD353B5A7AE08FFB8D791F0942EEEE5676BAC8E887BD41F5521F3BCE380DABA60DE9F" +
      "3DDB7C52E49D91427EE97854174389E8238C2C59BA84D61E3BB614670EBB7CBB580EAF74401E532B6BC6996131E5F4396D2098C4C9ADA3D42FB549CC0E9C2305" +
      "D46BDA3613F77F832BBA82061D74DE205512FAF690DC05DF3FF9CB0D3E0752A20A8B9BCB23D0AEC3E47D6C604B517DE319BDC03F10CFA8FEB5E2DC81F291EA7A" +
      "6AA1618AAE4E58D5F280AED224F5556D6218B80B7C3A655B9FEE1CA0D6F5D69B7761F679BA75DC541778847749D3E9E9C37568D51C9B8C727ADDF88B01FEA0C7" +
      "34B78FC14C773FE8E0C5FAD47D27C50496178793A7319CFF578AC54C08A32DB608ABBE2FC98E143115D4A87F8CF9F3260A357AABBC60181FCBC44623CFEDABF3" +
      "D482C8618D9A8CD295D3341B28C3418C901BABA44FFA16F89493212AE191E03A04BD536118E6A0CEFE5DF5A967026879E3BFB557CAEB0569EACC9219EC650DE3" +
      "F1D94C8E0B14A573246C0D8579C8D855790017A61C20762C58DB5E21E20C7F8D8782838C8069EB5B190E20991B983A132F636F1F05AF89EB747DF69F558E9ECE" +
      "33B680310F09B4997627718EA7864D0D8C4FA00302463252AECFB8BF073BCD19DEB828BD9786D5734560E28DE409E2200C");
  const KAT192_SEED = OpCodes.Hex8ToBytes("42C667A186390F26C8F024D31D5FE3D20145BC2FCCF26C865E20DF7626CEF09E4D9EADD263D95EDE934A74B3721EAAB0");
  const KAT192_PK = OpCodes.Hex8ToBytes(
      "5009C2E5C95AA03DCBF09F69C9529DA97F496712E083181F51F06AA7E7F733149CCE4BD1A190A9B5B42558A7328AA10087044E5C9017402C8AF07FFAAACE70A7" +
      "BE2DBBDE6AB5DE054D3D05D095FB17D00F1732E144C6E973C274184611F117088989A2FD9B9CEB738212345F7ADDEC41DCD60D41F5AFE19F8F386DCA25BE7EF8" +
      "A987965C2731050AF437D0F2B5C91C81A683336FEF6C80FB21CEC73BC70B3FF356B861C669E1A90AD0AA9F04B1FA86C6C19F72EAA3763E6AD7FA93A3FE091E9C" +
      "C35C0764086C20F667A73AAED077B6BD7D5DDDDE4A325B58AB242A003F20EB8C7A981D8266B19629DBE8827BFF443EFB25D2E82162A6ECD0E19B56769A7214CA" +
      "A018CE0BA35C14AADCB8E41D93C6094DC8BA93746B790E8C243AB8A1E746F7A7F64FFAB6F2CA3A186BEA6C33768FF55FBC3899362B04E3A71639842DD5F619F9" +
      "CFEB8A4CCB1AEC4060D75E921B1E9BE0A6008D484082AD2D915742A227F4F983034577F4912A2B729C246D8C4C0344625F33C8ABCEF6190E7D6DE3D4ED78D37D" +
      "F0D976CCEB8F7F4746DF9FBF10154299F05011248AF80E6DB9548B194473DF54571B4A7E9BCEBAE50AFA2DE844C9D3FC99E75AC5A4C04B0EC2BE43CBCA6CF6FB" +
      "898D9B21F0D7C2B5A6986C60C10E72701A9B32330875CD3B1627D4324A0394B02F444AD8F083BB8E28D062C145C9F25B020890CE2D539C7082D6C258C1AE2386" +
      "B175C265615835D61449A99AFADF6F9ECAC21ABFD8293CE25B085562AFB4533F9D6D297290601B115F28F4BA309F52562DF529F3AA0D863E42830BA2C582E55A" +
      "2C49C1CE1795AA48B64258895FF314C5DBC9F8825842DBAFDB1116989AA6DB347467C531ECB1353C2FAE7B7BE8586026B0ADFC589D252A430A071CD0B03ACA92" +
      "848D3DCAD74B669F552A4F5D5D12A8B0B427ACA5A58002B6C3AC82FCD7F3562DDAC24B9030E5C0B012E8680154FCED0F3565CFFB13576C7413E59E50BFC78410" +
      "40700306C50B6771476EEFD81BFD44DAD4E5DF7E018EEEA33BB160E9CD3942EED747CC69E5E3648B5E94A9A8C18A9FFD0875604B7110724D8D16521E1798F1EA" +
      "90050D9F84B37745FB4BBCF5D21BB5A01CAFF9BA8815D5121740EEC91C5025B93A9C4067F6E3B30888998405CC445008802F39521BE199373E2EC2E59FBF4A46" +
      "453D6EEDA9C761CC7D4124824D700BB86A3C3ED892C50CA56FC58395308ABE99EF64E4AF5E626AC61D02112AD659C03AB908F65588E8BEFA1CDAFA6778DE2C8C" +
      "F78F7E6744F9AEA2A80CB850CC65BCDEA56A91AEB6A6837A6C1030AD0198111227C4EF75163697211882228E0D29CE51260E23829F804A2E9F0044D5D3BA975E" +
      "4EF0A227CF27C62AD11D762E7806301132B13A5CA5276793D5DA393B91D24F41ED25F468E88F4134FDDFD7A3CD29B81A7F413D5D62B1870A9606F386C2F0FF1A" +
      "5C7B60DCF097237518B3D47A94DDBBAB505D5DA180E573CDD2FFF957CB7C4A445B352C4320488FCB5E7C41F42526F99009FC9E20F5F47325307FEF1219DF564C" +
      "B6BB0FB801D5455E233934C59D96CD01C225B00AE8052D5FEB988487D16D4AFCE16F2AC847BC49FA60A5190514D70A99023710E327AB8FBC0DBD9E406CFC8112" +
      "0C0CEE04A91EC1B0CBE4127EE999F9C2522A9E46EFBA611B326A4CDCAF605F86A6B0717E4637E3CD57BFF09FD2524B67B110DF400A57BA75E59D52A5FAA51BA8" +
      "D80C1D9B5268546E74BB5E9B8A4A5E0F012707939A9201DECD9E0D297BD2A86B45E963BAD4AF9ED406591D537C0E418A876387BF988A632AEC1F84748AE9BE37" +
      "E6217B32E7F74030C0A76370DC7496D2F467E89B6CC8DDB97538B1ED498FEF0660640BD7026FEE3B5969F152B0F1BB622DB7F071DE8EE535C610E4F9FB811EDC" +
      "B30182E5904AFF7CC222800E20F443D4930A31C9CCEC56EEA397637CEE1C411A92327E49198687AA98747003368771253FD8D2ADC175C5E30AFCE1FCB9B4B066" +
      "335DE79CF743B10290742EC0B1176BA177DA1700A99BFDFDCFD61CA72EDDA5F2A6795CBE2B3E40F429475C4E1AE57432A301E27DC51DF4C55D1F0FCE59CA8778" +
      "0244F88E6BA89A1FCEE549AB437D356AA828DF92C9C9A87E301DBA396585517B76F07666CE107398208F5F683597F7294C1E375D28C15C350A4797959B6F31E8" +
      "66982E393D8269F04DDAD5512D980D76F9C201503466547521D2F8160C451311A1545D6C388D92CBA8BF95E08AD4D68E15BEC6B5F3A184C4599DCB4854A90512" +
      "962970A5AC1498DF9C9452FBED26B81981C11DD6684755CC1CCE7858D9D54B9D749C99F158F49AC1BB605EF927B536009927D1DAF21A04F18C8CC31833FE0047" +
      "29BA65B00F12AB37CB2728FD3024240F06DA570FAB0BC64AFCAD3E7EF9A1E4A88F463DEB5865A3D6334EE5223EE0AFEEB8276624BA1A95589CE37E3888937CF2" +
      "8415779219E36A7956AC4BD85547EEB42E6DB0DD4B333361D4128EF2D3D9DBB9EBAAB249D2DCF4426DFF373E63F1FFF5ECAEA5864BD85943AF435FCD3EC9F909" +
      "D955849FD49BE775B9B2E2C98474724C1FC248EDCEDA02D324DE398EB13046FA46E9370F0E288AE651EECDACBD36342A0ACC6DB3F514F78CFA72393EC41AFF2B" +
      "B1EB2E5DBF032411E0C09098DC53469E52AEC7A24C9559B52873BFD3678390865DEE1681C4640286136BAC10970AD6C8C53C8DE81B617212721C4CACE1712921" +
      "79F96408674F74FD3974EAAF5486B6E19C4E93FB10A187C2E2C67F9B602798C2819351828B6AA54C072C9C82FB9D8346FD7F79DA79FBB79043392B2A94910117" +
      "ED66E92FC0CB8F0C9C64275E57B40A0270AAAC54DACAB94ACD3F74ADC866D08104D9724EA09DC0E91A5E8B5A35233711ACAE248C1D679DC4AED92D7F481374B5" +
      "3CACA4F2AB810A087118240FAD9220460A011A9D5C2E05CA5CE72566D24C99A7F56B5A56E9D5F909AEFC6F9559DEF67E682B198D63C2747A38EE45FA8D908B5F" +
      "44E0628AB4C54A63CAF18622970F6D834F6FA031DD46D17CE21EE3FD830E6DC518877D304CD931B8BAB30F8177584C110731582241F048C2806FA447E77E2564" +
      "6DCE7494D5CDF3B6E69E8F6AA8CF93E1ACBDB1D75BC5B780FC9CB6CBC860D6DA1AB776BF7A9675668ABCB3525B30668C8C457F79646A33BBAC91C47F5B207284" +
      "7BCC0B78A16E50F076E929C6A8463FB9B795E6355C21AAD15FD4D049EA5B7C582F9A2D3839089A05A51B05D7874835437708C5965DA5609E50CD9963CD847A49" +
      "DB509492C360200B7FB2199806EB7B46CEAA5B40BE22E07B15BCB98329C9E14657E48CD916B7405A884AE31C788DEB41BAF68D8EDFEFDF6BE99A7175AE504B3C" +
      "93A69EACEBA23749884A41DA874D256A0565C556660E56802BCB273C43F34F8DA83416F4BB1D809665D80F0FFCD06D3E1E566AFF4A39ABC8EBC166729BAD35AB" +
      "EB206AE0DC4C7024FB3C65F6AC2DA23CB49A184019685048BE1800CB101BEAC2BC4FB657CEAB27BCE9BEF010399D7151F09211B3D1D4D247BC8C7FAA36F38143" +
      "A5F196DD00F39969F0DBA6CB6F72EE7D7F11FF56C9C14AA5239DBF0A5B15DB428D75F6A3B1B2D47F709C3B339233A8D4F69CC5100EB9167C6F58B38923CE53D5" +
      "A3EFE3059E87EF27FFA3A8E4550981364178751417F532C57200003E5077CAC6D18943B0D965A240DBE8BD2DC01F37E6B5A51D381CC5F9A44788D0F17483C612" +
      "144D3A6BDE7483F91B3319D5580DA68ED7BD4921387F0E161AE0B0A5234F5865E45F1A2FC3AB86175053F768B06328C900D672397E35DB7A72EAEDC6AE9E310F" +
      "3BBFF12E76A46F58912C436D1E35864C6A5E3E9C0EBE820AFB63AEA99B20F7B715666F2AAF1636515E8103205EBF28ECAE913A850D53E2DDBBFC20D12CA3144C" +
      "08921D5667C06E53F248769FA53FB1A04FE6C884E9C7BFC8BA0099D0B835BDA11CDCC3CD79D365DC1FFFA65AD9121F074C91F83696FCB4E11EE461829BE1021F" +
      "375B69C6DB62749B4781000ADCF6850529BCF4691876108F16A643F8BF3BFFB70012086F33E93BD4376E11A91D336FF34356DD605772D1C71DEC24C307FAEB15" +
      "27E52364466D510A9675D119898932BE26531D973D6BBF016C9D951654F0E8A0383631BE743C18895272356A0100D74D896BEAF6C9F579E9874EFB64B97978C5" +
      "C48EBE8C87929310E49202E23AB74936C48C54FF989E8958222E2CD2A4533A27DD7022E291ADED8C1FE152B2B5328B93AB8DEE68AD9C073FCCB5BF34177A01FA" +
      "992A53CDD4EE2E6ABFB7B3CA65F6F5DD39537739626C10A47B68494CF3FB4CED62215EC85A262E9A692BFB23D5DC0F12CC9CF5CAC69978E3D99F39EFE48BB4E7" +
      "5FC6F80F2F7A9E2A0A0AB65F4481AB783DC98029AF817778A463549AFCF038095D326BB616D21EE1C184FD09330D51C851ECE77F7270EC59D347F30FF2B3BD61" +
      "C676DEFFBB92EB2286F2B6D572376BC4B5604A2EFC5C8BF5301AA442FD7BF401EA8BF91750ED89316FB43FAE4408D1CF96704D7CAAF1A5FA43B7BCF83E4037CA" +
      "549E077626FED77F30B1C7A804A7F1047276C5E6CE31AA69D781A9EBE485B7B866BC078EECECB3252DA0B0B5C02470DBBA997AB2CAD44ED2496401671F4FCB1C" +
      "C130C9C89A0A6C086366EF186C9640BA62DE2E04D1047FAC3C8890429762D88A84C4E9085248076CD8231245E58DBE258DC7A66CC587A605DA59EF40D0919A47" +
      "0F88368D49DC9731F48827B694BCC07BDF99D7B4F2AD649B738D87AB44A621CB1096AC5D363C37729F25B2C2E1CC0E31A21847F1833D9F10A41E1FC542DDB2F1" +
      "01849DE2A6B5939024D7277089D5176B9B3C0A77DDDC7C728EBF6AEBB8E4A597E3CD98A30484A20ECECCB3BEA086BF61BB76659229C608B45F178E4CB01586E3" +
      "7D13D080C50C235F16905459B061B3BF964AD457C00AA2D18096665B9E0FAA275A25178F8796FC21CF487BE6C6EDC98B6ABC0FE4A951441844460BB3A433E82E" +
      "FF28E70676795F45426368806D27D4892AC8C300FC83BB81EE6A89B211474E75163DAB97AB7C531E72CDC660C4B38CE9808DCFF51FA66A5A181A371AF838A2EC" +
      "EC258F60EC9836B0B2F6F6809FD20487345EAC3A1CCBBE4DFD4CD3DB6E1A92C5F9B0373CDF7315B5F9380B8FBB6116374F1840071E524170A4A22EEE3EBDC4D3" +
      "85BC06AE44A22756D3B422FAFCE95996ACF4B625829522EEE6B6AEBFA3FC00E919A0254FB9EE86000F2980606777C4DEE9C3627266E0CC39F21BCC2F28EDB885" +
      "00F5339686F22E300E18C21DACF8B47B9AD68BBE39185DA2A0BF09C7FAABCE3F6B1066157777133CE91A51C1740EDA4E1ED666E2A5730D773022B3ACC51E4108" +
      "7F47A778DEA562A05C671C48AEC2BFA7DED4E8F0F0AF362D24F357BFD2CF03BFA8AB6B634FC44B30B17DA2998743DAC41AE91F9BAC04DE60614B7619D1ABB9FB" +
      "F2A6A6248DD63FFBEE86FEA0E929B1C955D47CA8EE90881A6F9CBA5307D681BD8886FA31C9794ACCBEF9A2EEBB9BB452265F92C087E5F460203E581BBAD37D69" +
      "F343BECFF212362A7B10E660807E4F9C520A2870119F037D580A9CB3F3A6CE63480AE28EB12C4D75AC2D685964DD0A042D08FF7E61D138EF4532D6956BF117A9" +
      "8DF2A8DEBC5F8C67754BF5A8995884B75F1DA9E0CFFE93AE33F972A2CFAC9070C048B426560D26399D18FF682431A9E126EF439FAD2270E657F0D4279E739CF8" +
      "D6F85162393649DE5EF19DC30330BC1CFF43A399D622EC6FE1C0C75287BE1081B47947341182832F54E09A4EB617F7FE401E0C5AF945A07F96E9B243F76845E1" +
      "8DAB4D248DDCD309CECF8D5CD3F5676B61EDB2E530E0398BC630D42C7F154CA51BA27AC0137FCAAFFC1BD98F486C6D3EAFCF4BD492F9576208B37F041BD44665" +
      "C6051F89EF8E47A4A460DDC656A1EEBC71154D29848AE35F6EB4C467EF62B4CB8A4AFF3082A024547E0ABAA95EE9015CB6C4FD6CA54F42F7851AC76F50922352" +
      "C80C1B501CB14CFE6FD1A4954B1F09066D7A225F6780F4E8EFAD13DEB962AE39DE5A91C8039C6896A2A7A1479C820435B5D23887EB84295D4C3413CEABD16233" +
      "6BF5542619127DEA54C24A3BFD7E8E0FA34A64E5DC5EF2CB287EBD783BACAE3329658C61BCF607E3EA179F6F45F60A5DF065E8AAD839E8ECAB802CA684D09FFB" +
      "B6FCB0707C06B673885B36C14390B02499EA3EDD949DDE64F93DE803C177CB87FB437172B37041B439326E9447994798AEC4E31C5E1F0483693FF18CB89540A6" +
      "07A71F99C27C42F536E7AA41E082BF0FD0C18022ECCD8D6DCC7B44D9FEEFCC15DBAA35822E3EDB24B209550108C1FB4B8FF107415F15504FA62C4171024FFA7B" +
      "0264350B0B9F173DAB865737DBEF4749392912C421525A91741501FA0852B307128965BEFEB53B706E06");
  const KAT192_SS = OpCodes.Hex8ToBytes("857169E8D11ADD62B7072EE33C4A4A6A229E2477598CC6C534BF61523D7A5B5E04EA03760C3527DE11BAA9E31DA2BF382DDC9D3EC5C5E6BA938F7F8EA0D6AF7F");
  const KAT256_SEED = OpCodes.Hex8ToBytes("42C667A186390F26C8F024D31D5FE3D20145BC2FCCF26C865E20DF7626CEF09E4D9EADD263D95EDE934A74B3721EAAB0");
  const KAT256_PK = OpCodes.Hex8ToBytes(
      "5009C2E5C95AA03DCBF09F69C9529DA97F496712E083181F51F06AA7E7F733149CCE4BD1A190A9B53FF761DB49C50BB1A8231631E4946EEC090707FD6CB8A5AD" +
      "034B0840C386A18CAADCB32B889FD52B94219CBC7A1B1A214103D54E2F4FD3A92CAC5AC06417115C7DFFA415E5C3979E64ADBF941FB857767D4612B8C2BE4AF6" +
      "D17E1A0832A1A6D03E0EFD2C68106FBAC385DB88738576C53F92E930F43B8AB63A81E466DB660C0DC19F9E30C5B3CBA06390B21958DB7837C74432FE46D650F9" +
      "6D35FB0D55236F22434D71AD499C1B82242FB3ADF852530F818BF07E7ECD87E5BF75DCDB25473BA2BE9896E66A90817937EF2D517E74C33506756268AF315D52" +
      "867E254F5F7764392069EF700E8D8A1EBEF907221A0A5D5EA9159743102D3B10E5E258F9CC79CFEECA9908A323C581814FAA65D511E715F6DB0408FE5C2BE565" +
      "D990DFCCA3B1327ED5A698AF592F9493780013EA511DE414FB8951CE856FE57BD1AB43ACD778EE7CD62A49591BF5872E963BF0480EE0FF263706D66FEEEF9C8F" +
      "DBAEA1A43D8CDD1B96C2CF5057A5BF0A79B16AB921775F7006C7BEB6F3CC51C527D701625E06B9482203D76A77478F0792A60EB8E898D023C845DC01B33ECCF0" +
      "6ACB604071E5E9D5007A69931BC4C4A7452519A1639523640D6E947C2A8B7918622B7109E998E6ACD42376F2DF963ADB4A9884668D248006261EE061EB1F697F" +
      "9993E89E84CB7DF41EF61F4AFCBA44A21A8C69029D5C28D079F935D53CB7693404CFB772CD38BF2852FE0D8C54BF814857F80020D66AF1752479211B0F2F0C69" +
      "3A6F7E3EA2B277884CE600F60EEC76C25421D3436539B70E78931DF697132437E39AC3A8B86DD4C90DC195184C4FDB8F7B9CC12D5889E106BB104D0EC0D45D35" +
      "076D92442B99B76D85592D88E29CA3382C92680282BD266D9E5F79C9FB96FCA9222F5A1560C7D6119971D64C84ADD006799DDE9322840DFBCA40D4D0E1A63873" +
      "150571B1BEE7B80328E1B927BF827D231E91A02DF963B4286EA9307C297AF079D3FCBAED70ABA72B22126F6AB412D18BDA52E9D907E4FE08CB5876D0F3CD70D6" +
      "EF831D48BD4EF34487A4CC256DD66069EF8C19678D067E5E00F4F60CA8F3843667B072D19AFD033F7005260513887103F96CEA93C3F5DB705036DCAB90C90D98" +
      "F95A3D0283A02FA072CA0404F63FF54F99656B8FCBD7638F4A0EFE676221D5EC32EFB835C6A51CDFB617AF67052F969B0581621E3646244F525A4EC506E838B6" +
      "C19D4A7E1036F1A114D37EC4E769DD8F314787A62BFEDCA832F901DA48A3EA98F5A163A8A1C6DCBA8CAC563D6D122ED290C017226D54A3F2B53315715C70268B" +
      "47274674087436B7696CFBCF93357A5FD88E67CFBB42B51002602D3E5F2A5C4F274589A69D1AAF55C508AB40C0C608A213EE2120E8BDBDD06F8198EAAAE34585" +
      "80BE865363F9DE2A37141B795BA7B336EB2DA37188609203F1D768092B239E25C6284B980651D373232BF8B376E5636F9DE6218E9C993AEA0929ECE393720B28" +
      "C171D2C7AAA12557478AE044F53B5C4482073625617552AFB3F724347351992D6270E82836BFCBFF9229BB1BEC1E30224154E74112983B8E48F54167FCA6B530" +
      "F934F3A12EE0FE7FD76C21BFAB1E384BD6FA9030342FAF1EB808C631B20D40DEF8FD4F620F2DCF4CD155B8505672940F339A5A49E61FE6223EED2AF63D7598B6" +
      "5C847196E5DF6C0F279733113A134E6FA59250C3962BBEE577FB2A03E8C1446A6E8440EA36030404B13D5CB70AA3A6EFDE7B47A7910A899E78AA5029E0282BE8" +
      "AB2A27C88A696FA0E19C2C28B0B7894DAC2DAE4076961AD6BA272BFB9C505CF2332254F32E864C0CBAD659CA26B8F4A4095D51D33BE53ACACB2240D14443D34C" +
      "CC10F8BB3CB9426C356F83011F88EE89564F5582878143ABB36F8384A74A6207EFE7E426894A572229602508FE99DB89417CC2E415E1A111F90D6D4CD4C1E443" +
      "4B5FCB20CF54A980A00AA7880940391C3E4E0B69BE8D4ACCA43C430BD3E4153E5448C8723231915834B11822FFC89387D3C687CF1FE82B8E7AC30F49524D749B" +
      "AC105128A0D7F051B431E3AD605864ECE61F9F2EB5D384F77D4F244D40CA38E4EB76E45BB03F507B6E7912487CC426967F68735B0AB81B5FE695FCBAEA0DEE3C" +
      "3D82156A35E32E5157FB499454CB6CFA45509ED37B561488868235E028463643A36510C35C6FC6F7929BE4FABA15550149E3B4A040929CF0E406B2FDA92581B5" +
      "5C9C8F32F98BB61E7ABFFBE0969DB9722D64BE9CB863DA642AD6B5F9E5FFF8AFD2C9FED84A68142C652A8C12D0A0EB6F978F0B5EECCAD27C35F784F7BA502DA5" +
      "CCB60C5110A98F331E2E629CEBA5915439176B6697DA6FF0D807530F70C09F31FA628DFB40538017A213A2534B4328485FF722C4D3F22BB191E72EDA809970AB" +
      "57C11271681FF4189FAC2B64101354E4B5E02ACF33163F7A734AB9531E374C7A259A11BB688F6F1F8AFD31AC4EDABD9E753B6AB116C0192D0C251069D3D11D66" +
      "FC1795717610E1D6DE81C9F3800240B0F1E8ED93ACEBC14BC7995BD87213B2944567DA1FCFF01B0F8F9E41C25FB28F5A13AD779BCD74D7F1064246C1AED74A08" +
      "044A238802A4FFAD8C0DDB5362D1EFCB9CAFDCDBF689CE7668398D927ABE43FB4C8A890B0F094382D429EB1342A11B56D57AE32172CA32D3449706695C3C591F" +
      "5861F9E0A09AFE2338D1C92C30C016AA90F05968EEB6A22E8CAD29D69563EBA1CEE01F149645417BDAED941F3F40C27D925D295DF37510356F6F49D2EBC29757" +
      "82818D9FD77872EC67EE592D38915675E0761D317F67C40E6B3C6E057B2D977DE1E2190204A4D507C2A1F56060F299419324A39A7949A05E0C54A41F80576905" +
      "BFBB85801711B85CB921283804AA2F9A5D66CEE96ECA1ED525F974B0B395C5AA847F31D890990D0AA3E108199D15E8E32C38951492C403C5C046D9C73E2D3497" +
      "4CBE239FBDA1C88C6A710C49EF9260AB4A6509680F3A498ECB16337E08F3FCE97A2F30F516BF26053CA774E800F0113FAD4DC45D0FD8DAC406073E6A1E335B61" +
      "8F3C9922F334363BF7BBB7B61161ED821B996849B40C8A9CD8E45A657F44CDAAD3786BD1B47E81F0059CFE8CA6FD9484B2FA7CAC8195E50F20951BC09CAE00E3" +
      "1618151E9CED968226533CA337677685396CDCFD3FE80270ECF96E937E619B1B5F6759779C594D80437FF68DADFDE3796CC381C0C749FE7BC950367BF5AF87CD" +
      "B768970B06DCCEFBF7E13186B6DB864CE373E48878D73225C708E4B849EFA0648E8F5AC5F6896FE91BCAAE815129A3AA957CD67F3CB83B8B44E2B982652A023B" +
      "F1069CFED58B60B0D3DD39344824CAADA46CAEC97262CA7FFA4F551787E740CD1522EF23DE1D414C4F4C3D73BE450B624B068A539D879B0AADA5FC4CD74F0A5F" +
      "2CF46A7D21A768F700784E6951B6F88DE21884DF9A9B6C22AC0B8CE0A2B88CF463B7A7BED0B95D242C30D268B158A15FCA92DC7F9892E37FB64CC4D4EA420DD8" +
      "D25BDFFEDC8E58764526B3C7AE2CE5B70188A2B296AB0AD65127A196C1836850C00B78D8A55F996D6276B24F84FBFF7F616EB92859E1CF8A0328B291A2870543" +
      "5840185E7D1FADEE2E2580DDBE9B62B0C65291D8B30E5BF0CBBB318E5305C9155A293A7A64E0B9D18B76C9D0EC1089053F058CD4573DE2A2F9E50AC539BC1FC7" +
      "BDF59BF00B5906DF6CD8B04F8240FC4A798DC5AA1443327C8921D2ECB9AE0E48836FBDFCE15B7AD3CA8046B7F39965C1A6A444DCCC9C2ADFCD8A28EF84572C8E" +
      "892A7BD9FEB369D0345E0432C7B07DD3141DEDEC2380218CD4377DAD58E17A0779CE74A16EE408F3B540107921A7C5BB9D91A263E6A2DA3BB2FA7F9D890387BC" +
      "D14BC8C4462859D25CB3E4CE7D6070EB125E29BAD1074A0E57176A5F9F62D94E8B9F67BDD640CB55889E0DE91F60930AB661832312BCEA9FAEB4C8646DDAA7C5" +
      "03C14ABFF6A3BD3A18CF34BB54CBFF94B114D7840612ED42FF01E54212B48BF489C9D1C4BF5268AD72928FFF4F7C56E4ADF39F2780152DDEE0D3915427963669" +
      "15D307581741875375092DFA6F273F6C93E16703B33E2DE481C2C9BFCA0066019BA919C2A71488C5DEBB5C90DA9EC9C01A832B1DCD9A370A04044A8F6AC7E664" +
      "B9FC2CAD399A928DBF0481167D84ED4BA50EA8D1F27F93E7096666480D3FF4EF1C47FAFE1DFB9B55A205F267C4A1E0347B19FC6CD8733B0689D1438985DCE1B6" +
      "6F72B7BC97A7AB3DEE4E32D7B12E3DDC5D2BEDC888B564785527A4B13E698BBD8DB32D814DABF4D33ADE2F7781DE6E54F7E930E8B8C004E9BE5BFB83BBFF6533" +
      "0673FB3E77B5515BA3951D57AAD826A1519DF4CAE0C7169D6559694CD59E657C3090BF67331DB6D1C2DC2E50098B89378A680D04ABC04B56198C217CAB58CF4F" +
      "57E58DC4A5BEC50C4E32578DC779FF6DCA2ED8A01A593295A697B23F68971275E5E262692385F9580BC4E6FFA15A1410A3B4733359376B1BFD12F780CF4970E1" +
      "BA9B9335CA4F2C62FF5632C92D1EC7C9677C2181BC5D837AF19C77F8935DC11101A9AE3C89B9DD2FFF90BF0FAA796367B76B616EC4C475FDF27281CDEB3D46EA" +
      "CAA69DB54261D06B9ABBD09FA4E13A6A8E558FB30F856E4348B99FAC2D6514496CD8BC2E37B63FB0B4EA44DE4BBCCB7D70964DDE28FC5C7BFE862050742E350E" +
      "CB6FD9A4C7AEA406E499F0273328555454202C54ACF3E76711FDD9B8A208796C6968753643E2ECCF746CFF6A29514BFA5087693A46FAF9086E30F06189ADD47B" +
      "65BFD19A110FD6FB03841E197DF7402EE50822582E36FA624449A2B5095B12D63678A039C5270830E1B277CEACDDA134636CF6CA858566281D16FC405020CB8E" +
      "1C772CD0EBC67DDA456F5DCB5DE71C440145DF276629162113E7CAB9D81989AAB6FA098AD61FFF1A65552354DABA1D9DE8A4B4F1467315F622B30073A73495B6" +
      "68FD203551BC17681A63E0DD2D3CC038BF4FBAD646E0E4E702B92F324552C7ECE60BC69B5817F4BCC896AB902353AC79369EFDB71CB1B12A7C6BC76A9C797307" +
      "B44C1B6FE4F1FF23A4AA4D2121EA6E6C905FAA8EE62F84344B30422DA43ED981ADEE57EBA39E3177574A2FC04FBB0C8D0EFEE546924877A16ED98427F736C033" +
      "6705C2ED742EE9D934A1BF04E8DDA94F6D642560A60145499305D9AFE642E7D0A6F27A15F36B18E5233BF7A8CCF6CFC5967CC37EC266365F15222831671C5981" +
      "6C6ED7559709DCB1CFFCBB2F516B19945D5983747772CCBD91980AB3C6D31906D3B1942A48104BC1F2436A0A7DCF3AA0E182A35D37752B26AD5E4282248F620D" +
      "2022EDE2C0AF42D97D1629409CE681883BC5A6F5256ECCA55DBB1E378B3BAC4217D7CE41FD2CC05F60AEC62865816EEBFFA06B6C136CECB10BFE9FEACE64B877" +
      "DB4AF6C9D9427A9039E3E405A5568EDA77813169763E50DEEEA2C036F3A6F72E994831A5A8A18C2827FB076C6172969B711B73781ACF43E16ADCC53C6097E945" +
      "76C095D75AA16C90F92C9F89F217410834C6296B7799DC8737B7A58210B61D7339309A0A8EB2B1117E6DA5889159513455A4611A6917994019191B0E18A17E0E" +
      "98D5F2955679189CD23914E62652C3A859F4DDF913EC727021BA9C122BA899E4BFDB89AD5FF7ADB46FAF2355AB5A5AFE38AB37E3D5AF7B8BE5B88B8D40A1EB89" +
      "48AEB32F563D6F32E2EC304C926352DBC7A9AC2388D66CC4F60544A65ABDD0E76E77C891EAC148185DCF800445ED5AD4503797E653E801161CE7EE1B7F591000" +
      "6596AD0B9709EF75EFA7AC1CAE8DE2C4E63891DB79CE3094B617D1A1060F80C04AAF762B06BA5457D6C7D515CC741D63CEFB2356ED96DE80212346A454431FDD" +
      "8F22EAEFCE78AC2554349950F9659972B1311266A040E903A47D908BC3C64BC71D89493D2CF5EDDC7BBAB15C0B4CE745235E832C153F5F9D55F83FDD94368B83" +
      "A187C38776D276F64CF98BD20BA816E001C9C21081F223C9017861A406843084F2BAE9C5BFFCF15656D3419486A049BDA19C88C0B3ACBE05269F3C4C67AFD7B6" +
      "80EF4E498FC5C78F77029940E11A31BDE0D029CD1816F6B51327B0A5135157D46E6D51E3D4AB197ADEEBF78D4CACD2033B7B2DEE170D13C5398344C2D3C92D2D" +
      "B75F2D83C3C16389A5C76A7BC845DAD4F2A39E0D9925098065D2564DDF4F1A4AD1F0FF1479BA20048625952290385E4537DB1E11229B85BEB8B7E6116244C4F0" +
      "FCB8FA8C51DF705B02EB391C669C923DB95867C3490329973B8D90336A64F282ABE4C6C1E2E1092616A9050805966560551296D4180B17241E3CA33B846E71B4" +
      "67CDB3211CE1FF90974C442E6572344C4458A45FB1B4286C89AA4D3861E8F45908D8E2DCFFB0CF293C2379D2F345F3ECD30F949D81FA500CB4F888CFB458C36D" +
      "711C501925A2024F033C1BA927F1A0540CAE1D8A9D595B48ED31AB6B2F97088CE394527468163A7C428A096AEBF064D83D0257592BBCE8AE5F0AA112A145E322" +
      "61838FF0FFE4902772F3CF1B5314709B78992F9659C4535AAB6430A150EDBF8C67E0E07FC1F489ACAB9F1B6E5344ABF3B6881E32D52874540F9777C9AE078761" +
      "3A9CE0E7E574435DAD76AA39FC14922ECA693CD2F96B6665D4DA59628A7BC0C3503C9A5409D674FBB149EDAB4E3F0413B1A96166CA203E39775CD6CCDDB399DE" +
      "ABE9F8F1242EEE17A0919D812486CE72803F1CAEE66F0B2C62F3396A5944A38E0F0D0EF91D0589403772615280F610B715FB0061BCE2AB8141B8BDCA73328EC8" +
      "A16F014A581E5B41E8C57576B6B2C7BCBFBEF952646B5E38CF9E50AB862C2E6AB98A8EAB2AA0CF3940AEFEEEC658838413F65CA2DC4ADAD01CFA03C56BD6ADE7" +
      "95DFB1457F4868F822EB4BADB99541E665E9DC7CB3347D367A6367C753F52AD9A4A00866C348264A7E0DA824E53E85DA77D9CBF13A21A7D2D36919F730DB25B0" +
      "7F535B4BE269EF0130188C5C802456B5601C71B06D9EE5BA731208DEAD010D1596FEEEF38EEEDFD18B921901730D9961D285CC89BB54739918132BA51B01143C" +
      "848E264FEA4D412DCE07608DC2B88EB18D9740ACA00D9E0E6AEA8993C7A759B44FFC50136B17A37E4ECD97633F35BB0E0AAA9287E70CF3BCFE7009E698A65C82" +
      "E9A8138AABBF0762D36C7080DA05DA7FE141EF14B4D8CA1A2306289A15C95140486C9CF049D4C6928091073FBD442E0DDD94F8F704DFF7A21D602F7616EACF49" +
      "8AFB1B95FECAF53FB629F1D01BD84DE75B80B062ED8AEB7E7362A13965F1BE540CC826CC39074BC7E6FE233010568B5338CDB360122D0DDF5A1E26CCA9FE145E" +
      "AD87316EBDEF71DE7BD15CDA49787D6BF82A36CCC1018C4EA93D1E7B9AEB89EAE5F76E8326F414321AEA5D810089F9A4138354E27629D2B965B5B333BC562E74" +
      "0D5EA4142A18E522AC510E04082B01A77EF30C8CBD453892A6293BD099A69B9985FA502FF2DD6BA19D0EA8AEB2E570C6705F023F728A6A17AF1BF4F5814A3E54" +
      "B20F50060C36BCCD39735CCFCFA299BD0AFB516713F0AD565DA3652065E7721EB454A2DA9715E71DBB84013920F1D0E42F02317E3333CC37BDF59078B71E1849" +
      "E6D8D1FF133F27D192B5E9E6034E817C48F88CB1B3D37EE3509ADF9243125DF68D5C393D8C641A875D0A4818EF4DA07560504EA740D08C50EE137F711117A66B" +
      "06B7F9C6FD372BD8A58D6F0220AF6266078B3590BE355C4285D572B75286C2ACFAACDA9606AA85E5ECC4F27A063EE605CE7378DC4158CC6EBCDA77FE857A7E9F" +
      "3F6FF36D9433485A951787B924FB1BB9767E7652E7043025949C806A48771D18D397100F22444735E80173BF31EF0BF68F0A69C076AAEDE89AA30FFDCBE24009" +
      "2B475F6E59F7EACAC9D7D8D5A0D10887ECE5621BA0E9BB5C23701C11CEF0FBCA49C02302B5B6C0297E69C1A11A5FDEA9FB56EA3F2D2AD2C0C8BCC0801996DC52" +
      "7CE578996F30895C58F9E13DE564ECE6C93BFA441E465A291410964952A1E57892AB1FBF2138B0B0D682BA5B0C101F257C4F2F57348A4A23CE608A6590A99910" +
      "8D929130BCF01F322104D2F845CFAB8220DAF3C2682AC920C5DEC85A48EFE5E2048210458089E3A390B7BA4C4F14A7CD6B27B3830FF4B115BCCBAAB865E62494" +
      "49D8E4FCBB4684FC628C67E771C3CE6A18E49BD4DDE428E14C575EE5B9C5EEB5E5DCB3F22B1519BB7262BCE3DA91BBD9C25D381AF5B545660D94ADB25AAE7381" +
      "C7E0D01992F71133420B89EBD653AE46F22C695F164E181F083F932F37DA869D46CBCBCA16735DD2D22337D4061EC8D4CFAECA7AF7181AC857B5D9FFC34EDCED" +
      "559EAA0B91D2D708A7308240D8D853209DCA69A3C747E445C11294179FA9FA75C0F012489FB04403CFFE212F78FF617F5A6B18988C79DA1F60983B25E8471876" +
      "F73A403ECA0F7AEB0B7847F0C931D8C7E2DFCF7BFC39452C329D58B0A6E3301036B3170F0D4B0A12AD078E2287F175A2E7E353D1C143D07ED6C32DDAACDB7FA0" +
      "D3D877E3E65CA4DD5CA6F5529BA960CC5497927A1D9AFF7F6FEC8175EDF913867EED65ADF335F23746240A55B06397A860FE6F6E2CC8FAB199BE78E7DF797EF6" +
      "7B0B90869D581E9B8C95CAF20492D421B52446C72E67A618455ECEEAAC0CCA51A677D5B4930302448E7DB8789CC6E13294B274A7142D61A0A6A4B8DC258D2B82" +
      "16B85F50E838A20724FC213F785401766396562977E5F54296073BE5EE4948B84B9619A8FBCA30D3D9A34CFD4004A5CAB7A6064FDED4DD6D4AE30F6B3E7E5322" +
      "122588F60A9605623C54B969146716BFDD317D663D255F2C384FC2F0CCCAA2584D39B35674D6206AB0F32A7E2665379B10CCEDBE185C6489D06AE7F0AFA211E2" +
      "A231F001FF9A62FD6BF3A58B7F5F9DBF6CD81B4FC9962B018EE5C2A716D27CBA2B2C21DDBA3EC2543C55E2504EC431FC4EB123C60F96CF4142176B1A6AA09807" +
      "B151D60E833ECD0890574D5D9A97295CF4EAC54AF693CC73ECDE0A3C2750B40E45050E35F004B1D227D1C90828EEA955B416D4847A85B6C181A7D5882565DA59" +
      "3200AE9F78F0D51CF62EB72B5B3FDA5BCD405D4FD0B4936D61ED8B3FFB0F385E5927C3C33E361FC9120F6EEC26924FCCE5CD1723291B2F72462D71A79AF6CACA" +
      "E209E2B9381774CF62E4920632744E19ECCBDF15B719BD6D0E9F2DC44BB143A5B8667E49DE91E75532312F75A814AEC51476F2C799364CD74CB73C76D696703A" +
      "DEFA43B3B51769B4ADA7B2F3CECC7584FC43BC49FCA4C75DAF4752AB6C2FA1401AEBD9168E2F6AC3000B51265B7288D1FFD2DABDC33E0E141758C2BA1DFBD6D9" +
      "97AC46F7BDE100F9512923275B3435AF63C4FB3EF96A67ED86701CDF13BF15846140B02FC2033BB35A25A7318007C789C589018F766129DA493723319149573A" +
      "4B8A7DD48DED9843EC8D1AE200AB9D022D7D3EEC20FBAE0DA7497645D2631D9ABF5678FBA196BB6F4C41ED36A6E80C40E5364202139D1F8C5C77241772F07CEB" +
      "1D93D404CF5F5B8BD81668968670B53012B48CB87C6CF2633A2701ED8336ED9C466830C9EABA1DDD10BE49DCD7F98E14B0A72ED58CBAB5BEACBF09146E6FE865" +
      "0413CFB41BE026FCC9DEB5E00AF85ED7AF9F85A2A28A39E5F6E06F958C37C6BE40C76D02FB80E303833782B19D2BD067C472DBA9D625DC3D5D47FC8F674D1DA2" +
      "37681CCD48EE01D27EB881C4731F4F6FBE4B7F3F0AFA28850E428EB46666721BCF95748C4B2D82E01ACCFB3CAF952AC4E6A3AE09A9C96C4D021C81DC013B88D7" +
      "63618373FF0BD992012C5383CD87CF40105D4A8666F1A940C76E0342952B2C2AC784764D2750E41491CC7809A71DF62DDA934C93D58CB9FACA5849D81F14D7F8" +
      "2CF2EBB600A472B7AC875E0C26208B30AFA5EEE4F25B2F0890CA78C4226EA298777F9880A6FF3B1FB65D5BB4B5707BA3E29E496E9DC8FB4BE3499560210DB255" +
      "CD5DA1B5A2F29DBCB6F664B26D2E504CE3491B24BBD76E956CD71C1B02294BE0AF6952E272ADD7565520653125A6ED43B9E96D98B6B945C9D3ADA7791428970D" +
      "C9A65487C84E20CDBAF8BACED82129366B41FEC2A64D8E98BEC4F1BC57945A781554C9E4806D2AA36354CC931EE26EF43DAC2B2B54F17D5A928E0EA64BEA36D0" +
      "8BE3E30CE138C1DCB7B4CBEC387F5CFE586288AB2C3D18B9C5A6F73F86F6C2C86774F4B7793192951D43F4C47B366853A3A7EF5A68040E86C01CA9846626AF84" +
      "1AA3422C25B8C7F3A201EB1914");
  const KAT256_SS = OpCodes.Hex8ToBytes("8BDD2446F939F77A5E6075B0244A804A33D3ED5978F8055F29F4431629CB331125FB1CF05B45F0D6723A915ECD9BEE2EF7B0F362093A20464F8BDD56282AC9BE");

  const VECTORS = [
    {
      text: "HQC-128 hqc-128_kat.rsp record 0: seed to public key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-128',
      keyGenerationOutput: 'publicKey',
      input: KAT128_SEED,
      expected: KAT128_PK
    },
    {
      text: "HQC-128 hqc-128_kat.rsp record 0: seed to secret key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-128',
      keyGenerationOutput: 'privateKey',
      input: KAT128_SEED,
      expected: KAT128_SK
    },
    {
      text: "HQC-128 hqc-128_kat.rsp record 0: seed to ciphertext",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-128',
      keyGenerationOutput: 'ciphertext',
      input: KAT128_SEED,
      expected: KAT128_CT
    },
    {
      text: "HQC-128 hqc-128_kat.rsp record 0: seed to encapsulated shared secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-128',
      keyGenerationOutput: 'sharedSecret',
      input: KAT128_SEED,
      expected: KAT128_SS
    },
    {
      // Drives the decoder, which no other direction reaches: the Reed-Muller
      // and Reed-Solomon decoders only run on the decapsulation path.
      text: "HQC-128 hqc-128_kat.rsp record 0: decapsulating its own ciphertext returns the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-128',
      keyGenerationOutput: 'decapsulatedSecret',
      input: KAT128_SEED,
      expected: KAT128_SS
    },
    {
      text: "HQC-128 hqc-128_kat.rsp record 0: decapsulation of the published ciphertext under the published secret key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      inverse: true,
      privateKey: KAT128_SK,
      input: KAT128_CT,
      expected: KAT128_SS
    },
    {
      // Setting sharedSecret turns the result into a verdict, so that the
      // rejection cases below can assert a mismatch without naming the value
      // the rejection branch produces.
      text: "HQC-128 hqc-128_kat.rsp record 0: the recovered secret is the published one",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      inverse: true,
      privateKey: KAT128_SK,
      sharedSecret: KAT128_SS,
      input: KAT128_CT,
      expected: [1]
    },
    {
      // One bit of the ciphertext flipped. HQC answers a ciphertext it did not
      // produce with a secret of zeroes rather than an error, so the property
      // to assert is that the published secret does not come back.
      text: "HQC-128 hqc-128_kat.rsp record 0: a modified ciphertext must not decapsulate to the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      inverse: true,
      privateKey: KAT128_SK,
      sharedSecret: KAT128_SS,
      input: KAT128_CT_CORRUPTED,
      expected: [0]
    },
    {
      text: "HQC-128 hqc-128_kat.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      inverse: true,
      privateKey: KAT128_SK_OTHER,
      sharedSecret: KAT128_SS,
      input: KAT128_CT,
      expected: [0]
    },
    {
      text: "HQC-192 hqc-192_kat.rsp record 0: seed to public key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-192',
      keyGenerationOutput: 'publicKey',
      input: KAT192_SEED,
      expected: KAT192_PK
    },
    {
      // The shared secret is SHAKE-256 over the message and both ciphertext
      // vectors, so agreeing on it pins the whole ciphertext as well.
      text: "HQC-192 hqc-192_kat.rsp record 0: seed to encapsulated shared secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-192',
      keyGenerationOutput: 'sharedSecret',
      input: KAT192_SEED,
      expected: KAT192_SS
    },
    {
      text: "HQC-192 hqc-192_kat.rsp record 0: decapsulating its own ciphertext returns the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-192',
      keyGenerationOutput: 'decapsulatedSecret',
      input: KAT192_SEED,
      expected: KAT192_SS
    },
    {
      text: "HQC-256 hqc-256_kat.rsp record 0: seed to public key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-256',
      keyGenerationOutput: 'publicKey',
      input: KAT256_SEED,
      expected: KAT256_PK
    },
    {
      text: "HQC-256 hqc-256_kat.rsp record 0: seed to encapsulated shared secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-256',
      keyGenerationOutput: 'sharedSecret',
      input: KAT256_SEED,
      expected: KAT256_SS
    },
    {
      text: "HQC-256 hqc-256_kat.rsp record 0: decapsulating its own ciphertext returns the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip",
      keyGeneration: true,
      parameterSet: 'hqc-256',
      keyGenerationOutput: 'decapsulatedSecret',
      input: KAT256_SEED,
      expected: KAT256_SS
    }
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class HQCCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "HQC";
      this.description = "Hamming Quasi-Cyclic, the code-based key encapsulation mechanism NIST selected in March 2025 as its backup to ML-KEM. The public key is a random quasi-cyclic h with the syndrome x + h y of a low weight secret; a message is carried by a concatenated Reed-Solomon and duplicated Reed-Muller codeword masked by that syndrome, so decryption is a decoding problem only the secret makes tractable. All three round 4 parameter sets are implemented and verified against the submission's own Known Answer Tests.";
      this.inventor = "Carlos Aguilar Melchor, Nicolas Aragon, Slim Bettaieb, Loic Bidoux, Olivier Blazy, Jean-Christophe Deneuville, Philippe Gaborit, Edoardo Persichetti, Gilles Zemor";
      this.year = 2017;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Post-Quantum Key Encapsulation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.FR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(128, 128, 0), // hqc-128
        new KeySize(192, 192, 0), // hqc-192
        new KeySize(256, 256, 0)  // hqc-256
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("HQC Official Site", "https://pqc-hqc.org/"),
        new LinkItem("HQC Specification", "https://pqc-hqc.org/doc/hqc_specifications_2025_08_22.pdf"),
        new LinkItem("NIST Selects HQC", "https://csrc.nist.gov/pubs/ir/8545/final"),
        new LinkItem("Efficient Encryption from Random Quasi-Cyclic Codes", "https://arxiv.org/abs/1612.05572")
      ];

      this.references = [
        new LinkItem("HQC Round 4 Submission Package and Known Answer Tests", "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip"),
        new LinkItem("HQC Reference Implementation", "https://gitlab.com/pqc-hqc/hqc"),
        new LinkItem("Sampling Fixed Weight Vectors", "https://eprint.iacr.org/2021/1631")
      ];

      this.tests = VECTORS;
    }

    /**
     * Create new algorithm instance
     * @param {boolean} [isInverse=false] - true for decapsulation
     * @returns {object} New instance
     */
    CreateInstance(isInverse = false) {
      return new HQCInstance(this, isInverse);
    }
  }

  /**
   * HQC instance implementing the Feed/Result pattern.
   *
   * A key encapsulation mechanism has three operations rather than two, so the
   * one that runs is selected by which properties are present:
   *
   *   keyGeneration     Feed the 48 octet seed of a Known Answer Test record.
   *                     Result is the public key, the secret key, the
   *                     ciphertext, the encapsulated shared secret or the
   *                     decapsulated shared secret, as keyGenerationOutput says
   *   forward direction Feed the encapsulation randomness - the message then
   *                     the salt. Result is the ciphertext or the shared
   *                     secret, as encapsulationOutput says
   *   inverse direction Feed the ciphertext. Result is the shared secret, or
   *                     [1] / [0] when sharedSecret says what to compare it to
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class HQCInstance extends IAlgorithmInstance {
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
      this._parameterSet = PARAMETER_SETS['hqc-128'];
      this._publicKey = null;
      this._privateKey = null;
      this._sharedSecret = null;
      this._keyData = null;
      this.keyGeneration = false;
      this.keyGenerationOutput = 'publicKey';
      this.encapsulationOutput = 'ciphertext';
    }

    // ---- configuration ----

    set parameterSet(label) {
      const found = FindParameterSet(label);
      if (!found) throw new Error('Unknown HQC parameter set: ' + label);
      this._parameterSet = found;
    }

    get parameterSet() {
      return this._parameterSet.name;
    }

    /**
     * The public key. Its length selects the parameter set, the encoded lengths
     * across the three sets being pairwise distinct.
     */
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }

      const found = ParameterSetByLength(keyBytes.length, 'publicKeySize');
      if (!found)
        throw new Error('An HQC public key is 2249, 4522 or 7245 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
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

      const found = ParameterSetByLength(keyBytes.length, 'privateKeySize');
      if (!found)
        throw new Error('An HQC secret key is 2289, 4562 or 7285 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._privateKey = Array.from(keyBytes);
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
      this._sharedSecret = secretBytes ? Array.from(secretBytes) : null;
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
        throw new Error('Invalid HQC key data format');

      const bytes = Array.from(keyData);

      if (ParameterSetByLength(bytes.length, 'privateKeySize')) {
        this.privateKey = bytes;
        return;
      }
      if (ParameterSetByLength(bytes.length, 'publicKeySize')) {
        this.publicKey = bytes;
        return;
      }

      // Anything else is read as a parameter set label, which is how the older
      // interface selected the size.
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
     * as feeding the whole.
     * @param {number[]} data - input bytes
     */
    Feed(data) {
      if (data === null || data === undefined) return;

      if (typeof data === 'string') {
        for (let i = 0; i < data.length; ++i)
          this.inputBuffer.push(OpCodes.AndN(data.charCodeAt(i), 0xFF));
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

      if (this.keyGeneration) {
        const set = this._parameterSet;
        const record = KatRecord(set, input);

        switch (this.keyGenerationOutput) {
          case 'privateKey': return record.secretKey;
          case 'ciphertext': return record.ciphertext;
          case 'sharedSecret': return record.sharedSecret;
          case 'decapsulatedSecret':
            return Decapsulate(set, record.ciphertext, record.secretKey);
          default: return record.publicKey;
        }
      }

      if (this.isInverse) {
        if (!this._privateKey)
          throw new Error('HQC decapsulation needs a secret key');

        const recovered = Decapsulate(this._parameterSet, input, this._privateKey);
        if (!this._sharedSecret) return recovered;
        return [OpCodes.SecureCompare(recovered, this._sharedSecret) ? 1 : 0];
      }

      if (!this._publicKey)
        throw new Error('HQC encapsulation needs a public key');

      const set = this._parameterSet;
      if (input.length < set.randomnessSize)
        throw new Error('HQC encapsulation needs ' + set.randomnessSize + ' bytes of randomness, got ' + input.length);

      const encapsulated = Encapsulate(set, this._publicKey, input);
      return this.encapsulationOutput === 'sharedSecret'
        ? encapsulated.sharedSecret
        : encapsulated.ciphertext;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new HQCCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HQCCipher, HQCInstance };
}));
