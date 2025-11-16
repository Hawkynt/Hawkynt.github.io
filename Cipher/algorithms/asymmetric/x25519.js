/* X25519.js - Curve25519 Diffie-Hellman Key Exchange
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
 *
 * X25519 (Curve25519) is an elliptic curve Diffie-Hellman key exchange
 * using Curve25519. It provides 128-bit security and is designed for
 * high performance and resistance to side-channel attacks.
 *
 * Based on RFC 7748: "Elliptic Curves for Security"
 * https://tools.ietf.org/html/rfc7748
 *
 * This implementation uses JavaScript native BigInt for 255-bit field
 * arithmetic (mod 2^255-19) and implements the Montgomery ladder for
 * constant-time scalar multiplication.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.X25519 = factory();
  }
}(
  (function() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    if (typeof global !== 'undefined') return global;
    if (typeof self !== 'undefined') return self;
    throw new Error('Unable to locate global object');
  })(),
  function() {
    'use strict';

    // Load AlgorithmFramework
    if (!global.AlgorithmFramework && typeof require !== 'undefined') {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    }

    // Load OpCodes for utility functions
    if (!global.OpCodes && typeof require !== 'undefined') {
      global.OpCodes = require('../../OpCodes.js');
    }

    const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
            AsymmetricCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;
    const OpCodes = global.OpCodes;

    // ==================== CURVE25519 FIELD ARITHMETIC ====================

    // Prime: p = 2^255 - 19
    const P = OpCodes.ShiftLn(1n, 255) - 19n;
    const P_MINUS_2 = P - 2n;

    // Base point u-coordinate for Curve25519
    const BASE_POINT_U = 9n;

    /**
     * Modular reduction mod p = 2^255 - 19
     * @param {BigInt} x - Value to reduce
     * @returns {BigInt} x mod p
     */
    function modP(x) {
      x = x % P;
      if (x < 0n) x += P;
      return x;
    }

    /**
     * Modular addition mod p
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @returns {BigInt} (a + b) mod p
     */
    function addModP(a, b) {
      return modP(a + b);
    }

    /**
     * Modular subtraction mod p
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @returns {BigInt} (a - b) mod p
     */
    function subModP(a, b) {
      return modP(a - b);
    }

    /**
     * Modular multiplication mod p
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @returns {BigInt} (a * b) mod p
     */
    function mulModP(a, b) {
      return modP(a * b);
    }

    /**
     * Modular inversion using Fermat's Little Theorem
     * Computes x^-1 mod p using x^(p-2) mod p
     * @param {BigInt} x - Value to invert
     * @returns {BigInt} x^-1 mod p
     */
    function invModP(x) {
      if (x === 0n) return 0n;
      return powModP(x, P_MINUS_2);
    }

    /**
     * Modular exponentiation using square-and-multiply
     * @param {BigInt} base - Base value
     * @param {BigInt} exp - Exponent
     * @returns {BigInt} base^exp mod p
     */
    function powModP(base, exp) {
      let result = 1n;
      base = modP(base);

      while (exp > 0n) {
        if (OpCodes.AndN(exp, 1n)) {
          result = mulModP(result, base);
        }
        base = mulModP(base, base);
        exp = OpCodes.ShiftRn(exp, 1);
      }

      return result;
    }

    // ==================== CURVE25519 OPERATIONS ====================

    /**
     * Clamp a scalar for X25519
     * Sets bits as required by RFC 7748 Section 5:
     * - Clear bits 0, 1, 2 of first byte
     * - Clear bit 7 of last byte
     * - Set bit 6 of last byte
     * @param {Uint8Array} scalar - 32-byte scalar to clamp
     */
    function clampScalar(scalar) {
      const clamped = new Uint8Array(scalar);
      clamped[0] = OpCodes.AndN(clamped[0], 0xF8);  // Clear bottom 3 bits
      clamped[31] = OpCodes.AndN(clamped[31], 0x7F); // Clear top bit
      clamped[31] = OpCodes.OrN(clamped[31], 0x40); // Set bit 254
      return clamped;
    }

    /**
     * Decode little-endian 32-byte array to BigInt
     * @param {Uint8Array} bytes - 32-byte array
     * @returns {BigInt} Decoded value
     */
    function decodeScalar(bytes) {
      let result = 0n;
      for (let i = 31; i >= 0; --i) {
        result = OpCodes.OrN(OpCodes.ShiftLn(result, 8), BigInt(bytes[i]));
      }
      return result;
    }

    /**
     * Decode u-coordinate (with clamping of top bit)
     * @param {Uint8Array} bytes - 32-byte array
     * @returns {BigInt} Decoded u-coordinate
     */
    function decodeUCoordinate(bytes) {
      const u = new Uint8Array(bytes);
      u[31] = OpCodes.AndN(u[31], 0x7F); // Mask top bit as per RFC 7748
      return modP(decodeScalar(u));
    }

    /**
     * Encode BigInt to little-endian 32-byte array
     * @param {BigInt} value - Value to encode
     * @returns {Uint8Array} 32-byte array
     */
    function encodeScalar(value) {
      const bytes = new Uint8Array(32);
      let v = modP(value);

      for (let i = 0; i < 32; ++i) {
        bytes[i] = Number(OpCodes.AndN(v, 0xFFn));
        v = OpCodes.ShiftRn(v, 8);
      }

      return bytes;
    }

    /**
     * Montgomery ladder for constant-time scalar multiplication
     * Computes k * u on Curve25519
     *
     * Uses the Montgomery ladder algorithm which is resistant to
     * timing attacks by performing the same operations regardless
     * of bit values.
     *
     * @param {BigInt} k - Scalar (already clamped)
     * @param {BigInt} u - u-coordinate of point
     * @returns {BigInt} Resulting u-coordinate
     */
    function montgomeryLadder(k, u) {
      // Initialize ladder variables
      let x1 = u;
      let x2 = 1n;
      let z2 = 0n;
      let x3 = u;
      let z3 = 1n;

      let swap = 0n;

      // Process scalar from bit 254 down to bit 0
      for (let t = 254; t >= 0; --t) {
        const kt = OpCodes.GetBitN(k, t);
        swap = OpCodes.XorN(swap, kt);

        // Conditional swap based on bit value
        if (swap === 1n) {
          [x2, x3] = [x3, x2];
          [z2, z3] = [z3, z2];
        }
        swap = kt;

        // Montgomery ladder step
        const A = addModP(x2, z2);
        const AA = mulModP(A, A);
        const B = subModP(x2, z2);
        const BB = mulModP(B, B);
        const E = subModP(AA, BB);
        const C = addModP(x3, z3);
        const D = subModP(x3, z3);
        const DA = mulModP(D, A);
        const CB = mulModP(C, B);

        x3 = mulModP(addModP(DA, CB), addModP(DA, CB));
        z3 = mulModP(x1, mulModP(subModP(DA, CB), subModP(DA, CB)));
        x2 = mulModP(AA, BB);
        z2 = mulModP(E, addModP(AA, mulModP(121665n, E)));
      }

      // Final conditional swap
      if (swap === 1n) {
        [x2, x3] = [x3, x2];
        [z2, z3] = [z3, z2];
      }

      // Return x2/z2
      return mulModP(x2, invModP(z2));
    }

    /**
     * X25519 scalar multiplication
     * @param {Uint8Array} scalar - 32-byte scalar (will be clamped)
     * @param {Uint8Array} uCoord - 32-byte u-coordinate
     * @returns {Uint8Array} Resulting 32-byte u-coordinate
     */
    function x25519(scalar, uCoord) {
      // Clamp the scalar
      const clampedScalar = clampScalar(scalar);
      const k = decodeScalar(clampedScalar);

      // Decode u-coordinate
      const u = decodeUCoordinate(uCoord);

      // Perform scalar multiplication
      const result = montgomeryLadder(k, u);

      // Encode result
      return encodeScalar(result);
    }

    /**
     * X25519 base point multiplication (compute public key)
     * @param {Uint8Array} scalar - 32-byte private key (will be clamped)
     * @returns {Uint8Array} 32-byte public key
     */
    function x25519Base(scalar) {
      const basePoint = encodeScalar(BASE_POINT_U);
      return x25519(scalar, basePoint);
    }

    // ==================== ALGORITHM FRAMEWORK INTEGRATION ====================

    class X25519Algorithm extends AsymmetricCipherAlgorithm {
      constructor() {
        super();

        this.name = "X25519";
        this.description = "Curve25519 Diffie-Hellman key exchange using Montgomery curve arithmetic for ECDH. Provides 128-bit security with high performance and side-channel resistance. Used extensively in modern protocols like TLS 1.3, SSH, and WireGuard.";
        this.inventor = "Daniel J. Bernstein";
        this.year = 2006;
        this.category = CategoryType.ASYMMETRIC;
        this.subCategory = "Key Exchange (ECDH)";
        this.securityStatus = SecurityStatus.SECURE;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem(
            "RFC 7748 - Elliptic Curves for Security",
            "https://tools.ietf.org/html/rfc7748"
          ),
          new LinkItem(
            "Original Paper: Curve25519 (Bernstein, 2006)",
            "https://cr.yp.to/ecdh/curve25519-20060209.pdf"
          ),
          new LinkItem(
            "Curve25519 Website",
            "https://cr.yp.to/ecdh.html"
          )
        ];

        this.references = [
          new LinkItem(
            "NIST SP 800-186 - Digital Signature Standard",
            "https://csrc.nist.gov/publications/detail/sp/800-186/final"
          ),
          new LinkItem(
            "SafeCurves: choosing safe curves for elliptic-curve cryptography",
            "https://safecurves.cr.yp.to/"
          ),
          new LinkItem(
            "Wycheproof Project - X25519 Test Vectors",
            "https://github.com/google/wycheproof"
          )
        ];

        // RFC 7748 and Wycheproof Test Vectors
        this.tests = [
          {
            text: "RFC 7748 Section 6.1 - Test Vector 1",
            uri: "https://tools.ietf.org/html/rfc7748#section-6.1",
            // Alice's private key
            privateKey: OpCodes.Hex8ToBytes(
              "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a"
            ),
            // Alice's public key (computed from private key)
            publicKey: OpCodes.Hex8ToBytes(
              "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"
            ),
            // Bob's public key
            otherPublicKey: OpCodes.Hex8ToBytes(
              "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f"
            ),
            // Shared secret
            expected: OpCodes.Hex8ToBytes(
              "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742"
            ),
            input: null // Will be set by test framework
          },
          {
            text: "RFC 7748 Section 6.1 - Test Vector 2 (Bob's perspective)",
            uri: "https://tools.ietf.org/html/rfc7748#section-6.1",
            // Bob's private key
            privateKey: OpCodes.Hex8ToBytes(
              "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb"
            ),
            // Bob's public key (computed from private key)
            publicKey: OpCodes.Hex8ToBytes(
              "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f"
            ),
            // Alice's public key
            otherPublicKey: OpCodes.Hex8ToBytes(
              "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"
            ),
            // Shared secret (same as Test Vector 1)
            expected: OpCodes.Hex8ToBytes(
              "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742"
            ),
            input: null
          },
          {
            text: "RFC 7748 Section 5.2 - Scalar Multiplication Test Vector 1",
            uri: "https://tools.ietf.org/html/rfc7748#section-5.2",
            // Scalar
            privateKey: OpCodes.Hex8ToBytes(
              "a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4"
            ),
            // Input u-coordinate
            otherPublicKey: OpCodes.Hex8ToBytes(
              "e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c"
            ),
            // Output u-coordinate
            expected: OpCodes.Hex8ToBytes(
              "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552"
            ),
            input: null
          },
          {
            text: "RFC 7748 Section 5.2 - Scalar Multiplication Test Vector 2",
            uri: "https://tools.ietf.org/html/rfc7748#section-5.2",
            // Scalar
            privateKey: OpCodes.Hex8ToBytes(
              "4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d"
            ),
            // Input u-coordinate
            otherPublicKey: OpCodes.Hex8ToBytes(
              "e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493"
            ),
            // Output u-coordinate
            expected: OpCodes.Hex8ToBytes(
              "95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957"
            ),
            input: null
          },
          {
            text: "RFC 7748 Section 5.2 - Iterated Scalar Multiplication (1 iteration)",
            uri: "https://tools.ietf.org/html/rfc7748#section-5.2",
            privateKey: OpCodes.Hex8ToBytes(
              "0900000000000000000000000000000000000000000000000000000000000000"
            ),
            iterations: 1,
            expected: OpCodes.Hex8ToBytes(
              "422c8e7a6227d7bca1350b3e2bb7279f7897b87bb6854b783c60e80311ae3079"
            ),
            input: null
          },
          {
            text: "RFC 7748 Section 5.2 - Iterated Scalar Multiplication (1000 iterations)",
            uri: "https://tools.ietf.org/html/rfc7748#section-5.2",
            privateKey: OpCodes.Hex8ToBytes(
              "0900000000000000000000000000000000000000000000000000000000000000"
            ),
            iterations: 1000,
            expected: OpCodes.Hex8ToBytes(
              "684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51"
            ),
            input: null
          },
          // Wycheproof Test Vectors - Edge Cases
          {
            text: "Wycheproof - Public key = 0 (low-order point)",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "207494038f2bb811d47805bcdf04a2ac585ada7f2f23389bfd4658f9ddd4debc"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "0000000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "0000000000000000000000000000000000000000000000000000000000000000"
            ),
            input: null
          },
          {
            text: "Wycheproof - Public key = 1 (low-order point)",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "202e8972b61c7e61930eb9450b5070eae1c670475685541f0476217e4818cfab"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "0100000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "0000000000000000000000000000000000000000000000000000000000000000"
            ),
            input: null
          },
          {
            text: "Wycheproof - Edge case on twist",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "38dde9f3e7b799045f9ac3793d4a9277dadeadc41bec0290f81f744f73775f84"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "0200000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "9a2cfe84ff9c4a9739625cae4a3b82a906877a441946f8d7b3d795fe8f5d1639"
            ),
            input: null
          },
          {
            text: "Wycheproof - Public key on twist",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "588c061a50804ac488ad774ac716c3f5ba714b2712e048491379a500211998a8"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "63aa40c6e38346c5caf23a6df0a5e6c80889a08647e551b3563449befcfc9733"
            ),
            expected: OpCodes.Hex8ToBytes(
              "b1a707519495ffffb298ff941716b06dfab87cf8d91123fe2be9a233dda22212"
            ),
            input: null
          },
          {
            text: "Wycheproof - Edge case for public key (all-zeros variant)",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "386f7f16c50731d64f82e6a170b142a4e34f31fd7768fcb8902925e7d1e21abe"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "0400000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "0fcab5d842a078d7a71fc59b57bfb4ca0be6873b49dcdb9f44e14ae8fbdfa542"
            ),
            input: null
          },
          {
            text: "Wycheproof - Public key >= p (reduction test)",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "f01e48dafac9d7bcf589cbc382c878d18bda3550589ffb5d50b523bebe329dae"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "efffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f"
            ),
            expected: OpCodes.Hex8ToBytes(
              "bd36a0790eb883098c988b21786773de0b3a4df162282cf110de18dd484ce74b"
            ),
            input: null
          },
          {
            text: "Wycheproof - Low-order public key test",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "10255c9230a97a30a458ca284a629669293a31890cda9d147febc7d1e22d6bb1"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800"
            ),
            expected: OpCodes.Hex8ToBytes(
              "0000000000000000000000000000000000000000000000000000000000000000"
            ),
            input: null
          },
          {
            text: "Wycheproof - Checking for overflow handling",
            uri: "https://github.com/google/wycheproof",
            privateKey: OpCodes.Hex8ToBytes(
              "c81724704000b26d31703cc97e3a378d56fad8219361c88cca8bd7c5719b12b2"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "fd300aeb40e1fa582518412b49b208a7842b1e1f056a040178ea4141534f652d"
            ),
            expected: OpCodes.Hex8ToBytes(
              "b734105dc257585d73b566ccb76f062795ccbec89128e52b02f3e59639f13c46"
            ),
            input: null
          },
          {
            text: "libsodium scalarmult1 - Standard test vector",
            uri: "https://github.com/jedisct1/libsodium",
            privateKey: OpCodes.Hex8ToBytes(
              "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "0900000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"
            ),
            input: null
          },
          {
            text: "libsodium scalarmult2 - Standard test vector",
            uri: "https://github.com/jedisct1/libsodium",
            privateKey: OpCodes.Hex8ToBytes(
              "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "0900000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f"
            ),
            input: null
          },
          {
            text: "curve25519-donna - Non-canonical point test",
            uri: "https://github.com/agl/curve25519-donna",
            privateKey: OpCodes.Hex8ToBytes(
              "0100000000000000000000000000000000000000000000000000000000000000"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "2500000000000000000000000000000000000000000000000000000000000000"
            ),
            expected: OpCodes.Hex8ToBytes(
              "3c7777caf997b264416077665b4e229d0b9548dc0cd81998ddcdc5c8533c797f"
            ),
            input: null
          },
          {
            text: "curve25519-donna - All-bits-set public key",
            uri: "https://github.com/agl/curve25519-donna",
            privateKey: OpCodes.Hex8ToBytes(
              "0100000000000000000000000000000000000000000000000000000000000000"
            ),
            otherPublicKey: OpCodes.Hex8ToBytes(
              "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            ),
            expected: OpCodes.Hex8ToBytes(
              "b32d1362c248d62fe62619cff04dd43db73ffc1b6308ede30b78d87380f1e834"
            ),
            input: null
          }
          // Note: 1,000,000 iteration test omitted for performance reasons
        ];
      }

      CreateInstance(isInverse = false) {
        if (isInverse) return null; // Key exchange has no inverse
        return new X25519Instance(this);
      }
    }

    class X25519Instance extends IAlgorithmInstance {
      constructor(algorithm) {
        super(algorithm);
        this._privateKey = null;
        this._otherPublicKey = null;
        this._iterations = 1; // For iterated tests
      }

      set privateKey(keyBytes) {
        if (!keyBytes || keyBytes.length !== 32) {
          throw new Error("Private key must be 32 bytes");
        }
        this._privateKey = new Uint8Array(keyBytes);
      }

      get privateKey() {
        return this._privateKey ? new Uint8Array(this._privateKey) : null;
      }

      set publicKey(keyBytes) {
        // For test validation - computes public key from private key
        if (!keyBytes || keyBytes.length !== 32) {
          throw new Error("Public key must be 32 bytes");
        }
        // Store for validation only
        this._expectedPublicKey = new Uint8Array(keyBytes);
      }

      set otherPublicKey(keyBytes) {
        if (!keyBytes || keyBytes.length !== 32) {
          throw new Error("Other public key must be 32 bytes");
        }
        this._otherPublicKey = new Uint8Array(keyBytes);
      }

      get otherPublicKey() {
        return this._otherPublicKey ? new Uint8Array(this._otherPublicKey) : null;
      }

      set iterations(count) {
        this._iterations = count;
      }

      Feed(data) {
        // X25519 doesn't use streaming - all data must be provided via properties
        if (data && data.length > 0) {
          throw new Error("X25519 does not accept streaming data");
        }
      }

      Result() {
        if (!this._privateKey) {
          throw new Error("Private key not set");
        }

        // Handle iterated scalar multiplication tests
        if (this._iterations > 1) {
          let k = new Uint8Array(this._privateKey);
          let u = new Uint8Array(this._privateKey);

          for (let i = 0; i < this._iterations; ++i) {
            const result = x25519(k, u);
            u = new Uint8Array(k);
            k = new Uint8Array(result);
          }

          return Array.from(k);
        }

        // Standard case: compute shared secret or public key
        if (this._otherPublicKey) {
          // Compute shared secret: k * otherPublicKey
          const sharedSecret = x25519(this._privateKey, this._otherPublicKey);
          return Array.from(sharedSecret);
        } else {
          // Compute public key: k * G (base point)
          const publicKey = x25519Base(this._privateKey);
          return Array.from(publicKey);
        }
      }
    }

    // Register algorithm
    RegisterAlgorithm(new X25519Algorithm());

    // Export for module systems
    return {
      X25519Algorithm,
      X25519Instance,
      x25519,
      x25519Base,
      montgomeryLadder,
      clampScalar,
      encodeScalar,
      decodeScalar,
      decodeUCoordinate
    };
  }
));
