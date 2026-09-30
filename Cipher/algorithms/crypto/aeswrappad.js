/*
 * AES Key Wrap with Padding (RFC 5649) Implementation
 * Production-quality implementation following RFC 5649 and NIST SP 800-38F standards
 * (c)2006-2025 Hawkynt
 *
 * AES Key Wrap with Padding Algorithm Overview:
 * - Extension of RFC 3394 that allows wrapping keys not on 8-byte boundaries
 * - Supports wrapping plaintexts from 1 byte to any length
 * - Uses Alternative Initial Value (AIV) that includes plaintext length
 * - Provides both confidentiality and authentication for key material
 * - AIV Structure: 0xA65959A6 || 32-bit plaintext length
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/rijndael'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/rijndael')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.Rijndael);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, RijndaelModule) {
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

  // Alternative IV for RFC 5649 (high 32 bits)
  /** @type {uint8[]} */
  const DEFAULT_AIV_HIGH = [0xA6, 0x59, 0x59, 0xA6];

  /**
   * Get the Rijndael algorithm (registry-first, plain require fallback)
   */
  function getRijndaelAlgorithm() {
    let rijndael = AlgorithmFramework.Find('Rijndael (AES)');
    if (!rijndael && typeof require !== 'undefined') {
      try { require('../block/rijndael.js'); } catch (e) { /* not found — error below */ }
      rijndael = AlgorithmFramework.Find('Rijndael (AES)');
    }
    if (!rijndael)
      throw new Error("Rijndael (AES) not available — load algorithms/block/rijndael.js first");
    return rijndael;
  }

  /**
   * Result of an RFC 3394 unwrap before the IV check
   * @class
   */
  class UnwrapResult {
    /**
     * @param {uint8[]} aiv - Recovered 8-byte integrity value
     * @param {uint8[]} plaintext - Recovered (padded) plaintext
     */
    constructor(aiv, plaintext) {
      /** @type {uint8[]} */
      this.aiv = aiv;
      /** @type {uint8[]} */
      this.plaintext = plaintext;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class AesKeyWrapPadAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "AES Key Wrap with Padding";
      this.description = "RFC 5649 extension of AES Key Wrap that supports wrapping keys of any length (not limited to multiples of 8 bytes). Uses Alternative Initial Value (AIV) containing plaintext length.";
      this.inventor = "NIST";
      this.year = 2009;
      this.country = CountryCode.US;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8)  // 128, 192, 256-bit AES keys
      ];

      this.documentation = [
        new LinkItem("RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm", "https://www.rfc-editor.org/rfc/rfc5649.txt"),
        new LinkItem("NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      this.references = [
        new LinkItem("BouncyCastle RFC5649WrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java"),
        new LinkItem("RFC 3394 - AES Key Wrap Algorithm", "https://www.ietf.org/rfc/rfc3394.txt")
      ];

      // Test vectors from RFC 5649 Section 6
      this.tests = [
        {
          text: "RFC 5649 Section 6.1 - 192-bit KEK, 20-octet Key Data",
          uri: "https://www.rfc-editor.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("c37b7e6492584340bed12207808941155068f738"),
          key: OpCodes.Hex8ToBytes("5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8"),
          expected: OpCodes.Hex8ToBytes("138bdeaa9b8fa7fc61f97742e72248ee5ae6ae5360d1ae6a5f54f373fa543b6a")
        },
        {
          text: "RFC 5649 Section 6.2 - 192-bit KEK, 7-octet Key Data",
          uri: "https://www.rfc-editor.org/rfc/rfc5649.txt",
          input: OpCodes.Hex8ToBytes("466f7250617369"),
          key: OpCodes.Hex8ToBytes("5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8"),
          expected: OpCodes.Hex8ToBytes("afbeb0f07dfbf5419200f2ccb50bb24f")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {AesKeyWrapPadInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AesKeyWrapPadInstance(this, isInverse);
    }
  }

  /**
 * AesKeyWrapPad cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AesKeyWrapPadInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {AesKeyWrapPadAlgorithm} algorithm - Parent algorithm instance
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
      this._aivHigh = [...DEFAULT_AIV_HIGH];
      /** @type {IBlockCipherInstance|null} */
      this.aesInstance = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.aesInstance = null;
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
      // Don't initialize AES instance here - do it lazily when needed
      this.aesInstance = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._aivHigh = [...DEFAULT_AIV_HIGH];
        return;
      }

      if (ivBytes.length !== 4) {
        throw new Error('Invalid IV size: ' + ivBytes.length + ' bytes (must be 4 for AIV high portion)');
      }

      this._aivHigh = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return [...this._aivHigh];
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
     * Pads plaintext to multiple of 8 bytes as per RFC 5649 Section 4.1
     * @param {uint8[]} plaintext - Key data
     * @returns {uint8[]} Zero-padded copy
     */
    _padPlaintext(plaintext) {
      /** @type {int32} */
      const plaintextLength = plaintext.length;
      /** @type {int32} */
      const numZeros = (8 - (plaintextLength % 8)) % 8;

      if (numZeros === 0) {
        return plaintext.slice();
      }

      /** @type {uint8[]} */
      const paddedPlaintext = plaintext.slice();
      for (let i = 0; i < numZeros; ++i) {
        paddedPlaintext.push(0);
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

      // Validate input length (must be at least 1 byte)
      if (plaintext.length < 1) {
        throw new Error('Wrap data must be at least 1 byte');
      }

      // Build AIV: AIV_high (4 bytes) || MLI (4 bytes, big-endian)
      /** @type {uint32} */
      const mli = plaintext.length;
      /** @type {uint8[]} */
      const mliBytes = OpCodes.Unpack32BE(mli);
      /** @type {uint8[]} */
      const aiv = [...this._aivHigh, ...mliBytes];

      // Pad plaintext to multiple of 8 bytes
      /** @type {uint8[]} */
      const paddedPlaintext = this._padPlaintext(plaintext);

      // Initialize AES instance if not already done
      if (!this.aesInstance) {
        const RijndaelAlgorithm = getRijndaelAlgorithm();
        /** @type {IBlockCipherInstance} */
        const aes = RijndaelAlgorithm.CreateInstance(false);
        aes.key = this._key;
        this.aesInstance = aes;
      }

      // Special case: exactly 8 bytes of padded plaintext
      if (paddedPlaintext.length === 8) {
        // Prepend AIV and encrypt as single block
        /** @type {uint8[]} */
        const block = [...aiv, ...paddedPlaintext];
        /** @type {IBlockCipherInstance} */
        const aesSingle = this.aesInstance;
        aesSingle.Feed(block);
        /** @type {uint8[]} */
        const single = aesSingle.Result();
        return single;
      }

      // General case: Use RFC 3394 wrapping with AIV
      return this._rfc3394Wrap(paddedPlaintext, aiv);
    }

    /**
     * Unwrap the buffered data (RFC 5649 section 4.2)
     * @returns {uint8[]} Unwrapped key data
     */
    _unwrap() {
      /** @type {uint8[]} */
      const ciphertext = this.inputBuffer;

      // Validate input length (must be at least 16 bytes, multiple of 8)
      /** @type {float64} */
      const n = ciphertext.length / 8;

      if (ciphertext.length < 16) {
        throw new Error('Unwrap data must be at least 16 bytes');
      }

      if ((n * 8) !== ciphertext.length) {
        throw new Error('Unwrap data must be a multiple of 8 bytes');
      }

      if (n <= 1) {
        throw new Error('Unwrap data must be at least 16 bytes');
      }

      // Get Rijndael algorithm
      const RijndaelAlgorithm = getRijndaelAlgorithm();

      /** @type {uint8[]} */
      let extractedAIV = [];
      /** @type {uint8[]} */
      let paddedPlaintext = [];

      // Special case: exactly 2 blocks (16 bytes)
      if (n === 2) {
        // Decrypt as single AES block
        /** @type {IBlockCipherInstance} */
        const aesDecrypt = RijndaelAlgorithm.CreateInstance(true);
        aesDecrypt.key = this._key;
        aesDecrypt.Feed(ciphertext);
        /** @type {uint8[]} */
        const decrypted = aesDecrypt.Result();

        // Extract AIV and padded plaintext
        extractedAIV = decrypted.slice(0, 8);
        paddedPlaintext = decrypted.slice(8, 16);
      } else {
        // General case: Use RFC 3394 unwrapping
        /** @type {UnwrapResult} */
        const result = this._rfc3394UnwrapNoIvCheck(ciphertext);
        extractedAIV = result.aiv;
        paddedPlaintext = result.plaintext;
      }

      // Decompose AIV: high 4 bytes || MLI (4 bytes)
      /** @type {uint8[]} */
      const extractedAIVHigh = extractedAIV.slice(0, 4);
      /** @type {uint32} */
      const mli = OpCodes.Pack32BE(extractedAIV[4], extractedAIV[5], extractedAIV[6], extractedAIV[7]);

      // Constant-time validation to prevent timing attacks
      /** @type {boolean} */
      let isValid = true;

      // Check AIV high portion
      if (!OpCodes.ConstantTimeCompare(extractedAIVHigh, this._aivHigh)) {
        isValid = false;
      }

      // Check MLI bounds: upperBound - 8 < MLI <= upperBound, which also
      // bounds the number of padding zeros, upperBound - MLI, to 0..7
      /** @type {int32} */
      const upperBound = paddedPlaintext.length;
      /** @type {int32} */
      const lowerBound = upperBound - 8;

      if (mli <= lowerBound || mli > upperBound) {
        isValid = false;
      }

      // Verify padding is all zeros
      if (isValid && mli < upperBound) {
        /** @type {int32} */
        const paddingStart = OpCodes.ToInt(mli);
        for (let i = paddingStart; i < paddedPlaintext.length; ++i) {
          if (paddedPlaintext[i] !== 0) {
            isValid = false;
            break;
          }
        }
      }

      if (!isValid) {
        throw new Error('Integrity check failed');
      }

      // Extract actual plaintext
      return paddedPlaintext.slice(0, mli);
    }

    /**
     * RFC 3394 wrap implementation with custom IV
     * @param {uint8[]} plaintext - Padded plaintext, a multiple of 8 bytes
     * @param {uint8[]} iv - 8-byte initial value
     * @returns {uint8[]} Wrapped data
     */
    _rfc3394Wrap(plaintext, iv) {
      /** @type {int32} */
      const n = plaintext.length / 8;
      /** @type {IBlockCipherInstance} */
      const aesEncrypt = this.aesInstance;

      // Initialize variables
      /** @type {uint8[]} */
      let A = [...iv];
      /** @type {uint8[][]} */
      const R = [];

      // Copy input into R[0]...R[n-1]
      for (let i = 0; i < n; ++i) {
        R[i] = plaintext.slice(i * 8, (i + 1) * 8);
      }

      // Perform wrapping operation
      for (let j = 0; j <= 5; ++j) {
        for (let i = 0; i < n; ++i) {
          // B = AES(K, A|R[i])
          const block = [...A, ...R[i]];
          aesEncrypt.Feed(block);
          /** @type {uint8[]} */
          const B = aesEncrypt.Result();

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
     * RFC 3394 unwrap implementation without IV checking
     * Returns both AIV and plaintext for separate validation
     * @param {uint8[]} ciphertext - Wrapped data, a multiple of 8 bytes
     * @returns {UnwrapResult} Recovered AIV and padded plaintext
     */
    _rfc3394UnwrapNoIvCheck(ciphertext) {
      /** @type {int32} */
      const n = (ciphertext.length / 8) - 1;

      // Initialize variables
      /** @type {uint8[]} */
      let A = ciphertext.slice(0, 8);
      /** @type {uint8[][]} */
      const R = [];

      // Copy ciphertext into R[0]...R[n-1]
      for (let i = 0; i < n; ++i) {
        R[i] = ciphertext.slice((i + 1) * 8, (i + 2) * 8);
      }

      // Get Rijndael algorithm for decryption
      const RijndaelAlgorithm = getRijndaelAlgorithm();
      /** @type {IBlockCipherInstance} */
      const aesDecrypt = RijndaelAlgorithm.CreateInstance(true);
      aesDecrypt.key = this._key;

      // Perform unwrapping operation
      for (let j = 5; j >= 0; --j) {
        for (let i = n - 1; i >= 0; --i) {
          // Calculate t = n*j + i + 1
          const t = n * j + i + 1;

          // XOR t into A (reverse the operation from wrapping)
          const A_copy = [...A];
          for (let k = 1; t !== 0 && k <= 4; ++k) {
            A_copy[8 - k] = OpCodes.Xor8(A_copy[8 - k], OpCodes.GetByte(t, k - 1));
          }

          // B = AES_Decrypt(K, (A XOR t)|R[i])
          const block = [...A_copy, ...R[i]];
          aesDecrypt.Feed(block);
          /** @type {uint8[]} */
          const B = aesDecrypt.Result();

          // A = MSB(64, B)
          A = B.slice(0, 8);

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Return AIV and plaintext separately
      /** @type {uint8[]} */
      const plaintext = [];
      for (let i = 0; i < n; ++i) {
        for (let b = 0; b < R[i].length; ++b) plaintext.push(R[i][b]);
      }

      return new UnwrapResult(A, plaintext);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new AesKeyWrapPadAlgorithm());

  return AesKeyWrapPadAlgorithm;
}));
