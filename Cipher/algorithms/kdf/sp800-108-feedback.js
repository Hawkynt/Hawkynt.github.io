/*
 * NIST SP 800-108 KDF in Feedback Mode Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements Key-Based Key Derivation Function (KBKDF) in Feedback Mode
 * as defined in NIST Special Publication 800-108
 * Reference: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf
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
          KdfAlgorithm, IKdfInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class SP800108FeedbackAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-108-Feedback";
      this.description = "NIST SP 800-108 Key Derivation Function in Feedback Mode. Uses HMAC with feedback-based PRF expansion where each iteration feeds the previous output back as input, following the NIST standardized specification.";
      this.inventor = "NIST";
      this.year = 2009;
      this.category = CategoryType.KDF;
      this.subCategory = "NIST SP 800-108 Feedback Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific configuration
      this.SupportedKeyDerivationSizes = [
        new KeySize(1, 65535, 1)  // Variable output size (1 byte to 64KB)
      ];
      this.NeedsKey = true;  // Requires input key material (KI)

      // Documentation links
      this.documentation = [
        new LinkItem(
          "NIST SP 800-108 Revision 1 - Recommendation for Key Derivation Using Pseudorandom Functions",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf"
        ),
        new LinkItem(
          "RFC 6803 - KBKDF with HMAC",
          "https://tools.ietf.org/rfc/rfc6803.txt"
        ),
        new LinkItem(
          "OpenSSL EVP_KDF-KB Documentation",
          "https://www.openssl.org/docs/manmaster/man7/EVP_KDF-KB.html"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "Botan SP800_108_Feedback Implementation",
          "https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp"
        ),
        new LinkItem(
          "BouncyCastle KBKDF Feedback",
          "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/generators/KDFCounterBytesGenerator.java"
        ),
        new LinkItem(
          "rust-kbkdf Implementation",
          "https://github.com/RustCrypto/KDFs"
        )
      ];

      // Official test vectors from Botan (BouncyCastle reference + rust-kbkdf interop)
      this.tests = [
        {
          text: "SP 800-108 Feedback Mode - HMAC-SHA1 Test Vector 1 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec",
          input: OpCodes.Hex8ToBytes("E6EA4E4F7178A81230A01DA05705B9C8B902121B"),
          label: OpCodes.Hex8ToBytes("37935CBAE5F5B003398F8E3F"),
          context: OpCodes.Hex8ToBytes("0976FDEC7817D94D60C4E0C9091D82E38BCFC58D7FFF0829A13D1B4455B8"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("1092")
        },
        {
          text: "SP 800-108 Feedback Mode - HMAC-SHA1 Test Vector 2 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec",
          input: OpCodes.Hex8ToBytes("5B5E2C32E98F06AA4868EEC0EC18D53904DC0C05"),
          label: OpCodes.Hex8ToBytes("6EE961F615859CA0AAE6ACE0"),
          context: OpCodes.Hex8ToBytes("614E4B95FAA64CBE30CE47D9C426536A54F62E51D5909F8216204075516F"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("419A")
        },
        {
          text: "SP 800-108 Feedback Mode - HMAC-SHA1 Test Vector 3 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec",
          input: OpCodes.Hex8ToBytes("6611CF92C30689B302B190A7B720359A6F79AF93"),
          label: OpCodes.Hex8ToBytes("C1E9241EE2203B12CE1147BE"),
          context: OpCodes.Hex8ToBytes("46402D8C205C356E9A09755ADC2BF243B55B14424B64DB419E0CEB22C211"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("5E6F")
        },
        {
          text: "SP 800-108 Feedback Mode - HMAC-SHA1, 20 bytes (exactly one PRF block)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec",
          input: OpCodes.Hex8ToBytes("3B674A2DB34DDFFBA29091A0AD3077C9DD4CC245"),
          label: OpCodes.Hex8ToBytes("FA9877411DF9BBA2B96706EA"),
          context: OpCodes.Hex8ToBytes("314F85D1E8BFA91F2419B25CCA0EAEB58A6E77244B20FEDCF458B6656CD0E67DA2E417151DCFAAD5946EFC97924C89C9BE7FEA6AC66E7AF8D165DF9C252BFA0F0D00F8850CA49177A0CCBEAC1F0818ED8D1D7AEA7455C608B22771A18F1A7A9974FD4B1BCC7641C404CE650A737DDC759232B662E2AF403A"),
          outputLength: 20,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("4371D87E4A58F982AFDFB70DC632ED620D76F14D")
        },
        {
          text: "SP 800-108 Feedback Mode - HMAC-SHA256, 36 bytes (one group past the first block)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec",
          input: OpCodes.Hex8ToBytes("abbef1c4c15ba0660f118f4e3078193d104d286f7aab95b88d71cc00ccd4f38a"),
          label: OpCodes.Hex8ToBytes("07d8f46f432b585c9c35aad27d3b34bf"),
          context: OpCodes.Hex8ToBytes("acdea99ad3d17295e1dc11935595aadb2c95d06fcf9ea5cb89e9f5d42b1ee04260a4b706555e5524a900f5162da44f51"),
          outputLength: 36,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("773ad91cc0e639a067cb586f246157f9992874cb933f62c8b7383a5aa7198dc1e11c5ab7")
        },
        {
          text: "SP 800-108 Feedback Mode - HMAC-SHA256, 48 bytes (two PRF blocks)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec",
          input: OpCodes.Hex8ToBytes("ba9a647c679326716cf4b98700199fc4f8592e9fc68f794d80da1e974c89d52d"),
          label: OpCodes.Hex8ToBytes("6b5b22df64669ecd796545637ba48f55"),
          context: OpCodes.Hex8ToBytes("61312d1cf43b42197348acb6fb89f72070be9b7e633545eb5f563dea9a45405c573229fcd8450a50f3671228e3e7ae39213a7c8982643b6992661aa0e950fefe"),
          outputLength: 48,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("bf6ec210daddb2b977e22fa5e15497fadcd692428ec54561ce502966a8e89a86e812c8421b1ff843a06a46b7ab43d112")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null;  // KDF cannot be reversed
      }
      return new SP800108FeedbackInstance(this);
    }
  }

  // Instance class - handles the actual KDF computation
  /**
 * SP800108Feedback cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SP800108FeedbackInstance extends IKdfInstance {
    constructor(algorithm) {
      super(algorithm);
      this._keyInput = null;
      this._label = null;
      this._context = null;
      this._counterBits = 32;  // Default counter bits (8, 16, 24, or 32)
      this._outputLengthBits = 32;  // Default output length field bits (8, 16, 24, or 32)
      this._outputLength = 32;  // Default output length
      this._hashAlgorithm = 'SHA-256';  // Default hash function for HMAC
    }

    // Property setter for input key material (KI) - matches test vector 'input' field
    set input(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key input must be a byte array");
      }
      this._keyInput = [...keyBytes];
    }

    get input() {
      return this._keyInput ? [...this._keyInput] : null;
    }

    // Alias for compatibility
    set keyInput(keyBytes) {
      this.input = keyBytes;
    }

    get keyInput() {
      return this.input;
    }

    // Property setter for label (optional fixed input data)
    set label(labelBytes) {
      this._label = labelBytes && Array.isArray(labelBytes) ? [...labelBytes] : [];
    }

    get label() {
      return this._label ? [...this._label] : [];
    }

    // Property setter for context (optional fixed input data)
    // In Feedback mode: First 32 bytes (if available) are used as IV, rest as context
    set context(contextBytes) {
      this._context = contextBytes && Array.isArray(contextBytes) ? [...contextBytes] : [];
    }

    get context() {
      return this._context ? [...this._context] : [];
    }

    // Counter bits (8, 16, 24, or 32)
    set counterBits(bits) {
      if (![8, 16, 24, 32].includes(bits)) {
        throw new Error("Counter bits must be one of: 8, 16, 24, 32");
      }
      this._counterBits = bits;
    }

    get counterBits() {
      return this._counterBits;
    }

    // Output length field bits (8, 16, 24, or 32)
    set outputLengthBits(bits) {
      if (![8, 16, 24, 32].includes(bits)) {
        throw new Error("Output length bits must be one of: 8, 16, 24, 32");
      }
      this._outputLengthBits = bits;
    }

    get outputLengthBits() {
      return this._outputLengthBits;
    }

    // Output length in bytes
    set outputLength(bytes) {
      if (!Number.isInteger(bytes) || bytes < 1 || bytes > 65535) {
        throw new Error("Output length must be between 1 and 65535 bytes");
      }
      this._outputLength = bytes;
    }

    get outputLength() {
      return this._outputLength;
    }

    // Hash algorithm used for HMAC (SHA-256, SHA-512, etc.)
    set hashAlgorithm(algo) {
      if (!algo || typeof algo !== 'string') {
        throw new Error("Hash algorithm must be a valid string");
      }
      this._hashAlgorithm = algo.toUpperCase();
    }

    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    // Main derivation method
    // For KDFs, Feed() is used to provide the input key material
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (data && Array.isArray(data)) {
        // Feed is a streaming interface: successive calls extend the input rather
        // than replace it, so Feed(a); Feed(b) derives from the same octet string
        // as Feed(a || b).
        if (!this._keyInput) this._keyInput = [];
        for (let i = 0; i < data.length; i++) this._keyInput.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._keyInput || this._keyInput.length === 0) {
        throw new Error("Key input not set");
      }

      if (this._outputLength < 1) {
        throw new Error("Output length must be at least 1 byte");
      }

      // Get HMAC function for the specified hash algorithm
      const hmacFunc = this._getHMACFunction();

      const output = [];
      const counterBytes = this._counterBits / 8;
      const outputBits = this._outputLength * 8;
      const outputLengthFieldBytes = this._outputLengthBits / 8;

      // Calculate number of HMAC iterations needed
      const hmacOutputBytes = this._getHMACOutputSize();
      const blocksNeeded = Math.ceil(this._outputLength / hmacOutputBytes);

      // SP 800-108 Feedback Mode KDF
      // Extract IV from context (first prf_len bytes if available) or use empty IV
      // IV length = HMAC output size (20 for SHA-1, 32 for SHA-256, 64 for SHA-512)
      let kPrev;
      let ctx;

      if (this._context && this._context.length >= hmacOutputBytes) {
        kPrev = this._context.slice(0, hmacOutputBytes);
        ctx = this._context.slice(hmacOutputBytes);
      } else {
        kPrev = [];
        ctx = this._context || [];
      }

      // Each block: K_i = HMAC(K_I, K_{i-1} || [i]_r || Label || 0x00 || Context || [L]_L_r)
      for (let i = 1; i <= blocksNeeded; i++) {
        const blockInput = [];

        // Add K_{i-1} (previous output, or IV for first iteration)
        if (kPrev && kPrev.length > 0) {
          for (let _i = 0; _i < kPrev.length; _i++) blockInput.push(kPrev[_i]);
        }

        // Add counter [i]_r (r bits, encoded in big-endian)
        const counterBytes_i = this._encodeCounter(i, counterBytes);
        for (let _i = 0; _i < counterBytes_i.length; _i++) blockInput.push(counterBytes_i[_i]);

        // Add label
        if (this._label && this._label.length > 0) {
          blockInput.push(...this._label);
        }

        // Add fixed separator (0x00)
        blockInput.push(0x00);

        // Add context
        if (ctx && ctx.length > 0) {
          for (let _i = 0; _i < ctx.length; _i++) blockInput.push(ctx[_i]);
        }

        // Add output length in bits [L]_L_r (L_r bits, big-endian)
        const outputLengthBytes = this._encodeCounter(outputBits, outputLengthFieldBytes);
        for (let _i = 0; _i < outputLengthBytes.length; _i++) blockInput.push(outputLengthBytes[_i]);

        // Compute HMAC(K_I, block_input)
        const blockOutput = hmacFunc(this._keyInput, blockInput);
        kPrev = blockOutput;  // Feedback for next iteration
        for (let _i = 0; _i < blockOutput.length; _i++) output.push(blockOutput[_i]);
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
    }

    // Encode counter as big-endian bytes
    _encodeCounter(counter, numBytes) {
      const result = [];
      for (let i = numBytes - 1; i >= 0; i--) {
        result.push(OpCodes.AndN(OpCodes.Shr32(counter, i * 8), 0xFF));
      }
      return result;
    }

    // Get HMAC function for the specified hash algorithm
    _getHMACFunction() {
      // Determine hash output size and implement basic HMAC
      const hashAlgo = this._hashAlgorithm.toUpperCase();

      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') {
        return (key, message) => {
          return this._hmacSHA256(key, message);
        };
      } else if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') {
        return (key, message) => {
          return this._hmacSHA512(key, message);
        };
      } else if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') {
        return (key, message) => {
          return this._hmacSHA1(key, message);
        };
      } else {
        throw new Error(`Unsupported hash algorithm: ${this._hashAlgorithm}`);
      }
    }

    // Get HMAC output size for the selected hash
    _getHMACOutputSize() {
      const hashAlgo = this._hashAlgorithm.toUpperCase();
      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') return 32;
      if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') return 64;
      if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') return 20;
      return 32;  // Default to SHA-256 output size
    }

    // Implementation of HMAC-SHA256 using Web Crypto or fallback
    _hmacSHA256(key, message) {
      return this._hmacCompute(key, message, 'SHA-256', 32);
    }

    // Implementation of HMAC-SHA512 using Web Crypto or fallback
    _hmacSHA512(key, message) {
      return this._hmacCompute(key, message, 'SHA-512', 64);
    }

    // Implementation of HMAC-SHA1 using Web Crypto or fallback
    _hmacSHA1(key, message) {
      return this._hmacCompute(key, message, 'SHA-1', 20);
    }

    // Generic HMAC computation
    _hmacCompute(key, message, hashName, hashOutputSize) {
      // Try using Node.js crypto if available
      if (typeof require !== 'undefined') {
        try {
          const crypto = require('crypto');
          const hmac = crypto.createHmac(
            hashName.replace('-', '').toLowerCase(),
            Buffer.from(key)
          );
          hmac.update(Buffer.from(message));
          return Array.from(hmac.digest());
        } catch (e) {
          // Fall through to alternate implementation
        }
      }

      // Check if we have HMAC in OpCodes (unlikely but possible)
      if (OpCodes && OpCodes.HMAC) {
        return OpCodes.HMAC(key, message, hashName);
      }

      // Fallback: Simple HMAC-SHA256 using Web Crypto
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        return this._hmacWebCrypto(key, message, hashName);
      }

      throw new Error(
        `Cannot compute HMAC: No crypto library available (requires Node.js crypto or Web Crypto API)`
      );
    }

    // HMAC computation using Web Crypto API (async, but we'll handle synchronously if cached)
    _hmacWebCrypto(key, message, hashName) {
      // Web Crypto is async, but for KDF we need sync
      // This is a limitation we must work around or throw
      throw new Error(
        `Web Crypto API is async. For SP800-108 Feedback KDF in browser, ` +
        `use the async version or provide HMAC via OpCodes.`
      );
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP800108FeedbackAlgorithm());

  return {
    SP800108FeedbackAlgorithm,
    SP800108FeedbackInstance
  };
}));
