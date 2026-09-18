/*
 * ECDSA (Elliptic Curve Digital Signature Algorithm)
 * Production-grade implementation using JavaScript native BigInt
 * Supports secp256k1, secp256r1 (P-256), secp384r1, secp521r1
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Reference: NIST FIPS 186-4, SEC2, RFC 6979 (Deterministic ECDSA)
 * Test Vectors: Google Project Wycheproof
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ===== ELLIPTIC CURVE MATHEMATICS =====

  /**
   * Modular arithmetic operations using BigInt
   */
  const ModMath = {
    // Modular addition
    add: (a, b, p) => (a + b) % p,

    // Modular subtraction
    sub: (a, b, p) => ((a - b) % p + p) % p,

    // Modular multiplication
    mul: (a, b, p) => (a * b) % p,

    // Modular inverse using Extended Euclidean Algorithm
    inv: (a, p) => {
      a = ((a % p) + p) % p;
      if (a === 0n) throw new Error('Cannot compute inverse of 0');

      let [t, newT] = [0n, 1n];
      let [r, newR] = [p, a];

      while (newR !== 0n) {
        const quotient = r / newR;
        [t, newT] = [newT, t - quotient * newT];
        [r, newR] = [newR, r - quotient * newR];
      }

      if (r > 1n) throw new Error('Not invertible');
      if (t < 0n) t += p;

      return t;
    },

    // Modular exponentiation (for square roots)
    pow: (base, exp, p) => {
      if (exp === 0n) return 1n;
      if (exp === 1n) return base % p;

      let result = 1n;
      base = base % p;

      while (exp > 0n) {
        if (OpCodes.AndN(exp, 1n)) result = (result * base) % p;
        exp = OpCodes.ShiftRn(exp, 1n);
        base = (base * base) % p;
      }

      return result;
    }
  };

  /**
   * Elliptic Curve Point representation (affine coordinates)
   */
  class ECPoint {
    constructor(x, y, isInfinity = false) {
      this.x = x;
      this.y = y;
      this.isInfinity = isInfinity;
    }

    equals(other) {
      if (this.isInfinity && other.isInfinity) return true;
      if (this.isInfinity || other.isInfinity) return false;
      return this.x === other.x && this.y === other.y;
    }

    static infinity() {
      return new ECPoint(0n, 0n, true);
    }
  }

  /**
   * Elliptic Curve over Fp (Weierstrass form: y^2 = x^3 + ax + b mod p)
   */
  class EllipticCurve {
    constructor(p, a, b, G, n, h, name) {
      this.p = p;    // Prime field modulus
      this.a = a;    // Curve parameter a
      this.b = b;    // Curve parameter b
      this.G = G;    // Generator point
      this.n = n;    // Order of G (prime)
      this.h = h;    // Cofactor
      this.name = name;
    }

    // Check if point is on the curve
    isOnCurve(point) {
      if (point.isInfinity) return true;

      const { x, y } = point;
      const left = ModMath.mul(y, y, this.p);
      const right = (ModMath.mul(ModMath.mul(x, x, this.p), x, this.p) +
                     ModMath.mul(this.a, x, this.p) + this.b) % this.p;

      return left === right;
    }

    // Point addition
    add(P, Q) {
      if (P.isInfinity) return Q;
      if (Q.isInfinity) return P;

      if (P.x === Q.x) {
        if (P.y === Q.y) {
          return this.double(P);
        } else {
          return ECPoint.infinity();
        }
      }

      // λ = (y2 - y1) / (x2 - x1) mod p
      const numerator = ModMath.sub(Q.y, P.y, this.p);
      const denominator = ModMath.sub(Q.x, P.x, this.p);
      const lambda = ModMath.mul(numerator, ModMath.inv(denominator, this.p), this.p);

      // x3 = λ^2 - x1 - x2 mod p
      const x3 = ModMath.sub(ModMath.sub(ModMath.mul(lambda, lambda, this.p), P.x, this.p), Q.x, this.p);

      // y3 = λ(x1 - x3) - y1 mod p
      const y3 = ModMath.sub(ModMath.mul(lambda, ModMath.sub(P.x, x3, this.p), this.p), P.y, this.p);

      return new ECPoint(x3, y3);
    }

    // Point doubling
    double(P) {
      if (P.isInfinity) return P;
      if (P.y === 0n) return ECPoint.infinity();

      // λ = (3x^2 + a) / (2y) mod p
      const numerator = (ModMath.mul(3n, ModMath.mul(P.x, P.x, this.p), this.p) + this.a) % this.p;
      const denominator = ModMath.mul(2n, P.y, this.p);
      const lambda = ModMath.mul(numerator, ModMath.inv(denominator, this.p), this.p);

      // x3 = λ^2 - 2x mod p
      const x3 = ModMath.sub(ModMath.mul(lambda, lambda, this.p), ModMath.mul(2n, P.x, this.p), this.p);

      // y3 = λ(x - x3) - y mod p
      const y3 = ModMath.sub(ModMath.mul(lambda, ModMath.sub(P.x, x3, this.p), this.p), P.y, this.p);

      return new ECPoint(x3, y3);
    }

    // Scalar multiplication using double-and-add algorithm
    multiply(k, P) {
      if (k === 0n) return ECPoint.infinity();
      if (k === 1n) return P;
      if (k < 0n) throw new Error('Negative scalar not supported');

      let result = ECPoint.infinity();
      let addend = P;

      while (k > 0n) {
        if (OpCodes.AndN(k, 1n)) {
          result = this.add(result, addend);
        }
        addend = this.double(addend);
        k = OpCodes.ShiftRn(k, 1n);
      }

      return result;
    }

    // Encode point to bytes (uncompressed format: 0x04 || x || y)
    encodePoint(point, compressed = false) {
      if (point.isInfinity) {
        return [0x00];
      }

      const coordSize = Math.ceil(this.p.toString(16).length / 2);

      if (compressed) {
        // Compressed format: 0x02/0x03 || x
        const prefix = OpCodes.AndN(point.y, 1n) === 0n ? 0x02 : 0x03;
        return [prefix, ...this._bigIntToBytes(point.x, coordSize)];
      } else {
        // Uncompressed format: 0x04 || x || y
        return [
          0x04,
          ...this._bigIntToBytes(point.x, coordSize),
          ...this._bigIntToBytes(point.y, coordSize)
        ];
      }
    }

    // Decode point from bytes
    decodePoint(bytes) {
      if (bytes.length === 0 || bytes[0] === 0x00) {
        return ECPoint.infinity();
      }

      const coordSize = Math.ceil(this.p.toString(16).length / 2);

      if (bytes[0] === 0x04) {
        // Uncompressed point
        if (bytes.length !== 1 + 2 * coordSize) {
          throw new Error('Invalid uncompressed point length');
        }

        const x = this._bytesToBigInt(bytes.slice(1, 1 + coordSize));
        const y = this._bytesToBigInt(bytes.slice(1 + coordSize));

        const point = new ECPoint(x, y);
        if (!this.isOnCurve(point)) {
          throw new Error('Point not on curve');
        }

        return point;
      } else if (bytes[0] === 0x02 || bytes[0] === 0x03) {
        // Compressed point - would need square root implementation
        throw new Error('Compressed point format not yet supported in educational implementation');
      } else {
        throw new Error('Invalid point encoding');
      }
    }

    _bigIntToBytes(value, size) {
      const hex = value.toString(16).padStart(size * 2, '0');
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.slice(i, i + 2), 16));
      }
      return bytes;
    }

    _bytesToBigInt(bytes) {
      let hex = '';
      for (let i = 0; i < bytes.length; ++i) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return BigInt('0x' + hex);
    }
  }

  /**
   * Wrap a published (r, s) pair as the DER SEQUENCE a signature is carried
   * in, so the test vectors below can quote the exact hexadecimal printed in
   * RFC 6979 rather than a re-encoded copy of it. The framing is the ASN.1
   * rule and nothing else: each integer is minimally encoded, with a leading
   * zero octet added only when the high bit would otherwise read as a sign.
   *
   * @param {string} rHex - r as published, big-endian hexadecimal
   * @param {string} sHex - s as published, big-endian hexadecimal
   * @returns {uint8[]} DER-encoded signature
   */
  function derSignature(rHex, sHex) {
    const encodeLength = (length) => length < 0x80
      ? [length]
      : [0x81, length];

    const encodeInteger = (hex) => {
      let bytes = OpCodes.Hex8ToBytes(hex.length % 2 ? '0' + hex : hex);
      while (bytes.length > 1 && bytes[0] === 0x00 && OpCodes.AndN(bytes[1], 0x80) === 0) {
        bytes = bytes.slice(1);
      }
      if (OpCodes.AndN(bytes[0], 0x80) !== 0) bytes = [0x00].concat(bytes);
      return [0x02].concat(encodeLength(bytes.length), bytes);
    };

    const body = encodeInteger(rHex).concat(encodeInteger(sHex));
    return [0x30].concat(encodeLength(body.length), body);
  }

  // ===== STANDARD CURVE DEFINITIONS =====

  const CURVES = {
    // Bitcoin curve (Koblitz curve)
    'secp256k1': new EllipticCurve(
      BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
      0n,
      7n,
      new ECPoint(
        BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
        BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8')
      ),
      BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
      1n,
      'secp256k1'
    ),

    // NIST P-256 (secp256r1)
    'secp256r1': new EllipticCurve(
      BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF'),
      BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC'),
      BigInt('0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B'),
      new ECPoint(
        BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296'),
        BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5')
      ),
      BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551'),
      1n,
      'secp256r1'
    ),

    // NIST P-384 (secp384r1)
    'secp384r1': new EllipticCurve(
      BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFF'),
      BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFC'),
      BigInt('0xB3312FA7E23EE7E4988E056BE3F82D19181D9C6EFE8141120314088F5013875AC656398D8A2ED19D2A85C8EDD3EC2AEF'),
      new ECPoint(
        BigInt('0xAA87CA22BE8B05378EB1C71EF320AD746E1D3B628BA79B9859F741E082542A385502F25DBF55296C3A545E3872760AB7'),
        BigInt('0x3617DE4A96262C6F5D9E98BF9292DC29F8F41DBD289A147CE9DA3113B5F0B8C00A60B1CE1D7E819D7A431D7C90EA0E5F')
      ),
      BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973'),
      1n,
      'secp384r1'
    ),

    // NIST P-521 (secp521r1)
    'secp521r1': new EllipticCurve(
      BigInt('0x01FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
      BigInt('0x01FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC'),
      BigInt('0x0051953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00'),
      new ECPoint(
        BigInt('0x00C6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66'),
        BigInt('0x011839296A789A3BC0045C8A5FB42C7D1BD998F54449579B446817AFBD17273E662C97EE72995EF42640C550B9013FAD0761353C7086A272C24088BE94769FD16650')
      ),
      BigInt('0x01FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409'),
      1n,
      'secp521r1'
    )
  };

  // Alias for common names
  CURVES['P-256'] = CURVES['secp256r1'];
  CURVES['P-384'] = CURVES['secp384r1'];
  CURVES['P-521'] = CURVES['secp521r1'];

  // ===== HASHING AND RFC 6979 =====

  // ECDSA signs a digest, so the hash is not optional and there is no useful
  // behaviour when it is missing: a substitute hash produces a signature that
  // no other implementation will ever verify, which is worse than refusing to
  // sign. The digests are pulled in here and every path below fails loudly if
  // the requested one is absent.
  if (typeof require !== 'undefined') {
    for (const mod of ['../hash/sha1.js', '../hash/sha256.js', '../hash/sha512.js']) {
      try {
        require(mod);
      } catch (error) {
        // In the browser these arrive as script tags instead; Find() reports it.
      }
    }
  }

  // Digest and HMAC block sizes, in octets, for the hashes FIPS 186-4 approves
  // for ECDSA. Both are properties of the hash rather than of this file, so
  // they are listed once and read by name.
  const HASH_PARAMS = {
    'SHA-1':   { outLen: 20, blockLen: 64 },
    'SHA-224': { outLen: 28, blockLen: 64 },
    'SHA-256': { outLen: 32, blockLen: 64 },
    'SHA-384': { outLen: 48, blockLen: 128 },
    'SHA-512': { outLen: 64, blockLen: 128 }
  };

  /**
   * Digest a byte array with a registered hash algorithm.
   * @param {string} hashName - Registered algorithm name, e.g. "SHA-256"
   * @param {uint8[]} bytes - Message octets
   * @returns {uint8[]} Digest octets
   */
  function digest(hashName, bytes) {
    const algorithm = AlgorithmFramework.Find(hashName);
    if (!algorithm) {
      throw new Error(`ECDSA requires the hash ${hashName}, which is not registered`);
    }

    const instance = algorithm.CreateInstance();
    instance.Feed(bytes);
    return instance.Result();
  }

  /**
   * Concatenate byte arrays without spreading them into an argument list.
   * @param {...uint8[]} parts - Arrays to join
   * @returns {uint8[]} Concatenation
   */
  function concatBytes() {
    const out = [];
    for (let p = 0; p < arguments.length; ++p) {
      const part = arguments[p];
      for (let i = 0; i < part.length; ++i) out.push(part[i]);
    }
    return out;
  }

  /**
   * HMAC (RFC 2104) over one of the digests above. RFC 6979 builds its nonce
   * from HMAC keyed by the private key, so this is part of the signature.
   * @param {string} hashName - Registered hash algorithm name
   * @param {uint8[]} key - MAC key octets
   * @param {uint8[]} message - Message octets
   * @returns {uint8[]} MAC octets
   */
  function hmac(hashName, key, message) {
    const params = HASH_PARAMS[hashName];
    if (!params) throw new Error(`No HMAC block size known for ${hashName}`);

    const blockLen = params.blockLen;
    const k = key.length > blockLen ? digest(hashName, key) : key.slice();
    while (k.length < blockLen) k.push(0x00);

    const innerPad = new Array(blockLen);
    const outerPad = new Array(blockLen);
    for (let i = 0; i < blockLen; ++i) {
      innerPad[i] = OpCodes.XorN(k[i], 0x36);
      outerPad[i] = OpCodes.XorN(k[i], 0x5C);
    }

    const innerHash = digest(hashName, concatBytes(innerPad, message));
    return digest(hashName, concatBytes(outerPad, innerHash));
  }

  /**
   * Interpret octets as a big-endian unsigned integer.
   * @param {uint8[]} bytes - Octets
   * @returns {BigInt} The integer
   */
  function octetsToInt(bytes) {
    let value = 0n;
    for (let i = 0; i < bytes.length; ++i) {
      value = OpCodes.OrN(OpCodes.ShiftLn(value, 8), BigInt(bytes[i]));
    }
    return value;
  }

  /**
   * RFC 6979 section 2.3.3: render an integer as exactly rlen octets.
   * @param {BigInt} value - The integer
   * @param {number} rlen - Output length in octets
   * @returns {uint8[]} Big-endian fixed-width octets
   */
  function intToOctets(value, rlen) {
    const bytes = new Array(rlen);
    let v = value;
    for (let i = rlen - 1; i >= 0; --i) {
      bytes[i] = Number(OpCodes.AndN(v, 0xFFn));
      v = OpCodes.ShiftRn(v, 8);
    }
    return bytes;
  }

  /**
   * RFC 6979 section 2.3.2 / FIPS 186-4 section 6.4: take the leftmost qlen
   * bits of an octet string. This is a truncation, not a reduction modulo the
   * group order - reducing instead changes the digest whenever it exceeds the
   * order, and the signature then fails to verify anywhere else.
   * @param {uint8[]} bytes - Octets, normally a digest
   * @param {number} qlen - Bit length of the group order
   * @returns {BigInt} The truncated integer
   */
  function bitsToInt(bytes, qlen) {
    const value = octetsToInt(bytes);
    const blen = bytes.length * 8;
    return blen > qlen ? OpCodes.ShiftRn(value, blen - qlen) : value;
  }

  /**
   * RFC 6979 section 2.3.4.
   * @param {uint8[]} bytes - Digest octets
   * @param {BigInt} q - Group order
   * @param {number} qlen - Bit length of q
   * @param {number} rlen - Octet length used by the generator
   * @returns {uint8[]} Octets of the reduced digest
   */
  function bitsToOctets(bytes, q, qlen, rlen) {
    const z1 = bitsToInt(bytes, qlen);
    const z2 = z1 >= q ? z1 - q : z1;
    return intToOctets(z2, rlen);
  }

  /**
   * RFC 6979 section 3.2: derive the per-signature nonce k deterministically
   * from the private key and the message digest with HMAC-DRBG.
   *
   * The nonce is the whole security of ECDSA. Anything an attacker can predict
   * or solve for - a counter, a hash of the message alone, or any value that
   * is an invertible function of the private key - yields the private key from
   * a single signature, because s = k^-1 (e + r*d) is linear in both k and d.
   *
   * @param {string} hashName - Registered hash algorithm name
   * @param {BigInt} q - Group order
   * @param {BigInt} x - Private key
   * @param {uint8[]} h1 - Digest of the message
   * @returns {BigInt} A nonce in [1, q-1]
   */
  function deterministicNonce(hashName, q, x, h1) {
    const params = HASH_PARAMS[hashName];
    if (!params) throw new Error(`No digest length known for ${hashName}`);

    const hlen = params.outLen;
    const qlen = q.toString(2).length;
    const rlen = Math.ceil(qlen / 8);

    const xOctets = intToOctets(x, rlen);
    const hOctets = bitsToOctets(h1, q, qlen, rlen);

    let V = new Array(hlen).fill(0x01);
    let K = new Array(hlen).fill(0x00);

    K = hmac(hashName, K, concatBytes(V, [0x00], xOctets, hOctets));
    V = hmac(hashName, K, V);
    K = hmac(hashName, K, concatBytes(V, [0x01], xOctets, hOctets));
    V = hmac(hashName, K, V);

    for (;;) {
      let T = [];
      while (T.length * 8 < qlen) {
        V = hmac(hashName, K, V);
        T = concatBytes(T, V);
      }

      const k = bitsToInt(T, qlen);
      if (k >= 1n && k < q) return k;

      K = hmac(hashName, K, concatBytes(V, [0x00]));
      V = hmac(hashName, K, V);
    }
  }

  // ===== ECDSA IMPLEMENTATION =====

  class ECDSACipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = "ECDSA";
      this.description = "Elliptic Curve Digital Signature Algorithm over secp256k1, P-256, P-384 and P-521, signing a SHA-1 or SHA-2 digest with the deterministic nonce of RFC 6979 and producing a DER-encoded (r, s). Verified against the RFC 6979 signing vectors and the Wycheproof verification suites, including their invalid-encoding cases. Arithmetic is plain BigInt and is not constant-time, so a key used where an attacker can time the signer is not protected.";
      this.inventor = "Scott Vanstone";
      this.year = 1992;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signature";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CA;

      this.SupportedKeySizes = [
        new KeySize(224, 224, 0),  // secp224r1
        new KeySize(256, 256, 0),  // secp256k1, secp256r1
        new KeySize(384, 384, 0),  // secp384r1
        new KeySize(521, 521, 0)   // secp521r1
      ];

      this.documentation = [
        new LinkItem("NIST FIPS 186-4 - Digital Signature Standard", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf"),
        new LinkItem("SEC 2: Recommended Elliptic Curve Domain Parameters", "https://www.secg.org/sec2-v2.pdf"),
        new LinkItem("RFC 6979 - Deterministic ECDSA", "https://tools.ietf.org/html/rfc6979"),
        new LinkItem("ANSI X9.62 - Public Key Cryptography for the Financial Services Industry", "https://webstore.ansi.org/standards/ascx9/ansix9621998")
      ];

      this.references = [
        new LinkItem("OpenSSL ECDSA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/ec/ecdsa_ossl.c"),
        new LinkItem("libsecp256k1", "https://github.com/bitcoin-core/secp256k1"),
        new LinkItem("Wycheproof ECDSA Test Vectors", "https://github.com/C2SP/wycheproof/tree/main/testvectors_v1")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse and Bias",
          "Two signatures made with the same k, or nonces with a handful of predictable "
          + "bits, yield the private key directly from the pair of s values - this is how "
          + "the PlayStation 3 code-signing key and a number of Bitcoin wallets were lost",
          "Signing here derives k from the private key and the digest per RFC 6979, so no "
          + "randomness source can go wrong; do not substitute a counter or a value derived "
          + "from the message alone",
          "https://www.rfc-editor.org/rfc/rfc6979#section-3.2"),
        new Vulnerability("Timing and Trace Leakage",
          "Scalar multiplication here branches on the bits of the nonce, so an attacker "
          + "able to time or trace the signer learns k and therefore the private key",
          "Use a constant-time implementation wherever an attacker shares a machine with "
          + "the signer; this file is a reference for the mathematics, not a hardened signer",
          "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf")
      ];

      // Signing vectors come from RFC 6979 Appendix A.2, which publishes k, r
      // and s for each curve and hash. They work as known-answer tests only
      // because the nonce is deterministic: with a random k there is no
      // expected signature to compare against, and a vector could then assert
      // nothing about the signature it is supposed to pin down.
      //
      // Verification vectors come from Wycheproof, which supplies invalid
      // cases as well as valid ones. Rejecting a bad signature is the half of
      // the contract that a "does it produce output" test never reaches.
      const RFC6979 = "https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2";
      const WYCHEPROOF = "https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256r1_sha256_test.json";
      const WYCHEPROOF_KEY = OpCodes.Hex8ToBytes(
        "042927b10512bae3eddcfe467828128bad2903269919f7086069c8c4df6c732838" +
        "c7787964eaac00e5921fb1498a60f4606766b3d9685001558d1a974e7341513e");

      this.tests = [
        {
          text: 'RFC 6979 A.2.5 - P-256, SHA-256, message "sample"',
          uri: RFC6979,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-256',
          privateKey: OpCodes.Hex8ToBytes("C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721"),
          input: OpCodes.AnsiToBytes("sample"),
          expected: derSignature(
            "EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716",
            "F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8")
        },
        {
          text: 'RFC 6979 A.2.5 - P-256, SHA-256, message "test"',
          uri: RFC6979,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-256',
          privateKey: OpCodes.Hex8ToBytes("C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721"),
          input: OpCodes.AnsiToBytes("test"),
          expected: derSignature(
            "F1ABB023518351CD71D881567B1EA663ED3EFCF6C5132B354F28D3B0B7D38367",
            "019F4113742A2B14BD25926B49C649155F267E60D3814B4C0CC84250E46F0083")
        },
        {
          text: 'RFC 6979 A.2.5 - P-256, SHA-1, message "sample"',
          uri: RFC6979,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-1',
          privateKey: OpCodes.Hex8ToBytes("C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721"),
          input: OpCodes.AnsiToBytes("sample"),
          expected: derSignature(
            "61340C88C3AAEBEB4F6D667F672CA9759A6CCAA9FA8811313039EE4A35471D32",
            "6D7F147DAC089441BB2E2FE8F7A3FA264B9C475098FDCF6E00D7C996E1B8B7EB")
        },
        {
          text: 'RFC 6979 A.2.6 - P-384, SHA-384, message "sample"',
          uri: RFC6979,
          curve: 'secp384r1',
          hashAlgorithm: 'SHA-384',
          privateKey: OpCodes.Hex8ToBytes(
            "6B9D3DAD2E1B8C1C05B19875B6659F4DE23C3B667BF297BA9AA47740787137D8" +
            "96D5724E4C70A825F872C9EA60D2EDF5"),
          input: OpCodes.AnsiToBytes("sample"),
          expected: derSignature(
            "94EDBB92A5ECB8AAD4736E56C691916B3F88140666CE9FA73D64C4EA95AD133C" +
            "81A648152E44ACF96E36DD1E80FABE46",
            "99EF4AEB15F178CEA1FE40DB2603138F130E740A19624526203B6351D0A3A94F" +
            "A329C145786E679E7B82C71A38628AC8")
        },
        {
          // P-521 pushes the SEQUENCE past 127 content octets, so this is the
          // vector that fails if the DER length reverts to the short form.
          text: 'RFC 6979 A.2.7 - P-521, SHA-512, message "sample"',
          uri: RFC6979,
          curve: 'secp521r1',
          hashAlgorithm: 'SHA-512',
          privateKey: OpCodes.Hex8ToBytes(
            "00FAD06DAA62BA3B25D2FB40133DA757205DE67F5BB0018FEE8C86E1B68C7E75" +
            "CAA896EB32F1F47C70855836A6D16FCC1466F6D8FBEC67DB89EC0C08B0E996B8" +
            "3538"),
          input: OpCodes.AnsiToBytes("sample"),
          expected: derSignature(
            "0C328FAFCBD79DD77850370C46325D987CB525569FB63C5D3BC53950E6D4C5F1" +
            "74E25A1EE9017B5D450606ADD152B534931D7D4E8455CC91F9B15BF05EC36E37" +
            "7FA",
            "0617CCE7CF5064806C467F678D3B4080D6F1CC50AF26CA209417308281B68AF2" +
            "82623EAA63E5B5C0723D8B8C37FF0777B1A20F8CCB1DCCC43997F1EE0E44DA4A" +
            "67A")
        },
        {
          text: "Wycheproof ecdsa_secp256r1_sha256 tcId 5 - valid signature",
          uri: WYCHEPROOF,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-256',
          publicKey: WYCHEPROOF_KEY,
          input: OpCodes.Hex8ToBytes("313233343030"),
          signature: OpCodes.Hex8ToBytes(
            "304402202ba3a8be6b94d5ec80a6d9d1190a436effe50d85a1eee859b8cc6af9bd5c2e18" +
            "02204cd60b855d442f5b3c7b11eb6c4e0ae7525fe710fab9aa7c77a67f79e6fadd76"),
          expected: [1]
        },
        {
          text: "Wycheproof ecdsa_secp256r1_sha256 tcId 7 - valid signature",
          uri: WYCHEPROOF,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-256',
          publicKey: WYCHEPROOF_KEY,
          input: OpCodes.Hex8ToBytes("313233343030"),
          signature: OpCodes.Hex8ToBytes(
            "304502202ba3a8be6b94d5ec80a6d9d1190a436effe50d85a1eee859b8cc6af9bd5c2e18" +
            "022100b329f479a2bbd0a5c384ee1493b1f5186a87139cac5df4087c134b49156847db"),
          expected: [1]
        },
        {
          // Same r and s as tcId 7 with the leading zero octet of s dropped.
          // The numbers still satisfy the verification equation; what makes it
          // invalid is that the encoding is not DER. A verifier that reads r
          // and s out of whatever it can parse accepts two distinct byte
          // strings as one signature.
          text: "Wycheproof ecdsa_secp256r1_sha256 tcId 6 - invalid, s misses its leading zero",
          uri: WYCHEPROOF,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-256',
          publicKey: WYCHEPROOF_KEY,
          input: OpCodes.Hex8ToBytes("313233343030"),
          signature: OpCodes.Hex8ToBytes(
            "304402202ba3a8be6b94d5ec80a6d9d1190a436effe50d85a1eee859b8cc6af9bd5c2e18" +
            "0220b329f479a2bbd0a5c384ee1493b1f5186a87139cac5df4087c134b49156847db"),
          expected: [0]
        },
        {
          text: "Wycheproof ecdsa_secp256r1_sha256 tcId 23 - invalid, zeros appended to the SEQUENCE",
          uri: WYCHEPROOF,
          curve: 'secp256r1',
          hashAlgorithm: 'SHA-256',
          publicKey: WYCHEPROOF_KEY,
          input: OpCodes.Hex8ToBytes("313233343030"),
          signature: OpCodes.Hex8ToBytes(
            "304702202ba3a8be6b94d5ec80a6d9d1190a436effe50d85a1eee859b8cc6af9bd5c2e18" +
            "022100b329f479a2bbd0a5c384ee1493b1f5186a87139cac5df4087c134b49156847db" +
            "0000"),
          expected: [0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ECDSAInstance(this, isInverse);
    }
  }

  /**
 * ECDSA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ECDSAInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.curve = null;
      this._privateKey = null;
      this._publicKey = null;
      this.inputBuffer = [];
      this.messageHash = null;
      this.signature = null;
      this._hashAlgorithm = 'SHA-256';
    }

    // Which digest the signature is taken over. FIPS 186-4 permits any
    // approved hash, and RFC 6979 derives the nonce from the same one, so the
    // choice has to travel with the instance rather than be hard-coded.
    set hashAlgorithm(name) {
      if (!name) return;
      if (!HASH_PARAMS[name]) {
        throw new Error(`Unsupported hash for ECDSA: ${name}`);
      }
      this._hashAlgorithm = name;
    }

    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    // Property setters/getters for compatibility
    set curve(curveName) {
      if (curveName && typeof curveName === 'string') {
        if (!CURVES[curveName]) {
          throw new Error(`Unsupported curve: ${curveName}. Use secp256k1, secp256r1, secp384r1, or secp521r1.`);
        }
        this._curve = CURVES[curveName];
        this._curveName = curveName;
      } else {
        this._curve = null;
        this._curveName = null;
      }
    }

    get curve() {
      return this._curveName;
    }

    set publicKey(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._publicKey = null;
        return;
      }

      if (!this._curve) {
        throw new Error('Curve must be set before public key');
      }

      try {
        this._publicKey = this._curve.decodePoint(keyBytes);
        if (!this._curve.isOnCurve(this._publicKey)) {
          throw new Error('Public key point not on curve');
        }
      } catch (error) {
        throw new Error(`Invalid public key: ${error.message}`);
      }
    }

    get publicKey() {
      if (!this._publicKey || !this._curve) return null;
      return this._curve.encodePoint(this._publicKey);
    }

    set privateKey(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._privateKey = null;
        return;
      }

      if (!this._curve) {
        throw new Error('Curve must be set before private key');
      }

      // Convert bytes to BigInt
      let d = 0n;
      for (let i = 0; i < keyBytes.length; ++i) {
        d = OpCodes.OrN(OpCodes.ShiftLn(d, 8n), BigInt(keyBytes[i]));
      }

      // Validate private key range: 1 <= d < n
      if (d === 0n || d >= this._curve.n) {
        throw new Error('Private key out of range');
      }

      this._privateKey = d;

      // Derive public key: Q = d * G
      this._publicKey = this._curve.multiply(d, this._curve.G);
    }

    get privateKey() {
      if (this._privateKey === null) return null;

      // Convert BigInt to bytes
      const keySize = Math.ceil(this._curve.n.toString(16).length / 2);
      return this._curve._bigIntToBytes(this._privateKey, keySize);
    }

    // Feed data (message or signature)

    // Result - sign or verify depending on available keys and signature
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._curve) {
        throw new Error('Curve not set');
      }

      // Auto-detect mode based on available data:
      // If we have a signature and public key -> verification mode
      // If we have a private key -> signing mode
      if (this.signature && this.signature.length > 0 && this._publicKey) {
        // Verification mode - returns [1] for valid, [0] for invalid
        const isValid = this._verify();
        return isValid ? [1] : [0];
      } else if (this._privateKey) {
        // Signing mode - returns DER-encoded signature
        return this._sign();
      } else {
        throw new Error('Cannot determine operation mode: provide either (signature + publicKey) for verification or privateKey for signing');
      }
    }

    // Sign message with the RFC 6979 deterministic nonce
    _sign() {
      if (!this._privateKey) {
        throw new Error('Private key required for signing');
      }

      // The empty string is a message like any other and SHA-256 has a
      // defined digest for it, so signing it is not an error.
      const message = [...this.inputBuffer];
      this.inputBuffer = [];

      // The digest is needed twice and must be the same octets both times: as
      // the integer e that enters s, and as the input to the nonce generator.
      const h1 = digest(this._hashAlgorithm, message);
      const e = bitsToInt(h1, this._curve.n.toString(2).length);
      const k = deterministicNonce(this._hashAlgorithm, this._curve.n, this._privateKey, h1);

      // Compute r = (k * G).x mod n
      const kG = this._curve.multiply(k, this._curve.G);
      const r = kG.x % this._curve.n;

      if (r === 0n) {
        throw new Error('Signature generation failed: r = 0');
      }

      // Compute s = k^-1 * (e + r * d) mod n
      const kInv = ModMath.inv(k, this._curve.n);
      const s = (kInv * (e + r * this._privateKey)) % this._curve.n;

      if (s === 0n) {
        throw new Error('Signature generation failed: s = 0');
      }

      // Encode signature as DER
      return this._encodeDER(r, s);
    }

    // Verify signature
    _verify() {
      if (!this._publicKey) {
        throw new Error('Public key required for verification');
      }

      // Extract message and signature
      // In test vectors, signature is provided separately via signature property
      if (this.signature && this.signature.length > 0) {
        const message = [...this.inputBuffer];
        this.inputBuffer = [];

        // A signature that is not a well-formed DER SEQUENCE of two INTEGERs
        // is not a signature. Recovering r and s from a malformed encoding and
        // verifying them anyway is what lets an attacker present many distinct
        // byte strings for one accepted signature.
        let r, s;
        try {
          ({ r, s } = this._decodeDER(this.signature));
        } catch (error) {
          return false;
        }

        // Hash the message
        const e = this._hashMessage(message);

        // Verify signature
        return this._verifySignature(e, r, s);
      }

      throw new Error('Signature not provided for verification');
    }

    _verifySignature(e, r, s) {
      const n = this._curve.n;

      // Validate signature range
      if (r <= 0n || r >= n || s <= 0n || s >= n) {
        return false;
      }

      // Compute w = s^-1 mod n
      let w;
      try {
        w = ModMath.inv(s, n);
      } catch (error) {
        return false;
      }

      // Compute u1 = e * w mod n
      const u1 = (e * w) % n;

      // Compute u2 = r * w mod n
      const u2 = (r * w) % n;

      // Compute point P = u1*G + u2*Q
      const u1G = this._curve.multiply(u1, this._curve.G);
      const u2Q = this._curve.multiply(u2, this._publicKey);
      const P = this._curve.add(u1G, u2Q);

      if (P.isInfinity) {
        return false;
      }

      // Verify r == P.x mod n
      const v = P.x % n;
      return v === r;
    }

    // Digest the message and truncate it to the group order per FIPS 186-4
    _hashMessage(message) {
      return bitsToInt(digest(this._hashAlgorithm, message), this._curve.n.toString(2).length);
    }

    // DER definite length: a single octet below 128, otherwise a count octet
    // with the high bit set followed by that many length octets. A P-521
    // signature is about 139 content octets, so the short form alone produced
    // a SEQUENCE header no other parser would accept.
    _encodeLength(length) {
      if (length < 0x80) return [length];

      const lengthBytes = [];
      let remaining = length;
      while (remaining > 0) {
        lengthBytes.unshift(Number(OpCodes.AndN(remaining, 0xFF)));
        remaining = Number(OpCodes.ShiftRn(BigInt(remaining), 8));
      }
      return [0x80 + lengthBytes.length].concat(lengthBytes);
    }

    // Read a DER definite length, returning the value and the octets consumed.
    // DER admits exactly one encoding per length: the short form below 128 and
    // the shortest long form above it. BER alternatives are rejected.
    _decodeLength(der, pos) {
      if (pos >= der.length) throw new Error('Invalid DER signature: truncated length');

      const first = der[pos];
      if (first < 0x80) return { length: first, next: pos + 1 };
      if (first === 0x80) throw new Error('Invalid DER signature: indefinite length');

      const count = first - 0x80;
      if (count > 4 || pos + count >= der.length) {
        throw new Error('Invalid DER signature: unsupported length encoding');
      }
      if (der[pos + 1] === 0x00) {
        throw new Error('Invalid DER signature: non-minimal length encoding');
      }

      let length = 0;
      for (let i = 0; i < count; ++i) {
        length = length * 256 + der[pos + 1 + i];
      }
      if (length < 0x80) {
        throw new Error('Invalid DER signature: long form used for a short length');
      }

      return { length, next: pos + 1 + count };
    }

    // Read one DER INTEGER and return it as a non-negative BigInt. DER requires
    // the shortest two's-complement encoding, so a leading 0x00 is legal only
    // to keep a high bit from reading as a sign bit.
    _decodeInteger(der, pos) {
      if (der[pos] !== 0x02) {
        throw new Error('Invalid DER signature: expected an INTEGER');
      }

      const header = this._decodeLength(der, pos + 1);
      const end = header.next + header.length;
      if (header.length === 0 || end > der.length) {
        throw new Error('Invalid DER signature: INTEGER out of bounds');
      }

      const bytes = der.slice(header.next, end);
      if (OpCodes.AndN(bytes[0], 0x80) !== 0) {
        throw new Error('Invalid DER signature: negative INTEGER');
      }
      if (bytes.length > 1 && bytes[0] === 0x00 && OpCodes.AndN(bytes[1], 0x80) === 0) {
        throw new Error('Invalid DER signature: non-minimal INTEGER');
      }

      return { value: this._bytesToInteger(bytes), next: end };
    }

    // Encode signature as DER
    _encodeDER(r, s) {
      const rBytes = this._integerToBytes(r);
      const sBytes = this._integerToBytes(s);

      const body = [0x02].concat(this._encodeLength(rBytes.length), rBytes,
                                 [0x02], this._encodeLength(sBytes.length), sBytes);

      return [0x30].concat(this._encodeLength(body.length), body);
    }

    // Decode DER signature. The SEQUENCE must hold exactly two INTEGERs and
    // must end where the input ends: anything appended after s is a second
    // encoding of the same signature, which a verifier must not accept.
    _decodeDER(der) {
      if (der.length < 2 || der[0] !== 0x30) {
        throw new Error('Invalid DER signature: missing SEQUENCE tag');
      }

      const seq = this._decodeLength(der, 1);
      if (seq.next + seq.length !== der.length) {
        throw new Error('Invalid DER signature: SEQUENCE does not span the input');
      }

      const rField = this._decodeInteger(der, seq.next);
      const sField = this._decodeInteger(der, rField.next);

      if (sField.next !== der.length) {
        throw new Error('Invalid DER signature: trailing data after s');
      }

      return { r: rField.value, s: sField.value };
    }

    _integerToBytes(value) {
      let hex = value.toString(16);
      if (OpCodes.AndN(hex.length, 1)) hex = '0' + hex;

      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.slice(i, i + 2), 16));
      }

      // Add leading 0x00 if high bit is set (DER encoding requirement)
      if (OpCodes.AndN(bytes[0], 0x80)) {
        bytes.unshift(0x00);
      }

      return bytes;
    }

    _bytesToInteger(bytes) {
      let value = 0n;
      for (let i = 0; i < bytes.length; ++i) {
        value = OpCodes.OrN(OpCodes.ShiftLn(value, 8n), BigInt(bytes[i]));
      }
      return value;
    }

    // Clear sensitive data
    ClearData() {
      this._privateKey = null;
      this._publicKey = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
      this.messageHash = null;
      this.signature = null;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ECDSACipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ECDSACipher, ECDSAInstance, CURVES, ECPoint, EllipticCurve };
}));
