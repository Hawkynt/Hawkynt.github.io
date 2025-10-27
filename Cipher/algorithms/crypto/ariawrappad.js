/*
 * ARIA Key Wrap with Padding (RFC 5649) Implementation
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
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/aria'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/aria')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.ARIA);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, ARIAModule) {
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
  const DEFAULT_AIV = [0xA6, 0x59, 0x59, 0xA6];

  // Helper function to get ARIA algorithm (lazy loading with auto-load)
  function getARIAAlgorithm() {
    let aria = AlgorithmFramework.Find('ARIA');

    // If not found, try to load it
    if (!aria) {
      const errors = [];
      try {
        // Attempt to load ARIA using multiple path strategies
        if (typeof require !== 'undefined') {
          const path = require('path');
          // Try from project root (go up from tests/ if needed)
          let baseDir = path.dirname(require.main.filename);
          // If we're in tests directory, go up one level
          if (baseDir.endsWith('tests')) {
            baseDir = path.dirname(baseDir);
          }
          const ariaPath = path.join(baseDir, 'algorithms', 'block', 'aria.js');

          // Clear require cache to force re-registration
          delete require.cache[require.resolve(ariaPath)];

          require(ariaPath);
          aria = AlgorithmFramework.Find('ARIA');
        }
      } catch (e) {
        errors.push('Strategy 1 failed: ' + e.message);
        // Try relative path as fallback
        try {
          if (typeof require !== 'undefined') {
            const path = require('path');
            const relativePath = '../block/aria.js';
            const resolvedPath = path.resolve(__dirname, relativePath);

            // Clear require cache
            if (require.cache[resolvedPath]) {
              delete require.cache[resolvedPath];
            }

            require(relativePath);
            aria = AlgorithmFramework.Find('ARIA');
          }
        } catch (e2) {
          errors.push('Strategy 2 failed: ' + e2.message);
        }
      }

      if (!aria) {
        throw new Error('ARIA algorithm not found. Errors: ' + errors.join('; '));
      }
    }
    return aria;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ARIAKeyWrapPadAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ARIA Key Wrap with Padding";
      this.description = "RFC 5649 key wrapping with padding applied to ARIA cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding length in AIV.";
      this.inventor = "NIST (RFC 5649 specification with ARIA cipher)";
      this.year = 2009;
      this.country = CountryCode.KR;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8)  // 128, 192, 256-bit ARIA keys
      ];

      this.documentation = [
        new LinkItem("RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm", "https://www.ietf.org/rfc/rfc5649.txt"),
        new LinkItem("NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping", "https://csrc.nist.gov/publications/detail/sp/800-38f/final"),
        new LinkItem("RFC 5794 - ARIA Encryption Algorithm", "https://tools.ietf.org/rfc/rfc5794.txt")
      ];

      this.references = [
        new LinkItem("BouncyCastle Rfc5649WrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java"),
        new LinkItem("BouncyCastle AriaWrapPadEngine", "https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/AriaWrapPadEngine.cs")
      ];

      // NOTE: Authentic test vectors needed from official sources
      // RFC 5649 does not provide ARIA-specific test vectors
      // Acceptable sources: NIST CAVP, Korean cryptographic standards, BouncyCastle validated outputs
      this.tests = [];
    }

    CreateInstance(isInverse = false) {
      return new ARIAKeyWrapPadInstance(this, isInverse);
    }
  }

  class ARIAKeyWrapPadInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._aiv = [...DEFAULT_AIV];
      this.ariaInstance = null;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.ariaInstance = null;
        return;
      }

      // Validate key size (must be 128, 192, or 256 bits)
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize &&
        keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (must be 16, 24, or 32)');
      }

      this._key = [...keyBytes];
      // Don't initialize ARIA instance here - do it lazily when needed
      this.ariaInstance = null;
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

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

    get aiv() {
      return [...this._aiv];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error('Key not set');
      }

      if (this.inputBuffer.length === 0) {
        throw new Error('No data fed');
      }

      const result = this.isInverse ? this._unwrap() : this._wrap();
      this.inputBuffer = [];
      return result;
    }

    _padPlaintext(plaintext) {
      const plaintextLength = plaintext.length;
      const numOfZerosToAppend = (8 - (plaintextLength % 8)) % 8;
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

    _wrap() {
      const plaintext = this.inputBuffer;
      const plaintextLength = plaintext.length;

      // Create AIV with MLI (Message Length Indicator)
      const aiv = new Array(8);
      aiv[0] = this._aiv[0];
      aiv[1] = this._aiv[1];
      aiv[2] = this._aiv[2];
      aiv[3] = this._aiv[3];
      // Pack MLI as big-endian 32-bit integer using OpCodes
      const mliBytes = OpCodes.Unpack32BE(plaintextLength);
      aiv[4] = mliBytes[0];
      aiv[5] = mliBytes[1];
      aiv[6] = mliBytes[2];
      aiv[7] = mliBytes[3];

      // Pad plaintext to multiple of 8 bytes
      const paddedPlaintext = this._padPlaintext(plaintext);

      // Initialize ARIA instance if not already done
      if (!this.ariaInstance) {
        const ARIAAlgorithm = getARIAAlgorithm();
        this.ariaInstance = ARIAAlgorithm.CreateInstance(false);
        this.ariaInstance.key = this._key;
      }

      // Special case: if padded plaintext is exactly 8 bytes
      if (paddedPlaintext.length === 8) {
        // Prepend AIV and encrypt as single block (or multiple blocks for 128-bit cipher)
        const block = [...aiv, ...paddedPlaintext];
        this.ariaInstance.Feed(block);
        return this.ariaInstance.Result();
      }

      // General case: use RFC 3394 wrap with custom AIV
      // Initialize variables
      let A = [...aiv];  // 64-bit register A
      const n = paddedPlaintext.length / 8;
      const R = [];      // Array of n 64-bit registers

      // Copy input into R[0]...R[n-1]
      for (let i = 0; i < n; ++i) {
        R[i] = paddedPlaintext.slice(i * 8, (i + 1) * 8);
      }

      // Perform wrapping operation (RFC 3394 algorithm)
      for (let j = 0; j <= 5; ++j) {
        for (let i = 0; i < n; ++i) {
          // B = ARIA(K, A | R[i])
          const block = [...A, ...R[i]];
          this.ariaInstance.Feed(block);
          const B = this.ariaInstance.Result();

          // A = MSB(64, B) XOR t (where t = n*j + i + 1)
          A = B.slice(0, 8);
          const t = n * j + i + 1;

          // XOR the counter t into the last 4 bytes of A (big-endian)
          for (let k = 1; t !== 0 && k <= 4; ++k) {
            A[8 - k] ^= (t >>> ((k - 1) * 8)) & 0xFF;
          }

          // R[i] = LSB(64, B)
          R[i] = B.slice(8, 16);
        }
      }

      // Output is A | R[0] | R[1] | ... | R[n-1]
      const output = [...A];
      for (let i = 0; i < n; ++i) {
        output.push(...R[i]);
      }

      return output;
    }

    _unwrap() {
      const ciphertext = this.inputBuffer;

      // Validate input length (must be at least 16 bytes, multiple of 8)
      if (ciphertext.length < 16) {
        throw new Error('Unwrap data must be at least 16 bytes');
      }

      if (ciphertext.length % 8 !== 0) {
        throw new Error('Unwrap data must be a multiple of 8 bytes');
      }

      const n = (ciphertext.length / 8) - 1;

      // Get ARIA algorithm
      const ARIAAlgorithm = getARIAAlgorithm();

      let extractedAIV;
      let paddedPlaintext;

      // Special case: exactly 16 bytes (two 64-bit blocks)
      if (n === 1) {
        // Decrypt as a single block
        const ariaDecrypt = ARIAAlgorithm.CreateInstance(true);
        ariaDecrypt.key = this._key;
        ariaDecrypt.Feed(ciphertext);
        const decrypted = ariaDecrypt.Result();

        // Extract AIV
        extractedAIV = decrypted.slice(0, 8);
        paddedPlaintext = decrypted.slice(8, 16);
      } else {
        // General case: RFC 3394 unwrap
        // Initialize variables
        let A = ciphertext.slice(0, 8);  // First 64 bits
        const R = [];                     // Array of n 64-bit registers

        // Copy ciphertext into R[0]...R[n-1]
        for (let i = 0; i < n; ++i) {
          R[i] = ciphertext.slice((i + 1) * 8, (i + 2) * 8);
        }

        // Perform unwrapping operation
        const ariaDecrypt = ARIAAlgorithm.CreateInstance(true);
        ariaDecrypt.key = this._key;

        for (let j = 5; j >= 0; --j) {
          for (let i = n - 1; i >= 0; --i) {
            // Calculate t = n*j + i + 1
            const t = n * j + i + 1;

            // XOR t into A (reverse the operation from wrapping)
            const A_copy = [...A];
            for (let k = 1; t !== 0 && k <= 4; ++k) {
              A_copy[8 - k] ^= (t >>> ((k - 1) * 8)) & 0xFF;
            }

            // B = ARIA_Decrypt(K, (A XOR t) | R[i])
            const block = [...A_copy, ...R[i]];
            ariaDecrypt.Feed(block);
            const B = ariaDecrypt.Result();

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
          paddedPlaintext.push(...R[i]);
        }
      }

      // Decompose the extracted AIV to the fixed portion and the MLI
      const extractedHighOrderAIV = extractedAIV.slice(0, 4);
      const mli = OpCodes.Pack32BE(extractedAIV[4], extractedAIV[5], extractedAIV[6], extractedAIV[7]);

      // Check the fixed portion of the AIV (constant-time comparison)
      let isValid = OpCodes.ConstantTimeCompare(extractedHighOrderAIV, this._aiv);

      // Check the MLI against the actual length
      const upperBound = paddedPlaintext.length;
      const lowerBound = upperBound - 8;
      if (mli <= lowerBound || mli > upperBound) {
        isValid = false;
      }

      // Check the number of padding zeros
      let expectedZeros = upperBound - mli;
      if (expectedZeros >= 8 || expectedZeros < 0) {
        // Pick a "typical" amount of padding to avoid timing attacks
        isValid = false;
        expectedZeros = 4;
      }

      // Verify padding is all zeros (constant-time)
      const zeros = new Array(expectedZeros).fill(0);
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
  RegisterAlgorithm(new ARIAKeyWrapPadAlgorithm());

  return ARIAKeyWrapPadAlgorithm;
}));
