/*
 * BIKE Implementation
 * Bit Flipping Key Encapsulation - the QC-MDPC code-based KEM of NIST PQC
 * round 4
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BIKE's secret is a pair of sparse circulants (h0, h1) of weight dv, and the
 * public key is h1 h0^-1 in GF(2)[x]/(x^r - 1). A ciphertext carries an error
 * vector of weight t through the syndrome e0 + e1 h, and decapsulation
 * recovers it with the Black-Gray-Flip bit flipping decoder. The three round 4
 * parameter sets are implemented:
 *
 *   bike-l1  r = 12323  dv = 71   t = 134  pk 1541  sk 3114   ct 1573  ss 32
 *   bike-l3  r = 24659  dv = 103  t = 199  pk 3083  sk 6198   ct 3115  ss 32
 *   bike-l5  r = 40973  dv = 137  t = 264  pk 5122  sk 10276  ct 5154  ss 32
 *
 * Verified against the submission's own Known Answer Tests, PQCkemKAT_BIKE_3114
 * .rsp, PQCkemKAT_BIKE_6198.rsp and PQCkemKAT_BIKE_10276.rsp from the round 4
 * package: all 100 records of each file agree on the public key, the secret
 * key, the ciphertext, the encapsulated shared secret and the decapsulated
 * shared secret - 300 records and 1500 field comparisons in total.
 *
 * Those records are keyed by a 48 byte seed driving the NIST Known Answer Test
 * AES-256 CTR_DRBG, which is implemented here and was checked first on its own:
 * started from the standard entropy input of 0, 1 ... 47 it reproduces all 100
 * published seeds of the file exactly.
 *
 * The decoder is probabilistic - the parameters are chosen for a decoding
 * failure rate below 2^-128 rather than for certainty - but its iteration
 * count and thresholds are fixed, so the path the Known Answer Tests take is
 * deterministic. A ciphertext it fails to decode is answered with the implicit
 * rejection secret rather than an error.
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
      throw new Error('BIKE key generation needs AES, which is not registered');
    return aesAlgorithm;
  }

  // ===== SHAKE-256 and SHA3-384 =====
  //
  // The scheme draws a single continuous stream of several kilobytes from one
  // absorbed SHAKE state, which the collection's registered extendable output
  // function refuses to produce in one call - it caps a squeeze at a kilobyte.
  // The sponge is therefore kept here, and is checked against the registered
  // implementations as well as against the published values.

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
  const SHA3_384_RATE = 104;

  /**
   * Absorb the given byte strings and return a reader over the squeezed stream.
   * Successive reads continue the same stream rather than restarting it.
   * @param {uint8[][]} parts - byte strings, absorbed in order
   * @param {number} rate - the sponge rate in octets
   * @param {number} pad - the domain separation byte
   * @returns {object} a reader with read(count)
   */
  function KeccakStream(parts, rate, pad) {
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
        if (position === rate) {
          KeccakF1600(high, low);
          position = 0;
        }
      }
    }

    // The domain separator followed by the pad10*1 terminator. When only one
    // byte of the block is free the two land on the same byte, which
    // exclusive-oring both in handles without a special case.
    xorByte(position, pad);
    xorByte(rate - 1, 0x80);
    KeccakF1600(high, low);

    let squeezed = 0;

    const nextByte = function () {
      if (squeezed === rate) {
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
      }
    };
  }

  function Shake256Stream(parts) {
    return KeccakStream(parts, SHAKE256_RATE, 0x1F);
  }

  /**
   * SHA3-384 over the concatenation of the given byte strings.
   * @param {uint8[][]} parts - byte strings, absorbed in order
   * @returns {number[]} 48 digest octets
   */
  function Sha3_384(parts) {
    return KeccakStream(parts, SHA3_384_RATE, 0x06).read(48);
  }

  // ===== the NIST Known Answer Test generator =====
  //
  // The AES-256 CTR_DRBG of the NIST reference harness. It is what turns a
  // record's 48 byte seed into the two 32 byte seeds key generation draws and
  // the message encapsulation draws.

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

    update(entropy.slice(0, 48));

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
  // r is the block length, dv the weight of each secret circulant and t the
  // weight of the error vector. The threshold is the affine function of the
  // syndrome weight that the submission fixes for each set.

  const PARAMETER_SETS = (() => {
    const build = (name, r, dv, t, thresholdBase, thresholdSlope, thresholdFloor) => {
      const set = {
        name: name, r: r, dv: dv, t: t,
        thresholdBase: thresholdBase, thresholdSlope: thresholdSlope,
        thresholdFloor: thresholdFloor, tau: 3, iterations: 5
      };
      set.n = 2 * r;
      set.rBytes = Math.ceil(r / 8);
      set.nBytes = Math.ceil(2 * r / 8);
      set.rWords = Math.ceil(r / 32);
      set.topBit = r - (set.rWords - 1) * 32;
      set.topMask = OpCodes.Shr32(0xFFFFFFFF, 32 - set.topBit);
      set.publicKeySize = set.rBytes;
      set.privateKeySize = 2 * set.rBytes + 32;
      set.ciphertextSize = set.rBytes + 32;
      set.sharedSecretSize = 32;
      set.messageSize = 32;
      return set;
    };

    const sets = {};
    for (const set of [
      build('bike-l1', 12323, 71, 134, 13.530, 0.0069722, 36),
      build('bike-l3', 24659, 103, 199, 15.2588, 0.005265, 52),
      build('bike-l5', 40973, 137, 264, 17.8785, 0.00402312, 69)
    ]) sets[set.name] = set;
    return sets;
  })();

  function FindParameterSet(label) {
    if (!label) return null;
    const text = String(label).toLowerCase();
    if (PARAMETER_SETS[text]) return PARAMETER_SETS[text];
    for (const name of Object.keys(PARAMETER_SETS))
      if (name.indexOf(text) >= 0 || text.indexOf(name) >= 0) return PARAMETER_SETS[name];
    if (text === '1' || text === '128') return PARAMETER_SETS['bike-l1'];
    if (text === '3' || text === '192') return PARAMETER_SETS['bike-l3'];
    if (text === '5' || text === '256') return PARAMETER_SETS['bike-l5'];
    return null;
  }

  function ParameterSetByLength(length, field) {
    for (const name of Object.keys(PARAMETER_SETS))
      if (PARAMETER_SETS[name][field] === length) return PARAMETER_SETS[name];
    return null;
  }

  // ===== bit and word helpers =====

  function GetBit(bytes, position) {
    return OpCodes.AndN(OpCodes.Shr32(bytes[OpCodes.Shr32(position, 3)], OpCodes.AndN(position, 7)), 1);
  }

  function SetBit(bytes, position) {
    const index = OpCodes.Shr32(position, 3);
    bytes[index] = OpCodes.OrN(bytes[index], OpCodes.Shl32(1, OpCodes.AndN(position, 7)));
  }

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

  // ===== sampling =====

  /**
   * The submission's sparse sampler. Indices are drawn from the top down, each
   * by a multiply-shift into the range that is left, and a collision is sent to
   * the index of the draw itself so that the weight is always exact.
   * @param {object} stream - the SHAKE reader to draw from
   * @param {number} weight - the number of set bits
   * @param {number} length - the length in bits
   * @param {number} byteLength - the length in octets
   * @returns {object} the packed vector and the sorted positions
   */
  function GenerateSparseRep(stream, weight, length, byteLength) {
    const bytes = new Array(byteLength).fill(0);
    const positions = [];

    for (let i = weight - 1; i >= 0; --i) {
      const raw = stream.read(4);
      const value = raw[0] + raw[1] * 0x100 + raw[2] * 0x10000 + raw[3] * 0x1000000;
      let position = Math.floor(value * (length - i) / 4294967296);
      position += i;
      if (GetBit(bytes, position) === 1) position = i;
      SetBit(bytes, position);
      positions.push(position);
    }

    positions.sort((a, b) => a - b);
    return { bytes: bytes, positions: positions };
  }

  // ===== polynomials over GF(2)[x] / (x^r - 1) =====

  function ReduceCyclic(set, accumulator) {
    const words = set.rWords;
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

    // The fold can leave a few bits at or above r behind; clear them the same
    // way. The loop is bounded so that a malformed ciphertext cannot spin here.
    for (let pass = 0; pass < 4; ++pass) {
      const carry = OpCodes.Shr32(out[top], set.topBit);
      if (carry === 0) break;
      out[top] = OpCodes.And32(out[top], set.topMask);
      out[0] = OpCodes.Xor32(out[0], carry);
    }

    return out;
  }

  /**
   * Multiply modulo x^r - 1. Every product in this scheme has a sparse operand,
   * given by the positions of its set bits, so the product is the sum of the
   * other operand shifted to each of them.
   * @param {object} set - the parameter set
   * @param {number[]} sparsePositions - positions of the set bits
   * @param {Uint32Array} dense - the other operand
   * @returns {Uint32Array} the product
   */
  function VectMul(set, sparsePositions, dense) {
    const words = set.rWords;
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

  function DegreeOf(words, from) {
    for (let i = from; i >= 0; --i) {
      const word = words[i];
      if (word === 0) continue;
      for (let bit = 31; bit >= 0; --bit)
        if (OpCodes.AndN(OpCodes.Shr32(word, bit), 1) === 1) return i * 32 + bit;
    }
    return -1;
  }

  function XorShifted(target, source, shift, wordCount) {
    const wordShift = OpCodes.Shr32(shift, 5);
    const bitShift = OpCodes.AndN(shift, 31);
    if (bitShift === 0) {
      for (let i = wordCount - 1; i >= 0; --i)
        target[wordShift + i] = OpCodes.Xor32(target[wordShift + i], source[i]);
      return;
    }
    const back = 32 - bitShift;
    for (let i = wordCount - 1; i >= 0; --i) {
      const d = source[i];
      if (d === 0) continue;
      const lo = wordShift + i;
      target[lo] = OpCodes.Xor32(target[lo], OpCodes.Shl32(d, bitShift));
      target[lo + 1] = OpCodes.Xor32(target[lo + 1], OpCodes.Shr32(d, back));
    }
  }

  /**
   * The inverse modulo x^r - 1, by the extended Euclidean algorithm over
   * GF(2)[x]. The modulus is not irreducible, so not every element is
   * invertible, but a polynomial of odd weight is coprime to x + 1 and the
   * secret circulants have odd weight by construction.
   * @param {object} set - the parameter set
   * @param {Uint32Array} dense - the polynomial to invert
   * @returns {Uint32Array} its inverse
   */
  function VectInverse(set, dense) {
    const size = set.rWords + 2;
    const u = new Uint32Array(size);
    const v = new Uint32Array(size);
    let g1 = new Uint32Array(size);
    let g2 = new Uint32Array(size);

    for (let i = 0; i < set.rWords; ++i) u[i] = dense[i];

    // v = x^r + 1, which is x^r - 1 over this field
    v[0] = 1;
    const topWord = OpCodes.Shr32(set.r, 5);
    v[topWord] = OpCodes.Or32(v[topWord], OpCodes.Shl32(1, OpCodes.AndN(set.r, 31)));
    g1[0] = 1;

    let degreeU = DegreeOf(u, size - 1);
    let degreeV = set.r;
    if (degreeU < 0) throw new Error('BIKE cannot invert the zero polynomial');

    let polyU = u;
    let polyV = v;

    while (degreeU > 0) {
      if (degreeU < degreeV) {
        const swapPoly = polyU; polyU = polyV; polyV = swapPoly;
        const swapCofactor = g1; g1 = g2; g2 = swapCofactor;
        const swapDegree = degreeU; degreeU = degreeV; degreeV = swapDegree;
      }
      const shift = degreeU - degreeV;
      const span = size - OpCodes.Shr32(shift, 5) - 1;
      XorShifted(polyU, polyV, shift, span);
      XorShifted(g1, g2, shift, span);
      degreeU = DegreeOf(polyU, OpCodes.Shr32(degreeU, 5));
      if (degreeU < 0) throw new Error('BIKE inversion failed: the operand shares a factor with x^r - 1');
    }

    if (polyU[0] !== 1) throw new Error('BIKE inversion failed: the greatest common divisor is not one');

    const accumulator = new Uint32Array(2 * set.rWords + 2);
    for (let i = 0; i < size; ++i) accumulator[i] = g1[i];
    return ReduceCyclic(set, accumulator);
  }

  /** e0 is the low r bits of the error vector, e1 the r bits above them. */
  function SplitPolynomial(set, eBytes) {
    const e0 = new Array(set.rBytes).fill(0);
    const e1 = new Array(set.rBytes).fill(0);
    for (let i = 0; i < set.r; ++i) {
      if (GetBit(eBytes, i) === 1) SetBit(e0, i);
      if (GetBit(eBytes, set.r + i) === 1) SetBit(e1, i);
    }
    return { e0: e0, e1: e1 };
  }

  // ===== the Black-Gray-Flip decoder =====

  /** The first column of a circulant, from the positions of its first row. */
  function FirstColumn(set, rowPositions) {
    const dv = set.dv;
    const column = new Array(dv).fill(0);
    if (rowPositions[0] === 0) {
      column[0] = 0;
      for (let i = 1; i < dv; ++i) column[i] = set.r - rowPositions[dv - i];
    } else {
      for (let i = 0; i < dv; ++i) column[i] = set.r - rowPositions[dv - 1 - i];
    }
    return column;
  }

  /** How many of the syndrome bits this position takes part in are set. */
  function CounterAt(set, column, position, syndrome) {
    let count = 0;
    for (let i = 0; i < set.dv; ++i) {
      let index = column[i] + position;
      if (index >= set.r) index -= set.r;
      if (syndrome[index] === 1) ++count;
    }
    return count;
  }

  function RecomputeSyndrome(set, syndrome, position, h0, h1) {
    if (position < set.r) {
      for (let j = 0; j < set.dv; ++j) {
        const index = h0[j] <= position ? position - h0[j] : set.r - h0[j] + position;
        syndrome[index] = OpCodes.XorN(syndrome[index], 1);
      }
    } else {
      const shifted = position - set.r;
      for (let j = 0; j < set.dv; ++j) {
        const index = h1[j] <= shifted ? shifted - h1[j] : set.r - h1[j] + shifted;
        syndrome[index] = OpCodes.XorN(syndrome[index], 1);
      }
    }
  }

  /** The syndrome is held transposed, so the error index has to be mirrored. */
  function FlipAdjusted(set, e, position) {
    let adjusted = position;
    if (position !== 0 && position !== set.r)
      adjusted = position > set.r ? (set.n - position) + set.r : set.r - position;
    e[adjusted] = OpCodes.XorN(e[adjusted], 1);
  }

  function HammingWeight(bits) {
    let count = 0;
    for (let i = 0; i < bits.length; ++i) count += bits[i];
    return count;
  }

  /**
   * One bit flipping pass. Positions at or above the threshold are flipped and
   * marked black; those within tau of it are marked grey for the masked passes.
   */
  function BitFlipIteration(set, e, black, gray, syndrome, threshold, h0, h1, h0col, h1col) {
    const flipped = [];

    for (let j = 0; j < set.r; ++j) {
      const counter = CounterAt(set, h0col, j, syndrome);
      if (counter >= threshold) {
        FlipAdjusted(set, e, j);
        flipped.push(j);
        black[j] = 1;
      } else if (counter >= threshold - set.tau) gray[j] = 1;
    }

    for (let j = 0; j < set.r; ++j) {
      const counter = CounterAt(set, h1col, j, syndrome);
      if (counter >= threshold) {
        FlipAdjusted(set, e, set.r + j);
        flipped.push(set.r + j);
        black[set.r + j] = 1;
      } else if (counter >= threshold - set.tau) gray[set.r + j] = 1;
    }

    // The syndrome is updated only after the whole pass, which is what makes
    // this a parallel bit flipping step rather than a sequential one.
    for (let i = 0; i < flipped.length; ++i) RecomputeSyndrome(set, syndrome, flipped[i], h0, h1);
  }

  function MaskedBitFlipIteration(set, e, syndrome, mask, threshold, h0, h1, h0col, h1col) {
    const flipped = [];

    for (let j = 0; j < set.r; ++j) {
      if (!mask[j]) continue;
      if (CounterAt(set, h0col, j, syndrome) >= threshold) {
        FlipAdjusted(set, e, j);
        flipped.push(j);
      }
    }

    for (let j = 0; j < set.r; ++j) {
      if (!mask[set.r + j]) continue;
      if (CounterAt(set, h1col, j, syndrome) >= threshold) {
        FlipAdjusted(set, e, set.r + j);
        flipped.push(set.r + j);
      }
    }

    for (let i = 0; i < flipped.length; ++i) RecomputeSyndrome(set, syndrome, flipped[i], h0, h1);
  }

  /**
   * The Black-Gray-Flip decoder: five bit flipping passes, the first of which
   * is followed by two masked passes over the positions it flipped and the
   * positions it nearly flipped.
   * @param {object} set - the parameter set
   * @param {Uint8Array} syndrome - the transposed syndrome, consumed in place
   * @param {number[]} h0 - positions of the first secret circulant
   * @param {number[]} h1 - positions of the second
   * @returns {object} the recovered error vector and whether the syndrome cleared
   */
  function BgfDecoder(set, syndrome, h0, h1) {
    const e = new Uint8Array(set.n);
    const h0col = FirstColumn(set, h0);
    const h1col = FirstColumn(set, h1);

    for (let iteration = 1; iteration <= set.iterations; ++iteration) {
      const black = new Uint8Array(set.n);
      const gray = new Uint8Array(set.n);

      const weight = HammingWeight(syndrome);
      const threshold = Math.floor(Math.max(
        set.thresholdBase + set.thresholdSlope * weight, set.thresholdFloor));

      BitFlipIteration(set, e, black, gray, syndrome, threshold, h0, h1, h0col, h1col);

      if (iteration === 1) {
        const masked = Math.floor((set.dv + 1) / 2) + 1;
        MaskedBitFlipIteration(set, e, syndrome, black, masked, h0, h1, h0col, h1col);
        MaskedBitFlipIteration(set, e, syndrome, gray, masked, h0, h1, h0col, h1col);
      }
    }

    return { error: e, success: HammingWeight(syndrome) === 0 };
  }

  // ===== the key encapsulation mechanism =====

  /** H maps the message to an error vector of weight t. */
  function FunctionH(set, m) {
    return GenerateSparseRep(Shake256Stream([m]), set.t, set.n, set.nBytes);
  }

  /** L hashes the two halves of the error vector. */
  function FunctionL(set, eBytes) {
    const split = SplitPolynomial(set, eBytes);
    return Sha3_384([split.e0, split.e1]).slice(0, 32);
  }

  /** K derives the shared secret from the message and the ciphertext. */
  function FunctionK(set, m, c0, c1) {
    return Sha3_384([m, c0, c1]).slice(0, 32);
  }

  /**
   * The key pair. The secret is two sparse circulants and a rejection seed; the
   * public key is their quotient.
   * @param {object} set - the parameter set
   * @param {object} drbg - the generator to draw the two seeds from
   * @returns {object} the public and secret keys as octet strings
   */
  function Keypair(set, drbg) {
    const seeds = drbg.read(64);
    const first = seeds.slice(0, 32);
    const second = seeds.slice(32, 64);

    const stream = Shake256Stream([first]);
    const h0 = GenerateSparseRep(stream, set.dv, set.r, set.rBytes);
    const h1 = GenerateSparseRep(stream, set.dv, set.r, set.rBytes);

    const inverse = VectInverse(set, BytesToWords(h0.bytes, set.rWords));
    const publicKey = WordsToBytes(VectMul(set, h1.positions, inverse), set.rBytes);

    return {
      publicKey: publicKey,
      secretKey: h0.bytes.concat(h1.bytes).concat(second)
    };
  }

  /**
   * Encapsulate. The error vector is derived from the message, so the receiver
   * can check the ciphertext by recomputing it.
   * @param {object} set - the parameter set
   * @param {number[]} pk - the public key
   * @param {number[]} m - the 32 octet message
   * @returns {object} the ciphertext and the shared secret
   */
  function Encapsulate(set, pk, m) {
    const e = FunctionH(set, m);
    const split = SplitPolynomial(set, e.bytes);

    const upperPositions = [];
    for (let i = 0; i < e.positions.length; ++i)
      if (e.positions[i] >= set.r) upperPositions.push(e.positions[i] - set.r);

    const c0 = WordsToBytes(VectMul(set, upperPositions, BytesToWords(pk, set.rWords)), set.rBytes);
    for (let i = 0; i < set.rBytes; ++i) c0[i] = OpCodes.XorN(c0[i], split.e0[i]);

    const masked = FunctionL(set, e.bytes);
    const c1 = new Array(32);
    for (let i = 0; i < 32; ++i) c1[i] = OpCodes.XorN(masked[i], m[i]);

    return {
      ciphertext: c0.concat(c1),
      sharedSecret: FunctionK(set, m, c0, c1)
    };
  }

  /**
   * Decapsulate. The decoder recovers the error vector from the syndrome, the
   * message follows from it, and the error vector is then rederived from that
   * message: a ciphertext whose two do not agree gets the rejection secret
   * derived from the secret key's own seed rather than an error.
   * @param {object} set - the parameter set
   * @param {number[]} ciphertext - the ciphertext
   * @param {number[]} sk - the secret key
   * @returns {number[]} the shared secret
   */
  function Decapsulate(set, ciphertext, sk) {
    const c0 = ciphertext.slice(0, set.rBytes);
    const c1 = ciphertext.slice(set.rBytes, set.rBytes + 32);

    const h0Bytes = sk.slice(0, set.rBytes);
    const h1Bytes = sk.slice(set.rBytes, 2 * set.rBytes);
    const sigma = sk.slice(2 * set.rBytes, 2 * set.rBytes + 32);

    const h0 = [];
    const h1 = [];
    for (let i = 0; i < set.r; ++i) {
      if (GetBit(h0Bytes, i) === 1) h0.push(i);
      if (GetBit(h1Bytes, i) === 1) h1.push(i);
    }
    if (h0.length !== set.dv || h1.length !== set.dv)
      throw new Error('BIKE secret key does not have weight ' + set.dv);

    // s = h0 c0, then transposed into a column
    const productBytes = WordsToBytes(VectMul(set, h0, BytesToWords(c0, set.rWords)), set.rBytes);
    const syndrome = new Uint8Array(set.r);
    syndrome[0] = GetBit(productBytes, 0);
    for (let i = 1; i < set.r; ++i) syndrome[i] = GetBit(productBytes, set.r - i);

    const decoded = BgfDecoder(set, syndrome, h0, h1);

    const recoveredError = new Array(set.nBytes).fill(0);
    for (let i = 0; i < set.n; ++i) if (decoded.error[i]) SetBit(recoveredError, i);

    const masked = FunctionL(set, recoveredError);
    const message = new Array(32);
    for (let i = 0; i < 32; ++i) message[i] = OpCodes.XorN(c1[i], masked[i]);

    const recomputed = FunctionH(set, message);

    let agree = true;
    for (let i = 0; i < set.nBytes; ++i) if (recomputed.bytes[i] !== recoveredError[i]) agree = false;

    return agree ? FunctionK(set, message, c0, c1) : FunctionK(set, sigma, c0, c1);
  }

  /**
   * One Known Answer Test record, end to end from its 48 octet seed: the key
   * pair and then the encapsulation, drawn from one generator in that order,
   * which is what the NIST harness does.
   * @param {object} set - the parameter set
   * @param {uint8[]} seed - the 48 octet seed
   * @returns {object} the public key, secret key, ciphertext and shared secret
   */
  function KatRecord(set, seed) {
    const drbg = Drbg(seed);
    const pair = Keypair(set, drbg);

    // Encapsulation draws a seed pair as well and uses the first half of it.
    const message = drbg.read(64).slice(0, 32);
    const encapsulated = Encapsulate(set, pair.publicKey, message);

    return {
      publicKey: pair.publicKey,
      secretKey: pair.secretKey,
      message: message,
      ciphertext: encapsulated.ciphertext,
      sharedSecret: encapsulated.sharedSecret
    };
  }

  // ===== TEST VECTORS =====
  //
  // Every expected value below is taken verbatim from the BIKE submission's own
  // Known Answer Tests - PQCkemKAT_BIKE_3114.rsp, PQCkemKAT_BIKE_6198.rsp and
  // PQCkemKAT_BIKE_10276.rsp in the round 4 package - and nothing here was
  // produced by this file. The seeds are the published ones, so a vector names
  // only data that appears in those files.
  //
  // The full sweep is wider than what is committed here: all 100 records of
  // each of the three files agree on all five published fields.

  const KATL1_SEED = OpCodes.Hex8ToBytes("061550234D158C5EC95595FE04EF7A25767F2E24CC2BC479D09D86DC9ABCFDE7056A8C266F9EF97ED08541DBD2E1FFA1");
  const KATL1_PK = OpCodes.Hex8ToBytes(
      "07D0317A8BDB2D2438AB54042832AF07D8A980F84E10DEBECBA8226AAB7B8E6CB3D6E75DF2DFB6E140A7C8EBE14B9758803564A9A6E83FE495B1108EC3F015B5" +
      "D92357AA1320D9F88C3CD64CFAFCF3F2EFBE4C0F3767D2E5F9EF44BD0CC0F48B5922781BAF9FE583FA01B39779A05073D134542CDA6028A84B9427CD9D8E1E52" +
      "FD3755EE2B329CA01FC5AE8AF2C9644A465E1F52189C6044B4589A001BEE55871B8BFB668AE5C6FEFEB33271F5378FD15C51CB89425E7F5FD798C70CCF6C254B" +
      "369A7C1B3666F1596CA720706AE18B4ED08D52E2228F5B16ADFCD15B9A43C8654186003C6FAE36036BDA1FCCCC112AB4A04C0219C07B8EDD7912DE1440C555A5" +
      "084B6D9C9DF656480E86CB8F73741715A2BEFBBC4AD76B3032473561D42FF55D580884FEA7C45EB07EBD77518263F9D3E595CB58E15BB6765BC65AB7E3DFD967" +
      "4DA788C2616846043CE6F10BECEE879347ABEA5C45D33D9BCB7B9054F64A42545C515B3F91D708E7342A9DA27CE8EA778C6BA3A6D8838D21FD0DCE28E4D96EDE" +
      "4075369D12D22465AFB099424B7CBC54309269A7D8AADC0F90625E6AF0A7252BB3AD127CFBDCC98346E6BB0E44FDED225E960BDC9014950577FF223E6F2962FE" +
      "B184686B2BB4C2946D20D073D15286BC9B9FF4993CCE27A60455DA404F0B0FB1246EA25D1BF00BE28EA85B39402BAF4761D91E79DD263E3BD734CCE3A0574802" +
      "2D10D3DF53D405F388577077E4D067A5AF0BE5B692676E7E29ACA5696E8A8E3A55ED123BDB4AC2EAE98E840456A7CA1DB3C191CB16BCF1322266A1452B2F0D75" +
      "9DC337D9D9FD4AB9AEC7A6B0EC6D4F8272A29005C3E974AAA5621D898138E3DF5C581F24C01568598B156B30442FE40D99185452A4C4CDE2482C46EF0BDA4B00" +
      "7F067EB8D659A4FA4A54935C4C14BB788A6FB357FB2F70A9E186C90CFDE5FF509D0A0D79C451C3F5C7D2AB4DD66A8480F6092913F001301D22995D458284235C" +
      "A20BD0B2866714EF7D4BEFF3C7BF7BADC2DD893FC7CE7D5E1FC1C18830310B70448D6D7D90D552164361A42DBEA06C2CA2DB8F5698A79D67E251E44F1DF75FE2" +
      "FF0C5128082B94D253ABFA8B2B3510CE3A04B3A1D0CB59AD6D357832AA2A89A243D291B9AFAE94EEF657F3F7B4EA76FF886CFEA0422AB085E52CA8F554904E4C" +
      "590836E1C9308C86261121B2287B80891B31CACD75278C35AD4665DDDBF36C684009BBC4DABA99197085C3232AA2D490BA946CE681E1E179098D98ACEDC7C485" +
      "ECFA3778D85F7872F203D63032FA5AF81CE26C87237208D7FC3F8E3F8CFFFBA0D3038D9523AEDA70B9858936A34936D29998B0403B6B786F6833A497D0141FE4" +
      "E9B673FBDDA55DD6226E4C3F7A5FF44EA03497730756B60E12126102699BE21C1EFF50B5CB08FABA58EBBD035FC7C024B75E6F10D583B7E6F571C78ECF2568BC" +
      "1480DF584EFB7DDC3806108DE9E0EF42B05427E53A1A79D542524FA0EA814B9DD0912EC7C34AB9079854ED7937EA89FF5AD8B264525198C3277F782C6DBEE0CB" +
      "409BE8FF623000D2365105AFBFF83E3BC5F260162A0CD9A7ABE3D6D2FF8323B37FC3FD48E2F9EBB4266E7144C3AC3D5954E895C5F2A83085BA4ADA08C26703EA" +
      "2F2CA8282BC2A724B625EDECC1011A6E0B78DEF26C59BD87A3C5C71354E867DE03387B3FEAA56F5213B39DB21E954CDFB1EF369DF4B43FEB9222EDD61B73B1FC" +
      "7F34B5FAE2198F54306E780B6B684DB68F69735663836BC98168F5CBAA8FA169A6BD9CBB9BA0E1622700A4D80734D5136B9D11A06100BE4003A1A3F51775CEFC" +
      "39174F2F1157A47F8ECC0C08C70F742861C9FC5FB27B1D82A3FF068465184AE5C842A0A8C39BC5352D5EDEC986A8CCAE2B59B984E6709785C2008C33CBFA400C" +
      "3ED9FD4D2838AA5F3FE622C52CD719C9E2C62CB48B1132F6C8080C3F0A4E814F3CF2C6799AC00F329549FF72AF64C77C6C6653BB3AD509B66EA260C1AA709D47" +
      "97EFDFC24889851CD66B9A80385431F4D2E00CB0D5C5D97C3ED0AE110F7866361F44A531D9094EA56FEED5AFC7706E2AB50EBE02775A8FD697D3BE19AC00EDAF" +
      "C822A47E8F6F01143AF9EFC298191148DFD23C8A016CC3436583110AD11CBD0DD2322395E3E6DEF726D6C5046CBB326BC6CB695BD8E5FD1B5128C8492ADB97E3" +
      "D4E66BEE07");
  const KATL1_SK = OpCodes.Hex8ToBytes(
      "00000000000000000000000000020000000000000000000000000000000000000000000200000100000000000000000000000000000000004000000000000000" +
      "00000000000000000000000000000000008000000000000000000000000000002000000000000000000000000000000000000020000000000000000000000000" +
      "00000000000000000000000000000000000000000000000080000000000000000000000000000040010000000000000000000000000010000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000200000000000000000000000" +
      "00000000000000000000000000000000000000000020000000000000000000000200000000000000000000000000000000000000000080000000000000100008" +
      "00100000000000000000000400000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000008000000400" +
      "00000000000000000000000000000000000000000000000000000000000000001000000000000000020000000000000000000000000000000000000000000040" +
      "00000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000010000000000000" +
      "00000000000000000000000000000000000000000000000000000000000002000000000000000000000002000000000000000000000000000000800000000000" +
      "00000000040000000000000000004000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000" +
      "00000180000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000800000000000000080000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000" +
      "00000008000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000" +
      "00000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000" +
      "00000000200000000000000000000000000000000000010000000000000000000000000000000010000000000040080000000000000000000000010000000000" +
      "00000000000000000000000002020000000001000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000004040000000000000080000000000000000000000000000000000000000000008000000000400000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000410000000000000000000000000000000000000000000000000000000" +
      "00000000000000000800000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000800000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000010000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "08000000000008000000000000000800000000000000000000000000000000000000000000000000000000000080000000000020000000000000000000000000" +
      "00000000080000010000000000000010000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000800000000000000000000010000000000000000000000000000000000000000000000000002000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000001010000000000000000000000000000000000080000000000000002000000000000000000" +
      "00000000000000001000000000000000201100000000000000400000000000000000000000000000000400000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000800000000" +
      "00000000008000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000010000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000" +
      "04000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000800000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000008000000000000000000000000000000000002000800000000000000080000002000000000000000000000000" +
      "00080000000000000000000000000000000000002000000000000000200000000000000000000000000000000000000000000000000000010800000000000000" +
      "00000000000000000000000000000002000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000002000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000001000000000000000000000000000000000000100000000000000000000000000000000000008000000000000000000000000008000000001000000" +
      "20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000100000000000800000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000010000000000008000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00400000000000000000000000000000000000000000000000000000010000000000800000000000400000000000000000000020000000000000000000000000" +
      "00000000003000000000000000000000000000000000000000000000000000000000480000001000000000000000000000000400000000000000000000000000" +
      "00000000000000100000B505D7CFAD1B497499323C8686325E4792F267AAFA3F87CA60D01CB54F29202A");
  const KATL1_CT = OpCodes.Hex8ToBytes(
      "2C360EB591F5F30D64DF178DC8F56252CF203CE20589B6FB295CE47188FC692B6B8D2F0B60F8594F9EC37C82C1C090BCD224740BFFDA9CEF0D69A17005B50E57" +
      "8B5AAA1076FD593EE0884EAB20742C5689C5B9F0DE052DE30577DC9F3D871641BE112FD3107D2E35C260CD880C88E389431E62C82207C1D781283C24FD932958" +
      "9C8D2041B660961065EADE75418A17FB322A106C8481A9B4C69EF406468F81A5E25A3AA8C2205E4C16B2BCEE28B0C30D3780684E3F2840E33A8114EA1971A288" +
      "15A582191AF2F99749C547F7E6B7EF750BA007A4116CFFD0D7F5B4908438C6935B99997BE912679387D1A363DCB89D0CCEA2ACD649A4B5C20AA3F5FBD48ADCED" +
      "AE3B1C8179B904B92DD282EC228969B17CB1D1432F76CC53F0919747DBE9DBCB0A2F956D140EA70F9B01E15719A37D41725A7917DDEDB9C7E697E830410516B6" +
      "1EF416FAE84745FD3BA41E5B17FCA2C044F796793403F276A9AA0C4DC8EA0A29748555FAC1C42177657865E2F6BFACF75DDBD5854EC55604366DDA601D14804E" +
      "981ACB755060808B9ABF2FBAC259B4007301E01F0612882216BE660C054FDF98E69E6B18753884BAFC3A4A42B45BCE38569A74D2CE417C001907B6D42EDD26A4" +
      "9FCA69D9B47AD23D5A7084936CED028FFE96008F68D7EDB2AF50A341A4FC78EC879BD182D6D40B4E4EE48FA92612F9A6423DBC456F4C59E8138E60AD464D750A" +
      "97E11633864FF03481627AA4EFFFE3E00C89F41DA0701A0736FBBA0ACB11A868C19A195E8578A661D5BB3539682E438B214300EDEA8D5B8A6D13CA527ED89A7B" +
      "920CFBAF27BAAED1FEE2B8AB22EEFBED0AAE7CB269794DFA3FF63E566B908489C498080ECF7FF36D6E6172FC0D6A2A9765AC994BA269526DE3688EE53BAF0507" +
      "114BA373FD78F8DB4C8869C78A82AE96AD2952A95ECE96C9932A38020EAC3C2B9B6107A07135C6E215658673A132C34639D1E7730B8099E83616B810FC3A645B" +
      "6690F5CA80974D52927C045925E7EC6A2AAE4CAB66A50D34BD959AF0C32A8D89D8850308EF7640C2609BF08DF43167955E72D0AD521111CECD63C9571FDA1D4D" +
      "8162F6D6BC9A83B4AB693FC8A6E1B3627A05AAF685E686DC2C07DDDCE34AB2BC633E041C1B91A09D742CA3B9335B63EDE0B9BCA4E573B9656FE2B0A650112FD0" +
      "E83B993E7388CFADDDCA14F51ABC6400FE328DCB1A5B8D1E7DC6368A677C6F94E77959292E208345CD1FC7A92AF5E178B7902FEC9F8BBEFD8FC86E2B48C1D5A7" +
      "64FB370DDC95408F9A9940C3E2AFEDFC6E546BB7BC4ABEEEDBC6739FF21636BFB5309EFB34E7F242D60EC2D03885AB5F7A7740A4AF63ADE9931B6D920E73C554" +
      "28B1B4BCCFBB9C5BA9E2B476370CE653314F396BA203A109496EB2D366D4D98ACDCEA805A79A04AA47066D8493907ADADF1D70351A01F303ED694FBC7C3EC7AB" +
      "125577D807946AC249CACC5667CFC7591F24CDF5EC8BBB4EDE4B9099E12292616552B3C0CED334E0CE3E4984F4418667EA4B97DA9D7DB7A7C9CAC6A3B9C4A23E" +
      "8E9654DFE9594CD7C44260083F2948C9806DDC108206F205CB138B0DA9BF625E95D3A215DC57158C645008E83A09D7A2163ACD76AE912F2C57A8F9919CEDD716" +
      "8E72013A61F351E316076EAF854ADE04F5B8C12C1D817A6165059D42D156112B37AB63EF5B6C533D4D1BAC72861FE3319033A229461628EB8D896CB633C65664" +
      "A9D98949BBD7D9DF6E6734EA8D6FEADD59BFCFDF0ECD22ADBC9B091833A41D904262DBB52A32ED7C40ACEAFDD8049554AF6AD1C866527266A262E607EAC07171" +
      "8DF60F0CD17BC7FD58BFD138436585D6F6443090B548E67C5DF79EB7746ABEFCE1D89B98011BAE850254722C016F88D06AF375FA2FB2C50E367D7D2DCE3BC94B" +
      "8DB63D38481C8F1C216A2F56744E4909FFF7F2BB1A172F3F4C1093C2292D73D30880920822A25581CF17CDFE19CBC38CD07421339F4E5EE3512A4E61B6643035" +
      "282BC1AA17F4DFA00932EB797FB538A7E15B53A06495CE760CDBD0A81F8BFADFBDB2F36DCAF301BBCC3E64FE3F6BB35F1578853C2E276427FC41CE25B40C292C" +
      "0B7C98DD58EB84B0E0E2C318FE1A7F12BFA30192CB573E73E6FE98D0F28A282F59D95A0A585A30065455608E1462BEE0F10F04A5F3A4EF1D1D3B111C66E47901" +
      "0E501DBF0072998A3940AA9C63E036C10ACEAD09FEA5B372D0B517BC8227A9D2F0760423AA");
  const KATL1_CT_CORRUPTED = OpCodes.Hex8ToBytes(
      "2D360EB591F5F30D64DF178DC8F56252CF203CE20589B6FB295CE47188FC692B6B8D2F0B60F8594F9EC37C82C1C090BCD224740BFFDA9CEF0D69A17005B50E57" +
      "8B5AAA1076FD593EE0884EAB20742C5689C5B9F0DE052DE30577DC9F3D871641BE112FD3107D2E35C260CD880C88E389431E62C82207C1D781283C24FD932958" +
      "9C8D2041B660961065EADE75418A17FB322A106C8481A9B4C69EF406468F81A5E25A3AA8C2205E4C16B2BCEE28B0C30D3780684E3F2840E33A8114EA1971A288" +
      "15A582191AF2F99749C547F7E6B7EF750BA007A4116CFFD0D7F5B4908438C6935B99997BE912679387D1A363DCB89D0CCEA2ACD649A4B5C20AA3F5FBD48ADCED" +
      "AE3B1C8179B904B92DD282EC228969B17CB1D1432F76CC53F0919747DBE9DBCB0A2F956D140EA70F9B01E15719A37D41725A7917DDEDB9C7E697E830410516B6" +
      "1EF416FAE84745FD3BA41E5B17FCA2C044F796793403F276A9AA0C4DC8EA0A29748555FAC1C42177657865E2F6BFACF75DDBD5854EC55604366DDA601D14804E" +
      "981ACB755060808B9ABF2FBAC259B4007301E01F0612882216BE660C054FDF98E69E6B18753884BAFC3A4A42B45BCE38569A74D2CE417C001907B6D42EDD26A4" +
      "9FCA69D9B47AD23D5A7084936CED028FFE96008F68D7EDB2AF50A341A4FC78EC879BD182D6D40B4E4EE48FA92612F9A6423DBC456F4C59E8138E60AD464D750A" +
      "97E11633864FF03481627AA4EFFFE3E00C89F41DA0701A0736FBBA0ACB11A868C19A195E8578A661D5BB3539682E438B214300EDEA8D5B8A6D13CA527ED89A7B" +
      "920CFBAF27BAAED1FEE2B8AB22EEFBED0AAE7CB269794DFA3FF63E566B908489C498080ECF7FF36D6E6172FC0D6A2A9765AC994BA269526DE3688EE53BAF0507" +
      "114BA373FD78F8DB4C8869C78A82AE96AD2952A95ECE96C9932A38020EAC3C2B9B6107A07135C6E215658673A132C34639D1E7730B8099E83616B810FC3A645B" +
      "6690F5CA80974D52927C045925E7EC6A2AAE4CAB66A50D34BD959AF0C32A8D89D8850308EF7640C2609BF08DF43167955E72D0AD521111CECD63C9571FDA1D4D" +
      "8162F6D6BC9A83B4AB693FC8A6E1B3627A05AAF685E686DC2C07DDDCE34AB2BC633E041C1B91A09D742CA3B9335B63EDE0B9BCA4E573B9656FE2B0A650112FD0" +
      "E83B993E7388CFADDDCA14F51ABC6400FE328DCB1A5B8D1E7DC6368A677C6F94E77959292E208345CD1FC7A92AF5E178B7902FEC9F8BBEFD8FC86E2B48C1D5A7" +
      "64FB370DDC95408F9A9940C3E2AFEDFC6E546BB7BC4ABEEEDBC6739FF21636BFB5309EFB34E7F242D60EC2D03885AB5F7A7740A4AF63ADE9931B6D920E73C554" +
      "28B1B4BCCFBB9C5BA9E2B476370CE653314F396BA203A109496EB2D366D4D98ACDCEA805A79A04AA47066D8493907ADADF1D70351A01F303ED694FBC7C3EC7AB" +
      "125577D807946AC249CACC5667CFC7591F24CDF5EC8BBB4EDE4B9099E12292616552B3C0CED334E0CE3E4984F4418667EA4B97DA9D7DB7A7C9CAC6A3B9C4A23E" +
      "8E9654DFE9594CD7C44260083F2948C9806DDC108206F205CB138B0DA9BF625E95D3A215DC57158C645008E83A09D7A2163ACD76AE912F2C57A8F9919CEDD716" +
      "8E72013A61F351E316076EAF854ADE04F5B8C12C1D817A6165059D42D156112B37AB63EF5B6C533D4D1BAC72861FE3319033A229461628EB8D896CB633C65664" +
      "A9D98949BBD7D9DF6E6734EA8D6FEADD59BFCFDF0ECD22ADBC9B091833A41D904262DBB52A32ED7C40ACEAFDD8049554AF6AD1C866527266A262E607EAC07171" +
      "8DF60F0CD17BC7FD58BFD138436585D6F6443090B548E67C5DF79EB7746ABEFCE1D89B98011BAE850254722C016F88D06AF375FA2FB2C50E367D7D2DCE3BC94B" +
      "8DB63D38481C8F1C216A2F56744E4909FFF7F2BB1A172F3F4C1093C2292D73D30880920822A25581CF17CDFE19CBC38CD07421339F4E5EE3512A4E61B6643035" +
      "282BC1AA17F4DFA00932EB797FB538A7E15B53A06495CE760CDBD0A81F8BFADFBDB2F36DCAF301BBCC3E64FE3F6BB35F1578853C2E276427FC41CE25B40C292C" +
      "0B7C98DD58EB84B0E0E2C318FE1A7F12BFA30192CB573E73E6FE98D0F28A282F59D95A0A585A30065455608E1462BEE0F10F04A5F3A4EF1D1D3B111C66E47901" +
      "0E501DBF0072998A3940AA9C63E036C10ACEAD09FEA5B372D0B517BC8227A9D2F0760423AA");
  const KATL1_SS = OpCodes.Hex8ToBytes("C748CC2121532EFEEBA47F446E8393B7202400463BEBDE6E45882ACAB8DDEEC6");
  const KATL1_SK_OTHER = OpCodes.Hex8ToBytes(
      "00000000000000000000000000010000000000000000000000000000000010000000000000000000000000200000000100000000000000000004000000000000" +
      "01000000000000000000000000000000000000000000000000000000000000000000200000000000000000200010000080000000000002000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000008000000000000200000000000000000000200000000000000000000000" +
      "00000000000000000000000000000000400000000000000000000000000000000020000000000000000000000000000000000000000000000000000002000000" +
      "00000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000200000000000000000000000000010000000000000000000000000000000800000400000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000004000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000020000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000" +
      "00000800000000000000000800000000000001000000000000000000000000000000000000000000000000000002008000000000010000000020000000000000" +
      "00000000000000000000000000000000000000000000000000040000000000000000000000000000000000001000000000000000000000000000000000000000" +
      "00000000000000400000000000000000000000004000040000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000008000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000040000000000000000000000004000000000000000000000000000000000000840002" +
      "00008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000040000000000000000" +
      "00800000000000000000000000000000000000000000000000000000000003000000000000002000000000000000000000000000000000000000040000000000" +
      "00000000000000008000000000000000000000000001000000000000000000000000000000000000008000000000000000000000000200000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000008000000000000000000000400000000000000000000000000080000000000000" +
      "00000000000000000010000000000000010000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000" +
      "00000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000" +
      "00000000000000000000080000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000" +
      "00000000000000000000000004000000100000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000" +
      "00000000000000000010800000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000020000000000000000000020000000000000000000020000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000020000000000000000008" +
      "00000000000000000000100000000000000000000000000000000000200000000000000000000000000000000000000000000400000000000000000000100000" +
      "00000000002000000000020000000000000000000000000000000000000000000000000020000000000000000000000000000000200000008000000000000000" +
      "00000000000000000000000000000000001000040000000000000000000000000000000000000000000000100000000000000040020000000000000000008000" +
      "00000000000008000000000000000000000000000000000000000000000000000000000000080000000000000000200000000000000000000020000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000040000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000800" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000010" +
      "00000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000080000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000080000000000000000000000" +
      "00000000000000020000020000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000" +
      "00000000000000000000000000000004000000000040000000000000000000000000000100000000400000000000000000000000000000000040000000000000" +
      "00000000000000000000400002000000000400000000000010000000000000000000000040000000000000000000100000000000000000000000000000002000" +
      "00000000000000000000000000000000000000000000000001000000000000000004000000000000420000000000000000000000000000000010000000000000" +
      "00200000000000000000000000000000000000000000000800000000000000000000000000000000000000000000001000000000000000000000000000000000" +
      "00000000000000000000020000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000" +
      "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000" +
      "00000000000000000000588522D326E7F105F11C4E8D97E119E193AF42DC28409F4F7572ADA538B52C1F");
  const KATL3_SEED = OpCodes.Hex8ToBytes("061550234D158C5EC95595FE04EF7A25767F2E24CC2BC479D09D86DC9ABCFDE7056A8C266F9EF97ED08541DBD2E1FFA1");
  const KATL3_PK = OpCodes.Hex8ToBytes(
      "544F1C33A27D5F9B3D9FDCC275E9121B178C63B483CE1ED1D6F89641DFD9E62348FE91C29D0CAC7BF40BC6537E9940515455845B9546601FC38D68BFE8374DDF" +
      "3FFFB8AF3B905335499CA18507F41ABA731686764A0E5D2D45B1D456FB27395801BC89139B565BD4DF27DF55306210EA7E5ABA50914610EBBB43FE21E0D86BE9" +
      "0C3BB2F3B5F7E0AF9751BC3BD75E418FB345B38B1517A8C9CB27C185F7B43F1952C3E8C670A3B3692C09E490039F1C91F6F7FA2C24D148D1B0FEA4B6AFB0AC4C" +
      "F68641E1413D5FCB1B0CA0EA742F4E6C3E397398CC4F201B83AED03CDC250A7E6C00261B176DF5CD5BBC423C88108371DD72F8AF56F2E14946785660B074EE18" +
      "BF0967FDE194A85E7C6188D72364DE0F87D054C0619E7E678C0B8512B1E91DFBD8CCF772C788D64DA281AF1955D8E17217DCBADC0ABA1C3717E41B7CFC3F5639" +
      "D2BC49622E043264BF811DEBA7496EFABEFC7799E1EEE66F4C14BC6BCE48B1C77AD11DD770FA7BB7A3DD60A82962239932368C7547C19E08E60AD19CE76DBFDD" +
      "45F3047A8B9EF57FB1A696144BEA96D8B2FE6D17A59861B82F764E7C455F22229CFDE23F40E8A8A71ECD6A7DAD89FC6F4F6DFB2FED76EE9AE6C5D047BB970EE3" +
      "3BF7C0B051D535211FB1C9CD50DA0E95CDDB255E4FF5364A33296FEB267AAA039D6EB45DA80AF93EB704574860EB8C15F5C5CD1FF5755147DD2AA8C9FB032F09" +
      "9BC51D9933D30AF14DB9E586AB99B6BFC9C2967E339EB5ABCF1312D62822A3F552FC6927DB2D2D56FC3AC5DC7B017D5BED51FB193D291106046FD65325C0F7B6" +
      "D8660C390A7B3F4BEFEA853D005D7B680E0F7323E3F2A25E0B7D4D70727CFD4A8A6A1C55627078C15E467167B845F24E7D13AC1941B0346133D306BF2D53FB6D" +
      "760ABE5A622BDE162C2A150B91B941FF9D6ACB49669E255D110AD31877DE74CA27FC3F40F5C7E80B70224070F6205BEEE9D7D5717620635E77F371E45157F9DC" +
      "73AB63136778E5B960F2087041E558FFA16D8F8238BCE9A8561E3C31FE351C889EE18BE9A41247B6800CBCEB12494E8B5A259D50FEA8EAE86E037E35FCF4ED9B" +
      "BB550032883079D9DE7F62A7F143F639456D5560E988555B4E17CA83F204891B8E4E49113FCE1593AF4180AA149E1A3110B99D9A64F95770877A17EA3A91D6DD" +
      "561CF42D3A75E876D6AC063FE79DD21FDE5D8CD2F0036772335E833BB4AA4AEEDB6013FA53EE5C81A1BD60A993CDB1704BEE37FDE4AD6A547169D85F530C8AB4" +
      "33CC794BFEFEDD83165DB8267BFEC425FC03867D7C9E60A47E1DD437EB6BDE69083C599027544A19C284EF9FCB7F57FC2D150E8F2E7A33A8ACEFC9B4C070246F" +
      "92395C2DDA78965A43517D8C2F8952492005517B7B22413E08C618057EA4BCD1736019ED091C5539601790DECF0F2C5171B4F08395381A8FE884C3B60443876D" +
      "13FCE150EFDE9CFF3860F3328735833F61DD502A4BD6B377C8CCA5081F6927F428189622D5F2D58D877F252DCA88621E68C71AD9CE6F285848A1A54C8F2659C2" +
      "E9B56A9D8CF3784DA35E6244A48F6AA79D1FF4F4AF7A4467D95E020DDB9AC16D2AD47E792850FEBDEE2258BC730DCEF7C132D22C4B51135BFEA906B3E30CCCDD" +
      "19D19B410676FAC672887E2C90D639BEB50CAF23224EE7369BBB904A5550A2FFFA0999FC1E8608661B5611F34A71F687B328BA29706AA7C04EA89CC9ABE655FA" +
      "F514EF133B09B32BA9C1C9B75C1BABC727D1FCF88661E9FFABB683631FAAFFEADD8B16DD5E8CEF92A378C83C8163C9D0CDF92910B6F0ABEE67DA90DF3E0B87B3" +
      "057FBB4A26986490B1B3B4653CB33EE4C48FF58B9A8AA03977A1BE1B3A73600C400588C4CA60D781CDCB0DBF44CBC05452F74BC532D50FDFC757E88525781329" +
      "D064D824A573B80BF28E008096974C436CBD3F968F09911B88274339EC8E8944626A10D708207D0B30CF982B4AFF5E2A2D582C3055676BF820388ED405FB9440" +
      "532CDBE4C1F4A45A9558896DBF454777E78F255D24F57AF39859C3418009B0A9E5262539F74B867B579E5127631B492406E65FB414C911223990D85A078389C9" +
      "2AA3EE0F0D0DB28B8B05A1EED65828A2C5CDC08DD966D7F53A156C205F107A0DC2A35BFEAFECA216A22178BC6F74183C9D55DC8E8A8D4ECF0430669C643F3BD8" +
      "EFBFD82099F50706E71F23E5B8EDCE7281871A4F20FA9872B7BEFD38B04C07229BFA7F42A827C39366603F7C4C911F07DAD693FA1049CCF35625A574F4F145B9" +
      "83210469612612C1CB90AD230C0DC8C921FC2C6BF77DA9F8B79ED38F92E12E349FAADD872965698F2933F26D31A8A38B8966B855F279F2DA03701B0C85EF19DC" +
      "0247A4C642307BEF645D26F5E7306F0D7CD8F63EE3CC8D4D367C5761C530B3E3B7C719679862D8803689D0A2F2DAF09FFA2E06BA157DFB7DE3EE7F49D3413782" +
      "6F3FC86A8AC84964A0F830BAA0FDDF02BBA75D4E01C16DBF7668C7C89652E7DAF1356C3F1400344BE5D5DBEB14396EC4F546B1A40C0E147DCD3DE140679142EC" +
      "8A0AEC4FCBFC7E899155E3BE08F0EBA80C88EEF6F5E4DA9CFEC3D257CA8B9F9D264C4C106FA5B39354484F0EBA0B8AF5F865690F585CDDB10437967A58A967A3" +
      "FA5AC6E25F121FD4EBF8648643CEEE566B1A540A7095B50C11CC9EF1C827391AD6904B0BF5C8127E11BC028F4FBBBEC8ECD0CD8D0707CCD5B33180991A468E75" +
      "701C92F7739F1FBC44E9F6B15F2272BCD266F841CA058F07FFCE4FFF7020498BD4CA284951A03D50BD7382CBABA5886F6A18A56998A4039DF8468FFD3765EF08" +
      "713770195801996F55E0E66130B1F77CF280F65DBD644050400C59685F77CB61EEB41BE31A504F10E33536AD0E4D3553F4BEF67539309586BBE8AFFD87F0D95F" +
      "4D2794033A1945BF2F338B073F1DF0BA4A1BB18D686E325DFD816A76FCCD5DB6857753A7F14C0EE9D18F1D2FD7EEAD0D76143617D22C3A3771A4808EEAC6A011" +
      "6C2C996A5AE19EA33739F54BDC20BD129550AEDAF9A3EC3C7442DF622414D161B39B5BA9BD15A35D08F0FE5D294939AB1AC6323CDC6FAE324933AFE99B562583" +
      "92FA39B400BB00D687B31BF66AD82011C94ABEE85CF1B9BF8B7424FCBEC7769256A526C60684459FBDF12B769C465092E27D9EB6B069C8D343F25F7C6EB8F86F" +
      "BB79417FD2DC39A094076B72F427B800A50A032571D745FD34968A0289A691343F1617C60CA37BC8F4DD4947C857B33816D6A7040C398C6E25F69E16E5E4974B" +
      "7F3E7980C00CF5807228A1473CA03F421F27789F78677EC82C07A2AADAEC3B372F2DBCC7DABDFD8D81DB083BF361EF03D9D753E500E8799228BDFA0AE6C9755F" +
      "1A4D1A1B2656F17227F450FD114C74DFD4242F13E2E6AE81490B0C8C442C988FA294FA7B3BC7D40D9DD5745F72653091FE12124F43CBD110D5356D1B1F791FF2" +
      "B72D9AA57F360F0E39D3F7C2446535EFDD09D49DC3F08C43E6B65E0CF0E6B2373D86A22EC16F7EFFCAF5EC71EF91BA44B677262DB07AB24BB18CC7DBE65CA722" +
      "00F2E90ADC69386716EB7510720F0EC3ACB2D672DFFE68D499FE7823E22F1AFCECF55986D1903F2C4D8B4F56FCC6700A2C6AF8C2A2C959DBEE9D3DBEC6785D9B" +
      "31D73D46D53C53F8F2F9262969693B671FC7AFE6CCB81EE9BA14DF8F7A9400C1CA8C7578A5B8DE12542E677206D31EA212EFDAD89956F5F256DAE4A37C6D60A2" +
      "157B8EE1315C5E4DF7DEE3AD3B28C3F9582FB907878D96E6E1DC10AD20EAA3359A95BF6EBBE7972D3886D76282C7CF5CC470BAB4816B112608F55F5C50DC9C93" +
      "E59B1FEF1624335BC5B79A93B46F66ECE46884CDB534294F2FE592A15A12599A32E556364C1A9AF3D8BB1A5F62F2844556B908D24E81CAB3C4399E3686A613DE" +
      "A028211623A8B24B9350D10D3BF4C5C1F6B47BBF30EDBA70634C70DF3863FA3AD769BFBBF1F02C10759740BAD977ECD877C72E4F70DF96B86A30D2D5719F2DF0" +
      "1CEAADBA7253A0C3E64F1150DB1C5D3B932A473D233D5A5156EEF5C12BBD892A1F8D98CA4BEAB091791438EA25C6A4E61C2A75C7B93B001E115D3E0485E81189" +
      "75115F71F805C440AD2F506EC12B0FFCCD64F8F074479B42A647592943E725C4E3B159C5346B141039EA95462415F38F4F2E1A82D972FC064C36F4DEEB934956" +
      "20DF190217B329905DA3D18769135E5B134ACC46625A1ED2AB31B5A2510AFE90A4A7FAA1724FBDDD9C092D38ECC16AC695AE6B1ED631C3D20545C844DFE530A9" +
      "96EBD267BFE28E00AF69C3E1FE36B861BB438D6DCAE5DD49111AF9C74EF0897B677F7A37B4BCED074E4346069A6574C9D6FD87B7A7A28CD59B37CEA717F5A878" +
      "4BB76748622B40913BBF03");
  const KATL3_SS = OpCodes.Hex8ToBytes("FEE9450F15A1A26B6D9A4EF711075B25D8561077995923726EC6E848CCF0F10C");
  const KATL5_SEED = OpCodes.Hex8ToBytes("061550234D158C5EC95595FE04EF7A25767F2E24CC2BC479D09D86DC9ABCFDE7056A8C266F9EF97ED08541DBD2E1FFA1");
  const KATL5_PK = OpCodes.Hex8ToBytes(
      "AFB9CB19BBF20A9C8C25338C6D231C4E15C808F5E2E0DFC98C5939A1301997FD951CCA0F5144E71B771B97D682BE8C162B3DEC0595A266EF9B71BA8D8B4D1935" +
      "B9814E9C7AAD11E5EDA42A7A37AEC49D362D771620A56018FDD6DC876ED6FD1553906A0A731F95F0DDE78E7FE0DC04FAFCD810C791169EE055CE77C3820AC41C" +
      "B50D3A72071BADFC0F37C3268DC3FA6BEBA9DD7B196A9D5B90E2540CA8C022D7EA17FF8F15F633802A6E9D76F18AD5400F3711BA42FD9F4088ECE95A6976B0F8" +
      "E3B8C44680138F4319461E0594F105BEBEFE1082FC7F06AA72D99D3773F1214C974318E84A6A6DB6F303489E9DC7C10657C0129BAB3E744F9ECD3BCE7E595610" +
      "D9744427FF2A49DC9795D885F955A1C24C2E4E3085478CE8A45095E9E600AF1F282F5E950AFA3C82642624A5939A9E999050F96C95DCB20DC97DF6BCE5E06143" +
      "640A42579C6296837AA0A63E96DB552714D1E85C5B4C0F3AE706C8FD0B01DC0D4C42CAB1B243FF714C6249B870BFD8FD72896DCCD25D97C2F63CDF20EFFDB010" +
      "275D6F3694A81D22D1D33AB9D9F5F2728C3723808D5BB63B13E5220E06BD4C4EE98BABF7FB199DA4889AB00FEC4B9762E20C3532B8DAC4BBEF6DA5BDDC027C3A" +
      "D64A49DDA07DEE4E35C084099F3F24D3F33665ADA52D9F938CA5A4844ADAE9DD52796AE0831A7DAF531CFEC3549FEB74A6C637DBDA23222E396C31AFB2963C82" +
      "2FD804EDF71B8CF29B65C400886BF8D48C23CE55AF854E3D27FBD590C2007709A44A8687E84991BA6EF7CC8CF92D0C622A78A6C2004B0EEFDF094A34B924EF32" +
      "183EA829DDC01A2E46009315BCABBAC74A813C6F9B1F85794AF8201B2E1EBA792B34704EB80EE95DEC052871AAF342037E8E34CB0C7A8EB0E4C4D67C965D50E2" +
      "975300D301B1030355C33024808BDE7962661014FD0390E3BC68A50948109BC44258F066E6CC991FC19EADCBECF325ACAA7B0FF22E761FE58DA74E202A5897AB" +
      "742699D9E3FD6BB631C11E0910BF38B65CE799C3E02DF76A9056987BD46697CB216CD51DEE65487628B52F920A659DCA5E0597405C3A69811DF128B8EF41B085" +
      "16BAC0B6554D26FB9A4BE98A249B37FD59071C789ADB2950C2EBFC8086B172D6C8A9EB2F0388503DFA5F4D68CE5A8DD0C6524D24AD0E743D76363BF8F328CBC7" +
      "B3714DD327CC60F195388EDF7771C1AEFC9F82402207B2774F04D7776D4F6933530C77CBCE495878CA6C6F234979CABA092359D87B9DCB6CF6655E7BDF43FE22" +
      "F1A3648607D457461B540F881668E583D360888224598E37F111281EB5E51317303F6C2BDBC6F05F64DAD6F064B74CA53BC6A440EBE89DBB0F28B50E3283A275" +
      "57A7FEB7109ED0F21C521EEB6EAD6DD67FA2A0C1656789194BBB58FCFA06D6062624F1CDFE6FA2879449013E3ED37DC68FA42CF7777C93878F4A660866327256" +
      "F3D2A6BA525937352B3B35B3D433EEDD26FC6DFA96533C0DE82B16F4E2C1E9A87734BE5C89AE708A93D9B696FDF77B0E6DCD97D61E91E9C2C7805460C7C76066" +
      "B96DF3DC12BC1D0927605DE8425868637564A975833AAB6EB1AC30041F13FB4FA0123481F25CEEB21FFA83DD8B69CEA0867DD801BC2E233FA28E450F609FD8DC" +
      "CFF6F95F1920381DC91B9F6919EF86FDB30E460C2C7A41C4C61FA3C42E2F2772C881CDCD7096A183CF4F1F31CD735C4097A127EF452A93CF585B966D8E90242D" +
      "5C2F197F5257BCEF3FBC1546E6202BB9B96A1CE7F9043F5019CB557547986146BC2412D9D938DA77ED25AE781B1C2DF348188C0E57A21338C276C820543BCB69" +
      "124C96DD142CD623B253D0728E2CB2F2B49DA3EA4BC6FBBDEF52B8BD8F31C98DEE765EB30371FCA25EF23A67281A85FA44C4DD54464473E84A55D3EB7223028F" +
      "C26CD0F02BE8F1DF150CE4C838737F39155058505077500EE2EEAC2283C81E29F7C7593951782E82D0CEE834A9842F4CABA19BC67212A8BBD173ED7FE699ECD2" +
      "C6FC9E1EAA6AFC1BF339AEBC828E1F16EAE056D662451E2B77FF4294FDA1A2C2C420350DA0C38C51E6B7D8C13A2798A5FDABD1A337831DCD95DD09D8293B66D7" +
      "900CCE2F6ADAA467A490320C717C953A23F1357716FB63A3815EF8C7E14580B6B907ABC10DC49E07B7053779C7D9B981E6D90B4EE5F8BFA9ED6E875949ACAB90" +
      "33682212B0036CDEB6B8F56D8E2E6830CC04F7C487EF73F889A4CA550E20ABF4DBDE755523C3F1C2A2E13D107974F041F1C8892AD1FC0DA92297772B9DAA33FE" +
      "6114B71C7C60D7FDF8C85C7F16196245AD03B1A3000789F138CD0B8FE5B0D55D83C0C58C76E7FC6162C1287BCA59E1F269EDB5171168B365E0A76D6E7FB24132" +
      "464240C81DB9831D37E3CF289133A1FE8E091198385C82E00112A5A5BFFFA07C8C1840C8D119FCC33F060E4989A8975BAAABC3F621960260A3A82C2DB0AA70C5" +
      "0369B365E54BC34693CC7AAD3B3F0C2F542D3C05AD11FD495B724CDE5FE58A601E7142D553C0E0C21DA8C82A8229C0416045365452D16B283D783A7BE04B6036" +
      "A5D7843F67D2F1139F5DABB06D536B00C47E2274912EB748DFDED800B6D6FFCA4A4303CAFAF0EA9A678A6874218D7358FF73550FCFE7FF7780B1B904952E8F36" +
      "4043B020AD5D8EC0010B60C36C640C04A20A60E1A9359E3B8D13D61B57B95E4D9E296E6F4F9F6F6C4694F6348E070C77204169C0888CB3C51F4D1F6BC7813B7D" +
      "A0CAD65856D23614A988D21D991396E4EFEEF2DC6A91ADBA18881BA9B4EAB65B694DF42472F4807A3DFEB8A8818DD161D4AD40CD56AE58B995909F11D74A53C2" +
      "66E582D1E5F7B2D8E4C5C86C9532CAC2FE3C5702B281A873AE37EB460937A5EEF9C27796CED7DBDFC6275E23EAE89A207717E44365EB70F59963F7F0C6EB97E4" +
      "B68E958A400B1F9A20A215C234317F05802127530ACC21075F2569BE2A2C00FD39DCE436ED21A84A993460ADE106A9F165B02540E3E6F9B08AF2793043EF5210" +
      "5007F2A90A448651435395FBB55EA798E4E646148EC4DE0C870BD6C0EF86971EEBEA670F1C1E2746CB910075ED2C8418154796422A7D6E9C019D5B00E202979E" +
      "66A34B4C4A049129534E648B655C60CA0630C2FEDB481E8EBE1CBA80D4FC4B0607C28112F8337592DD3C474530DD4950682E29F0E5AD4BDF65F1424C364DDDC5" +
      "964DF72DC25D25AD914C8E58DDDE8AAF92D9E6A515365F68A55D943C505CDCC510D0545C0D3185D6A6DC9E6D037E1A5858CA5270B5521F9D3AF75309C71FD4FE" +
      "30D94D7B7833886C8328A79BC928387F42E498D37851CBCCDE5B9A7877BE272F7E18F8F27308FF0A3DD8B0041A764E690BE6207052B52EA7DD0A01F4B68598A1" +
      "9AA4B92FC8C16813421D29DF5D2FB7F6D23BFD1F696A97DBD5EF939455A9DC9C953618FED6367B56C84E51969D25BB411321DF7E0FF894AFC000C8C734B31626" +
      "7144D846606230F09733C70AC217C544F4B40725683925F8D1E4AD7D964FB80090884A5E9D94E27E8864D9B9074C55CFD2C5CA8AE0D960D66E4DD7D2EB7070EA" +
      "9C996EFF520A8279FD346A105027338E07F43CB58729378430A580D2DE8B4A88D7086040F560E4802A90288D6E7ECD08F169075876BE15ED0E7B6E68A0AC4D4B" +
      "39E0B0453EEEA875F6B0293A6CD75CA92FA0A8BCAB0F341F151F09052D450CC8438E829E0C9DDF65192003592CAF0EB81AA2EF3A66ADAE287D50966424916D98" +
      "7DD809A27E243790C62C7DEDBF51C09E017C70375394FA7B71CBE726C8203CD9899ED286B924C3E1322B058BC9DD73C482A7B73200DDA5C76A444A7E74275313" +
      "CCF52DAC3592AE0E36F3216AF8371D2F04A584D11FF96C48F315F05EBB2CB22A6B423057F150C9E0D547427CE93BB683DBF7059DADFC2BFA7264FC329A89622B" +
      "D0A6FF0E97F4CB8CCD4D424789BE20871C024282F6F353DA47FD60AD923C0B3BD85FFF88D04615ED761E15FDE6E972FA399E65ADADF098D09EBE13289AEC8628" +
      "A043058515CCFD068E09B8370EB26CD21A8C715EB2E9082B9B8ED73565837F2BD25703DCC974E3B440F878E1861ED5A0EF2799C8DD4E0654BC8447EFF224D678" +
      "8E2835CF793B077FE2F24199390B1E625B1E67CC5581F1A45AF495A0D38214B2284BECA31B950D785C84E4C3BA3B14EB58A7C50156638A03225499CEC3693FB4" +
      "2743C84E664BB25A6706C0ECB5190F00FBBFCF84A27206F69FD7A6712CE87EA92244CBEE358AB8759B8E55E3AE69F49A0F4B4393CE88706A1AEA88EEB456CCC2" +
      "F544C1F1CA71188D2869E3E2C2AC10247894986B579D05B4B0BAF40BE4009728791A53DF6B39002FD3A4F6AF2EFB3030ECD8B6A97E6849D94C671BC537F9A783" +
      "92D76031151DC64F117F46E6849D62431E0403AE3D1F37ED8414A4AE6DBF536FF28BC7E634CD40374447BB7D639F32C4458CFF2AC352CFC322226A73A6C19DF0" +
      "B561EEBC290CC2F3113DFF6D1AD595449C6D89ABC15FAB4D913D2AC110335395554D3540BAFA3B06A17640ADA5C0FEE93751CB39744BB3D3A3FBCF65AF27942D" +
      "1E406D797EF63B3A710BD00827465372F3B3CCB926F5BF72DD4C11F27F25C3BCD120D5273803A0D7A118C7C667D43C324C439101FEE4568E202249784120BCA7" +
      "8E8667B0F88B3B101851F15E909A0212925A1596D7EA5222BDB080140724511C6F7DF44E75FCC610EBB3F358C1F627A5051C99D69F6E91CFEADB2364FE48C435" +
      "C85F0087376F0420F6B9BD69FE163C580226F0F4E1D78173E711DC968E3A3585CFCE63C9CEABF26261D709FF33457D50C7B4C00C9A59073FF0FC50651E1DFAD0" +
      "06561342F05CD81444E2B12B6477F31EF16454E6F88E5C5D1BDB2ABDDBAB6825E086032316FEF96A29EA84D072525D3A6BCDA6738CECBB29E4D9B12CD6F44F36" +
      "59D0DEE78D56C72B33B1B5A837D8B51FFD0EC4A994D73BB37C27A4198360EB83F7A7B23D900225635241A6F0FE9F2F8B1C29133220BB9B7CF9B26D811423C540" +
      "A0FA3F0B5BDAAF976F87B6B18ACB63DF4516A2FF974B4EC4CE8ED13340D49B424CD879D8564909F528582AF1B1C17CCAA4963F59C72FB0B0CFE0D49F4C84DE8E" +
      "3329CABC754A9DF9BF138680F2368395A455E29045E0C66F96A6E473095705FB944FF921023B5B100F4CEA7BE69DB6E12C328B0D686E091A59C8A8A06D5017EE" +
      "B5A3C0A9AD878A02340CA9EBA1EF48AC526BC17511BBF71BB9D3AF56F65B7188A6B15D2725CEFA3648CEA3F0A932035EB5666F7BDAF09D59884EF032D2926E27" +
      "E462BB8CBD1A332362F2DB86F062B2610FAF7969BEB0FD21D69BFBDE902DF219D666800B1824B4D8D824DB11DF06C460DD0452A01D5D48FDA3B843011F6714EA" +
      "CD3B8226F950E59AF4D241AA9AF683D470B73CCBF4A385FE96A6664A99BD38A4356805B586B15E2CDDF01EB9B145A4AF203E78C4E7B2CF41A824F5639801556F" +
      "658A470EC2FD17BF4DC3D5C8885F045EE01B765B24501AE947B802A46050E4406EF21B62F840FE274DE72E703BD2B31299AD31B464122D72A71E498EEBB26749" +
      "62B44C9D3E7F509AB55F74D3F33E43E7E76F98915FA2EA9AED3A4551B9335E9BEEA18FB41879A8DAA0EBFCD3A6DDBC7F4D7BACA0349503F18BAAD4D28C49DD76" +
      "BDAC560A062BDB1C50D1FC116188BB3EF9160B039650EC130CF3A3834F49799D2B88B835D7CB2A98F53AF576762131719CCDB35B6A6FB1D6FA93B1D548C992CC" +
      "4CCD08280522990AE8A0B28D230A24212F1C56A04B4F908E9A9140A14A4E1C418F1F931D9FDFC3BF5A2DC50C3025DFB0FE303EFC80F12E9C6D107B988AB218D6" +
      "EE07B20BDC2656E04819CC863DFF51C6FF6659B60BBD139ACB18D949FEE5A91A17C8859AC4C2C8479F094B13AEDFDE8AF6A2FB1FF8869C53D1583D55A512E0A2" +
      "3270CF1E9BA358A2CD340A5D498FF9B5D3ADE353B2D68A76924730102462F86A6BCED9FDCAF7C49437DFA96ED2684AC7505623C8579AB7107B130934CD62F56E" +
      "0CA569CF8F25F309A1D1B61AA4442A798058AAB8B1406A66E4A0257BEB60D7002D4C02EE534D9EB37F31D8830C852C7FD3D9BFB8407602966E743513DA9AB000" +
      "8B287C7B4B1354D49657C2CDAC2529B1C7590F6D00F7708A7485FF94258E7A935A66404DD1664C0DE1386E948C9BD712F362C2014BD532A568B64FD844CCB75C" +
      "293A6C31CD67F5A05D39719F440A1139FB43DEC31DDBCB74738722BF6CE9CF7FB0C9AC753D8932AD861A478CDEA704E6B836106F73869E6ABCDC3A192558D9FE" +
      "36CA78798A48526976191CDC06961BBF42C3AB2C3FBBC241E2C7AEA36CA1EA4F718D2635AB21E140667F3907AE09731415F2C45DAD75131EF34AAD32CA7E80D9" +
      "7FBE9D7F83D25F4F1EA69C3901DF9C84F9B66732AE92DA6244B2E7CBAC2CC0905F5F7C0F2775B2AA48B12A31E6DE2DA2D4ADF5F89D9F1A184C5A79514853D4C1" +
      "5F0467605FCFE7D03281B95571607CFDEBFDEA2E945177C4F10CA45605CF308C38E8D673D8143A3D5B052F25BAFA544F2ECA7E975A8B8DFCD9D98B254927985D" +
      "542D293BB7002EF1F60581D28D1B84C9220727363415DB5CFCF179FFBE69B5DC30E6DCC3D42BA8F82C98CA21FD6B87C3B87176BCD403C5285DDF704EA3E1B39B" +
      "5EF745B0234CFFE409E4DB50B8A8831E3947BC6D79F774FFCABA0660F82331FF876DE3BFC3D895C5BB62CA7DE4FD0D296CAAF79F5A26350A9011FD0F48948C92" +
      "8A20BC49E1696CAFDBE9133390182722C228493793836415D7B666BBA15CC048AC12C8EFD82507700838F63A27AD94B1869B3FC01C5E9074BFC34F0D7D8519DB" +
      "825D046AE81A4626F0F22CBD4A81552E4238930D94B14924129E84D3EA888451D6C1558419E405E26768DE986CCE2349AD389B6AF5A3B9BABDCE90E95A513D4A" +
      "CD8F6D6208A775DCEA4C5E6C02C30BA0C02FE5FDD2F51F10243AB5AC75F008E6AE2B167B1A3C15658BE083E9C855D3836AEE384D9DE1D862F98C68ECC28EB2D8" +
      "E22536CAA49A161D77BFA8D96902CC7F333B8309FC5335FCC5AAA1056967EAB2E9BFAB5818CF9667543DB00BF4F44864CDC183188380C1AD9E0560CBA9DE1FD4" +
      "2AF209D0A79FAC01EAC04572E8D935BB0F2119228C7BCB95F100F189C8CAD37EDF188568E1F2EF1E375ED51EF77DC26D4FE8D4CA6B3804FB52E7F5AB04545E36" +
      "AF38E494AA240E10A4A6D66DA5F6957E2A70AF3069D3F7403E53C9C10FFA109D3A0895903923A947D396667D5E50CB550C1F3C23810160F08F8D8E50B9B13212" +
      "271B");
  const KATL5_SS = OpCodes.Hex8ToBytes("E1E29C8D115DCBE54EB4416E012F74AB61D9C7D63E8C3188CC97C27E39518E0B");

  const VECTORS = [
    {
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to public key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l1',
      keyGenerationOutput: 'publicKey',
      input: KATL1_SEED,
      expected: KATL1_PK
    },
    {
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to secret key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l1',
      keyGenerationOutput: 'privateKey',
      input: KATL1_SEED,
      expected: KATL1_SK
    },
    {
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to ciphertext",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l1',
      keyGenerationOutput: 'ciphertext',
      input: KATL1_SEED,
      expected: KATL1_CT
    },
    {
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to encapsulated shared secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l1',
      keyGenerationOutput: 'sharedSecret',
      input: KATL1_SEED,
      expected: KATL1_SS
    },
    {
      // Drives the Black-Gray-Flip decoder, which no other direction reaches.
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: decapsulating its own ciphertext returns the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l1',
      keyGenerationOutput: 'decapsulatedSecret',
      input: KATL1_SEED,
      expected: KATL1_SS
    },
    {
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: decapsulation of the published ciphertext under the published secret key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      inverse: true,
      privateKey: KATL1_SK,
      input: KATL1_CT,
      expected: KATL1_SS
    },
    {
      // Setting sharedSecret turns the result into a verdict, so that the
      // rejection cases below can assert a mismatch without naming the value
      // the rejection branch produces.
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: the recovered secret is the published one",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      inverse: true,
      privateKey: KATL1_SK,
      sharedSecret: KATL1_SS,
      input: KATL1_CT,
      expected: [1]
    },
    {
      // One bit of the ciphertext flipped. BIKE answers a ciphertext it did not
      // produce with a secret derived from the secret key's own rejection seed
      // rather than an error, so the property to assert is that the published
      // secret does not come back.
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: a modified ciphertext must not decapsulate to the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      inverse: true,
      privateKey: KATL1_SK,
      sharedSecret: KATL1_SS,
      input: KATL1_CT_CORRUPTED,
      expected: [0]
    },
    {
      text: "BIKE-L1 PQCkemKAT_BIKE_3114.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      inverse: true,
      privateKey: KATL1_SK_OTHER,
      sharedSecret: KATL1_SS,
      input: KATL1_CT,
      expected: [0]
    },
    {
      text: "BIKE-L3 PQCkemKAT_BIKE_6198.rsp record 0: seed to public key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l3',
      keyGenerationOutput: 'publicKey',
      input: KATL3_SEED,
      expected: KATL3_PK
    },
    {
      // The shared secret is a hash of the message and the whole ciphertext, so
      // agreeing on it pins the ciphertext as well.
      text: "BIKE-L3 PQCkemKAT_BIKE_6198.rsp record 0: seed to encapsulated shared secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l3',
      keyGenerationOutput: 'sharedSecret',
      input: KATL3_SEED,
      expected: KATL3_SS
    },
    {
      text: "BIKE-L3 PQCkemKAT_BIKE_6198.rsp record 0: decapsulating its own ciphertext returns the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l3',
      keyGenerationOutput: 'decapsulatedSecret',
      input: KATL3_SEED,
      expected: KATL3_SS
    },
    {
      text: "BIKE-L5 PQCkemKAT_BIKE_10276.rsp record 0: seed to public key",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l5',
      keyGenerationOutput: 'publicKey',
      input: KATL5_SEED,
      expected: KATL5_PK
    },
    {
      text: "BIKE-L5 PQCkemKAT_BIKE_10276.rsp record 0: seed to encapsulated shared secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l5',
      keyGenerationOutput: 'sharedSecret',
      input: KATL5_SEED,
      expected: KATL5_SS
    },
    {
      text: "BIKE-L5 PQCkemKAT_BIKE_10276.rsp record 0: decapsulating its own ciphertext returns the published secret",
      uri: "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip",
      keyGeneration: true,
      parameterSet: 'bike-l5',
      keyGenerationOutput: 'decapsulatedSecret',
      input: KATL5_SEED,
      expected: KATL5_SS
    }
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class BIKECipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BIKE";
      this.description = "Bit Flipping Key Encapsulation, the QC-MDPC code-based KEM submitted to round 4 of the NIST post-quantum process. The secret is a pair of sparse circulants over GF(2)[x]/(x^r - 1) and the public key is their quotient, so a ciphertext is the syndrome of a low weight error vector that only the sparse parity checks make decodable. Decapsulation runs the Black-Gray-Flip bit flipping decoder. All three round 4 parameter sets are implemented and verified against the submission's own Known Answer Tests.";
      this.inventor = "Nicolas Aragon, Paulo Barreto, Slim Bettaieb, Loic Bidoux, Olivier Blazy, Jean-Christophe Deneuville, Philippe Gaborit, Shay Gueron, Tim Gueneysu, Carlos Aguilar Melchor, Rafael Misoczki, Edoardo Persichetti, Nicolas Sendrier, Jean-Pierre Tillich, Valentin Vasseur, Gilles Zemor";
      this.year = 2017;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Post-Quantum Key Encapsulation";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(128, 128, 0), // bike-l1
        new KeySize(192, 192, 0), // bike-l3
        new KeySize(256, 256, 0)  // bike-l5
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("BIKE Official Site", "https://bikesuite.org/"),
        new LinkItem("BIKE Round 4 Specification", "https://bikesuite.org/files/v5.0/BIKE_Spec.2022.10.10.1.pdf"),
        new LinkItem("QC-MDPC McEliece", "https://eprint.iacr.org/2012/409"),
        new LinkItem("NIST Post-Quantum Cryptography", "https://csrc.nist.gov/projects/post-quantum-cryptography")
      ];

      this.references = [
        new LinkItem("BIKE Round 4 Submission Package and Known Answer Tests", "https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip"),
        new LinkItem("BIKE Additional Implementation", "https://github.com/awslabs/bike-kem"),
        new LinkItem("Drucker, Gueron and Kostic, QC-MDPC Decoders with Several Shades of Gray", "https://eprint.iacr.org/2019/1423")
      ];

      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability(
          "Decoding failure attacks",
          "The decoder can fail, and which ciphertexts it fails on leaks information about the secret circulants, which recovers the key over many queries (Guo, Johansson and Stankovski, GJS).",
          "Use the parameter sets as published, whose decoding failure rate is below 2^-128, and never reuse a key pair across a ciphertext that failed to decode."),
        new AlgorithmFramework.Vulnerability(
          "Timing side channels",
          "This implementation is written for clarity: the decoder branches on syndrome bits and the sampler on collisions, so its running time depends on secret data.",
          "Not for use where an attacker can measure execution time.")
      ];

      this.tests = VECTORS;
    }

    /**
     * Create new algorithm instance
     * @param {boolean} [isInverse=false] - true for decapsulation
     * @returns {object} New instance
     */
    CreateInstance(isInverse = false) {
      return new BIKEInstance(this, isInverse);
    }
  }

  /**
   * BIKE instance implementing the Feed/Result pattern.
   *
   * A key encapsulation mechanism has three operations rather than two, so the
   * one that runs is selected by which properties are present:
   *
   *   keyGeneration     Feed the 48 octet seed of a Known Answer Test record.
   *                     Result is the public key, the secret key, the
   *                     ciphertext, the encapsulated shared secret or the
   *                     decapsulated shared secret, as keyGenerationOutput says
   *   forward direction Feed the 32 octet message. Result is the ciphertext or
   *                     the shared secret, as encapsulationOutput says
   *   inverse direction Feed the ciphertext. Result is the shared secret, or
   *                     [1] / [0] when sharedSecret says what to compare it to
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class BIKEInstance extends IAlgorithmInstance {
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
      this._parameterSet = PARAMETER_SETS['bike-l1'];
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
      if (!found) throw new Error('Unknown BIKE parameter set: ' + label);
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
        throw new Error('A BIKE public key is 1541, 3083 or 5122 bytes, got ' + keyBytes.length);

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
        throw new Error('A BIKE secret key is 3114, 6198 or 10276 bytes, got ' + keyBytes.length);

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
        throw new Error('Invalid BIKE key data format');

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
          throw new Error('BIKE decapsulation needs a secret key');

        const recovered = Decapsulate(this._parameterSet, input, this._privateKey);
        if (!this._sharedSecret) return recovered;
        return [OpCodes.SecureCompare(recovered, this._sharedSecret) ? 1 : 0];
      }

      if (!this._publicKey)
        throw new Error('BIKE encapsulation needs a public key');

      const set = this._parameterSet;
      if (input.length < set.messageSize)
        throw new Error('BIKE encapsulation needs a ' + set.messageSize + ' byte message, got ' + input.length);

      const encapsulated = Encapsulate(set, this._publicKey, input.slice(0, set.messageSize));
      return this.encapsulationOutput === 'sharedSecret'
        ? encapsulated.sharedSecret
        : encapsulated.ciphertext;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BIKECipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BIKECipher, BIKEInstance };
}));
