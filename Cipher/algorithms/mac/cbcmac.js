/*
 * CBC-MAC (CBC Block Cipher MAC) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CBC-MAC is a Message Authentication Code construction using a block cipher
 * in CBC mode. This is the standard MAC described in FIPS 113 and ISO/IEC 9797-1.
 *
 * SECURITY WARNING: CBC-MAC is secure only for fixed-length messages. For
 * variable-length messages, use CMAC instead which provides stronger security.
 *
 * Algorithm:
 *   C[0] = IV (or zeros if no IV)
 *   For each block i:
 *     C[i] = E(K, C[i-1] XOR M[i])
 *   MAC = C[n] (optionally truncated)
 */

// Load AlgorithmFramework (REQUIRED)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/des'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/des')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.DES);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, DESModule) {
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

  class CBCMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CBC-MAC";
      this.description = "Cipher Block Chaining Message Authentication Code using a block cipher in CBC mode. Foundation for more secure variants like CMAC.";
      this.inventor = "Various (standard construction)";
      this.year = 1976;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.INT;

      // MAC-specific configuration
      // BouncyCastle defaults to block_size / 2 bits if not specified
      this.SupportedMacSizes = [
        new KeySize(4, 16, 1)  // 4 to 16 bytes (32 to 128 bits)
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("FIPS 113 - Computer Data Authentication", "https://csrc.nist.gov/publications/detail/fips/113/archive/1985-05-30"),
        new LinkItem("ISO/IEC 9797-1:1999 - MAC Algorithm 1", "https://www.iso.org/standard/50375.html"),
        new LinkItem("NIST SP 800-38B - CMAC (successor)", "https://csrc.nist.gov/publications/detail/sp/800-38b/final")
      ];

      this.references = [
        new LinkItem("BouncyCastle CBCBlockCipherMac", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/CBCBlockCipherMac.java"),
        new LinkItem("Handbook of Applied Cryptography - Section 9.5", "http://cacr.uwaterloo.ca/hac/about/chap9.pdf")
      ];

      // Vulnerabilities
      this.vulnerabilities = [
        new Vulnerability(
          "Variable Length Extension Attack",
          "CBC-MAC is insecure for variable-length messages without additional protection. An attacker can forge MACs by extending messages.",
          "https://en.wikipedia.org/wiki/CBC-MAC#Security"
        )
      ];

      // Test vectors from BouncyCastle MacTest.java
      // https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java
      this.tests = [
        // Test vector from FIPS 113 / BouncyCastle MacTest - standard DAC with zero IV
        {
          text: "FIPS 113 / BouncyCastle Test #1 - Zero IV, Non-aligned",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java",
          input: OpCodes.Hex8ToBytes("37363534333231204e6f77206973207468652074696d6520666f7220"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef"),
          macSize: 4,  // BouncyCastle defaults to block_size/2 = 4 bytes for DES
          expected: OpCodes.Hex8ToBytes("f1d30f68")
        },
        // Test vector with explicit IV from BouncyCastle MacTest
        {
          text: "BouncyCastle Test #2 - Explicit IV, Non-aligned",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java",
          input: OpCodes.Hex8ToBytes("37363534333231204e6f77206973207468652074696d6520666f7220"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef"),
          iv: OpCodes.Hex8ToBytes("1234567890abcdef"),
          macSize: 4,
          expected: OpCodes.Hex8ToBytes("58d2e77e")
        },
        // Word-aligned data test (8 bytes = 1 DES block, no padding needed)
        {
          text: "BouncyCastle Test #3 - Word Aligned (Zero Padding)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java",
          input: OpCodes.Hex8ToBytes("3736353433323120"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef"),
          macSize: 4,
          expected: OpCodes.Hex8ToBytes("21fb1936")  // First 4 bytes of full 8-byte MAC
        },
        // Full-length MAC (8 bytes for DES)
        {
          text: "BouncyCastle Test #4 - Full MAC Length",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java",
          input: OpCodes.Hex8ToBytes("37363534333231204e6f77206973207468652074696d6520666f7220"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef"),
          macSize: 8,  // Full DES block size
          expected: OpCodes.Hex8ToBytes("f1d30f6849312ca4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // MAC cannot be reversed
      }
      return new CBCMACInstance(this);
    }
  }

  // Instance class - handles the actual CBC-MAC computation
  class CBCMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._iv = null;
      this._macSize = 4; // Default: half of DES block size (32 bits)
      this._blockSize = 8; // DES block size
      this.inputBuffer = [];
      this.state = null; // Current CBC state
      this.cipherInstance = null;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.cipherInstance = null;
        return;
      }

      // Validate key size (DES uses 8-byte keys)
      if (keyBytes.length !== 8) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 8 for DES)`);
      }

      this._key = [...keyBytes];

      // Create DES cipher instance for encryption
      // DESModule exports { DESAlgorithm, DESInstance }
      if (!DESModule || !DESModule.DESAlgorithm) {
        throw new Error('DES module not loaded');
      }

      // Create DES algorithm instance and then create cipher instance
      const desAlgorithm = new DESModule.DESAlgorithm();
      this.cipherInstance = desAlgorithm.CreateInstance(false); // false = encrypt
      this.cipherInstance.key = keyBytes;
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        return;
      }

      // Validate IV size (must match block size)
      if (ivBytes.length !== this._blockSize) {
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes (expected ${this._blockSize})`);
      }

      this._iv = [...ivBytes];
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set macSize(size) {
      if (size < 4 || size > 16) {
        throw new Error(`Invalid MAC size: ${size} bytes (must be 4-16)`);
      }
      this._macSize = size;
    }

    get macSize() {
      return this._macSize;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Initialize CBC state with IV or zeros
      this.state = this._iv ? [...this._iv] : new Array(this._blockSize).fill(0);

      // Prepare padded message
      const paddedMessage = this._padMessage([...this.inputBuffer]);

      // Process each block in CBC mode
      for (let i = 0; i < paddedMessage.length; i += this._blockSize) {
        const messageBlock = paddedMessage.slice(i, i + this._blockSize);

        // XOR with previous ciphertext (CBC mode)
        const xorBlock = OpCodes.XorArrays(this.state, messageBlock);

        // Encrypt the XOR result
        this.cipherInstance.Feed(xorBlock);
        this.state = this.cipherInstance.Result();
      }

      // MAC is the final ciphertext block (truncated to macSize)
      const mac = this.state.slice(0, this._macSize);

      // Clear for next operation
      this.inputBuffer = [];
      this.state = null;

      return mac;
    }

    /**
     * Pad message with zeros to block boundary
     * CBC-MAC uses zero padding (FIPS 113 default)
     * Note: BouncyCastle can also use ISO7816 padding, but defaults to zero padding
     *
     * @param {Array<number>} message - Input message
     * @returns {Array<number>} Padded message
     */
    _padMessage(message) {
      const remainder = message.length % this._blockSize;

      if (remainder === 0) {
        // Already block-aligned, no padding needed
        return message;
      }

      // Pad with zeros to next block boundary
      const paddingLength = this._blockSize - remainder;
      const padding = new Array(paddingLength).fill(0);

      return [...message, ...padding];
    }
  }

  // Register algorithm
  RegisterAlgorithm(new CBCMACAlgorithm());

  return CBCMACAlgorithm;
}));
