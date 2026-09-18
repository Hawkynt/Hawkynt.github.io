/*
 * FALCON Implementation
 * Fast Fourier lattice-based compact signatures over NTRU, the NIST PQC round 3
 * signature finalist
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WHAT THIS FILE DOES AND DOES NOT DO
 *
 * This file verifies FALCON signatures. It does not produce them.
 *
 * Verification is implemented in full for both parameter sets and is checked
 * against the round 3 submission's own Known Answer Tests: every one of the 100
 * records of falcon512-KAT.rsp and every one of the 100 records of
 * falcon1024-KAT.rsp verifies and yields back the message the record publishes,
 * 200 signed messages in total, and each of them is a signature this file did
 * not produce. Nothing committed below was produced by this file.
 *
 * Signing is deliberately absent rather than approximated. A FALCON signature
 * is a short vector drawn by Gaussian sampling over the LDL tree of an NTRU
 * lattice in the fast Fourier domain, and the submission's own documentation
 * warns that the sampler is sensitive to the exact floating point behaviour of
 * the reference implementation: a tree traversal or a rounding that is slightly
 * wrong still emits a well formed signature, of the wrong distribution, which
 * leaks the private key over many signatures. Such a signature would verify
 * here and against every other implementation, so no test could tell it from a
 * correct one. Rather than ship something that looks right and cannot be
 * checked, CreateInstance(false) returns null, the way this collection already
 * signals a direction an algorithm does not offer.
 *
 * Verification is therefore the whole of the interface: CreateInstance(true)
 * takes a signed message in the NIST API layout and returns the message it
 * carries, or reports failure.
 *
 *   FALCON-512   n = 512   q = 12289  public key  897  signature up to  690
 *   FALCON-1024  n = 1024  q = 12289  public key 1793  signature up to 1330
 *
 * A signed message is laid out as the submission's nist.c writes it: a two byte
 * big-endian signature length, a 40 byte nonce, the message, then the encoded
 * signature. Verification hashes the nonce and the message to a point of the
 * ring, recovers s1 from s2 and the public key, and accepts when the norm of
 * (s1, s2) is within the bound the parameter set fixes.
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

  // ===== SHAKE-256 =====
  //
  // Hashing a message to a point of the ring rejects roughly one two-byte draw
  // in twenty and keeps going until the ring is full, so the amount of output
  // needed is not known in advance. The collection's registered extendable
  // output function has to be told its output length up front and caps it at a
  // kilobyte, so the sponge is kept here and squeezed on demand instead. It is
  // checked by the published Known Answer Tests, which do not agree unless the
  // hashed point is right.

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

  function AbsorbInto(state, block) {
    for (let i = 0; i < SHAKE256_RATE; ++i) {
      const word = OpCodes.Shr32(i, 3);
      const byteInWord = OpCodes.And32(i, 7);
      const index = 2 * word + OpCodes.Shr32(byteInWord, 2);
      state[index] = OpCodes.Xor32(state[index], OpCodes.Shl32(block[i], 8 * OpCodes.And32(byteInWord, 3)));
    }
    KeccakPermute(state);
  }

  /**
   * A SHAKE-256 reader over the concatenation of its inputs, squeezed on demand.
   * @param {uint8[][]} parts - the byte strings to absorb in order
   * @returns {object} a reader with read(count)
   */
  function Shake256Reader(parts) {
    const state = new Int32Array(50);
    const block = new Uint8Array(SHAKE256_RATE);

    let filled = 0;
    for (let p = 0; p < parts.length; ++p) {
      const part = parts[p];
      for (let i = 0; i < part.length; ++i) {
        block[filled] = OpCodes.And32(part[i], 0xFF);
        ++filled;
        if (filled === SHAKE256_RATE) {
          AbsorbInto(state, block);
          block.fill(0);
          filled = 0;
        }
      }
    }

    block.fill(0, filled);
    block[filled] = OpCodes.Xor32(block[filled], 0x1F);
    block[SHAKE256_RATE - 1] = OpCodes.Xor32(block[SHAKE256_RATE - 1], 0x80);
    AbsorbInto(state, block);

    const buffered = new Uint8Array(SHAKE256_RATE);
    let available = 0;

    const refill = () => {
      for (let i = 0; i < SHAKE256_RATE; ++i) {
        const word = OpCodes.Shr32(i, 3);
        const byteInWord = OpCodes.And32(i, 7);
        const index = 2 * word + OpCodes.Shr32(byteInWord, 2);
        buffered[i] = OpCodes.And32(OpCodes.Shr32(state[index], 8 * OpCodes.And32(byteInWord, 3)), 0xFF);
      }
      available = SHAKE256_RATE;
    };

    // the first block is already in the state after the padding permutation
    refill();

    return {
      read: function (count) {
        const out = new Uint8Array(count);
        let produced = 0;
        while (produced < count) {
          if (available === 0) {
            KeccakPermute(state);
            refill();
          }
          out[produced] = buffered[SHAKE256_RATE - available];
          --available;
          ++produced;
        }
        return out;
      }
    };
  }

  // ===== PARAMETER SETS =====
  //
  // q is the modulus of the ring Z[x]/(x^n + 1). The bound is the squared
  // Euclidean norm a signature may reach, which is what decides acceptance.

  const Q = 12289;
  const NONCE_LENGTH = 40;

  const PARAMETER_SETS = (() => {
    const build = (name, logn, publicKeySize, maxSignatureSize, normBound) => ({
      name: name,
      logn: logn,
      n: OpCodes.Shl32(1, logn),
      q: Q,
      publicKeySize: publicKeySize,
      maxSignatureSize: maxSignatureSize,
      normBound: normBound
    });

    const sets = {};
    for (const set of [
      build('FALCON-512', 9, 897, 690, 34034726),
      build('FALCON-1024', 10, 1793, 1330, 70265242)
    ]) sets[set.name] = set;
    return sets;
  })();

  function FindParameterSet(label) {
    if (label === null || label === undefined) return null;
    const text = String(label).toUpperCase();
    if (PARAMETER_SETS[text]) return PARAMETER_SETS[text];
    if (text.indexOf('1024') >= 0) return PARAMETER_SETS['FALCON-1024'];
    if (text.indexOf('512') >= 0) return PARAMETER_SETS['FALCON-512'];
    return null;
  }

  function ParameterSetByPublicKeyLength(length) {
    for (const name of Object.keys(PARAMETER_SETS))
      if (PARAMETER_SETS[name].publicKeySize === length) return PARAMETER_SETS[name];
    return null;
  }

  function ParameterSetByLogn(logn) {
    for (const name of Object.keys(PARAMETER_SETS))
      if (PARAMETER_SETS[name].logn === logn) return PARAMETER_SETS[name];
    return null;
  }

  // ===== decoding =====

  /**
   * Unpack a public key: n coefficients of 14 bits each, most significant bit
   * first, every one of them below q, and no stray bits left over.
   * @param {uint8[]} bytes - the encoded key
   * @param {number} offset - where the coefficients start
   * @param {object} set - the parameter set
   * @returns {Uint16Array|null} the coefficients, or null if malformed
   */
  function DecodePublicKey(bytes, offset, set) {
    const n = set.n;
    const length = OpCodes.Shr32(n * 14 + 7, 3);
    if (offset + length > bytes.length) return null;

    const out = new Uint16Array(n);
    let accumulator = 0, accumulated = 0, produced = 0, cursor = offset;

    while (produced < n) {
      accumulator = OpCodes.Or32(OpCodes.Shl32(accumulator, 8), bytes[cursor]);
      ++cursor;
      accumulated += 8;
      if (accumulated >= 14) {
        accumulated -= 14;
        const w = OpCodes.And32(OpCodes.Shr32(accumulator, accumulated), 0x3FFF);
        if (w >= Q) return null;
        out[produced] = w;
        ++produced;
      }
    }

    if (OpCodes.And32(accumulator, OpCodes.Shl32(1, accumulated) - 1) !== 0) return null;
    return { coefficients: out, length: length };
  }

  /**
   * Unpack a signature. Each coefficient is a sign bit and seven low bits,
   * followed by the high bits in unary. A negative zero and an over-long
   * coefficient are both rejected, as is any stray bit in the last byte.
   * @param {uint8[]} bytes - the signed message
   * @param {number} offset - where the encoded signature starts
   * @param {number} maxLength - how many bytes it may occupy
   * @param {object} set - the parameter set
   * @returns {object|null} { coefficients, length }, or null if malformed
   */
  function DecodeSignature(bytes, offset, maxLength, set) {
    const n = set.n;
    const out = new Int16Array(n);
    let accumulator = 0, accumulated = 0, consumed = 0;

    for (let u = 0; u < n; ++u) {
      if (consumed >= maxLength) return null;
      accumulator = OpCodes.Or32(OpCodes.Shl32(accumulator, 8), bytes[offset + consumed]);
      ++consumed;
      const head = OpCodes.Shr32(accumulator, accumulated);
      const negative = OpCodes.And32(head, 128);
      let magnitude = OpCodes.And32(head, 127);

      for (;;) {
        if (accumulated === 0) {
          if (consumed >= maxLength) return null;
          accumulator = OpCodes.Or32(OpCodes.Shl32(accumulator, 8), bytes[offset + consumed]);
          ++consumed;
          accumulated = 8;
        }
        --accumulated;
        if (OpCodes.And32(OpCodes.Shr32(accumulator, accumulated), 1) !== 0) break;
        magnitude += 128;
        if (magnitude > 2047) return null;
      }

      if (negative && magnitude === 0) return null;
      out[u] = negative ? -magnitude : magnitude;
    }

    if (OpCodes.And32(accumulator, OpCodes.Shl32(1, accumulated) - 1) !== 0) return null;
    return { coefficients: out, length: consumed };
  }

  // ===== hashing a message to a point of the ring =====

  /**
   * Draw n coefficients below q from SHAKE-256 over the nonce and the message,
   * rejecting the draws that would bias the result.
   * @param {uint8[]} nonce - the 40 octet nonce
   * @param {uint8[]} message - the message
   * @param {object} set - the parameter set
   * @returns {Uint16Array} the hashed point
   */
  function HashToPoint(nonce, message, set) {
    const reader = Shake256Reader([nonce, message]);
    const out = new Uint16Array(set.n);
    let produced = 0;

    while (produced < set.n) {
      const pair = reader.read(2);
      let w = pair[0] * 256 + pair[1];
      // 61445 is the largest multiple of q below 2^16, so anything at or above
      // it would make the low residues more likely than the high ones
      if (w < 61445) {
        while (w >= Q) w -= Q;
        out[produced] = w;
        ++produced;
      }
    }

    return out;
  }

  // ===== the ring =====

  /**
   * Multiply modulo x^n + 1 over Z_q. The wrap is negacyclic, so a term that
   * passes degree n comes back with its sign flipped.
   * @param {Uint16Array} a - first operand
   * @param {Uint16Array} b - second operand
   * @param {number} n - the ring degree
   * @returns {Uint16Array} the product
   */
  function RingMultiply(a, b, n) {
    const accumulator = new Int32Array(n);

    for (let i = 0; i < n; ++i) {
      const left = a[i];
      if (left === 0) continue;
      const wrap = n - i;
      for (let j = 0; j < wrap; ++j)
        accumulator[i + j] = (accumulator[i + j] + left * b[j]) % Q;
      for (let j = wrap; j < n; ++j)
        accumulator[i + j - n] = (accumulator[i + j - n] - left * b[j]) % Q;
    }

    const out = new Uint16Array(n);
    for (let i = 0; i < n; ++i) out[i] = ((accumulator[i] % Q) + Q) % Q;
    return out;
  }

  /**
   * Accept when the signature is short enough: recover s1 from the hashed
   * point, the public key and s2, then measure the norm of the pair.
   * @param {Uint16Array} point - the hashed message
   * @param {Int16Array} s2 - the signature coefficients
   * @param {Uint16Array} publicKey - the public key coefficients
   * @param {object} set - the parameter set
   * @returns {object} { accepted, norm }
   */
  function VerifyRaw(point, s2, publicKey, set) {
    const n = set.n;

    const reduced = new Uint16Array(n);
    for (let i = 0; i < n; ++i) reduced[i] = ((s2[i] % Q) + Q) % Q;

    const product = RingMultiply(reduced, publicKey, n);

    // the recovered s1, taken up to sign and folded into the balanced range
    const half = OpCodes.Shr32(Q, 1);
    let norm = 0;
    for (let i = 0; i < n; ++i) {
      let w = (product[i] - point[i]) % Q;
      if (w < 0) w += Q;
      if (w > half) w -= Q;
      norm += w * w + s2[i] * s2[i];
      // a forged signature can make this enormous, so stop before it stops
      // being an exact integer rather than wrapping quietly
      if (norm > set.normBound) return { accepted: false, norm: norm };
    }

    return { accepted: norm <= set.normBound, norm: norm };
  }

  // ===== the signed message =====

  /**
   * Check a signed message laid out as the submission's NIST wrapper writes it
   * and return the message it carries.
   * @param {uint8[]} signedMessage - the bundle
   * @param {uint8[]} publicKey - the encoded public key
   * @returns {object} { accepted, message, reason }
   */
  function SignOpen(signedMessage, publicKey) {
    if (!publicKey || publicKey.length < 1)
      return { accepted: false, reason: 'no public key' };

    const logn = OpCodes.And32(publicKey[0], 0x0F);
    const set = ParameterSetByLogn(logn);
    if (OpCodes.And32(publicKey[0], 0xF0) !== 0 || !set)
      return { accepted: false, reason: 'the public key header names no FALCON parameter set' };
    if (publicKey.length !== set.publicKeySize)
      return { accepted: false, reason: 'a ' + set.name + ' public key is ' + set.publicKeySize + ' bytes, got ' + publicKey.length };

    const decodedKey = DecodePublicKey(publicKey, 1, set);
    if (!decodedKey || decodedKey.length !== publicKey.length - 1)
      return { accepted: false, reason: 'the public key body is malformed' };

    if (signedMessage.length < 2 + NONCE_LENGTH)
      return { accepted: false, reason: 'the signed message is too short to hold a nonce' };

    const signatureLength = signedMessage[0] * 256 + signedMessage[1];
    if (signatureLength > signedMessage.length - 2 - NONCE_LENGTH || signatureLength < 1)
      return { accepted: false, reason: 'the declared signature length does not fit' };

    const messageLength = signedMessage.length - 2 - NONCE_LENGTH - signatureLength;
    const signatureOffset = 2 + NONCE_LENGTH + messageLength;
    if (signedMessage[signatureOffset] !== 0x20 + logn)
      return { accepted: false, reason: 'the signature header does not match the public key' };

    const decodedSignature = DecodeSignature(signedMessage, signatureOffset + 1, signatureLength - 1, set);
    if (!decodedSignature || decodedSignature.length !== signatureLength - 1)
      return { accepted: false, reason: 'the signature body is malformed' };

    const nonce = [];
    for (let i = 0; i < NONCE_LENGTH; ++i) nonce.push(signedMessage[2 + i]);
    const message = [];
    for (let i = 0; i < messageLength; ++i) message.push(signedMessage[2 + NONCE_LENGTH + i]);

    const point = HashToPoint(nonce, message, set);
    const verdict = VerifyRaw(point, decodedSignature.coefficients, decodedKey.coefficients, set);
    if (!verdict.accepted)
      return { accepted: false, reason: 'the signature is not short enough', norm: verdict.norm };

    return { accepted: true, message: message, norm: verdict.norm, parameterSet: set };
  }

  const FALCON512_PK = OpCodes.Hex8ToBytes(
      "096BA86CB658A8F445C9A5E4C28374BEC879C8655F68526923240918074D0147C03162E4A49200648C652803C6FD7509AE9AA799D6310D0BD42724E063592018" +
      "6207000767CA5A8546B1755308C304B84FC93B069E265985B398D6B834698287FF829AA820F17A7F4226AB21F601EBD7175226BAB256D8888F009032566D6383" +
      "D68457EA155A94301870D589C678ED304259E9D37B193BC2A7CCBCBEC51D69158C44073AEC9792630253318BC954DBF50D15028290DC2D309C7B7B02A6823744" +
      "D463DA17749595CB77E6D16D20D1B4C3AAD89D320EBE5A672BB96D6CD5C1EFEC8B811200CBB062E473352540EDDEF8AF9499F8CDD1DC7C6873F0C7A6BCB70975" +
      "60271F946849B7F373640BB69CA9B518AA380A6EB0A7275EE84E9C221AED88F5BFBAF43A3EDE8E6AA42558104FAF800E018441930376C6F6E751569971F47ADB" +
      "CA5CA00C801988F317A18722A29298925EA154DBC9024E120524A2D41DC0F18FD8D909F6C50977404E201767078BA9A1F9E40A8B2BA9C01B7DA3A0B73A4C2A6B" +
      "4F518BBEE3455D0AF2204DDC031C805C72CCB647940B1E6794D859AAEBCEA0DEB581D61B9248BD9697B5CB974A8176E8F910469CAE0AB4ED92D2AEE9F7EB5029" +
      "6DAF8057476305C1189D1D9840A0944F0447FB81E511420E67891B98FA6C257034D5A063437D379177CE8D3FA6EAF12E2DBB7EB8E498481612B1929617DA5FB4" +
      "5E4CDF893927D8BA842AA861D9C50471C6D0C6DF7E2BB26465A0EB6A3A709DE792AAFAAF922AA95DD5920B72B4B8856C6E632860B10F5CC08450003671AF3889" +
      "61872B466400ADB815BA81EA794945D19A100622A6CA0D41C4EA620C21DC125119E372418F04402D9FA7180F7BC89AFA54F8082244A42F46E5B5ABCE87B50A7D" +
      "6FEBE8D7BBBAC92657CBDA1DB7C25572A4C1D0BAEA30447A865A2B1036B880037E2F4D26D453E9E913259779E9169B28A62EB809A5C744E04E260E1F2BBDA874" +
      "F1AC674839DDB47B3148C5946DE0180148B7973D63C58193B17CD05D16E80CD7928C2A338363A23A81C0608C87505589B9DA1C617E7B70786B6754FBB30A5816" +
      "810B9E126CFCC5AA49326E9D842973874B6359B5DB75610BA68A98C7B5E83F125A82522E13B83FB8F864E2A97B73B5D544A7415B6504A13939EAB1595D64FAF4" +
      "1FAB25A864A574DE524405E878339877886D2FC07FA0311508252413EDFA1158466667AFF78386DAF7CB4C9B850992F96E20525330599AB601D454688E294C8C" +
      "3E");

  const FALCON512_MSG = OpCodes.Hex8ToBytes("D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8");

  const FALCON512_SM = OpCodes.Hex8ToBytes(
      "026833B3C07507E4201748494D832B6EE2A6C93BFF9B0EE343B550D1F85A3D0DE0D704C6D17842951309D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835" +
      "AD55B22E75BF57BB556AC8290765843D1E460D17A527D2BCA405BD55BBC7DA09A8C620BE0AF4A767D9DB96B80F55E466676751EAABA7B93B86D71132DAA0EB37" +
      "6782B9EEE37519CE10FDD33FE9F29312C31D8736206D165CF4C528AA3DDC017845E1F0DD5B0A44FF961C42D874A95533E5B438982F524CA954D87533BFBE42C6" +
      "3FF2ABC77A34C79DB55A99171BBCB72C842A6530AF2F753F0C34AC632F9F1E7949F0BF6C67665B27722A8857D626B6FF1A136D923A39F4069B7477FF946E5247" +
      "A6627791D49B59EDC9E2525A860E6E9828D18F64A9F17222E8166A02453859BBDA0B8186D8C9928BB571E4146401D7430E225904673AD21CCAC54C146C248A1D" +
      "D69AB6491E901D6D71B152155BE97DE057F3916A3F1B4273308C29B2F4D9697167B90681B1583ED930A71E990467DEA368134BECEEBD597F9BEC922E816F1B05" +
      "70D728F4AE0464C1F797657F87A4E52DCDCAEB9272662EA66D7C6CD8781B31AF555AD93F5F65E75816CB8DC306BB67E592B5261BACA7C509629EA2AF8ABB80CB" +
      "A89EE535B76DFD9CCBBE3BF48F2BC8AA34B26E1103291053F5CB8DE3A45AFA5A76DF8B2122ED2C82FBCF2259290D41A14F86B12F35F5D49762B34CFF13EE7E42" +
      "EDEC70201D7F37C33316288FA3078E36E58108865C3CFE263D563692043DECC62F3426F86061285B7B1B336F56FF41BB65E9CD6D9B92FD90F864AA1C923CB8C7" +
      "55F5CDE1770D862595427149D7721AAAB5D194AEA9ACDECA15BE43CBA6A62B5A33909E9FC4DA1C5814FBD7CD6A2FA572E318B42C6C319140B86E66392580A11A" +
      "2B431F44C1F9270E4F7B2490F3B325A9977A71A575915636635B9969DBD6D220B24C3D99CEBBBD834B88222BD08C3ABE124E80");

  // the same signed message with one bit of the message it carries moved

  const FALCON512_SM_MESSAGE_MODIFIED = OpCodes.Hex8ToBytes(
      "026833B3C07507E4201748494D832B6EE2A6C93BFF9B0EE343B550D1F85A3D0DE0D704C6D17842951309D91C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835" +
      "AD55B22E75BF57BB556AC8290765843D1E460D17A527D2BCA405BD55BBC7DA09A8C620BE0AF4A767D9DB96B80F55E466676751EAABA7B93B86D71132DAA0EB37" +
      "6782B9EEE37519CE10FDD33FE9F29312C31D8736206D165CF4C528AA3DDC017845E1F0DD5B0A44FF961C42D874A95533E5B438982F524CA954D87533BFBE42C6" +
      "3FF2ABC77A34C79DB55A99171BBCB72C842A6530AF2F753F0C34AC632F9F1E7949F0BF6C67665B27722A8857D626B6FF1A136D923A39F4069B7477FF946E5247" +
      "A6627791D49B59EDC9E2525A860E6E9828D18F64A9F17222E8166A02453859BBDA0B8186D8C9928BB571E4146401D7430E225904673AD21CCAC54C146C248A1D" +
      "D69AB6491E901D6D71B152155BE97DE057F3916A3F1B4273308C29B2F4D9697167B90681B1583ED930A71E990467DEA368134BECEEBD597F9BEC922E816F1B05" +
      "70D728F4AE0464C1F797657F87A4E52DCDCAEB9272662EA66D7C6CD8781B31AF555AD93F5F65E75816CB8DC306BB67E592B5261BACA7C509629EA2AF8ABB80CB" +
      "A89EE535B76DFD9CCBBE3BF48F2BC8AA34B26E1103291053F5CB8DE3A45AFA5A76DF8B2122ED2C82FBCF2259290D41A14F86B12F35F5D49762B34CFF13EE7E42" +
      "EDEC70201D7F37C33316288FA3078E36E58108865C3CFE263D563692043DECC62F3426F86061285B7B1B336F56FF41BB65E9CD6D9B92FD90F864AA1C923CB8C7" +
      "55F5CDE1770D862595427149D7721AAAB5D194AEA9ACDECA15BE43CBA6A62B5A33909E9FC4DA1C5814FBD7CD6A2FA572E318B42C6C319140B86E66392580A11A" +
      "2B431F44C1F9270E4F7B2490F3B325A9977A71A575915636635B9969DBD6D220B24C3D99CEBBBD834B88222BD08C3ABE124E80");

  // the same signed message with one bit of the encoded signature moved

  const FALCON512_SM_SIGNATURE_MODIFIED = OpCodes.Hex8ToBytes(
      "026833B3C07507E4201748494D832B6EE2A6C93BFF9B0EE343B550D1F85A3D0DE0D704C6D17842951309D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835" +
      "AD55B22E75BF57BB556AC8290765843D1F460D17A527D2BCA405BD55BBC7DA09A8C620BE0AF4A767D9DB96B80F55E466676751EAABA7B93B86D71132DAA0EB37" +
      "6782B9EEE37519CE10FDD33FE9F29312C31D8736206D165CF4C528AA3DDC017845E1F0DD5B0A44FF961C42D874A95533E5B438982F524CA954D87533BFBE42C6" +
      "3FF2ABC77A34C79DB55A99171BBCB72C842A6530AF2F753F0C34AC632F9F1E7949F0BF6C67665B27722A8857D626B6FF1A136D923A39F4069B7477FF946E5247" +
      "A6627791D49B59EDC9E2525A860E6E9828D18F64A9F17222E8166A02453859BBDA0B8186D8C9928BB571E4146401D7430E225904673AD21CCAC54C146C248A1D" +
      "D69AB6491E901D6D71B152155BE97DE057F3916A3F1B4273308C29B2F4D9697167B90681B1583ED930A71E990467DEA368134BECEEBD597F9BEC922E816F1B05" +
      "70D728F4AE0464C1F797657F87A4E52DCDCAEB9272662EA66D7C6CD8781B31AF555AD93F5F65E75816CB8DC306BB67E592B5261BACA7C509629EA2AF8ABB80CB" +
      "A89EE535B76DFD9CCBBE3BF48F2BC8AA34B26E1103291053F5CB8DE3A45AFA5A76DF8B2122ED2C82FBCF2259290D41A14F86B12F35F5D49762B34CFF13EE7E42" +
      "EDEC70201D7F37C33316288FA3078E36E58108865C3CFE263D563692043DECC62F3426F86061285B7B1B336F56FF41BB65E9CD6D9B92FD90F864AA1C923CB8C7" +
      "55F5CDE1770D862595427149D7721AAAB5D194AEA9ACDECA15BE43CBA6A62B5A33909E9FC4DA1C5814FBD7CD6A2FA572E318B42C6C319140B86E66392580A11A" +
      "2B431F44C1F9270E4F7B2490F3B325A9977A71A575915636635B9969DBD6D220B24C3D99CEBBBD834B88222BD08C3ABE124E80");

  // record 1, whose public key record 0's signature must not verify under

  const FALCON512_PK_RECORD1 = OpCodes.Hex8ToBytes(
      "09BACCC8D6C916C9AD12E3E49881F732B84870CE5976921D197A00D226AB8825430DA78F19B0E7A12129ECB739D4A05C5EBB0019F0C610E14556A0B4C7A48E2E" +
      "4CC851D2E8A57417E48F918B56DC605D25113451C3B10520F81C016A63C6F2D8826B90B04D8B0A792272607E39829ADF4B09C0CAFB11CF2F893C56B26420F849" +
      "01FF072F9100013536822D512792643DF4EDE4B64200AE0BF82B7D46792EEAE3571F501A9A814E69F21E84DC263457B913957886AF9DA2598003E853AC23B4D6" +
      "82971507B85BFEB146010B4B0CDD3F00AF806CBD56A32987E38532AE3C7794058215C5DB042026AC7DFA58EA5B17B8AE91E06A07DB253E21EFF361EC063412B2" +
      "27FE2CF9592C6B4888589F0A3A7FB9A300B131FC4AE755CE16A1554BE6CE0F4E8301BB814E2D1903A209F0744687024949876AC94187FCE08655C2131F2A4488" +
      "64CD6C77783EA2DE6C1042C68E389F6D068EEC2199DC9B6E92EDD4469A923A683AB1C49557C19D9CC9A3822B628862A9E5DF2B152F898172F3C5FDA506C2B21E" +
      "10ED39CC1CEBF50B889C493E1B6614A53C30EE7BE94ABE59D83C270350AD490E2F9205E5607AE9328322C60AACACEA9AF2A12114626964B68AF104AA3B34C1A9" +
      "E0AE1885314891710B3ACE65F54F40451ABE425FD7AF4218FFD067A2F61E32D851831AAB032C0FA95BCC5504FCF8C180A9EA6D14CB23E35DF931C40766468487" +
      "612A172575D0BA6F20C225AB82A562F0EEF6D20ED239DA08287DDE67701D2C29368DBE52ACBBE0F219200535ADD286E6EB88E4F1643E922B2ACCBE8A3B52737A" +
      "60A4344544966E66B7DA65657B5BDE6343B5987111C6863446C04415E0D985AB534E1D7EAC615DC08E8F3D2A73D6057418368AD1DFA7001E647876CD50D58976" +
      "5695CF9715739E5D42FA684C51C9077A95E7EB31B87BA1808882B0CD9FA0F5D4F26D596AF17F22DD09C18836106F5979203B01D10707840C80249F9B963080FD" +
      "5221C250AE405F5A5D0C312B6EA8971A998324C542323808CC9A81A42AA9DF3C9080BCB4CF5BD73DFE5C080CEAAA66E0FAE05D88F23B76732BA4094C2D30FD16" +
      "D26AC4247291FA2543B7751EFF202113588B76A1646ECC6AA17861DB54D5ADBBFD3AE11423F3A78E8342DEEE705E98BF8BDA82731A520374C69C6593C5D755C4" +
      "98F7B454C0185758C94B580D4257D66F71EAD38205E2CC717032F1865649642472C5F34E1854040C63369C8317C1FC37518B16637840A86627113E3809A700CC" +
      "1B");

  const FALCON512_MSG_RECORD1 = OpCodes.Hex8ToBytes(
      "225D5CE2CEAC61930A07503FB59F7C2F936A3E075481DA3CA299A80F8C5DF9223A073E7B90E02EBF98CA2227EBA38C1AB2568209E46DBA961869C6F83983B17D" +
      "CD49");

  const FALCON512_SM_RECORD1 = OpCodes.Hex8ToBytes(
      "026908E25538484CD7F1613248FE6C9F6B4EC14BE684C6DEFDD1E41333B6E9052AC4340E314EEA2C99F7225D5CE2CEAC61930A07503FB59F7C2F936A3E075481" +
      "DA3CA299A80F8C5DF9223A073E7B90E02EBF98CA2227EBA38C1AB2568209E46DBA961869C6F83983B17DCD4929E62B31023EB236B557957F7174885220923A77" +
      "63217D9FE59B5BA53157CED51CD4D9AB93B38C666D2047C4FA21AEE43C95EA373F6D62F0E044BDB0BE988685154EF7682617C7367B30D934B1D9C89229D28173" +
      "4A3005124B8D7C70B78E1634A3A20CCF9AB952C816DFAD3D173567C139BDC624512F23F2A0C2F78C2BE16D8F9B119D64BA6DEC5E50AD104D8BA25EDC9E53996F" +
      "75D848CAA0E4421167DD4D42D07D39C3E35D10924C1A8A9E098AA4D6112C67DBBF08C7A0888AEB657456C19E2259621EDC3AF8978DE9C429B8167E679687A86C" +
      "BB66403FBC6EE69F3F1344D07E845A865F22E5E94D9748CC12065FE1926D83CB288918C82D19FD5416DE27576DF8E45DE1BD74351D996514748AE9018D27F57E" +
      "DB1DE46975FEBA5E6D9BB1491C2A327BF158D03D2FBE0882EE0ADC9B8121876DD9EF5C37F58D325AF59B94DF324CCE5BC1216C8F4ECD0B4BB5728F83BEEAB09B" +
      "FE3966CEBDF4657EC6CFD773F0D5DBA5BF28481DCB21AA1984E9C6D2168E350B4D6491D81967BE0E354C869A8487F0F939F537A58DF88ABF2E4FADB55250897A" +
      "54A8475D160D697A77DA36BBB1438245B35DEE2AC791920C9FAD8025ADC8DFA88B168716C5A45075A3F9536BCE6238E1AD4D41995D675D3CB71AD4CE33D0326E" +
      "C2A9F5B9C1DC6750ECAA6AEAAD4C0EDCC4A5015EB3F7503BA2210B16665F889E4D1CF3A9E298D61B23846593FD4D772C646DD024823371D531094CBB17902DB1" +
      "13796852161F5D2A12608B3C1BCECE960AAD07952671E4CD6186B7ECFBC7710258B8B26CFA3F1CECC61121A49DD276E4B124E3573AC8231B60C778E03B74926E" +
      "2BFBECD42F352BC325CF2204B3C0B5730E6188CFC0");

  const FALCON1024_PK = OpCodes.Hex8ToBytes(
      "0A0441A9B73F494D16556680B12B0F446A652700E4304151BC310683C43F20AB28492FF580708068FA064275C1B0D08452FC7C324154929CA850D4E6F3425B0F" +
      "149475A14468C740BE9842D2C1BBB93E2001F4202068D060C1AA9F99A5F67E86800F2E2A48FCE95A1E9F570A12D4A11B22ACB86716FB6EBB45B6CE1020E7F44E" +
      "4230103713EC346055D407C969605D9F76CB8B2F0AF2BBE1AC1F4A278009266FDEEA0AFADA2598E36A492E0B40EAE12539A4B1E44D150D47C192D9895CA08D1E" +
      "91D24E535C6D6490038C629045917508CA815E14F401F4A9A5C15E011204D012D0BB71876ABD5A8C75A94F32FE0628289DB4664A96B45E494D2528EA90781A30" +
      "98E8DAD76FD583A890EFEFAE861E815DC26894EC5965FE8F389C14ECD77B20327C44B202CBDE2B4566B9F73A022FA0641BF81CAAB70E822065B61F5E9FC91923" +
      "8DEAF80BA4C1726DD50C642E39DADA13EC8935E9936A95766FFDF868C4D95DB2C1A67097225C464EFAA8DE05D806BC5E47F79643180142D5EF53A88E7E06C364" +
      "A598779C04830B08E6910495F9938AF193AC54970FED8DB696001256451F91396C67F1A90F8D5D51BA9CA90B217A8F27DC844096448F75B12C428BD0FF298460" +
      "0F95B9D601CECAF967C6A062A399AB1FB67DA110239E739E6195A811459F21B4570F6C077DF858550C4FED907240442ACCFE5195BEF68C2C95756E889378D05F" +
      "7EDE7223AE27618D6A91105E8C6492D9ACB30526ACA35976343FD46C1284A4675854BB44E9DCEB32499EA6A4F452DD59400BF096175B060C15E5ED501BEBB24A" +
      "9C0CA96DD5F348F66E27488DF0B8954569E46B96A409ADB2D1ACE23889E17AEA253288C545F48B82C12B2956E09C008D455C93145F638348502314EB271D924C" +
      "ED3B4F5E9FBD3D10B3CEA6778B506121140EE25414EC56A5CE057A2422EA74C0A021352822E76436636447317A121D4AFD2541008A997B15F3A298DE7587AADC" +
      "903BA644A859EC40A3D8D75254CBA581217380F95C33A4D514B946CB573A50B819F8702A35029645B008EB08DEF18552E706F4EFF147C93B683DEDBD6A7CA418" +
      "3BD2F5AB3890D5B32C4780BE2054EB151D182D54A502576F395899C6D548C916B4BD058E116243887D56C462A9A616ABE28204ED5A1A3239C9859264513B02C1" +
      "1F0C30C976C1F6825BB152E8D4A42129A73137031724322322B7928664C32CACD0DA7A29FC87C808A2A0CE9194424B077C1EEF54355F03F50A870889868275DB" +
      "D5268C53B2C9854BBB69FF12F75D113438DF3A6F129754CA7622B066ED5B4564266CE011A5804B7BE1C5E24DE1E1719848936A9978C0148F08B2E610090C9958" +
      "5D323695AADA1A335A7590F7EE501F284DF5FD1C757E4C9B92EAAF737F20026B299351350C8AA8C1060D7861315012C520118E27EA0890CA774205145EE7244C" +
      "811ED0D2A9CF9ACCC3C5A01C94B480CBD2B41FB7B501850944C2C489089EEA9EC6639C9A1139B756C40BA120FADA904C7C06772A131858AE2986C2278E512621" +
      "5E631591505EF1FF281E201BBD149D7AACA2926D8CBB2729AA9977E679F5DE62A138EDFC9AD11F09A984E6704E5CAF3F6451010ED3DAB5E0D03573187543FCC6" +
      "7AAD6D86BB56138306DE7981EE4C676B19A0ACBDA017FB14014B1E0BD4CBD989A50A9D03EF21F75DB63104EF07C04F9476167D47ECA3104517BF8DC00B018F91" +
      "78437C6810E715AE603684755054649E5F8EBA2B337C28AE377674F12B02B4285CC9D1EC1F459AE88DD4486F30A8FC7FE3D5A6AC84A6DB056D05DC035DE1CB29" +
      "890B74D05EF4432DE4516C0983FE1965A001D737C7DE2D885DD3D636E1B7898C9ECB6A9EA7A6A15B4A18D2A1A0F4C877EC01930A75223368A82A22B50A7681D8" +
      "8970DE12985F987865F5A5898CD52370123D638AEAB37829B5ABB1DA8C2989EE532AE538535973B022491033167D51C46A06B6E17C3183ECA65B7515F865D530" +
      "8FFD8D698555525CF6D79653597F4E46D126E6D67F142519F1410ADC69589B23165D0F87EAC5F7DE4F3C13D14B643B608A32D980D125567E9CAD1EB095C4C4BB" +
      "05D5A9B1EECC3E9AAD4174182841F1E8C62204116E719FF3474E4663ADA986DCA08C350162298B488BAADDB3761D25CE5114FAB64C979E5FCDAE6A024EF7A806" +
      "79A2415AAC324408232363D12285DD33A690B3205175E6C75A85B368F8B1FE5BBB02EAFA624C61938BC2F805E94D001AAA90E6A2EE8852F82B573D09524DAED6" +
      "4933A03918C87E03BBC5F9A4349308666E83318C968A8486C8A722B1398C8429A9819A7BF5095739969C03BEADF7937A5DFA16DC7C44A8E3D355900A7D4089A5" +
      "D300BB690CD8633B4DE36670D9374997A0309E117630131CB269F4B1EF9EF12980C0F3F40E6423C547B8C142A04D4D54A0054262776887358861228D1052D9F9" +
      "60A877F89E0B8768C307C687A683941FA9A473110F87966CB56A81AF94C98C614740C9453999A6D0D3B12DE361AD7375EBD3022DC2B7626A286A63B8448947CA" +
      "CC");

  const FALCON1024_MSG = OpCodes.Hex8ToBytes("D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835AD55B22E75BF57BB556AC8");

  const FALCON1024_SM = OpCodes.Hex8ToBytes(
      "04CE33B3C07507E4201748494D832B6EE2A6C93BFF9B0EE343B550D1F85A3D0DE0D704C6D17842951309D81C4D8D734FCBFBEADE3D3F8A039FAA2A2C9957E835" +
      "AD55B22E75BF57BB556AC82AB49A5B21696C895463EADC68BE13293EF2BB36368D1F916EDD6DEDDD17ED7F27061E61E54A91928D34D8FDDB65AF422CD36C2C91" +
      "2C51919D278D39C3596DC61947403210A9EB974569B35ABED194889844A36705E7E73F979F9E6FFBB2E211BF5242A9A31E26D5011BC2D6C919EE34AE048CAC9A" +
      "ED4D2661688F426D167F1B6C608876158C96A5538BCE7E7A46AAA90A28C1CDA418CE8FD25E6A2C348FDE2584199F77355C4DEFDBA4A1BDF4ECB9DAF632527E62" +
      "9718DDCB7173480A0543359CEEE8E40F9919122859B889A60A3EBE912761490B8A5EF952EA093252ACF2A90282E96186DDCD283C8B6639CA665902598126720E" +
      "38D1D9A9E22026D02E6422169740B57574691D2F349F46E5A062F2AF0D7B5F366F70B95E2B21527B25117E4486D79C20A508A029594AE10643A8D7CD6C60CBC9" +
      "98836E8D4A850F358EFDA4C4E902EF7CA7D4C4BA9E44F6D5AFD78ADA910F51849A98F6CB4F02510CBAB3D1573656FD150984DC14E9B33FBFDAFE4C39A58BC3BF" +
      "D9AF7E8FA6DDF47C5EB9EC5EFC99BAD9E5F2086B6C593B3E249D6D63A886816E33F6691E631CE253CBCAACCEADCAFE6FA73AD9E84D89C72199448EA2D092B4AE" +
      "3186CFED4AE763450851B14EB448C9103468BD50A42E56692274AADCD112495414713E77C9D3E510290DD13D8C6F39EBD6F12AC4B61CD8141D0467EE8D2ABE5B" +
      "706CAB1AC7E598BC56FCE445B6DE7A4CF329A4AD2E6AA67FD1C9F4BBCFFC6F898FE56DCCFC43E2D0279AC7CC872F1961FE86B76A4A8297B4F296DD0A4258B79B" +
      "47B35FCEDAF2E2411B6C0120A2A47916B24121E3D321C4FD212E54CAAF2DAA4E743D13BEC4769EB489AD82FCA56CDE2449C91DBBD4D8CD27689D2F775B262914" +
      "29E79E1DF4F385A94FAFD834C8B523850BF7B770542D6E21AF3BC288645C39DFDBCB85679B2E3360816D5EC246E6D00CA3965F4AFCEE8A93CDD83353127DE193" +
      "76F86490542A325954C9218CFCDC3E3F9CE3443BDFB3CAC8AA2CDBFE976638478D284C5AD67ABB3B857F994B7648CFA9ADFB6305D94A51665A989A69F2DF6A46" +
      "04FFD5A49646C22DA9E46AC880FFD1B7587CD9A896BAE2CAA66AA9FB24665631AE7B48C6B1CD02CFC4B1F274F00745219B77589B165C8518135BEDA3ED7931DE" +
      "7A358CFB3230762B827FE5258715488238338B4A3F1870CCE759549CC54A743650936FB0F458E20DFBE89A2A5D67C520699D3E4AD6E2CE1708C49109D671D999" +
      "A5337798AE5DE53033956B982430589DCEF30FAD98618F572976EA4166CC2ADC0B16F6551C6A5C37830BE98215EA8A2E97253E2956711D4DE13FAFD141843BBC" +
      "28A8D44BCBFD523D9AA6405588EC09CE435A6844DF0B8268B43907B578B61F4C4C6562A1B56E9A1B74D3D17529812B94F49D98B42DD34B9F0E9C7125137D3CBD" +
      "326CA35385313F5196EDC697B9BB204AE4298DDF9F2861B3F445FEC6A8FB6A8C2CFC711178B9864F320E4E108964ED1CB6EE94AEF722FAAE36A68BC4BDA30439" +
      "515794F881A397BD782A5432218D2531262EC6B5610DE3D56B47DE5FCA82C1251A666221CD747BF90D1E57FBAE4920DDEA69A84320BDB9CB325FE3AB12F97D90" +
      "3085070E9FC2A05489F336C433CF970D937235152ECA89548EE551AF8F421948C2561F07F3EDE6BCB9DB4AAC15148862BB6659F6D7A15438F39881248F2BC7AD" +
      "397801B89446F6CDDD62FE56696C7CBC6473E95A8D03C573E0");

  const VECTORS = [
    {
      text: "FALCON-512 falcon512-KAT.rsp record 0: the published signature verifies and yields its message",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON512_PK,
      input: FALCON512_SM,
      expected: FALCON512_MSG
    },
    {
      // Setting message turns the result into a verdict, so that the negative
      // cases below can assert a rejection without naming a recovered message
      // that a rejection never produces.
      text: "FALCON-512 falcon512-KAT.rsp record 0: the verdict on the published signature is acceptance",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON512_PK,
      message: FALCON512_MSG,
      input: FALCON512_SM,
      expected: [1]
    },
    {
      text: "FALCON-512 falcon512-KAT.rsp record 1: the published signature verifies and yields its message",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON512_PK_RECORD1,
      input: FALCON512_SM_RECORD1,
      expected: FALCON512_MSG_RECORD1
    },
    {
      text: "FALCON-1024 falcon1024-KAT.rsp record 0: the published signature verifies and yields its message",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON1024_PK,
      input: FALCON1024_SM,
      expected: FALCON1024_MSG
    },
    {
      text: "FALCON-1024 falcon1024-KAT.rsp record 0: the verdict on the published signature is acceptance",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON1024_PK,
      message: FALCON1024_MSG,
      input: FALCON1024_SM,
      expected: [1]
    },
    {
      // One bit of the signed message's payload moved. The nonce and the
      // signature are untouched, so this is the case where the signature is
      // genuine but no longer speaks for this message.
      text: "FALCON-512: a modified message must not verify under its own signature",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON512_PK,
      message: FALCON512_MSG,
      input: FALCON512_SM_MESSAGE_MODIFIED,
      expected: [0]
    },
    {
      // One bit of the encoded signature moved.
      text: "FALCON-512: a modified signature must not verify",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON512_PK,
      message: FALCON512_MSG,
      input: FALCON512_SM_SIGNATURE_MODIFIED,
      expected: [0]
    },
    {
      text: "FALCON-512: record 0's signature must not verify under record 1's public key",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON512_PK_RECORD1,
      message: FALCON512_MSG,
      input: FALCON512_SM,
      expected: [0]
    },
    {
      text: "FALCON-1024: a FALCON-512 signature must not verify under a FALCON-1024 public key",
      uri: "https://falcon-sign.info/falcon-round3.zip",
      inverse: true,
      publicKey: FALCON1024_PK,
      message: FALCON512_MSG,
      input: FALCON512_SM,
      expected: [0]
    }
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

  class FalconAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = "FALCON";
      this.description = "Lattice signature scheme over NTRU, a NIST post-quantum round 3 finalist and now a draft standard as FN-DSA. A signature is a short vector of the ring Z[x]/(x^n + 1) whose image under the public key is the hashed message, which makes it the most compact post-quantum signature of the finalists. This file verifies signatures and does not produce them: signing needs Gaussian sampling over the lattice's LDL tree in the fast Fourier domain, where an error yields a signature that still verifies everywhere while leaking the private key, so it is left out rather than approximated. Verification is implemented for both parameter sets and checked against all 200 published Known Answer Test signatures.";
      this.inventor = "Pierre-Alain Fouque, Jeffrey Hoffstein, Paul Kirchner, Vadim Lyubashevsky, Thomas Pornin, Thomas Prest, Thomas Ricosset, Gregor Seiler, William Whyte, Zhenfei Zhang";
      this.year = 2017;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Post-Quantum Digital Signature";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [
        new KeySize(897, 897, 0),
        new KeySize(1793, 1793, 0)
      ];

      this.documentation = [
        new LinkItem("FALCON specification (round 3)", "https://falcon-sign.info/falcon.pdf"),
        new LinkItem("FALCON project page", "https://falcon-sign.info/"),
        new LinkItem("NIST PQC round 3 submissions", "https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions"),
        new LinkItem("Fast Fourier orthogonalization", "https://eprint.iacr.org/2017/690")
      ];

      this.references = [
        new LinkItem("Round 3 submission package and Known Answer Tests", "https://falcon-sign.info/falcon-round3.zip"),
        new LinkItem("FN-DSA, the NIST draft standard", "https://csrc.nist.gov/pubs/fips/206/ipd"),
        new LinkItem("NTRU lattices", "https://en.wikipedia.org/wiki/NTRU")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Signing is not implemented here",
          "This file verifies signatures and cannot produce them. Anything that expects to sign with it will fail rather than emit a weak signature: CreateInstance(false) returns null.",
          "Use a reference implementation to sign. This one checks the result."),
        new Vulnerability(
          "The sampler is the whole security argument",
          "In a complete FALCON, a signature leaks nothing only because it is drawn from a discrete Gaussian of exactly the right width over the lattice. A sampler that is merely close still produces signatures that verify, and recovering the private key from a few thousand of them is known to be practical.",
          "Never accept a FALCON signing implementation that has not reproduced the published Known Answer Test signatures exactly."),
        new Vulnerability(
          "Verification here is not constant time",
          "Decoding rejects malformed input by returning early and the norm is accumulated with a short circuit, so timing reveals how a bad signature is bad. Verification handles public data only, so this matters less than it would when signing.",
          "Treat this as a reference implementation of verification rather than a hardened one.")
      ];

      this.tests = VECTORS;
    }

    /**
     * Only the verifying direction exists. Signing would need the Gaussian
     * sampler this file deliberately does not carry, so the signing direction
     * declines rather than returning something that cannot be checked.
     * @param {boolean} [isInverse=false] - true for verification
     * @returns {object|null} a verifying instance, or null for signing
     */
    CreateInstance(isInverse = false) {
      if (!isInverse) return null;
      return new FalconInstance(this);
    }
  }

  class FalconInstance extends IAlgorithmInstance {
    /**
     * @param {object} algorithm - parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);

      this.isInverse = true;
      this.inputBuffer = [];

      // Declared here so that the test engine, which only assigns properties
      // that already exist on the instance, can set any of them from a vector.
      this._parameterSet = PARAMETER_SETS['FALCON-512'];
      this._publicKey = null;
      this._message = null;
      this._keyData = null;
    }

    // ---- configuration ----

    set parameterSet(label) {
      const found = FindParameterSet(label);
      if (!found) throw new Error('Unknown FALCON parameter set: ' + label);
      this._parameterSet = found;
    }

    get parameterSet() {
      return this._parameterSet.name;
    }

    /**
     * The public key. Its length selects the parameter set, and its first byte
     * has to agree with that.
     */
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }

      const found = ParameterSetByPublicKeyLength(keyBytes.length);
      if (!found)
        throw new Error('A FALCON public key is 897 or 1793 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._publicKey = [];
      for (let i = 0; i < keyBytes.length; ++i) this._publicKey.push(keyBytes[i]);
    }

    get publicKey() {
      return this._publicKey ? this._publicKey.slice() : null;
    }

    /**
     * A message to compare the verified one against. Setting it makes Result
     * report a verdict as [1] or [0] rather than returning the message, so that
     * a vector can assert a rejection without naming a message that a rejected
     * signature never yields.
     */
    set message(messageBytes) {
      if (!messageBytes) {
        this._message = null;
        return;
      }
      this._message = [];
      for (let i = 0; i < messageBytes.length; ++i) this._message.push(messageBytes[i]);
    }

    get message() {
      return this._message ? this._message.slice() : null;
    }

    /**
     * The generic key entry point. Accepts a public key or the name of a
     * parameter set.
     */
    set key(keyData) {
      this._keyData = keyData;

      if (keyData === null || keyData === undefined) {
        this._publicKey = null;
        return;
      }

      if (typeof keyData === 'string' || typeof keyData === 'number') {
        this.parameterSet = keyData;
        return;
      }

      if (!Array.isArray(keyData) && !ArrayBuffer.isView(keyData))
        throw new Error('Invalid FALCON key data format');

      if (ParameterSetByPublicKeyLength(keyData.length)) {
        this.publicKey = keyData;
        return;
      }

      let text = '';
      for (let i = 0; i < keyData.length; ++i) text += String.fromCharCode(keyData[i]);
      this.parameterSet = text;
    }

    get key() {
      return this._keyData;
    }

    // ---- streaming ----

    /**
     * Feed the signed message. Repeated calls append, so feeding in pieces is
     * the same as feeding whole.
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
     * Verify the fed signed message and produce the message it carries, or the
     * verdict when one was named to compare against.
     * @returns {number[]} the message, or the verdict
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];

      if (!this._publicKey)
        throw new Error('FALCON verification needs a public key');

      const outcome = SignOpen(input, this._publicKey);

      if (this._message)
        return [(outcome.accepted && OpCodes.SecureCompare(outcome.message, this._message)) ? 1 : 0];

      if (!outcome.accepted)
        throw new Error('FALCON signature rejected: ' + outcome.reason);

      return outcome.message;
    }

    // ---- convenience ----

    /**
     * Verify a signed message against a public key.
     * @param {number[]} signedMessage - the bundle
     * @param {number[]} [publicKey] - the key, defaulting to the configured one
     * @returns {object} { accepted, message, reason }
     */
    Verify(signedMessage, publicKey) {
      const key = publicKey || this._publicKey;
      if (!key) throw new Error('FALCON verification needs a public key');
      const bundle = [];
      for (let i = 0; i < signedMessage.length; ++i) bundle.push(signedMessage[i]);
      return SignOpen(bundle, key);
    }

    /** Wipe the data held by this instance. */
    ClearData() {
      if (this._message) OpCodes.ClearArray(this._message);
      this._publicKey = null;
      this._message = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new FalconAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FalconAlgorithm, FalconInstance };
}));
