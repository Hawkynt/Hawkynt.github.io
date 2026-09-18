/*
 * LWE-Signature Implementation
 * Lyubashevsky's Fiat-Shamir-with-aborts signature over unstructured LWE/SIS
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The identification scheme underneath is three moves. The signer commits to
 * w = A*y for a masking vector y, the verifier sends a sparse challenge c, and
 * the signer answers z = y + S*c, where S is the secret whose image T = A*S is
 * the public key. The verifier recomputes
 *
 *     A*z - T*c  =  A*y + A*S*c - A*S*c  =  A*y  =  w
 *
 * which holds exactly, with no error term, because T is defined as A*S rather
 * than as A*S plus noise. Fiat-Shamir replaces the verifier by a hash, so the
 * challenge is c = H(public key, message, w), and the signature is (c, z).
 *
 * What makes it a signature rather than a leak is the abort. z = y + S*c
 * depends on S, and handing out many such z would reveal it. So the signer
 * rejects any z falling outside a box strictly smaller than the one y was drawn
 * from, and retries with a fresh y. Because y is uniform on [-(gamma-1), gamma-1]
 * and every coordinate of S*c is bounded by kappa*eta, every accepted z is
 * uniform on [-zBound, zBound] whatever S is: the accepted distribution carries
 * no information about the secret at all. That is Lyubashevsky's rejection
 * sampling, and it is what the rejection loop below implements.
 *
 * Unstructured rather than ring-based: A is a plain n-by-m matrix over Z_q with
 * no ring structure, which is the original form of the construction and the
 * reason the public key is large. Dilithium is this scheme over a polynomial
 * ring, which is where the size goes.
 *
 * ! No published test vectors exist for this construction. It is a scheme from
 * ! the literature rather than a standard: there is no specification fixing a
 * ! parameter set, no reference implementation to agree with, and nothing to
 * ! check a signature against. The parameters below were chosen here, for
 * ! correctness and for the rejection-sampling argument to hold; they have not
 * ! been analysed against lattice attacks and carry no claimed security level.
 * ! What is verified is stated in the test vector comment.
 *
 * References:
 *   Lyubashevsky - Fiat-Shamir With Aborts: Applications to Lattice and
 *                  Factoring-Based Signatures, Asiacrypt 2009
 *   Lyubashevsky - Lattice Signatures Without Trapdoors, Eurocrypt 2012
 *   Regev        - On Lattices, Learning with Errors, ..., STOC 2005
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

  // ===== PARAMETERS =====

  // One parameter set, not three. The stub this replaces named LWE-SIG-128,
  // -192 and -256 and derived nothing from any of them; inventing three
  // unanalysed parameter sets states three security levels that have not been
  // measured, where one states none.
  //
  // Chosen so that the construction is correct and cheap to check:
  //   Q       a 20-bit prime, small enough that A*z accumulates to about 2^44
  //           and so is exact in a double without intermediate reduction
  //   M, N    the shape of A: N rows, M columns, so w has N coordinates and
  //           y and z have M
  //   K       the width of the secret S and the length of the challenge. The
  //           challenge space is C(K, KAPPA) * 2^KAPPA, about 2^136 here
  //   KAPPA   the number of non-zero challenge coordinates
  //   ETA     the bound on a coefficient of S, so S is ternary
  //   GAMMA   y is uniform on [-(GAMMA-1), GAMMA-1]
  //   ZBOUND  GAMMA - 1 - KAPPA*ETA, the box an accepted z must lie in
  //
  // GAMMA is 2^-5 of Q rather than close to it: at GAMMA near Q/2 the accepted
  // z would be near-uniform modulo Q and the short-vector problem a forger has
  // to solve would not be a short-vector problem at all.
  const Q = 1048573;        // 2^20 - 3, prime
  const N = 256;            // rows of A
  const M = 512;            // columns of A
  const K = 128;            // columns of S, length of the challenge
  const KAPPA = 30;         // non-zero challenge coordinates
  const ETA = 1;            // S is ternary
  const GAMMA = 32768;      // 2^15
  const SBOUND = KAPPA * ETA;
  const ZBOUND = GAMMA - 1 - SBOUND;

  const SEED_LENGTH = 32;         // the master seed a caller supplies
  const CHALLENGE_LENGTH = 32;    // the hash carried in a signature
  const SIGNATURE_LENGTH = CHALLENGE_LENGTH + 2 * M;

  // ===== EXTENDABLE OUTPUT =====

  // The two XOFs are loaded on first use rather than at load: requiring them
  // here would register hash algorithms while this file is being loaded, and
  // every tool that attributes an algorithm to whichever file was loading when
  // it registered would then file SHAKE under asymmetric ciphers.
  let hashesLoaded = false;

  /**
   * Load the XOF module this file needs, once.
   * @returns {void}
   */
  function loadHashes() {
    if (hashesLoaded) return;
    hashesLoaded = true;
    if (typeof require === 'undefined') return;

    try {
      require('../hash/shake.js');
    } catch (error) {
      // In the browser this arrives as a script tag instead; Find() reports it.
    }
  }

  // The registered SHAKE refuses to squeeze more than this in one call, so a
  // longer stream is produced by running it in counter mode: block i is
  // SHAKE(seed || I2OSP(i, 4)). Everything below that needs an arbitrary
  // length goes through xofStream, so the convention is stated once.
  const XOF_BLOCK = 1024;

  /**
   * An octet stream of unbounded length derived from a seed.
   * @param {string} name - Registered XOF name, SHAKE128 or SHAKE256
   * @param {uint8[]} seed - Seed octets
   * @returns {function():number} Returns the next octet on each call
   */
  function xofStream(name, seed) {
    loadHashes();

    const algorithm = AlgorithmFramework.Find(name);
    if (!algorithm) {
      throw new Error('LWE-Signature requires ' + name + ', which is not registered');
    }

    let counter = 0;
    let buffer = [];
    let position = 0;

    return function next() {
      if (position >= buffer.length) {
        const suffix = OpCodes.Unpack32BE(counter);
        ++counter;

        const input = new Array(seed.length + 4);
        for (let i = 0; i < seed.length; ++i) input[i] = seed[i];
        for (let i = 0; i < 4; ++i) input[seed.length + i] = suffix[i];

        const instance = algorithm.CreateInstance();
        instance.outputSize = XOF_BLOCK;
        instance.Feed(input);
        buffer = instance.Result();
        position = 0;
      }
      return buffer[position++];
    };
  }

  /**
   * A fixed number of octets derived from a seed.
   * @param {string} name - Registered XOF name
   * @param {uint8[]} seed - Seed octets
   * @param {number} length - Octets required
   * @returns {uint8[]} The derived octets
   */
  function xof(name, seed, length) {
    const next = xofStream(name, seed);
    const out = new Array(length);
    for (let i = 0; i < length; ++i) out[i] = next();
    return out;
  }

  // ===== KEY EXPANSION =====

  /**
   * Expand the public matrix A from its seed, by rejection sampling into
   * [0, Q). Three octets give 24 bits; the low 20 are kept, which is one bit
   * wider than Q, so all but three values in 2^20 are accepted immediately.
   * @param {uint8[]} seed - Seed octets
   * @returns {Int32Array} A in row-major order, N*M entries
   */
  function expandA(seed) {
    const next = xofStream('SHAKE128', seed);
    const a = new Int32Array(N * M);
    let filled = 0;

    while (filled < N * M) {
      const raw = (next() * 65536 + next() * 256 + next()) % 1048576;
      if (raw < Q) a[filled++] = raw;
    }

    return a;
  }

  /**
   * Expand the ternary secret S from its seed.
   * @param {uint8[]} seed - Seed octets
   * @returns {Int8Array} S in row-major order, M*K entries in {-1, 0, 1}
   */
  function expandS(seed) {
    const next = xofStream('SHAKE256', seed);
    const s = new Int8Array(M * K);

    for (let i = 0; i < M * K; ++i) {
      // Values 0..242 are an exact multiple of three, so taking the remainder
      // of anything below that is unbiased; the rest are drawn again.
      let raw = next();
      while (raw >= 243) raw = next();
      const r = raw % 3;
      s[i] = r === 2 ? -1 : r;
    }

    return s;
  }

  /**
   * The public key T = A*S mod Q.
   * @param {Int32Array} a - The matrix A
   * @param {Int8Array} s - The secret S
   * @returns {Int32Array} T in row-major order, N*K entries
   */
  function computeT(a, s) {
    const t = new Int32Array(N * K);

    // A partial sum reaches Q*M, about 2^29, so an Int32Array holds it. The
    // multiplication is by a ternary value, so it is an add or a subtract.
    for (let row = 0; row < N; ++row) {
      const aRow = row * M;
      const tRow = row * K;
      for (let j = 0; j < M; ++j) {
        const value = a[aRow + j];
        if (value === 0) continue;
        const sRow = j * K;
        for (let c = 0; c < K; ++c) {
          const coefficient = s[sRow + c];
          if (coefficient === 1) t[tRow + c] += value;
          else if (coefficient === -1) t[tRow + c] -= value;
        }
      }
      for (let c = 0; c < K; ++c) t[tRow + c] = ((t[tRow + c] % Q) + Q) % Q;
    }

    return t;
  }

  /**
   * Encode a vector of values below 2^24 as three octets each, big-endian.
   * Used only as hash input, where a fixed width is what matters.
   * @param {Int32Array|number[]} values - The values
   * @returns {uint8[]} Three octets per value
   */
  function encodeWide(values) {
    const out = new Array(values.length * 3);
    for (let i = 0; i < values.length; ++i) {
      const v = values[i];
      out[i * 3] = Math.floor(v / 65536) % 256;
      out[i * 3 + 1] = Math.floor(v / 256) % 256;
      out[i * 3 + 2] = v % 256;
    }
    return out;
  }

  // Deriving A and T costs a few hundred milliseconds, and every instance
  // configured with the same seed derives the same thing, so the expansion is
  // memoised on the seed. Nothing secret is cached that the seed does not
  // already determine.
  const KEY_CACHE = new Map();

  /**
   * Derive a key pair from a master seed.
   *
   * The three sub-seeds are separate so that the public matrix, the secret and
   * the masking vectors are independent: seedA is public and expands A, seedS
   * is secret and expands S, and seedK is secret and derandomises signing.
   *
   * @param {uint8[]} seed - Master seed, SEED_LENGTH octets
   * @returns {Object} { seedA, seedK, a, s, t, publicDigest }
   */
  function deriveKeyPair(seed) {
    let cacheKey = '';
    for (let i = 0; i < seed.length; ++i) cacheKey += (seed[i] + 256).toString(16).slice(1);
    const cached = KEY_CACHE.get(cacheKey);
    if (cached) return cached;

    const expanded = xof('SHAKE256', seed, 3 * SEED_LENGTH);
    const seedA = expanded.slice(0, SEED_LENGTH);
    const seedS = expanded.slice(SEED_LENGTH, 2 * SEED_LENGTH);
    const seedK = expanded.slice(2 * SEED_LENGTH, 3 * SEED_LENGTH);

    const a = expandA(seedA);
    const s = expandS(seedS);
    const t = computeT(a, s);

    // Everything the verifier holds, bound into one digest, so that the
    // challenge commits to the public key as well as to the message. Without
    // it a signature says nothing about which key it was made under.
    const digestInput = seedA.concat(encodeWide(t));
    const publicDigest = xof('SHAKE256', digestInput, 32);

    const keyPair = { seedA, seedK, a, s, t, publicDigest };
    KEY_CACHE.set(cacheKey, keyPair);
    return keyPair;
  }

  // ===== SCHEME =====

  /**
   * Expand a challenge hash into a sparse ternary vector: KAPPA coordinates of
   * the K are non-zero, each plus or minus one.
   * @param {uint8[]} challengeHash - The hash carried in the signature
   * @returns {Int8Array} The challenge, K entries
   */
  function expandChallenge(challengeHash) {
    const next = xofStream('SHAKE256', challengeHash);
    const c = new Int8Array(K);
    let placed = 0;

    while (placed < KAPPA) {
      // K is a power of two, so the remainder of a 16-bit draw is unbiased.
      const position = (next() * 256 + next()) % K;
      if (c[position] !== 0) continue;
      c[position] = (next() % 2) === 0 ? 1 : -1;
      ++placed;
    }

    return c;
  }

  /**
   * The challenge hash: a commitment to the public key, the message and w.
   * @param {uint8[]} publicDigest - Digest of the public key
   * @param {uint8[]} message - Message octets
   * @param {number[]} w - The commitment vector, N entries below Q
   * @returns {uint8[]} CHALLENGE_LENGTH octets
   */
  function challengeHash(publicDigest, message, w) {
    const encoded = encodeWide(w);
    const input = new Array(publicDigest.length + encoded.length + message.length);
    let at = 0;
    for (let i = 0; i < publicDigest.length; ++i) input[at++] = publicDigest[i];
    for (let i = 0; i < encoded.length; ++i) input[at++] = encoded[i];
    for (let i = 0; i < message.length; ++i) input[at++] = message[i];
    return xof('SHAKE256', input, CHALLENGE_LENGTH);
  }

  /**
   * w = A*y mod Q.
   * @param {Int32Array} a - The matrix A
   * @param {Int32Array} y - A vector of M entries
   * @returns {number[]} N entries in [0, Q)
   */
  function multiplyA(a, y) {
    // A plain array rather than an Int32Array: the accumulator reaches about
    // Q*GAMMA*M, some 2^44, which a double holds exactly and an Int32Array
    // would silently truncate.
    const w = new Array(N);
    for (let row = 0; row < N; ++row) {
      let accumulator = 0;
      const offset = row * M;
      for (let j = 0; j < M; ++j) accumulator += a[offset + j] * y[j];
      w[row] = ((accumulator % Q) + Q) % Q;
    }
    return w;
  }

  /**
   * Sign a message.
   *
   * Deterministic, as the default mode of this family is: the masking vector of
   * each attempt comes from the secret seedK, the message and the attempt
   * number rather than from an RNG, so the same message always produces the
   * same signature and a weak generator cannot leak the secret.
   *
   * @param {Object} keyPair - From deriveKeyPair
   * @param {uint8[]} message - Message octets
   * @returns {uint8[]} SIGNATURE_LENGTH octets
   */
  function signMessage(keyPair, message) {
    const { a, s, seedK, publicDigest } = keyPair;

    // Enough attempts that exhausting them is impossible in practice: each is
    // accepted with probability about 0.63, so the chance of 256 failures is
    // below 2^-190.
    const maxAttempts = 256;

    for (let attempt = 0; attempt < maxAttempts; ++attempt) {
      const suffix = OpCodes.Unpack32BE(attempt);
      const maskSeed = new Array(seedK.length + message.length + 4);
      let at = 0;
      for (let i = 0; i < seedK.length; ++i) maskSeed[at++] = seedK[i];
      for (let i = 0; i < message.length; ++i) maskSeed[at++] = message[i];
      for (let i = 0; i < 4; ++i) maskSeed[at++] = suffix[i];

      // y uniform on [-(GAMMA-1), GAMMA-1], which is 2*GAMMA-1 values. Drawing
      // 16 bits and rejecting anything at or above 65534 keeps it unbiased,
      // because 65534 is 2*(2*GAMMA-1).
      const next = xofStream('SHAKE256', maskSeed);
      const y = new Int32Array(M);
      for (let i = 0; i < M; ++i) {
        let raw = next() * 256 + next();
        while (raw >= 65534) raw = next() * 256 + next();
        y[i] = (raw % (2 * GAMMA - 1)) - (GAMMA - 1);
      }

      const w = multiplyA(a, y);
      const cHash = challengeHash(publicDigest, message, w);
      const c = expandChallenge(cHash);

      // z = y + S*c. The challenge is sparse, so only KAPPA columns of S are
      // touched, and each contributes an add or a subtract.
      const z = new Int32Array(M);
      for (let i = 0; i < M; ++i) z[i] = y[i];
      for (let ci = 0; ci < K; ++ci) {
        const sign = c[ci];
        if (sign === 0) continue;
        for (let i = 0; i < M; ++i) {
          const coefficient = s[i * K + ci];
          if (coefficient === 0) continue;
          z[i] += sign * coefficient;
        }
      }

      // The abort. Every coordinate of S*c is bounded by SBOUND, so an accepted
      // z is uniform on [-ZBOUND, ZBOUND] whatever S is, and reveals nothing
      // about it. Returning a z outside the box is what would leak the secret.
      let accepted = true;
      for (let i = 0; i < M; ++i) {
        if (z[i] > ZBOUND || z[i] < -ZBOUND) { accepted = false; break; }
      }
      if (!accepted) continue;

      const signature = new Array(SIGNATURE_LENGTH);
      for (let i = 0; i < CHALLENGE_LENGTH; ++i) signature[i] = cHash[i];
      for (let i = 0; i < M; ++i) {
        const shifted = z[i] + ZBOUND;   // in [0, 2*ZBOUND], which is below 2^16
        signature[CHALLENGE_LENGTH + i * 2] = Math.floor(shifted / 256);
        signature[CHALLENGE_LENGTH + i * 2 + 1] = shifted % 256;
      }
      return signature;
    }

    throw new Error('LWE-Signature: rejection sampling did not accept in ' + maxAttempts + ' attempts');
  }

  /**
   * Check a signature over a message.
   * @param {Object} keyPair - From deriveKeyPair; only the public parts are read
   * @param {uint8[]} message - Message octets
   * @param {uint8[]} signature - SIGNATURE_LENGTH octets
   * @returns {boolean} Whether the signature verifies
   */
  function verifyMessage(keyPair, message, signature) {
    const { a, t, publicDigest } = keyPair;

    if (!signature || signature.length !== SIGNATURE_LENGTH) return false;

    const cHash = signature.slice(0, CHALLENGE_LENGTH);
    const z = new Int32Array(M);
    for (let i = 0; i < M; ++i) {
      const shifted = signature[CHALLENGE_LENGTH + i * 2] * 256 + signature[CHALLENGE_LENGTH + i * 2 + 1];
      const value = shifted - ZBOUND;
      // The norm check, and it is not optional: without it a forger is free to
      // answer with any z at all, and the problem left to solve is no longer a
      // short-vector problem.
      if (value > ZBOUND || value < -ZBOUND) return false;
      z[i] = value;
    }

    const c = expandChallenge(cHash);

    // w = A*z - T*c mod Q, which is A*y for an honest signature.
    const w = multiplyA(a, z);
    for (let ci = 0; ci < K; ++ci) {
      const sign = c[ci];
      if (sign === 0) continue;
      for (let row = 0; row < N; ++row) {
        w[row] -= sign * t[row * K + ci];
      }
    }
    for (let row = 0; row < N; ++row) w[row] = ((w[row] % Q) + Q) % Q;

    const recomputed = challengeHash(publicDigest, message, w);
    return OpCodes.SecureCompare(recomputed, cHash);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LWESignatureAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LWE-Signature";
      this.description = "Lyubashevsky's Fiat-Shamir-with-aborts signature over unstructured LWE. The public key is T = A·S for a plain matrix A over Z_q and a ternary secret S; a signature is a sparse challenge c together with z = y + S·c, and the verifier recomputes A·z − T·c, which equals the commitment A·y exactly. The abort is the point of the construction: a z outside a box smaller than the one y was drawn from is discarded and the signer retries, which makes the accepted z uniform on that box and independent of the secret. Dilithium is this scheme over a polynomial ring.";
      this.inventor = "Vadim Lyubashevsky";
      this.year = 2009;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Lattice-Based Digital Signature";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // The key is a master seed rather than a size selector: the matrix, the
      // secret and the masking vectors are all derived from it, so one seed
      // names one key pair.
      this.SupportedKeySizes = [
        new KeySize(SEED_LENGTH, SEED_LENGTH, 0)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Lyubashevsky - Fiat-Shamir With Aborts (Asiacrypt 2009)", "https://www.iacr.org/archive/asiacrypt2009/59120596/59120596.pdf"),
        new LinkItem("Lyubashevsky - Lattice Signatures Without Trapdoors (Eurocrypt 2012)", "https://eprint.iacr.org/2011/537"),
        new LinkItem("Regev - On Lattices, Learning with Errors, Random Linear Codes, and Cryptography", "https://cims.nyu.edu/~regev/papers/qcrypto.pdf"),
        new LinkItem("Peikert - A Decade of Lattice Cryptography", "https://eprint.iacr.org/2015/939")
      ];

      this.references = [
        new LinkItem("FIPS 204 - ML-DSA, the standardised ring version of this construction", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf"),
        new LinkItem("FIPS 202 - SHA-3 and the SHAKE extendable-output functions", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Parameters are not a published set",
          '',
          "No standard fixes a parameter set for this construction, and the one here was chosen for correctness rather than from a lattice-attack analysis. Use ML-DSA (FIPS 204), which is this scheme over a ring with parameters that have been analysed",
          "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf"),
        new Vulnerability("Omitting the abort leaks the secret",
          '',
          "Returning a z that falls outside the acceptance box, rather than retrying, makes the signature distribution depend on S and leaks it over many signatures. The bound is enforced on both sides here and must not be relaxed",
          "https://eprint.iacr.org/2011/537"),
        new Vulnerability("Published demonstration seed",
          '',
          "The seed in the test vectors is printed in the source and confers no confidentiality. Supply a secret seed of SEED_LENGTH random octets for any use beyond demonstration",
          "https://eprint.iacr.org/2011/537")
      ];

      // Test vectors.
      //
      // ! There is nothing published to check these against. This construction
      // ! is a scheme from the literature, not a standard: no specification
      // ! fixes a parameter set, no reference implementation exists to agree
      // ! with, and no (key, message, signature) triple has ever been
      // ! published for it. So no expected signature appears below, because the
      // ! only place one could have come from is this file, and a vector that
      // ! asserts an implementation's own output measures nothing.
      //
      // What these vectors do assert is the property that does hold and that no
      // stub can satisfy: signing yields signature || message, the convention
      // the NIST signature API uses, and the inverse direction recomputes
      // A·z − T·c, rebuilds the challenge from it, and returns the message only
      // when the challenge it rebuilt is the one the signature carries. The
      // expected value is therefore the message, and what is graded is that the
      // verifier accepts exactly what the signer produced.
      //
      // Independently of these vectors, and reported rather than assumed:
      // T = A·S holds over the expanded key; A·z − T·c reproduces A·y exactly
      // for every signature measured; every accepted z fills [-ZBOUND, ZBOUND]
      // and none exceeds it; and verification rejects a modified message, a
      // modified challenge, a modified z, an out-of-box z and a foreign key.
      //
      // ! The key field of these vectors is not gated, and cannot be. Corrupting
      // ! the input or the expected value of any of the three turns the suite
      // ! red; corrupting a seed does not, because what a round-trip vector
      // ! asserts - that verification accepts exactly what signing produced -
      // ! is true under every key. Only a published signature would pin a
      // ! particular key down, and none exists for this construction. That a
      // ! different seed yields a different signature, and that a signature
      // ! made under one seed is rejected under another, are real properties
      // ! and are measured; they are simply not expressible as a vector here.
      this.tests = [
        {
          text: "LWE-Signature round trip, 3-octet message",
          uri: "https://eprint.iacr.org/2011/537",
          input: OpCodes.Hex8ToBytes("616263"), // "abc"
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("616263")
        },
        {
          text: "LWE-Signature round trip, message of zero octets only",
          uri: "https://eprint.iacr.org/2011/537",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "LWE-Signature round trip under a second seed",
          uri: "https://eprint.iacr.org/2011/537",
          input: OpCodes.Hex8ToBytes("4c57452d5369676e6174757265207465737420766563746f72"),
          key: OpCodes.Hex8ToBytes("f0e0d0c0b0a090807060504030201000ffeeddccbbaa99887766554433221100"),
          expected: OpCodes.Hex8ToBytes("4c57452d5369676e6174757265207465737420766563746f72")
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to verify, false to sign
     * @returns {Object} New instance
     */
    CreateInstance(isInverse = false) {
      return new LWESignatureInstance(this, isInverse);
    }
  }

  /**
   * LWE-Signature instance implementing the Feed/Result pattern.
   *
   * The forward direction consumes a message and produces signature || message.
   * The inverse direction consumes that, checks the signature against the
   * message it carries, and returns the message alone. A signature that does
   * not verify is reported by throwing rather than by returning anything.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class LWESignatureInstance extends IAlgorithmInstance {
    /**
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Verification mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._keyPair = null;
      this._keyData = null;
      this.inputBuffer = [];
    }

    // Property setter for key (for test suite compatibility)
    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
     * Get the seed this instance was configured with.
     * @returns {uint8[]|null} The seed octets, or null
     */
    get key() {
      return this._keyData;
    }

    /**
     * The public parts of the key pair.
     * @returns {Object|null} { seedA, t, publicDigest } or null
     */
    get publicKey() {
      if (!this._keyPair) return null;
      const { seedA, t, publicDigest } = this._keyPair;
      return { seedA, t, publicDigest };
    }

    /**
     * The whole key pair, secret included.
     * @returns {Object|null} The key pair, or null
     */
    get privateKey() {
      return this._keyPair;
    }

    /**
     * Derive the key pair from a master seed.
     * @param {uint8[]} keyData - SEED_LENGTH octets
     */
    KeySetup(keyData) {
      if (!keyData || typeof keyData.length !== 'number' || keyData.length !== SEED_LENGTH) {
        throw new Error('LWE-Signature: the key is a master seed of exactly '
          + SEED_LENGTH + ' octets');
      }

      const seed = new Array(SEED_LENGTH);
      for (let i = 0; i < SEED_LENGTH; ++i) seed[i] = keyData[i];

      this._keyData = seed;
      this._keyPair = deriveKeyPair(seed);
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
      if (!this._keyPair) {
        throw new Error('LWE-Signature private key not set. Assign a seed first.');
      }

      const signature = signMessage(this._keyPair, message);

      // A signer that hands out a value it has not checked is how a scheme ends
      // up with signatures nothing verifies, so it is asserted here against the
      // verifier rather than assumed.
      if (!verifyMessage(this._keyPair, message, signature)) {
        throw new Error('LWE-Signature: internal error, the computed signature does not verify');
      }

      const out = new Array(signature.length + message.length);
      for (let i = 0; i < signature.length; ++i) out[i] = signature[i];
      for (let i = 0; i < message.length; ++i) out[signature.length + i] = message[i];
      return out;
    }

    /**
     * Check a signed message and return the message it carries.
     * @param {uint8[]} signed - signature || message
     * @returns {uint8[]} The message octets
     * @throws {Error} When the signature does not verify
     */
    _open(signed) {
      if (!this._keyPair) {
        throw new Error('LWE-Signature public key not set. Assign a seed first.');
      }

      if (signed.length < SIGNATURE_LENGTH) {
        throw new Error('LWE-Signature: signed message is ' + signed.length
          + ' octets, shorter than the ' + SIGNATURE_LENGTH + '-octet signature it must carry');
      }

      const signature = signed.slice(0, SIGNATURE_LENGTH);
      const message = signed.slice(SIGNATURE_LENGTH);

      if (!verifyMessage(this._keyPair, message, signature)) {
        throw new Error('LWE-Signature: signature does not verify');
      }

      return message;
    }

    /**
     * Sign a message, returning the signature alone.
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} SIGNATURE_LENGTH octets
     */
    Sign(message) {
      if (!this._keyPair) {
        throw new Error('LWE-Signature private key not set. Assign a seed first.');
      }
      return signMessage(this._keyPair, message);
    }

    /**
     * Verify a detached signature over a message.
     * @param {uint8[]} message - Message octets
     * @param {uint8[]} signature - SIGNATURE_LENGTH octets
     * @returns {boolean} Whether the signature verifies
     */
    Verify(message, signature) {
      if (!this._keyPair) {
        throw new Error('LWE-Signature public key not set. Assign a seed first.');
      }
      return verifyMessage(this._keyPair, message, signature);
    }

    /**
     * Clear sensitive data.
     */
    ClearData() {
      // The key pair is shared through the seed-keyed cache, so the instance
      // drops its reference rather than scribbling on material another instance
      // configured with the same seed is still using.
      this._keyPair = null;
      if (this._keyData) OpCodes.ClearArray(this._keyData);
      this._keyData = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LWESignatureAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    LWESignatureAlgorithm,
    LWESignatureInstance,
    deriveKeyPair,
    signMessage,
    verifyMessage,
    expandChallenge,
    multiplyA,
    PARAMS: { Q, N, M, K, KAPPA, ETA, GAMMA, SBOUND, ZBOUND, SEED_LENGTH, SIGNATURE_LENGTH }
  };
}));
