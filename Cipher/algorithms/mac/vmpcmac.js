/*
 * VMPC-MAC (VMPC-based Message Authentication Code)
 * Production implementation compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * VMPC-MAC is a message authentication code based on the VMPC stream cipher.
 * It processes messages through VMPC's permutation with additional mixing
 * and produces a fixed 20-byte (160-bit) authentication tag.
 *
 * Key Features:
 * - Variable key size (1-768 bytes)
 * - Requires IV for MAC generation
 * - Fixed 20-byte (160-bit) MAC output
 * - Based on VMPC permutation with enhanced state mixing
 * - Uses 32-byte accumulator table (T) and four mixing registers (x1-x4)
 *
 * Algorithm Structure:
 * 1. Initialize VMPC-KSA with key and IV (same as VMPC stream cipher)
 * 2. Process message bytes with modified PRGA including:
 *    - State update using VMPC indirection
 *    - XOR message byte with keystream
 *    - Update four mixing registers (x1, x2, x3, x4)
 *    - Accumulate into 32-byte table T
 * 3. Post-processing: 24 rounds of additional state mixing
 * 4. Re-scramble P-box with T array over 768 rounds
 * 5. Generate final 20-byte MAC from P-box state
 *
 * SECURITY STATUS: EXPERIMENTAL - Limited cryptanalytic review
 * USE FOR: Research, specialized applications requiring VMPC-based authentication
 *
 * Reference: BouncyCastle VMPCMac implementation
 * https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/VMPCMac.java
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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
          MacAlgorithm, IMacInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class VMPCMacAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "VMPC-MAC";
      this.description = "Message authentication code based on VMPC stream cipher permutation with enhanced state mixing. Uses 32-byte accumulator and four mixing registers for 20-byte MAC output.";
      this.inventor = "Bartosz Zoltak";
      this.year = 2004;
      this.category = CategoryType.MAC;
      this.subCategory = "Stream Cipher MAC";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.PL;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(20, 20, 0)  // VMPC-MAC produces fixed 20-byte MAC
      ];
      this.NeedsKey = true;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 768, 0)  // Variable key size: 1-768 bytes
      ];
      this.SupportedNonceSizes = [
        new KeySize(1, 768, 0)  // Variable IV/nonce size: 1-768 bytes (required)
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("VMPC-MAC Specification", "http://www.vmpcfunction.com/vmpc.pdf"),
        new LinkItem("BouncyCastle Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/VMPCMac.java"),
        new LinkItem("BouncyCastle Test Vectors", "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCMacTest.java")
      ];

      // Security notes
      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited Cryptanalysis",
          "VMPC-MAC has received less cryptanalytic attention compared to established MACs",
          "Use only after thorough security review for your specific use case"
        )
      ];

      // Official test vectors from BouncyCastle VMPCMacTest.java
      this.tests = [
        {
          text: "BouncyCastle Test Vector - MAC of bytes 0x00 to 0xFF",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCMacTest.java",
          // Input: bytes 0 through 255 (256 sequential bytes)
          input: Array.from({ length: 256 }, (_, i) => i),
          key: OpCodes.Hex8ToBytes("9661410AB797D8A9EB767C21172DF6C7"),
          iv: OpCodes.Hex8ToBytes("4B5C2F003E67F39557A8D26F3DA2B155"),
          // Expected MAC from BouncyCastle test: 9BDA16E2AD0E284774A3ACBC8835A8326C11FAAD
          expected: OpCodes.Hex8ToBytes("9BDA16E2AD0E284774A3ACBC8835A8326C11FAAD")
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
        return null; // MAC cannot be reversed
      }
      return new VMPCMacInstance(this);
    }
  }

  // Instance class implementing VMPC-MAC
  /**
 * VMPCMac cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class VMPCMacInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // VMPC-MAC state
      this.P = new Array(256);  // S-box permutation (called P in VMPC spec)
      this.n = 0;               // PRGA counter n
      this.s = 0;               // PRGA counter s
      this.g = 0;               // MAC accumulator index
      this.x1 = 0;              // Mixing register 1
      this.x2 = 0;              // Mixing register 2
      this.x3 = 0;              // Mixing register 3
      this.x4 = 0;              // Mixing register 4
      this.T = new Array(32);   // Accumulator table (32 bytes)
      this.initialized = false;
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
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 1 || keyLength > 768) {
        throw new Error(`Invalid VMPC-MAC key size: ${keyLength} bytes. Requires 1-768 bytes`);
      }

      this._key = [...keyBytes];

      // Initialize if we also have IV
      if (this._iv) {
        this._initializeVMPCMac();
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV/nonce (required for VMPC-MAC)
    set iv(ivData) {
      if (!ivData) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivData)) {
        throw new Error("Invalid IV - must be byte array");
      }

      const ivLength = ivData.length;
      if (ivLength < 1 || ivLength > 768) {
        throw new Error(`Invalid VMPC-MAC IV size: ${ivLength} bytes. Requires 1-768 bytes`);
      }

      this._iv = [...ivData];

      // Initialize if we also have key
      if (this._key) {
        this._initializeVMPCMac();
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
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
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
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
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (!this.initialized) {
        throw new Error("VMPC-MAC not properly initialized");
      }

      // Process all accumulated input data
      for (let i = 0; i < this.inputBuffer.length; i++) {
        this._updateMac(this.inputBuffer[i]);
      }

      // Generate final MAC
      const mac = this._finalizeMac();

      // Clear input buffer for next operation
      this.inputBuffer = [];

      // Re-initialize for potential reuse
      this._initializeVMPCMac();

      return mac;
    }

    // Compute MAC (IMacInstance interface)
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Feed and get result
      this.Feed(data);
      return this.Result();
    }

    // Initialize VMPC-MAC with key and IV
    _initializeVMPCMac() {
      if (!this._key || !this._iv) return;

      // Step 1: Initialize P-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.P[i] = i;
      }

      // Step 2: Key Scheduling Algorithm (KSA) - scramble P with key over 768 rounds
      this.s = 0;
      for (let m = 0; m < 768; m++) {
        const i = m & 0xFF;  // m mod 256
        const keyByte = this._key[m % this._key.length];

        // s = P[(s + P[i] + key[m mod keyLen]) mod 256]
        this.s = this.P[(this.s + this.P[i] + keyByte) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Step 3: IV Scheduling - further scramble P with IV over 768 rounds
      for (let m = 0; m < 768; m++) {
        const i = m & 0xFF;  // m mod 256
        const ivByte = this._iv[m % this._iv.length];

        // s = P[(s + P[i] + iv[m mod ivLen]) mod 256]
        this.s = this.P[(this.s + this.P[i] + ivByte) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Reset MAC state
      this.n = 0;
      this.g = 0;
      this.x1 = 0;
      this.x2 = 0;
      this.x3 = 0;
      this.x4 = 0;

      // Initialize accumulator table T to zeros
      for (let i = 0; i < 32; i++) {
        this.T[i] = 0;
      }

      this.initialized = true;
    }

    // Update MAC with one message byte (BouncyCastle update() method)
    _updateMac(inputByte) {
      // Update s: s = P[(s + P[n]) mod 256]
      this.s = this.P[(this.s + this.P[this.n & 0xFF]) & 0xFF];

      // Generate keystream byte: c = input XOR P[(P[P[s]] + 1) mod 256]
      const keystreamByte = this.P[(this.P[this.P[this.s & 0xFF] & 0xFF] + 1) & 0xFF];
      const c = (inputByte ^ keystreamByte) & 0xFF;

      // Update mixing registers (dependencies: x4->x3, x3->x2, x2->x1, x1->s+c)
      this.x4 = this.P[(this.x4 + this.x3) & 0xFF];
      this.x3 = this.P[(this.x3 + this.x2) & 0xFF];
      this.x2 = this.P[(this.x2 + this.x1) & 0xFF];
      this.x1 = this.P[(this.x1 + this.s + c) & 0xFF];

      // Accumulate into T array (32 bytes, accessed via g & 0x1F)
      this.T[this.g & 0x1F] = (this.T[this.g & 0x1F] ^ this.x1) & 0xFF;
      this.T[(this.g + 1) & 0x1F] = (this.T[(this.g + 1) & 0x1F] ^ this.x2) & 0xFF;
      this.T[(this.g + 2) & 0x1F] = (this.T[(this.g + 2) & 0x1F] ^ this.x3) & 0xFF;
      this.T[(this.g + 3) & 0x1F] = (this.T[(this.g + 3) & 0x1F] ^ this.x4) & 0xFF;
      this.g = (this.g + 4) & 0x1F;

      // Swap P[n] and P[s]
      const temp = this.P[this.n & 0xFF];
      this.P[this.n & 0xFF] = this.P[this.s & 0xFF];
      this.P[this.s & 0xFF] = temp;

      // Increment n
      this.n = (this.n + 1) & 0xFF;
    }

    // Finalize MAC and generate 20-byte output (BouncyCastle doFinal() method)
    _finalizeMac() {
      // Post-Processing Phase: 24 rounds of additional mixing
      for (let r = 1; r < 25; r++) {
        // Update s
        this.s = this.P[(this.s + this.P[this.n & 0xFF]) & 0xFF];

        // Update mixing registers with round number
        this.x4 = this.P[(this.x4 + this.x3 + r) & 0xFF];
        this.x3 = this.P[(this.x3 + this.x2 + r) & 0xFF];
        this.x2 = this.P[(this.x2 + this.x1 + r) & 0xFF];
        this.x1 = this.P[(this.x1 + this.s + r) & 0xFF];

        // Accumulate into T
        this.T[this.g & 0x1F] = (this.T[this.g & 0x1F] ^ this.x1) & 0xFF;
        this.T[(this.g + 1) & 0x1F] = (this.T[(this.g + 1) & 0x1F] ^ this.x2) & 0xFF;
        this.T[(this.g + 2) & 0x1F] = (this.T[(this.g + 2) & 0x1F] ^ this.x3) & 0xFF;
        this.T[(this.g + 3) & 0x1F] = (this.T[(this.g + 3) & 0x1F] ^ this.x4) & 0xFF;
        this.g = (this.g + 4) & 0x1F;

        // Swap P[n] and P[s]
        const temp = this.P[this.n & 0xFF];
        this.P[this.n & 0xFF] = this.P[this.s & 0xFF];
        this.P[this.s & 0xFF] = temp;

        // Increment n
        this.n = (this.n + 1) & 0xFF;
      }

      // Input T to the IV-phase of the VMPC KSA (768 rounds)
      for (let m = 0; m < 768; m++) {
        const i = m & 0xFF;
        const tByte = this.T[m & 0x1F];

        // s = P[(s + P[i] + T[m mod 32]) mod 256]
        this.s = this.P[(this.s + this.P[i] + tByte) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Generate 20-byte MAC from final P-box state
      const M = new Array(20);
      for (let i = 0; i < 20; i++) {
        // Update s
        this.s = this.P[(this.s + this.P[i & 0xFF]) & 0xFF];

        // Generate MAC byte: M[i] = P[(P[P[s]] + 1) mod 256]
        M[i] = this.P[(this.P[this.P[this.s & 0xFF] & 0xFF] + 1) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i & 0xFF];
        this.P[i & 0xFF] = this.P[this.s & 0xFF];
        this.P[this.s & 0xFF] = temp;
      }

      return M;
    }
  }

  // Register the algorithm
  const algorithmInstance = new VMPCMacAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { VMPCMacAlgorithm, VMPCMacInstance };
}));
