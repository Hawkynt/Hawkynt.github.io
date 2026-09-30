/*
 * Camellia Key Wrap with Padding (RFC 5649) Implementation
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
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/camellia'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/camellia')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.Camellia);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, CamelliaModule) {
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

  // Helper function to get Camellia algorithm (registry-first, plain require fallback)
  /**
   */
  function getCamelliaAlgorithm() {
    let camellia = AlgorithmFramework.Find('Camellia');
    if (!camellia && typeof require !== 'undefined') {
      try { require('../block/camellia.js'); } catch (e) { /* not found — error below */ }
      camellia = AlgorithmFramework.Find('Camellia');
    }
    if (!camellia)
      throw new Error("Camellia not available — load algorithms/block/camellia.js first");
    return camellia;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class CamelliaKeyWrapPadAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Camellia Key Wrap with Padding";
      this.description = "RFC 5649 key wrapping with padding applied to Camellia cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding length in AIV.";
      this.inventor = "NIST (RFC 5649 specification with Camellia cipher)";
      this.year = 2009;
      this.country = CountryCode.US;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8)  // 128, 192, 256-bit Camellia keys
      ];

      this.documentation = [
        new LinkItem("RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm", "https://www.ietf.org/rfc/rfc5649.txt"),
        new LinkItem("NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping", "https://csrc.nist.gov/publications/detail/sp/800-38f/final"),
        new LinkItem("RFC 3713 - Camellia Cipher Specification", "https://tools.ietf.org/rfc/rfc3713.txt")
      ];

      this.references = [
        new LinkItem("BouncyCastle Rfc5649WrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java"),
        new LinkItem("BouncyCastle AriaWrapPadEngine", "https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/AriaWrapPadEngine.cs")
      ];

      // No published official Camellia-KWP test vectors were found (RFC 5649 only defines vectors for
      // AES; NIST CAVP, NTT/Mitsubishi, and BouncyCastle do not publish Camellia-specific KWP KATs; a
      // targeted search of the bc-java source tree found only the generic RFC5649WrapEngine wrapping a
      // CamelliaEngine, with no bundled Camellia-KWP test vectors).
      // These are self-consistency vectors: the RFC 3394/5649 wrap/unwrap loop implemented below is
      // structurally identical to this repository's aeswrappad.js, which reproduces RFC 5649 Section 6
      // official AES-KWP vectors bit-for-bit; the Camellia primitive itself is independently verified
      // against the RFC 3713 known-answer tests in algorithms/block/camellia.js. Plaintext/key sizes
      // mirror the RFC 5649 Section 6 examples (7-octet and 20-octet key data) with Camellia substituted
      // for AES. Vectors were computed with this repository's own CamelliaKeyWrapPad implementation and
      // confirmed to round-trip (wrap then unwrap recovers the original plaintext exactly).
      this.tests = [
        {
          text: "Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.2, with Camellia-128 substituted for AES; no official Camellia-KWP KAT exists) — single-block case (7-octet key data)",
          uri: "https://www.rfc-editor.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("466f7250617369"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("bdcc8e794701c12804891be045dd11cb")
        },
        {
          text: "Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.1, with Camellia-192 substituted for AES; no official Camellia-KWP KAT exists) — multi-block case (20-octet key data, general RFC 3394 loop)",
          uri: "https://www.rfc-editor.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("c37b7e6492584340bed12207808941155068f738"),
          key: OpCodes.Hex8ToBytes("5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8"),
          expected: OpCodes.Hex8ToBytes("6fe8e088d2042ea144139b1c7a46a63027226d16c01034c73b6333d4ab05884c")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {CamelliaKeyWrapPadInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CamelliaKeyWrapPadInstance(this, isInverse);
    }
  }

  /**
 * CamelliaKeyWrapPad cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CamelliaKeyWrapPadInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {CamelliaKeyWrapPadAlgorithm} algorithm - Parent algorithm instance
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
      this.camelliaInstance = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.camelliaInstance = null;
        return;
      }

      // Validate key size (must be 128, 192, or 256 bits)
      /** @type {boolean} */
      let isValidSize = false;
      for (let k = 0; k < this.keySizeList.length; k++) {
        /** @type {KeySize} */
        const ks = this.keySizeList[k];
        if (keyBytes.length >= ks.minSize &&
            keyBytes.length <= ks.maxSize &&
            (keyBytes.length - ks.minSize) % ks.stepSize === 0) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (must be 16, 24, or 32)');
      }

      this._key = [...keyBytes];
      // Don't initialize Camellia instance here - do it lazily when needed
      this.camelliaInstance = null;
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

      // Initialize Camellia instance if not already done
      if (!this.camelliaInstance) {
        const CamelliaAlgorithm = getCamelliaAlgorithm();
        /** @type {IBlockCipherInstance} */
        const engine = CamelliaAlgorithm.CreateInstance(false);
        engine.key = this._key;
        this.camelliaInstance = engine;
      }
      /** @type {IBlockCipherInstance} */
      const camelliaEncrypt = this.camelliaInstance;

      // Special case: if padded plaintext is exactly 8 bytes
      if (paddedPlaintext.length === 8) {
        // Prepend AIV and encrypt as single block (or multiple blocks for 128-bit cipher)
        const block = [...aiv, ...paddedPlaintext];
        camelliaEncrypt.Feed(block);
        /** @type {uint8[]} */
        const single = camelliaEncrypt.Result();
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
          // B = Camellia(K, A|R[i])
          const block = [...A, ...R[i]];
          camelliaEncrypt.Feed(block);
          /** @type {uint8[]} */
          const B = camelliaEncrypt.Result();

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

      // Get Camellia algorithm
      const CamelliaAlgorithm = getCamelliaAlgorithm();

      /** @type {uint8[]} */
      let extractedAIV = [];
      /** @type {uint8[]} */
      let paddedPlaintext = [];

      // Special case: exactly 16 bytes (two 64-bit blocks)
      if (n === 1) {
        // Decrypt as a single block
        /** @type {IBlockCipherInstance} */
        const camelliaSingle = CamelliaAlgorithm.CreateInstance(true);
        camelliaSingle.key = this._key;
        camelliaSingle.Feed(ciphertext);
        /** @type {uint8[]} */
        const decrypted = camelliaSingle.Result();

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
        const camelliaDecrypt = CamelliaAlgorithm.CreateInstance(true);
        camelliaDecrypt.key = this._key;

        for (let j = 5; j >= 0; --j) {
          for (let i = n - 1; i >= 0; --i) {
            // Calculate t = n*j + i + 1
            const t = n * j + i + 1;

            // XOR t into A (reverse the operation from wrapping)
            const A_copy = [...A];
            for (let k = 1; t !== 0 && k <= 4; ++k) {
              A_copy[8 - k] = OpCodes.Xor8(A_copy[8 - k], OpCodes.GetByte(t, k - 1));
            }

            // B = Camellia_Decrypt(K, (A XOR t)|R[i])
            const block = [...A_copy, ...R[i]];
            camelliaDecrypt.Feed(block);
            /** @type {uint8[]} */
            const B = camelliaDecrypt.Result();

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
  RegisterAlgorithm(new CamelliaKeyWrapPadAlgorithm());

  return CamelliaKeyWrapPadAlgorithm;
}));
