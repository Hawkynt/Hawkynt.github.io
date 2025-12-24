/*
 * Camellia Key Wrap (RFC 3657)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Implements RFC 3657 Camellia Key Wrap Algorithm.
 * Uses the RFC 3394 key wrap algorithm with Camellia cipher.
 * Wraps cryptographic keys using Camellia for secure key transport.
 * Production-ready implementation based on Bouncy Castle reference.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../../algorithms/block/camellia'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../../algorithms/block/camellia')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.CamelliaAlgorithm);
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
          Algorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Get Camellia algorithm
  let CamelliaAlgorithm;
  if (CamelliaModule && CamelliaModule.CamelliaAlgorithm) {
    CamelliaAlgorithm = CamelliaModule.CamelliaAlgorithm;
  } else {
    // Try global registry
    CamelliaAlgorithm = AlgorithmFramework.Find("Camellia");
    if (CamelliaAlgorithm && CamelliaAlgorithm.constructor) {
      CamelliaAlgorithm = CamelliaAlgorithm.constructor;
    }
  }

  if (!CamelliaAlgorithm) {
    throw new Error('Camellia algorithm dependency is required');
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class CamelliaWrapAlgorithm extends Algorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Camellia Key Wrap";
      this.description = "RFC 3657 key wrapping algorithm using Camellia cipher. Securely wraps cryptographic keys for transport using the RFC 3394 key wrap construction with Camellia.";
      this.inventor = "RFC 3657 Authors, based on Camellia by NTT/Mitsubishi";
      this.year = 2003;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTERNATIONAL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0), // 128-bit KEK
        new KeySize(24, 24, 0), // 192-bit KEK
        new KeySize(32, 32, 0)  // 256-bit KEK
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 3657 - Camellia Key Wrap", "https://www.rfc-editor.org/rfc/rfc3657.txt"),
        new LinkItem("RFC 3394 - AES Key Wrap (base algorithm)", "https://www.rfc-editor.org/rfc/rfc3394.txt"),
        new LinkItem("NIST Key Wrap Specification", "https://csrc.nist.gov/projects/key-management/key-wrap")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CamelliaWrapEngine.java"),
        new LinkItem("RFC 3713 - Camellia Cipher", "https://tools.ietf.org/rfc/rfc3713.txt")
      ];

      // Test vectors from Bouncy Castle CamelliaTest.java
      this.tests = [
        {
          text: 'Bouncy Castle Camellia-128 Wrap Test Vector',
          uri: 'https://github.com/bcgit/bc-java/blob/master/prov/src/test/java/org/bouncycastle/jce/provider/test/CamelliaTest.java',
          input: OpCodes.Hex8ToBytes('00112233445566778899aabbccddeeff'),
          key: OpCodes.Hex8ToBytes('000102030405060708090a0b0c0d0e0f'),
          expected: OpCodes.Hex8ToBytes('635d6ac46eedebd3a7f4a06421a4cbd1746b24795ba2f708')
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CamelliaWrapInstance(this, isInverse);
    }
  }

  /**
 * CamelliaWrap cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CamelliaWrapInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // Default IV from RFC 3394
      this.DEFAULT_IV = [0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6];

      // Create Camellia cipher instance
      this.camellia = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.camellia = null;
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

      // Initialize Camellia cipher with KEK
      const camelliaAlgo = AlgorithmFramework.Find("Camellia");
      if (!camelliaAlgo) {
        throw new Error("Camellia cipher not available");
      }

      this.camellia = camelliaAlgo.CreateInstance(false); // Always encrypt for wrapping
      this.camellia.key = keyBytes;
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
        this._iv = null;
        return;
      }

      if (ivBytes.length !== 8) {
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes (must be 8)`);
      }

      this._iv = [...ivBytes];
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const result = this.isInverse ? this._unwrap() : this._wrap();
      this.inputBuffer = [];
      return result;
    }

    _wrap() {
      const input = this.inputBuffer;
      const iv = this._iv || this.DEFAULT_IV;

      // Validate input length
      if (input.length < 8) {
        throw new Error("Wrap data must be at least 8 bytes");
      }

      if (input.length % 8 !== 0) {
        throw new Error("Wrap data must be a multiple of 8 bytes");
      }

      const n = input.length / 8;

      // Initialize output block: IV || input
      const block = [...iv, ...input];

      // Special case: single 8-byte block
      if (n === 1) {
        this.camellia.Feed(block);
        return this.camellia.Result();
      }

      // RFC 3394 wrap algorithm
      const buf = new Array(16);

      for (let j = 0; j < 6; ++j) {
        for (let i = 1; i <= n; ++i) {
          // B = AES(K, A|R[i])
          for (let k = 0; k < 8; ++k) {
            buf[k] = block[k];
            buf[k + 8] = block[8 * i + k];
          }

          this.camellia.Feed(buf);
          const encrypted = this.camellia.Result();

          // A = MSB(64, B)^t where t = (n*j)+i
          const t = n * j + i;
          for (let k = 0; k < 8; ++k) {
            block[k] = encrypted[k];
          }

          // XOR the time step into A (big-endian)
          let tVal = t;
          for (let k = 1; tVal !== 0; ++k) {
            block[8 - k] = OpCodes.Xor32(block[8 - k], OpCodes.ToByte(tVal));
            tVal = OpCodes.Shr32(tVal, 8);
          }

          // R[i] = LSB(64, B)
          for (let k = 0; k < 8; ++k) {
            block[8 * i + k] = encrypted[8 + k];
          }
        }
      }

      return block;
    }

    _unwrap() {
      const input = this.inputBuffer;
      const iv = this._iv || this.DEFAULT_IV;

      // Validate input length
      if (input.length < 16) {
        throw new Error("Unwrap data too short (minimum 16 bytes)");
      }

      if (input.length % 8 !== 0) {
        throw new Error("Unwrap data must be a multiple of 8 bytes");
      }

      const n = (input.length / 8) - 1;

      // Split input into A and R[1]...R[n]
      const a = new Array(8);
      const block = new Array(input.length - 8);
      const buf = new Array(16);

      for (let i = 0; i < 8; ++i) {
        a[i] = input[i];
      }

      for (let i = 0; i < block.length; ++i) {
        block[i] = input[8 + i];
      }

      // Need decrypt instance for unwrapping
      const camelliaAlgo = AlgorithmFramework.Find("Camellia");
      const camelliaDecrypt = camelliaAlgo.CreateInstance(true); // Decrypt
      camelliaDecrypt.key = this._key;

      // Special case: single block
      if (n === 1) {
        camelliaDecrypt.Feed(input);
        const decrypted = camelliaDecrypt.Result();

        // Check IV
        for (let i = 0; i < 8; ++i) {
          if (decrypted[i] !== iv[i]) {
            throw new Error("Integrity check failed - invalid IV");
          }
        }

        return decrypted.slice(8);
      }

      // RFC 3394 unwrap algorithm (reverse order)
      for (let j = 5; j >= 0; --j) {
        for (let i = n; i >= 1; --i) {
          // B = AES-1(K, (A^t)|R[i]) where t = n*j+i
          for (let k = 0; k < 8; ++k) {
            buf[k] = a[k];
            buf[k + 8] = block[8 * (i - 1) + k];
          }

          const t = n * j + i;
          let tVal = t;
          for (let k = 1; tVal !== 0; ++k) {
            buf[8 - k] = OpCodes.Xor32(buf[8 - k], OpCodes.ToByte(tVal));
            tVal = OpCodes.Shr32(tVal, 8);
          }

          camelliaDecrypt.Feed(buf);
          const decrypted = camelliaDecrypt.Result();

          // A = MSB(64, B)
          for (let k = 0; k < 8; ++k) {
            a[k] = decrypted[k];
          }

          // R[i] = LSB(64, B)
          for (let k = 0; k < 8; ++k) {
            block[8 * (i - 1) + k] = decrypted[8 + k];
          }
        }
      }

      // Verify IV using constant-time comparison
      let diff = 0;
      for (let i = 0; i < 8; ++i) {
        diff = OpCodes.ToUint32(OpCodes.Or32(diff, OpCodes.Xor32(a[i], iv[i])));
      }

      if (diff !== 0) {
        throw new Error("Integrity check failed - invalid IV");
      }

      return block;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CamelliaWrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CamelliaWrapAlgorithm, CamelliaWrapInstance };
}));
