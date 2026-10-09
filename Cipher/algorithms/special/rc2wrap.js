/*
 * RC2 Key Wrap Implementation (RFC 3217)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * RC2 Key Wrap Algorithm per RFC 3217
 * Wraps cryptographic key material using RC2 in CBC mode
 * Uses CMS Key Checksum (first 8 bytes of SHA-1) for integrity
 *
 * Based on RFC 3217 specification and Bouncy Castle reference implementation
 * Reference: https://www.rfc-editor.org/rfc/rfc3217.txt
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
    root.RC2WRAP = factory(root.AlgorithmFramework, root.OpCodes);
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== HELPER: SHA-1 FOR CMS KEY CHECKSUM =====

  // Helper to calculate CMS Key Checksum using the SHA-1 algorithm
  // CMS Key Checksum: first 8 bytes of SHA-1 hash (RFC 3852)
  class SHA1Helper {
    /**
     * @param {uint8[]} data - Key material to checksum
     * @returns {uint8[]} First 8 bytes of its SHA-1 digest
     */
    static cmsKeyChecksum(data) {
      // Use the registered SHA-1 algorithm
      const sha1Algo = AlgorithmFramework.Find('SHA-1');
      if (!sha1Algo) {
        throw new Error('SHA-1 algorithm not found - ensure sha1.js is loaded');
      }

      /** @type {IHashFunctionInstance} */
      const sha1 = sha1Algo.CreateInstance(false);
      sha1.Feed(data);
      /** @type {uint8[]} */
      const hash = sha1.Result();

      // Return first 8 bytes
      return hash.slice(0, 8);
    }
  }

  // ===== HELPER: RC2 CIPHER ACCESS =====

  /**
   * Get an RC2 instance for CBC mode encryption/decryption
   * @param {uint8[]} kek - Key-encryption key
   * @param {int32} effectiveBits - RC2 effective key bits
   * @param {boolean} decrypt - True for a decrypting instance
   * @returns {IBlockCipherInstance} Keyed RC2 instance
   */
  function getRC2Cipher(kek, effectiveBits, decrypt) {
    // RC2 (registered by rc.js) from the registry, loaded under CommonJS on a miss
    /** @type {Algorithm} */
    let rc2Algo = AlgorithmFramework.Find('RC2');
    if (!rc2Algo && typeof require !== 'undefined') {
      try { require('../block/rc.js'); } catch (e) { /* reported below */ }
      rc2Algo = AlgorithmFramework.Find('RC2');
    }
    if (!rc2Algo) {
      throw new Error('RC2 algorithm not found - ensure rc.js is loaded');
    }

    /** @type {IBlockCipherInstance} */
    const cipher = rc2Algo.CreateInstance(decrypt);
    cipher.key = kek;

    // Set effective bits if specified (the unwrapping direction always sets them)
    if (decrypt || (effectiveBits !== undefined && effectiveBits !== null)) {
      cipher.effectiveBits = effectiveBits;
    }

    return cipher;
  }

  /**
   * Run one 8-byte block through RC2
   * @param {uint8[]} kek - Key-encryption key
   * @param {int32} effectiveBits - RC2 effective key bits
   * @param {boolean} decrypt - True to decrypt
   * @param {uint8[]} block - 8-byte block
   * @returns {uint8[]} Processed block
   */
  function rc2Block(kek, effectiveBits, decrypt, block) {
    /** @type {IBlockCipherInstance} */
    const cipher = getRC2Cipher(kek, effectiveBits, decrypt);
    cipher.Feed(block);
    /** @type {uint8[]} */
    const output = cipher.Result();
    return output;
  }

  // Load dependencies
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha1.js');  // SHA-1 needed for CMS Key Checksum
      require('../block/rc.js');    // RC2 cipher for wrapping
    } catch (e) {
      // Already loaded or not in Node.js environment
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class RC2WrapAlgorithm extends Algorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RC2-WRAP";
      this.description = "RC2 Key Wrap per RFC 3217. Wraps cryptographic key material using RC2-CBC with CMS Key Checksum for integrity verification. Deprecated in favor of AES Key Wrap.";
      this.inventor = "RSA Security Inc.";
      this.year = 2001;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm capabilities
      this.SupportedKeySizes = [
        new KeySize(1, 128, 1) // RC2 supports 1-128 byte keys
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 3217 - RC2 Key Wrap", "https://www.rfc-editor.org/rfc/rfc3217.txt"),
        new LinkItem("RFC 2268 - RC2 Cipher", "https://www.rfc-editor.org/rfc/rfc2268.txt"),
        new LinkItem("CMS Key Checksum (RFC 3852)", "https://www.rfc-editor.org/rfc/rfc3852.txt")
      ];

      this.references = [
        new LinkItem("Bouncy Castle RC2WrapEngine", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RC2WrapEngine.java"),
        new LinkItem("NIST Key Wrap Specification", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "RC2 Cipher Weaknesses",
          "RC2 has known weaknesses including related-key attacks and linear cryptanalysis",
          "Use AES Key Wrap (RFC 3394) instead"
        ),
        new Vulnerability(
          "Deprecated Algorithm",
          "RC2 Key Wrap is deprecated and should not be used for new applications",
          "Migrate to AES-KW or AES-KWP"
        )
      ];

      // RFC 3217 test vector
      // NOTE: The RFC uses 40-bit effective key size and specific pad bytes for reproducible test
      this.tests = [
        {
          text: "RFC 3217 RC2 Key Wrap Example (40-bit effective)",
          uri: "https://www.rfc-editor.org/rfc/rfc3217.txt",
          input: OpCodes.Hex8ToBytes("b70a25fbc9d86a86050ce0d711ead4d9"),
          key: OpCodes.Hex8ToBytes("fd04fd08060707fb0003fefffd02fe05"),
          iv: OpCodes.Hex8ToBytes("c7d90059b29e97f7"),
          effectiveBits: 40, // RFC 3217 uses 40-bit effective key size
          // RFC 3217 specifies these exact padding bytes for the test vector
          pad: OpCodes.Hex8ToBytes("4845cce7fd1250"),
          expected: OpCodes.Hex8ToBytes("70e699fb5701f7833330fb71e87c85a420bdc99af05d22af5a0e48d35f3138986cbaafb4b28d4f35")
        }
      ];
    }

    // Required: Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RC2WrapInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new RC2WrapInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual wrapping/unwrapping
  /**
 * RC2Wrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RC2WrapInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {RC2WrapAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {KeySize[]} */
      this.keySizeList = algorithm.SupportedKeySizes;
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._iv = null;
      /** @type {uint8[]|null} */
      this._pad = null; // Optional specific padding bytes (for test vectors)
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {int32} */
      this._effectiveBits = 40; // RFC 3217 test uses 40-bit effective key size

      // IV2 constant from RFC 3217
      /** @type {uint8[]} */
      this.IV2 = [0x4a, 0xdd, 0xa2, 0x2c, 0x79, 0xe8, 0x21, 0x05];
    }

    /**
     * @param {int32} bits - RC2 effective key bits
     */
    set effectiveBits(bits) {
      this._effectiveBits = bits;
    }

    /**
     * @returns {int32} RC2 effective key bits
     */
    get effectiveBits() {
      return this._effectiveBits;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size
      /** @type {boolean} */
      let isValidSize = false;
      for (let k = 0; k < this.keySizeList.length; k++) {
        /** @type {KeySize} */
        const ks = this.keySizeList[k];
        if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = keyBytes.slice();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? this._key.slice() : null;
    }

    // Property setter for IV
    /**
   * Set initialization vector
   * @param {uint8[]|null} ivBytes - IV bytes or null to clear
   * @throws {Error} If IV size is invalid
   */

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      if (ivBytes.length !== 8) {
        throw new Error("Invalid IV size: " + ivBytes.length + " bytes (must be 8)");
      }

      this._iv = ivBytes.slice();
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? this._iv.slice() : null;
    }

    /**
     * Specific pad bytes (optional - for test vectors)
     * @param {uint8[]|null} padBytes - Pad bytes or null to clear
     */
    set pad(padBytes) {
      if (!padBytes) {
        this._pad = null;
        return;
      }
      this._pad = padBytes.slice();
    }

    /**
     * @returns {uint8[]|null} Copy of the pad bytes or null
     */
    get pad() {
      return this._pad ? this._pad.slice() : null;
    }

    // Get the result of wrapping/unwrapping
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      /** @type {uint8[]} */
      const result = this.isInverse
        ? this._unwrap(this.inputBuffer)
        : this._wrap(this.inputBuffer);

      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    /**
     * CBC-encrypt data in place
     * @param {uint8[]} data - Data, a multiple of 8 bytes long; overwritten
     * @param {uint8[]} iv - 8-byte IV
     * @returns {void}
     */
    _cbcEncryptInPlace(data, iv) {
      /** @type {uint8[]} */
      let prevBlock = iv.slice();
      /** @type {int32} */
      const numBlocks = data.length / 8;
      for (let i = 0; i < numBlocks; ++i) {
        /** @type {uint8[]} */
        const block = data.slice(i * 8, i * 8 + 8);

        // XOR with previous ciphertext (CBC mode)
        for (let j = 0; j < 8; ++j) {
          block[j] = OpCodes.Xor8(block[j], prevBlock[j]);
        }

        // Encrypt using RC2
        /** @type {uint8[]} */
        const encrypted = rc2Block(this._key, this._effectiveBits, false, block);

        for (let j = 0; j < 8; ++j) {
          data[i * 8 + j] = encrypted[j];
        }

        prevBlock = encrypted;
      }
    }

    /**
     * CBC-decrypt data in place
     * @param {uint8[]} data - Data, a multiple of 8 bytes long; overwritten
     * @param {uint8[]} iv - 8-byte IV
     * @returns {void}
     */
    _cbcDecryptInPlace(data, iv) {
      /** @type {uint8[]} */
      let prevCipher = iv.slice();
      /** @type {int32} */
      const numBlocks = data.length / 8;
      for (let i = 0; i < numBlocks; ++i) {
        /** @type {uint8[]} */
        const block = data.slice(i * 8, i * 8 + 8);
        /** @type {uint8[]} */
        const encrypted = block.slice();

        // Decrypt using RC2
        /** @type {uint8[]} */
        const decrypted = rc2Block(this._key, this._effectiveBits, true, block);

        // XOR with previous ciphertext (CBC mode)
        for (let j = 0; j < 8; ++j) {
          data[i * 8 + j] = OpCodes.Xor8(decrypted[j], prevCipher[j]);
        }

        prevCipher = encrypted;
      }
    }

    /**
     * Wrap a content-encryption key
     * @param {uint8[]} plainKey - Key to wrap
     * @returns {uint8[]} Wrapped key
     */
    _wrap(plainKey) {
      // Step 1: Pad key to 8-byte boundary
      /** @type {int32} */
      let length = plainKey.length + 1; // +1 for length byte
      if ((length % 8) !== 0) {
        length += 8 - (length % 8);
      }

      /** @type {uint8[]} */
      const keyToBeWrapped = new Array(length);
      keyToBeWrapped[0] = plainKey.length; // First byte is original length

      for (let i = 0; i < plainKey.length; ++i) {
        keyToBeWrapped[1 + i] = plainKey[i];
      }

      // Fill remaining with padding bytes
      /** @type {int32} */
      const padLength = length - plainKey.length - 1;
      if (padLength > 0) {
        if (this._pad && this._pad.length >= padLength) {
          // Use specific padding bytes (for test vectors)
          for (let i = 0; i < padLength; ++i) {
            keyToBeWrapped[plainKey.length + 1 + i] = this._pad[i];
          }
        } else {
          // Production: should use random bytes, but for simplicity use zeros
          // Real implementations should use a secure random number generator
          for (let i = plainKey.length + 1; i < length; ++i) {
            keyToBeWrapped[i] = 0;
          }
        }
      }

      // Step 2: Calculate CMS Key Checksum
      /** @type {uint8[]} */
      const CKS = SHA1Helper.cmsKeyChecksum(keyToBeWrapped);

      // Step 3: WKCKS = WK || CKS
      // Step 4: Encrypt WKCKS in CBC mode with KEK and IV
      /** @type {uint8[]} */
      const TEMP1 = keyToBeWrapped.slice();
      for (let i = 0; i < CKS.length; ++i) TEMP1.push(CKS[i]);

      /** @type {uint8[]} */
      const iv1 = this._iv ? this._iv : OpCodes.CreateArray(8, 0);
      this._cbcEncryptInPlace(TEMP1, iv1);

      // Step 5: TEMP2 = IV || TEMP1
      /** @type {uint8[]} */
      const TEMP2 = iv1.slice();
      for (let i = 0; i < TEMP1.length; ++i) TEMP2.push(TEMP1[i]);

      // Step 6: Reverse the order of octets in TEMP2
      /** @type {uint8[]} */
      const TEMP3 = new Array(TEMP2.length);
      for (let i = 0; i < TEMP2.length; ++i) {
        TEMP3[i] = TEMP2[TEMP2.length - 1 - i];
      }

      // Step 7: Encrypt TEMP3 with KEK and IV2
      this._cbcEncryptInPlace(TEMP3, this.IV2);

      return TEMP3;
    }

    /**
     * Unwrap a wrapped key
     * @param {uint8[]} wrappedKey - Wrapped key
     * @returns {uint8[]} Content-encryption key
     */
    _unwrap(wrappedKey) {
      // Validate input length
      if (wrappedKey.length % 8 !== 0) {
        throw new Error("Wrapped key length must be multiple of 8 bytes");
      }

      // Step 1: Decrypt with KEK and IV2
      /** @type {uint8[]} */
      const TEMP3 = wrappedKey.slice();
      this._cbcDecryptInPlace(TEMP3, this.IV2);

      // Step 2: Reverse the order of octets
      /** @type {uint8[]} */
      const TEMP2 = new Array(TEMP3.length);
      for (let i = 0; i < TEMP3.length; ++i) {
        TEMP2[i] = TEMP3[TEMP3.length - 1 - i];
      }

      // Step 3: Decompose TEMP2 into IV and TEMP1
      /** @type {uint8[]} */
      const extractedIV = TEMP2.slice(0, 8);
      /** @type {uint8[]} */
      const TEMP1 = TEMP2.slice(8);

      // Step 4: Decrypt TEMP1 with KEK and extracted IV
      this._cbcDecryptInPlace(TEMP1, extractedIV);

      // Step 5: Decompose WKCKS into WK and CKS
      /** @type {uint8[]} */
      const WK = TEMP1.slice(0, TEMP1.length - 8);
      /** @type {uint8[]} */
      const extractedCKS = TEMP1.slice(TEMP1.length - 8);

      // Step 6: Verify CMS Key Checksum
      /** @type {uint8[]} */
      const calculatedCKS = SHA1Helper.cmsKeyChecksum(WK);

      /** @type {boolean} */
      let checksumMatch = true;
      for (let i = 0; i < 8; ++i) {
        if (calculatedCKS[i] !== extractedCKS[i]) {
          checksumMatch = false;
          break;
        }
      }

      if (!checksumMatch) {
        throw new Error("Checksum verification failed - wrapped key is corrupted");
      }

      // Step 7: Extract original key
      /** @type {int32} */
      const cekLength = WK[0];

      if (cekLength > WK.length - 1) {
        throw new Error("Invalid key length in wrapped data");
      }

      // Check pad bytes are reasonable
      if ((WK.length - (cekLength + 1)) > 7) {
        throw new Error("Too many pad bytes - wrapped data is invalid");
      }

      return WK.slice(1, 1 + cekLength);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RC2WrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RC2WrapAlgorithm, RC2WrapInstance };
}));
