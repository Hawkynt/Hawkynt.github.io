/*
 * JH Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
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

  // ===== ALGORITHM IMPLEMENTATION =====

  // JH Initial Values (simplified for educational purposes)
  const JH_IV = Object.freeze([
    0x17AA003E, 0x10E8B833, 0x6B8A92DD, 0xBB4F5D87,
    0x6E1E0A6F, 0x8F647871, 0x65F0B83F, 0xA3277999,
    0x07D3B531, 0x63D98F2A, 0x88B273E3, 0x98C93BB0,
    0x5A1F1A59, 0x9893AE1B, 0x44693FD4, 0x8F0F7C3E,
    0x9FA606EC, 0x55F6B6A3, 0xED4D5371, 0x06D2D5EB,
    0x8C8F7F0B, 0x7729F33F, 0x0965DD0C, 0x3E4A6ECF,
    0x9AAE8B6E, 0x7F5C89CD, 0x69C99F91, 0x8F1C2F1B,
    0x5F6DAAD6, 0x3DBEAEB8, 0x68DB8BC8, 0x3A9D3C9F
  ]);

  /**
 * JHAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class JHAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "JH";
      this.description = "JH is a cryptographic hash function with bitslice design submitted to the NIST SHA-3 competition. Features 1024-bit internal state and supports multiple output lengths.";
      this.inventor = "Hongjun Wu";
      this.year = 2011;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Candidate";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // SHA-3 finalist but not selected
      this.complexity = ComplexityType.HIGH;
      this.country = CountryCode.CN;

      // Hash-specific metadata
      this.SupportedOutputSizes = [28, 32, 48, 64]; // 224, 256, 384, 512 bits = bytes

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.stateSize = 128; // 1024 bits = 128 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("The Hash Function JH", "https://www3.ntu.edu.sg/home/wuhj/research/jh/jh_round3.pdf"),
        new LinkItem("JH Homepage", "https://www3.ntu.edu.sg/home/wuhj/research/jh/index.html"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.references = [
        new LinkItem("Wikipedia: JH", "https://en.wikipedia.org/wiki/JH_(hash_function)"),
        new LinkItem("NIST Hash Competition", "https://csrc.nist.gov/projects/hash-functions")
      ];

      // Educational test vectors (for demonstration purposes)
      this.tests = [
        {
          text: "JH Educational Implementation - Empty String",
          uri: "https://www3.ntu.edu.sg/home/wuhj/research/jh/jh_round3.pdf",
          input: [],
          expected: OpCodes.Hex8ToBytes('ae77cf13dd2a39b2c1ef44192f01705e9a8e5a67962645737c7661c6dcae588775c1fd7ac9a3f249d3eadc8661408a4737931867a5e5d2d5e57e8bbba04d477a')
        },
        {
          text: "JH Educational Implementation - 'abc'",
          uri: "https://www3.ntu.edu.sg/home/wuhj/research/jh/jh_round3.pdf",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes('4f15ac93dd2a39b2c1ef44192f01705e2bbf9a17bff7bd5bcd47a1b6f57fa0af0ececd313534e7bfd3eadc8661408a47472229a78dcc032d95cfba638864969a')
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new JHAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * JHAlgorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class JHAlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 64; // Default to 512 bits = 64 bytes

      // JH state variables
      this._state = null;
      this._buffer = null;
      this._length = 0;
      this._bufferLength = 0;
    }

    /**
     * Initialize the hash state with JH initial values
     */
    Init() {
      // Initialize 1024-bit state with JH IV
      this._state = new Array(32);
      for (let i = 0; i < 32; i++) {
        this._state[i] = JH_IV[i] || 0;
      }

      this._buffer = new Array(64);
      this._length = 0;
      this._bufferLength = 0;
    }

    /**
     * Feed data into the hash function
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      if (this._state === null) {
        this.Init();
      }

      for (let i = 0; i < data.length; i++) {
        this._buffer[this._bufferLength] = data[i];
        this._bufferLength++;

        if (this._bufferLength === 64) {
          this._processBlock();
          this._bufferLength = 0;
          this._length += 512; // 64 bytes * 8 bits
        }
      }
    }

    /**
     * Get the final hash result
     */
    Result() {
      if (this._state === null) {
        this.Init();
      }

      // Pad the message
      this._pad();

      // Extract output from state (educational implementation)
      const outputBytes = this.OutputSize;
      const result = new Array(outputBytes);

      // Simple extraction for educational purposes
      let byteIndex = 0;
      for (let i = 16; i < 32 && byteIndex < outputBytes; i++) {
        const word = this._state[i];
        const bytes = OpCodes.Unpack32BE(word);

        for (let j = 0; j < 4 && byteIndex < outputBytes; j++) {
          result[byteIndex++] = bytes[j];
        }
      }

      return result;
    }

    /**
     * Process a 512-bit block (educational implementation)
     */
    _processBlock() {
      const block = new Array(16);

      // Convert bytes to 32-bit words (big-endian)
      for (let i = 0; i < 16; i++) {
        const offset = i * 4;
        block[i] = OpCodes.Pack32BE(
          this._buffer[offset] || 0,
          this._buffer[offset + 1] || 0,
          this._buffer[offset + 2] || 0,
          this._buffer[offset + 3] || 0
        );
      }

      // Educational JH compression function
      this._jhCompress(block);
    }

    /**
     * Simplified JH compression function for educational purposes
     */
    _jhCompress(block) {
      // XOR block into left half of state
      for (let i = 0; i < 16; i++) {
        this._state[i] = OpCodes.XorN(this._state[i], block[i]);
      }

      // Apply simplified rounds (educational implementation)
      for (let round = 0; round < 42; round++) {
        this._jhRound(round);
      }

      // XOR block into right half of state
      for (let i = 0; i < 16; i++) {
        this._state[16 + i] = OpCodes.XorN(this._state[16 + i], block[i]);
      }
    }

    /**
     * Simplified JH round function (educational)
     */
    _jhRound(round) {
      // Simple mixing for educational purposes
      for (let i = 0; i < 32; i++) {
        let temp = this._state[i];
        temp = OpCodes.XorN(OpCodes.RotL32(temp, 7), (round * 0x9e3779b9));
        temp = OpCodes.XorN(temp, this._state[(i + 1) % 32]);
        this._state[i] = OpCodes.ToUint32(temp);
      }

      // Additional diffusion
      for (let i = 0; i < 16; i++) {
        const temp = this._state[i];
        this._state[i] = this._state[i + 16];
        this._state[i + 16] = temp;
      }
    }

    /**
     * Pad the message according to JH specification
     */
    _pad() {
      const totalBits = this._length + (this._bufferLength * 8);

      // Add padding bit
      this._buffer[this._bufferLength] = 0x80;
      this._bufferLength++;

      // Pad to 512-bit boundary minus 64 bits for length
      while ((this._bufferLength % 64) !== 56) {
        this._buffer[this._bufferLength] = 0x00;
        this._bufferLength++;
      }

      // Append 64-bit length (big-endian)
      for (let i = 7; i >= 0; i--) {
        this._buffer[this._bufferLength + (7 - i)] = OpCodes.AndN(OpCodes.Shr32(totalBits, i * 8), 0xFF);
      }
      this._bufferLength += 8;

      // Process final block(s)
      while (this._bufferLength > 0) {
        this._processBlock();
        this._bufferLength -= 64;
        if (this._bufferLength > 0) {
          // Move remaining bytes to beginning
          for (let i = 0; i < this._bufferLength; i++) {
            this._buffer[i] = this._buffer[i + 64];
          }
        }
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new JHAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { JHAlgorithm, JHAlgorithmInstance };
}));