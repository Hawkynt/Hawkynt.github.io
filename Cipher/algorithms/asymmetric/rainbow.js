/*
 * Rainbow - a multivariate quadratic signature scheme, broken in 2022
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Rainbow is an unbalanced oil and vinegar signature in two layers. The secret
 * key is a central map F that is easy to invert layer by layer, hidden between
 * two invertible affine maps S and T; the public key is the composition
 * P = S o F o T, a system of quadratic forms over a small field. Signing
 * inverts F: the vinegar variables are guessed, which makes the first layer a
 * linear system in its oil variables, and the solution is substituted to make
 * the second layer linear in turn. Verifying only evaluates P.
 *
 * Beullens broke it in 2022. The rectangle MinRank attack recovers a
 * Rainbow-I private key from its public key in about a weekend on a laptop, so
 * the scheme is kept here for its construction and its Known Answer Tests, not
 * for use.
 *
 * This file follows the round-three submission to the NIST post-quantum
 * project: the parameter sets, the key formats and the key expansion, which
 * runs the same AES-256 CTR_DRBG the NIST harness uses, from a private state
 * seeded by a hash of the secret seed.
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


  // ===== borrowed primitives =====
  //
  // Rainbow needs a block cipher to drive the NIST generator and SHA-2 to
  // compress messages. The collection's own are used rather than another copy.
  //
  // Both loads are deferred to first use rather than done at module scope: the
  // documentation and index generators attribute a registration to whichever
  // file was being loaded when it happened, so requiring a hash here would file
  // it under this directory and drop it from the hash index.

  /** @type {Algorithm|null} */
  let aesAlgorithm = null;
  const SHA_CACHE = new Map();

  /**
   * @returns {Algorithm} Result
   */
  function FindAes() {
    if (aesAlgorithm) return aesAlgorithm;

    /** @type {Algorithm} */
    let found = AlgorithmFramework.Find('Rijndael (AES)');
    if (!found && typeof require !== 'undefined') {
      try {
        require('../block/rijndael.js');
      } catch (e) {
        // Reported as a missing dependency below.
      }
      found = AlgorithmFramework.Find('Rijndael (AES)');
    }

    if (!found)
      throw new Error('Rainbow key expansion needs AES, which is not registered');
    aesAlgorithm = found;
    return found;
  }

  /**
   * @param {int32} length - digest octets: 32, 48 or 64
   * @returns {string} the registered name of the SHA-2 digest of that length
   */
  function ShaName(length) {
    switch (length) {
      case 32: return 'SHA-256';
      case 48: return 'SHA-384';
      default: return 'SHA-512';
    }
  }

  /**
   * @param {int32} length - digest octets: 32, 48 or 64
   * @returns {string} the module that registers it
   */
  function ShaModule(length) {
    return length === 32 ? '../hash/sha256.js' : '../hash/sha512.js';
  }

  /**
   * @param {int32} length - length
   * @returns {Algorithm} Result
   */
  function FindSha(length) {
    /** @type {Algorithm} */
    const cached = SHA_CACHE.get(length);
    if (cached) return cached;

    const name = ShaName(length);
    /** @type {Algorithm} */
    let found = AlgorithmFramework.Find(name);
    if (!found && typeof require !== 'undefined') {
      try {
        require(ShaModule(length));
      } catch (e) {
        // Reported as a missing dependency below.
      }
      found = AlgorithmFramework.Find(name);
    }

    if (!found) throw new Error('Rainbow needs ' + name + ', which is not registered');
    SHA_CACHE.set(length, found);
    return found;
  }

  // Key expansion runs the block cipher tens of thousands of times under one
  // key, so the instance is kept and only re-keyed when the key changes.
  /** @type {IBlockCipherInstance|null} */
  let aesInstance = null;
  /** @type {uint8[]|null} */
  let aesInstanceKey = null;

  /**
   * @param {Uint8Array} key - 32 key octets
   * @param {Uint8Array} block - 16 plaintext octets
   * @returns {uint8[]} 16 ciphertext octets
   */
  function Aes256Ecb(key, block) {
    let sameKey = aesInstanceKey !== null;
    if (sameKey) {
      for (let i = 0; i < 32; ++i) {
        /** @type {uint8} */
        const keyOctet = key[i];
        if (aesInstanceKey[i] !== keyOctet) { sameKey = false; break; }
      }
    }

    if (!sameKey) {
      /** @type {IBlockCipherInstance} */
      const instance = FindAes().CreateInstance(false);
      /** @type {uint8[]} */
      const keyCopy = Array.from(key);
      instance.key = keyCopy;
      aesInstance = instance;
      aesInstanceKey = keyCopy;
    }

    aesInstance.Feed(Array.from(block));
    /** @type {uint8[]} */
    const output = aesInstance.Result();
    return output;
  }

  /**
   * @param {int32} length - digest octets: 32, 48 or 64
   * @param {Uint8Array} data - message octets
   * @returns {Uint8Array} the SHA-2 digest
   */
  function Sha2(length, data) {
    /** @type {IHashFunctionInstance} */
    const instance = FindSha(length).CreateInstance(false);
    instance.Feed(Array.from(data));
    /** @type {uint8[]} */
    const digest = instance.Result();
    return Uint8Array.from(digest);
  }

  // ===== the two towers =====
  //
  // Rainbow does not use a polynomial basis. GF(4) is GF(2)[x]/(x^2+x+1),
  // GF(16) is GF(4)[y]/(y^2+y+x) and GF(256) is GF(16)[X]/(X^2+X+xy). The octet
  // encoding of a field element follows from that tower and not from a
  // reduction polynomial, so the tables are built from the tower itself.

  const GF4_MUL = new Uint8Array([
    0, 0, 0, 0,
    0, 1, 2, 3,
    0, 2, 3, 1,
    0, 3, 1, 2
  ]);

  const GF16_MUL = new Uint8Array(256);
  const GF256_MUL = new Uint8Array(65536);
  const GF16_INV = new Uint8Array(16);
  const GF256_INV = new Uint8Array(256);

  // Scaling a whole octet by one field element. For GF(256) that is the plain
  // table; for GF(16) both nibbles are scaled at once, which is what the
  // reference does a machine word at a time.
  const GF16_BYTE_MUL = new Uint8Array(4096);
  const GF256_BYTE_MUL = GF256_MUL;

  /** Fill the field tables above from the tower. */
  function BuildFieldTables() {
    for (let a = 0; a < 16; ++a) {
      const a0 = a % 4, a1 = (a - a0) / 4;
      for (let b = 0; b < 16; ++b) {
        const b0 = b % 4, b1 = (b - b0) / 4;
        const p00 = GF4_MUL[a0 * 4 + b0];
        const p11 = GF4_MUL[a1 * 4 + b1];
        const mid = OpCodes.Xor32(OpCodes.Xor32(GF4_MUL[OpCodes.Or32(OpCodes.Shl32(OpCodes.Xor32(a0, a1), 2), OpCodes.Xor32(b0, b1))], p00), p11);
        // y^2 = y + x, so the constant term gains x times a1 b1.
        GF16_MUL[a * 16 + b] = OpCodes.Xor32(OpCodes.Xor32(mid, p11) * 4, OpCodes.Xor32(p00, GF4_MUL[OpCodes.Or32(OpCodes.Shl32(p11, 2), 2)]));
      }
    }

    for (let a = 0; a < 256; ++a) {
      const a0 = a % 16, a1 = (a - a0) / 16;
      for (let b = 0; b < 256; ++b) {
        const b0 = b % 16, b1 = (b - b0) / 16;
        const p00 = GF16_MUL[a0 * 16 + b0];
        const p11 = GF16_MUL[a1 * 16 + b1];
        const mid = OpCodes.Xor32(OpCodes.Xor32(GF16_MUL[OpCodes.Or32(OpCodes.Shl32(OpCodes.Xor32(a0, a1), 4), OpCodes.Xor32(b0, b1))], p00), p11);
        // X^2 = X + xy, and xy is the GF(16) element 8.
        GF256_MUL[a * 256 + b] = OpCodes.Xor32(OpCodes.Xor32(mid, p11) * 16, OpCodes.Xor32(p00, GF16_MUL[OpCodes.Or32(OpCodes.Shl32(p11, 4), 8)]));
      }
    }

    for (let a = 1; a < 16; ++a)
      for (let b = 1; b < 16; ++b)
        if (GF16_MUL[a * 16 + b] === 1) { GF16_INV[a] = b; break; }
    for (let a = 1; a < 256; ++a)
      for (let b = 1; b < 256; ++b)
        if (GF256_MUL[a * 256 + b] === 1) { GF256_INV[a] = b; break; }

    for (let b = 0; b < 16; ++b)
      for (let v = 0; v < 256; ++v) {
        const lo = v % 16, hi = (v - lo) / 16;
        GF16_BYTE_MUL[b * 256 + v] = OpCodes.Or32(GF16_MUL[b * 16 + lo], OpCodes.Shl32(GF16_MUL[b * 16 + hi], 4));
      }
  }

  BuildFieldTables();

  // ===== the NIST generator =====
  //
  // The AES-256 CTR_DRBG of the NIST reference harness. Rainbow runs it twice:
  // once as the harness randomness that draws the seeds of a Known Answer Test,
  // and once, with a private state, as the key expander that turns a 32 octet
  // seed into a secret key of a hundred kilobytes or more.

  /**
   * @param {Uint8Array} v - v
   */
  function IncrementCounter(v) {
    for (let j = 15; j >= 0; --j) {
      /** @type {uint8} */
      const octet = v[j];
      if (octet === 0xFF) {
        v[j] = 0;
      } else {
        v[j] = OpCodes.Add32(octet, 1);
        break;
      }
    }
  }

  /**
   * Copy n octets from one array into another.
   * @param {Uint8Array} dst - destination
   * @param {int32} dOff - destination offset
   * @param {Uint8Array} src - source
   * @param {int32} sOff - source offset
   * @param {int32} n - how many octets
   */
  function VecCopy(dst, dOff, src, sOff, n) {
    for (let i = 0; i < n; ++i) {
      /** @type {uint8} */
      const octet = src[sOff + i];
      dst[dOff + i] = octet;
    }
  }

  /** The generator, seeded as randombytes_init does with a zero key and counter. */
  class RainbowDrbg {
    /**
     * @param {Uint8Array} entropy - the 48 octet seed
     */
    constructor(entropy) {
      /** @type {Uint8Array} */
      this.key = new Uint8Array(32);
      /** @type {Uint8Array} */
      this.v = new Uint8Array(16);
      this.update(entropy);
    }

    /**
     * The CTR_DRBG update step, folding in optional provided data.
     * @param {Uint8Array|null} providedData - 48 octets, or null
     */
    update(providedData) {
      const temp = new Uint8Array(48);
      for (let i = 0; i < 3; ++i) {
        IncrementCounter(this.v);
        const block = Aes256Ecb(this.key, this.v);
        for (let j = 0; j < 16; ++j) temp[i * 16 + j] = block[j];
      }
      if (providedData)
        for (let i = 0; i < 48; ++i) temp[i] = OpCodes.Xor32(temp[i], providedData[i]);
      VecCopy(this.key, 0, temp, 0, 32);
      VecCopy(this.v, 0, temp, 32, 16);
    }

    /**
     * Expand straight into the destination, which avoids copying the hundreds
     * of kilobytes a Rainbow secret key needs.
     * @param {Uint8Array} dst - destination
     * @param {int32} off - destination offset
     * @param {int32} count - how many octets
     */
    readInto(dst, off, count) {
      let produced = 0;
      while (produced < count) {
        IncrementCounter(this.v);
        const block = Aes256Ecb(this.key, this.v);
        for (let j = 0; j < 16 && produced < count; ++j) dst[off + produced++] = block[j];
      }
      this.update(null);
    }

    /**
     * @param {int32} count - how many octets
     * @returns {Uint8Array} the next count octets
     */
    read(count) {
      const out = new Uint8Array(count);
      this.readInto(out, 0, count);
      return out;
    }
  }

  /**
   * The generator, seeded as randombytes_init does with a zero key and counter.
   * @param {Uint8Array} entropy - the 48 octet seed
   * @returns {RainbowDrbg} a reader with read(count) and readInto(dst, offset, count)
   */
  function Drbg(entropy) {
    return new RainbowDrbg(entropy);
  }

  // ===== hashing =====
  //
  // hash_msg is SHA-2 at the parameter set's digest length. When more octets
  // are wanted than one digest gives, the previous block is hashed again and
  // appended; the target vector of a signature is produced that way whenever
  // the number of equations exceeds the digest length.

  /**
   * @param {int32} hashLen - hashLen
   * @param {int32} outLen - outLen
   * @param {Uint8Array} first - first
   * @returns {Uint8Array} Result
   */
  function ExpandHash(hashLen, outLen, first) {
    const digest = new Uint8Array(outLen);
    if (hashLen >= outLen) {
      VecCopy(digest, 0, first, 0, outLen);
      return digest;
    }

    VecCopy(digest, 0, first, 0, hashLen);
    let remaining = outLen - hashLen;
    let pos = 0;
    while (hashLen <= remaining) {
      const next = Sha2(hashLen, digest.subarray(pos, pos + hashLen));
      VecCopy(digest, pos + hashLen, next, 0, hashLen);
      remaining -= hashLen;
      pos += hashLen;
    }
    if (remaining) {
      const next = Sha2(hashLen, digest.subarray(pos, pos + hashLen));
      VecCopy(digest, pos + hashLen, next, 0, remaining);
    }
    return digest;
  }

  /**
   * @param {int32} hashLen - hashLen
   * @param {int32} outLen - outLen
   * @param {Uint8Array} message - message
   * @returns {Uint8Array} Result
   */
  function HashMsg(hashLen, outLen, message) {
    return ExpandHash(hashLen, outLen, Sha2(hashLen, message));
  }

  /**
   * Seed a private instance of the generator. The 48 octets it wants are the
   * seed, padded out with a hash of the seed when the seed is shorter.
   * @param {int32} hashLen - the parameter set's digest length
   * @param {Uint8Array} seed - the seed octets
   * @returns {RainbowDrbg} the generator
   */
  function PrngSet(hashLen, seed) {
    const material = new Uint8Array(48);
    if (seed.length >= 48) {
      VecCopy(material, 0, seed, 0, 48);
    } else {
      VecCopy(material, 0, seed, 0, seed.length);
      const tail = HashMsg(hashLen, 48 - seed.length, seed);
      VecCopy(material, seed.length, tail, 0, tail.length);
    }
    return new RainbowDrbg(material);
  }

  // ===== vectors over the field =====

  /**
   * @param {Uint8Array} dst - dst
   * @param {int32} dOff - dOff
   * @param {Uint8Array} src - src
   * @param {int32} sOff - sOff
   * @param {int32} n - n
   */
  function VecAdd(dst, dOff, src, sOff, n) {
    for (let i = 0; i < n; ++i) dst[dOff + i] = OpCodes.Xor32(dst[dOff + i], src[sOff + i]);
  }

  /**
   * @param {Uint8Array} dst - dst
   * @param {int32} dOff - dOff
   * @param {int32} n - n
   */
  function VecZero(dst, dOff, n) {
    for (let i = 0; i < n; ++i) dst[dOff + i] = 0;
  }

  /**
   * A field is the small bundle of operations that differ between GF(16),
   * where two elements share an octet, and GF(256), where they do not.
   *
   * Scaling a run of octets is the same table walk in both: the GF(16) octet
   * table scales both nibbles at once, so only the scalar's width differs.
   */
  class RainbowField {
    /**
     * @param {int32} size - 16 or 256
     */
    constructor(size) {
      /** @type {int32} */
      this.size = size;
      /** @type {boolean} */
      this.packed = size === 16;
      /** @type {Uint8Array} */
      this.inv = this.packed ? GF16_INV : GF256_INV;
      /** @type {uint8} */
      this.mask = this.packed ? 0x0F : 0xFF;
      /** @type {Uint8Array} */
      this.byteMul = this.packed ? GF16_BYTE_MUL : GF256_BYTE_MUL;
    }

    /**
     * @param {uint8} a - element
     * @param {uint8} b - element
     * @returns {uint8} a b
     */
    mul(a, b) {
      /** @type {int32} */
      const index = this.packed ? OpCodes.Or32(OpCodes.Shl32(a, 4), b) : OpCodes.Or32(OpCodes.Shl32(a, 8), b);
      /** @type {uint8} */
      const product = this.packed ? GF16_MUL[index] : GF256_MUL[index];
      return product;
    }

    /**
     * @param {uint8} a - element
     * @returns {int32} 1 when a is non-zero, 0 otherwise
     */
    isNonZero(a) {
      return OpCodes.And8(a, this.mask) === 0 ? 0 : 1;
    }

    /**
     * @param {int32} n - elements
     * @returns {int32} the octets n elements occupy
     */
    bytesFor(n) {
      /** @type {int32} */
      const bytes = this.packed ? Math.floor(n / 2) : n;
      return bytes;
    }

    /**
     * @param {Uint8Array} a - packed vector
     * @param {int32} off - octet offset of the vector
     * @param {int32} i - element index
     * @returns {uint8} element i
     */
    getEle(a, off, i) {
      if (!this.packed) {
        /** @type {uint8} */
        const element = a[off + i];
        return element;
      }
      /** @type {int32} */
      const at = off + Math.floor(i / 2);
      /** @type {uint8} */
      const octet = a[at];
      return (i % 2) ? OpCodes.Shr8(octet, 4) : OpCodes.And8(octet, 0x0F);
    }

    /**
     * @param {Uint8Array} a - packed vector
     * @param {int32} off - octet offset of the vector
     * @param {int32} i - element index
     * @param {uint8} val - the element
     */
    setEle(a, off, i, val) {
      if (!this.packed) {
        a[off + i] = val;
        return;
      }
      /** @type {int32} */
      const at = off + Math.floor(i / 2);
      /** @type {uint8} */
      const octet = a[at];
      const v = OpCodes.And8(val, 0x0F);
      a[at] = (i % 2) ? OpCodes.Or8(OpCodes.And8(octet, 0x0F), OpCodes.Shl8(v, 4)) : OpCodes.Or8(v, OpCodes.And8(octet, 0xF0));
    }

    /**
     * dst += b src, over n octets.
     * @param {Uint8Array} dst - destination
     * @param {int32} dOff - destination offset
     * @param {Uint8Array} src - source
     * @param {int32} sOff - source offset
     * @param {uint8} b - scalar
     * @param {int32} n - octets
     */
    madd(dst, dOff, src, sOff, b, n) {
      const scalar = OpCodes.And8(b, this.mask);
      if (scalar === 0) return;
      /** @type {int32} */
      const base = OpCodes.Shl32(scalar, 8);
      const table = this.byteMul;
      for (let i = 0; i < n; ++i) {
        /** @type {uint8} */
        const octet = src[sOff + i];
        /** @type {int32} */
        const index = base + octet;
        dst[dOff + i] = OpCodes.Xor8(dst[dOff + i], table[index]);
      }
    }

    /**
     * a *= b, over n octets.
     * @param {Uint8Array} a - the vector
     * @param {int32} off - its offset
     * @param {uint8} b - scalar
     * @param {int32} n - octets
     */
    mulScalar(a, off, b, n) {
      /** @type {int32} */
      const base = OpCodes.Shl32(OpCodes.And8(b, this.mask), 8);
      const table = this.byteMul;
      for (let i = 0; i < n; ++i) {
        /** @type {uint8} */
        const octet = a[off + i];
        /** @type {int32} */
        const index = base + octet;
        /** @type {uint8} */
        const product = table[index];
        a[off + i] = product;
      }
    }
  }

  /**
   * @param {int32} gfSize - 16 or 256
   * @returns {RainbowField} the field operations
   */
  function MakeField(gfSize) {
    return new RainbowField(gfSize);
  }

  // ===== batched matrix arithmetic =====
  //
  // Every entry of these matrices is a run of size_batch octets, one field
  // element for each polynomial of the layer, so a whole layer is multiplied at
  // once. A "tri" matrix is stored as its upper triangle, row by row.

  /**
   * @param {int32} row - row
   * @param {int32} col - col
   * @param {int32} dim - dim
   * @returns {int32} Result
   */
  function IdxOfTrimat(row, col, dim) {
    return (dim + dim - row + 1) * row / 2 + col - row;
  }

  /**
   * @param {int32} row - row
   * @param {int32} col - col
   * @param {int32} dim - dim
   * @returns {int32} Result
   */
  function IdxOf2Trimat(row, col, dim) {
    return (row > col) ? IdxOfTrimat(col, row, dim) : IdxOfTrimat(row, col, dim);
  }

  /**
   * @param {Uint8Array} triC - triC
   * @param {int32} cOff - cOff
   * @param {Uint8Array} a - a
   * @param {int32} aOff - aOff
   * @param {int32} width - width
   * @param {int32} sizeBatch - sizeBatch
   */
  function UpperTrianglize(triC, cOff, a, aOff, width, sizeBatch) {
    let running = cOff;
    for (let i = 0; i < width; ++i) {
      for (let j = 0; j < i; ++j)
        VecAdd(triC, cOff + IdxOfTrimat(j, i, width) * sizeBatch,
               a, aOff + sizeBatch * (i * width + j), sizeBatch);
      VecAdd(triC, running, a, aOff + sizeBatch * (i * width + i), sizeBatch * (width - i));
      running += sizeBatch * (width - i);
    }
  }

  // bC += btriA * B
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} triA - triA
   * @param {int32} aOff - aOff
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   * @param {int32} bHeight - bHeight
   * @param {int32} bColVec - bColVec
   * @param {int32} bWidth - bWidth
   * @param {int32} sizeBatch - sizeBatch
   */
  function BatchTrimatMadd(F, c, cOff, triA, aOff, b, bOff, bHeight, bColVec, bWidth, sizeBatch) {
    let co = cOff, ao = aOff;
    for (let i = 0; i < bHeight; ++i) {
      for (let j = 0; j < bWidth; ++j) {
        for (let k = i; k < bHeight; ++k) {
          /** @type {uint8} */
          const scalar = F.getEle(b, bOff + j * bColVec, k);
          F.madd(c, co, triA, ao + (k - i) * sizeBatch, scalar, sizeBatch);
        }
        co += sizeBatch;
      }
      ao += (bHeight - i) * sizeBatch;
    }
  }

  // bC += btriA^T * B
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} triA - triA
   * @param {int32} aOff - aOff
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   * @param {int32} bHeight - bHeight
   * @param {int32} bColVec - bColVec
   * @param {int32} bWidth - bWidth
   * @param {int32} sizeBatch - sizeBatch
   */
  function BatchTrimatTrMadd(F, c, cOff, triA, aOff, b, bOff, bHeight, bColVec, bWidth, sizeBatch) {
    let co = cOff;
    for (let i = 0; i < bHeight; ++i) {
      for (let j = 0; j < bWidth; ++j) {
        for (let k = 0; k <= i; ++k) {
          /** @type {uint8} */
          const scalar = F.getEle(b, bOff + j * bColVec, k);
          F.madd(c, co, triA, aOff + sizeBatch * IdxOfTrimat(k, i, bHeight), scalar, sizeBatch);
        }
        co += sizeBatch;
      }
    }
  }

  // bC += (btriA + btriA^T) * B
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} triA - triA
   * @param {int32} aOff - aOff
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   * @param {int32} bHeight - bHeight
   * @param {int32} bColVec - bColVec
   * @param {int32} bWidth - bWidth
   * @param {int32} sizeBatch - sizeBatch
   */
  function Batch2TrimatMadd(F, c, cOff, triA, aOff, b, bOff, bHeight, bColVec, bWidth, sizeBatch) {
    let co = cOff;
    for (let i = 0; i < bHeight; ++i) {
      for (let j = 0; j < bWidth; ++j) {
        for (let k = 0; k < bHeight; ++k) {
          if (i === k) continue;
          /** @type {uint8} */
          const scalar = F.getEle(b, bOff + j * bColVec, k);
          F.madd(c, co, triA, aOff + sizeBatch * IdxOf2Trimat(i, k, bHeight), scalar, sizeBatch);
        }
        co += sizeBatch;
      }
    }
  }

  // bC += A^T * bB
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} a - a
   * @param {int32} aOff - aOff
   * @param {int32} aHeight - aHeight
   * @param {int32} aColVec - aColVec
   * @param {int32} aWidth - aWidth
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   * @param {int32} bWidth - bWidth
   * @param {int32} sizeBatch - sizeBatch
   */
  function BatchMatTrMadd(F, c, cOff, a, aOff, aHeight, aColVec, aWidth, b, bOff, bWidth, sizeBatch) {
    let co = cOff;
    for (let i = 0; i < aWidth; ++i) {
      for (let j = 0; j < aHeight; ++j) {
        /** @type {uint8} */
        const scalar = F.getEle(a, aOff + aColVec * i, j);
        F.madd(c, co, b, bOff + j * bWidth * sizeBatch, scalar, sizeBatch * bWidth);
      }
      co += sizeBatch * bWidth;
    }
  }

  // bC += bA^T * B
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} a - a
   * @param {int32} aOff - aOff
   * @param {int32} aWidth - aWidth
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   * @param {int32} bHeight - bHeight
   * @param {int32} bColVec - bColVec
   * @param {int32} bWidth - bWidth
   * @param {int32} sizeBatch - sizeBatch
   */
  function BatchBmatTrMadd(F, c, cOff, a, aOff, aWidth, b, bOff, bHeight, bColVec, bWidth, sizeBatch) {
    let co = cOff;
    for (let i = 0; i < aWidth; ++i) {
      for (let j = 0; j < bWidth; ++j) {
        for (let k = 0; k < bHeight; ++k) {
          /** @type {uint8} */
          const scalar = F.getEle(b, bOff + j * bColVec, k);
          F.madd(c, co, a, aOff + sizeBatch * (i + k * aWidth), scalar, sizeBatch);
        }
        co += sizeBatch;
      }
    }
  }

  // bC += bA * B
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} a - a
   * @param {int32} aOff - aOff
   * @param {int32} aHeight - aHeight
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   * @param {int32} bHeight - bHeight
   * @param {int32} bColVec - bColVec
   * @param {int32} bWidth - bWidth
   * @param {int32} sizeBatch - sizeBatch
   */
  function BatchMatMadd(F, c, cOff, a, aOff, aHeight, b, bOff, bHeight, bColVec, bWidth, sizeBatch) {
    let co = cOff, ao = aOff;
    for (let i = 0; i < aHeight; ++i) {
      for (let j = 0; j < bWidth; ++j) {
        for (let k = 0; k < bHeight; ++k) {
          /** @type {uint8} */
          const scalar = F.getEle(b, bOff + j * bColVec, k);
          F.madd(c, co, a, ao + k * sizeBatch, scalar, sizeBatch);
        }
        co += sizeBatch;
      }
      ao += bHeight * sizeBatch;
    }
  }

  // y = x^T * trimat * x, one field element for each polynomial of the batch.
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} y - y
   * @param {int32} yOff - yOff
   * @param {Uint8Array} triMat - triMat
   * @param {int32} mOff - mOff
   * @param {Uint8Array} x - x
   * @param {int32} xOff - xOff
   * @param {int32} dim - dim
   * @param {int32} sizeBatch - sizeBatch
   */
  function BatchQuadTrimatEval(F, y, yOff, triMat, mOff, x, xOff, dim, sizeBatch) {
    const xs = new Uint8Array(dim);
    for (let i = 0; i < dim; ++i) {
      /** @type {uint8} */
      const element = F.getEle(x, xOff, i);
      xs[i] = element;
    }

    const tmp = new Uint8Array(sizeBatch);
    let mo = mOff;
    VecZero(y, yOff, sizeBatch);
    for (let i = 0; i < dim; ++i) {
      VecZero(tmp, 0, sizeBatch);
      for (let j = i; j < dim; ++j) {
        F.madd(tmp, 0, triMat, mo, xs[j], sizeBatch);
        mo += sizeBatch;
      }
      F.madd(y, yOff, tmp, 0, xs[i], sizeBatch);
    }
  }

  // c = matA * b, with matA held column by column.
  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} c - c
   * @param {int32} cOff - cOff
   * @param {Uint8Array} matA - matA
   * @param {int32} aOff - aOff
   * @param {int32} colVecBytes - colVecBytes
   * @param {int32} width - width
   * @param {Uint8Array} b - b
   * @param {int32} bOff - bOff
   */
  function GfMatProd(F, c, cOff, matA, aOff, colVecBytes, width, b, bOff) {
    VecZero(c, cOff, colVecBytes);
    for (let i = 0; i < width; ++i) {
      /** @type {uint8} */
      const scalar = F.getEle(b, bOff, i);
      F.madd(c, cOff, matA, aOff + i * colVecBytes, scalar, colVecBytes);
    }
  }

  // ===== Gaussian elimination =====
  //
  // The reference skips the leading octets of a row once they are known to be
  // zero. Eliminating over the whole row gives the same answer, because those
  // octets are zero in every row the step touches, so the plain form is used.
  // The pivot search is the reference's: the rows below are folded in one at a
  // time and only while the pivot is still zero, which is a data independent
  // stand-in for a row exchange.

  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} mat - mat
   * @param {int32} h - h
   * @param {int32} wByte - wByte
   * @returns {int32} Result
   */
  function GaussElim(F, mat, h, wByte) {
    let ok = 1;
    for (let i = 0; i < h; ++i) {
      const ai = i * wByte;
      for (let j = i + 1; j < h; ++j) {
        /** @type {uint8} */
        const lead = F.getEle(mat, ai, i);
        /** @type {int32} */
        const leadNonZero = F.isNonZero(lead);
        if (!leadNonZero)
          VecAdd(mat, ai, mat, j * wByte, wByte);
      }

      /** @type {uint8} */
      const pivot = F.getEle(mat, ai, i);
      /** @type {int32} */
      const pivotNonZero = F.isNonZero(pivot);
      if (!pivotNonZero) {
        ok = 0;
      }
      /** @type {uint8} */
      const pivotInverse = F.inv[pivot];
      F.mulScalar(mat, ai, pivotInverse, wByte);

      for (let j = 0; j < h; ++j) {
        if (i === j) continue;
        const aj = j * wByte;
        /** @type {uint8} */
        const scalar = F.getEle(mat, aj, i);
        F.madd(mat, aj, mat, ai, scalar, wByte);
      }
    }
    return ok;
  }

  /**
   * The inverse of an n by n matrix held column by column.
   * @param {RainbowField} F - the field
   * @param {Uint8Array} invA - invA
   * @param {Uint8Array} a - a
   * @param {int32} aOff - aOff
   * @param {int32} n - n
   * @returns {int32} 1 when it exists, 0 when the matrix is singular
   */
  function MatInv(F, invA, a, aOff, n) {
    /** @type {int32} */
    const srcRowBytes = F.bytesFor(n);
    const rowBytes = srcRowBytes * 2;
    const mat = new Uint8Array(n * rowBytes);
    for (let i = 0; i < n; ++i) {
      const ai = i * rowBytes;
      VecAdd(mat, ai, a, aOff + i * srcRowBytes, srcRowBytes);
      F.setEle(mat, ai + srcRowBytes, i, 1);
    }
    const ok = GaussElim(F, mat, n, rowBytes);
    for (let i = 0; i < n; ++i)
      for (let j = 0; j < srcRowBytes; ++j)
        invA[i * srcRowBytes + j] = mat[i * rowBytes + srcRowBytes + j];
    return ok;
  }

  /**
   * Solves inpMat * sol = cTerms, with inpMat held column by column.
   * @param {RainbowField} F - the field
   * @param {Uint8Array} sol - sol
   * @param {int32} solOff - solOff
   * @param {Uint8Array} inpMat - inpMat
   * @param {int32} mOff - mOff
   * @param {Uint8Array} cTerms - cTerms
   * @param {int32} cOff - cOff
   * @param {int32} n - n
   * @returns {int32} 1 on success, 0 when the system is singular
   */
  function MatSolve(F, sol, solOff, inpMat, mOff, cTerms, cOff, n) {
    /** @type {int32} */
    const nb = F.bytesFor(n);
    const vecLen = nb + 4;
    const mat = new Uint8Array(n * vecLen);
    for (let i = 0; i < n; ++i) {
      const mi = i * vecLen;
      for (let j = 0; j < n; ++j) {
        /** @type {uint8} */
        const element = F.getEle(inpMat, mOff + j * nb, i);
        F.setEle(mat, mi, j, element);
      }
      /** @type {uint8} */
      const constant = F.getEle(cTerms, cOff, i);
      mat[mi + nb] = constant;
    }
    const ok = GaussElim(F, mat, n, vecLen);
    for (let i = 0; i < n; ++i) F.setEle(sol, solOff, i, mat[i * vecLen + nb]);
    return ok;
  }

  // ===== parameter sets =====
  //
  // v1 vinegar variables, o1 oil variables in the first layer and o2 in the
  // second. The key formats are laid out exactly as the submission's structs,
  // which are declared with one octet alignment, so the offsets below are the
  // running sums of the field sizes.

  /**
   * A parameter set with its key layouts, in the field order the plain object
   * always had: the offsets and sizes are the running sums of the submission's
   * one-octet-aligned structs.
   */
  class RainbowParams {
    /**
     * @param {string} name - set name
     * @param {int32} gfSize - 16 or 256
     * @param {int32} v1 - vinegar variables
     * @param {int32} o1 - first-layer oil variables
     * @param {int32} o2 - second-layer oil variables
     * @param {int32} hashLen - digest octets
     */
    constructor(name, gfSize, v1, o1, o2, hashLen) {
      /** @type {string} */
      this.name = name;
      /** @type {int32} */
      this.gfSize = gfSize;
      /** @type {int32} */
      this.v1 = v1;
      /** @type {int32} */
      this.o1 = o1;
      /** @type {int32} */
      this.o2 = o2;
      /** @type {int32} */
      this.hashLen = hashLen;
      /** @type {int32} */
      this.v2 = v1 + o1;
      /** @type {int32} */
      this.n = v1 + o1 + o2;
      /** @type {int32} */
      this.m = o1 + o2;

      const per = (gfSize === 16) ? 2 : 1;
      /** @type {int32} */
      this.v1b = v1 / per;
      /** @type {int32} */
      this.v2b = this.v2 / per;
      /** @type {int32} */
      this.o1b = o1 / per;
      /** @type {int32} */
      this.o2b = o2 / per;
      /** @type {int32} */
      this.nb = this.n / per;
      /** @type {int32} */
      this.mb = this.m / per;

      /** @type {int32} */
      this.saltBytes = 16;
      /** @type {int32} */
      this.seedBytes = 32;
      /** @type {int32} */
      this.sigBytes = this.nb + this.saltBytes;

      /** @type {int32} */
      this.triV1 = Triangle(v1);
      /** @type {int32} */
      this.triO1 = Triangle(o1);
      /** @type {int32} */
      this.triO2 = Triangle(o2);
      /** @type {int32} */
      this.triN = Triangle(this.n);

      // The full secret key: the seed it came from, the non-trivial blocks of S
      // and T, and the seven blocks of the central map.
      let off = 0;
      /** @type {int32} */
      this.skSeed = off;
      /** @type {int32} */
      this.skSeedSize = 32;
      off += this.skSeedSize;
      /** @type {int32} */
      this.s1 = off;
      /** @type {int32} */
      this.s1Size = this.o1b * o2;
      off += this.s1Size;
      /** @type {int32} */
      this.t1 = off;
      /** @type {int32} */
      this.t1Size = this.v1b * o1;
      off += this.t1Size;
      /** @type {int32} */
      this.t4 = off;
      /** @type {int32} */
      this.t4Size = this.v1b * o2;
      off += this.t4Size;
      /** @type {int32} */
      this.t3 = off;
      /** @type {int32} */
      this.t3Size = this.o1b * o2;
      off += this.t3Size;
      /** @type {int32} */
      this.l1F1 = off;
      /** @type {int32} */
      this.l1F1Size = this.o1b * this.triV1;
      off += this.l1F1Size;
      /** @type {int32} */
      this.l1F2 = off;
      /** @type {int32} */
      this.l1F2Size = this.o1b * v1 * o1;
      off += this.l1F2Size;
      /** @type {int32} */
      this.l2F1 = off;
      /** @type {int32} */
      this.l2F1Size = this.o2b * this.triV1;
      off += this.l2F1Size;
      /** @type {int32} */
      this.l2F2 = off;
      /** @type {int32} */
      this.l2F2Size = this.o2b * v1 * o1;
      off += this.l2F2Size;
      /** @type {int32} */
      this.l2F3 = off;
      /** @type {int32} */
      this.l2F3Size = this.o2b * v1 * o2;
      off += this.l2F3Size;
      /** @type {int32} */
      this.l2F5 = off;
      /** @type {int32} */
      this.l2F5Size = this.o2b * this.triO1;
      off += this.l2F5Size;
      /** @type {int32} */
      this.l2F6 = off;
      /** @type {int32} */
      this.l2F6Size = this.o2b * o1 * o2;
      off += this.l2F6Size;
      /** @type {int32} */
      this.skSize = off;

      // The cyclic public key: a seed for the blocks that can be regenerated,
      // and the blocks that cannot.
      off = 0;
      /** @type {int32} */
      this.pkSeed = off;
      /** @type {int32} */
      this.pkSeedSize = 32;
      off += this.pkSeedSize;
      /** @type {int32} */
      this.cQ3 = off;
      /** @type {int32} */
      this.cQ3Size = this.o1b * v1 * o2;
      off += this.cQ3Size;
      /** @type {int32} */
      this.cQ5 = off;
      /** @type {int32} */
      this.cQ5Size = this.o1b * this.triO1;
      off += this.cQ5Size;
      /** @type {int32} */
      this.cQ6 = off;
      /** @type {int32} */
      this.cQ6Size = this.o1b * o1 * o2;
      off += this.cQ6Size;
      /** @type {int32} */
      this.cQ9 = off;
      /** @type {int32} */
      this.cQ9Size = this.o1b * this.triO2;
      off += this.cQ9Size;
      /** @type {int32} */
      this.cl2Q9 = off;
      /** @type {int32} */
      this.cl2Q9Size = this.o2b * this.triO2;
      off += this.cl2Q9Size;
      /** @type {int32} */
      this.cpkSize = off;

      /** @type {int32} */
      this.cskSize = 64;
      /** @type {int32} */
      this.pkSize = this.mb * this.triN;

      // The internal full public key, before it is flattened.
      off = 0;
      /** @type {int32} */
      this.eL1Q1 = off;
      /** @type {int32} */
      this.eL1Q1Size = this.o1b * this.triV1;
      off += this.eL1Q1Size;
      /** @type {int32} */
      this.eL1Q2 = off;
      /** @type {int32} */
      this.eL1Q2Size = this.o1b * v1 * o1;
      off += this.eL1Q2Size;
      /** @type {int32} */
      this.eL1Q3 = off;
      /** @type {int32} */
      this.eL1Q3Size = this.o1b * v1 * o2;
      off += this.eL1Q3Size;
      /** @type {int32} */
      this.eL1Q5 = off;
      /** @type {int32} */
      this.eL1Q5Size = this.o1b * this.triO1;
      off += this.eL1Q5Size;
      /** @type {int32} */
      this.eL1Q6 = off;
      /** @type {int32} */
      this.eL1Q6Size = this.o1b * o1 * o2;
      off += this.eL1Q6Size;
      /** @type {int32} */
      this.eL1Q9 = off;
      /** @type {int32} */
      this.eL1Q9Size = this.o1b * this.triO2;
      off += this.eL1Q9Size;
      /** @type {int32} */
      this.eL2Q1 = off;
      /** @type {int32} */
      this.eL2Q1Size = this.o2b * this.triV1;
      off += this.eL2Q1Size;
      /** @type {int32} */
      this.eL2Q2 = off;
      /** @type {int32} */
      this.eL2Q2Size = this.o2b * v1 * o1;
      off += this.eL2Q2Size;
      /** @type {int32} */
      this.eL2Q3 = off;
      /** @type {int32} */
      this.eL2Q3Size = this.o2b * v1 * o2;
      off += this.eL2Q3Size;
      /** @type {int32} */
      this.eL2Q5 = off;
      /** @type {int32} */
      this.eL2Q5Size = this.o2b * this.triO1;
      off += this.eL2Q5Size;
      /** @type {int32} */
      this.eL2Q6 = off;
      /** @type {int32} */
      this.eL2Q6Size = this.o2b * o1 * o2;
      off += this.eL2Q6Size;
      /** @type {int32} */
      this.eL2Q9 = off;
      /** @type {int32} */
      this.eL2Q9Size = this.o2b * this.triO2;
      off += this.eL2Q9Size;
      /** @type {int32} */
      this.extSize = off;
    }
  }

  /**
   * @param {int32} k - side of a triangle
   * @returns {int32} k (k + 1) / 2
   */
  function Triangle(k) {
    return k * (k + 1) / 2;
  }

  /**
   * @param {string} name - set name
   * @param {int32} gfSize - 16 or 256
   * @param {int32} v1 - vinegar variables
   * @param {int32} o1 - first-layer oil variables
   * @param {int32} o2 - second-layer oil variables
   * @param {int32} hashLen - digest octets
   * @returns {RainbowParams} the parameter set with its layouts
   */
  function BuildParams(name, gfSize, v1, o1, o2, hashLen) {
    return new RainbowParams(name, gfSize, v1, o1, o2, hashLen);
  }

  /** The published constants of one registered set. */
  class RainbowSetSpec {
    /**
     * @param {string} name - the registered name
     * @param {int32} gfSize - 16 or 256
     * @param {int32} v1 - vinegar variables
     * @param {int32} o1 - first-layer oil variables
     * @param {int32} o2 - second-layer oil variables
     * @param {int32} hashLen - digest octets
     * @param {int32} level - NIST level
     * @param {string} label - the submission's label
     */
    constructor(name, gfSize, v1, o1, o2, hashLen, level, label) {
      /** @type {string} */
      this.name = name;
      /** @type {int32} */
      this.gfSize = gfSize;
      /** @type {int32} */
      this.v1 = v1;
      /** @type {int32} */
      this.o1 = o1;
      /** @type {int32} */
      this.o2 = o2;
      /** @type {int32} */
      this.hashLen = hashLen;
      /** @type {int32} */
      this.level = level;
      /** @type {string} */
      this.label = label;
    }
  }

  /** @type {RainbowSetSpec[]} */
  const PARAMETER_SETS = [
    new RainbowSetSpec('Rainbow-I', 16, 36, 32, 32, 32, 1, 'Ia'),
    new RainbowSetSpec('Rainbow-III', 256, 68, 32, 48, 48, 3, 'IIIc'),
    new RainbowSetSpec('Rainbow-V', 256, 96, 36, 64, 64, 5, 'Vc')
  ];

  /**
   * The registered set of this name.
   * @param {string} name - the name
   * @returns {RainbowSetSpec|null} the entry, or null
   */
  function ParameterSetEntry(name) {
    for (let i = 0; i < PARAMETER_SETS.length; ++i) {
      if (PARAMETER_SETS[i].name === name) return PARAMETER_SETS[i];
    }
    return null;
  }

  /** A key pair. */
  class RainbowKeyPair {
    /**
     * @param {Uint8Array} publicKey - the public key
     * @param {Uint8Array} secretKey - the secret key
     */
    constructor(publicKey, secretKey) {
      /** @type {Uint8Array} */
      this.publicKey = publicKey;
      /** @type {Uint8Array} */
      this.secretKey = secretKey;
    }
  }

  // ===== key generation =====

  /**
   * @param {RainbowParams} p - p
   * @param {Uint8Array} sk - sk
   * @param {RainbowDrbg} prng - the generator
   */
  function GenerateST(p, sk, prng) {
    prng.readInto(sk, p.s1, p.s1Size);
    prng.readInto(sk, p.t1, p.t1Size);
    prng.readInto(sk, p.t4, p.t4Size);
    prng.readInto(sk, p.t3, p.t3Size);
  }

  /**
   * @param {RainbowParams} p - p
   * @param {Uint8Array} buf - buf
   * @param {int32} base - base
   * @param {RainbowDrbg} prng - the generator
   */
  function GenerateB1B2(p, buf, base, prng) {
    let off = base;
    prng.readInto(buf, off, p.l1F1Size); off += p.l1F1Size;
    prng.readInto(buf, off, p.l1F2Size); off += p.l1F2Size;
    prng.readInto(buf, off, p.l2F1Size); off += p.l2F1Size;
    prng.readInto(buf, off, p.l2F2Size); off += p.l2F2Size;
    prng.readInto(buf, off, p.l2F3Size); off += p.l2F3Size;
    prng.readInto(buf, off, p.l2F5Size); off += p.l2F5Size;
    prng.readInto(buf, off, p.l2F6Size);
  }

  // t4 <- t2 + t1 t3. The map is its own inverse, which is how the reference
  // moves the field between its two meanings.
  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} sk - sk
   */
  function CalculateT4(F, p, sk) {
    const temp = new Uint8Array(p.v1b);
    for (let i = 0; i < p.o2; ++i) {
      GfMatProd(F, temp, 0, sk, p.t1, p.v1b, p.o1, sk, p.t3 + i * p.o1b);
      VecAdd(sk, p.t4 + i * p.v1b, temp, 0, p.v1b);
    }
  }

  // S mixes the second layer into the first, so every layer-one public block
  // carries an s1 multiple of the matching layer-two block.
  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} l1 - l1
   * @param {int32} l1Off - l1Off
   * @param {Uint8Array} l2 - l2
   * @param {int32} l2Off - l2Off
   * @param {int32} nTerms - nTerms
   * @param {Uint8Array} sk - sk
   */
  function ObfuscateL1(F, p, l1, l1Off, l2, l2Off, nTerms, sk) {
    const temp = new Uint8Array(p.o1b);
    let a = l1Off, b = l2Off;
    for (let i = 0; i < nTerms; ++i) {
      GfMatProd(F, temp, 0, sk, p.s1, p.o1b, p.o2, l2, b);
      VecAdd(l1, a, temp, 0, p.o1b);
      a += p.o1b;
      b += p.o2b;
    }
  }

  // The public map of the central map composed with T, before S is applied.
  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} Q - Q
   * @param {Uint8Array} sk - sk
   */
  function CalculateQFromF(F, p, Q, sk) {
    const t2 = p.t4;

    VecCopy(Q, p.eL1Q1, sk, p.l1F1, p.eL1Q1Size);
    VecCopy(Q, p.eL1Q2, sk, p.l1F2, p.eL1Q2Size);
    BatchTrimatMadd(F, Q, p.eL1Q2, sk, p.l1F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o1b);

    VecZero(Q, p.eL1Q3, p.eL1Q3Size);
    VecZero(Q, p.eL1Q5, p.eL1Q5Size);
    VecZero(Q, p.eL1Q6, p.eL1Q6Size);
    VecZero(Q, p.eL1Q9, p.eL1Q9Size);

    const tempQ = new Uint8Array(Math.max(p.o1b * p.o1 * p.o1, p.o1b * p.o2 * p.o2,
                                          p.o2b * p.o1 * p.o1, p.o2b * p.o2 * p.o2));

    VecZero(tempQ, 0, p.o1b * p.o1 * p.o1);
    BatchMatTrMadd(F, tempQ, 0, sk, p.t1, p.v1, p.v1b, p.o1, Q, p.eL1Q2, p.o1, p.o1b);
    UpperTrianglize(Q, p.eL1Q5, tempQ, 0, p.o1, p.o1b);

    BatchTrimatTrMadd(F, Q, p.eL1Q2, sk, p.l1F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o1b);

    BatchTrimatMadd(F, Q, p.eL1Q3, sk, p.l1F1, sk, t2, p.v1, p.v1b, p.o2, p.o1b);
    BatchMatMadd(F, Q, p.eL1Q3, sk, p.l1F2, p.v1, sk, p.t3, p.o1, p.o1b, p.o2, p.o1b);

    VecZero(tempQ, 0, p.o1b * p.o2 * p.o2);
    BatchMatTrMadd(F, tempQ, 0, sk, t2, p.v1, p.v1b, p.o2, Q, p.eL1Q3, p.o2, p.o1b);
    UpperTrianglize(Q, p.eL1Q9, tempQ, 0, p.o2, p.o1b);

    BatchTrimatTrMadd(F, Q, p.eL1Q3, sk, p.l1F1, sk, t2, p.v1, p.v1b, p.o2, p.o1b);

    BatchBmatTrMadd(F, Q, p.eL1Q6, sk, p.l1F2, p.o1, sk, t2, p.v1, p.v1b, p.o2, p.o1b);
    BatchMatTrMadd(F, Q, p.eL1Q6, sk, p.t1, p.v1, p.v1b, p.o1, Q, p.eL1Q3, p.o2, p.o1b);

    VecCopy(Q, p.eL2Q1, sk, p.l2F1, p.eL2Q1Size);
    VecCopy(Q, p.eL2Q2, sk, p.l2F2, p.eL2Q2Size);
    BatchTrimatMadd(F, Q, p.eL2Q2, sk, p.l2F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o2b);

    VecCopy(Q, p.eL2Q5, sk, p.l2F5, p.eL2Q5Size);
    VecZero(tempQ, 0, p.o2b * p.o1 * p.o1);
    BatchMatTrMadd(F, tempQ, 0, sk, p.t1, p.v1, p.v1b, p.o1, Q, p.eL2Q2, p.o1, p.o2b);
    UpperTrianglize(Q, p.eL2Q5, tempQ, 0, p.o1, p.o2b);

    BatchTrimatTrMadd(F, Q, p.eL2Q2, sk, p.l2F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o2b);

    VecCopy(Q, p.eL2Q3, sk, p.l2F3, p.eL2Q3Size);
    BatchTrimatMadd(F, Q, p.eL2Q3, sk, p.l2F1, sk, t2, p.v1, p.v1b, p.o2, p.o2b);
    BatchMatMadd(F, Q, p.eL2Q3, sk, p.l2F2, p.v1, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);

    VecZero(tempQ, 0, p.o2b * p.o2 * p.o2);
    BatchMatTrMadd(F, tempQ, 0, sk, t2, p.v1, p.v1b, p.o2, Q, p.eL2Q3, p.o2, p.o2b);

    VecCopy(Q, p.eL2Q6, sk, p.l2F6, p.eL2Q6Size);
    BatchTrimatMadd(F, Q, p.eL2Q6, sk, p.l2F5, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);
    BatchMatTrMadd(F, tempQ, 0, sk, p.t3, p.o1, p.o1b, p.o2, Q, p.eL2Q6, p.o2, p.o2b);
    VecZero(Q, p.eL2Q9, p.eL2Q9Size);
    UpperTrianglize(Q, p.eL2Q9, tempQ, 0, p.o2, p.o2b);

    BatchTrimatTrMadd(F, Q, p.eL2Q3, sk, p.l2F1, sk, t2, p.v1, p.v1b, p.o2, p.o2b);

    BatchBmatTrMadd(F, Q, p.eL2Q6, sk, p.l2F2, p.o1, sk, t2, p.v1, p.v1b, p.o2, p.o2b);
    BatchTrimatTrMadd(F, Q, p.eL2Q6, sk, p.l2F5, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);
    BatchMatTrMadd(F, Q, p.eL2Q6, sk, p.t1, p.v1, p.v1b, p.o1, Q, p.eL2Q3, p.o2, p.o2b);
  }

  // The cyclic direction. The first public blocks are fixed by the public seed
  // and the central map is recovered from them, which is what lets a cyclic
  // public key be so much smaller than a flat one.
  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} sk - sk
   * @param {Uint8Array} Qs - Qs
   */
  function CalculateFFromQ(F, p, sk, Qs) {
    VecCopy(sk, p.l1F1, Qs, p.l1F1, p.l1F1Size);

    VecCopy(sk, p.l1F2, Qs, p.l1F2, p.l1F2Size);
    Batch2TrimatMadd(F, sk, p.l1F2, Qs, p.l1F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o1b);

    VecCopy(sk, p.l2F1, Qs, p.l2F1, p.l2F1Size);

    VecCopy(sk, p.l2F2, Qs, p.l2F2, p.l2F2Size);
    BatchTrimatMadd(F, sk, p.l2F2, Qs, p.l2F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o2b);

    const tempQ = new Uint8Array(p.o1 * p.o1 * p.o2b);
    BatchMatTrMadd(F, tempQ, 0, sk, p.t1, p.v1, p.v1b, p.o1, sk, p.l2F2, p.o1, p.o2b);
    VecCopy(sk, p.l2F5, Qs, p.l2F5, p.l2F5Size);
    UpperTrianglize(sk, p.l2F5, tempQ, 0, p.o1, p.o2b);

    BatchTrimatTrMadd(F, sk, p.l2F2, Qs, p.l2F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o2b);

    VecCopy(sk, p.l2F3, Qs, p.l2F3, p.l2F3Size);
    Batch2TrimatMadd(F, sk, p.l2F3, Qs, p.l2F1, sk, p.t4, p.v1, p.v1b, p.o2, p.o2b);
    BatchMatMadd(F, sk, p.l2F3, Qs, p.l2F2, p.v1, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);

    VecCopy(sk, p.l2F6, Qs, p.l2F6, p.l2F6Size);
    BatchMatTrMadd(F, sk, p.l2F6, sk, p.t1, p.v1, p.v1b, p.o1, sk, p.l2F3, p.o2, p.o2b);
    Batch2TrimatMadd(F, sk, p.l2F6, Qs, p.l2F5, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);
    BatchBmatTrMadd(F, sk, p.l2F6, Qs, p.l2F2, p.o1, sk, p.t4, p.v1, p.v1b, p.o2, p.o2b);
  }

  // The blocks of a cyclic public key that its seed does not fix.
  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} cpk - cpk
   * @param {Uint8Array} sk - sk
   */
  function CalculateQFromFCyclic(F, p, cpk, sk) {
    const t2 = p.t4;

    const bufSize = Math.max(p.o2b * p.v1 * p.o2, p.o1b * p.o1 * p.o1, p.o2b * p.o1 * p.o2);
    const bufF2 = new Uint8Array(bufSize);
    const bufF3 = new Uint8Array(bufSize);

    VecCopy(bufF2, 0, sk, p.l1F2, p.o1b * p.v1 * p.o1);
    BatchTrimatMadd(F, bufF2, 0, sk, p.l1F1, sk, p.t1, p.v1, p.v1b, p.o1, p.o1b);

    VecZero(bufF3, 0, p.o1b * p.o1 * p.o1);
    BatchMatTrMadd(F, bufF3, 0, sk, p.t1, p.v1, p.v1b, p.o1, bufF2, 0, p.o1, p.o1b);
    VecZero(cpk, p.cQ5, p.cQ5Size);
    UpperTrianglize(cpk, p.cQ5, bufF3, 0, p.o1, p.o1b);

    VecZero(cpk, p.cQ3, p.cQ3Size);
    VecZero(cpk, p.cQ6, p.cQ6Size);
    VecZero(cpk, p.cQ9, p.cQ9Size);

    BatchTrimatMadd(F, cpk, p.cQ3, sk, p.l1F1, sk, t2, p.v1, p.v1b, p.o2, p.o1b);
    BatchMatMadd(F, cpk, p.cQ3, sk, p.l1F2, p.v1, sk, p.t3, p.o1, p.o1b, p.o2, p.o1b);

    VecZero(bufF3, 0, p.o1b * p.o2 * p.o2);
    BatchMatTrMadd(F, bufF3, 0, sk, t2, p.v1, p.v1b, p.o2, cpk, p.cQ3, p.o2, p.o1b);
    UpperTrianglize(cpk, p.cQ9, bufF3, 0, p.o2, p.o1b);

    BatchTrimatTrMadd(F, cpk, p.cQ3, sk, p.l1F1, sk, t2, p.v1, p.v1b, p.o2, p.o1b);

    BatchBmatTrMadd(F, cpk, p.cQ6, sk, p.l1F2, p.o1, sk, t2, p.v1, p.v1b, p.o2, p.o1b);
    BatchMatTrMadd(F, cpk, p.cQ6, sk, p.t1, p.v1, p.v1b, p.o1, cpk, p.cQ3, p.o2, p.o1b);

    VecCopy(bufF3, 0, sk, p.l2F3, p.o2b * p.v1 * p.o2);
    BatchTrimatMadd(F, bufF3, 0, sk, p.l2F1, sk, t2, p.v1, p.v1b, p.o2, p.o2b);
    BatchMatMadd(F, bufF3, 0, sk, p.l2F2, p.v1, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);

    VecZero(bufF2, 0, p.o2b * p.v1 * p.o2);
    BatchMatTrMadd(F, bufF2, 0, sk, t2, p.v1, p.v1b, p.o2, bufF3, 0, p.o2, p.o2b);

    VecCopy(bufF3, 0, sk, p.l2F6, p.o2b * p.o1 * p.o2);
    BatchTrimatMadd(F, bufF3, 0, sk, p.l2F5, sk, p.t3, p.o1, p.o1b, p.o2, p.o2b);

    BatchMatTrMadd(F, bufF2, 0, sk, p.t3, p.o1, p.o1b, p.o2, bufF3, 0, p.o2, p.o2b);
    VecZero(cpk, p.cl2Q9, p.cl2Q9Size);
    UpperTrianglize(cpk, p.cl2Q9, bufF2, 0, p.o2, p.o2b);
  }

  // The flat public key is the upper triangle of the whole quadratic map, each
  // entry carrying one field element for every equation.
  /**
   * Copy one block pair of the extended public key into the flat one.
   * @param {RainbowParams} p - parameter set
   * @param {Uint8Array} pk - the flat public key
   * @param {Uint8Array} Q - the extended public key
   * @param {int32} l1Start - offset of the layer-one block
   * @param {int32} l2Start - offset of the layer-two block
   * @param {int32} iFrom - first row
   * @param {int32} iTo - end row
   * @param {int32} jFrom - first column, when not triangular
   * @param {int32} jTo - end column
   * @param {boolean} triangular - whether column starts at the row
   */
  function PutBlocks(p, pk, Q, l1Start, l2Start, iFrom, iTo, jFrom, jTo, triangular) {
    let a = l1Start, b = l2Start;
    for (let i = iFrom; i < iTo; ++i) {
      const jStart = triangular ? i : jFrom;
      for (let j = jStart; j < jTo; ++j) {
        const base = p.mb * IdxOfTrimat(i, j, p.n);
        VecCopy(pk, base, Q, a, p.o1b);
        VecCopy(pk, base + p.o1b, Q, b, p.o2b);
        a += p.o1b;
        b += p.o2b;
      }
    }
  }

  /**
   * @param {RainbowParams} p - p
   * @param {Uint8Array} pk - pk
   * @param {Uint8Array} Q - Q
   */
  function ExtCpkToPk(p, pk, Q) {
    PutBlocks(p, pk, Q, p.eL1Q1, p.eL2Q1, 0, p.v1, 0, p.v1, true);
    PutBlocks(p, pk, Q, p.eL1Q2, p.eL2Q2, 0, p.v1, p.v1, p.v2, false);
    PutBlocks(p, pk, Q, p.eL1Q3, p.eL2Q3, 0, p.v1, p.v2, p.n, false);
    PutBlocks(p, pk, Q, p.eL1Q5, p.eL2Q5, p.v1, p.v2, 0, p.v2, true);
    PutBlocks(p, pk, Q, p.eL1Q6, p.eL2Q6, p.v1, p.v2, p.v2, p.n, false);
    PutBlocks(p, pk, Q, p.eL1Q9, p.eL2Q9, p.v2, p.n, 0, p.n, true);
  }

  /**
   * The classic secret key: everything comes from one seed.
   * @param {Uint8Array} skSeed - 32 octets
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @returns {Uint8Array} the secret key, with t4 in its signing form
   */
  function GenerateSecretKeyClassic(F, p, skSeed) {
    const sk = new Uint8Array(p.skSize);
    VecCopy(sk, p.skSeed, skSeed, 0, 32);
    const prng = PrngSet(p.hashLen, skSeed);
    GenerateST(p, sk, prng);
    GenerateB1B2(p, sk, p.l1F1, prng);
    CalculateT4(F, p, sk);
    return sk;
  }

  /**
   * The classic key pair. The public key is the flat quadratic map.
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} skSeed - skSeed
   * @returns {RainbowKeyPair} Result
   */
  function GenerateKeypairClassic(F, p, skSeed) {
    const sk = new Uint8Array(p.skSize);
    VecCopy(sk, p.skSeed, skSeed, 0, 32);
    const prng = PrngSet(p.hashLen, skSeed);
    GenerateST(p, sk, prng);
    GenerateB1B2(p, sk, p.l1F1, prng);

    // The t4 field still holds t2 here, which is what the public map wants.
    const Q = new Uint8Array(p.extSize);
    CalculateQFromF(F, p, Q, sk);
    CalculateT4(F, p, sk);

    ObfuscateL1(F, p, Q, p.eL1Q1, Q, p.eL2Q1, p.triV1, sk);
    ObfuscateL1(F, p, Q, p.eL1Q2, Q, p.eL2Q2, p.v1 * p.o1, sk);
    ObfuscateL1(F, p, Q, p.eL1Q3, Q, p.eL2Q3, p.v1 * p.o2, sk);
    ObfuscateL1(F, p, Q, p.eL1Q5, Q, p.eL2Q5, p.triO1, sk);
    ObfuscateL1(F, p, Q, p.eL1Q6, Q, p.eL2Q6, p.o1 * p.o2, sk);
    ObfuscateL1(F, p, Q, p.eL1Q9, Q, p.eL2Q9, p.triO2, sk);

    const pk = new Uint8Array(p.pkSize);
    ExtCpkToPk(p, pk, Q);
    return new RainbowKeyPair(pk, sk);
  }

  /**
   * The secret key of the cyclic and compressed forms, from the two seeds.
   * Signing needs only this, not the public key.
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} pkSeed - pkSeed
   * @param {Uint8Array} skSeed - skSeed
   * @returns {Uint8Array} Result
   */
  function GenerateSecretKeyCyclic(F, p, pkSeed, skSeed) {
    const sk = new Uint8Array(p.skSize);
    VecCopy(sk, p.skSeed, skSeed, 0, 32);

    const prng0 = PrngSet(p.hashLen, skSeed);
    GenerateST(p, sk, prng0);
    CalculateT4(F, p, sk);

    const Qs = new Uint8Array(p.skSize);
    const prng1 = PrngSet(p.hashLen, pkSeed);
    GenerateB1B2(p, Qs, p.l1F1, prng1);
    ObfuscateL1(F, p, Qs, p.l1F1, Qs, p.l2F1, p.triV1, sk);
    ObfuscateL1(F, p, Qs, p.l1F2, Qs, p.l2F2, p.v1 * p.o1, sk);

    CalculateFFromQ(F, p, sk, Qs);
    return sk;
  }

  /**
   * The cyclic key pair: the full secret key and the small public key.
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} pkSeed - pkSeed
   * @param {Uint8Array} skSeed - skSeed
   * @returns {RainbowKeyPair} Result
   */
  function GenerateKeypairCyclic(F, p, pkSeed, skSeed) {
    const sk = new Uint8Array(p.skSize);
    const cpk = new Uint8Array(p.cpkSize);
    VecCopy(cpk, p.pkSeed, pkSeed, 0, 32);
    VecCopy(sk, p.skSeed, skSeed, 0, 32);

    const prng0 = PrngSet(p.hashLen, skSeed);
    GenerateST(p, sk, prng0);

    const t2 = new Uint8Array(p.t4Size);
    VecCopy(t2, 0, sk, p.t4, p.t4Size);
    CalculateT4(F, p, sk);

    const Qs = new Uint8Array(p.skSize);
    const prng1 = PrngSet(p.hashLen, pkSeed);
    GenerateB1B2(p, Qs, p.l1F1, prng1);
    ObfuscateL1(F, p, Qs, p.l1F1, Qs, p.l2F1, p.triV1, sk);
    ObfuscateL1(F, p, Qs, p.l1F2, Qs, p.l2F2, p.v1 * p.o1, sk);

    CalculateFFromQ(F, p, sk, Qs);

    // The remaining public blocks want t2 where signing wants t4.
    const t4 = new Uint8Array(p.t4Size);
    VecCopy(t4, 0, sk, p.t4, p.t4Size);
    VecCopy(sk, p.t4, t2, 0, p.t4Size);
    CalculateQFromFCyclic(F, p, cpk, sk);
    VecCopy(sk, p.t4, t4, 0, p.t4Size);

    ObfuscateL1(F, p, cpk, p.cQ3, Qs, p.l2F3, p.v1 * p.o2, sk);
    ObfuscateL1(F, p, cpk, p.cQ5, Qs, p.l2F5, p.triO1, sk);
    ObfuscateL1(F, p, cpk, p.cQ6, Qs, p.l2F6, p.o1 * p.o2, sk);
    ObfuscateL1(F, p, cpk, p.cQ9, cpk, p.cl2Q9, p.triO2, sk);

    return new RainbowKeyPair(cpk, sk);
  }

  // ===== signing =====
  //
  // The central map is inverted one layer at a time. The vinegar variables are
  // drawn first, which turns the first layer into a linear system in its oil
  // variables; the solution is substituted to make the second layer linear in
  // turn. Either system can come out singular, so both are retried with fresh
  // randomness, and the salt is redrawn on every attempt.

  const MAX_ATTEMPTS = 128;

  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} sk - sk
   * @param {Uint8Array} digest - digest
   * @returns {Uint8Array|null} Result
   */
  function RainbowSign(F, p, sk, digest) {
    const matL1 = new Uint8Array(p.o1 * p.o1b);
    const matL2 = new Uint8Array(p.o2 * p.o2b);

    // A private generator keyed by the secret seed and the digest, so a
    // signature is deterministic in the key and the message.
    const preseed = new Uint8Array(32 + p.hashLen);
    VecCopy(preseed, 0, sk, p.skSeed, 32);
    VecCopy(preseed, 32, digest, 0, p.hashLen);
    const prng = PrngSet(p.hashLen, HashMsg(p.hashLen, p.hashLen, preseed));

    const vinegar = new Uint8Array(p.v1b);
    let attempts = 0;
    let layer1Ok = 0;
    while (!layer1Ok) {
      if (attempts >= MAX_ATTEMPTS) break;
      prng.readInto(vinegar, 0, p.v1b);
      GfMatProd(F, matL1, 0, sk, p.l1F2, p.o1 * p.o1b, p.v1, vinegar, 0);
      layer1Ok = MatInv(F, matL1, matL1, 0, p.o1);
      ++attempts;
    }

    // Everything the second layer needs that depends only on the vinegars.
    const rL1F1 = new Uint8Array(p.o1b);
    const rL2F1 = new Uint8Array(p.o2b);
    BatchQuadTrimatEval(F, rL1F1, 0, sk, p.l1F1, vinegar, 0, p.v1, p.o1b);
    BatchQuadTrimatEval(F, rL2F1, 0, sk, p.l2F1, vinegar, 0, p.v1, p.o2b);

    const matL2F3 = new Uint8Array(p.o2 * p.o2b);
    const matL2F2 = new Uint8Array(p.o1 * p.o2b);
    GfMatProd(F, matL2F3, 0, sk, p.l2F3, p.o2 * p.o2b, p.v1, vinegar, 0);
    GfMatProd(F, matL2F2, 0, sk, p.l2F2, p.o1 * p.o2b, p.v1, vinegar, 0);

    const z = new Uint8Array(p.mb);
    const y = new Uint8Array(p.nb);
    const xo1 = new Uint8Array(p.o1b);
    const xo2 = new Uint8Array(p.o2b);
    const tempO = new Uint8Array(Math.max(p.o1b, p.o2b) + 32);

    const digestSalt = new Uint8Array(p.hashLen + p.saltBytes);
    VecCopy(digestSalt, 0, digest, 0, p.hashLen);

    let ok = 0;
    while (!ok) {
      if (attempts >= MAX_ATTEMPTS) break;

      prng.readInto(digestSalt, p.hashLen, p.saltBytes);
      const target = HashMsg(p.hashLen, p.mb, digestSalt);
      VecCopy(z, 0, target, 0, p.mb);

      // y = S^-1 z
      VecCopy(y, 0, z, 0, p.mb);
      GfMatProd(F, tempO, 0, sk, p.s1, p.o1b, p.o2, z, p.o1b);
      VecAdd(y, 0, tempO, 0, p.o1b);

      // First layer.
      VecCopy(tempO, 0, rL1F1, 0, p.o1b);
      VecAdd(tempO, 0, y, 0, p.o1b);
      GfMatProd(F, xo1, 0, matL1, 0, p.o1b, p.o1, tempO, 0);

      // Second layer: substitute the first layer's solution.
      VecZero(tempO, 0, p.o2b);
      GfMatProd(F, tempO, 0, matL2F2, 0, p.o2b, p.o1, xo1, 0);
      BatchQuadTrimatEval(F, matL2, 0, sk, p.l2F5, xo1, 0, p.o1, p.o2b);
      VecAdd(tempO, 0, matL2, 0, p.o2b);
      VecAdd(tempO, 0, rL2F1, 0, p.o2b);
      VecAdd(tempO, 0, y, p.o1b, p.o2b);

      GfMatProd(F, matL2, 0, sk, p.l2F6, p.o2 * p.o2b, p.o1, xo1, 0);
      VecAdd(matL2, 0, matL2F3, 0, p.o2 * p.o2b);

      ok = MatSolve(F, xo2, 0, matL2, 0, tempO, 0, p.o2);
      ++attempts;
    }

    if (attempts >= MAX_ATTEMPTS) return null;

    // w = T^-1 y
    const w = new Uint8Array(p.nb);
    VecCopy(w, 0, vinegar, 0, p.v1b);
    VecCopy(w, p.v1b, xo1, 0, p.o1b);
    VecCopy(w, p.v2b, xo2, 0, p.o2b);

    GfMatProd(F, y, 0, sk, p.t1, p.v1b, p.o1, xo1, 0);
    VecAdd(w, 0, y, 0, p.v1b);
    GfMatProd(F, y, 0, sk, p.t4, p.v1b, p.o2, xo2, 0);
    VecAdd(w, 0, y, 0, p.v1b);
    GfMatProd(F, y, 0, sk, p.t3, p.o1b, p.o2, xo2, 0);
    VecAdd(w, p.v1b, y, 0, p.o1b);

    const signature = new Uint8Array(p.sigBytes);
    VecCopy(signature, 0, w, 0, p.nb);
    VecCopy(signature, p.nb, digestSalt, p.hashLen, p.saltBytes);
    return signature;
  }

  // ===== verification =====
  //
  // Evaluating the public map is the sum over i <= j of x_i x_j times the block
  // of coefficients at (i, j).

  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} y - y
   * @param {int32} yOff - yOff
   * @param {Uint8Array} tri - tri
   * @param {int32} tOff - tOff
   * @param {Uint8Array} x - x
   * @param {int32} xFrom - xFrom
   * @param {int32} dim - dim
   * @param {int32} vecLen - vecLen
   */
  function EvalQuadTri(F, y, yOff, tri, tOff, x, xFrom, dim, vecLen) {
    let off = tOff;
    for (let i = 0; i < dim; ++i)
      for (let j = i; j < dim; ++j) {
        /** @type {uint8} */
        const xi = x[xFrom + i];
        /** @type {uint8} */
        const xj = x[xFrom + j];
        /** @type {uint8} */
        const product = F.mul(xi, xj);
        F.madd(y, yOff, tri, off, product, vecLen);
        off += vecLen;
      }
  }

  /**
   * @param {RainbowField} F - the field
   * @param {Uint8Array} y - y
   * @param {int32} yOff - yOff
   * @param {Uint8Array} mat - mat
   * @param {int32} mOff - mOff
   * @param {Uint8Array} xa - xa
   * @param {int32} aFrom - aFrom
   * @param {int32} dimA - dimA
   * @param {Uint8Array} xb - xb
   * @param {int32} bFrom - bFrom
   * @param {int32} dimB - dimB
   * @param {int32} vecLen - vecLen
   */
  function EvalQuadRect(F, y, yOff, mat, mOff, xa, aFrom, dimA, xb, bFrom, dimB, vecLen) {
    let off = mOff;
    for (let i = 0; i < dimA; ++i)
      for (let j = 0; j < dimB; ++j) {
        /** @type {uint8} */
        const xi = xa[aFrom + i];
        /** @type {uint8} */
        const xj = xb[bFrom + j];
        /** @type {uint8} */
        const product = F.mul(xi, xj);
        F.madd(y, yOff, mat, off, product, vecLen);
        off += vecLen;
      }
  }

  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} pk - pk
   * @param {Uint8Array} w - w
   * @returns {Uint8Array} Result
   */
  function RainbowPublicMap(F, p, pk, w) {
    const x = new Uint8Array(p.n);
    for (let i = 0; i < p.n; ++i) {
      /** @type {uint8} */
      const element = F.getEle(w, 0, i);
      x[i] = element;
    }
    const z = new Uint8Array(p.mb);
    EvalQuadTri(F, z, 0, pk, 0, x, 0, p.n, p.mb);
    return z;
  }

  // The cyclic public key regenerates its first blocks from its seed, so
  // evaluating it means expanding them again in the same order.
  /**
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} cpk - cpk
   * @param {Uint8Array} w - w
   * @returns {Uint8Array} Result
   */
  function RainbowPublicMapCyclic(F, p, cpk, w) {
    const x = new Uint8Array(p.n);
    for (let i = 0; i < p.n; ++i) {
      /** @type {uint8} */
      const element = F.getEle(w, 0, i);
      x[i] = element;
    }
    const atV1 = 0, atO1 = p.v1, atO2 = p.v2;

    const prng = PrngSet(p.hashLen, cpk.subarray(p.pkSeed, p.pkSeed + 32));
    const buf = new Uint8Array(Math.max(p.l1F1Size, p.l1F2Size, p.l2F1Size,
                                        p.l2F2Size, p.l2F3Size, p.l2F5Size, p.l2F6Size));
    const z = new Uint8Array(p.mb);

    prng.readInto(buf, 0, p.l1F1Size);
    EvalQuadTri(F, z, 0, buf, 0, x, atV1, p.v1, p.o1b);
    prng.readInto(buf, 0, p.l1F2Size);
    EvalQuadRect(F, z, 0, buf, 0, x, atV1, p.v1, x, atO1, p.o1, p.o1b);
    EvalQuadRect(F, z, 0, cpk, p.cQ3, x, atV1, p.v1, x, atO2, p.o2, p.o1b);
    EvalQuadTri(F, z, 0, cpk, p.cQ5, x, atO1, p.o1, p.o1b);
    EvalQuadRect(F, z, 0, cpk, p.cQ6, x, atO1, p.o1, x, atO2, p.o2, p.o1b);
    EvalQuadTri(F, z, 0, cpk, p.cQ9, x, atO2, p.o2, p.o1b);

    prng.readInto(buf, 0, p.l2F1Size);
    EvalQuadTri(F, z, p.o1b, buf, 0, x, atV1, p.v1, p.o2b);
    prng.readInto(buf, 0, p.l2F2Size);
    EvalQuadRect(F, z, p.o1b, buf, 0, x, atV1, p.v1, x, atO1, p.o1, p.o2b);
    prng.readInto(buf, 0, p.l2F3Size);
    EvalQuadRect(F, z, p.o1b, buf, 0, x, atV1, p.v1, x, atO2, p.o2, p.o2b);
    prng.readInto(buf, 0, p.l2F5Size);
    EvalQuadTri(F, z, p.o1b, buf, 0, x, atO1, p.o1, p.o2b);
    prng.readInto(buf, 0, p.l2F6Size);
    EvalQuadRect(F, z, p.o1b, buf, 0, x, atO1, p.o1, x, atO2, p.o2, p.o2b);
    EvalQuadTri(F, z, p.o1b, cpk, p.cl2Q9, x, atO2, p.o2, p.o2b);

    return z;
  }

  /**
   * A signature is valid when the public map of its vector reproduces the
   * hash of the digest and the salt the signature carries.
   * @param {RainbowField} F - the field
   * @param {RainbowParams} p - p
   * @param {Uint8Array} publicKey - publicKey
   * @param {boolean} cyclic - cyclic
   * @param {Uint8Array} digest - digest
   * @param {Uint8Array} signature - signature
   * @returns {boolean} Result
   */
  function RainbowVerify(F, p, publicKey, cyclic, digest, signature) {
    const w = signature.subarray(0, p.nb);
    const check = cyclic ? RainbowPublicMapCyclic(F, p, publicKey, w)
                         : RainbowPublicMap(F, p, publicKey, w);

    const digestSalt = new Uint8Array(p.hashLen + p.saltBytes);
    VecCopy(digestSalt, 0, digest, 0, p.hashLen);
    VecCopy(digestSalt, p.hashLen, signature, p.nb, p.saltBytes);
    const correct = HashMsg(p.hashLen, p.mb, digestSalt);

    /** @type {uint32} */
    let diff = 0;
    for (let i = 0; i < p.mb; ++i) diff = OpCodes.Or32(diff, OpCodes.Xor32(check[i], correct[i]));
    return diff === 0;
  }

  // ===== KAT DATA =====
  //
  // Entries of the PQCsignKAT files of the Rainbow round-three submission to
  // the NIST post-quantum project. Each carries the seed material the NIST
  // harness drew from its AES-256 CTR_DRBG, the message, and the signed message
  // the reference produced. Nothing here was generated by this file.
  //
  // A 32 octet key is a classic secret seed and gives the flat public key; a 64
  // octet key is the compressed secret key, pk_seed followed by sk_seed, and
  // gives the cyclic public key. Both are the submission's own key formats.

  /** One entry of a PQCsignKAT file. */
  class RainbowKatEntry {
    /**
     * @param {string} setName - the parameter set
     * @param {int32} count - the entry's count field
     * @param {string} file - the response file, relative to the package
     * @param {string} key - the seed material, hex
     * @param {string} msg - the message, hex
     * @param {string} sm - the signed message, hex
     */
    constructor(setName, count, file, key, msg, sm) {
      /** @type {string} */
      this.setName = setName;
      /** @type {int32} */
      this.count = count;
      /** @type {string} */
      this.file = file;
      /** @type {string} */
      this.key = key;
      /** @type {string} */
      this.msg = msg;
      /** @type {string} */
      this.sm = sm;
    }
  }

  /** @type {RainbowKatEntry[]} */
  const KAT = [
    new RainbowKatEntry('Rainbow-I',
      0,
      'KAT/Ia_Circumzenithal/PQCsignKAT_103648.rsp',
      '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f' +
        '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8' +
        '8847ec401b4b72631083a138e29d2323d1759d7268af6b3edb06762722491fa2bc' +
        '3e93dd9a10a995f9b38ab6c65b608ac9fe4b9a9e38ee4622d5bc61d8e1fe912433'),
    new RainbowKatEntry('Rainbow-I',
      1,
      'KAT/Ia_Circumzenithal/PQCsignKAT_103648.rsp',
      'e82fcc97ca60ccb27bf6938c975658aeb8b4d37cffbde25d97e561f36c219ade' +
        '4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64c81cc7cc2f513345',
      '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a' +
        '073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49',
      '225d5ce2ceac61930a07503fb59f7c2f936a3e075481da3ca299a80f8c5df9223a' +
        '073e7b90e02ebf98ca2227eba38c1ab2568209e46dba961869c6f83983b17dcd49' +
        '92f541ac65b6f3240547be53b796eb3581385f9d4a0ef041c833feae4403573049' +
        '3c10ceefe90bfc61cc58d8eff712232740d0bd6e49bd95099f3cfa73edae6777a8'),
    new RainbowKatEntry('Rainbow-I',
      2,
      'KAT/Ia_Circumzenithal/PQCsignKAT_103648.rsp',
      'f333d36590910e7a5a6cbe567bcdd154137eef62b92bf8dc1fdc900e7c194e5f' +
        '1d836e889e46259bcd1ccd2b369583c5b47cfbb919ec2b72c280247cb15a5569',
      '2b8c4b0f29363eaee469a7e33524538aa066ae98980eaa19d1f10593203da2143b' +
        '9e9e1973f7ff0e6c6aaa3c0b900e50d003412efe96deece3046d8c46bc7709228' +
        '789775abdf56aed6416c90033780cb7a4984815da1b14660dcf34aa34bf82cebbcf',
      '2b8c4b0f29363eaee469a7e33524538aa066ae98980eaa19d1f10593203da2143b' +
        '9e9e1973f7ff0e6c6aaa3c0b900e50d003412efe96deece3046d8c46bc7709228' +
        '789775abdf56aed6416c90033780cb7a4984815da1b14660dcf34aa34bf82cebbcf' +
        'a7d2035a4219d6accf47a7a97478f1b48c3e5eb9fb69b323fe3b14f9b87c45dc36' +
        '50ddc23c09f010234f14c0f49f6cadc6d919ccf0912ae76f9bdb0d8d0ac37e7473'),
    new RainbowKatEntry('Rainbow-V',
      0,
      'KAT/Vc_Classic/PQCsignKAT_1408736.rsp',
      '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8' +
        '15040f890f2bf56f8b04b1d8b9ba21d303c490868a0a10c9ffc04a2af9d1f3122d' +
        '14f7c6d5e0b1d914cc23d763c061b2fd34df8cb0d75f12111244241fa7a136c440' +
        'c2d40782390fe5ef3c15ed5539285b437da0447e361853e98982e1f16aa0506bab' +
        'ffbba8282baa0a307c50eba79596ad26ebece897e7b4de3b601a515c0877552652' +
        '2915ed03f08baa23afed4224c8e50ed67fbccfab62c58872ce880c850d3a03f21b2' +
        '703c5c085fa410a5fcb3559e50d6bbc6a06faba309962f2922e0d014c5eb074090' +
        '543c9478050169fccfbc0e9ba11'),
    new RainbowKatEntry('Rainbow-V',
      0,
      'KAT/Vc_Circumzenithal/PQCsignKAT_1408736.rsp',
      '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f' +
        '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8' +
        'd1f97d1310f57af3509f66307985b7f341234ce8f7516e4b61f9e53b1282ce66b9' +
        '526321c66954e1753d1a9c8ba4012b9c5a211f0287c72705141f71a9aaec350e81' +
        'f6ec67ed10e1bd61dcdfa4ac87553563e0fee31927e5877741d5dcdf03c44e50cf' +
        '80bb3d15856af49f2c68a7edac52fd2957f96a7113dce51785edf0ab8538c1eaad' +
        '694e8514cdc7872664412bcf9884c185bade87781016826e32e08c1ec6275c6f85' +
        '88a11ff6575d704505d4ab794d047bec1104c00dad3bcfc2de42267b3552bd7409' +
        '0543c9478050169fccfbc0e9ba11')
  ];

  // ===== the set whose response file was never generated =====
  //
  // The round-three package creates a KAT directory for all nine combinations
  // of parameter set and key format and populates three: Rainbow-I
  // circumzenithal, Rainbow-V classic and Rainbow-V circumzenithal. The other
  // six directories, Rainbow-III's three among them, are empty. The generator
  // that would have filled them ships beside them, so this is an omission
  // rather than a decision, but the files do not exist and no third party ever
  // published them. The earlier packages do not fill the gap either: round
  // two's level-three sets are different maps, (68,36,36) over GF(256) and a
  // GF(31) set this code does not carry, and round one ships no response file
  // at all.
  //
  // A digest of each missing record was published, though. PQClean carried all
  // nine Rainbow parameter sets until it dropped the scheme in 2022, and each
  // META.yml records a nistkat-sha256 taken over the count = 0 record of the
  // response file - the seed, the message length, the message, the public key,
  // the secret key, the signed message length and the signed message, eight
  // lines joined by newlines with one at the end. liboqs 0.7.2 publishes the
  // same digests. The input side is public too: every NIST request file is the
  // same hundred seeds and messages, and the round-three package ships it for
  // the sets it did populate.
  //
  // That is enough to check a reconstruction without the file. The two entries
  // below are reconstructions rather than transcriptions, and both are pinned:
  // rebuilding the whole count = 0 record from the published request seed
  // reproduces all three published Rainbow-III digests, one per key format.
  //
  //   classic          1eb9bb6e63cfdbd05a6eaca9989e969fd234b110b67ff7e6373e1af080b35f41
  //   circumzenithal   1b5cbbdef12492ba8176309a44461d3d64a05b049f78edb85af1d166f4b64f32
  //   compressed       8f895e88918df9e26123b5e0be722e952f3603bfc1f6b2859a8155edf3907969
  //
  // The six sets whose response files do ship are the control, and all six
  // reproduce their published digest under the same reconstruction, so a
  // mismatch would have implicated the harness rather than the scheme. Nine of
  // nine reproduce. The compressed format shares its signature with the
  // circumzenithal one and differs only in which key the record prints, so it
  // needs no separate vector here.
  //
  // Registering the set also puts the SHA-384 branch under test for the first
  // time: hashLen is 32 for Rainbow-I and 64 for Rainbow-V, so nothing the
  // suite ran reached 48.

  /** A count = 0 record rebuilt from the request seed and pinned by its digest. */
  class RainbowReconstructedEntry {
    /**
     * @param {string} setName - the parameter set
     * @param {string} format - the key format
     * @param {string} digest - the published nistkat-sha256, hex
     * @param {string} uri - where the digest is published
     * @param {string} key - the seed material, hex
     * @param {string} msg - the message, hex
     * @param {string} sm - the signed message, hex
     */
    constructor(setName, format, digest, uri, key, msg, sm) {
      /** @type {string} */
      this.setName = setName;
      /** @type {string} */
      this.format = format;
      /** @type {string} */
      this.digest = digest;
      /** @type {string} */
      this.uri = uri;
      /** @type {string} */
      this.key = key;
      /** @type {string} */
      this.msg = msg;
      /** @type {string} */
      this.sm = sm;
    }
  }

  /** @type {RainbowReconstructedEntry[]} */
  const RECONSTRUCTED = [
    new RainbowReconstructedEntry('Rainbow-III',
      'classic',
      '1eb9bb6e63cfdbd05a6eaca9989e969fd234b110b67ff7e6373e1af080b35f41',
      'https://github.com/PQClean/PQClean/blob/6cd3167b397e1150289a383baef52bc6cfc9eadf/crypto_sign/rainbowIII-classic/META.yml',
      '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8' +
        '6033c99a65042be545eed707341bd14f73ca178f2a5b244a87e847dcab29a90866' +
        '76d7a7a4b35e3904a9edd7b399b1bd104a19373a415029bccd4c707b416eed683f' +
        '13a9189ef0bdc151116cbf6d6a9d4bc019faa58fd770b6f567a410c700b48c488a' +
        '375c33866f3febb8dedf239c64ff9a36f092e3d6192b9a0726b06672a540a892fa' +
        '7ba47dbe7f3e66bf394ed328a107b8edceb39ad2e43c6ee441f39ece871397ac'),
    new RainbowReconstructedEntry('Rainbow-III',
      'circumzenithal',
      '1b5cbbdef12492ba8176309a44461d3d64a05b049f78edb85af1d166f4b64f32',
      'https://github.com/PQClean/PQClean/blob/6cd3167b397e1150289a383baef52bc6cfc9eadf/crypto_sign/rainbowIII-circumzenithal/META.yml',
      '8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f' +
        '7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8',
      'd81c4d8d734fcbfbeade3d3f8a039faa2a2c9957e835ad55b22e75bf57bb556ac8' +
        '451f524fef128edbe93814c041d5edd2c8a0226e05e13942b5b832c864a9618426' +
        '1745a5b530d09d51773c3e6f3c8297e3a8e6e4dbd23e56bda10b5c3a491f7a5d9e' +
        'a819d712fc6565429f965fd7264041e5f2007085de29930b20b187bb9e5bc4bcac' +
        '01c35cabc97f5ec6476c42138c3d18a1dbd23ba22b31b21bdbe5421ac1b837a793' +
        '123c80e2b5028a0763872e76e45f6aa9d675e2d667e6f68024d5ef1143d21713')
  ];

  // ===== ALGORITHM =====

  class RainbowAlgorithm extends AsymmetricCipherAlgorithm {
    /**
     * @param {string} setName - the name of one of the PARAMETER_SETS
     */
    constructor(setName) {
      super();

      const spec = ParameterSetEntry(setName);
      const p = BuildParams(setName, spec.gfSize, spec.v1, spec.o1, spec.o2, spec.hashLen);
      /** @type {RainbowParams} */
      this.parameters = p;
      /** @type {RainbowField} */
      this.field = new RainbowField(spec.gfSize);

      this.name = setName;
      this.description = 'Rainbow ' + spec.label + ', the round-three parameter set over GF('
        + spec.gfSize + ') with ' + spec.v1 + ' vinegar variables and layers of ' + spec.o1
        + ' and ' + spec.o2 + ' oil variables. A two-layer unbalanced oil and vinegar signature: '
        + 'the secret central map is inverted one layer at a time, the public key is that map '
        + 'composed with two affine transforms. Broken by Beullens in 2022 and withdrawn from '
        + 'standardisation; kept for its construction and its published test vectors only.';
      this.inventor = 'Jintai Ding, Dieter Schmidt';
      this.year = 2005;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Multivariate Digital Signature';
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      // A key here is seed material, not the expanded key: 32 octets for the
      // classic form, 64 for the compressed form that carries both seeds.
      this.SupportedKeySizes = [
        new KeySize(32, 64, 32)
      ];

      this.documentation = [
        new LinkItem('Rainbow round-three specification',
          'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip'),
        new LinkItem('NIST post-quantum project, round-three signatures',
          'https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions'),
        new LinkItem('Rainbow, a new multivariable polynomial signature scheme (Ding and Schmidt, 2005)',
          'https://doi.org/10.1007/11496137_12')
      ];

      this.references = [
        new LinkItem('Breaking Rainbow takes a weekend on a laptop (Beullens, 2022)',
          'https://eprint.iacr.org/2022/214'),
        new LinkItem('NIST status report on the third round',
          'https://doi.org/10.6028/NIST.IR.8413'),
        new LinkItem('Improved cryptanalysis of UOV and Rainbow (Beullens, 2021)',
          'https://eprint.iacr.org/2020/1343')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Key recovery in a weekend',
          'Beullens\' rectangle MinRank attack finds the secret subspace of the second layer '
          + 'directly from the public key. The published attack recovers a Rainbow-I private key '
          + 'in about 53 hours on a laptop, against a claimed 2^128 of security, and the same '
          + 'method reduces the larger parameter sets well below their claims',
          'None. The scheme is broken as specified; NIST dropped it at the end of the third '
          + 'round. Use a signature that is still standing',
          'https://eprint.iacr.org/2022/214'),
        new Vulnerability('Withdrawn from standardisation',
          'Rainbow was a third-round finalist and was not selected. No parameter set was raised '
          + 'to restore the claimed levels, and the scheme has no successor here',
          'Use ML-DSA (FIPS 204), SLH-DSA (FIPS 205) or Falcon',
          'https://doi.org/10.6028/NIST.IR.8413'),
        new Vulnerability('Published demonstration keys',
          'The seeds in the test vectors are printed in this file, derive from published Known '
          + 'Answer Test data and confer no secrecy whatever',
          'Nothing here is usable as a key. The scheme itself is broken, so there is no safe '
          + 'way to supply a real one either',
          'https://eprint.iacr.org/2022/214')
      ];

      // Test vectors.
      //
      // For Rainbow-I and Rainbow-V every expected value is the sm field of an
      // entry of a PQCsignKAT file of the round-three submission, and every key
      // is the seed material that entry's DRBG produced. None of it was
      // generated by this file.
      //
      // Measured over the published response files, not only the entries
      // committed here. Every entry checked reproduces its public key, its
      // secret key and its signed message octet for octet, and the message the
      // signed message opens to:
      //
      //   Rainbow-I circumzenithal   100 of 100, the whole file
      //   Rainbow-V circumzenithal    15 of 100
      //   Rainbow-V classic            8 of 100
      //
      // The Rainbow-V files are 389 and 668 megabytes and only their leading
      // entries were retrieved; nothing in them was skipped.
      //
      // Separately, and covering every combination rather than the three with a
      // response file, this code reproduces the nistkat-sha256 PQClean publishes
      // over the count = 0 record for all nine parameter set and key format
      // pairs, the three compressed ones and the three Rainbow-III ones
      // included. See RECONSTRUCTED for what that digest is taken over.
      //
      // The round-two package publishes two more response files for parameter
      // sets the round-three reference still carries. Its classic GF(16) set,
      // (32,32,32), reproduces all 100 of its entries under this code
      // unchanged, which is what pins the classic key format over GF(16). Its
      // one cyclic GF(256) entry does not, and cannot: that file stops after a
      // single entry because the signature it records does not verify under
      // the public key it records, the submitted generator having left the
      // wrong half of the T transform in the secret key.
      //
      // Rainbow-III has no published response file in any round or any key
      // format. Its vectors come from RECONSTRUCTED instead, rebuilt from the
      // published request seed and checked against the digest PQClean publishes
      // over the record they belong to; the reasoning is above that table, and
      // each vector says in its own text what it is.
      this.tests = KAT.filter(entry => entry.setName === setName).map(entry => ({
        text: setName + ' ' + entry.file.split('/')[1].replace(/_/g, ' ')
              + ' KAT entry ' + entry.count,
        uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip',
        input: OpCodes.Hex8ToBytes(entry.msg),
        key: OpCodes.Hex8ToBytes(entry.key),
        expected: OpCodes.Hex8ToBytes(entry.sm)
      })).concat(RECONSTRUCTED.filter(entry => entry.setName === setName).map(entry => ({
        text: setName + ' ' + entry.format + ' KAT entry 0, reconstructed: the submission '
              + 'left this response file ungenerated, so the record was rebuilt from the '
              + 'published request seed and checked against the nistkat-sha256 '
              + entry.digest.slice(0, 16) + '... that PQClean publishes over it',
        uri: entry.uri,
        input: OpCodes.Hex8ToBytes(entry.msg),
        key: OpCodes.Hex8ToBytes(entry.key),
        expected: OpCodes.Hex8ToBytes(entry.sm)
      })));
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - true to verify, false to sign
     * @returns {Object} New instance
     */
    CreateInstance(isInverse = false) {
      return new RainbowInstance(this, isInverse);
    }
  }

  /**
   * Rainbow instance implementing the Feed/Result pattern.
   *
   * The forward direction consumes a message and produces message || signature,
   * which is what the submission's crypto_sign returns. The inverse direction is
   * crypto_sign_open: it checks the signature the input carries and returns the
   * message, reporting a bad signature by throwing.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class RainbowInstance extends IAlgorithmInstance {
    /**
     * @param {RainbowAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - verification mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {RainbowParams} */
      this.parameters = algorithm.parameters;
      /** @type {RainbowField} */
      this.field = algorithm.field;
      /** @type {uint8[]|null} */
      this._keyData = null;
      /** @type {boolean} */
      this._cyclic = false;
      /** @type {Uint8Array|null} */
      this._secretKey = null;
      /** @type {Uint8Array|null} */
      this._publicKey = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Install seed material: 32 octets of classic secret seed, or the 64 octet
     * compressed secret key, which is pk_seed followed by sk_seed.
     * @param {uint8[]} keyData - the seed octets
     */
    KeySetup(keyData) {
      const p = this.parameters;
      if (!keyData || typeof keyData.length !== 'number'
          || (keyData.length !== p.seedBytes && keyData.length !== p.cskSize)) {
        throw new Error(p.name + ': the key is either a ' + p.seedBytes
          + ' octet classic secret seed or a ' + p.cskSize
          + ' octet compressed secret key');
      }

      /** @type {uint8[]} */
      const copy = new Array(keyData.length);
      for (let i = 0; i < keyData.length; ++i) copy[i] = keyData[i];
      this._keyData = copy;
      this._cyclic = (keyData.length === p.cskSize);
      this._publicKey = null;

      const seeds = Uint8Array.from(copy);
      this._secretKey = this._cyclic
        ? GenerateSecretKeyCyclic(this.field, p, seeds.subarray(0, 32), seeds.subarray(32, 64))
        : GenerateSecretKeyClassic(this.field, p, seeds);
    }

    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
     * The seed material this instance was configured with.
     * @returns {uint8[]|null} the octets, or null
     */
    get key() {
      return this._keyData;
    }

    /**
     * @returns {uint8[]|null} the same seed material
     */
    get privateKey() {
      return this._keyData;
    }

    /**
     * Derive the public key from the seeds, once. A flat Rainbow-V public key
     * is nearly two megabytes, so it is kept as octets and only copied out
     * when a caller actually asks for it.
     * @returns {Uint8Array|null} the public key, or null when there is no key
     */
    _ensurePublicKey() {
      if (this._publicKey) return this._publicKey;
      if (!this._keyData) return null;

      const p = this.parameters;
      const seeds = Uint8Array.from(this._keyData);
      const pair = this._cyclic
        ? GenerateKeypairCyclic(this.field, p, seeds.subarray(0, 32), seeds.subarray(32, 64))
        : GenerateKeypairClassic(this.field, p, seeds);
      this._publicKey = pair.publicKey;
      return this._publicKey;
    }

    /**
     * The public key, derived from the seeds on first request. It is the flat
     * quadratic map for a classic key and the seeded form for a compressed one.
     * @returns {uint8[]|null} the octets, or null
     */
    get publicKey() {
      const value = this._ensurePublicKey();
      return value ? Array.from(value) : null;
    }

    /**
     * Verify against a public key alone, with no seed present.
     * @param {uint8[]} value - a flat or a cyclic public key
     */
    set publicKey(value) {
      const p = this.parameters;
      if (!value) {
        this._publicKey = null;
        return;
      }
      if (value.length !== p.pkSize && value.length !== p.cpkSize) {
        throw new Error(p.name + ': the public key is ' + p.pkSize + ' octets flat or '
          + p.cpkSize + ' octets cyclic, not ' + value.length);
      }
      this._publicKey = Uint8Array.from(value);
      this._cyclic = (value.length === p.cpkSize);
    }

    /**
     * Feed data for processing. Appends, so a message split across several
     * calls signs identically to the same message delivered at once.
     * @param {uint8[]} data - input octets
     */
    Feed(data) {
      if (!data) return;
      for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
    }

    /**
     * Sign the fed message, or open the fed signed message.
     * @returns {uint8[]} message || signature when signing, the message when opening
     */
    Result() {
      const p = this.parameters;
      const F = this.field;

      if (this.isInverse) {
        const sm = Uint8Array.from(this.inputBuffer);
        this.inputBuffer = [];

        if (sm.length < p.sigBytes)
          throw new Error(p.name + ': a signed message is at least ' + p.sigBytes + ' octets');

        const publicKey = this._ensurePublicKey();
        if (!publicKey)
          throw new Error(p.name + ': verification needs a public key or the seeds that make one');

        const messageLength = sm.length - p.sigBytes;
        const message = sm.subarray(0, messageLength);
        const digest = HashMsg(p.hashLen, p.hashLen, message);
        const signature = sm.subarray(messageLength);

        if (!RainbowVerify(F, p, publicKey, this._cyclic, digest, signature))
          throw new Error(p.name + ': the signature does not verify');

        return Array.from(message);
      }

      if (!this._secretKey)
        throw new Error(p.name + ': signing needs a secret seed');

      const message = Uint8Array.from(this.inputBuffer);
      this.inputBuffer = [];

      const digest = HashMsg(p.hashLen, p.hashLen, message);
      const signature = RainbowSign(F, p, this._secretKey, digest);
      if (!signature)
        throw new Error(p.name + ': the central map stayed singular for ' + MAX_ATTEMPTS + ' attempts');

      /** @type {uint8[]} */
      const out = new Array(message.length + p.sigBytes);
      for (let i = 0; i < message.length; ++i) {
        /** @type {uint8} */
        const octet = message[i];
        out[i] = octet;
      }
      for (let i = 0; i < p.sigBytes; ++i) {
        /** @type {uint8} */
        const octet = signature[i];
        out[message.length + i] = octet;
      }
      return out;
    }
  }

  // ===== REGISTRATION =====

  for (let i = 0; i < PARAMETER_SETS.length; ++i) {
    const instance = new RainbowAlgorithm(PARAMETER_SETS[i].name);
    if (!AlgorithmFramework.Find(instance.name)) {
      RegisterAlgorithm(instance);
    }
  }

  // ===== EXPORTS =====

  return {
    RainbowAlgorithm,
    RainbowInstance,
    PARAMETER_SETS,
    BuildParams,
    MakeField,
    Drbg,
    HashMsg,
    PrngSet,
    GenerateKeypairClassic,
    GenerateKeypairCyclic,
    GenerateSecretKeyClassic,
    GenerateSecretKeyCyclic,
    RainbowSign,
    RainbowVerify,
    RainbowPublicMap,
    RainbowPublicMapCyclic
  };
}));
