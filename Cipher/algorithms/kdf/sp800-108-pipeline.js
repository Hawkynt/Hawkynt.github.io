/*
 * NIST SP 800-108 KDF in Pipeline Mode Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements Key-Based Key Derivation Function (KBKDF) in Pipeline Mode
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

  class SP800108PipelineAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-108-Pipeline";
      this.description = "NIST SP 800-108 Key Derivation Function in Pipeline Mode. Uses HMAC with pipelined PRF expansion where each iteration computes an intermediate value, following the NIST standardized specification.";
      this.inventor = "NIST";
      this.year = 2009;
      this.category = CategoryType.KDF;
      this.subCategory = "NIST SP 800-108 Pipeline Mode";
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
          "Botan SP800_108_Pipeline Implementation",
          "https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp"
        ),
        new LinkItem(
          "BouncyCastle KBKDF Pipeline",
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
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 1 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("63CB90F9CD34B95007277AE6FC17FB45A9248725"),
          label: OpCodes.Hex8ToBytes("FD7DBFDD60FED4CADA6DB78A"),
          context: OpCodes.Hex8ToBytes("B65A30885B0849C7099B"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("4B0D")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 2 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("954418FCD0EA5B6800D99B5502AFC98FF7E9302D"),
          label: OpCodes.Hex8ToBytes("F441EBB9D176AFC02CA826C6"),
          context: OpCodes.Hex8ToBytes("644E398DF79D9477A706"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("17F5")
        },
        {
          text: "SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 3 (2 bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec",
          input: OpCodes.Hex8ToBytes("486DEE7BF8590AD8146F4419131A8ED35FB67407"),
          label: OpCodes.Hex8ToBytes("1E1A50A04838FD3D15DE70ED"),
          context: OpCodes.Hex8ToBytes("6303AD8D6F85B06A8133"),
          outputLength: 2,
          counterBits: 32,
          outputLengthBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("096F")
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
      return new SP800108PipelineInstance(this);
    }
  }

  // Instance class - handles the actual KDF computation
  /**
 * SP800108Pipeline cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SP800108PipelineInstance extends IKdfInstance {
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
        this._keyInput = [...data];
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

      // SP 800-108 Pipeline Mode KDF
      // A(0) = HMAC(K_I, Label || 0x00 || Context || [L]_L_r)
      // A(i) = HMAC(K_I, A(i-1))
      // K_i = HMAC(K_I, A(i) || [i]_r || Label || 0x00 || Context || [L]_L_r)

      // Helper function to create constant input
      const createConstantInput = () => {
        const constantInput = [];

        // Add label
        if (this._label && this._label.length > 0) {
          constantInput.push(...this._label);
        }

        // Add fixed separator (0x00)
        constantInput.push(0x00);

        // Add context
        if (this._context && this._context.length > 0) {
          constantInput.push(...this._context);
        }

        // Add output length in bits [L]_L_r (L_r bits, big-endian)
        const outputLengthBytes = this._encodeCounter(outputBits, outputLengthFieldBytes);
        constantInput.push(...outputLengthBytes);

        return constantInput;
      };

      const constantInput = createConstantInput();

      // Compute A(0) = HMAC(K_I, Label || 0x00 || Context || [L]_L_r)
      let aPrev = hmacFunc(this._keyInput, constantInput);

      // Each block: A(i) = HMAC(K_I, A(i-1))
      //             K_i = HMAC(K_I, A(i) || [i]_r || Label || 0x00 || Context || [L]_L_r)
      for (let i = 1; i <= blocksNeeded; i++) {
        // Compute A(i) = HMAC(K_I, A(i-1)) for i > 0
        if (i > 1) {
          aPrev = hmacFunc(this._keyInput, aPrev);
        }

        // Compute K_i = HMAC(K_I, A(i) || [i]_r || Label || 0x00 || Context || [L]_L_r)
        const blockInput = [];

        // Add A(i)
        blockInput.push(...aPrev);

        // Add counter [i]_r (r bits, encoded in big-endian)
        const counterBytes_i = this._encodeCounter(i, counterBytes);
        blockInput.push(...counterBytes_i);

        // Add constant input (Label || 0x00 || Context || [L]_L_r)
        blockInput.push(...constantInput);

        // Compute HMAC(K_I, block_input)
        const blockOutput = hmacFunc(this._keyInput, blockInput);
        output.push(...blockOutput);
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
    }

    // Encode counter as big-endian bytes
    _encodeCounter(counter, numBytes) {
      const result = [];
      for (let i = numBytes - 1; i >= 0; i--) {
        result.push((counter >>> (i * 8)) & 0xFF);
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
        `Web Crypto API is async. For SP800-108 Pipeline KDF in browser, ` +
        `use the async version or provide HMAC via OpCodes.`
      );
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP800108PipelineAlgorithm());

  return {
    SP800108PipelineAlgorithm,
    SP800108PipelineInstance
  };
}));
