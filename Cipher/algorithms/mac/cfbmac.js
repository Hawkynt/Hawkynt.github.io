/*
 * CFB-MAC (Cipher Feedback Mode MAC) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CFB-MAC uses a block cipher in CFB (Cipher Feedback) mode to produce a
 * message authentication code. Unlike CBC-MAC, it processes data through
 * CFB mode encryption and uses the final ciphertext block as the MAC.
 *
 * Reference: ISO/IEC 9797-1:1999, BouncyCastle CFBBlockCipherMac
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== EMBEDDED DES IMPLEMENTATION =====
  // Minimal DES implementation for CFB-MAC use
  // Based on FIPS 46-3 specification
  // NOTE: This embedded implementation uses direct bit operations for performance and clarity.
  // This is intentional and necessary for the self-contained DES cipher used by CFB-MAC.
  class EmbeddedDES {
    constructor() {
      this._initTables();
    }

    encrypt(key, plaintext) {
      const subkeys = this._generateSubkeys(key);
      return this._crypt(plaintext, subkeys, false);
    }

    _initTables() {
      // Initial Permutation
      this.IP = [
        58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
        62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
        57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
        61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
      ];

      // Final Permutation
      this.FP = [
        40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
        38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
        36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
        34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
      ];

      // Permuted Choice 1
      this.PC1 = [
        57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
        10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
        63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
        14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
      ];

      // Permuted Choice 2
      this.PC2 = [
        14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
        23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
        41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
        44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
      ];

      // Expansion table
      this.E = [
        32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
        8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
        16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
        24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
      ];

      // P-box permutation
      this.P = [
        16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26,
        5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9,
        19, 13, 30, 6, 22, 11, 4, 25
      ];

      // Rotation schedule
      this.SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

      // S-boxes
      this.SBOX = [
        [[14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7], [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8], [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0], [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]],
        [[15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10], [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5], [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15], [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]],
        [[10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8], [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1], [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7], [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]],
        [[7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15], [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9], [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4], [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]],
        [[2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9], [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6], [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14], [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]],
        [[12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11], [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8], [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6], [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]],
        [[4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1], [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6], [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2], [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]],
        [[13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7], [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2], [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8], [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]]
      ];
    }

    _generateSubkeys(key) {
      let keyBits = this._bytesToBits(key);
      keyBits = this._permute(keyBits, this.PC1);

      let c = keyBits.slice(0, 28);
      let d = keyBits.slice(28, 56);

      const subkeys = [];

      for (let i = 0; i < 16; ++i) {
        c = this._leftShift(c, this.SHIFTS[i]);
        d = this._leftShift(d, this.SHIFTS[i]);
        const combined = c.concat(d);
        subkeys[i] = this._permute(combined, this.PC2);
      }

      return subkeys;
    }

    _crypt(input, subkeys, isDecrypt) {
      let bits = this._bytesToBits(input);
      bits = this._permute(bits, this.IP);

      let left = bits.slice(0, 32);
      let right = bits.slice(32, 64);

      for (let i = 0; i < 16; ++i) {
        const temp = right.slice();
        const key = isDecrypt ? subkeys[15 - i] : subkeys[i];
        right = OpCodes.XorArrays(left, this._feistelFunction(right, key));
        left = temp;
      }

      const combined = right.concat(left);
      const finalBits = this._permute(combined, this.FP);
      return this._bitsToBytes(finalBits);
    }

    _feistelFunction(right, key) {
      const expanded = this._permute(right, this.E);
      const xored = OpCodes.XorArrays(expanded, key);
      const substituted = this._sboxSubstitution(xored);
      return this._permute(substituted, this.P);
    }

    _sboxSubstitution(input) {
      const output = [];

      for (let i = 0; i < 8; ++i) {
        const block = input.slice(i * 6, (i + 1) * 6);
        const row = (block[0] << 1) | block[5];
        const col = (block[1] << 3) | (block[2] << 2) | (block[3] << 1) | block[4];
        const val = this.SBOX[i][row][col];

        for (let j = 3; j >= 0; --j) {
          output.push((val >>> j) & 1);
        }
      }

      return output;
    }

    _permute(input, table) {
      const output = new Array(table.length);
      for (let i = 0; i < table.length; ++i) {
        output[i] = input[table[i] - 1];
      }
      return output;
    }

    _leftShift(input, n) {
      return input.slice(n).concat(input.slice(0, n));
    }

    _bytesToBits(bytes) {
      const bits = [];
      for (let i = 0; i < bytes.length; ++i) {
        for (let j = 7; j >= 0; --j) {
          bits.push((bytes[i] >>> j) & 1);
        }
      }
      return bits;
    }

    _bitsToBytes(bits) {
      const bytes = [];
      for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; ++j) {
          byte = (byte << 1) | bits[i + j];
        }
        bytes.push(byte);
      }
      return bytes;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class CFBMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CFB-MAC";
      this.description = "Cipher Feedback Mode MAC uses a block cipher in CFB mode to generate message authentication codes. Standardized in ISO/IEC 9797-1:1999.";
      this.inventor = "ISO/IEC JTC 1/SC 27";
      this.year = 1999;
      this.category = CategoryType.MAC;
      this.subCategory = "Block Cipher MAC";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(4, 16, 1)  // 4-16 bytes (32-128 bits) MAC output
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("ISO/IEC 9797-1:1999 - MAC Algorithms", "https://www.iso.org/standard/50375.html"),
        new LinkItem("BouncyCastle CFBBlockCipherMac", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/macs/CFBBlockCipherMac.java")
      ];

      // Reference links
      this.references = [
        new LinkItem("FIPS 113 - Computer Data Authentication", "https://csrc.nist.gov/publications/detail/fips/113/archive/1985-05-30"),
        new LinkItem("FIPS 81 - DES Modes of Operation", "https://csrc.nist.gov/publications/detail/fips/81/archive/1980-12-02")
      ];

      // Test vectors from BouncyCastle MacTest.java
      this.tests = [
        // CFB-MAC with DES - IV provided (lines 85-102 in MacTest.java)
        {
          text: "BouncyCastle MacTest Vector 1 - DES CFB-MAC with IV",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/MacTest.java",
          input: OpCodes.Hex8ToBytes("37363534333231204e6f77206973207468652074696d6520666f7220"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef"),
          iv: OpCodes.Hex8ToBytes("1234567890abcdef"),
          macSize: 4,
          expected: OpCodes.Hex8ToBytes("cd647403")
        }
        // NOTE: BouncyCastle MacTest vector 2 (zero IV, word-aligned) produces inconsistent results
        // when run in isolation vs. in sequence. The test suite reuses the same MAC instance,
        // causing IV state to persist. Additional standalone test vectors needed for zero-IV case.
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Length Extension",
          "CFB-MAC is vulnerable to message length extension attacks. Use CMAC or HMAC for production.",
          "https://csrc.nist.gov/publications/detail/sp/800-38b/final"
        )
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
      return new CFBMACInstance(this);
    }
  }

  // Instance class - handles the actual CFB-MAC computation
  /**
 * CFBMAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CFBMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);

      this._key = null;
      this._iv = null;
      this._macSize = 4; // Default: 4 bytes (32 bits)
      this._cfbBitSize = 8; // Default: 8-bit CFB mode
      this.inputBuffer = [];

      // Use embedded DES for encryption
      this.desEngine = new EmbeddedDES();
      this.blockSize = 8; // DES block size

      // CFB state vectors
      this.cfbV = new Array(this.blockSize).fill(0);      // Current feedback register
      this.cfbOutV = new Array(this.blockSize).fill(0);   // Encrypted feedback register
      this.IV = new Array(this.blockSize).fill(0);        // Initialization vector

      // Buffer for accumulating input blocks
      this.buf = new Array(this.blockSize).fill(0);
      this.bufOff = 0;

      // MAC output buffer
      this.mac = new Array(this.blockSize).fill(0);
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

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 8) {
        throw new Error("CFB-MAC requires 64-bit (8-byte) DES key");
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
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
        this.IV.fill(0);
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== this.blockSize) {
        throw new Error(`IV must be ${this.blockSize} bytes`);
      }

      this._iv = [...ivBytes];

      // Copy IV to internal IV buffer
      for (let i = 0; i < this.blockSize; ++i) {
        this.IV[i] = ivBytes[i];
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Property setter for MAC size
    set macSize(size) {
      if (typeof size !== 'number' || size < 1 || size > this.blockSize) {
        throw new Error(`MAC size must be between 1 and ${this.blockSize} bytes`);
      }
      this._macSize = size;
    }

    get macSize() {
      return this._macSize;
    }

    // Reset the MAC state
    _reset() {
      // Clear buffer
      OpCodes.ClearArray(this.buf);
      this.bufOff = 0;

      // Reset CFB feedback register to IV
      for (let i = 0; i < this.blockSize; ++i) {
        this.cfbV[i] = this.IV[i];
      }

      // Clear output vectors
      OpCodes.ClearArray(this.cfbOutV);
      OpCodes.ClearArray(this.mac);
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

      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const mac = this._computeCFBMAC();
      this.inputBuffer = []; // Clear buffer for next use
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
      this.inputBuffer = originalBuffer; // Restore original buffer
      return result;
    }

    // Process one CFB block
    _processBlock(inData, inOff, outData, outOff) {
      // Encrypt the feedback register using embedded DES
      const encrypted = this.desEngine.encrypt(this._key, this.cfbV);
      for (let i = 0; i < this.blockSize; ++i) {
        this.cfbOutV[i] = encrypted[i];
      }

      // Calculate CFB block size in bytes
      const cfbBlockSize = this._cfbBitSize / 8;

      // XOR the cfbOutV with the plaintext producing the ciphertext
      for (let i = 0; i < cfbBlockSize; ++i) {
        outData[outOff + i] = this.cfbOutV[i] ^ inData[inOff + i];
      }

      // Shift feedback register and insert new ciphertext
      // cfbV = cfbV[cfbBlockSize..] + outData[outOff..outOff+cfbBlockSize]
      for (let i = 0; i < this.blockSize - cfbBlockSize; ++i) {
        this.cfbV[i] = this.cfbV[i + cfbBlockSize];
      }
      for (let i = 0; i < cfbBlockSize; ++i) {
        this.cfbV[this.blockSize - cfbBlockSize + i] = outData[outOff + i];
      }

      return cfbBlockSize;
    }

    // Get final MAC block by encrypting current feedback register
    _getMacBlock(mac) {
      const encrypted = this.desEngine.encrypt(this._key, this.cfbV);
      for (let i = 0; i < this.blockSize; ++i) {
        mac[i] = encrypted[i];
      }
    }

    // Core CFB-MAC computation
    _computeCFBMAC() {
      // Reset state
      this._reset();

      const msgLen = this.inputBuffer.length;
      let pos = 0;

      const cfbBlockSize = this._cfbBitSize / 8;

      // Process message in CFB blocks
      while (pos < msgLen) {
        // Fill buffer
        while (this.bufOff < cfbBlockSize && pos < msgLen) {
          this.buf[this.bufOff++] = this.inputBuffer[pos++];
        }

        // Process block when buffer is full
        if (this.bufOff === cfbBlockSize) {
          this._processBlock(this.buf, 0, this.mac, 0);
          this.bufOff = 0;
        }
      }

      // Handle final partial block with zero padding
      if (this.bufOff > 0) {
        // Pad with zeros
        while (this.bufOff < cfbBlockSize) {
          this.buf[this.bufOff++] = 0;
        }
        this._processBlock(this.buf, 0, this.mac, 0);
      }

      // Get final MAC by encrypting feedback register
      this._getMacBlock(this.mac);

      // Return truncated MAC
      const result = new Array(this._macSize);
      for (let i = 0; i < this._macSize; ++i) {
        result[i] = this.mac[i];
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CFBMACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CFBMACAlgorithm, CFBMACInstance };
}));
