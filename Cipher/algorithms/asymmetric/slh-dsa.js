/*
 * SLH-DSA - Stateless Hash-Based Digital Signature Algorithm
 * NIST FIPS 205 (August 2024)
 *
 * A stateless hash-based signature scheme. Its security rests on nothing but
 * the second-preimage resistance of the underlying hash function, which is why
 * it is the conservative choice among the post-quantum signature standards:
 * there is no lattice, no field arithmetic and no structured algebraic
 * assumption anywhere in it.
 *
 * The construction is a tower of four pieces, each built on the one below:
 *
 *   WOTS+     a one-time signature. A secret key is a list of `len` chains of
 *             hash applications; signing reveals each chain at a depth given by
 *             a nibble of the message, and a checksum makes it impossible to
 *             move any nibble upwards without moving another one down.
 *   XMSS      a Merkle tree whose leaves are WOTS+ public keys, so one tree
 *             root authenticates 2^h' one-time keys.
 *   hypertree d layers of XMSS, each layer signing the root of the layer below,
 *             which buys a 2^h-leaf tree without ever building it.
 *   FORS      a few-time signature over the message digest, whose public key is
 *             what the bottom hypertree layer actually signs.
 *
 * Signing picks the leaf by hashing the message, so no state has to be carried
 * between signatures - that statelessness is what the "SL" in the name records
 * and what distinguishes it from stateful XMSS/LMS.
 *
 * All twelve FIPS 205 parameter sets are implemented, over both hash families:
 * the SHAKE sets use SHAKE256 for every primitive, while the SHA-2 sets use
 * SHA-256 (and SHA-512 at security categories 3 and 5) over a compressed
 * 22-byte address, per FIPS 205 section 11.2.
 *
 * Verified against the NIST ACVP FIPS 205 test vectors - see the `uri` on each
 * test case below for the exact source file.
 *
 * (c)2006-2025 Hawkynt
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
    root.SlhDsaShared = factory(root.AlgorithmFramework, root.OpCodes);
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // The hash functions are the entirety of this scheme's security, so they are
  // taken from the collection's own verified implementations rather than
  // restated here.
  //
  // The load is deferred to first use rather than done at module scope: the
  // documentation and README generators attribute a registration to whichever
  // file was being loaded when it happened, so requiring the hash modules here
  // would file SHA-512, SHAKE128 and SHAKE256 under this directory.
  let hashDependenciesLoaded = false;
  function LoadHashDependencies() {
    if (hashDependenciesLoaded) return;
    hashDependenciesLoaded = true;
    if (typeof require === 'undefined') return;   // browser: script tags did it
    for (const module of ['sha256', 'sha512', 'shake']) {
      try {
        require('../hash/' + module + '.js');
      } catch (e) {
        // already loaded, or a bundler without CommonJS
      }
    }
  }

  //#region ===== PARAMETER SETS =====

  // FIPS 205 Table 2. `hp` is h' (the height of one hypertree layer), `m` the
  // number of digest bytes H_msg has to produce, `a` the FORS tree height and
  // `k` the number of FORS trees.
  const PARAMETER_SETS = {
    'SLH-DSA-SHA2-128s':  { n: 16, h: 63, d: 7,  hp: 9, a: 12, k: 14, lgw: 4, m: 30, family: 'SHA2'  },
    'SLH-DSA-SHAKE-128s': { n: 16, h: 63, d: 7,  hp: 9, a: 12, k: 14, lgw: 4, m: 30, family: 'SHAKE' },
    'SLH-DSA-SHA2-128f':  { n: 16, h: 66, d: 22, hp: 3, a: 6,  k: 33, lgw: 4, m: 34, family: 'SHA2'  },
    'SLH-DSA-SHAKE-128f': { n: 16, h: 66, d: 22, hp: 3, a: 6,  k: 33, lgw: 4, m: 34, family: 'SHAKE' },
    'SLH-DSA-SHA2-192s':  { n: 24, h: 63, d: 7,  hp: 9, a: 14, k: 17, lgw: 4, m: 39, family: 'SHA2'  },
    'SLH-DSA-SHAKE-192s': { n: 24, h: 63, d: 7,  hp: 9, a: 14, k: 17, lgw: 4, m: 39, family: 'SHAKE' },
    'SLH-DSA-SHA2-192f':  { n: 24, h: 66, d: 22, hp: 3, a: 8,  k: 33, lgw: 4, m: 42, family: 'SHA2'  },
    'SLH-DSA-SHAKE-192f': { n: 24, h: 66, d: 22, hp: 3, a: 8,  k: 33, lgw: 4, m: 42, family: 'SHAKE' },
    'SLH-DSA-SHA2-256s':  { n: 32, h: 64, d: 8,  hp: 8, a: 14, k: 22, lgw: 4, m: 47, family: 'SHA2'  },
    'SLH-DSA-SHAKE-256s': { n: 32, h: 64, d: 8,  hp: 8, a: 14, k: 22, lgw: 4, m: 47, family: 'SHAKE' },
    'SLH-DSA-SHA2-256f':  { n: 32, h: 68, d: 17, hp: 4, a: 9,  k: 35, lgw: 4, m: 49, family: 'SHA2'  },
    'SLH-DSA-SHAKE-256f': { n: 32, h: 68, d: 17, hp: 4, a: 9,  k: 35, lgw: 4, m: 49, family: 'SHAKE' }
  };

  // FIPS 205 is the standardised form of the SPHINCS+ round-3 submission, and
  // the two differ in four specific places. Rather than copy the tree, WOTS+
  // and FORS code once per version, the differences are named here and the one
  // engine below reads them. Each flag is true for FIPS 205; the SPHINCS+ file
  // in this directory passes the opposite and is verified against the round-3
  // PQCsignKAT files, so both settings are held to published vectors.
  const FIPS205_PROFILE = Object.freeze({
    label: 'FIPS 205',
    // PRF(PK.seed, SK.seed, ADRS) rather than PRF(SK.seed, ADRS): the public
    // seed was mixed in so that one secret key cannot be reused across two
    // public keys. Added after round 3.
    prfBindsPublicSeed: true,
    // Secret generation got its own address types, WOTS_PRF and FORS_PRF,
    // instead of borrowing WOTS_HASH and FORS_TREE.
    separatePrfAddressTypes: true,
    // FORS indices are read by base_2b, big-endian. Round 3 gathered them bit
    // by bit, least significant bit of each byte first.
    forsIndicesBigEndian: true,
    // For the SHA-2 sets, MGF1 is seeded with R | PK.seed | inner hash. Round 3
    // seeded it with the inner hash alone; the prefix is the countermeasure
    // against the long-message second-preimage attack.
    messageDigestBindsSeed: true,
    // At security categories 3 and 5 the SHA-2 sets move H, T_l, H_msg and
    // PRF_msg up to SHA-512, so that the hash is not the weakest part. Round 3
    // used SHA-256 at every level.
    sha2WidensAtHighSecurity: true
  });

  const SPHINCS_ROUND3_PROFILE = Object.freeze({
    label: 'SPHINCS+ round 3',
    prfBindsPublicSeed: false,
    separatePrfAddressTypes: false,
    forsIndicesBigEndian: false,
    messageDigestBindsSeed: false,
    sha2WidensAtHighSecurity: false
  });

  // FIPS 205 Table 1: the seven address types.
  const ADRS_WOTS_HASH  = 0;
  const ADRS_WOTS_PK    = 1;
  const ADRS_TREE       = 2;
  const ADRS_FORS_TREE  = 3;
  const ADRS_FORS_ROOTS = 4;
  const ADRS_WOTS_PRF   = 5;
  const ADRS_FORS_PRF   = 6;

  /**
   * Derive the quantities FIPS 205 leaves implicit from a named parameter set.
   * @param {string} name - one of the twelve FIPS 205 parameter set names
   * @returns {Object} the parameter set augmented with len/len1/len2 and sizes
   */
  function DeriveParameters(name) {
    const base = PARAMETER_SETS[name];
    if (!base)
      throw new Error('Unknown SLH-DSA parameter set: ' + name);

    const p = Object.assign({}, base);
    p.name = name;
    p.w = Math.pow(2, p.lgw);
    p.len1 = Math.ceil((8 * p.n) / p.lgw);
    p.len2 = Math.floor(Math.log2(p.len1 * (p.w - 1)) / p.lgw) + 1;
    p.len = p.len1 + p.len2;
    p.publicKeyBytes = 2 * p.n;
    p.privateKeyBytes = 4 * p.n;
    p.signatureBytes = p.n * (1 + p.k * (p.a + 1) + p.d * (p.len + p.hp));
    // How H_msg's output is carved up into a FORS digest and two tree indices.
    p.mdBytes = Math.ceil((p.k * p.a) / 8);
    p.treeIdxBytes = Math.ceil((p.h - p.hp) / 8);
    p.leafIdxBytes = Math.ceil(p.hp / 8);
    return p;
  }

  //#endregion

  //#region ===== BYTE HELPERS =====

  function ByteArray(length) {
    return new Uint8Array(length);
  }

  function ToByteArray(data) {
    if (data instanceof Uint8Array) return data;
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) out[i] = data[i];
    return out;
  }

  function ToPlainArray(data) {
    const out = new Array(data.length);
    for (let i = 0; i < data.length; ++i) out[i] = data[i];
    return out;
  }

  function CopyInto(target, offset, source) {
    for (let i = 0; i < source.length; ++i) target[offset + i] = source[i];
    return offset + source.length;
  }

  function BytesEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; ++i) diff = OpCodes.OrN(diff, OpCodes.XorN(a[i], b[i]));
    return diff === 0;
  }

  /** Write a 32-bit value big-endian, without shift operators. */
  function WriteUInt32BE(target, offset, value) {
    const bytes = OpCodes.Unpack32BE(OpCodes.ToDWord(value));
    target[offset] = bytes[0];
    target[offset + 1] = bytes[1];
    target[offset + 2] = bytes[2];
    target[offset + 3] = bytes[3];
  }

  function ReadUInt32BE(source, offset) {
    return OpCodes.Pack32BE(source[offset], source[offset + 1],
                            source[offset + 2], source[offset + 3]);
  }

  //#endregion

  //#region ===== ADDRESSES (FIPS 205 section 4.2) =====

  // An address is 32 bytes: layer (4) | tree (12) | type (4) | three words (12).
  // The meaning of the last three words depends on the type, which is why
  // setTypeAndClear zeroes them - FIPS 205 is explicit that changing the type
  // discards whatever the previous type had stored there.

  function AddressNew() {
    return new Uint8Array(32);
  }

  function AddressSetLayer(adrs, layer) {
    WriteUInt32BE(adrs, 0, layer);
  }

  /**
   * Set the 12-byte tree address. The value is a BigInt because h - h' reaches
   * 63 bits, which a double cannot hold exactly.
   */
  function AddressSetTree(adrs, tree) {
    let value = BigInt(tree);
    for (let i = 15; i >= 4; --i) {
      adrs[i] = Number(value % 256n);
      value = value / 256n;
    }
  }

  function AddressSetTypeAndClear(adrs, type) {
    WriteUInt32BE(adrs, 16, type);
    for (let i = 20; i < 32; ++i) adrs[i] = 0;
  }

  function AddressSetKeyPair(adrs, value) { WriteUInt32BE(adrs, 20, value); }
  function AddressGetKeyPair(adrs) { return ReadUInt32BE(adrs, 20); }
  function AddressSetChain(adrs, value) { WriteUInt32BE(adrs, 24, value); }
  function AddressSetTreeHeight(adrs, value) { WriteUInt32BE(adrs, 24, value); }
  function AddressSetHash(adrs, value) { WriteUInt32BE(adrs, 28, value); }
  function AddressSetTreeIndex(adrs, value) { WriteUInt32BE(adrs, 28, value); }
  function AddressGetTreeIndex(adrs) { return ReadUInt32BE(adrs, 28); }

  //#endregion

  //#region ===== HASH INSTANTIATIONS (FIPS 205 section 11) =====

  function FindAlgorithm(name) {
    let found = AlgorithmFramework.Find(name);
    if (!found) {
      LoadHashDependencies();
      found = AlgorithmFramework.Find(name);
    }
    if (!found)
      throw new Error('SLH-DSA requires the ' + name + ' implementation to be loaded');
    return found;
  }

  /**
   * Build the six hash functions a parameter set needs.
   *
   * The SHAKE sets are uniform: every primitive is SHAKE256 over the
   * concatenation of its arguments. The SHA-2 sets are not - they compress the
   * address to 22 bytes, pad the seed out to a whole compression-function block
   * so the first block can be precomputed, and switch between SHA-256 and
   * SHA-512 depending on both the security category and which primitive it is.
   */
  function BuildHashFunctions(p, profile) {
    const n = p.n;

    if (p.family === 'SHAKE') {
      const shakeAlgorithm = FindAlgorithm('SHAKE256');
      const shake = function(parts, outputLength) {
        const instance = shakeAlgorithm.CreateInstance();
        instance.outputSize = outputLength;
        for (let i = 0; i < parts.length; ++i) instance.Feed(parts[i]);
        return ToByteArray(instance.Result());
      };
      return {
        PRFmsg: (skPrf, optRand, message) => shake([skPrf, optRand, message], n),
        Hmsg:   (r, pkSeed, pkRoot, message) => shake([r, pkSeed, pkRoot, message], p.m),
        PRF:    (pkSeed, skSeed, adrs) => profile.prfBindsPublicSeed
          ? shake([pkSeed, adrs, skSeed], n)
          : shake([skSeed, adrs], n),
        F:      (pkSeed, adrs, m1) => shake([pkSeed, adrs, m1], n),
        H:      (pkSeed, adrs, m2) => shake([pkSeed, adrs, m2], n),
        T:      (pkSeed, adrs, ml) => shake([pkSeed, adrs, ml], n)
      };
    }

    const sha256Algorithm = FindAlgorithm('SHA-256');
    const sha512Algorithm = FindAlgorithm('SHA-512');

    const digest = function(algorithm, parts) {
      const instance = algorithm.CreateInstance();
      for (let i = 0; i < parts.length; ++i) instance.Feed(parts[i]);
      return instance.Result();
    };
    const sha256 = parts => digest(sha256Algorithm, parts);
    const sha512 = parts => digest(sha512Algorithm, parts);

    // Security category 1 stays on SHA-256 throughout; categories 3 and 5 move
    // H, T_l, H_msg and PRF_msg to SHA-512 but keep F and PRF on SHA-256.
    const isCategory1 = profile.sha2WidensAtHighSecurity ? (n === 16) : true;
    const wide = isCategory1 ? sha256 : sha512;
    const wideLength = isCategory1 ? 32 : 64;
    const wideBlock = isCategory1 ? 64 : 128;

    // toByte(0, 64-n) and toByte(0, 128-n): padding that pushes the address to
    // a block boundary so the seed block can be precomputed by implementations
    // that care to.
    const narrowPad = ByteArray(64 - n);
    const widePad = ByteArray(wideBlock - n);

    // The compressed address of FIPS 205 section 11.2: the low byte of the
    // layer, the low 8 bytes of the tree address, the low byte of the type,
    // and the three type-dependent words.
    const compressed = ByteArray(22);
    const compress = function(adrs) {
      compressed[0] = adrs[3];
      for (let i = 0; i < 8; ++i) compressed[1 + i] = adrs[8 + i];
      compressed[9] = adrs[19];
      for (let i = 0; i < 12; ++i) compressed[10 + i] = adrs[20 + i];
      return compressed;
    };

    const truncate = function(bytes) {
      const out = ByteArray(n);
      for (let i = 0; i < n; ++i) out[i] = bytes[i];
      return out;
    };

    // HMAC is needed only by PRF_msg, once per signature, so it is spelled out
    // here rather than pulling in another algorithm for a single call site.
    const hmac = function(hashFn, blockLength, key, message) {
      let normalised = key;
      if (normalised.length > blockLength) normalised = ToByteArray(hashFn([normalised]));
      const inner = ByteArray(blockLength);
      const outer = ByteArray(blockLength);
      for (let i = 0; i < blockLength; ++i) {
        const keyByte = i < normalised.length ? normalised[i] : 0;
        inner[i] = OpCodes.XorN(keyByte, 0x36);
        outer[i] = OpCodes.XorN(keyByte, 0x5C);
      }
      const innerDigest = hashFn([inner, message]);
      return hashFn([outer, innerDigest]);
    };

    // MGF1 (RFC 8017 appendix B.2.1) expands the message digest to m bytes.
    const mgf1 = function(hashFn, hashLength, seedParts, outputLength) {
      const out = ByteArray(outputLength);
      const counter = ByteArray(4);
      let produced = 0;
      for (let i = 0; produced < outputLength; ++i) {
        WriteUInt32BE(counter, 0, i);
        const block = hashFn(seedParts.concat([counter]));
        for (let j = 0; j < hashLength && produced < outputLength; ++j)
          out[produced++] = block[j];
      }
      return out;
    };

    return {
      PRFmsg: (skPrf, optRand, message) => {
        const parts = ByteArray(optRand.length + message.length);
        CopyInto(parts, CopyInto(parts, 0, optRand), message);
        return truncate(hmac(wide, wideBlock, skPrf, parts));
      },
      Hmsg: (r, pkSeed, pkRoot, message) => {
        const inner = wide([r, pkSeed, pkRoot, message]);
        const seed = profile.messageDigestBindsSeed ? [r, pkSeed, inner] : [inner];
        return mgf1(wide, wideLength, seed, p.m);
      },
      PRF: (pkSeed, skSeed, adrs) => profile.prfBindsPublicSeed
        ? truncate(sha256([pkSeed, narrowPad, compress(adrs), skSeed]))
        : truncate(sha256([skSeed, compress(adrs)])),
      F: (pkSeed, adrs, m1) =>
        truncate(sha256([pkSeed, narrowPad, compress(adrs), m1])),
      H: (pkSeed, adrs, m2) =>
        truncate(wide([pkSeed, widePad, compress(adrs), m2])),
      T: (pkSeed, adrs, ml) =>
        truncate(wide([pkSeed, widePad, compress(adrs), ml]))
    };
  }

  //#endregion

  //#region ===== ENGINE =====

  /**
   * base_2b, FIPS 205 Algorithm 4: read `outputLength` big-endian b-bit digits
   * out of a byte string. Done with arithmetic rather than shifts because b can
   * be up to 14 and the accumulator would otherwise need masking at each step.
   */
  function BaseTwoB(input, b, outputLength) {
    const out = new Array(outputLength);
    const radix = Math.pow(2, b);
    let position = 0, total = 0, bits = 0;
    for (let i = 0; i < outputLength; ++i) {
      while (bits < b) {
        total = total * 256 + input[position++];
        bits += 8;
      }
      bits -= b;
      const divisor = Math.pow(2, bits);
      out[i] = Math.floor(total / divisor) % radix;
      total = total % divisor;
    }
    return out;
  }

  /** The sibling index at height j of the path from leaf `index`. */
  function SiblingIndex(index, j) {
    return OpCodes.XorN(Math.floor(index / Math.pow(2, j)), 1);
  }

  class SlhDsaEngine {
    /**
     * @param {string|Object} parameterSet - a FIPS 205 parameter set name, or
     *   an already-derived parameter object for a caller with its own table
     * @param {Object} [profile] - which of the two constructions to build;
     *   FIPS 205 by default
     */
    constructor(parameterSet, profile) {
      this.profile = profile || FIPS205_PROFILE;
      this.params = typeof parameterSet === 'string'
        ? DeriveParameters(parameterSet)
        : parameterSet;
      this.hash = BuildHashFunctions(this.params, this.profile);
    }

    /** The address type under which WOTS+ secret keys are derived. */
    _wotsSecretType() {
      return this.profile.separatePrfAddressTypes ? ADRS_WOTS_PRF : ADRS_WOTS_HASH;
    }

    /** The address type under which FORS secret keys are derived. */
    _forsSecretType() {
      return this.profile.separatePrfAddressTypes ? ADRS_FORS_PRF : ADRS_FORS_TREE;
    }

    /**
     * The k FORS tree indices carved out of the message digest. FIPS 205 reads
     * them big-endian with base_2b; the round-3 submission walked the digest a
     * bit at a time, taking the least significant bit of each byte first.
     */
    _forsIndices(messageDigest) {
      const p = this.params;
      if (this.profile.forsIndicesBigEndian)
        return BaseTwoB(messageDigest, p.a, p.k);

      const out = new Array(p.k);
      let offset = 0;
      for (let i = 0; i < p.k; ++i) {
        let value = 0;
        for (let j = 0; j < p.a; ++j) {
          const byte = messageDigest[Math.floor(offset / 8)];
          const bit = Math.floor(byte / Math.pow(2, offset % 8)) % 2;
          value += bit * Math.pow(2, j);
          ++offset;
        }
        out[i] = value;
      }
      return out;
    }

    //#region --- WOTS+ (FIPS 205 section 5) ---

    /** Algorithm 5: apply F to `x` for `steps` iterations starting at `start`. */
    _chain(x, start, steps, pkSeed, adrs) {
      let value = x;
      const end = start + steps;
      for (let j = start; j < end; ++j) {
        AddressSetHash(adrs, j);
        value = this.hash.F(pkSeed, adrs, value);
      }
      return value;
    }

    /**
     * Algorithm 7 step 1-6: the message nibbles followed by the checksum
     * nibbles. The checksum is what stops an attacker walking a chain further
     * than the signer did: raising one nibble always lowers the checksum.
     */
    _wotsMessage(message) {
      const p = this.params;
      const digits = BaseTwoB(message, p.lgw, p.len1);
      let checksum = 0;
      for (let i = 0; i < p.len1; ++i) checksum += p.w - 1 - digits[i];
      // csum << ((8 - ((len2 * lgw) mod 8)) mod 8), left-aligned in its bytes
      const shift = (8 - ((p.len2 * p.lgw) % 8)) % 8;
      checksum = checksum * Math.pow(2, shift);
      const width = Math.ceil((p.len2 * p.lgw) / 8);
      const encoded = ByteArray(width);
      for (let i = width - 1; i >= 0; --i) {
        encoded[i] = checksum % 256;
        checksum = Math.floor(checksum / 256);
      }
      return digits.concat(BaseTwoB(encoded, p.lgw, p.len2));
    }

    /** The WOTS+ secret key for chain `i`, derived from SK.seed. */
    _wotsSecret(skSeed, pkSeed, skAdrs, i) {
      AddressSetChain(skAdrs, i);
      return this.hash.PRF(pkSeed, skSeed, skAdrs);
    }

    _wotsPrfAddress(adrs) {
      const skAdrs = new Uint8Array(adrs);
      AddressSetTypeAndClear(skAdrs, this._wotsSecretType());
      AddressSetKeyPair(skAdrs, AddressGetKeyPair(adrs));
      return skAdrs;
    }

    _wotsPublicAddress(adrs) {
      const pkAdrs = new Uint8Array(adrs);
      AddressSetTypeAndClear(pkAdrs, ADRS_WOTS_PK);
      AddressSetKeyPair(pkAdrs, AddressGetKeyPair(adrs));
      return pkAdrs;
    }

    /** Algorithm 6: the WOTS+ public key, each chain walked to the top. */
    _wotsPkGen(skSeed, pkSeed, adrs) {
      const p = this.params;
      const skAdrs = this._wotsPrfAddress(adrs);
      const tmp = ByteArray(p.len * p.n);
      for (let i = 0; i < p.len; ++i) {
        const secret = this._wotsSecret(skSeed, pkSeed, skAdrs, i);
        AddressSetChain(adrs, i);
        CopyInto(tmp, i * p.n, this._chain(secret, 0, p.w - 1, pkSeed, adrs));
      }
      return this.hash.T(pkSeed, this._wotsPublicAddress(adrs), tmp);
    }

    /** Algorithm 7: walk each chain only as far as its message nibble. */
    _wotsSign(message, skSeed, pkSeed, adrs) {
      const p = this.params;
      const digits = this._wotsMessage(message);
      const skAdrs = this._wotsPrfAddress(adrs);
      const signature = ByteArray(p.len * p.n);
      for (let i = 0; i < p.len; ++i) {
        const secret = this._wotsSecret(skSeed, pkSeed, skAdrs, i);
        AddressSetChain(adrs, i);
        CopyInto(signature, i * p.n, this._chain(secret, 0, digits[i], pkSeed, adrs));
      }
      return signature;
    }

    /** Algorithm 8: finish each chain from where the signature left off. */
    _wotsPkFromSig(signature, message, pkSeed, adrs) {
      const p = this.params;
      const digits = this._wotsMessage(message);
      const tmp = ByteArray(p.len * p.n);
      for (let i = 0; i < p.len; ++i) {
        AddressSetChain(adrs, i);
        const part = signature.subarray(i * p.n, (i + 1) * p.n);
        CopyInto(tmp, i * p.n,
          this._chain(part, digits[i], p.w - 1 - digits[i], pkSeed, adrs));
      }
      return this.hash.T(pkSeed, this._wotsPublicAddress(adrs), tmp);
    }

    //#endregion

    //#region --- XMSS (FIPS 205 section 6) ---

    /**
     * Algorithm 9: the node at height `z`, index `i`. Written iteratively over
     * an explicit stack: the recursive form in the specification would recurse
     * 2^h' deep for the tall parameter sets while building a whole subtree.
     */
    _xmssNode(skSeed, targetIndex, targetHeight, pkSeed, adrs) {
      const p = this.params;
      if (targetHeight === 0) {
        AddressSetTypeAndClear(adrs, ADRS_WOTS_HASH);
        AddressSetKeyPair(adrs, targetIndex);
        return this._wotsPkGen(skSeed, pkSeed, adrs);
      }

      // Walk the leaves of the requested subtree left to right, combining
      // finished pairs off a stack. Each stack entry is a node plus its height.
      const stack = [];
      const first = targetIndex * Math.pow(2, targetHeight);
      const count = Math.pow(2, targetHeight);
      for (let offset = 0; offset < count; ++offset) {
        AddressSetTypeAndClear(adrs, ADRS_WOTS_HASH);
        AddressSetKeyPair(adrs, first + offset);
        let node = this._wotsPkGen(skSeed, pkSeed, adrs);
        let height = 0;
        let index = first + offset;
        while (stack.length > 0 && stack[stack.length - 1].height === height) {
          const left = stack.pop();
          index = Math.floor(index / 2);
          height += 1;
          AddressSetTypeAndClear(adrs, ADRS_TREE);
          AddressSetTreeHeight(adrs, height);
          AddressSetTreeIndex(adrs, index);
          const pair = ByteArray(2 * p.n);
          CopyInto(pair, CopyInto(pair, 0, left.node), node);
          node = this.hash.H(pkSeed, adrs, pair);
        }
        stack.push({ node: node, height: height });
      }
      return stack[0].node;
    }

    /** Algorithm 10: a WOTS+ signature plus the authentication path. */
    _xmssSign(message, skSeed, index, pkSeed, adrs) {
      const p = this.params;
      const auth = ByteArray(p.hp * p.n);
      for (let j = 0; j < p.hp; ++j)
        CopyInto(auth, j * p.n,
          this._xmssNode(skSeed, SiblingIndex(index, j), j, pkSeed, adrs));

      AddressSetTypeAndClear(adrs, ADRS_WOTS_HASH);
      AddressSetKeyPair(adrs, index);
      const wots = this._wotsSign(message, skSeed, pkSeed, adrs);

      const out = ByteArray(wots.length + auth.length);
      CopyInto(out, CopyInto(out, 0, wots), auth);
      return out;
    }

    /** Algorithm 11: recompute the root this signature and path imply. */
    _xmssPkFromSig(index, xmssSignature, message, pkSeed, adrs) {
      const p = this.params;
      AddressSetTypeAndClear(adrs, ADRS_WOTS_HASH);
      AddressSetKeyPair(adrs, index);

      const wots = xmssSignature.subarray(0, p.len * p.n);
      const auth = xmssSignature.subarray(p.len * p.n);
      let node = this._wotsPkFromSig(wots, message, pkSeed, adrs);

      AddressSetTypeAndClear(adrs, ADRS_TREE);
      AddressSetTreeIndex(adrs, index);
      const pair = ByteArray(2 * p.n);
      for (let j = 0; j < p.hp; ++j) {
        AddressSetTreeHeight(adrs, j + 1);
        const sibling = auth.subarray(j * p.n, (j + 1) * p.n);
        if (Math.floor(index / Math.pow(2, j)) % 2 === 0) {
          AddressSetTreeIndex(adrs, Math.floor(AddressGetTreeIndex(adrs) / 2));
          CopyInto(pair, CopyInto(pair, 0, node), sibling);
        } else {
          AddressSetTreeIndex(adrs, Math.floor((AddressGetTreeIndex(adrs) - 1) / 2));
          CopyInto(pair, CopyInto(pair, 0, sibling), node);
        }
        node = this.hash.H(pkSeed, adrs, pair);
      }
      return node;
    }

    //#endregion

    //#region --- Hypertree (FIPS 205 section 7) ---

    /** Algorithm 12: sign `message` at the bottom, then each root upwards. */
    _htSign(message, skSeed, pkSeed, idxTree, idxLeaf) {
      const p = this.params;
      const adrs = AddressNew();
      const layerSize = (p.hp + p.len) * p.n;
      const out = ByteArray(p.d * layerSize);

      AddressSetTree(adrs, idxTree);
      AddressSetLayer(adrs, 0);
      let layerSignature = this._xmssSign(message, skSeed, idxLeaf, pkSeed, adrs);
      CopyInto(out, 0, layerSignature);
      let root = this._xmssPkFromSig(idxLeaf, layerSignature, message, pkSeed, adrs);

      let tree = BigInt(idxTree);
      const divisor = BigInt(Math.pow(2, p.hp));
      for (let layer = 1; layer < p.d; ++layer) {
        const leaf = Number(tree % divisor);
        tree = tree / divisor;
        AddressSetLayer(adrs, layer);
        AddressSetTree(adrs, tree);
        layerSignature = this._xmssSign(root, skSeed, leaf, pkSeed, adrs);
        CopyInto(out, layer * layerSize, layerSignature);
        if (layer < p.d - 1)
          root = this._xmssPkFromSig(leaf, layerSignature, root, pkSeed, adrs);
      }
      return out;
    }

    /** Algorithm 13: climb the layers and compare against the public root. */
    _htVerify(message, htSignature, pkSeed, idxTree, idxLeaf, pkRoot) {
      const p = this.params;
      const adrs = AddressNew();
      const layerSize = (p.hp + p.len) * p.n;

      AddressSetTree(adrs, idxTree);
      AddressSetLayer(adrs, 0);
      let node = this._xmssPkFromSig(idxLeaf, htSignature.subarray(0, layerSize),
                                     message, pkSeed, adrs);

      let tree = BigInt(idxTree);
      const divisor = BigInt(Math.pow(2, p.hp));
      for (let layer = 1; layer < p.d; ++layer) {
        const leaf = Number(tree % divisor);
        tree = tree / divisor;
        AddressSetLayer(adrs, layer);
        AddressSetTree(adrs, tree);
        node = this._xmssPkFromSig(leaf,
          htSignature.subarray(layer * layerSize, (layer + 1) * layerSize),
          node, pkSeed, adrs);
      }
      return BytesEqual(node, pkRoot);
    }

    //#endregion

    //#region --- FORS (FIPS 205 section 8) ---

    /** Algorithm 14. */
    _forsSecret(skSeed, pkSeed, adrs, index) {
      const skAdrs = new Uint8Array(adrs);
      AddressSetTypeAndClear(skAdrs, this._forsSecretType());
      AddressSetKeyPair(skAdrs, AddressGetKeyPair(adrs));
      AddressSetTreeIndex(skAdrs, index);
      return this.hash.PRF(pkSeed, skSeed, skAdrs);
    }

    /**
     * Algorithm 15, iterative for the same reason as _xmssNode: a FORS tree is
     * 2^a leaves and `a` reaches 14.
     */
    _forsNode(skSeed, targetIndex, targetHeight, pkSeed, adrs) {
      const p = this.params;
      if (targetHeight === 0) {
        const secret = this._forsSecret(skSeed, pkSeed, adrs, targetIndex);
        AddressSetTreeHeight(adrs, 0);
        AddressSetTreeIndex(adrs, targetIndex);
        return this.hash.F(pkSeed, adrs, secret);
      }

      const stack = [];
      const first = targetIndex * Math.pow(2, targetHeight);
      const count = Math.pow(2, targetHeight);
      for (let offset = 0; offset < count; ++offset) {
        const secret = this._forsSecret(skSeed, pkSeed, adrs, first + offset);
        AddressSetTreeHeight(adrs, 0);
        AddressSetTreeIndex(adrs, first + offset);
        let node = this.hash.F(pkSeed, adrs, secret);
        let height = 0;
        let index = first + offset;
        while (stack.length > 0 && stack[stack.length - 1].height === height) {
          const left = stack.pop();
          index = Math.floor(index / 2);
          height += 1;
          AddressSetTreeHeight(adrs, height);
          AddressSetTreeIndex(adrs, index);
          const pair = ByteArray(2 * p.n);
          CopyInto(pair, CopyInto(pair, 0, left.node), node);
          node = this.hash.H(pkSeed, adrs, pair);
        }
        stack.push({ node: node, height: height });
      }
      return stack[0].node;
    }

    /** Algorithm 16: for each of the k trees, one secret and its path. */
    _forsSign(messageDigest, skSeed, pkSeed, adrs) {
      const p = this.params;
      const indices = this._forsIndices(messageDigest);
      const stride = (p.a + 1) * p.n;
      const out = ByteArray(p.k * stride);
      const treeSize = Math.pow(2, p.a);

      for (let i = 0; i < p.k; ++i) {
        const base = i * stride;
        CopyInto(out, base,
          this._forsSecret(skSeed, pkSeed, adrs, i * treeSize + indices[i]));
        for (let j = 0; j < p.a; ++j) {
          const sibling = SiblingIndex(indices[i], j);
          CopyInto(out, base + (j + 1) * p.n,
            this._forsNode(skSeed, i * Math.pow(2, p.a - j) + sibling, j, pkSeed, adrs));
        }
      }
      return out;
    }

    /** Algorithm 17: rebuild the k roots and hash them into the FORS key. */
    _forsPkFromSig(forsSignature, messageDigest, pkSeed, adrs) {
      const p = this.params;
      const indices = this._forsIndices(messageDigest);
      const stride = (p.a + 1) * p.n;
      const roots = ByteArray(p.k * p.n);
      const treeSize = Math.pow(2, p.a);
      const pair = ByteArray(2 * p.n);

      for (let i = 0; i < p.k; ++i) {
        const base = i * stride;
        const secret = forsSignature.subarray(base, base + p.n);
        AddressSetTreeHeight(adrs, 0);
        AddressSetTreeIndex(adrs, i * treeSize + indices[i]);
        let node = this.hash.F(pkSeed, adrs, secret);

        for (let j = 0; j < p.a; ++j) {
          const sibling = forsSignature.subarray(base + (j + 1) * p.n, base + (j + 2) * p.n);
          AddressSetTreeHeight(adrs, j + 1);
          if (Math.floor(indices[i] / Math.pow(2, j)) % 2 === 0) {
            AddressSetTreeIndex(adrs, Math.floor(AddressGetTreeIndex(adrs) / 2));
            CopyInto(pair, CopyInto(pair, 0, node), sibling);
          } else {
            AddressSetTreeIndex(adrs, Math.floor((AddressGetTreeIndex(adrs) - 1) / 2));
            CopyInto(pair, CopyInto(pair, 0, sibling), node);
          }
          node = this.hash.H(pkSeed, adrs, pair);
        }
        CopyInto(roots, i * p.n, node);
      }

      const pkAdrs = new Uint8Array(adrs);
      AddressSetTypeAndClear(pkAdrs, ADRS_FORS_ROOTS);
      AddressSetKeyPair(pkAdrs, AddressGetKeyPair(adrs));
      return this.hash.T(pkSeed, pkAdrs, roots);
    }

    //#endregion

    //#region --- Top level (FIPS 205 section 9-10) ---

    /**
     * Algorithm 18: the public root is the top hypertree layer's XMSS root.
     * @param {Uint8Array} skSeed - n bytes, the WOTS+/FORS secret source
     * @param {Uint8Array} skPrf - n bytes, the message randomiser key
     * @param {Uint8Array} pkSeed - n bytes, the public hash seed
     */
    KeyGen(skSeed, skPrf, pkSeed) {
      const p = this.params;
      const adrs = AddressNew();
      AddressSetLayer(adrs, p.d - 1);
      const pkRoot = this._xmssNode(skSeed, 0, p.hp, pkSeed, adrs);

      const publicKey = ByteArray(p.publicKeyBytes);
      CopyInto(publicKey, CopyInto(publicKey, 0, pkSeed), pkRoot);
      const privateKey = ByteArray(p.privateKeyBytes);
      let at = CopyInto(privateKey, 0, skSeed);
      at = CopyInto(privateKey, at, skPrf);
      at = CopyInto(privateKey, at, pkSeed);
      CopyInto(privateKey, at, pkRoot);

      return { privateKey: privateKey, publicKey: publicKey };
    }

    /**
     * Split H_msg's output into the FORS digest and the two tree indices, per
     * FIPS 205 Algorithm 19 steps 6-9.
     */
    _splitDigest(digest) {
      const p = this.params;
      const md = digest.subarray(0, p.mdBytes);
      const treeEnd = p.mdBytes + p.treeIdxBytes;

      let idxTree = 0n;
      for (let i = p.mdBytes; i < treeEnd; ++i) idxTree = idxTree * 256n + BigInt(digest[i]);
      idxTree = idxTree % (2n ** BigInt(p.h - p.hp));

      let idxLeaf = 0;
      for (let i = treeEnd; i < treeEnd + p.leafIdxBytes; ++i) idxLeaf = idxLeaf * 256 + digest[i];
      idxLeaf = idxLeaf % Math.pow(2, p.hp);

      return { md: md, idxTree: idxTree, idxLeaf: idxLeaf };
    }

    /**
     * Algorithm 19, slh_sign_internal.
     * @param {Uint8Array} message - the message, already prefixed if the caller
     *   is using the external interface
     * @param {Uint8Array} privateKey - SK.seed | SK.prf | PK.seed | PK.root
     * @param {Uint8Array} [optRand] - the randomiser; PK.seed when omitted,
     *   which is the deterministic variant the test vectors use
     */
    SignInternal(message, privateKey, optRand) {
      const p = this.params, n = p.n;
      if (privateKey.length !== p.privateKeyBytes)
        throw new Error('SLH-DSA private key must be ' + p.privateKeyBytes + ' bytes for ' + p.name);

      const skSeed = privateKey.subarray(0, n);
      const skPrf = privateKey.subarray(n, 2 * n);
      const pkSeed = privateKey.subarray(2 * n, 3 * n);
      const pkRoot = privateKey.subarray(3 * n, 4 * n);
      const randomiser = optRand || pkSeed;

      const r = this.hash.PRFmsg(skPrf, randomiser, message);
      const digest = this.hash.Hmsg(r, pkSeed, pkRoot, message);
      const split = this._splitDigest(digest);

      const adrs = AddressNew();
      AddressSetTree(adrs, split.idxTree);
      AddressSetTypeAndClear(adrs, ADRS_FORS_TREE);
      AddressSetKeyPair(adrs, split.idxLeaf);

      const forsSignature = this._forsSign(split.md, skSeed, pkSeed, adrs);
      const forsPublicKey = this._forsPkFromSig(forsSignature, split.md, pkSeed, adrs);
      const htSignature = this._htSign(forsPublicKey, skSeed, pkSeed, split.idxTree, split.idxLeaf);

      const signature = ByteArray(p.signatureBytes);
      let at = CopyInto(signature, 0, r);
      at = CopyInto(signature, at, forsSignature);
      CopyInto(signature, at, htSignature);
      return signature;
    }

    /**
     * Algorithm 20, slh_verify_internal.
     * @returns {boolean} whether the signature is valid under `publicKey`
     */
    VerifyInternal(message, signature, publicKey) {
      const p = this.params, n = p.n;
      if (signature.length !== p.signatureBytes) return false;
      if (publicKey.length !== p.publicKeyBytes) return false;

      const pkSeed = publicKey.subarray(0, n);
      const pkRoot = publicKey.subarray(n, 2 * n);
      const r = signature.subarray(0, n);
      const forsLength = p.k * (p.a + 1) * n;
      const forsSignature = signature.subarray(n, n + forsLength);
      const htSignature = signature.subarray(n + forsLength);

      const digest = this.hash.Hmsg(r, pkSeed, pkRoot, message);
      const split = this._splitDigest(digest);

      const adrs = AddressNew();
      AddressSetTree(adrs, split.idxTree);
      AddressSetTypeAndClear(adrs, ADRS_FORS_TREE);
      AddressSetKeyPair(adrs, split.idxLeaf);

      const forsPublicKey = this._forsPkFromSig(forsSignature, split.md, pkSeed, adrs);
      return this._htVerify(forsPublicKey, htSignature, pkSeed, split.idxTree, split.idxLeaf, pkRoot);
    }

    /**
     * FIPS 205 section 10.2: the external interface binds a context string into
     * the message, so a signature made for one context cannot be replayed in
     * another. `slh_sign` is this prefix followed by slh_sign_internal.
     */
    _prefixMessage(message, context) {
      const ctx = context || ByteArray(0);
      if (ctx.length > 255)
        throw new Error('SLH-DSA context string is limited to 255 bytes');
      const out = ByteArray(2 + ctx.length + message.length);
      out[0] = 0;
      out[1] = ctx.length;
      CopyInto(out, CopyInto(out, 2, ctx), message);
      return out;
    }

    /** Algorithm 22, slh_sign, over the pure (non pre-hashed) interface. */
    Sign(message, privateKey, context, optRand) {
      return this.SignInternal(this._prefixMessage(message, context), privateKey, optRand);
    }

    /** Algorithm 24, slh_verify, over the pure interface. */
    Verify(message, signature, publicKey, context) {
      return this.VerifyInternal(this._prefixMessage(message, context), signature, publicKey);
    }

    //#endregion
  }

  //#endregion

  //#region ===== ALGORITHM =====

  class SlhDsaAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = "SLH-DSA";
      this.description = "NIST FIPS 205 stateless hash-based signature scheme, the standardised form of SPHINCS+. Signs with a hypertree of WOTS+ one-time keys over a FORS few-time signature, so its security reduces to the hash function alone rather than to any algebraic assumption. All twelve parameter sets are implemented over both the SHA-2 and SHAKE instantiations.";
      this.inventor = "Daniel J. Bernstein, Andreas Hülsing, Stefan Kölbl, Ruben Niederhagen, Joost Rijneveld, Peter Schwabe";
      this.year = 2024;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Post-Quantum Signature";
      this.securityStatus = null;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTERNATIONAL;

      this.SupportedKeySizes = [
        new KeySize(64, 64, 1),    // n=16 parameter sets: 4n-byte private key
        new KeySize(96, 96, 1),    // n=24
        new KeySize(128, 128, 1)   // n=32
      ];

      this.documentation = [
        new LinkItem("FIPS 205: Stateless Hash-Based Digital Signature Standard", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf"),
        new LinkItem("NIST FIPS 205 publication record", "https://csrc.nist.gov/pubs/fips/205/final"),
        new LinkItem("SPHINCS+ project site", "https://sphincs.org/")
      ];

      this.references = [
        new LinkItem("NIST ACVP SLH-DSA test vectors", "https://github.com/usnistgov/ACVP-Server/tree/master/gen-val/json-files"),
        new LinkItem("SPHINCS+ submission to the NIST PQC project", "https://csrc.nist.gov/Projects/post-quantum-cryptography/post-quantum-cryptography-standardization/round-3-submissions")
      ];

      this.tests = SlhDsaAlgorithm._buildTests();
    }

    static _buildTests() {
      // Every byte string below is copied from the NIST ACVP FIPS 205 vector
      // files named in each `uri`. Signatures run to kilobytes, so the three
      // signing vectors are named once here and the verification cases are
      // built from them rather than repeating them.
      const SHA2_128F = {"sk":"53725A3C2B994D52DDBA83EC584DE28BB56FD81661F82B2AE2100517BF14B21520FF7C085298B7313788A15A6EEDAC2FE846BD0C772AA74975B45FFC49B4F678","pk":"20FF7C085298B7313788A15A6EEDAC2FE846BD0C772AA74975B45FFC49B4F678","msg":"6D","tc":115};
      const SHA2_128F_SIG = "42A4AA49A6C6A324B1E6E08F3C77C605899C4A45509EBAE96F459F2DD1D3CACD7627CA3F3FA805C174E867514DE85F33EB70E85564BCC073AEDB042154D24CC4F97C65C8267E4A5C3D4B1F493539C234840106BFAB576039241D97F21FDBF202C488D1AD3118B73660F4D2411E54684E05A33BAAE1FC74307600A90FF64B68DC4DC1BF6CA88E2AA1B8E7A521CE39ACC0C73F1E7817E5C69D5FCAC0B3E5CB5A852253A7B78DC00F617320977DC5638E6F5F509015E307B60A0DE2289C12484A1757314175E6CC8FD3D26D2277DA18D6B064F4D0BE541F3136359F1BAC6AC55F4CC73339DC7DB4A7F2EF92270E95E1812D4407EC5E3FAA5617513AEDFD6CC348B0344284C9C9D3693ACFF5877651D92415C806DD68EC8428BC87E7C8297D0FCCF5BCEAB75644840F01F77152CA0E38D00C6A6A639CCF65C368CA54667B6F7DCD15212CFF71B0105EB23A2EDA68D5683BBAA7E1A5040412F2AEF0A001CF1B999743E76024709F277FC8B241CD880287C812E5007FD3B085D9056C87F73B52EC1B168EAA099EF8DB4D7EA6D92666D8B4234F3385B0B650210BEFDCF26026BC6FF313570C9DC14789B1F7B16E4C6D0E95C9DA7E4A91D8B126A59593170C1656D957F1DACED4BF064694BF536170F49397E1A2F6B320A178EDD94B2B305A7269E0B95EDC22EDDF170B5D3148E7113FA585639ACA4364252EDD75B4BDCF6C99EF3BAD98291F7D33960E381F5785F5FB8DDF16DCBD24D81B92E49AE747434AB55F3E621C5D19A43069D8BCEBC6CD3D3F82DAEE62C1FF185AC822D42307F4716BC1825652CCCE7D00BC1DB7F4933BA2C077B85598104875AC0440BE203BE646BB572EA9EA649B746C0366498580493C8248015B385EE1A610A3C426C4C941069DBF77CBD5479EDEB277E3DAE0B81619A9C2131EC3AFC6AA1CA1F6DE45D5A59E94A6C7BFF8A6C13D3CA922A5BB2CD93D96BABCE28834D2F2781A4B739E73943087850C23B8DD37630012A7F8EE571DEA8787FE4A744281FD23EB8192A93D869467FC507F35598BA65E1E2400E7B5929E1DF2C9030255A594F72A6236587B61562188CF6B9497A11CADC06206FE7967E35C780B4F94469DB7308369E6DB7A140BF81B412BB77670CD22B3990122AB36980C52CDC3159147DCFB76099A30D4D4DE257F719A447953AFF266ED32D9649E67237B109D73A718E628E93B36A48C550A42AF6ED051B804BA08C251DA2E179048FC1F459105BB7D49BBF4EBA06BD164E492ACC9015654E18D75CF8DCEC9832D229503E0E499CC6F85DD11AD9D138F458AF83BEA969702B54531902222D98F66B5DD1E6B87300697436ED0512F208F4C620ED1696A0C79A02D77584E8C47CA30485347604AB207A7DD9D877F88667C25797423284CB991B754A68801C11D0BC21EC8B296F1A755F3CE9DEA7AB2AF0955AEA9C3DBA1018C7863218568173F167666E484B050D52913C28B98FC5C46CB0C9088EFBBEAC10CE2B8046CE2F4411A0F91CB7B87EED0EE8D750064DE6E6EA1E9BBA06846D361C8D88F7C4F113E782DFFCD41A4DDA20430020312F050003458337548D628DB6E910D7D6690CC5E16396034BA19723CE867313685BC8AA3CF5DE4A060D30D3B79D4CC4467B4D553BD1E82D6614AC56D1D124F06BE5F7655FC6822812AAE9515228F013D313D7E3128A1B96AE54B453651EC71E9A0DAE80E3AD97138D34DFA705199DF5F479AF2FE1CFECAEA9B140B28B5D5142D46BBDFD48673391FCD5956676FFAAD114711720B0CC28801AE360C02BB017DBF7E5829932D3B6B6E5E76F6C949D088380C18122766713744ABCBD11C0C072C0744423162B221C29B9220D6D8C9AC50CC575E7C1D6FAA0B6CFD95EF15170FBB0B84FCB75E778AF45C9A2A7FC36020187D22F70C3A8128CAEED0C7AB3264EE4D8917B3BF6026BA98839F15DB29AF34E077082AA7492F3A032232942D75CB2E0821BFAB6A2FD6C7755A7A8FB3A64B03BF7E2F31FB56D0C59459586284937020D0C170465381C128BAC4D5C8AECD74E4FE9B6FE24F8932591967119CF07101BF46CF466C4DD9E6AA1F0EA3E28EE997F8D9EC82C6E56AA835758723DEFF637C2AAA4A16899CBB49A2946AA04A0B07B47C63D8CFE68AC65DF902A22FAF1511EF06960DFDAF110CBFE4270EE1CD7BA8C17EE09615694DF2E56E47C4B49FB2E474F03A3C902B55F6F63E53FEF5F4B27AC602B3A40B2BCFEE3DCB0CD06BE561363745DAB1165D905B37F083B13DDB1D507B6C01E6280668EB5E7D8FFC07CF6DE8EC00E19AC93F640B35D6F8B48A01F57D0AD4A957F7D929232DF0977260A312EA85E4A2AB479104B557D8361DFBA9A46271280A23E4F3AB0B0F23A605229E9905F446C1FE951082CC8AC3A8EFF4FAF22F76CAC14A987D4B27B7AD740D31360A058A19183EC56B43498D3E45DEB35D94C61875AB2AC4D103FFEF87028792186FFC72BFABA2A553439586D633AF9D4A125ED578F9797A378956BFF313FF01C891F2CEF057DB4F0A247BDB460D8CCD645CD683C1560A2C562AD2F2B4411D2F7215D23466D4F7221C10876C606CE289F98C1BF68D0C11DFBF089DA2C13F0BEB2753C979365B54446283F9971A9739B42F3F06C033AF54607BC56D29978C10D752D614B4DEF20AE2A140BEA44A111042832075ECA956D45B10BF5369B0F8BEED3B49FFE129879E963E5CC086875D2D347877522ECA96CAB49041EA3C74E8E1BC0A4753DEA2EE754995BBBEB933484B02A60A8F5DA711C6A91664431C16A72894450D3E9C66AA7E5E6DE51C0CE004B9086D368641090ACD39DFAA424859740F5BC933EBFEB946A4CCDD30F677A69585FD73B1DFD1A1D8AA9AAEFC3E070A04735002765F4643931D84806F8A4249854CA9ACCDA54F2CB669795479CB14205F24010E7EE6AA76F487015C388C9970B6C6D50BEE56C3CC5AD41C4E097A868EDCE6350439D70AA32B139ECDB48DD22AE9EC04F387A8816A1026F95863F4F2BA8F8EEB736FB269E8BABFFD16D329FF7D2B21A908AE6D9E4003EDFAEA5DCE845EBAC60E96A9F96068BA20E48C9CF229200DD9B8D1A6902C3086871FFD83AA4A51A1B97B2EFF36FEB80F73EA0FF9F4A39053AA3E579F45E862E34B06F8CFEAC9FB2A5073282AEB40CA214D639C8375EE15C655C8CF4A93D4E1A8BD7C3C20E43D1B1441866CDAE57042BD81BCECB320138FA470C9F6D2F1D80D54B75130A498C6E38A160D4803686378D24EEF3E09D42CCDAAF6F574514AC2E5C042525C08E52BB2C1D107158EC9A53CCEB89338B041F466A18424FB5F47AF137D700A760F6FDA281FB9914ADB78FBEE522D0C8C790B0377E2C93645F202D0DE419089D21E7559DA417E932F8295E75F7AC898BDA1DDEE7D5CA2DA4E366AD096B50878654451CFE4005085FCCE5E1C9852F851901CA9643A3A9ACDF1272FEC72FD8E20A99A9C21F930B26A4BDF2EE016E2835826507D331EA92A3912920CCE190F74BE98C811B84D8A8135250B4A978A5BBF19DC2ED9C57F4AA471B132D33B3E536440C168E2254B99CB58BEF66406EB7766F878E8CB0DA30E408B2C7B55CB24BA83400E469B48775CB8C6CBE610D8D1DF4FCAD219DCD02798F3B692E03B830514709C093EFE02B65C5A19343DCDA8BD61FD1DD30B7CA2C34E83DF69EB166447DB05EB2EEB5DDA6602A0DED74526ED3BBF047F8778021C619A21010B1F476C1C8E197E73870BC1518D837BDEA3DD68E7E8E1E15F5435012EBCD856C706C0FECE9D37A2BAF5E9FA0F3D21A6551E20ACE2A166EA00BBE00C5AFDBB0F9111065E5F79684D755EF146D4889B2729626EC6B30615DCED1174E78127771ED14280357F4ADA24BAC3E361AA8C35E093BD894D88DE31C001EBC9AB38E7298E14ADD212FD464D5C19E789EACAB5400ED8FF6DAF307981690A9AE652CDFFA0F3AE16BAAA4DE9218433F02AB8196E13C78F4380EB1C7E2BD4DE007669BC31DC3BBE2308E57E64FD3C57C00DCB024A90A24AF39F4DA40DC5A827FEAC33B68E7420CD44A11370AE5A81BE79B0C0A14CCF9AAF67AA696A85AAB954D46F48E2CE9BF493330DBDD0CBFC29BBDB21D382726E1D9723FE1F07AF1D6B81B17E07645234EE0BF24676E650EA17BAAA3C328267C54EB44DE9F56F372B2D62A91955AE1268473A5A4E45552A2E656239B2CF5F85A8BCB9E124359DF3941F557B5D94A3EA9B8698B18ADA986979D7E728C82BDE4D86878E83EE93034FE31399FEEC3229838AC9BF4BDB97D8142AA2C1873FF176A734B576397959108625274B419E0E6CBF05766D72BB1BFBE55CC858684CAEFB525E2908A43F4905C03BECE8A0A47E1650154EC6FE0742B876078F1D0D07E6D0CE6B829CEE5B0858C93C54638EE57079535B8CE7F121CD9FBEDC88AA7A3B1B39BCF7045D55835BF472FDA6F999731948DBF3EC188A106E6A6639AD8C53906D0484C2DF8933FF28DD7CAE933206A00110AA50417D7C0356BE49A0FF1800D44076F7B218C8EDB20A65599712AD1C8A99F28E456FD9FDB5BE13B307412BFBCA8FEFCEAD1C7F303389CF3DC5051D6345CD41D32721DCEFFA2868BDB0A30002787C20F201D1F1DACC7C35D5A8BB4F23D871F25B1B3FAE8393FFC331980B1B4974D11FDD0420F2E1B49CBB9A915F3A6DE50C09C72AD48D0B3A8F9B1716B8FF99E3DB757A32F2EBA7AD354F5883171979CE8325F2B4D780E0A5299BE70F1FCAB9BB3F5212CF96D58D2118F0A1F7857910AD2F067FEE0472868AD572D76D507518F73C928B2FFACACF9DACFAD580E7EA0FD9F2239A442E55E48C21A95B31156075C5C9D02AAE4BEBC54DA40A7CBFD79882FB7F91C43F1B9D633FE678B219245E2B43E57C242A86660F9F6144DF3DB3E91DD9AB0EF692A0F6AE507BF9216FFE1EBCAC2501A8124872BB74BC04A572B73D7E44143D564BF910ADB882DD7A732E6881CA75288E9836C97A274293911C3DE3FEA952D438C96F014C2C5C333715CDABB30E7EDBC897B45DC82F2C48EBE105A82F8F09A9CFA9006C5998764A73C6DB88D9FEBE79DE3E1F4BA792A2A825F4847BE093F0ABC937B6343E24C02AFC27D23811399275CDF62E7F97C1367485A235F918114E5271E4FC1E6AB9F6B1C7F8002BFFF0E3D0ACC0309A18CC79EE38076704C8A51595D4B9B9A4B960CF32E3412B1AFF074C60B1CD0517D91665E725A1B2874EAA87F514664D4565622BCA0ED7113317EF58A1EDFA66D3D09C3C67E2CE04117E06EAE29969CDA876A71DA279B8EDADDD06E48A2D57AE67A8677703EC8F88F859208BEDB086CF3F50E51CE45DD627ADB3AE929DA5E9DAB8E942D5E4EC006A9938D1EC1AD49E42A9BBA4BD394C3FBB0887A2D09D85DE0E9DA7C20EE7058386ADE254DF119AF9E0036B54602224F6892F85A60AEAD6338A1DEC1441AD5830F2BC670FBA366932653566431BD9C561EEB27A9954B2C2CCEE8A17D4EC74C074254F42CB870C227ECF9E208B4C93AD6190F52A654FCC19A15DC6329B3B16B8398736E91801B059112D8DDB0772580D03C949F9CA89B86288DF6B4DDAB479C721482AA9E307FEE23887D9BAE22E1CABF775BB1578CD0DD83263E375F6EF97A46B83B729BF6B4EADE6D833745B56A5079EA8C8541EEA56379C87C4511964438A80D0C1007153A50C6EAD15C84BDB98B75ECCF073E0E080AF26A850ACBB12F416EDA67ADA94E9146A1AD7C4797FE36030003D66B1EDC6B0DA6634F006061D1D9256468F3D86A6A4744104A73423B91B84C6BC7D92C9C0B222E038996F3C442F8C034B7DC4E98B408571C0787A66CFD9F06049CE0EE472A84C8396873A7B99B94E825943D3E8530BD3726629EA0987D2482C777F69827C3ACC6F607C108EE33BCFD1E0E94DC527DF12AC6E521105197F4010EE4998656783A7B7C78DAFEC74E1634C61F549E66B1959217818B9DA14E525C5FE67D189552997B5F424B4346A760DCE24C2217765DB6AF4748A6E998CE241570912BD7BACBE6FEDD12259A5CF500A65DEEC58C37B079572EB73277EDCE76BFA868FEB5039063407F46516F4FD0BD184CB84CC2A1C697737A44A3E44EEB11F1D6579800009744DA7CBC3EAB2E925202B6648B40CBD68CDDAEC7278EE51FB6BC07A40637622AD3497297B5070EDA290A4C18AFA7FF63D2FA62B84174C373F823DE6F4D5BA3FCC5DF8BFBD17CDBA5CC03B449412C752D54A7AE3DDDC8C056895171A9BC3576B027D362BECAAEBC64724052FB2B9DFC51389FD2CD505FE8017426B9089BF8B790A04790DA05A3CDB06CFD4F713C729B9B2480A57430F2AD65047082EF411DE5C01AEC86995E1920522D13603147BBD1BDCAAFC347A2215712D597AC87775472F800D6C876CE2D28B4343C1B4226109C3CD6205C0C6F2AD4D1CEA5CDA2E083A26FFF1E4FD1D5CF6698212ABB8281DC25A02AE32ABEB8839BED72F5787654B0E6D162AF3901B9D37DF919969FBD50682058F4948A0006CC8646C25847E6A6DF72DA03CDD58D6816092D64A0D208B49EE80AEB24D53F89933BD8C175567E88A30F608447A710797D9C4E407459C50BEEC28F7459B23FC1FF816019D865DDE77948937A80BA1741390A60879948BC6C0ABFF5D0363E776DA7261C786672C8C9BAA2713FF8D4B7942659F21699B069D6FAFB521F7C86ABC2C2378847BDAB39A80737B7871A29CB38B07526A7CA1CF3DDDDBAC9985BC33C6638D22ECD95C98EFA6959B69363DBFCC5769C4C8D7D180CAC700CB0E6458C8CB4DD3397ABD2C8AD56ACD2932A0A2F3E9C7E7CFA0A7BB2B79B659D922158171250FD8A8E86A421B46E2838EC57FEF81E3BC2A93E72BEB846286B2B47D0B43D0B165D083D8E4DCA01A70F7E107D04A69C8C89A796B211AE23F47F322CBCEA960DC10A773374D4E5B074EED3817F06915D95E2868DC5E97D4BDB56B0CFC64184F7A8A0F3D568FD9A0BFC959BB92421277F4F2ED6EE38B0F7F0C9827B0B2EA85A13B05126C70B11BF06A64CF3A1B72729D71E13C5B86E36DA8EE6A806DA5FF293607D54B7661D562C267F877EFD7024405E7D788698ADD9FBB7BF7103D1CD3D7DEE4252AFB74EFB3A4734D5E9F5590792A61CF9B38BCC1E7AFE494EC55870613B1D2495CF947D0A1662AED67E8D911AA1E5ABE5FAE5DED534A08E59B58BE05A01FB7F0351F9F5DBB6B7893168537B13394CECB14C4A2961AE14BF82148F61562C29D3D2925B440780D5F58522212CD10E98DA39EFFC02D5A9B96C6DF02ACA7EA2C62A3191BA67D08D2DE070773E33BFF20CD48423AB18C3AE0C6698CE6EC9DAC9BC10E8641A527EC8472D9CE833473EE50E90367FE2A409FDF656A5F7CC95E77893556EE66EAFF8EABD94E29E4A583AA98860C25D4E766814418DBBB179ABE568A69ABF6BD7D38B364A5DAC7F93C0632B52343CE357C3518CB2DFA4231573C2EEF3C95EA5EB21DB9A55189D7586245ECE5A9D9E5598EE7E8E485E287ED76DC8FCD0AE6BD8BAFBC1E2C3AED44A9F308894635BE444BF4F84A8FEC24D3F6FD5F4FAF352CC67F1CD45969A5BEB6F5F570109EE605B4E8D315CAEB1CCC1E50A3CD9F9DA1EC5A0C156D3B90E8A1386016E327A30536B3587D570CCF92A1CDA93DBD6D47937DD4C3B73B40B49FBBEA5A24B8C34A2D3F106BD8685850AE9CBBFC20799771E5AF5702395DB074F93D7EBABACF54F07B22E87B5C3F0F738D8DADD34CF1D514099BA0B0D4C033E4C5C7DE3D76C56698C3C3B2395A429AE1C8D275FB623F2619DA047C4F5BBEB3C632E9D88A228F76F50666A8BA3E9FBF3BA920B8567D3A549B0B9040C50CAC6043C5B7368A9F5D45486381B265D63193A0EDCC7F97BA7C4C8B9FC56C709941E0BDC0DCBE25098BD18D81D9260111142E42960C8331569FB2A61AA97ECF61EA27A849A8CD3D80D9037768545B360405C16B75CE9D41B0D2B7C8383484AAF93B8FA67576745C119A6084036D0BB4CDBBD282AA751997B759F86F43D21032B2FBC76560E500538122FB000B42E7951D3828AD5B24BBF8E574ABCDE168AB0A3CDF156BE054C17B8EB4D4C54D882F12CA4D99B2D2750168AA27B19B50C559F86BC2193411A50497B35E4B867227DBA99A89AB48A04BD45E3C55ADA11A204B1BB094ECCCE00BE33DE28BE5B20D9E54FBA82E4380CBE540971A0BF1D5A8F8340159711F2F04A26158A92CD704C1E6F8CF27C6F1CF44BBDA53213168C1D64A7264B42B0B25B976556895CABCAFE80864F8294AE6EAA8ECB2648B3F9093EA757E939D83458431213C737FE08D0E2B0C4FE5384EE96338464E248419BA2862E90E1C3806E923100F2619DF7610EADDCF4D0C0FF1E4511F787B5AB4C73F62594F7EBDC5F6B55F5F4AC1ED0F6D0FCF7661BA025782A88DC06519430E624B9C055703BBB772177B7BBE73B2543213D38677476D4A1C31AB6ED5B1629441CE04584DABF5EA3CFE9B214D3EBA6EF50E13096317ED4D6E3E2EA6F364D03D7EC186AD33B560C5ABE8998B3B1F663BC617DCAF52DD02CD28BDA64B8EFFCEBDC311D1F09303350E49A7D30BB696E7514D8110CF57D84FD7A3737B08438A60E3985323E9F9D3DF0C7F8494D01D8B4058C8C1BD36DAD12E76520B5158A91052A3F952CC0D4B87FAAA0E28D80A3F7F98E9838913BB8997A958314CE6B35625DEE614101BC3D265914C616DF9BA5534292421ECC4A25AD29EE5F7CBDB44E8B2B682840CD880E77D5CF867DFF3794C990B0CFF29118B5DE7CA9D1D8C95212A33AB6FD39E2941C461C91AB3EB2E46951B2648254E297C37C3D99D7133B9949ABE9EE467DF1F98D1D4A390574207BE78EFCD33300318CE23A57F6313437403466213E94CE46DFED33FDB9C8D22E85A2AB0DBE5B6615D7538C4352050774ACDCA3F6BA70BBA5EE230EFF14165964B64ABC41559EC4040C374201BFEB6F19BEB720E2D19B43082B38246AFA1C742BACE6879D22A7AF9D92B366909B287180C04BC3ACF0098487DFBB08889546201C89F882795586E7DAFAFA8036416583156DE3794D984F51E59D7AF18CB8B60C4035552D046A50A069F1F12F412C5056B9DD0E8BA0949ED6F38CFD54E39B11F11BE5BC74E7E73023CB9A0CC60651F82647FBA9713576DB3DD1FA0404642A2338092F284C2BB9684C33BB2EF7267B4384A3F98C526BE10409239DD81693D3421569C08EA9645D9B9312239A0C8C35B71F1B424CF9B24CB473171C4F38300AF0F04069C89AD5D1703A522D587B420986F5611C4D8276B3D62052DCB0368FD4C6F8F7FCEB37686332F5CE84D95C212689407FDEFD4E4574BD9E4B6E43D59CC2ED84363A0A725E204A11623C676A93FE04A6882B74D18A5309AE6E73AC291328DDE40E0692A605FFE92CA56CA35317CC53BD726B08FB01CDD614522A56AC27E7713CB53FD6F92ABDC263F4A684D19D3DBAC0067D0CAAF9BC5904892D835D9A409E2F46190476F63C3426A63C27AEEF90275183276950694C27BBB18E89EFB7A871E5CB8DB19246F151415B86A106351D060CC0126DA3D815526788EF65EC7A82CD26D18D018074FCDE897FB1B6039E393057982B6C6ED96C7A9AB7C57B206DBB645F85A6370CDE3C4F148F0640F4D583784D4F678AEF7C960F5D945D79E9E66ECD8D7A63600E585A45E2300AE00EDBFA74778BFD17249067214DC53B8779A7D3E0554ADE79BED54A335FE7C6907E19EBE216AD31595C386719DF07846418CF419C3736A40E10AD579C722756976306B1D951DFCB2EB1329F4F0E49872CA2C6F50EEE3FB339D86E7A66F82F4DC55134AFBEE32EE5B450155A1A4F59B2E0D6BB3FE2893437E8B731DCC7AEED3F15459242F809A8EFA6B4B3CC24DB6F39AB791FED2C7993E6B5AC12AF5BBD8A682AE222A5A280A21A1A704B21C9C1D787A8D0088016B4B5CA1606DA46C876ACBB5416D017441DD641501F4218771D3C9E8D5522104C9806B1760FA540126FA7B0A24406E7ECFB3A31BE00CA776AF7FC7F51FDFE2ECF8DD5906DB575E9E8B552F3A6F8CAF8B8E1C8121C16818B727559C3EC0DD93F572F995E81C08633EF74A5BBC611E1A0958F436E5941183FC927D8F9D2DB9215F140BBAE654F1A90996E2E1363B54413458CA56A82B564C6802EA28EEE17DBCFC4B15AF85D7495CB94E08BB7BDE4C39034AA12B98D28FEC13DF0AD601BEC970450A70FA50F1B665C9CF3B5E9C2DC3D0F6CB02956742A1E208C6AFE10B0A7DFCF07A74004B5A1E262F84969737D9107F24A7ECAE4F0E9D6C9D92962B92C26275C18AEE410333ACB28C1473656DD9E5F356ECFA4B0796C4F6F94F74ABB3A1695D4AF6FD37A95E81CF211EB16A06A7ABA9CB248E7D2EB61C585D223D6E4AFFBC4C51C5E93E6DD188F864024DD14C22F5B41331ECEC03313511925EA4303DF11794ACFAABA35FD6E27245F1B5F421655DCA45A8CBF818E84A86B86C09D9C4CA3E78F25AB58EDEC81E2EE962EC2892278ECEBD552BB6113B61FD1F8D1067088FBDE7F52A17E050ED751702EBC060E750FE41A5050449EAB265BFA73617CF8AD4CFA1653A7CD1BA87FEAC0F49D0CB79B29DD020505A1D3E2A5D3DF9B372891BA72F955EC344745047D6CF453B014CACC29B3383EDD69A602B68DE38A182CE0EDBAFAD5E3B10C9741A78F4A7D12B0A39DA41A18B62E719F6DC711330E8F609F9285CE60454C3A0A1DDA39AB356A11588301454E0F2D8772F79E27187695556F79CB6FDE33C1F308824997EF37005B8302117879A8CAE3294E313BF748BE42DD429797493C20DAE63ADD8A70B6B3F34471374FF45513FF7DA3F28B96C134E80F4BB9F8D4B4660D80778F1C974E482C98F450BD5C0EA42F1E8C8912DD4DB4E1B6FE2A1DAF936314BF7D8608CCFDAC7AFC8058956557B737BF6DF8628D5620338874173604ED3202A93E220BC87DEF702AE24EE1B09B8DBF185939841AFD4492FAFE64B596CC4BE988CBC0B0DE87C1BECEA3F07A062BF364862F51E247151FA4B89EE17641D0FDD05E74A209B1AA2F2B0FF824A6F9CA44D83FD1AF7EF296940F995A7FFF9E47AA703D60E7C9571747ED78185C21ECD692272F74EE8AAAA20EB0EF2B001D1B00C37739ED398B5DA5CD8B5F225376BF9BB3B1CC2F81B6A40DBC7992A0AD30FAA3EF22CE19CD5152B0625615A0184C63FB444F83B60A0C0F7A3EF0A526B283A53E81B0C4383AAE26AF24DE9C8333F2C37099207F64741D3B1A5DAE875A89714DE424E02BF1407461330EFE0FEDFD1AEA5DBCEDBAF0496415023950E44DF2A3E47D4BAD774963ECB26441A0D5D65EA3353EB8ACC15B4B0ABC7EEAE14C5C836659D7DB7AADB2DFB69E6A89A494DCFFD9D2D2A34B8319545ACDBA7D12B94EB18D7EC97B7984993A6F56C8A462F3705C2AA87C1074C8574472ABCE02F3AA42BD98CD9F9D993DF9A85F7B3E7BB4302B31551C2EA01CC19C496A299E1ABD887B41AFF1F01E3017723A95939A10B8972AA04EDE25A33B41727F248B8684BCF8E35F290304F3301DB388E5385895A4CE56E90BF2F4B2FAC2C55CAF3FFC33C1DB88C16D1BA75C94EF1F38856564FFF88C4992B98AD79ED0AD8221E117F76C901A842B028DFD5907EF12E89E4D1BF5C6F9E2D768953CF8DCD2E21337EA3EDFEE93A2795714E58C531456E71CDCAEE1C6CAA72A4F69C6AE8FF42212CB1951311C14E616672A5E4A043E1CA73BF720B2907BFEA0FD71F8A5B8A26911E88DFA73AF3C5AF21A6D95784D332FBD65D3A0A77B3CBA291636C5883DFC2CE0945BCBABE449E3ECB6ABD845A49C740A5D9DEADF7EB59D0674D55A10667A0DB900EFA935F14C7BB9ED33F15146D029A796A20C5DD9719B880B2F51457A713F947E14B7856EA5BCA7FB6790929846880D8C051EB7FC09F6C8E1D775780E7920E0492433DEA797B0A4577E37219AEA3D8E81CF303A6DBEF0E22B5CCA7505F0E6D3F11FE825E635D990270C1946CD101809DBE876851042D94F377FE6226AA047B33DFD983564DA5B46D6FF1B60E25A46E4F2EC19287381568BE83E3F99EB782E0A16365BD2BC22F70B0B1598E7AE383255E0129B38264646D6AFCBBF824244C7CDCDA3084788434D977436C4359B7172F21EA58369AADC3A2291EF30F22FCDB619E4E7A7086AF8DBF6E19B81E008C0E688747D6C61CD27241343A9C0D5E5D631A26E820459592E386C16F33CADBBDC9C26F1013D740D52AA26593C7CDB8E99ED07AB83371D765B8E04C42CFD7556432DDC803CF17983CC1DC5FC858E1B899953363363F47A4995535A4A84DD9DA46F74D593BD6EA55A4508F20F742320D5C1CFF73CDA03C7F89BF0356DCD551DE22409F46EFB9B6DC811B9F12634A0E85CFA082CCEBD039D6DBE1D4535AAB845905B0FE5C20970473E74939BFA6CEB9386B42C4C5935A7BE4F6153F7820E4EDEBB76DBC0222625E0B5D7EF18DDB58A1D755EDBA64A5544A56C60232D72556AC14B017B7A30BEFCDB3E8FE39835544DD5CE2FFDBBA581B3B018A2713B8F1C305AC494186F0BAF0B5D1F12306BC85C4B6DFAEE2C55557E78B2628B68019989B589470B8257C7C0C9DDB8890B632D39E2D244FD7BFF5165EFA06545B4F9D3A7971A0FA73AE4072DD3F4738CCF0A3840F0FD727E417642D1EBC6DE1B7EEE1525AEE9B2FEA920BC5FE44E408C8BA9E0306F0BCC30C3BD9D8BBDA6F74BF9582F8288DE66BF14E424B3C26AC9E7463BEDA970A568D6CA5CCFAF91E965AB995C238B829A8F44603472D69569D9F4A89E094C2C7751BA32456FE8458824177C4AFCD429944AF58F54CA176F0427AA188DDC8DB566DA9157695F25B9737E9DB420EA4D033B952870F6FBE94DD63AC52FB200FFFF518419BFEC57245AC9DFD0600D7A33FE27CBF39BDF14DDA58725661D9A4F099B8AA63E4EBB779E63B044D8526F15861955AEDE46A4E6D1508C95CC36AA9A6EC10A2DCC88CB382C1BA3C1A18272EBE33DFB80067D9362FB2010A39CB672923BA6FCE5C3FBA95207576ACB780F9D156189ACE0B54725F71DB3F5C39C641F6619D9F2B52F7C0CDA64B50BABCC4FA76FA20788947441063E2571DBFD505AC2FD2379036A1A5C60C0239D4E390023924CD7B7421947D334382018B6A1B06B97F00D0B0266B4AA4BBC466032B702FEDA6D63DB5EFE79086D8CCBCFF2B303CA4BAAC5D3BD5DE55349C415FB9F9F8C1E19096D8B4F158CB5F6544F0183102D8E790D7E765A7D8D41DC45374141A64B2277D14152066EEF309631984813B2A067A5E7F6B8295821B2B917BBE376ADBC0412AA2ECB3E5FFBE98B35815A4DE87623767EF00EDAC6A83D9AE25AEC4CD9AE9968C2D9E8C42E4938BF3A446525977B1AF19AA91A96C67B6872E6F56C593D2BE6B3EBDC2067EA96BA5FE87E0629CEF576CB519D88A52743FA89A8E8BC7B50E5BB69D086CC20AAE1531DEB00FCFB9BC2B0C09C6DE196F1E853A7E1032D04928C390682E023DBD6374B4321CAC4032CE11A29C4926FD9EB9D8F464E4EB73D0CBCFDB61866D33D6C93FCF92A0BDD0AF369FB57A8373FDF16749A00AB739BE506AD5110F275AAB3F59271AA74F259E26C1235281827A2AA20A5031F70A9D059AEA3113919942437758E2B19CD769547BCB18A0910F478046863D2536955E186CE7309C1066A0307C12B59418E0F72EF8AB7406FD42CBB294442D5DEAA743EF01D245C968FDB06DA0BDFCC24759C4E4E4FF093959B2FD3E49E17537BFB2D423BCD773A5711602461D79AA92B7B38C15BDE0BD78D54B8C5560558ADFBA9FF6CF5965927547FDAE20D9FA20D20058B1E182418E022E27C99A21F26CFBF81B1413D56A0EF171EF4E21BAC79A6000F12B1A15DAE7BA582D255F7FC55D7919F1C7C9DB36DCE8A850EC538DDC31C662B4E49B825F6E7CDE5571D6AAEF77F0A4042D629A5263232E7B3C1CB99C1C3155EA8A51FA262FD6A7C12F2EA481F2E42D84BBDCCF5D628BE006D8502F37552244F147145999D8257C515AD58E9FD16C97AD340BFDF19F92E1572667B1BC571637B4C86EC83B54D218BD99EEEC22DD91FD9146514C3E0289E6F37AEE8AFBBBA3D63DD2016F6FFB7240B57B359B2374A86D66A2CD51ECFED81337ACD7B619C3529627D4C0F00951DB27217CD862E949630E45E793D1B4D24BEAD7A6603F501FB36D3F7E405A948D496A82EE261E956BD256FCE9B32B4D79F7FB40BC1862988FCCB985CEC2023CC68FB0EC5E76A2892AAFA808AFE33662169AAC7C302DE5281A249D162D0CCBC033CF68ECC4C998BC9DF10F14A3824C2455587A1358559D75F7414E795D4FC088953CA2938FEC0E6E9213D780B182A2AF3317DF398ECFA2A427B6E04A57FE0E4A6629677EECF4AE8C1848C926EDC241E15CA7A13A90726DF9566FAA7BA7BA7920301AD66D7CDD1F8169D7EEABC86FECF63F373B01EC896DEAE354C3BA1987DB1BBB679ACD01FB2E076D861C7F7253C8293008B2697F5AF72BB450D33F043BFA10A29155000912875D43343A96430FDBD8875E7896099719729D76634104185A7962B981D218941855FA1402868268D58EB7D4D3B1011FD60467B937510DEDB0A657A6B82BF1B34973818EE0A197E271B76D8C4C12570587770FE61E7DBCB3204AA05E45EAAAA0F2FFD04EF4E45E3F856BA56F8A0CCCC59DA36D4D9C5D96A1FC39954A5835DB6EDD5BC78268F95075F4457ED4175A5AF68D21E2B0C9635A8B6A2A7D43586ED31BDC445881FE2704F8BE1D01A089CEF368D624FB4C5F57E6D1E4BC6DF009DA8034498716C5C666159D548EA2918242210E3782DC01E4CEF37C96EA18FB8B30AF47044CF6457D1C99EE74CDFB7D844D500D1564C798599184112BD423A491761EEF3F14B51C23B3583313DE2E715EFE926E8A5E3375254E7072B7A369573BFD1B202F61955CC6C32B9984D10FA2AD06C4099278C25B0A5904E02572C830AD47AD78C18F4AF35D909AC1B2211C26FD7AF4CC5063F7F5E33CCBB970D6E0BA2B0E7613053FB9FF0EA54AA407A453683CE6E417AE1306B4DC6D47858BE75E76094DFB24F46466541C7F73F44F1D73E1D9F811E61DFD6C45B00F5D6AEBFABC57533EDFDBE026503860F93B6477E2F91F44907E4300DCC726AFEE619A9365712F4976B310DBA2CBF1472E1BDF3ADE4112E3FBEDA4F4B54106F2EA1C8805741CB8B645769F32918A569A197FAD6B309E0D168F2618A5DC6CFB0ABF140786739DB97D6C9F0D0D3277EA1957BF80AC0D749A84FA8F8B8242BBB6FA3131D5C9CF58EAC7681F9176DBDF990AC90764B66725912719B0D2C56E9C8DC7374435FBB34979C1439F236A47880AEC6CF27D82858073A3BFC35E405BDACC06517417F606B2F402B9B36CC29F34711E33E04B4AF12F06306BBCF1E4185363C778A2112C7BF22BDBD380392C986C479DC6FCE6D31E0B0EF41983A00048BF2C01AFAB762A6DE03C4D0844F3B3D775E7FC1DB69B12AE312CBA0BC6D8BE3163E240BCB1548CBC82F57B75A727AD6440FE751DBA92FAEE96BFCB727277E3B704FC7425B6AD1A3F54CBDB480FA422F0DDD330AD482EF0229EC142E3A734E4AFFFD0B0186C97A4C3470FB78CC6335A2ACAFD34AB536EDC8F5D416417B6110B9FA5F45BE69850D36A82FA67E2CAEA08F742D57E8C6A787E18B0D6FE5032AC65DB6436F61B90CDAEA55659936CE43E20486DE322AD8E093765DFC0FA44B5B88142AD69B1CEF9FEB0510EE82934E3648A2647A0BFF53CA8AB3608C1D198B76799C90556560BB05961AE92C5230AE99C9B04ED85EA99F52905E843AAD1B195D924D22B6B63F3F9174FC4F53981216D20938B2255394370002131F7C2490C76603D477484E4DBA54BCD4E28763EF2B281D93902AD3F2204F36BCF60505FBC36E1843B7FA07EBEC905A4520C199E3C079A69CC92932BF14D54A893E477F707A51020CB54557ED8D472E8845DBEC555380A8C048107D4CEA7CE2DA73A753522C742A8662B9B363CFB1AA9B32E15998824E66FB553FF10EE0643B26B6B7ADC76D80A9940596BE552B47067EB14FF05441396440175CE4D96085C773C3E7959B0F03D8158910940B0AABDF4576072758C3C03BF66E0DA2309A9D49CF44ED243FA7CA6137FCCC9135190F69717C87D13D974F071B1050D5CA73AB864CCC335578D3DA96F6FF329E4C0888BBFDB177561BE29CA871D9D90F8FF2829CDBA6497D48E1358078D75A19B5BE02DB3DDD0CE0A842B7B1ABAD99B9E70BCB47525D3A37183943D717F59DDD4D32C2A2F9E22FA7D5A23ADDFB801BEC6E49F7DDDF55CCDED8AFFF54DBB5BAC4BCE6AE44AE5774555E8EAD6D1126F4FA41E8E308504FBEC20C3F7CA1C25AB737FF4779104CEEEB9DC8EB034031992815F597939207C36BEC5FC48146665BECDEFE536324E63B117B3EA0612AEBE2031B7E7DE9FBDCDCEC86126116D1A498D47D1B096E6236C9E7ABE3492883E9FCA6615DC609854B536C50D37E9FCF8E23B82DE5EEC061928122CD430EEB3C1B34E52B97646A8D03C7CA84BE6C008E548C2D5166D47CF755DCDBA896212A8B2F372554B59C708EC7A4CC53AA5C79055700DAD77A0B682D9FFD5FEE1D12CBD8C823259FAAB41484A3D7968F653832A205E9C9879E144913637DC2EE4C621FB419FDCAA12116ED0ECD29654D44C0E0745967752C5B1DD208BDD6DCE7885959A67860770C5AA99EAC7B2DD8B67F0BBC9B11DD591CC99DF41A382FA62C581EA9CF4E57022CFD019D9685E60AE029F6231418367372F0F0967157C7407A3B5A32A76E3D281A47C2F638A077DC3F9A12DA71464FB976E10B006A243201989F3F062F7D83D09DCC17EE2039EA57621CE97AD283D41A208EFB29C5B584367E5E56C64B71FF442B61710E9FBC0449C7D194B7E5BEC34E4D86290C9A637187A0B08B032A0C73746E2527F9EA879EE40285DE1FF65D92677056550D98DFCA96AD3DB1B794598B68ABA7091BD85987883DF9485B62CBF481B129E811FCC4905C0B346C963A73BC6899320948AA7E461335763F8AC7086DBCFAEFAFDB3EF4200792CD4DFFCB022EF05920BDBC30EC29EAC3D7DB0CF0B3A224A8955502075A7A58A01A74119214E84820BEC4C39D9BC9BD0B3E24202AF651D2DF528F7C8FA473CD1513A0E9967DF4E5DCFB295B8A941B12C5C3CAEE07C16E04469F21020F47A9B17C974D1DAD80D419DE593EC44A98602F5E21BB66BF66350E239D861030F6D2A68647D7E2B563727CE8D7C1388A9742B574AEA4B091E3B32E78B761A0E405138DDB36FEF9C8BA2D0E160497182AF0717A0FC2A44DF71E2514B52307646EF8BD565EABE770432D74C74D135AFAF09070C97DE63D061FAC3491FB4DBE1EE2D5A8E479B11679D93A5A7A4855712361E0595C5E7FDA8C30DF69C80BD94C6DE6D531A304B7C9C0C3E0C4C089EDBD12E6647EB688E0C66D3BBFEBD43B85E933BC1F86453179D4EE70150D9620CCA7BB3D15FAC7ECA4B81C82C003EC056C273EB301BA7E2A72BFC4E69D6908D927463D1A0A92EA2CE68B3B157770581E26534E241EC72E010E9BA518CDFED3A0E1B3DF5EE4D9041358473E0E80D3BD5A9E2D2B82A1B8CCD431C59165F9345D05E992B0EAC72E2D1547D866A3404D5A550DC139F1A1FA0FC17A6D5DC102D2DFFF0C34E5A81ADE93E4D9BEFD3339DB112357C03658A00717E6445F41C1C969A4ED7CDEDBB7D8EF391A6F0AA966101D0455B3925CC7B26F79E1DE6EE8FD0964A483D5AF78C94DDEAD4041721E00DBE5AE0C06EB3D42EF4214B124FAD29D6EE4FF996D38A609246C5C038D4AC34B761C378E99613ED56FDE8D36C748191E4B913283E4BA89DE64B2CA6407BD26217B306777C4B078BE86C69C1A4A4EB2B14943C2C04E6A3D325A9C7E9E5DACCB738DFAC4C42DFFCA02C1B2CE130F016547626CC37E63C2DE0D70F11544C5E3D826C36B2C7498E48B95F09EA9B32C956A1CCEFBB19DF1F5E1567612DC009885DEB14DCC5EC2D98609F8E57A80A923C7D55C9C9B74AA1DB7A0681948E82560D8057ED099AB5DF6C3CF4508D0CEFF18DCD11BAB07B482FCFE67BB85CC448CAC7F5F2F84C6E5E2B8A187641691058E6F56ADEDA30790752398F48E8DC47DC3056BF9AEDD094B52685247D9A2DF24B5892FABCA061ED3D55BB004EF45A70C0C56A78528675F177EEBBDF76DC9F20ECADC9251A267C995897089AB728400F1C4CD52F8E33067859058583CB858F3BED7C9CAF4C55E7C62209A188361A9F0867D7F3EB850FBDF477EB033CA71FDF34AA9056C9306D24408C05B2E48D0C6C60B8C0AF4B6899665E6A4A614FFAFF659D8D9EBC7E862D745D33734144A0B722254D8D866CC6BD796540802A033B00613BF159FFB5195994CD28ADAD9F78DFE0D410ACDAF2D436EBB431E875E23DF29C2ED14B0988A5F4DD36786872CF1EEBA9C2DA831362EEE34C4203D376FB702899FF2D5D7B8302013C607789DBE657A8722948EF8D56B4BEDE16741A24941E9CD7063E1088B6782147D04C9987C922389B33D14DA9F53A9ED4477091793561950019D74BD3B9237F29C02BF8E60EC9E1F51373D532CA6C6353E741E9035B63307C062D0C357777555224DF8C1C470BC8E80360142139E8DAD9FF37158FA89FEC3EB755E87FBE4CAA15F67A5D670458940E4856498B760CAE2C7ED73197F9AC32E3F70A7DBEC900D5B2759785EEBE0BFC17F3013DD3C5E070A26678E683739C372F2BEC9748B37D3F67F7215B9DA0A189DA07C17CAFB0EA6A791367D18C2721287A41367F1A23B6D4EDDA661779A4FC9E8E7FE3B8BB7C6E622536D42D090CDD91BD0D0D5EDAF742E437AB1169DDDB2284BB0FA4F225E3067D5685056AE3F4DA73372E14FE087207D04ED06878BB1ADA7723942E769AC0F2CEBE73883479AE11003BB98F2140F4ADBEFA1CCEC7EC3810942A5C2F769F588FF015B73F90B33B3ABC59A72B7ADD702EAF49B09A49435966046AB8EDC32CD42277C64FB99C1A3147B4A03C23AF2090246B6238E1BC4585E31E5EE1CFD482F00B381A98D3D0673A97C0C896639F8D3C018993937524883472951FEDADF0915EDDAE268F5914ADF111979D9CCD768306BBCB4197D4A73773903567ECD0E2EF5C23069F2D5D619DA5CF0F126DDE92C1EBAF3000652CD246EFFEEDE14721817FCE71DAC21700C6FC1071B94EB86F37510AA40C78B81EE9A8AC79035874CC8332CC402B8CA38CCB52066A5AD93149C4EEF0B8A84CEB4DD310FAD495D0C35E1BB7E72579D08DBA6A7805EF6BC294061093ADCE40956AE89A8092A919C20049681C59E9D4C7EE06D9B4003F5637C82871C76595DEA40470E6D8728E8A1FFE042EA19E2662C5896ECE8C6C781CFD559077A465A3FD504567341992521808858D02E20BCD60D430C6796A5BA4699CC675F0E6B5C9ACDFCB93FED8208CB13763AF29FC020E306BE5773564C40BA626B38F84F5A3CDFF7BFB65D920F36988636E1FC43D9B7FE1CFD24012706158CE79FADC19C23CEB7F6D447C9264109278F84C58003FE132392C95848077D4EC826A27DAAA9744DBC0E63DBAFAC1B14C2B1022639D7BB14FBC74B0A7EC7D6BFD8DC99F485BC72C769745F22089166FC18906C758CFA4D9C5A9501D8966364BAA5A4150C7563D096FB9EDD32F348B8BF52AD6F515B201BD31D700A16E8A8C4A579A3E427C751AEDB08CBF49FBF01D9CC44808353DBAD0481BC96FAFEF425272EA7E07CE1BD494B5DA994729EE6DBDEC5C42C46D3D19C0DB2D17D31F152D6A827ABBD7B282D5F532EE16988467593D49332BBCB2EA565A4AE783F05FE27225601E52014FC26E2F21474C080ECBF8FA1CC6C0250B91B4D846C3F45BEFFFD47E0C168430BA668D420A506CB627CB5BE690D51EDF48D00C9A9B420C324EF73BFA9899D70C69AB66725422597C9207C843E0E5897A6D4539BD3EE24DEFF4B98B94A282B80432D40D3D568062F56B8834811881ACF677CB972C71D8EC0BA77DD5E90A9C06A74664C9EB6F09E728A0D4E90418E9DB404193F67A72C8095B17A676104BBF69DFD3E138547D01F70D9FE759F4F0AD6F5EAA63D9CC9F6FCB1F9E62C3C91C30EFA39C5166E6D2918D51D941B6C1F31497F1A41BBD1DB35627A214F00FB1A961DA4CA7369340D20DDFEEF7BF3CB6747DE4A854E21156A4D02E2A77DB19DCF893B77235A02D1F416D818F9BA4B05A01CF65F1A09AFB9A2BD542A5FC7915ECCD27371D8ACFEDADC647EFBDC21C3A4529AD5C229FE30A9AA216905134FB8B5501123E3356A789AA3EC1B8104654BDCF4C6E49FED4F4885110EB341DCB9525F3EE0FA51559D18611CB91299801A1F0518890F32AC81A3F364495DBEFFAFDEF72EBB996823BF5C9589645DBCDAE8E60F2886345624CFE32D6E066F68CEE53CE8867B8A856582C75D158B83FF4F989775CF3231FCFD0FC2848949CF852B395A19FE5E77BF492522FA431EFF64C84133A27C928B91DFAF6BB048D4603A11219583E0FE0479B49A2B0CC300738B3AAD2EEB715F2C9DBC61D089C76B0AAA256D8CE11FEA78ACEFCA65F7976AB92524AC31E0279784F1196DC451947B501A6D0B746D3D641804A65D549CAD505FE215D9CA1D2687BF0F9215BD4DFB3C76C0DDEA30E3B8946DBC4BD2F3BB3559F9C6E3CA1654892AC0935FF315404523DDC541BFD3D074DCA6BE718982F1862D357E3790A434C65F799F29AAA1EBE7738427ECD099C0ED16B89A1DFC2C26CDB8E4100AF22E11E1C5BFA6EA404DDF698857D24DEA9593EF2FAD7255D406C799D349E3169EC7A2E0555D4A03F1BB228B0F3B86DD6C6EB767E2AAA4509EEEA99A7F0AA17E3FD6453DC0557731B06385353BA8310CB4AF9FFF16D432ACBA3DF8F4A1E1FA1C63B01822B700F01872E48A0622BC0F3FFDBCB580095A0A0C7243FCD841484BF6F3E847941C55244C07F1A69F5A190AEE13AA367649A7255344876C9BF9B27A5224E9859E824027E28EF93D5BBCF1CB9570F551C99EFC4BEE9EAC053316A0EC2C30A2F64A0F9B2A86463553BA1507DDBE554F524C13DC623C9BEA205AF451BA36E6C5FFE93299CCDD364905AA84B673C2A7994DC44E659B4083EA0D531E5721398CF3A25E41B76E39ECA6AB3820F5B568E4AF5F5C56269A9B24BCCAE9F6857C54767785D8F2A18A1CFBCDB8807F4E78D8784C7BDB2D0F216352629B86D856EA51EF53F6248D5C4CE26CB8791500562C96FEFC038850379A958F11FFD08571C80823D3FEC800DB690FC297AD72EE5CA18B5FAB81F206915A1A91ED383D04C5AA1205A33B8C2CBB92F9992BCA91495A2D795FDF870C747F29CC8E6362D0AA60B591457498A23268D1D91AB2EBA86A8CD1C9AF8FDD1D79AB5F4F0AC7F86D0ECB83C6F00AC2ED38B8E10C206B9268961066B664B2147A91F02C48D8047A2992C39DB749059C0399941FFE2FF88BFD8048906D715CBEEDD052E95448CE2162847AE7E24952CB59B70D608A416190946C7DB86D191D6CA18E744058EE643B7BB2A889E29E4AA70E795A34495608DBC8082C708B29666BAF267E7EC5E66FBE7A9A76F60D018A633EF5D76F0C2E0804CD9B571C592AF7DC23B48904BCA15FE15CFA25DBA4646350BC328BB6192A1EA521BA8CE16F065FBE474AE9EEFC31FC5B828282CBFF7D65AEE9F5844A3A6E284357D015967917E4D444757299D77B1045BDAFCB8AA51CD82E3B76FA470C6A8D4FA11F8E55015A44F4A52119CA975F0DA4D9DEFAC41E7B9BBC202504C3D764DC592702493422F272877A1BB17846F7A1B77D0ACA5CBA29B07712C746CD956BFC7A56C5C2596F5BBADD444DBB152FF601AE5FAFD4537CE2B530A83E4B0FBA2B42E3BF28163E2F078B3DF0DB5E7D48FED054547FFEDE59AB8CDD928CC0F7CE9E48A07BD849A797B149F6E120FBF885DD134A203FF8C1E03873E22F14E7B3E50F72F6524E8725A781F6D18EEF7F85C7807B78AAF112A48151F687091D46C85A82AC3BA93671605850C2E0DBAD980AF569372CC1A681D7A6CBF8F1E3949E952FA91F641724342373B0109022C5C7548183D34CFEA4A9A414AF7487AF1A449F7B58221D06874B634246BF6BD13798134C1D792FA7E710907EEC7D0E7A54B92AA3228F9551470167B0B011980F3AB1CDFB16B55CCDC26F9E8E93D593EE6460DEAA26B7524B29365B44028EF836D837786AF37931E3099305D3068526D34C18271D81372D937207C11E6E61D3838621CB61894B730890E13118A3F50906B27D4443A385FDD4C85850904E98F2FF57B04FE40B097DA54A1C33B02BB3B65448EFE30EE730B5942CE17638B8D8892E2D3E0A3E981B698669BA849D15400D2562A5B64C3D465F48313CD1BA6B990123FEB20742779570B9392A4ACE989DAE979C97197BC9C337A0151D5AFD45A65D32D355729F85E2BC30114DC89B4CB50638231FDC40B77FC268518833C1F54313FDB78FBEF903520F183D07C9A9C71B99FE09091886F7967E1CC92120D3B427AB042DF9ABB6855A171139BB959616F59CF32C1BA0F76EDB46ED27DFFD3CCC80D44D0766212D4FB1989168D95CFBA1837C34C18E3F3447AA480A5A566A18C941AB859A2314BD3EDC760664B55941C1F8D857D801C10FF14CBD182293FA11BD2BEDF7A7213DB3CDAE23DD124B883D0785C9317B0C51AD4F2A17E3E384BAC5F2382CC2F37C80FA628536D6359E0CDBDEFF5EDC9A26CC4547C3C8FB6FB216AFCE06BBBCA563BACB34BEFFCA6C7A9165F9EDC318C569CC16E6BB0320D36635F0F30954846E3C8E63F60B11790F82D25C8124F3F579276563DB4DA0FFB9F0269D2E79CF1B9DC3465DE20F322D9A670AF407B31A4CC84BAF0FF510F44669BB607DE80FB53107B59004EC8E1AF86AF02273272D319A887A40149CA36A14A0C8F2E2F0849EE33BB2DE42FB3A219A3C05CEFE1FC52DC2A6391FD528F8967C7A21FDA9209ADC33BA7ABE0FACAFD0464707FEF8D6D5455EEA236CB4407B0B10D4BC0FAD2BA3E7EBBC073FB9FE5D91C736685A01B7CCB4F7590272F25FFF1208BC6EFE8471493F4D35B02BB840B96D23879A5B13BA667590F7335570DC878449FA7D259BF64E1CB29A6FC9B8FF6BB25813916073EBE0BD718F048F513673512E4E0460D65981107CFDD90F51AC8A007189A26F7A9486163306D33924D606A3D004777F775AFC5C1B1033B2DEF4EB09B2F72B1A52469662F1A02387FF897C5427A02DDE72AF53974AEEF1BFBB473368390D26F7DA4D4BD95BA466A333CBD1882454E542F4947EAC115FC8336072727A922860FE2B62C5E2CD22C3665DF113DF71B102634CC0EA76FD565457C38B12323F5029CA541A8A0FD8D5228676FC9D27D36372B2288FBEFD9A41FDA6DF56D8C206C37D7AACAE4B14B5143C26723D08187178CEC17CD3C0B761DD8479B575F9F2C37C3CEFEC09A2344E8BD5427319053E9A1321E73C6BA2D127E09870E36FFA4AE7CEAE9C09C36140C513A74F692A7F3BA3CF15058BF3B97EFFD6AD159B4905FC5C7225B620615B92370444690656822B59944FA89E35CAB21D0A98A5A275836C57BDE5FF222E52FA833ADF1997526264EAF3864D6508FB6D2E8402D68D5309E99E861169D47F95E2CED862C4E9EB410874B043F4447E2C1E2935AE105973AF14699855277745821EC9318CD59CA2A95184862D6E1DF89E736614BF7B932B221253BD7956DA1665BA4D223EB17BC8FDBC0D83BFD864802CBA966A7C24B5546E762AFC4B22504A17335708493154996B55B37D2A07ADB232AB8BFA46023AF1F99D7476BDF435367CD58CFF06A275ADAEC44620363C6B29F903D6B225D4B7B8B4476CADA4534A9BD449D338A48C033414660D9B8A8EBFC548868D2CCB41572A02220937A83C56167012ED07A67FA1AD3ADA9DAB34736712F1A6ECC75D1243461CDD7056344980300CD52034E352606E09593D7796C4CBFA6248507F9FDA92B251545BA58EB37816BCB1EA6939A3635FF0C964312D2ED59D43C9BF5BB1356EF0F15FA1904736FFB271F488AE7AEEAC3E8C08DFEDF335EA24B48B5F0D13474DCE191AC87A0AF556ECA5448E8569CAE69CA256AF09CCE89F64F42B1319DC3DC5FB9F0FAB4FF41F954FEF4C4D1E5937DFB82490FFF30C68C2CEED49F43F0E0EC80183E57908E01A263E31DCBBD886157DE1A2A2E595D8E4CCAF33A77669690A82929C6395EE396E47152AE08390AB42390EF130520B46439BEFF14C456C79107C5625D097E66F2775C78F5215EFD9E39A139DEC743FD8D3279D9381AA414F79014B5F2CF4A6E6B804E7C34792B1EB1ECC498D2C8";
      const SHA2_128S = {"pk":"6792D6936CA60069BB5151E5762D5E0A8C48872A8861B23D9B1CFAE3A70B5D05","msg":"0C","tc":276};
      const SHA2_128S_SIG = "EFF14891BDD61A6408829A65D3DB897754CBE8923EFAA63251C73776C06F569BA3F26635E1D943756CA9264EBF3D2795DD103925624F58E0DA163B30CF17B2A49AC17EB12DBDC2B7FC64733BAFF26B6EDB4274F41458DA64EF7274F0719F8D9E56398448C68BECD865893EC03AAC4EDF5D29362D9FEB448E38A2408C26100F3211FABB3F39D9ED07DA8121746B00E4FCD6EC8DE1DB5CFF066D85944DC5D3305AFEA3331F2EDEABED530FC49FF5A5B875922DE933F0E287EE93455911F7C164769FCD6A66DCF137D0B346FAE181F032372F55B6F607977B12DB574C56ACF5DF398AF36610EF3722477195FF650CE77D3F44C9AA2B8388E6D4F551637B3A759551F8B6A00E19F3866A266EF3CA0142FEDF3EE179CD7570B0D49BEE207BDA8B0EE2DFA8FFEC1F7AE5260F250FB1AD132F21BDCDB27253642147E374B1B3613451495A6B1F878EF6BBBF5231A9C789135405CDBD337F5C69ACCD79764D29CCFC6AB5A3B50CB02B0F575F8C27044FE2319AF8BCE26B005B016B93BE38622B0FC5112E25BEEE7FC8C4D6F618B5185C6E21D2E6EDB9714595FDE61641993571BE0F8FECAD9973ED22F3B1A02DCF190802447470D8827A39E80F5072911BA50E7E07BF568A69EB9463DF87FADC50235B389115320C98DEDC18BBDD5AB5167F666467EFEE5142FB68AC4CD5D1D793E488CEC17E7168A64702ED75EE43FDBFB3A82590A72C8361FE88537A25404D07F3AFBBD4E4F8A602F566DC758FAF8FECDCD7E488FADDB52B6E994BA84E45EC3DF993D0A72C0AA6BF276C39E6E0DD00D2874F9D0FCB9925E7E01BF67464A6D9ABEC885993DDBB735142994650447C11FC25AAC2ACFE3284EEBFC566DA988E1A3532ADA2239BEA94C8F25576923CA6DDAD0636D3C196316C29E25AF397F342FFACA890D47081A0AE7379867F69B1E0EED8954CC981C93A425C39E84BE263DE2DEA3A069262D4237417A68064D8174D1AF2D657E69D69D4D1206EBB92DC2A3EA130463AD8979F340EBC3000BD469903390558B17660D74E3DC76441B06184CB143212301C42E53876DB688385737D5859C082A4EA9B91E8A5CAB5C685ADA54874129D318ACDCCF049561FA6833CEB33CFA67D919B11F957E0257210F9AF2E33D31395516D79D203FB3A8D082D8F7A75C457139A2408821E9E73426BFD5A91AC1480F5AC871D5C906CD66B39F15E1F1D8B679C88E7780B9AFDD0174D03650ADC7C558BFD18A47038B4575212011FD13B79023995D08E88097BE9286FF58FCEAF652BED396E567057605C81BF781A6A2CBF49E1250182F4A090FC98C3946758AE8363B062F2FB529A996C510C557E553E8987687159631BDDC7B104D01E672A3F7E5DFD4E269C76D903C43F6C0CDE41A6A08AB43F460AD23536A03D1FAE6D649522AEEAA9F97B1EAA30586D26C35866F005669697B8862BC826B528D09150CA9822F265A6E68DB30B565D25CF1C0E5EA5F5C6A09816F0EF57C72E478F82806FE50BA52D3FD5EAA76B67C2E7F0FD249603D1A6894EEDFE9140A32215827BFF79DA30BC60186692474F5E3D7D95BF521D689DA4A7A0D7C347BE82D666D8184B5246EBD4D62FADD5B2541B25C3ACD36D97921B9A0CAC96DD6E891026DFD2EFE5925082D5B331AEF0669365B2B2E63D065B756EB45127A89709D0A634C771E8238B70CB7063EDBB35E37E376D72F521A9D8079FF546BA54B9FBF4E3BA3281CB3F5EEA5D115EF8BC4A45506D1DE01CF227272708448B143DF3EF087D1687B3E922CEEB955C36C877FB846CFC55EDD7690D3442655E9C0279CD68777E6453C63AD958929F8706944883E5ECA3AB17443D35B26500A68BE943566943D19EE93A047DC598EF5D0EDE9C900AB4444ACA06405D0FAE45A88ED4F9666AB048C7BA545B3AE78DE9CE77CEE21B458D8A4F37E42D493DE6DC8B86EBA645664675AAFCA7EE8A847F8A200F9DE259E44A00AC017491AE11CB496AA79ACCBF780561E9AEA14391BCCCC49003CA9277FE9D91B211140CCFA658A73736E73B5D57BA7E608298C31435E7916781B6A34C87333A5A76267A45AA113A9986398AA8B146C6B821AD3E3121DCF0D5FF4E29E53A8D523A9AB5333F1059CBD4025CD1F67BD6A73473918F80F98A7F1E3F600C546C6D4B969969410A641D459B83B902EBF884289E10DA15DAB0CFFB36FCC4E70A186EEE872F540FA55C1312D625A389CCA7EAA99DFD1FD8808C4DADC1410B82AAA453FD1DC3004A42D60647A200CE965668CBF3CA3B9A0A30E25FE9ED475AFEF46A092D48E527922D8727E748BCA3A1438D7DC7DCE881C2CE2536B5F8919193198F1663A1C6E890275BBF26E6DC4D697B75263FFD3B45CAA00BD4AC75CF7A44CA0E0370FB89E8844815FD8811B7BA52DA8152FBF65962FF685EBEB053709F7B56C324463F1A52D102CB19D6C06D6E32F445E1E02367F49DC5DEE06AD5D0E24C426487B957FD130582A07D0238DD37E8AD14751FD4E62E73C3261ED8A628507BC2AD9F9A482147B0360E4C868F77EF75C92AFA3B3366EF79F1C3443CB06F5ADAE8CCC5320E0CDBDA6D0902C102240D2E619FF01E04C88043482D3DCDD63E652FEF1D7BD75DEC8ED69E04A0D16FAA4124514ADFA540D30DB73F5D53E979321926533FA9BE763E5BCF9D6BE01E79DB2ADEA9D1FCC2961FE4A36435277CC56E73573F3CBBFFB415D839D7B3EE6499E315AE6B675836F88CA6973A24775D1BB69ACDB5C02B0E6E2274364B27DEC033E437151CCA0EF9C87D59DF0A2F5D634CDFC67DD8BAEDF7F984B1E8268C3E6180D5B8BDF526F5A63FA649EBAE0C8D570A36CDFC81CC40F40AAFA2DC5C27B647130C2E7DC35B5EFD685A7535B0923E5F1B4D10F34392B07B7CFCEB3064C25FB0E995D6AD4B7B205A55289FB18E5607EB0924817D4210E0F45645F374E83D774428AA617DB15945157C1C953DF62A59382BF1841020CD8D928ACD5BB801CAA6265C4116265AAFD03D1F47B1036639F1A712567607A76453D5C1403E8D620CA226199F00879FF3AF51E55D8E90178F4AB9DEC2CB3A6A428195C1D2487454B8A2270A5CB5F36E9716FC2AB3EB3CC936CF2148FFFB1F65D7168CDDBA5DF7BC361DA57398ACC660D06764FA1BF6D27FF1086F81C8F50AE3EAAC911EFF389C3AA43ADDCA1A8178120A4AC0FEDE7ADBDDD5980C4DF240D328C00EDAD40191EB0DC5AB9F4C11B292E48B5E7252FEA54C748CF2F6BDCEB7A3D1392B8CA6A5D2843DE51C7EA08C6E3A4C430C28742B3FEA1101061225CB40F2E9A9AC7C40E5B7949C392E3CD009A336894710178120D44F6545768CE6BFB81FC54B4783C63F3223733AA9445064D6B33D5B1BAA92A059F96E3F3483613F360F516CDAF27FAD86E990822E05992E048925347C0D66051911BB85412548F1799FB7E17220A2AD6D6A57FB5DCA4CA2902F372CA9785CCD49101265A9DAEBF0B0B27FF17A1059D4B85074E28524641A9E57671A092B189FDB17C9B838452EE6CD694170A75DB1D1709AD79E0D360A1E1E294348B6AABC635265CF0504175E131476BF7A5A96CC5D78009189DECCD62410216BFCF2845ECE4F700FA01908AE46CC005385B69D781DAA13D2983D12A8CD9160FD50B13A81FBAAB1B2E17F2B3BC3B3CF26CBEC3FD032ABBA37F33BF74008C918A0B1CF03A16A52F7A7D6CFB5BBA686B97517AB41088E3F5772BF874299A5D540E4D4F6F81282F145188DB30ABFBEABED814C1152D206EE02BD6152267FB42E247954048C2ED590C9D02284323557A0C5BE79C4F8E5E9514FB61A81E114C7990EF277CC2149C8F5495C11C009FF0D3F626026BBDBB9BB80C6F38651071D82DD3BAFFEC0065D85D3B76186E468C6E4DD629A2F8847E5BD0EBBD7CC8AA50E5331DD3BF6384D432B54C05317BBEA450D9F96BDDE54B624F72B398D7BB591B03DEAA17286E91405B3961C5E5FBC4B62B9774AD8C7C16576FFF2FF0884A7E8E4F2DDB7B0AF8FA9D390EBDA4821E10E562E25938909E68C4536011C600BBEB742E16B154FDAF9F36199BA9641CDBE3B947B4D3BD12C377C2319269A5F8297635253F40B47326E2726694F350261C90E4AE1868B498FF00215B57D23947835E5763E9DB108D317856D2129D5FA2235876A98775B16E24902E3C8FEEA87824E9BA55DDB998CC3E20517B4EBC38FFF589E0EBDA636B17623F1E0DEAD9C5966AF7C682B5380FDC571C053D89776B31DCE9AAE194888315175BE46E87B3ADF151D07CD447E46E3A8F2C847DB4778E60B3DD48AC49AEF7F0024B6EE219ACDAC022D537450CBFB79214EBEDB0093AEEA0F2671CD7E57F7F72A4C886B693C67A5D89D100AF6F387241B8F76E48BFF21F0B95895CE77E988018489F5703561EF04071ABD7A870813F5976732A25B8C35A60363EAF4EAC3E6B478E223C21FE4187513B59C55682192819E6C3CCF6A770CD18730537339FA2950A232B60EE4DB901E2BECBB35CEDADCCB45D843BEACB74D919967AAD9475342721C56F21D2D760D829A10AB56008B87308D476A215E0CAB47441B7B25578F575701467DBA878F0995114ADC71026587836A5DCE3B4C689A6D64F124C63A7629921C5AD4EFB94ED7EBE1C6AC76AB365CB15878A7F52160EAF367CA3E562C46B1F14B8D300DFA327D5887FC33D68E55A77A510E81B64A30D0C964A60E5D3884227A17AD8DD8AB3291F8D0311D860C7BEF6ADF6D268A7AB27817BE8224D18746DD312D6090433215BB995D7124FAD41BA99B8BF2C678AED648B921E5EE78D789ADEB9DA22987A400ECAF5E11CF7822EFC2397A7F82678D1A6C94ED1424D55A1B21E2D21D790102035BD19EA381EA080CF71A7B29F70E7043ED549305675116F3351F73D5C9E70FA9F26886BFB8A7BF1E32B3DFE91DB2365566CDECEB7F6971E5B12622A49FEEFB47DA9B3B7F61896CAFF5A4A54127FD40922DE25C067347EF5956A71EAA9C9022AFA1ED97BACEAEE9DDEBBC4CBA6048C334C6F73284685CA5D5729C255FFB8CE7DF738E4101EF45A9584124F14AD81D1D310A32761F8DCAB741D9B918777C6592A21EE2B0F6FCB13B92515F8972FFADF91BA2000A04C3F14FA2441FCDC6C56969135C3824E9EC4729AAA1AECD9EC7FEC337FAE7825AB0EF18EF4D963AE0DD2A20ED425C8FCF4FF1739DEB6D8425B03375CC9E0E3F4576237F670DBACE01AA5B6AA9080F04241ED03CA957F70BE7733AC0DAD500F1363E56BA784975BD82874EA8D7D49FBF4B165D1ED4A0E5B723774920B8E35814386647EA707418AD2B01E5095D310A719F027D4970CE1D9BBA62367A7D95A594A43B5711CE455179A5B80627BD1EF3968B13F136B72B521B59EF83D38043AE6D82D691F99142394A7DC7634EB7C0E9950021CEDC32018D140176EB59382D70689F28677472725D92DE8CE896107FBB1C5AE7EAB0605D61D7CE10C07E32E966C15387F119CED1F9CB76857273406B244AB81C097433AEF93CFB4A2F0428135F8C8BDD026E571E313B7C53091BD285D22466E62BA14E62D9A2C145B889AED65D9F5EC56B73BF0D1EC09D8C0DB5F1C1D3A535DBAE7889852CB717FDCA6C2ED44108DF565A6A2F611D6DDFAEB1049327E85DB8169D914E9C5235B08B45152AD2E7BE8E857E59257B46FAD8D35901A52983654A3F5F4844C03C020551D97F20460AEC8875CC376DD16D0FF8A9460162C4FF60445D88668CD8F3ED626135DED9B0127B91DD9BA0A52457A1A909F6843D907985EB4158451DCFB74FF89D8F5C2CF9788E82A142E99CFC26309F6C4C0C8CE0D8789B67EEADBA90716F2AF1A5A83274245C318D71DE8814D948E0020D46D42B5628A865BEF979506B4A4CC3B81B73C255AF3845E7FA4463F8DDC07DF31849C66B0658F4A9B2CBE1A5EF1AE5EB9725E79E8412E487D8062D2133BB02FCCDAB27F9A24746B0664330B1BA9EE1AB48EDB9D11C362727E5290133C33BFDCC84997BB82C461FEDB9AFE8CC1C155CB4B7622B2BCF22FBD5660240EE0C36124DC6F45D9065B9AF53E1AB19F13D825AEB81DBE712DECADA6CF5B9F870BB47699C3FBF7377A909A11F428E6F8454F120DC0A1E2A3258E69023F7604BF3542546FCF7481B092A503483BAB81FAD6058DC6FF084BFBB4D9DD3AFF2F07915376AF255CDE511FEBC27EA52B0C263BB132BF3B02EE9CAA836228752E273B473D6902E51570F8ED7DFA314F11783CF01B55A78F3D5DDF5ED57B0849E55639A5C2D8360AF6800A780E5F91B3B17BAE8D8811D0BAF6482C983022593BA322D61AF1560DB3FB7C3225DD29FA065CAD1C9D35BFE1FB3F937E35D60AD7671178E75C3044BD5C890D23D787FAE3C19ACEF94152CCE81C087A6DDE0F3BCC09DA253C6F859AB1B3A9749320CA5561357987D63880D7DBF8E846F314A6F14762B82DF06F96F3BAE3DC675AD91DD9943568A8831FB5AB3D7A1B074FDDCD64E00094CC1FAF278B5E06FFD3715F594CEF24C8C5630559DBEED9084BAC5C3DA29CC1494A86BE9F10BC4F88D9AC83B5C8BFE10C5D22C14A31C3EB903CC427E177477FD630AF1FB0FAE6F39284E1DE07C8BA5F7FF31DD86D74E577CCC1FBAD5554CE3D2DD631DCB3F470DE3FE660E3E9379DC5B3A1F9DAAEF269582682D78BE92662D024A8BCC43D0FF041905BC7033242FCCD22522A52E073E7495A994AC503AF0F7BB7CE394339C22C4E28A4FB3250D9E4FBD71FECD0FADFFE0F16B1BCF0ED603137DECF60E35D2E2B1F1278469B9E7FE54B3577091F5B248D1367DD0D12C302E761070E55E5CBED97A3A681D123CBE852047F7886D4B96523FFF1FDA1303A4D55E9C852E4B1DC1A3C506CB9BF447F8A3D3D9F96EFAFC77555D2B356EF58403E821A2A8383440DAF79D91E0DFB433503C088930F360D7F420E21A79A82F12CEEBFDECE44750C8436FD23EF0CC6923F44364F9FE496D66E106C4E040107ACE87DFC7B5EC3178B7B81DD62B93AA82460462A3CD0B225A2E63FC214FFFF7BF70BAF942B5C6D6824274B5A7ED7139DBF8B658FCD34493C588820A94ECDE3DAE04EF0A01C752AFDC4AE9D20CD6FD92CF2868A9933184DEC6FDEEDB956650200953692F552FBE054A48F7700609E24CD085A35E274335C98340F73137145B3D671BF48BCE27C6E23267EF3687DAE7AD17B73D0B9AF0BA11031328EC6AE5BF3CF56A0FC48FD7972E2EF60DEE4C2A6D58EA719F79C7980DBCF1F5B7B652C81F708D8DAE79EC751AF39D3A569681ED721C293D5E63EFD7A0D6EC3AA2800F7372DF4E99C17FFCC82D235EF82EA70FEC325B6AFA6F4D28BD30E6FAD011D414839BAAA470F46CBFA27E51E11CB99B3BC2819F255698D31EE53661F2AE151E443D111386AC93F017259C84E568B1C97D80743C77ABCFFDA1FFE2542CB01C44DC6E07819C6D114D272D83DAA744B40A05413A51BADD9088C8833515FD826126146A06D4D7D06339E398EC1B9B01A9E6DFAAC41C141F3F6CFCFB4C05FD13B5723A51DD9710EA5B3E2DAE5F958AE8D11A2C0C63A9B561FDFC1CEF8B39708BFE1022106462D8FBCCBA64883FD64BE151FF857C44439017F9B76BF560910D21D6E30481CF6DEA715373004B71970DFA06196D8E541B0CE66A1A752188F998465EE68B12DB0A336F6F097088F675E45BA8991ABCEA2C6BD66F2823F6ACC8233EC711684D118738242EA59D4FB749917C411542DA0F67ABB1FB16DEF3541F359FD93732D5814F23029A33339FF1646D19426EAB012276C830B26C3595EA084195D79B2EF408887E754CAA59420D649D57A8A746C2C6CC53FD66E8A0F0E931FFCE28679F76A32F4C019B9AF785A8885A73E75B9D9641859FE0F99F2B2A0A3F87B68BCA7199AA59D13DE0F1AA833A299390DCA5C87A08F3431BE2C0E9643F19EAF7C658D5E6D3A108772C49B92A3778B869A39BD9D435387867FFE7544B44D0400A3C4ACD7C897C36A216B990594CF70AE4D5275CB10373F297491B1B4A7A41CBFE6654AB9FB72FA96F4EFA42E9F5CAE116DA582551557C2EE4502BA0AFF4A65C8F2516F75E6A206E5D2117241DADF1D852CE307F53A3768C0F6C66087122F0D560FC759918AAACD099C0250DFF12E53E68C581209DE4E9B08DCB10B129D592209DC54E2872C5C6F3D929AEDA6A94485690A657D5A4F83D1A0A394A973E546D33B9BB0047DEE4C737F1E26139A700DF1BCB3CFBD7DC6C30AC4838C25C41B558134A87849FF208271CA0CAF7FB7CE848D50ED4DC9A2DA3022AA13C6AF40EE90D4760775AA1089F9A09821A161ACBA27495F9256233BBFAE3F525D47E99D798D08D504338C45638FDE0573BFE9A4D7F13B08425F98DF0863A5BAEE6D74CD75B9EA43370CA63F641F34D7D8A1FD0D6D5ED404D80351657B41DFB0A0FD3F3E361B4D1457A70AFD34CC2740FACAF4401714E4BDCAA19A1933405913682D2BA652B855155E5D0F911FC4BD2DEC6ED384179DCCF266F8B4081DDFC2F9B7EB4681C349FF71CB7D1C49E941193567290CB3450479A75DF287382DA8C9C5D4EC8C5179B609B90BD35B7A346E52883DA9B1C2052FA9778A21A21141B1DE920449B1789FC88615DFC5C91F19E79CA3F11559682EFB480B7211302640DF45CBA7348DBA58A0867FD4646F602ABF0B0B296FF59BBB18AFFAF575B08F9DD6F4E2806505B210A049E39D8B1C99B4900372CD0CB21DF6ED4A927D9E9EDE3090C5DE3D5F2EB7249B820159125D21B980A60BE76E4B1BE093186B1B67EC22057F6D1726A2AF58E8B42AD4BE7BBE154134BB5F3C136257F2E3821B03194B511967D45D67177D898B54E39C5E3CC043BE053309CA54C66C61CB58F862297FE1494E437CC9B75280F988FFD8889CB227AAC82806571D388EBEC9FDA4C3A777984ED5B2C7CD0220AC29CBE9221DBACD7D9C9E81AEE938D3A644A6318E09230581C77E727B4A06CFE7E885C216ECDD8670A85F905ECE81757C3A13ECA8382F4C47A23D02CC3C3F130578D099A3F341FA3D04A72186DA80E18EE68A6CDF46C547C3FBBE35F26E147E195440D9B86B1051301A3A9E523F01361F1F97BB2C66CB039C366B60BE4F8260267ED3B4D8D2B474909FEF7E98B49827467053969F439ADA37F421DEDD5370BDD26FCCCA7ECFBF958EBF6F5579A891D97F087A83F1F6B99570B56992D03F159D1BAE1DB187FDE4E812F6CF29330185CEFA984EEEC3BB61DCA45631B4257FA92FB5A64F61B026DEA7463187908CC5B38BD50B55E0DED2F1DAC9D6513FCD5122B19F44CF48FF5A26F33FF6BCAC444B586FD3C40DA523C4958F5A2B51AE0A97BE7866F172811FD25EC23796E28C1857C162F2A7F09F6318BD157A462AC40D030649EA16A376A49B5DA0174902756A3CD22ECCA50C77B7178AA379C4B6C396BB96AE0F53240F404CE679293B07BB93362495AD0AAC18F785FFA457A3073F18557FE6BFEFB5E59AC5B685D247A363A0CBCDE7B11ED60F8170E0DE1DC9900DB5874B477BFD7DD1818E684E9E449000670703C447402B4249ECA830665BBDD2E2A9E5F3B8EBBCC9EE478CA9C33F7711A9B72040BBF8A8C2C2BED975F7225F803208189A843775B5EA496A89B5E79C5BB9D73F8C5DFA04644B5EEAC03CA1EE0ADFD2827B253F0201E721C613727942BD8F24B9A3046342D9FCDB5DA694BD806D885897BE8B8C33E7A02846BA0947251A9174A40EA907C0A995FDC2F1ED8C30BB50866BC30D2521A45BC96269B5B27BAE15415D5BFC8A5FBD3DE2FA7F28AFA527AE3BF1138EFF4B524A3CFB45670A45A83EF8B127406C049834F4376845C132C9B566E16A8BEBE34F4D744220C55A72D26AE1CF94D0A3A9CF2936D6777215702AB89E2DD3E8106B067932E84FC224CBE35E92E7766195C4F2C827BAFC23E93D28BBB95DE753896618487391B8F445776159F52EB368A662E3DDE3D1C83902B4A85E2FEFB1C1875882D5EDEC9F5F5BBC2080216F74EF28999359DF06F3FB001AF74AD1F2806A71F563598AE3CFCA9813F9603D46770A744F0B038B5E434915C66E218B29C95340BF9B47A343AA04263DE2DD16AB8E3C54CFB1CBC20C7A10C821AA67F3CE48B4682E211C6D3E63AEA517B86C67CC6DF2AF337B72F9BF59321F23FD221CF8D16A86DFA628A25D0B8D49C8BFCC4E43C952FB19599C998487F3C10D25CA7852842BC83F1865E51218258A9F960C3B2486C8B949E95DBF10A286B27B2FF370E1E8C64FC3633D2ACD613E14A28D95C5E610B2642C1084AD5DB268DBAE49BFD9AA60EC03CDCF6B455A95598C1516E65F07EF32AD58B426AED2A03ADFE1B93D25272670150B9FADA3C17E399D908BC7808D5B6BE9496D148BF6AF95EE79693DEBE25273ED266D4A735568B1A2E253063274F5927B7FC089B8538C9A2DAB7D889E7063C5A17DC58F4B222AAC6D52F8E528224BE163C45DCC32DAB982DC5339313E7EFA9E858BFFAD2803F97247C70A5088727585556ECD213A7EDB1E979F7182CED5C5BC7C282230272D83B2E7425892C22F3B9810BA23DD34ED0D22E53F0AE3B8E886667028E2E4400C8C85D6CF5DDC90F270D9C21A028FDD8F3F698540DFFCDCC0E5505368DBAD12A51D3AE97D4EEFC21667894D926A50B92DAFF25F368BA2A363DE61E5D85A9DEDE8CFA3159AD99A20C41D67ABC7CA15FAEC2FAFCFE4C32142478BFDDDF23B048DCBFA4850E371BEBD38A96401D8799A17C97E2876322E8743B6FB6C67F80B072E1959C53BFF1ECF68C928E8B858FC45820D3DD9AA835E8206E73EC4BC0437C8B07A14DAB57EF65BB069AAB65B4D0C9B76B934AAC7DA75BD0A48C53A97B53E2C139DA61D2C6F196F0DF82BAD8856C581D5C0B6F5A53FA1D59A2219BBE0D352A658F5AC82650E77E7C18DE209CF170F99DC2D2A7F9A69418A5BE53F77406DCB9C0056CA1611425BF4B4791078BCC8486176CC1A0534589323B1E2FC2969519DC7B5A6F58FC1AB2B639F913B6C557F4BDE9021FD9D375260E5BF2861817124353D64BED332F07A1ACFC33D0EE58B7008E4A3111D2557A0CDB7678B95754C5DF5201C8A6861C9293A21AFDC2E0B87CDF8CECAD04D47784DB4D19043AB0FD1141E0B82BBBC6EF591F1E94324EB1C08361889610B16FB7EFAEC6304070F3BD802189EDCC7EE5476493F464C7879E6BCA90FAFBBB71";
      const SHAKE_128S = {"pk":"6146E92A0CE7C6F48876970A313C600005D6702B2C1D729E9DD5E7517D2E02FE","msg":"36","tc":292};
      const SHAKE_128S_SIG = "240F5A369C8AE87C92041F618C89E7014F8119197B6A56A3E4CB24BCCBEA3BA2289D6DC8DB14F04D8A3601B0321433A8436E133D7697021B798C3AC6940FF295A76EE8F73570476B1A7E6151DFA9996BE7B68729A243EA8E8AE3CB0E5977C6AEBD02FFC29640687E383562F2D7FD67D345B5233D7FFE98F98BF4A63373185442116731DDFF13C30D0FE3A80A0C7F52DCF9512CEA08987671FE2E21BBC77517607C805F81CCD7D337D08A7090C8E637AF60B516319E82DB00C59FC199EDC06EA5B81372F05A433A13DAED4FC2B9BD3A941AB566832F10EABE7910A946874AA40D2B037222BD6F4158724B1AE82E139754FC9E8A519F9BFFA8DD1161D1F09EC00E233BBBA40B70C06254D4E02EE7E380596C83048B378F2B4F13BFD28BB2E79E6872CE2FD8F2726AAF17B5B0DFE7E158169533952F960CC22BD7F3AEDC32FA3DEDA589DEF2EF2358356F6D2761F1A3F7BF337DCB229F96F7E0DBF6B680E2EE0E03690D7BB9D748834E9486674006A28AC90ECCD6D7EA20F14422B34E35B0DFABB215E8F2C93758D9085B3F1A255A882C0AF5672C977C55F77D4C7069C77D35579B28065FC13D82C51073C7CA4375BE848BE3BEF1420AC399362F9578AD149881982870CD6DA0A4C9F636F780EE884FB54EDE9AAD60529054986EEC1F15815EBBD0DC1357BF466EF078E556F0AEC233E5B67985C9D74AB14F1B8FE566F2D2B7D994F0B1DB657CC20C8E04FAC4021F9AF945AB7EA9B4BF0BDD5A12BBB5F7CE05F57FF952A258B95B1AC070615599685821B943A5F02347FFA48CE79846A2C826FB85AD18B8DD3033E31A941C4D3E3CCCCBCE6B67C548B3923A65E265A89E377AA9E6DA46F988BE5E13D9B3C26AE9F7E22553B18A064A974D3BF5226849CC613B36CB6F1788C7A6B5C2538A26C929B49F5648B11C17E8CB9FCD7BC16175637806F5209D09612D2F9779442077B5BAEFAB7C5877787C90C572D9D43BD1A22617B04780619C448A655DA4D94C0433C931513BD9803A4EF667E20A3DCF6D6366B536DC0135D0D19D5066313A9F11112F35205D5FA304FCA0258476B6B00013A90F2B502E9B8B01496CEF50EFE469C9570704486854E6AF41ACB248510F387832580646EA9175FBE2ACC335FDFCD5D0A0802E50AF2232B7DCC37DAA6F439004D4B671DDDD5467D633CFF661EE9562DA3B0CC610CAFA11848145B89FF0FA70F599CAC3B79943E710A0CF05F22ED48896A3277D4EC5E13B753C290A7B3B16EDAE9D51B258DBAC9BF7306FB953BBD65D8CF0A63B5E0AAFB8A3F16CC5E49B684CA0DD1A07241464ABB09D529FCE5BECF34915DE5D895A6EF18F432B942EA5022564FD75B192118D7BAE7C43D5765D998D22F874F78246C6E5C9965BA48E393E627036EE136C18603A11F75C099FC4B520379ED77792026AAFC82CE77DC1B14C38C990981A2201BBD9D646FAE979796D0EEB8F698CF1E0ED19956040794EA5E65B3273551767ABE89181A1A3A83C29D753C8F2196FBD3C98C5D8E3737C22CC1D1A7F39D58D66D9416E1BE2FF5541A725C6E1AA961DFE0470DD3E90604983A3368FF1AF4ADEB5C64AB42F7B4B8E5C13C496753A6C3450DC9458F5143B1C73725530E4E736838DC386E45E199F82B168F94ADFB2A974D6F361A0D4AD3C79B29DC08C05E770F4A6F551638F2ED91CE2414484D2464CB6EEADF7948653A547BED20211DF7C8B832A07FF00E1645A30226175DD6586A269C24F79FFAFA6EF7245F4297D4F3A620D29D00BEF65985EF9CBFC662186C3D495D769FB1BE8375FB64661D0F10E28F375DD9D45188C68B31874C4AFAD103C0D94F244A47DD254A18A4347780D0DFD28F1DB275BA802610F34979B35B989C1EFFAFE6D01BEB43638873B812BB44DE467087ED8A7A9236444AC60CD00BF2EC5B9247F7214B41A7505636CF1D9A7B58142797FB8639CDAD6CD8F1D1CCCB8387332B076A28BA66BDC4210D147D1A84FF1DBB62DF9BA263A6D906C41E6AE4427D22420C3BBD536EDCB99F8CCA685A1E2984FAA42F70B1CE011D363A30CF9F17FEE9B23244693047F9D23D9F22713D1683CDECBE7411A494F137AF8B58937FFFAE705F5995B21B15E1ED9AF5F7955D46A17D9C083D45E8A0CF07048758D23068B28B1BC2F91F26E49736F109B6A26604FFFA65590417478C1A1DE4D26399B3F8F4994C1B2EDBBCBEB488CB73917B8D401B5998E106FF530A8AB702641E83E1937F7577A67F1215BCAFB0B46C751B91F96797227C3FFAD8CEB702B0806BA7F400E7F6C999F78F107A84846063EFDA780B889905169E72C8B19AEC835B888109708B869A82D6E5F169D149F6BA439F0A53A24A3015EA98A0BCBFAAE225EB4B8C8A15A7D2606E7A4E7C87233C0BB41AB7A4C9A41A2B02CBD10E2C4483DB39271BEE88E704BED3889D127DF9BEBE8E138645C4B44B711D4B1537B85E9D5ACA16BA00C204556DE541746B79E2BF6D9CD92D0B1431474A5AC0310E6787565EECF97077BBBACE032EBB807F5E6590426C6693721409C5A6F4A8C0713F1A10E26F14741A61B426CB048139DC796F477CB6C3BC643BAE01AD81687B8798135C9AB456EDEE4B562B254BB4A66678A03954596BF28AAE95C43851F7A871368C1C145486CE7005E54FA681DB115B74C4933466C4A27DACAC79F02189CD934303FAFF913532212314F2962FADB2C6D02118E58B15A51EC99AEBE5121DBCC5E0C7C144351978A86B6379FE29669AAEA73CA90C4BD2CFA683891B4CA68C607C848E048E102B811CBA7DAE0BEA49F9653B1C7EA07DA24307298E3A1CFB367E24FBAF05ED014E0E4634D428474A92901E0E6279E6941EF85BA769DABF8B9ABDB5B30B29A3E251860B34D3D815DF375C52E8CC78A28FABB91391E350086F49747C08B3D0ECB1E076355DE81139849BC743724DC86AE09A369B8B746C1772D486FF742F3A0400A55B8AB534B848B3C67950663F7EBC7981F4F28AE02DF69EEA5D3722ECF64DFFA53FCD41AA6251CBD49E94F5D9A6A50AD55733E6F12E9E5BDDE6F20B31FD6D6C187052CC0926EBDCA2BD33142A8071B4EB27A90711312842F69BC1336A5E1C6EFAE9DDBBEDF30C0CCFACDEE9376ECF9E3F5A04150C07116D3F118F1F96E8273D0C5995D1164CFE47DBEFCB50D797BF297C550CCC8632CF2BCFEE37D2B23C8CF1DF3F05BE53BD32C503AC755CCF11C6DED382E7589F904FAA5A784425723097DE4A1625ABCF888072AFB6180108ACA3B1B75EA9FCB456D1670474D3FB4EC97F8D08CA57B7424988F3461B2595361E5BB5B287DDA40F633DD97A57C0A556C2E2140948DE2A4FAF61089CF6827532A29308E8EE857369F79AA0D15EE5DA862AC52CE4A15FE82EA8E9622ADFE09097A9998656E89922127548030CFF4BD151D2871B862838665D7F0575D9973E0AE675A82C4DE26AE84503FA58022A75AD8168C283650827E5EB7E474BD8A594EA0C2F6AC0FED5ABCB530EF603ACBE7A5895C7BDEAF3206A87D58EB3B30EDA6FFB0230563BFDCE35926E2F9A4DE0E0AC11F679F9432E2B44D2EE3C45CA2422739966E9026887B1198CB2690C38D39619956D8001576801335258B180933F02DDEC7C43D8115534EEEE302B8226F4F6771621C237ADAA1B42509646C26DD3E653D1F32F6AC735691DA15D160EB1C8EBBAE250CEA3BA7CB102380F543C6E39D1E00D71B02639320346A737C276B1FCDE7039595D1042CB471CBC722341D9A9A5116F5A31E08A13A27DE3D736623F6E630E1F04CA1692D3612F79DAB5CD22F90354D0F35393001B98FB265544679E08F632FC7C41037840D5B743168EDFB80C003C3D343C39854C4F14E9BFE1C9E9CDF4948CFE3820F320DFCC2679C7D2914F4ABF83E89EF024B97155E3A3F24AFD8855AE799553A840674D6C8D2FF22D2D859E6CF0927A1348A48B647340BCAFDCF65D720C44F86E216D8296A03146E8F017CE5E0B6838CF2AC352CC63A2FBCE1A7634EE1D7980C045D15AA9A06C809A6B670BC851E737E773C316726AB4740DEC14BD59F7B52CB3D769C4790CFB3E07FA695A524D0C9104638D37C732915ED18B7BED55207FDDF8BD0FF000EFE5E1376E98F86C6BAA73821439F8E89E79FB024F8157A5A3F95EA031D609D77EFA2734755D8063597F31FE9A2D7F1F0C55ED3A413E55F1320BF21BD045FBEE32167577B40838B0D6A000B8B446B5155CB80E25E2767F293E8DEFB4C56AF6B6D69B96EAC34BE346AF84FD7B189FB74512F0C0634619615E4E408EE67DE66E1D19647EE47975CC654C1A8E8B8582A8882ECA6699FB61D486E83AC08C5B26F50C2B4C55D47D4EE9E184B42ADC53632C32251EE5673A66D4C0E24232842D4020D73E163E0F6B67DDC641C7D451710CF2A5E21E82589A75E9274C2C774507BAF18DE496FCAA78B24B6AD703FBEEED6D0D39DE5CC5C26F2B360C07BCEE1B330AC9E84577546EC4E5AEBAFA17CF9AD9566C60BEEB1B619305B695E7273D401571742CE64FF9701BF8EF935FF78AE41DAC43CBDC7DDF16A4FD523896891D03CC1EDD8AF0ED96380A12EBE83C67ABB768B9E94C7F6DC38F76DBE1674048E717D5DAB0035C0F62159AF4CEB7D13B28969D41681FA3B3EB149F3F162672C365695E609F71A0A224701B223693CDD8EAC845D9DD40EB0DCE0216D15BA24FE8A1F172670898B244BC67458FC64ACDEAFE4E78CEEA64DAF37B92CA01DC6AB3919B4828B58CD1F470010D1038ADC7046A461A008F622566014BFDC63580083E2563075BFE2461D54B4B0B596240B498A902ED70724891B93B4BDA7BCF0F4213A4BE105608C01039B9FA3042A0A88EBDC6B1FB6F6F4A1DB29D85B2A3979BDDD42C12B5C5C0361AB83ED4A67F45E29193BC2B488E2CA09EC7C6FB5A1A01909B27BCB2EA30E93EFB74A362A52033BA44639ACE350356D56AAE642E928BCCB7CF7989D90B4D995A1E862A50ED692E4E42F409E30C8856538CD9E02E1871BB8546F24F6BA3A23D534C6A18DA54A072C66E05DA15533696466C0782974182B78281E9171AC228487845DDFC19298A4431B1EFB5A0775CD208BF0178AC46A20E5CB3589C265B77A7EDB4D25C70032E4E3A58BF67F323F0744CAC3BC0C5982859B6490C34CA3DDA701C41B4EFEA99BA7BD1ACF0AF708CAE874E0900AC855646A3EBA50C9EF59A0F1F11FF174FDA538336530E75995FF4BF3806504C1EA55B14CA63413024480A30F1435D5006831FFC1C9CDFFFCB03A2E6E5BECDF0AE5E799F2DFA2DAB9D5D37F80ACD21071AA01961F471F6C6331F20B35A3E27F4F33F034BEF1C98FA0C0742BCE0423B52733BD5BA8054D5E892FEEDB4474A329A5CE2BFE63FF0045857F4268E0B487D171046D342384A3F5726E57179E06F93A39A6D3AD808074A0075F8AC0943EFAF4885979FD7186A8525EB9EF4957CDC8808FF17680E8A8E7303CB5EE4CCDE1BC9F2F95D6E454C56742AFA1F65EBECF07A3C00944975FED7610DB113FD8FFB43AC5229A21BDC4DD8A9E5BDD0FE4539E1CBB91BA456C0FF92D431A0859AB7FF1C9E685CF252D1865C948EE44779463AB4B596F0F159CA4E3CFCCCE897114C0541CFE92BE9694917661A2D241DA65DADD71DE58AE62C243681F725A1EAC25F8CEDC50924D0CF5B7268EFFB313BA21C2BE0D23B72B6DEC17B6FE3C6DAEDF775061014F3E3583BE35264107C647C398A1532C640BCC460CB255647FF5D336BE7134EB069D9D4BEFFAD962191A46ED4AD874AD88F84D41893F58BF8E4596D90850DE10F6063C3866D76C2792CAD1735CECA9A968D666FC976F2CB2C8770B29EAA3DCD3ABF50566CE02F2A45B8808B0189AFDF30C3EAEEF8C77B496436C26CDF83D6A570A280485CA54DDC59560B5D9058679E311B873298367BF39F24A0EAAA61ACA4A1CE38920802B9378D5A205AC6AC2F27655B5F75FC1AD26A754061A85036B93B64F046576753EC3713D4FAB5BC8534AFE17BA3B52451CD7DA29D0EAFBD93733BB548E54A24E97622EBD28B8210094BA62239516B4F3AF9427F863D3E37BD158397B698067EF2728780AC6ABE5ADAD599A778D7DC059CBA463768C5B8B872C61B99646E3328A25D7F9C89DA60503E69FA337933BED051232B1C4D8331D578DCDE5CE497C4642F6924B99EC1C300C67ECF1AE181CBBC9364903C03F0E1002AC0B9C9E073196DEAF891B6FC0E872AA560EE750D94D950D83EA18342E9DDCB9A7C11EF4749642E24380A438CB6D838F79369C61C07EE79666FA61E60BFC0FC0663B97BFAC4C7CC8CDF8B01F9B2B49E4C47C4634285440899D920EDC39F49D60B57AFB5855A63B490B801E37D1F7BEDA327A8352A4D6EBD8F6DC551267E9EDCAAAD8A218C82BF65E00D04C94DED1AAD337C57276243B896560CE690C6A1B981F0C814CAF3B5FB70B1C00F7EBD891535211417683AF1E8C48750C8F75B121D878702B0B7A0C352E95A0D1C65822C909CAB220041B1AEE75DA22B445186261FBC7CEFEEC823100B1C017ACB4CD01FF698AD3B4C044D328615B344CEFE8724E67A6FF3A684EB0DD947E430C31F6C31659F1182A6B0DA81BB5A585C6AB8799FFC0C88A9BCECF89896922B55133F4BD779D460B965465506C2D293D6AC06C5DECDB96F1E7EF5A7BEEFBCB01FA408AD622A3D89272789774A21D1863779590E0E7AA059B597BCA7DF6650CF243E82AAF8BB5091267A212A2FEE0A8BF3AD97CB2E30A9C12D3829BC9A54AB98CE9CD7790C7B6DBF4ABA186C9629780B3B7C31CAE6360D00D49F3DA1CBE515B0C959F1AA3F4710A430ECCE7C8C2D6DD7C1EFE2C6096BDA047258B6215FF9909CABB571C889C40890B6507FE9CB854E3A8AC426DFB5A008344201CA045F74C87C81C9718B1EADF89C651663B22136F353D41EB32D72A002182DC6E3249459D488D481B01AE471A6CE972EB280554196F9B42C7D029A74E78352BCF4FE0FBEBCA5C91C291181569969341AB6477AD8339707D753DCFC045BA4B6ABCBF0EA955216C53AF3F131926069153305E7F8CC21513CEDDA7B08D672583B135FDEF6BF725F344970D38B03A875720FD44A18F62A89E4216F669A809D18DAD80F8C2354877E195F1F3EE6720C1DB3A3C80FEA5E842FDBCF316528F9A3E0B30223655521ED965BB164C125D897B27AA5A58A50B5926C1E6DD0F53D3747738AE79DFAE9E494F77D99C70AAD56CC225BD8CBBAB28EF9EF6628A0AE1E3D9257E952FC2824FBF206115273127D42EEEA709A852C6623E61C2265B3622DD979DBF4C400677B2135C8879F8BF99DBC844F3EE7F771A154C81B57221B569437D17D27EAE052AA706A10BB33DB767CB431892357BA9CB2AD291309FEDA784E2116251608C76CBAB9DFBC1AA90FF00E097543309C59D73603142DF566DDA1D7060991B57BC7CF590CB60D20091297030A0E7D381935115D6964807AB1D886F786DFE577E0B768AD4E270D45970D30E682413EFEA60F0ED8B3C8388C648CD16A09477A97AF103979796A195DF17894AEFDE94EFF3433D9A61B550B23CC838308E6A11729766246F1F44D6AEF529D952826D2CACA1862BFA704B3790BBEBFABCFE4C64884412EAC384C4EEAEA18CE55C5FE99F20C8C0B460CCBB3190E6CA82B1A8EB5D23585D2A6A82D179EBE191854BA71881A608C8CC1C0170EBB0B6146AB873A4E5775B720D15BB1F74EEE9DFF3206D3EDDF5372E086F846E9ACD8D5E57D939A3C5C4D05A9E938FD26728FBB4BFEA4BEDEB100523598ABF80391717A054509F042D3AE66DDF71859EE3725DEA87980C2F8A20D08256BB9F5927C43F6219D9C72B4A370D702C6708AD3D69CDD6F06B8EB5A19ABF773C979009F317A38FC7600798C00261C83789807DE13F10D18F9CB379AD29DB4ECB86B0778F8FAD9A08AE2078BAA39A6E8EC6814D61B1E3660C4E87936CD9D66C0E17AA1CD46006B8DAB0FBB9E96FE04744F07E44B62A80403A596F212768C57F0C91F543D76BD853DEC0D6CFD91F10E146C4BB43B9F48F4DB9DF9BB17C46A2E1C2901CA6967A1B859E01342F4A5C2334F0D147E38C0B025F0408DA73AEE4F5DDEAA4338D0FC82F166D5B9F413B8E2885E2E89504809A8119C08AF2BBE17DFC69328397AA3DC8E00A58BB0BB6E9E75E54C3546863BF177A46EF9CB56E292E447F11C784CCDB195F7AD9AAAB66181BCE32C378A7542D53F18C87108A0BFE8F73D1A9E9A78187D15F2740344EB84BFD6EB492DD683338064F2FB09D98F0015892B793DEDE06466AFE6C6B65AD46EE54F8A77685173414B91E4734A6C376EE0B915A07BAD5331C221C13629E511FF415D236E10CC9FD8654E67100441494EAC6213D0B6F37BEDB2356B0ED1BD3A9DB27017836D939FD3354B841E599AA939535DE774413FC3EA0B7D9034776F825C85233B58F8FDCDB0A5873E4F47F55784CD3A59FA88E349E04B7FA586E3E35B2D0F2E8A59BA6E56105DAC18ED89CE2D833BA691A0E67824109846CAD5D1026AED3745862BC79F24306D31A41EC5E82C2C4FA717A19A50E734EAB27FAC1645B1E3581CCCEC69FD5B959CB6AB611525ABA9BEACFB6F1713A21EFF4535B279E869CA8B59E5D2F6D0155AD91EBB5C811E5A5EC90DFBDB9AEC3309B76BF439DF9321F30578D3D0CF2C19801FF9A26E79764B2B2FE0ACD8D6F6211E2415308F946440CC37A19FD08591F2DB18857C3E29818F4F1A068F44E82F8AE2E4757E4CEE65336BDE75E8CB41E99BDFD8E276D279549CFAAC590245A592C338E2D516CAEDB195C090D47D06C3642C49D99EE0AD710540D42CDE7333CBE9F112D18681EF0397DBA3D229C07BDCAE17442A842C8FE25D7A413B2C1AAEF7A59B29DDFEC8099A9DBAE40F8DEC76B856AAD8076782DB097E339ADED9EF81270D3FC2D005D9FDEED761D67AA17C1C14537E990F3D8005BD42292162E5F61288B8C89D02B64B59AD0058E8A6C6CFDFD12F32CB7F0B51CA61F560CBCF02481B15A3A88656427A008BBCFFBF0D316FD69A95FF69A77E82D4414B85BA55ED7298FDCC478AB895AF39BE31880B61BA96970B7CE1C70FB3D07C2538F1D27118D13A46B2FF8B46BA82B11F46BD6A85C8ADC18E2EE46F9CD851541C2666D430F8B0A2B692A3EE4F4368BDBCB307B3DF4B2309FBD7FFFFBC170C04CCCDBE55A14DDE27ADA6B254FD2F903AA9F691A7B48739D38704DA1A2DDD3138123D95652EEC68D508DA83C15E4A9F125AD85087EE67849C2FAAFB2946A4161329E10A3C5D2E03B97AB56B8DC49250BD74CBBB0E49993D5910F4CB89AEED7C2921ADBEB504A3FF8F5E695FB8BCA0BBDDD39A3BB5494E1BB4CE6AE729D1E48283E33F59919728972198534B69507664F5F1300C4BE883BEC80E662B016212DB4C662E37784164F9C6ACD65F402D13C073B70F9ABF8BD7832A7399963287108C09C8739C56251E94B41BE53FF44F3FACC8F92DC9B2E7AFA886A9D35876BD919E439393CCD9FF8FB041E51277737C176D5317960153FAD28E28F4E36E016F1813E11C8F7FB276B8C0C81071CB08F5D8F9B31B980A758488CC915C2107A40A57DFE324E68EF9B15E35800C4D8D82AAABB6E35E31FB83ECB01F274766FA2A1A94FF0EBDC4EF13205EFF97A90129438BE1B6DA8C5C16647D23FE001982DBBEFFD600820B165DFFD668C9E0606CC0C6EF6C8F38034FEED7C6617A5AD41E63112223EA64E32CEE3AD05716881259740F68EB4CA31FCDC119FAD5476E5FEF69CAF8BC77A72DED537B05CCBAFF156A3C9717BE11A1871C2C1916001E30C135447A9519CEE73DD92C9163088C92B9D815599FD178101FDA23A158499D40E7F6ED24E4A5E92A9F8665EC027EE969F7A789ACDECC5485C7AB4091FB9AE0FD207A4C31D60FCA0ED0CC38C68DBB3D578FC0494DB686F37431ACD2E02C7313E9E70AA67E7E6D5BF522607C99C0F39E9A050F13B3D94D13D3F99B79114334280EC84AC6EDD1D5CE81CDD7E8103C929572F61E324A0D4F61B9292B95A45F92ADDBD5609DFAECE0F9C9DB6B84B925F6C893B1554D41E9343ACA98CC91A8E33591A4A5674A1DFC0D8667B45C6B4BC405A492AD1BA403AD1BCB05A115D3B58C1E91669DFFFB618A53A4E8A905E1416513B94FDE7D89FCF3A92B503941CEA7B604B253B3E789FBE1441D4467ED8D0C0759E3DD55CB0CD9B972F90C6C42DA340AB0005E335C39EB01453403DCA478D72EA9BE2258D98818BCC3F421FFEBF6EF8C82B26131C720BA8F42145427DFD028D717310C1F2C67091DCE7480DCC66FE9ECE630DEF01EDC910FEDD3044ABC80C227C22749F1A039F2DF180FBEF3470471C47E75108ADC2C04F293654B720A4E388A1A3A4415378C4BEFE6036E2F9323FAA077540BDA092EB6AF364DAD5AA0D681245C3EF7BB435ADAD560A8436D27F1DBCAB1EE4C8627ABAEB48F36B9130D9BCD07386E4ABAD2DC459DF127C571A71405E78501AFA723E31C3E6CCFAA445B05410D88F29112256C1D8F01F3651DEE997239DFEBB2F7FB44E4D826E3EB3605F4F5DB9577922A1EDB7DCFBED2AD4F356D15F4F578E8C086D7F8929335DD97CD7B20D9DA3A9CA4B14C0982167150E109E70C8911C3F116E8EC21FE46DDEFD6D9442739FD8C5465696C71B554C00F04A7D56CE9EE0BDAAA6AFB7EAD35C43D45B9F7BB8540F136AB046CB0364ADE8474D3080308579448903A317F35184ED982F095F4163BEA6DCDAAA48DEC068D5769CA9BB6E4C6E2AD0C0217A9DD13B82FFC1C10206DBB655F66CA6D5DB50B9AEC648AAEE5B6C38A01673D9B716150FE00F224AF0A32FEE7B1AF46D367065B15AC9D368815D728734BFFD4F7BB23F036B1EC5CE96CBA1830005C4097FB984F150D8CC91DC3D609696D738F14F5A9B2C54DC49EB6D6AD6AB5608B7B99002999C2B82311A0EA8E8E445654F4BBAEF9E5C38A47B353B73C223C351A2C97479D9E88AE005B87A22AED5F0F80543CAAB37AFDDA68277E32CF9B7FEA8D90D859A1487E7C48432ED3168AB975CF69996710D960F48578B0AAE28700DC8E34294F6AB2EB01605907495E14D59ABACDD3E22BAA894DCD4A0F64540FEB403E78792026E2D0A548F0C68237A7E33C978567629BE67EBEC98DCC90AF6B481FDAD3AD7836927FF2E2E3BD024386A53E03A133DA613";

      // Flip one bit, to check that verification actually depends on the byte.
      const corrupt = (hex, index) => {
        const bytes = OpCodes.Hex8ToBytes(hex);
        bytes[index] = OpCodes.XorN(bytes[index], 0x01);
        return bytes;
      };

      return [
        {
          text: "SLH-DSA-SHA2-128f key generation, ACVP keyGen tcId 21",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128f",
          input: OpCodes.Hex8ToBytes("C42BCB3B5A6F331F5CCE899253C6D9E29FF2B7EAD7A04BAB1794DB8CC659C3B4A868F1BD5DEBC12D4C9FAD66AABD0A94"),
          expected: OpCodes.Hex8ToBytes("A868F1BD5DEBC12D4C9FAD66AABD0A94B546DF247BE4C457F3D467CDFCFABD39")
        },
        {
          text: "SLH-DSA-SHA2-128s key generation, ACVP keyGen tcId 1",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128s",
          input: OpCodes.Hex8ToBytes("173D04C938C1C36BF289C3C022D04B1463AE23C41AA546DA589774AC20B745C40D794777914C99766827F0F09CA972BE"),
          expected: OpCodes.Hex8ToBytes("0D794777914C99766827F0F09CA972BE0162C10219D422ADBA1359E6AA65299C")
        },
        {
          text: "SLH-DSA-SHAKE-128f key generation, ACVP keyGen tcId 31",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHAKE-128f",
          input: OpCodes.Hex8ToBytes("3956AB391B4D22FC907AF0740326D061AB0EB206436F2B86EBE086D77739B3E456505C229F4E7FA6B201714C7DCC9DA3"),
          expected: OpCodes.Hex8ToBytes("56505C229F4E7FA6B201714C7DCC9DA366578F1F24C3FE371C97C14CE0E79CDC")
        },
        {
          text: "SLH-DSA-SHA2-192f key generation, ACVP keyGen tcId 61",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-192f",
          input: OpCodes.Hex8ToBytes("A021B4B9D6DEE168722BC10225E50A946642AF630C3C7C7D69E3A40BA09DF2AC165B792A07F064AC5FC28D8C99A580F4EE4823D09E79854706DAA80AE3179B5BC8C2E9409D6328A3"),
          expected: OpCodes.Hex8ToBytes("EE4823D09E79854706DAA80AE3179B5BC8C2E9409D6328A33577FD584BC0784C559CDB2437A46F7F753C336369419ACF")
        },
        {
          text: "SLH-DSA-SHA2-256f key generation, ACVP keyGen tcId 101",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-256f",
          input: OpCodes.Hex8ToBytes("18523702A0FE2C9E488948B127185BAB93D3F02C3D7C23A1B379F762DE0509E56AB0D9F93540BD809D1D2E8A050440AA81E853750470E2B00C959DBD3BE40E2BD7125F5D00BA47F1FC8D4C32C2F57C444BD384D7CE770BC50DD5980C1D1264D0"),
          expected: OpCodes.Hex8ToBytes("D7125F5D00BA47F1FC8D4C32C2F57C444BD384D7CE770BC50DD5980C1D1264D00AD5197FFCBAAFE11B1E413F26ADB1504CE1C3F5C40C1DCDA14E99FD126D5B81")
        },
        {
          text: "SLH-DSA-SHA2-128f deterministic signature, ACVP sigGen tcId 115",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128f",
          key: OpCodes.Hex8ToBytes(SHA2_128F.sk),
          input: OpCodes.Hex8ToBytes(SHA2_128F.msg),
          expected: OpCodes.Hex8ToBytes(SHA2_128F_SIG)
        },
        {
          text: "SLH-DSA-SHA2-128s verifies the ACVP sigGen tcId 276 signature",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128s",
          publicKey: OpCodes.Hex8ToBytes(SHA2_128S.pk),
          signature: OpCodes.Hex8ToBytes(SHA2_128S_SIG),
          input: OpCodes.Hex8ToBytes(SHA2_128S.msg),
          expected: [1]
        },
        {
          text: "SLH-DSA-SHA2-128s rejects that signature against a message with one bit flipped",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128s",
          publicKey: OpCodes.Hex8ToBytes(SHA2_128S.pk),
          signature: OpCodes.Hex8ToBytes(SHA2_128S_SIG),
          input: corrupt(SHA2_128S.msg, 0),
          expected: [0]
        },
        {
          text: "SLH-DSA-SHA2-128s rejects that signature with one bit of the FORS part flipped",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128s",
          publicKey: OpCodes.Hex8ToBytes(SHA2_128S.pk),
          signature: corrupt(SHA2_128S_SIG, 64),
          input: OpCodes.Hex8ToBytes(SHA2_128S.msg),
          expected: [0]
        },
        {
          text: "SLH-DSA-SHA2-128s rejects the signature under a different public key",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHA2-128s",
          publicKey: corrupt(SHA2_128S.pk, 31),
          signature: OpCodes.Hex8ToBytes(SHA2_128S_SIG),
          input: OpCodes.Hex8ToBytes(SHA2_128S.msg),
          expected: [0]
        },
        {
          text: "SLH-DSA-SHAKE-128s verifies the ACVP sigGen tcId 292 signature",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHAKE-128s",
          publicKey: OpCodes.Hex8ToBytes(SHAKE_128S.pk),
          signature: OpCodes.Hex8ToBytes(SHAKE_128S_SIG),
          input: OpCodes.Hex8ToBytes(SHAKE_128S.msg),
          expected: [1]
        },
        {
          text: "SLH-DSA-SHAKE-128s rejects that signature with one bit of the hypertree part flipped",
          uri: "https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json",
          parameterSet: "SLH-DSA-SHAKE-128s",
          publicKey: OpCodes.Hex8ToBytes(SHAKE_128S.pk),
          signature: corrupt(SHAKE_128S_SIG, 4000),
          input: OpCodes.Hex8ToBytes(SHAKE_128S.msg),
          expected: [0]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // A signature scheme has no inverse transform: nothing recovers a message
      // from a signature. Verification is reached through the verify vectors.
      if (isInverse) return null;
      return new SlhDsaInstance(this);
    }
  }

  /**
   * The Feed/Result contract carries one of three operations, chosen by which
   * properties the caller set:
   *
   *   publicKey + signature -> verify the fed message, result is [1] or [0]
   *   privateKey            -> sign the fed message, result is the signature
   *   neither               -> key generation, the fed bytes being the three
   *                            n-byte seeds SK.seed | SK.prf | PK.seed and the
   *                            result the public key
   *
   * Nothing is interpreted until Result(), because the test harness may set
   * `parameterSet` after the key and the two have to agree on lengths.
   */
  class SlhDsaInstance extends IAlgorithmInstance {
    constructor(algorithm) {
      super(algorithm);
      this.parameterSet = 'SLH-DSA-SHA2-128s';
      this.privateKey = null;
      this.publicKey = null;
      this.signature = null;
      this.context = null;
      this.optRand = null;
      this.inputBuffer = [];
      this._engines = {};
    }

    set key(keyData) {
      if (keyData === null || keyData === undefined) {
        this.privateKey = null;
        return;
      }
      this.privateKey = ToPlainArray(keyData);
    }

    get key() {
      return this.privateKey;
    }

    _engine() {
      let engine = this._engines[this.parameterSet];
      if (!engine) {
        engine = new SlhDsaEngine(this.parameterSet);
        this._engines[this.parameterSet] = engine;
      }
      return engine;
    }

    Feed(data) {
      if (data === null || data === undefined) return;
      if (typeof data === 'string') {
        const bytes = OpCodes.AsciiToBytes(data);
        for (let i = 0; i < bytes.length; ++i) this.inputBuffer.push(bytes[i]);
        return;
      }
      if (typeof data === 'number') {
        this.inputBuffer.push(data);
        return;
      }
      for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
    }

    Result() {
      const engine = this._engine();
      const p = engine.params;
      const message = ToByteArray(this.inputBuffer);
      this.inputBuffer = [];

      if (this.publicKey && this.signature) {
        const valid = engine.VerifyInternal(
          message, ToByteArray(this.signature), ToByteArray(this.publicKey));
        return [valid ? 1 : 0];
      }

      if (this.privateKey) {
        const optRand = this.optRand ? ToByteArray(this.optRand) : null;
        return ToPlainArray(
          engine.SignInternal(message, ToByteArray(this.privateKey), optRand));
      }

      if (message.length < 3 * p.n)
        throw new Error('SLH-DSA key generation needs ' + (3 * p.n)
          + ' seed bytes for ' + p.name + ', received ' + message.length);

      const pair = engine.KeyGen(
        message.subarray(0, p.n),
        message.subarray(p.n, 2 * p.n),
        message.subarray(2 * p.n, 3 * p.n));
      return ToPlainArray(pair.publicKey);
    }

    ClearData() {
      if (this.privateKey) OpCodes.ClearArray(this.privateKey);
      this.privateKey = null;
      this.publicKey = null;
      this.signature = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  //#endregion

  //#region ===== REGISTRATION =====

  const algorithmInstance = new SlhDsaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name))
    RegisterAlgorithm(algorithmInstance);

  //#endregion

  return {
    SlhDsaAlgorithm,
    SlhDsaInstance,
    SlhDsaEngine,
    DeriveParameters,
    PARAMETER_SETS,
    FIPS205_PROFILE,
    SPHINCS_ROUND3_PROFILE
  };
}));
