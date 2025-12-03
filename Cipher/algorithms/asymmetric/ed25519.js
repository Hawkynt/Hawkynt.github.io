/*
 * Ed25519 (EdDSA on Curve25519) Implementation
 * Based on RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)
 *
 * Ed25519 is a modern public-key signature system using Curve25519 in Edwards form.
 * It provides 128-bit security with fast signing and verification.
 *
 * Curve equation: -x^2 + y^2 = 1 + d*x^2*y^2 (mod 2^255 - 19)
 * where d = -121665/121666
 *
 * Compatible with AlgorithmFramework
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
          AsymmetricCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const FIELD_SIZE = 32;  // 256 bits
  const SCALAR_SIZE = 32; // 256 bits
  const PUBLIC_KEY_SIZE = 32;
  const SECRET_KEY_SIZE = 32;
  const SIGNATURE_SIZE = 64; // R (32 bytes) + S (32 bytes)

  // Prime modulus: 2^255 - 19
  const P = OpCodes.ShiftLn(1n, 255n) - 19n;

  // Order of base point (group order): 2^252 + 27742317777372353535851937790883648493
  const L = OpCodes.ShiftLn(1n, 252n) + 27742317777372353535851937790883648493n;

  // Curve parameter d = -121665/121666 (mod p)
  const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;

  // 2*d (mod p) - used in addition formula
  const D2 = modP(D + D);

  // Base point coordinates
  const Bx = 15112221349535400772501151409588531511454012693041857206046113283949847762202n;
  const By = 46316835694926478169428394003475163141307993866256225615783033603165251855960n;

  // ===== FIELD ARITHMETIC (Modulo P = 2^255 - 19) =====

  /**
   * Modular reduction modulo P = 2^255 - 19
   */
  function modP(x) {
    x = x % P;
    if (x < 0n) x += P;
    return x;
  }

  /**
   * Modular inverse using Fermat's little theorem: a^(p-2) mod p
   */
  function modPInv(x) {
    return modPow(x, P - 2n, P);
  }

  /**
   * Modular exponentiation: base^exp mod mod
   */
  function modPow(base, exp, mod) {
    var result = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (OpCodes.AndN(exp, 1n)) result = (result * base) % mod;
      exp = OpCodes.ShiftRn(exp, 1n);
      base = (base * base) % mod;
    }
    return result;
  }

  // ===== SCALAR ARITHMETIC (Modulo L = group order) =====

  /**
   * Modular reduction modulo L (group order)
   */
  function modL(x) {
    x = x % L;
    if (x < 0n) x += L;
    return x;
  }

  // ===== ENCODING/DECODING =====

  /**
   * Encode integer as little-endian byte array
   */
  function encodeInt(value, length) {
    const result = new Array(length);
    for (var i = 0; i < length; ++i) {
      result[i] = Number(OpCodes.AndN(value, 0xFFn));
      value = OpCodes.ShiftRn(value, 8n);
    }
    return result;
  }

  /**
   * Decode little-endian byte array to BigInt
   */
  function decodeInt(bytes) {
    var result = 0n;
    for (var i = bytes.length - 1; i >= 0; --i) {
      result = OpCodes.OrN(OpCodes.ShiftLn(result, 8n), BigInt(OpCodes.AndN(bytes[i], 0xFF)));
    }
    return result;
  }

  /**
   * Encode point to 32-byte compressed format (RFC 8032)
   * Format: y-coordinate (255 bits) + sign bit of x (1 bit)
   */
  function encodePoint(point) {
    const y = modP(point.y);
    const x = modP(point.x);
    const bytes = encodeInt(y, 32);

    // Set sign bit (bit 255) based on x's parity
    if (OpCodes.AndN(x, 1n)) {
      bytes[31] = OpCodes.OrN(bytes[31], 0x80);
    }

    return bytes;
  }

  /**
   * Decode 32-byte compressed point format (RFC 8032)
   */
  function decodePoint(bytes) {
    if (bytes.length !== 32) {
      throw new Error('Invalid point encoding length');
    }

    // Extract sign bit
    const signBit = OpCodes.AndN(bytes[31], 0x80) !== 0;

    // Decode y-coordinate
    const yBytes = bytes.slice(0);
    yBytes[31] = OpCodes.AndN(yBytes[31], 0x7F); // Clear sign bit
    const y = decodeInt(yBytes);

    if (y >= P) {
      throw new Error('Invalid y-coordinate');
    }

    // Recover x from y using curve equation: x^2 = (y^2 - 1) / (d*y^2 + 1)
    const y2 = modP(y * y);
    const u = modP(y2 - 1n);
    const v = modP(D * y2 + 1n);

    // Compute x^2 = u/v
    const vInv = modPInv(v);
    const x2 = modP(u * vInv);

    // Compute square root using p = 5 (mod 8) property
    var x = modPow(x2, (P + 3n) / 8n, P);

    // Check if x^2 == x2, if not multiply by sqrt(-1) = 2^((p-1)/4)
    if (modP(x * x) !== x2) {
      x = modP(x * modPow(2n, (P - 1n) / 4n, P));
    }

    // Verify solution
    if (modP(x * x) !== x2) {
      throw new Error('Point not on curve');
    }

    // Adjust sign
    if (OpCodes.AndN(x, 1n) !== (signBit ? 1n : 0n)) {
      x = modP(-x);
    }

    return { x: x, y: y };
  }

  // ===== EDWARDS CURVE OPERATIONS =====

  /**
   * Edwards curve point addition using extended coordinates
   * Formula from https://hyperelliptic.org/EFD/g1p/auto-twisted-extended-1.html
   * This is the complete addition formula for twisted Edwards curves with a=-1
   */
  function pointAdd(p1, p2) {
    const x1 = p1.x, y1 = p1.y, z1 = p1.z || 1n, t1 = p1.t || modP(x1 * y1);
    const x2 = p2.x, y2 = p2.y, z2 = p2.z || 1n, t2 = p2.t || modP(x2 * y2);

    // A = (Y1-X1)*(Y2-X2)
    const A = modP((y1 - x1) * (y2 - x2));
    // B = (Y1+X1)*(Y2+X2)
    const B = modP((y1 + x1) * (y2 + x2));
    // C = T1*2*d*T2
    const C = modP(modP(t1 * D2) * t2);
    // D = Z1*2*Z2
    const D_val = modP(modP(z1 * 2n) * z2);
    // E = B-A
    const E = modP(B - A);
    // F = D-C
    const F = modP(D_val - C);
    // G = D+C
    const G = modP(D_val + C);
    // H = B+A
    const H = modP(B + A);
    // X3 = E*F
    const X3 = modP(E * F);
    // Y3 = G*H
    const Y3 = modP(G * H);
    // T3 = E*H
    const T3 = modP(E * H);
    // Z3 = F*G
    const Z3 = modP(F * G);

    return { x: X3, y: Y3, z: Z3, t: T3 };
  }

  /**
   * Edwards curve point doubling using extended coordinates
   * Formula from https://hyperelliptic.org/EFD/g1p/auto-twisted-extended-1.html
   */
  function pointDouble(p) {
    const x = p.x, y = p.y, z = p.z || 1n;

    // A = X1^2
    const A = modP(x * x);
    // B = Y1^2
    const B = modP(y * y);
    // C = 2*Z1^2
    const C = modP(modP(z * z) * 2n);
    // H = A+B
    const H = modP(A + B);
    // E = H-(X1+Y1)^2
    const E = modP(H - modP((x + y) * (x + y)));
    // G = A-B (for a=-1, this is correct)
    const G = modP(A - B);
    // F = C+G
    const F = modP(C + G);
    // X3 = E*F
    const X3 = modP(E * F);
    // Y3 = G*H
    const Y3 = modP(G * H);
    // T3 = E*H
    const T3 = modP(E * H);
    // Z3 = F*G
    const Z3 = modP(F * G);

    return { x: X3, y: Y3, z: Z3, t: T3 };
  }

  /**
   * Convert extended coordinates to affine
   */
  function toAffine(p) {
    if (!p.z || p.z === 1n) {
      return { x: p.x, y: p.y };
    }
    const zInv = modPInv(p.z);
    return {
      x: modP(p.x * zInv),
      y: modP(p.y * zInv)
    };
  }

  /**
   * Scalar multiplication: k * Point using Montgomery ladder
   * This is more efficient and constant-time than double-and-add
   */
  function scalarMult(k, point) {
    // Handle edge cases
    if (k === 0n) {
      return { x: 0n, y: 1n }; // Neutral element
    }

    // Convert to extended coordinates
    const P = {
      x: point.x,
      y: point.y,
      z: 1n,
      t: modP(point.x * point.y)
    };

    // Start with neutral element
    var R0 = { x: 0n, y: 1n, z: 1n, t: 0n };
    var R1 = P;

    // Process scalar from MSB to LSB (Montgomery ladder)
    const kBits = k.toString(2);
    for (var i = 0; i < kBits.length; ++i) {
      if (kBits[i] === '1') {
        R0 = pointAdd(R0, R1);
        R1 = pointDouble(R1);
      } else {
        R1 = pointAdd(R0, R1);
        R0 = pointDouble(R0);
      }
    }

    return toAffine(R0);
  }

  /**
   * Scalar multiplication by base point: k * B
   */
  function scalarMultBase(k) {
    return scalarMult(k, { x: Bx, y: By });
  }

  // ===== SHA-512 INTEGRATION =====

  /**
   * Get SHA-512 hash function instance
   */
  function getSHA512() {
    // Try to load SHA-512 from AlgorithmFramework registry
    if (typeof global !== 'undefined' && global.AlgorithmFramework) {
      const sha512Algo = global.AlgorithmFramework.Find('SHA-512');
      if (sha512Algo) {
        return sha512Algo.CreateInstance();
      }
    }

    // Fallback: Try to load directly
    try {
      if (typeof require !== 'undefined') {
        const SHA512Module = require('../hash/sha512.js');
        if (SHA512Module && SHA512Module.CreateInstance) {
          return SHA512Module.CreateInstance();
        }
      }
    } catch (e) {
      // Ignore
    }

    throw new Error('SHA-512 implementation not available. Please load sha512.js first.');
  }

  /**
   * Hash data using SHA-512
   */
  function sha512Hash(data) {
    const sha512 = getSHA512();
    sha512.Feed(data);
    return sha512.Result();
  }

  // ===== ED25519 CORE OPERATIONS =====

  /**
   * Generate public key from secret key (32 bytes)
   */
  function generatePublicKey(secretKey) {
    if (!secretKey || secretKey.length !== SECRET_KEY_SIZE) {
      throw new Error('Secret key must be 32 bytes');
    }

    // Hash the secret key
    const h = sha512Hash(secretKey);

    // Clamp the first 32 bytes to create scalar
    const scalar = h.slice(0, 32);
    scalar[0] = OpCodes.AndN(scalar[0], 0xF8);  // Clear lowest 3 bits
    scalar[31] = OpCodes.AndN(scalar[31], 0x7F); // Clear highest bit
    scalar[31] = OpCodes.OrN(scalar[31], 0x40); // Set second-highest bit

    const s = decodeInt(scalar);

    // Compute public key: A = s*B
    const A = scalarMultBase(s);

    return encodePoint(A);
  }

  /**
   * Sign a message
   * Returns 64-byte signature (R || S)
   */
  function sign(secretKey, message) {
    if (!secretKey || secretKey.length !== SECRET_KEY_SIZE) {
      throw new Error('Secret key must be 32 bytes');
    }

    // Hash secret key
    const h = sha512Hash(secretKey);

    // First 32 bytes: clamped scalar
    const scalarBytes = h.slice(0, 32);
    scalarBytes[0] = OpCodes.AndN(scalarBytes[0], 0xF8);
    scalarBytes[31] = OpCodes.AndN(scalarBytes[31], 0x7F);
    scalarBytes[31] = OpCodes.OrN(scalarBytes[31], 0x40);
    const s = decodeInt(scalarBytes);

    // Second 32 bytes: prefix for nonce
    const prefix = h.slice(32, 64);

    // Compute public key
    const publicKey = generatePublicKey(secretKey);

    // Compute nonce: r = H(prefix || message)
    const rHash = sha512Hash(prefix.concat(message));
    const r = modL(decodeInt(rHash));

    // Compute R = r*B
    const R = scalarMultBase(r);
    const encodedR = encodePoint(R);

    // Compute k = H(R || A || message)
    const kHash = sha512Hash(encodedR.concat(publicKey).concat(message));
    const k = modL(decodeInt(kHash));

    // Compute S = r + k*s (mod L)
    const S = modL(r + modL(k * s));
    const encodedS = encodeInt(S, 32);

    // Signature is R || S
    return encodedR.concat(encodedS);
  }

  /**
   * Verify a signature
   * Returns true if signature is valid, false otherwise
   */
  function verify(publicKey, message, signature) {
    if (!publicKey || publicKey.length !== PUBLIC_KEY_SIZE) {
      return false;
    }

    if (!signature || signature.length !== SIGNATURE_SIZE) {
      return false;
    }

    try {
      // Parse signature: R || S
      const encodedR = signature.slice(0, 32);
      const encodedS = signature.slice(32, 64);

      const R = decodePoint(encodedR);
      const S = decodeInt(encodedS);

      // Check S < L (prevent signature malleability)
      if (S >= L) {
        return false;
      }

      // Decode public key
      const A = decodePoint(publicKey);

      // Compute k = H(R || A || message)
      const kHash = sha512Hash(encodedR.concat(publicKey).concat(message));
      const k = modL(decodeInt(kHash));

      // Verify: S*B = R + k*A
      // Equivalently: S*B - k*A = R
      const SB = scalarMultBase(S);
      const kA = scalarMult(k, A);

      // Compute R' = S*B - k*A
      const negKA = { x: modP(-kA.x), y: kA.y }; // Negate point by negating x
      const Rprime = pointAdd(SB, negKA);

      // Compare R' with R
      return Rprime.x === R.x && Rprime.y === R.y;

    } catch (e) {
      return false;
    }
  }

  // ===== ALGORITHM CLASS =====

  class Ed25519Algorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Ed25519";
      this.description = "EdDSA signature scheme using Curve25519 in twisted Edwards form. Provides 128-bit security with fast constant-time signing and verification. Used in TLS 1.3, SSH, and modern cryptographic protocols.";
      this.inventor = "Daniel J. Bernstein, Niels Duif, Tanja Lange, Peter Schwabe, Bo-Yin Yang";
      this.year = 2011;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signature";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTERNATIONAL;

      // Algorithm capabilities
      this.SupportedKeySizes = [new KeySize(32, 32, 1)]; // 256-bit secret key
      this.SupportsEncryption = false;
      this.SupportsSignatures = true;
      this.SupportsKeyExchange = false;

      // Performance characteristics
      this.publicKeySize = PUBLIC_KEY_SIZE;
      this.secretKeySize = SECRET_KEY_SIZE;
      this.signatureSize = SIGNATURE_SIZE;

      // Documentation
      this.documentation = [
        new LinkItem("RFC 8032 - Edwards-Curve Digital Signature Algorithm (EdDSA)", "https://www.rfc-editor.org/rfc/rfc8032.html"),
        new LinkItem("Ed25519: high-speed high-security signatures", "https://ed25519.cr.yp.to/"),
        new LinkItem("Original Paper (2011)", "https://ed25519.cr.yp.to/ed25519-20110926.pdf")
      ];

      this.references = [
        new LinkItem("Wikipedia: EdDSA", "https://en.wikipedia.org/wiki/EdDSA"),
        new LinkItem("TLS 1.3 RFC 8446", "https://tools.ietf.org/html/rfc8446")
      ];

      // Official test vectors from RFC 8032 Section 7.1
      this.tests = [
        {
          text: "RFC 8032 Test Vector #1 (Empty Message)",
          uri: "https://www.rfc-editor.org/rfc/rfc8032.html#section-7.1",
          secretKey: OpCodes.Hex8ToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'),
          publicKey: OpCodes.Hex8ToBytes('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'),
          input: [], // Empty message
          expected: OpCodes.Hex8ToBytes('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b')
        },
        {
          text: "RFC 8032 Test Vector #2 (Single Byte)",
          uri: "https://www.rfc-editor.org/rfc/rfc8032.html#section-7.1",
          secretKey: OpCodes.Hex8ToBytes('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb'),
          publicKey: OpCodes.Hex8ToBytes('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c'),
          input: OpCodes.Hex8ToBytes('72'),
          expected: OpCodes.Hex8ToBytes('92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00')
        },
        {
          text: "RFC 8032 Test Vector #3 (Two Bytes)",
          uri: "https://www.rfc-editor.org/rfc/rfc8032.html#section-7.1",
          secretKey: OpCodes.Hex8ToBytes('c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7'),
          publicKey: OpCodes.Hex8ToBytes('fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025'),
          input: OpCodes.Hex8ToBytes('af82'),
          expected: OpCodes.Hex8ToBytes('6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a')
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      // Ed25519 is a signature algorithm - no inverse operation
      // Signatures have sign/verify, not encrypt/decrypt
      if (isInverse) return null;
      return new Ed25519Instance(this);
    }
  }

  /**
 * Ed25519 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Ed25519Instance extends IAlgorithmInstance {
    constructor(algorithm) {
      super(algorithm);
      this._secretKey = null;
      this._publicKey = null;
      this.inputBuffer = [];
      this.mode = 'sign'; // 'sign' or 'verify'
    }

    // Property: secret key (32 bytes)
    set secretKey(keyBytes) {
      if (!keyBytes) {
        this._secretKey = null;
        return;
      }

      if (keyBytes.length !== SECRET_KEY_SIZE) {
        throw new Error(`Invalid secret key size: ${keyBytes.length} bytes (expected ${SECRET_KEY_SIZE})`);
      }

      this._secretKey = keyBytes.slice(0);

      // Auto-generate public key from secret key
      this._publicKey = generatePublicKey(this._secretKey);
    }

    get secretKey() {
      return this._secretKey ? this._secretKey.slice(0) : null;
    }

    // Property: public key (32 bytes)
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }

      if (keyBytes.length !== PUBLIC_KEY_SIZE) {
        throw new Error(`Invalid public key size: ${keyBytes.length} bytes (expected ${PUBLIC_KEY_SIZE})`);
      }

      this._publicKey = keyBytes.slice(0);
    }

    get publicKey() {
      return this._publicKey ? this._publicKey.slice(0) : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data) return;
      if (data.length > 0) {
        this.inputBuffer.push.apply(this.inputBuffer, data);
      }
      // Allow empty data for Ed25519 (RFC 8032 Test Vector #1 uses empty message)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Ed25519 can sign empty messages (RFC 8032 Test Vector #1)
      var result;

      if (this.mode === 'sign') {
        // Signing mode: use secret key to sign message
        if (!this._secretKey) {
          throw new Error('Secret key not set for signing');
        }

        result = sign(this._secretKey, this.inputBuffer);

      } else if (this.mode === 'verify') {
        // Verification mode: verify signature using public key
        if (!this._publicKey) {
          throw new Error('Public key not set for verification');
        }

        // For verification, input buffer should contain: message + signature
        // But for test framework compatibility, we handle this differently
        // The test framework will set the signature separately
        throw new Error('Verification via Result() not supported. Use verify() method directly.');

      } else {
        throw new Error('Invalid mode: ' + this.mode);
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Ed25519Algorithm());

  // Export for direct use
  return {
    Ed25519Algorithm: Ed25519Algorithm,
    generatePublicKey: generatePublicKey,
    sign: sign,
    verify: verify,
    encodePoint: encodePoint,
    decodePoint: decodePoint,
    scalarMultBase: scalarMultBase
  };
}));
