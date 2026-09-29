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

      this.references = [
        new LinkItem("BouncyCastle .NET VmpcMac Implementation", "https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/macs/VMPCMac.cs")
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
    /**
     * Initialize a VMPC-MAC instance
     * @param {VMPCMacAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this._iv = null;
      this.inputBuffer = [];

      // VMPC-MAC state
      /** @type {uint8[]} */
      this.P = new Array(256);  // S-box permutation (called P in VMPC spec)
      /** @type {uint8} */
      this.n = 0;               // PRGA counter n
      /** @type {uint8} */
      this.s = 0;               // PRGA counter s
      /** @type {uint8} */
      this.g = 0;               // MAC accumulator index
      /** @type {uint8} */
      this.x1 = 0;              // Mixing register 1
      /** @type {uint8} */
      this.x2 = 0;              // Mixing register 2
      /** @type {uint8} */
      this.x3 = 0;              // Mixing register 3
      /** @type {uint8} */
      this.x4 = 0;              // Mixing register 4
      /** @type {uint8[]} */
      this.T = new Array(32);   // Accumulator table (32 bytes)
      /** @type {boolean} */
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
        throw new Error('Invalid VMPC-MAC key size: ' + keyLength + ' bytes. Requires 1-768 bytes');
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
    /**
     * Set the IV (initializes the state once the key is also set)
     * @param {uint8[]} ivData - 1..768 IV bytes, or null to clear
     * @throws {Error} If the IV is not a byte array of valid size
     */
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
        throw new Error('Invalid VMPC-MAC IV size: ' + ivLength + ' bytes. Requires 1-768 bytes');
      }

      this._iv = ivData.slice();

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

    /**
     * Alias of iv
     * @param {uint8[]} nonceData - IV bytes, or null to clear
     */
    set nonce(nonceData) {
      this.iv = nonceData;
    }

    /**
     * Alias of iv
     * @returns {uint8[]} Copy of the IV, or null
     */
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
    /**
     * Feed data and return the MAC
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} 20-byte MAC
     * @throws {Error} If key or IV not set or data is not a byte array
     */
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
    /**
     * VMPC key and IV schedule, then reset the MAC registers
     * @returns {void}
     */
    _initializeVMPCMac() {
      if (!this._key || !this._iv) return;

      // Step 1: Initialize P-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.P[i] = i;
      }

      // Step 2: Key Scheduling Algorithm (KSA) - scramble P with key over 768 rounds
      this.s = 0;
      for (let m = 0; m < 768; m++) {
        const i = m&0xFF;  // m mod 256
        const keyByte = this._key[m % this._key.length];

        // s = P[(s + P[i] + key[m mod keyLen]) mod 256]
        this.s = this.P[this._sum8(this._sum8(this.s, this.P[i]), keyByte)];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Step 3: IV Scheduling - further scramble P with IV over 768 rounds
      for (let m = 0; m < 768; m++) {
        const i = m&0xFF;  // m mod 256
        const ivByte = this._iv[m % this._iv.length];

        // s = P[(s + P[i] + iv[m mod ivLen]) mod 256]
        this.s = this.P[this._sum8(this._sum8(this.s, this.P[i]), ivByte)];

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

    /**
     * Byte addition: (a + b) mod 256
     * @param {uint32} a - First addend (a byte or a small counter)
     * @param {uint32} b - Second addend
     * @returns {uint8} (a + b) mod 256
     */
    _sum8(a, b) {
      return OpCodes.ToByte(OpCodes.Add32(a, b));
    }

    /**
     * T index k places after g: (g + k) mod 32
     * @param {int32} k - Offset 0..3
     * @returns {uint8} Index into T
     */
    _slot(k) {
      return OpCodes.And8(this._sum8(this.g, k), 0x1F);
    }

    /**
     * Mix the four registers into T at g and advance g by 4
     * @returns {void}
     */
    _accumulate() {
      this.T[this._slot(0)] = OpCodes.Xor8(this.T[this._slot(0)], this.x1);
      this.T[this._slot(1)] = OpCodes.Xor8(this.T[this._slot(1)], this.x2);
      this.T[this._slot(2)] = OpCodes.Xor8(this.T[this._slot(2)], this.x3);
      this.T[this._slot(3)] = OpCodes.Xor8(this.T[this._slot(3)], this.x4);
      this.g = this._slot(4);
    }

    /**
     * Swap P[n] and P[s], then n = (n + 1) mod 256
     * @returns {void}
     */
    _swapAndStep() {
      const temp = this.P[this.n];
      this.P[this.n] = this.P[this.s];
      this.P[this.s] = temp;
      this.n = this._sum8(this.n, 1);
    }

    // Update MAC with one message byte (BouncyCastle update() method)
    /**
     * Absorb one message byte
     * @param {uint8} inputByte - Message byte
     * @returns {void}
     */
    _updateMac(inputByte) {
      // Update s: s = P[(s + P[n]) mod 256]
      this.s = this.P[this._sum8(this.s, this.P[this.n])];

      // Generate keystream byte: c = input XOR P[(P[P[s]] + 1) mod 256]
      const keystreamByte = this.P[this._sum8(this.P[this.P[this.s]], 1)];
      const c = OpCodes.Xor8(inputByte, keystreamByte);

      // Update mixing registers (dependencies: x4->x3, x3->x2, x2->x1, x1->s+c)
      this.x4 = this.P[this._sum8(this.x4, this.x3)];
      this.x3 = this.P[this._sum8(this.x3, this.x2)];
      this.x2 = this.P[this._sum8(this.x2, this.x1)];
      this.x1 = this.P[this._sum8(this._sum8(this.x1, this.s), c)];

      // Accumulate into T array (32 bytes, accessed via g mod 32)
      this._accumulate();

      // Swap P[n] and P[s], increment n
      this._swapAndStep();
    }

    // Finalize MAC and generate 20-byte output (BouncyCastle doFinal() method)
    /**
     * Post-processing and output
     * @returns {uint8[]} 20-byte MAC
     */
    _finalizeMac() {
      // Post-Processing Phase: 24 rounds of additional mixing
      for (let r = 1; r < 25; r++) {
        // Update s
        this.s = this.P[this._sum8(this.s, this.P[this.n])];

        // Update mixing registers with round number
        this.x4 = this.P[this._sum8(this._sum8(this.x4, this.x3), r)];
        this.x3 = this.P[this._sum8(this._sum8(this.x3, this.x2), r)];
        this.x2 = this.P[this._sum8(this._sum8(this.x2, this.x1), r)];
        this.x1 = this.P[this._sum8(this._sum8(this.x1, this.s), r)];

        // Accumulate into T
        this._accumulate();

        // Swap P[n] and P[s], increment n
        this._swapAndStep();
      }

      // Input T to the IV-phase of the VMPC KSA (768 rounds)
      for (let m = 0; m < 768; m++) {
        const i = m&0xFF;
        const tByte = this.T[m&0x1F];

        // s = P[(s + P[i] + T[m mod 32]) mod 256]
        this.s = this.P[this._sum8(this._sum8(this.s, this.P[i]), tByte)];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Generate 20-byte MAC from final P-box state
      /** @type {uint8[]} */
      const M = new Array(20);
      for (let i = 0; i < 20; i++) {
        // Update s
        this.s = this.P[this._sum8(this.s, this.P[i])];

        // Generate MAC byte: M[i] = P[(P[P[s]] + 1) mod 256]
        M[i] = this.P[this._sum8(this.P[this.P[this.s]], 1)];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
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
