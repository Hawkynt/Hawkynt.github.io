/*
 * Schnorr Signatures for secp256k1 (BIP-340)
 * Production-grade implementation of Bitcoin Taproot signature scheme
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Reference: BIP-340 - Schnorr Signatures for secp256k1
 * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
 * Test Vectors: BIP-340 official test vectors
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', '../hash/sha256'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../hash/sha256')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.SHA2_256);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, SHA256Module) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!SHA256Module) {
    throw new Error('SHA-256 module dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // SHA-256 helper using the proven implementation
  const sha256Algorithm = new SHA256Module.SHA2_256Algorithm();

  // ===== SECP256K1 CURVE CONSTANTS =====

  // Field size (prime modulus)
  const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;

  // Curve order (number of points)
  const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

  // Generator point G coordinates
  const GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
  const GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

  // Curve equation: y^2 = x^3 + 7 (a=0, b=7)
  const B = 7n;

  // ===== MODULAR ARITHMETIC =====

  /**
   * Modular addition
   */
  function modAdd(a, b, mod) {
    return (a + b) % mod;
  }

  /**
   * Modular subtraction
   */
  function modSub(a, b, mod) {
    return ((a - b) % mod + mod) % mod;
  }

  /**
   * Modular multiplication
   */
  function modMul(a, b, mod) {
    return (a * b) % mod;
  }

  /**
   * Modular inverse using Extended Euclidean Algorithm
   */
  function modInv(a, mod) {
    a = ((a % mod) + mod) % mod;
    if (a === 0n) throw new Error('Cannot compute inverse of 0');

    let [t, newT] = [0n, 1n];
    let [r, newR] = [mod, a];

    while (newR !== 0n) {
      const quotient = r / newR;
      [t, newT] = [newT, t - quotient * newT];
      [r, newR] = [newR, r - quotient * newR];
    }

    if (r > 1n) throw new Error('Not invertible');
    if (t < 0n) t += mod;

    return t;
  }

  /**
   * Modular exponentiation
   */
  function modPow(base, exp, mod) {
    if (exp === 0n) return 1n;
    if (exp === 1n) return base % mod;

    let result = 1n;
    base = base % mod;

    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      exp >>= 1n;
      base = (base * base) % mod;
    }

    return result;
  }

  // ===== ELLIPTIC CURVE POINT OPERATIONS =====

  /**
   * Elliptic Curve Point (affine coordinates)
   */
  class ECPoint {
    constructor(x, y, isInfinity = false) {
      this.x = x;
      this.y = y;
      this.isInfinity = isInfinity;
    }

    static infinity() {
      return new ECPoint(0n, 0n, true);
    }

    equals(other) {
      if (this.isInfinity && other.isInfinity) return true;
      if (this.isInfinity || other.isInfinity) return false;
      return this.x === other.x && this.y === other.y;
    }
  }

  /**
   * Check if point is on secp256k1 curve: y^2 = x^3 + 7
   */
  function isOnCurve(point) {
    if (point.isInfinity) return true;

    const { x, y } = point;
    const left = modMul(y, y, P);
    const right = (modMul(modMul(x, x, P), x, P) + B) % P;

    return left === right;
  }

  /**
   * Point addition on secp256k1
   */
  function pointAdd(P1, P2) {
    if (P1.isInfinity) return P2;
    if (P2.isInfinity) return P1;

    if (P1.x === P2.x) {
      if (P1.y === P2.y) {
        return pointDouble(P1);
      } else {
        return ECPoint.infinity();
      }
    }

    // λ = (y2 - y1) / (x2 - x1) mod p
    const numerator = modSub(P2.y, P1.y, P);
    const denominator = modSub(P2.x, P1.x, P);
    const lambda = modMul(numerator, modInv(denominator, P), P);

    // x3 = λ^2 - x1 - x2 mod p
    const x3 = modSub(modSub(modMul(lambda, lambda, P), P1.x, P), P2.x, P);

    // y3 = λ(x1 - x3) - y1 mod p
    const y3 = modSub(modMul(lambda, modSub(P1.x, x3, P), P), P1.y, P);

    return new ECPoint(x3, y3);
  }

  /**
   * Point doubling on secp256k1
   */
  function pointDouble(P1) {
    if (P1.isInfinity) return P1;
    if (P1.y === 0n) return ECPoint.infinity();

    // λ = 3x^2 / 2y mod p (since a=0 for secp256k1)
    const numerator = modMul(3n, modMul(P1.x, P1.x, P), P);
    const denominator = modMul(2n, P1.y, P);
    const lambda = modMul(numerator, modInv(denominator, P), P);

    // x3 = λ^2 - 2x mod p
    const x3 = modSub(modMul(lambda, lambda, P), modMul(2n, P1.x, P), P);

    // y3 = λ(x - x3) - y mod p
    const y3 = modSub(modMul(lambda, modSub(P1.x, x3, P), P), P1.y, P);

    return new ECPoint(x3, y3);
  }

  /**
   * Scalar multiplication using double-and-add algorithm
   */
  function pointMultiply(k, point) {
    if (k === 0n) return ECPoint.infinity();
    if (k === 1n) return point;
    if (k < 0n) throw new Error('Negative scalar not supported');

    let result = ECPoint.infinity();
    let addend = point;

    while (k > 0n) {
      if (k & 1n) {
        result = pointAdd(result, addend);
      }
      addend = pointDouble(addend);
      k >>= 1n;
    }

    return result;
  }

  /**
   * Check if Y coordinate is even (BIP-340 requirement)
   */
  function hasEvenY(point) {
    if (point.isInfinity) return false;
    return (point.y & 1n) === 0n;
  }

  /**
   * Lift X coordinate to point with even Y (BIP-340 operation)
   * Returns point if x is valid X coordinate, null otherwise
   */
  function liftX(x) {
    if (x >= P) return null;

    // Compute y^2 = x^3 + 7 mod p
    const ySq = (modMul(modMul(x, x, P), x, P) + B) % P;

    // Compute y = y^2^((p+1)/4) mod p (since p ≡ 3 mod 4)
    const y = modPow(ySq, (P + 1n) / 4n, P);

    // Verify y^2 = ySq
    if (modMul(y, y, P) !== ySq) return null;

    // Return point with even Y coordinate
    const evenY = (y & 1n) === 0n ? y : P - y;
    return new ECPoint(x, evenY);
  }

  // ===== BYTE CONVERSION UTILITIES =====

  /**
   * Convert 32-byte array to BigInt (big-endian)
   */
  function bytesToBigInt(bytes) {
    let result = 0n;
    for (let i = 0; i < bytes.length; ++i) {
      result = (result << 8n) | BigInt(bytes[i]);
    }
    return result;
  }

  /**
   * Convert BigInt to 32-byte array (big-endian)
   */
  function bigIntToBytes(value, length = 32) {
    const result = new Array(length);
    for (let i = length - 1; i >= 0; --i) {
      result[i] = Number(value & 0xFFn);
      value >>= 8n;
    }
    return result;
  }

  /**
   * Convert point X coordinate to 32 bytes (BIP-340 encoding)
   */
  function pointToBytes(point) {
    if (point.isInfinity) throw new Error('Cannot encode point at infinity');
    return bigIntToBytes(point.x, 32);
  }

  // ===== SHA-256 IMPLEMENTATION =====

  /**
   * SHA-256 hash function using the proven implementation from algorithms/hash/sha256.js
   * @param {Array<number>} data - Input data as byte array
   * @returns {Array<number>} - 32-byte hash output
   */
  function sha256(data) {
    const instance = sha256Algorithm.CreateInstance();
    instance.Feed(data);
    return instance.Result();
  }

  /**
   * BIP-340 tagged hash: hash_tag(x) = SHA256(SHA256(tag) || SHA256(tag) || x)
   */
  function taggedHash(tag, data) {
    const tagBytes = OpCodes.AnsiToBytes(tag);
    const tagHash = sha256(tagBytes);

    // Concatenate: tagHash || tagHash || data
    const combined = [...tagHash, ...tagHash, ...data];

    return sha256(combined);
  }

  // ===== BIP-340 SCHNORR SIGNATURE OPERATIONS =====

  /**
   * BIP-340 Public Key Generation
   * Input: 32-byte secret key
   * Output: 32-byte X-only public key
   */
  function generatePublicKey(secretKey) {
    if (secretKey.length !== 32) {
      throw new Error('Secret key must be 32 bytes');
    }

    const d = bytesToBigInt(secretKey);
    if (d === 0n || d >= N) {
      throw new Error('Invalid secret key');
    }

    const G = new ECPoint(GX, GY);
    const P = pointMultiply(d, G);

    return pointToBytes(P);
  }

  /**
   * BIP-340 Schnorr Signature Generation
   * Inputs: secretKey (32 bytes), message (any length), auxRand (32 bytes, optional)
   * Output: 64-byte signature
   */
  function sign(secretKey, message, auxRand = null) {
    if (secretKey.length !== 32) {
      throw new Error('Secret key must be 32 bytes');
    }

    // Default aux_rand to zeros if not provided
    if (!auxRand) {
      auxRand = new Array(32).fill(0);
    }

    if (auxRand.length !== 32) {
      throw new Error('Auxiliary randomness must be 32 bytes');
    }

    // Step 1: Let d' = int(sk)
    let d = bytesToBigInt(secretKey);
    if (d === 0n || d >= N) {
      throw new Error('Invalid secret key');
    }

    // Step 2: Let P = d'⋅G
    const G = new ECPoint(GX, GY);
    let P = pointMultiply(d, G);

    // Step 3: Let d = d' if has_even_y(P), else d = n - d'
    if (!hasEvenY(P)) {
      d = N - d;
    }

    // Step 4: Let t = bytes(d) XOR hash_BIP0340/aux(a)
    const dBytes = bigIntToBytes(d, 32);
    const auxHash = taggedHash('BIP0340/aux', auxRand);
    const t = OpCodes.XorArrays(dBytes, auxHash);

    // Step 5: Let rand = hash_BIP0340/nonce(t || bytes(P) || m)
    const PBytes = pointToBytes(P);
    const nonceInput = [...t, ...PBytes, ...message];
    const rand = taggedHash('BIP0340/nonce', nonceInput);

    // Step 6: Let k' = int(rand) mod n
    let k = bytesToBigInt(rand) % N;
    if (k === 0n) {
      throw new Error('Nonce generation failed');
    }

    // Step 7: Let R = k'⋅G
    let R = pointMultiply(k, G);

    // Step 8: Let k = k' if has_even_y(R), else k = n - k'
    if (!hasEvenY(R)) {
      k = N - k;
    }

    // Step 9: Let e = int(hash_BIP0340/challenge(bytes(R) || bytes(P) || m)) mod n
    const RBytes = pointToBytes(R);
    const challengeInput = [...RBytes, ...PBytes, ...message];
    const eHash = taggedHash('BIP0340/challenge', challengeInput);
    const e = bytesToBigInt(eHash) % N;

    // Step 10: Let sig = bytes(R) || bytes((k + ed) mod n)
    const s = (k + e * d) % N;
    const sBytes = bigIntToBytes(s, 32);

    return [...RBytes, ...sBytes];
  }

  /**
   * BIP-340 Schnorr Signature Verification
   * Inputs: publicKey (32 bytes), message (any length), signature (64 bytes)
   * Output: true if valid, false otherwise
   */
  function verify(publicKey, message, signature) {
    if (publicKey.length !== 32) {
      return false;
    }

    if (signature.length !== 64) {
      return false;
    }

    // Step 1: Let pubPoint = lift_x(int(pk))
    const pkInt = bytesToBigInt(publicKey);
    const pubPoint = liftX(pkInt);
    if (!pubPoint) {
      return false;
    }

    // Step 2: Let r = int(sig[0:32])
    const r = bytesToBigInt(signature.slice(0, 32));
    if (r >= P) {  // r must be less than field size
      return false;
    }

    // Step 3: Let s = int(sig[32:64])
    const s = bytesToBigInt(signature.slice(32, 64));
    if (s >= N) {
      return false;
    }

    // Step 4: Let e = int(hash_BIP0340/challenge(bytes(r) || bytes(pubPoint) || m)) mod n
    const rBytes = bigIntToBytes(r, 32);
    const pubBytes = pointToBytes(pubPoint);
    const challengeInput = [...rBytes, ...pubBytes, ...message];
    const eHash = taggedHash('BIP0340/challenge', challengeInput);
    const e = bytesToBigInt(eHash) % N;

    // Step 5: Let R = s⋅G - e⋅pubPoint
    const G = new ECPoint(GX, GY);
    const sG = pointMultiply(s, G);
    const ePubPoint = pointMultiply(e, pubPoint);

    // Negate ePubPoint by flipping Y coordinate: -y mod p = p - y
    const negEPubPoint = ePubPoint.isInfinity ? ePubPoint : new ECPoint(ePubPoint.x, (P - ePubPoint.y) % P);
    const R = pointAdd(sG, negEPubPoint);

    // Step 6: Fail if R is point at infinity
    if (R.isInfinity) {
      return false;
    }

    // Step 7: Fail if R lacks even Y coordinate
    if (!hasEvenY(R)) {
      return false;
    }

    // Step 8: Fail if x(R) ≠ r
    if (R.x !== r) {
      return false;
    }

    // Step 9: Return success
    return true;
  }

  // ===== ALGORITHM FRAMEWORK INTEGRATION =====

  /**
 * SchnorrAlgorithm - Asymmetric cipher implementation
 * @class
 * @extends {AsymmetricCipherAlgorithm}
 */

  class SchnorrAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Schnorr (BIP-340)";
      this.description = "Schnorr signatures for secp256k1 curve as specified in BIP-340. Used in Bitcoin Taproot (BIP-341) for efficient, provably secure digital signatures with support for multisignatures and batch verification.";
      this.inventor = "Claus Schnorr (algorithm), Pieter Wuille et al. (BIP-340)";
      this.year = 2020;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signatures";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTERNATIONAL;

      // Algorithm capabilities
      this.SupportedKeySizes = [new KeySize(32, 32, 1)];
      this.SupportedSignatureSizes = [new KeySize(64, 64, 1)];

      // Documentation
      this.documentation = [
        new LinkItem("BIP-340: Schnorr Signatures for secp256k1", "https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki"),
        new LinkItem("BIP-341: Taproot - SegWit version 1 spending rules", "https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki"),
        new LinkItem("Original Schnorr Paper (1991)", "https://www.math.uni-frankfurt.de/~dmst/research/papers/schnorr.proof_of_signature.pdf")
      ];

      this.references = [
        new LinkItem("libsecp256k1 Implementation", "https://github.com/bitcoin-core/secp256k1"),
        new LinkItem("Bitcoin Core Integration", "https://github.com/bitcoin/bitcoin/pull/17977")
      ];

      // BIP-340 official test vectors
      this.tests = this._loadBIP340TestVectors();
    }

    /**
     * Load BIP-340 official test vectors from reference CSV
     */
    _loadBIP340TestVectors() {
      const vectors = [];

      // Test vector 0: Basic signing test
      vectors.push({
        text: "BIP-340 Vector #0 - Basic signature",
        uri: "https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv",
        secretKey: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000003"),
        publicKey: OpCodes.Hex8ToBytes("F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9"),
        auxRand: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0")
      });

      // Test vector 1: Signature with non-zero key and message
      vectors.push({
        text: "BIP-340 Vector #1 - Non-zero signature",
        uri: "https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv",
        secretKey: OpCodes.Hex8ToBytes("B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF"),
        publicKey: OpCodes.Hex8ToBytes("DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659"),
        auxRand: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000001"),
        input: OpCodes.Hex8ToBytes("243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89"),
        expected: OpCodes.Hex8ToBytes("6896BD60EEAE296DB48A229FF71DFE071BDE413E6D43F917DC8DCF8C78DE33418906D11AC976ABCCB20B091292BFF4EA897EFCB639EA871CFA95F6DE339E4B0A")
      });

      // Test vector 2: Test with different aux_rand
      vectors.push({
        text: "BIP-340 Vector #2 - Different aux_rand",
        uri: "https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv",
        secretKey: OpCodes.Hex8ToBytes("C90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B14E5C9"),
        publicKey: OpCodes.Hex8ToBytes("DD308AFEC5777E13121FA72B9CC1B7CC0139715309B086C960E18FD969774EB8"),
        auxRand: OpCodes.Hex8ToBytes("C87AA53824B4D7AE2EB035A2B5BBBCCC080E76CDC6D1692C4B0B62D798E6D906"),
        input: OpCodes.Hex8ToBytes("7E2D58D8B3BCDF1ABADEC7829054F90DDA9805AAB56C77333024B9D0A508B75C"),
        expected: OpCodes.Hex8ToBytes("5831AAEED7B44BB74E5EAB94BA9D4294C49BCF2A60728D8B4C200F50DD313C1BAB745879A5AD954A72C45A91C3A51D3C7ADEA98D82F8481E0E1E03674A6F3FB7")
      });

      // Test vector 3: Test with all 0xFF values
      vectors.push({
        text: "BIP-340 Vector #3 - Maximum values test",
        uri: "https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv",
        secretKey: OpCodes.Hex8ToBytes("0B432B2677937381AEF05BB02A66ECD012773062CF3FA2549E44F58ED2401710"),
        publicKey: OpCodes.Hex8ToBytes("25D1DFF95105F5253C4022F628A996AD3A0D95FBF21D468A1B33F8C160D8F517"),
        auxRand: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
        input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
        expected: OpCodes.Hex8ToBytes("7EB0509757E246F19449885651611CB965ECC1A187DD51B64FDA1EDC9637D5EC97582B9CB13DB3933705B32BA982AF5AF25FD78881EBB32771FC5922EFC66EA3")
      });

      return vectors;
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Signature verification uses same instance
      }
      return new SchnorrInstance(this);
    }
  }

  /**
   * Schnorr Algorithm Instance
   */
  class SchnorrInstance extends IAlgorithmInstance {
    constructor(algorithm) {
      super(algorithm);
      this._secretKey = null;
      this._publicKey = null;
      this._auxRand = null;
      this._message = null;
      this._signature = null;
    }

    // Property: secretKey
    set secretKey(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._secretKey = null;
        return;
      }

      if (keyBytes.length !== 32) {
        throw new Error('Secret key must be 32 bytes');
      }

      this._secretKey = [...keyBytes];

      // Auto-generate public key
      this._publicKey = generatePublicKey(this._secretKey);
    }

    get secretKey() {
      return this._secretKey ? [...this._secretKey] : null;
    }

    // Property: publicKey
    set publicKey(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._publicKey = null;
        return;
      }

      if (keyBytes.length !== 32) {
        throw new Error('Public key must be 32 bytes');
      }

      this._publicKey = [...keyBytes];
    }

    get publicKey() {
      return this._publicKey ? [...this._publicKey] : null;
    }

    // Property: auxRand (auxiliary randomness for signing)
    set auxRand(randBytes) {
      if (!randBytes || randBytes.length === 0) {
        this._auxRand = null;
        return;
      }

      if (randBytes.length !== 32) {
        throw new Error('Auxiliary randomness must be 32 bytes');
      }

      this._auxRand = [...randBytes];
    }

    get auxRand() {
      return this._auxRand ? [...this._auxRand] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      if (!this._message) {
        this._message = [];
      }

      this._message.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._message || this._message.length === 0) {
        throw new Error('No message data fed');
      }

      // If we have a signature, verify it
      if (this._signature) {
        if (!this._publicKey) {
          throw new Error('Public key not set for verification');
        }

        const isValid = verify(this._publicKey, this._message, this._signature);
        this._message = null;
        this._signature = null;

        // Return verification result as bytes (1 = valid, 0 = invalid)
        return [isValid ? 1 : 0];
      }

      // Otherwise, generate signature
      if (!this._secretKey) {
        throw new Error('Secret key not set for signing');
      }

      const signature = sign(this._secretKey, this._message, this._auxRand);
      this._message = null;

      return signature;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new SchnorrAlgorithm());

  // Export for direct use
  return {
    SchnorrAlgorithm,
    SchnorrInstance,
    sign,
    verify,
    generatePublicKey
  };
}));
