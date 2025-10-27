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

  // ===== HELPER: SHA-1 IMPLEMENTATION FOR CMS KEY CHECKSUM =====

  // SHA-1 implementation for CMS Key Checksum (needed for key wrapping)
  // This is a minimal implementation focused on the key checksum use case
  class SHA1Helper {
    static hash(data) {
      // Initialize hash values (RFC 3174)
      let h0 = 0x67452301;
      let h1 = 0xEFCDAB89;
      let h2 = 0x98BADCFE;
      let h3 = 0x10325476;
      let h4 = 0xC3D2E1F0;

      // Pre-process: add padding
      const msgLen = data.length;
      const bitLen = msgLen * 8;

      // Append the '1' bit (plus zero padding)
      const padded = [...data, 0x80];

      // Append zeros until length ≡ 448 (mod 512)
      while ((padded.length % 64) !== 56) {
        padded.push(0x00);
      }

      // Append original length as 64-bit big-endian
      for (let i = 7; i >= 0; --i) {
        padded.push((bitLen >>> (i * 8)) & 0xFF);
      }

      // Process message in 512-bit (64-byte) chunks
      const w = new Array(80);

      for (let chunk = 0; chunk < padded.length; chunk += 64) {
        // Break chunk into sixteen 32-bit big-endian words
        for (let i = 0; i < 16; ++i) {
          w[i] = OpCodes.Pack32BE(
            padded[chunk + i * 4],
            padded[chunk + i * 4 + 1],
            padded[chunk + i * 4 + 2],
            padded[chunk + i * 4 + 3]
          );
        }

        // Extend the sixteen 32-bit words into eighty 32-bit words
        for (let i = 16; i < 80; ++i) {
          const temp = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
          w[i] = OpCodes.RotL32(temp, 1);
        }

        // Initialize working variables
        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;

        // Main loop
        for (let i = 0; i < 80; ++i) {
          let f, k;

          if (i < 20) {
            f = (b & c) | ((~b) & d);
            k = 0x5A827999;
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = 0x6ED9EBA1;
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8F1BBCDC;
          } else {
            f = b ^ c ^ d;
            k = 0xCA62C1D6;
          }

          const temp = OpCodes.ToDWord(OpCodes.RotL32(a, 5) + f + e + k + w[i]);
          e = d;
          d = c;
          c = OpCodes.RotL32(b, 30);
          b = a;
          a = temp;
        }

        // Add this chunk's hash to result so far
        h0 = OpCodes.ToDWord(h0 + a);
        h1 = OpCodes.ToDWord(h1 + b);
        h2 = OpCodes.ToDWord(h2 + c);
        h3 = OpCodes.ToDWord(h3 + d);
        h4 = OpCodes.ToDWord(h4 + e);
      }

      // Produce the final hash value (big-endian)
      return [
        ...OpCodes.Unpack32BE(h0),
        ...OpCodes.Unpack32BE(h1),
        ...OpCodes.Unpack32BE(h2),
        ...OpCodes.Unpack32BE(h3),
        ...OpCodes.Unpack32BE(h4)
      ];
    }

    // CMS Key Checksum: first 8 bytes of SHA-1 hash
    static cmsKeyChecksum(key) {
      const hash = SHA1Helper.hash(key);
      return hash.slice(0, 8);
    }
  }

  // ===== HELPER: RC2 CIPHER ACCESS =====

  // Helper to get RC2 algorithm instance for CBC mode encryption/decryption
  function getRC2Cipher(key, effectiveBits) {
    // Load RC2 algorithm
    let rc2module;
    if (typeof require !== 'undefined') {
      rc2module = require('../block/rc2.js');
    }

    const rc2Algo = AlgorithmFramework.Find('RC2');
    if (!rc2Algo) {
      throw new Error('RC2 algorithm not found - ensure rc2.js is loaded');
    }

    const cipher = rc2Algo.CreateInstance(false);
    cipher.key = key;

    // Set effective bits if specified
    if (effectiveBits !== undefined && effectiveBits !== null) {
      cipher.effectiveBits = effectiveBits;
    }

    return cipher;
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
      // NOTE: The RFC uses 40-bit effective key size and specific pad bytes (4845cce7fd1250)
      this.tests = [
        {
          text: "RFC 3217 RC2 Key Wrap Example (40-bit effective)",
          uri: "https://www.rfc-editor.org/rfc/rfc3217.txt",
          input: OpCodes.Hex8ToBytes("b70a25fbc9d86a86050ce0d711ead4d9"),
          key: OpCodes.Hex8ToBytes("fd04fd08060707fb0003fefffd02fe05"),
          iv: OpCodes.Hex8ToBytes("c7d90059b29e97f7"),
          effectiveBits: 40, // RFC 3217 uses 40-bit effective key size
          expected: OpCodes.Hex8ToBytes("70e699fb5701f7833330fb71e87c85a420bdc99af05d22af5a0e48d35f3138986cbaafb4b28d4f35")
        }
      ];
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new RC2WrapInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual wrapping/unwrapping
  class RC2WrapInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];
      this._effectiveBits = 40; // RFC 3217 test uses 40-bit effective key size

      // IV2 constant from RFC 3217
      this.IV2 = [0x4a, 0xdd, 0xa2, 0x2c, 0x79, 0xe8, 0x21, 0x05];
    }

    // Property setter for effective bits
    set effectiveBits(bits) {
      this._effectiveBits = bits;
    }

    get effectiveBits() {
      return this._effectiveBits;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV
    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      if (ivBytes.length !== 8) {
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes (must be 8)`);
      }

      this._iv = [...ivBytes];
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Feed data to wrap/unwrap
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    // Get the result of wrapping/unwrapping
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const result = this.isInverse
        ? this._unwrap(this.inputBuffer)
        : this._wrap(this.inputBuffer);

      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    // Private method for wrapping
    _wrap(plainKey) {
      // Step 1: Pad key to 8-byte boundary
      let length = plainKey.length + 1; // +1 for length byte
      if ((length % 8) !== 0) {
        length += 8 - (length % 8);
      }

      const keyToBeWrapped = new Array(length);
      keyToBeWrapped[0] = plainKey.length; // First byte is original length

      for (let i = 0; i < plainKey.length; ++i) {
        keyToBeWrapped[1 + i] = plainKey[i];
      }

      // Fill remaining with zeros (simplified: production would use random)
      for (let i = plainKey.length + 1; i < length; ++i) {
        keyToBeWrapped[i] = 0;
      }

      // Step 2: Calculate CMS Key Checksum
      const CKS = SHA1Helper.cmsKeyChecksum(keyToBeWrapped);

      // Step 3: WKCKS = WK || CKS
      const WKCKS = [...keyToBeWrapped, ...CKS];

      // Step 4: Encrypt WKCKS in CBC mode with KEK and IV
      let TEMP1 = [...WKCKS];

      const iv1 = this._iv || [0, 0, 0, 0, 0, 0, 0, 0];
      const numBlocks = TEMP1.length / 8;

      // CBC encryption with first IV
      let prevBlock = [...iv1];
      for (let i = 0; i < numBlocks; ++i) {
        const block = TEMP1.slice(i * 8, i * 8 + 8);

        // XOR with previous ciphertext (CBC mode)
        for (let j = 0; j < 8; ++j) {
          block[j] ^= prevBlock[j];
        }

        // Encrypt using RC2
        const cipher = getRC2Cipher(this._key, this._effectiveBits);
        cipher.Feed(block);
        const encrypted = cipher.Result();

        for (let j = 0; j < 8; ++j) {
          TEMP1[i * 8 + j] = encrypted[j];
        }

        prevBlock = encrypted;
      }

      // Step 5: TEMP2 = IV || TEMP1
      const TEMP2 = [...iv1, ...TEMP1];

      // Step 6: Reverse the order of octets in TEMP2
      const TEMP3 = new Array(TEMP2.length);
      for (let i = 0; i < TEMP2.length; ++i) {
        TEMP3[i] = TEMP2[TEMP2.length - 1 - i];
      }

      // Step 7: Encrypt TEMP3 with KEK and IV2
      prevBlock = [...this.IV2];
      for (let i = 0; i < (TEMP3.length / 8); ++i) {
        const block = TEMP3.slice(i * 8, i * 8 + 8);

        // XOR with previous ciphertext (CBC mode)
        for (let j = 0; j < 8; ++j) {
          block[j] ^= prevBlock[j];
        }

        // Encrypt using RC2
        const cipher = getRC2Cipher(this._key, this._effectiveBits);
        cipher.Feed(block);
        const encrypted = cipher.Result();

        for (let j = 0; j < 8; ++j) {
          TEMP3[i * 8 + j] = encrypted[j];
        }

        prevBlock = encrypted;
      }

      return TEMP3;
    }

    // Private method for unwrapping
    _unwrap(wrappedKey) {
      // Validate input length
      if (wrappedKey.length % 8 !== 0) {
        throw new Error("Wrapped key length must be multiple of 8 bytes");
      }

      // Step 1: Decrypt with KEK and IV2
      let TEMP3 = [...wrappedKey];

      let prevCipher = [...this.IV2];
      for (let i = 0; i < (TEMP3.length / 8); ++i) {
        const block = TEMP3.slice(i * 8, i * 8 + 8);
        const encrypted = [...block];

        // Decrypt using RC2
        const rc2Algo = AlgorithmFramework.Find('RC2');
        const decipher = rc2Algo.CreateInstance(true);
        decipher.key = this._key;
        decipher.effectiveBits = this._effectiveBits;
        decipher.Feed(block);
        const decrypted = decipher.Result();

        // XOR with previous ciphertext (CBC mode)
        for (let j = 0; j < 8; ++j) {
          TEMP3[i * 8 + j] = decrypted[j] ^ prevCipher[j];
        }

        prevCipher = encrypted;
      }

      // Step 2: Reverse the order of octets
      const TEMP2 = new Array(TEMP3.length);
      for (let i = 0; i < TEMP3.length; ++i) {
        TEMP2[i] = TEMP3[TEMP3.length - 1 - i];
      }

      // Step 3: Decompose TEMP2 into IV and TEMP1
      const extractedIV = TEMP2.slice(0, 8);
      let TEMP1 = TEMP2.slice(8);

      // Step 4: Decrypt TEMP1 with KEK and extracted IV
      prevCipher = [...extractedIV];
      for (let i = 0; i < (TEMP1.length / 8); ++i) {
        const block = TEMP1.slice(i * 8, i * 8 + 8);
        const encrypted = [...block];

        // Decrypt using RC2
        const rc2AlgoInner = AlgorithmFramework.Find('RC2');
        const decipherInner = rc2AlgoInner.CreateInstance(true);
        decipherInner.key = this._key;
        decipherInner.effectiveBits = this._effectiveBits;
        decipherInner.Feed(block);
        const decrypted = decipherInner.Result();

        // XOR with previous ciphertext (CBC mode)
        for (let j = 0; j < 8; ++j) {
          TEMP1[i * 8 + j] = decrypted[j] ^ prevCipher[j];
        }

        prevCipher = encrypted;
      }

      // Step 5: Decompose WKCKS into WK and CKS
      const WK = TEMP1.slice(0, TEMP1.length - 8);
      const extractedCKS = TEMP1.slice(TEMP1.length - 8);

      // Step 6: Verify CMS Key Checksum
      const calculatedCKS = SHA1Helper.cmsKeyChecksum(WK);

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
      const keyLength = WK[0];

      if (keyLength > WK.length - 1) {
        throw new Error("Invalid key length in wrapped data");
      }

      // Check pad bytes are reasonable
      if ((WK.length - (keyLength + 1)) > 7) {
        throw new Error("Too many pad bytes - wrapped data is invalid");
      }

      const CEK = WK.slice(1, 1 + keyLength);
      return CEK;
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
