/*
 * SEED Key Wrap with Padding (RFC 5649) Implementation
 * Production-quality implementation following RFC 5649 standards
 * (c)2006-2025 Hawkynt
 *
 * RFC 5649 Key Wrap with Padding Algorithm Overview:
 * - Extension of RFC 3394 key wrapping to support arbitrary-length plaintext
 * - Uses Alternative Initial Value (AIV) with embedded plaintext length
 * - Pads plaintext to multiple of 8 bytes with zero bytes
 * - AIV format: 0xA65959A6 || 32-bit MLI (Message Length Indicator)
 * - Provides both confidentiality and authentication for key material
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/seed'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/seed')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.SEED);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, SEEDModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CryptoAlgorithm, KeySize, LinkItem, IAlgorithmInstance } = AlgorithmFramework;

  // Default AIV (Alternative Initial Value) for RFC 5649
  /** @type {uint8[]} */
  const DEFAULT_AIV = [0xA6, 0x59, 0x59, 0xA6];

  // Helper function to get SEED algorithm (registry-first, plain require fallback)
  /**
   */
  function getSEEDAlgorithm() {
    let seed = AlgorithmFramework.Find('SEED');
    if (!seed && typeof require !== 'undefined') {
      try { require('../block/seed.js'); } catch (e) { /* not found — error below */ }
      seed = AlgorithmFramework.Find('SEED');
    }
    if (!seed)
      throw new Error("SEED not available — load algorithms/block/seed.js first");
    return seed;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class SEEDKeyWrapPadAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SEED Key Wrap with Padding";
      this.description = "RFC 5649 key wrapping with padding applied to SEED cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding length in AIV.";
      this.inventor = "NIST (RFC 5649 specification with SEED cipher)";
      this.year = 2009;
      this.country = CountryCode.KR;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // Fixed 128-bit SEED keys
      ];

      this.documentation = [
        new LinkItem("RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm", "https://www.ietf.org/rfc/rfc5649.txt"),
        new LinkItem("NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping", "https://csrc.nist.gov/publications/detail/sp/800-38f/final"),
        new LinkItem("RFC 4269 - The SEED Encryption Algorithm", "https://tools.ietf.org/rfc/rfc4269.txt")
      ];

      this.references = [
        new LinkItem("BouncyCastle Rfc5649WrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java"),
        new LinkItem("BouncyCastle SEEDEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/SEEDEngine.java")
      ];

      // No published official SEED-KWP test vectors were found (RFC 5649 only defines vectors for AES;
      // KISA/TTA and NIST CAVP do not publish SEED-specific KWP KATs; a targeted search of the bc-java
      // source tree found only SEEDEngine.java/SEEDWrapEngine.java (RFC 3394, unpadded) alongside the
      // generic RFC5649WrapEngine, with no bundled SEED-KWP test vectors).
      // These are self-consistency vectors: the RFC 3394/5649 wrap/unwrap loop implemented below is
      // structurally identical to this repository's aeswrappad.js, which reproduces RFC 5649 Section 6
      // official AES-KWP vectors bit-for-bit; the SEED primitive itself is independently verified
      // against the RFC 4269 known-answer tests in algorithms/block/seed.js. Plaintext size mirrors the
      // RFC 5649 Section 6 examples (7-octet and 20-octet key data) with SEED (fixed 128-bit key)
      // substituted for AES. Vectors were computed with this repository's own SEEDKeyWrapPad
      // implementation and confirmed to round-trip (wrap then unwrap recovers the original plaintext
      // exactly).
      this.tests = [
        {
          text: "Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.2, with SEED substituted for AES; no official SEED-KWP KAT exists) — single-block case (7-octet key data)",
          uri: "https://www.rfc-editor.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("466f7250617369"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("47e20ac2284005f3dbdf0b2ee509a460")
        },
        {
          text: "Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.1, with SEED substituted for AES; no official SEED-KWP KAT exists) — multi-block case (20-octet key data, general RFC 3394 loop)",
          uri: "https://www.rfc-editor.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("c37b7e6492584340bed12207808941155068f738"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("938241514e0bf5f5ead58fe8eb09a93fa101fefc47e2f90de121a3765644226a")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {SEEDKeyWrapPadInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SEEDKeyWrapPadInstance(this, isInverse);
    }
  }

  /**
 * SEEDKeyWrapPad cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SEEDKeyWrapPadInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SEEDKeyWrapPadAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {KeySize[]} */
      this.keySizeList = algorithm.SupportedKeySizes;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this._aiv = [...DEFAULT_AIV];
      /** @type {IBlockCipherInstance|null} */
      this.seedInstance = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.seedInstance = null;
        return;
      }

      // Validate key size (must be 128 bits for SEED)
      /** @type {boolean} */
      let isValidSize = false;
      for (let k = 0; k < this.keySizeList.length; k++) {
        /** @type {KeySize} */
        const ks = this.keySizeList[k];
        if (keyBytes.length >= ks.minSize &&
            keyBytes.length <= ks.maxSize) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (must be 16)');
      }

      this._key = [...keyBytes];
      // Don't initialize SEED instance here - do it lazily when needed
      this.seedInstance = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} aivBytes - 4-byte AIV prefix, or null for the RFC 5649 default
     */
    set aiv(aivBytes) {
      if (!aivBytes) {
        this._aiv = [...DEFAULT_AIV];
        return;
      }

      if (aivBytes.length !== 4) {
        throw new Error('Invalid AIV size: ' + aivBytes.length + ' bytes (must be 4)');
      }

      this._aiv = [...aivBytes];
    }

    /**
     * @returns {uint8[]} Copy of the 4-byte AIV prefix
     */
    get aiv() {
      return [...this._aiv];
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      /** @type {uint8[]} */
      const result = this.isInverse ? this._unwrap() : this._wrap();
      this.inputBuffer = [];
      return result;
    }

    /**
     * Zero-pad to a multiple of 8 bytes (RFC 5649 section 4.1)
     * @param {uint8[]} plaintext - Key data
     * @returns {uint8[]} Padded copy
     */
    _padPlaintext(plaintext) {
      /** @type {int32} */
      const plaintextLength = plaintext.length;
      /** @type {int32} */
      const numOfZerosToAppend = (8 - (plaintextLength % 8)) % 8;
      /** @type {uint8[]} */
      const paddedPlaintext = new Array(plaintextLength + numOfZerosToAppend);

      // Copy plaintext
      for (let i = 0; i < plaintextLength; ++i) {
        paddedPlaintext[i] = plaintext[i];
      }

      // Append zero padding
      for (let i = plaintextLength; i < paddedPlaintext.length; ++i) {
        paddedPlaintext[i] = 0;
      }

      return paddedPlaintext;
    }

    /**
     * Wrap the buffered key data (RFC 5649 section 4.1)
     * @returns {uint8[]} Wrapped data
     */
    _wrap() {
      /** @type {uint8[]} */
      const plaintext = this.inputBuffer;
      /** @type {int32} */
      const plaintextLength = plaintext.length;

      // Create AIV with MLI (Message Length Indicator)
      /** @type {uint8[]} */
      const aiv = new Array(8);
      aiv[0] = this._aiv[0];
      aiv[1] = this._aiv[1];
      aiv[2] = this._aiv[2];
      aiv[3] = this._aiv[3];
      // Pack MLI as big-endian 32-bit integer using OpCodes
      /** @type {uint8[]} */
      const mliBytes = OpCodes.Unpack32BE(plaintextLength);
      aiv[4] = mliBytes[0];
      aiv[5] = mliBytes[1];
      aiv[6] = mliBytes[2];
      aiv[7] = mliBytes[3];

      // Pad plaintext to multiple of 8 bytes
      /** @type {uint8[]} */
      const paddedPlaintext = this._padPlaintext(plaintext);

      // Initialize SEED instance if not already done
      if (!this.seedInstance) {
        const SEEDAlgorithm = getSEEDAlgorithm();
        /** @type {IBlockCipherInstance} */
        const engine = SEEDAlgorithm.CreateInstance(false);
        engine.key = this._key;
        this.seedInstance = engine;
      }
      /** @type {IBlockCipherInstance} */
      const seedEncrypt = this.seedInstance;

      // Special case: if padded plaintext is exactly 8 bytes
      if (paddedPlaintext.length === 8) {
        // Prepend AIV and encrypt as single block (or multiple blocks for 128-bit cipher)
        const block = [...aiv, ...paddedPlaintext];
        seedEncrypt.Feed(block);
        /** @type {uint8[]} */
        const single = seedEncrypt.Result();
        return single;
      }

      // General case: use RFC 3394 wrap with custom AIV
      // Initialize variables
      let A = [...aiv];  // 64-bit register A
      /** @type {int32} */
      const n = paddedPlaintext.length / 8;
      /** @type {uint8[][]} */
      const R = [];      // Array of n 64-bit registers

      // Copy input into R[0]...R[n-1]
      for (let i = 0; i < n; ++i) {
        R[i] = paddedPlaintext.slice(i * 8, (i + 1) * 8);
      }

      // Perform wrapping operation (RFC 3394 algorithm)
      for (let j = 0; j <= 5; ++j) {
        for (let i = 0; i < n; ++i) {
          // B = SEED(K, A|R[i])
          const block = [...A, ...R[i]];
          seedEncrypt.Feed(block);
          /** @type {uint8[]} */
          const B = seedEncrypt.Result();

          // A = MSB(64, B) XOR t (where t = n*j + i + 1)
          A = B.slice(0, 8);
          const t = n * j + i + 1;

          // XOR the counter t into the last 4 bytes of A (big-endian)
          for (let k = 1; t !== 0 && k <= 4; ++k) {
            A[8 - k] = OpCodes.Xor8(A[8 - k], OpCodes.GetByte(t, k - 1));
          }

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Output is A|R[0]|R[1]|...|R[n-1]
      /** @type {uint8[]} */
      const output = [...A];
      for (let i = 0; i < n; ++i) {
        for (let b = 0; b < R[i].length; ++b) output.push(R[i][b]);
      }

      return output;
    }

    /**
     * Unwrap the buffered data (RFC 5649 section 4.2)
     * @returns {uint8[]} Unwrapped key data
     */
    _unwrap() {
      /** @type {uint8[]} */
      const ciphertext = this.inputBuffer;

      // Validate input length (must be at least 16 bytes, multiple of 8)
      if (ciphertext.length < 16) {
        throw new Error('Unwrap data must be at least 16 bytes');
      }

      if (ciphertext.length % 8 !== 0) {
        throw new Error('Unwrap data must be a multiple of 8 bytes');
      }

      /** @type {int32} */
      const n = (ciphertext.length / 8) - 1;

      // Get SEED algorithm
      const SEEDAlgorithm = getSEEDAlgorithm();

      /** @type {uint8[]} */
      let extractedAIV = [];
      /** @type {uint8[]} */
      let paddedPlaintext = [];

      // Special case: exactly 16 bytes (two 64-bit blocks)
      if (n === 1) {
        // Decrypt as a single block
        /** @type {IBlockCipherInstance} */
        const seedSingle = SEEDAlgorithm.CreateInstance(true);
        seedSingle.key = this._key;
        seedSingle.Feed(ciphertext);
        /** @type {uint8[]} */
        const decrypted = seedSingle.Result();

        // Extract AIV
        extractedAIV = decrypted.slice(0, 8);
        paddedPlaintext = decrypted.slice(8, 16);
      } else {
        // General case: RFC 3394 unwrap
        // Initialize variables
        /** @type {uint8[]} */
        let A = ciphertext.slice(0, 8);  // First 64 bits
        /** @type {uint8[][]} */
        const R = [];                     // Array of n 64-bit registers

        // Copy ciphertext into R[0]...R[n-1]
        for (let i = 0; i < n; ++i) {
          R[i] = ciphertext.slice((i + 1) * 8, (i + 2) * 8);
        }

        // Perform unwrapping operation
        /** @type {IBlockCipherInstance} */
        const seedDecrypt = SEEDAlgorithm.CreateInstance(true);
        seedDecrypt.key = this._key;

        for (let j = 5; j >= 0; --j) {
          for (let i = n - 1; i >= 0; --i) {
            // Calculate t = n*j + i + 1
            const t = n * j + i + 1;

            // XOR t into A (reverse the operation from wrapping)
            const A_copy = [...A];
            for (let k = 1; t !== 0 && k <= 4; ++k) {
              A_copy[8 - k] = OpCodes.Xor8(A_copy[8 - k], OpCodes.GetByte(t, k - 1));
            }

            // B = SEED_Decrypt(K, (A XOR t)|R[i])
            const block = [...A_copy, ...R[i]];
            seedDecrypt.Feed(block);
            /** @type {uint8[]} */
            const B = seedDecrypt.Result();

            // A = MSB(64, B)
            A = B.slice(0, 8);

            // R[i] = LSB(64, B)
            R[i] = B.slice(8, 16);
          }
        }

        extractedAIV = A;

        // Reconstruct padded plaintext
        paddedPlaintext = [];
        for (let i = 0; i < n; ++i) {
          for (let b = 0; b < R[i].length; ++b) paddedPlaintext.push(R[i][b]);
        }
      }

      // Decompose the extracted AIV to the fixed portion and the MLI
      /** @type {uint8[]} */
      const extractedHighOrderAIV = extractedAIV.slice(0, 4);
      /** @type {uint32} */
      const mli = OpCodes.Pack32BE(extractedAIV[4], extractedAIV[5], extractedAIV[6], extractedAIV[7]);

      // Check the fixed portion of the AIV (constant-time comparison)
      /** @type {boolean} */
      let isValid = OpCodes.ConstantTimeCompare(extractedHighOrderAIV, this._aiv);

      // Check the MLI against the actual length; this range test is also the
      // test that the number of padding zeros, upperBound - MLI, is 0..7
      /** @type {int32} */
      const upperBound = paddedPlaintext.length;
      /** @type {int32} */
      const lowerBound = upperBound - 8;
      /** @type {int32} */
      let expectedZeros = 4;
      if (mli <= lowerBound || mli > upperBound) {
        // Pick a "typical" amount of padding to avoid timing attacks
        isValid = false;
      } else {
        expectedZeros = upperBound - OpCodes.ToInt(mli);
      }

      // Verify padding is all zeros (constant-time)
      /** @type {uint8[]} */
      const zeros = OpCodes.CreateArray(expectedZeros, 0);
      /** @type {uint8[]} */
      const pad = paddedPlaintext.slice(paddedPlaintext.length - expectedZeros);
      if (!OpCodes.ConstantTimeCompare(pad, zeros)) {
        isValid = false;
      }

      if (!isValid) {
        throw new Error('Integrity check failed: invalid padding or AIV');
      }

      // Extract the plaintext from the padded plaintext
      return paddedPlaintext.slice(0, mli);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new SEEDKeyWrapPadAlgorithm());

  return SEEDKeyWrapPadAlgorithm;
}));
