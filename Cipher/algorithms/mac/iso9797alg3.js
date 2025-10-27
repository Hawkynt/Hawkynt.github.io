/*
 * ISO9797 Algorithm 3 MAC (Retail MAC / ANSI X9.19) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ISO9797-1 Algorithm 3, also known as Retail MAC or ANSI X9.19, is a standardized
 * MAC construction using block ciphers. It uses a special encrypt-decrypt-encrypt
 * pattern on the final block for enhanced security.
 *
 * Algorithm Structure:
 * - Process intermediate blocks using CBC mode with K1
 * - Process final block using E-D-E pattern: E_K1(D_K2(E_K1(final)))
 * - Two-key or three-key construction supported
 * - Commonly used in banking and payment systems
 *
 * Reference Implementation:
 * BouncyCastle ISO9797Alg3Mac.java
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Load DES dependency (required for E-D-E pattern)
  // In browser/production: DES should already be loaded
  // In Node.js/testing: Load DES from relative path
  if (typeof module !== 'undefined' && typeof require !== 'undefined') {
    try {
      const path = require('path');
      const desPath = path.resolve(__dirname, '..', 'block', 'des.js');

      // Clear require cache for DES to ensure it re-registers with AlgorithmFramework
      // This is necessary when the test framework clears the algorithm registry
      try {
        delete require.cache[require.resolve(desPath)];
      } catch (e) {
        // Ignore if path doesn't resolve
      }

      require(desPath);
    } catch (e) {
      // Silently fail - DES might already be loaded or path might be different
      // Error will be thrown later if DES is actually missing
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ISO9797Alg3Algorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ISO9797 Algorithm 3";
      this.description = "Retail MAC (ANSI X9.19) using block cipher with encrypt-decrypt-encrypt pattern on final block. Two or three key construction commonly used with DES in banking systems.";
      this.inventor = "ISO/IEC JTC 1/SC 27";
      this.year = 1999;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INT;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(4, 16, 1)  // 4 to 16 bytes (32 to 128 bits)
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("ISO/IEC 9797-1:1999 Specification", "https://www.iso.org/standard/50375.html"),
        new LinkItem("ANSI X9.19 Standard", "https://webstore.ansi.org/standards/ascx9/ansix9191986r1998"),
        new LinkItem("BouncyCastle Reference Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/ISO9797Alg3Mac.java")
      ];

      // Reference links
      this.references = [
        new LinkItem("ISO9797 Algorithm Comparison", "https://en.wikipedia.org/wiki/ISO/IEC_9797-1"),
        new LinkItem("Retail MAC in Payment Systems", "https://www.eftlab.com/knowledge-base/complete-list-of-data-elements/")
      ];

      // Test vectors from BouncyCastle test suite
      this.tests = [
        // Test Case 1: Standard test vector from BouncyCastle (16-byte input, zero padding)
        {
          text: "BouncyCastle ISO9797Alg3MacTest Vector #1",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/ISO9797Alg3MacTest.java",
          input: OpCodes.AnsiToBytes("Hello World !!!!"),
          key: OpCodes.Hex8ToBytes("7CA110454A1A6E570131D9619DC1376E"),
          expected: OpCodes.Hex8ToBytes("F09B856213BAB83B")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // MAC cannot be reversed
      }
      return new ISO9797Alg3Instance(this);
    }
  }

  // Instance class - handles the actual ISO9797 Algorithm 3 MAC computation
  class ISO9797Alg3Instance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._key1 = null;  // First encryption key (for CBC and final encrypt)
      this._key2 = null;  // Second key (for final decrypt)
      this._key3 = null;  // Third key (for final re-encrypt, often same as key1)
      this.inputBuffer = [];
      this.macState = null;  // Current MAC state (8 bytes for DES)
      this.blockSize = 8;  // DES block size (could support AES in future)
      this._macSize = 8;   // Default to full block
      this._usePadding = false; // ISO7816d4 padding flag

      // Cache DES algorithm reference at instance creation time
      const globalObj = (function() {
        if (typeof globalThis !== 'undefined') return globalThis;
        if (typeof window !== 'undefined') return window;
        if (typeof global !== 'undefined') return global;
        if (typeof self !== 'undefined') return self;
        return null;
      })();

      const AF = (globalObj && globalObj.AlgorithmFramework) || AlgorithmFramework;
      this._desAlgorithm = (AF && AF.Find) ? AF.Find('DES') : null;
      this._algorithmFramework = AF;  // Store for lazy loading

      // Note: We don't throw error here - will check lazily when _getDESAlgorithm() is called
      // This allows the test framework to create instances before all dependencies are loaded
    }

    // Lazy-load DES algorithm reference
    _getDESAlgorithm() {
      if (!this._desAlgorithm && this._algorithmFramework && this._algorithmFramework.Find) {
        this._desAlgorithm = this._algorithmFramework.Find('DES');
      }

      if (!this._desAlgorithm) {
        throw new Error('ISO9797 Algorithm 3 requires DES to be loaded. Please load the DES algorithm before using ISO9797.');
      }

      return this._desAlgorithm;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._key1 = null;
        this._key2 = null;
        this._key3 = null;
        this.macState = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      // Support 16-byte (double-length DES) and 24-byte (triple-length DES) keys
      if (keyBytes.length === 16) {
        // Double-length DES key: K1 and K2 are different, K3 = K1
        this._key1 = keyBytes.slice(0, 8);
        this._key2 = keyBytes.slice(8, 16);
        this._key3 = this._key1.slice();  // K3 = K1 for double-length
      } else if (keyBytes.length === 24) {
        // Triple-length DES key: K1, K2, and K3 are all different
        this._key1 = keyBytes.slice(0, 8);
        this._key2 = keyBytes.slice(8, 16);
        this._key3 = keyBytes.slice(16, 24);
      } else {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Must be 16 or 24 bytes.`);
      }

      this._key = [...keyBytes];
      this.macState = new Array(this.blockSize).fill(0);  // Initialize to zeros
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for MAC output size
    set macSize(size) {
      if (size < 4 || size > 16) {
        throw new Error(`Invalid MAC size: ${size} bytes. Must be 4-16 bytes.`);
      }
      this._macSize = size;
    }

    get macSize() {
      return this._macSize;
    }

    // Property setter for padding mode
    set usePadding(value) {
      this._usePadding = Boolean(value);
    }

    get usePadding() {
      return this._usePadding;
    }

    // Feed data to the MAC
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this.inputBuffer.push(...data);
    }

    // Get the MAC result
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Apply padding if enabled
      let paddedData = [...this.inputBuffer];

      if (this._usePadding) {
        // ISO7816d4 padding: add 0x80 byte, then 0x00 bytes to block boundary
        paddedData.push(0x80);
        while (paddedData.length % this.blockSize !== 0) {
          paddedData.push(0x00);
        }
      } else {
        // Zero padding: pad to block boundary with zeros
        while (paddedData.length % this.blockSize !== 0) {
          paddedData.push(0x00);
        }
      }

      // Process all blocks except the last using CBC mode with K1
      const numBlocks = paddedData.length / this.blockSize;
      let cbcState = new Array(this.blockSize).fill(0);  // IV = zeros

      for (let i = 0; i < numBlocks - 1; i++) {
        const block = paddedData.slice(i * this.blockSize, (i + 1) * this.blockSize);

        // XOR with previous state (CBC mode)
        const xorBlock = OpCodes.XorArrays(block, cbcState);

        // Encrypt with K1
        cbcState = this._desEncrypt(xorBlock, this._key1);
      }

      // Process final block with E-D-E pattern
      const finalBlock = paddedData.slice((numBlocks - 1) * this.blockSize);

      // XOR with previous CBC state
      const xorFinal = OpCodes.XorArrays(finalBlock, cbcState);

      // Encrypt with K1
      const encrypted1 = this._desEncrypt(xorFinal, this._key1);

      // Decrypt with K2
      const decrypted = this._desDecrypt(encrypted1, this._key2);

      // Re-encrypt with K3
      const mac = this._desEncrypt(decrypted, this._key3);

      // Clear buffers
      this.inputBuffer = [];
      this.macState = new Array(this.blockSize).fill(0);

      // Return truncated MAC if macSize < blockSize
      return mac.slice(0, this._macSize);
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

    // DES encryption using a single DES key (8 bytes)
    _desEncrypt(block, key) {
      if (block.length !== 8) {
        throw new Error(`Invalid block size: ${block.length}. DES requires 8 bytes.`);
      }
      if (key.length !== 8) {
        throw new Error(`Invalid key size: ${key.length}. DES requires 8 bytes.`);
      }

      // Get DES algorithm (lazy-loaded if needed)
      const desAlgo = this._getDESAlgorithm();
      const desInstance = desAlgo.CreateInstance(false);
      desInstance.key = key;
      desInstance.Feed(block);
      return desInstance.Result();
    }

    // DES decryption using a single DES key (8 bytes)
    _desDecrypt(block, key) {
      if (block.length !== 8) {
        throw new Error(`Invalid block size: ${block.length}. DES requires 8 bytes.`);
      }
      if (key.length !== 8) {
        throw new Error(`Invalid key size: ${key.length}. DES requires 8 bytes.`);
      }

      // Get DES algorithm (lazy-loaded if needed)
      const desAlgo = this._getDESAlgorithm();
      const desInstance = desAlgo.CreateInstance(true);  // isInverse = true for decryption
      desInstance.key = key;
      desInstance.Feed(block);
      return desInstance.Result();
    }
  }

  // Register algorithm immediately
  RegisterAlgorithm(new ISO9797Alg3Algorithm());

}));
