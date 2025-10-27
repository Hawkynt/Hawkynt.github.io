/*
 * Grain-128 Stream Cipher - AlgorithmFramework Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Grain-128 is a hardware-oriented stream cipher designed for restricted hardware environments.
 * It was selected for the final eSTREAM portfolio in the Profile 2 category.
 * The algorithm uses:
 * - 128-bit keys and 96-bit IVs
 * - 128-bit Linear Feedback Shift Register (LFSR)
 * - 128-bit Non-linear Feedback Shift Register (NFSR)
 * - Boolean output filter function
 * - 256 initialization rounds (8 rounds of 32 bits) before keystream generation
 *
 * This implementation is based on the Bouncy Castle reference implementation.
 * For educational purposes only - use proven libraries for production.
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
    root.Grain128 = factory(root.AlgorithmFramework, root.OpCodes);
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
          TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class Grain128Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Grain-128";
      this.description = "Hardware-oriented stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses 128-bit keys, 96-bit IVs, and 256-bit total state.";
      this.inventor = "Martin Hell, Thomas Johansson, and Willi Meier";
      this.year = 2006;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.SE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // Grain-128: 128-bit keys only (16 bytes)
      ];
      this.SupportedNonceSizes = [
        new KeySize(12, 12, 0)  // Grain-128: 96-bit IVs (12 bytes)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("eSTREAM Grain-128 Specification", "https://www.ecrypt.eu.org/stream/grainpf.html"),
        new LinkItem("Grain-128 - A New Stream Cipher", "https://www.eit.lth.se/fileadmin/eit/courses/eit060f/Grain128.pdf"),
        new LinkItem("Bouncy Castle Reference Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/Grain128Engine.java")
      ];

      // Test vectors from Bouncy Castle test suite
      this.tests = [
        {
          text: "Bouncy Castle Test Vector #1 - All zeros",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/Grain128Test.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f09b7bf7d7f6b5c2de2ffc73ac21397f")
        },
        {
          text: "Bouncy Castle Test Vector #2 - Pattern key and IV",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/Grain128Test.java",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0123456789abcdef123456789abcdef0"),
          iv: OpCodes.Hex8ToBytes("0123456789abcdef12345678"),
          expected: OpCodes.Hex8ToBytes("afb5babfa8de896b4b9c6acaf7c4fbfd")
        }
      ];

      // Cipher parameters
      this.nBlockSizeInBits = 1;    // Stream cipher - 1 bit at a time
      this.nKeySizeInBits = 128;    // 128-bit key
      this.nIVSizeInBits = 96;      // 96-bit IV
    }

    CreateInstance(isInverse = false) {
      return new Grain128Instance(this, isInverse);
    }
  }

  class Grain128Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // Internal state - using 32-bit words like Bouncy Castle
      // 4 words of 32 bits = 128 bits total
      this.lfsr = new Array(4).fill(0);  // LFSR state (4 x 32-bit words = 128 bits)
      this.nfsr = new Array(4).fill(0);  // NFSR state (4 x 32-bit words = 128 bits)
      this.out = new Array(4).fill(0);   // Output buffer (32 bits per round)
      this.index = 4;                     // Output byte index (4 = need new round)
      this.initialized = false;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Grain-128 requires exactly 128-bit (16-byte) keys, got ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivBytes) {
      if (!ivBytes) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivBytes)) {
        throw new Error("Invalid IV - must be byte array");
      }

      if (ivBytes.length !== 12) {
        throw new Error(`Grain-128 requires exactly 96-bit (12-byte) IVs, got ${ivBytes.length} bytes`);
      }

      this._iv = [...ivBytes];
      this._initializeIfReady();
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    _initializeIfReady() {
      if (this._key && this._iv) {
        this._initializeState();
      }
    }

    _initializeState() {
      // Extend IV from 12 bytes to 16 bytes by appending 0xFFFFFFFF
      const workingIV = [...this._iv, 0xFF, 0xFF, 0xFF, 0xFF];

      // Load NFSR with key (little-endian packing)
      // Load LFSR with IV (little-endian packing)
      for (let i = 0; i < 4; ++i) {
        const j = i * 4;
        this.nfsr[i] = OpCodes.Pack32LE(
          this._key[j],
          this._key[j + 1],
          this._key[j + 2],
          this._key[j + 3]
        );
        this.lfsr[i] = OpCodes.Pack32LE(
          workingIV[j],
          workingIV[j + 1],
          workingIV[j + 2],
          workingIV[j + 3]
        );
      }

      // 256-bit initialization phase (8 rounds of 32 bits)
      for (let i = 0; i < 8; ++i) {
        const output = this._getOutput();
        const nfsrOutput = this._getOutputNFSR();
        const lfsrOutput = this._getOutputLFSR();

        // During init, output is fed back into both registers
        this.nfsr = this._shift(this.nfsr, nfsrOutput ^ this.lfsr[0] ^ output);
        this.lfsr = this._shift(this.lfsr, lfsrOutput ^ output);
      }

      this.initialized = true;
      this.index = 4; // Reset output index
    }

    // Get output from non-linear function g(x) - NFSR feedback
    _getOutputNFSR() {
      // Extract bits from NFSR using bit positions
      const b0 = this.nfsr[0];
      const b3 = (this.nfsr[0] >>> 3) | (this.nfsr[1] << 29);
      const b11 = (this.nfsr[0] >>> 11) | (this.nfsr[1] << 21);
      const b13 = (this.nfsr[0] >>> 13) | (this.nfsr[1] << 19);
      const b17 = (this.nfsr[0] >>> 17) | (this.nfsr[1] << 15);
      const b18 = (this.nfsr[0] >>> 18) | (this.nfsr[1] << 14);
      const b26 = (this.nfsr[0] >>> 26) | (this.nfsr[1] << 6);
      const b27 = (this.nfsr[0] >>> 27) | (this.nfsr[1] << 5);
      const b40 = (this.nfsr[1] >>> 8) | (this.nfsr[2] << 24);
      const b48 = (this.nfsr[1] >>> 16) | (this.nfsr[2] << 16);
      const b56 = (this.nfsr[1] >>> 24) | (this.nfsr[2] << 8);
      const b59 = (this.nfsr[1] >>> 27) | (this.nfsr[2] << 5);
      const b61 = (this.nfsr[1] >>> 29) | (this.nfsr[2] << 3);
      const b65 = (this.nfsr[2] >>> 1) | (this.nfsr[3] << 31);
      const b67 = (this.nfsr[2] >>> 3) | (this.nfsr[3] << 29);
      const b68 = (this.nfsr[2] >>> 4) | (this.nfsr[3] << 28);
      const b84 = (this.nfsr[2] >>> 20) | (this.nfsr[3] << 12);
      const b91 = (this.nfsr[2] >>> 27) | (this.nfsr[3] << 5);
      const b96 = this.nfsr[3];

      // g(x) = b0 + b26 + b56 + b91 + b96 + b3b67 + b11b13 + b17b18
      //        + b27b59 + b40b48 + b61b65 + b68b84
      return OpCodes.ToDWord(b0 ^ b26 ^ b56 ^ b91 ^ b96 ^ (b3 & b67) ^ (b11 & b13) ^ (b17 & b18)
        ^ (b27 & b59) ^ (b40 & b48) ^ (b61 & b65) ^ (b68 & b84));
    }

    // Get output from linear function f(x) - LFSR feedback
    _getOutputLFSR() {
      // Extract bits from LFSR using bit positions
      const s0 = this.lfsr[0];
      const s7 = (this.lfsr[0] >>> 7) | (this.lfsr[1] << 25);
      const s38 = (this.lfsr[1] >>> 6) | (this.lfsr[2] << 26);
      const s70 = (this.lfsr[2] >>> 6) | (this.lfsr[3] << 26);
      const s81 = (this.lfsr[2] >>> 17) | (this.lfsr[3] << 15);
      const s96 = this.lfsr[3];

      // f(x) = s0 + s7 + s38 + s70 + s81 + s96
      return OpCodes.ToDWord(s0 ^ s7 ^ s38 ^ s70 ^ s81 ^ s96);
    }

    // Get output from output function h(x)
    _getOutput() {
      // Extract NFSR bits for output function
      const b2 = (this.nfsr[0] >>> 2) | (this.nfsr[1] << 30);
      const b12 = (this.nfsr[0] >>> 12) | (this.nfsr[1] << 20);
      const b15 = (this.nfsr[0] >>> 15) | (this.nfsr[1] << 17);
      const b36 = (this.nfsr[1] >>> 4) | (this.nfsr[2] << 28);
      const b45 = (this.nfsr[1] >>> 13) | (this.nfsr[2] << 19);
      const b64 = this.nfsr[2];
      const b73 = (this.nfsr[2] >>> 9) | (this.nfsr[3] << 23);
      const b89 = (this.nfsr[2] >>> 25) | (this.nfsr[3] << 7);
      const b95 = (this.nfsr[2] >>> 31) | (this.nfsr[3] << 1);

      // Extract LFSR bits for output function
      const s8 = (this.lfsr[0] >>> 8) | (this.lfsr[1] << 24);
      const s13 = (this.lfsr[0] >>> 13) | (this.lfsr[1] << 19);
      const s20 = (this.lfsr[0] >>> 20) | (this.lfsr[1] << 12);
      const s42 = (this.lfsr[1] >>> 10) | (this.lfsr[2] << 22);
      const s60 = (this.lfsr[1] >>> 28) | (this.lfsr[2] << 4);
      const s79 = (this.lfsr[2] >>> 15) | (this.lfsr[3] << 17);
      const s93 = (this.lfsr[2] >>> 29) | (this.lfsr[3] << 3);
      const s94 = (this.lfsr[2] >>> 30) | (this.lfsr[3] << 2);

      // h(x) = b12s8 + s13s20 + b95s42 + s60s79 + b12b95s94 + s93
      //        + b2 + b15 + b36 + b45 + b64 + b73 + b89
      return OpCodes.ToDWord((b12 & s8) ^ (s13 & s20) ^ (b95 & s42) ^ (s60 & s79) ^ (b12 & b95 & s94)
        ^ s93 ^ b2 ^ b15 ^ b36 ^ b45 ^ b64 ^ b73 ^ b89);
    }

    // Shift register array by 32 bits and add new value
    _shift(array, val) {
      array[0] = array[1];
      array[1] = array[2];
      array[2] = array[3];
      array[3] = OpCodes.ToDWord(val);
      return array;
    }

    // Generate one round of keystream (32 bits / 4 bytes)
    _oneRound() {
      const output = this._getOutput();

      // Store output bytes (little-endian)
      this.out[0] = output & 0xFF;
      this.out[1] = (output >>> 8) & 0xFF;
      this.out[2] = (output >>> 16) & 0xFF;
      this.out[3] = (output >>> 24) & 0xFF;

      // Update registers (after initialization, no output feedback)
      this.nfsr = this._shift(this.nfsr, this._getOutputNFSR() ^ this.lfsr[0]);
      this.lfsr = this._shift(this.lfsr, this._getOutputLFSR());
    }

    // Get next keystream byte
    _getKeyStream() {
      if (this.index > 3) {
        this._oneRound();
        this.index = 0;
      }
      return this.out[this.index++];
    }

    Feed(data) {
      if (!data || data.length === 0) {
        return;
      }

      if (!this.initialized) {
        throw new Error("Grain-128 not initialized - key and IV must be set");
      }

      // Stream cipher - accumulate input
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.initialized) {
        throw new Error("Grain-128 not initialized - key and IV must be set");
      }

      if (this.inputBuffer.length === 0) {
        return [];
      }

      // XOR input with keystream
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        output.push(this.inputBuffer[i] ^ this._getKeyStream());
      }

      this.inputBuffer = [];
      return output;
    }

    Reset() {
      this.inputBuffer = [];
      this.index = 4;
      if (this._key && this._iv) {
        this._initializeState();
      }
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Grain128Algorithm());

  return Grain128Algorithm;
}));
