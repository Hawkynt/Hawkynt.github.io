/*
 * DSTU 7624:2014 MAC (Kalyna-MAC) Implementation
 * Ukrainian National MAC Standard
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DSTU7624Mac is the Ukrainian national MAC standard based on the Kalyna block cipher.
 * This is a block cipher MAC that requires input to be a multiple of the block size.
 *
 * Reference: BouncyCastle DSTU7624Mac.java
 * Based on DSTU 7624:2014 specification
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/kalyna'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../block/kalyna')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.Kalyna);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, KalynaModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Get Kalyna algorithm from the registry
  let KalynaAlgorithm = null;

  function getKalyna() {
    if (KalynaAlgorithm) return KalynaAlgorithm;

    // Try to get from registry
    const registry = AlgorithmFramework.GetRegistry ? AlgorithmFramework.GetRegistry() : null;
    if (registry) {
      KalynaAlgorithm = registry.find(a => a.name === "Kalyna" || a.name === "DSTU 7624");
    }

    // Try from module
    if (!KalynaAlgorithm && KalynaModule && KalynaModule.KalynaAlgorithm) {
      KalynaAlgorithm = new KalynaModule.KalynaAlgorithm();
    }

    if (!KalynaAlgorithm) {
      throw new Error('Kalyna block cipher dependency is required for DSTU7624Mac');
    }

    return KalynaAlgorithm;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DSTU7624MacAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DSTU 7624 MAC";
      this.description = "Ukrainian national MAC standard based on Kalyna block cipher. Provides cryptographic authentication. Current implementation supports 128-bit blocks with 128/256-bit keys.";
      this.inventor = "Roman Oliynykov, Ivan Gorbenko, et al.";
      this.year = 2014;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.UA;

      // MAC-specific configuration
      // Currently limited to 128-bit blocks due to Kalyna implementation
      // Full specification supports 128/256/512-bit blocks with matching key sizes
      this.SupportedMacSizes = [
        new KeySize(16, 16, 0)  // 128-bit MAC output (current limitation)
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("DSTU 7624:2014 - Ukrainian Encryption Standard", "http://dstszi.kmu.gov.ua/document/92213"),
        new LinkItem("ISO/IEC 9797-1 - MAC Algorithms", "https://www.iso.org/standard/50375.html")
      ];

      // Reference links
      this.references = [
        new LinkItem("BouncyCastle DSTU7624Mac", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/DSTU7624Mac.java"),
        new LinkItem("Kalyna Cipher Specification", "https://eprint.iacr.org/2015/650.pdf")
      ];

      // Test vectors from BouncyCastle DSTU7624Test.java
      // NOTE: Current implementation limited to 128-bit blocks due to Kalyna cipher limitations
      // Full DSTU7624 specification supports 128/256/512-bit blocks with matching key sizes
      this.tests = [
        // Test 1: 128-bit block, 128-bit key
        {
          text: "BouncyCastle Test Vector 1 - 128-bit block",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java",
          input: OpCodes.Hex8ToBytes(
            "202122232425262728292A2B2C2D2E2F" +
            "303132333435363738393A3B3C3D3E3F" +
            "404142434445464748494A4B4C4D4E4F"
          ),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          blockSize: 16,
          macSize: 16,
          expected: OpCodes.Hex8ToBytes("123B4EAB8E63ECF3E645A99C1115E241")
        }
        // Test 2 (512-bit block) omitted - requires full Kalyna implementation with 512-bit support
        // Expected: key=64 bytes, input=128 bytes, MAC=7279FA6BC8EF7525B2B35260D00A1743
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // MAC cannot be reversed
      }
      return new DSTU7624MacInstance(this);
    }
  }

  // Instance class - handles the actual MAC computation
  /**
 * DSTU7624Mac cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DSTU7624MacInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._blockSize = 16; // Default 128-bit blocks
      this._macSize = 16;   // Default 128-bit MAC output
      this.inputBuffer = [];
      this.c = null;        // Chaining state
      this.cTemp = null;    // Temporary for XOR operations
      this.kDelta = null;   // Delta value for final block
      this.kalynaInstance = null;
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
        this.kalynaInstance = null;
        this.kDelta = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      // Validate key size (16 or 32 bytes - current Kalyna limitation)
      // Full specification supports 64 bytes as well
      if (keyBytes.length !== 16 && keyBytes.length !== 32) {
        throw new Error("DSTU7624Mac requires 128-bit or 256-bit key (current implementation limitation)");
      }

      this._key = [...keyBytes];

      // Current Kalyna implementation always uses 128-bit blocks
      // (Full DSTU7624 supports matching block and key sizes)
      this._blockSize = 16;

      // Initialize Kalyna cipher instance
      const kalyna = getKalyna();
      this.kalynaInstance = kalyna.CreateInstance(false); // Encryption mode
      this.kalynaInstance.key = this._key;

      // Initialize state arrays
      this.c = new Array(this._blockSize).fill(0);
      this.cTemp = new Array(this._blockSize).fill(0);
      this.kDelta = new Array(this._blockSize).fill(0);

      // Generate kDelta by encrypting zero block
      this._generateKDelta();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for block size (must match key size for Kalyna)
    set blockSize(sizeInBytes) {
      if (!sizeInBytes) return;

      // Current Kalyna implementation only supports 16-byte blocks
      if (sizeInBytes !== 16) {
        throw new Error("DSTU7624Mac currently only supports 128-bit block size (Kalyna limitation)");
      }

      this._blockSize = sizeInBytes;

      // Re-initialize state arrays if key is already set
      if (this._key) {
        this.c = new Array(this._blockSize).fill(0);
        this.cTemp = new Array(this._blockSize).fill(0);
        this.kDelta = new Array(this._blockSize).fill(0);

        if (this.kalynaInstance) {
          this._generateKDelta();
        }
      }
    }

    get blockSize() {
      return this._blockSize;
    }

    // Property setter for MAC output size
    set macSize(sizeInBytes) {
      if (!sizeInBytes) return;

      if (sizeInBytes < 1 || sizeInBytes > this._blockSize) {
        throw new Error(`MAC size must be between 1 and ${this._blockSize} bytes`);
      }

      this._macSize = sizeInBytes;
    }

    get macSize() {
      return this._macSize;
    }

    // Generate kDelta by encrypting zero block
    _generateKDelta() {
      if (!this.kalynaInstance) {
        throw new Error("Kalyna instance not initialized");
      }

      // Reset kDelta to zeros
      this.kDelta.fill(0);

      // Encrypt zero block to get kDelta
      this.kalynaInstance.Feed(this.kDelta);
      this.kDelta = this.kalynaInstance.Result();
    }

    // XOR two byte arrays
    _xor(x, xOff, y, yOff, result) {
      for (let i = 0; i < this._blockSize; i++) {
        result[i] = (x[i + xOff] ^ y[i + yOff]) & 0xFF;
      }
    }

    // Process a single block
    _processBlock(input, inOff) {
      // XOR input block with current state
      this._xor(this.c, 0, input, inOff, this.cTemp);

      // Encrypt the XOR result
      this.kalynaInstance.Feed(this.cTemp);
      this.c = this.kalynaInstance.Result();
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
      this.inputBuffer.push(...data);
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

      if (!this.kalynaInstance) {
        throw new Error("Kalyna instance not initialized");
      }

      // DSTU7624Mac requires input to be a multiple of block size
      if (this.inputBuffer.length % this._blockSize !== 0) {
        throw new Error("Input must be a multiple of blocksize");
      }

      const mac = this._computeMAC();

      // Reset for next use
      this._reset();

      return mac;
    }

    // Compute MAC (IMacInstance interface)
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Temporarily store current buffer and replace with new data
      const originalBuffer = this.inputBuffer;
      this.inputBuffer = [...data];
      const result = this.Result();
      this.inputBuffer = originalBuffer;
      return result;
    }

    // Reset internal state
    _reset() {
      if (this.c) this.c.fill(0);
      if (this.cTemp) this.cTemp.fill(0);
      this.inputBuffer = [];

      // Regenerate kDelta
      if (this.kalynaInstance && this.kDelta) {
        this._generateKDelta();
      }
    }

    // Core MAC computation
    _computeMAC() {
      const numBlocks = Math.floor(this.inputBuffer.length / this._blockSize);

      if (numBlocks === 0) {
        // Empty message - process single zero block with kDelta
        this._xor(this.c, 0, this.kDelta, 0, this.cTemp);
        this.kalynaInstance.Feed(this.cTemp);
        const result = this.kalynaInstance.Result();
        return result.slice(0, this._macSize);
      }

      // Process all blocks except the last one
      for (let i = 0; i < numBlocks - 1; i++) {
        this._processBlock(this.inputBuffer, i * this._blockSize);
      }

      // Process last block with kDelta XOR
      const lastBlockOffset = (numBlocks - 1) * this._blockSize;

      // XOR last block with current state
      this._xor(this.c, 0, this.inputBuffer, lastBlockOffset, this.cTemp);

      // XOR with kDelta
      this._xor(this.cTemp, 0, this.kDelta, 0, this.c);

      // Encrypt final state
      this.kalynaInstance.Feed(this.c);
      const result = this.kalynaInstance.Result();

      // Truncate to requested MAC size
      return result.slice(0, this._macSize);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DSTU7624MacAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DSTU7624MacAlgorithm, DSTU7624MacInstance };
}));
