/*
 * GMAC (Galois Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * GMAC is the authentication component of GCM mode, providing message
 * authentication using Galois Field arithmetic over GF(2^128).
 */

// Load AlgorithmFramework (REQUIRED)

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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class GMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "GMAC";
      this.description = "Galois Message Authentication Code as defined in NIST SP 800-38D. Authentication component of GCM mode using Galois Field arithmetic.";
      this.inventor = "NIST";
      this.year = 2007;
      this.category = CategoryType.MAC;
      this.subCategory = "GMAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(16, 16, 0)  // 128-bit MAC output
      ];
      this.NeedsKey = true;
      this.NeedsNonce = true; // GMAC requires IV/nonce

      // Documentation links
      this.documentation = [
        new LinkItem("NIST SP 800-38D - GCM Specification", "https://csrc.nist.gov/publications/detail/sp/800-38d/final"),
        new LinkItem("RFC 5288 - AES Galois Counter Mode", "https://tools.ietf.org/html/rfc5288")
      ];

      // Reference links
      this.references = [
        new LinkItem("Intel PCLMULQDQ Instruction", "https://software.intel.com/content/www/us/en/develop/articles/intel-carry-less-multiplication-instruction-and-its-usage-for-computing-the-gcm-mode.html"),
        new LinkItem("Bouncy Castle GCM/GMAC", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/modes/gcm"),
        new LinkItem("OpenSSL GMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c")
      ];

      // Test vectors from Bouncy Castle (via Botan test suite)
      this.tests = [
        // Test Case 1: Empty input (no AAD)
        {
          text: "Botan Test Vector 1 - Empty input",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/gmac.vec",
          input: [], // No AAD
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("58E2FCCEFA7E3061367F1D57A4E7455A")
        },
        // Test Case 2: 16-byte zero input
        {
          text: "Botan Test Vector 2 - 16-byte zero input",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/gmac.vec",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          nonce: OpCodes.Hex8ToBytes("000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("21C2EB20CD2214DBDF34C9B82ECB7ED2")
        },
        // All three AES key sizes over partial final blocks: the tag of
        // node's AES-GCM with an empty plaintext and the message as AAD
        {
          text: "AES-128 GMAC - 20-byte message (node AES-128-GCM, empty plaintext)",
          uri: "https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options",
          input: OpCodes.Hex8ToBytes("03101d2a3744515e6b7885929facb9c6d3e0edfa"),
          key: OpCodes.Hex8ToBytes("010e1b2835424f5c697683909daab7c4"),
          nonce: OpCodes.Hex8ToBytes("020f1c293643505d6a778491"),
          expected: OpCodes.Hex8ToBytes("BE845653884A7A35F9D79B6FD26134CF")
        },
        {
          text: "AES-192 GMAC - 33-byte message (node AES-192-GCM, empty plaintext)",
          uri: "https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options",
          input: OpCodes.Hex8ToBytes("0613202d3a4754616e7b8895a2afbcc9d6e3f0fd0a1724313e4b5865727f8c99a6"),
          key: OpCodes.Hex8ToBytes("04111e2b3845525f6c798693a0adbac7d4e1eefb0815222f"),
          nonce: OpCodes.Hex8ToBytes("05121f2c394653606d7a8794"),
          expected: OpCodes.Hex8ToBytes("4AFC622C01F284717C67BE13AA35456B")
        },
        {
          text: "AES-256 GMAC - 64-byte message (node AES-256-GCM, empty plaintext)",
          uri: "https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options",
          input: OpCodes.Hex8ToBytes("091623303d4a5764717e8b98a5b2bfccd9e6f3000d1a2734414e5b6875828f9ca9b6c3d0ddeaf704111e2b3845525f6c798693a0adbac7d4e1eefb0815222f3c"),
          key: OpCodes.Hex8ToBytes("0714212e3b4855626f7c8996a3b0bdcad7e4f1fe0b1825323f4c596673808d9a"),
          nonce: OpCodes.Hex8ToBytes("0815222f3c495663707d8a97"),
          expected: OpCodes.Hex8ToBytes("43BD7AC4315954058DFC36D6E5E2D116")
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
        return null; // GMAC cannot be reversed
      }
      return new GMACInstance(this);
    }
  }

  // Instance class - handles the actual GMAC computation
  /**
 * GMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class GMACInstance extends IMacInstance {
    /**
     * Initialize a GMAC instance
     * @param {GMACAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this._nonce = null;
      this.inputBuffer = [];

      /** @type {uint8[]} */
      this.h = OpCodes.CreateArray(16, 0); // Authentication key H = AES_K(0^128)
      /** @type {uint8[]} */
      this.ghashState = OpCodes.CreateArray(16, 0); // GHASH accumulator
      /** @type {IBlockCipherInstance} */
      this.aesInstance = null; // Registered AES, keyed by the key setter
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
        this.aesInstance = null;
        this.h.fill(0);
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
        throw new Error("GMAC requires 128, 192, or 256-bit AES key");
      }

      // The registered AES. Registry-first: Find() is checked before require()
      // loads the module (CommonJS only; an AMD or browser loader cannot
      // require synchronously, and the page loads Rijndael)
      /** @type {Algorithm} */
      let aesAlgorithm = AlgorithmFramework.Find("Rijndael (AES)");
      if (!aesAlgorithm && typeof module !== 'undefined' && typeof require !== 'undefined') {
        require('../block/rijndael.js');
        aesAlgorithm = AlgorithmFramework.Find("Rijndael (AES)");
      }
      if (!aesAlgorithm) {
        throw new Error("GMAC requires the Rijndael (AES) algorithm - load it before GMAC");
      }

      this._key = [...keyBytes];
      this.aesInstance = aesAlgorithm.CreateInstance();
      this.aesInstance.key = keyBytes;

      // Authentication key H = AES_K(0^128)
      this.aesInstance.Feed(OpCodes.CreateArray(16, 0));
      /** @type {uint8[]} */
      const encrypted = this.aesInstance.Result();
      this.h = encrypted;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for nonce/IV
    /**
     * Set the 96-bit nonce
     * @param {uint8[]} nonceBytes - 12-byte nonce, or null to clear
     * @throws {Error} If the nonce is not a 12-byte array
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (!Array.isArray(nonceBytes)) {
        throw new Error("Invalid nonce - must be byte array");
      }

      if (nonceBytes.length !== 12) {
        throw new Error("GMAC requires 96-bit (12-byte) nonce");
      }

      this._nonce = nonceBytes.slice();
    }

    /**
     * Copy of the nonce
     * @returns {uint8[]} Nonce bytes, or null when not set
     */
    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Feed data to the MAC
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the MAC result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set - GMAC requires IV");
      }

      const mac = this._computeGMAC();
      this.inputBuffer = []; // Clear buffer for next use
      this.ghashState.fill(0); // Reset GHASH state
      return mac;
    }

    // Compute MAC (IMacInstance interface)
    /**
     * Compute the MAC of a whole message without touching the Feed buffer
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} 16-byte tag
     * @throws {Error} If key or nonce not set or data is not a byte array
     */
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._nonce) {
        throw new Error("Nonce not set - GMAC requires IV");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Temporarily store current buffer and replace with new data
      const originalBuffer = this.inputBuffer;
      this.inputBuffer = data.slice();
      const result = this.Result();
      this.inputBuffer = originalBuffer; // Restore original buffer
      return result;
    }

    // GF(2^128) multiplication using bit-by-bit algorithm
    // Note: Manual bit operations required for Galois Field arithmetic
    // Cannot use OpCodes as this requires multi-byte shift with carry propagation
    /**
     * Multiplication in GF(2^128) as GCM defines it
     * @param {uint8[]} x - First factor (16 bytes)
     * @param {uint8[]} y - Second factor (16 bytes, not modified)
     * @returns {uint8[]} Product (16 bytes)
     */
    _gfMultiply(x, y) {
      const result = OpCodes.CreateArray(16, 0);
      const v = y.slice();

      for (let i = 0; i < 16; i++) {
        for (let j = 7; j >= 0; j--) {
          if (OpCodes.And32(OpCodes.Shr32(x[i], j), 1)) {
            // XOR v into result
            for (let k = 0; k < 16; k++) {
              result[k] = OpCodes.Xor8(result[k], v[k]);
            }
          }

          // Right shift v across all 16 bytes with carry propagation
          // These OpCodes.Shr32(manual, 1) operations are essential for GF(2^128) multiplication
          // and cannot be replaced - OpCodes has no multi-byte shift-with-carry function
          const carry = OpCodes.And32(v[15], 1);
          for (let k = 15; k > 0; k--) {
            // Shift current byte right, OR in high bit from previous byte
            v[k] = OpCodes.Or32(OpCodes.Shr32(v[k], 1), OpCodes.RotL8(OpCodes.And32(v[k-1], 1), 7));
          }
          v[0] = OpCodes.Shr32(v[0], 1); // Shift most significant byte

          if (carry) {
            v[0] = OpCodes.Xor8(v[0], 0xE1); // Apply reduction polynomial
          }
        }
      }

      return result;
    }

    // GHASH function - core of GMAC authentication
    /**
     * GHASH_H over data, zero-padding the last block
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} 16-byte hash
     */
    _ghash(data) {
      let y = OpCodes.CreateArray(16, 0);

      // Process data in 128-bit blocks
      for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, Math.min(i + 16, data.length));

        // Pad block if necessary
        while (block.length < 16) {
          block.push(0);
        }

        // Y_i = (Y_{i-1} ⊕ X_i) · H
        for (let j = 0; j < 16; j++) {
          y[j] = OpCodes.Xor8(y[j], block[j]);
        }

        y = this._gfMultiply(y, this.h);
      }

      return y;
    }

    // Core GMAC computation
    /**
     * GMAC tag of the buffered message
     * @returns {uint8[]} 16-byte tag
     */
    _computeGMAC() {
      // Prepare GMAC input: AAD || len(AAD)
      const gmacInput = this.inputBuffer.slice();

      // Pad AAD to block boundary
      const aadPadding = 16 - (gmacInput.length % 16);
      if (aadPadding < 16) {
        for (let i = 0; i < aadPadding; i++) {
          gmacInput.push(0);
        }
      }

      // Append length fields: len(AAD) || len(C) = len(AAD) || 0
      const aadBitLength = this.inputBuffer.length * 8;
      const plaintextBitLength = 0; // GMAC has no ciphertext

      // Add 64-bit AAD length (big-endian) using OpCodes
      gmacInput.push(0, 0, 0, 0); // High 32 bits (always 0 for practical message sizes)
      const aadLengthBytes = OpCodes.Unpack32BE(aadBitLength);
      for (let _i = 0; _i < aadLengthBytes.length; _i++) gmacInput.push(aadLengthBytes[_i]);

      // Add 64-bit plaintext length (big-endian, zero for GMAC)
      gmacInput.push(0, 0, 0, 0, 0, 0, 0, 0);

      // Compute GHASH
      const ghashResult = this._ghash(gmacInput);

      // Generate J_0 from IV: IV || 0^31 || 1
      const j0 = this._nonce.slice();
      j0.push(0, 0, 0, 1);

      // Encrypt J_0 to get tag mask
      this.aesInstance.Feed(j0);
      /** @type {uint8[]} */
      const tagMask = this.aesInstance.Result();

      // Final tag = GHASH ⊕ E_K(J_0)
      /** @type {uint8[]} */
      const tag = new Array(16);
      for (let i = 0; i < 16; i++) {
        tag[i] = OpCodes.Xor8(ghashResult[i], tagMask[i]);
      }

      return tag;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new GMACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GMACAlgorithm, GMACInstance };
}));