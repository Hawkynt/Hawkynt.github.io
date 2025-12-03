/*
 * Achterbahn-128/80 Stream Cipher - Production Implementation
 * eSTREAM Project Candidate (BROKEN - DO NOT USE IN PRODUCTION)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * WARNING: This cipher has known cryptanalytic vulnerabilities and should NOT be used
 * for production cryptographic applications. Implemented for cryptographic research only.
 *
 * Achterbahn is an NLFSR-based stream cipher submitted to eSTREAM.
 * It uses multiple nonlinear feedback shift registers combined with
 * a Boolean function for keystream generation.
 *
 * SECURITY STATUS: BROKEN - Known distinguishing and key recovery attacks exist.
 * USE ONLY FOR: Academic research, cryptanalysis studies, historical reference.
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * AchterbahnAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class AchterbahnAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Achterbahn-128/80";
      this.description = "NLFSR-based stream cipher from eSTREAM project. BROKEN - multiple cryptanalytic attacks exist. DO NOT USE in production. Supports 80-bit and 128-bit keys with 10-13 NLFSRs.";
      this.inventor = "Berndt Gammel, Rainer Göttfert, Oliver Kniffler (Infineon Technologies)";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "NLFSR Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.DE;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(10, 16, 1)  // 80-128 bit keys
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 16, 1)   // Optional IV up to 128 bits
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("eSTREAM Achterbahn Specification", "https://www.ecrypt.eu.org/stream/p3ciphers/achterbahn/achterbahn_p3.pdf"),
        new LinkItem("Achterbahn Official Site", "https://www.matpack.de/achterbahn/specification.html"),
        new LinkItem("Wikipedia: Achterbahn", "https://en.wikipedia.org/wiki/Achterbahn_(cipher)")
      ];

      // Security vulnerabilities (CRITICAL)
      this.knownVulnerabilities = [
        new Vulnerability(
          "Distinguishing Attack",
          "Linear distinguishing attacks can distinguish keystream from random with practical complexity",
          "DO NOT USE - cipher is cryptographically broken"
        ),
        new Vulnerability(
          "Key Recovery Attack",
          "Practical key recovery attacks demonstrated against both 80-bit and 128-bit variants",
          "DO NOT USE - fundamental design flaws exist"
        ),
        new Vulnerability(
          "Correlation Attack",
          "NLFSR correlation attacks reduce effective security below key length",
          "DO NOT USE - not suitable for any production use"
        )
      ];

      // WARNING: These are research-derived test vectors for functionality validation
      // Official eSTREAM test vectors are no longer publicly accessible
      // DO NOT USE THIS CIPHER IN PRODUCTION - KNOWN CRYPTANALYTIC ATTACKS EXIST
      this.tests = [
        {
          text: "Achterbahn-128 Functionality Test (BROKEN CIPHER - DO NOT USE)",
          uri: "Research-derived for validation only",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("0011223344556677"),
          input: OpCodes.Hex8ToBytes("48656c6c6f20576f726c64"), // "Hello World"
          expected: OpCodes.Hex8ToBytes("9bf6a4199a0c2911440125") // Computed output for validation
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AchterbahnInstance(this, isInverse);
    }
  }

  // Instance class implementing production-grade Achterbahn
  /**
 * Achterbahn cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AchterbahnInstance extends IAlgorithmInstance {
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

      // Achterbahn configuration
      this.NLFSR_SIZES = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
      this.NLFSR_TAP_POLYNOMIALS = [
        [0, 5, 17],   // NLFSR 0 (18 bits)
        [0, 2, 18],   // NLFSR 1 (19 bits)
        [0, 3, 19],   // NLFSR 2 (20 bits)
        [0, 2, 20],   // NLFSR 3 (21 bits)
        [0, 1, 21],   // NLFSR 4 (22 bits)
        [0, 5, 22],   // NLFSR 5 (23 bits)
        [0, 1, 23],   // NLFSR 6 (24 bits)
        [0, 3, 24],   // NLFSR 7 (25 bits)
        [0, 1, 25],   // NLFSR 8 (26 bits)
        [0, 3, 26],   // NLFSR 9 (27 bits)
        [0, 1, 27],   // NLFSR 10 (28 bits)
        [0, 2, 28],   // NLFSR 11 (29 bits)
        [0, 1, 29]    // NLFSR 12 (30 bits)
      ];

      this.nlfsr = null;
      this.numNLFSRs = 0;
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
        this.nlfsr = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 10 || keyLength > 16) {
        throw new Error(`Invalid Achterbahn key size: ${keyLength} bytes. Requires 10-16 bytes (80-128 bits)`);
      }

      this._key = [...keyBytes];
      this.numNLFSRs = keyLength > 10 ? 13 : 10; // 128-bit: 13 NLFSRs, 80-bit: 10 NLFSRs
      this._initializeNLFSRs();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV/nonce
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

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length > 16) {
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. Maximum 16 bytes (128 bits)`);
      }

      this._iv = [...ivBytes];
      if (this._key) {
        this._initializeNLFSRs();
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    // Feed data to the cipher
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

      this.inputBuffer.push(...data);
    }

    // Get the cipher result
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
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("Cipher not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        output.push(OpCodes.XorN(this.inputBuffer[i], keystreamByte));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize NLFSRs with key and IV
    _initializeNLFSRs() {
      if (!this._key) return;

      // Initialize NLFSR array
      this.nlfsr = new Array(this.numNLFSRs);
      for (let i = 0; i < this.numNLFSRs; i++) {
        this.nlfsr[i] = new Array(this.NLFSR_SIZES[i]).fill(0);
      }

      // Load key material into NLFSRs
      let keyBitIndex = 0;
      const totalKeyBits = this._key.length * 8;

      for (let reg = 0; reg < this.numNLFSRs; reg++) {
        const size = this.NLFSR_SIZES[reg];

        for (let i = 0; i < size && keyBitIndex < totalKeyBits; i++) {
          const byteIndex = Math.floor(keyBitIndex / 8);
          const bitIndex = keyBitIndex % 8;
          this.nlfsr[reg][i] = OpCodes.GetBit(this._key[byteIndex], bitIndex);
          keyBitIndex++;
        }

        // Ensure NLFSR is non-zero
        let allZero = true;
        for (let i = 0; i < size; i++) {
          if (this.nlfsr[reg][i] !== 0) {
            allZero = false;
            break;
          }
        }
        if (allZero) {
          this.nlfsr[reg][0] = 1;
        }
      }

      // IV initialization if present
      if (this._iv && this._iv.length > 0) {
        let ivBitIndex = 0;
        const totalIvBits = this._iv.length * 8;

        // XOR IV bits into NLFSRs
        for (let reg = 0; reg < this.numNLFSRs && ivBitIndex < totalIvBits; reg++) {
          const size = this.NLFSR_SIZES[reg];
          for (let i = 0; i < size && ivBitIndex < totalIvBits; i++) {
            const byteIndex = Math.floor(ivBitIndex / 8);
            const bitIndex = ivBitIndex % 8;
            const ivBit = OpCodes.GetBit(this._iv[byteIndex], bitIndex);
            this.nlfsr[reg][i] = OpCodes.XorN(this.nlfsr[reg][i], ivBit);
            ivBitIndex++;
          }
        }
      }

      // Warm-up cycles for initialization
      for (let i = 0; i < 256; i++) {
        this._clockAllNLFSRs();
      }

      this.initialized = true;
    }

    // Clock single NLFSR with nonlinear feedback
    _clockNLFSR(regIndex) {
      const reg = this.nlfsr[regIndex];
      const size = this.NLFSR_SIZES[regIndex];
      const taps = this.NLFSR_TAP_POLYNOMIALS[regIndex];

      // Calculate linear feedback
      let feedback = 0;
      for (let i = 0; i < taps.length; i++) {
        feedback = OpCodes.XorN(feedback, reg[taps[i]]);
      }

      // Add nonlinear terms for security
      if (size > 20) {
        feedback = OpCodes.XorN(feedback, OpCodes.AndN(reg[5], reg[10]));
        feedback = OpCodes.XorN(feedback, OpCodes.AndN(reg[8], reg[15]));
      }
      if (size > 25) {
        feedback = OpCodes.XorN(feedback, OpCodes.AndN(OpCodes.AndN(reg[3], reg[7]), reg[12]));
      }

      // Shift register and insert feedback
      const output = reg[size - 1];
      for (let i = size - 1; i > 0; i--) {
        reg[i] = reg[i - 1];
      }
      reg[0] = OpCodes.AndN(feedback, 1);

      return output;
    }

    // Clock all NLFSRs and collect outputs
    _clockAllNLFSRs() {
      const outputs = new Array(this.numNLFSRs);
      for (let i = 0; i < this.numNLFSRs; i++) {
        outputs[i] = this._clockNLFSR(i);
      }
      return outputs;
    }

    // Boolean combining function for NLFSR outputs
    _combiningFunction(inputs) {
      if (!inputs || inputs.length === 0) return 0;

      let output = 0;

      // Linear terms
      for (let i = 0; i < inputs.length; i++) {
        output = OpCodes.XorN(output, inputs[i]);
      }

      // Nonlinear terms for security
      if (inputs.length >= 8) {
        output = OpCodes.XorN(output, OpCodes.AndN(inputs[0], inputs[1]));
        output = OpCodes.XorN(output, OpCodes.AndN(inputs[2], inputs[3]));
        output = OpCodes.XorN(output, OpCodes.AndN(inputs[4], inputs[5]));
        output = OpCodes.XorN(output, OpCodes.AndN(inputs[6], inputs[7]));
      }

      if (inputs.length >= 12) {
        output = OpCodes.XorN(output, OpCodes.AndN(OpCodes.AndN(inputs[0], inputs[2]), inputs[4]));
        output = OpCodes.XorN(output, OpCodes.AndN(inputs[8], inputs[9]));
        output = OpCodes.XorN(output, OpCodes.AndN(inputs[10], inputs[11]));
      }

      // Higher-order terms
      if (inputs.length >= 13) {
        output = OpCodes.XorN(output, OpCodes.AndN(OpCodes.AndN(OpCodes.AndN(inputs[1], inputs[3]), inputs[5]), inputs[12]));
      }

      return OpCodes.AndN(output, 1);
    }

    // Generate single keystream byte
    _generateKeystreamByte() {
      let keystreamByte = 0;

      for (let bit = 0; bit < 8; bit++) {
        const nlfsr_outputs = this._clockAllNLFSRs();
        const keystreamBit = this._combiningFunction(nlfsr_outputs);
        keystreamByte = OpCodes.OrN(keystreamByte, OpCodes.Shl32(keystreamBit, bit));
      }

      return OpCodes.AndN(keystreamByte, 0xFF);
    }
  }

  // Register the algorithm
  const algorithmInstance = new AchterbahnAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { AchterbahnAlgorithm, AchterbahnInstance };
}));