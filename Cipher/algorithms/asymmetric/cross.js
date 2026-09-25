/*
 * CROSS - Codes and Restricted Objects Signature Scheme
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CROSS is a zero-knowledge identification scheme over the restricted
 * syndrome decoding problem, turned into a signature with the Fiat-Shamir
 * transform. The secret is a vector e whose entries all lie in a small
 * multiplicative subgroup E of F_p (the "restricted" objects); the public key is
 * its syndrome s = e H^T under a random parity-check matrix H expanded from a
 * seed. Each of the t rounds commits to a masked copy of e, a challenge from
 * F_p* mixes it with a random vector, and a second, fixed-weight challenge
 * decides round by round whether the prover opens the seed or the response.
 * Seeds are delivered through a seed tree and commitments through a Merkle
 * tree, except in the fast corner, which sends them flat.
 *
 * This file follows the round-two submission to the NIST call for additional
 * signatures (specification version 2.0, February 2025), all eighteen of its
 * parameter sets: the RSDP problem over F_127 with E of order 7 and the RSDP(G)
 * problem over F_509 with E of order 127, each at security category 1, 3 and 5
 * and each in the fast, balanced and small corner.
 *
 * WHAT THE KNOWN ANSWER TESTS ARE, AND HOW THEY WERE CHECKED
 *
 * The round-two package does not ship its response files. It ships the
 * generator and, in KAT/sha_512_sum_KATs, the SHA-512 of every request and
 * response file it produced, 36 digests. The CROSS generator differs from the
 * stock NIST one in one respect that matters here: the randomness the scheme
 * consumes does not come from the AES-256 CTR_DRBG. The DRBG still draws the
 * seed and message of each record, but key generation and signing read from a
 * single SHAKE stream (SHAKE128 at category 1, SHAKE256 above) that is seeded
 * once with the octets 0, 1, ..., 47 and a zero domain separator and then runs
 * through all hundred records: each record takes 2L/8 octets of secret seed,
 * then L/8 octets of root seed, then 2L/8 octets of salt, L being the security
 * level. So record `count` starts 5L/8 * count octets into that stream. The
 * katCount property replays exactly that.
 *
 * Every one of the eighteen response files was rebuilt, all hundred records,
 * and all eighteen reproduce their published SHA-512 digest, as do all
 * eighteen request files: 36 of 36, 1800 of 1800 records. The vectors below
 * are records of those files. What is committed is therefore pinned by a
 * digest the submitters published, not by this code.
 *
 * API
 *
 * The key is the secret key of the submission, the 2L/8 octet key-pair seed.
 * The forward direction is crypto_sign: it consumes a message and returns the
 * signed message, the message followed by the signature. The inverse direction
 * is crypto_sign_open: it returns the message a signed message carries and
 * throws when the signature does not verify, or, when a `message` is set,
 * returns the verdict [1] or [0] instead. The public key is derived from the
 * secret key on demand and can be set on its own to verify without one.
 *
 * Signing without katCount does not draw from any external source, so that the
 * same message always signs the same way: the root seed and the salt are taken
 * from SHAKE over the secret key and the message. That derivation is this
 * file's own, not the submission's (which calls randombytes); it never reuses
 * a salt for two different messages, which is the property the scheme needs.
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

  // ===== Keccak-f[1600] and SHAKE =====
  //
  // CROSS hashes and expands with SHAKE throughout, and reads the output of
  // several expansions a few octets at a time across successive calls, so the
  // sponge is kept here with an incremental absorb and squeeze. The state is 25
  // lanes held as pairs of 32 bit halves, low half first.

  const RC_LOW = [
    0x00000001, 0x00008082, 0x0000808A, 0x80008000, 0x0000808B, 0x80000001,
    0x80008081, 0x00008009, 0x0000008A, 0x00000088, 0x80008009, 0x8000000A,
    0x8000808B, 0x0000008B, 0x00008089, 0x00008003, 0x00008002, 0x00000080,
    0x0000800A, 0x8000000A, 0x80008081, 0x00008080, 0x80000001, 0x80008008
  ];
  const RC_HIGH = [
    0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000,
    0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000
  ];
  const RHO = [
     0,  1, 62, 28, 27, 36, 44,  6, 55, 20,  3, 10, 43,
    25, 39, 41, 45, 15, 21,  8, 18,  2, 61, 56, 14
  ];
  // Where the pi step moves lane x + 5y: to y + 5((2x + 3y) mod 5).
  const PI_TARGET = (function () {
    const t = new Array(25);
    for (let x = 0; x < 5; ++x)
      for (let y = 0; y < 5; ++y)
        t[x + 5 * y] = y + 5 * ((2 * x + 3 * y) % 5);
    return t;
  })();

  const kB = new Int32Array(50);
  const kC = new Int32Array(10);

  function KeccakF(s) {
    const Xor = OpCodes.Xor32, Or = OpCodes.Or32, And = OpCodes.And32, Not = OpCodes.Not32;
    const Shl = OpCodes.Shl32, Shr = OpCodes.Shr32;
    const b = kB, c = kC;

    for (let round = 0; round < 24; ++round) {
      // theta
      for (let x = 0; x < 5; ++x) {
        const i = 2 * x;
        c[i] = Xor(Xor(Xor(s[i], s[i + 10]), Xor(s[i + 20], s[i + 30])), s[i + 40]);
        c[i + 1] = Xor(Xor(Xor(s[i + 1], s[i + 11]), Xor(s[i + 21], s[i + 31])), s[i + 41]);
      }
      for (let x = 0; x < 5; ++x) {
        const n = 2 * ((x + 1) % 5), p = 2 * ((x + 4) % 5);
        const dl = Xor(c[p], Or(Shl(c[n], 1), Shr(c[n + 1], 31)));
        const dh = Xor(c[p + 1], Or(Shl(c[n + 1], 1), Shr(c[n], 31)));
        for (let y = 0; y < 25; y += 5) {
          const i = 2 * (x + y);
          s[i] = Xor(s[i], dl);
          s[i + 1] = Xor(s[i + 1], dh);
        }
      }
      // rho and pi
      for (let i = 0; i < 25; ++i) {
        const r = RHO[i];
        const lo = s[2 * i], hi = s[2 * i + 1];
        const t = 2 * PI_TARGET[i];
        if (r === 0) {
          b[t] = lo; b[t + 1] = hi;
        } else if (r < 32) {
          b[t] = Or(Shl(lo, r), Shr(hi, 32 - r));
          b[t + 1] = Or(Shl(hi, r), Shr(lo, 32 - r));
        } else if (r === 32) {
          b[t] = hi; b[t + 1] = lo;
        } else {
          const q = r - 32;
          b[t] = Or(Shl(hi, q), Shr(lo, 32 - q));
          b[t + 1] = Or(Shl(lo, q), Shr(hi, 32 - q));
        }
      }
      // chi
      for (let y = 0; y < 25; y += 5) {
        for (let x = 0; x < 5; ++x) {
          const i = 2 * (x + y), n = 2 * ((x + 1) % 5 + y), a = 2 * ((x + 2) % 5 + y);
          s[i] = Xor(b[i], And(Not(b[n]), b[a]));
          s[i + 1] = Xor(b[i + 1], And(Not(b[n + 1]), b[a + 1]));
        }
      }
      // iota
      s[0] = Xor(s[0], RC_LOW[round]);
      s[1] = Xor(s[1], RC_HIGH[round]);
    }
  }

  // The word of the state and the bit offset in it that hold octet i of a
  // block: lane i/8, low half for octets 0-3 of the lane, high for 4-7.
  const OCTET_WORD = new Uint8Array(200);
  const OCTET_SHIFT = new Uint8Array(200);
  for (let i = 0; i < 200; ++i) {
    OCTET_WORD[i] = 2 * Math.floor(i / 8) + (i % 8 >= 4 ? 1 : 0);
    OCTET_SHIFT[i] = 8 * (i % 4);
  }

  /**
   * An incremental SHAKE: absorb any number of times, then squeeze any number
   * of times, the squeezed octets forming one continuous stream.
   * @param {number} rate - 168 for SHAKE128, 136 for SHAKE256
   */
  function Shake(rate) {
    this.rate = rate;
    this.state = new Int32Array(50);
    this.pos = 0;
    this.squeezing = false;
  }

  Shake.prototype.absorb = function (data, offset, length) {
    const s = this.state, rate = this.rate;
    const start = offset || 0;
    const end = start + (length === undefined ? data.length - start : length);
    let pos = this.pos;
    for (let i = start; i < end; ++i) {
      const w = OCTET_WORD[pos];
      s[w] = OpCodes.Xor32(s[w], OpCodes.Shl32(data[i], OCTET_SHIFT[pos]));
      if (++pos === rate) {
        KeccakF(s);
        pos = 0;
      }
    }
    this.pos = pos;
    return this;
  };

  Shake.prototype.finalize = function () {
    const s = this.state;
    let w = OCTET_WORD[this.pos];
    s[w] = OpCodes.Xor32(s[w], OpCodes.Shl32(0x1F, OCTET_SHIFT[this.pos]));
    w = OCTET_WORD[this.rate - 1];
    s[w] = OpCodes.Xor32(s[w], OpCodes.Shl32(0x80, OCTET_SHIFT[this.rate - 1]));
    KeccakF(s);
    this.pos = 0;
    this.squeezing = true;
    return this;
  };

  Shake.prototype.squeezeInto = function (out, offset, length) {
    const s = this.state, rate = this.rate;
    let pos = this.pos;
    for (let i = 0; i < length; ++i) {
      if (pos === rate) {
        KeccakF(s);
        pos = 0;
      }
      out[offset + i] = OpCodes.And32(OpCodes.Shr32(s[OCTET_WORD[pos]], OCTET_SHIFT[pos]), 0xFF);
      ++pos;
    }
    this.pos = pos;
  };

  Shake.prototype.squeeze = function (length) {
    const out = new Uint8Array(length);
    this.squeezeInto(out, 0, length);
    return out;
  };

  // ===== the NIST generator, for the harness messages only =====
  //
  // The KAT generator draws each record's seed and message from the AES-256
  // CTR_DRBG of the NIST harness. CROSS itself never reads from it, so it is
  // only exported here, for anyone rebuilding the request file; the vectors
  // carry their messages as published. AES is borrowed from the collection
  // and loaded on first use, never at module scope.

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
      throw new Error('the NIST harness generator needs AES, which is not registered');
    return aesAlgorithm;
  }

  function Aes256Ecb(key, block) {
    const instance = FindAes().CreateInstance(false);
    instance.key = Array.from(key);
    instance.Feed(Array.from(block));
    return instance.Result();
  }

  function IncrementCounter(v) {
    for (let j = 15; j >= 0; --j) {
      if (v[j] === 0xFF) v[j] = 0;
      else { v[j] = v[j] + 1; break; }
    }
  }

  /**
   * The AES-256 CTR_DRBG of the NIST harness, seeded as randombytes_init is.
   * @param {uint8[]} entropy - 48 octets
   * @returns {object} a reader with read(count)
   */
  function NistDrbg(entropy) {
    const key = new Uint8Array(32);
    const v = new Uint8Array(16);
    const update = function (provided) {
      const temp = new Uint8Array(48);
      for (let i = 0; i < 3; ++i) {
        IncrementCounter(v);
        const block = Aes256Ecb(key, v);
        for (let j = 0; j < 16; ++j) temp[16 * i + j] = block[j];
      }
      if (provided)
        for (let i = 0; i < 48; ++i) temp[i] = OpCodes.Xor32(temp[i], provided[i]);
      for (let i = 0; i < 32; ++i) key[i] = temp[i];
      for (let i = 0; i < 16; ++i) v[i] = temp[32 + i];
    };
    update(entropy);
    return {
      read: function (count) {
        const out = new Uint8Array(count);
        let produced = 0;
        while (produced < count) {
          IncrementCounter(v);
          const block = Aes256Ecb(key, v);
          for (let j = 0; j < 16 && produced < count; ++j) out[produced++] = block[j];
        }
        update(null);
        return out;
      }
    };
  }

  // ===== parameter sets =====
  //
  // The eighteen sets of parameters.h, with the derived constants the
  // submission computes with compute_derived_parameters.py: the shape of the
  // truncated seed and Merkle trees, and how many bits each rejection sampler
  // draws in one go. The bit counts are part of the specification rather than
  // a tuning choice: each sampler reads exactly that many octets from its
  // stream, and whatever reads the stream next depends on it.

  const TREE = {
    'RSDP-1-fast':      null,
    'RSDP-1-balanced':  [[0,0,0,0,0,0,0,0,0], [1,2,4,8,16,32,64,128,256], [0,0,0,0,0,0,0,0,256], [255], [256], 108],
    'RSDP-1-small':     [[0,0,0,0,0,16,16,16,16,16,16], [1,2,4,8,16,16,32,64,128,256,512], [0,0,0,0,8,0,0,0,0,0,512], [527,23], [512,8], 129],
    'RSDP-3-fast':      null,
    'RSDP-3-balanced':  [[0,0,0,0,0,0,0,0,0,256], [1,2,4,8,16,32,64,128,256,256], [0,0,0,0,0,0,0,0,128,256], [511,383], [256,128], 165],
    'RSDP-3-small':     [[0,0,0,0,0,8,8,8,8,136,136], [1,2,4,8,16,24,48,96,192,256,512], [0,0,0,0,4,0,0,0,64,0,512], [647,327,27], [512,64,4], 184],
    'RSDP-5-fast':      null,
    'RSDP-5-balanced':  [[0,0,0,0,0,0,0,0,0,0], [1,2,4,8,16,32,64,128,256,512], [0,0,0,0,0,0,0,0,0,512], [511], [512], 220],
    'RSDP-5-small':     [[0,0,0,0,0,0,0,0,0,128,128], [1,2,4,8,16,32,64,128,256,384,768], [0,0,0,0,0,0,0,0,64,0,768], [895,447], [768,64], 251],
    'RSDPG-1-fast':     null,
    'RSDPG-1-balanced': [[0,0,0,0,0,0,0,0,0], [1,2,4,8,16,32,64,128,256], [0,0,0,0,0,0,0,0,256], [255], [256], 101],
    'RSDPG-1-small':    [[0,0,0,0,0,0,0,0,0,0], [1,2,4,8,16,32,64,128,256,512], [0,0,0,0,0,0,0,0,0,512], [511], [512], 117],
    'RSDPG-3-fast':     null,
    'RSDPG-3-balanced': [[0,0,0,0,0,8,24,24,24,24], [1,2,4,8,16,24,32,64,128,256], [0,0,0,0,4,8,0,0,0,256], [279,47,27], [256,8,4], 138],
    'RSDPG-3-small':    [[0,0,0,0,0,0,0,0,0,0], [1,2,4,8,16,32,64,128,256,512], [0,0,0,0,0,0,0,0,0,512], [511], [512], 165],
    'RSDPG-5-fast':     null,
    'RSDPG-5-balanced': [[0,0,0,0,0,0,8,8,8,200], [1,2,4,8,16,32,56,112,224,256], [0,0,0,0,0,4,0,0,96,256], [455,359,59], [256,96,4], 185],
    'RSDPG-5-small':    [[0,0,0,0,4,4,4,4,4,4,260], [1,2,4,8,12,24,48,96,192,384,512], [0,0,0,2,0,0,0,0,0,128,512], [771,643,13], [512,128,2], 220]
  };

  // [lambda, n, k, m, t, w, bits for an F_p vector, for the F_p* challenge, for
  //  the matrix V, for the E vector (or E_G vector), for W (RSDP(G) only), for
  //  the fixed-weight string]
  const SETS = [
    ['RSDP-1-fast',      128, 127,  76,  0, 157,  82, 1127, 1421,  28028,  717,     0,  3656],
    ['RSDP-1-balanced',  128, 127,  76,  0, 256, 215, 1127, 2170,  28028,  717,     0,  4776],
    ['RSDP-1-small',     128, 127,  76,  0, 520, 488, 1127, 4130,  28028,  717,     0, 10390],
    ['RSDP-3-fast',      192, 187, 111,  0, 239, 125, 1673, 2163,  60711, 1065,     0,  5264],
    ['RSDP-3-balanced',  192, 187, 111,  0, 384, 321, 1673, 3255,  60711, 1065,     0,  8586],
    ['RSDP-3-small',     192, 187, 111,  0, 580, 527, 1673, 4718,  60711, 1065,     0, 12880],
    ['RSDP-5-fast',      256, 251, 150,  0, 321, 167, 2247, 2905, 108689, 1431,     0,  8343],
    ['RSDP-5-balanced',  256, 251, 150,  0, 512, 427, 2247, 4347, 108689, 1431,     0, 10746],
    ['RSDP-5-small',     256, 251, 150,  0, 832, 762, 2247, 6734, 108689, 1431,     0, 18150],
    ['RSDPG-1-fast',     128,  55,  36, 25, 147,  76,  729, 1647,   6624,  343,  5677,  3472],
    ['RSDPG-1-balanced', 128,  55,  36, 25, 256, 220,  729, 2682,   6624,  343,  5677,  4776],
    ['RSDPG-1-small',    128,  55,  36, 25, 512, 484,  729, 5085,   6624,  343,  5677,  9153],
    ['RSDPG-3-fast',     192,  79,  48, 40, 224, 119, 1071, 2502,  14211,  539, 11655,  5128],
    ['RSDPG-3-balanced', 192,  79,  48, 40, 268, 196, 1071, 2925,  14211,  539, 11655,  6444],
    ['RSDPG-3-small',    192,  79,  48, 40, 512, 463, 1071, 5238,  14211,  539, 11655,  9981],
    ['RSDPG-5-fast',     256, 106,  69, 48, 300, 153, 1431, 3357,  24192,  679, 20594,  7929],
    ['RSDPG-5-balanced', 256, 106,  69, 48, 356, 258, 1431, 3897,  24192,  679, 20594,  8937],
    ['RSDPG-5-small',    256, 106,  69, 48, 642, 575, 1431, 6597,  24192,  679, 20594, 15140]
  ];

  function BitLength(v) {
    let bits = 0;
    while (v > 0) { v = Math.floor(v / 2); ++bits; }
    return bits === 0 ? 1 : bits;
  }

  function PackedSize(count, bits) {
    return Math.ceil(count * bits / 8);
  }

  function BuildParams(row) {
    const key = row[0];
    const g = key.indexOf('RSDPG') === 0;
    const p = {
      key: key,
      name: 'CROSS-' + (g ? 'RSDPG' : 'RSDP') + '-' + row[1] + '-' + key.split('-')[2],
      rsdpg: g,
      lambda: row[1], n: row[2], k: row[3], m: row[4], t: row[5], w: row[6],
      bitsFpVec: row[7], bitsChall1: row[8], bitsV: row[9], bitsFz: row[10], bitsW: row[11], bitsCw: row[12],
      P: g ? 509 : 127,
      Z: g ? 127 : 7,
      G: g ? 16 : 2
    };
    p.fast = TREE[key] === null;
    p.tree = TREE[key];
    p.rate = p.lambda === 128 ? 168 : 136;
    p.seedBytes = p.lambda / 8;
    p.keySeedBytes = 2 * p.seedBytes;
    p.hashBytes = 2 * p.seedBytes;
    p.saltBytes = 2 * p.seedBytes;
    p.bitsP = BitLength(p.P - 1);
    p.bitsPm1 = BitLength(p.P - 2);
    p.bitsZ = BitLength(p.Z - 1);
    p.fpVecBytes = PackedSize(p.n, p.bitsP);
    p.fpSynBytes = PackedSize(p.n - p.k, p.bitsP);
    p.fzVecBytes = PackedSize(g ? p.m : p.n, p.bitsZ);
    p.log2t = BitLength(p.t - 1);
    p.nodesToStore = p.fast ? p.w : p.tree[5];
    p.pkBytes = p.keySeedBytes + p.fpSynBytes;
    p.skBytes = p.keySeedBytes;
    p.respBytes = p.fpVecBytes + p.fzVecBytes;
    p.offPath = 3 * p.hashBytes;
    p.offProof = p.offPath + p.nodesToStore * p.seedBytes;
    p.offResp1 = p.offProof + p.nodesToStore * p.hashBytes;
    p.offResp0 = p.offResp1 + (p.t - p.w) * p.hashBytes;
    p.sigBytes = p.offResp0 + (p.t - p.w) * p.respBytes;
    // Domain separators: the round counters take t values from 2t - 1, the
    // key and challenge expansions sit just above them.
    p.dscChall1 = 3 * p.t - 1;
    p.dscFixedWeight = 3 * p.t;
    p.dscSeedSk = 3 * p.t + 1;
    p.dscSeedPk = 3 * p.t + 2;
    p.dscSeedE = 3 * p.t + 3;
    p.gPow = new Uint16Array(p.Z + 1);
    let acc = 1;
    for (let i = 0; i <= p.Z; ++i) { p.gPow[i] = acc; acc = (acc * p.G) % p.P; }
    return p;
  }

  const PARAMETER_SETS = {};
  const SET_NAMES = [];
  for (let i = 0; i < SETS.length; ++i) {
    const p = BuildParams(SETS[i]);
    PARAMETER_SETS[p.name] = p;
    SET_NAMES.push(p.name);
  }

  const HASH_DSC = 32768;

  // ===== CSPRNG and hash =====

  function CsprngInit(p, parts, dsc) {
    const x = new Shake(p.rate);
    for (let i = 0; i < parts.length; ++i) x.absorb(parts[i]);
    x.absorb([dsc % 256, Math.floor(dsc / 256)]);
    return x.finalize();
  }

  function Hash(p, parts, dsc) {
    return CsprngInit(p, parts, dsc).squeeze(p.hashBytes);
  }

  // The samplers read the stream as one little-endian bit string, a few bits
  // per candidate, with the octets beyond the drawn buffer reading as zero.
  function ReadBits(buf, bitPos, count) {
    const idx = Math.floor(bitPos / 8);
    const len = buf.length;
    const x = (idx < len ? buf[idx] : 0)
            + (idx + 1 < len ? buf[idx + 1] : 0) * 256
            + (idx + 2 < len ? buf[idx + 2] : 0) * 65536;
    return Math.floor(x / Math.pow(2, bitPos % 8)) % Math.pow(2, count);
  }

  /**
   * Draw count values below bound, each from `bits` bits of a buffer of
   * ceil(bufferBits / 8) octets, rejecting out-of-range candidates.
   */
  function SampleUniform(state, count, bits, bound, bufferBits, plusOne) {
    const buf = state.squeeze(Math.ceil(bufferBits / 8));
    const out = new Uint16Array(count);
    let placed = 0, pos = 0;
    while (placed < count) {
      const v = ReadBits(buf, pos, bits) + (plusOne ? 1 : 0);
      pos += bits;
      if (v < bound) out[placed++] = v;
    }
    return out;
  }

  function SampleFpVec(p, state) { return SampleUniform(state, p.n, p.bitsP, p.P, p.bitsFpVec, false); }
  function SampleChall1(p, state) { return SampleUniform(state, p.t, p.bitsPm1, p.P, p.bitsChall1, true); }
  function SampleV(p, state) { return SampleUniform(state, p.k * (p.n - p.k), p.bitsP, p.P, p.bitsV, false); }
  function SampleFzVec(p, state) { return SampleUniform(state, p.rsdpg ? p.m : p.n, p.bitsZ, p.Z, p.bitsFz, false); }
  function SampleW(p, state) { return SampleUniform(state, p.m * (p.n - p.m), p.bitsZ, p.Z, p.bitsW, false); }

  /** The second challenge: t positions, exactly w of them ones, by Fisher-Yates. */
  function ExpandFixedWeight(p, digest) {
    const state = CsprngInit(p, [digest], p.dscFixedWeight);
    const buf = state.squeeze(Math.ceil(p.bitsCw / 8));
    const out = new Uint8Array(p.t);
    for (let i = 0; i < p.w; ++i) out[i] = 1;
    let pos = 0, curr = 0;
    while (curr < p.t) {
      const bits = BitLength(p.t - 1 - curr);
      const candidate = ReadBits(buf, pos, bits);
      pos += bits;
      if (candidate < p.t - curr) {
        const dest = curr + candidate;
        const tmp = out[curr]; out[curr] = out[dest]; out[dest] = tmp;
        ++curr;
      }
    }
    return out;
  }

  // ===== packing =====
  //
  // Vectors are packed as one little-endian bit string of fixed-width values,
  // padded with zero bits to a whole octet.

  function Pack(values, count, bits, out, offset) {
    const bytes = PackedSize(count, bits);
    for (let i = 0; i < bytes; ++i) out[offset + i] = 0;
    for (let i = 0; i < count; ++i) {
      const bitPos = i * bits;
      const idx = offset + Math.floor(bitPos / 8);
      const v = values[i] * Math.pow(2, bitPos % 8);
      out[idx] += v % 256;
      if (idx + 1 < offset + bytes) out[idx + 1] += Math.floor(v / 256) % 256;
      if (idx + 2 < offset + bytes) out[idx + 2] += Math.floor(v / 65536) % 256;
    }
  }

  /**
   * Unpack count values, returning them raw. The flag reports whether the
   * padding bits are zero, checked as the reference checks them: for the
   * 7 and 9 bit packings, and not at all for the 3 bit one, whose check in the
   * reference reduces to a constant.
   */
  function Unpack(src, offset, count, bits) {
    const bytes = PackedSize(count, bits);
    const buf = src.subarray ? src.subarray(offset, offset + bytes) : Uint8Array.from(src.slice(offset, offset + bytes));
    const out = new Uint16Array(count);
    for (let i = 0; i < count; ++i) out[i] = ReadBits(buf, i * bits, bits);
    let ok = true;
    const used = (count * bits) % 8;
    if (bits !== 3 && used !== 0)
      ok = Math.floor(buf[bytes - 1] / Math.pow(2, used)) === 0;
    return { values: out, ok: ok };
  }

  // ===== arithmetic =====

  /** s = e H^T for H = [V I], e given as F_p values. */
  function FpVecByMatrix(p, e, V) {
    const nk = p.n - p.k, P = p.P;
    const acc = new Float64Array(nk);
    for (let j = 0; j < nk; ++j) acc[j] = e[p.k + j];
    for (let i = 0; i < p.k; ++i) {
      const ei = e[i];
      if (ei === 0) continue;
      const row = i * nk;
      for (let j = 0; j < nk; ++j) acc[j] += ei * V[row + j];
    }
    const res = new Uint16Array(nk);
    for (let j = 0; j < nk; ++j) res[j] = acc[j] % P;
    return res;
  }

  /** The restricted vector e_G M_G for M_G = [W I], exponents modulo z. */
  function FzInfByMatrix(p, eG, W) {
    const nm = p.n - p.m, Z = p.Z;
    const res = new Uint16Array(p.n);
    const acc = new Float64Array(nm);
    for (let i = 0; i < p.m; ++i) {
      const ei = eG[i];
      if (ei === 0) continue;
      const row = i * nm;
      for (let j = 0; j < nm; ++j) acc[j] += ei * W[row + j];
    }
    for (let j = 0; j < nm; ++j) res[j] = acc[j] % Z;
    for (let i = 0; i < p.m; ++i) res[nm + i] = eG[i] % Z;
    return res;
  }

  function RestrToFp(p, e) {
    const out = new Uint16Array(e.length);
    for (let i = 0; i < e.length; ++i) out[i] = p.gPow[e[i] % p.Z];
    return out;
  }

  // ===== key expansion =====

  function ExpandPk(p, seedPk) {
    const state = CsprngInit(p, [seedPk], p.dscSeedPk);
    const W = p.rsdpg ? SampleW(p, state) : null;
    const V = SampleV(p, state);
    return { V: V, W: W };
  }

  function ExpandSk(p, seedSk) {
    const seeds = CsprngInit(p, [seedSk], p.dscSeedSk).squeeze(2 * p.keySeedBytes);
    const seedE = seeds.subarray(0, p.keySeedBytes);
    const seedPk = seeds.subarray(p.keySeedBytes, 2 * p.keySeedBytes);
    const mats = ExpandPk(p, seedPk);
    const stateE = CsprngInit(p, [seedE], p.dscSeedE);
    let eBar, eGBar = null;
    if (p.rsdpg) {
      eGBar = SampleFzVec(p, stateE);
      eBar = FzInfByMatrix(p, eGBar, mats.W);
    } else {
      eBar = SampleFzVec(p, stateE);
    }
    return { seedPk: seedPk, V: mats.V, W: mats.W, eBar: eBar, eGBar: eGBar };
  }

  /** crypto_sign_keypair from a key-pair seed: the public key. */
  function PublicKeyFromSeed(p, seedSk) {
    const sk = ExpandSk(p, seedSk);
    const s = FpVecByMatrix(p, RestrToFp(p, sk.eBar), sk.V);
    const pk = new Uint8Array(p.pkBytes);
    pk.set(sk.seedPk, 0);
    Pack(s, p.n - p.k, p.bitsP, pk, p.keySeedBytes);
    return pk;
  }

  // ===== trees =====

  function Parent(i) { return i % 2 ? (i - 1) / 2 : (i - 2) / 2; }
  function Sibling(i) { return i % 2 ? i + 1 : i - 1; }

  function LeafIndex(p) {
    const tr = p.tree, idx = new Uint16Array(p.t);
    let cnt = 0;
    for (let i = 0; i < tr[3].length; ++i)
      for (let j = 0; j < tr[4][i]; ++j) idx[cnt++] = tr[3][i] + j;
    return idx;
  }

  /** Round seeds of the fast corner, which has no tree. */
  function SeedLeavesFlat(p, rootSeed, salt) {
    const S = p.seedBytes, t = p.t;
    const quad = CsprngInit(p, [rootSeed, salt], 0).squeeze(4 * S);
    const rem = [t % 4 > 0 ? 1 : 0, t % 4 > 1 ? 1 : 0, t % 4 > 2 ? 1 : 0, 0];
    const quarter = Math.floor(t / 4);
    const seeds = new Uint8Array(t * S);
    let offset = 0;
    for (let i = 0; i < 4; ++i) {
      const st = CsprngInit(p, [quad.subarray(i * S, (i + 1) * S), salt], i + 1);
      st.squeezeInto(seeds, (quarter * i + offset) * S, (quarter + rem[i]) * S);
      offset += rem[i];
    }
    return seeds;
  }

  function GenSeedTree(p, rootSeed, salt) {
    const S = p.seedBytes, tr = p.tree;
    const off = tr[0], npl = tr[1], lpl = tr[2];
    const tree = new Uint8Array((2 * p.t - 1) * S);
    tree.set(rootSeed, 0);
    let start = 0;
    for (let level = 0; level < p.log2t; ++level) {
      for (let j = 0; j < npl[level] - lpl[level]; ++j) {
        const father = start + j;
        const left = 2 * father + 1 - off[level];
        CsprngInit(p, [tree.subarray(father * S, (father + 1) * S), salt], father)
          .squeezeInto(tree, left * S, 2 * S);
      }
      start += npl[level];
    }
    return tree;
  }

  function SeedLeavesFromTree(p, tree) {
    const S = p.seedBytes, idx = LeafIndex(p);
    const seeds = new Uint8Array(p.t * S);
    for (let i = 0; i < p.t; ++i) seeds.set(tree.subarray(idx[i] * S, (idx[i] + 1) * S), i * S);
    return seeds;
  }

  /** Flags of the seed tree nodes whose whole subtree is to be revealed. */
  function SeedsToPublish(p, chall2) {
    const tr = p.tree, off = tr[0], npl = tr[1];
    const flags = new Uint8Array(2 * p.t - 1);
    const idx = LeafIndex(p);
    for (let i = 0; i < p.t; ++i) flags[idx[i]] = chall2[i];
    let start = tr[3][0];
    for (let level = p.log2t; level > 0; --level) {
      for (let i = npl[level] - 2; i >= 0; i -= 2) {
        const cur = start + i;
        const parent = Parent(cur) + Math.floor(off[level - 1] / 2);
        flags[parent] = (flags[cur] === 1 && flags[Sibling(cur)] === 1) ? 1 : 0;
      }
      start -= npl[level - 1];
    }
    return flags;
  }

  function SeedPath(p, tree, chall2, sig, offset) {
    const S = p.seedBytes, tr = p.tree, off = tr[0], npl = tr[1];
    const flags = SeedsToPublish(p, chall2);
    let start = 1, published = 0;
    for (let level = 1; level <= p.log2t; ++level) {
      for (let j = 0; j < npl[level]; ++j) {
        const cur = start + j;
        const father = Parent(cur) + Math.floor(off[level - 1] / 2);
        if (flags[cur] === 1 && flags[father] === 0) {
          sig.set(tree.subarray(cur * S, (cur + 1) * S), offset + published * S);
          ++published;
        }
      }
      start += npl[level];
    }
  }

  /** Rebuild the round seeds a signature reveals; null if its padding is not zero. */
  function RebuildSeedTree(p, chall2, sig, offset, salt) {
    const S = p.seedBytes, tr = p.tree, off = tr[0], npl = tr[1], lpl = tr[2];
    const flags = SeedsToPublish(p, chall2);
    const tree = new Uint8Array((2 * p.t - 1) * S);
    let used = 0, start = 1;
    for (let level = 1; level <= p.log2t; ++level) {
      for (let j = 0; j < npl[level]; ++j) {
        const cur = start + j;
        const father = Parent(cur) + Math.floor(off[level - 1] / 2);
        const left = 2 * cur + 1 - off[level];
        if (flags[cur] === 1 && flags[father] === 0) {
          tree.set(sig.subarray(offset + used * S, offset + (used + 1) * S), cur * S);
          ++used;
        }
        if (flags[cur] === 1 && j < npl[level] - lpl[level]) {
          CsprngInit(p, [tree.subarray(cur * S, (cur + 1) * S), salt], cur)
            .squeezeInto(tree, left * S, 2 * S);
        }
      }
      start += npl[level];
    }
    let pad = 0;
    for (let i = used * S; i < p.nodesToStore * S; ++i) pad = OpCodes.Or32(pad, sig[offset + i]);
    return { seeds: SeedLeavesFromTree(p, tree), ok: pad === 0 };
  }

  function MerkleRootFlat(p, cmt0) {
    const H = p.hashBytes, t = p.t;
    const rem = [t % 4 > 0 ? 1 : 0, t % 4 > 1 ? 1 : 0, t % 4 > 2 ? 1 : 0, 0];
    const quarter = Math.floor(t / 4);
    const input = new Uint8Array(4 * H);
    let offset = 0;
    for (let i = 0; i < 4; ++i) {
      const from = (quarter * i + offset) * H;
      input.set(Hash(p, [cmt0.subarray(from, from + (quarter + rem[i]) * H)], HASH_DSC), i * H);
      offset += rem[i];
    }
    return Hash(p, [input], HASH_DSC);
  }

  function MerkleTree(p, cmt0) {
    const H = p.hashBytes, tr = p.tree, off = tr[0], npl = tr[1];
    const tree = new Uint8Array((2 * p.t - 1) * H);
    const idx = LeafIndex(p);
    for (let i = 0; i < p.t; ++i) tree.set(cmt0.subarray(i * H, (i + 1) * H), idx[i] * H);
    let start = tr[3][0];
    for (let level = p.log2t; level > 0; --level) {
      for (let i = npl[level] - 2; i >= 0; i -= 2) {
        const cur = start + i;
        const parent = Parent(cur) + Math.floor(off[level - 1] / 2);
        tree.set(Hash(p, [tree.subarray(cur * H, (cur + 2) * H)], HASH_DSC), parent * H);
      }
      start -= npl[level - 1];
    }
    return tree;
  }

  function MerkleProof(p, tree, chall2, sig, offset) {
    const H = p.hashBytes, tr = p.tree, off = tr[0], npl = tr[1];
    const flags = new Uint8Array(2 * p.t - 1);
    const idx = LeafIndex(p);
    for (let i = 0; i < p.t; ++i) if (chall2[i] === 0) flags[idx[i]] = 1;
    let start = tr[3][0], published = 0;
    for (let level = p.log2t; level > 0; --level) {
      for (let i = npl[level] - 2; i >= 0; i -= 2) {
        const cur = start + i, sib = Sibling(cur);
        const parent = Parent(cur) + Math.floor(off[level - 1] / 2);
        flags[parent] = (flags[cur] === 1 || flags[sib] === 1) ? 1 : 0;
        if (flags[cur] === 0 && flags[sib] === 1) {
          sig.set(tree.subarray(cur * H, (cur + 1) * H), offset + published * H);
          ++published;
        }
        if (flags[cur] === 1 && flags[sib] === 0) {
          sig.set(tree.subarray(sib * H, (sib + 1) * H), offset + published * H);
          ++published;
        }
      }
      start -= npl[level - 1];
    }
  }

  function MerkleRecompute(p, cmt0, chall2, sig, offset) {
    const H = p.hashBytes, tr = p.tree, off = tr[0], npl = tr[1];
    const tree = new Uint8Array((2 * p.t - 1) * H);
    const flags = new Uint8Array(2 * p.t - 1);
    const idx = LeafIndex(p);
    for (let i = 0; i < p.t; ++i) {
      tree.set(cmt0.subarray(i * H, (i + 1) * H), idx[i] * H);
      if (chall2[i] === 0) flags[idx[i]] = 1;
    }
    const input = new Uint8Array(2 * H);
    let start = tr[3][0], published = 0;
    for (let level = p.log2t; level > 0; --level) {
      for (let i = npl[level] - 2; i >= 0; i -= 2) {
        const cur = start + i, sib = Sibling(cur);
        const parent = Parent(cur) + Math.floor(off[level - 1] / 2);
        if (flags[cur] === 0 && flags[sib] === 0) continue;
        if (flags[cur] === 1) input.set(tree.subarray(cur * H, (cur + 1) * H), 0);
        else { input.set(sig.subarray(offset + published * H, offset + (published + 1) * H), 0); ++published; }
        if (flags[sib] === 1) input.set(tree.subarray(sib * H, (sib + 1) * H), H);
        else { input.set(sig.subarray(offset + published * H, offset + (published + 1) * H), H); ++published; }
        tree.set(Hash(p, [input], HASH_DSC), parent * H);
        flags[parent] = 1;
      }
      start -= npl[level - 1];
    }
    let pad = 0;
    for (let i = published * H; i < p.nodesToStore * H; ++i) pad = OpCodes.Or32(pad, sig[offset + i]);
    return { root: tree.subarray(0, H), ok: pad === 0 };
  }

  // ===== signing =====

  function Mod(a, m) { return ((a % m) + m) % m; }

  function FirstChallenge(p, message, digestCmt, salt) {
    const digestMsg = Hash(p, [message], HASH_DSC);
    const digestChall1 = Hash(p, [digestMsg, digestCmt, salt], HASH_DSC);
    const chall1 = SampleChall1(p, CsprngInit(p, [digestChall1], p.dscChall1));
    return { digest: digestChall1, chall1: chall1 };
  }

  /**
   * CROSS signing.
   * @param {object} p - parameter set
   * @param {Uint8Array} seedSk - the secret key
   * @param {Uint8Array} message - the message
   * @param {Uint8Array} rootSeed - L/8 octets of randomness
   * @param {Uint8Array} salt - 2L/8 octets of randomness
   * @returns {Uint8Array} the signature
   */
  function Sign(p, seedSk, message, rootSeed, salt) {
    const S = p.seedBytes, H = p.hashBytes, t = p.t, n = p.n, P = p.P, Z = p.Z;
    const sk = ExpandSk(p, seedSk);
    const sig = new Uint8Array(p.sigBytes);
    sig.set(salt, 0);

    let tree = null, seeds;
    if (p.fast) {
      seeds = SeedLeavesFlat(p, rootSeed, salt);
    } else {
      tree = GenSeedTree(p, rootSeed, salt);
      seeds = SeedLeavesFromTree(p, tree);
    }

    const fzLen = p.rsdpg ? p.m : n;
    const cmt0Input = new Uint8Array(p.fpSynBytes + p.fzVecBytes + p.saltBytes);
    cmt0Input.set(salt, p.fpSynBytes + p.fzVecBytes);
    const cmt1Input = new Uint8Array(S + p.saltBytes);
    cmt1Input.set(salt, S);
    const cmt0 = new Uint8Array(t * H);
    const cmt1 = new Uint8Array(t * H);
    const ePrime = new Array(t), uPrime = new Array(t), vBarAll = new Array(t);

    for (let i = 0; i < t; ++i) {
      const seed = seeds.subarray(i * S, (i + 1) * S);
      const state = CsprngInit(p, [seed, salt], i + 2 * t - 1);
      let eBarPrime, vBar, vPacked;
      if (p.rsdpg) {
        const eGPrime = SampleFzVec(p, state);
        const vG = new Uint16Array(p.m);
        for (let j = 0; j < p.m; ++j) vG[j] = Mod(sk.eGBar[j] - eGPrime[j], Z);
        vPacked = vG;
        eBarPrime = FzInfByMatrix(p, eGPrime, sk.W);
      } else {
        eBarPrime = SampleFzVec(p, state);
      }
      vBar = new Uint16Array(n);
      for (let j = 0; j < n; ++j) vBar[j] = Mod(sk.eBar[j] - eBarPrime[j], Z);
      if (!p.rsdpg) vPacked = vBar;
      const u = SampleFpVec(p, state);
      const v = RestrToFp(p, vBar);
      const prod = new Uint16Array(n);
      for (let j = 0; j < n; ++j) prod[j] = (v[j] * u[j]) % P;
      const sPrime = FpVecByMatrix(p, prod, sk.V);
      Pack(sPrime, n - p.k, p.bitsP, cmt0Input, 0);
      Pack(vPacked, fzLen, p.bitsZ, cmt0Input, p.fpSynBytes);
      cmt0.set(Hash(p, [cmt0Input], HASH_DSC + i + 2 * t - 1), i * H);
      cmt1Input.set(seed, 0);
      cmt1.set(Hash(p, [cmt1Input], HASH_DSC + i + 2 * t - 1), i * H);
      ePrime[i] = eBarPrime;
      uPrime[i] = u;
      vBarAll[i] = vPacked;
    }

    let merkle = null, root;
    if (p.fast) {
      root = MerkleRootFlat(p, cmt0);
    } else {
      merkle = MerkleTree(p, cmt0);
      root = merkle.subarray(0, H);
    }
    const digestCmt = Hash(p, [root, Hash(p, [cmt1], HASH_DSC)], HASH_DSC);
    sig.set(digestCmt, H);

    const first = FirstChallenge(p, message, digestCmt, salt);
    const ys = new Uint8Array(t * p.fpVecBytes);
    const y = new Array(t);
    for (let i = 0; i < t; ++i) {
      const g = RestrToFp(p, ePrime[i]);
      const yi = new Uint16Array(n);
      const c = first.chall1[i];
      for (let j = 0; j < n; ++j) yi[j] = (uPrime[i][j] + g[j] * c) % P;
      y[i] = yi;
      Pack(yi, n, p.bitsP, ys, i * p.fpVecBytes);
    }
    const digestChall2 = Hash(p, [ys, first.digest], HASH_DSC);
    sig.set(digestChall2, 2 * H);
    const chall2 = ExpandFixedWeight(p, digestChall2);

    if (p.fast) {
      let pub = 0;
      for (let i = 0; i < t; ++i)
        if (chall2[i] === 1) {
          sig.set(cmt0.subarray(i * H, (i + 1) * H), p.offProof + pub * H);
          sig.set(seeds.subarray(i * S, (i + 1) * S), p.offPath + pub * S);
          ++pub;
        }
    } else {
      MerkleProof(p, merkle, chall2, sig, p.offProof);
      SeedPath(p, tree, chall2, sig, p.offPath);
    }

    let r = 0;
    for (let i = 0; i < t; ++i) {
      if (chall2[i] !== 0) continue;
      const at = p.offResp0 + r * p.respBytes;
      Pack(y[i], n, p.bitsP, sig, at);
      Pack(vBarAll[i], fzLen, p.bitsZ, sig, at + p.fpVecBytes);
      sig.set(cmt1.subarray(i * H, (i + 1) * H), p.offResp1 + r * H);
      ++r;
    }
    return sig;
  }

  /**
   * CROSS verification.
   * @returns {boolean} whether the signature verifies under the public key
   */
  function Verify(p, pk, message, sig) {
    if (pk.length !== p.pkBytes || sig.length !== p.sigBytes) return false;
    const S = p.seedBytes, H = p.hashBytes, t = p.t, n = p.n, P = p.P, Z = p.Z;
    const mats = ExpandPk(p, pk.subarray(0, p.keySeedBytes));
    const syn = Unpack(pk, p.keySeedBytes, n - p.k, p.bitsP);
    let ok = syn.ok;
    const s = syn.values;

    const salt = sig.subarray(0, p.saltBytes);
    const digestCmt = sig.subarray(H, 2 * H);
    const digestChall2 = sig.subarray(2 * H, 3 * H);
    const first = FirstChallenge(p, message, digestCmt, salt);
    const chall2 = ExpandFixedWeight(p, digestChall2);

    let seeds;
    if (p.fast) {
      seeds = new Uint8Array(t * S);
      let pub = 0;
      for (let i = 0; i < t; ++i)
        if (chall2[i] === 1) {
          seeds.set(sig.subarray(p.offPath + pub * S, p.offPath + (pub + 1) * S), i * S);
          ++pub;
        }
    } else {
      const rebuilt = RebuildSeedTree(p, chall2, sig, p.offPath, salt);
      seeds = rebuilt.seeds;
      ok = ok && rebuilt.ok;
    }

    const fzLen = p.rsdpg ? p.m : n;
    const cmt0Input = new Uint8Array(p.fpSynBytes + p.fzVecBytes + p.saltBytes);
    cmt0Input.set(salt, p.fpSynBytes + p.fzVecBytes);
    const cmt1Input = new Uint8Array(S + p.saltBytes);
    cmt1Input.set(salt, S);
    const cmt0 = new Uint8Array(t * H);
    const cmt1 = new Uint8Array(t * H);
    const ys = new Uint8Array(t * p.fpVecBytes);
    const sScaled = new Uint16Array(n - p.k);

    let used = 0;
    for (let i = 0; i < t; ++i) {
      const dsc = i + 2 * t - 1;
      if (chall2[i] === 1) {
        const seed = seeds.subarray(i * S, (i + 1) * S);
        cmt1Input.set(seed, 0);
        cmt1.set(Hash(p, [cmt1Input], HASH_DSC + dsc), i * H);
        const state = CsprngInit(p, [seed, salt], dsc);
        const eBarPrime = p.rsdpg ? FzInfByMatrix(p, SampleFzVec(p, state), mats.W) : SampleFzVec(p, state);
        const u = SampleFpVec(p, state);
        const g = RestrToFp(p, eBarPrime);
        const yi = new Uint16Array(n);
        const c = first.chall1[i];
        for (let j = 0; j < n; ++j) yi[j] = (u[j] + g[j] * c) % P;
        Pack(yi, n, p.bitsP, ys, i * p.fpVecBytes);
      } else {
        const at = p.offResp0 + used * p.respBytes;
        // The response is hashed exactly as sent, so it is copied rather than
        // repacked; its values are only reduced for the arithmetic.
        const yr = Unpack(sig, at, n, p.bitsP);
        ok = ok && yr.ok;
        ys.set(sig.subarray(at, at + p.fpVecBytes), i * p.fpVecBytes);
        const vr = Unpack(sig, at + p.fpVecBytes, fzLen, p.bitsZ);
        ok = ok && vr.ok;
        for (let j = 0; j < fzLen; ++j) if (vr.values[j] >= Z) ok = false;
        cmt0Input.set(sig.subarray(at + p.fpVecBytes, at + p.respBytes), p.fpSynBytes);
        const vBar = p.rsdpg ? FzInfByMatrix(p, vr.values, mats.W) : vr.values;
        cmt1.set(sig.subarray(p.offResp1 + used * H, p.offResp1 + (used + 1) * H), i * H);
        ++used;
        const v = RestrToFp(p, vBar);
        const yPrime = new Uint16Array(n);
        for (let j = 0; j < n; ++j) yPrime[j] = (v[j] * (yr.values[j] % P)) % P;
        const yH = FpVecByMatrix(p, yPrime, mats.V);
        const c = first.chall1[i];
        for (let j = 0; j < n - p.k; ++j) sScaled[j] = Mod(yH[j] - (s[j] % P) * c, P);
        Pack(sScaled, n - p.k, p.bitsP, cmt0Input, 0);
        cmt0.set(Hash(p, [cmt0Input], HASH_DSC + dsc), i * H);
      }
    }

    let root;
    if (p.fast) {
      let pub = 0;
      for (let i = 0; i < t; ++i)
        if (chall2[i] === 1) {
          cmt0.set(sig.subarray(p.offProof + pub * H, p.offProof + (pub + 1) * H), i * H);
          ++pub;
        }
      root = MerkleRootFlat(p, cmt0);
    } else {
      const rec = MerkleRecompute(p, cmt0, chall2, sig, p.offProof);
      root = rec.root;
      ok = ok && rec.ok;
    }
    const digestCmtPrime = Hash(p, [root, Hash(p, [cmt1], HASH_DSC)], HASH_DSC);
    const digestChall2Prime = Hash(p, [ys, first.digest], HASH_DSC);

    let diff = 0;
    for (let i = 0; i < H; ++i) {
      diff = OpCodes.Or32(diff, OpCodes.Xor32(digestCmtPrime[i], digestCmt[i]));
      diff = OpCodes.Or32(diff, OpCodes.Xor32(digestChall2Prime[i], digestChall2[i]));
    }
    return ok && diff === 0;
  }

  // ===== the KAT harness randomness =====
  //
  // One SHAKE stream seeded with 0, 1, ..., 47 and domain separator 0 feeds
  // every randombytes call of the whole response file, in order: per record
  // the key-pair seed, then the root seed, then the salt.

  function HarnessRandomness(p, count) {
    const entropy = new Uint8Array(48);
    for (let i = 0; i < 48; ++i) entropy[i] = i;
    const stream = CsprngInit(p, [entropy], 0);
    const perRecord = p.keySeedBytes + p.seedBytes + p.saltBytes;
    const skip = new Uint8Array(perRecord);
    for (let i = 0; i < count; ++i) stream.squeezeInto(skip, 0, perRecord);
    return {
      seedSk: stream.squeeze(p.keySeedBytes),
      rootSeed: stream.squeeze(p.seedBytes),
      salt: stream.squeeze(p.saltBytes)
    };
  }

  // ===== KAT DATA =====
  //
  // Records of the round-two response files, rebuilt as the header describes
  // and pinned by the SHA-512 the package publishes over each whole file. The
  // messages and signed messages are hex exactly as the files print them.
  //
  // A signature runs from 9 to 75 kilobytes, so only eight records are carried
  // rather than one per set: all six category-1 sets, which between them cover
  // both problems and all three corners (flat, balanced tree, small tree), a
  // second record of one set, which starts further into the harness stream,
  // and the smallest category-5 set, for SHAKE256 and the larger fields. The
  // other ten sets are covered by the whole-file digests above, not here.

  const KAT_URI = 'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip';

  const KAT = [
    {
      set: 'CROSS-RSDP-128-fast', file: 'PQCsignKAT_77_18432.rsp', count: 0,
      sk: '08B491D9C18B8B33BB3CB17AC74574543152A6C140B79648873B84D5A742C70E',
      pk: '843A0CCA82D1B761EC4AF1ACB0473A18DE5FD2143A6A7520E61BB703B4270B2D2271CB06D9766AB1EC9D1632222D5EED6048010002E0DE320143C82070894D2D' +
        'C2251C44670A6F81CE22E74E01',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC868F468C0122C00AE15F7AB0410BEF08F932D20F2B2FC7E907B3C091DCEE7A5' +
        '6A44C4ABA59E5A8FADFE29917D8FE5DACCF3096CF98A7806EF569191C351F4A37C8EA113990294A6194F7D6F9073B6AEACE2FD98A343053DC1E3E8B1C2506D41' +
        '042EDC5C75C4C1ADCAF395D3FDC4C50117E09BB33EEF5D52BC5BA61C7E24ACD2FE6AEA5024539A3FA291AA0FE052B3CFE668A0D28AFC371C3CEE019ACAA96F7B' +
        '8B2F93BA83B01457BC181C9B339D2389E17DE586EC233237EF9927DE9A3A62A48FCE97BF0501FCC583D3B61911E808B266DE53AE17BBFE14FCF68B999EB11666' +
        '94EEA1B53C35A98A80D69B4A49CD6ED893E895D1AF828CADBD7BAE7D66B61975FB39B8F83256573446C59C654A13C4CDD7CA665D9FE069CE2E48F865D5D9823F' +
        'AE968F3E208E995E35534DB65F323C5199F7A446272E48951E2D72323C5DE6F65DC482077A6F4C69C98A7A328D986FF8B2AD8AF1A82CACA5FEB5B54BD9519010' +
        '80C5CD5AB9F11458C76ABE1EF6914D615D8A4FC403152673D396C9F0055DEA8FF4B7C4D0EB5113FF361C58F2D4C539292093A2663524827465477F918DBB5B6B' +
        '48C3A35E80A4130047ADBA7D3C4B26ACC4B65EF39A1951A6FBE5262AE31B237008122559C8EDB2E441864508BB32E3BC94EED68D7B4D0723909B36BDF6E710FF' +
        '185A142A8E9FE0B02C317590975BF40CB1E759424523A0170667656444356787FCA7BB2C645C791E519273FC98C22EFDB709A13F396AC2039D9BF86051D6C78E' +
        '1E75CFFDCE15D72409E5B1A4D102B7631376A76C93AB061B143F1A07D7FA6EC7334F6528B2783C48A937C9038A699A8ECB3621CF0AEE948A973F3FCAFABEFB29' +
        '349C9D586E5803815A047E89B2E98710A80BE295A2F79A5352605B8A74AA6D27BB47CB90B477F8DA0398FCC889E40DA14A03FFD6E6E2AD8253FC2A22FCFED5C9' +
        '734EF9A102651DE4A73E72A24F7EC3D33B10371B2E51FB87693A6675A4980CADD859BEA395530B983AE6E2CA2BCAB0DBF0E3CFE961E0ED60A24308EDB84D733B' +
        'AC8BEEABE790C77E84BA3D8BF60AF34DD08B15876933637E141C34446CA7313EE178F73D4C940DFD8434F4B902C77E762B089BB930197195010A7261BB63E9E9' +
        '871E5F2DF5EEB6D382194CC36D1E0B006B2DE9E0A6DF0F2D78D7ED8626A340E6FBDB0CA81CBE4712068030D3DD707DE2ADC99203A1D4315D67FC9A0426A4727F' +
        'A438C2E5BF88376AFDC3BA157EBEA5D5994C8D8B34715585B537EEE6C036B5DF15581B64125B59EC3272BCF03CAE28DB84EB5C6FC62CAB8EBB281C9E96037964' +
        '7A29640174145972251D2E593ABC9EBB4DB1C073268F0DC1CEC584E4FE611518B03AF325EE5F4C7702A6A8A46B788E850DA1FC558715E52FE3456F1B7210B112' +
        'F70F6B61FFFECA8304E25C3A85E33321025F51DD387876FDC3B17738F7524FA97DCE37F55A81FFE4D51E09F51EC134CBA8608E119F58E6DE652CE56E5845ABF5' +
        '574C98C88D2A4D7F1C2D99429C7936033EC29498FAA17BC020C41B2908936A40126E106124AEC44ED01C74C56BE0810DD3113D4AEC46759631C161DAFA334E41' +
        'C5CD1E3A16632C2392CD3D4667717A8FE90B3F3609B0BEDA556A5CF365D095512316FCAE8B3B4BEAD4A354148068DE9FE100383409231383CA5B8C78773F521D' +
        '34324E7B9F98AE4C6D33D5A0672B32A001D069165458C4B3614B15FB8CAC7BC51FA5DB2A86D69FF122F4CE032B2A515133633E88E46CEBBC2D8FEE167609DB51' +
        'EECA71587E33F5F4E172399649A92BFE809F878EBD7D65B97C8295BD54D5A62E2D4466E0A0F1DC6F7C447CFFE0FE79BEFE77B0B1E1DD2DDDD015D1A030826CC0' +
        'ED814D03099D26A6E60726125CD70E427ABF53D1C4D71CD1AFBD86CF49D788A9E084DF5F72BB285946FA9ECD67AB60C0FA1675BB5151DC77141E9A74C545BDE9' +
        '192C99B7AF716F4131AC07A4E220274420736285B66C88026E2EB2C745BF1E6B844AAD39670B5393A87DC978435570969B35BBE97C9014D96D2D59D9DCB30B72' +
        'ED64F8ED418DC6C0307025CE4A0DD9F79FA3A1B0C83042D317B2DA4C33228F4BE464C39538D10979DA9F7C8440328AB89231A98D058FB718CA6676E125006BEE' +
        '2CF4913138F110BFA99389763B73608F0FA63358C6DE63331B0B791170C4254CD4E7DC94529D3F1865763523C9E1BAEE1B3DC3F5CBA78B95D1FB5A9F3D0FAA38' +
        '12E136C2259F544529F83C59D27A5EAA4F84A78A73A7D59AFC3943D1263B3B6D5E4FEA447107CD39C1099EE71A46BDBFC9624863E97DED86481BF1AEF5A3EBE4' +
        '35FC9319D61E349C17A8EBF3A29DDBF49DB038751140C93C2F9C19ED54754689819694003E50EAA65FFB57902FC04A7C215615EC2D1320A98FA9414002534152' +
        'CB1235B3C02E4316FCF36F5CAF3182160D094E7ADE113453D1D6EA6C80318755CDE5049E017E0E3F731D042E56620F028F68A43391BAF62C9BC6E69F569AAFB5' +
        'FD7B56F8110926B36C78DC823D7240C6B65B212A6B7148521A6F4473371919162E2A0273C26C2A5D02B5615132F9B99D31E2C08E847C55DA144461A126E7A09A' +
        'F055862C9466810303C3D3919EA6FB18819D0C7CEFCD6ADA16E7C2638504FCCA9318A3B1B4B917604ECADAEB222C8AA53BD94771648BDF8783C4705C04328085' +
        '3956D582CD295AFA3A6C49AA6055A35CC21C967C4774DFF11F6864E671A1EC461A47164358B6BC0CF80E27D2E72DC7880BB07577FB1BC7A31C811077576DC21E' +
        'F55E4408507775CE8E160A6FB22ECF147236B7A8CD33C8145A82BDE87E23F04556127FB25F71B702A0029C883A6152A168FFA388E3AFA9749D09CF5F302220A8' +
        'FB3ACE31DEAD75AFADC5C8529EF71BF005DFBB6154B82669A9FAEB5400E0EB903F74A5ADC30BABB188B6E3EF13BD4C09CA9866173A2657BBE1E2C0EC0AA77F4B' +
        'F8B82ECEBFA4CFE9065406BA2A65E503D6B0A674503BA3647BE2ADC3E99FA73B759D6B2CCC449862F5F48C3B99D69D2BE89E7A72B2331EA782CDC5E3AE65DDF9' +
        'CAEDA7780D57149D8DC559A6A20E99DC5A4259B3B4E3F6FAA29961977F255432A612744F3A4F83DE3E13E2A4A84143F1026064B86D0DD37A097D1764815695CE' +
        '5C2A4016A497EE887F7EB1E11EC5213D903AC0176FF7D4994B0882C05BCCF8411D6F707AB354211219130671951DE5661378CA3CB6C7F173FCE89C4D41BE46AB' +
        '7617D5EA4DD368F60D6DA6DA4C73D91273BA42C0C981CA4FB7071EEBAF6EB62E2A55E43DD9CB9F4C56FA62C2A7E82C46AE98BACA656789DCAF65815449009154' +
        'CE13A9C51E91D02B550EEA84EF2FE30660B88F1D94BE219215F8D6F30DEF50F14DB42E37846099ADD236C6033CD0BEA66B263E1DBACADD3F86AC1A0CBF289121' +
        '61B3A51A9F71571A16AE9409B2B0667DE62C9385D75971BC836DC65CCE271FB305931F57A098CF21FF3FEE2388FFD3AE181A02F8A530ECA8E4A85681284E8768' +
        'B33C5E165DF37FF1A3F7FD497C2AB82E553726C4AE5B0FE148A8E01921B129B062A05E87A151D8258F9861E3B301F1D6A74BD784016C1C31C88F2B15EC390C8A' +
        '10FA6343BCF2170DEC8BC54AF65CCEDDDB0BE159B6D77A3DEE4CA7AFC45058125D858BD4B0DCD669A98F0937D30A3C38D52F1BFEC2F78172FE2314CEC1AF0B45' +
        'FC2074E51623A52ECD663DA3F7860205382A209F30C1DD099D7959F73DCF54ECEF72429347FC2EF5DF4BCEAA424724F1FA6AADB2557F010B87CCA0D1805DCA3E' +
        '1001DAD81C4A0269EC5B18079AA8410B7EF0F3B40A32CF8656FDEF404A209DB25026CB28A86A4FF36A11E908E1FBB001C751AAC5B104BB2700172A04753664A7' +
        '50FD8470A462B69E9F64DFE5657AE02F93A950A234C2F084032BCE6925A3F932576D0C1378A215658E18C37827D33EA8F04229D51C15E65035CD07A08C308E95' +
        '2CA0C5A541F88E946D4D173B9151C9E183ACA332AF8A0B5EE9A8AADBA70CAA656E2124C2D5A82336F208FB2A0D4C27CA81AE9A41AF19200B0D51AD3122C71049' +
        '2C944AEEA6ABA96C262051B319ABE184A1A051863886455AF19292781607738504516EA07EC86F1DAFF2D705349556CC8B287D468C3E29D3BB28B00A6844DDAD' +
        '0291753651C5B9D21917CDA24549748B5C228A58E509DF3AB4C091F189DFAF37CFFD59A941054F01A2935944FF70DB8752F72DD1129BB39A71D95D56112AAD71' +
        '2D7A81B65203F13ADAFA087DB722B66FF2C3FAD6933A1E23C2E09EEE9E88448214A7510413C18041531D676B31438186F1613C1E9CCF4BBB749F7856D469688D' +
        '511699832E84B67DE5913FAD484876BCCEBF8FB30B188F1288DC65021EDC4366EBF3F0C99F932818FAC7E3F7178907EAEA97D3463810C94B41611746CD01438E' +
        '06E0BA83FAAAB13C6C36C2BE0718A8BC0D55F0CE82EFEAA8B3F58DAA84D6FADDDC063C23B066C29F73D2D229BBF2FDFE86E797D8476832AC6995864203EE9319' +
        '5CF9E9098C6E421554DD03029C8A545657D8CFC81A6839104FDEA8401B817C176D1E95C3BADF8C10132832953FDA8650947D38E9E307B8F1F45E5EEE4636A0C4' +
        'F711FE846D63C8765BC7EECAF58B8DFC698CB84AF89F59084851DEADC823B505838D408F43AF4DBD14B44BC912D7BF87FF460175885E1C2625A158CE3BED8B1B' +
        'A7697A04FC52D0418EE7FE101D51C36D0FBDCF9157A7CE9470842BAE7C0074CD21AF02CF2EC5AD8ED638BF8BD37AA531F68C0D3FF1E9E7A55AAACE17B316B980' +
        'D6842029B0AF4CFE235627ADB650C5777086C029969F924329BC450FC1550340D4302F4363928511E4D2C37C76E7AFFA25F1B08032D89CF5ABD93144E5FDEDE6' +
        'EE711FAF7E20104515630E7B834794E0C93BAD4C4BF4111F0CDE698EA8570F0D77BC84BEC3F80DB7B3576FB6C5ED192139273E8BD90AC27D91557FF08135BB45' +
        '9669E90F75CDC92DAFB9957B8BCDD969982CDFC5DB7F8BE357CFD1F1183BBB67EE761C9275C9F27EC6C026F15449D7078EB430FD220684AD3823471E534B8ADD' +
        '5F5FCFF426ABE987933B392CE131820CE2F7AF3AC113CF008B26EEEEE23869C5B47FE22035FE67612BD08BD41EC5358C0A662ECAE5645363A201BEE47277B52B' +
        '784934990956E6DFACC667FD3C93A2E99A19B921F82F538ED5F70666778012A34D2F77D761B6E90FEFF34AA9131D70824DE6278C96F404C6C112496A86894A5B' +
        '7249AD0BC2EF9875DC458E4CF2ED93791D0E1442E414B8B00929E292D5630004043B0CCD30F5BB87CF7E6E47DA808D2CC0E8415B47CB749479E48AC9812E44E8' +
        '0BAB531574C4A4CFA6E607371FEE2EA77E0BDD7186C49696C5E1A69A19B5E24EFA5DADB4B48A44F1391B478CE7D70402CA0F1F1AB40D3A01068CD8F8B128FAB4' +
        '163457939ACCDCB554620E40D25C57BD0446DAFBFA3EA86B944803209FA4B704D95A2693A0493746876CAD8690F41B91C54F0B94C73B6FC1921D685D1D7D7E85' +
        '30A82755553AE8958044C44E66CEB6582253E4EEFA08AC252326FA9585C0FA7714B15139A91048D76EA5AEED547EC34FAECF01360B7C008C5F7DCC5C6ADD15C5' +
        '8378D7AA89C81B2028CC4A9A7092FC2F724F2E98A506958105A06C90AAC63462C1633A04E2F91B9F35841AAD192ACCBBEDC8B0BB8D8ECFF5666919EC578191E4' +
        '4D623A173BB3E75DF6F5B3C9E518245D54646F7F1AA592B8A83C09E2794515C7FFB72E232847717B526D42D4A0C57EDB0EB5087CDB92F25D8C82FBE8F88EF517' +
        '7EF933B4205FBF7A5FFC85D7A43334FB93D0013A1CD9D2B0B8C232FFA4B4355985B8DBC9E7430B26AD8C39FE4F672802C7C1D73CD181C758900890A2EF0484C6' +
        'DD302803BF4078EE2A486DCB2853051EDA8BC6A0E8733FCD7D64D32FC1725BB11441E00F2AFD5CC5F7560D7AE16ED050649330C71249DDD0E5638C82E285B713' +
        '6899B88F3C14EDC386E63A32FBF9F1AF9E8808690424BBB65E3290F914FFACB3B611E086174C9DB131AF20B130561A314BD528259AC1F2E880794ACFD004BFF3' +
        '968AB789DA14970F095A8D9C9E80BBCEA0A2776F6F165E0A50D9552A8F9D15E445F68052B5BE0D484AEE007261A8975E7EE13492F6F82A6859BFB2A86A695673' +
        'A33E0B3ABF3EB0D0A7DF32D59A2C3F895514D36961AAE30DE0EEDA2D77F8FBE6FCE890078F8348CC1808A71A7A1FF9F907ECE6BA223F21D111AC9244939050E5' +
        '314242C68A12A06D2CCF22BD5CBBCAEBC0BF863D63EFC73D9AB70EC131D18BC12394249A3132B2B2EC948BC0B6E79F26757A071E8C04AEE1E660F52AF06A6F89' +
        '020F3C4F103A39BA39277CBD7DFADDB7C714742F2011384D191951CA219FD5F19A95D827E4FC7BF6F801C6D09AA3CE3FEE59522E26448D6E4D292360B782BD43' +
        '81BF626DA3DF6A2E09AA8E221D7C0EADE036C21598C81598704F514BF3C9339BFE15D5424BCA913B93426EFCA03242D919F910EE980EDC79AAE871A62A7C0A08' +
        '4738B9BDCAF079D894046EB19538FFAC50D031D7F3C10550E0D42ACACE60FD0F4C3A9340C60ABC98877B5C874931BDD0A65BAC8184FBB8EB0CA0465A0E477CB4' +
        '8EA7307441CEFF23829F523DCC8A77E816B1FF5F7661EA7BDB8369ED3CC28FE94319409BF8E49DB784CFD740EDC1008AA813EEFD6BB8ADDAF3C470AE1639EE00' +
        '0235ECD179A0D0DAB1DDA2371465601C242E4948DDF63D8CCDA502A9D1C551D938DBD7DA1AA8D93B23B5CA068833151BEBDFA7DDE6FD870770D90AAE49D3D5DE' +
        '2F33129E1E12EBD42A42984D18DCC6AEBF583AAD92CFF89CEC8DB6F70FD0AC528821C1F0DF1DE68734A682C3897A8FBEF17DA5D8063150AB3D6001A21FCA1BF0' +
        'AD16B43BFB2D1BF60D3272C3D5CEA933A6839DF4B5BD18353FF005901587E017899B68EB3D0D1FFE5B14F16D663322B4F5AFBA853330726EB104B28CD262F288' +
        '814C61D06DD395BB1DEB173648F4B4F3638FE74A7624BD7AE8C0A14B59945EAAAA34C1F4C28E742566AF8CD108370E87D7DAB46A559F42DDFB2510D47DDBA60F' +
        'A275443FEB7A5F80AA3BE296F1A6DE0C71D8094CE998782FA43D7BE21D2BC4ADFEC65441F1F5726B5CD6E7168E27A75B9592EABE16FB43D94B6DE00394D6FA33' +
        'E8ABB2930A143DA5768A91C5D1EE2B7EF844AE3F2A82A5F3D72C03A4BA65DFEC72BF9B6E1A292CFD5BF8A6173F39DF02000A48FF421E1659F82CC1286FA4B2A6' +
        '52E40145937FAEC230BF42A67C2854BDE603833B29E5C51518D872A8670BCFCBC433CAF8FF356CA318E34C0F684863411E2F2DCB7F2463C1FCEAC31F86111B8E' +
        '0222ADAA58591B911E705A99F804256BD7B49BB015A8C3B974CB766DCC7E48D56FDE80F45E5EBC2B2592C12B20CC4649D942AD2FA1459F2389883CD9B657146F' +
        'FE99DDB348A5CAC56F3B63CAAB0E31692ADC459DCF8F001BBD741FCBCFC9BAFDB78F405CDEAFAD2195C879CE32F05030705319E233DFC34292A07A50F12A7D39' +
        'AEAE95916291F55B45FC124EF965FC7A9D03743ED837D5E150592975930D854450600AD506FCCC5C2B6B9631477707B0CE25B8262C28EBE328AC1B00F1D94C20' +
        '33DD688D78ED030725DDFBEC2162D399B4A2F76F5E5E3317149A0A89BEA76D8B40B38D86441CA173A6BD9FA1DC1214A30EE58670897DFF30C9B8B98378F171F3' +
        '141D7BA082DE480FB8A3934A924EF94AE1732C5368476F212C062DE793CDDB35E2E0DA9D9904C6CFA1D40FB978539920FA4F400243356F266544BC8309EAC158' +
        '7062EAF560A2B9A460EC21E646B28CEA543B92A973526713FD03F37EFA4AC06849346ED86F875591F690AA50CC8CAC29C18FDEBC8134E05BCD029F4ABD13F50F' +
        '448860A61FB44F874D5DA495103E04ED68CB516A0325A839FDE942C2570348C3ECDD83251278767FAE376E0A7D7410BD3E2390801F3C1076B697154CFAEC8605' +
        'DF8E5726F6B49C3BCE1C251503B80B628C5D57E210A23A7EBE39A125DCE754360E33DB276219D3E3380CA36364C4D20959770184790E041B05AE07E923C0E550' +
        'B4A3527F706ABA379CAF0F1F88339DFEB28430DD635407609BC804EB3E17DB3E963654EEAB02E2643E775DDF00E6896083E396695A9E8BBCA00A308109F2C2E0' +
        '917021F8534587E97CA2A65C2CB463B30EA51B7A7A852CA5C5A78F4A477F4B110C02FD5519E4F07577F4292CA7D2FDECB65922A1DD2DCB60E8C84DAF7F62FA68' +
        'B356CA781A82EE9F4E584CD49B9CA2FE5B3B85D2F47080A4BD4F2C63F768A6A980981F968B22BDEB2C912A48F764B491792535C8F0596848B9D1CF5D3F7DC4FF' +
        'FB743256862FF3D147B56DDAF9B327FAD6B6C8E90572B41F6C49B695FD1E08F6C8D01B918A8275323E461D7639C92057900AF6E81CC8ED407B7A3E27E44333E0' +
        '8FB60F1FE1FCE47895CEE01385A2F123B4F93CC0BC7D9B35240AB1978F976129A41728011399753FD545D9D157951F0D2D588B37CFEF5C466A0DFDD380F23702' +
        '234504145195833150BC44DD7D07DFB0DCE0CC5C0C86C586E4A74D342F3229B13D645EF3F7FCF96C6A08F9817C0C63B6EB07A2E0186103001778C5632055BB1A' +
        '6DC72D5A057A30F03195E341316D785E53948683E10870AF42F6F53C3998FACDC46CFEB7518D9ADC0EEC50AB26E1252581C962F5A1278987E5AF2C2A2994AC75' +
        '70FD05E6BADAD0DB7DBDB7D5E71D2CE4BBA164C29B91116E8B92B59B11DAE40E2110DE69A95AF744B76136F90A1C1F8EC5B581FAD534265BC9B4D36024615B1F' +
        '61BF079963786BED3B6EF5ABDA12E88666FAE6446EB8E3C450DB9F44A0C3F286656CE36F2F06C439731B7CCD5C71848DE427FA1794352B1C553FB6C7A1AED287' +
        'A2B4EB5DCC05C17C1841390EAAD91C909EB1028DCB199E712B5CE35D739208D2CFC38C409E25E0AD8C332D1711BF47594348840B7E95AF1ACB043BBFAD1F997B' +
        'A5BD2430A4CB54C1A4E6302B45A58ED0083EF48EE8993D6644C4897ABDF32E2AC80B19CC96AA9E5FBAABCB02A8C150E9B82A0991276B8E9395BCB3699766D40C' +
        '88B0A8D0BD165924C29DF5364F0C792744B682928BEDB7AE3CDEDBC9CCBD9F976C831F291D3F5AE53EF0AF727BAF9FCD399794757AC0EA75BDB5D8D46B5760B1' +
        '3C63C25B9B7F459AC0FE4EA269B985B3E63B402B4ABE695352C4184785B758A3B3AE602FDC9D37AF015F41E9572D4E7E1690706ABC89ADEED5C7DBF8AD76BF24' +
        '7B2B4D8D8126932229215D630C4F11F2675B5082C395CD7A711CA3C8F6992B96E2453C078730A1B762F9E0F093452271009CCC747566014D3C6A1B07890D1511' +
        '8BD856503202EE20715DDA84A9244615BCD80E4D47A883CE8A3391A4A88E24E619A1F82B35143A9988804E0E1D3B4C09A96EFB10E7C53908D1133D0F26F59AD3' +
        '635D1BA9B4BE93CA8429555396C3CD4EB3DF52C04C464E168626A917F559BF591A55E199332C3489D09CF07EAEC4B95348F8AAA3A7C132938689E156A5EEDC54' +
        '00DDB89349E9215B8E0BA3C05D1EBA01018835B84549D16D56672AABD19EB9B52D2470D5B04C7630053152A800118B9ED4B21111971DAB999150C28A259B69E9' +
        '0184DD5375E46BCC93D13704521A1B375D76B3BA65D09389798AC48AB0D40BD1A5FC3487636C55326F8D6C65C4B8F7D218AF03C3B6929586878D75A8CB926B4C' +
        'F9B8A88589B8A6ADE766B7CCEFD8406223347C9EE5471893D5087948E7CDBDE3829282323B21985E2947952873C31FA90123B7822E52095261A056EB71A51C50' +
        '328B6214A9D82CE18DAAE238A21D84AD9092845CA2461C8DDA584E32C480A69C00D9A6CD3B6679EF6C877E5F68E22FE7F047FB789B9A9779491B4C652871A0DA' +
        '248913D190EA3C43A9320BEBB3A9834C7E583141D015735D06664C0D0193240276742CEAB4BB79C8E21DD17DC793DE049FCCAFDA5C7AE81304066B3280EB28CE' +
        '8F09244BC514A2D742F990FC31BA82ED011D2A9509262743A6D0091C799E346D91A5A62B38C7C4D6B05A323B19485A3537AFB5AAA261D630C688AC688C602561' +
        '120E8E2F696BD705C0EF3945603CEEAA90BACFE783BEABD052559BED05338693BFAE6BC05B92B76DB300FB6A0BCAD595B70C818FBD4D1BC325EE7166A124820B' +
        'E046C67CA60161894C13809D3AA703646882564B701716D9BE261DE0132B80671F7E7D756FBCA8FD5566A2F32D8E98ED0143E3B1729384032A6708331005EDAD' +
        '00AAADA80AC12A341134060B082556B222B07617B78020695E50281BEB94269314889398D148521A31DE8599FBD0B3970D36583D25F4BD27356CDBEF4EC6FE8C' +
        '5C90F1830D8CE7E858FB99F2756126C266F66B3DEAB5D56189361730D56F83D16A3B7AA2A4CC6F91BD07AEDE4687DE9947C32FF04A5AE27102BDB13C73FCE460' +
        '26F04B470229285BAD4D0C38AC8AF5DF00308656C0680C1D1D8832B48D26C3699DD4068A076AD88CD21CC5D6F00C65691A18E4E6C0184796114CC44143225E07' +
        '16BFE61D83823CE95AF6236E495AAB1F69F543CA4A548ACA53B8E6A62005D793361E9F80AADF0A0E53DD91605DD98E5FA31E747493AFC0A7042DA8BB7E21BE01' +
        '0005BB9F749EE88CB4204586E25D5C6ED2998D9C4228A362764EB311C8B18DAAF8C28BEAC151CED907C2F0C6A541033001D51671530A2F60A94C1358B2700214' +
        '2D5A2E5A0C2D433901F5BC52DC084D952799EE5CC38A2A086EDAA25A1BBA2CB715EF19ACC247513E86C5ECE98E2D17021B9809D182D7C40922A2AB2AF2AA4074' +
        'BA79BA0F308C2DA283081291F02E5D841A7A78CF30B134BAF7ADAC3E7C324522B2618EBF46C5E7D4F17AF1C1B4155990D38EC51C9C6F5D3950B5D08287AAC37E' +
        '5A7D63330F305FB8CB7598437934866C01682572F4480E6EE6AA15A34D34E104B569404A1A1950C8B8998ACD4B29784AE8C19DC16129C5D6E0462931B704AB5D' +
        '09C2E368C8243751AC14FC34329301BEC3D79EAEE4D2390BD24A1BC3AF1ADC0CFAA4C84AD03BAA645E4082842F3C8C666EB0F2111837D508BCE67AE3B64FF056' +
        'D890D8C39E52B69DC40529B5579B2DAA66973D599D6C6184DDFF19364AE42B9C9B847D981E1ACBA47361594C1828502F001C6957855D6F1C90298285657149C9' +
        '28A68EC46C5940010D6CA86A0D3BD119B7906826429C4A4FF6D6748BEA3051EA1AB442F345F303E7833117EC0A3F412E7C7B6B05CC33B81F2E2240EFC6B70F65' +
        'A9DD7F11AE0088ECBA40D21C2F4702D0966C778B360B1E21B1AD02BC3CBC7FF06CB1CEC4A667F1F445D82B6FEAD89288207193B0B2803ADA843466FD69B9411E' +
        '42B9A36E44CF452353DABF650222C56F0142629342B13045E97898DD4C20205519E44C74062A91460A49A08DC58A258B1302A25624F6406AA51C803145796BA8' +
        '18169ABAECCC9843DD7C40D7832E1A842FF351653340005E5D87421028CFB77A03FE8EABBB46CDCB77F511B3F399AC8E15FC5E494F8D6A2025A5713D4E004A13' +
        '19397D867644E3E8BD637C8DB228A22302C3D512667D9D00DBE4A1D2786AA72B2C9C5621803DFA05E85D2DAB3DAB773C01D68471713BA343377406433A6A0513' +
        '8A5075401A2C2E088513528594A874684C4D53C671562B8B9CE8644C301BD26C1586BCBF48B4D7C7B4E571B5A7F784B4B61C8383DA5C6AF8C85066E7D4C8D446' +
        '9838083706210314B737C19C3E5483CE9A49925B016614E6100D291A989FE9B4FC9DE5162E91ED7D27E48D9C98AC321B2C2F45619B6B5D85B13869978071F72D' +
        'DEAA5E4AFC82D06E94D6D7309DF7E8A40152A5242A3D7343E056A6684C4845195152C8230C54B314A6A96D27ACB04A11000BD4E0D299A0CC801D324E6A87AD3A' +
        '116BF61EB452E05997187ED9049D5B35C1CB0903F8A095DB362FE712F323603377B25A5A73FDE2E80F8833A15CBC2E847BF304B557C9145E25FD869855EEBEEF' +
        '65F872D75D8E5BAFE7C54EA91787B62C4B874FD5F1018D2356DC0984CEE96E40849632C78FEDFA357132352956835C7A01A1EB8AB4B2356C68A8C98A052556A8' +
        '85C635200A198027B298CD764C2A5A08079136000C362810658181CAC419B41212A31BAF5CDD129BA984A303C81921EA065F341C044EDB0D81B30A65A41FF843' +
        '9D0AC50164CDE787BE2068A7122B24044A3E7654AE62846C7FBC5EBCEAC44A9BBD34B4E45D36CC99E540D949A0D82AC236ED0391CA1E39AC4617E56930F408EF' +
        '32891AE61201CB0E026865FC8F33CB67004A1387513557B2CCAE246D789A042B6307934EC10A13226606910DB352AA48E37AD9D82D612305222084F36C3358B5' +
        '0DC4C25722A04379071010E43C2213FEB741BD63196EEDE17E947F96D66DE248E53A5253804A87F16547F2313B5DE64BB6D3E21BE34270AFE9A2D38CF6223DAA' +
        'D5C5E2813C60827D28E29D9887F0A497BA319F0DC4572A798A1B81201DE13A4D75CCF6139DBC6F27AB9B68F47D3CF0B80152284B8DDCB6DB52882B4B845C5274' +
        '16A6828E264D4BCB0945A352229A9490494D5099B6906D3504026B0A5C65562514400A3B72AEE7EA064D1270D91F3E3CF0C9A032690D3B74E090535ADBB81C6E' +
        'A098FCCCF87051BD921F0BC9A556A671981E3A43C15AA7C883CBEAAA31DD2B27F792606137723D819CD84D4C4D23033EBB87CFD7374DC9A16C917721F849FBC2' +
        '2C1DC15DC0715565453FB3E3C6BEC7EB019D6D859CB0A1B09DD129165965367B8D13B05CD0D5891A53AB2A4CAA0A168C38C1A3324CF20088DEDA79896AC11858' +
        '0757AB7A6B1ACF6D510786B20F1DF50D1D15D99F22FCE4925FA03B3CC0CFA636F31DE736C750A721A21C0E3FAAF0878326B6F4129E078575618277527E3CD454' +
        '86C317740FE14D7B95EC264D36EE7A76BD5B135371D03B3BC33CDAF098C00492A232F00B86D30D1F8625BA2606F696F40122D34631B60C2C2C82353891B08256' +
        'B303738AEB1030602DC8D8D8535D422953CAB5060D86B43473096F6A114F14CD1660CD72BC58E7BEFAF6C7104FDC03300D8760CCC3824A4C5DD0DEA64BFD5446' +
        '3874132CE8B63051CB28781F6707B491E988EEDCECEED4D407ECC12C2D538D9922B1A3A2D666E783C0EF9DC6AFA9E13E2A117AF7CEB97A2B37FFF10DC3930702' +
        '6A9B58479F5FF0F388022208D34A74E30074A48632ECA8E3EC689867CF09D3585ADB66ACB36ADE08138B85A2F122CBF1B689F4C608825D0132A215B18C3A4245' +
        '171666227109294D59330832490D4E9C13ECF09DFAEB594064E74A4574DBADE4F82BC56C1813E9FC2B30589028A27F0DDAB08FBC384D2B11636BB1F713D9981E' +
        '42ED7E3D22A4FB5E5A226F353A596BDADEF42145E2C2899D2E23A3AA019334355D350A2FFAA37D56C10829D1B24C5DF40075B405A34DC86C6DBB08D50102496C' +
        '90CBA6A2C161951110738B404B4B90663A108EB3A262E28D82881995DC0A750C18BB73B283A7036661E55036185D20FDCBF32E4420E4DAD27DD4272A17A33622' +
        '2BFCC96764E4C769D0CD15E25C85B29E599E6AE5FAFCF3EBF4C6BA36ED40F60DD16FF9CB08F918DDB95F6E288CE409EAC1713E2B91766A17B45681EC7B84A1C2' +
        'BC0613DD9C092CBD59CCB254C4E3529E0100BDB58339AE9A6A33298CAA4BCDB56038D4866272CD588A5DA3169BC2905011A96D602B8A0C66C158488982000006' +
        '1B4EBE4CA461E7A48963F6246EDCD116FACD7C8B4A76EAC9835D6E8A65E7180DE44AA2D1272C2915ACA24E64DBFA563BFF86AECB636127DD0CFA37D23F89CBF5' +
        '36185614A56884D3F789CAEF26DCF58561F0D0BB869B06FF59A9924D451609F66D892ADC977A548B4673F8A9A6DABF8200E496AA096B6CA5B4D0B32B66165CB0' +
        '52D180519119DDD44DF3D6A284824C0BDDC8EBE070C406DAA9CBB1AB00654C810AC46AABC389BEB4366FFB3415CF5325A17FA8C256CD9522C8D167CA417D967F' +
        '288C915DB7D0321BEFE9EAF5654C6E0AB9AD3732D45C3FF92D25BE8168A34A648826245FF8EEB6EFC7A5ACAC1DEE33AA42A9C49DAE5644034AB61686C473D1E7' +
        'CAF1BD3341A0514F0BCD37AE06650B45008A3CCF89AB417395095E1C7A88BB46C4E2D5E9DC7A061AB872A6120A0060859B1A9A336B4E2C0E61479A8314186058' +
        '00D36454FC68B9018FB727224F4AD7B84014585AD8163819DAF4337331DB60A0463D5CEEA11973E3B747DF6A178A995689E39E68226C563493086CDB931B3B31' +
        'B452462629EA4F4A460776A5B9C4CC1570360AA47C8D9E78772F7D485E625AD4BA1138826A79F68E7CB2855B7928065E010281090B5056D3D288E252A01AA5C1' +
        'B0688045C215AC9D8E26A615C864156D50940D3B87D4160EA002175A303043E905BB61279E6DC48CB9104A8997BC0BFCA887C4D287EABB0D19C86E0DAFC471D0' +
        '755455EF22AB0C47C89AAEEB43C63E0A6F8E58BE26F0CB90C8DE63E1B32472057ECAF8B74527142BA84CC4CCF70B93040AA2B86DEE6DC49E938738144C70F723' +
        '67340B9838A1CAB09F858536BB40602D011E237804BD99AB69821B07DB14C369B3240764BA6186B37A603008C8E2869BA9A48A12649B504DC58205B459A82634' +
        '162A422949FFD0A31D0B695A2B8AC8984C194D1C3413410F13465421A8FA0D9328C09CE7F8B69AC9FFB05824CB1284EC0DA252BAF23D297491E8A19AD93D153E' +
        '00F389B087A682F38435BF438CC89FB7827C81D0C46F51AA59BF91B6C278FEEE95C71AB10270F0EB68CF77474458769201ADDB1689252E41A148DBCA40F3A8A0' +
        '2BA76CF58299A347B4F65C8BB3C914A55C5662DC6401A2AA2A62486A2D6C4B4D0F4EDCBBC961ADE41D348B18C336D6C1CEA546A905A605CAC44EB06807B94751' +
        'F1B9F84DA03EA64A8DA6AC03F6C87C699CF0B2D2C834EAC2E0368533650D665F7911D524B1FB285DE1F5EDC6040582E906E1A17E06895FF06E0A797FC3423B79' +
        'A715AF32E14BA229F29360F580DD5D16002DD4C5900603EA2A1998D701224CC0E0C8A8F35C5742E0954BB596D310382D0A3512DBB68153C750ECB4165423D9A4' +
        '06128C1C20E72E4F0461CA0D0E30115A05C342B32B0FE7C87490C4CE7883BE2B4CB1BC075F3A4E1076DE4ED6FB1BCE378A1428FC82E95664DD54EC8A7E7C0B15' +
        '24531848F6AECFDEF9E96C174F0C65BA8462B78705D0E8DB3FC8C68E2761C4FD102194D53EFD64A7C16AE31795E0EE3701A4086B02111122386EDBC64A4365C5' +
        '4AB26C9E0CCA7303655B4BDAB40A9B9EA8B20244C199312A24B0550E6A21B5E81A5AD151E2AF14BD56A9E6CBC53A97B25560570F89BEEA57DB9EDAF116699D36' +
        '1F8B3C1BB38937F4988CAF8FD96308BB2368EEADAAC355C379542F3474C4AB88F92AF0B3ACE3ED5EB4173A5372124C98770B915382614DECA379B6C8273D23DF' +
        'BE345F0F115397D437BACEFEFC6E2E760051B00A1988A6638B390413D904DB802DA3C2F246A3E0CC90181A2A945C881BC04948A40CF35692831C0BDD26249626' +
        '0DD31E67C30FB1C1233469BBA3DDF2E425F7656842625D4EE8FC9DE2613E7804AFF7A64FC3F584836A019188DEC98C3BA4AC1347F1C60CD365E94D71E5E6F357' +
        '9AEE7AEDCA23E0836FDF9D80F80164C17A9D75E8AFE53E8243E47A00E1CF1DC4DD31CF093C76321572A9219675C0AC84016E328981C48C9214BA2DB150521949' +
        'A183849ABA323331D901C33201CD54C45085A52D9A2D1282C226C3623781B5B600C8DBAAA48A785B086B5E36A8D816CDE4007DC3FAF8568593C76936F2C9A1F7' +
        '90D74FA8C2B0B9AEA33E6BFEE800934C7BADAEB36EE95125C9191FA1A8DE59F3269CD38C427D59167923BA7041A9DA5D6DC9C98F9327BCA9A9A1078C8AC5A73B' +
        '3E95462F3D98A49EA90D759A2CF50A58012126A412CCAE98BC10EDA0B01CC012DC262E468CA0615B232595C96D9575531C33610CA442B8C45D884D944ACE9688' +
        '00D9D18CD51A00D7F01B0D8D7104BD492B0855CFE32BFD49042335C739EC3A93B9DCF0CEF7A3CD8118D74ADD775A130BE8EFA8DB3061847602AD553D013A7627' +
        'A2869A261BBB1F797B313D97AB5E7E17DB9D1E3A4955B26A181217F692B6CD698FE64AEFEFE19B1F008C9BD65E7233EF012D6CA3A5A6A510252AB105C6F202C8' +
        '565CC2139956966585E2841043D7014C8585AD1A54A987990C5092755716850018BF29F7408308B92F5E6575E8FAC4E2356705CA651FF027844D161F6C834DE8' +
        '4EBBBC14C3E96A2BD83FB2B5DFDA35ECD2A4A99D86A31150CDF4131CE2D9E90A9E85B25CEFDB570185DBB5BEBEE589E9FC7B8E6FE10DACE4832EF0B8C7319036' +
        '53735C03CCDB458F4496829BA732C36100DDC8D444B97823110B2E81784DDD408C58872E2A97B6C3B28D24A1963888E2D4D162E330E1B69A2D6711469B2C2101' +
        '14F28D6CBDE1AD9648F1D93609F959E4EBF7D660BAD3768F5EA360DB17A29ADF9DB361D9A26DE0FAF8A09A9C3570900CC6512F6C467D09B5B2C75932A6CE5581' +
        'FCB55F6F3090E4C964535D9C7ED00B8F9B5C7C32D969056C4CA7CE4E4A8F0169882B9C18378D83C41FDC90F8F2DBEE0D01435659F4867511460230A3D96C6BC3' +
        'B60D0F5311465C0AA34D9066B2A72A4100BB54AC05665A34B55DC542C765E99A064DA440278C41137C5229D560F891FBC954A87399889003536642990A0D22C2' +
        'D18D066BD8BAE8B61AA5BA121FA9178FD044A8CFDA2E183213B3B36CEBEF3CF2AF29F24A03727962118CE4B5F1AEBADCAF05ECBCF0792A8E7CF3B6656784D912' +
        '066E6D8094AE396DB01ABC45FAD81C1D00B11D166CA910266A58AE12738DC00184AA504CD5768A642D4D4D0173BAA5623055496D50C420A570907A588C854827' +
        '0C75E74916CA41D0BB3BAF6DCEA1389918F88D473931E6CA2A1DFBBA120FFC0C92F2A2F4C38A1A595A16ED1C4F396DF58098EB6A1E092048E142FAB08A262F78' +
        '7EB6F6D6B4F8EFF59577EB14AF82CECD870DE45A1B3E8F1C6C32C261C54C67FB4DB4AD7455580B462C2DE1864CABF48000D21C139D0D484C090AB455C99AA78C' +
        '5864366E81BADCA6BA61D58032C77A6D1467DB62B23296D11A0777D4E46C96D81097C8126AA926E5E6530EE1DEB7DB30CA6934BFDE2BABE0ADEC2F92893EFFE8' +
        '24AF857103F388D6FBE82AFA1D352EEDB2EF0A3D407BA245FA55F487B43EC55F237B3C7EEB2344A696720D99BC72EEA09EE743A33D9D3D60BBDED9761C62A941' +
        'C3414398656A28C43674C002245FF8BE00CD2A2DC46CC2CC0CA14A0276216938F48855DC2687568088752845C9CC7846032525450670D54A0C44524223589849' +
        '02F5F4084682B6E94E457603A3F35E348C325332C5A2E7F857DC1C6CC264F933F7B9A468F36F5CC6DBD6D2DFECFB42840E1C918EE2CCE366AA25D6799A9144F4' +
        '9FD294B2B6DCD852238D1C525FA38B80D0E0874728E9A5B467C46A95FC5EDD9321DD68B38F3C2625145D0DFF3DB16796004B536D5A36697006889ECDC166DA88' +
        'A21CD825E6D87050D825ED1A12EADA022777ECA669181A4C23EA22745C46D24403492C1828DB06A0CEC5623956D85C1DFDA3B477141E6249A7AB726ED8EAEC80' +
        '80989BC2391DFA30CCD98B0D97CFD93BAEC7F60151FA0EF1FB13EFDEAA0C024F09DC13CD3FD107A8CAC61AB9CB4D248C67304B296AA3563D3A285BEE64A50A9A' +
        '9F3F66176C1F47A9367084B4EBCDAA5F00D9B8AD0D56061C49235A30B70CEB49C19A725914074356111C88C4A53D38CC4613B5883ACD30D59003C6742A5A0C98' +
        '0C5BBFD2915189E23868594CFD5AFA08826077E6DC6D9E681D277D0ACE8791C839C040048EF1912CE50FFB1955BEA3ED665AD2DE80E913535E9510426588366D' +
        '7C7B2F195D266631E7D62EBD2C257288F000C0822CD1B51846067415164620DA6AD63AD18661B28F4E40765BF7E50EA801A69C0850330536B34C64632D24968D' +
        '8A4A2305571445E90AE5E20E2639CBD434566DEB6916D196206CC5214032A53D15DAA8A9B8D9475440CC46383EECDD5FDD507ACBC3ED9AF2EF9250A8F3C6F8DE' +
        '8903CB98CC6CF1474D586DDAFB45B8DD72056D8D95467983564BFE80DBBA5651479C1CF6537C3C48F06F038BCAE20DB51DDE84A05E2CB76F40D8AA932B1A38E5' +
        'F63D81362653DAE1309487F38950DF0C01833D84951350D21040F2DAD9922AB875C0C66B8386E8B454904C489B1729A0690C96D1D8996A159110B8C5E8706A94' +
        '0DB36F7AEEDF0FF63EB6C22E0ED02278AE2707178F6D502144291DCCC0F588A4B0F4921A9C37E5A64A38C6457E76ED013022A63BC152A7093120C87E73FDC6C1' +
        '33FB5BA7FA8AB91E1668C4DF45702FFFBE2F923082401AEA19366204BD07A53D9B98B50A605ED299F2C401508BB00EBD000394C6DE6401DCBAA641A6BA9C83D5' +
        'D880643457C693875264005414CDB211B6AAE8A085E65C03162D16020141DB8618C7E67C08D4903A5776B4C8A6B4AA434BB534EFE0337C144064F3E689CFBA44' +
        'A8B0E1230A479A92B6EDD88D978A8FBF07D6140992DA9EAA8367DB63A5FD60B584D58318065ADA6E844A3F47673AA2623BF365612B4C51CC4A31FDE6A87BCB64' +
        'F5E6585115F5A220B136FB7252442A4F01481567612C4DC1ACB881ED40AEA6C9A8943448460036BDD80484058E36B918C0855D2376F0AA34339DC984517A8144' +
        '155898BFA2733FF5F357953B67F66443185CEA58012EF4DBA91B2D21C49027C595556812540B2619A22217A52569CBB0D057AB9A8FC15775A1DB7CA0229941B0' +
        'B878337E9DF044B3B0B8B4D59613BCE067C27C75E97E770B11263371D54BFC868BAF6E8599607BA44530F78CD81BA5A5008587B90C102DC0D026CE00AA74A609' +
        '40D128D0C635C5E2328E162B12D746AC0D454DA9465C211056494BB0E52CA1160C879154DC2AD4AED78D781FA1080F0EFCD52E0F722CEB4DB3140AD26F5A5249' +
        'D7CB646341D82F257D2DE2E10839EF5706F550696DBC8F86219F52136943F223CE15870A9A5234716C36D090D6F30FB216E03ABE742E715B65C4CA72A92A292F' +
        'C19A0931B33F76820157A82B13A27AEF014E0563D20C2189D7A99E0772B3B4C92A353B8601962E8992253B10044488AC186C8BDC513695BA8942C66605435E1B' +
        '01722279FCD92796A438166AE84CF2AC38B1E73CCDC2C4BB380BF999AE9366C2634E0C63CE55F3C60BA742445080DF0AC75A5977101A8FB87D32AF279B1BDBEB' +
        'E40A70CF60CF7824A534C28265AB99C6AF5B1993C005BB6ED1D63E54C350184C2472F5D4720A24E49CE4759C8A255D710155886CF1C284EB0A2DA10030C10AB0' +
        'AE6218EA46625013C39A072D8125765A62A72961919E1906694077AD88A08EE6147C76D3865C1132F101F565AF14342A86786035EC6A866438845009C0D030C8' +
        '692290498E9920D42008700D9DE08DA68188B572B97E662E80DCD5BA7BB7C2E4A073AEBFB5041F09FF4AE4CEDE248419AA6BDEF024A9E39EF7A5009ECCD15AF9' +
        '3A52F1E20581846CD82F16DFE778577B012C26C3344602EAC899DB9A8D48AA60759CC68AEB566E6B55931346C24A698ECCA1121583AAD569C5041A1915C7249A' +
        '04C4E4F48E08035CA9595E250B0ADD884E16BAA775B10785128EAC1F2CAB43A1B1D985BD889A6A748CA66E294123C4C63EABCAA3BEDB7141E1DFBB0D68095197' +
        '3A03ADCFB225C1CAF6060B1B7B18AA1F53B923361CD67B8885D98D6C8E9BAC17B5E2D925D22A5B8A29E398F931A3B71C01898D55181B2A561202CBC814A9C5D4' +
        'A481A55D197353992C9103CAD3607903D5683258903123C8326108086C7BB541195EFA04F912EC64FEB0A69C68AD9163F549BD33E4926E4D06774E391CCD1489' +
        'FE7AC5FDE143588F28846BF0A3425023BD876D22A9BEF70E49469D34C14167F4CE58D6A554D38FEFD347DF2C39C174C8829FB0270F63BE5443D7C512B7400DD4' +
        '61BD6AEB9D2D3118AFFC995035DD085E01084B5151376F5243246568B93606205005C724C736C26AA292E094098250311C724D559A8D2B735C262E953788655D' +
        '00DB21EC97B25AC06A8576E744AF786CDD93AA80149C297D641E091790B09B58D257F36BCE7DCBC3F8655F436C143F95DC68664EDCF97815F50F5CC7541FB988' +
        '582B4DF0C8772CF5C3C519FABA7273725C881EDC862BF35C6AAA676E304907B6AE24AFEDC73745A68E5BF15FADCD4FF5010630D18DC039893DC62B3256A12B92' +
        '75333A44C7256E6751CDB6C08480960E09D88AE74698B9502965D14554CF8A951890337E4B4E6F0B861A29AD58C52B2C25EB5E7F4D503AF6144F6B055326BB65' +
        '30EACBC3CDE788211B7E5655030DFECBF517F50FF5C4EF6BD68636F0B90159F240F4FDDCCCD9261D93394B17562F7CA6685D0E07434031592280D71DAD28438D' +
        '5D87ED99073AE0398797C440492A063C005CAC11232672550177604CC91E25AB253139446B7A121B934324B6A8A4081202885BDAA0910B606D6A4A54AA7A9D43' +
        '16CD1067D6B4099DBAB28ED5979B235A92A61FC3119529467D02CB299A2D5D83A790220A3D01EA3EA0FCCEB760111B8B81A526BCF866D8398D6DE803CD09972D' +
        'FBD53608A15432D791082C2A0F29AA3A20162D0FC392DAD7B328826C9AD4086C2BEDE190BBD2A2C6B58DC9D14811957500003D84862C8F05509682C4051A08D9' +
        '929146964C944915C46358A772B68DCC68CA5DD38021635ADEAC984120245C140026DB7EBC2D4CFDB21082E58A0AAA3E56ED903108A2CB08D070C8329D15B3A9' +
        '95C8DCC7B24E92436913C39C92157F0CBCA0DBEF99A9F92151427883207A3654B4EF514BA19CE4C89971EDF20BD5769EA1FEEB995EAEFBC0E8E2805E1C163C82' +
        '9C9FAB29CA9455B3B22E65A35C04599600404A9A10269A6E91A9E06A3891BC146DEDA4D31C25343335B3D5AE5DC46C763DB24324D482A5A181515490C9A200B6' +
        '0A6454DBE9E3E72C89C46975606A51664ABC21FAF8DA66B0B98542B5DC13F32B028B4F06F30AAF31265358819E2CA79447F93C385F445677698BAEBF9481113E' +
        '73B3A4817A88522411E1C3B6DC9D35F78B9D383DD351B8D9F29D18544E0873C80420F647FE7CABA1A4DA419212D2D20600A0D0240B420060E2B2305880928BC2' +
        '0306CA9D532174CBC6493878431D8ADB0098F6565AE1C86E713B40DC9C999D19158D4B66D4BBF8457600B04A3F7AEB96C4E4227BD92900DABB8E7BCA55845286' +
        '0D0FD09571EB15498BECAB8EC0046EF9960A3CFD9DA2C9C3CA7076E6F181C934D99E9C44B027A445259C00845F891E2C6312D8F59C6DDDD5955A9FC6AC17C372' +
        '9FB661604EDAFE621E4A49FAA4DCEA78000C64AD89332C546A05A3238DAA6075F63A67DADCA6EA3678F114D83250CB51D9922EBDCE55CD42003898330C577558' +
        '01A4F55C623BDBCD45B92155BE23C5DDC237580D999882ABEDDA76CD36606FE83BD52991AD459FA96DF7C6E38C8D150FBFF4D4BB41EB437720B441292AF6B4A5' +
        '44DF2724A7BB7B4A00D8CED71B3AD2D11DA0D5D9AF7B216B5388D23B494E7C96738DF5067CF377726E051AD0A81ABD24002065AA5C1A299A59D76D9B66D026CF' +
        '8EE1CAC11CA0DD802941318951AC554BDA91463BA7A4A70904B3D85457C8696B0BE307AE71FC24C7CB549559105AB57082C0D88999BE8598D2F3119B1954C46C' +
        '9B6745E569E393591924D38B05A43CE166EE9640C7B31CC1F210E586A6214AF2648FA3B170B9B88083877E233AA2B3649E3396F740413B37CDE07B351010DE3F' +
        '116B0024228543B7C9739CC34377AFB10009DBD5483CB8269AA10966B161257388545486D1B0C51CAA923432C60CD0A943716D9564969D4854BA696244542565' +
        '197764ED1860E685D61AE6448D8214C7EDEC7848E4C64C954C8DE2B0E3F7ACB8F9D6A201D367228D7B784B73C871A4AE29114AAD1B0A85F31DAC24CF2559DFDB' +
        'EA9AB16BD53A63ADED642B38023D06ACB4032377C32BF5B90805989EC639A55797F313FB94E04C7DF5DAF1BC9BB3F7510026D046880625B36697D412AA3626A2' +
        '6556B6233596A4813482ED116395C24D322AF09C61114B584A4914982C105DA805947E4F2336119CE7B1969DA622B1C21C1E5394CC4A01E63333470AF17679DA' +
        '381FB56D9C25361E6C78CC21664C3B851A4A1A04BE8F991F13D580903B85A675AC265E1B0AC0B2A6866B17FC3A65705828A66C0A8C9AF106CDC7950E8AC2A6E9' +
        'D52B08C472447013BC032A5F2E226E0A00B661C8AB96C8155D0DB5A7146E89445A8172B2C2D18C01CEA80A4530208E2D5B698A1C211400582E58696AC4829319' +
        '12574F8CC4DD821CAD480A1F1899A2FA9BF24A196966D8C42699D6BF4D09ABD279B16619B0CCB59E07EF8BF06AB50F9766611841A26676080D0F3955E891E183' +
        'AD0F7F22A7C13699C515F2F1B440F2655B4DF68475B902B59BED0896C5F3EF46643DEB7B9BF8AC1AE202754012998BEC006C0BB96A5AD18ECA45760DD3E2C462' +
        '90E28465028F99AA09954C13E95CCFAC22ABE154568DA01800D14A9BB90E58280BBDEB7C99764D5BDA792A20078AC604C40837C0625B323BEB35385ED1DD101F' +
        '5323320D92697F69512EC13EF146A9D49FCB6B98D72C9AAB393C694A891D5B396180C59CE75C251D97B929744683F23494E8DA5B973739CCB04BF31B25217E94' +
        'D2A11B44D617271BD4E820B0063299C3005B94D6719C295EB12045121BC09010A5599B60E6068DAB10A9C1CC4E2AA36C62D299A1622E4020A89AC5CB54939015' +
        '02913A1AED6652864A32B1CA1E62438366A790F690F887F823317516E39618AA166EC4314952992CB9ED42E3BBB6A42D47C14DBCA1B40D5D58137E1EE41328EE' +
        'BC64EDE74A49548843A02F02476FD5E338F1ED913493AC1D428BEB4D306513B8AC16A1F4980FABF21222AC57BC31B42C00E0BC12189016B3A36C0EB28E9D93A2' +
        '166A261B1C76DA92CC0D534303690C0266C31AE2D1600A4382B170DBDC3A9403058A998DF952D2F26DD80636CAC67B5BBC54E7D130BE1EFA407C98EDD55E34E5' +
        '83159DAACB9E25BAF97A6E2BB3342B25C173923E5E1EE37EBA0A01BFBC36DCBB6F11057638F0345CE41AEEB8482F195CB0A45D06AD776457D6A0E19A16318047' +
        '438ED93AB07E43B6F45A942682B217BC002954A79E5038C5268753640E311C0D653921D03A43892B45E03C98AB5AC7683B26AC24C298668314DB44942B0F6D12' +
        '0B11F32B2ACB20F0F101989729066E8ADA692D0382DC862A0DDC1DBCC2CA70F3CE38D91D304F6949418238FBDAF52456127637C4F422C95C0ED617A191A9AC2D' +
        '7D5AEBDD41605AB39603C2911BE3FB7AC0E85233AFBE259954ABEB77DE045C10B9E117662490C6DF0F5E908E3BB6EB21012D9141F64475A49796313818750BA3' +
        '0E6D5AE46A722B8C619524936948B5828249ED9C2192347BA62663480B545E9502FA0210107B358AA4C07022AF56FB04EC4C67C24596D1D6ACF17E1580A8D6D8' +
        'C74C02A2320BA0A12DD1451EFDC16D2489E6D1F6D9932CE1BB2BD5192F3809B86994DE7E1FA16CD45DE79917E130713867B8B4115268F3E897E53002D6AFAF57' +
        '20BFFC8E11219E72C11042EFBBB8ED34006939D18137567020BB746BD74C56B3A3A5C492A8AEEE0470802DD46AC4C2B467592E23725436A825DB71CD1C795663' +
        '1ACF9C61B79BC42EAA73D2EA215946042F9951E12779B878DBAF9819172ADB75DFAB0B166440D5EB06CA660F0A02D996033998B663EAE79E9891A9C4500F9CE8' +
        '602E1B43BC909757C79741A019360AE3AA5AF952028C5D679632AE9CBF7CA6AEE4FB1E2B7AD46E7DDB681C17F837617B015826B7C6CC4D9C85794B54240262B3' +
        'AA5462753144CEA6164CD574636B2309BB789ABD20A004CECB5801290DD7603B1AE4793FCD846950C5F8AE5A028461A513146E7E53FCD5A77B3CF243E5971DF6' +
        '0C2145B8A595AE75ECC09BE0D977CFAD1E3F31744CEB48E10B1652A04519416B69864F8DDF92D403AA93FCEEA0BF0E9244B4178137E381CBB086E84BBF2A372C' +
        '28CBC4D81B169E6DB32C60ABDD1DF779018C0A770E50081BA8922C94522B554F936951142C158BDC6692466536B5C99943A2986574A849DB261A5B71374524A7' +
        '087908DEC1587F7B1FA30F31EB49917709EE67F905B1F2C6188AB86ED35B21BE5C0428576886E03DCE21CE748A1F9B8728B38A2FA5D93ED675C8A26D48BF9A7E' +
        '7DE8283FC8DBB7297A897D5BC8C882866A0D94A0729EBCDFCBD1378DB7225901F03510589AD304B85F78640155E6321300A1A01A335815CB60A3592C95456651' +
        'AD51557159262D34D8031D5419CC6E66BC49A868AB039B786915069045A9B5CD18C4D69A450343F80B407067B6108A8B035A490F6FE2EEE91759E11924E8996F' +
        '4E674270703AFFB2B827E6C11F416F1D7A1CFEA636A5740ABDC821FA81009B146B0D779FA445320BAE4685FC78431B17A13EE1367E88AAC9083B5DC875610D90' +
        '5B82616C90A9703FC34F9D1DE63CFCA500AC9CB811D1315E8B4C94918E91515B02D2B499CA00F1B0619D5B131048B624EC262DE0A166185A2EEBA11D5B422E9D' +
        '0A61F12F10A34A02148424DA643CDFAEA70230BCFF28D69D9D7FFB4CF2F74A5DA322FA76D077738BA6CA884D0E3BCC334B272E30165B07104D9A3277FCDEA3DC' +
        '7009FD8D2F1246394F0203E07CDD7E68352CB4A8F2373E36CB57FB8D5B9CF2212C2285B3925FC70887045DCB888F322900043ABA7361B71A94CADE684F445C79' +
        '6B6D95D1A4C5E6D69140C91498428808596B006890EB00A4343A694AE680B091045AE6E8E7596FD0766618F325E1A0081B09F7CA6CBA0A6E2A89FC75A49B1FAB' +
        'D10B6E917CCFA073A3D06642ED3B4F6FAE64C777A6D5D099453E5629207B7EB4BAF6347163445FD296E257EE44D40C77D93E77B47141D48A33F22F12596B90EE' +
        'DA1DD940622BB8CDEA9EF2E28FE8B70300A2A9C0E30073329C69F1D050F56C185D3339266D202A2190A392A8B38BA8B6C9A4100A9135D02D89D144CA0A3AB2B0' +
        '04809BAE0A0C26EF654EDB73E4E5FAC3D4F187B109B92860E7D45B9D97CD767F050937E288CA40B0CBBB4B82BD295FC510897E34FEBDEBDFC3B361A1B76E66FD' +
        '0D371F22F1EC27607928048EE1B6F8DF31A0089DEA460F5C1D9D999EA888BA444D2B5D0F65A8B4A04815939B9E8B5453004549A793B94671971956047A343A12' +
        'A00A3374E3A073B938D42C62935DD2ECB269AB36AAE9A086A39DA265C3AAAE2A13C0615361C6092A31DA3CA5B380856CAA18339CAD74679F68AB5F1F053391F1' +
        'B662993D47FEFDF62A0A2A319F360CB13CA013C5F72A00E4F4DB2DA15D47FB19C016D5AD135D68B0B8172402E385B6CF6654402305B7F3C85E3F1CFB4714989E' +
        '8B8DC15A38D91B047132AE79C0E2D65200B683808E82362D84D693EDA4701BBA8BD104C318A2C0EAA2022C3825BB19A94064CC50944BB552696D946E433BA6C3' +
        '141798E6B1B936128D211CEA002710F4A7EC74FD2C1A770E38A56AF28C927919AA4C482C7B05E2EDA1110DA18A535B665235D26AEE88D75B3F17BFA4EDECF361' +
        'E92DE81944134671A9CFC28A1C9B1AC8861DC039C99661247BB54D93B9FA09EF31D50A08B85CCBFFE4B5F9CEEAED72BC006998388EA7A2EC5432434074CC3C44' +
        '856054CD8C8DA8527858595071B8941B6AC1E3B22629415623668D84448990EB01974092564C2127C10082F2CBF89F83E5D857BE00036455785B74D0995C3579' +
        '6CF981F86C0CEC94572337E34F3913FE2DC5C781D0F9623ED1E6FDBB666353A81EC6558685A50BB046FB4AFF51C88001A3354D7FF73C9E6949881BEED09AB22D' +
        'AE8B3ACB38C68C7ECBA90ABB6E6CC68600C9340C8B0B2D80D5408020C6B13A8BF44A55611C694B6148148B0250B10C748A41D4C64AE426A0AE5B654090A14434' +
        '02413B0DCFCF1F23176D48EF1A892805B9484D4597F7116DAAC3E18220AA9AF796F37F580E8ACBFC69BC1BC4EF96F0925285220DE1E4C0474E672162178C97B6' +
        '542565D49AF54DA4222979079858E42A3542DDC1984E88457E362C660A17C03C4B45DCFDBE20A8F82E1B4463428CBC8A01333588CD1C4E4BCC02AECDC4AE9C8A' +
        '45355A29178831EC96569A159367A27630B9DB0C0534412280E805E806299E4704'
    },
    {
      set: 'CROSS-RSDP-128-balanced', file: 'PQCsignKAT_77_13152.rsp', count: 0,
      sk: '08B491D9C18B8B33BB3CB17AC74574543152A6C140B79648873B84D5A742C70E',
      pk: '4390C28ABC4E13D1E9DED0AA28FEB731419D32482902951F96C5E20E6653F77E98956956B00CEF6B0146202D55E5FC4447CB3758F24B6CBAED0F783F227062A9' +
        '66F26A5BBEB566AF07A97BE00E',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC868F468C0122C00AE15F7AB0410BEF08F932D20F2B2FC7E907B3C091DCEE7A5' +
        '6A3AC3B9E5656CB0ED41075F5B18ED44E749655B073A6229818AFE71795660AD5080A39CC70A3A1A5185B277843400977BF59B02AF2C0DFF7143696D88290C6F' +
        'FA3F8E574CCA58917180D94E106D079CED6F5AB70229AA890A158EB7C8E973EA94829E5BBEFBCF245DF543801E529C5783EEDA54FB33B7AFA4EA7D95B77ACBE5' +
        'DE1FB5388FAFC56F3D13EA6DF728AAFB7F76000FC0A8AB5D4769CD13B61B9D561DE19F37B309363BD542ABAE33CC0F3DE6374BDDB4E3D75993E38CB8C247A8BA' +
        'ABD2E815E490BE33DCA797D360CED9FC0259483DAB0D10FE875811628C2DB5B31AF8151F790FB841630666264CE769E6481B501D071EC63291F065518DD2C1B3' +
        'E988775A0082E0ACA9A317AD6701F939819D36E84606620A1919401C930F3FD4C3EB84FE0D449C7A4366BED41EB42D368500C7F53EE9D4D922DB0FE394179C7C' +
        'FD0E271F75407F1E939C13D68DA7F21E6619F07F4B487CE0D2DC9FCE4F173B52DF1BB6D2617FA5D1A7412B04755E60FAF1210ACB725B7C01C97F5E4BFC43983B' +
        '8B0035BFF0B8A236D78AC3CBECA435322AE94A1EA659601F8C38B1201D4B16B33316497C780FE3B7367AE3281ACD46A3712FA188A42527ADD32C0791229F2837' +
        '890BC4EC068F95D4E7F62339C243AC9DEB90D5C033C7F37BEF6E19BD1CA3216BCA5C175EF8CBA743A9F67180D7422C1E48714BC22C4EE32F272D039BFCE6F912' +
        '67AC68ED6D68BF7EA6F8124ADAEFD66BC0EADC046AEBA77A521E4412B6BF4415E9D912E9806BFA85942691C718118294141C101D6D241DADF2E481A66E42E53E' +
        'CC5DDB5ECB49FBEAF96DBD0ABBC976B303A5FC24D1892D3A9080863C798BA2E09F479FD75A7DCEA71A59264CE8484F6C4050D35AB930A7E3531EB9AC1CD95E22' +
        '3F2EFE3230B46E52CB2F3B7B65004AE8BD740FA268EE984A6764AF04EFB5B75B6A9EFCFDD62341D79BF5AB56717DB53FE10B84E577CA823837E63273E5B6E3B6' +
        'BCA4E4195D950285E8A26DBF684CA55E48669CDDE24D8FBDCDD354ABB7D604B19DAF76064055CBCA2A02F7632AD8083507C12D244A1FC4FFBD4BFFAA481EDCCC' +
        'C37C6FA5E63688D0B15FDE4F4D67F04EC5ABA42A71E5596BEAA91E1E4915E559FE860091B301333B71750378E90A1190C5C0D650AD7C76C487705D5CFE4117C5' +
        'F7B7D9F7799694206AB44268DFFD6ED8DD373CB3FDB6A119811483E9F17AF005988626D9E1C94F88C796C10BDE7E8CF5A8ED522D3724E1E88AB8BF8FAF3D9158' +
        '097A334A97F2A0E15D8C1C99C1597FF5FAF9346076B805D533AA6AE1548EF23180F4B0222532AC3CDECBFA57118B7632D54E1721A0E070F98405C2D267BD89A2' +
        '777F1AC3D21DA49EFF2D7F4E028AE434BD69FB2E230C3C1A7D123E032233023DB9621A469071321125E977BEE8788C3219E2F67FEB46CAF0BA3A82DD308FA518' +
        '5C4AD67F9400DCA26FB07530B3DB9F842D6DD56CE18E03DB18783BE222B06365F9EDA07EE0306B4989E5EF462AEB06E7E17AC4B165F95FD56A4119EE5E2753B6' +
        '58E4041E74DA55CEAA00DC4BBBDC534D8261757EB2A7457B84E760B95A7D22A7D89CC631F6FCE03E5C54B1E89FBD3643C2E953EF55319E4484971A4FFDF6EEA7' +
        '251A1022EB1CC39A479404A80293CC7C1FCA87DD9D636E764BABDAC62C2BB1113410B2477FA1B7727FBA9B2158A4040A3FC89D989DC01413BB1CFEF5F4620F79' +
        '6DB4617A85ABAC84DE3241EA3500042530A01817BEC95A8D677565DD08CAEDE9545D1CA55FAE29A99FD64FCD3ED43528763FAB9B717B1D47FB6542ECAEBB024D' +
        '49D33065E2959B48165A2D8D01F0909FEED69B3FD1F8B6A0FB459EE6E5F5D436DCFE41D255731984468A955FD9DBD7FF2B1C86EC977FFFEEE450A51F09BBAEA2' +
        'F2377907C93B879B7E6AFC559E9767580F0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '0042E8B08F992334891EB5BA8804E8ACB0D0D575D8939DAE3261529F7D07F092B04EE03C368F51BD300ECA205321899C535D78130B1A0439302BAF686AFBF9C4' +
        '2C61AC48131D1B5150799256C5E74E7938B62A89CA29668B33B0817547C524D967E834AF42953BC966FAC032D0B62DFF1287455349AB65AD1F81A21410468DB4' +
        '645B4595C84D2A5B97A3BC1E25592597957562E02314C6EF3EB6492A7781EA51AD7F4E158AF44AB4A10688167B731744BA98CF74B75EA24D9637932FC3CB29A8' +
        '45191181F4EFFB15F0E65F991F1CC823723ADE76FE5BEF8245955C924CC63A45901A07ABA0BBAD9237771662C25180F4B2BB2C99505D6200AED0486DCA84813B' +
        'F78C4D01575C24A994AC2C99173E0F3E4446C6729B6F1C5FE70F3B9131EE460732494B5ED7225572529C9998D3C4298D15D804D51A3D2D32FD9FBAA616791929' +
        'B7D7A2C2D78E0B15608D19CE6BCC75D5336C41A5F5D74EE2C6FE185302EC9779CC9C19701B1F913F61B6334ABE51AAFF35758D46BB0D0B551D99C405456D9B3A' +
        '038BD77A2E3420DC1BFA687743768EDE4FBE52C2F9A073C7FA5D3C7FFC530ED2B0408696BFB91D51EFE133AA83C428C09874D3F5F5FFF4B5A9B82A69D9BC737B' +
        '6F6C97EC4896EF15F800C982A7960E3F3BB446AEAAF7648EB8F6EEE6B4D503FB939EEA1B808F8EF35A00FC13D1FE2DD8A205CF3CA0C3D9ADA47C85FF14714F2E' +
        '1A33C107C7E3441C9F9CB1636B1789525D07DC7860E81D655E839BA98ED3BB7879673B080D3C59840FC30B8F0DD51659BB7F5AD6F586FB0867DC7950AB9815AB' +
        'B2882F596FFD41C8378D9FBE5F3485D9FD4A7336F637855B956D049A84C81B938AC5653480F3F549C687F9F489EBFD01D791DF89F01B23ADD66714EAFB143C32' +
        'A859EB4D3C802A8835D11D4E4BA05C4589483ADCAD839B6988486B1DA254EC6BFDCB00B9125AB2D4CCE13EB9F137BE3BF741E92F5AE223F634055EC97BB8719E' +
        '37786AD78E0F8E5C0C6F1149A3FD73B2986F09A321B89CD5B9B8ABEE7B2268F1ADB180A9F4710D4633BD3CB50AD03ED1EBA81995F9A76D772340ACDEC35C0DDF' +
        '41FEF78876FF46F59B0EDFE91F3231D3BE3578A923A938A278C26E14D352921ADA4FEBD702F511C1440398E5354822E7ED38B0521D5CDA6A323031C2678F4CE5' +
        '2C8A62F8E03362B58B08B9A44C26F871C46AC4AED4B4E83C149DB1A96EF5F61FA8D6C04AE0A14574C8FCCCBB5CFB09982AFBD3B50571F052719D617885CB7BA0' +
        'A1807D9BE78626E58838FB5B9171DA7757212D95089DEE70087EEDCD55D8B888FE42017DAAD4C4F9381FCA33F0464B40747FA991ABC6CAA41A2684CB45C23BC2' +
        '933859971B9EE4B46BC92058C8A89BEBE40769A0BD66F189CC96E67FE6D78F7DF110DD9CB1B70E2DBFE757E0BE0CB79B8AF85F4DDB9213D45D194FE3B4B5B834' +
        '2B10A66A4A75989B06F8CFCA74D7F00880C8B91E7590523D691637D20935E9AA1C7E3663BD751DBDD158BE43947E1CD63A99CD11598D605DB6F0C19488357849' +
        'C177C671EF3ED7A3B1AC50D6868873C017FCD96AAE0601BC17AA89851D4A6C5467C31EF20D8242D6583CAE38EE0A9049FC540CA5AB23FDBF318737A8D0C8EE3C' +
        '74B953931ED141EF31ACEFF596BC5E1F2F320F607C96740DC772C9E84CE50E633D3EFEA439CC2AFA71D9BD88A999070DD9CA91462CD52AD50A68AA1C05A4F3E9' +
        'FDAB81414047D0F072250992CD9A3CE01033DAC470FB3A5EC44C97BB2F77D994047F8E83F8A2AA6835EC8C01A4E1E75702F881B8E6ED8313CD25A97075420F12' +
        'FB9D5D457557C6E3ED11B49BCE375C151CD9296AF30AA47768A2ACBA2FFD8D7028029ECE0C0AC14814D41185AD325462FFD15424325A6F91CB0D7CB1A5F680B1' +
        '41999FD55E673F329B1F65CDF141FEA73B6EDF7A10C9A83CB068F36B52650F4A4970EF899B604030FD944C7B53F479FD383DD21037FCECC168DB2651D5C7F826' +
        '641BD6B80AE612F2986E3F2B288B3FF8DFB1D2531DC598FD6D88CB6DEAE47FBE69DEC67899B65DDA429491776179E4942153A15154FB70AE44D84A4027B37790' +
        'B848BAA494D0F252600013E948AA441E739CA4596388494F9BC059AB2C32058E1D666E4FD9AE867B8E3D98BA6AAF5185F29C31F3232DEE0FCFD236CDC16DE362' +
        '5028F1AA40E1AA0FBE683217BAC2F36C15144C8EFE67AC2502D7BFE5F8F77302B150FF907A34D872AE852BE9BE47D681BE7863A1570261F1333B67BCFFFAA8D4' +
        'E9159A1DCB0D404C283472010BB7F4475549F8FF1A9E0ED07F60B76AF1177C3B90B2F6373E7CC113B95CCA4FC9F1A8DB3DD1ABC3995150CAEEFFDEB6155F608D' +
        '670C23E905BD73D51523622A9DAC86A6E0D3A9459FB4F65FADADD696B143F3A0EC6D951C4453E19904F6F63334749C076382D44DB948C14F529182A755BBC1EB' +
        'DC6A2DB3715CEF4CCDEE9CB8222CC273C9CC2C910BE5E86D231664281CC9611AC2613E22D01ED0718F0099527299C39AF8F8D0C3D9BC5878598CA4AB1B2A5352' +
        '3A3F20AEB10BA7629F1933ABA9FE853FC697AD1179537C5065AB67CC623A19ED2E63688E85E6BBC6EC7C3AA403A107144F3DE6A6794D06CFC9B107E336D69F60' +
        '4E8903E9D8CE7DB3D281AF634A3185F5AFAD0889B70AE7F222ECF4D8C8560B146D8E559F9CC2B17E9706CF346F8204F374D8858D83627E37FDC4977CB2396546' +
        '4FC6EBEF11A20CB8D0D1DD18F282D766C061F096229E2C2005D9C86898389EEE33B632293EB36F07B2995B4A16246C933E0AEB5FAA4D267E1EFAD17CBA6E3781' +
        '882FED2EA3F25A7D0FE74F06E37CC66D4814AF03147EF4AF4C396CD27250263B80EA758336C081BA68E380BE94D90BA42D725CA1EC27F43BF15C9BA9F676F83D' +
        '7EA787074192835BF1EE35234E179022645098336C30B1823188990F17A982678821DDC2C79D861E2B752D21CBB2FF5508FDF21943EB968A76DF846FEC710081' +
        'E8C2AB149AE592BE7F78253EA8CA61F77F66E58F89F3128A3B67A6C2659F5DBED09114CB61EB5C1DF0889879E2188691C1857007E4AA093D8E8DFDAAE80123D9' +
        '22494B036A693581F56F5E2D063B1B352FAECE4DBC17C320AE7AC8918F99D0C72752BEA23E8DD9093F3D1E9C52F7081A660C7A28CB11065B27E217BAE369A23C' +
        '4C61650E622D8A719BE3A44D8818316B48CDDCA03AC8AB30019D3F8FC436A695C957A6BF2F2108282195FA57426E8E9BD4EA2D2E44407BF0B5CFFD69061CACA6' +
        '3EAC58D716782DFAA9F6B0FD1E9BE7C35549B432B22948343DDAD30D0A82F0CD2B2CA0984E5B51089882EBE89D9AAB3DB057CC3A096C840A208916A80A472F81' +
        '137E91E329F57C62BAE969148DAAF61A53427217CFC9C16A7E5284B6A99B6649B8337210E2ACC2D1A3FFBB5515379DFFC8FB512A8F853EC32E94CCFB624C2F05' +
        '2607AA8F6CBD68940BDEADAABA566A89E53CFD231DBA74015814DDDA34664E054D6552666E7017F26AD7333B0328013A9C0428DAC4F9D50C398914B68E59B3AF' +
        '464362752BC512F313EECB77E00A7A56D54C79270FBF3185ECBB4D39DF3B5CE98D840E5BB211929E622C6C0E6E876681A42B1F6DAD6D3B1C5EA5B2907B7AE3ED' +
        '1C9C7AA5F59CFA097614E12F1EB8465F156A053BC0DB577DE3D6E4D07DD989702000000000000000000000000000000000000000000000000000000000000000' +
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
        '002037D5D887222F7F889E069AC096763AE3E66EE1B755E5046940CF5E04585D1740AE999B015E8EA1101BF8FAECF6C82314FDD046DBF679AFA0791CDBB6E4FE' +
        'A47A91642BCB4CFB72EED6FAEC4DD846487650F45BC443B5387D8C466B3482E2020EFB1E819D2D3578C29ACDDB233CFF6DB5B3FA707C84010F67977B5557A6F9' +
        '49A9689AEE2B35A034CAF9E3D74B8A1C97F011CD6755227298D3E12643E91690A98F0BA13A4A8E97A7C3428764F3EC58782279DD721F2626BF73F6CD7BE3A2E1' +
        '24DE987E63F7E3C4588DEAADA3DF1091EECD950571C1AF53F8892769C6976DB49FE7FAE7D52A1871CDE665A2F8CD814ADC3ACE278CE5887851CA968B2487E017' +
        '00E457B5DDBC4EC711D9D38ABAD62C0A68C322066F7260CB1CA543416323AFDA9945A9F757729F4AC2333176FD0DF5511996D2B24F57ABBED39D59CF362393C0' +
        'CDC41435827EE8AF38BB448CB5EC8E5F2E8F00311EBCBAF19FE847ED9D4565374FC1E945360A09885CCC6B8D33F281AFECBBB8C9EB8E89C0FEF823B6ED17166A' +
        'FD06FBEA04923A8434469DBA029C85E9D9B68D56AD4F468EBBE31CC9AD7CF4767B509B9FF996396F7E414BFCE5847D7D013C9E229BE56352B101627E98DB75D2' +
        'D83BDAF0341AC2859FA0F299AB70753A9A628234611F3CEDA98679F179F1F463046634E1B923EC0B4E6DEC0E09F57CC441A4C41DA68F2102C608BAD0F6F727BE' +
        '76A54180D6009A81FC2479214DB324E30AEC0A4F33C7DE5F761C27A9015C4A3CF75C7B7559DF70444D0663E7DB47ED739A63BF95383A709436D02AFCBEA6CB08' +
        'ADACC07910DCF88A29D97890DC1710ED81E9534D114BA1825581CCBB19D1C2AF9118A12444977243ABED781B4E6A9EC05338E99AF064CE23D196C788671A3C5E' +
        '1D0488B7B5CFBADEDEC06894CE7A3884103F35ADDCBECD81CA014A26EB8D93A7C9065213F769E3EDFCA7E62CD06E246C3A245A6E93E720F784379DCF7F4A2443' +
        'CCC80DEE86E977A0A4E2F5694E507DECCF06C6D3B9251B55D66B0CD7BD2A3C4D84EFE90F5E1540DB30895DDD1E392F54B6ACE12213170A9337DF3ECAFB60234A' +
        'BCBE27014EFE96AEBAC276EB3EFA2273B4DB2AE0C143012BBE811919BEA5F851D35755B25BB332AE414A876930B3005F83A5ECA6A5A7EFD18C0C32DD20BEC85D' +
        '381FAFFEE72A9B21BC1C35E09E06C95EC793426573C53E74F0340DA64FC4786F19FE4BDE103EA06A425C363661A44E67E38D810A1E191B1A5C569F5A44780E6C' +
        'E44FF85F4CA07EAF55E2990D2F5C802A0CEDB7EFE33C367A5976EE63F4109AC52741093CC08E08964B358177D77CBD4E07EE6DF7B4EB7B7E4E9C87199598061B' +
        'E307D57E014C4723AD3ECADCB48B2C04E307A4631B73645528E350ECC37FB7FFA56BEB728B86AF21746D3A7F6457D3FFE4707B5BFE20B2FEB988239AC7C0BFCE' +
        '1CF8508BCC2D7022F8FC8E637F69745629AE08647AB67BFA34E9BBB42214DBF5F48D0347C3FCD82B6F0D9A8FA9058AB5914167098A734E14EA8D793E3B018841' +
        '81FE542A1BDC402E006F19EB8C650F64378DB173AF11F165C10235E07CC7F77ACA683B4B0BF5D9609136A802DB1214CCCB3388218628E9DDD0254242D60698C2' +
        '26DB676B1F2DF803AE0D0F695F69301A108AE17ACCC80FA1E8405B475737AD34EEAB611FFD2F467018ACCBC21E51A367824E28868E6E686BADB8ABB7490EA93A' +
        'C37B8937DD8C603E7B631DC8038B102DD2610DCA3DF4942CF105482306C44A2AB5C5D5A74BE73FAF30864F4253BBD9ED348DA9F51EB1441AB048BE8E27EAFE6D' +
        '5163B0ED8BB1F09F9083128BB9BC3DC162505A402DBF462F80EFED24EBEA8BB504E57B7E1DD537CFD7361ABD492689E2A88ACE3C6EA44BC303DA54857E0B1FB5' +
        '0CC8B4B70CFC721C5928F81C050CFCE8AE6095ECD3B48896B0D982B79E02DA71DDB9F657048493F29703D2518788311D893C8213775237DA88C7D5A1C9F1476E' +
        'A6565F0059818C8FADAE1C7CBF27C9120125464375C576919055000777D3644B1253C033977581BB4D6026D41805A50B6A852C19A575588BDC38182D822023A6' +
        '0606F9B5D6B3512D8503ED9281C1F6EB9628CB663CA9F6EF614F5CF9AD11E35BE3E427ED97D42B3E56FB1744D388F663AC14445E1D6320FD3A22F311BC159CAB' +
        'B55043C210719A6D98C849F8E68B9D7A26012DAF0CD3E414A0B4209F2AB9A8871DBABFDAD2924C552DD49DF4E76DB802002A3A2058467576CB160D41C81CE064' +
        '2D010811135B069D8699414EA41B5295EC75300513035D4AE5B624A5E83A182C0684AA471241EE52EFFC65D2D4034AA80A1CA669A01F99CC5878AFB8EDB415EB' +
        'A1C5B8F8D7CD1CD1B96A1C4A9204554F6F14895BA6AFBCC4B2E63973F3CC07D1E386524E4255D2DD944BB467D83B1E141B0EE0DC6E3FF046D98BF39A4CDEF371' +
        '7F501F6D76A1468192FD73F19E4947BF01803A6EB567B931502400C7445BA76522EA8C8C94C4959DC1E5AA8EB0025A1252A81BA72C32D3604BAD355B68803347' +
        '0E1534DA5D79E668A44E0301BEA287102F44B57D2F67BC67044819992A73F62F38BC2D344196CDA98784BC8BBCB6797E7261429ADD53D088C04B76A3179CF880' +
        'C9A87AA36723001B507F3FFE8A1FD272E90893D621D73ACD2A9617AB4D3AA393754F03C9D7E731F6EEE858324C9C253D00334D23F48C6C52A8B013BD216CA129' +
        '62C22995BC5688414C16C502143630B2951490CC82E12ACC351B6486447098410AF0F0D9DC95A9C73E66EE2D8EF0903D96D83368E4619234DE9B082C496A270D' +
        '0C7ADE55C11F4AC46A1026AFA211455892354B48A4B9441EF79A122A8D7840C82619CA3126247C4E43C4325304D76A7F3BEC014D6FD6D02ECB23F6BBE8A90B74' +
        '5863D8FA66B7BB707F50A02E834BC7E6018A2AA43485C900C04ED02A4BD244A32B387042D556CA6218C94891A30D4415A4A145C701334B2E6C6364ADB430B447' +
        '180F9319D4306808FB22EA09B8A697A52DD6AD36DEEF7849625855547FBB4DCA4A7EE83D835CBBADE5822C6B98C8F23D1E4A591F380C18118CCE0EF735C15E2A' +
        '730D1FB038807F4F771D9A681561C4A5A4308C15DFD7AD7C851F3E37979B9985921EA7D24E3A46BF79F6A79D57F2796F012D613A9A079AA5006CC9AC6A950915' +
        'E400732E510FEE440911320C609460B02D90723B63046C1BB609B2B4C5556ECA022FFC148460AF31075EE2FC0ACC806164B538A1A414CA5FF6372E26702340D9' +
        '045A6C635A3FF978B0E4F2280C61B57C88E620183BDD66716D916D5C85538290D3635B24BC0C587C0BF9B078752DA02D439962DB85B38763911CDADC9969FE0B' +
        '1662311AB9F1A1964BE4371C114CD05100750B8F634CB78E908E5AED8D4AC8B862B2458520AC5827AE4145706088681521A364592254ECA2A0D70ECE4082F44A' +
        '056195528571CB80A79133FB9AE400806F857B696A890EAEC7E28F0EE0A35CB1AA87D46002F16E261CB044CB049B438824534361364043201A7B0EC58F51CA45' +
        '5F370D1B0E7C7A189B29DFBDE02332B09E9D9849152338550A8A2B903A72CBA11BB559302AF5F10E645CCB5FD7A6BD5001695C2C7439C345B080C8026499D9A6' +
        '05C6C85AD7996E60B76BC7A66C124588802EE1248109A4A0F52472551B83280319034CC061A916A92A9F57D521F3D8C153474D52FD34B7D3945C2E824DAE18B4' +
        '56195BB41DFC05AA580A4AC355FA50ECE67B0F04C4B4DCB6B80B43DC2676645CFA8A3F2BBBDA63B4ABAA0F4EC86C12BAE4FE3B5284F50F1CA119F4BF8FC3A752' +
        '883D6934C06043C346969EAEEC8CE9F7002D283258D18D5E2960D112519A2099455C92169B11308CD2712BD14DBD72B18B04AD6A318E9AA2C40A1B729DB410D9' +
        '100E4FD628C0D15B6D8338A1179F25413086D6A321AB962640EDC661EAC0A86B544A167D1B22F8374A94565618019317E54D35B595ED3897D2D3AB4C8671F387' +
        'D4B0B07ECBF113D94478259FB1F5B9F01A3B036F941421656151ABD34A19DF3C969C6D1E0B8C9C69BB843D3B00DFC7BC0159535B964AAD8156C35541514D6048' +
        '0E6936C2684E280A770CB799B11813598DAC902D39464711168515F6CA2E4AB401A1DC6DF44BE306C7AFBB071556A42501C6EDC20D92A23BC221D56620A0D70E' +
        '14A8C94E3D988B80B0ED3A4A2A6B5399F16CB2E296C4D6AEBAF36450E03DD3D891E1A685DE069AF632AA498CF414304416F5B2D7857C22BD2602205B5AC1090C' +
        '261C3FB826F05B0D2105B0CE80C49C6400768B648A0C4935D0C2A186C05ED405DC2433143C8DAD3C5AE5CAD6B3A6A0813D8228ADC172A7910E134E163CA023E5' +
        '0CDA6C4484779F9011317CF90AA0326A20FF414E026AB6D03E84A2689226DC1461F504A15729E67AE0FF547421BD4F5997C2F99EB6CE899B79864EA4916A0B7C' +
        '4904E4BC4635FC8FFB81FB63A5A163FC49279A67B15B59329588674111DC8C2BC4941D3E1A55ECE9FB4C27962A1020FA001841A64BD594C164C29454061A254B' +
        '532DCBA4A2250B61751D28C384153696E7350AB20919D07AB011250A1442B636172F25970C3A766F462BC0FADE400F29750B882684D1743EF7C0780383064537' +
        '1CDB5F0A5A405D6E4AA04259E8779476B93043076C97AC3E21536D135F9B821FAC39792966FAD5F3DABDAD1E6A8289DA3020FF85E5645D087351175D9B622E2A' +
        '46952BEE8379B5F21CEC60840CBCB3B00008C7454BC21A55866E60480E696779AB0BB516D944D6B48D0E4381718B4818B678465A0B2E69CEE18C4A419D18D0AA' +
        '124E38D0093718B47A677A13A5B6C61AF4B24BF500AEBCF2E402ADD79F4AFE93524AF7B51B25A4B05DC5923DFAAB42B77FF5210DFC664CE6408C79CDBB071D5B' +
        '59D4129FF4B179DE7392BCBD8FF4A307EC981944D2C2F23B93F6098C4C85AFC23C3F8354DD5A0AD18D14848792727D57008358014301B7AAC394132A18ED1816' +
        '0EC58ADE60451CB8A6A1DCC4655330743A495D407BC400A219B87982A9C4CB28171931764BFF7A45280719812B5EA2707385AABFAEAC899CC5CD6B293CAD3051' +
        '4632A9E96F347D2852A0DFE462A08A4F2A0B3A998C9DA27FEF133793B11825E3789A1BD085CE35F3B8B0599016A4765F2EF82D628681549FD0A80C47B2B02B12' +
        'D56B7A99CD94BD9FF20F5E99EFEC866701A3C786F04603A12807628A2ECA3A58289BD6A6AC8E81A9C293AD326264AACA38148CCD64412CA89021960D15691336' +
        '0C801597546049AEA086317B9C5962550013BA8076AA85F1F1B6856C8C143E07EF2BE1B13685C31D749C9863E42AAA7E32AEC2B15E78AE724633014F30410CF1' +
        'F5C7B50B564A28AA5F529B346CEF2BEE068C4D03ACAFA94101C9F9ED964C526C56230E86C3297498C900E59F4E0590F901ECBC91C44258ADBD41E61CD543A105' +
        'EA56D10559705248267501C13442B981DC50C9341BE5A4684483390625A14D9408F4E8C459FDFCBC8CC51CE9B240193BA1A72F8B08FCA72BAEE79ABFA18D9012' +
        '5FE1696E6B4D0B2A8F8381159C408537E109C97CE2B779711671F75766DBC272BA4E228C27B25A9F621887A97348653D6170ADCF417C0CBF91B88071DA6B99DA' +
        '36F535425A25FC9D23D12143A74306DB0181C08981505611EC99AD5893CE1479C534D4DE3C952827C6C5C6565D562952A66EF4380564302366E4C924B60110EA' +
        '1879121D1B8ADCC37A186656D63C82CC305A4C42E623C83DE7E07C260DAAA7C98F5EB145F983D6589A662913A06982E1163FE5EF2C0E2C6E8788CCB8F0E98FCE' +
        '6C69902D17158F2119A15F9E81E8073C5D4B2F4B7CCCD8E407DA2E0A6CBE90C7631D1C113AB92222D23957A2480E469D014013C224E94C4357C2D152B5B0BD81' +
        'D08AA8AE32A1DABC58A01C7558A69951633022B822B26A71AD9D2C18B11069650A821FE5CC5134E1357B554A8AC7A2BC07BD5A11CB718FB89B1F79A1B1A2E307' +
        '9A8101E8593254F58AB6E4C5C0A8526E23475871369C9E38522CECF9A251E11FF7D4135ABE320BCFBCE0D7A15A773C0340B805AE7523DB35CBADBC950B57A22F' +
        '0F37B88C56E5A5D878AC66B7ED19806200C15C744B6121598D3500670B1DA226293A201BD1629B612749161A113B6FA2ADC470968885CA600027ABB2A466B48D' +
        '126C4322096EF2FBBE66CC9E31E5138ED5660982560381032FAE1B500F9F6AAB7F0CF462AAC11067A826DD847DCDD7B2CD49FCDFACF0509197B1F42FBD9DA8CB' +
        'CD96EF1C5E081F3A63FCD88604398063D09F23907842DCE2309B6974BD548B1821FCB4DDA54D7DC6981B787F513B65090110D126493879E2B288983C7598B0AC' +
        '9ECB6C24AD882D2AA16A50454CB735F1E6A833A7562864C62C9C0043C369922417F92E15DDDE6E682BCDFD2B07C40B41677D9210CBCABF4532DB3C7C3A18784B' +
        '80EFF3BB79C321540829B92165140BB7A3A8B3A96902413DC0DED163BA9B13BE4B66035BB3EFDAAF07447FB51B8B56D907495B9AB0876A86782BEF0D3162FA09' +
        'DA8011425612DC14C431CCA40438918C006104B58C855AD680B0A5C4918CBAC6B691D2F34AD8B16A16ABA876594172B55005D02407EA4AD8F168A973B11451A9' +
        '19C1B913BC3773415F65831EA1B8FD1C4C72734642F2B54A9E1E5CA3E53F63D6AFFFDD29DC231A695FED6D943C61CD72F30C30060245E571F16D490613D8F782' +
        '4672119E0FD76A08B9387BF17D3DBE48EC49811CC048179A4D09FC7CC8E44C0358DB92042D00E2F595C689A916E33916000AB6861C87104E1CDB5D354A48DA5A' +
        'E554851236D4A6558E8265C7A46BA1459494B3B33049AD500D10BAAAA20A21800A77581FCE711D70A5D18814C95899BBE20C5468893EEF0A4632B230F5CFF676' +
        '752DA59BA99E33C85FED3B356FC9618D85E073FBD1F3551428C47289D5593B0D205C15F8717119D675A8FE29BA1B772110B9EAD24F8D84838677A1AEEE6106C7' +
        'DC640CADAAABE668B6753ACC285C387800C63432942658ED5224625CA72A320D9662B189599B4916D7C01C123267A35A4180A239474085AA52C9D6C6C234E232' +
        '036870AC17D091820B2D6C895A0C225BF40728C35C375530D18182146A4A21F2B594B7508A17FAA77FEA5697F5EEF4BA8C2588E0A9EC35AB92BA1F2F521D03AE' +
        '292423531580387AC4756E793557903639A3E558AE942A4DD21763DF7177C5811A2C5CA954583D8124EAA311E5F26E8700251A466843AD191BA880AC4C4B2A8A' +
        '71878230664B5B310713ECA166BAD8A69C4A0C27B83243B5CB208F85B836D364178D8DF374E67424276B26717BD6A74AD9A039F4C79B3624D444FB1D14AAE895' +
        '7877CAFD96AF07BC99FB0C4B0E85189E5F0551E31D9B86ADC05A9B505C9AFD2C43F33657E2243AD8C6ECBBB833B35AAAFE123CAE46F70486C6B84D57031A8BB8' +
        'F49FF64C505D11CA5BCB7E327C64E35E010B58399599302E562A36B960E112D106A0A6E40AAF50B788CAECA58338D258110D6446D4E6C06286B970A422A820EA' +
        '01E6EB192E4C8214A2768D66B782075022E80BFB8DFA376F501B4DE4D0E5081ED4F10BCCEF004E85AF753433E22D711BF6E03C3EF1BB1729A6F4F2DC5C5A34B6' +
        '96A13B8EC3DC1C56D3FBB75672F836A67F91A8A33BF25E4B2484B1A870EDBA8C8B5C9C36C4CB88814736EBBEA07067230093C6B003B9C84250B11E37642C108E' +
        '114AD28011076A1399CE480AA438B55BD5D62A437B71045901B0140B371BA62510448B63E681AFB695D6F039F239CC1F63AF533F0BB04DC38092F218C7822FAF' +
        '60C404042AC7F21C8B8F5E8D3813616236F023428368B0DE2E0FB7F7E6A3A9BFC119BC7B57C1BF4187EC1AAFC574DA952312AACBAC77D3BBEC250F8C6CC23931' +
        '66F7ABDDEF957E7A0426116CF46263E500C56A6646134D340565486B8A8C9CCC04610453818C6630452BC6857290B10002C70B92146EB962214AAA9A404A4B3C' +
        '13785DA2E6D223909157D94364F87D0845434016BB4B33416F204C67A4BBB40812E44EF0F5077C84B0759AD1CA5E0CA9A368921A7E96EA2360F469F21E474026' +
        '1946B2D27F177FE4C25291A9BA20C7C5C7E358DD9678244639928FE9CED54F6707E5DE217B7B65B505E7D39A195ED52701599250112358EE04B3A099A9B0AD58' +
        '45C83AC4C28A9C6452081BB4B61AB7DC0AB40E51361C5727091085A0854168D704EFC052123048EBFAFD4B5902B48DD23B2213C8A93C142C31D0484F8BFB14A8' +
        'A11D0B3310B9083DFD3DD34C4AE4D44C1E495C698DCC24BE8D4DFD8A4FBE6C75EF13BBD1D2681F6C357630D8C0F441EC6A0684E33EC9911B3E91DF0111B4A853' +
        '6BB3711997623E271D7101FADC8CE0AF012C8BCA62D98C4027B32DE6AE71171660596200E5A8E0B481598AD152988E7031C090EAA4E036539322679C12BA7330' +
        '17E471C346888FC887C88FB3B7EBE1697C87D235D5E42A845C6A514EF6A54D549A7DCBD61F0B31590ED57D9DC2BBAAB7F566407B280A5F8FE10BB14F75D24A81' +
        'F17C6D221D4DD0A4A31D47C2B0B420ED9A268B7934DE51C8C2566A9A7DCA93C349010ADA0C3F3C76A9651EF78B067B6B01920D54D41C239806CEDB66746D386A' +
        '7369A34224AAB34C470E37921B1DCB86D362291B555D20A01D5AD474C4CDA396156950670B3DF1C5618EE455251046FBD4C7D0D6FC34E6CA97382B3E8CE60A3D' +
        '3114D4DAEF9529E9A79D202CD120978C57B320E6DACD2186CE81637A2230C7002E581C9D558BF0C0FAB8ADCD29AF73C4DC3DDE8F75939289DCB1EF6F9427CA2E' +
        '319F3543DFDA3EB9BB98FE6EA5DEFCFE0020406BDC5A71A2394F51D090765B8462C86D12872E5DA8709C65348E696A03D5400502540A8621991A95A6B16145B0' +
        '09B64C97D63BAEBFD86109C9259D40BB8C45A484EAC8BC898709C457ABBA0E7AD005BCAE1297A36BEDCDD53D414FA3EF053B4FBF6FCF98FDF802B3DC61C98CCA' +
        'A41F885B1A8943FBC97968F358B88DC3575D805FE9CAB21978D5187496BA129AC9667A288586E854AB3E02147124254800665DDBB432602207133402C773800E' +
        'D29C309926294B674134608C623074629B907147DB42124B8A2A2E6C353B588A01F266E5EA3B1EE27C3019450F671D8CFBF040E6708135010B2B6D65E83F5914' +
        '01E89FD8175E8A1BEB4E781B07A850A83AF2FAEB3C7E0A6F6C23BDD3C0FCB61E3E92A8A0AB9F1B517FA9982F90DC99D487D0FC895A4573055C51E18CE19BFEEE' +
        '7FEC351408A11B529ECFBC701295492900DA1476489C98C8D222E3C4DAAE94D4155B6E88134562416A1A0A688AB06C8DA220A224B930E5A22E68517595D62C45' +
        '130A0B4802BEA297C91520FBF9F6CE3DCE095C934FB5E1F9CF94410C8DE891108FA0011770986AB95123B898633BE6EB0EA0EF945FA1F4CC4D3D8FFB890E5D75' +
        'E1A407231617016E580C3405EBED5BE895846E18EBA54BFF3BDD07063566B07FA744D5B97D92C53DFC7C039AC18DEA32006C566C150591C85C2D6395AC73B1B2' +
        '9C27CB903769DD9CA8B534B2B38871335D7B255D11301BD145008E0C391574191B126C66DB4B4052E78FC4A6D8F83C27550CB2417CC47A40A8F18152D3ADA907' +
        'AE91796E6384D1602AB7F61EE090552E92A9DF3B4C4C5F5446A65874B458C12556D3B4E0BB9445096F54CF66ADAFAB033F0231403E6D275C23458526BA567BBD' +
        '7F86D26C8C8FFCB58181C810D3D7064E016E11CA63022814CA71CD0643245B6816BA589E31511EC57AF62CC1AAD0B0C2A820614D74D5A62DF2C2C9E6260E5B68' +
        '16E24750AA43458642319E580895B1358B82552D697DD30EB6473E639F618AF443340AE0EF1702D9AA8631CF37E2C3C598287D1D9693D58235E356E99491EBA0' +
        '027122342C7059F70FE8019DCBB82A3090A4A02EBECFCEA41322C52680D56F53D2BC9B3059F4145E30CAE6B7F3B3B19700A86D470085CA7348045C94562A802C' +
        'E4021516E4809B02B250BD6A99C4B66D0365021B4283E99289DB340158165820154BA8CF719D4C79BBF4D8D5B3E4D425E95183D6809DDA323541E6B08784C42F' +
        '515D34DC7BEE1D3F50DE35F7C88F44476E670AF902621F7693837CD6872EBD8CCD69F331433E746AB49E2D452D21C08DAC4C52367B6172EAE7543C8629100215' +
        'E91751002D17911418DBB0B47AE4D98A01480C1A7359B00C2C2B0106013663C695AA86951ACC4865560CA59188C910513D964C3884F6307A1A11D4CC382D9E07' +
        '073BFECCFD065F4B3734DA0B68AF2B874BC16DEB714F0FDA43D8170FDF53BE468EEA148E87B37E85B78BE9C5D03CA4DB38FB2F39713DF731B0C102D428215646' +
        'C22DF9C8487FA366AFBE17CA1E60511D0ACFEFA26698D41461ED83D236866805E07846ECDB74E2639E4ABBC062D3886E00E2C080640AA971414E2AAC148D5A51' +
        '065A914EC68504D70AB693B41A541A0C4817AE62A9AC85128827DA92CD0171B60D3F18D1D7B02E436B9DC5E6C1A3D84FBBCC8F03F4BE5DD601264C4E3F9B053A' +
        'B8AF10A61C68EE7B9D104754DAAAEDC0BB6BE44C7BCF07F7ED724ECF7B94DA495E56A4877ED2EC51DAE5377896C26AF5067E18ED62F10FF0D1030E8893A93419' +
        '4724B2C1CC4F1EA15DDC2F1BC7F7B3F900555A46245B66AC630A2B69312D5200AE1BB1D64225E4CC4842424F0045CBCE042102D9D02359016A0D892CEA612E20' +
        '07E68C0B6509E85F15927A5872CE71D6E5DE065EFF4425FBEC5CB725071BADB45179FA17F2B63742A34CC6EDADBEFB8344A8EA534A58707923A185FD0CD4783A' +
        '42F856AA41A4C29E2001A7570BA22E338F958CF4A603EFB34FC0D5840D40C5D72BB84CC18896BEEA0EF9D2758866020A010B208C76EA94A83D02190A4176046F' +
        '558A9018802A608BB293164ED61472AA94D14519ABE55AA509940D8C3965DE9C11146F72B93A8560BB80EB5D45BA48D2AB3D0C6A5C60512714C9E08BDCC880D0' +
        '02959340368315C0D7F9FDE62255F03BA40C36795AD7665C0003D18032F279872DAB238E08121714ED782412478DD73E2939F8F6D200A2347A93E05FE0C08A4B' +
        '4BBD452184B7678DA5AC480D0C7583A1011E5CB1093217B3415A00603056A78124538F835296AC989549350BE858CFA6C9B21B842DA8A766A01D8F5517497665' +
        '05'
    },
    {
      set: 'CROSS-RSDP-128-small', file: 'PQCsignKAT_77_12432.rsp', count: 0,
      keygen: true,
      negatives: true,
      otherPk: '8AF918C08898CB3159CB2433A4AEE4EAB1D5E532C15234AC3BD482A7FD844FDA07F110697CE1F307B198CD0ABDB434B7C3A548305B5631A1E640BEECFBC6C8B1' +
        '5F66435435F1FD213C9232FE08',
      sk: '08B491D9C18B8B33BB3CB17AC74574543152A6C140B79648873B84D5A742C70E',
      pk: '6BB2B7EB6676EB4781CEB3EB1CAD7D26230EFCA6528FDAB15F4D76FF61DB8079196978CBB196A8A2AD4456BB002DEB062A8E14B59389264D51BB93C8AAE43A23' +
        'E315B20C4225B70690DE42E70C',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC868F468C0122C00AE15F7AB0410BEF08F932D20F2B2FC7E907B3C091DCEE7A5' +
        '6AE48558D064C36A2D049FA36C4C551E6FA2F773B773726809B65D1B63BEAB9B245250C996F4CBA481A1ACC770A0E335177AB940EF8840B011B4A675FF13E20A' +
        'D4122559C8EDB2E441864508BB32E3BC9400A4A88FE50F019EB6E257A072B0CD6480DE16E98C97112230E6BBE3BBFD40687FF435E8B8324A9E34CA3DD406F79C' +
        '5F904FA490BA33F428E70365E65BD2D4F275F6BE0F57111435A80F849A69FA722D362F9AB8E5C9707BC1E789E4EDD6221CA7430210C6F3403F30F31D2A4EA857' +
        '951A0F127810D5E288AB46E8B600041F431606E13BA3D5EB8670B61086826C27151B501D071EC63291F065518DD2C1B3E966998423149B7DC95BB07777BF3A58' +
        'C2EB84FE0D449C7A4366BED41EB42D3685FA0F8B9B7A1539153602D1100E7A3D419D0E0473B09F360F33DB86C225D1ADB74C9E2732E0590C82C321C409E134E4' +
        '3C39FDBAE87D780201FE3247C32B25A929A31439C033CE66D819D9DC98446776050BE93D98B1C7E911DB4F97AFA8CB02BC2B32B9ED32E61B8EEF8B8EE8D1618D' +
        'E93E74FAF7235BDA45392AACDFC4FC84A3E2FD9901108BBA90DCA11FBBC16416563E8984AA5B5D3705CD8F76E13D17D45FB8C00B5EC8FE4AA66014BDC0E6B64E' +
        '55C0330DC4251725AFBFF0F8EB7094FE1A423309A3BEC000BE255241986EE1BB855CDB220808D958553A140E6AE023BE9D08F2B55976E8783C06FB1DD1C0F8D0' +
        'A9F2E7C09CDD9102B605CF85036D1D0A9A4D59C6FB0CB4037EA4BB71A93785890D13CA548E7234CD58A2988F211F5BDD4EC53942AA3DE3C49902835BA2E7ED8D' +
        '2FEF4FB1547C06A71DE400784D721957852CA1940AB42144F49CECABF4CCFCAA115A2A3F3BF34A2593387F6F96D4F04E294F026198EC953172F3EFB00828276E' +
        'C5582B7BC7E4CB25C77475469EF0FB973CB4301CAB8400EAE57126E1A464105C8FEF0AE7A0209449B82E53565313B73EE62711456D3E45D9CD48D59685D0479B' +
        'CEFCAAD09FC368B6C65C857DBF917F3AC400A119560BD151B0C2273038EC88DA31C32F200341187B5490845DFEF55D6E5891FD3F99B5150BA1B1D563EC9AF188' +
        'B253CB7ED78BA012A115988544E46EC16089D902D84ADBCD0DFD775E154C681523B99D96167145F099EE123CC4083EB04EF4517EDCC7F3C029A80B0EA0FC67C3' +
        '7B7C4AE01BB3EE200FCC1E550F0D17DD0F33CA7E42B21E52E2F5C1759AAA00495BE1648F27A01B23CD2F8A00FF43755A5E9275ABEF5DC53C4C4A57EEE1DED431' +
        '39185E2709D9AC11EA2B28C6B10B4E10E03BDB885A6316CA383E41EEC6C6AE8AD6E18F18E212190472B51C6DADC0E7A5B17D48157428C9978B91BB98097EFC15' +
        'E31B237B1F526FEF3E7D14CAE4E591110E82E787E78240108DC803E447A085560F8002942E6D8FC3DB61F5EFE7EE1119552E7031210DFA45DF794C0ECDA4BC7F' +
        'C14294F0E40E58A5EBEC5DBC7F6CD7ECD0C7DC9517474A8C94BDBFC1BB0FDD6637C68CA6E1B1D736D3BD013C51B34A4A6CB52E5D078C3E72CE0CC947FC933E15' +
        'C39CA8F42F03B7569474286D2EDD79134DA9F027B850E1F420C72A331A9F2DF6E1311F57B63F40979CEC542FA9667B5651E912B6A7DD66B94856059DE8E934A2' +
        '2AF38961D2293BCE8676536D0D74A574F031849E61F3CB593E52146994C1E6096020893FB81969E8092C12D0F6D687E72FAAEAF7570322DC3C646C708AA21410' +
        '52146652C2743DB93FCE32E1C9001DFCB250C3C42A3533D98F3859DBE246EBFE497339DE79BB9B19045F4D1EA19F5A3342E193F3D174B286583D709642C90565' +
        'C8D16C0C38B1C8CDA4971308984CE0CCD3B5D923C34EB7DCAA0CB2599E85E2E34D2EE5F938475F9B04E81FA9D8321B978D0D01E86D778851CC92A3DBE7AECCE2' +
        '8FC4084C030F56D953625A0C8FB39C88E43CD3E7745B917F3F2FE3F43DE0AD8207E2E2B0F72E8EA98DBBD7180D945BAFF78E5C5599E761145BADAC4B9171B65A' +
        '229E181693392F078EC49F9866440A2C914145F6F991EBAF728DFC98401B917426CCD721AC911294A8489F4DE35BF6F0D4C6759E55FAB0880F7208ACE566A5A7' +
        'CC672FA2933F5C090BF72A0EA9D9C1E9264F59C6EEB07D69FB04ED89C314E39F9FC98D29A18350CDD1997C3691DDE5645AECD24C495C6E2B5F9472634CCD1886' +
        '17A8AA67858B346F3132FA760366FFEA3C9B7A044C3E1235ECDEC18A17C34CA8BA34EC52DBF82D8CBE93369E5BF5EB2EEF36B901985110F2A407A665F674D8C9' +
        'F55C3B380C6C6CB2E94E3FB0EA9392FAAF9F76D063610EDBFE062FFACF4CE47613A15F59D7701C7D9DD106923E9885E485B1AEE803AB975DB2136E4DBA905532' +
        '5F1E0C1A4F05C680B6EFDC46D84956BA09C48E7EEA792FAA813055505CFF1BEB9A939D5BF88C23D26BB982D23F438B886128A4C0DDD9B807AA8AF53BDF7321D8' +
        '96329E9FF9D0F062D161B4AA283669CA41542FC78B897E90584E648B0F89F836D4290DF3123A69E383C30A33FFF4821542DDC914BFC2CEDA5448E419FC6D9874' +
        'C0BDE3E5ED85AAE7CBE1C3E25832FDE25F0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000008DCDFE0D9AF257FE9FF0178796D8A1317D850944C4D1591909BFD71CDAA1BCA98A45623475976180606A1DBD002489' +
        '56F6EFD1EC90029C346DCB3ED60247AF56ABEF4A017C23671B37B2C5CE89650E8A24B9BA3C41F16DE66030FEC5AC5F396B5F2AED2689A2DBA7E0B9E45B1DF419' +
        'A2032A4A051439E1AF12941B724F36F8D40341DEDA9355AE75165F6162D5B0DD5FD50906707027B71641961BE860D883EB09A65C4C43E34741F5D34521943D96' +
        '3BD9012AC17D74FD98DDAD65425C87AE06F007B51C38EF8A33892ACFEFC50F5E81C04E9E711ACBCE94B53F72580326ACC4E7FE9B46FE7547AC731C196EBA7FA7' +
        'AC81A718AA20FEBA3FDB8EAD95FBCA0DF3381C6D198F22CED3996B354573206D53A8E61C21BF2284399649766A801CAF86ACF4C26C36ABB7BF5B0A6212CB023C' +
        'A43F0AEBF54FF4D04180BDD3F192FD8A98A47F4539AA0AB07AD8995F6081F370315C6C696175802D07336365B651E1EACEA6B61519E3EB7618F4E95E1FDA4F87' +
        '34629723E91FFAAE4010C9341A73634C13C37FEAB3F8A4A0E6449DDEF84B99EAAC9EF26A5D8E3895B27F8D1A2CFDF3BFCC590BF5164B176F31A4C078DCDE5DA4' +
        '30201312C9625DA90DD51ADEBF0F6432A1883359A04C3F4137D8CFDE78C0FDEF838045748E905EB9F0AAF07AD230744C914150260A15A18F1630D8AFDEE7B562' +
        '2A8776EB92CD59F27D395519486FDC9AA2BCC64689AD1D5D7A1C4AA9F1847B677CBE851C5B11CD3E763E36B55ED7383F78A0639E70340CC73D47363F29E87404' +
        'B87DC9DC1402ECF40B90CC2D7DF6C793DA66CF34EAE3B863563E482E10D2D53043032D892E389083D01491FEE4F8EC390C1EDDCC9D6DDDEFE6CCBAB8EE5054B8' +
        '6DA3DA1572B1033F9BDD882DC62131A9805B7A37EEEACA5F1BAB8B56C8D70B698168E7733FD66EFAF523E75ECD93A95209DE7D7821C3D7648B64CD0D9B6A33BD' +
        'A56DF4378959C338EA9911DB5A9796164D2DC937F64C2824C2C916982B724C34FAC2DEDD628EFAD9D8A9847F328B719873EC9F92497A329353311F5B3562F6E4' +
        'D22CE42A2A1DDF1C516F8280F32F3115BFAC9CCA8483558AE6D59FFCEFBDB98FA7ACD8C08B7A8A9D6EAEEC324AAA7D49FC8553ACB83604EE8E527629794FD4A3' +
        '38A9BD95FB16684E431213BCD7F1A2E372E2BE27735C3F71EF339B470F8BBADC69E79612DDE2927E9A72B62572E81FCEFAB943F3106C583068A2B1118226FCF2' +
        '41A77BA399DBF8D9B3E766E174ADAFAAE03E6BB15CA11DC04DD2BD5B16698102B15611F0826910525E9900462223E0E317F6A41845C3B31682929E2714B25F87' +
        'F87C1551E349C46C7992D3D63CDB9BFED7CAB2696C8FF6B7C3A49033932CD914139DC1A83ABC82F84C3736DD75F33C69D0131570C27E408DE7C68BD818F1F7DE' +
        'C7670C1CB3F50FADFA084BED800C3573F1515B95772E6C398B53E79A0FC367660029C8255A9EB77A61E8942153758147D5557BEC64FF693D534B4300E792BF33' +
        '96BB00D8DD38F76C15C33291033F3AD0FC555868E8D47470D21D2BE953A29C895839AB4827280186D82CF7D631CF35AB2829395CDAA58A0C6ED2FD2B1FEB30AD' +
        'AA649E1AE1C029E6C8DCF7D7AE09F900A7FFADB566CDF279D250E656DE96E7641CA9B8C930EDB9CA4A2210EBC4749E6F336F89714582401D72C6DE550385FF2F' +
        'C84C9C055405A86E3733459A47579B0221D9E3B2DD62E4F950C0964138ADF2CAA80B72E40C3F1E979B8FD73CC28D1B3FF27E9867D6489ABDC2512380C625A21D' +
        '7FCE68003853B84A5F84A756F8826A59E97D2AC08818CB9A86846A3AEA943200D885699215B42398962E48D9A8583B62F4DBF9FFA5AA8AF500BAFC73DFCE1AA3' +
        '8BFB953C9A9A85D1D52FE5DA529A36D0743EE0A3933201A82F611F2B8E0E4868F96310135853BECD4CC20965156264EF942ACA5ACA6285B2C637F6E03C054EA2' +
        '4E8275FA141698C474A611FF530FE3B8E74B8C6DCBE1D58A7A77C7E499D670E71E61A6FAD766A819D87CD17BE612E6E7419D7956F156729298EDD893D40311F4' +
        'A4033551B1FA00C0735E0FC38FC604D260AC30C12BC6F262C76EC4729EE53AE43D158D8197C44500F56DAE2CEBB12C5879562F343F713816E48C01BBD624D2E1' +
        'B79FB07BCDC9F4090ED329CE2EDE931D43AE362412B24BEC516F6A40BD63090FE97E298CE9F504D9CFF6D72A4B26D30CD1FBEF76EA7762ACA8B1D3771E3319BC' +
        '5EFF60132C56C79FF8D4344F43F42E929495E1839C66FEE954DC4F2B229F73AC970E6CE90429871E4E2A96DE0472F09A40B202CFF02ADE9B0DF66B7E29BA86C2' +
        'F0C46D3991149C14D7C5055FFF8F372E97DED52FA6B7E8E3FCC990DF16CEAA2265C4E76B3D459AE9E80AC3B17310B6124A080368E3FD0CD9446D7A8871B457BE' +
        'DD05E35689ADC9E4670FCB68220318F5F3187859B03CEFC45BAC544E74DD40741D5959E0BCB5CF902BABA5FE555747487F685794078E04302A239AD6C3E8CD1D' +
        '4E96D09102F4AEBA7330AFE494874774AD22C16BDFE63AF0C4D4A06DB15558F1E8FC49E97BDAF322D0DBA1238395C064C947436BFCF0C8A0EBEDEEB2526CB62F' +
        '3F027A4CEEF42D44971144BC5A12480A5B3D220AE4DC5F55293BA972B0A3DA99A2F273B6EF11FA092B16567DD7E7A474872689B32EAE295CA7E59BC7EDD3EFAC' +
        'AA73DD9F908EA0EF62B1693E1370D1E7D07D5BB894BE19C9F4B4AA76CAA29D1AE713C1E56C4565C4641A6185436028C3314C6193C6F5BFDED4880910539F88CC' +
        '95C0C35D2C993EDCBA712AA8157B25464A43A4B6493253F47505D95EEB81DD1BC8723B03FC38A7D27687EC296E43A5755AB383D97E7CB4AF476194A5330582E0' +
        '193EE8FF589A2361D9D7F81461D95840A136B85D64C5FC8EDAAC6997E752513EA0E8E503FEB2DCB11B2FA5A14F389D520C6D1BF6F9EFC8B5A6020C003DFBBFE0' +
        '825AACC80EB70D42EA39B803829998558D24A712A7E5FC19AFDB25DEE04C98D7A2CE9C1FC9B238D5C44E1C8BB357D058D760C8BB6BE83A090DC67485E8ECB9E0' +
        '05D45AFB3ACFBDED5174658054297804BE191EA5BAEAB6527052E264FDC207D1398D1AF3E3ACD75377655933BD100F4DCD1606F64AB692EEE02766ACE5C30964' +
        '0DA10D8DC1BD5D1A1FA355B32DF627DEF240DD1011DA8287139A6059AB88B36E1C42493FB457BFCAB584A21704821702BE19CD3CAF666EC29A847BBDFA3ED3EB' +
        'F07623E52DE239E2D50E6529B09B04159E659916463AC7C831A03C4DF25EAD0042486B55FCEEF722B85AFBD90B21CCF9394083C25FCA6372B73B0DDA7D5C7716' +
        'AB93808B4CDB223ACC882C21AE8678623D711D5537FE07D935A11E2172926CBF84489044979D36DC456AE66404E1445535E5623A99E522A2240499BFC94BF015' +
        'C33D7E10C2EA6E872D4503D0BF34C3F689D3353A474CFC25EB27069CBE5A0E07792FC95FF72B6679D0C5D78B9AA2C07BEB172A6EA5CCB8EEB1B9B3C5EFC527AA' +
        'E78F4DC41ADD13BEE23DA89029A565554A93E416C7EDF95868D8D13FF73CB1F649B870FAA700B3C8BD302DD3AF1D0380B35515A5D64568B2346A57C51F2D949A' +
        'BFA7E7DC4D942C3350724B367EE214B71B874A13C4D74681F706E397F926BA26A380F08D4ACF58EEC266A77FF56C5F04D7A1E03C9C951EA3C1125E56F3DCA1C7' +
        'E4B3D1CF3FEAACB2A66B813667334F077EFDE4458CA70E067A30307E7C8299B6B8563929F975FD5D1322BB9A22980FB50A0D266B1FEF0F600AEE994C813194EF' +
        '4CBB32168B4CF094F3317A230D2E474E064092096A8A678A5353660386EE6590F2841DBD30D223331225FB3795DFF4A4F425553C64C4190B0A008C9B73A0852C' +
        '05953477D1963E99C73C2B3A647E4B746E12C639135071992B261BACFAA42687612033CB9FB47D504A9D873B5013D37332728D3BBD6D8E30674F36FD0388B66D' +
        'DDF370856C6626A79B03F74CD8442BB46F5C410CBC895389BA35A1E9962CE05384E2CB311F036F1BDC358702F98EF65B662BC99368803E455B48B7DDAACE0381' +
        '640FCA63A868877DDB45C6680DB570790144191CF723736B19B05EFC0C6AD2C80A5FC957A16291DABF4E227C2696B457EC2AF6CFB03810D6092A55CA33BD5343' +
        '3548A5F1D73D3BC73CECE479FF3D66CB6695730185785D057D8825D254BD9FC3076160CFA9C46BDC0C260F4042D291209C0561D25E5EA09EAA24157E9B2AA96C' +
        'A2B5595E9646927149D0C791749150444B0D22A359CF2D4121D99C1F0B27EE71D7B60529FAE876C5FA975E99923FF847EC88E719E5874D140E4ACBD53E814376' +
        '0A90EB658EC99277D51A0D4E816E9E1202BAFACC3B3868A3503797B89ACE0891D3EC696D15C11790ECF5E57D36692C264C004DE48A6904048205D014351F32B9' +
        '58ACCACE80F619FF9D8F0B1D4A426C84D8713F375554BDA789598BFB55E0BB032C92CBD136FD51A355DF27DD5B9391EA20FEAD5E4415BADFA28596C81C262CC4' +
        'D8E698842B26B33AF1A872101BF3F98DACDF84E6C3A3E4E95E0E0BCD300BE8BF1422C0A126EFBC074D1DD96BA6D79FEC8A4173A0904C8A95F0260BEA88260D21' +
        '76AF8CAA73C154323B4415BD4404469CAF8D33A081BE6781675318886E444848BC3BF5BBAEC8C95740DE78F865CEF7BD9651AD762BC12F3C21BE56DA365F7F9A' +
        'E3215C9EF5908EA74B8061588E3BEBB1DEE1778DCA3761C664AC5415BBF61EDCE1718966D55FB445574356CC7DE976B6EC71687216D509320A7ED14FB532088B' +
        '7FEE1FF04C4C5C901ABAB7DBC3C1689B15F38CA3B1183013273D154D6BE77E227A28E5DC175093ACE00D4E0BA9280B49F66F8AE70194C4C78CB0014E63F6EDB9' +
        'F1F7AE8E6EC1B86794EA30087DC2D7EDB4A9B827C0BBF4A34265957028322D551BD1CB73CDCF6D355A2905B100B9D83CE0000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000533F464E2564F60815C1D9686B0EA' +
        'D42247D6D90236C3E7FC80287F43350626EDFD5E9825135A9F97C5DE46A12FFFA38304A84678F2A5A2F83E2A2C18D0BB4BC3B572147BD7524E8F3844FCB7FB12' +
        'AE4D2A510D06F86986A3D6CF76EA288597387CC97FCDF31DC4C837C4BF5ED0A4CF5D02812B2E5E10D5B28D1228D00659B495FB9B57BB9B7395AA3BCBDDBC8685' +
        '284A0C22CD085968A0B41DF339B1CD4253C36980508F323A1C4041910BAD3D7D8AE94C40726C247024A88D0542DBD9A6BC9BF7A16E0C682538B935CAEA8E292A' +
        'AF9731B7AC9D34C329BFADC340FEFBF384FD199E39A60717CF5CBDA946C38C9C586E7A32CCB6A4FA41B837BE6D5741279772F8A17F9D274CC437847D42244DFA' +
        '55B2C8FF375E1B67E4C354A9274E24910F05708F160D8604BB26F67FC22922638C590B7B8C926C8A89EC7C66F090ABE05312F94071F3464C9DE38294719ADA73' +
        'BCF156AEB6E70989D179948ECC66CFAEC11BB51458863998CBB8CE7F76781CE9D21E2264AAFA748DFA156C4CF8EDE85B76DF424CF3314FD8D46E30F6B65920E8' +
        '65DF6780B6E19FC191091E1B11934890603229159D82EBFC2CFC3A3AE235DC9C25591E695A70AF928F2B56FB8B794AD9CF71DA37834228FE6B876C0ED569442E' +
        '1662F587EE11509EEDBF9ED4CF899DE1EA5E246B8B0BD3424B1F133C5E7C9DDE19BDF8D6B11EF11F7C5C43B500C07EE1ADD68A01BA06CC62BDBD61D9025B893C' +
        '83D577561446E8309C995C1ABA54935AC0B6DC858F380127DFFDA48E132834C554C13C7ED188DD5A734B69177062042ADD04827CD0CF35B496C41585D8F876E9' +
        '62A007AF631191C3F50E33C1A73219092707040DDD3C26BFA60C5974A34B8CC6596D586F0123F6EB79147FEAF63CBBC27C0299FE5B9FD91DC2BEADBFD3375F7B' +
        '6E99668B453FA90606F14ED2A82FB20ECC3FA7C3A36C852730D2B1F211E24069309BB6D8033BA47768B75E638AF50640400072AFBC010B90BF1EE1E2B76D6C08' +
        '6AF50458A4B40B3305C02A43624E73FD563B3A06F0EF72DAE5A0BE5B4DAF0A09D23437B5AC5948D55848369E78781D19A6F1722B2754E7BECA5875BBBF0BD476' +
        '92A6CC4C8FCF190D853A5C371F6E9C7520314640231875A7015642D53F3834A776344850BA188F0E3C5D9FBBCB96A36D06CEEC93B80689588E87CEB9D0F0160E' +
        '9A58A07714BFA0804A9FD2572B9C773E41419EBC8D881D23BE5940AF9124A7D4EF65200DF8522BF7518A7553E587EADE322772F60F65328893C74A9682BDAF54' +
        'FB626CFD025C3F577675D5166785B691615A44C09FE9F058A914736D06E0C06D446CFA978FC2B128F9AD7066911C6BE032A3EEA30F2CC142459A0E35A62C597A' +
        'F408B4139D5D284675804041BF60CD60939F1F08D42E5184B996F408334334E28D229FE23E9C117669A6B5CDBC797E0334B897AC489CD7F210CB7D796D837872' +
        'C3F2BD239A7A13D88ADCCAA99BD9D8439DD66084042575D0D8CEF9CD8847CF31FF22CC26FD621BA9AFF0DA64D764D4C6F0207139EAF8858EF7AC8F6A5F5F5030' +
        '152666FC30B515FF2CF68A68E6BDEF9662D68425B6E2448CB6999EE3AEBE0A42004205CB63028A138169A9A619A50B82811D958338D3A4D222493A35DBE04E99' +
        '2C0461CB85180A567205B85A5B4B6607026855E7160306B84928180228A45B9CD4001CCD39D53F8C54BAF407A671F031C66E134426B4EA944F58D9BA16D1D290' +
        '107CC1D374BAFEA9B6D167AAF8DC3B569598CDD8A2298BFA44C2126E363BB973B78DAF5A59919ED24EB0B02BFB89CF641511697E672C6B5F4CDB40A529A499F6' +
        '0033CC8042576F3543C2A0AA20A30CD246A78576045235B9B56614582C9342720C684A9CAA8ADBAA90D408B0048A0B4A1189C118E5087C40A579B9785A76BB5C' +
        'C00E1CAAD2854F91E5D986F8E59C8AB0FF36DAB1772238F0EB4780744BA725C6ABEF96626E22EAC493EF76ABE9811ADC2A51D7EC885CB50856D5CC5698039E60' +
        '266F1BD5DADE7A59CC4FCCA57806ED0094E0DC539570486497AFBA40165373330059E98052AC02265B9A6248A3235323A817347129AFF45490655D2B402B265D' +
        '382834410F4936805A261840D874CB0200B572798E6F95B1FC3B92834AA05271136C86BF74444AA377B4B3DB09B13C4675B8B980FE663BFD7EE8BB2A5887CFB3' +
        'D23B2644E3E85BC1DB3A114CDE2C9CC8F105135581227BCDD558C7D2B945B89FD0CE2F6FB2CE001FB15308401E83BFDC8C497EAD465A6AF7F7416ADC96BA0B1E' +
        '01F096153425CE80456288C5D4956B84535A2CF4EA40941D0873C8266563B84BC0B51661594CB4A442934CC0A02E9A2A06DCEC28BCC7B35597BB46DDAA4C8368' +
        '6CA1BB26E5B4B55CA9899AE21FE23E6CCDED78DA276FBBB7E4DD8C17D7EAC94656AD6D3C84CAE9F49DE744EABA046612110505B7B5ACE050289C1ECC97D40338' +
        '39DEED1F4D0DD898A6608FB90E5C9FFAC566891637B42EBC57515F63FECAE55A01D96863A3D485565835A861221097692530909534D132136040D2D8243C8C5B' +
        '34951A0B4570898ECAA4982309C7A01116DA4C6105FDB8AF7DE00C673109F71F320EEE80E0C69BFD33B1060C260D56B38487CD47616A110D90A23769B03F7B51' +
        '5A6656724C582790282180D76E200B038E5A94B1631C6D703E5F3DA4D0FDAF31B7DB7981930F1D95B9373182C84A848E3AA6D8B3D1C29444E578E1CD2DE1EBD2' +
        '00DA082B35575A586993A1806E64CB206E39A092B730512C65B21A1526A132CEE4590192ADF2C44CB5520B8B25CCEDC01614D46903AA4EB5452248DD8C8E1DF4' +
        '1DFD377E734E57795BC81E101E41D454D79D643AF6305145A5AC74DAB6A19343D524A23CC213B8D9B8CB3C5BE966423A8D8567EFC72B6CAD6B8A4E4ED95750F8' +
        'E0CB9F301A3538373CD532C4B38ADF4EAD3663941FB58EC017519B73CD4225C601A218582A06385A00B135C18C81392131C959362838B656C61A671081D468AD' +
        'D772E2D2528459551C5815CA04A9756B184839652A2EC9A8C0B1E2E4A4978121214EFA1883DF2FC1F1CE9AF9CC2D29D08B3A7657644F1760725CAA6583096F68' +
        'DBC999E6938AA56F5DDCDBD44094750110F70EA983EECB368CD953A7A419C0546625AE9474DCA667A4A1C1F364D56C6AFC5A84CCD4C901F1230B1898780A2210' +
        '008242ADCA14978A80752658C8944DC4C2E2751BC2349A9164A8218D200C3A963A2924123B8B6AC7840BB494E672F2E615BD16C75E1BE7C2A2805ED20F18E991' +
        '2FE6B644306840CCBC76620C1100BEAC6ED47DC6E204C6AF8984EC4FFD49191D82AADED768CB0985B63A2735B366D136F2EB4643F0E3E5862B9C4FF9EA1A6AE7' +
        '2F29A15BE18F9E5EC8F465D115A457219BD664434EF0C7E2AE1A57330B53AC63018E140262C4CA916D95F048B9A0526EF2184D6691866BB20D243307A68CCA54' +
        '93A6106D9B68D3D162496031547883861914B77F36AC230514E37920466A3747C405B506B6309977E7C0C10DB64096540FEAB84771E32E1D0A81457A3EA9486D' +
        '684AF83B9BC4AE759C58DBF787D206CB75056B601FA3274BC1EBC9FAD2A7758E40A8AB258DCC9683455703FC9AF0635A4B7F65048C12ED40592C7B71480EC0A7' +
        '01EA82762B82A64D4B6A68BD8945DB551AB80A9B4B88CD420C34BB453450089130A45E6899005404C6C6684A3280A4C7110467C91BAB258EF26C173E8952C00C' +
        '31767F938163944F3C7CE768419E8A0CDB464258725C6888C14C15C489773EC2FA7B62D7A52954447B71F34FFC49533B68642A9294EEA3FC41B56BABCCF809C7' +
        'E29C3DB01FF3D3BDF10843C131C88FAA210177A8EB3067A9E9D54DDD770E9DD00115DD8A5A88CD526BCF6620A30BEC11906A0F4AACCE364CA8A4BA8C49C0A242' +
        '9278B4E02491348D965DBAD53C42644817158FDCA8D5E862288B5DD9E3811FB190B875089293B4D7D112F8080859963AA20A12EAC996281F31B2A49729C96237' +
        '4B871C79C5612647293D6B839ED97A45E64F893501C508C262319DFE168D3A7307977ED97FC39F1421938CB233222AFC4142A7E57C5A58B53CBEEF660D79BBA4' +
        '00C41871C19C52CD42C07051516814B1A0E85818C525662C77E2A211753C12B2CD0A365B105B6B33F31AC113A8C8D35A00359D97C7007D0BB688FE9360AA80F1' +
        'B54615584F215236BFDDFF3438964061398311104CC15ECE8A05AC33ABE5897D859C62FFC39681937CC874C9486898B5147832CD5A57936591C296A568E902D9' +
        '7C447CBE65FB62CEBA9D9EFAAA203D17A6E7AA5FED4FEFA98C8D993EC79D8AEF00A59D62A1D98E61E74C75151B23610EF414D6ABE8C59333A38D2766F0E819D2' +
        '52AC455DA892027952518396CDB854650419A5B28BD4316128B0D7845B00C8B6EF7175292FE038198D4789AF94A897C8742A18DDACDC288D8B91507D3A6E1F7E' +
        '370AD6731E199005FBE859D5C37DF5B007761A92CB8AB3063481A21505323C2294EC042FD7B742C977298F5EC3456AFC8A97279A01734D45C5BB5BF64BDF87A5' +
        '008062592C369BB55A42022A71643A08B1300C16308A405265236A261327DA195128F0B26EE120C9ADA20502B9AD94E50ADEAF764E0820BE1A53FBA3371FE3B4' +
        '73FACC3F67EDD00F76CCDF4417C781E18490877356F3572015B0425D825ADDACFA3A368E36B0476CE3191C11EB8F35130D846E215B158AECB91C5F8510517CD2' +
        '11D9324416781C813F40F0E1BC26241B92AB0DDFB1EDC400639CFA80835C86440163B64EA9BB1A865BA582E64A032A0E492C55F540C32536CB0C866CA5B9D521' +
        '6BDB1021B65A6B02C5C2B142976E1ABC0A2925CE335FBEFCC8364E00E5D5E72A3D9A9A7E1642DDA742C3A9BECF8E94F4FC856AD600F77337B39B4A99860CE62D' +
        '3E8C082F1B69A96BAF4B4E6CB988F624D4C311B673BA7DD5E0E447A906FB53AEBEA4EEC3236A20232493F47C3C259B1CF291487340645E356A14BA2B33DDF784' +
        '01443A685CD6161419050C820406CA786057D282684043584228D1894C810830940DA2BA292A3A01EE864D33443B73CD1A62B6ADCCA6596D3E043667F2888C39' +
        '39120DC6C8B752CC810DA468B5D6D6EA7193AE8E5DEB597C067637799C04E3D91947BC3E6B429E48F2E8DB9D2052EC9A7C7B9BA48047F9C199A3FCC4963D80C6' +
        '5B56D29E0EF53122CB2809C13FC4DDC8AF29626532ECE224400B01D17EA700ED01B18696C39CA20DB2C8452ADB746651266B60D56AD8EC302C2253010E12BB28' +
        '52C7702628AD5BB545682CB5BB956B52172AFD16734676DC1F2B203C2847B4B463A71319E84BD7B595E279A5A650FC9E9B099142FA47688EC78D8007156562A9' +
        'EC21298BE474D54CCB90FA14670A7B01F989FA13F50D9EDA57C319A1D8E7C3E537B71557221FFF0FB81A64DA422F60897C85E51C3C019C7A38DE6B00E057E6F2' +
        '00A32440810ADA2C28C203D79AB659BB4E2430150D132054130D172A06311B941401623D8CAD214389848E958C3A456D1073C043238D533600C161ECB3AE5BE8' +
        '5C212CA8C5CC1A6CEFCB3ECFC107158579DFD11D00D5D2759A2E5A437CBAEB6AC493694387B84770F2C0101C520894A7C7AEFF7D6830D22F3FEADA23FADE109C' +
        '61E87FFE2E562F648139658AA181F25C56756C55DDAC80590F3BF52121121B9D005EE8A8A1CDA46068204E53AF4A8A2931E2889995C85D1C7BAA91D671234240' +
        '48D40189A82C216A15128800550F9C4C12BA2C4EC81B6D31AE419A8D575A9D43B9061308E352117968D7725247303E5B0939B96C80D97A2F574F84ED2FE5DE66' +
        '04D9BEE545FB562080D23D1A56D56C35021BDE102C312581E51A0445EBA84B50E5A59CF85404281B5740F791553E5EBE752898CB1FAA32E0C077D2B27F9474D5' +
        '00359592858BCE6B84CCF466287351A7415061B001DBC624626BD9AE831426F360AB6569657032C8704DD24B304E64AC14A2F5E86AF5CC0A67378DF52AC25402' +
        '316040AD36C353557DD3E1D41784065A543EAAA90B56ABC7215C55F34F506D8E34BE583857D6D30E565EA090233DCE261FB34A908ACA4826905863416E3A8951' +
        '74EBC1B106BC8BD0573774D79CAED6D716A04D4811DDEA920307593C97E01B5D01B00CC6F1404B2264A34821488E8B0CB2ED6A5833DB2C0771750452D01CC631' +
        '322488A0A034690B9E636E308755068316D884915E603AE0E45BD0DC28118E19205E1A400A616F876EFF3D63EEEC966CA89061BF85EB2B2AF56B2803A5BEB7E4' +
        'F0C1F33764BAB03CABF82A66A7ADCEEC02DF1D4F09653444FB6A871394BE814DC660F0A4F94966A9EFE54C54270AC3871BA2D0935546727DA7ABD5810F299248' +
        '003259A852B196A0198ECB0CAB4453D404D93133991656361BAB9AD2F29889A1D86E05846902B662432B7194D47A19C11265A474278786545F151ABC393C6354' +
        '2B9C6AA21492992C1B1CB284544E76807327C974130CFED2C345BD3E7736B9FF36B81775616499805E83A92040A4EDA50EFC2D8BBB2C56AEFA07299FFA73CCE2' +
        '2267978B6AAB7208ECDE627C7D40FE9373F5255D0D6F9450A7392456F241772901159DA298A6B19C42171284A9406B02584B0D494D6163A0D21CC6785E5D9BD1' +
        '2426DDC86AA3B0AE0E98252585365DB40E03CF46BDDE5D2F5D9E10FAECD7C33AAA4063B2E4764D3C47F61645BB1051D45247525DDC60BBE81AB4383322F5906E' +
        '844B6657C812E0312204C6A11DC744B1FEFA04B74F6E46227DA9412FAA4B1F58BE3456856A46126A022D036AFE2E3CCAE1B0A9C3BA43DBBFFD80A17C098295B1' +
        '00086D15753A385AE16E6C5438CE448A48A65A284A81A3C3449E04C036A8D55E4A0C919B29F13CB760D4191A419472CB146C57FD53C241077C61B90B6AB9D0BA' +
        'E373E9573224A84B9BF508D9A89EA4C7C1035EC9477E88A4CE6D0D5B6B3D50967A4F0925917BE0670E3C95CE9E206880CDF3BE687F869E33B44F481FB826C399' +
        '82391C90DA2B2801ED5CD406AC59D55A261F01A3E3F9DB97AE95E689BD11E9F500190457500C56B0600ACA36CFDB12A90341954235A5B68D8D56C19913851588' +
        '43A66D30CB85DC81DBA0266CEC65CC4A18F1B883CECACA64C404357D257EF3F1773FECE5A8A50435731CCC2D404F065AA20BE7A04DED13F77B6381D7DA80B79C' +
        'D9265FA2567F229CEE02ACDDC06807EEA38D386B661D1F98DF46148B9AC8C6331609F6A915ABAF21B3A9A559D621C7BE284A9CF35450593464915B42DAE4AF6C' +
        '0063ED69ABE2A6F6C22A1E5D25085AA426028256228D5CE22268931913BC1A86146521063BAA51B0D05896581A30008204F33E09C1D10B464A9B91755C0D41E2' +
        '45932AE931DB4DB9CCA225D24B598462DCC657EC9AF618F956B80C66CFACACF21BC69EFB126E39E82E16B9847CB5C384848714EAAF5F29A918A7AA4FE033B09E' +
        '59F7E65EE301E2C41E5F1CCE3FC4343590500E37CA2BAF95B28353DC6123226E01335B8E86A47273ACD06598B644924872D2326BACD90DB0D97244A671C98EB5' +
        'D7A19E29B9B1B126455A85E35812091316FAD3903EC3C5D243C8041D697E4E5AD7A2A1656678F118F93B8F26FDDE7A07C90B7F6ABC348EED799F23D5371F2DBC' +
        '1D4F44CF06D30B99A7B7E5848CC8B9F6369FA644F1CF655D1930DD6B6D21B4719F3D52D114DDD833883FCCDE2BDC80C5D6454C3F43A04D50CFD68D1B18C23FC8' +
        '0026A855E0042EC2EC20AB8525B127468E54C625DC5A4031302D0CAB1BDA62CAD46E59520E852833E94C51B0896552800510EA55B68D14F88053BF42DFA03643' +
        '3C52F8512899375010CD41643B66FB8D60157A51037FF578159E11869A768A3D64E6890487E4DE9269D088A97FA767AEF320CECCD0CC0914A3082A7314C99460' +
        '0E262F5A8763DCA567902D007B4D23999F68DDF6AE49C794F3A9CD72A58BC62900E156C998CB41B62A6A0DE6D9A3D8D4491B3B9184342C43CB4B6126D0222448' +
        '604369D9A5044CC55220A70223D34B5D124D9F19FF605AA9EDCC9B417A764917B755D17E1A28380248C992E8D97B881840220C999787053F2D727CA93D820D9A' +
        '7993B1A34EAB3BCB0E491A5C71A06FCF090549DBAA283F78DA8764C1A70EBA3CE22AE7E7C77638E7EB305554CC07EB5BED6D5B59140D5B47B5A2B9168E9F6454' +
        '0108A205F2DC595B5D8096EBC958E8C973066945540D492BD6041A6D2821B294146168D5191B650A836C24B20DC74E501B86F0307C728157DA0F4B0655A42CAE' +
        '2CBCD3C06FB3F0C3DD36577FDAA6F2C1D0C1B7F33FE87982C6C2A4D5C53E229D85C04C112CE38F0401E267B6D47FF2DCFD5D60FAEA605F19E9F2767134978A35' +
        'B2686552B3C7A8F3075FF40511EC2F81962F01851C02E391C777CD7C1E3654900150002405902AA1C26AAB1569025AAEAA365732072094405A5D38DA5A55650B' +
        'B44E23AC314B806AF03813D2346225060F63AEEEE1548C7B4211004D950BFACE7C7F097F7C18063C0CA94CF581FCFE6D222729D5CADF37F07E5222DB97882A5A' +
        'D1C05B6C716D075D55C659AB5A05050D6F15E36811E571E62069D19EBA0C32577187160202BFBAC7722DA71B97D57AC97D378ABE63E4E130320550E0E94A86A8' +
        '003430C970C1094B85D6336956482AA49961758B24974EE6644115295414C38335C0A42BB41C120EB6E4851957AB04341B'
    },
    {
      set: 'CROSS-RSDPG-128-fast', file: 'PQCsignKAT_54_11980.rsp', count: 0,
      sk: '08B491D9C18B8B33BB3CB17AC74574543152A6C140B79648873B84D5A742C70E',
      pk: '451EEAC52604474BB5281F3B5CFD91436FF8B94AC65ABFDDD0DA3CCA66AE73901D5048BD4E4897B4733AE4C069ECEAC98BA1E8260006',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC868F468C0122C00AE15F7AB0410BEF08F932D20F2B2FC7E907B3C091DCEE7A5' +
        '6A178BABFD3CF38B5B64649A20E19B55CE4F43DC682E95F9500638B36D1ED56CF62BEF0878E2D8B54929116BBBA35C45BE739CE1FE1BC84ABF064BFF142E0938' +
        '0097E66E76A2167C025A976791ADC1EA8BF14949FBE0B66DE74023F18A291226C22EDC5C75C4C1ADCAF395D3FDC4C501176AEA5024539A3FA291AA0FE052B3CF' +
        'E642B17EE91D436307E668BDD94562CF087C7C73C6BD1DAE861BAE65D69A86113B182E4BB2E37A9C46F7B13BA63062BD177DE586EC233237EF9927DE9A3A62A4' +
        '8FD435DEBD81CE216B3E343455A9636D2B44F87C0C11AFEFE69333EA5042DF3E25CE97BF0501FCC583D3B61911E808B266875455039EC19E3B605D7A75C9FF86' +
        'F4E895D1AF828CADBD7BAE7D66B61975FB39B8F83256573446C59C654A13C4CDD7CA665D9FE069CE2E48F865D5D9823FAEF7A446272E48951E2D72323C5DE6F6' +
        '5DC482077A6F4C69C98A7A328D986FF8B2C5CD5AB9F11458C76ABE1EF6914D615D8A4FC403152673D396C9F0055DEA8FF4B7C4D0EB5113FF361C58F2D4C53929' +
        '20ADBF6C277066C35B5E12069CAB2F89EDC6EDAA146C22D0F56D7BEA21BEDFB24CA610AD5C4105792A0CB98C9A2ACF8215D0BCA56DCE33BF66C43BD8504A973A' +
        '5D5A142A8E9FE0B02C317590975BF40CB1E759424523A0170667656444356787FCA7BB2C645C791E519273FC98C22EFDB78D4E3F7228F7CD8BCBF52592606796' +
        '481F46E053B8D70F9808130CFB61D84F40CD96F01856619D28127CB245A0529FE4F51C6C2D9B5020111414EEB02ADFFCD076A76C93AB061B143F1A07D7FA6EC7' +
        '337A6B9CAB033F3AB8029600EE51AFA76F3621CF0AEE948A973F3FCAFABEFB29349C9D586E5803815A047E89B2E98710A80BE295A2F79A5352605B8A74AA6D27' +
        'BB47CB90B477F8DA0398FCC889E40DA14A03FFD6E6E2AD8253FC2A22FCFED5C9734EF9A102651DE4A73E72A24F7EC3D33BF3AF4B61B785B526FF3B9013A5B41E' +
        'B4506BFB3C8410DA6A7F8E3EA1C4D196AD8B15876933637E141C34446CA7313EE1089BB930197195010A7261BB63E9E987DB0CA81CBE4712068030D3DD707DE2' +
        'AD25DDEF36C69FF41F5AE2DA3304335932C99203A1D4315D67FC9A0426A4727FA44C8D8B34715585B537EEE6C036B5DF15255A44215AB591737BD7ED80CB4536' +
        'A8D33A4E80764206CAE5D7F3BC203BA5C1F12C16536565A7F09646940E05A9D6979B1BA01BBC6C204625B96887B546E2613AF325EE5F4C7702A6A8A46B788E85' +
        '0DA1FC558715E52FE3456F1B7210B112F73FEF19F0F79981E438AE4CD630649B3C32698DF5EBA524B47EF8C276B4E5416DA3376720172476D7D1196265F3BDF6' +
        'CC608E119F58E6DE652CE56E5845ABF5574C98C88D2A4D7F1C2D99429C7936033E113D4AEC46759631C161DAFA334E41C529818D9B344EFCB75ABC8F394D6174' +
        '363A6BE2B10FE465E0144FAE00B3B9638A1107EAB5D9C059EE4E350569B4FB273926AAECA157239239E60E50712D4F4C50C9E94CC2B137ADD125FA15D11E77BA' +
        'DEBE32A258518C466FB1B82D15FF892D42324E7B9F98AE4C6D33D5A0672B32A001A5DB2A86D69FF122F4CE032B2A515133633E88E46CEBBC2D8FEE167609DB51' +
        'EE9F878EBD7D65B97C8295BD54D5A62E2D4466E0A0F1DC6F7C447CFFE0FE79BEFE77B0B1E1DD2DDDD015D1A030826CC0EDBF53D1C4D71CD1AFBD86CF49D788A9' +
        'E06CBB34BA1DA8E2082D7BFED0EBD6B23F265AAD41419385B234E5BB7CAA7783751675BB5151DC77141E9A74C545BDE919B8D334207F0CD2165D23D4B403A908' +
        '51923CDCB516E9D1B1E93872A5B15C884441BE869C09CDC8E9FECDE55916709B9E9617D0DCC1D82B32176C8137B6C89A0269A79A24B32D149F496CAD15F70C4F' +
        'CDEBD18540E5DF9F3C5ECCECC2ADA1D784DBB735CFC0A839CD1C699EF1FAD3F99B50D14EB846489D92E6370514108EA90FD01BD86EDF5518029E6A2EB71AC51A' +
        '201F69C4A052D0E7032373C9904E87910D41537B3D49F66DD7CD8D473E5956793F5F6A763DB278548C7C7E8B1CFC5B1D56A57777B28DEAF31225E87085F60CBD' +
        '5571D0713D696147DBCAD6026521CFB4BC697B57C709BE5A2437644D04893DE88188986D55925D3D18919FFEE0A0814168349EC1E46DB47C34F1CDDDA8B4E39D' +
        '83AA6BB6DEC4FA4365C5E9FDEA4158AFF5FBB2A6723690028F975C757A34951150E783A73E9BC48CECD4B227F6499A210E38B68B1D227C0B00631D7F4FE1EC54' +
        '706948B4F09B51C840A0DBDCB83D8335F6535A171330FCD7EC618EEFBEF1E835E6C7B9CEBA2CB1EBD9B0C76C1AAEF866473B5399E683ECC74A7D7F9E90754DF7' +
        '9A10B9B7D529037F79BAB41B28A8EF85230E680DEB7DC587EF5C9B65C0236860CEC6B61744515EDFF85E0A3803B548ADECA76E5DCF4303B5016ED686EE73169D' +
        'DAC98D472484D734A3AF56A952741BCAB8330ABDD3B12651604DE98F02CC58EAFF8C20248277BE9D4D932A00A5A00D550310E4E57718CEBEA6ECC44CB736BA43' +
        '7AEBB85DD805DE30C8EB0FAB1289377A9F4C4A595624F1746F0FB9B81D60325689FAC083672F77E5BA7F0EE1BD6FF97442A77971F6C81A0B85C004708FE67D40' +
        '2B577A4FDF11C8122772B502D1D32A81C0C02596421E4D6BE53ACC5296008FDD2DE2BC5109869665A28B537219120E08E6AC04A90568A2911B624E4D1D3DF50B' +
        'DC6C94A5DBD3D8E21A612663B86654F24B0F2DF4530EAEFD45417BCA1F8C2937A875B13CE77DBF67294A8DA3EE184A96E35A24B323A2FEFB0A5D02BDB7398300' +
        '3D9E22BE2C07A6FB8BCEB0FD2A6917CDD4FF4CA5F9B8921861291DABFA45AE5779B8370C2EABF5B7F2CBC8B2BD5628AB946D4A72DD6BE4264146F3F37D99E9FC' +
        'DB69C26D22910901D8463B6BC383F36733BD7F8329CB6DC77D73580C8375B699EC1E2F32F2723476848DD2876EFC436670B1A070E674976C7FAB30F9349CE388' +
        '6613DAAA43D6000C1DF1FE27A4964896BE03E860010E721591E29C00AB764F8B34ECD69FAA71F719A45A9282DD5387068ACB3B0B1569136AAB17B54B5F3314F7' +
        '66B54C27CE4175D3C5F925F18EF213842DBAAD5FC612215AF7E0E371073B83A280EA8F85A65593423C64F69E602BF6556223EC490B2F6FD28E59488319AA15DE' +
        '119AB5E96892827B79D0C97BB0A10DB9AF0A0505DEA14BD06EBFD30DB343A0B441CCF7D0F6DBB5532149CE385C03BEF7B161B77FDBDA2012A36DB64FC4EEDF6C' +
        'C96EFD9F83FBBFA3A79748F7CFBFBCC78A66034C0D5E943660034EBAF3216F057707A4759B0E4C7BBF477CBA298BFC51BC704F8D8D967E9380FE1654058D64EB' +
        '0107A46160A2A757090D95DCE61DC2DD73B163B8C17F908C7695B0EE6B97336EACBF446E2803A6024B9F7A869FF9E3003C7BA985813092D448F845BDD4EA27DF' +
        '7C8147AF14A50BD0286E6885D96B1E0626EEB761B570A69898EA0FA7854FCD9DFDAB179546B5296ECD032F4723BB06743335058AB9B2136B9C0A81866A649615' +
        'EAAD0582AA81413663105BD8005B652AD139980D5D035D129206E954B398779FCFF9F64AF0811B2DD92DA54012C294FDE695E3C71384886C5623A3479CB3529F' +
        'EDCF2AAFB07B30CE802E208D2312E1F8710B871A934D3A2641052CD9A8C5553D530984271688F02D5886AD687ACF9A155C246D906B435F4B9A18BC39469EE6F1' +
        '911A0335EE72DE57C2795F539B99FFBE658B20DA8D49B9E7363E70063D25FB734F00BD02F3E2DB1BF1C9E33F8E63A5A846C8B70AB3B11BFF3414DC4B29F4D512' +
        '0070B85E5B981014D252008CD77A27233AE5755DE4211AAD06DB10004B9AA3A83EFB86F4A70AA26C3DB07CBA0EFE5EE88B2EDD0B508CF6ECC3F3ADEFFE51D975' +
        'BAD406D684681D88388FFB8F7B89CD6E5C1426AC6D2D1EC5B26BBCC27B245AADB11A3B9604F9F13473DA5A9D6841440A3D18A88D4F1E3F10FD201FE27EA206D3' +
        '4BEB32A75D5B073BA6221788BB197C8CCB59DA8D17306A1AAEE48314C07DD735FD87A65A3EF5B04DDCFFA08057246864EE970EB0B2518880ABBF84DC812AB553' +
        'FAD05A53EA28BFF30B95A093A95D034B1E609BC7848B4FCCD0A19697AD90E7203A98D98398126F506277711C27A76F5D4245DF4BAF7C5EEFC632C18BD8A49BF9' +
        '219A8034043EA9671A247E3B9307ABA49BC47909D40E26CD4A6F8CC514DD4622A92FFA0421C90B4874E4EA9247E0BBC9971322DDF73B26D6FF9F12F3B197E9AD' +
        'CE58184052C7B94911E972DC7EEDB8B0824A4D88BEF9A64F7189B902E7612A3027CAA9E475299D369A7120559A203A5D9213D2B88A23026C3D7BDBD5974A1D8A' +
        'BB77034F1F8166CB78256865599879DD95D0F9C888D06B86AF05F2BE0AD1B0E5B80D29B7165533768577036B799E365088D5375392B56011337F63D18CE6ACA2' +
        'CA590F57C131B1FC6D7F4CC0ADC4F487C921A73A444B96476DB940B471F9C0F74261A8764217B9912054F7E65437507425F4A07B2CE7DE15768883575427574E' +
        'BA118B30BE4ACFDB82A2F78A6F66EC9373475A5CF767C06AC026704C3FB16CD344764D340370C10B09ED5BC5D44DD749AD6326CD8D32D1B1EE35BE669B68F079' +
        '5D41DC361EBE0616CB4DA4C6C8EE7146433CC68B6E8E06F24CA7755AEB406B9AF45391A6535899CA23A3CF294A0D5E3590DFB599B2DF85CCC2E2BF96EE3F8851' +
        '285BF3EBF4BBDED78FCA0EE68A4C53EE4CCF075DACF3C8C38E484AD890B81403DABDAC7D550C9B541B432E4F055C5B7EA5CD47B8A0F086D5AC8A299F3EF5F17B' +
        '42E144048F0749AB3E5B215AA7355A883CEA46CC5E7CFBF8CB38C8FBD95F733FF03765FC3B37929A674094A72D3411455C8DDD0F1BC6B4AC78BEEA059CA37BBB' +
        '187ACFF92A020D0CD625FF6759131214A637A6FC7D47AE81D1905F77A067DDFF733B21F60E6DA95F8B31D6FDBFC41FF13C78A7F74CBF5430909B114A0B9F55A3' +
        '785B7BCC04CACAB78133BAAFE0B0657A111F8B78DEA9928F1F71BB3601682C8C56E4E9819AA38ACB8309B1E270E3DB1F09F534D57FF38217FA39162061D5CF11' +
        '12CD319C0EE763E36C1AA70D01169DF2BC921F3D9A7335ADC195B09724D309B480BCC623FE64CDCDB07B85FD1DC46C17144D010B5CD34BEBE0757871C82B9299' +
        '3F4A8DBFF2AED6C2198C60AE13E84118BCED4ABFA231FCD0A66C22D6C6FF4B8B565717ECE900A9B4FB93E054B49DE63453516833721364C4E88995724D8B4BB5' +
        'C71B6DBAB6E25FCFBF934BA75494AB79D75C3AFAB5E6980DD38DFCCBCB5712B09F6588A536B1AD21B95C1C6D6D78EB46C1ED3B7958CED198A04147292295F708' +
        '1E15FD807A33D93FDD4E7F4C4EDAED69567D9EEEFEE81820EE5143D420269EF44EB8AF34239B742C700F8801B5190D986FA2C2B26AC6850D60EC17C6A86442B6' +
        'E3F1C5089CBC15B3FBC8F323E39E8D738947B12D24010032CF6C2CD71D3F75842189FA9E6E6EB6DB33BA85F4ED45767FECB2B4978547CD2B8FF14B13DC8EB5DC' +
        '9E51085E1C93A9D99A8D734DB384A931E5CE8C20AF0BDFD62510B475FA9799B3E97BFED46B9823875A3649DB630B8607307DD6265D05CFAE1C9998F5B72454D0' +
        'BD21FE9185C6B1ADDF0AB44B436EB107CD6161B7991A4B58EEE314CC4F8233966CFD710BC5DC98EE0D20E7803F72A2388055B4A7EF7E87DDFEC401DF7D4A67E0' +
        '8512B9C8BD93F1BB134C6B1A34C2499FE46304099110794B635EC61E86428751EA2600A4D5D9AF63FDE42AA9B1C12FAFDB529A8CD36A5E179C8D9BC4F30AEACD' +
        '7B71AF385FF70E0587843EB5497E8B3138F1E58724D1AE30F8468890D1D798C6D4239B08E8A277D95CD32A9A193E68302D76F89E6579839BC9FEB8DF1FB67328' +
        '9F695EC9D727FDFCEF6551479FEF08CF40963465D151C0F213F04FD7887700F7F8253665B87E8C1AE7AE75C3192AC2B2AD6DE2ABC80DBC82A2269A3BF4DD9E4D' +
        'C44C04BE9CBABA0EC7EEE682CDBF6A666F89BB243037A767B7960BEC297C13E7C49A0DFFB1A55F0F78A661F3F4149E6477D6A1154C55F07A1632EA4CEC7D0BF8' +
        'DCC34DF1CA13483932D6A61D9375F5E78F808074C3C1AEC61CAEDF22D1ACFB4073843F3B9400446EEC175774A38DA2F9BB55F573A82B5C8DB547AF7D956A06B5' +
        '08ED301FEF5E4EC9932A5CA7818A83725A0656CA817FB1C2353B149D683CEFEDFBB64BFF6BD440A87B3D84EE508C40E8FDDB70AE214A8315BE8883A547A83C32' +
        '4D47CFF0F40CEF1240F9BC409A05C5CF841F4D2823EBAE233036AC6663C34456B34E03F4D088E17FE43938F04375A8252D87148A9CC0D86E42510621AD2311F6' +
        '813579EB624CFB190F1F6181B63609B65150CEFC09AAD560C8CA0F84ED8A26873C2C67ADB4F049749DD223F2F861F9FD108C9033A273CC9DD5793D21518127E5' +
        '698163D38386AD263B4E7979AEE6FBB48B65FC0A63A06B18984CA3A7A51B06B3F5C4615D3BD392F74BA6680352630FEF8EC4240DEC1655031A6D59BC0530875D' +
        '22594E92242E717756F72184B181F3C065771BEA0E5802A9CFC89A6E56ABC94A7A5075A0AC08E499D8BFA7F4DD26575D897FD27CCA75F35FE77E0C1E99ED9097' +
        'CFD0C2D634F1AF011C08EF528D70CF7FE20FC1A0BB0C5BD41D43ABCF7E7249EC8BC64574657152FD1C4F2592F69F53923A5DBF865FC11C94D928DF344D44862F' +
        '96622928641C816A2B0E16587587DE07E8FF543B9FE1DF6BF303FEAF10426692E49D697323EA7ABB1FD0B93DBA34140A0655AC785C1C751D11CBEC7B2382E821' +
        '1108B427E9EC756F170378E1E0280A1AC1C51C26F79B316FF97DEEA2ED62E294EC296600C0ED04DA1483945756432A7113AEC0DA911F75A17A362F5C6D885DE7' +
        'C162D505AA3349F32D85A1E988B120E068462FB21FCEFAE22CB3C7E81DC1F7BE019A2B00CC9188A4E7C12E268A24A3913CB264411411F517F1FAD99AD06406EC' +
        'C4301F9F24EEBE54DEF75B6771EBBBA6D16D9867580CE7D8296E337EABF1CA794A4E404B2D9CF6F30F67609B968274CF5934DD0219C08E0ED0ABF48C16478123' +
        '1105B0CC0F0C1048B69EA7A1C6438CE8A694388CC77D09D7B5D8E9B4D01A455136C1A04A7744FA3CE2CBB687A27B29C1C31D3444034AD22CE82A23A658E70022' +
        '617AF3DAA30738CA2983BAB52973F5B2B0CFC3E1F7E5ABA22D5E75F75570EA838774489A3B4EE4F315E3E9B82ECC646A3573062A6AB32152DC59CBAC4B0B15F6' +
        'D568FE59E674F814FA3F18CE7DB0F5C63C39229A0FB9CA8C0C7A698EAA9B57E346B62E99F996CC457297845EAB24FD7D4EF17B700304F29198E4A10C72DB53DD' +
        '377767BD28C4EF82A8F20C2C7FD4AB003E01918A93387980C0F78BE2C8591E74761A55EFE134E5B009EB0D71A4ED7F55BF0BE095723D2FB0D3585E77AC62CE6C' +
        'EE7BB8A8681FD1439C53725C6D4ED9AF9E4D9257E6E07F6273ACB1C0533F8D9C096DE52277B6F0F8C65757D4FAEFEF8A9205A3A82C29904C60BC55E7D8D81C5F' +
        '1E1F9FE3A9AAE29FBB55778D9034961AF7EA603312CBD34F1FE5F18EBBAE910F18F5DFD8BD1E8D91CC2AF4160F66842D33AA14D34F1C3570F560D0A9D103F6FC' +
        'C773215826EABBDEC4C008A3D58CEC3D37ECDC6D506A44E8DC23D0D8FB983006CEC0FC387CD140E93A46E33B509948164DCE2D6D9672287A2FC77D1869D386DF' +
        'AB1395F8A7D2429DCEDF2AC139AB990FC18013FB3910EC9F39A136BB4977D5E4D83D91E4F16E35D6C9FB0ED6A8AFA1EE4CA52DE1F4EAF843FA4A59609831324C' +
        '21E005EF9B0D681857D13615BEACFE86602F2527E1B500B585C2C8A402CC5CDB8EA8CD96CC7A582034BCFA25E5D751E835784573B66347A47306C743199CB4DF' +
        'B2A91BCC55D63FFB0C8CE6D217BB79F5F5A26CC85BED9992F17E3D7DBA523358022BD733B7BFDA3F8EBCCE241D6C0B3246E86CBAF98305EDD82171BCA26D0502' +
        'C67E463BEE02A6071D08BEA088295FD15B3D39511C6F3535CF0FE932C49A2C90C8D86E11075A1CE016EE13A42B2AB8122D14CD7A8391DB64C33159B30E417357' +
        '7386576CB4B9D4687A7BDEA80A092BE9F043D67FA7F7D1BA9A4EB6066A762B3B7E293458BE57DAF3B4B062FC60FDFE8B4A8AE470CAFACFB6C9D5E7322FE14B21' +
        '2B9F5FC5EDC135CD3B8B9DBB86F3BC8E7CE634B6BD87E292328AF03B754280676680F82203EE75E4F501A0F5568D23802943907C90B8FEDBAAC0E66EF2088BDF' +
        '9ED8D641D958560133C54A9972FB4740793233F5044F024439BE06D3F6CAB22B8E5532B43FC958C8C51AC4C76B5EE2B307766E0206183D6AA8966170F15D6EFF' +
        '76A2FA4B50FE44D62EDFB9F600FA3236E2740A199C1060D76C9324B1CD3D11058B1945B39E198CF754C8808CA13AADAC0B466E61EFBBFC1FC64CEE843D5156F3' +
        'A217311AD71CA96F1094371B8D7393B53925F0726436E3181C314B6EE8E7E06849901226CD3EA216E076A6C70665E7227747B6BF595257BF7745F74C6ED98268' +
        '576A6CE49438656FB392C1AF166B6491FECD5CEA571D79A4A56ECD59FBA85D31A8A190482C50E5426BE7C8478707D4EB3724511262E8AE6D0A04AB4EA7682F1D' +
        'E4D46E0FE5F27B0A8D58D43E30B04F1111E02B581901CC33E16BFE29F3D89ECDB5EA88A19E2AE4096BDC9D1A558577D997890E285C3B8935D552957B5F39539C' +
        '325FDA076F41F4571C6475EAF9D054EA5F7239102D834101F5444EDED49FEBAD8DE6E69727804E387202F98E59C07A6F854E6745904A9E9C69E5EC00A11220ED' +
        'FB6A331E3A1070144E2D46F37FF3162EFCB3B9081281C265906996111BFA862772C305631A5FA599C38AC276D0E6AB3C9809ABE4741296177A427742D065E5BF' +
        'B98F7A494D13536790035577A9ACD232031EB89EFC8004D96F866572CD44098EF969B06F42BDC2F15AE9E71B694F57B60CDD73C8933FB7134A8F2DCCD088D6AD' +
        'EDC497A68433BFBB934E5BA2C30BED1C0C24D78C90D08CC6DBD4F52EA161A48411AB6838D9EFF26E27D9DD76A9274543347671844B7C254F5CDD42217173971B' +
        '9ED96B7213BA93E25BE283E11C5E23E0D46FA8998CF68B66E7E37AF55BBCF56E39536A8F9F646666553A3B8446D32568C8041454B120ACCD02A6934F2026990E' +
        'F5F51E54DACB07D519DBDAF915F22844292C8DCE7BC6906F641C612DBFFB78BDB58686A8A101C20AFEA2EF8A8CB30F30E3C1AD2D03D637ECFAC040213AFAFBC6' +
        '4B99A485F71B172CC663A612241F861BED4F343758C97A1960C4C92512DB1ABCD6195899116847ED6406861D456957F6FB998331EBA0A6230B30E9AC920F1424' +
        'EC2386C04E868A30BACA0E3FBD3D0B5E252EB9F3C23253D38C4E10847FCBCD2E1E6B2353788F919A272B168FEDEAD9000658B20029CC3A54F7F89FE0E6E01075' +
        '7BE0170677FDFD780FACCCE27D7B8C3850E17012325F0AAA991D0B0AA2F246AB2437B01F0E550C4C2FF57B84496D194CBF3AB535E324D1186744BBFB97BB7105' +
        '09A1CE5BA58F002608F1665761FECA45A596107077D81DA2C1FF4CC5D9BC37D6C2010272573B058E7ACDC374266F388E543572BBC7B2A728F8107D9F756D56D3' +
        '9CD1F076103126BDEE58FAF0CC2C66EBAEDD0B6966E9888FD7D586C8FAC6635E67E8DC10AC9BB4EC60AC0B016DCEA5DBB44B7DBA47647916CDED12DE72AB09E2' +
        'A912EF6154ABE9C8B263E7E1C8D0537337768BB3E958A7A6C19921A067DB5751313EF5B04956590FD5E8A4A10E0F418779FC823DBB1B0E6AAACC94B22A32CC79' +
        '15534878A6A79112DAC84CDF6EA7283B310D75D4F0412FC314BFE8BA195A5811FC0BB763E0393E97A22928805727E6853AD43B3B5E99E22373253464908A177D' +
        'F2F734FD275D79AC3D07235F597125585B61C6E6824739673A765D1AE646E088AA3854CD2A7AE39041D0A57E6ED0BDF4B9F79D69AB70108EB87556F6D26D744B' +
        '2D4DC61DC62A80613842536610220E7936CC9246C7EC704D5A9D973FB565D7FA38A2C2FB5B25C7AFC749AC8CBEF72E204C7EC2C47C3F1FE5EABB90AC4CF35A90' +
        'D4BC75F1F1841B7B396D0BC772A5030BF19D4C0BCF376FECE220E91320AD7BF688AA30DE321D2BE7E3CAAEE1CF2E27B2729BEBE7447110507044092BA81B9746' +
        '038E94B078CC71F6F4A050D768DFE70918DF4631D656E5879A8E557010A323FA2E2600658AF5C7EEE5ADF604EE63C672C34B8B98E7BA31792EFBCCF93D264686' +
        '71B79577A6CEBB96F60CBD3705A07D0E0D8648635EF005F0877C4E633C5ACCE23425BD34CB5E9E0D4A0FC032ECBA4CDE95AD33F313CB1C0021DADB175257FBD5' +
        '3CE3583FD1172EF3866016CF7EE322E25FB645C7EDBD84F719F564DF62EB2C2007193F70B0478A4BFAD864294FE0CBDF68E81DE631CD408B9498128701405645' +
        '034015E36F7546445B5EF2F8311BF1D77101E5E9FB85CAC4AE741112322B267766FDC94FA67AAB15A3A69911525D15BC82D26D151AE045D474B4FD5BB6FAC476' +
        'D5329BCBC1CFA650FE11BF0FF0EAA2C54CFEAC1F5006DF4CB06DF98D4960E89505E7D496C9BD2E1E886F66B6EC323D2926472F833D61832BCA39A74CABB65AE1' +
        'ACE46BD2674BF94449F64E5C3A6799A66D84102BB62385AE15F1F1F70F72EF93B1AB2F77D1B3990AAF42424CCB0BD14059827D07E45A0E2A5994F3DB54019FAC' +
        '51904307D1080FDC5756155B93E729EA3840D308BCB157BA2E75E9D94F6521AC353BC8B307B56B88AA164E44987AF656FD6D7E86977283B95B57C0644CC7359E' +
        '60A9D1A108F06279721C8E3AB12C9AAB93CDEC0E3595B5B3D79364CE3AC6170C05846D1DF01CF10065F0AD276D7FC98C6F527D8392F76E49FD6A222E033EDA33' +
        'B329E616E3BA71372E7BFD7552EE72ADF423FAC7FAD41C3388348BCC147C5454425A291029D6551B8C89D93691C426C85FDFF301BCC5534A47890467E56E827A' +
        '2905A0A67CC7B56BC4D1C915753C05B7D077491A2E49F6FDA8F59A685ACD1008E796F494C2CC8E53B0D29AF452E317A99166E78F0E13AE91AA09050E659E8FC9' +
        '0CDB53D5BAB374BE313014C760E44435C12A3459B87A64EF444573EE8B7E25AC8F16A5655BB043E047F2E8934238D595D49F0B71410F630B7EDFA4BF752ECC9D' +
        '3B5F044AE6A528D7DC7316B39B02A10AD29F4428B735420D26FB228A38D74AA5F5E24C91A9DC5D3746A509513842A2A2BBCB72DCABF5354A288276DC524CE9CF' +
        '48AC7CCA2197CC500E388AB3C8F963738266286F884987B003D55241BBFC1B256C352698EF3ADCEF8D39719ADD1E7F8D36AF4781747322865C1B92820979D571' +
        '44DDDE7D291DCC9156D093C7941FBB2842828531414D2812615D7A2D7FADD6734E71B5263CF498A6DC36D107807DB1D2E9A93AD99050E73E3ECB05874D234213' +
        'D8C291FC9456966E370D5F57187917E59BAF29FA1322C78C8D67D2BEE8F4B48E253FB728DEED07D2B9D9C87A09ACA60CF6C734A656E5189DA49C1FEED7628051' +
        '7655F30DB71E02BE675CFCAF39F92C38F56C29990D90CA9DBF6636723E54032B8849600C4DFCCDFC1A47BC012FB1DF0D93C9391C1E865136B891AE3C95FD5518' +
        'BC23349138F5E88494CCB634B807D6E452CAE2826EACFC75055BAE7B92C20823EF1FAB4AEF2863DC84A90DD8A705B042963B8E1761475276CE16945C489F4493' +
        'BDB746C63E8135974736D8C47A1D17F3FC887ABE624A87F8D13BFAC8B37916D6B6ADF1B5E0D68468280BFE5E0E68C22F2C78AA95C35ACE91547978B26397EC3C' +
        '6CE58D9956DCDE5AFBA4376C06DDDBB740C1573567A0DC8BCB7E75DD84E515D6C3D4AD4D4A814F8EB2D23C6FF31A09A23BF085F8C2FC6792677BA9AFAD576AEC' +
        '63E0CE5545232BF1FD1E2809525865DA6B1907BE50164B5760F9596C9186F26D363C06B4170598ECB56A870CFFC56F1AEBFC242FD773A33367212132CE5DCD50' +
        '23EF704E89B1AFAB8D6A99091D7C798F6941BDE38FA6D5EB3648E421E6C0F2FCEF0F08E6E9848CF4CF827881A1DA0BC58B908C9ED037020215B255C392161B7B' +
        '86F20DCEC35890566B6294A38E4A7C28035903CB44EF45AD0B0DEB3A7BD2D774AA66A50898518C4A616C5B35B22BEF5A57D65F9B4923602A10BAAAF5D67E8D75' +
        'A4A33596FB39BC2574C3138D40BD30C6190182503611789053B94107443A2A82FFA9CA351B76AFCB096EA584168948A556D2CF5C132ADD07F3F49E0FE818A63C' +
        'DC2D36E66EB6F01AC885579E9EF30ECE761F15BD83B68312C783037F75BD7C5720DCBCA9CAD2F793617A88EC7B1E28B79E54A2C64B4254EA98A7910DA4C692BD' +
        'B2DD830EAA82FD4E8452457FDAD1723C87EA6741AE956E0733F8787A73AA6A7BCC41E24B18666954257B3A09BAB0137B1141D55754019B0830BED6F1728D7582' +
        'C52CDDB29E5941EE43E1A9F5A8060E1D84F5D2B3292723550C80F8250E7F1FB9021B4C3B25E70BF322DAC2F174FE39E917F03D51FC85068D6ADA2B0DEF2195CC' +
        '013DD016586FB29158AF6F5268ECF3C1A6F61586AFB7A97B6AFD2EA8BE34FE1E0880901DEC60D8311F02428B8EB1DB0366B2B76E95F9F7A97DA4D68201E8239D' +
        '8C514212AFB861DDA86097BB39C5DBD938ED646424D626D483E6BE753E68777ECA0DA2DCD1F91B1BADA2C36B26C0C93E532281268E7F079510DC11316AAB4742' +
        'BE4238C44E59A02B5BD1AC2665F0DE3602398704B628A09FC57909AE42AEA958063EFC65CBCB034556B890E3137801C024692CB081A4BE959DC373F1AFB77325' +
        '3C9F4F83F6296A7A0C514F9A2A13687F2AECBC11784FF476BE26F359A105026CC47538B76D67F3D394ED525F5FBD0D3E3074C6A84758E75C5D488434AEE010EA' +
        'B27F5D366153628F9D4BCA57E95BE81B828EC419180B1CE7EF3FB45D9B94EC3E2561828856C105B44C859325744A6DB01FAB779EB35AAE89F6714DD56AC79CDA' +
        '5BB63931E17C7EEC7C843B0AC598B800A2BD04D8A4D8F6BE54F34CEDF6D6126718D3A3EAC996AF4AC66AFBF847C184C999091203829704A22ED1913D5F07DC49' +
        '1D957DB148EAAB7C8849601E1F0D75071C143217964E33F48AB24A98D10445328F9B433C7C3C632591047FE773C1A0CCABA612378E9661B4FF7385B1589653BC' +
        '5B1BE94D455159D2CC5ADD22C0F37D526990E7EEC03FB672633B45911E353D3B1D3C5620FD449B8519F15D24D5D8E17C511C3C747E863E570C49D6AAB83E9D8F' +
        '4034F3F9EE298BA349B40C0457392E1B19ECDCD73107E7C4808D9C0E4CDAED73DBA9BB9D9DC0C0ADEF6B1A17B5465AA6D5A7DD935D546BF98571E7F7ADA84CC3' +
        '68CB4C6DDD8BAE18C25F0EE684D6D0D327CE7E9038B75E183F72564178698F4CE2E8B2D97E4D45941779F650C5EFEAC90F0A3BD32CA422216E66B71D0368F642' +
        'E78CB97BBBEE310DCEF9D5D1334885B2650236F615BF8BDFDA0108121329BC7C6318FBF2B40C58A531D9ACFFED5B7980A971121DF09594AB4F499A7D56E98884' +
        'D894B4CAC40A81D1E892D577D8116C1777020A40BF7D19834802F134825339D0040C447AE8E72F1E2E95AD4E11566B9C9AE6A7245423FD07CA8CCDEA04180BB5' +
        'E7A9AAE6D3F8F83C50353DBF03309581C5FE746A1FC9F095655A86BBB074349725561562E7AAF118C7BE8C78C11708835B12816F68B60DF1510E4A46B591D5F4' +
        'AAECAF9313C9720F31FA236BDD92E7FB3596E2C32F167492FC94C516435FD1D713F0E4532A7219205D0970253894DB78133F178938F1A46888E91AD887EE0CD3' +
        '1D57FB14E2833C74524CECC9D8A44B947A0416100BD03A5FF424D2270E3E80EAD4E7BBC0265CD1B76D984A36D7A8D8DED96513481F3CDCAD9FC4DD3BA52BD7E2' +
        '37D9FB84D7C1F30614AE19815CC4B51376004B6C3A4427A6B6B489DCFB00D6440FF06DC90A8EEE1189976005477FE20AEDF722FE10D8C2652EF600E2629F41E0' +
        '965F4478580E3ED1C19251544992C3892B7DC291AF598A4BB9E9E63754F4261BD668A070E12334FDC158206BD4DC1265CE4E9B5F5C2409141EA3C991C7F8A84A' +
        'E0889ADB169701BD18A75D413C8D559BBE2EB343C8ED072D83097A798BF3B277B0CCB9314965C3C08F3F4A2D74236270B7C95D0347E003716C53F43FB67F33E1' +
        'C13885E4728C969D92B91F9C6A9D345699B3CBE100A2F1CC0A676DE00B4FD8781D0FF34BDF38BB0A3FF48F567560E99507BEE5FF607B33D6317D1C21590A1DBD' +
        'C7BE99B3156F564C042DA0385557ACA3774F2248281FB410DFF13A0339F965D62776484F8014618B9ECAFC164E89B2B7B2ABE84A024C73D2272CE95C62542FAD' +
        '933019FA95C55B09654F11287B3941087023297EFAFA3E227FF71BAE701EC0931B894614A409C8300D33C5AEFCE2EDD34E530896E031EA57CD5E5D2E132918B4' +
        'E6994D135C2E59087CB83422E4756B835E4603927C74CE9B3AFB18E5C0DBD8A9DFD31FE3068B15D0665A331EBBB205E79A85DDE1BF1385EB5F3FB01BC53F671F' +
        'B6B4918DD9A0401ED30DFBE95DE779EB893E6A4075EC23C7059EBE1C659473BCFE3A58F74BE18893BE2436B5056440FADFF6691BAE259684C73351211054A5D8' +
        '269D0CC68F518F0ACB9B9C8B0A53FDEEC1D2E924C1E2331045EB619D551014CAA11C80182CBAA2986949E2CF51DBBFE46C8017D2812449704C7CCD58B528A52C' +
        'E429E7015764E22F91AE324C962D5A7975F32CBAB695AECC1C12B306255E097D5CCBF3A321E52C873A8C66C9DCA13B5807E0F059D9AB1254492B85C18F52DD64' +
        '2D2393680EC79D55D1C2E441C5949BD5D377C9A2F28B46E9740970A7BE5C1078E68D9C78CA355ED5AE23A9BDCAF68C6964C6BE6D539AEB24A5B406C5B7D498E7' +
        '72AA25C9DCD6999B4A6E98406B71DA3121328AF17535C7AE0E2D81B1CF8EA1E89510577E348A2723C46D05E79AA1D710ED5E2EEC6AB094CB53EA612BBE658E17' +
        '98028B08516576C2A70BBAD8CE4ED70597A26E4C64EE57152CEC67D939ECD9B5700D9B3274700C5DABD5D01958284688D7CA74D3128524E1A3B12496ED7B5002' +
        'C7A56FFBC25E57F7972ECF3920950F79ED130085ED8E7828B82E2873CE44EA167ACF17E0AF6528BDE648177C9A9AC391F53AA35854D639055DEDAC830654A9B1' +
        '4AA5A6767C733878827CB7198D4B855F52507BB56CDDBF1E744A54F8EF88874BFF1A4625B725103787139E08FCD1144C4ECE16ACFA72D1B83970C2FF82BA0F5A' +
        'E1002D0E069B52ED640F774242FECB3164429C7A2E47414F991757F6DCC6C9D354446F771455450D57647B9C819444C26BCD2513226E45677313BED5C796CC17' +
        '8436D44086BC9FB091A1A0970A4AE408C94E34CAAFEAF4AB840A6B8C6AF92086BECC51D72178A6113CA0E76384CEA769D1908E94D9B75E57AF2C5BAE5F8B84CD' +
        'B53B2B937CDA8F230B235D3503C87AEDA2A2332896B06B55229F8F7B5B1499CC3263FD0781A81FBA17E31E1502E8550649531C61C0A80E4E7910BBAB0E814EF2' +
        '101A3C32F655F2E55C6925993B47A3498025B8EDF1443F73E8056D24BD54AB19601C7133F63E6225DDDF30321936234F1908C6EA12A193FB8C23308105C1FF52' +
        '394C1C7FEA43E1AC762AC254ED6186141ACD596E5A2D8A2B2A0980C3FA8A86EC16ABEDD8EB0BD6D675309AD0B53B555FD7727C192F6FF51BC833D0BA415C95CE' +
        '8B81F488318D58AE8B1F24ACC07A4DD755F0C5B9DBE6922374B4ED00B078C5641F5B603621EB66F8590B9CA0408AB30FBF92DD3B926EB16CDF5E790695CCDFD5' +
        '8EF9D6F5D3F553E470AB1A51A6123F432DAE6552417A72845C14E6C667975AE8C618309055D5966C998EEDBBD5CC54570208DCD4B5E3FC3A07EEDFA5F6105808' +
        '2BCBD47CC3F1C0035BCAB17876912FC914234BEA37C8DD8EAF157A6E43BAF8E749476FBF838A3BE972726F46A2686D19DB7925EEA37A56F2BD28AE0BE3BA5472' +
        '2F98C9E4F466F1D3EE93E4C64E9B372E615F0BB9D3621EBC49DCB979A5980AA574BB6A7AFC8E0D462602430B1CA7E7C14392C33CAF79950F005090170E49A080' +
        'F16CA3FC21374D60D3ED7E0C9CE53B6A5545C44B4AC5D56F0682E8BCECC82DC02E24E96290F03CD44ACBA17FA10007C7381B9AC5F9B630820E4A33EC02135882' +
        '4B3686FA102214BB64565F61CDA30E0E9F5B12DE6047FCAB87872FE4114F28D90B8EDEA49B2B3049766797C41B8D97DBF9C0D4732D2F1C191CA686A3F7664896' +
        'A2F5BDE607AA6152976C28E79D9C5198F5E1485E3F6F838E5DA1EA9647849AE142171A9BB0CD5FF0845EE1BC26EFC487B31611DC4C5E53E01B45EC9BC3CEF3A2' +
        '2C3ECD68E98126920936449CCE4262C4770A1320B5F0E42B1CFF426549DADA3083E6898E14120875BD7F26F93912E16DE1ED314ACF7328AD8733E88EA5A8F523' +
        '4B75DF8221536D471F7BB93FDA415ED7DCAF1E0AC10BD011E2DD767E35DB915D7935A480C68892F96B48021A06C6CEBE102A0919C29002EB9F702CDA5694E872' +
        '656E0E8082FFE22D0B7B8B5E3DDAD9F5387475F0BF9A8031E81457A2853C8AAD2F6F88A57B4C8D3F2E711AADEDA05CBB10D60077D6AB064299CCC910135BA4A9' +
        '793AD8680969536ACBD3E15E96EBC3F4A9FC4FF998C1812401C8AB60F9EBE42A87C8BEE590300DD4F43DECD01ED67C3F44C25AB7F5256E23807264B162E6E771' +
        'CDA8D5A51C3123C2DCFA2A23EFF00C72D930B6A02428332B86529BE086FF9D4EA71A54301FC658456C6EE8853BCD54A6F2EADE7243281A672A25D8C88FFC0325' +
        'E78511BE9715AB3B33591E594F8E41D7CE8C8FAFFE2D0EEF47AC911037AAF421E17DF2B8875838FDCDF9C9C3517316E2BDC35CCACFA2C468676F1C686AC10B36' +
        'CBC08B068831ED80779E0F31E0076247E64AE3E947CC6D93DDCC40C28AE6B64A927E21F408F7AD22DDADCC220D'
    },
    {
      set: 'CROSS-RSDPG-128-balanced', file: 'PQCsignKAT_54_9120.rsp', count: 0,
      sk: '08B491D9C18B8B33BB3CB17AC74574543152A6C140B79648873B84D5A742C70E',
      pk: '4390C28ABC4E13D1E9DED0AA28FEB731419D32482902951F96C5E20E6653F77ED69054C2C0EF0C5EE2E6250F0B60CB82E5C7AA19DF01',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC868F468C0122C00AE15F7AB0410BEF08F932D20F2B2FC7E907B3C091DCEE7A5' +
        '6A3A87ADA1B47F28FC7A9F04635B68A40D57E7C339186A4B85B76B18102E97A31816960528533B6CDD21BAFC93D0BE877CDB1B6D5E4C1528075935424C52E12B' +
        'B05FC2A030F25D480314F117FE41386C07829E5BBEFBCF245DF543801E529C578334424365F01A71DBE9CA1C31CFF8FD562B1728D6B0D30B3E3B7F22979D1443' +
        'BC870192DB7CF5C17EEC597886A8E66B8E730ACBCD6370403C9AFB338818584C4437DACA6882A8E402F65BCDE5B00CF00B1553B76646CF74D894CA3C438AB12F' +
        '79D961DE00390540BDAAF694524BBC2627362F9AB8E5C9707BC1E789E4EDD6221CA7430210C6F3403F30F31D2A4EA8579559F08801ED864E5484DF7E8E537DFD' +
        '39F5BE02123F35EBE9FECFAF24A93E743EFB58F1AF82008195605086E8E73D23BC88775A0082E0ACA9A317AD6701F939810E271F75407F1E939C13D68DA7F21E' +
        '66AE3A7F2F982DE244F091A4ECF00F62EB19F07F4B487CE0D2DC9FCE4F173B52DFF19F6AA9331FE4BC98109EC82DBA499EC821F6CC2D1D9E324D5F84D48533E2' +
        '2CEA304578F262B8A70102B742ED9509EE60FD65E1217AC15AA1CC877C56BDC9D6210ACB725B7C01C97F5E4BFC43983B8B5EFF686110CD0A6DF6514BC16D18EF' +
        '7C98E3D8AB1CDE2AC65CF3061D5191AE1F4C7FA1ECF6D4301F779E035DDFDD16D93868BEDF4F35834A245554D27878691589001B5F9B46411EC580055A0913D7' +
        'E1CBA8C391B96589A99B9FA309BE9BC70408505BCEA96C46201F06C940D938CB10FFFDA2B793C36A509C2A8DBF7F1A0FDF714BC22C4EE32F272D039BFCE6F912' +
        '67AC68ED6D68BF7EA6F8124ADAEFD66BC0721E7D82CD3ABBCA8554B359733544DE702D7ACE26F0A73F222446935F67D032080E471674F24DB01D6DDE0BAA0BC5' +
        'D85DDB5ECB49FBEAF96DBD0ABBC976B30350D35AB930A7E3531EB9AC1CD95E223FC03A83397014CE7A3C4C7C44679A10030D03B14D2CFF626714A5A589CE1351' +
        '336DD31479C86BDD7AD5DED1BD3FC6F74235400F383F2415A46DB3A8BA8381413CC7DDB0E2312BC41F4F766ECA0308D70F0B84E577CA823837E63273E5B6E3B6' +
        'BC464D05305BDC5EC18B4B35ACA4F224F18D605FA6CABA59D48C2368A186EB95B1860091B301333B71750378E90A1190C515E7A7F7F2A38A05025B19C7188F2F' +
        '05260A2E306FDD7496B0507BCE1303BE55562234A1DC7F230384203FF271BE5DE00A75878DA59BDFCA5FE4505477C4CCCD23A4166EB7B95157AD0A7C8B756932' +
        '11ABF511DF61DBE34842504ACD593BCC33F2262B7E7FE58FC6C8294C1F3120FD6C87153C7A9540CBCC711F29B4A1925032FB319E06E24B9B85810CA133041507' +
        'E511030337647416A01B0C2685ACDFE15D6C36F53DA8E07545E0E594CBF9FC2B355B9DD6107147A48BF5E46AD1549B16B012B3D7C41337C29F7CFA27E7CE10A4' +
        '2C3B46915C2B060102C26FD853B7B24725C303E1DFA6D4ECD637D7A93A5C275200DE55DA6BC43E084767F2EAC5707487A269FB2E230C3C1A7D123E032233023D' +
        'B94AD67F9400DCA26FB07530B3DB9F842DE4041E74DA55CEAA00DC4BBBDC534D823481ECD9E55F4AA8FBF4891B18A04CA44B9E31C192ED4236D5936AA8A874C4' +
        'BED8E703A73B7CE42501529B7C7CDCF10BD286396BA7CA03BE42DA540050348D9AAA9AAEAC265C9AD33982BB53DD3E74DF9CC631F6FCE03E5C54B1E89FBD3643' +
        'C20907EE6FB0556B861596B549D6519EC230387BF7271188A21668501508F1B2F35D7C09721FEC26A19BED027C155D444FA01817BEC95A8D677565DD08CAEDE9' +
        '54D96BFEE19E81FB9C15C14309804DBCC5A825773C85B055F9422E3D2C0F4C2F573165BB4B592D76C9E5B48B84D2F0BC76E46C607890C11BEDB03F659525DE1A' +
        '3D3627B5A939AD3B6C30E846F393EDAD790000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000785D2FA2C452EFB216E0F1ED7D7A2E7E5C937CA7AF586B3614922FCF752A38826B0039F2F20131F05AF5856F3FE8E5' +
        'CECA818594F8F1C6171337BBD232036233639DF9A19C3B4120BBCB5775B2ACFA51BF457644384FCC1D1FC93827A61DD4D2B4B06E2B4840613B909F43BEBE45C2' +
        'C2967DCAB7480EF9CEDD7B85D7A919FE46900744603AA5D6D18AF5A9A842C2BF6946819EC868A2F8257FB9601DA279001F177B03204CDEE9411C1286D369FB10' +
        'BCCB9967CF93CEDF1F22597EBDF313C32C28B0DE7229AC9AF539F8398F975B022AEA57BBDD1B60DA795FF79EEDFD132CC251E981DCF1DBEBD0BF4C973214CF41' +
        '8819E97CE2B0F430A93355CB82479DE67A9E441F317E6DEC443BDFC2530CDC580635CF1E248267056BAE7CA34493BC2C0F67F2C71327AE2F4029461DADED38FF' +
        'ADA33836AB417482163940D219758826EE12C073F19E9D23D46B468B12E36AC2E458ECC46DE39A31809F5D5074609011AA5DE412128A424C0D748F1AF2E8E48F' +
        '2227E93897BE28029B795B7EE3260FFCF9AEBD22B4AB82B9FCD92193BAFDDC6458E250CA86866B12CE0E936653393E233177764448193B358041816B07B5221C' +
        'E6B2D812B81E1F61A5475B678FF456F8187B8280036B41A7686CA1751CFEB2C21373344BEB3912994817C0709E4871AAA0CED4C2673F3BC023FDDDBA3316B5B1' +
        '5D6977D4D28E60A75A376479CD301DCA58640BF0B5DF38627CB472B1945EB921A1D64B9E8FE1D7DCAECF6EB8E112FBFA43662E7D1A7FD6CF89FF8E2AF715818B' +
        '5BE3C9A7826EBA48A0B223883B86673595C04937D29A9ED771A04D189E2AF208045FA1F85CDEC0C2F313973E61343CBCBEE2629F8537559760D8EFD8B805BA6D' +
        '686FE3E6A44F823202D2E9E71B2E5F462C328F3D77068C92D4471E38ACB244F70B3548A057B7538A7A99AAB8C793B25A0085F83FA9142CABD2CBD13AC02A46F4' +
        '8A3BE1EB1DE73B30BF6A370E1143B798FC19D0441A5C4E88FB07B605E162D2B14A5A146BDD7926D94E061C6FD001DE0155B5D4680D61A624F0E9458855F0D19D' +
        'E0ED7DA0DDED253F108C58B442A148BCDD5D459F682BBAB4EC85BBCDF08A428D6CADEC1B8FA24A8DF437AA17727CF0FB6205267BFD7E4A0A359C12D19BCECE8C' +
        '5C7B675E2A360E9F04B214023ED00726F36EF89CAB3A6C4CF3224F36BE111014D4E097F562EA0901F7B4F18B385663839A146291D14A86F0A46757C1F1091D8A' +
        'E9DDA658C677648A54BF413565CF4B630E0CECAE4ADA75579A485AA33A044CE4291958F6C1D81D922B07A09ED73B2315F587EB11D7B5BF1C214537105454C567' +
        '60541631AFEFD95F8C4FCE7F23CDA606E95C1C7C77610D9B398E262C07AA5B9F835245F6781696D0F805E779ABA6962B69FA11EE7B4D24D6BD392618570ACDD7' +
        '2D91B51A99AEF8FA2EB93B9FD68A515580005B2662AE99D5C7B427D8FD21770DDC0DF37EF2553A105B5267E442BCC8CE845C355B63701D29E3EAF8CAFBEB9EBC' +
        'BED8B97CB0A7DB0FB168D1E2A3C62D46B7E41E042F3B911E0097D7455EE5EA35DB7AFDDFDEE2E7A96F267639E9401BA055001D79EA7DCD7D8EFDC5B8421A39DC' +
        '41348A778FABC55B77E2AFF52D8C2906041D3695AE8F689B00ADEF216840D7E42F8DCA0EF1F5D2A4FF0A7B3B570E64BC2AAF37A95A9A74C70F2D84500E79A247' +
        '865F62ED75A1DA591F85CE2C7A6E78C21DA6CE8D77EE97839C688D4B243AFA803CC27C59A78775A2EFD6339D48875AE957B6912FCC0BDAC6FE78F024F4D391AC' +
        '3DA8CC3C91BF58A9CBEB3217D5BBC181765529B2F00F342874C3E22D8E74AF7A0589026A4F6AB74FA0E6E271142F3C59F4CB9263245C9E3E6DF671E1D3F9677A' +
        '72559829F54EC04DB739605B62B14A579D6136EAD0CBA976834429A3B936486ACB7C89CC89AB413BC6552AD040FE934C5AA8A129F61B8483D437242E75AD0898' +
        'BCC5ABD6077353A5840876EBD0BAD58A891608997D53673171B961DAC75DB522D64A9510E40CAE05DD61D6E4283063EB28F55A6CF72EB5038AEEED0F06003227' +
        'DB67E6BE726368B406D6572D16ED8BC16F8A9735EA24BA16DEEC890B56619952C363A4DDB1ACC0700BEE744FDA5A22472975639074D46EB4380CE27EFE33A29B' +
        '5B80201922FF826C4B61F605E2A2FC7680ECCD70430777B4F9D77323CA21627FCB7D0430FD4CB3519F7B9225FFF776C2659E7660921660D14E2E390FF5389303' +
        'BD138EC45BBC4735C1469DB17FDE066B55158742FD416599050935C7F8CCAD17F2C6AF4351E2BEDC5A41C90E97666141DBD41260FD1CE49FE8F85D85CE1CB304' +
        'D0FD05DF2FB8C90F1FF4F8EB07FA95082EB668443F02DAEE106A6052C9C7B433EAD5EF41C7CE33C3BA5D63473AFD238F8D45F600FB49E56039780275CBFADB95' +
        'C7AA150F42BC3E173B53AE0F0EBDCC97A8D4D22E6BEF04920417CE7261BA38CA9ACD80F76B22CF70F0BA783FA1E9852CD7A15B6D22218F34A8BF2918E0A2EB3F' +
        '2CD3BA83DE2DAC65509FA16C401E0F877BADFD400FCFC9A58A1AC90511F23CA4AA04DCE564FF09A101B691682ACCF81D18AD9253AB54D7434323EB1E877E790B' +
        'AD56EB17DA99AA0A1218A04D6F4582843299ADF9B4D4E346001FD09B817F28B80C6738FF84F76D2FDF217F58B0AAE404926E72BF0802F7F30CC89B535886AD8F' +
        '96033FDA641C618839015351A64B6194B25FCDA9F489AA15C546DFD68B23EFD345CB90899AEAC9E6DBBDB5258CF41168F55FC902886B22DC5D2B04251A43984D' +
        '5FAAA89564C1A23A939FDCCBC96ABE64680568C448DFBCFA68DFAA362FA696A77E0D7CFEF44B4ADE1938C123F0A99F802724EAA3037CF369B6CCE2E5ABC7D13D' +
        'B852F079DB4BC50853BB0276550A844489BA853E0AEA342BCB26202860F1CE9B774C954E39F23DADA88F2DC19C1A7D9B73495502374A4BBBF4ACB0A0B448AA65' +
        '2C4414D2DD673C330B0FAFE4F06BA23F39272B5810E65DC95BFDD8CC95967FE20EEBBBB5A3D3C7A9BE025B552F3019AB1741048DDE5F86BF9B287B93C76B3564' +
        '17369AF4032ABC7EDB509AE5413A23688F93EEC7A16F9B0CA3B34CA0BBE5AD2D195710EECE91FF9BE5644814E694AD611D160A0AFE638D6BA651FB92E8BE3119' +
        '286076A519097BC766FF01994C66126D6CB20125CCAFE1FCB2994639BD171FD576846AAB4764F736A5B3C7539C7A0E01E1BA26F37354B0168DB977F09166E057' +
        '03AB712557C59B497A054C2C289C50FD93844531DBD032CF5274FBBC648AE155563353BA117226D54CA132D6994ECB4F1D803C5BBBB4575573219789CC6C2C1F' +
        'A3DA095553EA567B0F1566C82FF8B0DD26B918D57420D5DA8CE2277262D8210B85252A252EEFDDC3DDB826479506CBCD19E0E885556FCE205337A9DC495A8CFB' +
        '3C06A0711A5A7D7134DA2320A295D1CF5CA3FDD62E94730BBBDB152A4CAB1EF4B4A7545C259AB7FB34DA05BCAA4E55121D1950F70BE33B4E67C412318A63708E' +
        '4A67573DB289037B0F7A76498F9D8B07B6981930EDFDA78B3874627D230A3C549DE9347FE8913631B0A4D4E8F223012ED9D4A396213B5237D84DBA05796EABC7' +
        'C132677BC9626CB224B4CE3E717852CEF2EF9BC761B2B9F68A8382F67814791E8A5DB7B5E27C66AA684FCB9380AE54D604000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000062E7AFE27F8622677B87CAE9EE5C05' +
        '1ED25DD9D8B1BD5CD4EB5E9E1EC34EC19D754ABDEB3B7AE2ACB5E659E2AB9254D6F71394F4FA64CA885A40025514EDF3CF55EF542C3F3248B386B01997ED1C9A' +
        'FFECFFCB964190AE4508DCF5A625C8DC7B41A82EF64427CC1620C8C4732D845D066D48922E124AA53DDC191375F240A0A73450D53AE5CECB07B23A79A89B1D2D' +
        '0017230BD66DC47E9427E1CC1B3742094F37418519D9564B442C2FE17C5DF0CBE78EC96E08D151429912B7B7DA0E1000050D4C911AB02529E80E8F5D99A7CF39' +
        'CA36EBCD0E1946A7365EC626330E3E58FE0A1DE9AC06F83ECA10EFF83957AA2C322E6177C0CB77F067AEB28925D025644DCA254052127086820FB592B2CF9C80' +
        '9C36A2E2084C4FD8FB1B5B6EE72C7285779E79C2C1F27E09BB2DF4487CF3DF1D0728EBB43FD4F2FC00A234B2C13EBA14560E0E3C827558D130F0D845E32A8854' +
        '77FCADFA6C71AFE0C0AD5BDF0C9BAB4B4068914252A4D793405EFC1579CBD8446B1F418C89194F6397479034AF406419BC44B2863DE994F103C5CCFF9E720F70' +
        '4E9D373512AD68B55EDF596A59AFF94B8923BB6843942C702C42BFCD6B706DAFDFA117E6F21A75A44BAFFE61EC3FEF0F2620307708CEB36D1C225CE214D1FFEF' +
        '3CC540CA142EA35D7C2D195EBAE036D2D618F4AC48AFA8204A41D26AA5D82CC4D34E34149C1DC90D26211AB0FE502113B145A9F757729F4AC2333176FD0DF551' +
        '1996D2B24F57ABBED39D59CF362393C0CD06FBEA04923A8434469DBA029C85E9D9B68D56AD4F468EBBE31CC9AD7CF4767B6634E1B923EC0B4E6DEC0E09F57CC4' +
        '41A4C41DA68F2102C608BAD0F6F727BE76D3AC858E384B0DB58E13F6ABEC86FB83516E22BBBC73F5A915C413830F422360A54180D6009A81FC2479214DB324E3' +
        '0AEC0A4F33C7DE5F761C27A9015C4A3CF7CD034B3E1C7DEE1BB48B5BEA809A7A4BC20CE9C4671FBB555C5A14E87712F9299A76DFCAF7B638BB3B7DA6325DFE27' +
        'DC88C0E636033D5554FAEB82FC1C48AFA87E533CF2C465300D1F65BFC2FE030A762978D8E05948366F8D5C5C0AD3149DB9087254D3B925BF4C3456A68BA7BEE9' +
        '22AD0B58C9469832D89D32262865FEAAF1E7FD74B461BBFF81B20CB6735D4C26279B652E75AD1F266BF6AC499EB556C8E9C80DEE86E977A0A4E2F5694E507DEC' +
        'CF06C6D3B9251B55D66B0CD7BD2A3C4D8443A405C27348928B772C212D84CC4F33AA1A45AF49A4B0A67BF469B6E736D200A7E7AD32B0CD492F0B2B28F18458B4' +
        '4881AF2FF624EAE842AA0F3560B9458D699FB5494B19B205F7385204DB4FF97090F1A2B235D93E0AECDE13E232779471A741093CC08E08964B358177D77CBD4E' +
        '07EE6DF7B4EB7B7E4E9C87199598061BE39E0A313D2F2606A501C9133ACF20376CF82A63B0CC23F56071588ECFC4E8B99D8DD05515BD4EBEFA521290A61A8631' +
        'DE48D8CC94C12D8E58DD1ED50A8C5933AA493F4E1A2CA25CF19DCDAE2CD45685CADDD5D3644A6A083184D435F88A1E3AE3DAB42512F0C0A05396A2CDCD97574A' +
        'E630117496EB369288C302138EA20FA8E6598E77AC94CDFC1879BFD0A923AB30C602BCD60C5FBE3270A70E1496A5D018C7D49D5E3E5932B116376E61B032F3ED' +
        '9FB4A3044A3786A7481D76769E927EADC43C1F0F1922D4474E892FC76F754C9D7FADF9E278C984F7F141CC2F78634FCDEFB99797A17E5C117C781B43EF1A90F7' +
        '70C9E444601D7B6DD98C0CC1199677EE4F4C48A04119BBCA13E3432B5188CE0E9710CF411DABB0C959C73CDFBF0274825B53332FFBE15D8067714D2A8DC2904D' +
        'D90F5A7143418BF5037C3D14C2061C702E39B44446CAA0A262043703FBD4E5FC1F058F9DF101033187B93A629BDC1B06FE794A5D447C7F582E3C65381AED0642' +
        'CADF05908451550FCD7D1E9B7DEB6FC2927BB340BCB754C3E04B38C46793186C9DCB4E2CBE355BE868E684F85BF88A153B750F0334EC1024C24F5A290A794D24' +
        '38882B80F4F814E35107785B0E67E77B85106B203B153815E8CE799874015848032CF8627C85E09D5C45770734CB9851C9E4DFB092296C0EE46B90F411B681E3' +
        '787B03CBE9093E261F736E1AD734317266EA14C7CC736F08D8AEA58A6C8B138D0D93F78699EFA683101D029C9604F135431933208C0E3CA8C5F93D6FA355520E' +
        'F7078C92062C0547F2F308717010830A9595F8537468997C26AE1DD6219768A22121B01B0BBEFAE4C4CC6B024C4A86C14E244FAA126AD8C6C98E52D7311572D4' +
        '6A5C2DCBB8EABC280AB478E3052D2BC81DF72C87C9DA2A70A25DB4846BCE1C6F31D73B3A1ED026F84CBCC7B9300464CD778A2531EC893F3C264C740D4057F521' +
        'A0FE9E0038CC36EEA646153BDD0238E89A0021C009D87C058FBBA60E9D4D6E3FD55A5FD6F01F2D295326EA0CE19952DCF864C30044B4CC98C236060A2D8AD809' +
        'AED7C147EBEA57A8F6759CE11DB93561EABF99858A4A4DFC347CD03713866D3BFDDCF36ED4BFBF6534DB1BB3F892C96FAB23BB9B5D1AD1E0D8623C108DEDCCE7' +
        '143586C446E5993B60F36066917252616B8A95B3A918AD12DDAD2CA4F641704624352E18BA117EA34341067B06F1E0077368B399710B5656445D8837AAC65971' +
        'D1327CE782094BD1F97552E25E8A586D25953342AF82BE2D2E78DB58E686C5612569DE9E19D4CA300BB2005180F243E3C2AB43CE99DEBE19C115E63643EB18B6' +
        'A58BF92DA82F4631CF9DA7ACBE93ED35CAC5C0D7D7EAF1B52A744D482DEB68554E38595FBA9668271AA48818C9B27869398AE0DAC54588133EBF8949CD2085A6' +
        '3BB4948C222819EEE27C0A10DE192A3754A858AF9213B67719559FFD0F46F0CED76CFA22D951C83662B7A5F34A027FB9D2B03E9BD3101E9526416D26E45F389A' +
        'C3A5072C4C7E6CF762BF40242C46E8640E77B82312598430C873DFABCC1048B2290A078DEAB658C501C031DEA078D030A5A2EC548469729563C08EE96D763401' +
        'EFEEE1F4D0742292474313FE707BD2FB0CFB2054FBA63947CEDED3F4172A48B068990C81755E44AED7B8363ED6C98B3B783720C91ADB0DBAEF06D6B53D117F44' +
        '96EF7C34855AAE317F93627ED9A82908F0DBA17B88AC470EC9F6062069280E7839DD33B85ACA7D776FA73D4E8C02EB612F151CB92E8D83F0255EFD0BB6275501' +
        'F27D016D382AAAC057B619BF983AAD85503D34A98BAE7BCF143F172293F9AE0BAB48D575CB7509DD44832BC2B94B302BC08A0C6061962CD1B53D40F7C6A10B5B' +
        'CFD193886A0E8C90381C3A4CD8F5AE994019085CC6EA3D3A16377358D6C2523BB9EAA8EE06878E4C61ED331F37418770FB02335B88CE6BECA1DB2411D931A685' +
        '250918B4E1412BB61145F93073CEA30478226CA0EDC17806DA7E44C22CE0E9E86619803A08FD5BCC7866BA8C42CB8CF8EC6EB1F04401538892E1411313508A82' +
        'B33B3690DEF65765573F33596E6AD24B7DEA4743862F7DF81E6B1F8F001780770C82CB8372179872C477B20D097E59B416D3FBF509A1D91918E32943C553A660' +
        '13B50A21FC24991542946587806AFB1ECC8BD7DC6F341AE4F3029BB83BBE1688541CF11CD383F6EF7CCAF6B0153A162143A0C73ECFA14D3726FAD38D24E46BCD' +
        'EB44672A6D927A5360BF090D4D15E67E4974B48E8695E8C2A3433824539D47DCBCD5F9F168AFD1D88E2BC364297E15F1DA2DF262D34B159CC51B2AD83D6B2E3E' +
        'D3CD640869AA8344990D0C2191AEF72AD1B49FCF1BE1F9CC665FABF3E0E53E6B99D39AECF43C526EB143FD12AA754425B3C42C5EAC32C8F058D18F87711589AC' +
        'D34662043DD312EB6DFE5B18BBDAC5BA830A3FDE0EE45EEC0D8E252DBB7C928D84EBAC583C090B9A690ED94F696A9F25D953E2F996AE4F4E70A0BB1284A17F2D' +
        'CBB78969BB1290F229C7F9C4184F4E71234CC5566F9EAB30EADC96D7BC92F8B3FC143F6D08103FC8ADF706AEAC6C19DF8A93D92B5A1E9DAC32C492CBA5C1DF0F' +
        '2BF76B75C0C45BCDEA36A772BFF1FD04018F5279F55962A192250A7BC3EF4FA7DCF4185964150A7CE5E9335DA0AF74867C2E76DEF29617D25BED771420933381' +
        '700EB9F087514C86D075947A1B386A2FEC0571BC2B47D07E5874CA0A16360FC47C07B3AB196B82F2A7706122456F9EEC5564342A727893CF06EDC3F019AF6D71' +
        '1DA012F1E4C13EB0716A4CE61FF1C2866A213079FF167AAD9E17075857536E78A8B54FF40DC61DA23DFF66F27D288A8660F6CDA2C9BA76FBF3F6A37494034549' +
        '79F4C3DE23DD6961DAA254ECF62266B5173D6960EE7EB2B69ED411360DAED9EC9A3A23CD0FB92FB794BBB2A919D8A1C59E812472BB9EC869F2B202082FB61AA9' +
        'B0750E40455DEE7A89AAF15802B0DAB903B807E20D6D7D6FD15A04A4D28AB4F3FD9457A0551EE83D6DEDEDB446B212AC80D4877C4E7191403AA504CBDD688E7D' +
        '556BCF713DC05FC6D8AB93BAF2CEA33F034038B161E112D091C01F814E90A7E073B3E07AF9BB628BD7045A83F318857D9FB0FC088E5202397ADAECD801C1AD5C' +
        '2AF0BBF93A5ADF937B3829CCF8A304BBABF1667AFEDCC9948C9E7F7BA6E5A70DB20014F9075E9B64C75289918E95AE14DCE9E134D9D8F2C991244D18314F964B' +
        '61E4C82F9727A55072B2CCE42911E96EFBEA8546805FE446B116772B450A055ECD8D7DF8AB8139A48032F4AD7DCC6FF1DD500C7655D91B427B45654718D2E0DC' +
        '582DE27A59BE24E75D3F365A07C7508BFC1E750F0396D3E873409CBCECF7DFCC967E9E81C5BC34D96C0F420F04F67AB82CF48C414AC64697CE9169C476CC8F17' +
        'E9E34676A5A44D778A7F0AF019235A1AE42B2DAB1BE9082644DF5293587422BFD97A61970AC3BFAA63C94459D96664D6F97EA6E0FF438137721B9D43AE31D10A' +
        '10318DCBC9D2AF95595D3DF866D8D6336E4203DB46D548DFD1B47CBD807D61452B41D6BEB08DFBDC7250A269197150A69BA21E06309C9F6964501938BF703964' +
        '571E29E344187FAF806B8899B7E1B6B64E6C5BA3839D26D16C1BD04F23CE705A5F135693D93CC81F1398BBFE4E7D76EF98DE1B742C420FADDD43E020EF7446D0' +
        '9747074189702D8A85F3B57A9BBF45BE1E578A1E2FFBCD3129872C3193FCAF276F69244A4D5D5B17D24F77C30A8BF95A931D446EF05ADF17581EB5D6D2976652' +
        'CD7089BE4CE8F6E25332442163C3DAF9CE3A343CAB66D57B9D2EAF25CA726E92137861CB9C444A0977FC5DE33DAA7578FDF90ECAA4F0CE894399C32E6184721C' +
        '8B6C533A75E93BCB9D9C2C79330C306E21E6674F8B6B2DF803F405166A37F0A1A7B88E9232D9E70AFA5C77D4ED6AB06D8F693B25A66D22482C3376907679125C' +
        'D7F3A3B90595B92272B3745C5C1A6C26DB705E56D76AEDB1F2D120D329AEB86D339AA91330D79958C4AA9B3AD516BEE834CA208899C06C709B34B61E2276375A' +
        '9C6270925182062FAD9AFC9F3A21AA278AB997C2E4179E90FBE86059C702860FBDEB8E2FF78E18874A8C5A670D1B4C9BE3A83D0CBBE5863CB200DDD74DA2AA36' +
        '43CD1E76020C45E37011BF1F74D51098BFD0155A0A611A894999299E98CA6DC808736FE1D678604AC9A8B1AEED36697B857D217541EC7D4D64CF5A3309088ADD' +
        'DBAC33F7F12B94EFF47B641DC8C51E2C11FA562BA57228034932C2062B8F4551A71E6E082FB9416D01B51932A596B927F1ECCD92C320ACE9BCBFCEFB0A47449F' +
        '2954729EA75143E0457F322A22598BA8F20BD50DBA3B613FC156373B942F70AD35180BE3C8E31B9E56B932F16FAE4A0AA339FA37EEB3CE91CD752CC2B1429520' +
        '7D6478A951A5E48E224C0A68CDF9D7DDC91AA3E50AE18E92DE17AE1CD9D70E58BBF3C34962BB1D3560B460A8D04E08675466872494630191B88C648049871401' +
        '71'
    },
    {
      set: 'CROSS-RSDPG-128-small', file: 'PQCsignKAT_54_8960.rsp', count: 0,
      negatives: true,
      otherPk: '59082419DC5CEEC427AF8C1959E0DC5F86E6A04EF445A2AAB07DF0E5640FA592AE2E9B4DCE0C59E23D4EA36130C8CCC326BA2E290800',
      sk: '08B491D9C18B8B33BB3CB17AC74574543152A6C140B79648873B84D5A742C70E',
      pk: 'BF045FFF4FCB0A9DE8F2470DF666D355FED55FCF0C6DE0FCD8295DD1875F51E9F7E7DF370E629EE5509A6110FFDB055BFC97C32D1B01',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC868F468C0122C00AE15F7AB0410BEF08F932D20F2B2FC7E907B3C091DCEE7A5' +
        '6AF83E3D658BC2B44E6854A8FE752B134008BE68FE27A671523DEC919F524136711684CAE4AAA5C9EB394F4D5CACED6B4BDED67CC0EB2B79174CB59D898C48F0' +
        '47E2283C79983540872E1DCC703E56B45A5FC2A030F25D480314F117FE41386C076C8FE9BE66AA360DDF8A162DE3454A0134424365F01A71DBE9CA1C31CFF8FD' +
        '562B1728D6B0D30B3E3B7F22979D1443BCAE5C7DC10DFA93EEFA647690D365BB3CEE52B98FBA89EFB1B42B5C045392C8816DEE4385537EE0ECC22372F21701E7' +
        '1B8338B3629770A640171504C6A251707375F6BE0F57111435A80F849A69FA722DD2E815E490BE33DCA797D360CED9FC02B15B55CE9C96181983BA5F81BDF3D1' +
        'DDA7430210C6F3403F30F31D2A4EA85795F8151F790FB841630666264CE769E648FF4D957A7C5BC818DC198B5557E655D259F08801ED864E5484DF7E8E537DFD' +
        '39F5BE02123F35EBE9FECFAF24A93E743E88775A0082E0ACA9A317AD6701F939819D36E84606620A1919401C930F3FD4C3AE3A7F2F982DE244F091A4ECF00F62' +
        'EB74E2C2C264508B5938EE016496CF6F12F31952EEA65E9F6192F81623C417C974C821F6CC2D1D9E324D5F84D48533E22C4BA88406E6B5F1734834CFBE5133EA' +
        'D4210ACB725B7C01C97F5E4BFC43983B8B5EFF686110CD0A6DF6514BC16D18EF7C0FF601E034098D03EF09E8428E01DB4098E3D8AB1CDE2AC65CF3061D5191AE' +
        '1FADD93D1BB499A12FFBFB314BA653144637BF2565C09CA67DC28A1139DE7B3AA80BB25D9ADDCF1F787D935BBACDD525E21B9ADEF8F0B9069B7FC6805A8A4F1A' +
        '9EBAB1D39BB52D3C7885FBBBC9DA510378DF70B69E24AFB25B166E06E715B3F228ABF3072F553B310AAC4B7C085013B567721E7D82CD3ABBCA8554B359733544' +
        'DE50D35AB930A7E3531EB9AC1CD95E223F1DD178521644F7B89C91F8081DD28F2B9E656817ED4C45CCA8281D4A2BB496F76DD31479C86BDD7AD5DED1BD3FC6F7' +
        '42A7614931A27BC63FB2C04835CAC016F02C0D215ECD030E432923226C94A109B5690DCE1EDC1CFAD8F8D40D86223DBEE98BA090634DC4A882A7183B0A2E62C1' +
        'AB8D605FA6CABA59D48C2368A186EB95B1D073502C7F10F77DD229DAC889592FAEA51704F9FF2BE90B7A0F223C222E012B398E50E9EC101D59267279B5EBEF56' +
        '999688122BDAF08B0E97FB96FBAA50BD1F6AD4781142F27019DDCAA5C1039A204DDA29BC997F930260D5F5D45AD20B3C7E844FBC21487BF3C8B7AB540F119030' +
        'EFF1289268E944E6CB526FC909B4051C01E70C68B7262F3F3E2FC3BD84EC2D1815B4A00F2EAC3EEF5F2B690FCA397EEBB94AD67F9400DCA26FB07530B3DB9F84' +
        '2D9791D5A4674EF8F62900C71509E0EF0D37CC9A49D7886DE47269A4BEB928FD0D50F9BB8E507D35779774C6E5FDCB6BB5670A1B7AB124EB8D6E01E48630D1BF' +
        'E2D8E703A73B7CE42501529B7C7CDCF10B241560A300EE9D56A9E05CE3F521864FE968AB998F43A85C4BC29D97D85A90267FE9DC3E76436D03F0C2028C055DB8' +
        '2C8B7BC8F092537CBA319F9BB56A74A763689CC7D9AD7CC05A97627AFAE9E6554335A7A4CFE5497B9BB9D9D9D27FA6A7B130387BF7271188A21668501508F1B2' +
        'F36C0433C550ADC9BA0A748554FF0E72DAD96BFEE19E81FB9C15C14309804DBCC51C86EC977FFFEEE450A51F09BBAEA2F2E09ADF78A8FCF25346F9F59B6A4860' +
        '027B25BB4466A9F84E13239105150282E01201C2CFC5659933A1F9CF7C17EC9495C8A7A8E00E32E63E7BCE6ADB61B30FED3B16762D7A0B6BFD93EC44CA0424BF' +
        'F3BB688CF986490751A5A87C8F443C514A4D809AB988D34012585471E22715ED6BBF2B678F4EFE137D8801FBF431F8A4D8B84731D7B1DB39474269BF75850716' +
        '97470C8C9DD6E4EABF9399FAD15341FE83CA3F545793350BAB19D205768F08F67BFCCB4AFC1A13F198687CB3AB39C12A75FE03C2FFA569D97ABBA12FB86179FA' +
        '056B1544382F5CC88C539C8E3C24033E0B349045EA0954AFFE5FFA469FE205608F0B2E3F49251E06D6E4991DC9F224105394917CE3FE000CF77B5E8C5926746E' +
        '0F68E87DA778B418D91936E506085029DECF243FB641D2314A700E2AB8DC66DCE6638EABD03AEFF232BF98AB746D3646CD690F9E9CED698D4C443F48D264EABE' +
        '260B5F29EE8755179B001E47F78C477BF5BCB827B01CF79D80544184F042E9EC06BB7C9DE913EBDC418911CAB91930736F1C22F14069A3D8C179D1FB137B2341' +
        '231FE65E9DF75483B949AC607354C5947A7DC345E0A2BDB33EB4FBCEADEFC8D20016A0822342987B4F6120C57CF4A36E79000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000EFC2A9A2E359788D0937CCC52F8490D6F52E30BDF606FFF9F0047C535FA5BD35AC22CEF089EC76627D7B49C469E939' +
        '2AE0037B07A2E10A38546B615DBFEEDE606FCEF1A168DFFBE3F950911771FAA957FF28F2B25A4A3A621F67591454DDFC15AC7439358F696841551653913F3FC3' +
        'D3C30BDBA90301C45228A9F7FFC9A09FD39E2BDCBF20D225327C9B4B3BB6E029780E39136EBBF0C328575DA48695932666FE44DC47F53CEF511EBE36B7E095F0' +
        'E25CE68A172027C83D3444384ABE65F0BA58C0D1ABAF6BA4532F8C6955AF9B67888724FB2B1B2D878E6A0C7751B25BDF13ECE92C3B14A4C88E7B88E38E1D50C7' +
        '80695E45F412060EC1287162B43A44A18EDC6FF2D1208F755BF7BC727EC7E6622B23FF14EE2CCCD522C4224BF523A4BD4349CA4E1C7FBECC008A70605C741F88' +
        '31EF2A923B69060A0111AD040BF76A2A062DEE13C99319BF8C2776CE7D38FA95FF003EEF5DE30E63B4969CC497CAFEA75481AEE1BD95F9E176BF20BB34114CC1' +
        'E16E1797985DFE61C74AEA67E173A06579084FCA4F2086BD992E7D1266106B86EFED4BF0582E5C8B7EDA489A41502D26EF6343978A585E5DC6B29B1D78FB0DBA' +
        '4ADD9214BC18301636BB9611A24434A069F9902048771FB831D62F074BC2A2E77909EB9BB910E7E00B4B348786DB08E35167CF06D65C280C449DCA22D9A720F4' +
        '4D52442FD6FC0128CEBD342B0F416AA14EBA55462398394AC0120DF3EA807A3A997475A98EF61D6CE6CE5BD9C51A25DE9DF96DD49A21E5E4D3A96A32AC9A836D' +
        '2D17D5FBF30CA1F35FD6BAF827DB22C9913DBA2DF4672A8FFE20486844FF65901B7F578CED4A519DAA160FE542E150C41A80E34BB6D9B8719F4D751A6E283EB1' +
        'D474D7150BA3CAC757773D857D791B3FD762C21BE8D7AB1D241C248AF7F8EC7C98579E2A1F20B79086822183FE56EE7BAD8044988A7E6B3A71C43A2F70CA94FD' +
        '1C4E3432ADF5095F71EB46DBE6BDBEEA6FC364544CDDC575C66EE3B665DD4F037FBDC959A012D319ACC20DD6CA25257FD6E30F6E4771E93DFC878F5A96645B73' +
        '7C4FFF596F78C34A7DE26EEF4A8B32AB4071B7AA8A2C4DD8F36F607620E11C3228DE409609790E0F6D903F912466794056855D6ED821F3253B927845160FC1AB' +
        '92BDB81EE23C06C458382F49A2863EDA395820F79388D3B4D534EAABE1B0A46D787194EE2A54EEB6E2E8CA6B661A7D6A965A8DF366E6909027295ACB2B83B072' +
        '4FE14DFAD12C4CA5C9438CEDBE5D5E174FC8E4BB25FE88F81AF8913310080759B4BD821517C79483117224417DD3907746A2C17778F698AB6C1B64AC289EA8CA' +
        '71B8C94736617393B2E7DBE7DEBB84DE4734AF82B5A9630E15F5318FBF0DB271E95AAFC4E4FC7CB36656937A5AD8566C5E5FF7DCBB8F5635305C614945B7C341' +
        'B83E453B13DD9876574962F45EE7B4DDB56ED7C1A07F87311E1FBF71203677B13EC39E43FC291E2C2F87625A0F6D0040DA9FAB51B77CC5E5CB0E0C8BAC06C00C' +
        'BF201D4BC30724B4BDB1E6640D6A814EF70F5FF374B6C2D2782EADE0729398B9637C153F864B122DB60DFD8CB736ABE1588594B0A8AD99496FCECB8D2053C733' +
        'CDF371C1C986EB84760A9CEC7CE1433260226D3A21E2CBEA8F08962F55BF6191B6002FDF06EB4BD9579DF3CBB456F74F57A3EF2B14FBD835F69AF32147D014E6' +
        'ADCDB388F98DB798C31C5579265FB3F71393FD09AA925764AB736F885DAFE972197E6884E25F9A3776EF396241F0514A1E998F297DC6B29C36796783CF5D5E6C' +
        'F6D90864D7F434542F54FE1948F8AB6C99E908E86B698C700B7E177F0068C7F0C7F1A98E57290E1C8AADA892F1AED1AC0D9B6C017552C0B8E49E184F070289C1' +
        '5F340BC3773B105292E3309CFD40141AB3033769DB7E12F079E151DE49B7CA6B4FE4612C9B41D6A454551B7D13C04438AE37F60420CB5EBD097CB15167BA3094' +
        '2E7DBFC0A82E9D6F1295F960495E6DFB74E98F5F45E5A1EAA6D125E9234581FFB3C1920AB284727290D3483D83671842CF66D7A38B219F018E4467B162CE8A6B' +
        '7F69AB45A6F8C307072A00FB4D2976875F1D0107ECD86C85177DDD113259324F5FF27A2B5E0AC9FD067BAF55FA08FB6B93DF17B88E2563C980712EE7F63FAC50' +
        'B4F8924222EE63C139F445E9D33B6DD5BDA5D0142A741CE1708A6C2740061A68060000D0F49DD76F804C74321C2F56FFE03037F605E7E5FB5E0E376B48BA4F3D' +
        '2C8BB4478E73C18028802C95F658B76F7D0E499C6686D97001880FE48459A545B2DAFE9546C35316541F10D3214302C515E925974E93CFA17F92921F773B5A74' +
        '27E8EAC7BAE681E43970D4D5C3D5413FA5C864224C60FFFC41B32EADE767D7081370D5550563AA124ED25D4B103EC138D46C81C21250B9F111C4A6DEAD9DAC65' +
        '27B4103E9CC77ED81F72CA253798458819DBECAF4AF30DE623204655796BCD80986721D237281EBBF021F926650B45AC153756CCA3728231849C4CA7FAECA146' +
        'D6E27D444F3839C063E631E7384BA53A471E843B174E9A43859495148D3C4053BFB0756B2EF7057E58DD02DAB10F7B5EB63C31F36B538F756FB644FF1ED2692A' +
        'C71DB2D88B5AA8AB83161BAC00ADF5C5499FC5FB2E12FA6C86EFD8A7E7A9A46B6B5BD41455B13C5D6F687F0665B0546988F08B38E92843E2E1AD9BFE26BBB9EB' +
        '2C76A864A54F67983999CC4B72E6D0E0F2288E80B4D753B03632511A07E1449C071E2A8D83034F33D24E2F20E3476F4665AD0356E10C35B0561C377FA76F22A3' +
        '41E2AFD3D1818B8D5AD5F0F6125334AC9F71363364891F7D614496F28D787EA04B8552DBA9C07E29634FAA28160537D60311EB98C648F56EA189A227EC5B01A2' +
        'BEB76611EA32B3CBF4699F62B220E3E1A98E6EB79C29D88FE34CFA9219E6C3E5BC2E1CDBF054C6BCD88A18B2A17F54236B6C550F5EA3BE311D680C00ACF65181' +
        '35A811FFB9CFC327244BD9C4B911249A5CA9A92079AC8725E8D1FBAAD711F6D8E30E84B98452BF9F945C38EDBF07DF232B01AFAC74344DA43C9CEDCB391BD9FB' +
        '287E83581771F57D7B01938A2292E87DB5E43BE865F3BD89597BB0CA186B4C29C92F1F2D04DC2C74018ABB05BD7C202C8D0B2F516420B46B6C59A9BDAD931C90' +
        'CA089CA3480AB09673CAAF259F891BDFE72474CB91346C732E25861134E6F48BB8C68374EEB57BE8BCCFAE197439AF2E8FF98D1365962C023DC34303D9D9E01A' +
        'B1FB09BAA1178AA695BE8EA4F739FA4DDFF5641E068F889A14196F7420FAC99FC57767A602C8900A36F0ADB36037CB377B6FDD09ED9390E05E22762C4EDD6808' +
        '1F4B7577E7F0334F63B4BED96E685D775914D0ECFC0D23EA507AE765F3F65619AADCA58D42E0CC95037907640DAC2B8E48DA9D0CC89DEC45B0F27AAF51B3AC5A' +
        '3415BC871EBB5F8776D4D1C1F35B42063F75770110A5E6BA7B0BE184C448B5082ED3779EA5F1FF9BB54079EE88D76E1082E2D7C68F74E9A288A465352A182DA6' +
        '7E913EAC789140793E37397868773666771FE6C98DF359577A5BAEBB71167719AE42798254225EFA5035746835D5BF170193129E42FD401D26FD3B60F8688953' +
        '4CCC6A7D2E2C53B2A9018CA23E307F743056C0A3FAB30274AF9CF7DED0480D1F9EAFE88367FB6FA03A72C397B1E4371B034A5372BF2733493116A9ABA31D0C07' +
        '7CD2C18BAD054AAB9E48A73E38568A5C155C6DAD1F771DB812549EC13063693D0E4D5B7CB3F5A687647AF720E4A5A631FB43BD6AB0FEC2D628DA3FE44BED46D3' +
        'EA05222473CF3580FC6FF00801EF4024CAB4CC1E3BB7E99C3D68A95DED9251D5A9BFA20F06157F851FE05990191DA64448940608324906DD7A7B852F3D7E1EA9' +
        '8F06C991FD2C84843DCCAC62F3451DF1AD596A89EDA66B2E5F3F13A9F457C46B730591DF0E10609D5CDA991126D017C4A346851A1092826B44B87D642D73B1B2' +
        '20193A5DDE98CDC0E66509466296E4DEC1D168E13743EADFBF938E1C752BA5E17E46B181EB6FF7157BCB42D8372261255F2F62165268FF3AE1C5D6C18383C446' +
        '7A1C5208C734B27586BFA29CB9F1BA0A617B296DA6FBEDC74E3FBAB92C85A5FB6F14602279B6CED8F56ECDB535AF4025F236B2760E419448F875AAB3295D68AB' +
        'A422DEC68E412CA517746FD0351F1A54EEB43E320D3276A2341E550244D4C9DB51F7739EAB8909B11ACA2B60D28925D002A1CCBE30D1130C559F7BD53C216532' +
        '98AE263C1890A88A48615330AE0A71B60F899975F60C008A0FB938F79C50DBE287FC126EE26F1E7126A967649B07F785CD335D469E626F83D48784534B48DFF6' +
        '1146A736F205B0434FC13B1D37386EB806D325BE366EE5533E85E8C730F113EC441342EE4DB088185CB3E01F2D0B35128012CC4E7485DA0BFC18736C68DCE8F3' +
        '4B8A4256BB36B4A6FF8AF774F8DDF108AD45B1D47AF18A681F4D527DC0E26DACA8E468649ACBA7446DF1E8624A29128C73000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000F40199636193F079B309227710B8DD' +
        'FE8DCB126689757A7E64F179DEFC118B5EF9C49F0B819AE37339457AFE21C615E78A2E705B01A90639D05A9965348879B7FA82A3FFF23006D54AD38F78B2BF55' +
        '986CD578CE763D7FD9F6597B5DD784B062F8B7F3A83CDF7E5A1CA525AC2840BDDAB36211222F39AD128230699CF9EAB79A5287F444D887AA844CE08FF3F929EB' +
        'D42E74DAFB99CA1F8C7E8049B2077150C6BBE398DB695EFD0F9A571671BD4BBE06D1E24C4D2332CFC40E7C7839CBEB1A8ABECC01B277E20608070BBC171A9B3B' +
        '8845DEFC30520381CDF82608BDE6FB690A3D61F50A40448A4E8DEDA9DB4D4D6F65EFAEDF532548686CAC9541C15E45D6C763C8EEB71C4E18CD5018B5593CA012' +
        'EB9CE2CC504C0790441382CE2A7FA134BEB4D6861BE3165C79CDCA5BE7997B0309140044B06A89DF52BB4809044F2E97F6406FAC430478CCBFE2912240069065' +
        '04DC5F81808E66A30032FDE3AAC06A1679522B3FA35D862B28AB0DEE23BF13CED214F637B382B18961D2B8BC610A84CABABCA8598047522B237F8DC100F5DE15' +
        '1F3303049AB203F7C0102CAB4D4868C832BEC967D4008210074CA4B0849D5AC537AF300ECC88E1E1AA31685F387907DF2253D63CF88DDCB35365076CF20385AE' +
        'B8AFF7460C5C35E910D65D3F5765177696C8E19766A006EACFE3892FFCFE74BAE9ED697B15E00F939DAFFA7046C5CEEC33077F09F852F5D923ADF91CC9AAF2C5' +
        '25A515F447B998E7BCD18742D6C83DA0409B2C1182800D6111BC12C784DEA256059B71E88C19D9D9AD3181FD5997B4B0272ADCA7BCF2C3265EBBC512745A6A1C' +
        'F4FD8CD8BA3357F8BC1FBC945EF19151C5B5A7506FEE0FA6C97A0F834BF51B82A03A889EA71599B3756C31B867C0E5434E4C9DB72F9AFC94C5A612F7CDF23299' +
        '4BE2E94DD1CEE1B12C3AEEE282E129C53C8A90340BF628A478FA6CFF6FA52A2EEECC9715EF526586A0B6BC8C91A7819F841AC3946E4B19C60A27420CDE5AC16D' +
        '9F98D439AEB49EC60B54E01759F95C65382ABE3E7F01DDC79A1D467129A27BBD5512A2B80FF41497007244A6E5587D44C91F4071A5980C6CA6250FEC8D9A69C0' +
        '90F8647585C8D064BD154D42047DEAE9D3017FA0896F32BF1E3F91EB9CB4E8F9AF5D6D883B6B9308F3CE6DB3B72C9593929B527405F34C84D0CBF70BE0D13DD4' +
        '8FE441E12909A65FC080FC7A79A709799E152F5F036C351D02D9C80D9AEB0A57D3D65F368729A64564F66CC0E2B3465DC5A7464BE68760975F18B59ED7AB2572' +
        '1E76D1B9048839E12BD5D1CFFA6FD3A5B607C0F204D98F0008A21DCA568980CB2B034819FEE393276097E74072AC5F837EB1C7D7A053A610C60805BEAB2A0FB6' +
        'E315FD7815489B64C0198E43A4BB5FC166CBCFDE69F4006E5A97F8359CB8A7857F096A16DC5C1319EDE697D6BDDB228CF1EA3F59AD69517C57E1CA52FB4EE5B2' +
        'DD59196091B82C976D7193AA7FC80BE535D3D2BB00CA65034D8ACADCD5102787CC75848B02790D37228BAC5BB177524DFECC53ACCD5AE5ED4AA58BDF2F993D5E' +
        '2108D84F620F1E53CCBAAF2C74F6D024D769D6D229F533517A05CA32C15C3B9E214FCB5DF0D4FAB711764E8135B14B3F75FF5397D41BB60B3BA830925175FBA5' +
        'C3F08D92517FE1150003BE2236F535679181C8921BDEE370DB1C995C241415B3FC1CF32330C0D793BAC738918D9F96CD3948420B1DB62A8DD5883B4CB9DC8E79' +
        '6DA33076CCC52C187AC9A27D5A76FAEB5BAFCFA5BD94F6926DE3E1C3AEF10B754AF670B043F7464899D1D30CC3F535F85F6F7F00B7EF44E01CF95D8C25F32740' +
        'EA8C83417BD70F4647F989B0964629B68400879E6F3FF33ABB0FE7C53E15B758254B3C104B2B4F3268EADE6940C85C5ABA22AADA7A948864E7235444C8FA368D' +
        '32E346EA9323D871937ADA831EFED59A6F8B7274ADE01246D05C0327B54B79DCCB355317FD9C57D4564AF839D2253DEDF72AEE0CC31FFFE9A05C45D4B91D4DFD' +
        '389B668236931DE03894CE28CF22060755219184CF3CBB9AB403406D03F8F2C465D341377CD601A1A76B8A2C4BB8FA1D020978D1249EE2757ADD72C96F9006EC' +
        'B4C47C0658B40B67C8255AB7083B5C673D608ACBDB4F9BDD436DEBFC2AA17DBF8C608F64A38408E25437482414C618A3D263BCD643B5E32C464A743F6F44A3A4' +
        'DA60D89952695F215607F2AD0D8B07B8070E8D7DE849907FA3164A745730370102F29D92199CBA47075F3EECD485E8CF57F24EB990E213158605DA265F394E6E' +
        '7C7B6EE751D13F8879545D1B934553A8125F4613831AF848E754BB79DD50884DDC74EDDA24F0154B857C260181914EA752A092FA6FB67E999333570F4000B725' +
        '2CC7873E9ED8D7EE1FCEC7CE08484EAE25C82F3738A40D3BBDFDEF25CFA2F9FC53A523F13A4C9519FA3BCFE56BE101ACB191C96457A80F9F08C8F48C8D1A02A6' +
        'C41B00CE8D486A24F316DC67A34AF1CE0F9A1DBE8BD55B5698565AF50C032173194AD35EDF203F220DBC5247A1D725D2A6181613750C548C3CE9E3D3E2623134' +
        'FFCC5724F8AA64689F2102393BEE5CB5BBD1B908BA7063CDCD967A7DC3F9C31D7E17DFFFFEE71862F142BED04A528E0E9390B7AAD1A7C3D3BBD5F12424314D46' +
        'F01863FEDC3B75A18A7161D79D4F116EA3FB0B70F2C2BCC3B6703FF0CB08A6BC0F3F606DC3E1AB2705877347A2D027F0B214999E5CC6A644C51690458978D10A' +
        'B5717BBF2132FCBAB8905D1EC8B34B62159C564DE5D28C027850F0174E241ACD33D1804395E07A5757FB445E05EDC264B79F07447CF313DD8A321D84B188C389' +
        '3018714CB40557C3C84F2EAD0A5F87043092CD122F5D4104693C9890E796E216206292131542D191E8005FDA43051C79F34854FB89CEA19CB7DBDB12D9F9C359' +
        'AA3DCC5D4272685C5BD209F9AAB0C2572CAD9672D51DDE564D613BDA13C871270EB9496CD1B0076D7C2E30C8C549B3B88462373745BB50F8221A8647E88FD1FD' +
        'E80243467BC70AAE73AF2DB9B117FA7853E27FE9CB82F0211C40A5B72E081E9264713C30DC6C688AE195366DD374B6ED8D70EE5B046DA7AB7D97F34CF1F85EAE' +
        'EC776CA6A8A62CF35DBFAC1E8F196041CB0D820C52014FD6ACA24F995EC7778C73A4D72B2E7D844A52AB741492BD75793F9D01896D9E33CFB8ABA9643CF7CE2B' +
        '00DFB47E2C5815295DBC82A0506C7B14B3C4CAE660E4972F167D77DC190AAC4D411DBDE84CD6BD84D5747BA7162E25468EF8347D14BC75897BFCA88C1669CD9E' +
        'E6D7EB545F3C21FC1BFAC0F6C5C23F09EB845C979A2E80E43B00EF8A730FF1A22D3D11DD05FF6B5DAC2476DAB771F0845C0D9378BEF96DB19725660994E48C3D' +
        '701003E64B6951EB249567FA423AA323D80B14B4758721F77E9ACA225BDEB4AE0A2768B572874BAFAD5FA254EEFA4A8BF97EA1386CF225BA009595A81E2EFDBD' +
        '828F4FEBF445979CFCB5ED2510A284D9C6FA5A8EA42770C01208A3D103E8090309CC2B0D0C4711C622E2035C7BCEBA1328B326E0D2E5EAA5627912D1D09B341A' +
        '615521AD73018D5E3E278D38D5FAE9450DC71A877A04BCD0F7E5AF9680BFE3D995BD91803D892A44D1881A47176CAF03309D5FE6306161B633344BCE1E5A8980' +
        '0AFDF63BC1BE3A1EF697AF8F8219B2BD1E8EC6EE12F60E8A33FEC89FBAF294440FE12EDD9AEB4B55EA494D5128FED3B8F43D832A00A1EAA156415AD160956397' +
        'F64EF513E87B9C55AE25221781C146739BCE62E1360A2B6860A80CDB153022BD3859AECC7C5AF87CE3D6D6E8E12DB23986621E4DD6A3B5855E2CC1021FB896FB' +
        'F93045CAECA903BC4CC9562C668F27E0B8C80433BA4600EB8D3EBB9D1EE90702FB685AB9B3B3842F2DC0EE9A3EEB92F3E91AB22F0A49830ED82343EA95F1D59F' +
        '18B2D844313BCE5F71858CAC6C008DB3E26BEEDD28E028180B9B3B5DD80FF0FED676ED9E322641F228A56F76CC858A11875CBC3479403B7F31F972D3715A05F1' +
        'BF1502611F80310E8E0A59F06BB74A4E676A184C3057BE7F54E1CB779F000C21EDC2DB81DA728B2EF824A91582C1D7907034269E178BCF31C3282A4DEE1C5108' +
        '8BD41FC4019F03ADAD8C1B47E1862C5E3794B503EC38286118DBA78E0070D284C64AF185DBCD0DCED601AA32D2CCBB639C5BF6479A8D1E0BDEF091D170B8A234' +
        '1F1998AC30B49F4A2A6FDBE90E88597DF204D061183341498B672BCCF07C73C4ACC10EA96C39C0B0B7A90B955AE5767C237FF307AC6BD5A32BC563D9813A51AB' +
        'D7E8538BADC633A1915A13E3D5E7721DC8136A9D730CFCD7EACB5E370F6F35A61D7F2892FD2FA3121ED850FA8AAF05EDCEA226FC48810F5C2586578FA43BEF78' +
        '9CA88FB4DE8F4F0FDBCDFA8005CC106F151DE7D0D34125C3CCFC74A56D31C131B759B715497784B4EB88F2B1C44AF08725B6EC183F3A6F667B45C22FA419876E' +
        'F223E2E050FA28002DEA642A2EB7961BC2865DD78211FF60E952D2AA7EC802B29A9D13B50AE188F6905AB6D9485D05784D0ED2FADD07483EC0BCB2C7AB64D2E8' +
        '929D25FD3E4B9C14AAA53D308AE6B9D48016ACF2F8E3F44F4316A5A950C8F72740'
    },
    {
      set: 'CROSS-RSDPG-128-small', file: 'PQCsignKAT_54_8960.rsp', count: 1,
      keygen: true,
      sk: '0F238A0238DC0FE23D24E60E8DD9434B08ADFF5A312E9FF8261FE26983A0C4DF',
      pk: '59082419DC5CEEC427AF8C1959E0DC5F86E6A04EF445A2AAB07DF0E5640FA592AE2E9B4DCE0C59E23D4EA36130C8CCC326BA2E290800',
      msg: '225D5CE2CEAC61930A07503FB59F7C2F936A3E075481DA3CA299A80F8C5DF9223A073E7B90E02EBF98CA2227EBA38C1AB2568209E46DBA961869C6F83983B17D' +
        'CD49',
      sm: '225D5CE2CEAC61930A07503FB59F7C2F936A3E075481DA3CA299A80F8C5DF9223A073E7B90E02EBF98CA2227EBA38C1AB2568209E46DBA961869C6F83983B17D' +
        'CD49D354487E60CDC663323D39874526ACABA29B8BFB86C2F121ACB17057C18BB44DB0DFBCE3CCD339635C219C822F48F08A2809FF3819DAEB80751CD765F102' +
        'AD32AA589C195EAF39EA53D6FB99D5746182110A0BA18EE09F8134C59C08B07CC5A6B46A1543204BBBA25FF0D810FF3D3E827694EF51DCE84CC3BCCCA51424CE' +
        '42120913AD8CCF4C8D65822B2979656C011B1D19E99A2EBC71FF25B2404AB0BE46120461E138743A79E65CF44E7F42C6DA72E00B5E1E8F48E86D2CDD9BC79839' +
        'F9D67354AA59CCFAE5CBBC61A9C05CD6CD4E972D0DF0000D941C6E41216DAD8552721914A081A65919F9C10F5A3463F3FAA0D856A80F5A6F5690817F542DCD32' +
        'CAC443C59AF1FB18B9B2E5CA95F3B6FF26F8E3D8E3025B1766EB3DF33E5E8231802A098FFE9158100F70013A1FDA4AE3C238964DDEBEABB14B9784D894766078' +
        '4275C7AEC0EBA1B7FBE693A1998D7A432C93F4FA52FB35FB0DA0472E466A731C8187A806D78C0F6E362E51DFB4420D11BD058B22612D02B0DF306F1D07AF28D7' +
        '280CB4AED4432F00DBD6CB45F808623121CE83EB0985386ED80FBBE3B3E91A7CACFB6E64C7BBEC52D14AF437FE0C896523D08C436D1E3DBC1415FE220B621930' +
        '4E9075CDCA9D9A7CA93BCD10B70251264223EDD6338FAA89753848327B82200413708DD067F502BB542EFA82D4D3742D85AF9C33B91CBF2F759696A3637FE49C' +
        '87A7C4E6FE0340EDA0BE14A4C702C66B8FA2883ABF7F16FFBB548AAE901977FEF67A66AE52A8B836AD20A639D07D5FB791A0561C6232DB422334B14539652CF9' +
        '34B18DEE5E68D1AA5932C09FF672141DBA2B5E040ECDEC30B53F6101B81A41BF9D47643CB8CD475C01DB795558419256028F19CD1A2A1AC766EC03E40C4C4752' +
        'B2BA9C419B9E1C42CAFE84646B375B1F0838C1A971F848B5D07589BBF3A8C0863E5058219F5308608B9DA7FE3767F65427D1752D8A12C3CF1BDF9E2ED06468B3' +
        'FA4EC2126FB197F1A4AB566DE0F0B3AD8731CCAED5E528724A2E1A57AA0A352C3FCF0B7261BCB8EFC9C8F07FCE2001A734361E983FC7ABD91693DB174BEB24F7' +
        '0E29252E64AD3CEF01C119511894B06A47EC0B6488F07FD192AB4CEA0522420696A8F1CA0B676A17026419F929EDCCEB858010D9CAADB9B0698DD2015AFE9153' +
        '949DD31DD87DDBABC9754455C4D8D59C143956AB7316968B4E095CE10E3BEB24154B8D921F73ED3BFB08300B905750CC12E12A76DE0A8E6481C7F3E4716B4B9E' +
        '4A75C456BA4ED0D2A37423C41262CE95EAE22F8BEFF6BF3EA84FB33820D59E1ECC631717F4C5227CD107C3EB2C7425B633D2A87733FDF53FFD00E3F8740C003C' +
        '8C3767E9977F7B468F6368D4F8DAABE324155884CEECB9620D802B8BEEBDDFBC7CE4382ED766B8A5A8D49EF50264A3554869E75907109F1ED4C6B5CCDB1D8A89' +
        '7F616552CD96C79BE85E8B898E87E00C0F9F28064DB502C43B089DB9EB9FD449635CCE900AD70FA786B3E1B5E49811639D95464DA53CC96950F9F289A8CC9807' +
        '9D4BFB12D8153700451CF3C5E33D64DE8FC25EFAB7BB6B2DD16A9E558E39FE431DC96A4E74843826D6C5CB5179A4B8FAA8885EEA23EA3A33AF989FAA519E8037' +
        'D4DC751D27A4ED5A01AD8A669CFDE6F1D20BBF5EBF7BB8A9DD934145153D8C2F899EB1ED288853F83E45143B6BC65DC767D984FE10936DA27B863666BEB6D202' +
        '5F07F5AAC8B8B3DD86F64EBDD065FCD24914A0EE27FE63E4DF342C81EB49B016449E85E880DFA0D20519383E355DAF27939C6697C090C2E928795D29775BCF78' +
        'B831034AAD89D37FA8513C526AC3892078B580026FA836DF88D304CFC6D07552093B67711683BB2E5EB7C8F2ECCA53AFD2DA625E9E813216CF4DE2C529448285' +
        '9A29A956E892FA93200BDE6CAC8D95A5E5B7A735BDEE84732224D671682BE89C19FDD063D0868B1126A653DBEAB3710FE5F49CD6540DA8CB786F78F7E77DAFBA' +
        'AF9B85A080FBADD4DA82337DE0ADC42C187AB6EDFF44BB9C77B0C3CEE14430353F15878E45DBD7599C4BABAED5C26E85F553137DE587752CA08A41F0B5390F71' +
        '5FD5EC5F9B0D9A54042F0E9A5756D1D8E62418CD8F5CFE0ACFD6C804142E9681FAFA6E5DFBDA9E549897739266DF9F7C66235987DAAA8B63B806E67608326355' +
        '3E17078FABCD8BC7DFEF2939090411AF9F1B090BB3E08FE75EF0E219A71998FCE4651C8C7314665709A6CAF1F0BC27DADEFDD4D3FDA919D98C3C907D00219554' +
        'D4EB5EC6BD75EA97143FF6EB6EBD5EBA0F9FF4069CA536C70CA61E69548DDED305BF25E5827C61219C062D09363FC6DB3263E435269B4F943B527E6D51061CA5' +
        'B2E21EB1E7868A50116DB180C8797950A02B4B88BF3CC11201EAAC116A5B29C58EE41537E81D0CFDFCEEB2DE50D4EDC791E5AE241EEEE320EECA5386EF55D6D0' +
        '345D39B4B0D86F6A198D44474A3462B2E7F592E18BC922A5ED270703006BA3DE83634BCC0A0C4CF222EBFA7C42CCB24C2BEBB987E7D8A655C879268D4177BC4D' +
        '78193C415072097916305097C1EF7A8E5EF31DB31D27BF0E85786ACF79E4EE478C092736F11EDEA9658BDD8B8BA89F31FC98D780813B2A4704972F9F3676FD85' +
        'B91C0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000017B2F70DD10F91CC800B51A2B066' +
        '015130CDCC2C65CC3422BAB4D73FB976744E022A4B125805C4780493BCF04E43B3E60DCC7366F338CAACA1AD44AE6CA4445E28BD684BAC90C3BF7144FDF211C8' +
        'F03355506834BD8A43A74059957427F583578F2EEB0BBBDA24669726489102B0EB3C650B794E4F9901F06C7B0BEE5581EF8BF8C291F4D6DF2587224F5B5B5359' +
        'FF0B95ABD58CCBD0BB2ABF5C3824A5159EFED6D600F49C2A5134AF3466135B8AD16FA33312919F6445DB258B6B6FF74E374DC3960855A2EBD94465F243CC5155' +
        '225BA5107C9227415C680E1FE252A2DA789617171819628B944244B5C94C1CC3FE38A59011821912DA76AEE1B0D4F2A9C2864DB7B0BD643E6F44BA584C9C4E5A' +
        '8EC6F1BA1F5DA32169B7FC034A5A2AF7BF290D53CD35AF1683AB505BCC4219EC6012E381D5E75BEE725D0F579260409825C7E53A40FE7CBB6D31F0741DE3D1B1' +
        '9B7EA7BFFA1765FE604FF5ADC0F7BA04F790CD789D48C183697C10E8A62E9A956A18AF2B78C0C07BA5F5F0A7E6C4BA343BBD8E74090214796E17C7BAE955CAE2' +
        '59F125D4624893F2100514E63F8F859EBD6233619632F09CD5073A8E8B70C4E9D6D6E7DD3B1F24FAC6DC74820D27896FFA346861539A5EA804D751C45463CB51' +
        'B23E48BED12ADACACBC8E43333837463FF4114371B28ACB3FDCE10281A168BF289FFC43C1675A4F6FB2EB59FD42730B2137749956C2FC5F03E6B77E55DCE8592' +
        '6DC885622288D77DC3E60780CB90D5B35764921F12A02E3136B4D2208F2D4D5BE5E569B76D81FC137A7E2EE77228E377B210E9632E7374C8E494364AA0B3F31E' +
        'A80ADB7EDA4F20603B7F92355A037433C55A10651772C64ED7B48A81733A10078DAD61B27FF944B686FBF7580E2690470B1716A349BEA03FB8F71FFE181A13FF' +
        '17C4EB7EF0D446CAD489CC3E49F20FC826881FE26D5A754F8FE7DA44FD21B8938D9EBF60B14513C748F02FF38E17BB6F3436EF634C5AACC32FAAD299CCB63D07' +
        'D160E801C58C81ED3E5B85738AD9F87FD066111AEA1460AE7CCCC5AE2298E9CB3CE96EF733564091EBC2D2DA69D2EC1A1F0BA759680A7391CF55DF4847CD29AE' +
        'CCCA3D2056FB039F03AF65E201E1D7390A8F0C2955ADB5DC040DB29D4DA58156A1B657A98E4E5880605D859B71829384561A78A2930685FCF7AC27D81820DB3A' +
        '693F741FC8F971D94C80A527DA6E5E83201A486CD8089ACA26236BC22A29FECAF1629FACA45AB7C1D12B53809E49E0919504D60E2CD9930083F9801A58D576A9' +
        '8C844A0759DF86C27DA276C5174CC6A7CBC8CF0E3CA1B0CBEF5700312414565120D07273A84ABFA64D708AADA805708FC60297F5F954A1814EF3814B16063E4B' +
        '615C675E61E58573003A04AB7B6106E8EBF406DA2E979BC61836350CEA401FCCD3AEE59F572C763C5F5FB3D656054611C82D35C07CB138CEEA7411A57E52321F' +
        '1093C3985870160E3617B4657BB7E0CE7FA2449424B29D0FAF5BABEB88481B52C41F32265073EBD7BFDF9878AB8E7A1BFCE6212B5C287ABB8903F86FD8A8F31B' +
        'B73A4FE7C98C82A9C8EB6B108B0D581F4783B3A121EF3343CDB0F312069840306F7A4ACEA967E972F675962D64F536F61B16141E86BAB3F2321975F859139AB4' +
        '966CC433A21098735D2D452E0330693E26BF7ED462A9FB45D638CFA481CA187A52D9C7312F45E2A99A1BC70F844B2BD4397E4C8CC69BF8C298AF72FC4DDA2505' +
        'F4FD7050D69EA58802B565DB978843DD833408D4608EEFF2889A36BE6A219D8AC507664589536FF163F306C686128DB9764BEBA578490050F0328BF52169A7EA' +
        '7F4CC95D15732BEFC0A9CE0BEDE5788567CE51B2D7BF3ABC8631F6D3BF4BA2DD36798766B155F166EF0D5466F9B6F7A0E34522787581A1B2C8EDCC5E9795DEC1' +
        'B6453EA0DC3E4FAFA3E746CE58F67C3726442751730E52F7D82BD90B593C5E48155DD0F9B3C9DFCADFB7071399A32C7D3CA6E52AC3CBDF2E62052A3C49662929' +
        'A7FBF210A65CEFABC833B1A192316EC424DC18878EF90E854471871AA13B2F1CF44B9CC0E1642C8438B317ED0F3FB627E5F24943CD0B1B850F699FBAA8D5AFEE' +
        '027A706C32365EE9E33FA058407EAF0169132B7B5BAC09F4D1015B980FB6BAE348B98677B6C57032203F0D1E285746EFE8515AFF37212BF58C800C0E9AB583D7' +
        '92B80E9E9F83C9168044666D554869952D52F47E3EEFF1FB57EBA4238F9E281FDC8B0F055DA0CAC631D6567E5546934B848104A395D8A0B9D089C2B659A104A0' +
        'D6CA195538AB68F647DE66710205D411DD220C0E4C204EBF14599252BB835A82005A3FF147A5634ABA78D354EEE946702840B55633843CA3B4EB2D6BBDAD344E' +
        'FED8607F74EDA28BB4F980208AB1338BA3DCE12395E909D9A36A2960A08BA0D48BF40FD3D34B635D569715EF6CEC70CEA0F2DE7DB3751ACAA40DBC33C591C4DE' +
        '9F10AD95C68F79BF44A24D327E4AC18715A6E936CD2F5151A05434947413588D77436E8AE4895C33AAF2CE8893E4C1B793512E445EF426F16CAFE873E304771D' +
        '663A608B04A35DD25DA2F67FF3666C1C35C527C8105595B32178D05C880A40B9E36CD5720BF183C7B6ACEF6BCB694243666F753B0E307497D7F03B170F8F9EDF' +
        'D79CD323E1440EEC264FB0F9D4EBA859C540A99BDE55E9B8E9541ED37C0B19D58A764CDBF2A210DF23D31A781554294DB33E9F07BE68197E026B507DCF398A44' +
        '99B26634AB62DF2B7654234A51E33A5FEBAD75D5F72E1E12AE167822771DE6CFFD7BD93CFF79B79ED7D4E8BA6479D02A6A51B4E7722971FF42388C3DDEC0EF8F' +
        '23D13C40E5EE255F94D5A6CB49F4B8A3D117612242D64FC5F5E8AB8D0EF7E491ED5D3EF6E5FA26DAAC3ED0D4C70DF439C2665BA0EB72D9B5482851F157AEAAB3' +
        'DE7E15DC617DE374DDF8F8F959A3A79897CAB78805166601B97638813436D97F1DE66D2DC1D7DB068718BF52F305991973E0F635A92C30D6FFDE6C6F15BE897D' +
        '114748388A49418B9351255D3823F6238DECC960AC6C5DD283B016839BA71530F8A330DEBD8F77417FFAED58A41EAB156E9E36B80299F8DD9CCEEBF991C1947C' +
        '4527EBBC629A6D965592B23D1646ED7CA8B7B46D4984512B9EF3B9AE2733A2F5DB97A4AD6F0F8F21B7F86AE832A7100EFA94E6F0B38C98F3C600984986164584' +
        '9B5EF716D85F2EFE49E0523FD5F3FE2121A7E3AAB7849C0BABD6B3DA94E530FF35812F8B0F97A6FE8DC5BBA1DFF712DDBC369273CBE26A20B478127F39CE10B3' +
        '5D61DF89CD95EFBAD0AC6DF71F808366DB0921B4182A67FB8C36FAB2CE69A0B4EE82B03BF530AE044E781C475D3630610DC55470BCA0F3511A881E3A147363C1' +
        '60457DECF51E508D1C866031E6F9F4FAF12F6E7EBE2CFA12D7D92D0B32A8D5479066152C9BB298E188D3698F77F16E5385875C83F23319E69959EC4E9989BEA0' +
        '609469BBC345A65892A425277A2CB792F1A2448B2D22B18487CC647C71503920578B1BED5C20BD094273C5D0D8609111E2654264FDE983D3044D2D95A84EF6FC' +
        '2FA265F238093177822BBDED445F884B8A1FB850301B729C88EBF2027DB8D60C11C3D5E0E1F4E9B512992D1C78110FD85D0A43576CD0136A16B4AE1683B2DC8B' +
        'F6427DE02915CB12DFF82C435B73EF0BD49D014617D9EE818CD05129E1A1FE59B98F12D7C8AD3BA0D70739D41F58E85F2F4482ACA7BD50DDCB05EDD2574323FA' +
        '7DB9D0098296B0B66B98DCF9D9C4C3E8B1A15602D93CD54989854CFEF13CC51C73225A9A3B7E05631295BB0804E2FF80C558405466BD889D14E1C6EE640226AD' +
        '54B57DBCF4EE27690D9E80127DE0EA77C81A22332719E031C3A56C18C7FE0A652E92022FBFEC14B40F5C9CD4C68D95FC4FD357BCD38E864A557D4363F59528D9' +
        'FD6E05E536DB91AC8CFA743F1CC17BCDC1D4C98DDC1FAA053894D592EBCAED322D3352A3013AAA85AFBBAB24C300ED5A7D8FA84A72681651BFA619B0145C52F4' +
        '9B4EAE5AFAB3856AD8BA2A9F426E4EDCD57FEEBC52AE2A54F80FC8D11F34E3C65D2A2BE02AA4BE9F4BED487E5580C16DC73CD2970B95095EF7D6ED8ACB015AB1' +
        '22875F82EBE77E37E56BA0F8DBBA95EBBAE7CAB529EE18CBF3FF24BE0ECBB39DC4E5093D9E2FACAB11B89E41BF1CAE151F9FA6F39F3866DC7966E840A9E22494' +
        '4ECCD7E78DF4CE4B7F7995D396B97D3831095C84261539CD364D5B904CCDD14B8AFEE565170129E383344B7239F8E5EF468D49D018DF3B2ABDD00EF985230968' +
        'E6D498B8C8FBAD80D1EF4B5E84BD59245104D8FDBDA69B81B0AC1A28309476A45D9928C329D126D4068350803872761B600C2C78F3790FF2B525B4BC1D4F79AF' +
        '7FB36E1FAFD82FEFD0AC0D94BCF5394751E882E44EC2691CE8783817B1EE6A41C78BD55D1C40734FB6947A0B99000AC6E712165F9782E3DB8B609F4B506C0273' +
        '288FD8B6B899E3CA71CA29D4ADF9BF0EFBE9CAB5FD3EF8C5BFE9FFC667F75A4812C401DCFEF52ED41684F17E847077D9134954708C7E674DCDD88C1F2F652567' +
        '63B30404E4139069B5B77A7B1A6F74E89C172DE820A32B9E235B1FFE5FC0EBFFE1F870C50072275AE69E1D8062414024715B28D45BAC7D189562EB89592983F3' +
        '594E3C1F263E819539EFA663D011E36486AAB69D8D4429E99B10046A01FC2DE3B63E2DD72BD31ACCCAF324B8867B957A35DA060386C57C0F461F15DC9DCBC42B' +
        '8CBEF5AE83A8A140DA4956C69B2098C1FF68F6A7F1C3A538CB36054AE7299EF8CDE8002C2BC8F24CBA318B6C9D13CAB23683D76C0A1C603768A9EAC1E9F6508E' +
        'CCF0DFA197EF9763A6CFC6019AFF6509B91EC6BAA17CF8183F8FBCF3B4DD2AB4FCBD701390872065A463F87EFFC5A61578E617D3FFB7B4FDDC69E52684CA96CD' +
        '2BC5CB0B2913AD637FB322E9D5015A4B7D4E519852837C02F7AB723D6A70DD2098E652E4F80566A427521881F007DD2C7E600000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000024F5CDB306C35725B7FCCEA1D4C916D8E8F6CA85C2490601F8E61F6F542E43279DEE24CE032A5E9855A80107CFFA' +
        '36DEE243FDBE74F72C9DF337C7F6E2D20E1F7FE5D3F77F900663C0CAD292A9FA610B9AFB9BFD9934804B534356E708C073F1862E01318E74E962842B1D726690' +
        '85BFC18149168671B207B44873058C13B84160D91923DCDDB93B0B79A7422330FF360DCFBB9FF3DE73CEDB1C023D73DBD8FBC0D37F463F97110A468A7AEE48B4' +
        '5410BFF31F9C2407C6129634F6A68FB2CBEB6AE58E68AD7A6AEB6443CBD06C71EC22F4C6FA2ABB97F1225DDCFF81627462BC1CC66599DA2B83D5CEEAFFADB295' +
        '97D08393C27E2E4CE3FFD8C4C65CC446416FF7AA1BFAEFFF0D8683CE77A2BCB80DB238BE2B68BB70AD22B217886E04ECC531544F197759B4822AC97AF2AA6580' +
        'D8DED8B915FC3CB0D3F5964BE6DA77324B3D6CC4F32A526A160E45ADD17C8C5BA1834C8460B2514CB76B451E7CDACA52A32A6791E792C2EC35F6619F6586B875' +
        '6B748717DD7EBAE36F9D5D657054620BBEEBB4D445DC20636D5306023A3F56042264669970A81001CE548BFD32188D685930CC7ABB0A2D9334939D602E5B1ACB' +
        '0EB3B4ACEFB35BFDBDBCD32E96C86E6EADDA0B3E5F2DC376DF73B06C8C6324C0282132AA3032823B8EE4EC6D3E3B7AC2BFDB6422CDA61A6491985AEE2FBA48A7' +
        'B1B38269FAC72590BD941A77F76C205E6F33F40DA40B5CEC020F007AE489B3B6317EAA4F5C064CC872645DD9F0F987936B7C2C142E8E6BD5B2B32D0DC2DF4BC9' +
        '22666A607DDD12948DA7C469F5D8C84B9F254B882B29A3E1088E2F93CBF7ACE3BF4F4688A8F77B000DBD11AA8FC008089212AC5C10196F99839CF6A877FDDAEB' +
        'BCF10A0E20AA9945EB399DB73C706EA7D236547D88ED114824FA1301614419D6DBC2035E45998355D8832430CA56CBCFA0731495CD5B6C2975BFB36A12466478' +
        '3C353106BC61EF499E7EECBF82E3ACC1063E632E09370659067BE172B03E4399A27CD4F0F78DBB86845AB72AB550C2C6C3405B71CFBA372821BBBC72999ECF58' +
        '4CBAB3250A5A887BE7934D0650204E8C7B8A225475B4FFB5448BE343826B1A818EC71E23B91D3B2F7DB4B62C55159E104F395BC8314A070E222741F190DB8E04' +
        '5DF12E8B2E502A6C9D5C755D2C25BDEC4E05FB3BC7ACE88246EFD21D88208009BB8DAD3F076C93D4F57402C23F08894BE889FCE3CAB39015F3C16E16FDB89B74' +
        'DAD2BECBDAF098DAC017BDE300C2BAAE8B807443F202B942B2CD3C2280A600B98D1704555F32DBB97939C970B7564DE117BF7EF3F5DAC074ED02847BDE3101EF' +
        '74128E95DED2059486DDFE14C69F4970E018F663D11E19DA6801C9512CA9CC69DCD9AE5301783E4C0D7C9D40418D70E1D370C5970DAB4A177D259E34C6AC9D32' +
        '40571699EA9D778983F30DCCE52E02803A4DF5BA2B45454C5FC0105DCBBD0C1057A03B1E411D01E426099279D8DA3681D96269C8284A992397076C69ECF5F717' +
        'C5814DDD3AB8A622E2CB4ED15547DFB9FF1B936429E7F7D9CFB3F0E4C02B6FD00B8FFBF655B11C60D2D7FB2EA8DA75DF397EDDF43BA5C729F7467A152BA08DB4' +
        '13A742AA5A7E9C42793A44249E784300BD3B2B232891C5FCD4643F63417532ED7738BE27789A02DBEF99E2FB086AE351BE754486BACA63D4D3435E2266C3BFBE' +
        'AE26EFBF78BDB721DA2AAA06D1F74C0A30B0243FF214CBB516DE75B40057CBD1471F31D181B15CE01717EA29141C34ABD68183CB3B1596127D4B66304462DE71' +
        '95793D019F1D49A25D1C9D13EACA9464BABD9907B82495174FD51DA91BFBF969E908A422BDDDBBAB3D0C2812367A7A0CD9BA286962034E0AEAF323406B4F02D1' +
        'D1183F3BEB4AC2AFC8912F4EC9DAC1809F507186AF3DF4563DF3EEF8E3BF9BDF846ABA492CF4F0080E779186D977BBD251A8F0446F70D8CF6DD12374A1C5FF42' +
        '341EC0A6F70B4759255019BEA4B34CE2E30B8270377DA30C90012ED7F0F43ECA717DCB7D44F1A79A8FFD6F14D909A77DC5489ABAC899F3AB0E84697C093865DA' +
        '5F588264128BC340D184C21BF28A0D05DF107BDCDE6D0D4686DAD67B6F3E0FDF129B97AD809F804F196B9830E5912506D1A679F61268F4E0E9535D01E0F93D89' +
        '294F0E1D15824DA49F036500E906A20CCD7A863068BE26994DE3EF1A09CA595FDC6E69482A06321770C4C8D56B5AAC45164C25EA9C366E3DA4994104E1044906' +
        '35004BED54AC83A70E6D0E43C59254D2E579EC89A3D7229879CF8DFCFAC202971A807C0945BECE7BC3C80FDDF8A94A2A20AFC241E14C7587E49A1F026417DEA7' +
        '6769623B944A9A3AACFBD55A525B0BCB34012503A6924EF243F322D70F3217C24ECABBDF0E741C6B7D320BD57AB3D3251DC43B16BBB879007CB692696A5D3494' +
        'A166E734A831CCED9781B7525926CAD5B6A54CC5574DD3C6A927FDECED6B090EA38499017D2DB7859A8B84651521B0618AAFFA2E26D4A42CFE650338DDB653C2' +
        '7311651BEEAB594090F108B845142A02AF42B054A6A5953F9DDDC3CA07D03916726501B4CDF4689F964BB3320F64CFEF4D828832FE8104D0AC2ED8F85ADDACD2' +
        '626F52EC27F9FD163DF4F1220FF4892286897F4BA18B4FB1FBC9FD4FF4DC4D4D1932AFD9845D3183EB98393AB85A5E7A8978782EB66D98BDE721CA85E8935E16' +
        '076DA4692B04299A39907CA0D18FEE07581EF2125639499F99B553A0D585296FF326A20D84EB32326CE3A8E6DE1AB3DB0272589B56FE9300043F11F81A42390B' +
        'A111A1452FE9FC22F25D89CF2A224A791004E2378E3550B71B11F8B6ED95D463D6E5F503A30CF63581AA4FB817EE2C0089F3A3C5D5F1CF51018C66C2D3E4A116' +
        '5B92C0DB265D866A46C32F10F37A838BBB68474B6B1AAC7A5AE2DB4811AFAEF4839F80D437D9CDB79902D206681CFCD0250264D1153067A9AE2F92863146094F' +
        '4DB4BB5FD0A1920AA022BCEC9D36B4BEED9507B640AA23545A43D567B7938639143BD6A9007E751D595ED00D4F09867C4A83FEC16BF2EE0DE5D4B483F83A6EF7' +
        'E8136E8C5FC0BD035591C1592FA1783FA337AE0C5785DCECE16A1BBE98C442F9978539A82321F89CF577D3DF954A16086B63B4A09F7527CFC7157748CE3E6737' +
        '9F02875D8E21DC73501913264B96A651864AF5AA8569EE2DA27B6FF37CE12ECA8C130ACE3046F998329EF137BB722E404FE0BC69A9D634105FD25F405CA29A02' +
        '7021F5FCD7B8EACD714E57638E94A2345A1796D80FAE8B143CC44182E5BD03FB4C762C265367D9F21BFB9EF910F15188647A25E1BD3BDB2E8A8BC7D28B0C027F' +
        '2F0E982AB1235E44B45BF01D97CD69975CAE6F828BE9E474A1306EB321D95EE12D88365741E7BC4615E40DD518D3DDD85BABDD956D58745BAA13D8D02C766F69' +
        'D5CF8EF072EC9877F2F962F575E2F15D2A87C30F09FDE6E385AE81F3DB4595CEA8A17C4FD6F0DDC1A036504685B76BB740B60A1394A1B3130EE4917F1F7D0D7B' +
        '46893ABFF441C9728D514F75E2438341D89DBF496F64DC36AA50963D354F3B91D5E43A1920B28528584A981C2E16BDF6B9D53CAD946B68D31A3E5763294318D2' +
        '037C3BC1EEE3F589E1AFD224D5D16014A9EE45161B5ADA39D5B6DBE3C285DF13EF1DCF5633C7A40DE5CC1E53B54C263DF6790B8D0432595FC1D3929A8C7024A1' +
        '796C0536EE9C8663A5F272F95DF8F013094B8A1CF242DF810171A09CF04CD53DF717B1DD8CC89D1E698C4FB428A2EB44F860B1F9CF33B2663C95D7B888BD95C2' +
        '9A2F9EDA3565CC37DD41B977DBE913217E03B9F5895CE268C160D0B108DFF30A4CB0B62376FEB6C3A77196FAD77BB49BCC0CDB7D4CF4A8BB6E2F75EF949D6808' +
        'E5F3A7FE9818AD340119C27DE0E186A84AD8C378F859CB5E9184277B781208BF558D86AEA28251A899D876D7F3950DCB5978239887571C743625E9A7ADFCF27E' +
        'C9AFB29430928F23FD471F7E40883D01B4E5CCB30E3B70D981FBC18CBF0B0C60036F324CF75F772075E43E4F863FBC0ACA0C60A83BFB0DE819E5084919AB1FB2' +
        '153CF9B25B7E480A1DA8B596285F012518336063DE290D296E049460C30FFC16FB94086BB448B55A88148959156746E85129920273B2A1EACCA8D95A06480786' +
        '6936623D5F16095A38502790F0423313C389FF3D0EA3F488171B0B4D48D5CF849EA189963DF1A4F41249F5EE642A8C55EBEFF92B3F3D9AA1F8D92420C927FD57' +
        '8161F0D21E55DD12D21B5E4D3674D2033C6DEBAE1702DF56525D90F1DA848A66EE226D0203AF80B94D5C5614E042928AF5DBA9AC316B18521C32B0A074D7E617' +
        '3BEE44168C185528A00477CC0C4658387A196563D33BFAD9B125C1F74EAF1C6A694C9C0927EF229693C0826631F5B1D2FA1CB869C599D35840D56CC023E45D78' +
        '3EEB466379468D6E0E5CF8A5EA48950B8B32041ED1DDE647A0599E5DA1AB946A63EF0545E44273CE166C2A0E1E3A5A0F80381E89F280929CDB8DC56A52A2D9D3' +
        '0704175E56103DF5C36F70866985822A49B24B19A280014A6A2BB76FB639D9D72F49E753E567000BF4A43A15582713582540BBCCDF57E17A351FB7A556B36A1F' +
        '3C5A'
    },
    {
      set: 'CROSS-RSDPG-256-small', file: 'PQCsignKAT_106_36454.rsp', count: 0,
      sk: '72C91341F2C9C1840BC341B6FA3C0DA7A9002121E041766F921AE42A212330C06CC05EE53E805AE7053205D1F41F9029B5614F11E8517915B4EE048F0699BB2D',
      pk: '5B7E438CFF2C1D097B82DFE5369C0F99E83DAECC0B8FBCF98EBE3F596360B86221B61729BA29310DC32DBA0DB1530FB44B2D36C6FB8A8CA7B7DE0C616AA4BA13' +
        '46D2E1B17649AD3668283D92B6B24E9E670DAEED44D3B4C5573AEAAE2A06E0441FB526D59BC68706721A',
      msg: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8',
      sm: 'D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8B6AC2461A7E8FDAD811D9F4DFFFE26725B179F7BEA3EC399C3168C6307207C' +
        'A350DD0A4D1B69ED4D67903B52E59B8A7FB34D8E03E0BA45E7E3FEC196E5199F28EF251CA86BFAD15E710A874849412EB22931E2B5841F5714C75D09C7114927' +
        '37E89345F50037333F79506AB9D1E8D060D2DE85A50CB0A855449F46D040A11AAD546BA805235916DEE5FDD208FB5AF164FF8C34DAB1FDE16C4794D1F14D8A1C' +
        'C6C81843D5FB496B13962E12B59DD886288B1CE87444F4AFDBDF76D34D1D20D9B0BB958C705553362CD3150F2E05956B21E44E9A92B7FBB336018DC5A9FC4F9B' +
        'B35930753A294E34DF79041E86CBF9FD9E29F47CF5A507C77D067C691E62320B9D2A43D646EDBFB01AAD5F173283C0757ECCC47F78AB7EBE9D9D197D1903FA27' +
        'CDFFD8E6AD17178E233749EEFACD7FC7B0F7E110D6275399F34763FA5E8B38B0D6FB55C2F8359CA1F415BCD3C21F934133E79362E6E8BCE288F49A9969EEDF6F' +
        'AB6EDC169C3D2441C968A9E1C829783C4FBBA9123B05AFF5B1E724A476F42E19BC94EF0002E300B87829AE19883532434F07E08E53DE6452DAF97E2341589394' +
        '3FB0A41E2F09ACF4F840397A59235E07E7C52BEEABF24443975C6EEDB948D28AB67DC24BF431913E71771B243611444299ADBC9065E0F23B89C82474A0405FAE' +
        '7E7FB17AC0384E5A467D1086568A49BA2880693E8A90B977A456FAAFBADDB0D990ADE687CCAA39768C0187709F900B51597B55D763C642D7C4F65267E8D5C24F' +
        '407ACAE6F8A33B5012D022EC01341753B70624B117F2B9493EE762864430D32F3FA5E23D7533A48366F784317B1E8661B48351C532666838E05F71782CDCE167' +
        '726F4F2AC39152F05A39F2F3F59520E1CA7A7B224E9ADD52233EDE262039E02F3D49B89094A59BCF977EAA0FD394FE29A936A4BC6470E009AFA336F8D4704460' +
        '3A049274DB0D347341813D970C97EE01A8C73F648501F1121152FCE60BC49EDCF848D7AF1250DD636FB6A0041CE402EACBCCA675ECD75C8A8638C9D9F14EDAAA' +
        'C00234771E2897863CC794D6FCD1FB38A5C8EB734CF63D63A280EF0088BC22DEB5051B04D315C8196C83C59AAE1A6F11C7177074DF1D5F4D0457943CC8A20354' +
        '03A94CE68554DA7AB44591E14E903AED8A586EF45BCEA45BD59080428472A004CECA234B3C69258FF288E9A6341D51068278536D20A1B5B1746777917D7A5824' +
        '2959725AC804A30A8CF45D0984DFE6F5886FC0E8FF9848E0CE6C5CEE3E0619F69B211F07BC398606B9A1624EAE3F4AA0A7F2E865701D6443FF4E2774667EF188' +
        '7ADC44B15DCD067BCDD835DA58606C4E7EEE1C13487C802518D75904475AFA758BC5729D6155C4F2E3E6ACF4112422EA9B3A538200CCF475FD42F2DC6FA39677' +
        '1BBCEC4C9CAFE8928918564BD4300995E2385CEE8BA784D906034BC55DF129CB8CA095B070F4285423773B9080E8267ACEB56B00B7B608EE210C44A73B5E1EB3' +
        'D61795C21E230EF177D370B7023084017787951FF48B099D5F727CA739CD407F8B7078B0DFD41AAA4838ECC7EEAC9FBBA9FB31D9E2C5D19A24F8E0F9B7597B6D' +
        'BEF928BEDED1BC6A8AB51A171F96882F2444B4DA2B974219D4C3CA16BAA1BAEA4C26D819F46D35AB49F9C91F824C57D4D6A7E08653474FA15EBD593DA01F1685' +
        'CF71C5FD0116D63110691FF76284AF9DE9658A4B18E6000E804F5025A2589E36D5D0FC72374D45BFEE020A41EFEE703A7A74F7133E040BF76A15DE6AF7B7FCEF' +
        'F472CE62290055FBEFE48A7869596EB594E4EE1E088BDDF09E9C8DE5A69FFA108BC7F8BAFFC064855EBEB1E864BFE1486A3DBBC64F3CB7720457E669AAF5389B' +
        'DFEF82D51AC03681BFCF8F428F24927F615AC2AB557F85C328EDB6AE266298D5C4D887F27DA7767CC6374895A3845C2E992F8C93F3CA36F1110D79C959A438FC' +
        '81B301418095F2BB2306C201C97DABEA1E57FDA51739BB5930E2CC8AA08FFF777FAB9D2E942F433E380D504C5D39751832BEA7AEF5AAE1F94A0348A742EF0189' +
        '732B11706BA525CBD2E24DF254A81C77E0E22673FF1C9BAF97A1EDD48EA5580556CE191A79CCBAF512CA1336543813B3546AE1B17786A630E5DBC6B82FC1F254' +
        'DF6FE86B27D935AC4CB42D919DE5DFEDDDFEC946213241C2EC1DF1606421E8E5C33D0B6376C4D0E634BF496B793651F41C596363653836BDA6820FC5C9373223' +
        '046E7785BD7FE29807806960A79F364AF9A5BFFD7454C60FC0FE8664B7DEF67ABDE7D4BFB3466F917CD1424939A93E17EF911097F865FBCE6110A3ACA0072275' +
        'C4A72EEDEE21A12854EAD494860AE1166350BDD0174DC050F197801068CE038E2C181F3CE04FB5A82CB25AD0C81BFB1A9644425DF9CE7F94C17927D6152C8F39' +
        'A108D1927505017E9E25094D701C22997E8749818EB34E1F842F09746104B15E1D65319EEB567A3E1969516BA7F3E332A9034AFE402209D73E236934A227A984' +
        '8EFFA659971A9AF7603272CC080D2003DAA8CF5CCD46A56D31B67213F4AE044DC0466CA61AF0608DF5F1A129A29DDF5A51DE5A6819E68C00AACC0A4D84ACDBC3' +
        'E6CAE3CFF4A8F2372641EAC59346D84AF2E2EE07691D5B35BD8CE2B46355592A096868A2622B17B62CB11C5F47CE167D5FC9CB8C935EFB5E47B4494657BF3BFF' +
        '169FE373B31DD2C9AD66866FA056D7BE89A9A49BF17A24CD705970B0910400F6F7BD0BF07903B8D313E21307A748BCD61A2846614221D4BE8A1D37B0F4974D33' +
        '0A0B8B9DF949566AA4712540E54FE5AED06B07CB43CDE262A8245A2C7373D6B711FD82C0A7A261D541128DCFC1EE7EE1320CFEA0E2D365C80C45396972A65E19' +
        'D0EE83FCF836B7F5966C396766C80C79A108EAEDFF07FBD2C14FD521EAB64E357D65DF702549878C5ED09BD8F53C8B1C3731E91766D9BBEEE9A3EF18D3BF5D48' +
        '1E64F01288B5836BD994329E31BC496B252AA7E65EB9837FD2FA89891E5D8F1BF322E43DBD40F213BCA87D76811C567019E8CC906B0811248A57D1055A18AD49' +
        '973C78F53D753E8AB18B273A024AE0D160F583B35EA6608BECC1277BE9AA58614B582CA20581C15BDD9BB4DEDF10E3C98D94D10255AAFAD7BBE381949460601E' +
        '47BDAA29F87DD9DE03EE46EE38B1344B27BAF29D00AE17D67A28301C932CB180CE62A93E668C328920411A736DD7A5070C34964E2CB89B6C2954543F57B2CBFA' +
        '9BD604A28618F3A748A9AA85D0961EC1A29C31C4D4E8C8259DA042BDCF56B366810BD85DBEB26FD918DE3FBF0E8811E6863DD0F0A4C33A124E342E96B54A53B2' +
        '453EA3296230E7748D0DF1DEC8D51D91C4B6BC8F52AF00ED2056CC4C4C25C6DF86160B33DD7EC7CF79287113A948AF889F828577F2D8EF71949E4DA121EAED4C' +
        'B6FE1FAD383F3ED78DF456FBBFBA6917FB0B15E9EC6C60BCF0F966688F2CF1004C0BC18AFE2A41A0E076D5C2A3192C6EC70C4819D9FACCA18DDFFCFFE4C73944' +
        'DD494E31917983EAF0839F27E5B57BB1B61AE414FC6268FB28E0B14421A00006F7F7067032D4D14C7F833D63446D6F393635CC0A1EDEF9B7240A9E7EB495B452' +
        'B4ABD27145042373411544F30121A6168DD86C8D068DC747F08AE7E0CC2627B15A034568F9536CDA4AEB3395F883A3C2BE4B0265B61720EB8842AED41E3E321C' +
        '97A14CCBC8672A58E23635AC6933FC93122B91AB266E817C602A9BE150906F15AE3B2FF9486F299FCE84A5C54EFCCE3AAFDECC35A91907F661A709B0158D64D4' +
        '1E45302EA03922197565E6DF76B042B37F84D62641469DC91F9099BC6D88AF448ECFF1F11A772626BBC0C797B72DBFDF9B33F064EAF023B2BAA093943F451CF8' +
        '75376381EF8EAD581C667FE724600AC9C51E5087B1BE06B3F14939444E1E2665A2DE72D367011BC09F08EE97A46768CC13B5FF5FBBBE2F43930D61EE36A7F5EA' +
        '031342CF2783903E888D7C5DBB94582AE7393A0B03924924B8818D73CB94BD2FC96F40301A2B9243B4A3153731BD89BF6208D2CBA4B365E468CD64D04FD3B1DE' +
        'F50CA2590CFD09A46227D82D92576EEC7AF59614FB4887E5EF0C10F00F4E8D70B35577276E03E8F0B2677D5D353967DFBC7A836B7A79908B63D61B51B71AAF69' +
        'EEEF6118B9DC1A379DB7147D46756C44E7FED42C7330982FCB28A79A9E5CA542C9099D9CFFC965392A266F18F4C9A22ECEC34CD96C07703AC9A91D5E4CB98968' +
        '32619AB04568143A83F3CB31E08229B1689700B6AF53B0B1976C4705D98804B880F1F20802522C6E3E2D8CD2C062B3DEC0E6B8D2F7EFE6A1BA0CB2377D8B4276' +
        '4F17AD8D0A64B4E7BA40A61CD64E631A7B000BD755E50D255ABF365756D9850B4809C71BEDC94D122CBAC43F75C859C8CE85D646D9DD0C36D2487F5FFCECE3F8' +
        'B1D5FDE0CBA73BCA4ADA7460EE16B6DB687EA87A71D3F46D7A12369071EE038829222CA85F74F752F7F2B5D4E03C6D843D5B84C9BF2C479CF1D484C64544E36F' +
        'C8EC4E287691AF9F50B41675E79D5CA95D1AABFD64040D6EB57149C95DE310B7D284BA5889301688B07DD6FCB467C9233510F1CB8FB67596A8FD34F6EA43C6C1' +
        '8B8AE05FFAF92CB6930A072F9DC5318BC2DD7A7686DB350D3ADD9C1804632301C085F6D887D9EF81A10352BC5B35A011420C779845438FD65AA861A7C3751959' +
        'BC82E81D7A2B78A3C262A1CC24AF74E8B8F7A3700C647D96426624C0E550482D50F4097F3475D496E18BB2ADA3C473D66BF19589A64D7570B26E7735B5A43C65' +
        '63D06736CDD2D79A36B5F479D3DCDB435DE1DC5B35DB40B2AFCCD21182042950998B3E31554EDE43A3E86B477A7848D87C950F226709B960B8EBFDF90A18A2E6' +
        'A05FB11D37534871BF54BAC087770E92F024270B4F362CF05E1FA13BA4F40990F21F0508397860D2C38342C84525C2F796FA558578BAA1AE06C7D5F54F1746D9' +
        'DDAE0B393BD77C0E3AC80FE0C467A0EF25C2F0E2AA20EEE970FEF48BF27C6E58DB316B74B442011D3580D0427C634D0A016B2177A08AADA8499F61299BC1CAC8' +
        'D3A29F6F8BA3EC84F45C803D5B18ECB3B7A9A2BE0D9129547B9CD2F232117FC673BFA1DB86900833ADE0167363878A083BBEA5A5FDB37EE5A33962A2FE7D671B' +
        'FB40A1402F3E0B9B099D369D98DF7AF6DA8B0C455A830EA47EC957ADD7F8A64CF9B72D83DF9340348FDABD7F94B57A2C035804CFDEF501CCB5DE69D3B36B46AA' +
        '762F799E9ACF16B2707040C6F01676938B523266E28CDFE56B473630C49A5086E5267ACDB0BB52E29879F1D8C14ECAD0901697CE4F280EDA7EB749213583F805' +
        'DC9F18639B69513CE2FF78E18A2B58A60DA1C32D61D1530436CFBB6C2E508E0C8A9710862EB19322E3D8C64BB09F28A38031F10BA9554D28F590488603E670BF' +
        '696184C65834369D5A74A1499BEDAEEFF39898D950888E6DFA79EAFC0E8945816192B12E51B95142C5DB2650E07330BD149C3F2C646B0303CE2DA3ED97B5D24E' +
        'CFF3CD804178DBBFE32D2BEFDBFFF52D0401EBDCA4918602EE4D300E9C8E2DAAAF8BA0748A45EDC68E7EAF938B97595EF5C594AB7F1DE18E4EEF41F3C2CE571B' +
        '8CDF5FABD4127C071BC818072C77A22DF551E4084D49F2D40D0A9E8F06C568F6CC651F2845C32E3B4AB59460ADB68027CFE708AF31CD2D09C03D3F720D59BB0F' +
        '6ABEAA5E898802281BAFA4C7696E3EFB07DD1D3FFC62EA5C6D4947C962909CEC7C537B446C66FCB4C1CE01D15A746747177F163D508AAD816CD5CD1A88AC8DAE' +
        '989C3658D7924F0BA1803F992B8A9517F457CAAAA1BB80193EB89ED20ACA3AE968E5A20AB206C08836159222110A36030B40C9A2417AB3F31197CED376569412' +
        'B6501D4B801D152D416AF9730AB0E2E77A4FED33FC7D68364110579C366A00BDBEFF428EAE118B4DC8E3297127879F0A4E363F879E6012460EB1E027B36CC6C9' +
        'FA7BEA351A44BBA13D505A32764D1F75A54DA159076A05B44958C7CFBB72C5CD7B17C9580951083ED34653C89361C73FD4257F4D0EE3990E796D62DD9FBA2C41' +
        '569115E12F6A0B825B0E9223788F4444426D8590C25577A549852F77B83814298EE5C984A14131EC8C551AA42C966362CD5FF2CB67C9C661B8B233043C3E3563' +
        '55C84BBC469C776059DB7C2CA40BC15494A9F176165B802A56AA8CA3FCD7E00E154F1765A9AB9FE10E7E175FB9B7035EF5C03A660C76BC50A80573A0F21D7977' +
        '77AE0139E6EE732C85FAC94F4515761157BBF04C2079C03516C50A8CC24DF1AA5263368EDE8881BF81970000FFA47847FFDEB0DA81B8233A262CCFF6BF4B2E24' +
        '56D2CBF997E13824781786825C635D985AFE838FCC9A9BB1A7FA25E3F1631169346CB4BA197545D40DBE1353534C6B81D2159BA8FF20174C7D5959013F73DE49' +
        'C298A4A97DF463499D2897EB7AF68FC5ABF0D33694CB7B118B9C2BCFAEDF6AD9A749391285880E4A3E591F5B667A064CC96BE6C33CC7651969E459A2D886AD9F' +
        '12856A224664A0850844A00190C45F9CDBFE688647E67D895EB67D0CAA55AC4879DF387A642E0A0DB73A5F102DD82B9AA9A87E998122FAD23EB13A539ABBC571' +
        '7338F21C463F5839477EC0B6D7879C217AE042346AC076E61CCAEDA3CAD9E45E55F160B10D07C67988E00685B6BD42F401AF09FEA434CB4ECCB8C53901A631F4' +
        'FEBFBCAD08A7D8E33672A1A147B27AF089EA78C2CEA03111EBF7A82E42D2A3C63B48B5244C9782E97CEB138E44AC11F4285C125DD72ED678D15501675B9D7B2A' +
        '6C2D7EDD623C740E1DCDED0CD1BC8A797E32F88A2448522F87078F94336A576E6860A79869015C138F04A078C09CC8957BFB86D36FDC1DA04B6E9BB54C7971AA' +
        '078848F0122911C71BBC32E66B7E1158A7DD457F02BE7B75F42A03B50A2F66E3B814B18347502CC17C0952DCB1E754996B7C6EDAA88CA082A35446CBAE6BC160' +
        '83BF0D373AD975DAEB7C932BEA62B35EB50DCBAE22545E8F6CF3060C79C1A6DEF2FCF1A620BDDA18C0434DD509BB006E264E63CED8734F9CE2F3BC04694A113E' +
        'EA1BCC6A0A42718707ECB9E095DD1EBB8A314B4AA0B74D60CCE4C7AA25909E7C5282516024C009F141A8805F6AFF08C5593B9765AD0DAB90BBE2D2ECBDE507B4' +
        'BE4A8636DF675FF4ACE386AF10F3AD608447C05D094758563FAF9D2F98E8DFC4861E38326DE6CDBFC338C30401723EF848CE1ACD41BED4F29B0756D75E4C3A29' +
        'A211530F298AF2A25CC1F28390ACC0F42E8C04333B80C23D2C349FFBE8413E42F7B84E823559EC4C4DD034BD1F0FC37277017F7EE6266BA9604F53E67A2F78F3' +
        '18BD628FBB82855B9363F6C693997F127477D741E762A7F2CAFC11CAB067810BEB0F65047137DC23630AD609B52262ABB296924279DDAF35B9836C71B1F1745A' +
        '41D4960B7A2019D25708A14E2C3899537C7A8D2B660398EFEF4C53FCEB0DBA12B81F39291276B42B26A4636F9A1D4DF7D7BB52AA9221A86C70E1C5E1F342DC4D' +
        '087667B03D9197FED585130F4E0406C224DF7B55BA2D746BB90111C6C61A8816F25D409C9E35C4DB5A25DEDD99A107803ED67C75DFE0EE974485D66103C206BF' +
        'A3E7F235FCA294C6E9AA7BE3C387D887C7DDAFB5137809EB4AC8B9B0F179A0AFFF5EF23FE0464A2E58C520CF458E3E998353AD094DF2E58C5CB1A304DAD8E9C6' +
        'B8B303E91C7A23174C15D9D35DB792FA12706C4D44EA1988A6FADA9E40085B5C967951DF2666F54208D98617A5565BC5773951EBF420104FE5F967C20F8E50E3' +
        '43E65779BD97BD3B37E5EFE6EEA62EC9EFFC4CE5F886252CA3459F07D016AD5872DEBB9CBCD56716F0892BD6906B0AB7931380152535A6919DA5D48A02F18F42' +
        '49A33F925ABBEC8FDC38E3046B27650B056FF4D552C0CB5DA74A9133001929B9B2A49DF28D5AC94C4B7708A9E93B528B12DC5B6B3D318091A591C8BC9CD84652' +
        'DB47C1D5210CBFA6D565C86ACF62B3E60367B6BDDB7BE79F3D661F3645208E7AEDF3DBAECFD285872DFF5FE39C018CD3D40DB569C90336D9B516A2ACEE9A2E43' +
        '30C4485E6476E37EEF50890B60BCA8CD189108EBBACD1FFBB7F95744914EFE9AF66A46E2E695E91CB10A0EF4D5C646B2B6EE51F85BCF44F9F543BC6353BED346' +
        '18B6FBE2E9F4FE7B75451FE87AAF83B83B9B7065E61EE381499BC7006F8A224E5AC73779902E577F3FE663489BBEE14AA56DA36A38B894DC184275093C4014C3' +
        '0FFEE3684648FEADB8305AE7359E5BDFE8D416C3A6E86D04D56D7502BF8CE1757C00000000000000000000000000000000000000000000000000000000000000' +
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
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '000000000000000000000000000000000000000000000000000000000000000000106FED235213C5975EA09640F19B73FE94069F707A0C8F5B1BE94AD20257BA' +
        '5BC55B095B148D9C9CBDEF2CB964C087D706EB82CD3767850E0BCEBCE656B8F261CE5A6DEDAD4E7A610A08E792E6CC65A363213EEFF0C1CD3E158901F7C23A0C' +
        '534328B72CAD09AE6CE0C7F91CA98DE952DD26D6CE8BF0041501124473D9647DC0DD8505C4FC61F4AB51782757BB0A13C131437CD68490FFB24A5B8AABACEF44' +
        'B48F98607974BF7001A1B3EF38123F450809D8A3F75371F5A4AD9FA538E322A9E7B61B94A23D7329B2A2F612C236ADBFE1250EA8DB84F7ACFF69BA6EF4FDCEE5' +
        'EDC8102E6CF4AEA77134400AD3ABD230A9C4B69BFA0EE26E9CEB0E8F081BC9325F4DDF85D71753B3CE38B81AC207DAD0FDB080DBFE16A294D377B1FBAFC77D6E' +
        '58C924F8C036CB235A7B8642EDBDF4933699126DE716F7A8297EBC4E761918E8684023DF25E860CF237CB5680546866DF260FAE0BFCC7AFAC23E146F803663FC' +
        '36596509BB90925C758F39A485DF729F0F725FC2A531C56F4B7C6A7ECA3DE33392AF6668CEE55919E843D4BB2716C5CFA6A02578D1E608212706334CDAF685D2' +
        'FF7E2144DE3A70A90FBE830FDD115D2CF1A5EA314C4F7DDF0A21678F1D29DD247B4ADCED8624396FEBF8020261DEC41EF0E418EE416A872FBEC081AE359A981B' +
        '47F589282A700551F96900BC5C92734D24E36B66E364F7D45DD6F1A2D39E9D9EF3F198A6699E4B73E4CEC451E6ADFCE08A84366D180776A553026C5A7A802D7E' +
        'C2F81D936D7BADC01B881A17B697F4208D769E0B5262F9DBBF05A0B92AD87B023D4D206C3C88D7C9DCE6A9490F021E88BD182DFAEB81FDAB552A5E8AFFDAF2DC' +
        'ABE60B9E8B17D454FEEFCCDF9EB2C3F29D3799BC87644C30E6F23D7942D42FE98E43A105AB72EA3D418ABD40EF3A6CFF8C0D021F0C48C47A76AA58F2FA997D8F' +
        'F354706A1DAC6A8A76772BF5DCF325C943C53BDB2B823B641757205923B0D4F6A03541B3EA3D591B6CA17D5C0C4168AD1548B60369966B1D677E621E9A1149C9' +
        '553C9A90DC06FED1269645F6657427C01EE439BECA2444122434ED27A7334E9140D4FFDCAC6C227FAB3F4AF00AFD497634C3EFE14358A393F7E727D5FC302B62' +
        'E604AA0CE6AAD1982CD50A7860F29388DC3DA921BEF8C9834189298D6F68B181C4C762C418ADAC06924700DA1F8314F0F0869B918BEFD64477635E50A9524972' +
        '33C94FD245FA9423E21D25FFBAA613730D8DCDD41FB4AEBC4D43A93C5D780A448E8EDEB376A99B11FF8B7FABBD2CEA07F1C1FFF77FDF07586F5E42509C034564' +
        '98599CD8F1B3D65E19A22859D4076D032A8BEBDA6E0F658E4B412D9A8A604FFD24CBADB576ABF06B313CBAE6DEB6514990FCB6A291697486781D4E69330B3D93' +
        '5B9A1F703D421606C05F8A0026205B0DA17A0F3AB7234791A8FC8D1913AB77B651F70150E88915D1F79A7DC80952F9192D1098902F72733F177A58139792CDA0' +
        'E6EFCBDAED24878161DEA009BD4755FF8BE5724952ECB8667E5F06C1DDF8E353F21DADACB911F1C15320F4DA14A80827C66F02AAD2021020122ECC36389C7BD2' +
        '450008BE85A866F79B33D9B92AF0A197D4E43C6BE627C439D4A9471081AE9BC7FD7B20A81867E294F64D5469025DF90EB8B8ED90DC23E3D28764328CC3FA55BC' +
        '8636F03E3FF31AA513B2B310C05D73D6FF1A7F0268238D42494A5D33318599FD9AE9A2222A8C06499E018B1B2371A4474DE366CFEEAE9A4D21D1B132E8C074AC' +
        '4018D8C126BD88DBA6C7C0F41F592694C525D945A267C3B07C2300A49E1B5617BA78680A7F85EEB9B72742271EB92DA5784381819CE9A2057A2F0E3476C72FA4' +
        '1BFF8B276679970EE4CC1F86B2A92C96C595B2D60D55B1226A5DFEC886ED45FB4C09C65A18F87CF2009E014E684D14D1E6E575E90A0726F242701D2C36F6FDC7' +
        'C971AC5335C9C482A71F77DDF0ABEB3D8B06E36C39025DDDBD947AC5FC69FA9BC44248742A1BB1EFA20D84BE45520B5C2D444F48A543CAADFBB8EA5E3E8C867B' +
        '1907609AB930B635023E8A5F0CB160EE0141C212C0B6BA4A1CACC95B6A9946AFDC53180B7CBB63D3BA3A17F9F7F5FC663DC581F3A90159B4F9D6E8BA83147E88' +
        '6EEB623646B5C3A956D2CD71A06944124F5CD2DBC051BE8928D3D240F8A641C31B095935F95A87D2CF3A70776772098DB95CD6ADD731C14F5354FF867858E181' +
        'C53DE376389C73944097EE958D31B39B81FEEA7DC8BCAA795848C331E24954F8DA033EAE43887FB98358ACC095D20442DE020ABDAC6E7F2FCCD7824DFC069F02' +
        'DACA16E83E1C52189CD8F556108ED10782768E1006C5F3C486C344E1298C4EDE4B70EB241A8055269EB0C286E85688A82771C31AAB6D0EFD9BF7C0AACFD881F8' +
        'B7CD99115FBC89A9068246D96176EF849D877188C106C48610DBBDF19F74026EFD4ECA2DFF54AB50F144ADF701BDA88ED4380099DE86042CDB6F9E57471C5357' +
        '806D8802ED37D8CBF69F7D58624DF4997A278B2EE1FAE24ECF1CC64A1CC0C353F5FEF679DA04E3E48A4CFEDEC459A6028F47FEB256C8BDFC9D8C22D458DD75AC' +
        '254EEC582383BF1525846455C4B04E25088F51D144897923C52A2307EFD3BE4C1428403ADB1A63897F3E01EC33C1BFD1EBB6795E83A466202DCE68B07682B0ED' +
        '826ACF195A41BDFE1E6E888B24D49F0FCC1F9886058FFEE16DDB54A12D333A8F673788481A3B97CCAF624786D48C73405E9FB006FF0903EF33BCDD3FF9BBA36F' +
        'C6C1E09B6FAA1EACC6F9E497132CE857C0943A53902EBE97DFEE19A031639B6C54464A45EE6AF74284E6E2E2B5EE814AC435C2A7DFD84364EC1FC03D55765FBD' +
        '2200C56F58D50C6369EC0C0933E4B99CE768AF25487F9FEACA1EF6DA0C41FAFEC11174B5772AEE69A9097FBB4B5B38F79FE7F0679FECF94D6DCD563EA8DB823F' +
        'B1419F344901F3953747EDB9795192257FBFE880DDA2CD4921CA11C69757A9657154380186EF2B8FB7435C186C5CBAD29E30403E1F44398F7BF7CE564DBED61D' +
        '2E8E60551CDFBF8C2C818A45FCE1D542E1877A5A511FB31ACFDC5480CE77827DADDD6A95B705AF00D062932F2B5C8AA37CF137BE0FDA4BF669E9201B5464381E' +
        '9BF4B2939D3848B8519F0E28D42E4A73B70BEDC7076B24F321B0B8150E24FDA0B768CB812D87A02989E881F179EDECEBE174ED964F949BFB93D3B29174A55268' +
        'DF989AA721BD7706FE429750A52C400A5B2F9FD828BFB318A8040D80E0F15F683D0DFB845AE9322E6074B4D858BAF6A73F1D26B5D043D9650497FC41D75F8FA8' +
        '11BEB2436A6DB7C7E1570052A7CF9183AA066175283243DDCD9CF85E8994237EBB61D27A68AB97395F318E7137C4B61F08104E52EC469275D12D01D099AF6FF3' +
        'ECF7A5FD531E23157F243E1102080F41DFB977BD3C066947446BB841B2D28935932275868A151985A3BB7C3D0558C2EBEF17BAA235F00990DF48B28114B0F655' +
        '1349C4C4D2C4981612D4BEC92FA6ECC980275A9783BDB253B6EBE454F96FE7C76DCB8B0AF785EFB88612348F3C16A4BEEADC299E4B8CDDE648C68E2AC623D875' +
        'CD33BC8797E09C3A03BA66B562A93D73A2E4D5B19DB035F33D25C89ED8AAD2D3988A026DDE6E472DA35D5BA37E06EBE996D157D279331742B70BD6878FD89991' +
        'B62EA514F870A74C7CD82524149FEA3FD866AC666DD79E6E9D36C26F2FA43A8CF7647AC5B69D50FDDF48599811B8B488FF99C59956361374347A31E2D9DEC71E' +
        '95B42A17D657A052D6AAB06B5E4BB48409BF3669CB391EB906A096DD9BCEB06CD9B776C24C3529327C0D201F101D42A57EBD8BADC2871AA65F9840E9DD666391' +
        '0E6C56A221019446230589EB1370BA27157BA0F1B05D6A26A9EE54A59350AB46475EDF60570F8DC0B0CDC75921602A5CE69D9E60CADF85506C62A4DF747E0999' +
        'F44D62F0387534750190D0DEA1A43549386AA3E1B3F5BAD00AB60497C21E34D78084656F26E3FA71FE41AA5F6E2A4D1E25B75C32C0ACF44510270A7A68574F32' +
        'A51D070E6EF4FF783245803010D396644A4FAEA44C75B63172C39B4DDB5A2E08936512CEA76C1AB0956D74490432F796DD7A8791E2F001069F69E434782EF2CB' +
        'F81F54D7540A771E2BB9246FD0FE43C92A329554F64CA188F477D350AAAFB8CB37AF696B0B9DC23C67B7623EB5F7BD9E28D1A9A8A8B40AD79F082ED19784F1E5' +
        '2817A2410762708F66648361F6FA9BE98E69E12F56BCE760614C9C661DB52E5ED0ACB289CC7AC3CB240E1E01EF194655DBD4F789850E1BFC53349E10D9BE92B6' +
        '3B1D62F67FD34EACEEAD594F0320FBBC130EF964A6378BDCED5B2ED5FDE7816C882D07EC015D832342D7350E4F493B87F2CEBCE9BB59293CC5C3D679939B5096' +
        '2F99E93DA77549FA388C131AF520AC2456EE2A4D7AECD21A6E8752D1D952CE87AB0E72833A44137D83BCDB844E9E05095E1B2200BDC8120AE719722A903FC1F6' +
        '80B0ABC59ACD93A4A6FA1BC02D8B9514FA6BDC887A61E0B68065B8B5FC99BE85E301767EE413002C7360B60E72DBC46781227061FB8E00CA92EB5FD1DD6D7A95' +
        'C2EC707BBC04DEAD6C3338C93B3C3B2D65540BC2DD65AB98E7A6706E067332AB40799D12B5D92BA5C8697A934B091E9B60075CC3FD62A1F723647D6246E5B8FA' +
        'AB87803FD925B994417B6EB387639775BEF714B41C1A71A67405192654668A4E9E3B1444BC5B885CD2CE09E3AC340CCFAF052C320C0727B409906AFB745C3027' +
        'F5637B0857CFDA95EA3E0792AD5C6F836DE7EE9B2E12792BC549B1422C80EBD875CED84AD7BAB504ECA4D7C8E44DCF7158A1C5B1952899EA1C3135F6A6B490CE' +
        'E0B8AEA39879E1E4958E2334C4F1516DC48096316073C9F472D0CDEC17DA5A3640818B1F0781D5F737C96B10676FA59399D8874538A89A526878A1548A409277' +
        '39A3608BF76BF67B71BD3CD5D84600F0D333EEDD7F3AA18F8F798F7478FEECDCFE8A4629E05D409EB3BBA1EE623F1047E29984B04E1DF4AAE6380DC8333B5729' +
        'A3ABF373AA06695608FE90F8E7E2921ABB9E7070DC03C518EFB1C1C6765AEE86CB342E22E6457997BCC48FB97CEA087C628FA7E6A0E75FE56D635B6718503E9C' +
        'F64E9DD92B38C636B0086CA1DB80A860389EACB0601FAC655B90234043653DC6F7AE4A76DF1A7A6A80A5D97C633B7ACDB7810DD7E1932DC46AA06DB999BA4AF2' +
        '507C4EFBC2EDB3B347BE2825F6F2E6A51A87AF5EDE9F8C8D432E2AB75A3178FE80F75F1134AC43A3090E6F1D9E57AFCC15D8DA49D743B6D790925DC0B0B38C25' +
        '1315B13571D23CCA105AE6E64C73E7C070EE8DC88D01E0E7C01327627BD7EE092E151976C013C310B8F00B55D856B774FC781BA6B8563AFE556975D10A04A897' +
        '25216347336615C7742B6640C486AAECEEEC5868F8886DF2DBEB3BA90FE8B0F1537DDCA643822C3F81C5A28B4708C326D33C0689D6D12A8364F11EE98536D7BD' +
        '00573006A61DA104BD6B66990109711C3DB99B0B9AE70F8FA4E6761761CED8A82AA63F3232421BEA4298DA1993A6E775914E26BAEF6F6B5412ED6B3F64AB1C53' +
        '2A09C167B40CE382A3C2A6AA058F442109962F6388CF305242D6A271DF397DE42420B5987B4D0177406619D3F5FF60869508EFD651F7CF38D9459B32F76761DD' +
        '614B09F2DD7B117A818D55DC2A3CA13B156909126E1E7DC7331F21507430A70C38E0E42DBDA873B875DECAE5202E010856A756C76F4C8F0E85A769C5855BF45B' +
        '3DB791D4A98614DAB0C633B71E42954E387B84B2A2E6C6CCDD862A181F57C6CE5F7A1EC0F6F144087F9D2B5ED00E2F85253A8F8FC9E9F07042DD0A59749216FF' +
        '883F8B538DF75A2F2486759E611DF900AFF626B5D6CA363F1629CC22B7B71A50CD1159287F217D38BA7C85DCBAE523EC3F3F052C003D2119F2D0BD05B5597250' +
        'F0E810435A10630F91DF76A72E8ED62916C7C211A3007757E921119CD6D2060BF6876EC7F8DABFE330E1D595BC9B80807CC2C09A388F3BD4406BBE3A051BEFA2' +
        'AA3763628223E0D416B67681C1DCB10F0FC5D8832292A9F2F2AA496724217B107954D26438254D38C17259F34EFA1957D3C42E40B5C1DDCE1F44051AD60AA26B' +
        'AF3687A617DECDA6BB7141C10895A7224B56F3EA6B3DDD598D5AFF6537D88095E94BE6FDCAF3D72FD4F26BE6F12033AE2752079416BED1F0A026888770573E9A' +
        'A713407BDBEA812FDB1A0E10836162BB7C14FD5578F59F01F4A76B63503C8408E3C2948692626C71E7A64EE1FC622C68C1A57005EFCFCD58F1D16B1206D738FB' +
        'DC9CE18CBC2F7094EE4A6320C5DCE2F6757E8FF199A5B07152C4880E3BCD50948D467428328460A22C21AF80B980015B9BA0C9E587EE08C13142E9568F71E9F1' +
        '8B79E97D458FD089C306CEB8D98358116A207C65E5BACB3214921BB37856CF13AD72FE1C236C151B6406F55F884064D1747E5F640D68BEB8B447F45BF420E42A' +
        '7C262EF58828AAE48D104E1577874C5340EB034297DB3B0F60727C7CC57E0317FECD59AD627B2E86785103F319EFC01F7815C8510E7258D1506612A494726449' +
        'D9FA1B4B301FBF46E2B0EA9342C9BCE15547D20E975CDBA6DA8B91141762DA48BE0B4D309EA3DADACC0039AEC4532C46BE1DCD8C2569F84A2E6392950B6ACD66' +
        '22FC9A9A7E7F0B0AC8E327026781EEA6F20F7CF52DDA39CCD8B0D643D6C51CA8C1BC4B0AD5424F119754D7D0EBEF4896D5B03DDFB94489055AF992962FBED546' +
        'D797350F4E130DF39E43BC245B78713F56CA2396D4DCD5D94208149833397D862A47B1A332C7EDDCC91ECBC76F46DB330C3E7DFA3A4FA0240CA8C0F0B629C871' +
        '44ED92A4927B910E48B601D3FD4E94EC36CFF82C97AE6A2AA5B5280FB5A1ED371378E75442816AB1A1B11391D58ED6B31B5CEA7B55298F2923320D47945AFA64' +
        '0D0DE0841C8E964818254CD23BB098961BB1C2233A0CDC8763F8655A2CBFB82772D0A88C074C2B0AAF0B39B9D0651264C5126BA203AFD620B4FF5C5A5D727B44' +
        'B2FF4E95BF6B9949860C544FCAF1F8FBCC45A8B74C0B807FC8384C5580CB8A15D0C191B1618C7FB5104503799FCD8BC19D762B0A8112286B036110453B7F8CBC' +
        '59AC469E5A149FF4F2249DBB29216493847ABCFA8CDD76B42D6806098D5EC7C75ABA8AC08E2578F2DC97CA955617559A23CB2CE8E6DB5469024E8D5D7F0ECDBE' +
        'BB799CBD8F958F896A40C25BF18A27E5FB47E337ED73DCDF6DD7BEA751DAAD61B97B29302CA3E5900FD177B1E17C7134F8D4FD0A7DF9930348C890D5C50A21B7' +
        '38628CF9C85E7B7768BE1714C8B91F45ADEBED44D46C5BBA304164DCA88A51DE3C822EA5708CA8A690EA42F029C1D70DCD8A1471F71C1E690ACAF3B982E7D81C' +
        'A5883699288D0D70F24EE90F96704B3213E9D496C63DA479338B949BE2374CE70F2AE2055CE2FA82D1AD4A1FEF96CE87A6316854F5F3D1C2BF0FDCE8E542EC6A' +
        '96305738562D41AB83049838AC794F2977D1D2E0E8BBF1FF7CAC9E23B77073D276AA252F2B022994ADDF1175EE4B737F6CC6E260B9E82699A94B8AB0F446D4DD' +
        'B4AE435C6BE5AF3BE7EE21E91CEFFED22DE2B2A7900A4C896288124A23F1E2E31F7E5B6CE6153C459963128403F278E4BF1CFE5C6972C1A832E53A1EB2FCC35D' +
        'F56F7689281AC0BC7D0A85C3C061443E28836118569A1E65CAEA6BE16BFB592064DE58C1A8681C176C5E96614E5B9F233F0A018E6B286E51C9DC7D5BAD8FEA33' +
        '63E7BEFC56BB6EF17785C87E4CB427A7A2668D37E0E7E8FE388E2A35BC88D7033919B06C93B828C4BFC6F6E0B001369F7C077DAB9E368F9AF195E1DB22B7BACD' +
        'AD2C792CB0697C63C0CEC66D3CD4061575555C90C1BBB6935D9C3F60A142301E84F6995A06306A1025A6B06DB39BF77723A63AADB3C1AA29A78D9189942FDBE5' +
        'BAF76374C8B831F0811790854C3D65E40F54AEF8CF7CBC504CE17921FAF3C38B24B141F8D280C51D3BFA68A473DE2E144DB1D76742E7B9698A989BD8F085321E' +
        '36861745CE056F4A4BC35362678B9F68341D260316A3AB32B581F5D101958AC916EED0BFF871BB8721925C8302E9296779B5015AD92EB2D6E7E8044F21270AA4' +
        '181A5173E3692205428F83227ACC6A23514777368B00F5D3675DE72762C5262CAC0BADA4B0DA22276B751944CAB040EC04A3184F60AFEC2465B4CDEA857E0911' +
        'DC77A377CE3DC5569828EAE1DB20B1EA7CD08238899771728EA358DC9EF6215C6645E277C3DE9F95A49B5380EDD5C73B7077B1E1254EF3E636A4A1ABDE50FE2B' +
        '72819082E1A56233FC1284F2DBA49AF957C4872B58E4A255CA8E1C88A8EF9EE8AFBADD125E56CE1E7106FB4A9C05EC6D4970510D5EAB8C67B40AC9C233C01B18' +
        '02EB2F43167902679BD4FF71933557F47CC7163A9A8A204E1FB12579CB0423B837F1E508D8B320CC4171E06274E4F9B635054C49305441E90CF3EA9CD6C06A32' +
        '596E69A460D86414B0A9B3C1DCD0BDF3618DEE4F41195B88C80777E6277F08E9ACE5361871AC367DB9C8F8E878E056E5037AA1D7DBEFCC1EBA1448453AFF8F48' +
        '81F9AC319380D8F2E7B19A5B8BBA2AF5BB3FEC7A20B61E2697C58ADC28D9909B3C1645D5E39D553B567EC9C9ECA3B0D9C6F116EE3F5B30C000950CB7D7DC8277' +
        '578596C997B2EF69C8B32E41533E0CC80E28F94F22C69BD2FFAF4EF46B9658F951202A62C466E8FC1BAFE0A81F465A1BFAC5499242AAD7278901D4B1E01DD46B' +
        '4D4FF4E5A4E7571D3A45BF981850E3AE123A6678109A4E284D011CC230A67B7B3C8B0BD33CE0BA2F279072B349B0281E802365A2C6CEE6DF2AA80BC7CA323000' +
        'E35BDBB55E8F83B4F2953962F3D9966EE7DCFEA3C62E222F2BADBD71F7117028785260BDE88ED878BF7524C8F4B460AA7277109CFF48534C5CD1BBCA50BE899A' +
        'CA0A6A2FE5BE3A73FC8CDD8A9CC7CBD0F76CBFA00EA8BB490D88E485D2C67E83C05137D0B309A1B9798DDAF73B6A403E05B9803F87D582FEB70DA2B547475F96' +
        '8912D3CD372F2A442B0C555A4F2958B36362F4CDE9313F594F87B7122C78172C5901B50244D7C20365DAB66302572B84E3F6FBCCAD245158F7E877D666EA9B44' +
        '83E0672E415D8832160ACCA8DA7229CE5EAAB4D13CA26F88276F2308B7431771DF367674FCAA82374C82902DF50DEC2D8BB0354A824BF85A7C96F90ABA43E4E2' +
        '8EA8D5144EB79D80487A417F1FC37C22A2C7AC17E9134CAFBDD17EA0212D121DD8C39E711818694C9688D9CF5D9EC237AEE32AEB4F3BA18655A2D438673939CA' +
        '7129545198A339D17D7DB68E299C70E7BBA59457F403BEDC7D11735AA186C427370E0C5811213DFDB29442268AF357FE6A69D646C450B16F4227AF3DCC1738C2' +
        'E4F4FD5274C01A6F9FCFFFC38DC987CE5F6F00DAE260027AE3ECA0D75B286EE222B32E8BB8F8B6129B8FC168DAF5D211FE3291DEF2C37FA944DA0C7CDCCF0235' +
        'F7B2547BF1E0193362FAA7D8BB86C0D211D44486EFE6B1E334720C3C8B04343CE02E6A692D52381904D2F6F8A2300ECBFF0D65BCEB417B139E4F1306AA3F8CC7' +
        'CD5399A9ABEAC74C7C3D21569823153C6C44084ACB3A3E5EEEC74A334543D2DF595392AE38585BA861EABB20A55BD83C7A47A4AFEBFDEEE1BD619CAD0A775707' +
        '88EBB60C96E941EE52F632DA2CDFA1726CAF54A26091D130336C34566D08D2754C62F4C875DAD75B58BEBEBFBFC8768927137EC1DB6B6A561A1306D3BC124156' +
        '615052FB6BCD1A4DC45AE3C7A006DC3EFC0C1D15E66396FD10A1538B3A6D6BFF2014235E74D254195B046CD1D16EB00E465D1F8C643742DF5C4FE6E9EBA4C9C5' +
        'E2FC1E7172E5879CBF9823B8587172EDE758D9450288F47DA94B06EA3449FC7F6CB0B8CDC98E27B07C5107C2C689738E756AB216491B6BD9F64DD47FD6E67FE1' +
        'B103F7B0E5E30D85032A1B75447181602704475F6F6707B0BBB73B899B5BD477AA17DCE0948BBC6355C8B1CEE86BEED17A1491A74CCB410C93CD28B4BFB6CB55' +
        'E396FCB2E02143F14F8A29835A560FA5DB7D28E9D8D74F94A630A7908AD9366E9571C89239F10789C6AD2EDE8453EF1B1D486DB968FABC7C6742E233757FAE25' +
        '43DE7D69EAC1E8034623B7084FB7D35054EB4F8F5FF9F67D25810CD1C8DD409A26DD361ACFEBDA04F95FCD7666DDA13C3D0CBF7727D995691E0A40B1C81945E8' +
        '7859F720FAE600F9FEFECE62333F340CFBA009361200A9EBAAA809B771F8BB8E14D4DD4F63755A3A10489D1F738E977B8DC660F550B05FAC7A9F6FA77265C189' +
        '9CA6497048BA3AE2C3C163F3941115066D770DD1E739E97569539155B37915CBC0DAC852B65095EED6E9763C6329FC6C6922D4A9A4CA3365119B7041ED8FE045' +
        'AC88350BE2628F162A0042E59C9A3EEF41321FC3B41C62A841554C410D4CE26F0DD5CC48B4C138CCA639E8A3342B6420F25E7C817A0FE616C69FDAB27E0750BE' +
        '3CBC86E9A532B4CA2EAD5DED96DDAA54961E5F245D984C9495D4A9379645F730835613DA2BB9066D6406ABB5B4EC62FDA4962DF299F8D43493104B3333667773' +
        '41C7E03108836E935EDAE6DB8A364A10FD6912512A892A8FAC5BB8831FB44D0468D82AADC2427AECDBB8AA1CADC2880AA3EE0AB6602CF36F560474EE86FE47A0' +
        'EA7EFB1A07B5DB8842AF626F6B5732C590AA5DC0C72F8F2ED73C9AD5C3319A6825C7C81111CF85D7E6DEE6BE92E483DE9B1DB5AD6BC9875213ACE8F325704ED3' +
        '296A07E7BBF8DDE9966176549D36DF8578BE5D3922615590D5D6B123C1497BD4F734C2047B2E5A485318AA88FD59D5B4A10A9075EB0475324C2FA254E9E7D753' +
        '1A877051F9DE84709C06D10AA24FE56142C2DB536F9EC43AA0D903CFCCCACEB1393B58324A4E0CD9652F22B12749A00C1D7BB41FEB77ABC7F658F434D9A2C1FA' +
        '3EF01915A083B3C2AA1809F57447B4123C4960DF3573B1FC3D8905776C19AF5922A1A198452EB9F4E99D61B44B37485CF8A62CC9EF033217A522CE18A922B2BE' +
        'E49022E3F69FC25AC796523B2A52D70E66F51C9CDF87F3DFF52558F030930C75680C9CC78DDF9B683F3A379B22DAFA94F9FC675929C604F345A999762DAA59CB' +
        'BA50BEE25B0F5300B9FA46B6454B63C0F660F88BA452BB5286900EBB7328BE0A17E85152ACC3439E4C6658F161CF67DB33E099F44D4BD1F79BD48F9C2EA4D954' +
        '9911E7069ED9330D77117EEB6C761F5EE46D72E78B90A5E802E18219415A7C6006B94CEFC64A989D312D97C007D9584258E0DAA7BEF6C8961A26361B88966A71' +
        '6A64B40F8DCE76C9C103B34206F877106B8ACA6BDDCC6B93944A06F1DB6BC40B0F2B13589AEE29FA7EE43C43AB80ED0B73F9F1F6680FD4A7769EC255F38B8BA8' +
        'D0D4657319B7D3895061AAF7AC83B177BE4E4FC4A2E703A153DB75BE3C20CC6D1E431EF04A5E665DC936BD5CF4B5BD451FDF96577BFE727E9BED865A22A74553' +
        '006156DAF10B471EFCBF7B11BF8136988FBE61BBAC3C30D0EE6D648C5E2FB0E9A56F927CCF4318F1BF46593DAB48C46EFE14D0EE25FBA56D21C65675D48AA0CA' +
        '9312030FE29D68B4E83E233D56C260508229C6E0F821B2E91CF6164013E7AEAF402BD5CAC55E581C432B89E43F9088FF3752D21EE5E99AF295D14527F7BC673F' +
        '973733C500F43D15823E2734BFBA18910F2C4FB097D086DF96A60E5A1A265C145F7B76D34E92ADF2E62A3FAD5B1857F458E915F324CC2A8BA9C433F02E2EB858' +
        'C005B8B43C531B9E3815674053687E1EAEE899CBCA6121856737EE59D867FD7EB8A03418B03522389DD604562A29C23A318720DF1B9C8915E08FC13ACC7ED765' +
        'C6B7E7AD2ED6AA7A2E4335E5855B9FEB3E86FAD248A0DAA3CEF4F6C13FF2BA8357A8B0B72116D311F6D8A30616CD924385F9364023D1ED2A7086577AACBCBD44' +
        '2575EE7868991896CEF6C5BA9723E59E81298C2480AD4E010D2520382E56BF4F608CFA743FF766BE8CB6199332C4C271D94EB347ABAC87FBCD79625AF60ED929' +
        '0B2D565BABAEB3C69AD9B8E32E1C47F164226D4A121D6DD04CD03CF9293F32AA209EA48DBE65C1832E28C1B36007DF620AF9A49617F0C2D5CE1211060E34C6BA' +
        'DDAD6DDD777CFF310B71257190D9CF64439777749DAD5702CC389443FADE3E69BDD2FA64E5356B0A121D00393E98E8174487DE37E535491425266C31979CED4D' +
        '228FC534518EE00B4776C76FE8B39956EF911D82B20118050706CA19C4F8E3FA49387484761C703428220E996F8D67F0A8E03F17D6A58BA165659DD82B355176' +
        '18BE7D1A7D0DA8806142E1E326B3AA947106CD312B96A41C8CF8E85FA171D00AF8F5BF64385690824FEE32800ED127BE6DBF2E526390E6D9DF5C3D533280D134' +
        '57A747A6BD8056D42B1F39689606A15FBA26E60A0FA6847DDF6AD010233B2A1079A5CE2545471F1E8A7C8205D41ABBC8A892B215387E387C0836877243FECF57' +
        '6DFE9E4B1B64CE1C186CDD7EAECFFE713139500CE4784DF77D7181090FF5963EC6E98AE6DAB11371471D20D9580BE86065E8A36A9FF4E23B4838410D29A4B8E1' +
        '30F9A01030EFDADAC79BEFCEF32DCB3DAE106B9DC08C08C55EE32D037C57221BA70DFD8A71979ABAFE3FF3B7564D669ABA2E2D347C52CD40AEC40A00ADB053D1' +
        'CD7566A354E2B6C017E224DB38BC2C0119201D61ED53ADF63C5628019D71B945A4900589DE9DAA50128891BD5F0AEB221B2B25E7153DDCBE028DFA820E564AAB' +
        '52D5C2572A205A736BACDACF0DBE45C77A10C2B8613CFABFCF2C1CC0F912CAE9E0452B062426BD7B010F08EF0C187726206E6CC66565CC7A2D8AD82DF9580968' +
        'C0330B25482BE183A0A26784C559A1CD753370E7536E0D8A9A63C5BF4576CF3C1777E07404882C49E297F826722540F4503CC641C8FE1B81EDFEC7C58D1C3C79' +
        'F0D289529FE2AE826663104BC1E37645BB8E43BB5740BCA83C0DBBB3FE4CD0B9E78D0AF29DD2E601FAB07AF8880E2BD9894CD6932F5F7DC45F6E296300D3A7BD' +
        '81C3EC0A37BB149C574145E29531C13AA9885B30B8C5F74BC140BCB13A5FA5585E7967200AC3AD47BF8109072A033016D41F909A7863C5B0B70E5BE88F32F985' +
        'F2C66823A1587F96F636341B18E97EB48C6904AAA4ADF2E756E0764AF50A0BDF0618C271A2B44C08F7E8C8B93307FC4FAFFAF2837C564E043B5B49F5C444F1A7' +
        'FDFD1D7C2457740341F258BB24F0218E148D0CE35C7796889DC3BB6C447251367018A6BDE14F7F0C17D9BEAE372F445C8D868D5AA78BF1033E97F22FF41A474B' +
        'F97D482B6E4E56E5E1F1DD84C1F3EF8346B710ADBB6010FE902FEEE992DB3D1082E4D607025D5792B2D6CABD33553B8955937739AB674F155F8E70CD38FC95C7' +
        '9295F559A9CDBF38ABDFD44195AD686848B432325A3723FC3089A41E3A86E2F6DC8F723C53EA5CD84E2C1CE953FD8B15F11E28F142F6C1ED7927D59AFF332298' +
        'D903893AD8F652D169E593B0D38F1DC5C378B0AE827A8772141F94A317F1AB7DA5F6764860644CB8B8CCF854232100F7CE1162151BDDBBDDD7E55EFC3818D1C1' +
        '50368ABDF83430F5B40F3DE16408658C074DDE1F97E196C3A576FBC4E0D563ACD1FB973C5420B600ABFC32343B0E6FCB57FFD07F0634AF58C029963B05306C2D' +
        '897177ADB4783869A21BC4ACB3E1344E43130739C1ECD163432D4F2A5512EE4316E058F224699CA0A7C38AA4232F4A3BA749FAC83EE491D0B7B3864BED7AFAD1' +
        'EBC998BF392AF80A89ED38C47532AB808CED404503D7A8FD94545C6314B01738C61294EBB69A0DB4775CB9F12D8246AB3657FC3288286CE2C513892CB75BB962' +
        '2715BDE4964613F584881BACD80B738EA9068A413E596BAF58C9C169B2246C1D7AD7B856FCF6BC75947B0E5E91C4F58BAA404FF4D8DFFEA1F65DEFAC8F7F84B9' +
        '9D0B999A1E38BF5D2ABDD7365D83C99C9AD2CAC2C0077974416FBFEA537653B57FAB977EBA2A325AA18B682BF2642C1AE828F7664E589ACF18FAA5574C8A4AA1' +
        '1D2AC1D4EFBB17FB91EA89FB07B69F1B533B88585556FDFCF76EF5FE01382D7FE8DFEDE425DA42F21DC6F35F531D384CE0D11C9AF003D6B04634184B7DB25CC2' +
        '4223E37D82343C074F0DE422147750CB1D317273839443A562561BBE83EC36DDC0D30604B998322644B71F1EF902EC2330240CB079C4C5655E9DCF46B73E8D57' +
        '955FA7610E9258D57372E5FC3E7169D240875C015DE95B6401E3EAF2D6DDD2928923084A59AE11E361140E4F520667346509E87D4976C74F6C8E412B4BECE6D0' +
        '7F12C38F3FC963CEDE3EF80A9B77B062CBC37065BEFE7CFF8EAF82384438A623F5093564FFC2E3F4A9F74110570193CFB533E622AABBA03753A3860A123F7B9E' +
        'DD2D4EEA52CE02A58E9700E0A9732CC704D270A4A70E1A89D62F5C7B1E3F7B87F989D181AB53334213D94CFCE82D375B05A9DC0DCAF299FA00E9C73A6B2FD0DE' +
        '9889728DF45EAD5D6F268E3694E47693CCDF7E69DF930D1E8E801006715305B19057712CFE25777B60F8AA73E583E5E90A8FAB19C2B8A48A855AB0590F7B66F8' +
        'E9194521F9FA2FF80E3F4A5CE59577725865D7F8A6C407853036A428F6A1BAD41583E7ED37B735B890BFEBFCDDE68F35166442A5184C58A73914436636F70C4D' +
        'AFB9250EC27B8E3F2D85C9D237A92A6FB25C8257D455A502689AB04F960E9156006C063B2D13E93A67A155649CF4E4C0E7FB7205B16470116C81FD83AA2B2C0F' +
        'FFAA357643FDE9E19CA1E93F160B6E3E346A97A9912CA98CF882499530308ECC2022923821BC9079657A39F83CF8157188D1117C1BB087D25E29B467E2A7CC1A' +
        'E2BC7866B570CDB419F3C7916A4320540B7851AE040304C27C286E05B57073C2BDF5BC7654AAF148181CCE1CC4484150AA69FD163208BE6797F58B3524D38F37' +
        '72AD876BCD11DBD1DC0842AB1212C639E0D7F996C9E7D667E3A5C634E0095B4A53C95802F16AEF14E23BDAC52F164A5373DF419D5F82D076BFD8D0027FCD0094' +
        'D6E1D6710B03FBD939346CAF53E7C39A99A2611F3021C05820B9DFBB64A83D267A4B02301ADA26C4D1497EF2CA26D505E3C20203A2236E195484E2DF78184D58' +
        '496DAE507625EE19FC125CD0D8830D093320F7E672E6184A9B4E83A2B73F2F891DA0E046F50965D8B9688EE607C9AFC7BA2D12C95FC32E817487B30C27F9F8C4' +
        '30F4DD8D542D73A3C4DBF1B108C7133CEC39189CB7FC4047466615412757A6F1A9E24F5B3C8C20EEEA009C2FF4D475B1CF3D9BBD8B94794C4C081CF26F2B0D4E' +
        '99FAD60318398EA843798D834049DB3A7B5E0B0E35B34471151294C81389028770ADCC37340E0CA587B5CD6EA0997B3AB5E97AD7CA51C664435A5AD372C60558' +
        '7A7DF3B8AD911FA9A5F2297815C64682A041515A783ED05876166CD720E8159165A23D413F315F24BAC88D734AC124A5D7E39F131711FC75A96886EE84FBEA8E' +
        'FD628DAB065EB21521370FAC9385B513F2A4F28ABEF543A60429562E742E80CAC3A6DA8943CBC0F96C6ED0AB4797259A80BAEC9F191563965D281003143004B5' +
        'C2269AF7984C49476D50D8333703C0E52E7D7B97ADF24FAD5D6842670A1B932361B69287E9B30D46DEC2CE40558C4CD9E9719FAA5F83A05358F3B5B0FF5F84F0' +
        '6ACC35E538788BBA9C9DA9A66D806B382140101682D97D180F3B3B39188B21191E78E72B9FD40A2523D6E07E5DDCC126EB95C917A7649BAF4F2798765F0618F2' +
        '23A0CA118AB7C1F9F2581E8ADE444F84819FD8755E1BEDE8133D4CCC66FC5C251E9BF18B63E5694B7B4B176E60B30FA660C4405794164DF3C0DEAC1FC0AA6355' +
        'BC49B1ACFA14B1F6F686A650993D67F2EF19C3E042E999424D3C6AA2D2E19275A1B3BB888F90E4DC6E2124A77E3BEA649E1C9170CD7DBE144527DB01ABB651B8' +
        '727475D591E461F06DD88F65459F3B1EADC7C69C51AEE24467BEA3D5D0E296F6D600000000000000000000000000000000000000000000000000000000000000' +
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
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
        '000000000000000000000000000000000000000000000000000000000000000000D2F05571E60AFE3F370FF2159153C047E2F5C035E7A8BD6686B555AEF0DFCE' +
        '86AA69390CD32E169F55F96597BAE115E77AFAE1071CC38C7B309967637E5F90FBE769B8E0371ED81DE06234EFB8199FD896B57FED889D81399BEBDE087B4921' +
        '2B9D0D7FBAA9B27D5CB6ED9EFFDA1D08CD08A078C768CE4842858109B665393F15E308EC658691B43D3EF2A33F08128E61D813D5B88654BC1857223394E40E57' +
        'C87CB355959EC052EFF8C55C2E0504DAA143508D1E725A6FBD6A7489726464B0110C0C519914278A4FC3278F33D0AF91B57D24E2D5FED9916AB6A36CFFB7A5CA' +
        '36D97F4EDE8EEAEDFEBF0E122239008AF335E6432E699DD08B1B4F4CC38F950741B3D4D153EC616ECAFA6617A613FDAA392DBC8A4705654E97591FC0CA754900' +
        'A1C92DD81C24F89A5588D4728F0AB4426A08C7A88AA0027F4E69C5B9E4FEA2B7A4B1CC78A76342F6D3A2051902393D1123D4A9D8B3ACA1AB991D6C504FB43F82' +
        '56D66B76976C400E83E330BB63CB11DFBF6968D9D98A3E975B426CF14611139854DACE27604F0CC7593E805ACA2F652C9EBDEC4C7E20B173ECCBB2EEF4B4DA6B' +
        '8C73C9728FB8115CEC8FA41786F358B8A798F124EAFC65BE62F5A66B15D8DADE3D44B3CA0BDEB53E9D027494C338FED278C4FF5B1C1C56C7011033D27D3B855A' +
        '6C20C928349119514001E189F166EBA1DDDE3E746A353A4953CBC3D9810E495096AF77BAB20454634D9EDD99BE7205AE30CE112BBF53EE4E56CC4F67BEAB2712' +
        '51E233548488B09FAFACC657176A64B9090BD81D0F88C3C4FCB36519EB3FF07DEBEA06BF5E1AA334B70F4D0113B286EE3D5477CF25B40C4A96D040C04132B4F9' +
        'C165057EC1362EF78C0852737EDC2455CF3EE3512BA872E29DEF27477A65F2FB07A1F444DC8790B808916CB3C318D78DE3E71291CAAF9DEAA3CBB2E6FB32AD2F' +
        '94264833A794621FA5C980B0DA54185FE1528ADEA4AACAA7479ED1537E78789032265E2959578995340263636DE1FE9161C7900740211381662FF50864F51F48' +
        'F5056CA86E827050F597B59A9118A9751136B60E18D70548DD5FC0A2C55E631117A962A7D3B0321794317BE4ABBD513311EE27F9422C563125DADBFC868F3691' +
        '0AFDD1758BA0C0381F1F698793F6F1E387914906BFBD3727C95B639D5B6201AE32AFDAF5C6E9C336990CC1ADC0BF9D0C30B042E63423BE50FE5A38641CC722A9' +
        'DB2E5A314F43A724FBF0B283F00F7EEF3EB00398DB6D79CCFCFABD49BB596C00325857AE6081CD3046FBEBFD030A01C2F81BCB04513E0C0F01E33C0E65543630' +
        '7609CF54B0E9A4A8EFA93234FCD76D6AAE66D39B5204FAA903FB76AEAA544EDE627EB61DE2589B0393913828114870A9E11D14CD6EECD84C180A0BDAFE3B84C5' +
        'FD246E9DD82EA6A6855ADCCC9C9DF485FFF0F0521489D555A3AC4D8F06F9EC93D87C9D1B81EE9D4EE1B776E2FD80B622C8ABB318DB59A0A60B4F908F279E0468' +
        'B7B643D918F331839D13FB1CBE5894BC98F63CAF84490A5AD66929B8F28C05D35912E8A9CB2072E9959AD6B74862B0D68A3BF63DAB542A65026A0DB85FAC452A' +
        '9A05CBE50B2460645ABED4493FE87ADCB0FBC3F291E5041939E8CFA45FA1A164715C71EC803675A6C9B6B8C45F4490A33A7F534A00D5FCDB94B596BD819F44AE' +
        'D56EFA0D8EF871E43225E7D95D555BFD559C96306849186A31F92E2037F4126B5987FB9BABB0261D468E2EE135DD0E6E5D887F5F503EDAAC3D540F6842B92C19' +
        '31B36DDD6B3163020F3553F4C2C737AF3AAA7FC39BB394F61C15B921CD450753B7A8C0A5AE6F6F5F89CBAA8AE398E8582D1257583A91045370F89163953F46BC' +
        '1729882014E9A19F5BF4DFA36F6D4D33A4B96BFCBD8EAF1BAC79267ABAC8438728C61B55988BAC0644F21486756BD29DDB16F21CB5C73DF65DBED36EEBD49146' +
        '7A7E0915C36DB01A6AB8D958523E55EAE35996AFDF6E08DF4A2D91E01C00F28342266B30A749B1493FD008FDCE441729B0EAA2C5D36E566282DFD3F6627BA592' +
        '5BE670C536CEC11DB3C83E804258E8BBB9E6584576AB11EE2D9DDB79263A2CF4DC53AD3EF5417C97D32549256449C66D25F3B4BDC5DE5E2386AFF4D8A8D6AF3B' +
        'F850669834F7487B90B94470E93B3BEA96867D55A1114ED972C5301A66FED6D1E32973494657EE2824D6B0DAB4C0A3F8AB9A819924F92287CCE0B20F942F261A' +
        '230C82CC227556A3FDF641EA4FDD09F0A226A1EBFE2EA5CEC3508943D7758ECFB90B3BB4659F5A5EA59CAB9E9B93ED15AA1412F0E3F420F6BAC99B02F4579E81' +
        '47252162FB534E7AB2350F33DE303816BAD4F89C346C51FA4EE2EFD0D915F9C4460E3E9C46E96752FC074E48C9C979CE98BF168CB7E7D3ED8A537528697E5CAF' +
        '18FB630E8BD1842E8F2F89F2184CD0E82F4B3C40E6ECF5C6ABFAD22A352253B89137C83DFE0E5E39EF482E61A22564C5E431A4BF611975247E841F3E143F7BF1' +
        'A984FE34715039047EA6AF04FC69C051FE647EB9FB1F779F3B7ACE61181B6B7A8BCF1A87A4935A0DA47E101BD9B251FA1BFD7CB36321E3C253987180B72CB8B4' +
        '0FD48CC6EC26F3F969FE275D16B15ADC8B5E3D38D34CB2C3C1697971A5BD6A52E61C0C25DC664D5A0A0D924342C2B38C05B6F831463A04B5EF9B140369816769' +
        '40CDCF4A39CF1D9A27A888D4F6AAA22B5AB47E6EF86B6266253ED1E4253ED9E9AE540C6E7267036E97B0D215550E0A81E4BB307953605B4EF33AD96C75BAC4B7' +
        'DC9A8F19A8A98BBB4C3CB0972B8DE044981E4FE3BDB642164169F6DD8A907A403DAD5A64DDD28957ADD393EAADD81EC5403C8F0FAAA8F2ED1D10D37E32674794' +
        '4B93B3D5B29549F948335D5D4A7565387DF58BD2CC1F395555078A755C13C77BBE53364D69E73CB2CB27837A65B378EFA6A2B88DCAD8404471FB05CDE2AF9D9C' +
        'B569A3713B98981040332F6B284543D1CC8C16FF417100501ECA4458059B36A07613213284BD2A7E9A7CF44F99012A231A7467B6E9CD5478BD2C9B9DB44F8111' +
        '63D4635882442B1DAD5BC41E6AABB649AA4617C73D4A9452CCC8443D65FA31A5639F2C6E3B7A526CE9161B2C275B86BBBE77A86BBEF4314BEDC01188247997B9' +
        '22BD3EDCDA9823C0764423B226A0F962A9E56FDE124691721F0D4E822660CEBE5B75B61A55A91D4032F04FE5892B4790BD52390C74F0AA6BFFB115FE92806BB0' +
        'FD41D5FD05F0916103CDA245BC1B1605C7E13DE50D5BCDFC559589CEFE3CA11D6A3136477B42F4CE12A24FC7FE7685721C756D945785E9DB57ECFB0607789302' +
        'B23F1A8EFB7F1F15232DFEEF2FD363DF0209DF227953C0283D46F25D9DC02C4EC1977735351CFDC578FACBDBBEDD4BEBA2D614574CA19A995BD70EFFE6B5D894' +
        'C9E034A915D09040D0996720001B6C575CD0CEC8567365CC8A1308D0A73F69D15E721CB26A4F4EA32413E6B015B1B9245E92AFB79994DF69E0932D4648F98C7C' +
        '81F6AC6CA9166985740751DC164AC3FBF2A1F85AEB20738077315097EBF0810D300C22FCD4639ED53FE7B4487F7174D133DCD9EAECF9096397C1D59B0BE705AC' +
        '5912AC75A755C02C4C8A3DD48991D464913FABD9C8142A8D73A90B6A0F99AB34E2B0063EB83BCD1FCEEAA1EECF29E44BD66079055B45F5B9712DE0ADCBB6605C' +
        'E607CD339F2D8D8521BC886661D1E799CEBA2741AD85C17FC6EFE58D122FDDBE7C9D19F6A95F5E69F84693B9C90A62982E3286876A96A0AE1946818297F87CCB' +
        '9035BAA1B5BE2800F311A769A84A0552214BEF9F3C209CD87BEFBD66F536C1FE55FF41695D8C2C63A17DBEB5532279BA5273756C7BE8B5F692049711CF11B275' +
        'A75307502C81BD34ED0A8EDD8A3D436341F11D6884E03C1D8F45469E09D06F0302AED7DCA945D607CC88BDB52759E3E15594847819EF396A235AC4C248DA9C28' +
        '10C18F3A65744308747157B9C3B4519AEC49590CACFA3B7FE9A3939A5C2CC71389085DB156F67E376A96E28B94C02A8B7FCD8DAE4DE3DE4BA6CB7C1D57DDA0D0' +
        'EE42696BC1EEBA638F84496D7D1DA2229AB2164DE555D7AD6AEBD9DE24759F6768ED44D1B2FEC1561A2F6AB10C25C3A73ED51853B61265065DACA23F59B4DD04' +
        '184080EF611306DB3232808F60EC2D600F866C9817D76C7FC76A72014ECEA5AFBC27ECC0B7E976877D4E12CED56EBBB5C3946492A3ABE5227DF2BB699796833E' +
        '9E44C1F898537927624016DDCFED9839895CAC4044D5F183A98C1FF6350EAD1FEEB09C3DB3833DBE86E542F25E64838EFF8D472A27B4047956A4136208F6AA1C' +
        'F1139D774B90FADD0A683D538AB9C7D7C8C96535FB5B743C879BF902A93D48408E94BAC972203D6EA84D7DFB0172779B11A8C75E10FA60B0191199A182287021' +
        '699ACE0DA6F8FB5FC12177275F2524A767168DF7741152DE339CE00048433FCD787FD4EEBCE3CCE11F36A5B9A2CAE34FD0E811EA3D823F4DD13DB970DF597D0C' +
        '4B24D0EE9896C9ED7ADB501EEF9F323D3431491AC8BB357EDCF950D7DE5CDE04387D3DA581346772AB28FFFF001D104B32BD6AEC4F7990A9233099B508140542' +
        '5FA6B73886AA2A8FAECA0726F07C49E46CB60F7973C6523F945300ED7ED59770603D09FE5A1743C3FD9D927D0478B75C9327FE016103CABC9CA67BC7C9ED08F6' +
        '57C4CC470484EB45E410512E47710B41D368F12FBBFFC2265981EFCC6481F3A42FDDE4E9F7A1DBF20916F9724B6BFAE950AE4717F48407749DEADA4BA08DC009' +
        '8664B329A95CB7B4F9122FEE1809186E4ACAED49D3614D60697036DDC3C5CEF8FFE2939B282BF59A180D1CC43642D15A3E76BA42F6F8E5E437A9E20DA99EE8B8' +
        '99808199EA47FABA6AE880C9B083AB8180D6168279CFE652057BA5C8874A50190494375449406C9922AE29E66FC9BD1054482B760EC23AF002289B0457540CD4' +
        '07C63547422106F126309EAF7D345D6F65BC3E04CFCB291F9FEF1E8925153F401BCD8712B9FC2AEBC1DA62D66A44C1301C5FA3474074DD5ED9E361302A7173C4' +
        '0026316CF4488462D1618658696C3C11A49A33B869318AF3EC6EE367C377350CD14F26BAAC7600BA2C3A27E1F4A01F5589D29162373880E7151FE12724BB3745' +
        '34CB3B8E9238BE089D59F07CDE11F1A885D18240A460B34B549298BAFD68C3B36BC5A8F88A5BE38C0099A99FF03AA3600A080D4B17BAD115B235D50757FB99DE' +
        'B9B48D5A3984B4C68735BEF31906E84B400895AD3A4F2F3CF9B14AAE907734A53ED71BE5377839A638E8F67B5CA1E588205ECB7B06727AC6A07DD697F54868F2' +
        '0DF3C374E6F5B547496C24347C823120C6995F4A829F3936E1E26967283FBC8BECBCECEDE9635BDCAE251BB27F5C11FB99290D21B9E50B2155E584A575EEDCD3' +
        '4C8338390B3C4443BA31E805261024F5E767AC0B397F0720E64E479080DA8D44217A197691A9D5AF1B4F2EBF96CAB156D82DF72D82A2B081B2973E53E2D3B818' +
        'AD5BF2950851CBDA3B02915A6B325BC4A3F554FF141BC050893D31DC2F56E398CDF5DB8129EB88C6EDAF82ED138E4E8B92A54145595C9926FDFACC2542C79F17' +
        'B26124B2AD617B79F6CB5256FB6ACE4AF4F304F2CCB9D1033B4D353AD2D82C023778268C2F66CDC451C736C08EE251C95E0939FAAF70BAC8F879CA4FF6A45D16' +
        '02600CBF0CFDEF64151502E2E58EAE62419C4511D144CA7DCAE435C8D44DD9AB8CCE5C2129E26C7A088C6B0830DE34060BB2E4CFA8F6F781EDAD6D3672F462ED' +
        '53B6427D7BDCFC98F75516BD8F82FB8DE09CE30E4A7842392DD567F8B9BEE887B5DD877A50E382CDAC5545B31B2DB68DE639E3C805E73224840248331E62095E' +
        '2B81EE1EFD425B96EBA1076D0EFDDC322D68AA1A9BAE4D79052F3A60122331E601C24EC8AB8034FDECF3799D254ADA92C470027571C4AEAFDDB6568A01E04CC6' +
        '2D6373F76A29187B2490B8B5E26656F9B5A04AC0E59906C290669900176B43B838CCEA6CCD8848D2324F03FD97FF816C612FE3EB47B3813FB5A279AED164905C' +
        '8B88D87589212ADB23ED757B14DECDBFC1B7F17A56B59885A4D66EA229CB7B47291262F8DB577CE637ADDE226916D6ACBBE16DB99FABC0050D8CF7F2EAC10899' +
        '02F3ACC11AAA30267C200899EF65A505137E338F547CF963F823C89AC9F3DC3D16D061198E243942CCAA30B98C8A119E9C986C8CCED98B17C6BEB1463C556555' +
        'B6B7F22796BD5F8564D0B03BCD17F8D3285D27E2473FCD82006EC44EE89476A07E98FF66DD9404B19357D24C587F62D64BB1188E5530B7132F07B8166CEB720A' +
        '2AABA3C0A873774EFB376ED24559187A758DD787D09B8E65911C383DC7E7F6FF0868FFF996A800F6CC4ED443A68FBC4177DA21234E297DFA74543BC67F18BE9C' +
        '9BF95A0AB00BC2223EC7BDDEAB4D003FE92E2040A8E70F97CD6DF7D2D79B2E1025D42D0D1661EE5BC97B1DCF148A19C691F2DD3429F872A838A200005E1AA5D5' +
        'CAAA642249B3DA4D162262F7C8015A33A1CEB8978F6CDBB401EC367CA7A47E559BBF0219926F319AF6D35363D2B62566B36D6F67AD7D72B84CC261BA6521ECDE' +
        '3C14E55244EEF7D6F9F16B42603DDA8968F7F096BDB3C8AD21DAB75866E75AADB9595BD9DF21B1F562D57A399C2B05EC52603CFB156FE8A57422B2D7A6BF34A8' +
        '00121D83582BCA6C6E115DA6198E17E37F8D0AE3D9B593CA3DCFBBE102948C9D7955B8762042BC2367B9938FB46A93E485889E420BBAAB9ED5B790FEF5B4C61F' +
        '09C935F7C6ABB3983A386EEB3ED0D5F4276186A98391CA62DB40715F2604D8BB9E240FEF66299FA03D5A2A9643F5039872A1183915823049E8873B75EE2CB9B7' +
        'FAA42D66DF38C7062C85AC20D41A4D3A0B2C54F1E1CADDD4860BF1598962B8B0316FD1F5844C0120DA93D66C0004BF0AA843BC600F7825A41885508482700032' +
        'F976D5494E29E63BC8F08CD1CA6CFA1DFF707F88B3B44796D569A3F7B940264ECE39C56CD634913D85024269DAFA299A824D8BC2B4CB9A017FE89FCE362C0748' +
        '13157E6165D58149AE920C48014D81BA07D9683E7B82561BC5CC3D8516FE1A9498CD3AAAFF22DC20504FB0C973E2D297770CB3CC073BC239720B7F7C5B57EE2D' +
        '6F5B07EEC8B7048B2EB6E9576459D08F1FED9B2FAB5C088FB312C6E15410224600BE0349008D51CFD46897141CED9657B8F8BB4772C67020A077B7C5142D7D9A' +
        '7D44F1BD312EBD256358D95F1F6A34176033E4E6B907D9BF315CEC9E404CEBD5D37C86216655DD1C65BA5840DC95CED1C72C335197A5036E547E12E0A2E6E393' +
        '6A5185BEFFD4E9355B5A47802BCEB731727602D6B49CB4284820B7A04B416D9F7B51453B53BC7D8E0A808443333531643C7A2536906F10E006EED1BB2EFD8755' +
        '7C15009045EE64BEED3EF00DE5DCB55635DE31A7CB316884719BBFB5C49534EA88336CE4E261FBEB6F18915DC6B90AFFF53DE0FADE0EF4DACB940AD1DE245E14' +
        'F57258A605DD6ADDD2130D77B32B901B8C60B8C3BCB380C45FB08430F19695F832AFAD8DCF0F2FAC8657A70AC3DA89A8B8F657FB17B4D36CABFCC17185500CA1' +
        '63D57AC8F8A50BEF219D8C414EFF88D9BD9C42D65AAB9A1B2D275BFC30DF0749D1763340038F71FCA47C3C1A9617EFE7E5E2E1444F5ADBBD80521441999A0C55' +
        '18B25532DAEF46C98F47DABB63D39F423EFA31608BE8D85CF0CE14908A05515E68B518CD92CC71F6C9013CB1ED61957B5D89CF57E0F5BDCF6D5407F6DABDA259' +
        '6EA1E5B94FBEBCE771CD24EAE70891A31BB6E362373C40E955E7D74CFB46AEEF777083F9A822CDB6D4BB189A367356337CDEB2E400551B2D741B7B8B2CF5D4F0' +
        '2D6CE26D1D630131F0993EF535267D23859758605F4075275056C023D7C1697142839B830345814E0E7E68BAB0B99CA78BF292A1ED0ECCA61DD336107B99CE7F' +
        '2C4EC0A684D8BBA1E3E81A9D8A7A466FA2798AA06A10FF75500E973C8FEDE966C59C1C9BDEE05B2E2C305D22B980C88234A79055F7D2AE73FBD7AF38C04C3645' +
        '244C6548F031D77DCBA4B7539D7DFAA99BE9FA36E152DBB0D72ED87C4D499034B6BE253634C2982501B6268AF974AEC19C36E8E79ADD991C2A0219604434B064' +
        'E2B676D61BD36DC194542A86965C4E6E2B7FADDE02AF05C07535362F1BD86AA96F113B02193C1A9B2006B5EB7A9BD54C26B6D063542AEF0845EF022BF5BABB3B' +
        '6DD3420FCD2944331C933AAAA1867F2DC57BB9485EB452B8E100D8DEB66042CAEB87F967B1B4905F97A33BBD1B88EACEE86CCA144C178F20352203AD9344B064' +
        '68B15AF5C405D5A073BD025BFD4A15BEF607C352BF1D8C69B2ABAB7C39EA2C147ADB838729A4486414A4478DC89C9B7E26577020D956B5567B3828AEA9C09404' +
        'CD670217BFEEB14E7B42BC91AB562FAFB6922A922DE3E5AB5E10ED9E09CDFB907B0F1FB84DAB6D0153C925C10094336F33C38779622CAEF2A255FE8C9FC7D3E3' +
        '1C770CBD721610D78C8F66F8FEC209B141D44526A79D62C71C21EC479D211AE34A6F490AB3E27D6EBE7EE3A8003415A5741B060C424484C2AF4ECAB23A303F06' +
        'B849AAA320B9822F664C36BD1C779E6671FF2EA3BD619ADAD040B8ACB6E4CC3EDB8CF512198BC878AA6A961A130F22E305B94512B6701894FB2B0270F6DC5881' +
        '44A1BC9EF0FEAD3CC722B10A9E6B2731581E592DD458B9830512314E5D1CC337D66F9067E7765F936CC3C02804BF127107FC23F26F75A3EC2ECAE683C303D505' +
        '3F03FD8796C58298B7432C65A3AD018F6500AC78427F11C65A0C6287F44E3BB5C73F77B08DCF4C802204A5459EB3A9697FEE7C616A3C6EEAEAFBBA5F4E40C66E' +
        '0E960B6B5546551629F0BF3474196CF2745904D37A1C523C2CFBAA8ACB7C24CA71CD6B5C63BAE2A9A080AD47BECB12EEDEEDBB949239CBACB03D47DB61DE3C44' +
        '3E187FF0407D8988CA420D3C68C86F4FDF3AB9B45059040D6CDF832620336C6967FE8A2D5193D5DDC956F4F2796C7E470226EC9727D97373C015A0D114DF6D2A' +
        '6E9DAD1470CABCF29CD96514B8C4F7C335145FFB94DE194ADF39919CFF82615CCE2F54B19ACCA1E1D517E8BE9B022BAB8C6AE8A55937294882D725A84CB6E545' +
        '43EC861475BC4D26351E4DB60CDF2469D79F526C29696C6BBAE0D89E7E1CB53A19152C9F58B2D83D9CB15253697247E1ADA191A11DFF30DA7B603EC33EC3A034' +
        '1F9BD8639CE12254A0195928722B42C1768902DE85AE21A0CFB895ADDC515175F8A20260F27BC508F0D3CBAAC7AC88CE5E1EEB667EC5ADDBFA1A67C409DC5450' +
        'A22C4EF173696A2FE16639F772ED08981B3BA91F1549AB3CC10E56D7B9D873E16D3C59E477A20A7AF591A0518D274339C8A9028424EC9DAB2EBA883AB542EC4D' +
        '26AE525EF3988C6DA05920A653A77228460D44EDC7D36B2EDD9276519EE0549101FD68F51726B3029C94FD8172873CF5DF971A5A017293FA1CC8DA0FD03AD824' +
        '3F98EDEA596AE7F75CF99D5AFABD98DAED01037863408BC86BD6C2AF0C3CF72B25CD1C3E11A0BE80B85D5A845B7A267FB6BD15ED53FD69D1F5F2C87B98DB6485' +
        'DBB88C6ABD8C44A46DADAAC7128EFE12549A795A8C10063CFF08F5191A56A0D212138ABBE72AB30098627AD21093512B8F30B664962A25F2212E536A4FDFBDF8' +
        '1FB645F7E42E0D86A6C58831869F0F17CDE83440C0AA01BD4ED160644FEA23DF8BCD44E807A77D9CD1E0D6074F5B007A6E15964767A24BECE2308274775D3D34' +
        '1AE697742A7E8818292F8683BF9D18822A72B43E11CF168964BBE803EB93C289FBDA1A7A1D33ADB7615C571500C7B7823F34BF9A7A78DAA13C77E3127190E31E' +
        'D2CE84F6D999F0D8961A4374130CE6983FCBA2A54EC8D1AE9EC16E292A880B31ACED35DE98D5F235CEF5BD71500C1D446A858451647F70CA02E8A4B75F550AC5' +
        '5618C83F35BAF20AE48F9D5F9C71992BC0332580C39F0949EFEF83A716D028D71A7307916A77C0E9DA216B836A7F95A9D5B26A283BB796061EAC57838A1C2001' +
        '429662900D6FD03678AF10AD198F2BECAC0DC3591895820EBD167E009D97BB85736F8E89093438D0A6BCD18996A830F4E4A585258824EF4E67785043F3053867' +
        'D00F31E6B78A30D02989BEFE278348721589EDD6E93787EE670203913725AF3E00A55CE1E6C4F76D6E7B0597D5F4DD327A22ECBAFC71D90FBA5335A6AEBE9A8C' +
        '3D9BB7992D3891C58EC03F98825F3D88D88F1F30EC269681ED63F1F7B6A6278AA34EA142FE36DC3092CC105556629C4983466AE8BBB2CA66F5CE88EBCB0CAB84' +
        '329CE7141A3CC9D2A65EA5A8E6BF1B91E134EA4BC16173C523C58A3123D4F9E7055AFF8D88784D45A51781CA9A02CBE2E15851E6F9EC7EC386CB436A017691AD' +
        'F190196218588EFF664286FA0F4D17543A7C191FE8B5426E8BD62DF5975BB48172296E6E4C9C7B683FA805966BE788AA6C36A0DC3E01F7C8BD189D39025CDD4A' +
        '06071A9A3E5779D400B13016ADAE6DBC0D3ED95250AD132B0894ABAF67744D43FB78EF111C3ECE056A50E46C33BF7ED010B5059D9D3462CAA481C89714C838CB' +
        '8AC8D37F62A9AC4195C045BB1AA3922533AD23490229A5D7C666DCEA6F7D00E66DB7B257BD77BBA9F43EA7E25062F34F91C6565AF5F9A642F4ACAF837A1261B6' +
        'ED6849599B860333855C2B071ACEFD2D774FBD90ADF9DEF5BE9C280B760198FC6CAD7107D8958BCDB8E4C3DF15FC9D68D5BF9E467955AAB1F733DB4EB919249E' +
        '80A823F51A8E65CA82F50953C551C05E9CCFAA387E25B139E22EC9AFB693A34AA04297849C2542ABAE8F8C81D38C9CE651AF7A460D91F2345F6CA2261510E350' +
        '009C76892F8157F15DB5F539E2860185ECA1D80FBED60FA40319D19AC36A16E0857B40E22EA889408DB825FF4C687A4434BD403FB21C00ED1D650F16849ECD0B' +
        '62EE56D1CFCC640E2100D8F731913A8721669CF8B4080B9D466D9A2601294BF3F06F33BE4FB7AC9EDDB8B01C48A40A7C10769CCDA7E9C319D7C8221D77A77853' +
        'E7D8D05B15419DFA0C8C19526F91A04B2C3493B15051D66BC8A466EF78001DBD4702037B9A4EA195A84FF7B325C0454C2E2A116C0E28E3555936BD8C4C486586' +
        '6DB4B618E5B8E99186A9154F72EE13A257C16CCF094A1DE5581313A84A5671F33062FEE3A8DD868D2EEC3D5FD696D08F1A53C007CC5834080C5973705A9ADDA9' +
        '4119FA5241744047A2D3A4871059B114D30B3F0A79C67C0FC18BCED7B5C6A043655CDB7493E9CB025B48F728C973F2C6C32EADEA4620DFC82B87BE972360C65A' +
        '110A629400E87542200ACC9B046F7F664D31D23505967AEFC714BEB78D785D4395DF5EF4012219241EA606894F907F096D3D7817E67B73467CEE3A8F70F47464' +
        '8DAD9C8F36BF56533F960AB9FBAB1AEA2A98E34A9F32B5736E181FFD556435A5ACB848716475BA2ACDE27410F9E66EE27F69D5E4240850FDE23EF85CC2965FD6' +
        '366027FB6311DDC5B65020C0D0E55BF0196D0A8DEA4AD1F12B786764D0BA444AA51A361D413300685DCC63C9BC71B2E498EFDFBAA1A52AA85C95D755131282A2' +
        'E29A49CF75259ECF039C8EE289B412C9A3145B55D66988E8389F089AC700D795E63344A8B297411FF3F5C57E8F42250783D511D99459B609350AC4F9C84CBBCC' +
        '6887065A47E59A3942402A8A030C82CA29CD11D702E73642BB6C59E1A490FC9B8B48FA1390D9B12C8FC46964B0D56377B46C86C653E8A151DD68CBA19978C86A' +
        '0A13BAF9B38E5A0101AABCD2560AE98D5394A1C3103F62D722293123BA15F9CDDA45370D1629AA4F33AB1B4F93CA2D78AF6F71DDCA9EA81D395F58D6669C28F8' +
        'FEF29525C8CD8D2143537C7CE0109721E550DEE15541E07B9FB5DC4C7F4A71A560316FBE1158EB718D2AFF75FB78975EF5DB0D8E6C8455E883B4D88BEA707532' +
        'D447BFD55C087ECDD989AF4EE403480EA9DE1A97C11A92314CAF007A9E2FCCD20B23B8240897FA54F3CD03057F59CC0C0A6DCC4E61A12C6291CECFAA0D2ED948' +
        '26F6C7549CA0D7A6E0D121263EDFCABA460BEB87E2B40BD04A95961CB51AA93C9463FF50C412F4E56539FCAE34E86A62F3A1119B0D2CAFCD652C7AE2A3066959' +
        '2126690BBCC9E9201ECA1F57A74C5A83EC72F80CC37D6393C690091E03BCA17CDFC751C1DB96290C501399B96452DECC9B5875BE433CB3D4B163E2E2C44F6FB6' +
        'A351E3E610BA982363CDEAC5016852E283355093AFDAF29768BFB7AA3E11585099DC48B3990E868394987637D48F231B4F7560290B66AFA5380FE215AF5A281E' +
        'B26E5B6E7849F7EAECD6797312D2198B59C203094205F0C0C8FD3911A0B205BB69F11E27EAC99112AA2FAF28FCF847CB18893FB0D6C30359CD6074F8890C1D35' +
        '2C098061628002F68D09817119748D7D1E9BF3451013910CAA67F8B719994AFBE81DDB660EF4F23CE4BE5CC87A5800EF6E3265762A1F7947C7B8EDCCE0AF741D' +
        '76BBA515B920FADBCEF4CAC0252B4A4DC80B07715BE9F782F88D2CB11ABDA3198EA7986A525028151229A47CD04644B34DED0D373DDA6279F940175AB236D8CA' +
        '70728D1C8FB57900BFC6D1362A50086AD6FC3AE8C045E8A6DC3598F90EF3655B4B054661D0B715B728F299DB669DDB39717759A713D16C5317288C10339DD37A' +
        '8FDF50A6A1190CF3540B36FD0ABF171D02F482A3FAFD716BAA3CA61893C6D40C10F7E40BD1703B2FA2D993048558B3A785E162D229BA214AE09E9C4C785CB0FA' +
        'B5ED6214E0670D1D562AE012A93BB5B425431D4054EF9D5B729969862DF9B5B48DF5F8E598A46F7CF643BBB02EBE6A3AE544BC747F10387D5D2AB1C9920856E9' +
        'D78475D5F127381445AE37890ADAC6651CE9AF83E6B9E1A28263EB46F11946CB1E591AD4E4D2E1F7EB5347C3FD29E61A3E5E02B72A0C89F5DDA6FAAD69B09191' +
        '7FDB37D37F63AD93D9711E103C539572AFC979F0C8610E193803F11F32E86FAD4077C9FAD4793AE61B0997249693FDDFBADA148EBEBEF14577C09742A176CB8D' +
        '5387E0A3DD78034F99D3E6E28CCBDF071D22206D3A4A349A43126197E7D1C7BC44E4AF4843477BAEFF2D7128E3B4E8E2398940AC46A329FE2E8D702DDA2AAD39' +
        '4F9ABEDC652DD8B4D4DA8ADFAFFB812154479EE1016D998452C3E0FC14A8531AE64608F693A373F5309671018452FC8A60A2700C4D925829F19697D8EE713152' +
        'E3ABE865B3ABD0D7FA24905EAB97CAD9D4FB6AF83186C8AFD50A8B59B1A27EE2EBF64F5D1B205A043F094EA29D703A293F4502E82AA96366C363CC6595C1E079' +
        'DE3596AE65884E782E1C3953D94218F9E9B703E43BE256FA974F036C62721A37ED7C08022F090A2876EC0F7304D388A43ED84ED959DD0062CCBA46BF492311C1' +
        'A96FD3767905FB3E7435AA6407EBC0E431C355DC65DC508C8048D44CC2F1755D7A2535115722334EE60AFD1E58E8B3381781780799279FD44E96386E78163640' +
        'F666DE0662B7E87BC2A15B3213E85A44E2E2D894203A5C281BE778BAAD063AB463953871C1880D246311041233B4964518225FE67DC7F759BD5A33EB766CE299' +
        'D89375CC748425BC50F86F007A2139CC327E19E3645998CF012736BD17631525D27D16D361A425260BC20842F0771F6C77F5D5E568DC002E8F8C9B2D6C3E126F' +
        'BB66CA4089C96F257A98C440945139D2364404F6AC8176C78AB0315BEE1138AB92BA58B073865C2F792692B7F178D18429DE58F901883B38ED32B56AC29F04AB' +
        'B32E68BBD667FF92A34245233A93F74113E54537803F8F6DF2BE71F90F8EAA22EE5BD0FA8E97F224D854ABA6975F3C37FC607B49C66B45A66261030199658A82' +
        '87FC128BDCCAB702471B9F1938096B32EBA8C19677F59142569FF4A127EEE81248B44E3FF0E9C64AD6F873173981FCDC0A084FE9B77D164D054CF806ED7525C6' +
        'B5B62A97399E01982C963683AE6CD65503A0682A6673C21FDA9D95D6F4D4CD77E27720B05EB4791190D8787BA63B272588F5DAD0748FB9572FCCFBC527628992' +
        '60D20425A09762CBDF86D47BFF0ACE201F2229346732CEA536FB9807002CC6ED06C0E5A9756771E53096B695E65E9382F195A6061311778AF7EA94CEBA5C8469' +
        '380061155CB1E37F50DCEFC558EBDBB1F23400BF986B7D96156C71F21FB557A3E0E58C65BA69E7C25EC625610A81E1572D5969257F42E5C98FD4C74077C3B77F' +
        'ADFB0F34613777D7960852AA3BEB2A9CF1EF1B353EC526325C816B5CDA22C26E4710C987E2BAD5903081C1C9F1CB454D76BF56851644054701361E03A05501A3' +
        '15B5261A0CC978BB098A75C6583BA4BF4B1672C90BB26A4F63653E0BD3FB6B2B138BA2C518256A2A825244A6D04EB70C8F1C83A29F4F3B44B421F3FA247DC188' +
        'DD0EAA64EFDA541058A1D207C239C8EA9584E3BACFDFE7650E93FF54B14BC4CA119200AC322C56F3D4EB3FABFE66C49C221387504B079F3FBDD83CDFF556B091' +
        '4881B7A45A46422C9E07733BB4DAE8BFCC19DBCC16D97D69CDBDECA2577854780350521D64F39EB936B3EA55957398AD39D52A5DBCE60414622E3CAF527A92A9' +
        'AAF1044AEF3437BD9D482DC06D31381743DF94E55CFF05B9DC9D204139BABD90CA864AB753750E5DDED9DB04C252B30798A8A3D4AA335ADEE67D29E2FF67A360' +
        '320FF272B6248A2A5A9BE8DB1C1FDE558B299A7C4D0DFAE101A21A95557A92A06F5749466F65A81F6FCF85E49A63760CA0B8F5AC1BF5C800D29FB2C09A926197' +
        '153C03E160D6AA7C22B1C9ADD6A04B689C7D5488865556DD28326267A3773E51A3D8E538160042B69D95DC74E3B58EEEFE52D55B65474A0CC4315FA6C40503E4' +
        'BC8380E821A0B653146DB8D97D6AEC54078C2A068CDAE64AF9AAFA2FEEB68786EC562BD2662358FBD1C037D94B71710E43CA3DE35487B4A73150D74EFE18770E' +
        '92BFCB97021AC99C0A70F0BE556C59E5C93AB9F96C982DA5B0C94B430F40C24790F6F761009DE49D539B1214EF970343959F4ACA8D25B4B472198408EF330E5D' +
        '1C9E5A2BE277DFB606148108922A076DE14AF106263F42F6717E3BEBF14EDA9D8F24553CDC7572707573CB460B79EC02393F9F33C568727633A0E71D39FD397F' +
        'B1F1F247328D5DFF78DE69C25CDE6D07DB6092296EA14D55626F089227BF1E510E854FAA0B12B2FD2A2EC3DCE0624F7739C09F72E5CAF31C3E8B641A92170FC0' +
        '0D9E7B93CC380268CD475AF7D4133865FE26DD2EEAC34B345A93A9F2714D0292C366214059752DF80220C741329F80989785E55E2ED46BDEA44BF1181916890B' +
        '37F901BBC949887819F5DF91A2A105C674B5E5A0871A2A28AF8D55C189D3A7C5C642904C00003DC562212C776828B47D48FBD20267AFB1ABBD007BF1FC4239D8' +
        '4DA17E500958C9D62A388316A3B18072E5FA37AD906EF9EC8DC0E951E49E498D968363CC9F129C1A03F5DF3473492F65D8BC95D55993171D336E11618ADFC8F6' +
        '366C073D611C96E11404BD8A657B3B3FFCB21BD21C5AFB92329FF63255DEA62C916FCDE94341433A9040D8365C2A02C628CDA912FA670FBA4F9862DC0D3D6361' +
        'A31806CA9A0FA5B159290DA8B0614BA0B5F8C091D711A56A173E8701046F58246793B2C10B25165C4E4F6F69B57DFC1C830F641A0134E658DABF2E47C771D21A' +
        'DD46CDA1E3066AF290340261AF74E9F60F4D0486268785046354017A052CFA925D1016E7C9FE2607145E8C37E39859AA5547454C443CEE55B7C48C508F4D6142' +
        '620BD4D09F66E808E423028F71A8A2AC210ECD2CC1E53BB5C9EDA3C292999E88E628514A345E33EE9F428E5A19F0B6E73508B1A2581815D1F4E2A0206DCEFB3D' +
        'A46C34CA935A7C4C86D15317F593422A60E052F20AE0BC1DD30F736C46B1A40103B413C8F5A915013195C9C603D62E519B00017B66EAB4D427DCBE5B2CF7262D' +
        '5100BD31AA0E2CAB9AB4092CF7CC6A66ADAAECAAE0C433E5B0B3A85FB055E31FA364CE74C232239343818B2F719F24A2068AA29CF50198A14253EDFBD0360231' +
        '34A9E41ECC827F544EC0B2A9DB2513AA458A1D57A8E10988B2A7890C313C4FBC4FDAFA3E50EC5EE006B2A320120DC99A0F99534FBF15CD01E47EE41F68C81AC3' +
        'D1C56DB51ABAC96FEED937AB36EA01B4B25945C1111AC6AE5A17840EBD6E38B6BD4B0083D23944B343E0712EF344C3FE7197EDEF628B769704A4A29BFB7786AB' +
        '4E85C393B7D27B9AAFBC8EB30E9797A9B42494CC533B83DFBE6B48602FBFF3163655E1CDA49C2437BC5BA2C1DAB8D2166F09A70A3FE4577C1EDCB87FF9EFA462' +
        'D91ACD5152B11A0CD05BDC8A95AF78B0D3F5AE9FC32F828CFEA152B408C1C417286B99A446230F19A4349045B5B9002F0059A7CCCF961AEA72BEF98AD146BB2E' +
        '1953E3C0DAC52252376439E6BDB16843F6AD65C207686A56CF49319452954763FE28BB394EE18482055E6E18C5A8005CC71B87C388B40EB5CC338DF8CB123421' +
        'D8E6435B88A8282BA213B6D8419E12B5C0E6F0E2FDA3AC0AD84BB53A9C6885A820D640DFA9406E6C417E21B96EA43FD33C9A3C7C3F4F761A800FF54E8FFBD308' +
        '6958AEF86CE18B80ADC5193DA8CB8AC12B42031FCA4F2C89098AE4F5C27ECAF1FAEC0FD114C23F9D5B12375DF033A11223AB6092543CFAAC5DC055A3E01B6952' +
        '4DF63ADC0E821EFE90234B5A4299080EB30091D0C17AA12D19E156659242ABC7D54E8A4E33A0B3060408B75859840DFD5711FCA69FC114D1258ADB47677A82CB' +
        'C6B2F2FE52C054F25602DAF7CE084BB6664CBB0E2407559B4FC2D0F109280166F1B0E1FA59C0AF4A30F3A0B659DF0084F1807073010988791FED23944ABD24BE' +
        '4FF98BD46ECDA48CA21CBF9935CBB7AA7D527B9218509E60CB822279C771B74DB8905031847C6D8CC82036FEC2870CF3EBB497344048F35F16AF0B41A7B3FDEB' +
        'A6AEE7CBD82B53F5AFDFF83B107488B275D15DFEDB88814898DC567530982F7D254D085E88D4149883F34146766745926E5549B848D499A38D8037473E16CCB1' +
        'E12A7EA11F83366D2F0E7993E50BE5729AA28A007AD103749CDF30391A0D2521AFFC8318409CBCCA339DED53245D96BF058320E065138A7A7726E8CE271AD61D' +
        'AD437F8F214E6EC63F7B20BAD27ABC1C860B03CFC6713A47AF2089A6941F71B0B3A5C31B429E32CE8257E0C7BDAB28FEE07CC82E66F95B587906194C41B8A188' +
        '8054455CE107E8E853EB16957B7DAF80CB27B0E1793A405A2F0E1D30AAE10BEC89956A21A29161F24211CB1257E8B5C5BF2F2F947C900D7C00CB0179C7DEAF0B' +
        '824455D3A4D96964E1E6273F4335E20023975A40456BC5697B332C5ACFEAB25AABB63B8FE9C4CD05E4247136B22F82DA32A059691F2B19E1FA3A3F4625947745' +
        'B0F682683AA1170636958E8BC4189FA4F68D4A22444E453A7783C9BBC801E10DB675E97A69776D27B124646F54A504B7296198B773EE693E97A3468348E2E6D3' +
        'BED618328D7992202AA2FBF88A548A26C1448E7861C4239F333003FE83FBECF218B499F67C6E118DB1AFDED03E0C135D8D1C30C9F18D3654BED9536F3CEFB8B0' +
        '9050B5C5EBDABBBAD80E7FC36E9C16BE85F28BE8974BE88322080B60B63D74F08FC8A921B0F5F885F9C3F3C1B0D182F786B78DEA2F04624E5B3FE07B88A0295C' +
        '49A0F0A66727A5902A5BA99C9EB8230EF0AA828E5D00D79AEF6755DC4D92F885A19AFB5882E06028EFB16E2E9B0A8FBBB4AD5D29D63D186A68E6717A02AB245E' +
        '159F9A10F41822BF2225FA41BD32A7C93D206B81A7F563AE6A59EA991884785FD7BBEEC47F07580169B3762B03BEF320323C1D2ED3315860FE66E4CB713BB396' +
        '9F3D9985580C80FE6F5B085AC75C83D2783688A1D34FBBCEAC601FBC59871D7475F7E911ED809BD0CDA609BEBAA6F700C6141DC96B190E6BF25D5E5A8AE8E714' +
        '607BBD354BEC636BBC8A6E85573307B9B708B26C8CA9C822396C060EF51A00F31E6024420A1B2DE483CA107210D6A2A999F04FC53226E0BB8B3273A684AC55D6' +
        '95A31372D92B67395FE8477F018AA3AB130997F4FF5432A5FB0421D44AF8330C9D46BFDE39A7CF5CDD66BEEBA89B8D9F44EE001CEB180936C036752A1053EC05' +
        '7521547F9284C5221C12B2F804F8701B364AEBBD8BF2289D4BC67434C50CB6ABA531758D67F075FA0CDB850162A1500330346291DB6240D2ACD3583970DF1400' +
        '03E1AB3F507DE0D9A03048E626BDC32FDE292C162253B4528900D55EF9942B5A9FB8E033A466332CC1479DCBC041F9D5F61F09F36D3633FC0E12246AF3A6A526' +
        '7FBC857218906A2E42C9E85458FC7DF59F1B55C19F91EF05EA74843F2A1CEF036F701C96A5A22026E363EC547AE0BE7142AD8310BC48F767F1FC7E35A5BB28AB' +
        'AB878D86F14B582BCD97D0C17829CBA3A4AAF1430828ED0E1B278FECA878755F75BE01EAEC09E16067829C4CB8B1F4DA5EE41D88578DA8813584A8EF9DD45CDB' +
        'BED5CBBAC0354D625F025B39E887D4950644592F2A6CF871E123918839F8EDC4C0E9DEAE04AFC5853323D62E28D96FC64608BF639ECA3AF1CC10DDE1CF870766' +
        '89F8D54F567954D85123BF4EADE23E9299C110F84176AF0298C958A9F3135A6C07D43311ABA0DECD51AC3D9F8BAA2DBF3F94474D365E2BC863E7E611BEC2A659' +
        'D41E4F8C0254BBE08017A29552CD8AFAEBDC07865516DA99ABE4D0E5ACE3505A7DA16A2AE95CBC682ABEE593F421F1343E1B391CDF33C2D3589ADFD9A5994F50' +
        'E12AF416B08C3980616F5D5137E23080C4D1704666FF250AF3CB264356FF3411B9D4991B6E45146E7CC48C5AAA05DA10604A34A39E0545E92C76CB711E3FEAAE' +
        '912BA0B55B54110DA7E0D60434A21C11A68FE8A570563EC375587F35DD33BBD80ED459196AE803039B0EBF6D22E00DDD028460F444E3F397309FFB63E8A3100E' +
        '2B8EEBA3134FC524B343D469E717D5ABAF3488C7353ACF96D99983B2AD169A002E54C03D13E5E704B80ECF741D5F726A9A53F9A53B8029C566B2D36597794353' +
        '1BC1E32DB0844598966681C6B67E1D9EBB99971F604CBBBC7C7F08C64C7B908287A35D26E4A30F57E3D1C6A8A93B43CEF79EEEFA60F4C0D4351745C3CFE71742' +
        '8ADADB5EC4C92D9E03DC322F19EE74A0A660590F81790971E971DDD35EE56FA56C32DBBD58196E97045806465F0DF5F31A6CA7F42C912CF6995384049B690C69' +
        'CE27898E8D8496D705D86E2E8929457C4BDBB82E122068E721C8D54CC0CAE8B4FBCF5A24AB64CF32EBBE37CC8945C4E103DFB41F665A9126E249D2066A29F2F2' +
        'EAAC98E61B3CF6B5644BB171EA095396CD969BDAE248A99636B4CE89EAA98FAC524D9A1BB5B9CB37391A00D483590E073A0317051849CEAF0455664E66C35FBC' +
        '68D16D920A9EA17D3945636180CAB5A6D99DE30E8A207F109C208EC7C4B064BFE1A98605D22161FAD72E13AB29DA86200DB2761763DEBB3DDBCF17BE6634838E' +
        '2679B94343C72564884860E50B7F6A7DE4B123B6CBE874B6D660BBC5D6D97BC3D2341E91773EE8ABA6B18DFF03B141BB8150FBDB749966ACD4C8C8F5BA4E2DEE' +
        '1A088E54F2DE6C1684231E8F02B5D5DB55F9105BCFE5C984224A547805D7639F582EAF744217D05DA4A903C4FBF2BE367CDA4CB399170D79F94722BEA41FA1FB' +
        '48DDE0FAD1A3979BFD9169140F57BB3C6878CD3359D7E38B91C218A72BF1697F4090308274E10ECAFE7ABAB43AD7C72E5324F36FDCB446A32DC16A57FCB29D23' +
        '42F8814E21439A8C50F8E53690600964FDBABD7DB32158123756E8832B79923F0F2CC300FDD11B30DA91F220FC80005A6574FCB4F9B38CE23E28DE1B5A9E492D' +
        'DA9F01AE2614B84B3F070A285323EE4119DD85ADF14A5475553CE51F74CA0E93154122C18E9AF54BDCE1CE63A20CFD4B1B34E99717E14060D2E440FCCA178734' +
        'D54E05104D3718EFF2BA757D915BB653603E515C853FF9396F18F00569D06077E89281B4979441B034E5BC8A9BE3BC5CB97AD5A7CF88965DA4054B98A89DB43B' +
        '1CDDD703E2E36C801EBE0DDC45C9924C03BEDCADFB1D34138B9865A4E66067AD25490EA0430551002CE69BCA20084DB5633CDF8947E718FE327F718E6B46E9C4' +
        '4FBE3CE18375275071B634EC00E918F8D9918CA98394332273332A42BA709E36715C92CE88FB055D785C95BA29941D0E8C4EA9D710D4E67DE1917DFF4A2AAC3F' +
        'AAA27F4FA48B83C70E125ECDE1969AD11616985F00A80EEB79E4FD04EF05D2F5F6C31D65FA7DCDF98EA07961A8472D38FACD017B9FA5F07C95F2D9CD0D7B65F1' +
        'B75F168C805168AF476E334C075E85F18600D6EDE376FE5BF1A04CA123AE21C3A9045231BEDD11626583C21EBBF419EFD9109A1779AA354E06258EBD5A43040B' +
        '15D6DD5E04A4496C9EC6BF89FFBCE44F2552D00097F1D0A0072A9F8E85A8B5A85B90BC04F69C425C37A0BB373F3C0A8C755AA80AC29A4609F06168A74E20099E' +
        '79D712FA12A04ED2B542AD2F90B090AECB829A860308215E2ADEB5BBA8E741ECD522D77A993A75E3F139A81BF14384223451A7E1B8934B86187196E0DDCD45D4' +
        '90C4738F572154C240B31361709F53F3CFC94CAE9EE6634A0470DD48D200E787A17D7B672FD3B93B348E241623DF6278EEB84EEEF8DE25CD66C1DEC5230F4247' +
        '036AB26953844CD94983B4198EB7057627AB2D0EC7274533C0C9B930703588B178607163D8686E87E304D84EB04523273529A6DE12C002785036B30B5BAD896C' +
        '32077C92E0E3E78A8AF82075CF13886297010E0C37AEC779B75284604969B03054A37C4E825C84B3285321A5D120DFA14A688D7081E3C2C9FBD3D6BE2225B579' +
        '84B56602AA0954742D4959D6F3CA9D5614A231CCF27608AF80DC0540D7F98EB04FBBBCA9DFA261402A47F80AAA99D0215E9CCF3CB62E37DC88E35130608E509C' +
        'C33D764A075418CB66C8A2A50758E617CD81B4448878BE10015DF957C81EB7931F49D34495E5FDD564372C23D54265DD6E2C73AA8F7E5348F42CF5299172DD95' +
        '267CB2F1BCD1A34A9B838FB52EF81C3A67688C7A8E63B8D3BE9BCF83C33079757297546A37C8D06DF3DB648C8B15E6784906A6A6CEA13A84C8A053517F5EF32C' +
        'C7EA264585B0F508FB0BB10509973EF2D74118E7F9B0432BC654756BEC4D9EF08A30CEECB6373D068B63C0980F68F28D8037410926FF05E77D40007B9240B0A0' +
        '57611BA96F559DAB620F5BA8E5713E571DE997EFB4D7B9CCA0B03B39779B500711121EF679195EA80033B9173F416CC98BC4099A3D76B968C7501FDFA4ECCFCB' +
        '25A1D40DA9FF2ACB4E801902B0A1A6E3E8462978DEEE4BEBD5E846646437FAE06D137475AA2131114BBC805F08A3D58EA0F7D9F3AB4C34EF78DE3D7CEA40F8E5' +
        '086580DC6C326184CBCDD778D0B896CB3E9DCFBDC83A104822554B9C00D85AB4E34EED7E17525BA02A99F491CDC31F379BC34E2A13105E254E5A36416DE0BB73' +
        '12DE653FCEDF42'
    }
  ];

  // ===== ALGORITHM =====

  function FindSetByKeyLength(length) {
    // Default: the RSDP small set of the category the key length implies.
    const lambda = length * 4;
    const name = 'CROSS-RSDP-' + lambda + '-small';
    return PARAMETER_SETS[name] || null;
  }

  function Flip(hex, octet) {
    const bytes = OpCodes.Hex8ToBytes(hex);
    bytes[octet] = OpCodes.Xor32(bytes[octet], 1);
    return bytes;
  }

  class CrossAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = 'CROSS';
      this.description = 'Codes and Restricted Objects Signature Scheme: a zero-knowledge identification '
        + 'over the restricted syndrome decoding problem, made non-interactive with Fiat-Shamir and '
        + 'compressed with seed and Merkle trees. Round-two candidate of the NIST call for additional '
        + 'signatures, all eighteen parameter sets (RSDP and RSDP(G), categories 1, 3 and 5, fast, '
        + 'balanced and small), reproducing the submission\'s Known Answer Tests.';
      this.inventor = 'Marco Baldi, Alessandro Barenghi, Sebastian Bitzer, Patrick Karl, Felice Manganiello, '
        + 'Alessio Pavoni, Gerardo Pelosi, Paolo Santini, Jonas Schupp, Freeman Slaughter, '
        + 'Antonia Wachter-Zeh, Violetta Weger';
      this.year = 2023;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Code-based Digital Signature';
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      this.parameterSets = SET_NAMES.slice();

      // The key is the key-pair seed: 16, 24 or 32 octets doubled, one length
      // per security category. The parameter set within the category is
      // chosen with the parameterSet property.
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0),
        new KeySize(48, 48, 0),
        new KeySize(64, 64, 0)
      ];

      this.documentation = [
        new LinkItem('CROSS round-two specification (version 2.0)',
          'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/cross-spec-round2-web.pdf'),
        new LinkItem('CROSS round-two submission package', KAT_URI),
        new LinkItem('CROSS project site', 'https://www.cross-crypto.com/'),
        new LinkItem('NIST PQC additional digital signature schemes', 'https://csrc.nist.gov/projects/pqc-dig-sig')
      ];

      this.references = [
        new LinkItem('CROSS reference and optimised implementations', 'https://github.com/CROSS-signature/CROSS-implementation'),
        new LinkItem('Baldi et al., Zero knowledge protocols and signatures from the restricted syndrome decoding problem (PKC 2024)',
          'https://eprint.iacr.org/2023/1541'),
        new LinkItem('FIPS 202 - SHA-3 and the SHAKE functions', 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Under evaluation, not standardised',
          'CROSS is a candidate of the NIST additional-signatures process. Its parameters have already '
          + 'changed between rounds and the later reference releases produce different Known Answer '
          + 'Tests from the round-two package this file follows',
          'Treat it as experimental and pin the version when interoperating',
          'https://csrc.nist.gov/projects/pqc-dig-sig'),
        new Vulnerability('Deterministic signing here',
          'Without katCount this file derives the root seed and salt from the secret key and the '
          + 'message instead of drawing them at random. That keeps distinct messages on distinct salts, '
          + 'but it is not the randomised signing the specification prescribes and it gives up any '
          + 'fault-attack resistance randomness would add',
          'Use a reviewed implementation with a real random source for anything beyond study',
          'https://www.cross-crypto.com/'),
        new Vulnerability('Published demonstration keys',
          'The secret keys in the test vectors come from the published KAT generator and confer no secrecy',
          'Generate a key-pair seed from a proper random source for any use beyond demonstration',
          KAT_URI)
      ];

      const tests = [];
      for (let i = 0; i < KAT.length; ++i) {
        const e = KAT[i];
        const note = ' (round-two KAT record rebuilt from the package generator; the whole response file '
          + e.file + ' reproduces its published SHA-512)';
        tests.push({
          text: e.set + ' count ' + e.count + ': crypto_sign reproduces the signed message' + note,
          uri: KAT_URI,
          parameterSet: e.set,
          katCount: e.count,
          key: OpCodes.Hex8ToBytes(e.sk),
          input: OpCodes.Hex8ToBytes(e.msg),
          expected: OpCodes.Hex8ToBytes(e.sm)
        });
        if (e.keygen) {
          tests.push({
            text: e.set + ' count ' + e.count + ': key generation from the harness stream, then signing' + note,
            uri: KAT_URI,
            parameterSet: e.set,
            katCount: e.count,
            input: OpCodes.Hex8ToBytes(e.msg),
            expected: OpCodes.Hex8ToBytes(e.sm)
          });
        }
        tests.push({
          text: e.set + ' count ' + e.count + ': crypto_sign_open under the published public key yields the message' + note,
          uri: KAT_URI,
          inverse: true,
          parameterSet: e.set,
          publicKey: OpCodes.Hex8ToBytes(e.pk),
          input: OpCodes.Hex8ToBytes(e.sm),
          expected: OpCodes.Hex8ToBytes(e.msg)
        });
        if (e.negatives) {
          const mlen = e.msg.length / 2;
          tests.push({
            text: e.set + ' count ' + e.count + ': the verdict under the public key derived from the secret key is acceptance',
            uri: KAT_URI,
            inverse: true,
            parameterSet: e.set,
            key: OpCodes.Hex8ToBytes(e.sk),
            message: OpCodes.Hex8ToBytes(e.msg),
            input: OpCodes.Hex8ToBytes(e.sm),
            expected: [1]
          });
          tests.push({
            text: e.set + ' count ' + e.count + ': a modified message must not verify',
            uri: KAT_URI,
            inverse: true,
            parameterSet: e.set,
            publicKey: OpCodes.Hex8ToBytes(e.pk),
            message: Flip(e.msg, 0),
            input: Flip(e.sm, 0),
            expected: [0]
          });
          tests.push({
            text: e.set + ' count ' + e.count + ': a genuine signed message does not vouch for a different message',
            uri: KAT_URI,
            inverse: true,
            parameterSet: e.set,
            publicKey: OpCodes.Hex8ToBytes(e.pk),
            message: Flip(e.msg, 0),
            input: OpCodes.Hex8ToBytes(e.sm),
            expected: [0]
          });
          tests.push({
            text: e.set + ' count ' + e.count + ': a modified signature (one bit of the first response) must not verify',
            uri: KAT_URI,
            inverse: true,
            parameterSet: e.set,
            publicKey: OpCodes.Hex8ToBytes(e.pk),
            message: OpCodes.Hex8ToBytes(e.msg),
            input: Flip(e.sm, mlen + PARAMETER_SETS[e.set].offResp0),
            expected: [0]
          });
          tests.push({
            text: e.set + ' count ' + e.count + ': a modified signature (one bit of the salt) must not verify',
            uri: KAT_URI,
            inverse: true,
            parameterSet: e.set,
            publicKey: OpCodes.Hex8ToBytes(e.pk),
            message: OpCodes.Hex8ToBytes(e.msg),
            input: Flip(e.sm, mlen),
            expected: [0]
          });
          tests.push({
            text: e.set + ' count ' + e.count + ': the signature must not verify under another record\'s public key',
            uri: KAT_URI,
            inverse: true,
            parameterSet: e.set,
            publicKey: OpCodes.Hex8ToBytes(e.otherPk),
            message: OpCodes.Hex8ToBytes(e.msg),
            input: OpCodes.Hex8ToBytes(e.sm),
            expected: [0]
          });
        }
      }
      this.tests = tests;
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - true to verify (crypto_sign_open), false to sign
     * @returns {Object} New instance
     */
    CreateInstance(isInverse = false) {
      return new CrossInstance(this, isInverse);
    }
  }

  /**
   * CROSS instance implementing the Feed/Result pattern.
   *
   * The forward direction consumes a message and returns message || signature,
   * which is what crypto_sign produces. The inverse direction is
   * crypto_sign_open: it returns the message, or the verdict when a message is
   * set, and throws on a signature that does not verify.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class CrossInstance extends IAlgorithmInstance {
    /**
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - verification mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._parameterSet = null;
      this._keyData = null;
      this._publicKey = null;
      this._derivedPublicKey = null;
      this._katCount = null;
      this._message = null;
      this.inputBuffer = [];
    }

    /** @returns {string|null} the name of the chosen parameter set */
    get parameterSet() {
      return this._parameterSet;
    }

    /** @param {string} name - one of the algorithm's parameterSets */
    set parameterSet(name) {
      if (name === null || name === undefined) { this._parameterSet = null; return; }
      if (!PARAMETER_SETS[name])
        throw new Error('CROSS: unknown parameter set ' + name + '; expected one of ' + SET_NAMES.join(', '));
      this._parameterSet = name;
      this._derivedPublicKey = null;
    }

    /**
     * Install the secret key, the key-pair seed of 32, 48 or 64 octets.
     * @param {uint8[]} keyData - the seed
     */
    KeySetup(keyData) {
      if (!keyData) { this._keyData = null; this._derivedPublicKey = null; return; }
      if (typeof keyData.length !== 'number' || [32, 48, 64].indexOf(keyData.length) < 0)
        throw new Error('CROSS: the secret key is a key-pair seed of 32, 48 or 64 octets, not ' + keyData.length);
      const copy = new Array(keyData.length);
      for (let i = 0; i < keyData.length; ++i) copy[i] = keyData[i];
      this._keyData = copy;
      this._derivedPublicKey = null;
    }

    set key(keyData) { this.KeySetup(keyData); }
    get key() { return this._keyData; }

    /** @param {number} count - replay the randomness of this record of the KAT generator */
    set katCount(count) {
      if (count === null || count === undefined) { this._katCount = null; return; }
      if (!(count >= 0 && Math.floor(count) === count))
        throw new Error('CROSS: katCount is a record number of the response file');
      this._katCount = count;
    }
    get katCount() { return this._katCount; }

    /** @param {uint8[]} value - when set, open returns [1] or [0] for this message */
    set message(value) { this._message = value ? Array.from(value) : null; }
    get message() { return this._message; }

    /**
     * The parameter set in force: the one named, else the RSDP small set of
     * the category the key length implies.
     */
    _params() {
      if (this._parameterSet) return PARAMETER_SETS[this._parameterSet];
      const length = this._keyData ? this._keyData.length
        : (this._publicKey ? { 77: 32, 115: 48, 153: 64 }[this._publicKey.length] : 0);
      const p = length ? FindSetByKeyLength(length) : null;
      if (!p) throw new Error('CROSS: set parameterSet or a key to choose a parameter set');
      return p;
    }

    _secretKey(p) {
      if (this._keyData) {
        if (this._keyData.length !== p.skBytes)
          throw new Error(p.name + ': the secret key is ' + p.skBytes + ' octets, not ' + this._keyData.length);
        return Uint8Array.from(this._keyData);
      }
      if (this._katCount !== null) return HarnessRandomness(p, this._katCount).seedSk;
      return null;
    }

    /** @returns {uint8[]|null} the public key, set or derived from the secret key */
    get publicKey() {
      if (this._publicKey) return Array.from(this._publicKey);
      const p = this._params();
      const sk = this._secretKey(p);
      if (!sk) return null;
      if (!this._derivedPublicKey) this._derivedPublicKey = PublicKeyFromSeed(p, sk);
      return Array.from(this._derivedPublicKey);
    }

    /** @param {uint8[]} value - a public key, to verify without a secret key */
    set publicKey(value) {
      this._publicKey = value ? Uint8Array.from(value) : null;
    }

    /**
     * Feed data. Appends, so a message split across several calls is treated
     * exactly as the same message delivered at once.
     * @param {uint8[]} data - input octets
     */
    Feed(data) {
      if (!data || typeof data.length !== 'number') return;
      for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
    }

    /**
     * Sign the fed message, or open the fed signed message.
     * @returns {uint8[]} message || signature when signing; the message, or a verdict, when opening
     */
    Result() {
      const input = Uint8Array.from(this.inputBuffer);
      this.inputBuffer = [];
      const p = this._params();

      if (this.isInverse) {
        const verdict = (this._message !== null);
        if (input.length < p.sigBytes) {
          if (verdict) return [0];
          throw new Error(p.name + ': a signed message is at least ' + p.sigBytes + ' octets');
        }
        let pk = this._publicKey;
        if (!pk) {
          const sk = this._secretKey(p);
          if (!sk) throw new Error(p.name + ': verification needs a public key or a secret key');
          if (!this._derivedPublicKey) this._derivedPublicKey = PublicKeyFromSeed(p, sk);
          pk = this._derivedPublicKey;
        }
        const mlen = input.length - p.sigBytes;
        const message = input.subarray(0, mlen);
        const accepted = Verify(p, pk, message, input.subarray(mlen));
        if (verdict) {
          let same = this._message.length === mlen;
          for (let i = 0; same && i < mlen; ++i) if (this._message[i] !== message[i]) same = false;
          return [accepted && same ? 1 : 0];
        }
        if (!accepted) throw new Error(p.name + ': the signature does not verify');
        return Array.from(message);
      }

      const sk = this._secretKey(p);
      if (!sk) throw new Error(p.name + ': signing needs a secret key');
      let rootSeed, salt;
      if (this._katCount !== null) {
        const r = HarnessRandomness(p, this._katCount);
        rootSeed = r.rootSeed;
        salt = r.salt;
      } else {
        const label = [0x43, 0x52, 0x4F, 0x53, 0x53];
        const st = CsprngInit(p, [label, sk, input], 0xFFFF);
        rootSeed = st.squeeze(p.seedBytes);
        salt = st.squeeze(p.saltBytes);
      }
      const sig = Sign(p, sk, input, rootSeed, salt);
      const out = new Array(input.length + sig.length);
      for (let i = 0; i < input.length; ++i) out[i] = input[i];
      for (let i = 0; i < sig.length; ++i) out[input.length + i] = sig[i];
      return out;
    }

    /** Wipe the data held by this instance. */
    ClearData() {
      if (this._keyData) OpCodes.ClearArray(this._keyData);
      this._keyData = null;
      this._publicKey = null;
      this._derivedPublicKey = null;
      this._message = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CrossAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    CrossAlgorithm,
    CrossInstance,
    PARAMETER_SETS,
    Shake,
    NistDrbg,
    HarnessRandomness,
    PublicKeyFromSeed,
    Sign,
    Verify
  };
}));
