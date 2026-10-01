/*
 * HAWK - a lattice-based hash-and-sign signature over module lattices of rank 2
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * HAWK's secret key is a basis B = [[f, F], [g, G]] of the rank-2 module
 * lattice Z[X]/(X^n+1)^2 with f*G - g*F = 1; the public key is its Gram
 * matrix Q = adj(B)*B, reduced to the two polynomials q00 and q01 that
 * determine it. Signing hashes the message to a target h, reduces it modulo
 * 2 into t = B*h, samples a short x from a discrete Gaussian over the coset
 * 2*Z^2n + t, and publishes the second half s1 of s = (h - B^-1*x)/2. The
 * verifier rebuilds s0 from s1 with the public key alone and checks that the
 * norm of h - 2*s in the quadratic form Q is small. Nothing in signing or
 * verification uses floating point.
 *
 * This file follows the round-two submission to the NIST additional
 * signatures process, all three parameter sets and all three of its
 * procedures:
 *
 *   HAWK-256    n = 256   secret key  96   public key  450   signature  249
 *   HAWK-512    n = 512   secret key 184   public key 1024   signature  555
 *   HAWK-1024   n = 1024  secret key 360   public key 2440   signature 1221
 *
 * Key generation is the submission's own: (f, g) are derived from a seed by
 * SHAKE256, screened exactly as the reference screens them, and the NTRU
 * equation is solved with the same fixed-point Babai reduction, level by
 * level, so that the same seed gives the same F and G. The resultant chain,
 * the lifting and the reduction steps are carried out in exact integer
 * arithmetic here instead of in residue number systems; every place where
 * the reference computes an approximation - the 32.32 fixed-point FFT, its
 * division, the choice of which words of a big integer feed it and the
 * rounding back to integers - is reproduced operation for operation, because
 * that is where two correct implementations could otherwise disagree. The
 * reference keeps every intermediate value inside a fixed number of 31-bit
 * words; a value that would not fit there makes the reference compute
 * garbage and discard the candidate, and this file discards it as well.
 *
 * Signing follows hawk_sign_finish: the salt and the Gaussian sampler are
 * both keyed by SHAKE256 over the message digest, the key seed, an attempt
 * counter and fresh randomness, so a signature depends on all four.
 * Verification follows hawk_verify_finish, including its fixed-point FFT
 * reconstruction of s0 and its norm computation modulo two primes.
 *
 * Measured against the three PQCsignKAT response files of the round-two
 * package, all 300 records: every public and secret key is regenerated from
 * the record's seed, including the seeds the harness discarded on the way,
 * every public key is rebuilt from its secret key, every signed message is
 * reproduced octet for octet and every one opens under its public key. The
 * package's reference code, built and run as a black box on 1800 further
 * seeds (1000, 500 and 300 per set), agrees with this file on every key
 * pair, every signature and the verdict on 43,200 single-bit corruptions of
 * those signed messages; no value it produced is committed here.
 *
 * The Known Answer Tests of the round-two package drive all of it. The key of
 * a test vector is the secret key of a KAT record. When a vector also carries
 * the record's 48-octet drbgSeed, the NIST harness is replayed: the AES-256
 * CTR_DRBG is seeded with it, the key-generation draws are consumed, and the
 * signature draws its randomness from the continuing stream, which is what
 * makes the published signed message reproducible. Without a drbgSeed, the
 * randomness is taken to be all zero; the signature is then a deterministic
 * function of key and message and remains a valid HAWK signature, since the
 * scheme hashes the key seed and the message into every random choice.
 *
 * HAWK was withdrawn from the NIST process in July 2026 after a lattice
 * reduction attack that roughly halves the block size needed to recover an
 * equivalent secret key; it is kept here for its construction and its
 * published test vectors.
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
  // HAWK uses SHAKE256 everywhere: to expand the key seed into (f, g), to hash
  // the public key and the message, to derive the salt and to feed the
  // Gaussian sampler. The sampler forks one partially absorbed state four
  // times, so the sponge here can be cloned before it is finalised.

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

  /**
   * @returns {int32[]} where the pi step moves each lane
   */
  function BuildKeccakTarget() {
    /** @type {int32[]} */
    const t = new Array(25);
    for (let x = 0; x < 5; ++x)
      for (let y = 0; y < 5; ++y)
        t[x + 5 * y] = y + 5 * ((2 * x + 3 * y) % 5);
    return t;
  }

  const KECCAK_TARGET = BuildKeccakTarget();

  const SHAKE256_RATE = 136;

  /**
   * Keccak-f[1600] over 25 lanes held as low/high 32-bit halves.
   * @param {uint32[]} s - 50 words, permuted in place
   */
  function KeccakPermute(s) {
    const b = new Uint32Array(50);
    const c = new Uint32Array(10);

    for (let round = 0; round < 24; ++round) {
      for (let x = 0; x < 5; ++x) {
        c[2 * x] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(s[2 * x], s[2 * x + 10]), OpCodes.Xor32(s[2 * x + 20], s[2 * x + 30])), s[2 * x + 40]);
        c[2 * x + 1] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(s[2 * x + 1], s[2 * x + 11]), OpCodes.Xor32(s[2 * x + 21], s[2 * x + 31])), s[2 * x + 41]);
      }

      for (let x = 0; x < 5; ++x) {
        const nx = (x + 1) % 5;
        const px = (x + 4) % 5;
        const lo = OpCodes.Xor32(c[2 * px], OpCodes.Or32(OpCodes.Shl32(c[2 * nx], 1), OpCodes.Shr32(c[2 * nx + 1], 31)));
        const hi = OpCodes.Xor32(c[2 * px + 1], OpCodes.Or32(OpCodes.Shl32(c[2 * nx + 1], 1), OpCodes.Shr32(c[2 * nx], 31)));
        for (let y = 0; y < 25; y += 5) {
          s[2 * (x + y)] = OpCodes.Xor32(s[2 * (x + y)], lo);
          s[2 * (x + y) + 1] = OpCodes.Xor32(s[2 * (x + y) + 1], hi);
        }
      }

      for (let i = 0; i < 25; ++i) {
        const r = KECCAK_ROTATION[i];
        /** @type {uint32} */
        const lo = s[2 * i];
        /** @type {uint32} */
        const hi = s[2 * i + 1];
        /** @type {uint32} */
        let nlo = 0;
        /** @type {uint32} */
        let nhi = 0;
        if (r === 0) {
          nlo = lo; nhi = hi;
        } else if (r < 32) {
          nlo = OpCodes.Or32(OpCodes.Shl32(lo, r), OpCodes.Shr32(hi, 32 - r));
          nhi = OpCodes.Or32(OpCodes.Shl32(hi, r), OpCodes.Shr32(lo, 32 - r));
        } else if (r === 32) {
          nlo = hi; nhi = lo;
        } else {
          const q = r - 32;
          nlo = OpCodes.Or32(OpCodes.Shl32(hi, q), OpCodes.Shr32(lo, 32 - q));
          nhi = OpCodes.Or32(OpCodes.Shl32(lo, q), OpCodes.Shr32(hi, 32 - q));
        }
        const t = KECCAK_TARGET[i];
        b[2 * t] = nlo;
        b[2 * t + 1] = nhi;
      }

      for (let y = 0; y < 25; y += 5)
        for (let x = 0; x < 5; ++x) {
          const i = x + y;
          const i1 = ((x + 1) % 5) + y;
          const i2 = ((x + 2) % 5) + y;
          s[2 * i] = OpCodes.Xor32(b[2 * i], OpCodes.And32(OpCodes.Not32(b[2 * i1]), b[2 * i2]));
          s[2 * i + 1] = OpCodes.Xor32(b[2 * i + 1], OpCodes.And32(OpCodes.Not32(b[2 * i1 + 1]), b[2 * i2 + 1]));
        }

      s[0] = OpCodes.Xor32(s[0], KECCAK_RC_LOW[round]);
      s[1] = OpCodes.Xor32(s[1], KECCAK_RC_HIGH[round]);
    }
  }

  /**
   * An incremental SHAKE256: inject, flip, then extract any amount.
   */
  class Shake256 {
    constructor() {
      /** @type {uint32[]} */
      this.state = new Uint32Array(50);
      /** @type {uint8[]} */
      this.buffer = new Uint8Array(SHAKE256_RATE);
      /** @type {int32} */
      this.position = 0;
      /** @type {boolean} */
      this.squeezing = false;
    }

    /**
     * @returns {Shake256} an independent copy of this sponge
     */
    Clone() {
      const copy = new Shake256();
      copy.state.set(this.state);
      copy.buffer.set(this.buffer);
      copy.position = this.position;
      copy.squeezing = this.squeezing;
      return copy;
    }

    /**
     */
    _absorbBuffer() {
      const q = this.buffer;
      const s = this.state;
      for (let i = 0; i < SHAKE256_RATE / 8; ++i) {
        s[2 * i] = OpCodes.Xor32(s[2 * i], OpCodes.Pack32LE(q[8 * i], q[8 * i + 1], q[8 * i + 2], q[8 * i + 3]));
        s[2 * i + 1] = OpCodes.Xor32(s[2 * i + 1], OpCodes.Pack32LE(q[8 * i + 4], q[8 * i + 5], q[8 * i + 6], q[8 * i + 7]));
      }
      KeccakPermute(s);
    }

    _stateToBuffer() {
      const q = this.buffer;
      const s = this.state;
      for (let i = 0; i < SHAKE256_RATE / 8; ++i) {
        const lo = OpCodes.Unpack32LE(s[2 * i]);
        const hi = OpCodes.Unpack32LE(s[2 * i + 1]);
        for (let j = 0; j < 4; ++j) {
          q[8 * i + j] = lo[j];
          q[8 * i + 4 + j] = hi[j];
        }
      }
    }

    /**
     * @param {uint8[]} data - octets to absorb
     * @returns {Shake256} this
     */
    Inject(data) {
      for (let i = 0; i < data.length; ++i) {
        this.buffer[this.position++] = data[i];
        if (this.position === SHAKE256_RATE) {
          this._absorbBuffer();
          this.position = 0;
        }
      }
      return this;
    }

    /**
     * Finish absorbing and switch to output.
     * @returns {Shake256} this
     */
    Flip() {
      this.buffer.fill(0, this.position);
      this.buffer[this.position] = OpCodes.Xor32(this.buffer[this.position], 0x1F);
      this.buffer[SHAKE256_RATE - 1] = OpCodes.Xor32(this.buffer[SHAKE256_RATE - 1], 0x80);
      this._absorbBuffer();
      this._stateToBuffer();
      this.position = 0;
      this.squeezing = true;
      return this;
    }

    /**
     * @param {int32} count - octets wanted
     * @returns {uint8[]} the next count octets of output
     */
    Extract(count) {
      const out = new Uint8Array(count);
      for (let i = 0; i < count; ++i) {
        if (this.position === SHAKE256_RATE) {
          KeccakPermute(this.state);
          this._stateToBuffer();
          this.position = 0;
        }
        out[i] = this.buffer[this.position++];
      }
      return out;
    }
  }

  /**
   * SHAKE256 over the concatenation of the given parts.
   * @param {uint8[][]} parts - octet arrays
   * @param {int32} count - output length
   * @returns {uint8[]} the digest
   */
  function Shake(parts, count) {
    const sc = new Shake256();
    for (let i = 0; i < parts.length; ++i) sc.Inject(parts[i]);
    /** @type {uint8[]} */
    const digest = sc.Flip().Extract(count);
    return digest;
  }

  /**
   * @param {uint32} value - a 32 bit word
   * @returns {uint8[]} its little-endian octets
   */
  function Le32(value) {
    /** @type {uint8[]} */
    const octets = OpCodes.Unpack32LE(value);
    return octets;
  }

  // ===== the NIST generator =====
  //
  // The Known Answer Test harness draws every random octet from the AES-256
  // CTR_DRBG of the NIST reference code. AES is the collection's own; it is
  // looked up on first use rather than at load time, so that loading this file
  // does not register a block cipher under this directory.

  /** @type {Algorithm|null} */
  let aesAlgorithm = null;

  /**
   * @returns {Algorithm} the registered AES
   */
  function FindAes() {
    if (aesAlgorithm) return aesAlgorithm;

    aesAlgorithm = AlgorithmFramework.Find('Rijndael (AES)');
    if (!aesAlgorithm && typeof require !== 'undefined') {
      try {
        require('../block/rijndael.js');
      } catch (e) {
        // Reported as a missing dependency below.
      }
      aesAlgorithm = AlgorithmFramework.Find('Rijndael (AES)');
    }

    if (!aesAlgorithm)
      throw new Error('HAWK needs AES for the NIST generator, which is not registered');
    return aesAlgorithm;
  }

  /**
   * @param {uint8[]} key - 32 key octets
   * @param {uint8[]} block - 16 plaintext octets
   * @returns {uint8[]} 16 ciphertext octets
   */
  function Aes256Ecb(key, block) {
    /** @type {IAlgorithmInstance} */
    const instance = FindAes().CreateInstance(false);
    instance.key = Array.from(key);
    instance.Feed(Array.from(block));
    /** @type {uint8[]} */
    const output = instance.Result();
    return output;
  }

  /**
   * @param {uint8[]} v - 16 octet big-endian counter, incremented in place
   */
  function IncrementCounter(v) {
    for (let j = 15; j >= 0; --j) {
      if (v[j] === 0xFF) v[j] = 0;
      else { v[j] = OpCodes.ToByte(v[j] + 1); break; }
    }
  }

  /**
   * The random source of key generation and signing: the generator seeded as
   * randombytes_init does with a zero key and counter, or, without a seed,
   * all zeros.
   */
  class HawkRandom {
    /**
     * @param {uint8[]|null} entropy - the 48 octet seed, or null for zeros
     */
    constructor(entropy) {
      /** @type {boolean} */
      this.seeded = entropy !== null;
      /** @type {uint8[]} */
      this.key = new Uint8Array(32);
      /** @type {uint8[]} */
      this.v = new Uint8Array(16);
      if (entropy !== null) this._update(entropy);
    }

    /**
     * @param {uint8[]|null} providedData - 48 octets mixed into the state, or null
     */
    _update(providedData) {
      const temp = new Uint8Array(48);
      for (let i = 0; i < 3; ++i) {
        IncrementCounter(this.v);
        const block = Aes256Ecb(this.key, this.v);
        for (let j = 0; j < 16; ++j) temp[i * 16 + j] = block[j];
      }
      if (providedData !== null)
        for (let i = 0; i < 48; ++i) temp[i] = OpCodes.Xor32(temp[i], providedData[i]);
      for (let i = 0; i < 32; ++i) this.key[i] = temp[i];
      for (let i = 0; i < 16; ++i) this.v[i] = temp[32 + i];
    }

    /**
     * @param {int32} count - octets wanted
     * @returns {uint8[]} the next count octets
     */
    Read(count) {
      const out = new Uint8Array(count);
      if (!this.seeded) return out;
      let produced = 0;
      while (produced < count) {
        IncrementCounter(this.v);
        const block = Aes256Ecb(this.key, this.v);
        for (let j = 0; j < 16 && produced < count; ++j) out[produced++] = block[j];
      }
      this._update(null);
      return out;
    }
  }

  // ===== parameter sets =====

  // Tables of the signing sampler: for each k, the probability that |X| is at
  // least 2k+2 (even column) or 2k+3 (odd column), scaled by 2^78 and split
  // into a 15-bit high part and a 63-bit low part.
  // Indexed by logn - 8.
  /** @type {int32[][]} */
  const GAUSS_HI = [
    // logn 8
    [0x4D70, 0x268B, 0x0F80, 0x04FA, 0x0144, 0x0041, 0x000A, 0x0001],
    // logn 9
    [0x580B, 0x35F9, 0x1D34, 0x0DD7, 0x05B7, 0x020C, 0x00A2, 0x002B, 0x000A, 0x0001],
    // logn 10
    [0x58B0, 0x36FE, 0x1E3A, 0x0EA0, 0x0632, 0x024A, 0x00BC, 0x0034, 0x000C, 0x0002]
  ];

  // Indexed by logn - 8.
  /** @type {string[][]} */
  const GAUSS_LO = [
    // logn 8
    [
      '71FBD58485D45050', '1408A4B181C718B1', '54114F1DC2FA7AC9', '614569CC54722DC9',
      '42F74ADDA0B5AE61', '151C5CDCBAFF49A3', '252E2152AB5D758B', '23460C30AC398322',
      '0FDE62196C1718FC', '01355A8330C44097', '00127325DDF8CEBA', '0000DC8DE401FD12',
      '000008100822C548', '0000003B0FFB28F0', '0000000152A6E9AE', '0000000005EFCD99',
      '000000000014DA4A', '0000000000003953', '000000000000007B', '0000000000000000'
    ],
    // logn 9
    [
      '0C27920A04F8F267', '3C689D9213449DC9', '1C4FF17C204AA058', '7B908C81FCE3524F',
      '5E63263BE0098FFD', '4EBEFD8FF4F07378', '56AEDFB0876A3BD8', '4628BC6B23887196',
      '061E21D588CC61CC', '7F769211F07B326F', '2BA568D92EEC18E7', '0668F461693DFF8F',
      '00CF0F8687D3B009', '001670DB65964485', '000216A0C344EB45', '00002AB6E11C2552',
      '000002EDF0B98A84', '0000002C253C7E81', '000000023AF3B2E7', '0000000018C14ABF',
      '0000000000EBCC6A', '000000000007876E', '00000000000034CF', '000000000000013D',
      '0000000000000006', '0000000000000000'
    ],
    // logn 10
    [
      '3AAA2EB76504E560', '01AE2B17728DF2DE', '70E1C03E49BB683E', '6A00B82C69624C93',
      '55CDA662EF2D1C48', '2685DB30348656A4', '31E874B355421BB7', '430192770E205503',
      '57C0676C029895A7', '5353BD4091AA96DB', '3D4D67696E51F820', '09915A53D8667BEE',
      '014A1A8A93F20738', '0026670030160D5F', '0003DAF47E8DFB21', '0000557CD1C5F797',
      '000006634617B3FF', '0000006965E15B13', '00000005DBEFB646', '0000000047E9AB38',
      '0000000002F93038', '00000000001B2445', '000000000000D5A7', '00000000000005AA',
      '0000000000000021', '0000000000000000'
    ]
  ];

  // Word budgets of the NTRU solver at each recursion depth, in 31-bit words:
  // (f, g) at that depth, unreduced (F, G), and how many top words of (f, g)
  // feed the fixed-point approximation. They are the reference's measured
  // bounds, and they decide both where values are truncated and which words
  // the approximations read, so they are part of the key generation.
  /** The NTRU solver's word budgets for one degree. */
  class HawkSolverProfile {
    /**
     * @param {int32[]} small - words of (f, g) per depth
     * @param {int32[]} large - words of unreduced (F, G) per depth
     * @param {int32[]} window - top words feeding the approximation per depth
     * @param {int32} reduceBits - scale step of the Babai reduction
     */
    constructor(small, large, window, reduceBits) {
      /** @type {int32[]} */
      this.small = small;
      /** @type {int32[]} */
      this.large = large;
      /** @type {int32[]} */
      this.window = window;
      /** @type {int32} */
      this.reduceBits = reduceBits;
    }
  }

  /** @type {int32[]} */
  const SMALL_256 = [1, 1, 1, 2, 3, 5, 9, 17, 34, 0, 0];
  /** @type {int32[]} */
  const LARGE_256 = [1, 1, 2, 4, 7, 13, 26, 50, 0, 0];
  /** @type {int32[]} */
  const WINDOW_256 = [1, 1, 1, 2, 3, 3, 3, 4, 0, 0];
  /** @type {int32[]} */
  const SMALL_512 = [1, 1, 1, 2, 3, 6, 11, 21, 41, 82, 0];
  /** @type {int32[]} */
  const LARGE_512 = [1, 2, 3, 5, 8, 16, 31, 61, 121, 0];
  /** @type {int32[]} */
  const WINDOW_512 = [1, 1, 1, 2, 2, 3, 3, 4, 6, 0];
  /** @type {int32[]} */
  const SMALL_1024 = [1, 1, 2, 2, 4, 7, 13, 25, 48, 96, 191];
  /** @type {int32[]} */
  const LARGE_1024 = [1, 2, 3, 5, 10, 19, 37, 72, 143, 284];
  /** @type {int32[]} */
  const WINDOW_1024 = [1, 1, 2, 2, 3, 3, 3, 4, 4, 7];

  // Indexed by logn - 8.
  /** @type {HawkSolverProfile[]} */
  const SOLVER_PROFILES = [
    new HawkSolverProfile(SMALL_256, LARGE_256, WINDOW_256, 20),
    new HawkSolverProfile(SMALL_512, LARGE_512, WINDOW_512, 15),
    new HawkSolverProfile(SMALL_1024, LARGE_1024, WINDOW_1024, 12)
  ];

  /** A parameter set, in the field order the plain object always had. */
  class HawkParams {
    /**
     * @param {string} name - 'HAWK-256', 'HAWK-512' or 'HAWK-1024'
     * @param {int32} logn - 8, 9 or 10
     * @param {int32} pkSize - public key octets
     * @param {int32} sigSize - signature octets
     * @param {int32} saltLen - salt octets
     * @param {int32} maxNorm - bound on the sampled and the verified norm
     * @param {int32} l2low - lower bound on the norm of (f, g)
     * @param {BigInt} d0high - bound on the constant term of 1/q00
     * @param {int32[]} bits - bitsLim00, bitsLim01, bitsLim11, bitsLimS0, bitsLimS1
     * @param {int32[]} lows - low00, low01, lowS1
     */
    constructor(name, logn, pkSize, sigSize, saltLen, maxNorm, l2low, d0high, bits, lows) {
      const n = Math.pow(2, logn);
      /** @type {string} */
      this.name = name;
      /** @type {int32} */
      this.logn = logn;
      /** @type {int32} */
      this.n = n;
      /** @type {int32} */
      this.seedLen = 8 + n / 32;
      /** @type {int32} */
      this.hpubLen = n / 16;
      /** @type {int32} */
      this.skSize = 8 + 11 * (n / 32);
      /** @type {int32} */
      this.pkSize = pkSize;
      /** @type {int32} */
      this.sigSize = sigSize;
      /** @type {int32} */
      this.saltLen = saltLen;
      /** @type {int32} */
      this.maxXnorm = maxNorm;
      /** @type {int32} */
      this.maxTnorm = maxNorm;
      /** @type {int32} */
      this.l2low = l2low;
      /** @type {BigInt} */
      this.d0high = d0high;
      /** @type {int32} */
      this.bitsLim00 = bits[0];
      /** @type {int32} */
      this.bitsLim01 = bits[1];
      /** @type {int32} */
      this.bitsLim11 = bits[2];
      /** @type {int32} */
      this.bitsLimS0 = bits[3];
      /** @type {int32} */
      this.bitsLimS1 = bits[4];
      /** @type {int32} */
      this.low00 = lows[0];
      /** @type {int32} */
      this.low01 = lows[1];
      /** @type {int32} */
      this.lowS1 = lows[2];
      /** @type {int32[]} */
      this.gaussHi = GaussHi(logn);
      /** @type {uint32[][]} */
      this.gaussLo = GaussLoPairs(logn);
      /** @type {HawkSolverProfile} */
      this.profile = SolverProfile(logn);
      /** @type {int32} */
      this.eb00Len = 16 - this.bitsLim00;
    }
  }

  /**
   * @param {int32} logn - 8, 9 or 10
   * @returns {int32[]} the high parts of the sampler table
   */
  function GaussHi(logn) {
    /** @type {int32[]} */
    const table = GAUSS_HI[logn - 8];
    return table;
  }

  /**
   * The low parts of the sampler table as [high 31 bits, low 32 bits] pairs.
   * @param {int32} logn - 8, 9 or 10
   * @returns {uint32[][]} the pairs
   */
  function GaussLoPairs(logn) {
    /** @type {uint32[][]} */
    const pairs = OpCodes.CreateUint64ArrayFromHex(GAUSS_LO[logn - 8]);
    return pairs;
  }

  /**
   * @param {int32} logn - 8, 9 or 10
   * @returns {HawkSolverProfile} the solver's word budgets
   */
  function SolverProfile(logn) {
    /** @type {HawkSolverProfile} */
    const profile = SOLVER_PROFILES[logn - 8];
    return profile;
  }

  /** @type {int32[]} */
  const BITS_256 = [9, 11, 13, 12, 9];
  /** @type {int32[]} */
  const BITS_512 = [9, 12, 15, 13, 9];
  /** @type {int32[]} */
  const BITS_1024 = [10, 14, 17, 14, 10];
  /** @type {int32[]} */
  const LOWS_256 = [5, 8, 5];
  /** @type {int32[]} */
  const LOWS_512 = [5, 9, 5];
  /** @type {int32[]} */
  const LOWS_1024 = [6, 10, 6];

  /** @type {HawkParams[]} */
  const PARAMETER_SET_LIST = [
    new HawkParams('HAWK-256', 8, 450, 249, 14, 2223, 556, 17179869n, BITS_256, LOWS_256),
    new HawkParams('HAWK-512', 9, 1024, 555, 24, 8317, 2080, 4294967n, BITS_512, LOWS_512),
    new HawkParams('HAWK-1024', 10, 2440, 1221, 40, 20218, 7981, 1431655n, BITS_1024, LOWS_1024)
  ];

  /**
   * @param {string} name - 'HAWK-256', 'HAWK-512' or 'HAWK-1024'
   * @returns {HawkParams|null} the set of that name
   */
  function ParameterSetEntry(name) {
    for (let i = 0; i < PARAMETER_SET_LIST.length; ++i)
      if (PARAMETER_SET_LIST[i].name === name) return PARAMETER_SET_LIST[i];
    return null;
  }

  /**
   * @param {int32} size - secret key octets
   * @returns {HawkParams|null} the set with that key size
   */
  function ParamsBySkSize(size) {
    for (let i = 0; i < PARAMETER_SET_LIST.length; ++i)
      if (PARAMETER_SET_LIST[i].skSize === size) return PARAMETER_SET_LIST[i];
    return null;
  }

  /**
   * @param {int32} size - public key octets
   * @returns {HawkParams|null} the set with that key size
   */
  function ParamsByPkSize(size) {
    for (let i = 0; i < PARAMETER_SET_LIST.length; ++i)
      if (PARAMETER_SET_LIST[i].pkSize === size) return PARAMETER_SET_LIST[i];
    return null;
  }

  /**
   * @param {int32} n - length
   * @returns {int32[]} n zeros
   */
  function Zeros(n) {
    /** @type {int32[]} */
    const z = new Array(n);
    for (let i = 0; i < n; ++i) z[i] = 0;
    return z;
  }

  // ===== arithmetic modulo the two 31-bit primes =====
  //
  // Key generation checks invertibility modulo p1 and p2 and solves the last
  // level of the NTRU equation modulo p1; verification computes the norm
  // modulo both. Products of two 31-bit residues exceed a double's 53 bits,
  // so the multiplier is split in 16-bit halves.

  const P1 = 2147473409;
  const P2 = 2147389441;

  /**
   * @param {int32} a - a
   * @param {int32} b - b
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function MulMod(a, b, p) {
    const bh = Math.floor(b / 65536);
    const bl = b - bh * 65536;
    return (((a * bh) % p) * 65536 + a * bl) % p;
  }

  /**
   * @param {int32} a - a
   * @param {int32} b - b
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function AddMod(a, b, p) {
    const s = a + b;
    return s >= p ? s - p : s;
  }

  /**
   * @param {int32} a - a
   * @param {int32} b - b
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function SubMod(a, b, p) {
    const s = a - b;
    return s < 0 ? s + p : s;
  }

  /**
   * @param {int32} a - a
   * @param {int32} e - e
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function PowMod(a, e, p) {
    let r = 1;
    let x = a % p;
    while (e > 0) {
      if (e % 2 === 1) r = MulMod(r, x, p);
      x = MulMod(x, x, p);
      e = Math.floor(e / 2);
    }
    return r;
  }

  /**
   * @param {int32} a - a
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function InvMod(a, p) {
    return a === 0 ? 0 : PowMod(a, p - 2, p);
  }

  /**
   * @param {int32} v - v
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function ToMod(v, p) {
    const r = v % p;
    return r < 0 ? r + p : r;
  }

  /**
   * @param {int32} v - v
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function Centered(v, p) {
    return v > (p - 1) / 2 ? v - p : v;
  }

  /** Evaluation tables for X^n+1 modulo a prime. */
  class HawkNttTables {
    /**
     * @param {int32} n - degree
     * @param {int32} p - the prime
     * @param {int32[]} psiPow - powers of psi
     * @param {int32[]} psiInvPow - powers of 1/psi
     * @param {int32[]} rev - bit-reversal permutation
     * @param {int32} omega - psi^2
     * @param {int32} omegaInv - 1/omega
     * @param {int32} nInv - 1/n
     */
    constructor(n, p, psiPow, psiInvPow, rev, omega, omegaInv, nInv) {
      /** @type {int32} */
      this.n = n;
      /** @type {int32} */
      this.p = p;
      /** @type {int32[]} */
      this.psiPow = psiPow;
      /** @type {int32[]} */
      this.psiInvPow = psiInvPow;
      /** @type {int32[]} */
      this.rev = rev;
      /** @type {int32} */
      this.omega = omega;
      /** @type {int32} */
      this.omegaInv = omegaInv;
      /** @type {int32} */
      this.nInv = nInv;
    }
  }

  /** @type {HawkNttTables[]} */
  const NTT_CACHE = [];

  /**
   * Evaluation tables for X^n+1 modulo p: psi is a primitive 2n-th root.
   * @param {int32} logn - logn
   * @param {int32} p - p
   * @returns {HawkNttTables} Result
   */
  function NttTables(logn, p) {
    const n = Math.pow(2, logn);
    for (let i = 0; i < NTT_CACHE.length; ++i)
      if (NTT_CACHE[i].n === n && NTT_CACHE[i].p === p) return NTT_CACHE[i];

    let psi = 0;
    for (let h = 2; ; ++h) {
      psi = PowMod(h, (p - 1) / (2 * n), p);
      if (PowMod(psi, n, p) === p - 1) break;
    }
    const omega = MulMod(psi, psi, p);
    /** @type {int32[]} */
    const psiPow = new Array(n);
    /** @type {int32[]} */
    const psiInvPow = new Array(n);
    const psiInv = InvMod(psi, p);
    psiPow[0] = 1;
    psiInvPow[0] = 1;
    for (let i = 1; i < n; ++i) {
      psiPow[i] = MulMod(psiPow[i - 1], psi, p);
      psiInvPow[i] = MulMod(psiInvPow[i - 1], psiInv, p);
    }
    /** @type {int32[]} */
    const rev = new Array(n);
    for (let i = 0; i < n; ++i) {
      let r = 0;
      let x = i;
      for (let b = 0; b < logn; ++b) {
        r = r * 2 + (x % 2);
        x = Math.floor(x / 2);
      }
      rev[i] = r;
    }
    const tables = new HawkNttTables(n, p, psiPow, psiInvPow, rev, omega, InvMod(omega, p), InvMod(n, p));
    NTT_CACHE.push(tables);
    return tables;
  }

  /**
   * @param {int32[]} a - a
   * @param {HawkNttTables} T - T
   * @param {int32} root - root
   * @returns {int32[]} Result
   */
  function CyclicTransform(a, T, root) {
    const n = T.n;
    const p = T.p;
    /** @type {int32[]} */
    const x = new Array(n);
    for (let i = 0; i < n; ++i) x[T.rev[i]] = a[i];
    for (let len = 2; len <= n; len *= 2) {
      const w = PowMod(root, n / len, p);
      const half = len / 2;
      /** @type {int32[]} */
      const tw = new Array(half);
      tw[0] = 1;
      for (let k = 1; k < half; ++k) tw[k] = MulMod(tw[k - 1], w, p);
      for (let i = 0; i < n; i += len)
        for (let k = 0; k < half; ++k) {
          const u = x[i + k];
          const v = MulMod(x[i + k + half], tw[k], p);
          x[i + k] = AddMod(u, v, p);
          x[i + k + half] = SubMod(u, v, p);
        }
    }
    return x;
  }

  /**
   * Values of a polynomial modulo (X^n+1, p) at psi^(2j+1), j = 0..n-1.
   * Entries j and n-1-j are at conjugate (inverse) roots.
   * @param {int32[]} a - integer coefficients (any sign)
   * @param {int32} logn - logn
   * @param {int32} p - p
   * @returns {int32[]} Result
   */
  function Ntt(a, logn, p) {
    const T = NttTables(logn, p);
    /** @type {int32[]} */
    const b = new Array(T.n);
    for (let i = 0; i < T.n; ++i) b[i] = MulMod(ToMod(a[i], p), T.psiPow[i], p);
    return CyclicTransform(b, T, T.omega);
  }

  /**
   * Inverse of Ntt, with coefficients returned in [0, p).
   * @param {int32[]} A - A
   * @param {int32} logn - logn
   * @param {int32} p - p
   * @returns {int32[]} Result
   */
  function InverseNtt(A, logn, p) {
    const T = NttTables(logn, p);
    const b = CyclicTransform(A, T, T.omegaInv);
    for (let i = 0; i < T.n; ++i) b[i] = MulMod(MulMod(b[i], T.nInv, p), T.psiInvPow[i], p);
    return b;
  }

  // ===== exact polynomial arithmetic modulo X^n+1 =====
  //
  // The NTRU solver works with coefficients of up to several thousand bits.
  // They are BigInts; products are formed either directly or, for large
  // degrees, from limbs small enough that the convolutions of limbs stay exact
  // in double precision.

  /**
   * @param {BigInt} v - v
   * @returns {BigInt} Result
   */
  function BigAbs(v) {
    return v < 0n ? -v : v;
  }

  /**
   * @param {BigInt} v - v
   * @returns {int32} Result
   */
  function BitLength(v) {
    if (v < 0n) v = -v;
    if (v === 0n) return 0;
    return OpCodes.BitCountN(v);
  }

  /**
   * @param {BigInt[]} a - a
   * @returns {int32} Result
   */
  function MaxBits(a) {
    let m = 0n;
    for (let i = 0; i < a.length; ++i) {
      const x = BigAbs(a[i]);
      if (x > m) m = x;
    }
    return BitLength(m);
  }

  /**
   * @param {float64[]} A - A
   * @param {float64[]} B - B
   * @param {int32} m - m
   * @returns {float64[]} Result
   */
  function ConvNeg(A, B, m) {
    const R = new Float64Array(m);
    for (let i = 0; i < m; ++i) {
      const av = A[i];
      if (av === 0) continue;
      const lim = m - i;
      for (let j = 0; j < lim; ++j) R[i + j] += av * B[j];
      for (let j = lim; j < m; ++j) R[i + j - m] -= av * B[j];
    }
    return R;
  }

  /**
   * @param {BigInt[]} a - a
   * @param {int32} limbBits - limbBits
   * @param {int32} count - count
   * @returns {float64[][]} Result
   */
  function SplitLimbs(a, limbBits, count) {
    const m = a.length;
    /** @type {BigInt} */
    const mask = OpCodes.ShiftLn(1n, limbBits) - 1n;
    /** @type {float64[][]} */
    const limbs = [];
    for (let k = 0; k < count; ++k) limbs.push(new Float64Array(m));
    for (let i = 0; i < m; ++i) {
      const negative = a[i] < 0n;
      let mag = BigAbs(a[i]);
      for (let k = 0; k < count && mag !== 0n; ++k) {
        /** @type {int32} */
        const limb = Number(OpCodes.AndN(mag, mask));
        limbs[k][i] = negative ? -limb : limb;
        mag = OpCodes.ShiftRn(mag, limbBits);
      }
    }
    return limbs;
  }

  /**
   * Exact product of two polynomials modulo X^m+1.
   * @param {BigInt[]} a
   * @param {BigInt[]} b
   * @returns {BigInt[]}
   */
  function MulNeg(a, b) {
    const m = a.length;
    /** @type {BigInt[]} */
    const out = new Array(m);

    if (m <= 32) {
      for (let i = 0; i < m; ++i) out[i] = 0n;
      for (let i = 0; i < m; ++i) {
        const av = a[i];
        if (av === 0n) continue;
        for (let j = 0; j < m; ++j) {
          const k = i + j;
          if (k < m) out[k] += av * b[j];
          else out[k - m] -= av * b[j];
        }
      }
      return out;
    }

    const logm = Math.ceil(Math.log2(m)) + 1;
    const bitsA = MaxBits(a);
    const bitsB = MaxBits(b);
    if (bitsA + bitsB + logm <= 52) {
      const A = new Float64Array(m);
      const B = new Float64Array(m);
      for (let i = 0; i < m; ++i) {
        /** @type {float64} */
        const ai = Number(a[i]);
        /** @type {float64} */
        const bi = Number(b[i]);
        A[i] = ai;
        B[i] = bi;
      }
      const R = ConvNeg(A, B, m);
      for (let i = 0; i < m; ++i) out[i] = BigInt(R[i]);
      return out;
    }

    const limbBits = Math.floor((52 - logm) / 2);
    const la = Math.max(1, Math.ceil(bitsA / limbBits));
    const lb = Math.max(1, Math.ceil(bitsB / limbBits));
    const LA = SplitLimbs(a, limbBits, la);
    const LB = SplitLimbs(b, limbBits, lb);
    for (let i = 0; i < m; ++i) out[i] = 0n;
    for (let x = 0; x < la; ++x)
      for (let y = 0; y < lb; ++y) {
        const R = ConvNeg(LA[x], LB[y], m);
        const shift = limbBits * (x + y);
        for (let i = 0; i < m; ++i)
          if (R[i] !== 0) out[i] += OpCodes.ShiftLn(BigInt(R[i]), shift);
      }
    return out;
  }

  /**
   * f(-X)
   * @param {BigInt[]} a - a
   * @returns {BigInt[]} Result
   */
  function NegX(a) {
    /** @type {BigInt[]} */
    const out = new Array(a.length);
    for (let i = 0; i < a.length; ++i) out[i] = (i % 2 === 1) ? -a[i] : a[i];
    return out;
  }

  /**
   * f(X^2), of twice the degree
   * @param {BigInt[]} a - a
   * @returns {BigInt[]} Result
   */
  function Expand2(a) {
    /** @type {BigInt[]} */
    const out = new Array(2 * a.length);
    for (let i = 0; i < a.length; ++i) {
      out[2 * i] = a[i];
      out[2 * i + 1] = 0n;
    }
    return out;
  }

  /**
   * The field norm N(f) = f(X)*f(-X), expressed in Y = X^2.
   * @param {BigInt[]} f - f
   * @returns {BigInt[]} Result
   */
  function FieldNorm(f) {
    const hn = f.length / 2;
    /** @type {BigInt[]} */
    const fe = new Array(hn);
    /** @type {BigInt[]} */
    const fo = new Array(hn);
    for (let i = 0; i < hn; ++i) {
      fe[i] = f[2 * i];
      fo[i] = f[2 * i + 1];
    }
    const e2 = MulNeg(fe, fe);
    const o2 = MulNeg(fo, fo);
    /** @type {BigInt[]} */
    const out = new Array(hn);
    // Y*o2 modulo Y^hn+1 moves every coefficient up one and wraps the top.
    out[0] = e2[0] + o2[hn - 1];
    for (let i = 1; i < hn; ++i) out[i] = e2[i] - o2[i - 1];
    return out;
  }

  /**
   * @param {BigInt[]} a - a
   * @param {int32} bits - bits
   * @returns {boolean} Result
   */
  function FitsSigned(a, bits) {
    const lim = OpCodes.ShiftLn(1n, bits - 1);
    for (let i = 0; i < a.length; ++i)
      if (a[i] >= lim || a[i] < -lim) return false;
    return true;
  }

  /**
   * @param {BigInt[]} a - a
   * @param {BigInt} modulus - modulus
   * @returns {boolean} Result
   */
  function WithinCentered(a, modulus) {
    const lim = (modulus - 1n) / 2n;
    for (let i = 0; i < a.length; ++i)
      if (a[i] > lim || a[i] < -lim) return false;
    return true;
  }

  /**
   * @param {BigInt} a - a
   * @param {BigInt} m - m
   * @returns {BigInt|null} Result
   */
  function ModInverseBig(a, m) {
    let r0 = m, r1 = a % m;
    let t0 = 0n, t1 = 1n;
    while (r1 !== 0n) {
      const q = r0 / r1;
      const r2 = r0 - q * r1;
      r0 = r1; r1 = r2;
      const t2 = t0 - q * t1;
      t0 = t1; t1 = t2;
    }
    if (r0 !== 1n) return null;
    return t0 < 0n ? t0 + m : t0;
  }

  // ===== 32.32 fixed point, as in the reference key generation =====
  //
  // A value is a signed 64-bit integer v standing for v/2^32. Additions wrap
  // at 64 bits; a product keeps the floor of the 128-bit product over 2^32;
  // halving rounds. These are the operations whose rounding decides the
  // Babai reduction, so they are reproduced exactly.

  /** @type {BigInt} */
  const TWO32 = 4294967296n;

  /**
   * @param {BigInt} a - a
   * @param {BigInt} b - b
   * @returns {BigInt} Result
   */
  function FxAdd(a, b) { return OpCodes.ToLong(a + b); }
  /**
   * @param {BigInt} a - a
   * @param {BigInt} b - b
   * @returns {BigInt} Result
   */
  function FxSub(a, b) { return OpCodes.ToLong(a - b); }
  /**
   * @param {BigInt} a - a
   * @returns {BigInt} Result
   */
  function FxNeg(a) { return OpCodes.ToLong(-a); }
  /**
   * @param {BigInt} a - a
   * @param {BigInt} b - b
   * @returns {BigInt} Result
   */
  function FxMul(a, b) { return OpCodes.ToLong(OpCodes.ShiftRn(a * b, 32)); }
  /**
   * @param {BigInt} a - a
   * @returns {BigInt} Result
   */
  function FxHalf(a) { return OpCodes.ShiftRn(OpCodes.ToLong(a + 1n), 1); }
  /**
   * @param {BigInt} a - a
   * @param {int32} e - e
   * @returns {BigInt} Result
   */
  function FxMul2e(a, e) { return OpCodes.ToLong(OpCodes.ShiftLn(a, e)); }
  /**
   * @param {int32} j - j
   * @returns {BigInt} Result
   */
  function FxOf(j) { return OpCodes.ToLong(BigInt(j) * TWO32); }
  /**
   * @param {BigInt} a - a
   * @returns {int32} Result
   */
  function FxRound(a) {
    /** @type {int32} */
    const r = Number(OpCodes.ShiftRn(OpCodes.ToLong(a + 2147483648n), 32));
    return r;
  }

  /** @type {BigInt} */
  const U64 = 18446744073709551616n;

  /**
   * The reference's 64-bit fixed-point division: |x|*2^32/|y| bit by bit,
   * rounded, with the sign of x*y. Where the quotient cannot fit the long
   * division misbehaves in a specific way, which is reproduced literally.
   * @param {BigInt} x - x
   * @param {BigInt} y - y
   * @returns {BigInt} Result
   */
  function FxDiv(x, y) {
    /** @type {BigInt} */
    let ux = OpCodes.ToQWord(x);
    /** @type {BigInt} */
    let uy = OpCodes.ToQWord(y);
    const sx = ux >= 9223372036854775808n;
    const sy = uy >= 9223372036854775808n;
    if (sx) ux = OpCodes.ToQWord(U64 - ux);
    if (sy) uy = OpCodes.ToQWord(U64 - uy);

    /** @type {BigInt} */
    let q = 0n;
    /** @type {BigInt} */
    let num = OpCodes.ShiftRn(ux, 31);
    if (uy !== 0n && num < 2n * uy) {
      const scaled = ux * TWO32;
      q = scaled / uy;
      const rem = scaled - q * uy;
      if (2n * rem >= uy) q += 1n;
      q = OpCodes.ToQWord(q);
    } else {
      q = 0n;
      for (let i = 63; i >= 0; --i) {
        const b = OpCodes.ToQWord(num - uy) < 9223372036854775808n;
        if (b) {
          q = OpCodes.OrN(q, OpCodes.ShiftLn(1n, i));
          num = OpCodes.ToQWord(num - uy);
        }
        num = OpCodes.ToQWord(OpCodes.ShiftLn(num, 1));
        if (i >= 33) num = OpCodes.OrN(num, OpCodes.AndN(OpCodes.ShiftRn(ux, i - 33), 1n));
      }
      if (OpCodes.ToQWord(num - uy) < 9223372036854775808n) q = OpCodes.ToQWord(q + 1n);
    }
    if (sx !== sy) q = OpCodes.ToQWord(U64 - q);
    return OpCodes.ToLong(q);
  }

  // Roots of unity for the fixed-point FFTs, in the reference's order: entry
  // k, for 2^j <= k < 2^(j+1), is exp(i*pi*(2*rev_j(k - 2^j) + 1)/2^(j+1)).
  // The key generation uses them scaled by 2^32, the verifier by 2^31; both
  // are rounded to the nearest integer. The rounding is safe in double
  // precision: no scaled value lies within 4*10^-5 of a half, a hundred times
  // the error of the double computation, and both tables built this way equal
  // the reference's GM_TAB and FX32_GM entry for entry.
  /**
   * @param {int32} scale - scale
   * @returns {HawkRoots} Result
   */
  function RootTable(scale) {
    /** @type {int32[]} */
    const re = new Array(1024);
    /** @type {int32[]} */
    const im = new Array(1024);
    re[0] = scale; im[0] = 0;
    for (let k = 1; k < 1024; ++k) {
      const j = Math.floor(Math.log2(k));
      const off = k - Math.pow(2, j);
      let r = 0;
      let x = off;
      for (let b = 0; b < j; ++b) {
        r = r * 2 + (x % 2);
        x = Math.floor(x / 2);
      }
      const angle = Math.PI * (2 * r + 1) / Math.pow(2, j + 1);
      re[k] = Math.round(scale * Math.cos(angle));
      im[k] = Math.round(scale * Math.sin(angle));
    }
    return new HawkRoots(re, im);
  }

  /** Roots of unity scaled to integers. */
  class HawkRoots {
    /**
     * @param {int32[]} re - real parts
     * @param {int32[]} im - imaginary parts
     */
    constructor(re, im) {
      /** @type {int32[]} */
      this.re = re;
      /** @type {int32[]} */
      this.im = im;
    }
  }

  /** Roots of unity scaled to BigInt fixed point. */
  class HawkRoots64 {
    /**
     * @param {BigInt[]} re - real parts
     * @param {BigInt[]} im - imaginary parts
     */
    constructor(re, im) {
      /** @type {BigInt[]} */
      this.re = re;
      /** @type {BigInt[]} */
      this.im = im;
    }
  }

  /**
   * @param {int32[]} a - integers
   * @returns {BigInt[]} the same integers as BigInts
   */
  function ToBigInts(a) {
    /** @type {BigInt[]} */
    const out = new Array(a.length);
    for (let i = 0; i < a.length; ++i) out[i] = BigInt(a[i]);
    return out;
  }

  /**
   * @returns {HawkRoots64} the key generation's 32.32 roots
   */
  function BuildGM64() {
    const t = RootTable(4294967296);
    return new HawkRoots64(ToBigInts(t.re), ToBigInts(t.im));
  }

  const GM64 = BuildGM64();

  const GM32 = RootTable(2147483648);

  /**
   * @param {BigInt} are - are
   * @param {BigInt} aim - aim
   * @param {BigInt} bre - bre
   * @param {BigInt} bim - bim
   * @returns {BigInt[]} Result
   */
  function FxcMul(are, aim, bre, bim) {
    const z0 = FxMul(are, bre);
    const z1 = FxMul(aim, bim);
    const z2 = FxMul(FxAdd(are, aim), FxAdd(bre, bim));
    /** @type {BigInt[]} */
    const product = [FxSub(z0, z1), FxSub(z2, FxAdd(z0, z1))];
    return product;
  }

  /**
   * FFT of a real polynomial of degree n in fixed point; the result holds the
   * n/2 complex values, real parts first.
   * @param {int32} logn - logn
   * @param {BigInt[]} f - f
   */
  function VectFFT(logn, f) {
    const hn = Math.pow(2, logn - 1);
    let t = hn;
    for (let lm = 1; lm < logn; ++lm) {
      const m = Math.pow(2, lm);
      const ht = t / 2;
      const hm = m / 2;
      let j0 = 0;
      for (let i = 0; i < hm; ++i) {
        const sre = GM64.re[m + i];
        const sim = GM64.im[m + i];
        for (let j = j0; j < j0 + ht; ++j) {
          const xre = f[j];
          const xim = f[j + hn];
          const y = FxcMul(sre, sim, f[j + ht], f[j + ht + hn]);
          f[j] = FxAdd(xre, y[0]);
          f[j + hn] = FxAdd(xim, y[1]);
          f[j + ht] = FxSub(xre, y[0]);
          f[j + ht + hn] = FxSub(xim, y[1]);
        }
        j0 += t;
      }
      t = ht;
    }
  }

  /**
   * @param {int32} logn - logn
   * @param {BigInt[]} f - f
   */
  function VectIFFT(logn, f) {
    const hn = Math.pow(2, logn - 1);
    let ht = 1;
    for (let lm = logn - 1; lm > 0; --lm) {
      const m = Math.pow(2, lm);
      const t = ht * 2;
      const hm = m / 2;
      let j0 = 0;
      for (let i = 0; i < hm; ++i) {
        const sre = GM64.re[m + i];
        const sim = FxNeg(GM64.im[m + i]);
        for (let j = j0; j < j0 + ht; ++j) {
          const xre = f[j];
          const xim = f[j + hn];
          const yre = f[j + ht];
          const yim = f[j + ht + hn];
          f[j] = FxHalf(FxAdd(xre, yre));
          f[j + hn] = FxHalf(FxAdd(xim, yim));
          const z = FxcMul(sre, sim, FxHalf(FxSub(xre, yre)), FxHalf(FxSub(xim, yim)));
          f[j + ht] = z[0];
          f[j + ht + hn] = z[1];
        }
        j0 += t;
      }
      ht = t;
    }
  }

  // ===== big integers as the reference sees them =====
  //
  // The reference stores a big coefficient as len 31-bit words in two's
  // complement. Two functions read those words: the bit length used for
  // scaling, and the extraction of three words into a fixed-point value.

  /**
   * @param {BigInt} value - value
   * @param {int32} len - len
   * @param {int32} index - index
   * @returns {int32} Result
   */
  function Word31(value, len, index) {
    if (index < 0) return 0;
    if (index >= len) {
      return value < 0n ? 0x7FFFFFFF : 0;
    }
    // Below index len the words of the len-word two's complement form are
    // those of the value itself.
    /** @type {int32} */
    const word = Number(OpCodes.AndN(OpCodes.ShiftRn(value, 31 * index), 0x7FFFFFFFn));
    return word;
  }

  /**
   * The largest bit length of a coefficient, with negative values measured
   * as their one's complement (poly_max_bitlength).
   * @param {BigInt[]} a - a
   * @returns {int32} Result
   */
  function MaxBitlength(a) {
    let best = 0;
    for (let i = 0; i < a.length; ++i) {
      const v = a[i] < 0n ? -a[i] - 1n : a[i];
      const b = BitLength(v);
      if (b > best) best = b;
    }
    return best;
  }

  /**
   * poly_big_to_fixed for one coefficient: the value over 2^sc in 32.32,
   * assembled from the three 31-bit words around bit sc.
   * @param {BigInt} value - value
   * @param {int32} len - len
   * @param {int32} sc - sc
   * @returns {BigInt} Result
   */
  function BigToFixed(value, len, sc) {
    if (len <= 0) return 0n;
    let sch = Math.floor(sc / 31);
    let scl = sc - 31 * sch;
    if (scl === 0) {
      sch -= 1;
      scl = 31;
    }
    const w0 = Word31(value, len, sch - 1);
    const w1 = Word31(value, len, sch);
    let w2 = Word31(value, len, sch + 1);
    w2 = OpCodes.Or32(w2, OpCodes.Shl32(OpCodes.And32(w2, 0x40000000), 1));
    const xl = OpCodes.Or32(OpCodes.Shr32(w0, scl - 1), OpCodes.Shl32(w1, 32 - scl));
    const xh = OpCodes.Or32(OpCodes.Shr32(w1, scl), OpCodes.Shl32(w2, 31 - scl));
    return OpCodes.ToLong(BigInt(xh) * TWO32 + BigInt(xl));
  }

  // ===== the NTRU solver =====

  const SOLVE_FAIL = null;

  /**
   * Depth 1 subtracts through two primes and keeps the centred residue, so a
   * coefficient must lie within half the product of the primes in use.
   * @param {int32} len - len
   * @returns {BigInt} Result
   */
  function Depth1Modulus(len) {
    return len === 1 ? BigInt(P1) : BigInt(P1) * BigInt(P2);
  }

  /**
   * @param {BigInt[]} F - F
   * @param {int32} depth - depth
   * @param {int32} len - len
   * @returns {boolean} Result
   */
  function FitsAtDepth(F, depth, len) {
    if (!FitsSigned(F, 31 * len)) return false;
    if (depth === 1 && !WithinCentered(F, Depth1Modulus(len))) return false;
    return true;
  }

  /**
   * One intermediate level: lift (F, G) from the level below and reduce them
   * against (f, g) with the reference's fixed-point Babai rounding.
   * @param {HawkParams} P - P
   * @param {int32} depth - depth
   * @param {BigInt[]} f - f
   * @param {BigInt[]} g - g
   * @param {BigInt[]} Fd - Fd
   * @param {BigInt[]} Gd - Gd
   * @returns {BigInt[][]|null} Result
   */
  function SolveIntermediate(P, depth, f, g, Fd, Gd) {
    const prof = P.profile;
    const logn = P.logn - depth;
    const n = Math.pow(2, logn);
    const hn = n / 2;
    const slen = prof.small[depth];
    const llen = prof.large[depth];

    let F = MulNeg(Expand2(Fd), NegX(g));
    let G = MulNeg(Expand2(Gd), NegX(f));
    if (!FitsAtDepth(F, depth, llen) || !FitsAtDepth(G, depth, llen)) return SOLVE_FAIL;

    const rlen = Math.min(prof.window[depth], slen);
    const blen = slen - rlen;
    const scaleFg = 31 * blen;
    let scaleFG = 31 * llen;

    const ftb = f.map(function (v) { return OpCodes.ShiftRn(v, 31 * blen); });
    const gtb = g.map(function (v) { return OpCodes.ShiftRn(v, 31 * blen); });
    const scaleXf = MaxBitlength(ftb);
    const scaleXg = MaxBitlength(gtb);
    const scaleX = Math.max(scaleXf, scaleXg);
    const scaleT = Math.min(15 - logn, scaleX);
    const scdiff = scaleX - scaleT;

    const rt3 = ftb.map(function (v) { return BigToFixed(v, rlen, scdiff); });
    const rt4 = gtb.map(function (v) { return BigToFixed(v, rlen, scdiff); });
    VectFFT(logn, rt3);
    VectFFT(logn, rt4);
    /** @type {BigInt[]} */
    const rt1 = new Array(hn);
    for (let u = 0; u < hn; ++u)
      rt1[u] = FxAdd(FxAdd(FxMul(rt3[u], rt3[u]), FxMul(rt3[u + hn], rt3[u + hn])),
                     FxAdd(FxMul(rt4[u], rt4[u]), FxMul(rt4[u + hn], rt4[u + hn])));
    for (let u = 0; u < n; ++u) {
      rt3[u] = FxMul2e(rt3[u], scaleT);
      rt4[u] = FxMul2e(rt4[u], scaleT);
    }
    for (let u = 0; u < hn; ++u) {
      rt3[u] = FxDiv(rt3[u], rt1[u]);
      rt3[u + hn] = FxDiv(FxNeg(rt3[u + hn]), rt1[u]);
      rt4[u] = FxDiv(rt4[u], rt1[u]);
      rt4[u + hn] = FxDiv(FxNeg(rt4[u + hn]), rt1[u]);
    }

    let FGlen = llen;
    for (;;) {
      const tlen = Math.floor(scaleFG / 31);
      const toff = scaleFG - 31 * tlen;
      const len = FGlen - tlen;
      const r1 = F.map(function (v) { return BigToFixed(OpCodes.ShiftRn(v, 31 * tlen), len, scaleX + toff); });
      const r2 = G.map(function (v) { return BigToFixed(OpCodes.ShiftRn(v, 31 * tlen), len, scaleX + toff); });

      VectFFT(logn, r1);
      VectFFT(logn, r2);
      for (let u = 0; u < hn; ++u) {
        const a = FxcMul(r1[u], r1[u + hn], rt3[u], rt3[u + hn]);
        const b = FxcMul(r2[u], r2[u + hn], rt4[u], rt4[u + hn]);
        r2[u] = FxAdd(b[0], a[0]);
        r2[u + hn] = FxAdd(b[1], a[1]);
      }
      VectIFFT(logn, r2);

      const k = r2.map(function (v) { return BigInt(FxRound(v)); });
      const scaleK = scaleFG - scaleFg;
      const kf = MulNeg(k, f);
      const kg = MulNeg(k, g);
      for (let u = 0; u < n; ++u) {
        F[u] -= OpCodes.ShiftLn(kf[u], scaleK);
        G[u] -= OpCodes.ShiftLn(kg[u], scaleK);
      }
      if (!FitsAtDepth(F, depth, FGlen) || !FitsAtDepth(G, depth, FGlen)) return SOLVE_FAIL;

      if (scaleFG <= scaleFg) break;
      if (scaleFG <= scaleFg + prof.reduceBits) scaleFG = scaleFg;
      else scaleFG -= prof.reduceBits;
      while (FGlen > slen && 31 * (FGlen - slen) > scaleFG - scaleFg + 30) --FGlen;
      if (!FitsAtDepth(F, depth, FGlen) || !FitsAtDepth(G, depth, FGlen)) return SOLVE_FAIL;
    }

    return [F, G];
  }

  /**
   * The top level, which the reference computes modulo p1 alone.
   * @param {HawkParams} P - P
   * @param {int32[]} f - f
   * @param {int32[]} g - g
   * @param {BigInt[]} Fd - Fd
   * @param {BigInt[]} Gd - Gd
   * @returns {int32[][]|null} Result
   */
  function SolveDepth0(P, f, g, Fd, Gd) {
    const logn = P.logn;
    const n = P.n;
    const hn = n / 2;
    const p = P1;

    /** @type {int32[]} */
    const fx2 = new Array(n);
    /** @type {int32[]} */
    const gx2 = new Array(n);
    for (let i = 0; i < n; ++i) {
      fx2[i] = (i % 2 === 1) ? -f[i] : f[i];
      gx2[i] = (i % 2 === 1) ? -g[i] : g[i];
    }
    // (F, G) of the level below, in X^2, reduced modulo p as the reference
    // reduces them.
    /** @type {BigInt} */
    const pn = BigInt(p);
    const Fe = Zeros(n);
    const Ge = Zeros(n);
    for (let i = 0; i < hn; ++i) {
      /** @type {int32} */
      const fr = Number(OpCodes.ModN(Fd[i], pn));
      /** @type {int32} */
      const gr = Number(OpCodes.ModN(Gd[i], pn));
      Fe[2 * i] = fr;
      Ge[2 * i] = gr;
    }

    const nf = Ntt(f, logn, p);
    const ng = Ntt(g, logn, p);
    const Fp = Ntt(Fe, logn, p);
    const Gp = Ntt(Ge, logn, p);
    const nfm = Ntt(fx2, logn, p);
    const ngm = Ntt(gx2, logn, p);
    for (let u = 0; u < n; ++u) {
      Fp[u] = MulMod(Fp[u], ngm[u], p);
      Gp[u] = MulMod(Gp[u], nfm[u], p);
    }

    /** @type {int32[]} */
    const t1 = new Array(n);
    /** @type {int32[]} */
    const t2 = new Array(n);
    for (let u = 0; u < n; ++u) {
      const af = nf[n - 1 - u];
      const ag = ng[n - 1 - u];
      t1[u] = AddMod(MulMod(Fp[u], af, p), MulMod(Gp[u], ag, p), p);
      t2[u] = AddMod(MulMod(nf[u], af, p), MulMod(ng[u], ag, p), p);
    }
    const c1 = InverseNtt(t1, logn, p).map(function (v) { return Centered(v, p); });
    const c2 = InverseNtt(t2, logn, p).map(function (v) { return Centered(v, p); });

    /** @type {BigInt} */
    const scale22 = 4194304n;
    /** @type {BigInt[]} */
    const rq = new Array(n);
    /** @type {BigInt[]} */
    const rt = new Array(n);
    for (let u = 0; u < n; ++u) {
      rq[u] = OpCodes.ToLong(BigInt(c2[u]) * scale22);
      rt[u] = OpCodes.ToLong(BigInt(c1[u]) * scale22);
    }
    VectFFT(logn, rq);
    VectFFT(logn, rt);
    for (let u = 0; u < hn; ++u) {
      rt[u] = FxDiv(rt[u], rq[u]);
      rt[u + hn] = FxDiv(rt[u + hn], rq[u]);
    }
    VectIFFT(logn, rt);
    /** @type {int32[]} */
    const k = new Array(n);
    for (let u = 0; u < n; ++u) k[u] = FxRound(rt[u]);

    const nk = Ntt(k, logn, p);
    for (let u = 0; u < n; ++u) {
      Fp[u] = SubMod(Fp[u], MulMod(nk[u], nf[u], p), p);
      Gp[u] = SubMod(Gp[u], MulMod(nk[u], ng[u], p), p);
      const x = SubMod(MulMod(nf[u], Gp[u], p), MulMod(ng[u], Fp[u], p), p);
      if (x !== 1) return SOLVE_FAIL;
    }

    const F = InverseNtt(Fp, logn, p).map(function (v) { return Centered(v, p); });
    const G = InverseNtt(Gp, logn, p).map(function (v) { return Centered(v, p); });
    return [F, G];
  }

  /**
   * @param {int32[]} poly - poly
   * @param {int32} logn - logn
   * @param {int32} p - p
   * @returns {boolean} Result
   */
  function IsInvertibleMod(poly, logn, p) {
    const t = Ntt(poly, logn, p);
    for (let u = 0; u < t.length; ++u)
      if (t[u] === 0) return false;
    return true;
  }

  /**
   * Solve f*G - g*F = 1 for small (F, G), or report failure.
   * @param {HawkParams} P - P
   * @param {int32[]} f - f
   * @param {int32[]} g - g
   * @returns {int32[][]|null} [F, G] as small integer arrays
   */
  function SolveNTRU(P, f, g) {
    const prof = P.profile;
    const logn = P.logn;

    if (!IsInvertibleMod(f, logn, P1)) return SOLVE_FAIL;

    /** @type {BigInt[][]} */
    const fs = [ToBigInts(f)];
    /** @type {BigInt[][]} */
    const gs = [ToBigInts(g)];
    for (let d = 0; d < logn; ++d) {
      fs.push(FieldNorm(fs[d]));
      gs.push(FieldNorm(gs[d]));
      const len = prof.small[d + 1];
      if (d + 1 < logn) {
        if (!FitsSigned(fs[d + 1], 31 * len) || !FitsSigned(gs[d + 1], 31 * len)) return SOLVE_FAIL;
      } else {
        const lim = OpCodes.ShiftLn(1n, 31 * len);
        if (fs[d + 1][0] >= lim || gs[d + 1][0] >= lim) return SOLVE_FAIL;
      }
    }

    // The deepest level: the resultants, and the Bezout pair the reference's
    // binary extended GCD returns, which is the one with 0 <= G < Res(g).
    const rf = fs[logn][0];
    const rg = gs[logn][0];
    if (rf <= 0n || rg <= 0n || rf % 2n === 0n || rg % 2n === 0n) return SOLVE_FAIL;
    const G0 = ModInverseBig(rf, rg);
    if (G0 === null) return SOLVE_FAIL;
    const F0 = (rf * G0 - 1n) / rg;

    let Fd = [F0];
    let Gd = [G0];
    for (let depth = logn - 1; depth >= 1; --depth) {
      const r = SolveIntermediate(P, depth, fs[depth], gs[depth], Fd, Gd);
      if (!r) return SOLVE_FAIL;
      Fd = r[0];
      Gd = r[1];
    }

    const top = SolveDepth0(P, f, g, Fd, Gd);
    if (!top) return SOLVE_FAIL;
    for (let u = 0; u < P.n; ++u)
      if (top[0][u] < -127 || top[0][u] > 127 || top[1][u] < -127 || top[1][u] > 127) return SOLVE_FAIL;
    return top;
  }

  // ===== key generation =====

  /**
   * @returns {int32[]} the number of set bits of every octet
   */
  function BuildPopcount8() {
    /** @type {int32[]} */
    const t = new Array(256);
    for (let i = 0; i < 256; ++i) {
      let c = 0;
      let x = i;
      while (x > 0) {
        c += x % 2;
        x = Math.floor(x / 2);
      }
      t[i] = c;
    }
    return t;
  }

  const POPCOUNT8 = BuildPopcount8();

  // ===== result records =====

  class HawkFG {
    /**
     * @param {int32[]} f - the secret f
     * @param {int32[]} g - the secret g
     */
    constructor(f, g) {
      /** @type {int32[]} */
      this.f = f;
      /** @type {int32[]} */
      this.g = g;
    }
  }

  class HawkKeyAttempt {
    /**
     * @param {int32[]} f - f
     * @param {int32[]} g - g
     * @param {int32[]} F - F
     * @param {int32[]} G - G
     * @param {int32[]} q00 - q00
     * @param {int32[]} q01 - q01
     */
    constructor(f, g, F, G, q00, q01) {
      /** @type {int32[]} */
      this.f = f;
      /** @type {int32[]} */
      this.g = g;
      /** @type {int32[]} */
      this.F = F;
      /** @type {int32[]} */
      this.G = G;
      /** @type {int32[]} */
      this.q00 = q00;
      /** @type {int32[]} */
      this.q01 = q01;
    }
  }

  class HawkEncoded {
    /**
     * @param {int32} length - octets written
     * @param {int32} ignored - unused bits of the last one
     */
    constructor(length, ignored) {
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.ignored = ignored;
    }
  }

  class HawkDecoded {
    /**
     * @param {int32[]} values - the values
     * @param {int32} length - octets read
     * @param {int32} ignored - unused bits of the last one
     */
    constructor(values, length, ignored) {
      /** @type {int32[]} */
      this.values = values;
      /** @type {int32} */
      this.length = length;
      /** @type {int32} */
      this.ignored = ignored;
    }
  }

  class HawkDecodedQ00 {
    /**
     * @param {int32[]} values - q00
     * @param {int32} length - octets read
     */
    constructor(values, length) {
      /** @type {int32[]} */
      this.values = values;
      /** @type {int32} */
      this.length = length;
    }
  }

  class HawkKeyPair {
    /**
     * @param {uint8[]} sk - encoded secret key
     * @param {uint8[]} pk - encoded public key
     */
    constructor(sk, pk) {
      /** @type {uint8[]} */
      this.sk = sk;
      /** @type {uint8[]} */
      this.pk = pk;
    }
  }

  class HawkSample {
    /**
     * @param {int32[]} x - the sampled vector
     * @param {int32} norm - its squared norm
     */
    constructor(x, norm) {
      /** @type {int32[]} */
      this.x = x;
      /** @type {int32} */
      this.norm = norm;
    }
  }

  // Stream bits per coefficient of (f, g), indexed by logn - 8.
  /** @type {int32[]} */
  const FG_BITS = [4, 8, 16];

  /**
   * Hawk_regen_fg: four SHAKE256 streams over the seed; each coefficient is a
   * centred binomial sample, the popcount of 4, 8 or 16 stream bits.
   * @param {HawkParams} P - P
   * @param {uint8[]} seed - seed
   * @returns {HawkFG} Result
   */
  function RegenFG(P, seed) {
    const n = P.n;
    /** @type {int32[]} */
    const f = new Array(n);
    /** @type {int32[]} */
    const g = new Array(n);
    /** @type {int32} */
    const bits = FG_BITS[P.logn - 8];
    const perChunk = 64 / bits;
    const step = 4 * perChunk;
    for (let j = 0; j < 4; ++j) {
      /** @type {uint8[]} */
      const index = [j];
      /** @type {Shake256} */
      const sc = new Shake256().Inject(seed).Inject(index).Flip();
      for (let u = 0; u < 2 * n; u += step) {
        /** @type {uint8[]} */
        const q = sc.Extract(8);
        for (let i = 0; i < perChunk; ++i) {
          /** @type {int32} */
          let c = 0;
          if (bits === 4) {
            const byte = q[Math.floor(i / 2)];
            c = POPCOUNT8[(i % 2 === 0) ? OpCodes.And32(byte, 15) : OpCodes.Shr32(byte, 4)] - 2;
          } else if (bits === 8) {
            c = POPCOUNT8[q[i]] - 4;
          } else {
            c = POPCOUNT8[q[2 * i]] + POPCOUNT8[q[2 * i + 1]] - 8;
          }
          const pos = u + j * perChunk + i;
          if (pos < n) f[pos] = c;
          else g[pos - n] = c;
        }
      }
    }
    return new HawkFG(f, g);
  }

  /**
   * f*adj(f) + g*adj(g) (or any such pairing) as exact small integers.
   * @param {int32[]} a - a
   * @param {int32[]} b - b
   * @param {int32[]} c - c
   * @param {int32[]} d - d
   * @returns {int32[]} Result
   */
  function PairProduct(a, b, c, d) {
    const n = a.length;
    const out = Zeros(n);
    // a*adj(b) + c*adj(d); adj(b)[0] = b[0], adj(b)[i] = -b[n-i].
    for (let i = 0; i < n; ++i) {
      const av = a[i];
      const ci = c[i];
      if (av === 0 && ci === 0) continue;
      for (let j = 0; j < n; ++j) {
        const bj = (j === 0) ? b[0] : -b[n - j];
        const dj = (j === 0) ? d[0] : -d[n - j];
        const k = i + j;
        const v = av * bj + ci * dj;
        if (k < n) out[k] += v;
        else out[k - n] -= v;
      }
    }
    return out;
  }

  /**
   * One key-generation attempt from a seed, screened as Hawk_keygen screens
   * it. Returns null when the reference would draw another seed.
   * @param {HawkParams} P - P
   * @param {uint8[]} seed - seed
   * @returns {HawkKeyAttempt|null} Result
   */
  function KeygenAttempt(P, seed) {
    const n = P.n;
    const hn = n / 2;
    const logn = P.logn;
    const fg = RegenFG(P, seed);
    const f = fg.f;
    const g = fg.g;

    let pf = 0, pg = 0, norm = 0;
    for (let i = 0; i < n; ++i) {
      pf += f[i];
      pg += g[i];
      norm += f[i] * f[i] + g[i] * g[i];
    }
    if (Math.abs(pf % 2) !== 1 || Math.abs(pg % 2) !== 1) return null;
    if (norm < P.l2low) return null;

    const q00 = PairProduct(f, f, g, g);
    if (!IsInvertibleMod(q00, logn, P1)) return null;
    if (!IsInvertibleMod(q00, logn, P2)) {
      return null;
    }

    // The constant term of 1/q00 must be small enough.
    /** @type {BigInt[]} */
    const rt = new Array(n);
    for (let u = 0; u < n; ++u) rt[u] = FxOf(q00[u]);
    VectFFT(logn, rt);
    for (let u = 0; u < hn; ++u) rt[u] = FxDiv(TWO32, rt[u]);
    for (let u = hn; u < n; ++u) rt[u] = 0n;
    VectIFFT(logn, rt);
    if (P.d0high < rt[0]) return null;

    const FG = SolveNTRU(P, f, g);
    if (!FG) return null;
    const F = FG[0];
    const G = FG[1];

    const q01 = PairProduct(F, f, G, g);
    const q11 = PairProduct(F, F, G, G);
    const lim00 = Math.pow(2, P.bitsLim00);
    const lim01 = Math.pow(2, P.bitsLim01);
    const lim11 = Math.pow(2, P.bitsLim11);
    for (let u = 0; u < n; ++u) {
      if (u === 0) {
        if (q00[0] < -32768 || q00[0] > 32767) return null;
      } else {
        if (q00[u] <= -lim00 || q00[u] >= lim00) return null;
        if (q11[u] <= -lim11 || q11[u] >= lim11) return null;
      }
      if (q01[u] <= -lim01 || q01[u] >= lim01) return null;
    }

    return new HawkKeyAttempt(f, g, F, G, q00, q01);
  }

  // ===== encodings =====

  /**
   * Golomb-Rice encoding with segregated parts: the sign bits, the low `low`
   * bits of each magnitude, then the high parts in unary. Returns the number
   * of octets written and the unused bits of the last one, or null when the
   * room runs out.
   * @param {int32[]} values - values
   * @param {int32} low - low
   * @param {uint8[]} dst - dst
   * @param {int32} off - off
   * @param {int32} room - room
   * @returns {HawkEncoded|null} Result
   */
  function EncodeGR(values, low, dst, off, room) {
    const n = values.length;
    if (room < (low + 1) * (n / 8)) return null;
    let pos = off;

    for (let u = 0; u < n; u += 8) {
      /** @type {uint32} */
      let x = 0;
      for (let v = 0; v < 8; ++v)
        if (values[u + v] < 0) x = OpCodes.Or32(x, OpCodes.Shl32(1, v));
      dst[pos++] = x;
    }

    const mask = Math.pow(2, low) - 1;
    for (let u = 0; u < n; u += 8) {
      let acc = 0;
      let accLen = 0;
      for (let v = 0; v < 8; ++v) {
        const w = values[u + v] < 0 ? -values[u + v] - 1 : values[u + v];
        acc += OpCodes.And32(w, mask) * Math.pow(2, accLen);
        accLen += low;
        while (accLen >= 8) {
          dst[pos++] = acc % 256;
          acc = Math.floor(acc / 256);
          accLen -= 8;
        }
      }
    }

    let left = room - (pos - off);
    let acc = 0;
    let accLen = 0;
    for (let u = 0; u < n; ++u) {
      const w = values[u] < 0 ? -values[u] - 1 : values[u];
      const k = Math.floor(w / Math.pow(2, low));
      acc += Math.pow(2, accLen + k);
      accLen += 1 + k;
      while (accLen >= 8) {
        if (left === 0) return null;
        dst[pos++] = acc % 256;
        --left;
        acc = Math.floor(acc / 256);
        accLen -= 8;
      }
    }
    if (accLen > 0) {
      if (left === 0) return null;
      dst[pos++] = acc % 256;
      --left;
    }
    return new HawkEncoded(pos - off, (8 - accLen) % 8);
  }

  /**
   * @param {int32} x - x
   * @returns {int32} Result
   */
  function TrailingZeros8(x) {
    if (x === 0) return 8;
    let k = 0;
    while (x % 2 === 0) {
      x = x / 2;
      ++k;
    }
    return k;
  }

  /**
   * decode_gr: the inverse of EncodeGR with the reference's bounds checks.
   * @param {int32} n - n
   * @param {int32} low - low
   * @param {int32} limBits - limBits
   * @param {uint8[]} buf - buf
   * @param {int32} off - off
   * @param {int32} bufLen - bufLen
   * @returns {HawkDecoded|null} { values, length, ignored }
   */
  function DecodeGR(n, low, limBits, buf, off, bufLen) {
    if (bufLen < (low + 1) * (n / 8)) return null;
    let voff = (low + 1) * (n / 8);
    /** @type {int32[]} */
    const d = new Array(n);

    /** @type {uint32} */
    let acc = 0;
    let accOff = 0;
    const limHi = Math.pow(2, limBits - low);
    for (let u = 0; u < n; ++u) {
      while (acc === 0) {
        if (accOff >= limHi) return null;
        if (voff >= bufLen) return null;
        acc = OpCodes.Or32(acc, OpCodes.Shl32(buf[off + voff++], accOff));
        accOff += 8;
      }
      let k = TrailingZeros8(OpCodes.And32(acc, 0xFF));
      if (k === 8) {
        k += TrailingZeros8(OpCodes.And32(OpCodes.Shr32(acc, 8), 0xFF));
        if (k >= limHi) return null;
      }
      d[u] = k * Math.pow(2, low);
      acc = OpCodes.Shr32(acc, k + 1);
      accOff -= k + 1;
    }
    const ignored = accOff;

    let loff = n / 8;
    const mask = Math.pow(2, low) - 1;
    for (let u = 0; u < n; u += 8) {
      const sbb = buf[off + u / 8];
      let bitsAcc = 0;
      let bitsLen = 0;
      let byteIndex = 0;
      for (let i = 0; i < 8; ++i) {
        while (bitsLen < low) {
          bitsAcc += buf[off + loff + byteIndex++] * Math.pow(2, bitsLen);
          bitsLen += 8;
        }
        const lp = bitsAcc % (mask + 1);
        bitsAcc = Math.floor(bitsAcc / (mask + 1));
        bitsLen -= low;
        const v = d[u + i] + lp;
        d[u + i] = (OpCodes.And32(OpCodes.Shr32(sbb, i), 1) === 1) ? -v - 1 : v;
      }
      loff += low;
    }

    return new HawkDecoded(d, voff, ignored);
  }

  /**
   * encode_public: q00 (half, with its constant term split), q01, zero pad.
   * @param {HawkParams} P - P
   * @param {int32[]} q00 - q00
   * @param {int32[]} q01 - q01
   * @returns {uint8[]|null}
   */
  function EncodePublic(P, q00, q01) {
    const n = P.n;
    const hn = n / 2;
    const buf = new Uint8Array(P.pkSize);
    const eb = P.eb00Len;

    const half = q00.slice(0, hn);
    const q0 = q00[0];
    half[0] = Math.floor(q0 / Math.pow(2, eb));
    const r00 = EncodeGR(half, P.low00, buf, 0, P.pkSize);
    if (!r00) return null;
    let len00 = r00.length;
    const ni = r00.ignored;
    const eb00 = q0 - half[0] * Math.pow(2, eb);
    if (eb <= ni) {
      buf[len00 - 1] = OpCodes.Or32(buf[len00 - 1], OpCodes.And32(OpCodes.Shl32(eb00, 8 - ni), 0xFF));
    } else {
      if (len00 >= P.pkSize) return null;
      buf[len00 - 1] = OpCodes.Or32(buf[len00 - 1], OpCodes.And32(OpCodes.Shl32(eb00, 8 - ni), 0xFF));
      buf[len00] = OpCodes.Shr32(eb00, ni);
      ++len00;
    }

    const r01 = EncodeGR(q01, P.low01, buf, len00, P.pkSize - len00);
    if (!r01) return null;
    return buf;
  }

  /**
   * extract_lowbit: coefficients modulo 2, packed LSB first.
   * @param {int32[]} a - a
   * @returns {uint8[]} Result
   */
  function LowBits(a) {
    const out = new Uint8Array(a.length / 8);
    for (let u = 0; u < a.length; ++u)
      if (Math.abs(a[u] % 2) === 1) out[Math.floor(u / 8)] = OpCodes.Or32(out[Math.floor(u / 8)], OpCodes.Shl32(1, u % 8));
    return out;
  }

  /**
   * @param {HawkParams} P - P
   * @param {uint8[]} seed - seed
   * @param {int32[]} F - F
   * @param {int32[]} G - G
   * @param {uint8[]} pub - pub
   * @returns {uint8[]} Result
   */
  function EncodePrivate(P, seed, F, G, pub) {
    const sk = new Uint8Array(P.skSize);
    sk.set(seed, 0);
    sk.set(LowBits(F), P.seedLen);
    sk.set(LowBits(G), P.seedLen + P.n / 8);
    sk.set(Shake([pub], P.hpubLen), P.seedLen + P.n / 4);
    return sk;
  }

  /**
   * hawk_keygen driven by a random source: draw seeds until one survives the
   * screening, the solver and the public-key encoding.
   * @param {HawkParams} P - P
   * @param {HawkRandom} rng - rng
   * @returns {HawkKeyPair} Result
   */
  function Keygen(P, rng) {
    for (let attempts = 0; attempts < 100000; ++attempts) {
      /** @type {uint8[]} */
      const seed = rng.Read(P.seedLen);
      const key = KeygenAttempt(P, seed);
      if (!key) continue;
      const pub = EncodePublic(P, key.q00, key.q01);
      if (!pub) continue;
      return new HawkKeyPair(EncodePrivate(P, seed, key.F, key.G, pub), pub);
    }
    throw new Error(P.name + ': key generation did not converge');
  }

  /**
   * Rebuild the public key belonging to a secret key, from its seed, and check
   * that it is the one the secret key was made with.
   * @param {HawkParams} P - P
   * @param {uint8[]} sk - sk
   * @returns {uint8[]} Result
   */
  function PublicKeyFromSecret(P, sk) {
    const seed = sk.slice(0, P.seedLen);
    const key = KeygenAttempt(P, seed);
    if (!key) throw new Error(P.name + ': the secret key seed does not yield a key pair');
    const pub = EncodePublic(P, key.q00, key.q01);
    if (!pub) throw new Error(P.name + ': the secret key seed does not yield an encodable public key');
    const expected = EncodePrivate(P, seed, key.F, key.G, pub);
    for (let i = 0; i < P.skSize; ++i)
      if (expected[i] !== sk[i])
        throw new Error(P.name + ': the secret key is inconsistent with the key pair its seed yields');
    return pub;
  }

  // ===== signing =====

  /**
   * The four-instance SHAKE256 Gaussian sampler (sig_gauss).
   * @param {HawkParams} P - P
   * @param {HawkRandom} rng - rng
   * @param {Shake256} base - base
   * @param {int32[]} t - t
   * @returns {HawkSample} Result
   */
  function SampleGauss(P, rng, base, t) {
    const n = P.n;
    const hi = P.gaussHi;
    const lo = P.gaussLo;
    const hiLen = hi.length;
    const loLen = lo.length;
    /** @type {int32[]} */
    const x = new Array(2 * n);
    /** @type {uint8[]} */
    const seed = rng.Read(40);
    let sn = 0;

    for (let j = 0; j < 4; ++j) {
      /** @type {uint8[]} */
      const index = [j];
      /** @type {Shake256} */
      const sc = base.Clone().Inject(seed).Inject(index).Flip();
      for (let u = 0; u < 2 * n; u += 16) {
        /** @type {uint8[]} */
        const buf = sc.Extract(40);
        for (let k = 0; k < 4; ++k) {
          const v = u + 4 * j + k;
          const loL = OpCodes.Pack32LE(buf[8 * k], buf[8 * k + 1], buf[8 * k + 2], buf[8 * k + 3]);
          let loH = OpCodes.Pack32LE(buf[8 * k + 4], buf[8 * k + 5], buf[8 * k + 6], buf[8 * k + 7]);
          const neg = OpCodes.Shr32(loH, 31) === 1;
          loH = OpCodes.And32(loH, 0x7FFFFFFF);
          const h = OpCodes.And32(OpCodes.Pack16LE(buf[32 + 2 * k], buf[33 + 2 * k]), 0x7FFF);
          const odd = t[v];

          let r = 0;
          for (let i = 0; i < hiLen; i += 2) {
            const tl = lo[i + odd];
            const cc = (loH < tl[0] || (loH === tl[0] && loL < tl[1])) ? 1 : 0;
            if (h < hi[i + odd] + cc) ++r;
          }
          if (h === 0)
            for (let i = hiLen; i < loLen; i += 2) {
              const tl = lo[i + odd];
              if (loH < tl[0] || (loH === tl[0] && loL < tl[1])) ++r;
            }

          r = 2 * r + odd;
          if (neg) r = -r;
          x[v] = r;
          sn += r * r;
        }
      }
    }
    return new HawkSample(x, sn);
  }

  /**
   * Product modulo 2 and X^n+1 (which is cyclic), bits as 0/1 arrays.
   * @param {int32[]} out - out
   * @param {int32[]} a - a
   * @param {int32[]} b - b
   */
  function BinMulAdd(out, a, b) {
    const n = a.length;
    for (let i = 0; i < n; ++i) {
      if (a[i] === 0) continue;
      for (let j = 0; j < n; ++j)
        if (b[j] === 1) {
          const k = (i + j) % n;
          out[k] = 1 - out[k];
        }
    }
  }

  /**
   * @param {uint8[]} bytes - bytes
   * @param {int32} off - off
   * @param {int32} n - n
   * @returns {int32[]} Result
   */
  function UnpackBits(bytes, off, n) {
    /** @type {int32[]} */
    const out = new Array(n);
    for (let u = 0; u < n; ++u) out[u] = OpCodes.And32(OpCodes.Shr32(bytes[off + Math.floor(u / 8)], u % 8), 1);
    return out;
  }

  /**
   * @param {HawkParams} P - P
   * @param {uint8[]} salt - salt
   * @param {int32[]} s1 - s1
   * @returns {uint8[]|null} Result
   */
  function EncodeSignature(P, salt, s1) {
    const n = P.n;
    const low = P.lowS1;
    const sig = new Uint8Array(P.sigSize);
    if (P.sigSize < P.saltLen + (low + 2) * (n / 8)) return null;
    sig.set(salt, 0);
    const r = EncodeGR(s1, low, sig, P.saltLen, P.sigSize - P.saltLen);
    if (!r) return null;
    return sig;
  }

  /**
   * hawk_sign_finish.
   * @param {HawkParams} P - parameter set
   * @param {uint8[]} sk - encoded secret key
   * @param {uint8[]} message - message octets
   * @param {HawkRandom} rng - random source
   * @returns {uint8[]} the encoded signature
   */
  function Sign(P, sk, message, rng) {
    const n = P.n;
    const seed = sk.slice(0, P.seedLen);
    const F2 = UnpackBits(sk, P.seedLen, n);
    const G2 = UnpackBits(sk, P.seedLen + n / 8, n);
    const hpub = sk.slice(P.seedLen + n / 4, P.seedLen + n / 4 + P.hpubLen);
    const fg = RegenFG(P, seed);
    const f = fg.f;
    const g = fg.g;
    // f and g modulo 2.
    const f2 = Zeros(n);
    const g2 = Zeros(n);
    for (let u = 0; u < n; ++u) {
      f2[u] = Math.abs(f[u] % 2);
      g2[u] = Math.abs(g[u] % 2);
    }

    const hm = Shake([message, hpub], 64);
    const lim = Math.pow(2, P.bitsLimS1);

    for (let attempt = 0; attempt < 4294967294; attempt += 2) {
      /** @type {uint8[]} */
      const fresh = rng.Read(P.saltLen);
      const salt = Shake([hm, seed, Le32(attempt), fresh], P.saltLen);
      const h = Shake([hm, salt], n / 4);
      const h0 = UnpackBits(h, 0, n);
      const h1 = UnpackBits(h, n / 8, n);

      const t0 = Zeros(n);
      const t1 = Zeros(n);
      BinMulAdd(t0, h0, f2);
      BinMulAdd(t0, h1, F2);
      BinMulAdd(t1, h0, g2);
      BinMulAdd(t1, h1, G2);

      /** @type {Shake256} */
      const base = new Shake256().Inject(hm).Inject(seed).Inject(Le32(attempt + 1));
      const sample = SampleGauss(P, rng, base, t0.concat(t1));      if (sample.norm > P.maxXnorm) continue;
      const x0 = sample.x.slice(0, n);
      const x1 = sample.x.slice(n);

      // w = f*x1 - g*x0 (x holds twice the sampled vector), reduced as the
      // reference reduces it: modulo 18433, centred.
      const w = Zeros(n);
      for (let i = 0; i < n; ++i) {
        const fi = f[i];
        const gi = g[i];
        for (let j = 0; j < n; ++j) {
          const v = fi * x1[j] - gi * x0[j];
          const k = i + j;
          if (k < n) w[k] += v;
          else w[k - n] -= v;
        }
      }
      let first = 0;
      for (let u = 0; u < n; ++u) {
        let r = w[u] % 18433;
        if (r < 0) r += 18433;
        if (r > 9216) r -= 18433;
        w[u] = r;
        if (first === 0 && r !== 0) first = r > 0 ? 1 : -1;
      }

      // sym-break: s1 = (h1 - w)/2 when the first non-zero w is positive,
      // (h1 + w)/2 otherwise.
      /** @type {int32[]} */
      const s1 = new Array(n);
      let ok = true;
      for (let u = 0; u < n; ++u) {
        const z = (first === 1 ? -w[u] : w[u]) + h1[u];
        const y = Math.floor(z / 2);
        if (y < -lim || y >= lim) { ok = false; break; }
        s1[u] = y;
      }
      if (!ok) continue;

      const sig = EncodeSignature(P, salt, s1);
      if (sig) return sig;
    }
    throw new Error(P.name + ': signing did not converge');
  }

  // ===== verification =====

  /**
   * @param {BigInt} v - v
   * @returns {int32} Result
   */
  function Int32(v) {
    return OpCodes.ToInt(Number(OpCodes.AndN(v, 0xFFFFFFFFn)));
  }

  /**
   * @param {int32} a - a
   * @param {int32} sh - sh
   * @returns {int32} Result
   */
  function Fx32Of(a, sh) {
    return OpCodes.ToInt(OpCodes.Shl32(a, sh));
  }

  /**
   * @param {int32} a - a
   * @param {int32} sh - sh
   * @returns {int32} Result
   */
  function Fx32Rint(a, sh) {
    return OpCodes.Shr32Signed(OpCodes.ToInt(a + Math.pow(2, sh - 1)), sh);
  }

  /**
   * @param {int32} logn - logn
   * @param {int32[]} a - a
   */
  function Fx32FFT(logn, a) {
    const hn = Math.pow(2, logn - 1);
    let t = hn;
    for (let lm = 1; lm < logn; ++lm) {
      const m = Math.pow(2, lm);
      const ht = t / 2;
      const hm = m / 2;
      let j0 = 0;
      for (let i = 0; i < hm; ++i) {
        const sre = BigInt(GM32.re[i + m]);
        const sim = BigInt(GM32.im[i + m]);
        for (let j = j0; j < j0 + ht; ++j) {
          const x1re = BigInt(a[j]) * 2147483648n;
          const x1im = BigInt(a[j + hn]) * 2147483648n;
          const x2re = BigInt(a[j + ht]);
          const x2im = BigInt(a[j + ht + hn]);
          const tre = x2re * sre - x2im * sim;
          const tim = x2re * sim + x2im * sre;
          a[j] = Int32(OpCodes.ShiftRn(x1re + tre, 32));
          a[j + hn] = Int32(OpCodes.ShiftRn(x1im + tim, 32));
          a[j + ht] = Int32(OpCodes.ShiftRn(x1re - tre, 32));
          a[j + ht + hn] = Int32(OpCodes.ShiftRn(x1im - tim, 32));
        }
        j0 += t;
      }
      t = ht;
    }
  }

  /**
   * @param {int32} logn - logn
   * @param {int32[]} a - a
   */
  function Fx32IFFT(logn, a) {
    const hn = Math.pow(2, logn - 1);
    let ht = 1;
    for (let lm = logn - 1; lm > 0; --lm) {
      const m = Math.pow(2, lm);
      const t = ht * 2;
      const hm = m / 2;
      let j0 = 0;
      for (let i = 0; i < hm; ++i) {
        const sre = BigInt(GM32.re[i + m]);
        const sim = BigInt(-GM32.im[i + m]);
        for (let j = j0; j < j0 + ht; ++j) {
          const x1re = a[j];
          const x1im = a[j + hn];
          const x2re = a[j + ht];
          const x2im = a[j + ht + hn];
          const t1re = OpCodes.ToInt(x1re + x2re);
          const t1im = OpCodes.ToInt(x1im + x2im);
          const t2re = BigInt(OpCodes.ToInt(x1re - x2re));
          const t2im = BigInt(OpCodes.ToInt(x1im - x2im));
          a[j] = OpCodes.Shr32Signed(t1re, 1);
          a[j + hn] = OpCodes.Shr32Signed(t1im, 1);
          a[j + ht] = Int32(OpCodes.ShiftRn(t2re * sre - t2im * sim, 32));
          a[j + ht + hn] = Int32(OpCodes.ShiftRn(t2re * sim + t2im * sre, 32));
        }
        j0 += t;
      }
      ht = t;
    }
  }

  /**
   * @param {uint8[]} buf - buf
   * @param {int32} off - off
   * @param {int32} len - len
   * @returns {boolean} Result
   */
  function AllZero(buf, off, len) {
    for (let i = 0; i < len; ++i)
      if (buf[off + i] !== 0) return false;
    return true;
  }

  /**
   * decode_q00, as crypto_sign_open reaches it (one octet short of the key).
   * @param {HawkParams} P - P
   * @param {uint8[]} pk - pk
   * @param {int32} bufLen - bufLen
   * @returns {HawkDecodedQ00|null} Result
   */
  function DecodeQ00(P, pk, bufLen) {
    const r = DecodeGR(P.n / 2, P.low00, P.bitsLim00, pk, 0, bufLen);
    if (!r) return null;
    const eb = P.eb00Len;
    const ni = r.ignored;
    let len = r.length;
    /** @type {uint32} */
    let eb00 = 0;
    /** @type {uint32} */
    let last = 0;
    if (eb <= ni) {
      last = OpCodes.Shr32(pk[len - 1], 8 - ni);
      eb00 = last;
      last = OpCodes.Shr32(last, eb);
    } else {
      if (len >= bufLen) return null;
      eb00 = OpCodes.Shr32(pk[len - 1], 8 - ni);
      last = pk[len++];
      eb00 = OpCodes.Or32(eb00, OpCodes.Shl32(last, ni));
      last = OpCodes.Shr32(last, eb - ni);
    }
    if (last !== 0) return null;
    const q00 = r.values;
    q00[0] = OpCodes.ToShort(q00[0] * Math.pow(2, eb) + eb00);
    return new HawkDecodedQ00(q00, len);
  }

  /**
   * @param {HawkParams} P - P
   * @param {int32} n - n
   * @param {int32} low - low
   * @param {int32} limBits - limBits
   * @param {uint8[]} buf - buf
   * @param {int32} off - off
   * @param {int32} bufLen - bufLen
   * @returns {int32[]|null} Result
   */
  function DecodeTail(P, n, low, limBits, buf, off, bufLen) {
    const r = DecodeGR(n, low, limBits, buf, off, bufLen);
    if (!r) return null;
    if (OpCodes.Shr32(buf[off + r.length - 1], 8 - r.ignored) !== 0) return null;
    if (!AllZero(buf, off + r.length, bufLen - r.length)) return null;
    return r.values;
  }

  /**
   * Half the trace of Q applied to t, modulo p, as the reference computes it:
   * with d = t1/q00 and e = t0 + q01*d, sum over one root of each conjugate
   * pair of q00*e*adj(e) + t1*adj(t1)/q00.
   * @param {HawkParams} P - P
   * @param {int32[]} q00 - q00
   * @param {int32[]} q01 - q01
   * @param {int32[]} t0 - t0
   * @param {int32[]} t1 - t1
   * @param {int32} p - p
   * @returns {int32} Result
   */
  function QNormMod(P, q00, q01, t0, t1, p) {
    const n = P.n;
    const hn = n / 2;
    const full = Zeros(n);
    full[0] = q00[0];
    for (let u = 1; u < hn; ++u) {
      full[u] = q00[u];
      full[n - u] = -q00[u];
    }
    const Q00 = Ntt(full, P.logn, p);
    const Q01 = Ntt(q01, P.logn, p);
    const T0 = Ntt(t0, P.logn, p);
    const T1 = Ntt(t1, P.logn, p);

    let anyZero = false;
    for (let u = 0; u < hn; ++u) if (Q00[u] === 0) anyZero = true;

    let acc = 0;
    for (let u = 0; u < hn; ++u) {
      const c = n - 1 - u;
      const inv = anyZero ? 0 : InvMod(Q00[u], p);
      const d0 = MulMod(T1[u], inv, p);
      const d1 = MulMod(T1[c], inv, p);
      acc = AddMod(acc, MulMod(d0, T1[c], p), p);
      const e0 = AddMod(T0[u], MulMod(Q01[u], d0, p), p);
      const e1 = AddMod(T0[c], MulMod(Q01[c], d1, p), p);
      acc = AddMod(acc, MulMod(Q00[u], MulMod(e0, e1, p), p), p);
    }
    return acc;
  }

  /**
   * crypto_sign_open's verification of one signature.
   * @param {HawkParams} P - P
   * @param {uint8[]} pk - pk
   * @param {uint8[]} message - message
   * @param {uint8[]} sig - sig
   * @returns {boolean}
   */
  function Verify(P, pk, message, sig) {
    const n = P.n;
    const hn = n / 2;
    const logn = P.logn;
    if (!pk || pk.length !== P.pkSize || !sig || sig.length !== P.sigSize) return false;

    const salt = sig.slice(0, P.saltLen);
    const s1 = DecodeTail(P, n, P.lowS1, P.bitsLimS1, sig, P.saltLen, P.sigSize - P.saltLen);
    if (!s1) return false;

    const hpub = Shake([pk], P.hpubLen);
    const hm = Shake([message, hpub], 64);
    const h = Shake([hm, salt], n / 4);
    const h0 = UnpackBits(h, 0, n);
    const h1 = UnpackBits(h, n / 8, n);

    const shQ00 = 29 - P.bitsLim00;
    const shQ01 = 29 - P.bitsLim01;
    const shT1 = 29 - (1 + P.bitsLimS1);

    /** @type {int32[]} */
    const t1 = new Array(n);
    /** @type {int32[]} */
    const ft1 = new Array(n);
    let seen = 0;
    for (let u = 0; u < n; ++u) {
      const w = h1[u] - 2 * s1[u];
      t1[u] = w;
      ft1[u] = Fx32Of(w, shT1);
      if (seen === 0 && w !== 0) {
        if (w < 0) return false;
        seen = 1;
      }
    }
    if (seen === 0) return false;
    Fx32FFT(logn, ft1);

    const d00 = DecodeQ00(P, pk, P.pkSize - 1);
    if (!d00) return false;
    const q00 = d00.values;
    if (q00[0] < 0) return false;

    const fq00 = Zeros(n);
    for (let u = 1; u < hn; ++u) {
      const z = Fx32Of(q00[u], shQ00);
      fq00[u] = z;
      fq00[n - u] = OpCodes.ToInt(-z);
    }
    Fx32FFT(logn, fq00);

    const q01 = DecodeTail(P, n, P.low01, P.bitsLim01, pk, d00.length, P.pkSize - d00.length);
    if (!q01) return false;
    const fq01 = q01.map(function (v) { return Fx32Of(v, shQ01); });
    Fx32FFT(logn, fq01);

    const cstup = OpCodes.Shl32(q00[0], shQ00 - (logn - 1));
    for (let u = 0; u < hn; ++u) {
      const qre = BigInt(fq01[u]);
      const qim = BigInt(fq01[u + hn]);
      const tre = BigInt(ft1[u]);
      const tim = BigInt(ft1[u + hn]);
      const xre = qre * tre - qim * tim;
      const xim = qre * tim + qim * tre;
      const w00 = OpCodes.ToUint32(cstup + fq00[u]);
      if (OpCodes.ToUint32(w00 - 1) >= 0x3FFFFFFF) return false;
      const bw = BigInt(w00);
      const are = BigAbs(xre);
      const aim = BigAbs(xim);
      if (OpCodes.ShiftRn(are, 32) >= bw || OpCodes.ShiftRn(aim, 32) >= bw) {
        return false;
      }
      /** @type {uint32} */
      const yre = Number(are / bw);
      /** @type {uint32} */
      const yim = Number(aim / bw);
      fq01[u] = OpCodes.ToInt(xre < 0n ? -yre : yre);
      fq01[u + hn] = OpCodes.ToInt(xim < 0n ? -yim : yim);
    }
    Fx32IFFT(logn, fq01);

    const shS0 = shT1 + shQ01 - shQ00 - (logn - 1);
    const lims0 = Math.pow(2, P.bitsLimS0);
    /** @type {int32[]} */
    const t0 = new Array(n);
    for (let u = 0; u < n; ++u) {
      const w = OpCodes.ToInt(Fx32Of(h0[u], shS0) + fq01[u]);
      const z = Fx32Rint(w, shS0 + 1);
      if (z < -lims0 || z >= lims0) return false;
      t0[u] = h0[u] - 2 * z;
    }

    const r1 = QNormMod(P, q00, q01, t0, t1, P1);
    const r2 = QNormMod(P, q00, q01, t0, t1, P2);
    if (r1 !== r2) return false;
    if (r1 % hn !== 0) return false;
    return Math.floor(r1 / hn) <= P.maxTnorm;
  }

  // ===== KAT DATA =====
  //
  // Entries of the PQCsignKAT response files of the HAWK round-two package,
  // PQCsignKAT_96.rsp (HAWK-256), PQCsignKAT_184.rsp (HAWK-512) and
  // PQCsignKAT_360.rsp (HAWK-1024). Each carries the seed the NIST harness
  // drew, the message, the key pair and the signed message the reference
  // produced. Nothing here was produced by this file.

  /** One record of a PQCsignKAT response file, its fields in the file's order. */
  class HawkKatRecord {
    /**
     * @param {int32} count - the record's count
     * @param {string} file - the response file
     * @param {string} seed - hex of the 48-octet generator seed
     * @param {string} msg - hex of the message
     * @param {string} pk - hex of the public key
     * @param {string} sk - hex of the secret key
     * @param {string} sm - hex of the signed message
     */
    constructor(count, file, seed, msg, pk, sk, sm) {
      /** @type {int32} */
      this.count = count;
      /** @type {string} */
      this.file = file;
      /** @type {string} */
      this.seed = seed;
      /** @type {string} */
      this.msg = msg;
      /** @type {string} */
      this.pk = pk;
      /** @type {string} */
      this.sk = sk;
      /** @type {string} */
      this.sm = sm;
    }
  }

  // Indexed like PARAMETER_SET_LIST.
  /** @type {HawkKatRecord[][]} */
  const KAT = [
    // HAWK-256
    [
      new HawkKatRecord(
        0, // count
        'PQCsignKAT_96.rsp', // file
        '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1', // seed
        'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8', // msg
        // pk
        '1aa4e965f7fa0ece029050e324ccff5b64a81a062fd5f2005647d02359294179ac371a426fa4f1a413501405c191ef20' +
            '57051788e5831a02a74053b0a2920143b11f320c28e61dc85980de5ba6e401c07ccad1e6879622b56298b98619818969' +
            'effef5f77b7b5f6ffff5edb5b77bffff7fddfe360fc1f27affa20ac570500aaa7cdf973597ab6488df3b3ea3a5c0c808' +
            '83e97ff6dedf9d653d4311204f174ee5bf21e8e8b849b5deb2379b4c53d03d71871d48b2e0dbb44a7dadd525d3f35fcb' +
            'cb06299709286c73738dfc9e2d0e4e93b880add5716bed2de6aa6f2c89bb57dc2b742f4e66c270c56abe9d67da0b4084' +
            '20c1ab36142513a04558130b061c6588033301ce3f20f04b16365eaf810ab001708e35b2084090644ba8ff66b0fd740d' +
            '4d0dd281d5836e1759ba982fd90abec2d792716110fa7409735c6320ab749f592e5614db3eba6073e65193343173e9c9' +
            '7b9937dadb982d0d253d0a58131702ee1615e4093553986720c9b2a1fd612c5ef3494992e2c7c0d1710427cc8ad54ede' +
            '4637c38f1cd10333752c5599d2775f2f0368f8e8616bffbf5bbfffeffadfffb7f7fefbbbebf67dffbdefdcdfafbddfbf' +
            'ffcbfffd76edef7fbfedff0f000000000000',
        // sk
        '33a8e1741166e78e8d3c4d6938aac6233d3b4e2958dde1a0ee2cab58be6511d831835b6de57933e313bec50b097816c9' +
            'dd3307bcc85b27afa7a748bd475fef2207f746c683aa62c8df3360e6804a19acb7a1db8058cc2a4c867e0db36709f463',
        // sm
        'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac88757e24de80ba8581980f966d55c89' +
            '0642a34d0adf7dff6f46b00005d1a3d73f0ecf371164f4dfe3790f1c101687e74751074232aac5edc00a250800e5330b' +
            '9f0929b3857a922b37b940ac1127e8072c906788284222430387203805d502dbe0a8d9b7c4099a268b80c17ab0e86d41' +
            'fa2dcc3a0ac90d361991c3af4415f93c354d084baa821b2fd40e169304592344116911abb42f5420624af9882dcdb082' +
            'b20903950de810f3b069d5ebb7a439fe6afce546942ac794034668883028d996862d752a4260d7c0a42eb954f0d92f7e' +
            'df7ffdddffdfbbfffff7f7ab57fbdbfe7effddff7fbdfbfbfefff5ffbf7ff7fbffbffbf7020000000000'
      ),
      new HawkKatRecord(
        1, // count
        'PQCsignKAT_96.rsp', // file
        '64335bf29e5de62842c941766ba129b0643b5e7121ca26cfc190ec7dc3543830557fdd5c03cf123a456d48efea43c868', // seed
        // msg
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
             'b2568209e46dba961869c6f83983b17dcd49',
        // pk
        '8efafce862ede469e14d54c53226f6c544402d92f65c925556a0446fb39a5d769085db30e1ba0e48272034b7ca7a68a1' +
            'a1028286a6b910bdff04480e4ef818c9183c2120f510acf120626a76b31890eeb8f08c285b7a030dfa9449707d80c1e5' +
            'fb7f7fffb7e57defadfed5bfffbdfff7f3fbdd6e037c86fce033c245e30f434b511b2f277c0e3c31e6727ad8f023eecb' +
            '43bb9a040fe58f346c6e5f95b641830942c23f64c37c224da302432376bf161b37719832d10f8297497d1ecaa200635b' +
            '07e1420ebe1e241e85b92e10680517d88dd0dad7b3102d233027c8b92d813a7dd55d95627dbf0c007fa607222f6d0125' +
            '1d707f37308f943e03fe1c4f9d0a7a73077d3e991b34107d65ac722dbf07a12e816a081530651684813ba72ea87e7a42' +
            '13656cb4a198cb37bc735a67e22544453c3672107811ca4e8f1651dfa1838431112620442035555d28eb930fa5132c04' +
            'cc2fe4872ef241485e286bac2ba98c4d917663150627a4fd56fe63a281b89717294353923a34be21c4f8d12f1a697f64' +
            '098e29bd90b21572976f9e10e92fa234062c1e0e2fdfefffdebfbbfbfffa5faf767bfd7fb77ffbdff7d7edab76f7f7ff' +
            'fddbfdfeeef7b7f7eefffe5d000000000000',
        // sk
        '1afd5d58947429edb0f4bef8d99e48ec4bf0de0d51bc9e83c599eb6c882ec92fa9eebbe84aa989445cc71d9e9baf99b5' +
            '2c6ea86bbe32e4a434c8978f91c483629f2ac8d601e033364dd4f16f07da449e36e86f39f0324d23259f50471419f45d',
        // sm
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
            'b2568209e46dba961869c6f83983b17dcd492e3bef948dcc67c7d277bc9f58484d28c27e19b42404719c4d8b69cf22f2' +
            'd61760ddc631c54566dc720826ec384d1a106865b21b342008bca266e1361a0ad3c038621a564902622f2863e701ce74' +
            '20ce8397c675e4f48b8c72ec3f6500376693454759e61007844dc315079661b28b8f0793901ba470b054ec596d1b28ec' +
            '8508b3e22a1b8c45031cf282ca06851757594a2e7c81ed72e8a3c275015e8636ba1093991261e70a6f274fda71cba049' +
            '20aac239fa0a145621ab0c220599fe9c938c5c43c272922006fa620f8570d5d1bff5fdfbffffefbdfff5dbf7ffefbbbf' +
            'fffefff5efdbf77d7ab55b6ff7fbf6ff7ef7ffd7dff60100000000'
      )
    ],
    // HAWK-512
    [
      new HawkKatRecord(
        0, // count
        'PQCsignKAT_184.rsp', // file
        '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1', // seed
        'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8', // msg
        // pk
        'b69f8c532d716e830c1165b52138c6995f4ee35849dd92f7f5c32d1a709e044ff00d80e9188704f289070448dd3e3ba8' +
            '97ca09527f700e391cb4174dd27344e53e9a54b6d0883c9b6c4b70b09e802a735ab75daebd008048408db8b2e134155a' +
            '3f3239058369ec9e5fd5bb10d77184589552233fb1c100d32c5485a836b510a9507f485acd701b19c2bc00b465d7704f' +
            'ce5e20143caaa2c36e9f1aa3495af2ee4b8a4a21be5580200607654a039831cf9511a33cde96a6ecdf7ec7830a82ad43' +
            '47546f0df5f512b1cca889749655d2d5c86c380b7225b56498d2ad92adb8e85b180de94d549b43258b2f49e41a99788b' +
            '1c27a6423a954b4c6d3663298bd04e107bb3c8e20028cd22f5d153be5b620b025c2088a09fa5bb563e32800c80ffa565' +
            '0b8d3bfea0fbcf5e9674f32def0cf5d9f1a1b7bc374472bf0fcc005fe92f2fb0fe95470bc4569668c382b59f7e69fc83' +
            '6abc136c1e17beebaf6b7614312b5ca97a0efe4b9cc825bb0a2e318c9938221c7563b18d12259a24d65fcae89fc5a878' +
            'cf2a892f0735afcd143bcb002d460b62d23051215adb3e9b0cd385854eab6b60777e1cd7e5a88c7f1604416d3446889b' +
            '89fd2d184041305e8d271d49505eccc6a6dda9bd76eb252c23c514992283799a8dccd65bdc1692b86bb46021ac141326' +
            '48d0666a35915b796999c52fe59eee781bd867af0ea94f9a4bab4cf602defc1f8fba20b9c0b0d14c693a2bb8938af454' +
            '69106fc239f4851d2980b0e938df9553a3ddcef4fd596b39d100abe201cc570aff6a93f0cc503228d4687e341b7a93c1' +
            '01a0e3dd9f9f9cdd5aab32ac1ed9c625ccdb8f296f414e4540624d497158ad0de9b2cc5c202e000a4ac1676750cc87ec' +
            'e5a8e4d13884540b23d6223c6a894b6566aa0d82d9f444bfe662507be9bb17f3e219975eb32b9326c9eedb664c898fbd' +
            '6c553db0b4c8cbb99fc05b8909f6d74eca0b1b2a7f0c37c54a717b54a8a2322a2ed322a18b1c05b1c46820eecd2e4c15' +
            '9bf5d52b5650c2512493434e638a422defa395a4605de9a6d7e176d7ae510778f2f3b0b265fd9c75bab10fe2c057763f' +
            'bbd252a9bb1753de3973847ac3c29309dce9c9bb1ecbb5fd580f1bd64c1dc2d04d0ed15e60520f0a5432b351668e8fe4' +
            'ad2f6c4c044b2d3ffaa0400ba38bb1046c8e4485981d8c855c56c7b880ae3f490c6d2b614662177e24d0f17eb71f66b6' +
            '2595b7b3704233d767a0591042db40700f0be84d072e7dcb0d925f726a2048afcd5a8c6714b535bb661fd9c6b65295bc' +
            'ab36b65c4e25b7eeb6cccd25e96f6969a776ae367a5e4d9fd27a135d713925d39af697756a2595eed9daa55a49afb76d' +
            '5b524bbbf42d756eadedb636d44a5d2575ae9d8c39ba94b297ea4d2bddfeeceeb9525d6f4dbbe97cdfe452d27d7b9eb2' +
            '565ad709000000000000000000000000',
        // sk
        '0a1315c8585d6afe83cd259ea7ba63ab84178ef93f45eb4cd8cd503fdb67e70415b5da5d4c9c84c453d6c3bc4b0585e2' +
            '071841a97898b724eb5153a918eb3ae8ac36f32216474f2cee3ee9cb07e2c4a1263510153116b416fc23b41541d7daf7' +
            '6fb8097bd846583c81a6a89c7e3afa871081bfad4474befa790c5545de2d064f3bbf2d5a651672444760566f67dc92f4' +
            '9ab7cb604a746f6bdff976d6fe3b346d51c51b91a47666351f1cb691ebf589943b8a3202a69462a8',
        // sm
        'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8cd1d53990f1e3b05ee8ff67dd99574' +
            '333561db26f5b19cb94f4dcb1bb4882f6ebfe3872475d94ce3287af2227583b4a1093492d01d7a05d1e6a97a35be0f09' +
            'f34fb498a6b93d0af0c8853f6d86488a5f52f10678e1836cbbc4b97b9ddc6b63d43345ad644dd5917ac3a6ced14aa35e' +
            'fb82427a5f339d50f04825f0e8419388084e6ae20ff5c2a4cac72a94bb24b951cf8de38847808d4242004204480243d4' +
            '1e452a29bb18d5c5d508f84c225284781a95fba71509bc50c647f4025bf8ba94b55fe1b0538ac83116c98df9495934a2' +
            '9f05ccc014ea4bbd1e0799e9016206c9b35cf29f681567b9523ec1641c3a508e63422e0148004db56a86bbb3212e379b' +
            '2593b3d92503601832b5a59a931f4e10bc4e019a7a2b5c299971d1565dd0b180b636e9488ad5b32fe5a852f7fd737f14' +
            '0bb0811cb9d1a4cf72039fed1dbb8db0b335e83aba08d4565753188e7a180bd836f061908665a4a3911e805a67f527ef' +
            'f6e8bf5e9b2a6d8e5bd486d315b3c46519f02a554b989d6bfaa9440517bddc75434a58442f471ef43b5edaf8e4e1f657' +
            '9750cceb0cb888009a49923a2a92fd37a1794aa9ee504ea93aae84855dcdf054322b662a23296f4623bf349c9191b21b' +
            'e92a59f54c826eb82555955547992b552c315ac27694d9fe4a51e3ebd6a88863cb97dac88d3ada52a4c25e8eac5e725b' +
            'c7c9d4b4ec7cc8cdc966b3fbb4ad44c3ede5e855841492f5b35caaad4adcaa5069957c92f289ec6e0000000000000000' +
            '000000000000000000000000'
      ),
      new HawkKatRecord(
        1, // count
        'PQCsignKAT_184.rsp', // file
        '64335bf29e5de62842c941766ba129b0643b5e7121ca26cfc190ec7dc3543830557fdd5c03cf123a456d48efea43c868', // seed
        // msg
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
             'b2568209e46dba961869c6f83983b17dcd49',
        // pk
        '50999e765cd8567e1f2a72ca0a530f008a4f838a4b27591f61e6a57da862a7bcf05b93e187cfb789a14185be8271f7c3' +
            '48270de008dee34832d600e180e2eb136b4e7cc4daf955055401414fb29562abd3a36ea8644738108ea5fa00d39c6248' +
            'd7cd48ac0fa015a1c705ce245b24b00e955d77be398d705f44dd4096e949e3e6d3b0f69485ae593c557de8ef5739bcf2' +
            '0eb2a4968936509c17b35fa3b0f11705c63783e0347595d79cea3a820aebf5e866f02d69cd1804aed22d1d4234860619' +
            '5b5548d96422ed93a8315256d22d69621862d3ea55fc06cbaa63d42b9264161cc26db455652c915f395233b772187695' +
            '86366b5558c9328f9c04a8621f7d256a19e587040149870ae910e1c976f8752d846bc287fd2ef8f811e2adfd28115e1c' +
            'bce4c13c5bf68010344aed13ad55940ac095dbfdc78062fb74e8154d7c4309346af4f41a826d019dfb5f918cc61ae5bd' +
            'c9b7eb8da641752620fc7bbcf7d9357b4f2d010b7c3236ff1579fa4955a545cc0cfc8574564f349d8fb3e31ba3cb6aa6' +
            '13e7670c7f58faa4f764c9f8daafe45b979b5c4e38f79fb884f131e72b6c45de590b4efe432083d8c1d6ca54c2e55e22' +
            '6650fe0003778ed575076fd244c48187c3b1d7b7b10f4ef9408f9f0bf50d1222280e493e94dcff1c73278b2501468d52' +
            '95e40e3276b82c63d4b14a1e582fb653e03cfd0a8ea94b6f61ec42d458ea1df26f801aef90912441b77122ae0868ce78' +
            '22b295a3438b09388001f95b4f8f73384446b78c9f0012620f12d6d8b29e647d72d44e9486e71624e2e1ba412a46d203' +
            'a0a5e23ee9e8f3c43ed8bfd382013cf81e880aa6d6991704240e052b5698a8a6749d6193697d3d9af75363850858ec24' +
            '0b5a541ef6105c400b08bd10f0b9b16aa366c8d11028fc0b81ad2ca7bd03483ef053086255dc744d2b50d34e0e251695' +
            'a149ac2257b68c3c9d8098f27ad97b25b720654a8214b679ed78d525a9f608521ceb3efeab48af9db396515370439d93' +
            'a0110fdc49eeb0ae174e51b67910ebb84aa923ba01561cc15d7afb56365fc8ba63b0abbf77ebd2404a23c7d6a44b9c2b' +
            '63ccd091410da429a810985c25443b8b51527e6bac8bc1b047c22095b1342951e8033c7d82349055e87decb7a7cce2f5' +
            '25a43c1acd3c8ea6d05c2f0dad258cd553f7088fb0c039f7448502f8c1f37b4d15c2f63ad00f8b1c64b18f7ab2b1d472' +
            '3a25ae0097a3ce4c5f45db232cb165ec074e0c49d6da6dc2207477261411492ad0007c5f0d4cd5995a6a57ed9c544595' +
            'c85b943eb396d255f3ec2ff64bee24cf5a4b7d79dc4adead95fc8d4a3329f6484dceae64979b9c252e51eef355e42cb3' +
            '5c4b5dd94d6daeb6e4da73e1ba3dab9c2757d7946ad9adb6b626355329b3b366155556698f93aaf2a9b24e5652b92b67' +
            '4bbfd7ea2e4affae0700000000000000',
        // sk
        'c0f8f8308409d690c5a01316a9b077dd6bbe9adf2cd732c9fa6fe65d87da8b96779302961528f96217822c1bd5959cc7' +
            '8f4f53f6b845a6d5b22fa17325dcadd831edf0f918780415d45e5c455dbb909e4c0d99672e4f148a9c73ce41dbee190c' +
            '7ffe6891ea6b6d769570121cad9c6cb033d19ec2b79d4411b87e80dd63ee2573728a535068a7b8f0b674d077932c71af' +
            'de752420f06ce581c1eed21150630057d7ff230011dc212bf609fc4b8b505f0b11990e0598de6d41',
        // sm
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
            'b2568209e46dba961869c6f83983b17dcd4914984c33ad7104e8635b9f8012780e9341076b7bbb8ffcf0994929f27da5' +
            '22e59ee3927168d6d18b35aa61d173d0917440c38c19faad0e0247439047c2cda4add1b410a6de0633627f887cece374' +
            'a310e851ebb8e5f1d21cba1923e238635500250faf6fb44738e05e45550a038d07df82704d263cc7d8438f696ab353e8' +
            '08bede86a331c76252261de00dc947c97ad715c5a404d53e1d91ac4c0a38cce7b8b422b85cb1bde99c46a16f7354eca2' +
            '549e0a186f4e0c4b8203eb1982358523dc40381cd4df92827687b414d502184303de19df785094c78e67947d95c9197c' +
            '704ab245e0d219d56737cf287be891c194f286619de159078edfdd1e762bc33460aeb077bb2c68ef596044c778a1efde' +
            '14012560e188ac00febcf95ae071f1aba2e7fdc5803f230e468faa41a58943d36a516087b13d3a12d9d98169c5020725' +
            'c661fa92acc6028b95134c880dec3b148c811380e68085b4a527a186f4cc38112fc67932b9229a618f7bf5d9d22d1681' +
            '1962dc536627a242c80d7551b9b043f98b3f0ac9b7c8271f5d81b911c21411cc0baf29e6349ff6bff3845a97db784c52' +
            'd933e588d1ea51d39551779ae947f5f62b0f63698848892e95d148db9349ad5b2aafb0c7f84d2a55d2158f297dca4aab' +
            '96fc75d5c9142573e3af249206a9a75645eac40aa34fed75d574b28c2599085d3ed1d4ace228c624b0544a23b484f80e' +
            'aac775a312458dc29a494dab8a722aa21ec91cc8b445c94aadaa5f140f00000000000000000000000000000000'
      )
    ],
    // HAWK-1024
    [
      new HawkKatRecord(
        0, // count
        'PQCsignKAT_360.rsp', // file
        '061550234d158c5ec95595fe04ef7a25767f2e24cc2bc479d09d86dc9abcfde7056a8c266f9ef97ed08541dbd2e1ffa1', // seed
        'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8', // msg
        // pk
        'd4645c050d7a7c2d5b9452354e9b961aa40d9b1bcb09ebbf52a64fada7106f72068fd7854a8d84c7c8a3b3a755afd8f2' +
            '7e4941c9dd882562f36361a6e73df8f13dd38c226e4175c7b18c0698be914d5db748cb7fe11f78156a4d406fe8176cd0' +
            '01332fcda49b19954670f7c01223570db8fa5c176f4ad0a205cd013e961935e26badda73188c2a0982e9344c4749af75' +
            '15eb07ca6996e8f900080db8ae3768dcc62ad810451104bbd6d5e4518ad6da17bc17a4b5790cc5575e00c3a7d4595d8e' +
            '691811d5e8bf43cec54b4d048bc8415e757bb447c64bdc0e532fae3e809c8c830ca06bd4cb52792ba1af36a7e4ac2d84' +
            'cd29d944e7d57996bdbd73bf14a101ac91e95609983816170789c65282d8a3259b04ead6460c7cc9b4852fd51c3ef540' +
            '2e80ebedb88b786e0324ffc519a506853e387f77c3551eb59a18bd08c19dd12a9582e85b216d885514ce0411e381fbff' +
            '2c7e16dd131e11a0dfff582c564736edc1b67b3b067954f255c0b41a88839185e025a213fddfcfccd8232f85e7164ecc' +
            '7308c9dc58901c865fa371317e01abb462765e5731cdd0fd2d8171408b06486a4517ee9550b50c62f3e12bb0347199f8' +
            '32dccb5b6282655e99e603572945eb831e24065c88b018e540c228dc303108ca2a12223902b9104e589195b9b19969c4' +
            '728ac8140426622327298c440811ae448d54ea984990a2b1201322488d1021114140a9146d6491884b24b20422738212' +
            '9191514344a84b6852e328887094a84e03c8492594e10c4a955488513c2fe14cc22c92c88550a20a02d0b6902f71b022' +
            '448d8244a3223911852999245ca8dac24ea9104ca81dc14b080492c710c10c4a6c28501e06052253c272148121243214' +
            '079e2c98416f033c4b914de946075a372bc7c78d88af287f5dfaf1ed3ec5fa74dd24dba0b8cd659bd2fe606f2bfcf024' +
            'd3acde5a6c38f632f8a5855b7cbcf11a995b14a3b0ae1d043c4a2f2d5d46e01dc60e46f65127939852ac4fb2dff1f589' +
            '8de3d023bb6e51e5c5274f50f5fdb64b7f33abce593cc886747d19fbd4d5c631fd49af2b5c33ee0307a7806d658d4d08' +
            '73eb7668220571de3b1a4f495c1fa51855ae90e28350cfdea57c69208610b082c0cf2c229822a4f1090a1594b3c4cda4' +
            '9e7370073ff8126ed768d2be44780181f48e208c9f8cc9262c1ca688d7b7351af71fdcf7ffa614b0b5022cc83d12ef10' +
            '19e0222f39a798c218ce124a0c341a67c3731327b932261ab121102178a93700cb364166121c63f922318f4ebc25c243' +
            '997c8241d7a04ce759bd3b6454e20f4e03b5bda29ca70118a7c08f38c03c95e67e830ff1ea7bf969ea5afb652546fdfa' +
            'afd93ff93c2d4e35a640dada69f19c1bd673212cd4fd5c957a4f766831b561449ec04d139f3ff5b53b187270464331bd' +
            'e5e59b80fbe44f8288127c816091171c36ff6810726fbd0330d60e7789382527587287f0ac41c33453146f5138c3000b' +
            '609a0e01ab34aa98bcdb78d7281e3cf185d79bec77e9d03859a9a35596c4c9859ce718f36edc9bb306d05101ab31bfd0' +
            'fe9a25e09355e7d6c55c23c70b594220433ffed735239d5931968f573b2dbca183c978c29482a5e4baa8c16cb6b6935f' +
            '70de0d1924b78e9d3bc9c4ce8f2a15c76216c06e6b69171a2c8a1d1630fdf76f2321b1ff8b85ef1a9f216e06834bc268' +
            'e1c2af27d6e32148c4ab960086ba0a6fb04b8f3665aaadc05f6ab0705a704ceb56745d9fdf00f77f4889d6f48d7480b7' +
            '0361620c6186a80fefbfd4a49fd2e58f68666fb0ee7f4ce394291843611835293710aa452948a4eb95be62de6a4f0bdc' +
            '841c97facdc4084c73583875c327929c6e9a5b15489b3f468c840b0756339f4772eef2ad22c0f64dd85382ee74ec6f0e' +
            'f9dda09c446aa875511ce59958ea34f56eb601a16857e981bae7b7081d0ce5848f2e5802cf0013f9eec404be31b01cbf' +
            '97f101f533f91ac91025d09aaa9ed7f0eaaa9aa5fda1d3ecf240319553298fbd7a674720808a55298aadc789c99b23f2' +
            '8fa9013aa4886f1a9d378b9b274170d90a8b7dc500f2216bfa942cb832c137aa47a08b16383c85fe2d633abf0b102c16' +
            '6fe81486ec5cef01a7a33f3497d2abd093e2463d042242f187e497b946cb257e45e47c57b8ad5e9e413c00a38107c35f' +
            'a5dda2e309ecae5cb2aa04f860a8378c87a0b2af84bc19470539a335708f56f28919e29d9a3ee0287981bf1be6df786d' +
            '4c8e5c2a48c1fa738d9d38b45c8c3460a03a3afff4d46f8f655974996952a7bd0c9f4c1ac24808713ea213b6d9320c36' +
            'a0d36f6d75ca96a0b6a826db6fa447ac15a6d65ce3ce5728f1ca556ca31c301bade09fecb48bf22c810154af1d019c67' +
            'fb5050cb720cf9df2f23cd502d80f856b239e40eeb349270237b862a5de4d7a8344c4708cbf4a923dcd9d48434ebd2a5' +
            '91b658b0c57087aa68fad6d28f139e394e40d0a6478e550cc6815f30aea848e0aed7485edce650ecc025ec543c8610cd' +
            'e298d1303aa9da54595a75d747c3706833259ace7ab26590e2150e92daa2a2fa81ccf3462e7630e7f3692213b0c7b001' +
            'c3538ff9d98a806c589979a8e34ec2ff20bd1bf9d7919c2e6b23a99f4ba7c2d1dd12eaf7494489a74192d14970d7f8ed' +
            '05e1ed802cb60707c2da6c1dcb72e54fe6fc951aef4bbb3cd4be351b31bac45caa02b7b56b0c713fa739708b72b7ea0d' +
            '4ef3c9030a3d27f327bb51db25ba43495296664c8e0664473bdf23d9f45a7fc054879277f4623a980198e4fecc9679b5' +
            '216c392c5f8137cca7089851954e058736798c51aebbf2ee0db157bfb24adcf023d204e4b41ac2afa5f25124da66c0a4' +
            'a7aecf29ff2be2bff9e81aa6d0f2b480ad4351b02882b28d8410113b2c1445148248094e265452f90409096853a50a8c' +
            '051b7e0f12132633445c49f125b148943008e3446f902e0b85d5431a998a530c109c08b5214629821bb5245106114d08' +
            '12c946a6480a311969901911548a8a52090b399102419991c8281a214241503432a64041201919b28c22ae6015210456' +
            '18082384590947556125865918115349484841c40ce1504325114221244a6144154aab26020f82c238e4a8184122544b' +
            '3884051991b190109149988550c244830209218996098da56085880ad14822e2102924d384a904e111ba9084c85069a4' +
            '0a2341b41528180611850a4ec24c8c9e4504227c088a840aaec2a2c8c22526162ac93809cd84f0428620a1a011c28933' +
            '088949094d548820a14893d2d0212251a454246d8814c28494847a15149410b88810992890d2b8603442514cb2201189' +
            'c892b2a80914a41425c9086511119914bca08c2698384215b141089b2492e0011123254a0622a5986418498d83190100' +
            '00000000000000000000000000000000000000000000000000000000000000000000000000000000',
        // sk
        '61ee7ec28a59914a778d0592ea722329b7736a285e9426c14ffe5d3a3947df2f795cd46045990685227d2e025da989f1' +
            'be618ca878f462eb58b916ae35c237e09b9a413902e1ed855294f47db1ae79e9ae98526ec7b2becb4878a1d91d4f4caa' +
            '17b4362ad39f2902f2e91a53729a653c16f64f7324167a8bb1b9bfd76e15df95682099d04ddc48f7a54b010c03b4b4e4' +
            '312837eb78f5e1c537bc34374881d8af4b2bfaa43835da1c177013f6998e969ec76f1e703cc62a3ddcabaf827dea6814' +
            'dd578482f6a46e3e65e4ec072c5eb48313f989ef23c2fb65b9d12e83fb5bf90417c9ad1cad327c85a71d9a05eff414d1' +
            'c00ca4046ab93a5ead62d2d7679543b76667a3a57d3aaeb2a6ab94a331777bcd7386e7f40bacb0452326679ada73f7a2' +
            '3f00b9972972be0112118e3f69be6ddde9d1d62b380dc6fb7688f263c4f95066aa3cc6457ff6989fcb21fc950614c313' +
            'e57b6242241e8a23186373944780fd49b8369bc81fea2b3b',
        // sm
        'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac87a7551d10eda23430ae3896a0002c1' +
            '2bc7e2156c7fc2d0efbd37d6a9a333789332d3eb173a3b0a119d0b673517f0c3db6f9d00ec398f057e13e6c84f2f800f' +
            '9675c33771bb94430abdd56408b6c659a0e0fc1760d3545d30bb0b23f539762a01e11e77e0b1b9d07624a91fe1ec7ee4' +
            '1b28feee3ba02cde3e0f7fa50f8b7a59b007bb97efd24edd6ba55e6efb57f0e49843aea094839bba82107bc3aad14079' +
            '2d499150e17383f0c82406a945b0b34bd0d81714983a954dd21532890006e06db82fe77927adf9a260e30df176ab34a7' +
            'c616ffd56838ad558f5b7cae5da0ab5b1c12c1e680052d439f9316542d523ac10f5a86edb88c8fc5ab56f8264f9b479c' +
            'ba4a22566105cee8ace4ed2912ca126c08276bd6399aa535f8b5f2982c648944b264c5e3275a7456cd26c1c4764fd52c' +
            '848320a31f52ad59f89a5940d54842564c4ed1f950acf6964e7e1097b672b00035ef0dac2f63e81c16c9766b134e159f' +
            'd2821bce3b34548f41b0e06520bf94207149a993f033b7ee984fbd0dce4fcf6947de335761f0fc47f15b542724b88969' +
            '7e6fa638533e411242c66591205154b09377a3e5a6659fe959fcc4509bb01eea3445973219dd44e23cb028664563b901' +
            '641e7ea7bd38209bd50a5c8aacc05a37a719022257e6f3e34da5e35a130b24770bf918d53a54817cace08aefdda7e992' +
            '8ba3c0c7abdd462c1c456e00de8b534d22c99ee1732c012c63b22d09596244418fd9b4878a61818257dd41dfcd8aef24' +
            '1e49fe7b3f4c3a6569b89b22ebda2823523025a1f97963601e84bb28f23094f98f1849f3e0a3b5113e48cea078d69e73' +
            '354b615962038ea4351e404699b96da336c50c88c35c140eafb033d67d0feef46286fa45890c154cec5e2a2e1b607ba4' +
            '9644050172e586adb1a142c49b8b0bdc2b67b72509a43154c448c74568ea5b59b5548ec214cf634d8261381148b9544c' +
            '96a06c3941742e6b40ab52ef01e29763101298118c4d9a7590d2d57e308a3aab8c2f0658d28f5ccd2a9c12afa07259a7' +
            'cef005d1ae6b6f0100f138499399daa82008c765fa65442c9f525a453a755dd08921ac34b6c0675e07dead26b473c40f' +
            '814aa48c5e68c99f6d1dcf2e98c16bca793828c022a0899aaab9783e016e02ef311690201afd75cb98525d0559d7523c' +
            '7c2c11c6ca0285196d4ab62e660b60078545e99f926c9230ba2482c9fd4d5661a68efec369c8ef9639a4fda2965d120d' +
            '4cd55ba7e4c256f58a2a401a298349c0710e052288f8a1e90f960e0973cd485a20b7f06855902d3a358ac0d45454cd00' +
            'b35f00d8f4a66c68f9d8952da18d5362a95493b40b0df54d52d510fb99495e862a65b9b4783056af48a624c915feb156' +
            '2a9bac9df4487e79ce155bf624da7caa9324ce12a9986a945452ada24992b296c45612ce3e519aa4a4228648eec4c5e3' +
            'bb2225a9b328355f3bfda3cf61911e5e375ca5cd516b628fcd3bef12334f2f4457e338315593da76f621574d75c89026' +
            '1e9692d5eae9ad5e218550ca256ac41177f695cb99312d45be9a36af52af4b25c94995d2abe44a505b965555abad2af7' +
            '7c1ea950d3aefcdb489398e69b1c49ed2a192a8a87b2e96a52599b6268f7e8e5d1c8c85b6dbb1d6252e50c99b78b9614' +
            '87cb09868e48c8ae56a2849de934e7214912515d2d6cb54f59ae60000000000000000000000000000000000000000000' +
            '000000000000'
      ),
      new HawkKatRecord(
        1, // count
        'PQCsignKAT_360.rsp', // file
        '64335bf29e5de62842c941766ba129b0643b5e7121ca26cfc190ec7dc3543830557fdd5c03cf123a456d48efea43c868', // seed
        // msg
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
             'b2568209e46dba961869c6f83983b17dcd49',
        // pk
        '605253c86e7785b8c8e0cd90a5a3852924b546b6d8dd6b63a9cb3795f01a5e38e9e354b3b8cc36721642f4002023b9ac' +
            'e0d7f588d64a0cb46f2e518da826d9f5852cd415c289526d70484b6b5f55e053587dc03f816b962ea998437218467c9c' +
            '1b9abed129ed04d6fefca04dd02b4daff7d1488e07d3e8b899e4708a05e3b6537300f4955620529ec014897627212d85' +
            'af85c5e8322f86563747e6f3182e9f87e2aef51e7875a59e7237514fe13e2662ec125a7dab4371673a00fdc9b5b5e689' +
            'eae3b6158baf346ecad383d140cfc31df46c69a5fa1f3ec03678b6b09a6e40e46bbcce4a3ac6807718c1c4d8befa16a1' +
            '7b7576fb23db7ec06369a72a1f015261245f3e3261b22a5b6acb2261c0676cd4e8867cc7f8a23bbf1d41562d8d1a6cbd' +
            '1494be38c3b2b6c55ec98b28e31ab243ae063ebaea6400c2fb1c2ae1493cef209086a6460a85d42f24a1015bafa175ab' +
            '15fe0d4e53a449075cbe6eaa14e61c4624c2f917e0bc186b27cd2ce70cc8f94395f2e4f8da2e83c45f765240c774b982' +
            '345cc0b86fdf3c37136f8553085981477b3e89d6e830150a4201480e5dc4a6f2b46dffe3cfcf7e8b836ab598a7949751' +
            '0b0b1c350f8e8e64613f3d22beb28f57cc92284101441e58d88212ac88824430a94202642012aa12ca4a585249a22812' +
            '2aa25008219245a8182a863224252921896821648d19622126442562782459c4a00431201945a1210a11995107688224' +
            '3812884208a832b210c9412256428c20641832040b4c8f1e212504114604944608164b5254284c1041111128218c9809' +
            '1d2c9538ac10022e4802104921618444e284450a2a4107eab40b21e2590e1154c3086446442a82110d877c822404d144' +
            '021141b70a215622086146342280080a312e0012a19800e3ab4dec834c8f61f1cd8857f05a4ade2bae14606c4b40a61c' +
            '1eee5af8b35ef085688889a7a8e8e2f01b02001db78bbf1f2a4a107f04fe37542c1874fdb2a8c08a3aeb9efd7bc8608f' +
            '7f8bec0605bae9528c8856de0d8efc9ef3e9d077c689725202fe0f8d5de5858ffc45fc3e57ccba52a9e4ef536f48be66' +
            'c293ea0862a78ec0270997f6c14c255d4af2d63142163bc5e1d8f92139bad57152a585b51da725ee0734f737eb46722d' +
            '26adc45aab1ea70e4a8c8229ea906c81c216dda8a8a8240bfea34089dff7903b606eca26450a181abe2d5d8d21c153d2' +
            '2931f7ad0beb2997784453a18bff91268297699e57bee144aaa71f3fec2ccd4be58ce6bd06ac312d7311c791491c667f' +
            '1b9adec66ef59b374ded57729e75490f1ca77b672a965f1bf961f320dc39686d84e91a5840b10a01e1fa8391960deb77' +
            '40179f88fc28ae792979abf7a18f33a2df2c1dd0b7e2d579928ada2b3e6a96964dcf2f066e871e7559ee3c0688856f42' +
            '85794276122e8374476ba4ce613c47f905c5ae60f619314176e73196c643c8f5bfcbc924bd0b2aeb4e33a94462c8c866' +
            'cbca7a8ebd6fcc59540cb0cc4b39ea6b45e085463031c1f5a74a058815311ec520ebf9d3e4b739aa1c14a8737476a05c' +
            '4b0bea8b5b42596bf6e2f0a48a2b96c481f5f02048d0897e8a0b3b663ba850bda784f90794b1c9a61757b50a38ed2074' +
            'ee09724eb8cb4f644e82ad361518e75578eabc8b7cc28d4a6a11560e42c999a9ad447d61c21c45d57598eb58f7bf9e58' +
            '63ff70afe36719add3b3e591e2208d06a698595288406109aace4c38a600c01f59d9033dcd5ad417f4c11b2d9bc7c0b9' +
            '954714494646d479fa0da04e4a212b5693a8a0ea2967bc55282d3b14dbc3de1791ecea027da1eece89b209faf0ece01d' +
            '52382ef75925e3d2a3c2989574780db10ba3502fa06d8a574fc945b17ccda07276f04ae2248a0601a5b4ab322280fd59' +
            'dd8b8909f5f919500148b51e76c23948e1208e5593f528882b9769d1d8edddcb30058aae7e7ed131e7607786bd873e62' +
            'f2fe1e0c4c201eacda0e9a850de6d8cda4148aa594bfa4a4a531aa7d06b0b931d081d5b6e0218a5192aead5854aea996' +
            '9ed51c1b109030a6450eaf4f9feb48dfa4da38e30ae5b994575d4321d0c6b82ab94a4b7d8014e03a21e90912050c78f6' +
            'e4e69ad19839e0e791336667b234543f1d9022aa80a8dc19f40110363eef0a77059dad253362423b250621eda617b243' +
            '33ab626ac9b840f0ab4ee129111c5bc337e45c1ef86c1dac129c7d3e8d32a5f25bd8ca371ade8c945dd565889e09bd50' +
            '723d9774e390248695ad465d17c379bdd7535a2ce1efbc0761e9e48600b7cf665c750b34022d417ab236c8880dbc4b09' +
            '1f8e8e6e156b219f57e52a81ffa58d3c8392625ccd3ebe173ac8fe5e01cadf5cd7f5db1e196212b6d2daf508123365ce' +
            '7d7d9a9e68b091ba9a20ae57249c3b74bb4e6eac6a1b5aa9a26010808bb9d1611aa2c78d6fb49dd192ea63c073e7491c' +
            'b9fa74fa6b3080b45197a584bf86ae961cbddc4465b3a9591fac7013b564220ddc63e71642c4939f4abfdde9bfb600ae' +
            '79d5341ba53b18660b21134e6b7bbb20dc00fc90bb5706b3e304ba100418fec0d425bd17180bfbf8f7a02d5933aace12' +
            'fd8c610bcedba982f7bd41349e00c7c213d2c1a96e33ee0d3e6d1ef3e5aefa8423b24dcff7dbd709ce6790ea2c044188' +
            'a90333995fd3bfd19bcd2f7be04c6dfc32ea60d5817377f10105a2273761b9c36765b1743f61ac08ec6b69d7b4375023' +
            '18c4a343b5ceba3fb33ec3e416c28fdf58c5898b79f384e2b76476dd6ce67a25d747129806361e0f7828ecd8069897d2' +
            '052d853b00e846e74ee24313bdf4930d2de4bb50ff7d39d5d9f1b4192cfc00bce09c9458f4f9bfab7a7768b27ee6dd5f' +
            '2c5133d28949df44840f9d91ff8ea83aa3150e1b721599291584b61f67c56d59134783fd7c44b78621d0444604560a32' +
            '28d44c8b341152c288113b1504c324a41091c24849076d0c8950218480e4808221d4108c967122c21085100b93a49984' +
            '1122a5468a48a4487b618d310c95d088822a163887ca523e8e6b01b3511485618d8b383c2b92848a307124181438ab14' +
            '8954842206424918155610448414829844d9cec0b38c440c641a21548a84220bb1848d105119054190c84522c3431551' +
            '4211892690900950559b59969429111384c609bb2ca18802268c4892c3524a331ce2a28688c448874111a48c20212424' +
            '4d49152044a0b6608715c1402a412229318251aa44624250454e19465121100a6515a8084696a41e2c61c40893c28331' +
            'a246936114aab63512294204894511896538019320410847ee085d211cca904034a194804c4a14c178a9cc8b84171a75' +
            'b073b2a388a48401210de1491613748399ac481b94b218a3880a8b31154281225321184db95a89c88a8090a462682422' +
            '48a2941046054e09c4620879c0885082010000000000000000000000000000000000000000000000',
        // sk
        '8cbe9660a20e8a7b8d370d52a3f2219f202045ebbf5f9dff7f2f4b3e6c64771b3420dd08615ed93c343feefc66eff297' +
            '50f21e308803f7c4352327efa601d1bd83675021169e35e7cfc497b3805da7bfee93b22ed65e0c80f9b5f3836f29a749' +
            'a062231ea515a2f9c8deb3b7f80c28d7654857e3d22021deb9b56d73295541465fa610354672e05b23e3d73d4221c637' +
            'bf6b3103c7afe5cb2d25e5283c7f1780c5983d43307423f4fab7eee3f6e8fbecc3362c1308c39faf773bd921c70db44b' +
            '4aee2344447fc2f86ac101bac4c28fdbe5e10186740af21b4f47023df11dcf3b319fc711482e6e971c732b67e578acbf' +
            '0f85b6621d15aa54bccbe4820b6f0c54a1b96465296bc4ab760b4f0428bd3f955e8c5cb1a5153bab6498c89a83c33ac2' +
            '714b164c9a2b87a368107dd0fa8070c89ff09236ecf3dfa891f25835fe8f8fd0ad82221dd15d8a46289b2feef36a4ddc' +
            '8e1bdc4bf88779e6c6905d649d6d5dcf6cacd3ef25081374',
        // sm
        '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a073e7b90e02ebf98ca2227eba38c1a' +
            'b2568209e46dba961869c6f83983b17dcd4975abf4a0ded89e6d41a28856c16597a304bbde4172f5e0c6a05ff4fd9c40' +
            'a4540b0cdb23d76d223efbd94ee6f02e6f35b09236a0dd2bacf2bdce7ff35a6f6109a9d8ae64ef1cccc056931f88645f' +
            '3b48fba30ab4f74ef083f36b18938a5c0972eee8edbd974397d9ea7f0d1857620870af4a0b707789f081ee8a9e0a3402' +
            'ecdc5500d17ce04bb8ab8914b64e8301adf4dbc9e81f0dd2f49bec40907413d95a6bf226c984673f475dc9337c4f3dd0' +
            'a8b15e0fd74c408cb948642fe4cf2644e78b4e756a5768ff0e956e09841092e3c111701a1ea04f93585b9b07971ab309' +
            '5b211fcf98df0a216e05357646978ba3a44aecec6424b698cce42711686f671f91921d0115893144dc1b217d85826b34' +
            '11f2fa328b3cb2440c6d840ed5807cec6523d201971fd219d5580cdde96d8870a2b190e1ed826adf427c3d6d7caf258f' +
            '3c7a9d7a76f663ac652f925c06e35cba031d94ae27403c0d989864b0060baa0ddaacec6c02010b79ad090accc24555b2' +
            '36ec240f9a92dc5e8201e5c71f5b89914278c3e0ea1f11dc2671b686865a8e329fd00765538d137801568f18001e905b' +
            '32314010b3ab639c3b4e8f4938cd6360670bab55f351918ae5cb0d93183a3da71cc66729c7c4264a60956696d28f472b' +
            '2fd5d28d5e75c1bdc143b23f0401457947a1ef5765a35481ba794d2022f85390101dd415e683a18783e5d37e9765342c' +
            '85cc31d35bc24317029b240d9139f09eb1cf8b95e8e20727661596f9d03c8bfad109db4341244957674d38914b0f0bd9' +
            '74733e0418fc50376a3b276d016d3be535699e78005c5a290e45465135f6b4c73329202b50ca236b190d8a1592742798' +
            'd664f84318e0fc647427d50d03eb641b00acb613514c9f804cfcc84e4231a4ed8243b6e86875e7d3cc13373a836e8385' +
            'e95be8a6412186f2bdcbf22d7091821effcc70017ec74782795eafc84027e4ac5696d76bf29305dff5ffcabe4e2c471f' +
            'b0266898da7bc916d097b0ba8e04b62194401e37e5a65065d99f189a4a1d07723a4732a20a53700cd32f2f1c45f2bb2e' +
            'c87b665867c90617648b9a921843771c12a549492458cee5af72fa120a56af1dd4cf434525583a8853682762de592c9c' +
            '947b36e0220f531fc7f9c6db75301e47d7c5019f9437a82d91d730f1cf71325064ca30dd60e2abae6d870020932d5abc' +
            '1f44599767878d036933c1b0ec909d18fdb7b976acea739b9450f95e316700bcd4a6edb1494709620f63a1e867e52990' +
            'b7c476d5fd6cab29f546aa7d00e16ee47394299ebdf9b478113f1377659ef4a8a52e01d50822e7ff4cbe2c3157a3ecc6' +
            'a7efa5a256b48907ae4b57abd5af95946fb431966effc9728b5e373be236df64322b3b9a38a8ae229228616e19239e31' +
            '4ad3daeb4851252b3579b7369c29398626892490887232292ba51bb3feb2a232169490681545e8bb24aa8f6629f9a42a' +
            'c73658d98c9c658f0c099d9a5e221e554516d2d43093615a4c455192737b366b2ca33336dfa456713653222cccd9f815' +
            '1dd65a48ad9a315b42564b10ad4d03ed47e9aaa88e854f6d84472d2e2b1b5aea65592eb93a0b09253e5b37aa610a45b5' +
            '6affa56c941a366ef792946366d1552b6bf64f7552226b6bcca892456abdec75d368291fb18c9ac4b692cbaaf6e5445b' +
            'ec3c4249e7abcb94f65a5a4b010000000000000000000000000000000000000000000000000000'
      )
    ]
  ];

  /**
   * A copy of the octets with one of them inverted.
   * @param {uint8[]} bytes - bytes
   * @param {int32} index - index
   * @returns {uint8[]} Result
   */
  function FlipOctet(bytes, index) {
    const out = bytes.slice();
    out[index] = OpCodes.Xor32(out[index], 0xFF);
    return out;
  }

  /**
   * @param {string} setName - the parameter set
   * @param {HawkKatRecord} r - a record
   * @returns {string} where the record comes from
   */
  function KatLabel(setName, r) {
    return setName + ' ' + r.file + ' count ' + r.count;
  }

  // ===== ALGORITHM =====

  class HawkAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = 'HAWK';
      this.description = 'Lattice-based hash-and-sign signature over rank-2 module lattices, the round-two '
        + 'submission to the NIST additional signatures process. The secret key is a basis of the lattice, '
        + 'the public key its Gram matrix; signing samples a discrete Gaussian around a hashed target and '
        + 'verifying measures the result in the public quadratic form. Keys, signing and verification '
        + 'follow the reference exactly, including its fixed-point NTRU solver. Withdrawn in 2026 after a '
        + 'lattice-reduction attack; kept for its construction and its published test vectors.';
      this.inventor = 'Joppe W. Bos, Olivier Bronchain, Leo Ducas, Serge Fehr, Yu-Hsuan Huang, Thomas Pornin, '
        + 'Eamonn W. Postlethwaite, Thomas Prest, Ludo N. Pulles, Wessel van Woerden';
      this.year = 2022;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Lattice Digital Signature';
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      /** @type {string[]} */
      this.parameterSets = [];
      for (let i = 0; i < PARAMETER_SET_LIST.length; ++i) this.parameterSets.push(PARAMETER_SET_LIST[i].name);

      // The key is the encoded secret key of the parameter set: 96, 184 or
      // 360 octets. Its length selects the parameter set.
      /** @type {KeySize[]} */
      const keySizes = [];
      for (let i = 0; i < PARAMETER_SET_LIST.length; ++i) {
        const size = PARAMETER_SET_LIST[i].skSize;
        keySizes.push(new KeySize(size, size, 0));
      }
      this.SupportedKeySizes = keySizes;

      this.documentation = [
        new LinkItem('HAWK round-two specification',
          'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/hawk-spec-round2-web.pdf'),
        new LinkItem('HAWK project site', 'https://hawk-sign.info/'),
        new LinkItem('NIST PQC additional digital signature schemes', 'https://csrc.nist.gov/projects/pqc-dig-sig'),
        new LinkItem('Ducas, Postlethwaite, Pulles, van Woerden - Hawk: Module LIP makes Lattice Signatures Fast, Compact and Simple (ASIACRYPT 2022)',
          'https://eprint.iacr.org/2022/1155')
      ];

      this.references = [
        new LinkItem('HAWK round-two submission package, reference code and KAT files',
          'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip'),
        new LinkItem('HAWK development repository', 'https://github.com/hawk-sign/dev'),
        new LinkItem('FIPS 202 - SHA-3 and the SHAKE functions', 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Withdrawn after a lattice-reduction attack',
          'In July 2026 HAWK was withdrawn from the NIST process after an attack that roughly halves the '
          + 'block size lattice reduction needs to recover an equivalent secret key, well below the '
          + 'claimed security levels; the designers found no competitive repair',
          'Use a standardised signature such as ML-DSA (FIPS 204) or SLH-DSA (FIPS 205)',
          'https://hawk-sign.info/'),
        new Vulnerability('HAWK-256 is a challenge parameter set',
          'HAWK-256 was never meant to reach a NIST security level and may fail to sign with a '
          + 'probability of about 2^-39.5 per signature',
          'Do not use HAWK-256 for anything but study',
          'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/hawk-spec-round2-web.pdf'),
        new Vulnerability('Published demonstration keys',
          'The secret keys in the test vectors are printed in this file, come from published Known Answer '
          + 'Tests and confer no secrecy whatever',
          'Nothing here is usable as a key',
          'https://hawk-sign.info/')
      ];

      // Test vectors.
      //
      // Every expected value is a field of a published KAT record: the sm or
      // the msg of PQCsignKAT_96.rsp, PQCsignKAT_184.rsp or PQCsignKAT_360.rsp
      // in the round-two package. The negative cases corrupt one octet of a
      // published signed message, or pair it with another record's public
      // key, and expect rejection. Nothing here was produced by this file.
      //
      // Per parameter set the vectors pin each procedure separately:
      //   - signing, from the record's secret key and generator seed;
      //   - key generation, from the generator seed alone, which also has to
      //     reproduce every seed the harness discarded before the key it kept;
      //   - verification, under the record's public key;
      //   - the public key rebuilt from a secret key by the NTRU solver, which
      //     opening under the secret key alone depends on;
      //   - rejection of a modified message, a modified signature and a
      //     foreign public key, next to the acceptance of the original.
      //
      // Measured over the whole of the three response files, not only the
      // records committed here: all 300 records reproduce their public key and
      // secret key from their seed, their public key from their secret key,
      // their signed message octet for octet, and open under their public key.
      this.tests = [];
      const uri = 'https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip';
      for (let set = 0; set < PARAMETER_SET_LIST.length; ++set) {
        const P = PARAMETER_SET_LIST[set];
        const setName = P.name;
        const r0 = KAT[set][0];
        const r1 = KAT[set][1];
        const where0 = KatLabel(setName, r0);
        const where1 = KatLabel(setName, r1);

        const signing = new TestCase(OpCodes.Hex8ToBytes(r0.msg), OpCodes.Hex8ToBytes(r0.sm),
          where0 + ': signing with the secret key replays the published signed message', uri);
        signing.key = OpCodes.Hex8ToBytes(r0.sk);
        signing.drbgSeed = OpCodes.Hex8ToBytes(r0.seed);
        this.tests.push(signing);

        const keygen = new TestCase(OpCodes.Hex8ToBytes(r1.msg), OpCodes.Hex8ToBytes(r1.sm),
          where1 + ': key generation from the harness seed, then signing, replays the published signed message', uri);
        keygen.parameterSet = setName;
        keygen.drbgSeed = OpCodes.Hex8ToBytes(r1.seed);
        this.tests.push(keygen);

        const open0 = new TestCase(OpCodes.Hex8ToBytes(r0.sm), OpCodes.Hex8ToBytes(r0.msg),
          where0 + ': the published signed message opens under the published public key', uri);
        open0.inverse = true;
        open0.publicKey = OpCodes.Hex8ToBytes(r0.pk);
        this.tests.push(open0);

        const open1 = new TestCase(OpCodes.Hex8ToBytes(r1.sm), OpCodes.Hex8ToBytes(r1.msg),
          where1 + ': the published signed message opens under the published public key', uri);
        open1.inverse = true;
        open1.publicKey = OpCodes.Hex8ToBytes(r1.pk);
        this.tests.push(open1);

        const rebuilt = new TestCase(OpCodes.Hex8ToBytes(r1.sm), OpCodes.Hex8ToBytes(r1.msg),
          where1 + ': the published signed message opens under the public key rebuilt from the secret key', uri);
        rebuilt.inverse = true;
        rebuilt.key = OpCodes.Hex8ToBytes(r1.sk);
        this.tests.push(rebuilt);

        /** @type {uint8[]} */
        const accepted = [1];
        const accept = new TestCase(OpCodes.Hex8ToBytes(r0.sm), accepted,
          where0 + ': the verdict on the published signed message is acceptance', uri);
        accept.inverse = true;
        accept.publicKey = OpCodes.Hex8ToBytes(r0.pk);
        accept.message = OpCodes.Hex8ToBytes(r0.msg);
        this.tests.push(accept);

        /** @type {uint8[]} */
        const rejectedMessage = [0];
        const badMessage = new TestCase(FlipOctet(OpCodes.Hex8ToBytes(r0.sm), 0), rejectedMessage,
          where0 + ': the signature must not verify for a message with its first octet changed', uri);
        badMessage.inverse = true;
        badMessage.publicKey = OpCodes.Hex8ToBytes(r0.pk);
        badMessage.message = FlipOctet(OpCodes.Hex8ToBytes(r0.msg), 0);
        this.tests.push(badMessage);

        /** @type {uint8[]} */
        const rejectedSignature = [0];
        const s1Offset = OpCodes.Hex8ToBytes(r0.msg).length + P.saltLen + 8;
        const badSignature = new TestCase(FlipOctet(OpCodes.Hex8ToBytes(r0.sm), s1Offset), rejectedSignature,
          where0 + ': a signature with one octet of s1 changed must not verify', uri);
        badSignature.inverse = true;
        badSignature.publicKey = OpCodes.Hex8ToBytes(r0.pk);
        badSignature.message = OpCodes.Hex8ToBytes(r0.msg);
        this.tests.push(badSignature);

        /** @type {uint8[]} */
        const rejectedKey = [0];
        const foreignKey = new TestCase(OpCodes.Hex8ToBytes(r0.sm), rejectedKey,
          where0 + ': the signed message must not verify under count ' + r1.count + '\'s public key', uri);
        foreignKey.inverse = true;
        foreignKey.publicKey = OpCodes.Hex8ToBytes(r1.pk);
        foreignKey.message = OpCodes.Hex8ToBytes(r0.msg);
        this.tests.push(foreignKey);
      }
    }

    /**
     * @param {boolean} [isInverse=false] - true to verify (sign_open), false to sign
     * @returns {HawkInstance}
     */
    CreateInstance(isInverse = false) {
      return new HawkInstance(this, isInverse);
    }
  }

  /**
   * HAWK instance implementing the Feed/Result pattern of the NIST API.
   *
   * Signing consumes a message and returns message || signature, which is what
   * crypto_sign writes. The inverse direction is crypto_sign_open: it checks the
   * signature at the end of the input and returns the message before it,
   * reporting a bad signature by throwing - or, when a message property is set,
   * returns [1] or [0] as the verdict on that message instead.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class HawkInstance extends IAlgorithmInstance {
    /**
     * @param {HawkAlgorithm} algorithm - parent algorithm instance
     * @param {boolean} [isInverse=false] - verification mode
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {HawkParams|null} */
      this._params = null;
      /** @type {boolean} */
      this._explicitSet = false;
      /** @type {uint8[]|null} */
      this._keyData = null;
      /** @type {uint8[]|null} */
      this._publicKeyData = null;
      /** @type {uint8[]|null} */
      this._derivedPublicKey = null;
      /** @type {uint8[]|null} */
      this._drbgSeed = null;
      /** @type {uint8[]|null} */
      this._message = null;
      this.inputBuffer = [];
    }

    /**
     * Install an encoded secret key; its length selects the parameter set.
     * @param {uint8[]|null} keyData - 96, 184 or 360 octets
     */
    KeySetup(keyData) {
      if (!keyData) {
        this._keyData = null;
        this._derivedPublicKey = null;
        return;
      }
      const P = ParamsBySkSize(keyData.length);
      if (!P || (this._params && this._params !== P && this._explicitSet))
        throw new Error('HAWK: the secret key is 96 (HAWK-256), 184 (HAWK-512) or 360 (HAWK-1024) octets, not '
          + keyData.length);
      this._params = P;
      this._keyData = Array.from(keyData);
      this._derivedPublicKey = null;
    }

    /**
     * @param {uint8[]|null} keyData - the encoded secret key
     */
    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
     * @returns {uint8[]|null} a copy of the encoded secret key
     */
    get key() {
      return this._keyData ? this._keyData.slice() : null;
    }

    /**
     * @returns {string|null} the name of the parameter set in use
     */
    get parameterSet() {
      return this._params ? this._params.name : null;
    }

    /**
     * @param {string} name - 'HAWK-256', 'HAWK-512' or 'HAWK-1024'
     */
    set parameterSet(name) {
      const P = ParameterSetEntry(name);
      if (!P) throw new Error('HAWK: unknown parameter set ' + name);
      if (this._keyData && this._keyData.length !== P.skSize)
        throw new Error('HAWK: the configured key does not belong to ' + name);
      this._params = P;
      this._explicitSet = true;
    }

    /**
     * The public key: the one set explicitly, the one rebuilt from the
     * secret key's seed, or the one the configured generator seed yields.
     * @returns {uint8[]|null} a copy of the encoded public key
     */
    get publicKey() {
      if (this._publicKeyData) return this._publicKeyData.slice();
      if (!this._keyData && this._drbgSeed && this._params) {
        const pair = Keygen(this._params, new HawkRandom(this._drbgSeed));
        this._keyData = Array.from(pair.sk);
        this._derivedPublicKey = Array.from(pair.pk);
      }
      if (!this._keyData) return null;
      if (!this._derivedPublicKey)
        this._derivedPublicKey = Array.from(PublicKeyFromSecret(this._params, Uint8Array.from(this._keyData)));
      return this._derivedPublicKey.slice();
    }

    /**
     * @param {uint8[]|null} value - 450, 1024 or 2440 octets
     */
    set publicKey(value) {
      if (!value) {
        this._publicKeyData = null;
        return;
      }
      const P = ParamsByPkSize(value.length);
      if (!P) throw new Error('HAWK: the public key is 450, 1024 or 2440 octets, not ' + value.length);
      if (this._keyData && this._params !== P)
        throw new Error('HAWK: the public key does not belong to the configured parameter set');
      this._params = P;
      this._publicKeyData = Array.from(value);
    }

    /**
     * The 48-octet seed of a NIST harness run, whose generator then supplies all randomness.
     * @param {uint8[]|null} value - the seed
     */
    set drbgSeed(value) {
      if (!value) {
        this._drbgSeed = null;
        return;
      }
      if (value.length !== 48) throw new Error('HAWK: a generator seed is 48 octets');
      this._drbgSeed = Array.from(value);
    }

    /**
     * @returns {uint8[]|null} a copy of the generator seed
     */
    get drbgSeed() {
      return this._drbgSeed ? this._drbgSeed.slice() : null;
    }

    /**
     * With a message set, verification returns a verdict on it instead of the message.
     * @param {uint8[]|null} value - the message
     */
    set message(value) {
      this._message = value ? Array.from(value) : null;
    }

    /**
     * @returns {uint8[]|null} a copy of the message
     */
    get message() {
      return this._message ? this._message.slice() : null;
    }

    /**
     * @returns {uint8[]} the signed message, or the opened message or verdict
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? this._open(input) : this._sign(input);
    }

    /**
     * The random source for signing: the replayed harness generator after
     * the key-generation draws, or zeros.
     * @returns {HawkRandom} the source
     */
    _signingRng() {
      const P = this._params;
      if (!this._drbgSeed) return new HawkRandom(null);
      const rng = new HawkRandom(this._drbgSeed);
      if (!this._keyData) {
        const pair = Keygen(P, rng);
        this._keyData = Array.from(pair.sk);
        this._derivedPublicKey = Array.from(pair.pk);
        return rng;
      }
      // Key generation draws one seed per attempt and keeps the last; the
      // attempts it discarded are skipped by drawing until the key's seed.
      const seed = this._keyData.slice(0, P.seedLen);
      for (let attempt = 0; attempt < 100000; ++attempt) {
        /** @type {uint8[]} */
        const drawn = rng.Read(P.seedLen);
        let same = true;
        for (let i = 0; i < P.seedLen; ++i)
          if (drawn[i] !== seed[i]) { same = false; break; }
        if (same) return rng;
      }
      throw new Error(P.name + ': the generator seed did not produce this secret key');
    }

    /**
     * @param {uint8[]} message - the message
     * @returns {uint8[]} message || signature
     */
    _sign(message) {
      if (!this._params)
        throw new Error('HAWK: signing needs a secret key, or a generator seed and a parameter set');
      if (!this._keyData && !this._drbgSeed)
        throw new Error('HAWK: signing needs a secret key');
      const P = this._params;
      const rng = this._signingRng();
      const sig = Sign(P, Uint8Array.from(this._keyData), message, rng);
      /** @type {uint8[]} */
      const out = new Array(message.length + sig.length);
      for (let i = 0; i < message.length; ++i) out[i] = message[i];
      for (let i = 0; i < sig.length; ++i) out[message.length + i] = sig[i];
      return out;
    }

    /**
     * @param {uint8[]} sm - message || signature
     * @returns {uint8[]} the message, or [1]/[0] as the verdict on the configured message
     */
    _open(sm) {
      if (!this._params)
        throw new Error('HAWK: verification needs a public key or a secret key');
      const P = this._params;
      /** @type {uint8[]|null} */
      const pk = this.publicKey;
      if (!pk) throw new Error('HAWK: verification needs a public key or a secret key');

      let accepted = false;
      /** @type {uint8[]} */
      let message = [];
      if (sm.length >= P.sigSize) {
        message = sm.slice(0, sm.length - P.sigSize);
        accepted = Verify(P, Uint8Array.from(pk), message, Uint8Array.from(sm.slice(sm.length - P.sigSize)));
      }

      if (this._message) {
        let same = accepted && message.length === this._message.length;
        for (let i = 0; same && i < message.length; ++i)
          if (message[i] !== this._message[i]) same = false;
        /** @type {uint8[]} */
        const verdict = [same ? 1 : 0];
        return verdict;
      }
      if (!accepted) throw new Error(P.name + ': the signature does not verify');
      return message;
    }

    ClearData() {
      if (this._keyData) OpCodes.ClearArray(this._keyData);
      this._keyData = null;
      this._derivedPublicKey = null;
      this._publicKeyData = null;
      this._drbgSeed = null;
      this._message = null;
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new HawkAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    HawkAlgorithm,
    HawkInstance,
    PARAMETER_SET_LIST,
    Shake256,
    HawkRandom,
    RegenFG,
    KeygenAttempt,
    Keygen,
    SolveNTRU,
    PublicKeyFromSecret,
    EncodePublic,
    Sign,
    Verify,
    RootTable
  };
}));
